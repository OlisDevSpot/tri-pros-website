'use client'

import { motion, useReducedMotion } from 'motion/react'
import { TIMELINE_LINE, TIMELINE_STAGGER_CONTAINER, TIMELINE_STEP_ITEM } from '@/shared/domains/funnels/constants/funnel-motion'

/**
 * Animated "what happens next" timeline for the confirmation step. A vertical
 * connecting line draws itself in from the top while the numbered steps pop up
 * in sequence. Pure presentation — `steps` is the ordered copy. Reduced motion
 * renders everything static (no draw, no stagger).
 *
 * The badges are OPAQUE circles (the connecting line passes BEHIND them, hidden
 * where they overlap — so the line reads as connectors between circles, not a
 * stroke crossing through them). They use the soft accent tint, not solid
 * primary — the page's one SOLID-primary moment is the Call CTA.
 */
export function ConfirmationTimeline({ steps }: { steps: string[] }) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.ol
      variants={reduceMotion ? undefined : TIMELINE_STAGGER_CONTAINER}
      initial={reduceMotion ? false : 'hidden'}
      animate="visible"
      className="relative flex w-full flex-col gap-6 text-left"
    >
      <motion.span
        aria-hidden
        variants={reduceMotion ? undefined : TIMELINE_LINE}
        className="bg-border absolute bottom-3 left-4 top-3 w-px origin-top"
      />
      {steps.map((step, i) => (
        <motion.li
          key={step}
          variants={reduceMotion ? undefined : TIMELINE_STEP_ITEM}
          className="relative flex items-start gap-4"
        >
          <span className="bg-accent text-accent-foreground ring-primary/15 relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold shadow-sm ring-1">
            {i + 1}
          </span>
          <span className="text-foreground pt-1 text-sm leading-relaxed">{step}</span>
        </motion.li>
      ))}
    </motion.ol>
  )
}
