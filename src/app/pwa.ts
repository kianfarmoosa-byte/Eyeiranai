// Lightweight PWA support: registers an inline service worker for offline shell + caching.

const SW_SOURCE = `
const CACHE = 'kian-shell-v1';
const RUNTIME = 'kian-runtime-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE && k !== RUNTIME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Network-first for API calls, cache fallback
  if (url.pathname.includes('/functions/v1/make-server-')) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(RUNTIME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        const cached = await caches.match(req);
        if (cached) return cached;
        throw err;
      }
    })());
    return;
  }

  // Stale-while-revalidate for assets
  if (req.destination === 'image' || req.destination === 'style' || req.destination === 'script' || req.destination === 'font') {
    e.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const cached = await cache.match(req);
      const fetchPromise = fetch(req).then(r => { if (r && r.ok) cache.put(req, r.clone()); return r; }).catch(() => cached);
      return cached || fetchPromise;
    })());
  }
});
`;

const MANIFEST = {
  name: "FLOW — RSS هوشمند فارسی",
  short_name: "FLOW",
  description: "خواننده RSS با هوش مصنوعی، گراف رسانه، و اخبار بین‌الملل",
  start_url: ".",
  display: "standalone",
  background_color: "#FBF9F8",
  theme_color: "#2FB08B",
  dir: "rtl",
  lang: "fa-IR",
  orientation: "any",
  icons: [
    { src: "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect width='192' height='192' rx='40' fill='#2FB08B'/><text x='50%' y='56%' dominant-baseline='middle' text-anchor='middle' font-family='Georgia, ui-serif, serif' font-weight='600' font-size='120' fill='#FBF9F8'>f</text></svg>`), sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" },
    { src: "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><rect width='512' height='512' rx='100' fill='#2FB08B'/><text x='50%' y='56%' dominant-baseline='middle' text-anchor='middle' font-family='Georgia, ui-serif, serif' font-weight='600' font-size='320' fill='#FBF9F8'>f</text></svg>`), sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" },
  ],
};

export function setupPWA() {
  try {
    // inject manifest
    const blob = new Blob([JSON.stringify(MANIFEST)], { type: "application/manifest+json" });
    const url = URL.createObjectURL(blob);
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) { link = document.createElement("link"); link.rel = "manifest"; document.head.appendChild(link); }
    link.href = url;

    let theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!theme) { theme = document.createElement("meta"); theme.name = "theme-color"; document.head.appendChild(theme); }
    theme.content = "#2FB08B";

    if ("serviceWorker" in navigator) {
      const swBlob = new Blob([SW_SOURCE], { type: "text/javascript" });
      const swUrl = URL.createObjectURL(swBlob);
      navigator.serviceWorker.register(swUrl).catch(e => console.log("SW register failed:", e));
    }
  } catch (e) {
    console.log("setupPWA failed:", e);
  }
}

export function useInstallPrompt(): { canInstall: boolean; prompt: () => void } {
  let deferred: any = null;
  let canInstall = false;
  if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", (e: any) => {
      e.preventDefault();
      deferred = e;
      canInstall = true;
    });
  }
  return {
    canInstall,
    prompt: () => { if (deferred) { deferred.prompt(); deferred = null; canInstall = false; } },
  };
}
