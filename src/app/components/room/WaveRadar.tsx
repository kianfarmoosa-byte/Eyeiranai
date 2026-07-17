import { useMemo, useState } from "react";
import { Radar, TrendingUp, TrendingDown, Flame, Users, Siren, ChevronDown, Gauge } from "lucide-react";
import type { Article } from "../../data";
import { faNum } from "../mobile/utils/fa";
import { detectWaves, predictWave, tokensOf, articleMs } from "./roomUtils";

// ── ۳.۳ رادار موج و ناهنجاری (Wave Radar) ──
// تشخیص موج در حال شکل‌گیری، سرعت/شتاب، چرخش لحن، پیش‌بینی مسیر و «چه کسانی
// این موج را هدایت می‌کنند؟» (منابع پیشرو در موضوع).

type Props = {
  articles: Article[];
  onOpenArticle?: (id: string) => void;
  onEscalate?: (topic: string) => void;
  big?: boolean;
};

function driversOf(articles: Article[], term: string): { source: string; icon: string; count: number }[] {
  const winStart = Date.now() - 6 * 3600000;
  const m = new Map<string, { icon: string; count: number }>();
  for (const a of articles) {
    if (articleMs(a) < winStart) continue;
    if (!tokensOf(a).includes(term)) continue;
    const cur = m.get(a.source) || { icon: a.sourceIcon, count: 0 };
    cur.count++; m.set(a.source, cur);
  }
  return [...m.entries()].map(([source, v]) => ({ source, icon: v.icon, count: v.count }))
    .sort((a, b) => b.count - a.count).slice(0, 5);
}

export function WaveRadar({ articles, onOpenArticle, onEscalate, big }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const waves = useMemo(() => detectWaves(articles), [articles]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-slate-900">
      <div className="flex items-center gap-2 p-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <Radar className="w-4 h-4 text-emerald-500" />
        <h3 className={big ? "text-lg" : "text-sm"}>رادار موج و ناهنجاری</h3>
        <span className="text-[11px] text-slate-400">{faNum(waves.length)} موج فعال</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {waves.length === 0 && (
          <div className="p-6 text-center text-xs text-slate-400">
            <Gauge className="w-6 h-6 mx-auto mb-2 text-slate-300" />
            موجی بالاتر از خط پایه شناسایی نشد. فضای رسانه آرام است.
          </div>
        )}
        {waves.map(w => {
          const pred = predictWave(w);
          const open = expanded === w.term;
          const drivers = open ? driversOf(articles, w.term) : [];
          return (
            <div key={w.term}
              className={`rounded-xl border p-3 ${w.toneShift ? "border-rose-300 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/10" : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40"}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${pred.growing ? "bg-orange-500 animate-pulse" : "bg-slate-400"}`} />
                <button onClick={() => w.sample && onOpenArticle?.(w.sample.id)} className={`flex-1 text-right ${big ? "text-base" : "text-sm"} truncate hover:text-emerald-600`}>
                  {w.term}
                </button>
                <span className="text-[11px] tabular-nums px-1.5 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  {w.factor.toFixed(1)}× خط پایه
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                <div className="rounded-lg bg-white dark:bg-slate-900 p-1.5">
                  <div className="text-[10px] text-slate-500">حجم اخیر</div>
                  <div className="text-sm tabular-nums">{faNum(w.current)}</div>
                </div>
                <div className="rounded-lg bg-white dark:bg-slate-900 p-1.5">
                  <div className="text-[10px] text-slate-500">سرعت/ساعت</div>
                  <div className="text-sm tabular-nums">{faNum(Math.round(w.velocity))}</div>
                </div>
                <div className="rounded-lg bg-white dark:bg-slate-900 p-1.5">
                  <div className="text-[10px] text-slate-500">شتاب</div>
                  <div className="text-sm tabular-nums flex items-center justify-center gap-0.5">
                    {w.acceleration >= 1.1 ? <TrendingUp className="w-3 h-3 text-orange-500" /> : <TrendingDown className="w-3 h-3 text-slate-400" />}
                    {w.acceleration.toFixed(1)}×
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className={`text-[11px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${pred.growing ? "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                  <Flame className="w-3 h-3" /> {pred.label}
                </span>
                {w.toneShift && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 inline-flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" /> چرخش لحن به منفی
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 mt-2">
                <button onClick={() => setExpanded(open ? null : w.term)} className="text-[11px] text-slate-500 hover:text-emerald-600 inline-flex items-center gap-1">
                  <Users className="w-3 h-3" /> هدایت‌کنندگان موج <ChevronDown className={`w-3 h-3 transition ${open ? "rotate-180" : ""}`} />
                </button>
                {onEscalate && (
                  <button onClick={() => onEscalate(w.term)} className="text-[11px] mr-auto px-2 py-0.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 inline-flex items-center gap-1">
                    <Siren className="w-3 h-3" /> اعلام بحران
                  </button>
                )}
              </div>

              {open && (
                <div className="mt-2 border-t border-slate-200 dark:border-slate-700 pt-2 space-y-1">
                  {drivers.length === 0 && <div className="text-[11px] text-slate-400">منبعی یافت نشد.</div>}
                  {drivers.map((d, i) => (
                    <div key={d.source} className="flex items-center gap-2 text-[11px]">
                      <span className="w-4 text-slate-400 tabular-nums">{faNum(i + 1)}</span>
                      <span>{d.icon}</span>
                      <span className="flex-1 truncate">{d.source}</span>
                      <span className="tabular-nums text-slate-500">{faNum(d.count)} مطلب</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
