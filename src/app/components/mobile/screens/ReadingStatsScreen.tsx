import { useEffect, useMemo, useState } from "react";
import { BookOpen, Flame, Bookmark, Clock, TrendingUp, Trophy, BarChart3, Target, Minus, Plus, Award } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { loadHistory, type HistoryEntry } from "../utils/history";
import { loadGoal, saveGoal, todayCount, bestStreak } from "../utils/goal";
import { useHaptics } from "../hooks";
import { faNum, countFa } from "../utils/fa";
import type { Article } from "../../../data";

type Props = {
  onClose: () => void;
  articles: Article[];
  savedCount?: number;
};

const DAY = 86_400_000;
const DAYS_OF_WEEK = ["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"];

export function ReadingStatsScreen({ onClose, articles, savedCount = 0 }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => loadHistory());
  const [goal, setGoal] = useState<number>(() => loadGoal());
  const haptic = useHaptics();
  const setGoalPersist = (n: number) => {
    const v = Math.max(1, Math.min(20, n));
    setGoal(v); saveGoal(v); haptic("select");
  };
  const today = todayCount();
  const best = useMemo(() => bestStreak(goal), [goal, entries]);
  const pct = Math.min(1, today / goal);
  useEffect(() => {
    const sync = () => setEntries(loadHistory());
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  const byId = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles]);

  // Last 7 days
  const week = useMemo(() => {
    const buckets: { day: string; count: number; date: Date }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      buckets.push({ day: DAYS_OF_WEEK[(d.getDay() + 1) % 7], count: 0, date: d });
    }
    for (const e of entries) {
      for (const b of buckets) {
        if (e.at >= b.date.getTime() && e.at < b.date.getTime() + DAY) {
          b.count++;
          break;
        }
      }
    }
    return buckets;
  }, [entries]);

  // Total stats
  const totalRead = entries.length;
  const readThisWeek = week.reduce((n, b) => n + b.count, 0);
  const maxDay = Math.max(1, ...week.map((b) => b.count));

  // Streak (consecutive days with reads, ending today or yesterday)
  const streak = useMemo(() => {
    const days = new Set<number>();
    for (const e of entries) {
      const d = new Date(e.at); d.setHours(0, 0, 0, 0);
      days.add(d.getTime());
    }
    let s = 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let cursor = today.getTime();
    if (!days.has(cursor)) cursor -= DAY; // grace: yesterday counts
    while (days.has(cursor)) { s++; cursor -= DAY; }
    return s;
  }, [entries]);

  // Reading time estimate (3min per article default)
  const estMinutes = useMemo(() => {
    let m = 0;
    for (const e of entries) {
      const a = byId.get(e.id);
      const txt = (a?.readTime ?? "").match(/\d+/)?.[0];
      m += txt ? parseInt(txt, 10) : 3;
    }
    return m;
  }, [entries, byId]);

  // Top sources / categories
  const topSources = useMemo(() => topCount(entries, byId, (a) => a.source), [entries, byId]);
  const topCategories = useMemo(() => topCount(entries, byId, (a) => a.category), [entries, byId]);

  return (
    <MobileScreen
      topbar={<MobileTopBar title="آمار مطالعه" subtitle="یک نگاه به عادت‌های خواندنت" onBack={onClose} />}
    >
      <div className="h-full overflow-y-auto scrollbar-none pb-6">
        {/* Hero numbers */}
        <section className="px-4 pt-3 grid grid-cols-2 gap-2.5">
          <StatCard icon={<BookOpen className="size-4" />} label="کل مقالات خوانده‌شده" value={faNum(totalRead)} accent />
          <StatCard icon={<Flame className="size-4" />} label="روز پشت‌سرهم" value={faNum(streak)} accent={streak > 0} />
          <StatCard icon={<Clock className="size-4" />} label="زمان مطالعه (دقیقه)" value={faNum(estMinutes)} />
          <StatCard icon={<Bookmark className="size-4" />} label="ذخیره‌شده‌ها" value={faNum(savedCount)} />
        </section>

        {/* Daily goal & streak */}
        <section className="mt-3 mx-3 rounded-[var(--radius-xl)] bg-gradient-to-br from-[var(--brand-500)] to-[var(--brand-700)] text-white p-4 shadow-sm">
          <header className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Target className="size-4" />
              <h3 className="text-[13px] font-bold">هدف امروز</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setGoalPersist(goal - 1)}
                aria-label="کاهش هدف"
                className="size-7 grid place-items-center rounded-full bg-white/15 active:bg-white/25 tap press"
              >
                <Minus className="size-3.5" />
              </button>
              <span className="tabular-nums text-[12px] font-bold w-6 text-center">{faNum(goal)}</span>
              <button
                onClick={() => setGoalPersist(goal + 1)}
                aria-label="افزایش هدف"
                className="size-7 grid place-items-center rounded-full bg-white/15 active:bg-white/25 tap press"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </header>
          <div className="flex items-end justify-between mb-2">
            <div>
              <div className="text-[36px] font-black tabular-nums leading-none">
                {faNum(today)}<span className="text-white/60 text-[18px] font-bold">/{faNum(goal)}</span>
              </div>
              <div className="text-[11.5px] text-white/80 mt-1">
                {today >= goal ? "🎉 هدف امروزت رو زدی!" : `${faNum(goal - today)} مقالهٔ دیگه تا هدف`}
              </div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-1 text-[11px] text-white/85">
                <Award className="size-3.5" /> رکورد: {countFa(best, "روز")}
              </div>
            </div>
          </div>
          <div className="h-2.5 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full bg-white transition-[width] duration-500"
              style={{ width: `${pct * 100}%` }}
            />
          </div>
        </section>

        {/* Weekly chart */}
        <section className="mt-5 mx-3 rounded-[var(--radius-xl)] bg-[var(--card)] border border-[var(--border-subtle)] p-4">
          <header className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="size-4 text-[var(--brand-500)]" />
              <h3 className="text-[13px] font-bold">هفتهٔ گذشته</h3>
            </div>
            <span className="text-[11px] text-[var(--foreground-subtle)]">{countFa(readThisWeek, "مقاله")}</span>
          </header>
          <div className="h-32 flex items-end justify-between gap-1.5">
            {week.map((b, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-md bg-gradient-to-t from-[var(--brand-600)] to-[var(--brand-400)] transition-all"
                    style={{ height: `${(b.count / maxDay) * 100}%`, minHeight: b.count > 0 ? 8 : 2, opacity: b.count > 0 ? 1 : 0.18 }}
                  />
                </div>
                <span className="text-[10px] text-[var(--foreground-subtle)] tabular-nums">{faNum(b.count)}</span>
                <span className="text-[10px] text-[var(--foreground-subtle)] truncate max-w-full">{b.day.slice(0, 2)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Top sources */}
        <section className="mt-5 mx-3 rounded-[var(--radius-xl)] bg-[var(--card)] border border-[var(--border-subtle)] p-4">
          <header className="flex items-center gap-1.5 mb-3">
            <TrendingUp className="size-4 text-[var(--brand-500)]" />
            <h3 className="text-[13px] font-bold">منابع پرخوانده</h3>
          </header>
          {topSources.length === 0 ? (
            <div className="text-[12px] text-[var(--foreground-subtle)] text-center py-3">داده‌ای موجود نیست</div>
          ) : (
            <ul className="space-y-2">
              {topSources.slice(0, 5).map(([name, n], i) => (
                <BarRow key={name} label={name} count={n} max={topSources[0][1]} rank={i + 1} />
              ))}
            </ul>
          )}
        </section>

        {/* Top categories */}
        <section className="mt-5 mx-3 rounded-[var(--radius-xl)] bg-[var(--card)] border border-[var(--border-subtle)] p-4">
          <header className="flex items-center gap-1.5 mb-3">
            <Trophy className="size-4 text-[var(--brand-500)]" />
            <h3 className="text-[13px] font-bold">دسته‌بندی‌های مورد علاقه</h3>
          </header>
          {topCategories.length === 0 ? (
            <div className="text-[12px] text-[var(--foreground-subtle)] text-center py-3">داده‌ای موجود نیست</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {topCategories.slice(0, 8).map(([name, n]) => (
                <span
                  key={name}
                  className="h-7 px-3 rounded-full bg-[var(--brand-500)]/10 text-[var(--brand-600)] text-[11.5px] font-semibold inline-flex items-center gap-1"
                >
                  {name} <span className="tabular-nums opacity-70">{faNum(n)}</span>
                </span>
              ))}
            </div>
          )}
        </section>
      </div>
    </MobileScreen>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] p-3 border ${
        accent
          ? "bg-[var(--brand-500)] text-white border-transparent"
          : "bg-[var(--card)] text-[var(--foreground)] border-[var(--border-subtle)]"
      }`}
    >
      <div className={`text-[11px] font-medium inline-flex items-center gap-1 ${accent ? "text-white/85" : "text-[var(--foreground-subtle)]"}`}>
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-[26px] font-black tabular-nums leading-none">{value}</div>
    </div>
  );
}

function BarRow({ label, count, max, rank }: { label: string; count: number; max: number; rank: number }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="size-6 grid place-items-center rounded-full bg-[var(--background-muted)] text-[10.5px] font-bold tabular-nums text-[var(--foreground-muted)]">
        {faNum(rank)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-medium truncate">{label}</span>
          <span className="text-[var(--foreground-subtle)] tabular-nums">{faNum(count)}</span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-[var(--background-muted)] overflow-hidden">
          <div
            className="h-full bg-[var(--brand-500)]"
            style={{ width: `${(count / max) * 100}%` }}
          />
        </div>
      </div>
    </li>
  );
}

function topCount(entries: HistoryEntry[], byId: Map<string, Article>, key: (a: Article) => string | undefined): [string, number][] {
  const counts: Record<string, number> = {};
  for (const e of entries) {
    const a = byId.get(e.id);
    if (!a) continue;
    const k = key(a);
    if (!k) continue;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}
