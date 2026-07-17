import { useMemo, useState } from "react";
import { Trophy, ExternalLink, BookmarkPlus, Package, ArrowUpDown } from "lucide-react";
import type { Article } from "../../data";
import { topContent, articleMs, type Period } from "../../mediaAnalytics";
import { sentimentColor, sentimentEmoji, sentimentLabelFa } from "../../sentiment";
import { faNum, jalaali, timeAgoFa } from "../mobile/utils/fa";

// ── Section ۳.۸ — جدول مطالب برتر (Top Content) ──
// پربازتاب‌ترین/مهم‌ترین مطالب دوره با تیتر، منبع، زمان و لحن. دکمه‌های «افزودن به
// بسته» و «ذخیره در کلیپینگ» گردش کار «دیدن ← انتخاب ← گزارش/بسته» را کامل می‌کنند.

type SortKey = "score" | "recent";

export function TopContent({
  articles, period, onOpen, onAddToPack, onClip,
}: {
  articles: Article[];
  period: Period;
  onOpen?: (id: string) => void;
  onAddToPack?: (a: Article) => void;
  onClip?: (a: Article) => void;
}) {
  const [sort, setSort] = useState<SortKey>("score");
  const items = useMemo(() => {
    const list = topContent(articles, period, Date.now(), 15);
    if (sort === "recent") return [...list].sort((a, b) => articleMs(b.article) - articleMs(a.article));
    return list;
  }, [articles, period, sort]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Trophy className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm">مطالب برتر دوره</h3>
        <div className="flex-1" />
        <button
          onClick={() => setSort(s => (s === "score" ? "recent" : "score"))}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          {sort === "score" ? "بر پایهٔ نفوذ" : "جدیدترین"}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-xs text-slate-400 py-6 text-center">مطلبی در این بازه نیست.</div>
      ) : (
        <div className="space-y-1.5">
          {items.map(({ article: a, score, sentiment }, i) => (
            <div
              key={a.id}
              className="group flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
            >
              <span className="w-6 text-center text-sm tabular-nums text-slate-400 shrink-0">{faNum(i + 1)}</span>
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => onOpen?.(a.id)}
                  className="block text-right text-sm truncate hover:text-emerald-700 dark:hover:text-emerald-300 w-full"
                  title={a.title}
                >
                  {a.title}
                </button>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                  <span className="inline-flex items-center gap-1"><span>{a.sourceIcon || "📰"}</span>{a.source}</span>
                  <span>•</span>
                  <span title={jalaali(new Date(articleMs(a) || Date.now()), { dateStyle: "long" })}>{timeAgoFa(articleMs(a) || Date.now())}</span>
                  <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 ${sentimentColor(sentiment.label)}`}>
                    {sentimentEmoji(sentiment.label)} {sentimentLabelFa(sentiment.label)}
                  </span>
                </div>
              </div>
              <span className="text-[11px] tabular-nums text-slate-400 shrink-0 w-10 text-center" title="امتیاز نفوذ (تخمینی)">{faNum(score)}</span>
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                {onClip && (
                  <button onClick={() => onClip(a)} title="ذخیره در کلیپینگ" className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500">
                    <BookmarkPlus className="w-4 h-4" />
                  </button>
                )}
                {onAddToPack && (
                  <button onClick={() => onAddToPack(a)} title="افزودن به بستهٔ خبری" className="p-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-600">
                    <Package className="w-4 h-4" />
                  </button>
                )}
                {a.link && (
                  <a href={a.link} target="_blank" rel="noreferrer" title="باز کردن منبع" className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
