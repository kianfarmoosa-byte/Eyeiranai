import { useEffect, useMemo, useState } from "react";
import {
  Monitor, Tv, Siren, RefreshCw, Maximize2, Minimize2, Wifi, WifiOff,
  LayoutGrid, Radar as RadarIcon, Users as UsersIcon, Sparkles, Globe2, Bell, Users2, Play, Pause,
} from "lucide-react";
import type { Article } from "../../data";
import { jalaali, faNum } from "../mobile/utils/fa";
import { LiveNewsWall } from "./LiveNewsWall";
import { LiveAlertsPanel } from "./LiveAlertsPanel";
import { WaveRadar } from "./WaveRadar";
import { SituationBrief } from "./SituationBrief";
import { ActorWatch } from "./ActorWatch";
import { CollaborativeWatch } from "./CollaborativeWatch";
import { LiveEventMap } from "./LiveEventMap";
import { CrisisMode } from "./CrisisMode";
import { getOperator, getPins, setPins as persistPins, getCrisis, setCrisis, defaultProtocol, uid } from "./roomStore";

// ── اتاق رصد رسانه‌ای — پوستهٔ اصلی با سه حالت نمایش ──
//   • میز کار (Operator): چند-پنلی، تعامل کامل
//   • دیوار/Kiosk (Wall): تمام‌صفحه، فونت درشت، چرخش خودکار
//   • بحران (Crisis): تمرکز روی یک موضوع بحرانی
// همه از یک منبع داده تغذیه می‌شوند و جابه‌جایی یک‌کلیک است.

type Mode = "operator" | "wall" | "crisis";
type OpPanel = "wall" | "waves" | "alerts" | "brief" | "actors" | "team" | "map";

type Props = {
  articles: Article[];
  loading?: boolean;
  lastUpdated?: number;
  onRefresh?: () => void;
  onSelect?: (a: Article) => void;
  onSendToNewspack?: (text: string) => void;
};

const OP_PANELS: { id: OpPanel; label: string; icon: any }[] = [
  { id: "wall", label: "دیوار خبر", icon: LayoutGrid },
  { id: "alerts", label: "هشدارها", icon: Bell },
  { id: "waves", label: "رادار موج", icon: RadarIcon },
  { id: "brief", label: "خلاصه موقعیت", icon: Sparkles },
  { id: "actors", label: "رقبا", icon: UsersIcon },
  { id: "team", label: "تیم", icon: Users2 },
  { id: "map", label: "نقشه رویداد", icon: Globe2 },
];

const WALL_ROTATION: OpPanel[] = ["wall", "waves", "map"];
const ROTATE_MS = 15000;

export function MonitoringRoom({ articles, loading, lastUpdated, onRefresh, onSelect, onSendToNewspack }: Props) {
  const [mode, setMode] = useState<Mode>("operator");
  const [operator, setOperatorState] = useState(() => getOperator());
  const [soundOn, setSoundOn] = useState(true);
  const [pins, setPinsState] = useState<string[]>(() => getPins());
  const [alertCount, setAlertCount] = useState(0);
  const [online, setOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [fullscreen, setFullscreen] = useState(false);

  // پنل‌های میز کار
  const [leftPanel, setLeftPanel] = useState<OpPanel>("wall");
  const [rightPanel, setRightPanel] = useState<OpPanel>("alerts");

  // چرخش خودکار در حالت دیوار
  const [rotate, setRotate] = useState(true);
  const [wallIdx, setWallIdx] = useState(0);

  const crisisActive = useMemo(() => getCrisis().active, [mode, articles]);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    if (mode !== "wall" || !rotate) return;
    const t = setInterval(() => setWallIdx(i => (i + 1) % WALL_ROTATION.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [mode, rotate]);

  function togglePin(id: string) {
    setPinsState(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      persistPins(next); return next;
    });
  }

  function selectArticle(a: Article) { onSelect?.(a); }

  function escalateToCrisis(topic: string) {
    setCrisis({
      active: true, topic, startedAt: Date.now(), protocol: defaultProtocol(),
      timeline: [{ id: uid("tl"), at: Date.now(), kind: "action", text: `حالت بحران برای موضوع «${topic}» فعال شد`, by: operator || "سیستم" }],
    });
    setMode("crisis");
  }

  const mySources = useMemo(() => {
    // منابع پرتکرار به‌عنوان «منابع ما» فرض می‌شود (برای تشخیص سوژهٔ ازدست‌رفته)
    const m = new Map<string, number>();
    for (const a of articles) m.set(a.source, (m.get(a.source) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]);
  }, [articles]);

  function renderPanel(p: OpPanel, big?: boolean) {
    switch (p) {
      case "wall":
        return <LiveNewsWall articles={articles} pins={pins} onTogglePin={togglePin} onSelect={selectArticle} big={big} />;
      case "alerts":
        return <LiveAlertsPanel articles={articles} operator={operator} soundOn={soundOn} onToggleSound={() => setSoundOn(s => !s)}
          onFocusArticle={(id) => { const a = articles.find(x => x.id === id); if (a) selectArticle(a); }} onAlertsChange={setAlertCount} />;
      case "waves":
        return <WaveRadar articles={articles} onOpenArticle={(id) => { const a = articles.find(x => x.id === id); if (a) selectArticle(a); }} onEscalate={escalateToCrisis} big={big} />;
      case "brief":
        return <SituationBrief articles={articles} onSendToNewspack={onSendToNewspack} big={big} />;
      case "actors":
        return <ActorWatch articles={articles} mySources={mySources} onSelect={selectArticle} big={big} />;
      case "team":
        return <CollaborativeWatch articles={articles} operator={operator} onOperatorChange={setOperatorState} onSelectArticle={selectArticle} big={big} />;
      case "map":
        return <LiveEventMap big={big} />;
    }
  }

  const modeBtn = (m: Mode, icon: any, label: string) => {
    const Icon = icon;
    return (
      <button onClick={() => setMode(m)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition ${mode === m
          ? m === "crisis" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
        <Icon className="w-3.5 h-3.5" /> {label}
      </button>
    );
  };

  const panelSelect = (value: OpPanel, onChange: (p: OpPanel) => void) => (
    <select value={value} onChange={e => onChange(e.target.value as OpPanel)}
      className="bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1 text-xs">
      {OP_PANELS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
    </select>
  );

  return (
    <div className={`flex flex-col min-w-0 flex-1 min-h-0 bg-slate-50 dark:bg-slate-950 ${fullscreen ? "fixed inset-0 z-50" : ""}`} style={{ direction: "rtl" }}>
      {/* نوار فرمان */}
      <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <Monitor className="w-4 h-4 text-emerald-500" />
        <b className="text-sm">اتاق رصد رسانه‌ای</b>
        <div className="flex items-center gap-1 mr-2">
          {modeBtn("operator", Monitor, "میز کار")}
          {modeBtn("wall", Tv, "دیوار")}
          {modeBtn("crisis", Siren, crisisActive ? "بحران فعال" : "بحران")}
        </div>

        {/* وضعیت شبکه و آخرین به‌روزرسانی */}
        <div className="flex items-center gap-2 mr-auto text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            {online ? <Wifi className="w-3.5 h-3.5 text-emerald-500" /> : <WifiOff className="w-3.5 h-3.5 text-rose-500" />}
            {online ? "آنلاین" : "آفلاین — نمایش از بافر محلی"}
          </span>
          {lastUpdated ? <span>آخرین به‌روزرسانی: {jalaali(lastUpdated, { timeStyle: "short" })}</span> : null}
          <span>{faNum(articles.length)} خبر</span>
          {alertCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600">{faNum(alertCount)} هشدار باز</span>}
          <button onClick={onRefresh} disabled={loading} title="به‌روزرسانی" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setFullscreen(f => !f)} title="تمام‌صفحه" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* بدنه */}
      {mode === "crisis" ? (
        <CrisisMode articles={articles} onSelectArticle={selectArticle} onSendToNewspack={onSendToNewspack}
          onClose={() => setMode("operator")} fullscreen={fullscreen} />
      ) : mode === "wall" ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-slate-900 text-white">
            <div className="flex gap-1.5">
              {WALL_ROTATION.map((p, i) => (
                <button key={p} onClick={() => setWallIdx(i)}
                  className={`px-3 py-1 rounded-lg text-sm ${i === wallIdx ? "bg-emerald-600" : "bg-white/10 hover:bg-white/20"}`}>
                  {OP_PANELS.find(x => x.id === p)?.label}
                </button>
              ))}
            </div>
            <button onClick={() => setRotate(r => !r)} className="mr-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-sm">
              {rotate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {rotate ? "توقف چرخش" : "چرخش خودکار"}
            </button>
          </div>
          <div className="flex-1 min-h-0">
            {renderPanel(WALL_ROTATION[wallIdx], true)}
          </div>
        </div>
      ) : (
        // میز کار: دو پنل کنار هم + انتخاب محتوای هر پنل
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-2 p-2">
          <div className="flex flex-col min-h-0 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
            <div className="shrink-0 flex items-center gap-2 px-2 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-400">پنل راست</span>
              {panelSelect(leftPanel, setLeftPanel)}
            </div>
            <div className="flex-1 min-h-0">{renderPanel(leftPanel)}</div>
          </div>
          <div className="flex flex-col min-h-0 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
            <div className="shrink-0 flex items-center gap-2 px-2 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-400">پنل چپ</span>
              {panelSelect(rightPanel, setRightPanel)}
            </div>
            <div className="flex-1 min-h-0">{renderPanel(rightPanel)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
