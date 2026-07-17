import { useMemo, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Swords, Plus, Trash2, Settings2 } from "lucide-react";
import type { Article } from "../../data";
import { shareOfVoice, type Period, type SovGroup } from "../../mediaAnalytics";
import { faNum, toFa } from "../mobile/utils/fa";

// ── Section ۳.۶ — مقایسهٔ رقبا / سهم صدا (Competitive View) ──
// کاربر گروه‌های برند/رقیب را با کلیدواژه تعریف می‌کند؛ داشبورد سهم صدا، احساسات
// هر گروه و «شکاف موضوعی» (موضوعاتی که رقبا دارند و برند غایب است) را نشان می‌دهد.

const LS_KEY = "analytics.sov";
const PALETTE = ["#10b981", "#6366f1", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];

const DEFAULT_GROUPS: SovGroup[] = [
  { name: "برند ما", keywords: [], color: PALETTE[0] },
  { name: "رقیب ۱", keywords: [], color: PALETTE[1] },
];

function loadGroups(): SovGroup[] {
  try { const v = JSON.parse(localStorage.getItem(LS_KEY) || "null"); return Array.isArray(v) && v.length ? v : DEFAULT_GROUPS; } catch { return DEFAULT_GROUPS; }
}
function persist(g: SovGroup[]) { try { localStorage.setItem(LS_KEY, JSON.stringify(g)); } catch { /* ignore */ } }

export function CompetitiveView({ articles, period }: { articles: Article[]; period: Period }) {
  const [groups, setGroups] = useState<SovGroup[]>(loadGroups);
  const [editing, setEditing] = useState(false);

  const data = useMemo(
    () => shareOfVoice(articles, groups.filter(g => g.keywords.length), period),
    [articles, groups, period],
  );
  const configured = groups.some(g => g.keywords.length);

  const update = (i: number, patch: Partial<SovGroup>) => {
    const next = groups.map((g, j) => (j === i ? { ...g, ...patch } : g));
    setGroups(next); persist(next);
  };
  const addGroup = () => {
    if (groups.length >= 6) return;
    const next = [...groups, { name: `رقیب ${toFa(groups.length)}`, keywords: [], color: PALETTE[groups.length % PALETTE.length] }];
    setGroups(next); persist(next);
  };
  const removeGroup = (i: number) => { const next = groups.filter((_, j) => j !== i); setGroups(next); persist(next); };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Swords className="w-4 h-4 text-indigo-500" />
        <h3 className="text-sm">مقایسهٔ رقبا و سهم صدا</h3>
        <div className="flex-1" />
        <button
          onClick={() => setEditing(e => !e)}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition ${editing ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}
        >
          <Settings2 className="w-3.5 h-3.5" /> تنظیم گروه‌ها
        </button>
      </div>

      {editing && (
        <div className="mb-4 space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          {groups.map((g, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: g.color }} />
              <input
                value={g.name}
                onChange={e => update(i, { name: e.target.value })}
                className="w-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                value={g.keywords.join("، ")}
                onChange={e => update(i, { keywords: e.target.value.split(/[،,]/).map(s => s.trim()).filter(Boolean) })}
                placeholder="کلیدواژه‌ها با ویرگول"
                className="flex-1 min-w-[160px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button onClick={() => removeGroup(i)} className="p-1 text-slate-400 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {groups.length < 6 && (
            <button onClick={addGroup} className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700">
              <Plus className="w-4 h-4" /> افزودن گروه
            </button>
          )}
        </div>
      )}

      {!configured ? (
        <div className="text-xs text-slate-400 py-6 text-center">
          برای دیدن سهم صدا، کلیدواژهٔ برند و رقبا را در «تنظیم گروه‌ها» وارد کنید.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div className="h-48" style={{ direction: "ltr" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                  {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ direction: "rtl", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: any, _n: any, p: any) => [`${faNum(Number(v))} مطلب • ${toFa(p.payload.share)}٪`, p.payload.name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {data.map(d => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
                <span className="flex-1 truncate">{d.name}</span>
                <span className="tabular-nums opacity-70">{toFa(d.share)}٪</span>
                <span className="tabular-nums text-slate-400">({faNum(d.count)})</span>
                <span className={`tabular-nums font-semibold w-12 text-left ${d.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {d.net > 0 ? "+" : ""}{toFa(d.net)}٪
                </span>
              </div>
            ))}
            <div className="text-[10px] text-slate-400 pt-1">ستون آخر: احساسات خالص هر گروه.</div>
          </div>
        </div>
      )}
    </div>
  );
}
