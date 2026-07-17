import { useState } from "react";
import { Sparkles, RefreshCw, Copy, Check, TrendingUp, Target, Newspaper } from "lucide-react";
import type { Article } from "../../data";
import { splitByPeriod, computeKpis, topicHeatmap, type Period } from "../../mediaAnalytics";
import { scoreArticle, sentimentLabelFa } from "../../sentiment";
import { api } from "../../api";
import { studioUserId } from "../mobile/studio/studio";
import { faNum } from "../mobile/utils/fa";

// ── Section ۳.۱۰ — خلاصهٔ روزانهٔ هوش مصنوعی («امروز چه گذشت») ──
// یک پاراگراف تصویر کلی → سه نکتهٔ کلیدی → یک توصیهٔ عملی. با هوش مصنوعی پلتفرم
// تولید می‌شود و قابل کپی/اشتراک است.

type Digest = { bigPicture: string; keyPoints: string[]; action: string; mood: "positive" | "negative" | "neutral"; generatedAt: number };

const MOOD: Record<Digest["mood"], { label: string; cls: string }> = {
  positive: { label: "مثبت", cls: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900" },
  negative: { label: "منفی", cls: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900" },
  neutral:  { label: "خنثی", cls: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700" },
};

export function DailyDigest({ articles, period }: { articles: Article[]; period: Period }) {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true); setError("");
    try {
      const { current } = splitByPeriod(articles, period);
      if (current.length === 0) { setError("مطلبی در این بازه برای خلاصه‌سازی وجود ندارد."); setLoading(false); return; }
      const headlines = current.slice(0, 60).map(a => {
        const s = scoreArticle(a);
        return { title: a.title, source: a.source, sentiment: sentimentLabelFa(s.label) };
      });
      const kpis = computeKpis(articles, period);
      const heat = topicHeatmap(articles, period);
      const stats = {
        volume: kpis.volume.value,
        sources: kpis.sources.value,
        netSentiment: kpis.netSentiment.value,
        topTopics: heat.topics.slice(0, 5).join("، "),
      };
      const d = await api.aiDigest({ headlines, stats, period }, studioUserId());
      setDigest(d);
    } catch (e) {
      console.log("DailyDigest generate error:", e);
      setError(`تولید خلاصه ناموفق بود: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const asText = (d: Digest) =>
    `📰 امروز چه گذشت — خلاصهٔ ${faNum(period)} روز اخیر\n\n${d.bigPicture}\n\nنکات کلیدی:\n${d.keyPoints.map((p, i) => `${faNum(i + 1)}. ${p}`).join("\n")}\n\n🎯 توصیه: ${d.action}`;

  const copy = async () => {
    if (!digest) return;
    try { await navigator.clipboard.writeText(asText(digest)); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-900">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm">امروز چه گذشت — خلاصهٔ هوشمند</h3>
        {digest && <span className={`text-[11px] px-2 py-0.5 rounded-full border ${MOOD[digest.mood].cls}`}>فضای کلی: {MOOD[digest.mood].label}</span>}
        <div className="flex-1" />
        {digest && (
          <button onClick={copy} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
            {copied ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> کپی شد</> : <><Copy className="w-3.5 h-3.5" /> کپی</>}
          </button>
        )}
        <button
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {digest ? "بازتولید" : "تولید خلاصه"}
        </button>
      </div>

      {error && <div className="text-xs text-rose-600 dark:text-rose-400 mb-2">{error}</div>}

      {!digest && !loading && !error && (
        <div className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
          برای دریافت خلاصهٔ مدیریتی «امروز چه گذشت» روی «تولید خلاصه» بزنید. هوش مصنوعی پلتفرم تیترها و آمار دورهٔ انتخابی را تحلیل می‌کند.
        </div>
      )}

      {loading && !digest && (
        <div className="space-y-2 animate-pulse py-2">
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-full" />
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-11/12" />
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-4/5" />
        </div>
      )}

      {digest && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Newspaper className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-sm leading-7 text-slate-700 dark:text-slate-200">{digest.bigPicture}</p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-2"><TrendingUp className="w-3.5 h-3.5" /> نکات کلیدی</div>
            <ul className="space-y-1.5">
              {digest.keyPoints.map((p, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[11px] flex items-center justify-center shrink-0 tabular-nums">{faNum(i + 1)}</span>
                  <span className="leading-6">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
            <Target className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm leading-6 text-amber-800 dark:text-amber-200"><span className="font-semibold">توصیهٔ عملی: </span>{digest.action}</p>
          </div>

          <div className="text-[10px] text-slate-400">تولیدشده با هوش مصنوعی پلتفرم بر پایهٔ {faNum(period)} روز اخیر — ممکن است نیازمند بازبینی انسانی باشد.</div>
        </div>
      )}
    </div>
  );
}
