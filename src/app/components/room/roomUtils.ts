// ════════════════════════════════════════════════════════════════════
// روم یوتیلز — محاسبات عملیاتی اتاق رصد روی جریان مقالات.
//   • تشخیص «موج» (افزایش ناگهانی حجم حول یک موضوع نسبت به خط پایه)
//   • سنجهٔ سرعت/شتاب و چرخش لحن
//   • استخراج موضوع/کلیدواژهٔ داغ
// همه سمت کلاینت اجرا می‌شود تا به صف پردازش پس‌زمینه وابسته نباشد.
// ════════════════════════════════════════════════════════════════════

import type { Article } from "../../data";
import { scoreArticle } from "../../sentiment";

export function articleMs(a: Article): number {
  const t = a.dateMs ?? (a.date ? Date.parse(a.date) : NaN);
  return isFinite(t) ? t : Date.now();
}

const STOP = new Set([
  "و","در","به","از","که","این","آن","را","با","بر","تا","است","هست","هستند",
  "بود","شد","شده","می","نمی","یک","های","ها","برای","یا","اگر","اما","هم","نیز",
  "کرد","کند","خواهد","باید","روی","بین","پس","چه","هر","تر","ترین","خود","دو",
  "the","a","an","of","to","in","on","for","and","is","are","was","were","with",
]);

function normalize(s: string): string {
  return (s || "")
    .replace(/[ً-ْٰ‌​‍]/g, " ")
    .replace(/[يى]/g, "ی").replace(/ك/g, "ک")
    .replace(/[.,،:;!?؟«»"'()\[\]{}…\-—–\/\\]/g, " ")
    .replace(/\s+/g, " ").toLowerCase().trim();
}

export function tokensOf(a: Article): string[] {
  return normalize(`${a.title} ${a.preview || ""}`)
    .split(" ")
    .filter(t => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t));
}

// ── خط پایه: میانگین حجم روزهای قبل ──
export type Wave = {
  term: string;
  current: number;      // تعداد در پنجرهٔ اخیر (windowH ساعت)
  baseline: number;     // میانگین همان بازه در روزهای قبل
  velocity: number;     // مطلب بر ساعت در پنجرهٔ اخیر
  acceleration: number; // نسبت نیمهٔ دوم به نیمهٔ اول پنجره
  factor: number;       // current / max(baseline, 1)
  toneNow: number;      // میانگین لحن پنجرهٔ اخیر (−۱..۱)
  tonePrev: number;     // میانگین لحن بازهٔ قبل
  toneShift: boolean;   // چرخش محسوس لحن به سمت منفی
  sample?: Article;
};

/**
 * تشخیص موج‌های در حال شکل‌گیری. برای هر کلیدواژهٔ پرتکرار در پنجرهٔ اخیر،
 * حجم فعلی را با خط پایهٔ روزهای قبل مقایسه می‌کند.
 */
export function detectWaves(articles: Article[], windowH = 6, baselineDays = 3): Wave[] {
  const now = Date.now();
  const winMs = windowH * 3600 * 1000;
  const winStart = now - winMs;
  const baseStart = now - baselineDays * 24 * 3600 * 1000;

  const recent = articles.filter(a => articleMs(a) >= winStart);
  const baseline = articles.filter(a => { const t = articleMs(a); return t >= baseStart && t < winStart; });
  if (recent.length === 0) return [];

  // فراوانی کلیدواژه در پنجرهٔ اخیر
  const recentFreq = new Map<string, Article[]>();
  for (const a of recent) {
    for (const t of new Set(tokensOf(a))) {
      if (!recentFreq.has(t)) recentFreq.set(t, []);
      recentFreq.get(t)!.push(a);
    }
  }
  // فراوانی خط پایه (نرمال‌شده به یک پنجره)
  const baseFreq = new Map<string, number>();
  const baseWindows = Math.max(1, (baselineDays * 24) / windowH);
  for (const a of baseline) {
    for (const t of new Set(tokensOf(a))) baseFreq.set(t, (baseFreq.get(t) || 0) + 1);
  }

  const waves: Wave[] = [];
  for (const [term, arts] of recentFreq) {
    const current = arts.length;
    if (current < 3) continue; // نویز را کنار بگذار
    const base = (baseFreq.get(term) || 0) / baseWindows;
    const factor = current / Math.max(base, 0.8);
    if (factor < 1.8) continue; // فقط جهش‌های معنادار

    // شتاب: نیمهٔ دوم پنجره نسبت به نیمهٔ اول
    const mid = winStart + winMs / 2;
    const firstHalf = arts.filter(a => articleMs(a) < mid).length;
    const secondHalf = current - firstHalf;
    const acceleration = secondHalf / Math.max(firstHalf, 1);

    // لحن اکنون vs قبل
    const toneNow = avgTone(arts);
    const prevArts = baseline.filter(a => tokensOf(a).includes(term));
    const tonePrev = prevArts.length ? avgTone(prevArts) : 0;
    const toneShift = tonePrev >= -0.1 && toneNow <= -0.25;

    waves.push({
      term, current, baseline: base,
      velocity: current / windowH,
      acceleration, factor,
      toneNow, tonePrev, toneShift,
      sample: arts.sort((a, b) => articleMs(b) - articleMs(a))[0],
    });
  }
  return waves.sort((a, b) => b.factor * b.acceleration - a.factor * a.acceleration).slice(0, 12);
}

function avgTone(arts: Article[]): number {
  if (arts.length === 0) return 0;
  let s = 0;
  for (const a of arts) s += scoreArticle(a).score;
  return s / arts.length;
}

// ── پیش‌بینی سادهٔ مسیر موج بر پایهٔ شتاب ──
export function predictWave(w: Wave): { label: string; growing: boolean } {
  if (w.acceleration >= 1.5 && w.factor >= 2.5)
    return { label: "احتمالاً در ساعات آینده بزرگ‌تر می‌شود", growing: true };
  if (w.acceleration >= 1.1)
    return { label: "در حال رشد آرام", growing: true };
  return { label: "در حال فروکش", growing: false };
}

// ── مطالب یک بازیگر/رقیب (تطبیق نام منبع) ──
export function articlesOfActor(articles: Article[], actor: string): Article[] {
  const q = normalize(actor);
  return articles
    .filter(a => normalize(a.source).includes(q))
    .sort((a, b) => articleMs(b) - articleMs(a));
}

// ── «سوژهٔ ازدست‌رفته»: موضوعاتی که رقبا پوشش داده‌اند و منبع ما نه ──
export function missedTopics(
  articles: Article[], actors: string[], mySources: string[], windowH = 12,
): { term: string; byActors: number; sample?: Article }[] {
  if (actors.length === 0) return [];
  const now = Date.now();
  const winStart = now - windowH * 3600 * 1000;
  const recent = articles.filter(a => articleMs(a) >= winStart);
  const mine = new Set(mySources.map(normalize));
  const actorSet = actors.map(normalize);

  const actorFreq = new Map<string, Article[]>();
  const mineTerms = new Set<string>();
  for (const a of recent) {
    const src = normalize(a.source);
    const isActor = actorSet.some(x => src.includes(x));
    const isMine = mine.size === 0 ? !isActor : [...mine].some(x => src.includes(x));
    for (const t of new Set(tokensOf(a))) {
      if (isActor) {
        if (!actorFreq.has(t)) actorFreq.set(t, []);
        actorFreq.get(t)!.push(a);
      }
      if (isMine) mineTerms.add(t);
    }
  }
  const out: { term: string; byActors: number; sample?: Article }[] = [];
  for (const [term, arts] of actorFreq) {
    if (arts.length < 2 || mineTerms.has(term)) continue;
    out.push({ term, byActors: arts.length, sample: arts[0] });
  }
  return out.sort((a, b) => b.byActors - a.byActors).slice(0, 10);
}
