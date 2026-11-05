import { CatmullRomCurve3, TubeGeometry, Vector3 } from 'three'

export const RIBBON_SEGMENTS = 48
export const RIBBON_RADIAL_SEGMENTS = 12

// At radius 1 every vertex sits at ring centre + its analytic normal, so the width profile can later be
// applied by scaling each ring about its centre without recomputing normals.
export function buildUnitTube(points: readonly [number, number, number][], segments = RIBBON_SEGMENTS): { geometry: TubeGeometry, centres: Float32Array } {
  const curve = new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z)))
  const geometry = new TubeGeometry(curve, segments, 1, RIBBON_RADIAL_SEGMENTS, false)
  const centres = new Float32Array((segments + 1) * 3)
  const centre = new Vector3()
  for (let ring = 0; ring <= segments; ring++) {
    curve.getPointAt(ring / segments, centre)
    centre.toArray(centres, ring * 3)
  }
  geometry.computeBoundingSphere()
  return { geometry, centres }
}
