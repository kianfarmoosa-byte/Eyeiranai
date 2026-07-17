import { ArrowUpRight, ArrowDownRight, Minus, Newspaper, Radio, Gauge, CalendarDays, Layers, Zap } from "lucide-react";
import type { KpiSet, Trend } from "../../mediaAnalytics";
import { faNum, toFa } from "../mobile/utils/fa";

// ── Section ۳.۱ — نوار شاخص‌های کلیدی (KPI Cards) ──
// Big Persian numerals + green/red delta arrows: the row a manager scans in
// 30 seconds to decide whether the dashboard is worth their attention.

type CardDef = {
  key: keyof KpiSet;
  label: string;
  hint: string;
  icon: typeof Newspaper;
  tint: string;
  suffix?: string;
  goodWhenUp?: boolean; // whether an upward delta is a positive signal
};

const CARDS: CardDef[] = [
  { key: "volume",       label: "حجم پوشش",          hint: "کل مطالب دورهٔ جاری", icon: Newspaper,   tint: "from-emerald-500 to-teal-500", goodWhenUp: true },
  { key: "sources",      label: "منابع فعال",        hint: "رسانه‌های متمایز",     icon: Radio,       tint: "from-sky-500 to-cyan-500",     goodWhenUp: true },
  { key: "netSentiment", label: "احساسات خالص",       hint: "٪ مثبت منهای منفی",    icon: Gauge,       tint: "from-violet-500 to-fuchsia-500", suffix: "٪", goodWhenUp: true },
  { key: "dailyAvg",     label: "میانگین روزانه",     hint: "مطلب در روز",          icon: CalendarDays, tint: "from-amber-500 to-orange-500", goodWhenUp: true },
  { key: "topics",       label: "موضوعات فعال",       hint: "برچسب/دستهٔ متمایز",   icon: Layers,      tint: "from-rose-500 to-pink-500",    goodWhenUp: true },
  { key: "velocity",     label: "سرعت انتشار",        hint: "اوج ÷ میانگین (تخمینی)", icon: Zap,       tint: "from-indigo-500 to-blue-500",  suffix: "×", goodWhenUp: false },
];

function DeltaBadge({ t, goodWhenUp }: { t: Trend; goodWhenUp: boolean }) {
  if (t.deltaPct === null || t.dir === "flat") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400">
        <Minus className="w-3 h-3" /> بدون تغییر
      </span>
    );
  }
  const up = t.dir === "up";
  const good = up === goodWhenUp;
  const cls = good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${cls}`}>
      <Icon className="w-3 h-3" />
      {toFa(Math.abs(t.deltaPct))}٪
    </span>
  );
}

export function KpiCards({ kpis, compact = false }: { kpis: KpiSet; compact?: boolean }) {
  return (
    <div className={`grid gap-3 ${compact ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-6" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"}`}>
      {CARDS.map(def => {
        const t = kpis[def.key];
        const Icon = def.icon;
        const val = Number.isInteger(t.value) ? faNum(t.value) : faNum(t.value, { fractionDigits: 1 });
        return (
          <div
            key={def.key}
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${def.tint} flex items-center justify-center text-white shadow-sm`}>
                <Icon className="w-4 h-4" />
              </div>
              <DeltaBadge t={t} goodWhenUp={def.goodWhenUp ?? true} />
            </div>
            <div className="text-2xl tabular-nums leading-none mb-1">
              {val}
              {def.suffix && <span className="text-sm opacity-60 mr-0.5">{def.suffix}</span>}
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-300">{def.label}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{def.hint}</div>
          </div>
        );
      })}
    </div>
  );
}
