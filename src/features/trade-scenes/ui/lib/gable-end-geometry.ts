import { ExtrudeGeometry, Shape } from 'three'

// The stucco under a rake, from the wall top up the heel to the ridge, so no wedge stays open under the deck. It stands across
// z, centred on z = 0, and runs `thickness` in +x from x = 0.
export function gableEndGeometry(halfDepth: number, wallTopY: number, heelY: number, ridgeY: number, thickness: number): ExtrudeGeometry {
  const shape = new Shape()
  shape.moveTo(-halfDepth, wallTopY)
  shape.lineTo(halfDepth, wallTopY)
  shape.lineTo(halfDepth, heelY)
  shape.lineTo(0, ridgeY)
  shape.lineTo(-halfDepth, heelY)
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
  geometry.rotateY(Math.PI / 2)
  return geometry
}
