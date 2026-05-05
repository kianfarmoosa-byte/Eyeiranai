import { Article } from "./data";

const POSITIVE = [
  "موفق", "موفقیت", "پیروزی", "پیروز", "رشد", "بهبود", "عالی", "خوب", "مثبت",
  "افزایش", "پیشرفت", "دستاورد", "برنده", "رکورد", "نوآوری", "خلاقیت", "امیدوار",
  "امید", "شادی", "خوشحال", "موافق", "تأیید", "تایید", "تقدیر", "ستایش", "تحسین",
  "صلح", "آرامش", "حمایت", "همکاری", "توافق", "همبستگی", "اتحاد", "افتخار",
  "برتر", "ممتاز", "درخشان", "موفقیت‌آمیز", "سودآور", "ارزشمند", "مفید", "کارآمد",
  "قوی", "محبوب", "پربازدید", "محبوبیت", "رضایت", "خرسند",
];

const NEGATIVE = [
  "شکست", "بحران", "سقوط", "کاهش", "افت", "ضعف", "بد", "منفی", "خطر", "تهدید",
  "حمله", "جنگ", "خشونت", "کشته", "زخمی", "مرگ", "تلفات", "نگران", "نگرانی",
  "اعتراض", "تظاهرات", "بیکاری", "تورم", "گرانی", "فقر", "فاجعه", "بلا",
  "زلزله", "سیل", "آتش‌سوزی", "تصادف", "حادثه", "آسیب", "صدمه", "خراب", "ویران",
  "نابود", "اخراج", "استعفا", "تحریم", "محکوم", "متهم", "متهمان", "جنایت", "قتل",
  "سرقت", "کلاهبرداری", "فساد", "رسوایی", "اختلاف", "تنش", "درگیری", "زیان",
  "ضرر", "ورشکست", "بحرانی", "خطرناک", "وخیم", "اسفناک", "تأسف", "تاسف",
];

const NEGATORS = ["نه", "نیست", "نبود", "نشد", "نخواهد", "بدون", "هیچ"];

function normalize(s: string): string {
  return s
    .replace(/[\u200C\u200B\u200D]/g, " ")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[^\u0600-\u06FF\sa-zA-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type SentimentScore = {
  score: number;
  label: "positive" | "negative" | "neutral";
  positives: number;
  negatives: number;
  confidence: number;
};

export function scoreText(text: string): SentimentScore {
  const tokens = normalize(text).split(" ");
  let pos = 0, neg = 0;
  const posSet = new Set(POSITIVE);
  const negSet = new Set(NEGATIVE);
  const negators = new Set(NEGATORS);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const prev = i > 0 ? tokens[i - 1] : "";
    const flipped = negators.has(prev);
    if (posSet.has(t)) flipped ? neg++ : pos++;
    else if (negSet.has(t)) flipped ? pos++ : neg++;
  }
  const total = pos + neg;
  const score = total === 0 ? 0 : (pos - neg) / total;
  const label: SentimentScore["label"] =
    score > 0.2 ? "positive" : score < -0.2 ? "negative" : "neutral";
  const confidence = Math.min(1, total / 6);
  return { score, label, positives: pos, negatives: neg, confidence };
}

export function scoreArticle(a: Article): SentimentScore {
  const c: any = (a as any).content;
  const text = `${a.title} ${a.preview || ""} ${Array.isArray(c) ? c.join(" ") : (c || "")}`;
  return scoreText(text);
}

export function sentimentEmoji(label: SentimentScore["label"]): string {
  return label === "positive" ? "🙂" : label === "negative" ? "😟" : "😐";
}

export function sentimentColor(label: SentimentScore["label"]): string {
  return label === "positive"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
    : label === "negative"
    ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
}

export function sentimentLabelFa(label: SentimentScore["label"]): string {
  return label === "positive" ? "مثبت" : label === "negative" ? "منفی" : "خنثی";
}

export function aggregateSentiment(articles: Article[]) {
  let pos = 0, neg = 0, neu = 0;
  let avg = 0;
  const scores = articles.map(a => {
    const s = scoreArticle(a);
    if (s.label === "positive") pos++;
    else if (s.label === "negative") neg++;
    else neu++;
    avg += s.score;
    return s;
  });
  return {
    positive: pos,
    negative: neg,
    neutral: neu,
    avgScore: scores.length ? avg / scores.length : 0,
    total: scores.length,
  };
}
