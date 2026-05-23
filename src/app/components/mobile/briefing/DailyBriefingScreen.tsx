import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Radio, Headphones, Square, Gauge } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { ImageWithFallback } from "../../figma/ImageWithFallback";
import { useTTS, useHaptics } from "../hooks";
import { faNum, timeAgoFa, countFa } from "../utils/fa";
import { summarize } from "../ai/summarize";
import type { Article } from "../../../data";

type Props = {
  articles: Article[];
  onClose: () => void;
  onOpenArticle?: (a: Article) => void;
};

/**
 * "خلاصهٔ صوتی روز" — auto-narrated playlist of the top stories using TTS.
 * Generates a 2-sentence brief per article (title + tldr) and walks the queue.
 */
export function DailyBriefingScreen({ articles, onClose, onOpenArticle }: Props) {
  const tts = useTTS();
  const haptic = useHaptics();
  const [idx, setIdx] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const advanceRef = useRef(autoAdvance);
  useEffect(() => { advanceRef.current = autoAdvance; }, [autoAdvance]);

  const queue = useMemo(() => {
    return [...articles]
      .filter((a) => a.content || a.preview)
      .sort((a, b) => Number(b.publishedAt ?? 0) - Number(a.publishedAt ?? 0))
      .slice(0, 10);
  }, [articles]);

  const current = queue[idx];
  const brief = useMemo(() => {
    if (!current) return "";
    const s = summarize(current);
    return `${current.title}. ${s.tldr}`;
  }, [current]);

  const totalMinutes = useMemo(() => {
    return Math.max(1, Math.round(queue.reduce((acc, a) => acc + summarize(a).readingMinutes, 0) / 3));
  }, [queue]);

  // Drive TTS for the current item; auto-advance when speech ends.
  useEffect(() => {
    if (!brief || !tts.supported) return;
    if (tts.state === "idle") return;
    speakNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // Hook into native TTS onend: when state flips from playing → idle, advance.
  const prevStateRef = useRef(tts.state);
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = tts.state;
    if (prev === "playing" && tts.state === "idle" && advanceRef.current && idx < queue.length - 1) {
      setIdx((i) => i + 1);
    }
  }, [tts.state, idx, queue.length]);

  const speakNow = () => { if (current) tts.speak(brief); };

  const togglePlay = () => {
    haptic("tap");
    if (tts.state === "playing") tts.pause();
    else if (tts.state === "paused") tts.resume();
    else speakNow();
  };

  const skip = (dir: 1 | -1) => {
    haptic("select");
    tts.stop();
    setIdx((i) => Math.max(0, Math.min(queue.length - 1, i + dir)));
    setTimeout(speakNow, 60);
  };

  const setRate = (r: number) => { tts.setRate(r); if (tts.state !== "idle") speakNow(); };

  useEffect(() => () => tts.stop(), []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MobileScreen
      topbar={
        <MobileTopBar
          title="خلاصهٔ صوتی روز"
          subtitle={`${countFa(queue.length, "تیتر")} · حدود ${faNum(totalMinutes)} دقیقه`}
          onBack={onClose}
        />
      }
    >
      <div className="h-full overflow-y-auto scrollbar-none">
        {/* Hero — current item */}
        <section className="relative h-[300px] text-white overflow-hidden"
                 style={{ background: "linear-gradient(160deg, #312E81 0%, #6366F1 55%, #0EA5E9 100%)" }}>
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: "radial-gradient(120% 80% at 20% 10%, rgba(255,255,255,0.25) 0%, transparent 60%)" }} />
          {current?.image && (
            <ImageWithFallback
              src={current.image}
              alt=""
              className="absolute inset-0 size-full object-cover opacity-25"
            />
          )}
          <div className="absolute inset-0 bg-black/15" />

          <div className="absolute inset-x-0 top-0 pt-3 px-4 flex items-center gap-2">
            <span className="size-2 rounded-full bg-rose-400 animate-pulse" />
            <span className="text-[11px] font-bold tracking-wider">رادیو کیان</span>
            <span className="text-[11px] text-white/80">· پخش زنده از فید شما</span>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-5 pb-6">
            <div className="text-[11.5px] text-white/85 mb-1.5">
              {current?.source} · {current?.publishedAt ? timeAgoFa(current.publishedAt) : ""}
            </div>
            <h1 className="text-[22px] font-black leading-tight line-clamp-3 drop-shadow-[0_2px_10px_rgba(0,0,0,0.4)]">
              {current?.title ?? "خبری برای پخش نیست"}
            </h1>
          </div>
        </section>

        {/* Player */}
        <section className="-mt-4 mx-3 rounded-[var(--radius-xl)] bg-[var(--card)] border border-[var(--border-subtle)] p-4 shadow-[var(--shadow-md)]">
          {/* Progress */}
          <div className="flex items-center gap-2 text-[10.5px] text-[var(--foreground-subtle)] mb-2">
            <span className="tabular-nums">{faNum(idx + 1)} / {faNum(queue.length)}</span>
            <div className="flex-1 h-1 rounded-full bg-[var(--background-muted)] overflow-hidden">
              <div
                className="h-full bg-[var(--brand-500)] transition-[width] duration-300"
                style={{ width: `${queue.length ? ((idx + 1) / queue.length) * 100 : 0}%` }}
              />
            </div>
            <Headphones className="size-3.5" />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 mt-1">
            <button onClick={() => skip(-1)} disabled={idx === 0}
                    className="size-11 grid place-items-center rounded-full tap press disabled:opacity-30 bg-[var(--background-muted)]">
              <SkipBack className="size-5" />
            </button>
            <button onClick={togglePlay}
                    disabled={!tts.supported || queue.length === 0}
                    className="size-16 grid place-items-center rounded-full tap press text-white shadow-[0_10px_24px_-10px_rgba(99,102,241,0.55)] disabled:opacity-40"
                    style={{ background: "linear-gradient(160deg, #6366F1 0%, #312E81 100%)" }}>
              {tts.state === "playing" ? <Pause className="size-7" /> : <Play className="size-7 mr-1" />}
            </button>
            <button onClick={() => skip(1)} disabled={idx >= queue.length - 1}
                    className="size-11 grid place-items-center rounded-full tap press disabled:opacity-30 bg-[var(--background-muted)]">
              <SkipForward className="size-5" />
            </button>
          </div>

          {tts.state !== "idle" && (
            <div className="mt-3 flex justify-center">
              <button onClick={() => { tts.stop(); haptic("tap"); }}
                      className="h-8 px-3 rounded-full text-[12px] inline-flex items-center gap-1.5 bg-rose-500/10 text-rose-500 tap press">
                <Square className="size-3.5" />
                توقف کامل
              </button>
            </div>
          )}

          {/* Rate + auto-advance */}
          <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Gauge className="size-3.5 text-[var(--foreground-subtle)]" />
              <span className="text-[11px] text-[var(--foreground-muted)]">سرعت</span>
              {[0.85, 1, 1.25, 1.5].map((r) => (
                <button key={r} onClick={() => setRate(r)}
                        className={`h-7 px-2 rounded-full text-[11px] font-semibold tap press tabular-nums ${
                          tts.rate === r ? "bg-[var(--brand-500)] text-white" : "bg-[var(--background-muted)] text-[var(--foreground-muted)]"
                        }`}>
                  {faNum(r)}×
                </button>
              ))}
            </div>
            <label className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--foreground-muted)] tap">
              <input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)}
                     className="accent-[var(--brand-500)] size-3.5" />
              ادامهٔ خودکار
            </label>
          </div>

          {!tts.supported && (
            <div className="mt-3 text-[11.5px] text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
              مرورگر شما از پخش صوتی پشتیبانی نمی‌کند.
            </div>
          )}
        </section>

        {/* Queue */}
        <section className="mt-5 mb-6">
          <header className="flex items-center gap-1.5 px-4 mb-2">
            <Radio className="size-3.5 text-[var(--brand-500)]" />
            <h3 className="text-[12.5px] font-bold">صف پخش</h3>
            <span className="text-[11px] text-[var(--foreground-subtle)]">· {countFa(queue.length, "آیتم")}</span>
          </header>
          <ol className="mx-3 rounded-[var(--radius-lg)] bg-[var(--card)] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
            {queue.map((a, i) => {
              const active = i === idx;
              return (
                <li key={a.id}>
                  <button
                    onClick={() => { tts.stop(); setIdx(i); setTimeout(speakNow, 60); }}
                    className={`w-full text-right flex items-center gap-3 px-3 py-2.5 tap press ${
                      active ? "bg-[var(--brand-500)]/8" : ""
                    }`}
                  >
                    <span className={`size-7 rounded-full grid place-items-center text-[11px] font-bold ${
                      active ? "bg-[var(--brand-500)] text-white" : "bg-[var(--background-muted)] text-[var(--foreground-muted)]"
                    }`}>
                      {faNum(i + 1)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[12.5px] leading-snug line-clamp-2 ${active ? "font-bold" : "font-medium"}`}>
                        {a.title}
                      </div>
                      <div className="text-[10.5px] text-[var(--foreground-subtle)] mt-0.5">
                        {a.sourceIcon} {a.source} · {timeAgoFa(a.publishedAt)}
                      </div>
                    </div>
                    {a.image && (
                      <ImageWithFallback src={a.image} alt="" className="size-10 rounded-md object-cover shrink-0" />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
          {current && onOpenArticle && (
            <div className="mx-3 mt-3">
              <button
                onClick={() => onOpenArticle(current)}
                className="w-full h-11 rounded-full border border-[var(--border-strong)] bg-[var(--card)] text-[13px] font-semibold tap press"
              >
                خواندن مقالهٔ کامل
              </button>
            </div>
          )}
        </section>
      </div>
    </MobileScreen>
  );
}
