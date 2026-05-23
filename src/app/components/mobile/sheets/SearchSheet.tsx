import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Clock, ArrowUpLeft, Mic, MicOff, TrendingUp } from "lucide-react";
import { BottomSheet } from "../primitives/BottomSheet";
import { ArticleCard } from "../cards/ArticleCard";
import { useHaptics } from "../hooks";
import type { Article } from "../../../data";

const HISTORY_KEY = "kian.mobile.searchHistory";
const MAX_HISTORY = 8;

type Filter = "all" | "today" | "week" | "saved";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all",   label: "همه" },
  { id: "today", label: "امروز" },
  { id: "week",  label: "این هفته" },
  { id: "saved", label: "ذخیره‌شده" },
];

const DAY = 86_400_000;

// Lightweight Persian synonym map — improves recall on common queries.
const SYNONYMS: Record<string, string[]> = {
  "خودرو":   ["ماشین", "اتومبیل"],
  "ماشین":   ["خودرو", "اتومبیل"],
  "گوشی":    ["موبایل", "تلفن"],
  "موبایل":  ["گوشی", "تلفن"],
  "هوش مصنوعی": ["AI", "ai", "هوشمند"],
  "فوتبال":  ["تیم ملی"],
};

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveHistory(list: string[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY))); } catch {}
}

type Props = {
  open: boolean;
  onClose: () => void;
  articles: Article[];
  onOpenArticle: (a: Article) => void;
  onToggleSave?: (a: Article) => void;
};

export function SearchSheet({ open, onClose, articles, onOpenArticle, onToggleSave }: Props) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [history, setHistory] = useState<string[]>(() => loadHistory());
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recogRef = useRef<any>(null);
  const haptic = useHaptics();

  useEffect(() => {
    if (open) {
      setQ("");
      setFilter("all");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Speech recognition (webkit/standard) — Persian locale.
  const voiceSupported = typeof window !== "undefined" &&
    (("SpeechRecognition" in window) || ("webkitSpeechRecognition" in window));

  const toggleVoice = () => {
    if (!voiceSupported) return;
    haptic("select");
    if (listening) {
      try { recogRef.current?.stop(); } catch {}
      setListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "fa-IR";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let transcript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setQ(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recogRef.current = rec;
    rec.start();
    setListening(true);
  };

  // Build search terms (query + synonyms) and filter by date/saved state.
  const results = useMemo(() => {
    const s = q.trim();
    if (!s) return [];
    const terms = [s, ...(SYNONYMS[s] ?? [])].map((t) => t.toLowerCase());
    const now = Date.now();
    return articles
      .filter((a) => {
        const hay = `${a.title} ${a.preview} ${a.source} ${a.author} ${a.category} ${(a.tags ?? []).join(" ")}`.toLowerCase();
        if (!terms.some((t) => hay.includes(t))) return false;
        if (filter === "saved") return a.starred;
        if (filter === "today" && a.dateMs) return now - a.dateMs < DAY;
        if (filter === "week"  && a.dateMs) return now - a.dateMs < 7 * DAY;
        return true;
      })
      .slice(0, 40);
  }, [q, filter, articles]);

  // Trending: top-3 sources by article count
  const trending = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of articles) counts[a.source] = (counts[a.source] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s]) => s);
  }, [articles]);

  const commit = (term: string) => {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...history.filter((h) => h !== t)].slice(0, MAX_HISTORY);
    setHistory(next);
    saveHistory(next);
  };

  const removeHistory = (term: string) => {
    const next = history.filter((h) => h !== term);
    setHistory(next);
    saveHistory(next);
  };

  return (
    <BottomSheet open={open} onClose={onClose} snap="full" hideHandle>
      <div className="px-4 pt-2 pb-3 flex items-center gap-2 border-b border-[var(--border-subtle)]">
        <label className="flex-1 flex items-center gap-2 h-11 px-3 rounded-full bg-[var(--accent)]">
          <Search className="size-4 text-[var(--foreground-subtle)]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(q); }}
            inputMode="search"
            enterKeyHint="search"
            placeholder="جستجو در همه مقاله‌ها..."
            className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-[var(--foreground-subtle)]"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="پاک کردن" className="text-[var(--foreground-subtle)]">
              <X className="size-4" />
            </button>
          )}
          {voiceSupported && (
            <button
              onClick={toggleVoice}
              aria-label="جستجوی صوتی"
              className={`size-7 grid place-items-center rounded-full ${listening ? "bg-rose-500 text-white animate-pulse" : "text-[var(--brand-500)]"}`}
            >
              {listening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
            </button>
          )}
        </label>
        <button onClick={onClose} className="text-[13px] text-[var(--brand-500)] tap press px-1">انصراف</button>
      </div>

      {/* Filter chips */}
      <div className="px-3 py-2 flex gap-1.5 overflow-x-auto scrollbar-none border-b border-[var(--border-subtle)]">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 h-7 px-3 rounded-full text-[12px] font-medium tap press ${
              filter === f.id
                ? "bg-[var(--brand-500)] text-white"
                : "bg-[var(--background-muted)] text-[var(--foreground-muted)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {q.trim() === "" ? (
        <div className="py-2">
          {trending.length > 0 && (
            <>
              <div className="px-4 pt-3 pb-1.5 flex items-center gap-1.5">
                <TrendingUp className="size-3.5 text-[var(--brand-500)]" />
                <span className="text-[11px] font-semibold text-[var(--foreground-subtle)] uppercase tracking-wide">
                  پرطرفدار
                </span>
              </div>
              <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                {trending.map((t) => (
                  <button
                    key={t}
                    onClick={() => setQ(t)}
                    className="h-7 px-3 rounded-full bg-[var(--background-muted)] text-[12px] text-[var(--foreground-muted)] tap press"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}
          {history.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-[var(--foreground-subtle)]">
              جستجوی اخیری وجود ندارد
            </div>
          ) : (
            <>
              <div className="px-4 pt-2 pb-1 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[var(--foreground-subtle)] uppercase tracking-wide">
                  اخیر
                </span>
                <button
                  onClick={() => { setHistory([]); saveHistory([]); haptic("tap"); }}
                  className="text-[11px] text-[var(--brand-500)] tap"
                >
                  پاک کردن همه
                </button>
              </div>
              <ul>
                {history.map((h) => (
                  <li key={h} className="flex items-center">
                    <button
                      onClick={() => setQ(h)}
                      className="flex-1 tap press flex items-center gap-3 px-4 py-2.5 text-right"
                    >
                      <Clock className="size-4 text-[var(--foreground-subtle)]" />
                      <span className="flex-1 text-[14px] truncate">{h}</span>
                      <ArrowUpLeft className="size-4 text-[var(--foreground-subtle)]" />
                    </button>
                    <button
                      onClick={() => removeHistory(h)}
                      aria-label="حذف"
                      className="size-9 grid place-items-center text-[var(--foreground-subtle)] tap"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        <div className="pb-4">
          {results.length === 0 ? (
            <div className="px-4 py-12 text-center text-[13px] text-[var(--foreground-subtle)]">
              نتیجه‌ای برای «{q}» پیدا نشد
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {results.map((a) => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  variant="compact"
                  onOpen={(art) => { commit(q); onOpenArticle(art); onClose(); }}
                  onToggleSave={onToggleSave}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
