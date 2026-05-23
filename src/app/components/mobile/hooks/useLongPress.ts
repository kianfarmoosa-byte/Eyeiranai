import { useRef, useCallback, type PointerEvent as RP } from "react";

/**
 * Long-press detector. Triggers after `ms` of stationary pressure.
 * Cancels on movement > 8px or pointer release before timeout.
 */
export function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<number | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current != null) { window.clearTimeout(timer.current); timer.current = null; }
    startPos.current = null;
  }, []);

  const onPointerDown = useCallback((e: RP<HTMLElement>) => {
    fired.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    timer.current = window.setTimeout(() => {
      fired.current = true;
      onLongPress();
    }, ms);
  }, [onLongPress, ms]);

  const onPointerMove = useCallback((e: RP<HTMLElement>) => {
    if (!startPos.current) return;
    const dx = Math.abs(e.clientX - startPos.current.x);
    const dy = Math.abs(e.clientY - startPos.current.y);
    if (dx > 8 || dy > 8) clear();
  }, [clear]);

  const onPointerUp = useCallback(() => { clear(); }, [clear]);
  const onPointerCancel = useCallback(() => { clear(); }, [clear]);
  const didFire = () => fired.current;

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, didFire };
}
