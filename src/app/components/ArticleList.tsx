import { Star, CheckCheck, RefreshCw, Filter, LayoutGrid, List, Newspaper, Share2, MoreHorizontal, Clock, ArrowDownAZ, ArrowUpZA, Calendar, Inbox } from "lucide-react";
import { useMemo, useEffect, useRef, useState } from "react";
import { Article } from "../data";
import { ImageWithFallback } from "./figma/ImageWithFallback";

const ROW_H = 64;
const VIRT_THRESHOLD = 80;

export type SortMode = 'newest' | 'oldest' | 'source';

type Props = {
  articles: Article[];
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  viewMode: 'cards' | 'list' | 'magazine';
  setViewMode: (v: 'cards' | 'list' | 'magazine') => void;
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

export function ArticleList({ articles, selectedId, setSelectedId, viewMode, setViewMode, title, toggleStar, sortMode = 'newest', setSortMode, onRefresh, onMarkAllRead, loading }: Props) {
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
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 min-w-0 min-h-0 h-full">
      <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center gap-2 sticky top-0 bg-white dark:bg-slate-950 z-10">
        <h2 className="flex-1">{title} <span className="text-slate-500 text-sm">({sorted.length} مقاله)</span></h2>
        <button onClick={onRefresh} disabled={loading} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50" title="بروزرسانی">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <button onClick={onMarkAllRead} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg" title="علامت‌گذاری همه به عنوان خوانده شده">
          <CheckCheck className="w-4 h-4" />
        </button>
        <button
          onClick={() => setSortMode?.(nextSort)}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-1 text-xs"
          title={`ترتیب: ${sortLabel}`}
        >
          <SortIcon className="w-4 h-4" />
        </button>
        <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg" title="فیلتر">
          <Filter className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
          <button onClick={() => setViewMode('cards')} className={`p-1.5 rounded ${viewMode === 'cards' ? 'bg-white dark:bg-slate-700 shadow-sm' : ''}`} title="کارت‌ها">
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm' : ''}`} title="لیست">
            <List className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('magazine')} className={`p-1.5 rounded ${viewMode === 'magazine' ? 'bg-white dark:bg-slate-700 shadow-sm' : ''}`} title="مجله">
            <Newspaper className="w-4 h-4" />
          </button>
        </div>
        <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
          <Share2 className="w-4 h-4" />
        </button>
        <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        {loading && articles.length === 0 && (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-6 py-3 flex items-start gap-3 animate-pulse">
                <div className="w-2 h-2 rounded-full mt-2 bg-slate-300 dark:bg-slate-700"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isEmpty && (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
            <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-700" />
            <div>مقاله‌ای یافت نشد</div>
            <div className="text-xs">خوراک اضافه کنید یا فیلترها را تغییر دهید</div>
          </div>
        )}

        {viewMode === 'list' && (
          virtualize ? (
            <div style={{ height: sorted.length * ROW_H, position: 'relative' }}>
              <div className="divide-y divide-slate-200 dark:divide-slate-800 absolute left-0 right-0" style={{ top: vRange.start * ROW_H }}>
                {sorted.slice(vRange.start, vRange.end).map(a => (
                  <div
                    key={a.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(a.id)}
                    style={{ height: ROW_H }}
                    data-aid={a.id}
                    className={`topic-row cursor-pointer w-full px-6 flex items-center gap-3 text-right hover:bg-slate-50 dark:hover:bg-slate-900 ${selectedId === a.id ? 'bg-blue-50 dark:bg-blue-950/30' : ''} ${a.read ? 'opacity-60' : ''}`}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${a.read ? 'bg-transparent' : 'bg-blue-500'}`}></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                        <span>{a.sourceIcon}</span>
                        <span className="truncate max-w-[120px]">{a.source}</span>
                        <span>•</span>
                        <span className="truncate max-w-[140px]">{a.date}</span>
                        <span>•</span>
                        <Clock className="w-3 h-3" />
                        <span>{a.readTime}</span>
                      </div>
                      <div className="truncate">{a.title}</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); toggleStar(a.id); }} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded">
                      <Star className={`w-4 h-4 ${a.starred ? 'fill-yellow-400 text-yellow-400' : 'text-slate-400'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {sorted.map(a => (
                <div
                  key={a.id}
                  ref={selectedId === a.id ? selectedRef : undefined}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(a.id)}
                  data-aid={a.id}
                  className={`topic-row cursor-pointer w-full px-6 py-3 flex items-start gap-3 text-right hover:bg-slate-50 dark:hover:bg-slate-900 ${selectedId === a.id ? 'bg-blue-50 dark:bg-blue-950/30' : ''} ${a.read ? 'opacity-60' : ''}`}
                >
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${a.read ? 'bg-transparent' : 'bg-blue-500'}`}></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <span>{a.sourceIcon}</span>
                      <span>{a.source}</span>
                      <span>•</span>
                      <span>{a.date}</span>
                      <span>•</span>
                      <Clock className="w-3 h-3" />
                      <span>{a.readTime}</span>
                    </div>
                    <div className="truncate">{a.title}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); toggleStar(a.id); }} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded">
                    <Star className={`w-4 h-4 ${a.starred ? 'fill-yellow-400 text-yellow-400' : 'text-slate-400'}`} />
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {viewMode === 'cards' && (
          <div className="p-6 grid gap-4 grid-cols-1 lg:grid-cols-2">
            {sorted.map(a => (
              <article
                key={a.id}
                data-aid={a.id}
                onClick={() => setSelectedId(a.id)}
                className={`topic-row cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden hover:shadow-lg transition ${selectedId === a.id ? 'ring-2 ring-blue-500' : ''} ${a.read ? 'opacity-70' : ''}`}
              >
                {a.image && (
                  <div className="h-44 overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <ImageWithFallback src={a.image} alt={a.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                    <span>{a.sourceIcon}</span>
                    <span>{a.source}</span>
                    <span>•</span>
                    <span>{a.date}</span>
                  </div>
                  <h3 className="mb-2 line-clamp-2">{a.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 mb-3">{a.preview}</p>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {a.readTime}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); toggleStar(a.id); }}>
                      <Star className={`w-4 h-4 ${a.starred ? 'fill-yellow-400 text-yellow-400' : 'text-slate-400'}`} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {viewMode === 'magazine' && (
          <div className="p-6 space-y-6">
            {sorted.map(a => (
              <article
                key={a.id}
                data-aid={a.id}
                onClick={() => setSelectedId(a.id)}
                className={`topic-row cursor-pointer flex gap-4 pb-6 border-b border-slate-200 dark:border-slate-800 ${a.read ? 'opacity-70' : ''}`}
              >
                {a.image && (
                  <div className="w-48 h-32 shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <ImageWithFallback src={a.image} alt={a.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                    <span>{a.sourceIcon} {a.source}</span>
                    <span>•</span>
                    <span>{a.author}</span>
                    <span>•</span>
                    <span>{a.date}</span>
                  </div>
                  <h3 className="mb-2">{a.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">{a.preview}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {a.readTime}</span>
                    <button onClick={(e) => { e.stopPropagation(); toggleStar(a.id); }}>
                      <Star className={`w-4 h-4 ${a.starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
