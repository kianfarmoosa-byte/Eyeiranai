import { useEffect, useState } from "react";
import { Check, Hash, Sparkles, X, ImageIcon, Loader2, Wand2, Link2, CheckCircle2, Trash2 } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { useHaptics } from "../hooks";
import { useToast } from "../primitives/Toast";
import { api, type BrandProfile, type StyleResult } from "../../../api";
import { studioUserId, DEFAULT_BRAND, TONE_OPTIONS, INPUT_CLS } from "./studio";

type Props = { onClose: () => void };

export function BrandProfileScreen({ onClose }: Props) {
  const haptic = useHaptics();
  const toast = useToast();
  const uid = studioUserId();
  const [brand, setBrand] = useState<BrandProfile>(DEFAULT_BRAND);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  // Source-based style analysis (Phase 1).
  const [srcUrl, setSrcUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [style, setStyle] = useState<StyleResult | null>(null);
  const [styles, setStyles] = useState<StyleResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [blending, setBlending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [b, s, lib] = await Promise.all([
          api.studioGetBrand(uid),
          api.studioGetStyle(uid).catch(() => null),
          api.studioGetStyles(uid).catch(() => [] as StyleResult[]),
        ]);
        if (!cancelled) {
          if (b) setBrand({ ...DEFAULT_BRAND, ...b });
          if (s) { setStyle(s); if (s.source) setSrcUrl(s.source); }
          setStyles(lib || []);
        }
      } catch (e) {
        console.log("load brand failed:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  const patch = (p: Partial<BrandProfile>) => setBrand((b) => ({ ...b, ...p }));

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "");
    if (!t) return;
    if (!brand.hashtags.includes(t)) patch({ hashtags: [...brand.hashtags, t].slice(0, 15) });
    setTagInput("");
    haptic("tap");
  };

  const onPickLogo = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2_000_000) { toast({ kind: "error", message: "حجم لوگو باید کمتر از ۲ مگابایت باشد" }); return; }
    haptic("select");
    setUploadingLogo(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("read failed"));
        r.readAsDataURL(file);
      });
      const url = await api.studioUploadCard(uid, dataUrl);
      patch({ logo: url });
      toast({ kind: "success", message: "لوگو بارگذاری شد" });
    } catch (e: any) {
      console.log("logo upload failed:", e);
      toast({ kind: "error", message: String(e?.message || e).slice(0, 120) });
    } finally {
      setUploadingLogo(false);
    }
  };

  const analyze = async () => {
    const url = srcUrl.trim();
    if (!url) { toast({ kind: "warn", message: "لینک سایت خبری/RSS یا کانال عمومی تلگرام را وارد کن" }); return; }
    haptic("select");
    setAnalyzing(true);
    setStyle(null);
    try {
      const res = await api.studioAnalyzeSource(uid, url);
      setStyle(res);
      setStyles((l) => [res, ...l.filter((x) => x.source !== res.source)].slice(0, 8));
      toast({ kind: "success", message: `سبک از ${res.sampleCount} نمونه استخراج شد` });
    } catch (e: any) {
      console.log("analyze source failed:", e);
      toast({ kind: "error", message: String(e?.message || e).slice(0, 140) });
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleSelect = (source: string) => {
    haptic("tap");
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(source) ? n.delete(source) : n.add(source);
      return n;
    });
  };

  const blend = async () => {
    const arr = [...selected];
    if (arr.length < 2) return;
    haptic("select");
    setBlending(true);
    try {
      const res = await api.studioBlendStyles(uid, arr);
      setStyle(res);
      setStyles((l) => [res, ...l.filter((x) => x.source !== res.source)].slice(0, 8));
      setSelected(new Set());
      toast({ kind: "success", message: "سبک تلفیقی ساخته شد" });
    } catch (e: any) {
      console.log("blend styles failed:", e);
      toast({ kind: "error", message: String(e?.message || e).slice(0, 140) });
    } finally {
      setBlending(false);
    }
  };

  const deleteStyle = async (source: string) => {
    haptic("heavy");
    try {
      const next = await api.studioDeleteStyle(uid, source);
      setStyles(next);
      if (style?.source === source) setStyle(null);
    } catch (e) {
      console.log("delete style failed:", e);
    }
  };

  // Merge the extracted style profile into the brand (user still taps Save).
  const applyStyle = () => {
    if (!style) return;
    const p = style.profile;
    const usesEmoji = !!p.emojiUsage && !/(none|بدون|هیچ|no\b)/i.test(p.emojiUsage);
    patch({
      tone: p.tone || brand.tone,
      audience: p.audience || brand.audience,
      signature: p.signature || brand.signature,
      language: p.language === "en" ? "en" : "fa",
      hashtags: Array.from(new Set([...(brand.hashtags || []), ...((p.hashtags || []).map((h) => String(h).replace(/^#/, "")))])).filter(Boolean).slice(0, 15),
      styleGuide: p.styleGuide || brand.styleGuide,
      emoji: usesEmoji,
    });
    haptic("select");
    toast({ kind: "success", message: "سبک روی برند اعمال شد؛ برای ذخیره دکمهٔ پایین را بزن" });
  };

  const save = async () => {
    haptic("select");
    setSaving(true);
    try {
      const saved = await api.studioSaveBrand(uid, brand);
      setBrand({ ...DEFAULT_BRAND, ...saved });
      toast({ kind: "success", message: "پروفایل برند ذخیره شد" });
      onClose();
    } catch (e) {
      console.log("save brand failed:", e);
      toast({ kind: "error", message: "ذخیره ناموفق بود" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileScreen topbar={<MobileTopBar title="پروفایل برند" onBack={onClose} />}>
      <div className="h-full overflow-y-auto scrollbar-none pb-28">
        {loading ? (
          <div className="px-4 py-10 text-center text-[13px] text-[var(--foreground-subtle)]">در حال بارگذاری…</div>
        ) : (
          <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,400px)] md:gap-x-6 md:items-start md:max-w-[1120px] md:w-full md:mx-auto md:px-4">
            <div className="px-4 pt-4 md:px-0 md:col-span-2 flex items-center gap-2 text-[12.5px] text-[var(--foreground-subtle)]">
              <Sparkles className="size-4 text-[var(--brand-500)]" />
              <span>این اطلاعات لحن و امضای محتوای تولیدشده با هوش مصنوعی را تعیین می‌کند.</span>
            </div>

            {/* Style analysis from a source (Phase 1) */}
            <div className="px-4 mt-4 md:px-0 md:col-start-2 md:row-start-2 md:sticky md:top-2">
              <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="size-7 grid place-items-center rounded-full bg-[var(--brand-500)]/15 text-[var(--brand-600)]"><Wand2 className="size-4" /></span>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold leading-tight">الگوبرداری از یک منبع</div>
                    <div className="text-[11px] text-[var(--foreground-subtle)] leading-tight">سایت خبری/RSS یا کانال عمومی تلگرام</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`flex-1 flex items-center gap-1.5 ${INPUT_CLS}`}>
                    <Link2 className="size-4 text-[var(--foreground-subtle)] shrink-0" />
                    <input
                      value={srcUrl}
                      onChange={(e) => setSrcUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); analyze(); } }}
                      dir="ltr"
                      placeholder="https://example.com  یا  t.me/channel"
                      className="flex-1 bg-transparent outline-none text-[13px] text-right"
                    />
                  </div>
                  <button
                    onClick={analyze}
                    disabled={analyzing}
                    className="h-10 px-3 rounded-[var(--radius-md)] bg-[var(--brand-500)] text-white text-[12.5px] font-semibold tap press flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {analyzing ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                    {analyzing ? "…" : "تحلیل"}
                  </button>
                </div>

                {styles.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[11px] text-[var(--foreground-subtle)] mb-1.5">منابع تحلیل‌شده</div>
                    <div className="flex flex-col gap-1.5">
                      {styles.map((s) => {
                        const active = style?.source === s.source;
                        return (
                          <div
                            key={s.source}
                            className={`flex items-center gap-2 rounded-[var(--radius-md)] border px-2.5 py-2 ${
                              active ? "border-[var(--brand-500)] bg-[var(--brand-500)]/5" : "border-[var(--border-subtle)] bg-[var(--background)]"
                            }`}
                          >
                            <button
                              onClick={() => toggleSelect(s.source)}
                              aria-label="انتخاب برای ترکیب"
                              className={`size-5 rounded-[6px] border grid place-items-center shrink-0 tap press ${
                                selected.has(s.source) ? "bg-[var(--brand-500)] border-[var(--brand-500)] text-white" : "border-[var(--border-strong)]"
                              }`}
                            >
                              {selected.has(s.source) && <Check className="size-3.5" />}
                            </button>
                            <button onClick={() => { haptic("tap"); setStyle(s); setSrcUrl(s.source); }} className="flex-1 min-w-0 text-right tap press">
                              <span className="block text-[12.5px] font-medium truncate">{srcHost(s.source)}</span>
                              <span className="block text-[10.5px] text-[var(--foreground-subtle)] truncate">
                                {srcTypeLabel(s.type)} · {s.sampleCount} نمونه{s.profile?.tone ? ` · ${s.profile.tone}` : ""}
                              </span>
                            </button>
                            <button onClick={() => deleteStyle(s.source)} aria-label="حذف منبع" className="size-8 grid place-items-center rounded-full tap press text-rose-500 active:bg-rose-500/10">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {selected.size >= 2 && (
                      <button
                        onClick={blend}
                        disabled={blending}
                        className="mt-2 w-full h-9 rounded-[var(--radius-md)] bg-[var(--brand-500)] text-white text-[12.5px] font-semibold tap press flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {blending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                        {blending ? "در حال ترکیب…" : `ترکیب ${selected.size} سبک انتخاب‌شده`}
                      </button>
                    )}
                  </div>
                )}

                {style && (
                  <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--background)] p-3">
                    <div className="text-[12.5px] leading-relaxed text-[var(--foreground)]">{style.profile.summary}</div>
                    <dl className="mt-2 space-y-1 text-[11.5px]">
                      <Row k="لحن" v={style.profile.tone} />
                      <Row k="مخاطب" v={style.profile.audience} />
                      <Row k="ساختار" v={style.profile.structure} />
                      <Row k="ایموجی" v={style.profile.emojiUsage} />
                    </dl>
                    {style.profile.styleGuide && (
                      <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--foreground-muted)]">{style.profile.styleGuide}</p>
                    )}
                    {(style.profile.hashtags?.length ?? 0) > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {style.profile.hashtags.slice(0, 10).map((h) => (
                          <span key={h} className="px-1.5 py-0.5 rounded-full text-[10.5px] bg-[var(--background-muted)] border border-[var(--border-subtle)] text-[var(--brand-600)]">#{String(h).replace(/^#/, "")}</span>
                        ))}
                      </div>
                    )}
                    {(style.profile.dos?.length ?? 0) > 0 && (
                      <ul className="mt-2 space-y-0.5 text-[11px] text-emerald-600">
                        {style.profile.dos.slice(0, 4).map((d, i) => <li key={i}>✓ {d}</li>)}
                      </ul>
                    )}
                    {(style.profile.donts?.length ?? 0) > 0 && (
                      <ul className="mt-1 space-y-0.5 text-[11px] text-rose-500">
                        {style.profile.donts.slice(0, 4).map((d, i) => <li key={i}>✕ {d}</li>)}
                      </ul>
                    )}
                    {(style.profile.exemplars?.length ?? 0) > 0 && (
                      <div className="mt-2 border-t border-[var(--border-subtle)] pt-2 space-y-1">
                        <div className="text-[10.5px] text-[var(--foreground-subtle)]">نمونه‌های شاخص سبک:</div>
                        {style.profile.exemplars.slice(0, 3).map((ex, i) => (
                          <div key={i} className="text-[11px] leading-relaxed text-[var(--foreground-muted)] line-clamp-2">«{ex}»</div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={applyStyle}
                      className="mt-3 w-full h-9 rounded-[var(--radius-md)] bg-[var(--foreground)] text-[var(--background)] text-[12.5px] font-semibold tap press flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="size-4" /> اعمال روی برند
                    </button>
                    <p className="mt-1.5 text-[10px] text-[var(--foreground-subtle)] leading-relaxed">
                      فقط سبک و لحن الگو گرفته می‌شود، نه عین محتوا. مسئولیت انتشار با شماست.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-start-1 md:row-start-2 md:min-w-0">
            <Field label="نام برند">
              <input
                value={brand.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="مثلاً: رسانهٔ فلو"
                className={INPUT_CLS}
              />
            </Field>

            <Field label="شعار / معرفی کوتاه">
              <input
                value={brand.tagline}
                onChange={(e) => patch({ tagline: e.target.value })}
                placeholder="مثلاً: سریع‌ترین اخبار فناوری"
                className={INPUT_CLS}
              />
            </Field>

            <Field label="لحن محتوا">
              <div className="flex flex-wrap gap-2">
                {TONE_OPTIONS.map((t) => {
                  const on = brand.tone === t;
                  return (
                    <button
                      key={t}
                      onClick={() => { haptic("tap"); patch({ tone: t }); }}
                      className={`px-3 py-1.5 rounded-full text-[12.5px] border tap press ${
                        on ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]"
                           : "border-[var(--border-subtle)] text-[var(--foreground-muted)]"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="مخاطب هدف">
              <input
                value={brand.audience}
                onChange={(e) => patch({ audience: e.target.value })}
                placeholder="مثلاً: علاقه‌مندان فناوری و استارتاپ"
                className={INPUT_CLS}
              />
            </Field>

            <Field label="زبان خروجی">
              <div className="flex gap-2">
                {(["fa", "en"] as const).map((l) => {
                  const on = brand.language === l;
                  return (
                    <button
                      key={l}
                      onClick={() => { haptic("tap"); patch({ language: l }); }}
                      className={`flex-1 h-10 rounded-[var(--radius-md)] text-[13px] border tap press ${
                        on ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]"
                           : "border-[var(--border-subtle)] text-[var(--foreground-muted)]"
                      }`}
                    >
                      {l === "fa" ? "فارسی" : "انگلیسی"}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="امضای ثابت (اختیاری)">
              <input
                value={brand.signature}
                onChange={(e) => patch({ signature: e.target.value })}
                placeholder="مثلاً: @flow_news"
                className={INPUT_CLS}
              />
            </Field>

            <Field label="لوگوی برند (برای کارت‌خبری)">
              <div className="flex items-center gap-3">
                <div className="size-16 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--background-muted)] grid place-items-center overflow-hidden shrink-0">
                  {brand.logo ? (
                    <img src={brand.logo} alt="logo" className="w-full h-full object-contain" />
                  ) : (
                    <ImageIcon className="size-6 text-[var(--foreground-subtle)]" />
                  )}
                </div>
                <label className="flex-1 h-10 rounded-[var(--radius-md)] border border-[var(--border-subtle)] grid place-items-center text-[13px] tap press cursor-pointer">
                  <span className="flex items-center gap-2">
                    {uploadingLogo ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
                    {uploadingLogo ? "در حال بارگذاری…" : brand.logo ? "تغییر لوگو" : "بارگذاری لوگو"}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickLogo(e.target.files?.[0])} />
                </label>
                {brand.logo && (
                  <button onClick={() => { haptic("tap"); patch({ logo: "" }); }} aria-label="حذف لوگو" className="size-10 grid place-items-center rounded-full tap press text-rose-500 active:bg-rose-500/10">
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </Field>

            <Field label="هشتگ‌های ثابت">
              <div className="flex items-center gap-2">
                <div className={`flex-1 flex items-center gap-1.5 ${INPUT_CLS}`}>
                  <Hash className="size-4 text-[var(--foreground-subtle)] shrink-0" />
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    placeholder="افزودن هشتگ و Enter"
                    className="flex-1 bg-transparent outline-none text-[14px]"
                  />
                </div>
                <button onClick={addTag} className="h-10 px-3 rounded-[var(--radius-md)] bg-[var(--accent)] text-[13px] tap press">افزودن</button>
              </div>
              {brand.hashtags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {brand.hashtags.map((h) => (
                    <span key={h} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] bg-[var(--background-muted)] border border-[var(--border-subtle)]">
                      #{h}
                      <button onClick={() => { haptic("tap"); patch({ hashtags: brand.hashtags.filter((x) => x !== h) }); }} aria-label="حذف">
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </Field>

            <div className="px-4 mt-2">
              <button
                onClick={() => { haptic("tap"); patch({ emoji: !brand.emoji }); }}
                className="w-full flex items-center justify-between rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] px-3.5 py-3 tap press"
              >
                <span className="text-[14px]">استفاده از ایموجی در محتوا</span>
                <span className={`w-11 h-6 rounded-full p-0.5 transition-colors ${brand.emoji ? "bg-[var(--brand-500)]" : "bg-[var(--border-strong)]"}`}>
                  <span className={`block size-5 rounded-full bg-white transition-transform ${brand.emoji ? "-translate-x-5" : ""}`} />
                </span>
              </button>
            </div>

            <Field label="راهنمای سبک (از منبع یا دستی)">
              <textarea
                value={brand.styleGuide || ""}
                onChange={(e) => patch({ styleGuide: e.target.value })}
                rows={4}
                placeholder="توضیح لحن، ساختار و ادبیات محتوا — هنگام تولید هوشمند به کار می‌رود. می‌توانی از «الگوبرداری از یک منبع» پرش کنی یا دستی بنویسی."
                className="w-full resize-none rounded-[var(--radius-md)] bg-[var(--input-background)] border border-[var(--border-subtle)] px-3 py-2.5 text-[13.5px] leading-[1.8] outline-none focus:border-[var(--brand-500)]"
              />
            </Field>
            </div>
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 p-4 pb-[calc(16px+var(--safe-bottom))] bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent">
        <button
          onClick={save}
          disabled={saving || loading}
          className="w-full h-12 rounded-[var(--radius-lg)] bg-[var(--brand-500)] text-white text-[15px] font-semibold tap press flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Check className="size-5" />
          {saving ? "در حال ذخیره…" : "ذخیرهٔ پروفایل برند"}
        </button>
      </div>
    </MobileScreen>
  );
}

function srcHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function srcTypeLabel(type: string): string {
  return type === "telegram" ? "تلگرام" : type === "rss" ? "RSS/خبری" : type === "blend" ? "ترکیبی" : "وب";
}

function Row({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <div className="flex gap-1.5">
      <dt className="text-[var(--foreground-subtle)] shrink-0">{k}:</dt>
      <dd className="text-[var(--foreground)] min-w-0">{v}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 mt-4">
      <div className="text-[12.5px] font-medium text-[var(--foreground-muted)] mb-1.5">{label}</div>
      {children}
    </div>
  );
}
