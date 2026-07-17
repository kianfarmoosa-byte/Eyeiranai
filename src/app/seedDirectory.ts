import { api } from "./api";
import { SEED_FEEDS } from "./feedsData";
import { INTL_FEEDS } from "./internationalFeeds";

// One-time authoritative reseed of the media directory from the bundled CSV
// (src/imports/media_rss_directory_iran_expanded_2026-07-17.csv).
// Bumping this version wipes the existing feed list and re-imports everything,
// split into domestic Iran vs. international sources.
export const DIRECTORY_VERSION = "media-directory-2026-07-17";
const LS_KEY = "kian.mediaDirectory.version";
// Legacy first-run flag used by InternationalNewsScreen — set it so the old
// per-screen importer becomes a no-op after the global reseed.
const LEGACY_INTL_KEY = "kian.mobile.intlFeedsImported.v1";

export function directorySeeded(): boolean {
  try { return localStorage.getItem(LS_KEY) === DIRECTORY_VERSION; } catch { return false; }
}

// Build the full payload: domestic first, then international.
export function buildDirectoryPayload(): { url: string; name: string; icon?: string; category?: string }[] {
  const domestic = SEED_FEEDS.map(f => ({
    url: f.url,
    name: f.name,
    icon: "📰",
    category: `داخلی · ${f.category}`,
  }));
  const international = INTL_FEEDS.map(f => ({
    url: f.url,
    name: f.nameFa || f.name,
    icon: f.flag || "🌐",
    category: `بین‌الملل · ${f.countryName} · ${f.categoryFa}`,
  }));
  // Dedupe by url (domestic wins on collision).
  const seen = new Set<string>();
  const out: { url: string; name: string; icon?: string; category?: string }[] = [];
  for (const item of [...domestic, ...international]) {
    if (!item.url || seen.has(item.url)) continue;
    seen.add(item.url);
    out.push(item);
  }
  return out;
}

// Guard against concurrent runs (React StrictMode double-invokes mount effects,
// and multiple screens may trigger a seed) — a clear() racing a bulkAdd() would
// corrupt the feed list and abort in-flight requests.
let inFlight: Promise<number> | null = null;

/**
 * Wipe all current feeds and re-import the full CSV directory. Runs at most once
 * per DIRECTORY_VERSION. Returns the number of feeds imported (0 if skipped).
 */
export function seedMediaDirectory(opts: { force?: boolean } = {}): Promise<number> {
  if (!opts.force && directorySeeded()) return Promise.resolve(0);
  if (inFlight) return inFlight;
  inFlight = doSeed().finally(() => { inFlight = null; });
  return inFlight;
}

async function doSeed(): Promise<number> {
  const payload = buildDirectoryPayload();

  // 1) Remove every existing source/link so the directory is authoritative.
  await api.clearFeeds();

  // 2) Bulk-add in chunks to stay within request-size limits.
  const CHUNK = 100;
  let added = 0;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const slice = payload.slice(i, i + CHUNK);
    try {
      await api.bulkAdd(slice);
      added += slice.length;
    } catch (e) {
      console.log(`seedMediaDirectory bulkAdd chunk ${i}-${i + slice.length} failed:`, e);
      throw e;
    }
  }

  try {
    localStorage.setItem(LS_KEY, DIRECTORY_VERSION);
    localStorage.setItem(LEGACY_INTL_KEY, "1");
  } catch { /* ignore storage errors */ }

  return added;
}
