'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, PhoneOff, Settings, Volume2, VolumeX, ArrowLeft, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type TutorVoice, resolveWebSpeechVoice } from './tutor-voices'

// ── Types ────────────────────────────────────────────────────────────────────
type CallStatus = 'idle' | 'listening' | 'thinking' | 'speaking'

interface Message { role: 'user' | 'assistant'; content: string }

interface TutorPrefs {
  registro: 'informale' | 'formale'
  tono: 'amichevole' | 'professionale' | 'incoraggiante'
  focus: 'conversazione' | 'grammatica' | 'vocabolario' | 'pronuncia'
  modismi: 'neutro' | 'roma' | 'milano' | 'napoli'
  livello: 'A1' | 'A2' | 'B1'
}

const DEFAULT_PREFS: TutorPrefs = {
  registro: 'informale', tono: 'amichevole', focus: 'conversazione',
  modismi: 'neutro', livello: 'A1',
}
const PREFS_KEY = 'tutor_prefs_v1'

// ── Equalizer bars (CSS animation) ───────────────────────────────────────────
function EqualizerBars({ active, color }: { active: boolean; color: string }) {
  if (!active) {
    return (
      <div className="flex items-end gap-[3px] h-7">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-1 rounded-sm h-1" style={{ backgroundColor: color, opacity: 0.3 }} />
        ))}
      </div>
    )
  }
  return (
    <div className="flex items-end gap-[3px] h-7">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="eq-bar w-1 rounded-sm"
          style={{
            backgroundColor: color,
            height: '100%',
            animationDelay: `${i * 0.08}s`,
          }}
        />
      ))}
    </div>
  )
}

// ── Settings panel ────────────────────────────────────────────────────────────
function RadioGroup<T extends string>({
  label, options, value, onChange,
}: {
  label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-italianto-700 dark:text-italianto-500 uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              value === opt.value
                ? 'bg-italianto-700 border-italianto-600 text-white dark:bg-italianto-800 dark:border-italianto-700'
                : 'bg-white dark:bg-[#132213] border-[#d4e4d4] dark:border-[#1e3a1e] text-gray-500 dark:text-[#4a7a4a] hover:border-italianto-400',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function TutorCall({ tutor }: { tutor: TutorVoice }) {
  const router = useRouter()
  const [status, setStatus] = useState<CallStatus>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [prefs, setPrefs] = useState<TutorPrefs>(DEFAULT_PREFS)
  const [error, setError] = useState<string | null>(null)
  const [userVolume, setUserVolume] = useState(0)   // 0-1 mic level

  const messagesRef = useRef<Message[]>([])
  const scrollRef   = useRef<HTMLDivElement>(null)
  const recogRef    = useRef<{ stop: () => void } | null>(null)
  const audioRef    = useRef<HTMLAudioElement | null>(null)
  const utterRef    = useRef<SpeechSynthesisUtterance | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const micPollRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const audioCtxRef  = useRef<AudioContext | null>(null)

  // Load prefs
  useEffect(() => {
    try {
      const s = localStorage.getItem(PREFS_KEY)
      if (s) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(s) })
    } catch {}
  }, [])

  const savePrefs = (next: TutorPrefs) => {
    setPrefs(next)
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch {}
  }

  useEffect(() => { messagesRef.current = messages }, [messages])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // ── Stop all audio ─────────────────────────────────────────────────────────
  const stopAudio = useCallback(() => {
    audioRef.current?.pause()
    audioRef.current = null
    window.speechSynthesis?.cancel()
    utterRef.current = null
  }, [])

  // ── Mic volume analysis ────────────────────────────────────────────────────
  const startMicAnalysis = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = stream
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      ctx.createMediaStreamSource(stream).connect(analyser)
      audioCtxRef.current = ctx
      analyserRef.current = analyser
      const data = new Uint8Array(analyser.frequencyBinCount)
      micPollRef.current = setInterval(() => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        setUserVolume(Math.min(1, avg / 40))
      }, 80)
    } catch {
      setError('Permesso microfono negato. Abilitalo nelle impostazioni del browser.')
    }
  }, [])

  const stopMicAnalysis = useCallback(() => {
    if (micPollRef.current) clearInterval(micPollRef.current)
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    micStreamRef.current = null
    setUserVolume(0)
  }, [])

  // ── TTS playback ───────────────────────────────────────────────────────────
  const speak = useCallback(async (text: string) => {
    if (!ttsEnabled) return
    stopAudio()
    setStatus('speaking')

    // Try ElevenLabs cloned voice first
    if (tutor.elevenlabsVoiceId) {
      try {
        const res = await fetch('/api/tutor/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice_id: tutor.elevenlabsVoiceId }),
        })
        if (res.ok) {
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          audioRef.current = audio
          audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; setStatus('idle') }
          audio.onerror = () => { setStatus('idle') }
          await audio.play()
          return
        }
      } catch { /* fall through to Web Speech */ }
    }

    // Web Speech API
    if (!window.speechSynthesis) { setStatus('idle'); return }
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'it-IT'
    utter.rate = 0.9
    utter.pitch = tutor.pitch

    // Wait for voices to load (Chrome lazy-loads them)
    const setVoice = () => {
      const v = resolveWebSpeechVoice(tutor.gender)
      if (v) utter.voice = v
    }
    if (window.speechSynthesis.getVoices().length > 0) {
      setVoice()
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', setVoice, { once: true })
    }

    utter.onend = () => { utterRef.current = null; setStatus('idle') }
    utter.onerror = () => { utterRef.current = null; setStatus('idle') }
    utterRef.current = utter
    window.speechSynthesis.speak(utter)
  }, [ttsEnabled, tutor, stopAudio])

  // ── Send message to Gemini ─────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    const userMsg: Message = { role: 'user', content: trimmed }
    const next = [...messagesRef.current, userMsg]
    setMessages(next)
    setStatus('thinking')
    setError(null)

    try {
      const res = await fetch('/api/tutor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, tutorName: tutor.name, tutorSlug: tutor.slug, prefs }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Errore del tutor'); setStatus('idle'); return }

      const assistantMsg: Message = { role: 'assistant', content: data.text }
      setMessages(prev => [...prev, assistantMsg])
      await speak(data.text)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore di rete')
      setStatus('idle')
    }
  }, [tutor, prefs, speak])

  // ── Speech recognition ─────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setError('Riconoscimento vocale non supportato. Usa Chrome o Edge.')
      return
    }
    stopAudio()
    await startMicAnalysis()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new SR() as any
    recognition.lang = 'it-IT'
    recognition.continuous = false
    recognition.interimResults = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const t: string = e.results[0][0].transcript
      stopMicAnalysis()
      sendMessage(t)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      stopMicAnalysis()
      setStatus('idle')
      const msgs: Record<string, string> = {
        'not-allowed': 'Accesso microfono negato.',
        'no-speech':   'Nessuna voce rilevata. Riprova.',
        'network':     'Errore di rete nel riconoscimento vocale.',
      }
      const msg = msgs[e.error as string]
      if (msg) setError(msg)
    }
    recognition.onend = () => { stopMicAnalysis(); if (status === 'listening') setStatus('idle') }
    recogRef.current = recognition
    recognition.start()
    setStatus('listening')
    setError(null)
  }, [stopAudio, startMicAnalysis, stopMicAnalysis, sendMessage, status])

  const stopListening = useCallback(() => {
    recogRef.current?.stop()
    stopMicAnalysis()
    setStatus('idle')
  }, [stopMicAnalysis])

  // ── Greeting on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    const greeting = `Ciao! Sono ${tutor.name}. Benvenuto! Parli italiano, español o English?`
    const msg: Message = { role: 'assistant', content: greeting }
    setMessages([msg])
    setTimeout(() => speak(greeting), 600)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cleanup on unmount
  useEffect(() => () => {
    stopAudio(); stopMicAnalysis(); recogRef.current?.stop()
  }, [stopAudio, stopMicAnalysis])

  const isSpeaking  = status === 'speaking'
  const isListening = status === 'listening'
  const isThinking  = status === 'thinking'
  const isActive    = status !== 'idle'

  // ── Settings panel ─────────────────────────────────────────────────────────
  if (showSettings) {
    return (
      <div className="flex flex-col h-full bg-[#f5f7f5] dark:bg-[#0d1a0d]">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#d4e4d4] dark:border-[#1e3a1e] shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={15} className="text-italianto-700 dark:text-italianto-400" />
            <span className="font-bold text-gray-800 dark:text-[#c8e6c9] text-sm">Preferenze sessione</span>
          </div>
          <button onClick={() => setShowSettings(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-[#c8e6c9]">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
          <RadioGroup label="Registro" value={prefs.registro} onChange={v => savePrefs({ ...prefs, registro: v })}
            options={[{ value: 'informale', label: 'Informale (tu)' }, { value: 'formale', label: 'Formale (Lei)' }]} />
          <RadioGroup label="Tono" value={prefs.tono} onChange={v => savePrefs({ ...prefs, tono: v })}
            options={[{ value: 'amichevole', label: 'Amichevole' }, { value: 'professionale', label: 'Professionale' }, { value: 'incoraggiante', label: 'Incoraggiante' }]} />
          <RadioGroup label="Focus" value={prefs.focus} onChange={v => savePrefs({ ...prefs, focus: v })}
            options={[{ value: 'conversazione', label: 'Conversazione' }, { value: 'grammatica', label: 'Grammatica' }, { value: 'vocabolario', label: 'Vocabolario' }, { value: 'pronuncia', label: 'Pronuncia' }]} />
          <RadioGroup label="Modismi" value={prefs.modismi} onChange={v => savePrefs({ ...prefs, modismi: v })}
            options={[{ value: 'neutro', label: 'Neutro' }, { value: 'roma', label: 'Romano' }, { value: 'milano', label: 'Milanese' }, { value: 'napoli', label: 'Napoletano' }]} />
          <RadioGroup label="Il tuo livello" value={prefs.livello} onChange={v => savePrefs({ ...prefs, livello: v })}
            options={[{ value: 'A1', label: 'A1 — Principiante' }, { value: 'A2', label: 'A2 — Base' }, { value: 'B1', label: 'B1 — Intermedio' }]} />
        </div>
        <div className="px-4 pb-5 pt-2 border-t border-[#d4e4d4] dark:border-[#1e3a1e] shrink-0">
          <button
            onClick={() => setShowSettings(false)}
            className="w-full py-3 bg-italianto-700 hover:bg-italianto-800 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Salva e torna alla conversazione
          </button>
        </div>
      </div>
    )
  }

  // ── Main call UI ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#f5f7f5] dark:bg-[#0d1a0d]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#d4e4d4] dark:border-[#1e3a1e] shrink-0 bg-white/80 dark:bg-[#0d1a0d]/80 backdrop-blur">
        <button
          onClick={() => { stopAudio(); router.push('/tutor') }}
          className="p-2 rounded-xl text-gray-400 hover:text-italianto-700 dark:hover:text-italianto-400 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="text-center">
          <p className="font-bold text-gray-800 dark:text-[#c8e6c9] text-sm">{tutor.name}</p>
          <p className="text-xs text-gray-400 dark:text-[#4a7a4a] capitalize">
            {prefs.tono} · {prefs.livello}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { stopAudio(); setTtsEnabled(v => !v) }}
            className={cn('p-2 rounded-xl transition-colors',
              ttsEnabled ? 'text-italianto-600 dark:text-italianto-400' : 'text-gray-300 dark:text-[#2a4a2a]')}
          >
            {ttsEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-xl text-gray-400 hover:text-italianto-700 dark:hover:text-italianto-400 transition-colors"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* ── Tutor card ── */}
      <div className="flex flex-col items-center pt-6 pb-4 shrink-0">
        {/* Avatar with pulse */}
        <motion.div
          animate={isSpeaking ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={isSpeaking ? { repeat: Infinity, duration: 1.2 } : {}}
          className={cn(
            'size-28 rounded-full overflow-hidden ring-4 shadow-green-lg transition-all',
            isSpeaking ? 'ring-italianto-500' : 'ring-[#d4e4d4] dark:ring-[#1e3a1e]',
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tutor.avatar} alt={tutor.name} className="size-full object-cover"
            onError={e => { const el = e.target as HTMLImageElement; el.style.display='none'; el.parentElement!.style.background='#2e7d32' }} />
        </motion.div>

        <h2 className="mt-4 text-xl font-bold text-gray-800 dark:text-[#c8e6c9]">{tutor.name}</h2>
        <p className="text-sm text-gray-400 dark:text-[#4a7a4a]">{tutor.description}</p>

        {/* Status label */}
        <AnimatePresence mode="wait">
          <motion.p
            key={status}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn('mt-2 text-xs font-medium', {
              'text-gray-300 dark:text-[#2a4a2a]': status === 'idle',
              'text-red-400': isListening,
              'text-amber-400': isThinking,
              'text-italianto-500': isSpeaking,
            })}
          >
            {status === 'idle' && 'Premi il microfono per parlare'}
            {isListening && '🎙 Sto ascoltando...'}
            {isThinking && '💭 Sto pensando...'}
            {isSpeaking && `${tutor.name} sta parlando...`}
          </motion.p>
        </AnimatePresence>

        {/* Equalizer row — tutor + user */}
        <div className="flex items-center gap-6 mt-4">
          <div className="flex flex-col items-center gap-1">
            <EqualizerBars active={isSpeaking} color="#2e7d32" />
            <span className="text-[10px] text-gray-400 dark:text-[#3a5a3a]">{tutor.name}</span>
          </div>
          <div className="w-px h-6 bg-[#d4e4d4] dark:bg-[#1e3a1e]" />
          <div className="flex flex-col items-center gap-1">
            <EqualizerBars active={isListening && userVolume > 0.1} color="#2196f3" />
            <span className="text-[10px] text-gray-400 dark:text-[#3a5a3a]">Tu</span>
          </div>
        </div>
      </div>

      {/* ── Transcript ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 space-y-2 py-2">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div className={cn(
              'max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
              msg.role === 'user'
                ? 'bg-italianto-700 text-white rounded-br-sm'
                : 'bg-white dark:bg-[#132213] border border-[#d4e4d4] dark:border-[#1e3a1e] text-gray-800 dark:text-[#c8e6c9] rounded-bl-sm',
            )}>
              {msg.content}
            </div>
          </motion.div>
        ))}

        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-[#132213] border border-[#d4e4d4] dark:border-[#1e3a1e] rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
              {[0, 0.15, 0.3].map((d, i) => (
                <motion.span key={i} animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: d }}
                  className="size-1.5 bg-italianto-500 rounded-full" />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-xl text-red-600 dark:text-red-400 text-xs">
          <AlertCircle size={13} className="shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* ── Mic button ── */}
      <div className="flex justify-center items-center gap-6 px-8 pb-6 pt-3 shrink-0">
        {/* End conversation */}
        {isActive && (
          <button
            onClick={() => { stopAudio(); stopListening(); setStatus('idle') }}
            className="size-12 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg"
          >
            <PhoneOff size={20} />
          </button>
        )}

        {/* Mic button */}
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={isListening ? stopListening : startListening}
          disabled={isThinking || isSpeaking}
          className={cn(
            'size-20 rounded-full flex items-center justify-center shadow-green-lg transition-colors',
            isListening
              ? 'bg-red-500 text-white ring-4 ring-red-300/50'
              : isThinking || isSpeaking
              ? 'bg-gray-200 dark:bg-[#1e3a1e] text-gray-400 cursor-not-allowed'
              : 'bg-italianto-700 hover:bg-italianto-800 dark:bg-italianto-700 text-white',
          )}
        >
          {isListening ? <MicOff size={32} /> : <Mic size={32} />}
        </motion.button>

        {/* Spacer for symmetry when active */}
        {isActive && <div className="size-12" />}
      </div>
    </div>
  )
}
