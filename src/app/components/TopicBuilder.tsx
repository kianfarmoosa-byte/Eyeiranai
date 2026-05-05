import { useEffect, useMemo, useState } from "react";
import type { Article } from "../data";
import {
  type Topic, type TopicColor, TOPIC_COLORS, newCustomTopic,
  scoreArticleForTopic, topicColorClasses,
} from "../topics";
import { entitiesForArticle } from "../entities";
import { X, Plus, Trash2, Save } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  articles: Article[];
  onSave: (t: Topic) => void;
  onDelete?: (id: string) => void;
  initial?: Topic | null;
};

const ICON_CHOICES = ["🎯", "🏛️", "🛡️", "📈", "🗳️", "🌍", "⚔️", "💻", "⚽", "🔬", "🎨", "📚", "✈️", "🚗", "💊", "🏥", "🌱", "⚖️"];

export function TopicBuilder({ open, onClose, articles, onSave, onDelete, initial }: Props) {
  const [topic, setTopic] = useState<Topic>(() => initial ?? newCustomTopic());
  const [kwInput, setKwInput] = useState("");

  useEffect(() => {
    if (open) {
      setTopic(initial ?? newCustomTopic());
      setKwInput("");
    }
  }, [open, initial]);

  const entitySuggestions = useMemo(() => {
    if (!open) return [];
    const counts = new Map<string, number>();
    const cap = Math.min(articles.length, 60);
    for (let i = 0; i < cap; i++) {
      try {
        const ents = entitiesForArticle(articles[i]);
        for (const e of ents) {
          if (e.kind === "person" || e.kind === "place" || e.kind === "org") {
            counts.set(e.text, (counts.get(e.text) || 0) + e.count);
          }
        }
      } catch {}
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([text]) => text);
  }, [articles, open]);

  const previewCount = useMemo(() => {
    if (!open) return 0;
    if (!topic.keywords.length && !(topic.entities?.length || 0)) return 0;
    let n = 0;
    for (const a of articles) {
      const s = scoreArticleForTopic(a, topic);
      if (s.level !== "none") n++;
    }
    return n;
  }, [articles, topic, open]);

  if (!open) return null;
  const cls = topicColorClasses(topic.color);

  const addKw = () => {
    const k = kwInput.trim();
    if (!k) return;
    if (!topic.keywords.includes(k)) setTopic({ ...topic, keywords: [...topic.keywords, k] });
    setKwInput("");
  };
  const removeKw = (k: string) => setTopic({ ...topic, keywords: topic.keywords.filter(x => x !== k) });
  const toggleEnt = (e: string) => {
    const ents = topic.entities || [];
    setTopic({ ...topic, entities: ents.includes(e) ? ents.filter(x => x !== e) : [...ents, e] });
  };

  const save = () => {
    if (!topic.name.trim()) return;
    onSave({ ...topic, name: topic.name.trim(), custom: true });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cls.chip}`}>
            <span className="text-xl">{topic.icon}</span>
          </div>
          <div className="flex-1">
            <input
              value={topic.name}
              onChange={(e) => setTopic({ ...topic, name: e.target.value })}
              className="w-full bg-transparent outline-none text-lg font-medium"
              placeholder="نام موضوع..."
              autoFocus
            />
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <div className="text-xs text-slate-500 mb-2">آیکون</div>
            <div className="flex flex-wrap gap-1.5">
              {ICON_CHOICES.map(ic => (
                <button key={ic}
                  onClick={() => setTopic({ ...topic, icon: ic })}
                  className={`w-8 h-8 rounded-md text-lg flex items-center justify-center transition ${topic.icon === ic ? "bg-slate-200 dark:bg-slate-700 ring-2 ring-slate-400" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                >{ic}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-2">رنگ</div>
            <div className="flex flex-wrap gap-2">
              {TOPIC_COLORS.map(c => {
                const cc = topicColorClasses(c);
                return (
                  <button key={c}
                    onClick={() => setTopic({ ...topic, color: c as TopicColor })}
                    className={`w-7 h-7 rounded-full ${cc.bar} ${topic.color === c ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-slate-400" : ""}`}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-2">کلیدواژه‌ها (Enter برای افزودن)</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {topic.keywords.map(k => (
                <span key={k} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${cls.chip}`}>
                  {k}
                  <button onClick={() => removeKw(k)} className="hover:opacity-70"><X className="w-3 h-3" /></button>
                </span>
              ))}
              {!topic.keywords.length && (
                <span className="text-xs text-slate-400">مثال: تورم، دلار، بانک مرکزی</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={kwInput}
                onChange={(e) => setKwInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKw(); } }}
                placeholder="کلیدواژه..."
                className="flex-1 px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 rounded-md outline-none focus:ring-2 focus:ring-slate-400"
              />
              <button onClick={addKw} className="px-3 py-1.5 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 rounded-md text-sm flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> افزودن
              </button>
            </div>
          </div>

          {entitySuggestions.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 mb-2">پیشنهاد موجودیت‌ها (از NER)</div>
              <div className="flex flex-wrap gap-1.5">
                {entitySuggestions.map(e => {
                  const sel = (topic.entities || []).includes(e);
                  return (
                    <button key={e}
                      onClick={() => toggleEnt(e)}
                      className={`px-2 py-0.5 rounded-full text-xs border transition ${sel ? `${cls.chip} border-transparent` : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"}`}
                    >{sel ? "✓ " : ""}{e}</button>
                  );
                })}
              </div>
            </div>
          )}

          <div className={`rounded-lg border-2 border-dashed p-3 ${previewCount > 0 ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-slate-200 dark:border-slate-800"}`}>
            <div className="text-sm">
              <span className="font-medium tabular-nums">{previewCount}</span> از {articles.length} خبر با این موضوع منطبق می‌شود
            </div>
            {previewCount === 0 && (topic.keywords.length || (topic.entities?.length || 0)) > 0 && (
              <div className="text-xs text-slate-500 mt-1">هیچ خبری منطبق نیست — کلیدواژه‌ها را بازبینی کنید.</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-200 dark:border-slate-800">
          {initial && onDelete && (
            <button onClick={() => { onDelete(initial.id); onClose(); }}
              className="px-3 py-1.5 text-sm rounded-md text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> حذف
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">انصراف</button>
          <button
            onClick={save}
            disabled={!topic.name.trim() || (!topic.keywords.length && !(topic.entities?.length || 0))}
            className="px-3 py-1.5 text-sm rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50 flex items-center gap-1"
          >
            <Save className="w-3.5 h-3.5" /> ذخیره
          </button>
        </div>
      </div>
    </div>
  );
}
