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

// ─── Hero scroll choreography ──────────────────────────────────────────────
//
// As the landing hero scrolls past, its text fades + lifts away and the big
// logo cross-fades into the slim sticky header. Driven by a single
// `useScroll({ target: heroRef, offset: HERO_SCROLL_OFFSET })` whose
// `scrollYProgress` runs 0→1 over exactly the hero's own height. All ranges
// are [input → output] pairs for `useTransform`. Translate/scale magnitudes
// are gated behind `useReducedMotion()` in the engine (opacity is kept — it is
// vestibular-safe and aids comprehension). see ../ui/funnel-engine.tsx

// Each pair is (input range, output range) for `useTransform`. Kept as flat
// `number[]` so they pass straight in; the offset stays `as const` (its members
// are template-literal `Intersection` types) and is spread at the call site.

/** `[targetEdge containerEdge]` pair → progress 0 at page top, 1 when hero fully scrolled past. */
export const HERO_SCROLL_OFFSET = ['start start', 'end start'] as const

/** Text group fades fully by the halfway point (premium "fade faster than you scroll"). */
export const HERO_TEXT_OPACITY_IN = [0, 0.5]
export const HERO_TEXT_OPACITY_OUT = [1, 0]
/** Gentle upward lift of the text group, in px (negative = up). Gated by reduced motion. */
export const HERO_TEXT_LIFT_PX = -120

/** Big in-flow hero logo fades out before the slim bar finishes fading in. */
export const HERO_LOGO_OPACITY_IN = [0.05, 0.45]
export const HERO_LOGO_OPACITY_OUT = [1, 0]
/** Slight shrink of the big logo as it leaves. Gated by reduced motion. */
export const HERO_LOGO_SCALE_IN = [0, 0.45]
export const HERO_LOGO_SCALE_TARGET = 0.85

/** Slim sticky bar cross-fades in (slight overlap with the logo fade = the crossfade). */
export const HERO_HEADER_OPACITY_IN = [0.4, 0.75]
export const HERO_HEADER_OPACITY_OUT = [0, 1]
