import { useEffect, useMemo, useState } from "react";
import { Siren, CheckCircle2, Circle, Clock, Plus, FileText, Loader2, Power, ListChecks, Newspaper } from "lucide-react";
import type { Article } from "../../data";
import { api } from "../../api";
import { studioUserId } from "../mobile/studio/studio";
import { timeAgoFa, faNum, jalaali } from "../mobile/utils/fa";
import {
  getCrisis, setCrisis, defaultProtocol, uid, getOperator,
  type CrisisState,
} from "./roomStore";
import { articleMs, tokensOf } from "./roomUtils";

// ── ۳.۸ حالت بحران (Crisis Mode) ──
// فعال‌سازی یک‌کلیکی، خط زمانی زندهٔ بحران، شمارندهٔ زمان سپری‌شده،
// چک‌لیست پروتکل پاسخ و گزارش پس از بحران.

type Props = {
  articles: Article[];
  onSelectArticle?: (a: Article) => void;
  onSendToNewspack?: (text: string) => void;
  onClose?: () => void;
  fullscreen?: boolean;
};

function elapsed(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n: number) => faNum(Number(String(n).padStart(2, "0")));
  return `${p(h)}:${p(m)}:${p(sec)}`;
}

export function CrisisMode({ articles, onSelectArticle, onSendToNewspack, onClose, fullscreen }: Props) {
  const [crisis, setCrisisState] = useState<CrisisState>(() => getCrisis());
  const [, force] = useState(0);
  const [newTopic, setNewTopic] = useState("");
  const [note, setNote] = useState("");
  const [report, setReport] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);

  function persist(next: CrisisState) { setCrisisState(next); setCrisis(next); }

  // شمارندهٔ زمان سپری‌شده
  useEffect(() => {
    if (!crisis.active) return;
    const t = setInterval(() => force(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [crisis.active]);

  function activate() {
    const topic = newTopic.trim();
    if (!topic) return;
    persist({
      active: true, topic, startedAt: Date.now(),
      protocol: defaultProtocol(),
      timeline: [{ id: uid("tl"), at: Date.now(), kind: "action", text: `حالت بحران برای موضوع «${topic}» فعال شد`, by: getOperator() || "سیستم" }],
    });
    setNewTopic("");
  }

  function deactivate() {
    persist({ ...crisis, active: false });
  }

  function toggleStep(id: string) {
    const protocol = crisis.protocol.map(s => s.id === id ? { ...s, done: !s.done, doneAt: !s.done ? Date.now() : undefined } : s);
    const changed = protocol.find(s => s.id === id)!;
    const timeline = [...crisis.timeline, { id: uid("tl"), at: Date.now(), kind: "action" as const, text: `${changed.done ? "انجام شد" : "بازگشایی"}: ${changed.label}`, by: getOperator() || "سیستم" }];
    persist({ ...crisis, protocol, timeline });
  }

  function addNote() {
    const t = note.trim(); if (!t) return;
    persist({ ...crisis, timeline: [...crisis.timeline, { id: uid("tl"), at: Date.now(), kind: "note", text: t, by: getOperator() || "کارشناس" }] });
    setNote("");
  }

  // اخبار مرتبط با موضوع بحران، برای خط زمانی زنده
  const crisisNews = useMemo(() => {
    if (!crisis.active || !crisis.topic) return [] as Article[];
    const terms = crisis.topic.toLowerCase().split(/\s+/).filter(Boolean);
    return articles
      .filter(a => articleMs(a) >= crisis.startedAt - 3600000)
      .filter(a => {
        const hay = `${a.title} ${a.preview || ""}`.toLowerCase();
        const toks = tokensOf(a);
        return terms.some(t => hay.includes(t) || toks.includes(t));
      })
      .sort((a, b) => articleMs(b) - articleMs(a))
      .slice(0, 30);
  }, [articles, crisis.active, crisis.topic, crisis.startedAt]);

  // ترکیب رویدادهای دستی و اخبار در یک خط زمانی
  const merged = useMemo(() => {
    const news = crisisNews.map(a => ({ id: `n:${a.id}`, at: articleMs(a), kind: "news" as const, text: a.title, source: a.source, by: undefined as string | undefined, article: a }));
    const events = crisis.timeline.map(e => ({ ...e, source: e.source, by: e.by, article: undefined as Article | undefined }));
    return [...news, ...events].sort((a, b) => b.at - a.at);
  }, [crisisNews, crisis.timeline]);

  async function makeReport() {
    setReporting(true);
    try {
      const done = crisis.protocol.filter(s => s.done).length;
      const content = [
        `موضوع بحران: ${crisis.topic}`,
        `شروع: ${jalaali(crisis.startedAt, { dateStyle: "full", timeStyle: "short" })}`,
        `مدت: ${elapsed(crisis.startedAt)}`,
        `اقدامات پروتکل: ${done} از ${crisis.protocol.length} انجام شد`,
        "خط زمانی:",
        ...merged.slice(0, 40).map(e => `• ${jalaali(e.at, { timeStyle: "short" })} — ${e.text}`),
      ].join("\n");
      const r = await api.aiAsk({
        title: `گزارش پس از بحران — ${crisis.topic}`,
        content,
        question: "یک گزارش پس از بحران حرفه‌ای بنویس: خلاصهٔ رویداد، خط زمانی کلیدی، اقدامات انجام‌شده، نقاط قوت و ضعف پاسخ، و درس‌آموخته‌ها.",
      }, studioUserId());
      setReport(r);
    } catch (e) {
      console.error("Post-crisis report failed in Media Monitoring Room:", e);
      setReport("تولید گزارش ناموفق بود. خط زمانی و چک‌لیست همچنان در دسترس است.");
    } finally { setReporting(false); }
  }

  // ── فعال‌سازی ──
  if (!crisis.active) {
    return (
      <div className="flex flex-col h-full min-h-0 items-center justify-center p-8 bg-white dark:bg-slate-900">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950/40 grid place-items-center">
            <Siren className="w-8 h-8 text-rose-500" />
          </div>
          <h3 className="text-lg">حالت بحران</h3>
          <p className="text-sm text-slate-500 leading-7">
            با فعال‌سازی، کل اتاق روی یک موضوع بحرانی متمرکز می‌شود: خط زمانی زنده، شمارندهٔ زمان،
            چک‌لیست پروتکل پاسخ و گزارش پس از بحران.
          </p>
          <div className="flex items-center gap-2">
            <input value={newTopic} onChange={e => setNewTopic(e.target.value)} onKeyDown={e => e.key === "Enter" && activate()}
              placeholder="موضوع بحران را وارد کنید…"
              className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
            <button onClick={activate} disabled={!newTopic.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50">
              <Siren className="w-4 h-4" /> فعال‌سازی
            </button>
          </div>
        </div>
      </div>
    );
  }

  const doneCount = crisis.protocol.filter(s => s.done).length;

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-slate-900">
      {/* نوار بحران */}
      <div className="shrink-0 bg-rose-600 text-white p-3 flex flex-wrap items-center gap-3">
        <Siren className="w-5 h-5 animate-pulse" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] opacity-90">حالت بحران فعال</div>
          <div className={`truncate ${fullscreen ? "text-2xl" : "text-base"}`}>{crisis.topic}</div>
        </div>
        <div className="text-center">
          <div className="text-[11px] opacity-90 flex items-center gap-1 justify-center"><Clock className="w-3 h-3" /> زمان سپری‌شده</div>
          <div className={`tabular-nums ${fullscreen ? "text-3xl" : "text-xl"}`}>{elapsed(crisis.startedAt)}</div>
        </div>
        <button onClick={deactivate} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-sm">
          <Power className="w-4 h-4" /> پایان بحران
        </button>
        {onClose && <button onClick={onClose} className="text-sm underline opacity-90">بازگشت</button>}
      </div>

      <div className={`flex-1 min-h-0 grid ${fullscreen ? "grid-cols-3" : "grid-cols-1 lg:grid-cols-3"} gap-0`}>
        {/* چک‌لیست پروتکل */}
        <div className="min-h-0 overflow-y-auto border-l border-slate-200 dark:border-slate-800 p-3">
          <div className="flex items-center gap-1.5 text-sm mb-2">
            <ListChecks className="w-4 h-4 text-rose-500" /> پروتکل پاسخ
            <span className="text-[11px] text-slate-400 mr-auto">{faNum(doneCount)}/{faNum(crisis.protocol.length)}</span>
          </div>
          <div className="space-y-1.5">
            {crisis.protocol.map(s => (
              <button key={s.id} onClick={() => toggleStep(s.id)}
                className={`w-full text-right flex items-start gap-2 p-2 rounded-lg border transition ${s.done ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900/50" : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"}`}>
                {s.done ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> : <Circle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />}
                <span className={`text-xs leading-6 ${s.done ? "line-through text-slate-400" : ""}`}>{s.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <button onClick={makeReport} disabled={reporting}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-sm hover:bg-slate-900 disabled:opacity-60">
              {reporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} گزارش پس از بحران
            </button>
            {report && onSendToNewspack && (
              <button onClick={() => onSendToNewspack(report)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700">
                <Newspaper className="w-4 h-4" /> ارسال گزارش به نیوزپک
              </button>
            )}
          </div>
          {report && (
            <div className="mt-3 text-xs leading-7 whitespace-pre-wrap rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-3">
              {report}
            </div>
          )}
        </div>

        {/* خط زمانی زنده */}
        <div className="min-h-0 overflow-y-auto border-l border-slate-200 dark:border-slate-800 p-3 lg:col-span-2">
          <div className="flex items-center gap-1.5 text-sm mb-2"><Clock className="w-4 h-4 text-rose-500" /> خط زمانی زنده</div>
          <div className="relative pr-4">
            <div className="absolute right-1.5 top-1 bottom-1 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="space-y-2">
              {merged.map(e => (
                <div key={e.id} className="relative">
                  <span className={`absolute -right-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${e.kind === "news" ? "bg-cyan-500" : e.kind === "action" ? "bg-rose-500" : "bg-amber-500"}`} />
                  <button onClick={() => e.article && onSelectArticle?.(e.article)}
                    className={`w-full text-right rounded-lg p-2 border ${e.kind === "news" ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-cyan-400" : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"} ${e.article ? "cursor-pointer" : "cursor-default"}`}>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-0.5">
                      {e.kind === "news" ? <Newspaper className="w-3 h-3" /> : e.kind === "action" ? <CheckCircle2 className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                      <span>{e.source || e.by || ""}</span>
                      <span className="mr-auto">{timeAgoFa(e.at)}</span>
                    </div>
                    <div className={`${fullscreen ? "text-base" : "text-xs"} leading-6`}>{e.text}</div>
                  </button>
                </div>
              ))}
              {merged.length === 0 && <div className="text-xs text-slate-400">هنوز رویدادی ثبت نشده.</div>}
            </div>
          </div>
        </div>
      </div>

      {/* ثبت یادداشت در خط زمانی */}
      {!fullscreen && (
        <div className="shrink-0 p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <Plus className="w-4 h-4 text-slate-400" />
          <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === "Enter" && addNote()}
            placeholder="ثبت اقدام یا یادداشت در خط زمانی بحران…"
            className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
          <button onClick={addNote} disabled={!note.trim()}
            className="px-3 py-2 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-700 disabled:opacity-50">ثبت</button>
        </div>
      )}
    </div>
  );
}
