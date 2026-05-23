import { useEffect } from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";

type Props = {
  onDone: () => void;
  /** Auto-dismiss after this many ms. Pass 0 to disable. */
  duration?: number;
};

/**
 * RTL Persian splash inspired by the Figma "HUM AI NEWS" red-gradient splash
 * (#ED1C24 → #61070A). Rebrands as «کیان» (Kian) — minimal, premium, fluid.
 */
export function SplashScreen({ onDone, duration = 2200 }: Props) {
  useEffect(() => {
    if (!duration) return;
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, [duration, onDone]);

  return (
    <motion.div
      key="splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      dir="rtl"
      className="fixed inset-0 z-[var(--z-mobile-toast)] overflow-hidden text-white"
      style={{
        background: "linear-gradient(180deg, #ED1C24 0%, #61070A 100%)",
      }}
    >
      {/* radial highlight + film grain for depth */}
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: "radial-gradient(140% 80% at 50% 20%, rgba(255,255,255,0.25) 0%, transparent 60%)" }} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.06] mix-blend-overlay"
           style={{ backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
           }} />

      {/* central logo + wordmark */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="flex flex-col items-center gap-5">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="absolute inset-0 rounded-[28px] bg-white/15 blur-2xl scale-110" />
            <div className="relative size-[88px] rounded-[24px] bg-white/95 grid place-items-center shadow-[0_18px_40px_-12px_rgba(0,0,0,0.45)]">
              <div className="size-[58px] rounded-[16px] bg-gradient-to-br from-[#ED1C24] to-[#61070A] grid place-items-center">
                <Sparkles className="size-7 text-white" strokeWidth={2.4} />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="text-center"
          >
            <div className="text-[34px] font-black tracking-[-0.02em] leading-none drop-shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
              کیان
            </div>
            <div className="mt-2 text-[12px] tracking-[0.18em] text-white/85">
              اخبار · مبتنی بر هوش مصنوعی
            </div>
          </motion.div>
        </div>
      </div>

      {/* bottom loader + brand line */}
      <div className="absolute inset-x-0 bottom-0 pb-[calc(36px+var(--safe-bottom))] flex flex-col items-center gap-3">
        <div className="h-[3px] w-[140px] rounded-full bg-white/20 overflow-hidden">
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: "-100%" }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
            className="h-full w-[60%] bg-white/85"
          />
        </div>
        <div className="text-[10.5px] tracking-[0.22em] text-white/65">KIAN · v1.0</div>
      </div>
    </motion.div>
  );
}
