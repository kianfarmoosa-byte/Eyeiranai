// In-app automation scheduler ("heartbeat").
//
// The server's /automation/tick already gates each rule by its own interval
// (everyMinutes / dailyTime), so calling it too often is harmless — it just
// no-ops until a rule is due. What was missing was *something* that calls it
// periodically. This hook does that while the app is open, coordinated across
// tabs so only one tab ticks per window, and pausing itself while the tab is
// hidden to avoid needless calls. For true 24/7 automation, an external cron
// hitting /automation/tick is still recommended (see AutomationScreen note).

import { useEffect, useRef } from "react";
import { api } from "./api";
import { studioUserId, notifyDeadPublishes } from "./components/mobile/studio/studio";

const ENABLED_KEY = "flow.automation.heartbeat.enabled"; // "0" to disable
const LAST_KEY = "flow.automation.heartbeat.lastAt";     // epoch ms of last local tick
const LOCK_KEY = "flow.automation.heartbeat.lock";       // cross-tab lock owner+ts

const INTERVAL_MS = 5 * 60 * 1000; // minimum spacing between ticks
const CHECK_MS = 60 * 1000;        // how often we re-evaluate whether to tick
const LOCK_TTL = 90 * 1000;        // stale-lock timeout

export function isHeartbeatEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) !== "0"; } catch { return true; }
}

export function setHeartbeatEnabled(on: boolean) {
  try { localStorage.setItem(ENABLED_KEY, on ? "1" : "0"); } catch { /* ignore */ }
}

function readNum(key: string): number {
  try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; }
}

// Best-effort cross-tab lock so multiple open tabs don't all fire the tick.
function acquireLock(id: string): boolean {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    const now = Date.now();
    if (raw) {
      const [, ts] = raw.split("|");
      if (now - Number(ts) < LOCK_TTL) return false; // someone holds a fresh lock
    }
    localStorage.setItem(LOCK_KEY, `${id}|${now}`);
    // Re-read to confirm we won the race.
    return (localStorage.getItem(LOCK_KEY) || "").startsWith(`${id}|`);
  } catch {
    return true;
  }
}

function releaseLock(id: string) {
  try {
    if ((localStorage.getItem(LOCK_KEY) || "").startsWith(`${id}|`)) {
      localStorage.removeItem(LOCK_KEY);
    }
  } catch { /* ignore */ }
}

export function useAutomationHeartbeat() {
  const tabId = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    let stopped = false;

    const maybeTick = async () => {
      if (stopped) return;
      if (!isHeartbeatEnabled()) return;
      if (document.visibilityState !== "visible") return; // only tick foregrounded tabs
      if (Date.now() - readNum(LAST_KEY) < INTERVAL_MS) return;
      if (!acquireLock(tabId.current)) return;
      try {
        // Claim the window immediately so sibling tabs back off.
        try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch { /* ignore */ }
        const res = await api.studioRunTick("app");
        // If any publish exhausted its retries, surface it as a notification.
        if ((res.retryDead || 0) > 0) {
          try { notifyDeadPublishes(await api.studioGetRetries(studioUserId())); } catch { /* ignore */ }
        }
      } catch (e) {
        console.log("automation heartbeat tick failed:", e);
      } finally {
        releaseLock(tabId.current);
      }
    };

    // Kick shortly after load (once feeds/rules are likely warm), then poll.
    const kickoff = setTimeout(maybeTick, 15 * 1000);
    const timer = setInterval(maybeTick, CHECK_MS);
    const onVisible = () => { if (document.visibilityState === "visible") maybeTick(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearTimeout(kickoff);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      releaseLock(tabId.current);
    };
  }, []);
}
