import type { NewsPack, PackSection, PackSource } from "../../api";

// ── option catalogs (shown in the builder UI) ──
export const CONTENT_TYPES: { id: string; label: string; icon: string }[] = [
  { id: "news", label: "خبری", icon: "📰" },
  { id: "analysis", label: "تحلیلی", icon: "🧭" },
  { id: "report", label: "گزارشی", icon: "📋" },
  { id: "opinion", label: "دیدگاه و یادداشت", icon: "✍️" },
  { id: "interview", label: "مصاحبه", icon: "🎙️" },
  { id: "tech", label: "فنی و تخصصی", icon: "⚙️" },
  { id: "science", label: "علمی", icon: "🔬" },
  { id: "business", label: "اقتصادی", icon: "📈" },
  { id: "sport", label: "ورزشی", icon: "⚽" },
  { id: "culture", label: "فرهنگ و هنر", icon: "🎭" },
  { id: "entertainment", label: "سرگرمی", icon: "🍿" },
  { id: "longread", label: "مقالهٔ بلند", icon: "📖" },
];
export const contentTypeMeta = (id: string) => CONTENT_TYPES.find((t) => t.id === id) || CONTENT_TYPES[0];

export const ITEM_LENGTHS: { id: string; label: string; hint: string }[] = [
  { id: "headline", label: "فقط تیتر", hint: "بدون خلاصه" },
  { id: "short", label: "کوتاه", hint: "یک جمله" },
  { id: "medium", label: "متوسط", hint: "۲ تا ۳ جمله" },
  { id: "long", label: "مفصل", hint: "یک پاراگراف" },
];
export const itemLengthMeta = (id: string) => ITEM_LENGTHS.find((l) => l.id === id) || ITEM_LENGTHS[1];

export const THEMES: { id: string; label: string; desc: string }[] = [
  { id: "editorial", label: "روزنامه‌ای", desc: "کلاسیک و رسمی با تیترهای پررنگ" },
  { id: "modern", label: "مدرن", desc: "کارت‌محور و رنگی" },
  { id: "minimal", label: "مینیمال", desc: "ساده و کم‌حاشیه" },
  { id: "magazine", label: "مجله‌ای", desc: "تصویری و لوکس" },
  { id: "brief", label: "خلاصهٔ اجرایی", desc: "فشرده و فهرست‌وار" },
];

export const TIMESPANS: { hours: number; label: string }[] = [
  { hours: 6, label: "۶ ساعت اخیر" },
  { hours: 12, label: "۱۲ ساعت اخیر" },
  { hours: 24, label: "۲۴ ساعت اخیر" },
  { hours: 48, label: "۲ روز اخیر" },
  { hours: 168, label: "۷ روز اخیر" },
];

export const SCHEDULES: { hours: number; label: string }[] = [
  { hours: 0, label: "دستی (بدون زمان‌بندی)" },
  { hours: 6, label: "هر ۶ ساعت" },
  { hours: 12, label: "هر ۱۲ ساعت" },
  { hours: 24, label: "روزانه" },
  { hours: 168, label: "هفتگی" },
];

// ── curated source library (drag onto sections) ──
// lang !== "fa" ⇒ content is auto-translated to Persian on generation.
export type LibrarySource = { name: string; url: string; icon: string; lang: string; sourceKind: string };
export type LibraryGroup = { id: string; label: string; icon: string; sources: LibrarySource[] };

export const SOURCE_LIBRARY: LibraryGroup[] = [
  {
    id: "fa-news", label: "خبرگزاری‌های فارسی", icon: "📰",
    sources: [
      { name: "ایسنا", url: "https://www.isna.ir/rss", icon: "🇮🇷", lang: "fa", sourceKind: "rss" },
      { name: "ایرنا", url: "https://www.irna.ir/rss", icon: "🇮🇷", lang: "fa", sourceKind: "rss" },
      { name: "خبرگزاری مهر", url: "https://www.mehrnews.com/rss", icon: "🇮🇷", lang: "fa", sourceKind: "rss" },
      { name: "تسنیم", url: "https://www.tasnimnews.com/fa/rss/feed/0/7/0", icon: "🇮🇷", lang: "fa", sourceKind: "rss" },
      { name: "همشهری آنلاین", url: "https://www.hamshahrionline.ir/rss", icon: "🇮🇷", lang: "fa", sourceKind: "rss" },
    ],
  },
  {
    id: "fa-tech", label: "فناوری فارسی", icon: "⚙️",
    sources: [
      { name: "زومیت", url: "https://www.zoomit.ir/feed/", icon: "💻", lang: "fa", sourceKind: "rss" },
      { name: "دیجیاتو", url: "https://digiato.com/feed", icon: "💻", lang: "fa", sourceKind: "rss" },
    ],
  },
  {
    id: "fa-sport", label: "ورزشی فارسی", icon: "⚽",
    sources: [
      { name: "ورزش سه", url: "https://www.varzesh3.com/rss/all", icon: "⚽", lang: "fa", sourceKind: "rss" },
    ],
  },
  {
    id: "intl-news", label: "خبری بین‌الملل", icon: "🌍",
    sources: [
      { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", icon: "🌐", lang: "en", sourceKind: "rss" },
      { name: "The Guardian – World", url: "https://www.theguardian.com/world/rss", icon: "🌐", lang: "en", sourceKind: "rss" },
      { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", icon: "🌐", lang: "en", sourceKind: "rss" },
      { name: "NYT – World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", icon: "🌐", lang: "en", sourceKind: "rss" },
    ],
  },
  {
    id: "intl-tech", label: "فناوری بین‌الملل", icon: "🚀",
    sources: [
      { name: "TechCrunch", url: "https://techcrunch.com/feed/", icon: "🚀", lang: "en", sourceKind: "rss" },
      { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", icon: "🚀", lang: "en", sourceKind: "rss" },
      { name: "Wired", url: "https://www.wired.com/feed/rss", icon: "🚀", lang: "en", sourceKind: "rss" },
      { name: "MIT Technology Review", url: "https://www.technologyreview.com/feed/", icon: "🚀", lang: "en", sourceKind: "rss" },
      { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", icon: "🚀", lang: "en", sourceKind: "rss" },
    ],
  },
  {
    id: "analysis", label: "تحلیلی و اندیشکده‌ها", icon: "🧭",
    sources: [
      { name: "Brookings", url: "https://www.brookings.edu/feed/", icon: "🏛️", lang: "en", sourceKind: "site" },
      { name: "Foreign Affairs", url: "https://www.foreignaffairs.com/rss.xml", icon: "🏛️", lang: "en", sourceKind: "site" },
      { name: "Project Syndicate", url: "https://www.project-syndicate.org/rss", icon: "🏛️", lang: "en", sourceKind: "site" },
      { name: "War on the Rocks", url: "https://warontherocks.com/feed/", icon: "🏛️", lang: "en", sourceKind: "site" },
    ],
  },
  {
    id: "business", label: "اقتصادی", icon: "📈",
    sources: [
      { name: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", icon: "💹", lang: "en", sourceKind: "rss" },
    ],
  },
  {
    id: "culture", label: "فرهنگ، علم و سرگرمی", icon: "🎭",
    sources: [
      { name: "The Atlantic", url: "https://www.theatlantic.com/feed/all/", icon: "📖", lang: "en", sourceKind: "site" },
      { name: "IGN", url: "https://feeds.ign.com/ign/all", icon: "🎮", lang: "en", sourceKind: "rss" },
    ],
  },
];

// flatten the source library into a compact catalog for semantic search.
export function libraryCatalog(): { name: string; url: string; icon: string; lang: string; group: string }[] {
  const out: { name: string; url: string; icon: string; lang: string; group: string }[] = [];
  for (const g of SOURCE_LIBRARY) {
    for (const s of g.sources) out.push({ name: s.name, url: s.url, icon: s.icon, lang: s.lang, group: g.label });
  }
  return out;
}

// ── scheduling helpers ──
// next scheduled run timestamp (ms), or null if scheduling is off.
export function nextRunAt(pack: { scheduleEveryHours: number; lastGeneratedAt?: number; createdAt?: number }): number | null {
  const every = pack.scheduleEveryHours || 0;
  if (every <= 0) return null;
  const base = pack.lastGeneratedAt || pack.createdAt || Date.now();
  return base + every * 3600 * 1000;
}

// human-friendly "in X" / "due now" label in Persian.
export function formatNextRun(ms: number | null): string {
  if (ms == null) return "زمان‌بندی خاموش است";
  const diff = ms - Date.now();
  if (diff <= 0) return "به‌زودی در اجرای بعدی";
  const toFaDigits = (s: string) => s.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `تا ${toFaDigits(String(mins))} دقیقهٔ دیگر`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `تا ${toFaDigits(String(hrs))} ساعت دیگر`;
  const days = Math.round(hrs / 24);
  return `تا ${toFaDigits(String(days))} روز دیگر`;
}

// ── constructors ──
let counter = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function librarySourceToPackSource(s: LibrarySource): PackSource {
  return { id: uid("src"), url: s.url, name: s.name, icon: s.icon, sourceKind: s.sourceKind, lang: s.lang };
}

export function newSection(order: number, over?: Partial<PackSection>): PackSection {
  return {
    id: uid("sec"),
    title: over?.title || "بخش تازه",
    contentType: over?.contentType || "news",
    itemLength: over?.itemLength || "short",
    maxItems: over?.maxItems ?? 5,
    keywords: over?.keywords || [],
    sources: over?.sources || [],
    order,
  };
}

export function newPack(): NewsPack {
  const now = Date.now();
  return {
    id: uid("np"),
    title: "بستهٔ خبری من",
    theme: "editorial",
    intro: "",
    timespanHours: 24,
    scheduleEveryHours: 0,
    sections: [
      newSection(0, { title: "تیترهای مهم", contentType: "news", itemLength: "short", maxItems: 5 }),
    ],
    createdAt: now,
    updatedAt: now,
  };
}

// ── starter templates (ready-made packs) ──
const lib = (groupId: string, names: string[]): PackSource[] => {
  const g = SOURCE_LIBRARY.find((x) => x.id === groupId);
  if (!g) return [];
  return names
    .map((n) => g.sources.find((s) => s.name === n))
    .filter((s): s is LibrarySource => !!s)
    .map(librarySourceToPackSource);
};

export type PackTemplate = { id: string; label: string; icon: string; desc: string; build: () => NewsPack };

export const PACK_TEMPLATES: PackTemplate[] = [
  {
    id: "blank", label: "بستهٔ خالی", icon: "📄", desc: "از صفر شروع کن",
    build: () => newPack(),
  },
  {
    id: "morning", label: "خلاصهٔ صبحگاهی", icon: "☕", desc: "مهم‌ترین اخبار روز در یک نگاه",
    build: () => {
      const p = newPack();
      p.title = "خلاصهٔ صبحگاهی";
      p.theme = "brief";
      p.intro = "مهم‌ترین رویدادهای ۲۴ ساعت گذشته.";
      p.timespanHours = 24;
      p.scheduleEveryHours = 24;
      p.sections = [
        newSection(0, { title: "تیترهای مهم", contentType: "news", itemLength: "short", maxItems: 6, sources: lib("fa-news", ["ایسنا", "ایرنا", "خبرگزاری مهر"]) }),
        newSection(1, { title: "اقتصاد و بازار", contentType: "business", itemLength: "short", maxItems: 4, sources: lib("business", ["CNBC"]) }),
        newSection(2, { title: "جهان", contentType: "news", itemLength: "short", maxItems: 4, sources: lib("intl-news", ["BBC World", "The Guardian – World"]) }),
      ];
      return p;
    },
  },
  {
    id: "tech", label: "رصد فناوری", icon: "🚀", desc: "تازه‌های فناوری داخل و خارج",
    build: () => {
      const p = newPack();
      p.title = "رصد فناوری";
      p.theme = "modern";
      p.intro = "جدیدترین اخبار و تحلیل‌های دنیای فناوری.";
      p.timespanHours = 48;
      p.scheduleEveryHours = 24;
      p.sections = [
        newSection(0, { title: "فناوری ایران", contentType: "tech", itemLength: "medium", maxItems: 5, sources: lib("fa-tech", ["زومیت", "دیجیاتو"]) }),
        newSection(1, { title: "فناوری جهان", contentType: "tech", itemLength: "medium", maxItems: 6, sources: lib("intl-tech", ["TechCrunch", "The Verge", "Wired"]) }),
        newSection(2, { title: "تحلیل عمیق", contentType: "analysis", itemLength: "long", maxItems: 3, sources: lib("intl-tech", ["MIT Technology Review", "Ars Technica"]) }),
      ];
      return p;
    },
  },
  {
    id: "intl", label: "دیدبان بین‌الملل", icon: "🌍", desc: "خبر و تحلیل جهانی با ترجمهٔ فارسی",
    build: () => {
      const p = newPack();
      p.title = "دیدبان بین‌الملل";
      p.theme = "editorial";
      p.intro = "مهم‌ترین تحولات جهانی همراه با تحلیل اندیشکده‌ها.";
      p.timespanHours = 48;
      p.scheduleEveryHours = 24;
      p.sections = [
        newSection(0, { title: "اخبار جهان", contentType: "news", itemLength: "medium", maxItems: 6, sources: lib("intl-news", ["BBC World", "The Guardian – World", "Al Jazeera", "NYT – World"]) }),
        newSection(1, { title: "تحلیل و اندیشکده", contentType: "analysis", itemLength: "long", maxItems: 4, sources: lib("analysis", ["Brookings", "Foreign Affairs", "Project Syndicate"]) }),
      ];
      return p;
    },
  },
];
