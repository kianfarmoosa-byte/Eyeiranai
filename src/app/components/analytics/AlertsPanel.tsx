import { useMemo, useState } from "react";
import { Bell, TrendingUp, Plus, Trash2, AlertOctagon } from "lucide-react";
import type { Article } from "../../data";
import { detectAnomalies, splitByPeriod, type Period } from "../../mediaAnalytics";
import { faNum, toFa } from "../mobile/utils/fa";

// ── Section ۳.۹ — پنل هشدارها و ناهنجاری‌ها (Alerts & Anomalies) ──
// (۱) هشدار کلیدواژه: کاربر کلیدواژه تعریف می‌کند؛ اگر در دورهٔ جاری مطلبی مطابق
//     باشد، با سطح اهمیت رنگی فعال می‌شود. (۲) تشخیص ناهنجاری خودکار: موضوعاتی که
//     حجم پوشش‌شان چند برابر میانگین دورهٔ قبل شده — حتی بدون تعریف قبلی.

const LS_KEY = "analytics.watch";
type Watch = { id: string; kw: string; level: "high" | "med" | "low" };

function loadWatch(): Watch[] { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; } }
function persist(w: Watch[]) { try { localStorage.setItem(LS_KEY, JSON.stringify(w)); } catch { /* ignore */ } }

const LEVELS: Record<Watch["level"], { label: string; cls: string; dot: string }> = {
  high: { label: "بحرانی", cls: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900", dot: "bg-rose-500" },
  med:  { label: "مهم",    cls: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900", dot: "bg-amber-500" },
  low:  { label: "عادی",   cls: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900", dot: "bg-sky-500" },
};

export function AlertsPanel({ articles, period, onSelectTopic }: { articles: Article[]; period: Period; onSelectTopic?: (t: string) => void }) {
  const [watches, setWatches] = useState<Watch[]>(loadWatch);
  const [kw, setKw] = useState("");
  const [level, setLevel] = useState<Watch["level"]>("med");

  const anomalies = useMemo(() => detectAnomalies(articles, period), [articles, period]);

  const fired = useMemo(() => {
    const { current } = splitByPeriod(articles, period);
    return watches.map(w => {
      const needle = w.kw.trim().toLowerCase();
      let count = 0;
      if (needle) for (const a of current) {
        const hay = `${a.title} ${a.preview || ""} ${(a.tags || []).join(" ")}`.toLowerCase();
        if (hay.includes(needle)) count++;
      }
      return { ...w, count };
    });
  }, [watches, articles, period]);

  const add = () => {
    if (!kw.trim()) return;
    const next = [...watches, { id: `${Date.now()}`, kw: kw.trim(), level }];
    setWatches(next); persist(next); setKw("");
  };
  const remove = (id: string) => { const next = watches.filter(w => w.id !== id); setWatches(next); persist(next); };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="w-4 h-4 text-rose-500" />
        <h3 className="text-sm">هشدارها و ناهنجاری‌ها</h3>
      </div>

      {/* keyword watches */}
      <div className="mb-4">
        <div className="text-[11px] text-slate-400 mb-2">هشدارهای کلیدواژه</div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <input
            value={kw}
            onChange={e => setKw(e.target.value)}
            onKeyDown={e => e.key === "Enter" && add()}
            placeholder="کلیدواژهٔ رصد…"
            className="flex-1 min-w-[140px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <select value={level} onChange={e => setLevel(e.target.value as Watch["level"])}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="high">بحرانی</option>
            <option value="med">مهم</option>
            <option value="low">عادی</option>
          </select>
          <button onClick={add} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> افزودن
          </button>
        </div>
        <div className="space-y-1.5">
          {fired.length === 0 && <div className="text-xs text-slate-400">هنوز هشداری تعریف نشده است.</div>}
          {fired.map(f => {
            const lv = LEVELS[f.level];
            return (
              <div key={f.id} className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${f.count > 0 ? lv.cls : "border-slate-200 dark:border-slate-800 text-slate-400"}`}>
                <span className={`w-2 h-2 rounded-full ${f.count > 0 ? lv.dot : "bg-slate-300 dark:bg-slate-700"}`} />
                <span className="flex-1 truncate">«{f.kw}»</span>
                <span className="opacity-70">{lv.label}</span>
                <span className="tabular-nums font-semibold">{f.count > 0 ? `${faNum(f.count)} مطلب` : "بدون مورد"}</span>
                <button onClick={() => remove(f.id)} className="p-0.5 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            );
          })}
        </div>
      </div>

      {/* anomalies */}
      <div>
        <div className="text-[11px] text-slate-400 mb-2 flex items-center gap-1"><AlertOctagon className="w-3.5 h-3.5" /> ناهنجاری خودکار (جهش حجم پوشش)</div>
        {anomalies.length === 0 ? (
          <div className="text-xs text-slate-400">ناهنجاری قابل‌توجهی شناسایی نشد.</div>
        ) : (
          <div className="space-y-1.5">
            {anomalies.map(an => (
              <button
                key={an.topic}
                onClick={() => onSelectTopic?.(an.topic)}
                className="w-full flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-xs hover:bg-amber-100 dark:hover:bg-amber-900/40 transition text-right"
              >
                <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 truncate">{an.topic}</span>
                <span className="tabular-nums">{faNum(an.current)} مطلب</span>
                <span className="tabular-nums font-semibold">{an.baseline === 0 ? "جدید" : `${toFa(an.ratio)}× میانگین`}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
