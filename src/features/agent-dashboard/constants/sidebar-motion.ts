import { BRAND_EASE, COLLAPSE_TRANSITION } from '@/shared/constants/motion'

/** Sidebar collapse/label timing — the shared app-wide reveal tween. */
export const SIDEBAR_TRANSITION = COLLAPSE_TRANSITION

export const SIDEBAR_LABEL_ANIMATE = {
  expanded: { opacity: 1, width: 'auto' },
  collapsed: { opacity: 0, width: 0 },
} as const

/** WAAPI/CSS form of the brand curve, for the theme reveal and the switch thumb it carries. */
export const THEME_SWITCH_EASE = `cubic-bezier(${BRAND_EASE.join(', ')})`
