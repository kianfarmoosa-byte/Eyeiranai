import type { Article } from "../../../data";
import type { SocialAlert } from "../../../api";
import { faNum } from "./fa";

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

/**
 * Prepend a notification, de-duplicating by id. Returns the new list.
 * If an id is provided and already exists, the list is left unchanged so the
 * same event (e.g. one failed publish) never produces duplicate alerts.
 */
export function addNotif(n: Omit<Notif, "ts" | "read"> & { ts?: number; read?: boolean }): Notif[] {
  const list = loadNotifs();
  if (n.id && list.some((x) => x.id === n.id)) return list;
  const entry: Notif = {
    read: false,
    ts: Date.now(),
    ...n,
    id: n.id || `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
  const next = [entry, ...list];
  saveNotifs(next);
  return next;
}

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
          ? `${faNum(picks.length)} مقالهٔ منتخب از منابع دنبال‌شده`
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

/**
 * Fold Social-Listening burst/emerging alerts into the in-app inbox.
 * De-duplicates by the alert id (reused as the notif id), so the same alert is
 * only ever surfaced once even if the feed is polled repeatedly.
 */
export function addSocialAlertNotifs(alerts: SocialAlert[]): Notif[] {
  let list = loadNotifs();
  // Insert oldest → newest so the freshest alert ends up on top.
  for (const a of [...alerts].sort((x, y) => x.ts - y.ts)) {
    if (list.some((n) => n.id === a.id)) continue;
    const title =
      a.kind === "emerging" ? `ترند نوظهور: «${a.term}»` :
      a.kind === "burst"    ? `جهش در «${a.term}»` :
      a.kind === "crisis"   ? `بحران شهرت: موج منفی دربارهٔ «${a.topicLabel}»` :
      a.kind === "mention"  ? `${faNum(a.count)} اشارهٔ تازه به «${a.topicLabel}»` :
                              "جهش در حجم گفتگوها";
    list = addNotif({
      id: a.id,
      kind: a.kind === "mention" ? "mention" : "topic",
      title,
      body: a.sampleText || `${faNum(a.count)} اشاره در «${a.topicLabel}»`,
      ts: a.ts,
      source: a.topicLabel,
      sourceIcon: "📡",
    });
  }
  return list;
}
