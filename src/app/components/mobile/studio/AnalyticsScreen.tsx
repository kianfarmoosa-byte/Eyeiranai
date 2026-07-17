import { useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, XCircle, Send, Clock, Zap, RefreshCw, Eye, Heart, Share2, Plus, Loader2 } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { useHaptics } from "../hooks";
import { useToast } from "../primitives/Toast";
import { api, type PubLogEntry, type AutoLogEntry, type Draft, type AutomationRule, type MetricEntry } from "../../../api";
import { studioUserId, PLATFORM_META, PUBLISHABLE, INPUT_CLS } from "./studio";
import { faNum } from "../utils/fa";

type Props = { onClose: () => void };

type Attempt = { ts: number; platform: string; ok: boolean };

export function AnalyticsScreen({ onClose }: Props) {
  const haptic = useHaptics();
  const toast = useToast();
  const uid = studioUserId();
  const [pub, setPub] = useState<PubLogEntry[]>([]);
  const [auto, setAuto] = useState<AutoLogEntry[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [loading, setLoading] = useState(true);
  // manual metric form
  const [mOpen, setMOpen] = useState(false);
  const [mPlatform, setMPlatform] = useState<string>("telegram");
  const [mViews, setMViews] = useState("");
  const [mLikes, setMLikes] = useState("");
  const [mShares, setMShares] = useState("");
  const [mSaving, setMSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, a, d, r, m] = await Promise.all([
        api.studioGetPubLog(uid), api.studioGetAutoLog(uid), api.studioGetDrafts(uid), api.studioGetRules(uid), api.studioGetMetrics(uid),
      ]);
      setPub(p); setAuto(a); setDrafts(d); setRules(r); setMetrics(m);
    } catch (e) {
      console.log("load analytics failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMetric = async () => {
    haptic("select");
    setMSaving(true);
    try {
      await api.studioSaveMetric(uid, {
        platform: mPlatform,
        views: Number(mViews) || 0,
        likes: Number(mLikes) || 0,
        shares: Number(mShares) || 0,
      });
      setMViews(""); setMLikes(""); setMShares(""); setMOpen(false);
      toast({ kind: "success", message: "عملکرد ثبت شد" });
      load();
    } catch (e: any) {
      console.log("save metric failed:", e);
      toast({ kind: "error", message: String(e?.message || e).slice(0, 120) });
    } finally {
      setMSaving(false);
    }
  };

  const engagement = useMemo(() => {
    return metrics.reduce((acc, m) => ({ views: acc.views + (m.views || 0), likes: acc.likes + (m.likes || 0), shares: acc.shares + (m.shares || 0) }), { views: 0, likes: 0, shares: 0 });
  }, [metrics]);

  const stats = useMemo(() => {
    // Flatten every publish attempt from both manual and automation logs.
    const attempts: Attempt[] = [
      ...pub.map((e) => ({ ts: e.ts, platform: e.platform, ok: e.ok })),
      ...auto.flatMap((e) => (e.published || []).map((p) => ({ ts: e.ts, platform: p.platform, ok: p.ok }))),
    ];
    const total = attempts.length;
    const ok = attempts.filter((a) => a.ok).length;
    const rate = total ? Math.round((ok / total) * 100) : 0;

    const perPlatform = new Map<string, { ok: number; fail: number }>();
    for (const a of attempts) {
      const e = perPlatform.get(a.platform) || { ok: 0, fail: 0 };
      if (a.ok) e.ok++; else e.fail++;
      perPlatform.set(a.platform, e);
    }

    // Last 7 days counts.
    const days: { label: string; count: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const start = d.getTime();
      const end = start + 86400000;
      const count = attempts.filter((a) => a.ts >= start && a.ts < end).length;
      days.push({ label: d.toLocaleDateString("fa-IR", { weekday: "narrow" }), count });
    }
    const maxDay = Math.max(1, ...days.map((d) => d.count));

    return {
      total, ok, fail: total - ok, rate,
      perPlatform: [...perPlatform.entries()],
      days, maxDay,
      scheduled: drafts.filter((d) => d.status === "scheduled").length,
      published: drafts.filter((d) => d.status === "published").length,
      awaiting: drafts.filter((d) => d.auto && d.status === "draft").length,
      activeRules: rules.filter((r) => r.enabled).length,
    };
  }, [pub, auto, drafts, rules]);

  return (
    <MobileScreen topbar={<MobileTopBar title="آمار انتشار" onBack={onClose} trailing={
      <button onClick={() => { haptic("tap"); load(); }} aria-label="بروزرسانی" className="size-10 grid place-items-center rounded-full tap press active:bg-[var(--accent)]">
        <RefreshCw className={`size-5 ${loading ? "animate-spin" : ""}`} />
      </button>
    } />}>
      <div className="h-full overflow-y-auto scrollbar-none pb-10">
        {loading && stats.total === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-[var(--foreground-subtle)]">در حال بارگذاری…</div>
        ) : (
          <div className="md:grid md:grid-cols-2 md:gap-5 md:items-start md:max-w-[1120px] md:w-full md:mx-auto md:px-4 md:pt-4">
            {/* KPI cards */}
            <div className="px-3 pt-4 md:px-0 md:pt-0 md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-2">
              <Kpi icon={<Send className="size-4" />} label="کل انتشارها" value={faNum(stats.total)} />
              <Kpi icon={<CheckCircle2 className="size-4 text-emerald-500" />} label="نرخ موفقیت" value={`${faNum(stats.rate)}٪`} />
              <Kpi icon={<Clock className="size-4 text-amber-500" />} label="زمان‌بندی‌شده" value={faNum(stats.scheduled)} />
              <Kpi icon={<Zap className="size-4 text-[var(--brand-500)]" />} label="قوانین فعال" value={faNum(stats.activeRules)} />
            </div>

            {(stats.awaiting > 0 || stats.published > 0) && (
              <div className="px-3 mt-2 md:px-0 md:mt-0 md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                <Kpi icon={<Clock className="size-4" />} label="در انتظار تأیید" value={faNum(stats.awaiting)} />
                <Kpi icon={<CheckCircle2 className="size-4 text-emerald-500" />} label="منتشرشده (پیش‌نویس)" value={faNum(stats.published)} />
              </div>
            )}

            {/* 7-day chart */}
            <div className="px-4 mt-5 md:px-0 md:mt-0 md:col-span-2">
              <div className="text-[13px] font-semibold mb-2 flex items-center gap-1.5">
                <BarChart3 className="size-4 text-[var(--brand-500)]" /> ۷ روز اخیر
              </div>
              <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5">
                <div className="flex items-end justify-between gap-2 h-28">
                  {stats.days.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5">
                      <div className="w-full rounded-t-[4px] bg-[var(--brand-500)]" style={{ height: `${(d.count / stats.maxDay) * 100}%`, minHeight: d.count ? 4 : 0 }} />
                      <span className="text-[10px] text-[var(--foreground-subtle)] tabular-nums">{faNum(d.count)}</span>
                      <span className="text-[10px] text-[var(--foreground-subtle)]">{d.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Per-platform breakdown */}
            <div className="px-4 mt-5 md:px-0 md:mt-0 md:col-start-1">
              <div className="text-[13px] font-semibold mb-2">تفکیک پلتفرم</div>
              {stats.perPlatform.length === 0 ? (
                <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3.5 py-6 text-center text-[12.5px] text-[var(--foreground-subtle)]">
                  هنوز انتشاری ثبت نشده است.
                </div>
              ) : (
                <ul className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] divide-y divide-[var(--border-subtle)] overflow-hidden">
                  {stats.perPlatform.map(([p, v]) => (
                    <li key={p} className="flex items-center gap-3 px-3.5 py-2.5">
                      <span className="text-lg">{PLATFORM_META[p as keyof typeof PLATFORM_META]?.emoji || "📤"}</span>
                      <span className="flex-1 text-[13px]">{PLATFORM_META[p as keyof typeof PLATFORM_META]?.label || p}</span>
                      <span className="inline-flex items-center gap-1 text-[12px] text-emerald-500"><CheckCircle2 className="size-3.5" />{faNum(v.ok)}</span>
                      {v.fail > 0 && <span className="inline-flex items-center gap-1 text-[12px] text-rose-500"><XCircle className="size-3.5" />{faNum(v.fail)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Engagement (manual metrics) */}
            <div className="px-4 mt-5 md:px-0 md:mt-0 md:col-start-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-semibold">عملکرد و تعامل</span>
                <button onClick={() => { haptic("tap"); setMOpen((o) => !o); }} className="text-[12px] text-[var(--brand-500)] inline-flex items-center gap-1 tap press">
                  <Plus className="size-3.5" /> ثبت دستی
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Kpi icon={<Eye className="size-4" />} label="بازدید" value={faNum(engagement.views)} />
                <Kpi icon={<Heart className="size-4 text-rose-500" />} label="پسند" value={faNum(engagement.likes)} />
                <Kpi icon={<Share2 className="size-4" />} label="اشتراک" value={faNum(engagement.shares)} />
              </div>

              {mOpen && (
                <div className="mt-2 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {PUBLISHABLE.map((p) => (
                      <button key={p} onClick={() => { haptic("tap"); setMPlatform(p); }}
                        className={`px-2.5 py-1 rounded-full text-[11.5px] border tap press ${mPlatform === p ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]" : "border-[var(--border-subtle)] text-[var(--foreground-muted)]"}`}>
                        {PLATFORM_META[p].emoji} {PLATFORM_META[p].label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input value={mViews} onChange={(e) => setMViews(e.target.value)} type="number" inputMode="numeric" placeholder="بازدید" className={INPUT_CLS} />
                    <input value={mLikes} onChange={(e) => setMLikes(e.target.value)} type="number" inputMode="numeric" placeholder="پسند" className={INPUT_CLS} />
                    <input value={mShares} onChange={(e) => setMShares(e.target.value)} type="number" inputMode="numeric" placeholder="اشتراک" className={INPUT_CLS} />
                  </div>
                  <button onClick={saveMetric} disabled={mSaving} className="w-full h-10 rounded-[var(--radius-md)] bg-[var(--brand-500)] text-white text-[13px] font-semibold tap press flex items-center justify-center gap-2 disabled:opacity-50">
                    {mSaving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    {mSaving ? "در حال ثبت…" : "ثبت عملکرد"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </MobileScreen>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5">
      <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--foreground-subtle)]">{icon}{label}</div>
      <div className="mt-1 text-[22px] font-black tabular-nums">{value}</div>
    </div>
  );
}
