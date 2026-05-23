import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "../hooks";

type Direction = "forward" | "back" | "none";

type Props = {
  /** Unique key per logical page; changing it triggers a transition. */
  pageKey: string;
  /** Slide direction. In RTL, "forward" slides incoming from the LEFT. */
  direction?: Direction;
  children: ReactNode;
};

/**
 * iOS-style horizontal page transition. RTL-aware: forward navigation slides
 * the new page in from the left (since the back-edge is on the right).
 */
export function PageTransition({ pageKey, direction = "forward", children }: Props) {
  const reduced = usePrefersReducedMotion();
  const dx = reduced || direction === "none" ? 0 : direction === "forward" ? -28 : 28;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pageKey}
        initial={{ opacity: 0, x: dx }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -dx * 0.6 }}
        transition={{ duration: reduced ? 0 : 0.26, ease: [0.32, 0.72, 0, 1] }}
        className="h-full w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
