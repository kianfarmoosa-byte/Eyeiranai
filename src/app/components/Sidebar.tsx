import { Search, Rss, FileText, Star, Circle, Settings, Plus, TrendingUp, Bookmark, Tag, FileUp, ChevronDown, ChevronLeft, RefreshCw, AlertTriangle, Trash2, Network, Globe2, BarChart3, Sunrise, Command, Sparkles, Filter, Brain, NotebookPen, Clock, Pin, X, Wand2, Radar, Package, MonitorDot } from "lucide-react";
import { useMemo, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { type Topic, topicColorClasses } from "../topics";

export type SidebarFeed = { id: string; name: string; count: number; icon: string; category: string };
export type PinnedTopic = { topic: Topic; count: number; active: boolean };

type Props = {
  activeView: string;
  setActiveView: (v: string) => void;
  selectedFeed: string | null;
  setSelectedFeed: (id: string | null) => void;
  selectedCategory: string | null;
  setSelectedCategory: (c: string | null) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  feeds: SidebarFeed[];
  onAddFeed: () => void;
  onRefresh: () => void;
  loading: boolean;
  totals: { all: number; unread: number; starred: number; saved: number };
  search: string;
  setSearch: (s: string) => void;
  lastRefresh: Date | null;
  feedStatus?: Record<string, { ok: boolean; error?: string }>;
  onOpenOpml?: () => void;
  onRemoveFeed?: (id: string) => void;
  onOpenStats?: () => void;
  onOpenDigest?: () => void;
  onOpenPalette?: () => void;
  onOpenSourceHub?: () => void;
  onOpenSavedSearches?: () => void;
  onOpenKnowledge?: () => void;
  onOpenNotes?: () => void;
  onOpenTimeline?: () => void;
  onOpenStudio?: () => void;
  pinnedTopics?: PinnedTopic[];
  onToggleTopic?: (id: string) => void;
  onClearTopics?: () => void;
  onAddTopic?: () => void;
  socialUnread?: number;
};

export function Sidebar({
  activeView, setActiveView, selectedFeed, setSelectedFeed,
  selectedCategory = null, setSelectedCategory = () => {},
  theme, onToggleTheme, feeds, onAddFeed, onRefresh, loading,
  totals = { all: 0, unread: 0, starred: 0, saved: 0 },
  search = "", setSearch = () => {}, lastRefresh = null,
  feedStatus = {}, onOpenOpml = () => {}, onRemoveFeed, onOpenHelp, onOpenRules,
  onOpenStats, onOpenDigest, onOpenPalette, onOpenSourceHub, onOpenSavedSearches, onOpenKnowledge, onOpenNotes, onOpenTimeline, onOpenStudio,
  pinnedTopics = [], onToggleTopic, onClearTopics, onAddTopic, socialUnread = 0,
}: Props & { onOpenHelp?: () => void; onOpenRules?: () => void }) {
  const [feedsOpen, setFeedsOpen] = useState(true);
  const [catsOpen, setCatsOpen] = useState(true);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const navItems = [
    { id: 'all', label: 'همه مقالات', icon: FileText, count: totals.all },
    { id: 'unread', label: 'خوانده نشده', icon: Circle, count: totals.unread },
    { id: 'starred', label: 'نشان شده‌ها', icon: Star, count: totals.starred },
    { id: 'saved', label: 'ذخیره شده‌ها', icon: Bookmark, count: totals.saved },
    { id: 'trending', label: 'پرطرفدارها', icon: TrendingUp, count: null },
    { id: 'tags', label: 'برچسب‌ها', icon: Tag, count: null },
    { id: 'international', label: 'اخبار بین‌الملل', icon: Globe2, count: null },
    { id: 'graph', label: 'نقشهٔ رسانه‌ای', icon: Network, count: null },
    { id: 'room', label: 'اتاق رصد رسانه‌ای', icon: MonitorDot, count: null },
    { id: 'social', label: 'رصد اجتماعی', icon: Radar, count: null, badge: socialUnread || null },
    { id: 'newspack', label: 'بسته‌های خبری سفارشی', icon: Package, count: null },
    { id: 'digest', label: 'گزارش روزانه', icon: Sunrise, count: null, action: onOpenDigest },
    { id: 'stats', label: 'داشبورد آمار', icon: BarChart3, count: null, action: onOpenStats },
    { id: 'source-hub', label: 'منبع‌یاب چندپلتفرمی', icon: Sparkles, count: null, action: onOpenSourceHub },
    { id: 'saved-searches', label: 'فیلترهای ذخیره‌شده', icon: Filter, count: null, action: onOpenSavedSearches },
    { id: 'knowledge', label: 'موتور دانش', icon: Brain, count: null, action: onOpenKnowledge },
    { id: 'notes', label: 'یادداشت‌ها', icon: NotebookPen, count: null, action: onOpenNotes },
    { id: 'timeline', label: 'خط زمانی موضوع', icon: Clock, count: null, action: onOpenTimeline },
    { id: 'studio', label: 'استودیوی محتوا', icon: Wand2, count: null, action: onOpenStudio },
  ];

  const grouped = useMemo(() => {
    const m = new Map<string, SidebarFeed[]>();
    for (const f of feeds) {
      const k = f.category || 'سایر';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(f);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [feeds]);

  const catColor = (name: string) => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `hsl(${hue} 70% 50%)`;
  };

  const toggleCat = (name: string) => {
    const next = new Set(expandedCats);
    next.has(name) ? next.delete(name) : next.add(name);
    setExpandedCats(next);
  };

  return (
    <aside className="w-72 max-w-[85vw] bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center mb-4">
          <span className="text-[20px] font-black tracking-tight text-slate-900 dark:text-whit px-[100px] py-[0px]e">FLOW</span>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white">ک</div>
          <div className="flex-1 min-w-0">
            <div className="truncate">کاربر نمونه</div>
            <div className="text-slate-500 text-sm truncate">user@example.com</div>
          </div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded">
            <Settings className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            type="text"
            data-search-input
            placeholder="جستجو در مقالات... ( / )"
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 pr-9 pl-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        {onOpenPalette && (
          <button onClick={onOpenPalette}
            className="mt-2 w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-700 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white transition">
            <Command className="w-3.5 h-3.5" />
            <span className="flex-1 text-right">پنل دستورات</span>
            <kbd className="text-[10px] bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">Ctrl K</kbd>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <nav className="space-y-0.5 mb-4">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if ((item as any).action) { (item as any).action(); return; }
                  setActiveView(item.id); setSelectedFeed(null); setSelectedCategory(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-right transition ${active ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'hover:bg-slate-200 dark:hover:bg-slate-800'}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-sm">{item.label}</span>
                {item.count !== null && item.count !== undefined && (
                  <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">{item.count}</span>
                )}
                {(item as any).badge ? (
                  <span className="text-[11px] font-semibold bg-rose-500 text-white px-1.5 min-w-[18px] text-center py-0.5 rounded-full">
                    {(item as any).badge.toLocaleString("fa-IR")}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {pinnedTopics.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-1 px-3 py-1.5 text-slate-500 text-sm">
              <Pin className="w-3 h-3" />
              <span className="flex-1 text-right">موضوعات سنجاق‌شده</span>
              {pinnedTopics.some(p => p.active) && onClearTopics && (
                <button onClick={onClearTopics} title="پاک کردن همه" className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded">
                  <X className="w-3 h-3" />
                </button>
              )}
              {onAddTopic && (
                <button onClick={onAddTopic} title="موضوع سفارشی" className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded">
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="space-y-0.5 mt-1">
              {pinnedTopics.map(({ topic, count, active }) => {
                const cls = topicColorClasses(topic.color);
                return (
                  <button
                    key={topic.id}
                    onClick={() => onToggleTopic?.(topic.id)}
                    disabled={count === 0 && !active}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-right text-sm transition ${
                      active
                        ? `${cls.chip} ring-1 ${cls.ring}`
                        : count === 0
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span>{topic.icon}</span>
                    <span className="flex-1 truncate">{topic.name}</span>
                    <span className={`text-xs tabular-nums px-1.5 py-0.5 rounded-full ${active ? "bg-white/40 dark:bg-black/30" : "bg-slate-200 dark:bg-slate-700"}`}>
                      {count.toLocaleString("fa-IR")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="flex items-center gap-1">
            <button onClick={() => setCatsOpen(!catsOpen)} className="flex-1 flex items-center gap-2 px-3 py-1.5 text-slate-500 text-sm hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg">
              {catsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
              <span className="flex-1 text-right">دسته‌بندی‌ها</span>
              <span className="text-xs text-slate-400">{grouped.length}</span>
            </button>
          </div>
          {catsOpen && (
            <div className="space-y-0.5 mt-1">
              {grouped.map(([cat, list]) => {
                const unread = list.reduce((s, f) => s + f.count, 0);
                const expanded = expandedCats.has(cat);
                const catActive = selectedCategory === cat && activeView === 'category';
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleCat(cat)} className="p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded">
                        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => { setActiveView('category'); setSelectedCategory(cat); setSelectedFeed(null); }}
                        className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-right text-sm ${catActive ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: catColor(cat) }}></span>
                        <span className="flex-1 truncate">{cat}</span>
                        <span className="text-xs text-slate-500">{list.length}</span>
                        {unread > 0 && <span className="text-xs bg-emerald-500 text-white px-1.5 rounded-full">{unread}</span>}
                      </button>
                    </div>
                    {expanded && (
                      <div className="mr-6 space-y-0.5 mt-0.5">
                        {list.map(feed => {
                          const st = feedStatus[feed.id];
                          const broken = st && st.ok === false;
                          return (
                            <div key={feed.id} className="group flex items-center gap-1">
                              <button
                                onClick={() => { setSelectedFeed(feed.id); setActiveView('feed'); setSelectedCategory(null); }}
                                className={`flex-1 flex items-center gap-2 px-2 py-1 rounded text-right text-xs ${selectedFeed === feed.id ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                              >
                                <span>{feed.icon}</span>
                                <span className={`flex-1 truncate ${broken ? 'text-red-500' : ''}`}>{feed.name}</span>
                                {broken && <AlertTriangle className="w-3 h-3 text-red-500" title={st.error || 'خطا در دریافت'} />}
                                {feed.count > 0 && <span className="text-slate-500">{feed.count}</span>}
                              </button>
                              {onRemoveFeed && (
                                <button onClick={() => onRemoveFeed(feed.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-1">
            <button onClick={() => setFeedsOpen(!feedsOpen)} className="flex-1 flex items-center gap-2 px-3 py-1.5 text-slate-500 text-sm hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg">
              {feedsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
              <Rss className="w-3 h-3" />
              <span className="flex-1 text-right">همه خوراک‌ها</span>
              <span className="text-xs text-slate-400">{feeds.length}</span>
            </button>
            <button onClick={onRefresh} className="p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg" title="بروزرسانی">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onAddFeed} className="p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg" title="افزودن خوراک">
              <Plus className="w-3 h-3" />
            </button>
          </div>
          {feedsOpen && (
            <div className="space-y-0.5 mt-1 max-h-64 overflow-y-auto">
              {feeds.length === 0 && (
                <div className="px-3 py-2 text-xs text-slate-500">هنوز خوراکی اضافه نشده</div>
              )}
              {feeds.slice(0, 100).map(feed => {
                const st = feedStatus[feed.id];
                const broken = st && st.ok === false;
                return (
                  <div key={feed.id} className="group flex items-center gap-1">
                    <button
                      onClick={() => { setSelectedFeed(feed.id); setActiveView('feed'); setSelectedCategory(null); }}
                      className={`flex-1 flex items-center gap-3 px-3 py-1.5 rounded-lg text-right text-sm ${selectedFeed === feed.id ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                    >
                      <span>{feed.icon}</span>
                      <span className={`flex-1 truncate ${broken ? 'text-red-500' : ''}`}>{feed.name}{feed.category ? ` — ${feed.category}` : ''}</span>
                      {broken && <AlertTriangle className="w-3.5 h-3.5 text-red-500" title={st.error || 'خطا'} />}
                      {feed.count > 0 && <span className="text-xs text-slate-500">{feed.count}</span>}
                    </button>
                    {onRemoveFeed && (
                      <button onClick={() => onRemoveFeed(feed.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
              {feeds.length > 100 && <div className="px-3 py-1 text-xs text-slate-500">و {feeds.length - 100} مورد دیگر...</div>}
            </div>
          )}
        </div>
      </div>

      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
        {lastRefresh && (
          <div className="text-xs text-slate-500 text-center mb-2">
            آخرین بروزرسانی: {lastRefresh.toLocaleTimeString('fa-IR')}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onOpenOpml} className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700">
            <FileUp className="w-3 h-3" /> OPML
          </button>
          {onOpenRules && (
            <button onClick={onOpenRules} className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700" title="قوانین برچسب خودکار">
              <Tag className="w-3 h-3" /> قوانین
            </button>
          )}
          {onOpenHelp && (
            <button onClick={onOpenHelp} className="px-3 text-xs py-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700" title="میان‌برها (?)">
              ؟
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
