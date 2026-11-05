import type { HVACComponent, HVACType } from '@/shared/modules/construction/core/constants/enums'

// Unknown draws as central, the common SoCal system; a furnace alone has no outdoor unit, and a package unit stands on the
// roof rather than the ground.
export function hasOutdoorUnit(hvacType: HVACType | null, hvacComponents: HVACComponent | null): boolean {
  return (hvacType ?? 'central') === 'central' && hvacComponents !== 'furnace'
}
