import { useCallback } from "react";

type Pattern = "tap" | "select" | "success" | "warn" | "error" | "heavy";

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 8,
  select: 12,
  success: [6, 30, 6],
  warn: [12, 40, 12],
  error: [20, 50, 20, 50, 20],
  heavy: 22,
};

/**
 * Lightweight haptics wrapper. Silently no-ops where Vibration API is missing
 * (iOS Safari). Respects user's reduced-motion preference as proxy for "less
 * sensory" — most users who disable motion also dislike vibration.
 */
export function useHaptics() {
  return useCallback((p: Pattern) => {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    try {
      const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
      if (m?.matches) return;
      navigator.vibrate(PATTERNS[p]);
    } catch {}
  }, []);
}
