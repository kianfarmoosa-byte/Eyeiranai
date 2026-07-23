import { useEffect, useMemo, useState } from "react";
import { Globe2, Loader2, RefreshCcw, ExternalLink, Languages, Filter } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { useHaptics } from "../hooks";
import { useToast } from "../primitives/Toast";
import { INTL_FEEDS, type IntlFeed } from "../../../internationalFeeds";
import { api, type RemoteArticle } from "../../../api";
import { translateText } from "../ai/translate";
import { studioUserId } from "../studio/studio";
import { getTitleFa, setTitleFa, translateTitlesFa } from "../../../translationCache";
import { timeAgoFa, faNum } from "../utils/fa";
import type { Article } from "../../../data";

type Props = {
  /** When embedded as a bottom-nav tab, the back button is hidden. */
  embedded?: boolean;
  onClose?: () => void;
  onOpenArticle?: (a: Article) => void;
};

const ALL = "all";
const KEY_IMPORTED = "kian.mobile.intlFeedsImported.v1";

/** Heuristic: a title with meaningful Latin content and little/no Persian text
 * is treated as non-Persian and gets a translate button. */
function looksNonPersian(s: string): boolean {
  if (!s) return false;
  const fa = (s.match(/[؀-ۿ]/g) || []).length;
  const latin = (s.match(/[A-Za-z]/g) || []).length;
  return latin >= 3 && fa < latin;
}

/**
 * Mobile "International News" screen. Pulls the curated feed list from
 * internationalFeeds.ts (derived from the bundled CSV), imports them into the
 * backend on first visit so the server can fetch + parse RSS, then shows
 * translated Persian headlines alongside the original.
 */
export function InternationalNewsScreen({ embedded = false, onClose, onOpenArticle }: Props) {
  const haptic = useHaptics();
  const toast = useToast();
  const [articles, setArticles] = useState<RemoteArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showFa, setShowFa] = useState(true);
  const [country, setCountry] = useState<string>(ALL);
  const [cat, setCat] = useState<string>(ALL);
  // Real AI translations of headlines, cached by original title (seeded from the
  // shared client cache so previously-translated titles show instantly).
  const [faMap, setFaMap] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState(false);
  // Per-card translation state (independent of the global "showFa" toggle):
  // ids the user explicitly translated, and ids currently being translated.
  const [perFa, setPerFa] = useState<Set<string>>(new Set());
  const [perTranslating, setPerTranslating] = useState<Set<string>>(new Set());

  // Translate a single headline to Persian on demand (per-card icon tap).
  const translateOne = async (a: RemoteArticle) => {
    haptic("tap");
    const title = a.title;
    if (!title) return;
    if (perFa.has(a.id)) { // already showing → toggle back to original
      setPerFa(prev => { const n = new Set(prev); n.delete(a.id); return n; });
      return;
    }
    const cached = faMap[title] || getTitleFa(title);
    if (cached) {
      if (!faMap[title]) setFaMap(m => ({ ...m, [title]: cached }));
      setPerFa(prev => new Set(prev).add(a.id));
      return;
    }
    setPerTranslating(prev => new Set(prev).add(a.id));
    try {
      const out = await api.aiTranslateBatch({ texts: [title], to: "fa" }, studioUserId());
      if (out[0] && out[0].trim()) {
        setTitleFa(title, out[0].trim());
        setFaMap(m => ({ ...m, [title]: out[0].trim() }));
        setPerFa(prev => new Set(prev).add(a.id));
      } else {
        toast({ kind: "error", message: "ترجمه ناموفق بود" });
      }
    } catch (e) {
      console.log("intl per-card translate failed:", e);
      toast({ kind: "error", message: "ترجمه ناموفق بود" });
    } finally {
      setPerTranslating(prev => { const n = new Set(prev); n.delete(a.id); return n; });
    }
  };

  const intlByName = useMemo(() => {
    const m = new Map<string, IntlFeed>();
    for (const f of INTL_FEEDS) if (!m.has(f.name)) m.set(f.name, f);
    return m;
  }, []);

  const countries = useMemo(() => {
    const counts = new Map<string, { meta: { flag: string; name: string }; n: number }>();
    for (const f of INTL_FEEDS) {
      const e = counts.get(f.country);
      if (e) e.n++;
      else counts.set(f.country, { meta: { flag: f.flag, name: f.countryName }, n: 1 });
    }
    return [...counts.entries()].sort((a, b) => b[1].n - a[1].n);
  }, []);

  const categories = useMemo(() => {
    const set = new Map<string, string>();
    for (const f of INTL_FEEDS) if (!set.has(f.category)) set.set(f.category, f.categoryFa);
    return [...set.entries()];
  }, []);

  // Self-healing reconcile: adds any international feeds missing on the server
  // AND removes stale international feeds that were imported previously but have
  // since been dropped from INTL_FEEDS (e.g. dead links, or removed African /
  // human-rights sources). Idempotent — only touches the server on a diff.
  const syncFeeds = async () => {
    try {
      const validUrls = new Set(INTL_FEEDS.map((f) => f.url));
      const server = await api.listFeeds();
      const serverUrls = new Set(server.map((f) => f.url));

      const toAdd = INTL_FEEDS
        .filter((f) => !serverUrls.has(f.url))
        .map((f) => ({
          url: f.url,
          name: f.nameFa || f.name,
          icon: f.flag,
          category: `بین‌الملل · ${f.countryName} · ${f.categoryFa}`,
        }));

      // Only prune feeds we own (international ones), never user-added feeds.
      const toRemove = server.filter(
        (f) => typeof f.category === "string" && f.category.startsWith("بین‌الملل") && !validUrls.has(f.url),
      );

      if (toAdd.length === 0 && toRemove.length === 0) return;
      setImporting(true);
      if (toAdd.length > 0) await api.bulkAdd(toAdd);
      for (const f of toRemove) {
        try { await api.removeFeed(f.id); } catch (e) { console.log("intl remove stale feed failed:", f.url, e); }
      }
      const parts: string[] = [];
      if (toAdd.length) parts.push(`${faNum(toAdd.length)} منبع افزوده شد`);
      if (toRemove.length) parts.push(`${faNum(toRemove.length)} منبع حذف شد`);
      if (parts.length) toast({ kind: "success", message: parts.join(" · ") });
      try { localStorage.setItem(KEY_IMPORTED, "1"); } catch {}
    } catch (e) {
      console.log("intl syncFeeds failed:", e);
      toast({ kind: "error", message: "همگام‌سازی منابع شکست خورد" });
    } finally {
      setImporting(false);
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const PAGE = 60;
      const seen = new Map<string, RemoteArticle>();
      let offset = 0;
      let total = 0;
      do {
        const page = await api.listArticlesPage({
          category: "بین‌الملل",
          limit: PAGE,
          offset,
        });
        for (const a of page.articles) {
          const key = (a.link || a.id || "").toLowerCase().replace(/[?#].*$/, "");
          if (!seen.has(key)) seen.set(key, a);
        }
        total = page.total || 0;
        offset += PAGE;
      } while (offset < total && offset < 240);
      setArticles([...seen.values()]);
    } catch (e) {
      console.log("intl refresh failed:", e);
      toast({ kind: "error", message: "خطا در بارگذاری اخبار" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await syncFeeds();
      await refresh();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enriched = useMemo(() => {
    return articles.map((a) => {
      const f = intlByName.get(a.source);
      return {
        article: a,
        country: f?.country ?? "",
        countryName: f?.countryName ?? "",
        flag: f?.flag ?? "🌐",
        category: f?.category ?? "",
        categoryFa: f?.categoryFa ?? "",
      };
    });
  }, [articles, intlByName]);

  const filtered = useMemo(() => {
    return enriched
      .filter((e) => country === ALL || e.country === country)
      .filter((e) => cat === ALL || e.category === cat)
      .sort((a, b) => +new Date(b.article.date) - +new Date(a.article.date));
  }, [enriched, country, cat]);

  // When Persian view is on, translate visible headlines with the real LLM
  // (batched + server-cached), falling back to the offline heuristic instantly.
  useEffect(() => {
    if (!showFa) return;
    const titles = Array.from(new Set(filtered.slice(0, 100).map((e) => e.article.title))).filter((t) => t && !faMap[t]);
    if (titles.length === 0) return;
    // Seed instantly from the client cache; only translate what's still missing.
    const seeded: Record<string, string> = {};
    const stillMissing: string[] = [];
    for (const t of titles) { const c = getTitleFa(t); if (c) seeded[t] = c; else stillMissing.push(t); }
    if (Object.keys(seeded).length) setFaMap((m) => ({ ...m, ...seeded }));
    if (stillMissing.length === 0) return;
    let cancelled = false;
    (async () => {
      setTranslating(true);
      try {
        for (let i = 0; i < stillMissing.length; i += 30) {
          const chunk = stillMissing.slice(i, i + 30);
          const map = await translateTitlesFa(chunk);
          if (cancelled) return;
          setFaMap((m) => ({ ...m, ...map }));
        }
      } catch (e) {
        console.log("intl batch translate failed:", e);
      } finally {
        if (!cancelled) setTranslating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showFa, filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (a: RemoteArticle) => {
    if (!onOpenArticle) return;
    haptic("tap");
    const f = intlByName.get(a.source);
    const adapted: Article = {
      ...a,
      category: f ? `بین‌الملل · ${f.categoryFa}` : "بین‌الملل",
      dateMs: new Date(a.date).getTime() || Date.now(),
      tags: a.tags ?? [],
    };
    onOpenArticle(adapted);
  };

  return (
    <MobileScreen
      topbar={
        <MobileTopBar
          title="اخبار بین‌المللی"
          onBack={embedded ? undefined : onClose}
          trailing={
            <div className="flex items-center gap-1">
              <button
                onClick={() => { haptic("select"); setShowFa((v) => !v); }}
                className="size-9 grid place-items-center rounded-full tap press active:bg-[var(--accent)]"
                aria-label={showFa ? "نمایش زبان اصلی" : "نمایش ترجمه فارسی"}
                title={showFa ? "نمایش زبان اصلی" : "نمایش ترجمه فارسی"}
              >
                {translating ? <Loader2 className="size-5 animate-spin text-[var(--brand-500)]" /> : <Languages className={`size-5 ${showFa ? "text-[var(--brand-500)]" : ""}`} />}
              </button>
              <button
                onClick={() => { haptic("select"); refresh(); }}
                disabled={loading}
                className="size-9 grid place-items-center rounded-full tap press active:bg-[var(--accent)] disabled:opacity-50"
                aria-label="بازآوری"
              >
                {loading ? <Loader2 className="size-5 animate-spin" /> : <RefreshCcw className="size-5" />}
              </button>
            </div>
          }
        />
      }
    >
      <div className="h-full overflow-y-auto scrollbar-none pb-6">
        {/* Hero strip */}
        <div className="mx-3 mt-3 rounded-[var(--radius-lg)] p-4 bg-gradient-to-br from-emerald-500 via-emerald-500 to-violet-600 text-white shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <Globe2 className="size-5" />
            <div className="text-[14px] font-bold">شبکهٔ منابع جهانی</div>
          </div>
          <div className="text-[11.5px] opacity-90 leading-relaxed">
            {faNum(INTL_FEEDS.length)} فید از {faNum(countries.length)} کشور و منطقه — سرخط‌ها به‌صورت لحظه‌ای از RSS استخراج و در صورت تمایل به فارسی پیش‌نمایش می‌شوند.
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {countries.slice(0, 8).map(([code, { meta, n }]) => (
              <span key={code} className="text-[10px] bg-white/15 backdrop-blur px-2 py-0.5 rounded-full">
                {meta.flag} {meta.name} · {faNum(n)}
              </span>
            ))}
          </div>
        </div>

        {/* Filter chips */}
        <div className="mt-3 px-3 flex items-center gap-1.5 overflow-x-auto scrollbar-none whitespace-nowrap">
          <Chip on={country === ALL} onClick={() => setCountry(ALL)} label="همه کشورها" icon={<Filter className="size-3" />} />
          {countries.map(([code, { meta, n }]) => (
            <Chip
              key={code}
              on={country === code}
              onClick={() => setCountry(country === code ? ALL : code)}
              label={`${meta.flag} ${meta.name}`}
              count={n}
            />
          ))}
        </div>
        <div className="mt-2 px-3 flex items-center gap-1.5 overflow-x-auto scrollbar-none whitespace-nowrap">
          <Chip on={cat === ALL} onClick={() => setCat(ALL)} label="همه دسته‌ها" />
          {categories.map(([key, label]) => (
            <Chip
              key={key}
              on={cat === key}
              onClick={() => setCat(cat === key ? ALL : key)}
              label={label}
            />
          ))}
        </div>

        {/* Status */}
        {(importing || (loading && articles.length === 0)) && (
          <div className="mt-6 text-center text-[12.5px] text-[var(--foreground-subtle)] flex items-center gap-2 justify-center">
            <Loader2 className="size-4 animate-spin" />
            {importing ? "در حال افزودن منابع به سرور…" : "در حال واکشی اخبار جهانی…"}
          </div>
        )}

        {!loading && !importing && filtered.length === 0 && (
          <EmptyState onRefresh={refresh} />
        )}

        {/* Articles */}
        <ul className="mt-3 px-3 space-y-2">
          {filtered.slice(0, 100).map(({ article, flag, countryName, categoryFa }) => {
            const wantFa = showFa || perFa.has(article.id);
            const titleFa = wantFa ? (faMap[article.title] || translateText(article.title, "fa")) : null;
            const isNonFa = looksNonPersian(article.title);
            const busy = perTranslating.has(article.id);
            const showingFa = perFa.has(article.id);
            return (
              <li key={article.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => open(article)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(article); } }}
                  className="w-full text-right rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)] p-3 tap press active:bg-[var(--accent)] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--foreground-subtle)] mb-1">
                    <span aria-hidden>{flag}</span>
                    <span className="truncate">{article.source}</span>
                    <span className="opacity-50">·</span>
                    <span className="truncate">{countryName}</span>
                    {categoryFa && (<><span className="opacity-50">·</span><span>{categoryFa}</span></>)}
                    <span className="flex-1" />
                    <span>{timeAgoFa(new Date(article.date).getTime())}</span>
                    {isNonFa && (
                      <button
                        onClick={(e) => { e.stopPropagation(); translateOne(article); }}
                        disabled={busy}
                        aria-label={showingFa ? "نمایش تیتر اصلی" : "ترجمهٔ تیتر به فارسی"}
                        title={showingFa ? "نمایش تیتر اصلی" : "ترجمهٔ تیتر به فارسی"}
                        className={`shrink-0 size-6 -my-1 grid place-items-center rounded-full tap press transition-colors ${showingFa ? "bg-[var(--brand-500)] text-white" : "text-[var(--brand-500)] active:bg-[var(--accent)]"}`}
                      >
                        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Languages className="size-3.5" />}
                      </button>
                    )}
                  </div>
                  {wantFa && titleFa && (
                    <div dir="rtl" lang="fa" className="text-[14px] font-bold leading-snug">
                      {titleFa}
                    </div>
                  )}
                  <div
                    dir="ltr"
                    lang="en"
                    className={`text-[12.5px] leading-snug ${wantFa ? "mt-1 text-[var(--foreground-muted)]" : "text-[var(--foreground)] font-semibold"}`}
                  >
                    {article.title}
                  </div>
                  {article.link && (
                    <div className="mt-2 flex items-center gap-1 text-[10.5px] text-[var(--brand-500)]">
                      <ExternalLink className="size-3" />
                      <span dir="ltr" className="truncate">{safeHost(article.link)}</span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {filtered.length > 100 && (
          <div className="mt-3 text-center text-[11px] text-[var(--foreground-subtle)]">
            {faNum(100)} از {faNum(filtered.length)} نمایش داده شد
          </div>
        )}
      </div>
    </MobileScreen>
  );
}

function Chip({ on, onClick, label, count, icon }: {
  on: boolean; onClick: () => void; label: string; count?: number; icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[11.5px] tap press transition-colors border ${
        on
          ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]"
          : "bg-[var(--surface)] text-[var(--foreground)] border-[var(--border-subtle)]"
      }`}
    >
      {icon}
      <span>{label}</span>
      {typeof count === "number" && (
        <span className={`tabular-nums text-[10px] ${on ? "opacity-90" : "text-[var(--foreground-subtle)]"}`}>
          {faNum(count)}
        </span>
      )}
    </button>
  );
}

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="mt-12 mx-6 text-center">
      <div className="mx-auto size-14 rounded-full grid place-items-center bg-[var(--accent)] text-[var(--foreground-muted)] mb-3">
        <Globe2 className="size-6" />
      </div>
      <div className="text-[13.5px] font-semibold">هنوز خبری نرسیده</div>
      <div className="mt-1 text-[12px] text-[var(--foreground-subtle)] leading-relaxed">
        منابع به سرور افزوده شدند ولی واکشی اولیه ممکن است چند لحظه طول بکشد.
      </div>
      <button
        onClick={onRefresh}
        className="mt-4 inline-flex items-center gap-1.5 px-4 h-10 rounded-full bg-[var(--brand-500)] text-white text-[12.5px] font-semibold tap press active:bg-[var(--brand-600)]"
      >
        <RefreshCcw className="size-4" /> تلاش دوباره
      </button>
    </div>
  );
}

function safeHost(url: string): string {
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return url; }
}
