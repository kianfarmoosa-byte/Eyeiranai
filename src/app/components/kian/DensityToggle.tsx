import { useEffect, useState } from "react";
import { Rows3, Rows4, AlignJustify } from "lucide-react";
import { SegmentedControl } from "./SegmentedControl";

export type Density = "comfortable" | "cozy" | "compact";
const KEY = "kian.density";

export function applyDensity(d: Density) {
  const root = document.documentElement;
  root.classList.remove("density-comfortable", "density-cozy", "density-compact");
  root.classList.add(`density-${d}`);
}

export function loadDensity(): Density {
  try { return (localStorage.getItem(KEY) as Density) || "cozy"; } catch { return "cozy"; }
}

export function DensityProvider() {
  useEffect(() => { applyDensity(loadDensity()); }, []);
  return null;
}

export function DensityToggle({ className = "" }: { className?: string }) {
  const [d, setD] = useState<Density>(() => loadDensity());
  useEffect(() => {
    applyDensity(d);
    try { localStorage.setItem(KEY, d); } catch {}
  }, [d]);

  return (
    <SegmentedControl<Density>
      value={d}
      onChange={setD}
      className={className}
      items={[
        { value: "comfortable", label: "راحت",   icon: <Rows3 className="size-3" /> },
        { value: "cozy",        label: "متوسط",  icon: <Rows4 className="size-3" /> },
        { value: "compact",     label: "فشرده",  icon: <AlignJustify className="size-3" /> },
      ]}
    />
  );
}
