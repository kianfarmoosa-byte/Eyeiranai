import { useEffect, useState } from "react";
import { Sparkles, FileText, Wand2, Palette, Trash2, ChevronLeft, Clock, Send, Link2, Zap, Activity, BarChart3, CalendarClock } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { useHaptics } from "../hooks";
import { useToast } from "../primitives/Toast";
import { api, type Draft, type BrandProfile, type StudioPlatform } from "../../../api";
import type { Article } from "../../../data";
import { studioUserId, PLATFORM_META, PUBLISHABLE } from "./studio";
import { BrandProfileScreen } from "./BrandProfileScreen";
import { TemplatesScreen } from "./TemplatesScreen";
import { ComposeScreen } from "./ComposeScreen";
import { DraftEditorScreen } from "./DraftEditorScreen";
import { ConnectionsScreen } from "./ConnectionsScreen";
import { AutomationScreen } from "./AutomationScreen";
import { ActivityScreen } from "./ActivityScreen";
import { AnalyticsScreen } from "./AnalyticsScreen";
import { QueueScreen } from "./QueueScreen";
import { CronSetupScreen } from "./CronSetupScreen";
import { RetryQueueScreen } from "./RetryQueueScreen";
import { toFa } from "../utils/fa";

type View = "hub" | "brand" | "templates" | "compose" | "draft" | "connections" | "automation" | "activity" | "analytics" | "queue" | "cron" | "retries";

type Props = {
  articles: Article[];
  onClose: () => void;
};

export function StudioScreen({ articles, onClose }: Props) {
  const haptic = useHaptics();
  const toast = useToast();
  const uid = studioUserId();

  const [view, setView] = useState<View>("hub");
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [tplCount, setTplCount] = useState(0);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [connCount, setConnCount] = useState(0);
  const [ruleCount, setRuleCount] = useState(0);
  const [retryPending, setRetryPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeDraft, setActiveDraft] = useState<Draft | null>(null);

  const refresh = async () => {
    try {
      const [b, t, d, c, r, s] = await Promise.all([
        api.studioGetBrand(uid),
        api.studioGetTemplates(uid),
        api.studioGetDrafts(uid),
        api.studioGetConnections(uid),
        api.studioGetRules(uid),
        api.studioAutomationStatus().catch(() => null),
      ]);
      setBrand(b);
      setTplCount(t.length);
      setDrafts(d);
      setConnCount(PUBLISHABLE.filter((p) => c[p]?.connected).length);
      setRuleCount(r.filter((x) => x.enabled).length);
      setRetryPending(s?.retryPending || 0);
    } catch (e) {
      console.log("studio hub load failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when returning to the hub from a sub-screen.
  useEffect(() => { if (view === "hub") refresh(); }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeDraft = async (id: string) => {
    haptic("heavy");
    try {
      await api.studioDeleteDraft(uid, id);
      setDrafts((l) => l.filter((d) => d.id !== id));
      toast({ kind: "success", message: "پیش‌نویس حذف شد" });
    } catch (e) {
      console.log("delete draft failed:", e);
    }
  };

  if (view === "brand") return <BrandProfileScreen onClose={() => setView("hub")} />;
  if (view === "templates") return <TemplatesScreen onClose={() => setView("hub")} />;
  if (view === "compose")
    return (
      <ComposeScreen
        articles={articles}
        onClose={() => setView("hub")}
        onCreated={(d) => { setActiveDraft(d); setView("draft"); }}
      />
    );
  if (view === "connections") return <ConnectionsScreen onClose={() => setView("hub")} />;
  if (view === "automation") return <AutomationScreen onClose={() => setView("hub")} onOpenCron={() => setView("cron")} onOpenRetries={() => setView("retries")} />;
  if (view === "cron") return <CronSetupScreen onClose={() => setView("automation")} />;
  if (view === "retries") return <RetryQueueScreen onClose={() => setView("automation")} />;
  if (view === "activity") return <ActivityScreen onClose={() => setView("hub")} />;
  if (view === "analytics") return <AnalyticsScreen onClose={() => setView("hub")} />;
  if (view === "queue") return <QueueScreen onClose={() => setView("hub")} onOpenDraft={(d) => { setActiveDraft(d); setView("draft"); }} />;
  if (view === "draft" && activeDraft)
    return (
      <DraftEditorScreen
        draft={activeDraft}
        onClose={() => setView("hub")}
        onSaved={(d) => setActiveDraft(d)}
        onOpenConnections={() => setView("connections")}
      />
    );

  return (
    <MobileScreen topbar={<MobileTopBar title="استودیوی محتوا" onBack={onClose} />}>
      <div className="h-full overflow-y-auto scrollbar-none pb-28">
        {/* Hero */}
        <div className="px-4 pt-4">
          <div className="rounded-[var(--radius-xl)] bg-gradient-to-br from-[var(--brand-500)] to-[var(--brand-700)] text-white p-4 relative overflow-hidden">
            <div className="absolute -bottom-8 -left-8 size-32 rounded-full bg-white/10" />
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="size-5" />
              <span className="text-[15px] font-bold">تولید محتوا با هوش مصنوعی</span>
            </div>
            <p className="text-[12.5px] leading-relaxed text-white/85 max-w-[280px]">
              خبرها را به محتوای آمادهٔ انتشار برای شبکه‌های اجتماعی و سایت خبری‌ات تبدیل کن — با لحن و برند اختصاصی خودت.
            </p>
          </div>
        </div>

        {/* Setup cards */}
        <div className="px-3 mt-4 grid grid-cols-2 gap-2">
          <SetupCard
            icon={<Palette className="size-5" />}
            title="پروفایل برند"
            sub={brand?.name ? brand.name : "تنظیم نشده"}
            done={!!brand?.name}
            onClick={() => { haptic("tap"); setView("brand"); }}
          />
          <SetupCard
            icon={<FileText className="size-5" />}
            title="قالب‌ها"
            sub={tplCount > 0 ? `${toFa(tplCount)} قالب` : "بدون قالب"}
            done={tplCount > 0}
            onClick={() => { haptic("tap"); setView("templates"); }}
          />
          <SetupCard
            icon={<Link2 className="size-5" />}
            title="اتصال حساب‌ها"
            sub={connCount > 0 ? `${toFa(connCount)} حساب متصل` : "تلگرام و بله"}
            done={connCount > 0}
            onClick={() => { haptic("tap"); setView("connections"); }}
          />
          <SetupCard
            icon={<Zap className="size-5" />}
            title="اتوماسیون"
            sub={retryPending > 0 ? `${toFa(retryPending)} انتشار در صف تلاش` : ruleCount > 0 ? `${toFa(ruleCount)} قانون فعال` : "زمان‌بندی/رخداد"}
            done={ruleCount > 0}
            badge={retryPending}
            onClick={() => { haptic("tap"); setView("automation"); }}
          />
          <SetupCard
            icon={<CalendarClock className="size-5" />}
            title="صف زمان‌بندی"
            sub="موعد بعدی و پیش‌نویس‌ها"
            done={false}
            onClick={() => { haptic("tap"); setView("queue"); }}
          />
          <SetupCard
            icon={<Activity className="size-5" />}
            title="فعالیت و انتشارها"
            sub="گزارش و تاریخچه"
            done={false}
            onClick={() => { haptic("tap"); setView("activity"); }}
          />
          <SetupCard
            icon={<BarChart3 className="size-5" />}
            title="آمار انتشار"
            sub="داشبورد تحلیلی"
            done={false}
            onClick={() => { haptic("tap"); setView("analytics"); }}
          />
        </div>

        {/* Drafts */}
        <div className="px-4 mt-6 mb-2 flex items-center justify-between">
          <span className="text-[13px] font-semibold">پیش‌نویس‌ها</span>
          {drafts.length > 0 && <span className="text-[12px] text-[var(--foreground-subtle)]">{toFa(drafts.length)} مورد</span>}
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-[13px] text-[var(--foreground-subtle)]">در حال بارگذاری…</div>
        ) : drafts.length === 0 ? (
          <div className="px-6 py-10 flex flex-col items-center text-center gap-2">
            <div className="size-12 rounded-2xl bg-[var(--background-muted)] grid place-items-center">
              <Wand2 className="size-5 text-[var(--foreground-subtle)]" />
            </div>
            <div className="text-[13px] text-[var(--foreground-subtle)] max-w-[240px]">
              هنوز پیش‌نویسی نساخته‌ای. روی دکمهٔ پایین بزن تا از یک خبر، محتوای آماده بسازی.
            </div>
          </div>
        ) : (
          <ul className="mx-3 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
            {drafts.map((d) => {
              const platforms = Object.keys(d.outputs) as StudioPlatform[];
              return (
                <li key={d.id}>
                  <div className="w-full flex items-center gap-3 px-3.5 py-3">
                    <button
                      onClick={() => { haptic("tap"); setActiveDraft(d); setView("draft"); }}
                      className="flex-1 min-w-0 flex items-center gap-3 text-right tap press"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="block text-[13.5px] font-medium leading-snug line-clamp-1 flex-1">{d.title}</span>
                          {d.status === "scheduled" && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-600">زمان‌بندی</span>
                          )}
                          {d.status === "published" && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-600">منتشر شد</span>
                          )}
                          {d.status !== "scheduled" && d.status !== "published" && d.auto && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] bg-[var(--brand-500)]/15 text-[var(--brand-500)]">در انتظار تأیید</span>
                          )}
                        </span>
                        <span className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--foreground-subtle)]">
                          <Clock className="size-3" />
                          <span className="flex gap-0.5">{platforms.map((p) => <span key={p}>{PLATFORM_META[p]?.emoji}</span>)}</span>
                          <span>·</span>
                          {d.status === "scheduled" && d.scheduledAt
                            ? <span>{new Date(d.scheduledAt).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" })}</span>
                            : <span>{toFa(platforms.length)} پلتفرم</span>}
                        </span>
                      </span>
                      <ChevronLeft className="size-4 text-[var(--foreground-subtle)] shrink-0" />
                    </button>
                    <button onClick={() => removeDraft(d.id)} aria-label="حذف" className="size-9 grid place-items-center rounded-full tap press text-rose-500 active:bg-rose-500/10">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 p-4 pb-[calc(16px+var(--safe-bottom))] bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent">
        <button
          onClick={() => { haptic("tap"); setView("compose"); }}
          className="w-full h-12 rounded-[var(--radius-lg)] bg-[var(--brand-500)] text-white text-[15px] font-semibold tap press flex items-center justify-center gap-2"
        >
          <Send className="size-5 -scale-x-100" />
          ساخت پیش‌نویس جدید
        </button>
      </div>
    </MobileScreen>
  );
}

function SetupCard({ icon, title, sub, done, onClick, badge }: {
  icon: React.ReactNode; title: string; sub: string; done: boolean; onClick: () => void; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="relative rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] p-3.5 text-right tap press flex flex-col gap-2"
    >
      <span className={`size-9 grid place-items-center rounded-full ${done ? "bg-[var(--brand-500)] text-white" : "bg-[var(--background-muted)] text-[var(--foreground-muted)]"}`}>
        {icon}
      </span>
      {badge != null && badge > 0 && (
        <span className="absolute top-2.5 left-2.5 min-w-5 h-5 px-1.5 grid place-items-center rounded-full bg-amber-500 text-white text-[11px] font-semibold">
          {toFa(badge)}
        </span>
      )}
      <span className="text-[13px] font-semibold">{title}</span>
      <span className="text-[11.5px] text-[var(--foreground-subtle)] truncate">{sub}</span>
    </button>
  );
}
