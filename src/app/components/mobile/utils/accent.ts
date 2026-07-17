/**
 * Brand accent override. Lets the user pick from a handful of OKLCH hues that
 * remap --brand-500/600/700 on :root. Persists across sessions and is applied
 * on app boot so the choice survives reloads.
 */

const KEY = "kian.mobile.accent";

export type Accent = {
  id: string;
  name: string;
  /** Preview swatch in OKLCH (matches --brand-500). */
  swatch: string;
  brand500: string;
  brand600: string;
  brand700: string;
};

export const ACCENTS: Accent[] = [
  { id: "gold",   name: "طلایی",   swatch: "#F5BF0F", brand500: "#F5BF0F", brand600: "#D9A60A", brand700: "#B0850A" },
  { id: "violet", name: "بنفش",    swatch: "oklch(0.55 0.230 300)", brand500: "oklch(0.55 0.230 300)", brand600: "oklch(0.46 0.235 302)", brand700: "oklch(0.38 0.205 302)" },
  { id: "rose",   name: "رز",      swatch: "oklch(0.60 0.215 12)",  brand500: "oklch(0.60 0.215 12)",  brand600: "oklch(0.50 0.220 14)",  brand700: "oklch(0.42 0.190 14)"  },
  { id: "amber",  name: "کهربا",   swatch: "oklch(0.70 0.180 65)",  brand500: "oklch(0.70 0.180 65)",  brand600: "oklch(0.60 0.190 60)",  brand700: "oklch(0.50 0.170 55)"  },
  { id: "emerald",name: "زمرد",    swatch: "oklch(0.62 0.150 160)", brand500: "oklch(0.62 0.150 160)", brand600: "oklch(0.52 0.155 162)", brand700: "oklch(0.43 0.135 162)" },
  { id: "teal",   name: "فیروزه",  swatch: "oklch(0.62 0.130 200)", brand500: "oklch(0.62 0.130 200)", brand600: "oklch(0.52 0.135 202)", brand700: "oklch(0.43 0.120 202)" },
];

export function loadAccentId(): string {
  try { return localStorage.getItem(KEY) || "gold"; } catch { return "gold"; }
}

export function saveAccentId(id: string) {
  try { localStorage.setItem(KEY, id); } catch {}
}

export function applyAccent(id: string) {
  const a = ACCENTS.find((x) => x.id === id) ?? ACCENTS[0];
  const r = document.documentElement.style;
  r.setProperty("--brand-500", a.brand500);
  r.setProperty("--brand-600", a.brand600);
  r.setProperty("--brand-700", a.brand700);
}
