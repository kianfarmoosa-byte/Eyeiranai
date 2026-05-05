import type { Article } from "./data";

const STOP = new Set("و در از به با که این آن یک را برای تا هم می است شد بود کرد گفت بر یا اما هر اگر همان همه نیز چه چون the and is of in to a for on at by".split(" "));

function normalize(t: string): string {
  return t.toLowerCase().replace(/[\u200c]/g, "").replace(/ي/g, "ی").replace(/ك/g, "ک");
}

function tokenize(t: string): string[] {
  return normalize(t).replace(/[^\u0600-\u06FFa-z0-9\s]/gi, " ").split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
}

export type IndexedDoc = {
  article: Article;
  tf: Map<string, number>;
  norm: number;
};

export type SemanticIndex = {
  docs: IndexedDoc[];
  idf: Map<string, number>;
};

export function buildIndex(articles: Article[]): SemanticIndex {
  const docs: { a: Article; toks: string[] }[] = articles.map(a => ({
    a, toks: tokenize(`${a.title} ${a.title} ${a.preview} ${a.content || ""}`),
  }));
  const df = new Map<string, number>();
  for (const { toks } of docs) {
    const seen = new Set(toks);
    for (const t of seen) df.set(t, (df.get(t) || 0) + 1);
  }
  const N = Math.max(1, docs.length);
  const idf = new Map<string, number>();
  for (const [t, f] of df) idf.set(t, Math.log(1 + N / f));

  const indexed = docs.map(({ a, toks }) => {
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    let norm = 0;
    for (const [t, f] of tf) {
      const w = (1 + Math.log(f)) * (idf.get(t) || 0);
      norm += w * w;
    }
    return { article: a, tf, norm: Math.sqrt(norm) || 1 };
  });
  return { docs: indexed, idf };
}

export function semanticSearch(index: SemanticIndex, query: string, topK = 30): { article: Article; score: number; highlights: string[] }[] {
  const qToks = tokenize(query);
  if (qToks.length === 0) return [];
  const qTf = new Map<string, number>();
  for (const t of qToks) qTf.set(t, (qTf.get(t) || 0) + 1);
  const qWeights = new Map<string, number>();
  let qNorm = 0;
  for (const [t, f] of qTf) {
    const w = (1 + Math.log(f)) * (index.idf.get(t) || 0);
    qWeights.set(t, w);
    qNorm += w * w;
  }
  qNorm = Math.sqrt(qNorm) || 1;

  const out: { article: Article; score: number; highlights: string[] }[] = [];
  for (const d of index.docs) {
    let dot = 0;
    for (const [t, qw] of qWeights) {
      const f = d.tf.get(t);
      if (!f) continue;
      const dw = (1 + Math.log(f)) * (index.idf.get(t) || 0);
      dot += qw * dw;
    }
    if (dot > 0) {
      const score = dot / (qNorm * d.norm);
      const matched = [...qWeights.keys()].filter(t => d.tf.has(t));
      out.push({ article: d.article, score, highlights: matched });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, topK);
}
