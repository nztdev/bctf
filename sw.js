// BCTF Service Worker — v1.0.0
const CACHE_NAME = 'bctf-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ── INSTALL: cache static assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: purge old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: cache-first for static, network-first for API ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin requests
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Network-first for anything under /api/
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for all other static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// ── BACKGROUND SYNC: queue governance submissions ──
self.addEventListener('sync', event => {
  if (event.tag === 'sync-proposals') {
    event.waitUntil(syncPendingProposals());
  }
});

async function syncPendingProposals() {
  // Placeholder: flush any pending proposal submissions from IndexedDB
  // to the governance API when connectivity is restored.
  console.log('[BCTF SW] syncing pending proposals...');
}

// ── PUSH: treasury alerts ──
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'BCTF Update';
  const options = {
    body: data.body || 'New activity in the Bitcoin Community Trust Fund.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
    tag: data.tag || 'bctf-notification',
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
