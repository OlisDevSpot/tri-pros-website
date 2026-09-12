import type { Transition, Variants } from 'motion/react'

/** Exponential ease-out shared by every presentation reveal. */
export const PRESENTATION_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

export const REVEAL_TRANSITION: Transition = { duration: 0.5, ease: PRESENTATION_EASE }

/**
 * Text groups rise into place. Transitions are set on the <Reveal> component, not
 * here, so a per-element stagger delay can be merged in.
 */
export const REVEAL_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

/** Delay between sibling reveals inside one section, in seconds. */
export const REVEAL_STAGGER_S = 0.09

/** Images settle from a slight zoom on first reveal. Applied to an inner wrapper only. */
export const IMAGE_SETTLE_VARIANTS: Variants = {
  hidden: { scale: 1.06 },
  visible: { scale: 1, transition: { duration: 1.8, ease: PRESENTATION_EASE } },
}

export const PIN_SWAP_TRANSITION: Transition = { duration: 0.18, ease: 'easeOut' }
