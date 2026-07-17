import type { NewsEdition } from "../../api";
import { contentTypeMeta } from "./newspackModel";

function fmtDate(ms: number) {
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "full", timeStyle: "short" }).format(new Date(ms));
  } catch {
    return "";
  }
}

// ── plain-text export ──
export function editionToPlainText(edition: NewsEdition): string {
  const lines: string[] = [];
  lines.push(`📰 ${edition.packTitle}`);
  lines.push(fmtDate(edition.generatedAt));
  if (edition.intro) lines.push("", edition.intro);
  for (const s of edition.sections) {
    lines.push("", `━━━ ${s.title} ━━━`);
    if (s.intro) lines.push(s.intro);
    if (s.items.length === 0) { lines.push("— مطلبی یافت نشد —"); continue; }
    s.items.forEach((it, i) => {
      lines.push("", `${i + 1}. ${it.title}`);
      if (s.itemLength !== "headline" && it.summary) lines.push(it.summary);
      const meta = [it.source, it.link].filter(Boolean).join(" — ");
      if (meta) lines.push(meta);
    });
  }
  return lines.join("\n");
}

// ── markdown export ──
export function editionToMarkdown(edition: NewsEdition): string {
  const lines: string[] = [];
  lines.push(`# ${edition.packTitle}`);
  lines.push(`*${fmtDate(edition.generatedAt)}*`);
  if (edition.intro) lines.push("", `> ${edition.intro}`);
  for (const s of edition.sections) {
    const meta = contentTypeMeta(s.contentType);
    lines.push("", `## ${meta.icon} ${s.title}`);
    if (s.intro) lines.push("", `_${s.intro}_`);
    if (s.items.length === 0) { lines.push("_مطلبی یافت نشد._"); continue; }
    s.items.forEach((it) => {
      const head = it.link ? `[${it.title}](${it.link})` : it.title;
      lines.push("", `### ${head}`);
      if (s.itemLength !== "headline" && it.summary) lines.push(it.summary);
      const badge = it.translated ? " · 🌐 ترجمه‌شده" : "";
      lines.push(`— ${it.source}${badge}`);
    });
  }
  return lines.join("\n");
}

// ── telegram/social HTML-lite text (for Studio publish) ──
export function editionToPublishText(edition: NewsEdition, opts?: { maxItemsPerSection?: number }): string {
  const cap = opts?.maxItemsPerSection ?? 5;
  const lines: string[] = [];
  lines.push(`📰 <b>${edition.packTitle}</b>`);
  lines.push(fmtDate(edition.generatedAt));
  if (edition.intro) lines.push("", edition.intro);
  for (const s of edition.sections) {
    const meta = contentTypeMeta(s.contentType);
    lines.push("", `${meta.icon} <b>${s.title}</b>`);
    if (s.intro) lines.push(`<i>${s.intro}</i>`);
    s.items.slice(0, cap).forEach((it, i) => {
      const t = it.link ? `<a href="${it.link}">${it.title}</a>` : it.title;
      lines.push(`${i + 1}. ${t}`);
      if (s.itemLength !== "headline" && it.summary) lines.push(it.summary);
    });
  }
  return lines.join("\n");
}

// ── printable standalone HTML ──
export function editionToPrintableHtml(edition: NewsEdition): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const sections = edition.sections.map((s) => {
    const meta = contentTypeMeta(s.contentType);
    const items = s.items.length === 0
      ? `<p class="empty">مطلبی یافت نشد.</p>`
      : s.items.map((it) => `
        <article>
          <h3>${it.link ? `<a href="${esc(it.link)}">${esc(it.title)}</a>` : esc(it.title)}</h3>
          ${s.itemLength !== "headline" && it.summary ? `<p>${esc(it.summary)}</p>` : ""}
          <div class="src">${esc(it.source)}${it.translated ? " · ترجمه‌شده" : ""}</div>
        </article>`).join("");
    const introHtml = s.intro ? `<p class="sintro">${esc(s.intro)}</p>` : "";
    return `<section><h2>${meta.icon} ${esc(s.title)}</h2>${introHtml}${items}</section>`;
  }).join("");
  return `<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8">
<title>${esc(edition.packTitle)}</title>
<style>
  body{font-family:Vazirmatn,Tahoma,system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;color:#0f172a;line-height:1.8}
  h1{font-size:1.9rem;margin:0}
  .date{color:#64748b;font-size:.9rem;margin-bottom:1.5rem}
  .intro{font-size:1.05rem;color:#334155;border-inline-start:3px solid #3b82f6;padding-inline-start:1rem;margin:1rem 0}
  h2{font-size:1.3rem;border-bottom:2px solid #e2e8f0;padding-bottom:.4rem;margin-top:2rem}
  article{padding:.6rem 0;border-bottom:1px solid #f1f5f9}
  article h3{font-size:1.05rem;margin:.2rem 0}
  a{color:#2563eb;text-decoration:none}
  .src{color:#94a3b8;font-size:.8rem}
  .empty{color:#94a3b8;font-style:italic}
  .sintro{color:#475569;font-style:italic;border-inline-start:2px solid #93c5fd;padding-inline-start:.6rem;margin:.4rem 0}
  @media print{body{margin:0}}
</style></head><body>
  <h1>${esc(edition.packTitle)}</h1>
  <div class="date">${fmtDate(edition.generatedAt)}</div>
  ${edition.intro ? `<div class="intro">${esc(edition.intro)}</div>` : ""}
  ${sections}
</body></html>`;
}

export function printEdition(edition: NewsEdition) {
  const html = editionToPrintableHtml(edition);
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 400);
}

// ── visual theme styling for EditionViewer ──
export type ThemeStyle = {
  layout: "list" | "cards" | "compact";
  article: string;
  title: string;
  intro: string;
  sectionHeader: string;
  sectionTitle: string;
  itemsWrap: string;
  item: string;
  itemTitle: string;
  itemSummary: string;
};

export const THEME_STYLES: Record<string, ThemeStyle> = {
  editorial: {
    layout: "list",
    article: "space-y-6 font-serif",
    title: "text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 border-b-4 border-slate-900 dark:border-slate-100 pb-2",
    intro: "text-slate-700 dark:text-slate-300 leading-8 italic",
    sectionHeader: "flex items-center gap-2 border-b border-slate-300 dark:border-slate-600 pb-1.5",
    sectionTitle: "text-xl font-bold text-slate-900 dark:text-slate-100 uppercase",
    itemsWrap: "divide-y divide-slate-200 dark:divide-slate-700",
    item: "block py-3 group",
    itemTitle: "font-bold text-slate-900 dark:text-slate-100 leading-7 group-hover:underline",
    itemSummary: "mt-1 text-sm text-slate-600 dark:text-slate-300 leading-7",
  },
  modern: {
    layout: "cards",
    article: "space-y-6",
    title: "text-2xl font-extrabold text-slate-900 dark:text-slate-100",
    intro: "text-slate-600 dark:text-slate-300 leading-7",
    sectionHeader: "flex items-center gap-2",
    sectionTitle: "text-lg font-bold text-blue-700 dark:text-blue-300",
    itemsWrap: "grid gap-3 sm:grid-cols-2",
    item: "block rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all",
    itemTitle: "font-semibold text-slate-900 dark:text-slate-100 leading-6",
    itemSummary: "mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-6",
  },
  minimal: {
    layout: "list",
    article: "space-y-8",
    title: "text-2xl font-light text-slate-900 dark:text-slate-100",
    intro: "text-slate-500 dark:text-slate-400 leading-7",
    sectionHeader: "",
    sectionTitle: "text-sm font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500",
    itemsWrap: "space-y-4 mt-3",
    item: "block group",
    itemTitle: "text-slate-900 dark:text-slate-100 leading-7 group-hover:text-blue-600",
    itemSummary: "mt-1 text-sm text-slate-500 dark:text-slate-400 leading-7",
  },
  magazine: {
    layout: "cards",
    article: "space-y-8",
    title: "text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100",
    intro: "text-lg text-slate-600 dark:text-slate-300 leading-8",
    sectionHeader: "flex items-center gap-2 border-b-2 border-rose-500 pb-1.5",
    sectionTitle: "text-2xl font-extrabold text-slate-900 dark:text-slate-100",
    itemsWrap: "grid gap-4 sm:grid-cols-2",
    item: "block rounded-xl bg-slate-50 dark:bg-slate-800/60 p-5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
    itemTitle: "text-lg font-bold text-slate-900 dark:text-slate-100 leading-7",
    itemSummary: "mt-2 text-sm text-slate-600 dark:text-slate-300 leading-7",
  },
  brief: {
    layout: "compact",
    article: "space-y-4",
    title: "text-xl font-bold text-slate-900 dark:text-slate-100",
    intro: "text-sm text-slate-600 dark:text-slate-300",
    sectionHeader: "flex items-center gap-2",
    sectionTitle: "text-sm font-bold text-slate-700 dark:text-slate-200",
    itemsWrap: "space-y-1",
    item: "flex items-baseline gap-2 py-1 group",
    itemTitle: "text-sm text-slate-800 dark:text-slate-200 leading-6 group-hover:text-blue-600",
    itemSummary: "text-xs text-slate-500 dark:text-slate-400",
  },
};

export const themeStyle = (id: string): ThemeStyle => THEME_STYLES[id] || THEME_STYLES.editorial;
