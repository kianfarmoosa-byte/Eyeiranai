// AI-powered custom news-package builder (تولیدکنندهٔ بستهٔ خبری سفارشی).
//
// A "pack" is a user-defined newsletter: ordered sections, each with a content
// type (news/analysis/report/…), a target length, a max item count, optional
// topic keywords, and a set of sources (RSS/site/social feeds — Persian OR
// foreign). On generation we fetch each section's sources over the pack's
// collection window, filter/dedupe/sort, then run ONE AI editorial pass per
// section that rewrites items to the requested length + content-type tone and
// translates any non-Persian item into professional Persian.
//
// Storage (KV):
//   newspack:packs:{userId}        → NewsPack[]
//   newspack:editions:{packId}     → Edition[]   (capped, newest first)
import { Hono } from "npm:hono";
import { XMLParser } from "npm:fast-xml-parser";
import * as kv from "./kv_store.tsx";

export const newspack = new Hono();

const PACKS_KEY = (u: string) => `newspack:packs:${u}`;
const EDITIONS_KEY = (packId: string) => `newspack:editions:${packId}`;
const NOTIFS_KEY = (u: string) => `newspack:notifs:${u}`;
const STATS_KEY = (packId: string) => `newspack:stats:${packId}`;
const SHARE_KEY = (token: string) => `newspack:share:${token}`;
const EDITIONS_CAP = 20;
const NOTIFS_CAP = 50;
const HISTORY_CAP = 60;

// ── AI config (self-contained to avoid a circular import with index.tsx) ──
const AI_BASE = "https://apimaster.ai/v1";
const AI_MODEL = "claude-sonnet-4-6";

async function getAiConfig(userId?: string): Promise<{ key: string; base: string; model: string }> {
  if (userId) {
    try {
      const cfg: any = await kv.get(`ai:config:${userId}`);
      if (cfg?.apiKey) {
        return { key: cfg.apiKey, base: (cfg.baseUrl || AI_BASE).replace(/\/+$/, ""), model: cfg.model || AI_MODEL };
      }
    } catch (e) { console.log("newspack getAiConfig error:", String(e)); }
  }
  return { key: Deno.env.get("AI_API_KEY") || "", base: AI_BASE, model: AI_MODEL };
}

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

async function aiChat(messages: ChatMsg[], opts: { maxTokens?: number; temperature?: number; userId?: string } = {}): Promise<string> {
  const cfg = await getAiConfig(opts.userId);
  if (!cfg.key) throw new Error("کلید هوش مصنوعی تنظیم نشده است (نه کلید کاربر، نه کلید پیش‌فرض سرور)");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  let res: Response;
  try {
    res = await fetch(`${cfg.base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({ model: cfg.model, messages, max_tokens: opts.maxTokens ?? 2000, temperature: opts.temperature ?? 0.4 }),
      signal: ctrl.signal,
    });
  } finally { clearTimeout(timer); }
  const raw = await res.text();
  if (!res.ok) throw new Error(`AI upstream error ${res.status}: ${raw.slice(0, 400)}`);
  let data: any;
  try { data = JSON.parse(raw); } catch { throw new Error(`AI upstream returned non-JSON: ${raw.slice(0, 200)}`); }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error(`AI upstream returned empty content: ${raw.slice(0, 200)}`);
  return content.trim();
}

function extractJsonArray(text: string): any[] {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

function extractJsonObject(text: string): any {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

// ── feed fetching ──
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function getText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return String(v["#text"] ?? v["@_href"] ?? "");
  return String(v);
}
function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#\d+;/g, " ").replace(/\s+/g, " ").trim();
}
function extractImage(it: any): string {
  const enc = it?.enclosure?.["@_url"] || it?.["media:content"]?.["@_url"] || it?.["media:thumbnail"]?.["@_url"];
  if (enc) return String(enc);
  const html = getText(it?.["content:encoded"]) || getText(it?.description) || "";
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : "";
}

type FeedItem = { title: string; summary: string; link: string; publishedAt: number; image: string };

async function fetchFeed(url: string): Promise<FeedItem[]> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    let res: Response;
    try {
      res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; NewspackBot/1.0)" }, signal: ctrl.signal });
    } finally { clearTimeout(timer); }
    if (!res.ok) return [];
    const xml = await res.text();
    const parsed = parser.parse(xml);
    const channel = parsed?.rss?.channel;
    const feed = parsed?.feed;
    let rawItems: any[] = [];
    if (channel) rawItems = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];
    else if (feed) rawItems = Array.isArray(feed.entry) ? feed.entry : feed.entry ? [feed.entry] : [];
    const out: FeedItem[] = [];
    for (const it of rawItems) {
      const title = stripHtml(getText(it.title));
      if (!title) continue;
      const rawLink = channel ? getText(it.link) : (Array.isArray(it.link) ? getText(it.link.find((l: any) => l["@_rel"] !== "self") || it.link[0]) : getText(it.link));
      const dateStr = getText(it.pubDate) || getText(it.published) || getText(it.updated) || getText(it["dc:date"]);
      const publishedAt = dateStr ? new Date(dateStr).getTime() : 0;
      const summary = stripHtml(getText(it.description) || getText(it.summary) || getText(it["content:encoded"]) || getText(it.content)).slice(0, 800);
      out.push({ title, summary, link: rawLink, publishedAt: Number.isFinite(publishedAt) ? publishedAt : 0, image: extractImage(it) });
    }
    return out;
  } catch (e) {
    console.log("newspack fetchFeed error:", url, String(e));
    return [];
  }
}

// ── editorial prompt fragments ──
const LENGTH_GUIDE: Record<string, string> = {
  headline: "فقط یک تیتر خبری کوتاه و گیرا؛ خلاصه را خالی («») بگذار.",
  short: "خلاصه در حد یک جملهٔ کامل و مفید.",
  medium: "خلاصه در حد دو تا سه جملهٔ روشن و اطلاعاتی.",
  long: "خلاصه در حد یک پاراگراف کامل و تحلیلی.",
};
const TYPE_GUIDE: Record<string, string> = {
  news: "لحن خبری، عینی و بی‌طرف؛ مهم‌ترین واقعیت‌ها در ابتدا.",
  analysis: "لحن تحلیلی؛ دلالت‌ها و پیامدها و چرایی رویداد را روشن کن.",
  report: "لحن گزارشی و توصیفی با جزئیات و زمینه.",
  opinion: "لحن یادداشت/دیدگاه؛ موضع و استدلال را منتقل کن.",
  interview: "بر نکات کلیدی گفت‌وگو و نقل‌قول‌های مهم تمرکز کن.",
  tech: "لحن فنی و تخصصی؛ اصطلاحات درست فنی را حفظ کن.",
  science: "لحن علمی و دقیق؛ یافته‌ها و روش را برجسته کن.",
  business: "لحن اقتصادی؛ اعداد، بازار و پیامدهای مالی را برجسته کن.",
  sport: "لحن ورزشی و پرانرژی؛ نتایج و رویدادهای کلیدی.",
  culture: "لحن فرهنگی-هنری.",
  entertainment: "لحن سبک و سرگرم‌کننده.",
  longread: "لحن مقالهٔ بلند و روایی.",
};

type PackSource = { id: string; url: string; name: string; icon?: string; sourceKind?: string; lang?: string };
type PackSection = { id: string; title: string; contentType: string; itemLength: string; maxItems: number; keywords: string[]; sources: PackSource[]; order: number };
type NewsPack = { id: string; userId?: string; title: string; theme: string; intro?: string; timespanHours: number; scheduleEveryHours: number; sections: PackSection[]; deliveryEmail?: string; deliveryWebhookUrl?: string; shareToken?: string; lastGeneratedAt?: number; createdAt: number; updatedAt: number };
type PackStats = {
  packId: string;
  totalEditions: number; totalItems: number; totalTranslated: number;
  manualRuns: number; scheduledRuns: number;
  deliveries: { webhookOk: number; webhookFail: number; emailOk: number; emailFail: number };
  sectionCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  history: { t: number; items: number; translated: number }[];
  firstAt: number; lastAt: number;
};
type Notif = { id: string; packId: string; packTitle: string; editionId: string; items: number; createdAt: number; trigger: "manual" | "scheduled"; delivery?: { webhook?: string; email?: string }; read?: boolean };
type EditionItem = { title: string; summary: string; source: string; sourceIcon?: string; link: string; publishedAt: number; originalLang?: string; translated?: boolean; image?: string; pinned?: boolean };
type EditionSection = { id: string; title: string; contentType: string; itemLength: string; items: EditionItem[]; intro?: string };
type Edition = { id: string; packId: string; packTitle: string; theme: string; intro?: string; generatedAt: number; sections: EditionSection[]; stats: { sections: number; items: number; translated: number; sources: number } };

const norm = (s: string) => s.toLowerCase().replace(/[ً-ْ]/g, "").replace(/ی/g, "ي").replace(/ک/g, "ك");

async function buildSection(section: PackSection, sinceMs: number, userId: string, seenGlobal: Set<string>): Promise<EditionSection> {
  // collect from all sources
  const collected: { item: FeedItem; src: PackSource }[] = [];
  const results = await Promise.all((section.sources || []).map((s) => fetchFeed(s.url).then((items) => ({ s, items }))));
  for (const { s, items } of results) {
    for (const item of items) collected.push({ item, src: s });
  }
  // window by collection period
  let windowed = collected.filter(({ item }) => item.publishedAt === 0 || item.publishedAt >= sinceMs);
  if (windowed.length === 0) windowed = collected; // fall back if timestamps missing
  // keyword filter (topic-based selection)
  const kws = (section.keywords || []).map(norm).filter(Boolean);
  if (kws.length) {
    windowed = windowed.filter(({ item }) => {
      const hay = norm(item.title + " " + item.summary);
      return kws.some((k) => hay.includes(k));
    });
  }
  // dedupe by title AND link — using a shared set so the same story does not
  // repeat across sections (cross-section dedupe).
  const deduped: typeof windowed = [];
  for (const row of windowed) {
    const titleKey = "t:" + norm(row.item.title).slice(0, 80);
    const linkKey = row.item.link ? "l:" + row.item.link.trim() : "";
    if (seenGlobal.has(titleKey) || (linkKey && seenGlobal.has(linkKey))) continue;
    seenGlobal.add(titleKey);
    if (linkKey) seenGlobal.add(linkKey);
    deduped.push(row);
  }
  // newest first, slice
  deduped.sort((a, b) => b.item.publishedAt - a.item.publishedAt);
  const cap = Math.max(1, Math.min(10, section.maxItems || 5));
  const chosen = deduped.slice(0, cap);

  const items: EditionItem[] = chosen.map(({ item, src }) => ({
    title: item.title,
    summary: item.summary,
    source: src.name,
    sourceIcon: src.icon,
    link: item.link,
    publishedAt: item.publishedAt,
    originalLang: src.lang || "fa",
    translated: false,
    image: item.image || "",
  }));

  if (items.length === 0) {
    return { id: section.id, title: section.title, contentType: section.contentType, itemLength: section.itemLength, items: [], intro: "" };
  }

  // ── ONE AI editorial pass: section intro + rewrite items to length + tone + translate to Persian ──
  const lenGuide = LENGTH_GUIDE[section.itemLength] || LENGTH_GUIDE.short;
  const typeGuide = TYPE_GUIDE[section.contentType] || TYPE_GUIDE.news;
  const sys =
    "تو سردبیر حرفه‌ای یک بستهٔ خبری فارسی هستی. مجموعه‌ای از مطالب خام (که ممکن است به هر زبانی باشند) به تو داده می‌شود. " +
    "ابتدا یک «سرمقالهٔ کوتاه» (یک تا دو جمله) برای این بخش بنویس که مهم‌ترین جان‌مایه و فضای کلی مطالب این بخش را جمع‌بندی کند. " +
    "سپس برای هر مطلب یک تیتر و خلاصهٔ فارسیِ روان و حرفه‌ای بنویس. " +
    "اگر مطلب به زبانی غیر از فارسی است، آن را به فارسیِ روان و دقیق ترجمه کن (ترجمهٔ ماشینی نکن؛ مثل یک مترجم خبری حرفه‌ای عمل کن). " +
    `نوع محتوای این بخش: ${typeGuide} ` +
    `طول هر مطلب: ${lenGuide} ` +
    "خروجی را فقط و فقط به صورت یک شیء JSON معتبر بده، بدون هیچ توضیح اضافه. " +
    'ساختار دقیق: {"intro": string, "items": [{"i": number, "title": string, "summary": string}]}. i همان شمارهٔ ورودی است.';
  const payload = items.map((it, i) => ({ i, lang: it.originalLang, title: it.title, text: it.summary.slice(0, 700) }));
  const user = `بخش: «${section.title}»\n\nمطالب خام:\n${JSON.stringify(payload, null, 1)}`;

  let intro = "";
  try {
    const reply = await aiChat([{ role: "system", content: sys }, { role: "user", content: user }], { maxTokens: 2800, temperature: 0.4, userId });
    const obj = extractJsonObject(reply);
    intro = typeof obj?.intro === "string" ? obj.intro.trim() : "";
    const arr = Array.isArray(obj?.items) ? obj.items : [];
    const byIndex = new Map<number, { title?: string; summary?: string }>();
    for (const r of arr) if (typeof r?.i === "number") byIndex.set(r.i, r);
    items.forEach((it, i) => {
      const r = byIndex.get(i);
      if (r) {
        if (r.title) it.title = String(r.title);
        it.summary = typeof r.summary === "string" ? r.summary : it.summary;
        it.translated = (it.originalLang || "fa") !== "fa";
      }
      if (section.itemLength === "headline") it.summary = "";
    });
  } catch (e) {
    console.log("newspack buildSection AI error (using raw):", String(e));
    if (section.itemLength === "headline") items.forEach((it) => (it.summary = ""));
  }

  return { id: section.id, title: section.title, contentType: section.contentType, itemLength: section.itemLength, items, intro };
}

async function generateEdition(pack: NewsPack, now: number, userId: string): Promise<Edition> {
  const sinceMs = now - Math.max(1, pack.timespanHours || 24) * 3600 * 1000;
  const ordered = [...(pack.sections || [])].sort((a, b) => a.order - b.order);
  const sections: EditionSection[] = [];
  const seenGlobal = new Set<string>(); // cross-section dedupe
  for (const s of ordered) sections.push(await buildSection(s, sinceMs, userId, seenGlobal));
  const items = sections.reduce((n, s) => n + s.items.length, 0);
  const translated = sections.reduce((n, s) => n + s.items.filter((i) => i.translated).length, 0);
  const sources = new Set<string>();
  ordered.forEach((s) => (s.sources || []).forEach((x) => sources.add(x.url)));
  return {
    id: `ed_${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    packId: pack.id,
    packTitle: pack.title,
    theme: pack.theme,
    intro: pack.intro,
    generatedAt: now,
    sections,
    stats: { sections: sections.length, items, translated, sources: sources.size },
  };
}

async function storeEdition(packId: string, edition: Edition) {
  const list: Edition[] = (await kv.get(EDITIONS_KEY(packId))) || [];
  const next = [edition, ...list].slice(0, EDITIONS_CAP);
  await kv.set(EDITIONS_KEY(packId), next);
}

// ── notifications ──
async function pushNotif(userId: string, notif: Notif) {
  try {
    const list: Notif[] = (await kv.get(NOTIFS_KEY(userId))) || [];
    await kv.set(NOTIFS_KEY(userId), [notif, ...list].slice(0, NOTIFS_CAP));
  } catch (e) { console.log("newspack pushNotif error:", String(e)); }
}

// ── per-pack analytics accumulator ──
async function recordStats(pack: NewsPack, edition: Edition, trigger: "manual" | "scheduled", delivery: { webhook?: string; email?: string }) {
  try {
    const cur: PackStats = (await kv.get(STATS_KEY(pack.id))) || {
      packId: pack.id,
      totalEditions: 0, totalItems: 0, totalTranslated: 0,
      manualRuns: 0, scheduledRuns: 0,
      deliveries: { webhookOk: 0, webhookFail: 0, emailOk: 0, emailFail: 0 },
      sectionCounts: {}, sourceCounts: {},
      history: [], firstAt: edition.generatedAt, lastAt: edition.generatedAt,
    };
    cur.totalEditions += 1;
    cur.totalItems += edition.stats.items;
    cur.totalTranslated += edition.stats.translated;
    if (trigger === "manual") cur.manualRuns += 1; else cur.scheduledRuns += 1;
    if (delivery.webhook) (delivery.webhook === "ok" ? cur.deliveries.webhookOk++ : cur.deliveries.webhookFail++);
    if (delivery.email) (delivery.email === "ok" ? cur.deliveries.emailOk++ : cur.deliveries.emailFail++);
    for (const s of edition.sections) {
      cur.sectionCounts[s.title] = (cur.sectionCounts[s.title] || 0) + s.items.length;
      for (const it of s.items) cur.sourceCounts[it.source] = (cur.sourceCounts[it.source] || 0) + 1;
    }
    cur.history = [...cur.history, { t: edition.generatedAt, items: edition.stats.items, translated: edition.stats.translated }].slice(-HISTORY_CAP);
    cur.lastAt = edition.generatedAt;
    if (!cur.firstAt) cur.firstAt = edition.generatedAt;
    await kv.set(STATS_KEY(pack.id), cur);
  } catch (e) { console.log("newspack recordStats error:", String(e)); }
}

// ── server-side plain HTML for email body ──
function editionEmailHtml(edition: Edition): string {
  const esc = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const date = (() => { try { return new Intl.DateTimeFormat("fa-IR", { dateStyle: "full", timeStyle: "short" }).format(new Date(edition.generatedAt)); } catch { return ""; } })();
  const sections = edition.sections.map((s) => {
    const intro = s.intro ? `<p style="color:#475569;font-style:italic;border-inline-start:2px solid #93c5fd;padding-inline-start:10px">${esc(s.intro)}</p>` : "";
    const items = s.items.length === 0
      ? `<p style="color:#94a3b8;font-style:italic">مطلبی یافت نشد.</p>`
      : s.items.map((it) => `
        <div style="padding:8px 0;border-bottom:1px solid #f1f5f9">
          <a href="${esc(it.link)}" style="color:#0f172a;text-decoration:none;font-weight:bold;font-size:16px">${esc(it.title)}</a>
          ${s.itemLength !== "headline" && it.summary ? `<p style="color:#334155;margin:4px 0">${esc(it.summary)}</p>` : ""}
          <div style="color:#94a3b8;font-size:12px">${esc(it.source)}${it.translated ? " · ترجمه‌شده" : ""}</div>
        </div>`).join("");
    return `<h2 style="font-size:18px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-top:24px">${esc(s.title)}</h2>${intro}${items}`;
  }).join("");
  return `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;line-height:1.8">
    <h1 style="font-size:22px;margin:0">📰 ${esc(edition.packTitle)}</h1>
    <div style="color:#64748b;font-size:13px;margin-bottom:16px">${esc(date)}</div>
    ${edition.intro ? `<p style="color:#334155;border-inline-start:3px solid #3b82f6;padding-inline-start:12px">${esc(edition.intro)}</p>` : ""}
    ${sections}
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">این بسته به صورت خودکار تولید و ارسال شده است.</p>
  </div>`;
}

async function postWebhook(url: string, edition: Edition): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "newspack.edition", edition }),
        signal: ctrl.signal,
      });
    } finally { clearTimeout(timer); }
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function sendEmail(to: string, edition: Edition): Promise<{ ok: boolean; error?: string }> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, error: "کلید سرویس ایمیل (RESEND_API_KEY) تنظیم نشده است" };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    let res: Response;
    try {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          from: "Newspack <onboarding@resend.dev>",
          to: [to],
          subject: `📰 ${edition.packTitle}`,
          html: editionEmailHtml(edition),
        }),
        signal: ctrl.signal,
      });
    } finally { clearTimeout(timer); }
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// deliver an edition to the pack's configured webhook + email channels.
async function deliverEdition(pack: NewsPack, edition: Edition): Promise<{ webhook?: string; email?: string }> {
  const out: { webhook?: string; email?: string } = {};
  if (pack.deliveryWebhookUrl) {
    const r = await postWebhook(pack.deliveryWebhookUrl, edition);
    out.webhook = r.ok ? "ok" : (r.error || `status ${r.status}`);
  }
  if (pack.deliveryEmail) {
    const r = await sendEmail(pack.deliveryEmail, edition);
    out.email = r.ok ? "ok" : (r.error || "failed");
  }
  return out;
}

function sanitizePack(body: any, u: string, existing?: NewsPack): NewsPack {
  const now = Date.now();
  const clampInt = (v: any, min: number, max: number, dflt: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : dflt;
  };
  const sections: PackSection[] = Array.isArray(body?.sections) ? body.sections.map((s: any, idx: number) => ({
    id: String(s?.id || `sec_${now.toString(36)}_${idx}`),
    title: String(s?.title || "بخش").slice(0, 120),
    contentType: String(s?.contentType || "news"),
    itemLength: String(s?.itemLength || "short"),
    maxItems: clampInt(s?.maxItems, 1, 10, 5),
    keywords: Array.isArray(s?.keywords) ? s.keywords.map((k: any) => String(k).slice(0, 60)).slice(0, 20) : [],
    sources: Array.isArray(s?.sources) ? s.sources.map((x: any, j: number) => ({
      id: String(x?.id || `src_${now.toString(36)}_${idx}_${j}`),
      url: String(x?.url || ""),
      name: String(x?.name || "منبع").slice(0, 120),
      icon: x?.icon ? String(x.icon).slice(0, 8) : undefined,
      sourceKind: x?.sourceKind ? String(x.sourceKind) : undefined,
      lang: x?.lang ? String(x.lang).slice(0, 8) : "fa",
    })).filter((x: PackSource) => x.url).slice(0, 40) : [],
    order: clampInt(s?.order, 0, 999, idx),
  })) : [];
  return {
    id: String(body?.id || existing?.id || `np_${now.toString(36)}${Math.random().toString(36).slice(2, 5)}`),
    userId: u,
    title: String(body?.title || "بستهٔ خبری").slice(0, 160),
    theme: String(body?.theme || "editorial"),
    intro: body?.intro ? String(body.intro).slice(0, 500) : "",
    timespanHours: clampInt(body?.timespanHours, 1, 720, 24),
    scheduleEveryHours: clampInt(body?.scheduleEveryHours, 0, 720, 0),
    deliveryEmail: body?.deliveryEmail && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(body.deliveryEmail).trim())
      ? String(body.deliveryEmail).trim().slice(0, 160) : "",
    deliveryWebhookUrl: body?.deliveryWebhookUrl && /^https?:\/\//i.test(String(body.deliveryWebhookUrl).trim())
      ? String(body.deliveryWebhookUrl).trim().slice(0, 500) : "",
    sections,
    shareToken: existing?.shareToken,
    lastGeneratedAt: existing?.lastGeneratedAt,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

function packUser(c: any): string {
  const u = c.req.query("u");
  return (u ? String(u) : "anon").slice(0, 120);
}

// ── routes ──
newspack.get("/packs", async (c) => {
  const u = packUser(c);
  const packs: NewsPack[] = (await kv.get(PACKS_KEY(u))) || [];
  return c.json({ packs });
});

newspack.post("/packs", async (c) => {
  try {
    const u = packUser(c);
    const body = await c.req.json();
    const packs: NewsPack[] = (await kv.get(PACKS_KEY(u))) || [];
    const existing = packs.find((p) => p.id === body?.id);
    const pack = sanitizePack(body, u, existing);
    const next = existing ? packs.map((p) => (p.id === pack.id ? pack : p)) : [pack, ...packs];
    await kv.set(PACKS_KEY(u), next);
    return c.json({ pack });
  } catch (e) {
    console.log("newspack save error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

newspack.delete("/packs/:id", async (c) => {
  const u = packUser(c);
  const id = c.req.param("id");
  const packs: NewsPack[] = (await kv.get(PACKS_KEY(u))) || [];
  const removed = packs.find((p) => p.id === id);
  await kv.set(PACKS_KEY(u), packs.filter((p) => p.id !== id));
  await kv.del(EDITIONS_KEY(id));
  await kv.del(STATS_KEY(id));
  if (removed?.shareToken) { await kv.del(SHARE_KEY(removed.shareToken)); await kv.del(COLLAB_KEY(removed.shareToken)); }
  return c.json({ ok: true });
});

// ── per-pack analytics ──
newspack.get("/packs/:id/stats", async (c) => {
  const id = c.req.param("id");
  const stats: PackStats | null = (await kv.get(STATS_KEY(id))) || null;
  return c.json({ stats });
});

// ── sharing / collaboration ──
newspack.post("/packs/:id/share", async (c) => {
  try {
    const u = packUser(c);
    const id = c.req.param("id");
    const packs: NewsPack[] = (await kv.get(PACKS_KEY(u))) || [];
    const pack = packs.find((p) => p.id === id);
    if (!pack) return c.json({ error: "بسته یافت نشد" }, 404);
    let token = pack.shareToken;
    if (!token) {
      token = `sh_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      pack.shareToken = token;
      await kv.set(PACKS_KEY(u), packs.map((p) => (p.id === id ? pack : p)));
    }
    await kv.set(SHARE_KEY(token), { packId: id, owner: u, createdAt: Date.now() });
    return c.json({ token });
  } catch (e) {
    console.log("newspack share error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

newspack.delete("/packs/:id/share", async (c) => {
  const u = packUser(c);
  const id = c.req.param("id");
  const packs: NewsPack[] = (await kv.get(PACKS_KEY(u))) || [];
  const pack = packs.find((p) => p.id === id);
  if (pack?.shareToken) {
    await kv.del(SHARE_KEY(pack.shareToken));
    await kv.del(COLLAB_KEY(pack.shareToken));
    await kv.set(PACKS_KEY(u), packs.map((p) => (p.id === id ? { ...p, shareToken: undefined } : p)));
  }
  return c.json({ ok: true });
});

// public (read-only) view of a shared pack + its latest edition
newspack.get("/shared/:token", async (c) => {
  const token = c.req.param("token");
  const ref: any = await kv.get(SHARE_KEY(token));
  if (!ref?.packId) return c.json({ error: "این لینک اشتراکی معتبر نیست یا لغو شده است" }, 404);
  const packs: NewsPack[] = (await kv.get(PACKS_KEY(ref.owner))) || [];
  const pack = packs.find((p) => p.id === ref.packId);
  if (!pack) return c.json({ error: "بستهٔ اشتراکی دیگر موجود نیست" }, 404);
  const editions: Edition[] = (await kv.get(EDITIONS_KEY(ref.packId))) || [];
  const meta = { id: pack.id, title: pack.title, theme: pack.theme, intro: pack.intro, sections: pack.sections.length };
  return c.json({ pack: meta, edition: editions[0] || null });
});

// clone a shared pack into the requesting user's own list (collaboration = fork)
newspack.post("/shared/:token/clone", async (c) => {
  try {
    const u = packUser(c);
    const token = c.req.param("token");
    const ref: any = await kv.get(SHARE_KEY(token));
    if (!ref?.packId) return c.json({ error: "این لینک اشتراکی معتبر نیست" }, 404);
    const ownerPacks: NewsPack[] = (await kv.get(PACKS_KEY(ref.owner))) || [];
    const src = ownerPacks.find((p) => p.id === ref.packId);
    if (!src) return c.json({ error: "بستهٔ اشتراکی موجود نیست" }, 404);
    const now = Date.now();
    const clone: NewsPack = {
      ...src,
      id: `np_${now.toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      userId: u,
      title: `${src.title} (رونوشت)`,
      shareToken: undefined,
      deliveryEmail: "",
      deliveryWebhookUrl: "",
      lastGeneratedAt: undefined,
      createdAt: now,
      updatedAt: now,
    };
    const mine: NewsPack[] = (await kv.get(PACKS_KEY(u))) || [];
    await kv.set(PACKS_KEY(u), [clone, ...mine]);
    return c.json({ pack: clone });
  } catch (e) {
    console.log("newspack clone error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// ── live collaboration ──────────────────────────────────────────────────────
// Multiple people edit the SAME pack in real time (not a fork). The share token
// doubles as a "room" id. The room holds the live, editable pack config plus a
// presence map. Sync is versioned last-writer-wins: every save bumps `version`,
// clients poll and adopt a newer remote version when they aren't mid-edit. The
// room is the source of truth while active and is mirrored back into the owner's
// pack list so scheduled generation / delivery keep working. Delivery fields are
// intentionally kept out of the room so a collaborator never sees the owner email.
const COLLAB_KEY = (token: string) => `newspack:collab:${token}`;
const PRESENCE_TTL = 25000;
const COLLAB_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

type CollabPresence = { name: string; color: string; lastSeen: number };
type CollabRoom = {
  token: string;
  pack: NewsPack;              // editable config only (no delivery fields)
  version: number;
  lastEditor: string;         // clientId
  lastEditorName: string;
  lastEditedAt: number;
  presence: Record<string, CollabPresence>;
};

function collabColor(clientId: string): string {
  let h = 0;
  for (let i = 0; i < clientId.length; i++) h = (h * 31 + clientId.charCodeAt(i)) >>> 0;
  return COLLAB_COLORS[h % COLLAB_COLORS.length];
}

// strip presence entries that haven't heartbeated recently
function activePresence(room: CollabRoom, now: number): Record<string, CollabPresence> {
  const out: Record<string, CollabPresence> = {};
  for (const [id, p] of Object.entries(room.presence || {})) {
    if (now - p.lastSeen < PRESENCE_TTL) out[id] = p;
  }
  return out;
}

// the editable slice we expose in the room (never delivery credentials)
function collabPackView(pack: NewsPack): NewsPack {
  return { ...pack, deliveryEmail: "", deliveryWebhookUrl: "" };
}

function collabSnapshot(room: CollabRoom, now: number) {
  const presence = activePresence(room, now);
  return {
    pack: collabPackView(room.pack),
    version: room.version,
    lastEditor: room.lastEditor,
    lastEditorName: room.lastEditorName,
    lastEditedAt: room.lastEditedAt,
    collaborators: Object.entries(presence).map(([clientId, p]) => ({ clientId, name: p.name, color: p.color, lastSeen: p.lastSeen })),
  };
}

// load an existing room, or seed one from the owner's current pack
async function loadOrSeedRoom(token: string): Promise<{ room: CollabRoom; ref: any } | null> {
  const ref: any = await kv.get(SHARE_KEY(token));
  if (!ref?.packId) return null;
  let room: CollabRoom | null = (await kv.get(COLLAB_KEY(token))) || null;
  if (!room) {
    const ownerPacks: NewsPack[] = (await kv.get(PACKS_KEY(ref.owner))) || [];
    const src = ownerPacks.find((p) => p.id === ref.packId);
    if (!src) return null;
    room = {
      token,
      pack: collabPackView(src),
      version: 1,
      lastEditor: "",
      lastEditorName: "",
      lastEditedAt: Date.now(),
      presence: {},
    };
    await kv.set(COLLAB_KEY(token), room);
  }
  return { room, ref };
}

// join a room (registers presence + seeds if needed)
newspack.post("/collab/:token/join", async (c) => {
  try {
    const token = c.req.param("token");
    const body = await c.req.json();
    const clientId = String(body?.clientId || "").slice(0, 60);
    const name = String(body?.name || "مهمان").slice(0, 40) || "مهمان";
    if (!clientId) return c.json({ error: "شناسهٔ کاربر لازم است" }, 400);
    const loaded = await loadOrSeedRoom(token);
    if (!loaded) return c.json({ error: "اتاق همکاری معتبر نیست یا لغو شده است" }, 404);
    const { room } = loaded;
    const now = Date.now();
    room.presence = activePresence(room, now);
    room.presence[clientId] = { name, color: collabColor(clientId), lastSeen: now };
    await kv.set(COLLAB_KEY(token), room);
    return c.json(collabSnapshot(room, now));
  } catch (e) {
    console.log("newspack collab join error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// poll a room snapshot; refreshes presence heartbeat for the given clientId
newspack.get("/collab/:token", async (c) => {
  try {
    const token = c.req.param("token");
    const clientId = String(c.req.query("clientId") || "").slice(0, 60);
    const name = String(c.req.query("name") || "").slice(0, 40);
    const room: CollabRoom | null = (await kv.get(COLLAB_KEY(token))) || null;
    if (!room) return c.json({ error: "اتاق همکاری یافت نشد" }, 404);
    const now = Date.now();
    if (clientId) {
      room.presence = activePresence(room, now);
      const existing = room.presence[clientId];
      room.presence[clientId] = { name: name || existing?.name || "مهمان", color: existing?.color || collabColor(clientId), lastSeen: now };
      await kv.set(COLLAB_KEY(token), room);
    }
    return c.json(collabSnapshot(room, now));
  } catch (e) {
    console.log("newspack collab get error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// save an edit to the room (versioned LWW) and mirror it into the owner's pack
newspack.put("/collab/:token", async (c) => {
  try {
    const token = c.req.param("token");
    const body = await c.req.json();
    const clientId = String(body?.clientId || "").slice(0, 60);
    const name = String(body?.name || "مهمان").slice(0, 40) || "مهمان";
    const loaded = await loadOrSeedRoom(token);
    if (!loaded) return c.json({ error: "اتاق همکاری معتبر نیست" }, 404);
    const { room, ref } = loaded;
    const now = Date.now();
    // sanitize the incoming pack against the room's owner, keeping its true id
    const clean = sanitizePack({ ...body?.pack, id: ref.packId }, ref.owner);
    room.pack = collabPackView(clean);
    room.version = (room.version || 1) + 1;
    room.lastEditor = clientId;
    room.lastEditorName = name;
    room.lastEditedAt = now;
    room.presence = activePresence(room, now);
    if (clientId) room.presence[clientId] = { name, color: room.presence[clientId]?.color || collabColor(clientId), lastSeen: now };
    await kv.set(COLLAB_KEY(token), room);
    // mirror editable config back into the owner's real pack (preserve delivery/schedule state)
    const ownerPacks: NewsPack[] = (await kv.get(PACKS_KEY(ref.owner))) || [];
    const idx = ownerPacks.findIndex((p) => p.id === ref.packId);
    if (idx >= 0) {
      ownerPacks[idx] = {
        ...ownerPacks[idx],
        title: clean.title,
        theme: clean.theme,
        intro: clean.intro,
        timespanHours: clean.timespanHours,
        scheduleEveryHours: clean.scheduleEveryHours,
        sections: clean.sections,
        updatedAt: now,
      };
      await kv.set(PACKS_KEY(ref.owner), ownerPacks);
    }
    return c.json(collabSnapshot(room, now));
  } catch (e) {
    console.log("newspack collab save error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// leave a room (drop presence)
newspack.post("/collab/:token/leave", async (c) => {
  try {
    const token = c.req.param("token");
    const body = await c.req.json();
    const clientId = String(body?.clientId || "").slice(0, 60);
    const room: CollabRoom | null = (await kv.get(COLLAB_KEY(token))) || null;
    if (room && clientId) {
      delete room.presence[clientId];
      await kv.set(COLLAB_KEY(token), room);
    }
    return c.json({ ok: true });
  } catch (e) {
    console.log("newspack collab leave error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// ── semantic source search: AI suggests sources matching a natural-language query ──
newspack.post("/suggest-sources", async (c) => {
  try {
    const u = packUser(c);
    const body = await c.req.json();
    const query = String(body?.query || "").trim();
    if (!query) return c.json({ error: "عبارت جستجو خالی است" }, 400);
    const catalog: any[] = Array.isArray(body?.catalog) ? body.catalog.slice(0, 120) : [];
    const sys =
      "تو دستیار انتخاب منابع خبری برای یک بستهٔ خبری فارسی هستی. کاربر یک توصیف موضوعی می‌دهد. " +
      "از میان «کاتالوگ منابع» موجود، مرتبط‌ترین‌ها را انتخاب کن؛ در صورت لزوم می‌توانی چند منبع معتبر و شناخته‌شدهٔ دیگر (با آدرس RSS واقعی) هم پیشنهاد بدهی. " +
      "برای هر پیشنهاد یک دلیل کوتاه فارسی بنویس. " +
      "خروجی فقط یک آرایهٔ JSON معتبر باشد؛ ساختار هر عنصر: " +
      '{"name": string, "url": string, "icon": string, "lang": string, "sourceKind": string, "reason": string}. حداکثر ۱۰ مورد.';
    const user = `توصیف کاربر: «${query}»\n\nکاتالوگ منابع:\n${JSON.stringify(catalog, null, 0)}`;
    const reply = await aiChat([{ role: "system", content: sys }, { role: "user", content: user }], { maxTokens: 1600, temperature: 0.3, userId: u });
    const arr = extractJsonArray(reply);
    const suggestions = (Array.isArray(arr) ? arr : []).slice(0, 10).map((r: any) => ({
      name: String(r?.name || "منبع").slice(0, 120),
      url: String(r?.url || "").slice(0, 500),
      icon: String(r?.icon || "🔗").slice(0, 8),
      lang: String(r?.lang || "fa").slice(0, 8),
      sourceKind: String(r?.sourceKind || "rss").slice(0, 20),
      reason: String(r?.reason || "").slice(0, 300),
    })).filter((r: any) => r.url);
    return c.json({ suggestions });
  } catch (e) {
    console.log("newspack suggest-sources error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

newspack.post("/packs/:id/generate", async (c) => {
  try {
    const u = packUser(c);
    const id = c.req.param("id");
    const packs: NewsPack[] = (await kv.get(PACKS_KEY(u))) || [];
    const pack = packs.find((p) => p.id === id);
    if (!pack) return c.json({ error: "بسته یافت نشد" }, 404);
    const now = Date.now();
    const edition = await generateEdition(pack, now, u);
    await storeEdition(id, edition);
    const updated = packs.map((p) => (p.id === id ? { ...p, lastGeneratedAt: now } : p));
    await kv.set(PACKS_KEY(u), updated);
    const delivery = await deliverEdition(pack, edition);
    await recordStats(pack, edition, "manual", delivery);
    await pushNotif(u, {
      id: `nt_${now.toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      packId: id, packTitle: pack.title, editionId: edition.id, items: edition.stats.items,
      createdAt: now, trigger: "manual", delivery,
    });
    return c.json({ edition, delivery });
  } catch (e) {
    console.log("newspack generate error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

newspack.get("/packs/:id/editions", async (c) => {
  const id = c.req.param("id");
  const editions: Edition[] = (await kv.get(EDITIONS_KEY(id))) || [];
  return c.json({ editions });
});

// persist a manually edited edition (reordered / pinned items)
newspack.put("/packs/:id/editions/:eid", async (c) => {
  try {
    const id = c.req.param("id");
    const eid = c.req.param("eid");
    const body = await c.req.json();
    const editions: Edition[] = (await kv.get(EDITIONS_KEY(id))) || [];
    const idx = editions.findIndex((e) => e.id === eid);
    if (idx < 0) return c.json({ error: "نسخه یافت نشد" }, 404);
    // only accept the mutable presentation fields (sections order/pins), keep the rest server-owned
    const existing = editions[idx];
    const incomingSections: EditionSection[] = Array.isArray(body?.sections) ? body.sections : existing.sections;
    const merged: Edition = { ...existing, sections: incomingSections };
    editions[idx] = merged;
    await kv.set(EDITIONS_KEY(id), editions);
    return c.json({ edition: merged });
  } catch (e) {
    console.log("newspack update edition error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// ── notifications ──
newspack.get("/notifs", async (c) => {
  const u = packUser(c);
  const notifs: Notif[] = (await kv.get(NOTIFS_KEY(u))) || [];
  return c.json({ notifs, unread: notifs.filter((n) => !n.read).length });
});

newspack.post("/notifs/read", async (c) => {
  const u = packUser(c);
  const notifs: Notif[] = (await kv.get(NOTIFS_KEY(u))) || [];
  await kv.set(NOTIFS_KEY(u), notifs.map((n) => ({ ...n, read: true })));
  return c.json({ ok: true });
});

// test the configured delivery channels against the latest edition
newspack.post("/packs/:id/test-delivery", async (c) => {
  try {
    const u = packUser(c);
    const id = c.req.param("id");
    const packs: NewsPack[] = (await kv.get(PACKS_KEY(u))) || [];
    const pack = packs.find((p) => p.id === id);
    if (!pack) return c.json({ error: "بسته یافت نشد" }, 404);
    if (!pack.deliveryWebhookUrl && !pack.deliveryEmail) return c.json({ error: "هیچ کانال تحویلی تنظیم نشده است" }, 400);
    const editions: Edition[] = (await kv.get(EDITIONS_KEY(id))) || [];
    const edition = editions[0];
    if (!edition) return c.json({ error: "ابتدا یک بار بسته را تولید کنید تا نسخه‌ای برای ارسال آزمایشی وجود داشته باشد" }, 400);
    const delivery = await deliverEdition(pack, edition);
    return c.json({ delivery });
  } catch (e) {
    console.log("newspack test-delivery error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// ── scheduled generation (called from the automation tick) ──
export async function runNewspackScheduled(now: number = Date.now()): Promise<{ packs: number; generated: number; errors: number }> {
  let packCount = 0, generated = 0, errors = 0;
  try {
    const lists: NewsPack[][] = (await kv.getByPrefix("newspack:packs:")) || [];
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      for (const pack of list) {
        packCount++;
        const every = pack.scheduleEveryHours || 0;
        if (every <= 0) continue;
        const due = !pack.lastGeneratedAt || now - pack.lastGeneratedAt >= every * 3600 * 1000;
        if (!due) continue;
        try {
          const u = pack.userId || "anon";
          const edition = await generateEdition(pack, now, u);
          await storeEdition(pack.id, edition);
          // persist lastGeneratedAt back into the user's pack list
          const key = PACKS_KEY(u);
          const cur: NewsPack[] = (await kv.get(key)) || [];
          await kv.set(key, cur.map((p) => (p.id === pack.id ? { ...p, lastGeneratedAt: now } : p)));
          const delivery = await deliverEdition(pack, edition);
          await recordStats(pack, edition, "scheduled", delivery);
          await pushNotif(u, {
            id: `nt_${now.toString(36)}${Math.random().toString(36).slice(2, 5)}`,
            packId: pack.id, packTitle: pack.title, editionId: edition.id, items: edition.stats.items,
            createdAt: now, trigger: "scheduled", delivery,
          });
          generated++;
        } catch (e) {
          errors++;
          console.log("newspack scheduled generate error:", pack.id, String(e));
        }
      }
    }
  } catch (e) {
    console.log("runNewspackScheduled error:", String(e));
  }
  return { packs: packCount, generated, errors };
}
