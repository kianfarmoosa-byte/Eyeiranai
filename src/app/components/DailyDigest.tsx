import { useMemo } from "react";
import { Sunrise, Sparkles, ChevronLeft, Star, Clock, X } from "lucide-react";
import type { Article } from "../data";

type Props = {
  articles: Article[];
  onSelect: (id: string) => void;
  onClose: () => void;
};

function parseDate(s: string): number {
  const t = new Date(s).getTime();
  return isNaN(t) ? 0 : t;
}

const STOP = new Set("و در از به با که این آن یک را برای تا هم می است شد بود کرد گفت بر یا اما هر اگر همان همه نیز چه چون".split(" "));

function tokenize(t: string): string[] {
  return t.toLowerCase().replace(/[\u200c]/g, "").replace(/[^\u0600-\u06FFa-z0-9\s]/gi, " ").split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
}

export function DailyDigest({ articles, onSelect, onClose }: Props) {
  const digest = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const fresh = articles.filter(a => now - parseDate(a.date) < day * 2);
    const pool = fresh.length > 5 ? fresh : articles.slice(0, 200);

    // doc frequencies for TF-IDF importance
    const df = new Map<string, number>();
    const docs = pool.map(a => {
      const toks = tokenize(`${a.title} ${a.preview}`);
      const set = new Set(toks);
      for (const t of set) df.set(t, (df.get(t) || 0) + 1);
      return { a, toks };
    });
    const N = Math.max(1, docs.length);

    // score articles
    const scored = docs.map(({ a, toks }) => {
      const tf = new Map<string, number>();
      for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
      let s = 0;
      for (const [t, f] of tf) s += f * Math.log(N / (df.get(t) || 1));
      const recency = Math.max(0, 1 - (now - parseDate(a.date)) / (day * 3));
      const star = a.starred ? 1.5 : 1;
      return { a, score: s * (0.5 + recency) * star };
    }).sort((x, y) => y.score - x.score);

    const topPicks = scored.slice(0, 6).map(x => x.a);

    // group by source for breadth
    const bySource = new Map<string, Article[]>();
    for (const { a } of scored) {
      if (!bySource.has(a.source)) bySource.set(a.source, []);
      const arr = bySource.get(a.source)!;
      if (arr.length < 2) arr.push(a);
    }
    const fromAround = [...bySource.entries()].slice(0, 6);

    // trending keywords
    const wordScore = new Map<string, number>();
    for (const { toks } of docs) {
      const seen = new Set<string>();
      for (const t of toks) {
        if (seen.has(t)) continue;
        seen.add(t);
        wordScore.set(t, (wordScore.get(t) || 0) + Math.log(N / (df.get(t) || 1)));
      }
    }
    const trending = [...wordScore.entries()].filter(([w]) => (df.get(w) || 0) >= 3).sort((a, b) => b[1] - a[1]).slice(0, 12);

    return { topPicks, fromAround, trending, totalFresh: fresh.length };
  }, [articles]);

  const today = new Date().toLocaleDateString("fa-IR", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-amber-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/40">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-white shadow-lg">
            <Sunrise className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg">گزارش روزانه</h2>
            <div className="text-xs text-slate-500">{today} · {digest.totalFresh.toLocaleString("fa-IR")} مقالهٔ تازه</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {digest.trending.length > 0 && (
          <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur rounded-2xl p-4 border border-slate-200 dark:border-slate-800 mb-5">
            <div className="flex items-center gap-2 mb-2 text-sm"><Sparkles className="w-4 h-4 text-amber-500" /> داغ‌ترین کلمات</div>
            <div className="flex flex-wrap gap-1.5">
              {digest.trending.map(([w, s], i) => (
                <span key={w} className="px-2.5 py-1 rounded-full bg-gradient-to-l from-amber-100 to-rose-100 dark:from-amber-900/40 dark:to-rose-900/40 text-amber-900 dark:text-amber-100 text-[11px]">
                  {w}
                  <span className="opacity-50 mr-1">{Math.round(s).toLocaleString("fa-IR")}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <h3 className="text-sm mb-3 text-slate-700 dark:text-slate-300 px-1">برترین‌های امروز</h3>
        <div className="space-y-2 mb-6">
          {digest.topPicks.map((a, i) => (
            <button key={a.id} onClick={() => onSelect(a.id)}
              className="w-full text-right bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition flex gap-3">
              <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xs">{(i + 1).toLocaleString("fa-IR")}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-500 mb-1 flex items-center gap-2">
                  <span>{a.source}</span><span>·</span><Clock className="w-3 h-3" /><span>{a.readTime}</span>
                  {a.starred && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                </div>
                <div className="line-clamp-2">{a.title}</div>
                {a.preview && <div className="text-xs text-slate-500 line-clamp-2 mt-1">{a.preview}</div>}
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400 self-center" />
            </button>
          ))}
        </div>

        <h3 className="text-sm mb-3 text-slate-700 dark:text-slate-300 px-1">از منابع مختلف</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {digest.fromAround.map(([source, arr]) => (
            <div key={source} className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 mb-2">{source}</div>
              <div className="space-y-1.5">
                {arr.map(a => (
                  <button key={a.id} onClick={() => onSelect(a.id)}
                    className="w-full text-right text-sm hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2">
                    {a.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
