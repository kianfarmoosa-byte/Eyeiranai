import { useCallback, useEffect, useState } from "react";
import {
  Package, Plus, Trash2, Loader2, Play, ChevronLeft, X, Settings2, Clock, CalendarClock,
  Sparkles, FileText, Library, Check, RefreshCw, Globe, Mail, Webhook, Send, Bell,
  BarChart3, Share2, Download, Copy, Link2, Search,
} from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { EmptyState } from "../primitives/EmptyState";
import { useHaptics } from "../hooks";
import { faNum } from "../utils/fa";
import { api, type NewsPack, type PackSection, type PackSource, type NewsEdition, type NewspackNotif } from "../../../api";
import { detectSource } from "../../../sourceHub";
import { EditionViewer } from "../../newspack/EditionViewer";
import { EditionActions } from "../../newspack/EditionActions";
import {
  CONTENT_TYPES, ITEM_LENGTHS, THEMES, TIMESPANS, SCHEDULES, SOURCE_LIBRARY, PACK_TEMPLATES,
  contentTypeMeta, newPack, newSection, librarySourceToPackSource, libraryCatalog, nextRunAt, formatNextRun, type LibrarySource,
} from "../../newspack/newspackModel";
import { PackAnalytics } from "../../newspack/PackAnalytics";
import { CollabRoom } from "../../newspack/CollabRoom";
import { Users } from "lucide-react";

type Props = { onClose: () => void };
type View = "list" | "edit";

export function NewspackScreen({ onClose }: Props) {
  const haptic = useHaptics();
  const [packs, setPacks] = useState<NewsPack[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editions, setEditions] = useState<NewsEdition[]>([]);
  const [preview, setPreview] = useState<NewsEdition | null>(null);
  const [sourcePickerFor, setSourcePickerFor] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [notifs, setNotifs] = useState<NewspackNotif[]>([]);
  const [unread, setUnread] = useState(0);
  const [testingDelivery, setTestingDelivery] = useState(false);
  const [deliveryMsg, setDeliveryMsg] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [importToken, setImportToken] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importErr, setImportErr] = useState("");
  const [showCollab, setShowCollab] = useState(false);

  const active = packs.find((p) => p.id === activeId) || null;

  const loadNotifs = useCallback(async () => {
    try { const r = await api.newspackGetNotifs("app"); setNotifs(r.notifs); setUnread(r.unread); }
    catch (e) { console.log("mobile newspack notifs error:", e); }
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    try { setPacks(await api.newspackGetPacks("app")); }
    catch (e) { console.log("mobile newspack load error:", e); }
    finally { setLoading(false); }
    loadNotifs();
  }, [loadNotifs]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => { (async () => {
    if (!activeId) { setEditions([]); return; }
    try { setEditions(await api.newspackGetEditions("app", activeId)); }
    catch (e) { console.log("mobile editions error:", e); }
  })(); }, [activeId]);

  const save = async (next: NewsPack) => {
    setPacks((prev) => prev.map((p) => (p.id === next.id ? next : p)));
    try {
      const saved = await api.newspackSavePack("app", { ...next, updatedAt: Date.now() });
      setPacks((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
    } catch (e) { console.log("mobile save error:", e); }
  };
  const patchActive = (patch: Partial<NewsPack>) => { if (active) save({ ...active, ...patch }); };
  const patchSection = (sid: string, patch: Partial<PackSection>) => {
    if (!active) return;
    save({ ...active, sections: active.sections.map((s) => (s.id === sid ? { ...s, ...patch } : s)) });
  };

  const createPack = async (build?: () => NewsPack) => {
    haptic?.("tap");
    const p = build ? build() : newPack();
    setPacks((prev) => [p, ...prev]);
    setActiveId(p.id);
    setView("edit");
    setShowTemplates(false);
    try { await api.newspackSavePack("app", p); } catch (e) { console.log("mobile create error:", e); }
  };
  const deletePack = async (id: string) => {
    setPacks((prev) => prev.filter((p) => p.id !== id));
    try { await api.newspackDeletePack("app", id); } catch (e) { console.log("mobile delete error:", e); }
  };
  const generate = async () => {
    if (!active) return;
    setGenerating(true); haptic?.("select");
    try {
      const ed = await api.newspackGenerate("app", active.id);
      setPreview(ed); setEditions((prev) => [ed, ...prev]);
      setPacks((prev) => prev.map((p) => (p.id === active.id ? { ...p, lastGeneratedAt: ed.generatedAt } : p)));
      loadNotifs();
    } catch (e) { console.log("mobile generate error:", e); }
    finally { setGenerating(false); }
  };

  const testDelivery = async () => {
    if (!active) return;
    setTestingDelivery(true); setDeliveryMsg(null); haptic?.("tap");
    try {
      const r = await api.newspackTestDelivery("app", active.id);
      const parts: string[] = [];
      if (r.webhook) parts.push(`وبهوک: ${r.webhook === "ok" ? "✓" : "✗"}`);
      if (r.email) parts.push(`ایمیل: ${r.email === "ok" ? "✓" : "✗"}`);
      setDeliveryMsg(parts.length ? parts.join(" · ") : "کانالی تنظیم نشده است.");
    } catch (e: any) { setDeliveryMsg(`خطا: ${e?.message || e}`); }
    finally { setTestingDelivery(false); setTimeout(() => setDeliveryMsg(null), 6000); }
  };

  const updatePreview = async (next: NewsEdition) => {
    setPreview(next);
    setEditions((prev) => prev.map((e) => (e.id === next.id ? next : e)));
    try { await api.newspackUpdateEdition("app", next.packId, next); }
    catch (e) { console.log("mobile edition edit error:", e); }
  };

  const shareUrl = (token: string) => `${window.location.origin}${window.location.pathname}?np=${token}`;
  const openShare = () => { setShowShare(true); setImportErr(""); setImportToken(""); setShareToken(active?.shareToken ?? null); };
  const createShare = async () => {
    if (!active) return;
    setShareBusy(true);
    try {
      const token = await api.newspackShare("app", active.id);
      setShareToken(token);
      setPacks((prev) => prev.map((p) => (p.id === active.id ? { ...p, shareToken: token } : p)));
    } catch (e) { console.log("mobile share error:", e); }
    finally { setShareBusy(false); }
  };
  const importShared = async () => {
    const raw = importToken.trim();
    if (!raw) return;
    const token = raw.includes("np=") ? raw.split("np=")[1].split("&")[0] : raw;
    setImportBusy(true); setImportErr("");
    try {
      const clone = await api.newspackCloneShared("app", token);
      setPacks((prev) => [clone, ...prev]);
      setActiveId(clone.id); setView("edit"); setShowShare(false);
    } catch (e: any) { setImportErr(`دریافت ناموفق بود: ${e?.message || e}`); }
    finally { setImportBusy(false); }
  };

  const addSource = (sid: string, src: PackSource) => {
    if (!active) return;
    const sec = active.sections.find((s) => s.id === sid);
    if (!sec || sec.sources.some((x) => x.url === src.url)) return;
    patchSection(sid, { sources: [...sec.sources, { ...src, id: `src_${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}` }] });
  };
  const moveSection = (sid: string, dir: -1 | 1) => {
    if (!active) return;
    const secs = [...active.sections].sort((a, b) => a.order - b.order);
    const i = secs.findIndex((s) => s.id === sid);
    const j = i + dir;
    if (j < 0 || j >= secs.length) return;
    [secs[i], secs[j]] = [secs[j], secs[i]];
    save({ ...active, sections: secs.map((s, idx) => ({ ...s, order: idx })) });
  };

  // ── list view ──
  if (view === "list") {
    return (
      <MobileScreen topbar={<MobileTopBar title="بسته‌های خبری سفارشی" onBack={onClose} onRefresh={load} loading={loading} />}>
        <div className="p-3 space-y-2">
          <button onClick={() => { haptic?.("tap"); setShowTemplates(true); }} className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white py-3 font-semibold">
            <Plus className="size-5" /> بستهٔ خبری جدید
          </button>
          {notifs.length > 0 && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] overflow-hidden">
              <button
                onClick={async () => { if (unread > 0) { try { await api.newspackMarkNotifsRead("app"); setUnread(0); setNotifs((p) => p.map((n) => ({ ...n, read: true }))); } catch (e) { console.log("mobile mark read error:", e); } } }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm border-b border-[var(--border-subtle)]"
              >
                <Bell className="size-4 text-emerald-600" />
                <span className="font-semibold flex-1 text-start">نسخه‌های تولیدشده</span>
                {unread > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{faNum(unread)}</span>}
              </button>
              <div className="max-h-48 overflow-y-auto">
                {notifs.slice(0, 8).map((n) => (
                  <button key={n.id} onClick={() => { setActiveId(n.packId); setView("edit"); }} className="w-full text-start px-3 py-2 text-xs border-b border-[var(--border-subtle)] last:border-0">
                    <div className="flex items-center gap-1.5">
                      <span>{n.trigger === "scheduled" ? "⏰" : "▶️"}</span>
                      <span className="truncate flex-1 font-medium">{n.packTitle}</span>
                      <span className="text-[var(--foreground-subtle)]">{faNum(n.items)} مطلب</span>
                    </div>
                    <div className="text-[11px] text-[var(--foreground-subtle)] mt-0.5">
                      {new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(n.createdAt))}
                      {n.delivery?.email && ` · ایمیل ${n.delivery.email === "ok" ? "✓" : "✗"}`}
                      {n.delivery?.webhook && ` · وبهوک ${n.delivery.webhook === "ok" ? "✓" : "✗"}`}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {loading && <div className="py-10 text-center"><Loader2 className="size-6 animate-spin mx-auto text-[var(--foreground-subtle)]" /></div>}
          {!loading && packs.length === 0 && (
            <EmptyState icon={<Package className="size-8" />} title="هنوز بسته‌ای نساخته‌اید" description="یک بستهٔ خبری سفارشی با بخش‌ها، منابع و زمان‌بندی دلخواه بسازید." />
          )}
          {packs.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] p-3">
              <button onClick={() => { setActiveId(p.id); setView("edit"); haptic?.("tap"); }} className="flex-1 flex items-center gap-2 min-w-0 text-start">
                <FileText className="size-5 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold truncate">{p.title}</div>
                  <div className="text-xs text-[var(--foreground-subtle)]">{faNum(p.sections.length)} بخش · {p.scheduleEveryHours > 0 ? "زمان‌بندی فعال" : "دستی"}</div>
                </div>
              </button>
              <button onClick={() => deletePack(p.id)} className="p-2 text-[var(--foreground-subtle)] hover:text-red-500"><Trash2 className="size-4" /></button>
              <ChevronLeft className="size-4 text-[var(--foreground-subtle)]" />
            </div>
          ))}
        </div>
        {showTemplates && (
          <div className="fixed inset-0 z-[var(--z-mobile-reader)] bg-black/40 flex items-end" onClick={() => setShowTemplates(false)}>
            <div className="w-full max-h-[80vh] rounded-t-2xl bg-[var(--background)] flex flex-col" onClick={(e) => e.stopPropagation()} dir="rtl">
              <div className="p-3 border-b border-[var(--border-subtle)] flex items-center gap-2">
                <Sparkles className="size-5 text-emerald-600" /><span className="font-bold flex-1">ساخت بستهٔ جدید</span>
                <button onClick={() => setShowTemplates(false)} className="p-1 text-[var(--foreground-subtle)]"><X className="size-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {PACK_TEMPLATES.map((t) => (
                  <button key={t.id} onClick={() => createPack(t.build)} className="w-full text-start rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] p-3 flex items-start gap-3">
                    <span className="text-2xl shrink-0">{t.icon}</span>
                    <span className="min-w-0">
                      <span className="block font-bold">{t.label}</span>
                      <span className="block text-xs text-[var(--foreground-subtle)] mt-0.5">{t.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </MobileScreen>
    );
  }

  // ── edit view ──
  if (!active) { setView("list"); return null; }
  const ordered = [...active.sections].sort((a, b) => a.order - b.order);

  return (
    <MobileScreen
      topbar={<MobileTopBar title={active.title} onBack={() => setView("list")} />}
      footer={
        <div className="border-t border-[var(--border-subtle)] bg-[var(--background)] p-3" style={{ paddingBottom: "calc(12px + var(--safe-bottom))" }}>
          <button onClick={generate} disabled={generating} className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white py-3 font-semibold disabled:opacity-60">
            {generating ? <Loader2 className="size-5 animate-spin" /> : <Play className="size-5" />}
            {generating ? "در حال تولید…" : "تولید بسته"}
          </button>
        </div>
      }
      withBottomNav={false}
    >
      <div className="p-3 space-y-3 overflow-y-auto h-full">
        {/* pack settings */}
        <input value={active.title} onChange={(e) => patchActive({ title: e.target.value })} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] px-3 py-2 font-bold" />
        <input value={active.intro || ""} onChange={(e) => patchActive({ intro: e.target.value })} placeholder="سرمقالهٔ کوتاه (اختیاری)" className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] px-3 py-2 text-sm" />
        <div className="grid grid-cols-1 gap-2">
          <label className="text-xs text-[var(--foreground-subtle)] flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] px-3 py-2">
            <span className="flex items-center gap-1.5"><Sparkles className="size-4" /> تم</span>
            <select value={active.theme} onChange={(e) => patchActive({ theme: e.target.value })} className="bg-transparent text-sm text-[var(--foreground)]">
              {THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-[var(--foreground-subtle)] flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] px-3 py-2">
            <span className="flex items-center gap-1.5"><Clock className="size-4" /> بازهٔ جمع‌آوری</span>
            <select value={active.timespanHours} onChange={(e) => patchActive({ timespanHours: Number(e.target.value) })} className="bg-transparent text-sm text-[var(--foreground)]">
              {TIMESPANS.map((t) => <option key={t.hours} value={t.hours}>{t.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-[var(--foreground-subtle)] flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] px-3 py-2">
            <span className="flex items-center gap-1.5"><CalendarClock className="size-4" /> تولید دوره‌ای</span>
            <select value={active.scheduleEveryHours} onChange={(e) => patchActive({ scheduleEveryHours: Number(e.target.value) })} className="bg-transparent text-sm text-[var(--foreground)]">
              {SCHEDULES.map((s) => <option key={s.hours} value={s.hours}>{s.label}</option>)}
            </select>
          </label>
          {active.scheduleEveryHours > 0 && (
            <div className="text-xs rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-3 py-2 flex items-center gap-1.5">
              <RefreshCw className="size-3.5" /> اجرای بعدی: {formatNextRun(nextRunAt(active))}
            </div>
          )}
          <label className="text-xs text-[var(--foreground-subtle)] flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] px-3 py-2">
            <Mail className="size-4 shrink-0" />
            <input type="email" value={active.deliveryEmail || ""} onChange={(e) => patchActive({ deliveryEmail: e.target.value })} placeholder="ایمیل تحویل (اختیاری)" className="flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none" />
          </label>
          <label className="text-xs text-[var(--foreground-subtle)] flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] px-3 py-2">
            <Webhook className="size-4 shrink-0" />
            <input type="url" dir="ltr" value={active.deliveryWebhookUrl || ""} onChange={(e) => patchActive({ deliveryWebhookUrl: e.target.value })} placeholder="https:// وبهوک (اختیاری)" className="flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none text-left" />
          </label>
          {(active.deliveryEmail || active.deliveryWebhookUrl) && (
            <button onClick={testDelivery} disabled={testingDelivery} className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] py-2 text-xs text-[var(--foreground)] disabled:opacity-50">
              {testingDelivery ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} ارسال آزمایشی
            </button>
          )}
          {deliveryMsg && <div className="text-xs text-[var(--foreground-subtle)] text-center">{deliveryMsg}</div>}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setShowAnalytics(true)} className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] py-2 text-xs text-[var(--foreground)]">
              <BarChart3 className="size-4" /> آمار
            </button>
            <button onClick={openShare} className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] py-2 text-xs text-[var(--foreground)]">
              <Share2 className="size-4" /> اشتراک
            </button>
          </div>
        </div>

        {/* sections */}
        {ordered.map((s, i) => (
          <MobileSectionCard
            key={s.id}
            section={s} index={i} total={ordered.length}
            onChange={(patch) => patchSection(s.id, patch)}
            onRemove={() => patchActive({ sections: active.sections.filter((x) => x.id !== s.id).map((x, idx) => ({ ...x, order: idx })) })}
            onMove={(dir) => moveSection(s.id, dir)}
            onOpenPicker={() => setSourcePickerFor(s.id)}
            onRemoveSource={(id) => patchSection(s.id, { sources: s.sources.filter((x) => x.id !== id) })}
          />
        ))}
        <button onClick={() => patchActive({ sections: [...active.sections, newSection(active.sections.length)] })} className="w-full rounded-xl border-2 border-dashed border-[var(--border-subtle)] py-3 text-sm text-[var(--foreground-subtle)] flex items-center justify-center gap-1.5">
          <Plus className="size-4" /> افزودن بخش
        </button>

        {editions.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center gap-1.5 text-sm font-bold mb-2"><RefreshCw className="size-4" /> نسخه‌های تولیدشده</div>
            <div className="space-y-1.5">
              {editions.map((ed) => (
                <button key={ed.id} onClick={() => setPreview(ed)} className="w-full text-start rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] px-3 py-2 text-xs flex items-center gap-2">
                  <Globe className="size-3.5 text-[var(--foreground-subtle)]" />
                  <span className="flex-1">{new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ed.generatedAt))}</span>
                  <span className="text-[var(--foreground-subtle)]">{faNum(ed.stats.items)} مطلب</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* source picker sheet */}
      {sourcePickerFor && (
        <SourcePickerSheet
          onClose={() => setSourcePickerFor(null)}
          existing={active.sections.find((s) => s.id === sourcePickerFor)?.sources || []}
          onPick={(src) => addSource(sourcePickerFor, src)}
        />
      )}

      {/* edition preview */}
      {preview && (
        <div className="fixed inset-0 z-[var(--z-mobile-reader)] bg-[var(--background)] flex flex-col" dir="rtl">
          <MobileTopBar title="پیش‌نمایش بسته" onBack={() => setPreview(null)} />
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <EditionActions edition={preview} userId="app" />
            <EditionViewer edition={preview} theme={preview.theme} editable onChange={updatePreview} />
          </div>
        </div>
      )}

      {/* analytics overlay */}
      {showAnalytics && active && (
        <div className="fixed inset-0 z-[var(--z-mobile-reader)] bg-[var(--background)] flex flex-col" dir="rtl">
          <MobileTopBar title="تحلیل و آمار بسته" onBack={() => setShowAnalytics(false)} />
          <div className="flex-1 overflow-y-auto p-4">
            <PackAnalytics userId="app" packId={active.id} />
          </div>
        </div>
      )}

      {/* share / import sheet */}
      {showShare && active && (
        <div className="fixed inset-0 z-[var(--z-mobile-reader)] bg-black/40 flex items-end" onClick={() => setShowShare(false)}>
          <div className="w-full max-h-[80vh] rounded-t-2xl bg-[var(--background)] flex flex-col" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="p-3 border-b border-[var(--border-subtle)] flex items-center gap-2">
              <Share2 className="size-5 text-emerald-600" /><span className="font-bold flex-1">اشتراک‌گذاری و همکاری</span>
              <button onClick={() => setShowShare(false)} className="p-1 text-[var(--foreground-subtle)]"><X className="size-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-semibold flex items-center gap-1.5"><Link2 className="size-4" /> پیوند اشتراکی این بسته</div>
                {shareToken ? (
                  <>
                    <div className="flex gap-1.5">
                      <input readOnly dir="ltr" value={shareUrl(shareToken)} className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] px-2 py-2 text-xs text-left" />
                      <button onClick={() => { navigator.clipboard?.writeText(shareUrl(shareToken)); haptic?.("success"); }} className="rounded-lg bg-emerald-600 text-white px-3"><Copy className="size-4" /></button>
                    </div>
                    <p className="text-xs text-[var(--foreground-subtle)]">هرکس این پیوند را داشته باشد می‌تواند آخرین نسخه را ببیند و یک رونوشت برای خود بسازد.</p>
                    <button onClick={() => { setShowShare(false); setShowCollab(true); }} className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-white py-2.5 text-sm">
                      <Users className="size-4" /> ورود به همکاری زنده
                    </button>
                    <button onClick={async () => { setShareBusy(true); try { await api.newspackUnshare("app", active.id); setShareToken(null); setPacks((prev) => prev.map((p) => (p.id === active.id ? { ...p, shareToken: undefined } : p))); } catch (e) { console.log("mobile unshare error:", e); } finally { setShareBusy(false); } }} disabled={shareBusy} className="text-xs text-red-500 disabled:opacity-50">لغو اشتراک‌گذاری</button>
                  </>
                ) : (
                  <button onClick={createShare} disabled={shareBusy} className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-white py-2.5 text-sm disabled:opacity-60">
                    {shareBusy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />} ساخت پیوند اشتراکی
                  </button>
                )}
              </div>
              <div className="border-t border-[var(--border-subtle)] pt-3 space-y-2">
                <div className="text-sm font-semibold flex items-center gap-1.5"><Download className="size-4" /> دریافت بستهٔ اشتراکی</div>
                <div className="flex gap-1.5">
                  <input value={importToken} onChange={(e) => setImportToken(e.target.value)} dir="ltr" placeholder="پیوند یا کد اشتراک" className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] px-2 py-2 text-xs text-left" />
                  <button onClick={importShared} disabled={importBusy || !importToken.trim()} className="rounded-lg bg-emerald-600 text-white px-3 disabled:opacity-50">{importBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}</button>
                </div>
                {importErr && <div className="text-xs text-red-500">{importErr}</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* live collaboration room */}
      {showCollab && active?.shareToken && (
        <CollabRoom token={active.shareToken} onClose={() => { setShowCollab(false); load(); }} />
      )}
    </MobileScreen>
  );
}

function MobileSectionCard({
  section, index, total, onChange, onRemove, onMove, onOpenPicker, onRemoveSource,
}: {
  section: PackSection; index: number; total: number;
  onChange: (p: Partial<PackSection>) => void; onRemove: () => void; onMove: (d: -1 | 1) => void;
  onOpenPicker: () => void; onRemoveSource: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kw, setKw] = useState("");
  const meta = contentTypeMeta(section.contentType);
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--card)]">
      <div className="flex items-center gap-2 p-3">
        <span>{meta.icon}</span>
        <input value={section.title} onChange={(e) => onChange({ title: e.target.value })} className="flex-1 bg-transparent font-semibold outline-none" />
        <button onClick={() => onMove(-1)} disabled={index === 0} className="text-[var(--foreground-subtle)] disabled:opacity-30 px-1">▲</button>
        <button onClick={() => onMove(1)} disabled={index === total - 1} className="text-[var(--foreground-subtle)] disabled:opacity-30 px-1">▼</button>
        <button onClick={() => setOpen((o) => !o)} className="p-1 text-[var(--foreground-subtle)]"><Settings2 className="size-4" /></button>
        <button onClick={onRemove} className="p-1 text-[var(--foreground-subtle)] hover:text-red-500"><Trash2 className="size-4" /></button>
      </div>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-[var(--border-subtle)] pt-2">
          <label className="text-xs text-[var(--foreground-subtle)] flex items-center justify-between">
            نوع محتوا
            <select value={section.contentType} onChange={(e) => onChange({ contentType: e.target.value })} className="bg-transparent text-sm text-[var(--foreground)]">
              {CONTENT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-[var(--foreground-subtle)] flex items-center justify-between">
            طول مطلب
            <select value={section.itemLength} onChange={(e) => onChange({ itemLength: e.target.value })} className="bg-transparent text-sm text-[var(--foreground)]">
              {ITEM_LENGTHS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-[var(--foreground-subtle)] flex items-center gap-2">
            <span className="shrink-0">حداکثر: {faNum(section.maxItems)}</span>
            <input type="range" min={1} max={10} value={section.maxItems} onChange={(e) => onChange({ maxItems: Number(e.target.value) })} className="flex-1 accent-emerald-600" />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {section.keywords.map((k) => (
              <span key={k} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-xs">
                {k}<button onClick={() => onChange({ keywords: section.keywords.filter((x) => x !== k) })}><X className="size-3" /></button>
              </span>
            ))}
            <input value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { const v = kw.trim(); if (v && !section.keywords.includes(v)) onChange({ keywords: [...section.keywords, v] }); setKw(""); } }} placeholder="کلیدواژه + Enter" className="min-w-[110px] flex-1 bg-transparent text-xs outline-none border-b border-[var(--border-subtle)]" />
          </div>
        </div>
      )}
      <div className="px-3 pb-3">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {section.sources.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs">
              <span>{s.icon || "🔗"}</span><span className="truncate max-w-[120px]">{s.name}</span>
              {s.lang && s.lang !== "fa" && <span className="rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1">{s.lang}</span>}
              <button onClick={() => onRemoveSource(s.id)}><X className="size-3" /></button>
            </span>
          ))}
        </div>
        <button onClick={onOpenPicker} className="w-full rounded-lg border border-dashed border-[var(--border-subtle)] py-2 text-xs text-[var(--foreground-subtle)] flex items-center justify-center gap-1.5">
          <Library className="size-4" /> افزودن منبع ({faNum(section.sources.length)})
        </button>
      </div>
    </div>
  );
}

function SourcePickerSheet({
  onClose, onPick, existing,
}: { onClose: () => void; onPick: (s: PackSource) => void; existing: PackSource[] }) {
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState("");
  const [semQ, setSemQ] = useState("");
  const [semBusy, setSemBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<import("../../../api").SourceSuggestion[]>([]);
  const has = (url: string) => existing.some((e) => e.url === url);

  const addCustom = () => {
    const det = detectSource(custom);
    if (!det) { setErr("منبع شناسایی نشد."); return; }
    setErr("");
    onPick({ id: `src_${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}`, url: det.url, name: det.name, icon: det.icon, sourceKind: det.kind, lang: "fa" });
    setCustom("");
  };

  const runSemantic = async () => {
    const q = semQ.trim();
    if (!q) return;
    setSemBusy(true);
    try { setSuggestions(await api.newspackSuggestSources("app", q, libraryCatalog())); }
    catch (e) { console.log("mobile semantic search error:", e); }
    finally { setSemBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[var(--z-mobile-reader)] bg-black/40 flex items-end" onClick={onClose}>
      <div className="w-full max-h-[80vh] rounded-t-2xl bg-[var(--background)] flex flex-col" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="p-3 border-b border-[var(--border-subtle)] flex items-center gap-2">
          <Library className="size-5" /><span className="font-bold flex-1">افزودن منبع</span>
          <button onClick={onClose} className="p-1 text-[var(--foreground-subtle)]"><X className="size-5" /></button>
        </div>
        <div className="p-3 border-b border-[var(--border-subtle)] space-y-1">
          <div className="flex gap-1.5">
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="URL/حساب اجتماعی/RSS دلخواه" className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] px-2 py-2 text-sm" />
            <button onClick={addCustom} className="rounded-lg bg-emerald-600 text-white px-3"><Plus className="size-4" /></button>
          </div>
          {err && <div className="text-xs text-red-500">{err}</div>}
          <div className="flex gap-1.5 pt-1">
            <input value={semQ} onChange={(e) => setSemQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runSemantic(); }} placeholder="جستجوی معنایی منابع (مثلاً: اقتصاد کلان ایران)" className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] px-2 py-2 text-sm" />
            <button onClick={runSemantic} disabled={semBusy || !semQ.trim()} className="rounded-lg bg-emerald-600 text-white px-3 disabled:opacity-50">{semBusy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {suggestions.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Sparkles className="size-3.5" /> پیشنهاد هوشمند</div>
              {suggestions.map((s) => {
                const added = has(s.url);
                return (
                  <button key={s.url} disabled={added} onClick={() => onPick({ id: `src_${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}`, url: s.url, name: s.name, icon: s.icon, sourceKind: s.sourceKind, lang: s.lang })}
                    className={`w-full text-start rounded-lg border p-2 ${added ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30" : "border-[var(--border-subtle)] bg-[var(--card)]"}`}>
                    <div className="flex items-center gap-1.5 text-sm">
                      <span>{s.icon || "🔗"}</span><span className="font-medium truncate flex-1">{s.name}</span>
                      {s.lang && s.lang !== "fa" && <span className="rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1 text-xs">{s.lang}</span>}
                      {added ? <Check className="size-3.5 text-emerald-600" /> : <Plus className="size-3.5" />}
                    </div>
                    {s.reason && <div className="text-[11px] text-[var(--foreground-subtle)] mt-0.5">{s.reason}</div>}
                  </button>
                );
              })}
            </div>
          )}
          {SOURCE_LIBRARY.map((g) => (
            <div key={g.id} className="space-y-1.5">
              <div className="text-xs font-semibold text-[var(--foreground-subtle)] flex items-center gap-1"><span>{g.icon}</span> {g.label}</div>
              <div className="flex flex-wrap gap-1.5">
                {g.sources.map((s: LibrarySource) => {
                  const added = has(s.url);
                  return (
                    <button key={s.url} disabled={added} onClick={() => onPick(librarySourceToPackSource(s))}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs ${added ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" : "border-[var(--border-subtle)] bg-[var(--card)]"}`}>
                      <span>{s.icon}</span><span className="truncate max-w-[120px]">{s.name}</span>
                      {s.lang !== "fa" && <span className="rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1">{s.lang}</span>}
                      {added ? <Check className="size-3" /> : <Plus className="size-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
