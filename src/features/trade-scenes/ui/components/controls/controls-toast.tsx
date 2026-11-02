'use client'

import { motion, useReducedMotion } from 'motion/react'

import { CONTROLS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { CONTROLS_EASE } from '@/features/trade-scenes/constants/scene-layout'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'

// Says the scene switched to the build when Benefits switched it, since the toggle was not what the rep pressed.
// The live region stays mounted, so each new toast inside it is announced.
export function ControlsToast() {
  const { toast } = useSceneControls()
  const reduceMotion = useReducedMotion()

  return (
    <div role="status" className="pointer-events-none absolute inset-x-0 top-3.5 z-40 flex justify-center">
      {toast > 0 && (
        <motion.div
          key={toast}
          initial={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
          animate={reduceMotion ? { opacity: [1, 0] } : { opacity: [0, 1, 1, 0], y: [-6, 0, 0, 0] }}
          // Reduced, it holds and then goes at once.
          transition={reduceMotion
            ? { duration: 1.9, ease: progress => (progress < 0.8 ? 0 : 1) }
            : { duration: 1.9, times: [0, 0.12, 0.8, 1], ease: CONTROLS_EASE }}
          className="rounded-full bg-primary px-3.5 py-2 text-sm font-bold whitespace-nowrap text-primary-foreground shadow-2xl"
        >
          {CONTROLS_COPY.benefits.toast}
        </motion.div>
      )}
    </div>
  )
}
