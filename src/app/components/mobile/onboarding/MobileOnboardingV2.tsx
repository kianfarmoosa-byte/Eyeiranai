import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Newspaper, Bot, ChevronLeft, ChevronRight } from "lucide-react";
import { useHaptics } from "../hooks";

const STORAGE_KEY = "kian.mobile.onboarded";

export function hasOnboardedV2(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return true; }
}
function markOnboarded() {
  try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
}

type Step = {
  icon: JSX.Element;
  eyebrow: string;
  title: string;
  body: string;
  gradient: string;
  accent: string;
};

const STEPS: Step[] = [
  {
    icon: <Newspaper className="size-10" strokeWidth={1.8} />,
    eyebrow: "گام ۱ از ۳",
    title: "خبرها، روان و سریع",
    body: "همهٔ خوراک‌های فارسی محبوبت را یک‌جا بخوان؛ بدون شلوغی، با تجربه‌ای واقعاً موبایلی.",
    gradient: "linear-gradient(160deg, #ED1C24 0%, #61070A 100%)",
    accent: "#ED1C24",
  },
  {
    icon: <Bot className="size-10" strokeWidth={1.8} />,
    eyebrow: "گام ۲ از ۳",
    title: "خلاصه‌ساز هوش مصنوعی",
    body: "هر مقاله را در چند ثانیه بفهم. خلاصهٔ کوتاه، بولت‌های کلیدی و امکان پرسیدن سؤال از متن.",
    gradient: "linear-gradient(160deg, #6366F1 0%, #312E81 100%)",
    accent: "#6366F1",
  },
  {
    icon: <Sparkles className="size-10" strokeWidth={1.8} />,
    eyebrow: "گام ۳ از ۳",
    title: "موضوعاتِ شخصی‌سازی‌شده",
    body: "علاقه‌مندی‌هایت را انتخاب کن تا کیان مرتبط‌ترین خبرها را اولویت‌بندی و پیشنهاد کند.",
    gradient: "linear-gradient(160deg, #10B981 0%, #064E3B 100%)",
    accent: "#10B981",
  },
];

type Props = {
  open: boolean;
  onDone: () => void;
};

export function MobileOnboardingV2({ open, onDone }: Props) {
  const [idx, setIdx] = useState(0);
  const haptic = useHaptics();
  const step = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  if (!open) return null;

  const finish = () => { markOnboarded(); onDone(); };
  const next = () => {
    haptic("tap");
    if (isLast) finish();
    else setIdx((i) => i + 1);
  };
  const back = () => { haptic("tap"); if (idx > 0) setIdx((i) => i - 1); };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[var(--z-mobile-reader)] bg-[var(--background)] flex flex-col"
    >
      {/* Skip button */}
      <div className="absolute top-0 inset-x-0 pt-[calc(12px+var(--safe-top))] px-4 flex items-center justify-between z-10">
        <button
          onClick={back}
          disabled={idx === 0}
          className="size-9 rounded-full grid place-items-center tap press disabled:opacity-0 transition-opacity bg-[var(--background-muted)]"
          aria-label="قبلی"
        >
          <ChevronRight className="size-5" />
        </button>
        <button
          onClick={finish}
          className="h-9 px-4 rounded-full text-[12.5px] text-[var(--foreground-muted)] tap press"
        >
          رد کردن
        </button>
      </div>

      {/* Hero gradient stage */}
      <div className="relative h-[58%] overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
            style={{ background: step.gradient }}
          >
            {/* highlights */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(120% 70% at 50% 15%, rgba(255,255,255,0.28) 0%, transparent 60%)" }}
            />
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.07] mix-blend-overlay"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
              }}
            />

            {/* floating glyph */}
            <div className="absolute inset-0 grid place-items-center">
              <motion.div
                initial={{ y: 18, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
                className="relative"
              >
                <div className="absolute inset-0 rounded-[28px] bg-white/20 blur-2xl scale-110" />
                <div className="relative size-[120px] rounded-[28px] bg-white/95 grid place-items-center shadow-[0_22px_48px_-14px_rgba(0,0,0,0.45)]">
                  <div
                    className="size-[80px] rounded-[20px] grid place-items-center text-white"
                    style={{ background: step.gradient }}
                  >
                    {step.icon}
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* curve mask into content area */}
        <div
          className="absolute inset-x-0 bottom-[-1px] h-10 bg-[var(--background)]"
          style={{ borderTopLeftRadius: "32px", borderTopRightRadius: "32px" }}
        />
      </div>

      {/* Copy + actions */}
      <div className="flex-1 flex flex-col px-7 pt-2 pb-[calc(24px+var(--safe-bottom))]">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col items-center text-center gap-3"
          >
            <span
              className="text-[11px] font-semibold tracking-[0.18em] uppercase"
              style={{ color: step.accent }}
            >
              {step.eyebrow}
            </span>
            <h1 className="text-[24px] font-black leading-tight tracking-tight">{step.title}</h1>
            <p className="text-[14px] leading-[1.85] text-[var(--foreground-muted)] max-w-[320px]">
              {step.body}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* progress dots */}
        <div className="flex items-center justify-center gap-1.5 my-5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => { haptic("tap"); setIdx(i); }}
              className={`h-1.5 rounded-full transition-all duration-300 tap ${
                i === idx ? "w-7" : "w-1.5 bg-[var(--border-strong)]"
              }`}
              style={i === idx ? { background: step.accent } : undefined}
              aria-label={`گام ${i + 1}`}
            />
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={next}
          className="h-13 w-full rounded-full text-white text-[15px] font-semibold tap press flex items-center justify-center gap-2 shadow-[0_12px_30px_-12px_rgba(0,0,0,0.4)]"
          style={{ background: step.gradient, height: "52px" }}
        >
          {isLast ? "شروع کنیم" : "بعدی"}
          <ChevronLeft className="size-4" />
        </button>
      </div>
    </div>
  );
}
