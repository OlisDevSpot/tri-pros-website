import type { ThreeEvent } from '@react-three/fiber'
import type { Object3D, Raycaster } from 'three'

import { isDoubleTapStop } from '@/shared/components/scene/lib/is-double-tap-stop'

// R3F raycasts only meshes with handlers, so a mesh without one (the house, the roof) never stands between the finger
// and a mesh that has one behind it. Three is asked again over the whole scene: the event's mesh counts only when it is
// the nearest surface the eye reads as solid.
export function isNearestSolidHit(event: ThreeEvent<PointerEvent | MouseEvent>, raycaster: Raycaster, scene: Object3D): boolean {
  raycaster.setFromCamera(event.pointer, event.camera)
  const nearest = raycaster.intersectObjects(scene.children, true).find(hit => isDoubleTapStop(hit.object, hit.face?.materialIndex) === 'stop')
  return nearest?.object === event.object
}
