import { useRef, type PointerEvent as RP } from "react";

type Opts = {
  /** Pixel width of the active edge zone. */
  edge?: number;
  /** Min horizontal distance to trigger. */
  threshold?: number;
  /** Max vertical drift before cancelling (axis lock). */
  maxAxisDrift?: number;
  /** In RTL the back gesture starts from the RIGHT edge by default. */
  fromRight?: boolean;
  onBack: () => void;
};

/**
 * Edge-swipe back gesture using Pointer Events. RTL-correct: defaults to right edge.
 * Returns spread-able pointer handlers — attach to the scroll container of the screen.
 */
export function useEdgeSwipe({
  edge = 24, threshold = 64, maxAxisDrift = 40, fromRight = true, onBack,
}: Opts) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const armed = useRef(false);

  return {
    onPointerDown: (e: RP<HTMLElement>) => {
      const w = window.innerWidth;
      const onEdge = fromRight ? e.clientX >= w - edge : e.clientX <= edge;
      if (!onEdge) return;
      start.current = { x: e.clientX, y: e.clientY };
      armed.current = true;
    },
    onPointerMove: (e: RP<HTMLElement>) => {
      if (!armed.current || !start.current) return;
      const dy = Math.abs(e.clientY - start.current.y);
      if (dy > maxAxisDrift) { armed.current = false; start.current = null; }
    },
    onPointerUp: (e: RP<HTMLElement>) => {
      if (!armed.current || !start.current) { start.current = null; return; }
      const dx = e.clientX - start.current.x;
      const traveled = fromRight ? -dx : dx;
      if (traveled >= threshold) onBack();
      armed.current = false;
      start.current = null;
    },
    onPointerCancel: () => { armed.current = false; start.current = null; },
  };
}
