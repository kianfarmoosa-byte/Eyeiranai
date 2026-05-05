import { useMemo } from "react";

type Props = {
  buckets: number[];
  color?: string;
  width?: number;
  height?: number;
};

export function TopicSparkline({ buckets, color = "currentColor", width = 36, height = 12 }: Props) {
  const path = useMemo(() => {
    const max = Math.max(1, ...buckets);
    const n = buckets.length;
    if (n < 2) return "";
    const step = width / (n - 1);
    return buckets
      .map((v, i) => {
        const x = i * step;
        const y = height - (v / max) * (height - 1) - 0.5;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [buckets, width, height]);

  if (!path) return null;
  const total = buckets.reduce((s, v) => s + v, 0);
  if (total === 0) return null;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="opacity-70">
      <path d={path} fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
