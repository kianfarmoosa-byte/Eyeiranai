import { useMemo } from "react";
import { Clock, ArrowRight } from "lucide-react";
import { BottomSheet } from "../primitives/BottomSheet";
import { ImageWithFallback } from "../../figma/ImageWithFallback";
import { relatedTo } from "../utils/related";
import { faNum, timeAgoFa } from "../utils/fa";
import { summarize } from "../ai/summarize";
import type { Article } from "../../../data";

type Props = {
  open: boolean;
  onClose: () => void;
  article: Article | null;
  pool: Article[];
  onOpenArticle?: (a: Article) => void;
};

/**
 * Auto-generated chronological view of an unfolding event. Pulls related
 * articles, sorts by date, and renders a vertical timeline with a one-line AI
 * summary per node. The current article is highlighted.
 */
export function EventTimelineSheet({ open, onClose, article, pool, onOpenArticle }: Props) {
  const nodes = useMemo(() => {
    if (!article) return [];
    const related = relatedTo(article, pool, 12);
    const list = [article, ...related];
    // Dedup by id, sort oldest → newest for narrative flow
    const seen = new Set<string>();
    const unique = list.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
    return unique
      .filter((a) => a.dateMs)
      .sort((a, b) => (a.dateMs ?? 0) - (b.dateMs ?? 0))
      .slice(0, 10);
  }, [article, pool]);

  if (!article) return null;

  const span = nodes.length > 1 && nodes[0].dateMs && nodes[nodes.length - 1].dateMs
    ? Math.round((nodes[nodes.length - 1].dateMs! - nodes[0].dateMs!) / 3600_000)
    : 0;

  return (
    <BottomSheet open={open} onClose={onClose} title="خط زمانی رویداد" snap="full">
      <div className="px-4 pb-6">
        {/* Header */}
        <div className="rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--brand-500)]/10 to-[var(--brand-700)]/5 border border-[var(--brand-500)]/20 p-3.5 mb-4">
          <div className="flex items-center gap-2 text-[11.5px] text-[var(--foreground-muted)] mb-1">
            <Clock className="size-3.5 text-[var(--brand-500)]" />
            <span className="font-semibold">{faNum(nodes.length)} گزارش</span>
            {span > 0 && (
              <>
                <span>·</span>
                <span>
                  {span < 24 ? `${faNum(span)} ساعت` : `${faNum(Math.round(span / 24))} روز`} پوشش
                </span>
              </>
            )}
          </div>
          <div className="text-[13px] font-medium leading-snug">{article.title}</div>
        </div>

        {nodes.length === 0 ? (
          <div className="text-center text-[12px] text-[var(--foreground-subtle)] py-10">
            خط زمانی قابل ساخت نیست — این خبر منحصر به فرد است.
          </div>
        ) : (
          <ol className="relative">
            {/* Vertical line */}
            <div className="absolute top-2 bottom-2 right-[15px] w-px bg-[var(--border-strong)]" />

            {nodes.map((a, i) => {
              const isCurrent = a.id === article.id;
              const tldr = summarize(a).tldr;
              return (
                <li key={a.id} className="relative pe-10 pb-4 last:pb-0">
                  {/* Node dot */}
                  <span
                    className={`absolute right-2.5 top-1.5 size-3 rounded-full ring-4 ring-[var(--background)] ${
                      isCurrent ? "bg-[var(--brand-500)] scale-125" : "bg-[var(--border-strong)]"
                    }`}
                  />
                  <button
                    onClick={() => { if (onOpenArticle) onOpenArticle(a); }}
                    className={`w-full text-right rounded-[var(--radius-md)] p-3 tap press border transition-colors ${
                      isCurrent
                        ? "bg-[var(--brand-500)]/8 border-[var(--brand-500)]/30"
                        : "bg-[var(--card)] border-[var(--border-subtle)] active:bg-[var(--accent)]"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-[10.5px] text-[var(--foreground-subtle)] mb-1">
                      <span aria-hidden>{a.sourceIcon}</span>
                      <span className="truncate max-w-[120px]">{a.source}</span>
                      <span>·</span>
                      <span className="tabular-nums">{a.dateMs ? timeAgoFa(a.dateMs) : a.date}</span>
                      {isCurrent && (
                        <span className="ms-auto h-5 px-1.5 rounded-full bg-[var(--brand-500)] text-white text-[9.5px] font-bold inline-flex items-center">
                          فعلی
                        </span>
                      )}
                    </div>
                    <h4 className={`text-[13.5px] leading-snug line-clamp-2 ${isCurrent ? "font-bold" : "font-semibold"}`}>
                      {a.title}
                    </h4>
                    {tldr && (
                      <p className="mt-1 text-[11.5px] text-[var(--foreground-muted)] line-clamp-2 leading-relaxed">
                        {tldr}
                      </p>
                    )}
                    {a.image && (
                      <div className="mt-2 flex items-center gap-2">
                        <ImageWithFallback src={a.image} alt="" className="size-12 rounded-md object-cover" />
                        <span className="text-[11px] text-[var(--brand-500)] inline-flex items-center gap-0.5 mr-auto">
                          باز کن <ArrowRight className="size-3" />
                        </span>
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </BottomSheet>
  );
}
