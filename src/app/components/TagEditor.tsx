import { useState, KeyboardEvent } from "react";
import { Tag, X, Plus } from "lucide-react";

type Props = {
  tags: string[];
  onChange: (tags: string[]) => void;
};

export function TagEditor({ tags, onChange }: Props) {
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);

  const add = () => {
    const v = input.trim();
    if (!v) { setAdding(false); return; }
    if (!tags.includes(v)) onChange([...tags, v]);
    setInput("");
    setAdding(false);
  };

  const remove = (t: string) => onChange(tags.filter(x => x !== t));

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); add(); }
    if (e.key === "Escape") { setInput(""); setAdding(false); }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Tag className="w-3.5 h-3.5 text-slate-400" />
      {tags.map(t => (
        <span key={t} className="inline-flex items-center gap-1 text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
          {t}
          <button onClick={() => remove(t)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          value={input}
          onChange={e => setInput(e.target.value)}
          onBlur={add}
          onKeyDown={onKey}
          placeholder="برچسب جدید"
          className="text-xs bg-slate-100 dark:bg-slate-800 rounded-full px-2 py-0.5 outline-none focus:ring-1 focus:ring-emerald-500 w-24"
        />
      ) : (
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 px-2 py-0.5 rounded-full border border-dashed border-slate-300 dark:border-slate-700">
          <Plus className="w-3 h-3" /> افزودن
        </button>
      )}
    </div>
  );
}
