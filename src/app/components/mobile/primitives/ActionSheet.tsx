import { type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useBodyScrollLock, useHaptics } from "../hooks";

export type ActionItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Destructive items render in red. */
  destructive?: boolean;
  /** Disabled items are dimmed and not pressable. */
  disabled?: boolean;
  onSelect: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  message?: ReactNode;
  actions: ActionItem[];
  cancelLabel?: string;
};

/**
 * iOS-style action sheet: a grouped list of actions sliding up from the bottom,
 * separated from a "Cancel" button. Use for context menus (long-press) and
 * confirm-style prompts where the option set is short.
 */
export function ActionSheet({ open, onClose, title, message, actions, cancelLabel = "انصراف" }: Props) {
  useBodyScrollLock(open);
  const haptic = useHaptics();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="actionsheet"
          className="fixed inset-0 z-[var(--z-mobile-sheet)] md:hidden flex flex-col justify-end"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          role="dialog" aria-modal
        >
          <div className="absolute inset-0 scrim" onClick={onClose} />
          <motion.div
            initial={{ y: 24 }} animate={{ y: 0 }} exit={{ y: 24 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="relative px-3 pb-3"
            style={{ paddingBottom: `calc(var(--safe-bottom) + 12px)` }}
          >
            <div className="rounded-[var(--sheet-radius)] bg-[var(--background)] overflow-hidden shadow-[var(--sheet-shadow)]">
              {(title || message) && (
                <div className="px-4 py-3 text-center border-b border-[var(--border-subtle)]">
                  {title && <div className="text-[13px] font-semibold">{title}</div>}
                  {message && <div className="text-[12px] text-[var(--foreground-subtle)] mt-0.5">{message}</div>}
                </div>
              )}
              <ul className="divide-y divide-[var(--border-subtle)]">
                {actions.map((a) => (
                  <li key={a.id}>
                    <button
                      disabled={a.disabled}
                      onClick={() => { haptic("select"); a.onSelect(); onClose(); }}
                      className={`w-full tap press flex items-center gap-3 px-4 h-12 text-[14.5px] ${
                        a.destructive ? "text-red-500" : "text-[var(--foreground)]"
                      } ${a.disabled ? "opacity-40" : "active:bg-[var(--accent)]"}`}
                    >
                      {a.icon && <span className="size-5 grid place-items-center">{a.icon}</span>}
                      <span className="flex-1 text-right">{a.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={onClose}
              className="mt-2 w-full h-12 rounded-[var(--sheet-radius)] bg-[var(--background)] text-[14.5px] font-semibold tap press active:bg-[var(--accent)] shadow-[var(--shadow-sm)]"
            >
              {cancelLabel}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
