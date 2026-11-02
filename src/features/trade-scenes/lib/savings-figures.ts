import type { SavingsCategory, SceneSavings } from '@/features/trade-scenes/types'

import { SAVINGS_CATEGORIES } from '@/features/trade-scenes/constants/savings-categories'

interface SavingsFigures {
  bills: Record<SavingsCategory, number | null>
  repairs: number | null
  total: number | null
}

// A figure that is not above zero is null so the panel shows nothing rather than $0, and "together" sums only what is shown.
export function savingsFigures({ cuts, repairsMonthly, repairsByTrade }: SceneSavings): SavingsFigures {
  const landed = Object.keys(repairsByTrade).length > 0
  const positive = (value: number) => landed && value > 0 ? value : null
  // Each side rounded on its own, as the ROI calculator shows them, so the two never differ by a dollar.
  const bills = Object.fromEntries(SAVINGS_CATEGORIES.map((category) => {
    const { bill, after } = cuts[category]
    return [category, bill > 0 ? positive(Math.round(bill) - Math.round(after)) : null]
  })) as Record<SavingsCategory, number | null>
  const repairs = positive(repairsMonthly)
  const shown = [...Object.values(bills), repairs].filter(figure => figure !== null)
  return { bills, repairs, total: shown.length >= 2 ? shown.reduce((sum, figure) => sum + figure, 0) : null }
}
