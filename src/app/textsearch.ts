// Persian-aware full-text search and near-duplicate detection for the article
// list, backed by MiniSearch. All indexing and querying goes through a shared
// Persian normalizer so ی/ي, ک/ك, ZWNJ, diacritics and digit variants collapse
// to a single canonical form — otherwise the same word typed slightly
// differently would miss.
import MiniSearch from "minisearch";
import type { Article } from "./data";

/** Canonicalize Persian text: unify Arabic/Persian letter variants, strip
 * diacritics and ZWNJ, normalize digits, and collapse whitespace. */
export function normalizeFa(s: string): string {
  return String(s || "")
    .replace(/[ً-ْٰـ]/g, "") // harakat + tatweel
    .replace(/‌/g, " ")                     // ZWNJ → space
    .replace(/ي/g, "ی").replace(/ك/g, "ک")
    .replace(/ۀ/g, "ه").replace(/ة/g, "ه")
    .replace(/[أإآ]/g, "ا").replace(/ؤ/g, "و").replace(/ئ/g, "ی")
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660)) // Arabic-Indic
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0)) // Persian
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const searchOptions = {
  fields: ["title", "preview", "source", "tags"],
  storeFields: ["id"],
  processTerm: (term: string) => {
    const n = normalizeFa(term);
    return n.length >= 2 ? n : null;
  },
  searchOptions: {
    prefix: true,
    fuzzy: 0.2,
    boost: { title: 3, tags: 2, source: 1.5 },
  },
};

function toDoc(a: Article) {
  return {
    id: a.id,
    title: a.title || "",
    preview: a.preview || "",
    source: a.source || "",
    tags: (a.tags || []).join(" "),
  };
}

/**
 * Fuzzy, Persian-normalized full-text search over a list of articles.
 * Returns the matching articles ordered by relevance. Falls back to returning
 * the whole list when the query is too short.
 */
export function searchArticles(items: Article[], query: string): Article[] {
  const q = normalizeFa(query);
  if (q.length < 2) return items;
  const mini = new MiniSearch(searchOptions);
  mini.addAll(items.map(toDoc));
  const byId = new Map(items.map(a => [a.id, a]));
  const hits = mini.search(q);
  const out: Article[] = [];
  for (const h of hits) {
    const a = byId.get(h.id as string);
    if (a) out.push(a);
  }
  return out;
}

// ── Near-duplicate detection ──

/** Token set of a normalized title, dropping very short/stop-like tokens. */
function tokenSet(title: string): Set<string> {
  const toks = normalizeFa(title)
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(t => t.length >= 3);
  return new Set(toks);
}

/** Jaccard similarity between two token sets (0..1). */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Collapse near-duplicate articles (the same wire story republished by several
 * outlets). Keeps the first occurrence of each cluster. Two articles are
 * duplicates when their normalized titles share enough tokens (Jaccard ≥
 * threshold). Cheap O(n²) over the visible window — fine for a feed list.
 */
export function dedupeArticles(items: Article[], threshold = 0.6): Article[] {
  const kept: Article[] = [];
  const keptTokens: Set<string>[] = [];
  for (const a of items) {
    const ts = tokenSet(a.title);
    let dup = false;
    for (let i = 0; i < keptTokens.length; i++) {
      if (jaccard(ts, keptTokens[i]) >= threshold) { dup = true; break; }
    }
    if (!dup) { kept.push(a); keptTokens.push(ts); }
  }
  return kept;
}
