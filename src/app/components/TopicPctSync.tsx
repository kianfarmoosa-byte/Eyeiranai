import { useEffect } from "react";
import type { TopicScore } from "../topics";

type Props = { scores: Map<string, TopicScore>; active: boolean };

export function TopicPctSync({ scores, active }: Props) {
  useEffect(() => {
    const rows = document.querySelectorAll<HTMLElement>("[data-aid]");
    if (!active) {
      rows.forEach(r => r.removeAttribute("data-pct"));
      return;
    }
    rows.forEach(r => {
      const id = r.getAttribute("data-aid")!;
      const s = scores.get(id);
      if (s && s.level !== "none" && s.score >= 0.08) {
        r.setAttribute("data-pct", `${Math.round(s.score * 100)}٪`);
      } else {
        r.removeAttribute("data-pct");
      }
    });
  }, [scores, active]);
  return null;
}
