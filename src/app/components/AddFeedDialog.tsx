import { useMemo, useState } from "react";
import { X, Loader2, Search, Check } from "lucide-react";
import { SEED_FEEDS } from "../feedsData";
import { api } from "../api";
import { toFa } from "./mobile/utils/fa";

type Props = {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
};

const CATEGORY_ICON: Record<string, string> = {
  "همه اخبار": "📰",
  "سیاسی": "🏛️",
  "اقتصادی": "💰",
  "ورزشی": "⚽",
  "ورزش": "⚽",
  "فرهنگی": "🎭",
  "فرهنگ و هنر": "🎭",
  "اجتماعی": "👥",
  "بین‌الملل": "🌍",
  "فناوری": "💻",
  "علمی": "🔬",
  "سلامت": "🩺",
  "حوادث": "🚨",
};

function iconFor(cat: string) {
  for (const k of Object.keys(CATEGORY_ICON)) if (cat?.includes(k)) return CATEGORY_ICON[k];
  return "📡";
}

export function AddFeedDialog({ open, onClose, onDone }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customUrl, setCustomUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'browse' | 'custom'>('browse');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SEED_FEEDS;
    return SEED_FEEDS.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q) ||
      f.type.toLowerCase().includes(q)
    );
  }, [query]);

  const grouped = useMemo(() => {
    const m = new Map<string, typeof SEED_FEEDS>();
    for (const f of filtered) {
      const k = f.name;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(f);
    }
    return Array.from(m.entries());
  }, [filtered]);

  if (!open) return null;

  const toggle = (url: string) => {
    const next = new Set(selected);
    next.has(url) ? next.delete(url) : next.add(url);
    setSelected(next);
  };

  const selectAllFiltered = () => {
    const next = new Set(selected);
    filtered.forEach(f => next.add(f.url));
    setSelected(next);
  };

  const submitSelected = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      const toAdd = SEED_FEEDS.filter(f => selected.has(f.url)).map(f => ({
        url: f.url, name: f.name, icon: iconFor(f.category), category: f.category,
      }));
      await api.bulkAdd(toAdd);
      setSelected(new Set());
      onDone();
      onClose();
    } catch (e) {
      alert("خطا: " + e);
    } finally { setLoading(false); }
  };

  const addAllIrani = async () => {
    if (!confirm(`افزودن همه ${toFa(SEED_FEEDS.length)} منبع به خوراک‌های شما؟`)) return;
    setLoading(true);
    try {
      const all = SEED_FEEDS.map(f => ({ url: f.url, name: f.name, icon: iconFor(f.category), category: f.category }));
      await api.bulkAdd(all);
      onDone();
      onClose();
    } catch (e) {
      alert("خطا: " + e);
    } finally { setLoading(false); }
  };

  const submitCustom = async () => {
    if (!customUrl) return;
    setLoading(true);
    try {
      await api.addFeed(customUrl);
      setCustomUrl("");
      onDone();
      onClose();
    } catch (e) {
      alert("خطا: " + e);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-3xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h3>افزودن خوراک</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button onClick={() => setTab('browse')} className={`px-4 py-2 text-sm ${tab === 'browse' ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
            کاتالوگ منابع ایرانی ({SEED_FEEDS.length})
          </button>
          <button onClick={() => setTab('custom')} className={`px-4 py-2 text-sm ${tab === 'custom' ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
            افزودن نشانی دلخواه
          </button>
        </div>

        {tab === 'browse' && (
          <>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="جستجو در نام، دسته یا نوع..."
                  className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <button onClick={selectAllFiltered} className="text-sm px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700">انتخاب همه نتایج</button>
              <button onClick={addAllIrani} disabled={loading} className="text-sm px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">افزودن کل کاتالوگ</button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {grouped.map(([name, list]) => (
                <div key={name} className="mb-4">
                  <div className="px-2 py-1 text-xs text-slate-500 sticky top-0 bg-white dark:bg-slate-900">{name}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    {list.map((f, i) => {
                      const isSel = selected.has(f.url);
                      return (
                        <button key={`${f.url}__${f.category}__${i}`} onClick={() => toggle(f.url)}
                          className={`flex items-center gap-2 p-2 rounded-lg text-right text-sm border ${isSel ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSel ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 dark:border-slate-600'}`}>
                            {isSel && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span>{iconFor(f.category)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{f.category || "همه"}</div>
                            <div className="text-xs text-slate-500 truncate" dir="ltr">{f.url}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <div className="text-center text-slate-500 py-12">نتیجه‌ای یافت نشد</div>}
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <div className="flex-1 text-sm text-slate-500">{selected.size} مورد انتخاب شده</div>
              <button onClick={submitSelected} disabled={loading || selected.size === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm flex items-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                افزودن موارد انتخابی
              </button>
            </div>
          </>
        )}

        {tab === 'custom' && (
          <div className="p-6 flex-1">
            <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">نشانی RSS را وارد کنید</label>
            <input dir="ltr" value={customUrl} onChange={e => setCustomUrl(e.target.value)} placeholder="https://example.com/feed.xml"
              className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <button onClick={submitCustom} disabled={loading || !customUrl}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg py-2 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              افزودن
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
