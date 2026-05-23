import { Home, Search, Bookmark, Sparkles, User } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { useHaptics } from "../hooks";

export type MobileTab = "home" | "discover" | "saved" | "topics" | "me";

const TABS: { id: MobileTab; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "home",     label: "خانه",    Icon: Home },
  { id: "discover", label: "کاوش",    Icon: Search },
  { id: "saved",    label: "ذخیره",   Icon: Bookmark },
  { id: "topics",   label: "موضوعات", Icon: Sparkles },
  { id: "me",       label: "من",      Icon: User },
];

export function MobileBottomNav({
  active, onChange, badges,
}: {
  active: MobileTab;
  onChange: (t: MobileTab) => void;
  badges?: Partial<Record<MobileTab, number>>;
}) {
  const haptic = useHaptics();
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-[var(--z-mobile-bottomnav)]
                 bg-[var(--background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/80
                 border-t border-[var(--border-subtle)]"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="grid grid-cols-5" style={{ height: "var(--bottomnav-h)" }}>
        {TABS.map(({ id, label, Icon }) => {
          const on = active === id;
          const b = badges?.[id];
          return (
            <li key={id}>
              <button
                onClick={() => { if (!on) haptic("select"); onChange(id); }}
                aria-current={on ? "page" : undefined}
                aria-label={label}
                className="w-full h-full flex flex-col items-center justify-center gap-0.5 relative tap press"
              >
                <span className="relative">
                  <Icon
                    className={on ? "size-[22px] text-[var(--brand-600)] dark:text-[var(--brand-300)]" : "size-[22px] text-[var(--foreground-muted)]"}
                    strokeWidth={on ? 2.4 : 1.8}
                  />
                  {!!b && (
                    <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--brand-500)] text-white text-[9px] grid place-items-center font-semibold tabular-nums">
                      {b > 99 ? "+۹۹" : b.toLocaleString("fa-IR")}
                    </span>
                  )}
                </span>
                <span className={`text-[10.5px] leading-none ${on ? "text-[var(--brand-600)] dark:text-[var(--brand-300)] font-semibold" : "text-[var(--foreground-subtle)]"}`}>
                  {label}
                </span>
                {on && <span className="absolute top-0 h-[2.5px] w-8 rounded-full bg-[var(--brand-500)]" />}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
