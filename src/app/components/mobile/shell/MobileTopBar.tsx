import { Search, Menu, ArrowRight, MoreVertical, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Leading: back arrow takes precedence; otherwise menu icon. */
  onBack?: () => void;
  onMenu?: () => void;
  /** Trailing actions, rendered RTL-naturally (rightmost first). */
  onSearch?: () => void;
  onRefresh?: () => void;
  onMore?: () => void;
  /** Custom trailing slot inserted before the More button. */
  trailing?: ReactNode;
  loading?: boolean;
  /** Show a hairline border at bottom. */
  bordered?: boolean;
  /** Render with translucent glass background. */
  glass?: boolean;
  /** Compact 48px height (default 56px). */
  compact?: boolean;
};

export function MobileTopBar({
  title, subtitle, onBack, onMenu, onSearch, onRefresh, onMore, trailing,
  loading, bordered = true, glass = true, compact,
}: Props) {
  const h = compact ? "h-12" : "h-14";
  const bg = glass
    ? "bg-[var(--background)]/85 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/70"
    : "bg-[var(--background)]";
  return (
    <header
      className={`md:hidden sticky top-0 z-[var(--z-mobile-topbar)] ${bg} ${bordered ? "border-b border-[var(--border-subtle)]" : ""}`}
      style={{ paddingTop: "var(--safe-top)" }}
    >
      <div className={`flex items-center gap-0.5 px-1.5 ${h}`}>
        {onBack ? (
          <IconBtn aria="بازگشت" onClick={onBack}><ArrowRight className="size-5" /></IconBtn>
        ) : onMenu ? (
          <IconBtn aria="منو" onClick={onMenu}><Menu className="size-5" /></IconBtn>
        ) : <span className="size-10" />}

        <div className="flex-1 min-w-0 px-1">
          {title && <div className="text-[15px] font-semibold truncate leading-tight">{title}</div>}
          {subtitle && <div className="text-[11px] text-[var(--foreground-subtle)] truncate">{subtitle}</div>}
        </div>

        {onSearch && <IconBtn aria="جستجو" onClick={onSearch}><Search className="size-5" /></IconBtn>}
        {onRefresh && (
          <IconBtn aria="بروزرسانی" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`size-5 ${loading ? "animate-spin" : ""}`} />
          </IconBtn>
        )}
        {trailing}
        {onMore && <IconBtn aria="بیشتر" onClick={onMore}><MoreVertical className="size-5" /></IconBtn>}
      </div>
    </header>
  );
}

function IconBtn({ children, onClick, aria, disabled }: { children: ReactNode; onClick?: () => void; aria: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={aria}
      className="size-10 grid place-items-center rounded-full text-[var(--foreground)] tap press
                 active:bg-[var(--accent)] disabled:opacity-40"
    >
      {children}
    </button>
  );
}
