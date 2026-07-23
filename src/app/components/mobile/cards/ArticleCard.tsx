import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, Languages, Loader2 } from "lucide-react";
import type { Article } from "../../../data";
import { ImageWithFallback } from "../../figma/ImageWithFallback";
import { useHaptics, useLongPress } from "../hooks";
import { timeAgoFa } from "../utils/fa";
import { getTitleFa, translateTitlesFa, useAutoTranslateTitles } from "../../../translationCache";

type Props = {
  article: Article;
  onOpen: (a: Article) => void;
  onToggleSave?: (a: Article) => void;
  onLongPress?: (a: Article) => void;
  /** "feed" = image-leading card; "compact" = no image; "hero" = large image on top. */
  variant?: "feed" | "compact" | "hero";
};

/** Heuristic: a title with meaningful Latin content and little/no Persian text
 * is treated as non-Persian and gets a translate button. */
function looksNonPersian(s: string): boolean {
  if (!s) return false;
  const fa = (s.match(/[؀-ۿ]/g) || []).length;
  const latin = (s.match(/[A-Za-z]/g) || []).length;
  return latin >= 3 && fa < latin;
}

export function ArticleCard({ article, onOpen, onToggleSave, onLongPress, variant = "feed" }: Props) {
  const haptic = useHaptics();
  const { didFire: _didFire, ...lp } = useLongPress(() => { haptic("heavy"); onLongPress?.(article); }, 480);
  void _didFire;

  // Per-card headline translation to Persian (mirrors the international screen).
  // Uses the shared client cache so a title is only ever translated once.
  const isNonFa = looksNonPersian(article.title);
  const auto = useAutoTranslateTitles();
  const initialCached = getTitleFa(article.title) ?? null;
  const [faTitle, setFaTitle] = useState<string | null>(initialCached);
  const [showFa, setShowFa] = useState(false);
  const [translating, setTranslating] = useState(false);
  // Whether the currently-shown translation was served instantly from cache
  // (no network round-trip) — drives the small "از کش" indicator.
  const [fromCache, setFromCache] = useState(false);

  const toggleTranslate = async () => {
    haptic("tap");
    if (showFa) { setShowFa(false); return; }
    const cached = faTitle || getTitleFa(article.title);
    if (cached) { setFaTitle(cached); setFromCache(true); setShowFa(true); return; }
    setTranslating(true);
    try {
      const map = await translateTitlesFa([article.title]);
      const fa = map[article.title];
      if (fa) { setFaTitle(fa); setFromCache(false); setShowFa(true); }
    } catch (e) {
      console.log("card title translate failed:", e);
    } finally {
      setTranslating(false);
    }
  };

  // Auto-translate all non-Persian headlines when the global setting is on.
  useEffect(() => {
    if (!auto || !isNonFa || showFa) return;
    const cached = getTitleFa(article.title);
    if (cached) { setFaTitle(cached); setFromCache(true); setShowFa(true); return; }
    let cancelled = false;
    (async () => {
      setTranslating(true);
      try {
        const map = await translateTitlesFa([article.title]);
        if (cancelled) return;
        const fa = map[article.title];
        if (fa) { setFaTitle(fa); setFromCache(false); setShowFa(true); }
      } catch (e) {
        if (!cancelled) console.log("card auto-translate failed:", e);
      } finally {
        if (!cancelled) setTranslating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [auto, isNonFa, article.title]);  // eslint-disable-line react-hooks/exhaustive-deps

  const displayTitle = showFa && faTitle ? faTitle : article.title;
  const showCacheBadge = showFa && !!faTitle && fromCache;

  const TransBtn = isNonFa ? (
    <button
      onClick={(e) => { e.stopPropagation(); toggleTranslate(); }}
      disabled={translating}
      aria-label={showFa ? "نمایش تیتر اصلی" : "ترجمهٔ تیتر به فارسی"}
      title={showFa ? "نمایش تیتر اصلی" : "ترجمهٔ تیتر به فارسی"}
      className={`shrink-0 size-9 grid place-items-center rounded-full tap press transition-colors ${showFa ? "text-[var(--brand-500)]" : "text-[var(--foreground-muted)] active:bg-[var(--accent)]"}`}
    >
      {translating ? <Loader2 className="size-5 animate-spin" /> : <Languages className="size-5" />}
    </button>
  ) : null;

  const CacheBadge = showCacheBadge ? (
    <span
      title="ترجمهٔ فوری از حافظهٔ محلی"
      className="shrink-0 inline-flex items-center gap-0.5 px-1.5 h-4 rounded-full bg-[var(--brand-500)]/12 text-[var(--brand-500)] text-[9px] font-semibold"
    >
      از کش
    </span>
  ) : null;

  const Save = (
    <button
      onClick={(e) => { e.stopPropagation(); haptic("select"); onToggleSave?.(article); }}
      aria-label={article.starred ? "حذف از ذخیره" : "ذخیره"}
      className="shrink-0 size-9 grid place-items-center rounded-full tap press active:bg-[var(--accent)] text-[var(--foreground-muted)]"
    >
      {article.starred ? <BookmarkCheck className="size-5 text-[var(--brand-500)]" /> : <Bookmark className="size-5" />}
    </button>
  );

  if (variant === "hero") {
    return (
      <article
        onClick={() => { haptic("tap"); onOpen(article); }}
        {...lp}
        className="tap press rounded-[var(--radius-lg)] overflow-hidden bg-[var(--surface)] border border-[var(--border-subtle)]"
      >
        {article.image && (
          <ImageWithFallback src={article.image} alt={article.title} className="w-full aspect-[16/9] object-cover" />
        )}
        <div className="p-3.5 flex flex-col gap-1.5">
          <Meta a={article} />
          <h3 dir={showFa && faTitle ? "rtl" : undefined} className="text-[16px] leading-snug font-semibold line-clamp-3">
            {CacheBadge && <>{CacheBadge} </>}{displayTitle}
          </h3>
          <p className="text-[13px] text-[var(--foreground-muted)] line-clamp-2">{article.preview}</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[11.5px] text-[var(--foreground-subtle)]">{article.readTime}</span>
            <div className="flex items-center gap-0.5">{TransBtn}{Save}</div>
          </div>
        </div>
      </article>
    );
  }

  if (variant === "compact") {
    return (
      <article
        onClick={() => { haptic("tap"); onOpen(article); }}
        {...lp}
        className="tap press flex items-start gap-3 px-4 py-3 active:bg-[var(--accent)]/40"
      >
        <div className="flex-1 min-w-0">
          <Meta a={article} />
          <h3 dir={showFa && faTitle ? "rtl" : undefined} className="text-[14.5px] leading-snug font-semibold line-clamp-2 mt-0.5">
            {CacheBadge && <>{CacheBadge} </>}{displayTitle}
          </h3>
          <p className="text-[12.5px] text-[var(--foreground-muted)] mt-0.5">{article.readTime}</p>
        </div>
        {TransBtn}
        {Save}
      </article>
    );
  }

  return (
    <article
      onClick={() => { haptic("tap"); onOpen(article); }}
      {...lp}
      className="tap press flex items-stretch gap-3 px-4 py-3 active:bg-[var(--accent)]/40"
    >
      <div className="flex-1 min-w-0 flex flex-col">
        <Meta a={article} />
        <h3 dir={showFa && faTitle ? "rtl" : undefined} className="text-[15px] leading-snug font-semibold line-clamp-3 mt-0.5">
          {CacheBadge && <>{CacheBadge} </>}{displayTitle}
        </h3>
        <p className="text-[12.5px] text-[var(--foreground-muted)] line-clamp-2 mt-1">{article.preview}</p>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[11.5px] text-[var(--foreground-subtle)]">{article.readTime}</span>
          <div className="flex items-center gap-0.5">{TransBtn}{Save}</div>
        </div>
      </div>
      {article.image && (
        <ImageWithFallback
          src={article.image}
          alt={article.title}
          className="shrink-0 size-[88px] rounded-[var(--radius-md)] object-cover"
        />
      )}
    </article>
  );
}

function Meta({ a }: { a: Article }) {
  return (
    <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--foreground-subtle)]">
      <span aria-hidden>{a.sourceIcon}</span>
      <span className="truncate max-w-[120px]">{a.source}</span>
      <span>·</span>
      <span className="truncate">{a.dateMs ? timeAgoFa(a.dateMs) : a.date}</span>
      {!a.read && <span className="ms-1 size-1.5 rounded-full bg-[var(--brand-500)]" aria-label="نخوانده" />}
    </div>
  );
}
