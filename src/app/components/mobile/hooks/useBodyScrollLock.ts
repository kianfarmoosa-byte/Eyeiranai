import { useEffect } from "react";

let lockCount = 0;

/**
 * Lock body scroll while the calling component is mounted+active.
 * Uses a refcount so multiple overlays (sheet + reader) don't fight.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockCount++;
    const prev = document.body.style.overflow;
    if (lockCount === 1) document.body.style.overflow = "hidden";
    return () => {
      lockCount--;
      if (lockCount === 0) document.body.style.overflow = prev;
    };
  }, [active]);
}
