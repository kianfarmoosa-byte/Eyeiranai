/**
 * Daily reading-goal & streak tracker. Streak counts consecutive days where
 * the user read ≥ `goal` articles. Read events come from the shared history
 * log so no extra recording is needed.
 */

import { loadHistory } from "./history";

const GOAL_KEY = "kian.mobile.readingGoal";
const DEFAULT_GOAL = 3;
const DAY = 86_400_000;

export function loadGoal(): number {
  try {
    const n = Number(localStorage.getItem(GOAL_KEY));
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_GOAL;
  } catch { return DEFAULT_GOAL; }
}

export function saveGoal(n: number) {
  try { localStorage.setItem(GOAL_KEY, String(Math.max(1, Math.min(50, n | 0)))); } catch {}
}

/** Articles read today (since local midnight). */
export function todayCount(): number {
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  return loadHistory().filter((e) => e.at >= t0.getTime()).length;
}

/**
 * Streak in days. Counts back from today; a day "counts" when reads ≥ goal.
 * If today is below goal but yesterday hit it, the streak still includes
 * yesterday (so the streak doesn't visually break until the user misses a
 * full day).
 */
export function currentStreak(goal = loadGoal()): number {
  const entries = loadHistory();
  if (entries.length === 0) return 0;

  // Count per local-day-bucket
  const perDay = new Map<number, number>();
  for (const e of entries) {
    const d = new Date(e.at); d.setHours(0, 0, 0, 0);
    perDay.set(d.getTime(), (perDay.get(d.getTime()) ?? 0) + 1);
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  let cursor = today.getTime();
  let streak = 0;

  // Today: incomplete is fine, just don't decrement
  if ((perDay.get(cursor) ?? 0) >= goal) {
    streak += 1;
  }
  cursor -= DAY;

  while ((perDay.get(cursor) ?? 0) >= goal) {
    streak += 1;
    cursor -= DAY;
  }
  return streak;
}

/** Longest historical streak — useful for "best" badge. */
export function bestStreak(goal = loadGoal()): number {
  const entries = loadHistory();
  if (entries.length === 0) return 0;
  const perDay = new Map<number, number>();
  for (const e of entries) {
    const d = new Date(e.at); d.setHours(0, 0, 0, 0);
    perDay.set(d.getTime(), (perDay.get(d.getTime()) ?? 0) + 1);
  }
  const days = [...perDay.keys()].sort((a, b) => a - b);
  let best = 0; let cur = 0; let prev = 0;
  for (const d of days) {
    if ((perDay.get(d) ?? 0) < goal) { cur = 0; prev = d; continue; }
    cur = prev && d - prev === DAY ? cur + 1 : 1;
    if (cur > best) best = cur;
    prev = d;
  }
  return best;
}
