import type { BufferGeometry } from 'three'
import type { BoxSpec } from '@/features/trade-scenes/types'

import { BoxGeometry, Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

function unindexed(geometry: BufferGeometry): BufferGeometry {
  const flat = geometry.toNonIndexed()
  geometry.dispose()
  return flat
}

// A box's own UVs run 0..1 per face, so a texture would stretch with the box. In metres a repeating texture keeps its real scale.
// The projection is chosen per triangle, so a rounded corner never tears; the box's rotation is applied after, which keeps a tilted board's size.
function mapInMetres(geometry: BufferGeometry, position: readonly [number, number, number]) {
  const at = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const normal = new Vector3()
  for (let i = 0; i + 2 < at.count; i += 3) {
    a.fromBufferAttribute(at, i)
    b.fromBufferAttribute(at, i + 1)
    c.fromBufferAttribute(at, i + 2)
    normal.subVectors(c, b).cross(a.clone().sub(b))
    const ax = Math.abs(normal.x)
    const ay = Math.abs(normal.y)
    const az = Math.abs(normal.z)
    for (let k = 0; k < 3; k++) {
      const x = at.getX(i + k) + position[0]
      const y = at.getY(i + k) + position[1]
      const z = at.getZ(i + k) + position[2]
      if (ay >= ax && ay >= az) {
        uv.setXY(i + k, x, z)
      }
      else if (ax >= az) {
        uv.setXY(i + k, z, y)
      }
      else {
        uv.setXY(i + k, x, y)
      }
    }
  }
}

// Every box of one colour becomes one draw call, which is what keeps a whole furnished house light on an iPad.
// The rounded edges catch a soft highlight, the warm stylized look; thin boards stay square since a bevel would eat them.
export function mergeBoxes(boxes: readonly BoxSpec[], radius = 0, uvs: 'per-box' | 'metres' = 'per-box'): BufferGeometry {
  const matrix = new Matrix4()
  const rotation = new Quaternion()
  const euler = new Euler()
  const parts = boxes.map(({ size, position, rotation: turn }) => {
    const [width, height, depth] = size
    const fitted = Math.min(radius, Math.min(width, height, depth) / 2 - 0.002)
    // The rounded box comes unindexed, and a merge needs every part alike.
    const geometry = fitted > 0.004 ? new RoundedBoxGeometry(width, height, depth, 2, fitted) : unindexed(new BoxGeometry(width, height, depth))
    if (uvs === 'metres') {
      mapInMetres(geometry, position)
    }
    rotation.setFromEuler(euler.set(turn?.[0] ?? 0, turn?.[1] ?? 0, turn?.[2] ?? 0))
    matrix.compose(new Vector3(...position), rotation, new Vector3(1, 1, 1))
    geometry.applyMatrix4(matrix)
    return geometry
  })
  const merged = parts.length > 0 ? mergeGeometries(parts) : new BoxGeometry(0, 0, 0)
  parts.forEach(part => part.dispose())
  if (!merged) {
    throw new Error('mergeBoxes: the boxes could not be merged into one geometry')
  }
  return merged
}
