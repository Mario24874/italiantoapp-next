'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Volume2, Mic, MicOff, RefreshCw, CheckCircle2, XCircle, Mic2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const WORD_CATEGORIES = {
  'Saluti': ['ciao', 'buongiorno', 'buonasera', 'arrivederci', 'prego', 'grazie', 'scusi', 'per favore'],
  'Numeri': ['uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci'],
  'Colori': ['rosso', 'blu', 'verde', 'giallo', 'bianco', 'nero', 'arancione', 'viola'],
  'Cibo': ['pizza', 'pasta', 'gelato', 'caffè', 'vino', 'pane', 'formaggio', 'pomodoro'],
  'Frasi': ['come stai', 'molto bene', 'non capisco', 'parla più lento', 'dov\'è il bagno', 'quanto costa'],
}

type Category = keyof typeof WORD_CATEGORIES

function playTTS(text: string, pitch = 1.0) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'it-IT'
  u.rate = 0.8
  u.pitch = pitch
  const voices = window.speechSynthesis.getVoices()
  const italian = voices.find(v => v.lang.startsWith('it'))
  if (italian) u.voice = italian
  window.speechSynthesis.speak(u)
}

function scoreMatch(spoken: string, target: string): number {
  const a = spoken.toLowerCase().trim()
  const b = target.toLowerCase().trim()
  if (a === b) return 100
  if (a.includes(b) || b.includes(a)) return 85
  const aW = a.split(' ')
  const bW = b.split(' ')
  const matches = aW.filter(w => bW.some(bw => bw.startsWith(w.slice(0, 3)) || w.startsWith(bw.slice(0, 3))))
  return Math.round((matches.length / Math.max(aW.length, bW.length)) * 100)
}

export default function PronunciaPage() {
  const [category, setCategory] = useState<Category>('Saluti')
  const [wordIdx, setWordIdx] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [spokenText, setSpokenText] = useState('')
  const [streak, setStreak] = useState(0)
  const recogRef = useRef<{ stop: () => void } | null>(null)

  const words = WORD_CATEGORIES[category]
  const currentWord = words[wordIdx]

  const nextWord = useCallback(() => {
    setScore(null); setSpokenText('')
    setWordIdx(i => (i + 1) % words.length)
  }, [words.length])

  const randomWord = useCallback(() => {
    setScore(null); setSpokenText('')
    setWordIdx(Math.floor(Math.random() * words.length))
  }, [words.length])

  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Riconoscimento vocale non supportato. Usa Chrome o Edge.'); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = new SR() as any
    r.lang = 'it-IT'; r.continuous = false; r.interimResults = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      const spoken: string = e.results[0][0].transcript
      setSpokenText(spoken)
      const s = scoreMatch(spoken, currentWord)
      setScore(s)
      if (s >= 70) setStreak(n => n + 1)
      else setStreak(0)
    }
    r.onerror = () => { setIsListening(false) }
    r.onend = () => { setIsListening(false) }
    recogRef.current = r
    r.start()
    setIsListening(true)
    setScore(null); setSpokenText('')
  }, [currentWord])

  const stopListening = () => { recogRef.current?.stop(); setIsListening(false) }

  const scoreColor = score === null ? '' : score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-amber-500' : 'text-red-500'
  const scoreBg    = score === null ? '' : score >= 80 ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/30' : score >= 60 ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/30' : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/30'

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-5 max-w-md mx-auto w-full space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-italianto-800 dark:text-italianto-300 flex items-center gap-2">
            <Mic2 size={20} /> Pronuncia
          </h1>
          <p className="text-xs text-gray-400 dark:text-[#4a7a4a] mt-0.5">Ascolta e ripeti in italiano</p>
        </div>
        {streak > 2 && (
          <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl px-3 py-1.5">
            <span className="text-lg">🔥</span>
            <span className="text-sm font-bold text-amber-600">{streak}</span>
          </div>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {Object.keys(WORD_CATEGORIES).map(c => (
          <button
            key={c}
            onClick={() => { setCategory(c as Category); setWordIdx(0); setScore(null); setSpokenText('') }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors shrink-0',
              category === c
                ? 'bg-italianto-700 border-italianto-600 text-white'
                : 'bg-white dark:bg-[#132213] border-[#d4e4d4] dark:border-[#1e3a1e] text-gray-500 dark:text-[#4a7a4a]',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Word card */}
      <div className="rounded-2xl border border-[#d4e4d4] dark:border-[#1e3a1e] bg-white dark:bg-[#132213] p-6 text-center space-y-4">
        <p className="text-3xl font-bold text-gray-800 dark:text-[#c8e6c9] tracking-wide">{currentWord}</p>

        <div className="flex justify-center gap-3">
          <button
            onClick={() => playTTS(currentWord)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-italianto-50 dark:bg-[#0d2a0d] border border-italianto-200 dark:border-[#1e4a1e] text-italianto-700 dark:text-italianto-400 text-sm font-medium hover:bg-italianto-100 dark:hover:bg-[#132213] transition-colors"
          >
            <Volume2 size={15} /> Ascolta
          </button>
          <button
            onClick={() => playTTS(currentWord, 0.8)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 dark:bg-[#0d1a0d] border border-[#d4e4d4] dark:border-[#1e3a1e] text-gray-500 dark:text-[#4a7a4a] text-sm hover:bg-gray-100 dark:hover:bg-[#132213] transition-colors"
          >
            🐢 Lento
          </button>
        </div>

        {/* Mic button */}
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={isListening ? stopListening : startListening}
          className={cn(
            'mx-auto size-16 rounded-full flex items-center justify-center shadow-green transition-colors',
            isListening
              ? 'bg-red-500 text-white ring-4 ring-red-300/50'
              : 'bg-italianto-700 hover:bg-italianto-800 text-white',
          )}
        >
          {isListening ? <MicOff size={26} /> : <Mic size={26} />}
        </motion.button>

        <p className="text-xs text-gray-400 dark:text-[#3a5a3a]">
          {isListening ? '🎙 Sto ascoltando...' : 'Premi e ripeti la parola'}
        </p>
      </div>

      {/* Result */}
      <AnimatePresence>
        {score !== null && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('rounded-2xl border p-4 space-y-3', scoreBg)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {score >= 70
                  ? <CheckCircle2 size={18} className="text-emerald-500" />
                  : <XCircle size={18} className="text-red-500" />}
                <span className={cn('font-bold text-lg', scoreColor)}>{score}%</span>
                <span className="text-sm text-gray-500 dark:text-[#4a7a4a]">
                  {score >= 80 ? 'Perfetto!' : score >= 60 ? 'Quasi! Riprova.' : 'Continua a praticare!'}
                </span>
              </div>
            </div>
            {spokenText && (
              <p className="text-sm text-gray-500 dark:text-[#4a7a4a]">
                Hai detto: <span className="font-medium text-gray-700 dark:text-[#c8e6c9]">"{spokenText}"</span>
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex gap-2">
        <button
          onClick={randomWord}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-[#d4e4d4] dark:border-[#1e3a1e] bg-white dark:bg-[#132213] text-gray-500 dark:text-[#4a7a4a] text-sm hover:border-italianto-400 transition-colors"
        >
          <RefreshCw size={15} /> Casuale
        </button>
        <button
          onClick={nextWord}
          className="flex-1 py-3 rounded-xl bg-italianto-700 hover:bg-italianto-800 text-white text-sm font-semibold transition-colors"
        >
          Prossima →
        </button>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 pb-2">
        {words.map((_, i) => (
          <div key={i} className={cn('size-1.5 rounded-full transition-all',
            i === wordIdx ? 'bg-italianto-600 w-3' : 'bg-[#d4e4d4] dark:bg-[#1e3a1e]')} />
        ))}
      </div>
    </div>
  )
}
