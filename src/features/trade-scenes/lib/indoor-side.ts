import type { HVACComponent, HVACType } from '@/shared/modules/construction/core/constants/enums'
import type { Weather } from '@/shared/modules/construction/core/types'

// What the indoor side carries for the thermal camera: heat on a winter night, cold air on a summer afternoon, nothing in a
// storm or when the system has no such side (a furnace alone never cools, an AC alone never heats). A package unit does both
// whatever the Equipment choice says, which a leftover answer from a split system must not override.
export function indoorSide(weather: Weather, hvacType: HVACType | null, hvacComponents: HVACComponent | null): 'heating' | 'cooling' | null {
  const components = hvacType === 'package-unit' ? null : hvacComponents
  if (weather === 'winter' && components !== 'ac') {
    return 'heating'
  }
  if (weather === 'summer' && components !== 'furnace') {
    return 'cooling'
  }
  return null
}
