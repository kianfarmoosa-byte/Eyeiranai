import { Star, CheckCheck, RefreshCw, Filter, LayoutGrid, List, Newspaper, Share2, MoreHorizontal, Clock, ArrowDownAZ, ArrowUpZA, Calendar, Inbox } from "lucide-react";
import { useMemo, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Article } from "../data";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Button, Badge, SegmentedControl, EmptyState, SkeletonRow } from "./kian";

const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.018, delayChildren: 0.04 } },
};
const listItem = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } },
};

const ROW_H = 68;
const VIRT_THRESHOLD = 80;

export type SortMode = 'newest' | 'oldest' | 'source';
type ViewMode = 'cards' | 'list' | 'magazine';

type Props = {
  articles: Article[];
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  title: string;
  toggleStar: (id: string) => void;
  sortMode?: SortMode;
  setSortMode?: (s: SortMode) => void;
  onRefresh?: () => void;
  onMarkAllRead?: () => void;
  loading?: boolean;
};

function parseDate(s: string): number {
  const t = new Date(s).getTime();
  return isNaN(t) ? 0 : t;
}

export function ArticleList({
  articles, selectedId, setSelectedId, viewMode, setViewMode, title,
  toggleStar, sortMode = 'newest', setSortMode, onRefresh, onMarkAllRead, loading,
}: Props) {
  const sorted = useMemo(() => {
    const arr = [...articles];
    if (sortMode === 'newest') arr.sort((a, b) => parseDate(b.date) - parseDate(a.date));
    else if (sortMode === 'oldest') arr.sort((a, b) => parseDate(a.date) - parseDate(b.date));
    else if (sortMode === 'source') arr.sort((a, b) => a.source.localeCompare(b.source, 'fa'));
    return arr;
  }, [articles, sortMode]);

  const selectedRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [vRange, setVRange] = useState({ start: 0, end: 60 });

  const virtualize = viewMode === 'list' && sorted.length > VIRT_THRESHOLD;

  useEffect(() => {
    if (!virtualize) {
      selectedRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const top = el.scrollTop;
      const h = el.clientHeight;
      const start = Math.max(0, Math.floor(top / ROW_H) - 8);
      const end = Math.min(sorted.length, Math.ceil((top + h) / ROW_H) + 8);
      setVRange({ start, end });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, [virtualize, sorted.length, selectedId]);

  useEffect(() => {
    if (!virtualize) return;
    const idx = sorted.findIndex(a => a.id === selectedId);
    if (idx < 0) return;
    const el = scrollRef.current;
    if (!el) return;
    const top = idx * ROW_H;
    if (top < el.scrollTop || top + ROW_H > el.scrollTop + el.clientHeight) {
      el.scrollTo({ top: top - el.clientHeight / 2, behavior: 'smooth' });
    }
  }, [selectedId, virtualize, sorted]);

  const SortIcon = sortMode === 'oldest' ? ArrowUpZA : sortMode === 'source' ? ArrowDownAZ : Calendar;
  const nextSort: SortMode = sortMode === 'newest' ? 'oldest' : sortMode === 'oldest' ? 'source' : 'newest';
  const sortLabel = sortMode === 'newest' ? 'جدیدترین' : sortMode === 'oldest' ? 'قدیمی‌ترین' : 'بر اساس منبع';
  const isEmpty = !loading && sorted.length === 0;

  return (
    <div className="flex-1 flex flex-col bg-[var(--background)] text-[var(--foreground)] min-w-0 min-h-0 h-full">
      <header className="border-b border-[var(--border)] px-6 py-3 flex items-center gap-2 sticky top-0 z-[var(--z-sticky)]
                         bg-[var(--background)]/85 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/70">
        <div className="flex-1 flex items-baseline gap-2 min-w-0">
          <h2 className="text-display text-[17px] font-semibold tracking-tight truncate">{title}</h2>
          <Badge tone="neutral" variant="soft" size="xs">{sorted.length.toLocaleString("fa-IR")}</Badge>
        </div>

        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading} title="بروزرسانی"
          iconLeading={<RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />} />
        <Button variant="ghost" size="sm" onClick={onMarkAllRead} title="علامت‌گذاری همه به عنوان خوانده شده"
          iconLeading={<CheckCheck className="size-4" />} />
        <Button variant="ghost" size="sm" onClick={() => setSortMode?.(nextSort)} title={`ترتیب: ${sortLabel}`}
          iconLeading={<SortIcon className="size-4" />} />
        <Button variant="ghost" size="sm" title="فیلتر" iconLeading={<Filter className="size-4" />} />

        <div className="w-px h-6 bg-[var(--border)] mx-1" />

        <SegmentedControl<ViewMode>
          value={viewMode}
          onChange={setViewMode}
          items={[
            { value: 'list',     label: 'لیست',  icon: <List className="size-3" /> },
            { value: 'cards',    label: 'کارت',  icon: <LayoutGrid className="size-3" /> },
            { value: 'magazine', label: 'مجله',  icon: <Newspaper className="size-3" /> },
          ]}
        />

        <Button variant="ghost" size="sm" iconLeading={<Share2 className="size-4" />} />
        <Button variant="ghost" size="sm" iconLeading={<MoreHorizontal className="size-4" />} />
      </header>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        {loading && articles.length === 0 && (
          <div>{Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}</div>
        )}

        {isEmpty && (
          <EmptyState
            size="lg"
            icon={<Inbox className="size-full" />}
            title="مقاله‌ای یافت نشد"
            description="یک خوراک اضافه کنید یا فیلترها را برای دیدن نتایج تغییر دهید."
          />
        )}

        {viewMode === 'list' && (
          virtualize ? (
            <div style={{ height: sorted.length * ROW_H, position: 'relative' }}>
              <div className="absolute left-0 right-0" style={{ top: vRange.start * ROW_H }}>
                {sorted.slice(vRange.start, vRange.end).map(a => (
                  <ListRow key={a.id} a={a} selected={selectedId === a.id} h={ROW_H}
                    onClick={() => setSelectedId(a.id)}
                    onStar={() => toggleStar(a.id)} />
                ))}
              </div>
            </div>
          ) : (
            <motion.div variants={listContainer} initial="hidden" animate="show">
              {sorted.map(a => (
                <motion.div key={a.id} variants={listItem}>
                  <ListRow a={a} selected={selectedId === a.id}
                    refEl={selectedId === a.id ? selectedRef : undefined}
                    onClick={() => setSelectedId(a.id)}
                    onStar={() => toggleStar(a.id)} />
                </motion.div>
              ))}
            </motion.div>
          )
        )}

        {viewMode === 'cards' && (
          <motion.div variants={listContainer} initial="hidden" animate="show"
            className="p-6 grid gap-5 grid-cols-1 lg:grid-cols-2">
            {sorted.map(a => (
              <motion.article variants={listItem} key={a.id} data-aid={a.id} onClick={() => setSelectedId(a.id)}
                className={`topic-row cursor-pointer surface rounded-[var(--radius-xl)] overflow-hidden
                            transition-[transform,box-shadow,border-color] duration-[var(--duration-normal)] ease-[var(--ease-out-quart)]
                            hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)] hover:border-[var(--border-strong)]
                            ${selectedId === a.id ? 'ring-2 ring-[var(--brand-500)]' : ''} ${a.read ? 'opacity-70' : ''}`}>
                {a.image && (
                  <div className="h-44 overflow-hidden bg-[var(--muted)]">
                    <ImageWithFallback src={a.image} alt={a.title}
                      className="w-full h-full object-cover transition-transform duration-[var(--duration-slow)] hover:scale-[1.03]" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2 text-[11px] text-[var(--foreground-subtle)] mb-2">
                    <span>{a.sourceIcon}</span>
                    <span className="font-medium text-[var(--foreground-muted)]">{a.source}</span>
                    <span className="text-[var(--border-strong)]">·</span>
                    <span className="tabular-nums">{a.date}</span>
                  </div>
                  <h3 className="text-display text-[16px] font-semibold leading-snug mb-2 line-clamp-2 tracking-tight">{a.title}</h3>
                  <p className="text-[13px] text-[var(--foreground-muted)] line-clamp-3 mb-3 leading-relaxed">{a.preview}</p>
                  <div className="flex items-center justify-between text-[11px] text-[var(--foreground-subtle)]">
                    <span className="flex items-center gap-1 tabular-nums">
                      <Clock className="size-3" /> {a.readTime}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); toggleStar(a.id); }}
                      className="p-1 -m-1 rounded hover:bg-[var(--accent)] transition">
                      <Star className={`size-4 ${a.starred ? 'fill-[var(--warning-500)] text-[var(--warning-500)]' : 'text-[var(--foreground-subtle)]'}`} />
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </motion.div>
        )}

        {viewMode === 'magazine' && (
          <motion.div variants={listContainer} initial="hidden" animate="show"
            className="p-6 space-y-6 max-w-3xl mx-auto">
            {sorted.map(a => (
              <motion.article variants={listItem} key={a.id} data-aid={a.id} onClick={() => setSelectedId(a.id)}
                className={`topic-row cursor-pointer flex gap-5 pb-6 border-b border-[var(--border-subtle)]
                            transition-opacity duration-[var(--duration-fast)]
                            ${a.read ? 'opacity-65 hover:opacity-100' : ''}`}>
                {a.image && (
                  <div className="w-52 h-36 shrink-0 rounded-[var(--radius-lg)] overflow-hidden bg-[var(--muted)] ring-1 ring-[var(--border-subtle)]">
                    <ImageWithFallback src={a.image} alt={a.title}
                      className="w-full h-full object-cover transition-transform duration-[var(--duration-slow)] hover:scale-[1.03]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[11px] text-[var(--foreground-subtle)] mb-2">
                    <span className="font-medium text-[var(--foreground-muted)]">{a.sourceIcon} {a.source}</span>
                    <span className="text-[var(--border-strong)]">·</span>
                    <span>{a.author}</span>
                    <span className="text-[var(--border-strong)]">·</span>
                    <span className="tabular-nums">{a.date}</span>
                  </div>
                  <h3 className="text-display text-[20px] font-semibold leading-tight mb-2 tracking-tight">{a.title}</h3>
                  <p className="text-[13.5px] text-[var(--foreground-muted)] line-clamp-2 mb-3 leading-relaxed">{a.preview}</p>
                  <div className="flex items-center gap-4 text-[11px] text-[var(--foreground-subtle)]">
                    <span className="flex items-center gap-1 tabular-nums">
                      <Clock className="size-3" /> {a.readTime}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); toggleStar(a.id); }}>
                      <Star className={`size-4 ${a.starred ? 'fill-[var(--warning-500)] text-[var(--warning-500)]' : 'text-[var(--foreground-subtle)]'}`} />
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ── Internal: list-row variant (editorial dense) ────────────────── */

function ListRow({ a, selected, h, onClick, onStar, refEl }: {
  a: Article;
  selected: boolean;
  h?: number;
  onClick: () => void;
  onStar: () => void;
  refEl?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={refEl as any}
      role="button"
      tabIndex={0}
      onClick={onClick}
      data-aid={a.id}
      style={h ? { height: h } : undefined}
      className={`topic-row group cursor-pointer w-full px-6 py-3 flex items-start gap-3 text-right
                  border-b border-[var(--border-subtle)]
                  transition-colors duration-[var(--duration-fast)]
                  hover:bg-[var(--background-subtle)]
                  ${selected ? 'bg-[var(--brand-50)] dark:bg-[oklch(0.30_0.10_258_/_0.4)]' : ''}
                  ${a.read ? 'opacity-65 hover:opacity-100' : ''}`}>
      <div className={`size-1.5 rounded-full mt-2.5 shrink-0 ${a.read ? 'bg-transparent' : 'bg-[var(--brand-500)] shadow-[0_0_8px_var(--brand-500)]'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--foreground-subtle)] mb-1">
          <span>{a.sourceIcon}</span>
          <span className="truncate max-w-[140px] font-medium text-[var(--foreground-muted)]">{a.source}</span>
          <span className="text-[var(--border-strong)]">·</span>
          <span className="truncate max-w-[160px] tabular-nums">{a.date}</span>
          <span className="text-[var(--border-strong)]">·</span>
          <span className="flex items-center gap-0.5 tabular-nums"><Clock className="size-3" />{a.readTime}</span>
        </div>
        <div className={`truncate text-[13.5px] leading-snug ${selected ? 'font-semibold' : 'font-normal'}
                         group-hover:text-[var(--brand-600)] dark:group-hover:text-[var(--brand-300)] transition-colors`}>
          {a.title}
        </div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onStar(); }}
        className="p-1 -m-1 rounded hover:bg-[var(--accent)] transition">
        <Star className={`size-4 ${a.starred ? 'fill-[var(--warning-500)] text-[var(--warning-500)]' : 'text-[var(--foreground-subtle)]'}`} />
      </button>
    </div>
  );
}
