import { useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine,
} from "recharts";
import { TrendingUp, CalendarClock, Plus, Tag, Trash2, Flag } from "lucide-react";
import type { Article, } from "../../data";
import { coverageSeries, type Period } from "../../mediaAnalytics";
import { faNum, jalaali, toFa } from "../mobile/utils/fa";

// ── Section ۳.۲ — نمودار روند پوشش (Coverage Timeline) ──
// حجم پوشش در طول زمان + حاشیه‌نویسی رویداد + تقویم شمسی/میلادی + تفکیک روزانه/هفتگی.
// پاسخ به «بیانیهٔ ما جواب داد یا نه؟»: رویدادهای سازمان را روی نمودار می‌گذارید
// و بازتاب رسانه‌ای پیش/پس از آن را می‌بینید.

type EventAnn = { id: string; dayKey: string; label: string };
type Resolution = "daily" | "weekly";
type Cal = "shamsi" | "gregorian";

const LS_KEY = "analytics.events";

function loadEvents(): EventAnn[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function saveEvents(list: EventAnn[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list.slice(-200))); } catch { /* ignore */ }
}

function dayKeyOf(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function CoverageTimeline({ articles, period }: { articles: Article[]; period: Period }) {
  const [resolution, setResolution] = useState<Resolution>(period === 7 ? "daily" : "daily");
  const [cal, setCal] = useState<Cal>("shamsi");
  const [events, setEvents] = useState<EventAnn[]>(loadEvents);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDay, setNewDay] = useState<string>("");

  const daily = useMemo(() => coverageSeries(articles, period), [articles, period]);

  // aggregate into weekly buckets if requested
  const series = useMemo(() => {
    type Pt = { key: string; date: Date; label: string; count: number };
    // Merge any entries that share the same bucket key so the chart never receives
    // duplicate x categories (which trigger React "same key" warnings in recharts).
    const dedupe = (pts: Pt[]): Pt[] => {
      const byKey = new Map<string, Pt>();
      for (const p of pts) {
        const existing = byKey.get(p.key);
        if (existing) existing.count += p.count;
        else byKey.set(p.key, { ...p });
      }
      return Array.from(byKey.values());
    };

    if (resolution === "daily") {
      return dedupe(daily.map(d => ({
        key: dayKeyOf(d.date),
        date: d.date,
        label: cal === "shamsi"
          ? jalaali(d.date, { month: "short", day: "numeric" })
          : d.date.toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
        count: d.count,
      })));
    }
    const out: Pt[] = [];
    for (let i = 0; i < daily.length; i += 7) {
      const chunk = daily.slice(i, i + 7);
      const first = chunk[0].date;
      const total = chunk.reduce((s, c) => s + c.count, 0);
      out.push({
        key: dayKeyOf(first),
        date: first,
        label: cal === "shamsi"
          ? `هفتهٔ ${jalaali(first, { month: "short", day: "numeric" })}`
          : first.toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
        count: total,
      });
    }
    return dedupe(out);
  }, [daily, resolution, cal]);

  // Map each unique bucket key to its display label so the chart axis can key
  // on the guaranteed-unique `key` while still showing the friendly label.
  const labelByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of series) m.set(s.key, s.label);
    return m;
  }, [series]);

  const validDayKeys = useMemo(() => new Set(daily.map(d => dayKeyOf(d.date))), [daily]);

  // map events onto series x-positions (only events inside the window)
  const eventMarks = useMemo(() => {
    return events
      .filter(e => validDayKeys.has(e.dayKey))
      .map(e => {
        // find nearest series bucket
        let matchKey = e.dayKey;
        if (resolution === "weekly") {
          const idx = daily.findIndex(d => dayKeyOf(d.date) === e.dayKey);
          if (idx >= 0) matchKey = dayKeyOf(daily[Math.floor(idx / 7) * 7].date);
        }
        const bucket = series.find(s => s.key === matchKey);
        return bucket ? { ...e, x: bucket.key } : null;
      })
      .filter(Boolean) as (EventAnn & { x: string })[];
  }, [events, validDayKeys, series, resolution, daily]);

  const total = series.reduce((s, d) => s + d.count, 0);
  const peak = Math.max(0, ...series.map(s => s.count));

  const addEvent = () => {
    if (!newLabel.trim() || !newDay) return;
    const next = [...events, { id: `${Date.now()}`, dayKey: newDay, label: newLabel.trim() }];
    setEvents(next); saveEvents(next);
    setNewLabel(""); setNewDay(""); setAdding(false);
  };
  const removeEvent = (id: string) => {
    const next = events.filter(e => e.id !== id);
    setEvents(next); saveEvents(next);
  };

  const seg = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-xs transition ${active
      ? "bg-white dark:bg-slate-900 shadow-sm text-emerald-700 dark:text-emerald-300"
      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"}`;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-emerald-500" />
        <h3 className="text-sm">روند پوشش رسانه‌ای</h3>
        <span className="text-xs text-slate-400">
          {faNum(total)} مطلب • اوج {faNum(peak)}
        </span>
        <div className="flex-1" />
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
          <button className={seg(resolution === "daily")} onClick={() => setResolution("daily")}>روزانه</button>
          <button className={seg(resolution === "weekly")} onClick={() => setResolution("weekly")}>هفتگی</button>
        </div>
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
          <button className={seg(cal === "shamsi")} onClick={() => setCal("shamsi")}>شمسی</button>
          <button className={seg(cal === "gregorian")} onClick={() => setCal("gregorian")}>میلادی</button>
        </div>
        <button
          onClick={() => setAdding(a => !a)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
        >
          <Flag className="w-3.5 h-3.5" /> رویداد
        </button>
      </div>

      {/* add-event form */}
      {adding && (
        <div className="flex flex-wrap items-end gap-2 mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <label className="flex flex-col gap-1 text-[11px] text-slate-500">
            عنوان رویداد
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="مثلاً نشست خبری / انتشار بیانیه"
              className="w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-slate-500">
            روز
            <select
              value={newDay}
              onChange={e => setNewDay(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— انتخاب روز —</option>
              {daily.map(d => (
                <option key={dayKeyOf(d.date)} value={dayKeyOf(d.date)}>
                  {cal === "shamsi" ? jalaali(d.date, { month: "long", day: "numeric" }) : d.date.toLocaleDateString("en-GB")}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={addEvent}
            disabled={!newLabel.trim() || !newDay}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            <Plus className="w-4 h-4" /> افزودن
          </button>
        </div>
      )}

      <div className="h-64" style={{ direction: "ltr" }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 12, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="key" tick={{ fontSize: 10, fill: "var(--foreground-subtle)" }} interval="preserveStartEnd" minTickGap={24}
              tickFormatter={(k) => labelByKey.get(k) ?? ""} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--foreground-subtle)" }} width={28}
              tickFormatter={(v) => toFa(v)} />
            <Tooltip
              contentStyle={{ direction: "rtl", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
              formatter={(v: any) => [faNum(Number(v)), "مطلب"]}
              labelFormatter={(k: any) => labelByKey.get(k) ?? k}
              labelStyle={{ color: "var(--foreground-muted)" }}
            />
            <Bar dataKey="count" fill="var(--brand-200)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Line type="monotone" dataKey="count" stroke="var(--brand-600)" strokeWidth={2} dot={false} />
            {eventMarks.map(m => (
              <ReferenceLine
                key={m.id}
                x={m.x}
                stroke="var(--brand-700)"
                strokeDasharray="4 3"
                label={{ value: m.label, position: "top", fontSize: 9, fill: "var(--brand-700)" }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* event list */}
      {eventMarks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {eventMarks.map(m => (
            <span key={m.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px]">
              <Tag className="w-3 h-3" />
              {m.label}
              <button onClick={() => removeEvent(m.id)} className="hover:text-rose-500"><Trash2 className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
      {total === 0 && (
        <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
          <CalendarClock className="w-3.5 h-3.5" /> در این بازه مطلبی ثبت نشده است.
        </div>
      )}
    </div>
  );
}
