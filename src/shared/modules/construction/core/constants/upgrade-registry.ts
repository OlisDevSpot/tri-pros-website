import type { ScopeId } from '@/shared/modules/construction/core/constants/scope-ids'
import type { UpgradeBenefit, UpgradeEntry } from '@/shared/modules/construction/core/types'

import { SCOPE_IDS } from '@/shared/modules/construction/core/constants/scope-ids'

// Facts only: no federal credit applies, the state money is spent, and no code requires a heat pump, so none is claimed; its
// heating earns no bill cut, so no saving is claimed either.
const HEAT_PUMP_BENEFITS: readonly UpgradeBenefit[] = [
  { kind: 'looks-and-use', title: 'One outdoor unit heats and cools', detail: 'The same refrigerant loop as air conditioning, run either way, so one unit warms the home in winter and cools it in summer, on electricity.' },
  { kind: 'protection', title: 'No flame in the house', detail: 'No gas burner, flue or gas line at the indoor unit.' },
  { kind: 'looks-and-use', title: 'A rate plan for heat pump homes', detail: 'With SCE, a home heated by a heat pump can move to TOU-D-PRIME, the rate plan made for it.' },
  { kind: 'warranty', title: 'Goodman heat pump', detail: 'The maker\'s warranty, plus the Tri Pros workmanship warranty.' },
]

// `detail` may hold {material} / {rValue}, filled from the upgrade's installed material by `fillBenefitText`.
export const UPGRADE_REGISTRY: Record<ScopeId, UpgradeEntry> = {
  [SCOPE_IDS.roofTearOff]: {
    name: 'Roof tear-off',
    benefits: [
      { kind: 'easier-on-hvac', title: 'The attic starts cooler', detail: 'Less heat comes down through the ceiling, so the AC runs less.', onlyWith: 'cool-roof' },
      { kind: 'protection', title: 'No more roof leaks', detail: 'New underlayment, an ice-and-water membrane and a metal drip edge go under the new shingles and seal the roof tight.' },
      { kind: 'lasts-longer', title: 'Shingles that age slower', detail: 'A roof that stays cooler suffers less heat decay, so the shingles keep their oils longer.', onlyWith: 'cool-roof' },
      { kind: 'warranty', title: 'Owens Corning Duration COOL', detail: 'The maker\'s warranty, plus the Tri Pros workmanship warranty.', onlyWith: 'cool-roof' },
      { kind: 'warranty', title: 'New shingles', detail: 'The Tri Pros workmanship warranty.', onlyWithout: 'cool-roof' },
      { kind: 'looks-and-use', title: 'One new roof, edge to edge', detail: 'New shingles, vents, flashing and drip edge in colors that complement one another.' },
    ],
  },
  [SCOPE_IDS.roofOverlay]: {
    name: 'Roof overlay',
    benefits: [
      { kind: 'easier-on-hvac', title: 'The attic starts cooler', detail: 'Less heat comes down through the ceiling, so the AC runs less.', onlyWith: 'cool-roof' },
      { kind: 'protection', title: 'The roof sealed again', detail: 'A new layer of shingles closes the old roof against rain.' },
      { kind: 'lasts-longer', title: 'Shingles that age slower', detail: 'A roof that stays cooler suffers less heat decay, so the shingles keep their oils longer.', onlyWith: 'cool-roof' },
      { kind: 'warranty', title: 'Owens Corning Duration COOL', detail: 'The maker\'s warranty, plus the Tri Pros workmanship warranty.', onlyWith: 'cool-roof' },
      { kind: 'warranty', title: 'New shingles', detail: 'The Tri Pros workmanship warranty.', onlyWithout: 'cool-roof' },
      { kind: 'looks-and-use', title: 'One new roof, edge to edge', detail: 'New shingles, vents, flashing and drip edge in colors that complement one another.' },
    ],
  },
  [SCOPE_IDS.roofTorchDown]: {
    name: 'Torch down',
    benefits: [
      { kind: 'easier-on-hvac', title: 'The roof stays cooler', detail: 'A bright membrane turns back most of the sun, so less heat comes down and the AC runs less.', onlyWith: 'cool-roof' },
      { kind: 'protection', title: 'A sealed flat roof', detail: 'A new torch-down membrane, fused at every seam, keeps the rain out.' },
      { kind: 'lasts-longer', title: 'A membrane that ages slower', detail: 'A roof that stays cooler suffers less heat decay, so the membrane\'s asphalt keeps its oils longer.', onlyWith: 'cool-roof' },
      { kind: 'warranty', title: 'A new torch-down roof', detail: 'The Tri Pros workmanship warranty.' },
    ],
  },
  [SCOPE_IDS.roofTileReset]: {
    name: 'Tile reset',
    benefits: [
      { kind: 'protection', title: 'No more roof leaks', detail: 'Two new layers of underlayment, an ice-and-water membrane and a metal drip edge go under the reset tile.' },
      { kind: 'looks-and-use', title: 'The house keeps its tile look', detail: 'The same tile goes back on over the new layers, which saves the cost of new tile.' },
    ],
  },
  [SCOPE_IDS.roofRedeck]: {
    name: 'Redeck',
    benefits: [
      { kind: 'protection', title: 'A solid deck under the roof', detail: 'Soft or rotted plywood is replaced to code before the new roof goes on.' },
      { kind: 'lasts-longer', title: 'The roof holds its nails', detail: 'New plywood keeps the roof fastened for its whole life.' },
    ],
  },
  [SCOPE_IDS.gutters]: {
    name: 'Gutters',
    benefits: [
      { kind: 'protection', title: 'Rain kept off the walls', detail: 'New aluminum gutters carry the water away from the wood, the walls and the foundation, protecting the home from water damage.' },
      { kind: 'looks-and-use', title: 'Straight, clean gutter lines', detail: 'New gutters along every eave, in a choice of styles and colors.' },
    ],
  },
  [SCOPE_IDS.atticInsulationReplacement]: {
    name: 'Attic insulation (replacement)',
    benefits: [
      { kind: 'easier-on-hvac', title: 'Rooms hold their temperature', detail: 'New {material} keeps the heat above the ceiling in summer and in the rooms in winter. The HVAC runs less and lasts longer.' },
    ],
  },
  [SCOPE_IDS.atticInsulationTopOff]: {
    name: 'Attic insulation (top-off)',
    benefits: [
      { kind: 'easier-on-hvac', title: 'Rooms hold their temperature', detail: 'Insulation topped up to {rValue} keeps the heat above the ceiling in summer and in the rooms in winter. The HVAC runs less and lasts longer.' },
    ],
  },
  [SCOPE_IDS.radiantBarrier]: {
    name: 'Radiant barrier',
    benefits: [
      { kind: 'easier-on-hvac', title: 'The roof\'s heat turned back', detail: 'A foil barrier under the rafters reflects the heat before it reaches the insulation.' },
    ],
  },
  [SCOPE_IDS.airSealing]: {
    name: 'Air sealing',
    benefits: [
      { kind: 'easier-on-hvac', title: 'No attic air through the ceiling', detail: 'Every gap around the lights, the vents and the hatch is sealed.' },
      { kind: 'protection', title: 'Attic dust stays in the attic', detail: 'Sealed gaps stop the attic\'s air and dust coming down into the rooms, so the air in the home stays cleaner.' },
    ],
  },
  [SCOPE_IDS.atticFan]: {
    name: 'Attic fan',
    benefits: [
      { kind: 'easier-on-hvac', title: 'Hot attic air pushed out', detail: 'On hot days a thermostat fan pulls the heat out through the gable, cooling the attic.' },
    ],
  },
  [SCOPE_IDS.windowReplacement]: {
    name: 'Window replacement',
    benefits: [
      { kind: 'easier-on-hvac', title: 'Less heat through the glass', detail: 'Dual-pane Low-E3 glass with argon gas slows the heat both ways, summer and winter.' },
      { kind: 'protection', title: 'Drafts and rain kept out', detail: 'New vinyl frames close tight and are sealed against the wall.' },
      { kind: 'warranty', title: 'The window maker\'s warranty', detail: 'Whatever the brand: the maker\'s warranty, plus the Tri Pros workmanship warranty.' },
      { kind: 'looks-and-use', title: 'Windows that open easily', detail: 'A screen on every window, plus security features.' },
    ],
  },
  [SCOPE_IDS.coolLifeRepaint]: {
    name: 'Cool Life repaint',
    benefits: [
      { kind: 'easier-on-hvac', title: 'Walls that stay cooler', detail: 'Less of the sun\'s heat soaks through the walls into the rooms.' },
      { kind: 'protection', title: 'Cracks, stains and peeling fixed', detail: 'The walls are repaired, patched and sealed before the new paint goes on.' },
      { kind: 'protection', title: 'Walls kept from heat decay', detail: 'Reflecting the sun keeps the stucco and the framing behind it cooler, so they last much longer.' },
      { kind: 'lasts-longer', title: 'Paint that lasts longer in the sun', detail: 'A cool paint holds its color and its seal much longer, and it flexes with heat and cold, which helps prevent new cracks.' },
      { kind: 'warranty', title: 'Cool Life paint', detail: 'The maker\'s lifetime warranty, plus the Tri Pros workmanship warranty.' },
      { kind: 'looks-and-use', title: 'A fresh color on every wall', detail: 'One even coat, house and garage alike.' },
    ],
  },
  [SCOPE_IDS.waterBasedRepaint]: {
    name: 'Water-based repaint',
    benefits: [
      { kind: 'protection', title: 'Cracks, stains and peeling fixed', detail: 'The walls are repaired, patched and sealed before the new paint goes on.' },
      { kind: 'warranty', title: 'New paint', detail: 'The Tri Pros workmanship warranty.' },
      { kind: 'looks-and-use', title: 'A fresh color on every wall', detail: 'One even coat, house and garage alike.' },
    ],
  },
  [SCOPE_IDS.splitSystemReplacement]: {
    name: 'Split system replacement',
    benefits: [
      { kind: 'warranty', title: 'Goodman system', detail: 'The maker\'s warranty, plus the Tri Pros workmanship warranty.' },
      { kind: 'looks-and-use', title: 'Even heating and cooling', detail: 'A new high-efficiency system, quieter in every room.' },
      { kind: 'lasts-longer', title: 'High-quality materials', detail: 'Built to last, with plenty of parts available, so future repairs cost less.' },
    ],
  },
  [SCOPE_IDS.acReplacement]: {
    name: 'A/C replacement',
    benefits: [
      { kind: 'warranty', title: 'Goodman condenser and coil', detail: 'The maker\'s warranty, plus the Tri Pros workmanship warranty.' },
      { kind: 'looks-and-use', title: 'Steadier, quieter cooling', detail: 'A new condenser and coil, matched to each other, cool the home on less electricity.' },
      { kind: 'lasts-longer', title: 'High-quality materials', detail: 'Built to last, with plenty of parts available, so future repairs cost less.' },
    ],
  },
  [SCOPE_IDS.furnaceReplacement]: {
    name: 'Furnace replacement',
    benefits: [
      { kind: 'warranty', title: 'Goodman furnace', detail: 'The maker\'s warranty, plus the Tri Pros workmanship warranty.' },
      { kind: 'looks-and-use', title: 'Even, quiet heat', detail: 'A new furnace and blower heat the home on less gas.' },
      { kind: 'lasts-longer', title: 'High-quality materials', detail: 'Built to last, with plenty of parts available, so future repairs cost less.' },
    ],
  },
  [SCOPE_IDS.splitSystemNewCut]: {
    name: 'Split system new-cut installation',
    benefits: [
      { kind: 'warranty', title: 'Goodman system', detail: 'The maker\'s warranty, plus the Tri Pros workmanship warranty.' },
      { kind: 'looks-and-use', title: 'Heating and cooling in every room', detail: 'A whole new system, with its ducts, registers and thermostat, so every room gets heated and cooled air, not only the room with the old unit.' },
      { kind: 'lasts-longer', title: 'High-quality materials', detail: 'Built to last, with plenty of parts available, so future repairs cost less.' },
    ],
  },
  [SCOPE_IDS.heatPumpReplacement]: {
    name: 'Heat pump replacement',
    benefits: HEAT_PUMP_BENEFITS,
  },
  [SCOPE_IDS.heatPumpNewCut]: {
    name: 'Heat pump new-cut installation',
    benefits: HEAT_PUMP_BENEFITS,
  },
  [SCOPE_IDS.packageUnitReplacement]: {
    name: 'Package unit replacement',
    benefits: [
      { kind: 'warranty', title: 'Goodman package unit', detail: 'The maker\'s warranty, plus the Tri Pros workmanship warranty.' },
      { kind: 'looks-and-use', title: 'Even heating and cooling', detail: 'A new high-efficiency system, quieter in every room, that uses less and lowers the gas and electric bills.' },
      { kind: 'lasts-longer', title: 'High-quality materials', detail: 'Built to last, with plenty of parts available, so future repairs cost less.' },
    ],
  },
  [SCOPE_IDS.airDuctsReplacement]: {
    name: 'Air ducts replacement',
    benefits: [
      { kind: 'easier-on-hvac', title: 'Air arrives at the rooms cool', detail: 'New insulated ducts lose less air on the way, so the system runs more efficiently.', onlyWithout: 'r8-ducts' },
      { kind: 'easier-on-hvac', title: 'Air arrives at the rooms cool', detail: 'Having the right size of ducts makes all the difference.', onlyWith: 'r8-ducts' },
    ],
  },
  [SCOPE_IDS.miniSplitInstallation]: {
    name: 'Mini-split installation',
    benefits: [
      { kind: 'warranty', title: 'Mini-split system', detail: 'The maker\'s warranty, plus the Tri Pros workmanship warranty.' },
      { kind: 'looks-and-use', title: 'Room by room comfort', detail: 'A quiet unit high on the wall in each room, set to its own temperature, with no ducts.' },
      { kind: 'lasts-longer', title: 'High-quality materials', detail: 'Built to last, with plenty of parts available, so future repairs cost less.' },
    ],
  },
  [SCOPE_IDS.miniSplitKit]: {
    name: 'Kit: mini-split',
    benefits: [
      { kind: 'warranty', title: 'Mini-split system', detail: 'The maker\'s warranty, plus the Tri Pros workmanship warranty.' },
      { kind: 'looks-and-use', title: 'Room by room comfort', detail: 'A quiet unit high on the wall in each room, set to its own temperature, with no ducts.' },
      { kind: 'lasts-longer', title: 'High-quality materials', detail: 'Built to last, with plenty of parts available, so future repairs cost less.' },
    ],
  },
  [SCOPE_IDS.crawlSpaceInsulation]: {
    name: 'Crawl space insulation',
    benefits: [
      { kind: 'easier-on-hvac', title: 'Warmer floors in winter', detail: 'R-19 batts under the floor hold the house\'s heat, so the floors feel much nicer for the family.' },
    ],
  },
}
