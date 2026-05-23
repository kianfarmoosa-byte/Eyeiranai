import type { Article } from "../../../data";

/**
 * Cheap relatedness score:
 *   +3 per shared tag
 *   +2 same category
 *   +1 same source
 *   +1 per shared significant word in title (length > 3)
 */
export function relatedTo(target: Article, pool: Article[], limit = 5): Article[] {
  const tags = new Set((target.tags ?? []).map((t) => t.toLowerCase()));
  const titleTokens = new Set(
    target.title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );

  const scored = pool
    .filter((a) => a.id !== target.id)
    .map((a) => {
      let s = 0;
      for (const t of a.tags ?? []) if (tags.has(t.toLowerCase())) s += 3;
      if (a.category === target.category) s += 2;
      if (a.source === target.source) s += 1;
      const toks = a.title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/);
      for (const w of toks) if (w.length > 3 && titleTokens.has(w)) s += 1;
      return { a, s };
    })
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s);

  return scored.slice(0, limit).map((x) => x.a);
}
