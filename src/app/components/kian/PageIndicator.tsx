import { AnimatePresence, motion } from "motion/react";

/**
 * Top-of-page loading indicator (NProgress-style).
 * Renders a thin gradient bar that slides+fades in while `loading` is true.
 */
export function PageIndicator({ loading }: { loading: boolean }) {
  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          key="page-indicator"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          exit={{ opacity: 0, scaleX: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "right" }}
          className="fixed top-0 right-0 left-0 h-[2px] z-[9999] pointer-events-none
                     bg-gradient-to-l from-[var(--brand-300)] via-[var(--brand-500)] to-[var(--brand-700)]
                     shadow-[0_0_10px_var(--brand-500)]"
        >
          <motion.div
            className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-l from-transparent to-white/60"
            animate={{ x: ["-30%", "330%"] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
