import type { Mesh, ShaderMaterial } from 'three'
import type { PartPaint, SystemPartId } from '@/features/trade-scenes/types'

// What the thermal camera put on one mesh of a lit system part: the material it wore, and the ramps it wears instead.
export interface PartRamp {
  part: SystemPartId
  original: Mesh['material']
  paint: ShaderMaterial[]
}

// The ramp runs from the part's inner face temperature at the mesh's lowest local y to the outer one at its highest, so a
// batt or a blanket shows the heat falling off through its depth; an instanced piece ramps through its own thickness.
export function fitRamp(material: ShaderMaterial, mesh: Mesh, paint: PartPaint): void {
  const geometry = mesh.geometry
  if (!geometry.boundingBox) {
    geometry.computeBoundingBox()
  }
  const box = geometry.boundingBox!
  material.uniforms.uCentre.value = (box.min.y + box.max.y) / 2
  material.uniforms.uHalfThickness.value = Math.max((box.max.y - box.min.y) / 2, 1e-4)
  material.uniforms.uInner.value = paint.inner
  material.uniforms.uOuter.value = paint.outer
}

export function tintRamps(ramps: ReadonlyMap<Mesh, PartRamp>, parts: Readonly<Partial<Record<SystemPartId, PartPaint>>>): void {
  for (const { part, paint } of ramps.values()) {
    const temperatures = parts[part]
    if (temperatures === undefined) {
      continue
    }
    for (const material of paint) {
      material.uniforms.uInner.value = temperatures.inner
      material.uniforms.uOuter.value = temperatures.outer
    }
  }
}
