import type { SystemPart } from '@/features/trade-scenes/types'
import type { ResolvedPart } from '@/shared/modules/construction/core/types'

const doublePane = (part: ResolvedPart) => part.material === 'double-pane'
export const newDoublePane = (part: ResolvedPart) => doublePane(part) && part.condition === 'installed'
// Argon and the Low-E coating come with the new window; the home's own double-pane is drawn with a plain air gap.
const oldDoublePane = (part: ResolvedPart) => doublePane(part) && (part.condition === 'retained' || part.condition === 'worn')
const stuccoFinish = (part: ResolvedPart) => part.material === 'stucco-finish'

// Each system's parts inside out; the stepped cutaway reads the roof's and the attic's reversed, outermost first.
export const SYSTEM_PARTS = [
  // The roof lights it where a leak comes through; the attic where its gaps let air through.
  { id: 'ceiling', assembly: 'roof-attic', part: 'ceiling', systems: ['roof', 'attic'], story: { roof: 'leak', attic: 'air-gaps' } },

  { id: 'rafters', assembly: 'roof-attic', part: 'rafters', systems: ['roof'] },
  { id: 'deck', assembly: 'roof-attic', part: 'deck', systems: ['roof'] },
  { id: 'drip-edge', assembly: 'roof-attic', part: 'drip-edge', systems: ['roof'] },
  { id: 'ice-and-water', assembly: 'roof-attic', part: 'ice-and-water', systems: ['roof'] },
  { id: 'underlayment', assembly: 'roof-attic', part: 'underlayment', systems: ['roof'] },
  { id: 'covering', assembly: 'roof-attic', part: 'covering', systems: ['roof'] },
  { id: 'ridge-vent', assembly: 'roof-attic', part: 'ridge-vent', systems: ['roof'] },
  { id: 'gutter', assembly: 'roof-attic', part: 'gutter', systems: ['roof'] },

  { id: 'air-sealing', assembly: 'roof-attic', part: 'air-sealing', systems: ['attic'] },
  // Under a flat roof the joists are the roof's rafters, so they have no row of their own.
  { id: 'ceiling-joists', assembly: 'roof-attic', part: 'ceiling', systems: ['attic'], roofForms: ['pitched'] },
  { id: 'attic-insulation', assembly: 'roof-attic', part: 'attic-insulation', systems: ['attic'] },
  { id: 'radiant-barrier', assembly: 'roof-attic', part: 'radiant-barrier', systems: ['attic'] },
  { id: 'attic-fan', assembly: 'roof-attic', part: 'attic-fan', systems: ['attic'] },

  { id: 'flashing', assembly: 'windows', part: 'frame', systems: ['windows'] },
  { id: 'frame', assembly: 'windows', part: 'frame', systems: ['windows'] },
  { id: 'seals', assembly: 'windows', part: 'frame', systems: ['windows'] },
  { id: 'pane', assembly: 'windows', part: 'glazing', systems: ['windows'], drawnFor: part => part.material === 'single-pane' },
  { id: 'inner-pane', assembly: 'windows', part: 'glazing', systems: ['windows'], drawnFor: doublePane },
  { id: 'argon', assembly: 'windows', part: 'glazing', systems: ['windows'], drawnFor: newDoublePane },
  { id: 'air-gap', assembly: 'windows', part: 'glazing', systems: ['windows'], drawnFor: oldDoublePane },
  { id: 'low-e', assembly: 'windows', part: 'glazing', systems: ['windows'], drawnFor: newDoublePane },
  { id: 'outer-pane', assembly: 'windows', part: 'glazing', systems: ['windows'], drawnFor: doublePane },
  { id: 'screen', assembly: 'windows', part: 'glazing', systems: ['windows'], drawnFor: newDoublePane },
  { id: 'glazing', assembly: 'windows', part: 'glazing', systems: ['windows'], listed: false },

  { id: 'duct-runs', assembly: 'hvac-attic', part: 'duct-runs', systems: ['heating-cooling'] },
  { id: 'air-handler', assembly: 'hvac-attic', part: 'air-handler', systems: ['heating-cooling'] },
  { id: 'refrigerant-lines', assembly: 'hvac-attic', part: 'refrigerant-lines', systems: ['heating-cooling'] },
  { id: 'condenser', assembly: 'hvac-attic', part: 'condenser', systems: ['heating-cooling'] },
  { id: 'package-unit', assembly: 'hvac-attic', part: 'package-unit', systems: ['heating-cooling'] },
  { id: 'jacket', assembly: 'hvac-attic', part: 'duct-runs', systems: ['heating-cooling'] },
  { id: 'blanket', assembly: 'hvac-attic', part: 'duct-runs', systems: ['heating-cooling'] },
  { id: 'core', assembly: 'hvac-attic', part: 'duct-runs', systems: ['heating-cooling'] },

  // The wall's construction parts stay whole entries, so the wall's lanes still see them, but the card lists only what the
  // house draws of the wall: its stucco or siding, its eaves and trim, and its paint.
  { id: 'drywall', assembly: 'exterior-wall', part: 'drywall', systems: ['walls'], listed: false },
  { id: 'studs', assembly: 'exterior-wall', part: 'studs', systems: ['walls'], listed: false },
  { id: 'cavity-insulation', assembly: 'exterior-wall', part: 'cavity-insulation', systems: ['walls'], listed: false },
  { id: 'sheathing', assembly: 'exterior-wall', part: 'sheathing', systems: ['walls'], listed: false },
  { id: 'weather-barrier', assembly: 'exterior-wall', part: 'weather-barrier', systems: ['walls'], listed: false },
  { id: 'lath', assembly: 'exterior-wall', part: 'lath', systems: ['walls'], listed: false },
  { id: 'scratch-coat', assembly: 'exterior-wall', part: 'scratch-coat', systems: ['walls'], listed: false },
  { id: 'brown-coat', assembly: 'exterior-wall', part: 'brown-coat', systems: ['walls'], listed: false },
  { id: 'finish', assembly: 'exterior-wall', part: 'finish', systems: ['walls'], drawnFor: stuccoFinish, listed: false },
  // The wall's finish is its stucco finish coat, or the siding a siding home wears in its place.
  { id: 'stucco', assembly: 'exterior-wall', part: 'finish', systems: ['walls'], drawnFor: stuccoFinish },
  { id: 'siding', assembly: 'exterior-wall', part: 'finish', systems: ['walls'], drawnFor: part => part.material === 'siding' },
  // The house has no trim part of its own: its trim is painted with the walls, so it reads New with a paint job.
  { id: 'eaves-trim', assembly: 'exterior-wall', part: 'paint', systems: ['walls'] },
  { id: 'paint', assembly: 'exterior-wall', part: 'paint', systems: ['walls'] },

  { id: 'subfloor', assembly: 'crawl-space', part: 'subfloor', systems: ['foundation'] },
  { id: 'floor-insulation', assembly: 'crawl-space', part: 'floor-insulation', systems: ['foundation'] },
  { id: 'floor-joists', assembly: 'crawl-space', part: 'floor-joists', systems: ['foundation'] },
  { id: 'foundation-vents', assembly: 'crawl-space', part: 'foundation-vents', systems: ['foundation'] },
  { id: 'vapor-barrier', assembly: 'crawl-space', part: 'vapor-barrier', systems: ['foundation'] },
  { id: 'soil', assembly: 'crawl-space', part: 'soil', systems: ['foundation'] },
] as const satisfies readonly SystemPart<string>[]
