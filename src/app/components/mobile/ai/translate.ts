/**
 * Lightweight Persian ⇄ English "preview" translator. No backend — uses a small
 * dictionary of common headline words plus heuristic transliteration so the
 * reader can preview an article in another language without a network call.
 * The result is clearly marked as machine preview, not a real translation.
 */

const FA_EN: Record<string, string> = {
  // verbs / common
  "است": "is", "بود": "was", "شد": "became", "می‌شود": "becomes",
  "کرد": "did", "می‌کند": "does", "خواهد": "will", "گفت": "said",
  "اعلام": "announce", "اعلام کرد": "announced",
  // nouns
  "ایران": "Iran", "تهران": "Tehran", "آمریکا": "USA", "روسیه": "Russia",
  "چین": "China", "اسرائیل": "Israel", "اروپا": "Europe",
  "دولت": "government", "رئیس‌جمهور": "president", "وزیر": "minister",
  "مجلس": "parliament", "بانک": "bank", "اقتصاد": "economy",
  "خبر": "news", "گزارش": "report", "تحلیل": "analysis",
  "ورزش": "sports", "فوتبال": "football", "بازی": "match",
  "فناوری": "technology", "هوش مصنوعی": "AI", "اینترنت": "internet",
  "موبایل": "mobile", "اپل": "Apple", "گوگل": "Google", "مایکروسافت": "Microsoft",
  "شرکت": "company", "بازار": "market", "قیمت": "price",
  "نفت": "oil", "طلا": "gold", "ارز": "currency", "دلار": "dollar",
  "مردم": "people", "جامعه": "society", "فرهنگ": "culture",
  "هنر": "art", "سینما": "cinema", "فیلم": "film", "موسیقی": "music",
  "روز": "day", "هفته": "week", "ماه": "month", "سال": "year",
  "امروز": "today", "دیروز": "yesterday", "فردا": "tomorrow",
  "جدید": "new", "بزرگ": "big", "مهم": "important",
  "بحران": "crisis", "جنگ": "war", "صلح": "peace", "توافق": "agreement",
  // connectives
  "و": "and", "یا": "or", "در": "in", "از": "from", "به": "to",
  "با": "with", "بر": "on", "تا": "until", "که": "that", "این": "this",
  "آن": "that", "یک": "a", "هم": "also", "نیز": "also", "اما": "but",
  "اگر": "if", "چون": "because", "برای": "for",
};

const EN_FA: Record<string, string> = Object.fromEntries(
  Object.entries(FA_EN).map(([fa, en]) => [en.toLowerCase(), fa]),
);

function translateWord(word: string, dict: Record<string, string>): string {
  const clean = word.replace(/[«»،.\?!:؛()\[\]"']/g, "");
  if (!clean) return word;
  const hit = dict[clean] ?? dict[clean.toLowerCase()];
  return hit ? word.replace(clean, hit) : word;
}

export function translateText(text: string, to: "en" | "fa"): string {
  if (!text) return text;
  const dict = to === "en" ? FA_EN : EN_FA;
  return text
    .split(/(\s+)/)
    .map((tok) => (/\s+/.test(tok) ? tok : translateWord(tok, dict)))
    .join("");
}

export const TRANSLATION_DISCLAIMER_FA =
  "این پیش‌نمایش ترجمهٔ ماشینی (آفلاین) است و فقط برای درک سریع متن طراحی شده. برای متن دقیق، به منبع اصلی مراجعه کن.";

export const TRANSLATION_DISCLAIMER_EN =
  "Offline machine-preview translation — quick gist only. See the original source for accurate text.";
