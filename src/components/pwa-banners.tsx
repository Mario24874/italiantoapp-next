'use client'

import { useEffect, useState } from 'react'
import { Download, RefreshCw, X, Smartphone } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaBanners() {
  const [updateReady, setUpdateReady] = useState(false)
  const [swReg, setSwReg] = useState<ServiceWorkerRegistration | null>(null)

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [installDismissed, setInstallDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // ── SW Update detection ─────────────────────────────────────────────────
    navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).then(reg => {
      setSwReg(reg)

      const checkWaiting = () => {
        if (reg.waiting) setUpdateReady(true)
      }

      // Already waiting (page reload after SW updated)
      checkWaiting()

      // New SW installed while page is open
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing
        if (!newSW) return
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed') checkWaiting()
        })
      })
    }).catch(() => {/* SW registration failed — silently ignore */})

    // SW controller changed → reload to use new version
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    })

    // ── Install banner ──────────────────────────────────────────────────────
    try {
      const dismissed = localStorage.getItem('pwa-install-dismissed')
      if (dismissed) setInstallDismissed(true)
    } catch {}

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)

    if (isStandalone) return // already installed — never show install banner

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isIosSafari = isIos && !/CriOS|FxiOS|OPiOS|mercury/i.test(navigator.userAgent)

    if (isIosSafari) {
      setShowIosHint(true)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleUpdate = () => {
    if (swReg?.waiting) {
      swReg.waiting.postMessage('SKIP_WAITING')
      // controllerchange listener will reload the page
    }
  }

  const handleInstall = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setInstallPrompt(null)
  }

  const dismissInstall = () => {
    setInstallPrompt(null)
    setShowIosHint(false)
    setInstallDismissed(true)
    try { localStorage.setItem('pwa-install-dismissed', '1') } catch {}
  }

  const showInstallBanner = !installDismissed && (installPrompt !== null || showIosHint)

  return (
    <>
      {/* ── Update available banner ─────────────────────────────────────── */}
      {updateReady && (
        <div className="fixed top-0 inset-x-0 z-50 bg-italianto-700 text-white px-4 py-3 flex items-center gap-3 shadow-lg">
          <RefreshCw size={18} className="shrink-0" />
          <p className="flex-1 text-sm font-medium">Nueva versión disponible</p>
          <button
            onClick={handleUpdate}
            className="text-xs font-bold bg-white text-italianto-800 px-3 py-1.5 rounded-full hover:bg-italianto-100 transition-colors"
          >
            Actualizar
          </button>
        </div>
      )}

      {/* ── Install banner ──────────────────────────────────────────────── */}
      {showInstallBanner && (
        <div className="fixed bottom-20 inset-x-3 z-50 bg-white dark:bg-[#132213] border border-[#d4e4d4] dark:border-[#1e3a1e] rounded-2xl shadow-xl p-4 flex items-start gap-3">
          <div className="size-10 rounded-xl italianto-gradient flex items-center justify-center shrink-0">
            <Smartphone size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-gray-800 dark:text-[#c8e6c9]">Instala Italianto App</p>
            {showIosHint && !installPrompt ? (
              <p className="text-xs text-gray-500 dark:text-[#4a7a4a] mt-0.5 leading-relaxed">
                Toca <span className="font-semibold">Compartir</span> →{' '}
                <span className="font-semibold">Agregar a inicio</span> para instalar la app.
              </p>
            ) : (
              <p className="text-xs text-gray-500 dark:text-[#4a7a4a] mt-0.5">
                Agrega la app a tu pantalla de inicio para acceso rápido.
              </p>
            )}
            {installPrompt && (
              <button
                onClick={handleInstall}
                className="mt-2 flex items-center gap-1.5 text-xs font-bold text-italianto-700 dark:text-italianto-400"
              >
                <Download size={14} /> Instalar ahora
              </button>
            )}
          </div>
          <button
            onClick={dismissInstall}
            className="text-gray-300 dark:text-[#2a4a2a] hover:text-gray-500 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </>
  )
}
