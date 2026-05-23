// Lightweight reading-history log persisted to localStorage.

const KEY = "kian.mobile.history";
const MAX = 200;

export type HistoryEntry = { id: string; at: number };

export function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

function save(arr: HistoryEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(arr.slice(0, MAX))); } catch {}
}

export function recordRead(id: string) {
  const prev = loadHistory().filter((e) => e.id !== id);
  prev.unshift({ id, at: Date.now() });
  save(prev);
}

export function clearHistory() {
  try { localStorage.removeItem(KEY); } catch {}
}
