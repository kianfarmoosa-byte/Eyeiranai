export type KianUser = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt: number;
};

const KEY = "kian.mobile.user";

export function loadUser(): KianUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as KianUser;
  } catch { return null; }
}

export function saveUser(u: KianUser) {
  try { localStorage.setItem(KEY, JSON.stringify(u)); } catch {}
}

export function clearUser() {
  try { localStorage.removeItem(KEY); } catch {}
}

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

export function scorePassword(p: string): { score: 0 | 1 | 2 | 3 | 4; label: string; tone: string } {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) || /[؀-ۿ]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^\w\s]/.test(p)) s++;
  const map: Record<number, { label: string; tone: string }> = {
    0: { label: "خالی",        tone: "bg-[var(--border-strong)]" },
    1: { label: "ضعیف",        tone: "bg-rose-500" },
    2: { label: "متوسط",       tone: "bg-amber-500" },
    3: { label: "خوب",         tone: "bg-sky-500" },
    4: { label: "قوی",         tone: "bg-emerald-500" },
  };
  return { score: s as 0 | 1 | 2 | 3 | 4, ...map[s] };
}
