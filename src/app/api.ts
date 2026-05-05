import { projectId, publicAnonKey } from "../../utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-a2e7e82a`;

async function req(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${publicAnonKey}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    console.log(`API ${path} failed:`, res.status, text);
    throw new Error(`API ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export type RemoteFeed = { id: string; url: string; name: string; icon: string };

export type TagRule = {
  id: string;
  name: string;
  tag: string;
  keywords: string[];
  fields?: ("title" | "preview" | "content" | "source")[];
  enabled: boolean;
};
export type RemoteArticle = {
  id: string;
  feedId: string;
  title: string;
  link: string;
  source: string;
  sourceIcon: string;
  author: string;
  date: string;
  preview: string;
  content: string;
  image?: string;
  read: boolean;
  starred: boolean;
  readTime: string;
  tags?: string[];
};

export const api = {
  listFeeds: () => req("/feeds").then(r => r.feeds as RemoteFeed[]),
  addFeed: (url: string, name?: string, icon?: string, category?: string) =>
    req("/feeds", { method: "POST", body: JSON.stringify({ url, name, icon, category }) }),
  bulkAdd: (feeds: { url: string; name: string; icon?: string; category?: string }[]) =>
    req("/feeds/bulk", { method: "POST", body: JSON.stringify({ feeds }) }),
  clearFeeds: () => req("/feeds/clear", { method: "POST" }),
  removeFeed: (id: string) => req(`/feeds/${id}`, { method: "DELETE" }),
  listArticles: (opts: { limit?: number; feedId?: string; category?: string; offset?: number } = {}) => {
    const p = new URLSearchParams();
    if (opts.limit) p.set("limit", String(opts.limit));
    if (opts.feedId) p.set("feedId", opts.feedId);
    if (opts.category) p.set("category", opts.category);
    if (opts.offset) p.set("offset", String(opts.offset));
    const qs = p.toString();
    return req(`/articles${qs ? `?${qs}` : ""}`).then(r => r.articles as RemoteArticle[]);
  },
  listArticlesPage: (opts: { limit?: number; category?: string; offset?: number } = {}) => {
    const p = new URLSearchParams();
    if (opts.limit) p.set("limit", String(opts.limit));
    if (opts.category) p.set("category", opts.category);
    if (opts.offset) p.set("offset", String(opts.offset));
    const qs = p.toString();
    return req(`/articles${qs ? `?${qs}` : ""}`).then(r => r as { articles: RemoteArticle[]; total: number; fetched: number });
  },
  markRead: (id: string) => req("/state/read", { method: "POST", body: JSON.stringify({ id }) }),
  setStar: (id: string, starred: boolean) =>
    req("/state/star", { method: "POST", body: JSON.stringify({ id, starred }) }),
  setTags: (id: string, tags: string[]) =>
    req("/tags", { method: "POST", body: JSON.stringify({ id, tags }) }),
  listTags: () => req("/tags").then(r => r.tags as Record<string, string[]>),
  feedStatus: () => req("/feeds/status").then(r => r.status as Record<string, { ok: boolean; error?: string; lastOk?: number; lastFail?: number }>),
  importOpml: (xml: string) => req("/opml", { method: "POST", body: JSON.stringify({ xml }) }),
  listRules: () => req("/rules").then(r => r.rules as TagRule[]),
  saveRule: (rule: Partial<TagRule>) => req("/rules", { method: "POST", body: JSON.stringify(rule) }).then(r => r.rules as TagRule[]),
  deleteRule: (id: string) => req(`/rules/${id}`, { method: "DELETE" }),
  search: (q: string) => req(`/search?q=${encodeURIComponent(q)}`).then(r => r.results as RemoteArticle[]),
  opmlUrl: `${BASE}/opml`,
  opmlAuth: `Bearer ${publicAnonKey}`,
};
