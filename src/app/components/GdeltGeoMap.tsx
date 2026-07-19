import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MapPin, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import { feature } from "topojson-client";
import { gdeltGeo, type GdeltDocQuery } from "../gdelt";
import { toFa } from "./mobile/utils/fa";

type Props = {
  query: GdeltDocQuery;
  // پس از پایان هر واکشی (موفق یا ناموفق، اما نه لغوشده) صدا زده می‌شود؛
  // به مصرف‌کننده اجازه می‌دهد واکشی‌ها را زنجیره‌ای اجرا کند (مثل پخش زمانی).
  onLoaded?: () => void;
};

type Point = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  count: number;
  tone?: number;
};

function extractPoints(geo: any): Point[] {
  const features = Array.isArray(geo?.features) ? geo.features : [];
  return features
    .map((f: any, i: number) => {
      const coords = f?.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) return null;
      const [lng, lat] = coords;
      const props = f?.properties || {};
      const tone = props.tone !== undefined && props.tone !== null ? Number(props.tone) : undefined;
      return {
        id: String(props.name || `${lat}_${lng}_${i}`),
        lat: Number(lat),
        lng: Number(lng),
        name: String(props.name || ""),
        count: Number(props.count) || 1,
        tone: typeof tone === "number" && isFinite(tone) ? tone : undefined,
      } as Point;
    })
    .filter((p: Point | null): p is Point => !!p && isFinite(p.lat) && isFinite(p.lng));
}

function toneColor(t?: number): string {
  if (typeof t !== "number") return "#0ea5e9";
  if (t >= 3) return "#10b981";
  if (t <= -3) return "#ef4444";
  return "#f59e0b";
}

const W = 1000;
const H = 500;
function project(lat: number, lng: number): [number, number] {
  const x = ((lng + 180) / 360) * W;
  const y = ((90 - lat) / 180) * H;
  return [x, y];
}

function ringToPath(ring: number[][]): string {
  if (!ring || ring.length === 0) return "";
  return ring.map(([lng, lat], i) => {
    const [x, y] = project(lat, lng);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ") + "Z";
}

function geomToPath(geom: any): string {
  if (!geom) return "";
  const t = geom.type;
  if (t === "Polygon") {
    return geom.coordinates.map(ringToPath).join(" ");
  }
  if (t === "MultiPolygon") {
    return geom.coordinates.flatMap((poly: number[][][]) => poly.map(ringToPath)).join(" ");
  }
  return "";
}

let WORLD_PATHS_CACHE: string[] | null = null;
async function loadWorldPaths(): Promise<string[]> {
  if (WORLD_PATHS_CACHE) return WORLD_PATHS_CACHE;
  const r = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
  const topo = await r.json();
  const fc: any = feature(topo, topo.objects.countries);
  const paths = (fc.features as any[]).map(f => geomToPath(f.geometry)).filter(Boolean);
  WORLD_PATHS_CACHE = paths;
  return paths;
}

export function GdeltGeoMap({ query, onLoaded }: Props) {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hover, setHover] = useState<Point | null>(null);
  const [worldPaths, setWorldPaths] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadWorldPaths()
      .then(p => { if (!cancelled) setWorldPaths(p); })
      .catch(e => console.warn("world atlas load failed:", e));
    return () => { cancelled = true; };
  }, []);

  const hasQuery = !!(query.q || query.theme || query.country);

  const fetchGeo = async () => {
    if (!hasQuery) { setPoints([]); setError(null); return; }
    // درخواست قبلی را لغو کن تا اتصال نیمه‌کاره روی سرور باقی نماند.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    let aborted = false;
    try {
      const r: any = await gdeltGeo(query, controller.signal);
      if (controller.signal.aborted) { aborted = true; return; }
      setPoints(extractPoints(r));
    } catch (e: any) {
      // لغو عمدی درخواست خطا نیست.
      if (e?.name === "AbortError" || controller.signal.aborted) { aborted = true; return; }
      console.error("GDELT geo failed:", e);
      setError(String(e?.message || e));
      setPoints([]);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
      // فقط برای واکشیِ به‌پایان‌رسیده (نه لغوشده) اطلاع بده.
      if (!aborted) onLoaded?.();
    }
  };

  useEffect(() => {
    fetchGeo();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.q, query.country, query.theme, query.lang, query.timespan]);

  const maxCount = useMemo(() => points.reduce((m, p) => Math.max(m, p.count), 1), [points]);

  const viewBox = useMemo(() => {
    const w = W / zoom;
    const h = H / zoom;
    const x = Math.max(0, Math.min(W - w, (W - w) / 2 + pan.x));
    const y = Math.max(0, Math.min(H - h, (H - h) / 2 + pan.y));
    return `${x} ${y} ${w} ${h}`;
  }, [zoom, pan]);

  return (
    <div className="flex-1 flex flex-col min-h-0" dir="rtl">
      <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center gap-2 text-xs">
        <MapPin className="w-4 h-4 text-emerald-500" />
        <span className="text-slate-600 dark:text-slate-300">
          {points.length.toLocaleString("fa-IR")} مکان جغرافیایی
        </span>
        <div className="flex-1" />
        {error && <span className="text-rose-500 truncate max-w-[300px]">{error}</span>}
        <button onClick={() => setZoom(z => Math.min(6, z * 1.4))} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="بزرگنمایی">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => { setZoom(z => Math.max(1, z / 1.4)); if (zoom <= 1.4) setPan({ x: 0, y: 0 }); }} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="کوچک‌نمایی">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button onClick={fetchGeo} disabled={loading}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="flex-1 min-h-0 relative bg-slate-900" dir="ltr">
        {loading && points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-300 gap-2 z-10">
            <Loader2 className="w-4 h-4 animate-spin" /> در حال دریافت داده‌های جغرافیایی...
          </div>
        )}
        <svg viewBox={viewBox} className="w-full h-full select-none" preserveAspectRatio="xMidYMid meet">
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(148,163,184,0.06)" strokeWidth="0.5" />
            </pattern>
            <radialGradient id="ocean" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width={W} height={H} fill="url(#ocean)" />
          <rect x="0" y="0" width={W} height={H} fill="url(#grid)" />
          {/* Country borders */}
          {worldPaths.map((d, i) => (
            <path key={i} d={d} fill="rgba(71,85,105,0.55)" stroke="rgba(148,163,184,0.45)" strokeWidth={0.4 / Math.sqrt(zoom)} />
          ))}
          {/* Equator + meridian lines */}
          <line x1="0" x2={W} y1={H/2} y2={H/2} stroke="rgba(148,163,184,0.18)" strokeWidth="0.5" strokeDasharray="3 4" />
          <line x1={W/2} x2={W/2} y1="0" y2={H} stroke="rgba(148,163,184,0.18)" strokeWidth="0.5" strokeDasharray="3 4" />
          {/* Latitude bands */}
          {[30, 60, -30, -60].map(lat => {
            const [, y] = project(lat, 0);
            return <line key={lat} x1="0" x2={W} y1={y} y2={y} stroke="rgba(148,163,184,0.08)" strokeWidth="0.4" />;
          })}
          {/* Points */}
          {points.map(p => {
            const [x, y] = project(p.lat, p.lng);
            const r = (3 + (p.count / maxCount) * 22) / Math.sqrt(zoom);
            const c = toneColor(p.tone);
            return (
              <g key={p.id}
                onMouseEnter={() => setHover(p)}
                onMouseLeave={() => setHover(prev => prev?.id === p.id ? null : prev)}
                style={{ cursor: "pointer" }}>
                <circle cx={x} cy={y} r={r} fill={c} fillOpacity="0.35" stroke={c} strokeWidth={0.8 / Math.sqrt(zoom)} />
                <circle cx={x} cy={y} r={Math.max(1, r * 0.3)} fill={c} />
              </g>
            );
          })}
        </svg>
        {hover && (() => {
          const [x, y] = project(hover.lat, hover.lng);
          // viewBox-relative → percent
          const vb = viewBox.split(" ").map(Number);
          const px = ((x - vb[0]) / vb[2]) * 100;
          const py = ((y - vb[1]) / vb[3]) * 100;
          return (
            <div className="pointer-events-none absolute z-10 px-2 py-1 rounded-md bg-slate-900/95 text-white text-[11px] shadow-lg border border-slate-700"
              style={{ left: `${px}%`, top: `${py}%`, transform: "translate(-50%, calc(-100% - 8px))" }} dir="rtl">
              <div className="font-medium">{hover.name || "—"}</div>
              <div>پوشش: {hover.count.toLocaleString("fa-IR")}</div>
              {typeof hover.tone === "number" && <div>لحن: {toFa(hover.tone.toFixed(2))}</div>}
            </div>
          );
        })()}
        <div className="absolute bottom-3 left-3 z-10 bg-slate-900/85 backdrop-blur rounded-md shadow px-2 py-1.5 text-[10px] text-white flex items-center gap-2" dir="rtl">
          <span>لحن:</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> مثبت</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> خنثی</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> منفی</span>
          <span className="opacity-60">·</span>
          <span>اندازه = حجم</span>
        </div>
        {!loading && points.length === 0 && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm pointer-events-none">
            داده‌ای برای نمایش روی نقشه نیست.
          </div>
        )}
      </div>
    </div>
  );
}
