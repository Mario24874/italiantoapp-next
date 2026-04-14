const CACHE = 'italianto-static-v2'

self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // Only handle GET over http(s) — skip chrome-extension:// and other schemes
  if (request.method !== 'GET') return
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return

  // Navigation requests: always go to network (Clerk manages auth redirects)
  if (request.mode === 'navigate') return

  // API routes: skip SW
  if (url.pathname.startsWith('/api/')) return

  // Only cache Next.js static assets under /app (immutable, safe to cache-first)
  if (url.pathname.startsWith('/app/_next/static/')) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request, { redirect: 'follow' }).then(res => {
          if (res.ok && res.status === 200) {
            caches.open(CACHE).then(c => c.put(request, res.clone()))
          }
          return res
        })
      })
    )
    return
  }

  // Public assets (icons, manifest, images): network-first, cache fallback
  if (
    url.pathname.startsWith('/app/icons/') ||
    url.pathname.startsWith('/app/avatars/') ||
    url.pathname === '/app/manifest.json' ||
    url.pathname === '/app/favicon.ico'
  ) {
    e.respondWith(
      fetch(request, { redirect: 'follow' })
        .then(res => {
          if (res.ok && res.status === 200) {
            caches.open(CACHE).then(c => c.put(request, res.clone()))
          }
          return res
        })
        .catch(() => caches.match(request))
    )
  }
})

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting()
})
