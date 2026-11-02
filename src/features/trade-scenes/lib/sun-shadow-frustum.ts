import type { SunShadowFrustum, Vec3 } from '@/features/trade-scenes/types'

// Slack so the box's silhouette never lands on the frustum's edge.
const MARGIN = 1

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
function normalize(a: Vec3): Vec3 {
  const length = Math.hypot(a[0], a[1], a[2])
  return [a[0] / length, a[1] / length, a[2] / length]
}

// A directional light's orthographic shadow camera, fitted to a box: it looks from `distance` along `direction` at the
// box's centre, with the camera's up on +y, and spans the box's eight corners in that view.
export function sunShadowFrustum(direction: Vec3, box: { min: Vec3, max: Vec3 }, distance: number): SunShadowFrustum {
  const target: Vec3 = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2]
  const toward = normalize(direction)
  const position: Vec3 = [target[0] + toward[0] * distance, target[1] + toward[1] * distance, target[2] + toward[2] * distance]

  const forward: Vec3 = [-toward[0], -toward[1], -toward[2]]
  const right = normalize(cross(forward, [0, 1, 0]))
  const up = cross(right, forward)

  let left = Infinity
  let rightEdge = -Infinity
  let bottom = Infinity
  let top = -Infinity
  let near = Infinity
  let far = -Infinity
  for (const x of [box.min[0], box.max[0]]) {
    for (const y of [box.min[1], box.max[1]]) {
      for (const z of [box.min[2], box.max[2]]) {
        const offset = sub([x, y, z], position)
        const across = dot(offset, right)
        const vertical = dot(offset, up)
        const depth = dot(offset, forward)
        left = Math.min(left, across)
        rightEdge = Math.max(rightEdge, across)
        bottom = Math.min(bottom, vertical)
        top = Math.max(top, vertical)
        near = Math.min(near, depth)
        far = Math.max(far, depth)
      }
    }
  }
  return {
    position,
    target,
    left: left - MARGIN,
    right: rightEdge + MARGIN,
    top: top + MARGIN,
    bottom: bottom - MARGIN,
    near: Math.max(0.1, near - MARGIN),
    far: far + MARGIN,
  }
}
