import type { DuctMaterial } from '@/shared/modules/construction/core/constants/enums'
import type { Assembly, PartMaterialDefinition } from '@/shared/modules/construction/core/types'

// Components, not layers, set in the roof-attic shell: the stress case for the model (no resolver branch).
export const HVAC_ATTIC = {
  id: 'hvac-attic',
  trades: ['hvac'],
  modes: { normal: 'thermal', summer: 'thermal', winter: 'thermal' },
  forms: ['split', 'package'],
  appliesTo: property => property.hvacType === null || property.hvacType === 'central' || property.hvacType === 'package-unit',
  parts: [
    { id: 'air-handler', group: 'equipment', role: 'equipment', forms: ['split'], materials: {
      'furnace-coil': { copy: { label: 'Furnace and coil', detail: 'Heats and cools the air the ducts carry.' }, conditionCopy: { worn: { label: 'Aging furnace and coil', detail: 'Older equipment burns more for the same comfort.' } }, energyRank: 0 },
      'high-efficiency': { copy: { label: 'High-efficiency air handler', detail: 'Uses less energy to move and condition air.' }, energyRank: 1 },
    } },
    { id: 'duct-runs', group: 'ducts', role: 'seal', materials: {
      'original-flex': { copy: { label: 'Original ducts', detail: 'Crushed and leaking runs that dump cooled air into the hot attic.' }, thermal: { rValue: 4 }, energyRank: 0 },
      'r6-silver-flex': { copy: { label: 'R-6 insulated ducts', detail: 'New runs sealed at every joint and wrapped to the R-6 the code asks for.' }, thermal: { rValue: 6 }, energyRank: 1, cut: 'ducts' },
      'r8-flex': { copy: { label: 'R-8 insulated ducts', detail: 'New runs sealed at every joint and wrapped in a thicker R-8 jacket against the attic heat.' }, thermal: { rValue: 8 }, energyRank: 2, cut: 'ducts' },
    } satisfies Record<DuctMaterial, PartMaterialDefinition> },
    { id: 'refrigerant-lines', group: 'equipment', role: 'equipment', forms: ['split'], materials: { copper: { copy: { label: 'Refrigerant lines', detail: 'Carry refrigerant between the coil and the condenser.' } } } },
    { id: 'condenser', group: 'equipment', role: 'equipment', forms: ['split'], materials: {
      'standard-seer': { copy: { label: 'Condenser', detail: 'The outdoor unit.' }, conditionCopy: { worn: { label: 'Aging condenser', detail: 'An older, lower-efficiency outdoor unit.' } }, energyRank: 0 },
      'high-seer': { copy: { label: 'High-efficiency condenser', detail: 'A high-SEER outdoor unit that uses less energy to cool.' }, energyRank: 1 },
    } },
    { id: 'package-unit', group: 'equipment', role: 'equipment', forms: ['package'], materials: {
      'standard-package': { copy: { label: 'Package unit', detail: 'One outdoor unit on the roof that heats and cools.' }, conditionCopy: { worn: { label: 'Aging package unit', detail: 'An older, lower-efficiency unit that burns more for the same comfort.' } }, energyRank: 0 },
      'high-efficiency-package': { copy: { label: 'High-efficiency package unit', detail: 'One roof unit that heats and cools on less energy.' }, energyRank: 1 },
    } },
  ],
} as const satisfies Assembly
