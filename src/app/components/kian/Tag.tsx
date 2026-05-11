import type { HTMLAttributes, ReactNode } from "react";
import { X } from "lucide-react";

type Tone = "neutral" | "brand" | "violet" | "amber";
type Props = HTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  tone?: Tone;
  leading?: ReactNode;
  onClose?: () => void;
};

const ACTIVE: Record<Tone, string> = {
  neutral: "bg-[var(--neutral-900)] text-white border-[var(--neutral-900)] dark:bg-[var(--neutral-100)] dark:text-[var(--neutral-1000)] dark:border-[var(--neutral-100)]",
  brand:   "bg-[var(--brand-600)]  text-white border-[var(--brand-600)]",
  violet:  "bg-[oklch(0.55_0.22_305)] text-white border-[oklch(0.55_0.22_305)]",
  amber:   "bg-[var(--warning-600)] text-white border-[var(--warning-600)]",
};

export function Tag({
  active, tone = "neutral", leading, onClose, children, className = "", ...rest
}: Props) {
  return (
    <button
      className={[
        "shrink-0 inline-flex items-center gap-1 px-2.5 h-6 rounded-full text-[11px] border",
        "transition-[background,border-color,color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out-quart)]",
        active
          ? `${ACTIVE[tone]} shadow-[var(--shadow-xs)]`
          : "border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] hover:border-[var(--border-strong)]",
        className,
      ].join(" ")}
      {...rest}
    >
      {leading}
      <span className="truncate max-w-[160px]">{children}</span>
      {onClose && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="opacity-60 hover:opacity-100 hover:text-[var(--danger-500)] cursor-pointer"
        >
          <X className="size-3" />
        </span>
      )}
    </button>
  );
}
