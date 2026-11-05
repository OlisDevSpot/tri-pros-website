'use client'

import type { Ref } from 'react'
import type { Group } from 'three'
import type { PartState } from '@/features/trade-scenes/lib/part-state'
import type { SceneBurst } from '@/shared/components/scene/types'
import type { HVACComponent, HVACType } from '@/shared/modules/construction/core/constants/enums'
import type { Weather } from '@/shared/modules/construction/core/types'

import { EQUIPMENT_STRAIN } from '@/features/trade-scenes/constants/home-life'
import { facesSummerSun } from '@/features/trade-scenes/lib/faces-summer-sun'
import { indoorSide } from '@/features/trade-scenes/lib/indoor-side'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { AtticDucts } from '@/features/trade-scenes/ui/components/home-kit/attic-ducts'
import { ElectricMeter } from '@/features/trade-scenes/ui/components/home-kit/electric-meter'
import { PackageUnit } from '@/features/trade-scenes/ui/components/home-kit/package-unit'
import { Thermostat } from '@/features/trade-scenes/ui/components/home-kit/thermostat'
import { WallUnit } from '@/features/trade-scenes/ui/components/home-kit/wall-unit'
import { WindowUnit } from '@/features/trade-scenes/ui/components/home-kit/window-unit'

// The meter hangs on the left wall's face, so it takes that wall's sun.
const METER_ZONE = facesSummerSun(-1, 0) ? 'sunlit' : 'exterior'

interface HomeEquipmentProps {
  hvacType: HVACType | null
  hvacComponents: HVACComponent | null
  lowSlope: boolean
  weather: Weather
  /** 0..1, how hard the equipment works against the heat through the ceiling. */
  load: number
  meterSpeed: number
  setpoint: number
  burst: SceneBurst
  // Holds the attic's ducts, which the home hides whenever nothing can see into the attic.
  ducts: Ref<Group>
  ductRuns: PartState
  packageUnit: PartState
  acScale: number
  // Whether the home has ducts in the attic: a wall or window unit has none.
  ducted: boolean
}

export function HomeEquipment({ hvacType, hvacComponents, lowSlope, weather, load, meterSpeed, setpoint, burst, ducts, ductRuns, packageUnit, acScale, ducted }: HomeEquipmentProps) {
  // Unknown draws as central, the common SoCal system.
  const type = hvacType ?? 'central'
  const side = indoorSide(weather, hvacType, hvacComponents)
  // On a winter night the furnace or the unit's heater carries the load and glows with it. A system with no side for this
  // weather carries nothing, so an AC alone never glows heat and a furnace alone never cools.
  const heatLoad = side === 'heating' ? load : 0
  const running = side !== null && load > EQUIPMENT_STRAIN.runningAbove ? (side === 'heating' ? 'winter' : 'summer') : null

  return (
    <group userData={thermalTag(side ?? 'interior')}>
      {/* The ducts lie in the attic air until the system pushes warm or cold air through them. */}
      {ducted && (
        <group ref={ducts} userData={thermalTag(side ?? 'attic')}>
          <AtticDucts lowSlope={lowSlope} heatLoad={heatLoad} material={ductRuns.material} wear={ductRuns.wear} airHandler={type === 'central'} acScale={acScale} />
        </group>
      )}
      {type === 'package-unit' && (
        <PackageUnit lowSlope={lowSlope} scale={acScale} load={side === 'cooling' ? load : 0} burst={burst} wear={packageUnit.wear} />
      )}
      {type === 'wall-mounted' && <WallUnit load={load} heatLoad={heatLoad} burst={burst} />}
      {type === 'portable' && <WindowUnit load={load} heatLoad={heatLoad} burst={burst} />}
      <group userData={thermalTag(METER_ZONE)}>
        <ElectricMeter speed={meterSpeed} burst={burst} />
      </group>
      <group userData={thermalTag('interior')}>
        <Thermostat setpoint={setpoint} running={running} burst={burst} />
      </group>
    </group>
  )
}
