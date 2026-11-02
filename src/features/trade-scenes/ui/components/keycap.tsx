'use client'

import { motion, useReducedMotion } from 'motion/react'

import { KEYCAP_CLASS } from '@/features/trade-scenes/constants/scene-shortcuts'
import { useKeysInUse } from '@/features/trade-scenes/hooks/use-keys-in-use'
import { SCENE_MOTION } from '@/shared/components/scene/constants/scene-motion'
import { cn } from '@/shared/lib/utils'

interface KeycapProps {
  keyLabel: string
  // Moves the cap off the top-right corner where that corner would cover the control's label.
  className?: string
}

// Pinned in its control's top-right corner, so a cap arriving never moves or resizes what it sits on. Hidden from
// assistive tech: the control's `aria-keyshortcuts` and the shortcut-keys dialog say the same thing.
export function Keycap({ keyLabel, className }: KeycapProps) {
  const [inUse] = useKeysInUse()
  const reduceMotion = useReducedMotion()
  if (!inUse) {
    return null
  }
  return (
    <motion.kbd
      aria-hidden
      initial={reduceMotion ? false : { opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SCENE_MOTION.transition, duration: SCENE_MOTION.transition.duration / 2 }}
      className={cn(KEYCAP_CLASS, 'pointer-events-none absolute top-0.75 right-0.75 h-4 min-w-4', className)}
    >
      {keyLabel}
    </motion.kbd>
  )
}
