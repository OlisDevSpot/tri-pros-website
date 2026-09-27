import type { RemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/schemas/config'

export const REMODEL_ROI_CONFIG_DEFAULTS = {
  defaultHorizonYears: 5,
  // Carried over from the old calculator, which cited no source for these rates; they stay visible and editable on screen.
  defaultRatesPercent: { homeAppreciation: 4, electric: 9.4, gas: 13.1, water: 10.3, gardening: 5, misc: 0 },
} satisfies RemodelRoiConfig
