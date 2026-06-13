'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export function PageViewTracker() {
  const pathname = usePathname()
  const idRef = useRef<string | null>(null)
  const startRef = useRef<number>(0)

  useEffect(() => {
    if (pathname.startsWith('/admin')) return
    let cancelled = false

    function flush() {
      const id = idRef.current
      if (!id) return
      const duration = Math.round((Date.now() - startRef.current) / 1000)
      idRef.current = null
      const payload = JSON.stringify({ id, duration })
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/pageview', new Blob([payload], { type: 'application/json' }))
      } else {
        fetch('/api/analytics/pageview', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {})
      }
    }

    async function start() {
      try {
        const res = await fetch('/api/analytics/pageview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: pathname, referrer: document.referrer || null }) })
        if (!res.ok || cancelled) return
        const { id } = await res.json()
        if (cancelled) return
        idRef.current = id ?? null
        startRef.current = Date.now()
      } catch { /* no crítico */ }
    }

    function onHide() { if (document.visibilityState === 'hidden') flush() }

    start()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [pathname])

  return null
}
