import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  variant?: "rect" | "circle" | "text" | "title";
  w?: string | number;
  h?: string | number;
};

export function Skeleton({ variant = "rect", w, h, className = "", style, ...rest }: Props) {
  const base = "kian-skeleton bg-gradient-to-r from-[var(--muted)] via-[var(--background-muted)] to-[var(--muted)] bg-[length:200%_100%]";
  const shape =
    variant === "circle" ? "rounded-full" :
    variant === "text"   ? "rounded-[var(--radius-xs)] h-3" :
    variant === "title"  ? "rounded-[var(--radius-sm)] h-5" :
                           "rounded-[var(--radius-md)]";
  return (
    <div
      className={`${base} ${shape} ${className}`}
      style={{ width: w, height: h, ...style }}
      {...rest}
    />
  );
}

/* Add the shimmer keyframes once. */
export function SkeletonStyles() {
  return (
    <style>{`
      @keyframes kian-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      .kian-skeleton { animation: kian-shimmer 1.4s var(--ease-in-out-quart) infinite; }
    `}</style>
  );
}

/* Compose into list rows */
export function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 px-5 py-3 border-b border-[var(--border-subtle)]">
      <Skeleton variant="rect" className="size-14 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="title" w="78%" />
        <Skeleton variant="text"  w="55%" />
      </div>
    </div>
  );
}
