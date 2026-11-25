import type { HomeSystemId, SceneChangeSlot } from '@/features/trade-scenes/types'
import type { ResolvedHomeMaterial, ResolvedHomeMaterials } from '@/shared/modules/construction/core/types'

import { systemMaterialIds } from '@/features/trade-scenes/lib/system-material-ids'

// Gutters rides with the roof, air sealing with the attic's insulation; neither has a material of its own to rate.
export function systemInputSlotIds(system: HomeSystemId, home: ResolvedHomeMaterials, slots: readonly SceneChangeSlot[]): { slotId: string, material: ResolvedHomeMaterial | null }[] {
  return systemMaterialIds(system, home).flatMap(id => [
    { slotId: id, material: home[id] ?? null },
    ...id === 'roof' ? [{ slotId: 'gutters', material: null }] : [],
    ...id === 'attic-insulation' && slots.some(slot => slot.id === 'air-sealing') ? [{ slotId: 'air-sealing', material: null }] : [],
  ])
}
