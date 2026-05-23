import type { ReactNode } from "react";

type Props = {
  topbar?: ReactNode;
  /** Fixed bottom area (e.g. action bar) — distinct from the global BottomNav. */
  footer?: ReactNode;
  /** Floating Action Button — rendered above content, below bottom nav. */
  fab?: ReactNode;
  children: ReactNode;
  /** When true, content area accounts for bottom nav height. Default true. */
  withBottomNav?: boolean;
};

/**
 * Layout scaffold for a mobile screen. Composes TopBar + scrollable body + optional footer / fab.
 * Use inside MobileShell so the BottomNav is shared across tabs.
 */
export function MobileScreen({ topbar, footer, fab, children, withBottomNav = true }: Props) {
  return (
    <div className="flex flex-col h-dscreen min-w-0 min-h-0 bg-[var(--background)] text-[var(--foreground)]">
      {topbar}
      <main
        className="flex-1 min-h-0 relative"
        style={{ paddingBottom: withBottomNav ? `calc(var(--bottomnav-h) + var(--safe-bottom))` : undefined }}
      >
        {children}
        {fab && (
          <div
            className="absolute z-[var(--z-mobile-fab)] left-4"
            style={{ bottom: `calc(${withBottomNav ? "var(--bottomnav-h)" : "0px"} + var(--safe-bottom) + 16px)` }}
          >
            {fab}
          </div>
        )}
      </main>
      {footer}
    </div>
  );
}
