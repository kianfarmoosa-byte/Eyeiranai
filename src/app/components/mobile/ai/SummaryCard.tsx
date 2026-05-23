import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, ChevronDown, RefreshCw, MessageSquareText, Clock } from "lucide-react";
import type { Article } from "../../../data";
import { summarize, streamText, type SummaryMode } from "./summarize";
import { useHaptics } from "../hooks";
import { faNum } from "../utils/fa";

type Props = {
  article: Article;
  onAsk?: () => void;
};

export function SummaryCard({ article, onAsk }: Props) {
  const haptic = useHaptics();
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<SummaryMode>("bullets");
  const [streamed, setStreamed] = useState<string>("");
  const [streaming, setStreaming] = useState<boolean>(false);
  const [token, setToken] = useState(0);

  const sum = useMemo(() => summarize(article), [article, token]);

  const target = mode === "tldr" ? sum.tldr : mode === "long" ? sum.long : "";
  useEffect(() => {
    if (mode === "bullets") { setStreamed(""); setStreaming(false); return; }
    let cancelled = false;
    setStreamed("");
    setStreaming(true);
    (async () => {
      for await (const ch of streamText(target, { chunkChars: 3, delayMs: 12 })) {
        if (cancelled) return;
        setStreamed((s) => s + ch);
      }
      if (!cancelled) setStreaming(false);
    })();
    return () => { cancelled = true; };
  }, [target, mode, token]);

  const regen = () => { haptic("select"); setToken((t) => t + 1); };

  return (
    <div className="ai-border ai-glow rounded-[var(--radius-xl)] bg-[var(--card)] overflow-hidden">
      <button
        onClick={() => { haptic("select"); setOpen((o) => !o); }}
        className="w-full flex items-center gap-2 px-3.5 py-3 tap press text-right"
        aria-expanded={open}
      >
        <span className="size-7 grid place-items-center rounded-full bg-gradient-to-br from-[var(--brand-400)] to-[var(--brand-600)] text-white shadow-[var(--shadow-sm)]">
          <Sparkles className="size-4" />
        </span>
        <span className="flex-1 min-w-0">
          <div className="text-[13.5px] font-semibold leading-tight">خلاصهٔ هوشمند</div>
          <div className="text-[11px] text-[var(--foreground-subtle)] mt-0.5 flex items-center gap-1.5">
            <Clock className="size-3" />
            <span>{faNum(sum.readingMinutes)} دقیقه مطالعه</span>
            {sum.entities.length > 0 && (
              <>
                <span>·</span>
                <span className="truncate">{sum.entities.slice(0, 3).join("، ")}</span>
              </>
            )}
          </div>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown className="size-4 text-[var(--foreground-subtle)]" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5 pt-1">
              <ModeTabs value={mode} onChange={(m) => { haptic("select"); setMode(m); }} />

              <div className="mt-3 min-h-[3rem] text-[14px] leading-[1.9] text-[var(--foreground)]">
                {mode === "bullets" ? (
                  <ul className="flex flex-col gap-1.5">
                    {sum.bullets.map((b, i) => (
                      <li
                        key={i}
                        style={{ ["--i" as string]: i }}
                        className="stagger-child flex gap-2"
                      >
                        <span className="mt-2 size-1.5 rounded-full bg-[var(--brand-500)] shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={streaming ? "ai-caret" : ""}>{streamed || (streaming ? "" : target)}</p>
                )}
              </div>

              {sum.entities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {sum.entities.map((e) => (
                    <span
                      key={e}
                      className="px-2 py-0.5 rounded-full text-[11px] bg-[var(--background-muted)] text-[var(--foreground-muted)] border border-[var(--border-subtle)]"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3.5 flex items-center gap-2">
                <button
                  onClick={onAsk}
                  className="flex-1 h-10 rounded-full bg-[var(--brand-500)] text-white text-[13px] font-semibold tap press flex items-center justify-center gap-1.5 active:bg-[var(--brand-600)]"
                >
                  <MessageSquareText className="size-4" />
                  پرسش از این مقاله
                </button>
                <button
                  onClick={regen}
                  aria-label="بازتولید"
                  className="size-10 rounded-full border border-[var(--border-subtle)] grid place-items-center tap press active:bg-[var(--accent)]"
                >
                  <RefreshCw className="size-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ModeTabs({ value, onChange }: { value: SummaryMode; onChange: (m: SummaryMode) => void }) {
  const tabs: { id: SummaryMode; label: string }[] = [
    { id: "tldr", label: "خط اول" },
    { id: "bullets", label: "بولت‌ها" },
    { id: "long", label: "بلند" },
  ];
  return (
    <div className="inline-flex p-0.5 rounded-full bg-[var(--background-muted)] border border-[var(--border-subtle)]">
      {tabs.map((t) => {
        const on = value === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`relative h-7 px-3 rounded-full text-[12px] font-medium tap ${
              on ? "text-white" : "text-[var(--foreground-muted)]"
            }`}
          >
            {on && (
              <motion.span
                layoutId="summary-mode-pill"
                className="absolute inset-0 rounded-full bg-[var(--brand-500)]"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
