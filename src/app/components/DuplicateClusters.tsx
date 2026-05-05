import { useMemo } from "react";
import { Article } from "../data";
import { findDuplicates } from "../duplicates";
import { Layers } from "lucide-react";

type Props = {
  articles: Article[];
  onSelect?: (id: string) => void;
  threshold?: number;
};

export function DuplicateClusters({ articles, onSelect, threshold = 0.4 }: Props) {
  const clusters = useMemo(() => findDuplicates(articles, threshold), [articles, threshold]);
  if (!clusters.length) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-4 h-4 text-amber-500" />
        <h4 className="text-sm font-bold">پوشش چندگانه</h4>
        <span className="text-xs text-slate-500 mr-auto">{clusters.length} موضوع</span>
      </div>
      <div className="space-y-3">
        {clusters.slice(0, 8).map(c => (
          <div key={c.id} className="border-r-2 border-amber-400 pr-3">
            <div className="text-xs text-amber-700 dark:text-amber-400 mb-1">
              {c.articles.length} مقاله • {Math.round(c.similarity * 100)}٪ مشابه
            </div>
            <div className="space-y-1">
              {c.articles.slice(0, 4).map(a => (
                <button
                  key={a.id}
                  onClick={() => onSelect?.(a.id)}
                  className="w-full text-right block hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-2 py-1"
                >
                  <div className="text-[10px] text-slate-500">{a.source}</div>
                  <div className="text-xs truncate">{a.title}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
