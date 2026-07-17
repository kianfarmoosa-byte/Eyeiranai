import { useMemo, useState } from "react";
import { ExternalLink, Image as ImageIcon } from "lucide-react";
import type { GdeltArticle } from "../gdelt";
import { toFa } from "./mobile/utils/fa";

type Props = { articles: GdeltArticle[] };

function toneTint(t?: number) {
  if (typeof t !== "number") return "ring-slate-300/40";
  if (t >= 3) return "ring-emerald-400/70";
  if (t <= -3) return "ring-rose-400/70";
  return "ring-amber-400/60";
}

export function GdeltImageGallery({ articles }: Props) {
  const [active, setActive] = useState<GdeltArticle | null>(null);
  const withImages = useMemo(
    () => articles.filter(a => !!(a.image || a.socialImage)),
    [articles],
  );

  if (withImages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm gap-2 p-12">
        <ImageIcon className="w-8 h-8 opacity-50" />
        تصویری در نتایج فعلی یافت نشد.
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {withImages.map(a => (
          <button key={a.id} onClick={() => setActive(a)}
            className={`group relative aspect-square overflow-hidden rounded-md bg-slate-200 dark:bg-slate-800 ring-1 ${toneTint(a.tone)} hover:ring-2`}>
            <img src={a.image || a.socialImage} alt={a.title} loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-white text-[10px] leading-tight line-clamp-2 text-right">
              {a.title}
            </div>
            <div className="absolute top-1 left-1 bg-black/50 backdrop-blur-sm text-white text-[9px] px-1.5 py-0.5 rounded">
              {a.sourceCountry || "??"}
            </div>
          </button>
        ))}
      </div>

      {active && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setActive(null)}>
          <div className="max-w-3xl w-full bg-white dark:bg-slate-900 rounded-lg overflow-hidden shadow-2xl" dir="rtl"
            onClick={(e) => e.stopPropagation()}>
            <img src={active.image || active.socialImage} alt={active.title}
              className="w-full max-h-[60vh] object-contain bg-slate-100 dark:bg-slate-950" />
            <div className="p-4">
              <a href={active.url} target="_blank" rel="noopener noreferrer"
                className="text-sm font-medium hover:text-emerald-500 flex items-center gap-1.5">
                {active.title}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                <span>{active.domain}</span>
                <span>·</span>
                <span>{active.sourceCountry}</span>
                <span>·</span>
                <span>{active.language}</span>
                {active.date && <><span>·</span><span>{new Date(active.date).toLocaleString("fa-IR")}</span></>}
                {typeof active.tone === "number" && <><span>·</span><span>لحن {toFa(active.tone.toFixed(1))}</span></>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
