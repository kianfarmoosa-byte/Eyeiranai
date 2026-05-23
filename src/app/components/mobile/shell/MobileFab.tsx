import type { ReactNode } from "react";

type Props = {
  onClick?: () => void;
  icon: ReactNode;
  label?: string;
  /** Brand-colored circular FAB by default; "ghost" is a flat outlined variant. */
  variant?: "primary" | "ghost";
  /** Extended FAB shows label inline. */
  extended?: boolean;
};

export function MobileFab({ onClick, icon, label, variant = "primary", extended }: Props) {
  const base = "tap press rounded-full grid place-items-center shadow-[var(--shadow-lg)] active:shadow-[var(--shadow-md)]";
  const tone = variant === "primary"
    ? "bg-[var(--brand-500)] hover:bg-[var(--brand-600)] text-white"
    : "bg-[var(--background)] text-[var(--foreground)] border border-[var(--border)]";

  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`${base} ${tone} ${extended ? "h-12 px-5 gap-2 flex" : "size-14"}`}
    >
      {icon}
      {extended && label && <span className="text-[13.5px] font-semibold">{label}</span>}
    </button>
  );
}
