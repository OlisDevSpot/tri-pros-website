import type { StageShape } from '@/features/trade-scenes/types'

import { SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'

export function stageShapeOf(width: number, height: number): StageShape {
  if (height > width || width < SCENE_LAYOUT.portraitBelowWidth) {
    return 'portrait'
  }
  return width < SCENE_LAYOUT.narrowBelowWidth ? 'narrow' : 'landscape'
}
