import { useState } from "react";
import {
  Gauge, Flame, Hash, Network, Radio, Languages, PieChart, GitBranch, Users, Clock,
  ExternalLink, ArrowUpRight, ShieldAlert, Loader2, Check, FileText, TrendingUp,
  Eye, ThumbsUp, MessageCircle, Globe,
} from "lucide-react";
import { toFa, faNum } from "../mobile/utils/fa";
import { api, type WatchTopic } from "../../api";
import { studioUserId, DEFAULT_BRAND } from "../mobile/studio/studio";
import { GdeltGeoMap } from "../GdeltGeoMap";
import type { SocialInsights } from "./socialAnalysis";

function Section({ icon: Icon, title, subtitle, children }: { icon: any; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/70 flex items-center gap-2">
        <Icon className="w-4 h-4 text-cyan-500" />
        <span className="text-[13px] font-semibold">{title}</span>
        {subtitle && <span className="text-[11px] text-slate-400">· {subtitle}</span>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-[12px] text-slate-400 text-center py-6">{text}</div>;
}

// ─────────── crisis banner ───────────
export function CrisisBanner({ insights }: { insights: SocialInsights }) {
  const c = insights.crisis;
  if (!c.isCrisis) return null;
  return (
    <div className="rounded-2xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-4">
      <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
        <ShieldAlert className="w-5 h-5" />
        <span className="font-semibold text-[14px]">هشدار بحران شهرت</span>
      </div>
      <p className="text-[12.5px] text-rose-700/90 dark:text-rose-200/90 mt-1.5 leading-relaxed">
        سهم پست‌های منفی در بازهٔ اخیر به {toFa(c.negNow)}٪ رسیده
        {c.negBase > 0 && <> (پایه: {toFa(c.negBase)}٪)</>}
        {c.ratio > 0 && <> — حدود {toFa(c.ratio)}× بیشتر از حالت عادی</>}.
      </p>
      {c.sample && (
        <a href={c.sample.link || undefined} target="_blank" rel="noopener noreferrer"
          className="mt-2 block text-[12px] leading-relaxed line-clamp-2 rounded-lg bg-white/60 dark:bg-slate-900/40 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-900">
          {c.sample.text}
          {c.sample.link && <ExternalLink className="inline w-3 h-3 mr-1 align-text-bottom" />}
        </a>
      )}
    </div>
  );
}

// ─────────── sentiment over time ───────────
export function SentimentTimelinePanel({ insights }: { insights: SocialInsights }) {
  const series = insights.sentimentSeries;
  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <CrisisBanner insights={insights} />
      <Section icon={TrendingUp} title="احساسات در طول زمان" subtitle={`${toFa(series.length)} بازه`}>
        {series.length < 2 ? <Empty text="داده کافی برای رسم روند نیست." /> : (
          <div className="space-y-3">
            <div className="flex items-end gap-1 h-40">
              {series.map((b, i) => {
                const total = b.total || 1;
                return (
                  <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1 group relative">
                    <div className="w-full flex flex-col-reverse rounded-t overflow-hidden" style={{ height: "100%" }}>
                      <div className="bg-emerald-500" style={{ height: `${(b.pos / total) * 100}%` }} />
                      <div className="bg-slate-300 dark:bg-slate-600" style={{ height: `${(b.neu / total) * 100}%` }} />
                      <div className="bg-rose-500" style={{ height: `${(b.neg / total) * 100}%` }} />
                    </div>
                    <div className="absolute -top-7 hidden group-hover:block text-[10px] bg-slate-900 text-white rounded px-1.5 py-0.5 whitespace-nowrap z-10">
                      {b.label} · {toFa(b.total)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>{series[0]?.label}</span>
              <span>{series[series.length - 1]?.label}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-emerald-500 inline-block" /> مثبت</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-slate-300 dark:bg-slate-600 inline-block" /> خنثی</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-rose-500 inline-block" /> منفی</span>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

// ─────────── co-occurrence graph ───────────
export function CoOccurrenceGraph({ nodes, edges }: { nodes: string[]; edges: { a: string; b: string; count: number }[] }) {
  if (nodes.length < 2) return <Empty text="هم‌رخدادی معناداری بین کلیدواژه‌ها یافت نشد." />;
  const size = 300, cx = size / 2, cy = size / 2, r = size / 2 - 40;
  const pos = new Map<string, { x: number; y: number }>();
  nodes.forEach((n, i) => {
    const ang = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    pos.set(n, { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  });
  const maxE = Math.max(...edges.map((e) => e.count), 1);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-sm mx-auto">
      {edges.map((e, i) => {
        const a = pos.get(e.a), b = pos.get(e.b);
        if (!a || !b) return null;
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor"
          className="text-cyan-400" strokeOpacity={0.25 + (e.count / maxE) * 0.5} strokeWidth={0.5 + (e.count / maxE) * 3} />;
      })}
      {nodes.map((n) => {
        const p = pos.get(n)!;
        return (
          <g key={n}>
            <circle cx={p.x} cy={p.y} r={4} className="fill-cyan-500" />
            <text x={p.x} y={p.y - 7} textAnchor="middle" className="fill-slate-600 dark:fill-slate-300" style={{ fontSize: 9 }}>{n}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─────────── digest button ───────────
export function DigestButton({ insights, onOpenStudio, topicLabel }: { insights: SocialInsights; onOpenStudio?: () => void; topicLabel: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const make = async () => {
    setState("loading");
    try {
      const uid = studioUserId();
      const brand = (await api.studioGetBrand(uid)) || DEFAULT_BRAND;
      // Build digest sources from the strongest signals we detected.
      const sources: { title: string; content: string; source?: string; link?: string }[] = [];
      for (const v of insights.velocity.slice(0, 3)) {
        sources.push({ title: `ترند: ${v.term}`, content: `«${v.term}» با ${v.recent} اشاره در گفتگوهای «${topicLabel}» رو به رشد است.`, source: topicLabel });
      }
      for (const n of insights.narratives.slice(0, 2)) {
        sources.push({ title: n.phrase, content: n.sample || n.phrase, source: topicLabel, link: n.sampleLink });
      }
      if (!sources.length) {
        for (const p of insights.scored.slice(0, 3)) {
          sources.push({ title: p.post.title || p.post.text.slice(0, 60), content: p.post.text, source: p.post.source, link: p.post.link });
        }
      }
      const outputs = await api.studioComposeDigest({ brand, template: {}, sources, platforms: ["telegram"] });
      await api.studioSaveDraft(uid, {
        title: `چکیدهٔ رصد «${topicLabel}»`.slice(0, 80),
        sourceTitle: `چکیدهٔ رصد اجتماعی «${topicLabel}»`,
        sourceLink: "",
        outputs,
        status: "draft",
      });
      setState("done");
    } catch (e) {
      console.log("social digest failed:", e);
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] rounded-full px-3 py-1.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <Check className="w-3.5 h-3.5" /> چکیده ساخته شد
        </span>
        {onOpenStudio && (
          <button onClick={onOpenStudio} className="inline-flex items-center gap-1.5 text-[12px] rounded-full px-3 py-1.5 bg-violet-500 hover:bg-violet-600 text-white">
            <FileText className="w-3.5 h-3.5" /> باز کردن استودیو
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button onClick={make} disabled={state === "loading"}
        className="inline-flex items-center gap-1.5 text-[12px] rounded-full px-3 py-1.5 bg-violet-500 hover:bg-violet-600 disabled:opacity-70 text-white">
        {state === "loading" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
        {state === "loading" ? "در حال ساخت چکیده…" : "ساخت چکیدهٔ رصد"}
      </button>
      {state === "error" && <span className="text-[11px] text-rose-500">ساخت چکیده ناموفق بود</span>}
    </div>
  );
}

// ─────────── trends (velocity + hashtags + co-occurrence + narratives + cloud) ───────────
export function TrendsPanel({ insights, onOpenStudio, topicLabel }: { insights: SocialInsights; onOpenStudio?: () => void; topicLabel: string }) {
  const { velocity, hashtags, narratives, cooccur, coNodes, keywords, maxKw } = insights;
  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-slate-400">ترندیابی زندهٔ گفتگوها</span>
        <DigestButton insights={insights} onOpenStudio={onOpenStudio} topicLabel={topicLabel} />
      </div>

      <Section icon={Flame} title="رتبه‌بندی زندهٔ ترندها" subtitle="بر پایهٔ سرعت رشد">
        {velocity.length === 0 ? <Empty text="ترند رو به رشدی شناسایی نشد." /> : (
          <div className="space-y-1.5">
            {velocity.map((v, i) => (
              <div key={v.term} className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 w-5 tabular-nums">{toFa(i + 1)}</span>
                <span className="text-[13px] flex-1 truncate">{v.term}</span>
                <span className="inline-flex items-center gap-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <ArrowUpRight className="w-3 h-3" /> +{toFa(v.vel)}
                </span>
                <span className="text-[11px] text-slate-400 tabular-nums">{toFa(v.recent)} اشاره</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={Hash} title="پایش هشتگ‌ها" subtitle="رشد نسبت به بازهٔ قبل">
        {hashtags.length === 0 ? <Empty text="هشتگی در پست‌ها یافت نشد." /> : (
          <div className="flex flex-wrap gap-2">
            {hashtags.map((h) => {
              const growing = h.recent > h.older;
              return (
                <span key={h.tag} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1 text-[12px]">
                  <span className="text-cyan-600 dark:text-cyan-400">{h.tag}</span>
                  <span className="text-slate-400 tabular-nums">{toFa(h.count)}</span>
                  {growing && <ArrowUpRight className="w-3 h-3 text-emerald-500" />}
                </span>
              );
            })}
          </div>
        )}
      </Section>

      <Section icon={Network} title="گراف هم‌رخدادی کلیدواژه‌ها">
        <CoOccurrenceGraph nodes={coNodes} edges={cooccur} />
      </Section>

      <Section icon={Radio} title="روایت‌کاوی" subtitle="عبارت‌های پرتکرار">
        {narratives.length === 0 ? <Empty text="روایت پرتکراری استخراج نشد." /> : (
          <div className="space-y-2">
            {narratives.map((n) => (
              <div key={n.phrase} className="flex items-start gap-2">
                <span className="text-[11px] rounded-full bg-cyan-100 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 tabular-nums shrink-0">{toFa(n.count)}×</span>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium">{n.phrase}</div>
                  {n.sample && <div className="text-[11px] text-slate-400 line-clamp-1">{n.sample}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={Hash} title="ابر کلیدواژه‌ها">
        {keywords.length === 0 ? <Empty text="کلیدواژهٔ پرتکراری یافت نشد." /> : (
          <div className="flex flex-wrap gap-2 content-start">
            {keywords.map(([w, n]) => {
              const scale = 0.8 + (n / maxKw) * 1.1;
              return (
                <span key={w} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1" style={{ fontSize: `${scale}rem` }}>
                  <span className="text-slate-700 dark:text-slate-200">{w}</span>
                  <span className="text-[11px] text-cyan-600 dark:text-cyan-400 tabular-nums">{toFa(n)}</span>
                </span>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

// ─────────── reach (platforms + engagement + languages + share of voice) ───────────
export function ReachPanel({ insights }: { insights: SocialInsights }) {
  const { platforms, languages, sov, engagement } = insights;
  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <Section icon={PieChart} title="سهم صدا (Share of Voice)" subtitle="بر پایهٔ منابع">
        {sov.length === 0 ? <Empty text="منبعی برای محاسبه نیست." /> : (
          <div className="space-y-2">
            {sov.map((s) => (
              <div key={s.name} className="flex items-center gap-2">
                <span className="shrink-0">{s.icon}</span>
                <span className="text-[12px] w-32 truncate">{s.name}</span>
                <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-cyan-500" style={{ width: `${s.pct}%` }} />
                </div>
                <span className="text-[11px] text-slate-400 w-16 text-left tabular-nums">{toFa(s.count)} · {toFa(s.pct)}٪</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={Radio} title="تفکیک بر پایهٔ پلتفرم" subtitle="با احساسات هر پلتفرم">
        {platforms.length === 0 ? <Empty text="داده‌ای نیست." /> : (
          <div className="space-y-2.5">
            {platforms.map((p) => (
              <div key={p.kind}>
                <div className="flex items-center gap-2 text-[12px] mb-1">
                  <span>{p.icon}</span><span className="flex-1">{p.label}</span>
                  <span className="text-slate-400 tabular-nums">{toFa(p.count)} · {toFa(p.pct)}٪</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                  <div className="bg-emerald-500 h-full" style={{ width: `${(p.pos / p.count) * 100}%` }} />
                  <div className="bg-slate-400 h-full" style={{ width: `${(p.neu / p.count) * 100}%` }} />
                  <div className="bg-rose-500 h-full" style={{ width: `${(p.neg / p.count) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {engagement.has && (
        <Section icon={ThumbsUp} title="سنجه‌های تعامل" subtitle={`${toFa(engagement.counted)} پست دارای داده`}>
          <div className="grid grid-cols-3 gap-3 text-center mb-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 py-2.5">
              <div className="flex items-center justify-center gap-1 text-cyan-600 dark:text-cyan-400"><Eye className="w-3.5 h-3.5" /><span className="text-lg font-bold">{faNum(engagement.views)}</span></div>
              <div className="text-[11px] text-slate-400">بازدید</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 py-2.5">
              <div className="flex items-center justify-center gap-1 text-rose-500"><ThumbsUp className="w-3.5 h-3.5" /><span className="text-lg font-bold">{faNum(engagement.likes)}</span></div>
              <div className="text-[11px] text-slate-400">پسند</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 py-2.5">
              <div className="flex items-center justify-center gap-1 text-amber-500"><MessageCircle className="w-3.5 h-3.5" /><span className="text-lg font-bold">{faNum(engagement.comments)}</span></div>
              <div className="text-[11px] text-slate-400">دیدگاه</div>
            </div>
          </div>
          <div className="space-y-1.5">
            {engagement.top.map((t) => (
              <a key={t.post.id} href={t.post.link || undefined} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-[12px] rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <span className="flex-1 truncate">{t.post.title || t.post.text.slice(0, 50)}</span>
                {t.views > 0 && <span className="text-slate-400 shrink-0 flex items-center gap-0.5"><Eye className="w-3 h-3" />{faNum(t.views)}</span>}
                {t.likes > 0 && <span className="text-slate-400 shrink-0 flex items-center gap-0.5"><ThumbsUp className="w-3 h-3" />{faNum(t.likes)}</span>}
              </a>
            ))}
          </div>
        </Section>
      )}

      <Section icon={Languages} title="تفکیک زبانی">
        {languages.length === 0 ? <Empty text="داده‌ای نیست." /> : (
          <div className="space-y-2">
            {languages.map((l) => (
              <div key={l.lang} className="flex items-center gap-2">
                <span className="text-[12px] w-16">{l.label}</span>
                <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-violet-500" style={{ width: `${l.pct}%` }} />
                </div>
                <span className="text-[11px] text-slate-400 w-16 text-left tabular-nums">{toFa(l.count)} · {toFa(l.pct)}٪</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ─────────── campaign (coordinated + diffusion) ───────────
export function CampaignPanel({ insights }: { insights: SocialInsights }) {
  const { coordinated, diffusion } = insights;
  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <Section icon={Users} title="رفتار هماهنگ / بات‌گونه" subtitle="نشر همزمان از چند منبع">
        {coordinated.length === 0 ? <Empty text="الگوی نشر هماهنگ مشکوکی یافت نشد." /> : (
          <div className="space-y-3">
            {coordinated.map((c) => (
              <div key={c.cluster.id} className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                <div className="flex items-center gap-2 text-[12px] mb-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-medium">{toFa(c.sources)} منبع مجزا</span>
                  <span className="text-slate-400">· در بازهٔ {toFa(c.spanMin)} دقیقه · {toFa(c.cluster.articles.length)} نسخه</span>
                </div>
                <p className="text-[12px] text-slate-600 dark:text-slate-300 line-clamp-2">{c.cluster.articles[0]?.preview}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={GitBranch} title="مسیر انتشار (Diffusion)" subtitle="از منبع مبدأ تا بازنشرها">
        {diffusion.length === 0 ? <Empty text="زنجیرهٔ انتشاری ردیابی نشد." /> : (
          <div className="space-y-3">
            {diffusion.map((d) => (
              <div key={d.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                <p className="text-[12px] text-slate-600 dark:text-slate-300 line-clamp-2 mb-2">{d.text}</p>
                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 px-2 py-0.5">
                    {d.origin.icon} {d.origin.source} · مبدأ
                  </span>
                  {d.hops.slice(0, 6).map((h, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-slate-400">
                      <ArrowUpRight className="w-3 h-3 rotate-180" />
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5">{h.icon} {h.source} · +{toFa(h.deltaMin)}د</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ─────────── event timeline ───────────
export function TimelinePanel({ insights }: { insights: SocialInsights }) {
  const t = insights.timeline;
  const max = Math.max(...t.map((x) => x.count), 1);
  return (
    <div className="p-4 max-w-3xl mx-auto">
      <Section icon={Clock} title="خط زمانی رویدادها" subtitle="حجم گفتگو در طول زمان">
        {t.length < 2 ? <Empty text="داده کافی برای خط زمانی نیست." /> : (
          <div className="space-y-2">
            {t.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 w-20 shrink-0 truncate">{b.label}</span>
                <div className="flex-1 h-5 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
                  <div className={`h-full ${b.peak ? "bg-rose-500" : "bg-cyan-500"}`} style={{ width: `${(b.count / max) * 100}%` }} />
                </div>
                <span className="text-[11px] text-slate-400 w-8 text-left tabular-nums">{toFa(b.count)}</span>
                {b.peak && <Flame className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
              </div>
            ))}
            {t.some((b) => b.peak && b.top) && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/70 space-y-1.5">
                <div className="text-[11px] text-slate-400 font-medium">اوج‌های قابل‌توجه:</div>
                {t.filter((b) => b.peak && b.top).map((b, i) => (
                  <a key={i} href={b.top!.link || undefined} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[12px] rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <Flame className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span className="text-slate-400 shrink-0">{b.label}</span>
                    <span className="flex-1 truncate">{b.top!.title || b.top!.text.slice(0, 50)}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}

// ─────────── geographic trend (via GDELT global media index) ───────────
export function GeoPanel({ topic }: { topic: WatchTopic | null }) {
  if (!topic) return <Empty text="موضوعی انتخاب نشده." />;
  const q = topic.keywords.length ? topic.keywords.join(" OR ") : topic.label;
  return (
    <div className="p-4 max-w-3xl mx-auto space-y-3">
      <div className="flex items-center gap-2 text-[12px] text-slate-400">
        <Globe className="w-4 h-4 text-cyan-500" />
        پراکندگی جغرافیایی پوشش خبری «{topic.label}» در رسانه‌های جهانی (GDELT، یک ماه اخیر)
      </div>
      <GdeltGeoMap query={{ q, timespan: "1m" }} />
    </div>
  );
}
