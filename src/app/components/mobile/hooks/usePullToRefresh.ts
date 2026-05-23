import { useCallback, useRef, useState, type PointerEvent as RP, type RefObject } from "react";

const RESIST = 0.55;
const MAX_PULL = 110;
const TRIGGER = 70;

/**
 * Pull-to-refresh primitive. Attaches to a scrollable container ref;
 * only engages when scrollTop === 0 so it never fights native scroll.
 *
 * Returns the visual `pull` height (px) plus pointer handlers.
 */
export function usePullToRefresh(scrollRef: RefObject<HTMLElement>, onRefresh: () => void) {
  const [pull, setPull] = useState(0);
  const startY = useRef<number | null>(null);
  const active = useRef(false);

  const onPointerDown = useCallback((e: RP<HTMLElement>) => {
    const el = scrollRef.current;
    if (el && el.scrollTop <= 0) {
      startY.current = e.clientY;
      active.current = true;
    }
  }, [scrollRef]);

  const onPointerMove = useCallback((e: RP<HTMLElement>) => {
    if (!active.current || startY.current == null) return;
    const dy = e.clientY - startY.current;
    if (dy > 0) setPull(Math.min(MAX_PULL, dy * RESIST));
  }, []);

  const release = useCallback(() => {
    if (pull > TRIGGER) onRefresh();
    setPull(0);
    startY.current = null;
    active.current = false;
  }, [pull, onRefresh]);

  return {
    pull,
    triggered: pull >= TRIGGER,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: release,
      onPointerCancel: release,
    },
  };
}
