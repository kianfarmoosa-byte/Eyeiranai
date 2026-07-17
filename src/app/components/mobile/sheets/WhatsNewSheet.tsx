import { Sparkles, Clock, Languages, Target, LayoutGrid, Folder, ArrowLeftRight } from "lucide-react";
import { BottomSheet } from "../primitives/BottomSheet";

type Props = {
  open: boolean;
  onClose: () => void;
};

const KEY = "kian.mobile.whatsNew.v1";

export function hasSeenWhatsNew(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return true; }
}
export function markWhatsNewSeen() {
  try { localStorage.setItem(KEY, "1"); } catch {}
}

type Feat = { icon: React.ReactNode; title: string; desc: string; tone: string };

const FEATURES: Feat[] = [
  {
    icon: <Clock className="size-5" />,
    title: "خط زمانی رویداد",
    desc: "از هر خبر، خط زمانی خودکار از منابع و گزارش‌های مرتبط را ببین.",
    tone: "from-emerald-500 to-emerald-600",
  },
  {
    icon: <Languages className="size-5" />,
    title: "ترجمهٔ پیش‌نمایش",
    desc: "متن مقاله را با یک ضربه به پیش‌نمایش انگلیسی برگردان.",
    tone: "from-emerald-500 to-teal-600",
  },
  {
    icon: <Target className="size-5" />,
    title: "هدف روزانه و استریک",
    desc: "هدف مطالعهٔ روزانه تعیین کن و روزهای پشت‌سرهم را دنبال کن.",
    tone: "from-amber-500 to-orange-600",
  },
  {
    icon: <Folder className="size-5" />,
    title: "مجموعه‌های ذخیره‌شده",
    desc: "ذخیره‌شده‌ها را در پوشه‌های دلخواه دسته‌بندی کن.",
    tone: "from-fuchsia-500 to-purple-600",
  },
  {
    icon: <ArrowLeftRight className="size-5" />,
    title: "خبر قبلی / بعدی",
    desc: "در انتهای هر مقاله، با یک ضربه به خبر بعدی یا قبلی برو.",
    tone: "from-rose-500 to-red-600",
  },
  {
    icon: <LayoutGrid className="size-5" />,
    title: "پیش‌نمایش ویجت قفل",
    desc: "از تنظیمات، ظاهر ویجت flow روی صفحهٔ قفل را ببین.",
    tone: "from-emerald-500 to-violet-600",
  },
];

export function WhatsNewSheet({ open, onClose }: Props) {
  const done = () => { markWhatsNewSeen(); onClose(); };

  return (
    <BottomSheet open={open} onClose={done} title="چی تازه است؟" snap="full">
      <div className="px-4 pb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="size-10 grid place-items-center rounded-full bg-gradient-to-br from-[var(--brand-500)] to-[var(--brand-700)] text-white">
            <Sparkles className="size-5" />
          </span>
          <div>
            <div className="text-[15px] font-bold leading-tight">قابلیت‌های جدید flow</div>
            <div className="text-[11.5px] text-[var(--foreground-muted)] leading-tight">شش ابزار تازه برای خواندنِ هوشمندتر</div>
          </div>
        </div>

        <ul className="space-y-2.5">
          {FEATURES.map((f) => (
            <li
              key={f.title}
              className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-[var(--card)] border border-[var(--border-subtle)] p-3"
            >
              <span className={`size-10 shrink-0 grid place-items-center rounded-[var(--radius-md)] bg-gradient-to-br ${f.tone} text-white shadow-sm`}>
                {f.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold leading-snug">{f.title}</div>
                <div className="mt-0.5 text-[11.5px] text-[var(--foreground-muted)] leading-relaxed">{f.desc}</div>
              </div>
            </li>
          ))}
        </ul>

        <button
          onClick={done}
          className="mt-5 w-full h-12 rounded-full bg-[var(--brand-500)] text-white text-[14px] font-bold tap press active:bg-[var(--brand-600)]"
        >
          فهمیدم، شروع کنیم
        </button>
      </div>
    </BottomSheet>
  );
}
