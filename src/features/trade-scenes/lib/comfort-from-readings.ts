import type { Comfort, HomeReadings } from '@/features/trade-scenes/types'

import { COMFORT_GAP_F } from '@/features/trade-scenes/constants/comfort'

// A ceiling far from the thermostat is felt as radiant heat in summer and a cold draft in winter, so the gap counts either way.
export function comfortFromReadings(readings: HomeReadings, setpoint: number): Comfort {
  const gap = Math.abs(readings.ceiling - setpoint)
  if (gap >= COMFORT_GAP_F.strained) {
    return 'strained'
  }
  return gap <= COMFORT_GAP_F.comfortable ? 'comfortable' : 'fair'
}
