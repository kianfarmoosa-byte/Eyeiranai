import { useEffect, useRef, useState } from "react";

export function useVirtualList<T>(items: T[], opts: { rowHeight: number; overscan?: number; enabled?: boolean }) {
  const { rowHeight, overscan = 6, enabled = true } = opts;
  const containerRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: Math.min(items.length, 30) });
  const [paddingTop, setPaddingTop] = useState(0);
  const [paddingBottom, setPaddingBottom] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const top = el.scrollTop;
      const h = el.clientHeight;
      const start = Math.max(0, Math.floor(top / rowHeight) - overscan);
      const end = Math.min(items.length, Math.ceil((top + h) / rowHeight) + overscan);
      setRange({ start, end });
      setPaddingTop(start * rowHeight);
      setPaddingBottom(Math.max(0, (items.length - end) * rowHeight));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, [items.length, rowHeight, overscan, enabled]);

  if (!enabled) {
    return {
      containerRef,
      slice: items,
      paddingTop: 0,
      paddingBottom: 0,
      startIndex: 0,
    };
  }

  return {
    containerRef,
    slice: items.slice(range.start, range.end),
    paddingTop,
    paddingBottom,
    startIndex: range.start,
  };
}
