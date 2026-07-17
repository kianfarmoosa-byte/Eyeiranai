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

  // ── AI (server-proxied LLM) ── (u = optional per-user key owner)
  aiSummarize: (payload: { title: string; content: string }, u?: string) =>
    req(`/ai/summarize${u ? `?u=${encodeURIComponent(u)}` : ""}`, { method: "POST", body: JSON.stringify(payload) })
      .then(r => r.summary as { tldr: string; bullets: string[]; long: string; entities: string[]; readingMinutes: number }),
  aiAsk: (payload: { title: string; content: string; question: string; history?: { role: string; text: string }[] }, u?: string) =>
    req(`/ai/ask${u ? `?u=${encodeURIComponent(u)}` : ""}`, { method: "POST", body: JSON.stringify(payload) }).then(r => r.answer as string),
  aiDigest: (payload: { headlines: { title: string; source: string; sentiment?: string }[]; stats?: Record<string, any>; period?: number }, u?: string) =>
    req(`/ai/digest${u ? `?u=${encodeURIComponent(u)}` : ""}`, { method: "POST", body: JSON.stringify(payload) })
      .then(r => r.digest as { bigPicture: string; keyPoints: string[]; action: string; mood: "positive" | "negative" | "neutral"; generatedAt: number }),
  aiTranslate: (payload: { text: string; to: "en" | "fa" }, u?: string) =>
    req(`/ai/translate${u ? `?u=${encodeURIComponent(u)}` : ""}`, { method: "POST", body: JSON.stringify(payload) }).then(r => r.text as string),
  aiTranslateBatch: (payload: { texts: string[]; to: "en" | "fa" }, u?: string) =>
    req(`/ai/translate-batch${u ? `?u=${encodeURIComponent(u)}` : ""}`, { method: "POST", body: JSON.stringify(payload) }).then(r => r.texts as string[]),

  // ── Per-user AI key (BYO) ──
  aiGetConfig: (u: string) =>
    req(`/ai/config?u=${encodeURIComponent(u)}`).then(r => r.config as AiConfigStatus),
  aiSaveConfig: (u: string, payload: { apiKey: string; baseUrl?: string; model?: string }) =>
    req(`/ai/config?u=${encodeURIComponent(u)}`, { method: "POST", body: JSON.stringify(payload) })
      .then(r => r as { ok: boolean; config: { hasKey: boolean; baseUrl: string; model: string } }),
  aiDeleteConfig: (u: string) =>
    req(`/ai/config?u=${encodeURIComponent(u)}`, { method: "DELETE" }),

  // ── Content Studio (Phase 1) ──
  studioGetBrand: (u: string) =>
    req(`/studio/brand?u=${encodeURIComponent(u)}`).then(r => r.brand as BrandProfile | null),
  studioSaveBrand: (u: string, brand: Partial<BrandProfile>) =>
    req(`/studio/brand?u=${encodeURIComponent(u)}`, { method: "POST", body: JSON.stringify(brand) }).then(r => r.brand as BrandProfile),
  // Analyze a source (news site/RSS or public Telegram channel) → style profile.
  studioAnalyzeSource: (u: string, url: string) =>
    req(`/studio/analyze-source?u=${encodeURIComponent(u)}`, { method: "POST", body: JSON.stringify({ url }) }).then(r => r as StyleResult),
  studioGetStyle: (u: string) =>
    req(`/studio/style?u=${encodeURIComponent(u)}`).then(r => r.style as StyleResult | null),
  studioGetStyles: (u: string) =>
    req(`/studio/styles?u=${encodeURIComponent(u)}`).then(r => r.styles as StyleResult[]),
  studioDeleteStyle: (u: string, source: string) =>
    req(`/studio/styles?u=${encodeURIComponent(u)}&source=${encodeURIComponent(source)}`, { method: "DELETE" }).then(r => r.styles as StyleResult[]),
  studioBlendStyles: (u: string, sources: string[]) =>
    req(`/studio/blend-styles?u=${encodeURIComponent(u)}`, { method: "POST", body: JSON.stringify({ sources }) }).then(r => r as StyleResult),
  studioGetTemplates: (u: string) =>
    req(`/studio/templates?u=${encodeURIComponent(u)}`).then(r => r.templates as ContentTemplate[]),
  studioSaveTemplate: (u: string, tpl: Partial<ContentTemplate>) =>
    req(`/studio/templates?u=${encodeURIComponent(u)}`, { method: "POST", body: JSON.stringify(tpl) }).then(r => r.templates as ContentTemplate[]),
  studioDeleteTemplate: (u: string, id: string) =>
    req(`/studio/templates/${id}?u=${encodeURIComponent(u)}`, { method: "DELETE" }),
  studioGetDrafts: (u: string) =>
    req(`/studio/drafts?u=${encodeURIComponent(u)}`).then(r => r.drafts as Draft[]),
  studioSaveDraft: (u: string, draft: Partial<Draft>) =>
    req(`/studio/drafts?u=${encodeURIComponent(u)}`, { method: "POST", body: JSON.stringify(draft) }).then(r => r.draft as Draft),
  studioDeleteDraft: (u: string, id: string) =>
    req(`/studio/drafts/${id}?u=${encodeURIComponent(u)}`, { method: "DELETE" }),
  studioCompose: (payload: {
    brand: Partial<BrandProfile>;
    template: Partial<ContentTemplate>;
    source: { title: string; content: string; source?: string; link?: string };
    platforms: StudioPlatform[];
  }) =>
    req("/studio/compose", { method: "POST", body: JSON.stringify(payload) })
      .then(r => r.outputs as Record<StudioPlatform, { text: string; hashtags: string[] }>),
  studioComposeDigest: (payload: {
    brand: Partial<BrandProfile>;
    template: Partial<ContentTemplate>;
    sources: { title: string; content: string; source?: string; link?: string }[];
    platforms: StudioPlatform[];
  }) =>
    req("/studio/compose-digest", { method: "POST", body: JSON.stringify(payload) })
      .then(r => r.outputs as Record<StudioPlatform, { text: string; hashtags: string[] }>),
  /** Regenerate one platform's text into a fresh alternative (variant). */
  studioRewrite: (payload: { brand: Partial<BrandProfile>; platform: StudioPlatform; text: string; instruction?: string }) =>
    req("/studio/rewrite", { method: "POST", body: JSON.stringify(payload) })
      .then(r => r as { text: string; hashtags: string[] }),

  // ── News-package builder (بستهٔ خبری سفارشی) ──
  newspackGetPacks: (u: string) =>
    req(`/newspack/packs?u=${encodeURIComponent(u)}`).then(r => r.packs as NewsPack[]),
  newspackSavePack: (u: string, pack: Partial<NewsPack>) =>
    req(`/newspack/packs?u=${encodeURIComponent(u)}`, { method: "POST", body: JSON.stringify(pack) }).then(r => r.pack as NewsPack),
  newspackDeletePack: (u: string, id: string) =>
    req(`/newspack/packs/${id}?u=${encodeURIComponent(u)}`, { method: "DELETE" }),
  newspackGenerate: (u: string, id: string) =>
    req(`/newspack/packs/${id}/generate?u=${encodeURIComponent(u)}`, { method: "POST" }).then(r => r.edition as NewsEdition),
  newspackGetEditions: (u: string, id: string) =>
    req(`/newspack/packs/${id}/editions?u=${encodeURIComponent(u)}`).then(r => r.editions as NewsEdition[]),
  newspackUpdateEdition: (u: string, packId: string, edition: NewsEdition) =>
    req(`/newspack/packs/${packId}/editions/${edition.id}?u=${encodeURIComponent(u)}`, { method: "PUT", body: JSON.stringify(edition) }).then(r => r.edition as NewsEdition),
  newspackGetNotifs: (u: string) =>
    req(`/newspack/notifs?u=${encodeURIComponent(u)}`).then(r => ({ notifs: r.notifs as NewspackNotif[], unread: r.unread as number })),
  newspackMarkNotifsRead: (u: string) =>
    req(`/newspack/notifs/read?u=${encodeURIComponent(u)}`, { method: "POST" }),
  newspackTestDelivery: (u: string, id: string) =>
    req(`/newspack/packs/${id}/test-delivery?u=${encodeURIComponent(u)}`, { method: "POST" }).then(r => r.delivery as DeliveryResult),
  newspackGetStats: (u: string, id: string) =>
    req(`/newspack/packs/${id}/stats?u=${encodeURIComponent(u)}`).then(r => r.stats as PackStats | null),
  newspackShare: (u: string, id: string) =>
    req(`/newspack/packs/${id}/share?u=${encodeURIComponent(u)}`, { method: "POST" }).then(r => r.token as string),
  newspackUnshare: (u: string, id: string) =>
    req(`/newspack/packs/${id}/share?u=${encodeURIComponent(u)}`, { method: "DELETE" }),
  newspackGetShared: (token: string) =>
    req(`/newspack/shared/${token}`).then(r => ({ pack: r.pack as SharedPackMeta, edition: r.edition as NewsEdition | null })),
  newspackCloneShared: (u: string, token: string) =>
    req(`/newspack/shared/${token}/clone?u=${encodeURIComponent(u)}`, { method: "POST" }).then(r => r.pack as NewsPack),
  newspackSuggestSources: (u: string, query: string, catalog: { name: string; url: string; icon: string; lang: string; group: string }[]) =>
    req(`/newspack/suggest-sources?u=${encodeURIComponent(u)}`, { method: "POST", body: JSON.stringify({ query, catalog }) }).then(r => r.suggestions as SourceSuggestion[]),
  // ── live collaboration ──
  newspackCollabJoin: (token: string, clientId: string, name: string) =>
    req(`/newspack/collab/${token}/join`, { method: "POST", body: JSON.stringify({ clientId, name }) }).then(r => r as CollabSnapshot),
  newspackCollabGet: (token: string, clientId: string, name: string) =>
    req(`/newspack/collab/${token}?clientId=${encodeURIComponent(clientId)}&name=${encodeURIComponent(name)}`).then(r => r as CollabSnapshot),
  newspackCollabSave: (token: string, clientId: string, name: string, pack: NewsPack) =>
    req(`/newspack/collab/${token}`, { method: "PUT", body: JSON.stringify({ clientId, name, pack }) }).then(r => r as CollabSnapshot),
  newspackCollabLeave: (token: string, clientId: string) =>
    req(`/newspack/collab/${token}/leave`, { method: "POST", body: JSON.stringify({ clientId }) }),

  // ── Publishing (Phase 2–4): Telegram, Bale, Rubika, Website ──
  studioGetConnections: (u: string) =>
    req(`/studio/connections?u=${encodeURIComponent(u)}`).then(r => r.connections as Record<string, ConnectionStatus>),
  studioSaveConnection: (u: string, payload: ConnectionInput) =>
    req(`/studio/connections?u=${encodeURIComponent(u)}`, { method: "POST", body: JSON.stringify(payload) })
      .then(r => ({ connections: r.connections as Record<string, ConnectionStatus>, botName: r.botName as string })),
  studioDeleteConnection: (u: string, platform: PublishPlatform) =>
    req(`/studio/connections/${platform}?u=${encodeURIComponent(u)}`, { method: "DELETE" })
      .then(r => r.connections as Record<string, ConnectionStatus>),
  studioTestConnection: (u: string, platform: PublishPlatform) =>
    req(`/studio/connections/test?u=${encodeURIComponent(u)}`, { method: "POST", body: JSON.stringify({ platform }) }),
  studioPublish: (u: string, payload: { platform: PublishPlatform; text: string; title?: string; link?: string; imageUrl?: string; imageUrls?: string[] }) =>
    req(`/studio/publish?u=${encodeURIComponent(u)}`, { method: "POST", body: JSON.stringify(payload) })
      .then(r => r as { ok: boolean; ref?: any }),

  // ── Automation (Phase 3) ──
  studioGetRules: (u: string) =>
    req(`/studio/rules?u=${encodeURIComponent(u)}`).then(r => r.rules as AutomationRule[]),
  studioSaveRule: (u: string, rule: Partial<AutomationRule>) =>
    req(`/studio/rules?u=${encodeURIComponent(u)}`, { method: "POST", body: JSON.stringify(rule) }).then(r => r.rules as AutomationRule[]),
  studioDeleteRule: (u: string, id: string) =>
    req(`/studio/rules/${id}?u=${encodeURIComponent(u)}`, { method: "DELETE" }),
  studioGetAutoLog: (u: string) =>
    req(`/studio/autolog?u=${encodeURIComponent(u)}`).then(r => r.log as AutoLogEntry[]),
  studioGetPubLog: (u: string) =>
    req(`/studio/publog?u=${encodeURIComponent(u)}`).then(r => r.log as PubLogEntry[]),
  // ── Manual performance metrics ──
  studioGetMetrics: (u: string) =>
    req(`/studio/metrics?u=${encodeURIComponent(u)}`).then(r => r.metrics as MetricEntry[]),
  studioSaveMetric: (u: string, payload: { platform: string; views?: number; likes?: number; shares?: number; note?: string }) =>
    req(`/studio/metrics?u=${encodeURIComponent(u)}`, { method: "POST", body: JSON.stringify(payload) }).then(r => r.metric as MetricEntry),
  studioDeleteMetric: (u: string, id: string) =>
    req(`/studio/metrics/${id}?u=${encodeURIComponent(u)}`, { method: "DELETE" }),
  /** Upload a client-rendered branded news card (PNG data URL) → signed URL. */
  studioUploadCard: (u: string, dataUrl: string) =>
    req(`/studio/upload-card?u=${encodeURIComponent(u)}`, { method: "POST", body: JSON.stringify({ dataUrl }) })
      .then(r => r.url as string),
  /** Manually trigger the automation engine once (also called by an external scheduler). */
  studioRunTick: (src?: string) =>
    req(`/automation/tick${src ? `?src=${encodeURIComponent(src)}` : ""}`, { method: "POST", body: "{}" })
      .then(r => r as { ok: boolean; ran: number; scheduledPublished?: number; total?: number; retried?: number; recovered?: number; retryPending?: number; retryDead?: number; summary?: any[] }),
  /** Last automation run status (shared across devices). */
  studioAutomationStatus: () =>
    req(`/automation/status`).then(r => r.last as AutomationStatus | null),
  // ── Retry queue (failed publishes) ──
  /** List this user's queued/failed publish retries. */
  studioGetRetries: (u: string) =>
    req(`/automation/retries?u=${encodeURIComponent(u)}`).then(r => r.retries as RetryEntry[]),
  /** Force an immediate attempt of all queued retries (ignores backoff). */
  studioRunRetries: (u: string) =>
    req(`/automation/retries/run?u=${encodeURIComponent(u)}`, { method: "POST", body: "{}" })
      .then(r => r as { ok: boolean; retried: number; recovered: number; pending: number }),
  studioDeleteRetry: (u: string, id: string) =>
    req(`/automation/retries/${id}?u=${encodeURIComponent(u)}`, { method: "DELETE" }),
  /** Clear the retry queue (dead=true removes only permanently-failed entries). */
  studioClearRetries: (u: string, dead?: boolean) =>
    req(`/automation/retries?u=${encodeURIComponent(u)}${dead ? "&dead=1" : ""}`, { method: "DELETE" }),
  /** Public URL an external cron should POST to, plus the header it must send. */
  automationTickUrl: `${BASE}/automation/tick`,
  automationAuthHeader: `Bearer ${publicAnonKey}`,

  // ── Social Listening (رصد اجتماعی) ──
  socialGetTopics: () =>
    req("/social/topics").then(r => r.topics as WatchTopic[]),
  socialSaveTopic: (topic: { id?: string; label: string; keywords: string[]; sources: WatchSource[] }) =>
    req("/social/topics", { method: "POST", body: JSON.stringify(topic) }).then(r => r.topic as WatchTopic),
  socialDeleteTopic: (id: string) =>
    req(`/social/topics/${id}`, { method: "DELETE" }),
  socialGetPosts: (id: string, refresh?: boolean) =>
    req(`/social/topics/${id}/posts${refresh ? "?refresh=1" : ""}`)
      .then(r => r as { posts: SocialPost[]; cached: boolean; sources: number; errors?: { source: string; error: string }[] }),
  /** Emerging-trend / burst alerts. Optionally scope to a topic or only unread. */
  socialGetAlerts: (opts?: { topicId?: string; unread?: boolean }) => {
    const q = new URLSearchParams();
    if (opts?.topicId) q.set("topicId", opts.topicId);
    if (opts?.unread) q.set("unread", "1");
    const qs = q.toString();
    return req(`/social/alerts${qs ? `?${qs}` : ""}`)
      .then(r => r as { alerts: SocialAlert[]; unread: number });
  },
  socialMarkAlertsRead: (opts: { ids?: string[]; all?: boolean }) =>
    req("/social/alerts/read", { method: "POST", body: JSON.stringify(opts) })
      .then(r => r as { ok: boolean; unread: number }),
  socialClearAlerts: () =>
    req("/social/alerts", { method: "DELETE" }),
  /** Trigger a scan on demand (also runs automatically on each automation tick). */
  socialScan: () =>
    req("/social/scan", { method: "POST" })
      .then(r => r as { ok: boolean; topics: number; alerts: number; errors: number }),
};

export type WatchSource = { url: string; name: string; kind: string; icon?: string };

export type WatchTopic = {
  id: string;
  label: string;
  keywords: string[];
  sources: WatchSource[];
  createdAt: number;
  updatedAt: number;
};

export type SocialPost = {
  id: string;
  topicId: string;
  source: string;
  sourceKind: string;
  sourceIcon: string;
  author: string;
  text: string;
  title: string;
  link: string;
  date: string;
  dateMs: number;
  image?: string;
  views?: number;
  likes?: number;
  comments?: number;
};

export type SocialAlert = {
  id: string;
  topicId: string;
  topicLabel: string;
  kind: "burst" | "emerging" | "volume" | "crisis" | "mention";
  term?: string;
  count: number;
  baseline: number;
  factor: number;
  sampleText: string;
  sampleLink: string;
  ts: number;
  read: boolean;
};

// ── News-package builder types ──
export type PackSource = {
  id: string;
  url: string;
  name: string;
  icon?: string;
  sourceKind?: string;
  lang?: string; // "fa" | "en" | "ar" | … ; non-fa content is auto-translated
};
export type PackSection = {
  id: string;
  title: string;
  contentType: string; // news | analysis | report | opinion | tech | …
  itemLength: string;  // headline | short | medium | long
  maxItems: number;
  keywords: string[];
  sources: PackSource[];
  order: number;
};
export type NewsPack = {
  id: string;
  userId?: string;
  title: string;
  theme: string;
  intro?: string;
  timespanHours: number;
  scheduleEveryHours: number;
  sections: PackSection[];
  deliveryEmail?: string;
  deliveryWebhookUrl?: string;
  shareToken?: string;
  lastGeneratedAt?: number;
  createdAt: number;
  updatedAt: number;
};
export type NewspackNotif = {
  id: string;
  packId: string;
  packTitle: string;
  editionId: string;
  items: number;
  createdAt: number;
  trigger: "manual" | "scheduled";
  delivery?: { webhook?: string; email?: string };
  read?: boolean;
};
export type DeliveryResult = { webhook?: string; email?: string };
export type PackStats = {
  packId: string;
  totalEditions: number; totalItems: number; totalTranslated: number;
  manualRuns: number; scheduledRuns: number;
  deliveries: { webhookOk: number; webhookFail: number; emailOk: number; emailFail: number };
  sectionCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  history: { t: number; items: number; translated: number }[];
  firstAt: number; lastAt: number;
};
export type SourceSuggestion = { name: string; url: string; icon: string; lang: string; sourceKind: string; reason: string };
export type CollabPresence = { clientId: string; name: string; color: string; lastSeen: number };
export type CollabSnapshot = {
  pack: NewsPack;
  version: number;
  lastEditor: string;
  lastEditorName: string;
  lastEditedAt: number;
  collaborators: CollabPresence[];
};
export type SharedPackMeta = { id: string; title: string; theme: string; intro?: string; sections: number };
export type EditionItem = {
  title: string;
  summary: string;
  source: string;
  sourceIcon?: string;
  link: string;
  publishedAt: number;
  originalLang?: string;
  translated?: boolean;
  image?: string;
  pinned?: boolean;
};
export type EditionSection = { id: string; title: string; contentType: string; itemLength: string; items: EditionItem[]; intro?: string };
export type NewsEdition = {
  id: string;
  packId: string;
  packTitle: string;
  theme: string;
  intro?: string;
  generatedAt: number;
  sections: EditionSection[];
  stats: { sections: number; items: number; translated: number; sources: number };
};

export type AutomationStatus = {
  at: number;
  ran: number;
  scheduledPublished: number;
  total: number;
  retried?: number;
  recovered?: number;
  retryPending?: number;
  retryDead?: number;
  source: string;
};

export type RetryEntry = {
  id: string;
  platform: PublishPlatform;
  attempts: number;
  maxAttempts: number;
  nextAt: number;
  lastError: string;
  status: "pending" | "dead";
  createdAt: number;
  updatedAt: number;
  draftId?: string;
  source?: string;
  payload: { title?: string; text: string; link?: string; imageUrl?: string };
};

export type AutomationRule = {
  id: string;
  userId?: string;
  name: string;
  enabled: boolean;
  trigger: { type: "schedule" | "event" | "daily"; everyMinutes: number; keywords: string[]; dailyTime?: string };
  sourceCategory: string;
  templateId: string;
  platforms: PublishPlatform[];
  autoPublish: boolean;
  digest?: boolean;
  digestCount?: number;
  lastRunAt: number;
  lastItemKey: string;
  updatedAt?: number;
};

export type AutoLogEntry = {
  ts: number;
  ruleId: string;
  ruleName: string;
  itemTitle: string;
  draftId: string;
  published: { platform: string; ok: boolean; error?: string; messageId?: number }[];
};

export type PubLogEntry = {
  ts: number;
  platform: string;
  chatId?: string;
  ref?: any;
  ok: boolean;
};

export type MetricEntry = {
  id: string;
  ts: number;
  platform: string;
  views: number;
  likes: number;
  shares: number;
  note?: string;
};

export type AiConfigStatus = {
  hasKey: boolean;
  baseUrl: string;
  model: string;
  updatedAt: number;
  defaultBase: string;
  defaultModel: string;
};

// ── Content Studio types ──
export type StudioPlatform = "twitter" | "instagram" | "telegram" | "rubika" | "bale" | "website";

export type BrandProfile = {
  name: string;
  tagline: string;
  tone: string;
  audience: string;
  language: "fa" | "en";
  signature: string;
  hashtags: string[];
  emoji: boolean;
  /** Signed URL of the uploaded brand logo (used on news cards). */
  logo?: string;
  /** Style guide (voice/structure/literary style) — extracted from a source or hand-written. */
  styleGuide?: string;
  updatedAt?: number;
};

/** Result of analyzing a source (news site/RSS or public Telegram channel). */
export type StyleProfile = {
  summary: string;
  tone: string;
  audience: string;
  language: "fa" | "en";
  styleGuide: string;
  structure: string;
  hashtags: string[];
  emojiUsage: string;
  signature: string;
  dos: string[];
  donts: string[];
  topics: string[];
  exemplars: string[];
};

export type StyleResult = {
  source: string;
  type: string;
  sampleCount: number;
  profile: StyleProfile;
  updatedAt: number;
};

export type ContentTemplate = {
  id: string;
  name: string;
  platforms: StudioPlatform[];
  structure: string;
  maxLength: number;
  includeLink: boolean;
  includeSource: boolean;
  /** Graphic template defaults for the branded card. */
  cardTheme?: string;
  cardRatio?: string;
  updatedAt?: number;
};

export type DraftOutput = { text: string; hashtags: string[] };

export type Draft = {
  id: string;
  userId?: string;
  title: string;
  sourceTitle: string;
  sourceLink: string;
  image?: string;
  /** Carousel / multi-slide images (e.g. Instagram album). */
  images?: string[];
  /** Graphic card defaults inherited from the template. */
  cardTheme?: string;
  cardRatio?: string;
  outputs: Partial<Record<StudioPlatform, DraftOutput>>;
  status: "draft" | "approved" | "scheduled" | "published";
  /** Epoch ms when a scheduled draft should auto-publish. */
  scheduledAt?: number;
  /** Platforms the scheduler should publish to. */
  scheduleTargets?: PublishPlatform[];
  /** True when created by an automation rule (awaiting human review). */
  auto?: boolean;
  updatedAt: number;
  createdAt: number;
};

// Platforms with real publishing support.
export type PublishPlatform = "telegram" | "bale" | "rubika" | "website" | "twitter" | "instagram";

export type ConnectionStatus = {
  connected: boolean;
  chatId: string;
  botName: string;
  url: string;
  mode: string;
  verifiedAt: number;
};

// Inputs accepted by the connect endpoint (fields vary by platform).
export type ConnectionInput = {
  platform: PublishPlatform;
  token?: string;
  chatId?: string;
  mode?: "wordpress" | "webhook";
  url?: string;
  username?: string;
  appPassword?: string;
  /** Instagram Business account id. */
  igUserId?: string;
};
