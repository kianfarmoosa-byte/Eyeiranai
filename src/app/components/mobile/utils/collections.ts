/**
 * Lightweight bookmark "collections" — user-defined folders for saved
 * articles. An article can belong to multiple collections. Storage is
 * localStorage; no backend.
 */

const KEY = "kian.mobile.collections";

export type Collection = {
  id: string;
  name: string;
  emoji: string;
  createdAt: number;
  /** Article IDs included in this collection. */
  items: string[];
};

type Store = { collections: Collection[] };

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { collections: [] };
}

function save(s: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export function loadCollections(): Collection[] {
  return load().collections;
}

export function createCollection(name: string, emoji = "📚"): Collection {
  const c: Collection = {
    id: `col_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || "بدون نام",
    emoji,
    createdAt: Date.now(),
    items: [],
  };
  const s = load();
  s.collections.unshift(c);
  save(s);
  return c;
}

export function renameCollection(id: string, name: string, emoji?: string) {
  const s = load();
  const c = s.collections.find((x) => x.id === id);
  if (!c) return;
  c.name = name.trim() || c.name;
  if (emoji) c.emoji = emoji;
  save(s);
}

export function deleteCollection(id: string) {
  const s = load();
  s.collections = s.collections.filter((c) => c.id !== id);
  save(s);
}

export function toggleArticleInCollection(collectionId: string, articleId: string): boolean {
  const s = load();
  const c = s.collections.find((x) => x.id === collectionId);
  if (!c) return false;
  const i = c.items.indexOf(articleId);
  if (i >= 0) { c.items.splice(i, 1); save(s); return false; }
  c.items.unshift(articleId);
  save(s);
  return true;
}

export function collectionsForArticle(articleId: string): string[] {
  return load().collections.filter((c) => c.items.includes(articleId)).map((c) => c.id);
}
