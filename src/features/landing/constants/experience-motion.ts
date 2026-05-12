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

export const WORD_STAGGER_CONTAINER: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
}

export const WORD_REVEAL: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.25, 0.1, 0.25, 1] },
  },
}

export const ACCENT_REVEAL: Variants = {
  hidden: { opacity: 0, y: 18, scale: 1.06 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.9, delay: 0.45, ease: [0.25, 0.1, 0.25, 1] },
  },
}

export const DRAW_X: Variants = {
  hidden: { scaleX: 0 },
  visible: {
    scaleX: 1,
    transition: { duration: 0.9, ease: [0.25, 0.1, 0.25, 1] },
  },
}

export const VIEWPORT_MARGIN = '-80px'
