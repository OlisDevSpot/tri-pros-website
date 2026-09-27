import type { RemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/schemas/config'

import { REMODEL_ROI_CONFIG_DEFAULTS } from '@/features/calculators/remodel-roi-calculator/constants/config-defaults'
import { remodelRoiConfigSchema } from '@/features/calculators/remodel-roi-calculator/schemas/config'

// Admin-configured savings defaults have no storage or admin screen yet, so the System defaults are the whole answer for now.
export function resolveRemodelRoiConfig(): RemodelRoiConfig {
  return remodelRoiConfigSchema.parse(REMODEL_ROI_CONFIG_DEFAULTS)
}
