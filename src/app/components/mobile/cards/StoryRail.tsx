import { useMemo } from "react";
import type { Article } from "../../../data";
import { BUILT_IN_TOPICS, scoreArticleForTopic, type Topic } from "../../../topics";
import { faNum } from "../utils/fa";

type Props = {
  articles: Article[];
  activeTopicId: string | null;
  onPick: (topicId: string | null) => void;
};

/**
 * Minimal horizontal chip rail — matches the SegmentedControl/ChipScroller
 * aesthetic. Uses only the blue/white palette: neutral muted background for
 * inactive chips, --brand-500 for the active chip.
 */
export function StoryRail({ articles, activeTopicId, onPick }: Props) {
  const items = useMemo(() => {
    return BUILT_IN_TOPICS.map((t) => {
      const matches = articles.filter((a) => scoreArticleForTopic(a, t).score > 0);
      const unread = matches.filter((a) => !a.read).length;
      return { topic: t, total: matches.length, unread };
    }).filter((x) => x.total > 0);
  }, [articles]);

  if (items.length === 0) return null;

  return (
    <div className="px-2 pt-1 pb-2">
      <div className="flex gap-2 overflow-x-auto scrollbar-none snap-x px-2">
        <Chip
          active={activeTopicId === null}
          onClick={() => onPick(null)}
          label="همه"
          count={articles.length}
        />
        {items.map(({ topic, unread }) => (
          <Chip
            key={topic.id}
            active={activeTopicId === topic.id}
            onClick={() => onPick(activeTopicId === topic.id ? null : topic.id)}
            label={topic.name}
            count={unread}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({
  active, onClick, label, count,
}: {
  active: boolean; onClick: () => void; label: string; count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 snap-start h-8 inline-flex items-center gap-1.5 px-3 rounded-full text-[12.5px] tap press transition-colors ${
        active
          ? "bg-[var(--brand-500)] text-white font-semibold"
          : "bg-[var(--background-muted)] text-[var(--foreground-muted)] font-medium"
      }`}
    >
      <span className="leading-none">{label}</span>
      {count > 0 && (
        <span
          className={`text-[10.5px] tabular-nums leading-none px-1.5 py-0.5 rounded-full ${
            active ? "bg-white/20 text-white" : "bg-[var(--background)] text-[var(--foreground-subtle)]"
          }`}
        >
          {faNum(count > 99 ? 99 : count)}
        </span>
      )}
    </button>
  );
}
