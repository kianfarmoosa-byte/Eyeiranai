import { useEffect, useMemo, useState } from "react";
import { NotebookPen, Trash2, Link as LinkIcon } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { EmptyState } from "../primitives/EmptyState";
import { SwipeRow } from "../primitives/SwipeRow";
import { useHaptics } from "../hooks";
import { loadNotes, removeNote, type Note } from "../../../notes";
import { timeAgoFa, countFa } from "../utils/fa";

type Props = {
  onClose: () => void;
  onOpenNote?: (n: Note) => void;
};

export function NotesScreen({ onClose, onOpenNote }: Props) {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes());
  const haptic = useHaptics();

  useEffect(() => {
    const sync = () => setNotes(loadNotes());
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const sorted = useMemo(() => [...notes].sort((a, b) => b.updatedAt - a.updatedAt), [notes]);

  const del = (id: string) => {
    haptic("heavy");
    removeNote(id);
    setNotes(loadNotes());
  };

  return (
    <MobileScreen
      topbar={
        <MobileTopBar
          title="یادداشت‌ها"
          subtitle={countFa(sorted.length, "یادداشت")}
          onBack={onClose}
        />
      }
    >
      {sorted.length === 0 ? (
        <EmptyState
          icon={<NotebookPen className="size-6" />}
          title="هنوز یادداشتی نداری"
          description="با دکمه «نوشتن» در صفحه خانه یا داخل خواننده، اولین یادداشتت رو ثبت کن."
        />
      ) : (
        <div className="h-full overflow-y-auto scrollbar-none px-3 pt-3 pb-4">
          <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-subtle)]">
            {sorted.map((n) => (
              <SwipeRow
                key={n.id}
                endAction={{
                  label: "حذف",
                  icon: <Trash2 className="size-4" />,
                  color: "bg-rose-500",
                  onTrigger: () => del(n.id),
                }}
              >
                <button
                  onClick={() => onOpenNote?.(n)}
                  className="w-full text-right px-3.5 py-3 tap press"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0 text-[14.5px] font-semibold truncate">{n.title}</div>
                    <div className="text-[11px] text-[var(--foreground-subtle)] tabular-nums">{timeAgoFa(n.updatedAt)}</div>
                  </div>
                  {n.body && (
                    <div className="mt-1 text-[12.5px] text-[var(--foreground-muted)] line-clamp-2">
                      {n.body}
                    </div>
                  )}
                  {n.articleIds.length > 0 && (
                    <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-[var(--brand-500)]">
                      <LinkIcon className="size-3" />
                      {countFa(n.articleIds.length, "مقاله مرتبط")}
                    </div>
                  )}
                </button>
              </SwipeRow>
            ))}
          </div>
        </div>
      )}
    </MobileScreen>
  );
}
