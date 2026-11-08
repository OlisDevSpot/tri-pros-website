import type { HomeMaterialId } from '@/shared/modules/construction/core/constants/home-material-ids'
import type { HomeMaterialDefinition, HomeMaterialFacts } from '@/shared/modules/construction/core/types'

import { INSULATION_BY_ERA } from '@/shared/modules/construction/core/constants/era-defaults'

export const HOME_MATERIALS: Record<HomeMaterialId, HomeMaterialDefinition> = {
  'roof': {
    trade: 'roof-and-gutters',
    repairs: true,
    parts: ['covering', 'deck', 'gutter', 'drip-edge', 'underlayment'].map(part => ({ assembly: 'roof-attic' as const, part })),
    repairsEndWith: [{ assembly: 'roof-attic', part: 'covering' }],
    bands: { shingle: [5, 10, 15, 20], tile: [10, 20, 28, 35], woodshake: [5, 12, 18, 25], flat: [4, 8, 12, 18], metal: [10, 25, 40, 50] },
    replaceable: null,
    eraGuess: null,
  },
  'attic-insulation': {
    trade: 'attic-and-basement',
    repairs: false,
    parts: [{ assembly: 'roof-attic', part: 'attic-insulation' }],
    repairsEndWith: [],
    bands: { all: [5, 15, 25, 35] },
    replaceable: 'insulationLevel',
    eraGuess: INSULATION_BY_ERA,
  },
  'windows': {
    trade: 'windows-and-doors',
    repairs: true,
    parts: [{ assembly: 'windows', part: 'frame' }, { assembly: 'windows', part: 'glazing' }],
    repairsEndWith: [{ assembly: 'windows', part: 'frame' }, { assembly: 'windows', part: 'glazing' }],
    bands: { all: [5, 12, 20, 30] },
    replaceable: 'windowsType',
    eraGuess: { 'Pre-1950': 'single', '1950-1978': 'single', '1978-1998': 'single', '1998-2014': 'double', 'Post-2014': 'double' },
  },
  'exterior-paint': {
    trade: 'exterior-paint-stucco-and-siding',
    repairs: true,
    parts: [{ assembly: 'exterior-wall', part: 'paint' }],
    repairsEndWith: [{ assembly: 'exterior-wall', part: 'paint' }],
    bands: { all: [3, 6, 10, 15] },
    replaceable: 'exteriorPaint',
    eraGuess: { 'Pre-1950': 'regular', '1950-1978': 'regular', '1978-1998': 'regular', '1998-2014': 'regular', 'Post-2014': 'regular' },
  },
  'heating-cooling': {
    trade: 'hvac',
    repairs: true,
    parts: ['air-handler', 'refrigerant-lines', 'condenser', 'package-unit'].map(part => ({ assembly: 'hvac-attic' as const, part })),
    repairsEndWith: ['air-handler', 'refrigerant-lines', 'condenser', 'package-unit'].map(part => ({ assembly: 'hvac-attic' as const, part })),
    bands: { all: [3, 8, 12, 15] },
    replaceable: null,
    eraGuess: null,
    // A wall unit still has a row.
    appliesTo: () => true,
  },
  'ducts': {
    trade: 'hvac',
    repairs: false,
    parts: [{ assembly: 'hvac-attic', part: 'duct-runs' }],
    repairsEndWith: [],
    bands: { all: [5, 10, 15, 20] },
    replaceable: 'ducts',
    eraGuess: { 'Pre-1950': 'original-flex', '1950-1978': 'original-flex', '1978-1998': 'original-flex', '1998-2014': 'original-flex', 'Post-2014': 'r6-silver-flex' },
  },
  'crawl-insulation': {
    trade: 'foundation-and-crawl-space',
    repairs: false,
    parts: [{ assembly: 'crawl-space', part: 'floor-insulation' }],
    repairsEndWith: [],
    bands: { all: [5, 10, 15, 25] },
    replaceable: 'crawlInsulation',
    eraGuess: { 'Pre-1950': 'none', '1950-1978': 'none', '1978-1998': 'none', '1998-2014': 'none', 'Post-2014': 'insulated' },
  },
}

export const HOME_MATERIAL_FACTS_UNSET: HomeMaterialFacts = { wear: {}, gutters: null, exteriorPaint: null, ducts: null, crawlInsulation: null, acTons: null, shingleColor: null, paintWear: {}, existingPaintColors: { body: null, trim: null }, proposedPaintColors: { body: null, trim: null, combo: null }, windowFrameColor: 'white' }
