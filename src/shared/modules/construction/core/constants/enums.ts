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

export const hvacTypes = ['central', 'wall-mounted', 'portable'] as const
export type HVACType = (typeof hvacTypes)[number]

export const hvacComponents = ['furnace', 'ac', 'both'] as const
export type HVACComponent = (typeof hvacComponents)[number]

export const windowsTypes = ['single', 'double'] as const
export type WindowsType = (typeof windowsTypes)[number]

export const insulationLevels = ['low', 'medium', 'high'] as const
export type InsulationLevel = (typeof insulationLevels)[number]

export const foundationTypes = ['raised', 'slab'] as const
export type FoundationType = (typeof foundationTypes)[number]
