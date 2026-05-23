import { AnimatePresence, motion } from "motion/react";
import { WifiOff } from "lucide-react";
import { useOnline } from "../hooks/useOnline";

/**
 * Tiny inline banner that appears below the TopBar when the device drops offline.
 * Self-managed via `useOnline` — drop it anywhere inside MobileShell once.
 */
export function OfflineBanner() {
  const online = useOnline();
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          key="offline"
          initial={{ y: -32, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -32, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          role="status"
          className="md:hidden fixed left-0 right-0 z-[var(--z-mobile-topbar)] flex items-center justify-center gap-2 h-8 text-[12px] font-medium
                     bg-amber-500/95 text-white backdrop-blur"
          style={{ top: `calc(var(--safe-top) + var(--topbar-h))` }}
        >
          <WifiOff className="size-3.5" />
          <span>اتصال اینترنت قطع است — مقالات ذخیره‌شده در دسترسن</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
