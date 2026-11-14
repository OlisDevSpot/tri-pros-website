import type { HVACType } from '@/shared/modules/construction/core/constants/enums'

// Unknown is the common SoCal system: a central furnace and A/C.
export function isCentralSystem(type: HVACType | null): boolean {
  return type === null || type === 'central'
}

export function isDuctedSystem(type: HVACType | null): boolean {
  return isCentralSystem(type) || type === 'package-unit'
}
