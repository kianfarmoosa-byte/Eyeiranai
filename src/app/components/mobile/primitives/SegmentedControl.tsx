import { useId } from "react";
import { motion } from "motion/react";
import { useHaptics } from "../hooks";

export type Segment<T extends string> = { id: T; label: string; badge?: number };

type Props<T extends string> = {
  value: T;
  onChange: (v: T) => void;
  segments: Segment<T>[];
  /** Fill the parent width (default true). Use false for compact inline use. */
  full?: boolean;
};

/**
 * iOS-style segmented control with an animated pill indicator behind the active
 * segment. The active pill uses Motion's `layoutId` to slide between segments.
 */
export function SegmentedControl<T extends string>({ value, onChange, segments, full = true }: Props<T>) {
  const layoutId = useId();
  const haptic = useHaptics();
  return (
    <div
      role="tablist"
      className={`relative inline-flex p-0.5 rounded-full bg-[var(--accent)] ${full ? "w-full" : ""}`}
    >
      {segments.map((s) => {
        const on = s.id === value;
        return (
          <button
            key={s.id}
            role="tab"
            aria-selected={on}
            onClick={() => { if (!on) { haptic("select"); onChange(s.id); } }}
            className={`relative z-10 flex-1 h-9 px-3 rounded-full text-[12.5px] font-semibold tap whitespace-nowrap transition-colors ${
              on ? "text-[var(--foreground)]" : "text-[var(--foreground-subtle)]"
            }`}
          >
            {on && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-[var(--background)] shadow-[var(--shadow-sm)]"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {s.label}
              {typeof s.badge === "number" && s.badge > 0 && (
                <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] grid place-items-center font-semibold tabular-nums ${
                  on ? "bg-[var(--brand-500)] text-white" : "bg-[var(--background)] text-[var(--foreground-subtle)]"
                }`}>
                  {s.badge > 99 ? "+۹۹" : s.badge.toLocaleString("fa-IR")}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
