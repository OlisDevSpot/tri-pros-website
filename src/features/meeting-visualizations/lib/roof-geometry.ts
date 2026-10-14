import { SCENE, SLOPE_LENGTH } from '@/features/meeting-visualizations/constants/roof-cutaway-scene'

/** Placement in a slope's local frame: x runs eave to ridge, y is the roof normal, z runs along the ridge. */
export interface PieceLayout {
  x: number
  y: number
  z: number
  /** Extent along z, after clipping to the slice. */
  width: number
  tilt: number
  shade: number
}

/** Deterministic, so a remount (or a second device mirroring the meeting) draws the same roof. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A layer's surface ends where it meets its mirror at the ridge centreline. A layer
 * sitting `offset` above the rafters must run a little further than the rafters do.
 */
export function slopeEndFor(offset: number): number {
  return SLOPE_LENGTH + offset * Math.tan(SCENE.pitch)
}

interface CoveringOptions {
  seed: number
  worn: boolean
  base: number
}

const SHINGLE_EXPOSURE = 0.2
export const SHINGLE_LENGTH = 0.34
const SHINGLE_TAB = 0.42
const SHINGLE_GAP = 0.016

export function layoutShingles({ seed, worn, base }: CoveringOptions): PieceLayout[] {
  const random = seededRandom(seed)
  const half = SCENE.depth / 2
  const end = slopeEndFor(base) - SHINGLE_LENGTH / 2
  const pieces: PieceLayout[] = []

  let row = 0
  for (let start = -SCENE.overhang; start < end; start += SHINGLE_EXPOSURE, row++) {
    const stagger = row % 2 === 0 ? 0 : SHINGLE_TAB / 2
    for (let left = -half - stagger; left < half; left += SHINGLE_TAB) {
      const z0 = Math.max(left + SHINGLE_GAP / 2, -half)
      const z1 = Math.min(left + SHINGLE_TAB - SHINGLE_GAP / 2, half)
      if (z1 - z0 < 0.04)
        continue

      const roll = random()
      if (worn && roll < 0.07)
        continue

      const curled = worn && roll > 0.94
      pieces.push({
        x: start + SHINGLE_LENGTH / 2,
        y: base + SCENE.shingleThickness / 2 + 0.012,
        z: (z0 + z1) / 2,
        width: z1 - z0,
        tilt: curled ? -0.32 : -0.07,
        shade: worn ? 0.72 + random() * 0.4 : 0.9 + random() * 0.16,
      })
    }
  }
  return pieces
}

export const TILE_LENGTH = 0.44
const TILE_EXPOSURE = 0.34
const TILE_COLUMN = SCENE.tileRadius * 2.3

/** Barrel tile in two courses: pans open upward, caps lap the seams between them. */
export function layoutTiles({ seed, worn, base }: CoveringOptions): { pans: PieceLayout[], caps: PieceLayout[] } {
  const random = seededRandom(seed)
  const half = SCENE.depth / 2
  const end = slopeEndFor(base) - TILE_LENGTH / 2
  const pans: PieceLayout[] = []
  const caps: PieceLayout[] = []

  for (let start = -SCENE.overhang; start < end; start += TILE_EXPOSURE) {
    let column = 0
    for (let z = -half + SCENE.tileRadius; z <= half - SCENE.tileRadius; z += TILE_COLUMN / 2, column++) {
      const roll = random()
      if (worn && roll < 0.05)
        continue

      const isCap = column % 2 === 1
      const piece: PieceLayout = {
        x: start + TILE_LENGTH / 2,
        y: base + (isCap ? SCENE.tileRadius * 0.55 : SCENE.tileRadius * 1.02),
        z,
        width: TILE_LENGTH,
        tilt: worn && roll > 0.95 ? -0.18 : -0.05,
        shade: worn ? 0.7 + random() * 0.35 : 0.88 + random() * 0.18,
      }
      ;(isCap ? caps : pans).push(piece)
    }
  }
  return { pans, caps }
}

/** Rafters and joists share one framing grid along the ridge, the way they are nailed together. */
export function framingPositions(): number[] {
  const half = SCENE.depth / 2 - SCENE.rafterWidth
  const count = Math.floor((half * 2) / SCENE.framingSpacing) + 1
  const used = (count - 1) * SCENE.framingSpacing
  return Array.from({ length: count }, (_, index) => -used / 2 + index * SCENE.framingSpacing)
}

/** Spaced 1x6 boards for pre-war and shake roofs. */
export function skipSheathingBoards(): Array<{ x: number, length: number }> {
  const board = 5.5 * SCENE.unitsPerInch * 1.4
  const gap = board * 0.75
  const boards: Array<{ x: number, length: number }> = []
  for (let x = -SCENE.overhang; x < SLOPE_LENGTH; x += board + gap)
    boards.push({ x: x + board / 2, length: board })
  return boards
}
