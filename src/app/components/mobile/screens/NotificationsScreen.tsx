import { useEffect, useMemo, useState } from "react";
import { Bell, Trash2, CheckCheck, Zap, Newspaper, Mail, AtSign, Settings as Cog } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { SwipeRow } from "../primitives/SwipeRow";
import { EmptyState } from "../primitives/EmptyState";
import { timeAgoFa, faNum } from "../utils/fa";
import {
  loadNotifs, markAllRead, markRead, removeNotif, clearNotifs, seedFromArticles,
  type Notif, type NotifKind,
} from "../utils/notifications";
import type { Article } from "../../../data";

type Props = {
  onClose: () => void;
  articles?: Article[];
  onOpenArticle?: (id: string) => void;
};

const ICONS: Record<NotifKind, React.ReactNode> = {
  breaking: <Zap className="size-4" />,
  topic:    <Newspaper className="size-4" />,
  digest:   <Mail className="size-4" />,
  system:   <Cog className="size-4" />,
  mention:  <AtSign className="size-4" />,
};

const TONES: Record<NotifKind, string> = {
  breaking: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  topic:    "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  digest:   "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  system:   "bg-[var(--background-muted)] text-[var(--foreground-muted)]",
  mention:  "bg-amber-500/12 text-amber-600 dark:text-amber-400",
};

const LABEL: Record<NotifKind, string> = {
  breaking: "فوری",
  topic:    "موضوع دنبال‌شده",
  digest:   "خلاصهٔ روزانه",
  system:   "سیستم",
  mention:  "اشاره به شما",
};

export function NotificationsScreen({ onClose, articles, onOpenArticle }: Props) {
  const [list, setList] = useState<Notif[]>([]);
  const [tab, setTab] = useState<"all" | "unread">("all");

  useEffect(() => {
    const initial = articles && articles.length > 0
      ? seedFromArticles(articles)
      : loadNotifs();
    setList(initial);
  }, [articles]);

  const filtered = useMemo(() => {
    return tab === "unread" ? list.filter((n) => !n.read) : list;
  }, [list, tab]);

  const buckets = useMemo(() => bucketize(filtered), [filtered]);
  const unread = useMemo(() => list.filter((n) => !n.read).length, [list]);

  const onTap = (n: Notif) => {
    if (!n.read) setList(markRead(n.id));
    if (n.articleId && onOpenArticle) {
      onOpenArticle(n.articleId);
      onClose();
    }
  };

  return (
    <MobileScreen
      topbar={
        <MobileTopBar
          title="اعلان‌ها"
          subtitle={unread > 0 ? `${faNum(unread)} نخوانده` : "همه خوانده شد"}
          onBack={onClose}
        />
      }
    >
      <div className="h-full overflow-y-auto scrollbar-none">
        {/* Tabs + actions */}
        <div className="px-3 pt-3 pb-2 flex items-center gap-2">
          <div className="flex-1 inline-flex rounded-full bg-[var(--background-muted)] p-0.5 text-[12.5px]">
            {(["all", "unread"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 h-8 rounded-full tap press transition-colors ${
                  tab === t ? "bg-[var(--card)] text-[var(--foreground)] shadow-[var(--shadow-sm)]" : "text-[var(--foreground-muted)]"
                }`}
              >
                {t === "all" ? "همه" : `نخوانده‌ها ${unread > 0 ? `(${faNum(unread)})` : ""}`}
              </button>
            ))}
          </div>
          <button
            onClick={() => setList(markAllRead())}
            disabled={unread === 0}
            className="h-9 px-3 rounded-full text-[12px] inline-flex items-center gap-1 tap press disabled:opacity-40 bg-[var(--background-muted)]"
            aria-label="علامت همه به‌عنوان خوانده"
          >
            <CheckCheck className="size-3.5" /> همه را خواندم
          </button>
          <button
            onClick={() => { clearNotifs(); setList([]); }}
            disabled={list.length === 0}
            className="h-9 size-9 rounded-full grid place-items-center tap press disabled:opacity-40 bg-[var(--background-muted)] text-rose-500"
            aria-label="پاک کردن همه"
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        {list.length === 0 && (
          <EmptyState
            icon={<Bell className="size-8" />}
            title="اعلان جدیدی نیست"
            description="وقتی خبر فوری یا موضوع دنبال‌شده‌ای منتشر شود، اینجا می‌بینی."
          />
        )}

        {buckets.map((bucket) => (
          <section key={bucket.label} className="mb-4">
            <h3 className="text-[11px] font-semibold text-[var(--foreground-subtle)] uppercase tracking-wider px-4 mb-2">
              {bucket.label}
            </h3>
            <ul className="mx-3 rounded-[var(--radius-lg)] bg-[var(--card)] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
              {bucket.items.map((n) => (
                <SwipeRow
                  key={n.id}
                  endAction={{
                    label: "حذف",
                    icon: <Trash2 className="size-4" />,
                    color: "bg-rose-500",
                    onTrigger: () => setList(removeNotif(n.id)),
                  }}
                  startAction={n.read ? undefined : {
                    label: "خواندم",
                    icon: <CheckCheck className="size-4" />,
                    color: "bg-emerald-500",
                    onTrigger: () => setList(markRead(n.id)),
                  }}
                >
                  <button
                    onClick={() => onTap(n)}
                    className={`w-full text-right tap press flex gap-3 px-3.5 py-3 ${
                      !n.read ? "bg-[var(--brand-500)]/4" : ""
                    }`}
                  >
                    <span className={`size-9 rounded-full grid place-items-center shrink-0 ${TONES[n.kind]}`}>
                      {ICONS[n.kind]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10.5px] font-semibold text-[var(--foreground-subtle)]">
                          {LABEL[n.kind]}
                        </span>
                        {n.source && (
                          <span className="text-[10.5px] text-[var(--foreground-subtle)] truncate">
                            · {n.sourceIcon} {n.source}
                          </span>
                        )}
                        <span className="text-[10.5px] text-[var(--foreground-subtle)] mr-auto">
                          {timeAgoFa(n.ts)}
                        </span>
                      </div>
                      <div className={`text-[13.5px] leading-snug line-clamp-2 ${!n.read ? "font-bold" : "font-medium"}`}>
                        {n.title}
                      </div>
                      {n.body && (
                        <div className="text-[12px] text-[var(--foreground-muted)] mt-0.5 line-clamp-1">
                          {n.body}
                        </div>
                      )}
                    </div>
                    {!n.read && (
                      <span className="size-2 rounded-full bg-[var(--brand-500)] shrink-0 mt-1.5" aria-label="نخوانده" />
                    )}
                  </button>
                </SwipeRow>
              ))}
            </ul>
          </section>
        ))}

        <div className="h-6" />
      </div>
    </MobileScreen>
  );
}

function bucketize(list: Notif[]) {
  const now = Date.now();
  const day = 24 * 3600_000;
  const today: Notif[] = [];
  const yest: Notif[]  = [];
  const week: Notif[]  = [];
  const older: Notif[] = [];
  for (const n of list) {
    const d = now - n.ts;
    if (d < day) today.push(n);
    else if (d < 2 * day) yest.push(n);
    else if (d < 7 * day) week.push(n);
    else older.push(n);
  }
  return [
    { label: "امروز",        items: today },
    { label: "دیروز",        items: yest  },
    { label: "این هفته",     items: week  },
    { label: "قدیمی‌تر",     items: older },
  ].filter((b) => b.items.length > 0);
}
