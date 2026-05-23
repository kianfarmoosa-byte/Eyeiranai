import { ChevronLeft } from "lucide-react";
import type { Article } from "../../../data";
import { ImageWithFallback } from "../../figma/ImageWithFallback";
import { timeAgoFa } from "../utils/fa";

type Props = {
  items: Article[];
  onOpen: (a: Article) => void;
};

export function RelatedStrip({ items, onOpen }: Props) {
  if (!items.length) return null;
  return (
    <section className="mt-8 -mx-5">
      <div className="px-5 flex items-center justify-between mb-2.5">
        <h3 className="text-[14px] font-semibold tracking-tight">مرتبط با این مقاله</h3>
        <ChevronLeft className="size-4 text-[var(--foreground-subtle)]" />
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-none px-5 snap-x snap-mandatory pb-1">
        {items.map((a, i) => (
          <button
            key={a.id}
            onClick={() => onOpen(a)}
            style={{ ["--i" as string]: i }}
            className="stagger-child snap-start shrink-0 w-[68%] max-w-[260px] text-right tap press rounded-[var(--radius-lg)] overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface)]"
          >
            {a.image ? (
              <ImageWithFallback src={a.image} alt={a.title} className="w-full aspect-[16/10] object-cover" />
            ) : (
              <div className="w-full aspect-[16/10] bg-gradient-to-br from-[var(--brand-100)] to-[var(--brand-300)]" />
            )}
            <div className="p-3">
              <div className="text-[12.5px] font-semibold leading-[1.5] line-clamp-2">{a.title}</div>
              <div className="mt-1.5 text-[11px] text-[var(--foreground-subtle)] flex items-center gap-1.5">
                <span aria-hidden>{a.sourceIcon}</span>
                <span>{a.source}</span>
                {a.dateMs && <><span>·</span><span>{timeAgoFa(a.dateMs)}</span></>}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
