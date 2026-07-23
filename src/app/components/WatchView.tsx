// Page Change Monitoring (رصد تغییرات صفحه) — a native, lightweight take on
// changedetection.io built on the app's own Edge Function + KV backend.
// Users add URLs (optionally scoped to a CSS selector), the server periodically
// snapshots and hashes them, and this view shows changes with a diff preview and
// an optional AI plain-language summary.
import { useEffect, useMemo, useState } from "react";
import {
  Plus, RefreshCw, Trash2, Globe, Loader2, AlertTriangle, Check,
  Bell, BellOff, ExternalLink, Eraser, ChevronDown, ChevronLeft, Crosshair,
} from "lucide-react";
import { api, type PageWatch } from "../api";
import { faNum, timeAgoFa } from "./mobile/utils/fa";

function relTime(ms?: number): string {
  if (!ms) return "—";
  return timeAgoFa(ms);
}

export function WatchView() {
  const [items, setItems] = useState<PageWatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // add form
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [selector, setSelector] = useState("");
  const [interval, setIntervalMin] = useState(60);
  const [adding, setAdding] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.watchList();
      setItems(list);
    } catch (e) {
      console.error("watch list failed:", e);
      setError(`دریافت فهرست رصد شکست خورد: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markBusy = (id: string, on: boolean) =>
    setBusy(prev => { const n = new Set(prev); on ? n.add(id) : n.delete(id); return n; });

  const add = async () => {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) { setError("آدرس باید با http:// یا https:// شروع شود"); return; }
    setAdding(true);
    setError(null);
    try {
      await api.watchAdd({ url: u, label: label.trim() || undefined, selector: selector.trim() || undefined, intervalMin: interval });
      setUrl(""); setLabel(""); setSelector(""); setFormOpen(false);
      await load();
    } catch (e) {
      console.error("watch add failed:", e);
      setError(`افزودن رصد شکست خورد: ${String(e)}`);
    } finally {
      setAdding(false);
    }
  };

  const checkNow = async (w: PageWatch) => {
    markBusy(w.id, true);
    setError(null);
    try {
      const { state } = await api.watchCheck(w.id);
      setItems(prev => prev.map(x => x.id === w.id ? { ...x, state } : x));
      setExpanded(prev => new Set(prev).add(w.id));
    } catch (e) {
      console.error("watch check failed:", e);
      setError(`بررسی «${w.label}» شکست خورد: ${String(e)}`);
    } finally {
      markBusy(w.id, false);
    }
  };

  const toggleActive = async (w: PageWatch) => {
    try {
      const updated = await api.watchUpdate(w.id, { active: !w.active });
      setItems(prev => prev.map(x => x.id === w.id ? { ...x, ...updated } : x));
    } catch (e) {
      console.error("watch toggle failed:", e);
      setError(`تغییر وضعیت شکست خورد: ${String(e)}`);
    }
  };

  const remove = async (w: PageWatch) => {
    if (!confirm(`حذف رصد «${w.label}»؟`)) return;
    markBusy(w.id, true);
    try {
      await api.watchDelete(w.id);
      setItems(prev => prev.filter(x => x.id !== w.id));
    } catch (e) {
      console.error("watch delete failed:", e);
      setError(`حذف شکست خورد: ${String(e)}`);
    } finally {
      markBusy(w.id, false);
    }
  };

  const clearHistory = async (w: PageWatch) => {
    try {
      await api.watchClear(w.id);
      setItems(prev => prev.map(x => x.id === w.id ? { ...x, state: x.state ? { ...x.state, changes: [] } : x.state } : x));
    } catch (e) {
      console.error("watch clear failed:", e);
    }
  };

  const toggleExpand = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const totalChanges = useMemo(
    () => items.reduce((s, w) => s + (w.state?.changes?.length || 0), 0),
    [items]
  );

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-white dark:bg-slate-950" dir="rtl">
      {/* header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-emerald-500" />
            رصد تغییرات صفحه
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {faNum(items.length)} صفحهٔ تحت‌نظر · {faNum(totalChanges)} تغییر ثبت‌شده
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
          title="بازخوانی"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
        <button
          onClick={() => setFormOpen(o => !o)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          افزودن
        </button>
      </div>

      {error && (
        <div className="mx-5 mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-xs underline">بستن</button>
        </div>
      )}

      {/* add form */}
      {formOpen && (
        <div className="mx-5 mt-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 space-y-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">آدرس صفحه (URL)</label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              dir="ltr"
              placeholder="https://example.com/page"
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">برچسب (اختیاری)</label>
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="مثلاً صفحهٔ قیمت‌ها"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">بازهٔ بررسی (دقیقه)</label>
              <input
                type="number"
                min={5}
                value={interval}
                onChange={e => setIntervalMin(Math.max(5, Number(e.target.value) || 60))}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">محدودکنندهٔ CSS (اختیاری) — فقط این بخش صفحه رصد شود</label>
            <input
              value={selector}
              onChange={e => setSelector(e.target.value)}
              dir="ltr"
              placeholder=".price, #main-content, article"
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={add}
              disabled={adding}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-medium"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              افزودن و ثبت نسخهٔ پایه
            </button>
            <button onClick={() => setFormOpen(false)} className="px-3 py-2 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 text-sm">انصراف</button>
          </div>
        </div>
      )}

      {/* list */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Crosshair className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">هنوز صفحه‌ای برای رصد اضافه نشده است.</p>
            <p className="text-xs mt-1">با دکمهٔ «افزودن» یک آدرس برای پایش تغییرات ثبت کنید.</p>
          </div>
        ) : (
          items.map(w => {
            const st = w.state;
            const changes = st?.changes || [];
            const isOpen = expanded.has(w.id);
            const isBusy = busy.has(w.id);
            return (
              <div key={w.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950 grid place-items-center">
                    <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white truncate">{w.label}</span>
                      {changes.length > 0 && (
                        <span className="shrink-0 text-[11px] font-semibold bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
                          {faNum(changes.length)} تغییر
                        </span>
                      )}
                      {!w.active && <span className="shrink-0 text-[11px] text-slate-400">(متوقف)</span>}
                    </div>
                    <a href={w.url} target="_blank" rel="noopener noreferrer" dir="ltr"
                      className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 truncate max-w-full">
                      <span className="truncate">{w.url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                      {w.selector && <span className="font-mono" dir="ltr">🎯 {w.selector}</span>}
                      <span>هر {faNum(w.intervalMin)} دقیقه</span>
                      <span>آخرین بررسی: {relTime(st?.checkedAt)}</span>
                      {st?.lastChangedAt ? <span>آخرین تغییر: {relTime(st.lastChangedAt)}</span> : null}
                      {st?.error && <span className="text-rose-500">خطا: {st.error}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    <button onClick={() => checkNow(w)} disabled={isBusy} title="بررسی فوری"
                      className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-50">
                      {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                    <button onClick={() => toggleActive(w)} title={w.active ? "توقف رصد" : "ازسرگیری رصد"}
                      className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                      {w.active ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                    </button>
                    <button onClick={() => remove(w)} title="حذف"
                      className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {changes.length > 0 && (
                  <div className="border-t border-slate-100 dark:border-slate-800">
                    <button onClick={() => toggleExpand(w.id)}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                      <span className="flex-1 text-right">تاریخچهٔ تغییرات</span>
                      <span
                        onClick={(e) => { e.stopPropagation(); clearHistory(w); }}
                        className="flex items-center gap-1 hover:text-rose-500 cursor-pointer"
                        title="پاک‌کردن تاریخچه"
                      >
                        <Eraser className="w-3.5 h-3.5" />
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-3 space-y-3">
                        {changes.map((ch, i) => (
                          <div key={`${ch.ts}-${i}`} className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3">
                            <div className="text-[11px] text-slate-400 mb-1">{relTime(ch.ts)}</div>
                            {ch.summary && (
                              <div className="text-sm text-slate-700 dark:text-slate-200 mb-2 leading-relaxed">
                                🧠 {ch.summary}
                              </div>
                            )}
                            <pre dir="ltr" className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed text-slate-600 dark:text-slate-300 max-h-40 overflow-y-auto">
                              {ch.diff.split("\n").map((line, j) => (
                                <div key={j} className={
                                  line.startsWith("+") ? "text-emerald-600 dark:text-emerald-400"
                                    : line.startsWith("-") ? "text-rose-600 dark:text-rose-400"
                                    : ""
                                }>{line}</div>
                              ))}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
