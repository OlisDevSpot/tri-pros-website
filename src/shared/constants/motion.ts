/**
 * Shared motion tokens. One source of truth for animation timing/easing and the
 * common collapse (height auto ↔ 0) reveal, so every collapsible across the app
 * shares the same feel instead of copy-pasting a local `TRANSITION`.
 *
 * The collapse variants are consumed by <AnimatedCollapsibleContent> (see
 * `src/shared/components/ui/collapsible.tsx`) — reach for that primitive rather
 * than re-implementing AnimatePresence + motion.div by hand.
 */

/** Standard ease-out tween for content reveals and small state-driven motion. */
export const COLLAPSE_TRANSITION = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } as const

/**
 * Vertical reveal for AnimatePresence + motion.div. CSS cannot interpolate
 * `height: auto ↔ 0`; motion measures the target and animates it natively.
 */
export const COLLAPSE_HEIGHT_VARIANTS = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
} as const
