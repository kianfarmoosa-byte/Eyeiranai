import { useMemo, useRef, useState } from "react";
import { Pen, Bookmark, Share2 } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { MobileFab } from "../shell/MobileFab";
import { ArticleCard } from "../cards/ArticleCard";
import { StoryRail } from "../cards/StoryRail";
import { NewsStoriesRibbon } from "../cards/NewsStoriesRibbon";
import { BUILT_IN_TOPICS, scoreArticleForTopic } from "../../../topics";
import { PullIndicator } from "../primitives/PullIndicator";
import { ArticleCardSkeleton } from "../primitives/Skeleton";
import { SwipeRow } from "../primitives/SwipeRow";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { ChipScroller } from "../primitives/ChipScroller";
import { EmptyState } from "../primitives/EmptyState";
import { usePullToRefresh } from "../hooks";
import { countFa } from "../utils/fa";
import type { Article } from "../../../data";

type Filter = "all" | "unread" | "saved";

type Props = {
  articles: Article[];
  onOpen: (a: Article) => void;
  onToggleSave: (a: Article) => void;
  onLongPress?: (a: Article) => void;
  onRefresh?: () => Promise<void> | void;
  onSearch?: () => void;
  onMenu?: () => void;
  onCompose?: () => void;
};

export function HomeScreen({ articles, onOpen, onToggleSave, onLongPress, onRefresh, onSearch, onMenu, onCompose }: Props) {
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const refresh = async () => {
    setLoading(true);
    try { await onRefresh?.(); } finally { setLoading(false); }
  };
  const { pull, triggered, handlers } = usePullToRefresh({ onRefresh: refresh, scrollRef });

  const unreadCount = useMemo(() => articles.filter((a) => !a.read).length, [articles]);
  const savedCount = useMemo(() => articles.filter((a) => a.starred).length, [articles]);
  const sources = useMemo(() => {
    const map = new Map<string, { count: number; icon: string }>();
    for (const a of articles) {
      const cur = map.get(a.source) ?? { count: 0, icon: a.sourceIcon };
      cur.count += 1;
      map.set(a.source, cur);
    }
    return [...map.entries()].map(([id, v]) => ({ id, label: id, count: v.count, leading: <span>{v.icon}</span> }));
  }, [articles]);

  const filtered = useMemo(() => {
    let r = articles;
    if (filter === "unread") r = r.filter((a) => !a.read);
    else if (filter === "saved") r = r.filter((a) => a.starred);
    if (activeSource) r = r.filter((a) => a.source === activeSource);
    if (activeTopic) {
      const topic = BUILT_IN_TOPICS.find((t) => t.id === activeTopic);
      if (topic) r = r.filter((a) => scoreArticleForTopic(a, topic).score > 0);
    }
    return r;
  }, [articles, filter, activeSource, activeTopic]);

  const [hero, ...rest] = filtered;

  return (
    <MobileScreen
      topbar={<MobileTopBar title={<span className="text-[18px] font-black tracking-tight text-[var(--foreground)]">FLOW</span>} subtitle={countFa(articles.length, "مقاله")} onMenu={onMenu} onSearch={onSearch} loading={loading} onRefresh={refresh} />}
      fab={<MobileFab icon={<Pen className="size-6" />} label="نوشتن" onClick={onCompose} />}
    >
      <div ref={scrollRef} {...handlers} className="h-full overflow-y-auto scrollbar-none">
        <PullIndicator pull={pull} triggered={triggered} loading={loading} />
        <StoryRail articles={articles} activeTopicId={activeTopic} onPick={setActiveTopic} />
        <NewsStoriesRibbon articles={articles} onOpen={onOpen} />
        <div className="px-3 pt-1 pb-4 flex flex-col gap-3">
          <SegmentedControl<Filter>
            value={filter}
            onChange={setFilter}
            segments={[
              { id: "all",    label: "همه" },
              { id: "unread", label: "نخوانده", badge: unreadCount },
              { id: "saved",  label: "ذخیره",   badge: savedCount },
            ]}
          />
          {sources.length > 1 && (
            <ChipScroller items={sources} value={activeSource} onChange={setActiveSource} />
          )}
          {articles.length === 0 && loading && (
            <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-subtle)]">
              {Array.from({ length: 6 }).map((_, i) => <ArticleCardSkeleton key={i} />)}
            </div>
          )}
          {filtered.length === 0 && !loading && (
            <EmptyState
              title={filter === "unread" ? "همه‌چیز خونده شده" : filter === "saved" ? "چیزی ذخیره نشده" : "خبری نیست"}
              description={filter === "unread" ? "آفرین! به آخر فید رسیدی." : undefined}
            />
          )}
          {hero && (
            <ArticleCard variant="hero" article={hero} onOpen={onOpen} onToggleSave={onToggleSave} onLongPress={onLongPress} />
          )}
          {rest.length > 0 && (
            <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-subtle)]">
              {rest.map((a) => (
                <SwipeRow
                  key={a.id}
                  startAction={{
                    label: a.starred ? "حذف" : "ذخیره",
                    icon: <Bookmark className="size-4" />,
                    color: "bg-[var(--brand-500)]",
                    onTrigger: () => onToggleSave(a),
                  }}
                  endAction={{
                    label: "اشتراک",
                    icon: <Share2 className="size-4" />,
                    color: "bg-emerald-500",
                    onTrigger: () => {
                      if (navigator.share) navigator.share({ title: a.title, url: a.link ?? location.href }).catch(() => {});
                    },
                  }}
                >
                  <ArticleCard article={a} onOpen={onOpen} onToggleSave={onToggleSave} onLongPress={onLongPress} />
                </SwipeRow>
              ))}
            </div>
          )}
        </div>
      </div>
    </MobileScreen>
  );
}
