import { Search, Rss, FileText, Star, Circle, Settings, Plus, TrendingUp, Bookmark, Tag as TagIcon, FileUp, ChevronDown, ChevronLeft, RefreshCw, AlertTriangle, Trash2, Network, Globe2, BarChart3, Sunrise, Command, Sparkles, Filter, Brain, NotebookPen, Clock, Pin, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { type Topic, topicColorClasses } from "../topics";
import { Input, Kbd, Badge, Button, DensityToggle } from "./kian";

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
  pinnedTopics?: PinnedTopic[];
  onToggleTopic?: (id: string) => void;
  onClearTopics?: () => void;
  onAddTopic?: () => void;
};

export function Sidebar({
  activeView, setActiveView, selectedFeed, setSelectedFeed,
  selectedCategory = null, setSelectedCategory = () => {},
  theme, onToggleTheme, feeds, onAddFeed, onRefresh, loading,
  totals = { all: 0, unread: 0, starred: 0, saved: 0 },
  search = "", setSearch = () => {}, lastRefresh = null,
  feedStatus = {}, onOpenOpml = () => {}, onRemoveFeed, onOpenHelp, onOpenRules,
  onOpenStats, onOpenDigest, onOpenPalette, onOpenSourceHub, onOpenSavedSearches, onOpenKnowledge, onOpenNotes, onOpenTimeline,
  pinnedTopics = [], onToggleTopic, onClearTopics, onAddTopic,
}: Props & { onOpenHelp?: () => void; onOpenRules?: () => void }) {
  const [feedsOpen, setFeedsOpen] = useState(true);
  const [catsOpen, setCatsOpen] = useState(true);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const navItems: Array<{ id: string; label: string; icon: any; count: number | null; action?: () => void; group?: 'core' | 'tools' }> = [
    { id: 'all', label: 'همه مقالات', icon: FileText, count: totals.all, group: 'core' },
    { id: 'unread', label: 'خوانده نشده', icon: Circle, count: totals.unread, group: 'core' },
    { id: 'starred', label: 'نشان شده‌ها', icon: Star, count: totals.starred, group: 'core' },
    { id: 'saved', label: 'ذخیره شده‌ها', icon: Bookmark, count: totals.saved, group: 'core' },
    { id: 'trending', label: 'پرطرفدارها', icon: TrendingUp, count: null, group: 'core' },
    { id: 'tags', label: 'برچسب‌ها', icon: TagIcon, count: null, group: 'core' },
    { id: 'international', label: 'اخبار بین‌الملل', icon: Globe2, count: null, group: 'core' },
    { id: 'graph', label: 'نقشهٔ رسانه‌ای', icon: Network, count: null, group: 'tools' },
    { id: 'digest', label: 'گزارش روزانه', icon: Sunrise, count: null, action: onOpenDigest, group: 'tools' },
    { id: 'stats', label: 'داشبورد آمار', icon: BarChart3, count: null, action: onOpenStats, group: 'tools' },
    { id: 'source-hub', label: 'منبع‌یاب چندپلتفرمی', icon: Sparkles, count: null, action: onOpenSourceHub, group: 'tools' },
    { id: 'saved-searches', label: 'فیلترهای ذخیره‌شده', icon: Filter, count: null, action: onOpenSavedSearches, group: 'tools' },
    { id: 'knowledge', label: 'موتور دانش', icon: Brain, count: null, action: onOpenKnowledge, group: 'tools' },
    { id: 'notes', label: 'یادداشت‌ها', icon: NotebookPen, count: null, action: onOpenNotes, group: 'tools' },
    { id: 'timeline', label: 'خط زمانی موضوع', icon: Clock, count: null, action: onOpenTimeline, group: 'tools' },
  ];

  const coreNav  = navItems.filter(n => n.group === 'core');
  const toolsNav = navItems.filter(n => n.group === 'tools');

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
    return `oklch(0.65 0.16 ${h % 360})`;
  };

  const toggleCat = (name: string) => {
    const next = new Set(expandedCats);
    next.has(name) ? next.delete(name) : next.add(name);
    setExpandedCats(next);
  };

  return (
    <aside className="w-72 max-w-[85vw] bg-[var(--sidebar)] text-[var(--sidebar-foreground)] border-l border-[var(--sidebar-border)] flex flex-col h-full">
      {/* ── Brand + Identity ────────────────────────────────────── */}
      <div className="p-4 border-b border-[var(--sidebar-border)] space-y-3">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--brand-500)] to-[var(--brand-700)] flex items-center justify-center text-white shadow-[var(--shadow-md)] text-display font-semibold">
            ک
          </div>
          <div className="flex-1 min-w-0 leading-tight">
            <div className="text-[13px] font-semibold tracking-tight text-display">کیان</div>
            <div className="text-[10.5px] text-[var(--foreground-subtle)] mt-0.5">عامل دانش رسانه‌ای</div>
          </div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <Button variant="ghost" size="xs" iconLeading={<Settings className="size-3.5" />} title="تنظیمات" />
        </div>

        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          data-search-input
          placeholder="جستجو در مقالات..."
          iconLeading={<Search className="size-3.5" />}
          iconTrailing={<Kbd>/</Kbd>}
          size="md"
        />

        {onOpenPalette && (
          <button onClick={onOpenPalette}
            className="w-full flex items-center gap-2 px-3 h-8 rounded-[var(--radius-md)] border border-[var(--border)] hover:border-[var(--brand-400)] dark:hover:border-[var(--brand-500)]
                       text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)]
                       transition-[border-color,color] duration-[var(--duration-fast)]">
            <Command className="size-3.5" />
            <span className="flex-1 text-right">پنل دستورات</span>
            <Kbd keys={["Ctrl", "K"]} />
          </button>
        )}
      </div>

      {/* ── Navigation ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <SectionLabel>اصلی</SectionLabel>
        <nav className="space-y-px mb-3">
          {coreNav.map(item => (
            <NavRow key={item.id} item={item} active={activeView === item.id}
              onClick={() => {
                if (item.action) { item.action(); return; }
                setActiveView(item.id); setSelectedFeed(null); setSelectedCategory(null);
              }} />
          ))}
        </nav>

        <SectionLabel>ابزارها</SectionLabel>
        <nav className="space-y-px mb-4">
          {toolsNav.map(item => (
            <NavRow key={item.id} item={item} active={activeView === item.id}
              onClick={() => {
                if (item.action) { item.action(); return; }
                setActiveView(item.id); setSelectedFeed(null); setSelectedCategory(null);
              }} />
          ))}
        </nav>

        {pinnedTopics.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-1 px-3 py-1 text-[var(--foreground-subtle)]">
              <Pin className="size-3" />
              <span className="flex-1 text-right text-[10px] font-medium uppercase tracking-wider">موضوعات سنجاق‌شده</span>
              {pinnedTopics.some(p => p.active) && onClearTopics && (
                <Button variant="ghost" size="xs" onClick={onClearTopics} title="پاک کردن همه" iconLeading={<X className="size-3" />} />
              )}
              {onAddTopic && (
                <Button variant="ghost" size="xs" onClick={onAddTopic} title="موضوع سفارشی" iconLeading={<Plus className="size-3" />} />
              )}
            </div>
            <div className="space-y-px mt-1">
              {pinnedTopics.map(({ topic, count, active }) => {
                const cls = topicColorClasses(topic.color);
                return (
                  <button key={topic.id}
                    onClick={() => onToggleTopic?.(topic.id)}
                    disabled={count === 0 && !active}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] text-right text-[12.5px]
                                transition-colors duration-[var(--duration-fast)] ${
                      active
                        ? `${cls.chip} ring-1 ${cls.ring}`
                        : count === 0
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-[var(--sidebar-accent)]"
                    }`}>
                    <span>{topic.icon}</span>
                    <span className="flex-1 truncate">{topic.name}</span>
                    <span className={`text-[10.5px] tabular-nums px-1.5 py-0.5 rounded-full ${active ? "bg-white/40 dark:bg-black/30" : "bg-[var(--muted)]"}`}>
                      {count.toLocaleString("fa-IR")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Categories ─────────────────────────────────── */}
        <div className="mb-4">
          <button onClick={() => setCatsOpen(!catsOpen)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] hover:bg-[var(--sidebar-accent)] transition-colors">
            {catsOpen ? <ChevronDown className="size-3" /> : <ChevronLeft className="size-3" />}
            <span className="flex-1 text-right text-[10px] font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">دسته‌بندی‌ها</span>
            <Badge tone="neutral" variant="soft" size="xs">{grouped.length}</Badge>
          </button>
          {catsOpen && (
            <div className="space-y-px mt-1">
              {grouped.map(([cat, list]) => {
                const unread = list.reduce((s, f) => s + f.count, 0);
                const expanded = expandedCats.has(cat);
                const catActive = selectedCategory === cat && activeView === 'category';
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleCat(cat)} className="p-1 text-[var(--foreground-subtle)] hover:bg-[var(--sidebar-accent)] rounded">
                        {expanded ? <ChevronDown className="size-3" /> : <ChevronLeft className="size-3" />}
                      </button>
                      <button
                        onClick={() => { setActiveView('category'); setSelectedCategory(cat); setSelectedFeed(null); }}
                        className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-md)] text-right text-[12.5px]
                                    transition-colors duration-[var(--duration-fast)] ${
                                      catActive
                                        ? 'bg-[var(--brand-50)] dark:bg-[oklch(0.30_0.10_258)] text-[var(--brand-700)] dark:text-[var(--brand-200)]'
                                        : 'hover:bg-[var(--sidebar-accent)]'
                                    }`}>
                        <span className="size-2 rounded-full shrink-0" style={{ background: catColor(cat) }} />
                        <span className="flex-1 truncate">{cat}</span>
                        <span className="text-[10.5px] text-[var(--foreground-subtle)] tabular-nums">{list.length}</span>
                        {unread > 0 && <Badge tone="brand" variant="solid" size="xs">{unread}</Badge>}
                      </button>
                    </div>
                    {expanded && (
                      <div className="mr-6 space-y-px mt-0.5">
                        {list.map(feed => {
                          const st = feedStatus[feed.id];
                          const broken = st && st.ok === false;
                          return (
                            <div key={feed.id} className="group flex items-center gap-1">
                              <button
                                onClick={() => { setSelectedFeed(feed.id); setActiveView('feed'); setSelectedCategory(null); }}
                                className={`flex-1 flex items-center gap-2 px-2 py-1 rounded-[var(--radius-sm)] text-right text-[11.5px]
                                            transition-colors duration-[var(--duration-fast)] ${
                                              selectedFeed === feed.id
                                                ? 'bg-[var(--brand-50)] dark:bg-[oklch(0.30_0.10_258)] text-[var(--brand-700)] dark:text-[var(--brand-200)]'
                                                : 'hover:bg-[var(--sidebar-accent)]'
                                            }`}>
                                <span>{feed.icon}</span>
                                <span className={`flex-1 truncate ${broken ? 'text-[var(--danger-500)]' : ''}`}>{feed.name}</span>
                                {broken && <AlertTriangle className="size-3 text-[var(--danger-500)]" />}
                                {feed.count > 0 && <span className="text-[var(--foreground-subtle)] tabular-nums">{feed.count}</span>}
                              </button>
                              {onRemoveFeed && (
                                <button onClick={() => onRemoveFeed(feed.id)} className="opacity-0 group-hover:opacity-100 p-1 text-[var(--foreground-subtle)] hover:text-[var(--danger-500)]">
                                  <Trash2 className="size-3" />
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

        {/* ── All Feeds ─────────────────────────────────── */}
        <div className="mb-4">
          <div className="flex items-center gap-1">
            <button onClick={() => setFeedsOpen(!feedsOpen)}
              className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] hover:bg-[var(--sidebar-accent)] transition-colors">
              {feedsOpen ? <ChevronDown className="size-3" /> : <ChevronLeft className="size-3" />}
              <Rss className="size-3" />
              <span className="flex-1 text-right text-[10px] font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">همه خوراک‌ها</span>
              <Badge tone="neutral" variant="soft" size="xs">{feeds.length}</Badge>
            </button>
            <Button variant="ghost" size="xs" onClick={onRefresh} title="بروزرسانی" iconLeading={<RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />} />
            <Button variant="ghost" size="xs" onClick={onAddFeed} title="افزودن خوراک" iconLeading={<Plus className="size-3" />} />
          </div>
          {feedsOpen && (
            <div className="space-y-px mt-1 max-h-64 overflow-y-auto">
              {feeds.length === 0 && (
                <div className="px-3 py-2 text-[11px] text-[var(--foreground-subtle)]">هنوز خوراکی اضافه نشده</div>
              )}
              {feeds.slice(0, 100).map(feed => {
                const st = feedStatus[feed.id];
                const broken = st && st.ok === false;
                return (
                  <div key={feed.id} className="group flex items-center gap-1">
                    <button
                      onClick={() => { setSelectedFeed(feed.id); setActiveView('feed'); setSelectedCategory(null); }}
                      className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] text-right text-[12.5px]
                                  transition-colors duration-[var(--duration-fast)] ${
                                    selectedFeed === feed.id
                                      ? 'bg-[var(--brand-50)] dark:bg-[oklch(0.30_0.10_258)] text-[var(--brand-700)] dark:text-[var(--brand-200)]'
                                      : 'hover:bg-[var(--sidebar-accent)]'
                                  }`}>
                      <span>{feed.icon}</span>
                      <span className={`flex-1 truncate ${broken ? 'text-[var(--danger-500)]' : ''}`}>
                        {feed.name}{feed.category ? ` — ${feed.category}` : ''}
                      </span>
                      {broken && <AlertTriangle className="size-3.5 text-[var(--danger-500)]" />}
                      {feed.count > 0 && <span className="text-[10.5px] text-[var(--foreground-subtle)] tabular-nums">{feed.count}</span>}
                    </button>
                    {onRemoveFeed && (
                      <button onClick={() => onRemoveFeed(feed.id)} className="opacity-0 group-hover:opacity-100 p-1 text-[var(--foreground-subtle)] hover:text-[var(--danger-500)]">
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                );
              })}
              {feeds.length > 100 && <div className="px-3 py-1 text-[10.5px] text-[var(--foreground-subtle)]">و {feeds.length - 100} مورد دیگر...</div>}
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────── */}
      <div className="p-3 border-t border-[var(--sidebar-border)] space-y-2.5 bg-[var(--sidebar)]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-wider font-medium">چگالی نمایش</span>
          <DensityToggle />
        </div>

        {lastRefresh && (
          <div className="text-[10.5px] text-[var(--foreground-subtle)] text-center tabular-nums">
            آخرین بروزرسانی: {lastRefresh.toLocaleTimeString('fa-IR')}
          </div>
        )}

        <div className="flex gap-1.5">
          <Button variant="secondary" size="sm" full onClick={onOpenOpml}
            iconLeading={<FileUp className="size-3" />}>OPML</Button>
          {onOpenRules && (
            <Button variant="secondary" size="sm" full onClick={onOpenRules}
              iconLeading={<TagIcon className="size-3" />} title="قوانین برچسب خودکار">قوانین</Button>
          )}
          {onOpenHelp && (
            <Button variant="secondary" size="sm" onClick={onOpenHelp} title="میان‌برها (?)">؟</Button>
          )}
        </div>
      </div>
    </aside>
  );
}

/* ── Internal helpers ─────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-1 pb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--foreground-subtle)]">
      {children}
    </div>
  );
}

function NavRow({ item, active, onClick }: {
  item: { id: string; label: string; icon: any; count: number | null };
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-[var(--radius-md)] text-right text-[12.5px]
                  transition-[background,color] duration-[var(--duration-fast)] ease-[var(--ease-out-quart)] ${
                    active
                      ? 'bg-[var(--brand-50)] dark:bg-[oklch(0.30_0.10_258)] text-[var(--brand-700)] dark:text-[var(--brand-200)] font-medium'
                      : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--sidebar-accent)]'
                  }`}>
      <Icon className="size-3.5 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.count !== null && item.count !== undefined && item.count > 0 && (
        <Badge tone={active ? "brand" : "neutral"} variant="soft" size="xs">
          {item.count.toLocaleString("fa-IR")}
        </Badge>
      )}
    </button>
  );
}
