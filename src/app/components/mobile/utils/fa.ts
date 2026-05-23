/**
 * Persian formatting helpers — no external deps. Designed for UI text only;
 * for parsing dates back into Date objects, use a real Jalaali library.
 */

const FA_DIGITS = ["۰","۱","۲","۳","۴","۵","۶","۷","۸","۹"];

/** Convert ASCII digits within a string to Persian digits. Leaves other chars. */
export function toFa(input: string | number): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[+d]);
}

/** Format an integer with Persian digits + Arabic thousands separator. */
export function faNum(n: number, opts?: { fractionDigits?: number }): string {
  return new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: opts?.fractionDigits ?? 0,
  }).format(n);
}

/**
 * Concise Persian relative time. Returns strings like "همین حالا", "۳ دقیقه پیش",
 * "دیروز", "۲ هفته پیش". For dates older than a year, falls back to absolute fa-IR date.
 */
export function timeAgoFa(input: Date | number | string): string {
  const now = Date.now();
  const t = input instanceof Date ? input.getTime() : typeof input === "number" ? input : Date.parse(input);
  if (!isFinite(t)) return "";
  const diff = Math.max(0, now - t);
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "همین حالا";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${faNum(min)} دقیقه پیش`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${faNum(hr)} ساعت پیش`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "دیروز";
  if (day < 7) return `${faNum(day)} روز پیش`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${faNum(wk)} هفته پیش`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${faNum(mo)} ماه پیش`;
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(t);
}

/**
 * Format a date in the Persian (Jalaali) calendar using the browser's Intl.
 * Most modern browsers support `ca: "persian"` via the Intl API.
 */
export function jalaali(input: Date | number | string, opts: Intl.DateTimeFormatOptions = { dateStyle: "long" }): string {
  const t = input instanceof Date ? input : new Date(input);
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", opts).format(t);
}

/** Persian-friendly pluralization helper. Persian has no true plural — but UI
 *  often reads better with explicit count phrasing. */
export function countFa(n: number, singular: string, plural?: string): string {
  return `${faNum(n)} ${n === 1 || !plural ? singular : plural}`;
}
