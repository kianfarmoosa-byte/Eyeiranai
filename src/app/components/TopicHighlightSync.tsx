import { useEffect } from "react";
import type { TopicScore } from "../topics";

type Props = { scores: Map<string, TopicScore>; active: boolean };

const ORIG_ATTR = "data-th-orig";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeForMatch(s: string): string {
  return s.replace(/[\u200C\u200B\u200D]/g, "").replace(/[يى]/g, "ی").replace(/ك/g, "ک").toLowerCase();
}

function buildHighlighted(original: string, terms: string[]): string {
  if (!terms.length) return escapeHtml(original);
  const normOrig = normalizeForMatch(original);
  const normTerms = Array.from(new Set(
    terms.map(t => normalizeForMatch(t)).filter(t => t.length > 1)
  )).sort((a, b) => b.length - a.length);
  if (!normTerms.length) return escapeHtml(original);
  const ranges: Array<[number, number]> = [];
  for (const t of normTerms) {
    const re = new RegExp(escapeRe(t), "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(normOrig)) !== null) {
      ranges.push([m.index, m.index + t.length]);
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  if (!ranges.length) return escapeHtml(original);
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  let out = "";
  let cur = 0;
  for (const [a, b] of merged) {
    out += escapeHtml(original.slice(cur, a));
    out += `<mark class="th-mark">${escapeHtml(original.slice(a, b))}</mark>`;
    cur = b;
  }
  out += escapeHtml(original.slice(cur));
  return out;
}

export function TopicHighlightSync({ scores, active }: Props) {
  useEffect(() => {
    const rows = document.querySelectorAll<HTMLElement>("[data-aid]");
    rows.forEach(row => {
      const candidates = row.querySelectorAll<HTMLElement>("h3, .truncate, p.line-clamp-2, p.line-clamp-3");
      candidates.forEach(el => {
        const orig = el.getAttribute(ORIG_ATTR) ?? el.textContent ?? "";
        if (!el.hasAttribute(ORIG_ATTR)) el.setAttribute(ORIG_ATTR, orig);

        if (!active) {
          if (el.innerHTML !== escapeHtml(orig)) el.textContent = orig;
          return;
        }
        const id = row.getAttribute("data-aid")!;
        const s = scores.get(id);
        if (!s || s.level === "none" || !s.matchedTerms.length) {
          if (el.innerHTML !== escapeHtml(orig)) el.textContent = orig;
          return;
        }
        const html = buildHighlighted(orig, s.matchedTerms);
        if (el.innerHTML !== html) el.innerHTML = html;
      });
    });
  });
  return (
    <style>{`
      .th-mark{background:rgba(99,102,241,.22);color:inherit;border-radius:3px;padding:0 2px;font-weight:600;}
      .dark .th-mark{background:rgba(129,140,248,.32);}
    `}</style>
  );
}
