'use client'

import type { HouseWall, SystemLit } from '@/features/trade-scenes/types'
import type { PaintWearLevel } from '@/shared/modules/construction/core/constants/enums'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { useMemo } from 'react'

import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { fasciaBoardFrame, fasciaNewLengths, fasciaReplacedBoxes, fasciaRotLeft } from '@/features/trade-scenes/lib/fascia-replaced-boxes'
import { FASCIA_RUNS, fasciaRotBoxes, fasciaRotSpots, fasciaRotWithin } from '@/features/trade-scenes/lib/fascia-rot-spots'
import { GARAGE_BOXES } from '@/features/trade-scenes/lib/garage-boxes'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { CutawayRotStains } from '@/features/trade-scenes/ui/components/home-kit/cutaway-rot-stains'
import { GarageGableEnd } from '@/features/trade-scenes/ui/components/home-kit/garage-gable-end'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { TintedMarks } from '@/features/trade-scenes/ui/components/home-kit/tinted-marks'
import { wallSkinLook } from '@/features/trade-scenes/ui/lib/wall-skin-look'

interface GarageProps {
  form: RoofForm
  // The house's paint, worn and chalked as colour only.
  wallColor: string
  // The house's painted trim: the garage's trim and fascia.
  trimColor: string
  // The house's covering in one plain colour, worn with it.
  roofTone: string
  // The house's fascia rot, whose board ends the garage's eave shares.
  fasciaRot: PaintWearLevel
  // The new fascia boards' colour where the build replaced the rotted fascia; null where it did not.
  fasciaBoards: string | null
  thermal: boolean
  // The system up close: the body is the walls' skin, so it lights with their picks.
  lit: SystemLit | null
}

// Working colours, tuned by eye: a charcoal sectional door, its mouldings a shade darker so the panels read at a distance.
const DOOR_COLORS = { door: '#64676b', mouldings: '#46494d', fields: '#6a6d71', windows: '#1c1f23', lines: '#4a4d51' } as const

// The street-side eave's fascia, the one that rots.
const FASCIA_RUN = FASCIA_RUNS.pitched.find(run => run.face === 'garage')!
const [{ size: FASCIA_SIZE, position: FASCIA_AT }] = GARAGE_BOXES.pitched.fascia
const FASCIA_BOARD: HouseWall = { run: 'x', line: FASCIA_AT[2], outward: 1, from: FASCIA_RUN.from, to: FASCIA_RUN.to, openings: [] }
const GARAGE_RANGE = [FASCIA_RUN.from, FASCIA_RUN.to] as const
const NEW_BOARDS_FRAME = fasciaBoardFrame(GARAGE_BOXES.pitched.fascia[0])

// Drawn outside the house group, so the fades and the foundation's lift never reach it. The ghost reaches it only while the
// walls are up close: its body is painted with the house and its trim and fascia are the house's trim, so they light with
// the wall's picks while its door and roof fade. Every other system stands in the house alone, so it stays solid there.
export function Garage({ form, wallColor, trimColor, roofTone, fasciaRot, fasciaBoards, thermal, lit }: GarageProps) {
  const skin = wallSkinLook(lit, wallColor)
  const boxes = GARAGE_BOXES[form]
  const flat = form === 'low-slope'
  const rotSpots = useMemo(() => fasciaRotSpots(fasciaRot, FASCIA_RUNS[form]), [fasciaRot, form])
  const replaced = fasciaBoards !== null
  const lengths = useMemo(() => fasciaNewLengths(replaced ? rotSpots : [], FASCIA_RUNS[form]), [replaced, rotSpots, form])
  const newBoards = useMemo(() => fasciaBoards === null ? null : fasciaReplacedBoxes(fasciaRotWithin(lengths, 'garage', GARAGE_RANGE), GARAGE_RANGE, fasciaBoards), [fasciaBoards, lengths])
  const rot = useMemo(() => {
    const spots = fasciaRotWithin(fasciaRotLeft(rotSpots, lengths), 'garage', GARAGE_RANGE)
    return fasciaRotBoxes(spots, FASCIA_BOARD, FASCIA_SIZE[2] / 2, [FASCIA_AT[1] - FASCIA_SIZE[1] / 2, FASCIA_AT[1] + FASCIA_SIZE[1] / 2])
  }, [rotSpots, lengths])
  return (
    <group>
      <group userData={skin.tag}>
        <MergedBoxes boxes={boxes.body} color={skin.color} roughness={0.95} castShadow receiveShadow />
        {!flat && <GarageGableEnd color={skin.color} />}
      </group>
      <group userData={systemPartTag('eaves-trim')}>
        <MergedBoxes boxes={boxes.trim} color={trimColor} radius={0.01} roughness={0.9} castShadow receiveShadow />
        {!flat && <MergedBoxes boxes={boxes.fascia} color={trimColor} roughness={0.9} castShadow />}
        {rot.length > 0 && <CutawayRotStains boxes={rot} thermal={thermal} color={WEAR_LOOKS.fascia.rot} />}
        {newBoards && (
          <group {...NEW_BOARDS_FRAME}>
            <TintedMarks lists={newBoards} thermal={thermal} />
          </group>
        )}
      </group>
      <MergedBoxes boxes={boxes.door} color={DOOR_COLORS.door} roughness={0.6} receiveShadow />
      <MergedBoxes boxes={boxes.doorMouldings} color={DOOR_COLORS.mouldings} roughness={0.6} receiveShadow />
      <MergedBoxes boxes={boxes.doorFields} color={DOOR_COLORS.fields} roughness={0.6} receiveShadow />
      <MergedBoxes boxes={boxes.doorWindows} color={DOOR_COLORS.windows} roughness={0.25} metalness={0.2} />
      <MergedBoxes boxes={boxes.doorLines} color={DOOR_COLORS.lines} roughness={0.7} />
      {flat
        ? <MergedBoxes boxes={boxes.membrane} color={roofTone} roughness={0.9} receiveShadow />
        : <MergedBoxes boxes={boxes.slopes} color={roofTone} roughness={0.85} castShadow receiveShadow />}
    </group>
  )
}
