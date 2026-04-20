export const SIDEBAR_TRANSITION = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } as const

export const COLLAPSE_HEIGHT_VARIANTS = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
} as const

export const SIDEBAR_LABEL_ANIMATE = {
  expanded: { opacity: 1, width: 'auto' },
  collapsed: { opacity: 0, width: 0 },
} as const
