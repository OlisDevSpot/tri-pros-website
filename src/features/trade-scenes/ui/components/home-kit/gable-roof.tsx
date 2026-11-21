'use client'

import type { CoveringLook } from '@/features/trade-scenes/lib/covering-look'
import type { PartState } from '@/features/trade-scenes/lib/part-state'
import type { DrawnGutter, PaintLook, StainBoxes, SystemLit } from '@/features/trade-scenes/types'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'

import { useMemo } from 'react'
import { ExtrudeGeometry, Shape } from 'three'

import { HOME_FADE_TAGS } from '@/features/trade-scenes/constants/home-fades'
import { COVERING_BASE, HOUSE, RAFTER_ORIGIN_Y, RIDGE_Y, ROOF_HALF_LENGTH, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { COVERING_COLORS, HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { OWN_PAINT } from '@/features/trade-scenes/constants/home-thermal-zones'
import { PAINT_WEAR_SHARE } from '@/features/trade-scenes/constants/paint-wear'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { gableDownspouts } from '@/features/trade-scenes/lib/downspout-boxes'
import { facesSummerSun } from '@/features/trade-scenes/lib/faces-summer-sun'
import { gutterFasciaStains, gutterStreaks } from '@/features/trade-scenes/lib/gutter-marks'
import { gutterHangers, gutterRuns } from '@/features/trade-scenes/lib/gutter-run'
import { gutterWater } from '@/features/trade-scenes/lib/gutter-water'
import { peelingMarks } from '@/features/trade-scenes/lib/paint-peeling'
import { paintedSurfaceStains, roofPeeling, surfaceStainLists } from '@/features/trade-scenes/lib/painted-surface-stains'
import { wornShare } from '@/features/trade-scenes/lib/part-state'
import { gableCracks } from '@/features/trade-scenes/lib/roof-cracks'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { GableVent } from '@/features/trade-scenes/ui/components/home-kit/gable-vent'
import { GableVentBackings } from '@/features/trade-scenes/ui/components/home-kit/gable-vent-backings'
import { GutterRunMesh } from '@/features/trade-scenes/ui/components/home-kit/gutter-run-mesh'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { PaintStains } from '@/features/trade-scenes/ui/components/home-kit/paint-stains'
import { RoofSheen } from '@/features/trade-scenes/ui/components/home-kit/roof-sheen'
import { RoofSlope } from '@/features/trade-scenes/ui/components/home-kit/roof-slope'
import { RoofSteps } from '@/features/trade-scenes/ui/components/home-kit/roof-steps'
import { TexturedMaterial } from '@/features/trade-scenes/ui/components/home-kit/textured-material'
import { TintedMarks } from '@/features/trade-scenes/ui/components/home-kit/tinted-marks'
import { gutterLook } from '@/features/trade-scenes/ui/lib/gutter-look'
import { wallSkinLook } from '@/features/trade-scenes/ui/lib/wall-skin-look'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { RainField } from '@/shared/components/scene/ui/rain-field'

interface GableRoofProps {
  covering: CoveringLook
  deck: PartState
  underlayment: PartState
  radiantBarrier: PartState
  ridgeVent: PartState
  gutter: DrawnGutter | null
  dripEdge: PartState
  iceAndWater: PartState
  shingleTone: string | null
  paint: PaintLook
  // A stucco home draws its body surfaces with the plaster map.
  stucco: boolean
  // The new fascia boards' colour where the build replaced the rotted fascia; null where it did not.
  fasciaBoards: string | null
  // The wear whose overflow stains the fascia, null where nothing does: the existing gutter's, which a new gutter leaves behind.
  fasciaOverflow: Wear | null
  thermal: boolean
  lit: SystemLit | null
  raining: boolean
  running: boolean
}

const { halfLength: L, halfDepth: D, wallThickness: T, pitch } = HOUSE
// Both parts of the near slope lay their covering from the same end, so its courses run on across the cut unbroken.
const NEAR_SLOPE_LAYOUT = [-ROOF_HALF_LENGTH, ROOF_HALF_LENGTH] as const
// Module-level, so the drip edge's merged geometry is built once rather than on every render.
const BACK_ENDS = ['from', 'to'] as const
const COMPLETE_ENDS = ['from'] as const
// The gable triangles carry on the stucco of the end walls below them, so they warm with them in the sun.
const LEFT_GABLE_ZONE = facesSummerSun(-1, 0) ? 'sunlit' : 'exterior'
const RIGHT_GABLE_ZONE = facesSummerSun(1, 0) ? 'sunlit' : 'exterior'
const NO_STAINS: readonly StainBoxes[] = []

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

const STREAK_COLOR = WEAR_LOOKS.gutter.streaks.color

export function GableRoof({ covering, deck, underlayment, radiantBarrier, ridgeVent, gutter, dripEdge, iceAndWater, shingleTone, paint, stucco, fasciaBoards, fasciaOverflow, thermal, lit, raining, running }: GableRoofProps) {
  const crackShare = PAINT_WEAR_SHARE[paint.paintWear.cracks]
  const stainShare = PAINT_WEAR_SHARE[paint.paintWear.stains]
  const fadeShare = wornShare(paint.wear)
  const peelingShare = PAINT_WEAR_SHARE[paint.paintWear.peeling]
  // Each kind is placed on its own level, so a change to one leaves the others' placing alone.
  const cracks = useMemo(() => gableCracks(crackShare), [crackShare])
  const stains = useMemo(() => {
    const { left, right } = paintedSurfaceStains('pitched', stainShare, fadeShare).gables
    return { left: surfaceStainLists(left, stainShare, fadeShare, paint.fade), right: surfaceStainLists(right, stainShare, fadeShare, paint.fade) }
  }, [stainShare, fadeShare, paint.fade])
  const peeling = useMemo(() => roofPeeling('pitched', peelingShare).gables, [peelingShare])
  const skin = wallSkinLook(lit, paint.color, stucco)
  const marks = useMemo(() => {
    const { crackColor } = WEAR_LOOKS.paint
    return {
      left: [{ boxes: cracks.left, color: crackColor }, ...peelingMarks([peeling.left], skin.peeled)],
      right: [{ boxes: cracks.right, color: crackColor }, ...peelingMarks([peeling.right], skin.peeled)],
    }
  }, [cracks, peeling, skin.peeled])
  const gable = useOwnedGeometry(gableGeometry, [])
  const coveringColours = COVERING_COLORS[covering.material ?? 'shingle'] ?? COVERING_COLORS.shingle
  const coveringColour = wornColor(shingleTone ?? coveringColours.new, coveringColours.worn, covering.wear)
  const vented = ridgeVent.material !== null

  const ridge = useMemo(() => [{
    size: [ROOF_HALF_LENGTH * 2, vented ? 0.09 : 0.06, vented ? 0.42 : 0.34] as const,
    position: [0, RIDGE_Y + (COVERING_BASE + 0.04) / Math.cos(pitch), 0] as const,
  }], [vented])

  const gutterWear = gutter?.wear ?? null
  const gutters = useMemo(() => {
    if (gutterWear === null) {
      return null
    }
    const runs = gutterRuns(gutterWear)
    const downspouts = gableDownspouts(gutterWear)
    // Both pieces take every streak: each colours only its own stations, so a streak across the cut darkens both sides of it.
    return {
      kept: { runs: runs.kept, boxes: [...downspouts.kept, ...gutterHangers(runs.kept)] },
      complete: { runs: runs.complete, boxes: [...downspouts.complete, ...gutterHangers(runs.complete)] },
      streaks: gutterStreaks(gutterWear),
    }
  }, [gutterWear])
  const water = useMemo(() => gutterWater(gutterWear, 'pitched'), [gutterWear])
  const gutterMaterial = useMemo(() => gutter === null ? null : gutterLook(gutter.hex, gutter.wear), [gutter])
  // Cleared to an empty list rather than unmounted, so the frame draws the same meshes either way.
  const fasciaStains = useMemo(() => fasciaOverflow === null ? NO_STAINS : gutterFasciaStains(fasciaOverflow), [fasciaOverflow])
  // Gone up close on any system, so a film over the covering never hides a part the rep is showing.
  const sheen = raining && lit === null

  return (
    <group>
      <group userData={thermalTag(LEFT_GABLE_ZONE)}>
        <group userData={skin.tag}>
          <mesh geometry={gable} position={[-L, 0, 0]} castShadow receiveShadow>
            {skin.texture ? <TexturedMaterial {...skin.texture} color={skin.color} roughness={0.9} /> : <meshStandardMaterial color={skin.color} roughness={0.9} />}
          </mesh>
        </group>
        <group userData={skin.finish}>
          <TintedMarks lists={marks.left} thermal={thermal} />
          <PaintStains lists={stains.left} thermal={thermal} />
        </group>
        <GableVent side={-1} />
      </group>
      <group userData={thermalTag(RIGHT_GABLE_ZONE)}>
        <group userData={skin.tag}>
          <mesh geometry={gable} position={[L - T, 0, 0]} castShadow receiveShadow>
            {skin.texture ? <TexturedMaterial {...skin.texture} color={skin.color} roughness={0.9} /> : <meshStandardMaterial color={skin.color} roughness={0.9} />}
          </mesh>
        </group>
        <group userData={skin.finish}>
          <TintedMarks lists={marks.right} thermal={thermal} />
          <PaintStains lists={stains.right} thermal={thermal} />
        </group>
        <GableVent side={1} />
      </group>
      <GableVentBackings />

      {/* Under the thermal camera the sheen keeps its own see-through look, as the rain's streaks do. */}
      <RoofSlope face="back" zFrom={-ROOF_HALF_LENGTH} zTo={ROOF_HALF_LENGTH} trimmedEnds={BACK_ENDS} covering={covering} deck={deck} underlayment={underlayment} radiantBarrier={radiantBarrier} dripEdge={dripEdge} shingleTone={shingleTone} paint={paint} fasciaBoards={fasciaBoards} thermal={thermal}>
        {sheen && (
          <group userData={thermalTag(OWN_PAINT)}>
            <RoofSheen zFrom={-ROOF_HALF_LENGTH} zTo={ROOF_HALF_LENGTH} covering={covering.material} running={running} />
          </group>
        )}
      </RoofSlope>
      <RoofSteps covering={covering} deck={deck} underlayment={underlayment} radiantBarrier={radiantBarrier} dripEdge={dripEdge} iceAndWater={iceAndWater} shingleTone={shingleTone} layout={NEAR_SLOPE_LAYOUT} paint={paint} fasciaBoards={fasciaBoards} thermal={thermal} lit={lit}>
        {sheen && (
          <group userData={thermalTag(OWN_PAINT)}>
            <RoofSheen zFrom={HOUSE.cutX} zTo={ROOF_HALF_LENGTH} covering={covering.material} running={running} />
          </group>
        )}
      </RoofSteps>

      <group userData={thermalTag(null, vented ? 'ridge-vent' : 'covering')}>
        <group userData={systemPartTag(vented ? 'ridge-vent' : 'covering')}>
          <MergedBoxes boxes={ridge} color={vented ? HOME_PALETTE.ridgeVent : coveringColour} radius={0.025} roughness={0.85} />
        </group>
      </group>
      {gutters !== null && gutterMaterial !== null && (
        <group userData={thermalTag(null, 'gutter')}>
          <group userData={systemPartTag('gutter')}>
            <GutterRunMesh runs={gutters.kept.runs} boxes={gutters.kept.boxes} streaks={gutters.streaks} color={gutterMaterial.color} streakColor={STREAK_COLOR} roughness={gutterMaterial.roughness} />
            <PaintStains lists={fasciaStains} thermal={thermal} />
          </group>
        </group>
      )}
      {/* Under the thermal camera the streaks keep their own see-through look: painted, they would turn into solid sticks. */}
      {raining && (
        <group userData={thermalTag(OWN_PAINT)}>
          <RainField columns={water.kept} running={running} />
        </group>
      )}

      {/* The props say z, but along the ridge the near slope runs in x. */}
      <group userData={HOME_FADE_TAGS.complete}>
        <RoofSlope face="front" zFrom={-ROOF_HALF_LENGTH} zTo={HOUSE.cutX} layout={NEAR_SLOPE_LAYOUT} trimmedEnds={COMPLETE_ENDS} covering={covering} deck={deck} underlayment={underlayment} radiantBarrier={radiantBarrier} dripEdge={dripEdge} shingleTone={shingleTone} paint={paint} fasciaBoards={fasciaBoards} thermal={thermal}>
          {sheen && (
            <group userData={thermalTag(OWN_PAINT)}>
              <RoofSheen zFrom={-ROOF_HALF_LENGTH} zTo={HOUSE.cutX} covering={covering.material} running={running} />
            </group>
          )}
        </RoofSlope>
        {gutters !== null && gutterMaterial !== null && (
          <group userData={thermalTag(null, 'gutter')}>
            <group userData={systemPartTag('gutter')}>
              <GutterRunMesh runs={gutters.complete.runs} boxes={gutters.complete.boxes} streaks={gutters.streaks} color={gutterMaterial.color} streakColor={STREAK_COLOR} roughness={gutterMaterial.roughness} />
            </group>
          </group>
        )}
        {raining && (
          <group userData={thermalTag(OWN_PAINT)}>
            <RainField columns={water.complete} running={running} />
          </group>
        )}
      </group>
    </group>
  )
}
