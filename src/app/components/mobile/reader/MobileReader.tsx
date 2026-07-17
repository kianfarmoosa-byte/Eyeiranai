import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Bookmark, BookmarkCheck, Share2, Type, ExternalLink, Play, Pause, Square, NotebookPen, GitCompare, Clock, Languages, ChevronRight, ChevronLeft, Bold, ArrowUp } from "lucide-react";
import type { Article } from "../../../data";
import { ImageWithFallback } from "../../figma/ImageWithFallback";
import { useBodyScrollLock, useEdgeSwipe, useHaptics, usePrefersReducedMotion, useTTS, useTextSelection } from "../hooks";
import { SummaryCard } from "../ai/SummaryCard";
import { AskArticleSheet } from "../ai/AskArticleSheet";
import { QualityInsights } from "../ai/QualityInsights";
import { HighlightBar } from "./HighlightBar";
import { RelatedStrip } from "./RelatedStrip";
import { DetailedArticleHeader } from "./DetailedArticleHeader";
import { CompareSourcesSheet } from "./CompareSourcesSheet";
import { EventTimelineSheet } from "./EventTimelineSheet";
import { translateText, TRANSLATION_DISCLAIMER_EN, TRANSLATION_DISCLAIMER_FA } from "../ai/translate";
import { api } from "../../../api";
import { studioUserId } from "../studio/studio";
import { ShareSheet } from "../sheets/ShareSheet";
import { recordRead } from "../utils/history";
import { relatedTo } from "../utils/related";
import { addHighlight, getHighlights, removeHighlight, splitWithHighlights } from "../utils/highlights";
import { bionicNodes } from "../utils/bionic";

type Props = {
  article: Article | null;
  onClose: () => void;
  onToggleSave?: (a: Article) => void;
  onAddNote?: (a: Article) => void;
  /** Pool used to compute "related" recommendations. */
  pool?: Article[];
  onOpenArticle?: (a: Article) => void;
};

const FONT_SIZES = [15, 16, 17, 19, 21] as const;

export function MobileReader({ article, onClose, onToggleSave, onAddNote, pool, onOpenArticle }: Props) {
  const open = !!article;
  const reduced = usePrefersReducedMotion();
  const haptic = useHaptics();
  const [fsIdx, setFsIdx] = useState(2);
  const [progress, setProgress] = useState(0);
  const [askOpen, setAskOpen] = useState(false);
  const [askPrefill, setAskPrefill] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [translateOn, setTranslateOn] = useState(false);
  const [bionicOn, setBionicOn] = useState(false);
  // AI translation of the full article body. null = not loaded; falls back to local preview.
  const [aiTranslation, setAiTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  // Reset cached translation when the article changes.
  useEffect(() => { setAiTranslation(null); setTranslateOn(false); }, [article?.id]);

  // Fetch a real translation the first time the user turns translation on.
  useEffect(() => {
    if (!translateOn || !article || aiTranslation !== null) return;
    let cancelled = false;
    setTranslating(true);
    (async () => {
      try {
        const text = await api.aiTranslate({ text: article.content, to: "en" }, studioUserId());
        if (!cancelled) setAiTranslation(text || translateText(article.content, "en"));
      } catch (e) {
        console.log("reader AI translate failed, using local preview:", e);
        if (!cancelled) setAiTranslation(translateText(article.content, "en"));
      } finally {
        if (!cancelled) setTranslating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [translateOn, article?.id, aiTranslation]);  // eslint-disable-line react-hooks/exhaustive-deps
  const [showTop, setShowTop] = useState(false);
  const [highlights, setHighlights] = useState<string[]>([]);
  useEffect(() => {
    if (article) setHighlights(getHighlights(article.id));
  }, [article?.id]);  // eslint-disable-line react-hooks/exhaustive-deps
  const articleRef = useRef<HTMLElement>(null);
  const { selection, clear: clearSelection } = useTextSelection(articleRef as React.RefObject<HTMLElement>);
  const scrollRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(open);

  const edge = useEdgeSwipe({ onBack: () => { haptic("tap"); onClose(); } });
  const tts = useTTS();

  useEffect(() => { if (!open) tts.stop(); }, [open]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && article) recordRead(article.id);
  }, [open, article?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 0);
    setShowTop(el.scrollTop > 600);
  };

  const scrollToTop = () => {
    haptic("tap");
    scrollRef.current?.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  const share = () => {
    haptic("select");
    setShareOpen(true);
  };

  return (
    <AnimatePresence>
      {open && article && (
        <motion.div
          key="reader"
          initial={{ opacity: 0, y: reduced ? 0 : 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : 24 }}
          transition={{ duration: reduced ? 0 : 0.3, ease: [0.32, 0.72, 0, 1] }}
          dir="rtl" lang="fa"
          className="md:hidden fixed inset-0 z-[var(--z-mobile-reader)] bg-[var(--background)] text-[var(--foreground)] flex flex-col"
          {...edge}
        >
          <header
            className="sticky top-0 z-10 bg-[var(--background)]/85 backdrop-blur border-b border-[var(--border-subtle)]"
            style={{ paddingTop: "var(--safe-top)" }}
          >
            <div className="h-14 px-1.5 flex items-center gap-0.5">
              <IconBtn aria="بازگشت" onClick={onClose}><ArrowRight className="size-5" /></IconBtn>
              <div className="flex-1 min-w-0 px-1 text-[12px] text-[var(--foreground-subtle)] truncate">
                {article.source} · {article.readTime}
              </div>
              <IconBtn aria="اندازه متن" onClick={() => { haptic("select"); setFsIdx((i) => (i + 1) % FONT_SIZES.length); }}>
                <Type className="size-5" />
              </IconBtn>
              {tts.supported && (
                <IconBtn
                  aria={tts.state === "playing" ? "توقف خواندن" : tts.state === "paused" ? "ادامه خواندن" : "خواندن متن"}
                  onClick={() => {
                    haptic("select");
                    if (tts.state === "playing") tts.pause();
                    else if (tts.state === "paused") tts.resume();
                    else tts.speak(`${article.title}. ${article.content}`);
                  }}
                >
                  {tts.state === "playing" ? <Pause className="size-5" /> :
                   tts.state === "paused"  ? <Play className="size-5" /> :
                                             <Play className="size-5" />}
                </IconBtn>
              )}
              {tts.state !== "idle" && (
                <IconBtn aria="پایان خواندن" onClick={() => { haptic("tap"); tts.stop(); }}>
                  <Square className="size-4" />
                </IconBtn>
              )}
              {onAddNote && (
                <IconBtn aria="یادداشت" onClick={() => { haptic("select"); onAddNote(article); }}>
                  <NotebookPen className="size-5" />
                </IconBtn>
              )}
              {pool && pool.length > 1 && (
                <IconBtn aria="مقایسهٔ منابع" onClick={() => { haptic("select"); setCompareOpen(true); }}>
                  <GitCompare className="size-5" />
                </IconBtn>
              )}
              {pool && pool.length > 1 && (
                <IconBtn aria="خط زمانی" onClick={() => { haptic("select"); setTimelineOpen(true); }}>
                  <Clock className="size-5" />
                </IconBtn>
              )}
              <IconBtn aria={article.starred ? "حذف ذخیره" : "ذخیره"} onClick={() => { haptic("select"); onToggleSave?.(article); }}>
                {article.starred ? <BookmarkCheck className="size-5 text-[var(--brand-500)]" /> : <Bookmark className="size-5" />}
              </IconBtn>
              <IconBtn
                aria={translateOn ? "نمایش متن اصلی" : "ترجمهٔ انگلیسی (پیش‌نمایش)"}
                onClick={() => { haptic("select"); setTranslateOn((v) => !v); }}
              >
                <Languages className={`size-5 ${translateOn ? "text-[var(--brand-500)]" : ""}`} />
              </IconBtn>
              <IconBtn
                aria={bionicOn ? "خاموش‌کردن حالت بایونیک" : "حالت بایونیک"}
                onClick={() => { haptic("select"); setBionicOn((v) => !v); }}
              >
                <Bold className={`size-5 ${bionicOn ? "text-[var(--brand-500)]" : ""}`} />
              </IconBtn>
              <IconBtn aria="اشتراک‌گذاری" onClick={share}><Share2 className="size-5" /></IconBtn>
            </div>
            <div className="h-[2px] bg-[var(--border-subtle)]">
              <div className="h-full bg-[var(--brand-500)] transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
            </div>
          </header>

          <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain">
            <article ref={articleRef} className="max-w-2xl mx-auto px-5 py-6" style={{ fontSize: FONT_SIZES[fsIdx] }}>
              <DetailedArticleHeader article={article} />

              <div className="mt-4">
                <SummaryCard article={article} onAsk={() => setAskOpen(true)} />
              </div>

              <div className="mt-3">
                <QualityInsights article={article} />
              </div>

              {article.image && (
                <ImageWithFallback
                  src={article.image}
                  alt={article.title}
                  className="mt-4 w-full aspect-[16/9] object-cover rounded-[var(--radius-lg)]"
                />
              )}

              {translateOn && (
                <div
                  dir="ltr"
                  className="mt-4 rounded-[var(--radius-md)] border border-[var(--brand-500)]/30 bg-[var(--brand-500)]/8 px-3 py-2 text-[11.5px] text-[var(--foreground-muted)] flex items-start gap-2"
                >
                  <Languages className="size-3.5 shrink-0 text-[var(--brand-500)] mt-0.5" />
                  <div>
                    <div className="font-semibold text-[var(--brand-500)] mb-0.5">
                      {translating ? "Translating…" : "English translation"}
                    </div>
                    {translating ? (
                      <div dir="rtl" lang="fa" className="leading-snug">در حال ترجمه با هوش مصنوعی…</div>
                    ) : aiTranslation ? (
                      <div dir="rtl" lang="fa" className="leading-snug opacity-80">ترجمه با هوش مصنوعی انجام شد. برای متن مرجع، به منبع اصلی مراجعه کن.</div>
                    ) : (
                      <>
                        <div dir="ltr" className="leading-snug">{TRANSLATION_DISCLAIMER_EN}</div>
                        <div dir="rtl" lang="fa" className="leading-snug mt-1 opacity-80">{TRANSLATION_DISCLAIMER_FA}</div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div
                className="mt-5 leading-[1.95] text-[var(--foreground)] whitespace-pre-line"
                dir={translateOn ? "ltr" : "rtl"}
                lang={translateOn ? "en" : "fa"}
              >
                {translateOn ? (
                  translating && !aiTranslation ? (
                    <span dir="rtl" lang="fa" className="text-[var(--foreground-muted)]">در حال آماده‌سازی ترجمه…</span>
                  ) : (() => {
                    const txt = aiTranslation ?? translateText(article.content, "en");
                    return bionicOn ? bionicNodes(txt) : txt;
                  })()
                ) : (
                  splitWithHighlights(article.content, highlights).map((seg, i) =>
                    seg.mark ? (
                      <mark
                        key={i}
                        onClick={() => {
                          haptic("tap");
                          removeHighlight(article.id, seg.text);
                          setHighlights(getHighlights(article.id));
                        }}
                        className="bg-yellow-200/70 dark:bg-yellow-300/30 text-[var(--foreground)] rounded-sm px-0.5 cursor-pointer"
                      >
                        {bionicOn ? bionicNodes(seg.text) : seg.text}
                      </mark>
                    ) : (
                      <span key={i}>{bionicOn ? bionicNodes(seg.text) : seg.text}</span>
                    ),
                  )
                )}
              </div>

              {article.link && (
                <a
                  href={article.link}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-6 inline-flex items-center gap-1.5 text-[13px] text-[var(--brand-500)]"
                >
                  <ExternalLink className="size-4" /> مطالعه در منبع اصلی
                </a>
              )}

              {pool && onOpenArticle && (() => {
                const idx = pool.findIndex((p) => p.id === article.id);
                const prev = idx > 0 ? pool[idx - 1] : null;
                const next = idx >= 0 && idx < pool.length - 1 ? pool[idx + 1] : null;
                if (!prev && !next) return null;
                return (
                  <div className="mt-6 grid grid-cols-2 gap-2">
                    <NavCard
                      dir="prev"
                      article={prev}
                      onOpen={(a) => { haptic("tap"); onOpenArticle(a); }}
                    />
                    <NavCard
                      dir="next"
                      article={next}
                      onOpen={(a) => { haptic("tap"); onOpenArticle(a); }}
                    />
                  </div>
                );
              })()}

              {pool && onOpenArticle && (
                <RelatedStrip items={relatedTo(article, pool, 6)} onOpen={onOpenArticle} />
              )}

              <div className="h-16" />
            </article>
          </div>
          <HighlightBar
            open={!!selection && !askOpen}
            text={selection?.text ?? ""}
            article={article}
            onClose={clearSelection}
            onAskAI={(q) => { setAskPrefill(q); setAskOpen(true); clearSelection(); }}
            onHighlightSaved={() => setHighlights(getHighlights(article.id))}
          />
          <AskArticleSheet
            open={askOpen}
            onClose={() => { setAskOpen(false); setAskPrefill(null); }}
            article={article}
            prefill={askPrefill ?? undefined}
          />
          <CompareSourcesSheet
            open={compareOpen}
            onClose={() => setCompareOpen(false)}
            article={article}
            pool={pool ?? []}
            onOpenArticle={onOpenArticle}
          />
          <ShareSheet
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            article={article}
          />
          <AnimatePresence>
            {showTop && (
              <motion.button
                key="totop"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: reduced ? 0 : 0.2, ease: [0.32, 0.72, 0, 1] }}
                onClick={scrollToTop}
                aria-label="بازگشت به بالا"
                className="absolute left-4 size-11 grid place-items-center rounded-full bg-[var(--brand-500)] text-white shadow-lg tap press active:bg-[var(--brand-600)] z-20"
                style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
              >
                <ArrowUp className="size-5" />
              </motion.button>
            )}
          </AnimatePresence>
          <EventTimelineSheet
            open={timelineOpen}
            onClose={() => setTimelineOpen(false)}
            article={article}
            pool={pool ?? []}
            onOpenArticle={onOpenArticle}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NavCard({ dir, article, onOpen }: { dir: "prev" | "next"; article: Article | null; onOpen: (a: Article) => void }) {
  if (!article) {
    return <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-subtle)] opacity-40" />;
  }
  const isPrev = dir === "prev";
  return (
    <button
      onClick={() => onOpen(article)}
      className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)] p-3 text-right tap press active:bg-[var(--accent)] transition-colors"
    >
      <div className="flex items-center gap-1 text-[10.5px] font-semibold text-[var(--brand-500)] mb-1">
        {isPrev ? (
          <>
            <ChevronRight className="size-3.5" /> قبلی
          </>
        ) : (
          <>
            بعدی <ChevronLeft className="size-3.5" />
          </>
        )}
      </div>
      <div className="text-[12.5px] font-semibold leading-snug line-clamp-3">{article.title}</div>
      <div className="mt-1 text-[10px] text-[var(--foreground-subtle)] truncate">{article.source}</div>
    </button>
  );
}

function IconBtn({ children, onClick, aria }: { children: React.ReactNode; onClick?: () => void; aria: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={aria}
      className="size-10 grid place-items-center rounded-full tap press active:bg-[var(--accent)]"
    >
      {children}
    </button>
  );
}
