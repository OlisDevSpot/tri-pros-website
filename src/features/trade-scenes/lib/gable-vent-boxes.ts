import type { BoxSpec, Vec3 } from '@/features/trade-scenes/types'

import { GABLE_VENT } from '@/features/trade-scenes/constants/home-details'
import { GABLE_VENT_Y, HOUSE } from '@/features/trade-scenes/constants/home-geometry'

export interface GableVentLook {
  width: number
  height: number
  frame: number
  slats: number
  slat: number
  proud: number
}

export interface GableVentBoxes {
  /** The frame and slats on the outer face, then the same set on the inner face. */
  louvres: BoxSpec[]
  backing: BoxSpec
}

// A through-vent: a gable faces along x, so the vent lies in the y–z plane, with one louvred set standing `proud` off the
// outer face (toward `sign`) and its mirror off the inner face, `wall` deeper. The gable is solid, so the dark backing that
// reads as the air between the slats can't sit inside it: it stands half the slats' depth proud of each face, so the slats
// still stand in front of it.
export function gableVentBoxes(look: GableVentLook, centre: Vec3, sign: -1 | 1, wall: number): GableVentBoxes {
  const [x0, y0, z0] = centre
  const innerHeight = look.height - look.frame * 2
  const innerWidth = look.width - look.frame * 2
  const pitch = innerHeight / look.slats
  const louvreSet = (face: number, out: -1 | 1): BoxSpec[] => {
    const x = face + out * look.proud / 2
    return [
      ...[-1, 1].map(end => ({ size: [look.proud, look.frame, look.width], position: [x, y0 + end * (look.height - look.frame) / 2, z0] }) as BoxSpec),
      ...[-1, 1].map(end => ({ size: [look.proud, innerHeight, look.frame], position: [x, y0, z0 + end * (look.width - look.frame) / 2] }) as BoxSpec),
      ...Array.from({ length: look.slats }, (_, index) => ({
        size: [look.proud, look.slat, innerWidth],
        position: [x, y0 - innerHeight / 2 + pitch * (index + 0.5), z0],
      }) as BoxSpec),
    ]
  }
  const inner = x0 - sign * wall
  return {
    louvres: [...louvreSet(x0, sign), ...louvreSet(inner, sign === 1 ? -1 : 1)],
    backing: { size: [wall + look.proud, innerHeight, innerWidth], position: [(x0 + inner) / 2, y0, z0] },
  }
}

// The home's own vent in the gable at `side`.
export function homeGableVent(side: -1 | 1): GableVentBoxes {
  return gableVentBoxes(GABLE_VENT, [side * HOUSE.halfLength, GABLE_VENT_Y, 0], side, HOUSE.wallThickness)
}
