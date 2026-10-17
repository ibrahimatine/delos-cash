// Service worker (CDC §9.2): pre-cached shell, cached fonts, never a
// financial request. The cache name is versioned by build (task-prod.ts).
const CACHE = 'delos-__BUILD__'
const SHELL = [
  './',
  'index.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() =>
      self.skipWaiting()
    ),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  // POST, PUT, DELETE, webhooks and the event stream are never touched
  if (request.method !== 'GET' || url.pathname.includes('/api/')) return

  // fonts: stale-while-revalidate
  if (/fonts\.(googleapis|gstatic)\.com|fonts\.cdnfonts\.com/.test(url.host)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        const fresh = fetch(request).then((res) => {
          if (res.ok) cache.put(request, res.clone())
          return res
        }).catch(() => cached)
        return cached || fresh
      }),
    )
    return
  }
  if (url.origin !== location.origin) return

  // app routes (/collecte, /gerer/paiement…): network first, cached shell offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((cache) => cache.put('./', copy))
        return res
      }).catch(() => caches.match('./')),
    )
    return
  }

  // static files of this build: cache first
  event.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return res
      })
    ),
  )
})
