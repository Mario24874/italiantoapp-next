'use client'

import { useEffect, useState } from 'react'

export function CookieCheck() {
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    try {
      document.cookie = '__ctest=1; SameSite=Lax; Secure; path=/'
      const ok = document.cookie.includes('__ctest')
      document.cookie = '__ctest=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
      if (!ok) setBlocked(true)
    } catch {
      setBlocked(true)
    }
  }, [])

  if (!blocked) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9998] bg-red-900 border-t border-red-700 px-4 py-3 text-sm text-red-100">
      <strong>Cookies desactivadas.</strong> Actívalas en{' '}
      <strong>Configuración → Privacidad → Cookies</strong> y recarga para usar Italianto.
    </div>
  )
}
