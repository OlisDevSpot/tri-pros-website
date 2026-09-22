'use client'

import type { ReactNode } from 'react'
import type { IndexedSlide } from '@/shared/components/presentation/types'
import { HeadingColumn } from '@/shared/components/presentation/heading-column'

interface SlideRunProps {
  /** The run's slides, in order, as `groupSlides` produced them. */
  items: IndexedSlide<unknown>[]
  /** How many slides in the whole presentation carry a number: the "6" in "3 of 6". */
  numberedTotal: number
  /** The run's rendered slides. */
  children: ReactNode
}

/**
 * Consecutive `column` slides and the heading column they share (C37). Side by side, the
 * column is sticky for the height of the run and slides out at its edges. Below a 56rem
 * presentation it becomes a band above the slides: the run switches to `block` (a grid
 * would leave the band alone in a row that bounds its stickiness, review F12) and publishes
 * `--band-h`, which the slides subtract and snap below. No `overflow` here or on the stack:
 * `hidden` would re-scope sticky to that box. See ./DOCS.md#runs
 */
export function SlideRun({ items, numberedTotal, children }: SlideRunProps) {
  return (
    <div className="grid grid-cols-[minmax(16rem,38%)_minmax(0,1fr)] @max-[56rem]/presentation:block @max-[56rem]/presentation:[--band-h:30cqh]">
      <HeadingColumn items={items} numberedTotal={numberedTotal} />
      <div>{children}</div>
    </div>
  )
}
