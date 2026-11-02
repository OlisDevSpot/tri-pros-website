import type { BufferGeometry } from 'three'
import type { CylinderSpec } from '@/features/trade-scenes/types'

import { CylinderGeometry, Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Every cylinder of one kind becomes one draw call, as the boxes do.
export function mergeCylinders(cylinders: readonly CylinderSpec[]): BufferGeometry {
  const matrix = new Matrix4()
  const rotation = new Quaternion()
  const euler = new Euler()
  const parts = cylinders.map(({ radiusTop, radiusBottom, height, segments, position, rotation: turn }) => {
    const geometry = new CylinderGeometry(radiusTop, radiusBottom, height, segments)
    rotation.setFromEuler(euler.set(turn?.[0] ?? 0, turn?.[1] ?? 0, turn?.[2] ?? 0))
    matrix.compose(new Vector3(...position), rotation, new Vector3(1, 1, 1))
    return geometry.applyMatrix4(matrix)
  })
  const merged = parts.length > 0 ? mergeGeometries(parts) : new CylinderGeometry(0, 0, 0)
  parts.forEach(part => part.dispose())
  if (!merged) {
    throw new Error('mergeCylinders: the cylinders could not be merged into one geometry')
  }
  return merged
}
