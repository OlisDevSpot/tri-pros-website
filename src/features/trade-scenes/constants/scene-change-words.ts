import type { HomeSystemId, SceneChangeSlotId, SystemPartId } from '@/features/trade-scenes/types'
import type { HomeMaterialId } from '@/shared/modules/construction/core/constants/home-material-ids'

import { HOME_SYSTEMS } from '@/features/trade-scenes/constants/home-systems'
import { HOME_MATERIAL_IDS } from '@/shared/modules/construction/core/constants/home-material-ids'

export const SCENE_CHANGE_RESULTS_MAX = 8

// The words name the thing, never a material's values: those live in the slot's options, so "tile" finds the roof and not
// every roof upgrade.
const MATERIAL_WORDS = {
  'roof': 'roof roofing',
  'attic-insulation': 'attic insulation batts',
  'windows': 'window windows glass',
  'exterior-paint': 'paint walls exterior stucco',
  'heating-cooling': 'hvac ac air conditioner heating cooling system furnace',
  'ducts': 'duct ducts ductwork',
  'crawl-insulation': 'crawl space foundation floor',
} as const satisfies Record<HomeMaterialId, string>

const SYSTEM_WORDS = {
  'roof': `${MATERIAL_WORDS.roof} gutter gutters redeck`,
  'attic': `${MATERIAL_WORDS['attic-insulation']} fan radiant barrier sealing`,
  'windows': MATERIAL_WORDS.windows,
  'walls': MATERIAL_WORDS['exterior-paint'],
  'heating-cooling': `${MATERIAL_WORDS['heating-cooling']} ${MATERIAL_WORDS.ducts}`,
  'foundation': 'foundation crawl space floor',
} as const satisfies Record<HomeSystemId, string>

// What each build row adds, in the words a rep would type for it.
const BUILD_WORDS = {
  'covering': 'new roof',
  'deck': 'redeck',
  'gutter': 'gutters',
  'radiant-barrier': 'radiant barrier',
  'attic-insulation': 'insulation',
  'air-sealing': 'air sealing',
  'attic-fan': 'attic fan',
  'glazing': 'new windows',
  'paint': 'cool life repaint',
  'air-handler': 'new system',
  'package-unit': 'new system',
  'duct-runs': 'new ducts',
  'floor-insulation': 'crawl insulation',
} as const satisfies Record<SystemPartId, string>

// Object.fromEntries widens its keys to string; each list below holds every id of its kind.
const WEAR_WORDS = Object.fromEntries(HOME_MATERIAL_IDS.map(id => [`wear:${id}`, `${MATERIAL_WORDS[id]} condition wear`])) as Record<`wear:${HomeMaterialId}`, string>
const BUILD_ROW_WORDS = Object.fromEntries(HOME_SYSTEMS.flatMap(({ id, rows }) => rows.map(({ part }) => [`build:${part}`, `${SYSTEM_WORDS[id]} ${BUILD_WORDS[part]} upgrade`]))) as Record<`build:${SystemPartId}`, string>

export const SCENE_CHANGE_WORDS = {
  'household': 'household family couple single relatives',
  'age-group': 'age group old seniors',
  'foundation': 'foundation raised slab crawl',
  'roof-form': 'roof form pitched flat low slope',
  'year-built': 'year built era code age when',
  ...MATERIAL_WORDS,
  'gutters': 'gutter gutters roof',
  'hvac-components': `equipment ${MATERIAL_WORDS['heating-cooling']}`,
  'ac-tons': `ac size ton tons tonnage ${MATERIAL_WORDS['heating-cooling']}`,
  ...WEAR_WORDS,
  ...BUILD_ROW_WORDS,
  'upgrade:cool-roof': `${SYSTEM_WORDS.roof} cool roof`,
  'upgrade:r8-ducts': `${SYSTEM_WORDS['heating-cooling']} step up to r-8`,
  'climate': 'climate coastal inland area bills',
  'bill:electric': 'electric electricity bill bills power',
  'bill:gas': 'gas bill bills',
} as const satisfies Record<SceneChangeSlotId, string>
