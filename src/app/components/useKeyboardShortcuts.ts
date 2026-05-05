import { useEffect } from "react";

type Handlers = {
  onNext: () => void;
  onPrev: () => void;
  onStar: () => void;
  onMarkRead: () => void;
  onSave: () => void;
  onOpenOriginal: () => void;
  onRefresh: () => void;
  onClose: () => void;
  onFocusSearch: () => void;
  onHelp: () => void;
};

export function useKeyboardShortcuts(h: Handlers) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;
      if (typing && e.key !== 'Escape') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case 'j': case 'J': e.preventDefault(); h.onNext(); break;
        case 'k': case 'K': e.preventDefault(); h.onPrev(); break;
        case 's': case 'S': e.preventDefault(); h.onStar(); break;
        case 'm': case 'M': e.preventDefault(); h.onMarkRead(); break;
        case 'b': case 'B': e.preventDefault(); h.onSave(); break;
        case 'o': case 'O': e.preventDefault(); h.onOpenOriginal(); break;
        case 'r': case 'R': e.preventDefault(); h.onRefresh(); break;
        case 'Escape': h.onClose(); break;
        case '/': e.preventDefault(); h.onFocusSearch(); break;
        case '?': e.preventDefault(); h.onHelp(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [h]);
}
