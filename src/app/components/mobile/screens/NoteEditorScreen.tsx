import { useEffect, useRef, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { useHaptics } from "../hooks";
import { useToast } from "../primitives/Toast";
import { updateNote, removeNote, type Note } from "../../../notes";
import { timeAgoFa } from "../utils/fa";

type Props = {
  note: Note;
  onClose: () => void;
  onDeleted?: () => void;
};

export function NoteEditorScreen({ note, onClose, onDeleted }: Props) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [dirty, setDirty] = useState(false);
  const haptic = useHaptics();
  const toast = useToast();
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      updateNote(note.id, { title: title.trim() || "بدون عنوان", body });
      setDirty(false);
    }, 600);
    return () => clearTimeout(t);
  }, [title, body, dirty, note.id]);

  const saveAndClose = () => {
    if (dirty) updateNote(note.id, { title: title.trim() || "بدون عنوان", body });
    haptic("success");
    onClose();
  };

  const del = () => {
    haptic("heavy");
    removeNote(note.id);
    toast({ kind: "info", title: "یادداشت حذف شد" });
    onDeleted?.();
    onClose();
  };

  return (
    <MobileScreen
      topbar={
        <MobileTopBar
          title="ویرایش یادداشت"
          subtitle={timeAgoFa(note.updatedAt)}
          onBack={saveAndClose}
          trailing={
            <>
              <button
                onClick={del}
                aria-label="حذف"
                className="size-10 grid place-items-center rounded-full tap press active:bg-[var(--accent)] text-rose-500"
              >
                <Trash2 className="size-5" />
              </button>
              <button
                onClick={saveAndClose}
                aria-label="ذخیره"
                className="size-9 grid place-items-center rounded-full bg-[var(--brand-500)] text-white tap press"
              >
                <Check className="size-5" />
              </button>
            </>
          }
        />
      }
    >
      <div className="h-full overflow-y-auto scrollbar-none px-4 py-3 flex flex-col gap-3">
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          placeholder="عنوان..."
          className="w-full bg-transparent outline-none text-[20px] font-bold placeholder:text-[var(--foreground-subtle)]"
        />
        <textarea
          ref={taRef}
          value={body}
          onChange={(e) => { setBody(e.target.value); setDirty(true); }}
          placeholder="بدنه یادداشت... از [[عنوان]] برای پیوند به یادداشت دیگه استفاده کن."
          className="flex-1 w-full resize-none bg-transparent outline-none text-[15px] leading-[1.9] placeholder:text-[var(--foreground-subtle)]"
        />
        <div className="text-[11px] text-[var(--foreground-subtle)] text-left tabular-nums">
          {body.length.toLocaleString("fa-IR")} نویسه · {dirty ? "در حال ذخیره..." : "ذخیره شد"}
        </div>
      </div>
    </MobileScreen>
  );
}
