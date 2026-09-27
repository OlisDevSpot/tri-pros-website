import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import assert from 'node:assert/strict'

import { BILL_CATEGORIES } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import { createRemodelRoiDefaults, createTradePicks } from '@/features/calculators/remodel-roi-calculator/constants/form-defaults'
import { combineCuts } from '@/features/calculators/remodel-roi-calculator/lib/combine-cuts'
import { formatYears } from '@/features/calculators/remodel-roi-calculator/lib/format-years'
import { projectRemodelRoi } from '@/features/calculators/remodel-roi-calculator/lib/project-remodel-roi'
import { resolveRemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/lib/resolve-config'
import { remodelRoiConfigSchema } from '@/features/calculators/remodel-roi-calculator/schemas/config'
import { remodelRoiFormSchema } from '@/features/calculators/remodel-roi-calculator/schemas/form'
import { amortizedMonthlyPayment, monthsToPayOff, remainingBalance } from '@/shared/lib/loan-calculations'

function near(actual: number, expected: number, message: string, tolerance = 0.01) {
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
assert.equal(config.defaultLookAheadYears, 10, 'default look-ahead is 10 years')
assert.equal(config.defaultValueAddedPercent, 80, 'value added defaults to 80%')
assert.equal(remodelRoiConfigSchema.safeParse({ ...config, defaultLookAheadYears: 30 }).success, false, 'look-ahead outside 10/15/20 rejected')
assert.equal(
  remodelRoiConfigSchema.safeParse({ ...config, trades: { ...config.trades, hvac: { ...config.trades.hvac, newLifeYears: 15 } } }).success,
  false,
  'a new install that would need renewing inside the projection is rejected',
)

const picks = createTradePicks()

// Bills of $380 electric and $90 gas; default working numbers (8.99% over 15 years, 80% value added, 5% construction, 4% appreciation).
function job(edit: (values: RemodelRoiFormValues) => void): RemodelRoiFormValues {
  const values = createRemodelRoiDefaults(config)
  values.bills.electric.now = 380
  values.bills.gas.now = 90
  edit(values)
  return values
}
function cash(values: RemodelRoiFormValues): RemodelRoiFormValues {
  return { ...values, project: { ...values.project, paymentMode: 'cash' } }
}
function run(values: RemodelRoiFormValues): RemodelRoiProjection {
  return projectRemodelRoi(values, config)
}

const JOB_A = job((v) => {
  v.trades.hvac = { ducts: true, current: { ...picks.hvac.current, ageYears: 15 } }
  v.trades.atticBasement = picks.atticBasement
  v.project.price = 32000
})
const JOB_B = job((v) => {
  v.trades.roof = { current: { ...picks.roof.current, ageYears: 23 } }
  v.trades.hvac = { ducts: false, current: { ...picks.hvac.current, ageYears: 14 } }
  v.trades.atticBasement = picks.atticBasement
  v.project.price = 65000
})
const JOB_C = job((v) => {
  v.trades.windowsAndDoors = picks.windowsAndDoors
  v.trades.atticBasement = picks.atticBasement
  v.project.price = 30000
})
const JOB_D = job((v) => {
  v.trades.exteriorPaintSiding = { current: { ...picks.exteriorPaintSiding.current, ageYears: 8 } }
  v.project.price = 12000
})

// Cuts combine multiplicatively, so they never pass 100%; ducts count only with HVAC.
near(combineCuts({ trades: ['hvac', 'atticBasement'], ducts: true }, 'electric', config.trades).combined, 0.35875, 'HVAC 25%, attic 10%, ducts 5% → 35.875%', 1e-9)
assert.equal(combineCuts({ trades: ['roof'], ducts: true }, 'electric', config.trades).parts.length, 1, 'ducts without HVAC cut nothing')
assert.equal(combineCuts({ trades: [], ducts: false }, 'electric', config.trades).combined, 0, 'no trades → no cut')

// Job A. Hand-checked: 32,000 at 8.99% over 180 months = $324.37; year 1 = 380 × 0.64125 + 90 × 0.646 + 324.37 = $626.19 vs 470 + 600 / 12 = $520; HVAC aged 15 of 18 → year 3 at 16,000 × 1.05³ = $18,522 after 600 + 630 + 661.50 = $1,891.50 of repairs.
{
  const p = run(JOB_A)
  assert.equal(p.ready, true, 'A is ready')
  assert.equal(p.years.length, 21, 't = 0…20')
  near(p.project.payment, 324.375, 'A payment', 0.001)
  near(p.years[1].monthlyNow, 626.19, 'A year-1 upgrade now')
  near(p.years[1].monthlyWait, 520, 'A year-1 wait')
  assert.deepEqual(p.replacements[0].installs.map(install => install.year), [3], 'HVAC gives out in year 3 and lasts past year 20')
  near(p.replacements[0].installs[0].price, 18522, 'HVAC price in year 3')
  near(p.replacements[0].repairsUntil, 1891.5, 'HVAC repairs until then')
  assert.deepEqual(p.milestones, { paysForItselfYear: 3, costsLessMonthlyYear: 4, payoffYear: 15 }, 'A milestones (pinned)')
  near(p.years[10].benefit, 26733.45, 'A +10 yrs (pinned)')
  near(p.years[20].benefit, 123385.65, 'A +20 yrs (pinned)')
}

// Job D. Hand-checked: paint aged 8 of 10 → year 2 at 8,000 × 1.05² = $8,820, renewed in year 12 at 8,000 × 1.05¹² = $14,366.85.
{
  const p = run(JOB_D)
  assert.deepEqual(p.replacements[0].installs.map(install => install.year), [2, 12], 'paint renews every 10 years inside the projection')
  near(p.replacements[0].installs[1].price, 14366.85, 'second repaint price')
  assert.deepEqual(p.milestones, { paysForItselfYear: 8, costsLessMonthlyYear: 10, payoffYear: 15 }, 'D milestones (pinned)')
  near(p.years[20].benefit, 32606.77, 'D +20 yrs (pinned)')
  near(p.years[13].valueWait, 0.8 * 14366.85 * 1.04, 'the renewal replaces the earlier repaint\'s value')
}

// Jobs B and C (pinned).
{
  const b = run(JOB_B)
  assert.deepEqual(b.milestones, { paysForItselfYear: 4, costsLessMonthlyYear: 5, payoffYear: 15 }, 'B milestones')
  near(b.years[10].benefit, 27492.19, 'B +10 yrs')
  const c = run(JOB_C)
  assert.deepEqual(c.milestones, { paysForItselfYear: 10, costsLessMonthlyYear: 14, payoffYear: 15 }, 'C milestones')
  near(c.years[10].benefit, 2155.61, 'C +10 yrs')
}

// The return parts sum to the benefit every year, financed and cash, for every job.
for (const values of [JOB_A, JOB_B, JOB_C, JOB_D].flatMap(values => [values, cash(values)])) {
  for (const year of run(values).years) {
    const sum = Object.values(year.returnParts).reduce((total, part) => total + part, 0)
    near(sum, year.benefit, `parts sum to benefit, year ${year.t}`, 1e-6)
  }
}

// Paying cash: no loan anywhere; each wait-path install is paid in cash.
{
  const p = run(cash(JOB_A))
  assert.equal(p.project.payment, 0, 'cash → no payment')
  assert.equal(p.milestones.payoffYear, null, 'cash → no payoff year')
  assert.deepEqual([p.milestones.paysForItselfYear, p.milestones.costsLessMonthlyYear], [2, 1], 'cash A milestones (pinned)')
  near(p.years[10].benefit, 39218.93, 'cash A +10 yrs (pinned)')
  assert.ok(p.years.every(year => year.projectPayment === 0 && year.replacementPayments === 0), 'no loan payments on either path')
  assert.equal(p.years[10].returnParts.projectInterest, 0, 'no project interest')
}

// A claim holds from its year to the end: cheaper in years 1–2 but dearer in years 3–6 is not "from year 1".
{
  const p = run(job((v) => {
    v.trades.hvac = { ducts: false, current: { ageYears: 16, likeForLikePrice: 1000, repairsPerYear: 6000 } }
    v.project.price = 20000
  }))
  assert.ok(p.years[1].monthlyNow < p.years[1].monthlyWait && p.years[3].monthlyNow > p.years[3].monthlyWait, 'the case flips back')
  assert.equal(p.milestones.costsLessMonthlyYear, 7, 'costs less monthly only from the year it stays cheaper')
}

// Not ready without a trade, a price and a bill.
{
  assert.equal(run({ ...JOB_A, trades: createRemodelRoiDefaults(config).trades }).ready, false, 'no trade → not ready')
  const noPrice = run({ ...JOB_A, project: { ...JOB_A.project, price: null } })
  assert.equal(noPrice.ready, false, 'no price → not ready')
  assert.equal(noPrice.milestones.paysForItselfYear, null, 'no milestones when not ready')
  assert.equal(run({ ...JOB_A, bills: createRemodelRoiDefaults(config).bills }).ready, false, 'no bills → not ready')
}

// Provenance: an empty field is the working number, a typed one is the homeowner's.
{
  const p = run(JOB_A)
  assert.deepEqual(p.project.aprPercent, { value: 8.99, source: 'working' }, 'blank APR → working 8.99%')
  assert.deepEqual(p.replacements[0].likeForLikePrice, { value: 16000, source: 'working' }, 'blank like-for-like price → working')
  assert.deepEqual(p.assumptions.ratesPercent.electric, { value: 9.4, source: 'working' }, 'blank rate → working')
  const typed = run({ ...JOB_A, project: { ...JOB_A.project, aprPercent: 6.5 }, assumptions: { ...JOB_A.assumptions, constructionPercent: 5 } })
  assert.deepEqual(typed.project.aprPercent, { value: 6.5, source: 'input' }, 'typed APR → input')
  assert.deepEqual(typed.assumptions.constructionPercent, { value: 5, source: 'input' }, 'typing the working value still counts as typed')
}

// Typed cuts clamp to the bill.
{
  const cut = (mode: 'percent' | 'amount', value: number) => run({ ...JOB_A, bills: { ...JOB_A.bills, electric: { now: 380, cut: { mode, value } } } }).cuts.electric
  assert.equal(cut('percent', 150).after, 0, '150% off → $0, never negative')
  assert.equal(cut('amount', 500).after, 0, '$500 off a $380 bill → $0')
  near(cut('percent', 40).after, 228, '40% off $380', 1e-9)
  assert.equal(cut('percent', 40).typed, true, 'a typed cut is marked typed')
}

// A current one without an age stays off the wait path; one past its standard life gives out in year 1.
{
  const blank = run(job((v) => {
    v.trades.hvac = picks.hvac
    v.project.price = 32000
  }))
  assert.equal(blank.replacements.length, 0, 'blank age → not on the wait path')
  const old = run(job((v) => {
    v.trades.hvac = { ducts: false, current: { ...picks.hvac.current, ageYears: 25 } }
    v.project.price = 32000
  }))
  assert.equal(old.replacements[0].installs[0].year, 1, 'past its standard life → gives out in year 1')
  const young = run(job((v) => {
    v.trades.roof = { current: { ...picks.roof.current, ageYears: 2 } }
    v.project.price = 32000
  }))
  assert.equal(young.replacements.length, 0, 'a current one that outlasts the projection → not on the wait path')
}

// Net worth: loans line up with the form's rows by index; a payment under the interest holds a loan flat.
{
  const p = run({
    ...JOB_A,
    homeValue: 850000,
    liabilities: [
      { label: 'Mortgage', balance: 420000, monthlyPayment: 2650, aprPercent: 3.5, kind: 'mortgage' },
      { label: '', balance: null, monthlyPayment: null, aprPercent: null, kind: 'other' },
      { label: 'Card', balance: 9000, monthlyPayment: 270, aprPercent: 24, kind: 'other' },
      { label: 'Card', balance: 5000, monthlyPayment: 20, aprPercent: 24, kind: 'other' },
    ],
  })
  assert.deepEqual(p.liabilities.map(liability => [liability.index, liability.heldFlat]), [[0, false], [2, false], [3, true]], 'rows keep their form index; same labels never collide')
  near(p.years[10].netWorth!.now, 1059863.33, 'net worth, upgrade now, year 10 (pinned)')
  near(p.years[10].netWorth!.wait, 1044277.7, 'net worth, wait, year 10 (pinned)')
  near(p.liabilitiesMonthly, 2940, 'loan payments add up')
  assert.equal(run(JOB_A).years[10].netWorth, null, 'no home value → no net worth')
}

// The form schema rejects out-of-range values, so the hook never projects them.
assert.equal(remodelRoiFormSchema.safeParse({ ...JOB_A, assumptions: { ...JOB_A.assumptions, constructionPercent: 60 } }).success, false, 'a 60% rate is invalid')
assert.equal(remodelRoiFormSchema.safeParse(JOB_A).success, true, 'sample job A is valid')

// No NaN or Infinity across boundary inputs.
for (const values of [createRemodelRoiDefaults(config), JOB_A, cash(JOB_D), { ...JOB_A, project: { ...JOB_A.project, termYears: 25 as const, aprPercent: 0, downPayment: 999999 } }]) {
  for (const year of run(values).years) {
    for (const [field, value] of Object.entries(year)) {
      if (typeof value === 'number') {
        assert.ok(Number.isFinite(value), `year ${year.t} ${field} is ${value}`)
      }
    }
    for (const category of BILL_CATEGORIES) {
      assert.ok(year.billsAfterByCategory[category] >= 0, `year ${year.t} ${category} after is never negative`)
    }
  }
}

assert.equal(formatYears(1), '1 year', 'singular')
assert.equal(formatYears(10), '10 years', 'plural')

console.log('✅ verify-remodel-roi: all checks passed')
