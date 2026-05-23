import type { Article } from "../../../data";

export type NotifKind = "breaking" | "topic" | "digest" | "system" | "mention";

export type Notif = {
  id: string;
  kind: NotifKind;
  title: string;
  body?: string;
  ts: number;            // ms epoch
  read: boolean;
  articleId?: string;
  source?: string;
  sourceIcon?: string;
};

const KEY = "kian.mobile.notif";

export function loadNotifs(): Notif[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Notif[];
  } catch {}
  return [];
}

export function saveNotifs(list: Notif[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200))); } catch {}
}

export function markAllRead() {
  const next = loadNotifs().map((n) => ({ ...n, read: true }));
  saveNotifs(next);
  return next;
}

export function markRead(id: string) {
  const next = loadNotifs().map((n) => (n.id === id ? { ...n, read: true } : n));
  saveNotifs(next);
  return next;
}

export function removeNotif(id: string) {
  const next = loadNotifs().filter((n) => n.id !== id);
  saveNotifs(next);
  return next;
}

export function clearNotifs() { saveNotifs([]); }

/** Seed the inbox from current article feed if it's empty. */
export function seedFromArticles(articles: Article[]): Notif[] {
  const existing = loadNotifs();
  if (existing.length > 0) return existing;
  const now = Date.now();
  const picks = articles.slice(0, 8);
  const out: Notif[] = picks.map((a, i) => {
    const kind: NotifKind =
      i === 0 ? "breaking" :
      i === 1 ? "digest"   :
      i % 3 === 0 ? "topic" :
      i % 5 === 0 ? "mention" : "topic";
    return {
      id: `seed-${a.id}-${i}`,
      kind,
      title:
        kind === "breaking" ? "خبر فوری: " + a.title :
        kind === "digest"   ? "خلاصهٔ امروز شما آماده است" :
        kind === "mention"  ? "در یک گفت‌وگو از شما یاد شد" :
                              a.title,
      body:
        kind === "digest"
          ? `${picks.length} مقالهٔ منتخب از منابع دنبال‌شده`
          : a.source,
      ts: now - i * 18 * 60_000 - (i > 3 ? 6 * 3600_000 : 0),
      read: i > 4,
      articleId: a.id,
      source: a.source,
      sourceIcon: a.sourceIcon,
    };
  });
  saveNotifs(out);
  return out;
}

export function unreadCount(list?: Notif[]) {
  return (list ?? loadNotifs()).filter((n) => !n.read).length;
}
