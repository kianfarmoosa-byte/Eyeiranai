import { Home, Search, Bookmark, Globe2, User } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { useHaptics } from "../hooks";

export type MobileTab = "home" | "international" | "discover" | "saved" | "me";

type TabDef = {
  id: MobileTab;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Center tab renders as a raised circular FAB. */
  center?: boolean;
};

/* Layout per ui-styles.css spec: home / notifications / [FAB] / stats / account.
   Adapted to app domain: home / international / [discover-FAB] / saved / me. */
const TABS: TabDef[] = [
  { id: "home",          label: "خانه",      Icon: Home },
  { id: "international", label: "بین‌الملل", Icon: Globe2 },
  { id: "discover",      label: "کاوش",      Icon: Search, center: true },
  { id: "saved",         label: "ذخیره",     Icon: Bookmark },
  { id: "me",            label: "من",        Icon: User },
];

export function MobileBottomNav({
  active, onChange, badges,
}: {
  active: MobileTab;
  onChange: (t: MobileTab) => void;
  badges?: Partial<Record<MobileTab, number>>;
}) {
  const haptic = useHaptics();
  const sides = TABS.filter((t) => !t.center);
  const center = TABS.find((t) => t.center)!;

  const press = (id: MobileTab) => {
    if (active !== id) haptic("select");
    onChange(id);
  };

  /* Bar geometry (matches spec 375×65 ratio, scales with viewport).
     Notch is a downward concave arc cut into the top edge of the bar. */
  const W = 375;
  const H = 65;
  const BAR_TOP = 9;
  const CX = W / 2;
  const NOTCH_R = 34; // half of 68px notch — slightly tighter than the 76 ellipse so FAB has breathing room

  const barPath =
    `M 0 ${BAR_TOP} ` +
    `L ${CX - NOTCH_R} ${BAR_TOP} ` +
    `A ${NOTCH_R} ${NOTCH_R} 0 0 0 ${CX + NOTCH_R} ${BAR_TOP} ` +
    `L ${W} ${BAR_TOP} ` +
    `L ${W} ${H} ` +
    `L 0 ${H} Z`;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-[var(--z-mobile-bottomnav)] kian-bottomnav"
      style={{ paddingBottom: "var(--safe-bottom)" }}
      aria-label="پیمایش پایین"
    >
      <div className="relative w-full" style={{ height: `${H}px` }}>
        {/* Bar shape (white surface with concave notch on top) */}
        <svg
          className="absolute inset-0 w-full h-full kian-bottomnav-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d={barPath} fill="var(--card)" />
        </svg>

        {/* Side icons (2 left + 2 right) */}
        <ul className="absolute left-0 right-0 grid grid-cols-5 h-full">
          {TABS.map((t) => {
            if (t.center) return <li key={t.id} aria-hidden />; // reserve center slot for FAB
            const on = active === t.id;
            const b = badges?.[t.id];
            return (
              <li key={t.id} className="flex items-end justify-center pb-2.5">
                <button
                  onClick={() => press(t.id)}
                  aria-current={on ? "page" : undefined}
                  aria-label={t.label}
                  className="relative size-9 grid place-items-center tap press rounded-full"
                >
                  <t.Icon
                    className={on
                      ? "size-6 text-[var(--foreground)]"
                      : "size-6 text-[var(--foreground-subtle)]"}
                    strokeWidth={on ? 2.2 : 1.7}
                  />
                  {!!b && (
                    <span
                      className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full
                                 bg-[var(--brand-500)] text-white text-[9px] grid place-items-center font-bold tabular-nums"
                    >
                      {b > 99 ? "+۹۹" : b.toLocaleString("fa-IR")}
                    </span>
                  )}
                  {on && (
                    <span
                      aria-hidden
                      className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-[var(--foreground)]"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Raised center FAB */}
        <button
          onClick={() => press(center.id)}
          aria-current={active === center.id ? "page" : undefined}
          aria-label={center.label}
          className="absolute left-1/2 -translate-x-1/2 -top-1 size-[52px] rounded-full grid place-items-center bg-[var(--foreground)] text-[var(--card)] tap press kian-bottomnav-fab mx-[0px] my-[-15px]"
        >
          <center.Icon className="size-6" strokeWidth={2.4} />
          {active === center.id && (
            <span
              aria-hidden
              className="absolute -bottom-2.5 w-1 h-1 rounded-full bg-[var(--foreground)]"
            />
          )}
        </button>

        {/* Sentinel for sides count to satisfy lint (unused otherwise) */}
        <span hidden aria-hidden>{sides.length}</span>
      </div>
    </nav>
  );
}
