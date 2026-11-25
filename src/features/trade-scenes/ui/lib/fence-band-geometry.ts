import type { BufferGeometry } from 'three'
import type { LineRange, LotOrigin } from '@/features/trade-scenes/types'
import type { GradeQuadBuffers } from '@/features/trade-scenes/ui/lib/region-strip-geometry'

import { metresOf } from '@/features/trade-scenes/lib/tile-units'
import { gradeQuadsGeometry, pushGradeQuad } from '@/features/trade-scenes/ui/lib/region-strip-geometry'

// A quad per cell rather than one for the whole length, so an along band bends with the grade at every row.
export function fenceBandGeometry(range: LineRange, origin: LotOrigin, heightAt: (z: number) => number, width: number, lift: number): BufferGeometry {
  const { originX, frontZ, tile } = origin
  const colX = (c: number) => originX + metresOf(c, tile)
  const rowZ = (r: number) => frontZ - metresOf(r, tile)
  const buffers: GradeQuadBuffers = { positions: [], normals: [], uvs: [] }
  const half = width / 2
  for (let cell = range.from; cell < range.to; cell++) {
    if (range.axis === 'across') {
      const z = rowZ(range.line)
      pushGradeQuad(buffers, heightAt, { x0: colX(cell), x1: colX(cell + 1), zBack: z - half, zFront: z + half }, lift)
    }
    else {
      const x = colX(range.line)
      pushGradeQuad(buffers, heightAt, { x0: x - half, x1: x + half, zBack: rowZ(cell + 1), zFront: rowZ(cell) }, lift)
    }
  }
  return gradeQuadsGeometry(buffers)
}
