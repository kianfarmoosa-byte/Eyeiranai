import { useMemo, useState } from "react";
import { BookmarkX, FolderPlus, Folder, X, Trash2 } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { ArticleCard } from "../cards/ArticleCard";
import { EmptyState } from "../primitives/EmptyState";
import { VirtualList } from "../primitives/VirtualList";
import { countFa } from "../utils/fa";
import {
  loadCollections, createCollection, deleteCollection, type Collection,
} from "../utils/collections";
import { useHaptics } from "../hooks";
import type { Article } from "../../../data";

type Sort = "newest" | "oldest" | "source";

type Props = {
  articles: Article[];
  onOpen: (a: Article) => void;
  onToggleSave: (a: Article) => void;
  onLongPress?: (a: Article) => void;
};

const ROW_H = 132;
const VIRTUALIZE_AT = 40;

const EMOJI_POOL = ["📚", "⭐", "🔥", "💡", "🌍", "🎯", "🧠", "🎨", "🏛️", "💼"];

export function SavedScreen({ articles, onOpen, onToggleSave, onLongPress }: Props) {
  const [sort, setSort] = useState<Sort>("newest");
  const [collections, setCollections] = useState<Collection[]>(() => loadCollections());
  const [activeCol, setActiveCol] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const haptic = useHaptics();

  const refreshCollections = () => setCollections(loadCollections());

  const saved = useMemo(() => {
    let s = articles.filter((a) => a.starred);
    if (activeCol) {
      const col = collections.find((c) => c.id === activeCol);
      const set = new Set(col?.items ?? []);
      s = s.filter((a) => set.has(a.id));
    }
    if (sort === "newest") return [...s].sort((a, b) => (b.dateMs ?? 0) - (a.dateMs ?? 0));
    if (sort === "oldest") return [...s].sort((a, b) => (a.dateMs ?? 0) - (b.dateMs ?? 0));
    return [...s].sort((a, b) => a.source.localeCompare(b.source, "fa"));
  }, [articles, sort, activeCol, collections]);

  const createNow = () => {
    if (!newName.trim()) return;
    haptic("select");
    const emoji = EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)];
    createCollection(newName, emoji);
    setNewName("");
    setCreating(false);
    refreshCollections();
  };

  const removeCol = (id: string) => {
    haptic("heavy");
    deleteCollection(id);
    if (activeCol === id) setActiveCol(null);
    refreshCollections();
  };

  const header = (
    <div className="pt-3">
      {/* Collection chips */}
      <div className="px-3 pb-2 overflow-x-auto scrollbar-none">
        <div className="inline-flex items-center gap-1.5 min-w-full">
          <ColChip
            active={!activeCol}
            label="همه"
            emoji="🔖"
            onClick={() => { haptic("tap"); setActiveCol(null); }}
          />
          {collections.map((c) => (
            <ColChip
              key={c.id}
              active={activeCol === c.id}
              label={c.name}
              emoji={c.emoji}
              count={c.items.length}
              onClick={() => { haptic("tap"); setActiveCol(c.id); }}
              onLongPress={() => removeCol(c.id)}
            />
          ))}
          <button
            onClick={() => { haptic("tap"); setCreating(true); }}
            className="h-9 px-3 rounded-full bg-[var(--background-muted)] border border-dashed border-[var(--border-subtle)] text-[12px] tap press inline-flex items-center gap-1 shrink-0"
          >
            <FolderPlus className="size-3.5" /> مجموعهٔ تازه
          </button>
        </div>
      </div>

      {creating && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--brand-500)]/40 px-3 py-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") createNow(); }}
            placeholder="نام مجموعه..."
            className="flex-1 bg-transparent outline-none text-[13px]"
            autoFocus
          />
          <button
            onClick={createNow}
            className="h-8 px-3 rounded-full bg-[var(--brand-500)] text-white text-[12px] font-bold tap press"
          >
            افزودن
          </button>
          <button
            onClick={() => { setCreating(false); setNewName(""); }}
            aria-label="انصراف"
            className="size-8 grid place-items-center rounded-full text-[var(--foreground-muted)] tap"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Sort row */}
      <div className="px-3 flex gap-2">
        {(["newest", "oldest", "source"] as Sort[]).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`h-9 px-3.5 rounded-full text-[12.5px] tap press border ${
              sort === s ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]"
                         : "bg-[var(--surface)] border-[var(--border-subtle)]"
            }`}
          >
            {s === "newest" ? "جدیدترین" : s === "oldest" ? "قدیمی‌ترین" : "بر اساس منبع"}
          </button>
        ))}
      </div>
    </div>
  );

  const renderRow = (a: Article) => (
    <div className="px-3">
      <div className="border-b border-[var(--border-subtle)] bg-[var(--surface)]">
        <ArticleCard article={a} onOpen={onOpen} onToggleSave={onToggleSave} onLongPress={onLongPress} />
      </div>
    </div>
  );

  const subtitle = activeCol
    ? `${collections.find((c) => c.id === activeCol)?.name ?? ""} · ${countFa(saved.length, "مقاله")}`
    : countFa(saved.length, "مقاله");

  return (
    <MobileScreen
      topbar={<MobileTopBar title="ذخیره‌شده‌ها" subtitle={subtitle} />}
    >
      {saved.length === 0 ? (
        <div className="h-full overflow-y-auto scrollbar-none">
          {header}
          <EmptyState
            icon={activeCol ? <Folder className="size-6" /> : <BookmarkX className="size-6" />}
            title={activeCol ? "این مجموعه خالی است" : "هنوز چیزی ذخیره نکرده‌ای"}
            description={activeCol
              ? "از کارت هر مقاله و منوی Long-press، آن را به این مجموعه اضافه کن."
              : "با لمس آیکن نشانک روی هر مقاله، اون رو برای مطالعه بعدی نگه دار."}
          />
        </div>
      ) : saved.length >= VIRTUALIZE_AT ? (
        <VirtualList
          items={saved}
          rowHeight={ROW_H}
          renderItem={renderRow}
          keyFor={(a) => a.id}
          header={header}
          className="h-full"
        />
      ) : (
        <div className="h-full overflow-y-auto scrollbar-none">
          {header}
          <div className="mt-3 px-3 pb-4">
            <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-subtle)]">
              {saved.map((a) => (
                <ArticleCard key={a.id} article={a} onOpen={onOpen} onToggleSave={onToggleSave} onLongPress={onLongPress} />
              ))}
            </div>
          </div>
        </div>
      )}
    </MobileScreen>
  );
}

function ColChip({
  active, label, emoji, count, onClick, onLongPress,
}: {
  active: boolean; label: string; emoji: string; count?: number;
  onClick: () => void; onLongPress?: () => void;
}) {
  // Inline long-press without importing the hook to keep this file self-contained
  let timer: number | undefined;
  const startLp = () => {
    if (!onLongPress) return;
    timer = window.setTimeout(() => onLongPress(), 600);
  };
  const cancelLp = () => { if (timer) { clearTimeout(timer); timer = undefined; } };

  return (
    <button
      onClick={onClick}
      onPointerDown={startLp}
      onPointerUp={cancelLp}
      onPointerLeave={cancelLp}
      onPointerCancel={cancelLp}
      className={`h-9 px-3.5 rounded-full text-[12.5px] tap press border inline-flex items-center gap-1.5 shrink-0 ${
        active
          ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]"
          : "bg-[var(--surface)] border-[var(--border-subtle)]"
      }`}
    >
      <span>{emoji}</span>
      <span className="font-medium">{label}</span>
      {count !== undefined && (
        <span className={`text-[10.5px] tabular-nums ${active ? "text-white/70" : "text-[var(--foreground-subtle)]"}`}>
          {count.toLocaleString("fa-IR")}
        </span>
      )}
    </button>
  );
}
