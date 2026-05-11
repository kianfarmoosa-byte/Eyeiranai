import { useEffect, useMemo, useState } from "react";
import { Loader2, Tv, ExternalLink, RefreshCw } from "lucide-react";
import { gdeltTv } from "../gdelt";

type Props = { q: string; timespan: string };

type TvClip = {
  id: string;
  url: string;
  network: string;
  showName: string;
  airDate: string;
  thumbnail?: string;
  preview: string;
};

const NETWORKS: Array<{ value: string; label: string }> = [
  { value: "",           label: "همه شبکه‌ها" },
  { value: "CNN",        label: "CNN" },
  { value: "FOXNEWS",    label: "Fox News" },
  { value: "MSNBC",      label: "MSNBC" },
  { value: "BBCNEWS",    label: "BBC" },
  { value: "ALJAZ",      label: "Al Jazeera" },
  { value: "RT",         label: "RT" },
  { value: "FRANCE24",   label: "France 24" },
];

function normalizeClips(raw: any): TvClip[] {
  // GDELT TV ClipGallery returns { clips: [{ ... }] }
  const arr = Array.isArray(raw?.clips) ? raw.clips : Array.isArray(raw) ? raw : [];
  return arr.map((c: any, i: number) => ({
    id: String(c.id || c.url || i),
    url: c.url || c.previewurl || "",
    network: c.network || c.station || "",
    showName: c.show_name || c.showName || c.show || "",
    airDate: c.airdate || c.date || "",
    thumbnail: c.preview_thumb || c.previewimage || c.thumbnail || undefined,
    preview: c.snippet || c.preview || "",
  })).filter((c: TvClip) => c.url);
}

export function GdeltTvGallery({ q, timespan }: Props) {
  const [network, setNetwork] = useState("");
  const [loading, setLoading] = useState(false);
  const [clips, setClips] = useState<TvClip[]>([]);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (!q.trim()) { setClips([]); return; }
    setLoading(true);
    setError(null);
    try {
      const r: any = await gdeltTv(q.trim(), { network: network || undefined, timespan });
      setClips(normalizeClips(r));
    } catch (e: any) {
      console.error("GDELT TV search failed:", e);
      setError(String(e?.message || e));
      setClips([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { search(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q, network, timespan]);

  const grouped = useMemo(() => {
    const m = new Map<string, TvClip[]>();
    for (const c of clips) {
      const k = c.network || "?";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [clips]);

  return (
    <div className="flex-1 flex flex-col min-h-0" dir="rtl">
      <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center gap-2 flex-wrap">
        <Tv className="w-4 h-4 text-rose-500" />
        <span className="text-xs text-slate-500">{clips.length.toLocaleString("fa-IR")} کلیپ تلویزیونی</span>
        <div className="flex-1" />
        <select value={network} onChange={(e) => setNetwork(e.target.value)}
          className="text-xs bg-slate-100 dark:bg-slate-800 rounded-md px-2 py-1 outline-none">
          {NETWORKS.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
        </select>
        <button onClick={search} disabled={loading || !q.trim()}
          className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && clips.length === 0 && (
          <div className="flex items-center justify-center p-12 text-slate-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> در حال دریافت کلیپ‌های تلویزیونی...
          </div>
        )}
        {error && (
          <div className="m-4 p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs">
            خطا در دریافت کلیپ‌ها: {error}
          </div>
        )}
        {!loading && clips.length === 0 && !error && (
          <div className="p-12 text-center text-slate-500 text-sm">
            {q.trim()
              ? "کلیپی برای این کلیدواژه در آرشیو تلویزیونی GDELT یافت نشد."
              : "ابتدا یک کلیدواژه در نوار جستجو وارد کنید."}
          </div>
        )}

        {grouped.map(([net, list]) => (
          <div key={net} className="border-b border-slate-100 dark:border-slate-800/70">
            <div className="sticky top-0 z-[1] bg-slate-50 dark:bg-slate-900 px-4 py-1 text-[11px] text-slate-500 flex items-center gap-2">
              <span className="font-medium">{net}</span>
              <span>·</span>
              <span>{list.length.toLocaleString("fa-IR")} کلیپ</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2">
              {list.map(c => (
                <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer"
                  className="group block rounded-md overflow-hidden border border-slate-200 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-600 bg-white dark:bg-slate-900 transition">
                  {c.thumbnail ? (
                    <img src={c.thumbnail} alt="" loading="lazy"
                      className="w-full aspect-video object-cover bg-slate-200 dark:bg-slate-800"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="w-full aspect-video bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
                      <Tv className="w-6 h-6 text-slate-400" />
                    </div>
                  )}
                  <div className="p-2">
                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                      <span className="truncate">{c.showName || "—"}</span>
                      <ExternalLink className="w-3 h-3 mr-auto opacity-50 group-hover:opacity-100" />
                    </div>
                    {c.preview && (
                      <div className="text-[11px] mt-1 line-clamp-2 leading-snug">{c.preview}</div>
                    )}
                    {c.airDate && (
                      <div className="text-[10px] text-slate-400 mt-1">{c.airDate}</div>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
