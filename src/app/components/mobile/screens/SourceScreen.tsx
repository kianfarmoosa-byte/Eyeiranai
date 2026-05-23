import { useMemo, useState } from "react";
import { Globe, Newspaper, Calendar, BookOpen } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { ArticleCard } from "../cards/ArticleCard";
import { EmptyState } from "../primitives/EmptyState";
import { faNum, countFa, timeAgoFa } from "../utils/fa";
import type { Article } from "../../../data";

type Sort = "latest" | "popular" | "oldest";

type Props = {
  source: string;
  articles: Article[];
  onClose: () => void;
  onOpen: (a: Article) => void;
  onToggleSave: (a: Article) => void;
  onLongPress?: (a: Article) => void;
};

/**
 * Drill-down view for a single source. Shows source meta (icon, total
 * articles, latest update), category mix, and the full archive sorted by
 * the user's choice.
 */
export function SourceScreen({ source, articles, onClose, onOpen, onToggleSave, onLongPress }: Props) {
  const items = useMemo(
    () => articles.filter((a) => a.source === source),
    [articles, source],
  );

  const [sort, setSort] = useState<Sort>("latest");

  const sorted = useMemo(() => {
    if (sort === "latest") return [...items].sort((a, b) => (b.dateMs ?? 0) - (a.dateMs ?? 0));
    if (sort === "oldest") return [...items].sort((a, b) => (a.dateMs ?? 0) - (b.dateMs ?? 0));
    // popular: items with image come first, then by date
    return [...items].sort((a, b) => {
      const wa = (a.image ? 1 : 0) + ((a.tags?.length ?? 0) * 0.1);
      const wb = (b.image ? 1 : 0) + ((b.tags?.length ?? 0) * 0.1);
      return wb - wa || (b.dateMs ?? 0) - (a.dateMs ?? 0);
    });
  }, [items, sort]);

  const sourceIcon = items[0]?.sourceIcon ?? "📰";
  const latest = items.reduce<number>((m, a) => Math.max(m, a.dateMs ?? 0), 0);
  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of items) m.set(a.category, (m.get(a.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  return (
    <MobileScreen topbar={<MobileTopBar title={source} subtitle={countFa(items.length, "مقاله")} onBack={onClose} />}>
      <div className="h-full overflow-y-auto scrollbar-none pb-6">
        {/* Hero */}
        <section className="px-4 pt-3">
          <div className="rounded-[var(--radius-xl)] bg-gradient-to-br from-[var(--brand-500)] to-[var(--brand-700)] text-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="size-14 rounded-full bg-white/20 grid place-items-center text-3xl shadow-inner">
                {sourceIcon}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[17px] font-black truncate">{source}</h2>
                <div className="text-[11.5px] text-white/85 mt-0.5 inline-flex items-center gap-1">
                  <Globe className="size-3" /> منبع خبری
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat icon={<Newspaper className="size-3.5" />} label="مقاله" value={faNum(items.length)} />
              <Stat icon={<Calendar className="size-3.5" />} label="آخرین" value={latest ? timeAgoFa(latest) : "—"} />
              <Stat icon={<BookOpen className="size-3.5" />} label="دسته" value={faNum(categories.length)} />
            </div>
          </div>
        </section>

        {/* Category mix */}
        {categories.length > 0 && (
          <section className="mt-4 px-3">
            <div className="text-[11.5px] font-semibold text-[var(--foreground-subtle)] mb-1.5 px-1">
              ترکیب دسته‌بندی
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.slice(0, 8).map(([name, n]) => (
                <span
                  key={name}
                  className="h-7 px-3 rounded-full bg-[var(--brand-500)]/10 text-[var(--brand-600)] text-[11.5px] font-semibold inline-flex items-center gap-1"
                >
                  {name} <span className="opacity-70 tabular-nums">{faNum(n)}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Sort + list */}
        <section className="mt-4">
          <div className="px-3 flex gap-2">
            {(["latest", "popular", "oldest"] as Sort[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`h-9 px-3.5 rounded-full text-[12.5px] tap press border ${
                  sort === s ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]"
                             : "bg-[var(--surface)] border-[var(--border-subtle)]"
                }`}
              >
                {s === "latest" ? "جدیدترین" : s === "oldest" ? "قدیمی‌ترین" : "محبوب‌ها"}
              </button>
            ))}
          </div>

          {sorted.length === 0 ? (
            <EmptyState
              icon={<Newspaper className="size-6" />}
              title="مقاله‌ای از این منبع موجود نیست"
              description="ممکن است هنوز چیزی منتشر نکرده باشد."
            />
          ) : (
            <div className="mt-3 px-3">
              <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-subtle)]">
                {sorted.map((a) => (
                  <ArticleCard key={a.id} article={a} onOpen={onOpen} onToggleSave={onToggleSave} onLongPress={onLongPress} />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </MobileScreen>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-white/12 backdrop-blur-sm p-2">
      <div className="text-[10px] inline-flex items-center gap-0.5 text-white/85">{icon} {label}</div>
      <div className="text-[15px] font-bold mt-0.5 tabular-nums truncate">{value}</div>
    </div>
  );
}
