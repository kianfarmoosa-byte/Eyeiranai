import { Star, Bookmark, Share2, Twitter, Facebook, Link2, Printer, X, ExternalLink, ThumbsUp, MessageCircle, Highlighter, Plus, Quote, Clock, Languages, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Article } from "../data";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { TagEditor } from "./TagEditor";
import { SentimentBadge } from "./SentimentBadge";
import { loadNotes, newNote, appendHighlight, getLastNoteId, setLastNoteId, quotesForArticle, type Note } from "../notes";
import type { TopicQuery } from "../timeline";
import { api } from "../api";
import { studioUserId } from "./mobile/studio/studio";
import { extractFullContent, getFullContent, getArticleFa, setArticleFa } from "../translationCache";

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

  // On-demand full-article translation to Persian (title + body), toggleable.
  const [trans, setTrans] = useState<{ title: string; content: string } | null>(null);
  const [translating, setTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [transFromCache, setTransFromCache] = useState(false);
  useEffect(() => { setTrans(null); setTranslating(false); setShowOriginal(false); setTransFromCache(false); }, [article?.id]);

  // Full-text extraction: RSS feeds (especially international ones) often carry
  // only a short summary. When the stored content is thin and we have a source
  // link, fetch the full readable article body from the server and show it in
  // the content column.
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);
  const [fullError, setFullError] = useState(false);
  // The content actually rendered (and translated): the fetched full text if we
  // have it, otherwise whatever the feed provided.
  const baseContent = fullContent ?? (article?.content || "");

  const loadFull = async () => {
    if (!article?.link || loadingFull) return;
    setLoadingFull(true);
    setFullError(false);
    const content = await extractFullContent(article.link);
    if (content && content.length > (article.content?.length || 0)) {
      setFullContent(content);
      setTrans(null); // any prior translation was of the shorter text
    } else if (!article.content?.trim()) {
      setFullError(true);
    }
    setLoadingFull(false);
  };

  useEffect(() => {
    setFullContent(null); setLoadingFull(false); setFullError(false);
    if (!article?.link) return;
    // Instant if we've already extracted this article before.
    const cached = getFullContent(article.link);
    if (cached && cached.length > (article.content?.length || 0)) {
      setFullContent(cached);
      return;
    }
    // Auto-fetch the full body when the feed content is short.
    const short = (article.content?.trim().length || 0) < 600;
    if (short) {
      let cancelled = false;
      (async () => {
        setLoadingFull(true);
        const content = await extractFullContent(article.link);
        if (cancelled) return;
        if (content && content.length > (article.content?.length || 0)) setFullContent(content);
        else if (!article.content?.trim()) setFullError(true);
        setLoadingFull(false);
      })();
      return () => { cancelled = true; };
    }
  }, [article?.id]);

  const translateArticle = async () => {
    if (!article || translating) return;
    if (trans) { setShowOriginal(v => !v); return; }
    const cached = getArticleFa(article.id);
    if (cached && cached.content) { setTrans(cached); setTransFromCache(true); setShowOriginal(false); return; }
    setTranslating(true);
    try {
      const paras = baseContent.split("\n\n");
      const texts = [article.title, ...paras];
      const out: string[] = [];
      for (let i = 0; i < texts.length; i += 20) {
        const chunk = texts.slice(i, i + 20);
        const r = await api.aiTranslateBatch({ texts: chunk, to: "fa" }, studioUserId());
        chunk.forEach((t, j) => out.push(r[j]?.trim() || t));
      }
      const value = { title: out[0] || article.title, content: out.slice(1).join("\n\n") };
      setArticleFa(article.id, value);
      setTrans(value);
      setTransFromCache(false);
      setShowOriginal(false);
    } catch (e) {
      console.log("article translation failed:", e);
    } finally {
      setTranslating(false);
    }
  };

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
      <aside className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500">مقاله‌ای برای نمایش انتخاب کنید</aside>
    );
  }

  return (
    <aside className="w-[480px] bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col relative">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-800 z-20">
        <div className="h-full bg-emerald-500 transition-[width] duration-150" style={{ width: `${progress}%` }}></div>
      </div>
      <div className="border-b border-slate-200 dark:border-slate-800 p-3 flex items-center gap-1 px-[6px] py-[11px] ml-[-156px] mr-[2px] my-[0px]">
        <button onClick={() => toggleStar(article.id)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
          <Star className={`w-4 h-4 ${article.starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
        </button>
        <button onClick={() => article && toggleSave?.(article.id)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg" title="ذخیره">
          <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-emerald-500 text-emerald-500' : ''}`} />
        </button>
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1"></div>
        <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
          <Twitter className="w-4 h-4" />
        </button>
        <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
          <Facebook className="w-4 h-4" />
        </button>
        <button onClick={copyLink} disabled={!article.link} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-40" title="کپی پیوند">
          <Link2 className="w-4 h-4" />
        </button>
        <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg" title="اشتراک‌گذاری">
          <Share2 className="w-4 h-4" />
        </button>
        <button onClick={() => window.print()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg" title="چاپ">
          <Printer className="w-4 h-4" />
        </button>
        <button
          onClick={translateArticle}
          disabled={translating}
          className={`p-2 rounded-lg disabled:opacity-50 ${trans && !showOriginal ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          title={trans ? (showOriginal ? 'نمایش ترجمهٔ فارسی' : 'نمایش متن اصلی') : 'ترجمهٔ کامل خبر به فارسی'}
        >
          {translating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
        </button>
        <a
          href={article.link || '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => { if (!article.link) e.preventDefault(); }}
          className={`p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg ${!article.link ? 'opacity-40 pointer-events-none' : ''}`}
          title="مشاهده مقاله اصلی"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
        <div className="flex-1"></div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto relative p-[0px] ml-[-181px] mr-[0px] my-[0px]">
        {hl && (
          <button onClick={quickHighlight}
            style={{ left: Math.max(60, Math.min(hl.x, 380)), top: Math.max(8, hl.y) }}
            className="absolute z-30 -translate-x-1/2 -translate-y-full bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-md shadow-lg flex items-center gap-1.5 hover:bg-slate-800">
            <Highlighter className="w-3.5 h-3.5" /> ذخیره در یادداشت
          </button>
        )}
        {picker && (
          <div className="absolute inset-0 z-30 bg-black/40 flex items-center justify-center" onClick={() => setPicker(null)}>
            <div onClick={(e) => e.stopPropagation()} className="w-80 max-h-[70%] bg-white dark:bg-slate-950 rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
              <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 text-sm font-medium">انتخاب یادداشت</div>
              <div className="p-2 text-[11px] text-slate-500 border-b border-slate-100 dark:border-slate-900 line-clamp-3 italic">«{picker.quote}»</div>
              <div className="flex-1 overflow-y-auto">
                {loadNotes().sort((a: Note, b: Note) => b.updatedAt - a.updatedAt).map((n: Note) => (
                  <button key={n.id} onClick={() => pickHighlight(n.id)}
                    className="w-full text-right px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-900 border-b border-slate-100 dark:border-slate-900 text-sm truncate">
                    {n.title || "بدون عنوان"}
                  </button>
                ))}
              </div>
              <button onClick={createAndAttach} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm flex items-center justify-center gap-1.5">
                <Plus className="w-4 h-4" /> یادداشت جدید
              </button>
            </div>
          </div>
        )}
        <article className="max-w-none w-full px-6 py-[23px] m-[0px]">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
            <span className="text-lg">{article.sourceIcon}</span>
            {onOpenTimeline ? (
              <button onClick={() => onOpenTimeline({ kind: "source", source: article.source })}
                className="hover:text-emerald-600 inline-flex items-center gap-1" title="خط زمانی این منبع">
                {article.source} <Clock className="w-3 h-3" />
              </button>
            ) : (
              <span>{article.source}</span>
            )}
            <span>•</span>
            <span>{article.author}</span>
          </div>
          <h1 className="mb-3 leading-relaxed">{trans && !showOriginal ? trans.title : article.title}</h1>
          <div className="flex items-center gap-3 text-sm text-slate-500 mb-4 flex-wrap">
            <span>{article.date}</span>
            <span>•</span>
            <span>{article.readTime} مطالعه</span>
            <span>•</span>
            <SentimentBadge article={article} size="sm" />
            {article.link && (
              <>
                <span>•</span>
                <a href={article.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline">
                  <ExternalLink className="w-3 h-3" /> مشاهده در منبع اصلی
                </a>
              </>
            )}
          </div>
          <div className="mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
            <TagEditor
              tags={article.tags || []}
              onChange={(t) => onTagsChange?.(article.id, t)}
            />
          </div>

          {article.image && (
            <div className="mb-6 rounded-xl overflow-hidden">
              <ImageWithFallback src={article.image} alt={article.title} className="w-full h-64 object-cover" />
            </div>
          )}

          {trans && (
            <div className="mb-3 -mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Languages className="w-3 h-3" />
              {showOriginal ? 'در حال نمایش متن اصلی' : 'ترجمه‌شده به فارسی'}
              {!showOriginal && transFromCache && (
                <span className="inline-flex items-center px-1.5 h-4 rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 text-[9px] font-semibold">
                  از کش
                </span>
              )}
              <button onClick={() => setShowOriginal(v => !v)} className="underline hover:text-emerald-700">
                {showOriginal ? 'نمایش ترجمه' : 'نمایش متن اصلی'}
              </button>
            </div>
          )}
          <div ref={contentRef} className="prose prose-slate dark:prose-invert max-w-none leading-loose">
            {((trans && !showOriginal ? trans.content : baseContent).split('\n\n')).map((p, i) => (
              <p key={i} className="mb-4">{p}</p>
            ))}
            {loadingFull && (
              <div className="flex items-center gap-2 text-sm text-slate-500 mt-2">
                <Loader2 className="w-4 h-4 animate-spin" /> در حال بارگذاری متن کامل خبر…
              </div>
            )}
            {!loadingFull && fullError && article.link && (
              <div className="mt-3 text-sm text-slate-500">
                امکان استخراج خودکار متن کامل نبود.{" "}
                <a href={article.link} target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline">
                  مطالعهٔ خبر در منبع اصلی
                </a>
              </div>
            )}
            {!loadingFull && !fullContent && !fullError && article.link && (baseContent.trim().length >= 600) && (
              <button onClick={loadFull} className="mt-3 text-sm text-emerald-600 dark:text-emerald-400 hover:underline">
                بارگذاری متن کامل خبر
              </button>
            )}
          </div>

          {quotes.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Quote className="w-4 h-4 text-amber-500" />
                نقل‌قول‌های ذخیره‌شده
              </div>
              <div className="space-y-3">
                {quotes.map(({ note, quotes: qs }) => (
                  <div key={note.id} className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 mb-1.5">از یادداشت: {note.title || "بدون عنوان"}</div>
                    <div className="space-y-1.5">
                      {qs.map((q, i) => (
                        <blockquote key={i} className="text-sm border-r-2 border-amber-400 pr-2 italic text-slate-700 dark:text-slate-300">
                          {q}
                        </blockquote>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {related && related.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                <span className="inline-block w-1 h-4 bg-emerald-500 rounded"></span>
                مقالات مرتبط
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {related.slice(0, 6).map(r => (
                  <button key={r.article.id} onClick={() => onSelectRelated?.(r.article.id)}
                    className="text-right p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800">
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mb-0.5">
                      {r.article.source} · {Math.round(r.score * 100)}٪ مرتبط
                    </div>
                    <div className="text-sm font-medium line-clamp-2">{r.article.title}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-sm">
              <ThumbsUp className="w-4 h-4" /> پسندیدم
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-sm">
              <MessageCircle className="w-4 h-4" /> نظرات
            </button>
          </div>
        </article>
      </div>
    </aside>
  );
}
