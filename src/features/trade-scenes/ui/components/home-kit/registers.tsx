'use client'

import type { BoxSpec } from '@/features/trade-scenes/types'

import { HOUSE, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { ceilingOpenings } from '@/features/trade-scenes/lib/ceiling-openings'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'

const CEILING_UNDERSIDE = WALL_TOP_Y - HOUSE.ceilingThickness
// Working numbers, set by screenshot: the face plate a little wider than the boot it covers, and its louvres.
const GRILLE = { plate: 0.4, plateThickness: 0.008, louvres: 5, louvre: [0.32, 0.014, 0.024] } as const
const BOOTS = ceilingOpenings(true).filter(opening => opening.kind === 'boot')

const PLATES: readonly BoxSpec[] = BOOTS.map(({ at: [x, z] }) => ({
  size: [GRILLE.plate, GRILLE.plateThickness, GRILLE.plate],
  position: [x, CEILING_UNDERSIDE - GRILLE.plateThickness / 2, z],
}))
const LOUVRES: readonly BoxSpec[] = BOOTS.flatMap(({ at: [x, z] }) => Array.from({ length: GRILLE.louvres }, (_, index): BoxSpec => ({
  size: GRILLE.louvre,
  position: [x, CEILING_UNDERSIDE - GRILLE.plateThickness - GRILLE.louvre[1] / 2, z + (index - (GRILLE.louvres - 1) / 2) * GRILLE.louvre[0] / GRILLE.louvres],
})))

// The room side of each boot: the grille the air comes into the room through.
export function Registers() {
  return (
    <group userData={systemPartTag('registers')}>
      <MergedBoxes boxes={PLATES} color={HOME_PALETTE.unit} radius={0.003} roughness={0.6} />
      <MergedBoxes boxes={LOUVRES} color={HOME_PALETTE.unitGrille} roughness={0.6} />
    </group>
  )
}
