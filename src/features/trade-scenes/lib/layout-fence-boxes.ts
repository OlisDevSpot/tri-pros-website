import type { BoxSpec, FenceAxis, FenceBoxes, FenceKindId, FenceLine, FenceMap, GroundLayer, LotOrigin, Mass, PropertyLayout } from '@/features/trade-scenes/types'
import { HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { GARAGE, LOT } from '@/features/trade-scenes/constants/home-lot'
import { fenceCellIndex, fenceCellTiles, fenceGridOf } from '@/features/trade-scenes/lib/fence-cells'
import { alongZ, boards, capsOf, graded, lifted, LOW_WALL_BODY, rails, run, WALL_CAP, WALL_H, WALL_T } from '@/features/trade-scenes/lib/lot-box-parts'
import { worldRectOf } from '@/features/trade-scenes/lib/tile-at'
import { metresOf } from '@/features/trade-scenes/lib/tile-units'

type Built = { [List in keyof FenceBoxes]: BoxSpec[] }

// One height stretch of a fence line in world metres. `lo` < `hi` along the line (x on an across line, z on an along
// one); the board ends sit inside them where the line meets a lot line, and the rails stand off toward the lot's middle.
interface FencePiece {
  axis: FenceAxis
  height: number
  at: number
  railAt: number
  lo: number
  hi: number
  boardLo: number
  boardHi: number
  cells: number
}

interface Ground {
  heightAt: (z: number) => number
  padEnd: number
}

const RAIL_OFFSET = 0.03

// A front-yard stretch builds no taller than the 42 in cap, so a block wall there is built low; a low wall already is.
function shownAt(kind: FenceKindId, capped: boolean): { kind: FenceKindId, height: number } {
  if (kind === 'lowWall') {
    return { kind, height: LOT.frontFence }
  }
  if (capped) {
    return { kind: kind === 'blockWall' ? 'lowWall' : kind, height: LOT.frontFence }
  }
  return { kind, height: LOT.wall.height }
}

interface HeightStretch { from: number, to: number, kind: FenceKindId, height: number }

// An across line stands wholly in front of the face or behind it; an along line is capped up to the face row and full
// past it, and stays one stretch where both heights are the same.
function heightStretches(axis: FenceAxis, line: number, from: number, to: number, kind: FenceKindId, faceRow: number): HeightStretch[] {
  if (axis === 'across') {
    return [{ from, to, ...shownAt(kind, line <= faceRow) }]
  }
  const capped = { from, to: Math.min(to, faceRow), ...shownAt(kind, true) }
  const full = { from: Math.max(from, faceRow), to, ...shownAt(kind, false) }
  if (capped.from >= capped.to || full.from >= full.to) {
    return [capped.from < capped.to ? capped : full]
  }
  return capped.kind === full.kind && capped.height === full.height ? [{ ...capped, to }] : [capped, full]
}

function emptyBoxes(): Built {
  return { blockWalls: [], wallCaps: [], fenceBoards: [], fenceRails: [], vinylParts: [], compositeBoards: [], compositePosts: [], ironwork: [], chainPosts: [], chainMesh: [] }
}

function wallOnGrade(piece: FencePiece, ground: Ground, body: number, out: Built) {
  const { at, lo, hi } = piece
  out.blockWalls.push(...graded(ground.heightAt, ground.padEnd, at - WALL_T / 2, at + WALL_T / 2, lo, hi, body, 0))
  out.wallCaps.push(...graded(ground.heightAt, ground.padEnd, at - WALL_CAP.width / 2, at + WALL_CAP.width / 2, lo, hi, WALL_CAP.height, body))
}

function blockWall(piece: FencePiece, ground: Ground, out: Built) {
  const { at, lo, hi } = piece
  if (piece.axis === 'across') {
    const wall = lifted(run(lo, at, hi, at, WALL_H, WALL_T), ground.heightAt(at))
    out.blockWalls.push(wall)
    out.wallCaps.push(...capsOf([wall], WALL_CAP))
  }
  else if (hi <= ground.padEnd) {
    const wall = run(at, lo, at, hi, WALL_H, WALL_T)
    out.blockWalls.push(wall)
    out.wallCaps.push(...capsOf([wall], WALL_CAP))
  }
  else {
    wallOnGrade(piece, ground, WALL_H, out)
  }
}

function lowWall(piece: FencePiece, ground: Ground, out: Built) {
  const { at, lo, hi } = piece
  if (piece.axis === 'across') {
    const y = ground.heightAt(at)
    out.blockWalls.push(lifted(run(lo, at, hi, at, LOW_WALL_BODY, WALL_T), y))
    out.wallCaps.push(lifted(run(lo, at, hi, at, WALL_CAP.height, WALL_CAP.width), y + LOW_WALL_BODY))
  }
  else {
    wallOnGrade(piece, ground, LOW_WALL_BODY, out)
  }
}

function woodFence(piece: FencePiece, ground: Ground, out: Built) {
  const { at, railAt, lo, hi, boardLo, boardHi, height } = piece
  const railHeights = [height - 0.08, 0.3]
  if (piece.axis === 'across') {
    const y = ground.heightAt(at)
    out.fenceBoards.push(...boards(boardLo, boardHi, at, height).map(board => lifted(board, y)))
    out.fenceRails.push(...rails(lo, hi, railAt, railHeights).map(rail => lifted(rail, y)))
    return
  }
  out.fenceBoards.push(...boards(boardLo, boardHi, at, height).map(alongZ).map(board => lifted(board, ground.heightAt(board.position[2]))))
  for (const y of railHeights) {
    out.fenceRails.push(...graded(ground.heightAt, ground.padEnd, railAt - 0.02, railAt + 0.02, lo, hi, 0.09, y - 0.045))
  }
}

// The kinds below are laid out along their line first: x runs along it, z is the line itself, y rises from the grade.
function member(x0: number, x1: number, y0: number, y1: number, depth: number, z: number): BoxSpec {
  return { size: [x1 - x0, y1 - y0, depth], position: [(x0 + x1) / 2, (y0 + y1) / 2, z] }
}

// An upright stands level on the grade under its own middle, or under `levelAt` when it hangs with others that must stay
// square to each other (a gate leaf).
function stand(piece: FencePiece, ground: Ground, box: BoxSpec, levelAt = box.position[0]): BoxSpec {
  return piece.axis === 'across' ? lifted(box, ground.heightAt(piece.at)) : lifted(alongZ(box), ground.heightAt(levelAt))
}

// A member laid along an along line follows the slope, as the wood fence's rails do.
function follow(piece: FencePiece, ground: Ground, box: BoxSpec): BoxSpec[] {
  if (piece.axis === 'across') {
    return [lifted(box, ground.heightAt(piece.at))]
  }
  const [length, height, depth] = box.size
  const [x, y, z] = box.position
  return graded(ground.heightAt, ground.padEnd, z - depth / 2, z + depth / 2, x - length / 2, x + length / 2, height, y - height / 2)
}

// The end posts stand inside the drawn ends, so a fence meets a house face or a lot wall without passing it; the rest
// share the length evenly at no more than the kind's post spacing.
function postCentres(lo: number, hi: number, width: number, spacing: number): number[] {
  const first = lo + width / 2
  const last = hi - width / 2
  const bays = Math.max(1, Math.ceil((last - first) / spacing - 1e-9))
  return Array.from({ length: bays + 1 }, (_, i) => first + (i * (last - first)) / bays)
}

function baysBetween(centres: readonly number[], width: number): [number, number][] {
  return centres.slice(1).map((x, i) => [centres[i] + width / 2, x - width / 2])
}

const COMPOSITE_BOARD = { height: 0.14, depth: 0.02, spacing: 0.012 }

// Courses stack down from the top so the fence's top line is level; whatever is left sits as a small kick under the last.
function courses(y0: number, y1: number): number[] {
  const pitch = COMPOSITE_BOARD.height + COMPOSITE_BOARD.spacing
  const count = Math.floor((y1 - y0 + COMPOSITE_BOARD.spacing) / pitch)
  return Array.from({ length: count }, (_, i) => y1 - COMPOSITE_BOARD.height - i * pitch)
}

const PICKET = { width: 0.02, pitch: 0.1 }

function picketCentres(x0: number, x1: number): number[] {
  const count = Math.max(1, Math.floor((x1 - x0) / PICKET.pitch))
  const first = (x0 + x1) / 2 - ((count - 1) * PICKET.pitch) / 2
  return Array.from({ length: count }, (_, i) => first + i * PICKET.pitch)
}

// Post spacing follows the stock bays: 8 ft vinyl panels and iron sections, 6 ft composite, 10 ft chain-link line posts.
const VINYL = { post: 0.12, spacing: 2.44, rise: 0.04, cap: 0.16, capHeight: 0.04, panel: 0.03, clear: 0.05 }
const COMPOSITE = { post: 0.1, spacing: 1.83, rise: 0.05, clear: 0.01 }
const IRON = { post: 0.06, spacing: 2.44, rise: 0.05, rail: 0.03, topRailDrop: 0.05, bottomRail: 0.12, clear: 0.05 }
const CHAIN = { post: 0.05, spacing: 3.05, rise: 0.03, rail: 0.04, mesh: 0.005 }

function vinylFence(piece: FencePiece, ground: Ground, out: Built) {
  const { at, height } = piece
  const centres = postCentres(piece.boardLo, piece.boardHi, VINYL.post, VINYL.spacing)
  for (const x of centres) {
    out.vinylParts.push(stand(piece, ground, member(x - VINYL.post / 2, x + VINYL.post / 2, 0, height + VINYL.rise, VINYL.post, at)))
    out.vinylParts.push(stand(piece, ground, member(x - VINYL.cap / 2, x + VINYL.cap / 2, height + VINYL.rise, height + VINYL.rise + VINYL.capHeight, VINYL.cap, at)))
  }
  for (const [x0, x1] of baysBetween(centres, VINYL.post)) {
    out.vinylParts.push(...follow(piece, ground, member(x0, x1, VINYL.clear, height, VINYL.panel, at)))
  }
}

function compositeFence(piece: FencePiece, ground: Ground, out: Built) {
  const { at, height } = piece
  const centres = postCentres(piece.boardLo, piece.boardHi, COMPOSITE.post, COMPOSITE.spacing)
  for (const x of centres) {
    out.compositePosts.push(stand(piece, ground, member(x - COMPOSITE.post / 2, x + COMPOSITE.post / 2, 0, height + COMPOSITE.rise, COMPOSITE.post, at)))
  }
  for (const [x0, x1] of baysBetween(centres, COMPOSITE.post)) {
    for (const y of courses(COMPOSITE.clear, height)) {
      out.compositeBoards.push(...follow(piece, ground, member(x0, x1, y, y + COMPOSITE_BOARD.height, COMPOSITE_BOARD.depth, at)))
    }
  }
}

function wroughtIron(piece: FencePiece, ground: Ground, out: Built) {
  const { at, height } = piece
  const centres = postCentres(piece.boardLo, piece.boardHi, IRON.post, IRON.spacing)
  for (const x of centres) {
    out.ironwork.push(stand(piece, ground, member(x - IRON.post / 2, x + IRON.post / 2, 0, height + IRON.rise, IRON.post, at)))
  }
  for (const [x0, x1] of baysBetween(centres, IRON.post)) {
    for (const y of [height - IRON.topRailDrop, IRON.bottomRail]) {
      out.ironwork.push(...follow(piece, ground, member(x0, x1, y - IRON.rail / 2, y + IRON.rail / 2, IRON.rail, at)))
    }
    for (const x of picketCentres(x0, x1)) {
      out.ironwork.push(stand(piece, ground, member(x - PICKET.width / 2, x + PICKET.width / 2, IRON.clear, height, PICKET.width, at)))
    }
  }
}

// The mesh is one plane the length of the line: drawn see-through, it reads as woven wire without a box per strand.
function chainLink(piece: FencePiece, ground: Ground, out: Built) {
  const { at, height, boardLo, boardHi } = piece
  for (const x of postCentres(boardLo, boardHi, CHAIN.post, CHAIN.spacing)) {
    out.chainPosts.push(stand(piece, ground, member(x - CHAIN.post / 2, x + CHAIN.post / 2, 0, height + CHAIN.rise, CHAIN.post, at)))
  }
  out.chainPosts.push(...follow(piece, ground, member(boardLo, boardHi, height - CHAIN.rail, height, CHAIN.rail, at)))
  out.chainMesh.push(...follow(piece, ground, member(boardLo, boardHi, 0, height, CHAIN.mesh, at)))
}

const GATE = { post: 0.1, rise: 0.08, frame: 0.06, hinge: 0.02, clear: 0.05, singleLeafCells: 2 }

type GateFamily = 'wood' | 'vinyl' | 'composite' | 'iron'

interface LeafInfill { x0: number, x1: number, y0: number, y1: number, z: number }

const GATE_PARTS: Record<GateFamily, { posts: keyof Built, frame: keyof Built, infill: keyof Built, depth: number, fill: (infill: LeafInfill) => BoxSpec[] }> = {
  wood: {
    posts: 'fenceBoards',
    frame: 'fenceRails',
    infill: 'fenceBoards',
    depth: 0.04,
    fill: ({ x0, x1, y0, y1, z }) => {
      const laid = boards(x0, x1, z, y1 - y0)
      const last = laid.at(-1)
      // The boards start at the frame's left; half what is left over moves to the left so the leaf reads centred.
      const slack = last ? (x1 - last.position[0] - last.size[0] / 2) / 2 : 0
      return laid.map(board => lifted({ ...board, position: [board.position[0] + slack, board.position[1], z] }, y0))
    },
  },
  vinyl: {
    posts: 'vinylParts',
    frame: 'vinylParts',
    infill: 'vinylParts',
    depth: 0.04,
    fill: ({ x0, x1, y0, y1, z }) => [member(x0, x1, y0, y1, VINYL.panel, z)],
  },
  composite: {
    posts: 'compositePosts',
    frame: 'compositePosts',
    infill: 'compositeBoards',
    depth: 0.04,
    fill: ({ x0, x1, y0, y1, z }) => courses(y0, y1).map(y => member(x0, x1, y, y + COMPOSITE_BOARD.height, COMPOSITE_BOARD.depth, z)),
  },
  iron: {
    posts: 'ironwork',
    frame: 'ironwork',
    infill: 'ironwork',
    depth: IRON.rail,
    fill: ({ x0, x1, y0, y1, z }) => picketCentres(x0, x1).map(x => member(x - PICKET.width / 2, x + PICKET.width / 2, y0, y1, PICKET.width, z)),
  },
}

// A gate hangs between two posts of its own, so it draws whether or not a fence stands either side. A short gate is one
// leaf; a wider one is a pair meeting in the middle, as a drive or side-yard double gate is.
function gateOf(family: GateFamily) {
  return (piece: FencePiece, ground: Ground, out: Built) => {
    const { at, height, boardLo, boardHi, cells } = piece
    const parts = GATE_PARTS[family]
    for (const x of [boardLo + GATE.post / 2, boardHi - GATE.post / 2]) {
      out[parts.posts].push(stand(piece, ground, member(x - GATE.post / 2, x + GATE.post / 2, 0, height + GATE.rise, GATE.post, at)))
    }
    const x0 = boardLo + GATE.post + GATE.hinge
    const x1 = boardHi - GATE.post - GATE.hinge
    const middle = (x0 + x1) / 2
    const leaves: [number, number][] = cells <= GATE.singleLeafCells ? [[x0, x1]] : [[x0, middle - GATE.hinge / 2], [middle + GATE.hinge / 2, x1]]
    const [y0, y1] = [GATE.clear, height]
    const f = GATE.frame
    for (const [a, b] of leaves) {
      // A leaf hangs level, so on a slope it takes the highest grade under it, or its uphill end would drag in the ground.
      // An across line stands at one grade, so only a leaf on an along line looks for its high side.
      const levelAt = piece.axis === 'along' ? [a, (a + b) / 2, b].reduce((high, x) => (ground.heightAt(x) > ground.heightAt(high) ? x : high)) : undefined
      const level = (box: BoxSpec) => stand(piece, ground, box, levelAt)
      out[parts.frame].push(...[
        member(a, a + f, y0, y1, parts.depth, at),
        member(b - f, b, y0, y1, parts.depth, at),
        member(a + f, b - f, y0, y0 + f, parts.depth, at),
        member(a + f, b - f, y1 - f, y1, parts.depth, at),
      ].map(level))
      out[parts.infill].push(...parts.fill({ x0: a + f, x1: b - f, y0: y0 + f, y1: y1 - f, z: at }).map(level))
    }
  }
}

const KIND_BUILDERS: Record<FenceKindId, (piece: FencePiece, ground: Ground, out: Built) => void> = {
  blockWall,
  lowWall,
  woodFence,
  vinylFence,
  compositeFence,
  wroughtIron,
  chainLink,
  woodGate: gateOf('wood'),
  vinylGate: gateOf('vinyl'),
  compositeGate: gateOf('composite'),
  ironGate: gateOf('iron'),
}

export function layoutFenceBoxes(
  layout: PropertyLayout,
  origin: LotOrigin,
  heightAt: (z: number) => number,
  lines: readonly FenceLine[],
  fenceMask: FenceMap,
  layer: GroundLayer,
): FenceBoxes {
  const { tile, lot, house } = layout
  const main = house.masses.find(mass => mass.role === 'main')
  if (!main) {
    throw new Error('A property layout has one main mass.')
  }
  const faceRow = main.r0
  const rowZ = (row: number) => origin.frontZ - metresOf(row, tile)
  const colX = (col: number) => origin.originX + metresOf(col, tile)
  const ground: Ground = { heightAt, padEnd: rowZ(lot.grade.padEndRow) }
  const worldOf = (axis: FenceAxis, vertex: number) => (axis === 'across' ? colX(vertex) : rowZ(vertex))

  // The house is still drawn from its constants, so a fence that meets a mass closes on the house's and the garage's
  // faces rather than where the mass's tiles stop. `near` is the face on the street or left side of the mass.
  const faceOf = (mass: Mass, axis: FenceAxis, near: boolean): number => {
    if (mass.role === 'main') {
      return axis === 'across' ? (near ? -HOUSE.halfLength : HOUSE.halfLength) : (near ? HOUSE.halfDepth : -HOUSE.halfDepth)
    }
    if (mass.role === 'garage') {
      return axis === 'across' ? (near ? GARAGE.x0 : GARAGE.x1) : (near ? GARAGE.z1 : GARAGE.z0)
    }
    const rect = worldRectOf(origin, mass)
    return axis === 'across' ? (near ? rect.x0 : rect.x1) : (near ? rect.z1 : rect.z0)
  }
  const massOfTile = (index: number) => {
    const c = index % lot.cols
    const r = Math.floor(index / lot.cols)
    return house.masses.find(mass => c >= mass.c0 && c < mass.c0 + mass.cols && r >= mass.r0 && r < mass.r0 + mass.rows)
  }
  // `outward` is +1 at a line's `to` end and -1 at its `from` end.
  const massFaceAt = (axis: FenceAxis, line: number, vertex: number, outward: 1 | -1): number | null => {
    const past = outward > 0 ? vertex : vertex - 1
    if (past >= 0 && past < fenceGridOf(lot, axis).cells && fenceMask[axis][fenceCellIndex(lot, axis, line, past)] === 1) {
      const mass = massOfTile(fenceCellTiles(lot, axis, line, past)[1])
      if (mass) {
        return faceOf(mass, axis, outward > 0)
      }
    }
    for (const mass of house.masses) {
      const [near, far, lo, hi] = axis === 'across'
        ? [mass.c0, mass.c0 + mass.cols, mass.r0, mass.r0 + mass.rows]
        : [mass.r0, mass.r0 + mass.rows, mass.c0, mass.c0 + mass.cols]
      if (line >= lo && line <= hi && (vertex === near || vertex === far)) {
        return faceOf(mass, axis, vertex === near)
      }
    }
    return null
  }

  const out = emptyBoxes()
  const shownKind = (line: FenceLine) => (layer === 'proposed' ? line.proposed ?? line.existing : line.existing)
  // Lines split wherever the other layer changes, so neighbours that show the same kind on this layer build as one.
  const merged: { axis: FenceAxis, line: number, from: number, to: number, kind: FenceKindId }[] = []
  for (const line of lines) {
    const kind = shownKind(line)
    if (!kind) {
      continue
    }
    const last = merged.at(-1)
    if (last && last.axis === line.axis && last.line === line.line && last.to === line.from && last.kind === kind) {
      last.to = line.to
    }
    else {
      merged.push({ axis: line.axis, line: line.line, from: line.from, to: line.to, kind })
    }
  }

  for (const { axis, line, from, to, kind } of merged) {
    const { cells } = fenceGridOf(lot, axis)
    const at = axis === 'across' ? rowZ(line) : colX(line)
    const inward = axis === 'across' ? (line < lot.rows / 2 ? -1 : 1) : (line <= lot.cols / 2 ? 1 : -1)
    for (const stretch of heightStretches(axis, line, from, to, kind, faceRow)) {
      const build = KIND_BUILDERS[stretch.kind]
      // Only the line's own ends meet a mass or a lot line; where the height changes the stretches simply abut.
      const endOf = (vertex: number, outward: 1 | -1) => {
        const lineEnd = outward > 0 ? vertex === to : vertex === from
        const world = (lineEnd ? massFaceAt(axis, line, vertex, outward) : null) ?? worldOf(axis, vertex)
        return { world, inset: lineEnd && (vertex === 0 || vertex === cells) ? WALL_T / 2 : 0 }
      }
      const start = endOf(stretch.from, -1)
      const end = endOf(stretch.to, 1)
      const [low, high] = start.world <= end.world ? [start, end] : [end, start]
      build({
        axis,
        height: stretch.height,
        at,
        railAt: at + inward * RAIL_OFFSET,
        lo: low.world,
        hi: high.world,
        boardLo: low.world + low.inset,
        boardHi: high.world - high.inset,
        cells: stretch.to - stretch.from,
      }, ground, out)
    }
  }
  return out
}
