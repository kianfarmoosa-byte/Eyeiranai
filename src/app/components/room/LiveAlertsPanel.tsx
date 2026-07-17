import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell, BellPlus, Volume2, VolumeX, Hand, Trash2, Send, ChevronLeft, Plus, X,
} from "lucide-react";
import type { Article } from "../../data";
import { timeAgoFa, faNum } from "../mobile/utils/fa";
import { articleMs, tokensOf, detectWaves } from "./roomUtils";
import {
  getAlerts, setAlerts as persistAlerts, getWatches, setWatches as persistWatches,
  RESPONSE_FLOW, uid,
  type RoomAlert, type KeywordWatch, type AlertSeverity, type ResponseStatus,
} from "./roomStore";

// ── ۳.۴ پنل هشدارهای زنده و مدیریت واکنش (Live Alerts) ──
// سطح‌بندی شدت، تولید خودکار هشدار از دیده‌بان کلیدواژه و رادار موج،
// برداشت مسئولیت (Claim)، جریان وضعیت واکنش، تاریخچه و کانال‌های توزیع.

type Props = {
  articles: Article[];
  operator: string;
  soundOn: boolean;
  onToggleSound: () => void;
  onFocusArticle?: (id: string) => void;
  onAlertsChange?: (count: number) => void;
  compact?: boolean;
};

const SEV: Record<AlertSeverity, { label: string; ring: string; dot: string; chip: string }> = {
  urgent: { label: "فوری", ring: "border-rose-300 dark:border-rose-900/50", dot: "bg-rose-500", chip: "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300" },
  important: { label: "مهم", ring: "border-amber-300 dark:border-amber-900/50", dot: "bg-amber-500", chip: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300" },
  normal: { label: "عادی", ring: "border-slate-200 dark:border-slate-800", dot: "bg-slate-400", chip: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" },
};

const CHANNELS = ["تلگرام", "پیامک", "ایمیل", "واتساپ"];

// بوق کوتاه برای هشدارهای فوری (Web Audio)
function beep() {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = 880;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.start(); o.stop(ctx.currentTime + 0.36);
    setTimeout(() => ctx.close().catch(() => {}), 500);
  } catch { /* ignore */ }
}

export function LiveAlertsPanel({ articles, operator, soundOn, onToggleSound, onFocusArticle, onAlertsChange, compact }: Props) {
  const [alerts, setAlerts] = useState<RoomAlert[]>(() => getAlerts());
  const [watches, setWatches] = useState<KeywordWatch[]>(() => getWatches());
  const [showWatches, setShowWatches] = useState(false);
  const [newTerm, setNewTerm] = useState("");
  const [newSev, setNewSev] = useState<AlertSeverity>("important");
  const [filter, setFilter] = useState<"open" | "all">("open");
  const knownIds = useRef<Set<string>>(new Set(getAlerts().map(a => a.id)));

  const save = (next: RoomAlert[]) => { setAlerts(next); persistAlerts(next); onAlertsChange?.(next.filter(a => a.status !== "closed").length); };
  const saveWatches = (next: KeywordWatch[]) => { setWatches(next); persistWatches(next); };

  // تولید خودکار هشدار از دیده‌بان کلیدواژه و رادار موج
  useEffect(() => {
    const existing = new Map(alerts.map(a => [a.id, a]));
    const additions: RoomAlert[] = [];
    const now = Date.now();
    const recent = articles.filter(a => articleMs(a) >= now - 6 * 3600000);

    // دیده‌بان کلیدواژه
    for (const w of watches) {
      const term = w.term.toLowerCase();
      for (const a of recent) {
        const hay = `${a.title} ${a.preview || ""}`.toLowerCase();
        if (!hay.includes(term) && !tokensOf(a).includes(term)) continue;
        const id = `kw:${w.id}:${a.id}`;
        if (existing.has(id)) continue;
        additions.push({
          id, severity: w.severity, kind: "keyword",
          title: `کلیدواژهٔ «${w.term}»`, detail: a.title, source: a.source, link: a.link, articleId: a.id, topic: w.term,
          status: "new", createdAt: now, updatedAt: now,
          history: [{ at: now, by: "سیستم", note: "شناسایی خودکار بر پایهٔ دیده‌بان کلیدواژه" }],
        });
      }
    }

    // رادار موج
    for (const wave of detectWaves(articles)) {
      const id = `wave:${wave.term}`;
      if (existing.has(id)) continue;
      additions.push({
        id, severity: wave.toneShift ? "urgent" : "important", kind: "wave",
        title: `موج در حال شکل‌گیری: «${wave.term}»`,
        detail: `${faNum(wave.current)} مطلب در ساعات اخیر (${wave.factor.toFixed(1)}× خط پایه)${wave.toneShift ? " — چرخش لحن به منفی" : ""}`,
        source: wave.sample?.source, link: wave.sample?.link, articleId: wave.sample?.id, topic: wave.term,
        status: "new", createdAt: now, updatedAt: now,
        history: [{ at: now, by: "سیستم", note: "شناسایی خودکار توسط رادار موج" }],
      });
    }

    if (additions.length === 0) return;
    const next = [...alerts, ...additions];
    save(next);
    if (soundOn && additions.some(a => a.severity === "urgent" && !knownIds.current.has(a.id))) beep();
    for (const a of additions) knownIds.current.add(a.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, watches]);

  const claim = (id: string) => save(alerts.map(a => a.id !== id ? a : {
    ...a, claimedBy: operator || "کارشناس", status: a.status === "new" ? "reviewing" : a.status, updatedAt: Date.now(),
    history: [...a.history, { at: Date.now(), by: operator || "کارشناس", note: "برداشت هشدار (Claim)" }],
  }));

  const advance = (id: string, status: ResponseStatus) => save(alerts.map(a => a.id !== id ? a : {
    ...a, status, updatedAt: Date.now(),
    history: [...a.history, { at: Date.now(), by: operator || "کارشناس", note: `تغییر وضعیت به «${RESPONSE_FLOW.find(f => f.id === status)?.label}»` }],
  }));

  const distribute = (id: string, channel: string) => save(alerts.map(a => a.id !== id ? a : {
    ...a, updatedAt: Date.now(),
    history: [...a.history, { at: Date.now(), by: operator || "کارشناس", note: `ارسال به ${channel}` }],
  }));

  const remove = (id: string) => save(alerts.filter(a => a.id !== id));

  function addWatch() {
    const t = newTerm.trim();
    if (!t || watches.some(w => w.term === t)) { setNewTerm(""); return; }
    saveWatches([...watches, { id: uid("w"), term: t, severity: newSev, sound: true }]);
    setNewTerm("");
  }
  function removeWatch(id: string) { saveWatches(watches.filter(w => w.id !== id)); }

  const visible = useMemo(() => {
    const list = filter === "open" ? alerts.filter(a => a.status !== "closed") : alerts;
    const rank: Record<AlertSeverity, number> = { urgent: 0, important: 1, normal: 2 };
    return [...list].sort((a, b) => rank[a.severity] - rank[b.severity] || b.createdAt - a.createdAt);
  }, [alerts, filter]);

  const openCount = useMemo(() => alerts.filter(a => a.status !== "closed").length, [alerts]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-slate-900">
      <div className="flex items-center gap-2 p-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <Bell className="w-4 h-4 text-rose-500" />
        <h3 className="text-sm">هشدارهای زنده</h3>
        <span className="text-[11px] text-slate-400">{faNum(openCount)} باز</span>
        <div className="mr-auto flex items-center gap-1">
          <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 gap-0.5 text-xs">
            <button onClick={() => setFilter("open")} className={`px-2 py-1 rounded-md ${filter === "open" ? "bg-white dark:bg-slate-900 shadow-sm" : "text-slate-500"}`}>باز</button>
            <button onClick={() => setFilter("all")} className={`px-2 py-1 rounded-md ${filter === "all" ? "bg-white dark:bg-slate-900 shadow-sm" : "text-slate-500"}`}>همه</button>
          </div>
          <button onClick={onToggleSound} title={soundOn ? "قطع صدا" : "صدا"} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            {soundOn ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>
          <button onClick={() => setShowWatches(s => !s)} title="دیده‌بان کلیدواژه" className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 ${showWatches ? "text-emerald-600" : ""}`}>
            <BellPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* دیده‌بان کلیدواژه */}
      {showWatches && (
        <div className="shrink-0 p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
          <div className="flex items-center gap-1.5">
            <input value={newTerm} onChange={e => setNewTerm(e.target.value)} onKeyDown={e => e.key === "Enter" && addWatch()}
              placeholder="کلیدواژهٔ دیده‌بانی…"
              className="flex-1 bg-white dark:bg-slate-900 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <select value={newSev} onChange={e => setNewSev(e.target.value as AlertSeverity)}
              className="bg-white dark:bg-slate-900 rounded-lg px-2 py-1.5 text-xs">
              <option value="urgent">فوری</option>
              <option value="important">مهم</option>
              <option value="normal">عادی</option>
            </select>
            <button onClick={addWatch} className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"><Plus className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {watches.length === 0 && <span className="text-[11px] text-slate-400">هنوز دیده‌بانی تعریف نشده.</span>}
            {watches.map(w => (
              <span key={w.id} className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg ${SEV[w.severity].chip}`}>
                {w.term}
                <button onClick={() => removeWatch(w.id)} className="hover:text-rose-600"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {visible.length === 0 && (
          <div className="p-6 text-center text-xs text-slate-400">
            <Bell className="w-6 h-6 mx-auto mb-2 text-slate-300" /> هشداری در این نما نیست.
          </div>
        )}
        {visible.map(a => {
          const sev = SEV[a.severity];
          const flowIdx = RESPONSE_FLOW.findIndex(f => f.id === a.status);
          return (
            <div key={a.id} className={`rounded-xl border ${sev.ring} bg-white dark:bg-slate-900 p-3`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${sev.dot} ${a.severity === "urgent" ? "animate-pulse" : ""}`} />
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${sev.chip}`}>{sev.label}</span>
                <span className="text-[11px] text-slate-400">{timeAgoFa(a.createdAt)}</span>
                {a.claimedBy && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">مسئول: {a.claimedBy}</span>}
                <button onClick={() => remove(a.id)} className="mr-auto text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <div className="mt-1.5 text-sm leading-6">{a.title}</div>
              {a.detail && (
                <button onClick={() => a.articleId && onFocusArticle?.(a.articleId)}
                  className="text-[11px] text-right text-slate-500 mt-0.5 line-clamp-2 hover:text-emerald-600 w-full">
                  {a.source ? `${a.source} — ` : ""}{a.detail}
                </button>
              )}

              {/* جریان وضعیت واکنش */}
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {RESPONSE_FLOW.map((f, i) => (
                  <button key={f.id} onClick={() => advance(a.id, f.id)}
                    className={`text-[10px] px-1.5 py-0.5 rounded-full transition ${i <= flowIdx
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
                    {f.label}
                  </button>
                ))}
              </div>

              {/* اقدامات */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {!a.claimedBy && (
                  <button onClick={() => claim(a.id)}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                    <Hand className="w-3.5 h-3.5" /> برداشت مسئولیت
                  </button>
                )}
                <div className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <Send className="w-3.5 h-3.5" />
                  {CHANNELS.map(c => (
                    <button key={c} onClick={() => distribute(a.id, c)}
                      className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-sky-950/40">{c}</button>
                  ))}
                </div>
              </div>

              {/* تاریخچه */}
              {a.history.length > 0 && (
                <details className="mt-2">
                  <summary className="text-[11px] text-slate-400 cursor-pointer inline-flex items-center gap-1">
                    <ChevronLeft className="w-3 h-3" /> تاریخچهٔ واکنش ({faNum(a.history.length)})
                  </summary>
                  <div className="mt-1 space-y-0.5 pr-3 border-r border-slate-200 dark:border-slate-700">
                    {a.history.slice().reverse().map((h, i) => (
                      <div key={i} className="text-[11px] text-slate-500">
                        <span className="text-slate-400">{timeAgoFa(h.at)}</span> · {h.by}: {h.note}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
