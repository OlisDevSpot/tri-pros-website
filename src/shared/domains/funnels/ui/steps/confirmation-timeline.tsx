'use client'

import { motion, useReducedMotion } from 'motion/react'
import { TIMELINE_STAGGER_CONTAINER, TIMELINE_STEP_ITEM } from '@/shared/domains/funnels/constants/funnel-motion'

/**
 * Animated "what happens next" timeline for the confirmation step. Each numbered
 * badge is vertically centered against its step copy, with thin connectors
 * filling the space above and below it. The connectors are flex siblings of the
 * badge — they physically STOP at the badge's edges, so a connecting line can
 * never cross a number. The first badge hides its top connector and the last
 * hides its bottom one (no dangling stubs). Steps pop in on a stagger; reduced
 * motion renders everything static.
 *
 * The badges use the soft accent tint — the page's one SOLID-primary moment is
 * the Call CTA.
 */
export function ConfirmationTimeline({ steps }: { steps: string[] }) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.ol
      variants={reduceMotion ? undefined : TIMELINE_STAGGER_CONTAINER}
      initial={reduceMotion ? false : 'hidden'}
      animate="visible"
      className="flex w-full flex-col text-left"
    >
      {steps.map((step, i) => {
        const isFirst = i === 0
        const isLast = i === steps.length - 1
        return (
          <motion.li
            key={step}
            variants={reduceMotion ? undefined : TIMELINE_STEP_ITEM}
            className="flex items-stretch gap-4"
          >
            <div className="flex flex-col items-center">
              <span aria-hidden className={`w-px flex-1 ${isFirst ? 'bg-transparent' : 'bg-border'}`} />
              <span className="bg-accent text-accent-foreground ring-primary/15 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold shadow-sm ring-1">
                {i + 1}
              </span>
              <span aria-hidden className={`w-px flex-1 ${isLast ? 'bg-transparent' : 'bg-border'}`} />
            </div>
            <span className="text-foreground self-center py-3.5 text-sm leading-relaxed">{step}</span>
          </motion.li>
        )
      })}
    </motion.ol>
  )
}
