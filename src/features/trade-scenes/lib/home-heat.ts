import type { HeatEffect, HomeHeat, HomeShell } from '@/features/trade-scenes/types'
import type { Climate } from '@/shared/modules/construction/core/constants/climate-presets'
import type { HeatWeather } from '@/shared/modules/construction/core/types'

import { READING_IDS } from '@/features/trade-scenes/constants/home-anchors'
import { ATTIC_FAN_HEAT_EFFECTS, BOUNCE_MAX, PART_HEAT_EFFECTS, ROOF_FORM_HEAT_EFFECTS, STARTING_HOME_HEAT } from '@/features/trade-scenes/constants/home-heat-figures'
import { atticFanRuns } from '@/features/trade-scenes/lib/attic-fan-runs'

const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value))

function applied(heat: HomeHeat, effect: HeatEffect | undefined): HomeHeat {
  if (!effect) {
    return heat
  }
  const readings = { ...heat.readings }
  for (const id of READING_IDS) {
    readings[id] += effect.readings?.[id] ?? 0
  }
  const { flows, bounce } = heat
  const passes = effect.flows?.roofPasses ?? [1, 1]
  return {
    readings,
    flows: {
      roofSource: clamp(flows.roofSource * (effect.flows?.roofSource ?? 1), 1),
      roofPasses: [clamp(flows.roofPasses[0] * passes[0], 1), clamp(flows.roofPasses[1] * passes[1], 1)],
      wall: flows.wall,
      window: flows.window,
      wallPasses: clamp(flows.wallPasses * (effect.flows?.wallPasses ?? 1), 1),
      windowPasses: clamp(flows.windowPasses * (effect.flows?.windowPasses ?? 1), 1),
    },
    bounce: {
      covering: clamp(bounce.covering + (effect.bounce?.covering ?? 0), BOUNCE_MAX),
      barrier: clamp(bounce.barrier + (effect.bounce?.barrier ?? 0), BOUNCE_MAX),
      wall: clamp(bounce.wall + (effect.bounce?.wall ?? 0), BOUNCE_MAX),
      window: clamp(bounce.window + (effect.bounce?.window ?? 0), BOUNCE_MAX),
    },
    load: clamp(heat.load * (effect.load ?? 1), 1),
    atticFanRunning: heat.atticFanRunning,
  }
}

// A part's condition never matters: an effect applies once, however the home came to have it.
export function homeHeat(climate: Climate, weather: HeatWeather, shell: HomeShell): HomeHeat {
  const start = STARTING_HOME_HEAT[climate][weather]
  let heat: HomeHeat = applied({
    ...start,
    flows: { ...start.flows, wallPasses: 1, windowPasses: 1 },
    bounce: { covering: 0, barrier: 0, wall: 0, window: 0 },
    atticFanRunning: false,
  }, ROOF_FORM_HEAT_EFFECTS[shell.form]?.[weather])
  for (const [partId, byMaterial] of Object.entries(PART_HEAT_EFFECTS)) {
    const part = shell.parts.find(candidate => candidate.id === partId)
    if (part) {
      heat = applied(heat, byMaterial[part.material ?? 'absent']?.[weather])
    }
  }
  const fan = shell.parts.find(candidate => candidate.id === 'attic-fan')
  if (atticFanRuns(fan?.material ?? null, heat.readings.attic)) {
    return { ...applied(heat, ATTIC_FAN_HEAT_EFFECTS[weather]), atticFanRunning: true }
  }
  return heat
}
