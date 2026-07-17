import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Clock, Zap, Bell, Sun, RefreshCw, Send, FileClock, CalendarX, Loader2, CalendarCog, Check, X } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { useHaptics } from "../hooks";
import { useToast } from "../primitives/Toast";
import { api, type AutomationRule, type Draft, type StudioPlatform, type PublishPlatform } from "../../../api";
import { studioUserId, PLATFORM_META, isPublishable } from "./studio";
import { toFa } from "../utils/fa";

type Props = { onClose: () => void; onOpenDraft?: (d: Draft) => void };

const OFFSET = 3.5 * 3600 * 1000; // Tehran = UTC+3:30 (matches the server's gating)
const DAY = 24 * 3600 * 1000;

// Next scheduled run for a rule, mirroring the server's runRule() gating.
// Returns epoch ms, or null for event-driven rules (no fixed time).
function nextRunAt(rule: AutomationRule): number | null {
  const now = Date.now();
  if (rule.trigger.type === "schedule") {
    return (rule.lastRunAt || 0) + Math.max(15, rule.trigger.everyMinutes || 60) * 60000;
  }
  if (rule.trigger.type === "daily") {
    const [hh, mm] = (rule.trigger.dailyTime || "08:00").split(":").map(Number);
    const teh = new Date(now + OFFSET);
    // Tehran wall-clock target today, expressed back as a real epoch.
    const todayTargetTeh = Date.UTC(teh.getUTCFullYear(), teh.getUTCMonth(), teh.getUTCDate(), hh || 0, mm || 0);
    let target = todayTargetTeh - OFFSET;
    const dayKey = teh.toISOString().slice(0, 10);
    const lastDayKey = new Date((rule.lastRunAt || 0) + OFFSET).toISOString().slice(0, 10);
    const ranToday = lastDayKey === dayKey;
    if (ranToday || target + DAY <= now) target += DAY; // already ran, or far past → tomorrow
    return target;
  }
  return null; // event-driven
}

// "۱۲ دقیقه دیگر" / "اکنون" / "۳ ساعت دیگر"
function untilFa(ts: number): string {
  const diff = ts - Date.now();
  if (diff <= 30 * 1000) return "اکنون";
  const m = Math.round(diff / 60000);
  if (m < 60) return `${toFa(m)} دقیقه دیگر`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return rm ? `${toFa(h)} ساعت و ${toFa(rm)} دقیقه دیگر` : `${toFa(h)} ساعت دیگر`;
  return `${toFa(Math.floor(h / 24))} روز دیگر`;
}

function whenFa(ts: number): string {
  return new Date(ts).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" });
}

// Epoch ms → "YYYY-MM-DDTHH:mm" in local time for <input type="datetime-local">.
function toLocalInput(ts: number): string {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

function triggerLabel(r: AutomationRule): string {
  if (r.trigger.type === "schedule") return `هر ${toFa(r.trigger.everyMinutes)} دقیقه`;
  if (r.trigger.type === "daily") return `روزانه ${toFa(r.trigger.dailyTime || "08:00")}`;
  return "رخدادمحور";
}

function draftTargets(d: Draft): PublishPlatform[] {
  const raw = d.scheduleTargets?.length ? d.scheduleTargets : (Object.keys(d.outputs || {}) as StudioPlatform[]);
  return raw.filter(isPublishable);
}

function fullText(o?: { text: string; hashtags: string[] }): string {
  if (!o?.text) return "";
  return o.hashtags?.length ? `${o.text}\n\n${o.hashtags.map((h) => `#${h}`).join(" ")}` : o.text;
}

export function QueueScreen({ onClose, onOpenDraft }: Props) {
  const haptic = useHaptics();
  const toast = useToast();
  const uid = studioUserId();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>(""); // draft id currently publishing/cancelling
  const [editId, setEditId] = useState<string>(""); // draft id whose time is being edited
  const [editVal, setEditVal] = useState<string>("");
  const [platFilter, setPlatFilter] = useState<PublishPlatform | "all">("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [, force] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const [r, d] = await Promise.all([api.studioGetRules(uid), api.studioGetDrafts(uid)]);
      setRules(r);
      setDrafts(d);
    } catch (e) {
      console.log("load queue failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Keep countdowns fresh.
  useEffect(() => { const t = setInterval(() => force((x) => x + 1), 30000); return () => clearInterval(t); }, []);

  const upcoming = useMemo(() => {
    return rules
      .filter((r) => r.enabled)
      .map((r) => ({ rule: r, at: nextRunAt(r) }))
      .sort((a, b) => {
        if (a.at == null) return 1;
        if (b.at == null) return -1;
        return a.at - b.at;
      });
  }, [rules]);

  const scheduled = useMemo(() => {
    return drafts
      .filter((d) => d.status === "scheduled" && d.scheduledAt)
      .sort((a, b) => (a.scheduledAt || 0) - (b.scheduledAt || 0));
  }, [drafts]);

  // Platforms actually present across scheduled drafts, for the filter chips.
  const platOptions = useMemo(() => {
    const set = new Set<PublishPlatform>();
    for (const d of scheduled) draftTargets(d).forEach((p) => set.add(p));
    return Array.from(set);
  }, [scheduled]);

  const filteredScheduled = useMemo(() => {
    return scheduled.filter((d) => {
      if (overdueOnly && (d.scheduledAt || 0) > Date.now()) return false;
      if (platFilter !== "all" && !draftTargets(d).includes(platFilter)) return false;
      return true;
    });
  }, [scheduled, platFilter, overdueOnly]);

  const overdueCount = useMemo(() => scheduled.filter((d) => (d.scheduledAt || 0) <= Date.now()).length, [scheduled]);

  const chipCls = (active: boolean) =>
    `h-8 px-3 rounded-full text-[12.5px] font-medium tap press whitespace-nowrap border transition-colors ${
      active
        ? "bg-[var(--brand-600)] text-white border-transparent"
        : "bg-[var(--surface)] text-[var(--foreground-muted)] border-[var(--border-subtle)]"
    }`;

  // Revert a scheduled draft back to a normal draft (removes it from the queue).
  const cancelSchedule = async (d: Draft) => {
    haptic("heavy");
    setBusy(d.id);
    try {
      const saved = await api.studioSaveDraft(uid, { ...d, status: "draft", scheduledAt: undefined, scheduleTargets: undefined });
      setDrafts((l) => l.map((x) => (x.id === d.id ? saved : x)));
      toast({ kind: "success", message: "زمان‌بندی لغو شد — به پیش‌نویس‌ها برگشت" });
    } catch (e) {
      console.log("cancel schedule failed:", e);
      toast({ kind: "error", message: "لغو زمان‌بندی ناموفق بود" });
    } finally {
      setBusy("");
    }
  };

  // Publish a scheduled draft right now to its scheduled targets, then mark it published.
  const publishNow = async (d: Draft) => {
    const targets = draftTargets(d);
    if (targets.length === 0) { toast({ kind: "warn", message: "هیچ پلتفرم قابل‌انتشاری در این پیش‌نویس نیست" }); return; }
    haptic("select");
    setBusy(d.id);
    let ok = 0; const fails: string[] = [];
    for (const p of targets) {
      const o = d.outputs?.[p];
      if (!o?.text) continue;
      try {
        await api.studioPublish(uid, {
          platform: p,
          text: fullText(o),
          title: d.sourceTitle,
          link: d.sourceLink,
          imageUrl: d.image || undefined,
          imageUrls: (d.images && d.images.length > 1) ? d.images : undefined,
        });
        ok++;
      } catch (e: any) {
        console.log(`publishNow ${p} failed:`, e);
        fails.push(PLATFORM_META[p].label);
      }
    }
    try {
      if (ok > 0) {
        const saved = await api.studioSaveDraft(uid, { ...d, status: "published", scheduledAt: undefined, scheduleTargets: undefined });
        setDrafts((l) => l.map((x) => (x.id === d.id ? saved : x)));
      }
    } catch (e) { console.log("mark published failed:", e); }
    toast({
      kind: fails.length ? "warn" : "success",
      message: fails.length ? `${ok} موفق · ناموفق: ${fails.join("، ")}` : `در ${ok} کانال منتشر شد`,
    });
    setBusy("");
  };

  const startEdit = (d: Draft) => {
    haptic("tap");
    setEditId(d.id);
    setEditVal(toLocalInput(d.scheduledAt || Date.now() + 3600000));
  };

  const saveTime = async (d: Draft) => {
    const ts = editVal ? new Date(editVal).getTime() : 0;
    if (!ts || ts < Date.now()) { toast({ kind: "warn", message: "زمان معتبر در آینده انتخاب کن" }); return; }
    haptic("select");
    setBusy(d.id);
    try {
      const saved = await api.studioSaveDraft(uid, { ...d, status: "scheduled", scheduledAt: ts });
      setDrafts((l) => l.map((x) => (x.id === d.id ? saved : x)));
      setEditId("");
      toast({ kind: "success", message: "زمان به‌روزرسانی شد" });
    } catch (e) {
      console.log("reschedule failed:", e);
      toast({ kind: "error", message: "به‌روزرسانی زمان ناموفق بود" });
    } finally {
      setBusy("");
    }
  };

  const empty = !loading && upcoming.length === 0 && scheduled.length === 0;

  return (
    <MobileScreen
      topbar={<MobileTopBar title="صف زمان‌بندی" onBack={onClose} trailing={
        <button onClick={() => { haptic("tap"); load(); }} aria-label="بروزرسانی" className="size-10 grid place-items-center rounded-full tap press active:bg-[var(--accent)]">
          <RefreshCw className={`size-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      } />}
    >
      <div className="h-full overflow-y-auto scrollbar-none pb-10">
        {loading && rules.length === 0 && drafts.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-[var(--foreground-subtle)]">در حال بارگذاری…</div>
        ) : empty ? (
          <div className="px-6 py-16 flex flex-col items-center text-center gap-3">
            <div className="size-14 rounded-2xl bg-[var(--background-muted)] grid place-items-center">
              <CalendarClock className="size-6 text-[var(--foreground-subtle)]" />
            </div>
            <div className="text-[14px] font-semibold">صف خالی است</div>
            <div className="text-[12.5px] text-[var(--foreground-subtle)] max-w-[260px]">
              وقتی قانون اتوماسیون فعال کنی یا پیش‌نویسی را زمان‌بندی کنی، موعد بعدی‌شان اینجا نمایش داده می‌شود.
            </div>
          </div>
        ) : (
          <>
            {/* Scheduled drafts awaiting publish */}
            <SectionHead icon={<FileClock className="size-4" />} title="پیش‌نویس‌های زمان‌بندی‌شده" count={scheduled.length} />
            {scheduled.length === 0 ? (
              <EmptyRow text="پیش‌نویس زمان‌بندی‌شده‌ای نداری." />
            ) : (
              <>
                {(platOptions.length > 1 || overdueCount > 0) && (
                  <div className="mx-3 mb-2 flex items-center gap-2 overflow-x-auto scrollbar-none">
                    <button onClick={() => { haptic("tap"); setPlatFilter("all"); }} className={chipCls(platFilter === "all")}>همه</button>
                    {platOptions.map((p) => (
                      <button key={p} onClick={() => { haptic("tap"); setPlatFilter(p); }} className={`${chipCls(platFilter === p)} inline-flex items-center gap-1`}>
                        <span>{PLATFORM_META[p]?.emoji}</span>{PLATFORM_META[p]?.label}
                      </button>
                    ))}
                    {overdueCount > 0 && (
                      <>
                        <span className="w-px h-5 bg-[var(--border-subtle)] shrink-0" />
                        <button onClick={() => { haptic("tap"); setOverdueOnly((v) => !v); }} className={`${chipCls(overdueOnly)} inline-flex items-center gap-1`}>
                          <Clock className="size-3.5" />
                          فقط سررسیدشده ({toFa(overdueCount)})
                        </button>
                      </>
                    )}
                  </div>
                )}
                {filteredScheduled.length === 0 ? (
                  <EmptyRow text="موردی با این فیلتر نیست." />
                ) : (
              <ul className="mx-3 space-y-2">
                {filteredScheduled.map((d) => {
                  const targets = (d.scheduleTargets?.length ? d.scheduleTargets : (Object.keys(d.outputs || {}) as StudioPlatform[]));
                  const overdue = (d.scheduledAt || 0) <= Date.now();
                  const isBusy = busy === d.id;
                  return (
                    <li key={d.id} className="rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] overflow-hidden">
                      <button
                        onClick={() => { haptic("tap"); onOpenDraft?.(d); }}
                        className="w-full text-right px-3.5 py-3 tap press flex items-start gap-3"
                      >
                        <span className={`size-9 grid place-items-center rounded-xl shrink-0 ${overdue ? "bg-amber-500/15 text-amber-600" : "bg-[var(--brand-500)]/12 text-[var(--brand-500)]"}`}>
                          <Send className="size-4 -scale-x-100" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13.5px] font-medium leading-snug line-clamp-1">{d.title}</span>
                          <span className="mt-1 flex items-center gap-1.5 text-[11.5px] flex-wrap">
                            <Clock className="size-3 text-[var(--foreground-subtle)]" />
                            <span className={overdue ? "text-amber-600 font-medium" : "text-[var(--foreground-muted)]"}>
                              {overdue ? "سررسید — در اجرای بعدی منتشر می‌شود" : untilFa(d.scheduledAt!)}
                            </span>
                            <span className="text-[var(--foreground-subtle)]">· {whenFa(d.scheduledAt!)}</span>
                          </span>
                          <span className="mt-1.5 flex items-center gap-1 text-[12px]">
                            {targets.map((p) => (
                              <span key={p} className="inline-flex items-center gap-0.5 text-[var(--foreground-subtle)]">
                                <span>{PLATFORM_META[p as keyof typeof PLATFORM_META]?.emoji}</span>
                              </span>
                            ))}
                          </span>
                        </span>
                      </button>
                      {editId === d.id ? (
                        <div className="flex items-center gap-2 border-t border-[var(--border-subtle)] px-3 py-2.5">
                          <input
                            type="datetime-local"
                            value={editVal}
                            min={toLocalInput(Date.now())}
                            onChange={(e) => setEditVal(e.target.value)}
                            className="flex-1 min-w-0 h-9 rounded-[var(--radius-md)] bg-[var(--input-background)] border border-[var(--border-subtle)] px-2.5 text-[12.5px] outline-none focus:border-[var(--brand-500)]"
                          />
                          <button onClick={() => saveTime(d)} disabled={isBusy} aria-label="ذخیره" className="size-9 grid place-items-center rounded-[var(--radius-md)] bg-[var(--brand-500)] text-white tap press disabled:opacity-50">
                            {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                          </button>
                          <button onClick={() => setEditId("")} aria-label="انصراف" className="size-9 grid place-items-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] tap press">
                            <X className="size-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-stretch border-t border-[var(--border-subtle)] divide-x divide-x-reverse divide-[var(--border-subtle)]">
                          <button
                            onClick={() => publishNow(d)}
                            disabled={isBusy}
                            className="flex-1 h-10 flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-[var(--brand-600)] tap press active:bg-[var(--accent)] disabled:opacity-50"
                          >
                            {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 -scale-x-100" />}
                            انتشار فوری
                          </button>
                          <button
                            onClick={() => startEdit(d)}
                            disabled={isBusy}
                            className="flex-1 h-10 flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-[var(--foreground-muted)] tap press active:bg-[var(--accent)] disabled:opacity-50"
                          >
                            <CalendarCog className="size-4" />
                            تغییر زمان
                          </button>
                          <button
                            onClick={() => cancelSchedule(d)}
                            disabled={isBusy}
                            className="flex-1 h-10 flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-rose-500 tap press active:bg-rose-500/10 disabled:opacity-50"
                          >
                            <CalendarX className="size-4" />
                            لغو
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
                )}
              </>
            )}

            {/* Upcoming rule runs */}
            <div className="mt-6">
              <SectionHead icon={<Zap className="size-4" />} title="موعد بعدی قوانین" count={upcoming.length} />
              {upcoming.length === 0 ? (
                <EmptyRow text="قانون فعالی نداری." />
              ) : (
                <ul className="mx-3 space-y-2">
                  {upcoming.map(({ rule, at }) => {
                    const overdue = at != null && at <= Date.now();
                    const TIcon = rule.trigger.type === "daily" ? Sun : rule.trigger.type === "event" ? Bell : Clock;
                    return (
                      <li key={rule.id} className="rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] px-3.5 py-3 flex items-start gap-3">
                        <span className="size-9 grid place-items-center rounded-xl shrink-0 bg-[var(--background-muted)] text-[var(--foreground-muted)]">
                          <TIcon className="size-4" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13.5px] font-medium truncate">{rule.name}</div>
                          <div className="mt-1 flex items-center gap-1.5 text-[11.5px] flex-wrap">
                            <span className="text-[var(--foreground-subtle)]">{triggerLabel(rule)}</span>
                            <span className="text-[var(--foreground-subtle)]">·</span>
                            <span className="flex gap-0.5">{rule.platforms.map((p) => <span key={p}>{PLATFORM_META[p]?.emoji}</span>)}</span>
                            {rule.autoPublish && <span className="text-emerald-500">· انتشار خودکار</span>}
                          </div>
                          <div className="mt-1 text-[12px]">
                            {at == null ? (
                              <span className="text-[var(--foreground-subtle)]">هنگام رسیدن خبر مرتبط اجرا می‌شود</span>
                            ) : overdue ? (
                              <span className="text-[var(--brand-500)] font-medium">آمادهٔ اجرا در تیک بعدی</span>
                            ) : (
                              <span className="text-[var(--foreground-muted)]">
                                <span className="text-[var(--brand-500)] font-medium">{untilFa(at)}</span>
                                <span className="text-[var(--foreground-subtle)]"> · {whenFa(at)}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mx-4 mt-5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--background-muted)] px-3 py-2.5 text-[11.5px] text-[var(--foreground-subtle)] leading-relaxed flex gap-2">
              <CalendarClock className="size-4 shrink-0 mt-0.5" />
              <span>موعدها تقریبی‌اند و توسط زمان‌بند (درون‌برنامه‌ای یا cron بیرونی) در نزدیک‌ترین تیک اجرا می‌شوند.</span>
            </div>
          </>
        )}
      </div>
    </MobileScreen>
  );
}

function SectionHead({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
  return (
    <div className="px-4 pt-4 pb-2 flex items-center gap-2">
      <span className="text-[var(--brand-500)]">{icon}</span>
      <span className="text-[13px] font-semibold">{title}</span>
      {count > 0 && <span className="text-[11.5px] text-[var(--foreground-subtle)]">({toFa(count)})</span>}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="mx-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-subtle)] px-3.5 py-4 text-[12.5px] text-[var(--foreground-subtle)] text-center">{text}</div>;
}
