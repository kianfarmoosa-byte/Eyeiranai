// ════════════════════════════════════════════════════════════════════
// روم استور — حالت محلی «اتاق رصد رسانه‌ای».
// همهٔ وضعیت عملیاتی اتاق (سنجاق‌ها، هشدارها و واکنش‌ها، یادداشت‌های تیمی،
// شیفت‌ها، دیده‌بان‌ها، پروتکل بحران) در localStorage نگه‌داری می‌شود تا اتاق
// بدون وابستگی به مهاجرت پایگاه‌داده، عملیاتی و پایدار بماند. زبان و ساختار
// داده‌ها بومی و عملیاتی است (Claim، تحویل شیفت، بریف موقعیت).
// ════════════════════════════════════════════════════════════════════

// ── وضعیت واکنش به هر هشدار ──
export type ResponseStatus = "new" | "reviewing" | "drafted" | "published" | "closed";

export const RESPONSE_FLOW: { id: ResponseStatus; label: string }[] = [
  { id: "new", label: "جدید" },
  { id: "reviewing", label: "در حال بررسی" },
  { id: "drafted", label: "پاسخ تهیه شد" },
  { id: "published", label: "منتشر شد" },
  { id: "closed", label: "بسته شد" },
];

export type AlertSeverity = "urgent" | "important" | "normal";

export type RoomAlert = {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  source?: string;
  link?: string;
  articleId?: string;
  topic?: string;
  kind: "keyword" | "wave" | "tone" | "manual" | "missed";
  status: ResponseStatus;
  claimedBy?: string;      // نام عضو تیمی که هشدار را برداشته
  createdAt: number;
  updatedAt: number;
  history: { at: number; by: string; note: string }[];
};

export type KeywordWatch = {
  id: string;
  term: string;
  severity: AlertSeverity;
  sound: boolean;
};

export type TeamNote = {
  id: string;
  articleId: string;
  by: string;
  text: string;
  label?: string;        // «مهم برای جلسهٔ فردا» و مانند آن
  at: number;
};

export type ShiftHandoff = {
  id: string;
  operator: string;
  startedAt: number;
  endedAt: number;
  summary: string;       // خلاصهٔ AI یا دستی از رویدادهای شیفت
  alertCount: number;
  createdAt: number;
};

export type CrisisProtocolStep = {
  id: string;
  label: string;
  done: boolean;
  doneAt?: number;
};

export type CrisisState = {
  active: boolean;
  topic: string;
  startedAt: number;
  protocol: CrisisProtocolStep[];
  timeline: { id: string; at: number; kind: "news" | "action" | "note"; text: string; source?: string; by?: string }[];
};

const KEYS = {
  operator: "room.operator",           // نام کاربر جاری (کارشناس رصد)
  pins: "room.pins",                   // آرایهٔ articleId های سنجاق‌شده
  watches: "room.watches",             // KeywordWatch[]
  alerts: "room.alerts",               // RoomAlert[]
  notes: "room.notes",                 // TeamNote[]
  shifts: "room.shifts",               // ShiftHandoff[]
  actors: "room.actors",               // نام رقبا/بازیگرانِ زیرِ رصد (string[])
  crisis: "room.crisis",               // CrisisState
  presenceMe: "room.presence.me",      // شناسهٔ حضور این نشست
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function write<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

// ── نام کاربر (کارشناس رصد) ──
export function getOperator(): string {
  return read<string>(KEYS.operator, "") || "";
}
export function setOperator(name: string) { write(KEYS.operator, name); }

// ── سنجاق ──
export function getPins(): string[] { return read<string[]>(KEYS.pins, []); }
export function setPins(ids: string[]) { write(KEYS.pins, ids); }

// ── دیده‌بان کلیدواژه ──
export function getWatches(): KeywordWatch[] { return read<KeywordWatch[]>(KEYS.watches, []); }
export function setWatches(w: KeywordWatch[]) { write(KEYS.watches, w); }

// ── هشدارها ──
export function getAlerts(): RoomAlert[] { return read<RoomAlert[]>(KEYS.alerts, []); }
export function setAlerts(a: RoomAlert[]) { write(KEYS.alerts, a.slice(-300)); }

// ── یادداشت‌های تیمی ──
export function getNotes(): TeamNote[] { return read<TeamNote[]>(KEYS.notes, []); }
export function setNotes(n: TeamNote[]) { write(KEYS.notes, n.slice(-500)); }

// ── شیفت‌ها ──
export function getShifts(): ShiftHandoff[] { return read<ShiftHandoff[]>(KEYS.shifts, []); }
export function setShifts(s: ShiftHandoff[]) { write(KEYS.shifts, s.slice(-100)); }

// ── بازیگران زیرِ رصد ──
export function getActors(): string[] { return read<string[]>(KEYS.actors, []); }
export function setActors(a: string[]) { write(KEYS.actors, a); }

// ── وضعیت بحران ──
export function getCrisis(): CrisisState {
  return read<CrisisState>(KEYS.crisis, { active: false, topic: "", startedAt: 0, protocol: [], timeline: [] });
}
export function setCrisis(c: CrisisState) { write(KEYS.crisis, c); }

// چک‌لیست پیش‌فرض پروتکل پاسخ سازمان (قابل ویرایش)
export function defaultProtocol(): CrisisProtocolStep[] {
  return [
    { id: "p1", label: "تأیید صحت خبر و منبع اصلی", done: false },
    { id: "p2", label: "اطلاع به مدیر ارشد و تیم پاسخ", done: false },
    { id: "p3", label: "تهیهٔ پیام رسمی / موضع سازمان", done: false },
    { id: "p4", label: "هماهنگی با روابط عمومی و حقوقی", done: false },
    { id: "p5", label: "انتشار پاسخ در کانال‌های رسمی", done: false },
    { id: "p6", label: "پایش بازخورد و به‌روزرسانی موضع", done: false },
  ];
}

export function uid(prefix = "id"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
