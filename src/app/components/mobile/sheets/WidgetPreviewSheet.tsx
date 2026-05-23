import { useMemo } from "react";
import { Lock, Target, Newspaper } from "lucide-react";
import { BottomSheet } from "../primitives/BottomSheet";
import { faNum, timeAgoFa } from "../utils/fa";
import { todayCount, loadGoal } from "../utils/goal";
import type { Article } from "../../../data";

type Props = {
  open: boolean;
  onClose: () => void;
  articles: Article[];
};

/**
 * Preview of how Kian widgets would look on the device lock screen. Three
 * sizes (small / medium / large) rendered inside a phone-shaped frame with a
 * blurred wallpaper, clock, and the chosen widget(s). Pure preview — no
 * actual OS integration is possible from a PWA.
 */
export function WidgetPreviewSheet({ open, onClose, articles }: Props) {
  const top = useMemo(() => {
    return [...articles]
      .filter((a) => a.dateMs)
      .sort((a, b) => (b.dateMs ?? 0) - (a.dateMs ?? 0))
      .slice(0, 3);
  }, [articles]);

  const goal = loadGoal();
  const today = todayCount();
  const pct = Math.min(1, goal > 0 ? today / goal : 0);
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");

  return (
    <BottomSheet open={open} onClose={onClose} title="پیش‌نمایش ویجت‌ها" snap="full">
      <div className="px-4 pb-6">
        <p className="text-[12px] text-[var(--foreground-muted)] mb-3 leading-relaxed">
          این پیش‌نمایشی از ظاهر ویجت‌های کیان روی صفحهٔ قفل گوشی است. برای فعال‌سازی واقعی روی iOS باید
          از منوی ویجت‌ها در صفحهٔ قفل کیان را اضافه کنی.
        </p>

        {/* Phone frame */}
        <div className="mx-auto" style={{ maxWidth: 320 }}>
          <div
            className="relative rounded-[44px] border-[10px] border-black bg-black overflow-hidden shadow-xl"
            style={{ aspectRatio: "9 / 19.5" }}
          >
            {/* Wallpaper */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-900 to-black" />
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 30% 20%, rgba(59,130,246,0.6), transparent 50%), radial-gradient(circle at 80% 80%, rgba(14,165,233,0.5), transparent 55%)",
              }}
            />

            {/* Notch */}
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-24 h-6 rounded-full bg-black" />

            {/* Status time (lock-screen big clock) */}
            <div className="relative pt-12 text-center text-white" dir="ltr">
              <div className="text-[12px] opacity-80">
                {now.toLocaleDateString("fa-IR", { weekday: "long", day: "numeric", month: "long" })}
              </div>
              <div className="text-[56px] font-extralight tracking-tight leading-none mt-1 tabular-nums">
                {hh}:{mm}
              </div>
            </div>

            {/* Lock icon */}
            <div className="relative mt-2 grid place-items-center">
              <Lock className="size-3 text-white/70" />
            </div>

            {/* Widgets stack */}
            <div className="relative mt-5 px-3 space-y-2.5">
              {/* Medium widget — top headline */}
              {top[0] && (
                <div className="rounded-[18px] bg-white/15 backdrop-blur-xl border border-white/15 p-2.5 text-white shadow-lg">
                  <div className="flex items-center gap-1.5 text-[9px] font-semibold opacity-80 uppercase tracking-wide">
                    <Newspaper className="size-2.5" /> کیان · تیتر داغ
                  </div>
                  <div className="mt-1 text-[11px] font-bold leading-snug line-clamp-3" dir="rtl">
                    {top[0].title}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[8.5px] opacity-70">
                    <span dir="rtl">{top[0].source}</span>
                    <span dir="rtl">{top[0].dateMs ? timeAgoFa(top[0].dateMs) : top[0].date}</span>
                  </div>
                </div>
              )}

              {/* Pair of small widgets */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Goal widget */}
                <div className="rounded-[18px] bg-white/15 backdrop-blur-xl border border-white/15 p-2.5 text-white shadow-lg">
                  <div className="flex items-center gap-1 text-[9px] font-semibold opacity-80">
                    <Target className="size-2.5" /> هدف مطالعه
                  </div>
                  <div className="mt-1 text-[20px] font-black tabular-nums leading-none" dir="rtl">
                    {faNum(today)}<span className="opacity-60 text-[12px]">/{faNum(goal)}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/20 overflow-hidden">
                    <div className="h-full bg-white" style={{ width: `${pct * 100}%` }} />
                  </div>
                </div>

                {/* Mini headline */}
                {top[1] && (
                  <div className="rounded-[18px] bg-white/15 backdrop-blur-xl border border-white/15 p-2.5 text-white shadow-lg">
                    <div className="text-[9px] font-semibold opacity-80">خبر دوم</div>
                    <div className="mt-1 text-[10px] font-bold leading-snug line-clamp-4" dir="rtl">
                      {top[1].title}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Home indicator */}
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-24 h-1 rounded-full bg-white/70" />
          </div>
        </div>

        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--background-muted)] p-3 text-[11.5px] text-[var(--foreground-muted)] leading-relaxed">
          راهنمای فعال‌سازی:
          <ol className="mt-1.5 list-decimal pr-4 space-y-0.5">
            <li>روی صفحهٔ قفل، با لمس و نگه‌داشتن وارد ویرایش شو.</li>
            <li>دکمهٔ «افزودن ویجت» را بزن.</li>
            <li>اپ «کیان» را جستجو و ویجت مورد نظر را اضافه کن.</li>
          </ol>
        </div>
      </div>
    </BottomSheet>
  );
}
