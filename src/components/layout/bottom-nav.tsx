'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageCircle, BookOpen, Languages, Mic, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/tutor',       icon: MessageCircle, label: 'Tutor' },
  { href: '/conjugador',  icon: BookOpen,       label: 'Conjugar' },
  { href: '/traductor',   icon: Languages,      label: 'Traduci' },
  { href: '/pronuncia',   icon: Mic,            label: 'Pronuncia' },
  { href: '/profilo',     icon: User,           label: 'Profilo' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-[#0d1a0d] border-t border-[#d4e4d4] dark:border-[#1e3a1e] safe-bottom">
      <div className="flex items-stretch h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors',
                active
                  ? 'text-italianto-700 dark:text-italianto-400'
                  : 'text-gray-400 dark:text-[#3a5a3a] hover:text-italianto-600 dark:hover:text-italianto-500',
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              <span className={cn('text-[10px] font-medium', active && 'font-semibold')}>
                {label}
              </span>
              {active && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-italianto-600 dark:bg-italianto-400 rounded-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
