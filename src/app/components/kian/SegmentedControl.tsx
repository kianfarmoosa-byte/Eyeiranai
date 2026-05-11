import type { ReactNode } from "react";

type Item<T extends string> = {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
};

type Props<T extends string> = {
  value: T;
  onChange: (v: T) => void;
  items: Item<T>[];
  size?: "sm" | "md";
  className?: string;
};

export function SegmentedControl<T extends string>({
  value, onChange, items, size = "sm", className = "",
}: Props<T>) {
  const isSm = size === "sm";
  return (
    <div role="tablist"
      className={[
        "inline-flex items-center p-0.5 rounded-[var(--radius-md)]",
        "bg-[var(--background-subtle)] border border-[var(--border-subtle)]",
        className,
      ].join(" ")}>
      {items.map(it => {
        const active = it.value === value;
        return (
          <button key={it.value} role="tab" aria-selected={active}
            onClick={() => onChange(it.value)}
            className={[
              "relative inline-flex items-center gap-1.5 rounded-[var(--radius-sm)]",
              "transition-all duration-[var(--duration-fast)] ease-[var(--ease-out-quart)]",
              "select-none whitespace-nowrap",
              isSm ? "h-6 px-2 text-[11px]" : "h-8 px-3 text-xs",
              active
                ? "bg-[var(--card)] text-[var(--foreground)] shadow-[var(--shadow-xs)] font-medium"
                : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]",
            ].join(" ")}>
            {it.icon}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
