'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'

/**
 * Animated splash screen shown once per session when the PWA/app is opened.
 * Matches Dialoghi Studio animation: fade+scale → rotate 360° → pulse ×2 → fade out.
 * Duration: ~3 seconds total.
 */
export default function SplashScreen() {
  const [visible, setVisible] = useState(false)
  const [phase, setPhase] = useState<'enter' | 'pulse' | 'exit'>('enter')

  useEffect(() => {
    try {
      const shown = sessionStorage.getItem('ia_splash')
      if (!shown) {
        sessionStorage.setItem('ia_splash', '1')
        setVisible(true)
        setTimeout(() => setPhase('pulse'), 1300)
        setTimeout(() => setPhase('exit'), 2200)
        setTimeout(() => setVisible(false), 2750)
      }
    } catch {
      // sessionStorage unavailable — skip silently
    }
  }, [])

  if (!visible) return null

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden select-none"
      style={{ backgroundColor: '#2e7d32' }}
      animate={{ opacity: phase === 'exit' ? 0 : 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* Background glow */}
      <div
        className="absolute rounded-full"
        style={{
          width: '80vw',
          height: '80vw',
          maxWidth: 380,
          maxHeight: 380,
          backgroundColor: 'rgba(255,255,255,0.08)',
        }}
      />

      {/* Decorative ring 1 */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 300, height: 300, border: '1.5px solid rgba(255,255,255,0.2)' }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />

      {/* Decorative ring 2 */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 410, height: 410, border: '1.5px solid rgba(255,255,255,0.1)' }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
      />

      {/* Logo — fade+scale → rotate 360° → pulse ×2 */}
      <motion.div
        className="relative z-10"
        initial={{ opacity: 0, scale: 0.3, rotate: 0 }}
        animate={
          phase === 'enter'
            ? { opacity: 1, scale: 1, rotate: 360 }
            : { scale: [1, 1.1, 1, 1.1, 1], rotate: 360 }
        }
        transition={
          phase === 'enter'
            ? {
                opacity: { duration: 0.6, ease: 'easeOut' },
                scale: { type: 'spring', stiffness: 50, damping: 7 },
                rotate: { type: 'spring', stiffness: 40, damping: 8, delay: 0.65 },
              }
            : {
                scale: {
                  duration: 0.8,
                  ease: 'easeInOut',
                  times: [0, 0.25, 0.5, 0.75, 1],
                },
              }
        }
      >
        <Image
          src="/app/icon-192.png"
          alt="Italianto"
          width={160}
          height={160}
          priority
          className="rounded-3xl shadow-2xl"
        />
      </motion.div>

      {/* App name */}
      <motion.p
        className="relative z-10 mt-6 text-white font-bold text-xl tracking-widest uppercase"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.85, ease: 'easeOut' }}
      >
        Italianto
      </motion.p>

      <motion.p
        className="relative z-10 mt-1 text-white/60 text-xs tracking-wider"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.1 }}
      >
        Aprende italiano con IA
      </motion.p>
    </motion.div>
  )
}
