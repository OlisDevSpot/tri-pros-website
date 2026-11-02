import { SCENE_BURST } from '@/shared/components/scene/constants/scene-burst'

function smoothstep(from: number, to: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

// 1 while a burst is in full swing, falling to 0 as it ends: a pace for motion that is already under way (a figure's clip).
export function burstSettle(progress: number): number {
  return 1 - smoothstep(1 - SCENE_BURST.settleSeconds / SCENE_BURST.seconds, 1, progress)
}

// 0 at the input, 1 in full swing, 0 again at rest: how much of a strain, a spin or a shake shows at this point of a burst.
export function burstLife(progress: number): number {
  return smoothstep(0, SCENE_BURST.swellSeconds / SCENE_BURST.seconds, progress) * burstSettle(progress)
}
