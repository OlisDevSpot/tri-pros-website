import type { TargetAndTransition, Transition, Variants } from 'motion/react'

/** Shared easing/timing for step + view transitions. */
export const STEP_TRANSITION: Transition = { duration: 0.18, ease: [0.32, 0.72, 0, 1] }

/** Per-step enter/exit for the keyed AnimatePresence stage. */
export const STEP_VARIANTS: Record<'initial' | 'animate' | 'exit', TargetAndTransition> = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

/** Stagger container for card grids/lists. */
export const CARD_STAGGER_CONTAINER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
}

/** Stagger item for individual cards. */
export const CARD_STAGGER_ITEM: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: STEP_TRANSITION },
}

export const CTA_HOVER: TargetAndTransition = { y: -2 }
export const CTA_TAP: TargetAndTransition = { scale: 0.97 }
export const CTA_PRESS_SPRING: Transition = { type: 'spring', stiffness: 400, damping: 17 }
