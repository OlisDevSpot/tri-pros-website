import type {
  constructionTypes,
  foundationTypes,
  homeAreas,
  hvacComponents,
  hvacTypes,
  insulationLevels,
  roofLocations,
  roofTypes,
  tradeLocations,
  windowsTypes,
} from '@/shared/constants/enums/construction'

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
