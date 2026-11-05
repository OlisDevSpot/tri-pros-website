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

// Every box of one colour becomes one draw call, which is what keeps a whole furnished house light on an iPad.
// The rounded edges catch a soft highlight, the warm stylized look; thin boards stay square since a bevel would eat them.
export function mergeBoxes(boxes: readonly BoxSpec[], radius = 0): BufferGeometry {
  const matrix = new Matrix4()
  const rotation = new Quaternion()
  const euler = new Euler()
  const parts = boxes.map(({ size, position, rotation: turn }) => {
    const [width, height, depth] = size
    const fitted = Math.min(radius, Math.min(width, height, depth) / 2 - 0.002)
    // The rounded box comes unindexed, and a merge needs every part alike.
    const geometry = fitted > 0.004 ? new RoundedBoxGeometry(width, height, depth, 2, fitted) : unindexed(new BoxGeometry(width, height, depth))
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
