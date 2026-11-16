'use client'

import type { Ref } from 'react'
import type { Group } from 'three'
import type { HvacRunningPart } from '@/features/trade-scenes/lib/hvac-running'
import type { DrawnHvac, SystemLit } from '@/features/trade-scenes/types'
import type { SceneBurst } from '@/shared/components/scene/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { EQUIPMENT_STRAIN } from '@/features/trade-scenes/constants/home-life'
import { facesSummerSun } from '@/features/trade-scenes/lib/faces-summer-sun'
import { runningZone } from '@/features/trade-scenes/lib/hvac-running'
import { indoorUnitPlacement } from '@/features/trade-scenes/lib/indoor-unit-placement'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { AtticDucts } from '@/features/trade-scenes/ui/components/home-kit/attic-ducts'
import { ElectricMeter } from '@/features/trade-scenes/ui/components/home-kit/electric-meter'
import { HvacCloset } from '@/features/trade-scenes/ui/components/home-kit/hvac-closet'
import { IndoorUnit } from '@/features/trade-scenes/ui/components/home-kit/indoor-unit'
import { MiniSplitHeads } from '@/features/trade-scenes/ui/components/home-kit/mini-split-heads'
import { PackageUnit } from '@/features/trade-scenes/ui/components/home-kit/package-unit'
import { Registers } from '@/features/trade-scenes/ui/components/home-kit/registers'
import { Thermostat } from '@/features/trade-scenes/ui/components/home-kit/thermostat'
import { WallFurnace } from '@/features/trade-scenes/ui/components/home-kit/wall-furnace'
import { WallUnit } from '@/features/trade-scenes/ui/components/home-kit/wall-unit'
import { WindowUnit } from '@/features/trade-scenes/ui/components/home-kit/window-unit'

// The meter hangs on the left wall's face, so it takes that wall's sun.
const METER_ZONE = facesSummerSun(-1, 0) ? 'sunlit' : 'exterior'

interface HomeEquipmentProps {
  hvac: DrawnHvac
  // What the indoor side carries this weather, from the systems that run on the side on show.
  side: 'heating' | 'cooling' | null
  running: ReadonlySet<HvacRunningPart>
  lowSlope: boolean
  /** 0..1, how hard the equipment works against the heat through the ceiling. */
  load: number
  meterSpeed: number
  setpoint: number
  burst: SceneBurst
  // Holds the attic's ducts, which the home hides whenever nothing can see into the attic.
  ducts: Ref<Group>
  acScale: number
  // The system up close, held while its steps ease shut.
  lit: SystemLit | null
}

export function HomeEquipment({ hvac, side, running, lowSlope, load, meterSpeed, setpoint, burst, ducts, acScale, lit }: HomeEquipmentProps) {
  // Each component carries the load only while its season runs it: the furnace or a unit's heater glows with it on a winter
  // night, and a unit left idle by a new system, an A/C alone in winter or a furnace alone in summer carries nothing.
  const loadOf = (part: HvacRunningPart) => (running.has(part) ? load : 0)
  const heatLoadOf = (part: HvacRunningPart) => (side === 'heating' ? loadOf(part) : 0)
  // The ducts and registers carry whatever air the blower or the package unit pushes through them.
  const airMoving = running.has('blower') || running.has('package')
  const thermostat = running.size > 0 && load > EQUIPMENT_STRAIN.runningAbove ? (side === 'heating' ? 'winter' : 'summer') : null
  const form: RoofForm = lowSlope ? 'low-slope' : 'pitched'
  const placement = hvac.indoor === null ? null : indoorUnitPlacement(hvac.indoor.location, form)
  const vacated = hvac.vacated === null ? null : indoorUnitPlacement(hvac.vacated, form)
  const unit = hvac.indoor !== null && placement !== null && (
    <IndoorUnit
      placement={placement}
      furnace={hvac.indoor.furnace !== null}
      coil={hvac.indoor.coil !== null}
      lineSet={hvac.lineSet}
      heatLoad={heatLoadOf('furnace')}
      form={form}
      running={running}
      side={side}
      still={placement.upright ? 'interior' : 'attic'}
    />
  )
  const wallUnit = hvac.wallUnit
  const unitZone = (part: HvacRunningPart) => thermalTag(runningZone(running.has(part), side, 'interior'))

  return (
    <group userData={thermalTag('interior')}>
      {/* The ducts and an attic unit lie in the attic air until the system pushes warm or cold air through them. */}
      <group ref={ducts} userData={thermalTag(runningZone(airMoving, side, 'attic'))}>
        {hvac.ducts !== null && <AtticDucts lowSlope={lowSlope} heatLoad={airMoving && side === 'heating' ? load : 0} ducts={hvac.ducts} indoor={hvac.indoor !== null} acScale={acScale} lit={lit} />}
        {placement?.upright === false && unit}
      </group>
      {placement?.upright === true && unit}
      {placement !== null && <HvacCloset walls={placement.closet} />}
      {vacated !== null && <HvacCloset walls={vacated.closet} />}
      {hvac.registers && (
        <group userData={thermalTag(runningZone(airMoving, side, 'interior'))}>
          <Registers />
        </group>
      )}
      {hvac.packageUnit !== null && (
        <group userData={unitZone('package')}>
          <PackageUnit lowSlope={lowSlope} scale={acScale} load={side === 'cooling' ? loadOf('package') : 0} burst={burst} wear={hvac.packageUnit.wear} />
        </group>
      )}
      {wallUnit !== null && (
        <group userData={unitZone('wall-unit')}>
          {wallUnit.kind === 'wall-furnace'
            ? <WallFurnace heatLoad={heatLoadOf('wall-unit')} />
            : <WallUnit load={loadOf('wall-unit')} heatLoad={heatLoadOf('wall-unit')} burst={burst} />}
        </group>
      )}
      {/* The outdoor unit stands on the lawn with the condenser; its lines ride with the walls they are fixed to. */}
      {hvac.miniSplit !== null && <MiniSplitHeads heads={hvac.miniSplit.heads} running={running.has('mini-split')} side={side} />}
      {hvac.windowUnit !== null && (
        <group userData={unitZone('window-unit')}>
          <WindowUnit load={loadOf('window-unit')} heatLoad={heatLoadOf('window-unit')} burst={burst} />
        </group>
      )}
      <group userData={thermalTag(METER_ZONE)}>
        <ElectricMeter speed={meterSpeed} burst={burst} />
      </group>
      <group userData={thermalTag('interior')}>
        <Thermostat setpoint={setpoint} running={thermostat} burst={burst} />
      </group>
    </group>
  )
}
