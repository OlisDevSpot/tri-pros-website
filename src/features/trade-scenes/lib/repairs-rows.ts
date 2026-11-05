import type { Wear } from '@/shared/modules/construction/core/constants/enums'
import type { HomeMaterialId } from '@/shared/modules/construction/core/constants/home-material-ids'
import type { TradeSlug } from '@/shared/modules/construction/core/constants/trade-slugs'
import type { PropertyProfile, ResolvedHomeMaterial, ResolvedHomeMaterials } from '@/shared/modules/construction/core/types'

import { EXTERIOR_PAINT_LABELS, HOME_MATERIAL_LABELS, HVAC_TYPE_LABELS, REPAIRS_COPY, ROOF_TYPE_LABELS, WEAR_LABELS, WINDOWS_TYPE_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { workingRepairs } from '@/features/trade-scenes/lib/repairs-figure'
import { HOME_MATERIAL_IDS } from '@/shared/modules/construction/core/constants/home-material-ids'
import { HOME_MATERIALS } from '@/shared/modules/construction/core/constants/home-materials'

export interface RepairsRow {
  trade: TradeSlug
  material: HomeMaterialId
  wear: Wear | null
  working: number
  label: string
  note: string | null
}

// The heating and cooling material has no option of its own; its type is a fact of the property.
function optionLabel(id: HomeMaterialId, material: ResolvedHomeMaterial, property: PropertyProfile): string | null {
  switch (id) {
    case 'roof':
      return material.option === null ? null : ROOF_TYPE_LABELS[material.option as keyof typeof ROOF_TYPE_LABELS]
    case 'windows':
      return material.option === null ? null : WINDOWS_TYPE_LABELS[material.option as keyof typeof WINDOWS_TYPE_LABELS]
    case 'exterior-paint':
      return material.option === null ? null : EXTERIOR_PAINT_LABELS[material.option as keyof typeof EXTERIOR_PAINT_LABELS]
    case 'heating-cooling':
      return property.hvacType === null ? null : HVAC_TYPE_LABELS[property.hvacType]
    default:
      return null
  }
}

export function repairsRows(property: PropertyProfile, home: ResolvedHomeMaterials): RepairsRow[] {
  return HOME_MATERIAL_IDS.flatMap((id) => {
    const material = home[id]
    const { repairs, trade } = HOME_MATERIALS[id]
    if (!repairs || !material || material.absent) {
      return []
    }
    const working = workingRepairs(trade, material.wear)
    if (working <= 0) {
      return []
    }
    const condition = material.wear === null ? REPAIRS_COPY.wearNotSet : WEAR_LABELS[material.wear]
    const option = optionLabel(id, material, property)
    return [{ trade, material: id, wear: material.wear, working, label: HOME_MATERIAL_LABELS[id], note: option === null ? condition : `${option} · ${condition}` }]
  })
}
