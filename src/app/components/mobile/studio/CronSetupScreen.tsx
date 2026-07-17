import { useEffect, useState } from "react";
import { RadioTower, Copy, Check, ExternalLink, Clock, Info, ShieldCheck, Zap } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { useHaptics } from "../hooks";
import { useToast } from "../primitives/Toast";
import { api, type AutomationStatus } from "../../../api";
import { isHeartbeatEnabled, setHeartbeatEnabled } from "../../../useAutomationHeartbeat";
import { timeAgoFa } from "../utils/fa";

type Props = { onClose: () => void };

function timeAgo(ts: number): string {
  if (!ts) return "هرگز";
  return timeAgoFa(ts);
}

// A cron is "stale" if the last successful tick is older than ~20 minutes.
const STALE_MS = 20 * 60 * 1000;

function CopyRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const haptic = useHaptics();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    haptic("tap");
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast({ kind: "success", message: "کپی شد" });
    } catch {
      toast({ kind: "error", message: "کپی نشد — دستی انتخاب کن" });
    }
  };
  return (
    <div className="mt-3">
      <div className="text-[12px] font-medium text-[var(--foreground-muted)] mb-1.5">{label}</div>
      <div className="flex items-stretch gap-2">
        <div dir="ltr" className={`flex-1 min-w-0 rounded-[var(--radius-md)] bg-[var(--input-background)] border border-[var(--border-subtle)] px-3 py-2.5 text-[12px] break-all ${mono ? "font-mono" : ""} text-left`}>
          {value}
        </div>
        <button onClick={copy} aria-label="کپی" className="shrink-0 w-11 grid place-items-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface)] tap press active:bg-[var(--accent)]">
          {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
        </button>
      </div>
    </div>
  );
}

export function CronSetupScreen({ onClose }: Props) {
  const haptic = useHaptics();
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [hb, setHb] = useState(isHeartbeatEnabled());

  useEffect(() => {
    api.studioAutomationStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  const toggleHb = () => {
    haptic("tap");
    const next = !hb;
    setHb(next);
    setHeartbeatEnabled(next);
  };

  const stale = status ? Date.now() - status.at > STALE_MS : false;

  return (
    <MobileScreen topbar={<MobileTopBar title="زمان‌بند خودکار (Cron)" onBack={onClose} />}>
      <div className="h-full overflow-y-auto scrollbar-none pb-12">
        {/* Intro */}
        <div className="px-4 pt-4 flex items-start gap-2 text-[12.5px] text-[var(--foreground-muted)] leading-relaxed">
          <RadioTower className="size-4 text-[var(--brand-500)] shrink-0 mt-0.5" />
          <span>
            برای اجرای کاملاً خودکار و ۲۴ ساعته (حتی وقتی اپ بسته است)، کافی است یک سرویس <span className="font-medium">cron</span> بیرونی هر چند دقیقه آدرس زیر را صدا بزند.
          </span>
        </div>

        {/* Live status */}
        <div className={`mx-3 mt-3 rounded-[var(--radius-lg)] border px-3.5 py-3 ${stale ? "border-amber-500/40 bg-amber-500/8" : "border-[var(--border-subtle)] bg-[var(--surface)]"}`}>
          <div className="flex items-center gap-2">
            <Clock className={`size-4 ${stale ? "text-amber-600" : "text-[var(--brand-500)]"}`} />
            <span className="text-[13px] font-medium">وضعیت زمان‌بند</span>
          </div>
          <div className="mt-1.5 text-[12.5px] text-[var(--foreground-muted)]">
            آخرین اجرا: <span className={stale ? "text-amber-600 font-medium" : ""}>{status ? timeAgo(status.at) : "—"}</span>
            {status?.source ? <span className="text-[var(--foreground-subtle)]"> · منبع: {status.source === "app" ? "درون‌برنامه‌ای" : status.source === "manual" ? "دستی" : status.source}</span> : null}
          </div>
          {stale && (
            <div className="mt-2 text-[12px] text-amber-700 leading-relaxed">
              مدتی است تیکی اجرا نشده. اگر cron بیرونی تنظیم کرده‌ای، صحت آدرس و هدر را بررسی کن؛ در غیر این‌صورت زمان‌بند درون‌برنامه‌ای را روشن نگه‌دار.
            </div>
          )}
        </div>

        {/* Endpoint details */}
        <div className="mx-3 mt-4 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] px-3.5 py-3.5">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-[var(--brand-500)]" />
            <span className="text-[13px] font-semibold">مشخصات درخواست</span>
          </div>

          <CopyRow label="آدرس (Method: POST)" value={api.automationTickUrl} />
          <CopyRow label="هدر Authorization" value={api.automationAuthHeader} />

          <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--background-muted)] px-3 py-2.5 text-[11.5px] text-[var(--foreground-subtle)] leading-relaxed flex gap-2">
            <Info className="size-3.5 shrink-0 mt-0.5" />
            <span>
              فاصلهٔ پیشنهادی: هر <span className="font-medium text-[var(--foreground-muted)]">۵ تا ۱۵ دقیقه</span>. اجرای مکرر بی‌خطر است؛ هر قانون طبق فاصلهٔ خودش اجرا می‌شود و بقیهٔ تیک‌ها بی‌اثرند.
            </span>
          </div>
        </div>

        {/* Step-by-step guide */}
        <div className="mx-3 mt-4 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] px-3.5 py-3.5">
          <div className="text-[13px] font-semibold mb-2">راه‌اندازی با cron-job.org (رایگان)</div>
          <ol className="space-y-2 text-[12.5px] text-[var(--foreground-muted)] leading-relaxed list-decimal pr-4">
            <li>در <span className="font-medium">cron-job.org</span> ثبت‌نام کن و «Create cronjob» را بزن.</li>
            <li>آدرس بالا را در فیلد URL بگذار و روش را روی <span dir="ltr" className="font-mono text-[11px]">POST</span> قرار بده.</li>
            <li>در بخش هدرها، یک هدر با نام <span dir="ltr" className="font-mono text-[11px]">Authorization</span> و مقدار هدر بالا اضافه کن.</li>
            <li>زمان‌بندی را روی «هر ۵ دقیقه» (یا هر ۱۵ دقیقه) تنظیم کن و ذخیره کن.</li>
            <li>پس از چند دقیقه به همین صفحه برگرد؛ «آخرین اجرا» باید به‌روز شده باشد.</li>
          </ol>
          <a
            href="https://cron-job.org"
            target="_blank"
            rel="noreferrer"
            onClick={() => haptic("tap")}
            className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--brand-600)] tap press"
          >
            باز کردن cron-job.org
            <ExternalLink className="size-3.5" />
          </a>
        </div>

        {/* In-app heartbeat fallback */}
        <div className="mx-3 mt-4 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] overflow-hidden">
          <button onClick={toggleHb} className="w-full flex items-center gap-3 px-3.5 py-3 tap press text-right">
            <span className={`size-9 rounded-xl grid place-items-center shrink-0 ${hb ? "bg-[var(--brand-500)]/12 text-[var(--brand-500)]" : "bg-[var(--background-muted)] text-[var(--foreground-subtle)]"}`}>
              <RadioTower className="size-[18px]" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-medium">زمان‌بند درون‌برنامه‌ای</span>
              <span className="block text-[11.5px] text-[var(--foreground-subtle)] mt-0.5">
                جایگزین یا مکمل cron؛ تا وقتی اپ باز است قوانین را اجرا می‌کند
              </span>
            </span>
            <span className={`w-11 h-6 rounded-full p-0.5 shrink-0 transition-colors ${hb ? "bg-[var(--brand-500)]" : "bg-[var(--border-strong)]"}`}>
              <span className={`block size-5 rounded-full bg-white transition-transform ${hb ? "-translate-x-5" : ""}`} />
            </span>
          </button>
        </div>

        {/* Security note */}
        <div className="mx-4 mt-4 flex items-start gap-2 text-[11.5px] text-[var(--foreground-subtle)] leading-relaxed">
          <ShieldCheck className="size-3.5 shrink-0 mt-0.5" />
          <span>این هدر همان کلید عمومی اپ است و امکان انتشار مستقل نمی‌دهد؛ توکن‌های حساب‌ها فقط روی سرور نگهداری می‌شوند.</span>
        </div>
      </div>
    </MobileScreen>
  );
}
