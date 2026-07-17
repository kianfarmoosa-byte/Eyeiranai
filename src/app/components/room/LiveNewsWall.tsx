import { useMemo, useState } from "react";
import { Pin, PinOff, ExternalLink, Filter, X, Flame, Search } from "lucide-react";
import type { Article } from "../../data";
import { scoreArticle, sentimentLabelFa } from "../../sentiment";
import { timeAgoFa, faNum } from "../mobile/utils/fa";
import { articleMs, tokensOf } from "./roomUtils";

// ── ۳.۱ دیوار خبر زنده (Live News Wall) ──
// جریان زندهٔ عناوین همهٔ منابع با رنگ‌بندی لحن، نشان اهمیت، فیلتر سریع، سنجاق.

type Props = {
  articles: Article[];
  pins: string[];
  onTogglePin: (id: string) => void;
  onSelect: (a: Article) => void;
  big?: boolean;            // حالت دیوار: فونت درشت، خوانا از سه‌متری
  compact?: boolean;        // ستون باریک (مثلاً کنار نقشه)
};

// امتیاز اهمیت: تازگی + قطعیت لحن + حجم عنوان
function importance(a: Article): number {
  const ageH = (Date.now() - articleMs(a)) / 3600000;
  const recency = Math.max(0, 1 - ageH / 24);
  const s = scoreArticle(a);
  return recency * 0.6 + s.confidence * 0.3 + Math.min(1, (a.title?.length || 0) / 90) * 0.1;
}

function toneBar(label: "positive" | "negative" | "neutral"): string {
  return label === "positive" ? "bg-emerald-500" : label === "negative" ? "bg-rose-500" : "bg-slate-400";
}
function toneEdge(label: "positive" | "negative" | "neutral"): string {
  return label === "positive"
    ? "border-r-emerald-400 dark:border-r-emerald-500"
    : label === "negative"
    ? "border-r-rose-400 dark:border-r-rose-500"
    : "border-r-slate-300 dark:border-r-slate-600";
}

export function LiveNewsWall({ articles, pins, onTogglePin, onSelect, big, compact }: Props) {
  const [tone, setTone] = useState<"all" | "positive" | "negative" | "neutral">("all");
  const [source, setSource] = useState<string>("");
  const [kw, setKw] = useState("");
  const [hours, setHours] = useState<number>(24);
  const [focus, setFocus] = useState<Article | null>(null);

  const pinSet = useMemo(() => new Set(pins), [pins]);

  const sources = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of articles) m.set(a.source, (m.get(a.source) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
  }, [articles]);

  const filtered = useMemo(() => {
    const since = Date.now() - hours * 3600000;
    const q = kw.trim().toLowerCase();
    const list = articles
      .filter(a => articleMs(a) >= since)
      .filter(a => !source || a.source === source)
      .filter(a => !q || `${a.title} ${a.preview || ""}`.toLowerCase().includes(q))
      .map(a => ({ a, s: scoreArticle(a) }))
      .filter(x => tone === "all" || x.s.label === tone);
    // سنجاق‌شده‌ها بالا، سپس بر پایهٔ اهمیت
    return list.sort((x, y) => {
      const px = pinSet.has(x.a.id) ? 1 : 0;
      const py = pinSet.has(y.a.id) ? 1 : 0;
      if (px !== py) return py - px;
      return importance(y.a) - importance(x.a);
    });
  }, [articles, tone, source, kw, hours, pinSet]);

  const related = useMemo(() => {
    if (!focus) return [] as Article[];
    const ft = new Set(tokensOf(focus));
    return articles
      .filter(a => a.id !== focus.id)
      .map(a => {
        const t = tokensOf(a);
        let inter = 0; for (const x of t) if (ft.has(x)) inter++;
        return { a, score: inter };
      })
      .filter(x => x.score >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(x => x.a);
  }, [focus, articles]);

  const titleCls = big ? "text-lg leading-8" : compact ? "text-xs leading-5" : "text-sm leading-6";
  const metaCls = big ? "text-sm" : "text-[11px]";

  const seg = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-xs transition ${active
      ? "bg-white dark:bg-slate-900 shadow-sm text-emerald-700 dark:text-emerald-300"
      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"}`;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* فیلتر سریع */}
      {!big && (
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="relative">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input value={kw} onChange={e => setKw(e.target.value)} placeholder="کلیدواژه…"
              className="w-40 bg-slate-100 dark:bg-slate-800 rounded-lg pr-7 pl-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
            <button className={seg(tone === "all")} onClick={() => setTone("all")}>همه</button>
            <button className={seg(tone === "positive")} onClick={() => setTone("positive")}>مثبت</button>
            <button className={seg(tone === "neutral")} onClick={() => setTone("neutral")}>خنثی</button>
            <button className={seg(tone === "negative")} onClick={() => setTone("negative")}>منفی</button>
          </div>
          <select value={source} onChange={e => setSource(e.target.value)}
            className="bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1.5 text-xs max-w-[10rem]">
            <option value="">همهٔ منابع</option>
            {sources.map(([s, c]) => <option key={s} value={s}>{s} ({faNum(c)})</option>)}
          </select>
          <select value={hours} onChange={e => setHours(Number(e.target.value))}
            className="appearance-none bg-slate-100 dark:bg-slate-800 rounded-lg text-xs py-1.5 pr-3 pl-7 bg-no-repeat bg-[position:left_0.5rem_center] bg-[length:0.7rem] bg-[url(&quot;data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20fill='none'%20viewBox='0%200%2024%2024'%20stroke='%2394a3b8'%20stroke-width='2.5'%3E%3Cpath%20stroke-linecap='round'%20stroke-linejoin='round'%20d='M6%209l6%206%206-6'/%3E%3C/svg%3E&quot;)] focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
            <option value={3}>۳ ساعت</option>
            <option value={12}>۱۲ ساعت</option>
            <option value={24}>۲۴ ساعت</option>
            <option value={72}>۳ روز</option>
          </select>
          {(kw || source || tone !== "all" || hours !== 24) && (
            <button onClick={() => { setKw(""); setSource(""); setTone("all"); setHours(24); }}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-500">
              <X className="w-3.5 h-3.5" /> پاک‌سازی
            </button>
          )}
          <span className="text-[11px] text-slate-400 mr-auto flex items-center gap-1">
            <Filter className="w-3 h-3" /> {faNum(filtered.length)} خبر
          </span>
        </div>
      )}

      {/* جریان */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">خبری در این فیلتر نیست.</div>
        ) : (
          <div className={`grid gap-2 p-3 ${big ? "grid-cols-1 xl:grid-cols-2" : compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
            {filtered.map(({ a, s }) => {
              const pinned = pinSet.has(a.id);
              return (
                <div key={a.id}
                  className={`group relative rounded-xl border border-r-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 ${toneEdge(s.label)} ${pinned ? "ring-2 ring-amber-400" : ""} hover:border-emerald-400 transition p-3`}>
                  <div className={`flex items-center gap-1.5 ${metaCls} text-slate-500 mb-1`}>
                    <span>{a.sourceIcon}</span>
                    <span className="truncate">{a.source}</span>
                    <span className={`inline-block w-2 h-2 rounded-full ${toneBar(s.label)}`} title={sentimentLabelFa(s.label)} />
                    {importance(a) > 0.7 && <Flame className="w-3.5 h-3.5 text-orange-500" />}
                    <span className="mr-auto whitespace-nowrap">{timeAgoFa(articleMs(a))}</span>
                  </div>
                  <button onClick={() => setFocus(a)} className="block text-right w-full">
                    <div className={`${titleCls} line-clamp-3`}>{a.title}</div>
                  </button>
                  <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => onTogglePin(a.id)} title={pinned ? "برداشتن سنجاق" : "سنجاق به بالای دیوار"}
                      className={`p-1 rounded ${pinned ? "bg-amber-500 text-white" : "bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950"}`}>
                      {pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* حالت تمرکز: متن + مرتبط‌ها */}
      {focus && (
        <div className="fixed inset-0 z-40 flex" style={{ direction: "rtl" }}>
          <div className="flex-1 bg-black/50" onClick={() => setFocus(null)} />
          <div className="w-full max-w-md bg-white dark:bg-slate-950 h-full overflow-y-auto shadow-2xl border-r border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-start gap-2">
              <div className="flex-1">
                <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
                  <span>{focus.sourceIcon}</span> {focus.source} · {timeAgoFa(articleMs(focus))}
                </div>
                <h3 className="text-base leading-7">{focus.title}</h3>
              </div>
              <button onClick={() => setFocus(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">{focus.preview || focus.content?.slice(0, 400)}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { onSelect(focus); setFocus(null); }}
                  className="px-3 py-1.5 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-700">باز کردن کامل</button>
                <button onClick={() => onTogglePin(focus.id)}
                  className="px-3 py-1.5 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950 inline-flex items-center gap-1">
                  <Pin className="w-4 h-4" /> {pinSet.has(focus.id) ? "سنجاق‌شده" : "سنجاق"}
                </button>
                {focus.link && (
                  <a href={focus.link} target="_blank" rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 inline-flex items-center gap-1">
                    <ExternalLink className="w-4 h-4" /> منبع
                  </a>
                )}
              </div>
              {related.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 mb-2">خبرهای مرتبط</div>
                  <div className="space-y-1.5">
                    {related.map(r => (
                      <button key={r.id} onClick={() => setFocus(r)}
                        className="w-full text-right p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-emerald-400 text-xs">
                        <div className="text-slate-500 mb-0.5">{r.sourceIcon} {r.source}</div>
                        <div className="line-clamp-2">{r.title}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
