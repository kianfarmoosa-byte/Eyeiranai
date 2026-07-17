import { useMemo } from "react";
import { scoreText, type SentimentScore } from "../../sentiment";
import { findDuplicates, type DuplicateCluster } from "../../duplicates";
import type { Article } from "../../data";
import type { SocialPost, WatchTopic } from "../../api";
import { KIND_META } from "../../sourceHub";

// Persian + English stopwords used for keyword/narrative mining.
const STOP = new Set([
  "و","در","از","به","که","این","با","را","بر","تا","یک","یا","هم","نیز","اما","ولی",
  "برای","های","هایی","شده","شد","کرد","می","است","بود","خود","آن","ما","شما","او","آنها",
  "خیلی","بسیار","باید","شود","کند","کنید","کنم","کنند","دارد","دارند","داشت","هست","بین","روی","طور","مورد","دیگر","همه","چند","چون",
  "the","a","an","of","in","and","to","for","on","is","are","was","were","be","by","with","as","at","from","this","that","it","its",
]);

export function postToArticle(p: SocialPost): Article {
  return {
    id: p.id,
    title: p.title || p.text.slice(0, 80),
    source: p.source,
    sourceIcon: p.sourceIcon,
    author: p.author,
    date: p.date,
    dateMs: p.dateMs,
    readTime: "",
    preview: p.text.slice(0, 280),
    content: p.text,
    image: p.image,
    starred: false,
    read: false,
    category: p.sourceKind,
  };
}

export function normalizeFa(s: string): string {
  return s
    .replace(/[‌​‍]/g, " ")
    .replace(/[يى]/g, "ی").replace(/ك/g, "ک")
    .replace(/[^؀-ۿ\sa-zA-Z0-9#@]/g, " ")
    .toLowerCase();
}

export function tokenize(s: string): string[] {
  return normalizeFa(s)
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t) && !t.startsWith("#") && !t.startsWith("@"));
}

// ── language detection (per-post) ──
export type Lang = "fa" | "en" | "ar" | "other";
export function detectLang(text: string): Lang {
  const fa = (text.match(/[ژپچگکی]/g) || []).length;
  const arabicBlock = (text.match(/[؀-ۿ]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  if (arabicBlock === 0 && latin === 0) return "other";
  if (arabicBlock > latin) return fa > 0 ? "fa" : "ar";
  return latin > 0 ? "en" : "fa";
}
export const LANG_LABEL: Record<Lang, string> = { fa: "فارسی", en: "انگلیسی", ar: "عربی", other: "سایر" };

export type ScoredPost = { post: SocialPost; s: SentimentScore };

export type SentimentBucket = { ts: number; label: string; pos: number; neg: number; neu: number; total: number; avg: number };
export type VelocityTerm = { term: string; recent: number; older: number; vel: number };
export type Hashtag = { tag: string; count: number; recent: number; older: number };
export type Narrative = { phrase: string; count: number; sample: string; sampleLink: string };
export type CoEdge = { a: string; b: string; count: number };
export type PlatformStat = { kind: string; label: string; icon: string; count: number; pct: number; pos: number; neg: number; neu: number; avg: number };
export type LangStat = { lang: Lang; label: string; count: number; pct: number };
export type SovItem = { name: string; icon: string; count: number; pct: number };
export type Coordinated = { cluster: DuplicateCluster; sources: number; spanMin: number; score: number };
export type Diffusion = { id: string; text: string; origin: { source: string; icon: string; dateMs: number }; hops: { source: string; icon: string; dateMs: number; deltaMin: number }[]; total: number };
export type TimelineEvent = { ts: number; label: string; count: number; peak: boolean; top: SocialPost | null };
export type Engagement = {
  has: boolean;
  views: number;
  likes: number;
  comments: number;
  counted: number;
  top: { post: SocialPost; views: number; likes: number; comments: number }[];
};

export type SocialInsights = {
  scored: ScoredPost[];
  pulse: { pos: number; neg: number; neu: number; avg: number; total: number; posPct: number; negPct: number; neuPct: number };
  clusters: DuplicateCluster[];
  keywords: [string, number][];
  maxKw: number;
  sentimentSeries: SentimentBucket[];
  crisis: { isCrisis: boolean; negNow: number; negBase: number; ratio: number; sample: SocialPost | null };
  velocity: VelocityTerm[];
  hashtags: Hashtag[];
  narratives: Narrative[];
  cooccur: CoEdge[];
  coNodes: string[];
  platforms: PlatformStat[];
  languages: LangStat[];
  sov: SovItem[];
  coordinated: Coordinated[];
  diffusion: Diffusion[];
  timeline: TimelineEvent[];
  engagement: Engagement;
};

function fmtBucket(ts: number, hourly: boolean): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", hourly
      ? { hour: "2-digit", minute: "2-digit" }
      : { month: "short", day: "numeric" }).format(new Date(ts));
  } catch { return String(ts); }
}

export function computeInsights(posts: SocialPost[], topic: WatchTopic | null): SocialInsights {
  const scored: ScoredPost[] = posts.map((p) => ({ post: p, s: scoreText(`${p.title} ${p.text}`) }));

  // pulse
  let pos = 0, neg = 0, neu = 0, sum = 0;
  for (const { s } of scored) {
    if (s.label === "positive") pos++; else if (s.label === "negative") neg++; else neu++;
    sum += s.score;
  }
  const totalN = scored.length || 1;
  const pulse = {
    pos, neg, neu, avg: scored.length ? sum / scored.length : 0, total: scored.length,
    posPct: Math.round((pos / totalN) * 100), negPct: Math.round((neg / totalN) * 100), neuPct: Math.round((neu / totalN) * 100),
  };

  const clusters = posts.length < 2 ? [] : findDuplicates(posts.map(postToArticle), 0.35);

  const exclude = new Set((topic?.keywords || []).map((k) => k.toLowerCase()));

  // keyword counts
  const kwCounts = new Map<string, number>();
  for (const p of posts) {
    const seen = new Set<string>();
    for (const t of tokenize(`${p.title} ${p.text}`)) {
      if (exclude.has(t) || seen.has(t)) continue;
      seen.add(t);
      kwCounts.set(t, (kwCounts.get(t) || 0) + 1);
    }
  }
  const keywords = [...kwCounts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 40);
  const maxKw = keywords[0]?.[1] || 1;

  // ── time-based split (recent vs older by median) ──
  const timed = scored.filter((x) => x.post.dateMs > 0).sort((a, b) => a.post.dateMs - b.post.dateMs);
  const times = timed.map((x) => x.post.dateMs);
  const minTs = times[0] || 0;
  const maxTs = times[times.length - 1] || 0;
  const midTs = times.length ? times[Math.floor(times.length / 2)] : 0;
  const span = maxTs - minTs;
  const hourly = span > 0 && span <= 2 * 24 * 3600 * 1000;

  // velocity per keyword (recent half vs older half)
  const recentCnt = new Map<string, number>();
  const olderCnt = new Map<string, number>();
  for (const { post } of timed) {
    const isRecent = post.dateMs >= midTs;
    const target = isRecent ? recentCnt : olderCnt;
    const seen = new Set<string>();
    for (const t of tokenize(`${post.title} ${post.text}`)) {
      if (exclude.has(t) || seen.has(t)) continue;
      seen.add(t);
      target.set(t, (target.get(t) || 0) + 1);
    }
  }
  const velTerms = new Set([...recentCnt.keys(), ...olderCnt.keys()]);
  const velocity: VelocityTerm[] = [...velTerms]
    .map((term) => ({ term, recent: recentCnt.get(term) || 0, older: olderCnt.get(term) || 0, vel: (recentCnt.get(term) || 0) - (olderCnt.get(term) || 0) }))
    .filter((v) => v.recent >= 2 && v.vel > 0)
    .sort((a, b) => b.vel - a.vel)
    .slice(0, 20);

  // hashtags (extract #tags, recent/older growth)
  const hashAll = new Map<string, number>();
  const hashRecent = new Map<string, number>();
  const hashOlder = new Map<string, number>();
  for (const p of posts) {
    const isRecent = p.dateMs >= midTs;
    const tags = (normalizeFa(`${p.title} ${p.text}`).match(/#[\w؀-ۿ]{2,}/g) || []);
    const seen = new Set<string>();
    for (const tag of tags) {
      if (seen.has(tag)) continue;
      seen.add(tag);
      hashAll.set(tag, (hashAll.get(tag) || 0) + 1);
      if (p.dateMs > 0) {
        const target = isRecent ? hashRecent : hashOlder;
        target.set(tag, (target.get(tag) || 0) + 1);
      }
    }
  }
  const hashtags: Hashtag[] = [...hashAll.entries()]
    .map(([tag, count]) => ({ tag, count, recent: hashRecent.get(tag) || 0, older: hashOlder.get(tag) || 0 }))
    .filter((h) => h.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  // narratives (bigrams/trigrams)
  const phraseCount = new Map<string, number>();
  const phraseSample = new Map<string, { text: string; link: string }>();
  for (const p of posts) {
    const toks = tokenize(`${p.title} ${p.text}`).filter((t) => !exclude.has(t));
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i + n <= toks.length; i++) {
        const gram = toks.slice(i, i + n).join(" ");
        phraseCount.set(gram, (phraseCount.get(gram) || 0) + 1);
        if (!phraseSample.has(gram)) phraseSample.set(gram, { text: p.text.slice(0, 200), link: p.link });
      }
    }
  }
  const narratives: Narrative[] = [...phraseCount.entries()]
    .filter(([g, n]) => n >= 3 && g.split(" ").length >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([phrase, count]) => ({ phrase, count, sample: phraseSample.get(phrase)?.text || "", sampleLink: phraseSample.get(phrase)?.link || "" }));

  // co-occurrence of top keywords
  const topKwSet = new Set(keywords.slice(0, 24).map(([w]) => w));
  const pairCount = new Map<string, number>();
  for (const p of posts) {
    const present = [...new Set(tokenize(`${p.title} ${p.text}`).filter((t) => topKwSet.has(t)))];
    for (let i = 0; i < present.length; i++) {
      for (let j = i + 1; j < present.length; j++) {
        const [a, b] = [present[i], present[j]].sort();
        const key = `${a}\t${b}`;
        pairCount.set(key, (pairCount.get(key) || 0) + 1);
      }
    }
  }
  const cooccur: CoEdge[] = [...pairCount.entries()]
    .map(([k, count]) => { const [a, b] = k.split("\t"); return { a, b, count }; })
    .filter((e) => e.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 24);
  const coNodes = [...new Set(cooccur.flatMap((e) => [e.a, e.b]))].slice(0, 18);

  // platform breakdown
  const platMap = new Map<string, { count: number; pos: number; neg: number; neu: number; sum: number }>();
  for (const { post, s } of scored) {
    const k = post.sourceKind || "other";
    const cur = platMap.get(k) || { count: 0, pos: 0, neg: 0, neu: 0, sum: 0 };
    cur.count++; cur.sum += s.score;
    if (s.label === "positive") cur.pos++; else if (s.label === "negative") cur.neg++; else cur.neu++;
    platMap.set(k, cur);
  }
  const platforms: PlatformStat[] = [...platMap.entries()].map(([kind, v]) => ({
    kind,
    label: (KIND_META as any)[kind]?.label || kind,
    icon: (KIND_META as any)[kind]?.icon || "📡",
    count: v.count,
    pct: Math.round((v.count / totalN) * 100),
    pos: v.pos, neg: v.neg, neu: v.neu,
    avg: v.count ? v.sum / v.count : 0,
  })).sort((a, b) => b.count - a.count);

  // language breakdown
  const langMap = new Map<Lang, number>();
  for (const p of posts) { const l = detectLang(`${p.title} ${p.text}`); langMap.set(l, (langMap.get(l) || 0) + 1); }
  const languages: LangStat[] = [...langMap.entries()]
    .map(([lang, count]) => ({ lang, label: LANG_LABEL[lang], count, pct: Math.round((count / totalN) * 100) }))
    .sort((a, b) => b.count - a.count);

  // share of voice (by source)
  const srcMap = new Map<string, { count: number; icon: string }>();
  for (const p of posts) {
    const cur = srcMap.get(p.source) || { count: 0, icon: p.sourceIcon || "📡" };
    cur.count++; srcMap.set(p.source, cur);
  }
  const sov: SovItem[] = [...srcMap.entries()]
    .map(([name, v]) => ({ name, icon: v.icon, count: v.count, pct: Math.round((v.count / totalN) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // coordinated behaviour
  const coordinated: Coordinated[] = clusters.map((c) => {
    const srcs = new Set(c.articles.map((a) => a.source));
    const ds = c.articles.map((a) => a.dateMs || 0).filter((d) => d > 0);
    const spanMin = ds.length >= 2 ? (Math.max(...ds) - Math.min(...ds)) / 60000 : 0;
    const spanHours = Math.max(spanMin / 60, 0.25);
    const score = srcs.size / spanHours;
    return { cluster: c, sources: srcs.size, spanMin: Math.round(spanMin), score };
  }).filter((x) => x.sources >= 3).sort((a, b) => b.score - a.score);

  // diffusion
  const diffusion: Diffusion[] = clusters
    .map((c) => {
      const arts = c.articles.filter((a) => (a.dateMs || 0) > 0).sort((a, b) => (a.dateMs || 0) - (b.dateMs || 0));
      if (arts.length < 2) return null;
      const origin = arts[0];
      return {
        id: c.id,
        text: (origin.preview || origin.title || "").slice(0, 140),
        origin: { source: origin.source, icon: origin.sourceIcon || "📡", dateMs: origin.dateMs || 0 },
        hops: arts.slice(1).map((a) => ({ source: a.source, icon: a.sourceIcon || "📡", dateMs: a.dateMs || 0, deltaMin: Math.round(((a.dateMs || 0) - (origin.dateMs || 0)) / 60000) })),
        total: arts.length,
      } as Diffusion;
    })
    .filter((x): x is Diffusion => !!x)
    .slice(0, 12);

  // sentiment-over-time + event timeline
  const sentimentSeries: SentimentBucket[] = [];
  const timeline: TimelineEvent[] = [];
  if (timed.length >= 2 && span > 0) {
    const buckets = Math.min(24, Math.max(4, Math.round(timed.length / 4)));
    const step = span / buckets;
    const arr = Array.from({ length: buckets + 1 }, (_, i) => ({ ts: minTs + i * step, pos: 0, neg: 0, neu: 0, sum: 0, total: 0, top: null as SocialPost | null, topScore: -1 }));
    for (const { post, s } of timed) {
      const idx = Math.min(buckets, Math.floor((post.dateMs - minTs) / step));
      const b = arr[idx];
      b.total++; b.sum += s.score;
      if (s.label === "positive") b.pos++; else if (s.label === "negative") b.neg++; else b.neu++;
      const w = post.text.length;
      if (w > b.topScore) { b.topScore = w; b.top = post; }
    }
    const totals = arr.map((b) => b.total);
    const mean = totals.reduce((a, c) => a + c, 0) / (totals.length || 1);
    const variance = totals.reduce((a, c) => a + (c - mean) ** 2, 0) / (totals.length || 1);
    const std = Math.sqrt(variance);
    for (const b of arr) {
      if (b.total === 0) continue;
      sentimentSeries.push({ ts: b.ts, label: fmtBucket(b.ts, hourly), pos: b.pos, neg: b.neg, neu: b.neu, total: b.total, avg: b.total ? b.sum / b.total : 0 });
      timeline.push({ ts: b.ts, label: fmtBucket(b.ts, hourly), count: b.total, peak: b.total >= mean + std && b.total >= 3, top: b.top });
    }
  }

  // crisis / reputation
  let crisis = { isCrisis: false, negNow: 0, negBase: 0, ratio: 0, sample: null as SocialPost | null };
  if (sentimentSeries.length >= 3) {
    const last = sentimentSeries[sentimentSeries.length - 1];
    const prior = sentimentSeries.slice(0, -1);
    const priorNegRatio = prior.reduce((a, b) => a + b.neg, 0) / Math.max(1, prior.reduce((a, b) => a + b.total, 0));
    const negNow = last.total ? last.neg / last.total : 0;
    const ratio = priorNegRatio > 0 ? negNow / priorNegRatio : (negNow > 0 ? Infinity : 0);
    const worst = scored.filter((x) => x.post.dateMs >= last.ts && x.s.label === "negative").sort((a, b) => a.s.score - b.s.score)[0];
    crisis = {
      isCrisis: last.neg >= 3 && negNow >= 0.45 && (priorNegRatio === 0 || ratio >= 1.8),
      negNow: Math.round(negNow * 100),
      negBase: Math.round(priorNegRatio * 100),
      ratio: Number.isFinite(ratio) ? Math.round(ratio * 10) / 10 : 0,
      sample: worst?.post || null,
    };
  }

  // engagement (only present on feeds that expose it, e.g. YouTube)
  let evViews = 0, evLikes = 0, evComments = 0, evCounted = 0;
  for (const p of posts) {
    const v = p.views || 0, l = p.likes || 0, cm = p.comments || 0;
    if (v || l || cm) evCounted++;
    evViews += v; evLikes += l; evComments += cm;
  }
  const engagement: Engagement = {
    has: evCounted > 0,
    views: evViews, likes: evLikes, comments: evComments, counted: evCounted,
    top: posts
      .filter((p) => (p.views || p.likes || p.comments))
      .map((p) => ({ post: p, views: p.views || 0, likes: p.likes || 0, comments: p.comments || 0 }))
      .sort((a, b) => (b.views + b.likes + b.comments) - (a.views + a.likes + a.comments))
      .slice(0, 8),
  };

  return {
    scored, pulse, clusters, keywords, maxKw,
    sentimentSeries, crisis, velocity, hashtags, narratives, cooccur, coNodes,
    platforms, languages, sov, coordinated, diffusion, timeline, engagement,
  };
}

export function useSocialInsights(posts: SocialPost[], topic: WatchTopic | null): SocialInsights {
  return useMemo(() => computeInsights(posts, topic), [posts, topic]);
}
