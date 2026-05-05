// Knowledge Engine — entities, related articles, topic clusters, story threads, dedup.
//
// All client-side. Reuses TF-IDF index from semanticSearch for relatedness.

import type { Article } from "./data";
import { buildIndex, type SemanticIndex } from "./semanticSearch";

const STOP = new Set("و در از به با که این آن یک را برای تا هم می است شد بود کرد گفت بر یا اما هر اگر همان همه نیز چه چون the and is of in to a for on at by".split(" "));

const norm = (t: string) => t.toLowerCase().replace(/[\u200c]/g, "").replace(/ي/g, "ی").replace(/ك/g, "ک");

function tokens(t: string): string[] {
  return norm(t).replace(/[^\u0600-\u06FFa-z0-9\s]/gi, " ").split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
}

// ---------- Entity Extraction ----------
// Heuristic NER: capitalized phrases (English) + Persian honorifics + organization/place hints.

const PERSIAN_TITLES = ["آقای", "خانم", "دکتر", "رئیس", "وزیر", "رئیس‌جمهور", "نخست‌وزیر", "مدیرعامل", "سرلشکر", "آیت‌الله", "حجت‌الاسلام"];
const ORG_HINTS = ["وزارت", "سازمان", "شرکت", "بانک", "دانشگاه", "مؤسسه", "موسسه", "اتحادیه", "انجمن", "Inc", "Corp", "Ltd", "GmbH", "SA"];
const PLACE_HINTS = ["شهر", "استان", "کشور", "خیابان", "ناحیه"];

export type Entity = {
  text: string;
  kind: "person" | "organization" | "place" | "thing";
  count: number;
  articleIds: Set<string>;
};

export function extractEntities(articles: Article[], topN = 50): Entity[] {
  const map = new Map<string, Entity>();

  const add = (raw: string, kind: Entity["kind"], articleId: string) => {
    const key = raw.trim();
    if (key.length < 3 || key.length > 60) return;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      existing.articleIds.add(articleId);
    } else {
      map.set(key, { text: key, kind, count: 1, articleIds: new Set([articleId]) });
    }
  };

  for (const a of articles) {
    const text = `${a.title} . ${a.preview} . ${a.content || ""}`;

    // Persian titles → person
    for (const t of PERSIAN_TITLES) {
      const re = new RegExp(`${t}\\s+([\\u0600-\\u06FF\\u200c\\s]{3,40})(?=[\\s،.؟!])`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const name = m[1].trim().split(/\s+/).slice(0, 4).join(" ");
        if (name) add(name, "person", a.id);
      }
    }

    // Organization hints
    for (const h of ORG_HINTS) {
      const re = new RegExp(`${h}\\s+([\\u0600-\\u06FFA-Za-z\\u200c\\s]{3,50})(?=[\\s،.؟!])`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const name = `${h} ${m[1].trim().split(/\s+/).slice(0, 5).join(" ")}`;
        add(name, "organization", a.id);
      }
    }

    // Place hints
    for (const h of PLACE_HINTS) {
      const re = new RegExp(`${h}\\s+([\\u0600-\\u06FF\\u200c]{3,30})`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) add(m[1].trim(), "place", a.id);
    }

    // English capitalized 2-3 word phrases → thing
    const enRe = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\b/g;
    let m: RegExpExecArray | null;
    while ((m = enRe.exec(text))) {
      const phrase = m[1];
      if (/^(The|A|An|This|That|It|He|She|They|We|You|I)$/i.test(phrase)) continue;
      add(phrase, "thing", a.id);
    }
  }

  // Filter rare and sort
  return [...map.values()]
    .filter(e => e.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

// ---------- Related Articles ----------

export function relatedArticles(index: SemanticIndex, target: Article, k = 8): { article: Article; score: number }[] {
  const targetDoc = index.docs.find(d => d.article.id === target.id);
  if (!targetDoc) return [];
  const out: { article: Article; score: number }[] = [];
  for (const d of index.docs) {
    if (d.article.id === target.id) continue;
    let dot = 0;
    for (const [t, f] of targetDoc.tf) {
      const f2 = d.tf.get(t);
      if (!f2) continue;
      const idf = index.idf.get(t) || 0;
      dot += (1 + Math.log(f)) * (1 + Math.log(f2)) * idf * idf;
    }
    if (dot > 0) {
      const score = dot / (targetDoc.norm * d.norm);
      if (score > 0.05) out.push({ article: d.article, score });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, k);
}

// ---------- Topic Clustering ----------
// Single-pass leader clustering on TF-IDF cosine similarity. Fast, good-enough.

export type Cluster = {
  id: string;
  label: string;       // top tokens
  keywords: string[];
  articles: Article[];
  size: number;
};

export function clusterTopics(articles: Article[], threshold = 0.18, maxClusters = 30): Cluster[] {
  const index = buildIndex(articles);
  const leaders: { centroidDoc: typeof index.docs[number]; members: typeof index.docs }[] = [];

  for (const d of index.docs) {
    let bestI = -1, bestSim = 0;
    for (let i = 0; i < leaders.length; i++) {
      const c = leaders[i].centroidDoc;
      let dot = 0;
      for (const [t, f] of d.tf) {
        const f2 = c.tf.get(t);
        if (!f2) continue;
        const idf = index.idf.get(t) || 0;
        dot += (1 + Math.log(f)) * (1 + Math.log(f2)) * idf * idf;
      }
      const sim = dot / (d.norm * c.norm);
      if (sim > bestSim) { bestSim = sim; bestI = i; }
    }
    if (bestI >= 0 && bestSim >= threshold) {
      leaders[bestI].members.push(d);
    } else if (leaders.length < maxClusters * 4) {
      leaders.push({ centroidDoc: d, members: [d] });
    }
  }

  // build label per cluster from highest TF·IDF tokens across members
  const clusters: Cluster[] = leaders
    .filter(l => l.members.length >= 2)
    .map((l, i) => {
      const acc = new Map<string, number>();
      for (const m of l.members) {
        for (const [t, f] of m.tf) {
          const idf = index.idf.get(t) || 0;
          acc.set(t, (acc.get(t) || 0) + (1 + Math.log(f)) * idf);
        }
      }
      const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => x[0]);
      return {
        id: `c_${i}`,
        label: top.slice(0, 2).join(" · ") || "موضوع",
        keywords: top,
        articles: l.members.map(m => m.article).sort((a, b) => +new Date(b.date) - +new Date(a.date)),
        size: l.members.length,
      };
    })
    .sort((a, b) => b.size - a.size)
    .slice(0, maxClusters);

  return clusters;
}

// ---------- Story Threads ----------
// Group articles that share strong entity+keyword overlap within a time window.

export type StoryThread = {
  id: string;
  label: string;
  articles: Article[];
  sources: Set<string>;
  span: { from: string; to: string };
};

export function buildStoryThreads(articles: Article[], { windowHours = 72, minSize = 3 } = {}): StoryThread[] {
  const sorted = [...articles].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const threads: { items: Article[]; tokenBag: Map<string, number>; }[] = [];

  const enrichedTokens = (a: Article) => {
    const t = tokens(`${a.title} ${a.title} ${a.preview}`);
    return new Set(t);
  };

  for (const a of sorted) {
    const aT = enrichedTokens(a);
    if (aT.size < 3) continue;
    let best = -1, bestOverlap = 0;
    for (let i = 0; i < threads.length; i++) {
      const last = threads[i].items[threads[i].items.length - 1];
      const dt = (+new Date(a.date) - +new Date(last.date)) / 36e5;
      if (dt > windowHours) continue;
      let overlap = 0;
      for (const tok of aT) if (threads[i].tokenBag.has(tok)) overlap++;
      const sim = overlap / Math.max(1, Math.min(aT.size, threads[i].tokenBag.size));
      if (sim > bestOverlap && sim >= 0.25) { bestOverlap = sim; best = i; }
    }
    if (best >= 0) {
      threads[best].items.push(a);
      for (const t of aT) threads[best].tokenBag.set(t, (threads[best].tokenBag.get(t) || 0) + 1);
    } else {
      threads.push({ items: [a], tokenBag: new Map([...aT].map(t => [t, 1])) });
    }
  }

  return threads
    .filter(t => t.items.length >= minSize)
    .map((t, i) => {
      const top = [...t.tokenBag.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
      return {
        id: `th_${i}`,
        label: top.join(" · ") || "رشتهٔ خبر",
        articles: t.items,
        sources: new Set(t.items.map(a => a.source)),
        span: { from: t.items[0].date, to: t.items[t.items.length - 1].date },
      };
    })
    .sort((a, b) => b.articles.length - a.articles.length);
}

// ---------- Cross-source Deduplication ----------
// Find articles likely covering the same event across sources.

export type DedupGroup = {
  id: string;
  primary: Article;
  duplicates: Article[];
};

export function findDuplicates(articles: Article[], threshold = 0.6): DedupGroup[] {
  const idx = buildIndex(articles);
  const used = new Set<string>();
  const groups: DedupGroup[] = [];

  for (const d of idx.docs) {
    if (used.has(d.article.id)) continue;
    const sims: { a: Article; sim: number }[] = [];
    for (const o of idx.docs) {
      if (o.article.id === d.article.id || used.has(o.article.id)) continue;
      if (o.article.source === d.article.source) continue; // only across sources
      let dot = 0;
      for (const [t, f] of d.tf) {
        const f2 = o.tf.get(t);
        if (!f2) continue;
        const idf = idx.idf.get(t) || 0;
        dot += (1 + Math.log(f)) * (1 + Math.log(f2)) * idf * idf;
      }
      const sim = dot / (d.norm * o.norm);
      if (sim >= threshold) sims.push({ a: o.article, sim });
    }
    if (sims.length > 0) {
      used.add(d.article.id);
      sims.forEach(s => used.add(s.a.id));
      sims.sort((a, b) => b.sim - a.sim);
      groups.push({
        id: `dup_${groups.length}`,
        primary: d.article,
        duplicates: sims.map(s => s.a),
      });
    }
  }
  return groups.sort((a, b) => b.duplicates.length - a.duplicates.length);
}
