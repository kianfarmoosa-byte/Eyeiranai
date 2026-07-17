import { useEffect, useMemo, useState } from "react";
import { Activity, Send, Zap, CheckCircle2, XCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { useHaptics } from "../hooks";
import { api, type AutoLogEntry, type PubLogEntry } from "../../../api";
import { studioUserId, PLATFORM_META } from "./studio";
import { timeAgoFa, toFa } from "../utils/fa";

type Props = { onClose: () => void };

type Item =
  | { kind: "publish"; ts: number; entry: PubLogEntry }
  | { kind: "auto"; ts: number; entry: AutoLogEntry };

export function ActivityScreen({ onClose }: Props) {
  const haptic = useHaptics();
  const uid = studioUserId();
  const [pub, setPub] = useState<PubLogEntry[]>([]);
  const [auto, setAuto] = useState<AutoLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<"all" | "publish" | "auto">("all");
  const [onlyFailed, setOnlyFailed] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([api.studioGetPubLog(uid), api.studioGetAutoLog(uid)]);
      setPub(p);
      setAuto(a);
    } catch (e) {
      console.log("load activity failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo<Item[]>(() => {
    const merged: Item[] = [
      ...pub.map((e) => ({ kind: "publish" as const, ts: e.ts, entry: e })),
      ...auto.map((e) => ({ kind: "auto" as const, ts: e.ts, entry: e })),
    ];
    return merged.sort((a, b) => b.ts - a.ts).slice(0, 120);
  }, [pub, auto]);

  const isFailed = (it: Item) =>
    it.kind === "publish"
      ? !it.entry.ok
      : (it.entry.published || []).some((p) => !p.ok);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (kindFilter !== "all" && it.kind !== kindFilter) return false;
      if (onlyFailed && !isFailed(it)) return false;
      return true;
    });
  }, [items, kindFilter, onlyFailed]);

  const failedCount = useMemo(() => items.filter(isFailed).length, [items]);

  const platLabel = (p: string) => PLATFORM_META[p as keyof typeof PLATFORM_META]?.label || p;

  const chip = (active: boolean) =>
    `h-8 px-3 rounded-full text-[12.5px] font-medium tap press whitespace-nowrap border transition-colors ${
      active
        ? "bg-[var(--brand-600)] text-white border-transparent"
        : "bg-[var(--surface)] text-[var(--foreground-muted)] border-[var(--border-subtle)]"
    }`;

  return (
    <MobileScreen
      topbar={<MobileTopBar title="فعالیت و انتشارها" onBack={onClose} trailing={
        <button onClick={() => { haptic("tap"); load(); }} aria-label="بروزرسانی" className="size-10 grid place-items-center rounded-full tap press active:bg-[var(--accent)]">
          <RefreshCw className={`size-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      } />}
    >
      <div className="h-full overflow-y-auto scrollbar-none pb-10">
        {items.length > 0 && (
          <div className="mt-3 mx-3 flex items-center gap-2 overflow-x-auto scrollbar-none">
            <button onClick={() => { haptic("tap"); setKindFilter("all"); }} className={chip(kindFilter === "all")}>همه</button>
            <button onClick={() => { haptic("tap"); setKindFilter("publish"); }} className={chip(kindFilter === "publish")}>انتشار دستی</button>
            <button onClick={() => { haptic("tap"); setKindFilter("auto"); }} className={chip(kindFilter === "auto")}>اتوماسیون</button>
            <span className="w-px h-5 bg-[var(--border-subtle)] shrink-0" />
            <button
              onClick={() => { haptic("tap"); setOnlyFailed((v) => !v); }}
              className={`${chip(onlyFailed)} inline-flex items-center gap-1`}
            >
              <AlertTriangle className="size-3.5" />
              فقط ناموفق{failedCount > 0 ? ` (${toFa(failedCount)})` : ""}
            </button>
          </div>
        )}
        {loading && items.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-[var(--foreground-subtle)]">در حال بارگذاری…</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center text-center gap-3">
            <div className="size-14 rounded-2xl bg-[var(--background-muted)] grid place-items-center">
              <Activity className="size-6 text-[var(--foreground-subtle)]" />
            </div>
            <div className="text-[14px] font-semibold">هنوز فعالیتی ثبت نشده</div>
            <div className="text-[12.5px] text-[var(--foreground-subtle)] max-w-[260px]">
              وقتی محتوایی منتشر کنی یا قانون اتوماسیون اجرا شود، اینجا نمایش داده می‌شود.
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center text-center gap-2">
            <div className="text-[13.5px] font-medium">موردی با این فیلتر یافت نشد</div>
            <button
              onClick={() => { haptic("tap"); setKindFilter("all"); setOnlyFailed(false); }}
              className="text-[12.5px] text-[var(--brand-600)] font-medium tap press"
            >
              پاک کردن فیلترها
            </button>
          </div>
        ) : (
          <ul className="mt-3 mx-3 space-y-2">
            {filtered.map((it, i) => (
              <li key={i} className="rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] px-3.5 py-3">
                {it.kind === "publish" ? (
                  <div className="flex items-center gap-3">
                    <span className={`size-8 grid place-items-center rounded-full ${it.entry.ok ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                      <Send className="size-4 -scale-x-100" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-medium">انتشار دستی در {platLabel(it.entry.platform)}</div>
                      <div className="text-[11px] text-[var(--foreground-subtle)] mt-0.5">{timeAgoFa(it.ts)}</div>
                    </div>
                    {it.entry.ok ? <CheckCircle2 className="size-4 text-emerald-500" /> : <XCircle className="size-4 text-rose-500" />}
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <span className="size-8 grid place-items-center rounded-full bg-[var(--brand-500)]/10 text-[var(--brand-500)]">
                      <Zap className="size-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-medium truncate">{it.entry.ruleName}</div>
                      <div className="text-[12px] text-[var(--foreground-muted)] line-clamp-1 mt-0.5">{it.entry.itemTitle}</div>
                      <div className="text-[11px] text-[var(--foreground-subtle)] mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>{timeAgoFa(it.ts)}</span>
                        {it.entry.published?.length > 0 && <span>·</span>}
                        {it.entry.published?.map((p, j) => (
                          <span key={j} className={`inline-flex items-center gap-0.5 ${p.ok ? "text-emerald-500" : "text-rose-500"}`}>
                            {p.ok ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                            {platLabel(p.platform)}
                          </span>
                        ))}
                        {(!it.entry.published || it.entry.published.length === 0) && <span className="text-[var(--foreground-subtle)]">فقط پیش‌نویس</span>}
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </MobileScreen>
  );
}
