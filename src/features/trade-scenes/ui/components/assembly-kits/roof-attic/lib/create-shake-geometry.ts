import { BoxGeometry } from 'three'

// A split shake tapers from a thick butt at the eave end (−x) to a thin tip under the next course, so each course casts a
// deep shadow line; a shingle-thin slab would read as asphalt. Unit wide along z, stretched per piece.
export function createShakeGeometry(length: number, butt: number, tip: number): BoxGeometry {
  const geometry = new BoxGeometry(length, butt, 1)
  const position = geometry.attributes.position
  for (let index = 0; index < position.count; index++) {
    if (position.getY(index) <= 0) {
      continue
    }
    const along = (position.getX(index) + length / 2) / length
    position.setY(index, -butt / 2 + butt + (tip - butt) * along)
  }
  geometry.computeVertexNormals()
  return geometry
}
