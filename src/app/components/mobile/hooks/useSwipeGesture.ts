import { useRef, useCallback, type PointerEvent as RP } from "react";

export type SwipeHandlers = {
  /** Drag amount (px) while active. Positive = right. */
  onMove?: (dx: number, dy: number) => void;
  /** Released past threshold to the right (RTL: visually right) */
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  /** Released — caller usually resets transform */
  onEnd?: () => void;
};

type Opts = {
  /** Min absolute movement to count as a swipe. */
  threshold?: number;
  /** Min ratio of dominant axis vs cross-axis to fire. Prevents diagonal misfires. */
  axisRatio?: number;
  /** If false, vertical swipes are ignored. Useful for horizontal-only card rows. */
  allowVertical?: boolean;
  allowHorizontal?: boolean;
};

/**
 * Pointer-based swipe primitive. Returns handlers to spread onto the element.
 *
 * Usage:
 *   const swipe = useSwipeGesture({ onSwipeLeft: doX, onMove: setDx }, { axisRatio: 1.5 });
 *   <div {...swipe} style={{ transform: `translateX(${dx}px)` }} />
 */
export function useSwipeGesture(handlers: SwipeHandlers, opts: Opts = {}) {
  const { threshold = 60, axisRatio = 1.4, allowVertical = true, allowHorizontal = true } = opts;
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const moved = useRef(false);

  const onPointerDown = useCallback((e: RP<HTMLElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    moved.current = false;
  }, []);

  const onPointerMove = useCallback((e: RP<HTMLElement>) => {
    if (!start.current || start.current.id !== e.pointerId) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved.current = true;
    handlers.onMove?.(dx, dy);
  }, [handlers]);

  const onPointerUp = useCallback((e: RP<HTMLElement>) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    const horizontal = ax >= ay * axisRatio;
    const vertical   = ay >= ax * axisRatio;

    if (allowHorizontal && horizontal && ax > threshold) {
      if (dx > 0) handlers.onSwipeRight?.();
      else handlers.onSwipeLeft?.();
    } else if (allowVertical && vertical && ay > threshold) {
      if (dy > 0) handlers.onSwipeDown?.();
      else handlers.onSwipeUp?.();
    }
    handlers.onEnd?.();
    start.current = null;
  }, [handlers, threshold, axisRatio, allowHorizontal, allowVertical]);

  const onPointerCancel = useCallback(() => {
    if (!start.current) return;
    handlers.onEnd?.();
    start.current = null;
  }, [handlers]);

  const wasMoved = () => moved.current;

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, wasMoved };
}
