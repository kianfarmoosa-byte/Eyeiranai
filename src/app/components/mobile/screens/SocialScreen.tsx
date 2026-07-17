import { useCallback, useEffect, useState } from "react";
import { Radar, Plus, Trash2, Loader2, MessageSquare, Gauge, ChevronLeft, Flame, Radio, Users, Globe, Clock, TrendingUp } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { EmptyState } from "../primitives/EmptyState";
import { useHaptics } from "../hooks";
import { toFa } from "../utils/fa";
import { api, type WatchTopic, type SocialPost } from "../../../api";
import { PostsList, PulsePanel, RepostsPanel, TopicForm, AlertsPanel } from "../../SocialListening";
import { useSocialInsights } from "../../social/socialAnalysis";
import {
  SentimentTimelinePanel, TrendsPanel, ReachPanel, CampaignPanel, TimelinePanel, GeoPanel,
} from "../../social/socialPanels";

type Tab = "posts" | "pulse" | "trends" | "reach" | "campaign" | "geo" | "timeline" | "alerts";

type Props = { onClose: () => void; onOpenStudio?: () => void };

export function SocialScreen({ onClose, onOpenStudio }: Props) {
  const haptic = useHaptics();
  const [topics, setTopics] = useState<WatchTopic[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [tab, setTab] = useState<Tab>("posts");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WatchTopic | null>(null);

  const loadTopics = useCallback(async () => {
    setLoadingTopics(true);
    try {
      const t = await api.socialGetTopics();
      setTopics(t);
    } catch (e) {
      console.log("mobile social topics error:", e);
    } finally {
      setLoadingTopics(false);
    }
  }, []);

  useEffect(() => { loadTopics(); }, [loadTopics]);

  const loadPosts = useCallback(async (id: string, refresh?: boolean) => {
    setLoadingPosts(true);
    try {
      const r = await api.socialGetPosts(id, refresh);
      setPosts(r.posts);
    } catch (e) {
      console.log("mobile social posts error:", e);
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    if (activeId) { setTab("posts"); loadPosts(activeId); }
    else setPosts([]);
  }, [activeId, loadPosts]);

  const activeTopic = topics.find((t) => t.id === activeId) || null;
  const insights = useSocialInsights(posts, activeTopic);
  const { scored, pulse, clusters } = insights;

  const deleteTopic = async (id: string) => {
    if (!confirm("حذف این موضوع رصد؟")) return;
    try { await api.socialDeleteTopic(id); await loadTopics(); }
    catch (e) { console.log("mobile delete topic error:", e); }
  };

  // ── detail view ──
  if (activeTopic) {
    return (
      <MobileScreen
        withBottomNav={false}
        topbar={
          <MobileTopBar
            title={activeTopic.label}
            subtitle={`${toFa(posts.length)} پست · ${toFa(activeTopic.sources.length)} منبع`}
            onBack={() => setActiveId(null)}
            onRefresh={() => loadPosts(activeTopic.id, true)}
            loading={loadingPosts}
          />
        }
      >
        <div className="flex flex-col h-full min-h-0">
          {/* segmented tabs */}
          <div className="flex items-center gap-1 px-2 py-2 border-b border-[var(--border-subtle)] overflow-x-auto scrollbar-none">
            {([
              { id: "posts", label: "پست‌ها", icon: MessageSquare },
              { id: "pulse", label: "نبض", icon: Gauge },
              { id: "trends", label: "ترند", icon: Flame },
              { id: "reach", label: "دامنه", icon: Radio },
              { id: "campaign", label: "کمپین", icon: Users, badge: clusters.length },
              { id: "geo", label: "جغرافیا", icon: Globe },
              { id: "timeline", label: "زمان", icon: Clock },
              { id: "alerts", label: "هشدار", icon: TrendingUp },
            ] as { id: Tab; label: string; icon: any; badge?: number }[]).map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => { haptic("select"); setTab(t.id); }}
                  className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-[13px] ${
                    active ? "bg-cyan-500 text-white" : "bg-[var(--accent)] text-[var(--foreground-subtle)]"
                  }`}>
                  <Icon className="w-3.5 h-3.5" /> {t.label}
                  {!!t.badge && t.badge > 0 && (
                    <span className={`text-[10px] rounded-full px-1.5 ${active ? "bg-white/25" : "bg-amber-500 text-white"}`}>{toFa(t.badge)}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {tab === "alerts" ? (
              <AlertsPanel topicId={activeTopic.id} compact onOpenStudio={onOpenStudio} />
            ) : tab === "geo" ? (
              <GeoPanel topic={activeTopic} />
            ) : loadingPosts && posts.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-[var(--foreground-subtle)] gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> در حال جمع‌آوری…
              </div>
            ) : posts.length === 0 ? (
              <div className="py-16"><EmptyState icon={<Radar className="w-8 h-8" />} title="پستی یافت نشد" description="منابع یا کلیدواژه‌های موضوع را بازبینی کنید." /></div>
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
        </div>

        {showForm && (
          <TopicForm initial={editing} onClose={() => setShowForm(false)}
            onSaved={async (t) => { setShowForm(false); await loadTopics(); setActiveId(t.id); }} />
        )}
      </MobileScreen>
    );
  }

  // ── topic list view ──
  return (
    <MobileScreen
      withBottomNav={false}
      topbar={<MobileTopBar title="رصد اجتماعی" onBack={onClose} />}
      fab={
        <button
          onClick={() => { haptic("heavy"); setEditing(null); setShowForm(true); }}
          className="size-14 rounded-full bg-cyan-500 text-white grid place-items-center shadow-lg active:scale-95 transition">
          <Plus className="w-6 h-6" />
        </button>
      }
    >
      <div className="h-full overflow-y-auto px-3 py-3">
        {loadingTopics ? (
          <div className="flex items-center justify-center py-16 text-[var(--foreground-subtle)]"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : topics.length === 0 ? (
          <div className="py-16">
            <EmptyState icon={<Radar className="w-8 h-8" />} title="موضوعی برای رصد نیست"
              description="یک برند، شخص یا رویداد را تحت‌نظر بگیرید تا پست‌های عمومی مرتبط را جمع‌آوری و تحلیل کنیم." />
          </div>
        ) : (
          <div className="space-y-2">
            {topics.map((t) => (
              <div key={t.id}
                onClick={() => { haptic("select"); setActiveId(t.id); }}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] px-4 py-3 flex items-center gap-3 active:bg-[var(--accent)]">
                <div className="size-10 rounded-full bg-cyan-100 dark:bg-cyan-950/40 grid place-items-center shrink-0">
                  <Radar className="w-5 h-5 text-cyan-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{t.label}</div>
                  <div className="text-[12px] text-[var(--foreground-subtle)]">
                    {toFa(t.sources.length)} منبع · {toFa(t.keywords.length)} کلیدواژه
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setEditing(t); setShowForm(true); }}
                  className="p-2 rounded-full text-[var(--foreground-subtle)] active:bg-[var(--accent)]" aria-label="ویرایش">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
                <button onClick={(e) => { e.stopPropagation(); deleteTopic(t.id); }}
                  className="p-2 rounded-full text-rose-400 active:bg-rose-50 dark:active:bg-rose-950/30" aria-label="حذف">
                  <Trash2 className="w-4 h-4" />
                </button>
                <ChevronLeft className="w-4 h-4 text-[var(--foreground-subtle)] shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <TopicForm initial={editing} onClose={() => setShowForm(false)}
          onSaved={async (t) => { setShowForm(false); await loadTopics(); setActiveId(t.id); }} />
      )}
    </MobileScreen>
  );
}
