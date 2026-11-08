'use client'

import type { CeilingOpening, CylinderSpec, SystemLit } from '@/features/trade-scenes/types'

import { useMemo } from 'react'

import { CEILING_OPENING_LOOK } from '@/features/trade-scenes/constants/home-details'
import { CEILING_OPENINGS, HOUSE, LOW_SLOPE_DECK_Y, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { useStepPeel } from '@/features/trade-scenes/hooks/use-step-peel'
import { ceilingOpeningPart } from '@/features/trade-scenes/lib/ceiling-opening-part'
import { ceilingOpenings } from '@/features/trade-scenes/lib/ceiling-openings'
import { roofUndersideY } from '@/features/trade-scenes/lib/roof-underside'
import { stepBottom, stepStarts } from '@/features/trade-scenes/lib/step-cut-back'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { mergeCylinders } from '@/features/trade-scenes/ui/lib/merge-cylinders'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'

interface AtticOpeningsProps {
  lowSlope: boolean
  ducted: boolean
  // Whether the foam shows: sealed, with no blanket to bury it.
  collars: boolean
  // The system up close, which steps the foam open in the strip the stepped blanket leaves bare.
  lit: SystemLit | null
}

const { canHeight, collar } = CEILING_OPENING_LOOK
// A can's housing flares toward the ceiling and its foam collar flares onto it, as they do up close.
const CAN_FLARE = 1.1
const COLLAR_FLARE = 1.4
// A boot is square: four sides, turned so they run along the joists, sized by their half-width.
const SQUARE = { segments: 4, turn: Math.PI / 4, circumradius: Math.SQRT2 } as const
const NO_TAG = {}

const CANS: readonly CylinderSpec[] = CEILING_OPENINGS.filter(opening => opening.kind === 'can').map(({ at: [x, z], radius }) => ({
  radiusTop: radius,
  radiusBottom: radius * CAN_FLARE,
  height: canHeight,
  segments: 20,
  position: [x, WALL_TOP_Y + canHeight / 2, z],
}))

// Each pipe rises from the ceiling through the attic to the roof's underside, or through a flat roof's joist space to its deck.
function pipes(lowSlope: boolean): CylinderSpec[] {
  return CEILING_OPENINGS.filter(opening => opening.kind === 'pipe').map(({ at: [x, z], radius }) => {
    const top = lowSlope ? LOW_SLOPE_DECK_Y : roofUndersideY(z, 'pitched')
    return { radiusTop: radius, radiusBottom: radius, height: top - WALL_TOP_Y, segments: 14, position: [x, (WALL_TOP_Y + top) / 2, z] }
  })
}

function foamCollar({ kind, at: [x, z], radius }: CeilingOpening): CylinderSpec {
  const base = kind === 'can' ? radius * CAN_FLARE : radius
  const position = [x, WALL_TOP_Y + collar.height / 2, z] as const
  if (kind === 'boot') {
    return { radiusTop: (base + collar.reach) * SQUARE.circumradius, radiusBottom: (base + collar.reach * COLLAR_FLARE) * SQUARE.circumradius, height: collar.height, segments: SQUARE.segments, position, rotation: [0, SQUARE.turn, 0] }
  }
  return { radiusTop: base + collar.reach, radiusBottom: base + collar.reach * COLLAR_FLARE, height: collar.height, segments: 20, position }
}

// The holes through the ceiling every home has: a light's can in each room, the plumbing vents and, sealed and bare, the
// foam round every opening. Up close on the attic the cans and the vents light with the story told round them.
export function AtticOpenings({ lowSlope, ducted, collars, lit }: AtticOpeningsProps) {
  const cans = useOwnedGeometry(() => mergeCylinders(CANS), [])
  const pipeGeometry = useOwnedGeometry(() => mergeCylinders(pipes(lowSlope)), [lowSlope])
  const peel = useStepPeel(lit)
  const starts = lit === null ? null : stepStarts(lit.system, lit.shown, peel)
  const from = starts?.get('air-sealing')
  // Stepped, the foam shows from its own step to where the blanket starts again; as the bottom step it never moves, so it
  // shows back past the cut too, round every opening its story is about. Otherwise past the cut it takes the ghost, and
  // only where no blanket buries it.
  const bottom = lit !== null && stepBottom(lit.shown) === 'air-sealing'
  const to = starts?.get('attic-insulation') ?? Infinity
  const openings = ceilingOpenings(ducted)
  const lower = bottom ? -Infinity : from
  // Keyed by which openings show, so a peel step that keeps the same foam rebuilds none of it.
  const shownKey = openings.flatMap((opening, index) => (lower === undefined ? collars : opening.at[0] >= lower && opening.at[0] < to) ? [index] : []).join(',')
  const shownOpenings = useMemo(() => shownKey === '' ? [] : shownKey.split(',').map(index => openings[Number(index)]), [shownKey, openings])
  const restShown = from !== undefined && !bottom && collars
  const restOpenings = useMemo(() => restShown ? openings.filter(opening => opening.at[0] < HOUSE.cutX) : [], [restShown, openings])
  const shownCollars = useOwnedGeometry(() => mergeCylinders(shownOpenings.map(foamCollar)), [shownOpenings])
  const restCollars = useOwnedGeometry(() => mergeCylinders(restOpenings.map(foamCollar)), [restOpenings])
  const fixtures = ceilingOpeningPart(lit)

  return (
    <group>
      <group userData={fixtures === null ? NO_TAG : systemPartTag(fixtures)}>
        <mesh geometry={cans}>
          <meshStandardMaterial color={HOME_PALETTE.lightCan} roughness={0.45} metalness={0.6} />
        </mesh>
        <mesh geometry={pipeGeometry}>
          <meshStandardMaterial color={HOME_PALETTE.pipe} roughness={0.6} />
        </mesh>
      </group>
      {restOpenings.length > 0 && (
        <mesh geometry={restCollars}>
          <meshStandardMaterial color={HOME_PALETTE.foam} roughness={1} />
        </mesh>
      )}
      {shownOpenings.length > 0 && (
        <group userData={systemPartTag('air-sealing')}>
          <mesh geometry={shownCollars}>
            <meshStandardMaterial color={HOME_PALETTE.foam} roughness={1} />
          </mesh>
        </group>
      )}
    </group>
  )
}
