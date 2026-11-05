import type { BillYear } from '@/shared/modules/construction/core/types'

export function projectBillYears<C extends string>(bills: Record<C, { now: number, after: number }>, growthPercent: Record<C, number>, years: number): BillYear<C>[] {
  const categories = Object.keys(bills) as C[]
  const at = (read: (category: C) => number) => Object.fromEntries(categories.map(category => [category, read(category)])) as Record<C, number>
  return Array.from({ length: years + 1 }, (_, t) => {
    const grown = (category: C) => (1 + growthPercent[category] / 100) ** (t - 1)
    return {
      t,
      billsNow: at(category => (t === 0 ? 0 : bills[category].now * grown(category))),
      billsAfter: at(category => (t === 0 ? 0 : bills[category].after * grown(category))),
    }
  })
}
