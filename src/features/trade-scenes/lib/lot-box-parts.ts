import type { BoxSpec } from '@/features/trade-scenes/types'

import { LOT, STREET_BAND } from '@/features/trade-scenes/constants/home-lot'

export const SLAB = 0.04
export const STREET_SPAN = 90
export const WALL_H = LOT.wall.height
export const WALL_T = LOT.wall.thickness
export const WALL_CAP = { height: LOT.wall.capHeight, width: LOT.wall.capWidth }
// The cap rides on the wall, so together they stay inside the 42 in limit.
export const LOW_WALL_BODY = LOT.frontFence - LOT.wall.capHeight

export function lifted(box: BoxSpec, y: number): BoxSpec {
  return { ...box, position: [box.position[0], box.position[1] + y, box.position[2]] }
}

// Boards and rails are built along x; a fence on an along line runs along z.
export function alongZ(box: BoxSpec): BoxSpec {
  return { size: [box.size[2], box.size[1], box.size[0]], position: [box.position[2], box.position[1], box.position[0]] }
}

export function rails(x0: number, x1: number, z: number, heights: readonly number[]): BoxSpec[] {
  return heights.map(y => ({ size: [x1 - x0, 0.09, 0.04], position: [(x0 + x1) / 2, y, z] }))
}

export function run(x0: number, z0: number, x1: number, z1: number, height: number, thickness: number): BoxSpec {
  const length = Math.hypot(x1 - x0, z1 - z0)
  const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0)
  return {
    size: alongX ? [length, height, thickness] : [thickness, height, length],
    position: [(x0 + x1) / 2, height / 2, (z0 + z1) / 2],
  }
}

// A slab laid on the grade between two depths, tilted to follow it.
export function onGrade(heightAt: (z: number) => number, x0: number, x1: number, z0: number, z1: number, thickness: number, raise = 0): BoxSpec {
  const y0 = heightAt(z0)
  const y1 = heightAt(z1)
  const length = z1 - z0
  return {
    size: [x1 - x0, thickness, Math.hypot(length, y1 - y0)],
    position: [(x0 + x1) / 2, (y0 + y1) / 2 + thickness / 2 + raise, (z0 + z1) / 2],
    rotation: [Math.atan2(y0 - y1, length), 0, 0],
  }
}

// A flat run over the pad, then a sloped one down the front yard: what anything laid from the house to the sidewalk needs.
export function padToFront(heightAt: (z: number) => number, padEnd: number, front: number, x0: number, x1: number, zStart: number, thickness: number, raise = 0): BoxSpec[] {
  return [onGrade(heightAt, x0, x1, zStart, padEnd, thickness, raise), onGrade(heightAt, x0, x1, padEnd, front, thickness, raise)]
}

// An along line runs down the front yard's slope, so whatever stands on it is laid on the grade, broken where the pad ends.
export function graded(heightAt: (z: number) => number, padEnd: number, x0: number, x1: number, zFar: number, zNear: number, thickness: number, raise = 0): BoxSpec[] {
  return zFar < padEnd && padEnd < zNear
    ? padToFront(heightAt, padEnd, zNear, x0, x1, zFar, thickness, raise)
    : [onGrade(heightAt, x0, x1, zFar, zNear, thickness, raise)]
}

// Vertical cedar boards a hairline apart: the side-yard fences and their gates.
export function boards(x0: number, x1: number, z: number, height: number): BoxSpec[] {
  const width = 0.14
  const count = Math.floor((x1 - x0) / (width + 0.012))
  return Array.from({ length: count }, (_, i) => ({
    size: [width, height, 0.025] as const,
    position: [x0 + (i + 0.5) * (width + 0.012), height / 2, z] as const,
  }))
}

// The cap overhangs its wall a little along its length and stands wider than it across.
export function capsOf(walls: readonly BoxSpec[], cap: { height: number, width: number }): BoxSpec[] {
  return walls.map(({ size, position }) => ({
    size: [size[0] > size[2] ? size[0] + 0.04 : cap.width, cap.height, size[2] > size[0] ? size[2] + 0.04 : cap.width] as const,
    position: [position[0], position[1] + size[1] / 2 + cap.height / 2, position[2]] as const,
  }))
}

// Both sides of the street, from the lot's front line out: sidewalk, parkway, curb and gutter, the asphalt, and the same back.
export function streetBand(front: number, grade: { walk: number, street: number, curb: number }): { concrete: BoxSpec[], asphalt: BoxSpec[] } {
  const { sidewalk, parkway, street } = STREET_BAND
  const curb = front + sidewalk + parkway
  const farCurb = curb + street
  const farWalk = farCurb + parkway
  const curbTop = grade.curb + SLAB
  const length = STREET_SPAN * 2
  return {
    concrete: [
      { size: [length, SLAB, sidewalk], position: [0, grade.walk + SLAB / 2, (front + (front + sidewalk)) / 2] },
      { size: [length, SLAB, sidewalk], position: [0, grade.walk + SLAB / 2, (farWalk + (farWalk + sidewalk)) / 2] },
      { size: [length, curbTop, grade.curb], position: [0, grade.street + curbTop / 2, curb + grade.curb / 2] },
      { size: [length, curbTop, grade.curb], position: [0, grade.street + curbTop / 2, farCurb - grade.curb / 2] },
      { size: [length, 0.02, 0.46], position: [0, grade.street + 0.012, curb + grade.curb + 0.23] },
      { size: [length, 0.02, 0.46], position: [0, grade.street + 0.012, farCurb - grade.curb - 0.23] },
    ],
    asphalt: [
      { size: [length, 0.02, farCurb - curb - 2 * grade.curb], position: [0, grade.street + 0.002, (curb + farCurb) / 2] },
    ],
  }
}
