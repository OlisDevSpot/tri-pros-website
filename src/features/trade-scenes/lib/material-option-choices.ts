import type { DuctMaterial, RoofType } from '@/shared/modules/construction/core/constants/enums'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { PropertyProfile } from '@/shared/modules/construction/core/types'

import { PROFILE_ROOF_TYPES } from '@/features/trade-scenes/constants/scene-controls'
import { hasOutdoorUnit } from '@/features/trade-scenes/lib/has-outdoor-unit'
import { ductMaterials } from '@/shared/modules/construction/core/constants/enums'
import { roofFormOf } from '@/shared/modules/construction/core/lib/roof-form-of'

// A set form offers only its own coverings, so the covering never contradicts it; an unset form offers every one.
export function roofTypeChoices(form: RoofForm | null): RoofType[] {
  return PROFILE_ROOF_TYPES.filter(type => form === null || roofFormOf(type) === form)
}

// R-8 is an upgrade, never what the home has.
export function existingDuctChoices(): DuctMaterial[] {
  return ductMaterials.filter(material => material !== 'r8-flex')
}

// A package unit cools from the roof, so it has an AC size without an outdoor unit on the ground.
export function hasAcUnit(property: PropertyProfile): boolean {
  return hasOutdoorUnit(property.hvacType, property.hvacComponents) || property.hvacType === 'package-unit'
}

// An unknown system draws as central, so its equipment can still be set.
export function showsEquipment(property: PropertyProfile): boolean {
  return (property.hvacType ?? 'central') === 'central'
}
