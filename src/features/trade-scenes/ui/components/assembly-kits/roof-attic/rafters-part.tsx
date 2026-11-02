'use client'

import type { PartRendererProps } from '@/features/trade-scenes/types'
import type { PieceLayout } from '@/shared/components/scene/types'

import { useMemo } from 'react'
import { BoxGeometry } from 'three'

import { KIT_COLORS, KIT_SLOPE_FACES, LOW_SLOPE_KIT, PITCHED_KIT, PITCHED_SLOPE_LENGTH } from '@/features/trade-scenes/constants/roof-attic-kit'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { centredFramingGrid } from '@/features/trade-scenes/lib/kit-framing'
import { frontSlopePoint } from '@/features/trade-scenes/lib/roof-attic-kit-points'
import { SlopeFrame } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/slope-frame'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { InstancedPieces } from '@/shared/components/scene/ui/instanced-pieces'
import { Slab } from '@/shared/components/scene/ui/slab'

const { overhang, rafterDepth, rafterWidth, depth, pitch, fascia, ridgeBoard } = PITCHED_KIT
const RAFTER_LENGTH = PITCHED_SLOPE_LENGTH + overhang
const LOW = LOW_SLOPE_KIT
// The flat roof's joists run from the open eave to the parapet wall they bear on.
const LOW_FRONT = -LOW.halfSpan - LOW.overhang
const LOW_BACK = LOW.halfSpan - LOW.wall.thickness

// The roof's structure: a gable's rafters with the fascia on their tails and a ridge board where they meet, or a flat roof's
// joists with the fascia across their ends.
export function RaftersPart({ form }: PartRendererProps) {
  const lowSlope = homeRoofForm(form) === 'low-slope'
  const rafterGeometry = useOwnedGeometry(() => new BoxGeometry(RAFTER_LENGTH, rafterDepth, 1), [])
  const joistGeometry = useOwnedGeometry(() => new BoxGeometry(LOW_BACK - LOW_FRONT, LOW.joistDepth, 1), [])

  const rafters = useMemo((): PieceLayout[] => centredFramingGrid(depth, rafterWidth, PITCHED_KIT.framingSpacing)
    .map(z => ({ x: (PITCHED_SLOPE_LENGTH - overhang) / 2, y: -rafterDepth / 2, z, tilt: 0, width: rafterWidth, shade: 1 })), [])
  const joists = useMemo((): PieceLayout[] => centredFramingGrid(LOW.depth, LOW.joistWidth, LOW.framingSpacing)
    .map(z => ({ x: (LOW_FRONT + LOW_BACK) / 2, y: LOW.joistDepth / 2, z, tilt: 0, width: LOW.joistWidth, shade: 1 })), [])

  if (lowSlope) {
    return (
      <>
        <InstancedPieces geometry={joistGeometry} pieces={joists} color={KIT_COLORS.lumber} stretchToWidth />
        <Slab size={[LOW.fascia, LOW.joistDepth + LOW.deck, LOW.depth]} position={[LOW_FRONT - LOW.fascia / 2, (LOW.joistDepth + LOW.deck) / 2, 0]} color={KIT_COLORS.trim} roughness={0.7} />
      </>
    )
  }

  const [, ridgeTop] = frontSlopePoint(PITCHED_SLOPE_LENGTH, 0)
  return (
    <>
      {KIT_SLOPE_FACES.map(face => (
        <SlopeFrame key={face} face={face}>
          <InstancedPieces geometry={rafterGeometry} pieces={rafters} color={KIT_COLORS.lumber} stretchToWidth />
          {/* Plumb in the world, so it is turned back against the pitch. */}
          <Slab
            size={[fascia.thickness, fascia.height, depth]}
            position={[-overhang - (fascia.height / 2) * Math.sin(pitch), PITCHED_KIT.deck - (fascia.height / 2) * Math.cos(pitch), 0]}
            rotation={[0, 0, -pitch]}
            color={KIT_COLORS.trim}
            roughness={0.7}
          />
        </SlopeFrame>
      ))}
      <Slab size={[ridgeBoard.thickness, ridgeBoard.height, depth]} position={[0, ridgeTop - ridgeBoard.height / 2 + 0.02, 0]} color={KIT_COLORS.lumber} />
    </>
  )
}
