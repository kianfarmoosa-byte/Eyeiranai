/**
 * Persisted per-article text highlights. Stored as raw substrings keyed by
 * article id — when the reader renders, any matching substring is wrapped in
 * a <mark> so highlights survive across sessions without needing offsets.
 */

const KEY = "kian.mobile.highlights";

type Store = Record<string, string[]>;

function load(): Store {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") as Store; } catch { return {}; }
}
function save(s: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export function getHighlights(articleId: string): string[] {
  return load()[articleId] ?? [];
}

export function addHighlight(articleId: string, text: string) {
  const t = text.trim();
  if (!t || t.length < 4) return;
  const s = load();
  const list = (s[articleId] ??= []);
  if (!list.includes(t)) list.unshift(t);
  // cap per article
  if (list.length > 40) list.length = 40;
  save(s);
}

export function removeHighlight(articleId: string, text: string) {
  const s = load();
  const list = s[articleId];
  if (!list) return;
  s[articleId] = list.filter((h) => h !== text);
  if (s[articleId].length === 0) delete s[articleId];
  save(s);
}

/**
 * Split content into plain/highlighted segments using the saved highlights.
 * Longest matches first so nested substrings don't get clobbered.
 */
export function splitWithHighlights(
  content: string,
  highlights: string[],
): Array<{ text: string; mark: boolean }> {
  if (highlights.length === 0) return [{ text: content, mark: false }];
  const sorted = [...highlights].sort((a, b) => b.length - a.length);

  let segments: Array<{ text: string; mark: boolean }> = [{ text: content, mark: false }];
  for (const h of sorted) {
    const next: typeof segments = [];
    for (const seg of segments) {
      if (seg.mark) { next.push(seg); continue; }
      const parts = seg.text.split(h);
      parts.forEach((p, i) => {
        if (p) next.push({ text: p, mark: false });
        if (i < parts.length - 1) next.push({ text: h, mark: true });
      });
    }
    segments = next;
  }
  return segments;
}
