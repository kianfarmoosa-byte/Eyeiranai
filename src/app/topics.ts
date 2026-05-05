// Topic Focus engine — score articles against named topics for highlight/dim mode.
import type { Article } from "./data";

export type TopicColor =
  | "indigo" | "rose" | "emerald" | "amber" | "sky" | "violet" | "red" | "blue" | "orange";

export type Topic = {
  id: string;
  name: string;
  icon: string;
  color: TopicColor;
  keywords: string[];
  entities?: string[];
  sources?: string[];
  custom?: boolean;
};

export const BUILT_IN_TOPICS: Topic[] = [
  { id: "gov", name: "دولت", icon: "🏛️", color: "indigo",
    keywords: ["دولت", "هیئت دولت", "رئیس‌جمهور", "رئیس جمهور", "وزیر", "وزارت", "کابینه", "سخنگوی دولت", "معاون اول", "ریاست جمهوری"],
    entities: ["دولت", "وزارت"] },
  { id: "parliament", name: "مجلس", icon: "🏢", color: "violet",
    keywords: ["مجلس", "نماینده", "نمایندگان", "کمیسیون", "طرح", "لایحه", "رأی اعتماد", "رای اعتماد", "هیئت رئیسه", "صحن علنی"],
    entities: ["مجلس"] },
  { id: "military", name: "نظامی", icon: "🛡️", color: "red",
    keywords: ["نظامی", "ارتش", "سپاه", "نیروی هوایی", "نیروی دریایی", "موشک", "پهپاد", "رزمایش", "فرمانده", "جنگنده", "دفاع", "تسلیحات"],
    entities: ["سپاه", "ارتش", "ناتو"] },
  { id: "economy", name: "اقتصادی", icon: "📈", color: "emerald",
    keywords: ["اقتصاد", "تورم", "ارز", "دلار", "یورو", "بورس", "بازار", "سکه", "طلا", "بانک مرکزی", "نرخ", "بودجه", "تحریم", "نقدینگی", "گرانی"],
    entities: ["بانک مرکزی"] },
  { id: "politics", name: "سیاسی", icon: "🗳️", color: "amber",
    keywords: ["سیاسی", "سیاست", "انتخابات", "حزب", "اصلاح‌طلب", "اصولگرا", "اپوزیسیون", "دیپلماسی", "مذاکره"] },
  { id: "intl", name: "بین‌الملل", icon: "🌍", color: "sky",
    keywords: ["بین‌الملل", "بین الملل", "جهان", "خارجی", "سازمان ملل", "اتحادیه اروپا", "آمریکا", "روسیه", "چین", "اروپا"],
    entities: ["آمریکا", "روسیه", "چین", "اتحادیه اروپا", "سازمان ملل"] },
  { id: "war_ir_us", name: "ایران و آمریکا", icon: "⚔️", color: "rose",
    keywords: ["ایران و آمریکا", "تنش", "تحریم", "هسته‌ای", "هسته ای", "برجام", "حمله", "تهدید", "مذاکره", "درگیری"],
    entities: ["ایران", "آمریکا", "سپاه"] },
  { id: "tech", name: "فناوری", icon: "💻", color: "blue",
    keywords: ["فناوری", "هوش مصنوعی", "گوشی", "نرم‌افزار", "اپلیکیشن", "گوگل", "اپل", "اینترنت", "استارتاپ"],
    entities: ["گوگل", "اپل", "مایکروسافت", "متا", "OpenAI", "Anthropic"] },
  { id: "sport", name: "ورزشی", icon: "⚽", color: "orange",
    keywords: ["فوتبال", "تیم ملی", "لیگ", "بازیکن", "مربی", "گل", "قهرمان", "والیبال", "بسکتبال", "المپیک"],
    entities: ["فیفا"] },
];

function normalize(s: string): string {
  return s
    .replace(/[\u200C\u200B\u200D]/g, " ")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function countMatches(hay: string, needle: string): number {
  const n = normalize(needle);
  if (!n) return 0;
  let count = 0, idx = 0;
  while ((idx = hay.indexOf(n, idx)) !== -1) { count++; idx += n.length; }
  return count;
}

export type TopicScore = {
  score: number;
  level: "strong" | "medium" | "weak" | "none";
  matchedTerms: string[];
};

export function scoreArticleForTopic(article: Article, topic: Topic): TopicScore {
  try {
    const c: any = (article as any).content;
    const body = Array.isArray(c) ? c.join(" ") : (c || "");
    const titleN = normalize(article.title || "");
    const previewN = normalize(article.preview || "");
    const bodyN = normalize(body);
    const sourceN = normalize(`${article.source || ""} ${article.category || ""}`);
    let raw = 0;
    const matched: string[] = [];
    for (const kw of topic.keywords) {
      const total =
        countMatches(titleN, kw) * 3 +
        countMatches(previewN, kw) * 2 +
        countMatches(bodyN, kw);
      if (total > 0) { matched.push(kw); raw += total; }
    }
    for (const ent of topic.entities || []) {
      const total =
        countMatches(titleN, ent) * 3 +
        countMatches(previewN, ent) * 2 +
        countMatches(bodyN, ent);
      if (total > 0) { matched.push(ent); raw += total * 2; }
    }
    for (const src of topic.sources || []) {
      if (sourceN.includes(normalize(src))) raw += 3;
    }
    const score = raw === 0 ? 0 : Math.min(1, Math.log2(1 + raw) / 5);
    const level: TopicScore["level"] =
      score >= 0.55 ? "strong" : score >= 0.28 ? "medium" : score >= 0.08 ? "weak" : "none";
    return { score, level, matchedTerms: Array.from(new Set(matched)) };
  } catch (e) {
    console.error("scoreArticleForTopic error:", e);
    return { score: 0, level: "none", matchedTerms: [] };
  }
}

export function scoreAll(articles: Article[], topics: Topic[]): Map<string, TopicScore> {
  const out = new Map<string, TopicScore>();
  if (!topics.length) return out;
  for (const a of articles) {
    let best: TopicScore = { score: 0, level: "none", matchedTerms: [] };
    let allTerms: string[] = [];
    for (const t of topics) {
      const s = scoreArticleForTopic(a, t);
      if (s.score > best.score) best = s;
      allTerms = allTerms.concat(s.matchedTerms);
    }
    out.set(a.id, { ...best, matchedTerms: Array.from(new Set(allTerms)) });
  }
  return out;
}

export function topicColorClasses(c: TopicColor) {
  const map: Record<TopicColor, { bg: string; ring: string; mark: string; chip: string; bar: string }> = {
    indigo:  { bg: "bg-indigo-500",  ring: "ring-indigo-400",  mark: "bg-indigo-200/70 dark:bg-indigo-500/40 text-indigo-900 dark:text-indigo-100",  chip: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300",  bar: "bg-indigo-500" },
    violet:  { bg: "bg-violet-500",  ring: "ring-violet-400",  mark: "bg-violet-200/70 dark:bg-violet-500/40 text-violet-900 dark:text-violet-100",  chip: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",  bar: "bg-violet-500" },
    red:     { bg: "bg-red-500",     ring: "ring-red-400",     mark: "bg-red-200/70 dark:bg-red-500/40 text-red-900 dark:text-red-100",              chip: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",              bar: "bg-red-500" },
    emerald: { bg: "bg-emerald-500", ring: "ring-emerald-400", mark: "bg-emerald-200/70 dark:bg-emerald-500/40 text-emerald-900 dark:text-emerald-100", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300", bar: "bg-emerald-500" },
    amber:   { bg: "bg-amber-500",   ring: "ring-amber-400",   mark: "bg-amber-200/70 dark:bg-amber-500/40 text-amber-900 dark:text-amber-100",        chip: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",        bar: "bg-amber-500" },
    sky:     { bg: "bg-sky-500",     ring: "ring-sky-400",     mark: "bg-sky-200/70 dark:bg-sky-500/40 text-sky-900 dark:text-sky-100",                chip: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",                bar: "bg-sky-500" },
    rose:    { bg: "bg-rose-500",    ring: "ring-rose-400",    mark: "bg-rose-200/70 dark:bg-rose-500/40 text-rose-900 dark:text-rose-100",            chip: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",            bar: "bg-rose-500" },
    blue:    { bg: "bg-blue-500",    ring: "ring-blue-400",    mark: "bg-blue-200/70 dark:bg-blue-500/40 text-blue-900 dark:text-blue-100",            chip: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",            bar: "bg-blue-500" },
    orange:  { bg: "bg-orange-500",  ring: "ring-orange-400",  mark: "bg-orange-200/70 dark:bg-orange-500/40 text-orange-900 dark:text-orange-100",    chip: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",    bar: "bg-orange-500" },
  };
  return map[c];
}

export type FocusMode = "highlight" | "dim" | "filter";
export type Combinator = "or" | "and" | "not";

const ACTIVE_KEY = "topics.activeIds";
const MODE_KEY = "topics.focusMode";
const CUSTOM_KEY = "topics.custom";
const COMB_KEY = "topics.combinator";

export function loadCombinator(): Combinator {
  const v = localStorage.getItem(COMB_KEY) as Combinator | null;
  return v === "and" || v === "not" || v === "or" ? v : "or";
}
export function saveCombinator(c: Combinator) {
  try { localStorage.setItem(COMB_KEY, c); } catch {}
}

export function scoreAllPerTopic(
  articles: Article[],
  topics: Topic[],
): Map<string, Map<string, TopicScore>> {
  const out = new Map<string, Map<string, TopicScore>>();
  for (const a of articles) {
    const m = new Map<string, TopicScore>();
    for (const t of topics) m.set(t.id, scoreArticleForTopic(a, t));
    out.set(a.id, m);
  }
  return out;
}

export function combineForArticle(
  perTopic: Map<string, TopicScore> | undefined,
  topicIds: string[],
  combinator: Combinator,
): TopicScore {
  if (!perTopic || !topicIds.length) return { score: 0, level: "none", matchedTerms: [] };
  const scores = topicIds.map(id => perTopic.get(id) || { score: 0, level: "none" as const, matchedTerms: [] });
  if (combinator === "and") {
    if (scores.some(s => s.level === "none")) return { score: 0, level: "none", matchedTerms: [] };
    const minScore = Math.min(...scores.map(s => s.score));
    const terms = Array.from(new Set(scores.flatMap(s => s.matchedTerms)));
    const level: TopicScore["level"] =
      minScore >= 0.55 ? "strong" : minScore >= 0.28 ? "medium" : minScore >= 0.08 ? "weak" : "none";
    return { score: minScore, level, matchedTerms: terms };
  }
  if (combinator === "not") {
    if (scores.some(s => s.level !== "none")) return { score: 0, level: "none", matchedTerms: [] };
    return { score: 0.001, level: "weak", matchedTerms: [] };
  }
  let best = scores[0];
  const terms: string[] = [];
  for (const s of scores) { if (s.score > best.score) best = s; terms.push(...s.matchedTerms); }
  return { ...best, matchedTerms: Array.from(new Set(terms)) };
}

export const TOPIC_COLORS: TopicColor[] =
  ["indigo", "violet", "red", "emerald", "amber", "sky", "rose", "blue", "orange"];

export function loadCustomTopics(): Topic[] {
  try {
    const arr = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
    return Array.isArray(arr) ? arr.map(t => ({ ...t, custom: true })) : [];
  } catch { return []; }
}
export function saveCustomTopics(arr: Topic[]) {
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(arr)); } catch {}
}
export function newCustomTopic(): Topic {
  return {
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: "موضوع جدید",
    icon: "🎯",
    color: "indigo",
    keywords: [],
    entities: [],
    custom: true,
  };
}

export function loadActiveTopicIds(): string[] {
  try { return JSON.parse(localStorage.getItem(ACTIVE_KEY) || "[]"); } catch { return []; }
}
export function saveActiveTopicIds(ids: string[]) {
  try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(ids)); } catch {}
}
export function loadFocusMode(): FocusMode {
  const v = localStorage.getItem(MODE_KEY) as FocusMode | null;
  return v === "dim" || v === "filter" || v === "highlight" ? v : "highlight";
}
export function saveFocusMode(m: FocusMode) {
  try { localStorage.setItem(MODE_KEY, m); } catch {}
}
