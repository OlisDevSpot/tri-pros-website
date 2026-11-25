'use client'

import type { ReactNode } from 'react'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef } from 'react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_EASE, CONTROLS_EASE_CSS, CONTROLS_LEAVE_EASE, SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'

interface SummarySlotProps {
  // What the slot shows, as a key: a change of value swaps the content, the same value never replays it.
  value: string
  children: ReactNode
}

export function SummarySlot({ value, children }: SummarySlotProps) {
  const { slotMs, leaveMs, rise, row } = SCENE_LAYOUT.summary
  const reduceMotion = useReducedMotion() ?? false
  const slot = useRef<HTMLDivElement>(null)
  const width = useRef<number | null>(null)

  // The leaving node is already out of the layout when this runs, so the slot's box is the new width; the old one was
  // kept from the last run.
  useLayoutEffect(() => {
    const element = slot.current
    if (!element) {
      return
    }
    const next = element.getBoundingClientRect().width
    const before = width.current
    width.current = next
    if (before !== null && !reduceMotion && Math.abs(next - before) > 0.5) {
      element.animate([{ width: `${before}px` }, { width: `${next}px` }], { duration: slotMs, easing: CONTROLS_EASE_CSS })
    }
  }, [value, reduceMotion, slotMs])

  return (
    <div ref={slot} style={{ height: row }} className={CONTROLS_CLASSES.summarySlot}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={{ opacity: 0, y: reduceMotion ? 0 : rise }}
          animate={{ opacity: 1, y: 0, transition: { duration: reduceMotion ? 0 : slotMs / 1000, delay: reduceMotion ? 0 : 0.05, ease: CONTROLS_EASE } }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : -rise, transition: { duration: reduceMotion ? 0 : leaveMs / 1000, ease: CONTROLS_LEAVE_EASE } }}
          style={{ height: row }}
          className={CONTROLS_CLASSES.summaryRow}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}
