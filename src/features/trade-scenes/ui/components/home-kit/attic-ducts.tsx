'use client'

import type { BoxSpec, SystemLit, Vec3 } from '@/features/trade-scenes/types'
import type { DuctMaterial } from '@/shared/modules/construction/core/constants/enums'

import { useMemo } from 'react'
import { CatmullRomCurve3, TubeGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { REGISTER_BOOT } from '@/features/trade-scenes/constants/home-details'
import { PACKAGE_UNIT } from '@/features/trade-scenes/constants/home-equipment-sizes'
import { EQUIPMENT, REGISTER_BOOT_TOP, WALL_TOP_Y } from '@/features/trade-scenes/constants/home-geometry'
import { EQUIPMENT_STRAIN } from '@/features/trade-scenes/constants/home-life'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { LOOK_INSIDE_DUCT_RUN } from '@/features/trade-scenes/constants/look-inside'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { useHeatGlow } from '@/features/trade-scenes/hooks/use-heat-glow'
import { ceilingOpeningPart } from '@/features/trade-scenes/lib/ceiling-opening-part'
import { ceilingOpenings } from '@/features/trade-scenes/lib/ceiling-openings'
import { ductRunLook, ductRunPoints } from '@/features/trade-scenes/lib/duct-run-points'
import { ductStrapBoxes } from '@/features/trade-scenes/lib/duct-strap-boxes'
import { hungDuctMaterial } from '@/features/trade-scenes/lib/ducts-hang'
import { packageUnitDrop, packageUnitPlacement } from '@/features/trade-scenes/lib/package-unit-placement'
import { wornValue } from '@/features/trade-scenes/lib/part-state'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { DuctWraps } from '@/features/trade-scenes/ui/components/home-kit/duct-wraps'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'

interface AtticDuctsProps {
  lowSlope: boolean
  heatLoad: number
  material: string | null
  wear: number
  /** Whether a furnace-and-coil sits in the attic; a package unit has none, its air comes down from the roof. */
  airHandler: boolean
  /** The package unit's size, which sets where its drop comes down. */
  acScale: number
  // The system up close; heating & cooling opens one run into its system parts.
  lit: SystemLit | null
}

// A package unit's air comes down a drop from the roof into a bare trunk the runs leave from. It stands on the plenum's
// footprint, so every run starts on one of its faces, and rises to the top of the runs it feeds, so none steps off its top.
const { position: [PLENUM_X, , PLENUM_Z], size: [PLENUM_WIDTH, , PLENUM_DEPTH] } = EQUIPMENT.plenum
const { trunk: TRUNK } = PACKAGE_UNIT

// A flat roof's boots stay low in its shallow joist space; a pitched roof's stand clear of the deepest insulation.
const BOOT_HEIGHT = { lowSlope: 0.12, pitched: REGISTER_BOOT_TOP - WALL_TOP_Y } as const
const BOOTS = ceilingOpenings(true).filter(opening => opening.kind === 'boot')

// Metres of run per segment along the tube, and never fewer than 24 segments: a hung run's tight drop into its boot needs
// the finer step, or one long segment cuts the elbow off. A working number.
const TUBE_STEP = 0.08
const NO_TAG = {}

function ductRuns(points: readonly (readonly Vec3[])[], radius: number): TubeGeometry[] {
  return points.map((run) => {
    const curve = new CatmullRomCurve3(run.map(point => new Vector3(...point)))
    return new TubeGeometry(curve, Math.max(24, Math.ceil(curve.getLength() / TUBE_STEP)), radius, 10, false)
  })
}

// On a winter night the furnace's warm air shows as a glow at the plenum and at each register, as strong as the load.
export function AtticDucts({ lowSlope, heatLoad, material, wear, airHandler, acScale, lit }: AtticDuctsProps) {
  const bootGlow = useHeatGlow(heatLoad)
  const plenumGlow = useHeatGlow(heatLoad)
  const renewed = hungDuctMaterial(material)
  const { layout, radius, sag } = ductRunLook(material, wear, lowSlope)
  const hung = layout === 'hung'
  const points = useMemo(() => ductRunPoints(layout, radius, sag), [layout, radius, sag])
  // The duct pieces show with the run they are drawn on, so the run they open is drawn as them instead.
  const opened = lit !== null && lit.system === 'heating-cooling' && lit.shown.has('core') ? lit : null
  const geometry = useOwnedGeometry(() => {
    const runs = ductRuns(opened === null ? points : points.filter((_, index) => index !== LOOK_INSIDE_DUCT_RUN), radius)
    const merged = mergeGeometries(runs)
    runs.forEach(run => run.dispose())
    return merged
  }, [points, radius, opened !== null])
  const jacket = renewed
    ? { color: HOME_PALETTE.ductSilver, roughness: WEAR_LOOKS.newDucts.roughness, metalness: WEAR_LOOKS.newDucts.metalness }
    : { color: wornColor(HOME_PALETTE.duct, WEAR_LOOKS.ducts.dull, wear), roughness: wornValue(0.6, WEAR_LOOKS.ducts.roughness, wear), metalness: 0.2 }
  const straps = useMemo(() => (hung ? ductStrapBoxes(points, radius) : []), [hung, points, radius])
  // Up close on the attic the boots light with the air gaps round them, as the cans and the vents do.
  const fixtures = ceilingOpeningPart(lit)

  // Each run ends at a register boot over its room.
  const boots = useMemo((): BoxSpec[] => {
    const height = lowSlope ? BOOT_HEIGHT.lowSlope : BOOT_HEIGHT.pitched
    return BOOTS.map(({ at: [x, z] }) => ({ size: [REGISTER_BOOT.size, height, REGISTER_BOOT.size], position: [x, WALL_TOP_Y + height / 2, z] }))
  }, [lowSlope])
  const plenum = useMemo((): BoxSpec[] => {
    // Under a flat roof the air handler sits in a closet below, out of sight.
    if (lowSlope) {
      return []
    }
    if (airHandler) {
      return [{ size: EQUIPMENT.plenum.size, position: EQUIPMENT.plenum.position }]
    }
    const top = Math.max(TRUNK.top, ...points.map(run => run[0][1] + radius))
    return [
      { size: [PLENUM_WIDTH, top - TRUNK.bottom, PLENUM_DEPTH], position: [PLENUM_X, (TRUNK.bottom + top) / 2, PLENUM_Z] },
      packageUnitDrop(packageUnitPlacement(false, acScale)),
    ]
  }, [lowSlope, airHandler, points, radius, acScale])

  // The straps, the boots and a package unit's trunk and drop are all the duct runs' install; on a central system the
  // plenum box is the air handler itself.
  return (
    <group userData={systemPartTag('duct-runs')}>
      <mesh geometry={geometry}>
        <meshStandardMaterial {...jacket} />
      </mesh>
      {/* Shown, the run has a material: the duct pieces show only on a duct that is there. */}
      {opened !== null && <DuctWraps material={material as DuctMaterial} wear={wear} run={points[LOOK_INSIDE_DUCT_RUN]} radius={radius} jacket={jacket} lit={opened} />}
      {straps.length > 0 && <MergedBoxes boxes={straps} color={HOME_PALETTE.ductBoot} roughness={0.5} metalness={0.4} />}
      <group userData={fixtures === null ? NO_TAG : systemPartTag(fixtures)}>
        <MergedBoxes boxes={boots} color={HOME_PALETTE.ductBoot} radius={0.02} emissive={EQUIPMENT_STRAIN.heat.color} materialRef={bootGlow} />
      </group>
      {plenum.length > 0 && (
        <group userData={systemPartTag(airHandler ? 'air-handler' : 'duct-runs')}>
          <MergedBoxes boxes={plenum} color={airHandler ? HOME_PALETTE.unit : HOME_PALETTE.ductBoot} radius={0.04} roughness={0.7} emissive={EQUIPMENT_STRAIN.heat.color} materialRef={plenumGlow} />
        </group>
      )}
    </group>
  )
}
