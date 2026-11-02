import { CylinderGeometry } from 'three'

// A barrel tile: a half-pipe whose axis runs down the slope; `upper` picks the cap's arc over the pan's.
export function createHalfPipeGeometry(radius: number, length: number, upper: boolean): CylinderGeometry {
  const geometry = new CylinderGeometry(radius, radius, length, 14, 1, true, upper ? 0 : Math.PI, Math.PI)
  geometry.rotateZ(Math.PI / 2)
  return geometry
}
