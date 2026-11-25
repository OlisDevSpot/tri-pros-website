import type { LotLayout, LotOrigin } from '@/features/trade-scenes/types'

import { BufferGeometry, Float32BufferAttribute } from 'three'

import { metresOf } from '@/features/trade-scenes/lib/tile-units'

export interface GradeQuadBuffers { positions: number[], normals: number[], uvs: number[] }
export interface GradeQuadRect { x0: number, x1: number, zBack: number, zFront: number }

// Each corner sits on the grade at its own z, so a quad follows the slope between its back and front without a height
// map. UVs are in metres, so a texture keeps its size whatever the quad's length.
export function pushGradeQuad(buffers: GradeQuadBuffers, heightAt: (z: number) => number, { x0, x1, zBack, zFront }: GradeQuadRect, lift: number): void {
  const yBack = heightAt(zBack) + lift
  const yFront = heightAt(zFront) + lift
  const a = [x0, yBack, zBack]
  const b = [x1, yBack, zBack]
  const c = [x1, yFront, zFront]
  const d = [x0, yFront, zFront]
  // Back to front, counter-clockwise from above, so the face looks up.
  for (const vertex of [a, c, b, a, d, c]) {
    buffers.positions.push(...vertex)
    buffers.normals.push(0, 1, 0)
    buffers.uvs.push(vertex[0], vertex[2])
  }
}

export function gradeQuadsGeometry({ positions, normals, uvs }: GradeQuadBuffers): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  return geometry
}

// One quad per run of picked tiles along a row, so a strip follows the slope between two rows.
export function regionStripGeometry(lot: LotLayout, origin: LotOrigin, heightAt: (z: number) => number, mask: Uint8Array, picks: (i: number) => boolean, raise: number): BufferGeometry {
  const { originX, frontZ, tile } = origin
  const buffers: GradeQuadBuffers = { positions: [], normals: [], uvs: [] }
  const pushQuad = (c0: number, c1: number, r: number) => {
    pushGradeQuad(buffers, heightAt, { x0: originX + metresOf(c0, tile), x1: originX + metresOf(c1, tile), zBack: frontZ - metresOf(r + 1, tile), zFront: frontZ - metresOf(r, tile) }, raise)
  }
  for (let r = 0; r < lot.rows; r++) {
    let runStart = -1
    for (let c = 0; c <= lot.cols; c++) {
      const i = r * lot.cols + c
      const picked = c < lot.cols && mask[i] !== 1 && picks(i)
      if (picked && runStart < 0) {
        runStart = c
      }
      else if (!picked && runStart >= 0) {
        pushQuad(runStart, c, r)
        runStart = -1
      }
    }
  }
  return gradeQuadsGeometry(buffers)
}
