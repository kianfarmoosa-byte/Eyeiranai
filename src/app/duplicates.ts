import type { Article } from "./data";

function normalize(s: string): string {
  return s
    .replace(/[\u200C\u200B\u200D]/g, " ")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[^\u0600-\u06FF\sa-zA-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const STOP = new Set(["و", "در", "از", "به", "که", "این", "با", "را", "بر", "تا", "یک", "یا", "هم", "نیز", "اما", "ولی", "the", "a", "of", "in", "and", "to"]);

function shingles(s: string, n = 3): Set<string> {
  const tokens = normalize(s).split(" ").filter(t => t && !STOP.has(t));
  const out = new Set<string>();
  for (let i = 0; i + n <= tokens.length; i++) out.add(tokens.slice(i, i + n).join(" "));
  if (tokens.length < n && tokens.length) out.add(tokens.join(" "));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export type DuplicateCluster = {
  id: string;
  articles: Article[];
  representativeId: string;
  similarity: number;
};

export function findDuplicates(articles: Article[], threshold = 0.4): DuplicateCluster[] {
  const sigs = articles.map(a => ({ a, sig: shingles(`${a.title} ${a.preview || ""}`) }));
  const used = new Set<string>();
  const clusters: DuplicateCluster[] = [];

  for (let i = 0; i < sigs.length; i++) {
    if (used.has(sigs[i].a.id)) continue;
    const group: { a: Article; sim: number }[] = [{ a: sigs[i].a, sim: 1 }];
    for (let j = i + 1; j < sigs.length; j++) {
      if (used.has(sigs[j].a.id)) continue;
      const sim = jaccard(sigs[i].sig, sigs[j].sig);
      if (sim >= threshold) group.push({ a: sigs[j].a, sim });
    }
    if (group.length > 1) {
      for (const g of group) used.add(g.a.id);
      const avg = group.reduce((s, g) => s + g.sim, 0) / group.length;
      clusters.push({
        id: `dup_${sigs[i].a.id}`,
        articles: group.map(g => g.a),
        representativeId: sigs[i].a.id,
        similarity: avg,
      });
    }
  }
  return clusters.sort((a, b) => b.articles.length - a.articles.length);
}

export function duplicatesForArticle(article: Article, all: Article[], threshold = 0.4): { article: Article; similarity: number }[] {
  const sig = shingles(`${article.title} ${article.preview || ""}`);
  const out: { article: Article; similarity: number }[] = [];
  for (const a of all) {
    if (a.id === article.id) continue;
    const sim = jaccard(sig, shingles(`${a.title} ${a.preview || ""}`));
    if (sim >= threshold) out.push({ article: a, similarity: sim });
  }
  return out.sort((a, b) => b.similarity - a.similarity);
}
