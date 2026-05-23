import { Bookmark, BookmarkCheck, Share2, NotebookPen, ExternalLink, EyeOff, Copy, Sparkles, FolderPlus, Newspaper } from "lucide-react";
import { ActionSheet, type ActionItem } from "../primitives/ActionSheet";
import { useToast } from "../primitives/Toast";
import {
  loadCollections, toggleArticleInCollection, collectionsForArticle,
} from "../utils/collections";
import type { Article } from "../../../data";

type Props = {
  article: Article | null;
  open: boolean;
  onClose: () => void;
  onToggleSave?: (a: Article) => void;
  onShare?: (a: Article) => void;
  onAddNote?: (a: Article) => void;
  onAskAI?: (a: Article) => void;
  onHide?: (a: Article) => void;
  onOpenSource?: (source: string) => void;
};

/**
 * Long-press context menu for an article. Renders as an iOS-style ActionSheet.
 * Each action is optional; only handlers passed by the parent become visible.
 */
export function ArticleContextSheet({
  article, open, onClose, onToggleSave, onShare, onAddNote, onAskAI, onHide, onOpenSource,
}: Props) {
  const toast = useToast();
  if (!article) return null;

  const actions: ActionItem[] = [];

  if (onToggleSave) {
    actions.push({
      id: "save",
      label: article.starred ? "حذف از ذخیره" : "ذخیره برای بعد",
      icon: article.starred
        ? <BookmarkCheck className="size-5 text-[var(--brand-500)]" />
        : <Bookmark className="size-5" />,
      onSelect: () => onToggleSave(article),
    });
  }
  if (onShare) {
    actions.push({
      id: "share",
      label: "اشتراک‌گذاری",
      icon: <Share2 className="size-5" />,
      onSelect: () => onShare(article),
    });
  }
  if (onAskAI) {
    actions.push({
      id: "ask",
      label: "پرسش از AI دربارهٔ این خبر",
      icon: <Sparkles className="size-5 text-[var(--brand-500)]" />,
      onSelect: () => onAskAI(article),
    });
  }
  if (onAddNote) {
    actions.push({
      id: "note",
      label: "افزودن یادداشت",
      icon: <NotebookPen className="size-5" />,
      onSelect: () => onAddNote(article),
    });
  }

  const cols = loadCollections();
  const inIds = new Set(collectionsForArticle(article.id));
  for (const c of cols) {
    const isIn = inIds.has(c.id);
    actions.push({
      id: `col_${c.id}`,
      label: `${isIn ? "حذف از" : "افزودن به"} ${c.emoji} ${c.name}`,
      icon: <FolderPlus className={`size-5 ${isIn ? "text-[var(--brand-500)]" : ""}`} />,
      onSelect: () => {
        const nowIn = toggleArticleInCollection(c.id, article.id);
        toast({ kind: "success", message: nowIn ? `به «${c.name}» اضافه شد` : `از «${c.name}» حذف شد` });
      },
    });
  }

  actions.push({
    id: "copy",
    label: "کپی عنوان",
    icon: <Copy className="size-5" />,
    onSelect: async () => {
      try {
        await navigator.clipboard.writeText(article.title);
        toast({ kind: "success", message: "عنوان کپی شد" });
      } catch {
        toast({ kind: "error", message: "کپی نشد" });
      }
    },
  });

  if (onOpenSource) {
    actions.push({
      id: "source",
      label: `همهٔ مقالات از ${article.source}`,
      icon: <Newspaper className="size-5" />,
      onSelect: () => onOpenSource(article.source),
    });
  }
  if (article.link) {
    actions.push({
      id: "open",
      label: "باز کردن در منبع",
      icon: <ExternalLink className="size-5" />,
      onSelect: () => window.open(article.link!, "_blank", "noopener,noreferrer"),
    });
  }
  if (onHide) {
    actions.push({
      id: "hide",
      label: "پنهان کردن این خبر",
      icon: <EyeOff className="size-5" />,
      destructive: true,
      onSelect: () => onHide(article),
    });
  }

  return (
    <ActionSheet
      open={open}
      onClose={onClose}
      title={article.title}
      message={`${article.sourceIcon} ${article.source} · ${article.readTime}`}
      actions={actions}
    />
  );
}
