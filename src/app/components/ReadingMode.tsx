import { useEffect, useMemo, useRef, useState } from "react";
import { X, Type, Minus, Plus, Sun, Moon, Coffee, AlignLeft, AlignJustify, Volume2, VolumeX, Star, Bookmark, ExternalLink, Sparkles, Highlighter, FileText, Quote as QuoteIcon, Trash2, Map as MapIcon, Target } from "lucide-react";
import type { Article } from "../data";
import {
  summarize, extractQuotes, readability, personalReadTime, recordReadSpeed,
  getHighlights, addHighlight, removeHighlight, updateHighlight,
  savePosition, getPosition, todayProgress,
  type Highlight, type SummaryLevel, type StructuredSummary,
} from "../readingStudio";

type Theme = "light" | "dark" | "sepia";
type Width = "narrow" | "medium" | "wide";
type Align = "right" | "justify";

type Props = {
  article: Article;
  onClose: () => void;
  onToggleStar?: (id: string) => void;
  onToggleSave?: (id: string) => void;
  isSaved?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
};

const FONTS = [
  { id: "vazir", label: "وزیر", css: "Vazirmatn, Tahoma, sans-serif" },
  { id: "iransans", label: "ایران‌سنس", css: "'IRANSans', Tahoma, sans-serif" },
  { id: "shabnam", label: "شبنم", css: "Shabnam, Tahoma, sans-serif" },
  { id: "serif", label: "سریف", css: "Georgia, 'Times New Roman', serif" },
];

const WIDTH_PX: Record<Width, string> = { narrow: "560px", medium: "720px", wide: "880px" };

export function ReadingMode({ article, onClose, onToggleStar, onToggleSave, isSaved, onPrev, onNext }: Props) {
  const stored = (k: string, fb: string) => { try { return localStorage.getItem(k) || fb; } catch { return fb; } };
  const storedNum = (k: string, fb: number) => { try { return Number(localStorage.getItem(k)) || fb; } catch { return fb; } };

  const [theme, setTheme] = useState<Theme>(stored("rm.theme", "light") as Theme);
  const [fontSize, setFontSize] = useState<number>(storedNum("rm.fs", 18));
  const [lineHeight, setLineHeight] = useState<number>(storedNum("rm.lh", 1.9));
  const [width, setWidth] = useState<Width>(stored("rm.w", "medium") as Width);
  const [align, setAlign] = useState<Align>(stored("rm.al", "justify") as Align);
  const [font, setFont] = useState(stored("rm.font", "vazir"));
  const [progress, setProgress] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const articleBodyRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(Date.now());
  const resumedRef = useRef<boolean>(false);

  const [panel, setPanel] = useState<null | "summary" | "highlights" | "quotes" | "minimap">(null);
  const [summaryLevel, setSummaryLevel] = useState<SummaryLevel>("short");
  const [highlights, setHighlights] = useState<Highlight[]>(() => getHighlights(article.id));
  const [selection, setSelection] = useState<{ text: string; rect: DOMRect } | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => { setHighlights(getHighlights(article.id)); resumedRef.current = false; startTimeRef.current = Date.now(); }, [article.id]);

  useEffect(() => { localStorage.setItem("rm.theme", theme); }, [theme]);
  useEffect(() => { localStorage.setItem("rm.fs", String(fontSize)); }, [fontSize]);
  useEffect(() => { localStorage.setItem("rm.lh", String(lineHeight)); }, [lineHeight]);
  useEffect(() => { localStorage.setItem("rm.w", width); }, [width]);
  useEffect(() => { localStorage.setItem("rm.al", align); }, [align]);
  useEffect(() => { localStorage.setItem("rm.font", font); }, [font]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      const pct = max > 0 ? Math.min(1, el.scrollTop / max) : 0;
      setProgress(pct);
      savePosition(article.id, pct);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [article?.id]);

  useEffect(() => {
    if (resumedRef.current) return;
    const t = setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      const saved = getPosition(article.id);
      if (saved && saved > 0.1) {
        const max = el.scrollHeight - el.clientHeight;
        el.scrollTo({ top: saved * max, behavior: "smooth" });
      }
      resumedRef.current = true;
    }, 200);
    return () => clearTimeout(t);
  }, [article.id]);

  useEffect(() => {
    return () => {
      const seconds = (Date.now() - startTimeRef.current) / 1000;
      const words = (article.content || article.preview || "").trim().split(/\s+/).filter(Boolean).length;
      if (progress > 0.7) recordReadSpeed(Math.round(words * progress), seconds);
    };
  }, [article.id, progress]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "j" || e.key === "ArrowDown") containerRef.current?.scrollBy({ top: 300, behavior: "smooth" });
      else if (e.key === "k" || e.key === "ArrowUp") containerRef.current?.scrollBy({ top: -300, behavior: "smooth" });
      else if (e.key === "ArrowLeft") onNext?.();
      else if (e.key === "ArrowRight") onPrev?.();
      else if (e.key.toLowerCase() === "s") setPanel(p => p === "summary" ? null : "summary");
      else if (e.key.toLowerCase() === "h") setPanel(p => p === "highlights" ? null : "highlights");
      else if (e.key.toLowerCase() === "q") setPanel(p => p === "quotes" ? null : "quotes");
      else if (e.key.toLowerCase() === "m") setPanel(p => p === "minimap" ? null : "minimap");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNext, onPrev]);

  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch {} }, []);

  const speak = () => {
    try {
      if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
      const text = `${article.title}. ${article.content || article.preview || ""}`;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "fa-IR";
      u.rate = 1.0;
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
      setSpeaking(true);
    } catch {}
  };

  const themeClasses = useMemo(() => {
    if (theme === "sepia") return "bg-[#f7efdc] text-[#3b2f17]";
    if (theme === "dark") return "bg-[#0b0f17] text-slate-100";
    return "bg-white text-slate-900";
  }, [theme]);

  const fontFamily = FONTS.find(f => f.id === font)?.css || FONTS[0].css;
  const wordCount = (article.content || "").trim().split(/\s+/).filter(Boolean).length;
  const remainingMin = Math.max(1, Math.round((1 - progress) * personalReadTime(wordCount)));

  const paragraphs = (article.content || article.preview || "").split(/\n{2,}|\n/).filter(Boolean);

  const fullText = useMemo(() => (article.content || article.preview || ""), [article.content, article.preview]);
  const summary = useMemo(() => summarize(fullText, summaryLevel), [fullText, summaryLevel]);
  const quotes = useMemo(() => extractQuotes(fullText), [fullText]);
  const stats = useMemo(() => readability(fullText), [fullText]);
  const goal = todayProgress([]);

  const onTextMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.length < 4) { setSelection(null); return; }
    const range = sel!.getRangeAt(0);
    setSelection({ text, rect: range.getBoundingClientRect() });
  };

  const applyHighlight = (color: Highlight["color"]) => {
    if (!selection) return;
    const h = addHighlight({ articleId: article.id, text: selection.text, color });
    setHighlights(prev => [...prev, h]);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const renderHighlightedParagraph = (p: string, idx: number) => {
    if (highlights.length === 0) return <p key={idx}>{p}</p>;
    // simple highlight: wrap matched text segments
    const ranges: { start: number; end: number; color: Highlight["color"] }[] = [];
    for (const h of highlights) {
      let from = 0;
      while (true) {
        const i = p.indexOf(h.text, from);
        if (i < 0) break;
        ranges.push({ start: i, end: i + h.text.length, color: h.color });
        from = i + h.text.length;
      }
    }
    if (ranges.length === 0) return <p key={idx}>{p}</p>;
    ranges.sort((a, b) => a.start - b.start);
    const parts: any[] = [];
    let cursor = 0;
    const colorClass: Record<Highlight["color"], string> = {
      yellow: "bg-yellow-200/70 dark:bg-yellow-500/30",
      green: "bg-emerald-200/70 dark:bg-emerald-500/30",
      blue: "bg-blue-200/70 dark:bg-blue-500/30",
      rose: "bg-rose-200/70 dark:bg-rose-500/30",
    };
    for (const r of ranges) {
      if (r.start < cursor) continue;
      if (r.start > cursor) parts.push(p.slice(cursor, r.start));
      parts.push(<mark key={`${idx}-${r.start}`} className={`${colorClass[r.color]} rounded px-0.5`}>{p.slice(r.start, r.end)}</mark>);
      cursor = r.end;
    }
    if (cursor < p.length) parts.push(p.slice(cursor));
    return <p key={idx}>{parts}</p>;
  };

  return (
    <div className={`fixed inset-0 z-50 ${themeClasses}`} dir="rtl">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-black/10 dark:bg-white/10 z-10">
        <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress * 100}%` }} />
      </div>

      <div ref={containerRef} className="h-full overflow-y-auto">
        <div
          className="mx-auto px-6 pt-20 pb-32"
          style={{ maxWidth: WIDTH_PX[width], fontFamily, fontSize: `${fontSize}px`, lineHeight }}
        >
          {article.image && (
            <img src={article.image} alt="" className="w-full rounded-xl mb-8 max-h-96 object-cover" loading="lazy" />
          )}
          <div className="text-xs opacity-60 mb-3 flex items-center gap-2 flex-wrap">
            <span>{article.source}</span>
            {article.author && <><span>·</span><span>{article.author}</span></>}
            {article.date && <><span>·</span><span>{article.date}</span></>}
            <span>·</span><span>{article.readTime || `${Math.ceil(wordCount / 200)} دقیقه`}</span>
          </div>
          <h1 style={{ fontSize: `${Math.round(fontSize * 1.9)}px`, lineHeight: 1.4 }} className="mb-6 font-bold">
            {article.title}
          </h1>
          {article.preview && (
            <p className="opacity-80 mb-8 italic" style={{ fontSize: `${Math.round(fontSize * 1.05)}px` }}>
              {article.preview}
            </p>
          )}
          <div ref={articleBodyRef} onMouseUp={onTextMouseUp} onTouchEnd={onTextMouseUp} className="space-y-5" style={{ textAlign: align }}>
            {paragraphs.map((p, i) => renderHighlightedParagraph(p, i))}
          </div>
          <div className="mt-12 pt-6 border-t border-current/10 flex items-center justify-between text-xs opacity-60">
            <span>{remainingMin.toLocaleString("fa-IR")} دقیقه باقی‌مانده</span>
            {article.link && (
              <a href={article.link} target="_blank" rel="noopener" className="flex items-center gap-1 hover:opacity-100">
                مشاهدهٔ منبع <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/5 dark:bg-white/5 backdrop-blur rounded-full p-1">
        <button onClick={() => setTheme("light")} className={`p-2 rounded-full ${theme === "light" ? "bg-white shadow text-slate-900" : "opacity-60"}`} title="روشن"><Sun className="w-3.5 h-3.5" /></button>
        <button onClick={() => setTheme("sepia")} className={`p-2 rounded-full ${theme === "sepia" ? "bg-[#e8d9b4] text-[#3b2f17] shadow" : "opacity-60"}`} title="سپیا"><Coffee className="w-3.5 h-3.5" /></button>
        <button onClick={() => setTheme("dark")} className={`p-2 rounded-full ${theme === "dark" ? "bg-slate-800 text-white shadow" : "opacity-60"}`} title="تاریک"><Moon className="w-3.5 h-3.5" /></button>
      </div>

      <div className="absolute top-3 left-3 flex items-center gap-1">
        <button onClick={onClose} className="p-2 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10" title="بستن (Esc)">
          <X className="w-4 h-4" />
        </button>
        <button onClick={() => setPanel(panel === "summary" ? null : "summary")} className={`p-2 rounded-full ${panel === "summary" ? "bg-blue-500 text-white" : "bg-black/5 dark:bg-white/10 hover:bg-black/10"}`} title="خلاصه (s)">
          <Sparkles className="w-4 h-4" />
        </button>
        <button onClick={() => setPanel(panel === "highlights" ? null : "highlights")} className={`p-2 rounded-full ${panel === "highlights" ? "bg-amber-500 text-white" : "bg-black/5 dark:bg-white/10 hover:bg-black/10"}`} title="هایلایت‌ها (h)">
          <Highlighter className="w-4 h-4" />
          {highlights.length > 0 && <span className="absolute -top-1 -left-1 bg-amber-500 text-white text-[9px] rounded-full px-1">{highlights.length}</span>}
        </button>
        <button onClick={() => setPanel(panel === "quotes" ? null : "quotes")} className={`p-2 rounded-full ${panel === "quotes" ? "bg-violet-500 text-white" : "bg-black/5 dark:bg-white/10 hover:bg-black/10"}`} title="نقل‌قول‌ها (q)">
          <QuoteIcon className="w-4 h-4" />
        </button>
        <button onClick={() => setPanel(panel === "minimap" ? null : "minimap")} className={`p-2 rounded-full ${panel === "minimap" ? "bg-emerald-500 text-white" : "bg-black/5 dark:bg-white/10 hover:bg-black/10"}`} title="نقشهٔ کوچک (m)">
          <MapIcon className="w-4 h-4" />
        </button>
      </div>

      {selection && (
        <div
          className="fixed z-50 flex items-center gap-1 bg-slate-900 text-white rounded-full shadow-2xl px-1.5 py-1"
          style={{ top: Math.max(8, selection.rect.top - 44), left: Math.max(8, selection.rect.left + selection.rect.width / 2 - 80) }}
        >
          {(["yellow", "green", "blue", "rose"] as Highlight["color"][]).map(c => (
            <button key={c} onClick={() => applyHighlight(c)} className="w-6 h-6 rounded-full border-2 border-white/30 hover:scale-110 transition"
              style={{ background: c === "yellow" ? "#facc15" : c === "green" ? "#10b981" : c === "blue" ? "#3b82f6" : "#f43f5e" }}
              title={`هایلایت ${c}`} />
          ))}
        </div>
      )}

      {panel && (
        <div className="absolute top-16 right-3 bottom-20 w-80 max-w-[90vw] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-30 flex flex-col text-slate-900 dark:text-slate-100" dir="rtl">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-slate-800">
            <div className="text-sm flex-1">
              {panel === "summary" && "خلاصه AI"}
              {panel === "highlights" && `هایلایت‌ها (${highlights.length})`}
              {panel === "quotes" && `نقل‌قول‌ها (${quotes.length})`}
              {panel === "minimap" && "نقشهٔ مقاله"}
            </div>
            <button onClick={() => setPanel(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"><X className="w-3.5 h-3.5" /></button>
          </div>

          {panel === "summary" && (
            <div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed">
              <div className="flex items-center gap-1 mb-3">
                {(["tldr", "short", "structured"] as SummaryLevel[]).map(l => (
                  <button key={l} onClick={() => setSummaryLevel(l)}
                    className={`text-[11px] px-2.5 py-1 rounded-full ${summaryLevel === l ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-800"}`}>
                    {l === "tldr" ? "خلاصه" : l === "short" ? "پاراگراف" : "ساختاریافته"}
                  </button>
                ))}
              </div>
              {summaryLevel === "structured" ? (
                <div className="space-y-2">
                  {Object.entries(summary as StructuredSummary).map(([k, v]) => v && (
                    <div key={k}>
                      <div className="text-[10px] uppercase opacity-60 mb-0.5">
                        {k === "what" ? "چه" : k === "who" ? "که" : k === "where" ? "کجا" : k === "when" ? "کِی" : "چرا"}
                      </div>
                      <div className="text-sm">{v}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>{summary as string}</p>
              )}
              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3 text-[11px] text-slate-500">
                <span>{stats.words.toLocaleString("fa-IR")} واژه</span>
                <span>·</span>
                <span>{stats.sentences.toLocaleString("fa-IR")} جمله</span>
                <span>·</span>
                <span className={`px-1.5 py-0.5 rounded ${stats.level === "آسان" ? "bg-emerald-100 text-emerald-700" : stats.level === "متوسط" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>{stats.level}</span>
              </div>
            </div>
          )}

          {panel === "highlights" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {highlights.length === 0 && (
                <div className="text-xs text-slate-500 text-center py-8">
                  متنی را انتخاب کنید تا هایلایت بزنید.
                </div>
              )}
              {highlights.map(h => (
                <div key={h.id} className={`rounded-lg p-2 border-r-4 bg-slate-50 dark:bg-slate-800/50`}
                  style={{ borderColor: h.color === "yellow" ? "#facc15" : h.color === "green" ? "#10b981" : h.color === "blue" ? "#3b82f6" : "#f43f5e" }}>
                  <div className="text-xs leading-relaxed">{h.text}</div>
                  {editingNote === h.id ? (
                    <div className="mt-2">
                      <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
                        rows={2} className="w-full text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5" />
                      <div className="flex gap-1 mt-1">
                        <button onClick={() => { updateHighlight(h.id, { note: noteDraft }); setHighlights(getHighlights(article.id)); setEditingNote(null); }}
                          className="text-[10px] px-2 py-0.5 bg-blue-500 text-white rounded">ذخیره</button>
                        <button onClick={() => setEditingNote(null)} className="text-[10px] px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">انصراف</button>
                      </div>
                    </div>
                  ) : h.note ? (
                    <div className="mt-1 text-[11px] italic opacity-75 cursor-pointer" onClick={() => { setEditingNote(h.id); setNoteDraft(h.note || ""); }}>{h.note}</div>
                  ) : null}
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-500">
                    <button onClick={() => { setEditingNote(h.id); setNoteDraft(h.note || ""); }} className="hover:text-blue-500">{h.note ? "ویرایش یادداشت" : "افزودن یادداشت"}</button>
                    <button onClick={() => { removeHighlight(h.id); setHighlights(getHighlights(article.id)); }} className="hover:text-rose-500 flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {panel === "quotes" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {quotes.length === 0 && <div className="text-xs text-slate-500 text-center py-8">نقل‌قولی شناسایی نشد.</div>}
              {quotes.map((q, i) => (
                <div key={i} className="rounded-lg p-2 bg-violet-50 dark:bg-violet-950/30 border-r-4 border-violet-400">
                  <div className="text-xs leading-relaxed">«{q.text}»</div>
                  {q.speaker && <div className="text-[10px] text-violet-600 dark:text-violet-300 mt-1">— {q.speaker}</div>}
                </div>
              ))}
            </div>
          )}

          {panel === "minimap" && (
            <div className="flex-1 overflow-y-auto p-3">
              <div className="text-[10px] text-slate-500 mb-2">روی هر بخش کلیک کنید برای پرش.</div>
              <div className="space-y-1">
                {paragraphs.map((p, i) => {
                  const target = (i / Math.max(1, paragraphs.length - 1));
                  const active = Math.abs(progress - target) < 1 / Math.max(2, paragraphs.length);
                  return (
                    <button key={i}
                      onClick={() => {
                        const el = containerRef.current; if (!el) return;
                        el.scrollTo({ top: target * (el.scrollHeight - el.clientHeight), behavior: "smooth" });
                      }}
                      className={`w-full text-right text-[11px] line-clamp-2 px-2 py-1.5 rounded ${active ? "bg-blue-500 text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
                      <span className="opacity-50 ml-1">{(i + 1).toLocaleString("fa-IR")}.</span>
                      {p.slice(0, 80)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-20 right-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100" dir="rtl">
        <div className="flex items-center gap-2 text-[11px]">
          <Target className="w-3.5 h-3.5 text-emerald-500" />
          <span>هدف امروز</span>
          <span className="tabular-nums opacity-70">{goal.read.toLocaleString("fa-IR")}/{goal.total.toLocaleString("fa-IR")}</span>
        </div>
        <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1 w-32">
          <div className="h-full bg-emerald-500" style={{ width: `${goal.pct * 100}%` }} />
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/80 dark:bg-white/10 text-white backdrop-blur rounded-full px-2 py-1.5 shadow-2xl">
        <button onClick={() => setFontSize(s => Math.max(13, s - 1))} className="p-1.5 rounded-full hover:bg-white/10" title="کوچکتر"><Minus className="w-3.5 h-3.5" /></button>
        <Type className="w-3.5 h-3.5 opacity-60" />
        <span className="text-[10px] tabular-nums w-6 text-center">{fontSize}</span>
        <button onClick={() => setFontSize(s => Math.min(30, s + 1))} className="p-1.5 rounded-full hover:bg-white/10" title="بزرگتر"><Plus className="w-3.5 h-3.5" /></button>
        <span className="w-px h-4 bg-white/20 mx-1" />
        <select value={font} onChange={e => setFont(e.target.value)}
          className="bg-transparent text-[11px] outline-none cursor-pointer">
          {FONTS.map(f => <option key={f.id} value={f.id} className="text-slate-900">{f.label}</option>)}
        </select>
        <span className="w-px h-4 bg-white/20 mx-1" />
        <button onClick={() => setLineHeight(h => Math.max(1.4, +(h - 0.1).toFixed(2)))} className="p-1.5 rounded-full hover:bg-white/10 text-[10px]" title="فاصله سطر کمتر">−ل</button>
        <button onClick={() => setLineHeight(h => Math.min(2.4, +(h + 0.1).toFixed(2)))} className="p-1.5 rounded-full hover:bg-white/10 text-[10px]" title="فاصله سطر بیشتر">+ل</button>
        <span className="w-px h-4 bg-white/20 mx-1" />
        {(["narrow", "medium", "wide"] as Width[]).map(w => (
          <button key={w} onClick={() => setWidth(w)} className={`px-2 py-1 rounded text-[10px] ${width === w ? "bg-white/20" : "opacity-60"}`}>{w === "narrow" ? "باریک" : w === "medium" ? "متوسط" : "پهن"}</button>
        ))}
        <span className="w-px h-4 bg-white/20 mx-1" />
        <button onClick={() => setAlign(a => a === "justify" ? "right" : "justify")} className="p-1.5 rounded-full hover:bg-white/10" title="ترازبندی">
          {align === "justify" ? <AlignJustify className="w-3.5 h-3.5" /> : <AlignLeft className="w-3.5 h-3.5" />}
        </button>
        <span className="w-px h-4 bg-white/20 mx-1" />
        <button onClick={speak} className={`p-1.5 rounded-full ${speaking ? "bg-blue-500" : "hover:bg-white/10"}`} title="پخش صوتی">
          {speaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
        {onToggleStar && (
          <button onClick={() => onToggleStar(article.id)} className={`p-1.5 rounded-full hover:bg-white/10 ${article.starred ? "text-amber-400" : ""}`} title="نشان">
            <Star className="w-3.5 h-3.5" fill={article.starred ? "currentColor" : "none"} />
          </button>
        )}
        {onToggleSave && (
          <button onClick={() => onToggleSave(article.id)} className={`p-1.5 rounded-full hover:bg-white/10 ${isSaved ? "text-blue-400" : ""}`} title="ذخیره">
            <Bookmark className="w-3.5 h-3.5" fill={isSaved ? "currentColor" : "none"} />
          </button>
        )}
      </div>
    </div>
  );
}
