import type { PanelSectionKey } from '@/features/calculators/remodel-roi-calculator/constants/panel-sections'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { BILL_CATEGORIES } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import { TRADE_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/trades'
import { formatMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { formatYears } from '@/features/calculators/remodel-roi-calculator/lib/format-years'
import { joinWords } from '@/features/calculators/remodel-roi-calculator/lib/join-words'

export function panelSummaries(projection: RemodelRoiProjection): Record<PanelSectionKey, string> {
  const { trades, replacements, project, cuts, homeValue, liabilities, liabilitiesMonthly } = projection
  const today = BILL_CATEGORIES.reduce((total, category) => total + cuts[category].bill, 0)
  const after = BILL_CATEGORIES.reduce((total, category) => total + cuts[category].after, 0)
  const label = (trade: RemodelRoiProjection['trades'][number]) => {
    const replacement = replacements.find(item => item.trade === trade)
    return replacement ? `${TRADE_LABELS[trade]} (~${formatYears(replacement.installs[0].year)} left)` : TRADE_LABELS[trade]
  }
  return {
    trades: trades.length ? joinWords(trades.map(label)) : 'Pick the trades in the project',
    project: project.price
      ? `${formatMoney(project.price)} · ${project.paymentMode === 'financed' ? `${project.termYears} yrs at ${project.aprPercent.value}%` : 'cash'}`
      : 'Add the project price',
    bills: today ? `${formatMoney(today)}/mo today → ${formatMoney(after)}/mo after` : 'Add today\'s bills',
    home: homeValue ? `Home ${formatMoney(homeValue)} · ${liabilities.length} ${liabilities.length === 1 ? 'loan' : 'loans'} · ${formatMoney(liabilitiesMonthly)}/mo` : 'Optional · adds net worth',
  }
}

export function panelDone(projection: RemodelRoiProjection): Record<PanelSectionKey, boolean> {
  return {
    trades: projection.trades.length > 0,
    project: projection.project.price > 0,
    bills: BILL_CATEGORIES.some(category => projection.cuts[category].bill > 0),
    home: projection.homeValue > 0,
  }
}
