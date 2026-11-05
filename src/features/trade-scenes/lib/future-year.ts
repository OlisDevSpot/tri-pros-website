import type { FutureYear, MonthlyCosts } from '@/features/trade-scenes/types'

import { roundedCosts } from '@/features/trade-scenes/lib/rounded-costs'
import { BILL_GROWTH_RATES_PERCENT } from '@/shared/modules/construction/core/constants/bill-growth-rates'
import { CONSTRUCTION_GROWTH_RATE_PERCENT } from '@/shared/modules/construction/core/constants/construction-growth-rate'
import { projectBillYears } from '@/shared/modules/construction/core/lib/project-bill-years'

// The year as it is shown: each side's parts in whole dollars, and the saving their totals' difference, so every reader
// of a year prints the same figures and a saving always equals the two totals beside it.
export function futureYear(today: MonthlyCosts, after: MonthlyCosts, year: number): FutureYear {
  const { billsNow, billsAfter } = projectBillYears(
    {
      electric: { now: today.electric, after: after.electric },
      gas: { now: today.gas, after: after.gas },
      repairs: { now: today.repairs, after: after.repairs },
    },
    { electric: BILL_GROWTH_RATES_PERCENT.electric, gas: BILL_GROWTH_RATES_PERCENT.gas, repairs: CONSTRUCTION_GROWTH_RATE_PERCENT },
    year,
  )[year]
  const without = roundedCosts(billsNow)
  const withBuild = roundedCosts(billsAfter)
  return { year, without, with: withBuild, saves: without.total - withBuild.total }
}
