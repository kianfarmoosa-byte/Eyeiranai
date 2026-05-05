import { useMemo } from "react";
import type { Article } from "../data";
import { BUILT_IN_TOPICS, scoreArticleForTopic, topicColorClasses, loadCustomTopics } from "../topics";
import { Target } from "lucide-react";

type Props = { articles: Article[] };

export function TopicDistribution({ articles }: Props) {
  const data = useMemo(() => {
    const all = [...BUILT_IN_TOPICS, ...loadCustomTopics()];
    const rows = all.map(t => {
      let strong = 0, medium = 0, weak = 0;
      for (const a of articles) {
        const s = scoreArticleForTopic(a, t);
        if (s.level === "strong") strong++;
        else if (s.level === "medium") medium++;
        else if (s.level === "weak") weak++;
      }
      return { topic: t, strong, medium, weak, total: strong + medium + weak };
    });
    rows.sort((a, b) => b.total - a.total);
    return rows;
  }, [articles]);

  const max = Math.max(1, ...data.map(d => d.total));

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-indigo-500" />
        <h3 className="text-sm font-medium">توزیع موضوعی</h3>
        <span className="text-xs text-slate-500 mr-auto">{articles.length} خبر</span>
      </div>
      <div className="space-y-2">
        {data.map(row => {
          const cls = topicColorClasses(row.topic.color);
          const w = (row.total / max) * 100;
          const sW = (row.strong / max) * 100;
          const mW = (row.medium / max) * 100;
          const wW = (row.weak / max) * 100;
          return (
            <div key={row.topic.id} className="flex items-center gap-3 text-xs">
              <div className="w-24 shrink-0 flex items-center gap-1.5">
                <span>{row.topic.icon}</span>
                <span className="truncate">{row.topic.name}</span>
              </div>
              <div className="flex-1 min-w-0 h-5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex" title={`قوی: ${row.strong} • متوسط: ${row.medium} • ضعیف: ${row.weak}`}>
                <div className={`${cls.bar} h-full transition-all duration-500`} style={{ width: `${sW}%`, opacity: 1 }} />
                <div className={`${cls.bar} h-full transition-all duration-500`} style={{ width: `${mW}%`, opacity: 0.6 }} />
                <div className={`${cls.bar} h-full transition-all duration-500`} style={{ width: `${wW}%`, opacity: 0.3 }} />
                <div className="flex-1" />
              </div>
              <div className="w-12 shrink-0 text-left tabular-nums text-slate-600 dark:text-slate-400">
                {row.total}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-slate-400" /> قوی</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-slate-400 opacity-60" /> متوسط</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-slate-400 opacity-30" /> ضعیف</span>
      </div>
    </div>
  );
}
