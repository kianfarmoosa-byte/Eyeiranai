import { useEffect, useMemo, useRef, useState } from "react";
import { Globe2, Search, Layers, Play, Pause, History } from "lucide-react";
import { GdeltGeoMap } from "../GdeltGeoMap";
import { GDELT_PRESET_THEMES, type GdeltDocQuery } from "../../gdelt";
import { Input } from "../ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";

// ── ۳.۲ نقشهٔ رویداد زنده (Live Event Map) ──
// نقشهٔ جغرافیایی رویدادها بر پایهٔ GDELT با:
//   • لایه‌های قابل روشن/خاموش (سیاسی، اقتصادی، امنیتی، بلایای طبیعی)
//   • زیرموضوع هر لایه + جست‌وجوی آزاد
//   • پخش زمانی (Time-lapse) تحولات تا ۲۴ ساعت گذشته
// رنگ نقاط لحن رویداد و اندازهٔ آن‌ها حجم پوشش را نشان می‌دهد.

type Props = {
  initialQuery?: string;
  big?: boolean;
};

// چهار لایهٔ عملیاتی؛ هر لایه به مجموعه‌ای از کدهای موضوع GDELT نگاشت می‌شود.
type Layer = { id: string; label: string; icon: string; themes: string[] };

const LAYERS: Layer[] = [
  { id: "all", label: "همهٔ لایه‌ها", icon: "🗺️", themes: [] },
  { id: "political", label: "سیاسی", icon: "🏛️", themes: ["GOV_DIVISIONOFPOWER", "ELECTION", "PROTEST"] },
  { id: "economic", label: "اقتصادی", icon: "💰", themes: ["ECON_INFLATION", "ECON_BANKING", "ECON_OIL", "ECON_SANCTIONS"] },
  { id: "security", label: "امنیتی", icon: "🛡️", themes: ["ARMEDCONFLICT", "MILITARY", "TERROR"] },
  { id: "disaster", label: "بلایای طبیعی", icon: "🌍", themes: ["NATURAL_DISASTER", "ENV_CLIMATECHANGE", "HEALTH_PANDEMIC"] },
];

// برچسب فارسی هر کد موضوع از فهرست آماده؛ در غیر این صورت خود کد.
const THEME_LABEL: Record<string, string> = Object.fromEntries(
  GDELT_PRESET_THEMES.map(t => [t.code, `${t.icon} ${t.label}`]),
);
const EXTRA_THEME_LABEL: Record<string, string> = {
  NATURAL_DISASTER: "🌪️ بلایای طبیعی",
};
function themeLabel(code: string): string {
  return THEME_LABEL[code] || EXTRA_THEME_LABEL[code] || code;
}

const SPANS: { id: string; label: string }[] = [
  { id: "1h", label: "۱ ساعت" },
  { id: "3h", label: "۳ ساعت" },
  { id: "6h", label: "۶ ساعت" },
  { id: "12h", label: "۱۲ ساعت" },
  { id: "24h", label: "۲۴ ساعت" },
];

// فریم‌های پخش زمانی: پنجرهٔ زمانی به‌تدریج تا ۲۴ ساعت باز می‌شود.
const LAPSE_FRAMES = ["1h", "3h", "6h", "12h", "24h"];
// مکث نمایشِ هر فریم پس از کامل‌شدن واکشی آن (نه فاصلهٔ واکشی‌ها). چون فریم بعد
// تنها پس از اتمام واکشی فریم فعلی آغاز می‌شود، هیچ درخواستی لغو نمی‌شود.
const LAPSE_MS = 1500;

export function LiveEventMap({ initialQuery = "ایران", big }: Props) {
  const [q, setQ] = useState(initialQuery);
  const [draft, setDraft] = useState(initialQuery);
  const [layerId, setLayerId] = useState<string>("all");
  const [theme, setTheme] = useState<string>("");
  const [timespan, setTimespan] = useState<string>("24h");

  // پخش زمانی
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(LAPSE_FRAMES.length - 1);
  const savedSpan = useRef<string>("24h");

  const layer = LAYERS.find(l => l.id === layerId) || LAYERS[0];

  // با انتخاب لایه، موضوع اصلی آن لایه روی نقشه اعمال می‌شود (بک‌اند یک موضوع می‌پذیرد).
  function pickLayer(id: string) {
    setLayerId(id);
    const l = LAYERS.find(x => x.id === id);
    setTheme(l && l.themes.length ? l.themes[0] : "");
  }

  // پخش زمانی به‌صورت «زنجیره‌ای بر پایهٔ اتمام واکشی» است: هر فریم فقط پس از
  // کامل‌شدن واکشیِ فریم قبلی جلو می‌رود، پس هیچ درخواستی نیمه‌کاره لغو نمی‌شود
  // (که علت پیام «connection closed before message completed» روی سرور بود).
  const advanceTimer = useRef<number | null>(null);
  const fallbackTimer = useRef<number | null>(null);

  const clearTimers = () => {
    if (advanceTimer.current) { window.clearTimeout(advanceTimer.current); advanceTimer.current = null; }
    if (fallbackTimer.current) { window.clearTimeout(fallbackTimer.current); fallbackTimer.current = null; }
  };

  const advanceFrame = () => {
    clearTimers();
    setFrame(f => {
      const next = f + 1;
      if (next >= LAPSE_FRAMES.length) { setPlaying(false); return LAPSE_FRAMES.length - 1; }
      return next;
    });
  };

  // با اتمام واکشی نقشه، اگر در حال پخش هستیم، پس از مکث کوتاهِ نمایش به فریم بعد برو.
  function handleMapLoaded() {
    if (!playing) return;
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(advanceFrame, LAPSE_MS);
  }

  // ایمنی: اگر به هر دلیل رویداد اتمام واکشی نرسید، پخش قفل نشود.
  useEffect(() => {
    if (!playing) { clearTimers(); return; }
    if (fallbackTimer.current) window.clearTimeout(fallbackTimer.current);
    fallbackTimer.current = window.setTimeout(advanceFrame, LAPSE_MS + 12000);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, frame]);

  // فریم فعال پخش، پنجرهٔ زمانی مؤثر را تعیین می‌کند.
  const effectiveSpan = playing ? LAPSE_FRAMES[frame] : timespan;

  function toggleLapse() {
    if (playing) {
      clearTimers();
      setPlaying(false);
      setTimespan(savedSpan.current);
    } else {
      savedSpan.current = timespan;
      setFrame(0);
      setPlaying(true);
    }
  }

  const query: GdeltDocQuery = useMemo(() => ({
    q: q || "world",
    theme: theme || undefined,
    timespan: effectiveSpan,
    lang: "persian",
    max: 250,
    sort: "DateDesc",
  }), [q, theme, effectiveSpan]);

  const spanLabel = SPANS.find(s => s.id === effectiveSpan)?.label || effectiveSpan;

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <Globe2 className="w-4 h-4 text-cyan-500" />
        <h3 className={big ? "text-lg" : "text-sm"}>نقشهٔ رویداد زنده</h3>

        {!big && (
          <div className="relative mr-2">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && setQ(draft.trim())}
              placeholder="موضوع…"
              className="w-40 h-8 pr-7 pl-2 text-xs" />
          </div>
        )}

        {/* پخش زمانی */}
        <button onClick={toggleLapse}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition ${playing
            ? "bg-cyan-600 text-white"
            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {playing ? "توقف پخش" : "پخش زمانی"}
        </button>

        {!big && !playing && (
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
            {SPANS.map(s => (
              <button key={s.id} onClick={() => setTimespan(s.id)}
                className={`px-2 py-1 rounded-lg text-xs transition ${timespan === s.id ? "bg-white dark:bg-slate-900 shadow-sm text-cyan-700 dark:text-cyan-300" : "text-slate-600 dark:text-slate-300"}`}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {playing && (
          <span className="inline-flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-300">
            <History className="w-3.5 h-3.5" /> پنجره: {spanLabel} گذشته
          </span>
        )}
      </div>

      {/* لایه‌ها */}
      <div className="shrink-0 flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
        <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        {LAYERS.map(l => (
          <button key={l.id} onClick={() => pickLayer(l.id)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition border ${layerId === l.id
              ? "bg-cyan-600 border-cyan-600 text-white"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-cyan-400"}`}>
            <span>{l.icon}</span> {l.label}
          </button>
        ))}

        {/* زیرموضوع لایهٔ فعال */}
        {!big && layer.themes.length > 0 && (
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger size="sm" className="mr-1 w-[11rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {layer.themes.map(code => <SelectItem key={code} value={code}>{themeLabel(code)}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <GdeltGeoMap query={query} onLoaded={handleMapLoaded} />
      </div>
    </div>
  );
}
