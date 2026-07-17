import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { gdeltTimeline, GDELT_PRESET_THEMES } from "../gdelt";
import { toFa } from "./mobile/utils/fa";

type Props = {
  country?: string;
  lang?: string;
  timespan: string;
  onPickTheme: (code: string) => void;
};

type ThemeStat = {
  code: string;
  label: string;
  icon: string;
  total: number;
  peak: number;
  trend: number;
  series: number[];
};

function extractSeries(raw: any): number[] {
  const tl = raw?.timeline;
  if (!Array.isArray(tl) || tl.length === 0) return [];
  const data = tl[0]?.data;
  if (!Array.isArray(data)) return [];
  return data.map((d: any) => Number(d.value) || 0);
}

function computeTrend(series: number[]): number {
  if (series.length < 4) return 0;
  const half = Math.floor(series.length / 2);
  const first = series.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const second = series.slice(-half).reduce((a, b) => a + b, 0) / half;
  if (first === 0) return second > 0 ? 1 : 0;
  return (second - first) / first;
}

function sparklinePath(series: number[], W = 80, H = 18): string {
  if (series.length === 0) return "";
  const max = Math.max(...series, 1);
  const stepX = W / Math.max(1, series.length - 1);
  return series
    .map((v, i) => {
      const x = i * stepX;
      const y = H - (v / max) * H;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function GdeltThemeExplorer({ country, lang, timespan, onPickTheme }: Props) {
  const [stats, setStats] = useState<ThemeStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const themes = GDELT_PRESET_THEMES;
      setProgress({ done: 0, total: themes.length });
      const results: ThemeStat[] = [];
      let done = 0;
      // Run in parallel with concurrency cap to avoid spamming the server cache.
      const CONCURRENCY = 4;
      let cursor = 0;
      const next = async (): Promise<void> => {
        if (cancelled) return;
        const i = cursor++;
        if (i >= themes.length) return;
        const t = themes[i];
        try {
          const r: any = await gdeltTimeline({
            q: "",
            theme: t.code,
            country,
            lang,
            timespan,
            mode: "TimelineVol",
          });
          if (cancelled) return;
          const series = extractSeries(r?.raw);
          const total = series.reduce((a, b) => a + b, 0);
          const peak = series.length ? Math.max(...series) : 0;
          const trend = computeTrend(series);
          results.push({ code: t.code, label: t.label, icon: t.icon, total, peak, trend, series });
        } catch (e) {
          if (!cancelled) results.push({ code: t.code, label: t.label, icon: t.icon, total: 0, peak: 0, trend: 0, series: [] });
        } finally {
          done++;
          if (!cancelled) setProgress({ done, total: themes.length });
        }
        return next();
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, next));
      if (!cancelled) {
        setStats([...results].sort((a, b) => b.total - a.total));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [country, lang, timespan]);

  const maxTotal = useMemo(() => Math.max(1, ...stats.map(s => s.total)), [stats]);

  return (
    <div className="flex-1 flex flex-col min-h-0" dir="rtl">
      <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center gap-2 text-xs">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <span className="text-slate-600 dark:text-slate-300">رتبه‌بندی موضوعات بر اساس حجم پوشش — {timespan}</span>
        {country && <span className="text-slate-400">· کشور {country}</span>}
        {lang && <span className="text-slate-400">· زبان {lang}</span>}
        <div className="flex-1" />
        {loading && (
          <span className="flex items-center gap-1 text-slate-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            {toFa(progress.done)}/{toFa(progress.total)}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!loading && stats.length === 0 && (
          <div className="p-12 text-center text-slate-500 text-sm">داده‌ای یافت نشد.</div>
        )}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
          {stats.map((s, idx) => {
            const widthPct = (s.total / maxTotal) * 100;
            const trendPct = Math.round(s.trend * 100);
            const isUp = trendPct > 5;
            const isDown = trendPct < -5;
            return (
              <button key={s.code} onClick={() => onPickTheme(s.code)}
                className="w-full text-right px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-900/50 group">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] tabular-nums text-slate-400 w-5">{(idx + 1).toLocaleString("fa-IR")}</span>
                  <span className="text-base">{s.icon}</span>
                  <span className="text-sm flex-1 truncate group-hover:text-violet-600 dark:group-hover:text-violet-400">{s.label}</span>
                  <svg viewBox="0 0 80 18" className="w-20 h-[18px] shrink-0">
                    <path d={sparklinePath(s.series)} fill="none" stroke="#8b5cf6" strokeWidth="1" strokeLinejoin="round" />
                  </svg>
                  <span className={`text-[11px] tabular-nums w-12 flex items-center justify-end gap-0.5 ${
                    isUp ? "text-emerald-600 dark:text-emerald-400" :
                    isDown ? "text-rose-600 dark:text-rose-400" : "text-slate-400"
                  }`}>
                    {isUp && <TrendingUp className="w-3 h-3" />}
                    {isDown && <TrendingDown className="w-3 h-3" />}
                    {trendPct > 0 ? "+" : ""}{toFa(trendPct)}٪
                  </span>
                  <span className="text-[11px] tabular-nums text-slate-500 w-14 text-left">{toFa(s.total.toFixed(0))}</span>
                </div>
                <div className="mt-1 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-l from-violet-500 to-fuchsia-500" style={{ width: `${widthPct}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
