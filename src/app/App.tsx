import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DensityProvider, SkeletonStyles } from "./components/kian";
import { Sidebar } from "./components/Sidebar";
import { ArticleList } from "./components/ArticleList";
import { ArticleView } from "./components/ArticleView";
import { AddFeedDialog } from "./components/AddFeedDialog";
import { OpmlDialog } from "./components/OpmlDialog";
import { ShortcutsDialog } from "./components/ShortcutsDialog";
import { RulesDialog } from "./components/RulesDialog";
import { GraphView } from "./components/GraphView";
import { InternationalView } from "./components/InternationalView";
import { useKeyboardShortcuts } from "./components/useKeyboardShortcuts";
import { CommandPalette } from "./components/CommandPalette";
import { ReadingMode } from "./components/ReadingMode";
import { StatsDashboard } from "./components/StatsDashboard";
import { DailyDigest } from "./components/DailyDigest";
import { SourceHub } from "./components/SourceHub";
import { SavedSearches } from "./components/SavedSearches";
import { applySearch, type SavedSearch } from "./savedSearches";
import { KnowledgePanel } from "./components/KnowledgePanel";
import { Notes } from "./components/Notes";
import { TimelineView } from "./components/TimelineView";
import type { TopicQuery } from "./timeline";
import { relatedArticles } from "./knowledge";
import { buildIndex, semanticSearch } from "./semanticSearch";
import { setupPWA } from "./pwa";
import { offlineCache } from "./offlineCache";
import { useTheme } from "./components/ThemeToggle";
import type { SortMode } from "./components/ArticleList";
import { api, RemoteArticle, RemoteFeed } from "./api";
import { articles as sampleArticles } from "./data";
import type { Article } from "./data";
import { duplicatesForArticle } from "./duplicates";
import { TopicFocusBar } from "./components/TopicFocusBar";
import { TopicFocusStyles } from "./components/TopicFocusStyles";
import { TopicPctSync } from "./components/TopicPctSync";
import { TopicHighlightSync } from "./components/TopicHighlightSync";
import { TopicMinimap } from "./components/TopicMinimap";
import { TopicJumpCounter } from "./components/TopicJumpCounter";
import {
  scoreAll, scoreArticleForTopic, scoreAllPerTopic, combineForArticle,
  loadActiveTopicIds, saveActiveTopicIds,
  loadFocusMode, saveFocusMode, BUILT_IN_TOPICS,
  loadCustomTopics, saveCustomTopics,
  loadCombinator, saveCombinator,
  type FocusMode, type Topic, type Combinator,
} from "./topics";
import { TopicBuilder } from "./components/TopicBuilder";
import { SmartFilterBar } from "./components/SmartFilterBar";
import {
  MobileShell, HomeScreen, DiscoverScreen, SavedScreen, TopicsScreen, MeScreen, NotesScreen, NoteEditorScreen, SettingsScreen, HistoryScreen, NotificationsScreen, ProfileSettingsScreen, CategoryScreen, DailyBriefingScreen, ReadingStatsScreen, SourceScreen, InternationalNewsScreen,
  MobileReader, useIsMobile, SearchSheet, SplashScreen,
  OnboardingSheet, hasOnboarded, MobileOnboardingV2, AuthScreen, loadUser, clearUser, type KianUser,
  InstallSheet, wasInstallDismissedRecently, useInstallPrompt,
  ActionSheet, type ActionItem,
  ArticleContextSheet, ShareSheet, WidgetPreviewSheet, WhatsNewSheet, hasSeenWhatsNew,
  QuickNoteSheet,
} from "./components/mobile";
import {
  applySmartFilter, applyMute, loadMuteWords, saveMuteWords,
  loadActiveSmart, saveActiveSmart, type SmartFilterId,
} from "./smartFilters";

function toArticle(a: RemoteArticle & { category?: string }): Article {
  return {
    id: a.id,
    title: a.title,
    source: a.source,
    sourceIcon: a.sourceIcon,
    author: a.author,
    date: a.date ? new Date(a.date).toLocaleString("fa-IR") : "",
    dateMs: a.date ? Date.parse(a.date) || undefined : undefined,
    readTime: a.readTime,
    preview: a.preview,
    content: a.content,
    image: a.image,
    starred: a.starred,
    read: a.read,
    category: (a as any).category || a.feedId,
    tags: a.tags || [],
    link: a.link,
  };
}

const AUTO_REFRESH_MS = 5 * 60 * 1000;

function buildArticleActions(
  a: Article,
  ctx: { isSaved: boolean; toggleSave: (id: string) => void; toggleStar: (id: string) => void; open: (a: Article) => void },
): ActionItem[] {
  return [
    { id: "open",  label: "باز کردن", onSelect: () => ctx.open(a) },
    { id: "save",  label: ctx.isSaved ? "حذف از ذخیره" : "ذخیره برای بعد", onSelect: () => ctx.toggleSave(a.id) },
    { id: "star",  label: a.starred ? "حذف ستاره" : "ستاره‌دار کردن", onSelect: () => ctx.toggleStar(a.id) },
    { id: "share", label: "اشتراک‌گذاری", onSelect: () => {
      if (navigator.share) navigator.share({ title: a.title, url: a.link ?? location.href }).catch(() => {});
    }},
    ...(a.link ? [{ id: "source", label: "مشاهده در منبع اصلی", onSelect: () => window.open(a.link!, "_blank") } as ActionItem] : []),
  ];
}

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [feeds, setFeeds] = useState<RemoteFeed[]>([]);
  const [items, setItems] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState("all");
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'list' | 'magazine'>('list');
  const [addOpen, setAddOpen] = useState(false);
  const [opmlOpen, setOpmlOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [searchResults, setSearchResults] = useState<Article[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [feedStatus, setFeedStatus] = useState<Record<string, { ok: boolean; error?: string }>>({});
  const [search, setSearch] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [mobileDrawer, setMobileDrawer] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("saved") || "[]")); } catch { return new Set(); }
  });
  const feedCacheRef = useRef<Map<string, Article[]>>(new Map());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showDigest, setShowDigest] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [savedSearchesOpen, setSavedSearchesOpen] = useState(false);
  const [activeSearch, setActiveSearch] = useState<SavedSearch | null>(null);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineTopic, setTimelineTopic] = useState<TopicQuery | null>(null);

  useEffect(() => { setupPWA(); }, []);
  useEffect(() => {
    import("./components/mobile/utils/accent").then(({ loadAccentId, applyAccent }) => {
      applyAccent(loadAccentId());
    });
  }, []);
  useEffect(() => { setShowStats(false); setShowDigest(false); }, [activeView, selectedFeed, selectedCategory]);

  const loadAll = useCallback(async (opts: { feedId?: string } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const [feedsList, remote] = await Promise.all([
        api.listFeeds(),
        api.listArticles(opts.feedId ? { feedId: opts.feedId } : { limit: 60 }),
      ]);
      setFeeds(feedsList);
      const mapped = remote.map(toArticle);
      const dedupe = (arr: Article[]) => {
        const seen = new Set<string>();
        return arr.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
      };
      if (opts.feedId) {
        feedCacheRef.current.set(opts.feedId, mapped);
        const newIds = new Set(mapped.map(m => m.id));
        setItems(prev => dedupe([...prev.filter(a => !newIds.has(a.id)), ...mapped]));
      } else if (mapped.length === 0 && feedsList.length === 0) {
        setItems(sampleArticles);
      } else {
        setItems(dedupe(mapped));
      }
      if (mapped.length) offlineCache.saveBatch(mapped).catch(() => {});
      setLastRefresh(new Date());
      try { const s = await api.feedStatus(); setFeedStatus(s); } catch {}
    } catch (e) {
      console.log("load error:", e);
      try {
        const cached = await offlineCache.getAll();
        if (cached.length) {
          setItems(cached);
          setError("آفلاین — نمایش مقالات ذخیره‌شده محلی");
        } else {
          setError("خطا در دریافت خوراک‌ها. نمایش داده‌های نمونه.");
          if (items.length === 0) setItems(sampleArticles);
        }
      } catch {
        setError("خطا در دریافت خوراک‌ها.");
        if (items.length === 0) setItems(sampleArticles);
      }
    } finally {
      setLoading(false);
    }
  }, [items.length]);

  useEffect(() => { loadAll(); offlineCache.prune().catch(() => {}); }, []);

  const semIndex = useMemo(() => buildIndex(items), [items]);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setSearchResults(null); return; }
    let cancelled = false;
    setSearching(true);

    // immediate client-side semantic search for low-latency UX
    try {
      const local = semanticSearch(semIndex, q, 50).map(r => r.article);
      if (!cancelled && local.length) setSearchResults(local);
    } catch {}

    const t = setTimeout(async () => {
      try {
        const r = await api.search(q);
        if (!cancelled && r.length) setSearchResults(r.map(toArticle));
      } catch (e) {
        console.log("search error:", e);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, semIndex]);


  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') loadAll(selectedFeed ? { feedId: selectedFeed } : {});
    }, AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, [loadAll, selectedFeed]);

  useEffect(() => {
    if (activeView === 'feed' && selectedFeed && !feedCacheRef.current.has(selectedFeed)) {
      loadAll({ feedId: selectedFeed });
    }
  }, [activeView, selectedFeed, loadAll]);

  useEffect(() => {
    localStorage.setItem("saved", JSON.stringify(Array.from(savedIds)));
  }, [savedIds]);

  const sidebarFeeds = useMemo(() => feeds.map(f => {
    const count = items.filter(a => a.category === f.id && !a.read).length;
    return { id: f.id, name: f.name, count, icon: f.icon, category: (f as any).category || "" };
  }), [feeds, items]);

  const [activeTopicIds, setActiveTopicIds] = useState<string[]>(() => {
    try {
      const u = new URL(window.location.href);
      const q = u.searchParams.get("topic");
      if (q) return q.split(",").map(s => s.trim()).filter(Boolean);
    } catch {}
    return loadActiveTopicIds();
  });
  const [focusMode, setFocusMode] = useState<FocusMode>(() => {
    try {
      const u = new URL(window.location.href);
      const q = u.searchParams.get("mode");
      if (q === "highlight" || q === "dim" || q === "filter") return q;
    } catch {}
    return loadFocusMode();
  });
  const [combinator, setCombinator] = useState<Combinator>(() => {
    try {
      const u = new URL(window.location.href);
      const q = u.searchParams.get("combinator");
      if (q === "and" || q === "not" || q === "or") return q;
    } catch {}
    return loadCombinator();
  });
  const [muteWords, setMuteWords] = useState<string[]>(() => loadMuteWords());
  const [smartActive, setSmartActive] = useState<SmartFilterId | null>(() => loadActiveSmart());
  useEffect(() => { saveMuteWords(muteWords); }, [muteWords]);
  useEffect(() => { saveActiveSmart(smartActive); }, [smartActive]);
  const [customTopics, setCustomTopics] = useState<Topic[]>(() => loadCustomTopics());
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderInitial, setBuilderInitial] = useState<Topic | null>(null);
  useEffect(() => { saveActiveTopicIds(activeTopicIds); }, [activeTopicIds]);
  useEffect(() => { saveFocusMode(focusMode); }, [focusMode]);
  useEffect(() => { saveCombinator(combinator); }, [combinator]);
  useEffect(() => { saveCustomTopics(customTopics); }, [customTopics]);

  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      if (activeTopicIds.length) {
        u.searchParams.set("topic", activeTopicIds.join(","));
        u.searchParams.set("mode", focusMode);
        if (combinator !== "or") u.searchParams.set("combinator", combinator);
        else u.searchParams.delete("combinator");
      } else {
        u.searchParams.delete("topic");
        u.searchParams.delete("mode");
        u.searchParams.delete("combinator");
      }
      window.history.replaceState(null, "", u.toString());
    } catch {}
  }, [activeTopicIds, focusMode, combinator]);

  const allTopicsForFilter = useMemo(
    () => [...BUILT_IN_TOPICS, ...customTopics],
    [customTopics]
  );
  const activeTopics = useMemo(
    () => allTopicsForFilter.filter(t => activeTopicIds.includes(t.id)),
    [allTopicsForFilter, activeTopicIds]
  );

  const saveCustomTopic = useCallback((t: Topic) => {
    setCustomTopics(prev => {
      const i = prev.findIndex(x => x.id === t.id);
      if (i >= 0) { const c = [...prev]; c[i] = t; return c; }
      return [...prev, t];
    });
  }, []);
  const deleteCustomTopic = useCallback((id: string) => {
    setCustomTopics(prev => prev.filter(t => t.id !== id));
    setActiveTopicIds(prev => prev.filter(x => x !== id));
  }, []);
  const topicScores = useMemo(() => {
    if (!activeTopics.length) return new Map();
    try {
      if (combinator === "or") return scoreAll(items, activeTopics);
      const per = scoreAllPerTopic(items, activeTopics);
      const ids = activeTopics.map(t => t.id);
      const out = new Map();
      for (const [aid, m] of per) out.set(aid, combineForArticle(m, ids, combinator));
      return out;
    } catch (e) { console.error("scoreAll failed:", e); return new Map(); }
  }, [items, activeTopics, combinator]);

  const pinnedTopics = useMemo(() => {
    if (!activeTopics.length) return [];
    return activeTopics.map(topic => {
      let count = 0;
      for (const a of items) {
        try { if (scoreArticleForTopic(a, topic).level !== "none") count++; } catch {}
      }
      return { topic, count, active: true };
    });
  }, [activeTopics, items]);

  const toggleTopic = useCallback((id: string) => {
    setActiveTopicIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);
  const clearTopics = useCallback(() => setActiveTopicIds([]), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && /^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName)) return;
      if (tgt?.isContentEditable) return;
      if (e.key === "Escape" && activeTopicIds.length) {
        clearTopics();
        e.preventDefault();
        return;
      }
      if (e.key === "T" && e.shiftKey) {
        setFocusMode(m => m === "highlight" ? "dim" : m === "dim" ? "filter" : "highlight");
        e.preventDefault();
        return;
      }
      if (/^[1-9]$/.test(e.key) && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const idx = parseInt(e.key, 10) - 1;
        const list = [...BUILT_IN_TOPICS, ...customTopics];
        const t = list[idx];
        if (t) { toggleTopic(t.id); e.preventDefault(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTopicIds.length, clearTopics, toggleTopic, customTopics]);

  const filtered = useMemo(() => {
    if (searchResults && search.trim().length >= 3) {
      const byId = new Map(items.map(a => [a.id, a]));
      return searchResults.map(r => byId.get(r.id) || r);
    }
    let list = items;
    if (activeView === 'starred') list = list.filter(a => a.starred);
    else if (activeView === 'unread') list = list.filter(a => !a.read);
    else if (activeView === 'saved') list = list.filter(a => savedIds.has(a.id));
    else if (activeView === 'feed' && selectedFeed) list = list.filter(a => a.category === selectedFeed);
    else if (activeView === 'category' && selectedCategory) {
      const ids = new Set(feeds.filter(f => ((f as any).category || '') === selectedCategory).map(f => f.id));
      list = list.filter(a => ids.has(a.category));
    } else if (activeView === 'trending') {
      list = [...list].sort(() => Math.random() - 0.5).slice(0, 30);
    } else if (activeView === 'savedsearch' && activeSearch) {
      list = applySearch(list, activeSearch);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(a => a.title.toLowerCase().includes(q) || a.preview.toLowerCase().includes(q));
    }
    if (activeTopics.length && focusMode === "filter") {
      list = list.filter(a => {
        const s = topicScores.get(a.id);
        return s && s.level !== "none";
      });
    }
    if (smartActive) list = applySmartFilter(list, smartActive);
    list = applyMute(list, muteWords);
    return list;
  }, [items, activeView, selectedFeed, selectedCategory, savedIds, search, feeds, searchResults, activeSearch, activeTopics, focusMode, topicScores, smartActive, muteWords]);

  const title = useMemo(() => {
    if (activeView === 'starred') return 'نشان شده‌ها';
    if (activeView === 'unread') return 'خوانده نشده';
    if (activeView === 'saved') return 'ذخیره شده‌ها';
    if (activeView === 'trending') return 'پرطرفدارها';
    if (activeView === 'savedsearch' && activeSearch) return `${activeSearch.icon || '🔍'} ${activeSearch.name}`;
    if (activeView === 'tags') return 'برچسب‌ها';
    if (activeView === 'international') return 'اخبار بین‌الملل';
    if (activeView === 'feed' && selectedFeed) return feeds.find(f => f.id === selectedFeed)?.name || '';
    if (activeView === 'category' && selectedCategory) return selectedCategory;
    return 'همه مقالات';
  }, [activeView, selectedFeed, selectedCategory, feeds]);

  const totals = useMemo(() => ({
    all: items.length,
    unread: items.filter(a => !a.read).length,
    starred: items.filter(a => a.starred).length,
    saved: savedIds.size,
  }), [items, savedIds]);

  const selected = items.find(a => a.id === selectedId) || null;

  const related = useMemo(() => selected ? relatedArticles(semIndex, selected, 8) : [], [semIndex, selected?.id]);
  const duplicates = useMemo(() => selected ? duplicatesForArticle(selected, items, 0.4) : [], [selected?.id, items]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inField = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setPaletteOpen(p => !p); return;
      }
      if (!inField && e.key === "f" && selected) { e.preventDefault(); setReadingMode(true); }
      if (!inField && e.key === "n") { e.preventDefault(); setNotesOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const markAllRead = async () => {
    const unreadIds = filtered.filter(a => !a.read).map(a => a.id);
    if (unreadIds.length === 0) return;
    const idSet = new Set(unreadIds);
    setItems(items.map(a => idSet.has(a.id) ? { ...a, read: true } : a));
    await Promise.all(unreadIds.map(id => api.markRead(id).catch(() => {})));
  };

  const navigate = (dir: 1 | -1) => {
    if (filtered.length === 0) return;
    const idx = filtered.findIndex(a => a.id === selectedId);
    const nextIdx = idx === -1 ? 0 : Math.min(filtered.length - 1, Math.max(0, idx + dir));
    const next = filtered[nextIdx];
    if (next) handleSelect(next.id);
  };

  const toggleReadSelected = async () => {
    if (!selected) return;
    const next = !selected.read;
    setItems(items.map(a => a.id === selected.id ? { ...a, read: next } : a));
    if (next) { try { await api.markRead(selected.id); } catch {} }
  };

  const toggleStar = async (id: string) => {
    const cur = items.find(a => a.id === id);
    if (!cur) return;
    const next = !cur.starred;
    setItems(items.map(a => a.id === id ? { ...a, starred: next } : a));
    try { await api.setStar(id, next); } catch (e) { console.log("star error:", e); }
  };

  const setArticleTags = async (id: string, tags: string[]) => {
    setItems(items.map(a => a.id === id ? { ...a, tags } : a));
    try { await api.setTags(id, tags); } catch (e) { console.log("tags error:", e); }
  };

  const removeFeed = async (id: string) => {
    if (!confirm("حذف این خوراک؟")) return;
    try { await api.removeFeed(id); await loadAll(); } catch (e) { console.log("remove feed error:", e); }
  };

  const toggleSave = (id: string) => {
    const next = new Set(savedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSavedIds(next);
  };

  const handleSelect = async (id: string) => {
    setSelectedId(id);
    setItems(items.map(a => a.id === id ? { ...a, read: true } : a));
    try { await api.markRead(id); } catch (e) { console.log("mark read error:", e); }
  };

  useKeyboardShortcuts({
    onNext: () => navigate(1),
    onPrev: () => navigate(-1),
    onStar: () => { if (selected) toggleStar(selected.id); },
    onMarkRead: () => { toggleReadSelected(); },
    onSave: () => { if (selected) toggleSave(selected.id); },
    onOpenOriginal: () => { if (selected?.link) window.open(selected.link, '_blank', 'noopener'); },
    onRefresh: () => loadAll(selectedFeed ? { feedId: selectedFeed } : {}),
    onClose: () => setSelectedId(null),
    onFocusSearch: () => {
      const el = document.querySelector<HTMLInputElement>('input[data-search-input]');
      el?.focus();
    },
    onHelp: () => setHelpOpen(true),
  });

  const showArticleView = !!selected;
  const closeMobileDrawer = () => setMobileDrawer(false);

  const isMobile = useIsMobile();
  const [mobileHiddenIds, setMobileHiddenIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("kian.mobile.hidden") || "[]")); } catch { return new Set(); }
  });
  const hideMobileArticle = (a: Article) => {
    setMobileHiddenIds((prev) => {
      const next = new Set(prev); next.add(a.id);
      try { localStorage.setItem("kian.mobile.hidden", JSON.stringify([...next])); } catch {}
      return next;
    });
  };
  const mobileItems = useMemo(
    () => items
      .filter((a) => !mobileHiddenIds.has(a.id))
      .map((a) => ({ ...a, starred: savedIds.has(a.id) })),
    [items, savedIds, mobileHiddenIds],
  );
  const mobileSelected = useMemo(
    () => (selected ? { ...selected, starred: savedIds.has(selected.id) } : null),
    [selected, savedIds],
  );

  const [mobileSplashOpen, setMobileSplashOpen] = useState(() => {
    if (typeof sessionStorage === "undefined") return true;
    return sessionStorage.getItem("kian.mobile.splashSeen") !== "1";
  });
  const dismissSplash = () => {
    try { sessionStorage.setItem("kian.mobile.splashSeen", "1"); } catch {}
    setMobileSplashOpen(false);
  };
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileOnboardOpen, setMobileOnboardOpen] = useState(() => isMobile && !hasOnboarded());
  const [mobileActionFor, setMobileActionFor] = useState<Article | null>(null);
  const [mobileShareFor, setMobileShareFor] = useState<Article | null>(null);
  const [mobileWidgetPreviewOpen, setMobileWidgetPreviewOpen] = useState(false);
  const [mobileWhatsNewOpen, setMobileWhatsNewOpen] = useState(false);
  useEffect(() => {
    if (!isMobile) return;
    if (mobileOnboardOpen) return;
    if (hasSeenWhatsNew()) return;
    const t = setTimeout(() => setMobileWhatsNewOpen(true), 2500);
    return () => clearTimeout(t);
  }, [isMobile, mobileOnboardOpen]);
  const [mobileInstallOpen, setMobileInstallOpen] = useState(false);
  const [mobileQuickNoteOpen, setMobileQuickNoteOpen] = useState(false);
  const [mobileNotesOpen, setMobileNotesOpen] = useState(false);
  const [mobileEditingNote, setMobileEditingNote] = useState<import("./notes").Note | null>(null);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [mobileStatsOpen, setMobileStatsOpen] = useState(false);
  const [mobileTopicsOpen, setMobileTopicsOpen] = useState(false);
  const [mobileAuthOpen, setMobileAuthOpen] = useState(false);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const [mobileCategoryOpen, setMobileCategoryOpen] = useState<string | null>(null);
  const [mobileSourceOpen, setMobileSourceOpen] = useState<string | null>(null);
  const [mobileBriefingOpen, setMobileBriefingOpen] = useState(false);
  const [mobileUser, setMobileUser] = useState<KianUser | null>(() => loadUser());
  const [mobileNotifsOpen, setMobileNotifsOpen] = useState(false);
  const [mobileUnreadNotifs, setMobileUnreadNotifs] = useState(0);
  useEffect(() => {
    if (!isMobile) return;
    import("./components/mobile/utils/notifications").then((m) => {
      const list = m.seedFromArticles(mobileItems);
      setMobileUnreadNotifs(list.filter((n) => !n.read).length);
    });
  }, [isMobile, mobileItems, mobileNotifsOpen]);
  const { canInstall: mobileCanInstall } = useInstallPrompt();
  useEffect(() => {
    if (!isMobile || !mobileCanInstall || mobileOnboardOpen) return;
    if (wasInstallDismissedRecently()) return;
    const t = setTimeout(() => setMobileInstallOpen(true), 4000);
    return () => clearTimeout(t);
  }, [isMobile, mobileCanInstall, mobileOnboardOpen]);

  if (isMobile) {
    return (
      <>
        <DensityProvider />
        <SkeletonStyles />
        {mobileSplashOpen && <SplashScreen onDone={dismissSplash} />}
        <MobileShell
          renderTab={(tab) => {
            switch (tab) {
              case "home":
                return (
                  <HomeScreen
                    articles={mobileItems}
                    onOpen={(a) => setSelectedId(a.id)}
                    onToggleSave={(a) => toggleSave(a.id)}
                    onLongPress={(a) => setMobileActionFor(a)}
                    onRefresh={() => loadAll(selectedFeed ? { feedId: selectedFeed } : {})}
                    onSearch={() => setMobileSearchOpen(true)}
                    onCompose={() => setMobileQuickNoteOpen(true)}
                  />
                );
              case "discover":
                return (
                  <DiscoverScreen
                    articles={mobileItems}
                    onOpen={(a) => setSelectedId(a.id)}
                    onToggleSave={(a) => toggleSave(a.id)}
                    onLongPress={(a) => setMobileActionFor(a)}
                    onPickCategory={(name) => setMobileCategoryOpen(name)}
                  />
                );
              case "saved":
                return (
                  <SavedScreen
                    articles={mobileItems}
                    onOpen={(a) => setSelectedId(a.id)}
                    onToggleSave={(a) => toggleSave(a.id)}
                    onLongPress={(a) => setMobileActionFor(a)}
                  />
                );
              case "international":
                return (
                  <InternationalNewsScreen
                    embedded
                    onOpenArticle={(a) => {
                      setItems((prev) => prev.some((p) => p.id === a.id) ? prev : [a, ...prev]);
                      setSelectedId(a.id);
                    }}
                  />
                );
              case "me":
                return <MeScreen
                  name={mobileUser?.name}
                  email={mobileUser?.email}
                  isAuthed={!!mobileUser}
                  onOpenAuth={() => setMobileAuthOpen(true)}
                  onOpenProfile={() => setMobileProfileOpen(true)}
                  onOpenBriefing={() => setMobileBriefingOpen(true)}
                  onSignOut={() => { clearUser(); setMobileUser(null); }}
                  onToggleTheme={() => toggleTheme()}
                  onOpenNotes={() => setMobileNotesOpen(true)}
                  onOpenSettings={() => setMobileSettingsOpen(true)}
                  onOpenHistory={() => setMobileHistoryOpen(true)}
                  onOpenStats={() => setMobileStatsOpen(true)}
                  onOpenTopics={() => setMobileTopicsOpen(true)}
                  onOpenNotifications={() => setMobileNotifsOpen(true)}
                  unreadNotifs={mobileUnreadNotifs}
                />;
            }
          }}
          badges={{ saved: savedIds.size || undefined }}
          overlays={
            <>
              <MobileReader
                article={mobileSelected}
                onClose={() => setSelectedId(null)}
                onToggleSave={(a) => toggleSave(a.id)}
                onAddNote={() => setMobileQuickNoteOpen(true)}
                pool={mobileItems}
                onOpenArticle={(a) => setSelectedId(a.id)}
              />
              <SearchSheet
                open={mobileSearchOpen}
                onClose={() => setMobileSearchOpen(false)}
                articles={mobileItems}
                onOpenArticle={(a) => setSelectedId(a.id)}
                onToggleSave={(a) => toggleSave(a.id)}
              />
              <MobileOnboardingV2 open={mobileOnboardOpen} onDone={() => setMobileOnboardOpen(false)} />
              <InstallSheet open={mobileInstallOpen} onClose={() => setMobileInstallOpen(false)} />
              <QuickNoteSheet
                open={mobileQuickNoteOpen}
                onClose={() => setMobileQuickNoteOpen(false)}
                articleId={mobileSelected?.id}
              />
              {mobileNotesOpen && (
                <div className="fixed inset-0 z-[var(--z-mobile-reader)] bg-[var(--background)]">
                  <NotesScreen
                    onClose={() => setMobileNotesOpen(false)}
                    onOpenNote={(n) => setMobileEditingNote(n)}
                  />
                </div>
              )}
              {mobileEditingNote && (
                <div className="fixed inset-0 z-[calc(var(--z-mobile-reader)+1)] bg-[var(--background)]">
                  <NoteEditorScreen
                    note={mobileEditingNote}
                    onClose={() => setMobileEditingNote(null)}
                  />
                </div>
              )}
              {mobileSettingsOpen && (
                <div className="fixed inset-0 z-[var(--z-mobile-reader)] bg-[var(--background)]">
                  <SettingsScreen
                    onClose={() => setMobileSettingsOpen(false)}
                    onToggleTheme={() => toggleTheme()}
                    onOpenWidgetPreview={() => setMobileWidgetPreviewOpen(true)}
                  />
                </div>
              )}
              <AuthScreen
                open={mobileAuthOpen}
                onClose={() => setMobileAuthOpen(false)}
                onSuccess={(u) => { setMobileUser(u); setMobileAuthOpen(false); }}
              />
              {mobileBriefingOpen && (
                <div className="fixed inset-0 z-[var(--z-mobile-reader)] bg-[var(--background)]">
                  <DailyBriefingScreen
                    articles={mobileItems}
                    onClose={() => setMobileBriefingOpen(false)}
                    onOpenArticle={(a) => { setMobileBriefingOpen(false); setSelectedId(a.id); }}
                  />
                </div>
              )}
              {mobileCategoryOpen && (
                <div className="fixed inset-0 z-[var(--z-mobile-reader)] bg-[var(--background)]">
                  <CategoryScreen
                    category={mobileCategoryOpen}
                    articles={mobileItems}
                    onClose={() => setMobileCategoryOpen(null)}
                    onOpen={(a) => setSelectedId(a.id)}
                    onToggleSave={(a) => toggleSave(a.id)}
                    onLongPress={(a) => setMobileActionFor(a)}
                  />
                </div>
              )}
              {mobileSourceOpen && (
                <div className="fixed inset-0 z-[var(--z-mobile-reader)] bg-[var(--background)]">
                  <SourceScreen
                    source={mobileSourceOpen}
                    articles={mobileItems}
                    onClose={() => setMobileSourceOpen(null)}
                    onOpen={(a) => setSelectedId(a.id)}
                    onToggleSave={(a) => toggleSave(a.id)}
                    onLongPress={(a) => setMobileActionFor(a)}
                  />
                </div>
              )}
              {mobileProfileOpen && mobileUser && (
                <div className="fixed inset-0 z-[var(--z-mobile-reader)] bg-[var(--background)]">
                  <ProfileSettingsScreen
                    user={mobileUser}
                    onClose={() => setMobileProfileOpen(false)}
                    onUpdated={(u) => setMobileUser(u)}
                    onDelete={() => { clearUser(); setMobileUser(null); setMobileProfileOpen(false); }}
                  />
                </div>
              )}
              {mobileNotifsOpen && (
                <div className="fixed inset-0 z-[var(--z-mobile-reader)] bg-[var(--background)]">
                  <NotificationsScreen
                    onClose={() => setMobileNotifsOpen(false)}
                    articles={mobileItems}
                    onOpenArticle={(id) => setSelectedId(id)}
                  />
                </div>
              )}
              {mobileHistoryOpen && (
                <div className="fixed inset-0 z-[var(--z-mobile-reader)] bg-[var(--background)]">
                  <HistoryScreen
                    onClose={() => setMobileHistoryOpen(false)}
                    articles={mobileItems}
                    onOpen={(a) => setSelectedId(a.id)}
                    onToggleSave={(a) => toggleSave(a.id)}
                    onLongPress={(a) => setMobileActionFor(a)}
                  />
                </div>
              )}
              {mobileStatsOpen && (
                <div className="fixed inset-0 z-[var(--z-mobile-reader)] bg-[var(--background)]">
                  <ReadingStatsScreen
                    onClose={() => setMobileStatsOpen(false)}
                    articles={mobileItems}
                    savedCount={savedIds.size}
                  />
                </div>
              )}
              {mobileTopicsOpen && (
                <div className="fixed inset-0 z-[var(--z-mobile-reader)] bg-[var(--background)]">
                  <TopicsScreen
                    onClose={() => setMobileTopicsOpen(false)}
                    onSelectCategory={(id) => {
                      setSelectedCategory(id);
                      setActiveView("category");
                      setMobileTopicsOpen(false);
                      setMobileCategoryOpen(id);
                    }}
                    onSelectFeed={(id) => {
                      setSelectedFeed(id);
                      setActiveView("feed");
                      setMobileTopicsOpen(false);
                    }}
                  />
                </div>
              )}
              <ArticleContextSheet
                open={!!mobileActionFor}
                onClose={() => setMobileActionFor(null)}
                article={mobileActionFor}
                onToggleSave={(a) => toggleSave(a.id)}
                onShare={(a) => { setMobileActionFor(null); setMobileShareFor(a); }}
                onAskAI={(a) => { setMobileActionFor(null); setSelectedId(a.id); }}
                onHide={(a) => { hideMobileArticle(a); }}
                onOpenSource={(s) => { setMobileActionFor(null); setMobileSourceOpen(s); }}
              />
              <ShareSheet
                open={!!mobileShareFor}
                onClose={() => setMobileShareFor(null)}
                article={mobileShareFor}
              />
              <WidgetPreviewSheet
                open={mobileWidgetPreviewOpen}
                onClose={() => setMobileWidgetPreviewOpen(false)}
                articles={mobileItems}
              />
              <WhatsNewSheet
                open={mobileWhatsNewOpen}
                onClose={() => setMobileWhatsNewOpen(false)}
              />
            </>
          }
        />
      </>
    );
  }

  return (
    <>
    <DensityProvider />
    <SkeletonStyles />
    <div dir="rtl" lang="fa" className="size-full flex bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden relative">
      <div className="md:hidden fixed top-0 right-0 left-0 z-30 flex items-center gap-2 px-3 h-12 bg-white/90 dark:bg-slate-950/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <button onClick={() => setMobileDrawer(true)} className="p-2 -mr-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="منو">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <div className="text-sm truncate flex-1">{title || 'کیان'}</div>
        <button onClick={() => loadAll(selectedFeed ? { feedId: selectedFeed } : {})} disabled={loading} className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50" aria-label="بروزرسانی">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={loading ? 'animate-spin' : ''}><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        </button>
      </div>
      {mobileDrawer && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={closeMobileDrawer} />
      )}
      <div className={`md:relative md:translate-x-0 fixed top-0 right-0 bottom-0 z-40 transition-transform md:transition-none ${mobileDrawer ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`} onClick={(e) => { if ((e.target as HTMLElement).closest('button,a')) closeMobileDrawer(); }}>
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        selectedFeed={selectedFeed}
        setSelectedFeed={setSelectedFeed}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        theme={theme}
        onToggleTheme={toggleTheme}
        feeds={sidebarFeeds}
        onAddFeed={() => setHubOpen(true)}
        onOpenSourceHub={() => setHubOpen(true)}
        onOpenSavedSearches={() => setSavedSearchesOpen(true)}
        onOpenKnowledge={() => setKnowledgeOpen(true)}
        onOpenNotes={() => setNotesOpen(true)}
        onOpenTimeline={() => { setTimelineTopic(null); setTimelineOpen(true); }}
        onRefresh={() => loadAll(selectedFeed ? { feedId: selectedFeed } : {})}
        loading={loading}
        totals={totals}
        search={search}
        setSearch={setSearch}
        lastRefresh={lastRefresh}
        feedStatus={feedStatus}
        onOpenOpml={() => setOpmlOpen(true)}
        onRemoveFeed={removeFeed}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenRules={() => setRulesOpen(true)}
        onOpenStats={() => { setShowStats(true); setShowDigest(false); }}
        onOpenDigest={() => { setShowDigest(true); setShowStats(false); }}
        onOpenPalette={() => setPaletteOpen(true)}
        pinnedTopics={pinnedTopics}
        onToggleTopic={toggleTopic}
        onClearTopics={clearTopics}
        onAddTopic={() => { setBuilderInitial(null); setBuilderOpen(true); }}
      />
      </div>
      {error && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 px-4 py-2 rounded-lg text-sm z-20">
          {error}
        </div>
      )}
      <div className="flex-1 flex min-w-0 pt-12 md:pt-0 pb-14 md:pb-0">
      {showStats ? (
        <StatsDashboard articles={items} savedIds={savedIds} onClose={() => setShowStats(false)} />
      ) : showDigest ? (
        <DailyDigest articles={items} onClose={() => setShowDigest(false)} onSelect={(id) => { setShowDigest(false); handleSelect(id); }} />
      ) : activeView === 'graph' ? (
        <GraphView articles={items} loading={loading} onRefresh={() => loadAll()} />
      ) : activeView === 'international' ? (
        <>
          <div className={`${showArticleView ? 'hidden md:flex' : 'flex'} flex-1 min-w-0`}>
            <InternationalView
              onSelectArticle={(a) => handleSelect(a.id)}
              selectedId={selectedId || undefined}
              onToggleStar={toggleStar}
              onMarkAllRead={markAllRead}
            />
          </div>
          <div className={`${showArticleView ? 'flex fixed md:relative inset-0 md:inset-auto z-20 md:z-auto bg-white dark:bg-slate-950' : 'hidden md:flex'} flex-1 min-w-0`}>
            <ArticleView article={selected} onClose={() => setSelectedId(null)} toggleStar={toggleStar} toggleSave={toggleSave} isSaved={selected ? savedIds.has(selected.id) : false} onTagsChange={setArticleTags} related={related} duplicates={duplicates} onSelectRelated={handleSelect} onOpenTimeline={(topic) => { setTimelineTopic(topic); setTimelineOpen(true); }} />
          </div>
        </>
      ) : (
      <>
      <div className={`${showArticleView ? 'hidden md:flex' : 'flex'} flex-1 min-w-0 min-h-0 flex-col overflow-hidden relative`}>
        <TopicFocusStyles scores={topicScores as any} mode={focusMode} active={activeTopicIds.length > 0} />
        <TopicPctSync scores={topicScores as any} active={activeTopicIds.length > 0} />
        <TopicHighlightSync scores={topicScores as any} active={activeTopicIds.length > 0} />
        <TopicMinimap articles={filtered} scores={topicScores as any} active={activeTopicIds.length > 0} />
        <TopicJumpCounter articles={filtered} scores={topicScores as any} active={activeTopicIds.length > 0} />
        <TopicFocusBar
          articles={items}
          activeIds={activeTopicIds}
          onToggle={toggleTopic}
          onClear={clearTopics}
          mode={focusMode}
          onModeChange={setFocusMode}
          combinator={combinator}
          onCombinatorChange={setCombinator}
          customTopics={customTopics}
          onAddCustom={() => { setBuilderInitial(null); setBuilderOpen(true); }}
          onEditCustom={(t) => { setBuilderInitial(t); setBuilderOpen(true); }}
        />
        <SmartFilterBar
          articles={items}
          smartActive={smartActive}
          onSmartChange={setSmartActive}
          muteWords={muteWords}
          onMuteChange={setMuteWords}
        />
        <ArticleList
          articles={filtered}
          selectedId={selectedId}
          setSelectedId={handleSelect}
          viewMode={viewMode}
          setViewMode={setViewMode}
          title={title}
          toggleStar={toggleStar}
          sortMode={sortMode}
          setSortMode={setSortMode}
          onRefresh={() => loadAll(selectedFeed ? { feedId: selectedFeed } : {})}
          onMarkAllRead={markAllRead}
          loading={loading}
        />
      </div>
      <div className={`${showArticleView ? 'flex fixed md:relative inset-0 md:inset-auto z-20 md:z-auto bg-white dark:bg-slate-950' : 'hidden md:flex'} flex-1 min-w-0`}>
        <ArticleView article={selected} onClose={() => setSelectedId(null)} toggleStar={toggleStar} toggleSave={toggleSave} isSaved={selected ? savedIds.has(selected.id) : false} onTagsChange={setArticleTags} related={related} duplicates={duplicates} onSelectRelated={handleSelect} onOpenTimeline={(topic) => { setTimelineTopic(topic); setTimelineOpen(true); }} />
      </div>
      </>
      )}
      </div>

      <nav className="md:hidden fixed bottom-0 right-0 left-0 z-30 grid grid-cols-5 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 h-14">
        {[
          { id: 'all', label: 'همه', path: 'M3 12h18M3 6h18M3 18h18' },
          { id: 'unread', label: 'نخوانده', path: 'M12 2v20M2 12h20' },
          { id: 'starred', label: 'نشان', path: 'M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z' },
          { id: 'international', label: 'بین‌الملل', path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20' },
          { id: 'graph', label: 'گراف', path: 'M4 4h4v4H4zm12 0h4v4h-4zM4 16h4v4H4zm12 0h4v4h-4zM8 6h8M8 18h8M6 8v8M18 8v8' },
        ].map(n => (
          <button key={n.id} onClick={() => { setActiveView(n.id); setSelectedId(null); }}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] ${activeView === n.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={n.path}/></svg>
            {n.label}
          </button>
        ))}
      </nav>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        articles={items}
        feeds={feeds}
        theme={theme}
        actions={{
          setView: (v) => { setActiveView(v); setSelectedId(null); setShowStats(false); setShowDigest(false); },
          selectFeed: (id) => { setActiveView('feed'); setSelectedFeed(id); setSelectedId(null); },
          selectArticle: (id) => handleSelect(id),
          refresh: () => loadAll(selectedFeed ? { feedId: selectedFeed } : {}),
          addFeed: () => setHubOpen(true),
          openSourceHub: () => setHubOpen(true),
          openSavedSearches: () => setSavedSearchesOpen(true),
          openKnowledge: () => setKnowledgeOpen(true),
          openTimeline: (topic) => { setTimelineTopic(topic ?? null); setTimelineOpen(true); },
          openNotes: () => setNotesOpen(true),
          importOpml: () => setOpmlOpen(true),
          openHelp: () => setHelpOpen(true),
          openRules: () => setRulesOpen(true),
          toggleTheme: () => toggleTheme(),
          markAllRead: () => markAllRead(),
          openStats: () => { setShowStats(true); setShowDigest(false); },
          openDigest: () => { setShowDigest(true); setShowStats(false); },
          toggleFocus: () => { if (selected) setReadingMode(true); },
        }}
      />
      {readingMode && selected && (
        <ReadingMode
          article={selected}
          onClose={() => setReadingMode(false)}
          onToggleStar={toggleStar}
          onToggleSave={toggleSave}
          isSaved={savedIds.has(selected.id)}
          onPrev={() => navigate(-1)}
          onNext={() => navigate(1)}
        />
      )}
      <AddFeedDialog open={addOpen} onClose={() => setAddOpen(false)} onDone={() => loadAll()} />
      <SourceHub open={hubOpen} onClose={() => setHubOpen(false)} feeds={feeds} onChanged={() => loadAll()} />
      <SavedSearches open={savedSearchesOpen} onClose={() => setSavedSearchesOpen(false)} articles={items} feeds={feeds}
        onApply={(s) => { setActiveSearch(s); setActiveView('savedsearch'); setSelectedId(null); setSavedSearchesOpen(false); }} />
      <TimelineView open={timelineOpen} onClose={() => setTimelineOpen(false)} articles={items} initialTopic={timelineTopic} onSelectArticle={(id) => { setTimelineOpen(false); handleSelect(id); }} />
      <KnowledgePanel open={knowledgeOpen} onClose={() => setKnowledgeOpen(false)} articles={items} onSelect={(id) => { setKnowledgeOpen(false); handleSelect(id); }} onOpenTimeline={(topic) => { setKnowledgeOpen(false); setTimelineTopic(topic); setTimelineOpen(true); }} />
      <Notes open={notesOpen} onClose={() => setNotesOpen(false)} onOpenArticle={(id) => { setNotesOpen(false); handleSelect(id); }} currentArticle={selected ? { id: selected.id, title: selected.title } : null} />
      <OpmlDialog open={opmlOpen} onClose={() => setOpmlOpen(false)} onDone={() => loadAll()} />
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <RulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} onDone={() => loadAll(selectedFeed ? { feedId: selectedFeed } : {})} />
      <TopicBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        articles={items}
        onSave={saveCustomTopic}
        onDelete={deleteCustomTopic}
        initial={builderInitial}
      />
      {searching && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/80 text-white text-xs px-3 py-1.5 rounded-full z-20">
          در حال جستجو در متن مقالات...
        </div>
      )}
    </div>
    </>
  );
}
