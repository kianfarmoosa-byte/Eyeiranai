import { Star, Bookmark, Share2, Twitter, Facebook, Link2, Printer, X, ExternalLink, ThumbsUp, MessageCircle, Highlighter, Plus, Quote, Clock } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Article } from "../data";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { TagEditor } from "./TagEditor";
import { SentimentBadge } from "./SentimentBadge";
import { loadNotes, newNote, appendHighlight, getLastNoteId, setLastNoteId, quotesForArticle, type Note } from "../notes";
import type { TopicQuery } from "../timeline";
import { Button, Card, EmptyState } from "./kian";

type Props = {
  article: Article | null;
  onClose: () => void;
  toggleStar: (id: string) => void;
  toggleSave?: (id: string) => void;
  isSaved?: boolean;
  onTagsChange?: (id: string, tags: string[]) => void;
  related?: { article: Article; score: number }[];
  onSelectRelated?: (id: string) => void;
  onOpenTimeline?: (topic: TopicQuery) => void;
};

export function ArticleView({ article, onClose, toggleStar, toggleSave, isSaved, onTagsChange, related, onSelectRelated, onOpenTimeline }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [hl, setHl] = useState<{ x: number; y: number; quote: string } | null>(null);
  const [picker, setPicker] = useState<{ quote: string } | null>(null);
  const [quoteTick, setQuoteTick] = useState(0);
  const quotes = useMemo(() => article ? quotesForArticle(article.id) : [], [article?.id, quoteTick]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0);
    };
    onScroll();
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [article?.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setHl(null); setPicker(null);
  }, [article?.id]);

  useEffect(() => {
    const onUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { setHl(null); return; }
      const text = sel.toString().trim();
      if (text.length < 4) { setHl(null); return; }
      const root = contentRef.current;
      if (!root) return;
      const anchor = sel.anchorNode;
      const node = anchor?.nodeType === 1 ? (anchor as Node) : anchor?.parentNode;
      if (!node || !root.contains(node)) { setHl(null); return; }
      const r = sel.getRangeAt(0).getBoundingClientRect();
      const sr = scrollRef.current?.getBoundingClientRect();
      if (!sr) return;
      setHl({ x: r.left + r.width / 2 - sr.left, y: r.top - sr.top - 8, quote: text });
    };
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
    };
  }, [article?.id]);

  const quickHighlight = () => {
    if (!hl || !article) return;
    const last = getLastNoteId();
    const all = loadNotes();
    const target = (last && all.find(n => n.id === last)) || all[0];
    if (target) {
      appendHighlight(target.id, hl.quote, article.title, article.id);
      setLastNoteId(target.id);
      setHl(null); setQuoteTick(t => t + 1);
      window.getSelection()?.removeAllRanges();
    } else {
      setPicker({ quote: hl.quote }); setHl(null);
    }
  };

  const pickHighlight = (noteId: string) => {
    if (!picker || !article) return;
    appendHighlight(noteId, picker.quote, article.title, article.id);
    setLastNoteId(noteId);
    setPicker(null); setQuoteTick(t => t + 1);
    window.getSelection()?.removeAllRanges();
  };

  const createAndAttach = () => {
    if (!picker || !article) return;
    const n = newNote(`نقل‌قول‌های «${article.title.slice(0, 40)}»`);
    appendHighlight(n.id, picker.quote, article.title, article.id);
    setLastNoteId(n.id);
    setPicker(null); setQuoteTick(t => t + 1);
    window.getSelection()?.removeAllRanges();
  };

  const copyLink = () => {
    if (article?.link) navigator.clipboard?.writeText(article.link).catch(() => {});
  };

  if (!article) {
    return (
      <aside className="w-[480px] bg-[var(--background-subtle)] border-r border-[var(--border)] flex items-center justify-center">
        <EmptyState
          size="md"
          icon={<Quote className="size-full" />}
          title="مقاله‌ای انتخاب نشده"
          description="یک مقاله را از فهرست انتخاب کنید تا اینجا مطالعه کنید."
        />
      </aside>
    );
  }

  return (
    <aside className="w-[480px] bg-[var(--background)] border-r border-[var(--border)] flex flex-col relative">
      {/* Reading progress bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--border-subtle)] z-[var(--z-sticky)]">
        <div className="h-full bg-gradient-to-r from-[var(--brand-500)] to-[var(--brand-400)] transition-[width] duration-150" style={{ width: `${progress}%` }} />
      </div>

      {/* Toolbar */}
      <div className="border-b border-[var(--border)] p-2 flex items-center gap-0.5
                      bg-[var(--background)]/85 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/70 sticky top-0 z-[var(--z-sticky)]">
        <Button variant="ghost" size="sm" onClick={() => toggleStar(article.id)}
          iconLeading={<Star className={`size-4 ${article.starred ? 'fill-[var(--warning-500)] text-[var(--warning-500)]' : ''}`} />} />
        <Button variant="ghost" size="sm" onClick={() => article && toggleSave?.(article.id)} title="ذخیره"
          iconLeading={<Bookmark className={`size-4 ${isSaved ? 'fill-[var(--brand-500)] text-[var(--brand-500)]' : ''}`} />} />

        <div className="w-px h-5 bg-[var(--border)] mx-1" />

        <Button variant="ghost" size="sm" iconLeading={<Twitter className="size-4" />} title="X" />
        <Button variant="ghost" size="sm" iconLeading={<Facebook className="size-4" />} title="Facebook" />
        <Button variant="ghost" size="sm" onClick={copyLink} disabled={!article.link} title="کپی پیوند"
          iconLeading={<Link2 className="size-4" />} />
        <Button variant="ghost" size="sm" iconLeading={<Share2 className="size-4" />} title="اشتراک‌گذاری" />
        <Button variant="ghost" size="sm" onClick={() => window.print()} title="چاپ"
          iconLeading={<Printer className="size-4" />} />
        <a href={article.link || '#'} target="_blank" rel="noopener noreferrer"
          onClick={e => { if (!article.link) e.preventDefault(); }}
          title="مشاهده مقاله اصلی"
          className={`inline-flex items-center justify-center h-8 w-8 rounded-[var(--radius-md)] hover:bg-[var(--accent)] transition
                       ${!article.link ? 'opacity-40 pointer-events-none' : ''}`}>
          <ExternalLink className="size-4" />
        </a>

        <div className="flex-1" />

        <Button variant="ghost" size="sm" onClick={onClose} iconLeading={<X className="size-4" />} title="بستن" />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto relative">
        {/* Floating highlight tooltip */}
        {hl && (
          <button onClick={quickHighlight}
            style={{ left: Math.max(60, Math.min(hl.x, 380)), top: Math.max(8, hl.y) }}
            className="absolute z-[var(--z-popover)] -translate-x-1/2 -translate-y-full
                       bg-[var(--neutral-950)] dark:bg-[var(--neutral-100)]
                       text-[var(--neutral-50)] dark:text-[var(--neutral-950)]
                       text-xs px-3 py-1.5 rounded-[var(--radius-md)] shadow-[var(--shadow-xl)]
                       flex items-center gap-1.5 hover:scale-[1.03] transition-transform">
            <Highlighter className="size-3.5" /> ذخیره در یادداشت
          </button>
        )}

        {/* Note picker modal */}
        {picker && (
          <div className="absolute inset-0 z-[var(--z-modal)] bg-black/50 backdrop-blur-sm flex items-center justify-center anim-in"
            onClick={() => setPicker(null)}>
            <Card tone="elevated" onClick={(e: any) => e.stopPropagation()}
              className="w-80 max-h-[70%] flex flex-col overflow-hidden anim-up">
              <div className="px-4 py-2.5 border-b border-[var(--border-subtle)]">
                <div className="text-sm font-medium">انتخاب یادداشت</div>
              </div>
              <div className="px-4 py-2.5 text-[11px] text-[var(--foreground-muted)] border-b border-[var(--border-subtle)] line-clamp-3 italic font-display leading-relaxed">
                «{picker.quote}»
              </div>
              <div className="flex-1 overflow-y-auto">
                {loadNotes().sort((a: Note, b: Note) => b.updatedAt - a.updatedAt).map((n: Note) => (
                  <button key={n.id} onClick={() => pickHighlight(n.id)}
                    className="w-full text-right px-4 py-2.5 hover:bg-[var(--accent)] border-b border-[var(--border-subtle)] text-sm truncate transition-colors">
                    {n.title || "بدون عنوان"}
                  </button>
                ))}
              </div>
              <button onClick={createAndAttach}
                className="px-4 py-2.5 bg-[var(--brand-600)] hover:bg-[var(--brand-700)] text-white text-sm flex items-center justify-center gap-1.5 transition-colors">
                <Plus className="size-4" /> یادداشت جدید
              </button>
            </Card>
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
        <motion.article
          key={article.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="px-7 py-8 max-w-2xl mx-auto">
          {/* Source eyebrow */}
          <div className="flex items-center gap-2 text-[12.5px] text-[var(--foreground-muted)] mb-4">
            <span className="text-base">{article.sourceIcon}</span>
            {onOpenTimeline ? (
              <button onClick={() => onOpenTimeline({ kind: "source", source: article.source })}
                className="font-medium hover:text-[var(--brand-600)] dark:hover:text-[var(--brand-300)] inline-flex items-center gap-1 transition-colors"
                title="خط زمانی این منبع">
                {article.source} <Clock className="size-3" />
              </button>
            ) : (
              <span className="font-medium">{article.source}</span>
            )}
            <span className="text-[var(--border-strong)]">·</span>
            <span>{article.author}</span>
          </div>

          {/* Title — editorial display */}
          <h1 className="text-display text-[28px] leading-[1.25] tracking-tight font-bold mb-4">
            {article.title}
          </h1>

          {/* Meta row */}
          <div className="flex items-center gap-2.5 text-[12px] text-[var(--foreground-subtle)] mb-5 flex-wrap">
            <span className="tabular-nums">{article.date}</span>
            <span className="text-[var(--border-strong)]">·</span>
            <span className="flex items-center gap-1 tabular-nums"><Clock className="size-3" />{article.readTime} مطالعه</span>
            <span className="text-[var(--border-strong)]">·</span>
            <SentimentBadge article={article} size="sm" />
            {article.link && (
              <>
                <span className="text-[var(--border-strong)]">·</span>
                <a href={article.link} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--brand-600)] dark:text-[var(--brand-300)] hover:underline">
                  <ExternalLink className="size-3" /> منبع اصلی
                </a>
              </>
            )}
          </div>

          {/* Tags */}
          <div className="mb-7 pb-5 border-b border-[var(--border-subtle)]">
            <TagEditor
              tags={article.tags || []}
              onChange={(t) => onTagsChange?.(article.id, t)}
            />
          </div>

          {/* Hero image */}
          {article.image && (
            <figure className="mb-7 -mx-1 rounded-[var(--radius-xl)] overflow-hidden ring-1 ring-[var(--border-subtle)]">
              <ImageWithFallback src={article.image} alt={article.title} className="w-full h-72 object-cover" />
            </figure>
          )}

          {/* Body — editorial typography */}
          <div ref={contentRef}
            className="article-body max-w-none">
            {article.content.split('\n\n').map((p, i) => (
              <p key={i} className="mb-5 text-[15.5px] leading-[1.85] text-[var(--foreground)]">
                {p}
              </p>
            ))}
          </div>

          {/* Saved quotes */}
          {quotes.length > 0 && (
            <section className="mt-9 pt-6 border-t border-[var(--border-subtle)]">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[var(--foreground)]">
                <Quote className="size-4 text-[var(--warning-500)]" />
                نقل‌قول‌های ذخیره‌شده
              </h3>
              <div className="space-y-3">
                {quotes.map(({ note, quotes: qs }) => (
                  <div key={note.id} className="rounded-[var(--radius-lg)] border border-[oklch(0.85_0.10_85)] dark:border-[var(--warning-900)]/60 bg-[var(--warning-50)] dark:bg-[var(--warning-900)]/15 p-4">
                    <div className="text-[11px] text-[var(--warning-600)] mb-2 font-medium uppercase tracking-wide">
                      از یادداشت: {note.title || "بدون عنوان"}
                    </div>
                    <div className="space-y-2">
                      {qs.map((q, i) => (
                        <blockquote key={i} className="text-[13.5px] border-r-2 border-[var(--warning-500)] pr-3 italic text-display text-[var(--foreground)] leading-relaxed">
                          {q}
                        </blockquote>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Related articles */}
          {related && related.length > 0 && (
            <section className="mt-9 pt-6 border-t border-[var(--border-subtle)]">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <span className="inline-block w-1 h-4 bg-[var(--brand-500)] rounded-full" />
                مقالات مرتبط
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {related.slice(0, 6).map(r => (
                  <button key={r.article.id} onClick={() => onSelectRelated?.(r.article.id)}
                    className="text-right p-3 rounded-[var(--radius-md)] surface
                               transition-[border-color,background] duration-[var(--duration-fast)]
                               hover:border-[var(--border-strong)] hover:bg-[var(--background-subtle)]">
                    <div className="text-[10.5px] text-[var(--brand-600)] dark:text-[var(--brand-300)] mb-1 flex items-center gap-1.5 tabular-nums">
                      <span className="font-medium">{r.article.source}</span>
                      <span className="text-[var(--border-strong)]">·</span>
                      <span>{Math.round(r.score * 100)}٪ مرتبط</span>
                    </div>
                    <div className="text-[13px] font-medium line-clamp-2 leading-snug">{r.article.title}</div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Reactions */}
          <div className="mt-9 pt-6 border-t border-[var(--border-subtle)] flex items-center gap-2.5">
            <Button variant="secondary" size="md" iconLeading={<ThumbsUp className="size-4" />}>پسندیدم</Button>
            <Button variant="secondary" size="md" iconLeading={<MessageCircle className="size-4" />}>نظرات</Button>
          </div>
        </motion.article>
        </AnimatePresence>
      </div>
    </aside>
  );
}
