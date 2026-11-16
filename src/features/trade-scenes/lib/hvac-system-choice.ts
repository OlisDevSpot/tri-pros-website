import type { HvacSystemChoice } from '@/features/trade-scenes/types'
import type { PropertyProfile } from '@/shared/modules/construction/core/types'

import { centralComponents } from '@/shared/modules/construction/core/lib/hvac-system'

// A wall-mounted unit that heats only is a wall furnace; one that cools, with or without heat, is a wall unit.
export function hvacSystemChoice(property: PropertyProfile): HvacSystemChoice | null {
  switch (property.hvacType) {
    case null:
      return null
    case 'wall-mounted':
      return property.hvacComponents === 'furnace' ? 'wall-furnace' : 'wall-unit'
    default:
      return property.hvacType
  }
}

// Central keeps today's equipment, so a home already set to a furnace alone stays one, and a wall unit that only cooled
// becomes a furnace with A/C; a system with no equipment row of its own clears it.
export function hvacSystemPatch(choice: HvacSystemChoice, property: PropertyProfile): Partial<PropertyProfile> {
  switch (choice) {
    case 'wall-furnace':
      return { hvacType: 'wall-mounted', hvacComponents: 'furnace' }
    case 'wall-unit':
      return { hvacType: 'wall-mounted', hvacComponents: 'both' }
    case 'central':
      return { hvacType: 'central', hvacComponents: centralComponents(property.hvacComponents) }
    default:
      return { hvacType: choice, hvacComponents: null }
  }
}
