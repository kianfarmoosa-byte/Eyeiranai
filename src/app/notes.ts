// Personal notes with [[wikilinks]] backlinks. localStorage-only.

export type Note = {
  id: string;
  title: string;
  body: string;
  articleIds: string[];      // notes can be linked to articles
  links: string[];           // [[Other Note Title]] resolved at read time
  createdAt: number;
  updatedAt: number;
};

const NK = "kn.notes";

export function loadNotes(): Note[] {
  try { return JSON.parse(localStorage.getItem(NK) || "[]"); } catch { return []; }
}

function save(arr: Note[]) {
  try { localStorage.setItem(NK, JSON.stringify(arr)); } catch {}
}

export function newNote(title = "یادداشت جدید"): Note {
  const n: Note = {
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title, body: "", articleIds: [], links: [],
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  const all = loadNotes();
  all.push(n);
  save(all);
  return n;
}

export function updateNote(id: string, patch: Partial<Note>) {
  const all = loadNotes().map(n => n.id === id
    ? { ...n, ...patch, links: patch.body !== undefined ? extractLinks(patch.body) : n.links, updatedAt: Date.now() }
    : n);
  save(all);
}

export function removeNote(id: string) {
  save(loadNotes().filter(n => n.id !== id));
}

export function linkArticle(noteId: string, articleId: string) {
  const all = loadNotes();
  const n = all.find(x => x.id === noteId);
  if (!n) return;
  if (!n.articleIds.includes(articleId)) n.articleIds.push(articleId);
  n.updatedAt = Date.now();
  save(all);
}

export function notesForArticle(articleId: string): Note[] {
  return loadNotes().filter(n => n.articleIds.includes(articleId));
}

export function extractLinks(body: string): string[] {
  const out = new Set<string>();
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out.add(m[1].trim());
  return [...out];
}

export type Backlink = { from: Note; matches: number };

export function backlinks(noteTitle: string): Backlink[] {
  const all = loadNotes();
  const t = noteTitle.toLowerCase().trim();
  const out: Backlink[] = [];
  for (const n of all) {
    if (n.title.toLowerCase().trim() === t) continue;
    const matches = n.links.filter(l => l.toLowerCase().trim() === t).length;
    if (matches > 0) out.push({ from: n, matches });
  }
  return out;
}

export function noteByTitle(title: string): Note | null {
  const t = title.toLowerCase().trim();
  return loadNotes().find(n => n.title.toLowerCase().trim() === t) || null;
}

export function unlinkArticle(noteId: string, articleId: string) {
  const all = loadNotes();
  const n = all.find(x => x.id === noteId);
  if (!n) return;
  n.articleIds = n.articleIds.filter(id => id !== articleId);
  n.updatedAt = Date.now();
  save(all);
}

export function appendHighlight(noteId: string, quote: string, articleTitle: string, articleId?: string) {
  const all = loadNotes();
  const n = all.find(x => x.id === noteId);
  if (!n) return;
  const block = `\n\n> ${quote.trim().replace(/\n+/g, "\n> ")}\n— [[${articleTitle}]]\n`;
  n.body = (n.body || "") + block;
  n.links = extractLinks(n.body);
  if (articleId && !n.articleIds.includes(articleId)) n.articleIds.push(articleId);
  n.updatedAt = Date.now();
  save(all);
}

export function backlinkCounts(): Record<string, number> {
  const all = loadNotes();
  const counts: Record<string, number> = {};
  for (const n of all) {
    for (const l of n.links) {
      const key = l.toLowerCase().trim();
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  const out: Record<string, number> = {};
  for (const n of all) {
    out[n.id] = counts[n.title.toLowerCase().trim()] || 0;
  }
  return out;
}

export function quotesForArticle(articleId: string): { note: Note; quotes: string[] }[] {
  const all = loadNotes();
  const out: { note: Note; quotes: string[] }[] = [];
  for (const n of all) {
    if (!n.articleIds.includes(articleId)) continue;
    const quotes: string[] = [];
    const re = /(?:^|\n)>\s?([\s\S]*?)(?=\n[^>\n]|\n*$)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(n.body))) {
      const q = m[1].split(/\n>\s?/).join(" ").trim();
      if (q) quotes.push(q);
    }
    if (quotes.length) out.push({ note: n, quotes });
  }
  return out;
}

export function exportMarkdown(): string {
  const all = loadNotes().sort((a, b) => a.title.localeCompare(b.title));
  return all.map(n => {
    const meta = `_به‌روز شده: ${new Date(n.updatedAt).toLocaleString("fa-IR")}_`;
    const articles = n.articleIds.length ? `\n\n**مقالات پیوسته:** ${n.articleIds.map(id => `\`${id}\``).join(", ")}` : "";
    return `# ${n.title || "بدون عنوان"}\n\n${meta}${articles}\n\n${n.body || ""}\n`;
  }).join("\n---\n\n");
}

const HK = "kn.highlights.lastNote";
export function getLastNoteId(): string | null {
  try { return localStorage.getItem(HK); } catch { return null; }
}
export function setLastNoteId(id: string) {
  try { localStorage.setItem(HK, id); } catch {}
}
