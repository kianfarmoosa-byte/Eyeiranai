import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { Network, RefreshCw, Clock, GitBranch, Loader2, X, ExternalLink, Flame, AlertTriangle, Sparkles, Award, BarChart3, Search, ZoomIn, ZoomOut, Maximize2, Download, Crosshair, Filter, Bookmark, Sliders } from "lucide-react";
import type { Article } from "../data";
import {
  buildEntityIndex, buildKnowledgeGraph, mineNarratives, buildEventChains,
  computeInfluence, detectEchoChambers,
} from "./graphAnalytics";
import { Users, Building2, MapPin, Zap, BookOpen, Layers, Radio } from "lucide-react";
import { toFa } from "./mobile/utils/fa";

type Props = {
  articles: Article[];
  loading: boolean;
  onRefresh: () => void;
};

const FA_STOP = new Set(["و","در","به","از","که","این","آن","را","با","بر","تا","است","هست","هستند","بود","شد","شده","می","نمی","یک","های","ها","برای","یا","اگر","اما","هم","نیز","اش","ای","کرد","کند","خواهد","باید"]);

const CATEGORY_COLORS: Record<string, [string, string, string]> = {
  "سیاسی": ["#fee2e2", "#ef4444", "#b91c1c"],
  "اقتصادی": ["#dcfce7", "#10b981", "#047857"],
  "ورزشی": ["#fef3c7", "#f59e0b", "#b45309"],
  "ورزش": ["#fef3c7", "#f59e0b", "#b45309"],
  "فرهنگی": ["#fce7f3", "#ec4899", "#be185d"],
  "فرهنگ": ["#fce7f3", "#ec4899", "#be185d"],
  "اجتماعی": ["#ede9fe", "#8b5cf6", "#6d28d9"],
  "بین‌الملل": ["#cffafe", "#06b6d4", "#0e7490"],
  "فناوری": ["#dbeafe", "#3b82f6", "#1d4ed8"],
  "علمی": ["#e0e7ff", "#6366f1", "#4338ca"],
  "سلامت": ["#d1fae5", "#14b8a6", "#0f766e"],
  "حوادث": ["#fee2e2", "#dc2626", "#991b1b"],
};
const DEFAULT_COLOR: [string, string, string] = ["#e2e8f0", "#64748b", "#334155"];

function catColor(category: string): [string, string, string] {
  const c = category || "";
  for (const k of Object.keys(CATEGORY_COLORS)) if (c.includes(k)) return CATEGORY_COLORS[k];
  return DEFAULT_COLOR;
}

function normalizeFa(s: string): string {
  return (s || "")
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[.,،:;!?؟«»"'()\[\]{}…\-—–\/\\]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function toTokens(s: string): string[] {
  return normalizeFa(s).split(" ").filter(t => t.length >= 3 && !FA_STOP.has(t));
}

function shingles(s: string, k = 3): Set<string> {
  const ts = toTokens(s);
  const out = new Set<string>();
  for (let i = 0; i <= ts.length - k; i++) out.add(ts.slice(i, i + k).join(" "));
  if (out.size === 0) for (const t of ts) out.add(t);
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

type Item = {
  id: string; source: string; icon: string; category: string; title: string; preview: string; link?: string; ts: number; shingles: Set<string>; tokens: Set<string>;
};

type Cluster = {
  id: string; items: Item[]; origin: Item; spanMin: number;
  trending: boolean; velocity: number; convergence: boolean; categories: string[];
};

type GraphNode = {
  id: string; name: string; icon: string; category: string;
  count: number; firstCount: number; pagerank: number;
  x?: number; y?: number;
};
type GraphEdge = { source: string; target: string; weight: number; avgDelayMin: number; directed: boolean };

function computePageRank(nodes: GraphNode[], edges: GraphEdge[], iter = 30, damping = 0.85) {
  const n = nodes.length;
  if (n === 0) return;
  const idx = new Map(nodes.map((node, i) => [node.id, i]));
  const rank = new Array(n).fill(1 / n);
  const outSum = new Array(n).fill(0);
  const inbound: Array<Array<[number, number]>> = Array.from({ length: n }, () => []);
  for (const e of edges) {
    const s = idx.get(e.source as string); const t = idx.get(e.target as string);
    if (s == null || t == null) continue;
    outSum[s] += e.weight;
    inbound[t].push([s, e.weight]);
  }
  for (let k = 0; k < iter; k++) {
    const next = new Array(n).fill((1 - damping) / n);
    for (let i = 0; i < n; i++) {
      for (const [s, w] of inbound[i]) {
        if (outSum[s] > 0) next[i] += damping * rank[s] * (w / outSum[s]);
      }
    }
    for (let i = 0; i < n; i++) rank[i] = next[i];
  }
  const max = Math.max(...rank, 1e-9);
  for (let i = 0; i < n; i++) nodes[i].pagerank = rank[i] / max;
}

function buildGraph(articles: Article[], threshold: number, windowHours: number) {
  const empty = { nodes: [] as GraphNode[], edges: [] as GraphEdge[], clusters: [] as Cluster[], stats: { articles: 0, clusters: 0, trending: 0, convergence: 0 }, sourceClusters: new Map<string, Set<string>>(), clusterOf: new Map<string, string>(), allItems: [] as Item[] };
  if (!Array.isArray(articles)) return empty;
  const cutoff = Date.now() - windowHours * 3600 * 1000;
  const items: Item[] = [];
  for (const a of articles) {
    const ts = new Date(a.date || 0).getTime();
    const t = isNaN(ts) ? Date.now() : ts;
    if (t < cutoff) continue;
    const sh = shingles(`${a.title} ${a.preview || ""}`);
    const tk = new Set(toTokens(`${a.title} ${a.preview || ""}`));
    items.push({
      id: a.id, source: a.source, icon: a.sourceIcon, category: a.category || "",
      title: a.title, preview: a.preview || "", link: a.link, ts: t, shingles: sh, tokens: tk,
    });
  }
  items.sort((a, b) => a.ts - b.ts);

  const clustersRaw: Item[][] = [];
  const centroids: Set<string>[] = [];
  for (const it of items) {
    let bestIdx = -1;
    let bestScore = threshold;
    for (let i = 0; i < centroids.length; i++) {
      const s = jaccard(it.shingles, centroids[i]);
      if (s > bestScore) { bestScore = s; bestIdx = i; }
    }
    if (bestIdx === -1) {
      clustersRaw.push([it]);
      centroids.push(new Set(it.shingles));
    } else {
      clustersRaw[bestIdx].push(it);
      for (const t of it.shingles) centroids[bestIdx].add(t);
    }
  }

  const big = clustersRaw.filter(c => c.length >= 2).sort((a, b) => b.length - a.length);

  const nodeMap = new Map<string, GraphNode>();
  for (const it of items) {
    const n = nodeMap.get(it.source) || { id: it.source, name: it.source, icon: it.icon, category: it.category, count: 0, firstCount: 0, pagerank: 0 };
    if (!n.category && it.category) n.category = it.category;
    n.count++;
    nodeMap.set(it.source, n);
  }

  const edgeMap = new Map<string, GraphEdge>();
  const clusterList: Cluster[] = [];
  const sourceClusters = new Map<string, Set<string>>();
  const clusterOf = new Map<string, string>();

  for (let ci = 0; ci < big.length; ci++) {
    const cluster = big[ci];
    const origin = cluster[0];
    const n0 = nodeMap.get(origin.source);
    if (n0) n0.firstCount++;

    const clusterId = `c${ci}`;
    const cats = new Set<string>();
    for (const it of cluster) {
      cats.add(it.category || "—");
      clusterOf.set(it.id, clusterId);
      if (!sourceClusters.has(it.source)) sourceClusters.set(it.source, new Set());
      sourceClusters.get(it.source)!.add(clusterId);
    }

    for (let i = 0; i < cluster.length; i++) {
      for (let j = i + 1; j < cluster.length; j++) {
        const a = cluster[i]; const b = cluster[j];
        if (a.source === b.source) continue;
        const earlier = a.ts <= b.ts ? a : b;
        const later = a.ts <= b.ts ? b : a;
        const key = `${earlier.source}→${later.source}`;
        const delayMin = (later.ts - earlier.ts) / 60000;
        const directed = i === 0;
        const e = edgeMap.get(key) || { source: earlier.source, target: later.source, weight: 0, avgDelayMin: 0, directed: false };
        e.avgDelayMin = (e.avgDelayMin * e.weight + delayMin) / (e.weight + 1);
        e.weight++;
        if (directed) e.directed = true;
        edgeMap.set(key, e);
      }
    }

    const spanMin = Math.round((cluster[cluster.length - 1].ts - origin.ts) / 60000);
    const within30 = cluster.filter(it => (it.ts - origin.ts) / 60000 <= 30).length;
    const trending = within30 >= 5;
    const velocity = spanMin > 0 ? cluster.length / Math.max(spanMin, 1) : cluster.length;
    const convergence = cats.size >= 3 && cluster.length >= 4;

    clusterList.push({
      id: clusterId, items: cluster, origin, spanMin, trending, velocity, convergence,
      categories: Array.from(cats),
    });
  }

  const edges = Array.from(edgeMap.values());
  const activeSources = new Set<string>();
  for (const e of edges) { activeSources.add(e.source); activeSources.add(e.target); }
  const nodes = Array.from(nodeMap.values()).filter(n => activeSources.has(n.id));
  computePageRank(nodes, edges);

  return {
    nodes, edges, clusters: clusterList,
    stats: {
      articles: items.length, clusters: big.length,
      trending: clusterList.filter(c => c.trending).length,
      convergence: clusterList.filter(c => c.convergence).length,
    },
    sourceClusters, clusterOf, allItems: items,
  };
}

function formatDelay(min: number): string {
  if (min < 1) return "همزمان";
  if (min < 60) return `${toFa(Math.round(min))}د`;
  if (min < 1440) return `${toFa((min / 60).toFixed(1))}س`;
  return `${toFa((min / 1440).toFixed(1))}ر`;
}

function VelocitySparkline({ cluster }: { cluster: Cluster }) {
  const bins = 12;
  const span = Math.max(cluster.spanMin, 1);
  const counts = new Array(bins).fill(0);
  for (const it of cluster.items) {
    const m = (it.ts - cluster.origin.ts) / 60000;
    const b = Math.min(bins - 1, Math.floor((m / span) * bins));
    counts[b]++;
  }
  const max = Math.max(...counts, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {counts.map((v, i) => (
        <div key={i} className="flex-1 bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-sm" style={{ height: `${(v / max) * 100}%` }} />
      ))}
    </div>
  );
}

export function GraphView({ articles, loading, onRefresh }: Props) {
  const [threshold, setThreshold] = useState(0.28);
  const [windowHours, setWindowHours] = useState(48);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [focusNode, setFocusNode] = useState<string | null>(null);
  const [tab, setTab] = useState<'clusters' | 'trending' | 'influence' | 'similar' | 'alerts' | 'watch' | 'entities' | 'narrative' | 'chain' | 'echo'>('clusters');
  const [entityQuery, setEntityQuery] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState<"all" | "person" | "org" | "place" | "event">("all");
  const [focusEntity, setFocusEntity] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState<Set<string>>(new Set());
  const [clusterQuery, setClusterQuery] = useState("");
  const [isolateCluster, setIsolateCluster] = useState<string | null>(null);
  const [watched, setWatched] = useState<Set<string>>(new Set());
  const [scrubT, setScrubT] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [mobileSettings, setMobileSettings] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setDims({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const graph = useMemo(() => buildGraph(articles, threshold, windowHours), [articles, threshold, windowHours]);

  useEffect(() => { setScrubT(1); setPlaying(false); }, [selectedCluster]);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setScrubT(prev => { const n = prev + 0.04; if (n >= 1) { setPlaying(false); return 1; } return n; });
    }, 100);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => {
    if (!fgRef.current) return;
    const link = fgRef.current.d3Force('link');
    const charge = fgRef.current.d3Force('charge');
    if (link) link.distance(130).strength(0.4);
    if (charge) charge.strength(-450).distanceMax(520);
  }, [graph]);

  const allCategories = useMemo(() => {
    const s = new Set<string>();
    for (const n of graph.nodes) if (n.category) s.add(n.category);
    return Array.from(s).sort();
  }, [graph.nodes]);

  const isolatedSources = useMemo(() => {
    if (!isolateCluster) return null;
    const c = graph.clusters.find(x => x.id === isolateCluster);
    if (!c) return null;
    return new Set(c.items.map(i => i.source));
  }, [isolateCluster, graph.clusters]);

  const graphData = useMemo(() => {
    const catOk = (c: string) => catFilter.size === 0 || catFilter.has(c || "—");
    const visibleNodeIds = new Set(
      graph.nodes
        .filter(n => catOk(n.category))
        .filter(n => !isolatedSources || isolatedSources.has(n.id))
        .map(n => n.id)
    );
    return {
      nodes: graph.nodes.filter(n => visibleNodeIds.has(n.id)).map(n => ({ ...n })),
      links: graph.edges
        .filter(e => visibleNodeIds.has(e.source as string) && visibleNodeIds.has(e.target as string))
        .map(e => ({ ...e, source: e.source, target: e.target })),
    };
  }, [graph, catFilter, isolatedSources]);

  const zoomIn = () => { fgRef.current?.zoom(fgRef.current.zoom() * 1.3, 300); };
  const zoomOut = () => { fgRef.current?.zoom(fgRef.current.zoom() / 1.3, 300); };
  const fitView = () => { fgRef.current?.zoomToFit(500, 60); };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({
      nodes: graph.nodes, edges: graph.edges,
      clusters: graph.clusters.map(c => ({ id: c.id, title: c.origin.title, origin: c.origin.source, size: c.items.length, spanMin: c.spanMin, trending: c.trending, convergence: c.convergence, items: c.items.map(i => ({ source: i.source, title: i.title, ts: i.ts })) })),
    }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `media-graph-${Date.now()}.json`;
    a.click();
  };
  const toggleCat = (c: string) => {
    setCatFilter(prev => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  };
  const toggleWatch = (id: string) => {
    setWatched(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const topInfluence = useMemo(() => [...graph.nodes].sort((a, b) => b.pagerank - a.pagerank).slice(0, 10), [graph.nodes]);
  const topOrigins = useMemo(() => [...graph.nodes].filter(n => n.firstCount > 0).sort((a, b) => b.firstCount - a.firstCount).slice(0, 10), [graph.nodes]);
  const trendingClusters = useMemo(() => graph.clusters.filter(c => c.trending).sort((a, b) => b.velocity - a.velocity), [graph.clusters]);
  const convergenceClusters = useMemo(() => graph.clusters.filter(c => c.convergence), [graph.clusters]);

  const sourceDetail = useMemo(() => {
    if (!focusNode) return null;
    const node = graph.nodes.find(n => n.id === focusNode);
    if (!node) return null;
    const clusters = graph.clusters.filter(c => c.items.some(i => i.source === focusNode));
    const originCount = clusters.filter(c => c.origin.source === focusNode).length;
    const republishCount = clusters.length - originCount;
    const biasScore = clusters.length > 0 ? originCount / clusters.length : 0;
    const avgDelayAsRepublisher = (() => {
      const delays: number[] = [];
      for (const c of clusters) {
        if (c.origin.source === focusNode) continue;
        const me = c.items.find(i => i.source === focusNode);
        if (me) delays.push((me.ts - c.origin.ts) / 60000);
      }
      return delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;
    })();
    const inbound = graph.edges.filter(e => (e.target as string) === focusNode);
    const outbound = graph.edges.filter(e => (e.source as string) === focusNode);
    return { node, clusters, originCount, republishCount, biasScore, avgDelayAsRepublisher, inbound, outbound };
  }, [focusNode, graph]);

  const similarSources = useMemo(() => {
    if (!focusNode) return [];
    const mine = graph.sourceClusters.get(focusNode);
    if (!mine || mine.size === 0) return [];
    const scored: { id: string; name: string; icon: string; category: string; score: number; overlap: number }[] = [];
    for (const other of graph.nodes) {
      if (other.id === focusNode) continue;
      const theirs = graph.sourceClusters.get(other.id);
      if (!theirs) continue;
      let inter = 0;
      for (const c of theirs) if (mine.has(c)) inter++;
      const union = mine.size + theirs.size - inter;
      const score = union > 0 ? inter / union : 0;
      if (score > 0) scored.push({ id: other.id, name: other.name, icon: other.icon, category: other.category, score, overlap: inter });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, 10);
  }, [focusNode, graph]);

  const analytics = useMemo(() => {
    const articlesLike = graph.allItems.map(it => ({
      id: it.id, source: it.source, title: it.title,
      preview: it.preview, ts: it.ts,
    }));
    const { entities, articleEntities } = buildEntityIndex(articlesLike, graph.clusterOf);
    const kg = buildKnowledgeGraph(entities, articleEntities, articlesLike, graph.clusterOf);
    const narratives = mineNarratives(graph.clusters, articlesLike);
    const chains = buildEventChains(graph.clusters, articleEntities);
    const influence = computeInfluence(graph.nodes, graph.edges);
    const echos = detectEchoChambers(graph.nodes, graph.edges);
    return { entities, articleEntities, kg, narratives, chains, influence, echos };
  }, [graph]);

  const filteredEntities = useMemo(() => {
    const q = entityQuery.trim().toLowerCase();
    const arr = Array.from(analytics.entities.values())
      .filter(e => entityTypeFilter === "all" || e.type === entityTypeFilter)
      .filter(e => !q || e.name.toLowerCase().includes(q));
    return arr.sort((a, b) => b.count - a.count).slice(0, 80);
  }, [analytics, entityQuery, entityTypeFilter]);

  const focusEntityDetail = useMemo(() => {
    if (!focusEntity) return null;
    const ent = analytics.entities.get(focusEntity);
    if (!ent) return null;
    const related = analytics.kg
      .filter(e => e.a === focusEntity || e.b === focusEntity)
      .slice(0, 15)
      .map(e => ({
        other: e.a === focusEntity ? e.b : e.a,
        weight: e.weight,
        coClusters: e.coClusters.size,
      }));
    return { ent, related };
  }, [focusEntity, analytics]);

  return (
    <div className="flex-1 flex flex-col bg-[radial-gradient(ellipse_at_top,#eef2ff_0%,#f8fafc_50%,#f1f5f9_100%)] dark:bg-[radial-gradient(ellipse_at_top,#0f172a_0%,#020617_55%,#0b1220_100%)] min-w-0">
      <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-3 flex items-center gap-3 flex-wrap bg-white/70 dark:bg-slate-950/70 backdrop-blur">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white shadow-sm">
          <Network className="w-4 h-4" />
        </div>
        <div>
          <div className="text-sm">گراف فضای رسانه</div>
          <div className="text-xs text-slate-500">
            {graph.stats.articles.toLocaleString("fa-IR")} مقاله · {graph.stats.clusters.toLocaleString("fa-IR")} خوشه · {graph.nodes.length.toLocaleString("fa-IR")} منبع · {graph.edges.length.toLocaleString("fa-IR")} یال
            {graph.stats.trending > 0 && <span className="text-orange-600 dark:text-orange-400"> · 🔥 {graph.stats.trending} ترند</span>}
            {graph.stats.convergence > 0 && <span className="text-rose-600 dark:text-rose-400"> · ⚠ {graph.stats.convergence} همگرایی</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 mr-auto text-xs">
          <div className={`${mobileSettings ? 'flex' : 'hidden'} md:flex items-center gap-2 flex-wrap`}>
            <label className="flex items-center gap-2">
              <span className="text-slate-500">شباهت</span>
              <input type="range" min={0.15} max={0.6} step={0.02} value={threshold}
                onChange={e => setThreshold(Number(e.target.value))} className="w-24" />
              <span className="tabular-nums w-8 text-slate-500">{toFa(threshold.toFixed(2))}</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-slate-500">پنجره</span>
              <select value={windowHours} onChange={e => setWindowHours(Number(e.target.value))}
                className="bg-slate-100 dark:bg-slate-800 rounded px-2 py-1 text-xs">
                <option value={12}>۱۲ ساعت</option>
                <option value={24}>۲۴ ساعت</option>
                <option value={48}>۴۸ ساعت</option>
                <option value={72}>۷۲ ساعت</option>
                <option value={168}>۱ هفته</option>
              </select>
            </label>
          </div>
          <button onClick={() => setMobileSettings(s => !s)}
            className="md:hidden flex items-center justify-center w-9 h-9 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
            title="تنظیمات">
            <Sliders className="w-4 h-4" />
          </button>
          <button onClick={onRefresh} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-br from-emerald-600 to-emerald-600 hover:from-emerald-500 hover:to-emerald-500 disabled:opacity-50 text-white rounded-lg shadow-sm">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">بروزرسانی</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <div ref={wrapRef} className="flex-1 relative">
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-xl border border-slate-200 dark:border-slate-800 p-1 shadow-lg">
            <button onClick={zoomIn} title="بزرگ‌نمایی" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><ZoomIn className="w-4 h-4" /></button>
            <button onClick={zoomOut} title="کوچک‌نمایی" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><ZoomOut className="w-4 h-4" /></button>
            <button onClick={fitView} title="تطبیق با صفحه" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Maximize2 className="w-4 h-4" /></button>
            <div className="h-px bg-slate-200 dark:bg-slate-800 my-0.5" />
            <button onClick={exportJson} title="خروجی JSON" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Download className="w-4 h-4" /></button>
            {(isolateCluster || focusNode || catFilter.size > 0) && (
              <button onClick={() => { setIsolateCluster(null); setFocusNode(null); setCatFilter(new Set()); }} title="پاکسازی فیلترها" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-600"><X className="w-4 h-4" /></button>
            )}
          </div>
          {allCategories.length > 0 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex gap-1 flex-wrap justify-center max-w-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur rounded-full border border-slate-200 dark:border-slate-800 px-2 py-1 shadow-lg">
              <span className="text-[10px] text-slate-500 self-center px-1 flex items-center gap-1"><Filter className="w-3 h-3" /></span>
              {allCategories.map(cat => {
                const [, mid] = catColor(cat);
                const active = catFilter.has(cat);
                return (
                  <button key={cat} onClick={() => toggleCat(cat)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition ${active ? "text-white shadow-sm" : "text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-slate-400"}`}
                    style={active ? { background: mid, borderColor: mid } : {}}>
                    {cat || "—"}
                  </button>
                );
              })}
            </div>
          )}
          {isolateCluster && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-emerald-600 text-white px-3 py-1.5 rounded-full text-[11px] shadow-lg flex items-center gap-2">
              <Crosshair className="w-3 h-3" /> حالت تمرکز روی خوشه فعال
              <button onClick={() => setIsolateCluster(null)} className="hover:bg-emerald-700 rounded-full p-0.5"><X className="w-3 h-3" /></button>
            </div>
          )}
          <div className="hidden md:block absolute top-3 left-3 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-[10px] shadow-lg">
            <div className="text-slate-500 mb-1.5">راهنما</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-300" /> منشأ</div>
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full border-2 border-emerald-500" /> نفوذ</div>
              <div className="flex items-center gap-1"><span className="w-4 h-0.5 bg-red-500" /> ≤۱۵د</div>
              <div className="flex items-center gap-1"><span className="w-4 h-0.5 bg-orange-500" /> ≤۱س</div>
              <div className="flex items-center gap-1"><span className="w-4 h-0.5 bg-yellow-500" /> ≤۳س</div>
              <div className="flex items-center gap-1"><span className="w-4 h-0.5 bg-emerald-500" /> ≤۱۲س</div>
            </div>
            <div className="mt-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-800 text-[9px] text-slate-500">
              اندازه = حجم · حلقه = نفوذ · رنگ = دسته
            </div>
          </div>
          {graph.nodes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500">
              {loading ? (
                <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> در حال بارگذاری مقالات...</div>
              ) : (
                <div className="text-center max-w-sm">
                  <Network className="w-10 h-10 mx-auto mb-2 text-slate-400" />
                  <div className="text-sm">هیچ خوشه‌ای در پنجرهٔ زمانی انتخابی یافت نشد.</div>
                  <div className="text-xs mt-1">آستانهٔ شباهت را کاهش دهید یا پنجرهٔ زمانی را افزایش دهید.</div>
                </div>
              )}
            </div>
          ) : (
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData as any}
              width={dims.w}
              height={dims.h}
              backgroundColor="transparent"
              cooldownTicks={150}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
              onNodeClick={(n: any) => setFocusNode(n.id === focusNode ? null : n.id)}
              linkColor={(l: any) => {
                const srcId = typeof l.source === "object" ? l.source.id : l.source;
                const tgtId = typeof l.target === "object" ? l.target.id : l.target;
                const active = focusNode && (srcId === focusNode || tgtId === focusNode);
                const d = l.avgDelayMin;
                let base: [number, number, number];
                if (d <= 15) base = [239, 68, 68];
                else if (d <= 60) base = [249, 115, 22];
                else if (d <= 180) base = [234, 179, 8];
                else if (d <= 720) base = [14, 165, 233];
                else base = [100, 116, 139];
                const alpha = focusNode ? (active ? 0.95 : 0.08) : Math.min(0.85, 0.25 + l.weight * 0.08);
                return `rgba(${base[0]},${base[1]},${base[2]},${alpha})`;
              }}
              linkWidth={(l: any) => Math.min(5, 0.5 + Math.log2(1 + l.weight) * 1.2)}
              linkDirectionalArrowLength={(l: any) => l.directed ? 7 : 0}
              linkDirectionalArrowRelPos={0.88}
              linkDirectionalParticles={(l: any) => l.directed ? Math.min(3, 1 + Math.floor(l.weight / 2)) : 0}
              linkDirectionalParticleWidth={2.2}
              linkDirectionalParticleSpeed={0.008}
              linkCurvature={(l: any) => l.directed ? 0 : 0.15}
              nodeLabel={(n: any) => `${n.icon || ""} ${n.name} — ${toFa(n.count)} مقاله · نفوذ ${toFa((n.pagerank * 100).toFixed(0))}${n.firstCount ? ` · ${toFa(n.firstCount)} بار منشأ` : ""}`}
              nodeCanvasObject={(node: any, ctx, globalScale) => {
                if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
                const isOrigin = node.firstCount > 0;
                const baseR = 5 + Math.min(14, Math.log2(1 + node.count) * 1.5);
                const influR = baseR + 2 + node.pagerank * 8;
                const [light, mid, dark] = catColor(node.category);
                const dim = focusNode && focusNode !== node.id;
                ctx.globalAlpha = dim ? 0.2 : 1;

                if (isOrigin && !dim) {
                  const pulse = (Math.sin(Date.now() / 600) + 1) / 2;
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, influR + 6 + pulse * 3, 0, 2 * Math.PI);
                  const halo = ctx.createRadialGradient(node.x, node.y, baseR, node.x, node.y, influR + 10);
                  halo.addColorStop(0, "rgba(245,158,11,0.35)");
                  halo.addColorStop(1, "rgba(245,158,11,0)");
                  ctx.fillStyle = halo;
                  ctx.fill();
                }

                if (node.pagerank > 0.05 && !dim) {
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, influR, 0, 2 * Math.PI);
                  ctx.strokeStyle = `rgba(99,102,241,${0.2 + node.pagerank * 0.6})`;
                  ctx.lineWidth = 1 + node.pagerank * 2.5;
                  ctx.stroke();
                }

                ctx.beginPath();
                ctx.arc(node.x, node.y, baseR, 0, 2 * Math.PI);
                const grad = ctx.createRadialGradient(node.x - baseR * 0.3, node.y - baseR * 0.3, 0, node.x, node.y, baseR);
                grad.addColorStop(0, light);
                grad.addColorStop(1, mid);
                ctx.fillStyle = grad;
                ctx.fill();
                ctx.lineWidth = isOrigin ? 1.8 : 1;
                ctx.strokeStyle = isOrigin ? "#d97706" : dark;
                ctx.stroke();

                if (isOrigin && !dim) {
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, baseR * 0.42, 0, 2 * Math.PI);
                  ctx.fillStyle = "#fff8e1";
                  ctx.fill();
                }

                const fontSize = Math.max(9, 11 / globalScale);
                ctx.font = `500 ${fontSize}px -apple-system, system-ui, sans-serif`;
                const label = node.name.length > 20 ? node.name.slice(0, 19) + "…" : node.name;
                const tw = ctx.measureText(label).width;
                const ly = node.y + influR + 4;
                ctx.fillStyle = dim ? "rgba(148,163,184,0.4)" : "rgba(15,23,42,0.85)";
                ctx.beginPath();
                const pad = 4;
                const rect = { x: node.x - tw / 2 - pad, y: ly, w: tw + pad * 2, h: fontSize + pad };
                ctx.roundRect?.(rect.x, rect.y, rect.w, rect.h, 4);
                if (!ctx.roundRect) ctx.rect(rect.x, rect.y, rect.w, rect.h);
                ctx.fillStyle = dim ? "rgba(226,232,240,0.3)" : "rgba(255,255,255,0.85)";
                ctx.fill();
                ctx.strokeStyle = dim ? "transparent" : "rgba(148,163,184,0.4)";
                ctx.lineWidth = 0.5;
                ctx.stroke();
                ctx.fillStyle = dim ? "#94a3b8" : "#0f172a";
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillText(label, node.x, ly + 2);
                ctx.globalAlpha = 1;
              }}
              autoPauseRedraw={false}
              warmupTicks={40}
            />
          )}
        </div>

        <div className="w-full md:w-96 max-h-[45vh] md:max-h-none md:h-auto border-t md:border-t-0 md:border-r border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 overflow-y-auto flex flex-col">
          {selectedCluster ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm flex items-center gap-2">
                  <GitBranch className="w-3.5 h-3.5" /> مسیر انتشار
                </div>
                <button onClick={() => setSelectedCluster(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-sm mb-2">{selectedCluster.origin.title}</div>

              <div className="flex items-center gap-1.5 flex-wrap mb-3">
                {selectedCluster.trending && <span className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 rounded text-[10px] flex items-center gap-1"><Flame className="w-3 h-3" /> ترند زودهنگام</span>}
                {selectedCluster.convergence && <span className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded text-[10px] flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> همگرایی</span>}
                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDelay(selectedCluster.spanMin)}</span>
                <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded text-[10px]">سرعت: {toFa((selectedCluster.velocity * 60).toFixed(1))}/س</span>
              </div>

              <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1"><BarChart3 className="w-3 h-3" /> نمودار سرعت انتشار</div>
                <VelocitySparkline cluster={selectedCluster} />
              </div>

              <div className="mb-3 p-2 bg-gradient-to-r from-emerald-50 to-emerald-50 dark:from-emerald-950/30 dark:to-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-900/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <button onClick={() => setPlaying(p => !p)} className="w-6 h-6 flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs">
                    {playing ? "⏸" : "▶"}
                  </button>
                  <input type="range" min={0} max={1} step={0.01} value={scrubT}
                    onChange={e => { setPlaying(false); setScrubT(Number(e.target.value)); }}
                    className="flex-1" />
                  <span className="text-[10px] tabular-nums text-slate-600 dark:text-slate-300 w-10 text-left">
                    {formatDelay(selectedCluster.spanMin * scrubT)}
                  </span>
                </div>
                <div className="text-[9px] text-slate-500">
                  {selectedCluster.items.filter(it => (it.ts - selectedCluster.origin.ts) / 60000 <= selectedCluster.spanMin * scrubT).length} از {selectedCluster.items.length} منبع منتشر کرده‌اند
                </div>
              </div>

              <div className="space-y-2">
                {selectedCluster.items.map((it, i) => {
                  const reachedMin = (it.ts - selectedCluster.origin.ts) / 60000;
                  const reached = reachedMin <= selectedCluster.spanMin * scrubT;
                  const [, mid] = catColor(it.category);
                  return (
                    <div key={it.id} className={`p-2 rounded-lg border transition-opacity ${reached ? "opacity-100" : "opacity-30"} ${i === 0 ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300" : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"}`}>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-2 h-2 rounded-full" style={{ background: mid }} />
                        <span>{it.icon}</span>
                        <span className="flex-1 truncate">{it.source}</span>
                        {i === 0 ? <span className="px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded text-[10px]">منشأ</span>
                          : <span className="text-slate-500 tabular-nums">+{formatDelay((it.ts - selectedCluster.origin.ts) / 60000)}</span>}
                      </div>
                      <div className="text-xs mt-1 line-clamp-2">{it.title}</div>
                      {it.link && (
                        <a href={it.link} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 inline-flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> متن اصلی
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : sourceDetail ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm flex items-center gap-2">
                  <span>{sourceDetail.node.icon}</span> {sourceDetail.node.name}
                </div>
                <button onClick={() => setFocusNode(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"><X className="w-3.5 h-3.5" /></button>
              </div>
              {sourceDetail.node.category && (() => {
                const [, mid] = catColor(sourceDetail.node.category);
                return <span className="inline-block px-2 py-0.5 rounded text-[10px] mb-3" style={{ background: mid + '25', color: mid }}>{sourceDetail.node.category}</span>;
              })()}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <div className="text-[10px] text-slate-500">حجم انتشار</div>
                  <div className="text-lg tabular-nums">{sourceDetail.node.count}</div>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <div className="text-[10px] text-slate-500">شاخص نفوذ</div>
                  <div className="text-lg tabular-nums">{toFa((sourceDetail.node.pagerank * 100).toFixed(0))}</div>
                </div>
                <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                  <div className="text-[10px] text-slate-500">بار منشأ</div>
                  <div className="text-lg tabular-nums text-amber-700 dark:text-amber-400">{sourceDetail.originCount}</div>
                </div>
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                  <div className="text-[10px] text-slate-500">بار بازنشر</div>
                  <div className="text-lg tabular-nums text-emerald-700 dark:text-emerald-400">{sourceDetail.republishCount}</div>
                </div>
              </div>
              <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                  <span>نسبت منشأ ← بازنشر</span>
                  <span className="tabular-nums">{toFa((sourceDetail.biasScore * 100).toFixed(0))}٪ منشأ</span>
                </div>
                <div className="h-2 bg-emerald-200 dark:bg-emerald-900 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400" style={{ width: `${sourceDetail.biasScore * 100}%` }} />
                </div>
                {sourceDetail.republishCount > 0 && (
                  <div className="text-[10px] text-slate-500 mt-1">میانگین تأخیر بازنشر: {formatDelay(sourceDetail.avgDelayAsRepublisher)}</div>
                )}
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <div className="text-slate-500 mb-0.5">ورودی</div>
                  <div className="tabular-nums">{sourceDetail.inbound.length} یال</div>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <div className="text-slate-500 mb-0.5">خروجی</div>
                  <div className="tabular-nums">{sourceDetail.outbound.length} یال</div>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 mb-1.5 flex items-center gap-1"><Network className="w-3 h-3" /> خوشه‌های مرتبط ({sourceDetail.clusters.length})</div>
              <div className="space-y-1">
                {sourceDetail.clusters.slice(0, 15).map(c => (
                  <button key={c.id} onClick={() => setSelectedCluster(c)}
                    className="w-full text-right p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-emerald-400">
                    <div className="flex items-center gap-1 mb-0.5">
                      {c.origin.source === sourceDetail.node.id
                        ? <span className="text-[9px] px-1 bg-amber-200 text-amber-900 rounded">منشأ</span>
                        : <span className="text-[9px] px-1 bg-emerald-100 text-emerald-700 rounded">بازنشر</span>}
                      {c.trending && <span>🔥</span>}
                    </div>
                    <div className="text-xs line-clamp-2">{c.origin.title}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs sticky top-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur z-10 overflow-x-auto scrollbar-none">
                {[
                  { id: 'clusters', label: 'خوشه‌ها', icon: Network },
                  { id: 'entities', label: 'موجودیت', icon: Users },
                  { id: 'narrative', label: 'روایت', icon: BookOpen },
                  { id: 'chain', label: 'زنجیره', icon: Layers },
                  { id: 'echo', label: 'اتاق‌پژواک', icon: Radio },
                  { id: 'trending', label: 'ترند', icon: Flame },
                  { id: 'influence', label: 'نفوذ', icon: Award },
                  { id: 'similar', label: 'مشابه', icon: Sparkles },
                  { id: 'alerts', label: 'هشدار', icon: AlertTriangle },
                  { id: 'watch', label: 'دنبال', icon: Bookmark },
                ].map(t => {
                  const Icon = t.icon;
                  return (
                    <button key={t.id} onClick={() => setTab(t.id as any)}
                      className={`shrink-0 px-3 py-2 flex items-center justify-center gap-1 whitespace-nowrap ${tab === t.id ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                      <Icon className="w-3 h-3" /> {t.label}
                    </button>
                  );
                })}
              </div>

              <div className="p-4 flex-1 overflow-y-auto">
                {tab === 'clusters' && (
                  <div className="space-y-1.5">
                    <div className="relative mb-2">
                      <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                      <input value={clusterQuery} onChange={e => setClusterQuery(e.target.value)}
                        placeholder="جستجو در خوشه‌ها..."
                        className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg pr-7 pl-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    {graph.clusters
                      .filter(c => !clusterQuery || c.origin.title.toLowerCase().includes(clusterQuery.toLowerCase()) || c.items.some(i => i.source.includes(clusterQuery)))
                      .slice(0, 40).map(c => (
                      <div key={c.id} className="group relative">
                        <button onClick={() => setSelectedCluster(c)}
                          className="w-full text-right p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                          <div className="text-xs line-clamp-2 pl-14">{c.origin.title}</div>
                          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                            <span>{c.items.length} منبع</span>
                            <span>·</span>
                            <span>{formatDelay(c.spanMin)}</span>
                            {c.trending && <span className="text-orange-500">🔥</span>}
                            {c.convergence && <span className="text-rose-500">⚠</span>}
                            {c.categories.slice(0, 2).map(cat => {
                              const [, m] = catColor(cat);
                              return <span key={cat} className="px-1 rounded text-[9px]" style={{ background: m + '25', color: m }}>{cat.slice(0, 10) || '—'}</span>;
                            })}
                          </div>
                        </button>
                        <div className="absolute top-1 left-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={(e) => { e.stopPropagation(); setIsolateCluster(isolateCluster === c.id ? null : c.id); setTimeout(fitView, 200); }}
                            title="تمرکز روی این خوشه در گراف"
                            className={`p-1 rounded ${isolateCluster === c.id ? "bg-emerald-600 text-white" : "bg-white/90 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-950"}`}>
                            <Crosshair className="w-3 h-3" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); toggleWatch(c.id); }}
                            title="افزودن به دنبال‌شده‌ها"
                            className={`p-1 rounded ${watched.has(c.id) ? "bg-amber-500 text-white" : "bg-white/90 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950"}`}>
                            <Bookmark className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {graph.clusters.length === 0 && <div className="text-xs text-slate-500">خوشه‌ای نیست</div>}
                  </div>
                )}

                {tab === 'trending' && (
                  <div className="space-y-2">
                    <div className="text-[11px] text-slate-500 mb-1">۵+ بازنشر در ۳۰ دقیقهٔ نخست</div>
                    {trendingClusters.map(c => (
                      <button key={c.id} onClick={() => setSelectedCluster(c)}
                        className="w-full text-right p-2 rounded-lg border border-orange-200 dark:border-orange-900/40 bg-orange-50/50 dark:bg-orange-950/20 hover:border-orange-400">
                        <div className="flex items-center gap-1 mb-1">
                          <Flame className="w-3 h-3 text-orange-500" />
                          <span className="text-[10px] text-orange-700 dark:text-orange-300 tabular-nums">{toFa((c.velocity * 60).toFixed(1))} بازنشر/ساعت</span>
                        </div>
                        <div className="text-xs line-clamp-2">{c.origin.title}</div>
                        <div className="text-[10px] text-slate-500 mt-1">{c.items.length} منبع · {formatDelay(c.spanMin)}</div>
                      </button>
                    ))}
                    {trendingClusters.length === 0 && <div className="text-xs text-slate-500">خوشهٔ ترندی یافت نشد</div>}
                  </div>
                )}

                {tab === 'influence' && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-2"><Award className="w-3 h-3" /> شاخص نفوذ (PageRank)</div>
                      <div className="space-y-1">
                        {topInfluence.map((n, i) => {
                          const [, mid] = catColor(n.category);
                          return (
                            <button key={n.id} onClick={() => setFocusNode(focusNode === n.id ? null : n.id)}
                              className={`w-full flex items-center gap-2 text-sm p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${focusNode === n.id ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''}`}>
                              <span className="w-4 text-[10px] text-slate-400 tabular-nums">{i + 1}</span>
                              <span className="w-2 h-2 rounded-full" style={{ background: mid }} />
                              <span>{n.icon}</span>
                              <span className="flex-1 truncate text-right">{n.name}</span>
                              <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-500" style={{ width: `${n.pagerank * 100}%` }} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-2"><Zap className="w-3 h-3" /> تعیین‌کنندهٔ دستور کار (Agenda)</div>
                      <div className="space-y-1">
                        {analytics.influence.slice(0, 10).map((r, i) => (
                          <button key={r.id} onClick={() => setFocusNode(focusNode === r.id ? null : r.id)}
                            className={`w-full flex items-center gap-2 text-sm p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${focusNode === r.id ? 'bg-rose-50 dark:bg-rose-950/30' : ''}`}>
                            <span className="w-4 text-[10px] text-slate-400 tabular-nums">{i + 1}</span>
                            <span>{r.icon}</span>
                            <span className="flex-1 truncate text-right">{r.name}</span>
                            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-rose-500 to-orange-500" style={{ width: `${r.composite * 100}%` }} />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-2"><GitBranch className="w-3 h-3" /> رتبه‌بندی منشأ اصلی</div>
                      <div className="space-y-1">
                        {topOrigins.map((n, i) => (
                          <div key={n.id} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-amber-50 dark:hover:bg-amber-950/30">
                            <span className="w-4 text-[10px] text-slate-400 tabular-nums">{i + 1}</span>
                            <span>{n.icon}</span>
                            <span className="flex-1 truncate">{n.name}</span>
                            <span className="text-xs tabular-nums text-amber-600 dark:text-amber-400">{toFa(n.firstCount)}×</span>
                          </div>
                        ))}
                        {topOrigins.length === 0 && <div className="text-xs text-slate-500">خوشه‌ای تشکیل نشده</div>}
                      </div>
                    </div>
                  </div>
                )}

                {tab === 'similar' && (
                  <div className="space-y-2">
                    {!focusNode && <div className="text-xs text-slate-500 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      <Sparkles className="w-4 h-4 mb-1 text-emerald-500" />
                      یک منبع روی گراف یا از تب «نفوذ» انتخاب کنید تا منابع با الگوی پوشش مشابه را ببینید.
                    </div>}
                    {focusNode && (
                      <>
                        <div className="text-[11px] text-slate-500 mb-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> منابع مشابه با <b className="text-slate-700 dark:text-slate-300">{focusNode}</b>
                        </div>
                        {similarSources.map(s => {
                          const [, mid] = catColor(s.category);
                          return (
                            <button key={s.id} onClick={() => setFocusNode(s.id)}
                              className="w-full flex items-center gap-2 text-sm p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-emerald-400">
                              <span className="w-2 h-2 rounded-full" style={{ background: mid }} />
                              <span>{s.icon}</span>
                              <span className="flex-1 truncate">{s.name}</span>
                              <span className="text-[10px] text-slate-500 tabular-nums">{s.overlap} خوشهٔ مشترک</span>
                              <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, s.score * 200)}%` }} />
                              </div>
                            </button>
                          );
                        })}
                        {similarSources.length === 0 && <div className="text-xs text-slate-500">منبع مشابهی یافت نشد</div>}
                      </>
                    )}
                  </div>
                )}

                {tab === 'alerts' && (
                  <div className="space-y-2">
                    <div className="text-[11px] text-slate-500 mb-1">همگرایی ناگهانی: خبرهایی که منابع با دسته‌های مختلف هم‌زمان پوشش داده‌اند</div>
                    {convergenceClusters.map(c => (
                      <button key={c.id} onClick={() => setSelectedCluster(c)}
                        className="w-full text-right p-2 rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 hover:border-rose-400">
                        <div className="flex items-center gap-1 mb-1">
                          <AlertTriangle className="w-3 h-3 text-rose-500" />
                          <span className="text-[10px] text-rose-700 dark:text-rose-300">{c.categories.length} دستهٔ مختلف</span>
                        </div>
                        <div className="text-xs line-clamp-2">{c.origin.title}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.categories.map(cat => {
                            const [, m] = catColor(cat);
                            return <span key={cat} className="px-1 rounded text-[9px]" style={{ background: m + '25', color: m }}>{cat || '—'}</span>;
                          })}
                        </div>
                      </button>
                    ))}
                    {convergenceClusters.length === 0 && <div className="text-xs text-slate-500">هشداری نیست</div>}
                  </div>
                )}

                {tab === 'watch' && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-slate-500 mb-1">خوشه‌های نشان‌شده برای پیگیری</div>
                    {graph.clusters.filter(c => watched.has(c.id)).map(c => (
                      <button key={c.id} onClick={() => setSelectedCluster(c)}
                        className="w-full text-right p-2 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 hover:border-amber-400">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs line-clamp-2 flex-1">{c.origin.title}</div>
                          <button onClick={(e) => { e.stopPropagation(); toggleWatch(c.id); }} className="p-1 -m-1 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded">
                            <X className="w-3 h-3 text-amber-700" />
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">{c.items.length} منبع · {formatDelay(c.spanMin)}</div>
                      </button>
                    ))}
                    {graph.clusters.filter(c => watched.has(c.id)).length === 0 && (
                      <div className="text-xs text-slate-500 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                        <Bookmark className="w-4 h-4 mb-1 text-amber-500" />
                        خوشه‌ای برای پیگیری نشان نشده. از تب «خوشه‌ها» روی آیکون بوک‌مارک کلیک کنید.
                      </div>
                    )}
                  </div>
                )}

                {tab === 'entities' && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                      <input value={entityQuery} onChange={e => setEntityQuery(e.target.value)}
                        placeholder="جستجوی موجودیت..."
                        className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg pr-7 pl-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {([
                        { id: 'all', label: 'همه', Icon: Filter },
                        { id: 'person', label: 'افراد', Icon: Users },
                        { id: 'org', label: 'سازمان', Icon: Building2 },
                        { id: 'place', label: 'مکان', Icon: MapPin },
                        { id: 'event', label: 'رویداد', Icon: Zap },
                      ] as const).map(f => (
                        <button key={f.id} onClick={() => setEntityTypeFilter(f.id as any)}
                          className={`text-[10px] px-2 py-1 rounded-full border flex items-center gap-1 ${entityTypeFilter === f.id ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}>
                          <f.Icon className="w-3 h-3" /> {f.label}
                        </button>
                      ))}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {analytics.entities.size.toLocaleString("fa-IR")} موجودیت شناسایی شد · {analytics.kg.length.toLocaleString("fa-IR")} ارتباط در گراف دانش
                    </div>
                    {focusEntityDetail && (
                      <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs truncate">{focusEntityDetail.ent.name}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {focusEntityDetail.ent.type} · {focusEntityDetail.ent.count} بار · {focusEntityDetail.ent.sources.size} منبع · {focusEntityDetail.ent.clusters.size} خوشه
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <a href={focusEntityDetail.ent.wikiUrl} target="_blank" rel="noreferrer"
                              className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-600" title="ویکی‌پدیا">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <button onClick={() => setFocusEntity(null)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        {focusEntityDetail.related.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-900/40">
                            <div className="text-[10px] text-slate-500 mb-1">مرتبط:</div>
                            <div className="flex flex-wrap gap-1">
                              {focusEntityDetail.related.map(r => {
                                const o = analytics.entities.get(r.other);
                                return (
                                  <button key={r.other} onClick={() => setFocusEntity(r.other)}
                                    className="text-[10px] px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-400">
                                    {o?.name || r.other} <span className="text-slate-400">·{r.weight}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="space-y-1">
                      {filteredEntities.map(e => {
                        const typeIcon = e.type === 'person' ? Users : e.type === 'org' ? Building2 : e.type === 'place' ? MapPin : Zap;
                        const TypeIcon = typeIcon;
                        const tint = e.type === 'person' ? 'text-emerald-600' : e.type === 'org' ? 'text-purple-600' : e.type === 'place' ? 'text-green-600' : 'text-rose-600';
                        return (
                          <button key={e.key} onClick={() => setFocusEntity(e.key)}
                            className={`w-full text-right p-2 rounded-lg border hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 ${focusEntity === e.key ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-slate-200 dark:border-slate-800'}`}>
                            <div className="flex items-center gap-2">
                              <TypeIcon className={`w-3.5 h-3.5 shrink-0 ${tint}`} />
                              <div className="text-xs flex-1 truncate">{e.name}</div>
                              <span className="text-[10px] text-slate-500 tabular-nums">{e.count}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 mr-5">
                              {e.sources.size} منبع · {e.clusters.size} خوشه
                            </div>
                          </button>
                        );
                      })}
                      {filteredEntities.length === 0 && <div className="text-xs text-slate-500 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">موجودیتی مطابق فیلتر یافت نشد.</div>}
                    </div>
                  </div>
                )}

                {tab === 'narrative' && (
                  <div className="space-y-2">
                    <div className="text-[10px] text-slate-500">
                      {analytics.narratives.length.toLocaleString("fa-IR")} روایت مجزا از خوشه‌ها استخراج شد
                    </div>
                    {analytics.narratives.slice(0, 30).map(n => {
                      const c = graph.clusters.find(x => x.id === n.clusterId);
                      return (
                        <div key={n.id} className="p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                          <button onClick={() => c && setSelectedCluster(c)} className="text-xs text-right w-full hover:text-emerald-600">
                            {c?.origin.title}
                          </button>
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">{n.label}</div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {n.terms.map(t => (
                              <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">{t}</span>
                            ))}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1.5">
                            {n.sources.length} منبع با همین قاب · {n.items.length} مقاله
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {n.sources.slice(0, 8).map(s => (
                              <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{s}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {analytics.narratives.length === 0 && <div className="text-xs text-slate-500">روایت تفکیک‌پذیری پیدا نشد.</div>}
                  </div>
                )}

                {tab === 'chain' && (
                  <div className="space-y-2">
                    <div className="text-[10px] text-slate-500">
                      زنجیره‌های رویدادی بر اساس موجودیت‌های مشترک در ۷۲ ساعت گذشته
                    </div>
                    {analytics.chains.slice(0, 25).map((link, i) => {
                      const A = graph.clusters.find(c => c.id === link.fromClusterId);
                      const B = graph.clusters.find(c => c.id === link.toClusterId);
                      if (!A || !B) return null;
                      return (
                        <div key={i} className="p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                          <button onClick={() => setSelectedCluster(A)} className="text-xs text-right w-full hover:text-emerald-600 line-clamp-2">
                            ← {A.origin.title}
                          </button>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 my-1">
                            <GitBranch className="w-3 h-3" /> فاصله: {toFa(link.gapHours.toFixed(1))} ساعت
                            <span>·</span>
                            <span>{link.sharedEntities.length} موجودیت مشترک</span>
                          </div>
                          <button onClick={() => setSelectedCluster(B)} className="text-xs text-right w-full hover:text-emerald-600 line-clamp-2">
                            → {B.origin.title}
                          </button>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {link.sharedEntities.slice(0, 6).map(k => {
                              const e = analytics.entities.get(k);
                              return <span key={k} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">{e?.name || k}</span>;
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {analytics.chains.length === 0 && <div className="text-xs text-slate-500">زنجیرهٔ رویدادی یافت نشد.</div>}
                  </div>
                )}

                {tab === 'echo' && (
                  <div className="space-y-2">
                    <div className="text-[10px] text-slate-500">
                      {analytics.echos.length.toLocaleString("fa-IR")} اتاق پژواک شناسایی شد (منابعی که عمدتاً یکدیگر را بازنشر می‌کنند)
                    </div>
                    {analytics.echos.map(g => (
                      <div key={g.id} className="p-2 rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20">
                        <div className="flex items-center justify-between">
                          <div className="text-xs">خوشهٔ {g.members.length} منبعی</div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-600 text-white tabular-nums">
                            انسجام {toFa((g.cohesion * 100).toFixed(0))}٪
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          یال داخلی: {g.internalWeight} · یال خارجی: {g.externalWeight}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {g.members.map(m => (
                            <button key={m} onClick={() => setFocusNode(m)}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/40 hover:border-rose-400">
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {analytics.echos.length === 0 && <div className="text-xs text-slate-500">اتاق پژواکی با آستانهٔ فعلی شناسایی نشد.</div>}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
