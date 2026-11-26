import type { DuctMaterial } from '@/shared/modules/construction/core/constants/enums'
import type { Assembly, PartMaterialDefinition } from '@/shared/modules/construction/core/types'

// A home's own run was never hung by Tri Pros, so only the build says how it hangs.
const HUNG_DUCTS = 'Hung from the rafters on straps, clear of the insulation: no run crushed or kinked, so air reaches every room, and supported the way code requires.'
const R6_DUCTS = { label: 'R-6 insulated ducts', detail: 'New runs sealed at every joint and wrapped to the R-6 the code asks for.' }
const R8_DUCTS = { label: 'R-8 insulated ducts', detail: 'New runs sealed at every joint and wrapped in a thicker R-8 jacket against the attic heat.' }

// Components, not layers, set in the roof-attic shell: the stress case for the model (no resolver branch).
export const HVAC_ATTIC = {
  id: 'hvac-attic',
  trades: ['hvac'],
  modes: { normal: 'thermal', summer: 'thermal', winter: 'thermal' },
  forms: ['split', 'package'],
  parts: [
    { id: 'registers', group: 'ducts', role: 'equipment', materials: { grille: { copy: { label: 'Registers', detail: 'Where the air comes into each room.' } } } },
    { id: 'return', group: 'ducts', role: 'equipment', forms: ['split'], materials: { 'return-grille': { copy: { label: 'Return', detail: 'The big grille where the blower pulls the room air back into the system.' } } } },
    { id: 'blower', group: 'equipment', role: 'equipment', forms: ['split'], materials: {
      'standard-blower': { copy: { label: 'Blower', detail: 'The fan that pushes the air through the furnace, the coil and the ducts.' }, conditionCopy: { worn: { label: 'Aging blower', detail: 'An older blower moves less air for the same electricity.' } } },
      'new-blower': { copy: { label: 'New blower', detail: 'Pushes the air through the furnace, the coil and the ducts.' } },
    } },
    { id: 'furnace', group: 'equipment', role: 'equipment', forms: ['split'], noCutWhereNone: true, materials: {
      'standard-furnace': { copy: { label: 'Furnace', detail: 'Burns gas to heat the air in winter.' }, conditionCopy: { worn: { label: 'Aging furnace', detail: 'An older furnace burns more gas for the same heat.' } }, energyRank: 0, bills: ['gas'] },
      'high-efficiency-furnace': { copy: { label: 'High-efficiency furnace', detail: 'Heats the air on less gas.' }, energyRank: 1, bills: ['gas'] },
      'removed': { copy: { label: 'Furnace taken out', detail: 'The heat pump heats the home, so the gas furnace, its flue and its gas line come out.' }, removes: true },
    } },
    { id: 'coil', group: 'equipment', role: 'equipment', forms: ['split'], noCutWhereNone: true, materials: {
      'standard-coil': { copy: { label: 'Evaporator coil', detail: 'Cools the air in summer, working with the condenser outside.' }, conditionCopy: { worn: { label: 'Aging coil', detail: 'An older coil cools less for the same electricity.' } }, energyRank: 0, bills: ['electric'] },
      'high-efficiency-coil': { copy: { label: 'High-efficiency coil', detail: 'Matched to the new condenser to cool on less electricity.' }, energyRank: 1, bills: ['electric'] },
    } },
    { id: 'plenum', group: 'equipment', role: 'equipment', forms: ['split'], materials: { 'sheet-metal': { copy: { label: 'Plenum', detail: 'The box the ducts leave from, carrying the air to every room.' } } } },
    { id: 'duct-runs', group: 'ducts', role: 'seal', noCutWhereNone: true, materials: {
      'original-flex': { copy: { label: 'Original ducts', detail: 'Crushed and leaking runs that dump cooled air into the hot attic.' }, thermal: { rValue: 4 }, energyRank: 0 },
      'r6-silver-flex': { copy: R6_DUCTS, conditionCopy: { installed: { ...R6_DUCTS, detail: `${R6_DUCTS.detail} ${HUNG_DUCTS}` } }, thermal: { rValue: 6 }, energyRank: 1, cut: 'ducts' },
      'r8-flex': { copy: R8_DUCTS, conditionCopy: { installed: { ...R8_DUCTS, detail: `${R8_DUCTS.detail} ${HUNG_DUCTS}` } }, thermal: { rValue: 8 }, energyRank: 2, cut: 'ducts' },
    } satisfies Record<DuctMaterial, PartMaterialDefinition> },
    { id: 'thermostat', group: 'equipment', role: 'equipment', materials: { thermostat: { copy: { label: 'Thermostat', detail: 'Tells the system when to heat and when to cool.' } } } },
    { id: 'refrigerant-lines', group: 'equipment', role: 'equipment', forms: ['split'], materials: { copper: { copy: { label: 'Refrigerant lines', detail: 'Carry refrigerant between the coil and the condenser.' } } } },
    { id: 'condenser', group: 'equipment', role: 'equipment', forms: ['split'], noCutWhereNone: true, materials: {
      'standard-seer': { copy: { label: 'Condenser', detail: 'The outdoor unit.' }, conditionCopy: { worn: { label: 'Aging condenser', detail: 'An older, lower-efficiency outdoor unit.' } }, energyRank: 0, bills: ['electric'] },
      'high-seer': { copy: { label: 'High-efficiency condenser', detail: 'A high-SEER outdoor unit that uses less energy to cool.' }, energyRank: 1, bills: ['electric'] },
      // Its cut is its cooling's, on electric: its heating trades gas for electricity at about even, so it earns nothing on gas.
      'heat-pump': { copy: { label: 'Heat pump outdoor unit', detail: 'Heats and cools: the same refrigerant loop as air conditioning, run either way.' }, energyRank: 1, bills: ['electric'] },
    } },
    { id: 'package-unit', group: 'equipment', role: 'equipment', forms: ['package'], materials: {
      'standard-package': { copy: { label: 'Package unit', detail: 'One outdoor unit on the roof that heats and cools.' }, conditionCopy: { worn: { label: 'Aging package unit', detail: 'An older, lower-efficiency unit that burns more for the same comfort.' } }, energyRank: 0 },
      'high-efficiency-package': { copy: { label: 'High-efficiency package unit', detail: 'One roof unit that heats and cools on less energy.' }, energyRank: 1 },
    } },
    { id: 'mini-split-heads', group: 'equipment', role: 'equipment', materials: { 'wall-head': { copy: { label: 'Mini-split heads', detail: 'A unit high on the wall that heats and cools its room on its own.' } } } },
    { id: 'mini-split-outdoor', group: 'equipment', role: 'equipment', materials: { 'mini-split-condenser': { copy: { label: 'Mini-split outdoor unit', detail: 'One outdoor unit serves every head.' } } } },
  ],
} as const satisfies Assembly
