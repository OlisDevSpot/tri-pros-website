'use client'

import type { ReactNode } from 'react'

import { motion, useReducedMotion } from 'motion/react'

import { SCENE_LOAD } from '@/features/trade-scenes/constants/scene-load'
import { useSceneLoad } from '@/features/trade-scenes/contexts/scene-load-context'
import { BRAND_EASE } from '@/shared/constants/motion'

interface BlueprintFadeProps {
  durationMs: number
  delayMs?: number
  onFaded?: () => void
  children: ReactNode
}

export function BlueprintFade({ durationMs, delayMs = 0, onFaded, children }: BlueprintFadeProps) {
  const handover = useSceneLoad(state => state.phase === 'handover')
  const reduced = useReducedMotion() ?? false
  const transition = reduced
    ? { duration: SCENE_LOAD.reducedFadeMs / 1000, ease: BRAND_EASE }
    : { duration: durationMs / 1000, delay: delayMs / 1000, ease: BRAND_EASE }

  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      initial={false}
      animate={{ opacity: handover ? 0 : 1 }}
      transition={transition}
      onAnimationComplete={() => {
        if (handover) {
          onFaded?.()
        }
      }}
    >
      {children}
    </motion.div>
  )
}
