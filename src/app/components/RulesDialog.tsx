import { useEffect, useState } from "react";
import { X, Plus, Trash2, Loader2, Tag as TagIcon } from "lucide-react";
import { api, TagRule } from "../api";

type Props = { open: boolean; onClose: () => void; onDone: () => void };

const FIELDS: { id: "title" | "preview" | "content" | "source"; label: string }[] = [
  { id: "title", label: "عنوان" },
  { id: "preview", label: "پیش‌نمایش" },
  { id: "content", label: "متن کامل" },
  { id: "source", label: "منبع" },
];

export function RulesDialog({ open, onClose, onDone }: Props) {
  const [rules, setRules] = useState<TagRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<{ name: string; tag: string; keywords: string; fields: Set<string> }>({
    name: "", tag: "", keywords: "", fields: new Set(["title", "preview", "content"]),
  });

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.listRules().then(setRules).catch(() => {}).finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const addRule = async () => {
    const keywords = draft.keywords.split(/[,،\n]/).map(s => s.trim()).filter(Boolean);
    if (!draft.tag || !keywords.length) return;
    setLoading(true);
    try {
      const next = await api.saveRule({
        name: draft.name || draft.tag,
        tag: draft.tag,
        keywords,
        fields: Array.from(draft.fields) as any,
        enabled: true,
      });
      setRules(next);
      setDraft({ name: "", tag: "", keywords: "", fields: new Set(["title", "preview", "content"]) });
      onDone();
    } finally { setLoading(false); }
  };

  const toggleRule = async (r: TagRule) => {
    const next = await api.saveRule({ ...r, enabled: !r.enabled });
    setRules(next);
    onDone();
  };

  const removeRule = async (id: string) => {
    await api.deleteRule(id);
    setRules(rules.filter(r => r.id !== id));
    onDone();
  };

  const toggleField = (f: string) => {
    const next = new Set(draft.fields);
    next.has(f) ? next.delete(f) : next.add(f);
    setDraft({ ...draft, fields: next });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="flex items-center gap-2"><TagIcon className="w-4 h-4" /> قوانین برچسب‌گذاری خودکار</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
            <div className="text-sm text-slate-600 dark:text-slate-400">افزودن قانون جدید</div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={draft.name}
                onChange={e => setDraft({ ...draft, name: e.target.value })}
                placeholder="نام قانون (اختیاری)"
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-3 py-2 text-sm"
              />
              <input
                value={draft.tag}
                onChange={e => setDraft({ ...draft, tag: e.target.value })}
                placeholder="برچسبی که اعمال شود (مثل: هوش‌مصنوعی)"
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-3 py-2 text-sm"
              />
            </div>
            <textarea
              value={draft.keywords}
              onChange={e => setDraft({ ...draft, keywords: e.target.value })}
              placeholder="کلیدواژه‌ها (با ویرگول یا خط جدید جدا کنید) — مثل: OpenAI, کلود, GPT, هوش مصنوعی"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-3 py-2 text-sm min-h-[72px]"
            />
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-slate-500 py-1">جستجو در:</span>
              {FIELDS.map(f => (
                <button
                  key={f.id}
                  onClick={() => toggleField(f.id)}
                  className={`text-xs px-2.5 py-1 rounded-full border ${draft.fields.has(f.id) ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-400 text-emerald-700 dark:text-emerald-300' : 'border-slate-300 dark:border-slate-700 text-slate-500'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              onClick={addRule}
              disabled={loading || !draft.tag || !draft.keywords.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              افزودن قانون
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-slate-600 dark:text-slate-400">قوانین فعلی ({rules.length})</div>
            {rules.length === 0 && (
              <div className="text-sm text-slate-500 p-4 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                هنوز قانونی تعریف نشده
              </div>
            )}
            {rules.map(r => (
              <div key={r.id} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={() => toggleRule(r)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{r.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full">#{r.tag}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    {r.keywords.join("، ")}
                  </div>
                </div>
                <button onClick={() => removeRule(r.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="text-xs text-slate-500">
            قوانین هنگام دریافت مقالات به‌صورت خودکار اعمال می‌شوند. برچسب‌های دستی حذف نمی‌شوند.
          </div>
        </div>
      </div>
    </div>
  );
}
