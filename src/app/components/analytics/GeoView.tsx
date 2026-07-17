import { useMemo } from "react";
import { MapPin, Globe2 } from "lucide-react";
import type { Article } from "../../data";
import { splitByPeriod, type Period } from "../../mediaAnalytics";
import { faNum } from "../mobile/utils/fa";

// ── Section ۳.۷ — تحلیل جغرافیایی و بین‌الملل (Geo View) ──
// پوشش رسانه‌ای به تفکیک استان‌های ایران (اکتشاف نام استان/مرکز استان در متن) و
// اشاره به بازتاب بین‌المللی از طریق ماژول GDELT پلتفرم. نقشهٔ تعاملی جهان در
// خود ماژول «اخبار بین‌الملل / GDELT» در دسترس است.

// استان → واژه‌های نشانگر (نام استان + مرکز استان)
const PROVINCES: { name: string; cues: string[] }[] = [
  { name: "تهران", cues: ["تهران"] },
  { name: "اصفهان", cues: ["اصفهان"] },
  { name: "خراسان رضوی", cues: ["مشهد", "خراسان رضوی"] },
  { name: "فارس", cues: ["شیراز", "فارس"] },
  { name: "آذربایجان شرقی", cues: ["تبریز", "آذربایجان شرقی"] },
  { name: "خوزستان", cues: ["اهواز", "خوزستان"] },
  { name: "البرز", cues: ["کرج", "البرز"] },
  { name: "گیلان", cues: ["رشت", "گیلان"] },
  { name: "مازندران", cues: ["ساری", "مازندران", "بابل", "آمل"] },
  { name: "کرمان", cues: ["کرمان"] },
  { name: "قم", cues: ["قم"] },
  { name: "یزد", cues: ["یزد"] },
  { name: "کرمانشاه", cues: ["کرمانشاه"] },
  { name: "همدان", cues: ["همدان"] },
  { name: "گلستان", cues: ["گرگان", "گلستان"] },
  { name: "هرمزگان", cues: ["بندرعباس", "هرمزگان"] },
  { name: "سیستان و بلوچستان", cues: ["زاهدان", "سیستان", "بلوچستان", "چابهار"] },
  { name: "آذربایجان غربی", cues: ["ارومیه", "آذربایجان غربی"] },
  { name: "کردستان", cues: ["سنندج", "کردستان"] },
  { name: "مرکزی", cues: ["اراک", "استان مرکزی"] },
];

export function GeoView({ articles, period, onOpenInternational }: { articles: Article[]; period: Period; onOpenInternational?: () => void }) {
  const rows = useMemo(() => {
    const { current } = splitByPeriod(articles, period);
    const counts = new Map<string, number>();
    for (const a of current) {
      const hay = `${a.title} ${a.preview || ""}`;
      for (const p of PROVINCES) {
        if (p.cues.some(c => hay.includes(c))) counts.set(p.name, (counts.get(p.name) || 0) + 1);
      }
    }
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [articles, period]);

  const max = rows.length ? rows[0].count : 1;
  const totalGeo = rows.reduce((s, r) => s + r.count, 0);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <MapPin className="w-4 h-4 text-rose-500" />
        <h3 className="text-sm">تحلیل جغرافیایی — استان‌های ایران</h3>
        <span className="text-xs text-slate-400">{faNum(totalGeo)} اشارهٔ مکانی</span>
        {onOpenInternational && (
          <>
            <div className="flex-1" />
            <button
              onClick={onOpenInternational}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              <Globe2 className="w-3.5 h-3.5" /> نقشهٔ جهانی (GDELT)
            </button>
          </>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="text-xs text-slate-400 py-6 text-center">اشارهٔ مکانی قابل‌تشخیصی در این بازه یافت نشد.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {rows.slice(0, 14).map(r => (
            <div key={r.name}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="truncate">{r.name}</span>
                <span className="tabular-nums opacity-70">{faNum(r.count)}</span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-l from-rose-500 to-orange-400 rounded-full" style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="text-[10px] text-slate-400 mt-3">
        پوشش استانی از اکتشاف نام استان/مرکز استان در تیتر و خلاصه استخراج می‌شود؛ بازتاب بین‌المللی و مقایسهٔ روایت داخلی/خارجی در ماژول GDELT در دسترس است.
      </div>
    </div>
  );
}
