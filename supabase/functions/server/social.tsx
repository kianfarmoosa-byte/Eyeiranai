// Social Listening (رصد اجتماعی) — Phase 0 infrastructure + Phase 1 fetch.
//
// Reads PUBLIC social content that is already exposed as RSS/Atom (Telegram via
// RSSHub, Twitter/X via Nitter, Reddit, YouTube, etc.). The frontend resolves a
// user's account/handle input into a fetchable feed URL (via sourceHub.detectSource)
// and stores it on the watch topic; this module just fetches those URLs, merges
// the items, filters by the topic's keywords, and caches the result per topic.
//
// Storage (KV):
//   social:topics            → WatchTopic[]
//   social:posts:{topicId}   → { ts, posts }  (short-lived cache)
import { Hono } from "npm:hono";
import { XMLParser } from "npm:fast-xml-parser";
import * as kv from "./kv_store.tsx";

export const social = new Hono();

const TOPICS_KEY = "social:topics";
const POSTS_TTL_MS = 5 * 60 * 1000;

type WatchSource = { url: string; name: string; kind: string; icon?: string };
type WatchTopic = {
  id: string;
  label: string;
  keywords: string[];
  sources: WatchSource[];
  createdAt: number;
  updatedAt: number;
};

type SocialPost = {
  id: string;
  topicId: string;
  source: string;
  sourceKind: string;
  sourceIcon: string;
  author: string;
  text: string;
  title: string;
  link: string;
  date: string;
  dateMs: number;
  image?: string;
  views?: number;
  likes?: number;
  comments?: number;
};

// ---------- helpers ----------

function toNum(v: any): number {
  if (v == null) return 0;
  const n = typeof v === "object" ? Number(v["#text"] ?? v["@_count"] ?? v["@_views"]) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Engagement is only present on feeds that expose it (notably YouTube's Atom
// media:community block and slash:comments). Absent elsewhere → left undefined.
function extractEngagement(it: any): { views?: number; likes?: number; comments?: number } {
  const out: { views?: number; likes?: number; comments?: number } = {};
  const group = it["media:group"] || it;
  const community = group?.["media:community"];
  if (community) {
    const stats = community["media:statistics"];
    if (stats) { const v = toNum(stats["@_views"] ?? stats.views); if (v) out.views = v; }
    const rating = community["media:starRating"];
    if (rating) { const l = toNum(rating["@_count"] ?? rating.count); if (l) out.likes = l; }
  }
  const comments = toNum(it["slash:comments"]);
  if (comments) out.comments = comments;
  return out;
}

function getText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") return v["#text"] || v["@_href"] || "";
  return String(v);
}

function stripHtml(s: string): string {
  return String(s || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractImage(it: any): string | undefined {
  const media = it["media:content"] || it["media:thumbnail"];
  if (media) {
    const url = Array.isArray(media) ? media[0]?.["@_url"] : media["@_url"];
    if (url) return url;
  }
  const enc = it.enclosure;
  if (enc?.["@_url"] && /image/i.test(enc["@_type"] || "")) return enc["@_url"];
  const content = getText(it["content:encoded"] || it.content || it.description || it.summary);
  const m = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : undefined;
}

async function fetchFeedItems(src: WatchSource): Promise<SocialPost[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  let res: Response;
  try {
    res = await fetch(src.url, { headers: { "User-Agent": "Mozilla/5.0 KianSocial/1.0" }, signal: ctrl.signal });
  } finally { clearTimeout(timer); }
  if (!res.ok) throw new Error(`fetch failed ${res.status}`);
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(xml);
  const channel = parsed?.rss?.channel || parsed?.feed;
  if (!channel) throw new Error("invalid feed format");
  const feedTitle = getText(channel.title) || src.name;
  const rawItems = channel.item || channel.entry || [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items.slice(0, 40).map((it: any, i: number) => {
    const title = stripHtml(getText(it.title));
    const link = typeof it.link === "string" ? it.link : (it.link?.["@_href"] || it.link?.["#text"] || "");
    const pubDate = getText(it.pubDate || it.published || it.updated);
    const body = stripHtml(getText(it["content:encoded"] || it.content || it.description || it.summary));
    // For social posts the "text" is what matters; title is often a truncated echo.
    const text = body || title;
    const dateMs = pubDate ? (Date.parse(pubDate) || 0) : 0;
    return {
      id: `${src.kind}:${src.name}:${link || i}`,
      topicId: "",
      source: src.name || feedTitle,
      sourceKind: src.kind,
      sourceIcon: src.icon || "📡",
      author: stripHtml(getText(it.author || it["dc:creator"])) || (src.name || feedTitle),
      text,
      title,
      link,
      date: pubDate,
      dateMs,
      image: extractImage(it),
      ...extractEngagement(it),
    } as SocialPost;
  });
}

function matchesKeywords(post: SocialPost, keywords: string[]): boolean {
  if (!keywords.length) return true;
  const hay = `${post.title} ${post.text} ${post.source}`.toLowerCase();
  return keywords.some((k) => k && hay.includes(k.toLowerCase()));
}

// Fetch + merge + keyword-filter + dedupe all of a topic's sources.
async function collectPosts(topic: WatchTopic): Promise<{ posts: SocialPost[]; errors: { source: string; error: string }[] }> {
  const CONCURRENCY = 6;
  const all: SocialPost[] = [];
  const errors: { source: string; error: string }[] = [];
  let idx = 0;
  const worker = async () => {
    while (idx < topic.sources.length) {
      const src = topic.sources[idx++];
      try {
        const items = await fetchFeedItems(src);
        for (const it of items) {
          it.topicId = topic.id;
          if (matchesKeywords(it, topic.keywords)) all.push(it);
        }
      } catch (e) {
        errors.push({ source: src.name, error: String(e).slice(0, 160) });
        console.log(`social source ${src.url} failed:`, String(e).slice(0, 160));
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const seen = new Set<string>();
  const posts = all
    .filter((p) => { if (seen.has(p.id)) return false; seen.add(p.id); return true; })
    .sort((a, b) => b.dateMs - a.dateMs)
    .slice(0, 200);
  return { posts, errors };
}

// ---------- routes ----------

social.get("/topics", async (c) => {
  const topics = (await kv.get(TOPICS_KEY)) || [];
  return c.json({ topics });
});

social.post("/topics", async (c) => {
  try {
    const body = await c.req.json();
    const label = String(body.label || "").trim();
    if (!label) return c.json({ error: "label required" }, 400);
    const keywords: string[] = Array.isArray(body.keywords)
      ? body.keywords.map((k: any) => String(k).trim()).filter(Boolean)
      : [];
    const sources: WatchSource[] = Array.isArray(body.sources)
      ? body.sources
          .filter((s: any) => s && s.url)
          .map((s: any) => ({ url: String(s.url), name: String(s.name || s.url), kind: String(s.kind || "rss"), icon: s.icon }))
      : [];
    const list: WatchTopic[] = (await kv.get(TOPICS_KEY)) || [];
    const now = Date.now();
    if (body.id) {
      const idx = list.findIndex((t) => t.id === body.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], label, keywords, sources, updatedAt: now };
        await kv.set(TOPICS_KEY, list);
        return c.json({ topic: list[idx] });
      }
    }
    const topic: WatchTopic = {
      id: `wt_${now}_${Math.random().toString(36).slice(2, 7)}`,
      label, keywords, sources, createdAt: now, updatedAt: now,
    };
    list.push(topic);
    await kv.set(TOPICS_KEY, list);
    return c.json({ topic });
  } catch (e) {
    console.log("social create topic error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

social.delete("/topics/:id", async (c) => {
  const id = c.req.param("id");
  const list: WatchTopic[] = (await kv.get(TOPICS_KEY)) || [];
  await kv.set(TOPICS_KEY, list.filter((t) => t.id !== id));
  try { await kv.del(`social:posts:${id}`); } catch {}
  return c.json({ ok: true });
});

social.get("/topics/:id/posts", async (c) => {
  const id = c.req.param("id");
  const force = c.req.query("refresh") === "1";
  const list: WatchTopic[] = (await kv.get(TOPICS_KEY)) || [];
  const topic = list.find((t) => t.id === id);
  if (!topic) return c.json({ error: "topic not found" }, 404);

  const cacheKey = `social:posts:${id}`;
  if (!force) {
    try {
      const cached = await kv.get(cacheKey);
      if (cached && cached.ts && Date.now() - cached.ts < POSTS_TTL_MS) {
        return c.json({ posts: cached.posts, cached: true, sources: topic.sources.length });
      }
    } catch {}
  }

  const { posts, errors } = await collectPosts(topic);
  try { await kv.set(cacheKey, { ts: Date.now(), posts }); } catch {}
  return c.json({ posts, cached: false, sources: topic.sources.length, errors });
});

// ============================================================================
// Phase 2 — Emerging-trend detection & burst alerts (driven by automation/tick)
// ============================================================================
//
// On each scan we count how often each meaningful term appears in the topic's
// *newly seen* posts, then compare that against a per-term EWMA baseline built
// from previous scans. A term whose fresh volume greatly exceeds its baseline
// is a "burst"; a term with no baseline at all is "emerging". A jump in overall
// post volume is a "volume" spike. Alerts are appended to a capped global feed.
//
// KV:
//   social:baseline:{topicId}  → { terms: {t:ewma}, totalEwma, lastScanAt, scans, seenIds }
//   social:alerts              → SocialAlert[]  (newest first, capped)

const BASELINE_KEY = (id: string) => `social:baseline:${id}`;
const ALERTS_KEY = "social:alerts";
const ALERTS_CAP = 200;
const EWMA_ALPHA = 0.35;          // weight of the newest observation
const BURST_FACTOR = 2.5;         // fresh volume must exceed baseline × this
const MIN_BURST_COUNT = 3;        // and hit at least this many mentions
const MIN_EMERGING_COUNT = 3;     // brand-new term needs this many mentions
const VOLUME_FACTOR = 2.0;        // overall post volume spike threshold
const MIN_VOLUME_COUNT = 5;
const MAX_TERMS = 400;            // bound baseline size
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000; // don't re-alert same term for 6h
const CRISIS_NEG_RATIO = 0.45;    // fresh negative share that flags a crisis
const CRISIS_FACTOR = 1.6;        // …and must exceed baseline negativity by this
const MIN_CRISIS_COUNT = 3;       // at least this many fresh negative posts
const MIN_MENTION_COUNT = 2;      // watchlist: fresh posts hitting a keyword

// Persian negative lexicon (mirrors sentiment.ts NEGATIVE) for crisis detection.
const NEG_WORDS = new Set([
  "بد","افتضاح","فاجعه","بحران","خراب","ضعیف","نگران","نگرانی","اعتراض","شکایت","کلاهبرداری",
  "دروغ","فساد","گران","تحریم","سقوط","ضرر","زیان","خطر","تهدید","شکست","مشکل","نارضایتی",
  "متاسف","متأسف","وحشتناک","بدترین","نابود","ورشکست","تقلب","کلاهبردار","اخراج","تعطیل",
  "bad","terrible","awful","crisis","scam","fraud","fail","failed","angry","worst","broken","scandal","lawsuit","boycott",
]);

function negCount(s: string): number {
  let n = 0;
  for (const t of scanTokens(s)) if (NEG_WORDS.has(t)) n++;
  return n;
}
function isNegativePost(p: SocialPost): boolean {
  return negCount(`${p.title} ${p.text}`) >= 2;
}

const SOCIAL_STOP = new Set([
  "و","در","از","به","که","این","با","را","بر","تا","یک","یا","هم","نیز","اما","ولی",
  "برای","های","هایی","شده","شد","کرد","می","است","بود","خود","آن","ما","شما","او","آنها",
  "the","a","an","of","in","and","to","for","on","is","are","was","بین","روی","کن","کنید",
]);

function scanTokens(s: string): string[] {
  return String(s || "")
    .replace(/[‌​‍]/g, " ")
    .replace(/[يى]/g, "ی").replace(/ك/g, "ک")
    .replace(/[^؀-ۿ\sa-zA-Z0-9#]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2 && !SOCIAL_STOP.has(t));
}

type SocialAlert = {
  id: string;
  topicId: string;
  topicLabel: string;
  kind: "burst" | "emerging" | "volume" | "crisis" | "mention";
  term?: string;
  count: number;
  baseline: number;
  factor: number;
  sampleText: string;
  sampleLink: string;
  ts: number;
  read: boolean;
};

type Baseline = {
  terms: Record<string, number>;
  totalEwma: number;
  negEwma?: number;
  lastScanAt: number;
  scans: number;
  seenIds: string[];
  lastAlertAt?: Record<string, number>;
};

async function scanTopic(topic: WatchTopic, now: number): Promise<SocialAlert[]> {
  const { posts } = await collectPosts(topic);
  if (!posts.length) return [];

  const base: Baseline = (await kv.get(BASELINE_KEY(topic.id))) || {
    terms: {}, totalEwma: 0, lastScanAt: 0, scans: 0, seenIds: [], lastAlertAt: {},
  };
  base.lastAlertAt = base.lastAlertAt || {};
  const prevSeen = new Set(base.seenIds || []);

  // "Fresh" = posts we haven't counted in a previous scan.
  const fresh = posts.filter((p) => !prevSeen.has(p.id));
  const exclude = new Set((topic.keywords || []).map((k) => k.toLowerCase()));

  // Count fresh term frequency (once per post).
  const counts = new Map<string, number>();
  const sampleFor = new Map<string, SocialPost>();
  for (const p of fresh) {
    const seen = new Set<string>();
    for (const t of scanTokens(`${p.title} ${p.text}`)) {
      if (exclude.has(t) || seen.has(t)) continue;
      seen.add(t);
      counts.set(t, (counts.get(t) || 0) + 1);
      if (!sampleFor.has(t)) sampleFor.set(t, p);
    }
  }

  const alerts: SocialAlert[] = [];
  const firstScan = base.scans === 0;

  const canAlert = (key: string) => (now - (base.lastAlertAt![key] || 0)) > ALERT_COOLDOWN_MS;
  const mkAlert = (kind: SocialAlert["kind"], term: string | undefined, count: number, baseline: number, factor: number, sample?: SocialPost): SocialAlert => ({
    id: `al_${now}_${Math.random().toString(36).slice(2, 7)}`,
    topicId: topic.id, topicLabel: topic.label, kind, term, count,
    baseline: Math.round(baseline * 10) / 10, factor: Math.round(factor * 10) / 10,
    sampleText: (sample?.text || sample?.title || "").slice(0, 200),
    sampleLink: sample?.link || "", ts: now, read: false,
  });

  // Per-term burst / emerging detection (skip on the very first scan to seed baseline).
  if (!firstScan) {
    for (const [term, count] of counts) {
      const prior = base.terms[term] || 0;
      const factor = count / (prior + 0.5);
      if (prior === 0) {
        if (count >= MIN_EMERGING_COUNT && canAlert(`e:${term}`)) {
          alerts.push(mkAlert("emerging", term, count, 0, count, sampleFor.get(term)));
          base.lastAlertAt![`e:${term}`] = now;
        }
      } else if (count >= MIN_BURST_COUNT && factor >= BURST_FACTOR && canAlert(`b:${term}`)) {
        alerts.push(mkAlert("burst", term, count, prior, factor, sampleFor.get(term)));
        base.lastAlertAt![`b:${term}`] = now;
      }
    }
    // Overall volume spike.
    if (base.totalEwma > 0 && fresh.length >= MIN_VOLUME_COUNT &&
        fresh.length / base.totalEwma >= VOLUME_FACTOR && canAlert("v:_total")) {
      alerts.push(mkAlert("volume", undefined, fresh.length, base.totalEwma, fresh.length / base.totalEwma, fresh[0]));
      base.lastAlertAt!["v:_total"] = now;
    }

    // Crisis / reputation: a spike in the share of negative fresh posts.
    const negPosts = fresh.filter(isNegativePost);
    const negRatioNow = fresh.length ? negPosts.length / fresh.length : 0;
    const negBase = base.negEwma || 0;
    if (negPosts.length >= MIN_CRISIS_COUNT && negRatioNow >= CRISIS_NEG_RATIO &&
        (negBase === 0 || negRatioNow / negBase >= CRISIS_FACTOR) && canAlert("crisis")) {
      const worst = negPosts.sort((a, b) => negCount(`${b.title} ${b.text}`) - negCount(`${a.title} ${a.text}`))[0];
      alerts.push(mkAlert("crisis", topic.label, negPosts.length, Math.round(negBase * 100), Math.round(negRatioNow * 100), worst));
      base.lastAlertAt!["crisis"] = now;
    }

    // Watchlist / brand mention: fresh posts explicitly hitting a topic keyword.
    if (exclude.size > 0) {
      const mentionPosts = fresh.filter((p) => {
        const hay = `${p.title} ${p.text}`.toLowerCase();
        return [...exclude].some((k) => k && hay.includes(k));
      });
      if (mentionPosts.length >= MIN_MENTION_COUNT && canAlert("mention")) {
        alerts.push(mkAlert("mention", topic.label, mentionPosts.length, 0, mentionPosts.length, mentionPosts[0]));
        base.lastAlertAt!["mention"] = now;
      }
    }
  }

  // Update EWMA baseline: observed terms move toward their fresh count; unseen
  // terms decay toward zero so stale spikes fade out.
  const nextTerms: Record<string, number> = {};
  const termKeys = new Set<string>([...Object.keys(base.terms), ...counts.keys()]);
  for (const t of termKeys) {
    const obs = counts.get(t) || 0;
    const prior = base.terms[t] || 0;
    const val = EWMA_ALPHA * obs + (1 - EWMA_ALPHA) * prior;
    if (val >= 0.05) nextTerms[t] = Math.round(val * 100) / 100;
  }
  // Bound size: keep the strongest terms.
  const trimmed = Object.entries(nextTerms).sort((a, b) => b[1] - a[1]).slice(0, MAX_TERMS);
  base.terms = Object.fromEntries(trimmed);
  base.totalEwma = base.scans === 0 ? fresh.length : EWMA_ALPHA * fresh.length + (1 - EWMA_ALPHA) * base.totalEwma;
  base.totalEwma = Math.round(base.totalEwma * 100) / 100;
  // Negative-share EWMA baseline (crisis detection reference).
  const negRatioObs = fresh.length ? fresh.filter(isNegativePost).length / fresh.length : 0;
  base.negEwma = base.scans === 0 ? negRatioObs : EWMA_ALPHA * negRatioObs + (1 - EWMA_ALPHA) * (base.negEwma || 0);
  base.negEwma = Math.round(base.negEwma * 1000) / 1000;
  base.lastScanAt = now;
  base.scans += 1;
  base.seenIds = posts.slice(0, 400).map((p) => p.id);
  // Prune cooldown map so it can't grow unbounded.
  for (const k of Object.keys(base.lastAlertAt!)) {
    if (now - base.lastAlertAt![k] > ALERT_COOLDOWN_MS) delete base.lastAlertAt![k];
  }
  try { await kv.set(BASELINE_KEY(topic.id), base); } catch {}

  return alerts;
}

// Called from automation/tick (and the manual /scan route). Scans every topic,
// detects bursts/emerging terms, and appends alerts to the shared feed.
export async function runSocialScan(now: number = Date.now()): Promise<{ topics: number; alerts: number; errors: number }> {
  const topics: WatchTopic[] = (await kv.get(TOPICS_KEY)) || [];
  let alertCount = 0;
  let errors = 0;
  const produced: SocialAlert[] = [];
  for (const topic of topics) {
    if (!topic?.sources?.length) continue;
    try {
      const a = await scanTopic(topic, now);
      produced.push(...a);
      alertCount += a.length;
    } catch (e) {
      errors++;
      console.log(`social scan topic ${topic.id} failed:`, String(e).slice(0, 160));
    }
  }
  if (produced.length) {
    const existing: SocialAlert[] = (await kv.get(ALERTS_KEY)) || [];
    const merged = [...produced.sort((a, b) => b.count - a.count), ...existing].slice(0, ALERTS_CAP);
    try { await kv.set(ALERTS_KEY, merged); } catch {}
  }
  return { topics: topics.length, alerts: alertCount, errors };
}

// ---------- alert routes ----------

social.get("/alerts", async (c) => {
  const topicId = c.req.query("topicId");
  const unread = c.req.query("unread") === "1";
  let list: SocialAlert[] = (await kv.get(ALERTS_KEY)) || [];
  if (topicId) list = list.filter((a) => a.topicId === topicId);
  if (unread) list = list.filter((a) => !a.read);
  const unreadCount = ((await kv.get(ALERTS_KEY)) || []).filter((a: SocialAlert) => !a.read).length;
  return c.json({ alerts: list.slice(0, 100), unread: unreadCount });
});

// Mark alerts read. Body: { ids?: string[], all?: boolean }
social.post("/alerts/read", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const list: SocialAlert[] = (await kv.get(ALERTS_KEY)) || [];
    const ids = new Set(Array.isArray(body.ids) ? body.ids : []);
    for (const a of list) { if (body.all || ids.has(a.id)) a.read = true; }
    await kv.set(ALERTS_KEY, list);
    return c.json({ ok: true, unread: list.filter((a) => !a.read).length });
  } catch (e) {
    console.log("social alerts/read error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

social.delete("/alerts", async (c) => {
  await kv.set(ALERTS_KEY, []);
  return c.json({ ok: true });
});

// Manually trigger a scan (for testing / on-demand refresh from the UI).
social.post("/scan", async (c) => {
  try {
    const r = await runSocialScan(Date.now());
    return c.json({ ok: true, ...r });
  } catch (e) {
    console.log("social manual scan error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});
