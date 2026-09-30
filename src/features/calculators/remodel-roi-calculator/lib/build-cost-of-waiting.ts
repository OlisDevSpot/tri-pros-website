import type { CostOfWaiting, CostOfWaitingRow, CostOfWaitingTrade, RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { CURRENT_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/trades'

export function buildCostOfWaiting(projection: RemodelRoiProjection): CostOfWaiting {
  const growth = 1 + projection.assumptions.constructionPercent.value / 100
  const trades: CostOfWaitingTrade[] = projection.replacements.map((replacement) => {
    const rows: CostOfWaitingRow[] = [
      { name: 'Today', year: 0, today: replacement.likeForLikePrice.value, price: 0, repairs: 0, total: replacement.likeForLikePrice.value },
      ...replacement.installs.map((install, index) => {
        const repairs = index === 0 ? replacement.repairsUntil : 0
        return { name: `Year ${install.year}`, year: install.year, today: 0, price: install.price, repairs, total: install.price + repairs }
      }),
    ]
    return {
      trade: replacement.trade,
      label: CURRENT_LABELS[replacement.trade],
      givesOutYear: replacement.installs[0].year,
      likeForLikePrice: replacement.likeForLikePrice.value,
      rows,
    }
  })
  const max = Math.max(0, ...trades.flatMap(trade => trade.rows.map(row => row.total)))
  return { growth, max, trades }
}
