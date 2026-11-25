'use client'

import type { HTMLMotionProps, Variants } from 'motion/react'
import { motion } from 'motion/react'
import { REVEAL_TRANSITION, REVEAL_VARIANTS } from '@/shared/components/presentation/motion'

// Arming is instant; only the rise into place is animated.
const ITEM: Variants = {
  hidden: { ...REVEAL_VARIANTS.hidden, transition: { duration: 0 } },
  visible: { ...REVEAL_VARIANTS.visible, transition: REVEAL_TRANSITION },
}

export function RevealItem(props: HTMLMotionProps<'div'>) {
  return <motion.div variants={ITEM} {...props} />
}
