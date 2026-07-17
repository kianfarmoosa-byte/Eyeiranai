import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Star, BookOpen, Bookmark, Rss, Hash, Globe2, Network,
  RefreshCw, Plus, Upload, Settings, Sun, Moon, Eye, EyeOff,
  ChevronLeft, BarChart3, Keyboard, FileText, ArrowRight, Clock,
} from "lucide-react";
import type { Article } from "../data";
import type { RemoteFeed } from "../api";
import type { TopicQuery } from "../timeline";

export type Command = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon?: any;
  keywords?: string;
  shortcut?: string;
  run: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  articles: Article[];
  feeds: RemoteFeed[];
  actions: {
    setView: (v: string) => void;
    selectFeed: (id: string) => void;
    selectArticle: (id: string) => void;
    refresh: () => void;
    addFeed: () => void;
    importOpml: () => void;
    openHelp: () => void;
    openRules: () => void;
    toggleTheme: () => void;
    markAllRead: () => void;
    openStats: () => void;
    openDigest: () => void;
    openSourceHub: () => void;
    openSavedSearches: () => void;
    openKnowledge: () => void;
    openNotes: () => void;
    openTimeline: (topic?: TopicQuery) => void;
    toggleFocus: () => void;
  };
  theme: string;
};

const norm = (s: string) => s.toLowerCase().replace(/[\u200c]/g, "").trim();

function score(item: { label: string; keywords?: string }, q: string): number {
  if (!q) return 1;
  const hay = norm(`${item.label} ${item.keywords || ""}`);
  const needle = norm(q);
  if (!needle) return 1;
  if (hay.startsWith(needle)) return 100;
  if (hay.includes(` ${needle}`)) return 80;
  if (hay.includes(needle)) return 60;
  let i = 0; let matched = 0;
  for (const ch of needle) {
    const idx = hay.indexOf(ch, i);
    if (idx === -1) return 0;
    matched++;
    i = idx + 1;
  }
  return matched === needle.length ? 20 : 0;
}

export function CommandPalette({ open, onClose, articles, feeds, actions, theme }: Props) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const baseCommands: Command[] = useMemo(() => [
    { id: "view-all", label: "همه مقالات", group: "نماها", icon: BookOpen, keywords: "all home", run: () => actions.setView("all") },
    { id: "view-unread", label: "خوانده‌نشده‌ها", group: "نماها", icon: Eye, keywords: "unread جدید", run: () => actions.setView("unread") },
    { id: "view-starred", label: "نشان‌شده‌ها", group: "نماها", icon: Star, keywords: "starred favorite", run: () => actions.setView("starred") },
    { id: "view-saved", label: "ذخیره‌شده‌ها", group: "نماها", icon: Bookmark, keywords: "saved", run: () => actions.setView("saved") },
    { id: "view-international", label: "اخبار بین‌الملل", group: "نماها", icon: Globe2, keywords: "international foreign", run: () => actions.setView("international") },
    { id: "view-graph", label: "گراف رسانه", group: "نماها", icon: Network, keywords: "graph network", run: () => actions.setView("graph") },
    { id: "view-stats", label: "داشبورد آمار شخصی", group: "نماها", icon: BarChart3, keywords: "dashboard stats آمار", run: () => actions.openStats() },
    { id: "view-digest", label: "گزارش روزانه (Daily Digest)", group: "نماها", icon: Globe2, keywords: "digest روزانه برترین", run: () => actions.openDigest() },
    { id: "act-refresh", label: "بروزرسانی همه فیدها", group: "اقدامات", icon: RefreshCw, shortcut: "r", run: () => actions.refresh() },
    { id: "act-add-feed", label: "افزودن فید جدید", group: "اقدامات", icon: Plus, run: () => actions.addFeed() },
    { id: "act-source-hub", label: "منبع‌یاب — یوتیوب/پادکست/تلگرام/توییتر", group: "اقدامات", icon: Plus, keywords: "youtube podcast telegram twitter newsletter منبع‌یاب", run: () => actions.openSourceHub() },
    { id: "act-saved-searches", label: "فیلترهای ذخیره‌شده / جست‌وجوی هوشمند", group: "اقدامات", icon: Hash, keywords: "filter saved search فیلتر جست‌وجو", run: () => actions.openSavedSearches() },
    { id: "act-knowledge", label: "موتور دانش — موجودیت‌ها/خوشه‌ها/رشته‌های خبر", group: "اقدامات", icon: Hash, keywords: "knowledge entities clusters threads dedup موتور دانش موجودیت", run: () => actions.openKnowledge() },
    { id: "act-notes", label: "یادداشت‌ها (با backlink)", group: "اقدامات", icon: BookOpen, keywords: "notes backlinks یادداشت", shortcut: "n", run: () => actions.openNotes() },
    { id: "act-timeline", label: "خط زمانی موضوع", group: "اقدامات", icon: Clock, keywords: "timeline chronology خط زمانی", run: () => actions.openTimeline() },
    { id: "act-import-opml", label: "وارد کردن OPML", group: "اقدامات", icon: Upload, run: () => actions.importOpml() },
    { id: "act-mark-all", label: "علامت‌گذاری همه به‌عنوان خوانده‌شده", group: "اقدامات", icon: EyeOff, run: () => actions.markAllRead() },
    { id: "act-rules", label: "مدیریت قواعد برچسب‌گذاری", group: "اقدامات", icon: Hash, run: () => actions.openRules() },
    { id: "act-focus", label: "حالت تمرکز / خواندن", group: "اقدامات", icon: FileText, keywords: "focus reading mode", run: () => actions.toggleFocus() },
    { id: "act-theme", label: theme === "dark" ? "تم روشن" : "تم تاریک", group: "تنظیمات", icon: theme === "dark" ? Sun : Moon, run: () => actions.toggleTheme() },
    { id: "act-help", label: "میانبرهای صفحه‌کلید", group: "تنظیمات", icon: Keyboard, shortcut: "?", run: () => actions.openHelp() },
  ], [actions, theme]);

  const feedCommands: Command[] = useMemo(() =>
    feeds.map(f => ({
      id: `feed-${f.id}`,
      label: f.name,
      hint: f.icon,
      group: "فیدها",
      icon: Rss,
      keywords: f.name,
      run: () => actions.selectFeed(f.id),
    })), [feeds, actions]);

  const articleCommands: Command[] = useMemo(() =>
    articles.slice(0, 200).map(a => ({
      id: `article-${a.id}`,
      label: a.title,
      hint: a.source,
      group: "مقالات",
      icon: FileText,
      keywords: `${a.source} ${a.preview}`,
      run: () => actions.selectArticle(a.id),
    })), [articles, actions]);

  const all = useMemo(() => [...baseCommands, ...feedCommands, ...articleCommands], [baseCommands, feedCommands, articleCommands]);

  const ranked = useMemo(() => {
    if (!q.trim()) return baseCommands;
    return all
      .map(c => ({ c, s: score(c, q) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 50)
      .map(x => x.c);
  }, [all, baseCommands, q]);

  const grouped = useMemo(() => {
    const m = new Map<string, Command[]>();
    for (const c of ranked) {
      if (!m.has(c.group)) m.set(c.group, []);
      m.get(c.group)!.push(c);
    }
    return Array.from(m.entries());
  }, [ranked]);

  useEffect(() => { setActive(0); }, [q]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(i => Math.min(ranked.length - 1, i + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
      else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = ranked[active];
        if (cmd) { cmd.run(); onClose(); }
      } else if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, ranked, active, onClose]);

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-cmd-idx="${active}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  let cursor = 0;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[70vh]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="جستجوی دستور، فید، مقاله…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-slate-400"
          />
          <kbd className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div ref={listRef} className="flex-1 overflow-y-auto py-1">
          {grouped.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-500">نتیجه‌ای یافت نشد</div>
          )}
          {grouped.map(([group, items]) => (
            <div key={group} className="py-1">
              <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-slate-400">{group}</div>
              {items.map(item => {
                const idx = cursor++;
                const Icon = item.icon || ChevronLeft;
                const isActive = idx === active;
                return (
                  <button
                    key={item.id}
                    data-cmd-idx={idx}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => { item.run(); onClose(); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-right text-sm ${isActive ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100" : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-emerald-600 dark:text-emerald-300" : "text-slate-400"}`} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.hint && <span className="text-[11px] text-slate-400 truncate max-w-[40%]">{item.hint}</span>}
                    {item.shortcut && <kbd className="text-[10px] bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">{item.shortcut}</kbd>}
                    {isActive && <ArrowRight className="w-3.5 h-3.5 text-emerald-500" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 dark:border-slate-800 px-3 py-2 text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span><kbd className="bg-slate-100 dark:bg-slate-800 rounded px-1">↑↓</kbd> پیمایش</span>
            <span><kbd className="bg-slate-100 dark:bg-slate-800 rounded px-1">↵</kbd> اجرا</span>
          </div>
          <span>Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}
