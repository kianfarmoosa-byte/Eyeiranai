import { useEffect, useState } from "react";
import {
  X, Palette, FileText, Link2, Wand2, Zap, Activity, BarChart3, Send, Clock, Trash2,
  Sparkles, LayoutGrid, Plus, CheckCircle2, ArrowRight, CalendarClock,
} from "lucide-react";
import { ToastProvider } from "../primitives/Toast";
import { api, type Draft, type BrandProfile, type StudioPlatform } from "../../../api";
import type { Article } from "../../../data";
import { studioUserId, PLATFORM_META, PUBLISHABLE } from "./studio";
import { BrandProfileScreen } from "./BrandProfileScreen";
import { TemplatesScreen } from "./TemplatesScreen";
import { ConnectionsScreen } from "./ConnectionsScreen";
import { ComposeScreen } from "./ComposeScreen";
import { DraftEditorScreen } from "./DraftEditorScreen";
import { AutomationScreen } from "./AutomationScreen";
import { ActivityScreen } from "./ActivityScreen";
import { AnalyticsScreen } from "./AnalyticsScreen";
import { QueueScreen } from "./QueueScreen";
import { CronSetupScreen } from "./CronSetupScreen";
import { RetryQueueScreen } from "./RetryQueueScreen";
import { toFa } from "../utils/fa";

type View = "hub" | "brand" | "templates" | "compose" | "draft" | "connections" | "automation" | "activity" | "analytics" | "queue" | "cron" | "retries";

type Props = { articles: Article[]; onClose: () => void };

type NavItem = { id: View; label: string; icon: React.ComponentType<{ className?: string }>; desc: string };

const NAV: NavItem[] = [
  { id: "hub", label: "داشبورد", icon: LayoutGrid, desc: "نمای کلی و پیش‌نویس‌ها" },
  { id: "compose", label: "ساخت محتوا", icon: Send, desc: "تولید از خبرها با هوش مصنوعی" },
  { id: "brand", label: "پروفایل برند", icon: Palette, desc: "نام، لحن، لوگو" },
  { id: "templates", label: "قالب‌ها", icon: FileText, desc: "الگوهای متن و کارت خبری" },
  { id: "connections", label: "اتصال حساب‌ها", icon: Link2, desc: "تلگرام، بله، روبیکا، ..." },
  { id: "automation", label: "اتوماسیون", icon: Zap, desc: "قوانین زمان‌بندی و رخداد" },
  { id: "queue", label: "صف زمان‌بندی", icon: CalendarClock, desc: "موعد بعدی و پیش‌نویس‌ها" },
  { id: "activity", label: "فعالیت", icon: Activity, desc: "گزارش انتشار و خودکارها" },
  { id: "analytics", label: "آمار", icon: BarChart3, desc: "داشبورد تحلیلی انتشار" },
];

/**
 * Full desktop workspace for the Content Studio. Reuses every functional
 * mobile sub-screen (all backed by the shared server API) but presents them
 * in a proper desktop layout: a persistent left rail + wide content panels.
 * Wrapped in ToastProvider so the reused screens work outside the mobile shell.
 */
export function DesktopStudio(props: Props) {
  return (
    <ToastProvider>
      <DesktopStudioInner {...props} />
    </ToastProvider>
  );
}

function DesktopStudioInner({ articles, onClose }: Props) {
  const uid = studioUserId();
  const [view, setView] = useState<View>("hub");
  const [activeDraft, setActiveDraft] = useState<Draft | null>(null);

  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [tplCount, setTplCount] = useState(0);
  const [connCount, setConnCount] = useState(0);
  const [ruleCount, setRuleCount] = useState(0);
  const [retryPending, setRetryPending] = useState(0);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const [b, t, d, c, r, s] = await Promise.all([
        api.studioGetBrand(uid), api.studioGetTemplates(uid), api.studioGetDrafts(uid),
        api.studioGetConnections(uid), api.studioGetRules(uid),
        api.studioAutomationStatus().catch(() => null),
      ]);
      setBrand(b); setTplCount(t.length); setDrafts(d);
      setConnCount(PUBLISHABLE.filter((p) => c[p]?.connected).length);
      setRuleCount(r.filter((x) => x.enabled).length);
      setRetryPending(s?.retryPending || 0);
    } catch (e) {
      console.log("desktop studio load failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Re-sync counters/drafts whenever we return to the dashboard.
  useEffect(() => { if (view === "hub") refresh(); }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  // Desktop keyboard affordance: Esc steps back to the dashboard, or closes
  // the studio when already on the dashboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (view === "hub") onClose();
      else setView("hub");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, onClose]);

  const goHub = () => setView("hub");
  const openDraft = (d: Draft) => { setActiveDraft(d); setView("draft"); };

  // The reused sub-screens hide their own top bar on desktop (md:hidden), so
  // we give each panel a desktop header and render the screen inside a column.
  const meta = NAV.find((n) => n.id === view) ?? (view === "draft" ? { label: "ویرایش پیش‌نویس", desc: activeDraft?.title || "" } : NAV[0]);

  let panel: React.ReactNode = null;
  if (view === "hub") {
    panel = (
      <Dashboard
        brand={brand} tplCount={tplCount} connCount={connCount} ruleCount={ruleCount}
        retryPending={retryPending}
        drafts={drafts} loading={loading}
        onNav={setView}
        onOpenDraft={openDraft}
        onDeleteDraft={async (id) => { try { await api.studioDeleteDraft(uid, id); setDrafts((l) => l.filter((x) => x.id !== id)); } catch (e) { console.log(e); } }}
      />
    );
  } else if (view === "brand") panel = <Column full><BrandProfileScreen onClose={goHub} /></Column>;
  else if (view === "templates") panel = <Column><TemplatesScreen onClose={goHub} /></Column>;
  else if (view === "connections") panel = <Column wide><ConnectionsScreen onClose={goHub} /></Column>;
  else if (view === "compose") panel = <Column full><ComposeScreen articles={articles} onClose={goHub} onCreated={openDraft} /></Column>;
  else if (view === "automation") panel = <Column wide><AutomationScreen onClose={goHub} onOpenCron={() => setView("cron")} onOpenRetries={() => setView("retries")} /></Column>;
  else if (view === "cron") panel = <Column wide><CronSetupScreen onClose={() => setView("automation")} /></Column>;
  else if (view === "retries") panel = <Column wide><RetryQueueScreen onClose={() => setView("automation")} /></Column>;
  else if (view === "queue") panel = <Column wide><QueueScreen onClose={goHub} onOpenDraft={openDraft} /></Column>;
  else if (view === "activity") panel = <Column wide><ActivityScreen onClose={goHub} /></Column>;
  else if (view === "analytics") panel = <Column full><AnalyticsScreen onClose={goHub} /></Column>;
  else if (view === "draft" && activeDraft) {
    panel = (
      <Column full>
        <DraftEditorScreen
          draft={activeDraft}
          onClose={goHub}
          onSaved={(d) => setActiveDraft(d)}
          onOpenConnections={() => setView("connections")}
        />
      </Column>
    );
  }

  return (
    <div dir="rtl" className="fixed inset-0 z-[60] bg-[var(--background)] flex">
      {/* Left rail */}
      <aside className="w-64 shrink-0 h-full border-l border-[var(--border-subtle)] bg-[var(--background-subtle)] flex flex-col">
        <div className="flex items-center gap-2.5 px-4 h-16 shrink-0 border-b border-[var(--border-subtle)]">
          <span className="size-9 grid place-items-center rounded-xl bg-gradient-to-br from-[var(--brand-500)] to-[var(--brand-700)] text-white"><Wand2 className="size-[18px]" /></span>
          <div className="min-w-0">
            <div className="text-[14px] font-bold leading-tight">استودیوی محتوا</div>
            <div className="text-[11px] text-[var(--foreground-subtle)] truncate">تولید و انتشار خودکار</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {NAV.map((n) => {
            const active = view === n.id || (view === "draft" && n.id === "hub");
            const Icon = n.icon;
            return (
              <button
                key={n.id}
                onClick={() => setView(n.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-right transition-colors ${
                  active ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "hover:bg-[var(--background-muted)] text-[var(--foreground)]"
                }`}
              >
                <Icon className="size-[18px] shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium leading-tight">{n.label}</span>
                  <span className={`block text-[10.5px] truncate ${active ? "opacity-80" : "text-[var(--foreground-subtle)]"}`}>{n.desc}</span>
                </span>
                {n.id === "automation" && retryPending > 0 && (
                  <span className="min-w-5 h-5 px-1.5 grid place-items-center rounded-full bg-amber-500 text-white text-[11px] font-semibold shrink-0">{toFa(retryPending)}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[var(--border-subtle)]">
          <button
            onClick={() => setView("compose")}
            className="w-full h-10 rounded-[var(--radius-md)] bg-[var(--primary)] text-[var(--primary-foreground)] text-[13px] font-semibold inline-flex items-center justify-center gap-2"
          >
            <Plus className="size-4" /> پیش‌نویس جدید
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col h-full">
        <header className="flex items-center gap-3 px-6 h-16 shrink-0 border-b border-[var(--border-subtle)]">
          {view !== "hub" && (
            <button onClick={goHub} aria-label="بازگشت" className="size-9 grid place-items-center rounded-full hover:bg-[var(--background-muted)]">
              <ArrowRight className="size-5" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[16px] font-bold leading-tight truncate">{meta.label}</div>
            {meta.desc && <div className="text-[11.5px] text-[var(--foreground-subtle)] truncate">{meta.desc}</div>}
          </div>
          <button onClick={onClose} aria-label="بستن" className="size-9 grid place-items-center rounded-full hover:bg-[var(--background-muted)]">
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto studio-desktop-host">
          {panel}
        </div>
      </div>
    </div>
  );
}

/** Centered column that hosts a reused mobile sub-screen on desktop.
    `wide` gives data-heavy panels (connections, automation, activity,
    analytics) a bit more horizontal room. */
function Column({ children, wide, full }: { children: React.ReactNode; wide?: boolean; full?: boolean }) {
  const max = full ? "max-w-[1180px]" : wide ? "max-w-[780px]" : "max-w-[640px]";
  return (
    <div className={`mx-auto ${max} px-4 py-2 relative min-h-full`}>
      {children}
    </div>
  );
}

function Dashboard({
  brand, tplCount, connCount, ruleCount, retryPending, drafts, loading, onNav, onOpenDraft, onDeleteDraft,
}: {
  brand: BrandProfile | null; tplCount: number; connCount: number; ruleCount: number; retryPending: number;
  drafts: Draft[]; loading: boolean;
  onNav: (v: View) => void;
  onOpenDraft: (d: Draft) => void;
  onDeleteDraft: (id: string) => void;
}) {
  const steps = [
    { done: !!brand?.name, label: "پروفایل برند", view: "brand" as View },
    { done: tplCount > 0, label: "ساخت قالب", view: "templates" as View },
    { done: connCount > 0, label: "اتصال حساب", view: "connections" as View },
    { done: ruleCount > 0, label: "قانون اتوماسیون", view: "automation" as View },
  ];

  return (
    <div className="mx-auto max-w-[960px] px-6 py-6">
      {/* Hero */}
      <div className="rounded-[var(--radius-xl)] bg-gradient-to-br from-[var(--brand-500)] to-[var(--brand-700)] text-white p-6 relative overflow-hidden">
        <div className="absolute -bottom-12 -left-12 size-48 rounded-full bg-white/10" />
        <div className="flex items-center gap-2 mb-1.5">
          <Sparkles className="size-5" />
          <span className="text-[17px] font-bold">تولید محتوا با هوش مصنوعی</span>
        </div>
        <p className="text-[13.5px] leading-relaxed text-white/85 max-w-[560px]">
          خبرها را به محتوای آمادهٔ انتشار برای شبکه‌های اجتماعی و سایت خبری‌ات تبدیل کن — با لحن و برند اختصاصی خودت، همراه با زمان‌بندی و انتشار خودکار در کانال‌ها.
        </p>
        <button
          onClick={() => onNav("compose")}
          className="mt-4 h-10 px-4 rounded-[var(--radius-lg)] bg-white text-[var(--brand-700)] text-[14px] font-semibold inline-flex items-center gap-2"
        >
          <Send className="size-4 -scale-x-100" /> ساخت پیش‌نویس جدید
        </button>
      </div>

      {/* Setup checklist */}
      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        {steps.map((s) => (
          <button
            key={s.label}
            onClick={() => onNav(s.view)}
            className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)] p-4 text-right flex items-center gap-3 hover:border-[var(--brand-500)] transition-colors"
          >
            <span className={`size-8 grid place-items-center rounded-full shrink-0 ${s.done ? "bg-[var(--brand-500)] text-white" : "bg-[var(--background-muted)] text-[var(--foreground-subtle)]"}`}>
              {s.done ? <CheckCircle2 className="size-[18px]" /> : <Plus className="size-4" />}
            </span>
            <span className="text-[13px] font-medium leading-tight">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Quick tiles */}
      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile icon={<CalendarClock className="size-5" />} label="صف زمان‌بندی" onClick={() => onNav("queue")} />
        <Tile icon={<Zap className="size-5" />} label="اتوماسیون" sub={retryPending > 0 ? `${toFa(retryPending)} در صف تلاش مجدد` : ruleCount > 0 ? `${toFa(ruleCount)} فعال` : undefined} badge={retryPending} onClick={() => onNav("automation")} />
        <Tile icon={<Activity className="size-5" />} label="فعالیت و انتشارها" onClick={() => onNav("activity")} />
        <Tile icon={<BarChart3 className="size-5" />} label="آمار انتشار" onClick={() => onNav("analytics")} />
        <Tile icon={<Link2 className="size-5" />} label="اتصال‌ها" sub={connCount > 0 ? `${toFa(connCount)} حساب` : undefined} onClick={() => onNav("connections")} />
      </div>

      {/* Drafts */}
      <div className="mt-8 mb-2 flex items-center justify-between">
        <span className="text-[15px] font-semibold">پیش‌نویس‌ها</span>
        {drafts.length > 0 && <span className="text-[12px] text-[var(--foreground-subtle)]">{toFa(drafts.length)} مورد</span>}
      </div>
      {loading ? (
        <div className="py-10 text-center text-[13px] text-[var(--foreground-subtle)]">در حال بارگذاری…</div>
      ) : drafts.length === 0 ? (
        <div className="py-12 text-center text-[13px] text-[var(--foreground-subtle)] rounded-[var(--radius-lg)] border border-dashed border-[var(--border-subtle)]">
          هنوز پیش‌نویسی ساخته نشده است. از «ساخت محتوا» شروع کن.
        </div>
      ) : (
        <ul className="grid md:grid-cols-2 gap-3">
          {drafts.map((d) => {
            const platforms = Object.keys(d.outputs) as StudioPlatform[];
            return (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)]">
                <button onClick={() => onOpenDraft(d)} className="flex-1 min-w-0 text-right">
                  <span className="flex items-center gap-2">
                    <span className="block text-[13.5px] font-medium leading-snug line-clamp-1 flex-1">{d.title}</span>
                    {d.status === "scheduled" && <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-600">زمان‌بندی</span>}
                    {d.status === "published" && <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-600">منتشر شد</span>}
                    {d.status !== "scheduled" && d.status !== "published" && d.auto && <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] bg-[var(--brand-500)]/15 text-[var(--brand-600)]">در انتظار تأیید</span>}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--foreground-subtle)]">
                    <Clock className="size-3" />
                    <span className="flex gap-0.5">{platforms.map((p) => <span key={p}>{PLATFORM_META[p]?.emoji}</span>)}</span>
                    <span>·</span>
                    {d.status === "scheduled" && d.scheduledAt
                      ? <span>{new Date(d.scheduledAt).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" })}</span>
                      : <span>{toFa(platforms.length)} پلتفرم</span>}
                  </span>
                </button>
                <button onClick={() => onDeleteDraft(d.id)} aria-label="حذف" className="size-9 grid place-items-center rounded-full text-rose-500 hover:bg-rose-500/10">
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Tile({ icon, label, sub, badge, onClick }: { icon: React.ReactNode; label: string; sub?: string; badge?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="relative rounded-[var(--radius-lg)] bg-[var(--card)] border border-[var(--border-subtle)] p-4 text-right flex flex-col gap-2 hover:border-[var(--brand-500)] transition-colors">
      {!!badge && badge > 0 && (
        <span className="absolute top-2.5 left-2.5 min-w-5 h-5 px-1.5 grid place-items-center rounded-full bg-amber-500 text-white text-[11px] font-semibold">{toFa(badge)}</span>
      )}
      <span className="size-9 grid place-items-center rounded-full bg-[var(--background-muted)] text-[var(--foreground-muted)]">{icon}</span>
      <span className="text-[13px] font-semibold">{label}</span>
      {sub && <span className="text-[11px] text-[var(--foreground-subtle)]">{sub}</span>}
    </button>
  );
}
