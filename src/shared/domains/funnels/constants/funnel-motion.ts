import type { TargetAndTransition, Transition } from 'motion/react'

/**
 * Shared transition for funnel step swaps. Typed as motion's `Transition` so
 * invalid keys/values fail at compile time (the bare `as const` object gave us
 * no validation). The `ease` tuple is a cubic-bezier (`BezierDefinition`) —
 * matching CSS `ease` — which `Transition` accepts directly.
 */
export const FUNNEL_TRANSITION: Transition = {
  duration: 0.25,
  ease: [0.25, 0.1, 0.25, 1],
}

/**
 * Enter/exit targets for the step swap (used with AnimatePresence mode="wait").
 * Typed as `TargetAndTransition` per field — not `Variants` — because the engine
 * passes these objects straight into `initial`/`animate`/`exit` props rather than
 * referencing them by variant label. `Variants` would widen each to allow a
 * resolver function, which those props don't accept.
 */
export const STEP_VARIANTS: Record<'initial' | 'animate' | 'exit', TargetAndTransition> = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
}
