import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Bookmark, Bell, ArrowLeft } from "lucide-react";
import { BottomSheet } from "../primitives/BottomSheet";
import { useHaptics } from "../hooks";

const STORAGE_KEY = "kian.mobile.onboarded";

const STEPS = [
  { icon: <Sparkles className="size-8" />, title: "خوش اومدی به کیان",
    body: "خوراک‌خوانِ فارسیِ هوشمند با موضوعات، فیلترهای دلخواه و تجربه‌ای کاملاً موبایلی." },
  { icon: <Bookmark className="size-8" />, title: "ذخیره برای بعد",
    body: "هر مقاله‌ای رو با ضربه روی نشانک نگه دار؛ توی تبِ «ذخیره» همیشه در دسترسته — حتی آفلاین." },
  { icon: <Bell className="size-8" />, title: "موضوعات هوشمند",
    body: "دنبال موضوعی خاصی؟ از تبِ «موضوعات» انتخابش کن تا مقاله‌های مرتبط برات اولویت‌بندی بشن." },
] as const;

export function hasOnboarded(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return true; }
}
export function markOnboarded() {
  try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
}

type Props = { open: boolean; onClose: () => void };

export function OnboardingSheet({ open, onClose }: Props) {
  const [idx, setIdx] = useState(0);
  const haptic = useHaptics();
  const step = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  const next = () => {
    haptic("tap");
    if (isLast) { markOnboarded(); onClose(); }
    else setIdx((i) => i + 1);
  };

  return (
    <BottomSheet open={open} onClose={() => { markOnboarded(); onClose(); }} snap="half" hideHandle>
      <div className="px-6 py-4 flex flex-col gap-5 min-h-[320px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="flex-1 flex flex-col items-center text-center gap-3"
          >
            <div className="size-16 grid place-items-center rounded-full bg-[var(--brand-500)]/12 text-[var(--brand-500)]">
              {step.icon}
            </div>
            <h2 className="text-[18px] font-bold mt-1">{step.title}</h2>
            <p className="text-[13.5px] leading-relaxed text-[var(--foreground-muted)] max-w-xs">{step.body}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === idx ? "w-6 bg-[var(--brand-500)]" : "w-1.5 bg-[var(--border-strong)]"
              }`} />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => { markOnboarded(); onClose(); }}
            className="flex-1 h-11 rounded-full text-[13.5px] tap press text-[var(--foreground-subtle)]">
            رد کردن
          </button>
          <button onClick={next}
            className="flex-[2] h-11 rounded-full bg-[var(--brand-500)] hover:bg-[var(--brand-600)] text-white text-[14px] font-semibold tap press flex items-center justify-center gap-1.5">
            {isLast ? "شروع کنیم" : "بعدی"}
            {!isLast && <ArrowLeft className="size-4" />}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
