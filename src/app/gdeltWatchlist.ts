import type { GdeltDocQuery } from "./gdelt";

export type Watchlist = {
  id: string;
  name: string;
  emoji: string;
  query: Pick<GdeltDocQuery, "q" | "lang" | "country" | "theme" | "timespan" | "sort">;
  createdAt: number;
  multilang?: boolean;
};

const KEY = "gdelt.watchlists";

export function loadWatchlists(): Watchlist[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function saveWatchlists(arr: Watchlist[]) {
  try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch {}
}
export function addWatchlist(w: Omit<Watchlist, "id" | "createdAt">): Watchlist {
  const list = loadWatchlists();
  const wl: Watchlist = { ...w, id: `wl_${Date.now().toString(36)}`, createdAt: Date.now() };
  list.unshift(wl);
  saveWatchlists(list);
  return wl;
}
export function removeWatchlist(id: string) {
  saveWatchlists(loadWatchlists().filter(w => w.id !== id));
}

const EMOJI_POOL = ["🔭", "🌐", "📡", "🛰️", "🔥", "⚡", "🌍", "🧭", "🛡️", "📊", "💼", "🗞️"];
export function pickEmoji(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return EMOJI_POOL[Math.abs(h) % EMOJI_POOL.length];
}
