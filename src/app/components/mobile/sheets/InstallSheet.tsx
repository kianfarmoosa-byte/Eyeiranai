import { Download, Smartphone, Wifi, Zap } from "lucide-react";
import { BottomSheet } from "../primitives/BottomSheet";
import { useInstallPrompt } from "../hooks";
import { useToast } from "../primitives/Toast";

const DISMISS_KEY = "kian.mobile.installDismissed";

export function markInstallDismissed() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
}
export function wasInstallDismissedRecently(days = 7): boolean {
  try {
    const v = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (!v) return false;
    return Date.now() - v < days * 86400_000;
  } catch { return false; }
}

type Props = { open: boolean; onClose: () => void };

export function InstallSheet({ open, onClose }: Props) {
  const { canInstall, prompt } = useInstallPrompt();
  const toast = useToast();

  const install = async () => {
    const r = await prompt();
    if (r === "accepted") toast({ kind: "success", title: "flow نصب شد" });
    else if (r === "unavailable") toast({ kind: "info", title: "مرورگر شما از نصب پشتیبانی نمی‌کنه", body: "از منوی مرورگر «افزودن به صفحه اصلی» رو امتحان کن." });
    markInstallDismissed();
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={() => { markInstallDismissed(); onClose(); }} snap="half" hideHandle>
      <div className="px-6 py-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="size-12 grid place-items-center rounded-2xl bg-[var(--brand-500)]/12 text-[var(--brand-500)]">
            <Smartphone className="size-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[16px] font-bold">flow رو نصب کن</h2>
            <p className="text-[12px] text-[var(--foreground-subtle)]">دسترسی سریع، بدون مرورگر</p>
          </div>
        </div>

        <ul className="flex flex-col gap-2.5 text-[13px]">
          <Feat icon={<Zap className="size-4" />} text="باز شدن آنی از صفحه اصلی" />
          <Feat icon={<Wifi className="size-4" />} text="مطالعه آفلاین مقالات ذخیره‌شده" />
          <Feat icon={<Download className="size-4" />} text="فضای کمتر از یک عکس" />
        </ul>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => { markInstallDismissed(); onClose(); }}
            className="flex-1 h-11 rounded-full text-[13.5px] tap press text-[var(--foreground-subtle)]"
          >
            بعداً
          </button>
          <button
            onClick={install}
            disabled={!canInstall}
            className="flex-[2] h-11 rounded-full bg-[var(--brand-500)] hover:bg-[var(--brand-600)] disabled:opacity-50 text-white text-[14px] font-semibold tap press flex items-center justify-center gap-1.5"
          >
            <Download className="size-4" /> نصب
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

function Feat({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="size-8 grid place-items-center rounded-full bg-[var(--accent)] text-[var(--foreground-muted)]">{icon}</span>
      <span>{text}</span>
    </li>
  );
}
