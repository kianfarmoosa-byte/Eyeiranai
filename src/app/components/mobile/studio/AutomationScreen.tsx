import { useEffect, useState } from "react";
import { Plus, Trash2, Check, Zap, Clock, Bell, Play, Loader2, RadioTower, Sun, AlertTriangle, ChevronLeft, RotateCcw } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { useHaptics } from "../hooks";
import { useToast } from "../primitives/Toast";
import { api, type AutomationRule, type ContentTemplate, type PublishPlatform, type AutomationStatus } from "../../../api";
import { studioUserId, INPUT_CLS, PLATFORM_META, PUBLISHABLE } from "./studio";
import { isHeartbeatEnabled, setHeartbeatEnabled } from "../../../useAutomationHeartbeat";
import { toFa, timeAgoFa } from "../utils/fa";

function timeAgo(ts: number): string {
  if (!ts) return "هرگز";
  return timeAgoFa(ts);
}

type Props = { onClose: () => void; onOpenCron?: () => void; onOpenRetries?: () => void };

// The scheduler is "stale" if nothing has ticked for ~20 minutes.
const STALE_MS = 20 * 60 * 1000;

function emptyRule(): AutomationRule {
  return {
    id: "", name: "", enabled: true,
    trigger: { type: "schedule", everyMinutes: 60, keywords: [] },
    sourceCategory: "", templateId: "", platforms: ["telegram"],
    autoPublish: false, digest: false, digestCount: 5, lastRunAt: 0, lastItemKey: "",
  };
}

export function AutomationScreen({ onClose, onOpenCron, onOpenRetries }: Props) {
  const haptic = useHaptics();
  const toast = useToast();
  const uid = studioUserId();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [hb, setHb] = useState(isHeartbeatEnabled());

  const load = async () => {
    try {
      const [r, t, s] = await Promise.all([
        api.studioGetRules(uid),
        api.studioGetTemplates(uid),
        api.studioAutomationStatus().catch(() => null),
      ]);
      setRules(r);
      setTemplates(t);
      setStatus(s);
    } catch (e) {
      console.log("load rules failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleHb = () => {
    haptic("tap");
    const next = !hb;
    setHb(next);
    setHeartbeatEnabled(next);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (rule: AutomationRule) => {
    haptic("select");
    try {
      const next = await api.studioSaveRule(uid, rule);
      setRules(next);
      setEditing(null);
      toast({ kind: "success", message: "قانون ذخیره شد" });
    } catch (e) {
      console.log("save rule failed:", e);
      toast({ kind: "error", message: "ذخیره ناموفق بود" });
    }
  };

  const toggle = async (rule: AutomationRule) => {
    haptic("tap");
    const next = await api.studioSaveRule(uid, { ...rule, enabled: !rule.enabled });
    setRules(next);
  };

  const remove = async (id: string) => {
    haptic("heavy");
    try {
      await api.studioDeleteRule(uid, id);
      setRules((l) => l.filter((r) => r.id !== id));
      toast({ kind: "success", message: "قانون حذف شد" });
    } catch (e) {
      console.log("delete rule failed:", e);
    }
  };

  const runNow = async () => {
    haptic("select");
    setRunning(true);
    try {
      const res = await api.studioRunTick("manual");
      toast({ kind: "success", message: `اجرا شد · ${toFa(res.ran)} قانون پردازش شد` });
      load();
    } catch (e: any) {
      console.log("run tick failed:", e);
      toast({ kind: "error", message: String(e?.message || e).slice(0, 120) });
    } finally {
      setRunning(false);
    }
  };

  if (editing) {
    return <RuleEditor initial={editing} templates={templates} onCancel={() => setEditing(null)} onSave={save} />;
  }

  return (
    <MobileScreen topbar={<MobileTopBar title="اتوماسیون" onBack={onClose} />}>
      <div className="h-full overflow-y-auto scrollbar-none pb-28">
        <div className="px-4 pt-4 flex items-center gap-2 text-[12.5px] text-[var(--foreground-subtle)]">
          <Zap className="size-4 text-[var(--brand-500)]" />
          <span>قوانینی بساز تا flow به‌صورت خودکار از اخبار، محتوا تولید و (در صورت تنظیم) منتشر کند.</span>
        </div>

        {/* On desktop, split into a main column (rules) + a sidebar (status, tools, note). */}
        <div className="md:grid md:grid-cols-[minmax(0,1fr)_340px] md:gap-x-5 md:items-start md:mt-1">

        {/* Scheduler status + in-app heartbeat toggle */}
        <div className="mx-3 mt-3 md:col-start-2 md:mx-0 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] overflow-hidden">
          <button onClick={toggleHb} className="w-full flex items-center gap-3 px-3.5 py-3 tap press text-right">
            <span className={`size-9 rounded-xl grid place-items-center shrink-0 ${hb ? "bg-[var(--brand-500)]/12 text-[var(--brand-500)]" : "bg-[var(--background-muted)] text-[var(--foreground-subtle)]"}`}>
              <RadioTower className="size-[18px]" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-medium">زمان‌بند درون‌برنامه‌ای</span>
              <span className="block text-[11.5px] text-[var(--foreground-subtle)] mt-0.5">
                {hb ? "تا وقتی اپ باز است، هر چند دقیقه قوانین را بررسی و اجرا می‌کند" : "خاموش — فقط با اجرای دستی یا cron بیرونی کار می‌کند"}
              </span>
            </span>
            <span className={`w-11 h-6 rounded-full p-0.5 shrink-0 transition-colors ${hb ? "bg-[var(--brand-500)]" : "bg-[var(--border-strong)]"}`}>
              <span className={`block size-5 rounded-full bg-white transition-transform ${hb ? "-translate-x-5" : ""}`} />
            </span>
          </button>
          <div className="px-3.5 py-2 border-t border-[var(--border-subtle)] flex items-center gap-1.5 text-[11.5px] text-[var(--foreground-subtle)] flex-wrap">
            <Clock className="size-3.5" />
            <span>آخرین اجرا: {status ? timeAgo(status.at) : "—"}</span>
            {status && (status.ran > 0 || (status.scheduledPublished || 0) > 0) && (
              <span className="text-[var(--brand-500)]">· {toFa(status.ran)} قانون{status.scheduledPublished ? ` · ${toFa(status.scheduledPublished)} انتشار زمان‌بندی‌شده` : ""}</span>
            )}
          </div>
          {status && Date.now() - status.at > STALE_MS && (
            <div className="px-3.5 py-2.5 border-t border-amber-500/30 bg-amber-500/8 flex items-start gap-2 text-[11.5px] text-amber-700 leading-relaxed">
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
              <span>مدتی است تیکی اجرا نشده. برای اجرای پایدار ۲۴ ساعته یک cron بیرونی تنظیم کن یا زمان‌بند درون‌برنامه‌ای را روشن نگه‌دار.</span>
            </div>
          )}
        </div>

        {/* Reliability tools: external cron guide + retry queue */}
        {(onOpenCron || onOpenRetries) && (
          <div className="mx-3 mt-3 md:col-start-2 md:mx-0 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
            {onOpenCron && (
              <button onClick={() => { haptic("tap"); onOpenCron(); }} className="w-full flex items-center gap-3 px-3.5 py-3 tap press text-right active:bg-[var(--accent)]">
                <span className="size-9 rounded-xl grid place-items-center shrink-0 bg-[var(--background-muted)] text-[var(--foreground-muted)]">
                  <RadioTower className="size-[18px]" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-medium">زمان‌بند خودکار (Cron)</span>
                  <span className="block text-[11.5px] text-[var(--foreground-subtle)] mt-0.5">راهنمای اتصال cron بیرونی برای اجرای ۲۴ ساعته</span>
                </span>
                <ChevronLeft className="size-4 text-[var(--foreground-subtle)] shrink-0" />
              </button>
            )}
            {onOpenRetries && (
              <button onClick={() => { haptic("tap"); onOpenRetries(); }} className="w-full flex items-center gap-3 px-3.5 py-3 tap press text-right active:bg-[var(--accent)]">
                <span className={`size-9 rounded-xl grid place-items-center shrink-0 ${(status?.retryPending || 0) > 0 ? "bg-amber-500/12 text-amber-600" : "bg-[var(--background-muted)] text-[var(--foreground-muted)]"}`}>
                  <RotateCcw className="size-[18px]" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-medium">صف تلاش مجدد</span>
                  <span className="block text-[11.5px] text-[var(--foreground-subtle)] mt-0.5">انتشارهای ناموفق برای تلاش خودکار مجدد</span>
                </span>
                {(status?.retryPending || 0) > 0 && (
                  <span className="min-w-5 h-5 px-1.5 grid place-items-center rounded-full bg-amber-500 text-white text-[11px] font-semibold shrink-0">{toFa(status!.retryPending!)}</span>
                )}
                <ChevronLeft className="size-4 text-[var(--foreground-subtle)] shrink-0" />
              </button>
            )}
          </div>
        )}

        <div className="md:col-start-1 md:row-start-1">
        {loading ? (
          <div className="px-4 py-10 text-center text-[13px] text-[var(--foreground-subtle)]">در حال بارگذاری…</div>
        ) : rules.length === 0 ? (
          <div className="px-6 py-14 flex flex-col items-center text-center gap-3">
            <div className="size-14 rounded-2xl bg-[var(--background-muted)] grid place-items-center">
              <Zap className="size-6 text-[var(--foreground-subtle)]" />
            </div>
            <div className="text-[14px] font-semibold">هنوز قانونی نساخته‌ای</div>
            <div className="text-[12.5px] text-[var(--foreground-subtle)] max-w-[260px]">
              مثلاً: «هر ۶۰ دقیقه از دستهٔ فناوری، یک پست بساز و در تلگرام منتشر کن».
            </div>
          </div>
        ) : (
          <ul className="mt-4 mx-3 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
            {rules.map((r) => (
              <li key={r.id} className="px-3.5 py-3 flex items-center gap-3">
                <button onClick={() => toggle(r)} aria-label="فعال/غیرفعال" className="shrink-0">
                  <span className={`w-11 h-6 rounded-full p-0.5 block transition-colors ${r.enabled ? "bg-[var(--brand-500)]" : "bg-[var(--border-strong)]"}`}>
                    <span className={`block size-5 rounded-full bg-white transition-transform ${r.enabled ? "-translate-x-5" : ""}`} />
                  </span>
                </button>
                <button onClick={() => { haptic("tap"); setEditing(r); }} className="flex-1 min-w-0 text-right tap press">
                  <span className="block text-[14px] font-medium truncate">{r.name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--foreground-subtle)]">
                    {r.trigger.type === "schedule" ? <Clock className="size-3" /> : r.trigger.type === "daily" ? <Sun className="size-3" /> : <Bell className="size-3" />}
                    <span>{r.trigger.type === "schedule" ? `هر ${toFa(r.trigger.everyMinutes)} دقیقه` : r.trigger.type === "daily" ? `روزانه ${toFa(r.trigger.dailyTime || "08:00")}` : "رخدادمحور"}</span>
                    {r.digest && <><span>·</span><span>خلاصه</span></>}
                    <span>·</span>
                    <span className="flex gap-0.5">{r.platforms.map((p) => <span key={p}>{PLATFORM_META[p]?.emoji}</span>)}</span>
                    {r.autoPublish && <><span>·</span><span className="text-emerald-500">انتشار خودکار</span></>}
                  </span>
                </button>
                <button onClick={() => remove(r.id)} aria-label="حذف" className="size-9 grid place-items-center rounded-full tap press text-rose-500 active:bg-rose-500/10">
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        </div>

        {/* Run now */}
        <div className="px-3 mt-4 md:col-start-1 md:px-0">
          <button
            onClick={runNow}
            disabled={running || rules.length === 0}
            className="w-full h-11 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] text-[14px] tap press flex items-center justify-center gap-2 active:bg-[var(--accent)] disabled:opacity-50"
          >
            {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4 -scale-x-100" />}
            {running ? "در حال اجرا…" : "اجرای دستی همین حالا"}
          </button>
        </div>

        <div className="mx-4 mt-4 md:col-start-2 md:mx-0 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--background-muted)] px-3 py-2.5 text-[11.5px] text-[var(--foreground-subtle)] leading-relaxed flex gap-2">
          <RadioTower className="size-4 shrink-0 mt-0.5" />
          <span>
            زمان‌بند درون‌برنامه‌ای تا وقتی اپ باز است کار می‌کند. برای اجرای کاملاً خودکار و ۲۴ ساعته (حتی وقتی اپ بسته است)، یک زمان‌بند بیرونی (مثل cron-job.org) آدرس <span dir="ltr" className="font-mono">/automation/tick</span> را هر چند دقیقه صدا بزند.
          </span>
        </div>

        </div>{/* /desktop two-column grid */}
      </div>

      <div className="absolute inset-x-0 bottom-0 p-4 pb-[calc(16px+var(--safe-bottom))] bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent">
        <button
          onClick={() => { haptic("tap"); setEditing(emptyRule()); }}
          className="w-full h-12 rounded-[var(--radius-lg)] bg-[var(--brand-500)] text-white text-[15px] font-semibold tap press flex items-center justify-center gap-2"
        >
          <Plus className="size-5" />
          قانون جدید
        </button>
      </div>
    </MobileScreen>
  );
}

function RuleEditor({ initial, templates, onCancel, onSave }: {
  initial: AutomationRule;
  templates: ContentTemplate[];
  onCancel: () => void;
  onSave: (r: AutomationRule) => void;
}) {
  const haptic = useHaptics();
  const [r, setR] = useState<AutomationRule>(initial);
  const [kw, setKw] = useState("");
  const patch = (p: Partial<AutomationRule>) => setR((x) => ({ ...x, ...p }));
  const patchTrigger = (p: Partial<AutomationRule["trigger"]>) => setR((x) => ({ ...x, trigger: { ...x.trigger, ...p } }));

  const togglePlatform = (p: PublishPlatform) => {
    haptic("tap");
    patch({ platforms: r.platforms.includes(p) ? r.platforms.filter((x) => x !== p) : [...r.platforms, p] });
  };

  const addKw = () => {
    const v = kw.trim();
    if (!v) return;
    if (!r.trigger.keywords.includes(v)) patchTrigger({ keywords: [...r.trigger.keywords, v].slice(0, 20) });
    setKw("");
  };

  const canSave = r.name.trim().length > 0 && r.platforms.length > 0
    && (r.trigger.type === "schedule" || r.trigger.type === "daily" || r.trigger.keywords.length > 0);

  return (
    <MobileScreen topbar={<MobileTopBar title={initial.id ? "ویرایش قانون" : "قانون جدید"} onBack={onCancel} />}>
      <div className="h-full overflow-y-auto scrollbar-none pb-28">
        <FieldEl label="نام قانون">
          <input value={r.name} onChange={(e) => patch({ name: e.target.value })} placeholder="مثلاً: پست خودکار فناوری" className={INPUT_CLS} />
        </FieldEl>

        <FieldEl label="نوع تریگر">
          <div className="flex flex-wrap gap-2">
            <TriggerTab on={r.trigger.type === "schedule"} icon={<Clock className="size-4" />} label="زمان‌بندی‌شده" onClick={() => { haptic("tap"); patchTrigger({ type: "schedule" }); }} />
            <TriggerTab on={r.trigger.type === "daily"} icon={<Sun className="size-4" />} label="بولتن روزانه" onClick={() => { haptic("tap"); patchTrigger({ type: "daily" }); patch({ digest: true }); }} />
            <TriggerTab on={r.trigger.type === "event"} icon={<Bell className="size-4" />} label="رخدادمحور" onClick={() => { haptic("tap"); patchTrigger({ type: "event" }); }} />
          </div>
        </FieldEl>

        {r.trigger.type === "schedule" ? (
          <FieldEl label="فاصلهٔ اجرا (دقیقه)">
            <input
              type="number" inputMode="numeric" min={15}
              value={r.trigger.everyMinutes}
              onChange={(e) => patchTrigger({ everyMinutes: Math.max(15, Number(e.target.value) || 60) })}
              className={INPUT_CLS}
            />
            <p className="mt-1 text-[11px] text-[var(--foreground-subtle)]">حداقل ۱۵ دقیقه.</p>
          </FieldEl>
        ) : r.trigger.type === "daily" ? (
          <FieldEl label="ساعت انتشار روزانه (به وقت تهران)">
            <input
              type="time"
              value={r.trigger.dailyTime || "08:00"}
              onChange={(e) => patchTrigger({ dailyTime: e.target.value })}
              className={INPUT_CLS}
            />
            <p className="mt-1 text-[11px] text-[var(--foreground-subtle)]">هر روز یک‌بار در این ساعت، بولتن خبری ساخته و (در صورت تنظیم) منتشر می‌شود.</p>
          </FieldEl>
        ) : (
          <FieldEl label="کلیدواژه‌های رخداد">
            <div className="flex items-center gap-2">
              <input value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKw(); } }} placeholder="کلیدواژه و Enter" className={INPUT_CLS} />
              <button onClick={addKw} className="h-10 px-3 rounded-[var(--radius-md)] bg-[var(--accent)] text-[13px] tap press">افزودن</button>
            </div>
            {r.trigger.keywords.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.trigger.keywords.map((k) => (
                  <button key={k} onClick={() => patchTrigger({ keywords: r.trigger.keywords.filter((x) => x !== k) })} className="px-2 py-0.5 rounded-full text-[12px] bg-[var(--background-muted)] border border-[var(--border-subtle)]">
                    {k} ✕
                  </button>
                ))}
              </div>
            )}
            <p className="mt-1 text-[11px] text-[var(--foreground-subtle)]">وقتی خبری شامل یکی از این کلیدواژه‌ها بیاید، اجرا می‌شود.</p>
          </FieldEl>
        )}

        <FieldEl label="فیلتر دستهٔ منبع (اختیاری)">
          <input value={r.sourceCategory} onChange={(e) => patch({ sourceCategory: e.target.value })} placeholder="مثلاً: فناوری" className={INPUT_CLS} />
        </FieldEl>

        <FieldEl label="قالب">
          <div className="flex flex-wrap gap-2">
            <TplChip label="بدون قالب" on={r.templateId === ""} onClick={() => { haptic("tap"); patch({ templateId: "" }); }} />
            {templates.map((t) => (
              <TplChip key={t.id} label={t.name} on={r.templateId === t.id} onClick={() => { haptic("tap"); patch({ templateId: t.id }); }} />
            ))}
          </div>
        </FieldEl>

        <div className="px-4 mt-4">
          <button onClick={() => { haptic("tap"); patch({ digest: !r.digest }); }} className="w-full flex items-center justify-between rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] px-3.5 py-3 tap press">
            <span className="text-right">
              <span className="block text-[14px]">حالت خلاصهٔ چند خبر</span>
              <span className="block text-[11px] text-[var(--foreground-subtle)] mt-0.5">{r.digest ? "در هر اجرا، چند خبر را در یک پست جمع می‌کند" : "در هر اجرا یک خبر را پردازش می‌کند"}</span>
            </span>
            <span className={`w-11 h-6 rounded-full p-0.5 transition-colors ${r.digest ? "bg-[var(--brand-500)]" : "bg-[var(--border-strong)]"}`}>
              <span className={`block size-5 rounded-full bg-white transition-transform ${r.digest ? "-translate-x-5" : ""}`} />
            </span>
          </button>
          {r.digest && (
            <div className="mt-2">
              <div className="text-[12px] text-[var(--foreground-muted)] mb-1.5">تعداد خبر در هر خلاصه</div>
              <input
                type="number" inputMode="numeric" min={2} max={12}
                value={r.digestCount || 5}
                onChange={(e) => patch({ digestCount: Math.min(12, Math.max(2, Number(e.target.value) || 5)) })}
                className={INPUT_CLS}
              />
            </div>
          )}
        </div>

        <FieldEl label="پلتفرم‌های انتشار">
          <div className="flex flex-wrap gap-2">
            {PUBLISHABLE.map((p) => {
              const on = r.platforms.includes(p);
              return (
                <button key={p} onClick={() => togglePlatform(p)} className={`px-3 py-1.5 rounded-full text-[12.5px] border tap press flex items-center gap-1 ${on ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]" : "border-[var(--border-subtle)] text-[var(--foreground-muted)]"}`}>
                  <span>{PLATFORM_META[p].emoji}</span>{PLATFORM_META[p].label}
                </button>
              );
            })}
          </div>
        </FieldEl>

        <div className="px-4 mt-4">
          <button onClick={() => { haptic("tap"); patch({ autoPublish: !r.autoPublish }); }} className="w-full flex items-center justify-between rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] px-3.5 py-3 tap press">
            <span className="text-right">
              <span className="block text-[14px]">انتشار خودکار</span>
              <span className="block text-[11px] text-[var(--foreground-subtle)] mt-0.5">{r.autoPublish ? "بلافاصله منتشر می‌شود" : "فقط پیش‌نویس ساخته می‌شود"}</span>
            </span>
            <span className={`w-11 h-6 rounded-full p-0.5 transition-colors ${r.autoPublish ? "bg-[var(--brand-500)]" : "bg-[var(--border-strong)]"}`}>
              <span className={`block size-5 rounded-full bg-white transition-transform ${r.autoPublish ? "-translate-x-5" : ""}`} />
            </span>
          </button>
          {r.autoPublish && (
            <p className="mt-1.5 text-[11px] text-[var(--foreground-subtle)] leading-relaxed">برای انتشار خودکار، حساب‌های انتخاب‌شده باید در بخش «اتصال حساب‌ها» متصل باشند.</p>
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-4 pb-[calc(16px+var(--safe-bottom))] bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent">
        <button onClick={() => canSave && onSave(r)} disabled={!canSave} className="w-full h-12 rounded-[var(--radius-lg)] bg-[var(--brand-500)] text-white text-[15px] font-semibold tap press flex items-center justify-center gap-2 disabled:opacity-50">
          <Check className="size-5" />
          ذخیرهٔ قانون
        </button>
      </div>
    </MobileScreen>
  );
}

function FieldEl({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 mt-4">
      <div className="text-[12.5px] font-medium text-[var(--foreground-muted)] mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function TriggerTab({ on, icon, label, onClick }: { on: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex-1 h-11 rounded-[var(--radius-md)] border tap press flex items-center justify-center gap-2 text-[13px] ${on ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]" : "border-[var(--border-subtle)] text-[var(--foreground-muted)]"}`}>
      {icon}{label}
    </button>
  );
}

function TplChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-full text-[12.5px] border tap press ${on ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]" : "border-[var(--border-subtle)] text-[var(--foreground-muted)]"}`}>
      {label}
    </button>
  );
}
