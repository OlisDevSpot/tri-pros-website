'use client'

import type { PartState } from '@/features/trade-scenes/lib/part-state'
import type { PaintLook } from '@/features/trade-scenes/types'
import type { PieceLayout } from '@/shared/components/scene/types'

import { useMemo } from 'react'
import { BoxGeometry, ExtrudeGeometry, Shape } from 'three'

import { ROOF_TRIM } from '@/features/trade-scenes/constants/home-details'
import { EAVE_RUN, FASCIA_CENTRE, HOUSE, RAFTER_ORIGIN_Y, RAFTER_PROFILE, SLOPE_LENGTH } from '@/features/trade-scenes/constants/home-geometry'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { PAINT_WEAR_SHARE, PEELING_SEEDS } from '@/features/trade-scenes/constants/paint-wear'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { framingGrid } from '@/features/trade-scenes/lib/home-roof-layout'
import { fasciaPeeling, peelingMarks } from '@/features/trade-scenes/lib/paint-peeling'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { PaintMarks } from '@/features/trade-scenes/ui/components/home-kit/paint-marks'
import { RoofCovering } from '@/features/trade-scenes/ui/components/home-kit/roof-covering'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { InstancedPieces } from '@/shared/components/scene/ui/instanced-pieces'
import { Slab } from '@/shared/components/scene/ui/slab'

interface RoofSlopeProps {
  face: 'front' | 'back'
  /** The run of the slope along the ridge, in the slope's own z. */
  zFrom: number
  zTo: number
  /** The run the covering is laid out over; another part of the same slope past either end lays the same courses. */
  layout?: readonly [number, number]
  covering: PartState
  deck: PartState
  underlayment: PartState
  radiantBarrier: PartState
  shingleTone: string | null
  /** Trim the ends that are real roof edges; a cut edge stays raw so its parts read in section. */
  trimmedEnds: readonly ('from' | 'to')[]
  /** The fascia is painted with the walls, so it peels with their paint. */
  paint: PaintLook
  thermal: boolean
}

const { deckThickness: DECK, rafterWidth, underlaymentThickness, pitch } = HOUSE
const DECK_END = SLOPE_LENGTH + DECK * Math.tan(pitch)
const DECK_LENGTH = DECK_END + EAVE_RUN
const DECK_CENTRE = (DECK_END - EAVE_RUN) / 2
const { board: BOARD, fascia: FASCIA, rake: RAKE } = ROOF_TRIM

// One unit deep about z = 0, so each rafter stretches to its width the way a box would.
function extrudedRafter(): ExtrudeGeometry {
  const [first, ...rest] = RAFTER_PROFILE
  const shape = new Shape()
  shape.moveTo(first[0], first[1])
  for (const [x, y] of rest) {
    shape.lineTo(x, y)
  }
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false })
  geometry.translate(0, 0, -0.5)
  return geometry
}

// One side of the gable in the slope's own frame: x runs eave to ridge, y is the roof normal, z runs along the ridge.
// The front slope's z points along +x in the world and the back slope's along −x, so both share one drawing.
export function RoofSlope({ face, zFrom, zTo, layout, covering, deck, underlayment, radiantBarrier, shingleTone, trimmedEnds, paint, thermal }: RoofSlopeProps) {
  const run = zTo - zFrom
  const layoutFrom = layout?.[0] ?? zFrom
  const layoutTo = layout?.[1] ?? zTo
  const coveringLayout = useMemo(() => [layoutFrom, layoutTo] as const, [layoutFrom, layoutTo])
  const zMid = (zFrom + zTo) / 2

  const rafterGeometry = useOwnedGeometry(extrudedRafter, [])
  const boardGeometry = useOwnedGeometry(() => new BoxGeometry(BOARD.width, BOARD.thickness, 1), [])

  const rafters = useMemo((): PieceLayout[] => framingGrid(-HOUSE.halfLength + rafterWidth, HOUSE.halfLength - rafterWidth, HOUSE.framingSpacing)
    // Half open, so a rafter on the line where two parts of one slope meet is drawn by one of them.
    .filter(z => z >= zFrom && z < zTo)
    .map(z => ({ x: 0, y: 0, z, tilt: 0, width: rafterWidth, shade: 1 })), [zFrom, zTo])

  const boards = useMemo((): PieceLayout[] => {
    const pieces: PieceLayout[] = []
    for (let x = -EAVE_RUN + BOARD.width / 2; x < DECK_END; x += BOARD.width + BOARD.gap) {
      pieces.push({ x, y: BOARD.thickness / 2, z: zMid, tilt: 0, width: run, shade: 0.9 + ((pieces.length * 37) % 10) / 50 })
    }
    return pieces
  }, [zMid, run])

  const spaced = deck.material === 'spaced-boards'
  const deckColour = wornColor(HOME_PALETTE.plywood, HOME_PALETTE.plywoodWorn, deck.wear)
  const underlaymentColour = underlayment.material === 'synthetic' ? HOME_PALETTE.synthetic : HOME_PALETTE.felt
  // The foil hangs between the rafters inside the walls; the overhang is outside the attic.
  const foilFrom = Math.max(zFrom, -HOUSE.halfLength + HOUSE.wallThickness)
  const foilTo = Math.min(zTo, HOUSE.halfLength - HOUSE.wallThickness)
  const peelingShare = PAINT_WEAR_SHARE[paint.paintWear.peeling]
  // Each part of a slope peels its own run, so the near slope's Complete part takes its patches with it.
  const fasciaMarks = useMemo(() => peelingMarks([fasciaPeeling([zFrom, zTo], peelingShare, PEELING_SEEDS.fascia[face])], WEAR_LOOKS.paint.peeling.bareWood), [zFrom, zTo, peelingShare, face])

  return (
    <group position={[0, RAFTER_ORIGIN_Y, face === 'front' ? HOUSE.halfDepth : -HOUSE.halfDepth]} rotation={[0, face === 'front' ? Math.PI / 2 : -Math.PI / 2, 0]}>
      <group rotation={[0, 0, pitch]}>
        {/* The rafters and the foil hang in the attic air; everything from the deck up is the roof the sun beats on. */}
        <group userData={thermalTag('attic', 'rafters')}>
          <group userData={systemPartTag('rafters')}>
            <InstancedPieces geometry={rafterGeometry} pieces={rafters} color={HOME_PALETTE.lumber} stretchToWidth />
          </group>
        </group>

        <group userData={thermalTag(null, 'deck')}>
          <group userData={systemPartTag('deck')}>
            {spaced
              ? <InstancedPieces geometry={boardGeometry} pieces={boards} color={HOME_PALETTE.boardsWorn} stretchToWidth />
              : (
                  <mesh position={[DECK_CENTRE, DECK / 2, zMid]} castShadow>
                    <boxGeometry args={[DECK_LENGTH, DECK, run]} />
                    <meshStandardMaterial color={deckColour} roughness={0.9} />
                  </mesh>
                )}
          </group>
        </group>

        {radiantBarrier.material !== null && foilTo > foilFrom && (
          <group userData={thermalTag('attic', 'radiant-barrier')}>
            <group userData={systemPartTag('radiant-barrier')}>
              <Slab size={[SLOPE_LENGTH, 0.004, foilTo - foilFrom]} position={[SLOPE_LENGTH / 2, -0.004, (foilFrom + foilTo) / 2]} color={HOME_PALETTE.foil} roughness={0.35} metalness={0.7} />
            </group>
          </group>
        )}

        {underlayment.material !== null && (
          <group userData={thermalTag(null, 'underlayment')}>
            <group userData={systemPartTag('underlayment')}>
              <Slab size={[DECK_LENGTH, underlaymentThickness, run]} position={[DECK_CENTRE, DECK + underlaymentThickness / 2, zMid]} color={underlaymentColour} roughness={1} />
            </group>
          </group>
        )}

        <group userData={thermalTag(null, 'covering')}>
          <group userData={systemPartTag('covering')}>
            <RoofCovering material={covering.material} wear={covering.wear} zFrom={zFrom} zTo={zTo} layout={coveringLayout} seed={face === 'front' ? 7 : 19} newTone={shingleTone} />
          </group>
        </group>

        {/* Plumb in the world, so it is turned back against the pitch. */}
        <Slab size={[FASCIA.thickness, FASCIA.height, run]} position={[FASCIA_CENTRE[0], FASCIA_CENTRE[1], zMid]} rotation={[0, 0, -pitch]} color={HOME_PALETTE.trim} roughness={0.7} />
        <group position={[FASCIA_CENTRE[0], FASCIA_CENTRE[1], 0]} rotation={[0, 0, -pitch]}>
          <PaintMarks lists={fasciaMarks} thermal={thermal} />
        </group>
        {trimmedEnds.map(end => (
          <Slab key={end} size={[DECK_LENGTH, RAKE.height, RAKE.thickness]} position={[DECK_CENTRE, DECK - RAKE.height / 2 + 0.03, end === 'from' ? zFrom - RAKE.thickness / 2 : zTo + RAKE.thickness / 2]} color={HOME_PALETTE.trim} roughness={0.7} />
        ))}
      </group>
    </group>
  )
}
