// Persian/English news summarizer. Primary path is a real LLM (server-proxied);
// the local heuristic below is kept as an offline / failure fallback.

import type { Article } from "../../../data";
import { api } from "../../../api";
import { studioUserId } from "../studio/studio";

export type SummaryMode = "tldr" | "bullets" | "long";

export type Summary = {
  tldr: string;
  bullets: string[];
  long: string;
  entities: string[];
  readingMinutes: number;
};

const FA_PUNCT = /[\.!\?؟…]+\s+|[\n\r]+/g;
const STOP_FA = new Set([
  "و","در","به","از","که","این","آن","با","را","برای","است","تا","یا","هم","نیز","بر","می","شد","شده","کرد","کرده",
  "های","ها","یک","دو","سه","هر","خود","یکی","بعد","پیش","پس","اما","ولی","اگر","چون","چه","کجا","کی","چرا","شاید",
]);
const STOP_EN = new Set([
  "the","a","an","of","to","in","on","and","or","is","are","was","were","be","been","by","for","with","at","from",
  "as","that","this","it","its","but","not","into","over","under","than","then","so","also","very","more","most",
]);

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(FA_PUNCT)
    .map((s) => s.trim())
    .filter((s) => s.length > 18);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function scoreSentences(sentences: string[]): Array<{ s: string; score: number; i: number }> {
  const freq = new Map<string, number>();
  for (const s of sentences) {
    for (const tok of tokenize(s)) {
      if (tok.length < 3) continue;
      if (STOP_FA.has(tok) || STOP_EN.has(tok)) continue;
      freq.set(tok, (freq.get(tok) ?? 0) + 1);
    }
  }
  return sentences.map((s, i) => {
    const toks = tokenize(s);
    let score = 0;
    for (const t of toks) score += freq.get(t) ?? 0;
    // boost early sentences (news lead bias) and penalize very long ones
    score = (score / Math.max(1, toks.length)) * (1 + Math.max(0, 0.25 - i * 0.02));
    return { s, score, i };
  });
}

function topEntities(text: string, k = 5): string[] {
  // Naive: capitalized n-grams (Latin) + frequent rare Persian tokens.
  const caps = Array.from(text.matchAll(/\b([A-Z][\p{L}\.\-]+(?:\s+[A-Z][\p{L}\.\-]+){0,2})\b/gu))
    .map((m) => m[1])
    .filter((w) => w.length > 2);
  const fa = tokenize(text).filter((t) => !STOP_FA.has(t) && !STOP_EN.has(t) && t.length > 3);
  const freq = new Map<string, number>();
  for (const w of [...caps, ...fa]) freq.set(w, (freq.get(w) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([w]) => w);
}

export function summarize(article: Article): Summary {
  const body = article.content || "";
  const sentences = splitSentences(body);
  const scored = scoreSentences(sentences);
  const top = [...scored].sort((a, b) => b.score - a.score);

  const tldrPick = top[0]?.s ?? sentences[0] ?? article.title;
  const tldr = clamp(tldrPick, 160);

  const bulletPicks = top.slice(0, 5).sort((a, b) => a.i - b.i).map((x) => clamp(x.s, 140));
  const bullets = dedupe(bulletPicks).slice(0, 5);

  const longPicks = top.slice(0, 7).sort((a, b) => a.i - b.i).map((x) => x.s);
  const long = dedupe(longPicks).join(" ");

  const words = tokenize(body).length;
  const readingMinutes = Math.max(1, Math.round(words / 220));

  return {
    tldr,
    bullets: bullets.length ? bullets : [article.title],
    long: long || article.content?.slice(0, 600) || article.title,
    entities: topEntities(`${article.title} ${body}`, 6),
    readingMinutes,
  };
}

function clamp(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n - 1).replace(/[\s،,\.]+$/, "") + "…";
}

function dedupe(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const key = s.slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

// Faux streaming for nice UX. Yields chunks until full text is emitted.
export async function* streamText(text: string, opts: { chunkChars?: number; delayMs?: number } = {}) {
  const { chunkChars = 4, delayMs = 14 } = opts;
  for (let i = 0; i < text.length; i += chunkChars) {
    yield text.slice(i, i + chunkChars);
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
}

// Simple keyword-based answer over an article. Picks the highest-scoring
// sentences that share tokens with the question.
export function answer(article: Article, question: string): string {
  const sents = splitSentences(article.content || "");
  if (!sents.length) return "اطلاعات کافی در این مقاله برای پاسخ پیدا نشد.";
  const qTok = new Set(tokenize(question).filter((t) => t.length > 2 && !STOP_FA.has(t) && !STOP_EN.has(t)));
  if (qTok.size === 0) return clamp(sents[0], 220);
  const scored = sents.map((s) => {
    const stok = new Set(tokenize(s));
    let hit = 0;
    qTok.forEach((t) => { if (stok.has(t)) hit++; });
    return { s, hit };
  });
  const best = scored.sort((a, b) => b.hit - a.hit).filter((x) => x.hit > 0).slice(0, 2).map((x) => x.s);
  if (!best.length) return "موضوع پرسش در این مقاله مستقیماً پوشش داده نشده، اما خلاصه‌اش این است: " + clamp(sents[0], 200);
  return best.join(" ");
}

// ── LLM-backed variants (server-proxied). Fall back to local heuristics. ──

/** Real summary via the backend LLM; falls back to the local extractive summary. */
export async function summarizeAI(article: Article): Promise<Summary> {
  try {
    const s = await api.aiSummarize({
      title: article.title || "",
      content: article.content || article.preview || "",
    }, studioUserId());
    // Guard against partial responses by backfilling from the local summary.
    const local = summarize(article);
    return {
      tldr: s.tldr || local.tldr,
      bullets: s.bullets?.length ? s.bullets : local.bullets,
      long: s.long || local.long,
      entities: s.entities?.length ? s.entities : local.entities,
      readingMinutes: s.readingMinutes || local.readingMinutes,
    };
  } catch (e) {
    console.log("summarizeAI failed, using local fallback:", e);
    return summarize(article);
  }
}

/** Real answer via the backend LLM; falls back to the local keyword answer. */
export async function answerAI(
  article: Article,
  question: string,
  history: { role: string; text: string }[] = [],
): Promise<string> {
  try {
    return await api.aiAsk({
      title: article.title || "",
      content: article.content || article.preview || "",
      question,
      history,
    }, studioUserId());
  } catch (e) {
    console.log("answerAI failed, using local fallback:", e);
    return answer(article, question);
  }
}
