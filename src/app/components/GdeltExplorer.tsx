import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, Globe2, ExternalLink, RefreshCw, Newspaper, Tv, Sparkles, Map as MapIcon, Languages, Image as ImageIcon } from "lucide-react";
import {
  gdeltDoc, GDELT_PRESET_THEMES, GDELT_COUNTRIES, GDELT_LANGS,
  type GdeltArticle, type GdeltDocQuery,
} from "../gdelt";
import { GdeltTimeline } from "./GdeltTimeline";
import { GdeltTvGallery } from "./GdeltTvGallery";
import { GdeltThemeExplorer } from "./GdeltThemeExplorer";
import { GdeltCountryStrip } from "./GdeltCountryStrip";
import { GdeltGeoMap } from "./GdeltGeoMap";
import { GdeltImageGallery } from "./GdeltImageGallery";
import { GdeltWatchlistBar } from "./GdeltWatchlistBar";
import type { Watchlist } from "../gdeltWatchlist";
import { Button, Input, Tag, SegmentedControl, Badge, EmptyState, SkeletonRow } from "./kian";
import { toFa } from "./mobile/utils/fa";

const TIMESPANS: Array<{ value: string; label: string }> = [
  { value: "1h",  label: "۱ ساعت" },
  { value: "24h", label: "۲۴ ساعت" },
  { value: "7d",  label: "۷ روز" },
  { value: "1m",  label: "۱ ماه" },
];

const SORTS: Array<{ value: GdeltDocQuery["sort"]; label: string }> = [
  { value: "DateDesc",  label: "جدیدترین" },
  { value: "ToneDesc",  label: "مثبت‌ترین" },
  { value: "ToneAsc",   label: "منفی‌ترین" },
  { value: "HybridRel", label: "مرتبط‌ترین" },
];

function toneClasses(t?: number) {
  if (typeof t !== "number") return "bg-[var(--muted)] text-[var(--foreground-muted)]";
  if (t >= 3)  return "bg-[var(--success-50)] text-[var(--success-600)] dark:bg-[var(--success-900)]/40 dark:text-[oklch(0.85_0.13_155)]";
  if (t <= -3) return "bg-[var(--danger-50)]  text-[var(--danger-600)]  dark:bg-[var(--danger-900)]/40  dark:text-[oklch(0.82_0.16_25)]";
  return "bg-[var(--warning-50)] text-[var(--warning-600)] dark:bg-[var(--warning-900)]/40 dark:text-[oklch(0.85_0.13_75)]";
}

const GDELT_LAST_KEY = "gdelt.lastQuery";
function loadLast() {
  try { return JSON.parse(localStorage.getItem(GDELT_LAST_KEY) || "{}"); } catch { return {}; }
}

export function GdeltExplorer() {
  const initial = loadLast();
  const [q, setQ] = useState<string>(initial.q || "");
  const [lang, setLang] = useState<string>(initial.lang || "");
  const [country, setCountry] = useState<string>(initial.country || "");
  const [theme, setTheme] = useState<string>(initial.theme || "");
  const [timespan, setTimespan] = useState<string>(initial.timespan || "24h");
  const [sort, setSort] = useState<GdeltDocQuery["sort"]>(initial.sort || "DateDesc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [articles, setArticles] = useState<GdeltArticle[]>([]);
  const [view, setView] = useState<"articles" | "tv" | "themes" | "map" | "images">("articles");
  const [multilang, setMultilang] = useState<boolean>(initial.multilang || false);

  const canSearch = q.trim().length > 0 || theme || country;

  const search = async () => {
    if (!canSearch) return;
    setLoading(true);
    setError(null);
    try {
      if (multilang) {
        const langs = ["persian", "english", "arabic"];
        const results = await Promise.all(langs.map(l =>
          gdeltDoc({
            q: q.trim(), lang: l,
            country: country || undefined, theme: theme || undefined,
            timespan, sort, max: 50,
          }).catch(() => ({ articles: [] as GdeltArticle[] }))
        ));
        const merged = new Map<string, GdeltArticle>();
        for (const r of results) for (const a of (r.articles || [])) {
          if (!merged.has(a.id)) merged.set(a.id, a);
        }
        setArticles(Array.from(merged.values()));
      } else {
        const r = await gdeltDoc({
          q: q.trim(), lang: lang || undefined,
          country: country || undefined, theme: theme || undefined,
          timespan, sort, max: 75,
        });
        setArticles(r.articles || []);
      }
    } catch (e: any) {
      console.error("GDELT search failed:", e);
      setError(String(e?.message || e));
      setArticles([]);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (canSearch) search();
    try { localStorage.setItem(GDELT_LAST_KEY, JSON.stringify({ q, lang, country, theme, timespan, sort, multilang })); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, country, timespan, sort, lang, multilang]);

  const applyWatchlist = (w: Watchlist) => {
    setQ(w.query.q || "");
    setLang(w.query.lang || "");
    setCountry(w.query.country || "");
    setTheme(w.query.theme || "");
    setTimespan(w.query.timespan || "24h");
    setSort((w.query.sort as GdeltDocQuery["sort"]) || "DateDesc");
    setMultilang(!!w.multilang);
  };

  const grouped = useMemo(() => {
    const m = new Map<string, GdeltArticle[]>();
    for (const a of articles) {
      const k = a.sourceCountry || "??";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [articles]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--background)] text-[var(--foreground)]" dir="rtl">
      <div className="border-b border-[var(--border)] px-5 py-3.5 space-y-3 bg-[var(--background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/75 sticky top-0 z-[var(--z-sticky)]">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-[var(--radius-md)] bg-[var(--brand-50)] dark:bg-[oklch(0.30_0.10_258)] flex items-center justify-center shrink-0">
            <Globe2 className="w-4 h-4 text-[var(--brand-600)] dark:text-[var(--brand-300)]" />
          </div>
          <div className="flex flex-col leading-none">
            <h2 className="text-display text-[15px] font-semibold tracking-tight">جام جهان‌نما</h2>
            <span className="text-[11px] text-[var(--foreground-subtle)] mt-0.5">جهان از منظر رسانه‌ها</span>
          </div>
          <Badge tone="brand" variant="soft" size="xs" className="ms-1">
            {articles.length.toLocaleString("fa-IR")} مقاله
          </Badge>

          <div className="flex-1" />

          <SegmentedControl<typeof view>
            value={view}
            onChange={setView}
            items={[
              { value: "articles", label: "مقالات",   icon: <Newspaper className="size-3" /> },
              { value: "tv",       label: "تلویزیون", icon: <Tv className="size-3" /> },
              { value: "themes",   label: "موضوعات",  icon: <Sparkles className="size-3" /> },
              { value: "map",      label: "نقشه",     icon: <MapIcon className="size-3" /> },
              { value: "images",   label: "تصاویر",   icon: <ImageIcon className="size-3" /> },
            ]}
          />

          <Button
            variant={multilang ? "primary" : "ghost"}
            size="sm"
            onClick={() => setMultilang(v => !v)}
            title={multilang ? "حالت چندزبانه فعال (فارسی + انگلیسی + عربی)" : "فعال‌سازی جستجوی چندزبانه"}
            className={multilang ? "!bg-[oklch(0.55_0.22_305)] hover:!bg-[oklch(0.50_0.22_305)]" : ""}
            iconLeading={<Languages className="size-3.5" />}
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={search}
            disabled={loading || !canSearch}
            iconLeading={<RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />}
          />
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") search(); }}
            placeholder="جستجوی فول‌متن — مثلاً: ایران تحریم، Iran sanctions، پروتست..."
            iconLeading={<Search className="size-3.5" />}
            size="md"
            className="flex-1"
          />
          <select value={timespan} onChange={(e) => setTimespan(e.target.value)}
            className="text-xs bg-[var(--input-background)] border border-[var(--input-border)] rounded-[var(--radius-md)] px-2.5 h-9 outline-none focus:border-[var(--brand-500)] focus:shadow-[var(--shadow-focus)]">
            {TIMESPANS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as any)}
            className="text-xs bg-[var(--input-background)] border border-[var(--input-border)] rounded-[var(--radius-md)] px-2.5 h-9 outline-none focus:border-[var(--brand-500)] focus:shadow-[var(--shadow-focus)]">
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={lang} onChange={(e) => setLang(e.target.value)}
            className="text-xs bg-[var(--input-background)] border border-[var(--input-border)] rounded-[var(--radius-md)] px-2.5 h-9 outline-none focus:border-[var(--brand-500)] focus:shadow-[var(--shadow-focus)]">
            <option value="">همهٔ زبان‌ها</option>
            {GDELT_LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
          <span className="text-[10px] text-[var(--foreground-subtle)] shrink-0 font-medium uppercase tracking-wider">کشورها</span>
          {GDELT_COUNTRIES.map(c => (
            <Tag key={c.code}
              active={country === c.code}
              tone="brand"
              leading={<span>{c.flag}</span>}
              onClick={() => setCountry(country === c.code ? "" : c.code)}>
              {c.label}
            </Tag>
          ))}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
          <span className="text-[10px] text-[var(--foreground-subtle)] shrink-0 font-medium uppercase tracking-wider">موضوعات</span>
          {GDELT_PRESET_THEMES.map(t => (
            <Tag key={t.code}
              active={theme === t.code}
              tone="violet"
              leading={<span>{t.icon}</span>}
              onClick={() => setTheme(theme === t.code ? "" : t.code)}>
              {t.label}
            </Tag>
          ))}
        </div>
      </div>

      <GdeltWatchlistBar
        current={{ q: q.trim(), lang: lang || undefined, country: country || undefined, theme: theme || undefined, timespan, sort }}
        multilang={multilang}
        onApply={applyWatchlist}
      />

      {view === "articles" && (
        <GdeltTimeline
          enabled={canSearch && articles.length > 0}
          query={{
            q: q.trim(),
            lang: lang || undefined,
            country: country || undefined,
            theme: theme || undefined,
            timespan,
          }}
        />
      )}

      {view === "tv" ? (
        <GdeltTvGallery q={q.trim()} timespan={timespan === "1h" ? "1d" : timespan} />
      ) : view === "themes" ? (
        <GdeltThemeExplorer
          country={country || undefined}
          lang={lang || undefined}
          timespan={timespan}
          onPickTheme={(code) => { setTheme(code); setView("articles"); }}
        />
      ) : view === "images" ? (
        <GdeltImageGallery articles={articles} />
      ) : view === "map" ? (
        <GdeltGeoMap query={{
          q: q.trim(),
          lang: lang || undefined,
          country: country || undefined,
          theme: theme || undefined,
          timespan,
        }} />
      ) : (
      <>
      <GdeltCountryStrip articles={articles} activeCountry={country} onPick={setCountry} />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && articles.length === 0 && (
          <div>{Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}</div>
        )}
        {error && (
          <div className="m-4 p-3 rounded-[var(--radius-md)] bg-[var(--danger-50)] dark:bg-[var(--danger-900)]/40 text-[var(--danger-600)] dark:text-[oklch(0.82_0.16_25)] text-sm border border-[var(--danger-500)]/20">
            خطا در دریافت داده‌ها: {error}
          </div>
        )}
        {!loading && articles.length === 0 && !error && (
          <EmptyState
            size="lg"
            icon={<Globe2 className="size-full" />}
            title="جهان در انتظار جستجوی شماست"
            description="با وارد کردن یک کلیدواژه، انتخاب کشور یا موضوع، کاوش در میلیون‌ها مقالهٔ جهانی را آغاز کنید."
          />
        )}

        {grouped.map(([country, list]) => (
          <section key={country}>
            <header className="sticky top-0 z-[1] bg-[var(--background-subtle)]/95 backdrop-blur-sm px-5 py-1.5 text-[11px] flex items-center gap-2 border-b border-[var(--border-subtle)]">
              <Badge tone="neutral" variant="dot" size="xs">
                <span className="font-mono tracking-wide">{country}</span>
              </Badge>
              <span className="text-[var(--foreground-subtle)]">·</span>
              <span className="text-[var(--foreground-muted)] tabular-nums">{list.length.toLocaleString("fa-IR")} مقاله</span>
            </header>
            {list.map(a => (
              <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
                className="group flex items-start gap-3 px-5 py-3 border-b border-[var(--border-subtle)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--background-subtle)]">
                {a.image && (
                  <img src={a.image} alt="" loading="lazy"
                    className="size-14 rounded-[var(--radius-md)] object-cover shrink-0 bg-[var(--muted)] ring-1 ring-[var(--border-subtle)]"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] leading-[1.55] line-clamp-2 group-hover:text-[var(--brand-600)] dark:group-hover:text-[var(--brand-300)] transition-colors">{a.title}</div>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--foreground-subtle)] mt-1.5 flex-wrap">
                    <span className="truncate max-w-[180px] font-medium text-[var(--foreground-muted)]">{a.domain}</span>
                    <span className="text-[var(--border-strong)]">·</span>
                    <span className="font-mono uppercase tracking-wide text-[10px]">{a.language}</span>
                    {a.date && <>
                      <span className="text-[var(--border-strong)]">·</span>
                      <span className="tabular-nums">{new Date(a.date).toLocaleString("fa-IR", { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}</span>
                    </>}
                    {typeof a.tone === "number" && (
                      <span className={`px-1.5 py-0.5 rounded-[var(--radius-xs)] tabular-nums font-mono text-[10px] ${toneClasses(a.tone)}`}>
                        لحن {toFa(a.tone.toFixed(1))}
                      </span>
                    )}
                    <ExternalLink className="size-3 mr-auto opacity-0 group-hover:opacity-50 transition-opacity" />
                  </div>
                </div>
              </a>
            ))}
          </section>
        ))}
      </div>
      </>
      )}
    </div>
  );
}
