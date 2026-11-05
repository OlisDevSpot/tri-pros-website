import { SCENE_GESTURES } from '@/shared/components/scene/constants/scene-gestures'

export function startsWheelStream(lastAt: number | null, at: number): boolean {
  return lastAt === null || at - lastAt > SCENE_GESTURES.wheel.streamGapMs
}
