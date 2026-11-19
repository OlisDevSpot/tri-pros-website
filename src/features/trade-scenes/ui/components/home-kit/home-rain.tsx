'use client'

import type { RainColumn } from '@/shared/components/scene/types'

import { HOME_RAIN } from '@/features/trade-scenes/constants/home-life'
import { RAIN } from '@/shared/components/scene/constants/rain'
import { RainField } from '@/shared/components/scene/ui/rain-field'

interface HomeRainProps {
  running: boolean
}

// The same density in every field, whatever its size: a field's streak count is its share of the field's full count.
function intensityOf(box: readonly [number, number, number]): number {
  return Math.min(1, (box[0] * box[1] * box[2] * HOME_RAIN.density) / RAIN.maxStreaks)
}

const SKY: readonly RainColumn[] = HOME_RAIN.fields.map(field => ({ box: field.box, position: field.position, streaks: Math.round(intensityOf(field.box) * RAIN.maxStreaks) }))

export function HomeRain({ running }: HomeRainProps) {
  return <RainField columns={SKY} running={running} />
}
