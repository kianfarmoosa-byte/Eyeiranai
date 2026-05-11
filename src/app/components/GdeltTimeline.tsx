import { useEffect, useMemo, useState } from "react";
import { Loader2, TrendingUp, Activity } from "lucide-react";
import { gdeltTimeline, type GdeltDocQuery } from "../gdelt";

type Props = {
  query: GdeltDocQuery;
  enabled: boolean;
};

type Point = { date: string; value: number };

function extractPoints(raw: any): Point[] {
  // GDELT timeline JSON returns { timeline: [{ data: [{ date, value }, ...] }] }
  const tl = raw?.timeline;
  if (!Array.isArray(tl) || tl.length === 0) return [];
  const data = tl[0]?.data;
  if (!Array.isArray(data)) return [];
  return data
    .map((d: any) => ({ date: String(d.date || ""), value: Number(d.value) || 0 }))
    .filter((p: Point) => p.date);
}

export function GdeltTimeline({ query, enabled }: Props) {
  const [mode, setMode] = useState<"TimelineVol" | "TimelineTone">("TimelineVol");
  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r: any = await gdeltTimeline({ ...query, mode });
        if (cancelled) return;
        setPoints(extractPoints(r?.raw));
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, mode, query.q, query.country, query.theme, query.lang, query.timespan]);

  const { path, area, peak, last, min, max, anomalies, mean, stddev } = useMemo(() => {
    if (points.length === 0) return { path: "", area: "", peak: 0, last: 0, min: 0, max: 0, anomalies: [] as Array<{x:number;y:number;v:number;date:string}>, mean: 0, stddev: 0 };
    const W = 600, H = 80, P = 4;
    const vals = points.map(p => p.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    const stddev = Math.sqrt(variance);
    const stepX = (W - P * 2) / Math.max(1, points.length - 1);
    const ys = vals.map(v => H - P - ((v - min) / range) * (H - P * 2));
    const xs = points.map((_, i) => P + i * stepX);
    const path = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");
    const area = `${path} L ${xs[xs.length - 1].toFixed(1)} ${H - P} L ${xs[0].toFixed(1)} ${H - P} Z`;
    const threshold = mean + 2 * stddev;
    const anomalies = points
      .map((p, i) => ({ x: xs[i], y: ys[i], v: p.value, date: p.date }))
      .filter(a => a.v >= threshold && stddev > 0);
    return { path, area, peak: max, last: vals[vals.length - 1], min, max, anomalies, mean, stddev };
  }, [points]);

  if (!enabled) return null;

  const isTone = mode === "TimelineTone";
  const stroke = isTone ? "#8b5cf6" : "#0ea5e9";
  const fill = isTone ? "rgba(139,92,246,0.12)" : "rgba(14,165,233,0.12)";

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-2 bg-slate-50/60 dark:bg-slate-900/40">
      <div className="flex items-center gap-2 mb-1">
        <button onClick={() => setMode("TimelineVol")}
          className={`text-[11px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
            mode === "TimelineVol"
              ? "bg-sky-500 text-white border-sky-500"
              : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
          }`}>
          <Activity className="w-3 h-3" /> حجم
        </button>
        <button onClick={() => setMode("TimelineTone")}
          className={`text-[11px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
            mode === "TimelineTone"
              ? "bg-violet-500 text-white border-violet-500"
              : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
          }`}>
          <TrendingUp className="w-3 h-3" /> لحن
        </button>
        <span className="text-[11px] text-slate-500 mr-auto tabular-nums">
          {loading && <Loader2 className="w-3 h-3 animate-spin inline ml-1" />}
          {points.length > 0 && !loading && (
            <>
              {isTone ? "میانگین" : "اوج"}: {(isTone ? last : peak).toFixed(isTone ? 2 : 0)}
              <span className="opacity-50"> · </span>
              بازه {min.toFixed(isTone ? 1 : 0)} → {max.toFixed(isTone ? 1 : 0)}
            </>
          )}
        </span>
      </div>
      {error && <div className="text-[11px] text-rose-500">{error}</div>}
      {!error && points.length > 0 && (<>
        <svg viewBox="0 0 600 80" className="w-full h-[60px]" preserveAspectRatio="none">
          {isTone && (
            <line x1="0" x2="600" y1="40" y2="40" stroke="currentColor" strokeWidth="0.5" className="text-slate-300 dark:text-slate-700" strokeDasharray="2 2" />
          )}
          <path d={area} fill={fill} />
          <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
          {!isTone && anomalies.map((a, i) => (
            <g key={i}>
              <circle cx={a.x} cy={a.y} r="3.5" fill="#ef4444" stroke="#fff" strokeWidth="1">
                <title>{`اوج ناهنجار: ${a.v.toFixed(0)} در ${a.date}`}</title>
              </circle>
            </g>
          ))}
        </svg>
        {!isTone && anomalies.length > 0 && (
          <div className="text-[10px] text-rose-500 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
            {anomalies.length.toLocaleString("fa-IR")} اوج ناهنجار (≥ μ+2σ، یعنی {(mean + 2 * stddev).toFixed(0)})
          </div>
        )}
      </>)}
      {!error && !loading && points.length === 0 && (
        <div className="text-[11px] text-slate-400 py-2">داده‌ای برای نمایش نمودار نیست.</div>
      )}
    </div>
  );
}
