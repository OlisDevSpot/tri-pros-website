'use client'

import { DOWNSPOUTS } from '@/features/trade-scenes/constants/home-geometry'
import { HOME_RAIN } from '@/features/trade-scenes/constants/home-life'
import { RAIN } from '@/shared/components/scene/constants/rain'
import { RainField } from '@/shared/components/scene/ui/rain-field'

interface HomeRainProps {
  running: boolean
  /** The roof has gutters, so its downspouts run. */
  gutters: boolean
  lowSlope: boolean
}

// The same density in every field, whatever its size: a field's streak count is its share of the field's full count.
function intensityOf(box: readonly [number, number, number]): number {
  return Math.min(1, (box[0] * box[1] * box[2] * HOME_RAIN.density) / RAIN.maxStreaks)
}

export function HomeRain({ running, gutters, lowSlope }: HomeRainProps) {
  const spouts = gutters ? DOWNSPOUTS[lowSlope ? 'lowSlope' : 'pitched'].at : []
  const [, spoutHeight] = HOME_RAIN.spout.box
  return (
    <group>
      {HOME_RAIN.fields.map(field => (
        <RainField key={field.position.join(',')} box={field.box} position={field.position} intensity={intensityOf(field.box)} running={running} />
      ))}
      {spouts.map(([x, z]) => (
        <RainField key={`${x},${z}`} box={HOME_RAIN.spout.box} position={[x, spoutHeight / 2, z]} intensity={HOME_RAIN.spout.intensity} running={running} />
      ))}
    </group>
  )
}
