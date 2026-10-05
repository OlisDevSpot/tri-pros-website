import type { TargetAndTransition, Transition, Variants } from 'motion/react'

/** Typed as `Transition` (not `as const`) so invalid keys and values fail at compile time. */
export const FUNNEL_TRANSITION: Transition = {
  duration: 0.18,
  ease: [0.32, 0.72, 0, 1],
}

/** Per-field `TargetAndTransition`, not `Variants`: these feed `initial`/`animate`/`exit` directly, which reject variant resolver functions. */
export const STEP_VARIANTS: Record<'initial' | 'animate' | 'exit', TargetAndTransition> = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

export const CARD_STAGGER_CONTAINER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
}

export const CARD_STAGGER_ITEM: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: FUNNEL_TRANSITION },
}

// CTA motion is deliberately restrained: spring on hover/press plus one occasional sheen; no glow halo, no pulsing. Under reduced motion the static `--cta-ring` hairline carries the identity.

export const CTA_HOVER: TargetAndTransition = { y: -2 }
/** Kept under reduced motion: user-initiated and brief. */
export const CTA_TAP: TargetAndTransition = { scale: 0.97 }
export const CTA_PRESS_SPRING: Transition = { type: 'spring', stiffness: 400, damping: 17 }
export const CTA_SHEEN_TRANSITION: Transition = { duration: 1.1, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }

// Hero scroll-away is a two-layer parallax in normal flow (no pin, no height animation — that strands a dead container);
// values are compositor-only, and under reduced motion only opacity runs (vestibular-safe).
// Ranges stay plain `number[]` for `useTransform`; only the offset needs `as const` (template-literal `Intersection` types).

export const HERO_SCROLL_OFFSET = ['start start', 'end start'] as const

/** Fades fully early so the copy never lingers as a ghost over the photo. */
export const HERO_CONTENT_OPACITY_IN = [0, 0.4]
export const HERO_CONTENT_OPACITY_OUT = [1, 0]
/** Runs a bit past the fade range on purpose, for momentum. */
export const HERO_CONTENT_FLOAT_IN = [0, 0.55]
export const HERO_CONTENT_LIFT_PX = -180
export const HERO_CONTENT_SCALE_TARGET = 0.96

/** Clears just after the content so legibility holds while the copy is still visible. */
export const HERO_SCRIM_OPACITY_IN = [0, 0.5]
export const HERO_SCRIM_OPACITY_OUT = [1, 0]

/** Must stay ≤ the photo layer's vertical oversize in funnel-hero (`-inset-y-32`), or the drift reveals a gap. */
export const HERO_PHOTO_Y_PX = 110
/** Also pads edge coverage during the drift. */
export const HERO_PHOTO_SCALE_TARGET = 1.06

/** Starts only once the copy has fully cleared. */
export const HERO_HEADER_OPACITY_IN = [0.45, 0.8]
export const HERO_HEADER_OPACITY_OUT = [0, 1]

export const TIMELINE_STAGGER_CONTAINER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
}

export const TIMELINE_STEP_ITEM: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.85 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 24 } },
}
