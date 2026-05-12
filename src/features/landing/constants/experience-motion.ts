import type { Transition, Variants } from 'motion/react'

export const EXPERIENCE_TRANSITION: Transition = {
  duration: 0.7,
  ease: [0.25, 0.1, 0.25, 1],
}

export const SECTION_ENTRANCE: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: EXPERIENCE_TRANSITION },
}

export const STAGGER_CONTAINER: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
}

export const STAGGER_CHILD: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: EXPERIENCE_TRANSITION },
}

export const VIEWPORT_MARGIN = '-80px'
