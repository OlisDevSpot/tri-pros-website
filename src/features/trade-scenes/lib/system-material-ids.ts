import type { HomeSystemId } from '@/features/trade-scenes/types'
import type { HomeMaterialId } from '@/shared/modules/construction/core/constants/home-material-ids'
import type { ResolvedHomeMaterials } from '@/shared/modules/construction/core/types'

import { systemOfPart } from '@/features/trade-scenes/lib/system-of-part'
import { HOME_MATERIAL_IDS } from '@/shared/modules/construction/core/constants/home-material-ids'
import { HOME_MATERIALS } from '@/shared/modules/construction/core/constants/home-materials'

// Read through the material's parts, never set by hand, so a card's Today chips and its build row agree on the system.
export function systemMaterialIds(system: HomeSystemId, home: ResolvedHomeMaterials): HomeMaterialId[] {
  return HOME_MATERIAL_IDS.filter(id => home[id] !== undefined && HOME_MATERIALS[id].parts.some(({ assembly, part }) => systemOfPart(assembly, part) === system))
}
