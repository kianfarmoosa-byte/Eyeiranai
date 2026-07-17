import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useHaptics } from "../hooks";
import { useSwipeGesture } from "../hooks/useSwipeGesture";

const STORAGE_KEY = "kian.mobile.onboarded";

export function hasOnboardedV2(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return true; }
}
function markOnboarded() {
  try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
}

/** Decorative geometry rendered bottom-trailing on each card (outline / monochrome). */
type Deco = "stars" | "circles" | "polygons" | "squares";

type Step = {
  title: string;
  body: string;
  /** Card surface tint (monochrome grayscale steps). */
  surface: string;
  deco: Deco;
};

const STEPS: Step[] = [
  {
    title: "خبرها،\nروان و سریع",
    body: "همهٔ خوراک‌های فارسی و جهانی محبوبت را یک‌جا بخوان؛ بدون شلوغی، با تجربه‌ای واقعاً موبایلی.",
    surface: "var(--neutral-100)",
    deco: "polygons",
  },
  {
    title: "خلاصه‌ساز\nهوش مصنوعی",
    body: "هر مقاله را در چند ثانیه بفهم؛ خلاصهٔ کوتاه، بولت‌های کلیدی و امکان پرسیدن سؤال از متن.",
    surface: "var(--neutral-50)",
    deco: "circles",
  },
  {
    title: "گرافِ\nشبکهٔ رسانه",
    body: "مسیر انتشار یک خبر میان منابع را ببین و با فوکوس موضوعی، روایت‌های مرتبط را دنبال کن.",
    surface: "var(--neutral-100)",
    deco: "stars",
  },
  {
    title: "موضوعاتِ\nشخصی‌سازی‌شده",
    body: "علاقه‌مندی‌هایت را انتخاب کن تا flow مرتبط‌ترین خبرها را اولویت‌بندی و پیشنهاد کند.",
    surface: "var(--neutral-50)",
    deco: "squares",
  },
];

const SPRING = { type: "spring" as const, stiffness: 320, damping: 34, mass: 0.9 };

function Decoration({ kind }: { kind: Deco }) {
  // Monochrome outline geometry — echoes the Figma template's stacked shapes.
  const stroke = "var(--border-strong)";
  const fillSoft = "color-mix(in oklch, var(--foreground) 6%, transparent)";
  const fillAccent = "var(--accent)";
  const common = "absolute pointer-events-none";

  if (kind === "circles") {
    return (
      <div className={`${common} -bottom-6 -left-6 size-[220px]`} aria-hidden>
        <div className="absolute bottom-10 left-16 size-[150px] rounded-full" style={{ border: `1px solid ${stroke}` }} />
        <div className="absolute bottom-0 left-0 size-[150px] rounded-full" style={{ border: `1px solid ${stroke}`, background: fillSoft }} />
        <div className="absolute bottom-20 left-2 size-[150px] rounded-full" style={{ border: `1px solid ${stroke}` }} />
      </div>
    );
  }
  if (kind === "polygons") {
    return (
      <div className={`${common} -bottom-4 -left-4 size-[230px]`} aria-hidden>
        <div className="absolute bottom-6 left-10 size-[170px] -rotate-[49deg]" style={{ border: `1px solid ${stroke}`, background: fillSoft, borderRadius: "10px" }} />
        <div className="absolute bottom-16 left-20 size-[60px] -rotate-[15deg]" style={{ border: `1px solid ${stroke}`, background: fillAccent, borderRadius: "8px" }} />
        <div className="absolute bottom-2 left-0 size-[150px] rounded-full -rotate-[15deg]" style={{ border: `1px solid ${stroke}` }} />
      </div>
    );
  }
  if (kind === "stars") {
    return (
      <div className={`${common} -bottom-6 -left-6 size-[230px]`} aria-hidden>
        <div className="absolute bottom-6 left-10 size-[180px] rotate-45" style={{ border: `1px solid ${stroke}` }} />
        <div className="absolute bottom-0 left-0 size-[120px] rotate-12" style={{ border: `1px solid ${stroke}`, background: fillSoft }} />
        <div className="absolute bottom-24 left-24 size-[64px] rotate-[30deg]" style={{ border: `1px solid ${stroke}`, background: fillAccent }} />
      </div>
    );
  }
  // squares
  return (
    <div className={`${common} -bottom-6 -left-6 size-[230px]`} aria-hidden>
      <div className="absolute bottom-8 left-12 size-[160px] rounded-[20px]" style={{ border: `1px solid ${stroke}`, background: fillSoft }} />
      <div className="absolute bottom-0 left-0 size-[120px] rounded-[16px]" style={{ border: `1px solid ${stroke}` }} />
      <div className="absolute bottom-2 left-28 size-[56px] rounded-[12px]" style={{ border: `1px solid ${stroke}`, background: fillAccent }} />
    </div>
  );
}

type Props = {
  open: boolean;
  onDone: () => void;
};

export function MobileOnboardingV2({ open, onDone }: Props) {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1); // 1 = forward, -1 = back
  const [drag, setDrag] = useState(0);
  const haptic = useHaptics();
  const draggingRef = useRef(false);

  const step = STEPS[idx];
  const isLast = idx === STEPS.length - 1;
  const isFirst = idx === 0;

  const finish = () => { markOnboarded(); onDone(); };
  const goNext = () => {
    haptic("tap");
    if (isLast) finish();
    else { setDir(1); setIdx((i) => i + 1); }
  };
  const goBack = () => {
    if (isFirst) return;
    haptic("tap");
    setDir(-1);
    setIdx((i) => i - 1);
  };
  const goTo = (i: number) => {
    if (i === idx) return;
    haptic("tap");
    setDir(i > idx ? 1 : -1);
    setIdx(i);
  };

  // RTL: swipe left (negative dx) = next, swipe right (positive dx) = previous.
  // Exclude `wasMoved` (a helper fn) so it isn't spread onto the DOM element.
  const { wasMoved: _wasMoved, ...swipe } = useSwipeGesture(
    {
      onMove: (dx) => { draggingRef.current = true; setDrag(dx); },
      onSwipeLeft: goNext,
      onSwipeRight: goBack,
      onEnd: () => { draggingRef.current = false; setDrag(0); },
    },
    { axisRatio: 1.3, allowVertical: false, threshold: 56 }
  );

  if (!open) return null;

  // Card enters rotated/offset from the trailing edge, like the Figma deck.
  const enterFrom = dir > 0
    ? { x: 60, rotate: 18, opacity: 0, scale: 0.94 }
    : { x: -60, rotate: -18, opacity: 0, scale: 0.94 };
  const exitTo = dir > 0
    ? { x: -60, rotate: -18, opacity: 0, scale: 0.94 }
    : { x: 60, rotate: 18, opacity: 0, scale: 0.94 };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[var(--z-mobile-reader)] bg-[var(--background)] flex flex-col"
    >
      {/* Top bar: skip */}
      <div className="flex items-center justify-end px-4 pt-[calc(10px+var(--safe-top))] pb-2">
        <button
          onClick={finish}
          className="h-9 px-4 rounded-full text-[12.5px] text-[var(--foreground-muted)] tap press"
        >
          رد کردن
        </button>
      </div>

      {/* Card stage */}
      <div className="flex-1 px-4 min-h-0">
        <div className="relative h-full w-full" style={{ perspective: 1200 }}>
          {/* trailing ghost card peeking behind, for depth */}
          {!isLast && (
            <div
              className="absolute inset-0 rounded-[32px] origin-bottom"
              style={{
                background: "var(--background-muted)",
                transform: "rotate(6deg) scale(0.96) translateY(8px)",
                opacity: 0.5,
              }}
            />
          )}

          <AnimatePresence mode="popLayout" custom={dir}>
            <motion.div
              key={idx}
              custom={dir}
              initial={enterFrom}
              animate={{
                x: draggingRef.current ? drag : 0,
                rotate: draggingRef.current ? drag * 0.03 : 0,
                opacity: 1,
                scale: 1,
              }}
              exit={exitTo}
              transition={draggingRef.current ? { duration: 0 } : SPRING}
              {...swipe}
              className="absolute inset-0 rounded-[32px] overflow-hidden touch-pan-y select-none"
              style={{
                background: step.surface,
                border: "1px solid var(--border)",
                boxShadow: "0 30px 60px -28px rgba(0,0,0,0.35)",
              }}
            >
              {/* text block */}
              <div className="absolute top-8 inset-x-8 flex flex-col gap-3">
                <h1 className="text-[clamp(38px,12vw,52px)] font-black leading-[1.04] tracking-tight text-[var(--foreground)] whitespace-pre-line">
                  {step.title}
                </h1>
                <p className="text-[15px] leading-[1.8] text-[var(--foreground-muted)] max-w-[300px]">
                  {step.body}
                </p>
              </div>

              {/* geometric decoration bottom-trailing */}
              <Decoration kind={step.deco} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-4 pt-3 pb-[calc(16px+var(--safe-bottom))]">
        <div
          className="rounded-[32px] px-5 pt-5 pb-4 flex flex-col gap-4"
          style={{ background: step.surface, border: "1px solid var(--border)" }}
        >
          {/* nav arrows + primary CTA */}
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              disabled={isFirst}
              aria-label="قبلی"
              className="shrink-0 rounded-full grid place-items-center tap press transition-opacity disabled:opacity-0"
              style={{ width: 52, height: 52, background: "var(--background)", border: "1px solid var(--border-strong)" }}
            >
              {/* RTL: previous points right */}
              <ArrowRight className="size-5 text-[var(--foreground)]" />
            </button>

            <button
              onClick={goNext}
              className="flex-1 rounded-[14px] text-[15px] font-semibold tap press flex items-center justify-center gap-2"
              style={{
                height: 52,
                background: "var(--foreground)",
                color: "var(--background)",
              }}
            >
              {isLast ? "بزن بریم" : "بعدی"}
              {/* RTL: forward points left */}
              {!isLast && <ArrowLeft className="size-4" />}
            </button>
          </div>

          {/* pagination dots */}
          <div className="flex items-center justify-center gap-2">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`گام ${i + 1}`}
                className="grid place-items-center tap"
                style={{ width: 14, height: 14 }}
              >
                <motion.span
                  animate={{
                    width: i === idx ? 18 : 5,
                    backgroundColor: i === idx ? "var(--accent)" : "var(--border-strong)",
                  }}
                  transition={{ duration: 0.25 }}
                  className="block h-[5px] rounded-full"
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
