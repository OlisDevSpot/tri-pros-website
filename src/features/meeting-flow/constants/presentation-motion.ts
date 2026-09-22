import type { Transition, Variants } from 'motion/react'
import { BRAND_EASE } from '@/shared/constants/motion'

/** Every presentation reveal rides the brand curve (C29). */
export const REVEAL_TRANSITION: Transition = { duration: 0.5, ease: BRAND_EASE }

/**
 * Text groups rise into place. Transitions are set on the <Reveal> component, not
 * here, so a per-element stagger delay can be merged in.
 */
export const REVEAL_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

/** Delay between sibling reveals inside one slide, in seconds. */
export const REVEAL_STAGGER_S = 0.09

/** Images settle from a slight zoom on first reveal. Applied to an inner wrapper only. */
export const IMAGE_SETTLE_VARIANTS: Variants = {
  hidden: { scale: 1.06 },
  visible: { scale: 1, transition: { duration: 1.8, ease: BRAND_EASE } },
}

/** The heading column's swap between slides: a plain ease-out, as approved in the prototype. */
export const PIN_SWAP_TRANSITION: Transition = { duration: 0.18, ease: 'easeOut' }
