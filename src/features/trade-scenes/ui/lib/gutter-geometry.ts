import type { BoxSpec, GutterRun, GutterStation, Vec3 } from '@/features/trade-scenes/types'

import { BufferGeometry, Color, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { ROOF_TRIM } from '@/features/trade-scenes/constants/home-details'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { sideOf, stationPoint } from '@/features/trade-scenes/lib/gutter-run'
import { mergeBoxes } from '@/features/trade-scenes/ui/lib/merge-boxes'
import { tintVertices } from '@/features/trade-scenes/ui/lib/vertex-tinted-geometry'

type ProfilePoint = readonly [number, number]
type Rgb = readonly [number, number, number]

const { outline: OUTLINE, cap: CAP, front: FRONT } = ROOF_TRIM.gutter.profile
const STREAK_HALF = WEAR_LOOKS.gutter.streaks.width / 2
// Smooth across the curved front, whose facets turn by less than this, and hard at the profile's corners.
const CREASE = Math.PI / 6
const BOX_RADIUS = 0.01
const ON_EDGE = 1e-9

const triangles = (polygon: readonly ProfilePoint[]) => ShapeUtils.triangulateShape(polygon.map(([out, up]) => new Vector2(out, up)), [])
const OUTLINE_FACES = triangles(OUTLINE)
const CAP_FACES = triangles(CAP)
const SMOOTH = OUTLINE.map((point, i) => {
  const [before, after] = [OUTLINE[(i + OUTLINE.length - 1) % OUTLINE.length]!, OUTLINE[(i + 1) % OUTLINE.length]!]
  const [inX, inY, outX, outY] = [point[0] - before[0], point[1] - before[1], after[0] - point[0], after[1] - point[1]]
  return (inX * outX + inY * outY) / (Math.hypot(inX, inY) * Math.hypot(outX, outY)) > Math.cos(CREASE)
})

function rgb(hex: string): Rgb {
  const { r, g, b } = new Color(hex)
  return [r, g, b]
}

// Each section stands upright across the run at its station's x, so the run's slope comes from the stations' own drop and out,
// and an end's section lies flat on its x: the two pieces at the cut meet face to face whatever the wear.
function place(face: GutterRun['face'], station: GutterStation, [out, up]: ProfilePoint): Vec3 {
  const [cos, sin] = [Math.cos(station.roll), Math.sin(station.roll)]
  const [x, y, z] = stationPoint(face, station)
  return [x, y + up * cos - out * sin, z + sideOf(face) * (out * cos + up * sin)]
}

// The way profile point i runs along the gutter at station j: the slope of the parabola through it at three stations, so a straight
// stretch reads exactly straight and an end reads the run's own curve rather than its last chord. The sag leaves the cut level,
// which the kept piece's first three stations read too, so it shades flush with the straight piece it meets there.
function along(sections: readonly (readonly Vec3[])[], i: number, xs: readonly number[], j: number): Vec3 {
  if (xs.length === 2) {
    const [a, b] = [sections[0]![i]!, sections[1]![i]!]
    return [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  }
  const first = Math.min(Math.max(j - 1, 0), xs.length - 3)
  const [x0, x1, x2, at] = [xs[first]!, xs[first + 1]!, xs[first + 2]!, xs[j]!]
  const [w0, w1, w2] = [(2 * at - x1 - x2) / ((x0 - x1) * (x0 - x2)), (2 * at - x0 - x2) / ((x1 - x0) * (x1 - x2)), (2 * at - x0 - x1) / ((x2 - x0) * (x2 - x1))]
  const [p0, p1, p2] = [sections[first]![i]!, sections[first + 1]![i]!, sections[first + 2]![i]!]
  return [w0 * p0[0] + w1 * p1[0] + w2 * p2[0], w0 * p0[1] + w1 * p1[1] + w2 * p2[1], w0 * p0[2] + w1 * p1[2] + w2 * p2[2]]
}

function unit([x, y, z]: Vec3): Vec3 {
  const length = Math.hypot(x, y, z)
  return [x / length, y / length, z / length]
}

// Out of the sheet across an edge from one profile point to the next. The back run is mirrored into -z, which turns it inside out.
function edgeNormal(side: number, tangent: Vec3, from: Vec3, to: Vec3): Vec3 {
  const [x, y, z] = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
  return unit([side * (tangent[1] * z - tangent[2] * y), side * (tangent[2] * x - tangent[0] * z), side * (tangent[0] * y - tangent[1] * x)])
}

// The sheet's normals are known from its profile rather than searched for: across a point the surface runs along the run and along
// the profile's edge, and a smooth point shades halfway between its two edges. Each piece shades from its own stations alone, so the
// two at the cut agree without either seeing the other.
function sheetNormals(face: GutterRun['face'], sections: readonly (readonly Vec3[])[], xs: readonly number[]) {
  const side = sideOf(face)
  return sections.map((section, j) => {
    const into: Vec3[] = []
    const outOf: Vec3[] = []
    for (let i = 0; i < section.length; i++) {
      const tangent = along(sections, i, xs, j)
      const point = section[i]!
      const incoming = edgeNormal(side, tangent, section[(i + section.length - 1) % section.length]!, point)
      const outgoing = edgeNormal(side, tangent, point, section[(i + 1) % section.length]!)
      const blended = SMOOTH[i] ? unit([incoming[0] + outgoing[0], incoming[1] + outgoing[1], incoming[2] + outgoing[2]]) : null
      into.push(blended ?? incoming)
      outOf.push(blended ?? outgoing)
    }
    return { into, outOf }
  })
}

function sweep(run: GutterRun, streaks: readonly number[], color: Rgb, streakColor: Rgb): BufferGeometry {
  const sections = run.stations.map(station => OUTLINE.map(point => place(run.face, station, point)))
  const normals = sheetNormals(run.face, sections, run.stations.map(station => station.x))
  const streaked = run.stations.map(station => run.face === 'front' && streaks.some(x => Math.abs(station.x - x) <= STREAK_HALF + ON_EDGE))
  const tint = (j: number, i: number) => streaked[j] && i >= FRONT[0] && i <= FRONT[1] ? streakColor : color
  const last = run.stations.length - 1
  // An uncapped far end runs on into the next piece, whose start draws the one section they share: two faces there would meet inside
  // the tube and show a line at the join. The next piece's own section closes it when this one fades away.
  const ends = [{ j: 0, facing: -1, section: true, capped: run.capStart }, { j: last, facing: 1, section: run.capEnd, capped: run.capEnd }]
  const count = last * OUTLINE.length * 2 + ends.reduce((sum, end) => sum + (end.section ? OUTLINE_FACES.length : 0) + (end.capped ? CAP_FACES.length : 0), 0)
  const positions = new Float32Array(count * 9)
  const shading = new Float32Array(count * 9)
  const colors = new Float32Array(count * 9)
  let written = 0
  const corner = (point: Vec3, normal: Vec3, tone: Rgb) => {
    for (let axis = 0; axis < 3; axis++) {
      positions[written + axis] = point[axis]!
      shading[written + axis] = normal[axis]!
      colors[written + axis] = tone[axis]!
    }
    written += 3
  }

  // The back run's out is mirrored into -z, which turns the section's winding over.
  const quad = run.face === 'back' ? [[0, 0], [0, 1], [1, 1], [0, 0], [1, 1], [1, 0]] as const : [[0, 0], [1, 1], [0, 1], [0, 0], [1, 0], [1, 1]] as const
  for (let j = 0; j < last; j++) {
    for (let i = 0; i < OUTLINE.length; i++) {
      const k = (i + 1) % OUTLINE.length
      for (const [step, far] of quad) {
        const point = far ? k : i
        corner(sections[j + step]![point]!, far ? normals[j + step]!.into[k]! : normals[j + step]!.outOf[i]!, tint(j + step, point))
      }
    }
  }

  // The winding is read from the corners rather than assumed, since the back run's mirror and each end's side each turn it over.
  const across = (corners: readonly [Vec3, Vec3, Vec3], tints: readonly [Rgb, Rgb, Rgb], facing: number) => {
    const [a, b, c] = corners
    const normalX = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1])
    const flat: Vec3 = [facing, 0, 0]
    const order = Math.sign(normalX) === facing ? [0, 1, 2] : [0, 2, 1]
    order.forEach(index => corner(corners[index]!, flat, tints[index]!))
  }
  for (const { j, facing, section, capped } of ends) {
    if (section) {
      for (const [a, b, c] of OUTLINE_FACES) {
        across([sections[j]![a!]!, sections[j]![b!]!, sections[j]![c!]!], [tint(j, a!), tint(j, b!), tint(j, c!)], facing)
      }
    }
    if (capped) {
      const plate = CAP.map(point => place(run.face, run.stations[j]!, point))
      for (const [a, b, c] of CAP_FACES) {
        across([plate[a!]!, plate[b!]!, plate[c!]!], [color, color, color], facing)
      }
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(shading, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(new Float32Array(count * 6), 2))
  return geometry
}

// Every run in one mesh with the boxes hung on it. The streaks darken the front runs' outer face at the stations within a streak,
// so a streak shows only where the street sees it.
export function gutterGeometry(runs: readonly GutterRun[], boxes: readonly BoxSpec[], streaks: readonly number[], color: string, streakColor: string): BufferGeometry {
  const [base, streak] = [rgb(color), rgb(streakColor)]
  const parts = [
    ...runs.map(run => sweep(run, streaks, base, streak)),
    ...(boxes.length > 0 ? [tintVertices(mergeBoxes(boxes, BOX_RADIUS), color)] : []),
  ]
  const merged = mergeGeometries(parts)
  parts.forEach(part => part.dispose())
  if (!merged) {
    throw new Error('gutterGeometry: the runs could not be merged into one geometry')
  }
  return merged
}
