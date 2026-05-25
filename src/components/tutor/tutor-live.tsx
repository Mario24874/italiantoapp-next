'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, MicOff, PhoneOff, Settings, Volume2, VolumeX,
  ArrowLeft, AlertCircle, Check, Phone, Video, VideoOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Gemini voice mapping per avatar slug ─────────────────────────────────────
const GEMINI_VOICE: Record<string, string> = {
  marco:     'Puck',
  giovanni:  'Charon',
  giulia:    'Aoede',
  francesca: 'Kore',
}
const DEFAULT_GEMINI_VOICE = 'Puck'

const AVATAR_IMAGES: Record<string, string> = {
  marco:     '/tutor-Marco.png',
  giovanni:  '/tutor-Giovanni.png',
  giulia:    '/tutor-Giulia.png',
  francesca: '/tutor-Francesca.png',
}

// ── Types ─────────────────────────────────────────────────────────────────────
type CallStatus = 'idle' | 'connecting' | 'listening' | 'speaking'
type AvatarId = 'marco' | 'giovanni' | 'giulia' | 'francesca'

interface Message {
  role: 'user' | 'assistant'
  text: string
  partial?: boolean
}

interface StudentPrefs {
  avatarId: AvatarId
  customName: string
  registro: 'informale' | 'formale'
  tono: 'amichevole' | 'professionale' | 'incoraggiante'
  focus: 'conversazione' | 'grammatica' | 'vocabolario' | 'pronuncia'
  modismi: 'neutro' | 'roma' | 'milano' | 'napoli'
  livello: 'A1' | 'A2' | 'B1' | 'B2'
}

const DEFAULT_PREFS: StudentPrefs = {
  avatarId: 'marco',
  customName: 'Marco',
  registro: 'informale',
  tono: 'amichevole',
  focus: 'conversazione',
  modismi: 'neutro',
  livello: 'A1',
}

const PREFS_KEY = 'tutor_prefs_v2'

export interface TutorLiveProps {
  tutorName: string
  tutorSlug: string
  avatarUrl: string | null
  geminiVoice?: string | null
}

// ── Equalizer bars ────────────────────────────────────────────────────────────
function EqualizerBars({ active, color }: { active: boolean; color: string }) {
  if (!active) return (
    <div className="flex items-end gap-[3px] h-7">
      {[...Array(5)].map((_, i) => <div key={i} className="w-1 rounded-sm h-1" style={{ backgroundColor: color, opacity: 0.3 }} />)}
    </div>
  )
  return (
    <div className="flex items-end gap-[3px] h-7">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="eq-bar w-1 rounded-sm" style={{ backgroundColor: color, height: '100%', animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  )
}

// ── Radio group ───────────────────────────────────────────────────────────────
function RadioGroup<T extends string>({ label, options, value, onChange }: {
  label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-italianto-700 dark:text-italianto-400 uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button key={opt.value} onClick={() => onChange(opt.value)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              value === opt.value
                ? 'bg-italianto-700 border-italianto-600 text-white dark:bg-italianto-800 dark:border-italianto-700'
                : 'bg-white dark:bg-[#132213] border-[#d4e4d4] dark:border-[#1e3a1e] text-gray-500 dark:text-[#4a7a4a] hover:border-italianto-400',
            )}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Audio helpers ─────────────────────────────────────────────────────────────
function float32ToBase64PCM16(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++)
    int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32767))
  const bytes = new Uint8Array(int16.buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return window.btoa(binary)
}

function base64PCM16ToFloat32(b64: string): Float32Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const int16 = new Int16Array(bytes.buffer)
  const float32 = new Float32Array(int16.length)
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768
  return float32
}

// ── Main component ────────────────────────────────────────────────────────────
export function TutorLive({
  tutorName, tutorSlug, avatarUrl: _avatarUrl, geminiVoice: _geminiVoice,
}: TutorLiveProps) {
  const router = useRouter()

  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [messages, setMessages]     = useState<Message[]>([])
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [prefs, setPrefs]           = useState<StudentPrefs>({ ...DEFAULT_PREFS, customName: tutorName })
  const [nameInput, setNameInput]   = useState(tutorName)
  const [error, setError]           = useState<string | null>(null)
  const [callDuration, setCallDuration] = useState(0)
  const [cameraOn, setCameraOn]     = useState(false)
  const [captureFlash, setCaptureFlash] = useState(false)

  const wsRef              = useRef<WebSocket | null>(null)
  const captureCtxRef      = useRef<AudioContext | null>(null)
  const playbackCtxRef     = useRef<AudioContext | null>(null)
  const captureWorkletRef  = useRef<AudioWorkletNode | null>(null)
  const playbackWorkletRef = useRef<AudioWorkletNode | null>(null)
  const micStreamRef       = useRef<MediaStream | null>(null)
  const videoRef           = useRef<HTMLVideoElement>(null)
  const canvasRef          = useRef<HTMLCanvasElement>(null)
  const videoStreamRef     = useRef<MediaStream | null>(null)
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrollRef          = useRef<HTMLDivElement>(null)
  const inCallRef          = useRef(false)
  const callTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null)

  const effectiveName = prefs.customName || tutorName
  const avatarSrc     = AVATAR_IMAGES[prefs.avatarId] ?? (_avatarUrl ?? '/default-avatar.png')
  const geminiVoice   = _geminiVoice ?? GEMINI_VOICE[prefs.avatarId] ?? GEMINI_VOICE[tutorSlug] ?? DEFAULT_GEMINI_VOICE

  const inCall       = callStatus !== 'idle'
  const isSpeaking   = callStatus === 'speaking'
  const isListening  = callStatus === 'listening'

  useEffect(() => {
    try {
      const s = localStorage.getItem(PREFS_KEY)
      if (s) {
        const loaded = { ...DEFAULT_PREFS, customName: tutorName, ...JSON.parse(s) }
        setPrefs(loaded)
        setNameInput(loaded.customName)
      }
    } catch {}
  }, [tutorName])

  const savePrefs = useCallback((next: StudentPrefs) => {
    setPrefs(next)
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch {}
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // ── WebSocket message handler ─────────────────────────────────────────────
  const handleWsMessage = useCallback(async (event: MessageEvent) => {
    let data: Record<string, unknown>
    try {
      const raw = typeof event.data === 'string'
        ? event.data
        : event.data instanceof Blob
        ? await event.data.text()
        : new TextDecoder().decode(event.data as ArrayBuffer)
      data = JSON.parse(raw)
    } catch { return }

    if (data?.setupComplete) { setCallStatus('listening'); return }

    if (data?.error) {
      const msg = (data.error as Record<string, unknown>)?.message ?? 'Gemini error'
      setError(`Gemini: ${String(msg)}`)
      doEndCall()
      return
    }

    const sc = data?.serverContent as Record<string, unknown> | undefined
    if (!sc) return

    const parts = (sc?.modelTurn as Record<string, unknown>)?.parts as Array<Record<string, unknown>> | undefined
    if (parts?.length && ttsEnabled) {
      for (const part of parts) {
        const inline = part.inlineData as Record<string, string> | undefined
        if (inline?.data && playbackWorkletRef.current) {
          const float32 = base64PCM16ToFloat32(inline.data)
          playbackWorkletRef.current.port.postMessage(float32)
          setCallStatus('speaking')
        }
      }
    }

    const inTx = sc?.inputTranscription as Record<string, unknown> | undefined
    if (inTx?.text) {
      const text = inTx.text as string
      const finished = !!(inTx.finished)
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'user' && last?.partial) return [...prev.slice(0, -1), { role: 'user', text, partial: !finished }]
        return [...prev, { role: 'user', text, partial: !finished }]
      })
    }

    const outTx = sc?.outputTranscription as Record<string, unknown> | undefined
    if (outTx?.text) {
      const text = outTx.text as string
      const finished = !!(outTx.finished)
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && last?.partial) return [...prev.slice(0, -1), { role: 'assistant', text, partial: !finished }]
        return [...prev, { role: 'assistant', text, partial: !finished }]
      })
    }

    if (sc?.turnComplete) setCallStatus('listening')

    if (sc?.interrupted) {
      setCallStatus('listening')
      playbackWorkletRef.current?.port.postMessage('interrupt')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsEnabled])

  // ── Audio capture ─────────────────────────────────────────────────────────
  const startAudioCapture = useCallback(async () => {
    const stream = micStreamRef.current!
    const ctx = captureCtxRef.current!
    await ctx.resume()
    await ctx.audioWorklet.addModule('/app/audio-processors/capture.worklet.js')
    const worklet = new AudioWorkletNode(ctx, 'audio-capture-processor')
    captureWorkletRef.current = worklet
    worklet.port.onmessage = (e: MessageEvent) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return
      const b64 = float32ToBase64PCM16(e.data.data as Float32Array)
      wsRef.current.send(JSON.stringify({ realtimeInput: { audio: { mimeType: 'audio/pcm', data: b64 } } }))
    }
    ctx.createMediaStreamSource(stream).connect(worklet)
  }, [])

  // ── Audio playback ────────────────────────────────────────────────────────
  const startAudioPlayback = useCallback(async () => {
    const ctx = playbackCtxRef.current!
    await ctx.resume()
    await ctx.audioWorklet.addModule('/app/audio-processors/playback.worklet.js')
    const worklet = new AudioWorkletNode(ctx, 'pcm-processor')
    playbackWorkletRef.current = worklet
    const gain = ctx.createGain()
    gain.gain.value = 1.0
    worklet.connect(gain)
    gain.connect(ctx.destination)
  }, [])

  // ── Camera ────────────────────────────────────────────────────────────────
  const startVideoFrames = useCallback(() => {
    if (captureIntervalRef.current) return
    captureIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !canvasRef.current) return
      if (wsRef.current?.readyState !== WebSocket.OPEN) return
      const video = videoRef.current
      if (video.videoWidth === 0) return
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0)
      const b64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1]
      if (b64 && b64.length > 300) {
        wsRef.current!.send(JSON.stringify({
          realtimeInput: { video: { mimeType: 'image/jpeg', data: b64 } },
        }))
        setCaptureFlash(true)
        setTimeout(() => setCaptureFlash(false), 120)
      }
    }, 1000)
  }, [])

  const stopVideoFrames = useCallback(() => {
    if (captureIntervalRef.current) { clearInterval(captureIntervalRef.current); captureIntervalRef.current = null }
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      videoStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
      setCameraOn(true)
      setError(null)
      if (wsRef.current?.readyState === WebSocket.OPEN) startVideoFrames()
    } catch {
      setError('No se pudo acceder a la cámara.')
    }
  }, [startVideoFrames])

  const stopCamera = useCallback(() => {
    stopVideoFrames()
    videoStreamRef.current?.getTracks().forEach(t => t.stop())
    videoStreamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false)
  }, [stopVideoFrames])

  // ── End call ──────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const doEndCall = useCallback(() => {
    inCallRef.current = false
    setCallStatus('idle')

    wsRef.current?.close(); wsRef.current = null

    captureWorkletRef.current?.disconnect()
    captureWorkletRef.current?.port.close()
    captureWorkletRef.current = null
    captureCtxRef.current?.close(); captureCtxRef.current = null
    micStreamRef.current?.getTracks().forEach(t => t.stop()); micStreamRef.current = null

    playbackWorkletRef.current?.disconnect()
    playbackWorkletRef.current = null
    playbackCtxRef.current?.close(); playbackCtxRef.current = null

    stopVideoFrames()

    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null }
  }, [stopVideoFrames])

  useEffect(() => () => { doEndCall() }, [doEndCall])

  // ── Start call ────────────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    inCallRef.current = true
    setCallStatus('connecting')
    setMessages([])
    setCallDuration(0)
    setError(null)

    // AudioContexts MUST be created synchronously inside user gesture
    captureCtxRef.current = new AudioContext({ sampleRate: 16000 })
    playbackCtxRef.current = new AudioContext({ sampleRate: 24000 })
    callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000)

    try {
      micStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })

      const tokenRes = await fetch('/api/tutor/live-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutorName: effectiveName, prefs }),
      })
      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}))
        throw new Error((err as Record<string, string>).error ?? `Token error ${tokenRes.status}`)
      }
      const { token, systemPrompt, wsBase, model } = await tokenRes.json() as {
        token: string; systemPrompt: string; wsBase: string; model: string
      }

      const ws = new WebSocket(`${wsBase}?key=${token}`)
      wsRef.current = ws

      ws.onopen = async () => {
        try {
          const silenceMs = prefs.livello === 'B2' ? 600 : prefs.livello === 'B1' ? 700 : prefs.livello === 'A2' ? 900 : 1000
          ws.send(JSON.stringify({
            setup: {
              model: `models/${model}`,
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: geminiVoice } },
                },
                thinkingConfig: { thinkingLevel: 'minimal' },
              },
              systemInstruction: { parts: [{ text: systemPrompt }] },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              realtimeInputConfig: {
                automaticActivityDetection: {
                  disabled: false,
                  silenceDurationMs: silenceMs,
                  prefixPaddingMs: 200,
                },
                turnCoverage: 'TURN_INCLUDES_ONLY_ACTIVITY',
              },
            },
          }))

          await startAudioPlayback()
          await startAudioCapture()

          if (cameraOn) startVideoFrames()
        } catch (err) {
          setError('Error en la configuración: ' + (err instanceof Error ? err.message : String(err)))
          doEndCall()
        }
      }

      ws.onmessage = handleWsMessage
      ws.onerror = () => setError('Error de conexión WebSocket.')
      ws.onclose = e => {
        if (inCallRef.current) {
          setError(`Sesión cerrada (${e.code}${e.reason ? ': ' + e.reason : ''})`)
        }
        inCallRef.current = false
        setCallStatus('idle')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar la sesión')
      doEndCall()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs, effectiveName, geminiVoice, cameraOn, startAudioCapture, startAudioPlayback, startVideoFrames, handleWsMessage])

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  // ── Settings panel ────────────────────────────────────────────────────────
  if (showSettings) {
    const AVATAR_OPTIONS = [
      { id: 'marco' as AvatarId, name: 'Marco', gender: 'male' },
      { id: 'giovanni' as AvatarId, name: 'Giovanni', gender: 'male' },
      { id: 'giulia' as AvatarId, name: 'Giulia', gender: 'female' },
      { id: 'francesca' as AvatarId, name: 'Francesca', gender: 'female' },
    ]
    return (
      <div className="flex flex-col h-full bg-[#f5f7f5] dark:bg-[#0d1a0d]">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#d4e4d4] dark:border-[#1e3a1e] shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={15} className="text-italianto-700 dark:text-italianto-400" />
            <span className="font-bold text-gray-800 dark:text-[#c8e6c9] text-sm">Personalizza il tutor</span>
          </div>
          <button onClick={() => setShowSettings(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-[#c8e6c9]">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-italianto-700 dark:text-italianto-400 uppercase tracking-wide">Avatar del tutor</p>
            <div className="grid grid-cols-4 gap-2">
              {AVATAR_OPTIONS.map(av => (
                <button key={av.id} onClick={() => savePrefs({ ...prefs, avatarId: av.id })}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-1.5 rounded-xl border transition-all',
                    prefs.avatarId === av.id
                      ? 'border-italianto-500 bg-italianto-50 dark:bg-italianto-900/30 ring-1 ring-italianto-400/40'
                      : 'border-[#d4e4d4] dark:border-[#1e3a1e] hover:border-italianto-300',
                  )}>
                  <div className="relative size-14 rounded-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={AVATAR_IMAGES[av.id]} alt={av.name} className="size-full object-cover" />
                    {prefs.avatarId === av.id && (
                      <div className="absolute inset-0 bg-italianto-500/20 flex items-center justify-center">
                        <Check size={16} className="text-italianto-700 dark:text-italianto-300" />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-600 dark:text-[#4a7a4a] font-medium">{av.name}</span>
                  <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full',
                    av.gender === 'male' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300'
                      : 'bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-300')}>
                    {av.gender === 'male' ? '♂ Uomo' : '♀ Donna'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-italianto-700 dark:text-italianto-400 uppercase tracking-wide">Nombre del tutor</p>
            <div className="flex gap-2">
              <input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)} maxLength={24}
                className="flex-1 bg-white dark:bg-[#132213] border border-[#d4e4d4] dark:border-[#1e3a1e] rounded-xl px-4 py-2.5 text-sm
                  text-gray-800 dark:text-[#c8e6c9] placeholder:text-gray-300 dark:placeholder:text-[#2a4a2a]
                  focus:outline-none focus:ring-1 focus:ring-italianto-500" />
              <button onClick={() => savePrefs({ ...prefs, customName: nameInput.trim() || tutorName })}
                className="px-3 py-2 bg-italianto-700 hover:bg-italianto-800 text-white text-xs font-semibold rounded-xl transition-colors">OK</button>
            </div>
          </div>

          <div className="border-t border-[#d4e4d4] dark:border-[#1e3a1e] pt-4 space-y-5">
            <p className="text-xs font-semibold text-italianto-700 dark:text-italianto-400 uppercase tracking-wide">Preferenze sessione</p>

            <RadioGroup label="Nivel" value={prefs.livello} onChange={v => savePrefs({ ...prefs, livello: v })}
              options={[
                { value: 'A1', label: 'A1 — Principiante' },
                { value: 'A2', label: 'A2 — Base' },
                { value: 'B1', label: 'B1 — Intermedio' },
                { value: 'B2', label: 'B2 — Avanzado' },
              ]} />

            <RadioGroup label="Registro" value={prefs.registro} onChange={v => savePrefs({ ...prefs, registro: v })}
              options={[{ value: 'informale', label: 'Informale (tu)' }, { value: 'formale', label: 'Formale (Lei)' }]} />

            <RadioGroup label="Tono" value={prefs.tono} onChange={v => savePrefs({ ...prefs, tono: v })}
              options={[{ value: 'amichevole', label: 'Amichevole' }, { value: 'professionale', label: 'Professionale' }, { value: 'incoraggiante', label: 'Incoraggiante' }]} />

            <RadioGroup label="Focus" value={prefs.focus} onChange={v => savePrefs({ ...prefs, focus: v })}
              options={[{ value: 'conversazione', label: 'Conversazione' }, { value: 'grammatica', label: 'Grammatica' }, { value: 'vocabolario', label: 'Vocabolario' }, { value: 'pronuncia', label: 'Pronuncia' }]} />

            <RadioGroup label="Modismi" value={prefs.modismi} onChange={v => savePrefs({ ...prefs, modismi: v })}
              options={[{ value: 'neutro', label: 'Neutro' }, { value: 'roma', label: 'Romano' }, { value: 'milano', label: 'Milanese' }, { value: 'napoli', label: 'Napoletano' }]} />
          </div>
        </div>

        <div className="px-4 pb-5 pt-2 border-t border-[#d4e4d4] dark:border-[#1e3a1e] shrink-0">
          <button onClick={() => setShowSettings(false)}
            className="w-full py-3 bg-italianto-700 hover:bg-italianto-800 text-white text-sm font-semibold rounded-xl transition-colors">
            Salva e torna alla conversazione
          </button>
        </div>
      </div>
    )
  }

  // ── Main UI ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#f5f7f5] dark:bg-[#0d1a0d]">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#d4e4d4] dark:border-[#1e3a1e] shrink-0 bg-white/80 dark:bg-[#0d1a0d]/80 backdrop-blur">
        <button onClick={() => { doEndCall(); router.push('/tutor') }}
          className="p-2 rounded-xl text-gray-400 hover:text-italianto-700 dark:hover:text-italianto-400 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="text-center">
          <p className="font-bold text-gray-800 dark:text-[#c8e6c9] text-sm">{effectiveName}</p>
          <p className="text-xs text-gray-400 dark:text-[#4a7a4a] capitalize">{prefs.tono} · {prefs.livello}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setTtsEnabled(v => !v)}
            className={cn('p-2 rounded-xl transition-colors',
              ttsEnabled ? 'text-italianto-600 dark:text-italianto-400' : 'text-gray-300 dark:text-[#2a4a2a]')}>
            {ttsEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button onClick={() => { if (inCall) return; setShowSettings(true) }}
            className={cn('p-2 rounded-xl transition-colors',
              inCall ? 'text-gray-200 dark:text-[#1e3a1e] cursor-not-allowed' : 'text-gray-400 hover:text-italianto-700 dark:hover:text-italianto-400')}>
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Tutor avatar */}
      <div className="flex flex-col items-center pt-6 pb-4 shrink-0">
        <motion.div
          animate={isSpeaking ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={isSpeaking ? { repeat: Infinity, duration: 1.2 } : {}}
          className={cn(
            'size-28 rounded-full overflow-hidden ring-4 shadow-green-lg transition-all',
            isSpeaking ? 'ring-italianto-500' : inCall ? 'ring-italianto-700/60' : 'ring-[#d4e4d4] dark:ring-[#1e3a1e]',
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarSrc} alt={effectiveName} className="size-full object-cover"
            onError={e => {
              const el = e.target as HTMLImageElement
              el.style.display = 'none'
              if (el.parentElement) el.parentElement.style.background = '#2e7d32'
            }} />
        </motion.div>

        <h2 className="mt-4 text-xl font-bold text-gray-800 dark:text-[#c8e6c9]">{effectiveName}</h2>

        <AnimatePresence mode="wait">
          <motion.p key={callStatus} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={cn('mt-1 text-xs font-medium', {
              'text-gray-400 dark:text-[#3a5a3a]': callStatus === 'idle',
              'text-amber-400 animate-pulse': callStatus === 'connecting',
              'text-blue-400': callStatus === 'listening',
              'text-italianto-500': callStatus === 'speaking',
            })}>
            {callStatus === 'idle'       && 'Premi "Inizia" per parlare con il tutor'}
            {callStatus === 'connecting' && 'Connessione in corso...'}
            {callStatus === 'listening'  && '🎙 In ascolto...'}
            {callStatus === 'speaking'   && `${effectiveName} sta parlando...`}
          </motion.p>
        </AnimatePresence>

        {inCall && (
          <div className="flex items-center gap-6 mt-4">
            <div className="flex flex-col items-center gap-1">
              <EqualizerBars active={isSpeaking} color="#388e3c" />
              <span className="text-[10px] text-gray-400 dark:text-[#3a5a3a]">{effectiveName}</span>
            </div>
            <div className="text-xs font-mono text-gray-400 dark:text-[#3a5a3a]">{formatDuration(callDuration)}</div>
            <div className="flex flex-col items-center gap-1">
              <EqualizerBars active={isListening} color="#2196f3" />
              <span className="text-[10px] text-gray-400 dark:text-[#3a5a3a]">Tu</span>
            </div>
          </div>
        )}
      </div>

      {/* Camera preview — always mounted so videoRef is valid */}
      <div className={cn('relative overflow-hidden transition-all duration-300 mx-4', cameraOn ? 'block' : 'hidden')}>
        <video ref={videoRef} className="w-full max-h-40 object-cover rounded-xl bg-black" muted playsInline />
        <AnimatePresence>
          {captureFlash && (
            <motion.div initial={{ opacity: 0.5 }} animate={{ opacity: 0 }} transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-white rounded-xl pointer-events-none" />
          )}
        </AnimatePresence>
        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 rounded-full px-2 py-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-white text-[10px] font-semibold tracking-wide">LIVE</span>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 space-y-2 py-2 min-h-0">
        {messages.length === 0 && !inCall && (
          <div className="text-center py-8 text-gray-400 dark:text-[#3a5a3a] text-sm">
            <p>Avvia la sessione per iniziare a parlare in italiano.</p>
            <p className="text-xs mt-1 text-gray-300 dark:text-[#2a4a2a]">La conversazione verrà mostrata qui.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
              msg.partial ? 'opacity-60' : '',
              msg.role === 'user'
                ? 'bg-italianto-700 text-white rounded-br-sm'
                : 'bg-white dark:bg-[#132213] border border-[#d4e4d4] dark:border-[#1e3a1e] text-gray-800 dark:text-[#c8e6c9] rounded-bl-sm',
            )}>
              {msg.text}
              {msg.partial && <span className="ml-1 animate-pulse">●</span>}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-xl text-red-600 dark:text-red-400 text-xs">
          <AlertCircle size={13} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Controls */}
      <div className="flex justify-center items-center gap-6 px-8 pb-6 pt-3 shrink-0">
        {!inCall ? (
          <motion.button whileTap={{ scale: 0.93 }} onClick={startCall}
            className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-italianto-700 hover:bg-italianto-800 text-white font-semibold shadow-green-lg transition-colors">
            <Phone size={20} />
            Inizia sessione
          </motion.button>
        ) : (
          <motion.button whileTap={{ scale: 0.93 }} onClick={doEndCall}
            className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-lg transition-colors">
            <PhoneOff size={20} />
            Termina sessione
          </motion.button>
        )}

        {inCall && (
          <button onClick={() => setTtsEnabled(v => !v)}
            className={cn('size-12 rounded-full flex items-center justify-center border transition-colors',
              ttsEnabled
                ? 'border-[#d4e4d4] dark:border-italianto-700 text-italianto-600 dark:text-italianto-400 hover:border-italianto-500'
                : 'border-red-200 dark:border-red-800/40 text-red-500 bg-red-50 dark:bg-red-950/20',
            )}>
            {ttsEnabled ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
        )}

        <button onClick={() => { if (cameraOn) stopCamera(); else startCamera() }}
          className={cn('size-12 rounded-full flex items-center justify-center border transition-colors',
            cameraOn
              ? 'border-italianto-500 text-italianto-600 dark:text-italianto-400 bg-italianto-50 dark:bg-italianto-900/30'
              : 'border-[#d4e4d4] dark:border-[#1e3a1e] text-gray-400 dark:text-[#4a7a4a] hover:border-italianto-400 hover:text-italianto-600',
          )}>
          {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
        </button>
      </div>
    </div>
  )
}
