import type { Material, Object3D, ShaderMaterial } from 'three'

import { Mesh } from 'three'

import { createThermalShader } from '@/features/trade-scenes/ui/lib/thermal-paint-set'

interface PaintedMesh {
  original: Mesh['material']
  paint: ShaderMaterial[]
  // The last scan that found the mesh still under the part.
  seen: number
}

// Everything the thermal camera put on one kit part: the part's two face temperatures, and what each of its meshes wore before.
export interface KitPartPaint {
  inner: number
  outer: number
  meshes: Map<Mesh, PaintedMesh>
  scans: number
}

function listOf(material: Mesh['material']): Material[] {
  return Array.isArray(material) ? material : [material]
}

// The part's fade lives on whatever material its meshes wear; a swap carries it across both ways.
function carryFade(from: Material, to: Material): void {
  if (to.transparent !== from.transparent) {
    to.transparent = from.transparent
    to.needsUpdate = true
  }
  to.opacity = from.opacity
  to.depthWrite = from.depthWrite
}

export function createKitPartPaint(inner: number, outer: number): KitPartPaint {
  return { inner, outer, meshes: new Map(), scans: 0 }
}

// Each mesh ramps from the part's inner face temperature at its lowest local y to the outer one at its highest, so a batt or a
// blanket shows the heat falling off through its depth; an instanced piece ramps through its own thickness.
function paintFor(mesh: Mesh, material: Material, set: KitPartPaint): ShaderMaterial {
  const geometry = mesh.geometry
  if (!geometry.boundingBox) {
    geometry.computeBoundingBox()
  }
  const box = geometry.boundingBox
  const paint = createThermalShader(material.side, set.inner, set.outer)
  if (box) {
    paint.uniforms.uCentre.value = (box.min.y + box.max.y) / 2
    paint.uniforms.uHalfThickness.value = Math.max((box.max.y - box.min.y) / 2, 1e-4)
  }
  carryFade(material, paint)
  return paint
}

function wearsPaint(paint: readonly ShaderMaterial[], current: Mesh['material']): boolean {
  if (!Array.isArray(current)) {
    return paint.length === 1 && paint[0] === current
  }
  if (paint.length !== current.length) {
    return false
  }
  for (let index = 0; index < paint.length; index++) {
    if (paint[index] !== current[index]) {
      return false
    }
  }
  return true
}

// Paints every mesh under the part not already wearing its paint, and returns whether anything changed. Run again whenever the
// part's tree may have changed, so a mesh that mounts while the camera is on (an installed part dropping in) is caught; a
// mesh gone from the part is let go.
export function paintKitPart(root: Object3D, set: KitPartPaint): boolean {
  let changed = false
  const scan = ++set.scans
  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return
    }
    const entry = set.meshes.get(object)
    if (entry && wearsPaint(entry.paint, object.material)) {
      entry.seen = scan
      return
    }
    // Anything not ours is what the part drew there, possibly a material R3F rebuilt since the last pass.
    entry?.paint.forEach(paint => paint.dispose())
    const paint = listOf(object.material).map(material => paintFor(object, material, set))
    set.meshes.set(object, { original: object.material, paint, seen: scan })
    object.material = Array.isArray(object.material) ? paint : paint[0]
    changed = true
  })
  for (const [mesh, entry] of set.meshes) {
    if (entry.seen !== scan) {
      entry.paint.forEach(paint => paint.dispose())
      set.meshes.delete(mesh)
    }
  }
  return changed
}

export function tintKitPart(set: KitPartPaint, inner: number, outer: number): void {
  set.inner = inner
  set.outer = outer
  for (const { paint } of set.meshes.values()) {
    for (const material of paint) {
      material.uniforms.uInner.value = inner
      material.uniforms.uOuter.value = outer
    }
  }
}

// Puts back exactly what each mesh wore, at the fade the paint had reached, and disposes only the paint.
export function restoreKitPart(set: KitPartPaint): void {
  for (const [mesh, { original, paint }] of set.meshes) {
    const current = listOf(mesh.material)
    if (current.every(material => paint.includes(material as ShaderMaterial))) {
      listOf(original).forEach((material, index) => carryFade(current[index] ?? current[0], material))
      mesh.material = original
    }
    paint.forEach(material => material.dispose())
  }
  set.meshes.clear()
}
