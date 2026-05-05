import { useEffect, useMemo, useState } from "react";
import {
  X, Clock, Search, Calendar, Zap, Sparkles, Download, ArrowUpRight,
  Filter, RotateCcw, TrendingUp, Users, Layers, History, Tag,
  Grid3x3, GitCompareArrows, Image as ImageIcon, MessageSquarePlus, Plus, Trash2, Check,
} from "lucide-react";
import type { Article } from "../data";
import {
  buildTimeline, exportTimelineMarkdown, exportTimelinePNG,
  buildHeatmap, buildMultiTimeline,
  getAnnotation, setAnnotation, getAnnotationsForTopic,
  loadRecentTopics, pushRecentTopic, topicLabelOf,
  type Granularity, type TopicQuery, type Timeline, type TimelineEvent,
} from "../timeline";

type Props = {
  open: boolean;
  onClose: () => void;
  articles: Article[];
  initialTopic?: TopicQuery | null;
  onSelectArticle: (id: string) => void;
};

type Mode = "timeline" | "heatmap" | "compare";

const EVENT_STYLE: Record<TimelineEvent["kind"], { icon: any; cls: string }> = {
  first:      { icon: Sparkles,   cls: "from-emerald-500 to-teal-500" },
  spike:      { icon: Zap,        cls: "from-amber-500 to-rose-500" },
  peak:       { icon: TrendingUp, cls: "from-rose-500 to-pink-600" },
  broadening: { icon: Users,      cls: "from-violet-500 to-blue-500" },
  resurgence: { icon: RotateCcw,  cls: "from-blue-500 to-cyan-500" },
};

export function TimelineView({ open, onClose, articles, initialTopic, onSelectArticle }: Props) {
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<TopicQuery | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [innerSearch, setInnerSearch] = useState("");
  const [recent, setRecent] = useState<TopicQuery[]>([]);
  const [mode, setMode] = useState<Mode>("timeline");
  const [compareTopics, setCompareTopics] = useState<TopicQuery[]>([]);
  const [compareInput, setCompareInput] = useState("");
  const [annDraftKey, setAnnDraftKey] = useState<string | null>(null);
  const [annDraft, setAnnDraft] = useState("");
  const [annTick, setAnnTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    setRecent(loadRecentTopics());
    setSourceFilter(null);
    setInnerSearch("");
    setMode("timeline");
    setCompareTopics([]);
    setAnnDraftKey(null);
    if (initialTopic) {
      setTopic(initialTopic);
      setQuery(topicLabelOf(initialTopic));
      pushRecentTopic(initialTopic);
    } else {
      setTopic(null); setQuery("");
    }
  }, [open, initialTopic]);

  const submit = () => {
    const q = query.trim();
    if (!q) { setTopic(null); return; }
    const t: TopicQuery = q.startsWith("#") ? { kind: "tag", tag: q.slice(1) } : { kind: "keyword", q };
    setTopic(t); pushRecentTopic(t); setRecent(loadRecentTopics());
  };

  const applyTopic = (t: TopicQuery) => {
    setTopic(t); setQuery(topicLabelOf(t)); pushRecentTopic(t); setRecent(loadRecentTopics());
    setSourceFilter(null); setInnerSearch("");
  };

  const addCompare = () => {
    const q = compareInput.trim();
    if (!q) return;
    const t: TopicQuery = q.startsWith("#") ? { kind: "tag", tag: q.slice(1) } : { kind: "keyword", q };
    if (!compareTopics.some(x => topicLabelOf(x) === topicLabelOf(t))) {
      setCompareTopics([...compareTopics, t].slice(0, 6));
    }
    setCompareInput("");
  };

  const timeline: Timeline | null = useMemo(() => {
    if (!open || !topic) return null;
    return buildTimeline(articles, topic, granularity);
  }, [open, articles, topic, granularity]);

  const heatmap = useMemo(() => timeline ? buildHeatmap(timeline) : null, [timeline]);

  const multi = useMemo(() => {
    const all = topic ? [topic, ...compareTopics] : compareTopics;
    if (!open || all.length < 1) return null;
    return buildMultiTimeline(articles, all, granularity);
  }, [open, articles, topic, compareTopics, granularity]);

  const annotations = useMemo(() => {
    if (!timeline) return {};
    annTick;
    return getAnnotationsForTopic(timeline.topicLabel);
  }, [timeline, annTick]);

  const visibleBuckets = useMemo(() => {
    if (!timeline) return [];
    const f = sourceFilter;
    const s = innerSearch.trim().toLowerCase();
    return timeline.buckets.map(b => {
      const arts = b.articles.filter(a =>
        (!f || a.source === f) &&
        (!s || (a.title + " " + a.preview).toLowerCase().includes(s))
      );
      return { ...b, _articles: arts };
    });
  }, [timeline, sourceFilter, innerSearch]);

  const maxCount = useMemo(() => Math.max(1, ...(timeline?.buckets || []).map(b => b.articles.length)), [timeline]);

  const exportMd = () => {
    if (!timeline) return;
    const md = exportTimelineMarkdown(timeline);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    triggerDownload(blob, `timeline-${timeline.topicLabel.slice(0, 20)}-${new Date().toISOString().slice(0, 10)}.md`);
  };

  const exportPng = async () => {
    if (!timeline) return;
    const blob = await exportTimelinePNG(timeline);
    if (!blob) return;
    triggerDownload(blob, `timeline-${timeline.topicLabel.slice(0, 20)}-${new Date().toISOString().slice(0, 10)}.png`);
  };

  const openAnnotation = (key: string) => {
    setAnnDraftKey(key);
    setAnnDraft(timeline ? getAnnotation(timeline.topicLabel, key) : "");
  };
  const saveAnnotation = () => {
    if (!timeline || !annDraftKey) return;
    setAnnotation(timeline.topicLabel, annDraftKey, annDraft);
    setAnnDraftKey(null); setAnnDraft("");
    setAnnTick(t => t + 1);
  };
  const clearAnnotation = (key: string) => {
    if (!timeline) return;
    setAnnotation(timeline.topicLabel, key, "");
    setAnnTick(t => t + 1);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-stretch md:items-center md:justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-6xl md:max-h-[92vh] bg-white dark:bg-slate-950 md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-white flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-lg leading-tight truncate">خط زمانی موضوع</h2>
              <div className="text-[11px] text-slate-500 truncate">
                {timeline ? `${timeline.topicLabel} · ${timeline.total.toLocaleString("fa-IR")} مقاله` : "موضوعی برای ترسیم وارد کنید"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-900 p-0.5 me-2">
              {([
                { id: "timeline", icon: Clock, label: "خط زمانی" },
                { id: "heatmap", icon: Grid3x3, label: "هیت‌مپ" },
                { id: "compare", icon: GitCompareArrows, label: "مقایسه" },
              ] as const).map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.id} onClick={() => setMode(t.id)}
                    className={`px-2 py-1 rounded-md text-xs flex items-center gap-1 ${mode === t.id ? "bg-white dark:bg-slate-700 shadow" : "text-slate-500"}`}>
                    <Icon className="w-3.5 h-3.5" /> {t.label}
                  </button>
                );
              })}
            </div>
            <button onClick={exportPng} disabled={!timeline || timeline.total === 0}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40" title="خروجی PNG">
              <ImageIcon className="w-4 h-4" />
            </button>
            <button onClick={exportMd} disabled={!timeline || timeline.total === 0}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40" title="خروجی Markdown">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
          </div>
        </header>

        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                placeholder="موضوع: مثلاً «هوش مصنوعی»، «#اقتصاد»، نام شخص…"
                className="w-full pr-8 pl-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 text-sm outline-none focus:ring-2 ring-blue-500/30"
              />
            </div>
            <button onClick={submit} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> ترسیم
            </button>
            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-900 p-0.5">
              {(["day", "week", "month"] as const).map(g => (
                <button key={g} onClick={() => setGranularity(g)}
                  className={`px-2.5 py-1 rounded-md text-xs ${granularity === g ? "bg-white dark:bg-slate-700 shadow" : "text-slate-500"}`}>
                  {g === "day" ? "روزانه" : g === "week" ? "هفتگی" : "ماهانه"}
                </button>
              ))}
            </div>
          </div>

          {!topic && recent.length > 0 && mode !== "compare" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <History className="w-3 h-3 text-slate-400" />
              <span className="text-[11px] text-slate-500">اخیر:</span>
              {recent.map((r, i) => (
                <button key={i} onClick={() => applyTopic(r)}
                  className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center gap-1">
                  {r.kind === "tag" && <Tag className="w-3 h-3" />}
                  {topicLabelOf(r)}
                </button>
              ))}
            </div>
          )}

          {mode === "compare" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <GitCompareArrows className="w-3 h-3 text-slate-400" />
              <span className="text-[11px] text-slate-500">موضوعات مقایسه:</span>
              {topic && (
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  {topicLabelOf(topic)} (پایه)
                </span>
              )}
              {compareTopics.map((t, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 flex items-center gap-1">
                  {topicLabelOf(t)}
                  <button onClick={() => setCompareTopics(compareTopics.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-500">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {compareTopics.length < 6 && (
                <div className="flex items-center gap-1">
                  <input value={compareInput} onChange={(e) => setCompareInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addCompare(); }}
                    placeholder="موضوع جدید…"
                    className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 outline-none w-32" />
                  <button onClick={addCompare} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500"><Plus className="w-3 h-3" /></button>
                </div>
              )}
            </div>
          )}

          {timeline && timeline.total > 0 && mode === "timeline" && (
            <div className="flex flex-wrap gap-2 items-center text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500">
                {timeline.span && new Date(timeline.span.from).toLocaleDateString("fa-IR")} —
                {timeline.span && new Date(timeline.span.to).toLocaleDateString("fa-IR")}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500">{timeline.buckets.filter(b => b.articles.length).length.toLocaleString("fa-IR")} بازه</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500">تنوع منبع: {Math.round(timeline.sourceDiversity * 100).toLocaleString("fa-IR")}٪</span>
              <div className="flex-1"></div>
              <div className="relative">
                <Filter className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input value={innerSearch} onChange={(e) => setInnerSearch(e.target.value)}
                  placeholder="فیلتر متنی…"
                  className="pr-7 pl-2 py-1 rounded-md bg-slate-100 dark:bg-slate-900 text-xs outline-none w-36" />
              </div>
            </div>
          )}
        </div>

        {timeline && timeline.total > 0 && mode === "timeline" && (
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="text-[11px] text-slate-500 mb-1.5 flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" /> حجم پوشش در طول زمان
            </div>
            <div className="flex items-end gap-0.5 h-16">
              {timeline.buckets.map(b => {
                const h = b.articles.length === 0 ? 2 : Math.max(4, Math.round((b.articles.length / maxCount) * 60));
                const tone = b.isSpike ? "bg-rose-500" : b.articles.length === 0 ? "bg-slate-200 dark:bg-slate-800" : "bg-blue-500";
                const hasAnn = !!annotations[b.key];
                return (
                  <div key={b.key} title={`${b.label}: ${b.articles.length.toLocaleString("fa-IR")} مقاله${hasAnn ? " · 📝" : ""}`}
                    className={`flex-1 min-w-[2px] ${tone} hover:opacity-70 cursor-help rounded-sm transition-opacity ${hasAnn ? "ring-2 ring-amber-400" : ""}`}
                    style={{ height: h }} />
                );
              })}
            </div>
          </div>
        )}

        {timeline && timeline.topSources.length > 0 && mode === "timeline" && (
          <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 shrink-0 flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] text-slate-500 flex items-center gap-1"><Layers className="w-3 h-3" /> منابع:</span>
            <button onClick={() => setSourceFilter(null)}
              className={`text-xs px-2 py-0.5 rounded-md ${!sourceFilter ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900"}`}>
              همه ({timeline.total.toLocaleString("fa-IR")})
            </button>
            {timeline.topSources.map(s => (
              <button key={s.source} onClick={() => setSourceFilter(sourceFilter === s.source ? null : s.source)}
                className={`text-xs px-2 py-0.5 rounded-md flex items-center gap-1 ${sourceFilter === s.source ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900"}`}>
                {s.icon && <span>{s.icon}</span>}
                {s.source}
                <span className="opacity-60">{s.count.toLocaleString("fa-IR")}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {!timeline && mode !== "compare" ? (
            <Hint icon={<Clock className="w-10 h-10" />} title="موضوعی برای ترسیم خط زمانی وارد کنید"
              desc="کلیدواژه، #تگ یا نام شخص/سازمان را تایپ و ترسیم کنید. می‌توانید از موتور دانش، برچسب مقاله یا منبع نیز جهش کنید." />
          ) : mode === "timeline" ? (
            !timeline || timeline.total === 0 ? (
              <Hint icon={<Search className="w-10 h-10" />} title="مقاله‌ای برای این موضوع پیدا نشد"
                desc="دانه‌بندی، فیلترها یا کلیدواژه را تغییر دهید. اگر مقاله‌های شما تاریخ معتبر ندارند، تایم‌لاین خالی خواهد ماند." />
            ) : (
              <div className="relative ms-4">
                <div className="absolute top-2 bottom-2 right-1.5 w-px bg-gradient-to-b from-transparent via-slate-200 dark:via-slate-800 to-transparent"></div>
                <div className="space-y-3">
                  {visibleBuckets.map((b: any) => {
                    const events = timeline.events.filter(e => e.bucketKey === b.key);
                    const ann = annotations[b.key];
                    if (b._articles.length === 0 && !events.length && !ann) return null;
                    const isEditing = annDraftKey === b.key;
                    return (
                      <div key={b.key} className="relative ps-6">
                        <div className={`absolute right-0 top-2 w-3 h-3 rounded-full ring-4 ring-white dark:ring-slate-950 ${b.isSpike ? "bg-rose-500" : b._articles.length === 0 ? "bg-slate-300 dark:bg-slate-700" : "bg-blue-500"}`}></div>
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <div className="text-sm font-semibold">{b.label}</div>
                          {b._articles.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                              {b._articles.length.toLocaleString("fa-IR")} مقاله
                            </span>
                          )}
                          {b.sources.size > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center gap-1">
                              <Users className="w-3 h-3" /> {b.sources.size.toLocaleString("fa-IR")} منبع
                            </span>
                          )}
                          {b.newSources.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                              +{b.newSources.length.toLocaleString("fa-IR")} منبع جدید
                            </span>
                          )}
                          <button onClick={() => openAnnotation(b.key)}
                            className="ms-auto p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 text-slate-400 hover:text-amber-600" title="افزودن یادداشت">
                            <MessageSquarePlus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {events.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {events.map((e, i) => {
                              const s = EVENT_STYLE[e.kind];
                              const Icon = s.icon;
                              return (
                                <span key={i} className={`inline-flex items-center gap-1 text-[10px] text-white px-2 py-0.5 rounded-full bg-gradient-to-r ${s.cls}`}>
                                  <Icon className="w-3 h-3" /> {e.label}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {(ann || isEditing) && (
                          <div className="mb-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-2">
                            {isEditing ? (
                              <div className="flex flex-col gap-1.5">
                                <textarea value={annDraft} onChange={(e) => setAnnDraft(e.target.value)}
                                  placeholder="رویداد یا یادداشت این بازه…"
                                  className="w-full text-xs p-2 rounded bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 outline-none resize-none" rows={2} autoFocus />
                                <div className="flex justify-end gap-1">
                                  <button onClick={() => setAnnDraftKey(null)} className="text-[11px] px-2 py-0.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">انصراف</button>
                                  <button onClick={saveAnnotation} className="text-[11px] px-2 py-0.5 rounded bg-amber-500 text-white hover:bg-amber-600 flex items-center gap-1">
                                    <Check className="w-3 h-3" /> ذخیره
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2">
                                <span className="text-amber-600 dark:text-amber-400 text-xs">📝</span>
                                <div className="flex-1 text-xs text-amber-900 dark:text-amber-100 whitespace-pre-wrap">{ann}</div>
                                <div className="flex gap-1 shrink-0">
                                  <button onClick={() => openAnnotation(b.key)} className="text-[11px] text-amber-700 dark:text-amber-300 hover:underline">ویرایش</button>
                                  <button onClick={() => clearAnnotation(b.key)} className="text-slate-400 hover:text-rose-500"><Trash2 className="w-3 h-3" /></button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {b._articles.length > 0 && (
                          <div className="space-y-1.5">
                            {b._articles.map((a: Article) => (
                              <button key={a.id} onClick={() => onSelectArticle(a.id)}
                                className="w-full text-right p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 group">
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-0.5">
                                  <span>{a.sourceIcon}</span>
                                  <span>{a.source}</span>
                                  <span>·</span>
                                  <span className="truncate">{a.author}</span>
                                  <ArrowUpRight className="w-3 h-3 ms-auto opacity-0 group-hover:opacity-100" />
                                </div>
                                <div className="text-sm font-medium leading-snug line-clamp-2">{a.title}</div>
                                {a.preview && <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{a.preview}</div>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          ) : mode === "heatmap" ? (
            !timeline || !heatmap || heatmap.cells.length === 0 ? (
              <Hint icon={<Grid3x3 className="w-10 h-10" />} title="داده‌ای برای هیت‌مپ نیست"
                desc="موضوعی با حداقل چند مقالهٔ تاریخ‌دار انتخاب کنید." />
            ) : (
              <HeatmapGrid heatmap={heatmap} topicLabel={timeline.topicLabel} />
            )
          ) : (
            // compare mode
            !multi || multi.series.length === 0 ? (
              <Hint icon={<GitCompareArrows className="w-10 h-10" />} title="حداقل یک موضوع برای مقایسه اضافه کنید"
                desc="از فیلد بالا موضوعات را اضافه کنید تا روی هم نمودار شوند." />
            ) : (
              <CompareChart multi={multi} />
            )
          )}
        </div>
      </div>
    </div>
  );
}

function HeatmapGrid({ heatmap, topicLabel }: { heatmap: ReturnType<typeof buildHeatmap>; topicLabel: string }) {
  const days = ["د", "س", "چ", "پ", "ج", "ش", "ی"];
  const intensity = (c: number) => {
    if (c === 0) return "bg-slate-100 dark:bg-slate-900";
    const r = c / Math.max(1, heatmap.max);
    if (r > 0.75) return "bg-blue-700 text-white";
    if (r > 0.5)  return "bg-blue-500 text-white";
    if (r > 0.25) return "bg-blue-400";
    return "bg-blue-200 dark:bg-blue-900";
  };
  const grid: any[][] = Array.from({ length: 7 }, () => Array(heatmap.weeks).fill(null));
  for (const c of heatmap.cells) grid[c.weekday][c.week] = c;

  return (
    <div>
      <div className="text-xs text-slate-500 mb-3">
        پراکندگی <span className="font-semibold">{topicLabel}</span> روی روزهای هفته (بیشینه {heatmap.max.toLocaleString("fa-IR")})
      </div>
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="grid gap-1" style={{ gridTemplateColumns: `auto repeat(${heatmap.weeks}, minmax(14px, 1fr))` }}>
            <div></div>
            {Array.from({ length: heatmap.weeks }).map((_, w) => (
              <div key={w} className="text-[9px] text-slate-400 text-center">{w + 1}</div>
            ))}
            {grid.flatMap((row, di) => [
              <div key={`d-${di}`} className="text-[10px] text-slate-500 pe-1 self-center">{days[di]}</div>,
              ...row.map((c: any, w: number) => (
                <div key={`${di}-${w}`}
                  title={c ? `${new Date(c.date).toLocaleDateString("fa-IR")} — ${c.count.toLocaleString("fa-IR")} مقاله` : ""}
                  className={`aspect-square rounded ${c ? intensity(c.count) : "bg-transparent"} text-[9px] flex items-center justify-center`}>
                  {c && c.count > 0 ? c.count.toLocaleString("fa-IR") : ""}
                </div>
              )),
            ])}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-4 text-[11px] text-slate-500">
        <span>کم</span>
        <div className="flex gap-1">
          {["bg-slate-100 dark:bg-slate-900", "bg-blue-200 dark:bg-blue-900", "bg-blue-400", "bg-blue-500", "bg-blue-700"].map(c => (
            <div key={c} className={`w-4 h-4 rounded ${c}`}></div>
          ))}
        </div>
        <span>زیاد</span>
      </div>
    </div>
  );
}

function CompareChart({ multi }: { multi: NonNullable<ReturnType<typeof buildMultiTimeline>> }) {
  const max = Math.max(1, ...multi.series.flatMap(s => s.counts));
  const W = 1000, H = 240, pad = { l: 30, r: 16, t: 16, b: 36 };
  const innerW = W - pad.l - pad.r, innerH = H - pad.t - pad.b;
  const stepX = multi.bucketStarts.length > 1 ? innerW / (multi.bucketStarts.length - 1) : 0;
  const yOf = (c: number) => pad.t + innerH - (c / max) * innerH;
  const path = (counts: number[]) =>
    counts.map((c, i) => `${i === 0 ? "M" : "L"} ${pad.l + i * stepX} ${yOf(c)}`).join(" ");

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-3">
        {multi.series.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className="w-3 h-3 rounded-sm" style={{ background: s.color }}></span>
            <span className="font-medium">{s.label}</span>
            <span className="text-slate-500">({s.total.toLocaleString("fa-IR")})</span>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 600 }}>
          {[0, 0.25, 0.5, 0.75, 1].map(r => (
            <line key={r} x1={pad.l} x2={W - pad.r} y1={pad.t + innerH * (1 - r)} y2={pad.t + innerH * (1 - r)}
              stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth={0.5} />
          ))}
          {[0, 0.5, 1].map(r => (
            <text key={r} x={pad.l - 4} y={pad.t + innerH * (1 - r) + 3} textAnchor="end" className="fill-slate-400 text-[9px]">
              {Math.round(max * r).toLocaleString("fa-IR")}
            </text>
          ))}
          {multi.series.map((s, i) => (
            <g key={i}>
              <path d={path(s.counts)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
              {s.counts.map((c, idx) => c > 0 && (
                <circle key={idx} cx={pad.l + idx * stepX} cy={yOf(c)} r={2.5} fill={s.color} />
              ))}
            </g>
          ))}
          {multi.bucketLabels.length > 0 && (
            <>
              <text x={pad.l} y={H - 14} className="fill-slate-500 text-[9px]" textAnchor="start">{multi.bucketLabels[0]}</text>
              <text x={W - pad.r} y={H - 14} className="fill-slate-500 text-[9px]" textAnchor="end">{multi.bucketLabels[multi.bucketLabels.length - 1]}</text>
            </>
          )}
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {multi.series.map((s, i) => {
          const peakIdx = s.counts.indexOf(Math.max(...s.counts));
          return (
            <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }}></span>
                <span className="font-medium truncate">{s.label}</span>
              </div>
              <div className="text-slate-500 mt-1">
                {s.total.toLocaleString("fa-IR")} مقاله
                {s.counts.length > 0 && peakIdx >= 0 && s.counts[peakIdx] > 0 && (
                  <> · اوج: {multi.bucketLabels[peakIdx]} ({s.counts[peakIdx].toLocaleString("fa-IR")})</>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Hint({ icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 text-slate-500">
      <div className="text-slate-300 dark:text-slate-700 mb-3">{icon}</div>
      <div className="font-medium mb-1">{title}</div>
      <div className="text-xs max-w-sm">{desc}</div>
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
