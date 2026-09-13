'use client'

import type { PinnedSummary } from '@/features/meeting-flow/types'
import { AnimatePresence, motion } from 'motion/react'
import { PIN_SWAP_TRANSITION } from '@/features/meeting-flow/constants/presentation-motion'
import { usePresentation } from '@/features/meeting-flow/contexts/presentation-context'

interface PinnedColumnProps {
  /** One entry per section, in section order. */
  summaries: PinnedSummary[]
}

/**
 * Sticky companion that names the current section. Side column on lg+ (full
 * scroller height, content bottom-aligned), top band below (`--pin-h` tall).
 * Sticky inside a snap container is fine; it carries no snap alignment itself.
 */
export function PinnedColumn({ summaries }: PinnedColumnProps) {
  const { activeIndex } = usePresentation()
  const current = summaries[activeIndex] ?? summaries[0]
  if (!current) {
    return null
  }

  return (
    <aside
      className="sticky top-0 z-10 grid h-(--pin-h) content-end gap-[1cqh] self-start border-b border-white/15 bg-(--presentation-ground) px-[6cqw] py-[3cqh] lg:h-[100cqh] lg:border-b-0 lg:px-[5cqw] lg:pt-[5cqh] lg:pb-[max(5cqh,var(--stage-inset-b))]"
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={activeIndex}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-[1cqh]"
          exit={{ opacity: 0, y: -6 }}
          initial={{ opacity: 0, y: 8 }}
          transition={PIN_SWAP_TRANSITION}
        >
          {current.number !== undefined && (
            <span aria-hidden className="hidden font-serif text-[14cqw] leading-[0.9] tracking-tight text-white/25 lg:block">
              {current.number}
            </span>
          )}
          <p className="font-sans text-[5.5cqw] font-semibold leading-[1.08] tracking-tight text-balance lg:text-[3.3cqw]">
            {current.title}
          </p>
          <p className="hidden text-[max(3cqw,0.875rem)] text-white/70 sm:block lg:text-[max(1.5cqw,0.875rem)]">{current.line}</p>
          {current.count && (
            <p className="hidden text-[max(2.4cqw,0.75rem)] text-white/50 tabular-nums sm:block lg:text-[max(1.15cqw,0.75rem)]">{current.count}</p>
          )}
        </motion.div>
      </AnimatePresence>
    </aside>
  )
}
