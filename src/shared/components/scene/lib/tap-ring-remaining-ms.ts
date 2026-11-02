import { SCENE_GESTURES } from '@/shared/components/scene/constants/scene-gestures'

// The mark outlives its ring in the store, so a ring mounted late shows only what is left of its time, or nothing.
export function tapRingRemainingMs(at: number, now: number): number {
  return Math.min(SCENE_GESTURES.tapRingMs, Math.max(0, SCENE_GESTURES.tapRingMs - (now - at)))
}
