import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type SheetEntry = { id: string; node: ReactNode };

type Ctx = {
  push: (node: ReactNode) => string;
  pop: (id?: string) => void;
  popAll: () => void;
  depth: number;
};

const SheetStackCtx = createContext<Ctx | null>(null);

/**
 * Manages a stack of BottomSheets. Top-of-stack is opaque; sheets below get a
 * subtle scale-down + dim to convey depth (iOS-style modal pile).
 *
 * Children may call `useSheetStack().push(<MySheet ...) />` to open a sheet;
 * the returned id can be used to programmatically pop it.
 */
export function SheetStackProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<SheetEntry[]>([]);
  const seq = useRef(0);

  const push = useCallback((node: ReactNode) => {
    const id = `s${++seq.current}`;
    setStack((s) => [...s, { id, node }]);
    return id;
  }, []);
  const pop = useCallback((id?: string) => {
    setStack((s) => (id ? s.filter((e) => e.id !== id) : s.slice(0, -1)));
  }, []);
  const popAll = useCallback(() => setStack([]), []);

  const value = useMemo<Ctx>(() => ({ push, pop, popAll, depth: stack.length }), [push, pop, popAll, stack.length]);

  return (
    <SheetStackCtx.Provider value={value}>
      {/* Background scale based on depth — applied to a wrapper around app content
          by consumers if desired. Here we just render children + stacked sheets. */}
      {children}
      {stack.map((entry, i) => {
        const fromTop = stack.length - 1 - i;
        const scale = 1 - fromTop * 0.04;
        const dim = fromTop > 0 ? 0.08 * fromTop : 0;
        return (
          <div
            key={entry.id}
            style={{
              transform: fromTop > 0 ? `scale(${scale}) translateY(-${fromTop * 8}px)` : undefined,
              transition: "transform var(--duration-sheet) var(--ease-ios)",
              pointerEvents: fromTop === 0 ? "auto" : "none",
            }}
          >
            {entry.node}
            {fromTop > 0 && (
              <div
                aria-hidden
                className="fixed inset-0 z-[var(--z-mobile-sheet)] bg-black"
                style={{ opacity: dim, transition: "opacity var(--duration-sheet) var(--ease-ios)" }}
              />
            )}
          </div>
        );
      })}
    </SheetStackCtx.Provider>
  );
}

export function useSheetStack(): Ctx {
  const ctx = useContext(SheetStackCtx);
  if (!ctx) throw new Error("useSheetStack must be used within <SheetStackProvider>");
  return ctx;
}
