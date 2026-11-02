'use client'

import type { PartState } from '@/features/trade-scenes/lib/part-state'
import type { PaintLook } from '@/features/trade-scenes/types'

import { useMemo } from 'react'
import { ExtrudeGeometry, Shape } from 'three'

import { ROOF_TRIM } from '@/features/trade-scenes/constants/home-details'
import { HOME_FADE_TAGS } from '@/features/trade-scenes/constants/home-fades'
import { COVERING_BASE, GUTTER_BACK, GUTTER_Y, HOUSE, RAFTER_ORIGIN_Y, RIDGE_Y, ROOF_HALF_LENGTH, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { COVERING_COLORS, HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { PAINT_WEAR_SHARE } from '@/features/trade-scenes/constants/paint-wear'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { downspoutBoxes } from '@/features/trade-scenes/lib/downspout-boxes'
import { facesSummerSun } from '@/features/trade-scenes/lib/faces-summer-sun'
import { gableCracks } from '@/features/trade-scenes/lib/roof-cracks'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { GableVent } from '@/features/trade-scenes/ui/components/home-kit/gable-vent'
import { GableVentBackings } from '@/features/trade-scenes/ui/components/home-kit/gable-vent-backings'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { PaintMarks } from '@/features/trade-scenes/ui/components/home-kit/paint-marks'
import { RoofSlope } from '@/features/trade-scenes/ui/components/home-kit/roof-slope'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'

interface GableRoofProps {
  covering: PartState
  deck: PartState
  underlayment: PartState
  radiantBarrier: PartState
  ridgeVent: PartState
  gutter: PartState
  shingleTone: string | null
  paint: PaintLook
  thermal: boolean
}

const { halfLength: L, halfDepth: D, wallThickness: T, pitch } = HOUSE
const GUTTER = { size: ROOF_TRIM.gutter.size, out: D + GUTTER_BACK + ROOF_TRIM.gutter.size / 2, y: GUTTER_Y }
const DOWNSPOUT_BOXES = downspoutBoxes('pitched')
// Both parts of the near slope lay their covering from the same end, so its courses run on across the cut unbroken.
const NEAR_SLOPE_LAYOUT = [-ROOF_HALF_LENGTH, ROOF_HALF_LENGTH] as const
// The gable triangles carry on the stucco of the end walls below them, so they warm with them in the sun.
const LEFT_GABLE_ZONE = facesSummerSun(-1, 0) ? 'sunlit' : 'exterior'
const RIGHT_GABLE_ZONE = facesSummerSun(1, 0) ? 'sunlit' : 'exterior'

// The triangle of stucco under each rake, from the wall top up to the underside of the deck.
function gableGeometry(): ExtrudeGeometry {
  const shape = new Shape()
  shape.moveTo(-D, WALL_TOP_Y)
  shape.lineTo(D, WALL_TOP_Y)
  shape.lineTo(D, RAFTER_ORIGIN_Y)
  shape.lineTo(0, RIDGE_Y)
  shape.lineTo(-D, RAFTER_ORIGIN_Y)
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, { depth: T, bevelEnabled: false })
  geometry.rotateY(Math.PI / 2)
  return geometry
}

export function GableRoof({ covering, deck, underlayment, radiantBarrier, ridgeVent, gutter, shingleTone, paint, thermal }: GableRoofProps) {
  const crackShare = PAINT_WEAR_SHARE[paint.paintWear.cracks]
  const marks = useMemo(() => {
    const { left, right } = gableCracks(crackShare)
    return { left: [{ boxes: left, color: WEAR_LOOKS.paint.crackColor }], right: [{ boxes: right, color: WEAR_LOOKS.paint.crackColor }] }
  }, [crackShare])
  const gable = useOwnedGeometry(gableGeometry, [])
  const coveringColours = COVERING_COLORS[covering.material ?? 'shingle'] ?? COVERING_COLORS.shingle
  const coveringColour = wornColor(shingleTone ?? coveringColours.new, coveringColours.worn, covering.wear)
  const vented = ridgeVent.material !== null

  const ridge = useMemo(() => [{
    size: [ROOF_HALF_LENGTH * 2, vented ? 0.09 : 0.06, vented ? 0.42 : 0.34] as const,
    position: [0, RIDGE_Y + (COVERING_BASE + 0.04) / Math.cos(pitch), 0] as const,
  }], [vented])

  // The back gutter runs the whole eave; the front one only where the near slope is kept.
  const gutters = useMemo(() => gutter.material === null
    ? []
    : [
        { size: [ROOF_HALF_LENGTH * 2, GUTTER.size, GUTTER.size] as const, position: [0, GUTTER.y, -GUTTER.out] as const },
        { size: [ROOF_HALF_LENGTH - HOUSE.cutX, GUTTER.size, GUTTER.size] as const, position: [(ROOF_HALF_LENGTH + HOUSE.cutX) / 2, GUTTER.y, GUTTER.out] as const },
        ...DOWNSPOUT_BOXES,
      ], [gutter.material])
  const completeGutter = useMemo(() => gutter.material === null
    ? []
    : [{ size: [ROOF_HALF_LENGTH + HOUSE.cutX, GUTTER.size, GUTTER.size] as const, position: [(HOUSE.cutX - ROOF_HALF_LENGTH) / 2, GUTTER.y, GUTTER.out] as const }], [gutter.material])
  const gutterColour = wornColor(HOME_PALETTE.gutter, HOME_PALETTE.gutterWorn, gutter.wear)

  return (
    <group>
      <group userData={thermalTag(LEFT_GABLE_ZONE)}>
        <mesh geometry={gable} position={[-L, 0, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={paint.color} roughness={0.9} />
        </mesh>
        <PaintMarks lists={marks.left} thermal={thermal} />
        <GableVent side={-1} />
      </group>
      <group userData={thermalTag(RIGHT_GABLE_ZONE)}>
        <mesh geometry={gable} position={[L - T, 0, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={paint.color} roughness={0.9} />
        </mesh>
        <PaintMarks lists={marks.right} thermal={thermal} />
        <GableVent side={1} />
      </group>
      <GableVentBackings />

      <RoofSlope face="back" zFrom={-ROOF_HALF_LENGTH} zTo={ROOF_HALF_LENGTH} trimmedEnds={['from', 'to']} covering={covering} deck={deck} underlayment={underlayment} radiantBarrier={radiantBarrier} shingleTone={shingleTone} paint={paint} thermal={thermal} />
      <RoofSlope face="front" zFrom={HOUSE.cutX} zTo={ROOF_HALF_LENGTH} layout={NEAR_SLOPE_LAYOUT} trimmedEnds={['to']} covering={covering} deck={deck} underlayment={underlayment} radiantBarrier={radiantBarrier} shingleTone={shingleTone} paint={paint} thermal={thermal} />

      <group userData={thermalTag(null, vented ? 'ridge-vent' : 'covering')}>
        <MergedBoxes boxes={ridge} color={vented ? HOME_PALETTE.ridgeVent : coveringColour} radius={0.025} roughness={0.85} />
      </group>
      {gutters.length > 0 && (
        <group userData={thermalTag(null, 'gutter')}>
          <MergedBoxes boxes={gutters} color={gutterColour} radius={0.03} roughness={0.55} castShadow />
        </group>
      )}

      {/* The props say z, but along the ridge the near slope runs in x. */}
      <group userData={HOME_FADE_TAGS.complete}>
        <RoofSlope face="front" zFrom={-ROOF_HALF_LENGTH} zTo={HOUSE.cutX} layout={NEAR_SLOPE_LAYOUT} trimmedEnds={['from']} covering={covering} deck={deck} underlayment={underlayment} radiantBarrier={radiantBarrier} shingleTone={shingleTone} paint={paint} thermal={thermal} />
        {completeGutter.length > 0 && (
          <group userData={thermalTag(null, 'gutter')}>
            <MergedBoxes boxes={completeGutter} color={gutterColour} radius={0.03} roughness={0.55} castShadow />
          </group>
        )}
      </group>
    </group>
  )
}
