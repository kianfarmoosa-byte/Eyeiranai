import type { ReactNode } from "react";

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
};

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="mt-12 mx-auto max-w-xs flex flex-col items-center text-center gap-3 px-4">
      {icon && (
        <div className="size-14 grid place-items-center rounded-full bg-[var(--accent)] text-[var(--foreground-muted)]">
          {icon}
        </div>
      )}
      <div className="text-[15px] font-semibold">{title}</div>
      {description && (
        <div className="text-[12.5px] text-[var(--foreground-subtle)] leading-relaxed">{description}</div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-1 h-10 px-5 rounded-full bg-[var(--brand-500)] hover:bg-[var(--brand-600)] text-white text-[13px] font-semibold tap press"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
