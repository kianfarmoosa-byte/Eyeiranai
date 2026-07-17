import { ExternalLink, Languages, Clock, Pin, PinOff, ChevronUp, ChevronDown } from "lucide-react";
import type { NewsEdition, EditionSection, EditionItem } from "../../api";
import { contentTypeMeta } from "./newspackModel";
import { themeStyle, type ThemeStyle } from "./editionFormat";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { faNum, timeAgoFa } from "../mobile/utils/fa";

function fmtDate(ms: number) {
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "full", timeStyle: "short" }).format(new Date(ms));
  } catch {
    return "";
  }
}

// pinned items float to the top (stable).
function displayOrder(items: EditionItem[]): EditionItem[] {
  return [...items].sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1));
}

type ItemControls = {
  onPin: () => void;
  onMove: (dir: -1 | 1) => void;
  canUp: boolean;
  canDown: boolean;
};

function Item({ item, itemLength, st, controls }: { item: EditionItem; itemLength: string; st: ThemeStyle; controls?: ItemControls }) {
  const compact = st.layout === "compact";
  return (
    <div className={item.pinned && !compact ? "rounded-lg ring-1 ring-amber-300/70 dark:ring-amber-500/40 bg-amber-50/40 dark:bg-amber-900/10" : ""}>
      <a href={item.link || undefined} target="_blank" rel="noreferrer" className={st.item}>
        {compact && <span className="text-slate-300 dark:text-slate-600 shrink-0">{item.pinned ? "📌" : "•"}</span>}
        {!compact && item.image && (
          <ImageWithFallback
            src={item.image}
            alt={item.title}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover shrink-0 bg-slate-100 dark:bg-slate-800"
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <h4 className={st.itemTitle}>
              {item.pinned && !compact && <Pin className="inline w-3.5 h-3.5 text-amber-500 -mt-0.5 ms-1" />}
              {item.title}
            </h4>
            {!compact && <ExternalLink className="w-4 h-4 shrink-0 mt-1 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
          </span>
          {itemLength !== "headline" && item.summary && <p className={st.itemSummary}>{item.summary}</p>}
          <span className="mt-1.5 flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              {item.sourceIcon && <span>{item.sourceIcon}</span>}
              {item.source}
            </span>
            {item.publishedAt > 0 && !compact && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgoFa(item.publishedAt)}</span>
              </>
            )}
            {item.translated && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5">
                <Languages className="w-3 h-3" />ترجمه‌شده{item.originalLang ? ` از ${item.originalLang}` : ""}
              </span>
            )}
          </span>
        </span>
      </a>
      {controls && (
        <div className="flex items-center gap-1 px-2 pb-1.5 -mt-1">
          <button
            onClick={controls.onPin}
            title={item.pinned ? "برداشتن پین" : "پین کردن"}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${item.pinned ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
          >
            {item.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            {item.pinned ? "پین‌شده" : "پین"}
          </button>
          <button onClick={() => controls.onMove(-1)} disabled={!controls.canUp} className="p-1 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
          <button onClick={() => controls.onMove(1)} disabled={!controls.canDown} className="p-1 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}

function SectionBlock({ section, st, editable, onSectionChange }: {
  section: EditionSection;
  st: ThemeStyle;
  editable?: boolean;
  onSectionChange?: (next: EditionSection) => void;
}) {
  const meta = contentTypeMeta(section.contentType);
  const display = displayOrder(section.items);

  const applyOrder = (next: EditionItem[]) => onSectionChange?.({ ...section, items: next });

  const togglePin = (idx: number) => {
    const next = display.map((it, i) => (i === idx ? { ...it, pinned: !it.pinned } : it));
    applyOrder(displayOrder(next));
  };
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= display.length) return;
    // only allow reordering within the same pin-group so pinned stay on top
    if (display[idx].pinned !== display[j].pinned) return;
    const next = [...display];
    [next[idx], next[j]] = [next[j], next[idx]];
    applyOrder(next);
  };

  return (
    <section className="space-y-3">
      <div className={st.sectionHeader}>
        <span className="text-lg">{meta.icon}</span>
        <h3 className={st.sectionTitle}>{section.title}</h3>
        <span className="text-xs rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5">{meta.label}</span>
        <span className="ms-auto text-xs text-slate-400">{faNum(section.items.length)} مطلب</span>
      </div>
      {section.intro && (
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-7 border-s-2 border-emerald-400/70 dark:border-emerald-500/50 ps-3 italic">
          {section.intro}
        </p>
      )}
      {section.items.length === 0 ? (
        <p className="text-sm text-slate-400 italic">مطلبی در این بازهٔ زمانی یافت نشد.</p>
      ) : (
        <div className={st.itemsWrap}>
          {display.map((it, i) => (
            <Item
              key={`${section.id}_${it.link || it.title}_${i}`}
              item={it}
              itemLength={section.itemLength}
              st={st}
              controls={editable ? {
                onPin: () => togglePin(i),
                onMove: (dir) => move(i, dir),
                canUp: i > 0 && display[i - 1]?.pinned === it.pinned,
                canDown: i < display.length - 1 && display[i + 1]?.pinned === it.pinned,
              } : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function EditionViewer({ edition, theme, editable, onChange }: {
  edition: NewsEdition;
  theme?: string;
  editable?: boolean;
  onChange?: (next: NewsEdition) => void;
}) {
  const st = themeStyle(theme || edition.theme);
  const updateSection = (next: EditionSection) => {
    onChange?.({ ...edition, sections: edition.sections.map((s) => (s.id === next.id ? next : s)) });
  };
  return (
    <article className={st.article}>
      <header className="space-y-1">
        <h2 className={st.title}>{edition.packTitle}</h2>
        {edition.intro && <p className={st.intro}>{edition.intro}</p>}
        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400 pt-1">
          <span>{fmtDate(edition.generatedAt)}</span>
          <span>·</span>
          <span>{faNum(edition.stats.items)} مطلب</span>
          <span>·</span>
          <span>{faNum(edition.stats.sections)} بخش</span>
          {edition.stats.translated > 0 && (
            <>
              <span>·</span>
              <span className="text-emerald-600 dark:text-emerald-400">{faNum(edition.stats.translated)} ترجمه‌شده</span>
            </>
          )}
        </div>
      </header>
      {edition.sections.map((s) => (
        <SectionBlock key={s.id} section={s} st={st} editable={editable} onSectionChange={updateSection} />
      ))}
    </article>
  );
}
