import { useCallback, useEffect, useRef, useState } from "react";
import {
  Users, X, Loader2, Plus, Trash2, Settings2, Sparkles, Clock, CalendarClock,
  Library, Check, Wifi, WifiOff, Pencil, PencilLine,
} from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { api, type NewsPack, type PackSection, type PackSource } from "../../api";
import { getSupabase } from "../../supabaseClient";
import { detectSource } from "../../sourceHub";
import { faNum } from "../mobile/utils/fa";
import {
  CONTENT_TYPES, ITEM_LENGTHS, THEMES, TIMESPANS, SCHEDULES, SOURCE_LIBRARY,
  contentTypeMeta, newSection, librarySourceToPackSource, type LibrarySource,
} from "./newspackModel";

// a live participant, derived from Realtime presence
type Peer = { clientId: string; name: string; color: string; editingSection: string | null };

const PEER_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
function colorFor(clientId: string): string {
  let h = 0;
  for (let i = 0; i < clientId.length; i++) h = (h * 31 + clientId.charCodeAt(i)) >>> 0;
  return PEER_COLORS[h % PEER_COLORS.length];
}

// A stable per-browser client id so presence survives reloads within a session.
function getClientId(): string {
  const KEY = "newspack_collab_client";
  try {
    let v = localStorage.getItem(KEY);
    if (!v) { v = `cl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`; localStorage.setItem(KEY, v); }
    return v;
  } catch { return `cl_${Math.random().toString(36).slice(2, 10)}`; }
}
function getSavedName(): string {
  try { return localStorage.getItem("newspack_collab_name") || ""; } catch { return ""; }
}
function saveName(n: string) { try { localStorage.setItem("newspack_collab_name", n); } catch { /* ignore */ } }

const uid = () => `src_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/**
 * Live, multi-user editing of a single shared pack (not a fork).
 * All participants join the same room (keyed by the pack's share token),
 * edits sync via versioned last-writer-wins, and presence shows who's here.
 */
export function CollabRoom({ token, onClose }: { token: string; onClose: () => void }) {
  const clientIdRef = useRef(getClientId());
  const [name, setName] = useState(getSavedName() || "همکار");
  const nameRef = useRef(name);
  nameRef.current = name;

  const [pack, setPack] = useState<NewsPack | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [lastEditorName, setLastEditorName] = useState("");
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");
  const [errMsg, setErrMsg] = useState("");
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const versionRef = useRef(0);      // latest version we've adopted/synced
  const dirtyRef = useRef(false);    // we have local edits not yet pushed
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const packRef = useRef<NewsPack | null>(null);
  packRef.current = pack;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const editingSectionRef = useRef<string | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // adopt a pack snapshot broadcast (or fetched) from a peer
  const adopt = useCallback((snap: { pack: NewsPack; version: number; lastEditorName?: string }) => {
    setLastEditorName(snap.lastEditorName || "");
    if (snap.version > versionRef.current) {
      versionRef.current = snap.version;
      // don't clobber our own in-flight edit; our pending save will win next
      if (!dirtyRef.current) setPack(snap.pack);
    }
  }, []);

  // push our presence state (name + which section we're editing) onto the channel
  const track = useCallback(() => {
    channelRef.current?.track({
      clientId: clientIdRef.current,
      name: nameRef.current,
      color: colorFor(clientIdRef.current),
      editingSection: editingSectionRef.current,
    });
  }, []);

  // ── Realtime: presence (who's here + per-section focus) + broadcast (live edits) ──
  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase.channel(`newspack:collab:${token}`, {
      config: { presence: { key: clientIdRef.current }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, any[]>;
      const others: Peer[] = [];
      for (const key of Object.keys(state)) {
        if (key === clientIdRef.current) continue;
        const meta = state[key][0] || {};
        others.push({
          clientId: key,
          name: meta.name || "مهمان",
          color: meta.color || colorFor(key),
          editingSection: meta.editingSection ?? null,
        });
      }
      setPeers(others);
    });

    channel.on("broadcast", { event: "pack" }, ({ payload }) => {
      adopt(payload as { pack: NewsPack; version: number; lastEditorName?: string });
    });

    channel.subscribe(async (st) => {
      if (st === "SUBSCRIBED") {
        try {
          const snap = await api.newspackCollabJoin(token, clientIdRef.current, nameRef.current);
          versionRef.current = snap.version;
          setPack(snap.pack);
          setLastEditorName(snap.lastEditorName || "");
          setStatus("live");
          track();
        } catch (e: any) { setStatus("error"); setErrMsg(e?.message || String(e)); }
      } else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") {
        setStatus("error"); setErrMsg("اتصال زندهٔ همکاری برقرار نشد.");
      }
    });

    return () => {
      const cid = clientIdRef.current;
      api.newspackCollabLeave(token, cid).catch(() => {});
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [token, adopt, track]);

  // slow reconciliation fallback — catches any missed broadcast if a client
  // was briefly offline; Realtime is the primary, low-latency path.
  useEffect(() => {
    if (status === "error") return;
    const t = setInterval(async () => {
      try {
        const snap = await api.newspackCollabGet(token, clientIdRef.current, nameRef.current);
        adopt(snap);
      } catch { /* ignore transient */ }
    }, 15000);
    return () => clearInterval(t);
  }, [token, status, adopt]);

  const setEditing = useCallback((sectionId: string | null) => {
    if (blurTimer.current) { clearTimeout(blurTimer.current); blurTimer.current = null; }
    const apply = () => { editingSectionRef.current = sectionId; track(); };
    if (sectionId === null) {
      // debounce clearing so quickly moving between fields in a section doesn't flicker
      blurTimer.current = setTimeout(apply, 400);
    } else { apply(); }
  }, [track]);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const p = packRef.current;
      if (!p) return;
      try {
        const snap = await api.newspackCollabSave(token, clientIdRef.current, nameRef.current, p);
        versionRef.current = snap.version;
        dirtyRef.current = false;
        setLastEditorName(snap.lastEditorName || "");
        setStatus("live");
        // instantly notify peers over Realtime (no wait for their poll)
        channelRef.current?.send({
          type: "broadcast", event: "pack",
          payload: { pack: snap.pack, version: snap.version, lastEditorName: nameRef.current },
        });
      } catch (e: any) { setStatus("error"); setErrMsg(e?.message || String(e)); }
    }, 650);
  }, [token]);

  const edit = useCallback((mut: (p: NewsPack) => NewsPack) => {
    setPack((prev) => (prev ? mut(prev) : prev));
    scheduleSave();
  }, [scheduleSave]);

  const patch = (p: Partial<NewsPack>) => edit((cur) => ({ ...cur, ...p }));
  const patchSection = (sid: string, sp: Partial<PackSection>) =>
    edit((cur) => ({ ...cur, sections: cur.sections.map((s) => (s.id === sid ? { ...s, ...sp } : s)) }));
  const addSection = () => edit((cur) => ({ ...cur, sections: [...cur.sections, newSection(cur.sections.length)] }));
  const removeSection = (sid: string) =>
    edit((cur) => ({ ...cur, sections: cur.sections.filter((s) => s.id !== sid).map((s, i) => ({ ...s, order: i })) }));
  const moveSection = (sid: string, dir: -1 | 1) => edit((cur) => {
    const secs = [...cur.sections].sort((a, b) => a.order - b.order);
    const i = secs.findIndex((s) => s.id === sid);
    const j = i + dir;
    if (j < 0 || j >= secs.length) return cur;
    [secs[i], secs[j]] = [secs[j], secs[i]];
    return { ...cur, sections: secs.map((s, idx) => ({ ...s, order: idx })) };
  });
  const addSource = (sid: string, src: PackSource) => edit((cur) => ({
    ...cur,
    sections: cur.sections.map((s) => {
      if (s.id !== sid || s.sources.some((x) => x.url === src.url)) return s;
      return { ...s, sources: [...s.sources, { ...src, id: uid() }] };
    }),
  }));
  const removeSource = (sid: string, srcId: string) =>
    edit((cur) => ({
      ...cur,
      sections: cur.sections.map((s) => (s.id === sid ? { ...s, sources: s.sources.filter((x) => x.id !== srcId) } : s)),
    }));

  const commitName = () => { saveName(name); track(); scheduleSave(); };

  const ordered = pack ? [...pack.sections].sort((a, b) => a.order - b.order) : [];

  return (
    <div className="fixed inset-0 z-[var(--z-mobile-reader,60)] bg-[var(--background)] flex flex-col" dir="rtl">
      {/* header + presence */}
      <div className="border-b border-[var(--border-subtle)] bg-[var(--card)]">
        <div className="flex items-center gap-2 px-3 sm:px-4 py-3">
          <Users className="size-5 text-emerald-600 shrink-0" />
          <span className="font-bold flex-1 min-w-0 truncate">همکاری زنده{pack ? ` · ${pack.title}` : ""}</span>
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${status === "live" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" : status === "connecting" ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"}`}>
            {status === "live" ? <><Wifi className="size-3.5" /> زنده</> : status === "connecting" ? <><Loader2 className="size-3.5 animate-spin" /> اتصال…</> : <><WifiOff className="size-3.5" /> قطع</>}
          </span>
          <button onClick={onClose} className="p-1 text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"><X className="size-5" /></button>
        </div>
        <div className="flex items-center gap-2 px-3 sm:px-4 pb-3 flex-wrap">
          <span className="text-xs text-[var(--foreground-subtle)]">شرکت‌کنندگان:</span>
          {/* me */}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--background)] border border-[var(--border-subtle)] pl-2 pr-1 py-0.5 text-xs">
            <span className="size-4 rounded-full bg-emerald-600 text-white grid place-items-center text-[9px] font-bold">{(name[0] || "؟")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={commitName} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} className="w-16 bg-transparent outline-none" />
            <Pencil className="size-3 text-[var(--foreground-subtle)]" />
            <span className="text-[var(--foreground-subtle)]">(شما)</span>
          </span>
          {peers.map((c) => (
            <span key={c.clientId} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-xs" title={c.name}>
              <span className="size-4 rounded-full text-white grid place-items-center text-[9px] font-bold" style={{ background: c.color }}>{c.name[0] || "؟"}</span>
              {c.name}
            </span>
          ))}
          {peers.length === 0 && <span className="text-xs text-[var(--foreground-subtle)]">فعلاً تنها شما اینجا هستید — پیوند اشتراکی را برای دیگران بفرستید.</span>}
          {lastEditorName && <span className="text-[11px] text-[var(--foreground-subtle)] w-full">آخرین ویرایش: {lastEditorName}</span>}
        </div>
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {status === "error" && !pack && (
          <div className="max-w-md mx-auto text-center py-10 space-y-2">
            <WifiOff className="size-10 mx-auto text-red-400" />
            <p className="text-sm text-red-500">{errMsg || "اتصال به اتاق همکاری برقرار نشد."}</p>
          </div>
        )}
        {!pack && status !== "error" && <div className="py-10 text-center"><Loader2 className="size-6 animate-spin mx-auto text-[var(--foreground-subtle)]" /></div>}
        {pack && (
          <div className="max-w-2xl mx-auto space-y-3">
            <input value={pack.title} onChange={(e) => patch({ title: e.target.value })} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] px-3 py-2 font-bold" />
            <input value={pack.intro || ""} onChange={(e) => patch({ intro: e.target.value })} placeholder="سرمقالهٔ کوتاه (اختیاری)" className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] px-3 py-2 text-sm" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="text-xs text-[var(--foreground-subtle)] flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] px-3 py-2">
                <span className="flex items-center gap-1.5"><Sparkles className="size-4" /> تم</span>
                <select value={pack.theme} onChange={(e) => patch({ theme: e.target.value })} className="bg-transparent text-sm text-[var(--foreground)]">
                  {THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </label>
              <label className="text-xs text-[var(--foreground-subtle)] flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] px-3 py-2">
                <span className="flex items-center gap-1.5"><Clock className="size-4" /> بازه</span>
                <select value={pack.timespanHours} onChange={(e) => patch({ timespanHours: Number(e.target.value) })} className="bg-transparent text-sm text-[var(--foreground)]">
                  {TIMESPANS.map((t) => <option key={t.hours} value={t.hours}>{t.label}</option>)}
                </select>
              </label>
              <label className="text-xs text-[var(--foreground-subtle)] flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] px-3 py-2">
                <span className="flex items-center gap-1.5"><CalendarClock className="size-4" /> دوره</span>
                <select value={pack.scheduleEveryHours} onChange={(e) => patch({ scheduleEveryHours: Number(e.target.value) })} className="bg-transparent text-sm text-[var(--foreground)]">
                  {SCHEDULES.map((s) => <option key={s.hours} value={s.hours}>{s.label}</option>)}
                </select>
              </label>
            </div>

            {ordered.map((s, i) => (
              <CollabSectionCard
                key={s.id}
                section={s} index={i} total={ordered.length}
                editingPeers={peers.filter((p) => p.editingSection === s.id)}
                onFocus={() => setEditing(s.id)}
                onBlur={() => setEditing(null)}
                onChange={(p) => patchSection(s.id, p)}
                onRemove={() => removeSection(s.id)}
                onMove={(d) => moveSection(s.id, d)}
                onOpenPicker={() => setPickerFor(s.id)}
                onRemoveSource={(id) => removeSource(s.id, id)}
              />
            ))}
            <button onClick={addSection} className="w-full rounded-xl border-2 border-dashed border-[var(--border-subtle)] py-3 text-sm text-[var(--foreground-subtle)] flex items-center justify-center gap-1.5">
              <Plus className="size-4" /> افزودن بخش
            </button>
            <p className="text-[11px] text-[var(--foreground-subtle)] text-center pt-1">تغییرات به‌صورت خودکار برای همه ذخیره و همگام می‌شود. تولید نسخه از ویرایشگر مالک بسته انجام می‌گیرد.</p>
          </div>
        )}
      </div>

      {pickerFor && pack && (
        <CollabSourcePicker
          existing={pack.sections.find((s) => s.id === pickerFor)?.sources || []}
          onClose={() => setPickerFor(null)}
          onPick={(src) => addSource(pickerFor, src)}
        />
      )}
    </div>
  );
}

function CollabSectionCard({
  section, index, total, editingPeers, onFocus, onBlur, onChange, onRemove, onMove, onOpenPicker, onRemoveSource,
}: {
  section: PackSection; index: number; total: number;
  editingPeers: Peer[];
  onFocus: () => void; onBlur: () => void;
  onChange: (p: Partial<PackSection>) => void; onRemove: () => void; onMove: (d: -1 | 1) => void;
  onOpenPicker: () => void; onRemoveSource: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kw, setKw] = useState("");
  const meta = contentTypeMeta(section.contentType);
  const busy = editingPeers.length > 0;
  const busyColor = busy ? editingPeers[0].color : undefined;
  return (
    <div
      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] transition-colors"
      style={busy ? { borderColor: busyColor, boxShadow: `inset 3px 0 0 0 ${busyColor}` } : undefined}
      onFocusCapture={onFocus}
      onBlurCapture={onBlur}
    >
      {busy && (
        <div className="flex items-center gap-1.5 px-3 pt-2 text-[11px]" style={{ color: busyColor }}>
          <PencilLine className="size-3.5 animate-pulse" />
          <span>
            {editingPeers.map((p) => p.name).join("، ")}
            {editingPeers.length === 1 ? " در حال ویرایش این بخش است…" : " در حال ویرایش این بخش هستند…"}
          </span>
        </div>
      )}
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

function CollabSourcePicker({
  onClose, onPick, existing,
}: { onClose: () => void; onPick: (s: PackSource) => void; existing: PackSource[] }) {
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState("");
  const has = (url: string) => existing.some((e) => e.url === url);
  const addCustom = () => {
    const det = detectSource(custom);
    if (!det) { setErr("منبع شناسایی نشد."); return; }
    setErr("");
    onPick({ id: uid(), url: det.url, name: det.name, icon: det.icon, sourceKind: det.kind, lang: "fa" });
    setCustom("");
  };
  return (
    <div className="fixed inset-0 z-[var(--z-mobile-reader,60)] bg-black/40 flex items-end sm:items-center sm:justify-center" onClick={onClose}>
      <div className="w-full sm:max-w-lg max-h-[80vh] rounded-t-2xl sm:rounded-2xl bg-[var(--background)] flex flex-col" onClick={(e) => e.stopPropagation()} dir="rtl">
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
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
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
