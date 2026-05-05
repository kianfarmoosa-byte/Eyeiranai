import { useMemo, useRef, useState } from "react";
import {
  X, Plus, Search, Download, Upload, Sparkles, Check, AlertTriangle, Trash2,
  Rss, Youtube, Mic2, Twitter, Send, Mail, Github, BookOpen, Globe, MessageSquare, Loader2,
} from "lucide-react";
import { api, type RemoteFeed } from "../api";
import {
  detectSource, probeUrls, CATALOG, KIND_META,
  parseOPML, buildOPML, mergeOpml,
  type DetectedSource, type SourceKind,
} from "../sourceHub";

type Props = {
  open: boolean;
  onClose: () => void;
  feeds: RemoteFeed[];
  onChanged: () => void;
};

type Tab = "add" | "catalog" | "opml" | "manage";

const KIND_ICON: Record<SourceKind, any> = {
  rss: Rss, youtube: Youtube, podcast: Mic2, twitter: Twitter, telegram: Send,
  newsletter: Mail, reddit: MessageSquare, github: Github, medium: BookOpen, site: Globe,
};

const ALL_KINDS: SourceKind[] = ["rss", "youtube", "podcast", "twitter", "telegram", "newsletter", "reddit", "github", "medium", "site"];

export function SourceHub({ open, onClose, feeds, onChanged }: Props) {
  const [tab, setTab] = useState<Tab>("add");
  const [input, setInput] = useState("");
  const [detected, setDetected] = useState<DetectedSource | null>(null);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [kindFilter, setKindFilter] = useState<SourceKind | "all">("all");
  const [catQuery, setCatQuery] = useState("");
  const [opmlText, setOpmlText] = useState("");
  const [opmlPreview, setOpmlPreview] = useState<{ add: any[]; skip: any[] } | null>(null);
  const [opmlImporting, setOpmlImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const existingUrls = useMemo(() => feeds.map(f => f.url.toLowerCase().replace(/\/+$/, "")), [feeds]);
  const has = (url: string) => existingUrls.includes(url.toLowerCase().replace(/\/+$/, ""));

  const onDetect = (val: string) => {
    setInput(val);
    setMsg(null);
    if (!val.trim()) { setDetected(null); return; }
    setDetected(detectSource(val));
  };

  const addOne = async (url: string, name: string, icon: string, category: string) => {
    setAdding(true);
    setMsg(null);
    try {
      await api.addFeed(url, name, icon, category);
      setMsg({ kind: "ok", text: `«${name}» با موفقیت افزوده شد.` });
      setInput(""); setDetected(null);
      onChanged();
    } catch (e: any) {
      setMsg({ kind: "err", text: `خطا در افزودن: ${e.message || e}` });
    } finally {
      setAdding(false);
    }
  };

  const addDetected = async () => {
    if (!detected) return;
    if (detected.kind === "site") {
      // Try probe URLs sequentially
      const probes = probeUrls(detected.url);
      setAdding(true); setMsg({ kind: "info", text: `در حال جست‌وجوی فید در ${probes.length} مسیر…` });
      for (const u of probes) {
        try {
          await api.addFeed(u, detected.name, detected.icon, detected.category);
          setMsg({ kind: "ok", text: `فید کشف شد: ${u}` });
          setInput(""); setDetected(null);
          onChanged();
          setAdding(false);
          return;
        } catch { /* try next */ }
      }
      setAdding(false);
      setMsg({ kind: "err", text: "فیدی در مسیرهای متداول پیدا نشد. لطفاً URL مستقیم فید را وارد کنید." });
      return;
    }
    await addOne(detected.url, detected.name, detected.icon, detected.category);
  };

  const filteredCatalog = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    return CATALOG.filter(c => {
      if (kindFilter !== "all" && c.kind !== kindFilter) return false;
      if (!q) return true;
      return (c.name + " " + c.description + " " + c.category + " " + (c.tags || []).join(" ")).toLowerCase().includes(q);
    });
  }, [kindFilter, catQuery]);

  const onOpmlPicked = async (file: File) => {
    const text = await file.text();
    setOpmlText(text);
    const entries = parseOPML(text);
    setOpmlPreview(mergeOpml(entries, existingUrls));
  };

  const importOpmlConfirm = async () => {
    if (!opmlPreview || opmlPreview.add.length === 0) return;
    setOpmlImporting(true);
    setMsg(null);
    try {
      await api.bulkAdd(opmlPreview.add.map(e => ({ url: e.url, name: e.name, category: e.category })));
      setMsg({ kind: "ok", text: `${opmlPreview.add.length} فید جدید افزوده شد. ${opmlPreview.skip.length} مورد تکراری بود.` });
      setOpmlPreview(null); setOpmlText("");
      onChanged();
    } catch (e: any) {
      setMsg({ kind: "err", text: `خطا در ایمپورت: ${e.message || e}` });
    } finally {
      setOpmlImporting(false);
    }
  };

  const exportOpml = () => {
    const xml = buildOPML(feeds.map(f => ({ url: f.url, name: f.name })));
    const blob = new Blob([xml], { type: "application/xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kian-feeds-${new Date().toISOString().slice(0, 10)}.opml`;
    a.click();
  };

  const removeOne = async (id: string) => {
    if (!confirm("این منبع حذف شود؟")) return;
    try { await api.removeFeed(id); onChanged(); }
    catch (e: any) { setMsg({ kind: "err", text: `خطا در حذف: ${e.message || e}` }); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-stretch md:items-center md:justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-4xl md:max-h-[88vh] bg-white dark:bg-slate-950 md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="font-semibold text-lg">منبع‌یاب — افزودن از هر پلتفرم</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </header>

        <nav className="flex border-b border-slate-200 dark:border-slate-800 shrink-0 overflow-x-auto">
          {([
            { id: "add", label: "افزودن سریع", icon: Plus },
            { id: "catalog", label: "کاتالوگ", icon: BookOpen },
            { id: "opml", label: "OPML", icon: Upload },
            { id: "manage", label: `منابع من (${feeds.length})`, icon: Rss },
          ] as { id: Tab; label: string; icon: any }[]).map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"}`}>
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </nav>

        {msg && (
          <div className={`mx-4 mt-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2 shrink-0 ${
            msg.kind === "ok" ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200" :
            msg.kind === "err" ? "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200" :
            "bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200"
          }`}>
            {msg.kind === "ok" ? <Check className="w-4 h-4" /> : msg.kind === "err" ? <AlertTriangle className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{msg.text}</span>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {tab === "add" && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">URL یا شناسه (مثال: <code dir="ltr">@elonmusk</code>, <code dir="ltr">youtube.com/@mkbhd</code>, <code dir="ltr">t.me/durov</code>, <code dir="ltr">github.com/facebook/react</code>)</label>
                <input
                  value={input}
                  onChange={(e) => onDetect(e.target.value)}
                  placeholder="چسباندن آدرس یا @handle…"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              {detected && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className={`px-4 py-3 bg-gradient-to-l ${KIND_META[detected.kind].color} text-white flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{detected.icon}</span>
                      <div>
                        <div className="font-semibold">{detected.name}</div>
                        <div className="text-xs opacity-90">{KIND_META[detected.kind].label} · {detected.category}</div>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-md bg-white/20">شناسایی شد</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="text-xs text-slate-500">URL تبدیل‌شده:</div>
                    <code dir="ltr" className="block text-xs bg-slate-100 dark:bg-slate-900 p-2 rounded break-all">{detected.url}</code>
                    {detected.note && <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {detected.note}</div>}
                    {has(detected.url) ? (
                      <div className="text-sm text-slate-500 flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> این منبع از قبل افزوده شده.</div>
                    ) : (
                      <button onClick={addDetected} disabled={adding}
                        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-2">
                        {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        افزودن این منبع
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!detected && input.trim() && (
                <div className="text-sm text-slate-500 p-3 bg-slate-100 dark:bg-slate-900 rounded-lg">
                  ورودی شناسایی نشد. URL مستقیم فید RSS/Atom یا یکی از قالب‌های بالا را امتحان کنید.
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
                {ALL_KINDS.map(k => {
                  const Icon = KIND_ICON[k];
                  return (
                    <div key={k} className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                      <Icon className="w-4 h-4 text-slate-500" />
                      <span className="text-[11px] text-slate-600 dark:text-slate-400">{KIND_META[k].label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "catalog" && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={catQuery} onChange={(e) => setCatQuery(e.target.value)} placeholder="جست‌وجو در کاتالوگ…"
                    className="w-full pr-9 pl-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none focus:border-blue-500" />
                </div>
                <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <option value="all">همه نوع‌ها</option>
                  {ALL_KINDS.map(k => <option key={k} value={k}>{KIND_META[k].label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredCatalog.map(c => {
                  const taken = has(c.url);
                  return (
                    <div key={c.url} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex flex-col gap-2 bg-white dark:bg-slate-950">
                      <div className="flex items-start gap-2">
                        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${KIND_META[c.kind].color} flex items-center justify-center text-white text-lg shrink-0`}>{c.icon}</div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-[11px] text-slate-500">{KIND_META[c.kind].label} · {c.category}</div>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{c.description}</p>
                      <button disabled={taken || adding} onClick={() => addOne(c.url, c.name, c.icon, c.category)}
                        className={`mt-1 w-full py-1.5 rounded-md text-sm font-medium ${taken ? "bg-slate-100 dark:bg-slate-800 text-slate-500" : "bg-blue-600 hover:bg-blue-700 text-white"}`}>
                        {taken ? "افزوده شده" : "افزودن"}
                      </button>
                    </div>
                  );
                })}
                {filteredCatalog.length === 0 && (
                  <div className="col-span-full text-center text-sm text-slate-500 py-8">موردی یافت نشد.</div>
                )}
              </div>
            </div>
          )}

          {tab === "opml" && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={() => fileRef.current?.click()}
                  className="flex-1 py-3 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4" /> انتخاب فایل OPML
                </button>
                <button onClick={exportOpml} disabled={feeds.length === 0}
                  className="flex-1 py-3 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" /> اکسپورت تمام منابع
                </button>
              </div>
              <input ref={fileRef} type="file" accept=".opml,.xml" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onOpmlPicked(f); e.currentTarget.value = ""; }} />

              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">یا چسباندن مستقیم محتوای OPML:</label>
                <textarea value={opmlText} onChange={(e) => {
                  setOpmlText(e.target.value);
                  const entries = parseOPML(e.target.value);
                  setOpmlPreview(entries.length ? mergeOpml(entries, existingUrls) : null);
                }} rows={6} placeholder="<?xml version=…"
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none focus:border-blue-500 font-mono text-xs" dir="ltr" />
              </div>

              {opmlPreview && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-100 dark:bg-slate-900 flex items-center justify-between text-sm">
                    <span><span className="font-semibold text-emerald-600">{opmlPreview.add.length}</span> جدید · <span className="font-semibold text-slate-500">{opmlPreview.skip.length}</span> تکراری</span>
                    <button onClick={importOpmlConfirm} disabled={opmlPreview.add.length === 0 || opmlImporting}
                      className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs flex items-center gap-1.5">
                      {opmlImporting && <Loader2 className="w-3 h-3 animate-spin" />} ایمپورت {opmlPreview.add.length} مورد
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-900">
                    {opmlPreview.add.slice(0, 50).map((e, i) => (
                      <div key={i} className="px-3 py-1.5 flex items-center gap-2 text-xs">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="font-medium truncate flex-1">{e.name}</span>
                        {e.category && <span className="text-slate-400">{e.category}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "manage" && (
            <div className="space-y-2">
              {feeds.length === 0 ? (
                <div className="text-center text-sm text-slate-500 py-8">هیچ منبعی افزوده نشده است.</div>
              ) : (
                feeds.map(f => (
                  <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-xl">{f.icon || "📡"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{f.name}</div>
                      <div className="text-[11px] text-slate-500 truncate" dir="ltr">{f.url}</div>
                    </div>
                    <button onClick={() => removeOne(f.id)} className="p-1.5 rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
