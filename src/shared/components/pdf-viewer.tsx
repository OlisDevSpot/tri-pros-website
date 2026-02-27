'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'

interface Props {
  url: string // pass from server when possible
  title?: string
  height?: string // e.g. "80vh"
  className?: string
}

export function PdfViewer({
  url,
  title = 'PDF',
  height = '80vh',
  className = '',
}: Props) {
  const [hover, setHover] = useState(false)
  const [busy, setBusy] = useState(false)

  const openInNewTab = async () => {
    setBusy(true)
    try {
      window.open(url, '_blank', 'noreferrer')
    }
    finally {
      setBusy(false)
    }
  }

  return (
    <div className={`w-full h-full border-5 border-yellow-500 ${className}`}>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="group relative flex-1 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/10 h-full border-5"
        style={{ height }}
      >
        <iframe
          src={url}
          title={title}
          className="h-full w-full"
          style={{ border: 'none' }}
        />

        {/* Soft scrim */}
        <AnimatePresence>
          {hover && (
            <motion.div
              className="pointer-events-none absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                background:
                  'radial-gradient(900px 450px at 50% 50%, rgba(0,0,0,0.22), rgba(0,0,0,0.08) 55%, rgba(0,0,0,0) 75%)',
              }}
            />
          )}
        </AnimatePresence>

        {/* Center controls */}
        <AnimatePresence>
          {hover && (
            <motion.div
              className="absolute inset-0 grid place-items-center pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <motion.div
                className="pointer-events-auto flex items-center gap-2 rounded-full bg-background/90 px-3 py-2 shadow-lg ring-1 ring-black/10 backdrop-blur"
                initial={{ y: 10, scale: 0.98, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                exit={{ y: 10, scale: 0.98, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              >
                <button
                  type="button"
                  onClick={openInNewTab}
                  className="rounded-full px-3 py-1.5 text-sm font-medium hover:bg-background/5"
                  disabled={busy}
                >
                  {busy ? 'Opening…' : 'View in Full'}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
