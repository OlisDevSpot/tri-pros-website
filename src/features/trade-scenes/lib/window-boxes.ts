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

// A frame of four bars (and a mullion on wide windows), an outside sill ledge, and one or two panes of glass.
export function windowBoxes(wall: HouseWall, opening: WallOpening, frame: WindowFrame, floorY: number, wallThickness: number): { frames: BoxSpec[], glass: BoxSpec[] } {
  const left = opening.along - opening.width / 2
  const right = opening.along + opening.width / 2
  const sill = floorY + opening.sill
  const head = floorY + opening.head
  const { bar, depth } = frame
  const frames: BoxSpec[] = [
    wallBox(wall, [left, right], [head - bar, head], 0, depth),
    wallBox(wall, [left, right], [sill, sill + bar], 0, depth),
    wallBox(wall, [left, left + bar], [sill, head], 0, depth),
    wallBox(wall, [right - bar, right], [sill, head], 0, depth),
    sillLedgeBox(wall, opening, floorY, wallThickness),
  ]
  if (opening.width > MULLION_ABOVE_WIDTH) {
    frames.push(wallBox(wall, [opening.along - bar * 0.4, opening.along + bar * 0.4], [sill, head], 0, depth * 0.8))
  }
  const offsets = frame.panes === 1 ? [0] : [-depth * 0.22, depth * 0.22]
  const glass = offsets.map(offset => wallBox(wall, [left + bar, right - bar], [sill + bar, head - bar], offset, PANE_THICKNESS))
  return { frames, glass }
}
