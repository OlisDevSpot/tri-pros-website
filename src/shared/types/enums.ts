import type {
  constructionTypes,
  electricProviders,
  foundationTypes,
  homeAreas,
  hvacComponents,
  hvacTypes,
  insulationLevels,
  projectTypes,
  roofLocations,
  roofTypes,
  tradeLocations,
  variableDataTypes,
  variableGroups,
  windowsTypes,
} from '@/shared/constants/enums'

export type ProjectType = (typeof projectTypes)[number]

// PLATFORM
export type TradeLocation = (typeof tradeLocations)[number]
export type ConstructionType = (typeof constructionTypes)[number]
export type HomeArea = (typeof homeAreas)[number]

export type RoofLocation = (typeof roofLocations)[number]
export type RoofType = (typeof roofTypes)[number]
export type HVACType = (typeof hvacTypes)[number]
export type HVACComponent = (typeof hvacComponents)[number]
export type WindowsType = (typeof windowsTypes)[number]
export type InsulationLevel = (typeof insulationLevels)[number]
export type FoundationType = (typeof foundationTypes)[number]

// REMODEL-X
export type ElectricProvider = (typeof electricProviders)[number]
export type VariableDataType = (typeof variableDataTypes)[number]
export type VariableGroup = (typeof variableGroups)[number]
