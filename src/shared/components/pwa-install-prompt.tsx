'use client'

import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'

const DISMISS_KEY = 'pwa-install-dismissed'
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }
  const ua = navigator.userAgent
  return (
    (/iPhone|iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
    && /Safari/.test(ua)
    && !/CriOS|FxiOS/.test(ua)
  )
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  )
}

function isDismissed(): boolean {
  if (typeof window === 'undefined') {
    return true
  }
  const dismissed = localStorage.getItem(DISMISS_KEY)
  if (!dismissed) {
    return false
  }
  const dismissedAt = Number.parseInt(dismissed, 10)
  if (Date.now() - dismissedAt > DISMISS_DURATION_MS) {
    localStorage.removeItem(DISMISS_KEY)
    return false
  }
  return true
}

// Inline share icon matching iOS Safari's share button
function ShareIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block align-text-bottom text-[#03AFED]"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

export function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isStandalone() || isDismissed() || !isIOSSafari()) {
      return
    }
    const timer = setTimeout(() => {
      setVisible(true)
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed right-4 bottom-6 left-4 z-50 mx-auto max-w-sm rounded-xl border border-white/10 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={dismiss}
            className="absolute top-3 right-3 rounded-md p-1 text-white/40 transition-colors hover:text-white/70"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>

          <p className="pr-6 text-sm font-medium text-white">
            Install Tri Pros
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-white/60">
            Tap
            {' '}
            <ShareIcon />
            {' '}
            in the toolbar below, then
            {' '}
            <span className="font-medium text-white/80">
              &quot;Add to Home Screen&quot;
            </span>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
