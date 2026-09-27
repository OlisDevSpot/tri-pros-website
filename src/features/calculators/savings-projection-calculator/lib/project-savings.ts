import type { RateKey, SavingsProjectionConfig } from '@/features/calculators/savings-projection-calculator/schemas/config'
import type { SavingsProjectionFormValues } from '@/features/calculators/savings-projection-calculator/schemas/form'
import type { SavingsProjection, SavingsYear } from '@/features/calculators/savings-projection-calculator/types'

import { BILL_CATEGORIES } from '@/features/calculators/savings-projection-calculator/constants/bill-categories'
import { amortizedMonthlyPayment, remainingBalance } from '@/shared/lib/loan-calculations'

function amountOf(value: number | null | undefined): number {
  return value != null && Number.isFinite(value) && value > 0 ? value : 0
}

function toFraction(percent: number): number {
  return percent / 100
}

function cumulativeBills(monthly: number, growth: number, years: number): number {
  if (growth === 0) {
    return 12 * monthly * years
  }
  return (12 * monthly * ((1 + growth) ** years - 1)) / growth
}

function monthsToPayOff(balance: number, aprPercent: number, payment: number): number | null {
  if (balance <= 0) {
    return 0
  }
  if (payment <= 0) {
    return null
  }
  if (aprPercent === 0) {
    return balance / payment
  }
  const monthlyRate = toFraction(aprPercent) / 12
  if (payment <= balance * monthlyRate) {
    return null
  }
  return -Math.log(1 - (monthlyRate * balance) / payment) / Math.log(1 + monthlyRate)
}

function sumBills(bills: SavingsProjectionFormValues['billsNow']): number {
  return BILL_CATEGORIES.reduce((sum, category) => sum + amountOf(bills[category]), 0)
}

// Kept free of React and I/O so the engine can move to a shared module once its permanent home is decided.
export function projectSavings(input: SavingsProjectionFormValues, config: SavingsProjectionConfig): SavingsProjection {
  const horizonYears = Math.min(30, Math.max(1, Math.round(input.assumptions.horizonYears ?? config.defaultHorizonYears)))
  const rate = (key: RateKey) => toFraction(input.assumptions.ratesPercent[key] ?? config.defaultRatesPercent[key])

  const homeValue = amountOf(input.homeValue)
  const appreciation = rate('homeAppreciation')

  const netPrice = Math.max(0, amountOf(input.project.price) - amountOf(input.project.incentives))
  const termMonths = Math.max(0, Math.round(input.project.termMonths ?? 0))
  const projectApr = input.project.aprPercent ?? 0
  const isFinanced = termMonths > 0
  const upfront = isFinanced ? Math.min(amountOf(input.project.downPayment), netPrice) : netPrice
  const principal = netPrice - upfront
  const monthlyPayment = isFinanced ? amortizedMonthlyPayment(principal, projectApr, termMonths) : 0

  const uplift = input.project.uplift.mode === 'amount'
    ? amountOf(input.project.uplift.value)
    : amountOf(input.project.price) * toFraction(amountOf(input.project.uplift.value))

  const liabilities = input.liabilities.map((liability) => {
    const balance = amountOf(liability.balance)
    const payment = amountOf(liability.monthlyPayment)
    const apr = liability.aprPercent ?? 0
    const months = liability.aprPercent == null ? null : monthsToPayOff(balance, apr, payment)
    return { balance, payment, apr, months }
  })
  const heldFlatLiabilities = liabilities.flatMap((liability, index) => (liability.months == null && liability.balance > 0 ? [index] : []))

  function liabilitiesLeft(t: number): number {
    return liabilities.reduce((sum, liability) => {
      // Without an APR (or with a payment that never covers the interest) a balance can't be paid down on paper, so it is held at today's balance.
      if (liability.months == null) {
        return sum + liability.balance
      }
      return sum + remainingBalance(liability.balance, liability.apr, liability.months, 12 * t)
    }, 0)
  }

  function billsPaid(bills: SavingsProjectionFormValues['billsNow'], t: number): number {
    return BILL_CATEGORIES.reduce((sum, category) => sum + cumulativeBills(amountOf(bills[category]), rate(category), t), 0)
  }

  const years: SavingsYear[] = []
  for (let t = 0; t <= horizonYears; t++) {
    const growth = (1 + appreciation) ** t
    const monthsPaid = Math.min(12 * t, termMonths)
    const loanLeft = isFinanced ? remainingBalance(principal, projectApr, termMonths, monthsPaid) : 0
    const owed = liabilitiesLeft(t)
    const homeValueBefore = homeValue * growth
    const homeValueAfter = (homeValue + uplift) * growth
    const cumulativeCostBefore = billsPaid(input.billsNow, t)
    const cumulativeCostAfter = billsPaid(input.billsAfter, t) + upfront + monthlyPayment * monthsPaid
    const netWorthBefore = homeValueBefore - owed
    const netWorthAfter = homeValueAfter - owed - loanLeft
    years.push({
      t,
      homeValueBefore,
      homeValueAfter,
      cumulativeCostBefore,
      cumulativeCostAfter,
      netWorthBefore,
      netWorthAfter,
      netBenefit: cumulativeCostBefore - cumulativeCostAfter + (netWorthAfter - netWorthBefore),
    })
  }

  const last = years[years.length - 1]
  const liabilityPayments = liabilities.reduce((sum, liability) => sum + liability.payment, 0)
  const monthlyBefore = sumBills(input.billsNow) + liabilityPayments
  const monthlyAfter = sumBills(input.billsAfter) + liabilityPayments + monthlyPayment

  return {
    years,
    summary: {
      monthlyBefore,
      monthlyAfter,
      monthlyDifference: monthlyBefore - monthlyAfter,
      cumulativeSavings: last.cumulativeCostBefore - last.cumulativeCostAfter,
      valueGained: last.homeValueAfter - last.homeValueBefore,
      netBenefit: last.netBenefit,
      breakEvenYear: years.find(year => year.t >= 1 && year.netBenefit >= 0)?.t ?? null,
      projectMonthlyPayment: monthlyPayment,
      horizonYears,
      heldFlatLiabilities,
    },
  }
}
