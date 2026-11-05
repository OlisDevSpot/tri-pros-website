import type { Object3D } from 'three'
import type { HomeFade } from '@/features/trade-scenes/types'

import { Vector3 } from 'three'

const parentScale = new Vector3()

// Raises every group tagged with this fade by `rise`. The rise is divided by the parent's world height scale, so a part in
// the stretched ground frame (the front skirt) rises as far as the rest.
export function riseFadeGroup(root: Object3D, fade: HomeFade, rise: number): void {
  root.traverse((node) => {
    if (node.userData.homeFade !== fade) {
      return
    }
    const scale = node.parent ? node.parent.getWorldScale(parentScale).y : 1
    node.position.y = rise / scale
  })
}
