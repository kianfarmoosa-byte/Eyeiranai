import { useEffect, useMemo, useRef, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip, BarChart, Bar, Cell } from "recharts";
import { X, Pause, Play, Radio } from "lucide-react";
import type { Article } from "../../data";
import {
  computeKpis, coverageSeries, toneSeries, sourceBreakdown, topContent, topicHeatmap, detectAnomalies, type Period,
} from "../../mediaAnalytics";
import { sentimentColor, sentimentEmoji, sentimentLabelFa } from "../../sentiment";
import { faNum, toFa, jalaali, timeAgoFa } from "../mobile/utils/fa";

// ── Section ۳.۱۱ — حالت اتاق‌جنگ / کیوسک (War-Room / Kiosk) ──
// تمام‌صفحه، تیرهٔ کنتراست‌بالا، تایپوگرافی درشت، و چرخش خودکار میان چند «صحنه»
// هر ۳۰–۶۰ ثانیه. مناسب نمایش روی تلویزیون اتاق رصد.

const ROTATE_MS = 45000;

type Props = { articles: Article[]; period: Period; onClose: () => void };

export function KioskMode({ articles, period, onClose }: Props) {
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef<number | null>(null);

  const kpis = useMemo(() => computeKpis(articles, period), [articles, period]);
  const cov = useMemo(() => coverageSeries(articles, period).map(d => ({ ...d, label: jalaali(new Date(d.date), { month: "short", day: "numeric" }) })), [articles, period]);
  const tone = useMemo(() => toneSeries(articles, period), [articles, period]);
  const sources = useMemo(() => sourceBreakdown(articles, period, Date.now(), 8), [articles, period]);
  const top = useMemo(() => topContent(articles, period, Date.now(), 8), [articles, period]);
  const heat = useMemo(() => topicHeatmap(articles, period), [articles, period]);
  const anomalies = useMemo(() => detectAnomalies(articles, period), [articles, period]);

  const scenes = ["نمای کلی", "روند پوشش", "منابع برتر", "مطالب داغ", "موضوعات و هشدارها"];

  // clock
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // auto-rotate
  useEffect(() => {
    if (paused) return;
    timer.current = window.setTimeout(() => setScene(s => (s + 1) % scenes.length), ROTATE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [scene, paused, scenes.length]);

  // ESC to exit, arrows to navigate, space to pause
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setScene(s => (s + 1) % scenes.length);
      else if (e.key === "ArrowLeft") setScene(s => (s - 1 + scenes.length) % scenes.length);
      else if (e.key === " ") { e.preventDefault(); setPaused(p => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scenes.length, onClose]);

  const clock = jalaali(new Date(now), { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = jalaali(new Date(now), { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col" style={{ direction: "rtl" }}>
      {/* top bar */}
      <div className="flex items-center gap-3 px-8 py-4 border-b border-slate-800">
        <Radio className="w-6 h-6 text-emerald-400 animate-pulse" />
        <div className="text-xl font-semibold">اتاق رصد رسانه‌ای</div>
        <div className="text-sm text-slate-400">{scenes[scene]}</div>
        <div className="flex-1" />
        <div className="text-2xl tabular-nums text-emerald-300">{clock}</div>
        <div className="text-sm text-slate-400 hidden md:block">{dateStr}</div>
        <button onClick={() => setPaused(p => !p)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-300">
          {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
        </button>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-300"><X className="w-5 h-5" /></button>
      </div>

      {/* scene */}
      <div className="flex-1 overflow-hidden p-8">
        {scene === 0 && (
          <div className="h-full grid grid-cols-2 md:grid-cols-3 gap-6">
            <KioskStat label="حجم پوشش" value={faNum(kpis.volume.value)} delta={kpis.volume.deltaPct} />
            <KioskStat label="منابع فعال" value={faNum(kpis.sources.value)} delta={kpis.sources.deltaPct} />
            <KioskStat label="احساسات خالص" value={`${kpis.netSentiment.value > 0 ? "+" : ""}${toFa(kpis.netSentiment.value)}٪`} delta={kpis.netSentiment.deltaPct} />
            <KioskStat label="میانگین روزانه" value={faNum(kpis.dailyAvg.value)} delta={kpis.dailyAvg.deltaPct} />
            <KioskStat label="موضوعات فعال" value={faNum(kpis.topics.value)} delta={kpis.topics.deltaPct} />
            <KioskStat label="سرعت انتشار" value={faNum(kpis.velocity.value)} delta={kpis.velocity.deltaPct} goodWhenUp={false} />
          </div>
        )}

        {scene === 1 && (
          <div className="h-full flex flex-col">
            <div className="text-2xl mb-4">روند حجم پوشش — {faNum(period)} روز اخیر</div>
            <div className="flex-1" style={{ direction: "ltr" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cov}>
                  <defs>
                    <linearGradient id="kioskCov" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 14 }} interval="preserveStartEnd" />
                  <Tooltip contentStyle={{ direction: "rtl", background: "#0f172a", border: "1px solid #334155", borderRadius: 12 }} formatter={(v: any) => [faNum(Number(v)), "مطلب"]} />
                  <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} fill="url(#kioskCov)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {scene === 2 && (
          <div className="h-full flex flex-col">
            <div className="text-2xl mb-4">منابع پرکارترین دوره</div>
            <div className="flex-1" style={{ direction: "ltr" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sources} layout="vertical" margin={{ right: 40, left: 40 }}>
                  <XAxis type="number" hide />
                  <Tooltip contentStyle={{ direction: "rtl", background: "#0f172a", border: "1px solid #334155", borderRadius: 12 }} formatter={(v: any) => [faNum(Number(v)), "مطلب"]} />
                  <Bar dataKey="total" radius={[0, 8, 8, 0]}>
                    {sources.map((s, i) => <Cell key={i} fill={s.net >= 0 ? "#10b981" : "#f43f5e"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-4 gap-3 mt-3 text-center text-lg">
              {sources.slice(0, 4).map(s => (
                <div key={s.name} className="bg-slate-900 rounded-xl p-3">
                  <div className="text-3xl mb-1">{s.icon || "📰"}</div>
                  <div className="truncate text-slate-300">{s.name}</div>
                  <div className="tabular-nums text-emerald-300">{faNum(s.total)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {scene === 3 && (
          <div className="h-full flex flex-col">
            <div className="text-2xl mb-4">مطالب داغ دوره</div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 content-start overflow-hidden">
              {top.map(({ article: a, sentiment }, i) => (
                <div key={a.id} className="flex items-center gap-4 bg-slate-900 rounded-xl p-4">
                  <span className="text-3xl tabular-nums text-slate-600 w-10 text-center">{faNum(i + 1)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-lg leading-7 line-clamp-2">{a.title}</div>
                    <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
                      <span>{a.sourceIcon || "📰"} {a.source}</span>
                      <span>•</span>
                      <span>{timeAgoFa(a.dateMs || Date.now())}</span>
                    </div>
                  </div>
                  <span className={`text-sm px-2.5 py-1 rounded-full shrink-0 ${sentimentColor(sentiment.label)}`}>
                    {sentimentEmoji(sentiment.label)} {sentimentLabelFa(sentiment.label)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {scene === 4 && (
          <div className="h-full grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-2xl mb-4">موضوعات داغ</div>
              <div className="space-y-3">
                {heat.topics.slice(0, 8).map(t => (
                  <div key={t} className="flex items-center gap-3 bg-slate-900 rounded-xl px-4 py-3 text-lg">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="flex-1 truncate">{t}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-2xl mb-4 text-amber-300">هشدارها و ناهنجاری‌ها</div>
              {anomalies.length === 0 ? (
                <div className="text-slate-500 text-lg">ناهنجاری قابل‌توجهی نیست.</div>
              ) : (
                <div className="space-y-3">
                  {anomalies.slice(0, 8).map(an => (
                    <div key={an.topic} className="flex items-center gap-3 bg-amber-950/40 border border-amber-900 rounded-xl px-4 py-3 text-lg text-amber-200">
                      <span className="flex-1 truncate">{an.topic}</span>
                      <span className="tabular-nums">{faNum(an.current)} مطلب</span>
                      <span className="tabular-nums font-semibold">{an.baseline === 0 ? "جدید" : `${toFa(an.ratio)}×`}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* progress dots */}
      <div className="flex items-center justify-center gap-2 pb-5">
        {scenes.map((s, i) => (
          <button
            key={s}
            onClick={() => setScene(i)}
            className={`h-2 rounded-full transition-all ${i === scene ? "w-8 bg-emerald-400" : "w-2 bg-slate-700 hover:bg-slate-500"}`}
            title={s}
          />
        ))}
      </div>
    </div>
  );
}

function KioskStat({ label, value, delta, goodWhenUp = true }: { label: string; value: string; delta: number | null; goodWhenUp?: boolean }) {
  const up = (delta ?? 0) > 0;
  const good = delta == null ? null : (up === goodWhenUp);
  return (
    <div className="bg-slate-900 rounded-2xl p-6 flex flex-col justify-center">
      <div className="text-lg text-slate-400 mb-2">{label}</div>
      <div className="text-5xl font-semibold tabular-nums mb-2">{value}</div>
      {delta != null && (
        <div className={`text-lg tabular-nums ${good == null ? "text-slate-400" : good ? "text-emerald-400" : "text-rose-400"}`}>
          {up ? "▲" : "▼"} {toFa(Math.abs(delta))}٪
        </div>
      )}
    </div>
  );
}
