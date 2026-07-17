// Ready-made template library for the Content Studio, grouped by format:
// news card, story, post, and Twitter thread. Each preset is a fully-formed
// ContentTemplate (minus id/updatedAt) so it can be added to the user's
// templates with one tap, or opened in the editor for customization.

import type { ContentTemplate, StudioPlatform } from "../../../api";

export type TemplateFormat = "card" | "story" | "post" | "thread";

export const TEMPLATE_FORMATS: { id: TemplateFormat; label: string; emoji: string; desc: string }[] = [
  { id: "card",   label: "کارت خبری",     emoji: "🗞️", desc: "کارت مربعی برای کانال‌ها و اینستاگرام" },
  { id: "story",  label: "استوری",         emoji: "📲", desc: "عمودی ۹:۱۶ برای استوری اینستاگرام/تلگرام" },
  { id: "post",   label: "پست",            emoji: "🖼️", desc: "پست کامل با خلاصه، بولت و هشتگ" },
  { id: "thread", label: "ترد توییتری",    emoji: "🧵", desc: "رشته‌توییت شماره‌گذاری‌شده" },
];

export type TemplatePreset = Omit<ContentTemplate, "id" | "updatedAt"> & {
  format: TemplateFormat;
  /** Short description shown in the gallery card. */
  desc: string;
};

const P = (
  format: TemplateFormat,
  name: string,
  desc: string,
  platforms: StudioPlatform[],
  structure: string,
  opts: Partial<Pick<ContentTemplate, "maxLength" | "includeLink" | "includeSource" | "cardTheme" | "cardRatio">> = {},
): TemplatePreset => ({
  format,
  name,
  desc,
  platforms,
  structure: structure.trim(),
  maxLength: opts.maxLength ?? 0,
  includeLink: opts.includeLink ?? true,
  includeSource: opts.includeSource ?? true,
  cardTheme: opts.cardTheme ?? "dark",
  cardRatio: opts.cardRatio ?? "square",
});

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  // ── News cards ──────────────────────────────────────────────
  P(
    "card",
    "کارت تیتر داغ",
    "تیتر کوبنده + خلاصهٔ دوخطی، مناسب کانال‌ها",
    ["telegram", "bale", "rubika", "instagram"],
    `یک تیتر کوتاه و کوبنده از {{title}} بساز و با یک ایموجی مرتبط شروع کن.
سپس در حداکثر دو خط، جان کلام خبر را از {{summary}} بنویس.
لحن: خبری و فوری. در پایان در صورت وجود، {{source}} را ذکر کن و {{hashtags}} را اضافه کن.`,
    { maxLength: 400, cardTheme: "dark", cardRatio: "square" },
  ),
  P(
    "card",
    "کارت مجله‌ای",
    "لحن تحلیلی و طراحی مجله‌ای، مناسب اینستاگرام",
    ["instagram", "telegram"],
    `یک تیتر گیرا و اندکی ادبی از {{title}} بنویس.
یک پاراگراف کوتاه (۳ تا ۴ خط) که زمینه و اهمیت خبر را از {{summary}} شرح دهد.
لحن: تحلیلی و عمیق، بدون هیجان کاذب. در پایان {{source}} و {{hashtags}}.`,
    { maxLength: 600, cardTheme: "editorial", cardRatio: "square" },
  ),

  // ── Stories (9:16) ─────────────────────────────────────────
  P(
    "story",
    "استوری خبر فوری",
    "متن کوتاه و درشت با قلاب قوی برای استوری",
    ["instagram", "telegram"],
    `یک قلاب بسیار کوتاه و پرتنش از {{title}} (حداکثر ۶ کلمه) در خط اول بنویس.
سپس در یک یا دو جملهٔ کوتاه، مهم‌ترین نکتهٔ {{summary}} را بگو.
لحن: فوری و جذاب. یک فراخوان کوتاه مثل «جزئیات در بیو» اضافه کن. حداکثر چند هشتگ کلیدی از {{hashtags}}.`,
    { maxLength: 220, includeLink: false, cardTheme: "dark", cardRatio: "story" },
  ),
  P(
    "story",
    "استوری نقل‌قول",
    "برجسته‌سازی یک نقل‌قول یا آمار کلیدی",
    ["instagram"],
    `مهم‌ترین نقل‌قول یا عدد کلیدی مرتبط با {{title}} را از {{summary}} استخراج کن و به‌صورت یک جملهٔ برجسته و کوتاه بنویس.
زیر آن، منبع نقل‌قول یا {{source}} را در یک خط بیاور.
لحن: موجز و تأثیرگذار. بدون هشتگ زیاد.`,
    { maxLength: 200, includeLink: false, cardTheme: "editorial", cardRatio: "story" },
  ),

  // ── Posts ──────────────────────────────────────────────────
  P(
    "post",
    "پست تحلیلی",
    "قلاب + خلاصه + بولت‌های کلیدی + جمع‌بندی",
    ["instagram", "telegram", "bale"],
    `ساختار پست:
۱) یک خط قلاب برای {{title}}.
۲) یک پاراگراف کوتاه خلاصه از {{summary}}.
۳) ۳ تا ۴ بولت کلیدی از {{bullets}}.
۴) یک جملهٔ جمع‌بندی/پیامد.
در پایان {{source}}، {{link}} و {{hashtags}}. لحن: حرفه‌ای و روشن.`,
    { maxLength: 900, cardTheme: "light", cardRatio: "square" },
  ),
  P(
    "post",
    "پست خلاصهٔ روز",
    "چند خبر مهم در قالب فهرست کوتاه",
    ["telegram", "bale", "instagram"],
    `یک تیتر برای «مهم‌ترین‌های امروز» بساز.
سپس مهم‌ترین نکات {{summary}} و {{bullets}} را به‌صورت فهرست کوتاه با ایموجی بنویس (هر مورد یک خط).
لحن: سریع و مرورگونه. در پایان {{hashtags}}.`,
    { maxLength: 800, cardTheme: "dark", cardRatio: "square" },
  ),

  // ── Twitter threads ────────────────────────────────────────
  P(
    "thread",
    "ترد خبری ۵ توییتی",
    "رشته‌توییت شماره‌گذاری‌شده و خلاصه",
    ["twitter"],
    `یک رشته‌توییت (thread) از {{title}} بنویس.
توییت اول: قلاب قوی + خلاصهٔ یک‌خطی (با «🧵» در انتها).
توییت‌های بعدی: هر کدام یک نکته از {{summary}} و {{bullets}}، شماره‌گذاری به شکل «۲/» ، «۳/» و ...
هر توییت مستقل و زیر ۲۸۰ کاراکتر باشد. توییت پایانی: جمع‌بندی + {{source}} + {{link}}.`,
    { maxLength: 0, cardTheme: "dark", cardRatio: "wide" },
  ),
  P(
    "thread",
    "ترد تحلیلی",
    "تحلیل عمیق‌تر با زمینه و پیامدها",
    ["twitter"],
    `یک رشته‌توییت تحلیلی از {{title}} بنویس.
توییت ۱: چرا این خبر مهم است (قلاب).
توییت‌های میانی: زمینه، جزئیات کلیدی از {{summary}} و پیامدها؛ شماره‌گذاری «۲/»، «۳/» ...
لحن: تحلیلی و متوازن. هر توییت زیر ۲۸۰ کاراکتر. توییت آخر: نتیجه‌گیری + {{source}} + {{link}}.`,
    { maxLength: 0, cardTheme: "editorial", cardRatio: "wide" },
  ),
];

/** Convert a preset into a fresh ContentTemplate (empty id → server assigns one). */
export function presetToTemplate(p: TemplatePreset): ContentTemplate {
  return {
    id: "",
    name: p.name,
    platforms: p.platforms,
    structure: p.structure,
    maxLength: p.maxLength,
    includeLink: p.includeLink,
    includeSource: p.includeSource,
    cardTheme: p.cardTheme,
    cardRatio: p.cardRatio,
  };
}
