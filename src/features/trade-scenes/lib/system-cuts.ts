import type { HomeSystemId, SavingsCategory, SceneSavings } from '@/features/trade-scenes/types'
import type { BillCutAddOnId } from '@/shared/modules/construction/core/constants/bill-cut-add-ons'
import type { CutPart } from '@/shared/modules/construction/core/types'

import { ADD_ON_SYSTEM, TRADE_SYSTEM } from '@/features/trade-scenes/constants/benefit-systems'
import { SAVINGS_CATEGORIES } from '@/features/trade-scenes/constants/savings-categories'
import { compoundCut } from '@/shared/modules/construction/core/lib/combine-cuts'

export type SystemCuts = Partial<Record<HomeSystemId, Partial<Record<SavingsCategory, { percent: number, monthly: number }>>>>

const isAddOn = (source: CutPart['source']): source is BillCutAddOnId => source in ADD_ON_SYSTEM

// What each system's own picks cut from a bill, compounded within the system. Across systems the cuts compound again to the
// build's, so these never add up to it. A bill of $0 has nothing to cut and earns no claim.
export function systemCuts(savings: SceneSavings): SystemCuts {
  const result: SystemCuts = {}
  for (const category of SAVINGS_CATEGORIES) {
    const { bill, parts } = savings.cuts[category]
    if (bill === 0) {
      continue
    }
    const bySystem = new Map<HomeSystemId, CutPart[]>()
    for (const part of parts) {
      const system = isAddOn(part.source) ? ADD_ON_SYSTEM[part.source] : TRADE_SYSTEM[part.source]
      if (system !== null) {
        bySystem.set(system, [...bySystem.get(system) ?? [], part])
      }
    }
    for (const [system, systemParts] of bySystem) {
      const combined = compoundCut(systemParts)
      result[system] = { ...result[system], [category]: { percent: combined * 100, monthly: bill * combined } }
    }
  }
  return result
}
