import type { SceneChangeSlot } from '@/features/trade-scenes/types'
import type { ResolvedHomeMaterial } from '@/shared/modules/construction/core/types'

import { GUTTER_COLOR_COPY, PAINT_COLOR_COPY } from '@/features/trade-scenes/constants/home-scene-copy'

export type MaterialInputGroupId = 'hvac-location' | 'hvac-components' | 'ac-tons' | 'mini-split-heads' | 'paint-colors' | 'gutter-colors' | 'condition' | 'wear'

// Heating & cooling's location, equipment, AC size and mini-split heads and the gutters' wear sit on slots of their own, found among every slot.
export function ridingSlot(slots: readonly SceneChangeSlot[], id: string): SceneChangeSlot | null {
  return slots.find(candidate => candidate.id === id) ?? null
}

// An absent material has no condition to rate.
export function ratedMaterial(material: ResolvedHomeMaterial | null): ResolvedHomeMaterial | null {
  return material !== null && !material.absent ? material : null
}

export function materialInputGroupIds(slot: SceneChangeSlot, slots: readonly SceneChangeSlot[], material: ResolvedHomeMaterial | null): MaterialInputGroupId[] {
  const heatingCooling = slot.id === 'heating-cooling'
  const gutterWear = slot.id === 'gutters' ? ridingSlot(slots, 'gutter-wear') : null
  const rated = ratedMaterial(material)
  const ids: (MaterialInputGroupId | null)[] = [
    heatingCooling && ridingSlot(slots, 'hvac-location') ? 'hvac-location' : null,
    heatingCooling && ridingSlot(slots, 'hvac-components') ? 'hvac-components' : null,
    heatingCooling && ridingSlot(slots, 'ac-tons') ? 'ac-tons' : null,
    heatingCooling && ridingSlot(slots, 'mini-split-heads') ? 'mini-split-heads' : null,
    slot.id === 'exterior-paint' ? 'paint-colors' : null,
    gutterWear ? 'gutter-colors' : null,
    rated || gutterWear ? 'condition' : null,
    rated?.id === 'exterior-paint' || rated?.id === 'roof' ? 'wear' : null,
  ]
  return ids.filter(id => id !== null)
}

// Condition and wear carry no heading of their own here: the menu's Condition group names the wear. A rider's heading is its
// own slot's name, so pass that slot for it.
export function materialInputGroupHeader(id: MaterialInputGroupId, slot: SceneChangeSlot): string | null {
  switch (id) {
    case 'hvac-location':
    case 'hvac-components':
    case 'ac-tons':
    case 'mini-split-heads':
      return slot.name
    case 'paint-colors':
      return PAINT_COLOR_COPY.colors
    case 'gutter-colors':
      return GUTTER_COLOR_COPY.header
    default:
      return null
  }
}
