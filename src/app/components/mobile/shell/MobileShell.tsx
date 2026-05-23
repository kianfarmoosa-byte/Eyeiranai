import { useState, type ReactNode } from "react";
import { MobileBottomNav, type MobileTab } from "./MobileBottomNav";
import { ToastProvider } from "../primitives/Toast";
import { OfflineBanner } from "../primitives/OfflineBanner";

type Props = {
  /** Render-prop per tab so each screen owns its TopBar + body. */
  renderTab: (tab: MobileTab, setTab: (t: MobileTab) => void) => ReactNode;
  badges?: Partial<Record<MobileTab, number>>;
  /** Overlays (reader, sheets) rendered above tabs but below toasts. */
  overlays?: ReactNode;
  initialTab?: MobileTab;
};

/**
 * Top-level mobile container. Renders the active tab's content and the shared
 * BottomNav. Wraps everything in ToastProvider so any nested screen can call
 * `useToast()`.
 */
export function MobileShell({ renderTab, badges, overlays, initialTab = "home" }: Props) {
  const [tab, setTab] = useState<MobileTab>(initialTab);
  return (
    <ToastProvider>
      <div dir="rtl" lang="fa" className="md:hidden fixed inset-0 bg-[var(--background)] text-[var(--foreground)] overflow-hidden">
        {renderTab(tab, setTab)}
        <OfflineBanner />
        <MobileBottomNav active={tab} onChange={setTab} badges={badges} />
        {overlays}
      </div>
    </ToastProvider>
  );
}
