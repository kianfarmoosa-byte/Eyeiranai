import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "subtle";
type Size = "xs" | "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeading?: ReactNode;
  iconTrailing?: ReactNode;
  full?: boolean;
};

const SIZE_MAP: Record<Size, string> = {
  xs: "h-6 px-2 text-[11px] gap-1 rounded-[var(--radius-sm)]",
  sm: "h-8 px-3 text-xs gap-1.5 rounded-[var(--radius-md)]",
  md: "h-9 px-3.5 text-sm gap-2 rounded-[var(--radius-md)]",
  lg: "h-11 px-5 text-base gap-2 rounded-[var(--radius-lg)]",
};

const VARIANT_MAP: Record<Variant, string> = {
  primary:
    "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] " +
    "shadow-[var(--shadow-xs)] active:translate-y-[0.5px]",
  secondary:
    "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--accent)] " +
    "border border-[var(--border-subtle)]",
  ghost:
    "text-[var(--foreground)] hover:bg-[var(--accent)]",
  outline:
    "border border-[var(--border-strong)] text-[var(--foreground)] hover:bg-[var(--accent)] " +
    "hover:border-[var(--foreground-subtle)]",
  danger:
    "bg-[var(--destructive)] text-[var(--destructive-foreground)] " +
    "hover:brightness-110 active:translate-y-[0.5px]",
  subtle:
    "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "secondary", size = "md", loading, iconLeading, iconTrailing, full, children, className = "", disabled, ...rest },
  ref,
) {
  return (
    <button ref={ref} disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center font-medium select-none",
        "transition-[background,color,border-color,transform,box-shadow]",
        "duration-[var(--duration-fast)] ease-[var(--ease-out-quart)]",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0",
        full ? "w-full" : "",
        SIZE_MAP[size],
        VARIANT_MAP[variant],
        className,
      ].join(" ")}
      {...rest}>
      {loading ? <Spinner /> : iconLeading}
      {children}
      {iconTrailing}
    </button>
  );
});

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
