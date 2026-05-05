import type { Article } from "./data";

const DB_NAME = "rss-reader";
const DB_VERSION = 1;
const STORE = "articles";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "id" });
        s.createIndex("category", "category", { unique: false });
        s.createIndex("cachedAt", "cachedAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | Promise<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const s = t.objectStore(STORE);
    const req = fn(s);
    if (req instanceof IDBRequest) {
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    } else {
      Promise.resolve(req).then(resolve, reject);
    }
  });
}

export const offlineCache = {
  async saveBatch(articles: Article[]) {
    if (!articles.length) return;
    const db = await open();
    const t = db.transaction(STORE, "readwrite");
    const s = t.objectStore(STORE);
    const now = Date.now();
    for (const a of articles) s.put({ ...a, cachedAt: now });
    return new Promise<void>((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  },

  async getAll(): Promise<Article[]> {
    return tx<Article[]>("readonly", s => s.getAll() as IDBRequest<Article[]>);
  },

  async get(id: string): Promise<Article | undefined> {
    return tx<Article | undefined>("readonly", s => s.get(id) as IDBRequest<Article | undefined>);
  },

  async remove(id: string) {
    return tx<void>("readwrite", s => s.delete(id) as any);
  },

  async prune(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
    const db = await open();
    const t = db.transaction(STORE, "readwrite");
    const cutoff = Date.now() - maxAgeMs;
    const idx = t.objectStore(STORE).index("cachedAt");
    const range = IDBKeyRange.upperBound(cutoff);
    idx.openCursor(range).onsuccess = (e) => {
      const cur = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cur) { cur.delete(); cur.continue(); }
    };
    return new Promise<void>((resolve) => { t.oncomplete = () => resolve(); });
  },
};
