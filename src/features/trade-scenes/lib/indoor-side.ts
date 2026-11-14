import type { HvacDuties } from '@/features/trade-scenes/types'
import type { Weather } from '@/shared/modules/construction/core/types'

// What the indoor side carries for the thermal camera: heat on a winter night, cold air on a summer afternoon, nothing in a
// storm or when no running system has that duty (a furnace alone never cools, an A/C alone never heats).
export function indoorSide(weather: Weather, duties: HvacDuties): 'heating' | 'cooling' | null {
  if (weather === 'winter' && duties.heats) {
    return 'heating'
  }
  if (weather === 'summer' && duties.cools) {
    return 'cooling'
  }
  return null
}
