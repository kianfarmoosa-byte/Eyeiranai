import { useEffect, useMemo, useState } from "react";
import { RefreshCw, RotateCcw, Trash2, AlertTriangle, Clock, CircleSlash, Loader2, Send } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { useHaptics } from "../hooks";
import { useToast } from "../primitives/Toast";
import { api, type RetryEntry } from "../../../api";
import { studioUserId, PLATFORM_META, notifyDeadPublishes } from "./studio";
import { toFa } from "../utils/fa";

type Props = { onClose: () => void };

function whenFa(ts: number): string {
  return new Date(ts).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" });
}

function untilFa(ts: number): string {
  const diff = ts - Date.now();
  if (diff <= 0) return "آمادهٔ تلاش در تیک بعدی";
  const m = Math.round(diff / 60000);
  if (m < 60) return `تلاش بعدی تا ${toFa(m)} دقیقه دیگر`;
  const h = Math.floor(m / 60);
  return `تلاش بعدی تا ${toFa(h)} ساعت دیگر`;
}

export function RetryQueueScreen({ onClose }: Props) {
  const haptic = useHaptics();
  const toast = useToast();
  const uid = studioUserId();
  const [items, setItems] = useState<RetryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState<string>("");
  const [, force] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const list = await api.studioGetRetries(uid);
      setItems(list);
      notifyDeadPublishes(list); // surface any permanently-failed publishes
    } catch (e) {
      console.log("load retries failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => force((x) => x + 1), 30000); return () => clearInterval(t); }, []);

  const pending = useMemo(() => items.filter((e) => e.status !== "dead"), [items]);
  const dead = useMemo(() => items.filter((e) => e.status === "dead"), [items]);

  const runAll = async () => {
    haptic("select");
    setRunning(true);
    try {
      const res = await api.studioRunRetries(uid);
      toast({
        kind: res.recovered > 0 ? "success" : "warn",
        message: res.recovered > 0 ? `${toFa(res.recovered)} انتشار موفق شد` : `تلاش شد · ${toFa(res.pending)} مورد هنوز ناموفق`,
      });
      await load();
    } catch (e: any) {
      console.log("run retries failed:", e);
      toast({ kind: "error", message: String(e?.message || e).slice(0, 120) });
    } finally {
      setRunning(false);
    }
  };

  const removeOne = async (id: string) => {
    haptic("heavy");
    setBusy(id);
    try {
      await api.studioDeleteRetry(uid, id);
      setItems((l) => l.filter((e) => e.id !== id));
    } catch (e) {
      console.log("delete retry failed:", e);
      toast({ kind: "error", message: "حذف ناموفق بود" });
    } finally {
      setBusy("");
    }
  };

  const clearDead = async () => {
    haptic("heavy");
    try {
      await api.studioClearRetries(uid, true);
      setItems((l) => l.filter((e) => e.status !== "dead"));
      toast({ kind: "success", message: "موارد ناموفق پاک شد" });
    } catch (e) {
      console.log("clear dead failed:", e);
    }
  };

  const empty = !loading && items.length === 0;

  const Row = ({ e }: { e: RetryEntry }) => {
    const meta = PLATFORM_META[e.platform];
    const isDead = e.status === "dead";
    const isBusy = busy === e.id;
    return (
      <li className={`rounded-[var(--radius-lg)] border px-3.5 py-3 ${isDead ? "border-rose-500/30 bg-rose-500/5" : "border-[var(--border-subtle)] bg-[var(--surface)]"}`}>
        <div className="flex items-start gap-3">
          <span className={`size-9 grid place-items-center rounded-xl shrink-0 ${isDead ? "bg-rose-500/12 text-rose-500" : "bg-amber-500/12 text-amber-600"}`}>
            {isDead ? <CircleSlash className="size-4" /> : <RotateCcw className="size-4" />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[13.5px] font-medium">
              <span>{meta?.emoji}</span>
              <span className="truncate">{e.payload.title || meta?.label || e.platform}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11.5px] flex-wrap">
              <span className={`px-1.5 py-0.5 rounded-full ${isDead ? "bg-rose-500/12 text-rose-500" : "bg-amber-500/12 text-amber-600"}`}>
                {isDead ? "ناموفق نهایی" : `تلاش ${toFa(e.attempts)} از ${toFa(e.maxAttempts)}`}
              </span>
              {!isDead && (
                <span className="inline-flex items-center gap-1 text-[var(--foreground-subtle)]">
                  <Clock className="size-3" />
                  {untilFa(e.nextAt)}
                </span>
              )}
            </div>
            {e.lastError && (
              <div className="mt-1.5 text-[11.5px] text-[var(--foreground-subtle)] line-clamp-2" dir="auto">
                خطا: {e.lastError}
              </div>
            )}
            <div className="mt-1 text-[11px] text-[var(--foreground-subtle)]">
              {e.source === "scheduled" ? "انتشار زمان‌بندی‌شده" : "انتشار خودکار"} · افزوده در {whenFa(e.createdAt)}
            </div>
          </div>
          <button onClick={() => removeOne(e.id)} disabled={isBusy} aria-label="حذف" className="size-9 grid place-items-center rounded-full tap press text-rose-500 active:bg-rose-500/10 disabled:opacity-50 shrink-0">
            {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </button>
        </div>
      </li>
    );
  };

  return (
    <MobileScreen
      topbar={<MobileTopBar title="صف تلاش مجدد" onBack={onClose} trailing={
        <button onClick={() => { haptic("tap"); load(); }} aria-label="بروزرسانی" className="size-10 grid place-items-center rounded-full tap press active:bg-[var(--accent)]">
          <RefreshCw className={`size-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      } />}
    >
      <div className="h-full overflow-y-auto scrollbar-none pb-28">
        <div className="px-4 pt-4 flex items-start gap-2 text-[12.5px] text-[var(--foreground-muted)] leading-relaxed">
          <RotateCcw className="size-4 text-[var(--brand-500)] shrink-0 mt-0.5" />
          <span>انتشارهای ناموفقِ خودکار و زمان‌بندی‌شده اینجا صف می‌شوند و در تیک‌های بعدی خودکار دوباره تلاش می‌شوند.</span>
        </div>

        {loading && items.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-[var(--foreground-subtle)]">در حال بارگذاری…</div>
        ) : empty ? (
          <div className="px-6 py-16 flex flex-col items-center text-center gap-3">
            <div className="size-14 rounded-2xl bg-[var(--background-muted)] grid place-items-center">
              <Send className="size-6 -scale-x-100 text-[var(--foreground-subtle)]" />
            </div>
            <div className="text-[14px] font-semibold">صف تلاش مجدد خالی است</div>
            <div className="text-[12.5px] text-[var(--foreground-subtle)] max-w-[260px]">
              همهٔ انتشارها موفق بوده‌اند. اگر انتشاری شکست بخورد، اینجا برای تلاش خودکار مجدد ظاهر می‌شود.
            </div>
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <>
                <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                  <span className="text-amber-600"><RotateCcw className="size-4" /></span>
                  <span className="text-[13px] font-semibold">در انتظار تلاش مجدد</span>
                  <span className="text-[11.5px] text-[var(--foreground-subtle)]">({toFa(pending.length)})</span>
                </div>
                <ul className="mx-3 space-y-2">
                  {pending.map((e) => <Row key={e.id} e={e} />)}
                </ul>
              </>
            )}

            {dead.length > 0 && (
              <>
                <div className="px-4 pt-5 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-rose-500"><AlertTriangle className="size-4" /></span>
                    <span className="text-[13px] font-semibold">ناموفق نهایی</span>
                    <span className="text-[11.5px] text-[var(--foreground-subtle)]">({toFa(dead.length)})</span>
                  </div>
                  <button onClick={clearDead} className="text-[12px] text-rose-500 font-medium tap press">پاک‌سازی</button>
                </div>
                <ul className="mx-3 space-y-2">
                  {dead.map((e) => <Row key={e.id} e={e} />)}
                </ul>
              </>
            )}
          </>
        )}
      </div>

      {pending.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 p-4 pb-[calc(16px+var(--safe-bottom))] bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent">
          <button
            onClick={runAll}
            disabled={running}
            className="w-full h-12 rounded-[var(--radius-lg)] bg-[var(--brand-500)] text-white text-[15px] font-semibold tap press flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {running ? <Loader2 className="size-5 animate-spin" /> : <RotateCcw className="size-5" />}
            {running ? "در حال تلاش…" : "تلاش مجدد همه همین حالا"}
          </button>
        </div>
      )}
    </MobileScreen>
  );
}
