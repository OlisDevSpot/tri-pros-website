import type { HvacIndoorLocation } from '@/shared/modules/construction/core/constants/enums'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { HomeMaterialFacts } from '@/shared/modules/construction/core/types'

import { MOVABLE_INDOOR_UNIT_SCOPES } from '@/features/trade-scenes/constants/movable-indoor-unit-scopes'
import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'

// The locations the scene can draw a unit in; any other stands in the closet until it has a place of its own.
const PLACEABLE: readonly HvacIndoorLocation[] = ['attic', 'closet']

// A flat roof's joist space holds no indoor unit, redeck or not, so a reachable attic is not enough.
export function atticHoldsUnit(form: RoofForm): boolean {
  return form !== 'low-slope'
}

function drawable(location: HvacIndoorLocation, form: RoofForm): HvacIndoorLocation {
  if (location === 'attic' && !atticHoldsUnit(form)) {
    return 'closet'
  }
  return PLACEABLE.includes(location) ? location : 'closet'
}

function firstPlace(form: RoofForm): HvacIndoorLocation {
  return atticHoldsUnit(form) ? 'attic' : 'closet'
}

function installsBlower(scopeId: string): boolean {
  return SCOPE_INSTALLS[scopeId]?.installs.some(install => install.part === 'blower') ?? false
}

export function indoorLocation(materials: HomeMaterialFacts, form: RoofForm, view: 'existing' | 'proposed', picks: readonly string[], existingCentral: boolean): HvacIndoorLocation {
  const today = drawable(materials.hvacIndoorLocation ?? firstPlace(form), form)
  if (view === 'existing') {
    return today
  }
  if (materials.proposedHvacIndoorLocation !== null && picks.some(pick => (MOVABLE_INDOOR_UNIT_SCOPES as readonly string[]).includes(pick))) {
    return drawable(materials.proposedHvacIndoorLocation, form)
  }
  if (!existingCentral && picks.some(installsBlower)) {
    return firstPlace(form)
  }
  return today
}
