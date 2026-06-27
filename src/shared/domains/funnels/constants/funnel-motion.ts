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

// ─── Primary CTA (FunnelCta) ────────────────────────────────────────────────
//
// Restrained: a tactile spring on hover/press, plus a single occasional sheen
// sweep as the only ambient motion. No glow halo, no pulsing. The sheen is gated
// on useReducedMotion() inside <FunnelCta>; the static brand hairline
// (--cta-ring) carries the identity when motion is reduced. see ../ui/funnel-cta.tsx

/** Hover: gentle lift. Gated by reduced motion at the call site. */
export const CTA_HOVER: TargetAndTransition = { y: -2 }
/** Press: snappy compress — kept under reduced motion (intentional + brief). */
export const CTA_TAP: TargetAndTransition = { scale: 0.97 }
/** Spring for hover/press — physical, not linear. */
export const CTA_PRESS_SPRING: Transition = { type: 'spring', stiffness: 400, damping: 17 }
/** Idle sheen sweep — a light bar crosses the face, then pauses (~5s cadence). */
export const CTA_SHEEN_TRANSITION: Transition = { duration: 1.1, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }

// ─── Hero scroll choreography (layered parallax scroll-away) ───────────────
//
// The hero EXITS as a layered parallax as it scrolls off — nothing collapses in
// place (which would leave a dead full-height container with content stranded
// below). Because it stays in normal flow, the section genuinely leaves and the
// marketing content below rises naturally — no dead space, no pin, no height
// animation. Two layers at different rates:
//
//   Foreground (card + Q1 + scrim) LEADS: fades fully + lifts UP faster than the
//     scroll, so the copy clears first (per "exit upward = going away").
//   Background photo TRAILS: drifts up slower than the scroll (the parallax lag)
//     with a subtle zoom/perspective, so it visibly follows the content out.
//
// Driven by a single `useScroll({ target: heroRef, offset: HERO_SCROLL_OFFSET })`
// whose `scrollYProgress` runs 0→1 over the hero's own height. Every value is
// compositor-only (opacity / transform) — hardware-accelerated; NEVER width/
// height/top/left (layout-shift-avoid). The photo layer is OVERSIZED vertically
// in the hero so its parallax translate never reveals a gap. Translate/scale are
// gated behind `useReducedMotion()` in the landing (parallax-subtle); opacity is
// kept (vestibular-safe). see ../ui/funnel-landing.tsx, ../ui/funnel-hero.tsx

// Each pair is (input range, output range) for `useTransform`. Kept as flat
// `number[]` so they pass straight in; the offset stays `as const` (its members
// are template-literal `Intersection` types) and is spread at the call site.

/** `[targetEdge containerEdge]` pair → progress 0 at page top, 1 when hero fully scrolled past. */
export const HERO_SCROLL_OFFSET = ['start start', 'end start'] as const

// ── Foreground (leads) ─────────────────────────────────────────────────────
/** Content fades FULLY by ~0.4 (leads the photo; never lingers as a ghost). */
export const HERO_CONTENT_OPACITY_IN = [0, 0.4]
export const HERO_CONTENT_OPACITY_OUT = [1, 0]
/** The lift: content rises faster than the scroll (px, negative = up) with a
 *  whisper of scale-down for depth. Range runs a bit past the fade for momentum.
 *  Gated by reduced motion. */
export const HERO_CONTENT_FLOAT_IN = [0, 0.55]
export const HERO_CONTENT_LIFT_PX = -180
export const HERO_CONTENT_SCALE_TARGET = 0.96

/** Radial legibility scrim fades just after the content (holds legibility while
 *  the copy is visible, then clears so the photo reads clean as it trails out). */
export const HERO_SCRIM_OPACITY_IN = [0, 0.5]
export const HERO_SCRIM_OPACITY_OUT = [1, 0]

// ── Background (trails) ────────────────────────────────────────────────────
/** Parallax lag: the photo drifts UP slower than the scroll (negative = up, a
 *  fraction of the content's lift) so it follows the copy out a beat behind. The
 *  oversized photo layer (see funnel-hero) keeps it gap-free across this drift. */
export const HERO_PHOTO_Y_PX = -64
/** Subtle push-in zoom / perspective as the photo trails away. */
export const HERO_PHOTO_SCALE_TARGET = 1.06

/** Slim sticky bar cross-fades in once the copy has cleared (mid-exit). */
export const HERO_HEADER_OPACITY_IN = [0.45, 0.8]
export const HERO_HEADER_OPACITY_OUT = [0, 1]

/**
 * Confirmation "what's next" timeline. The container reveals its steps with a
 * deliberate 120ms stagger; each step pops via TIMELINE_STEP_ITEM. The
 * connectors between badges are static CSS (they stop at each badge edge), so
 * no animated line ever crosses a number. Gated on useReducedMotion() at the
 * call site.
 */
export const TIMELINE_STAGGER_CONTAINER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
}

/**
 * Each timeline step pops in with a spring (scale + lift) so the numbered
 * badges feel alive as they reveal in sequence.
 */
export const TIMELINE_STEP_ITEM: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.85 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 24 } },
}
