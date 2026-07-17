import { useMemo, useState } from "react";
import { Search, SearchX, Flame, Sparkles, ChevronLeft, Hash } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { ArticleCard } from "../cards/ArticleCard";
import { EmptyState } from "../primitives/EmptyState";
import { ImageWithFallback } from "../../figma/ImageWithFallback";
import { categories, feeds, type Article } from "../../../data";
import { faNum, countFa, timeAgoFa } from "../utils/fa";

type Props = {
  articles: Article[];
  onOpen: (a: Article) => void;
  onToggleSave: (a: Article) => void;
  onPickCategory?: (name: string) => void;
  onLongPress?: (a: Article) => void;
};

// Tailwind gradient classes mapped to category id; falls back to brand.
const CAT_GRADIENT: Record<string, string> = {
  tech:    "from-emerald-500 to-emerald-600",
  news:    "from-rose-500 to-red-600",
  sport:   "from-emerald-500 to-teal-600",
  culture: "from-amber-500 to-orange-600",
  blog:    "from-fuchsia-500 to-purple-600",
};

export function DiscoverScreen({ articles, onOpen, onToggleSave, onPickCategory, onLongPress }: Props) {
  const [q, setQ] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Trending: top tags by frequency
  const trending = useMemo(() => {
    const f = new Map<string, number>();
    for (const a of articles) for (const t of a.tags ?? []) f.set(t, (f.get(t) ?? 0) + 1);
    return [...f.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [articles]);

  // Today's picks: latest 6 sorted by date desc
  const todaysPicks = useMemo(() => {
    return [...articles]
      .filter((a) => a.image)
      .sort((a, b) => (b.dateMs ?? 0) - (a.dateMs ?? 0))
      .slice(0, 6);
  }, [articles]);

  const cats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of articles) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    return categories.map((c) => ({ ...c, live: counts.get(c.name) ?? c.count }));
  }, [articles]);

  const list = useMemo(() => {
    let r = articles;
    if (activeTag) r = r.filter((a) => (a.tags ?? []).includes(activeTag));
    if (q.trim()) {
      const s = q.trim();
      r = r.filter((a) => a.title.includes(s) || a.preview.includes(s) || a.source.includes(s));
    }
    return r;
  }, [articles, activeTag, q]);

  const showResults = !!q.trim() || !!activeTag;

  return (
    <MobileScreen topbar={<MobileTopBar title="کاوش" subtitle="چی توی flow داغه؟" />}>
      <div className="h-full overflow-y-auto scrollbar-none pb-4">
        {/* Search */}
        <div className="px-4 pt-3 sticky top-0 z-[1] bg-[var(--background)] pb-2">
          <label className="flex items-center gap-2 h-11 px-3 rounded-full bg-[var(--background-muted)] border border-[var(--border-subtle)] focus-within:border-[var(--brand-500)] focus-within:bg-[var(--background)]">
            <Search className="size-4 text-[var(--foreground-subtle)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              inputMode="search"
              placeholder="جستجو در همه چیز..."
              className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-[var(--foreground-subtle)]"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="text-[11px] text-[var(--brand-500)] tap"
              >
                پاک کن
              </button>
            )}
          </label>
        </div>

        {showResults ? (
          <ResultsSection
            list={list}
            onOpen={onOpen}
            onToggleSave={onToggleSave}
            onLongPress={onLongPress}
            label={activeTag ? `نتایج برای #${activeTag}` : `نتایج برای «${q}»`}
            onClear={() => { setActiveTag(null); setQ(""); }}
          />
        ) : (
          <>
            <TodayStories items={todaysPicks} onOpen={onOpen} />
            <TrendingTags tags={trending} onPick={setActiveTag} />
            <TopicGrid cats={cats} onPick={(name) => onPickCategory ? onPickCategory(name) : setQ(name)} />
            <SourcesRail articles={articles} onPick={(name) => setQ(name)} />
          </>
        )}
      </div>
    </MobileScreen>
  );
}

/* ────────────────────────────────────────────────────────────── */

function ResultsSection({
  list, onOpen, onToggleSave, onLongPress, label, onClear,
}: {
  list: Article[]; onOpen: (a: Article) => void; onToggleSave: (a: Article) => void;
  onLongPress?: (a: Article) => void;
  label: string; onClear: () => void;
}) {
  return (
    <section className="mt-3 px-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[12.5px] text-[var(--foreground-subtle)]">{label}</span>
        <button onClick={onClear} className="text-[12px] text-[var(--brand-500)] tap">پاک کردن</button>
      </div>
      {list.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-6" />}
          title="نتیجه‌ای پیدا نشد"
          description="کلمات کلیدی دیگه‌ای امتحان کن یا تگ‌ها رو ببین."
        />
      ) : (
        <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-subtle)]">
          {list.map((a, i) => (
            <div key={a.id} style={{ ["--i" as string]: Math.min(i, 8) }} className="stagger-child">
              <ArticleCard article={a} onOpen={onOpen} onToggleSave={onToggleSave} onLongPress={onLongPress} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TodayStories({ items, onOpen }: { items: Article[]; onOpen: (a: Article) => void }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-4">
      <SectionHeader icon={<Sparkles className="size-4" />} title="خواندنی‌های امروز" hint="منتخب flow" />
      <div className="flex gap-3 overflow-x-auto scrollbar-none px-3 snap-x snap-mandatory pb-1">
        {items.map((a, i) => (
          <button
            key={a.id}
            onClick={() => onOpen(a)}
            style={{ ["--i" as string]: i }}
            className="stagger-child snap-start shrink-0 w-[78%] max-w-[300px] text-right tap press relative overflow-hidden rounded-[var(--radius-xl)]"
          >
            <ImageWithFallback src={a.image!} alt={a.title} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            <div className="relative aspect-[4/5] flex flex-col justify-end p-4 text-white">
              <div className="text-[11px] opacity-90 flex items-center gap-1.5">
                <span aria-hidden>{a.sourceIcon}</span>
                <span>{a.source}</span>
                {a.dateMs && <><span>·</span><span>{timeAgoFa(a.dateMs)}</span></>}
              </div>
              <h3 className="mt-1.5 text-[15.5px] font-bold leading-[1.5] line-clamp-3">{a.title}</h3>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function TrendingTags({ tags, onPick }: { tags: [string, number][]; onPick: (t: string) => void }) {
  if (tags.length === 0) return null;
  return (
    <section className="mt-5">
      <SectionHeader icon={<Flame className="size-4 text-rose-500" />} title="موضوعات داغ" />
      <div className="flex flex-wrap gap-2 px-4">
        {tags.map(([tag, n], i) => (
          <button
            key={tag}
            onClick={() => onPick(tag)}
            style={{ ["--i" as string]: i }}
            className="stagger-child h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-medium bg-[var(--background-muted)] border border-[var(--border-subtle)] tap press active:bg-[var(--accent)]"
          >
            <Hash className="size-3 text-[var(--brand-500)]" />
            <span>{tag}</span>
            <span className="text-[11px] text-[var(--foreground-subtle)] tabular-nums">{faNum(n)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

type Cat = { id: string; name: string; live: number };
function TopicGrid({ cats, onPick }: { cats: Cat[]; onPick: (name: string) => void }) {
  return (
    <section className="mt-6">
      <SectionHeader title="موضوعات" />
      <div className="px-3 grid grid-cols-2 gap-2.5">
        {cats.map((c, i) => (
          <button
            key={c.id}
            onClick={() => onPick(c.name)}
            style={{ ["--i" as string]: i }}
            className={`stagger-child relative overflow-hidden h-24 rounded-[var(--radius-xl)] tap press text-right bg-gradient-to-br ${CAT_GRADIENT[c.id] ?? "from-[var(--brand-400)] to-[var(--brand-600)]"}`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_55%)]" />
            <div className="relative h-full p-3.5 flex flex-col justify-between text-white">
              <div className="text-[13.5px] font-bold leading-tight">{c.name}</div>
              <div className="flex items-center justify-between text-[11px] opacity-95">
                <span>{countFa(c.live, "مقاله")}</span>
                <ChevronLeft className="size-4" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function SourcesRail({ articles, onPick }: { articles: Article[]; onPick: (name: string) => void }) {
  const counts = useMemo(() => {
    const map = new Map<string, { count: number; icon: string }>();
    for (const a of articles) {
      const cur = map.get(a.source) ?? { count: 0, icon: a.sourceIcon };
      cur.count += 1;
      map.set(a.source, cur);
    }
    return feeds.map((f) => ({
      id: f.id,
      name: f.name,
      icon: f.icon,
      count: map.get(f.name)?.count ?? f.count,
    }));
  }, [articles]);

  return (
    <section className="mt-6">
      <SectionHeader title="منابع" hint={countFa(counts.length, "منبع")} />
      <div className="flex gap-2 overflow-x-auto scrollbar-none px-3 pb-1">
        {counts.map((s, i) => (
          <button
            key={s.id}
            onClick={() => onPick(s.name)}
            style={{ ["--i" as string]: i }}
            className="stagger-child shrink-0 w-[120px] h-[88px] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] tap press p-3 text-right flex flex-col justify-between active:bg-[var(--accent)]"
          >
            <div className="text-[20px] leading-none">{s.icon}</div>
            <div>
              <div className="text-[12.5px] font-semibold truncate">{s.name}</div>
              <div className="text-[11px] text-[var(--foreground-subtle)] tabular-nums">{countFa(s.count, "مقاله")}</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function SectionHeader({ icon, title, hint }: { icon?: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="px-4 mb-2 flex items-center gap-1.5">
      {icon}
      <h3 className="text-[13.5px] font-semibold tracking-tight">{title}</h3>
      {hint && <span className="text-[11.5px] text-[var(--foreground-subtle)] mr-auto">{hint}</span>}
    </div>
  );
}
