import type { Article } from "./data";

export type EntityKind = "person" | "place" | "org" | "money" | "number" | "date";

export type Entity = {
  text: string;
  kind: EntityKind;
  count: number;
};

const PLACES = [
  "تهران", "اصفهان", "شیراز", "تبریز", "مشهد", "اهواز", "کرج", "قم", "رشت", "یزد",
  "ایران", "آمریکا", "روسیه", "چین", "ترکیه", "عراق", "افغانستان", "پاکستان",
  "عربستان", "امارات", "قطر", "اسرائیل", "فلسطین", "غزه", "لبنان", "سوریه", "یمن",
  "اروپا", "آلمان", "فرانسه", "انگلستان", "بریتانیا", "ژاپن", "کره", "هند",
  "خاورمیانه", "آسیا", "آفریقا", "خلیج فارس", "دریای خزر",
];

const ORGS = [
  "مجلس", "دولت", "وزارت", "سپاه", "ارتش", "نیروی انتظامی", "بانک مرکزی",
  "سازمان ملل", "ناتو", "اتحادیه اروپا", "اوپک", "آژانس", "دادگاه", "قوه قضاییه",
  "صداوسیما", "ایرنا", "گوگل", "اپل", "مایکروسافت", "متا", "تسلا", "آمازون",
  "اوبر", "اسپیس‌ایکس", "OpenAI", "Anthropic", "فیفا",
];

const MONEY_RE = /(\d{1,3}(?:[\.,]\d{3})*|\d+)\s*(تومان|ریال|دلار|یورو|پوند|درهم|روپیه|میلیارد|میلیون|هزار میلیارد)/g;
const NUM_RE = /\b(\d{4,}|\d{1,3}(?:[\.,]\d{3})+)\b/g;
const PERCENT_RE = /\b\d+(?:[.,]\d+)?\s*(?:%|درصد)/g;
const DATE_RE = /\b(?:\d{1,2}\s+)?(?:فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند|ژانویه|فوریه|مارس|آوریل|می|ژوئن|ژوئیه|اوت|سپتامبر|اکتبر|نوامبر|دسامبر)(?:\s+\d{2,4})?\b/g;
const PERSON_HINT_RE = /(?:آقای|خانم|دکتر|مهندس|استاد|پروفسور|سرلشکر|سرتیپ|سرهنگ|رئیس‌جمهور|نخست‌وزیر|وزیر|سخنگوی|نمایندهٔ?|دبیرکل)\s+([\u0600-\u06FF]+(?:\s[\u0600-\u06FF]+){0,2})/g;

function bump(map: Map<string, Entity>, text: string, kind: EntityKind) {
  const key = `${kind}:${text}`;
  const cur = map.get(key);
  if (cur) cur.count++;
  else map.set(key, { text, kind, count: 1 });
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countOccurrences(text: string, needle: string): number {
  if (!needle) return 0;
  let count = 0, idx = 0;
  const isPersian = (ch: string) => /[\u0600-\u06FF]/.test(ch);
  while ((idx = text.indexOf(needle, idx)) !== -1) {
    const before = idx > 0 ? text[idx - 1] : "";
    const after = text[idx + needle.length] || "";
    if (!isPersian(before) && !isPersian(after)) count++;
    idx += needle.length;
  }
  return count;
}

export function extractEntities(text: string): Entity[] {
  const map = new Map<string, Entity>();
  try {
    for (const p of PLACES) {
      const n = countOccurrences(text, p);
      for (let i = 0; i < n; i++) bump(map, p, "place");
    }
    for (const o of ORGS) {
      const n = countOccurrences(text, o);
      for (let i = 0; i < n; i++) bump(map, o, "org");
    }
    void escapeRe;
  let m: RegExpExecArray | null;
  PERSON_HINT_RE.lastIndex = 0;
  while ((m = PERSON_HINT_RE.exec(text)) != null) bump(map, m[1], "person");
  MONEY_RE.lastIndex = 0;
  while ((m = MONEY_RE.exec(text)) != null) bump(map, m[0], "money");
  PERCENT_RE.lastIndex = 0;
  while ((m = PERCENT_RE.exec(text)) != null) bump(map, m[0], "number");
  NUM_RE.lastIndex = 0;
  while ((m = NUM_RE.exec(text)) != null) bump(map, m[0], "number");
  DATE_RE.lastIndex = 0;
  while ((m = DATE_RE.exec(text)) != null) bump(map, m[0].trim(), "date");
  } catch (e) {
    console.error("extractEntities error:", e);
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export function entitiesForArticle(a: Article): Entity[] {
  const c: any = (a as any).content;
  const text = `${a.title} ${a.preview || ""} ${Array.isArray(c) ? c.join(" ") : (c || "")}`;
  return extractEntities(text);
}

export function entityKindLabel(k: EntityKind): string {
  return k === "person" ? "شخص" : k === "place" ? "مکان" : k === "org" ? "سازمان"
    : k === "money" ? "مبلغ" : k === "date" ? "تاریخ" : "عدد";
}

export function entityKindColor(k: EntityKind): string {
  return k === "person" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
    : k === "place" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
    : k === "org" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
    : k === "money" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
    : k === "date" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}
