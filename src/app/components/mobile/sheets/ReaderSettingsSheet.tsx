import { Minus, Plus, Sun, Moon, Monitor } from "lucide-react";
import { BottomSheet } from "../primitives/BottomSheet";
import { useHaptics } from "../hooks";

export type ReaderSettings = {
  fontSize: number;
  lineHeight: number;
  ttsRate: number;
  theme: "light" | "dark" | "auto";
};

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: 17, lineHeight: 1.95, ttsRate: 1, theme: "auto",
};

const FS_MIN = 14, FS_MAX = 24;
const LH_MIN = 1.4, LH_MAX = 2.4;

type Props = {
  open: boolean;
  onClose: () => void;
  value: ReaderSettings;
  onChange: (v: ReaderSettings) => void;
};

export function ReaderSettingsSheet({ open, onClose, value, onChange }: Props) {
  const haptic = useHaptics();
  const patch = (p: Partial<ReaderSettings>) => { haptic("select"); onChange({ ...value, ...p }); };

  return (
    <BottomSheet open={open} onClose={onClose} title="تنظیمات مطالعه" snap="auto" snapPoints={[0.55, 0.85]}>
      <div className="px-4 py-3 flex flex-col gap-5">
        <Stepper
          label="اندازه متن"
          value={`${value.fontSize}px`}
          onMinus={() => patch({ fontSize: Math.max(FS_MIN, value.fontSize - 1) })}
          onPlus={() => patch({ fontSize: Math.min(FS_MAX, value.fontSize + 1) })}
          disabledMinus={value.fontSize <= FS_MIN}
          disabledPlus={value.fontSize >= FS_MAX}
          preview={<div style={{ fontSize: value.fontSize }} className="text-[var(--foreground)]">نمونه متن فارسی</div>}
        />
        <Stepper
          label="فاصله خطوط"
          value={value.lineHeight.toFixed(2)}
          onMinus={() => patch({ lineHeight: Math.max(LH_MIN, +(value.lineHeight - 0.1).toFixed(2)) })}
          onPlus={() => patch({ lineHeight: Math.min(LH_MAX, +(value.lineHeight + 0.1).toFixed(2)) })}
          disabledMinus={value.lineHeight <= LH_MIN}
          disabledPlus={value.lineHeight >= LH_MAX}
        />
        <div>
          <div className="text-[12px] font-semibold text-[var(--foreground-subtle)] mb-2">سرعت خواندن صوتی</div>
          <input
            type="range" min={0.5} max={2} step={0.1}
            value={value.ttsRate}
            onChange={(e) => patch({ ttsRate: +e.target.value })}
            className="w-full accent-[var(--brand-500)]"
          />
          <div className="flex justify-between text-[11px] text-[var(--foreground-subtle)] mt-1">
            <span>۰٫۵×</span>
            <span className="font-semibold text-[var(--foreground)]">{value.ttsRate.toFixed(1)}×</span>
            <span>۲×</span>
          </div>
        </div>
        <div>
          <div className="text-[12px] font-semibold text-[var(--foreground-subtle)] mb-2">پوسته</div>
          <div className="grid grid-cols-3 gap-2">
            <ThemeChip on={value.theme === "light"} icon={<Sun className="size-4" />} label="روشن" onClick={() => patch({ theme: "light" })} />
            <ThemeChip on={value.theme === "auto"}  icon={<Monitor className="size-4" />} label="خودکار" onClick={() => patch({ theme: "auto" })} />
            <ThemeChip on={value.theme === "dark"}  icon={<Moon className="size-4" />} label="تیره"  onClick={() => patch({ theme: "dark" })} />
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}

function Stepper({
  label, value, onMinus, onPlus, disabledMinus, disabledPlus, preview,
}: {
  label: string; value: string;
  onMinus: () => void; onPlus: () => void;
  disabledMinus?: boolean; disabledPlus?: boolean;
  preview?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-semibold text-[var(--foreground-subtle)]">{label}</span>
        <span className="text-[12px] tabular-nums">{value}</span>
      </div>
      <div className="flex items-center gap-2">
        <StepBtn onClick={onMinus} disabled={disabledMinus} aria="کاهش"><Minus className="size-4" /></StepBtn>
        <div className="flex-1 h-11 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface)] grid place-items-center px-3 overflow-hidden">
          {preview ?? <span className="text-[12px] text-[var(--foreground-subtle)]">—</span>}
        </div>
        <StepBtn onClick={onPlus} disabled={disabledPlus} aria="افزایش"><Plus className="size-4" /></StepBtn>
      </div>
    </div>
  );
}

function StepBtn({ children, onClick, disabled, aria }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; aria: string }) {
  return (
    <button
      onClick={onClick} disabled={disabled} aria-label={aria}
      className="size-11 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface)] grid place-items-center tap press active:bg-[var(--accent)] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ThemeChip({ on, icon, label, onClick }: { on: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
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
