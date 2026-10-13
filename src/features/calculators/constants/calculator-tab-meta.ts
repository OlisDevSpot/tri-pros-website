import type { CalculatorTab } from '@/features/calculators/constants/query-parsers'

import { createSerializer } from 'nuqs'

import { calculatorTabParser } from '@/features/calculators/constants/query-parsers'
import { ROOTS } from '@/shared/config/roots'

export const CALCULATOR_TAB_META: Record<CalculatorTab, { label: string, aliases: readonly string[] }> = {
  'remodel-roi': { label: 'Remodel ROI', aliases: ['roi', 'return', 'payback', 'resale value', 'home value'] },
  'scope-pricing': { label: 'Scope Pricing', aliases: ['price', 'pricing', 'estimate', 'quote', 'cost'] },
}

const serializeCalculatorUrl = createSerializer({ tab: calculatorTabParser })

export function calculatorTabHref(tab: CalculatorTab): string {
  return serializeCalculatorUrl(ROOTS.dashboard.calculators(), { tab })
}
