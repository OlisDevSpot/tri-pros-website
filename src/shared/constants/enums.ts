// PLATFORM

export const projectTypes = ['general-remodeling', 'energy-efficient'] as const

export const tradeLocations = ['exterior', 'interior', 'lot'] as const
export const constructionTypes = ['energy-efficient', 'rough-construction', 'finish-construction'] as const
export const homeAreas = ['bathroom', 'kitchen', 'bedroom', 'living-room', 'dining-room', 'front-yard', 'back-yard', 'side-yard', 'garage', 'attic', 'basement', 'foundation', 'exterior-shell', 'interior-space'] as const

export const roofLocations = ['main home', 'garage', 'adu'] as const
export const roofTypes = ['shingle', 'metal', 'flat', 'woodshake', 'tile'] as const
export const hvacTypes = ['central', 'wall-mounted', 'portable'] as const
export const hvacComponents = ['furnace', 'ac', 'both'] as const
export const windowsTypes = ['single', 'double'] as const
export const insulationLevels = ['low', 'medium', 'high'] as const
export const foundationTypes = ['raised', 'slab'] as const

// ONE STOP SALES
export const electricProviders = ['ladwp', 'edison', 'glendale water & power', 'burbank water & power', 'riverside public utilities', 'pg&e', 'other'] as const
export const variableDataTypes = ['text', 'select', 'number', 'boolean'] as const
export const variableGroups = ['project', 'trade'] as const
