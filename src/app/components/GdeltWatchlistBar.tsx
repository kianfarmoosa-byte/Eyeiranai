import { useEffect, useState } from "react";
import { Bookmark, BookmarkPlus, X, Languages } from "lucide-react";
import {
  loadWatchlists, addWatchlist, removeWatchlist, pickEmoji,
  type Watchlist,
} from "../gdeltWatchlist";
import type { GdeltDocQuery } from "../gdelt";

type Props = {
  current: Pick<GdeltDocQuery, "q" | "lang" | "country" | "theme" | "timespan" | "sort">;
  multilang: boolean;
  onApply: (w: Watchlist) => void;
};

export function GdeltWatchlistBar({ current, multilang, onApply }: Props) {
  const [items, setItems] = useState<Watchlist[]>(() => loadWatchlists());
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    const onStorage = () => setItems(loadWatchlists());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const canSave = !!(current.q || current.theme || current.country);

  const save = () => {
    const trimmed = name.trim();
    const seed = trimmed || current.q || current.theme || current.country || "watchlist";
    const w = addWatchlist({
      name: trimmed || seed,
      emoji: pickEmoji(seed),
      query: current,
      multilang,
    });
    setItems(loadWatchlists());
    setName("");
    setShowAdd(false);
    onApply(w);
  };

  const remove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeWatchlist(id);
    setItems(loadWatchlists());
  };

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-1.5 bg-slate-50/50 dark:bg-slate-900/30 flex items-center gap-1.5 overflow-x-auto">
      <Bookmark className="w-3.5 h-3.5 text-amber-500 shrink-0" />
      <span className="text-[10px] text-slate-500 shrink-0 ml-1">واچ‌لیست‌ها:</span>
      {items.length === 0 && (
        <span className="text-[11px] text-slate-400 shrink-0">هنوز واچ‌لیستی ذخیره نشده.</span>
      )}
      {items.map(w => (
        <button key={w.id} onClick={() => onApply(w)}
          className="group shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-slate-700 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition">
          <span>{w.emoji}</span>
          <span className="max-w-[120px] truncate">{w.name}</span>
          {w.multilang && <Languages className="w-2.5 h-2.5 text-violet-500" />}
          <span onClick={(e) => remove(w.id, e)}
            className="opacity-0 group-hover:opacity-100 hover:text-rose-500 transition cursor-pointer">
            <X className="w-3 h-3" />
          </span>
        </button>
      ))}
      <div className="flex-1 shrink-0 min-w-[8px]" />
      {showAdd ? (
        <div className="flex items-center gap-1 shrink-0">
          <input value={name} autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setShowAdd(false); setName(""); } }}
            placeholder="نام واچ‌لیست"
            className="text-[11px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-full px-2 py-0.5 w-32 outline-none focus:border-amber-400" />
          <button onClick={save} disabled={!canSave}
            className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500 hover:bg-amber-400 text-white disabled:opacity-50">
            ذخیره
          </button>
          <button onClick={() => { setShowAdd(false); setName(""); }}
            className="text-[11px] px-1.5 py-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} disabled={!canSave}
          className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border border-dashed border-amber-400 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-40 disabled:cursor-not-allowed">
          <BookmarkPlus className="w-3 h-3" /> ذخیرهٔ کوئری فعلی
        </button>
      )}
    </div>
  );
}
