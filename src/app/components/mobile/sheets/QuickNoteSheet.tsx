import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { BottomSheet } from "../primitives/BottomSheet";
import { useHaptics } from "../hooks";
import { useToast } from "../primitives/Toast";
import { newNote, updateNote } from "../../../notes";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Optional article id to link the note to. */
  articleId?: string;
};

/**
 * Tiny composer that writes directly into the existing notes store. The first
 * non-empty line becomes the title; everything else is the body.
 */
export function QuickNoteSheet({ open, onClose, articleId }: Props) {
  const [text, setText] = useState("");
  const haptic = useHaptics();
  const toast = useToast();
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setText("");
      setTimeout(() => taRef.current?.focus(), 150);
    }
  }, [open]);

  const save = () => {
    const trimmed = text.trim();
    if (!trimmed) { onClose(); return; }
    const [first, ...rest] = trimmed.split("\n");
    const note = newNote(first.slice(0, 80) || "یادداشت سریع");
    updateNote(note.id, {
      body: rest.join("\n").trim(),
      articleIds: articleId ? [articleId] : [],
    });
    haptic("success");
    toast({ kind: "success", title: "یادداشت ذخیره شد" });
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      snap="half"
      snapPoints={[0.55, 0.95]}
      title="یادداشت سریع"
      trailing={
        <button
          onClick={save}
          aria-label="ذخیره"
          className="size-9 grid place-items-center rounded-full bg-[var(--brand-500)] text-white tap press disabled:opacity-40"
          disabled={!text.trim()}
        >
          <Check className="size-5" />
        </button>
      }
    >
      <div className="px-4 py-3 h-full flex flex-col">
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="چی توی ذهنته؟ خط اول عنوان می‌شه..."
          className="flex-1 w-full resize-none bg-transparent outline-none text-[15px] leading-[1.8] placeholder:text-[var(--foreground-subtle)]"
        />
        <div className="mt-2 text-[11px] text-[var(--foreground-subtle)] text-left tabular-nums">
          {text.length.toLocaleString("fa-IR")} نویسه
        </div>
      </div>
    </BottomSheet>
  );
}
