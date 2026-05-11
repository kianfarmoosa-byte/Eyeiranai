import { projectId, publicAnonKey } from "../../utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-a2e7e82a/gdelt`;

export type GdeltArticle = {
  id: string;
  url: string;
  title: string;
  source: string;
  domain: string;
  sourceCountry: string;
  language: string;
  date: string;
  image?: string;
  socialImage?: string;
  tone?: number;
};

export type GdeltDocQuery = {
  q: string;
  lang?: string;          // e.g. "persian", "english", "arabic"
  country?: string;       // ISO-2 e.g. "IR", "US"
  theme?: string;         // GDELT theme code, e.g. "ECON_INFLATION"
  domain?: string;
  toneMin?: number;
  toneMax?: number;
  timespan?: string;      // "1h" | "24h" | "7d" | "1m" | "3m" | "1y"
  sort?: "DateDesc" | "DateAsc" | "ToneDesc" | "ToneAsc" | "HybridRel";
  max?: number;           // 10..250
};

function toParams(q: GdeltDocQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.q) p.set("q", q.q);
  if (q.lang) p.set("lang", q.lang);
  if (q.country) p.set("country", q.country);
  if (q.theme) p.set("theme", q.theme);
  if (q.domain) p.set("domain", q.domain);
  if (typeof q.toneMin === "number") p.set("toneMin", String(q.toneMin));
  if (typeof q.toneMax === "number") p.set("toneMax", String(q.toneMax));
  if (q.timespan) p.set("timespan", q.timespan);
  if (q.sort) p.set("sort", q.sort);
  if (q.max) p.set("max", String(q.max));
  return p;
}

async function call(path: string, params: URLSearchParams) {
  const r = await fetch(`${BASE}${path}?${params}`, {
    headers: { Authorization: `Bearer ${publicAnonKey}` },
  });
  if (!r.ok) throw new Error(`gdelt ${path} → ${r.status}`);
  return r.json();
}

export async function gdeltDoc(query: GdeltDocQuery): Promise<{ articles: GdeltArticle[] }> {
  return call("/doc", toParams(query));
}

export async function gdeltTimeline(query: GdeltDocQuery & { mode?: "TimelineVol" | "TimelineTone" }) {
  const p = toParams(query);
  if (query.mode) p.set("mode", query.mode);
  return call("/timeline", p);
}

export async function gdeltGeo(query: GdeltDocQuery): Promise<any> {
  return call("/geo", toParams(query));
}

export async function gdeltTv(q: string, opts: { network?: string; timespan?: string } = {}) {
  const p = new URLSearchParams({ q });
  if (opts.network) p.set("network", opts.network);
  if (opts.timespan) p.set("timespan", opts.timespan);
  return call("/tv", p);
}

// Curated GDELT theme codes most relevant for Persian/Iran international news.
export const GDELT_PRESET_THEMES: Array<{ code: string; label: string; icon: string }> = [
  { code: "ECON_INFLATION",       label: "تورم",            icon: "💰" },
  { code: "ECON_BANKING",         label: "بانکی",            icon: "🏦" },
  { code: "ECON_OIL",             label: "نفت",              icon: "🛢️" },
  { code: "ECON_SANCTIONS",       label: "تحریم",            icon: "🚫" },
  { code: "PROTEST",              label: "اعتراض",           icon: "📢" },
  { code: "ARMEDCONFLICT",        label: "درگیری مسلحانه",   icon: "⚔️" },
  { code: "MILITARY",             label: "نظامی",            icon: "🛡️" },
  { code: "TERROR",               label: "تروریسم",          icon: "💥" },
  { code: "WB_2024_ANTI_CORRUPTION", label: "فساد",         icon: "⚖️" },
  { code: "ELECTION",             label: "انتخابات",         icon: "🗳️" },
  { code: "GOV_DIVISIONOFPOWER",  label: "حاکمیت",           icon: "🏛️" },
  { code: "ENV_CLIMATECHANGE",    label: "اقلیم",            icon: "🌍" },
  { code: "TECH_AI",              label: "هوش مصنوعی",      icon: "🤖" },
  { code: "HEALTH_PANDEMIC",      label: "اپیدمی",           icon: "🦠" },
  { code: "DISPLACED",            label: "آوارگان",          icon: "🚸" },
];

// Pre-fab country chips for quick filtering.
export const GDELT_COUNTRIES: Array<{ code: string; label: string; flag: string }> = [
  { code: "IR", label: "ایران",     flag: "🇮🇷" },
  { code: "US", label: "آمریکا",    flag: "🇺🇸" },
  { code: "GB", label: "بریتانیا",  flag: "🇬🇧" },
  { code: "FR", label: "فرانسه",    flag: "🇫🇷" },
  { code: "DE", label: "آلمان",     flag: "🇩🇪" },
  { code: "RU", label: "روسیه",     flag: "🇷🇺" },
  { code: "CN", label: "چین",       flag: "🇨🇳" },
  { code: "TR", label: "ترکیه",     flag: "🇹🇷" },
  { code: "SA", label: "عربستان",   flag: "🇸🇦" },
  { code: "IL", label: "اسرائیل",   flag: "🇮🇱" },
  { code: "AE", label: "امارات",    flag: "🇦🇪" },
  { code: "IQ", label: "عراق",      flag: "🇮🇶" },
];

export const GDELT_LANGS: Array<{ code: string; label: string }> = [
  { code: "persian", label: "فارسی" },
  { code: "english", label: "انگلیسی" },
  { code: "arabic",  label: "عربی" },
  { code: "russian", label: "روسی" },
  { code: "french",  label: "فرانسوی" },
  { code: "german",  label: "آلمانی" },
  { code: "turkish", label: "ترکی" },
];
