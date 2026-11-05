import type { YearBuiltRange } from '@/shared/constants/enums/customers'
import type { DuctMaterial, WindowsType } from '@/shared/modules/construction/core/constants/enums'
import type { HomeMaterialId } from '@/shared/modules/construction/core/constants/home-material-ids'
import type { PropertyProfile, ResolvedHomeMaterials } from '@/shared/modules/construction/core/types'

import { CONTROLS_COPY, WINDOWS_TYPE_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { ERA_FALLBACK, INSULATION_BY_ERA } from '@/shared/modules/construction/core/constants/era-defaults'
import { HOME_MATERIAL_IDS } from '@/shared/modules/construction/core/constants/home-material-ids'
import { HOME_MATERIALS } from '@/shared/modules/construction/core/constants/home-materials'

// The line reads the era tables, not the home: it says what the code gives, whatever was set by hand. The kept ones are the
// materials Use code would put back.
export function eraCodeLine({ property, home }: { property: PropertyProfile, home: ResolvedHomeMaterials }): { era: YearBuiltRange, guessed: boolean, codes: string[], kept: HomeMaterialId[] } {
  const era = property.yearBuilt ?? ERA_FALLBACK
  // The era tables are typed loosely, as every material shares one definition, but each holds only its material's options.
  const windows = (HOME_MATERIALS.windows.eraGuess as Record<YearBuiltRange, WindowsType>)[era]
  const ducts = (HOME_MATERIALS.ducts.eraGuess as Record<YearBuiltRange, Exclude<DuctMaterial, 'r8-flex'>>)[era]
  return {
    era,
    guessed: property.yearBuilt === null,
    codes: [CONTROLS_COPY.systems.eraAttic[INSULATION_BY_ERA[era]], WINDOWS_TYPE_LABELS[windows], CONTROLS_COPY.systems.eraDucts[ducts]],
    kept: HOME_MATERIAL_IDS.filter(id => HOME_MATERIALS[id].eraGuess !== null && home[id]?.optionBasis === 'recorded'),
  }
}
