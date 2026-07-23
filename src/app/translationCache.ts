// Client-side cache for translations and extracted full-text, shared by the
// desktop ArticleView, the mobile reader, and article cards. Backed by an
// in-memory map (fast within a session) and localStorage (survives reloads and
// speeds up switching between articles). Each store is bounded so localStorage
// never overflows: oldest entries are evicted first (insertion-order LRU-ish).
import { useEffect, useState } from "react";
import { api } from "./api";
import { studioUserId } from "./components/mobile/studio/studio";

const TITLE_KEY = "flw.tcache.titles.v1";     // originalTitle -> faTitle
const CONTENT_KEY = "flw.tcache.content.v1";   // sourceUrl -> full readable text
const ARTICLE_KEY = "flw.tcache.articlefa.v1"; // articleId -> { title, content } (full translation)

const TITLE_CAP = 3000;   // headlines are small
const CONTENT_CAP = 40;    // full bodies are large
const ARTICLE_CAP = 40;

type Dict<T> = Record<string, T>;

function load<T>(key: string): Dict<T> {
  try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
}
function persist<T>(key: string, d: Dict<T>, cap: number) {
  const keys = Object.keys(d);
  if (keys.length > cap) {
    // Drop the oldest entries (object preserves insertion order for string keys).
    for (const k of keys.slice(0, keys.length - cap)) delete d[k];
  }
  try { localStorage.setItem(key, JSON.stringify(d)); } catch { /* quota — ignore */ }
}

let titleMem: Dict<string> | null = null;
let contentMem: Dict<string> | null = null;
let articleMem: Dict<{ title: string; content: string }> | null = null;

function titles() { return (titleMem ??= load<string>(TITLE_KEY)); }
function contents() { return (contentMem ??= load<string>(CONTENT_KEY)); }
function articles() { return (articleMem ??= load<{ title: string; content: string }>(ARTICLE_KEY)); }

// ── Headline translations ──
export function getTitleFa(text: string): string | undefined {
  if (!text) return undefined;
  return titles()[text];
}
export function setTitleFa(text: string, fa: string) {
  if (!text || !fa) return;
  const d = titles();
  d[text] = fa;
  persist(TITLE_KEY, d, TITLE_CAP);
}

/**
 * Translate a batch of headlines to Persian, transparently using the cache.
 * Returns a map covering every requested title (cached + freshly translated).
 * Only uncached titles hit the network, in chunks of 30.
 */
export async function translateTitlesFa(list: string[], userId = studioUserId()): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(list.filter(Boolean)));
  const result: Record<string, string> = {};
  const missing: string[] = [];
  for (const t of uniq) {
    const c = getTitleFa(t);
    if (c) result[t] = c;
    else missing.push(t);
  }
  for (let i = 0; i < missing.length; i += 30) {
    const chunk = missing.slice(i, i + 30);
    const out = await api.aiTranslateBatch({ texts: chunk, to: "fa" }, userId);
    chunk.forEach((t, j) => {
      const fa = out[j]?.trim();
      if (fa) { result[t] = fa; setTitleFa(t, fa); }
    });
  }
  return result;
}

// ── Full-text extraction ──
export function getFullContent(url: string): string | undefined {
  if (!url) return undefined;
  return contents()[url];
}
export function setFullContent(url: string, content: string) {
  if (!url || !content) return;
  const d = contents();
  d[url] = content;
  persist(CONTENT_KEY, d, CONTENT_CAP);
}

/**
 * Fetch the full readable article body for a URL, using the cache first.
 * Returns null on failure. Successful extractions are cached.
 */
export async function extractFullContent(url: string): Promise<string | null> {
  if (!url) return null;
  const cached = getFullContent(url);
  if (cached) return cached;
  try {
    const r = await api.extractArticle(url);
    const content = (r?.content || "").trim();
    if (content) { setFullContent(url, content); return content; }
    return null;
  } catch (e) {
    console.log("extractFullContent failed:", e);
    return null;
  }
}

// ── Full-article translations (title + body) ──
export function getArticleFa(id: string): { title: string; content: string } | undefined {
  if (!id) return undefined;
  return articles()[id];
}
export function setArticleFa(id: string, value: { title: string; content: string }) {
  if (!id || !value) return;
  const d = articles();
  d[id] = value;
  persist(ARTICLE_KEY, d, ARTICLE_CAP);
}

// ── Global preference: auto-translate all non-Persian headlines ──
const AUTO_KEY = "flw.autoTranslateTitles.v1";
const AUTO_EVENT = "flw:autotranslate";

export function getAutoTranslate(): boolean {
  try { return localStorage.getItem(AUTO_KEY) === "1"; } catch { return false; }
}
export function setAutoTranslate(on: boolean) {
  try { localStorage.setItem(AUTO_KEY, on ? "1" : "0"); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(AUTO_EVENT)); } catch { /* ignore */ }
}

/** React hook that tracks the global auto-translate preference and updates live
 * when it's toggled anywhere (same tab via custom event, other tabs via storage). */
export function useAutoTranslateTitles(): boolean {
  const [on, setOn] = useState<boolean>(() => getAutoTranslate());
  useEffect(() => {
    const sync = () => setOn(getAutoTranslate());
    window.addEventListener(AUTO_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTO_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return on;
}

// ── Global preference: auto-collapse near-duplicate headlines ──
// Defaults to ON (the previous always-on behavior) unless explicitly disabled.
const DEDUPE_KEY = "flw.dedupeArticles.v1";
const DEDUPE_EVENT = "flw:dedupe";

export function getDedupe(): boolean {
  try { return localStorage.getItem(DEDUPE_KEY) !== "0"; } catch { return true; }
}
export function setDedupe(on: boolean) {
  try { localStorage.setItem(DEDUPE_KEY, on ? "1" : "0"); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(DEDUPE_EVENT)); } catch { /* ignore */ }
}

/** React hook tracking the global "collapse duplicate articles" preference,
 * updating live when toggled anywhere (custom event + storage). */
export function useDedupeArticles(): boolean {
  const [on, setOn] = useState<boolean>(() => getDedupe());
  useEffect(() => {
    const sync = () => setOn(getDedupe());
    window.addEventListener(DEDUPE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DEDUPE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return on;
}
