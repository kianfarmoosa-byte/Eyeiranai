import type { ReactNode } from "react";

type Props = {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE = {
  sm: { pad: "p-8", icon: "size-8", title: "text-sm", desc: "text-xs" },
  md: { pad: "p-12", icon: "size-10", title: "text-base", desc: "text-sm" },
  lg: { pad: "p-16", icon: "size-14", title: "text-lg", desc: "text-sm" },
} as const;

export function EmptyState({ icon, title, description, action, size = "md", className = "" }: Props) {
  const s = SIZE[size];
  return (
    <div className={`flex flex-col items-center justify-center text-center gap-3 ${s.pad} ${className}`}>
      {icon && (
        <div className={`text-[var(--foreground-subtle)] opacity-50 ${s.icon}`}>
          {icon}
        </div>
      )}
      <div className="space-y-1.5 max-w-sm">
        <div className={`${s.title} font-medium text-[var(--foreground)]`}>{title}</div>
        {description && (
          <div className={`${s.desc} text-[var(--foreground-muted)] leading-relaxed`}>{description}</div>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
