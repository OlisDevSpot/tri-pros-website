import type { BuildRowPartId, HomeSpotId, HomeSystemId } from '@/features/trade-scenes/types'
import type { AssemblyId } from '@/shared/modules/construction/core/constants/assembly-ids'

export const HOME_SYSTEM_IDS = ['roof', 'attic', 'windows', 'walls', 'heating-cooling', 'foundation'] as const

export const BUILD_ROW_PART_IDS = ['covering', 'deck', 'gutter', 'radiant-barrier', 'attic-insulation', 'air-sealing', 'attic-fan', 'glazing', 'paint', 'air-handler', 'package-unit', 'duct-runs', 'floor-insulation'] as const

// A system card's build row lists these parts, grouped the way the owner names a home's systems, so a part sits under the
// system a rep would look for it in.
export const HOME_SYSTEMS: readonly { id: HomeSystemId, rows: readonly { assembly: AssemblyId, part: BuildRowPartId }[] }[] = [
  { id: 'roof', rows: [{ assembly: 'roof-attic', part: 'covering' }, { assembly: 'roof-attic', part: 'deck' }, { assembly: 'roof-attic', part: 'gutter' }] },
  { id: 'attic', rows: [{ assembly: 'roof-attic', part: 'radiant-barrier' }, { assembly: 'roof-attic', part: 'attic-insulation' }, { assembly: 'roof-attic', part: 'air-sealing' }, { assembly: 'roof-attic', part: 'attic-fan' }] },
  { id: 'windows', rows: [{ assembly: 'windows', part: 'glazing' }] },
  { id: 'walls', rows: [{ assembly: 'exterior-wall', part: 'paint' }] },
  { id: 'heating-cooling', rows: [{ assembly: 'hvac-attic', part: 'air-handler' }, { assembly: 'hvac-attic', part: 'package-unit' }, { assembly: 'hvac-attic', part: 'duct-runs' }] },
  { id: 'foundation', rows: [{ assembly: 'crawl-space', part: 'floor-insulation' }] },
]

// A list, not an id type of its own, so the later rename of systems to areas touches one type.
export const LOOK_INSIDE_SYSTEM_IDS = ['roof', 'attic', 'windows', 'walls', 'heating-cooling'] as const satisfies readonly HomeSystemId[]

// The systems whose parts sit under the roof, so the house opens while one is in focus.
export const HOUSE_OPENING_SYSTEM_IDS = ['attic', 'heating-cooling'] as const satisfies readonly HomeSystemId[]

// The systems whose parts stand in the front wall, which only the Complete house draws, so the house stays closed while one
// is in focus, whatever home view the rep picked: the window its Look inside opens, and the walls' whole painted skin.
export const HOUSE_CLOSING_SYSTEM_IDS = ['windows', 'walls'] as const satisfies readonly HomeSystemId[]

export const HOME_SPOT_IDS = ['roof', 'window', 'wall', 'equipment'] as const

export const SPOT_OF: Record<(typeof LOOK_INSIDE_SYSTEM_IDS)[number], HomeSpotId> = { 'roof': 'roof', 'attic': 'roof', 'windows': 'window', 'walls': 'wall', 'heating-cooling': 'equipment' }
