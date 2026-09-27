import type { PricingKey } from '@/features/calculators/scope-pricing-calculator/constants/pricing-keys'
import type { PricingTrade } from '@/features/calculators/scope-pricing-calculator/schemas/config'
import type { Formula } from '@/features/calculators/scope-pricing-calculator/types'

import { PRICING_TRADES, TRADE_LABELS } from '@/features/calculators/scope-pricing-calculator/constants/trade-labels'
import { installCrawlSpaceInsulation, rnrAttic, topOffAttic } from '@/features/calculators/scope-pricing-calculator/lib/formulas/attic-basement'
import { installArtificial, installConcrete, installDg, installGravel, installMulch, installPavers } from '@/features/calculators/scope-pricing-calculator/lib/formulas/dryscaping-hardscaping'
import { mpu } from '@/features/calculators/scope-pricing-calculator/lib/formulas/electricals'
import { installExteriorPaint } from '@/features/calculators/scope-pricing-calculator/lib/formulas/exterior-paint-siding'
import { installMiniSplit, replaceFurnace, replaceSplitSystem } from '@/features/calculators/scope-pricing-calculator/lib/formulas/hvac'
import { overlay, redeck, tearOff, tileReset } from '@/features/calculators/scope-pricing-calculator/lib/formulas/roof'
import { replaceFrenchDoors, replaceSlidingDoor, replaceWindows } from '@/features/calculators/scope-pricing-calculator/lib/formulas/windows-and-doors'

// Keyed by the old app's scope accessors because Notion scopes don't store a slug yet; the keys become scope slugs once they do.
export const FORMULAS: Record<PricingKey, Formula> = {
  overlay,
  tearOff,
  redeck,
  tileReset,
  replaceSplitSystem,
  replaceFurnace,
  installMiniSplit,
  replaceWindows,
  replaceSlidingDoor,
  replaceFrenchDoors,
  rnrAttic,
  topOffAttic,
  installCrawlSpaceInsulation,
  installArtificial,
  installGravel,
  installMulch,
  installConcrete,
  installPavers,
  installDg,
  mpu,
  installExteriorPaint,
}

export const FORMULA_GROUPS: { trade: PricingTrade, label: string, formulas: Formula[] }[] = PRICING_TRADES.map(trade => ({
  trade,
  label: TRADE_LABELS[trade],
  formulas: Object.values(FORMULAS).filter(formula => formula.trade === trade),
}))
