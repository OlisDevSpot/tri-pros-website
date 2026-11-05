import type { RepairsRow } from '@/features/trade-scenes/lib/repairs-rows'
import type { MonthlyCosts, SceneSavings, TradeSceneInputs } from '@/features/trade-scenes/types'

import { repairsFigure } from '@/features/trade-scenes/lib/repairs-figure'

function costs(electric: number, gas: number, repairs: number): MonthlyCosts {
  return { electric, gas, repairs, total: electric + gas + repairs }
}

// Each bill is rounded on its own, as the ROI calculator shows them, so the sides never differ by a dollar.
export function todayCosts(savings: SceneSavings, repairs: readonly RepairsRow[], overrides: TradeSceneInputs['repairsOverrides']): MonthlyCosts {
  const { electric, gas } = savings.cuts
  return costs(Math.round(electric.bill), Math.round(gas.bill), repairsFigure(repairs, overrides).monthly)
}

export function afterCosts(savings: SceneSavings, repairs: readonly RepairsRow[], overrides: TradeSceneInputs['repairsOverrides']): MonthlyCosts {
  const { electric, gas } = savings.cuts
  const kept = repairs.filter(row => !(row.trade in savings.repairsByTrade))
  return costs(Math.round(electric.after), Math.round(gas.after), repairsFigure(kept, overrides).monthly)
}
