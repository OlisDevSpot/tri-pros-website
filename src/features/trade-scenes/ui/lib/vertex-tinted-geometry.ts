import type { StainBoxes, TintedBoxes, Vec3 } from '@/features/trade-scenes/types'

import { BufferAttribute, BufferGeometry, Color, Euler, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { seededRandom } from '@/features/trade-scenes/lib/seeded-random'
import { STAIN_CELL_U } from '@/features/trade-scenes/ui/lib/create-stain-atlas'
import { mergeBoxes } from '@/features/trade-scenes/ui/lib/merge-boxes'

// Unindexed with a colour per vertex, so a whole plant, or a whole street of houses, merges into one draw call under a
// single vertexColors material. Each triangle takes its own shade within `jitter`, which reads as leaf and stucco variety.
// With an `alpha` the colour carries it as a fourth channel, which three reads as each vertex's own strength.
export function tintVertices(geometry: BufferGeometry, hex: string, jitter = 0, seed = 1, alpha?: number): BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry
  if (flat !== geometry) {
    geometry.dispose()
  }
  const count = flat.getAttribute('position').count
  const channels = alpha === undefined ? 3 : 4
  const colors = new Float32Array(count * channels)
  const random = seededRandom(seed)
  const shade = new Color()
  for (let i = 0; i < count; i += 3) {
    shade.set(hex).multiplyScalar(1 + (random() - 0.5) * jitter)
    for (let vertex = i; vertex < Math.min(i + 3, count); vertex++) {
      colors.set(alpha === undefined ? [shade.r, shade.g, shade.b] : [shade.r, shade.g, shade.b, alpha], vertex * channels)
    }
  }
  flat.setAttribute('color', new BufferAttribute(colors, channels))
  // A merge needs every part to carry the same attributes.
  if (flat.getAttribute('uv') === undefined) {
    flat.setAttribute('uv', new Float32BufferAttribute(new Float32Array(count * 2), 2))
  }
  return flat
}

// Turned about y first, so a part's own lean (x, z) stays relative to the way it faces.
export function placeGeometry(geometry: BufferGeometry, position: Vec3, rotation: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]): BufferGeometry {
  geometry.applyMatrix4(new Matrix4().compose(new Vector3(...position), new Quaternion().setFromEuler(new Euler(...rotation, 'YXZ')), new Vector3(...scale)))
  return geometry
}

// The parts' own normals are dropped and rebuilt over the merge, so the hip roofs and the hand-built strips light alike.
export function mergeTinted(parts: readonly BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts.map((part) => {
    part.deleteAttribute('normal')
    return part
  }))
  parts.forEach(part => part.dispose())
  if (!merged) {
    throw new Error('mergeTinted: the tinted parts could not be merged into one geometry')
  }
  merged.computeVertexNormals()
  return merged
}

// A painted surface's marks in one draw, each list in its own colour. Square boxes only: the merge's rebuilt normals come out flat
// on square faces but would facet a rounded edge. Null when there is nothing to draw, since a merge needs a first part.
export function mergeTintedBoxes(lists: readonly TintedBoxes[]): BufferGeometry | null {
  const parts = lists.filter(list => list.boxes.length > 0).map(list => tintVertices(mergeBoxes(list.boxes), list.color))
  return parts.length > 0 ? mergeTinted(parts) : null
}

// A painted surface's see-through stains in one draw, each list squeezed into its own cell of the stain atlas and carrying its
// strength in its vertex colour. Null when there is nothing to draw.
export function mergeStainBoxes(lists: readonly StainBoxes[]): BufferGeometry | null {
  const parts = lists.filter(list => list.boxes.length > 0).map((list) => {
    const geometry = mergeBoxes(list.boxes)
    const uv = geometry.getAttribute('uv')
    const [from, to] = STAIN_CELL_U[list.cell]
    for (let vertex = 0; vertex < uv.count; vertex++) {
      uv.setX(vertex, from + uv.getX(vertex) * (to - from))
    }
    return tintVertices(geometry, list.color, 0, 1, list.alpha)
  })
  return parts.length > 0 ? mergeTinted(parts) : null
}

// What a stains mesh holds with nothing to draw: no vertices, but the attributes its stains bring. The program three compiles
// at load is read off the geometry, and a stain's four-channel colour makes a program of its own.
export function emptyStainGeometry(): BufferGeometry {
  const geometry = new BufferGeometry()
  for (const [name, size] of [['position', 3], ['normal', 3], ['color', 4], ['uv', 2]] as const) {
    geometry.setAttribute(name, new Float32BufferAttribute([], size))
  }
  return geometry
}
