import type { HTMLAttributes, ReactNode } from "react";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "violet";
type Variant = "soft" | "solid" | "outline" | "dot";
type Size = "xs" | "sm" | "md";

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  variant?: Variant;
  size?: Size;
  leading?: ReactNode;
  trailing?: ReactNode;
};

const SIZE: Record<Size, string> = {
  xs: "h-5 px-1.5 text-[10px] gap-1 rounded-[var(--radius-xs)]",
  sm: "h-6 px-2 text-[11px] gap-1 rounded-[var(--radius-sm)]",
  md: "h-7 px-2.5 text-xs gap-1.5 rounded-[var(--radius-md)]",
};

// Tone primitives keyed against design tokens.
const SOFT: Record<Tone, string> = {
  neutral: "bg-[var(--neutral-100)] text-[var(--neutral-700)] dark:bg-[var(--neutral-800)] dark:text-[var(--neutral-200)]",
  brand:   "bg-[var(--brand-50)]    text-[var(--brand-700)]   dark:bg-[oklch(0.30_0.10_258)] dark:text-[var(--brand-200)]",
  success: "bg-[var(--success-50)]  text-[var(--success-600)] dark:bg-[var(--success-900)]  dark:text-[oklch(0.85_0.13_155)]",
  warning: "bg-[var(--warning-50)]  text-[var(--warning-600)] dark:bg-[var(--warning-900)]  dark:text-[oklch(0.85_0.13_75)]",
  danger:  "bg-[var(--danger-50)]   text-[var(--danger-600)]  dark:bg-[var(--danger-900)]   dark:text-[oklch(0.82_0.16_25)]",
  info:    "bg-[var(--info-50)]     text-[var(--info-600)]    dark:bg-[var(--info-900)]     dark:text-[oklch(0.85_0.13_220)]",
  violet:  "bg-[oklch(0.95_0.04_305)] text-[oklch(0.45_0.20_305)] dark:bg-[oklch(0.30_0.12_305)] dark:text-[oklch(0.85_0.15_305)]",
};

const SOLID: Record<Tone, string> = {
  neutral: "bg-[var(--neutral-700)] text-white",
  brand:   "bg-[var(--brand-600)]   text-white",
  success: "bg-[var(--success-600)] text-white",
  warning: "bg-[var(--warning-600)] text-white",
  danger:  "bg-[var(--danger-600)]  text-white",
  info:    "bg-[var(--info-600)]    text-white",
  violet:  "bg-[oklch(0.55_0.22_305)] text-white",
};

const OUTLINE: Record<Tone, string> = {
  neutral: "border border-[var(--border-strong)] text-[var(--foreground-muted)]",
  brand:   "border border-[var(--brand-300)]    text-[var(--brand-600)]    dark:text-[var(--brand-300)]",
  success: "border border-[oklch(0.85_0.10_155)] text-[var(--success-600)]",
  warning: "border border-[oklch(0.85_0.10_85)]  text-[var(--warning-600)]",
  danger:  "border border-[oklch(0.85_0.10_25)]  text-[var(--danger-600)]",
  info:    "border border-[oklch(0.85_0.10_220)] text-[var(--info-600)]",
  violet:  "border border-[oklch(0.80_0.10_305)] text-[oklch(0.45_0.20_305)]",
};

const DOT_COLOR: Record<Tone, string> = {
  neutral: "bg-[var(--neutral-500)]",
  brand:   "bg-[var(--brand-500)]",
  success: "bg-[var(--success-500)]",
  warning: "bg-[var(--warning-500)]",
  danger:  "bg-[var(--danger-500)]",
  info:    "bg-[var(--info-500)]",
  violet:  "bg-[oklch(0.62_0.22_305)]",
};

export function Badge({
  tone = "neutral", variant = "soft", size = "sm",
  leading, trailing, children, className = "", ...rest
}: Props) {
  const tonal =
    variant === "solid"   ? SOLID[tone]
  : variant === "outline" ? OUTLINE[tone]
  : variant === "dot"     ? "bg-transparent text-[var(--foreground-muted)]"
  :                         SOFT[tone];

  return (
    <span className={[
      "inline-flex items-center font-medium tracking-tight whitespace-nowrap",
      "tabular-nums",
      SIZE[size],
      tonal,
      className,
    ].join(" ")} {...rest}>
      {variant === "dot" && <span className={`size-1.5 rounded-full ${DOT_COLOR[tone]}`} />}
      {leading}
      {children}
      {trailing}
    </span>
  );
}
