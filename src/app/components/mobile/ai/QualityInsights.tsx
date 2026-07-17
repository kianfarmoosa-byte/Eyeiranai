import { useMemo } from "react";
import { ShieldCheck, AlertTriangle, Sparkles, ChevronLeft, BadgeCheck } from "lucide-react";
import type { Article } from "../../../data";
import { faNum } from "../utils/fa";

type Props = {
  article: Article;
  /** When omitted, score is derived heuristically from the article. */
  overrideScore?: number;
};

/**
 * "Article Quality Insights" — Persian RTL rebuild of the Figma card.
 * Surfaces: Overall Quality Score, Provenance, Why It Matters, source verified.
 * Score is computed locally (length + entities + image + readTime); swap for
 * a real model output when available.
 */
export function QualityInsights({ article, overrideScore }: Props) {
  const { score, breakdown, why, provenance } = useMemo(() => compute(article), [article]);
  const final = overrideScore ?? score;
  const grade = gradeOf(final);

  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--card)] overflow-hidden">
      <header className="px-3.5 py-3 flex items-center gap-2 border-b border-[var(--border-subtle)]">
        <span className="size-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 grid place-items-center text-white shadow-[var(--shadow-sm)]">
          <ShieldCheck className="size-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-semibold leading-tight">تحلیل کیفیت مقاله</div>
          <div className="text-[11px] text-[var(--foreground-subtle)] mt-0.5">ارزیابی هوشمند flow</div>
        </div>
        <ScorePill value={final} grade={grade} />
      </header>

      {/* Quality bars */}
      <div className="px-3.5 py-3.5 grid grid-cols-2 gap-x-3 gap-y-2.5">
        {breakdown.map((b) => (
          <Metric key={b.label} label={b.label} value={b.value} tone={b.tone} />
        ))}
      </div>

      {/* Provenance */}
      <div className="px-3.5 py-3 border-t border-[var(--border-subtle)] flex items-center gap-2.5">
        <span className={`size-8 rounded-full grid place-items-center ${provenance.ok ? "bg-emerald-500/12 text-emerald-500" : "bg-amber-500/12 text-amber-500"}`}>
          {provenance.ok ? <BadgeCheck className="size-4" /> : <AlertTriangle className="size-4" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold leading-tight">{provenance.ok ? "منبع راستی‌آزمایی شد" : "نیازمند راستی‌آزمایی"}</div>
          <div className="text-[11px] text-[var(--foreground-subtle)] mt-0.5 truncate">{provenance.detail}</div>
        </div>
        <ChevronLeft className="size-4 text-[var(--foreground-subtle)]" />
      </div>

      {/* Why it matters */}
      <div className="px-3.5 py-3 border-t border-[var(--border-subtle)] flex gap-2.5">
        <span className="size-8 rounded-full grid place-items-center bg-[var(--brand-500)]/12 text-[var(--brand-500)] shrink-0">
          <Sparkles className="size-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold leading-tight mb-1">چرا مهم است؟</div>
          <p className="text-[12.5px] leading-[1.85] text-[var(--foreground-muted)]">{why}</p>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────── */

function ScorePill({ value, grade }: { value: number; grade: { label: string; tone: string } }) {
  return (
    <div className={`px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 text-[11.5px] font-bold ${grade.tone}`}>
      <span className="tabular-nums">{faNum(value)}</span>
      <span className="opacity-70">·</span>
      <span>{grade.label}</span>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-[var(--foreground-muted)]">{label}</span>
        <span className="font-semibold tabular-nums">{faNum(value)}٪</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--background-muted)] overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

/* ── Heuristic quality scoring ─────────────────────────────────── */

const TRUSTED = new Set(["بی‌بی‌سی فارسی", "روزنامه شرق", "همشهری آنلاین", "زومیت", "دیجیاتو"]);
const SUSPECT_WORDS = ["شوکه", "باورنکردنی", "فاش شد", "بمبه"];

function compute(article: Article) {
  const text = `${article.title} ${article.content || ""}`;
  const words = text.split(/\s+/).filter(Boolean).length;

  const clarity = clamp(50 + Math.min(35, words / 12));
  const depth   = clamp(40 + Math.min(50, words / 10));
  const sources = TRUSTED.has(article.source) ? 88 : 62;
  const balance = SUSPECT_WORDS.some((w) => text.includes(w)) ? 48 : 78;
  const score   = Math.round((clarity + depth + sources + balance) / 4);

  return {
    score,
    breakdown: [
      { label: "شفافیت زبان",   value: clarity, tone: barTone(clarity) },
      { label: "عمق محتوا",     value: depth,   tone: barTone(depth) },
      { label: "اعتبار منبع",   value: sources, tone: barTone(sources) },
      { label: "موازنه دیدگاه", value: balance, tone: barTone(balance) },
    ],
    why: buildWhy(article),
    provenance: {
      ok: TRUSTED.has(article.source),
      detail: TRUSTED.has(article.source)
        ? `منبع ${article.source} از فهرست منابع تأییدشده flow`
        : `${article.source} هنوز در فهرست تأییدشده ثبت نشده`,
    },
  };
}

function gradeOf(v: number) {
  if (v >= 85) return { label: "عالی",      tone: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" };
  if (v >= 70) return { label: "خوب",       tone: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" };
  if (v >= 55) return { label: "متوسط",     tone: "bg-amber-500/12 text-amber-600 dark:text-amber-400" };
  return        { label: "نیاز به بررسی", tone: "bg-rose-500/12 text-rose-600 dark:text-rose-400" };
}

function barTone(v: number) {
  if (v >= 80) return "bg-emerald-500";
  if (v >= 65) return "bg-emerald-500";
  if (v >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

function clamp(n: number) { return Math.max(10, Math.min(98, Math.round(n))); }

function buildWhy(a: Article): string {
  const seed = a.category || a.source;
  const why: Record<string, string> = {
    "فناوری":   `این خبر در حوزهٔ ${a.category} می‌تواند بر تصمیم‌های روزانهٔ کاربران ابزارهای دیجیتال اثر بگذارد و روندهای آینده را شکل دهد.`,
    "اخبار":    "این رویداد به‌سرعت در حال تأثیرگذاری بر فضای عمومی است و فهم آن برای دنبال‌کردن تحولات بعدی کلیدی است.",
    "ورزش":     "نتیجه و پیامدهای این رخداد ورزشی می‌تواند روند هفته‌های آینده تیم/رشته را تعیین کند.",
    "فرهنگ":    "این پدیدهٔ فرهنگی نشانه‌ای از جریان‌های فکری و سلیقهٔ روز جامعه است.",
    "وبلاگ":    "نگاهی شخصی و عمیق‌تر به موضوع که از زاویه‌ای متفاوت از خبرهای رسمی مسئله را روشن می‌کند.",
  };
  return why[a.category] ?? `${seed} – این مقاله زمینهٔ لازم برای درک بهتر موضوع را در اختیار شما می‌گذارد.`;
}
