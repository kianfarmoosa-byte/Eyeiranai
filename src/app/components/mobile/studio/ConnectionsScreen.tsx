import { useEffect, useState } from "react";
import { Check, Link2, Send, Trash2, Loader2, CircleCheck } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { useHaptics } from "../hooks";
import { useToast } from "../primitives/Toast";
import { api, type ConnectionStatus, type PublishPlatform } from "../../../api";
import { studioUserId, INPUT_CLS, PLATFORM_META, PUBLISHABLE, CONNECT_HELP } from "./studio";

type Props = { onClose: () => void };

export function ConnectionsScreen({ onClose }: Props) {
  const uid = studioUserId();
  const [conns, setConns] = useState<Record<string, ConnectionStatus>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await api.studioGetConnections(uid);
        if (!cancelled) setConns(c);
      } catch (e) {
        console.log("load connections failed:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  return (
    <MobileScreen topbar={<MobileTopBar title="اتصال حساب‌ها" onBack={onClose} />}>
      <div className="h-full overflow-y-auto scrollbar-none pb-10">
        <div className="px-4 pt-4 flex items-center gap-2 text-[12.5px] text-[var(--foreground-subtle)]">
          <Link2 className="size-4 text-[var(--brand-500)]" />
          <span>حساب کانال‌هایت را وصل کن تا بتوانی پیش‌نویس‌ها را مستقیم منتشر کنی.</span>
        </div>

        {loading ? (
          <div className="px-4 py-10 text-center text-[13px] text-[var(--foreground-subtle)]">در حال بارگذاری…</div>
        ) : (
          <div className="px-3 mt-3 space-y-3">
            {PUBLISHABLE.map((p) => (
              <ConnectionCard
                key={p}
                platform={p}
                status={conns[p]}
                uid={uid}
                onChange={(next) => setConns(next)}
              />
            ))}
          </div>
        )}

        <div className="mx-4 mt-5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--background-muted)] px-3 py-2.5 text-[11.5px] text-[var(--foreground-subtle)] leading-relaxed">
توییتر و اینستاگرام نیازمند توکن API از پورتال توسعه‌دهندگان آن‌هاست (توییتر پلن پولی، اینستاگرام اکانت Business). توکن‌ها و رمزها فقط روی سرور ذخیره می‌شوند و هرگز در دستگاه نمایش داده نمی‌شوند.
        </div>
      </div>
    </MobileScreen>
  );
}

function ConnectionCard({ platform, status, uid, onChange }: {
  platform: PublishPlatform;
  status?: ConnectionStatus;
  uid: string;
  onChange: (next: Record<string, ConnectionStatus>) => void;
}) {
  const haptic = useHaptics();
  const toast = useToast();
  const meta = PLATFORM_META[platform];
  const connected = !!status?.connected;

  const isWebsite = platform === "website";
  const isTwitter = platform === "twitter";
  const isInstagram = platform === "instagram";
  const isBot = platform === "telegram" || platform === "bale" || platform === "rubika";

  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [igUserId, setIgUserId] = useState("");
  const [mode, setMode] = useState<"wordpress" | "webhook">("wordpress");
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const canConnect = isWebsite
    ? (mode === "webhook" ? url.trim().length > 0 : !!(url.trim() && username.trim() && appPassword.trim()))
    : isTwitter
    ? token.trim().length > 0
    : isInstagram
    ? !!(token.trim() && igUserId.trim())
    : !!(token.trim() && chatId.trim());

  const connect = async () => {
    if (!canConnect) return;
    haptic("select");
    setBusy(true);
    try {
      const payload = isWebsite
        ? { platform, mode, url: url.trim(), username: username.trim(), appPassword: appPassword.trim() }
        : isTwitter
        ? { platform, token: token.trim() }
        : isInstagram
        ? { platform, token: token.trim(), igUserId: igUserId.trim() }
        : { platform, token: token.trim(), chatId: chatId.trim() };
      const { connections, botName } = await api.studioSaveConnection(uid, payload);
      onChange(connections);
      setOpen(false);
      setToken(""); setAppPassword("");
      toast({ kind: "success", message: `متصل شد${botName ? `: ${botName}` : ""}` });
    } catch (e: any) {
      console.log("connect failed:", e);
      toast({ kind: "error", message: String(e?.message || e).slice(0, 140) });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    haptic("heavy");
    setBusy(true);
    try {
      const next = await api.studioDeleteConnection(uid, platform);
      onChange(next);
      toast({ kind: "success", message: "اتصال قطع شد" });
    } catch (e) {
      console.log("disconnect failed:", e);
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    haptic("select");
    setTesting(true);
    try {
      await api.studioTestConnection(uid, platform);
      toast({ kind: "success", message: "پیام آزمایشی ارسال شد" });
    } catch (e: any) {
      console.log("test failed:", e);
      toast({ kind: "error", message: String(e?.message || e).slice(0, 120) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] overflow-hidden">
      <div className="flex items-center gap-3 px-3.5 py-3">
        <span className="size-10 grid place-items-center rounded-full bg-[var(--background-muted)] text-lg">{meta.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold flex items-center gap-1.5">
            {meta.label}
            {connected && <CircleCheck className="size-4 text-emerald-500" />}
          </div>
          <div className="text-[11.5px] text-[var(--foreground-subtle)] truncate" dir={isWebsite ? "ltr" : undefined}>
            {connected
              ? (isWebsite
                  ? `${status?.mode === "webhook" ? "Webhook" : "WordPress"} · ${status?.url}`
                  : isBot
                  ? `${status?.chatId} · @${status?.botName}`
                  : `@${status?.botName}`)
              : "متصل نیست"}
          </div>
        </div>
        {connected ? (
          <button onClick={disconnect} disabled={busy} aria-label="قطع اتصال" className="size-9 grid place-items-center rounded-full tap press text-rose-500 active:bg-rose-500/10">
            <Trash2 className="size-4" />
          </button>
        ) : (
          <button
            onClick={() => { haptic("tap"); setOpen((o) => !o); }}
            className="h-9 px-3 rounded-full bg-[var(--brand-500)] text-white text-[12.5px] tap press"
          >
            اتصال
          </button>
        )}
      </div>

      {connected && (
        <div className="px-3.5 pb-3">
          <button
            onClick={test}
            disabled={testing}
            className="w-full h-10 rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-[13px] tap press flex items-center justify-center gap-2 active:bg-[var(--accent)] disabled:opacity-50"
          >
            {testing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 -scale-x-100" />}
            {testing ? "در حال ارسال…" : "ارسال پیام آزمایشی"}
          </button>
        </div>
      )}

      {open && !connected && (
        <div className="px-3.5 pb-3.5 border-t border-[var(--border-subtle)] pt-3 space-y-2.5">
          <p className="text-[11.5px] text-[var(--foreground-subtle)] leading-relaxed">{CONNECT_HELP[platform]}</p>

          {isWebsite ? (
            <>
              <div className="flex gap-2">
                {(["wordpress", "webhook"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => { haptic("tap"); setMode(m); }}
                    className={`flex-1 h-9 rounded-[var(--radius-md)] text-[12.5px] border tap press ${mode === m ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]" : "border-[var(--border-subtle)] text-[var(--foreground-muted)]"}`}
                  >
                    {m === "wordpress" ? "وردپرس" : "Webhook"}
                  </button>
                ))}
              </div>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={mode === "wordpress" ? "https://yoursite.com" : "https://your-endpoint.com/hook"} dir="ltr" className={INPUT_CLS} />
              {mode === "wordpress" && (
                <>
                  <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="نام کاربری وردپرس" dir="ltr" className={INPUT_CLS} />
                  <input value={appPassword} onChange={(e) => setAppPassword(e.target.value)} placeholder="Application Password" dir="ltr" className={INPUT_CLS} />
                </>
              )}
            </>
          ) : isTwitter ? (
            <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="OAuth2 Access Token" dir="ltr" className={INPUT_CLS} />
          ) : isInstagram ? (
            <>
              <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Access Token" dir="ltr" className={INPUT_CLS} />
              <input value={igUserId} onChange={(e) => setIgUserId(e.target.value)} placeholder="IG Business Account ID" dir="ltr" className={INPUT_CLS} />
            </>
          ) : (
            <>
              <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="توکن ربات" dir="ltr" className={INPUT_CLS} />
              <input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="@channel یا آیدی عددی" dir="ltr" className={INPUT_CLS} />
            </>
          )}

          <button
            onClick={connect}
            disabled={busy || !canConnect}
            className="w-full h-10 rounded-[var(--radius-md)] bg-[var(--brand-500)] text-white text-[13px] font-semibold tap press flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {busy ? "در حال بررسی…" : "اتصال و تأیید"}
          </button>
        </div>
      )}
    </div>
  );
}
