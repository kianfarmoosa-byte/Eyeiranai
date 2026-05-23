import { useEffect, useRef, useState } from "react";

export type SelectionInfo = {
  text: string;
  rect: DOMRect | null;
};

/**
 * Watches `document.getSelection()` and reports the current selection
 * when it falls *inside* the provided container ref. Debounced so the
 * action surface only appears once the user lets go.
 */
export function useTextSelection<T extends HTMLElement>(
  containerRef: React.RefObject<T | null>,
  { minChars = 4, debounceMs = 180 }: { minChars?: number; debounceMs?: number } = {},
) {
  const [info, setInfo] = useState<SelectionInfo | null>(null);
  const t = useRef<number | null>(null);

  useEffect(() => {
    const handle = () => {
      if (t.current) window.clearTimeout(t.current);
      t.current = window.setTimeout(() => {
        const sel = document.getSelection();
        if (!sel || sel.isCollapsed) { setInfo(null); return; }
        const text = sel.toString().trim();
        if (text.length < minChars) { setInfo(null); return; }
        const node = sel.anchorNode;
        const container = containerRef.current;
        if (!container || !node || !container.contains(node.nodeType === 1 ? node as Node : node.parentNode)) {
          setInfo(null);
          return;
        }
        const rect = sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
        setInfo({ text, rect });
      }, debounceMs);
    };
    document.addEventListener("selectionchange", handle);
    return () => {
      document.removeEventListener("selectionchange", handle);
      if (t.current) window.clearTimeout(t.current);
    };
  }, [containerRef, minChars, debounceMs]);

  const clear = () => {
    document.getSelection()?.removeAllRanges();
    setInfo(null);
  };

  return { selection: info, clear };
}
