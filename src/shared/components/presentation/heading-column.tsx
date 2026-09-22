'use client'

import type { IndexedSlide } from '@/shared/components/presentation/types'
import { AnimatePresence, motion } from 'motion/react'
import { usePresentation } from '@/shared/components/presentation/context'
import { HEADING_SWAP_TRANSITION } from '@/shared/components/presentation/motion'

interface HeadingColumnProps {
  /** The run's slides, in order. Only their headings and indexes are read. */
  items: IndexedSlide<unknown>[]
  /** How many slides in the whole presentation carry a number. */
  numberedTotal: number
}

/**
 * A run's heading column: names the active slide and fades between slides. Sticky inside a
 * snap container is fine; it carries no snap alignment itself, and `self-start` is what
 * lets it stick (a stretched column has nowhere to go). The presentation's active index is
 * clamped to the run, so the column already shows the run's first heading while the run
 * scrolls in, and keeps its last as the run leaves (review F1). Centred content per shell
 * correction C2. `aria-hidden`: every slide labels itself with its own heading (review F10).
 * See ./DOCS.md#heading-column
 */
export function HeadingColumn({ items, numberedTotal }: HeadingColumnProps) {
  const { activeIndex } = usePresentation()
  const first = items[0]?.index ?? 0
  const headings = items.map(item => item.slide.heading)
  const shownIndex = Math.min(Math.max(activeIndex, first), first + headings.length - 1)
  const heading = headings[shownIndex - first]
  if (!heading) {
    return null
  }

  return (
    <aside
      aria-hidden
      className="sticky top-0 z-10 grid h-[100cqh] content-center self-start bg-(--presentation-ground) px-[5cqw] pt-presentation-zone pb-[max(5cqh,var(--presentation-clear-b,0px))] @max-[56rem]/presentation:h-(--band-h) @max-[56rem]/presentation:border-b @max-[56rem]/presentation:border-white/15 @max-[56rem]/presentation:px-[6cqw] @max-[56rem]/presentation:py-presentation-tight"
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={shownIndex}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-presentation-tight"
          exit={{ opacity: 0, y: -6 }}
          initial={{ opacity: 0, y: 8 }}
          transition={HEADING_SWAP_TRANSITION}
        >
          {heading.number !== undefined && (
            <span className="font-serif text-[11cqw] leading-[0.9] tracking-tight text-white/25 lining-nums @max-[56rem]/presentation:hidden">
              {heading.number}
            </span>
          )}
          <p className="font-sans text-presentation-title leading-[1.08] font-semibold tracking-tight text-balance">{heading.title}</p>
          {heading.subheading && (
            <p className="text-presentation-lead text-white/70">
              {heading.subheading.text}
              {heading.subheading.accent && (
                <>
                  {' '}
                  <span className="text-(--presentation-accent)">{heading.subheading.accent}</span>
                </>
              )}
            </p>
          )}
          {heading.number !== undefined && (
            <p className="text-presentation-label text-white/60 tabular-nums lining-nums">{`${heading.number} of ${numberedTotal}`}</p>
          )}
        </motion.div>
      </AnimatePresence>
    </aside>
  )
}
