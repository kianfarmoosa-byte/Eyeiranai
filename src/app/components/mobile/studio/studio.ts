// Content Studio (Phase 1) — shared metadata and the per-user id used to
// namespace studio data on the server. Logged-in users get a stable id; guests
// get a persistent device id so their drafts survive reloads.

import type { StudioPlatform, BrandProfile, ContentTemplate, PublishPlatform, RetryEntry } from "../../../api";
import { loadUser } from "../auth/auth";
import { addNotif } from "../utils/notifications";

const DEVICE_KEY = "kian.mobile.studioDevice";

export function studioUserId(): string {
  const u = loadUser();
  if (u?.id) return `u_${u.id}`;
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = `d_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export const PLATFORM_META: Record<StudioPlatform, { label: string; emoji: string; hint: string }> = {
  twitter:   { label: "توییتر / X", emoji: "𝕏",  hint: "حداکثر ۲۸۰ کاراکتر" },
  instagram: { label: "اینستاگرام", emoji: "📸", hint: "کپشن + هشتگ" },
  telegram:  { label: "تلگرام",     emoji: "✈️", hint: "پیام کانال" },
  rubika:    { label: "روبیکا",     emoji: "🟠", hint: "پیام کانال" },
  bale:      { label: "بله",        emoji: "🟢", hint: "پیام کانال" },
  website:   { label: "سایت خبری",  emoji: "🌐", hint: "خبر کامل" },
};

export const ALL_PLATFORMS: StudioPlatform[] = ["telegram", "bale", "rubika", "twitter", "instagram", "website"];

/** Platforms with real one-tap publishing support. */
export const PUBLISHABLE: PublishPlatform[] = ["telegram", "bale", "rubika", "website", "twitter", "instagram"];

export function isPublishable(p: StudioPlatform): p is PublishPlatform {
  return p === "telegram" || p === "bale" || p === "rubika" || p === "website" || p === "twitter" || p === "instagram";
}

/**
 * Turn permanently-failed ("dead") publish retries into local notifications.
 * De-duplicated by a stable id per entry, so calling this repeatedly (from the
 * heartbeat or when opening the retry queue) never produces duplicate alerts.
 */
export function notifyDeadPublishes(entries: RetryEntry[]): number {
  let added = 0;
  for (const e of entries) {
    if (e.status !== "dead") continue;
    const label = PLATFORM_META[e.platform as StudioPlatform]?.label || e.platform;
    const title = e.payload?.title
      ? `انتشار «${e.payload.title}» در ${label} ناموفق ماند`
      : `یک انتشار در ${label} ناموفق ماند`;
    const id = `pubfail-${e.id}`;
    const existed = addNotif({
      id,
      kind: "system",
      title,
      body: e.lastError ? `پس از چند تلاش خودکار موفق نشد — ${e.lastError}`.slice(0, 180) : "پس از چند تلاش خودکار موفق نشد.",
    }).filter((n) => n.id === id).length;
    // addNotif de-dups by id, so a freshly-added entry means this is new.
    if (existed) added++;
  }
  return added;
}

/** Short how-to for connecting each destination. */
export const CONNECT_HELP: Record<PublishPlatform, string> = {
  telegram: "در تلگرام از @BotFather یک ربات بساز و توکن را کپی کن. ربات را به کانال خود Admin کن. شناسهٔ کانال مثل @mychannel یا آیدی عددی است.",
  bale: "در بله از @botfather یک ربات بساز و توکن را بگیر. ربات را در کانال خود ادمین کن. شناسهٔ کانال مثل @mychannel است.",
  rubika: "در روبیکا یک ربات بساز و توکن Bot API را بگیر. ربات را در کانال خود ادمین کن. شناسهٔ کانال را وارد کن.",
  website: "برای وردپرس، آدرس سایت + نام کاربری + «رمز برنامه» (Application Password) را وارد کن. یا حالت Webhook را انتخاب و آدرس endpoint خود را بده.",
  twitter: "از پورتال توسعه‌دهندگان توییتر/X یک توکن دسترسی OAuth2 با مجوز نوشتن توییت (tweet.write) بگیر و اینجا وارد کن. (نیازمند پلن پولی API). فعلاً فقط متن منتشر می‌شود.",
  instagram: "اکانت باید Business/Creator و به صفحهٔ فیسبوک متصل باشد. از Graph API توکن دسترسی و شناسهٔ IG Business بگیر. انتشار نیازمند تصویر است.",
};

export const DEFAULT_BRAND: BrandProfile = {
  name: "",
  tagline: "",
  tone: "حرفه‌ای و بی‌طرف",
  audience: "",
  language: "fa",
  signature: "",
  hashtags: [],
  emoji: false,
};

export const TONE_OPTIONS = [
  "حرفه‌ای و بی‌طرف",
  "خبری و رسمی",
  "خودمانی و صمیمی",
  "تحلیلی و عمیق",
  "هیجانی و جذاب",
];

export function emptyTemplate(): ContentTemplate {
  return {
    id: "",
    name: "",
    platforms: ["telegram"],
    structure: "",
    maxLength: 0,
    includeLink: true,
    includeSource: true,
    cardTheme: "dark",
    cardRatio: "square",
  };
}

/** Shared input styling for studio forms. */
export const INPUT_CLS =
  "w-full h-10 px-3 rounded-[var(--radius-md)] bg-[var(--input-background)] border border-[var(--border-subtle)] text-[14px] outline-none focus:border-[var(--brand-500)]";

/** Character budget per platform for the live counter (0 = no hard limit). */
export const PLATFORM_LIMIT: Record<StudioPlatform, number> = {
  twitter: 280,
  instagram: 2200,
  telegram: 4096,
  rubika: 4096,
  bale: 4096,
  website: 0,
};
