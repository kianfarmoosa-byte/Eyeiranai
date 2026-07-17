import { useMemo, useState } from "react";
import { Radio, Grid3x3, BarChart3 } from "lucide-react";
import type { Article } from "../../data";
import { sourceBreakdown, type Period, type SourceRow } from "../../mediaAnalytics";
import { faNum, toFa } from "../mobile/utils/fa";

// ── Section ۳.۴ — تحلیل منابع (Source Breakdown) ──
// دو نما: (۱) میله‌ای حجم پوشش هر رسانه، (۲) ماتریس منبع×لحن — کدام رسانه با
// چه لحنی دربارهٔ موضوع می‌نویسد. ستون «احساسات خالص» به تنظیم روابط رسانه‌ای
// و تصمیم رپرتاژ کمک می‌کند.

function netClass(net: number) {
  if (net >= 20) return "text-emerald-600 dark:text-emerald-400";
  if (net <= -20) return "text-rose-600 dark:text-rose-400";
  return "text-slate-500";
}

function ToneBar({ r }: { r: SourceRow }) {
  const t = r.total || 1;
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800" title={`مثبت ${toFa(r.pos)} • خنثی ${toFa(r.neu)} • منفی ${toFa(r.neg)}`}>
      <div className="bg-emerald-500" style={{ width: `${(r.pos / t) * 100}%` }} />
      <div className="bg-slate-400" style={{ width: `${(r.neu / t) * 100}%` }} />
      <div className="bg-rose-500" style={{ width: `${(r.neg / t) * 100}%` }} />
    </div>
  );
}

export function SourceBreakdown({ articles, period }: { articles: Article[]; period: Period }) {
  const [mode, setMode] = useState<"bars" | "matrix">("bars");
  const rows = useMemo(() => sourceBreakdown(articles, period, Date.now(), 12), [articles, period]);
  const max = rows.length ? rows[0].total : 1;

  const seg = (active: boolean) =>
    `inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition ${active
      ? "bg-white dark:bg-slate-900 shadow-sm text-emerald-700 dark:text-emerald-300"
      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"}`;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Radio className="w-4 h-4 text-sky-500" />
        <h3 className="text-sm">تحلیل منابع</h3>
        <span className="text-xs text-slate-400">{faNum(rows.length)} رسانهٔ برتر</span>
        <div className="flex-1" />
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
          <button className={seg(mode === "bars")} onClick={() => setMode("bars")}><BarChart3 className="w-3.5 h-3.5" /> حجم</button>
          <button className={seg(mode === "matrix")} onClick={() => setMode("matrix")}><Grid3x3 className="w-3.5 h-3.5" /> منبع×لحن</button>
        </div>
      </div>

      {rows.length === 0 && <div className="text-xs text-slate-400 py-6 text-center">در این بازه داده‌ای نیست.</div>}

      {mode === "bars" && rows.length > 0 && (
        <div className="space-y-2.5">
          {rows.map(r => (
            <div key={r.name}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="inline-flex items-center gap-1.5 truncate"><span>{r.icon}</span><span className="truncate">{r.name}</span></span>
                <span className="tabular-nums opacity-70 shrink-0">{faNum(r.total)}</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-l from-sky-500 to-cyan-400 rounded-full" style={{ width: `${(r.total / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === "matrix" && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 text-[11px]">
                <th className="text-right font-normal pb-2">رسانه</th>
                <th className="text-center font-normal pb-2 w-16">تعداد</th>
                <th className="text-center font-normal pb-2 min-w-[120px]">توزیع لحن</th>
                <th className="text-center font-normal pb-2 w-20">احساسات خالص</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.name} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2 pl-2">
                    <span className="inline-flex items-center gap-1.5 truncate"><span>{r.icon}</span><span className="truncate max-w-[140px]">{r.name}</span></span>
                  </td>
                  <td className="py-2 text-center tabular-nums">{faNum(r.total)}</td>
                  <td className="py-2 px-2"><ToneBar r={r} /></td>
                  <td className={`py-2 text-center tabular-nums font-semibold ${netClass(r.net)}`}>{r.net > 0 ? "+" : ""}{toFa(r.net)}٪</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-3 mt-3 text-[10px] text-slate-400 justify-end">
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> مثبت</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" /> خنثی</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> منفی</span>
          </div>
        </div>
      )}
    </div>
  );
}
