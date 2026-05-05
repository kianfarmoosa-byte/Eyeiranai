// Bundle 8 — Source Hub: multi-platform source discovery, URL transforms, OPML.
//
// Strategy: the existing server only fetches RSS/Atom feeds. We transform
// user-friendly inputs (YouTube channels, Twitter handles, Telegram channels,
// Substack newsletters, podcast pages) into RSS-compatible URLs the server
// can already parse. This avoids server changes while massively expanding
// what users can subscribe to.

export type SourceKind =
  | "rss"
  | "youtube"
  | "podcast"
  | "twitter"
  | "telegram"
  | "newsletter"
  | "reddit"
  | "github"
  | "medium"
  | "site";

export type DetectedSource = {
  kind: SourceKind;
  url: string;            // canonical feed URL the server can fetch
  name: string;
  icon: string;
  category: string;
  note?: string;          // optional caveat (e.g. "via Nitter mirror")
};

const NITTER = "https://nitter.net";
const RSSHUB = "https://rsshub.app";

const trim = (s: string) => s.trim().replace(/\/+$/, "");

// ---------- detect ----------

export function detectSource(input: string): DetectedSource | null {
  const raw = input.trim();
  if (!raw) return null;
  const value = trim(raw.replace(/^https?:\/\//i, "").replace(/^www\./i, ""));
  const lower = value.toLowerCase();

  // YouTube channel/playlist/handle
  if (/^youtube\.com\//.test(lower) || /^youtu\.be\//.test(lower)) {
    const channelMatch = lower.match(/youtube\.com\/channel\/(uc[\w-]+)/i);
    if (channelMatch) {
      return {
        kind: "youtube", category: "ویدیو",
        url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelMatch[1].toUpperCase()}`,
        name: "YouTube Channel", icon: "📺",
      };
    }
    const playlistMatch = lower.match(/list=([\w-]+)/);
    if (playlistMatch) {
      return {
        kind: "youtube", category: "ویدیو",
        url: `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistMatch[1]}`,
        name: "YouTube Playlist", icon: "🎬",
      };
    }
    const handleMatch = value.match(/youtube\.com\/@([\w.-]+)/i);
    if (handleMatch) {
      return {
        kind: "youtube", category: "ویدیو",
        url: `${RSSHUB}/youtube/user/@${handleMatch[1]}`,
        name: `@${handleMatch[1]}`, icon: "📺",
        note: "از طریق RSSHub",
      };
    }
  }

  // Twitter / X handle
  if (/^twitter\.com\//.test(lower) || /^x\.com\//.test(lower) || /^@[\w_]{2,15}$/.test(raw)) {
    const handle = raw.startsWith("@")
      ? raw.slice(1)
      : (value.match(/(?:twitter|x)\.com\/([\w_]+)/i) || [])[1];
    if (handle) {
      return {
        kind: "twitter", category: "شبکه‌اجتماعی",
        url: `${NITTER}/${handle}/rss`,
        name: `@${handle}`, icon: "🐦",
        note: "از طریق Nitter",
      };
    }
  }

  // Telegram channel
  if (/^t\.me\//.test(lower) || /^telegram\.me\//.test(lower)) {
    const m = value.match(/(?:t|telegram)\.me\/([\w_]+)/i);
    if (m) {
      const slug = m[1];
      return {
        kind: "telegram", category: "تلگرام",
        url: `${RSSHUB}/telegram/channel/${slug}`,
        name: `@${slug}`, icon: "✈️",
        note: "از طریق RSSHub",
      };
    }
  }

  // Reddit
  if (/^reddit\.com\/r\//.test(lower)) {
    const m = value.match(/reddit\.com\/r\/([\w_]+)/i);
    if (m) {
      return {
        kind: "reddit", category: "گفتگو",
        url: `https://www.reddit.com/r/${m[1]}/.rss`,
        name: `r/${m[1]}`, icon: "🤖",
      };
    }
  }

  // GitHub releases / commits
  if (/^github\.com\//.test(lower)) {
    const m = value.match(/github\.com\/([\w.-]+)\/([\w.-]+)/i);
    if (m) {
      return {
        kind: "github", category: "توسعه",
        url: `https://github.com/${m[1]}/${m[2]}/releases.atom`,
        name: `${m[1]}/${m[2]}`, icon: "🐙",
      };
    }
  }

  // Medium publication / user
  if (/^medium\.com\//.test(lower)) {
    const m = value.match(/medium\.com\/(@?[\w.-]+)/i);
    if (m) {
      return {
        kind: "medium", category: "مقاله",
        url: `https://medium.com/feed/${m[1]}`,
        name: m[1], icon: "✍️",
      };
    }
  }

  // Apple Podcasts (cannot derive feed reliably without lookup → ask user for RSS)
  if (/podcasts\.apple\.com/.test(lower)) {
    return null;
  }

  // Substack / newsletters: most expose /feed
  if (/\.substack\.com/.test(lower) || /^substack\.com\//.test(lower)) {
    const host = value.split("/")[0];
    return {
      kind: "newsletter", category: "خبرنامه",
      url: `https://${host}/feed`,
      name: host.replace(/\.substack\.com$/, ""), icon: "✉️",
    };
  }

  // Direct RSS / Atom URL
  if (/\.(xml|rss|atom)(\?|$)/i.test(lower) || /\/rss(\/|$)/i.test(lower) || /\/feed(\/|$)/i.test(lower)) {
    return {
      kind: "rss", category: "RSS",
      url: raw.startsWith("http") ? raw : `https://${value}`,
      name: value.split("/")[0], icon: "📡",
    };
  }

  // Generic site → caller should try /feed, /rss, /atom probes
  if (/\./.test(value) && !/\s/.test(value)) {
    return {
      kind: "site", category: "وب‌سایت",
      url: raw.startsWith("http") ? raw : `https://${value}`,
      name: value.split("/")[0], icon: "🌐",
      note: "تلاش برای کشف خودکار فید",
    };
  }

  return null;
}

// Generate probe URLs for "site" kind: server should accept whichever resolves first.
export function probeUrls(siteUrl: string): string[] {
  const base = siteUrl.replace(/\/+$/, "");
  return [
    `${base}/feed`,
    `${base}/rss`,
    `${base}/rss.xml`,
    `${base}/feed.xml`,
    `${base}/atom.xml`,
    `${base}/index.xml`,
    `${base}/?feed=rss2`,
  ];
}

// ---------- catalog ----------

export type CatalogEntry = DetectedSource & { description: string; tags?: string[] };

export const CATALOG: CatalogEntry[] = [
  // RSS — Persian general
  { kind: "rss", category: "عمومی فارسی", url: "https://www.bbc.co.uk/persian/index.xml", name: "BBC فارسی", icon: "🌐", description: "اخبار جامع از BBC فارسی", tags: ["خبر", "بین‌الملل"] },
  { kind: "rss", category: "عمومی فارسی", url: "https://parsi.euronews.com/rss", name: "یورونیوز فارسی", icon: "🇪🇺", description: "اخبار اروپا و جهان", tags: ["خبر"] },
  { kind: "rss", category: "عمومی فارسی", url: "https://www.dw.com/fa-ir/rss/4524", name: "دویچه‌وله فارسی", icon: "🇩🇪", description: "خبرگزاری آلمانی", tags: ["خبر"] },
  // RSS — Persian tech
  { kind: "rss", category: "فناوری", url: "https://www.zoomit.ir/feed", name: "زومیت", icon: "💻", description: "بزرگ‌ترین مرجع فناوری فارسی", tags: ["تکنولوژی"] },
  { kind: "rss", category: "فناوری", url: "https://digiato.com/feed", name: "دیجیاتو", icon: "🤖", description: "تحلیل و اخبار فناوری", tags: ["تکنولوژی"] },
  // YouTube
  { kind: "youtube", category: "ویدیو", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCXuqSBlHAE6Xw-yeJA0Tunw", name: "Linus Tech Tips", icon: "📺", description: "ویدیوهای تکنولوژی LTT" },
  { kind: "youtube", category: "ویدیو", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCBJycsmduvYEL83R_U4JriQ", name: "Marques Brownlee (MKBHD)", icon: "📺", description: "نقد گجت‌های پرچم‌دار" },
  // Podcast (RSS feeds)
  { kind: "podcast", category: "پادکست", url: "https://feeds.megaphone.fm/hubermanlab", name: "Huberman Lab", icon: "🎙️", description: "علم سلامت و عملکرد ذهن" },
  { kind: "podcast", category: "پادکست", url: "https://lexfridman.com/feed/podcast/", name: "Lex Fridman", icon: "🎙️", description: "گفتگو با اندیشمندان جهان" },
  // Newsletter
  { kind: "newsletter", category: "خبرنامه", url: "https://stratechery.com/feed/", name: "Stratechery (Public)", icon: "✉️", description: "تحلیل استراتژی صنعت تک" },
  // Reddit
  { kind: "reddit", category: "گفتگو", url: "https://www.reddit.com/r/programming/.rss", name: "r/programming", icon: "🤖", description: "بحث‌های توسعه‌دهندگان" },
  // GitHub
  { kind: "github", category: "توسعه", url: "https://github.com/facebook/react/releases.atom", name: "React Releases", icon: "🐙", description: "نسخه‌های جدید React" },
  // Tech English
  { kind: "rss", category: "تک جهانی", url: "https://feeds.arstechnica.com/arstechnica/index", name: "Ars Technica", icon: "🔧", description: "Deep tech analysis" },
  { kind: "rss", category: "تک جهانی", url: "https://www.theverge.com/rss/index.xml", name: "The Verge", icon: "🎯", description: "Technology, science, art" },
  { kind: "rss", category: "تک جهانی", url: "https://hnrss.org/frontpage", name: "Hacker News", icon: "🟧", description: "Tech community curated" },
];

export const KIND_META: Record<SourceKind, { label: string; icon: string; color: string }> = {
  rss:        { label: "RSS",        icon: "📡", color: "from-orange-500 to-amber-500" },
  youtube:    { label: "YouTube",    icon: "📺", color: "from-red-500 to-rose-500" },
  podcast:    { label: "پادکست",     icon: "🎙️", color: "from-violet-500 to-purple-500" },
  twitter:    { label: "X / Twitter", icon: "🐦", color: "from-sky-500 to-blue-500" },
  telegram:   { label: "تلگرام",     icon: "✈️", color: "from-cyan-500 to-blue-500" },
  newsletter: { label: "خبرنامه",    icon: "✉️", color: "from-pink-500 to-rose-500" },
  reddit:     { label: "Reddit",     icon: "🤖", color: "from-orange-600 to-red-500" },
  github:     { label: "GitHub",     icon: "🐙", color: "from-slate-600 to-slate-800" },
  medium:     { label: "Medium",     icon: "✍️", color: "from-emerald-600 to-green-700" },
  site:       { label: "وب‌سایت",    icon: "🌐", color: "from-indigo-500 to-blue-600" },
};

// ---------- OPML ----------

export type OpmlEntry = { url: string; name: string; category?: string };

export function parseOPML(xml: string): OpmlEntry[] {
  const out: OpmlEntry[] = [];
  try {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const outlines = doc.querySelectorAll("outline[xmlUrl]");
    outlines.forEach(o => {
      const url = o.getAttribute("xmlUrl") || "";
      if (!url) return;
      const name = o.getAttribute("title") || o.getAttribute("text") || url;
      // category = parent outline title
      const parent = o.parentElement;
      const category = parent && parent.tagName.toLowerCase() === "outline" && !parent.getAttribute("xmlUrl")
        ? (parent.getAttribute("title") || parent.getAttribute("text") || undefined)
        : undefined;
      out.push({ url, name, category });
    });
  } catch (e) {
    console.log("OPML parse failed:", e);
  }
  return out;
}

export function buildOPML(feeds: { url: string; name: string; category?: string }[]): string {
  const escape = (s: string) => s.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&apos;" }[c] as string));
  const byCat = new Map<string, typeof feeds>();
  for (const f of feeds) {
    const c = f.category || "بدون دسته";
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c)!.push(f);
  }
  const groups = [...byCat.entries()].map(([cat, items]) => {
    const lines = items.map(f => `      <outline type="rss" text="${escape(f.name)}" title="${escape(f.name)}" xmlUrl="${escape(f.url)}"/>`).join("\n");
    return `    <outline text="${escape(cat)}" title="${escape(cat)}">\n${lines}\n    </outline>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Kian RSS Export</title><dateCreated>${new Date().toUTCString()}</dateCreated></head>
  <body>
${groups}
  </body>
</opml>`;
}

// merge: filter out duplicates against existing URL set (case-insensitive)
export function mergeOpml(entries: OpmlEntry[], existingUrls: string[]): { add: OpmlEntry[]; skip: OpmlEntry[] } {
  const have = new Set(existingUrls.map(u => u.toLowerCase().replace(/\/+$/, "")));
  const add: OpmlEntry[] = [];
  const skip: OpmlEntry[] = [];
  for (const e of entries) {
    const k = e.url.toLowerCase().replace(/\/+$/, "");
    if (have.has(k)) skip.push(e);
    else { add.push(e); have.add(k); }
  }
  return { add, skip };
}
