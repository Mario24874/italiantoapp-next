const CACHE = 'italianto-app-v3'
const PRECACHE = ['/', '/tutor', '/conjugador', '/traductor', '/pronuncia', '/profilo']

self.addEventListener('install', e => {
  // Do NOT skipWaiting here — let the client decide when to activate
  // (enables "update available" banner UX)
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE))
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  if (!e.request.url.startsWith('http')) return
  if (e.request.url.includes('/api/')) return
  e.respondWith(
    caches.match(e.request).then(cached => cached ?? fetch(e.request).then(res => {
      if (res.ok && !res.redirected) {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
      }
      return res
    }))
  )
})

// When the client posts SKIP_WAITING, activate the new SW immediately
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting()
})
