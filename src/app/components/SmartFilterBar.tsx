import { useMemo, useState } from "react";
import type { Article } from "../data";
import { SMART_FILTERS, type SmartFilterId, applySmartFilter, applyMute } from "../smartFilters";
import { VolumeX, X, Plus } from "lucide-react";

type Props = {
  articles: Article[];
  smartActive: SmartFilterId | null;
  onSmartChange: (v: SmartFilterId | null) => void;
  muteWords: string[];
  onMuteChange: (arr: string[]) => void;
};

export function SmartFilterBar({ articles, smartActive, onSmartChange, muteWords, onMuteChange }: Props) {
  const [muteOpen, setMuteOpen] = useState(false);
  const [input, setInput] = useState("");

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const f of SMART_FILTERS) {
      try { out[f.id] = applyMute(applySmartFilter(articles, f.id), muteWords).length; }
      catch { out[f.id] = 0; }
    }
    return out;
  }, [articles, muteWords]);

  const addWord = () => {
    const w = input.trim();
    if (!w) return;
    if (!muteWords.includes(w)) onMuteChange([...muteWords, w]);
    setInput("");
  };

  return (
    <div className="shrink-0 z-10 bg-white/80 dark:bg-slate-950/80 backdrop-blur border-b border-slate-200 dark:border-slate-800">
      <div className="px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto text-xs">
        <details className="relative group [&_summary::-webkit-details-marker]:hidden shrink-0">
          <summary className={`list-none cursor-pointer select-none flex items-center gap-1 px-2 py-1 rounded-md transition ${
            smartActive
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
          }`}>
            {(() => {
              const af = SMART_FILTERS.find(f => f.id === smartActive);
              return af ? (
                <><span>{af.icon}</span><span>{af.name}</span><span className="tabular-nums opacity-80">{counts[af.id] || 0}</span></>
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
              const c = counts[f.id] || 0;
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

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1 shrink-0" />

        <button
          onClick={() => setMuteOpen(o => !o)}
          title="کلمات mute"
          className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md transition ${
            muteWords.length
              ? "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
              : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
          }`}
        >
          <VolumeX className="w-3.5 h-3.5" />
          <span>mute</span>
          {muteWords.length > 0 && <span className="tabular-nums">{muteWords.length}</span>}
        </button>
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
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addWord(); } }}
            placeholder="کلمه برای mute..."
            className="flex-1 min-w-[120px] px-2 py-0.5 text-[11px] bg-slate-100 dark:bg-slate-800 rounded outline-none focus:ring-1 focus:ring-slate-400"
          />
          <button onClick={addWord} className="px-1.5 py-0.5 rounded text-[11px] bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center gap-0.5">
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
