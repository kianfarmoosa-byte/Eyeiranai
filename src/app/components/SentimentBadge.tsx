import { useMemo } from "react";
import { Article } from "../data";
import { scoreArticle, sentimentColor, sentimentEmoji, sentimentLabelFa } from "../sentiment";

type Props = {
  article: Article;
  size?: "sm" | "md";
  showScore?: boolean;
};

export function SentimentBadge({ article, size = "sm", showScore = false }: Props) {
  const s = useMemo(() => scoreArticle(article), [article]);
  if (s.confidence < 0.15 && s.label === "neutral") return null;
  const cls = sentimentColor(s.label);
  const pad = size === "md" ? "px-2 py-1 text-xs" : "px-1.5 py-0.5 text-[10px]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${pad} ${cls}`}
      title={`احساس: ${sentimentLabelFa(s.label)} • امتیاز: ${s.score.toFixed(2)} (${s.positives}+ / ${s.negatives}-)`}
    >
      <span>{sentimentEmoji(s.label)}</span>
      <span>{sentimentLabelFa(s.label)}</span>
      {showScore && <span className="opacity-70">{s.score.toFixed(2)}</span>}
    </span>
  );
}

export function SentimentSummary({ articles }: { articles: Article[] }) {
  const agg = useMemo(() => {
    let pos = 0, neg = 0, neu = 0, avg = 0;
    for (const a of articles) {
      const s = scoreArticle(a);
      if (s.label === "positive") pos++;
      else if (s.label === "negative") neg++;
      else neu++;
      avg += s.score;
    }
    return { pos, neg, neu, avg: articles.length ? avg / articles.length : 0, total: articles.length };
  }, [articles]);

  if (agg.total === 0) return null;
  const pct = (n: number) => Math.round((n / agg.total) * 100);
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold">تحلیل احساسات</h4>
        <span className="text-xs text-slate-500">{agg.total} مقاله</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 mb-3">
        <div className="bg-emerald-500" style={{ width: `${pct(agg.pos)}%` }} title={`مثبت ${pct(agg.pos)}%`} />
        <div className="bg-slate-400" style={{ width: `${pct(agg.neu)}%` }} title={`خنثی ${pct(agg.neu)}%`} />
        <div className="bg-rose-500" style={{ width: `${pct(agg.neg)}%` }} title={`منفی ${pct(agg.neg)}%`} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <div className="text-emerald-600 dark:text-emerald-400 font-bold">🙂 {agg.pos}</div>
          <div className="text-slate-500">مثبت {pct(agg.pos)}%</div>
        </div>
        <div>
          <div className="text-slate-500 font-bold">😐 {agg.neu}</div>
          <div className="text-slate-500">خنثی {pct(agg.neu)}%</div>
        </div>
        <div>
          <div className="text-rose-600 dark:text-rose-400 font-bold">😟 {agg.neg}</div>
          <div className="text-slate-500">منفی {pct(agg.neg)}%</div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 text-center">
        امتیاز میانگین: <span className={`font-bold ${agg.avg > 0.1 ? "text-emerald-600 dark:text-emerald-400" : agg.avg < -0.1 ? "text-rose-600 dark:text-rose-400" : ""}`}>{agg.avg.toFixed(2)}</span>
      </div>
    </div>
  );
}
