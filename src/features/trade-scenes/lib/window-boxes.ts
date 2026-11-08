import type { BoxSpec, HouseWall, WallOpening } from '@/features/trade-scenes/types'

import { wallBox } from '@/features/trade-scenes/lib/wall-boxes'

interface WindowFrame {
  bar: number
  depth: number
  panes: number
}

const PANE_THICKNESS = 0.008
const MULLION_ABOVE_WIDTH = 1.2
const SILL_LEDGE = { depth: 0.07, height: 0.04, overhang: 0.06 }

// The ledge under a window, standing out from the wall's face; its top is the sill.
export function sillLedgeBox(wall: HouseWall, opening: WallOpening, floorY: number, wallThickness: number): BoxSpec {
  const sill = floorY + opening.sill
  const along = [opening.along - opening.width / 2 - SILL_LEDGE.overhang, opening.along + opening.width / 2 + SILL_LEDGE.overhang] as const
  return wallBox(wall, along, [sill - SILL_LEDGE.height, sill], wallThickness / 2 + SILL_LEDGE.depth / 2 - 0.02, SILL_LEDGE.depth)
}

// A frame of four bars (and a mullion on wide windows), an outside sill ledge, and one or two panes of glass. The frame is
// also split into an outer and an inner half, so the two sides can be coloured apart.
export function windowBoxes(wall: HouseWall, opening: WallOpening, frame: WindowFrame, floorY: number, wallThickness: number): { frames: BoxSpec[], outside: BoxSpec[], inside: BoxSpec[], glass: BoxSpec[] } {
  const left = opening.along - opening.width / 2
  const right = opening.along + opening.width / 2
  const sill = floorY + opening.sill
  const head = floorY + opening.head
  const { bar, depth } = frame
  const bars: Array<readonly [readonly [number, number], readonly [number, number]]> = [
    [[left, right], [head - bar, head]],
    [[left, right], [sill, sill + bar]],
    [[left, left + bar], [sill, head]],
    [[right - bar, right], [sill, head]],
  ]
  const ledge = sillLedgeBox(wall, opening, floorY, wallThickness)
  const mullion = opening.width > MULLION_ABOVE_WIDTH ? [[opening.along - bar * 0.4, opening.along + bar * 0.4], [sill, head]] as const : null
  const frames: BoxSpec[] = [...bars.map(([along, height]) => wallBox(wall, along, height, 0, depth)), ledge]
  const half = (side: 1 | -1): BoxSpec[] => [
    ...bars.map(([along, height]) => wallBox(wall, along, height, side * depth / 4, depth / 2)),
    ...(mullion ? [wallBox(wall, mullion[0], mullion[1], side * depth * 0.2, depth * 0.4)] : []),
  ]
  if (mullion) {
    frames.push(wallBox(wall, mullion[0], mullion[1], 0, depth * 0.8))
  }
  const offsets = frame.panes === 1 ? [0] : [-depth * 0.22, depth * 0.22]
  const glass = offsets.map(offset => wallBox(wall, [left + bar, right - bar], [sill + bar, head - bar], offset, PANE_THICKNESS))
  const outer = half(1)
  return { frames, outside: [...outer.slice(0, bars.length), ledge, ...outer.slice(bars.length)], inside: half(-1), glass }
}
