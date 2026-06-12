'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { GUEST_LIMIT } from '@/lib/guest-limit'

// Mostrado cuando un visitante sin cuenta agota las pruebas gratuitas de una herramienta
export function GuestGate({ tool }: { tool: string }) {
  return (
    <div className="rounded-2xl border border-italianto-200 dark:border-[#1e4a1e] bg-italianto-50 dark:bg-[#0d2a0d] p-5 text-center space-y-3">
      <div className="mx-auto size-10 rounded-full bg-italianto-700 text-white flex items-center justify-center">
        <Lock size={18} />
      </div>
      <p className="text-sm font-semibold text-italianto-800 dark:text-italianto-300">
        Hai esaurito le {GUEST_LIMIT} prove gratuite
      </p>
      <p className="text-xs text-gray-500 dark:text-[#4a7a4a]">
        Crea un account gratuito per continuare a usare questo strumento con i limiti del tuo piano.
      </p>
      <Link
        href={`/sign-in?redirect_url=/app/${tool}`}
        className="inline-block px-5 py-2.5 rounded-xl bg-italianto-700 hover:bg-italianto-800 text-white text-sm font-semibold transition-colors"
      >
        Accedi gratis
      </Link>
    </div>
  )
}
