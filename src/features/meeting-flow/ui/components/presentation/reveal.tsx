'use client'

import type { HTMLMotionProps } from 'motion/react'
import { motion } from 'motion/react'
import { REVEAL_STAGGER_S, REVEAL_TRANSITION, REVEAL_VARIANTS } from '@/features/meeting-flow/constants/presentation-motion'
import { useSectionInView } from '@/features/meeting-flow/contexts/presentation-context'

interface RevealProps extends HTMLMotionProps<'div'> {
  /** Position in the section's stagger order; 0 animates first. */
  order?: number
}

/**
 * Text and proof groups rise in when their section is in view. Never wrap media or
 * the section itself. `initial={false}` renders a section that is already in view
 * at rest instead of parking it at opacity 0.
 */
export function Reveal({ order = 0, transition, ...props }: RevealProps) {
  const inView = useSectionInView()
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
