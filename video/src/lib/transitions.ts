export type TransitionType = 'none' | 'fade' | 'whip' | 'wipe' | 'dissolve' | 'zoomPunch'
export type TransitionDirection = 'left' | 'right' | 'up' | 'down'

/** Overlap frames: how long the previous clip keeps running under the incoming one. */
export const TRANSITION_FRAMES: Record<TransitionType, number> = {
  none: 0,
  fade: 10,
  whip: 7,
  wipe: 14,
  dissolve: 14,
  zoomPunch: 9,
}

export interface TransitionStyle {
  opacity: number
  transform: string
  clipPath?: string
  filter?: string
}

const IDENTITY: TransitionStyle = { opacity: 1, transform: 'none' }

// direction = the whip/wipe motion direction (outgoing exits that way, incoming follows).
const AXIS: Record<TransitionDirection, { x: number, y: number }> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
const easeInCubic = (t: number) => t ** 3
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

/** Style for the INCOMING clip, given frames since its sequence started. */
export function enterStyle(type: TransitionType, direction: TransitionDirection, frames: number): TransitionStyle {
  const total = TRANSITION_FRAMES[type]
  if (type === 'none' || frames >= total)
    return IDENTITY
  const t = Math.max(frames / total, 0)
  switch (type) {
    case 'fade':
      return { opacity: t, transform: 'none' }
    case 'dissolve':
      return { opacity: easeInOutCubic(t), transform: 'none' }
    case 'whip': {
      const p = easeOutCubic(t)
      const { x, y } = AXIS[direction]
      return {
        opacity: 1,
        transform: `translate(${-x * (1 - p) * 110}%, ${-y * (1 - p) * 110}%)`,
        filter: y === 0 ? 'url(#whip-blur-x)' : 'url(#whip-blur-y)',
      }
    }
    case 'wipe': {
      const p = easeInOutCubic(t) * 100
      const inset
        = direction === 'left'
          ? `0 ${100 - p}% 0 0`
          : direction === 'right'
            ? `0 0 0 ${100 - p}%`
            : direction === 'up'
              ? `0 0 ${100 - p}% 0`
              : `${100 - p}% 0 0 0`
      return { opacity: 1, transform: 'none', clipPath: `inset(${inset})` }
    }
    case 'zoomPunch': {
      const p = easeOutCubic(t)
      return {
        opacity: Math.min(1, t * 2),
        transform: `scale(${1.3 - p * 0.3})`,
        filter: `blur(${(1 - p) * 14}px)`,
      }
    }
    default:
      return IDENTITY
  }
}

/** Style for the OUTGOING clip during the overlap (frames since the INCOMING clip started). */
export function exitStyle(nextType: TransitionType, direction: TransitionDirection, frames: number): TransitionStyle {
  const total = TRANSITION_FRAMES[nextType]
  if (total === 0 || frames < 0 || frames >= total)
    return IDENTITY
  const t = frames / total
  switch (nextType) {
    case 'whip': {
      const p = easeInCubic(t)
      const { x, y } = AXIS[direction]
      return {
        opacity: 1,
        transform: `translate(${x * p * 110}%, ${y * p * 110}%)`,
        filter: y === 0 ? 'url(#whip-blur-x)' : 'url(#whip-blur-y)',
      }
    }
    case 'zoomPunch': {
      const p = easeInCubic(t)
      return { opacity: 1 - t * 0.4, transform: `scale(${1 + p * 0.6})`, filter: `blur(${p * 12}px)` }
    }
    default:
      // fade/dissolve/wipe: the previous clip just keeps playing beneath.
      return IDENTITY
  }
}

/** Wipe divider position 0–100 (percent along the wipe axis), or null when no divider draws. */
export function wipeEdge(type: TransitionType, frames: number): number | null {
  if (type !== 'wipe' || frames < 0 || frames >= TRANSITION_FRAMES.wipe)
    return null
  return easeInOutCubic(frames / TRANSITION_FRAMES.wipe) * 100
}
