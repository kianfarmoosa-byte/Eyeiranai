import { useEffect, useState } from "react";
import { Loader2, BarChart3, FileStack, Languages, Clock, Send, TrendingUp } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api, type PackStats } from "../../api";
import { faNum } from "../mobile/utils/fa";

function Stat({ icon, label, value, tone = "slate" }: { icon: React.ReactNode; label: string; value: string; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "text-slate-700 dark:text-slate-200",
    emerald: "text-emerald-600 dark:text-emerald-400",
    blue: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
  };
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">{icon}{label}</div>
      <div className={`text-2xl font-extrabold mt-1 ${tones[tone] || tones.slate}`}>{value}</div>
    </div>
  );
}

function fmtDay(t: number) {
  try { return new Intl.DateTimeFormat("fa-IR", { month: "numeric", day: "numeric" }).format(new Date(t)); }
  catch { return ""; }
}

export function PackAnalytics({ userId, packId }: { userId: string; packId: string }) {
  const [stats, setStats] = useState<PackStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    setLoading(true);
    try { setStats(await api.newspackGetStats(userId, packId)); }
    catch (e) { console.error("Failed to load pack stats:", e); }
    finally { setLoading(false); }
  })(); }, [userId, packId]);

  if (loading) return <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>;
  if (!stats || stats.totalEditions === 0) {
    return (
      <div className="py-10 text-center text-slate-400 space-y-2">
        <BarChart3 className="w-10 h-10 mx-auto" />
        <p className="text-sm">هنوز آماری ثبت نشده است. یک بار بسته را تولید کنید تا تحلیل‌ها نمایش داده شوند.</p>
      </div>
    );
  }

  const history = stats.history.map((h) => ({ ...h, day: fmtDay(h.t) }));
  const topSources = Object.entries(stats.sourceCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
  const sectionData = Object.entries(stats.sectionCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
  const avgItems = Math.round(stats.totalItems / stats.totalEditions);
  const translatedPct = stats.totalItems > 0 ? Math.round((stats.totalTranslated / stats.totalItems) * 100) : 0;
  const deliveryTotal = stats.deliveries.webhookOk + stats.deliveries.webhookFail + stats.deliveries.emailOk + stats.deliveries.emailFail;
  const deliveryOk = stats.deliveries.webhookOk + stats.deliveries.emailOk;
  const deliveryRate = deliveryTotal > 0 ? Math.round((deliveryOk / deliveryTotal) * 100) : null;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat icon={<FileStack className="w-3.5 h-3.5" />} label="نسخه‌ها" value={faNum(stats.totalEditions)} />
        <Stat icon={<TrendingUp className="w-3.5 h-3.5" />} label="میانگین مطلب" value={faNum(avgItems)} tone="blue" />
        <Stat icon={<Languages className="w-3.5 h-3.5" />} label="ترجمه‌شده" value={`${faNum(translatedPct)}٪`} tone="emerald" />
        <Stat icon={<Send className="w-3.5 h-3.5" />} label="موفقیت تحویل" value={deliveryRate == null ? "—" : `${faNum(deliveryRate)}٪`} tone="amber" />
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-3">
        <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5"><Clock className="w-4 h-4" /> مطالب در طول زمان</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={history} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} reversed />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Line type="monotone" dataKey="items" name="مطالب" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="translated" name="ترجمه‌شده" stroke="#10b981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-3">
          <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">پرکارترین منابع</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topSources} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" name="مطالب" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-3">
          <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">توزیع بخش‌ها</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sectionData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" name="مطالب" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="text-xs text-slate-400 flex items-center gap-3 flex-wrap">
        <span>تولید دستی: {faNum(stats.manualRuns)}</span>
        <span>·</span>
        <span>تولید خودکار: {faNum(stats.scheduledRuns)}</span>
        {deliveryTotal > 0 && (
          <>
            <span>·</span>
            <span>تحویل موفق: {faNum(deliveryOk)} از {faNum(deliveryTotal)}</span>
          </>
        )}
      </div>
    </div>
  );
}
