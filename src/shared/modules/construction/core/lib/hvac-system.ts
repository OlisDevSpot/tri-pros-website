import type { CentralHvacComponent, HVACComponent, HVACType } from '@/shared/modules/construction/core/constants/enums'

// Unknown is the common SoCal system: a central furnace and A/C.
export function isCentralSystem(type: HVACType | null): boolean {
  return type === null || type === 'central'
}

export function isDuctedSystem(type: HVACType | null): boolean {
  return isCentralSystem(type) || type === 'package-unit'
}

// A central system always has its furnace, so A/C stored on one (an old profile value, or a wall unit's carried over) is a
// furnace with A/C. On a wall or window unit A/C keeps its meaning: it only cools.
export function centralComponents(components: HVACComponent | null): CentralHvacComponent | null {
  return components === 'ac' ? 'both' : components
}
