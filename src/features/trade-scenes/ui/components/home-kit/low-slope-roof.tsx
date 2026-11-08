'use client'

import type { Ref } from 'react'
import type { Group } from 'three'
import type { PartState } from '@/features/trade-scenes/lib/part-state'
import type { BoxSpec, HouseWall, PaintLook, SystemLit } from '@/features/trade-scenes/types'

import { useMemo } from 'react'

import { FLAT_ROOF_PATCHES } from '@/features/trade-scenes/constants/home-details'
import { HOME_FADE_TAGS } from '@/features/trade-scenes/constants/home-fades'
import { FRONT_WALL, HOUSE, LOW_SLOPE, LOW_SLOPE_DECK_Y, PARAPET_TOP } from '@/features/trade-scenes/constants/home-geometry'
import { COVERING_COLORS, HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { PAINT_WEAR_SHARE } from '@/features/trade-scenes/constants/paint-wear'
import { FELT_WEAR, WEAR_AMOUNT, WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { downspoutBoxes } from '@/features/trade-scenes/lib/downspout-boxes'
import { fasciaBoardFrame, fasciaNewLengths, fasciaReplacedBoxes, fasciaRotLeft } from '@/features/trade-scenes/lib/fascia-replaced-boxes'
import { FASCIA_RUNS, fasciaRotBoxes, fasciaRotSpots } from '@/features/trade-scenes/lib/fascia-rot-spots'
import { feltMarkLists, feltMarksWithin, feltWearMarks, isAgedFelt } from '@/features/trade-scenes/lib/felt-wear-marks'
import { lowSlopeRoofBoxes } from '@/features/trade-scenes/lib/low-slope-roof-boxes'
import { peelingMarks } from '@/features/trade-scenes/lib/paint-peeling'
import { paintedSurfaceStains, roofPeeling, surfaceStainLists } from '@/features/trade-scenes/lib/painted-surface-stains'
import { wornShare, wornValue } from '@/features/trade-scenes/lib/part-state'
import { parapetCracks } from '@/features/trade-scenes/lib/roof-cracks'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { AtticSteps } from '@/features/trade-scenes/ui/components/home-kit/attic-steps'
import { CutawayRotStains } from '@/features/trade-scenes/ui/components/home-kit/cutaway-rot-stains'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { PaintStains } from '@/features/trade-scenes/ui/components/home-kit/paint-stains'
import { TintedMarks } from '@/features/trade-scenes/ui/components/home-kit/tinted-marks'
import { wallSkinLook } from '@/features/trade-scenes/ui/lib/wall-skin-look'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'

interface LowSlopeRoofProps {
  covering: PartState
  deck: PartState
  underlayment: PartState
  gutter: PartState
  paint: PaintLook
  // The new fascia boards' colour where the build replaced the rotted fascia; null where it did not.
  fasciaBoards: string | null
  // Holds the front fascia's rot and new boards, which the home hides while the closed front parapet stands in front of them.
  behindParapet: Ref<Group>
  thermal: boolean
  // The system up close; the roof steps its system parts open from the cut over the kitchen.
  lit: SystemLit | null
}

const { halfLength: L, halfDepth: D, wallThickness: T, deckThickness: DECK, cutX } = HOUSE
const MEMBRANE_Y = LOW_SLOPE_DECK_Y + DECK

const {
  deck: DECK_BOXES,
  membrane: MEMBRANE_BOXES,
  completeDeck: COMPLETE_DECK,
  completeMembrane: COMPLETE_MEMBRANE,
  parapets: PARAPETS,
  completeParapets: COMPLETE_PARAPETS,
  parapetCorners: PARAPET_CORNERS,
  frontFascia: FRONT_FASCIA,
} = lowSlopeRoofBoxes()

const COPING_WIDTH = T + LOW_SLOPE.copingOverhang
const COPING: BoxSpec[] = [
  { size: [L * 2 + LOW_SLOPE.copingOverhang, LOW_SLOPE.coping, COPING_WIDTH], position: [0, PARAPET_TOP + LOW_SLOPE.coping / 2, -D + T / 2] },
  { size: [COPING_WIDTH, LOW_SLOPE.coping, D * 2], position: [L - T / 2, PARAPET_TOP + LOW_SLOPE.coping / 2, 0] },
  { size: [COPING_WIDTH, LOW_SLOPE.coping, D], position: [-L + T / 2, PARAPET_TOP + LOW_SLOPE.coping / 2, -D / 2] },
]

const COPING_INNER = L - T / 2 - COPING_WIDTH / 2
const COMPLETE_COPING: BoxSpec[] = [
  { size: [COPING_INNER * 2, LOW_SLOPE.coping, COPING_WIDTH], position: [0, PARAPET_TOP + LOW_SLOPE.coping / 2, FRONT_WALL.line] },
  { size: [COPING_WIDTH, LOW_SLOPE.coping, D], position: [-L + T / 2, PARAPET_TOP + LOW_SLOPE.coping / 2, D / 2] },
]

// Rolled roofing goes down in strips; the laps read as faint seams across the membrane.
const SEAM_ZS = Array.from({ length: Math.floor((D * 2) / LOW_SLOPE.seamSpacing) }, (_, index) => -D + T + LOW_SLOPE.seamSpacing * (index + 0.5))
const seam = (from: number, to: number, z: number): BoxSpec => ({ size: [to - from, 0.004, 0.035], position: [(from + to) / 2, MEMBRANE_Y + LOW_SLOPE.membraneThickness + 0.002, z] })
const SEAMS: BoxSpec[] = SEAM_ZS.map(z => seam(z < 0 ? -L + T : cutX, L - T, z))
const COMPLETE_SEAMS: BoxSpec[] = SEAM_ZS.filter(z => z >= 0).map(z => seam(-L + T, cutX, z))

// Inside the membrane's bottom, so the membrane hides it until a step opens it. A working number.
const UNDERLAYMENT_THICKNESS = 0.006
const sheetUnder = (boxes: readonly BoxSpec[]): BoxSpec[] => boxes.map(({ size, position }) => ({ size: [size[0], UNDERLAYMENT_THICKNESS, size[2]], position: [position[0], MEMBRANE_Y + UNDERLAYMENT_THICKNESS / 2, position[2]] }))
const UNDERLAYMENT = sheetUnder(MEMBRANE_BOXES)
const COMPLETE_UNDERLAYMENT = sheetUnder(COMPLETE_MEMBRANE)
// The old felt's marks, placed once over the whole roof and cut to the kept underlayment past the cut: the membrane lies over
// the felt everywhere else, so that is the only top of it a step ever bares.
const FELT_MARKS = feltWearMarks({ up: [-D + T, D], along: [-L + T, L - T] }, 23)
const KEPT_FELT_MARKS = UNDERLAYMENT.flatMap(box => feltMarksWithin(FELT_MARKS, {
  up: [box.position[2] - box.size[2] / 2, box.position[2] + box.size[2] / 2],
  along: [Math.max(box.position[0] - box.size[0] / 2, cutX), box.position[0] + box.size[0] / 2],
}))
const DECK_TAG = thermalTag(null, 'deck')
const COVERING_TAG = thermalTag(null, 'covering')
const UNDERLAYMENT_TAG = thermalTag(null, 'underlayment')

const PATCHES: BoxSpec[] = FLAT_ROOF_PATCHES.map(([x, z, size]) => ({ size: [size, 0.006, size * 0.7], position: [x, MEMBRANE_Y + LOW_SLOPE.membraneThickness + 0.003, z] }))

const DRAINS = downspoutBoxes('low-slope')

const [FASCIA_RUN] = FASCIA_RUNS['low-slope']
const [{ size: FASCIA_SIZE, position: FASCIA_AT }] = FRONT_FASCIA
const FASCIA_BOARD: HouseWall = { run: 'x', line: FASCIA_AT[2], outward: 1, from: FASCIA_RUN.from, to: FASCIA_RUN.to, openings: [] }
const FASCIA_RANGE = [FASCIA_RUN.from, FASCIA_RUN.to] as const
const NEW_BOARDS_FRAME = fasciaBoardFrame(FRONT_FASCIA[0])

export function LowSlopeRoof({ covering, deck, underlayment, gutter, paint, fasciaBoards, behindParapet, thermal, lit }: LowSlopeRoofProps) {
  const crackShare = PAINT_WEAR_SHARE[paint.paintWear.cracks]
  const stainShare = PAINT_WEAR_SHARE[paint.paintWear.stains]
  const fadeShare = wornShare(paint.wear)
  const peelingShare = PAINT_WEAR_SHARE[paint.paintWear.peeling]
  // Each kind is placed on its own level, so a change to one leaves the others' placing alone.
  const cracks = useMemo(() => parapetCracks(crackShare), [crackShare])
  const stains = useMemo(() => {
    const { kept, complete } = paintedSurfaceStains('low-slope', stainShare, fadeShare).parapets
    return { kept: surfaceStainLists(kept, stainShare, fadeShare), complete: surfaceStainLists(complete, stainShare, fadeShare) }
  }, [stainShare, fadeShare])
  const peeling = useMemo(() => roofPeeling('low-slope', peelingShare).parapets, [peelingShare])
  const skin = wallSkinLook(lit, paint.color)
  const marks = useMemo(() => {
    const { crackColor } = WEAR_LOOKS.paint
    return {
      kept: [{ boxes: cracks.kept, color: crackColor }, ...peelingMarks(peeling.kept, skin.peeled)],
      complete: [{ boxes: cracks.complete, color: crackColor }, ...peelingMarks(peeling.complete, skin.peeled)],
    }
  }, [cracks, peeling, skin.peeled])
  const colours = COVERING_COLORS[covering.material ?? 'membrane'] ?? COVERING_COLORS.membrane
  const membrane = wornColor(colours.new, colours.worn, covering.wear)
  const membraneRoughness = wornValue(0.75, 0.95, covering.wear)
  const deckColour = wornColor(HOME_PALETTE.plywood, HOME_PALETTE.plywoodWorn, deck.wear)
  const gutterColour = wornColor(HOME_PALETTE.gutter, HOME_PALETTE.gutterWorn, gutter.wear)
  const patches = useMemo(() => (covering.wear >= WEAR_AMOUNT.worn ? PATCHES : []), [covering.wear])
  const aged = isAgedFelt(underlayment)
  const underlaymentColour = underlayment.material === 'synthetic' ? HOME_PALETTE.synthetic : aged ? HOME_PALETTE.feltAged : HOME_PALETTE.felt
  const feltLists = useMemo(() => {
    const plane = { top: MEMBRANE_Y + UNDERLAYMENT_THICKNESS, thickness: UNDERLAYMENT_THICKNESS, upAxis: 2, holeColour: deckColour, crackColour: FELT_WEAR.crackColor, tearColour: FELT_WEAR.tearColor } as const
    return aged ? feltMarkLists(KEPT_FELT_MARKS, plane) : []
  }, [aged, deckColour])
  // The felt's top shows only where the roof up close steps its membrane back.
  const feltBared = lit?.system === 'roof'
  const rotLevel = paint.paintWear['fascia-rot']
  const rotSpots = useMemo(() => fasciaRotSpots(rotLevel, FASCIA_RUNS['low-slope']), [rotLevel])
  const replaced = fasciaBoards !== null
  const lengths = useMemo(() => fasciaNewLengths(replaced ? rotSpots : [], FASCIA_RUNS['low-slope']), [replaced, rotSpots])
  const newBoards = useMemo(() => fasciaBoards === null ? null : fasciaReplacedBoxes(lengths, FASCIA_RANGE, fasciaBoards), [fasciaBoards, lengths])
  const fasciaRot = useMemo(() => fasciaRotBoxes(fasciaRotLeft(rotSpots, lengths), FASCIA_BOARD, FASCIA_SIZE[2] / 2, [FASCIA_AT[1] - FASCIA_SIZE[1] / 2, FASCIA_AT[1] + FASCIA_SIZE[1] / 2]), [rotSpots, lengths])

  return (
    <group>
      <AtticSteps part="deck" lit={lit} thermal={DECK_TAG} boxes={DECK_BOXES} color={deckColour} castShadow />
      {underlayment.material !== null && <AtticSteps part="underlayment" lit={lit} thermal={UNDERLAYMENT_TAG} boxes={UNDERLAYMENT} color={underlaymentColour} roughness={1} />}
      {feltBared && feltLists.map(list => list.boxes.length > 0 && <AtticSteps key={list.color} part="underlayment" lit={lit} thermal={UNDERLAYMENT_TAG} boxes={list.boxes} color={list.color} roughness={1} />)}
      <AtticSteps part="covering" lit={lit} thermal={COVERING_TAG} boxes={MEMBRANE_BOXES} color={membrane} roughness={membraneRoughness} />
      <AtticSteps part="covering" lit={lit} thermal={COVERING_TAG} boxes={SEAMS} color={membrane} roughness={1} />
      {patches.length > 0 && <AtticSteps part="covering" lit={lit} thermal={COVERING_TAG} boxes={patches} color={HOME_PALETTE.felt} radius={0.002} roughness={1} />}
      {/* The parapets are the walls carried up, so they read as the walls do. */}
      <group userData={thermalTag('exterior')}>
        {/* Square: a rounded edge on a square wall top leaves a groove all round. */}
        <group userData={skin.tag}>
          <MergedBoxes boxes={PARAPETS} color={skin.color} castShadow receiveShadow />
        </group>
        <group userData={skin.finish}>
          <TintedMarks lists={marks.kept} thermal={thermal} />
          <PaintStains lists={stains.kept} thermal={thermal} />
        </group>
        {/* The trim is painted with the walls, so the walls light it; the roof's Look inside ghosts it as before. */}
        <group userData={systemPartTag('eaves-trim')}>
          <MergedBoxes boxes={COPING} color={paint.trim} radius={0.015} roughness={0.7} />
        </group>
      </group>
      <group userData={thermalTag('exterior')}>
        <group userData={systemPartTag('eaves-trim')}>
          <MergedBoxes boxes={FRONT_FASCIA} color={paint.trim} radius={0.015} roughness={0.7} />
          {/* The fascia sits a hair behind the closed front parapet, and its marks stand proud of it. */}
          <group ref={behindParapet}>
            {fasciaRot.length > 0 && <CutawayRotStains boxes={fasciaRot} thermal={thermal} color={WEAR_LOOKS.fascia.rot} />}
            {newBoards && (
              <group {...NEW_BOARDS_FRAME}>
                <TintedMarks lists={newBoards} thermal={thermal} />
              </group>
            )}
          </group>
        </group>
      </group>
      <group userData={HOME_FADE_TAGS.complete}>
        <group userData={DECK_TAG}>
          <group userData={systemPartTag('deck')}>
            <MergedBoxes boxes={COMPLETE_DECK} color={deckColour} castShadow />
          </group>
        </group>
        {underlayment.material !== null && (
          <group userData={UNDERLAYMENT_TAG}>
            <group userData={systemPartTag('underlayment')}>
              <MergedBoxes boxes={COMPLETE_UNDERLAYMENT} color={underlaymentColour} roughness={1} />
            </group>
          </group>
        )}
        <group userData={COVERING_TAG}>
          <group userData={systemPartTag('covering')}>
            <MergedBoxes boxes={COMPLETE_MEMBRANE} color={membrane} roughness={membraneRoughness} />
            <MergedBoxes boxes={COMPLETE_SEAMS} color={membrane} roughness={1} />
          </group>
        </group>
        <group userData={thermalTag('exterior')}>
          <group userData={skin.tag}>
            <MergedBoxes boxes={COMPLETE_PARAPETS} color={skin.color} castShadow receiveShadow />
            <MergedBoxes boxes={PARAPET_CORNERS} color={skin.color} castShadow receiveShadow />
          </group>
          <group userData={skin.finish}>
            <TintedMarks lists={marks.complete} thermal={thermal} />
            <PaintStains lists={stains.complete} thermal={thermal} />
          </group>
          <group userData={systemPartTag('eaves-trim')}>
            <MergedBoxes boxes={COMPLETE_COPING} color={paint.trim} radius={0.015} roughness={0.7} />
          </group>
        </group>
      </group>
      {gutter.material !== null && (
        <group userData={thermalTag(null, 'gutter')}>
          <group userData={systemPartTag('gutter')}>
            <MergedBoxes boxes={DRAINS} color={gutterColour} radius={0.02} roughness={0.55} />
          </group>
        </group>
      )}
    </group>
  )
}
