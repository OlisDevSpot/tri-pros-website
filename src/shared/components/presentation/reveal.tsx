'use client'

import type { HTMLMotionProps } from 'motion/react'
import { motion } from 'motion/react'
import { useSlideInView } from '@/shared/components/presentation/context'
import { REVEAL_STAGGER_S, REVEAL_TRANSITION, REVEAL_VARIANTS } from '@/shared/components/presentation/motion'

interface RevealProps extends HTMLMotionProps<'div'> {
  /** Position in the slide's stagger order; 0 animates first. */
  order?: number
}

/**
 * Text and proof groups rise in when their slide is in view. Never wrap media or the
 * slide itself. `initial={false}` renders a slide that is already in view at rest instead
 * of parking it at opacity 0.
 */
export function Reveal({ order = 0, transition, ...props }: RevealProps) {
  const inView = useSlideInView()
  return (
    <motion.div
      animate={inView ? 'visible' : 'hidden'}
      initial={false}
      transition={{ ...REVEAL_TRANSITION, delay: order * REVEAL_STAGGER_S, ...transition }}
      variants={REVEAL_VARIANTS}
      {...props}
    />
  )
}
