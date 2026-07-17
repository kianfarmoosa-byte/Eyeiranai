import { useMemo } from "react";
import { Article } from "../data";
import { entitiesForArticle, entityKindColor, entityKindLabel, type Entity } from "../entities";

type Props = {
  articles: Article[];
  max?: number;
  onClickEntity?: (text: string) => void;
};

export function TrendingEntities({ articles, max = 20, onClickEntity }: Props) {
  const top = useMemo(() => {
    const map = new Map<string, Entity>();
    for (const a of articles) {
      for (const e of entitiesForArticle(a)) {
        const key = `${e.kind}:${e.text}`;
        const cur = map.get(key);
        if (cur) cur.count += e.count;
        else map.set(key, { ...e });
      }
    }
    return Array.from(map.values())
      .filter(e => e.kind !== "number")
      .sort((a, b) => b.count - a.count)
      .slice(0, max);
  }, [articles, max]);

  if (!top.length) return null;
  const maxCount = top[0].count;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold">موجودیت‌های پرتکرار</h4>
        <span className="text-xs text-slate-500">{articles.length} مقاله</span>
      </div>
      <div className="space-y-1.5">
        {top.map((e, i) => (
          <button
            key={`${e.kind}-${e.text}-${i}`}
            onClick={() => onClickEntity?.(e.text)}
            className="w-full text-right group"
            title={`${entityKindLabel(e.kind)}`}
          >
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className={`px-1.5 py-0.5 rounded-full ${entityKindColor(e.kind)}`}>{e.text}</span>
              <span className="tabular-nums opacity-60">{e.count}</span>
            </div>
            <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-l from-emerald-500 to-violet-400 group-hover:opacity-80"
                style={{ width: `${(e.count / maxCount) * 100}%` }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
