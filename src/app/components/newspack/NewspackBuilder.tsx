import { useEffect, useMemo, useRef, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  Package, Plus, Trash2, Play, Loader2, X, GripVertical, Search, Clock,
  CalendarClock, Sparkles, ChevronDown, ChevronUp, FileText, Library, Settings2, Globe, RefreshCw,
  Bell, Mail, Webhook, Send, Check, BarChart3, Share2, Copy, Link2, Download, Users,
} from "lucide-react";
import { api, type NewsPack, type PackSection, type PackSource, type NewsEdition, type NewspackNotif } from "../../api";
import { detectSource } from "../../sourceHub";
import { faNum } from "../mobile/utils/fa";
import { EditionViewer } from "./EditionViewer";
import { EditionActions } from "./EditionActions";
import {
  CONTENT_TYPES, ITEM_LENGTHS, THEMES, TIMESPANS, SCHEDULES, SOURCE_LIBRARY, PACK_TEMPLATES,
  contentTypeMeta, newPack, newSection, librarySourceToPackSource, libraryCatalog, nextRunAt, formatNextRun, type LibrarySource,
} from "./newspackModel";
import { PackAnalytics } from "./PackAnalytics";
import { CollabRoom } from "./CollabRoom";

const DND_SOURCE = "NEWSPACK_SOURCE";

type DragSource = { source: PackSource; fromSectionId: string | null };

// ── draggable library / section source chip ──
function SourceChip({
  source, fromSectionId, onRemove,
}: { source: PackSource; fromSectionId: string | null; onRemove?: () => void }) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: DND_SOURCE,
    item: { source, fromSectionId } as DragSource,
    collect: (m) => ({ isDragging: m.isDragging() }),
  }), [source, fromSectionId]);
  const nonFa = source.lang && source.lang !== "fa";
  return (
    <div
      ref={drag as any}
      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs cursor-grab active:cursor-grabbing bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 ${isDragging ? "opacity-40" : ""}`}
      title={source.url}
    >
      <GripVertical className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
      <span>{source.icon || "🔗"}</span>
      <span className="truncate max-w-[140px] text-slate-700 dark:text-slate-200">{source.name}</span>
      {nonFa && (
        <span className="rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1">
          {source.lang}
        </span>
      )}
      {onRemove && (
        <button onClick={onRemove} className="text-slate-400 hover:text-red-500 shrink-0">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ── section card (drop target for sources) ──
function SectionCard({
  section, index, total,
  onChange, onRemove, onMove, onAddSource, onRemoveSource,
}: {
  section: PackSection;
  index: number;
  total: number;
  onChange: (patch: Partial<PackSection>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onAddSource: (s: PackSource) => void;
  onRemoveSource: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [kw, setKw] = useState("");
  const [{ isOver }, drop] = useDrop(() => ({
    accept: DND_SOURCE,
    drop: (item: DragSource) => onAddSource(item.source),
    collect: (m) => ({ isOver: m.isOver() }),
  }), [onAddSource]);

  const meta = contentTypeMeta(section.contentType);
  const addKeyword = () => {
    const v = kw.trim();
    if (v && !section.keywords.includes(v)) onChange({ keywords: [...section.keywords, v] });
    setKw("");
  };

  return (
    <div
      ref={drop as any}
      className={`rounded-2xl border bg-white dark:bg-slate-800/50 transition-colors ${isOver ? "border-emerald-400 ring-2 ring-emerald-200 dark:ring-emerald-900" : "border-slate-200 dark:border-slate-700"}`}
    >
      <div className="flex items-center gap-2 p-3">
        <span className="text-lg">{meta.icon}</span>
        <input
          value={section.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="flex-1 bg-transparent font-bold text-slate-900 dark:text-slate-100 outline-none border-b border-transparent focus:border-slate-300 dark:focus:border-slate-600"
          placeholder="عنوان بخش"
        />
        <span className="text-xs text-slate-400">{faNum(section.sources.length)} منبع</span>
        <div className="flex items-center">
          <button disabled={index === 0} onClick={() => onMove(-1)} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
          <button disabled={index === total - 1} onClick={() => onMove(1)} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="p-1 text-slate-400 hover:text-slate-700">
          <Settings2 className="w-4 h-4" />
        </button>
        <button onClick={onRemove} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
      </div>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <span>نوع محتوا</span>
              <select
                value={section.contentType}
                onChange={(e) => onChange({ contentType: e.target.value })}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-800 dark:text-slate-100"
              >
                {CONTENT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <span>طول هر مطلب</span>
              <select
                value={section.itemLength}
                onChange={(e) => onChange({ itemLength: e.target.value })}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-800 dark:text-slate-100"
              >
                {ITEM_LENGTHS.map((l) => <option key={l.id} value={l.id}>{l.label} — {l.hint}</option>)}
              </select>
            </label>
          </div>

          <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span className="shrink-0">حداکثر تعداد مطلب: {faNum(section.maxItems)}</span>
            <input
              type="range" min={1} max={10} value={section.maxItems}
              onChange={(e) => onChange({ maxItems: Number(e.target.value) })}
              className="flex-1 accent-emerald-600"
            />
          </label>

          {/* keywords (topic-based selection) */}
          <div className="space-y-1">
            <div className="text-xs text-slate-500 dark:text-slate-400">فیلتر موضوعی (اختیاری)</div>
            <div className="flex flex-wrap gap-1.5">
              {section.keywords.map((k) => (
                <span key={k} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-xs">
                  {k}
                  <button onClick={() => onChange({ keywords: section.keywords.filter((x) => x !== k) })}><X className="w-3 h-3" /></button>
                </span>
              ))}
              <input
                value={kw}
                onChange={(e) => setKw(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                placeholder="کلیدواژه + Enter"
                className="min-w-[120px] flex-1 bg-transparent text-xs outline-none text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          {/* sources dropped here */}
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-2 min-h-[52px]">
            {section.sources.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-2">منابع را از کتابخانه به اینجا بکشید</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {section.sources.map((s) => (
                  <SourceChip key={s.id} source={s} fromSectionId={section.id} onRemove={() => onRemoveSource(s.id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── library sidebar ──
function LibraryPanel({ userId, onAddCustom }: { userId: string; onAddCustom: (s: PackSource) => void }) {
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState("");
  const [semQ, setSemQ] = useState("");
  const [semLoading, setSemLoading] = useState(false);
  const [semErr, setSemErr] = useState("");
  const [suggestions, setSuggestions] = useState<import("../../api").SourceSuggestion[]>([]);

  const runSemantic = async () => {
    const query = semQ.trim();
    if (!query) return;
    setSemLoading(true); setSemErr(""); setSuggestions([]);
    try {
      const res = await api.newspackSuggestSources(userId, query, libraryCatalog());
      setSuggestions(res);
      if (res.length === 0) setSemErr("منبع مرتبطی پیشنهاد نشد. عبارت را دقیق‌تر بنویسید.");
    } catch (e: any) {
      console.error("Semantic source search failed:", e);
      setSemErr(`خطا در جستجو: ${e?.message || e}`);
    } finally { setSemLoading(false); }
  };

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return SOURCE_LIBRARY;
    return SOURCE_LIBRARY.map((g) => ({
      ...g,
      sources: g.sources.filter((s) => s.name.toLowerCase().includes(t) || g.label.includes(q)),
    })).filter((g) => g.sources.length);
  }, [q]);

  const addCustom = () => {
    const det = detectSource(custom);
    if (!det) { setErr("منبع شناسایی نشد. یک آدرس معتبر (سایت، RSS، یوتیوب، توییتر/ایکس، تلگرام…) وارد کنید."); return; }
    setErr("");
    onAddCustom({ id: `src_${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}`, url: det.url, name: det.name, icon: det.icon, sourceKind: det.kind, lang: "fa" });
    setCustom("");
  };

  return (
    <div className="w-72 shrink-0 border-s border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 flex flex-col">
      <div className="p-3 border-b border-slate-200 dark:border-slate-700 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
          <Library className="w-4 h-4" /> کتابخانهٔ منابع
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute top-2.5 start-2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی منبع…" className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ps-8 pe-2 py-1.5 text-sm outline-none text-slate-800 dark:text-slate-100" />
        </div>
        {/* custom add: account or topic-based via URL/handle */}
        <div className="space-y-1">
          <div className="flex gap-1">
            <input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustom()} placeholder="افزودن منبع دلخواه (URL/حساب)" className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs outline-none text-slate-800 dark:text-slate-100" />
            <button onClick={addCustom} className="rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 px-2"><Plus className="w-4 h-4" /></button>
          </div>
          {err && <div className="text-[11px] text-red-500">{err}</div>}
          <div className="text-[11px] text-slate-400">شامل شبکه‌های اجتماعی (حساب یا موضوع)، سایت‌ها و فیدهای RSS.</div>
        </div>
        {/* semantic (AI) source search */}
        <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> جستجوی هوشمند منابع
          </div>
          <div className="flex gap-1">
            <input
              value={semQ}
              onChange={(e) => setSemQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSemantic()}
              placeholder="مثلاً: تحلیل اقتصاد کلان و بازار ارز"
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs outline-none text-slate-800 dark:text-slate-100"
            />
            <button onClick={runSemantic} disabled={semLoading} className="rounded-lg bg-emerald-600 text-white px-2 disabled:opacity-60">
              {semLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
          {semErr && <div className="text-[11px] text-red-500">{semErr}</div>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {suggestions.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> پیشنهادهای هوشمند
              <button onClick={() => setSuggestions([])} className="ms-auto text-slate-400 hover:text-red-500"><X className="w-3 h-3" /></button>
            </div>
            <div className="space-y-1.5">
              {suggestions.map((s) => (
                <div key={s.url} className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/10 p-1.5 space-y-1">
                  <SourceChip source={{ id: `sug_${s.url}`, url: s.url, name: s.name, icon: s.icon, sourceKind: s.sourceKind, lang: s.lang }} fromSectionId={null} />
                  {s.reason && <div className="text-[11px] text-slate-500 dark:text-slate-400 px-1">{s.reason}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        {filtered.map((g) => (
          <div key={g.id} className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>{g.icon}</span> {g.label}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {g.sources.map((s: LibrarySource) => (
                <SourceChip key={s.url} source={librarySourceToPackSource(s)} fromSectionId={null} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NewspackBuilder({ userId = "app" }: { userId?: string }) {
  const [packs, setPacks] = useState<NewsPack[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editions, setEditions] = useState<NewsEdition[]>([]);
  const [preview, setPreview] = useState<NewsEdition | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [showTemplates, setShowTemplates] = useState(false);
  const [notifs, setNotifs] = useState<NewspackNotif[]>([]);
  const [unread, setUnread] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [testingDelivery, setTestingDelivery] = useState(false);
  const [deliveryMsg, setDeliveryMsg] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showCollab, setShowCollab] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importToken, setImportToken] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importErr, setImportErr] = useState("");
  const saveTimer = useRef<any>(null);

  const active = packs.find((p) => p.id === activeId) || null;

  const loadNotifs = async () => {
    try { const r = await api.newspackGetNotifs(userId); setNotifs(r.notifs); setUnread(r.unread); }
    catch (e) { console.error("Failed to load newspack notifs:", e); }
  };
  useEffect(() => { loadNotifs(); }, [userId]);

  useEffect(() => { (async () => {
    try {
      const list = await api.newspackGetPacks(userId);
      setPacks(list);
      setActiveId(list[0]?.id ?? null);
    } catch (e) { console.error("Failed to load news packs:", e); }
    finally { setLoading(false); }
  })(); }, [userId]);

  useEffect(() => { (async () => {
    if (!activeId) { setEditions([]); return; }
    try { setEditions(await api.newspackGetEditions(userId, activeId)); }
    catch (e) { console.error("Failed to load editions:", e); }
  })(); }, [activeId, userId]);

  const persist = (next: NewsPack) => {
    setPacks((prev) => prev.map((p) => (p.id === next.id ? next : p)));
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const saved = await api.newspackSavePack(userId, { ...next, updatedAt: Date.now() });
        setPacks((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1500);
      } catch (e) { console.error("Failed to save pack:", e); setSaveState("idle"); }
    }, 700);
  };

  const patchActive = (patch: Partial<NewsPack>) => { if (active) persist({ ...active, ...patch }); };
  const patchSection = (sid: string, patch: Partial<PackSection>) => {
    if (!active) return;
    persist({ ...active, sections: active.sections.map((s) => (s.id === sid ? { ...s, ...patch } : s)) });
  };

  const createPack = async (build?: () => NewsPack) => {
    const p = build ? build() : newPack();
    setPacks((prev) => [p, ...prev]);
    setActiveId(p.id);
    setShowTemplates(false);
    try { await api.newspackSavePack(userId, p); } catch (e) { console.error("Failed to create pack:", e); }
  };

  const deletePack = async (id: string) => {
    setPacks((prev) => prev.filter((p) => p.id !== id));
    if (activeId === id) setActiveId((packs.find((p) => p.id !== id)?.id) ?? null);
    try { await api.newspackDeletePack(userId, id); } catch (e) { console.error("Failed to delete pack:", e); }
  };

  const generate = async () => {
    if (!active) return;
    setGenerating(true);
    try {
      const ed = await api.newspackGenerate(userId, active.id);
      setPreview(ed);
      setEditions((prev) => [ed, ...prev]);
      setPacks((prev) => prev.map((p) => (p.id === active.id ? { ...p, lastGeneratedAt: ed.generatedAt } : p)));
      loadNotifs();
    } catch (e) { console.error("Failed to generate edition:", e); alert("تولید بسته با خطا مواجه شد. کنسول را بررسی کنید."); }
    finally { setGenerating(false); }
  };

  const testDelivery = async () => {
    if (!active) return;
    setTestingDelivery(true); setDeliveryMsg(null);
    try {
      const r = await api.newspackTestDelivery(userId, active.id);
      const parts: string[] = [];
      if (r.webhook) parts.push(`وبهوک: ${r.webhook === "ok" ? "موفق ✓" : "ناموفق"}`);
      if (r.email) parts.push(`ایمیل: ${r.email === "ok" ? "موفق ✓" : "ناموفق"}`);
      setDeliveryMsg(parts.length ? parts.join(" · ") : "کانالی برای ارسال تنظیم نشده است.");
    } catch (e: any) {
      setDeliveryMsg(`خطا: ${e?.message || e}`);
    } finally {
      setTestingDelivery(false);
      setTimeout(() => setDeliveryMsg(null), 6000);
    }
  };

  const shareUrl = (token: string) => `${window.location.origin}${window.location.pathname}?np=${token}`;

  const openShare = async () => {
    setShowShare(true); setImportErr(""); setImportToken(""); setCopied(false);
    setShareToken(active?.shareToken ?? null);
  };
  const createShare = async () => {
    if (!active) return;
    setShareBusy(true);
    try {
      const token = await api.newspackShare(userId, active.id);
      setShareToken(token);
      setPacks((prev) => prev.map((p) => (p.id === active.id ? { ...p, shareToken: token } : p)));
    } catch (e) { console.error("Failed to share pack:", e); }
    finally { setShareBusy(false); }
  };
  const revokeShare = async () => {
    if (!active) return;
    setShareBusy(true);
    try {
      await api.newspackUnshare(userId, active.id);
      setShareToken(null);
      setPacks((prev) => prev.map((p) => (p.id === active.id ? { ...p, shareToken: undefined } : p)));
    } catch (e) { console.error("Failed to revoke share:", e); }
    finally { setShareBusy(false); }
  };
  const copyShare = async () => {
    if (!shareToken) return;
    try { await navigator.clipboard.writeText(shareUrl(shareToken)); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch (e) { console.error("Clipboard failed:", e); }
  };
  const importShared = async () => {
    const raw = importToken.trim();
    if (!raw) return;
    const token = raw.includes("np=") ? raw.split("np=")[1].split("&")[0] : raw;
    setImportBusy(true); setImportErr("");
    try {
      const clone = await api.newspackCloneShared(userId, token);
      setPacks((prev) => [clone, ...prev]);
      setActiveId(clone.id);
      setShowShare(false);
    } catch (e: any) {
      setImportErr(`دریافت ناموفق بود: ${e?.message || e}`);
    } finally { setImportBusy(false); }
  };

  const openNotifs = async () => {
    setShowNotifs((v) => !v);
    if (!showNotifs && unread > 0) {
      try { await api.newspackMarkNotifsRead(userId); setUnread(0); setNotifs((prev) => prev.map((n) => ({ ...n, read: true }))); }
      catch (e) { console.error("Failed to mark notifs read:", e); }
    }
  };

  const moveSection = (sid: string, dir: -1 | 1) => {
    if (!active) return;
    const secs = [...active.sections].sort((a, b) => a.order - b.order);
    const i = secs.findIndex((s) => s.id === sid);
    const j = i + dir;
    if (j < 0 || j >= secs.length) return;
    [secs[i], secs[j]] = [secs[j], secs[i]];
    persist({ ...active, sections: secs.map((s, idx) => ({ ...s, order: idx })) });
  };

  const addSourceToSection = (sid: string, src: PackSource) => {
    if (!active) return;
    const sec = active.sections.find((s) => s.id === sid);
    if (!sec || sec.sources.some((x) => x.url === src.url)) return;
    patchSection(sid, { sources: [...sec.sources, { ...src, id: `src_${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}` }] });
  };

  // persist manual reordering / pinning of a generated edition
  const updatePreview = async (next: NewsEdition) => {
    setPreview(next);
    setEditions((prev) => prev.map((e) => (e.id === next.id ? next : e)));
    try { await api.newspackUpdateEdition(userId, next.packId, next); }
    catch (e) { console.error("Failed to persist edition edit:", e); }
  };

  const orderedSections = active ? [...active.sections].sort((a, b) => a.order - b.order) : [];

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-full bg-slate-100 dark:bg-slate-950" dir="rtl">
        {/* packs rail */}
        <div className="w-56 shrink-0 border-e border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 relative">
            <Package className="w-5 h-5 text-emerald-600" />
            <span className="font-bold text-slate-800 dark:text-slate-100 flex-1">بسته‌های من</span>
            <button onClick={openNotifs} className="relative p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-100">
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{faNum(unread)}</span>
              )}
            </button>
            {showNotifs && (
              <div className="absolute top-12 end-2 z-30 w-72 max-h-80 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 px-1 pb-1">نسخه‌های تولیدشده</div>
                {notifs.length === 0 && <div className="text-xs text-slate-400 text-center py-4">هنوز اعلانی نیست.</div>}
                {notifs.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => { setActiveId(n.packId); setShowNotifs(false); }}
                    className="w-full text-start rounded-lg px-2 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                      <span>{n.trigger === "scheduled" ? "⏰" : "▶️"}</span>
                      <span className="truncate flex-1 font-medium">{n.packTitle}</span>
                      <span className="text-slate-400">{faNum(n.items)} مطلب</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(n.createdAt))}
                      {n.delivery?.email && ` · ایمیل: ${n.delivery.email === "ok" ? "✓" : "✗"}`}
                      {n.delivery?.webhook && ` · وبهوک: ${n.delivery.webhook === "ok" ? "✓" : "✗"}`}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setShowTemplates(true)} className="m-3 mb-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-white py-2 text-sm hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> بستهٔ جدید
          </button>
          <button onClick={() => { setShowShare(true); setShareToken(null); setImportErr(""); }} className="mx-3 mb-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
            <Download className="w-3.5 h-3.5" /> دریافت بستهٔ اشتراکی
          </button>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading && <div className="text-center text-sm text-slate-400 py-6"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>}
            {!loading && packs.length === 0 && <div className="text-center text-xs text-slate-400 py-6">هنوز بسته‌ای نساخته‌اید.</div>}
            {packs.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveId(p.id)}
                className={`w-full text-start rounded-lg px-2.5 py-2 text-sm flex items-center gap-2 group ${activeId === p.id ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"}`}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1">{p.title}</span>
                <Trash2 onClick={(e) => { e.stopPropagation(); deletePack(p.id); }} className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500" />
              </button>
            ))}
          </div>
        </div>

        {/* builder */}
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 gap-3">
            <Package className="w-12 h-12" />
            <p>یک بسته انتخاب کنید یا بستهٔ جدید بسازید.</p>
            <button onClick={() => setShowTemplates(true)} className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700">ساخت بستهٔ خبری</button>
          </div>
        ) : (
          <div className="flex-1 flex min-w-0">
            <div className="flex-1 overflow-y-auto min-w-0">
              {/* header / global settings */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <input
                    value={active.title}
                    onChange={(e) => patchActive({ title: e.target.value })}
                    className="text-xl font-extrabold bg-transparent outline-none text-slate-900 dark:text-slate-100 flex-1 border-b border-transparent focus:border-slate-300"
                  />
                  <span className="text-xs text-slate-400 w-16 text-center">
                    {saveState === "saving" ? "در حال ذخیره…" : saveState === "saved" ? "ذخیره شد ✓" : ""}
                  </span>
                  <button onClick={() => setShowAnalytics(true)} title="تحلیل و آمار" className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <BarChart3 className="w-4 h-4" /> آمار
                  </button>
                  <button onClick={openShare} title="اشتراک‌گذاری" className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <Share2 className="w-4 h-4" /> اشتراک
                  </button>
                  <button
                    onClick={generate}
                    disabled={generating}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {generating ? "در حال تولید…" : "تولید بسته"}
                  </button>
                </div>
                <input
                  value={active.intro || ""}
                  onChange={(e) => patchActive({ intro: e.target.value })}
                  placeholder="توضیح/سرمقالهٔ کوتاه (اختیاری)"
                  className="w-full bg-transparent text-sm text-slate-600 dark:text-slate-300 outline-none border-b border-transparent focus:border-slate-200"
                />
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> تم
                    <select value={active.theme} onChange={(e) => patchActive({ theme: e.target.value })} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-800 dark:text-slate-100">
                      {THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> بازهٔ جمع‌آوری
                    <select value={active.timespanHours} onChange={(e) => patchActive({ timespanHours: Number(e.target.value) })} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-800 dark:text-slate-100">
                      {TIMESPANS.map((t) => <option key={t.hours} value={t.hours}>{t.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5" /> تولید دوره‌ای
                    <select value={active.scheduleEveryHours} onChange={(e) => patchActive({ scheduleEveryHours: Number(e.target.value) })} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-800 dark:text-slate-100">
                      {SCHEDULES.map((s) => <option key={s.hours} value={s.hours}>{s.label}</option>)}
                    </select>
                  </label>
                  {active.scheduleEveryHours > 0 && (
                    <span className="text-xs rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 inline-flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> اجرای بعدی: {formatNextRun(nextRunAt(active))}
                    </span>
                  )}
                </div>

                {/* delivery channels */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 flex-1 min-w-[200px]">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="email"
                      value={active.deliveryEmail || ""}
                      onChange={(e) => patchActive({ deliveryEmail: e.target.value })}
                      placeholder="ایمیل تحویل (اختیاری)"
                      className="flex-1 bg-transparent text-sm outline-none text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 flex-1 min-w-[200px]">
                    <Webhook className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="url"
                      value={active.deliveryWebhookUrl || ""}
                      onChange={(e) => patchActive({ deliveryWebhookUrl: e.target.value })}
                      placeholder="آدرس وبهوک https:// (اختیاری)"
                      className="flex-1 bg-transparent text-sm outline-none text-slate-800 dark:text-slate-100 ltr:text-left"
                      dir="ltr"
                    />
                  </div>
                  <button
                    onClick={testDelivery}
                    disabled={testingDelivery || (!active.deliveryEmail && !active.deliveryWebhookUrl)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    {testingDelivery ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    ارسال آزمایشی
                  </button>
                  {deliveryMsg && <span className="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" />{deliveryMsg}</span>}
                </div>
              </div>

              {/* sections */}
              <div className="p-4 space-y-3">
                {orderedSections.map((s, i) => (
                  <SectionCard
                    key={s.id}
                    section={s}
                    index={i}
                    total={orderedSections.length}
                    onChange={(patch) => patchSection(s.id, patch)}
                    onRemove={() => patchActive({ sections: active.sections.filter((x) => x.id !== s.id).map((x, idx) => ({ ...x, order: idx })) })}
                    onMove={(dir) => moveSection(s.id, dir)}
                    onAddSource={(src) => addSourceToSection(s.id, src)}
                    onRemoveSource={(sourceId) => patchSection(s.id, { sources: s.sources.filter((x) => x.id !== sourceId) })}
                  />
                ))}
                <button
                  onClick={() => patchActive({ sections: [...active.sections, newSection(active.sections.length)] })}
                  className="w-full rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 py-3 text-sm text-slate-500 hover:border-emerald-400 hover:text-emerald-600 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> افزودن بخش
                </button>

                {/* editions history */}
                {editions.length > 0 && (
                  <div className="pt-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                      <RefreshCw className="w-4 h-4" /> نسخه‌های تولیدشده
                    </div>
                    <div className="space-y-1.5">
                      {editions.map((ed) => (
                        <button key={ed.id} onClick={() => setPreview(ed)} className="w-full text-start rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 px-3 py-2 text-xs hover:border-emerald-300 flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5 text-slate-400" />
                          <span className="flex-1 text-slate-700 dark:text-slate-200">
                            {new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ed.generatedAt))}
                          </span>
                          <span className="text-slate-400">{faNum(ed.stats.items)} مطلب</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <LibraryPanel userId={userId} onAddCustom={(src) => {
              // add custom source into the first section by default
              const first = orderedSections[0];
              if (first) addSourceToSection(first.id, src);
            }} />
          </div>
        )}

        {/* edition preview modal */}
        {preview && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 relative" onClick={(e) => e.stopPropagation()} dir="rtl">
              <button onClick={() => setPreview(null)} className="absolute top-4 end-4 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
              <div className="mb-4"><EditionActions edition={preview} userId={userId} /></div>
              <div className="mb-2 text-xs text-slate-400">می‌توانید مطالب را پین یا جابه‌جا کنید؛ تغییرات ذخیره می‌شود.</div>
              <EditionViewer edition={preview} theme={preview.theme} editable onChange={updatePreview} />
            </div>
          </div>
        )}

        {/* template picker modal */}
        {showTemplates && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowTemplates(false)}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 relative" onClick={(e) => e.stopPropagation()} dir="rtl">
              <button onClick={() => setShowTemplates(false)} className="absolute top-4 end-4 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
              <div className="flex items-center gap-2 font-extrabold text-lg text-slate-900 dark:text-slate-100 mb-1">
                <Sparkles className="w-5 h-5 text-emerald-600" /> ساخت بستهٔ جدید
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">از یک الگوی آماده شروع کنید یا بستهٔ خالی بسازید.</p>
              <div className="grid gap-2">
                {PACK_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => createPack(t.build)}
                    className="text-start rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4 hover:border-emerald-400 hover:shadow-sm transition-all flex items-start gap-3"
                  >
                    <span className="text-2xl shrink-0">{t.icon}</span>
                    <span className="min-w-0">
                      <span className="block font-bold text-slate-900 dark:text-slate-100">{t.label}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* analytics modal */}
        {showAnalytics && active && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowAnalytics(false)}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 relative" onClick={(e) => e.stopPropagation()} dir="rtl">
              <button onClick={() => setShowAnalytics(false)} className="absolute top-4 end-4 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
              <div className="flex items-center gap-2 font-extrabold text-lg text-slate-900 dark:text-slate-100 mb-4">
                <BarChart3 className="w-5 h-5 text-emerald-600" /> آمار «{active.title}»
              </div>
              <PackAnalytics userId={userId} packId={active.id} />
            </div>
          </div>
        )}

        {/* share / import modal */}
        {showShare && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowShare(false)}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 relative" onClick={(e) => e.stopPropagation()} dir="rtl">
              <button onClick={() => setShowShare(false)} className="absolute top-4 end-4 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
              <div className="flex items-center gap-2 font-extrabold text-lg text-slate-900 dark:text-slate-100 mb-4">
                <Share2 className="w-5 h-5 text-emerald-600" /> اشتراک‌گذاری و همکاری
              </div>

              {active && (
                <div className="space-y-2 mb-5">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">اشتراک‌گذاری «{active.title}»</div>
                  {shareToken ? (
                    <>
                      <div className="flex gap-1.5">
                        <input readOnly value={shareUrl(shareToken)} dir="ltr" className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200" />
                        <button onClick={copyShare} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-3 text-xs">
                          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied ? "کپی شد" : "کپی"}
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">هر کسی با این لینک می‌تواند آخرین نسخه را ببیند و یک رونوشت بسازد.</span>
                        <button onClick={revokeShare} disabled={shareBusy} className="text-red-500 hover:underline">لغو اشتراک</button>
                      </div>
                      <button onClick={() => { setShowShare(false); setShowCollab(true); }} className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm mt-1">
                        <Users className="w-4 h-4" /> ورود به همکاری زندهٔ چندنفره
                      </button>
                      <p className="text-[11px] text-slate-400">در همکاری زنده، همه با همین لینک می‌توانند هم‌زمان بسته را ویرایش کنند (نه فقط رونوشت).</p>
                    </>
                  ) : (
                    <button onClick={createShare} disabled={shareBusy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm disabled:opacity-60">
                      {shareBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} ساخت لینک اشتراکی
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">دریافت بستهٔ اشتراکی</div>
                <div className="flex gap-1.5">
                  <input
                    value={importToken}
                    onChange={(e) => setImportToken(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && importShared()}
                    placeholder="لینک یا کد اشتراکی را وارد کنید"
                    dir="ltr"
                    className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-100"
                  />
                  <button onClick={importShared} disabled={importBusy || !importToken.trim()} className="inline-flex items-center gap-1 rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 px-3 text-xs disabled:opacity-60">
                    {importBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} دریافت
                  </button>
                </div>
                {importErr && <div className="text-xs text-red-500">{importErr}</div>}
                <div className="text-[11px] text-slate-400">یک رونوشت قابل‌ویرایش از بسته در فهرست شما ساخته می‌شود.</div>
              </div>
            </div>
          </div>
        )}

        {showCollab && active?.shareToken && (
          <CollabRoom
            token={active.shareToken}
            onClose={async () => {
              setShowCollab(false);
              try {
                const list = await api.newspackGetPacks(userId);
                setPacks(list);
              } catch (e) { console.error("Failed to reload packs after collaboration:", e); }
            }}
          />
        )}
      </div>
    </DndProvider>
  );
}
