import { useMemo } from "react";
import { Flame } from "lucide-react";
import { ImageWithFallback } from "../../figma/ImageWithFallback";
import { timeAgoFa } from "../utils/fa";
import type { Article } from "../../../data";

type Props = {
  articles: Article[];
  onOpen: (a: Article) => void;
  /** Max stories to show. */
  limit?: number;
};

/**
 * Instagram-style "NEWS Stories" ribbon — full-bleed snap cards with hero image,
 * dark gradient, source pill, and large headline. Sits above the segmented control.
 */
export function NewsStoriesRibbon({ articles, onOpen, limit = 10 }: Props) {
  const stories = useMemo(() => {
    return articles
      .filter((a) => a.image)
      .slice(0, limit);
  }, [articles, limit]);

  if (stories.length === 0) return null;

  return (
    <section className="mt-2" dir="rtl">
      <header className="px-4 mb-2 flex items-center gap-1.5">
        <Flame className="size-4 text-rose-500" />
        <h3 className="text-[13px] font-bold">داستان‌های امروز</h3>
        <span className="text-[11px] text-[var(--foreground-subtle)]">· به‌روزرسانی زنده</span>
      </header>

      <div className="overflow-x-auto scrollbar-none snap-x snap-mandatory">
        <ul className="flex gap-3 px-4 pb-2">
          {stories.map((a, i) => (
            <li
              key={a.id}
              className="snap-start shrink-0 stagger-child"
              style={{ ["--i" as any]: i }}
            >
              <button
                onClick={() => onOpen(a)}
                className="relative w-[260px] h-[340px] rounded-[22px] overflow-hidden tap press text-right shadow-[var(--shadow-md)]"
              >
                <ImageWithFallback
                  src={a.image!}
                  alt={a.title}
                  className="absolute inset-0 size-full object-cover"
                />
                {/* gradient overlay */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.78) 100%)",
                  }}
                />
                {/* progress bar (decorative) */}
                <div className="absolute top-2.5 inset-x-2.5 h-[3px] flex gap-1">
                  {Array.from({ length: 3 }).map((_, k) => (
                    <span
                      key={k}
                      className={`flex-1 rounded-full ${
                        k === 0 ? "bg-white/95" : "bg-white/30"
                      }`}
                    />
                  ))}
                </div>

                {/* source pill */}
                <div className="absolute top-5 right-3 flex items-center gap-1.5 bg-black/45 backdrop-blur-sm px-2 py-1 rounded-full text-white text-[10.5px]">
                  <span>{a.sourceIcon}</span>
                  <span className="font-semibold">{a.source}</span>
                </div>

                {/* copy */}
                <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
                  <div className="text-[11px] opacity-85 mb-1.5">
                    {timeAgoFa(a.publishedAt)}
                    {a.category ? ` · ${a.category}` : ""}
                  </div>
                  <div className="text-[14.5px] font-bold leading-tight line-clamp-3 drop-shadow-[0_1px_8px_rgba(0,0,0,0.4)]">
                    {a.title}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
