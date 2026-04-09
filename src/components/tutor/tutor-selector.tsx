'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TUTOR_VOICES, type TutorVoice } from './tutor-voices'

export function TutorSelector() {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)

  const handleSelect = (tutor: TutorVoice) => {
    setSelected(tutor.slug)
    setTimeout(() => router.push(`/tutor/${tutor.slug}`), 200)
  }

  return (
    <div className="flex flex-col h-full px-4 py-6 max-w-md mx-auto w-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-center"
      >
        <h1 className="text-2xl font-bold text-italianto-800 dark:text-italianto-300">
          Scegli il tuo Tutor
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#4a7a4a] mt-1">
          Ogni tutor ha uno stile diverso
        </p>
      </motion.div>

      {/* Grid 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        {TUTOR_VOICES.map((tutor, i) => {
          const isSelected = selected === tutor.slug
          return (
            <motion.button
              key={tutor.slug}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => handleSelect(tutor)}
              disabled={!!selected && !isSelected}
              className={cn(
                'relative flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all',
                'bg-white dark:bg-[#132213]',
                isSelected
                  ? 'border-italianto-600 shadow-green-lg scale-[0.98]'
                  : 'border-[#d4e4d4] dark:border-[#1e3a1e] hover:border-italianto-400 hover:shadow-green active:scale-[0.97]',
                selected && !isSelected && 'opacity-40',
              )}
            >
              {/* Avatar */}
              <div className={cn(
                'size-20 rounded-full overflow-hidden ring-2 transition-all',
                isSelected ? 'ring-italianto-500' : 'ring-[#d4e4d4] dark:ring-[#1e3a1e]',
              )}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tutor.avatar}
                  alt={tutor.name}
                  className="size-full object-cover"
                  onError={e => {
                    const el = e.target as HTMLImageElement
                    el.style.display = 'none'
                    el.parentElement!.style.background = '#2e7d32'
                  }}
                />
              </div>

              {/* Name & description */}
              <div className="text-center">
                <p className={cn(
                  'font-bold text-base',
                  isSelected
                    ? 'text-italianto-700 dark:text-italianto-300'
                    : 'text-gray-800 dark:text-[#c8e6c9]',
                )}>
                  {tutor.name}
                </p>
                <p className="text-xs text-gray-400 dark:text-[#4a7a4a] mt-0.5">
                  {tutor.description}
                </p>
              </div>

              {/* Gender badge */}
              <span className={cn(
                'text-[10px] px-2 py-0.5 rounded-full font-medium',
                tutor.gender === 'male'
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400'
                  : 'bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400',
              )}>
                {tutor.gender === 'male' ? 'Uomo' : 'Donna'}
              </span>

              {/* Check badge */}
              {isSelected && (
                <span className="absolute top-2 right-2">
                  <CheckCircle2 size={18} className="text-italianto-600" />
                </span>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
