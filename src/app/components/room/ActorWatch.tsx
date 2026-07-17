import { useMemo, useState } from "react";
import { Users, Plus, X, AlertTriangle } from "lucide-react";
import type { Article } from "../../data";
import { scoreArticle } from "../../sentiment";
import { timeAgoFa, faNum } from "../mobile/utils/fa";
import { articleMs, articlesOfActor, missedTopics } from "./roomUtils";
import { getActors, setActors } from "./roomStore";

// ── ۳.۶ نمای رقبا و بازیگران (Actor Watch) ──
// ستون اختصاصی برای هر رقیب/بازیگر زیرِ رصد + هشدار «سوژهٔ ازدست‌رفته».

type Props = {
  articles: Article[];
  mySources?: string[];        // منابع «ما» برای تشخیص سوژهٔ ازدست‌رفته
  onSelect: (a: Article) => void;
  big?: boolean;
};

function toneDot(a: Article) {
  const l = scoreArticle(a).label;
  return l === "positive" ? "bg-emerald-500" : l === "negative" ? "bg-rose-500" : "bg-slate-400";
}

export function ActorWatch({ articles, mySources = [], onSelect, big }: Props) {
  const [actors, setActorsState] = useState<string[]>(() => getActors());
  const [newActor, setNewActor] = useState("");

  function addActor() {
    const v = newActor.trim();
    if (!v || actors.includes(v)) { setNewActor(""); return; }
    const next = [...actors, v];
    setActorsState(next); setActors(next); setNewActor("");
  }
  function removeActor(a: string) {
    const next = actors.filter(x => x !== a);
    setActorsState(next); setActors(next);
  }

  const missed = useMemo(
    () => (actors.length ? missedTopics(articles, actors, mySources) : []),
    [articles, actors, mySources],
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-slate-900">
      <div className="flex items-center gap-2 p-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <Users className="w-4 h-4 text-sky-500" />
        <h3 className={big ? "text-lg" : "text-sm"}>نمای رقبا و بازیگران</h3>
        {!big && (
          <div className="mr-auto flex items-center gap-1">
            <input value={newActor} onChange={e => setNewActor(e.target.value)} onKeyDown={e => e.key === "Enter" && addActor()}
              placeholder="نام منبع/رقیب…"
              className="w-36 bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500" />
            <button onClick={addActor} className="p-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700"><Plus className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>

      {/* هشدار سوژهٔ ازدست‌رفته */}
      {missed.length > 0 && (
        <div className="shrink-0 p-2 border-b border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/10">
          <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 mb-1">
            <AlertTriangle className="w-3.5 h-3.5" /> سوژه‌هایی که رقبا پوشش داده‌اند و شما نه:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {missed.map(m => (
              <button key={m.term} onClick={() => m.sample && onSelect(m.sample)}
                className="text-[11px] px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-900/50 hover:border-amber-500">
                {m.term} <span className="text-amber-600">({faNum(m.byActors)})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {actors.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-slate-400">
          هنوز رقیبی اضافه نشده. نام منبع رقیب را وارد کنید تا ستون اختصاصی آن ساخته شود.
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-x-auto">
          <div className="flex gap-3 p-3 h-full" style={{ minWidth: "min-content" }}>
            {actors.map(actor => {
              const arts = articlesOfActor(articles, actor).slice(0, 40);
              const last = arts[0];
              return (
                <div key={actor} className={`flex flex-col ${big ? "w-96" : "w-72"} shrink-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 min-h-0`}>
                  <div className="flex items-center gap-2 p-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <span className="truncate flex-1 text-sm">{last?.sourceIcon} {actor}</span>
                    <span className="text-[11px] text-slate-400">{faNum(arts.length)}</span>
                    {!big && <button onClick={() => removeActor(actor)} className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-500"><X className="w-3.5 h-3.5" /></button>}
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
                    {arts.length === 0 && <div className="text-[11px] text-slate-400 p-2">مطلبی از این منبع در جریان فعلی نیست.</div>}
                    {arts.map(a => (
                      <button key={a.id} onClick={() => onSelect(a)}
                        className="w-full text-right p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-400 transition">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-0.5">
                          <span className={`w-2 h-2 rounded-full ${toneDot(a)}`} />
                          <span className="mr-auto">{timeAgoFa(articleMs(a))}</span>
                        </div>
                        <div className={`${big ? "text-sm" : "text-xs"} leading-5 line-clamp-3`}>{a.title}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
