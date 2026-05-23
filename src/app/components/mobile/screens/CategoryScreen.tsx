import { useMemo, useState } from "react";
import { Bookmark, Share2, Newspaper } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { ArticleCard } from "../cards/ArticleCard";
import { SwipeRow } from "../primitives/SwipeRow";
import { ChipScroller } from "../primitives/ChipScroller";
import { EmptyState } from "../primitives/EmptyState";
import { faNum, countFa, timeAgoFa } from "../utils/fa";
import { ImageWithFallback } from "../../figma/ImageWithFallback";
import type { Article } from "../../../data";

type Props = {
  category: string;
  articles: Article[];
  onClose: () => void;
  onOpen: (a: Article) => void;
  onToggleSave: (a: Article) => void;
  onLongPress?: (a: Article) => void;
};

type Sort = "latest" | "top" | "trending";

const GRADIENTS: Record<string, string> = {
  "فناوری":   "linear-gradient(160deg, #6366F1 0%, #1E1B4B 100%)",
  "اخبار":    "linear-gradient(160deg, #F43F5E 0%, #881337 100%)",
  "سیاست":    "linear-gradient(160deg, #DC2626 0%, #450A0A 100%)",
  "ورزش":     "linear-gradient(160deg, #10B981 0%, #064E3B 100%)",
  "فرهنگ":    "linear-gradient(160deg, #F59E0B 0%, #78350F 100%)",
  "تجارت":    "linear-gradient(160deg, #0EA5E9 0%, #0C4A6E 100%)",
  "جامعه":    "linear-gradient(160deg, #A855F7 0%, #4C1D95 100%)",
  "وبلاگ":    "linear-gradient(160deg, #EC4899 0%, #831843 100%)",
};

export function CategoryScreen({ category, articles, onClose, onOpen, onToggleSave, onLongPress }: Props) {
  const items = useMemo(
    () => articles.filter((a) => a.category === category),
    [articles, category],
  );

  const [sort, setSort] = useState<Sort>("latest");
  const [activeSource, setActiveSource] = useState<string | null>(null);

  const sources = useMemo(() => {
    const m = new Map<string, { count: number; icon: string }>();
    for (const a of items) {
      const cur = m.get(a.source) ?? { count: 0, icon: a.sourceIcon };
      cur.count++;
      m.set(a.source, cur);
    }
    return [...m.entries()].map(([id, v]) => ({ id, label: id, count: v.count, leading: <span>{v.icon}</span> }));
  }, [items]);

  const sorted = useMemo(() => {
    let r = items;
    if (activeSource) r = r.filter((a) => a.source === activeSource);
    const arr = [...r];
    if (sort === "latest")   arr.sort((a, b) => Number(b.publishedAt ?? 0) - Number(a.publishedAt ?? 0));
    if (sort === "top")      arr.sort((a, b) => (b.content?.length ?? 0) - (a.content?.length ?? 0));
    if (sort === "trending") arr.sort((a, b) => (b.title.length + (b.image ? 30 : 0)) - (a.title.length + (a.image ? 30 : 0)));
    return arr;
  }, [items, sort, activeSource]);

  const [hero, ...rest] = sorted;
  const gradient = GRADIENTS[category] ?? "linear-gradient(160deg, var(--brand-500) 0%, var(--brand-700) 100%)";
  const todayCount = useMemo(() => {
    const cutoff = Date.now() - 24 * 3600_000;
    return items.filter((a) => Number(a.publishedAt ?? 0) > cutoff).length;
  }, [items]);

  return (
    <MobileScreen
      topbar={<MobileTopBar title={category} subtitle={countFa(items.length, "مقاله")} onBack={onClose} />}
    >
      <div className="h-full overflow-y-auto scrollbar-none">
        {/* Hero header */}
        <div
          className="relative h-[160px] text-white overflow-hidden"
          style={{ background: gradient }}
        >
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: "radial-gradient(120% 80% at 20% 10%, rgba(255,255,255,0.25) 0%, transparent 60%)" }} />
          <div className="absolute inset-x-0 bottom-0 p-4 pb-5">
            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-2 py-1 rounded-full text-[10.5px] font-semibold mb-2">
              <Newspaper className="size-3" />
              دستهٔ خبری
            </div>
            <h1 className="text-[26px] font-black tracking-tight">{category}</h1>
            <div className="mt-1.5 text-[12px] text-white/85 flex items-center gap-3">
              <span>{faNum(items.length)} مقاله</span>
              <span>·</span>
              <span>{faNum(sources.length)} منبع</span>
              {todayCount > 0 && <><span>·</span><span>{faNum(todayCount)} امروز</span></>}
            </div>
          </div>
        </div>

        {/* Sort + source filter */}
        <div className="px-3 pt-3 pb-2 flex flex-col gap-2.5">
          <div className="inline-flex w-full rounded-full bg-[var(--background-muted)] p-0.5 text-[12.5px]">
            {([
              { id: "latest",   label: "تازه‌ترین" },
              { id: "top",      label: "برترین‌ها" },
              { id: "trending", label: "پربازدید" },
            ] as { id: Sort; label: string }[]).map((s) => (
              <button
                key={s.id}
                onClick={() => setSort(s.id)}
                className={`flex-1 h-9 rounded-full tap press transition-colors font-semibold ${
                  sort === s.id ? "bg-[var(--card)] shadow-[var(--shadow-sm)]" : "text-[var(--foreground-muted)]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {sources.length > 1 && (
            <ChipScroller items={sources} value={activeSource} onChange={setActiveSource} />
          )}
        </div>

        {/* Live ticker — latest 5 headlines */}
        {items.length > 3 && (
          <div className="px-3 pb-2">
            <div className="rounded-[var(--radius-lg)] bg-[var(--card)] border border-[var(--border-subtle)] p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-[11px] font-bold text-rose-500">زنده</span>
                <span className="text-[11px] text-[var(--foreground-subtle)]">· عناوین لحظه‌ای {category}</span>
              </div>
              <ul className="divide-y divide-[var(--border-subtle)]">
                {items.slice(0, 4).map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => onOpen(a)}
                      className="w-full text-right tap press flex items-start gap-2.5 py-2"
                    >
                      <span className="size-2 rounded-full bg-[var(--brand-500)] mt-2 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] leading-snug line-clamp-2 font-medium">{a.title}</div>
                        <div className="text-[10.5px] text-[var(--foreground-subtle)] mt-0.5">
                          {a.source} · {timeAgoFa(a.publishedAt)}
                        </div>
                      </div>
                      {a.image && (
                        <ImageWithFallback src={a.image} alt="" className="size-12 rounded-md object-cover shrink-0" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Articles */}
        <div className="px-3 pb-6 flex flex-col gap-3">
          {sorted.length === 0 && (
            <EmptyState title={`خبری در «${category}» نیست`} description="منبع‌های دیگر را امتحان کن یا بعداً سر بزن." />
          )}
          {hero && (
            <ArticleCard variant="hero" article={hero} onOpen={onOpen} onToggleSave={onToggleSave} onLongPress={onLongPress} />
          )}
          {rest.length > 0 && (
            <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-subtle)]">
              {rest.map((a) => (
                <SwipeRow
                  key={a.id}
                  startAction={{
                    label: a.starred ? "حذف" : "ذخیره",
                    icon: <Bookmark className="size-4" />,
                    color: "bg-[var(--brand-500)]",
                    onTrigger: () => onToggleSave(a),
                  }}
                  endAction={{
                    label: "اشتراک",
                    icon: <Share2 className="size-4" />,
                    color: "bg-emerald-500",
                    onTrigger: () => {
                      if (navigator.share) navigator.share({ title: a.title, url: a.link ?? location.href }).catch(() => {});
                    },
                  }}
                >
                  <ArticleCard article={a} onOpen={onOpen} onToggleSave={onToggleSave} onLongPress={onLongPress} />
                </SwipeRow>
              ))}
            </div>
          )}
        </div>
      </div>
    </MobileScreen>
  );
}
