import type { ScopeInstall } from '@/shared/modules/construction/core/types'

import { SCOPE_IDS } from '@/shared/modules/construction/core/constants/scope-ids'

const SHINGLE_ROOF = [
  { part: 'covering', material: 'shingle', swapsWith: { 'cool-roof': 'cool-shingle' } },
  { part: 'underlayment', material: 'synthetic' },
  { part: 'ice-and-water', material: 'membrane' },
  { part: 'drip-edge', material: 'metal' },
  { part: 'ridge-vent', material: 'vent' },
] as const

// Tile has no cool version on offer, so a tile reset never swaps.
const TILE_ROOF = [
  { part: 'covering', material: 'tile' },
  { part: 'underlayment', material: 'synthetic' },
  { part: 'ice-and-water', material: 'membrane' },
  { part: 'drip-edge', material: 'metal' },
] as const

export const SCOPE_INSTALLS: Partial<Record<string, ScopeInstall>> = {
  [SCOPE_IDS.roofOverlay]: { assembly: 'roof-attic', trade: 'roof-and-gutters', installs: [{ part: 'covering', material: 'shingle', swapsWith: { 'cool-roof': 'cool-shingle' } }] },
  [SCOPE_IDS.roofTorchDown]: { assembly: 'roof-attic', trade: 'roof-and-gutters', installs: [{ part: 'covering', material: 'membrane', swapsWith: { 'cool-roof': 'cool-membrane' } }] },
  [SCOPE_IDS.roofTearOff]: { assembly: 'roof-attic', trade: 'roof-and-gutters', installs: SHINGLE_ROOF },
  [SCOPE_IDS.roofRedeck]: { assembly: 'roof-attic', trade: 'roof-and-gutters', installs: [{ part: 'deck', material: 'plywood' }] },
  [SCOPE_IDS.roofTileReset]: { assembly: 'roof-attic', trade: 'roof-and-gutters', installs: TILE_ROOF },
  [SCOPE_IDS.gutters]: { assembly: 'roof-attic', trade: 'roof-and-gutters', installs: [{ part: 'gutter', material: 'aluminum' }] },
  [SCOPE_IDS.airSealing]: { assembly: 'roof-attic', trade: 'attic-and-basement', installs: [{ part: 'air-sealing', material: 'sealed' }] },
  [SCOPE_IDS.atticInsulationReplacement]: { assembly: 'roof-attic', trade: 'attic-and-basement', installs: [{ part: 'attic-insulation', material: 'blown-r38' }] },
  [SCOPE_IDS.atticInsulationTopOff]: { assembly: 'roof-attic', trade: 'attic-and-basement', installs: [{ part: 'attic-insulation', material: 'blown-r38' }] },
  [SCOPE_IDS.radiantBarrier]: { assembly: 'roof-attic', trade: 'attic-and-basement', installs: [{ part: 'radiant-barrier', material: 'foil' }] },
  [SCOPE_IDS.atticFan]: { assembly: 'roof-attic', trade: 'attic-and-basement', installs: [{ part: 'attic-fan', material: 'thermostat-fan' }] },
  // The glazing comes first: a scope is filed under its first install's part.
  [SCOPE_IDS.windowReplacement]: { assembly: 'windows', trade: 'windows-and-doors', installs: [{ part: 'glazing', material: 'double-pane' }, { part: 'frame', material: 'vinyl-frame' }] },
  [SCOPE_IDS.coolLifeRepaint]: { assembly: 'exterior-wall', trade: 'exterior-paint-stucco-and-siding', installs: [{ part: 'paint', material: 'cool' }] },
  // A full system, so a furnace-only home gains a condenser.
  [SCOPE_IDS.splitSystemReplacement]: { assembly: 'hvac-attic', trade: 'hvac', installs: [{ part: 'air-handler', material: 'high-efficiency' }, { part: 'condenser', material: 'high-seer' }, { part: 'refrigerant-lines', material: 'copper' }] },
  [SCOPE_IDS.packageUnitReplacement]: { assembly: 'hvac-attic', trade: 'hvac', installs: [{ part: 'package-unit', material: 'high-efficiency-package' }] },
  [SCOPE_IDS.airDuctsReplacement]: { assembly: 'hvac-attic', trade: 'hvac', installs: [{ part: 'duct-runs', material: 'r6-silver-flex', swapsWith: { 'r8-ducts': 'r8-flex' } }] },
  [SCOPE_IDS.crawlSpaceInsulation]: { assembly: 'crawl-space', trade: 'foundation-and-crawl-space', installs: [{ part: 'floor-insulation', material: 'batts-r19' }] },
}
