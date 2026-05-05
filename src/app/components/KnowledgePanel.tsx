import { useMemo, useState } from "react";
import { X, Brain, Users, Building2, MapPin, Tag, Layers, GitMerge, Sparkles, ChevronRight, Clock, Hash } from "lucide-react";
import type { Article } from "../data";
import {
  extractEntities, clusterTopics, buildStoryThreads, findDuplicates,
  type Entity,
} from "../knowledge";
import type { TopicQuery } from "../timeline";

type Props = {
  open: boolean;
  onClose: () => void;
  articles: Article[];
  onSelect: (id: string) => void;
  onOpenTimeline?: (topic: TopicQuery) => void;
};

type Tab = "entities" | "clusters" | "threads" | "dupes";

const ENTITY_ICON: Record<Entity["kind"], any> = {
  person: Users, organization: Building2, place: MapPin, thing: Tag,
};

const ENTITY_LABEL: Record<Entity["kind"], string> = {
  person: "اشخاص", organization: "سازمان‌ها", place: "مکان‌ها", thing: "موجودیت‌ها",
};

export function KnowledgePanel({ open, onClose, articles, onSelect, onOpenTimeline }: Props) {
  const [tab, setTab] = useState<Tab>("clusters");
  const [entityFilter, setEntityFilter] = useState<Entity["kind"] | "all">("all");
  const [openCluster, setOpenCluster] = useState<string | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);

  const entities = useMemo(() => open ? extractEntities(articles) : [], [articles, open]);
  const clusters = useMemo(() => open ? clusterTopics(articles) : [], [articles, open]);
  const threads = useMemo(() => open ? buildStoryThreads(articles) : [], [articles, open]);
  const dupes = useMemo(() => open ? findDuplicates(articles) : [], [articles, open]);

  const filteredEntities = useMemo(() => entityFilter === "all" ? entities : entities.filter(e => e.kind === entityFilter), [entities, entityFilter]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-stretch md:items-center md:justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-4xl md:max-h-[90vh] bg-white dark:bg-slate-950 md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="font-semibold text-lg">موتور دانش — تحلیل محتوای فعلی</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </header>

        <nav className="flex border-b border-slate-200 dark:border-slate-800 shrink-0 overflow-x-auto">
          {([
            { id: "clusters", label: `موضوعات (${clusters.length})`, icon: Layers },
            { id: "threads",  label: `رشته‌های خبر (${threads.length})`, icon: Sparkles },
            { id: "entities", label: `موجودیت‌ها (${entities.length})`, icon: Hash },
            { id: "dupes",    label: `تکراری‌ها (${dupes.length})`, icon: GitMerge },
          ] as { id: Tab; label: string; icon: any }[]).map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 whitespace-nowrap ${tab === t.id ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-slate-600 dark:text-slate-400"}`}>
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {tab === "clusters" && (
            <div className="space-y-2">
              {clusters.length === 0 ? <Empty text="مقالهٔ کافی برای خوشه‌بندی موجود نیست." /> :
                clusters.map(c => (
                  <div key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <button onClick={() => setOpenCluster(openCluster === c.id ? null : c.id)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-900 text-right">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 text-white flex items-center justify-center shrink-0">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{c.label}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-1">
                          {c.keywords.map(k => <span key={k} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900">#{k}</span>)}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shrink-0">{c.size}</span>
                      {onOpenTimeline && (
                        <span onClick={(e) => { e.stopPropagation(); onOpenTimeline({ kind: "ids", ids: new Set(c.articles.map(a => a.id)), label: c.label }); }}
                          className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 text-slate-400 hover:text-blue-600 cursor-pointer" title="خط زمانی این خوشه">
                          <Clock className="w-4 h-4" />
                        </span>
                      )}
                      <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${openCluster === c.id ? "rotate-90" : ""}`} />
                    </button>
                    {openCluster === c.id && (
                      <div className="border-t border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-900">
                        {c.articles.slice(0, 20).map(a => (
                          <button key={a.id} onClick={() => onSelect(a.id)}
                            className="w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-900 text-right">
                            <span className="text-xs text-slate-400 w-12 shrink-0">{a.source.slice(0, 12)}</span>
                            <span className="text-sm truncate flex-1">{a.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}

          {tab === "threads" && (
            <div className="space-y-2">
              {threads.length === 0 ? <Empty text="رشتهٔ خبری معناداری کشف نشد." /> :
                threads.map(t => (
                  <div key={t.id} className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <button onClick={() => setOpenThread(openThread === t.id ? null : t.id)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-900 text-right">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-rose-500 text-white flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{t.label}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(t.span.from).toLocaleDateString("fa-IR")} — {new Date(t.span.to).toLocaleDateString("fa-IR")}</span>
                          <span>·</span>
                          <span>{t.sources.size} منبع</span>
                        </div>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 shrink-0">{t.articles.length}</span>
                      {onOpenTimeline && (
                        <span onClick={(e) => { e.stopPropagation(); onOpenTimeline({ kind: "ids", ids: new Set(t.articles.map(a => a.id)), label: t.label }); }}
                          className="p-1.5 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/40 text-slate-400 hover:text-amber-600 cursor-pointer" title="خط زمانی این رشته">
                          <Clock className="w-4 h-4" />
                        </span>
                      )}
                      <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${openThread === t.id ? "rotate-90" : ""}`} />
                    </button>
                    {openThread === t.id && (
                      <div className="border-t border-slate-200 dark:border-slate-800">
                        <ol className="relative ms-6 my-2 border-s border-slate-200 dark:border-slate-800">
                          {t.articles.map(a => (
                            <li key={a.id} className="ms-4 mb-2">
                              <span className="absolute -start-1.5 w-3 h-3 rounded-full bg-amber-500"></span>
                              <button onClick={() => onSelect(a.id)} className="text-sm text-right hover:text-blue-600">
                                <div className="text-[11px] text-slate-500">{new Date(a.date).toLocaleString("fa-IR")} · {a.source}</div>
                                <div className="font-medium">{a.title}</div>
                              </button>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}

          {tab === "entities" && (
            <div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(["all", "person", "organization", "place", "thing"] as const).map(k => (
                  <button key={k} onClick={() => setEntityFilter(k)}
                    className={`px-2.5 py-1 rounded-md text-xs ${entityFilter === k ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900"}`}>
                    {k === "all" ? "همه" : ENTITY_LABEL[k]}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredEntities.map(e => {
                  const Icon = ENTITY_ICON[e.kind];
                  return (
                    <div key={e.text + e.kind} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 flex items-center gap-2 bg-white dark:bg-slate-950">
                      <Icon className="w-4 h-4 text-slate-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{e.text}</div>
                        <div className="text-[11px] text-slate-500">{ENTITY_LABEL[e.kind]} · در {e.articleIds.size} مقاله</div>
                      </div>
                      {onOpenTimeline && (
                        <button onClick={() => onOpenTimeline({ kind: "entity", text: e.text, label: e.text })}
                          className="p-1 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 text-slate-400 hover:text-blue-600" title="خط زمانی">
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900">{e.count}</span>
                    </div>
                  );
                })}
                {filteredEntities.length === 0 && <Empty text="موجودیتی یافت نشد." />}
              </div>
            </div>
          )}

          {tab === "dupes" && (
            <div className="space-y-2">
              {dupes.length === 0 ? <Empty text="نسخهٔ تکراری بین‌منبعی یافت نشد." /> :
                dupes.map(g => (
                  <div key={g.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-950">
                    <button onClick={() => onSelect(g.primary.id)} className="text-right w-full">
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mb-0.5">منبع اصلی · {g.primary.source}</div>
                      <div className="font-medium text-sm truncate">{g.primary.title}</div>
                    </button>
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-900 space-y-1">
                      {g.duplicates.map(d => (
                        <button key={d.id} onClick={() => onSelect(d.id)}
                          className="w-full flex items-center gap-2 text-right text-xs hover:text-blue-600">
                          <GitMerge className="w-3 h-3 text-slate-400" />
                          <span className="text-slate-500 w-20 truncate">{d.source}</span>
                          <span className="truncate flex-1">{d.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center text-sm text-slate-500 py-10">{text}</div>;
}
