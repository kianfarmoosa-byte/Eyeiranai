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
        {SMART_FILTERS.map(f => {
          const active = smartActive === f.id;
          const c = counts[f.id] || 0;
          return (
            <button
              key={f.id}
              onClick={() => onSmartChange(active ? null : f.id)}
              title={f.description}
              disabled={!active && c === 0}
              className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md transition ${
                active
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : c === 0
                    ? "opacity-40 cursor-not-allowed text-slate-500"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              <span>{f.icon}</span>
              <span>{f.name}</span>
              <span className={`tabular-nums ${active ? "opacity-80" : "opacity-60"}`}>{c}</span>
            </button>
          );
        })}

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
