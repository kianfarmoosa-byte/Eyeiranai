import { BadgeCheck, Clock, Eye, Megaphone, RefreshCw, Zap } from "lucide-react";
import type { Article } from "../../../data";
import { faNum, timeAgoFa } from "../utils/fa";

type Props = { article: Article; titleOverride?: string };

const VERIFIED_SOURCES = new Set([
  "بی‌بی‌سی فارسی", "روزنامه شرق", "همشهری آنلاین", "زومیت", "دیجیاتو", "ایسنا", "ایرنا",
]);
const SPONSORED_HINTS = ["رپورتاژ", "تبلیغ", "اسپانسر"];
const BREAKING_HINTS = ["فوری", "لحظه‌به‌لحظه", "همین‌الان"];

/**
 * Rich article header — source with verified check, byline avatar, publish/update times,
 * read-time, view-count estimate, and contextual badges (Breaking / Sponsored / Updated).
 */
export function DetailedArticleHeader({ article, titleOverride }: Props) {
  const verified = VERIFIED_SOURCES.has(article.source);
  const title = titleOverride || article.title || "";
  const isSponsored = SPONSORED_HINTS.some((w) => title.includes(w));
  const isBreaking = BREAKING_HINTS.some((w) => title.includes(w));
  const updatedAt =
    (article as any).updatedAt ?? // optional field
    (Number(article.publishedAt) && Date.now() - Number(article.publishedAt) < 2 * 3600_000
      ? Date.now() - 12 * 60_000
      : null);
  const isUpdated = !!updatedAt && Number(updatedAt) > Number(article.publishedAt ?? 0);
  const views = estimateViews(article);
  const author = article.author || "تحریریه";
  const initial = author.trim()[0] || "ک";

  return (
    <header className="mt-1">
      {/* badge row */}
      {(isBreaking || isSponsored || isUpdated) && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {isBreaking && (
            <Badge tone="bg-rose-500/12 text-rose-600 dark:text-rose-400 border-rose-500/20" icon={<Zap className="size-3" />}>
              فوری
            </Badge>
          )}
          {isUpdated && (
            <Badge tone="bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" icon={<RefreshCw className="size-3" />}>
              به‌روزرسانی شد
            </Badge>
          )}
          {isSponsored && (
            <Badge tone="bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/20" icon={<Megaphone className="size-3" />}>
              رپورتاژ آگهی
            </Badge>
          )}
        </div>
      )}

      {/* source row */}
      <div className="flex items-center gap-2">
        <span className="size-7 rounded-full bg-[var(--background-muted)] grid place-items-center text-[14px]" aria-hidden>
          {article.sourceIcon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-[12.5px] font-semibold leading-tight">
            <span className="truncate">{article.source}</span>
            {verified && (
              <BadgeCheck className="size-3.5 text-emerald-500 shrink-0" aria-label="تأیید‌شده" />
            )}
          </div>
          <div className="text-[11px] text-[var(--foreground-subtle)] leading-tight mt-0.5">
            {article.date} {article.publishedAt ? `· ${timeAgoFa(article.publishedAt)}` : ""}
          </div>
        </div>
      </div>

      {/* title */}
      <h1 className="mt-3 text-[22px] leading-tight font-black tracking-tight">{title}</h1>

      {/* byline + meta */}
      <div className="mt-3 flex items-center gap-2.5">
        <span className="size-8 rounded-full bg-gradient-to-br from-[var(--brand-500)] to-[var(--brand-700)] text-white grid place-items-center text-[12.5px] font-bold">
          {initial}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold leading-tight truncate">{author}</div>
          <div className="text-[10.5px] text-[var(--foreground-subtle)] mt-0.5">نویسنده</div>
        </div>
        <div className="flex items-center gap-2.5 text-[11px] text-[var(--foreground-muted)]">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {article.readTime}
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3.5" />
            {faNum(views)}
          </span>
        </div>
      </div>

      {isUpdated && updatedAt && (
        <div className="mt-2.5 text-[11px] text-emerald-600 dark:text-emerald-400">
          آخرین به‌روزرسانی: {timeAgoFa(updatedAt as number)}
        </div>
      )}
    </header>
  );
}

function Badge({
  children,
  icon,
  tone,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${tone}`}
    >
      {icon}
      {children}
    </span>
  );
}

function estimateViews(a: Article): number {
  const wordCount = ((a.content || "") + a.title).split(/\s+/).length;
  const hourSinceEpoch = Math.floor(Number(a.publishedAt || Date.now()) / 3600_000);
  const seed = (hourSinceEpoch ^ wordCount ^ a.id.length) & 0xffff;
  return 1200 + (seed % 18800);
}
