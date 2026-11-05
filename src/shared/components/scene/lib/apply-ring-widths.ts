export function applyRingWidths(positions: Float32Array, centres: Float32Array, normals: Float32Array, ringWidths: readonly number[], radialSegments: number): void {
  const verticesPerRing = radialSegments + 1
  for (let ring = 0; ring < ringWidths.length; ring++) {
    const radius = ringWidths[ring] / 2
    for (let side = 0; side < verticesPerRing; side++) {
      const index = (ring * verticesPerRing + side) * 3
      for (let axis = 0; axis < 3; axis++) {
        positions[index + axis] = centres[ring * 3 + axis] + normals[index + axis] * radius
      }
    }
  }
}
