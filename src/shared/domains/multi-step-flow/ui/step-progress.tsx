'use client'

import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/shared/lib/utils'
import { STEP_TRANSITION } from '../constants/step-motion'

interface StepProgressProps {
  total: number
  /** 0-based index of the current step. */
  currentIndex: number
}

export function StepProgress({ total, currentIndex }: StepProgressProps) {
  const reduce = useReducedMotion()
  const pct = total > 0 ? Math.min(100, Math.round(((currentIndex + 1) / total) * 100)) : 0

  return (
    <div className={cn('h-1 w-full overflow-hidden rounded-full bg-muted')}>
      <motion.div
        animate={{ width: `${pct}%` }}
        className="h-full rounded-full bg-primary"
        initial={reduce ? false : { width: 0 }}
        transition={STEP_TRANSITION}
      />
    </div>
  )
}
