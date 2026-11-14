import type { ExistingConditions, ExistingPart, HomeFacts, ResolvedHomeMaterials } from '@/shared/modules/construction/core/types'

import { basisOfMaterials, drawnPart } from '@/shared/modules/construction/core/lib/drawn-part'
import { isCentralSystem, isDuctedSystem } from '@/shared/modules/construction/core/lib/hvac-system'

const ABSENT: ExistingPart = { material: null, condition: 'absent' }

export function inferHvacAtticExistingConditions({ property }: HomeFacts, home: ResolvedHomeMaterials): ExistingConditions {
  const ducts = home.ducts?.option ?? 'original-flex'
  const central = isCentralSystem(property.hvacType)
  const components = property.hvacComponents ?? 'both'
  const heats = central && components !== 'ac'
  const cools = central && components !== 'furnace'
  const miniSplit = property.hvacType === 'mini-split'
  const aging = (material: string, present: boolean): ExistingPart => present ? drawnPart(material, home, 'heating-cooling') : ABSENT
  return {
    form: property.hvacType === 'package-unit' ? 'package' : 'split',
    basis: basisOfMaterials(property, home, ['heating-cooling', 'ducts']),
    parts: {
      'registers': isDuctedSystem(property.hvacType) ? { material: 'grille', condition: 'retained' } : ABSENT,
      'blower': aging('standard-blower', central),
      'furnace': aging('standard-furnace', heats),
      'coil': aging('standard-coil', cools),
      'plenum': central ? { material: 'sheet-metal', condition: 'retained' } : ABSENT,
      'duct-runs': drawnPart(ducts, home, 'ducts'),
      'thermostat': { material: 'thermostat', condition: 'retained' },
      'refrigerant-lines': aging('copper', cools),
      'condenser': aging('standard-seer', cools),
      'package-unit': drawnPart('standard-package', home, 'heating-cooling'),
      'mini-split-heads': aging('wall-head', miniSplit),
      'mini-split-outdoor': aging('mini-split-condenser', miniSplit),
    },
  }
}
