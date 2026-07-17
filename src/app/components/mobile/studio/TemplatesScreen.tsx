import { useEffect, useState } from "react";
import { Plus, Trash2, Check, FileText, ChevronLeft, Sparkles, LibraryBig } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { useHaptics } from "../hooks";
import { useToast } from "../primitives/Toast";
import { api, type ContentTemplate, type StudioPlatform } from "../../../api";
import { studioUserId, emptyTemplate, INPUT_CLS, PLATFORM_META, ALL_PLATFORMS } from "./studio";
import { CARD_THEMES, CARD_RATIOS, renderNewsCard, type CardTheme, type CardRatio } from "./newsCard";
import { TEMPLATE_FORMATS, TEMPLATE_PRESETS, presetToTemplate, type TemplatePreset } from "./templatePresets";

type Props = { onClose: () => void };

export function TemplatesScreen({ onClose }: Props) {
  const haptic = useHaptics();
  const toast = useToast();
  const uid = studioUserId();
  const [list, setList] = useState<ContentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ContentTemplate | null>(null);
  const [tab, setTab] = useState<"mine" | "library">("mine");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await api.studioGetTemplates(uid);
        if (!cancelled) setList(t);
      } catch (e) {
        console.log("load templates failed:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  const save = async (tpl: ContentTemplate) => {
    haptic("select");
    try {
      const next = await api.studioSaveTemplate(uid, tpl);
      setList(next);
      setEditing(null);
      toast({ kind: "success", message: "قالب ذخیره شد" });
    } catch (e) {
      console.log("save template failed:", e);
      toast({ kind: "error", message: "ذخیره ناموفق بود" });
    }
  };

  const remove = async (id: string) => {
    haptic("heavy");
    try {
      await api.studioDeleteTemplate(uid, id);
      setList((l) => l.filter((t) => t.id !== id));
      toast({ kind: "success", message: "قالب حذف شد" });
    } catch (e) {
      console.log("delete template failed:", e);
    }
  };

  // One-tap add from the ready-made library → saves as the user's template.
  const addPreset = async (p: TemplatePreset) => {
    haptic("select");
    try {
      const next = await api.studioSaveTemplate(uid, presetToTemplate(p));
      setList(next);
      setTab("mine");
      toast({ kind: "success", message: `«${p.name}» به قالب‌هایت اضافه شد` });
    } catch (e) {
      console.log("add preset failed:", e);
      toast({ kind: "error", message: "افزودن ناموفق بود" });
    }
  };

  if (editing) {
    return <TemplateEditor initial={editing} onCancel={() => setEditing(null)} onSave={save} />;
  }

  return (
    <MobileScreen topbar={<MobileTopBar title="قالب‌های محتوا" onBack={onClose} />}>
      <div className="h-full overflow-y-auto scrollbar-none pb-28">
        {/* segmented tabs: my templates | ready-made library */}
        <div className="px-3 pt-3">
          <div className="flex gap-1 p-1 rounded-full bg-[var(--background-muted)] border border-[var(--border-subtle)]">
            {([
              { id: "mine" as const, label: "قالب‌های من", icon: FileText },
              { id: "library" as const, label: "کتابخانه", icon: LibraryBig },
            ]).map((tb) => {
              const on = tab === tb.id;
              const Icon = tb.icon;
              return (
                <button
                  key={tb.id}
                  onClick={() => { haptic("tap"); setTab(tb.id); }}
                  className={`flex-1 h-9 rounded-full text-[12.5px] font-medium tap press flex items-center justify-center gap-1.5 ${
                    on ? "bg-[var(--brand-500)] text-white" : "text-[var(--foreground-muted)]"
                  }`}
                >
                  <Icon className="size-4" />
                  {tb.label}
                </button>
              );
            })}
          </div>
        </div>

        {tab === "mine" ? (
          loading ? (
            <div className="px-4 py-10 text-center text-[13px] text-[var(--foreground-subtle)]">در حال بارگذاری…</div>
          ) : list.length === 0 ? (
            <div className="px-6 py-16 flex flex-col items-center text-center gap-3">
              <div className="size-14 rounded-2xl bg-[var(--background-muted)] grid place-items-center">
                <FileText className="size-6 text-[var(--foreground-subtle)]" />
              </div>
              <div className="text-[14px] font-semibold">هنوز قالبی نساخته‌ای</div>
              <div className="text-[12.5px] text-[var(--foreground-subtle)] max-w-[260px]">
                از «کتابخانه» یک قالب آماده اضافه کن یا قالب دلخواهت را بساز.
              </div>
              <button
                onClick={() => { haptic("tap"); setTab("library"); }}
                className="mt-1 h-9 px-4 rounded-full bg-[var(--brand-500)] text-white text-[12.5px] font-semibold tap press flex items-center gap-1.5"
              >
                <LibraryBig className="size-4" /> مشاهدهٔ کتابخانه
              </button>
            </div>
          ) : (
            <ul className="mt-4 mx-3 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
              {list.map((t) => (
                <li key={t.id}>
                  <div className="w-full flex items-center gap-3 px-3.5 py-3">
                    <button onClick={() => { haptic("tap"); setEditing(t); }} className="flex-1 flex items-center gap-3 text-right tap press">
                      <span className="size-8 grid place-items-center rounded-full bg-[var(--accent)] text-[var(--foreground-muted)]"><FileText className="size-4" /></span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] truncate">{t.name}</span>
                        <span className="block text-[11.5px] text-[var(--foreground-subtle)] truncate">
                          {t.platforms.map((p) => PLATFORM_META[p]?.label).join("، ")}
                        </span>
                      </span>
                      <ChevronLeft className="size-4 text-[var(--foreground-subtle)]" />
                    </button>
                    <button onClick={() => remove(t.id)} aria-label="حذف" className="size-9 grid place-items-center rounded-full tap press text-rose-500 active:bg-rose-500/10">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : (
          <TemplateLibrary onAdd={addPreset} onCustomize={(p) => { haptic("tap"); setEditing(presetToTemplate(p)); }} />
        )}
      </div>

      {tab === "mine" && (
        <div className="absolute inset-x-0 bottom-0 p-4 pb-[calc(16px+var(--safe-bottom))] bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent">
          <button
            onClick={() => { haptic("tap"); setEditing(emptyTemplate()); }}
            className="w-full h-12 rounded-[var(--radius-lg)] bg-[var(--brand-500)] text-white text-[15px] font-semibold tap press flex items-center justify-center gap-2"
          >
            <Plus className="size-5" />
            قالب جدید
          </button>
        </div>
      )}
    </MobileScreen>
  );
}

/** Gallery of ready-made presets, grouped by format. */
function TemplateLibrary({ onAdd, onCustomize }: {
  onAdd: (p: TemplatePreset) => void;
  onCustomize: (p: TemplatePreset) => void;
}) {
  return (
    <div className="px-3 mt-4 space-y-6">
      {TEMPLATE_FORMATS.map((fmt) => {
        const presets = TEMPLATE_PRESETS.filter((p) => p.format === fmt.id);
        if (presets.length === 0) return null;
        return (
          <section key={fmt.id}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-[16px]">{fmt.emoji}</span>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold leading-tight">{fmt.label}</div>
                <div className="text-[11px] text-[var(--foreground-subtle)] truncate">{fmt.desc}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {presets.map((p) => (
                <PresetCard key={p.name} preset={p} onAdd={() => onAdd(p)} onCustomize={() => onCustomize(p)} />
              ))}
            </div>
          </section>
        );
      })}
      <p className="px-1 pt-1 text-[11px] text-[var(--foreground-subtle)] leading-relaxed">
        قالب‌های آماده را می‌توانی مستقیم اضافه کنی یا پیش از افزودن، سفارشی‌سازی کنی. هنگام «ساخت محتوا»، ساختار و تم گرافیکی قالب برای تولید خودکار استفاده می‌شود.
      </p>
    </div>
  );
}

// Cache rendered preview thumbnails across tab switches / remounts.
const thumbCache = new Map<string, string>();

const SAMPLE_TITLE: Record<string, string> = {
  card: "بانک مرکزی نرخ سود بین‌بانکی را کاهش داد",
  story: "خبر فوری: توافق تازه اعلام شد",
  post: "تحلیل: پیامدهای اقتصادی تصمیم امروز",
  thread: "رشته‌توییت: مهم‌ترین نکات نشست امروز",
};

const RATIO_CSS: Record<string, string> = { square: "1 / 1", story: "9 / 16", wide: "16 / 9" };

/** Renders a real card preview (matching the preset's theme + ratio). */
function PresetThumb({ preset }: { preset: TemplatePreset }) {
  const theme = (preset.cardTheme as CardTheme) || "dark";
  const ratio = (preset.cardRatio as CardRatio) || "square";
  const key = `${preset.name}|${theme}|${ratio}`;
  const [url, setUrl] = useState<string | null>(() => thumbCache.get(key) || null);

  useEffect(() => {
    if (thumbCache.has(key)) { setUrl(thumbCache.get(key)!); return; }
    let cancelled = false;
    (async () => {
      try {
        const d = await renderNewsCard({
          title: SAMPLE_TITLE[preset.format] || "نمونهٔ عنوان خبر",
          brandName: "flow",
          accent: "#2FB08B",
          theme,
          ratio,
        });
        if (!cancelled) { thumbCache.set(key, d); setUrl(d); }
      } catch (e) {
        console.log("preset thumb render failed:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [key, preset.format, theme, ratio]);

  return (
    <div
      className="h-20 shrink-0 rounded-[var(--radius-md)] overflow-hidden border border-[var(--border-subtle)] bg-[var(--background-muted)]"
      style={{ aspectRatio: RATIO_CSS[ratio] || "1 / 1" }}
    >
      {url ? (
        <img src={url} alt={preset.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full grid place-items-center text-[var(--foreground-subtle)]">
          <FileText className="size-4" />
        </div>
      )}
    </div>
  );
}

function PresetCard({ preset, onAdd, onCustomize }: {
  preset: TemplatePreset;
  onAdd: () => void;
  onCustomize: () => void;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] p-3.5 flex flex-col gap-2.5">
      <div className="flex items-start gap-3">
        <PresetThumb preset={preset} />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold leading-tight">{preset.name}</div>
          <div className="text-[11.5px] text-[var(--foreground-subtle)] mt-0.5 line-clamp-3 leading-relaxed">{preset.desc}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {preset.platforms.map((p) => (
          <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] bg-[var(--background-muted)] border border-[var(--border-subtle)] text-[var(--foreground-muted)]">
            <span>{PLATFORM_META[p]?.emoji}</span>{PLATFORM_META[p]?.label}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <button
          onClick={onAdd}
          className="flex-1 h-9 rounded-[var(--radius-md)] bg-[var(--brand-500)] text-white text-[12.5px] font-semibold tap press flex items-center justify-center gap-1.5"
        >
          <Plus className="size-4" /> افزودن
        </button>
        <button
          onClick={onCustomize}
          className="h-9 px-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-[12.5px] tap press flex items-center justify-center gap-1.5 active:bg-[var(--accent)]"
        >
          <Sparkles className="size-4" /> سفارشی‌سازی
        </button>
      </div>
    </div>
  );
}

function TemplateEditor({ initial, onCancel, onSave }: {
  initial: ContentTemplate;
  onCancel: () => void;
  onSave: (t: ContentTemplate) => void;
}) {
  const haptic = useHaptics();
  const [t, setT] = useState<ContentTemplate>(initial);
  const patch = (p: Partial<ContentTemplate>) => setT((x) => ({ ...x, ...p }));

  const togglePlatform = (p: StudioPlatform) => {
    haptic("tap");
    patch({ platforms: t.platforms.includes(p) ? t.platforms.filter((x) => x !== p) : [...t.platforms, p] });
  };

  const canSave = t.name.trim().length > 0 && t.platforms.length > 0;

  return (
    <MobileScreen topbar={<MobileTopBar title={initial.id ? "ویرایش قالب" : "قالب جدید"} onBack={onCancel} />}>
      <div className="h-full overflow-y-auto scrollbar-none pb-28">
        <div className="px-4 mt-4">
          <div className="text-[12.5px] font-medium text-[var(--foreground-muted)] mb-1.5">نام قالب</div>
          <input value={t.name} onChange={(e) => patch({ name: e.target.value })} placeholder="مثلاً: تیتر داغ تلگرام" className={INPUT_CLS} />
        </div>

        <div className="px-4 mt-4">
          <div className="text-[12.5px] font-medium text-[var(--foreground-muted)] mb-1.5">پلتفرم‌های هدف</div>
          <div className="flex flex-wrap gap-2">
            {ALL_PLATFORMS.map((p) => {
              const on = t.platforms.includes(p);
              return (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`px-3 py-1.5 rounded-full text-[12.5px] border tap press flex items-center gap-1 ${
                    on ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]" : "border-[var(--border-subtle)] text-[var(--foreground-muted)]"
                  }`}
                >
                  <span>{PLATFORM_META[p].emoji}</span>
                  {PLATFORM_META[p].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 mt-4">
          <div className="text-[12.5px] font-medium text-[var(--foreground-muted)] mb-1.5">ساختار / دستور قالب</div>
          <textarea
            value={t.structure}
            onChange={(e) => patch({ structure: e.target.value })}
            rows={5}
            placeholder={"مثلاً: با یک قلاب شروع کن، سپس خلاصه در ۲ خط، در پایان {{source}} و {{link}}.\nجای‌گذارها: {{title}} {{summary}} {{bullets}} {{source}} {{link}} {{hashtags}}"}
            className="w-full resize-none rounded-[var(--radius-md)] bg-[var(--input-background)] border border-[var(--border-subtle)] px-3 py-2.5 text-[14px] leading-[1.8] outline-none focus:border-[var(--brand-500)]"
          />
        </div>

        <div className="px-4 mt-4 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-[12.5px] font-medium text-[var(--foreground-muted)] mb-1.5">حداکثر طول (کاراکتر، ۰ = آزاد)</div>
            <input
              type="number" inputMode="numeric"
              value={t.maxLength || ""}
              onChange={(e) => patch({ maxLength: Number(e.target.value) || 0 })}
              placeholder="0"
              className={INPUT_CLS}
            />
          </div>
        </div>

        <div className="px-4 mt-4 space-y-2">
          <Toggle label="افزودن لینک منبع" on={t.includeLink} onClick={() => { haptic("tap"); patch({ includeLink: !t.includeLink }); }} />
          <Toggle label="ذکر نام منبع" on={t.includeSource} onClick={() => { haptic("tap"); patch({ includeSource: !t.includeSource }); }} />
        </div>

        <div className="px-4 mt-4">
          <div className="text-[12.5px] font-medium text-[var(--foreground-muted)] mb-1.5">قالب گرافیکی کارت</div>
          <div className="flex flex-wrap gap-1.5">
            {CARD_THEMES.map((th) => (
              <button key={th.id} onClick={() => { haptic("tap"); patch({ cardTheme: th.id }); }}
                className={`px-2.5 py-1 rounded-full text-[11.5px] border tap press ${(t.cardTheme || "dark") === th.id ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]" : "border-[var(--border-subtle)] text-[var(--foreground-muted)]"}`}>
                {th.label}
              </button>
            ))}
            <span className="w-px self-stretch bg-[var(--border-subtle)] mx-0.5" />
            {CARD_RATIOS.map((rt) => (
              <button key={rt.id} onClick={() => { haptic("tap"); patch({ cardRatio: rt.id }); }}
                className={`px-2.5 py-1 rounded-full text-[11.5px] border tap press ${(t.cardRatio || "square") === rt.id ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]" : "border-[var(--border-subtle)] text-[var(--foreground-muted)]"}`}>
                {rt.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--foreground-subtle)]">هنگام تولید محتوا با این قالب، کارت برند با این تم و نسبت ساخته می‌شود.</p>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-4 pb-[calc(16px+var(--safe-bottom))] bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent">
        <button
          onClick={() => canSave && onSave(t)}
          disabled={!canSave}
          className="w-full h-12 rounded-[var(--radius-lg)] bg-[var(--brand-500)] text-white text-[15px] font-semibold tap press flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Check className="size-5" />
          ذخیرهٔ قالب
        </button>
      </div>
    </MobileScreen>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] px-3.5 py-3 tap press">
      <span className="text-[14px]">{label}</span>
      <span className={`w-11 h-6 rounded-full p-0.5 transition-colors ${on ? "bg-[var(--brand-500)]" : "bg-[var(--border-strong)]"}`}>
        <span className={`block size-5 rounded-full bg-white transition-transform ${on ? "-translate-x-5" : ""}`} />
      </span>
    </button>
  );
}
