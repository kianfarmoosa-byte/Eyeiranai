// Timeline engine — generate a chronological storyline from articles for a topic.
import type { Article } from "./data";

export type Granularity = "day" | "week" | "month";

export type TopicQuery =
  | { kind: "keyword"; q: string; label?: string }
  | { kind: "entity"; text: string; label?: string }
  | { kind: "ids"; ids: Set<string>; label: string }
  | { kind: "tag"; tag: string }
  | { kind: "source"; source: string };

export type TimelineBucket = {
  key: string;
  label: string;
  start: number;
  end: number;
  articles: Article[];
  sources: Set<string>;
  isSpike: boolean;
  isQuiet: boolean;
  newSources: string[];
};

export type TimelineEvent = {
  bucketKey: string;
  kind: "first" | "spike" | "broadening" | "resurgence" | "peak";
  label: string;
  article?: Article;
};

export type Timeline = {
  topicLabel: string;
  granularity: Granularity;
  buckets: TimelineBucket[];
  total: number;
  span: { from: number; to: number } | null;
  peak: TimelineBucket | null;
  topSources: { source: string; count: number; icon?: string }[];
  events: TimelineEvent[];
  sourceDiversity: number;
};

const FA: Record<string, string> = { "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9","٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9" };
const norm = (s: string) =>
  s.toLowerCase()
    .replace(/[\u200c]/g, "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹٠-٩]/g, c => FA[c] || c)
    .trim();

export function articleTime(a: Article): number {
  if (a.dateMs && Number.isFinite(a.dateMs)) return a.dateMs;
  const t = Date.parse(a.date || "");
  return Number.isFinite(t) ? t : 0;
}

export function topicLabelOf(t: TopicQuery): string {
  switch (t.kind) {
    case "keyword": return t.label || t.q;
    case "entity":  return t.label || t.text;
    case "ids":     return t.label;
    case "tag":     return `#${t.tag}`;
    case "source":  return t.source;
  }
}

export function filterByTopic(articles: Article[], topic: TopicQuery): Article[] {
  if (topic.kind === "keyword") {
    const needle = norm(topic.q);
    if (!needle) return [];
    return articles.filter(a => norm(`${a.title}\n${a.preview}\n${a.content}\n${(a.tags || []).join(" ")}`).includes(needle));
  }
  if (topic.kind === "entity") {
    const needle = norm(topic.text);
    return articles.filter(a => norm(`${a.title}\n${a.preview}\n${a.content}`).includes(needle));
  }
  if (topic.kind === "ids") return articles.filter(a => topic.ids.has(a.id));
  if (topic.kind === "source") return articles.filter(a => a.source === topic.source);
  return articles.filter(a => (a.tags || []).map(norm).includes(norm(topic.tag)));
}

function bucketKey(ts: number, g: Granularity) {
  const d = new Date(ts);
  const y = d.getFullYear();
  if (g === "day") {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const start = new Date(y, d.getMonth(), d.getDate()).getTime();
    return { key: `${y}-${m}-${day}`, start, end: start + 24 * 36e5,
      label: new Date(start).toLocaleDateString("fa-IR", { weekday: "short", day: "numeric", month: "long", year: "numeric" }) };
  }
  if (g === "week") {
    const dow = (d.getDay() + 6) % 7;
    const monday = new Date(y, d.getMonth(), d.getDate() - dow);
    const start = monday.getTime();
    const w = Math.floor((start - new Date(y, 0, 1).getTime()) / (7 * 24 * 36e5)) + 1;
    return { key: `${y}-W${String(w).padStart(2, "0")}`, start, end: start + 7 * 24 * 36e5,
      label: `هفتهٔ ${monday.toLocaleDateString("fa-IR", { day: "numeric", month: "long" })}` };
  }
  const start = new Date(y, d.getMonth(), 1).getTime();
  const end = new Date(y, d.getMonth() + 1, 1).getTime();
  return { key: `${y}-${String(d.getMonth() + 1).padStart(2, "0")}`, start, end,
    label: new Date(start).toLocaleDateString("fa-IR", { month: "long", year: "numeric" }) };
}

export function buildTimeline(articles: Article[], topic: TopicQuery, granularity: Granularity = "day"): Timeline {
  const filtered = filterByTopic(articles, topic).filter(a => articleTime(a) > 0);
  filtered.sort((a, b) => articleTime(a) - articleTime(b));
  const topicLabel = topicLabelOf(topic);

  if (filtered.length === 0) {
    return { topicLabel, granularity, buckets: [], total: 0, span: null, peak: null, topSources: [], events: [], sourceDiversity: 0 };
  }

  const map = new Map<string, TimelineBucket>();
  for (const a of filtered) {
    const bk = bucketKey(articleTime(a), granularity);
    let b = map.get(bk.key);
    if (!b) {
      b = { key: bk.key, label: bk.label, start: bk.start, end: bk.end, articles: [], sources: new Set(), isSpike: false, isQuiet: false, newSources: [] };
      map.set(bk.key, b);
    }
    b.articles.push(a);
    b.sources.add(a.source);
  }

  const orderedKeys = Array.from(map.keys()).sort();
  const first = map.get(orderedKeys[0])!;
  const last = map.get(orderedKeys[orderedKeys.length - 1])!;
  const buckets: TimelineBucket[] = [];
  let cur = first.start;
  let guard = 0;
  while (cur <= last.start && guard++ < 600) {
    const probe = bucketKey(cur, granularity);
    const existing = map.get(probe.key);
    if (existing) buckets.push(existing);
    else buckets.push({ key: probe.key, label: probe.label, start: probe.start, end: probe.end, articles: [], sources: new Set(), isSpike: false, isQuiet: true, newSources: [] });
    cur = probe.end;
  }

  const counts = buckets.map(b => b.articles.length);
  const nonEmpty = counts.filter(c => c > 0);
  const mean = nonEmpty.reduce((s, c) => s + c, 0) / Math.max(1, nonEmpty.length);
  const spikeThreshold = Math.max(2, mean * 1.6);
  for (const b of buckets) {
    if (b.articles.length === 0) b.isQuiet = true;
    if (b.articles.length >= spikeThreshold) b.isSpike = true;
  }

  const events: TimelineEvent[] = [];
  let peak: TimelineBucket | null = null;
  const seen = new Set<string>();
  for (let i = 0; i < buckets.length; i++) {
    const b = buckets[i];
    if (b.articles.length === 0) continue;
    for (const s of b.sources) if (!seen.has(s)) b.newSources.push(s);
    for (const s of b.sources) seen.add(s);
    if (!peak || b.articles.length > peak.articles.length) peak = b;
    if (events.filter(e => e.kind === "first").length === 0) {
      events.push({ bucketKey: b.key, kind: "first", label: "نخستین پوشش", article: b.articles[0] });
    }
    if (b.isSpike) events.push({ bucketKey: b.key, kind: "spike", label: `اوج موقت — ${b.articles.length.toLocaleString("fa-IR")} مقاله`, article: b.articles[0] });
    if (b.newSources.length >= Math.max(3, Math.floor(b.sources.size / 2))) {
      events.push({ bucketKey: b.key, kind: "broadening", label: `+${b.newSources.length.toLocaleString("fa-IR")} منبع جدید`, article: b.articles[0] });
    }
    if (i >= 2 && buckets[i - 1].articles.length === 0 && buckets[i - 2].articles.length === 0) {
      events.push({ bucketKey: b.key, kind: "resurgence", label: "بازگشت پس از سکوت", article: b.articles[0] });
    }
  }
  if (peak) events.push({ bucketKey: peak.key, kind: "peak", label: "اوج پوشش رسانه‌ای", article: peak.articles[0] });

  const srcMap = new Map<string, { source: string; count: number; icon?: string }>();
  for (const a of filtered) {
    const e = srcMap.get(a.source) || { source: a.source, count: 0, icon: a.sourceIcon };
    e.count++;
    srcMap.set(a.source, e);
  }

  return {
    topicLabel, granularity, buckets, total: filtered.length,
    span: { from: articleTime(filtered[0]), to: articleTime(filtered[filtered.length - 1]) },
    peak,
    topSources: Array.from(srcMap.values()).sort((a, b) => b.count - a.count).slice(0, 8),
    events,
    sourceDiversity: srcMap.size / filtered.length,
  };
}

export function exportTimelineMarkdown(t: Timeline): string {
  const head =
    `# خط زمانی — ${t.topicLabel}\n\n` +
    `_تولید‌شده: ${new Date().toLocaleString("fa-IR")}_\n\n` +
    `**${t.total.toLocaleString("fa-IR")}** مقاله از **${t.topSources.length.toLocaleString("fa-IR")}** منبع — دانه‌بندی: ${t.granularity === "day" ? "روزانه" : t.granularity === "week" ? "هفتگی" : "ماهانه"}\n`;
  const body = t.buckets.filter(b => b.articles.length).map(b => {
    const evts = t.events.filter(e => e.bucketKey === b.key).map(e => `> 🔸 ${e.label}`).join("\n");
    const items = b.articles.map(a => `- [${a.title}](${a.link || "#"}) — ${a.source}`).join("\n");
    return `## ${b.label}${b.isSpike ? "  ⚡" : ""}${b.isQuiet ? "  💤" : ""}\n\n${evts ? evts + "\n\n" : ""}${items}\n`;
  }).join("\n");
  return head + "\n" + body;
}

// ───────────── Multi-topic comparison ─────────────
export type MultiTimeline = {
  granularity: Granularity;
  bucketKeys: string[];
  bucketLabels: string[];
  bucketStarts: number[];
  series: { topic: TopicQuery; label: string; color: string; counts: number[]; total: number }[];
  span: { from: number; to: number } | null;
};

const SERIES_COLORS = ["#3b82f6", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export function buildMultiTimeline(articles: Article[], topics: TopicQuery[], granularity: Granularity = "day"): MultiTimeline {
  const lines = topics.map(t => buildTimeline(articles, t, granularity));
  const allStarts = new Set<number>();
  for (const l of lines) for (const b of l.buckets) allStarts.add(b.start);
  if (allStarts.size === 0) return { granularity, bucketKeys: [], bucketLabels: [], bucketStarts: [], series: [], span: null };

  const sortedStarts = Array.from(allStarts).sort((a, b) => a - b);
  const first = sortedStarts[0], last = sortedStarts[sortedStarts.length - 1];
  const bucketStarts: number[] = [], bucketKeys: string[] = [], bucketLabels: string[] = [];
  let cur = first, guard = 0;
  while (cur <= last && guard++ < 600) {
    const bk = bucketKey(cur, granularity);
    bucketStarts.push(bk.start); bucketKeys.push(bk.key); bucketLabels.push(bk.label);
    cur = bk.end;
  }

  const series = lines.map((tl, i) => {
    const counts = bucketKeys.map(k => tl.buckets.find(b => b.key === k)?.articles.length || 0);
    return { topic: topics[i], label: tl.topicLabel, color: SERIES_COLORS[i % SERIES_COLORS.length], counts, total: tl.total };
  });

  return { granularity, bucketKeys, bucketLabels, bucketStarts, series, span: { from: first, to: last } };
}

// ───────────── Heatmap (weekday × week) ─────────────
export type HeatCell = { week: number; weekday: number; date: number; count: number; isQuiet: boolean };
export function buildHeatmap(t: Timeline): { cells: HeatCell[]; weeks: number; max: number } {
  if (!t.span) return { cells: [], weeks: 0, max: 0 };
  const startDate = new Date(t.span.from);
  const startDow = (startDate.getDay() + 6) % 7;
  const gridStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() - startDow).getTime();
  const dayMs = 24 * 36e5;
  const totalDays = Math.ceil((t.span.to - gridStart) / dayMs) + 1;
  const weeks = Math.max(1, Math.ceil(totalDays / 7));
  const dayCount = new Map<string, number>();
  for (const b of t.buckets) {
    for (const a of b.articles) {
      const at = articleTime(a);
      const d = new Date(at); const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      dayCount.set(k, (dayCount.get(k) || 0) + 1);
    }
  }
  const cells: HeatCell[] = [];
  let max = 0;
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const ts = gridStart + (w * 7 + d) * dayMs;
      const dt = new Date(ts);
      const k = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      const c = dayCount.get(k) || 0;
      if (c > max) max = c;
      cells.push({ week: w, weekday: d, date: ts, count: c, isQuiet: c === 0 });
    }
  }
  return { cells, weeks, max };
}

// ───────────── Annotations (per topic+bucket) ─────────────
const ANN_KEY = "kn.timeline.annotations";
type AnnStore = Record<string, string>;
function annStore(): AnnStore { try { return JSON.parse(localStorage.getItem(ANN_KEY) || "{}"); } catch { return {}; } }
function annKey(topicLabel: string, bucketKey: string) { return `${norm(topicLabel)}|${bucketKey}`; }
export function getAnnotation(topicLabel: string, bucketKey: string): string {
  return annStore()[annKey(topicLabel, bucketKey)] || "";
}
export function setAnnotation(topicLabel: string, bucketKey: string, text: string) {
  const s = annStore(); const k = annKey(topicLabel, bucketKey);
  if (text.trim()) s[k] = text; else delete s[k];
  try { localStorage.setItem(ANN_KEY, JSON.stringify(s)); } catch {}
}
export function getAnnotationsForTopic(topicLabel: string): Record<string, string> {
  const s = annStore(); const prefix = norm(topicLabel) + "|";
  const out: Record<string, string> = {};
  for (const k in s) if (k.startsWith(prefix)) out[k.slice(prefix.length)] = s[k];
  return out;
}

// ───────────── PNG export of sparkline ─────────────
export async function exportTimelinePNG(t: Timeline, opts: { width?: number; height?: number } = {}): Promise<Blob | null> {
  const W = opts.width || 1200, H = opts.height || 420;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 22px system-ui, sans-serif"; ctx.textAlign = "right"; ctx.direction = "rtl";
  ctx.fillText(`خط زمانی — ${t.topicLabel}`, W - 24, 36);
  ctx.fillStyle = "#94a3b8"; ctx.font = "14px system-ui, sans-serif";
  ctx.fillText(`${t.total.toLocaleString("fa-IR")} مقاله · ${t.topSources.length.toLocaleString("fa-IR")} منبع`, W - 24, 60);

  const pad = { l: 60, r: 60, t: 100, b: 60 };
  const innerW = W - pad.l - pad.r, innerH = H - pad.t - pad.b;
  const counts = t.buckets.map(b => b.articles.length);
  const max = Math.max(1, ...counts);
  const bw = innerW / Math.max(1, counts.length);
  for (let i = 0; i < counts.length; i++) {
    const c = counts[i]; const b = t.buckets[i];
    const h = (c / max) * innerH;
    const x = pad.l + i * bw, y = pad.t + (innerH - h);
    ctx.fillStyle = b.isSpike ? "#f43f5e" : c === 0 ? "#1e293b" : "#3b82f6";
    ctx.fillRect(x + 1, y, Math.max(1, bw - 2), h);
  }
  ctx.strokeStyle = "#334155"; ctx.beginPath(); ctx.moveTo(pad.l, pad.t + innerH); ctx.lineTo(pad.l + innerW, pad.t + innerH); ctx.stroke();
  ctx.fillStyle = "#64748b"; ctx.font = "11px system-ui, sans-serif"; ctx.textAlign = "center";
  if (t.buckets.length) {
    ctx.fillText(t.buckets[0].label, pad.l + bw / 2, pad.t + innerH + 20);
    ctx.fillText(t.buckets[t.buckets.length - 1].label, pad.l + innerW - bw / 2, pad.t + innerH + 20);
  }
  ctx.fillStyle = "#475569"; ctx.font = "10px system-ui, sans-serif"; ctx.textAlign = "left";
  ctx.fillText("kian · knowledge timeline", 16, H - 16);

  return await new Promise(res => canvas.toBlob(b => res(b), "image/png"));
}

const RECENT_KEY = "kn.timeline.recent";
export function loadRecentTopics(): TopicQuery[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return raw.map((r: any) => r.kind === "ids" ? { ...r, ids: new Set(r.ids) } : r);
  } catch { return []; }
}
export function pushRecentTopic(t: TopicQuery, max = 8) {
  try {
    const list = loadRecentTopics();
    const key = JSON.stringify(t.kind === "ids" ? { ...t, ids: Array.from(t.ids) } : t);
    const next = [t, ...list.filter(x => JSON.stringify(x.kind === "ids" ? { ...x, ids: Array.from(x.ids) } : x) !== key)].slice(0, max);
    const serializable = next.map(x => x.kind === "ids" ? { ...x, ids: Array.from(x.ids) } : x);
    localStorage.setItem(RECENT_KEY, JSON.stringify(serializable));
  } catch {}
}
