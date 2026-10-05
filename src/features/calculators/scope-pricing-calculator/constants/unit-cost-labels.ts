import type { PricingTrade, UnitCostsOf } from '@/features/calculators/scope-pricing-calculator/schemas/config'

type UnitCostLabels = { [T in PricingTrade]: Record<keyof UnitCostsOf<T>, string> }

export const UNIT_COST_LABELS = {
  roof: {
    BSQTearOffFlat: 'Tear-Off (Flat) per BSQ',
    BSQTearOffShingles: 'Tear-Off (Shingles) per BSQ',
    BSQTearOffTile: 'Tear-Off (Tile) per BSQ',
    BSQRedeckFlat: 'Redeck (Flat) per BSQ',
    BSQRedeckPitched: 'Redeck (Pitched) per BSQ',
    BSQTileReset: 'Tile Reset per BSQ',
    BSQOverlayPitched: 'Overlay (Pitched) per BSQ',
    BSQOverlayFlat: 'Overlay (Flat) per BSQ',
    dollarPerAdditionalStory: 'Dollar per Additional Story',
    dollarPerAdditionalLayer: 'Dollar per Additional Layer',
  },
  hvac: {
    threeTonRnr: '3 Ton HVAC Replace & Install',
    furnace36kBTURnr: '36k BTU Furnace Replace & Install',
    miniSplits: 'Mini-Splits (Per Unit)',
    perTonStep: 'Per additional ton (HVAC)',
  },
  windowsAndDoors: {
    windowSmall: 'Small Window',
    windowLarge: 'Large Window',
    slidingDoorStandard: 'Sliding Door (Standard)',
    slidingDoorSpecial: 'Sliding Door (Special)',
    frenchDoor: 'French Door',
  },
  atticBasement: {
    dollarPerSqFtTopOff: 'Dollar per SqFt (Top-Off)',
    dollarPerSqFtRnr: 'Dollar per SqFt (Remove & Replace)',
    dollarPerSqFtCrawlSpace: 'Dollar per SqFt (Crawl space insulation)',
  },
  dryscapingHardscaping: {
    dollarPerSqFtArtificial: 'Dollar per SqFt (Artificial Turf)',
    dollarPerSqFtGravel: 'Dollar per SqFt (Gravel)',
    dollarPerSqFtMulch: 'Dollar per SqFt (Mulch)',
    dollarPerSqFtConcrete: 'Dollar per SqFt (Concrete)',
    dollarPerSqFtPavers: 'Dollar per SqFt (Pavers)',
    dollarPerSqFtDg: 'Dollar per SqFt (DG)',
  },
  electricals: {
    mpuBase: 'Main panel upgrade',
    mpuWithRelocation: 'Main panel upgrade (with relocation)',
  },
  exteriorPaintSiding: {
    coolLifePaintSm: 'CoolLife Paint (Small Home)',
    coolLifePaintAvg: 'CoolLife Paint (Average Home)',
    coolLifePaintLarge: 'CoolLife Paint (Large Home)',
    waterPaintSm: 'Water Paint (Small Home)',
    waterPaintAvg: 'Water Paint (Average Home)',
    waterPaintLarge: 'Water Paint (Large Home)',
  },
} as const satisfies UnitCostLabels
