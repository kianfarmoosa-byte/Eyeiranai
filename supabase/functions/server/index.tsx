import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { XMLParser } from "npm:fast-xml-parser";
import * as kv from "./kv_store.tsx";

const app = new Hono();

app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const BASE = "/make-server-a2e7e82a";
const FEEDS_KEY = "feeds:list";
const READ_KEY = "state:read";
const STARRED_KEY = "state:starred";
const TAGS_KEY = "state:tags";
const FEED_STATUS_KEY = "feeds:status";
const RULES_KEY = "state:rules";

type TagRule = {
  id: string;
  name: string;
  tag: string;
  keywords: string[];
  fields?: ("title" | "preview" | "content" | "source")[];
  enabled: boolean;
};

function applyRules(item: any, rules: TagRule[]): string[] {
  const hits = new Set<string>();
  for (const r of rules) {
    if (!r.enabled || !r.keywords?.length) continue;
    const fields = r.fields?.length ? r.fields : ["title", "preview", "content"];
    const haystack = fields.map(f => String(item[f] || "")).join(" ").toLowerCase();
    if (r.keywords.some(k => k && haystack.includes(k.toLowerCase()))) hits.add(r.tag);
  }
  return Array.from(hits);
}

app.get(`${BASE}/health`, (c) => c.json({ status: "ok" }));

function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function extractImage(item: any): string | undefined {
  if (item?.["media:content"]?.["@_url"]) return item["media:content"]["@_url"];
  if (item?.["media:thumbnail"]?.["@_url"]) return item["media:thumbnail"]["@_url"];
  if (item?.enclosure?.["@_url"]) return item.enclosure["@_url"];
  const html = item?.["content:encoded"] || item?.description || item?.summary || "";
  const text = typeof html === "string" ? html : html?.["#text"] || "";
  const match = text.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
}

function getText(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return v["#text"] || v["@_href"] || "";
  return String(v);
}

async function fetchAndParseFeed(url: string, feedId: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 RSSReader" }, signal: ctrl.signal });
  } finally { clearTimeout(timer); }
  if (!res.ok) throw new Error(`fetch failed ${res.status}`);
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(xml);

  const channel = parsed?.rss?.channel || parsed?.feed;
  if (!channel) throw new Error("invalid feed format");

  const feedTitle = getText(channel.title) || url;
  const rawItems = channel.item || channel.entry || [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items.slice(0, 30).map((it: any, i: number) => {
    const title = getText(it.title);
    const link = typeof it.link === "string" ? it.link : (it.link?.["@_href"] || it.link?.["#text"] || "");
    const pubDate = getText(it.pubDate || it.published || it.updated);
    const description = getText(it.description || it.summary);
    const content = getText(it["content:encoded"] || it.content || it.description || it.summary);
    const id = `${feedId}-${link || i}`;
    return {
      id,
      feedId,
      title: stripHtml(title),
      link,
      source: feedTitle,
      author: getText(it.author || it["dc:creator"]) || feedTitle,
      date: pubDate,
      preview: stripHtml(description).slice(0, 280),
      content: stripHtml(content),
      image: extractImage(it),
    };
  });
}

app.get(`${BASE}/feeds`, async (c) => {
  const list = (await kv.get(FEEDS_KEY)) || [];
  return c.json({ feeds: list });
});

app.post(`${BASE}/feeds`, async (c) => {
  try {
    const { url, name, icon, category } = await c.req.json();
    if (!url) return c.json({ error: "url required" }, 400);
    const list = (await kv.get(FEEDS_KEY)) || [];
    if (list.some((f: any) => f.url === url)) return c.json({ feed: list.find((f: any) => f.url === url) });
    const id = `feed_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const feed = { id, url, name: name || url, icon: icon || "📡", category: category || "" };
    list.push(feed);
    await kv.set(FEEDS_KEY, list);
    return c.json({ feed });
  } catch (e) {
    console.log("add feed error:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.post(`${BASE}/feeds/bulk`, async (c) => {
  try {
    const { feeds: incoming } = await c.req.json();
    if (!Array.isArray(incoming)) return c.json({ error: "feeds array required" }, 400);
    const list = (await kv.get(FEEDS_KEY)) || [];
    const existing = new Set(list.map((f: any) => f.url));
    let added = 0;
    for (const it of incoming) {
      if (!it?.url || existing.has(it.url)) continue;
      const id = `feed_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      list.push({ id, url: it.url, name: it.name || it.url, icon: it.icon || "📡", category: it.category || "" });
      existing.add(it.url);
      added++;
    }
    await kv.set(FEEDS_KEY, list);
    return c.json({ added, total: list.length });
  } catch (e) {
    console.log("bulk add error:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.post(`${BASE}/feeds/clear`, async (c) => {
  await kv.set(FEEDS_KEY, []);
  return c.json({ ok: true });
});

app.delete(`${BASE}/feeds/:id`, async (c) => {
  const id = c.req.param("id");
  const list = (await kv.get(FEEDS_KEY)) || [];
  const next = list.filter((f: any) => f.id !== id);
  await kv.set(FEEDS_KEY, next);
  return c.json({ ok: true });
});

app.get(`${BASE}/articles`, async (c) => {
  const list = (await kv.get(FEEDS_KEY)) || [];
  const readIds = new Set((await kv.get(READ_KEY)) || []);
  const starredIds = new Set((await kv.get(STARRED_KEY)) || []);
  const limitParam = Number(c.req.query("limit") || "60");
  const offsetParam = Number(c.req.query("offset") || "0");
  const feedIdParam = c.req.query("feedId");
  const categoryParam = c.req.query("category");
  let pool = list;
  if (categoryParam) {
    const q = categoryParam.toLowerCase();
    pool = list.filter((f: any) => (f.category || "").toLowerCase().includes(q));
  }
  const targets = feedIdParam
    ? list.filter((f: any) => f.id === feedIdParam)
    : pool.slice(offsetParam, offsetParam + limitParam);
  const totalPool = pool.length;

  const tags: Record<string, string[]> = (await kv.get(TAGS_KEY)) || {};
  const rules: TagRule[] = (await kv.get(RULES_KEY)) || [];
  const status: Record<string, { ok: boolean; error?: string; lastOk?: number; lastFail?: number }> =
    (await kv.get(FEED_STATUS_KEY)) || {};

  const CONCURRENCY = 8;
  const all: any[] = [];
  let idx = 0;
  async function worker() {
    while (idx < targets.length) {
      const feed = targets[idx++];
      try {
        const items = await fetchAndParseFeed(feed.url, feed.id);
        status[feed.id] = { ok: true, lastOk: Date.now() };
        for (const it of items.slice(0, 15)) {
          const enriched = {
            ...it,
            source: feed.name || it.source,
            sourceIcon: feed.icon || "📡",
            category: feed.category || "",
          };
          const autoTags = applyRules(enriched, rules);
          const userTags = tags[it.id] || [];
          all.push({
            ...enriched,
            read: readIds.has(it.id),
            starred: starredIds.has(it.id),
            tags: Array.from(new Set([...userTags, ...autoTags])),
            autoTags,
            readTime: `${Math.max(1, Math.ceil(it.content.length / 800))} دقیقه`,
          });
        }
      } catch (e) {
        const msg = String(e).slice(0, 200);
        console.log(`feed ${feed.url} failed:`, msg);
        const prev = status[feed.id] || {};
        status[feed.id] = { ok: false, error: msg, lastOk: prev.lastOk, lastFail: Date.now() };
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await kv.set(FEED_STATUS_KEY, status);
  all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  try { await kv.set("articles:latest", { ts: Date.now(), items: all }); } catch {}
  return c.json({ articles: all, feedsCount: list.length, fetched: targets.length, total: totalPool, status });
});

app.get(`${BASE}/feeds/status`, async (c) => {
  const status = (await kv.get(FEED_STATUS_KEY)) || {};
  return c.json({ status });
});

app.get(`${BASE}/tags`, async (c) => {
  const tags = (await kv.get(TAGS_KEY)) || {};
  return c.json({ tags });
});

app.post(`${BASE}/tags`, async (c) => {
  const { id, tags: newTags } = await c.req.json();
  if (!id || !Array.isArray(newTags)) return c.json({ error: "id and tags required" }, 400);
  const tags: Record<string, string[]> = (await kv.get(TAGS_KEY)) || {};
  if (newTags.length === 0) delete tags[id];
  else tags[id] = Array.from(new Set(newTags.map((t: string) => String(t).trim()).filter(Boolean)));
  await kv.set(TAGS_KEY, tags);
  return c.json({ ok: true, tags: tags[id] || [] });
});

app.get(`${BASE}/opml`, async (c) => {
  const list = (await kv.get(FEEDS_KEY)) || [];
  const byCat = new Map<string, any[]>();
  for (const f of list) {
    const k = f.category || "سایر";
    if (!byCat.has(k)) byCat.set(k, []);
    byCat.get(k)!.push(f);
  }
  const esc = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  let body = `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head><title>RSS Subscriptions</title></head>\n  <body>\n`;
  for (const [cat, feeds] of byCat) {
    body += `    <outline text="${esc(cat)}" title="${esc(cat)}">\n`;
    for (const f of feeds) {
      body += `      <outline type="rss" text="${esc(f.name)}" title="${esc(f.name)}" xmlUrl="${esc(f.url)}" />\n`;
    }
    body += `    </outline>\n`;
  }
  body += `  </body>\n</opml>`;
  return new Response(body, { headers: { "Content-Type": "text/xml; charset=utf-8" } });
});

app.post(`${BASE}/opml`, async (c) => {
  try {
    const { xml } = await c.req.json();
    if (!xml) return c.json({ error: "xml required" }, 400);
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const parsed = parser.parse(xml);
    const body = parsed?.opml?.body;
    if (!body) return c.json({ error: "invalid OPML" }, 400);

    const collected: any[] = [];
    function walk(node: any, parentCat = "") {
      if (!node) return;
      const outlines = Array.isArray(node.outline) ? node.outline : (node.outline ? [node.outline] : []);
      for (const o of outlines) {
        const url = o["@_xmlUrl"];
        const name = o["@_title"] || o["@_text"] || url;
        const cat = parentCat || o["@_text"] || "سایر";
        if (url) {
          collected.push({ url, name, category: parentCat || "سایر" });
        } else {
          walk(o, cat);
        }
      }
    }
    walk(body);

    const existing = (await kv.get(FEEDS_KEY)) || [];
    const existingUrls = new Set(existing.map((f: any) => f.url));
    let added = 0;
    for (const it of collected) {
      if (existingUrls.has(it.url)) continue;
      const id = `feed_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      existing.push({ id, url: it.url, name: it.name, icon: "📡", category: it.category });
      existingUrls.add(it.url);
      added++;
    }
    await kv.set(FEEDS_KEY, existing);
    return c.json({ added, total: existing.length });
  } catch (e) {
    console.log("opml import error:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.post(`${BASE}/state/read`, async (c) => {
  const { id } = await c.req.json();
  const list: string[] = (await kv.get(READ_KEY)) || [];
  if (!list.includes(id)) list.push(id);
  await kv.set(READ_KEY, list);
  return c.json({ ok: true });
});

app.post(`${BASE}/state/star`, async (c) => {
  const { id, starred } = await c.req.json();
  const list: string[] = (await kv.get(STARRED_KEY)) || [];
  const set = new Set(list);
  if (starred) set.add(id); else set.delete(id);
  await kv.set(STARRED_KEY, Array.from(set));
  return c.json({ ok: true });
});

app.get(`${BASE}/rules`, async (c) => {
  const rules = (await kv.get(RULES_KEY)) || [];
  return c.json({ rules });
});

app.post(`${BASE}/rules`, async (c) => {
  try {
    const body = await c.req.json();
    const rules: TagRule[] = (await kv.get(RULES_KEY)) || [];
    if (body.id) {
      const idx = rules.findIndex(r => r.id === body.id);
      if (idx >= 0) rules[idx] = { ...rules[idx], ...body };
      else rules.push(body);
    } else {
      const id = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      rules.push({ id, enabled: true, keywords: [], fields: ["title", "preview", "content"], ...body });
    }
    await kv.set(RULES_KEY, rules);
    return c.json({ rules });
  } catch (e) {
    console.log("rules save error:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.delete(`${BASE}/rules/:id`, async (c) => {
  const id = c.req.param("id");
  const rules: TagRule[] = (await kv.get(RULES_KEY)) || [];
  await kv.set(RULES_KEY, rules.filter(r => r.id !== id));
  return c.json({ ok: true });
});

app.get(`${BASE}/search`, async (c) => {
  const q = (c.req.query("q") || "").trim().toLowerCase();
  if (!q) return c.json({ results: [] });
  const list = (await kv.get(FEEDS_KEY)) || [];
  const readIds = new Set((await kv.get(READ_KEY)) || []);
  const starredIds = new Set((await kv.get(STARRED_KEY)) || []);
  const tags: Record<string, string[]> = (await kv.get(TAGS_KEY)) || {};
  const rules: TagRule[] = (await kv.get(RULES_KEY)) || [];

  const CONCURRENCY = 8;
  const results: any[] = [];
  let idx = 0;
  async function worker() {
    while (idx < list.length && results.length < 200) {
      const feed = list[idx++];
      try {
        const items = await fetchAndParseFeed(feed.url, feed.id);
        for (const it of items) {
          const hay = `${it.title} ${it.preview} ${it.content}`.toLowerCase();
          if (!hay.includes(q)) continue;
          const enriched = { ...it, source: feed.name || it.source, sourceIcon: feed.icon || "📡", category: feed.category || "" };
          const autoTags = applyRules(enriched, rules);
          results.push({
            ...enriched,
            read: readIds.has(it.id),
            starred: starredIds.has(it.id),
            tags: Array.from(new Set([...(tags[it.id] || []), ...autoTags])),
            readTime: `${Math.max(1, Math.ceil(it.content.length / 800))} دقیقه`,
          });
          if (results.length >= 200) break;
        }
      } catch (e) {
        console.log(`search fetch ${feed.url} failed:`, String(e).slice(0, 100));
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return c.json({ results, total: results.length });
});


Deno.serve(app.fetch);
