import { motion, AnimatePresence } from "motion/react";
import { Copy, Highlighter, NotebookPen, Languages, Sparkles, X } from "lucide-react";
import type { Article } from "../../../data";
import { useHaptics } from "../hooks";
import { useToast } from "../primitives/Toast";
import { newNote, appendHighlight, getLastNoteId, setLastNoteId } from "../../../notes";
import { addHighlight } from "../utils/highlights";

type Props = {
  open: boolean;
  text: string;
  article: Article;
  onClose: () => void;
  onAskAI: (q: string) => void;
  onHighlightSaved?: () => void;
};

export function HighlightBar({ open, text, article, onClose, onAskAI, onHighlightSaved }: Props) {
  const haptic = useHaptics();
  const toast = useToast();

  const saveHighlight = () => {
    haptic("success");
    let noteId = getLastNoteId();
    if (!noteId) {
      const n = newNote(`هایلایت‌های ${article.source}`);
      noteId = n.id;
      setLastNoteId(n.id);
    }
    appendHighlight(noteId, text, article.title, article.id);
    addHighlight(article.id, text);
    onHighlightSaved?.();
    toast({ kind: "success", title: "هایلایت ذخیره شد" });
    onClose();
  };

  const copy = async () => {
    haptic("select");
    try { await navigator.clipboard.writeText(text); toast({ kind: "info", title: "کپی شد" }); }
    catch { toast({ kind: "warning", title: "کپی ممکن نشد" }); }
    onClose();
  };

  const newNoteFromHighlight = () => {
    haptic("success");
    const n = newNote(text.slice(0, 60));
    setLastNoteId(n.id);
    appendHighlight(n.id, text, article.title, article.id);
    toast({ kind: "success", title: "یادداشت تازه ساخته شد" });
    onClose();
  };

  const translate = () => {
    haptic("select");
    toast({ kind: "info", title: "ترجمه به‌زودی فعال می‌شود" });
  };

  const askAI = () => {
    haptic("select");
    onAskAI(`دربارهٔ این بخش بیشتر توضیح بده: «${text.slice(0, 200)}»`);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          className="fixed left-0 right-0 z-[var(--z-mobile-sheet)] px-3"
          style={{ bottom: "calc(var(--safe-bottom) + 16px)" }}
          dir="rtl"
        >
          <div className="ai-border rounded-full bg-[var(--card)] shadow-[var(--shadow-xl)] px-1.5 py-1.5 flex items-center gap-1">
            <Pill icon={<Highlighter className="size-4" />} label="هایلایت" onClick={saveHighlight} accent />
            <Pill icon={<NotebookPen className="size-4" />} label="یادداشت" onClick={newNoteFromHighlight} />
            <Pill icon={<Sparkles className="size-4" />} label="AI" onClick={askAI} />
            <Pill icon={<Languages className="size-4" />} label="ترجمه" onClick={translate} />
            <Pill icon={<Copy className="size-4" />} label="کپی" onClick={copy} />
            <button
              onClick={onClose}
              aria-label="بستن"
              className="size-9 grid place-items-center rounded-full text-[var(--foreground-subtle)] tap press active:bg-[var(--accent)]"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Pill({ icon, label, onClick, accent }: { icon: React.ReactNode; label: string; onClick: () => void; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`h-9 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-medium tap press ${
        accent
          ? "bg-[var(--brand-500)] text-white active:bg-[var(--brand-600)]"
          : "text-[var(--foreground)] active:bg-[var(--accent)]"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
