import { useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2, Link as LinkIcon, FileText, Search, Paperclip, Unlink, Download } from "lucide-react";
import {
  loadNotes, newNote, updateNote, removeNote, backlinks, noteByTitle,
  linkArticle, unlinkArticle, backlinkCounts, exportMarkdown,
  type Note,
} from "../notes";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenArticle: (id: string) => void;
  currentArticle?: { id: string; title: string } | null;
  initialNoteId?: string | null;
};

export function Notes({ open, onClose, onOpenArticle, currentArticle, initialNoteId }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const refresh = () => setNotes(loadNotes().sort((a, b) => b.updatedAt - a.updatedAt));
  useEffect(() => { if (open) refresh(); }, [open]);
  useEffect(() => { if (open && initialNoteId) setActiveId(initialNoteId); }, [open, initialNoteId]);

  const active = useMemo(() => notes.find(n => n.id === activeId) || null, [notes, activeId]);
  const filtered = useMemo(() => {
    if (!q.trim()) return notes;
    const needle = q.toLowerCase();
    return notes.filter(n => (n.title + " " + n.body).toLowerCase().includes(needle));
  }, [notes, q]);

  const links = useMemo(() => active?.links || [], [active]);
  const back = useMemo(() => active ? backlinks(active.title) : [], [active, notes]);
  const counts = useMemo(() => backlinkCounts(), [notes]);
  const isAttached = !!(currentArticle && active && active.articleIds.includes(currentArticle.id));

  const attach = () => {
    if (!active || !currentArticle) return;
    if (isAttached) unlinkArticle(active.id, currentArticle.id);
    else linkArticle(active.id, currentArticle.id);
    refresh();
  };

  const exportMd = () => {
    const md = exportMarkdown();
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kian-notes-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const create = () => {
    const n = newNote();
    refresh();
    setActiveId(n.id);
  };

  const patch = (p: Partial<Note>) => {
    if (!active) return;
    updateNote(active.id, p);
    refresh();
  };

  const del = () => {
    if (!active) return;
    if (!confirm("یادداشت حذف شود؟")) return;
    removeNote(active.id);
    setActiveId(null);
    refresh();
  };

  const openLink = (title: string) => {
    const target = noteByTitle(title);
    if (target) setActiveId(target.id);
    else {
      const n = newNote(title);
      refresh();
      setActiveId(n.id);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-stretch md:items-center md:justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-5xl md:max-h-[90vh] bg-white dark:bg-slate-950 md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="font-semibold text-lg">یادداشت‌ها — با backlink</h2>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={exportMd} title="خروجی Markdown" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Download className="w-4 h-4" /></button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
          </div>
        </header>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[260px_1fr]">
          <aside className="border-l border-slate-200 dark:border-slate-800 flex flex-col min-h-0">
            <div className="p-2 flex gap-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جست‌وجو…"
                  className="w-full pr-7 pl-2 py-1.5 rounded-md bg-slate-100 dark:bg-slate-900 text-sm outline-none" />
              </div>
              <button onClick={create} className="p-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-500">یادداشتی نیست.</div>
              ) : filtered.map(n => (
                <button key={n.id} onClick={() => setActiveId(n.id)}
                  className={`w-full text-right px-3 py-2 border-b border-slate-100 dark:border-slate-900 ${activeId === n.id ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`}>
                  <div className="flex items-center gap-1.5">
                    <div className="text-sm font-medium truncate flex-1">{n.title || "بدون عنوان"}</div>
                    {counts[n.id] > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shrink-0" title={`${counts[n.id]} ارجاع`}>
                        ← {counts[n.id]}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{n.body.slice(0, 60) || "—"}</div>
                </button>
              ))}
            </div>
          </aside>

          <main className="flex flex-col min-h-0">
            {!active ? (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-500">یادداشتی انتخاب کنید یا یکی بسازید.</div>
            ) : (
              <>
                <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex gap-2 shrink-0">
                  <input value={active.title} onChange={(e) => patch({ title: e.target.value })}
                    className="flex-1 px-2 py-1.5 rounded-md bg-slate-100 dark:bg-slate-900 text-sm outline-none" placeholder="عنوان" />
                  {currentArticle && (
                    <button onClick={attach}
                      title={isAttached ? `جدا کردن از: ${currentArticle.title}` : `پیوست به: ${currentArticle.title}`}
                      className={`px-2 py-1.5 rounded-md text-xs flex items-center gap-1 ${isAttached ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" : "bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800"}`}>
                      {isAttached ? <Unlink className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}
                      <span className="hidden md:inline">{isAttached ? "پیوست شد" : "پیوست به مقاله"}</span>
                    </button>
                  )}
                  <button onClick={del} className="p-1.5 rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <textarea value={active.body} onChange={(e) => patch({ body: e.target.value })}
                  placeholder="بنویسید… برای ارجاع به یادداشت دیگر از [[عنوان]] استفاده کنید."
                  className="flex-1 p-4 bg-transparent outline-none resize-none text-sm leading-7" dir="auto" />

                <div className="border-t border-slate-200 dark:border-slate-800 p-3 grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0 max-h-56 overflow-y-auto">
                  <Section title="پیوندها">
                    {links.length === 0 ? <Hint /> : links.map(l => (
                      <button key={l} onClick={() => openLink(l)} className="block w-full text-right text-xs px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-900 text-blue-600">
                        <LinkIcon className="w-3 h-3 inline ms-1" />[[{l}]]
                      </button>
                    ))}
                  </Section>
                  <Section title="ارجاعات (Backlinks)">
                    {back.length === 0 ? <Hint text="کسی به این یادداشت لینک نداده." /> : back.map(b => (
                      <button key={b.from.id} onClick={() => setActiveId(b.from.id)} className="block w-full text-right text-xs px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-900">
                        ← {b.from.title} <span className="text-slate-400">×{b.matches}</span>
                      </button>
                    ))}
                  </Section>
                  <Section title="مقالات لینک‌شده">
                    {active.articleIds.length === 0 ? <Hint text="مقاله‌ای متصل نیست." /> : active.articleIds.map(id => (
                      <button key={id} onClick={() => onOpenArticle(id)} className="block w-full text-right text-xs px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-900 truncate">
                        📄 {id}
                      </button>
                    ))}
                  </Section>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-slate-500 mb-1">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Hint({ text = "—" }: { text?: string }) {
  return <div className="text-[11px] text-slate-400 px-2">{text}</div>;
}
