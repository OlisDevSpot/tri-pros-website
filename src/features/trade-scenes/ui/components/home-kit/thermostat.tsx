'use client'

import type { BoxSpec } from '@/features/trade-scenes/types'
import type { SceneBurst } from '@/shared/components/scene/types'

import { THERMOSTAT_BOX } from '@/features/trade-scenes/constants/home-details'
import { EQUIPMENT } from '@/features/trade-scenes/constants/home-geometry'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { ThermostatDisplay } from '@/features/trade-scenes/ui/components/home-kit/thermostat-display'

interface ThermostatProps {
  setpoint: number
  running: 'summer' | 'winter' | null
  burst: SceneBurst
}

const [x, y, wallFace] = EQUIPMENT.thermostat.position
const { body, face, faceRaise, displayProud } = THERMOSTAT_BOX
const BODY: BoxSpec[] = [{ size: body, position: [x, y, wallFace + body[2] / 2] }]
const FACE: BoxSpec[] = [{ size: face, position: [x, y + faceRaise, wallFace + body[2] + face[2] / 2] }]
const DISPLAY_Z = wallFace + body[2] + face[2] + displayProud

// On the hall side of the living room's back wall, where the household reads it.
export function Thermostat({ setpoint, running, burst }: ThermostatProps) {
  return (
    <group>
      <MergedBoxes boxes={BODY} color={HOME_PALETTE.thermostat} radius={0.012} roughness={0.5} />
      <MergedBoxes boxes={FACE} color={HOME_PALETTE.thermostatFace} roughness={0.3} />
      <ThermostatDisplay position={[x, y + faceRaise, DISPLAY_Z]} setpoint={setpoint} running={running} burst={burst} />
    </group>
  )
}
