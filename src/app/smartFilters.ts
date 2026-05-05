import type { Article } from "./data";

export type SmartFilterId =
  | "multi_source"
  | "exclusive"
  | "velocity"
  | "analysis"
  | "raw_news";

export type SmartFilter = {
  id: SmartFilterId;
  name: string;
  icon: string;
  description: string;
};

export const SMART_FILTERS: SmartFilter[] = [
  { id: "multi_source", name: "چند منبعی", icon: "🔁", description: "خبرهایی که در ۳+ منبع آمده‌اند" },
  { id: "exclusive",    name: "انحصاری",   icon: "💎", description: "خبرهایی که فقط در یک منبع آمده‌اند" },
  { id: "velocity",     name: "داغ",        icon: "🔥", description: "موج خبر در ۲ ساعت اخیر" },
  { id: "analysis",     name: "تحلیلی",     icon: "📝", description: "نظر، تحلیل، یادداشت" },
  { id: "raw_news",     name: "خبر خام",    icon: "📰", description: "گزارش خبری بدون نظر" },
];

const ANALYSIS_HINTS = ["تحلیل", "یادداشت", "نظر", "نقد", "گفتگو", "گفت‌وگو", "مصاحبه", "سرمقاله", "اپینیون"];
const RAW_HINTS = ["خبر", "گزارش", "اطلاعیه", "اعلام", "اطلاع‌رسانی"];

function parseMs(s: string): number {
  const t = new Date(s).getTime();
  return isNaN(t) ? 0 : t;
}

function normalize(s: string): string {
  return (s || "")
    .replace(/[\u200C\u200B\u200D]/g, " ")
    .replace(/[يى]/g, "ی").replace(/ك/g, "ک")
    .toLowerCase();
}

function titleKey(a: Article): string {
  const n = normalize(a.title);
  return n.split(/\s+/).filter(w => w.length > 2).slice(0, 6).sort().join(" ");
}

export function applySmartFilter(articles: Article[], id: SmartFilterId): Article[] {
  if (id === "multi_source" || id === "exclusive") {
    const groups = new Map<string, { sources: Set<string>; arts: Article[] }>();
    for (const a of articles) {
      const k = titleKey(a);
      if (!k) continue;
      let g = groups.get(k);
      if (!g) { g = { sources: new Set(), arts: [] }; groups.set(k, g); }
      g.sources.add(a.source);
      g.arts.push(a);
    }
    const keep = new Set<string>();
    for (const g of groups.values()) {
      const ok = id === "multi_source" ? g.sources.size >= 3 : g.sources.size === 1;
      if (ok) for (const a of g.arts) keep.add(a.id);
    }
    return articles.filter(a => keep.has(a.id));
  }

  if (id === "velocity") {
    const cutoff = Date.now() - 2 * 3600 * 1000;
    return articles.filter(a => parseMs(a.date) >= cutoff);
  }

  if (id === "analysis") {
    return articles.filter(a => {
      const hay = `${a.title} ${a.preview} ${a.tags?.join(" ") || ""}`.toLowerCase();
      return ANALYSIS_HINTS.some(h => hay.includes(h));
    });
  }

  if (id === "raw_news") {
    return articles.filter(a => {
      const hay = `${a.title} ${a.preview} ${a.tags?.join(" ") || ""}`.toLowerCase();
      const isAnalysis = ANALYSIS_HINTS.some(h => hay.includes(h));
      const isRaw = RAW_HINTS.some(h => hay.includes(h));
      return !isAnalysis && isRaw;
    });
  }

  return articles;
}

const MUTE_KEY = "filters.muteWords";
const SMART_KEY = "filters.smartActive";

export function loadMuteWords(): string[] {
  try { return JSON.parse(localStorage.getItem(MUTE_KEY) || "[]"); } catch { return []; }
}
export function saveMuteWords(arr: string[]) {
  try { localStorage.setItem(MUTE_KEY, JSON.stringify(arr)); } catch {}
}
export function loadActiveSmart(): SmartFilterId | null {
  const v = localStorage.getItem(SMART_KEY) as SmartFilterId | null;
  return v && SMART_FILTERS.some(f => f.id === v) ? v : null;
}
export function saveActiveSmart(v: SmartFilterId | null) {
  try {
    if (v) localStorage.setItem(SMART_KEY, v);
    else localStorage.removeItem(SMART_KEY);
  } catch {}
}

export function applyMute(articles: Article[], words: string[]): Article[] {
  if (!words.length) return articles;
  const norm = words.map(w => normalize(w)).filter(w => w.length > 1);
  if (!norm.length) return articles;
  return articles.filter(a => {
    const hay = normalize(`${a.title} ${a.preview}`);
    return !norm.some(w => hay.includes(w));
  });
}
