// Page Change Monitoring (رصد تغییرات صفحه) — a lightweight, self-hosted
// re-implementation of the changedetection.io idea, built entirely on the
// existing Deno Edge Function + KV infrastructure (no external service).
//
// For each watched URL we periodically fetch the page, extract a stable text
// snapshot (optionally scoped to a CSS selector), hash it, and compare against
// the last snapshot. When it differs we record a change event with a small diff
// preview and an optional plain-language AI summary.
//
// Storage (KV):
//   watch:list              → Watch[]
//   watch:state:{id}        → WatchState   (last snapshot + change history)
import { Hono } from "npm:hono";
import { parse as parseHtml } from "npm:node-html-parser";
import * as kv from "./kv_store.tsx";

export const watch = new Hono();

const LIST_KEY = "watch:list";
const STATE_KEY = (id: string) => `watch:state:${id}`;
const MAX_CHANGES = 20;        // keep the most recent N change events per watch
const DEFAULT_INTERVAL_MIN = 60;

type Watch = {
  id: string;
  url: string;
  label: string;
  selector?: string;          // optional CSS selector to scope the comparison
  active: boolean;
  intervalMin: number;        // minimum minutes between automatic checks
  createdAt: number;
  updatedAt: number;
};

type ChangeEvent = {
  ts: number;
  oldHash: string;
  newHash: string;
  diff: string;               // short human-readable preview of what changed
  summary?: string;           // optional AI plain-language summary
};

type WatchState = {
  hash: string;
  snapshot: string;           // last extracted text (trimmed)
  checkedAt: number;
  lastChangedAt: number;
  changes: ChangeEvent[];
  error?: string;
};

// ── AI config (self-contained to avoid a circular import with index.tsx) ──
const AI_BASE = "https://api.ainative.studio/api/v1";
const AI_MODEL = "deepseek-v4-flash";

async function getAiConfig(userId?: string): Promise<{ key: string; base: string; model: string }> {
  if (userId) {
    try {
      const cfg: any = await kv.get(`ai:config:${userId}`);
      if (cfg?.apiKey) {
        return { key: cfg.apiKey, base: (cfg.baseUrl || AI_BASE).replace(/\/+$/, ""), model: cfg.model || AI_MODEL };
      }
    } catch (e) { console.log("watch getAiConfig error:", String(e)); }
  }
  return { key: Deno.env.get("AINATIVE_API_KEY") || "", base: AI_BASE, model: AI_MODEL };
}

async function aiSummarizeChange(before: string, after: string, userId?: string): Promise<string | undefined> {
  const cfg = await getAiConfig(userId);
  if (!cfg.key) return undefined;
  const sys = "شما یک دستیار پایش تغییرات صفحات وب هستید. تفاوت میان نسخهٔ قبلی و جدید یک صفحه به شما داده می‌شود. در حداکثر دو جملهٔ کوتاه فارسی توضیح دهید که چه چیزی تغییر کرده است. اگر تغییر جزئی/بی‌اهمیت است همان را بگویید.";
  const user = `نسخهٔ قبلی:\n${before.slice(0, 1500)}\n\n---\n\nنسخهٔ جدید:\n${after.slice(0, 1500)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(`${cfg.base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        max_tokens: 200,
        temperature: 0.3,
      }),
      signal: ctrl.signal,
    });
    const raw = await res.text();
    if (!res.ok) { console.log("watch AI summary error:", res.status, raw.slice(0, 200)); return undefined; }
    const data = JSON.parse(raw);
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim() ? content.trim() : undefined;
  } catch (e) {
    console.log("watch AI summary exception:", String(e));
    return undefined;
  } finally { clearTimeout(timer); }
}

// ── helpers ──

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(36);
}

/** Fetch a page and extract a stable, normalized text snapshot. When a CSS
 * selector is supplied, only matching elements are compared (like the
 * changedetection.io "visual selector"); otherwise the main body text is used. */
async function fetchSnapshot(url: string, selector?: string): Promise<string> {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; FLWWatch/1.0)",
      "Accept": "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
  });
  if (!r.ok) throw new Error(`fetch ${r.status}`);
  const html = await r.text();
  const root = parseHtml(html, { comment: false, blockTextElements: { script: false, style: false, noscript: false, pre: true } });
  root.querySelectorAll("script,style,noscript,svg,iframe").forEach(n => n.remove());

  let text = "";
  if (selector && selector.trim()) {
    try {
      const nodes = root.querySelectorAll(selector.trim());
      text = nodes.map(n => (n.text || "").trim()).filter(Boolean).join("\n");
    } catch {
      // Invalid selector — fall back to whole-body text.
      text = "";
    }
  }
  if (!text) {
    const body = root.querySelector("main, article, body") || root;
    text = (body.text || "");
  }
  return text.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
}

/** Build a short human-readable diff preview: the first added/removed lines. */
function makeDiff(before: string, after: string): string {
  const b = new Set(before.split("\n").map(l => l.trim()).filter(Boolean));
  const a = after.split("\n").map(l => l.trim()).filter(Boolean);
  const added = a.filter(l => !b.has(l)).slice(0, 5);
  const aSet = new Set(a);
  const removed = before.split("\n").map(l => l.trim()).filter(Boolean).filter(l => !aSet.has(l)).slice(0, 5);
  const parts: string[] = [];
  for (const l of added) parts.push("+ " + l.slice(0, 160));
  for (const l of removed) parts.push("- " + l.slice(0, 160));
  return parts.join("\n") || "تغییر جزئی در محتوا";
}

async function getList(): Promise<Watch[]> {
  try { return (await kv.get(LIST_KEY)) || []; } catch { return []; }
}
async function saveList(list: Watch[]): Promise<void> {
  await kv.set(LIST_KEY, list);
}

/** Check one watch now: fetch, compare, and record a change event if different.
 * Returns the (possibly updated) state. */
async function checkWatch(w: Watch, userId?: string, withSummary = false): Promise<WatchState> {
  const prev: WatchState = (await kv.get(STATE_KEY(w.id))) || {
    hash: "", snapshot: "", checkedAt: 0, lastChangedAt: 0, changes: [],
  };
  const now = Date.now();
  try {
    const snapshot = await fetchSnapshot(w.url, w.selector);
    const hash = simpleHash(snapshot);
    if (prev.hash && prev.hash !== hash) {
      const diff = makeDiff(prev.snapshot, snapshot);
      let summary: string | undefined;
      if (withSummary) {
        try { summary = await aiSummarizeChange(prev.snapshot, snapshot, userId); } catch { /* ignore */ }
      }
      const event: ChangeEvent = { ts: now, oldHash: prev.hash, newHash: hash, diff, summary };
      const next: WatchState = {
        hash, snapshot, checkedAt: now, lastChangedAt: now,
        changes: [event, ...prev.changes].slice(0, MAX_CHANGES),
      };
      await kv.set(STATE_KEY(w.id), next);
      return next;
    }
    // No change (or first snapshot).
    const next: WatchState = {
      hash, snapshot, checkedAt: now,
      lastChangedAt: prev.lastChangedAt || (prev.hash ? prev.lastChangedAt : 0),
      changes: prev.changes,
    };
    await kv.set(STATE_KEY(w.id), next);
    return next;
  } catch (e) {
    const next: WatchState = { ...prev, checkedAt: now, changes: prev.changes, error: String(e) };
    await kv.set(STATE_KEY(w.id), next);
    return next;
  }
}

// ── routes ──

// List all watches, each merged with its latest state.
watch.get("/", async (c) => {
  try {
    const list = await getList();
    const states = await Promise.all(list.map(w => kv.get(STATE_KEY(w.id)).catch(() => null)));
    const items = list.map((w, i) => ({ ...w, state: states[i] || null }));
    return c.json({ items });
  } catch (e) {
    console.log("watch list error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// Add a new watch. Body: { url, label?, selector?, intervalMin? }
watch.post("/", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const url = String(body.url || "").trim();
    if (!/^https?:\/\//i.test(url)) return c.json({ error: "آدرس معتبر (http/https) لازم است" }, 400);
    const list = await getList();
    if (list.some(w => w.url === url && (w.selector || "") === (body.selector || ""))) {
      return c.json({ error: "این آدرس با همین محدوده قبلاً افزوده شده است" }, 409);
    }
    const now = Date.now();
    const w: Watch = {
      id: `w_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      url,
      label: String(body.label || "").trim() || url.replace(/^https?:\/\//, "").slice(0, 60),
      selector: String(body.selector || "").trim() || undefined,
      active: true,
      intervalMin: Number(body.intervalMin) > 0 ? Number(body.intervalMin) : DEFAULT_INTERVAL_MIN,
      createdAt: now,
      updatedAt: now,
    };
    list.unshift(w);
    await saveList(list);
    // Establish an initial baseline snapshot immediately.
    const state = await checkWatch(w).catch(() => null);
    return c.json({ watch: w, state });
  } catch (e) {
    console.log("watch add error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// Update a watch (label/selector/active/intervalMin).
watch.patch("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const list = await getList();
    const w = list.find(x => x.id === id);
    if (!w) return c.json({ error: "یافت نشد" }, 404);
    if (typeof body.label === "string") w.label = body.label.trim() || w.label;
    if (typeof body.selector === "string") w.selector = body.selector.trim() || undefined;
    if (typeof body.active === "boolean") w.active = body.active;
    if (Number(body.intervalMin) > 0) w.intervalMin = Number(body.intervalMin);
    w.updatedAt = Date.now();
    await saveList(list);
    return c.json({ watch: w });
  } catch (e) {
    console.log("watch patch error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// Delete a watch and its state.
watch.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const list = await getList();
    const next = list.filter(w => w.id !== id);
    await saveList(next);
    try { await kv.del(STATE_KEY(id)); } catch { /* ignore */ }
    return c.json({ ok: true });
  } catch (e) {
    console.log("watch delete error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// Check one watch on demand (with AI summary when a change is found).
watch.post("/:id/check", async (c) => {
  try {
    const id = c.req.param("id");
    const userId = c.req.query("userId") || undefined;
    const list = await getList();
    const w = list.find(x => x.id === id);
    if (!w) return c.json({ error: "یافت نشد" }, 404);
    const state = await checkWatch(w, userId, true);
    return c.json({ watch: w, state });
  } catch (e) {
    console.log("watch check error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

// Clear the change history of a watch (keeps the current baseline).
watch.post("/:id/clear", async (c) => {
  try {
    const id = c.req.param("id");
    const prev: WatchState | null = await kv.get(STATE_KEY(id));
    if (prev) { prev.changes = []; await kv.set(STATE_KEY(id), prev); }
    return c.json({ ok: true });
  } catch (e) {
    console.log("watch clear error:", String(e));
    return c.json({ error: String(e) }, 500);
  }
});

/** Scheduled scan: check every active watch whose interval has elapsed.
 * Called from the automation tick in index.tsx. */
export async function runWatchScan(now: number = Date.now()): Promise<{ checked: number; changed: number; errors: number }> {
  let checked = 0, changed = 0, errors = 0;
  const list = await getList();
  for (const w of list) {
    if (!w.active) continue;
    let prev: WatchState | null = null;
    try { prev = await kv.get(STATE_KEY(w.id)); } catch { /* ignore */ }
    const dueAfter = (prev?.checkedAt || 0) + w.intervalMin * 60 * 1000;
    if (prev && now < dueAfter) continue;
    try {
      const before = prev?.hash || "";
      const state = await checkWatch(w, undefined, true);
      checked++;
      if (state.error) errors++;
      else if (state.hash && before && state.hash !== before) changed++;
    } catch (e) {
      errors++;
      console.log("watch scan error:", w.id, String(e));
    }
  }
  return { checked, changed, errors };
}
