import type { HvacIndoorLocation } from '@/shared/modules/construction/core/constants/enums'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { HomeMaterialFacts } from '@/shared/modules/construction/core/types'

import { INDOOR_UNIT_PLACEMENTS } from '@/features/trade-scenes/constants/indoor-unit-placements'
import { MOVABLE_INDOOR_UNIT_SCOPES } from '@/features/trade-scenes/constants/movable-indoor-unit-scopes'
import { hvacIndoorLocations } from '@/shared/modules/construction/core/constants/enums'
import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'

// A flat roof's joist space holds no indoor unit, redeck or not, so a reachable attic is not enough.
export function atticHoldsUnit(form: RoofForm): boolean {
  return form !== 'low-slope'
}

// Where the rep can say the unit stands: a place it has a placement, and the attic only under a pitched roof.
export function indoorUnitLocations(form: RoofForm): HvacIndoorLocation[] {
  return hvacIndoorLocations.filter(location => INDOOR_UNIT_PLACEMENTS[location] !== undefined && (location !== 'attic' || atticHoldsUnit(form)))
}

function drawable(location: HvacIndoorLocation, form: RoofForm): HvacIndoorLocation {
  if (location === 'attic' && !atticHoldsUnit(form)) {
    return 'closet'
  }
  // A location with no placement yet stands in the closet until it has one of its own.
  return INDOOR_UNIT_PLACEMENTS[location] !== undefined ? location : 'closet'
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

// The move is offered only where the unit stands elsewhere today and the attic can hold one.
export function moveToAtticOffered(materials: HomeMaterialFacts, form: RoofForm): boolean {
  return atticHoldsUnit(form) && indoorLocation(materials, form, 'existing', [], true) !== 'attic'
}
