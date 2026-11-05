'use client'

import { motion, useReducedMotion } from 'motion/react'

import { CONTROLS_EASE } from '@/features/trade-scenes/constants/scene-layout'

// Inside the stage, so it dims the scene and leaves the sidebar alone. It lets presses through: the window closes on a
// press outside it, and a press on a part pin must still reach the pin to zoom.
export function ControlsScrim() {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      aria-hidden
      data-controls-scrim
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16, ease: CONTROLS_EASE }}
      className="pointer-events-none absolute inset-0 z-20 bg-[oklch(var(--presentation-scrim)/0.45)]"
    />
  )
}
