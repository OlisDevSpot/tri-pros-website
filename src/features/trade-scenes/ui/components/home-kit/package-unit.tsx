'use client'

import type { Group } from 'three'
import type { UnitCurb } from '@/features/trade-scenes/lib/package-unit-placement'
import type { BoxSpec } from '@/features/trade-scenes/types'
import type { SceneBurst } from '@/shared/components/scene/types'

import { useMemo, useRef } from 'react'
import { BoxGeometry } from 'three'

import { PACKAGE_UNIT } from '@/features/trade-scenes/constants/home-equipment-sizes'
import { EQUIPMENT_STRAIN } from '@/features/trade-scenes/constants/home-life'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { useStrainShake } from '@/features/trade-scenes/hooks/use-strain-shake'
import { packageUnitPlacement } from '@/features/trade-scenes/lib/package-unit-placement'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'
import { useBurstMotion } from '@/shared/components/scene/hooks/use-burst-motion'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'

interface PackageUnitProps {
  lowSlope: boolean
  /** The size's multiplier on the drawn unit. */
  scale: number
  /** 0 when it is not cooling, as for the condenser. */
  load: number
  burst: SceneBurst
  wear: number
}

const [LENGTH, HEIGHT, DEPTH] = PACKAGE_UNIT.size
const { fan, colors } = PACKAGE_UNIT
const FAN_X = -LENGTH * 0.18
const BLADE_ANGLES = Array.from({ length: fan.blades }, (_, index) => (index / fan.blades) * Math.PI * 2)

const LOUVRES: BoxSpec[] = [-1, 1].map(side => ({ size: [LENGTH * 0.78, HEIGHT * 0.52, 0.012], position: [0, HEIGHT * 0.5, side * DEPTH / 2] }))
const LID: BoxSpec[] = [{ size: [LENGTH + 0.06, 0.04, DEPTH + 0.06], position: [0, HEIGHT + 0.02, 0] }]
const SERVICE_PANEL: BoxSpec[] = [{ size: [0.012, HEIGHT * 0.62, DEPTH * 0.55], position: [LENGTH / 2, HEIGHT * 0.5, 0] }]

// A box whose top stays level and whose underside is pulled down to the curb's own back and front heights, so on the
// slope its sides read as the tapered frame a pitched-roof curb is.
function curbGeometry({ at: [x, z], footprint: [length, depth], top, bottom: { back, front } }: UnitCurb): BoxGeometry {
  const geometry = new BoxGeometry(length, 1, depth)
  const positions = geometry.attributes.position
  for (let index = 0; index < positions.count; index++) {
    const localZ = positions.getZ(index)
    positions.setY(index, positions.getY(index) > 0 ? top : localZ < 0 ? back : front)
    positions.setX(index, positions.getX(index) + x)
    positions.setZ(index, localZ + z)
  }
  geometry.computeVertexNormals()
  return geometry
}

// A low rectangular roof unit with its fan on top, built from boxes; the case takes the dust a worn one collects, as the condenser does.
export function PackageUnit({ lowSlope, scale, load, burst, wear }: PackageUnitProps) {
  const { position, curb } = useMemo(() => packageUnitPlacement(lowSlope, scale), [lowSlope, scale])
  const body: BoxSpec[] = useMemo(() => [{ size: [LENGTH, HEIGHT, DEPTH], position: [0, HEIGHT / 2, 0] }], [])
  const curbShape = useOwnedGeometry(() => curbGeometry(curb), [curb])
  const shake = useStrainShake(load, burst)
  const rotor = useRef<Group>(null)
  useBurstMotion(burst, (life, seconds) => {
    if (rotor.current) {
      rotor.current.rotation.y += seconds * EQUIPMENT_STRAIN.fanTurnsPerSecond * load * life * Math.PI * 2
    }
  })

  const { dust, case: caseShare, grille } = WEAR_LOOKS.condenser
  const caseColour = wornColor(colors.case, dust, wear * caseShare)
  const louvreColour = wornColor(colors.louvre, dust, wear * grille)

  // The curb is set with the unit, so it lights with it.
  return (
    <group userData={systemPartTag('package-unit')}>
      <group userData={thermalTag('exterior')}>
        <mesh geometry={curbShape} castShadow>
          <meshStandardMaterial color={colors.curb} roughness={0.9} />
        </mesh>
      </group>
      <group ref={shake} userData={thermalTag('condenser')}>
        <group position={position} scale={scale}>
          <MergedBoxes boxes={body} color={caseColour} radius={0.02} roughness={0.7} castShadow receiveShadow />
          <MergedBoxes boxes={LID} color={caseColour} radius={0.012} roughness={0.7} castShadow />
          <MergedBoxes boxes={LOUVRES} color={louvreColour} roughness={0.8} />
          <MergedBoxes boxes={SERVICE_PANEL} color={louvreColour} roughness={0.8} />
          <group position={[FAN_X, HEIGHT + 0.045, 0]}>
            <mesh>
              <cylinderGeometry args={[fan.radius + fan.rimWidth, fan.radius + fan.rimWidth, 0.012, 24]} />
              <meshStandardMaterial color={louvreColour} roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.004, 0]}>
              <cylinderGeometry args={[fan.radius, fan.radius, 0.012, 24]} />
              <meshStandardMaterial color={colors.grille} roughness={0.9} />
            </mesh>
            <group ref={rotor} position={[0, 0.016, 0]}>
              {BLADE_ANGLES.map(angle => (
                <mesh key={angle} rotation={[0, angle, 0]} position={[Math.cos(angle) * fan.radius * 0.5, 0, -Math.sin(angle) * fan.radius * 0.5]}>
                  <boxGeometry args={[fan.radius * 0.95, 0.008, 0.06]} />
                  <meshStandardMaterial color={colors.blade} roughness={0.7} />
                </mesh>
              ))}
              <mesh>
                <cylinderGeometry args={[0.035, 0.035, 0.02, 16]} />
                <meshStandardMaterial color={colors.blade} roughness={0.6} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}
