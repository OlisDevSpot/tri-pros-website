'use client'

import { motion, useReducedMotion } from 'motion/react'
import { CARD_STAGGER_ITEM, TIMELINE_LINE, TIMELINE_STAGGER_CONTAINER } from '@/shared/domains/funnels/constants/funnel-motion'

/**
 * Animated "what happens next" timeline for the confirmation step. A vertical
 * connecting line draws itself in from the top while the numbered steps stagger
 * up in sequence. Pure presentation — `steps` is the ordered copy. Reduced
 * motion renders everything static (no draw, no stagger). The number badges use
 * the subtle primary TINT — the page's one SOLID-primary moment is the Call CTA.
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
          variants={reduceMotion ? undefined : CARD_STAGGER_ITEM}
          className="relative flex items-start gap-4"
        >
          <span className="bg-primary/10 text-primary relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
            {i + 1}
          </span>
          <span className="text-foreground pt-1 text-sm leading-relaxed">{step}</span>
        </motion.li>
      ))}
    </motion.ol>
  )
}
