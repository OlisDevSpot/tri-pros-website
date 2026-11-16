'use client'

import type { HomeThermalZone } from '@/features/trade-scenes/constants/home-thermal-zones'
import type { HvacRunningPart } from '@/features/trade-scenes/lib/hvac-running'
import type { IndoorUnitSection } from '@/features/trade-scenes/lib/indoor-unit-boxes'
import type { IndoorUnitPlacement, IndoorUnitSectionId } from '@/features/trade-scenes/lib/indoor-unit-placement'
import type { BoxSpec, TradeSceneInputs, Vec3 } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { useMemo } from 'react'
import { BufferGeometry, CatmullRomCurve3, TubeGeometry, Vector3 } from 'three'

import { EQUIPMENT_STRAIN } from '@/features/trade-scenes/constants/home-life'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { INDOOR_UNIT_LOOK, SUPPLY_JUNCTION } from '@/features/trade-scenes/constants/indoor-unit-placements'
import { useHeatGlow } from '@/features/trade-scenes/hooks/use-heat-glow'
import { homeFloorY } from '@/features/trade-scenes/lib/home-floor-y'
import { indoorAirZone, runningZone } from '@/features/trade-scenes/lib/hvac-running'
import { indoorUnitBoxes, indoorUnitLineSet, indoorUnitReturnDuct, indoorUnitTrunk } from '@/features/trade-scenes/lib/indoor-unit-boxes'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'

interface IndoorUnitProps {
  placement: IndoorUnitPlacement
  furnace: boolean
  coil: boolean
  // Whether the line set to the condenser is there; a furnace alone has none.
  lineSet: boolean
  heatLoad: number
  // Sets the box a closet's trunk feeds the runs from.
  form: RoofForm
  running: ReadonlySet<HvacRunningPart>
  side: 'heating' | 'cooling' | null
  // The air the unit stands in: the attic's, or the room's for a closet.
  still: HomeThermalZone
}

// Spelled out, so each section's tag names its part where it is written.
const SECTION_TAGS = {
  blower: systemPartTag('blower'),
  furnace: systemPartTag('furnace'),
  coil: systemPartTag('coil'),
  plenum: systemPartTag('plenum'),
} as const satisfies Record<IndoorUnitSectionId, unknown>
const LINE_SET_TAG = systemPartTag('refrigerant-lines')
const TRUNK_TAG = systemPartTag('duct-runs')
const RETURN_TAG = systemPartTag('return')

function selectFoundation(state: TradeSceneInputs) {
  return state.property.foundationType
}

// Metres of tube per segment, so a long run keeps its bends.
const TUBE_STEP = 0.05

function shrunk([x, y, z]: Vec3, [byX, byY, byZ]: Vec3): Vec3 {
  return [x - byX, y - byY, z - byZ]
}

// Each section is drawn short of the next by the seam, over a darker core a little narrower than the line, so the line reads
// as cabinets joined end to end.
function seamed({ toward }: IndoorUnitPlacement, { box }: IndoorUnitSection): BoxSpec[] {
  const { seam } = INDOOR_UNIT_LOOK
  return [{ size: shrunk(box.size, [Math.abs(toward[0]) * seam, Math.abs(toward[1]) * seam, Math.abs(toward[2]) * seam]), position: box.position }]
}

function core({ toward }: IndoorUnitPlacement, sections: readonly IndoorUnitSection[]): BoxSpec[] {
  const inset = INDOOR_UNIT_LOOK.seam * 2
  const across: Vec3 = [toward[0] === 0 ? inset : 0, toward[1] === 0 ? inset : 0, toward[2] === 0 ? inset : 0]
  return sections.map(({ box }) => ({ size: shrunk(box.size, across), position: box.position }))
}

// A trunk bends smoothly; the line set runs straight between its points, as a tube pulled taut does. Nothing to draw is an
// empty geometry, so the hook that owns it runs either way.
function tube(points: readonly Vec3[] | null, radius: number, taut: boolean): BufferGeometry {
  if (points === null) {
    return new BufferGeometry()
  }
  const vectors = points.map(point => new Vector3(...point))
  const curve = taut ? new CatmullRomCurve3(vectors, false, 'catmullrom', 0) : new CatmullRomCurve3(vectors)
  return new TubeGeometry(curve, Math.max(24, Math.ceil(curve.getLength() / TUBE_STEP)), radius, 8, false)
}

// The blower, the furnace, the coil and the plenum in the order the air passes through them, each its own part. The furnace
// carries the heat glow on a winter night. Each section reads as the air it carries only while its season runs it.
export function IndoorUnit({ placement, furnace, coil, lineSet, heatLoad, form, running, side, still }: IndoorUnitProps) {
  const glow = useHeatGlow(heatLoad)
  const sections = useMemo(() => indoorUnitBoxes(placement, { furnace, coil }), [placement, furnace, coil])
  const drawn = useMemo(() => sections.map(section => ({ id: section.id, boxes: seamed(placement, section) })), [placement, sections])
  const coreBoxes = useMemo(() => core(placement, sections), [placement, sections])
  const trunk = useMemo(() => indoorUnitTrunk(placement, sections), [placement, sections])
  const junction = useMemo((): BoxSpec[] => {
    const end = trunk?.at(-1)
    return end === undefined ? [] : [{ size: SUPPLY_JUNCTION[form], position: end }]
  }, [trunk, form])
  const floorY = homeFloorY(useSceneInputs(selectFoundation))
  const lines = useMemo(() => (lineSet ? indoorUnitLineSet(placement, sections, floorY) : null), [lineSet, placement, sections, floorY])
  const trunkGeometry = useOwnedGeometry(() => tube(trunk, INDOOR_UNIT_LOOK.trunkRadius, false), [trunk])
  const lineGeometry = useOwnedGeometry(() => tube(lines, INDOOR_UNIT_LOOK.lineRadius, true), [lines])
  const returnDuct = useMemo(() => indoorUnitReturnDuct(placement, sections), [placement, sections])
  const returnGeometry = useOwnedGeometry(() => tube(returnDuct.length > 0 ? returnDuct : null, INDOOR_UNIT_LOOK.returnRadius, false), [returnDuct])

  // The trunk carries whatever air the blower moves; the line set runs with the condenser.
  const airZone = thermalTag(runningZone(running.has('blower'), side, still))
  const returnZone = thermalTag(indoorAirZone('return', running, side, still))

  return (
    <group>
      <group userData={airZone}>
        <MergedBoxes boxes={coreBoxes} color={HOME_PALETTE.unitGrille} roughness={0.8} />
      </group>
      {drawn.map(({ id, boxes }) => (
        <group key={id} userData={thermalTag(indoorAirZone(id, running, side, still))}>
          <group userData={SECTION_TAGS[id]}>
            {id === 'furnace'
              ? <MergedBoxes boxes={boxes} color={HOME_PALETTE.unit} radius={0.02} roughness={0.7} emissive={EQUIPMENT_STRAIN.heat.color} materialRef={glow} />
              : <MergedBoxes boxes={boxes} color={HOME_PALETTE.unit} radius={0.02} roughness={0.7} />}
          </group>
        </group>
      ))}
      {returnDuct.length > 0 && (
        <group userData={returnZone}>
          <group userData={RETURN_TAG}>
            <mesh geometry={returnGeometry}>
              <meshStandardMaterial color={HOME_PALETTE.duct} roughness={0.8} />
            </mesh>
          </group>
        </group>
      )}
      {trunk !== null && (
        <group userData={airZone}>
          <group userData={TRUNK_TAG}>
            <mesh geometry={trunkGeometry}>
              <meshStandardMaterial color={HOME_PALETTE.ductBoot} roughness={0.7} />
            </mesh>
            <MergedBoxes boxes={junction} color={HOME_PALETTE.ductBoot} radius={0.03} roughness={0.7} />
          </group>
        </group>
      )}
      {lines !== null && (
        <group userData={thermalTag(runningZone(running.has('outdoor'), side, still))}>
          <group userData={LINE_SET_TAG}>
            <mesh geometry={lineGeometry}>
              <meshStandardMaterial color={HOME_PALETTE.felt} roughness={0.9} />
            </mesh>
          </group>
        </group>
      )}
    </group>
  )
}
