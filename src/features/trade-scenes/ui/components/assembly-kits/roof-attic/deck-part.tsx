'use client'

import type { PartRendererProps } from '@/features/trade-scenes/types'
import type { PieceLayout } from '@/shared/components/scene/types'

import { useMemo } from 'react'
import { BoxGeometry } from 'three'

import { KIT_COLORS, KIT_SLOPE_FACES, KIT_SPACED_BOARD, LOW_SLOPE_KIT, PITCHED_KIT } from '@/features/trade-scenes/constants/roof-attic-kit'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { slopeEndFor } from '@/features/trade-scenes/lib/roof-attic-kit-points'
import { SlopeFrame } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/slope-frame'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { InstancedPieces } from '@/shared/components/scene/ui/instanced-pieces'
import { Slab } from '@/shared/components/scene/ui/slab'

const { overhang, deck, depth } = PITCHED_KIT
const DECK_END = slopeEndFor(deck)
const LOW = LOW_SLOPE_KIT
const LOW_FRONT = -LOW.halfSpan - LOW.overhang
const LOW_BACK = LOW.halfSpan - LOW.wall.thickness

// Solid plywood, aged when original; or the spaced boards a wood-shake roof was nailed to, with daylight between them.
export function DeckPart({ material, condition, form }: PartRendererProps) {
  const spaced = material === 'spaced-boards'
  const color = condition === 'worn' ? KIT_COLORS.plywoodWorn : KIT_COLORS.plywood
  const boardGeometry = useOwnedGeometry(() => new BoxGeometry(KIT_SPACED_BOARD.width, KIT_SPACED_BOARD.thickness, 1), [])
  const boards = useMemo((): PieceLayout[] => {
    const pieces: PieceLayout[] = []
    for (let x = -overhang + KIT_SPACED_BOARD.width / 2; x < DECK_END; x += KIT_SPACED_BOARD.width + KIT_SPACED_BOARD.gap) {
      pieces.push({ x, y: KIT_SPACED_BOARD.thickness / 2, z: 0, tilt: 0, width: depth, shade: 0.86 + ((pieces.length * 37) % 10) / 40 })
    }
    return pieces
  }, [])

  if (homeRoofForm(form) === 'low-slope') {
    return <Slab size={[LOW_BACK - LOW_FRONT, LOW.deck, LOW.depth]} position={[(LOW_FRONT + LOW_BACK) / 2, LOW.joistDepth + LOW.deck / 2, 0]} color={color} roughness={0.9} />
  }
  return (
    <>
      {KIT_SLOPE_FACES.map(face => (
        <SlopeFrame key={face} face={face}>
          {spaced
            ? <InstancedPieces geometry={boardGeometry} pieces={boards} color={KIT_COLORS.boards} stretchToWidth roughness={0.95} />
            : <Slab size={[DECK_END + overhang, deck, depth]} position={[(DECK_END - overhang) / 2, deck / 2, 0]} color={color} roughness={0.9} />}
        </SlopeFrame>
      ))}
    </>
  )
}
