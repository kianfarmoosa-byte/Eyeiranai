import { useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2, Save, Filter, Calendar, Hash, Image as ImageIcon, Type, Star, Eye, Bell, ChevronRight } from "lucide-react";
import type { Article } from "../data";
import type { RemoteFeed } from "../api";
import {
  loadSearches, upsertSearch, removeSearch, newSearch, applySearch,
  type SavedSearch, type DateRange,
} from "../savedSearches";
import { toFa } from "./mobile/utils/fa";

type Props = {
  open: boolean;
  onClose: () => void;
  articles: Article[];
  feeds: RemoteFeed[];
  onApply: (s: SavedSearch) => void;
};

const DR_LABELS: { value: DateRange; label: string }[] = [
  { value: "any",  label: "هر زمان" },
  { value: "today", label: "امروز" },
  { value: "24h",  label: "۲۴ ساعت اخیر" },
  { value: "7d",   label: "هفتهٔ اخیر" },
  { value: "30d",  label: "ماه اخیر" },
];

export function SavedSearches({ open, onClose, articles, feeds, onApply }: Props) {
  const [list, setList] = useState<SavedSearch[]>([]);
  const [editing, setEditing] = useState<SavedSearch | null>(null);
  const [kwInput, setKwInput] = useState("");

  useEffect(() => { if (open) setList(loadSearches()); }, [open]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of list) m[s.id] = applySearch(articles, s).length;
    return m;
  }, [list, articles]);

  const allTags = useMemo(() => {
    const t = new Set<string>();
    for (const a of articles) for (const x of (a as any).tags || []) t.add(x);
    return [...t].sort();
  }, [articles]);

  const startNew = () => {
    const s = newSearch();
    setEditing(s);
    setKwInput("");
  };

  const startEdit = (s: SavedSearch) => {
    setEditing({ ...s });
    setKwInput("");
  };

  const commit = () => {
    if (!editing) return;
    upsertSearch(editing);
    setList(loadSearches());
    setEditing(null);
  };

  const del = (id: string) => {
    if (!confirm("این فیلتر حذف شود؟")) return;
    removeSearch(id);
    setList(loadSearches());
  };

  const addKw = () => {
    if (!editing || !kwInput.trim()) return;
    setEditing({ ...editing, keywords: [...editing.keywords, kwInput.trim()] });
    setKwInput("");
  };

  const togSrc = (id: string) => {
    if (!editing) return;
    const has = editing.sources.includes(id);
    setEditing({ ...editing, sources: has ? editing.sources.filter(x => x !== id) : [...editing.sources, id] });
  };

  const togTag = (t: string) => {
    if (!editing) return;
    const has = editing.tags.includes(t);
    setEditing({ ...editing, tags: has ? editing.tags.filter(x => x !== t) : [...editing.tags, t] });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-stretch md:items-center md:justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-3xl md:max-h-[88vh] bg-white dark:bg-slate-950 md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-semibold text-lg">جست‌وجوهای ذخیره‌شده و فیلترهای هوشمند</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {!editing ? (
            <div className="space-y-3">
              <button onClick={startNew}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> فیلتر جدید
              </button>
              {list.length === 0 ? (
                <div className="text-center text-sm text-slate-500 py-10">
                  هنوز فیلتری ذخیره نکرده‌اید. مثال‌ها: «تکنولوژی AI ۲۴ ساعت اخیر»، «فقط اخبار اقتصادی فارسی با تصویر».
                </div>
              ) : (
                list.map(s => (
                  <div key={s.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-950">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl shrink-0">{s.icon || "🔍"}</span>
                      <button onClick={() => onApply(s)} className="min-w-0 flex-1 text-right">
                        <div className="font-medium truncate">{s.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {summary(s)}
                        </div>
                      </button>
                      <span className="text-xs px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 shrink-0">
                        {counts[s.id] ?? 0}
                      </span>
                      <button onClick={() => onApply(s)} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600" title="اعمال">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button onClick={() => startEdit(s)} className="text-xs px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">ویرایش</button>
                      <button onClick={() => del(s.id)} className="p-1.5 rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input value={editing.icon || ""} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} maxLength={2}
                  className="w-12 px-2 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-2xl" />
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="نام فیلتر" className="flex-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none focus:border-emerald-500" />
              </div>

              <Section icon={<Type className="w-4 h-4" />} title="کلمات کلیدی">
                <div className="flex gap-2">
                  <input value={kwInput} onChange={(e) => setKwInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKw(); } }}
                    placeholder="کلمه‌ای وارد کنید (پیشوند - برای حذف)"
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none focus:border-emerald-500" />
                  <button onClick={addKw} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm">افزودن</button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {editing.keywords.map((k, i) => {
                    const neg = k.startsWith("-");
                    return (
                      <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${neg ? "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300" : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"}`}>
                        {k}
                        <button onClick={() => setEditing({ ...editing, keywords: editing.keywords.filter((_, j) => j !== i) })}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-2 text-xs">
                  <label className="flex items-center gap-1">
                    <input type="radio" checked={editing.combinator === "and"} onChange={() => setEditing({ ...editing, combinator: "and" })} />
                    همهٔ کلمات (AND)
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="radio" checked={editing.combinator === "or"} onChange={() => setEditing({ ...editing, combinator: "or" })} />
                    هر کدام (OR)
                  </label>
                </div>
              </Section>

              <Section icon={<Calendar className="w-4 h-4" />} title="بازهٔ زمانی">
                <div className="flex flex-wrap gap-1.5">
                  {DR_LABELS.map(d => (
                    <button key={d.value} onClick={() => setEditing({ ...editing, dateRange: d.value })}
                      className={`px-3 py-1 rounded-md text-xs ${editing.dateRange === d.value ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-900 hover:bg-slate-200"}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </Section>

              {feeds.length > 0 && (
                <Section icon={<Filter className="w-4 h-4" />} title={`منابع (${editing.sources.length || "همه"})`}>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {feeds.map(f => (
                      <button key={f.id} onClick={() => togSrc(f.id)}
                        className={`px-2 py-1 rounded-md text-xs flex items-center gap-1 ${editing.sources.includes(f.id) ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-900"}`}>
                        <span>{f.icon}</span>{f.name}
                      </button>
                    ))}
                  </div>
                </Section>
              )}

              {allTags.length > 0 && (
                <Section icon={<Hash className="w-4 h-4" />} title={`برچسب‌ها (${editing.tags.length})`}>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {allTags.map(t => (
                      <button key={t} onClick={() => togTag(t)}
                        className={`px-2 py-1 rounded-md text-xs ${editing.tags.includes(t) ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-900"}`}>
                        #{t}
                      </button>
                    ))}
                  </div>
                </Section>
              )}

              <Section icon={<Star className="w-4 h-4" />} title="گزینه‌های بیشتر">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Toggle label="فقط نشان‌شده‌ها" checked={!!editing.starredOnly} onChange={(v) => setEditing({ ...editing, starredOnly: v })} />
                  <Toggle label="فقط نخوانده‌ها" checked={!!editing.unreadOnly} onChange={(v) => setEditing({ ...editing, unreadOnly: v })} />
                  <Toggle label="دارای تصویر" checked={!!editing.hasImage} onChange={(v) => setEditing({ ...editing, hasImage: v })} />
                  <Toggle label="یادآوری در ساید‌بار" checked={!!editing.notify} onChange={(v) => setEditing({ ...editing, notify: v })} />
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm flex-wrap">
                  <span className="text-slate-500">حداقل کلمات:</span>
                  <input type="number" min={0} value={editing.minWords || 0}
                    onChange={(e) => setEditing({ ...editing, minWords: Number(e.target.value) || 0 })}
                    className="w-20 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
                  <span className="text-slate-500 mr-2">زمان مطالعه (دقیقه):</span>
                  <input type="number" min={0} placeholder="حداقل" value={editing.minReadMin ?? ""}
                    onChange={(e) => setEditing({ ...editing, minReadMin: e.target.value === "" ? undefined : Number(e.target.value) })}
                    className="w-20 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
                  <input type="number" min={0} placeholder="حداکثر" value={editing.maxReadMin ?? ""}
                    onChange={(e) => setEditing({ ...editing, maxReadMin: e.target.value === "" ? undefined : Number(e.target.value) })}
                    className="w-20 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm flex-wrap">
                  <span className="text-slate-500">احساس:</span>
                  {(["any", "positive", "neutral", "negative"] as const).map(opt => (
                    <button
                      key={opt}
                      onClick={() => setEditing({ ...editing, sentiment: opt })}
                      className={`px-2 py-1 rounded-md text-xs ${ (editing.sentiment || "any") === opt ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" }`}
                    >
                      {opt === "any" ? "هر" : opt === "positive" ? "🙂 مثبت" : opt === "neutral" ? "😐 خنثی" : "😟 منفی"}
                    </button>
                  ))}
                </div>
              </Section>

              <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button onClick={commit} className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> ذخیره
                </button>
                <button onClick={() => { commit(); if (editing) onApply(editing); }}
                  className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">
                  ذخیره و اعمال
                </button>
                <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-900">انصراف</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function summary(s: SavedSearch): string {
  const parts: string[] = [];
  if (s.keywords.length) parts.push(`${toFa(s.keywords.length)} کلیدواژه`);
  if (s.sources.length) parts.push(`${toFa(s.sources.length)} منبع`);
  if (s.tags.length) parts.push(`${toFa(s.tags.length)} برچسب`);
  if (s.dateRange !== "any") parts.push(DR_LABELS.find(d => d.value === s.dateRange)?.label || "");
  if (s.starredOnly) parts.push("نشان");
  if (s.unreadOnly) parts.push("نخوانده");
  if (s.hasImage) parts.push("با تصویر");
  if (s.sentiment && s.sentiment !== "any") parts.push(s.sentiment === "positive" ? "🙂" : s.sentiment === "negative" ? "😟" : "😐");
  if (s.minReadMin || s.maxReadMin) parts.push(`${s.minReadMin || 0}-${s.maxReadMin || "∞"} دقیقه`);
  return parts.join(" · ") || "بدون شرط";
}

function Section({ icon, title, children }: { icon: any; title: string; children: any }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">{icon}{title}</div>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-slate-100 dark:bg-slate-900 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
