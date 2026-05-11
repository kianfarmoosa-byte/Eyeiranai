import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLElement> & { keys?: string[] };

export function Kbd({ keys, children, className = "", ...rest }: Props) {
  const items = keys ?? (typeof children === "string" ? children.split("+") : null);
  if (!items) {
    return (
      <kbd className={`font-mono text-[10px] px-1.5 h-5 inline-flex items-center
                       border border-[var(--border-strong)] rounded-[var(--radius-xs)]
                       bg-[var(--background-subtle)] text-[var(--foreground-muted)]
                       shadow-[var(--shadow-xs)] ${className}`} {...rest}>{children}</kbd>
    );
  }
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} {...rest}>
      {items.map((k, i) => (
        <kbd key={i} className="font-mono text-[10px] px-1.5 h-5 inline-flex items-center
                                 border border-[var(--border-strong)] rounded-[var(--radius-xs)]
                                 bg-[var(--background-subtle)] text-[var(--foreground-muted)]
                                 shadow-[var(--shadow-xs)]">
          {k.trim()}
        </kbd>
      ))}
    </span>
  );
}
