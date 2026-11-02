'use client'

import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { GARAGE_BOXES } from '@/features/trade-scenes/lib/garage-boxes'
import { GarageGableEnd } from '@/features/trade-scenes/ui/components/home-kit/garage-gable-end'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'

interface GarageProps {
  form: RoofForm
  // The house's paint, worn and chalked as colour only.
  wallColor: string
  // The house's covering in one plain colour, worn with it.
  roofTone: string
}

// Working colours, tuned by eye: a charcoal sectional door, its mouldings a shade darker so the panels read at a distance.
const DOOR_COLORS = { door: '#64676b', mouldings: '#46494d', fields: '#6a6d71', windows: '#1c1f23', lines: '#4a4d51' } as const

// Drawn outside the house group, so the ghost, the fades and the foundation's lift never reach it.
export function Garage({ form, wallColor, roofTone }: GarageProps) {
  const boxes = GARAGE_BOXES[form]
  const flat = form === 'low-slope'
  return (
    <group>
      <MergedBoxes boxes={boxes.body} color={wallColor} roughness={0.95} castShadow receiveShadow />
      <MergedBoxes boxes={boxes.trim} color={HOME_PALETTE.trim} radius={0.01} roughness={0.9} castShadow receiveShadow />
      <MergedBoxes boxes={boxes.door} color={DOOR_COLORS.door} roughness={0.6} receiveShadow />
      <MergedBoxes boxes={boxes.doorMouldings} color={DOOR_COLORS.mouldings} roughness={0.6} receiveShadow />
      <MergedBoxes boxes={boxes.doorFields} color={DOOR_COLORS.fields} roughness={0.6} receiveShadow />
      <MergedBoxes boxes={boxes.doorWindows} color={DOOR_COLORS.windows} roughness={0.25} metalness={0.2} />
      <MergedBoxes boxes={boxes.doorLines} color={DOOR_COLORS.lines} roughness={0.7} />
      {flat
        ? <MergedBoxes boxes={boxes.membrane} color={roofTone} roughness={0.9} receiveShadow />
        : (
            <>
              <MergedBoxes boxes={boxes.slopes} color={roofTone} roughness={0.85} castShadow receiveShadow />
              <MergedBoxes boxes={boxes.fascia} color={HOME_PALETTE.trim} roughness={0.9} castShadow />
              <GarageGableEnd color={wallColor} />
            </>
          )}
    </group>
  )
}
