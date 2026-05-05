import { X } from "lucide-react";

const SHORTCUTS: { key: string; desc: string }[] = [
  { key: "J", desc: "مقاله بعدی" },
  { key: "K", desc: "مقاله قبلی" },
  { key: "S", desc: "نشان‌گذاری ستاره" },
  { key: "M", desc: "تغییر وضعیت خوانده شده" },
  { key: "B", desc: "ذخیره / لغو ذخیره" },
  { key: "O", desc: "باز کردن مقاله اصلی" },
  { key: "R", desc: "بروزرسانی" },
  { key: "Esc", desc: "بستن مقاله" },
  { key: "/", desc: "تمرکز روی جستجو" },
  { key: "?", desc: "نمایش این راهنما" },
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3>میان‌برهای صفحه‌کلید</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1">
          {SHORTCUTS.map(s => (
            <div key={s.key} className="flex items-center justify-between py-2 px-3 rounded hover:bg-slate-50 dark:hover:bg-slate-800">
              <span className="text-sm">{s.desc}</span>
              <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono">{s.key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
