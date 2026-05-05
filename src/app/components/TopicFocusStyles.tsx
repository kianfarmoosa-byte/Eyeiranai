import { useMemo } from "react";
import type { TopicScore, FocusMode } from "../topics";

type Props = {
  scores: Map<string, TopicScore>;
  mode: FocusMode;
  active: boolean;
};

export function TopicFocusStyles({ scores, mode, active }: Props) {
  const css = useMemo(() => {
    if (!active || mode === "filter") return "";
    const strong: string[] = [], medium: string[] = [], weak: string[] = [], none: string[] = [];
    scores.forEach((s, id) => {
      const sel = `[data-aid="${id}"]`;
      if (s.level === "strong") strong.push(sel);
      else if (s.level === "medium") medium.push(sel);
      else if (s.level === "weak") weak.push(sel);
      else none.push(sel);
    });
    const rules: string[] = [
      `.topic-row{transition:opacity .35s ease,filter .35s ease,box-shadow .25s ease,background-color .25s ease;position:relative;}`,
      `.topic-row::after{content:attr(data-pct);position:absolute;top:6px;left:6px;font-size:9px;font-weight:600;padding:1px 5px;border-radius:8px;background:linear-gradient(90deg,rgb(99 102 241),rgb(129 140 248));color:white;letter-spacing:.02em;pointer-events:none;opacity:0;transform:translateY(-2px);transition:opacity .25s,transform .25s;}`,
      `.topic-row[data-pct]:not([data-pct=""])::after{opacity:1;transform:translateY(0);}`,
    ];
    if (mode === "highlight") {
      if (strong.length) rules.push(`${strong.join(",")}{box-shadow:inset 3px 0 0 rgb(99 102 241);background-color:rgba(99,102,241,.06);}`);
      if (medium.length) rules.push(`${medium.join(",")}{box-shadow:inset 2px 0 0 rgba(99,102,241,.55);}`);
      if (none.length) rules.push(`${none.join(",")}{opacity:.5;}`);
    } else if (mode === "dim") {
      if (none.length) rules.push(`${none.join(",")}{opacity:.18;filter:grayscale(60%) saturate(60%);}`);
      if (weak.length) rules.push(`${weak.join(",")}{opacity:.55;}`);
      if (strong.length) rules.push(`${strong.join(",")}{box-shadow:inset 3px 0 0 rgb(99 102 241);}`);
    }
    return rules.join("\n");
  }, [scores, mode, active]);
  if (!css) return null;
  return <style>{css}</style>;
}
