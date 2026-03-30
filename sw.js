// ─── Asia Trip Planner — Service Worker ───────────────────────────────────
// Strategy: cache-first for same-origin assets, stale-while-revalidate for fonts

const CACHE = 'asia-trip-v2';
const PRECACHE = ['./', './index.html', './manifest.json', './icon.svg'];

// ── Install: pre-cache app shell ──────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(
        PRECACHE.map(url => c.add(new Request(url, { cache: 'reload' })))
      ))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: purge old caches ────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Google Fonts: stale-while-revalidate (serve cached instantly, refresh in bg)
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          const fresh = fetch(e.request)
            .then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; })
            .catch(() => cached);
          return cached || fresh;
        })
      )
    );
    return;
  }

  // Same-origin assets: cache-first, update cache in background
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const networkFetch = fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => cached); // return stale if network fails
        return cached || networkFetch;
      })
    );
  }
});
