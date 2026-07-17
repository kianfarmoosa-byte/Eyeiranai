import { useMemo } from "react";
import type { GdeltArticle } from "../gdelt";

type Props = {
  articles: GdeltArticle[];
  activeCountry: string;
  onPick: (code: string) => void;
};

const FLAGS: Record<string, string> = {
  US: "🇺🇸", GB: "🇬🇧", FR: "🇫🇷", DE: "🇩🇪", RU: "🇷🇺", CN: "🇨🇳",
  IR: "🇮🇷", TR: "🇹🇷", SA: "🇸🇦", IL: "🇮🇱", AE: "🇦🇪", IQ: "🇮🇶",
  IN: "🇮🇳", PK: "🇵🇰", JP: "🇯🇵", KR: "🇰🇷", CA: "🇨🇦", AU: "🇦🇺",
  IT: "🇮🇹", ES: "🇪🇸", BR: "🇧🇷", MX: "🇲🇽", EG: "🇪🇬", SY: "🇸🇾",
  LB: "🇱🇧", AF: "🇦🇫", QA: "🇶🇦", JO: "🇯🇴", YE: "🇾🇪", UA: "🇺🇦",
};

export function GdeltCountryStrip({ articles, activeCountry, onPick }: Props) {
  const dist = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of articles) {
      const k = a.sourceCountry || "?";
      m.set(k, (m.get(k) || 0) + 1);
    }
    const arr = Array.from(m.entries())
      .filter(([k]) => k && k !== "?")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 18);
    const max = arr.reduce((m, [, n]) => Math.max(m, n), 1);
    return { arr, max };
  }, [articles]);

  if (dist.arr.length === 0) return null;

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-2 bg-slate-50/40 dark:bg-slate-900/30">
      <div className="text-[10px] text-slate-500 mb-1 flex items-center gap-1">
        <span>🌐</span>
        <span>توزیع منابع بر اساس کشور — کلیک برای فیلتر</span>
      </div>
      <div className="flex items-end gap-1 overflow-x-auto">
        {dist.arr.map(([code, n]) => {
          const h = Math.max(8, (n / dist.max) * 36);
          const active = activeCountry === code;
          return (
            <button key={code} onClick={() => onPick(active ? "" : code)}
              className={`group shrink-0 flex flex-col items-center gap-0.5 px-1 py-0.5 rounded ${
                active ? "bg-emerald-100 dark:bg-emerald-900/40" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
              title={`${code}: ${n.toLocaleString("fa-IR")} مقاله`}>
              <span className="text-[10px] tabular-nums text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300">
                {n.toLocaleString("fa-IR")}
              </span>
              <div className={`w-5 rounded-sm ${active ? "bg-emerald-500" : "bg-gradient-to-t from-cyan-500 to-emerald-500"}`} style={{ height: `${h}px` }} />
              <span className="text-sm leading-none">{FLAGS[code] || "🏳"}</span>
              <span className="text-[10px] text-slate-500 tabular-nums">{code}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
