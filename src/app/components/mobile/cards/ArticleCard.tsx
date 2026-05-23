import { Bookmark, BookmarkCheck } from "lucide-react";
import type { Article } from "../../../data";
import { ImageWithFallback } from "../../figma/ImageWithFallback";
import { useHaptics, useLongPress } from "../hooks";
import { timeAgoFa } from "../utils/fa";

type Props = {
  article: Article;
  onOpen: (a: Article) => void;
  onToggleSave?: (a: Article) => void;
  onLongPress?: (a: Article) => void;
  /** "feed" = image-leading card; "compact" = no image; "hero" = large image on top. */
  variant?: "feed" | "compact" | "hero";
};

export function ArticleCard({ article, onOpen, onToggleSave, onLongPress, variant = "feed" }: Props) {
  const haptic = useHaptics();
  const { didFire: _didFire, ...lp } = useLongPress(() => { haptic("heavy"); onLongPress?.(article); }, 480);
  void _didFire;

  const Save = (
    <button
      onClick={(e) => { e.stopPropagation(); haptic("select"); onToggleSave?.(article); }}
      aria-label={article.starred ? "حذف از ذخیره" : "ذخیره"}
      className="shrink-0 size-9 grid place-items-center rounded-full tap press active:bg-[var(--accent)] text-[var(--foreground-muted)]"
    >
      {article.starred ? <BookmarkCheck className="size-5 text-[var(--brand-500)]" /> : <Bookmark className="size-5" />}
    </button>
  );

  if (variant === "hero") {
    return (
      <article
        onClick={() => { haptic("tap"); onOpen(article); }}
        {...lp}
        className="tap press rounded-[var(--radius-lg)] overflow-hidden bg-[var(--surface)] border border-[var(--border-subtle)]"
      >
        {article.image && (
          <ImageWithFallback src={article.image} alt={article.title} className="w-full aspect-[16/9] object-cover" />
        )}
        <div className="p-3.5 flex flex-col gap-1.5">
          <Meta a={article} />
          <h3 className="text-[16px] leading-snug font-semibold line-clamp-3">{article.title}</h3>
          <p className="text-[13px] text-[var(--foreground-muted)] line-clamp-2">{article.preview}</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[11.5px] text-[var(--foreground-subtle)]">{article.readTime}</span>
            {Save}
          </div>
        </div>
      </article>
    );
  }

  if (variant === "compact") {
    return (
      <article
        onClick={() => { haptic("tap"); onOpen(article); }}
        {...lp}
        className="tap press flex items-start gap-3 px-4 py-3 active:bg-[var(--accent)]/40"
      >
        <div className="flex-1 min-w-0">
          <Meta a={article} />
          <h3 className="text-[14.5px] leading-snug font-semibold line-clamp-2 mt-0.5">{article.title}</h3>
          <p className="text-[12.5px] text-[var(--foreground-muted)] mt-0.5">{article.readTime}</p>
        </div>
        {Save}
      </article>
    );
  }

  return (
    <article
      onClick={() => { haptic("tap"); onOpen(article); }}
      {...lp}
      className="tap press flex items-stretch gap-3 px-4 py-3 active:bg-[var(--accent)]/40"
    >
      <div className="flex-1 min-w-0 flex flex-col">
        <Meta a={article} />
        <h3 className="text-[15px] leading-snug font-semibold line-clamp-3 mt-0.5">{article.title}</h3>
        <p className="text-[12.5px] text-[var(--foreground-muted)] line-clamp-2 mt-1">{article.preview}</p>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[11.5px] text-[var(--foreground-subtle)]">{article.readTime}</span>
          {Save}
        </div>
      </div>
      {article.image && (
        <ImageWithFallback
          src={article.image}
          alt={article.title}
          className="shrink-0 size-[88px] rounded-[var(--radius-md)] object-cover"
        />
      )}
    </article>
  );
}

function Meta({ a }: { a: Article }) {
  return (
    <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--foreground-subtle)]">
      <span aria-hidden>{a.sourceIcon}</span>
      <span className="truncate max-w-[120px]">{a.source}</span>
      <span>·</span>
      <span className="truncate">{a.dateMs ? timeAgoFa(a.dateMs) : a.date}</span>
      {!a.read && <span className="ms-1 size-1.5 rounded-full bg-[var(--brand-500)]" aria-label="نخوانده" />}
    </div>
  );
}
