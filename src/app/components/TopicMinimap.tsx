import { useMemo } from "react";
import type { Article } from "../data";
import type { TopicScore } from "../topics";

type Props = {
  articles: Article[];
  scores: Map<string, TopicScore>;
  active: boolean;
};

const LEVEL_COLOR: Record<TopicScore["level"], string> = {
  strong: "bg-emerald-500",
  medium: "bg-emerald-400",
  weak: "bg-emerald-300",
  none: "bg-transparent",
};

export function TopicMinimap({ articles, scores, active }: Props) {
  const items = useMemo(() => {
    if (!active) return [];
    return articles.map((a, i) => {
      const s = scores.get(a.id);
      return { id: a.id, idx: i, level: s?.level ?? "none", score: s?.score ?? 0 };
    });
  }, [articles, scores, active]);

  if (!active || !items.length) return null;
  const matched = items.filter(x => x.level !== "none");
  if (!matched.length) return null;

  const scrollTo = (id: string) => {
    const el = document.querySelector<HTMLElement>(`[data-aid="${CSS.escape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.animate(
      [
        { boxShadow: "inset 3px 0 0 rgb(99 102 241), 0 0 0 4px rgba(99,102,241,.45)" },
        { boxShadow: "inset 3px 0 0 rgb(99 102 241), 0 0 0 0 rgba(99,102,241,0)" },
      ],
      { duration: 900, easing: "ease-out" }
    );
  };

  return (
    <div
      className="absolute top-2 bottom-2 left-1 z-10 w-2 hidden md:flex flex-col gap-[2px] pointer-events-none"
      aria-label="نقشه مطابقت موضوعی"
    >
      <div className="absolute inset-0 rounded-full bg-slate-100/50 dark:bg-slate-800/40" />
      {items.map(it => {
        const top = `${(it.idx / Math.max(items.length - 1, 1)) * 100}%`;
        if (it.level === "none") return null;
        return (
          <button
            key={it.id}
            onClick={() => scrollTo(it.id)}
            title={`${Math.round(it.score * 100)}٪ منطبق`}
            style={{ top, position: "absolute" }}
            className={`pointer-events-auto -translate-y-1/2 left-0 right-0 h-[3px] rounded-full transition-all hover:scale-150 hover:h-[5px] ${LEVEL_COLOR[it.level]}`}
          />
        );
      })}
    </div>
  );
}
