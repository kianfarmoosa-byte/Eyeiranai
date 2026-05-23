import { useEffect, useRef, useState, type ReactNode, type PointerEvent as RP } from "react";
import { useBodyScrollLock } from "../hooks";

export type SheetSnap = "peek" | "half" | "full" | "auto";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Trailing element next to title (icon button) */
  trailing?: ReactNode;
  children: ReactNode;
  /** Initial snap point. */
  snap?: SheetSnap;
  /** Allowed snap heights as fractions of viewport. Defaults: 0.25, 0.55, 0.92 */
  snapPoints?: number[];
  /** Disable drag-to-dismiss. */
  persistent?: boolean;
  /** Hide the drag handle (for non-dismissable sheets). */
  hideHandle?: boolean;
  /** Extra class on the sheet container. */
  className?: string;
};

const DEFAULT_SNAPS = [0.25, 0.55, 0.92];

/**
 * Mobile-native bottom sheet with snap points, swipe-to-dismiss,
 * scrim, safe-area-aware footer space, and pointer-driven drag.
 *
 * The sheet height is controlled by snap point, NOT content. Content scrolls
 * inside. Drag the handle to switch snaps; drag past lowest snap to close.
 */
export function BottomSheet({
  open, onClose, title, trailing, children,
  snap = "half", snapPoints = DEFAULT_SNAPS,
  persistent, hideHandle, className = "",
}: Props) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const [snapIdx, setSnapIdx] = useState(() => snapIndex(snap, snapPoints));
  const [drag, setDrag] = useState(0);
  const [vh, setVh] = useState(() => (typeof window !== "undefined" ? window.innerHeight : 800));
  const startY = useRef<number | null>(null);
  useBodyScrollLock(open);

  useEffect(() => {
    const on = () => setVh(window.innerHeight);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setSnapIdx(snapIndex(snap, snapPoints));
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(t);
    }
  }, [open, snap, snapPoints]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !persistent) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, persistent]);

  if (!mounted) return null;

  const targetH = snapPoints[snapIdx] * vh;

  const onPointerDown = (e: RP<HTMLDivElement>) => {
    if (persistent) return;
    startY.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: RP<HTMLDivElement>) => {
    if (startY.current == null) return;
    const dy = e.clientY - startY.current;
    setDrag(dy);
  };
  const onPointerUp = () => {
    if (startY.current == null) return;
    const dyFraction = drag / vh;
    // Snap to nearest point given drag delta; if past lowest snap, close.
    const currentFraction = snapPoints[snapIdx] - dyFraction;
    const lowest = snapPoints[0];
    if (currentFraction < lowest * 0.6 && !persistent) {
      onClose();
    } else {
      let nearest = 0;
      let best = Infinity;
      snapPoints.forEach((s, i) => {
        const d = Math.abs(s - currentFraction);
        if (d < best) { best = d; nearest = i; }
      });
      setSnapIdx(nearest);
    }
    setDrag(0);
    startY.current = null;
  };

  const translate = visible ? Math.max(0, drag) : vh;

  return (
    <div className="fixed inset-0 z-[var(--z-mobile-sheet)] md:hidden" role="dialog" aria-modal>
      <div
        onClick={persistent ? undefined : onClose}
        className={`absolute inset-0 scrim transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
      />
      <div
        style={{
          height: targetH,
          transform: `translateY(${translate}px)`,
          transition: drag === 0 ? `transform var(--duration-sheet) var(--ease-ios), height var(--duration-sheet) var(--ease-ios)` : "none",
        }}
        className={`absolute bottom-0 left-0 right-0 max-h-[100dvh]
                    bg-[var(--background)] text-[var(--foreground)]
                    rounded-t-[var(--sheet-radius)] shadow-[var(--sheet-shadow)]
                    flex flex-col will-change-transform tap ${className}`}
      >
        {!hideHandle && (
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="shrink-0 pt-2.5 pb-1 flex flex-col items-center cursor-grab active:cursor-grabbing touch-none"
          >
            <div className="rounded-full bg-[var(--border-strong)]"
                 style={{ width: "var(--sheet-handle-w)", height: "var(--sheet-handle-h)" }} />
          </div>
        )}

        {(title || trailing) && (
          <div className="shrink-0 px-4 pt-1 pb-3 flex items-center gap-2 border-b border-[var(--border-subtle)]">
            <div className="flex-1 text-[15px] font-semibold truncate">{title}</div>
            {trailing}
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain pb-safe">
          {children}
        </div>
      </div>
    </div>
  );
}

function snapIndex(snap: SheetSnap, points: number[]): number {
  if (snap === "peek") return 0;
  if (snap === "full") return points.length - 1;
  if (snap === "auto" || snap === "half") return Math.floor(points.length / 2);
  return 0;
}
