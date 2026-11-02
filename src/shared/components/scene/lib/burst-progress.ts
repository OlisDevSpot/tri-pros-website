import { SCENE_BURST } from '@/shared/components/scene/constants/scene-burst'

export function burstProgress(startedAt: number, now: number): number {
  return Math.min(1, Math.max(0, (now - startedAt) / SCENE_BURST.seconds))
}
