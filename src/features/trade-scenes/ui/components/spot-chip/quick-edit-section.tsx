'use client'

import type { ReactNode } from 'react'

import { motion, useReducedMotion } from 'motion/react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_EASE, SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'

interface QuickEditSectionProps {
  index: number
  // Only while quick edit opens: a flip between the sides shows its rows at once.
  rise: boolean
  children: ReactNode
}

export function QuickEditSection({ index, rise, children }: QuickEditSectionProps) {
  const reduced = useReducedMotion()
  const { rise: distance, riseMs, riseStaggerMs } = SCENE_LAYOUT.spotChip
  const rising = rise && !reduced
  return (
    <motion.div
      initial={rising ? { opacity: 0, y: distance } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: riseMs / 1000, ease: CONTROLS_EASE, delay: (index * riseStaggerMs) / 1000 }}
      className={CONTROLS_CLASSES.quickEditSection}
    >
      {children}
    </motion.div>
  )
}
