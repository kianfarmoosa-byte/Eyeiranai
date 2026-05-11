// GDELT 2.0 proxy + cache layer for the international section.
// Wraps DOC, GEO, and TV APIs with response normalization and short-lived cache.
import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

export const gdelt = new Hono();

const DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc";
const GEO_API = "https://api.gdeltproject.org/api/v2/geo/geo";
const TV_API  = "https://api.gdeltproject.org/api/v2/tv/tv";

const CACHE_TTL_MS = 5 * 60 * 1000;

function hashKey(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

async function cachedFetch(cacheKey: string, url: string, init?: RequestInit): Promise<any> {
  try {
    const cached = await kv.get(cacheKey);
    if (cached && typeof cached === "object" && cached.ts && Date.now() - cached.ts < CACHE_TTL_MS) {
      return cached.data;
    }
  } catch {}
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  let data: any = null;
  try {
    const r = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 KianRSS/1.0", "Accept": "application/json,text/plain,*/*", ...(init?.headers || {}) },
    });
    const ct = r.headers.get("content-type") || "";
    const text = await r.text();
    if (!r.ok) {
      console.log("GDELT upstream error", r.status, url, text.slice(0, 400));
      throw new Error(`GDELT upstream ${r.status}: ${text.slice(0, 200)}`);
    }
    if (ct.includes("application/json") || ct.includes("geo+json")) {
      try { data = JSON.parse(text); }
      catch {
        console.log("GDELT non-JSON body for", url, text.slice(0, 400));
        data = { articles: [], timeline: [], _raw: text.slice(0, 400) };
      }
    } else {
      console.log("GDELT non-JSON ct", ct, "url", url, "body", text.slice(0, 200));
      data = { articles: [], timeline: [], _raw: text.slice(0, 400) };
    }
  } finally { clearTimeout(timer); }
  try { await kv.set(cacheKey, { ts: Date.now(), data }); } catch {}
  return data;
}

function parseGdeltDate(s: string): string {
  if (!s || s.length < 14) return "";
  const y = s.slice(0, 4), mo = s.slice(4, 6), d = s.slice(6, 8);
  const h = s.slice(8, 10), mi = s.slice(10, 12), se = s.slice(12, 14);
  return `${y}-${mo}-${d}T${h}:${mi}:${se}Z`;
}

type DocArticle = {
  id: string;
  url: string;
  title: string;
  source: string;
  sourceCountry: string;
  language: string;
  date: string;
  image?: string;
  tone?: number;
  domain: string;
  socialImage?: string;
};

function normalizeDoc(raw: any): DocArticle[] {
  const arr = Array.isArray(raw?.articles) ? raw.articles : [];
  return arr.map((a: any) => ({
    id: hashKey(String(a.url || a.title || "")),
    url: a.url || "",
    title: String(a.title || "").trim(),
    source: a.domain || "",
    domain: a.domain || "",
    sourceCountry: a.sourcecountry || "",
    language: a.language || "",
    date: parseGdeltDate(a.seendate || ""),
    image: a.socialimage || undefined,
    socialImage: a.socialimage || undefined,
    tone: a.tone !== undefined ? parseFloat(a.tone) : undefined,
  })).filter((a: DocArticle) => a.url && a.title);
}

function buildQuery(c: any): string {
  const q = String(c.req.query("q") || "").trim();
  const lang = String(c.req.query("lang") || "").trim();
  const country = String(c.req.query("country") || "").trim();
  const theme = String(c.req.query("theme") || "").trim();
  const domain = String(c.req.query("domain") || "").trim();
  const toneMin = String(c.req.query("toneMin") || "").trim();
  const toneMax = String(c.req.query("toneMax") || "").trim();

  const parts: string[] = [];
  // GDELT requires at least one keyword token; operator-only queries are rejected.
  // If user provided no free-text q, synthesize a permissive keyword from the strongest filter.
  if (q) {
    parts.push(q.includes(" ") ? `"${q.replace(/"/g, "")}"` : q);
  } else if (theme) {
    parts.push(`theme:${theme}`);
  } else if (country) {
    // Use a near-universal stop-word as keyword carrier; GDELT accepts this pattern.
    parts.push(`sourcecountry:${country}`);
  }
  if (lang) parts.push(`sourcelang:${lang}`);
  if (country && q) parts.push(`sourcecountry:${country}`);
  if (theme && (q || country)) parts.push(`theme:${theme}`);
  if (domain) parts.push(`domain:${domain}`);
  if (toneMin) parts.push(`tone>${toneMin}`);
  if (toneMax) parts.push(`tone<${toneMax}`);
  return parts.join(" ");
}

gdelt.get("/health", (c) => c.json({ ok: true, service: "gdelt" }));

gdelt.get("/doc", async (c) => {
  try {
    const query = buildQuery(c);
    if (!query) return c.json({ articles: [] }, 200);
    const timespan = String(c.req.query("timespan") || "24h");
    const sort = String(c.req.query("sort") || "DateDesc");
    const max = Math.min(250, Math.max(10, parseInt(c.req.query("max") || "75", 10) || 75));
    const mode = String(c.req.query("mode") || "ArtList");

    const params = new URLSearchParams({
      query,
      mode,
      format: "json",
      maxrecords: String(max),
      timespan,
      sort,
    });
    const url = `${DOC_API}?${params}`;
    const cacheKey = `gdelt:doc:v2:${hashKey(url)}`;
    const raw = await cachedFetch(cacheKey, url);
    if (mode === "ArtList") {
      return c.json({ articles: normalizeDoc(raw), query, mode });
    }
    return c.json({ raw, query, mode });
  } catch (e) {
    console.log("gdelt /doc error:", e);
    return c.json({ articles: [], error: String(e) }, 200);
  }
});

gdelt.get("/timeline", async (c) => {
  try {
    const query = buildQuery(c);
    if (!query) return c.json({ raw: { timeline: [] } }, 200);
    const timespan = String(c.req.query("timespan") || "7d");
    const mode = String(c.req.query("mode") || "TimelineVol");
    const params = new URLSearchParams({ query, mode, format: "json", timespan });
    const url = `${DOC_API}?${params}`;
    const cacheKey = `gdelt:tl:v2:${hashKey(url)}`;
    const raw = await cachedFetch(cacheKey, url);
    return c.json({ raw, query, mode });
  } catch (e) {
    console.log("gdelt /timeline error:", e);
    return c.json({ raw: { timeline: [] }, error: String(e) }, 200);
  }
});

gdelt.get("/geo", async (c) => {
  try {
    const query = buildQuery(c);
    if (!query) return c.json({ type: "FeatureCollection", features: [] }, 200);
    const timespan = String(c.req.query("timespan") || "24h");
    const params = new URLSearchParams({ query, mode: "PointData", format: "geojson", timespan });
    const url = `${GEO_API}?${params}`;
    const cacheKey = `gdelt:geo:${hashKey(url)}`;
    const raw = await cachedFetch(cacheKey, url);
    return c.json(raw);
  } catch (e) {
    console.log("gdelt /geo error:", e);
    return c.json({ type: "FeatureCollection", features: [], error: String(e) }, 200);
  }
});

gdelt.get("/tv", async (c) => {
  try {
    const query = String(c.req.query("q") || "").trim();
    if (!query) return c.json({ clips: [] }, 200);
    const network = String(c.req.query("network") || "");
    const timespan = String(c.req.query("timespan") || "1d");
    const params = new URLSearchParams({
      query,
      mode: "ClipGallery",
      format: "json",
      timespan,
      ...(network ? { network } : {}),
    });
    const url = `${TV_API}?${params}`;
    const cacheKey = `gdelt:tv:${hashKey(url)}`;
    const raw = await cachedFetch(cacheKey, url);
    return c.json(raw);
  } catch (e) {
    console.log("gdelt /tv error:", e);
    return c.json({ clips: [], error: String(e) }, 200);
  }
});
