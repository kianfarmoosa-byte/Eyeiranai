import { useEffect, useState } from "react";
import { Copy, Check, Save, Hash, Send, Loader2, ImageIcon, RefreshCw, X, Plus, Clock, Layers, Rocket } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { useHaptics } from "../hooks";
import { useToast } from "../primitives/Toast";
import { ImageWithFallback } from "../../figma/ImageWithFallback";
import { api, type Draft, type StudioPlatform, type DraftOutput, type ConnectionStatus, type BrandProfile } from "../../../api";
import { studioUserId, PLATFORM_META, PLATFORM_LIMIT, isPublishable } from "./studio";
import { renderNewsCard, renderCarousel, CARD_THEMES, CARD_RATIOS, type CardTheme, type CardRatio } from "./newsCard";

type Props = {
  draft: Draft;
  onClose: () => void;
  onSaved?: (d: Draft) => void;
  /** Jump to the connections screen when the user needs to connect an account. */
  onOpenConnections?: () => void;
};

export function DraftEditorScreen({ draft, onClose, onSaved, onOpenConnections }: Props) {
  const haptic = useHaptics();
  const toast = useToast();
  const uid = studioUserId();

  const platforms = Object.keys(draft.outputs) as StudioPlatform[];
  const [active, setActive] = useState<StudioPlatform>(platforms[0] || "telegram");
  const [outputs, setOutputs] = useState<Partial<Record<StudioPlatform, DraftOutput>>>(draft.outputs);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [conns, setConns] = useState<Record<string, ConnectionStatus>>({});
  const [publishing, setPublishing] = useState(false);
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [makingCard, setMakingCard] = useState(false);
  const [withImage, setWithImage] = useState(!!draft.image);
  const [rewriting, setRewriting] = useState(false);
  const [tagInput, setTagInput] = useState("");
  // Previous versions per platform, so the user can restore an earlier draft.
  const [variants, setVariants] = useState<Partial<Record<StudioPlatform, DraftOutput[]>>>({});
  const [cardTheme, setCardTheme] = useState<CardTheme>((draft.cardTheme as CardTheme) || "dark");
  const [cardRatio, setCardRatio] = useState<CardRatio>((draft.cardRatio as CardRatio) || "square");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [images, setImages] = useState<string[]>(draft.images || []);
  const [buildingCarousel, setBuildingCarousel] = useState(false);
  const [publishingAll, setPublishingAll] = useState(false);

  // The image actually sent: the branded card takes precedence over the raw photo.
  const effectiveImage = cardUrl || draft.image || "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, b] = await Promise.all([api.studioGetConnections(uid), api.studioGetBrand(uid)]);
        if (!cancelled) { setConns(c); setBrand(b); }
      } catch (e) {
        console.log("load connections/brand failed:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  const makeCard = async () => {
    haptic("select");
    setMakingCard(true);
    try {
      const dataUrl = await renderNewsCard({
        title: draft.sourceTitle || draft.title,
        brandName: brand?.name || "flow",
        tagline: brand?.tagline,
        source: brand?.name || undefined,
        accent: "#2FB08B",
        theme: cardTheme,
        ratio: cardRatio,
        logoUrl: brand?.logo || undefined,
      });
      const url = await api.studioUploadCard(uid, dataUrl);
      setCardUrl(url);
      setWithImage(true);
      toast({ kind: "success", message: "کارت برند ساخته شد" });
    } catch (e: any) {
      console.log("make card failed:", e);
      toast({ kind: "error", message: String(e?.message || e).slice(0, 120) });
    } finally {
      setMakingCard(false);
    }
  };

  // Split the active text into 2–6 slide chunks for a carousel.
  const splitSlides = (text: string): string[] => {
    let parts = text.split(/\n{2,}|\n[-•*]\s*/).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) parts = text.split(/(?<=[.!؟?])\s+/).map((s) => s.trim()).filter((s) => s.length > 10);
    return parts.slice(0, 6);
  };

  const makeCarousel = async () => {
    const slides = splitSlides((outputs[active] || { text: "" }).text);
    if (slides.length < 2) { toast({ kind: "warn", message: "متن برای کاروسل کوتاه است؛ چند خط/بولت لازم است" }); return; }
    haptic("select");
    setBuildingCarousel(true);
    try {
      const dataUrls = await renderCarousel({
        title: draft.sourceTitle || draft.title,
        slides,
        brandName: brand?.name || "flow",
        tagline: brand?.tagline,
        accent: "#2FB08B",
        theme: cardTheme,
        logoUrl: brand?.logo || undefined,
      });
      const urls: string[] = [];
      for (const d of dataUrls) urls.push(await api.studioUploadCard(uid, d));
      setImages(urls);
      await api.studioSaveDraft(uid, { ...draft, outputs, images: urls });
      toast({ kind: "success", message: `کاروسل ${urls.length}‌اسلایدی ساخته شد` });
    } catch (e: any) {
      console.log("make carousel failed:", e);
      toast({ kind: "error", message: String(e?.message || e).slice(0, 120) });
    } finally {
      setBuildingCarousel(false);
    }
  };

  const cur = outputs[active] || { text: "", hashtags: [] };
  const limit = PLATFORM_LIMIT[active] || 0;
  const over = limit > 0 && cur.text.length > limit;

  const setText = (text: string) => {
    setOutputs((o) => ({ ...o, [active]: { ...(o[active] || { hashtags: [] }), text } }));
    setDirty(true);
  };

  const setHashtags = (hashtags: string[]) => {
    setOutputs((o) => ({ ...o, [active]: { ...(o[active] || { text: "" }), hashtags } }));
    setDirty(true);
  };

  const addHashtag = () => {
    const v = tagInput.trim().replace(/^#/, "");
    if (!v) return;
    if (!cur.hashtags.includes(v)) setHashtags([...cur.hashtags, v].slice(0, 15));
    setTagInput("");
    haptic("tap");
  };

  // Regenerate the active platform's text into a fresh alternative (keeps the
  // previous version in `variants` so it can be restored).
  const regenerate = async () => {
    if (!cur.text.trim()) return;
    haptic("select");
    setRewriting(true);
    try {
      const prev = cur;
      const next = await api.studioRewrite({ brand: brand || {}, platform: active, text: cur.text });
      setVariants((v) => ({ ...v, [active]: [prev, ...(v[active] || [])].slice(0, 5) }));
      setOutputs((o) => ({ ...o, [active]: { text: next.text || prev.text, hashtags: next.hashtags?.length ? next.hashtags : prev.hashtags } }));
      setDirty(true);
      toast({ kind: "success", message: "نسخهٔ تازه ساخته شد" });
    } catch (e: any) {
      console.log("regenerate failed:", e);
      toast({ kind: "error", message: String(e?.message || e).slice(0, 120) });
    } finally {
      setRewriting(false);
    }
  };

  const restoreVariant = (v: DraftOutput) => {
    haptic("tap");
    setOutputs((o) => ({ ...o, [active]: { text: v.text, hashtags: v.hashtags } }));
    setDirty(true);
  };

  const fullText = (o: DraftOutput) =>
    o.hashtags.length ? `${o.text}\n\n${o.hashtags.map((h) => `#${h}`).join(" ")}` : o.text;

  const copy = async () => {
    haptic("select");
    try {
      await navigator.clipboard.writeText(fullText(cur));
      setCopied(true);
      toast({ kind: "success", message: "متن کپی شد" });
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.log("copy failed:", e);
      toast({ kind: "error", message: "کپی ناموفق بود" });
    }
  };

  const save = async () => {
    haptic("select");
    setSaving(true);
    try {
      const saved = await api.studioSaveDraft(uid, { ...draft, outputs });
      setDirty(false);
      toast({ kind: "success", message: "پیش‌نویس ذخیره شد" });
      onSaved?.(saved);
    } catch (e) {
      console.log("save draft failed:", e);
      toast({ kind: "error", message: "ذخیره ناموفق بود" });
    } finally {
      setSaving(false);
    }
  };

  const canPublish = isPublishable(active) && !!conns[active]?.connected;

  const publish = async () => {
    if (!isPublishable(active)) return;
    if (!conns[active]?.connected) {
      toast({ kind: "warn", message: "ابتدا این حساب را در بخش اتصال‌ها وصل کن" });
      onOpenConnections?.();
      return;
    }
    haptic("select");
    setPublishing(true);
    try {
      await api.studioPublish(uid, {
        platform: active,
        text: fullText(cur),
        title: draft.sourceTitle,
        link: draft.sourceLink,
        imageUrl: withImage ? (effectiveImage || undefined) : undefined,
        imageUrls: images.length > 1 ? images : undefined,
      });
      toast({ kind: "success", message: `در ${PLATFORM_META[active].label} منتشر شد` });
    } catch (e: any) {
      console.log("publish failed:", e);
      toast({ kind: "error", message: String(e?.message || e).slice(0, 120) });
    } finally {
      setPublishing(false);
    }
  };

  // One-click publish to every connected channel present in this draft.
  const connectedTargets = (Object.keys(outputs) as StudioPlatform[]).filter((p) => isPublishable(p) && conns[p]?.connected);

  const publishAll = async () => {
    if (connectedTargets.length === 0) {
      toast({ kind: "warn", message: "هیچ کانال متصلی برای پلتفرم‌های این پیش‌نویس نیست" });
      onOpenConnections?.();
      return;
    }
    haptic("select");
    setPublishingAll(true);
    let ok = 0; const fails: string[] = [];
    for (const p of connectedTargets) {
      const o = outputs[p];
      if (!o?.text) continue;
      try {
        await api.studioPublish(uid, {
          platform: p,
          text: fullText(o),
          title: draft.sourceTitle,
          link: draft.sourceLink,
          imageUrl: withImage ? (effectiveImage || undefined) : undefined,
          imageUrls: images.length > 1 ? images : undefined,
        });
        ok++;
      } catch (e: any) {
        console.log(`publishAll ${p} failed:`, e);
        fails.push(PLATFORM_META[p].label);
      }
    }
    toast({
      kind: fails.length ? "warn" : "success",
      message: fails.length ? `${ok} موفق · ناموفق: ${fails.join("، ")}` : `در ${ok} کانال منتشر شد`,
    });
    setPublishingAll(false);
  };

  // Schedule the draft to auto-publish later (handled by the automation tick).
  const schedule = async () => {
    const ts = scheduleAt ? new Date(scheduleAt).getTime() : 0;
    if (!ts || ts < Date.now()) { toast({ kind: "warn", message: "زمان معتبر در آینده انتخاب کن" }); return; }
    const targets = (Object.keys(outputs) as StudioPlatform[]).filter(isPublishable);
    if (targets.length === 0) { toast({ kind: "warn", message: "هیچ پلتفرم قابل‌انتشاری در این پیش‌نویس نیست" }); return; }
    haptic("select");
    setScheduling(true);
    try {
      const saved = await api.studioSaveDraft(uid, {
        ...draft, outputs, image: effectiveImage,
        status: "scheduled", scheduledAt: ts, scheduleTargets: targets,
      });
      toast({ kind: "success", message: "زمان‌بندی شد" });
      setScheduleOpen(false);
      onSaved?.(saved);
    } catch (e: any) {
      console.log("schedule failed:", e);
      toast({ kind: "error", message: String(e?.message || e).slice(0, 120) });
    } finally {
      setScheduling(false);
    }
  };

  return (
    <MobileScreen topbar={<MobileTopBar title="ویرایش پیش‌نویس" subtitle={draft.sourceTitle} onBack={onClose} />}>
      <div className="h-full flex flex-col">
        {/* platform tabs */}
        <div className="px-3 pt-3 flex gap-1.5 overflow-x-auto scrollbar-none shrink-0">
          {platforms.map((p) => {
            const on = p === active;
            return (
              <button
                key={p}
                onClick={() => { haptic("tap"); setActive(p); }}
                className={`px-3 py-1.5 rounded-full text-[12.5px] whitespace-nowrap border tap press flex items-center gap-1 ${
                  on ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]" : "border-[var(--border-subtle)] text-[var(--foreground-muted)]"
                }`}
              >
                <span>{PLATFORM_META[p].emoji}</span>
                {PLATFORM_META[p].label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-none px-4 py-3 md:grid md:grid-cols-[minmax(0,1fr)_360px] md:gap-6 md:items-start md:content-start md:max-w-[1120px] md:w-full md:mx-auto">
          {/* image / branded card attach */}
          <div className="mb-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] overflow-hidden md:mb-0 md:col-start-2 md:row-start-1 md:self-start">
            {effectiveImage ? (
              <ImageWithFallback src={effectiveImage} alt={draft.sourceTitle} className="w-full aspect-square object-cover" />
            ) : (
              <div className="w-full aspect-[16/9] grid place-items-center bg-[var(--background-muted)] text-[var(--foreground-subtle)] text-[12.5px]">
                بدون تصویر — می‌توانی کارت برند بسازی
              </div>
            )}
            {/* card theme + ratio options */}
            <div className="px-3.5 pt-2.5 flex flex-wrap gap-1.5">
              {CARD_THEMES.map((th) => (
                <button key={th.id} onClick={() => { haptic("tap"); setCardTheme(th.id); }}
                  className={`px-2.5 py-1 rounded-full text-[11.5px] border tap press ${cardTheme === th.id ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]" : "border-[var(--border-subtle)] text-[var(--foreground-muted)]"}`}>
                  {th.label}
                </button>
              ))}
              <span className="w-px self-stretch bg-[var(--border-subtle)] mx-0.5" />
              {CARD_RATIOS.map((rt) => (
                <button key={rt.id} onClick={() => { haptic("tap"); setCardRatio(rt.id); }}
                  className={`px-2.5 py-1 rounded-full text-[11.5px] border tap press ${cardRatio === rt.id ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]" : "border-[var(--border-subtle)] text-[var(--foreground-muted)]"}`}>
                  {rt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2.5">
              <button
                onClick={makeCard}
                disabled={makingCard}
                className="flex-1 h-9 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-[12.5px] tap press flex items-center justify-center gap-1.5 active:bg-[var(--accent)] disabled:opacity-50"
              >
                {makingCard ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
                {makingCard ? "در حال ساخت…" : cardUrl ? "بازسازی کارت برند" : "ساخت کارت برند"}
              </button>
              {effectiveImage && (
                <button onClick={() => { haptic("tap"); setWithImage((v) => !v); }} className="flex items-center gap-2 text-[12.5px] px-2 tap press">
                  <span className={`w-11 h-6 rounded-full p-0.5 transition-colors ${withImage ? "bg-[var(--brand-500)]" : "bg-[var(--border-strong)]"}`}>
                    <span className={`block size-5 rounded-full bg-white transition-transform ${withImage ? "-translate-x-5" : ""}`} />
                  </span>
                  همراه تصویر
                </button>
              )}
            </div>
            {cardUrl && <div className="px-3.5 pb-2.5 text-[11px] text-emerald-500">کارت برند به‌عنوان تصویر انتشار استفاده می‌شود.</div>}

            {/* carousel */}
            <div className="px-3.5 pb-3 border-t border-[var(--border-subtle)] pt-2.5">
              <button
                onClick={makeCarousel}
                disabled={buildingCarousel}
                className="w-full h-9 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-[12.5px] tap press flex items-center justify-center gap-1.5 active:bg-[var(--accent)] disabled:opacity-50"
              >
                {buildingCarousel ? <Loader2 className="size-4 animate-spin" /> : <Layers className="size-4" />}
                {buildingCarousel ? "در حال ساخت کاروسل…" : images.length > 1 ? `بازسازی کاروسل (${images.length} اسلاید)` : "ساخت کاروسل چنداسلایدی"}
              </button>
              {images.length > 1 && (
                <>
                  <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-none">
                    {images.map((u, i) => (
                      <img key={i} src={u} alt={`slide ${i + 1}`} className="h-24 w-24 rounded-[var(--radius-md)] object-cover border border-[var(--border-subtle)] shrink-0" />
                    ))}
                  </div>
                  <div className="mt-1.5 text-[11px] text-emerald-500">کاروسل آماده است؛ هنگام انتشار در تلگرام/بله به‌صورت آلبوم ارسال می‌شود.</div>
                </>
              )}
            </div>
          </div>

          {/* live preview card */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5 md:col-start-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-[var(--foreground-subtle)]">{PLATFORM_META[active].hint}</span>
              <span className={`text-[11px] tabular-nums ${over ? "text-rose-500 font-semibold" : "text-[var(--foreground-subtle)]"}`}>
                {cur.text.length}{limit > 0 ? ` / ${limit}` : ""}
              </span>
            </div>
            <textarea
              value={cur.text}
              onChange={(e) => setText(e.target.value)}
              rows={9}
              dir="auto"
              className={`w-full resize-none bg-transparent outline-none text-[14px] leading-[1.9] ${over ? "text-rose-600" : "text-[var(--foreground)]"}`}
              placeholder="متن محتوا…"
            />
            {/* editable hashtags */}
            <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
              <div className="flex flex-wrap items-center gap-1.5">
                {cur.hashtags.map((h) => (
                  <span key={h} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] bg-[var(--background-muted)] border border-[var(--border-subtle)] text-[var(--brand-500)]">
                    <Hash className="size-3" />{h}
                    <button onClick={() => { haptic("tap"); setHashtags(cur.hashtags.filter((x) => x !== h)); }} aria-label="حذف هشتگ">
                      <X className="size-3 text-[var(--foreground-subtle)]" />
                    </button>
                  </span>
                ))}
                <span className="inline-flex items-center gap-1">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addHashtag(); } }}
                    placeholder="هشتگ +"
                    className="w-20 bg-transparent outline-none text-[12px] placeholder:text-[var(--foreground-subtle)]"
                  />
                  {tagInput.trim() && (
                    <button onClick={addHashtag} aria-label="افزودن هشتگ" className="grid place-items-center text-[var(--brand-500)]">
                      <Plus className="size-3.5" />
                    </button>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* regenerate + previous versions */}
          <div className="mt-3 md:col-start-1 md:mt-4">
            <button
              onClick={regenerate}
              disabled={rewriting || !cur.text.trim()}
              className="w-full h-10 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] text-[13px] tap press flex items-center justify-center gap-2 active:bg-[var(--accent)] disabled:opacity-50"
            >
              {rewriting ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {rewriting ? "در حال بازتولید…" : "بازتولید / نسخهٔ دیگر"}
            </button>
            {(variants[active]?.length ?? 0) > 0 && (
              <div className="mt-2">
                <div className="text-[11px] text-[var(--foreground-subtle)] mb-1">نسخه‌های قبلی (برای بازگردانی بزن):</div>
                <div className="flex flex-col gap-1.5">
                  {variants[active]!.map((v, i) => (
                    <button
                      key={i}
                      onClick={() => restoreVariant(v)}
                      className="text-right rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 tap press"
                    >
                      <span className="block text-[12px] text-[var(--foreground-muted)] line-clamp-2 leading-relaxed">{v.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2 md:col-start-1">
            <button
              onClick={copy}
              className="flex-1 h-11 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] text-[14px] tap press flex items-center justify-center gap-2 active:bg-[var(--accent)]"
            >
              {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
              {copied ? "کپی شد" : "کپی متن"}
            </button>
            {isPublishable(active) && (
              <button
                onClick={publish}
                disabled={publishing || over}
                className="flex-1 h-11 rounded-[var(--radius-lg)] bg-[var(--brand-500)] text-white text-[14px] font-semibold tap press flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {publishing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 -scale-x-100" />}
                {publishing ? "در حال انتشار…" : canPublish ? `انتشار در ${PLATFORM_META[active].label}` : "اتصال و انتشار"}
              </button>
            )}
          </div>

          {!isPublishable(active) && (
            <div className="mt-3 text-[11.5px] text-[var(--foreground-subtle)] text-center leading-relaxed md:col-start-1">
              انتشار مستقیم برای این پلتفرم هنوز فعال نیست؛ فعلاً متن را کپی و دستی منتشر کن.
            </div>
          )}

          {/* publish to all connected channels at once */}
          {connectedTargets.length > 1 && (
            <button
              onClick={publishAll}
              disabled={publishingAll}
              className="mt-3 w-full h-11 rounded-[var(--radius-lg)] bg-[var(--foreground)] text-[var(--background)] text-[14px] font-semibold tap press flex items-center justify-center gap-2 disabled:opacity-50 md:col-start-1"
            >
              {publishingAll ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
              {publishingAll ? "در حال انتشار همگانی…" : `انتشار هم‌زمان در ${connectedTargets.length} کانال متصل`}
            </button>
          )}

          {/* schedule */}
          <div className="mt-3 md:col-start-1">
            <button
              onClick={() => { haptic("tap"); setScheduleOpen((o) => !o); }}
              className="w-full h-10 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] text-[13px] tap press flex items-center justify-center gap-2 active:bg-[var(--accent)]"
            >
              <Clock className="size-4" />
              زمان‌بندی انتشار خودکار
            </button>
            {scheduleOpen && (
              <div className="mt-2 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3 space-y-2">
                <div className="text-[12px] text-[var(--foreground-muted)]">زمان انتشار را انتخاب کن (همهٔ پلتفرم‌های قابل‌انتشارِ این پیش‌نویس منتشر می‌شوند):</div>
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  className="w-full h-10 px-3 rounded-[var(--radius-md)] bg-[var(--input-background)] border border-[var(--border-subtle)] text-[14px] outline-none"
                />
                <button
                  onClick={schedule}
                  disabled={scheduling || !scheduleAt}
                  className="w-full h-10 rounded-[var(--radius-md)] bg-[var(--brand-500)] text-white text-[13px] font-semibold tap press flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {scheduling ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
                  {scheduling ? "در حال ثبت…" : "ثبت زمان‌بندی"}
                </button>
                <p className="text-[10.5px] text-[var(--foreground-subtle)] leading-relaxed">
                  انتشار در زمان مقرر توسط موتور اتوماسیون انجام می‌شود؛ برای کارکرد ۲۴ساعته باید زمان‌بند بیرونی به <span dir="ltr" className="font-mono">/automation/tick</span> وصل باشد.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 pb-[calc(16px+var(--safe-bottom))] border-t border-[var(--border-subtle)] shrink-0">
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="w-full h-12 rounded-[var(--radius-lg)] bg-[var(--brand-500)] text-white text-[15px] font-semibold tap press flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="size-5" />
            {saving ? "در حال ذخیره…" : dirty ? "ذخیرهٔ تغییرات" : "ذخیره شد"}
          </button>
        </div>
      </div>
    </MobileScreen>
  );
}
