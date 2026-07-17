import { useMemo, useRef, useState } from "react";
import { Sparkles, Send, Loader2, Clock, Copy, PackagePlus, MessageCircle } from "lucide-react";
import type { Article } from "../../data";
import { api } from "../../api";
import { studioUserId } from "../mobile/studio/studio";
import { scoreArticle, sentimentLabelFa } from "../../sentiment";
import { faNum, jalaali } from "../mobile/utils/fa";
import { articleMs, detectWaves } from "./roomUtils";

// ── ۳.۷ خلاصه‌ساز موقعیت با AI (Situation Brief) ──
// «وضعیت اکنون چیست؟»، بریف‌های زمان‌بندی‌شده، پرسش‌وپاسخ آزاد و ارسال یک‌کلیکی
// به نیوزپک برای ساخت بستهٔ خبری.

type Brief = { bigPicture: string; keyPoints: string[]; action: string; mood: "positive" | "negative" | "neutral"; generatedAt: number };
type QA = { role: "user" | "ai"; text: string };

type Props = {
  articles: Article[];
  onSendToNewspack?: (text: string) => void;
  big?: boolean;
};

export function SituationBrief({ articles, onSendToNewspack, big }: Props) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [qa, setQa] = useState<QA[]>([]);
  const [asking, setAsking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // پنجرهٔ اخیر برای بریف موقعیت
  const recent = useMemo(() => {
    const since = Date.now() - 12 * 3600000;
    return articles.filter(a => articleMs(a) >= since).sort((a, b) => articleMs(b) - articleMs(a));
  }, [articles]);

  const context = useMemo(() => recent.slice(0, 60), [recent]);

  async function generate() {
    setLoading(true); setErr(null);
    try {
      const headlines = context.slice(0, 40).map(a => ({
        title: a.title, source: a.source, sentiment: sentimentLabelFa(scoreArticle(a).label),
      }));
      const waves = detectWaves(articles).slice(0, 5).map(w => w.term);
      const d = await api.aiDigest({
        headlines,
        stats: { واحد: recent.length, موج‌های_فعال: waves },
        period: 0,
      }, studioUserId());
      setBrief(d);
    } catch (e) {
      console.error("Situation brief generation failed in Media Monitoring Room:", e);
      setErr("تولید بریف موقعیت ناموفق بود. اتصال یا سرویس هوش مصنوعی را بررسی کنید.");
    } finally { setLoading(false); }
  }

  async function ask() {
    const question = q.trim();
    if (!question || asking) return;
    setQ(""); setQa(prev => [...prev, { role: "user", text: question }]); setAsking(true);
    try {
      const content = context.slice(0, 50)
        .map(a => `• [${a.source}] ${a.title}`).join("\n");
      const answer = await api.aiAsk({
        title: "وضعیت جاری اتاق رصد رسانه‌ای",
        content,
        question,
        history: qa.map(m => ({ role: m.role === "ai" ? "assistant" : "user", text: m.text })),
      }, studioUserId());
      setQa(prev => [...prev, { role: "ai", text: answer }]);
    } catch (e) {
      console.error("Situation Q&A failed in Media Monitoring Room:", e);
      setQa(prev => [...prev, { role: "ai", text: "پاسخ‌گویی ناموفق بود. دوباره تلاش کنید." }]);
    } finally {
      setAsking(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
    }
  }

  const briefText = brief
    ? `وضعیت اکنون — ${jalaali(brief.generatedAt, { dateStyle: "medium", timeStyle: "short" })}\n\n${brief.bigPicture}\n\nنکات کلیدی:\n${brief.keyPoints.map((p, i) => `${faNum(i + 1)}. ${p}`).join("\n")}\n\nتوصیه: ${brief.action}`
    : "";

  const moodChip = brief && (
    <span className={`text-[11px] px-2 py-0.5 rounded-full ${
      brief.mood === "positive" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : brief.mood === "negative" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
      فضای کلی: {sentimentLabelFa(brief.mood)}
    </span>
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-slate-900">
      <div className="flex items-center gap-2 p-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <Sparkles className="w-4 h-4 text-violet-500" />
        <h3 className={big ? "text-lg" : "text-sm"}>خلاصه‌ساز موقعیت</h3>
        <span className="text-[11px] text-slate-400">{faNum(recent.length)} خبر در ۱۲ ساعت اخیر</span>
        <button onClick={generate} disabled={loading}
          className="mr-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          وضعیت اکنون چیست؟
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {err && <div className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-lg p-2">{err}</div>}

        {brief && (
          <div className="rounded-xl border border-violet-200 dark:border-violet-900/40 bg-violet-50/40 dark:bg-violet-950/10 p-3">
            <div className="flex items-center gap-2 mb-2">
              {moodChip}
              <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                <Clock className="w-3 h-3" /> {jalaali(brief.generatedAt, { dateStyle: "medium", timeStyle: "short" })}
              </span>
              <div className="mr-auto flex gap-1">
                <button onClick={() => navigator.clipboard?.writeText(briefText)} title="کپی"
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700"><Copy className="w-3.5 h-3.5" /></button>
                {onSendToNewspack && (
                  <button onClick={() => onSendToNewspack(briefText)} title="ارسال به نیوزپک"
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] bg-emerald-600 text-white hover:bg-emerald-700">
                    <PackagePlus className="w-3.5 h-3.5" /> ساخت بسته
                  </button>
                )}
              </div>
            </div>
            <p className={`${big ? "text-base leading-8" : "text-sm leading-7"} text-slate-800 dark:text-slate-100`}>{brief.bigPicture}</p>
            <ul className="mt-2 space-y-1">
              {brief.keyPoints.map((p, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-violet-500 tabular-nums shrink-0">{faNum(i + 1)}.</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 text-sm rounded-lg bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700">
              🎯 {brief.action}
            </div>
          </div>
        )}

        {!brief && !loading && !err && (
          <div className="p-6 text-center text-xs text-slate-400">
            <Sparkles className="w-6 h-6 mx-auto mb-2 text-slate-300" />
            برای دریافت تصویر لحظه‌ای از فضای رسانه، «وضعیت اکنون چیست؟» را بزنید.
          </div>
        )}

        {/* پرسش‌وپاسخ */}
        {qa.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-7 ${
              m.role === "user"
                ? "bg-slate-100 dark:bg-slate-800"
                : "bg-violet-100 dark:bg-violet-950/30 text-slate-800 dark:text-slate-100"}`}>
              {m.text}
            </div>
          </div>
        ))}
        {asking && <div className="flex justify-end"><Loader2 className="w-4 h-4 animate-spin text-violet-500" /></div>}
      </div>

      {/* ورودی پرسش آزاد */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-slate-400 shrink-0" />
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && ask()}
            placeholder="پرسش آزاد دربارهٔ وضعیت جاری…"
            className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          <button onClick={ask} disabled={asking || !q.trim()}
            className="p-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
