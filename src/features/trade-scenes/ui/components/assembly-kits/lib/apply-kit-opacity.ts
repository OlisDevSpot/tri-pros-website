import type { Material, Object3D } from 'three'

import { Mesh } from 'three'

// Fades every mesh under a part at once. three compiles `transparent` into the program, so it flips only when crossing
// solid, and a part faded past half stops writing depth so it never hides the part behind it.
export function applyKitOpacity(root: Object3D, opacity: number): void {
  const solid = opacity > 0.999
  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return
    }
    const materials: Material[] = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      if (material.transparent === solid) {
        material.transparent = !solid
        material.needsUpdate = true
      }
      material.opacity = opacity
      material.depthWrite = opacity > 0.5
    }
  })
}
