import { useRef, useState, type ReactNode, type PointerEvent as RP } from "react";
import { useHaptics } from "../hooks";

type Action = {
  label: string;
  icon: ReactNode;
  color: string;
  onTrigger: () => void;
};

type Props = {
  children: ReactNode;
  /** Action revealed when swiping to start (visually: leftward in RTL → from right edge). */
  startAction?: Action;
  /** Action revealed when swiping to end (visually: rightward in RTL → from left edge). */
  endAction?: Action;
  /** Distance (px) past which the action triggers on release. */
  threshold?: number;
  /** Maximum reveal distance (px). */
  maxReveal?: number;
};

/**
 * iOS-style swipe-to-action row. Reveals an action on either side as the user
 * drags horizontally; releasing past the threshold triggers it.
 *
 * RTL-aware: "startAction" lives on the start edge (right in RTL).
 */
export function SwipeRow({
  children, startAction, endAction, threshold = 80, maxReveal = 120,
}: Props) {
  const [dx, setDx] = useState(0);
  const [armed, setArmed] = useState<"start" | "end" | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const locked = useRef<"x" | "y" | null>(null);
  const haptic = useHaptics();
  const armedFiredAt = useRef(0);

  const onPointerDown = (e: RP<HTMLDivElement>) => {
    start.current = { x: e.clientX, y: e.clientY };
    locked.current = null;
  };
  const onPointerMove = (e: RP<HTMLDivElement>) => {
    if (!start.current) return;
    const ddx = e.clientX - start.current.x;
    const ddy = e.clientY - start.current.y;
    if (!locked.current) {
      if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
      locked.current = Math.abs(ddx) > Math.abs(ddy) ? "x" : "y";
      if (locked.current === "y") { start.current = null; return; }
    }
    // In RTL, "start" is the right edge. Drag toward start = positive ddx in LTR coordinates
    // but visually it's a leftward swipe of content. We use raw ddx; consumer decides sides.
    let next = Math.max(-maxReveal, Math.min(maxReveal, ddx));
    if (next > 0 && !endAction) next = 0;
    if (next < 0 && !startAction) next = 0;
    setDx(next);

    const pastThreshold = Math.abs(next) >= threshold;
    const side: "start" | "end" | null = next < 0 ? "start" : next > 0 ? "end" : null;
    if (pastThreshold && side !== armed) {
      setArmed(side);
      if (side && Date.now() - armedFiredAt.current > 200) {
        haptic("select"); armedFiredAt.current = Date.now();
      }
    } else if (!pastThreshold && armed) {
      setArmed(null);
    }
  };
  const onPointerUp = () => {
    if (armed === "start" && startAction) { haptic("success"); startAction.onTrigger(); }
    else if (armed === "end" && endAction) { haptic("success"); endAction.onTrigger(); }
    setDx(0); setArmed(null); start.current = null; locked.current = null;
  };

  const reveal = Math.abs(dx);
  const showSide: "start" | "end" | null = dx < 0 ? "start" : dx > 0 ? "end" : null;
  const action = showSide === "start" ? startAction : showSide === "end" ? endAction : null;

  return (
    <div className="relative overflow-hidden">
      {action && (
        <div
          className={`absolute inset-y-0 ${showSide === "start" ? "left-0" : "right-0"} flex items-center justify-center ${action.color}`}
          style={{ width: reveal }}
        >
          <div className={`flex flex-col items-center gap-0.5 text-white text-[11px] font-semibold transition-transform ${armed === showSide ? "scale-110" : "scale-95"}`}>
            <span className="size-6 grid place-items-center">{action.icon}</span>
            <span>{action.label}</span>
          </div>
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(${dx}px)`,
          transition: dx === 0 ? "transform var(--duration-sheet) var(--ease-ios)" : "none",
          touchAction: "pan-y",
        }}
        className="bg-[var(--surface)]"
      >
        {children}
      </div>
    </div>
  );
}
