import type { ReactNode } from "react";

export type Chip = {
  id: string;
  label: ReactNode;
  count?: number;
  leading?: ReactNode;
};

type Props = {
  items: Chip[];
  /** Active chip id (single-select). null = none active. */
  value: string | null;
  onChange: (id: string | null) => void;
  /** Show an "All" chip prepended. */
  withAll?: boolean;
  allLabel?: string;
};

/**
 * Horizontally scrollable single-select chip strip with snap-aligned items.
 * Tapping the active chip clears the selection (returns null) so the strip
 * doubles as both a filter and a toggle.
 */
export function ChipScroller({ items, value, onChange, withAll = true, allLabel = "همه" }: Props) {
  return (
    <div className="-mx-3 px-3 overflow-x-auto scrollbar-none">
      <div className="flex gap-2 snap-x snap-mandatory">
        {withAll && (
          <Pill on={value === null} onClick={() => onChange(null)}>{allLabel}</Pill>
        )}
        {items.map((c) => {
          const on = c.id === value;
          return (
            <Pill key={c.id} on={on} onClick={() => onChange(on ? null : c.id)}>
              {c.leading}
              <span className="truncate max-w-[140px]">{c.label}</span>
              {typeof c.count === "number" && c.count > 0 && (
                <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] grid place-items-center font-semibold tabular-nums ${
                  on ? "bg-white/20 text-white" : "bg-[var(--accent)] text-[var(--foreground-subtle)]"
                }`}>
                  {c.count.toLocaleString("fa-IR")}
                </span>
              )}
            </Pill>
          );
        })}
      </div>
    </div>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 snap-start h-9 px-3.5 rounded-full text-[12.5px] tap press border flex items-center gap-1.5 whitespace-nowrap transition-colors ${
        on ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]"
           : "bg-[var(--surface)] text-[var(--foreground)] border-[var(--border-subtle)]"
      }`}
    >
      {children}
    </button>
  );
}
