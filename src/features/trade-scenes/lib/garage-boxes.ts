import type { BoxSpec, GarageBoxes } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { GARAGE } from '@/features/trade-scenes/constants/home-lot'

const GARAGE_W = GARAGE.x1 - GARAGE.x0
const GARAGE_D = GARAGE.z1 - GARAGE.z0
const GARAGE_CX = (GARAGE.x0 + GARAGE.x1) / 2
const GARAGE_CZ = (GARAGE.z0 + GARAGE.z1) / 2
const DOOR = GARAGE.door

const DECK = GARAGE.wallTop + 0.15
const PARAPET = 0.2

// The door sits back from a proud surround, each surface a clear step from the next so no two faces share a plane.
const FACE = GARAGE.z1
const DOOR_FRONT = FACE + 0.03

// Four sections of eight short panels, the top section glazed. Each panel is a darker moulding ring with a field
// standing proud inside it; at a distance the ring is what reads, so it carries the tone.
const SECTIONS = 4
const COLUMNS = 8
const CELL_W = DOOR.width / COLUMNS
const CELL_H = DOOR.height / SECTIONS

function doorCells(rows: number[], inset: number, depth: number, step: number): BoxSpec[] {
  return rows.flatMap(row => Array.from({ length: COLUMNS }, (_, column) => ({
    size: [CELL_W - 2 * inset, CELL_H - 2 * inset, depth] as const,
    position: [GARAGE_CX - DOOR.width / 2 + (column + 0.5) * CELL_W, (row + 0.5) * CELL_H, DOOR_FRONT + step + depth / 2] as const,
  })))
}

// A pitched garage roof follows the house's: same pitch, ridge running the same way, eaves at the house's wall top.
const GARAGE_GABLE = {
  pitch: HOUSE.pitch,
  eave: HOUSE.eaveOverhang,
  thickness: 0.09,
  baseY: GARAGE.wallTop + HOUSE.heel,
  halfDepth: GARAGE_D / 2,
  centerX: GARAGE_CX + HOUSE.rakeOverhang / 2,
  length: GARAGE_W + HOUSE.rakeOverhang,
  centerZ: GARAGE_CZ,
}

export const garageGableApexY = GARAGE_GABLE.baseY + GARAGE_GABLE.halfDepth * Math.tan(GARAGE_GABLE.pitch)

function body(flat: boolean): BoxSpec[] {
  if (!flat) {
    return [{ size: [GARAGE_W, GARAGE.wallTop, GARAGE_D], position: [GARAGE_CX, GARAGE.wallTop / 2, GARAGE_CZ] }]
  }
  const rise = GARAGE.flatTop - DECK
  const y = DECK + rise / 2
  return [
    { size: [GARAGE_W, DECK, GARAGE_D], position: [GARAGE_CX, DECK / 2, GARAGE_CZ] },
    { size: [GARAGE_W, rise, PARAPET], position: [GARAGE_CX, y, GARAGE.z1 - PARAPET / 2] },
    { size: [GARAGE_W, rise, PARAPET], position: [GARAGE_CX, y, GARAGE.z0 + PARAPET / 2] },
    { size: [PARAPET, rise, GARAGE_D - 2 * PARAPET], position: [GARAGE.x1 - PARAPET / 2, y, GARAGE_CZ] },
    { size: [PARAPET, rise, GARAGE_D - 2 * PARAPET], position: [GARAGE.x0 + PARAPET / 2, y, GARAGE_CZ] },
  ]
}

function trim(flat: boolean): BoxSpec[] {
  const surround: BoxSpec[] = [
    { size: [DOOR.width + 0.4, 0.2, 0.1], position: [GARAGE_CX, DOOR.height + 0.1, FACE + 0.05] },
    { size: [0.2, DOOR.height, 0.1], position: [GARAGE_CX - DOOR.width / 2 - 0.1, DOOR.height / 2, FACE + 0.05] },
    { size: [0.2, DOOR.height, 0.1], position: [GARAGE_CX + DOOR.width / 2 + 0.1, DOOR.height / 2, FACE + 0.05] },
  ]
  // The stepped cornice and the parapet cap catch the low sun as lines.
  const cornice: BoxSpec[] = flat
    ? [
        { size: [GARAGE_W + 0.1, 0.16, GARAGE_D + 0.1], position: [GARAGE_CX, GARAGE.flatTop - 0.42, GARAGE_CZ] },
        { size: [GARAGE_W + 0.16, 0.07, GARAGE_D + 0.16], position: [GARAGE_CX, GARAGE.flatTop - 0.31, GARAGE_CZ] },
        { size: [GARAGE_W + 0.08, 0.06, GARAGE_D + 0.08], position: [GARAGE_CX, GARAGE.flatTop + 0.03, GARAGE_CZ] },
      ]
    : []
  return [...surround, ...cornice]
}

function gableSlopes(): BoxSpec[] {
  const { pitch, eave, thickness, baseY, halfDepth, centerX, length, centerZ } = GARAGE_GABLE
  const run = halfDepth + eave
  const slope = run / Math.cos(pitch)
  const ridgeY = baseY + halfDepth * Math.tan(pitch)
  const midY = ridgeY - (run / 2) * Math.tan(pitch) + thickness / 2
  return [
    { size: [length, thickness, slope], position: [centerX, midY, centerZ + run / 2], rotation: [pitch, 0, 0] },
    { size: [length, thickness, slope], position: [centerX, midY, centerZ - run / 2], rotation: [-pitch, 0, 0] },
  ]
}

function gableFascia(): BoxSpec[] {
  const { eave, baseY, halfDepth, centerX, length, centerZ, pitch } = GARAGE_GABLE
  const eaveY = baseY - eave * Math.tan(pitch)
  return [
    { size: [length, 0.18, 0.04], position: [centerX, eaveY - 0.04, centerZ + halfDepth + eave + 0.02] },
    { size: [length, 0.18, 0.04], position: [centerX, eaveY - 0.04, centerZ - halfDepth - eave - 0.02] },
  ]
}

export function garageBoxes(form: RoofForm): GarageBoxes {
  const flat = form === 'low-slope'
  return {
    body: body(flat),
    trim: trim(flat),
    door: [{ size: [DOOR.width, DOOR.height, 0.03], position: [GARAGE_CX, DOOR.height / 2, FACE + 0.015] }],
    doorMouldings: doorCells([0, 1, 2, 3], 0.05, 0.008, 0),
    doorFields: doorCells([0, 1, 2], 0.078, 0.014, 0.008),
    doorWindows: doorCells([3], 0.075, 0.006, 0.008),
    // A hair proud of the door face so the joints do not z-fight with it.
    doorLines: [1, 2, 3].map(i => ({
      size: [DOOR.width - 0.02, 0.014, 0.004] as const,
      position: [GARAGE_CX, CELL_H * i, DOOR_FRONT + 0.002] as const,
    })),
    membrane: flat ? [{ size: [GARAGE_W - 2 * PARAPET, 0.02, GARAGE_D - 2 * PARAPET], position: [GARAGE_CX, DECK + 0.01, GARAGE_CZ] }] : [],
    slopes: flat ? [] : gableSlopes(),
    fascia: flat ? [] : gableFascia(),
  }
}

export const GARAGE_BOXES: Record<RoofForm, GarageBoxes> = {
  'pitched': garageBoxes('pitched'),
  'low-slope': garageBoxes('low-slope'),
}
