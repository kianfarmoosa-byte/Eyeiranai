import { useMemo, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Gauge, AlertTriangle, MessageSquare } from "lucide-react";
import type { Article } from "../../data";
import { toneSeries, splitByPeriod, type Period } from "../../mediaAnalytics";
import { scoreArticle } from "../../sentiment";
import { faNum, jalaali, toFa } from "../mobile/utils/fa";

// ── Section ۳.۳ — تحلیل احساسات و لحن (Sentiment & Tone) ──
// نمودار ناحیه‌ای انباشتهٔ مثبت/منفی/خنثی در طول زمان + هشدار «چرخش لحن»
// (اگر احساسات ۲۴ ساعت اخیر نسبت به میانگین دوره به‌شدت منفی شود) + تفکیک
// لحن رسانه‌ای ایران (تحلیلی/انتقادی/تبلیغی/خبری) با اکتشاف واژگانی سبک.

const TONE_LEX: { key: string; label: string; color: string; words: string[] }[] = [
  { key: "analytical", label: "تحلیلی", color: "#6366f1", words: ["تحلیل", "بررسی", "ارزیابی", "چرایی", "دلیل", "ریشه", "چشم‌انداز", "پیامد"] },
  { key: "critical",   label: "انتقادی", color: "#ef4444", words: ["انتقاد", "اعتراض", "هشدار", "بحران", "شکست", "نگرانی", "ضعف", "مشکل", "فساد"] },
  { key: "promo",      label: "تبلیغی",  color: "#f59e0b", words: ["افتتاح", "رونمایی", "دستاورد", "موفقیت", "رکورد", "برترین", "پیشرفت", "رشد", "معرفی"] },
  { key: "neutral",    label: "خبری خنثی", color: "#94a3b8", words: [] },
];

function classifyTone(a: Article): string {
  const hay = `${a.title} ${a.preview || ""}`;
  let best = "neutral", bestN = 0;
  for (const t of TONE_LEX) {
    if (!t.words.length) continue;
    let n = 0;
    for (const w of t.words) if (hay.includes(w)) n++;
    if (n > bestN) { bestN = n; best = t.key; }
  }
  return best;
}

export function SentimentTone({ articles, period }: { articles: Article[]; period: Period }) {
  const [showTone, setShowTone] = useState(false);
  const series = useMemo(() => toneSeries(articles, period), [articles, period]);

  const chartData = useMemo(
    () => series.map(p => {
      const [y, m, d] = p.key.split("-").map(Number);
      return {
        label: jalaali(new Date(y, m - 1, d), { month: "short", day: "numeric" }),
        مثبت: p.positive, خنثی: p.neutral, منفی: p.negative,
      };
    }),
    [series],
  );

  // tone-shift alert: last-24h net vs period average net
  const alert = useMemo(() => {
    const { current } = splitByPeriod(articles, period);
    if (!current.length) return null;
    const now = Date.now();
    const dayAgo = now - 86400000;
    let dPos = 0, dNeg = 0, dTot = 0;
    let pPos = 0, pNeg = 0;
    for (const a of current) {
      const s = scoreArticle(a);
      if (s.label === "positive") pPos++; else if (s.label === "negative") pNeg++;
      const ms = a.dateMs || Date.parse(a.date) || 0;
      if (ms >= dayAgo) {
        dTot++;
        if (s.label === "positive") dPos++; else if (s.label === "negative") dNeg++;
      }
    }
    if (dTot < 3) return null;
    const dayNet = Math.round(((dPos - dNeg) / dTot) * 100);
    const periodNet = Math.round(((pPos - pNeg) / current.length) * 100);
    if (dayNet <= periodNet - 20 && dayNet < 0) {
      return { dayNet, periodNet, count: dTot };
    }
    return null;
  }, [articles, period]);

  const toneBreakdown = useMemo(() => {
    if (!showTone) return [];
    const { current } = splitByPeriod(articles, period);
    const m = new Map<string, number>();
    for (const a of current) { const t = classifyTone(a); m.set(t, (m.get(t) || 0) + 1); }
    const total = current.length || 1;
    return TONE_LEX.map(t => ({ ...t, count: m.get(t.key) || 0, pct: Math.round(((m.get(t.key) || 0) / total) * 100) }));
  }, [articles, period, showTone]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Gauge className="w-4 h-4 text-violet-500" />
        <h3 className="text-sm">تحلیل احساسات و لحن</h3>
        <div className="flex-1" />
        <button
          onClick={() => setShowTone(s => !s)}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition ${
            showTone
              ? "bg-emerald-600 text-white"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" /> تفکیک لحن
        </button>
      </div>

      {/* tone-shift alert */}
      {alert && (
        <div className="mb-3 flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="text-xs leading-relaxed">
            <span className="font-semibold">هشدار چرخش لحن:</span> احساسات خالص ۲۴ ساعت اخیر
            ({toFa(alert.dayNet)}٪) نسبت به میانگین دوره ({toFa(alert.periodNet)}٪) به‌طور محسوس منفی‌تر شده است.
            بررسی زودهنگام توصیه می‌شود.
          </div>
        </div>
      )}

      <div className="h-56" style={{ direction: "ltr" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
            <defs>
              <linearGradient id="gPos" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.7} /><stop offset="100%" stopColor="#10b981" stopOpacity={0.1} /></linearGradient>
              <linearGradient id="gNeu" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#94a3b8" stopOpacity={0.6} /><stop offset="100%" stopColor="#94a3b8" stopOpacity={0.1} /></linearGradient>
              <linearGradient id="gNeg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={0.7} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0.1} /></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--foreground-subtle)" }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--foreground-subtle)" }} width={28} tickFormatter={(v) => toFa(v)} />
            <Tooltip
              contentStyle={{ direction: "rtl", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
              formatter={(v: any, n: any) => [faNum(Number(v)), n]}
            />
            <Legend wrapperStyle={{ fontSize: 11, direction: "rtl" }} />
            <Area type="monotone" dataKey="مثبت" stackId="1" stroke="#10b981" fill="url(#gPos)" strokeWidth={1.5} />
            <Area type="monotone" dataKey="خنثی" stackId="1" stroke="#94a3b8" fill="url(#gNeu)" strokeWidth={1.5} />
            <Area type="monotone" dataKey="منفی" stackId="1" stroke="#ef4444" fill="url(#gNeg)" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* tone breakdown (heuristic) */}
      {showTone && (
        <div className="mt-4">
          <div className="text-[11px] text-slate-400 mb-2">تفکیک لحن رسانه‌ای (اکتشافی، بر پایهٔ واژگان)</div>
          <div className="space-y-2">
            {toneBreakdown.map(t => (
              <div key={t.key}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} /> {t.label}
                  </span>
                  <span className="tabular-nums opacity-70">{faNum(t.count)} • {toFa(t.pct)}٪</span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${t.pct}%`, background: t.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
