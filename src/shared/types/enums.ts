import type {
  constructionTypes,
  electricProviders,
  foundationTypes,
  homeAreas,
  hvacComponents,
  hvacTypes,
  incentiveTypes,
  insulationLevels,
  mediaPhases,
  projectTypes,
  roofLocations,
  roofTypes,
  tradeLocations,
  userRoles,
  validThroughTimeframes,
  variableDataTypes,
  variableGroups,
  viewSources,
  windowsTypes,
} from '@/shared/constants/enums'

// MAIN
export type UserRole = (typeof userRoles)[number]

// MEDIA
export type MediaPhase = (typeof mediaPhases)[number]

// VIEWS
export type ViewSource = (typeof viewSources)[number]

// CONSTRUCTION
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

// PROPOSALS
export type ProjectType = (typeof projectTypes)[number]
export type ElectricProvider = (typeof electricProviders)[number]
export type VariableDataType = (typeof variableDataTypes)[number]
export type VariableGroup = (typeof variableGroups)[number]
export type IncentiveType = (typeof incentiveTypes)[number]
export type ValidThroughTimeframe = (typeof validThroughTimeframes)[number]
