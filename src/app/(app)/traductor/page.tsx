'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeftRight, Copy, Loader2, Languages } from 'lucide-react'
import { cn } from '@/lib/utils'

const LANGS = [
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
]

export default function TraductorPage() {
  const [source, setSource] = useState('es')
  const [target, setTarget] = useState('it')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const swap = () => {
    setSource(target); setTarget(source)
    setInput(output); setOutput('')
  }

  const translate = async () => {
    if (!input.trim() || loading) return
    setLoading(true); setError(''); setOutput('')
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input, source, target }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Errore di traduzione'); return }
      setOutput(data.translation)
    } catch {
      setError('Errore di rete')
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-5 max-w-md mx-auto w-full space-y-4">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-italianto-800 dark:text-italianto-300 flex items-center gap-2">
          <Languages size={20} /> Traduttore
        </h1>
        <p className="text-xs text-gray-400 dark:text-[#4a7a4a] mt-0.5">Powered by DeepL</p>
      </div>

      {/* Language selector */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <select
            value={source}
            onChange={e => setSource(e.target.value)}
            className="w-full py-2.5 px-3 rounded-xl border border-[#d4e4d4] dark:border-[#1e3a1e] bg-white dark:bg-[#132213] text-sm text-gray-700 dark:text-[#c8e6c9] focus:outline-none focus:ring-2 focus:ring-italianto-500/40"
          >
            {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
        <button onClick={swap} className="p-2.5 rounded-xl border border-[#d4e4d4] dark:border-[#1e3a1e] text-gray-400 hover:text-italianto-600 dark:hover:text-italianto-400 transition-colors">
          <ArrowLeftRight size={16} />
        </button>
        <div className="flex-1">
          <select
            value={target}
            onChange={e => setTarget(e.target.value)}
            className="w-full py-2.5 px-3 rounded-xl border border-[#d4e4d4] dark:border-[#1e3a1e] bg-white dark:bg-[#132213] text-sm text-gray-700 dark:text-[#c8e6c9] focus:outline-none focus:ring-2 focus:ring-italianto-500/40"
          >
            {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
      </div>

      {/* Input */}
      <div className="rounded-2xl border border-[#d4e4d4] dark:border-[#1e3a1e] bg-white dark:bg-[#132213] overflow-hidden">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) translate() }}
          placeholder="Inserisci il testo da tradurre..."
          rows={4}
          className="w-full px-4 py-3 text-sm text-gray-800 dark:text-[#c8e6c9] placeholder:text-gray-300 dark:placeholder:text-[#2a4a2a] bg-transparent resize-none focus:outline-none"
        />
        <div className="flex justify-between items-center px-4 py-2 border-t border-[#d4e4d4] dark:border-[#1e3a1e]">
          <span className="text-xs text-gray-300 dark:text-[#2a4a2a]">{input.length} caratteri</span>
          <button
            onClick={() => { setInput(''); setOutput('') }}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-[#c8e6c9] transition-colors"
          >
            Cancella
          </button>
        </div>
      </div>

      {/* Translate button */}
      <button
        onClick={translate}
        disabled={!input.trim() || loading || source === target}
        className="w-full py-3 bg-italianto-700 hover:bg-italianto-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <><Loader2 size={15} className="animate-spin" /> Traduzione in corso...</> : 'Traduci'}
      </button>

      {/* Error */}
      {error && <p className="text-red-500 text-sm bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-4 py-3">{error}</p>}

      {/* Output */}
      <AnimatePresence>
        {output && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-italianto-200 dark:border-[#1e4a1e] bg-[#f0f7f0] dark:bg-[#0d2a0d] overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-italianto-200 dark:border-[#1e4a1e]">
              <span className="text-xs font-semibold text-italianto-600 dark:text-italianto-400">
                {LANGS.find(l => l.code === target)?.label}
              </span>
              <button onClick={copy} className={cn('text-xs transition-colors', copied ? 'text-italianto-600' : 'text-gray-400 hover:text-italianto-600')}>
                <Copy size={14} />
              </button>
            </div>
            <p className="px-4 py-3 text-sm text-gray-800 dark:text-[#c8e6c9] leading-relaxed">{output}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-[10px] text-gray-300 dark:text-[#2a4a2a] text-center">Ctrl+Enter per tradurre velocemente</p>
    </div>
  )
}
