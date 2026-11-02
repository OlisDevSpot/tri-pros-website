import type { Material, Object3D } from 'three'

import { SCENE_GESTURES } from '@/shared/components/scene/constants/scene-gestures'

function materialOf(object: Object3D, materialIndex: number | undefined): Material | undefined {
  const material = (object as Object3D & { material?: Material | Material[] }).material
  return Array.isArray(material) ? material[materialIndex ?? 0] : material
}

// Three's raycaster tests hidden objects too, so a part faded away or switched off must be skipped by hand.
export function isDoubleTapStop(object: Object3D, materialIndex: number | undefined): 'stop' | 'through' {
  for (let node: Object3D | null = object; node; node = node.parent) {
    if (!node.visible) {
      return 'through'
    }
  }
  const material = materialOf(object, materialIndex)
  if (material?.transparent && material.opacity < SCENE_GESTURES.doubleTapStopOpacity && object.userData.doubleTapStop !== true) {
    return 'through'
  }
  return 'stop'
}
