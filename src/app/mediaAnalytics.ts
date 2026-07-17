// ════════════════════════════════════════════════════════════════════
// Media Analytics — single computation layer feeding all dashboard views.
// "یک داده، سه روایت": Executive / Analyst / Report all read from here.
// Everything is derived from the RSS Article[] the platform already holds,
// so metrics are honest (no fabricated numbers). Fields that need data we
// don't yet have (competitor SoV, reshare velocity) are clearly derived
// proxies and labelled as such in the UI.
// ════════════════════════════════════════════════════════════════════
import type { Article } from "./data";
import { scoreArticle, type SentimentScore } from "./sentiment";

export type Period = 7 | 30 | 90;

export type Trend = { value: number; deltaPct: number | null; dir: "up" | "down" | "flat" };

export type KpiSet = {
  volume: Trend;          // حجم پوشش
  sources: Trend;         // تعداد منابع فعال
  netSentiment: Trend;    // شاخص احساسات خالص (٪ مثبت − ٪ منفی)
  dailyAvg: Trend;        // میانگین انتشار روزانه
  topics: Trend;          // موضوعات فعال (برچسب/دستهٔ متمایز)
  velocity: Trend;        // سرعت انتشار (proxy: اوج روزانه ÷ میانگین)
};

export type TonePoint = { key: string; label: string; positive: number; negative: number; neutral: number; total: number };
export type SourceRow = { name: string; icon: string; total: number; pos: number; neg: number; neu: number; net: number };
export type TopItem = { article: Article; score: number; sentiment: SentimentScore };
export type HeatCell = { topic: string; dayKey: string; count: number };

const DAY = 86400000;

export function articleMs(a: Article): number {
  if (typeof a.dateMs === "number" && a.dateMs > 0) return a.dateMs;
  const t = Date.parse(a.date);
  return Number.isFinite(t) ? t : 0;
}

/** Split into current period window and the immediately-preceding window. */
export function splitByPeriod(articles: Article[], period: Period, now = Date.now()) {
  const from = now - period * DAY;
  const prevFrom = from - period * DAY;
  const current: Article[] = [];
  const previous: Article[] = [];
  for (const a of articles) {
    const ms = articleMs(a);
    if (ms === 0) { current.push(a); continue; } // undated → count as current
    if (ms >= from) current.push(a);
    else if (ms >= prevFrom) previous.push(a);
  }
  return { current, previous, from, now };
}

function trend(cur: number, prev: number): Trend {
  if (prev <= 0) return { value: cur, deltaPct: null, dir: cur > 0 ? "up" : "flat" };
  const deltaPct = Math.round(((cur - prev) / prev) * 100);
  return { value: cur, deltaPct, dir: deltaPct > 1 ? "up" : deltaPct < -1 ? "down" : "flat" };
}

function netSentimentPct(list: Article[]): number {
  if (!list.length) return 0;
  let pos = 0, neg = 0;
  for (const a of list) {
    const s = scoreArticle(a);
    if (s.label === "positive") pos++;
    else if (s.label === "negative") neg++;
  }
  return Math.round(((pos - neg) / list.length) * 100);
}

function uniqueSources(list: Article[]): number {
  return new Set(list.map(a => a.source)).size;
}

function dayCounts(list: Article[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of list) {
    const ms = articleMs(a);
    const d = ms ? new Date(ms) : new Date();
    const k = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

export function computeKpis(articles: Article[], period: Period, now = Date.now()): KpiSet {
  const { current, previous } = splitByPeriod(articles, period, now);

  const volume = trend(current.length, previous.length);
  const sources = trend(uniqueSources(current), uniqueSources(previous));
  const netSentiment = trend(netSentimentPct(current), netSentimentPct(previous));

  const curDaily = Math.round((current.length / period) * 10) / 10;
  const prevDaily = Math.round((previous.length / period) * 10) / 10;
  const dailyAvg = trend(curDaily, prevDaily);

  const distinctTopics = (list: Article[]) => {
    const s = new Set<string>();
    for (const a of list) { for (const t of a.tags || []) s.add(t); if (a.category) s.add(a.category); }
    return s.size;
  };
  const topics = trend(distinctTopics(current), distinctTopics(previous));

  const peakOf = (list: Article[]) => { const dc = dayCounts(list); return Math.max(0, ...dc.values()); };
  const velRatio = (list: Article[]) => {
    if (!list.length) return 0;
    const peak = peakOf(list);
    const avg = list.length / period;
    return avg > 0 ? Math.round((peak / avg) * 10) / 10 : 0;
  };
  const velocity = trend(velRatio(current), velRatio(previous));

  return { volume, sources, netSentiment, dailyAvg, topics, velocity };
}

/** Daily coverage series (jalali-friendly keys carry the raw Date). */
export function coverageSeries(articles: Article[], period: Period, now = Date.now()) {
  const from = now - period * DAY;
  const buckets = new Map<string, { date: Date; count: number }>();
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date(now - i * DAY);
    const k = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    buckets.set(k, { date: new Date(d), count: 0 });
  }
  for (const a of articles) {
    const ms = articleMs(a);
    if (ms && ms < from) continue;
    const d = ms ? new Date(ms) : new Date(now);
    const k = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const b = buckets.get(k);
    if (b) b.count++;
  }
  return [...buckets.values()];
}

/** Stacked sentiment over time (daily). */
export function toneSeries(articles: Article[], period: Period, now = Date.now()): TonePoint[] {
  const from = now - period * DAY;
  const map = new Map<string, TonePoint>();
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date(now - i * DAY);
    const k = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    map.set(k, { key: k, label: k, positive: 0, negative: 0, neutral: 0, total: 0 });
  }
  for (const a of articles) {
    const ms = articleMs(a);
    if (ms && ms < from) continue;
    const d = ms ? new Date(ms) : new Date(now);
    const k = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const p = map.get(k);
    if (!p) continue;
    const s = scoreArticle(a);
    if (s.label === "positive") p.positive++;
    else if (s.label === "negative") p.negative++;
    else p.neutral++;
    p.total++;
  }
  return [...map.values()];
}

/** Source × tone breakdown, sorted by volume. */
export function sourceBreakdown(articles: Article[], period: Period, now = Date.now(), limit = 12): SourceRow[] {
  const { current } = splitByPeriod(articles, period, now);
  const map = new Map<string, SourceRow>();
  for (const a of current) {
    let row = map.get(a.source);
    if (!row) { row = { name: a.source, icon: a.sourceIcon || "📰", total: 0, pos: 0, neg: 0, neu: 0, net: 0 }; map.set(a.source, row); }
    row.total++;
    const s = scoreArticle(a);
    if (s.label === "positive") row.pos++;
    else if (s.label === "negative") row.neg++;
    else row.neu++;
  }
  const rows = [...map.values()];
  for (const r of rows) r.net = r.total ? Math.round(((r.pos - r.neg) / r.total) * 100) : 0;
  return rows.sort((a, b) => b.total - a.total).slice(0, limit);
}

/** Top content ranked by an influence proxy (recency × source reach × tone weight). */
export function topContent(articles: Article[], period: Period, now = Date.now(), limit = 12): TopItem[] {
  const { current } = splitByPeriod(articles, period, now);
  // source reach proxy = how many articles that source produced in window
  const reach = new Map<string, number>();
  for (const a of current) reach.set(a.source, (reach.get(a.source) || 0) + 1);
  const maxReach = Math.max(1, ...reach.values());

  const items = current.map(article => {
    const sentiment = scoreArticle(article);
    const ms = articleMs(article);
    const ageDays = ms ? Math.max(0, (now - ms) / DAY) : period;
    const recency = 1 - Math.min(1, ageDays / period);          // 0..1
    const reachScore = (reach.get(article.source) || 1) / maxReach; // 0..1
    const toneWeight = 1 + Math.abs(sentiment.score) * 0.5;      // charged stories rank up
    const score = (recency * 0.5 + reachScore * 0.5) * toneWeight * 100;
    return { article, score: Math.round(score), sentiment };
  });
  return items.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Topic heatmap: topic (tag/category) × day matrix. */
export function topicHeatmap(articles: Article[], period: Period, now = Date.now(), topN = 8) {
  const { current } = splitByPeriod(articles, period, now);
  const topicCount = new Map<string, number>();
  for (const a of current) {
    const keys = (a.tags && a.tags.length ? a.tags : [a.category]).filter(Boolean) as string[];
    for (const k of keys) topicCount.set(k, (topicCount.get(k) || 0) + 1);
  }
  const topics = [...topicCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map(e => e[0]);

  // build day columns
  const days: { key: string; date: Date }[] = [];
  const span = Math.min(period, 30); // heatmap caps columns for readability
  for (let i = span - 1; i >= 0; i--) {
    const d = new Date(now - i * DAY);
    days.push({ key: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`, date: new Date(d) });
  }
  const dayset = new Set(days.map(d => d.key));

  const grid = new Map<string, number>(); // `${topic}|${dayKey}`
  for (const a of current) {
    const ms = articleMs(a);
    const d = ms ? new Date(ms) : new Date(now);
    const dk = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (!dayset.has(dk)) continue;
    const keys = (a.tags && a.tags.length ? a.tags : [a.category]).filter(Boolean) as string[];
    for (const t of keys) {
      if (!topics.includes(t)) continue;
      const gk = `${t}|${dk}`;
      grid.set(gk, (grid.get(gk) || 0) + 1);
    }
  }
  let max = 1;
  for (const v of grid.values()) max = Math.max(max, v);
  return { topics, days, grid, max };
}

/** Simple anomaly detection: topics whose current-window volume ≫ prior baseline. */
export function detectAnomalies(articles: Article[], period: Period, now = Date.now(), factor = 2.5) {
  const { current, previous } = splitByPeriod(articles, period, now);
  const count = (list: Article[]) => {
    const m = new Map<string, number>();
    for (const a of list) { const keys = (a.tags && a.tags.length ? a.tags : [a.category]).filter(Boolean) as string[]; for (const k of keys) m.set(k, (m.get(k) || 0) + 1); }
    return m;
  };
  const cur = count(current), prev = count(previous);
  const out: { topic: string; current: number; baseline: number; ratio: number }[] = [];
  for (const [topic, c] of cur) {
    const baseline = prev.get(topic) || 0;
    const ratio = baseline === 0 ? (c >= 3 ? Infinity : 0) : c / baseline;
    if (ratio >= factor && c >= 3) out.push({ topic, current: c, baseline, ratio: baseline === 0 ? c : Math.round(ratio * 10) / 10 });
  }
  return out.sort((a, b) => b.ratio - a.ratio).slice(0, 8);
}

/** Share of voice among a set of brand/competitor keyword groups. */
export type SovGroup = { name: string; keywords: string[]; color: string };
export function shareOfVoice(articles: Article[], groups: SovGroup[], period: Period, now = Date.now()) {
  const { current } = splitByPeriod(articles, period, now);
  const res = groups.map(g => {
    const kws = g.keywords.map(k => k.trim().toLowerCase()).filter(Boolean);
    let count = 0, pos = 0, neg = 0;
    for (const a of current) {
      const hay = `${a.title} ${a.preview || ""} ${(a.tags || []).join(" ")}`.toLowerCase();
      if (kws.some(k => k && hay.includes(k))) {
        count++;
        const s = scoreArticle(a);
        if (s.label === "positive") pos++; else if (s.label === "negative") neg++;
      }
    }
    return { name: g.name, color: g.color, count, pos, neg, net: count ? Math.round(((pos - neg) / count) * 100) : 0 };
  });
  const total = res.reduce((s, r) => s + r.count, 0) || 1;
  return res.map(r => ({ ...r, share: Math.round((r.count / total) * 100) }));
}
