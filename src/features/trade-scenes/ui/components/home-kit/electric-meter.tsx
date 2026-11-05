'use client'

import type { BoxSpec } from '@/features/trade-scenes/types'
import type { SceneBurst } from '@/shared/components/scene/types'

import { METER_BOX } from '@/features/trade-scenes/constants/home-details'
import { EQUIPMENT } from '@/features/trade-scenes/constants/home-geometry'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { MeterDial } from '@/features/trade-scenes/ui/components/home-kit/meter-dial'

interface ElectricMeterProps {
  /** 0..1, as fast as the cost the savings panel shows. */
  speed: number
  burst: SceneBurst
}

const [wallX, y, z] = EQUIPMENT.meter.position
const { base: [BASE_DEPTH, baseHeight, baseWidth], conduit, conduitOffset, dome } = METER_BOX
const CONDUIT_HEIGHT = y - baseHeight / 2
const BASE: BoxSpec[] = [
  { size: [BASE_DEPTH, baseHeight, baseWidth], position: [wallX - BASE_DEPTH / 2, y, z] },
  // The conduit down to the service below grade.
  { size: [conduit, CONDUIT_HEIGHT, conduit], position: [wallX - conduitOffset, CONDUIT_HEIGHT / 2, z] },
]
const DOME_X = wallX - BASE_DEPTH - dome.depth / 2
const DOME_Y = y + dome.raise

// The meter on the side wall facing the street; its dial is the one thing that spins with the bill.
export function ElectricMeter({ speed, burst }: ElectricMeterProps) {
  return (
    <group>
      <MergedBoxes boxes={BASE} color={HOME_PALETTE.meterBase} radius={0.02} roughness={0.55} metalness={0.3} />
      <MeterDial position={[DOME_X, DOME_Y, z]} speed={speed} burst={burst} />
      <mesh position={[DOME_X, DOME_Y, z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[dome.radius, dome.radius, dome.depth, 24]} />
        <meshStandardMaterial color={HOME_PALETTE.meterGlass} roughness={0.15} transparent opacity={0.45} depthWrite={false} />
      </mesh>
    </group>
  )
}
