import type { TargetAndTransition, Transition, Variants } from 'motion/react'

/**
 * Shared transition for funnel step swaps. Typed as motion's `Transition` so
 * invalid keys/values fail at compile time (the bare `as const` object gave us
 * no validation). The `ease` tuple is a cubic-bezier (`BezierDefinition`) —
 * matching CSS `ease` — which `Transition` accepts directly.
 */
export const FUNNEL_TRANSITION: Transition = {
  duration: 0.18,
  ease: [0.32, 0.72, 0, 1],
}

/**
 * Enter/exit targets for the step swap (used with AnimatePresence mode="wait").
 * Typed as `TargetAndTransition` per field — not `Variants` — because the engine
 * passes these objects straight into `initial`/`animate`/`exit` props rather than
 * referencing them by variant label. `Variants` would widen each to allow a
 * resolver function, which those props don't accept.
 */
export const STEP_VARIANTS: Record<'initial' | 'animate' | 'exit', TargetAndTransition> = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

/**
 * Container + item variants for the card-select grid entrance. The container
 * orchestrates a 50ms stagger; each card fades up. Reuses FUNNEL_TRANSITION
 * easing. Engine gates these on useReducedMotion().
 */
export const CARD_STAGGER_CONTAINER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
}

export const CARD_STAGGER_ITEM: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: FUNNEL_TRANSITION },
}
