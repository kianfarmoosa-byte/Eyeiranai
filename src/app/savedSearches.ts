// Saved searches & smart filters — composable rule engine over Article[].

import type { Article } from "./data";
import { scoreArticle } from "./sentiment";

export type Combinator = "and" | "or";

export type DateRange = "any" | "today" | "24h" | "7d" | "30d";

export type SavedSearch = {
  id: string;
  name: string;
  icon?: string;
  combinator: Combinator;
  // free-text keyword groups; entries with leading "-" are negated
  keywords: string[];
  sources: string[];        // feed ids
  tags: string[];
  dateRange: DateRange;
  minWords?: number;
  hasImage?: boolean;
  unreadOnly?: boolean;
  starredOnly?: boolean;
  notify?: boolean;          // future: surface badge on sidebar
  sentiment?: "positive" | "negative" | "neutral" | "any";
  minReadMin?: number;
  maxReadMin?: number;
  createdAt: number;
};

const KEY = "ss.searches";

export function loadSearches(): SavedSearch[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

export function saveSearches(arr: SavedSearch[]) {
  try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch {}
}

export function upsertSearch(s: SavedSearch) {
  const all = loadSearches();
  const i = all.findIndex(x => x.id === s.id);
  if (i >= 0) all[i] = s; else all.push(s);
  saveSearches(all);
}

export function removeSearch(id: string) {
  saveSearches(loadSearches().filter(s => s.id !== id));
}

export function newSearch(): SavedSearch {
  return {
    id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: "فیلتر جدید",
    icon: "🔍",
    combinator: "and",
    keywords: [],
    sources: [],
    tags: [],
    dateRange: "any",
    createdAt: Date.now(),
  };
}

const norm = (t: string) => t.toLowerCase().replace(/[\u200c]/g, "").replace(/ي/g, "ی").replace(/ك/g, "ک");

export function matches(article: Article, s: SavedSearch): boolean {
  const hay = norm(`${article.title} ${article.preview} ${article.content || ""} ${article.source}`);

  // keywords
  if (s.keywords.length) {
    const positives = s.keywords.filter(k => !k.startsWith("-")).map(k => norm(k.trim())).filter(Boolean);
    const negatives = s.keywords.filter(k => k.startsWith("-")).map(k => norm(k.slice(1).trim())).filter(Boolean);
    if (negatives.some(k => hay.includes(k))) return false;
    if (positives.length) {
      const test = (k: string) => hay.includes(k);
      if (s.combinator === "and" ? !positives.every(test) : !positives.some(test)) return false;
    }
  }

  if (s.sources.length && !s.sources.includes(article.category)) return false;
  if (s.tags.length) {
    const at = (article as any).tags || [];
    if (!s.tags.every(t => at.includes(t))) return false;
  }

  if (s.dateRange !== "any") {
    const now = Date.now();
    const d = new Date(article.date).getTime();
    if (isNaN(d)) return false;
    const span = s.dateRange === "today"
      ? now - new Date(new Date().setHours(0, 0, 0, 0)).getTime()
      : s.dateRange === "24h" ? 86400e3
      : s.dateRange === "7d"  ? 7 * 86400e3
      : 30 * 86400e3;
    if (now - d > span) return false;
  }

  if (s.minWords && (article.preview + " " + (article.content || "")).split(/\s+/).length < s.minWords) return false;
  if (s.hasImage && !(article as any).image) return false;
  if (s.unreadOnly && article.read) return false;
  if (s.starredOnly && !article.starred) return false;

  if (s.sentiment && s.sentiment !== "any") {
    if (scoreArticle(article).label !== s.sentiment) return false;
  }

  if (s.minReadMin != null || s.maxReadMin != null) {
    const m = parseInt(String(article.readTime || "0"), 10);
    if (!isNaN(m)) {
      if (s.minReadMin != null && m < s.minReadMin) return false;
      if (s.maxReadMin != null && m > s.maxReadMin) return false;
    }
  }

  return true;
}

export function applySearch(articles: Article[], s: SavedSearch): Article[] {
  return articles.filter(a => matches(a, s));
}

export function searchCounts(articles: Article[], searches: SavedSearch[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of searches) out[s.id] = applySearch(articles, s).length;
  return out;
}
