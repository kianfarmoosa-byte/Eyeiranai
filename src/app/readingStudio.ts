// Persian-aware reading utilities: summarization, quote extraction,
// readability scoring, highlights, notes, and position memory.

import type { Article } from "./data";

const STOP = new Set("و در از به با که این آن یک را برای تا هم می است شد بود کرد گفت بر یا اما هر اگر همان همه نیز چه چون پس بعد قبل شده های هاي ای ها".split(" "));

const PUNCT = /[.!?؟…\n]+/;

const normalize = (t: string) => t.replace(/[\u200c]/g, " ").replace(/ي/g, "ی").replace(/ك/g, "ک");

function tokenize(t: string): string[] {
  return normalize(t).toLowerCase().replace(/[^\u0600-\u06FFa-z0-9\s]/gi, " ").split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
}

function splitSentences(text: string): string[] {
  return normalize(text).split(PUNCT).map(s => s.trim()).filter(s => s.length > 15);
}

// ------------------- Summarization (TextRank-lite) -------------------

export type SummaryLevel = "tldr" | "short" | "structured";

export type StructuredSummary = {
  what: string;
  who: string;
  where: string;
  when: string;
  why: string;
};

function sentenceScore(sentences: string[]): number[] {
  const tfDoc = new Map<string, number>();
  const tokSets = sentences.map(s => {
    const toks = tokenize(s);
    for (const t of toks) tfDoc.set(t, (tfDoc.get(t) || 0) + 1);
    return new Set(toks);
  });
  return sentences.map((s, i) => {
    let score = 0;
    for (const t of tokSets[i]) score += Math.log(1 + (tfDoc.get(t) || 0));
    // Position bonus: lead sentences carry more weight
    const posBonus = Math.max(0, 1 - i / Math.max(1, sentences.length)) * 0.5;
    // Length penalty for very short or very long
    const len = s.length;
    const lenBonus = len > 40 && len < 220 ? 0.2 : 0;
    return score * (1 + posBonus + lenBonus);
  });
}

export function summarize(text: string, level: SummaryLevel): string | StructuredSummary {
  const sents = splitSentences(text);
  if (sents.length === 0) return level === "structured" ? { what: text.slice(0, 120), who: "", where: "", when: "", why: "" } : text.slice(0, 200);

  const scores = sentenceScore(sents);
  const ranked = sents.map((s, i) => ({ s, score: scores[i], i })).sort((a, b) => b.score - a.score);

  if (level === "tldr") {
    return ranked[0].s;
  }
  if (level === "short") {
    const top = ranked.slice(0, Math.min(4, sents.length)).sort((a, b) => a.i - b.i);
    return top.map(t => t.s).join(" ");
  }
  // structured
  const lower = text.toLowerCase();
  const find = (keys: string[]) => {
    for (const s of sents) {
      const sl = s.toLowerCase();
      if (keys.some(k => sl.includes(k))) return s;
    }
    return "";
  };
  return {
    what: ranked[0]?.s || "",
    who: find(["گفت", "اعلام", "تاکید", "هشدار", "رئیس", "وزیر", "مدیر"]),
    where: find(["در ", "شهر", "استان", "کشور", "ایران", "تهران"]),
    when: find(["دیروز", "امروز", "فردا", "هفته", "ماه", "سال", "ساعت", "صبح", "بعدازظهر", "شب"]),
    why: find(["زیرا", "چراکه", "به‌دلیل", "به دلیل", "تا ", "هدف"]),
  };
}

// ------------------- Quote extraction -------------------

const QUOTE_RE = /[«"](.+?)[»"]|"(.+?)"/g;
const SAY_VERBS = ["گفت", "اظهار", "اعلام", "تاکید", "افزود", "تصریح", "خاطرنشان", "بیان"];

export type Quote = { text: string; speaker?: string; index: number };

export function extractQuotes(text: string): Quote[] {
  const out: Quote[] = [];
  const norm = normalize(text);
  let m: RegExpExecArray | null;
  while ((m = QUOTE_RE.exec(norm))) {
    const q = (m[1] || m[2] || "").trim();
    if (q.length < 8) continue;
    const before = norm.slice(Math.max(0, m.index - 80), m.index);
    const after = norm.slice(m.index + m[0].length, m.index + m[0].length + 80);
    let speaker = "";
    for (const v of SAY_VERBS) {
      const idx = before.lastIndexOf(v);
      if (idx >= 0) { speaker = before.slice(Math.max(0, idx - 40), idx).trim().split(/[،,.\s]+/).slice(-3).join(" "); break; }
      const idx2 = after.indexOf(v);
      if (idx2 >= 0) { speaker = after.slice(0, idx2).trim().split(/[،,.\s]+/).slice(0, 3).join(" "); break; }
    }
    out.push({ text: q, speaker: speaker || undefined, index: m.index });
  }
  return out.slice(0, 12);
}

// ------------------- Readability -------------------

export type Readability = {
  words: number;
  sentences: number;
  avgWordsPerSentence: number;
  uniqueRatio: number;
  level: "آسان" | "متوسط" | "پیچیده";
  score: number;
};

export function readability(text: string): Readability {
  const sents = splitSentences(text);
  const words = tokenize(text);
  const unique = new Set(words);
  const avg = sents.length ? words.length / sents.length : 0;
  const uniqueRatio = words.length ? unique.size / words.length : 0;
  // simple Flesch-like score (higher = easier)
  const score = Math.max(0, Math.min(100, 110 - 1.2 * avg - 80 * Math.max(0, uniqueRatio - 0.5)));
  const level: Readability["level"] = score > 70 ? "آسان" : score > 45 ? "متوسط" : "پیچیده";
  return { words: words.length, sentences: sents.length, avgWordsPerSentence: Math.round(avg * 10) / 10, uniqueRatio: Math.round(uniqueRatio * 100) / 100, level, score: Math.round(score) };
}

// Personal reading speed (words/min). Updated on every completed read.
export function getReadSpeed(): number {
  try { return Number(localStorage.getItem("rm.wpm")) || 200; } catch { return 200; }
}

export function recordReadSpeed(words: number, seconds: number) {
  if (words < 50 || seconds < 10) return;
  const wpm = (words * 60) / seconds;
  if (wpm < 50 || wpm > 800) return;
  try {
    const prev = getReadSpeed();
    const blended = Math.round(prev * 0.7 + wpm * 0.3);
    localStorage.setItem("rm.wpm", String(blended));
  } catch {}
}

export function personalReadTime(words: number): number {
  return Math.max(1, Math.round(words / getReadSpeed()));
}

// ------------------- Highlights & notes (per-article, localStorage) -------------------

export type Highlight = {
  id: string;
  articleId: string;
  text: string;
  color: "yellow" | "green" | "blue" | "rose";
  note?: string;
  createdAt: number;
};

const HK = "rs.highlights";

function loadAllHighlights(): Highlight[] {
  try { return JSON.parse(localStorage.getItem(HK) || "[]"); } catch { return []; }
}

function saveAllHighlights(arr: Highlight[]) {
  try { localStorage.setItem(HK, JSON.stringify(arr.slice(-2000))); } catch {}
}

export function getHighlights(articleId: string): Highlight[] {
  return loadAllHighlights().filter(h => h.articleId === articleId);
}

export function getAllHighlights(): Highlight[] {
  return loadAllHighlights().sort((a, b) => b.createdAt - a.createdAt);
}

export function addHighlight(h: Omit<Highlight, "id" | "createdAt">): Highlight {
  const all = loadAllHighlights();
  const item: Highlight = { ...h, id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: Date.now() };
  all.push(item);
  saveAllHighlights(all);
  return item;
}

export function updateHighlight(id: string, patch: Partial<Highlight>) {
  const all = loadAllHighlights().map(h => h.id === id ? { ...h, ...patch } : h);
  saveAllHighlights(all);
}

export function removeHighlight(id: string) {
  saveAllHighlights(loadAllHighlights().filter(h => h.id !== id));
}

// ------------------- Position memory -------------------

const PK = "rs.positions";

type PositionMap = Record<string, { pct: number; ts: number }>;

function loadPositions(): PositionMap {
  try { return JSON.parse(localStorage.getItem(PK) || "{}"); } catch { return {}; }
}

export function savePosition(articleId: string, pct: number) {
  if (pct < 0.05 || pct > 0.97) return;
  const all = loadPositions();
  all[articleId] = { pct, ts: Date.now() };
  // prune to last 200
  const entries = Object.entries(all).sort((a, b) => b[1].ts - a[1].ts).slice(0, 200);
  try { localStorage.setItem(PK, JSON.stringify(Object.fromEntries(entries))); } catch {}
}

export function getPosition(articleId: string): number | null {
  const all = loadPositions();
  return all[articleId]?.pct ?? null;
}

// ------------------- Reading goals -------------------

export type Goal = { daily: number; weekly: number };

export function getGoal(): Goal {
  try {
    const g = JSON.parse(localStorage.getItem("rs.goal") || "{}");
    return { daily: g.daily || 5, weekly: g.weekly || 30 };
  } catch { return { daily: 5, weekly: 30 }; }
}

export function setGoal(g: Goal) {
  try { localStorage.setItem("rs.goal", JSON.stringify(g)); } catch {}
}

export function todayProgress(articles: Article[]): { read: number; total: number; pct: number } {
  // count reads from today using read.log written by StatsDashboard
  let log: { id: string; ts: number }[] = [];
  try { log = JSON.parse(localStorage.getItem("read.log") || "[]"); } catch {}
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const today = log.filter(e => e.ts >= start.getTime()).length;
  const goal = getGoal().daily;
  return { read: today, total: goal, pct: Math.min(1, today / goal) };
}
