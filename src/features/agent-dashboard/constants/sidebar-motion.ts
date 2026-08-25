import { COLLAPSE_TRANSITION } from '@/shared/constants/motion'

/** Sidebar collapse/label timing — the shared app-wide reveal tween. */
export const SIDEBAR_TRANSITION = COLLAPSE_TRANSITION

export const SIDEBAR_LABEL_ANIMATE = {
  expanded: { opacity: 1, width: 'auto' },
  collapsed: { opacity: 0, width: 0 },
} as const
