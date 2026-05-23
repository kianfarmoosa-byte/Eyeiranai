import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Lock, User, Eye, EyeOff, Sparkles, ChevronLeft, Apple, Chrome, ShieldCheck } from "lucide-react";
import { useHaptics } from "../hooks";
import { isEmail, saveUser, scorePassword, type KianUser } from "./auth";

type Mode = "signin" | "signup";

type Props = {
  open: boolean;
  initialMode?: Mode;
  onClose: () => void;
  onSuccess: (u: KianUser) => void;
};

export function AuthScreen({ open, initialMode = "signin", onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const haptic = useHaptics();

  if (!open) return null;

  const isSignup = mode === "signup";
  const pwdMeter = scorePassword(pwd);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErr(null);
    if (!isEmail(email)) return setErr("ایمیل وارد شده معتبر نیست.");
    if (pwd.length < 6) return setErr("رمز عبور باید حداقل ۶ کاراکتر باشد.");
    if (isSignup && !name.trim()) return setErr("نام خود را وارد کنید.");
    if (isSignup && !agree) return setErr("برای ادامه باید قوانین را بپذیرید.");

    setBusy(true);
    await new Promise((r) => setTimeout(r, 650));
    const u: KianUser = {
      id: crypto.randomUUID?.() ?? String(Date.now()),
      name: isSignup ? name.trim() : email.split("@")[0],
      email: email.trim(),
      createdAt: Date.now(),
    };
    saveUser(u);
    haptic("success");
    setBusy(false);
    onSuccess(u);
  };

  const social = (provider: "google" | "apple") => {
    haptic("tap");
    const u: KianUser = {
      id: crypto.randomUUID?.() ?? String(Date.now()),
      name: provider === "google" ? "کاربر گوگل" : "کاربر اپل",
      email: `user.${provider}@kian.app`,
      createdAt: Date.now(),
    };
    saveUser(u);
    onSuccess(u);
  };

  return (
    <div dir="rtl" className="fixed inset-0 z-[var(--z-mobile-reader)] bg-[var(--background)] text-[var(--foreground)] flex flex-col overflow-y-auto">
      {/* Hero */}
      <div className="relative h-[260px] shrink-0 overflow-hidden text-white"
           style={{ background: "linear-gradient(160deg, #ED1C24 0%, #61070A 100%)" }}>
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: "radial-gradient(120% 70% at 50% 15%, rgba(255,255,255,0.28) 0%, transparent 60%)" }} />
        <button
          onClick={onClose}
          aria-label="بستن"
          className="absolute top-[calc(12px+var(--safe-top))] right-3 size-9 grid place-items-center rounded-full bg-white/15 backdrop-blur tap press"
        >
          <ChevronLeft className="size-5 rotate-180" />
        </button>

        <div className="absolute inset-x-0 bottom-0 p-5 pb-6">
          <div className="size-12 rounded-2xl bg-white/95 grid place-items-center mb-3">
            <div className="size-9 rounded-xl bg-gradient-to-br from-[#ED1C24] to-[#61070A] grid place-items-center">
              <Sparkles className="size-5 text-white" />
            </div>
          </div>
          <h1 className="text-[24px] font-black tracking-tight leading-none">
            {isSignup ? "ساخت حساب کیان" : "خوش آمدید"}
          </h1>
          <p className="text-[13px] text-white/85 mt-1.5 max-w-[280px] leading-relaxed">
            {isSignup
              ? "حساب بساز و خبرها، یادداشت‌ها و موضوعات موردعلاقه‌ات را همگام نگه دار."
              : "وارد شو تا تجربهٔ شخصی‌سازی‌شدهٔ خبر را ادامه دهی."}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-5 pt-4 pb-[calc(20px+var(--safe-bottom))]">
        {/* Tab switcher */}
        <div className="inline-flex w-full rounded-full bg-[var(--background-muted)] p-0.5 text-[13px] mb-5">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { haptic("tap"); setMode(m); setErr(null); }}
              className={`flex-1 h-10 rounded-full tap press transition-colors font-semibold ${
                mode === m ? "bg-[var(--card)] shadow-[var(--shadow-sm)]" : "text-[var(--foreground-muted)]"
              }`}
            >
              {m === "signin" ? "ورود" : "ثبت‌نام"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {isSignup && (
              <motion.div
                key="name"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <Field
                  icon={<User className="size-4" />}
                  label="نام"
                  value={name}
                  onChange={setName}
                  placeholder="نام و نام‌خانوادگی"
                  autoComplete="name"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <Field
            icon={<Mail className="size-4" />}
            label="ایمیل"
            type="email"
            inputMode="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
            dir="ltr"
          />

          <div>
            <Field
              icon={<Lock className="size-4" />}
              label="رمز عبور"
              type={show ? "text" : "password"}
              value={pwd}
              onChange={setPwd}
              placeholder="حداقل ۶ کاراکتر"
              autoComplete={isSignup ? "new-password" : "current-password"}
              trailing={
                <button type="button" onClick={() => setShow((v) => !v)}
                        className="size-8 grid place-items-center rounded-full text-[var(--foreground-muted)] tap press"
                        aria-label={show ? "پنهان کردن رمز" : "نمایش رمز"}>
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
            />
            {isSignup && pwd && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-[var(--background-muted)] overflow-hidden flex gap-[2px] p-[2px]">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={`flex-1 rounded-full transition-colors ${i < pwdMeter.score ? pwdMeter.tone : "bg-transparent"}`} />
                  ))}
                </div>
                <span className="text-[11px] text-[var(--foreground-muted)] tabular-nums w-12 text-left">{pwdMeter.label}</span>
              </div>
            )}
          </div>

          {!isSignup && (
            <button type="button" className="self-end text-[12px] text-[var(--brand-500)] tap press">
              فراموشی رمز عبور؟
            </button>
          )}

          {isSignup && (
            <label className="flex items-start gap-2.5 text-[12px] text-[var(--foreground-muted)] leading-relaxed">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-0.5 accent-[var(--brand-500)] size-4"
              />
              <span>
                <ShieldCheck className="inline size-3.5 text-emerald-500 ml-0.5" />
                با <a href="#" className="text-[var(--brand-500)] underline">قوانین</a> و
                <a href="#" className="text-[var(--brand-500)] underline mr-1">سیاست حریم خصوصی</a> کیان موافقم.
              </span>
            </label>
          )}

          {err && (
            <div className="text-[12px] text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 h-12 rounded-full text-white text-[14.5px] font-semibold tap press disabled:opacity-60 shadow-[0_10px_24px_-10px_rgba(237,28,36,0.6)]"
            style={{ background: "linear-gradient(160deg, #ED1C24 0%, #61070A 100%)" }}
          >
            {busy ? "در حال پردازش…" : isSignup ? "ساخت حساب" : "ورود"}
          </button>
        </form>

        {/* divider */}
        <div className="flex items-center gap-3 my-5 text-[11px] text-[var(--foreground-subtle)]">
          <div className="h-px flex-1 bg-[var(--border-subtle)]" />
          <span>یا ادامه با</span>
          <div className="h-px flex-1 bg-[var(--border-subtle)]" />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <SocialBtn icon={<Chrome className="size-4" />} label="گوگل" onClick={() => social("google")} />
          <SocialBtn icon={<Apple className="size-4" />} label="اپل"   onClick={() => social("apple")} />
        </div>

        <p className="mt-6 text-center text-[11.5px] text-[var(--foreground-subtle)] leading-relaxed">
          {isSignup ? "حساب داری؟ " : "هنوز حساب نداری؟ "}
          <button onClick={() => setMode(isSignup ? "signin" : "signup")} className="text-[var(--brand-500)] font-semibold tap press">
            {isSignup ? "وارد شو" : "همین حالا بساز"}
          </button>
        </p>
      </div>
    </div>
  );
}

/* ── Bits ─────────────────────────────────────────────────────── */

function Field(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  dir?: "ltr" | "rtl";
  trailing?: React.ReactNode;
}) {
  const { icon, label, value, onChange, placeholder, type = "text", inputMode, autoComplete, dir, trailing } = props;
  return (
    <label className="block">
      <span className="text-[11.5px] font-semibold text-[var(--foreground-muted)] mb-1.5 block">{label}</span>
      <span className="flex items-center gap-2 h-12 px-3 rounded-[14px] bg-[var(--background-muted)] border border-transparent focus-within:border-[var(--brand-500)] focus-within:bg-[var(--card)] transition-colors">
        <span className="text-[var(--foreground-subtle)]">{icon}</span>
        <input
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          dir={dir}
          className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-[var(--foreground-subtle)]"
        />
        {trailing}
      </span>
    </label>
  );
}

function SocialBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-11 rounded-full border border-[var(--border-strong)] bg-[var(--card)] inline-flex items-center justify-center gap-2 text-[13px] font-semibold tap press"
    >
      {icon}
      {label}
    </button>
  );
}
