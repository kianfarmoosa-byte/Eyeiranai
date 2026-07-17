import { useEffect, useState } from "react";
import { Minus, Plus, Sun, Moon, Monitor, Trash2, Download, Bell, Type, LayoutGrid, Palette, Check } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { useHaptics } from "../hooks";
import { useToast } from "../primitives/Toast";
import { DEFAULT_READER_SETTINGS, type ReaderSettings } from "../sheets/ReaderSettingsSheet";
import { ACCENTS, loadAccentId, saveAccentId, applyAccent } from "../utils/accent";
import { toFa } from "../utils/fa";

const RS_KEY = "kian.mobile.readerSettings";

type Props = {
  onClose: () => void;
  onToggleTheme?: () => void;
  themeMode?: "light" | "dark" | "auto";
  onOpenWidgetPreview?: () => void;
};

export function SettingsScreen({ onClose, onToggleTheme, themeMode = "auto", onOpenWidgetPreview }: Props) {
  const [rs, setRs] = useState<ReaderSettings>(() => {
    try { return { ...DEFAULT_READER_SETTINGS, ...JSON.parse(localStorage.getItem(RS_KEY) || "{}") }; }
    catch { return DEFAULT_READER_SETTINGS; }
  });
  const [accentId, setAccentId] = useState<string>(() => loadAccentId());
  const haptic = useHaptics();
  const toast = useToast();

  const pickAccent = (id: string) => {
    haptic("select");
    setAccentId(id);
    saveAccentId(id);
    applyAccent(id);
  };

  useEffect(() => {
    try { localStorage.setItem(RS_KEY, JSON.stringify(rs)); } catch {}
  }, [rs]);

  const patch = (p: Partial<ReaderSettings>) => { haptic("select"); setRs((s) => ({ ...s, ...p })); };

  const clearCache = () => {
    haptic("heavy");
    const keep = ["kian.mobile.onboarded", "kn.notes", RS_KEY];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && !keep.includes(k)) localStorage.removeItem(k);
    }
    toast({ kind: "success", title: "حافظه پاک شد" });
  };

  return (
    <MobileScreen topbar={<MobileTopBar title="تنظیمات" onBack={onClose} />}>
      <div className="h-full overflow-y-auto scrollbar-none pb-6">
        <Section title="ظاهر">
          <div className="px-3.5 py-3">
            <div className="text-[12.5px] text-[var(--foreground-subtle)] mb-2">پوسته</div>
            <div className="grid grid-cols-3 gap-2">
              <ThemeChip on={themeMode === "light"} icon={<Sun className="size-4" />} label="روشن" onClick={onToggleTheme} />
              <ThemeChip on={themeMode === "auto"}  icon={<Monitor className="size-4" />} label="خودکار" onClick={onToggleTheme} />
              <ThemeChip on={themeMode === "dark"}  icon={<Moon className="size-4" />} label="تیره"  onClick={onToggleTheme} />
            </div>
          </div>
        </Section>

        <Section title="رنگ تأکید">
          <div className="px-3.5 py-3">
            <div className="flex items-center gap-2 mb-2 text-[12.5px] text-[var(--foreground-subtle)]">
              <Palette className="size-3.5" />
              <span>رنگ برند را شخصی‌سازی کن</span>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {ACCENTS.map((a) => {
                const on = accentId === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => pickAccent(a.id)}
                    aria-label={a.name}
                    className={`relative size-10 rounded-full tap press grid place-items-center ring-offset-2 ring-offset-[var(--surface)] ${on ? "ring-2 ring-[var(--foreground)]" : ""}`}
                    style={{ background: a.swatch }}
                  >
                    {on && <Check className="size-4 text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        <Section title="مطالعه">
          <Stepper
            icon={<Type className="size-4" />}
            label="اندازه متن"
            value={`${rs.fontSize}px`}
            onMinus={() => patch({ fontSize: Math.max(14, rs.fontSize - 1) })}
            onPlus={() => patch({ fontSize: Math.min(24, rs.fontSize + 1) })}
          />
          <Stepper
            label="فاصله خطوط"
            value={rs.lineHeight.toFixed(2)}
            onMinus={() => patch({ lineHeight: Math.max(1.4, +(rs.lineHeight - 0.1).toFixed(2)) })}
            onPlus={() => patch({ lineHeight: Math.min(2.4, +(rs.lineHeight + 0.1).toFixed(2)) })}
          />
          <div className="px-3.5 py-3 border-t border-[var(--border-subtle)]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px]">سرعت پخش صوتی</span>
              <span className="text-[12px] tabular-nums">{toFa(rs.ttsRate.toFixed(1))}×</span>
            </div>
            <input
              type="range" min={0.5} max={2} step={0.1}
              value={rs.ttsRate}
              onChange={(e) => patch({ ttsRate: +e.target.value })}
              className="w-full accent-[var(--brand-500)]"
            />
          </div>
        </Section>

        <Section title="اعلان‌ها و حافظه">
          <Row icon={<Bell className="size-4" />} label="اعلان‌های جدید" hint="به‌زودی" />
          <Row icon={<Download className="size-4" />} label="حافظه آفلاین" hint="فعال" />
          <Row icon={<Trash2 className="size-4" />} label="پاک‌سازی حافظهٔ موقت" danger onClick={clearCache} />
        </Section>

        <Section title="ویجت‌ها">
          <Row
            icon={<LayoutGrid className="size-4" />}
            label="پیش‌نمایش ویجت صفحهٔ قفل"
            hint="نمایش"
            onClick={onOpenWidgetPreview}
          />
        </Section>

        <div className="mt-6 text-center text-[11px] text-[var(--foreground-subtle)]">
          flow · نسخه ۱.۰
        </div>
      </div>
    </MobileScreen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="px-4 mb-1.5 text-[11.5px] font-semibold text-[var(--foreground-subtle)] tracking-wide">{title}</div>
      <div className="mx-3 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function Row({ icon, label, hint, onClick, danger }: {
  icon?: React.ReactNode; label: string; hint?: string; onClick?: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full tap press flex items-center gap-3 px-3.5 py-3 text-right ${danger ? "text-rose-500" : ""}`}
    >
      {icon && <span className={`size-8 grid place-items-center rounded-full ${danger ? "bg-rose-500/10" : "bg-[var(--accent)] text-[var(--foreground-muted)]"}`}>{icon}</span>}
      <span className="flex-1 text-[14px]">{label}</span>
      {hint && <span className="text-[12px] text-[var(--foreground-subtle)]">{hint}</span>}
    </button>
  );
}

function Stepper({ icon, label, value, onMinus, onPlus }: {
  icon?: React.ReactNode; label: string; value: string; onMinus: () => void; onPlus: () => void;
}) {
  return (
    <div className="px-3.5 py-3 flex items-center gap-3">
      {icon && <span className="size-8 grid place-items-center rounded-full bg-[var(--accent)] text-[var(--foreground-muted)]">{icon}</span>}
      <span className="flex-1 text-[14px]">{label}</span>
      <span className="text-[12px] tabular-nums text-[var(--foreground-subtle)] ml-2">{value}</span>
      <button onClick={onMinus} aria-label="کاهش" className="size-9 rounded-full border border-[var(--border-subtle)] grid place-items-center tap press active:bg-[var(--accent)]">
        <Minus className="size-4" />
      </button>
      <button onClick={onPlus} aria-label="افزایش" className="size-9 rounded-full border border-[var(--border-subtle)] grid place-items-center tap press active:bg-[var(--accent)]">
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function ThemeChip({ on, icon, label, onClick }: { on: boolean; icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`h-12 rounded-[var(--radius-md)] border tap press flex flex-col items-center justify-center gap-0.5 ${
        on ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]"
           : "bg-[var(--surface)] border-[var(--border-subtle)] text-[var(--foreground)]"
      }`}
    >
      {icon}
      <span className="text-[11px]">{label}</span>
    </button>
  );
}
