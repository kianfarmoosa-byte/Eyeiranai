import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { XMLParser } from "npm:fast-xml-parser";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";
import { gdelt } from "./gdelt.tsx";
import { social, runSocialScan } from "./social.tsx";
import { newspack, runNewspackScheduled } from "./newspack.tsx";

const app = new Hono();

// Supabase service client (server-side only) for Storage (branded news cards).
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const CARD_BUCKET = "make-a2e7e82a-cards";
let cardBucketReady = false;
async function ensureCardBucket() {
  if (cardBucketReady) return;
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some((b) => b.name === CARD_BUCKET)) {
      await supabase.storage.createBucket(CARD_BUCKET, { public: false });
    }
    cardBucketReady = true;
  } catch (e) {
    console.log("ensureCardBucket error:", String(e));
  }
}

app.use("*", logger(console.log));
app.onError((err, c) => {
  console.log("server onError:", err);
  const path = c.req.path || "";
  if (path.includes("/gdelt/")) {
    return c.json({ articles: [], error: String(err?.message || err) }, 200);
  }
  return c.json({ error: String(err?.message || err) }, 500);
});
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const BASE = "/make-server-a2e7e82a";
const FEEDS_KEY = "feeds:list";
const READ_KEY = "state:read";
const STARRED_KEY = "state:starred";
const TAGS_KEY = "state:tags";
const FEED_STATUS_KEY = "feeds:status";
const RULES_KEY = "state:rules";

type TagRule = {
  id: string;
  name: string;
  tag: string;
  keywords: string[];
  fields?: ("title" | "preview" | "content" | "source")[];
  enabled: boolean;
};

function applyRules(item: any, rules: TagRule[]): string[] {
  const hits = new Set<string>();
  for (const r of rules) {
    if (!r.enabled || !r.keywords?.length) continue;
    const fields = r.fields?.length ? r.fields : ["title", "preview", "content"];
    const haystack = fields.map(f => String(item[f] || "")).join(" ").toLowerCase();
    if (r.keywords.some(k => k && haystack.includes(k.toLowerCase()))) hits.add(r.tag);
  }
  return Array.from(hits);
}

app.get(`${BASE}/health`, (c) => c.json({ status: "ok" }));

app.route(`${BASE}/gdelt`, gdelt);
app.route(`${BASE}/social`, social);
app.route(`${BASE}/newspack`, newspack);

// ───────────────────────────── AI (LLM) ─────────────────────────────
// Proxies AI requests to an OpenAI-compatible endpoint. Keys live only on the
// server and never reach the frontend. Each user may supply their own key
// (stored in KV under ai:config:{u}); otherwise the shared AI_API_KEY is used.
const AI_BASE = "https://apimaster.ai/v1";
const AI_MODEL = "claude-sonnet-4-6";

const aiConfigKey = (u: string) => `ai:config:${u}`;

// Resolve the effective AI credentials for a user (custom → fallback to env).
async function getAiConfig(userId?: string): Promise<{ key: string; base: string; model: string; source: "user" | "default" }> {
  if (userId) {
    try {
      const cfg: any = await kv.get(aiConfigKey(userId));
      if (cfg?.apiKey) {
        return {
          key: cfg.apiKey,
          base: (cfg.baseUrl || AI_BASE).replace(/\/+$/, ""),
          model: cfg.model || AI_MODEL,
          source: "user",
        };
      }
    } catch (e) { console.log("getAiConfig error:", String(e)); }
  }
  return { key: Deno.env.get("AI_API_KEY") || "", base: AI_BASE, model: AI_MODEL, source: "default" };
}

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

async function aiChat(
  messages: ChatMsg[],
  opts: { model?: string; maxTokens?: number; temperature?: number; userId?: string } = {},
): Promise<string> {
  const cfg = await getAiConfig(opts.userId);
  if (!cfg.key) throw new Error("کلید هوش مصنوعی تنظیم نشده است (نه کلید کاربر، نه کلید پیش‌فرض سرور)");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  let res: Response;
  try {
    res = await fetch(`${cfg.base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({
        model: opts.model || cfg.model,
        messages,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.3,
      }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`AI upstream error ${res.status}: ${raw.slice(0, 400)}`);
  }
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`AI upstream returned non-JSON: ${raw.slice(0, 200)}`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error(`AI upstream returned empty content: ${raw.slice(0, 200)}`);
  }
  return content.trim();
}

// Extract a JSON object from a model reply that may be fenced or padded.
function extractJson(text: string): any {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

function clampText(s: string, max = 6000): string {
  return s.length <= max ? s : s.slice(0, max);
}

// ── Per-user AI key (BYO) ──
app.get(`${BASE}/ai/config`, async (c) => {
  const u = studioUser(c);
  const cfg: any = (await kv.get(aiConfigKey(u))) || null;
  return c.json({
    config: {
      hasKey: !!cfg?.apiKey,
      baseUrl: cfg?.baseUrl || AI_BASE,
      model: cfg?.model || AI_MODEL,
      updatedAt: cfg?.updatedAt || 0,
      defaultBase: AI_BASE,
      defaultModel: AI_MODEL,
    },
  });
});

app.post(`${BASE}/ai/config`, async (c) => {
  try {
    const u = studioUser(c);
    const { apiKey, baseUrl, model } = await c.req.json();
    if (!apiKey || !String(apiKey).trim()) return c.json({ error: "کلید API لازم است" }, 400);
    const base = String(baseUrl || AI_BASE).trim().replace(/\/+$/, "");
    const mdl = String(model || AI_MODEL).trim();

    // Verify the key with a minimal request (try /models, then a 1-token chat).
    let ok = false;
    let detail = "";
    try {
      const r = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15000) });
      if (r.ok) ok = true; else detail = `models ${r.status}`;
    } catch (e) { detail = String(e); }
    if (!ok) {
      try {
        const r = await fetch(`${base}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: mdl, messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
          signal: AbortSignal.timeout(20000),
        });
        const raw = await r.text();
        if (r.ok) ok = true; else detail = `${r.status}: ${raw.slice(0, 200)}`;
      } catch (e) { detail = String(e); }
    }
    if (!ok) return c.json({ error: `بررسی کلید ناموفق بود: ${detail}` }, 400);

    await kv.set(aiConfigKey(u), { apiKey: String(apiKey), baseUrl: base, model: mdl, updatedAt: Date.now() });
    return c.json({ ok: true, config: { hasKey: true, baseUrl: base, model: mdl } });
  } catch (e) {
    console.log("ai/config save error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

app.delete(`${BASE}/ai/config`, async (c) => {
  const u = studioUser(c);
  await kv.del(aiConfigKey(u));
  return c.json({ ok: true });
});

app.post(`${BASE}/ai/summarize`, async (c) => {
  try {
    const { title = "", content = "" } = await c.req.json();
    const body = clampText(String(content || ""));
    if (!body && !title) return c.json({ error: "title or content required" }, 400);

    const words = body.split(/\s+/).filter(Boolean).length;
    const readingMinutes = Math.max(1, Math.round(words / 220));

    const sys =
      "تو دستیار خلاصه‌سازی خبر هستی. خروجی را фقط و فقط به صورت یک شیء JSON معتبر بده، بدون هیچ توضیح اضافه. " +
      "ساختار دقیق: {\"tldr\": string, \"bullets\": string[], \"long\": string, \"entities\": string[]}. " +
      "tldr یک جملهٔ کوتاه؛ bullets سه تا پنج نکتهٔ کلیدی؛ long یک پاراگراف؛ entities نام افراد/سازمان‌ها/مکان‌های مهم. " +
      "همهٔ متن‌ها باید به زبان متن ورودی (معمولاً فارسی) باشد.";
    const user = `عنوان: ${title}\n\nمتن:\n${body}`;

    const reply = await aiChat(
      [{ role: "system", content: sys }, { role: "user", content: user }],
      { maxTokens: 900, temperature: 0.3, userId: studioUser(c) },
    );

    let parsed: any;
    try {
      parsed = extractJson(reply);
    } catch (e) {
      console.log("ai/summarize JSON parse failed:", String(e), "reply:", reply.slice(0, 200));
      return c.json({ error: "AI returned malformed JSON", raw: reply.slice(0, 300) }, 502);
    }

    const summary = {
      tldr: String(parsed.tldr || "").trim(),
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets.map((b: any) => String(b).trim()).filter(Boolean).slice(0, 6) : [],
      long: String(parsed.long || "").trim(),
      entities: Array.isArray(parsed.entities) ? parsed.entities.map((e: any) => String(e).trim()).filter(Boolean).slice(0, 8) : [],
      readingMinutes,
    };
    return c.json({ summary });
  } catch (e) {
    console.log("ai/summarize error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

app.post(`${BASE}/ai/ask`, async (c) => {
  try {
    const { title = "", content = "", question = "", history = [] } = await c.req.json();
    if (!String(question).trim()) return c.json({ error: "question required" }, 400);
    const body = clampText(String(content || ""));

    const sys =
      "تو دستیار پرسش‌وپاسخ دربارهٔ یک مقالهٔ خبری هستی. فقط بر اساس متن مقاله پاسخ بده. " +
      "اگر پاسخ در متن نیست، صادقانه بگو که در مقاله نیامده. پاسخ‌ها کوتاه، دقیق و به زبان پرسش (معمولاً فارسی) باشند.";
    const articleCtx = `عنوان مقاله: ${title}\n\nمتن مقاله:\n${body}`;

    const msgs: ChatMsg[] = [
      { role: "system", content: sys },
      { role: "system", content: articleCtx },
    ];
    if (Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        const role = h?.role === "ai" || h?.role === "assistant" ? "assistant" : "user";
        if (h?.text) msgs.push({ role, content: String(h.text) });
      }
    }
    msgs.push({ role: "user", content: String(question) });

    const answer = await aiChat(msgs, { maxTokens: 700, temperature: 0.4, userId: studioUser(c) });
    return c.json({ answer });
  } catch (e) {
    console.log("ai/ask error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// Daily digest — «امروز چه گذشت»: big picture → 3 key points → 1 action.
app.post(`${BASE}/ai/digest`, async (c) => {
  try {
    const { headlines = [], stats = {}, period = 1 } = await c.req.json();
    const items = (Array.isArray(headlines) ? headlines : [])
      .map((h: any) => `- [${String(h.source || "").slice(0, 40)}${h.sentiment ? ` | ${h.sentiment}` : ""}] ${String(h.title || "").slice(0, 200)}`)
      .slice(0, 60)
      .join("\n");
    if (!items.trim()) return c.json({ error: "headlines required" }, 400);

    const statLine = [
      stats.volume != null ? `حجم پوشش: ${stats.volume}` : "",
      stats.sources != null ? `منابع فعال: ${stats.sources}` : "",
      stats.netSentiment != null ? `احساسات خالص: ${stats.netSentiment}` : "",
      stats.topTopics ? `موضوعات داغ: ${stats.topTopics}` : "",
    ].filter(Boolean).join(" • ");

    const sys =
      "تو تحلیلگر ارشد رصد رسانه‌ای هستی. بر پایهٔ فهرست تیترها و آمار دوره، یک خلاصهٔ روزانهٔ مدیریتی بساز. " +
      "فقط یک شیء JSON معتبر بده، بدون توضیح اضافه. ساختار دقیق: " +
      "{\"bigPicture\": string, \"keyPoints\": string[], \"action\": string, \"mood\": \"positive\"|\"negative\"|\"neutral\"}. " +
      "bigPicture یک پاراگراف کوتاه دربارهٔ تصویر کلی؛ keyPoints دقیقاً سه نکتهٔ مهم؛ action یک توصیهٔ عملی برای مدیر؛ " +
      "mood فضای کلی احساسات. همه به فارسی روان و حرفه‌ای.";
    const user = `بازهٔ زمانی: ${period} روز اخیر\nآمار: ${statLine || "—"}\n\nتیترها:\n${clampText(items, 5000)}`;

    const reply = await aiChat(
      [{ role: "system", content: sys }, { role: "user", content: user }],
      { maxTokens: 900, temperature: 0.4, userId: studioUser(c) },
    );

    let parsed: any;
    try { parsed = extractJson(reply); }
    catch (e) {
      console.log("ai/digest JSON parse failed:", String(e), "reply:", reply.slice(0, 200));
      return c.json({ error: "AI returned malformed JSON", raw: reply.slice(0, 300) }, 502);
    }
    const digest = {
      bigPicture: String(parsed.bigPicture || "").trim(),
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.map((b: any) => String(b).trim()).filter(Boolean).slice(0, 5) : [],
      action: String(parsed.action || "").trim(),
      mood: ["positive", "negative", "neutral"].includes(parsed.mood) ? parsed.mood : "neutral",
      generatedAt: Date.now(),
    };
    return c.json({ digest });
  } catch (e) {
    console.log("ai/digest error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

app.post(`${BASE}/ai/translate`, async (c) => {
  try {
    const { text = "", to = "en" } = await c.req.json();
    const src = clampText(String(text || ""), 8000);
    if (!src.trim()) return c.json({ text: "" });
    const target = to === "fa" ? "فارسی" : "انگلیسی";
    const sys =
      `تو یک مترجم حرفه‌ای هستی. متن ورودی را به ${target} ترجمه کن. ` +
      "فقط متن ترجمه‌شده را برگردان، بدون توضیح، بدون نقل‌قول اضافه و با حفظ پاراگراف‌بندی.";
    const translated = await aiChat(
      [{ role: "system", content: sys }, { role: "user", content: src }],
      { maxTokens: 2000, temperature: 0.2, userId: studioUser(c) },
    );
    return c.json({ text: translated });
  } catch (e) {
    console.log("ai/translate error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// Extract a JSON array from a model reply that may be fenced or padded.
function extractJsonArray(text: string): any[] {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  const parsed = JSON.parse(t);
  return Array.isArray(parsed) ? parsed : [];
}

// Batch-translate many short strings (e.g. headlines) in one call, cached per text.
app.post(`${BASE}/ai/translate-batch`, async (c) => {
  try {
    const { texts = [], to = "fa" } = await c.req.json();
    const arr = (Array.isArray(texts) ? texts : []).map((t) => String(t || "")).slice(0, 40);
    if (arr.length === 0) return c.json({ texts: [] });
    const target = to === "en" ? "en" : "fa";
    const cacheKey = (s: string) => `tr:${target}:${s.slice(0, 180)}`;

    const results: string[] = new Array(arr.length).fill("");
    const todo: string[] = [];
    const idxMap: number[] = [];
    for (let i = 0; i < arr.length; i++) {
      if (!arr[i].trim()) { results[i] = arr[i]; continue; }
      const cached = await kv.get(cacheKey(arr[i]));
      if (typeof cached === "string" && cached) results[i] = cached;
      else { todo.push(arr[i]); idxMap.push(i); }
    }

    if (todo.length > 0) {
      const lang = target === "fa" ? "Persian (Farsi)" : "English";
      const sys =
        `You are a professional news translator. Translate each item of the input JSON array to ${lang}. ` +
        `Keep it natural and concise (headline style). Respond ONLY with a JSON array of strings of the SAME length and order. No prose, no code fences.`;
      const reply = await aiChat(
        [{ role: "system", content: sys }, { role: "user", content: JSON.stringify(todo) }],
        { maxTokens: 1800, temperature: 0.2, userId: studioUser(c) },
      );
      let parsedArr: any[] = [];
      try { parsedArr = extractJsonArray(reply); } catch (e) { console.log("translate-batch parse failed:", String(e)); }
      for (let j = 0; j < todo.length; j++) {
        const tr = String(parsedArr[j] ?? "").trim() || todo[j];
        results[idxMap[j]] = tr;
        try { await kv.set(cacheKey(todo[j]), tr); } catch { /* ignore cache errors */ }
      }
    }
    return c.json({ texts: results });
  } catch (e) {
    console.log("ai/translate-batch error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// ───────────────────────── CONTENT STUDIO ─────────────────────────
// Brand profile, content templates, AI draft composer, and draft storage.
// Data is namespaced per client/user id (sent by the frontend).

const PLATFORMS = ["twitter", "instagram", "telegram", "rubika", "bale", "website"] as const;
type Platform = typeof PLATFORMS[number];

const PLATFORM_RULES: Record<Platform, string> = {
  twitter: "حداکثر ۲۸۰ کاراکتر، لحن جمع‌وجور و قلاب‌دار، حداکثر ۳ هشتگ مرتبط، بدون عنوان جدا.",
  instagram: "کپشن جذاب با یک قلاب قوی در خط اول، چند خط توضیح، ۵ تا ۱۰ هشتگ در انتها، استفادهٔ ملایم از ایموجی.",
  telegram: "پیام کانال با تیتر پررنگ (با *)، چند خط خلاصه، در پایان یک خط منبع/لینک. قالب مارک‌داون تلگرام.",
  rubika: "پیام کوتاه و خوانا برای کانال روبیکا، تیتر در خط اول، خلاصهٔ کوتاه، بدون مارک‌داون پیچیده.",
  bale: "پیام کانال بله، تیتر در خط اول، خلاصهٔ کوتاه و رسمی‌تر، در پایان خط منبع.",
  website: "خبر کامل برای سایت: یک تیتر، یک لید کوتاه، و بدنهٔ چندپاراگرافی. خروجی به‌صورت متن ساده با پاراگراف‌بندی.",
};

function studioUser(c: any): string {
  const u = c.req.query("u") || "";
  return String(u || "anon").slice(0, 120);
}

const brandKey = (u: string) => `studio:brand:${u}`;
const templatesKey = (u: string) => `studio:templates:${u}`;
const draftsKey = (u: string) => `studio:drafts:${u}`;
const styleKey = (u: string) => `studio:style:${u}`;
const stylesKey = (u: string) => `studio:styles:${u}`;

// ── Brand profile ──
app.get(`${BASE}/studio/brand`, async (c) => {
  const u = studioUser(c);
  const brand = (await kv.get(brandKey(u))) || null;
  return c.json({ brand });
});

app.post(`${BASE}/studio/brand`, async (c) => {
  try {
    const u = studioUser(c);
    const body = await c.req.json();
    const brand = {
      name: String(body.name || "").slice(0, 120),
      tagline: String(body.tagline || "").slice(0, 200),
      tone: String(body.tone || "حرفه‌ای و بی‌طرف").slice(0, 120),
      audience: String(body.audience || "").slice(0, 200),
      language: body.language === "en" ? "en" : "fa",
      signature: String(body.signature || "").slice(0, 200),
      hashtags: Array.isArray(body.hashtags) ? body.hashtags.map((h: any) => String(h).trim()).filter(Boolean).slice(0, 15) : [],
      emoji: !!body.emoji,
      logo: String(body.logo || "").slice(0, 1000),
      styleGuide: String(body.styleGuide || "").slice(0, 1500),
      updatedAt: Date.now(),
    };
    await kv.set(brandKey(u), brand);
    return c.json({ brand });
  } catch (e) {
    console.log("studio/brand save error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// ── Style analysis (Phase 1: RSS/news sites + public Telegram channels) ──
async function fetchText(url: string, timeoutMs = 15000): Promise<{ ok: boolean; status: number; body: string; contentType: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FlowStudioBot/1.0)", Accept: "*/*" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    const body = await r.text();
    return { ok: r.ok, status: r.status, body, contentType: r.headers.get("content-type") || "" };
  } finally {
    clearTimeout(timer);
  }
}

function htmlToText(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&zwnj;/gi, "‌")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseTelegram(html: string): string[] {
  const out: string[] = [];
  const re = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 40) {
    const txt = htmlToText(m[1]);
    if (txt && txt.length > 5) out.push(txt);
  }
  return out;
}

function decodeXml(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function parseFeed(xml: string): string[] {
  const items: string[] = [];
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/\1>/gi) || [];
  for (const b of blocks) {
    const title = b.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
    const desc =
      b.match(/<(?:content:encoded)[^>]*>([\s\S]*?)<\/content:encoded>/i)?.[1] ||
      b.match(/<(?:description|summary|content)[^>]*>([\s\S]*?)<\/(?:description|summary|content)>/i)?.[1] || "";
    const t = htmlToText(decodeXml(title));
    const d = htmlToText(decodeXml(desc));
    const combined = [t, d].filter(Boolean).join(" — ");
    if (combined.length > 8) items.push(combined);
    if (items.length >= 40) break;
  }
  return items;
}

function findFeedUrl(html: string, baseUrl: string): string | null {
  const links = html.match(/<link[^>]+>/gi) || [];
  for (const l of links) {
    if (/type=["']application\/(?:rss|atom)\+xml["']/i.test(l)) {
      const href = l.match(/href=["']([^"']+)["']/i)?.[1];
      if (href) { try { return new URL(href, baseUrl).toString(); } catch { /* ignore */ } }
    }
  }
  return null;
}

app.post(`${BASE}/studio/analyze-source`, async (c) => {
  try {
    const u = studioUser(c);
    const body = await c.req.json();
    let url = String(body.url || "").trim();
    if (!url) return c.json({ error: "لینک منبع لازم است" }, 400);
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    let samples: string[] = [];
    let type = "";

    const tg = url.match(/(?:t\.me|telegram\.me)\/(?:s\/)?([A-Za-z0-9_]{3,})/i);
    if (tg) {
      type = "telegram";
      const r = await fetchText(`https://t.me/s/${tg[1]}`);
      if (!r.ok) return c.json({ error: `دسترسی به کانال تلگرام ناموفق بود (${r.status})` }, 400);
      samples = parseTelegram(r.body);
      if (samples.length === 0) return c.json({ error: "پستی در نسخهٔ عمومی این کانال یافت نشد (ممکن است خصوصی باشد)." }, 400);
    } else {
      const r = await fetchText(url);
      if (!r.ok) return c.json({ error: `دریافت منبع ناموفق بود (${r.status})` }, 400);
      const head = r.body.slice(0, 3000);
      const looksFeed = /<rss[\s>]|<feed[\s>]|<rdf:RDF/i.test(head) || r.contentType.includes("xml");
      if (looksFeed) {
        type = "rss";
        samples = parseFeed(r.body);
      } else {
        const feedUrl = findFeedUrl(r.body, url);
        if (feedUrl) {
          const fr = await fetchText(feedUrl);
          if (fr.ok) { type = "rss"; samples = parseFeed(fr.body); }
        }
        if (samples.length === 0) {
          type = "web";
          const text = htmlToText(r.body);
          samples = text.split(/\n{2,}/).map((s) => s.trim()).filter((s) => s.length > 60).slice(0, 20);
          if (samples.length === 0 && text.length > 60) samples = [text.slice(0, 4000)];
        }
      }
      if (samples.length === 0) return c.json({ error: "محتوایی برای تحلیل از این منبع استخراج نشد." }, 400);
    }

    samples = samples.slice(0, 30).map((s) => clampText(s, 600));
    const corpus = clampText(samples.map((s, i) => `(${i + 1}) ${s}`).join("\n\n"), 8000);

    const sys =
      "تو یک تحلیل‌گر حرفه‌ای سبک محتوا هستی. مجموعه‌ای از پست‌ها/تیترهای یک منبع به تو داده می‌شود؛ سبک، لحن، ساختار، ادبیات و راهبرد تولید محتوای آن را تحلیل کن. " +
      "خروجی را فقط به‌صورت یک شیء JSON معتبر بده، بدون هیچ توضیح اضافه. همهٔ مقادیر متنی به فارسی باشند. " +
      "ساختار دقیق: {\"summary\":string,\"tone\":string,\"audience\":string,\"language\":\"fa\"|\"en\",\"styleGuide\":string,\"structure\":string,\"hashtags\":string[],\"emojiUsage\":string,\"signature\":string,\"dos\":string[],\"donts\":string[],\"topics\":string[],\"exemplars\":string[]}. " +
      "hashtags بدون علامت #. styleGuide یک پاراگراف کاربردی برای تقلید سبک. exemplars دو تا سه نمونهٔ کوتاهِ نمایندهٔ سبک.";
    const usr = `منبع: ${url}\nنوع: ${type}\nتعداد نمونه: ${samples.length}\n\nنمونه‌ها:\n${corpus}`;

    const reply = await aiChat(
      [{ role: "system", content: sys }, { role: "user", content: usr }],
      { userId: u, maxTokens: 1200, temperature: 0.2 },
    );

    let profile: any;
    try {
      profile = extractJson(reply);
    } catch {
      return c.json({ error: "پاسخ مدل قابل‌خواندن نبود؛ دوباره تلاش کن." }, 502);
    }

    const result = { source: url, type, sampleCount: samples.length, profile, updatedAt: Date.now() };
    await kv.set(styleKey(u), result);
    // Upsert into the analyzed-sources library (dedupe by source, newest first, cap 8).
    const lib: any[] = (await kv.get(stylesKey(u))) || [];
    const next = [result, ...lib.filter((x) => x?.source !== url)].slice(0, 8);
    await kv.set(stylesKey(u), next);
    return c.json(result);
  } catch (e) {
    console.log("studio/analyze-source error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

app.get(`${BASE}/studio/style`, async (c) => {
  const u = studioUser(c);
  const style = (await kv.get(styleKey(u))) || null;
  return c.json({ style });
});

// Library of analyzed sources.
app.get(`${BASE}/studio/styles`, async (c) => {
  const u = studioUser(c);
  const styles = (await kv.get(stylesKey(u))) || [];
  return c.json({ styles });
});

app.delete(`${BASE}/studio/styles`, async (c) => {
  const u = studioUser(c);
  const source = c.req.query("source") || "";
  const lib: any[] = (await kv.get(stylesKey(u))) || [];
  const next = lib.filter((x) => x?.source !== source);
  await kv.set(stylesKey(u), next);
  return c.json({ styles: next });
});

// Blend 2–4 analyzed styles into one cohesive style profile.
app.post(`${BASE}/studio/blend-styles`, async (c) => {
  try {
    const u = studioUser(c);
    const { sources } = await c.req.json();
    if (!Array.isArray(sources) || sources.length < 2) return c.json({ error: "حداقل دو منبع انتخاب کن" }, 400);
    const lib: any[] = (await kv.get(stylesKey(u))) || [];
    const picked = lib.filter((x) => sources.includes(x?.source)).slice(0, 4);
    if (picked.length < 2) return c.json({ error: "منابع انتخاب‌شده یافت نشدند" }, 400);

    const profilesText = picked
      .map((p, i) => `منبع ${i + 1} (${p.source}):\n${JSON.stringify(p.profile)}`)
      .join("\n\n");
    const sys =
      "تو یک تحلیل‌گر حرفه‌ای سبک محتوا هستی. چند «پروفایل سبک» به تو داده می‌شود؛ آن‌ها را در یک سبکِ تلفیقیِ منسجم ترکیب کن که بهترین ویژگی‌های مشترک را بگیرد و تناقض‌ها را متوازن کند. " +
      "خروجی را فقط به‌صورت یک شیء JSON معتبر با همین ساختار بده، بدون توضیح اضافه. همهٔ مقادیر متنی فارسی. " +
      "{\"summary\":string,\"tone\":string,\"audience\":string,\"language\":\"fa\"|\"en\",\"styleGuide\":string,\"structure\":string,\"hashtags\":string[],\"emojiUsage\":string,\"signature\":string,\"dos\":string[],\"donts\":string[],\"topics\":string[],\"exemplars\":string[]}.";
    const usr = `پروفایل‌ها برای ترکیب:\n${clampText(profilesText, 7000)}`;

    const reply = await aiChat(
      [{ role: "system", content: sys }, { role: "user", content: usr }],
      { userId: u, maxTokens: 1200, temperature: 0.3 },
    );
    let profile: any;
    try { profile = extractJson(reply); } catch { return c.json({ error: "پاسخ مدل قابل‌خواندن نبود؛ دوباره تلاش کن." }, 502); }

    const hostOf = (s: string) => { try { return new URL(s).hostname.replace(/^www\./, ""); } catch { return s; } };
    const label = "ترکیب: " + picked.map((p) => hostOf(p.source)).join(" + ");
    const result = {
      source: label, type: "blend",
      sampleCount: picked.reduce((a, p) => a + (Number(p.sampleCount) || 0), 0),
      profile, updatedAt: Date.now(),
    };
    await kv.set(styleKey(u), result);
    const next = [result, ...lib.filter((x) => x?.source !== label)].slice(0, 8);
    await kv.set(stylesKey(u), next);
    return c.json(result);
  } catch (e) {
    console.log("studio/blend-styles error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// ── Templates ──
app.get(`${BASE}/studio/templates`, async (c) => {
  const u = studioUser(c);
  const templates = (await kv.get(templatesKey(u))) || [];
  return c.json({ templates });
});

app.post(`${BASE}/studio/templates`, async (c) => {
  try {
    const u = studioUser(c);
    const body = await c.req.json();
    const list: any[] = (await kv.get(templatesKey(u))) || [];
    const tpl = {
      id: body.id || `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: String(body.name || "قالب بدون نام").slice(0, 120),
      platforms: Array.isArray(body.platforms) ? body.platforms.filter((p: any) => PLATFORMS.includes(p)) : ["telegram"],
      structure: String(body.structure || "").slice(0, 2000),
      maxLength: Number(body.maxLength) || 0,
      includeLink: body.includeLink !== false,
      includeSource: body.includeSource !== false,
      cardTheme: ["dark", "light", "editorial"].includes(body.cardTheme) ? body.cardTheme : "dark",
      cardRatio: ["square", "story", "wide"].includes(body.cardRatio) ? body.cardRatio : "square",
      updatedAt: Date.now(),
    };
    const idx = list.findIndex((t) => t.id === tpl.id);
    if (idx >= 0) list[idx] = tpl; else list.push(tpl);
    await kv.set(templatesKey(u), list);
    return c.json({ templates: list });
  } catch (e) {
    console.log("studio/templates save error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

app.delete(`${BASE}/studio/templates/:id`, async (c) => {
  const u = studioUser(c);
  const id = c.req.param("id");
  const list: any[] = (await kv.get(templatesKey(u))) || [];
  await kv.set(templatesKey(u), list.filter((t) => t.id !== id));
  return c.json({ ok: true });
});

// ── Drafts ──
app.get(`${BASE}/studio/drafts`, async (c) => {
  const u = studioUser(c);
  const drafts = (await kv.get(draftsKey(u))) || [];
  return c.json({ drafts });
});

app.post(`${BASE}/studio/drafts`, async (c) => {
  try {
    const u = studioUser(c);
    const body = await c.req.json();
    const list: any[] = (await kv.get(draftsKey(u))) || [];
    const VALID_STATUS = ["draft", "approved", "scheduled", "published"];
    const draft = {
      id: body.id || `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: u,
      title: String(body.title || "پیش‌نویس").slice(0, 200),
      sourceTitle: String(body.sourceTitle || "").slice(0, 300),
      sourceLink: String(body.sourceLink || "").slice(0, 600),
      image: String(body.image || "").slice(0, 1000),
      images: Array.isArray(body.images) ? body.images.map((s: any) => String(s)).filter(Boolean).slice(0, 10) : [],
      cardTheme: ["dark", "light", "editorial"].includes(body.cardTheme) ? body.cardTheme : "",
      cardRatio: ["square", "story", "wide"].includes(body.cardRatio) ? body.cardRatio : "",
      outputs: body.outputs && typeof body.outputs === "object" ? body.outputs : {},
      status: VALID_STATUS.includes(body.status) ? body.status : "draft",
      scheduledAt: Number(body.scheduledAt) || 0,
      scheduleTargets: Array.isArray(body.scheduleTargets) ? body.scheduleTargets.filter((p: any) => ["telegram", "bale", "rubika", "website", "twitter", "instagram"].includes(p)) : [],
      auto: !!body.auto,
      updatedAt: Date.now(),
      createdAt: body.createdAt || Date.now(),
    };
    const idx = list.findIndex((d) => d.id === draft.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...draft }; else list.unshift(draft);
    await kv.set(draftsKey(u), list.slice(0, 200));
    return c.json({ draft });
  } catch (e) {
    console.log("studio/drafts save error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

app.delete(`${BASE}/studio/drafts/:id`, async (c) => {
  const u = studioUser(c);
  const id = c.req.param("id");
  const list: any[] = (await kv.get(draftsKey(u))) || [];
  await kv.set(draftsKey(u), list.filter((d) => d.id !== id));
  return c.json({ ok: true });
});

// Reusable composer: turns a source item into per-platform branded content.
async function composeOutputs(
  brand: any, template: any, source: any, platformsIn: Platform[], userId?: string,
): Promise<Record<string, { text: string; hashtags: string[] }>> {
  const platforms = platformsIn.length ? platformsIn : ["telegram"];
  const lang = brand.language === "en" ? "English" : "Persian (Farsi)";
  const rulesBlock = platforms.map((p: Platform) => `- ${p}: ${PLATFORM_RULES[p]}`).join("\n");

  const sys =
    `You are a social-media content writer for a news brand. Rewrite the source news into ready-to-post content for each requested platform. ` +
    `Write in ${lang}. Match the brand voice. Never copy the source verbatim — paraphrase and add value. Be factual; do not invent facts not present in the source. ` +
    `Respond ONLY with a valid JSON object of the exact shape: {"outputs": {"<platform>": {"text": string, "hashtags": string[]}}}. No prose, no code fences.`;

  const brandBlock =
    `Brand name: ${brand.name || "—"}\n` +
    `Tagline: ${brand.tagline || "—"}\n` +
    `Tone: ${brand.tone || "professional, neutral"}\n` +
    `Audience: ${brand.audience || "general"}\n` +
    `Fixed signature: ${brand.signature || "—"}\n` +
    `Preferred hashtags: ${(brand.hashtags || []).join(" ") || "—"}\n` +
    `Use emoji: ${brand.emoji ? "yes, sparingly" : "no"}` +
    (brand.styleGuide ? `\nStyle guide to emulate (voice, structure, literary style): ${brand.styleGuide}` : "");

  const tplBlock = template.structure
    ? `Author template/structure to follow (placeholders like {{title}},{{summary}},{{bullets}},{{source}},{{link}} may appear): ${template.structure}\n` +
      `Include link: ${template.includeLink !== false}. Include source name: ${template.includeSource !== false}.` +
      (template.maxLength ? ` Max length hint: ${template.maxLength} chars.` : "")
    : "No custom template; use sensible defaults per platform.";

  const srcBlock =
    `SOURCE TITLE: ${source.title || ""}\n` +
    `SOURCE NAME: ${source.source || ""}\n` +
    `SOURCE LINK: ${source.link || ""}\n` +
    `SOURCE BODY:\n${clampText(String(source.content || ""), 5000)}`;

  const user =
    `PLATFORMS AND RULES:\n${rulesBlock}\n\nBRAND:\n${brandBlock}\n\nTEMPLATE:\n${tplBlock}\n\n${srcBlock}`;

  const reply = await aiChat(
    [{ role: "system", content: sys }, { role: "user", content: user }],
    { maxTokens: 1600, temperature: 0.6, userId },
  );

  const parsed = extractJson(reply);
  const outputs: Record<string, { text: string; hashtags: string[] }> = {};
  const raw = parsed.outputs || parsed;
  for (const p of platforms) {
    const o = raw?.[p] || {};
    outputs[p] = {
      text: String(o.text || "").trim(),
      hashtags: Array.isArray(o.hashtags) ? o.hashtags.map((h: any) => String(h).trim()).filter(Boolean).slice(0, 12) : [],
    };
  }
  return outputs;
}

// Reusable digest composer: combines several items into one per-platform post.
async function composeDigestOutputs(
  brand: any, template: any, sources: any[], platformsIn: Platform[], userId?: string,
): Promise<Record<string, { text: string; hashtags: string[] }>> {
  const platforms = platformsIn.length ? platformsIn : ["telegram"];
  const lang = brand.language === "en" ? "English" : "Persian (Farsi)";
  const rulesBlock = platforms.map((p: Platform) => `- ${p}: ${PLATFORM_RULES[p]}`).join("\n");

  const sys =
    `You are a news-brand editor creating a single digest/roundup post that summarizes several news items together. ` +
    `Write in ${lang}. Match the brand voice. Produce a cohesive digest with a short intro and a concise bulleted list of the items (one line each, paraphrased — never copy verbatim). Be factual. ` +
    `Respond ONLY with a valid JSON object: {"outputs": {"<platform>": {"text": string, "hashtags": string[]}}}. No prose, no code fences.`;

  const brandBlock =
    `Brand name: ${brand.name || "—"}\nTone: ${brand.tone || "professional"}\nAudience: ${brand.audience || "general"}\n` +
    `Signature: ${brand.signature || "—"}\nPreferred hashtags: ${(brand.hashtags || []).join(" ") || "—"}\nUse emoji: ${brand.emoji ? "yes, sparingly" : "no"}` +
    (brand.styleGuide ? `\nStyle guide to emulate: ${brand.styleGuide}` : "");

  const itemsBlock = sources.slice(0, 12).map((s, i) =>
    `[${i + 1}] ${s.title || ""}${s.source ? ` — ${s.source}` : ""}\n${clampText(String(s.content || ""), 900)}`,
  ).join("\n\n");

  const user = `PLATFORMS AND RULES:\n${rulesBlock}\n\nBRAND:\n${brandBlock}\n\nITEMS (${sources.length}):\n${itemsBlock}`;

  const reply = await aiChat(
    [{ role: "system", content: sys }, { role: "user", content: user }],
    { maxTokens: 1800, temperature: 0.6, userId },
  );

  const parsed = extractJson(reply);
  const outputs: Record<string, { text: string; hashtags: string[] }> = {};
  const raw = parsed.outputs || parsed;
  for (const p of platforms) {
    const o = raw?.[p] || {};
    outputs[p] = {
      text: String(o.text || "").trim(),
      hashtags: Array.isArray(o.hashtags) ? o.hashtags.map((h: any) => String(h).trim()).filter(Boolean).slice(0, 12) : [],
    };
  }
  return outputs;
}

app.post(`${BASE}/studio/compose-digest`, async (c) => {
  try {
    const body = await c.req.json();
    const brand = body.brand || {};
    const template = body.template || {};
    const sources = Array.isArray(body.sources) ? body.sources : [];
    const requested: Platform[] = (Array.isArray(body.platforms) ? body.platforms : []).filter((p: any) => PLATFORMS.includes(p));
    const platforms = requested.length ? requested : (template.platforms?.length ? template.platforms : ["telegram"]);
    if (sources.length < 2) return c.json({ error: "حداقل دو خبر برای خلاصه لازم است" }, 400);

    let outputs;
    try {
      outputs = await composeDigestOutputs(brand, template, sources, platforms, studioUser(c));
    } catch (e) {
      console.log("studio/compose-digest failed:", String(e));
      return c.json({ error: "AI digest failed", detail: String(e).slice(0, 300) }, 502);
    }
    return c.json({ outputs });
  } catch (e) {
    console.log("studio/compose-digest error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// ── AI compose: turn a source item into per-platform branded content ──
app.post(`${BASE}/studio/compose`, async (c) => {
  try {
    const body = await c.req.json();
    const brand = body.brand || {};
    const template = body.template || {};
    const source = body.source || {};
    const requested: Platform[] = (Array.isArray(body.platforms) ? body.platforms : [])
      .filter((p: any) => PLATFORMS.includes(p));
    const platforms = requested.length ? requested : (template.platforms?.length ? template.platforms : ["telegram"]);

    if (!source.title && !source.content) {
      return c.json({ error: "source title or content required" }, 400);
    }

    let outputs;
    try {
      outputs = await composeOutputs(brand, template, source, platforms, studioUser(c));
    } catch (e) {
      console.log("studio/compose failed:", String(e));
      return c.json({ error: "AI compose failed", detail: String(e).slice(0, 300) }, 502);
    }
    return c.json({ outputs });
  } catch (e) {
    console.log("studio/compose error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// Rewrite/regenerate a single platform's text into a fresh alternative.
app.post(`${BASE}/studio/rewrite`, async (c) => {
  try {
    const body = await c.req.json();
    const brand = body.brand || {};
    const platform = String(body.platform || "telegram") as Platform;
    const text = clampText(String(body.text || ""), 4000);
    const instruction = String(body.instruction || "").slice(0, 300);
    if (!text.trim()) return c.json({ error: "متن لازم است" }, 400);

    const lang = brand.language === "en" ? "English" : "Persian (Farsi)";
    const rule = PLATFORM_RULES[platform] || "";
    const sys =
      `You are a social-media editor. Rewrite the given post into a fresh, distinct alternative for the "${platform}" platform. ` +
      `Write in ${lang}. Keep the same facts and meaning but vary wording, hook and structure. Respect this platform rule: ${rule}. ` +
      (instruction ? `Extra instruction: ${instruction}. ` : "") +
      `Match brand voice — tone: ${brand.tone || "professional"}; signature: ${brand.signature || "—"}; use emoji: ${brand.emoji ? "yes, sparingly" : "no"}. ` +
      `Respond ONLY with valid JSON: {"text": string, "hashtags": string[]}. No prose, no code fences.`;

    const reply = await aiChat(
      [{ role: "system", content: sys }, { role: "user", content: text }],
      { maxTokens: 800, temperature: 0.85, userId: studioUser(c) },
    );
    let parsed: any;
    try { parsed = extractJson(reply); }
    catch { return c.json({ error: "AI returned malformed JSON", raw: reply.slice(0, 200) }, 502); }

    return c.json({
      text: String(parsed.text || "").trim(),
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map((h: any) => String(h).trim()).filter(Boolean).slice(0, 12) : [],
    });
  } catch (e) {
    console.log("studio/rewrite error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// ───────────── PUBLISHING: Telegram, Bale, Rubika, Website ─────────────
// Credentials live only on the server (KV) and are never returned to the client.

type PublishPlatform = "telegram" | "bale" | "rubika" | "website" | "twitter" | "instagram";

const connKey = (u: string) => `studio:conn:${u}`;
const pubLogKey = (u: string) => `studio:publog:${u}`;

function botApiBase(platform: "telegram" | "bale", token: string): string {
  return platform === "telegram"
    ? `https://api.telegram.org/bot${token}`
    : `https://tapi.bale.ai/bot${token}`;
}

async function httpFetch(url: string, init?: RequestInit, timeoutMs = 20000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const raw = await res.text();
    let data: any = null;
    try { data = JSON.parse(raw); } catch { /* keep raw */ }
    return { ok: res.ok, status: res.status, data, raw };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeSiteUrl(url: string): string {
  return String(url || "").trim().replace(/\/+$/, "");
}

/** Return connections without exposing secrets (token / appPassword). */
function sanitizeConns(conns: any): any {
  const out: any = {};
  for (const p of Object.keys(conns || {})) {
    const cn = conns[p] || {};
    const connected = p === "website" ? !!cn.url : !!cn.token;
    out[p] = {
      connected,
      chatId: cn.chatId || "",
      botName: cn.botName || "",
      url: cn.url || "",
      mode: cn.mode || "",
      verifiedAt: cn.verifiedAt || 0,
    };
  }
  return out;
}

// Verify and build a stored connection config for a platform.
async function verifyAndBuild(platform: PublishPlatform, body: any): Promise<{ ok: boolean; config?: any; label?: string; error?: string }> {
  if (platform === "telegram" || platform === "bale") {
    if (!body.token || !body.chatId) return { ok: false, error: "توکن و شناسهٔ کانال لازم است" };
    const me = await httpFetch(`${botApiBase(platform, body.token)}/getMe`);
    if (!me.ok || !me.data?.ok) return { ok: false, error: `توکن نامعتبر است: ${me.data?.description || me.status}` };
    const botName = me.data.result?.username || me.data.result?.first_name || "bot";
    return { ok: true, label: botName, config: { token: body.token, chatId: String(body.chatId), botName, verifiedAt: Date.now() } };
  }
  if (platform === "rubika") {
    if (!body.token || !body.chatId) return { ok: false, error: "توکن و شناسهٔ کانال لازم است" };
    // Rubika Bot API. getMe may not always be available; tolerate and store.
    let botName = "rubika-bot";
    try {
      const me = await httpFetch(`https://botapi.rubika.ir/v3/${body.token}/getMe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (me.data?.data?.bot?.username) botName = me.data.data.bot.username;
      else if (me.data?.status && me.data.status !== "OK") return { ok: false, error: `توکن روبیکا نامعتبر است: ${me.data.status}` };
    } catch { /* tolerate verify failure; will surface on first publish */ }
    return { ok: true, label: botName, config: { token: body.token, chatId: String(body.chatId), botName, verifiedAt: Date.now() } };
  }
  if (platform === "website") {
    const mode = body.mode === "webhook" ? "webhook" : "wordpress";
    const url = normalizeSiteUrl(body.url);
    if (!url || !/^https?:\/\//i.test(url)) return { ok: false, error: "آدرس سایت معتبر نیست (با http/https شروع شود)" };
    if (mode === "wordpress") {
      if (!body.username || !body.appPassword) return { ok: false, error: "نام کاربری و رمز برنامه (Application Password) لازم است" };
      const auth = "Basic " + btoa(`${body.username}:${body.appPassword}`);
      const me = await httpFetch(`${url}/wp-json/wp/v2/users/me`, { headers: { Authorization: auth } });
      if (!me.ok) return { ok: false, error: `اتصال وردپرس ناموفق بود (${me.status}). آدرس و رمز برنامه را بررسی کن.` };
      return { ok: true, label: me.data?.name || "wordpress", config: { mode, url, username: body.username, appPassword: body.appPassword, botName: me.data?.name || "wordpress", verifiedAt: Date.now() } };
    }
    // webhook: cannot safely probe arbitrary endpoints; accept after URL validation.
    return { ok: true, label: "webhook", config: { mode, url, botName: "webhook", verifiedAt: Date.now() } };
  }
  if (platform === "twitter") {
    if (!body.token) return { ok: false, error: "توکن دسترسی توییتر (OAuth2 با scope نوشتن توییت) لازم است" };
    const me = await httpFetch("https://api.twitter.com/2/users/me", { headers: { Authorization: `Bearer ${body.token}` } });
    if (!me.ok || !me.data?.data?.id) return { ok: false, error: `توکن نامعتبر یا دسترسی ناکافی: ${me.data?.title || me.data?.detail || me.status}` };
    const uname = me.data.data.username || "twitter";
    return { ok: true, label: uname, config: { token: body.token, botName: uname, verifiedAt: Date.now() } };
  }
  if (platform === "instagram") {
    if (!body.token || !body.igUserId) return { ok: false, error: "توکن دسترسی و شناسهٔ اکانت اینستاگرام (IG Business) لازم است" };
    const me = await httpFetch(`https://graph.facebook.com/v19.0/${body.igUserId}?fields=username&access_token=${encodeURIComponent(body.token)}`);
    if (!me.ok || !me.data?.id) return { ok: false, error: `اتصال اینستاگرام ناموفق: ${me.data?.error?.message || me.status}` };
    const uname = me.data.username || "instagram";
    return { ok: true, label: uname, config: { token: body.token, igUserId: String(body.igUserId), botName: uname, verifiedAt: Date.now() } };
  }
  return { ok: false, error: "پلتفرم پشتیبانی نمی‌شود" };
}

// Rubika image send: requestSendFile → upload bytes → sendFile (with caption).
async function sendRubikaPhoto(token: string, chatId: string, imageUrl: string, caption: string): Promise<{ ok: boolean; ref?: any; error?: string }> {
  const base = `https://botapi.rubika.ir/v3/${token}`;
  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
  if (!imgRes.ok) return { ok: false, error: `image fetch ${imgRes.status}` };
  const bytes = new Uint8Array(await imgRes.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > 8_000_000) return { ok: false, error: "image too large/empty" };
  const contentType = imgRes.headers.get("content-type") || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";

  const reqUp = await httpFetch(`${base}/requestSendFile`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "Image" }),
  });
  const uploadUrl = reqUp.data?.data?.upload_url || reqUp.data?.upload_url;
  if (!uploadUrl) return { ok: false, error: `no upload_url (${reqUp.data?.status || reqUp.status})` };

  const form = new FormData();
  form.append("file", new Blob([bytes], { type: contentType }), `image.${ext}`);
  const upRes = await fetch(uploadUrl, { method: "POST", body: form, signal: AbortSignal.timeout(30000) });
  const upRaw = await upRes.text();
  let upData: any = null; try { upData = JSON.parse(upRaw); } catch { /* ignore */ }
  const fileId = upData?.data?.file_id || upData?.file_id;
  if (!fileId) return { ok: false, error: `upload failed (${upRes.status})` };

  const send = await httpFetch(`${base}/sendFile`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, file_id: fileId, text: caption }),
  });
  const okRu = send.data?.status === "OK" || send.data?.status === "success";
  if (!send.ok || !okRu) return { ok: false, error: send.data?.status || `HTTP ${send.status}` };
  return { ok: true, ref: send.data?.data?.message_id };
}

// Unified sender. payload carries a full text, a title (for website), and an
// optional image URL (sent as a photo where the platform supports it).
async function sendToConnection(cn: any, platform: PublishPlatform, payload: { title: string; text: string; link?: string; imageUrl?: string; imageUrls?: string[] }): Promise<{ ok: boolean; ref?: any; error?: string }> {
  if (!cn) return { ok: false, error: "متصل نیست" };
  const img = (payload.imageUrl || "").trim();
  const album = (payload.imageUrls || []).filter(Boolean);
  if (platform === "telegram" || platform === "bale") {
    // Album (carousel) → sendMediaGroup with caption on the first item.
    if (album.length > 1) {
      const media = album.slice(0, 10).map((u, i) => ({
        type: "photo", media: u, ...(i === 0 && payload.text.length <= 1024 ? { caption: payload.text } : {}),
      }));
      const g = await httpFetch(`${botApiBase(platform, cn.token)}/sendMediaGroup`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: cn.chatId, media }),
      });
      if (g.ok && (g.data?.ok || Array.isArray(g.data?.result))) {
        // If caption didn't fit, follow up with the text.
        if (payload.text.length > 1024) {
          await httpFetch(`${botApiBase(platform, cn.token)}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: cn.chatId, text: payload.text }),
          });
        }
        return { ok: true, ref: g.data?.result?.[0]?.message_id };
      }
      // fall through to single photo / text on failure
    }
    // Telegram/Bale photo captions are limited to ~1024 chars; fall back to text.
    if (img && payload.text.length <= 1024) {
      const r = await httpFetch(`${botApiBase(platform, cn.token)}/sendPhoto`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: cn.chatId, photo: img, caption: payload.text }),
      });
      if (r.ok && r.data?.ok) return { ok: true, ref: r.data.result?.message_id };
      // fall through to text if photo failed (e.g. bad image URL)
    }
    const r = await httpFetch(`${botApiBase(platform, cn.token)}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: cn.chatId, text: payload.text }),
    });
    if (!r.ok || !r.data?.ok) return { ok: false, error: r.data?.description || `HTTP ${r.status}` };
    return { ok: true, ref: r.data.result?.message_id };
  }
  if (platform === "rubika") {
    // Album → send each image as a file (caption on the first); else single photo.
    const ruImgs = album.length > 1 ? album.slice(0, 10) : (img ? [img] : []);
    if (ruImgs.length > 0) {
      try {
        let firstRef: any = undefined;
        let anyOk = false;
        for (let i = 0; i < ruImgs.length; i++) {
          const cap = i === 0 ? payload.text : "";
          const photo = await sendRubikaPhoto(cn.token, cn.chatId, ruImgs[i], cap);
          if (photo.ok) { anyOk = true; if (i === 0) firstRef = photo.ref; }
          else console.log("rubika photo failed:", photo.error);
        }
        if (anyOk) return { ok: true, ref: firstRef };
      } catch (e) {
        console.log("rubika photo error, falling back to text:", String(e));
      }
    }
    const r = await httpFetch(`https://botapi.rubika.ir/v3/${cn.token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: cn.chatId, text: payload.text }),
    });
    const okRu = r.data?.status === "OK" || r.data?.status === "success";
    if (!r.ok || !okRu) return { ok: false, error: r.data?.status || r.data?.error || `HTTP ${r.status}` };
    return { ok: true, ref: r.data?.data?.message_id };
  }
  if (platform === "website") {
    // Embed cover + any extra carousel slides into the body.
    const bodyImgs = album.length ? album : (img ? [img] : []);
    const imgHtml = bodyImgs.map((u) => `<figure><img src="${u}" alt="${payload.title || ""}"/></figure>`).join("\n") + (bodyImgs.length ? "\n" : "");
    if (cn.mode === "wordpress") {
      const auth = "Basic " + btoa(`${cn.username}:${cn.appPassword}`);
      // Upload the cover image as a real media item and set it as featured.
      let featured: number | undefined;
      const cover = bodyImgs[0];
      if (cover) {
        try { featured = await wpUploadMedia(cn.url, auth, cover, payload.title || "cover"); }
        catch (e) { console.log("wp media upload failed:", String(e)); }
      }
      const post: any = { title: payload.title || "خبر", content: imgHtml + payload.text.replace(/\n/g, "<br/>"), status: "publish" };
      if (featured) post.featured_media = featured;
      const r = await httpFetch(`${cn.url}/wp-json/wp/v2/posts`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify(post),
      }, 30000);
      if (!r.ok || !r.data?.id) return { ok: false, error: r.data?.message || `HTTP ${r.status}` };
      return { ok: true, ref: r.data.link || r.data.id };
    }
    // webhook
    const r = await httpFetch(cn.url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: payload.title, content: payload.text, image: img, images: bodyImgs, link: payload.link || "", source: "flow" }),
    }, 30000);
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    return { ok: true, ref: "webhook" };
  }
  if (platform === "twitter") {
    // Twitter API v2 — text tweet (image upload needs v1.1/OAuth1.0a, omitted).
    const r = await httpFetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: { Authorization: `Bearer ${cn.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: payload.text.slice(0, 280) }),
    });
    if (!r.ok || !r.data?.data?.id) return { ok: false, error: r.data?.detail || r.data?.title || `HTTP ${r.status}` };
    return { ok: true, ref: r.data.data.id };
  }
  if (platform === "instagram") {
    // Instagram Graph API — requires a public image URL (our signed URLs work).
    const imgs = album.length ? album.slice(0, 10) : (img ? [img] : []);
    if (imgs.length === 0) return { ok: false, error: "اینستاگرام بدون تصویر منتشر نمی‌شود؛ ابتدا کارت یا کاروسل بساز" };
    const base = `https://graph.facebook.com/v19.0/${cn.igUserId}`;
    const tok = encodeURIComponent(cn.token);
    const cap = encodeURIComponent(payload.text);
    let creationId: string | undefined;
    if (imgs.length === 1) {
      const create = await httpFetch(`${base}/media?image_url=${encodeURIComponent(imgs[0])}&caption=${cap}&access_token=${tok}`, { method: "POST" }, 30000);
      if (!create.ok || !create.data?.id) return { ok: false, error: create.data?.error?.message || `HTTP ${create.status}` };
      creationId = create.data.id;
    } else {
      const childIds: string[] = [];
      for (const u of imgs) {
        const ch = await httpFetch(`${base}/media?image_url=${encodeURIComponent(u)}&is_carousel_item=true&access_token=${tok}`, { method: "POST" }, 30000);
        if (ch.ok && ch.data?.id) childIds.push(ch.data.id);
      }
      if (childIds.length < 2) return { ok: false, error: "ساخت آیتم‌های کاروسل اینستاگرام ناموفق بود" };
      const car = await httpFetch(`${base}/media?media_type=CAROUSEL&children=${childIds.join(",")}&caption=${cap}&access_token=${tok}`, { method: "POST" }, 30000);
      if (!car.ok || !car.data?.id) return { ok: false, error: car.data?.error?.message || `HTTP ${car.status}` };
      creationId = car.data.id;
    }
    const pub = await httpFetch(`${base}/media_publish?creation_id=${creationId}&access_token=${tok}`, { method: "POST" }, 30000);
    if (!pub.ok || !pub.data?.id) return { ok: false, error: pub.data?.error?.message || `HTTP ${pub.status}` };
    return { ok: true, ref: pub.data.id };
  }
  return { ok: false, error: "پلتفرم پشتیبانی نمی‌شود" };
}

// Upload an image (by URL) to the WordPress media library; returns media id.
async function wpUploadMedia(siteUrl: string, auth: string, imageUrl: string, title: string): Promise<number | undefined> {
  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
  if (!imgRes.ok) throw new Error(`image fetch ${imgRes.status}`);
  const buf = new Uint8Array(await imgRes.arrayBuffer());
  const ct = imgRes.headers.get("content-type") || "image/png";
  const ext = ct.includes("jpeg") || ct.includes("jpg") ? "jpg" : ct.includes("webp") ? "webp" : "png";
  const res = await fetch(`${siteUrl}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": ct,
      "Content-Disposition": `attachment; filename="flow-${Date.now()}.${ext}"`,
    },
    body: buf,
    signal: AbortSignal.timeout(30000),
  });
  const raw = await res.text();
  let data: any = null; try { data = JSON.parse(raw); } catch { /* ignore */ }
  if (!res.ok || !data?.id) throw new Error(data?.message || `media ${res.status}`);
  return data.id as number;
}

app.get(`${BASE}/studio/connections`, async (c) => {
  const u = studioUser(c);
  const conns = (await kv.get(connKey(u))) || {};
  return c.json({ connections: sanitizeConns(conns) });
});

app.post(`${BASE}/studio/connections`, async (c) => {
  try {
    const u = studioUser(c);
    const body = await c.req.json();
    const platform = body.platform as PublishPlatform;
    const v = await verifyAndBuild(platform, body);
    if (!v.ok) return c.json({ error: v.error }, 400);

    const conns = (await kv.get(connKey(u))) || {};
    conns[platform] = v.config;
    await kv.set(connKey(u), conns);
    return c.json({ connections: sanitizeConns(conns), botName: v.label });
  } catch (e) {
    console.log("studio/connections save error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

app.delete(`${BASE}/studio/connections/:platform`, async (c) => {
  const u = studioUser(c);
  const platform = c.req.param("platform");
  const conns = (await kv.get(connKey(u))) || {};
  delete conns[platform];
  await kv.set(connKey(u), conns);
  return c.json({ connections: sanitizeConns(conns) });
});

// Send a test message/post to confirm the destination is reachable.
app.post(`${BASE}/studio/connections/test`, async (c) => {
  try {
    const u = studioUser(c);
    const { platform } = await c.req.json();
    const conns = (await kv.get(connKey(u))) || {};
    const cn = conns[platform];
    if (!cn) return c.json({ error: "این پلتفرم متصل نیست" }, 400);
    const res = await sendToConnection(cn, platform as PublishPlatform, { title: "تست flow", text: "✅ اتصال flow با موفقیت برقرار شد." });
    if (!res.ok) return c.json({ error: `ارسال آزمایشی ناموفق بود: ${res.error}` }, 400);
    return c.json({ ok: true, ref: res.ref });
  } catch (e) {
    console.log("studio/connections test error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// Publish to one connected platform.
app.post(`${BASE}/studio/publish`, async (c) => {
  try {
    const u = studioUser(c);
    const { platform, text, title, link, imageUrl, imageUrls } = await c.req.json();
    if (!text || !String(text).trim()) return c.json({ error: "متن خالی است" }, 400);

    const conns = (await kv.get(connKey(u))) || {};
    const cn = conns[platform];
    if (!cn) return c.json({ error: "این پلتفرم متصل نیست" }, 400);

    const res = await sendToConnection(cn, platform as PublishPlatform, { title: title || "", text: String(text), link, imageUrl, imageUrls });
    if (!res.ok) {
      console.log(`publish ${platform} failed:`, res.error);
      return c.json({ error: `انتشار ناموفق بود: ${res.error}` }, 400);
    }

    const log: any[] = (await kv.get(pubLogKey(u))) || [];
    log.unshift({ ts: Date.now(), platform, chatId: cn.chatId || cn.url, ref: res.ref, ok: true });
    await kv.set(pubLogKey(u), log.slice(0, 200));

    return c.json({ ok: true, ref: res.ref });
  } catch (e) {
    console.log("studio/publish error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// ───────────────────────── AUTOMATION ─────────────────────────
// Rules that auto-generate (and optionally auto-publish) content on a schedule
// or when matching news appears. An external scheduler hits /automation/tick.

const rulesKey = (u: string) => `studio:rules:${u}`;
const autoLogKey = (u: string) => `studio:autolog:${u}`;

// ── Retry queue for failed publishes ──
// When an automatic or scheduled publish fails, we enqueue it here and retry
// on each tick with exponential-ish backoff. After the last attempt the entry
// is marked "dead" so the user can inspect/clear it manually.
const retryKey = (u: string) => `studio:retry:${u}`;
const RETRY_DELAYS = [5, 15, 30, 60, 180].map((m) => m * 60000); // backoff after each failed attempt
const RETRY_MAX_ATTEMPTS = RETRY_DELAYS.length + 1; // 1 original send + N retries

async function enqueueRetry(
  u: string,
  platform: string,
  payload: { title?: string; text: string; link?: string; imageUrl?: string },
  error: any,
  extra: { draftId?: string; source?: string } = {},
): Promise<void> {
  try {
    const now = Date.now();
    const list: any[] = (await kv.get(retryKey(u))) || [];
    // Avoid piling duplicate live entries for the same draft + platform.
    if (extra.draftId && list.some((e) => e.status !== "dead" && e.platform === platform && e.draftId === extra.draftId)) return;
    list.unshift({
      id: `rt_${now}_${Math.random().toString(36).slice(2, 7)}`,
      userId: u,
      platform,
      payload,
      attempts: 1,
      maxAttempts: RETRY_MAX_ATTEMPTS,
      nextAt: now + RETRY_DELAYS[0],
      lastError: String(error || "publish failed").slice(0, 200),
      status: "pending",
      createdAt: now,
      updatedAt: now,
      draftId: extra.draftId,
      source: extra.source || "auto",
    });
    await kv.set(retryKey(u), list.slice(0, 200));
  } catch (e) {
    console.log("enqueueRetry error:", String(e));
  }
}

// Attempt due (or, when force=true, all live) retries for one user.
async function processUserRetries(u: string, now: number, force = false): Promise<{ retried: number; recovered: number; pending: number }> {
  const set: any[] = (await kv.get(retryKey(u))) || [];
  if (!Array.isArray(set) || set.length === 0) return { retried: 0, recovered: 0, pending: 0 };
  const conns = (await kv.get(connKey(u))) || {};
  let retried = 0, recovered = 0, pending = 0, changed = false;
  const kept: any[] = [];
  for (const e of set) {
    const live = e.status !== "dead";
    const due = force ? live : (live && (e.nextAt || 0) <= now);
    if (!due) { kept.push(e); if (live) pending++; continue; }
    retried++;
    try {
      const res = await sendToConnection((conns as any)[e.platform], e.platform as PublishPlatform, e.payload);
      if (!res.ok) throw new Error(res.error || "publish failed");
      recovered++;
      const plog: any[] = (await kv.get(pubLogKey(u))) || [];
      plog.unshift({ ts: now, platform: e.platform, ok: true, ref: res.ref, retried: true });
      await kv.set(pubLogKey(u), plog.slice(0, 200));
      changed = true;
      // success → dropped from the queue
    } catch (err) {
      e.attempts = (e.attempts || 1) + 1;
      e.lastError = String(err).slice(0, 200);
      e.updatedAt = now;
      if (e.attempts >= (e.maxAttempts || RETRY_MAX_ATTEMPTS)) {
        e.status = "dead";
        e.nextAt = 0;
      } else {
        e.nextAt = now + RETRY_DELAYS[Math.min(e.attempts - 1, RETRY_DELAYS.length - 1)];
        pending++;
      }
      kept.push(e);
      changed = true;
    }
  }
  if (changed) await kv.set(retryKey(u), kept.slice(0, 200));
  return { retried, recovered, pending };
}

// Drain all users' due retries (called from the tick).
async function processRetries(now: number): Promise<{ retried: number; recovered: number }> {
  const sets = (await kv.getByPrefix("studio:retry:")) || [];
  const users = new Set<string>();
  for (const set of sets) if (Array.isArray(set)) { const u = set.find((e: any) => e?.userId)?.userId; if (u) users.add(u); }
  let retried = 0, recovered = 0;
  for (const u of users) {
    const r = await processUserRetries(u, now, false);
    retried += r.retried; recovered += r.recovered;
  }
  return { retried, recovered };
}

async function countAllRetries(): Promise<{ retryPending: number; retryDead: number }> {
  const sets = (await kv.getByPrefix("studio:retry:")) || [];
  let retryPending = 0, retryDead = 0;
  for (const set of sets) if (Array.isArray(set)) for (const e of set) { if (e?.status === "dead") retryDead++; else retryPending++; }
  return { retryPending, retryDead };
}

function normalizeRule(body: any, u: string): any {
  const trigger = body.trigger || {};
  return {
    id: body.id || `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId: u,
    name: String(body.name || "قانون بدون نام").slice(0, 120),
    enabled: body.enabled !== false,
    trigger: {
      type: trigger.type === "event" ? "event" : trigger.type === "daily" ? "daily" : "schedule",
      everyMinutes: Math.max(15, Number(trigger.everyMinutes) || 60),
      keywords: Array.isArray(trigger.keywords) ? trigger.keywords.map((k: any) => String(k).trim()).filter(Boolean).slice(0, 20) : [],
      dailyTime: /^\d{1,2}:\d{2}$/.test(String(trigger.dailyTime || "")) ? String(trigger.dailyTime) : "08:00",
    },
    sourceCategory: String(body.sourceCategory || "").slice(0, 80),
    templateId: String(body.templateId || ""),
    platforms: Array.isArray(body.platforms) ? body.platforms.filter((p: any) => ["telegram", "bale", "rubika", "website", "twitter", "instagram"].includes(p)) : [],
    autoPublish: !!body.autoPublish,
    digest: !!body.digest,
    digestCount: Math.min(12, Math.max(2, Number(body.digestCount) || 5)),
    lastRunAt: Number(body.lastRunAt) || 0,
    lastItemKey: String(body.lastItemKey || ""),
    updatedAt: Date.now(),
  };
}

app.get(`${BASE}/studio/rules`, async (c) => {
  const u = studioUser(c);
  const rules = (await kv.get(rulesKey(u))) || [];
  return c.json({ rules });
});

app.post(`${BASE}/studio/rules`, async (c) => {
  try {
    const u = studioUser(c);
    const body = await c.req.json();
    const list: any[] = (await kv.get(rulesKey(u))) || [];
    const rule = normalizeRule(body, u);
    const idx = list.findIndex((r) => r.id === rule.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...rule }; else list.push(rule);
    await kv.set(rulesKey(u), list);
    return c.json({ rules: list });
  } catch (e) {
    console.log("studio/rules save error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

app.delete(`${BASE}/studio/rules/:id`, async (c) => {
  const u = studioUser(c);
  const id = c.req.param("id");
  const list: any[] = (await kv.get(rulesKey(u))) || [];
  await kv.set(rulesKey(u), list.filter((r) => r.id !== id));
  return c.json({ ok: true });
});

app.get(`${BASE}/studio/autolog`, async (c) => {
  const u = studioUser(c);
  const log = (await kv.get(autoLogKey(u))) || [];
  return c.json({ log });
});

app.get(`${BASE}/studio/publog`, async (c) => {
  const u = studioUser(c);
  const log = (await kv.get(pubLogKey(u))) || [];
  return c.json({ log });
});

// ── Manual performance metrics (real engagement entered by the user) ──
const metricsKey = (u: string) => `studio:metrics:${u}`;

app.get(`${BASE}/studio/metrics`, async (c) => {
  const u = studioUser(c);
  const metrics = (await kv.get(metricsKey(u))) || [];
  return c.json({ metrics });
});

app.post(`${BASE}/studio/metrics`, async (c) => {
  try {
    const u = studioUser(c);
    const body = await c.req.json();
    const list: any[] = (await kv.get(metricsKey(u))) || [];
    const entry = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ts: Number(body.ts) || Date.now(),
      platform: String(body.platform || "").slice(0, 20),
      views: Math.max(0, Number(body.views) || 0),
      likes: Math.max(0, Number(body.likes) || 0),
      shares: Math.max(0, Number(body.shares) || 0),
      note: String(body.note || "").slice(0, 200),
    };
    list.unshift(entry);
    await kv.set(metricsKey(u), list.slice(0, 500));
    return c.json({ metric: entry });
  } catch (e) {
    console.log("studio/metrics save error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

app.delete(`${BASE}/studio/metrics/:id`, async (c) => {
  const u = studioUser(c);
  const id = c.req.param("id");
  const list: any[] = (await kv.get(metricsKey(u))) || [];
  await kv.set(metricsKey(u), list.filter((m) => m.id !== id));
  return c.json({ ok: true });
});

// Upload a client-rendered branded news card (PNG data URL) → signed URL.
app.post(`${BASE}/studio/upload-card`, async (c) => {
  try {
    const u = studioUser(c);
    const { dataUrl } = await c.req.json();
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      return c.json({ error: "dataUrl تصویر معتبر لازم است" }, 400);
    }
    await ensureCardBucket();
    const base64 = dataUrl.split(",")[1] || "";
    const bin = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
    if (bin.byteLength === 0 || bin.byteLength > 6_000_000) return c.json({ error: "اندازهٔ تصویر نامعتبر است" }, 400);

    const path = `${u}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.png`;
    const { error: upErr } = await supabase.storage.from(CARD_BUCKET).upload(path, bin, { contentType: "image/png", upsert: false });
    if (upErr) return c.json({ error: `آپلود ناموفق بود: ${upErr.message}` }, 500);

    const { data: signed, error: signErr } = await supabase.storage.from(CARD_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 30);
    if (signErr || !signed?.signedUrl) return c.json({ error: `ساخت لینک ناموفق بود: ${signErr?.message || "unknown"}` }, 500);

    return c.json({ url: signed.signedUrl, path });
  } catch (e) {
    console.log("studio/upload-card error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

function ruleMatches(rule: any, item: any): boolean {
  if (rule.sourceCategory) {
    const cat = String(item.category || "").toLowerCase();
    if (!cat.includes(rule.sourceCategory.toLowerCase())) return false;
  }
  if (rule.trigger?.type === "event" && rule.trigger.keywords?.length) {
    const hay = `${item.title || ""} ${item.preview || ""} ${item.content || ""}`.toLowerCase();
    if (!rule.trigger.keywords.some((k: string) => hay.includes(k.toLowerCase()))) return false;
  }
  return true;
}

async function runRule(rule: any, articles: any[]): Promise<any> {
  const u = rule.userId;
  const now = Date.now();
  // Schedule gating.
  if (rule.trigger?.type === "schedule") {
    const due = now - (rule.lastRunAt || 0) >= (rule.trigger.everyMinutes || 60) * 60000;
    if (!due) return { skipped: "not-due" };
  } else if (rule.trigger?.type === "daily") {
    // Once per day at/after dailyTime (computed in Tehran time, UTC+3:30).
    const OFFSET = 210 * 60000;
    const pad = (n: number) => String(n).padStart(2, "0");
    const teh = new Date(now + OFFSET);
    const hhmm = `${pad(teh.getUTCHours())}:${pad(teh.getUTCMinutes())}`;
    const dayKey = teh.toISOString().slice(0, 10);
    const lastDayKey = new Date((rule.lastRunAt || 0) + OFFSET).toISOString().slice(0, 10);
    const due = hhmm >= (rule.trigger.dailyTime || "08:00") && lastDayKey !== dayKey;
    if (!due) return { skipped: "not-due" };
  }
  const candidates = articles.filter((a) => ruleMatches(rule, a));
  if (candidates.length === 0) return { skipped: "no-match" };

  const [brand, templates, conns] = await Promise.all([
    kv.get(brandKey(u)),
    kv.get(templatesKey(u)),
    kv.get(connKey(u)),
  ]);
  const template = (templates || []).find((t: any) => t.id === rule.templateId) || {};
  const PUBLISHABLE = ["telegram", "bale", "rubika", "website", "twitter", "instagram"];
  const platforms = (rule.platforms?.length ? rule.platforms : (template.platforms || ["telegram"]))
    .filter((p: any) => PUBLISHABLE.includes(p));

  let outputs: Record<string, { text: string; hashtags: string[] }>;
  let draftTitle: string;
  let sourceTitle: string;
  let sourceLink = "";
  let image = "";
  let marker: string; // dedupe key

  if (rule.digest) {
    const picks = candidates.slice(0, rule.digestCount || 5);
    if (picks.length < 2) return { skipped: "no-match" };
    marker = picks.map((p: any) => p.id).join("|").slice(0, 200);
    if (marker === rule.lastItemKey) return { skipped: "already-done" };
    outputs = await composeDigestOutputs(brand || {}, template, picks.map((p: any) => ({
      title: p.title, content: p.content || p.preview || "", source: p.source, link: p.link,
    })), platforms, u);
    draftTitle = `خلاصهٔ ${picks.length} خبر`;
    sourceTitle = draftTitle;
    image = picks.find((p: any) => p.image)?.image || "";
  } else {
    const pick = candidates[0];
    if (pick.id === rule.lastItemKey) return { skipped: "already-done" };
    marker = pick.id;
    outputs = await composeOutputs(brand || {}, template, {
      title: pick.title, content: pick.content || pick.preview || "", source: pick.source, link: pick.link,
    }, platforms, u);
    draftTitle = String(pick.title || "").slice(0, 80);
    sourceTitle = pick.title || "";
    sourceLink = pick.link || "";
    image = pick.image || "";
  }

  // Save a draft for the record.
  const drafts: any[] = (await kv.get(draftsKey(u))) || [];
  const draft = {
    id: `draft_${now}_${Math.random().toString(36).slice(2, 7)}`,
    title: draftTitle,
    sourceTitle,
    sourceLink,
    image,
    outputs,
    status: "draft",
    updatedAt: now,
    createdAt: now,
    auto: true,
  };
  drafts.unshift(draft);
  await kv.set(draftsKey(u), drafts.slice(0, 200));

  // Auto-publish if requested.
  const results: any[] = [];
  if (rule.autoPublish) {
    for (const p of platforms) {
      const o = outputs[p];
      if (!o?.text) continue;
      const text = o.hashtags?.length ? `${o.text}\n\n${o.hashtags.map((h: string) => `#${h}`).join(" ")}` : o.text;
      const res = await sendToConnection((conns || {})[p], p as PublishPlatform, { title: sourceTitle, text, link: sourceLink, imageUrl: image });
      results.push({ platform: p, ok: res.ok, error: res.error, ref: res.ref });
      if (!res.ok) {
        await enqueueRetry(u, p, { title: sourceTitle, text, link: sourceLink, imageUrl: image }, res.error, { draftId: draft.id, source: "auto" });
      }
    }
  }

  return { draftId: draft.id, itemId: marker, itemTitle: sourceTitle, published: results };
}

// The tick endpoint — call this periodically from an external scheduler.
// If env AUTOMATION_SECRET is set, require ?key= to match; otherwise open
// (still gated by the anon key + CORS like every other route).
app.post(`${BASE}/automation/tick`, async (c) => {
  try {
    const secret = Deno.env.get("AUTOMATION_SECRET");
    if (secret && c.req.query("key") !== secret) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const now = Date.now();
    const PUB = ["telegram", "bale", "rubika", "website", "twitter", "instagram"];

    // 0) Retry previously-failed publishes whose backoff window has elapsed.
    const retryStats = await processRetries(now);

    // 1) Publish scheduled drafts that are due (runs even with no fresh articles).
    let scheduledPublished = 0;
    const allDraftSets = (await kv.getByPrefix("studio:drafts:")) || [];
    for (const set of allDraftSets) {
      if (!Array.isArray(set)) continue;
      for (const d of set) {
        if (d?.status !== "scheduled" || !d.scheduledAt || d.scheduledAt > now) continue;
        const du = d.userId;
        if (!du) continue;
        try {
          const conns = (await kv.get(connKey(du))) || {};
          const targets = (d.scheduleTargets?.length ? d.scheduleTargets : Object.keys(d.outputs || {})).filter((p: any) => PUB.includes(p));
          const results: any[] = [];
          for (const p of targets) {
            const o = (d.outputs || {})[p];
            if (!o?.text) continue;
            const text = o.hashtags?.length ? `${o.text}\n\n${o.hashtags.map((h: string) => `#${h}`).join(" ")}` : o.text;
            const res = await sendToConnection((conns || {})[p], p as PublishPlatform, { title: d.sourceTitle || "", text, link: d.sourceLink, imageUrl: d.image });
            results.push({ platform: p, ok: res.ok, error: res.error, ref: res.ref });
            if (!res.ok) {
              await enqueueRetry(du, p, { title: d.sourceTitle || "", text, link: d.sourceLink, imageUrl: d.image }, res.error, { draftId: d.id, source: "scheduled" });
            }
          }
          const dl: any[] = (await kv.get(draftsKey(du))) || [];
          const di = dl.findIndex((x) => x.id === d.id);
          if (di >= 0) { dl[di] = { ...dl[di], status: "published", updatedAt: now }; await kv.set(draftsKey(du), dl); }
          const plog: any[] = (await kv.get(pubLogKey(du))) || [];
          for (const r of results) plog.unshift({ ts: now, platform: r.platform, ok: r.ok, scheduled: true });
          await kv.set(pubLogKey(du), plog.slice(0, 200));
          scheduledPublished++;
        } catch (e) {
          console.log("scheduled publish failed:", String(e));
        }
      }
    }

    // 2) Rule processing (needs the cached aggregated articles).
    const latest = (await kv.get("articles:latest")) || { items: [] };
    const articles: any[] = Array.isArray(latest.items) ? latest.items : [];

    const allRuleSets = (await kv.getByPrefix("studio:rules:")) || [];
    const rules: any[] = [];
    for (const set of allRuleSets) {
      if (Array.isArray(set)) rules.push(...set);
    }

    let ran = 0;
    const summary: any[] = [];
    if (articles.length > 0) {
      for (const rule of rules) {
        if (!rule?.enabled) continue;
        try {
          const out = await runRule(rule, articles);
          if (out.skipped) { summary.push({ rule: rule.id, skipped: out.skipped }); continue; }
          ran++;
          const list: any[] = (await kv.get(rulesKey(rule.userId))) || [];
          const idx = list.findIndex((r) => r.id === rule.id);
          if (idx >= 0) {
            list[idx] = { ...list[idx], lastRunAt: Date.now(), lastItemKey: out.itemId };
            await kv.set(rulesKey(rule.userId), list);
          }
          const log: any[] = (await kv.get(autoLogKey(rule.userId))) || [];
          log.unshift({ ts: Date.now(), ruleId: rule.id, ruleName: rule.name, itemTitle: out.itemTitle, draftId: out.draftId, published: out.published });
          await kv.set(autoLogKey(rule.userId), log.slice(0, 100));
          summary.push({ rule: rule.id, ok: true, itemTitle: out.itemTitle, published: out.published });
        } catch (e) {
          console.log(`rule ${rule.id} failed:`, String(e));
          summary.push({ rule: rule.id, error: String(e).slice(0, 200) });
        }
      }
    }
    // 3) Social Listening — scan watch topics for emerging trends / bursts.
    let socialScan = { topics: 0, alerts: 0, errors: 0 };
    try {
      socialScan = await runSocialScan(now);
    } catch (e) {
      console.log("social scan (tick) error:", String(e));
    }

    // 3.5) News-package builder — generate scheduled custom packs that are due.
    let newspackRun = { packs: 0, generated: 0, errors: 0 };
    try {
      newspackRun = await runNewspackScheduled(now);
    } catch (e) {
      console.log("newspack scheduled (tick) error:", String(e));
    }

    // Count what's still queued after this run for at-a-glance dashboards.
    const { retryPending, retryDead } = await countAllRetries();

    // Record the run so every device can show a reliable "last run" status.
    await kv.set("automation:lasttick", {
      at: now,
      ran,
      scheduledPublished,
      total: rules.length,
      retried: retryStats.retried,
      recovered: retryStats.recovered,
      retryPending,
      retryDead,
      socialTopics: socialScan.topics,
      socialAlerts: socialScan.alerts,
      source: c.req.query("src") || "manual",
    });

    return c.json({
      ok: true,
      ran,
      scheduledPublished,
      total: rules.length,
      retried: retryStats.retried,
      recovered: retryStats.recovered,
      retryPending,
      retryDead,
      social: socialScan,
      newspack: newspackRun,
      summary,
    });
  } catch (e) {
    console.log("automation/tick error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// Lightweight status for the in-app scheduler / dashboards.
app.get(`${BASE}/automation/status`, async (c) => {
  try {
    const last = (await kv.get("automation:lasttick")) || null;
    return c.json({ last });
  } catch (e) {
    console.log("automation/status error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// ── Retry queue management (failed publishes) ──
app.get(`${BASE}/automation/retries`, async (c) => {
  try {
    const u = studioUser(c);
    const list: any[] = (await kv.get(retryKey(u))) || [];
    // Newest first; strip nothing sensitive (payload is the user's own content).
    return c.json({ retries: list });
  } catch (e) {
    console.log("automation/retries list error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// Force an immediate attempt of this user's queued retries (ignores backoff).
app.post(`${BASE}/automation/retries/run`, async (c) => {
  try {
    const u = studioUser(c);
    const r = await processUserRetries(u, Date.now(), true);
    return c.json({ ok: true, ...r });
  } catch (e) {
    console.log("automation/retries run error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

app.delete(`${BASE}/automation/retries/:id`, async (c) => {
  try {
    const u = studioUser(c);
    const id = c.req.param("id");
    const list: any[] = (await kv.get(retryKey(u))) || [];
    await kv.set(retryKey(u), list.filter((e) => e.id !== id));
    return c.json({ ok: true });
  } catch (e) {
    console.log("automation/retries delete error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// Clear the whole queue (or just dead entries with ?dead=1).
app.delete(`${BASE}/automation/retries`, async (c) => {
  try {
    const u = studioUser(c);
    if (c.req.query("dead") === "1") {
      const list: any[] = (await kv.get(retryKey(u))) || [];
      await kv.set(retryKey(u), list.filter((e) => e.status !== "dead"));
    } else {
      await kv.del(retryKey(u));
    }
    return c.json({ ok: true });
  } catch (e) {
    console.log("automation/retries clear error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function extractImage(item: any): string | undefined {
  if (item?.["media:content"]?.["@_url"]) return item["media:content"]["@_url"];
  if (item?.["media:thumbnail"]?.["@_url"]) return item["media:thumbnail"]["@_url"];
  if (item?.enclosure?.["@_url"]) return item.enclosure["@_url"];
  const html = item?.["content:encoded"] || item?.description || item?.summary || "";
  const text = typeof html === "string" ? html : html?.["#text"] || "";
  const match = text.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
}

function getText(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return v["#text"] || v["@_href"] || "";
  return String(v);
}

async function fetchAndParseFeed(url: string, feedId: string, timeoutMs = 7000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 RSSReader" }, signal: ctrl.signal });
  } finally { clearTimeout(timer); }
  if (!res.ok) throw new Error(`fetch failed ${res.status}`);
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(xml);

  const channel = parsed?.rss?.channel || parsed?.feed;
  if (!channel) throw new Error("invalid feed format");

  const feedTitle = getText(channel.title) || url;
  const rawItems = channel.item || channel.entry || [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items.slice(0, 30).map((it: any, i: number) => {
    const title = getText(it.title);
    const link = typeof it.link === "string" ? it.link : (it.link?.["@_href"] || it.link?.["#text"] || "");
    const pubDate = getText(it.pubDate || it.published || it.updated);
    const description = getText(it.description || it.summary);
    const content = getText(it["content:encoded"] || it.content || it.description || it.summary);
    const id = `${feedId}-${link || i}`;
    return {
      id,
      feedId,
      title: stripHtml(title),
      link,
      source: feedTitle,
      author: getText(it.author || it["dc:creator"]) || feedTitle,
      date: pubDate,
      preview: stripHtml(description).slice(0, 280),
      content: stripHtml(content),
      image: extractImage(it),
    };
  });
}

app.get(`${BASE}/feeds`, async (c) => {
  const list = (await kv.get(FEEDS_KEY)) || [];
  return c.json({ feeds: list });
});

app.post(`${BASE}/feeds`, async (c) => {
  try {
    const { url, name, icon, category } = await c.req.json();
    if (!url) return c.json({ error: "url required" }, 400);
    const list = (await kv.get(FEEDS_KEY)) || [];
    if (list.some((f: any) => f.url === url)) return c.json({ feed: list.find((f: any) => f.url === url) });
    const id = `feed_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const feed = { id, url, name: name || url, icon: icon || "📡", category: category || "" };
    list.push(feed);
    await kv.set(FEEDS_KEY, list);
    return c.json({ feed });
  } catch (e) {
    console.log("add feed error:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.post(`${BASE}/feeds/bulk`, async (c) => {
  try {
    const { feeds: incoming } = await c.req.json();
    if (!Array.isArray(incoming)) return c.json({ error: "feeds array required" }, 400);
    const list = (await kv.get(FEEDS_KEY)) || [];
    const existing = new Set(list.map((f: any) => f.url));
    let added = 0;
    for (const it of incoming) {
      if (!it?.url || existing.has(it.url)) continue;
      const id = `feed_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      list.push({ id, url: it.url, name: it.name || it.url, icon: it.icon || "📡", category: it.category || "" });
      existing.add(it.url);
      added++;
    }
    await kv.set(FEEDS_KEY, list);
    return c.json({ added, total: list.length });
  } catch (e) {
    console.log("bulk add error:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.post(`${BASE}/feeds/clear`, async (c) => {
  await kv.set(FEEDS_KEY, []);
  return c.json({ ok: true });
});

app.delete(`${BASE}/feeds/:id`, async (c) => {
  const id = c.req.param("id");
  const list = (await kv.get(FEEDS_KEY)) || [];
  const next = list.filter((f: any) => f.id !== id);
  await kv.set(FEEDS_KEY, next);
  return c.json({ ok: true });
});

// Cache-first article aggregation. Live RSS fetching is slow and, with hundreds
// of unverified feeds, easily exceeds the platform's connection timeout ("Http:
// connection closed before message completed"). So every request:
//   1) serves the persisted article cache immediately (rich, instant), and
//   2) refreshes only a SMALL, bounded batch of the stalest feeds live,
//      merging the fresh items back into the cache for next time.
// Over a handful of requests the whole directory gets refreshed, but no single
// request does enough work to drop the connection.
const ARTICLES_CACHE_KEY = "articles:latest";
const MAX_LIVE_PER_REQUEST = 16;   // feeds fetched live per /articles call
const LIVE_DEADLINE_MS = 12000;    // hard wall-clock budget for live fetching
const CACHE_CAP = 2000;            // max cached articles kept

app.get(`${BASE}/articles`, async (c) => {
  const list = (await kv.get(FEEDS_KEY)) || [];
  const readIds = new Set((await kv.get(READ_KEY)) || []);
  const starredIds = new Set((await kv.get(STARRED_KEY)) || []);
  const limitParam = Number(c.req.query("limit") || "60");
  const offsetParam = Number(c.req.query("offset") || "0");
  const feedIdParam = c.req.query("feedId");
  const categoryParam = c.req.query("category");

  const tags: Record<string, string[]> = (await kv.get(TAGS_KEY)) || {};
  const rules: TagRule[] = (await kv.get(RULES_KEY)) || [];
  const status: Record<string, { ok: boolean; error?: string; lastOk?: number; lastFail?: number }> =
    (await kv.get(FEED_STATUS_KEY)) || {};
  const cacheObj = (await kv.get(ARTICLES_CACHE_KEY)) || { items: [] };
  const cached: any[] = Array.isArray(cacheObj.items) ? cacheObj.items : [];
  const cacheMap = new Map<string, any>(cached.map((it: any) => [it.id, it]));

  // Which feeds are candidates for this request?
  let pool = list;
  if (feedIdParam) pool = list.filter((f: any) => f.id === feedIdParam);
  else if (categoryParam) {
    const q = categoryParam.toLowerCase();
    pool = list.filter((f: any) => (f.category || "").toLowerCase().includes(q));
  }

  const now = Date.now();
  const COOLDOWN = 10 * 60 * 1000;
  const isTripped = (fid: string) => {
    const s = status[fid];
    return !!(s && s.ok === false && s.lastFail && now - s.lastFail < COOLDOWN);
  };
  // Refresh the stalest, non-tripped feeds first (untested feeds have lastOk 0).
  const refreshTargets = [...pool]
    .filter((f: any) => !isTripped(f.id))
    .sort((a: any, b: any) => (status[a.id]?.lastOk || 0) - (status[b.id]?.lastOk || 0))
    .slice(0, feedIdParam ? pool.length : MAX_LIVE_PER_REQUEST);

  const deadline = now + LIVE_DEADLINE_MS;
  const CONCURRENCY = 12;
  let idx = 0;
  let refreshed = 0;
  async function worker() {
    while (idx < refreshTargets.length) {
      const feed = refreshTargets[idx++];
      if (Date.now() > deadline) break;
      try {
        const items = await fetchAndParseFeed(feed.url, feed.id, 7000);
        status[feed.id] = { ok: true, lastOk: Date.now() };
        refreshed++;
        for (const it of items.slice(0, 15)) {
          const enriched = {
            ...it,
            source: feed.name || it.source,
            sourceIcon: feed.icon || "📡",
            category: feed.category || "",
          };
          const autoTags = applyRules(enriched, rules);
          const userTags = tags[it.id] || [];
          cacheMap.set(it.id, {
            ...enriched,
            tags: Array.from(new Set([...userTags, ...autoTags])),
            autoTags,
            readTime: `${Math.max(1, Math.ceil(it.content.length / 800))} دقیقه`,
          });
        }
      } catch (e) {
        const msg = String(e).slice(0, 200);
        console.log(`feed ${feed.url} failed:`, msg);
        const prev = status[feed.id] || {};
        status[feed.id] = { ok: false, error: msg, lastOk: prev.lastOk, lastFail: Date.now() };
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await kv.set(FEED_STATUS_KEY, status);

  // Persist the merged, capped cache (newest first).
  let merged = [...cacheMap.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (merged.length > CACHE_CAP) merged = merged.slice(0, CACHE_CAP);
  try { await kv.set(ARTICLES_CACHE_KEY, { ts: Date.now(), items: merged }); } catch {}

  // Build the response set from the cache filtered to this request's scope.
  const feedIds = new Set(pool.map((f: any) => f.id));
  let scoped = merged;
  if (feedIdParam) scoped = merged.filter((it: any) => it.feedId === feedIdParam);
  else if (categoryParam) scoped = merged.filter((it: any) => feedIds.has(it.feedId));

  const total = scoped.length;
  const page = scoped.slice(offsetParam, offsetParam + limitParam).map((it: any) => ({
    ...it,
    read: readIds.has(it.id),
    starred: starredIds.has(it.id),
  }));

  return c.json({ articles: page, feedsCount: list.length, fetched: refreshed, total, status });
});

app.get(`${BASE}/feeds/status`, async (c) => {
  const status = (await kv.get(FEED_STATUS_KEY)) || {};
  return c.json({ status });
});

app.get(`${BASE}/tags`, async (c) => {
  const tags = (await kv.get(TAGS_KEY)) || {};
  return c.json({ tags });
});

app.post(`${BASE}/tags`, async (c) => {
  const { id, tags: newTags } = await c.req.json();
  if (!id || !Array.isArray(newTags)) return c.json({ error: "id and tags required" }, 400);
  const tags: Record<string, string[]> = (await kv.get(TAGS_KEY)) || {};
  if (newTags.length === 0) delete tags[id];
  else tags[id] = Array.from(new Set(newTags.map((t: string) => String(t).trim()).filter(Boolean)));
  await kv.set(TAGS_KEY, tags);
  return c.json({ ok: true, tags: tags[id] || [] });
});

app.get(`${BASE}/opml`, async (c) => {
  const list = (await kv.get(FEEDS_KEY)) || [];
  const byCat = new Map<string, any[]>();
  for (const f of list) {
    const k = f.category || "سایر";
    if (!byCat.has(k)) byCat.set(k, []);
    byCat.get(k)!.push(f);
  }
  const esc = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  let body = `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head><title>RSS Subscriptions</title></head>\n  <body>\n`;
  for (const [cat, feeds] of byCat) {
    body += `    <outline text="${esc(cat)}" title="${esc(cat)}">\n`;
    for (const f of feeds) {
      body += `      <outline type="rss" text="${esc(f.name)}" title="${esc(f.name)}" xmlUrl="${esc(f.url)}" />\n`;
    }
    body += `    </outline>\n`;
  }
  body += `  </body>\n</opml>`;
  return new Response(body, { headers: { "Content-Type": "text/xml; charset=utf-8" } });
});

app.post(`${BASE}/opml`, async (c) => {
  try {
    const { xml } = await c.req.json();
    if (!xml) return c.json({ error: "xml required" }, 400);
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const parsed = parser.parse(xml);
    const body = parsed?.opml?.body;
    if (!body) return c.json({ error: "invalid OPML" }, 400);

    const collected: any[] = [];
    function walk(node: any, parentCat = "") {
      if (!node) return;
      const outlines = Array.isArray(node.outline) ? node.outline : (node.outline ? [node.outline] : []);
      for (const o of outlines) {
        const url = o["@_xmlUrl"];
        const name = o["@_title"] || o["@_text"] || url;
        const cat = parentCat || o["@_text"] || "سایر";
        if (url) {
          collected.push({ url, name, category: parentCat || "سایر" });
        } else {
          walk(o, cat);
        }
      }
    }
    walk(body);

    const existing = (await kv.get(FEEDS_KEY)) || [];
    const existingUrls = new Set(existing.map((f: any) => f.url));
    let added = 0;
    for (const it of collected) {
      if (existingUrls.has(it.url)) continue;
      const id = `feed_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      existing.push({ id, url: it.url, name: it.name, icon: "📡", category: it.category });
      existingUrls.add(it.url);
      added++;
    }
    await kv.set(FEEDS_KEY, existing);
    return c.json({ added, total: existing.length });
  } catch (e) {
    console.log("opml import error:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.post(`${BASE}/state/read`, async (c) => {
  const { id } = await c.req.json();
  const list: string[] = (await kv.get(READ_KEY)) || [];
  if (!list.includes(id)) list.push(id);
  await kv.set(READ_KEY, list);
  return c.json({ ok: true });
});

app.post(`${BASE}/state/star`, async (c) => {
  const { id, starred } = await c.req.json();
  const list: string[] = (await kv.get(STARRED_KEY)) || [];
  const set = new Set(list);
  if (starred) set.add(id); else set.delete(id);
  await kv.set(STARRED_KEY, Array.from(set));
  return c.json({ ok: true });
});

app.get(`${BASE}/rules`, async (c) => {
  const rules = (await kv.get(RULES_KEY)) || [];
  return c.json({ rules });
});

app.post(`${BASE}/rules`, async (c) => {
  try {
    const body = await c.req.json();
    const rules: TagRule[] = (await kv.get(RULES_KEY)) || [];
    if (body.id) {
      const idx = rules.findIndex(r => r.id === body.id);
      if (idx >= 0) rules[idx] = { ...rules[idx], ...body };
      else rules.push(body);
    } else {
      const id = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      rules.push({ id, enabled: true, keywords: [], fields: ["title", "preview", "content"], ...body });
    }
    await kv.set(RULES_KEY, rules);
    return c.json({ rules });
  } catch (e) {
    console.log("rules save error:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.delete(`${BASE}/rules/:id`, async (c) => {
  const id = c.req.param("id");
  const rules: TagRule[] = (await kv.get(RULES_KEY)) || [];
  await kv.set(RULES_KEY, rules.filter(r => r.id !== id));
  return c.json({ ok: true });
});

app.get(`${BASE}/search`, async (c) => {
  const q = (c.req.query("q") || "").trim().toLowerCase();
  if (!q) return c.json({ results: [] });
  const list = (await kv.get(FEEDS_KEY)) || [];
  const readIds = new Set((await kv.get(READ_KEY)) || []);
  const starredIds = new Set((await kv.get(STARRED_KEY)) || []);
  const tags: Record<string, string[]> = (await kv.get(TAGS_KEY)) || {};
  const rules: TagRule[] = (await kv.get(RULES_KEY)) || [];

  const SEARCH_DEADLINE = Date.now() + 22000;
  const CONCURRENCY = 12;
  const results: any[] = [];
  let idx = 0;
  async function worker() {
    while (idx < list.length && results.length < 200) {
      if (Date.now() > SEARCH_DEADLINE) break;
      const feed = list[idx++];
      try {
        const items = await fetchAndParseFeed(feed.url, feed.id, 6000);
        for (const it of items) {
          const hay = `${it.title} ${it.preview} ${it.content}`.toLowerCase();
          if (!hay.includes(q)) continue;
          const enriched = { ...it, source: feed.name || it.source, sourceIcon: feed.icon || "📡", category: feed.category || "" };
          const autoTags = applyRules(enriched, rules);
          results.push({
            ...enriched,
            read: readIds.has(it.id),
            starred: starredIds.has(it.id),
            tags: Array.from(new Set([...(tags[it.id] || []), ...autoTags])),
            readTime: `${Math.max(1, Math.ceil(it.content.length / 800))} دقیقه`,
          });
          if (results.length >= 200) break;
        }
      } catch (e) {
        console.log(`search fetch ${feed.url} failed:`, String(e).slice(0, 100));
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return c.json({ results, total: results.length });
});


Deno.serve(app.fetch);
