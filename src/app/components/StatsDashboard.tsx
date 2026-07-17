import { useEffect, useMemo } from "react";
import { BarChart3, BookOpen, Clock, Globe2, Star, Tag, TrendingUp, Calendar, Bookmark, Activity } from "lucide-react";
import type { Article } from "../data";
import { SentimentSummary } from "./SentimentBadge";
import { TrendingEntities } from "./TrendingEntities";
import { DuplicateClusters } from "./DuplicateClusters";
import { TopicDistribution } from "./TopicDistribution";
import { toFa } from "./mobile/utils/fa";

type Props = {
  articles: Article[];
  savedIds: Set<string>;
  onClose: () => void;
};

type ReadEvent = { id: string; ts: number };

function loadReadLog(): ReadEvent[] {
  try { return JSON.parse(localStorage.getItem("read.log") || "[]"); } catch { return []; }
}

function persianMonthName(m: number) {
  return ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"][m] || "";
}

export function StatsDashboard({ articles, savedIds, onClose }: Props) {
  // record a snapshot of reads when this view opens
  useEffect(() => {
    try {
      const log = loadReadLog();
      const known = new Set(log.map(e => e.id));
      const now = Date.now();
      let added = 0;
      for (const a of articles) {
        if (a.read && !known.has(a.id)) { log.push({ id: a.id, ts: now }); added++; }
      }
      if (added) localStorage.setItem("read.log", JSON.stringify(log.slice(-5000)));
    } catch {}
  }, [articles]);

  const readLog = loadReadLog();

  const stats = useMemo(() => {
    const total = articles.length;
    const read = articles.filter(a => a.read).length;
    const unread = total - read;
    const starred = articles.filter(a => a.starred).length;
    const saved = savedIds.size;
    const totalMinutes = articles.filter(a => a.read).reduce((s, a) => {
      const m = parseInt((a.readTime || "0").replace(/\D/g, ""), 10) || 3;
      return s + m;
    }, 0);

    const bySource = new Map<string, number>();
    for (const a of articles) bySource.set(a.source, (bySource.get(a.source) || 0) + 1);
    const topSources = [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    const tagCount = new Map<string, number>();
    for (const a of articles) for (const t of a.tags || []) tagCount.set(t, (tagCount.get(t) || 0) + 1);
    const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

    // 365-day heatmap
    const dayMap = new Map<string, number>();
    for (const e of readLog) {
      const d = new Date(e.ts);
      const k = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      dayMap.set(k, (dayMap.get(k) || 0) + 1);
    }
    const today = new Date();
    const days: { date: Date; count: number }[] = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const k = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      days.push({ date: d, count: dayMap.get(k) || 0 });
    }
    const maxDay = Math.max(1, ...days.map(d => d.count));

    // streak
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].count > 0) streak++;
      else break;
    }
    const longestStreak = (() => {
      let best = 0, cur = 0;
      for (const d of days) { if (d.count > 0) { cur++; best = Math.max(best, cur); } else cur = 0; }
      return best;
    })();

    // hour-of-day
    const hours = new Array(24).fill(0);
    for (const e of readLog) hours[new Date(e.ts).getHours()]++;
    const maxHour = Math.max(1, ...hours);

    return { total, read, unread, starred, saved, totalMinutes, topSources, topTags, days, maxDay, streak, longestStreak, hours, maxHour };
  }, [articles, savedIds, readLog]);

  const heatColor = (n: number) => {
    if (n === 0) return "bg-slate-100 dark:bg-slate-800";
    const lvl = Math.min(4, Math.ceil((n / stats.maxDay) * 4));
    return ["", "bg-emerald-200 dark:bg-emerald-900", "bg-emerald-400 dark:bg-emerald-700", "bg-emerald-500 dark:bg-emerald-500", "bg-emerald-700 dark:bg-emerald-300"][lvl];
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-6 h-6 text-emerald-600" />
          <h2 className="text-lg">داشبورد آمار شخصی</h2>
          <div className="flex-1" />
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">بستن</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { icon: BookOpen, label: "خوانده‌شده", value: stats.read.toLocaleString("fa-IR"), tint: "from-emerald-500 to-cyan-500" },
            { icon: Clock, label: "دقیقهٔ مطالعه", value: stats.totalMinutes.toLocaleString("fa-IR"), tint: "from-violet-500 to-fuchsia-500" },
            { icon: Star, label: "نشان‌شده", value: stats.starred.toLocaleString("fa-IR"), tint: "from-amber-500 to-orange-500" },
            { icon: Bookmark, label: "ذخیره‌شده", value: stats.saved.toLocaleString("fa-IR"), tint: "from-emerald-500 to-teal-500" },
          ].map((c, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${c.tint} flex items-center justify-center text-white mb-2`}>
                <c.icon className="w-4 h-4" />
              </div>
              <div className="text-xl tabular-nums">{c.value}</div>
              <div className="text-xs text-slate-500">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-1 text-sm">
              <TrendingUp className="w-4 h-4 text-rose-500" /> روند فعلی
            </div>
            <div className="text-2xl tabular-nums">{stats.streak.toLocaleString("fa-IR")} <span className="text-xs opacity-60">روز پیاپی</span></div>
            <div className="text-xs text-slate-500 mt-1">رکورد: {stats.longestStreak.toLocaleString("fa-IR")} روز</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-1 text-sm">
              <Activity className="w-4 h-4 text-emerald-500" /> نرخ خواندن
            </div>
            <div className="text-2xl tabular-nums">{stats.total ? Math.round((stats.read / stats.total) * 100) : 0}<span className="text-xs opacity-60">٪</span></div>
            <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${stats.total ? (stats.read / stats.total) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-1 text-sm">
              <Globe2 className="w-4 h-4 text-emerald-500" /> منابع منحصربه‌فرد
            </div>
            <div className="text-2xl tabular-nums">{stats.topSources.length === 0 ? 0 : new Set(articles.map(a => a.source)).size.toLocaleString("fa-IR")}</div>
            <div className="text-xs text-slate-500 mt-1">طیف بسیار مفید است.</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 mb-6">
          <div className="flex items-center gap-2 mb-3 text-sm">
            <Calendar className="w-4 h-4 text-emerald-500" /> فعالیت سال گذشته
          </div>
          <div className="overflow-x-auto">
            <div className="grid grid-rows-7 grid-flow-col gap-[3px]" style={{ direction: "ltr" }}>
              {stats.days.map((d, i) => (
                <div
                  key={i}
                  title={`${d.date.toLocaleDateString("fa-IR")} • ${d.count} مقاله`}
                  className={`w-3 h-3 rounded-[3px] ${heatColor(d.count)}`}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-2 justify-end">
            کم
            {[0, 1, 2, 3, 4].map(l => (
              <div key={l} className={`w-3 h-3 rounded-[3px] ${["bg-slate-100 dark:bg-slate-800","bg-emerald-200 dark:bg-emerald-900","bg-emerald-400 dark:bg-emerald-700","bg-emerald-500","bg-emerald-700"][l]}`} />
            ))}
            زیاد
          </div>
        </div>

        <div className="mb-6">
          <SentimentSummary articles={articles} />
        </div>

        <div className="mb-6">
          <TopicDistribution articles={articles} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
          <TrendingEntities articles={articles} />
          <DuplicateClusters articles={articles} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-3 text-sm"><Globe2 className="w-4 h-4 text-emerald-500" /> منابع برتر</div>
            <div className="space-y-2">
              {stats.topSources.length === 0 && <div className="text-xs text-slate-500">هنوز داده‌ای نیست</div>}
              {stats.topSources.map(([name, n]) => (
                <div key={name}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="truncate">{name}</span>
                    <span className="tabular-nums opacity-70">{n.toLocaleString("fa-IR")}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-l from-emerald-500 to-cyan-400" style={{ width: `${(n / stats.topSources[0][1]) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-3 text-sm"><Tag className="w-4 h-4 text-violet-500" /> برچسب‌های پرتکرار</div>
            <div className="flex flex-wrap gap-1.5">
              {stats.topTags.length === 0 && <div className="text-xs text-slate-500">هنوز برچسبی نیست</div>}
              {stats.topTags.map(([t, n]) => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-200 text-[11px]">
                  {t} <span className="opacity-60 tabular-nums">{n.toLocaleString("fa-IR")}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-3 text-sm"><Clock className="w-4 h-4 text-amber-500" /> ساعات اوج مطالعه</div>
          <div className="flex items-end gap-[3px] h-24" style={{ direction: "ltr" }}>
            {stats.hours.map((h, i) => (
              <div key={i} className="flex-1 bg-gradient-to-t from-amber-500 to-orange-300 dark:from-amber-400 dark:to-orange-200 rounded-t"
                style={{ height: `${(h / stats.maxHour) * 100}%`, minHeight: 2 }}
                title={`${toFa(i)}:۰۰ — ${toFa(h)} مقاله`} />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-1" style={{ direction: "ltr" }}>
            <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
          </div>
        </div>
      </div>
    </div>
  );
}
