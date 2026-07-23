import { useMemo, useState } from "react";
import type { Article } from "../data";
import {
  BUILT_IN_TOPICS, type Topic, type FocusMode, type Combinator,
  scoreArticleForTopic, topicColorClasses,
} from "../topics";
import { Eye, EyeOff, Filter, X, Plus, Link2, Check, VolumeX } from "lucide-react";
import { TopicSparkline } from "./TopicSparkline";
import { SMART_FILTERS, type SmartFilterId, applySmartFilter, applyMute } from "../smartFilters";

function parseDateMs(s: string): number {
  const t = new Date(s).getTime();
  return isNaN(t) ? 0 : t;
}
const SPARK_BUCKETS = 8;

type Props = {
  articles: Article[];
  activeIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  mode: FocusMode;
  onModeChange: (m: FocusMode) => void;
  combinator?: Combinator;
  onCombinatorChange?: (c: Combinator) => void;
  customTopics?: Topic[];
  onAddCustom?: () => void;
  onEditCustom?: (t: Topic) => void;
  smartActive: SmartFilterId | null;
  onSmartChange: (v: SmartFilterId | null) => void;
  muteWords: string[];
  onMuteChange: (arr: string[]) => void;
};

export function TopicFocusBar({
  articles, activeIds, onToggle, onClear, mode, onModeChange,
  combinator = "or", onCombinatorChange,
  customTopics = [], onAddCustom, onEditCustom,
  smartActive, onSmartChange, muteWords, onMuteChange,
}: Props) {
  const allTopics = useMemo(() => [...BUILT_IN_TOPICS, ...customTopics], [customTopics]);
  const [copied, setCopied] = useState(false);
  const [muteOpen, setMuteOpen] = useState(false);
  const [muteInput, setMuteInput] = useState("");

  const smartCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const f of SMART_FILTERS) {
      try { out[f.id] = applyMute(applySmartFilter(articles, f.id), muteWords).length; }
      catch { out[f.id] = 0; }
    }
    return out;
  }, [articles, muteWords]);

  const addMuteWord = () => {
    const w = muteInput.trim();
    if (!w) return;
    if (!muteWords.includes(w)) onMuteChange([...muteWords, w]);
    setMuteInput("");
  };

  const { counts, sparks } = useMemo(() => {
    const counts: Record<string, number> = {};
    const sparks: Record<string, number[]> = {};
    const now = Date.now();
    const span = 24 * 3600 * 1000;
    const bucket = span / SPARK_BUCKETS;
    for (const t of allTopics) {
      let n = 0;
      const arr = new Array(SPARK_BUCKETS).fill(0);
      for (const a of articles) {
        const s = scoreArticleForTopic(a, t);
        if (s.level === "none") continue;
        n++;
        const ts = parseDateMs(a.date);
        if (!ts) continue;
        const age = now - ts;
        if (age < 0 || age > span) continue;
        const idx = Math.min(SPARK_BUCKETS - 1, Math.floor((span - age) / bucket));
        arr[idx]++;
      }
      counts[t.id] = n;
      sparks[t.id] = arr;
    }
    return { counts, sparks };
  }, [articles, allTopics]);

  const copyShareLink = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("topic", activeIds.join(","));
      url.searchParams.set("mode", mode);
      if (combinator !== "or") url.searchParams.set("combinator", combinator);
      else url.searchParams.delete("combinator");
      navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  const cycleCombinator = () => {
    const next: Combinator = combinator === "or" ? "and" : combinator === "and" ? "not" : "or";
    onCombinatorChange?.(next);
  };
  const combLabel = combinator === "or" ? "هرکدام" : combinator === "and" ? "همه با هم" : "به‌جز";

  const matchedTotal = activeIds.reduce((s, id) => s + (counts[id] || 0), 0);
  const hasActive = activeIds.length > 0;

  const ModeBtn = ({ m, label, Icon }: { m: FocusMode; label: string; Icon: any }) => (
    <button
      onClick={() => onModeChange(m)}
      title={label}
      className={`p-1.5 rounded-md transition-colors ${
        mode === m
          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
          : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
      }`}
    ><Icon className="w-3.5 h-3.5" /></button>
  );

  return (
    <div className="shrink-0 z-10 bg-white/90 dark:bg-slate-950/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
      <div className="px-3 py-2 flex items-center flex-wrap gap-2">
        <div className="flex items-center gap-1 shrink-0">
          <ModeBtn m="highlight" label="هایلایت اخبار مرتبط" Icon={Eye} />
          <ModeBtn m="dim" label="محو غیرمرتبط" Icon={EyeOff} />
          <ModeBtn m="filter" label="فقط مرتبط" Icon={Filter} />
        </div>
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

        {onCombinatorChange && activeIds.length > 1 && (
          <>
            <button
              onClick={cycleCombinator}
              title="تغییر ترکیب موضوعات"
              className="shrink-0 px-2 py-1 rounded-md text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium tabular-nums"
            >{combLabel}</button>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />
          </>
        )}

        <details className="relative group [&_summary::-webkit-details-marker]:hidden shrink-0">
          <summary className={`list-none cursor-pointer select-none flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition border ${
            activeIds.length
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent"
              : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
          }`}>
            <span className="font-medium">موضوعات</span>
            {activeIds.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] tabular-nums bg-white/30 dark:bg-black/20">{activeIds.length.toLocaleString("fa-IR")}</span>
            )}
            <svg className="w-3 h-3 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </summary>
          <div className="absolute z-30 mt-1 right-0 min-w-[240px] max-h-80 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-1.5 flex flex-col gap-1">
            {allTopics.map(t => {
              const cls = topicColorClasses(t.color);
              const active = activeIds.includes(t.id);
              const c = counts[t.id] || 0;
              const disabled = c === 0 && !active;
              return (
                <button
                  key={t.id}
                  onClick={() => onToggle(t.id)}
                  onDoubleClick={() => t.custom && onEditCustom?.(t)}
                  title={t.custom ? "دابل‌کلیک برای ویرایش" : undefined}
                  disabled={disabled}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-200 border
                    ${active
                      ? `${cls.chip} border-transparent ring-2 ${cls.ring} ring-offset-1 ring-offset-white dark:ring-offset-slate-950 shadow-sm`
                      : disabled
                        ? "bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border-slate-200/50 dark:border-slate-800 opacity-50 cursor-not-allowed"
                        : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}
                >
                  <span>{t.icon}</span>
                  <span className="font-medium flex-1 text-right truncate">{t.name}</span>
                  {sparks[t.id] && c > 0 && (
                    <TopicSparkline buckets={sparks[t.id]} />
                  )}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${active ? "bg-white/40 dark:bg-black/30" : "bg-slate-200/70 dark:bg-slate-700/70"}`}>
                    {c}
                  </span>
                </button>
              );
            })}
            {onAddCustom && (
              <button
                onClick={onAddCustom}
                title="موضوع سفارشی"
                className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              ><Plus className="w-3 h-3" /> سفارشی</button>
            )}
          </div>
        </details>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

        <details className="relative group [&_summary::-webkit-details-marker]:hidden shrink-0 text-xs">
          <summary className={`list-none cursor-pointer select-none flex items-center gap-1 px-2 py-1 rounded-md transition ${
            smartActive
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
          }`}>
            {(() => {
              const af = SMART_FILTERS.find(f => f.id === smartActive);
              return af ? (
                <><span>{af.icon}</span><span>{af.name}</span><span className="tabular-nums opacity-80">{smartCounts[af.id] || 0}</span></>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                  <span>فیلتر هوشمند</span>
                </>
              );
            })()}
            <svg className="w-3 h-3 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </summary>
          <div className="absolute z-30 mt-1 right-0 min-w-[210px] max-h-72 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-1">
            <button
              onClick={(e) => { onSmartChange(null); (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open"); }}
              className={`w-full text-right flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition ${!smartActive ? "bg-slate-100 dark:bg-slate-800 font-medium text-slate-900 dark:text-slate-100" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"}`}
            >
              <span className="flex-1">همه (بدون فیلتر)</span>
            </button>
            {SMART_FILTERS.map(f => {
              const active = smartActive === f.id;
              const c = smartCounts[f.id] || 0;
              return (
                <button
                  key={f.id}
                  onClick={(e) => { onSmartChange(active ? null : f.id); (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open"); }}
                  title={f.description}
                  disabled={!active && c === 0}
                  className={`w-full text-right flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition ${
                    active
                      ? "bg-slate-100 dark:bg-slate-800 font-medium text-slate-900 dark:text-slate-100"
                      : c === 0
                        ? "opacity-40 cursor-not-allowed text-slate-500"
                        : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <span className="shrink-0">{f.icon}</span>
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="tabular-nums opacity-60">{c}</span>
                </button>
              );
            })}
          </div>
        </details>

        <button
          onClick={() => setMuteOpen(o => !o)}
          title="کلمات mute"
          className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-xs transition ${
            muteWords.length
              ? "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
              : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
          }`}
        >
          <VolumeX className="w-3.5 h-3.5" />
          <span>mute</span>
          {muteWords.length > 0 && <span className="tabular-nums">{muteWords.length}</span>}
        </button>

        {hasActive && (
          <div className="flex items-center gap-2 shrink-0 mr-auto pl-2">
            <span className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
              {matchedTotal} از {articles.length} منطبق
            </span>
            <button
              onClick={copyShareLink}
              title="کپی لینک اشتراک‌گذاری"
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
            >{copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Link2 className="w-3.5 h-3.5" />}</button>
            <button
              onClick={onClear}
              title="پاک کردن"
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
            ><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>

      {muteOpen && (
        <div className="px-3 pb-2 flex items-center gap-1.5 flex-wrap">
          {muteWords.map(w => (
            <span key={w} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
              {w}
              <button onClick={() => onMuteChange(muteWords.filter(x => x !== w))} className="hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            value={muteInput}
            onChange={e => setMuteInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addMuteWord(); } }}
            placeholder="کلمه برای mute..."
            className="flex-1 min-w-[120px] px-2 py-0.5 text-[11px] bg-slate-100 dark:bg-slate-800 rounded outline-none focus:ring-1 focus:ring-slate-400"
          />
          <button onClick={addMuteWord} className="px-1.5 py-0.5 rounded text-[11px] bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center gap-0.5">
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
