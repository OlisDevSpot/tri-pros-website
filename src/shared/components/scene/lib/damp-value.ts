import { SCENE_MOTION } from '@/shared/components/scene/constants/scene-motion'

export type EasedValue = number | readonly number[]

// The step is clamped so a tab returning from the background eases instead of snapping.
function dampNumber(current: number, target: number, deltaSeconds: number): number {
  const step = Math.min(deltaSeconds, SCENE_MOTION.maxFrameSeconds)
  return current + (target - current) * (1 - Math.exp(-SCENE_MOTION.damping * step))
}

export function dampValue<T extends EasedValue>(current: T, target: T, deltaSeconds: number): T {
  if (typeof current === 'number') {
    return dampNumber(current, target as number, deltaSeconds) as T
  }
  const targets = target as readonly number[]
  return current.map((value, index) => dampNumber(value, targets[index], deltaSeconds)) as unknown as T
}

// On-demand rendering leaves a long gap before the first frame of a new ease; treating that gap as one 60 fps frame
// starts the ease from zero instead of jumping ~45% on frame one.
export function easeStepSeconds(resting: boolean, rawDeltaSeconds: number): number {
  return resting ? Math.min(rawDeltaSeconds, SCENE_MOTION.restFrameSeconds) : rawDeltaSeconds
}

export function isSettled(current: EasedValue, target: EasedValue): boolean {
  if (typeof current === 'number') {
    return Math.abs(current - (target as number)) <= SCENE_MOTION.settled
  }
  const targets = target as readonly number[]
  return current.every((value, index) => Math.abs(value - targets[index]) <= SCENE_MOTION.settled)
}
