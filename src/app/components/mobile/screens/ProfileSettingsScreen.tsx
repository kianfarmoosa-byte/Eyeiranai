import { useEffect, useRef, useState } from "react";
import { Camera, Check, Mail, User, Pencil, Globe, MapPin, ShieldCheck, Trash2, Bell, BookOpen } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { useHaptics } from "../hooks";
import { isEmail, saveUser, type KianUser } from "../auth/auth";

type Props = {
  user: KianUser;
  onClose: () => void;
  onUpdated: (u: KianUser) => void;
  onDelete?: () => void;
};

type Prefs = {
  bio: string;
  language: "fa" | "en";
  region: string;
  emailDigest: boolean;
  pushBreaking: boolean;
  pushTopics: boolean;
  defaultReader: "comfy" | "compact";
};

const PREFS_KEY = "kian.mobile.profilePrefs";

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...defaultPrefs(), ...JSON.parse(raw) };
  } catch {}
  return defaultPrefs();
}
function defaultPrefs(): Prefs {
  return {
    bio: "",
    language: "fa",
    region: "ایران",
    emailDigest: true,
    pushBreaking: true,
    pushTopics: true,
    defaultReader: "comfy",
  };
}

export function ProfileSettingsScreen({ user, onClose, onUpdated, onDelete }: Props) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [avatar, setAvatar] = useState<string | undefined>(user.avatar);
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const haptic = useHaptics();

  useEffect(() => { setDirty(true); }, [name, email, avatar, prefs]);

  const pickAvatar = () => fileRef.current?.click();
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(typeof reader.result === "string" ? reader.result : undefined);
    reader.readAsDataURL(f);
  };

  const save = () => {
    setErr(null);
    if (!name.trim()) return setErr("نام نمی‌تواند خالی باشد.");
    if (!isEmail(email)) return setErr("ایمیل معتبر نیست.");
    const updated: KianUser = { ...user, name: name.trim(), email: email.trim(), avatar };
    saveUser(updated);
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {}
    onUpdated(updated);
    haptic("success");
    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 1600);
  };

  const initial = (name.trim()[0] || "ک").toUpperCase();

  return (
    <MobileScreen
      topbar={
        <MobileTopBar
          title="ویرایش حساب"
          subtitle={dirty ? "تغییرات ذخیره نشده" : "همگام"}
          onBack={onClose}
          trailing={
            <button
              onClick={save}
              disabled={!dirty}
              className="h-8 px-3 rounded-full text-[12.5px] font-semibold tap press bg-[var(--brand-500)] text-white disabled:opacity-40 mx-1"
            >
              {saved ? <Check className="size-4 inline" /> : "ذخیره"}
            </button>
          }
        />
      }
    >
      <div className="h-full overflow-y-auto scrollbar-none pb-8">
        {/* Avatar */}
        <div className="flex flex-col items-center pt-6 pb-4">
          <button onClick={pickAvatar} className="relative tap press group" aria-label="تغییر تصویر">
            <div className="size-24 rounded-full bg-gradient-to-tr from-[var(--brand-500)] to-[var(--brand-300)] grid place-items-center text-white text-[34px] font-bold overflow-hidden shadow-[var(--shadow-md)]">
              {avatar ? (
                <img src={avatar} alt="" className="size-full object-cover" />
              ) : initial}
            </div>
            <span className="absolute bottom-0 left-0 size-8 rounded-full bg-[var(--card)] border border-[var(--border-subtle)] grid place-items-center shadow-[var(--shadow-sm)]">
              <Camera className="size-4" />
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
          <p className="mt-2 text-[11.5px] text-[var(--foreground-subtle)]">برای تغییر تصویر روی آواتار بزن</p>
        </div>

        {/* Identity */}
        <Group title="اطلاعات حساب">
          <FieldRow icon={<User className="size-4" />} label="نام">
            <input value={name} onChange={(e) => setName(e.target.value)}
                   className="w-full bg-transparent outline-none text-[14px] text-left" dir="auto" />
          </FieldRow>
          <FieldRow icon={<Mail className="size-4" />} label="ایمیل">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
                   className="w-full bg-transparent outline-none text-[14px] text-left" dir="ltr" />
          </FieldRow>
          <FieldRow icon={<Pencil className="size-4" />} label="بیوگرافی" multiline>
            <textarea
              value={prefs.bio}
              onChange={(e) => setPrefs({ ...prefs, bio: e.target.value })}
              rows={3}
              placeholder="یک جمله دربارهٔ خودت بنویس…"
              className="w-full bg-transparent outline-none text-[13.5px] resize-none leading-relaxed"
            />
          </FieldRow>
        </Group>

        {err && (
          <div className="mx-3 mt-3 text-[12px] text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
            {err}
          </div>
        )}

        {/* Localization */}
        <Group title="زبان و منطقه">
          <SegRow icon={<Globe className="size-4" />} label="زبان">
            <Seg value={prefs.language} onChange={(v) => setPrefs({ ...prefs, language: v })}
                 options={[{ id: "fa", label: "فارسی" }, { id: "en", label: "English" }]} />
          </SegRow>
          <FieldRow icon={<MapPin className="size-4" />} label="منطقه">
            <select
              value={prefs.region}
              onChange={(e) => setPrefs({ ...prefs, region: e.target.value })}
              className="w-full bg-transparent outline-none text-[14px] text-left"
              dir="rtl"
            >
              {["ایران", "افغانستان", "تاجیکستان", "ترکیه", "امارات", "اروپا", "آمریکای شمالی"].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </FieldRow>
        </Group>

        {/* Notifications */}
        <Group title="اعلان‌ها">
          <ToggleRow
            icon={<Bell className="size-4" />}
            label="پوش خبر فوری"
            description="هشدارهای فوری برای رویدادهای مهم"
            value={prefs.pushBreaking}
            onChange={(v) => setPrefs({ ...prefs, pushBreaking: v })}
          />
          <ToggleRow
            icon={<Bell className="size-4" />}
            label="پوش موضوعات دنبال‌شده"
            value={prefs.pushTopics}
            onChange={(v) => setPrefs({ ...prefs, pushTopics: v })}
          />
          <ToggleRow
            icon={<Mail className="size-4" />}
            label="خلاصهٔ ایمیلی روزانه"
            description={`به ${email || "ایمیل شما"} ارسال می‌شود`}
            value={prefs.emailDigest}
            onChange={(v) => setPrefs({ ...prefs, emailDigest: v })}
          />
        </Group>

        {/* Reading defaults */}
        <Group title="پیش‌فرض خواندن">
          <SegRow icon={<BookOpen className="size-4" />} label="چیدمان مقاله">
            <Seg value={prefs.defaultReader} onChange={(v) => setPrefs({ ...prefs, defaultReader: v })}
                 options={[{ id: "comfy", label: "راحت" }, { id: "compact", label: "فشرده" }]} />
          </SegRow>
        </Group>

        {/* Security */}
        <Group title="امنیت">
          <Row icon={<ShieldCheck className="size-4" />} label="تأیید دو مرحله‌ای" value="غیرفعال" />
          <Row icon={<ShieldCheck className="size-4" />} label="تغییر رمز عبور" />
        </Group>

        {/* Danger */}
        <div className="mx-3 mt-5">
          <button
            onClick={onDelete}
            className="w-full h-12 rounded-[var(--radius-lg)] border border-rose-500/30 text-rose-500 bg-rose-500/5 inline-flex items-center justify-center gap-2 text-[13.5px] font-semibold tap press"
          >
            <Trash2 className="size-4" />
            حذف حساب
          </button>
        </div>
      </div>
    </MobileScreen>
  );
}

/* ── Building blocks ──────────────────────────────────────────── */

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-[11px] font-semibold text-[var(--foreground-subtle)] uppercase tracking-wider px-4 mb-2">{title}</h3>
      <ul className="mx-3 rounded-[var(--radius-lg)] bg-[var(--card)] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
        {children}
      </ul>
    </section>
  );
}

function FieldRow({ icon, label, multiline, children }: { icon: React.ReactNode; label: string; multiline?: boolean; children: React.ReactNode }) {
  return (
    <li className={`px-3.5 py-3 ${multiline ? "" : "flex"} items-center gap-3`}>
      <div className={`flex items-center gap-3 ${multiline ? "mb-2" : ""}`}>
        <span className="size-8 grid place-items-center rounded-full bg-[var(--accent)] text-[var(--foreground-muted)]">{icon}</span>
        <span className="text-[12.5px] font-semibold text-[var(--foreground-muted)]">{label}</span>
      </div>
      <div className={`flex-1 ${multiline ? "" : ""}`}>{children}</div>
    </li>
  );
}

function SegRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <li className="px-3.5 py-3 flex items-center gap-3">
      <span className="size-8 grid place-items-center rounded-full bg-[var(--accent)] text-[var(--foreground-muted)]">{icon}</span>
      <span className="flex-1 text-[13.5px]">{label}</span>
      {children}
    </li>
  );
}

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[] }) {
  return (
    <div className="inline-flex bg-[var(--background-muted)] p-0.5 rounded-full text-[11.5px]">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-3 h-7 rounded-full tap press font-semibold transition-colors ${
            value === o.id ? "bg-[var(--card)] shadow-[var(--shadow-sm)]" : "text-[var(--foreground-muted)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ToggleRow({ icon, label, description, value, onChange }: {
  icon: React.ReactNode; label: string; description?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <li className="px-3.5 py-3 flex items-center gap-3">
      <span className="size-8 grid place-items-center rounded-full bg-[var(--accent)] text-[var(--foreground-muted)]">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] leading-tight">{label}</div>
        {description && <div className="text-[11px] text-[var(--foreground-subtle)] mt-0.5 truncate">{description}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
        className={`relative h-6 w-11 rounded-full transition-colors tap ${value ? "bg-[var(--brand-500)]" : "bg-[var(--border-strong)]"}`}
      >
        <span className={`absolute top-0.5 size-5 bg-white rounded-full shadow transition-all ${value ? "right-0.5" : "right-[22px]"}`} />
      </button>
    </li>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <li className="px-3.5 py-3 flex items-center gap-3">
      <span className="size-8 grid place-items-center rounded-full bg-[var(--accent)] text-[var(--foreground-muted)]">{icon}</span>
      <span className="flex-1 text-[13.5px]">{label}</span>
      {value && <span className="text-[12px] text-[var(--foreground-subtle)]">{value}</span>}
    </li>
  );
}
