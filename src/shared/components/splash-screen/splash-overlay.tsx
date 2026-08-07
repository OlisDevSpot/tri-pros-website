'use client'

import { AnimatePresence, motion } from 'motion/react'
import { SplashAnimation } from '@/shared/components/splash-screen/splash-animation'

interface SplashOverlayProps {
  visible: boolean
  motionKey: string
  // Launch canvas color. Defaults to the near-black used by the proposal
  // splash; the installed-PWA splash passes var(--launch-canvas) so pre-paint →
  // splash → dashboard share one slate and the reveal has no color seam.
  backgroundColor?: string
}

export function SplashOverlay({ visible, motionKey, backgroundColor = '#09090b' }: SplashOverlayProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={motionKey}
          className="fixed inset-0 z-9999 flex items-center justify-center"
          style={{ backgroundColor }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <SplashAnimation />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
