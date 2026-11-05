import type { SystemPart } from '@/features/trade-scenes/types'
import type { ResolvedPart } from '@/shared/modules/construction/core/types'

const doublePane = (part: ResolvedPart) => part.material === 'double-pane'
const newDoublePane = (part: ResolvedPart) => doublePane(part) && part.condition === 'installed'
// Argon and the Low-E coating come with the new window; the home's own double-pane is drawn with a plain air gap.
const oldDoublePane = (part: ResolvedPart) => doublePane(part) && (part.condition === 'retained' || part.condition === 'worn')

// In step order within each system: the order a stepped cutaway opens them.
export const SYSTEM_PARTS = [
  { id: 'covering', assembly: 'roof-attic', part: 'covering', systems: ['roof'] },
  { id: 'underlayment', assembly: 'roof-attic', part: 'underlayment', systems: ['roof'] },
  { id: 'ice-and-water', assembly: 'roof-attic', part: 'ice-and-water', systems: ['roof'] },
  { id: 'drip-edge', assembly: 'roof-attic', part: 'drip-edge', systems: ['roof'] },
  { id: 'deck', assembly: 'roof-attic', part: 'deck', systems: ['roof'] },
  { id: 'rafters', assembly: 'roof-attic', part: 'rafters', systems: ['roof'] },
  { id: 'ridge-vent', assembly: 'roof-attic', part: 'ridge-vent', systems: ['roof'] },
  { id: 'gutter', assembly: 'roof-attic', part: 'gutter', systems: ['roof'] },

  { id: 'radiant-barrier', assembly: 'roof-attic', part: 'radiant-barrier', systems: ['attic'] },
  { id: 'attic-fan', assembly: 'roof-attic', part: 'attic-fan', systems: ['attic'] },
  { id: 'air-sealing', assembly: 'roof-attic', part: 'air-sealing', systems: ['attic'] },
  { id: 'attic-insulation', assembly: 'roof-attic', part: 'attic-insulation', systems: ['attic'] },

  // The roof lights it where a leak comes through; the attic where its gaps let air through.
  { id: 'ceiling', assembly: 'roof-attic', part: 'ceiling', systems: ['roof', 'attic'], story: { roof: 'leak', attic: 'air-gaps' } },

  { id: 'frame', assembly: 'windows', part: 'frame', systems: ['windows'] },
  { id: 'glazing', assembly: 'windows', part: 'glazing', systems: ['windows'] },
  { id: 'pane', assembly: 'windows', part: 'glazing', systems: ['windows'], drawnFor: part => part.material === 'single-pane' },
  { id: 'outer-pane', assembly: 'windows', part: 'glazing', systems: ['windows'], drawnFor: doublePane },
  { id: 'low-e', assembly: 'windows', part: 'glazing', systems: ['windows'], drawnFor: newDoublePane },
  { id: 'argon', assembly: 'windows', part: 'glazing', systems: ['windows'], drawnFor: newDoublePane },
  { id: 'air-gap', assembly: 'windows', part: 'glazing', systems: ['windows'], drawnFor: oldDoublePane },
  { id: 'inner-pane', assembly: 'windows', part: 'glazing', systems: ['windows'], drawnFor: doublePane },
  { id: 'seals', assembly: 'windows', part: 'frame', systems: ['windows'] },
  { id: 'flashing', assembly: 'windows', part: 'frame', systems: ['windows'] },

  { id: 'duct-runs', assembly: 'hvac-attic', part: 'duct-runs', systems: ['heating-cooling'] },
  { id: 'air-handler', assembly: 'hvac-attic', part: 'air-handler', systems: ['heating-cooling'] },
  { id: 'refrigerant-lines', assembly: 'hvac-attic', part: 'refrigerant-lines', systems: ['heating-cooling'] },
  { id: 'condenser', assembly: 'hvac-attic', part: 'condenser', systems: ['heating-cooling'] },
  { id: 'package-unit', assembly: 'hvac-attic', part: 'package-unit', systems: ['heating-cooling'] },
  { id: 'jacket', assembly: 'hvac-attic', part: 'duct-runs', systems: ['heating-cooling'] },
  { id: 'blanket', assembly: 'hvac-attic', part: 'duct-runs', systems: ['heating-cooling'] },
  { id: 'core', assembly: 'hvac-attic', part: 'duct-runs', systems: ['heating-cooling'] },

  { id: 'drywall', assembly: 'exterior-wall', part: 'drywall', systems: ['walls'] },
  { id: 'studs', assembly: 'exterior-wall', part: 'studs', systems: ['walls'] },
  { id: 'cavity-insulation', assembly: 'exterior-wall', part: 'cavity-insulation', systems: ['walls'] },
  { id: 'sheathing', assembly: 'exterior-wall', part: 'sheathing', systems: ['walls'] },
  { id: 'weather-barrier', assembly: 'exterior-wall', part: 'weather-barrier', systems: ['walls'] },
  { id: 'lath', assembly: 'exterior-wall', part: 'lath', systems: ['walls'] },
  { id: 'scratch-coat', assembly: 'exterior-wall', part: 'scratch-coat', systems: ['walls'] },
  { id: 'brown-coat', assembly: 'exterior-wall', part: 'brown-coat', systems: ['walls'] },
  { id: 'finish', assembly: 'exterior-wall', part: 'finish', systems: ['walls'] },
  { id: 'paint', assembly: 'exterior-wall', part: 'paint', systems: ['walls'] },

  { id: 'subfloor', assembly: 'crawl-space', part: 'subfloor', systems: ['foundation'] },
  { id: 'floor-insulation', assembly: 'crawl-space', part: 'floor-insulation', systems: ['foundation'] },
  { id: 'floor-joists', assembly: 'crawl-space', part: 'floor-joists', systems: ['foundation'] },
  { id: 'foundation-vents', assembly: 'crawl-space', part: 'foundation-vents', systems: ['foundation'] },
  { id: 'vapor-barrier', assembly: 'crawl-space', part: 'vapor-barrier', systems: ['foundation'] },
  { id: 'soil', assembly: 'crawl-space', part: 'soil', systems: ['foundation'] },
] as const satisfies readonly SystemPart<string>[]
