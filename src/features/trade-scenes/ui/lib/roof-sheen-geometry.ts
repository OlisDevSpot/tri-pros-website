import { BufferGeometry, Euler, Float32BufferAttribute, Vector3 } from 'three'

import { COVERING_BASE, COVERING_EAVE_X, SLOPE_LENGTH } from '@/features/trade-scenes/constants/home-geometry'
import { ROOF_SHEEN } from '@/features/trade-scenes/constants/home-life'
import { eaveLipBox } from '@/features/trade-scenes/lib/drip-edge-boxes'

const [ACROSS, DOWN] = ROOF_SHEEN.tile

// In a slope's own frame: a film over the covering from the ridge down to its edge, then a strip turning down over the
// drip edge to its lip's outer bottom, where the water leaves the roof. The UVs are in tiles, u along the ridge from the
// home's own zero, so every part of a slope lays the same streaks, and v rising down the slope and on over the edge, so the
// streaks carry on unbroken into the strip.
export function roofSheenGeometry(zFrom: number, zTo: number, rise: number): BufferGeometry {
  const film = COVERING_BASE + rise + ROOF_SHEEN.lift
  const lip = eaveLipBox(zFrom, zTo)
  const end = new Vector3(-lip.size[0] / 2, -lip.size[1] / 2, 0).applyEuler(new Euler(...lip.rotation!)).add(new Vector3(...lip.position))
  const [dx, dy] = [end.x - COVERING_EAVE_X, end.y - film]
  const drop = Math.hypot(dx, dy)
  // Facing out of the eave, away from the house.
  const [nx, ny] = [dy / drop, -dx / drop]
  const [uFrom, uTo] = [zFrom / ACROSS, zTo / ACROSS]
  const eaveV = (SLOPE_LENGTH - COVERING_EAVE_X) / DOWN
  const endV = eaveV + drop / DOWN

  // Both bands wind alike, upper row to lower, so each faces its own normal.
  const bands = [
    { rows: [[SLOPE_LENGTH, film, 0], [COVERING_EAVE_X, film, eaveV]], normal: [0, 1] },
    { rows: [[COVERING_EAVE_X, film, eaveV], [end.x, end.y, endV]], normal: [nx, ny] },
  ] as const
  const corners = bands.flatMap(({ rows: [upper, lower], normal }) => [
    { row: upper, z: zFrom, u: uFrom, normal },
    { row: upper, z: zTo, u: uTo, normal },
    { row: lower, z: zTo, u: uTo, normal },
    { row: lower, z: zFrom, u: uFrom, normal },
  ])
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(corners.flatMap(({ row: [x, y], z }) => [x, y, z]), 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(corners.flatMap(({ normal: [x, y] }) => [x, y, 0]), 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(corners.flatMap(({ row: [, , v], u }) => [u, v]), 2))
  geometry.setIndex(bands.flatMap((_, band) => [0, 2, 1, 0, 3, 2].map(corner => band * 4 + corner)))
  return geometry
}
