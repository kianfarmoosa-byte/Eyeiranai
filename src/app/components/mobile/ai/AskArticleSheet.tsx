import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { BottomSheet } from "../primitives/BottomSheet";
import { useHaptics } from "../hooks";
import { answerAI, streamText } from "./summarize";
import type { Article } from "../../../data";

type Turn = { role: "user" | "ai"; text: string; streaming?: boolean };

type Props = {
  open: boolean;
  onClose: () => void;
  article: Article | null;
  /** When provided and the sheet opens, auto-ask this question. */
  prefill?: string;
};

const SUGGESTIONS = [
  "خلاصه‌ای در یک پاراگراف بده.",
  "نکات کلیدی چیست؟",
  "چه کسانی در این خبر نقش دارند؟",
  "چرا این مهم است؟",
];

export function AskArticleSheet({ open, onClose, article, prefill }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const haptic = useHaptics();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setTurns([]);
  }, [open, article?.id]);

  useEffect(() => {
    if (open && prefill && article) {
      ask(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill, article?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const ask = async (q: string) => {
    if (!article || !q.trim()) return;
    haptic("select");
    setInput("");
    // Snapshot prior conversation for context before adding the new turns.
    const history = turns
      .filter((t) => t.text.trim())
      .map((t) => ({ role: t.role, text: t.text }));
    const userTurn: Turn = { role: "user", text: q.trim() };
    const aiTurn: Turn = { role: "ai", text: "", streaming: true };
    setTurns((t) => [...t, userTurn, aiTurn]);
    const full = await answerAI(article, q.trim(), history);
    let acc = "";
    for await (const ch of streamText(full, { chunkChars: 3, delayMs: 12 })) {
      acc += ch;
      setTurns((t) => {
        const copy = [...t];
        copy[copy.length - 1] = { role: "ai", text: acc, streaming: true };
        return copy;
      });
    }
    setTurns((t) => {
      const copy = [...t];
      copy[copy.length - 1] = { role: "ai", text: acc, streaming: false };
      return copy;
    });
    haptic("success");
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="پرسش از مقاله"
      snap="auto"
      snapPoints={[0.6, 0.95]}
    >
      <div className="flex flex-col h-full">
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none px-4 py-3">
          {turns.length === 0 ? (
            <div className="flex flex-col items-center text-center gap-3 pt-4">
              <div className="size-12 grid place-items-center rounded-full bg-gradient-to-br from-[var(--brand-400)] to-[var(--brand-600)] text-white shadow-[var(--shadow-md)]">
                <Sparkles className="size-5" />
              </div>
              <div>
                <div className="text-[14px] font-semibold">هرچی می‌خوای دربارهٔ این مقاله بپرس</div>
                <div className="text-[12px] text-[var(--foreground-subtle)] mt-1">
                  پاسخ‌ها بر اساس متن این مقاله ساخته می‌شن.
                </div>
              </div>
              <div className="mt-2 w-full flex flex-col gap-1.5">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={s}
                    style={{ ["--i" as string]: i }}
                    onClick={() => ask(s)}
                    className="stagger-child text-right px-3.5 py-2.5 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] tap press text-[13px] active:bg-[var(--accent)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {turns.map((t, i) => (
                <Bubble key={i} turn={t} />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--border-subtle)] bg-[var(--background)]" style={{ paddingBottom: "var(--safe-bottom)" }}>
          <div className="px-3 py-2 flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); }
              }}
              placeholder="پرسش بنویس..."
              rows={1}
              className="flex-1 max-h-28 resize-none bg-[var(--background-muted)] rounded-[var(--radius-lg)] px-3 py-2 text-[14px] outline-none border border-[var(--border-subtle)] focus:border-[var(--brand-500)]"
            />
            <button
              onClick={() => ask(input)}
              disabled={!input.trim()}
              aria-label="ارسال"
              className="size-10 rounded-full grid place-items-center bg-[var(--brand-500)] text-white tap press disabled:opacity-40 active:bg-[var(--brand-600)]"
            >
              <Send className="size-4 -scale-x-100" />
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}

function Bubble({ turn }: { turn: Turn }) {
  const isUser = turn.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] px-3.5 py-2.5 rounded-[var(--radius-lg)] text-[13.5px] leading-[1.85] ${
          isUser
            ? "bg-[var(--brand-500)] text-white rounded-tr-sm"
            : "bg-[var(--background-muted)] text-[var(--foreground)] border border-[var(--border-subtle)] rounded-tl-sm"
        } ${turn.streaming ? "ai-caret" : ""}`}
      >
        {turn.text || (turn.streaming ? "" : " ")}
      </div>
    </div>
  );
}
