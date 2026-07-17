import { useEffect, useMemo, useState } from "react";
import { LayoutDashboard, LineChart, FileText, User, X, Radio } from "lucide-react";
import type { Article } from "../../data";
import { computeKpis, type Period } from "../../mediaAnalytics";
import { faNum, jalaali } from "../mobile/utils/fa";
import { KpiCards } from "./KpiCards";
import { CoverageTimeline } from "./CoverageTimeline";
import { SentimentTone } from "./SentimentTone";
import { SourceBreakdown } from "./SourceBreakdown";
import { TopicHeatmap } from "./TopicHeatmap";
import { CompetitiveView } from "./CompetitiveView";
import { GeoView } from "./GeoView";
import { TopContent } from "./TopContent";
import { AlertsPanel } from "./AlertsPanel";
import { DailyDigest } from "./DailyDigest";
import { KioskMode } from "./KioskMode";
import { ExportShare } from "./ExportShare";
import { StatsDashboard } from "../StatsDashboard";

// ════════════════════════════════════════════════════════════════════
// داشبورد آنالیتیک رسانه‌ای — سه سطح دید از یک منبع دادهٔ واحد.
//   • Executive: کارت‌های شاخص + روند + هشدارها (مدیر ارشد، ۲۴ساعت)
//   • Analyst:   نمودارهای تعاملی، فیلتر، کاوش (کارشناس، ۷–۹۰ روز)
//   • Report:    چیدمان آمادهٔ خروجی PDF با لوگوی سازمان
// این فایل «پوسته» است؛ هر بخش (۳.۱ … ۳.۱۲) به‌صورت گام‌به‌گام افزوده می‌شود.
// ════════════════════════════════════════════════════════════════════

type Props = {
  articles: Article[];
  savedIds: Set<string>;
  onClose: () => void;
};

type ViewLevel = "executive" | "analyst" | "report" | "personal";

const VIEWS: { id: ViewLevel; label: string; icon: typeof LayoutDashboard; hint: string }[] = [
  { id: "executive", label: "نمای اجرایی", icon: LayoutDashboard, hint: "مدیر ارشد" },
  { id: "analyst",   label: "نمای تحلیلی", icon: LineChart,      hint: "کارشناس رصد" },
  { id: "report",    label: "نمای گزارش",  icon: FileText,       hint: "روابط عمومی" },
  { id: "personal",  label: "آمار شخصی",   icon: User,           hint: "مطالعهٔ من" },
];

const PERIODS: { id: Period; label: string }[] = [
  { id: 7,  label: "۷ روز" },
  { id: 30, label: "۳۰ روز" },
  { id: 90, label: "۹۰ روز" },
];

export function MediaAnalyticsDashboard({ articles, savedIds, onClose }: Props) {
  const [view, setView] = useState<ViewLevel>("executive");
  const [period, setPeriod] = useState<Period>(30);
  const [kiosk, setKiosk] = useState(false);

  // Restore a shared read-only view from the URL hash (#analytics=view:period).
  useEffect(() => {
    const m = window.location.hash.match(/analytics=([a-z]+):(\d+)/);
    if (!m) return;
    const v = m[1] as ViewLevel;
    const p = Number(m[2]) as Period;
    if (["executive", "analyst", "report", "personal"].includes(v)) setView(v);
    if ([7, 30, 90].includes(p)) setPeriod(p);
  }, []);

  const kpis = useMemo(() => computeKpis(articles, period), [articles, period]);

  if (kiosk) {
    return <KioskMode articles={articles} period={period} onClose={() => setKiosk(false)} />;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
      {/* ── Sticky header: title, view switcher, period, close ── */}
      <div className="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <LayoutDashboard className="w-6 h-6 text-emerald-600" />
            <h2 className="text-lg">داشبورد آنالیتیک رسانه‌ای</h2>
            <span className="text-xs text-slate-400 hidden sm:inline">
              اشراف رسانه‌ای بر پایهٔ {faNum(articles.length)} مطلب
            </span>
            <div className="flex-1" />
            <button
              onClick={() => setKiosk(true)}
              className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 px-2.5 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800"
            >
              <Radio className="w-4 h-4" /> <span className="hidden sm:inline">حالت اتاق‌جنگ</span>
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white px-2 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" /> بستن
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* view switcher */}
            <div className="inline-flex rounded-xl bg-slate-200/70 dark:bg-slate-800/70 p-1 gap-1">
              {VIEWS.map(v => {
                const Icon = v.icon;
                const active = view === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setView(v.id)}
                    title={v.hint}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
                      active
                        ? "bg-white dark:bg-slate-900 shadow-sm text-emerald-700 dark:text-emerald-300"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{v.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1" />

            {/* period filter (hidden for personal view) */}
            {view !== "personal" && (
              <div className="inline-flex rounded-xl bg-slate-200/70 dark:bg-slate-800/70 p-1 gap-1">
                {PERIODS.map(p => {
                  const active = period === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPeriod(p.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm tabular-nums transition ${
                        active
                          ? "bg-white dark:bg-slate-900 shadow-sm text-emerald-700 dark:text-emerald-300"
                          : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── one data source, three narratives ── */}
      {view === "personal" ? (
        <StatsDashboard articles={articles} savedIds={savedIds} onClose={onClose} />
      ) : view === "executive" ? (
        /* ─── نمای اجرایی: تصویر سریع ۲۴ساعته برای مدیر ارشد ─── */
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 space-y-5">
          <ViewIntro
            title="نمای اجرایی"
            desc="تصویر فشرده و سریع برای تصمیم‌گیری مدیریتی: شاخص‌های کلیدی، خلاصهٔ هوشمند روز، روند پوشش و هشدارها."
          />
          <KpiCards kpis={kpis} />
          <DailyDigest articles={articles} period={period} />
          <CoverageTimeline articles={articles} period={period} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <AlertsPanel articles={articles} period={period} />
            <TopContent articles={articles} period={period} />
          </div>
          <ExportShare articles={articles} period={period} view={view} />
        </div>
      ) : view === "analyst" ? (
        /* ─── نمای تحلیلی: کاوش عمیق و تعاملی برای کارشناس رصد ─── */
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 space-y-5">
          <ViewIntro
            title="نمای تحلیلی"
            desc="کارگاه کامل کاوش داده: همهٔ نمودارهای تعاملی، تفکیک منابع و موضوعات، مقایسهٔ رقبا، تحلیل جغرافیایی و مطالب برتر."
          />
          <KpiCards kpis={kpis} />
          <CoverageTimeline articles={articles} period={period} />
          <SentimentTone articles={articles} period={period} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SourceBreakdown articles={articles} period={period} />
            <TopicHeatmap articles={articles} period={period} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <CompetitiveView articles={articles} period={period} />
            <GeoView articles={articles} period={period} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <AlertsPanel articles={articles} period={period} />
            <TopContent articles={articles} period={period} />
          </div>
          <ExportShare articles={articles} period={period} view={view} />
        </div>
      ) : (
        /* ─── نمای گزارش: چیدمان روایی آمادهٔ چاپ/PDF برای روابط عمومی ─── */
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
          {/* report letterhead (prints too) */}
          <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-5">
            <div className="text-xs text-slate-400 mb-1">{jalaali(new Date(), { dateStyle: "full" })}</div>
            <h1 className="text-2xl">گزارش پایش رسانه‌ای</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              بازهٔ {PERIODS.find(p => p.id === period)?.label} • بر پایهٔ {faNum(articles.length)} مطلب
            </p>
          </div>

          <ExportShare articles={articles} period={period} view={view} />

          <section className="space-y-2">
            <ReportHeading n={1} title="خلاصهٔ مدیریتی" />
            <DailyDigest articles={articles} period={period} />
          </section>

          <section className="space-y-2">
            <ReportHeading n={2} title="شاخص‌های کلیدی" />
            <KpiCards kpis={kpis} />
          </section>

          <section className="space-y-2">
            <ReportHeading n={3} title="روند پوشش خبری" />
            <CoverageTimeline articles={articles} period={period} />
          </section>

          <section className="space-y-2">
            <ReportHeading n={4} title="تحلیل احساسات و لحن" />
            <SentimentTone articles={articles} period={period} />
          </section>

          <section className="space-y-2">
            <ReportHeading n={5} title="منابع و موضوعات برتر" />
            <SourceBreakdown articles={articles} period={period} />
            <TopicHeatmap articles={articles} period={period} />
          </section>

          <section className="space-y-2">
            <ReportHeading n={6} title="مطالب شاخص دوره" />
            <TopContent articles={articles} period={period} />
          </section>

          <div className="text-center text-[10px] text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-4">
            گزارش تولیدشده توسط پلتفرم اشراف رسانه‌ای — برای خروجی PDF از «چاپ» استفاده کنید.
          </div>
        </div>
      )}
    </div>
  );
}

// عنوان معرفی هر نما (فقط روی صفحه؛ در چاپ پنهان)
function ViewIntro({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="print:hidden">
      <h2 className="text-base mb-0.5">{title}</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
    </div>
  );
}

// سرتیتر شماره‌دار بخش‌های گزارش
function ReportHeading({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white text-xs flex items-center justify-center shrink-0 tabular-nums">{faNum(n)}</span>
      <h3 className="text-base">{title}</h3>
    </div>
  );
}
