import { useCallback, useEffect, useMemo, useState } from "react";
import type { Article } from "../data";
import type { TopicScore } from "../topics";
import { ChevronDown, ChevronUp } from "lucide-react";

type Props = {
  articles: Article[];
  scores: Map<string, TopicScore>;
  active: boolean;
};

export function TopicJumpCounter({ articles, scores, active }: Props) {
  const matchedIds = useMemo(() => {
    if (!active) return [] as string[];
    return articles
      .filter(a => {
        const s = scores.get(a.id);
        return s && s.level !== "none";
      })
      .map(a => a.id);
  }, [articles, scores, active]);

  const [cursor, setCursor] = useState(0);
  useEffect(() => { setCursor(0); }, [matchedIds.length, active]);

  const scrollToIdx = useCallback((idx: number) => {
    if (!matchedIds.length) return;
    const i = ((idx % matchedIds.length) + matchedIds.length) % matchedIds.length;
    setCursor(i);
    const id = matchedIds[i];
    const el = document.querySelector<HTMLElement>(`[data-aid="${CSS.escape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.animate(
      [
        { boxShadow: "inset 3px 0 0 rgb(99 102 241), 0 0 0 4px rgba(99,102,241,.5)" },
        { boxShadow: "inset 3px 0 0 rgb(99 102 241), 0 0 0 0 rgba(99,102,241,0)" },
      ],
      { duration: 800, easing: "ease-out" }
    );
  }, [matchedIds]);

  const next = useCallback(() => scrollToIdx(cursor + 1), [cursor, scrollToIdx]);
  const prev = useCallback(() => scrollToIdx(cursor - 1), [cursor, scrollToIdx]);

  useEffect(() => {
    if (!active || !matchedIds.length) return;
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && /^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName)) return;
      if (tgt?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.key === "j" || e.key === "J") { next(); e.preventDefault(); }
      else if (e.key === "k" || e.key === "K") { prev(); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, matchedIds.length, next, prev]);

  if (!active || !matchedIds.length) return null;

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2 py-1 rounded-full bg-slate-900/90 dark:bg-slate-100/90 text-white dark:text-slate-900 shadow-lg backdrop-blur text-xs">
      <button
        onClick={prev}
        title="مطابقت قبلی (K)"
        className="p-1 rounded-full hover:bg-white/20 dark:hover:bg-black/20"
      ><ChevronUp className="w-3.5 h-3.5" /></button>
      <span className="tabular-nums px-1.5 whitespace-nowrap">
        <span className="font-semibold">{cursor + 1}</span>
        <span className="opacity-60"> از </span>
        <span className="font-semibold">{matchedIds.length}</span>
        <span className="opacity-60"> منطبق</span>
      </span>
      <button
        onClick={next}
        title="مطابقت بعدی (J)"
        className="p-1 rounded-full hover:bg-white/20 dark:hover:bg-black/20"
      ><ChevronDown className="w-3.5 h-3.5" /></button>
    </div>
  );
}
