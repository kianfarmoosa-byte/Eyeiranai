import { RefreshCw } from "lucide-react";

/**
 * Visual indicator paired with `usePullToRefresh`. Pass the `pull` value back.
 * Rotates with pull progress, then becomes a spinner once `loading` is true.
 */
export function PullIndicator({ pull, loading, triggered }: { pull: number; loading?: boolean; triggered?: boolean }) {
  return (
    <div
      style={{ height: pull, transition: pull === 0 ? "height .25s ease" : undefined }}
      className="flex items-center justify-center overflow-hidden"
    >
      <RefreshCw
        className={`size-5 transition-colors ${loading || triggered ? "text-[var(--brand-500)]" : "text-[var(--foreground-subtle)]"} ${loading ? "animate-spin" : ""}`}
        style={{ transform: loading ? undefined : `rotate(${Math.min(360, pull * 4)}deg)` }}
      />
    </div>
  );
}
