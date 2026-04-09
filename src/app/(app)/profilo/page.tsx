'use client'

import { useUser, useClerk } from '@clerk/nextjs'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, LogOut, Moon, Sun, ExternalLink, Crown } from 'lucide-react'

export default function ProfiloPage() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggleDark = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  const handleSignOut = () => signOut({ redirectUrl: '/sign-in' })

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-5 max-w-md mx-auto w-full space-y-4">

      {/* Header */}
      <h1 className="text-xl font-bold text-italianto-800 dark:text-italianto-300 flex items-center gap-2">
        <User size={20} /> Profilo
      </h1>

      {/* User card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-[#d4e4d4] dark:border-[#1e3a1e] bg-white dark:bg-[#132213] p-5 flex items-center gap-4"
      >
        {user?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.imageUrl} alt="Avatar" className="size-14 rounded-full ring-2 ring-italianto-400" />
        ) : (
          <div className="size-14 rounded-full bg-italianto-700 flex items-center justify-center text-white text-xl font-bold">
            {user?.firstName?.[0] ?? '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-800 dark:text-[#c8e6c9] truncate">
            {user?.fullName ?? 'Utente'}
          </p>
          <p className="text-xs text-gray-400 dark:text-[#4a7a4a] truncate mt-0.5">
            {user?.primaryEmailAddress?.emailAddress ?? ''}
          </p>
        </div>
      </motion.div>

      {/* Premium banner */}
      <motion.a
        href="https://italianto.com/precios"
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex items-center gap-3 p-4 rounded-2xl italianto-gradient text-white"
      >
        <Crown size={22} className="shrink-0" />
        <div className="flex-1">
          <p className="font-bold text-sm">Accedi a tutti i tutors</p>
          <p className="text-xs opacity-80 mt-0.5">Sblocca il piano premium su italianto.com</p>
        </div>
        <ExternalLink size={16} className="shrink-0 opacity-70" />
      </motion.a>

      {/* Settings */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-[#d4e4d4] dark:border-[#1e3a1e] bg-white dark:bg-[#132213] overflow-hidden divide-y divide-[#d4e4d4] dark:divide-[#1e3a1e]"
      >
        {/* Dark mode toggle */}
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            {dark ? <Moon size={18} className="text-italianto-500" /> : <Sun size={18} className="text-amber-500" />}
            <span className="text-sm text-gray-700 dark:text-[#c8e6c9]">Modalità scura</span>
          </div>
          <button
            onClick={toggleDark}
            className="relative w-11 h-6 rounded-full transition-colors"
            style={{ backgroundColor: dark ? '#2e7d32' : '#d1d5db' }}
          >
            <span
              className="absolute top-0.5 size-5 bg-white rounded-full shadow transition-transform"
              style={{ transform: dark ? 'translateX(20px)' : 'translateX(2px)' }}
            />
          </button>
        </div>

        {/* Account link */}
        <a
          href="https://italianto.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-4 py-3.5 text-sm text-gray-700 dark:text-[#c8e6c9] hover:bg-[#f5f7f5] dark:hover:bg-[#0d2a0d] transition-colors"
        >
          <span>Gestisci abbonamento</span>
          <ExternalLink size={15} className="text-gray-300 dark:text-[#2a4a2a]" />
        </a>
      </motion.div>

      {/* Sign out */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        onClick={handleSignOut}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-red-200 dark:border-red-900/40 text-red-500 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
      >
        <LogOut size={16} /> Esci dall'account
      </motion.button>

      <p className="text-center text-[10px] text-gray-300 dark:text-[#2a4a2a] pb-2">
        Italianto App v1.0 · app.italianto.com
      </p>
    </div>
  )
}
