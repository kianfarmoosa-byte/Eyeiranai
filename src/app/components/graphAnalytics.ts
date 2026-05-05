// Persian-aware graph analytics: NER, Entity Linking, Knowledge Graph,
// Narrative Mining, Event Chains, Influence Scoring, Echo-Chamber Detection.
// Fully client-side, heuristic — no external API calls.

export type EntityType = "person" | "org" | "place" | "event";

export type Entity = {
  key: string;         // normalized canonical form
  name: string;        // display form
  type: EntityType;
  count: number;
  sources: Set<string>;
  clusters: Set<string>;
  firstTs: number;
  wikiUrl: string;
};

export type EntityEdge = {
  a: string; b: string; weight: number;
  coClusters: Set<string>;
};

export type Narrative = {
  id: string;
  clusterId: string;
  label: string;         // distinctive phrase
  terms: string[];
  sources: string[];     // sources that adopt this framing
  items: { id: string; source: string; title: string }[];
};

export type EventLink = {
  fromClusterId: string;
  toClusterId: string;
  sharedEntities: string[];
  gapHours: number;
};

export type EchoGroup = {
  id: string;
  members: string[];        // source ids
  cohesion: number;         // 0..1
  internalWeight: number;
  externalWeight: number;
};

// --------- Gazetteers / lexicons ---------

const PERSON_PREFIXES = [
  "آیت‌الله","آیت الله","حجت‌الاسلام","حجت الاسلام","دکتر","مهندس","آقای","خانم","سردار",
  "سرلشکر","سرتیپ","ژنرال","استاد","پروفسور","رئیس‌جمهور","رئیس جمهور","رهبر","وزیر","نمایندهٔ","نماینده",
  "شیخ","سید","علامه","مولانا","پادشاه","ملکه","پرزیدنت","رئیس",
];

const ORG_MARKERS = [
  "وزارت","سازمان","شرکت","بانک","مؤسسه","موسسه","دانشگاه","مجلس","دولت","کمیسیون","فدراسیون",
  "باشگاه","نیروی","ستاد","شورای","شورا","دادگاه","دادستانی","قوه","هیئت","هیات","کانون",
  "بنیاد","انجمن","حزب","جبهه","گروه","جنبش","کمیتهٔ","کمیته","اتحادیه","سندیکا","کنگره","سنا","پارلمان",
];

const PLACE_GAZETTEER = new Set([
  // Iran
  "ایران","تهران","مشهد","اصفهان","شیراز","تبریز","کرج","اهواز","قم","کرمانشاه","یزد","رشت","زاهدان","کرمان","اردبیل","همدان","بندرعباس","ساری","قزوین","اراک","خرم‌آباد","بوشهر","گرگان","بیرجند","ایلام","سنندج","ارومیه","شهرکرد","یاسوج","خوزستان","گیلان","مازندران","کردستان","لرستان","خراسان","فارس","آذربایجان",
  // Region
  "عراق","سوریه","لبنان","فلسطین","اسرائیل","غزه","کرانه باختری","یمن","بحرین","عربستان","امارات","قطر","کویت","عمان","ترکیه","افغانستان","پاکستان","تاجیکستان","آذربایجان",
  // World
  "آمریکا","ایالات متحده","روسیه","چین","انگلیس","بریتانیا","فرانسه","آلمان","ایتالیا","اسپانیا","ژاپن","کره","کرهٔ شمالی","کرهٔ جنوبی","هند","اوکراین","کانادا","استرالیا","مصر","اردن","سودان","لیبی","الجزایر","مراکش",
  // Cities
  "نیویورک","واشنگتن","لندن","پاریس","مسکو","پکن","استانبول","آنکارا","بغداد","دمشق","بیروت","قدس","اورشلیم","تل‌آویو","دوحه","ریاض","دبی","ابوظبی","کابل","اسلام‌آباد","دهلی","توکیو","سئول","کی‌یف",
]);

const EVENT_MARKERS = [
  "انتخابات","انفجار","حمله","تحریم","توافق","قرارداد","همایش","جلسه","نشست","کنفرانس","اجلاس",
  "بحران","جنگ","آتش‌بس","آتش بس","مذاکرات","مذاکره","تظاهرات","اعتصاب","راهپیمایی","زلزله","سیل","آتش‌سوزی","تصادف","ترور","ربوده","هواپیمایی","سقوط","سانحه",
];

// --------- Text utilities (Persian normalization) ---------

const DIACRITICS = /[\u064B-\u0652\u0670]/g;
const FA_STOP = new Set([
  "و","در","به","از","که","این","آن","را","با","بر","تا","است","هست","هستند","بود","شد","شده",
  "می","نمی","یک","های","ها","برای","یا","اگر","اما","هم","نیز","اش","ای","کرد","کند","خواهد","باید","آنها","ما","شما","او","من","نه","هر","چه","چرا","کجا","کی","چند","چون","بی","پس","پیش","نزد","کنار","بالا","پایین","درون","بیرون","حتی","فقط","همچنین","همواره","هرگز","گاه","گاهی",
]);

function norm(s: string): string {
  return (s || "")
    .replace(DIACRITICS, "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normKey(s: string): string {
  return norm(s).toLowerCase();
}

function cleanTokens(s: string): string[] {
  return norm(s)
    .replace(/[.,،:;!?؟«»"'()\[\]{}…\-—–\/\\]/g, " ")
    .split(/\s+/)
    .filter(t => t.length >= 2 && !FA_STOP.has(t));
}

// --------- NER ---------

function extractPersons(text: string): string[] {
  const out = new Set<string>();
  const t = norm(text);
  for (const pref of PERSON_PREFIXES) {
    const re = new RegExp(`${pref}\\s+([\u0600-\u06FF\\s\u200c]{2,40}?)(?=[،.,:;!?؟«»()\\n]|\\s(?:در|به|از|که|را|با|بر|تا|است|شد|کرد|گفت|اعلام|اظهار)|$)`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const cand = m[1].trim();
      const words = cand.split(/\s+/).filter(Boolean).slice(0, 4);
      if (words.length === 0) continue;
      const name = words.join(" ");
      if (name.length >= 3 && name.length <= 40) out.add(name);
    }
  }
  return Array.from(out);
}

function extractOrgs(text: string): string[] {
  const out = new Set<string>();
  const t = norm(text);
  for (const marker of ORG_MARKERS) {
    const re = new RegExp(`(${marker}(?:\\s+[\u0600-\u06FF\u200c]+){1,4})`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const span = m[1].trim();
      const words = span.split(/\s+/).slice(0, 5);
      if (words.length >= 2) out.add(words.join(" "));
    }
  }
  return Array.from(out);
}

function extractPlaces(text: string): string[] {
  const out = new Set<string>();
  const tokens = cleanTokens(text);
  for (const tk of tokens) {
    if (PLACE_GAZETTEER.has(tk)) out.add(tk);
  }
  // multi-word places
  const n = tokens.length;
  for (let i = 0; i < n - 1; i++) {
    const bi = `${tokens[i]} ${tokens[i + 1]}`;
    if (PLACE_GAZETTEER.has(bi)) out.add(bi);
  }
  return Array.from(out);
}

function extractEvents(text: string): string[] {
  const out = new Set<string>();
  const t = norm(text);
  for (const m of EVENT_MARKERS) {
    const re = new RegExp(`${m}(?:\\s+[\u0600-\u06FF\u200c]+){0,3}`, "g");
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(t)) !== null) {
      const span = mm[0].trim();
      const words = span.split(/\s+/).slice(0, 4);
      if (words.length >= 1) out.add(words.join(" "));
    }
  }
  return Array.from(out);
}

export function extractEntities(title: string, preview: string): { name: string; type: EntityType }[] {
  const text = `${title || ""} ${preview || ""}`;
  const seen = new Map<string, EntityType>();
  const add = (name: string, type: EntityType) => {
    const k = normKey(name);
    if (!k || k.length < 3) return;
    if (!seen.has(k)) seen.set(k, type);
  };
  for (const p of extractPersons(text)) add(p, "person");
  for (const o of extractOrgs(text)) add(o, "org");
  for (const p of extractPlaces(text)) add(p, "place");
  for (const e of extractEvents(text)) add(e, "event");
  return Array.from(seen.entries()).map(([key, type]) => ({ name: key, type }));
}

// --------- Entity aggregation + knowledge graph ---------

export type ClusterLike = {
  id: string;
  items: { id: string; source: string; title: string; ts: number }[];
  origin: { ts: number };
};

export type ArticleLike = {
  id: string; source: string; title: string; preview?: string; ts: number;
};

function wikiUrlFor(name: string): string {
  const q = encodeURIComponent(name.replace(/\s+/g, "_"));
  return `https://fa.wikipedia.org/wiki/${q}`;
}

export function buildEntityIndex(articles: ArticleLike[], clusterOf: Map<string, string>) {
  const entities = new Map<string, Entity>();
  const articleEntities = new Map<string, string[]>(); // articleId → entityKey[]
  for (const a of articles) {
    const raw = extractEntities(a.title, a.preview || "");
    const keys: string[] = [];
    for (const { name, type } of raw) {
      const key = normKey(name);
      keys.push(key);
      const ex = entities.get(key);
      if (ex) {
        ex.count++;
        ex.sources.add(a.source);
        const cid = clusterOf.get(a.id);
        if (cid) ex.clusters.add(cid);
        if (a.ts < ex.firstTs) ex.firstTs = a.ts;
      } else {
        const cid = clusterOf.get(a.id);
        entities.set(key, {
          key, name, type, count: 1,
          sources: new Set([a.source]),
          clusters: new Set(cid ? [cid] : []),
          firstTs: a.ts, wikiUrl: wikiUrlFor(name),
        });
      }
    }
    articleEntities.set(a.id, keys);
  }
  return { entities, articleEntities };
}

export function buildKnowledgeGraph(
  entities: Map<string, Entity>,
  articleEntities: Map<string, string[]>,
  articles: ArticleLike[],
  clusterOf: Map<string, string>,
): EntityEdge[] {
  const edgeMap = new Map<string, EntityEdge>();
  for (const a of articles) {
    const keys = articleEntities.get(a.id) || [];
    const cid = clusterOf.get(a.id);
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const x = keys[i]; const y = keys[j];
        if (x === y) continue;
        const [a1, b1] = x < y ? [x, y] : [y, x];
        const k = `${a1}|${b1}`;
        const e = edgeMap.get(k) || { a: a1, b: b1, weight: 0, coClusters: new Set<string>() };
        e.weight++;
        if (cid) e.coClusters.add(cid);
        edgeMap.set(k, e);
      }
    }
  }
  // prune weakest co-occurrences to keep graph legible
  const all = Array.from(edgeMap.values());
  return all.filter(e => e.weight >= 2).sort((a, b) => b.weight - a.weight);
}

// --------- Narrative Mining ---------
// For each cluster, compute distinctive phrases per source and group
// sources with similar framings via Jaccard on content tokens.

export function mineNarratives(
  clusters: ClusterLike[],
  articles: ArticleLike[],
): Narrative[] {
  const byId = new Map(articles.map(a => [a.id, a]));
  const result: Narrative[] = [];

  for (const c of clusters) {
    if (c.items.length < 2) continue;

    // global term frequency inside cluster
    const clusterTf = new Map<string, number>();
    const perItemTokens = new Map<string, Set<string>>();
    for (const it of c.items) {
      const a = byId.get(it.id);
      const toks = cleanTokens(`${a?.title || it.title} ${a?.preview || ""}`);
      const uniq = new Set(toks);
      perItemTokens.set(it.id, uniq);
      for (const t of uniq) clusterTf.set(t, (clusterTf.get(t) || 0) + 1);
    }

    // group items whose token overlap is high (Jaccard >= 0.35)
    const groups: { itemIds: string[]; tokens: Set<string> }[] = [];
    for (const it of c.items) {
      const mine = perItemTokens.get(it.id)!;
      let best = -1; let bestScore = 0.35;
      for (let g = 0; g < groups.length; g++) {
        const theirs = groups[g].tokens;
        let inter = 0;
        for (const t of mine) if (theirs.has(t)) inter++;
        const union = mine.size + theirs.size - inter;
        const s = union > 0 ? inter / union : 0;
        if (s > bestScore) { bestScore = s; best = g; }
      }
      if (best === -1) {
        groups.push({ itemIds: [it.id], tokens: new Set(mine) });
      } else {
        groups[best].itemIds.push(it.id);
        for (const t of mine) groups[best].tokens.add(t);
      }
    }

    // keep only groups of 2+ items OR groups with a distinctive label
    groups.forEach((g, idx) => {
      // pick top distinctive terms (frequent in group, rare in rest of cluster)
      const inGroup = new Map<string, number>();
      for (const id of g.itemIds) {
        const toks = perItemTokens.get(id)!;
        for (const t of toks) inGroup.set(t, (inGroup.get(t) || 0) + 1);
      }
      const scored: { term: string; score: number }[] = [];
      for (const [t, tfG] of inGroup) {
        const tfAll = clusterTf.get(t) || 1;
        const outside = tfAll - tfG;
        const score = tfG - outside * 0.5;
        if (score > 0 && t.length >= 3) scored.push({ term: t, score });
      }
      scored.sort((a, b) => b.score - a.score);
      const terms = scored.slice(0, 5).map(x => x.term);
      if (terms.length === 0) return;
      const items = g.itemIds
        .map(id => {
          const it = c.items.find(x => x.id === id)!;
          return { id: it.id, source: it.source, title: it.title };
        });
      const sources = Array.from(new Set(items.map(i => i.source)));
      result.push({
        id: `${c.id}-n${idx}`,
        clusterId: c.id,
        label: terms.slice(0, 3).join(" · "),
        terms, sources, items,
      });
    });
  }

  // sort: most framings with most sources first
  return result.sort((a, b) => b.sources.length - a.sources.length || b.items.length - a.items.length);
}

// --------- Event Chains ---------
// Link clusters temporally if they share entities and occur within 72h.

export function buildEventChains(
  clusters: ClusterLike[],
  articleEntities: Map<string, string[]>,
  maxGapHours = 72,
  minSharedEntities = 2,
): EventLink[] {
  // entities per cluster
  const clusterEnts = new Map<string, Set<string>>();
  const clusterTs = new Map<string, number>();
  for (const c of clusters) {
    const s = new Set<string>();
    for (const it of c.items) {
      const keys = articleEntities.get(it.id) || [];
      for (const k of keys) s.add(k);
    }
    clusterEnts.set(c.id, s);
    clusterTs.set(c.id, c.origin.ts);
  }

  const sorted = [...clusters].sort((a, b) => a.origin.ts - b.origin.ts);
  const links: EventLink[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const A = sorted[i]; const B = sorted[j];
      const gapH = (B.origin.ts - A.origin.ts) / 3600000;
      if (gapH > maxGapHours) break;
      if (gapH < 0.05) continue;
      const ea = clusterEnts.get(A.id)!;
      const eb = clusterEnts.get(B.id)!;
      const shared: string[] = [];
      for (const x of ea) if (eb.has(x)) shared.push(x);
      if (shared.length >= minSharedEntities) {
        links.push({ fromClusterId: A.id, toClusterId: B.id, sharedEntities: shared, gapHours: gapH });
      }
    }
  }
  return links.sort((a, b) => b.sharedEntities.length - a.sharedEntities.length);
}

// --------- Source Influence (agenda-setting) ---------

export type InfluenceRow = {
  id: string;
  name: string;
  icon: string;
  agenda: number;       // 0..1, how often this source's framing is adopted
  originCount: number;
  downstreamWeight: number;
  pagerank: number;
  composite: number;
};

export function computeInfluence(
  nodes: { id: string; name: string; icon: string; pagerank: number; firstCount: number }[],
  edges: { source: string; target: string; weight: number }[],
): InfluenceRow[] {
  const outWeight = new Map<string, number>();
  for (const e of edges) {
    outWeight.set(e.source, (outWeight.get(e.source) || 0) + e.weight);
  }
  const maxFirst = Math.max(1, ...nodes.map(n => n.firstCount));
  const maxDown = Math.max(1, ...Array.from(outWeight.values()));
  const rows: InfluenceRow[] = nodes.map(n => {
    const dw = outWeight.get(n.id) || 0;
    const agenda = (n.firstCount / maxFirst) * 0.6 + (dw / maxDown) * 0.4;
    return {
      id: n.id, name: n.name, icon: n.icon,
      originCount: n.firstCount,
      downstreamWeight: dw,
      pagerank: n.pagerank,
      agenda,
      composite: agenda * 0.6 + n.pagerank * 0.4,
    };
  });
  return rows.filter(r => r.originCount > 0 || r.pagerank > 0).sort((a, b) => b.composite - a.composite);
}

// --------- Echo-chamber Detection ---------
// Merge sources whose neighbor sets overlap heavily and have strong mutual edges.

export function detectEchoChambers(
  nodes: { id: string; name: string }[],
  edges: { source: string; target: string; weight: number }[],
  minJaccard = 0.45,
  minMutualWeight = 2,
): EchoGroup[] {
  // build neighbor map (undirected)
  const neighbors = new Map<string, Map<string, number>>();
  for (const n of nodes) neighbors.set(n.id, new Map());
  for (const e of edges) {
    const a = neighbors.get(e.source); const b = neighbors.get(e.target);
    if (a) a.set(e.target, (a.get(e.target) || 0) + e.weight);
    if (b) b.set(e.source, (b.get(e.source) || 0) + e.weight);
  }

  // union-find for merging
  const parent = new Map<string, string>();
  const rank = new Map<string, number>();
  for (const n of nodes) { parent.set(n.id, n.id); rank.set(n.id, 0); }
  const find = (x: string): string => {
    const p = parent.get(x)!;
    if (p === x) return x;
    const r = find(p); parent.set(x, r); return r;
  };
  const union = (x: string, y: string) => {
    const a = find(x); const b = find(y); if (a === b) return;
    const ra = rank.get(a)!, rb = rank.get(b)!;
    if (ra < rb) parent.set(a, b);
    else if (ra > rb) parent.set(b, a);
    else { parent.set(b, a); rank.set(a, ra + 1); }
  };

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const A = nodes[i].id, B = nodes[j].id;
      const na = neighbors.get(A)!; const nb = neighbors.get(B)!;
      if (na.size === 0 || nb.size === 0) continue;
      let inter = 0;
      for (const x of na.keys()) if (nb.has(x)) inter++;
      const un = na.size + nb.size - inter;
      const jac = un > 0 ? inter / un : 0;
      const mutual = (na.get(B) || 0) + (nb.get(A) || 0);
      if (jac >= minJaccard && mutual >= minMutualWeight) union(A, B);
    }
  }

  // group members by root
  const groups = new Map<string, string[]>();
  for (const n of nodes) {
    const r = find(n.id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(n.id);
  }

  const out: EchoGroup[] = [];
  for (const [root, members] of groups) {
    if (members.length < 3) continue;
    const memSet = new Set(members);
    let internal = 0, external = 0;
    for (const e of edges) {
      const a = memSet.has(e.source); const b = memSet.has(e.target);
      if (a && b) internal += e.weight;
      else if (a || b) external += e.weight;
    }
    const cohesion = (internal + external) > 0 ? internal / (internal + external) : 0;
    if (cohesion < 0.55) continue;
    out.push({
      id: `echo-${root}`,
      members,
      cohesion,
      internalWeight: internal,
      externalWeight: external,
    });
  }
  return out.sort((a, b) => b.cohesion - a.cohesion || b.members.length - a.members.length);
}
