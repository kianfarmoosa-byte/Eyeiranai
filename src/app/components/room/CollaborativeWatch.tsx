import { useEffect, useMemo, useState } from "react";
import { Users2, StickyNote, Tag, AtSign, LogOut, Sparkles, Loader2, Send, X } from "lucide-react";
import type { Article } from "../../data";
import { api } from "../../api";
import { studioUserId } from "../mobile/studio/studio";
import { timeAgoFa, faNum, jalaali } from "../mobile/utils/fa";
import {
  setOperator, getNotes, setNotes, getShifts, setShifts,
  getAlerts, type TeamNote, type ShiftHandoff, uid,
} from "./roomStore";

// ── ۳.۵ همکاری هم‌زمان تیمی (Collaborative Watch) ──
// حضور، یادداشت/برچسب مشترک روی اخبار، منشن، و تحویل شیفت با خلاصهٔ AI.

type Props = {
  articles: Article[];
  operator: string;
  onOperatorChange: (name: string) => void;
  onSelectArticle?: (a: Article) => void;
  big?: boolean;
};

const PRESENCE_KEY = "room.presence";
const PRESENCE_TTL = 20000;

type Presence = { name: string; at: number };

const NOTE_LABELS = ["مهم برای جلسه", "نیازمند پیگیری", "تأییدشده", "مشکوک"];

export function CollaborativeWatch({ articles, operator, onOperatorChange, onSelectArticle, big }: Props) {
  const [notes, setNotesState] = useState<TeamNote[]>(() => getNotes());
  const [shifts, setShiftsState] = useState<ShiftHandoff[]>(() => getShifts());
  const [presence, setPresence] = useState<Presence[]>([]);
  const [text, setText] = useState("");
  const [label, setLabel] = useState<string>("");
  const [targetId] = useState<string>("");
  const [summarizing, setSummarizing] = useState(false);
  const [nameEdit, setNameEdit] = useState(!operator);

  // حضور: با ثبت دوره‌ای در localStorage و شنود رویداد storage شبیه‌سازی می‌شود
  useEffect(() => {
    if (!operator) return;
    const me = () => {
      try {
        const raw = localStorage.getItem(PRESENCE_KEY);
        const list: Presence[] = raw ? JSON.parse(raw) : [];
        const others = list.filter(p => p.name !== operator && Date.now() - p.at < PRESENCE_TTL);
        const next = [...others, { name: operator, at: Date.now() }];
        localStorage.setItem(PRESENCE_KEY, JSON.stringify(next));
        setPresence(next.filter(p => Date.now() - p.at < PRESENCE_TTL));
      } catch { /* ignore */ }
    };
    me();
    const t = setInterval(me, 5000);
    const onStorage = () => {
      try {
        const raw = localStorage.getItem(PRESENCE_KEY);
        const list: Presence[] = raw ? JSON.parse(raw) : [];
        setPresence(list.filter(p => Date.now() - p.at < PRESENCE_TTL));
      } catch { /* ignore */ }
    };
    window.addEventListener("storage", onStorage);
    return () => { clearInterval(t); window.removeEventListener("storage", onStorage); };
  }, [operator]);

  const articleById = useMemo(() => {
    const m = new Map<string, Article>();
    for (const a of articles) m.set(a.id, a);
    return m;
  }, [articles]);

  const mentions = useMemo(() => {
    if (!operator) return [] as TeamNote[];
    return notes.filter(n => n.text.includes(`@${operator}`)).slice(-10).reverse();
  }, [notes, operator]);

  function addNote() {
    const t = text.trim();
    if (!t || !operator) return;
    const note: TeamNote = { id: uid("note"), articleId: targetId, by: operator, text: t, label: label || undefined, at: Date.now() };
    const next = [...notes, note];
    setNotesState(next); setNotes(next); setText(""); setLabel("");
  }
  function removeNote(id: string) {
    const next = notes.filter(n => n.id !== id);
    setNotesState(next); setNotes(next);
  }

  async function handoff() {
    if (!operator) return;
    setSummarizing(true);
    const lastShiftAt = shifts.length ? shifts[shifts.length - 1].endedAt : Date.now() - 8 * 3600000;
    const shiftNotes = notes.filter(n => n.at >= lastShiftAt);
    const shiftAlerts = getAlerts().filter(a => a.createdAt >= lastShiftAt);
    let summary = "";
    try {
      const content = [
        `یادداشت‌های شیفت (${shiftNotes.length}):`,
        ...shiftNotes.map(n => `• ${n.by}: ${n.text}`),
        `هشدارهای شیفت (${shiftAlerts.length}):`,
        ...shiftAlerts.slice(0, 20).map(a => `• [${a.severity}] ${a.title} — وضعیت: ${a.status}`),
      ].join("\n");
      summary = await api.aiAsk({
        title: "تحویل شیفت اتاق رصد",
        content,
        question: "یک خلاصهٔ تحویل شیفت کوتاه و عملیاتی برای اپراتور بعدی بنویس: مهم‌ترین رویدادها، موارد باز و اولویت‌های پیگیری.",
      }, studioUserId());
    } catch (e) {
      console.error("Shift handoff summary failed in Media Monitoring Room:", e);
      summary = `خلاصهٔ خودکار در دسترس نبود. ${shiftNotes.length} یادداشت و ${shiftAlerts.length} هشدار در این شیفت ثبت شد.`;
    }
    const rec: ShiftHandoff = {
      id: uid("shift"), operator, startedAt: lastShiftAt, endedAt: Date.now(),
      summary, alertCount: shiftAlerts.length, createdAt: Date.now(),
    };
    const next = [...shifts, rec];
    setShiftsState(next); setShifts(next); setSummarizing(false);
  }

  const recentNotes = useMemo(() => [...notes].slice(-40).reverse(), [notes]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-slate-900">
      <div className="flex items-center gap-2 p-3 border-b border-slate-200 dark:border-slate-800 shrink-0 flex-wrap">
        <Users2 className="w-4 h-4 text-teal-500" />
        <h3 className={big ? "text-lg" : "text-sm"}>همکاری تیمی</h3>
        {/* حاضران */}
        <div className="flex items-center gap-1 mr-auto">
          {presence.map(p => (
            <span key={p.name} title={p.name}
              className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 grid place-items-center text-xs border-2 border-white dark:border-slate-900 -mr-2">
              {p.name.slice(0, 2)}
            </span>
          ))}
          <span className="text-[11px] text-slate-400 pr-3">{faNum(presence.length)} آنلاین</span>
        </div>
      </div>

      {/* نام کارشناس */}
      {nameEdit ? (
        <div className="shrink-0 p-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <span className="text-xs text-slate-500">نام شما:</span>
          <input defaultValue={operator} id="op-name"
            onKeyDown={e => { if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value.trim(); if (v) { setOperator(v); onOperatorChange(v); setNameEdit(false); } } }}
            placeholder="مثلاً رضایی"
            className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500" />
          <button onClick={() => { const el = document.getElementById("op-name") as HTMLInputElement; const v = el?.value.trim(); if (v) { setOperator(v); onOperatorChange(v); setNameEdit(false); } }}
            className="px-3 py-1.5 rounded-lg text-xs bg-teal-600 text-white hover:bg-teal-700">ثبت</button>
        </div>
      ) : (
        <div className="shrink-0 px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 flex items-center gap-2">
          کارشناس: <b className="text-slate-700 dark:text-slate-200">{operator}</b>
          <button onClick={() => setNameEdit(true)} className="text-teal-600 hover:underline">تغییر</button>
          <button onClick={handoff} disabled={summarizing}
            className="mr-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700">
            {summarizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />} تحویل شیفت
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
        {/* منشن‌ها */}
        {mentions.length > 0 && (
          <div>
            <div className="text-[11px] text-slate-500 mb-1.5 flex items-center gap-1"><AtSign className="w-3 h-3" /> اشاره‌ها به شما</div>
            <div className="space-y-1.5">
              {mentions.map(n => (
                <div key={n.id} className="text-xs rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40 p-2">
                  <b>{n.by}</b>: {n.text} <span className="text-slate-400">· {timeAgoFa(n.at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* یادداشت‌های تیمی */}
        <div>
          <div className="text-[11px] text-slate-500 mb-1.5 flex items-center gap-1"><StickyNote className="w-3 h-3" /> یادداشت‌ها و برچسب‌های مشترک</div>
          <div className="space-y-1.5">
            {recentNotes.length === 0 && <div className="text-xs text-slate-400">هنوز یادداشتی ثبت نشده.</div>}
            {recentNotes.map(n => {
              const a = n.articleId ? articleById.get(n.articleId) : undefined;
              return (
                <div key={n.id} className="group text-xs rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-2">
                  <div className="flex items-center gap-1.5 mb-0.5 text-slate-500">
                    <span className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 grid place-items-center text-[9px]">{n.by.slice(0, 2)}</span>
                    <b className="text-slate-700 dark:text-slate-200">{n.by}</b>
                    {n.label && <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 inline-flex items-center gap-0.5"><Tag className="w-2.5 h-2.5" />{n.label}</span>}
                    <span className="mr-auto">{timeAgoFa(n.at)}</span>
                    <button onClick={() => removeNote(n.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500"><X className="w-3 h-3" /></button>
                  </div>
                  <div className="leading-6">{n.text}</div>
                  {a && (
                    <button onClick={() => onSelectArticle?.(a)} className="mt-1 text-teal-600 hover:underline line-clamp-1 text-right w-full">↳ {a.title}</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* تاریخچهٔ شیفت‌ها */}
        {shifts.length > 0 && (
          <div>
            <div className="text-[11px] text-slate-500 mb-1.5 flex items-center gap-1"><Sparkles className="w-3 h-3" /> خلاصهٔ تحویل شیفت‌ها</div>
            <div className="space-y-1.5">
              {[...shifts].reverse().slice(0, 6).map(s => (
                <div key={s.id} className="text-xs rounded-lg bg-violet-50/50 dark:bg-violet-950/10 border border-violet-200 dark:border-violet-900/40 p-2">
                  <div className="text-slate-500 mb-1">
                    {s.operator} · {jalaali(s.endedAt, { dateStyle: "medium", timeStyle: "short" })} · {faNum(s.alertCount)} هشدار
                  </div>
                  <div className="leading-6 whitespace-pre-wrap">{s.summary}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ورودی یادداشت */}
      <div className="shrink-0 p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex flex-wrap gap-1">
          {NOTE_LABELS.map(l => (
            <button key={l} onClick={() => setLabel(label === l ? "" : l)}
              className={`text-[11px] px-2 py-0.5 rounded-full border ${label === l ? "bg-amber-500 text-white border-amber-500" : "border-slate-300 dark:border-slate-700 text-slate-500"}`}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && addNote()}
            placeholder={operator ? "یادداشت تیمی… (با @نام اشاره کنید)" : "ابتدا نام خود را ثبت کنید"}
            disabled={!operator}
            className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50" />
          <button onClick={addNote} disabled={!operator || !text.trim()}
            className="p-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"><Send className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}
