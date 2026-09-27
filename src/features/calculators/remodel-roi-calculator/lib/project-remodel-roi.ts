import type { BillCategory } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import type { TradeKey } from '@/features/calculators/remodel-roi-calculator/constants/trades'
import type { RemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/schemas/config'
import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'
import type { BillCut, ByCategory, Install, LiabilityProjection, ProjectionYear, RemodelRoiProjection, ReplacementProjection, Resolved, ResolvedAssumptions } from '@/features/calculators/remodel-roi-calculator/types'

import { BILL_CATEGORIES } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import { PROJECTION_YEARS } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import { AGING_TRADE_KEYS, TRADE_KEYS } from '@/features/calculators/remodel-roi-calculator/constants/trades'
import { combineCuts } from '@/features/calculators/remodel-roi-calculator/lib/combine-cuts'
import { amortizedMonthlyPayment, monthsToPayOff, remainingBalance } from '@/shared/lib/loan-calculations'

function amountOf(value: number | null | undefined): number {
  return value != null && Number.isFinite(value) && value > 0 ? value : 0
}

function resolve(value: number | null, working: number): Resolved {
  return value == null ? { value: working, source: 'working' } : { value, source: 'input' }
}

function byCategory(read: (category: BillCategory) => number): ByCategory {
  return Object.fromEntries(BILL_CATEGORIES.map(category => [category, read(category)])) as ByCategory
}

function sumOf(values: ByCategory): number {
  return BILL_CATEGORIES.reduce((total, category) => total + values[category], 0)
}

// The first year from which a claim holds through the last projected year, so "from year N" is never contradicted later.
function holdsFrom(years: ProjectionYear[], test: (year: ProjectionYear) => boolean): number | null {
  let from: number | null = null
  for (let index = years.length - 1; index >= 1 && test(years[index]); index--) {
    from = years[index].t
  }
  return from
}

function cutFor(input: RemodelRoiFormValues, category: BillCategory, parts: BillCut['parts'], combined: number): BillCut {
  const bill = amountOf(input.bills[category].now)
  const { mode, value } = input.bills[category].cut
  if (mode === 'percent' && value != null) {
    const share = Math.min(100, amountOf(value)) / 100
    return { bill, parts, combined: share, after: bill * (1 - share), typed: true }
  }
  if (mode === 'amount' && value != null) {
    const saved = Math.min(bill, amountOf(value))
    return { bill, parts, combined: bill > 0 ? saved / bill : 0, after: bill - saved, typed: true }
  }
  return { bill, parts, combined, after: bill * (1 - combined), typed: false }
}

// Kept free of React and I/O so the engine can move to a shared module once its permanent home is decided.
export function projectRemodelRoi(input: RemodelRoiFormValues, config: RemodelRoiConfig): RemodelRoiProjection {
  const assumptions: ResolvedAssumptions = {
    ratesPercent: Object.fromEntries(BILL_CATEGORIES.map(category => [category, resolve(input.assumptions.ratesPercent[category], config.defaultRatesPercent[category])])) as ResolvedAssumptions['ratesPercent'],
    constructionPercent: resolve(input.assumptions.constructionPercent, config.defaultConstructionPercent),
    homeAppreciationPercent: resolve(input.assumptions.homeAppreciationPercent, config.defaultHomeAppreciationPercent),
    valueAddedPercent: resolve(input.assumptions.valueAddedPercent, config.defaultValueAddedPercent),
  }
  const growth = (category: BillCategory) => assumptions.ratesPercent[category].value / 100
  const construction = assumptions.constructionPercent.value / 100
  const appreciation = assumptions.homeAppreciationPercent.value / 100
  const valueShare = assumptions.valueAddedPercent.value / 100

  const trades: TradeKey[] = TRADE_KEYS.filter(trade => input.trades[trade] != null)
  const ducts = input.trades.hvac?.ducts ?? false

  const price = amountOf(input.project.price)
  const incentives = Math.min(price, amountOf(input.project.incentives))
  const netPrice = price - incentives
  const financed = input.project.paymentMode === 'financed'
  const aprPercent = resolve(input.project.aprPercent, config.defaultFinancing.aprPercent)
  const termYears = input.project.termYears
  const termMonths = financed ? termYears * 12 : 0
  const upfront = financed ? Math.min(amountOf(input.project.downPayment), netPrice) : netPrice
  const principal = netPrice - upfront
  const payment = financed ? amortizedMonthlyPayment(principal, aprPercent.value, termMonths) : 0

  const cuts = Object.fromEntries(BILL_CATEGORIES.map((category) => {
    const { parts, combined } = combineCuts({ trades, ducts }, category, config.trades)
    return [category, cutFor(input, category, parts, combined)]
  })) as Record<BillCategory, BillCut>

  const replacements: ReplacementProjection[] = AGING_TRADE_KEYS.flatMap((trade) => {
    const current = input.trades[trade]?.current
    if (current?.ageYears == null) {
      return []
    }
    const working = config.trades[trade].current
    const likeForLikePrice = resolve(current.likeForLikePrice, working.likeForLikePrice)
    const repairsPerYear = resolve(current.repairsPerYear, working.repairsPerYear)
    const firstFail = Math.max(1, Math.round(working.standardLifeYears - current.ageYears))
    // One that outlasts the projection has nothing to replace on the wait path.
    if (firstFail > PROJECTION_YEARS) {
      return []
    }
    const installs: Install[] = []
    for (let year = firstFail; year <= PROJECTION_YEARS; year += working.standardLifeYears) {
      installs.push({ year, price: likeForLikePrice.value * (1 + construction) ** year })
    }
    let repairsUntil = 0
    for (let t = 1; t <= firstFail; t++) {
      repairsUntil += repairsPerYear.value * (1 + construction) ** (t - 1)
    }
    const extra = installs[0].price - likeForLikePrice.value + repairsUntil
    return [{ trade, ageYears: current.ageYears, standardLifeYears: working.standardLifeYears, likeForLikePrice, repairsPerYear, installs, repairsUntil, extra }]
  })
  const installs = replacements.flatMap(replacement => replacement.installs.map(install => ({ ...install, payment: financed ? amortizedMonthlyPayment(install.price, aprPercent.value, termMonths) : 0 })))

  const homeValue = amountOf(input.homeValue)
  const liabilities = input.liabilities.flatMap((liability, index) => {
    const balance = amountOf(liability.balance)
    if (balance <= 0) {
      return []
    }
    const monthlyPayment = amountOf(liability.monthlyPayment)
    const months = liability.aprPercent == null ? null : monthsToPayOff(balance, liability.aprPercent, monthlyPayment)
    const projection: LiabilityProjection = { index, label: liability.label, balance, monthlyPayment, aprPercent: liability.aprPercent, kind: liability.kind, heldFlat: months == null }
    return [{ projection, months }]
  })
  function liabilitiesLeft(t: number): number {
    return liabilities.reduce((total, { projection, months }) => {
      // Without an APR, or with a payment that never covers the interest, a balance can't be paid down on paper, so it is held at today's balance.
      if (months == null) {
        return total + projection.balance
      }
      return total + remainingBalance(projection.balance, projection.aprPercent ?? 0, months, 12 * t)
    }, 0)
  }

  const years: ProjectionYear[] = []
  let cumNow = upfront
  let cumWait = 0
  let billsSaved = 0
  let repairsSkipped = 0
  let projectPaid = 0
  let replacementPaid = 0
  for (let t = 0; t <= PROJECTION_YEARS; t++) {
    const billsNowByCategory = byCategory(category => (t === 0 ? 0 : cuts[category].bill * (1 + growth(category)) ** (t - 1)))
    const billsAfterByCategory = byCategory(category => (t === 0 ? 0 : cuts[category].after * (1 + growth(category)) ** (t - 1)))
    const billsNow = sumOf(billsNowByCategory)
    const billsAfter = sumOf(billsAfterByCategory)
    const repairsYear = replacements.reduce((total, replacement) => {
      return t >= 1 && t <= replacement.installs[0].year ? total + replacement.repairsPerYear.value * (1 + construction) ** (t - 1) : total
    }, 0)
    const replacementPayments = installs.reduce((total, install) => (financed && t > install.year && t <= install.year + termYears ? total + install.payment : total), 0)
    const installCash = installs.reduce((total, install) => (!financed && t === install.year ? total + install.price : total), 0)
    const projectPayment = financed && t >= 1 && t <= termYears ? payment : 0
    const monthlyNow = t === 0 ? 0 : billsAfter + projectPayment
    const monthlyWait = t === 0 ? 0 : billsNow + repairsYear / 12 + replacementPayments
    if (t >= 1) {
      cumNow += 12 * monthlyNow
      cumWait += 12 * monthlyWait + installCash
      billsSaved += 12 * (billsNow - billsAfter)
      repairsSkipped += repairsYear
      projectPaid += 12 * projectPayment
      replacementPaid += 12 * replacementPayments
    }

    const done = installs.filter(install => install.year <= t)
    const replaced = done.reduce((total, install) => total + install.price, 0)
    const debtWait = financed ? done.reduce((total, install) => total + remainingBalance(install.price, aprPercent.value, termMonths, 12 * (t - install.year)), 0) : 0
    // A renewal replaces the value of the install before it, so each trade carries only its latest install.
    const valueWait = replacements.reduce((total, replacement) => {
      const latest = replacement.installs.filter(install => install.year <= t).at(-1)
      return latest ? total + valueShare * latest.price * (1 + appreciation) ** (t - latest.year) : total
    }, 0)
    const debtNow = financed ? remainingBalance(principal, aprPercent.value, termMonths, 12 * t) : 0
    const valueNow = valueShare * price * (1 + appreciation) ** t
    const benefit = (cumWait - cumNow) + (valueNow - valueWait) - (debtNow - debtWait)
    const owed = homeValue > 0 ? liabilitiesLeft(t) : 0
    const home = homeValue * (1 + appreciation) ** t

    years.push({
      t,
      billsNowByCategory,
      billsAfterByCategory,
      billsNow,
      billsAfter,
      repairsMonthly: repairsYear / 12,
      projectPayment,
      replacementPayments,
      monthlyNow,
      monthlyWait,
      cumNow,
      cumWait,
      debtNow,
      debtWait,
      valueNow,
      valueWait,
      benefit,
      returnParts: {
        billsSaved,
        repairsSkipped,
        replacementsSkipped: replaced,
        interestSkipped: financed ? replacementPaid + debtWait - replaced : 0,
        valueGain: valueNow - valueWait,
        projectPrice: -netPrice,
        projectInterest: principal - projectPaid - debtNow,
      },
      netWorth: homeValue > 0 ? { now: home + valueNow - owed - debtNow, wait: home + valueWait - owed - debtWait, home, owed } : null,
    })
  }

  const ready = trades.length > 0 && price > 0 && BILL_CATEGORIES.some(category => cuts[category].bill > 0)

  return {
    ready,
    trades,
    ducts,
    years,
    cuts,
    replacements,
    project: { price, incentives, netPrice, paymentMode: input.project.paymentMode, aprPercent, termYears, upfront, principal, payment },
    valueAddedToday: valueShare * price,
    homeValue,
    liabilities: liabilities.map(({ projection }) => projection),
    liabilitiesMonthly: liabilities.reduce((total, { projection }) => total + projection.monthlyPayment, 0),
    milestones: {
      paysForItselfYear: ready ? holdsFrom(years, year => year.benefit >= 0) : null,
      costsLessMonthlyYear: ready ? holdsFrom(years, year => year.monthlyNow < year.monthlyWait) : null,
      payoffYear: ready && financed && principal > 0 ? termYears : null,
    },
    assumptions,
  }
}
