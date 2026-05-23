/**
 * Bionic-style reading: bolds the leading portion of each word so the eye
 * can scan faster. Punctuation and short words (≤ 2 chars) are left alone.
 * Works on both LTR and Persian text since we split on Unicode whitespace.
 */

import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

const PUNCT = /^[\p{P}\p{S}]+$/u;

function boldLen(wordLen: number): number {
  if (wordLen <= 2) return 0;
  if (wordLen <= 4) return 1;
  if (wordLen <= 7) return 2;
  return Math.ceil(wordLen * 0.45);
}

export function bionicNodes(text: string): ReactNode {
  if (!text) return text;
  const parts = text.split(/(\s+)/);
  return createElement(
    Fragment,
    null,
    ...parts.map((tok, i) => {
      if (/\s+/.test(tok) || PUNCT.test(tok)) return tok;
      const n = boldLen(tok.length);
      if (n === 0) return tok;
      return createElement(
        "span",
        { key: i },
        createElement("b", { className: "font-bold" }, tok.slice(0, n)),
        tok.slice(n),
      );
    }),
  );
}
