type Props = {
  size?: number;
  tone?: "brand" | "muted" | "current";
  className?: string;
};

export function Spinner({ size = 16, tone = "current", className = "" }: Props) {
  const color = tone === "brand"  ? "text-[var(--brand-500)]"
              : tone === "muted"  ? "text-[var(--foreground-subtle)]"
              :                     "text-current";
  return (
    <svg className={`animate-spin ${color} ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
