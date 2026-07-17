import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Radar, Plus, Trash2, RefreshCw, Loader2, X, ExternalLink,
  TrendingUp, MessageSquare, Copy, Hash, AlertTriangle,
  Flame, Sparkles, Waves, BellOff, Wand2, Check,
  ShieldAlert, AtSign, Gauge, Radio, Clock, Users, Globe,
} from "lucide-react";
import { api, type WatchTopic, type WatchSource, type SocialPost, type SocialAlert } from "../api";
import { detectSource, KIND_META } from "../sourceHub";
import { scoreText, sentimentLabelFa } from "../sentiment";
import { findDuplicates } from "../duplicates";
import type { Article } from "../data";
import { toFa, faNum, timeAgoFa } from "./mobile/utils/fa";
import { studioUserId, DEFAULT_BRAND } from "./mobile/studio/studio";
import { useSocialInsights } from "./social/socialAnalysis";
import {
  SentimentTimelinePanel, TrendsPanel, ReachPanel, CampaignPanel, TimelinePanel, GeoPanel,
} from "./social/socialPanels";

type Tab = "posts" | "pulse" | "trends" | "reach" | "campaign" | "geo" | "timeline" | "alerts";

const STOP = new Set([
  "و","در","از","به","که","این","با","را","بر","تا","یک","یا","هم","نیز","اما","ولی",
  "برای","های","هایی","شده","شد","کرد","می","است","بود","خود","آن","ما","شما","او","آنها",
  "the","a","an","of","in","and","to","for","on","is","are","was","با","بین","روی",
]);

// Map a social post into the Article shape used by findDuplicates.
function postToArticle(p: SocialPost): Article {
  return {
    id: p.id,
    title: p.title || p.text.slice(0, 80),
    source: p.source,
    sourceIcon: p.sourceIcon,
    author: p.author,
    date: p.date,
    dateMs: p.dateMs,
    readTime: "",
    preview: p.text.slice(0, 280),
    content: p.text,
    image: p.image,
    starred: false,
    read: false,
    category: p.sourceKind,
  };
}

function tokenize(s: string): string[] {
  return s
    .replace(/[‌​‍]/g, " ")
    .replace(/[يى]/g, "ی").replace(/ك/g, "ک")
    .replace(/[^؀-ۿ\sa-zA-Z0-9#]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

export type SocialAnalysis = ReturnType<typeof useSocialAnalysis>;

/** Shared analysis (sentiment pulse, repost clusters, hot keywords) over a topic's posts. */
export function useSocialAnalysis(posts: SocialPost[], topic: WatchTopic | null) {
  const scored = useMemo(
    () => posts.map((p) => ({ post: p, s: scoreText(`${p.title} ${p.text}`) })),
    [posts],
  );
  const pulse = useMemo(() => {
    let pos = 0, neg = 0, neu = 0, sum = 0;
    for (const { s } of scored) {
      if (s.label === "positive") pos++;
      else if (s.label === "negative") neg++;
      else neu++;
      sum += s.score;
    }
    const total = scored.length || 1;
    return { pos, neg, neu, avg: scored.length ? sum / scored.length : 0, total: scored.length,
      posPct: Math.round((pos / total) * 100), negPct: Math.round((neg / total) * 100), neuPct: Math.round((neu / total) * 100) };
  }, [scored]);
  const clusters = useMemo(() => {
    if (posts.length < 2) return [];
    return findDuplicates(posts.map(postToArticle), 0.35);
  }, [posts]);
  const keywords = useMemo(() => {
    const counts = new Map<string, number>();
    const exclude = new Set((topic?.keywords || []).map((k) => k.toLowerCase()));
    for (const p of posts) {
      const seen = new Set<string>();
      for (const t of tokenize(`${p.title} ${p.text}`)) {
        if (exclude.has(t) || seen.has(t)) continue;
        seen.add(t);
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40);
  }, [posts, topic]);
  const maxKw = keywords[0]?.[1] || 1;
  return { scored, pulse, clusters, keywords, maxKw };
}

export function SocialListening({ onOpenStudio }: { onOpenStudio?: () => void } = {}) {
  const [topics, setTopics] = useState<WatchTopic[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postErrors, setPostErrors] = useState<{ source: string; error: string }[]>([]);
  const [tab, setTab] = useState<Tab>("posts");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WatchTopic | null>(null);

  const loadTopics = useCallback(async () => {
    setLoadingTopics(true);
    try {
      const t = await api.socialGetTopics();
      setTopics(t);
      setActiveId((prev) => prev && t.some((x) => x.id === prev) ? prev : (t[0]?.id ?? null));
    } catch (e) {
      console.log("social load topics error:", e);
    } finally {
      setLoadingTopics(false);
    }
  }, []);

  useEffect(() => { loadTopics(); }, [loadTopics]);

  const loadPosts = useCallback(async (id: string, refresh?: boolean) => {
    setLoadingPosts(true);
    setPostErrors([]);
    try {
      const r = await api.socialGetPosts(id, refresh);
      setPosts(r.posts);
      setPostErrors(r.errors || []);
    } catch (e) {
      console.log("social load posts error:", e);
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    if (activeId) loadPosts(activeId);
    else setPosts([]);
  }, [activeId, loadPosts]);

  const activeTopic = topics.find((t) => t.id === activeId) || null;

  // ── analysis (shared with mobile) ──
  const insights = useSocialInsights(posts, activeTopic);
  const { scored, pulse, clusters } = insights;

  const deleteTopic = async (id: string) => {
    if (!confirm("حذف این موضوع رصد؟")) return;
    try {
      await api.socialDeleteTopic(id);
      await loadTopics();
    } catch (e) { console.log("delete topic error:", e); }
  };

  return (
    <div dir="rtl" className="flex-1 flex min-w-0 bg-slate-50 dark:bg-slate-950">
      {/* Topics rail */}
      <aside className="w-64 shrink-0 border-l border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <Radar className="w-5 h-5 text-cyan-500" />
          <span className="font-semibold text-sm">رصد اجتماعی</span>
        </div>
        <div className="p-2">
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="w-full flex items-center justify-center gap-1.5 text-sm py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white">
            <Plus className="w-4 h-4" /> موضوع تازه
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
          {loadingTopics ? (
            <div className="flex items-center justify-center py-8 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /></div>
          ) : topics.length === 0 ? (
            <div className="text-[12px] text-slate-400 text-center px-3 py-8 leading-relaxed">
              هنوز موضوعی برای رصد تعریف نشده. با «موضوع تازه» یک برند، شخص یا رویداد را تحت‌نظر بگیرید.
            </div>
          ) : topics.map((t) => (
            <div key={t.id}
              className={`group rounded-lg px-3 py-2 cursor-pointer border ${
                activeId === t.id
                  ? "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-300 dark:border-cyan-800"
                  : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
              onClick={() => setActiveId(t.id)}>
              <div className="flex items-center gap-1.5">
                <span className="flex-1 truncate text-sm">{t.label}</span>
                <button onClick={(e) => { e.stopPropagation(); setEditing(t); setShowForm(true); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400" title="ویرایش">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
                <button onClick={(e) => { e.stopPropagation(); deleteTopic(t.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-400" title="حذف">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {toFa(t.sources.length)} منبع · {toFa(t.keywords.length)} کلیدواژه
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {!activeTopic ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3 p-12 text-center">
            <Radar className="w-12 h-12 opacity-40" />
            <p className="text-sm max-w-sm leading-relaxed">
              یک موضوع رصد بسازید تا پست‌های عمومی مرتبط از تلگرام، توییتر/X، ردیت و … را جمع‌آوری و تحلیل کنیم:
              نبض احساسی، بازنشرها و کلیدواژه‌های داغ.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-white dark:bg-slate-900">
              <div className="min-w-0">
                <div className="font-semibold truncate">{activeTopic.label}</div>
                <div className="text-[11px] text-slate-400">
                  {toFa(posts.length)} پست از {toFa(activeTopic.sources.length)} منبع
                </div>
              </div>
              <div className="flex-1" />
              <button onClick={() => loadPosts(activeTopic.id, true)} disabled={loadingPosts}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50" title="بروزرسانی">
                <RefreshCw className={`w-4 h-4 ${loadingPosts ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-4 pt-2 flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto whitespace-nowrap">
              {([
                { id: "posts", label: "پست‌ها", icon: MessageSquare },
                { id: "pulse", label: "نبض احساسی", icon: Gauge },
                { id: "trends", label: "ترندیابی", icon: Flame },
                { id: "reach", label: "دامنه و سنجه‌ها", icon: Radio },
                { id: "campaign", label: "کمپین و انتشار", icon: Users, badge: clusters.length },
                { id: "geo", label: "جغرافیا", icon: Globe },
                { id: "timeline", label: "خط زمانی", icon: Clock },
                { id: "alerts", label: "هشدارها", icon: TrendingUp },
              ] as { id: Tab; label: string; icon: any; badge?: number }[]).map((t) => {
                const Icon = t.icon;
                return (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-[13px] border-b-2 -mb-px shrink-0 ${
                      tab === t.id
                        ? "border-cyan-500 text-cyan-600 dark:text-cyan-400"
                        : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}>
                    <Icon className="w-3.5 h-3.5" /> {t.label}
                    {!!t.badge && t.badge > 0 && (
                      <span className="text-[10px] bg-amber-500 text-white rounded-full px-1.5">{toFa(t.badge)}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {tab === "alerts" ? (
                <AlertsPanel topicId={activeTopic.id} compact onOpenStudio={onOpenStudio} />
              ) : tab === "geo" ? (
                <GeoPanel topic={activeTopic} />
              ) : loadingPosts && posts.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> در حال جمع‌آوری پست‌ها…
                </div>
              ) : posts.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm">
                  پستی یافت نشد.
                  {postErrors.length > 0 && (
                    <div className="mt-4 text-[11px] text-amber-600 dark:text-amber-400 flex flex-col gap-1">
                      {postErrors.map((e, i) => (
                        <div key={i} className="flex items-center justify-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {e.source}: {e.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : tab === "posts" ? (
                <PostsList scored={scored} />
              ) : tab === "pulse" ? (
                <div><PulsePanel pulse={pulse} /><SentimentTimelinePanel insights={insights} /></div>
              ) : tab === "trends" ? (
                <TrendsPanel insights={insights} onOpenStudio={onOpenStudio} topicLabel={activeTopic.label} />
              ) : tab === "reach" ? (
                <ReachPanel insights={insights} />
              ) : tab === "campaign" ? (
                <div><CampaignPanel insights={insights} /><RepostsPanel clusters={clusters} /></div>
              ) : (
                <TimelinePanel insights={insights} />
              )}
            </div>
          </>
        )}
      </main>

      {showForm && (
        <TopicForm
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={async (t) => { setShowForm(false); await loadTopics(); setActiveId(t.id); }}
        />
      )}
    </div>
  );
}

// ─────────── posts list ───────────
export function PostsList({ scored }: { scored: { post: SocialPost; s: ReturnType<typeof scoreText> }[] }) {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
      {scored.map(({ post, s }) => (
        <a key={post.id} href={post.link || undefined} target="_blank" rel="noopener noreferrer"
          className="block px-4 py-3 hover:bg-white dark:hover:bg-slate-900 transition">
          <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400">
            <span>{post.sourceIcon}</span>
            <span className="truncate max-w-[180px]">{post.source}</span>
            <span className={`px-1.5 rounded-full ${
              s.label === "positive" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : s.label === "negative" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
              : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>
              {sentimentLabelFa(s.label)}
            </span>
            <span className="flex-1" />
            {post.dateMs > 0 && <span>{timeAgoFa(post.dateMs)}</span>}
            {post.link && <ExternalLink className="w-3 h-3" />}
          </div>
          <p className="text-[13px] leading-relaxed line-clamp-3 text-slate-700 dark:text-slate-200">{post.text}</p>
        </a>
      ))}
    </div>
  );
}

// ─────────── pulse ───────────
export function PulsePanel({ pulse }: { pulse: { pos: number; neg: number; neu: number; avg: number; total: number; posPct: number; negPct: number; neuPct: number } }) {
  const mood = pulse.avg > 0.15 ? "مثبت" : pulse.avg < -0.15 ? "منفی" : "خنثی";
  const moodColor = pulse.avg > 0.15 ? "text-emerald-500" : pulse.avg < -0.15 ? "text-rose-500" : "text-slate-500";
  return (
    <div className="p-5 max-w-xl mx-auto space-y-5">
      <div className="text-center">
        <div className="text-[12px] text-slate-400">نبض احساسی کلی بر پایهٔ {toFa(pulse.total)} پست</div>
        <div className={`text-3xl font-bold mt-1 ${moodColor}`}>{mood}</div>
        <div className="text-[12px] text-slate-400 mt-1">میانگین امتیاز: {toFa(pulse.avg.toFixed(2))}</div>
      </div>
      <div className="h-3 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
        <div className="bg-emerald-500 h-full" style={{ width: `${pulse.posPct}%` }} />
        <div className="bg-slate-400 h-full" style={{ width: `${pulse.neuPct}%` }} />
        <div className="bg-rose-500 h-full" style={{ width: `${pulse.negPct}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: "مثبت", n: pulse.pos, pct: pulse.posPct, c: "text-emerald-600 dark:text-emerald-400" },
          { label: "خنثی", n: pulse.neu, pct: pulse.neuPct, c: "text-slate-500" },
          { label: "منفی", n: pulse.neg, pct: pulse.negPct, c: "text-rose-600 dark:text-rose-400" },
        ].map((x) => (
          <div key={x.label} className="rounded-xl border border-slate-200 dark:border-slate-800 py-3">
            <div className={`text-2xl font-bold ${x.c}`}>{toFa(x.n)}</div>
            <div className="text-[12px] text-slate-400">{x.label} · {toFa(x.pct)}٪</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────── reposts / clusters ───────────
export function RepostsPanel({ clusters }: { clusters: ReturnType<typeof findDuplicates> }) {
  if (clusters.length === 0) {
    return <div className="p-10 text-center text-slate-400 text-sm">بازنشر یا محتوای تکراری قابل‌توجهی یافت نشد.</div>;
  }
  return (
    <div className="p-4 space-y-4">
      {clusters.map((c) => (
        <div key={c.id} className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
          <div className="px-4 py-2 flex items-center gap-2 border-b border-amber-200 dark:border-amber-900/40 text-[12px]">
            <Copy className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-medium">{toFa(c.articles.length)} بازنشر مشابه</span>
            <span className="text-slate-400">· شباهت {toFa(Math.round(c.similarity * 100))}٪</span>
          </div>
          <div className="divide-y divide-amber-100 dark:divide-amber-900/30">
            {c.articles.map((a) => (
              <a key={a.id} href={a.link || undefined} target="_blank" rel="noopener noreferrer"
                className="block px-4 py-2 hover:bg-white/60 dark:hover:bg-slate-900/40">
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-0.5">
                  <span>{a.sourceIcon}</span><span className="truncate">{a.source}</span>
                  {a.dateMs && a.dateMs > 0 ? <span className="flex-1 text-left">{timeAgoFa(a.dateMs)}</span> : null}
                </div>
                <p className="text-[12px] line-clamp-2 text-slate-600 dark:text-slate-300">{a.preview}</p>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────── keywords ───────────
export function KeywordsPanel({ keywords, maxKw }: { keywords: [string, number][]; maxKw: number }) {
  if (keywords.length === 0) {
    return <div className="p-10 text-center text-slate-400 text-sm">کلیدواژهٔ پرتکراری یافت نشد.</div>;
  }
  return (
    <div className="p-4 flex flex-wrap gap-2 content-start">
      {keywords.map(([w, n]) => {
        const scale = 0.8 + (n / maxKw) * 1.1;
        return (
          <span key={w}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1"
            style={{ fontSize: `${scale}rem` }}>
            <span className="text-slate-700 dark:text-slate-200">{w}</span>
            <span className="text-[11px] text-cyan-600 dark:text-cyan-400 tabular-nums">{toFa(n)}</span>
          </span>
        );
      })}
    </div>
  );
}

// ─────────── trend / burst alerts ───────────
const ALERT_META: Record<SocialAlert["kind"], { label: string; icon: typeof Flame; cls: string; dot: string }> = {
  burst:    { label: "جهش",    icon: Flame,      cls: "text-rose-600 dark:text-rose-400",      dot: "bg-rose-500" },
  emerging: { label: "نوظهور", icon: Sparkles,   cls: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  volume:   { label: "موج حجمی", icon: Waves,     cls: "text-cyan-600 dark:text-cyan-400",      dot: "bg-cyan-500" },
  crisis:   { label: "بحران شهرت", icon: ShieldAlert, cls: "text-rose-700 dark:text-rose-300",   dot: "bg-rose-600" },
  mention:  { label: "اشارهٔ تازه", icon: AtSign,  cls: "text-violet-600 dark:text-violet-400",  dot: "bg-violet-500" },
};

function alertHeadline(a: SocialAlert): string {
  if (a.kind === "emerging") return `«${a.term}» به‌تازگی مطرح شده`;
  if (a.kind === "burst") return `جهش در «${a.term}»`;
  if (a.kind === "crisis") return `موج منفی دربارهٔ «${a.topicLabel}»`;
  if (a.kind === "mention") return `${faNum(a.count)} اشارهٔ تازه به «${a.topicLabel}»`;
  return "جهش در حجم کل پست‌ها";
}

/** Self-contained alerts feed (optionally scoped to a topic) with an on-demand scan button. */
export function AlertsPanel({ topicId, compact, onOpenStudio }: { topicId?: string; compact?: boolean; onOpenStudio?: () => void }) {
  const [alerts, setAlerts] = useState<SocialAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actedIds, setActedIds] = useState<Set<string>>(new Set());
  const [actErrId, setActErrId] = useState<string | null>(null);

  // Listen → Act: turn a trend into a Studio draft in one click.
  const act = async (a: SocialAlert) => {
    const uid = studioUserId();
    setActingId(a.id);
    setActErrId(null);
    try {
      const brand = (await api.studioGetBrand(uid)) || DEFAULT_BRAND;
      const headline = alertHeadline(a);
      const outputs = await api.studioCompose({
        brand,
        template: {},
        source: {
          title: headline,
          content: a.sampleText || `${headline} — «${a.topicLabel}» با ${a.count} اشاره.`,
          source: a.topicLabel,
          link: a.sampleLink,
        },
        platforms: ["telegram"],
      });
      await api.studioSaveDraft(uid, {
        title: headline.slice(0, 80),
        sourceTitle: headline,
        sourceLink: a.sampleLink || "",
        outputs,
        status: "draft",
      });
      setActedIds((prev) => new Set(prev).add(a.id));
    } catch (e) {
      console.log("listen→act draft failed:", e);
      setActErrId(a.id);
    } finally {
      setActingId(null);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.socialGetAlerts({ topicId });
      setAlerts(r.alerts);
      // Mark visible alerts as read so the badge clears.
      const unreadIds = r.alerts.filter((a) => !a.read).map((a) => a.id);
      if (unreadIds.length) { try { await api.socialMarkAlertsRead({ ids: unreadIds }); } catch {} }
    } catch (e) {
      console.log("social alerts load error:", e);
    } finally { setLoading(false); }
  }, [topicId]);

  useEffect(() => { load(); }, [load]);

  const scan = async () => {
    setScanning(true);
    try { await api.socialScan(); await load(); }
    catch (e) { console.log("social scan error:", e); }
    finally { setScanning(false); }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/70">
        <span className="text-[12px] text-slate-400">
          {loading ? "در حال بارگذاری…" : `${toFa(alerts.length)} هشدار`}
        </span>
        <span className="flex-1" />
        <button onClick={scan} disabled={scanning}
          className="inline-flex items-center gap-1.5 text-[12px] rounded-full bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 text-white px-3 py-1.5">
          {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {scanning ? "در حال پویش…" : "پویش اکنون"}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-2 py-16 px-6 text-slate-400">
            <BellOff className="w-8 h-8" />
            <div className="text-[14px] font-medium text-slate-500 dark:text-slate-300">هنوز هشداری نیست</div>
            <div className="text-[12px] max-w-xs leading-relaxed">
              با هر پویش، واژه‌های نوظهور و جهش‌های ناگهانی در گفتگوها اینجا نمایان می‌شوند. پویش به‌صورت خودکار در هر تیک زمان‌بند نیز اجرا می‌شود.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {alerts.map((a) => {
              const meta = ALERT_META[a.kind];
              const Icon = meta.icon;
              return (
                <div key={a.id} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${meta.cls}`} />
                    <span className={`text-[13px] font-semibold ${meta.cls}`}>{meta.label}</span>
                    {!compact && a.topicLabel && (
                      <span className="text-[11px] rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5">{a.topicLabel}</span>
                    )}
                    <span className="flex-1" />
                    <span className="text-[11px] text-slate-400">{timeAgoFa(a.ts)}</span>
                  </div>
                  <div className="text-[13.5px] text-slate-700 dark:text-slate-100">{alertHeadline(a)}</div>
                  <div className="text-[11.5px] text-slate-400 mt-0.5">
                    {toFa(a.count)} اشاره
                    {a.kind !== "emerging" && a.baseline > 0 && <> · پایه {toFa(a.baseline)} · ×{toFa(a.factor)}</>}
                  </div>
                  {a.sampleText && (
                    <a href={a.sampleLink || undefined} target={a.sampleLink ? "_blank" : undefined} rel="noopener noreferrer"
                      className={`mt-1.5 block text-[12px] leading-relaxed line-clamp-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-slate-600 dark:text-slate-300 ${a.sampleLink ? "hover:bg-slate-100 dark:hover:bg-slate-800" : ""}`}>
                      {a.sampleText}
                      {a.sampleLink && <ExternalLink className="inline w-3 h-3 mr-1 align-text-bottom" />}
                    </a>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    {actedIds.has(a.id) ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-[12px] rounded-full px-3 py-1.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          <Check className="w-3.5 h-3.5" /> پیش‌نویس ساخته شد
                        </span>
                        {onOpenStudio && (
                          <button onClick={onOpenStudio}
                            className="inline-flex items-center gap-1.5 text-[12px] rounded-full px-3 py-1.5 bg-violet-500 hover:bg-violet-600 text-white">
                            <Wand2 className="w-3.5 h-3.5" /> باز کردن استودیو
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => act(a)}
                        disabled={actingId === a.id}
                        className="inline-flex items-center gap-1.5 text-[12px] rounded-full px-3 py-1.5 bg-violet-500 hover:bg-violet-600 disabled:opacity-70 text-white">
                        {actingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                        {actingId === a.id ? "در حال ساخت…" : "ساخت پیش‌نویس"}
                      </button>
                    )}
                    {actErrId === a.id && <span className="text-[11px] text-rose-500">ساخت پیش‌نویس ناموفق بود</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────── add/edit topic form ───────────
export function TopicForm({ initial, onClose, onSaved }: {
  initial: WatchTopic | null;
  onClose: () => void;
  onSaved: (t: WatchTopic) => void;
}) {
  const [label, setLabel] = useState(initial?.label || "");
  const [keywords, setKeywords] = useState((initial?.keywords || []).join("، "));
  const [sources, setSources] = useState<WatchSource[]>(initial?.sources || []);
  const [sourceInput, setSourceInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const addSource = () => {
    const raw = sourceInput.trim();
    if (!raw) return;
    const d = detectSource(raw);
    if (!d) { setError("منبع شناسایی نشد. یک اکانت (مثلاً @handle)، لینک کانال تلگرام/توییتر یا آدرس RSS وارد کنید."); return; }
    if (sources.some((s) => s.url === d.url)) { setSourceInput(""); return; }
    setSources((prev) => [...prev, { url: d.url, name: d.name, kind: d.kind, icon: d.icon }]);
    setSourceInput("");
    setError(null);
  };

  const save = async () => {
    if (!label.trim()) { setError("عنوان موضوع را وارد کنید."); return; }
    if (sources.length === 0) { setError("حداقل یک منبع اضافه کنید."); return; }
    setSaving(true);
    setError(null);
    try {
      const kw = keywords.split(/[،,\n]/).map((k) => k.trim()).filter(Boolean);
      const t = await api.socialSaveTopic({ id: initial?.id, label: label.trim(), keywords: kw, sources });
      onSaved(t);
    } catch (e) {
      console.log("save topic error:", e);
      setError("خطا در ذخیره موضوع.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div dir="rtl" className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <Radar className="w-5 h-5 text-cyan-500" />
          <span className="font-semibold">{initial ? "ویرایش موضوع رصد" : "موضوع رصد تازه"}</span>
          <div className="flex-1" />
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-[12px] text-slate-500 mb-1 block">عنوان موضوع</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder="مثلاً: نام برند، یک شخصیت، یک رویداد"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-sm outline-none focus:border-cyan-400" />
          </div>

          <div>
            <label className="text-[12px] text-slate-500 mb-1 block">منابع (اکانت‌ها / کانال‌ها)</label>
            <div className="flex gap-2">
              <input value={sourceInput}
                onChange={(e) => setSourceInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSource(); } }}
                placeholder="@handle یا t.me/channel یا آدرس RSS"
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-sm outline-none focus:border-cyan-400" />
              <button onClick={addSource} className="px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm">افزودن</button>
            </div>
            {sources.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {sources.map((s) => (
                  <span key={s.url} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[12px]">
                    <span>{s.icon || KIND_META[s.kind as keyof typeof KIND_META]?.icon || "📡"}</span>
                    <span className="truncate max-w-[140px]">{s.name}</span>
                    <button onClick={() => setSources((p) => p.filter((x) => x.url !== s.url))} className="text-slate-400 hover:text-rose-500"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-[12px] text-slate-500 mb-1 block">کلیدواژه‌ها (اختیاری، با ویرگول جدا کنید)</label>
            <input value={keywords} onChange={(e) => setKeywords(e.target.value)}
              placeholder="برای فیلتر پست‌ها؛ خالی = همهٔ پست‌های منابع"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-sm outline-none focus:border-cyan-400" />
          </div>

          {error && <div className="text-[12px] text-rose-500 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {error}</div>}
        </div>
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800">انصراف</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm bg-cyan-500 hover:bg-cyan-600 text-white disabled:opacity-50 flex items-center gap-1.5">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} ذخیره
          </button>
        </div>
      </div>
    </div>
  );
}
