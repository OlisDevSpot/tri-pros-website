export const FUNNEL_TRANSITION = { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } as const

/** Enter/exit variants for the step swap (used with AnimatePresence mode="wait"). */
export const STEP_VARIANTS = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
} as const
