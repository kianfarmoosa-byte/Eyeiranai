import { useMemo } from "react";
import { GitCompare, BadgeCheck, ChevronLeft, Scale } from "lucide-react";
import { BottomSheet } from "../primitives/BottomSheet";
import { ImageWithFallback } from "../../figma/ImageWithFallback";
import { timeAgoFa, faNum } from "../utils/fa";
import { relatedTo } from "../utils/related";
import { summarize } from "../ai/summarize";
import type { Article } from "../../../data";

type Props = {
  open: boolean;
  onClose: () => void;
  article: Article | null;
  pool: Article[];
  onOpenArticle?: (a: Article) => void;
};

const TRUSTED = new Set(["بی‌بی‌سی فارسی", "روزنامه شرق", "همشهری آنلاین", "زومیت", "دیجیاتو", "ایسنا", "ایرنا"]);

export function CompareSourcesSheet({ open, onClose, article, pool, onOpenArticle }: Props) {
  const variants = useMemo(() => {
    if (!article) return [];
    const seen = new Set<string>([article.source]);
    const related = relatedTo(article, pool, 24);
    const out: Article[] = [];
    for (const r of related) {
      if (seen.has(r.source)) continue;
      seen.add(r.source);
      out.push(r);
      if (out.length >= 5) break;
    }
    return out;
  }, [article, pool]);

  const all = useMemo(() => (article ? [article, ...variants] : []), [article, variants]);
  const consensus = useMemo(() => computeConsensus(all), [all]);

  if (!article) return null;

  return (
    <BottomSheet open={open} onClose={onClose} snap="full">
      <header className="px-4 pt-1 pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <span className="size-9 rounded-full bg-violet-500/12 text-violet-500 grid place-items-center">
            <GitCompare className="size-4" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-bold leading-tight">مقایسهٔ منابع</h2>
            <p className="text-[11.5px] text-[var(--foreground-subtle)] mt-0.5 truncate">
              {variants.length > 0
                ? `این خبر در ${faNum(variants.length + 1)} منبع پوشش داده شده`
                : "خبر مشابهی در منابع دیگر پیدا نشد"}
            </p>
          </div>
        </div>

        {variants.length > 0 && (
          <div className="mt-3 rounded-[var(--radius-lg)] bg-[var(--background-muted)] border border-[var(--border-subtle)] p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--foreground-muted)] mb-2">
              <Scale className="size-3.5" />
              توافق گزارش‌ها
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex-1 h-2 rounded-full bg-[var(--background)] overflow-hidden flex">
                <span className="h-full bg-emerald-500" style={{ width: `${consensus.agree}%` }} />
                <span className="h-full bg-amber-500" style={{ width: `${consensus.partial}%` }} />
                <span className="h-full bg-rose-500"  style={{ width: `${consensus.diverge}%` }} />
              </div>
              <span className="text-[11px] tabular-nums font-bold">{faNum(consensus.agree)}٪</span>
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[10.5px] text-[var(--foreground-subtle)]">
              <Legend color="bg-emerald-500" label="اشتراک" />
              <Legend color="bg-amber-500"   label="نسبی" />
              <Legend color="bg-rose-500"    label="واگرا" />
            </div>
          </div>
        )}
      </header>

      <div className="px-3 py-3 overflow-y-auto" style={{ maxHeight: "70vh" }}>
        <ul className="flex flex-col gap-2.5">
          {all.map((a, i) => (
            <li key={a.id}>
              <button
                onClick={() => { if (onOpenArticle) { onOpenArticle(a); onClose(); } }}
                className={`w-full text-right rounded-[var(--radius-lg)] border p-3 tap press flex gap-3 ${
                  i === 0
                    ? "bg-[var(--brand-500)]/6 border-[var(--brand-500)]/30"
                    : "bg-[var(--card)] border-[var(--border-subtle)]"
                }`}
              >
                {a.image && (
                  <ImageWithFallback
                    src={a.image}
                    alt=""
                    className="size-16 rounded-md object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-1">
                    {i === 0 && (
                      <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--brand-500)] text-white">
                        مقاله فعلی
                      </span>
                    )}
                    <span className="text-[11.5px] font-semibold truncate">
                      {a.sourceIcon} {a.source}
                    </span>
                    {TRUSTED.has(a.source) && (
                      <BadgeCheck className="size-3.5 text-sky-500 shrink-0" />
                    )}
                    <span className="text-[10.5px] text-[var(--foreground-subtle)] mr-auto">
                      {timeAgoFa(a.publishedAt)}
                    </span>
                  </div>
                  <div className="text-[13px] font-semibold leading-snug line-clamp-2">
                    {a.title}
                  </div>
                  <div className="text-[11.5px] text-[var(--foreground-muted)] mt-1 line-clamp-2 leading-relaxed">
                    {summarize(a).tldr}
                  </div>
                  {i !== 0 && (
                    <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--brand-500)] font-semibold">
                      باز کردن این روایت
                      <ChevronLeft className="size-3" />
                    </div>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>

        {variants.length === 0 && (
          <p className="text-center text-[12px] text-[var(--foreground-subtle)] py-6 px-6">
            هیچ پوشش موازی برای این خبر در فید کنونی پیدا نشد. وقتی منابع دیگر هم این خبر را منتشر کنند، اینجا ظاهر می‌شود.
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`size-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function computeConsensus(all: Article[]) {
  if (all.length < 2) return { agree: 100, partial: 0, diverge: 0 };
  const baseTokens = tokenize(all[0].title + " " + (all[0].content || ""));
  let totalOverlap = 0;
  for (let i = 1; i < all.length; i++) {
    const t = tokenize(all[i].title + " " + (all[i].content || ""));
    totalOverlap += jaccard(baseTokens, t);
  }
  const avg = totalOverlap / (all.length - 1);
  const agree   = Math.round(avg * 100);
  const partial = Math.round((1 - avg) * 60);
  const diverge = Math.max(0, 100 - agree - partial);
  return { agree, partial, diverge };
}

function tokenize(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}
