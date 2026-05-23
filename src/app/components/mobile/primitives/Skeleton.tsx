import type { CSSProperties } from "react";

type Props = {
  className?: string;
  style?: CSSProperties;
  /** Shape preset. */
  shape?: "rect" | "circle" | "text";
  /** Convenience width/height (also settable via className). */
  w?: number | string;
  h?: number | string;
};

export function Skeleton({ className = "", style, shape = "rect", w, h }: Props) {
  const radius = shape === "circle" ? "9999px" : shape === "text" ? "6px" : "var(--radius-md)";
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden bg-[var(--accent)] ${className}`}
      style={{
        width: w, height: h ?? (shape === "text" ? "0.9em" : undefined),
        borderRadius: radius, ...style,
      }}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-l from-transparent via-[var(--background)]/40 to-transparent" />
    </div>
  );
}

export function ArticleCardSkeleton() {
  return (
    <div className="flex items-stretch gap-3 px-4 py-3">
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <Skeleton w="40%" shape="text" />
        <Skeleton w="92%" shape="text" h={14} />
        <Skeleton w="85%" shape="text" h={14} />
        <Skeleton w="60%" shape="text" h={12} />
      </div>
      <Skeleton w={88} h={88} />
    </div>
  );
}
