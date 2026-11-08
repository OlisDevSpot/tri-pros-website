export const tradeLocations = ['exterior', 'interior', 'lot'] as const
export type TradeLocation = (typeof tradeLocations)[number]

export const constructionTypes = ['energy-efficient', 'rough-construction', 'finish-construction'] as const
export type ConstructionType = (typeof constructionTypes)[number]

export const variableDataTypes = ['text', 'select', 'number', 'boolean'] as const
export type VariableDataType = (typeof variableDataTypes)[number]

export const homeAreas = [
  'bathroom',
  'kitchen',
  'bedroom',
  'living-room',
  'dining-room',
  'front-yard',
  'back-yard',
  'side-yard',
  'garage',
  'attic',
  'basement',
  'foundation',
  'exterior-shell',
  'interior-space',
] as const
export type HomeArea = (typeof homeAreas)[number]

export const roofTypes = ['shingle', 'metal', 'flat', 'woodshake', 'tile'] as const
export type RoofType = (typeof roofTypes)[number]

export const roofLocations = ['main home', 'garage', 'adu'] as const
export type RoofLocation = (typeof roofLocations)[number]

export const hvacTypes = ['central', 'wall-mounted', 'portable', 'package-unit'] as const
export type HVACType = (typeof hvacTypes)[number]

export const hvacComponents = ['furnace', 'ac', 'both'] as const
export type HVACComponent = (typeof hvacComponents)[number]

export const windowsTypes = ['single', 'double'] as const
export type WindowsType = (typeof windowsTypes)[number]

// Some homes have no attic insulation at all, so none is a level the rep can record.
export const insulationLevels = ['none', 'r11', 'r19', 'r30', 'r38'] as const
export type InsulationLevel = (typeof insulationLevels)[number]
export const INSULATION_LEVEL_LABELS = { none: 'None', r11: '3.5 in. (R-11)', r19: '6 in. (R-19)', r30: '10 in. (R-30)', r38: '12 in. (R-38)' } as const satisfies Record<InsulationLevel, string>

export const foundationTypes = ['raised', 'slab'] as const
export type FoundationType = (typeof foundationTypes)[number]

export const wears = ['new', 'good', 'fair', 'worn', 'failing'] as const
export type Wear = (typeof wears)[number]

export const gutterOptions = ['present', 'none'] as const
export type GutterOption = (typeof gutterOptions)[number]

export const exteriorPaints = ['regular', 'cool'] as const
export type ExteriorPaint = (typeof exteriorPaints)[number]

export const paintWearKinds = ['cracks', 'stains', 'peeling', 'fascia-rot'] as const
export type PaintWearKind = (typeof paintWearKinds)[number]

export const paintWearLevels = ['none', 'light', 'moderate', 'heavy'] as const
export type PaintWearLevel = (typeof paintWearLevels)[number]

export const ductMaterials = ['original-flex', 'r6-silver-flex', 'r8-flex'] as const
export type DuctMaterial = (typeof ductMaterials)[number]

export const crawlInsulations = ['none', 'insulated'] as const
export type CrawlInsulation = (typeof crawlInsulations)[number]

// Strings, because the field primitives take `T extends string`.
export const acTonnages = ['3', '4', '5'] as const
export type AcTons = (typeof acTonnages)[number]
