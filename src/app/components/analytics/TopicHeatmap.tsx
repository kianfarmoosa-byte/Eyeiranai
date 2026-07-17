import { useMemo } from "react";
import { Grid3x3 } from "lucide-react";
import type { Article } from "../../data";
import { topicHeatmap, type Period } from "../../mediaAnalytics";
import { faNum, jalaali, toFa } from "../mobile/utils/fa";

// ── Section ۳.۵ — نقشهٔ حرارتی موضوعی (Topic Heatmap) ──
// ماتریس موضوع×زمان: کدام زیرموضوع‌ها در کدام روزها داغ بوده‌اند. موضوع‌ها از
// برچسب/دستهٔ مطالب استخراج و بر اساس حجم روزانه رنگ‌آمیزی می‌شوند — «دستور کار
// رسانه‌ها» را که امروز دستی در اکسل درمی‌آورند، خودکار می‌کند.

function cellColor(n: number, max: number) {
  if (n === 0) return "bg-slate-100 dark:bg-slate-800/60";
  const lvl = Math.min(4, Math.ceil((n / max) * 4));
  return ["", "bg-emerald-200 dark:bg-emerald-900/70", "bg-emerald-400 dark:bg-emerald-700", "bg-emerald-500 dark:bg-emerald-500", "bg-emerald-700 dark:bg-emerald-300"][lvl];
}

export function TopicHeatmap({ articles, period }: { articles: Article[]; period: Period }) {
  const { topics, days, grid, max } = useMemo(() => topicHeatmap(articles, period, Date.now(), 8), [articles, period]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Grid3x3 className="w-4 h-4 text-emerald-500" />
        <h3 className="text-sm">نقشهٔ حرارتی موضوعی</h3>
        <span className="text-xs text-slate-400">{faNum(topics.length)} موضوع × {faNum(days.length)} روز</span>
      </div>

      {topics.length === 0 ? (
        <div className="text-xs text-slate-400 py-6 text-center">موضوعی برای نمایش نیست.</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* header: day labels */}
            <div className="flex items-center gap-[3px] mb-1 pr-28">
              {days.map(d => (
                <div key={d.key} className="w-4 text-[8px] text-slate-400 text-center rotate-0" title={jalaali(d.date, { month: "long", day: "numeric" })}>
                  {toFa(d.date.getDate())}
                </div>
              ))}
            </div>
            {/* rows */}
            <div className="space-y-[3px]">
              {topics.map(topic => (
                <div key={topic} className="flex items-center gap-[3px]">
                  <div className="w-28 text-[11px] truncate text-slate-600 dark:text-slate-300 shrink-0" title={topic}>{topic}</div>
                  {days.map(d => {
                    const n = grid.get(`${topic}|${d.key}`) || 0;
                    return (
                      <div
                        key={d.key}
                        className={`w-4 h-4 rounded-[3px] ${cellColor(n, max)}`}
                        title={`${topic} • ${jalaali(d.date, { month: "long", day: "numeric" })} • ${faNum(n)} مطلب`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-3 justify-end">
            کم
            {[0, 1, 2, 3, 4].map(l => (
              <div key={l} className={`w-3 h-3 rounded-[3px] ${["bg-slate-100 dark:bg-slate-800/60","bg-emerald-200 dark:bg-emerald-900/70","bg-emerald-400 dark:bg-emerald-700","bg-emerald-500","bg-emerald-700"][l]}`} />
            ))}
            زیاد
          </div>
        </div>
      )}
    </div>
  );
}
