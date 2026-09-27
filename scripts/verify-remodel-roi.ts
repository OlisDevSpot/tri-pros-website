import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'

import assert from 'node:assert/strict'

import { createRemodelRoiDefaults } from '@/features/calculators/remodel-roi-calculator/constants/form-defaults'
import { RATE_KEYS } from '@/features/calculators/remodel-roi-calculator/constants/rates'
import { formatYears } from '@/features/calculators/remodel-roi-calculator/lib/format-years'
import { projectRemodelRoi } from '@/features/calculators/remodel-roi-calculator/lib/project-remodel-roi'
import { resolveRemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/lib/resolve-config'
import { remodelRoiConfigSchema } from '@/features/calculators/remodel-roi-calculator/schemas/config'
import { amortizedMonthlyPayment, monthsToPayOff, remainingBalance } from '@/shared/lib/loan-calculations'

function near(actual: number, expected: number, message: string, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`)
}

// Loan helpers
near(amortizedMonthlyPayment(100000, 6, 360), 599.5505251527569, 'payment on a 30-year 6% loan')
near(remainingBalance(100000, 6, 360, 0), 100000, 'no payments made → full principal')
near(remainingBalance(100000, 6, 360, 12), 98771.98828772324, 'one year into a 30-year 6% loan', 1e-4)
assert.equal(remainingBalance(100000, 6, 360, 360), 0, 'paid off at term')
assert.equal(remainingBalance(100000, 6, 360, 500), 0, 'past term → 0')
near(remainingBalance(12000, 0, 12, 6), 6000, '0% APR pays down in a straight line')
near(remainingBalance(12000, 0, 12, -3), 12000, 'negative months → principal')
assert.equal(remainingBalance(0, 6, 60, 10), 0, 'no principal → 0')
assert.equal(remainingBalance(5000, 6, 0, 0), 0, 'no term → 0')
assert.equal(remainingBalance(10000, 6, 20.5, 21), 0, 'fractional term: past it → 0')
assert.ok(remainingBalance(10000, 6, 20.5, 12) > 0 && remainingBalance(10000, 6, 20.5, 12) < 10000, 'fractional term: mid-way balance in range')
near(monthsToPayOff(100000, 6, amortizedMonthlyPayment(100000, 6, 360))!, 360, 'a scheduled payment pays off at term', 1e-6)
near(monthsToPayOff(12000, 0, 1000)!, 12, '0% APR: balance over payment')
assert.equal(monthsToPayOff(0, 6, 100), 0, 'nothing owed → 0 months')
assert.equal(monthsToPayOff(5000, 24, 0), null, 'no payment → never')
assert.equal(monthsToPayOff(5000, 24, 100), null, 'payment at or under the interest → never')

// ── Remodel ROI Calculator ──────────────────────────────────────────────────────
const config = resolveRemodelRoiConfig()
assert.equal(config.defaultHorizonYears, 5, 'default horizon')
assert.equal(config.defaultRatesPercent.electric, 9.4, 'default electric escalation')
assert.equal(config.defaultRatesPercent.misc, 0, 'misc held flat by default')
assert.equal(remodelRoiConfigSchema.safeParse({ ...config, defaultHorizonYears: 0 }).success, false, 'horizon 0 rejected')

function scenario(edit: (values: RemodelRoiFormValues) => void): RemodelRoiFormValues {
  const values = createRemodelRoiDefaults(config)
  edit(values)
  return values
}
function zeroRates(values: RemodelRoiFormValues) {
  for (const key of RATE_KEYS) {
    values.assumptions.ratesPercent[key] = 0
  }
}
function lastYear(input: RemodelRoiFormValues) {
  const projection = projectRemodelRoi(input, config)
  return { projection, last: projection.years[projection.years.length - 1] }
}

// Appreciation golden
{
  const { projection, last } = lastYear(scenario((v) => {
    v.homeValue = 1000000
  }))
  assert.equal(projection.years.length, 6, 't = 0…5')
  assert.equal(Math.round(last.homeValueBefore), 1216653, '$1,000,000 at 4% for 5 years')
}

// Cumulative bills at g = 0 and g > 0
{
  const { last } = lastYear(scenario((v) => {
    zeroRates(v)
    v.billsNow.electric = 100
  }))
  near(last.cumulativeCostBefore, 6000, '12 × 100 × 5 when g = 0')
}
{
  const { last } = lastYear(scenario((v) => {
    v.assumptions.horizonYears = 2
    v.assumptions.ratesPercent.electric = 10
    v.billsNow.electric = 100
  }))
  near(last.cumulativeCostBefore, 2520, '12 × 100 × (1.1² − 1)/0.1', 1e-6)
}

// Loan payment parity
function financed(v: RemodelRoiFormValues) {
  v.project.price = 30000
  v.project.incentives = 5000
  v.project.downPayment = 5000
  v.project.aprPercent = 8
  v.project.termMonths = 120
}
{
  const { projection } = lastYear(scenario(financed))
  near(projection.summary.projectMonthlyPayment, amortizedMonthlyPayment(20000, 8, 120), 'project payment matches amortizedMonthlyPayment')
}

// Accounting identity: same bills before and after, no uplift → B(N) = −(price − incentives + interest paid to N)
{
  const { projection } = lastYear(scenario((v) => {
    financed(v)
    v.billsNow.electric = 200
    v.billsAfter.electric = 200
  }))
  const m = amortizedMonthlyPayment(20000, 8, 120)
  const interestPaid = m * 60 - (20000 - remainingBalance(20000, 8, 120, 60))
  near(projection.summary.netBenefit, -(25000 + interestPaid), 'identity with interest', 1e-6)
}
{
  const { projection } = lastYear(scenario((v) => {
    financed(v)
    v.project.aprPercent = 0
    v.project.termMonths = 24
  }))
  near(projection.summary.netBenefit, -25000, 'identity at 0% APR paid off within N')
}

// Cash purchase and an oversized down payment
{
  const { projection, last } = lastYear(scenario((v) => {
    v.project.price = 30000
    v.project.incentives = 5000
  }))
  near(projection.years[0].cumulativeCostAfter, 25000, 'no term → whole net price paid at t = 0')
  assert.equal(projection.summary.projectMonthlyPayment, 0, 'no loan payment when paying cash')
  near(last.netBenefit, -25000, 'cash project counted exactly once')
}
{
  const { projection } = lastYear(scenario((v) => {
    v.project.price = 10000
    v.project.downPayment = 20000
    v.project.termMonths = 60
    v.project.aprPercent = 6
  }))
  near(projection.years[0].cumulativeCostAfter, 10000, 'down payment clamped to the net price')
  assert.equal(projection.summary.projectMonthlyPayment, 0, 'nothing left to finance')
}

// Liabilities: amortized with an APR, held flat without one
{
  const { projection } = lastYear(scenario((v) => {
    zeroRates(v)
    v.homeValue = 500000
    v.liabilities = [{ label: 'Car', balance: 10000, monthlyPayment: 500, aprPercent: 6 }]
  }))
  let balance = 10000
  for (let month = 0; month < 12; month++) {
    balance = balance * (1 + 0.06 / 12) - 500
  }
  near(500000 - projection.years[1].netWorthBefore, balance, 'liability pays down month by month', 1e-6)
  assert.deepEqual(projection.summary.heldFlatLiabilities, [], 'amortizing liability is not held flat')
}
{
  const { projection, last } = lastYear(scenario((v) => {
    zeroRates(v)
    v.homeValue = 500000
    v.liabilities = [
      { label: 'HELOC', balance: 50000, monthlyPayment: 400, aprPercent: null },
      { label: 'Card', balance: 100000, monthlyPayment: 500, aprPercent: 12 },
    ]
  }))
  assert.deepEqual(projection.summary.heldFlatLiabilities, [0, 1], 'no APR, or a payment under the interest → held flat')
  near(last.netWorthBefore, 500000 - 150000, 'held-flat balances unchanged at N')
}

// Monthly now
{
  const { projection } = lastYear(scenario((v) => {
    financed(v)
    v.billsNow.electric = 300
    v.billsNow.gas = 50
    v.billsAfter.electric = 100
    v.liabilities = [{ label: 'Car', balance: 10000, monthlyPayment: 400, aprPercent: 5 }]
  }))
  near(projection.summary.monthlyBefore, 750, 'bills now + liability payments')
  near(projection.summary.monthlyAfter, 100 + 400 + amortizedMonthlyPayment(20000, 8, 120), 'bills after + liabilities + project payment')
}

// Break-even found and not found
function breakEvenScenario(horizon: number) {
  return scenario((v) => {
    zeroRates(v)
    v.assumptions.horizonYears = horizon
    v.project.price = 20000
    v.billsNow.electric = 500
    v.billsAfter.electric = 100
  })
}
assert.equal(projectRemodelRoi(breakEvenScenario(10), config).summary.breakEvenYear, 5, '4,800/yr against 20,000 → year 5')
assert.equal(projectRemodelRoi(breakEvenScenario(4), config).summary.breakEvenYear, null, 'not within 4 years')

// Uplift as a percent of price
{
  const { projection } = lastYear(scenario((v) => {
    zeroRates(v)
    v.homeValue = 400000
    v.project.price = 50000
    v.project.uplift = { mode: 'percentOfPrice', value: 10 }
  }))
  near(projection.summary.valueGained, 5000, '10% of a $50,000 project')
}

// No NaN for any valid input, including the untouched defaults
for (const input of [createRemodelRoiDefaults(config), scenario(financed), breakEvenScenario(30)]) {
  const projection = projectRemodelRoi(input, config)
  for (const year of projection.years) {
    for (const [field, value] of Object.entries(year)) {
      assert.ok(Number.isFinite(value), `year ${year.t} ${field} is ${value}`)
    }
  }
  for (const [field, value] of Object.entries(projection.summary)) {
    if (typeof value === 'number') {
      assert.ok(Number.isFinite(value), `summary ${field} is ${value}`)
    }
  }
}

assert.equal(formatYears(1), '1 year', 'singular')
assert.equal(formatYears(5), '5 years', 'plural')

console.log('✅ verify-remodel-roi passed')
