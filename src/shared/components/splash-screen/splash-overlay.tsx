'use client'

import { AnimatePresence, motion } from 'motion/react'
import { SplashAnimation } from '@/shared/components/splash-screen/splash-animation'

interface SplashOverlayProps {
  visible: boolean
  motionKey: string
}

export function SplashOverlay({ visible, motionKey }: SplashOverlayProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={motionKey}
          className="fixed inset-0 z-9999 flex items-center justify-center"
          style={{ backgroundColor: '#09090b' }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <SplashAnimation />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
