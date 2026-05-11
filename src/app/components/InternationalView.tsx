import { useEffect, useMemo, useRef, useState } from "react";
import { Globe2, Loader2, Plus, Check, Filter, EyeOff, Eye, ArrowDown, ArrowUp, Rss, Radar } from "lucide-react";
import type { Article } from "../data";
import { INTL_FEEDS, type IntlFeed } from "../internationalFeeds";
import { api } from "../api";
import { ArticleList } from "./ArticleList";
import type { SortMode } from "./ArticleList";
import { GdeltExplorer } from "./GdeltExplorer";

type Props = {
  onSelectArticle: (a: Article) => void;
  selectedId?: string;
  onToggleStar?: (id: string) => void;
  onMarkAllRead?: () => void;
};

const COUNTRY_ORDER = ["US", "GB", "CA", "AU", "IN"] as const;
const COUNTRY_META: Record<string, { name: string; flag: string }> = {
  US: { name: "آمریکا", flag: "🇺🇸" },
  GB: { name: "بریتانیا", flag: "🇬🇧" },
  CA: { name: "کانادا", flag: "🇨🇦" },
  AU: { name: "استرالیا", flag: "🇦🇺" },
  IN: { name: "هند", flag: "🇮🇳" },
};

const CAT_META: Record<string, { name: string }> = {
  general: { name: "عمومی" },
  business: { name: "اقتصادی" },
  politics: { name: "سیاسی" },
};

export function InternationalView({ onSelectArticle, selectedId, onToggleStar, onMarkAllRead }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [country, setCountry] = useState<string>("all");
  const [cat, setCat] = useState<string>("all");
  const [hideRead, setHideRead] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "list" | "magazine">("cards");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [activeTab, setActiveTab] = useState<"feeds" | "gdelt">("feeds");
  const scrollWrapRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ pct: 0, atTop: true, atBottom: false, visibleFrom: 0, visibleTo: 0 });

  const intlByName = useMemo(() => {
    const m = new Map<string, IntlFeed>();
    for (const f of INTL_FEEDS) if (!m.has(f.name)) m.set(f.name, f);
    return m;
  }, []);
  const allIntlNames = useMemo(() => new Set(INTL_FEEDS.map(f => f.name)), []);

  const dedupKey = (a: any): string => {
    const link = (a.link || "").toString().trim().toLowerCase().replace(/[#?].*$/, "").replace(/\/+$/, "");
    if (link) return `l:${link}`;
    const title = (a.title || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
    return `t:${a.source || ""}|${title}`;
  };

  const loadIntl = async () => {
    setLoading(true);
    setProgress({ done: 0, total: 0 });
    const PAGE = 40;
    const seen = new Map<string, Article>();
    const pushAll = (arr: any[]) => {
      for (const a of arr) {
        const k = dedupKey(a);
        const prev = seen.get(k);
        // prefer the read/starred copy so user state wins; else keep first
        if (!prev) seen.set(k, a);
        else if ((a.read && !prev.read) || (a.starred && !prev.starred)) seen.set(k, { ...a, read: a.read || prev.read, starred: a.starred || prev.starred });
      }
    };
    let offset = 0;
    let total = 0;
    try {
      const first = await api.listArticlesPage({ category: "بین‌الملل", limit: PAGE, offset: 0 });
      pushAll(first.articles as any);
      total = first.total || 0;
      offset = PAGE;
      setArticles(Array.from(seen.values()));
      setProgress({ done: Math.min(offset, total), total });

      while (offset < total) {
        try {
          const page = await api.listArticlesPage({ category: "بین‌الملل", limit: PAGE, offset });
          pushAll(page.articles as any);
          setArticles(Array.from(seen.values()));
          offset += PAGE;
          setProgress({ done: Math.min(offset, total), total });
        } catch (e) {
          console.log("intl page failed at offset", offset, e);
          offset += PAGE;
        }
      }
    } catch (e) {
      console.log("intl listArticles failed:", e);
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(null), 1500);
    }
  };

  const refreshRegistered = async () => {
    try {
      const feeds = await api.listFeeds();
      let n = 0;
      for (const f of feeds) if (allIntlNames.has(f.name)) n++;
      setRegisteredCount(n);
    } catch (e) {
      console.log("intl listFeeds failed:", e);
    }
  };

  useEffect(() => {
    loadIntl();
    refreshRegistered();
  }, []);

  const scrollTo = (where: "top" | "bottom") => {
    const root = scrollWrapRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(".overflow-y-auto");
    if (!el) return;
    el.scrollTo({ top: where === "top" ? 0 : el.scrollHeight, behavior: "smooth" });
  };

  const intlFeedsFiltered = useMemo(() => {
    return INTL_FEEDS
      .filter(f => country === "all" || f.country === country)
      .filter(f => cat === "all" || f.category === cat);
  }, [country, cat]);

  const importIntlFeeds = async (subset: IntlFeed[]) => {
    if (importing) return;
    setImporting(true);
    try {
      const existing = new Set((await api.listFeeds()).map(f => f.url));
      const payload = subset
        .filter(f => !existing.has(f.url))
        .map(f => ({
          url: f.url,
          name: f.name,
          icon: f.flag,
          category: `بین‌الملل · ${f.categoryFa}`,
        }));
      if (payload.length === 0) {
        setImportedCount(0);
      } else {
        const r = await api.bulkAdd(payload);
        setImportedCount((r as any)?.added ?? payload.length);
      }
      await refreshRegistered();
      await loadIntl();
    } catch (e) {
      console.log("intl bulkAdd failed:", e);
      alert(`خطا در افزودن منابع بین‌المللی: ${e}`);
    } finally {
      setImporting(false);
      setTimeout(() => setImportedCount(null), 4000);
    }
  };

  const enriched = useMemo(() => {
    return articles.map(a => {
      const f = intlByName.get(a.source);
      return { article: a, feedCountry: f?.country || "", feedCategory: f?.category || "" };
    });
  }, [articles, intlByName]);

  const filteredArticles = useMemo(() => {
    return enriched
      .filter(e => country === "all" || e.feedCountry === country)
      .filter(e => cat === "all" || e.feedCategory === cat)
      .filter(e => !hideRead || !e.article.read)
      .map(e => e.article);
  }, [enriched, country, cat, hideRead]);

  const stats = useMemo(() => {
    const byCountry = new Map<string, number>();
    const byCat = new Map<string, number>();
    for (const e of enriched) {
      byCountry.set(e.feedCountry, (byCountry.get(e.feedCountry) || 0) + 1);
      byCat.set(e.feedCategory, (byCat.get(e.feedCategory) || 0) + 1);
    }
    return { byCountry, byCat };
  }, [enriched]);

  useEffect(() => {
    const root = scrollWrapRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(".overflow-y-auto");
    if (!el) return;
    const update = () => {
      const max = el.scrollHeight - el.clientHeight;
      const top = el.scrollTop;
      const pct = max > 0 ? Math.min(1, top / max) : 0;
      const total = filteredArticles.length || 1;
      const visibleFrom = Math.round(pct * Math.max(0, total - 1)) + 1;
      const approxVisible = Math.max(1, Math.round((el.clientHeight / Math.max(1, el.scrollHeight)) * total));
      const visibleTo = Math.min(total, visibleFrom + approxVisible - 1);
      setScroll({ pct, atTop: top < 4, atBottom: max - top < 4, visibleFrom, visibleTo });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, [filteredArticles.length]);

  const totalAvailable = allIntlNames.size;
  const onboardingNeeded = registeredCount === 0 && articles.length === 0 && !loading;

  if (onboardingNeeded) {
    return (
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 min-w-0">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto rounded-2xl border-2 border-dashed border-cyan-300 dark:border-cyan-900/60 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 p-8 text-center">
            <Globe2 className="w-12 h-12 mx-auto text-cyan-500 mb-3" />
            <h3 className="text-base mb-2">به اخبار بین‌الملل خوش آمدید</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
              {totalAvailable.toLocaleString("fa-IR")} منبع معتبر از ۵ کشور (آمریکا، بریتانیا، کانادا، استرالیا، هند) در سه دستهٔ عمومی، اقتصادی و سیاسی آمادهٔ افزودن است.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button onClick={() => importIntlFeeds(INTL_FEEDS.slice(0, 30))} disabled={importing}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm shadow-sm disabled:opacity-50 flex items-center gap-2">
                {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                افزودن ۳۰ منبع پرکاربرد
              </button>
              <button onClick={() => importIntlFeeds(INTL_FEEDS)} disabled={importing}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-cyan-400 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50">
                افزودن همه ({totalAvailable.toLocaleString("fa-IR")})
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "gdelt") {
    return (
      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full">
        <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-2 bg-white dark:bg-slate-950 z-20 shrink-0 flex items-center gap-1">
          <button onClick={() => setActiveTab("feeds")}
            className="text-[11px] px-2.5 py-1 rounded-full border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <Rss className="w-3 h-3" /> فیدها
          </button>
          <button onClick={() => setActiveTab("gdelt")}
            className="text-[11px] px-2.5 py-1 rounded-full border bg-violet-600 text-white border-violet-600 flex items-center gap-1">
            <Radar className="w-3 h-3" /> GDELT
          </button>
        </div>
        <GdeltExplorer />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full">
      <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 bg-white dark:bg-slate-950 z-20 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Globe2 className="w-4 h-4 text-cyan-600" />
          <button onClick={() => setActiveTab("feeds")}
            className="text-[11px] px-2 py-0.5 rounded-full border bg-cyan-600 text-white border-cyan-600 flex items-center gap-1">
            <Rss className="w-3 h-3" /> فیدها
          </button>
          <button onClick={() => setActiveTab("gdelt")}
            className="text-[11px] px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <Radar className="w-3 h-3" /> GDELT
          </button>
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span>{articles.length.toLocaleString("fa-IR")} مقاله از {registeredCount.toLocaleString("fa-IR")}/{totalAvailable.toLocaleString("fa-IR")} منبع</span>
            {progress && progress.total > 0 && (
              <>
                <span className="text-slate-400">·</span>
                <span className="flex items-center gap-1.5">
                  <Loader2 className={`w-3 h-3 ${loading ? "animate-spin" : "opacity-30"}`} />
                  در حال واکشی {progress.done.toLocaleString("fa-IR")}/{progress.total.toLocaleString("fa-IR")}
                </span>
                <div className="w-20 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-500 transition-all" style={{ width: `${Math.min(100, (progress.done / progress.total) * 100)}%` }} />
                </div>
              </>
            )}
          </div>
          <div className="flex-1" />
          <button onClick={() => importIntlFeeds(intlFeedsFiltered)} disabled={importing}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs">
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : importedCount !== null ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {importedCount !== null
              ? `${importedCount.toLocaleString("fa-IR")} افزوده شد`
              : `+${intlFeedsFiltered.length.toLocaleString("fa-IR")} منبع`}
          </button>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setCountry("all")}
            className={`text-[11px] px-2.5 py-1 rounded-full border ${country === "all" ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white" : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}>
            <Filter className="w-3 h-3 inline -mt-0.5" /> همه
          </button>
          {COUNTRY_ORDER.map(c => (
            <button key={c} onClick={() => setCountry(country === c ? "all" : c)}
              className={`text-[11px] px-2.5 py-1 rounded-full border flex items-center gap-1 ${country === c ? "bg-cyan-600 text-white border-cyan-600" : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}>
              <span>{COUNTRY_META[c].flag}</span>
              <span>{COUNTRY_META[c].name}</span>
              <span className="opacity-70 tabular-nums">{(stats.byCountry.get(c) || 0).toLocaleString("fa-IR")}</span>
            </button>
          ))}
          <span className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />
          {Object.entries(CAT_META).map(([key, meta]) => (
            <button key={key} onClick={() => setCat(cat === key ? "all" : key)}
              className={`text-[11px] px-2.5 py-1 rounded-full border ${cat === key ? "bg-rose-600 text-white border-rose-600" : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}>
              {meta.name} <span className="opacity-70 tabular-nums">{(stats.byCat.get(key) || 0).toLocaleString("fa-IR")}</span>
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={() => setHideRead(h => !h)}
            className={`text-[11px] px-2.5 py-1 rounded-full border flex items-center gap-1 ${hideRead ? "bg-amber-500 text-white border-amber-500" : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}>
            {hideRead ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {hideRead ? "فقط نخوانده" : "همه"}
          </button>
        </div>
      </div>

      <div ref={scrollWrapRef} className="flex-1 min-h-0 flex flex-col relative">
      <ArticleList
        articles={filteredArticles}
        selectedId={selectedId || null}
        setSelectedId={(id: string) => {
          const a = filteredArticles.find(x => x.id === id);
          if (a) onSelectArticle(a);
        }}
        viewMode={viewMode}
        setViewMode={setViewMode}
        title="اخبار بین‌الملل"
        toggleStar={onToggleStar || (() => {})}
        sortMode={sortMode}
        setSortMode={setSortMode}
        onRefresh={loadIntl}
        onMarkAllRead={onMarkAllRead}
        loading={loading}
      />

      <div className="pointer-events-none absolute top-2 bottom-2 left-1.5 w-1 rounded-full bg-slate-200/60 dark:bg-slate-800/60 overflow-hidden">
        <div
          className="absolute left-0 right-0 top-0 bg-gradient-to-b from-cyan-500 to-blue-600 rounded-full transition-[height] duration-100"
          style={{ height: `${Math.max(4, scroll.pct * 100)}%` }}
        />
      </div>

      {filteredArticles.length > 0 && (
        <div className="pointer-events-none absolute top-3 left-4 z-10">
          <div className="px-2.5 py-1 rounded-full bg-slate-900/85 dark:bg-white/90 text-white dark:text-slate-900 text-[11px] tabular-nums shadow-md backdrop-blur flex items-center gap-1.5">
            <span>{scroll.visibleFrom.toLocaleString("fa-IR")}–{scroll.visibleTo.toLocaleString("fa-IR")}</span>
            <span className="opacity-60">از</span>
            <span>{filteredArticles.length.toLocaleString("fa-IR")}</span>
            <span className="opacity-60">·</span>
            <span>{Math.round(scroll.pct * 100).toLocaleString("fa-IR")}٪</span>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 flex flex-col gap-2 z-10">
        {!scroll.atTop && (
          <button
            onClick={() => scrollTo("top")}
            className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md hover:shadow-lg flex items-center justify-center text-slate-700 dark:text-slate-200"
            title="بازگشت به ابتدا"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        )}
        {!scroll.atBottom && filteredArticles.length > 5 && (
          <button
            onClick={() => scrollTo("bottom")}
            className="w-9 h-9 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white shadow-md hover:shadow-lg flex items-center justify-center"
            title="پیمایش به انتها"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
