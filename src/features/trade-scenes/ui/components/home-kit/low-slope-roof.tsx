'use client'

import type { PartState } from '@/features/trade-scenes/lib/part-state'
import type { BoxSpec, PaintLook } from '@/features/trade-scenes/types'

import { useMemo } from 'react'

import { FLAT_ROOF_PATCHES } from '@/features/trade-scenes/constants/home-details'
import { HOME_FADE_TAGS } from '@/features/trade-scenes/constants/home-fades'
import { FRONT_WALL, HOUSE, LOW_SLOPE, LOW_SLOPE_DECK_Y, PARAPET_TOP } from '@/features/trade-scenes/constants/home-geometry'
import { COVERING_COLORS, HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { PAINT_WEAR_SHARE } from '@/features/trade-scenes/constants/paint-wear'
import { WEAR_AMOUNT, WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { downspoutBoxes } from '@/features/trade-scenes/lib/downspout-boxes'
import { lowSlopeRoofBoxes } from '@/features/trade-scenes/lib/low-slope-roof-boxes'
import { peelingMarks } from '@/features/trade-scenes/lib/paint-peeling'
import { paintedSurfaceStains, roofPeeling, surfaceStainLists } from '@/features/trade-scenes/lib/painted-surface-stains'
import { wornShare, wornValue } from '@/features/trade-scenes/lib/part-state'
import { parapetCracks } from '@/features/trade-scenes/lib/roof-cracks'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { PaintMarks } from '@/features/trade-scenes/ui/components/home-kit/paint-marks'
import { PaintStains } from '@/features/trade-scenes/ui/components/home-kit/paint-stains'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'

interface LowSlopeRoofProps {
  covering: PartState
  deck: PartState
  gutter: PartState
  paint: PaintLook
  thermal: boolean
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

const PATCHES: BoxSpec[] = FLAT_ROOF_PATCHES.map(([x, z, size]) => ({ size: [size, 0.006, size * 0.7], position: [x, MEMBRANE_Y + LOW_SLOPE.membraneThickness + 0.003, z] }))

const DRAINS = downspoutBoxes('low-slope')

export function LowSlopeRoof({ covering, deck, gutter, paint, thermal }: LowSlopeRoofProps) {
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
  const marks = useMemo(() => {
    const { crackColor, peeling: look } = WEAR_LOOKS.paint
    return {
      kept: [{ boxes: cracks.kept, color: crackColor }, ...peelingMarks(peeling.kept, look.bareStucco)],
      complete: [{ boxes: cracks.complete, color: crackColor }, ...peelingMarks(peeling.complete, look.bareStucco)],
    }
  }, [cracks, peeling])
  const colours = COVERING_COLORS[covering.material ?? 'membrane'] ?? COVERING_COLORS.membrane
  const membrane = wornColor(colours.new, colours.worn, covering.wear)
  const membraneRoughness = wornValue(0.75, 0.95, covering.wear)
  const deckColour = wornColor(HOME_PALETTE.plywood, HOME_PALETTE.plywoodWorn, deck.wear)
  const gutterColour = wornColor(HOME_PALETTE.gutter, HOME_PALETTE.gutterWorn, gutter.wear)
  const patches = useMemo(() => (covering.wear >= WEAR_AMOUNT.worn ? PATCHES : []), [covering.wear])

  return (
    <group>
      <group userData={thermalTag(null, 'deck')}>
        <group userData={systemPartTag('deck')}>
          <MergedBoxes boxes={DECK_BOXES} color={deckColour} castShadow />
        </group>
      </group>
      <group userData={thermalTag(null, 'covering')}>
        <group userData={systemPartTag('covering')}>
          <MergedBoxes boxes={MEMBRANE_BOXES} color={membrane} roughness={membraneRoughness} />
          <MergedBoxes boxes={SEAMS} color={membrane} roughness={1} />
          {patches.length > 0 && <MergedBoxes boxes={patches} color={HOME_PALETTE.felt} radius={0.002} roughness={1} />}
        </group>
      </group>
      {/* The parapets are the walls carried up, so they read as the walls do. */}
      <group userData={thermalTag('exterior')}>
        {/* Square: a rounded edge on a square wall top leaves a groove all round. */}
        <MergedBoxes boxes={PARAPETS} color={paint.color} castShadow receiveShadow />
        <PaintMarks lists={marks.kept} thermal={thermal} />
        <PaintStains lists={stains.kept} thermal={thermal} />
        <MergedBoxes boxes={COPING} color={HOME_PALETTE.trim} radius={0.015} roughness={0.7} />
      </group>
      <group userData={thermalTag('exterior')}>
        <MergedBoxes boxes={FRONT_FASCIA} color={HOME_PALETTE.trim} radius={0.015} roughness={0.7} />
      </group>
      <group userData={HOME_FADE_TAGS.complete}>
        <group userData={thermalTag(null, 'deck')}>
          <group userData={systemPartTag('deck')}>
            <MergedBoxes boxes={COMPLETE_DECK} color={deckColour} castShadow />
          </group>
        </group>
        <group userData={thermalTag(null, 'covering')}>
          <group userData={systemPartTag('covering')}>
            <MergedBoxes boxes={COMPLETE_MEMBRANE} color={membrane} roughness={membraneRoughness} />
            <MergedBoxes boxes={COMPLETE_SEAMS} color={membrane} roughness={1} />
          </group>
        </group>
        <group userData={thermalTag('exterior')}>
          <MergedBoxes boxes={COMPLETE_PARAPETS} color={paint.color} castShadow receiveShadow />
          <MergedBoxes boxes={PARAPET_CORNERS} color={paint.color} castShadow receiveShadow />
          <PaintMarks lists={marks.complete} thermal={thermal} />
          <PaintStains lists={stains.complete} thermal={thermal} />
          <MergedBoxes boxes={COMPLETE_COPING} color={HOME_PALETTE.trim} radius={0.015} roughness={0.7} />
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
