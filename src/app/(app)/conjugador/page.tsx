'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, BookOpen, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { conjugate, TENSE_LABELS, PRONOUNS, PRONOUN_LABELS, type VerbTense } from '@/lib/conjugation'

const TENSES = Object.keys(TENSE_LABELS) as VerbTense[]

const QUICK_VERBS = ['essere', 'avere', 'fare', 'andare', 'dire', 'venire', 'potere', 'volere', 'sapere', 'dovere']

export default function ConjugadorPage() {
  const [verb, setVerb] = useState('')
  const [tense, setTense] = useState<VerbTense>('presente')
  const [result, setResult] = useState<ReturnType<typeof conjugate> | null>(null)
  const [error, setError] = useState('')

  const handleConjugate = (v = verb) => {
    const trimmed = v.trim()
    if (!trimmed) return
    setError('')
    try {
      setResult(conjugate(trimmed, tense))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto')
      setResult(null)
    }
  }

  const reset = () => { setVerb(''); setResult(null); setError('') }

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-5 max-w-md mx-auto w-full space-y-4">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-italianto-800 dark:text-italianto-300 flex items-center gap-2">
          <BookOpen size={20} /> Coniugatore
        </h1>
        <p className="text-xs text-gray-400 dark:text-[#4a7a4a] mt-0.5">Inserisci un verbo italiano</p>
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-[#2a4a2a]" />
          <input
            type="text"
            value={verb}
            onChange={e => setVerb(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleConjugate()}
            placeholder="es. parlare, essere..."
            className="w-full pl-9 pr-4 py-3 rounded-xl border border-[#d4e4d4] dark:border-[#1e3a1e] bg-white dark:bg-[#132213] text-gray-800 dark:text-[#c8e6c9] text-sm placeholder:text-gray-300 dark:placeholder:text-[#2a4a2a] focus:outline-none focus:ring-2 focus:ring-italianto-500/40"
          />
        </div>
        {result && (
          <button onClick={reset} className="p-3 rounded-xl border border-[#d4e4d4] dark:border-[#1e3a1e] text-gray-400 hover:text-italianto-600 transition-colors">
            <RotateCcw size={16} />
          </button>
        )}
      </div>

      {/* Tense selector */}
      <div className="flex flex-wrap gap-1.5">
        {TENSES.map(t => (
          <button
            key={t}
            onClick={() => { setTense(t); if (result) handleConjugate() }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              tense === t
                ? 'bg-italianto-700 border-italianto-600 text-white'
                : 'bg-white dark:bg-[#132213] border-[#d4e4d4] dark:border-[#1e3a1e] text-gray-500 dark:text-[#4a7a4a] hover:border-italianto-400',
            )}
          >
            {TENSE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Conjugate button */}
      <button
        onClick={() => handleConjugate()}
        disabled={!verb.trim()}
        className="w-full py-3 bg-italianto-700 hover:bg-italianto-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
      >
        Coniuga
      </button>

      {/* Error */}
      {error && (
        <p className="text-red-500 text-sm bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-[#d4e4d4] dark:border-[#1e3a1e] bg-white dark:bg-[#132213] overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-[#d4e4d4] dark:border-[#1e3a1e] flex items-center justify-between">
              <span className="font-bold text-italianto-700 dark:text-italianto-400 capitalize">{result.verb}</span>
              <span className="text-xs text-gray-400 dark:text-[#4a7a4a]">{TENSE_LABELS[result.tense]}</span>
            </div>
            <div className="divide-y divide-[#d4e4d4] dark:divide-[#1e3a1e]">
              {PRONOUNS.map(p => (
                <div key={p} className="flex items-center px-4 py-2.5 gap-3">
                  <span className="w-14 text-xs text-gray-400 dark:text-[#4a7a4a] shrink-0">{PRONOUN_LABELS[p]}</span>
                  <span className="text-sm font-medium text-gray-800 dark:text-[#c8e6c9]">{result.conjugations[p]}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick verbs */}
      {!result && (
        <div>
          <p className="text-xs text-gray-400 dark:text-[#3a5a3a] mb-2 font-medium">Verbi comuni</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_VERBS.map(v => (
              <button
                key={v}
                onClick={() => { setVerb(v); handleConjugate(v) }}
                className="px-3 py-1.5 rounded-lg text-xs bg-[#f0f7f0] dark:bg-[#0d1a0d] border border-[#d4e4d4] dark:border-[#1e3a1e] text-italianto-700 dark:text-italianto-500 hover:bg-italianto-50 dark:hover:bg-[#132213] transition-colors"
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
