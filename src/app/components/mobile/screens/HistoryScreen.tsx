import { useEffect, useMemo, useState } from "react";
import { History as HistoryIcon, Trash2 } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { ArticleCard } from "../cards/ArticleCard";
import { EmptyState } from "../primitives/EmptyState";
import { useHaptics } from "../hooks";
import { useToast } from "../primitives/Toast";
import { loadHistory, clearHistory, type HistoryEntry } from "../utils/history";
import { countFa } from "../utils/fa";
import type { Article } from "../../../data";

type Props = {
  onClose: () => void;
  articles: Article[];
  onOpen: (a: Article) => void;
  onToggleSave: (a: Article) => void;
  onLongPress?: (a: Article) => void;
};

type Bucket = { label: string; items: { article: Article; at: number }[] };

const DAY = 86_400_000;

function bucketize(entries: HistoryEntry[], byId: Map<string, Article>): Bucket[] {
  const now = Date.now();
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const today = startOfDay.getTime();
  const yest  = today - DAY;
  const week  = today - 7 * DAY;
  const buckets: Record<string, Bucket> = {
    today: { label: "امروز", items: [] },
    yesterday: { label: "دیروز", items: [] },
    week:  { label: "این هفته", items: [] },
    older: { label: "قبل‌تر", items: [] },
  };
  for (const e of entries) {
    const a = byId.get(e.id);
    if (!a) continue;
    if (e.at >= today) buckets.today.items.push({ article: a, at: e.at });
    else if (e.at >= yest) buckets.yesterday.items.push({ article: a, at: e.at });
    else if (e.at >= week) buckets.week.items.push({ article: a, at: e.at });
    else buckets.older.items.push({ article: a, at: e.at });
  }
  return Object.values(buckets).filter((b) => b.items.length > 0);
}

export function HistoryScreen({ onClose, articles, onOpen, onToggleSave, onLongPress }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => loadHistory());
  const haptic = useHaptics();
  const toast = useToast();

  useEffect(() => {
    const sync = () => setEntries(loadHistory());
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  const byId = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles]);
  const buckets = useMemo(() => bucketize(entries, byId), [entries, byId]);
  const total = useMemo(() => buckets.reduce((n, b) => n + b.items.length, 0), [buckets]);

  const clear = () => {
    haptic("heavy");
    clearHistory();
    setEntries([]);
    toast({ kind: "info", title: "تاریخچه پاک شد" });
  };

  return (
    <MobileScreen
      topbar={
        <MobileTopBar
          title="تاریخچهٔ مطالعه"
          subtitle={countFa(total, "مقاله")}
          onBack={onClose}
          trailing={
            total > 0 ? (
              <button
                onClick={clear}
                aria-label="پاک کردن تاریخچه"
                className="size-10 grid place-items-center rounded-full tap press text-rose-500 active:bg-[var(--accent)]"
              >
                <Trash2 className="size-5" />
              </button>
            ) : null
          }
        />
      }
    >
      {total === 0 ? (
        <EmptyState
          icon={<HistoryIcon className="size-6" />}
          title="هنوز چیزی نخونده‌ای"
          description="هر مقاله‌ای که باز کنی، اینجا نگهداری می‌شه."
        />
      ) : (
        <div className="h-full overflow-y-auto scrollbar-none pb-4">
          {buckets.map((b, bi) => (
            <section key={b.label} className="mt-4">
              <div className="px-4 mb-1.5 text-[11.5px] font-semibold text-[var(--foreground-subtle)] tracking-wide">
                {b.label}
              </div>
              <div className="mx-3 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-subtle)]">
                {b.items.map((it, i) => (
                  <div key={`${bi}-${it.article.id}-${i}`} style={{ ["--i" as string]: i }} className="stagger-child">
                    <ArticleCard article={it.article} onOpen={onOpen} onToggleSave={onToggleSave} onLongPress={onLongPress} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </MobileScreen>
  );
}
