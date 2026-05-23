import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type Props<T> = {
  items: T[];
  rowHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  /** Number of off-screen rows to render above/below for smooth scrolling. */
  overscan?: number;
  /** Extra content rendered above the virtualized rows (sticky to scroll, not viewport). */
  header?: ReactNode;
  /** Extra content rendered below the virtualized rows. */
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Key extractor; defaults to index. */
  keyFor?: (item: T, index: number) => string | number;
  /** Forwarded to the scroll container, e.g. for pointer handlers from gesture hooks. */
  containerProps?: React.HTMLAttributes<HTMLDivElement>;
};

/**
 * Fixed-row-height windowed list with its own scroll container. Use when you
 * need to render thousands of rows efficiently and don't have variable heights.
 * For variable heights or per-row measurement, reach for a heavier solution
 * (e.g. `@tanstack/react-virtual`).
 */
export function VirtualList<T>({
  items, rowHeight, renderItem, overscan = 6, header, footer,
  className = "", style, keyFor, containerProps,
}: Props<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: Math.min(items.length, 30) });
  const [headerH, setHeaderH] = useState(0);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (headerRef.current) setHeaderH(headerRef.current.offsetHeight);
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const top = Math.max(0, el.scrollTop - headerH);
      const h = el.clientHeight;
      const start = Math.max(0, Math.floor(top / rowHeight) - overscan);
      const end = Math.min(items.length, Math.ceil((top + h) / rowHeight) + overscan);
      setRange({ start, end });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, [items.length, rowHeight, overscan, headerH]);

  const totalH = items.length * rowHeight;
  const slice = items.slice(range.start, range.end);

  return (
    <div
      ref={ref}
      {...containerProps}
      className={`overflow-y-auto scrollbar-none ${className}`}
      style={style}
    >
      {header && <div ref={headerRef}>{header}</div>}
      <div style={{ position: "relative", height: totalH }}>
        <div style={{ transform: `translateY(${range.start * rowHeight}px)` }}>
          {slice.map((item, i) => {
            const idx = range.start + i;
            const key = keyFor ? keyFor(item, idx) : idx;
            return (
              <div key={key} style={{ height: rowHeight }}>
                {renderItem(item, idx)}
              </div>
            );
          })}
        </div>
      </div>
      {footer}
    </div>
  );
}
