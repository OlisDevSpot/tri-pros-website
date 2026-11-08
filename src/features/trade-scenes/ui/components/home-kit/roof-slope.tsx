'use client'

import type { ReactNode } from 'react'
import type { PartState } from '@/features/trade-scenes/lib/part-state'
import type { BoxSpec, HouseWall, PaintLook, SystemPartId } from '@/features/trade-scenes/types'
import type { PieceLayout } from '@/shared/components/scene/types'

import { useMemo } from 'react'
import { BoxGeometry, ExtrudeGeometry, Shape } from 'three'

import { ROOF_TRIM } from '@/features/trade-scenes/constants/home-details'
import { DECK_CENTRE, DECK_END, DECK_LENGTH, EAVE_RUN, FASCIA_CENTRE, HOUSE, RADIANT_BARRIER_FACES, RAFTER_ORIGIN_Y, RAFTER_PROFILE, ROOF_HALF_LENGTH, SLOPE_LENGTH } from '@/features/trade-scenes/constants/home-geometry'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { PAINT_WEAR_SHARE, PEELING_SEEDS } from '@/features/trade-scenes/constants/paint-wear'
import { FELT_WEAR, WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { fasciaNewLengths, fasciaReplacedBoxes, fasciaRotLeft } from '@/features/trade-scenes/lib/fascia-replaced-boxes'
import { FASCIA_RUNS, fasciaRotBoxes, fasciaRotSpots, fasciaRotWithin } from '@/features/trade-scenes/lib/fascia-rot-spots'
import { feltMarkLists, feltMarksWithin, feltWearMarks, isAgedFelt } from '@/features/trade-scenes/lib/felt-wear-marks'
import { framingGrid } from '@/features/trade-scenes/lib/home-roof-layout'
import { fasciaPeeling, peelingMarks } from '@/features/trade-scenes/lib/paint-peeling'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { CutawayRotStains } from '@/features/trade-scenes/ui/components/home-kit/cutaway-rot-stains'
import { DripEdge } from '@/features/trade-scenes/ui/components/home-kit/drip-edge'
import { RoofCovering } from '@/features/trade-scenes/ui/components/home-kit/roof-covering'
import { TintedMarks } from '@/features/trade-scenes/ui/components/home-kit/tinted-marks'
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
  dripEdge: PartState
  shingleTone: string | null
  /** Trim the ends that are real roof edges; a cut edge stays raw so its parts read in section. */
  trimmedEnds: readonly ('from' | 'to')[]
  /** The fascia is painted with the walls, so it peels with their paint. */
  paint: PaintLook
  /** The new boards' colour where the build replaced the rotted fascia; null where it did not. */
  fasciaBoards: string | null
  thermal: boolean
  /** Where each stepped system part starts instead of `zFrom`, while the near slope's kept run steps open. */
  steps?: ReadonlyMap<SystemPartId, number>
  /** More of the slope's parts, drawn in its own frame. */
  children?: ReactNode
}

const NO_STEPS: ReadonlyMap<SystemPartId, number> = new Map()

const { deckThickness: DECK, rafterWidth, underlaymentThickness, pitch } = HOUSE
const { board: BOARD, fascia: FASCIA, rake: RAKE } = ROOF_TRIM
// The foil runs along the rafters' undersides from where they clear the wall plate (a working number) to where the two
// slopes' undersides meet under the ridge.
const FOIL_FROM = 0.13
const FOIL_TO = SLOPE_LENGTH - HOUSE.rafterDepth * Math.tan(pitch)
const FOIL_THICKNESS = RADIANT_BARRIER_FACES[1] - RADIANT_BARRIER_FACES[0]

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
export function RoofSlope({ face, zFrom, zTo, layout, covering, deck, underlayment, radiantBarrier, dripEdge, shingleTone, trimmedEnds, paint, fasciaBoards, thermal, steps = NO_STEPS, children }: RoofSlopeProps) {
  const run = zTo - zFrom
  const layoutFrom = layout?.[0] ?? zFrom
  const layoutTo = layout?.[1] ?? zTo
  const coveringLayout = useMemo(() => [layoutFrom, layoutTo] as const, [layoutFrom, layoutTo])
  const zMid = (zFrom + zTo) / 2
  const from = (id: SystemPartId) => steps.get(id) ?? zFrom
  const rafterFrom = from('rafters')
  const deckFrom = from('deck')
  const deckRun = zTo - deckFrom
  const deckMid = (deckFrom + zTo) / 2
  const underlaymentFrom = from('underlayment')
  const coveringFrom = from('covering')

  const rafterGeometry = useOwnedGeometry(extrudedRafter, [])
  const boardGeometry = useOwnedGeometry(() => new BoxGeometry(BOARD.width, BOARD.thickness, 1), [])

  const rafters = useMemo((): PieceLayout[] => framingGrid(-HOUSE.halfLength + rafterWidth, HOUSE.halfLength - rafterWidth, HOUSE.framingSpacing)
    // Half open, so a rafter on the line where two parts of one slope meet is drawn by one of them.
    .filter(z => z >= rafterFrom && z < zTo)
    .map(z => ({ x: 0, y: 0, z, tilt: 0, width: rafterWidth, shade: 1 })), [rafterFrom, zTo])

  const boards = useMemo((): PieceLayout[] => {
    const pieces: PieceLayout[] = []
    for (let x = -EAVE_RUN + BOARD.width / 2; x < DECK_END; x += BOARD.width + BOARD.gap) {
      pieces.push({ x, y: BOARD.thickness / 2, z: deckMid, tilt: 0, width: deckRun, shade: 0.9 + ((pieces.length * 37) % 10) / 50 })
    }
    return pieces
  }, [deckMid, deckRun])

  const spaced = deck.material === 'spaced-boards'
  const deckColour = wornColor(HOME_PALETTE.plywood, HOME_PALETTE.plywoodWorn, deck.wear)
  const aged = isAgedFelt(underlayment)
  const underlaymentColour = underlayment.material === 'synthetic' ? HOME_PALETTE.synthetic : aged ? HOME_PALETTE.feltAged : HOME_PALETTE.felt
  const holeColour = spaced ? HOME_PALETTE.boardsWorn : deckColour
  // Placed once over the whole slope, so the parts of a slope agree on every crack, and cut to the felt's top the covering
  // has stepped back off: anywhere else the covering lies over it. The cut follows the steps, so a peel redraws them.
  const feltMarks = useMemo(() => aged ? feltWearMarks({ up: [-EAVE_RUN, DECK_END], along: [-ROOF_HALF_LENGTH, ROOF_HALF_LENGTH] }, face === 'front' ? 31 : 47) : [], [aged, face])
  const feltLists = useMemo(() => feltMarkLists(
    feltMarksWithin(feltMarks, { up: [-EAVE_RUN, DECK_END], along: [underlaymentFrom, coveringFrom] }),
    { top: DECK + underlaymentThickness, thickness: underlaymentThickness, upAxis: 0, holeColour, crackColour: FELT_WEAR.crackColor, tearColour: FELT_WEAR.tearColor },
  ), [feltMarks, underlaymentFrom, coveringFrom, holeColour])
  // The foil hangs under the rafters inside the walls; the overhang is outside the attic.
  const foilFrom = Math.max(from('radiant-barrier'), -HOUSE.halfLength + HOUSE.wallThickness)
  const foilTo = Math.min(zTo, HOUSE.halfLength - HOUSE.wallThickness)
  const peelingShare = PAINT_WEAR_SHARE[paint.paintWear.peeling]
  const rotLevel = paint.paintWear['fascia-rot']
  const rotSpots = useMemo(() => fasciaRotSpots(rotLevel, FASCIA_RUNS.pitched), [rotLevel])
  const replaced = fasciaBoards !== null
  // Placed over the whole home, like the rot, so a length across the cut is drawn half in each part.
  const lengths = useMemo(() => fasciaNewLengths(replaced ? rotSpots : [], FASCIA_RUNS.pitched), [replaced, rotSpots])
  const newBoards = useMemo(() => fasciaBoards === null ? null : fasciaReplacedBoxes(fasciaRotWithin(lengths, face, [zFrom, zTo]), [zFrom, zTo], fasciaBoards), [fasciaBoards, lengths, face, zFrom, zTo])
  // Each part of a slope peels its own run, so the near slope's Complete part takes its patches with it. A new length takes
  // the old paint with the old wood, so it peels nowhere.
  const fasciaMarks = useMemo(() => {
    const peeling = fasciaPeeling([zFrom, zTo], peelingShare, PEELING_SEEDS.fascia[face])
    const newPieces = newBoards?.[1].boxes ?? []
    const old = (box: BoxSpec) => !newPieces.some(piece => Math.abs(box.position[2] - piece.position[2]) < piece.size[2] / 2)
    return peelingMarks([{ bare: peeling.bare.filter(old), lifted: peeling.lifted.filter(old) }], WEAR_LOOKS.paint.peeling.bareWood)
  }, [zFrom, zTo, peelingShare, face, newBoards])
  // The home's rot is placed once over every eave, so each part of a slope draws only the spots on its own run.
  const fasciaRot = useMemo(() => {
    const board: HouseWall = { run: 'z', line: 0, outward: -1, from: zFrom, to: zTo, openings: [] }
    const spots = fasciaRotWithin(fasciaRotLeft(rotSpots, lengths), face, [zFrom, zTo])
    return fasciaRotBoxes(spots, board, FASCIA.thickness / 2, [-FASCIA.height / 2, FASCIA.height / 2])
  }, [rotSpots, lengths, face, zFrom, zTo])

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
                  // One unit long along the ridge and stretched to its run, so a step that moves its start rebuilds nothing.
                  <mesh position={[DECK_CENTRE, DECK / 2, deckMid]} scale={[1, 1, deckRun]} castShadow>
                    <boxGeometry args={[DECK_LENGTH, DECK, 1]} />
                    <meshStandardMaterial color={deckColour} roughness={0.9} />
                  </mesh>
                )}
          </group>
        </group>

        {radiantBarrier.material !== null && foilTo > foilFrom && (
          <group userData={thermalTag('attic', 'radiant-barrier')}>
            <group userData={systemPartTag('radiant-barrier')}>
              <group position={[0, 0, (foilFrom + foilTo) / 2]} scale={[1, 1, foilTo - foilFrom]}>
                <Slab size={[FOIL_TO - FOIL_FROM, FOIL_THICKNESS, 1]} position={[(FOIL_FROM + FOIL_TO) / 2, RADIANT_BARRIER_FACES[0] + FOIL_THICKNESS / 2, 0]} color={HOME_PALETTE.foil} roughness={0.35} metalness={0.7} />
              </group>
            </group>
          </group>
        )}

        {underlayment.material !== null && (
          <group userData={thermalTag(null, 'underlayment')}>
            <group userData={systemPartTag('underlayment')}>
              <group position={[0, 0, (underlaymentFrom + zTo) / 2]} scale={[1, 1, zTo - underlaymentFrom]}>
                <Slab size={[DECK_LENGTH, underlaymentThickness, 1]} position={[DECK_CENTRE, DECK + underlaymentThickness / 2, 0]} color={underlaymentColour} roughness={1} />
              </group>
              {aged && <TintedMarks lists={feltLists} thermal={thermal} />}
            </group>
          </group>
        )}

        <group userData={thermalTag(null, 'covering')}>
          <group userData={systemPartTag('covering')}>
            <RoofCovering material={covering.material} wear={covering.wear} zFrom={coveringFrom} zTo={zTo} layout={coveringLayout} seed={face === 'front' ? 7 : 19} newTone={shingleTone} />
          </group>
        </group>

        {/* The trim is painted with the walls, so the walls light it; the roof's Look inside ghosts it as before. */}
        <group userData={systemPartTag('eaves-trim')}>
          {/* Plumb in the world, so it is turned back against the pitch. */}
          <Slab size={[FASCIA.thickness, FASCIA.height, run]} position={[FASCIA_CENTRE[0], FASCIA_CENTRE[1], zMid]} rotation={[0, 0, -pitch]} color={paint.trim} roughness={0.7} />
          <group position={[FASCIA_CENTRE[0], FASCIA_CENTRE[1], 0]} rotation={[0, 0, -pitch]}>
            <TintedMarks lists={fasciaMarks} thermal={thermal} />
            {fasciaRot.length > 0 && <CutawayRotStains boxes={fasciaRot} thermal={thermal} color={WEAR_LOOKS.fascia.rot} />}
            {newBoards && <TintedMarks lists={newBoards} thermal={thermal} />}
          </group>
          {trimmedEnds.map(end => (
            <Slab key={end} size={[DECK_LENGTH, RAKE.height, RAKE.thickness]} position={[DECK_CENTRE, DECK - RAKE.height / 2 + RAKE.proud, end === 'from' ? zFrom - RAKE.thickness / 2 : zTo + RAKE.thickness / 2]} color={paint.trim} roughness={0.7} />
          ))}
        </group>
        {/* It laps the fascia and the rakes, so every run that has them carries it, not only the run that steps open. */}
        <DripEdge zFrom={zFrom} zTo={zTo} ends={trimmedEnds} dripEdge={dripEdge} covering={covering} shingleTone={shingleTone} />
        {children}
      </group>
    </group>
  )
}
