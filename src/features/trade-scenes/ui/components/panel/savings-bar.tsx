// LAZY: Parked for the Benefits interior; re-homed or deleted there.
'use client'

import type { ReactNode } from 'react'

import { motion, useReducedMotion } from 'motion/react'

import { CountedDollars } from '@/features/trade-scenes/ui/components/panel/counted-dollars'
import { EstimateDisclosure } from '@/features/trade-scenes/ui/components/panel/estimate-disclosure'
import { SCENE_MOTION } from '@/shared/components/scene/constants/scene-motion'

interface SavingsBarProps {
  label: string
  // Null when this source saves nothing: a dash and no bar, never $0.
  monthly: number | null
  // The largest figure among the bars, so the biggest saving fills its track.
  max: number
  disclosure: readonly string[]
  children?: ReactNode
}

// One row of the bars' shared grid, so every track starts and ends at the same x whatever its label or figure.
export function SavingsBar({ label, monthly, max, disclosure, children }: SavingsBarProps) {
  const reduceMotion = useReducedMotion()

  return (
    <li className="col-span-full grid grid-cols-subgrid items-center gap-y-2">
      <span className="text-sm font-semibold">{label}</span>
      {/* The stage's ground sits at the muted rung, so a muted track would vanish into it; the hairline's tone still reads. */}
      <span aria-hidden className="h-2.5 overflow-hidden rounded-full bg-border">
        {monthly !== null && (
          // The fill is drawn whole and rounded, then cut back from the right, so a short bar keeps its round end.
          <motion.span
            className="block h-full rounded-full bg-(--presentation-accent)"
            initial={false}
            animate={{ clipPath: `inset(0 ${(1 - monthly / max) * 100}% 0 0 round 9999px)` }}
            transition={reduceMotion ? { duration: 0 } : SCENE_MOTION.transition}
          />
        )}
      </span>
      <span className="text-right text-sm font-bold tabular-nums">{monthly === null ? '—' : <CountedDollars value={monthly} />}</span>
      {monthly !== null && <EstimateDisclosure lines={disclosure} />}
      {children ? <div className="col-span-full grid gap-1.5">{children}</div> : null}
    </li>
  )
}
