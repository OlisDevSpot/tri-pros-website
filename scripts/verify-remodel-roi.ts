import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'
import type { ReceiptLine, RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import assert from 'node:assert/strict'

import { BILL_CATEGORIES } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import { createRemodelRoiDefaults, createTradePicks } from '@/features/calculators/remodel-roi-calculator/constants/form-defaults'
import { buildCostOfWaiting } from '@/features/calculators/remodel-roi-calculator/lib/build-cost-of-waiting'
import { buildReturnWaterfall } from '@/features/calculators/remodel-roi-calculator/lib/build-return-waterfall'
import { combineCuts } from '@/features/calculators/remodel-roi-calculator/lib/combine-cuts'
import { formatMoney, roundMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { formatYears } from '@/features/calculators/remodel-roi-calculator/lib/format-years'
import { glueFigures } from '@/features/calculators/remodel-roi-calculator/lib/glue-figures'
import { joinWords } from '@/features/calculators/remodel-roi-calculator/lib/join-words'
import { panelDone, panelSummaries } from '@/features/calculators/remodel-roi-calculator/lib/panel-summaries'
import { projectRemodelRoi } from '@/features/calculators/remodel-roi-calculator/lib/project-remodel-roi'
import { resolveRemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/lib/resolve-config'
import { buildStory } from '@/features/calculators/remodel-roi-calculator/lib/story/build-story'
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
// Incentives cover the whole price: net price is exactly 0, not a tiny negative or positive residue.
const JOB_E = job((v) => {
  v.trades.atticBasement = picks.atticBasement
  v.project.price = 20000
  v.project.incentives = 20000
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
  near(p.years[10].benefit, 23379.77, 'A +10 yrs (pinned)')
  near(p.years[20].benefit, 95699.35, 'A +20 yrs (pinned)')
}

// Return waterfall, built from job A's projection.
{
  const p = run(JOB_A)
  const waterfall = buildReturnWaterfall(p, 10)
  const total = waterfall.rows.at(-1)!
  assert.equal(total.kind, 'total', 'waterfall ends with where you stand')
  near(total.value, p.years[10].benefit, 'waterfall total is the year-10 benefit', 1e-6)
  assert.ok(waterfall.rows.slice(0, -1).every(row => row.kind === (row.value >= 0 ? 'gain' : 'cost')), 'waterfall: gains and costs by sign')
  assert.ok(waterfall.rows.every(row => row.range[0] <= row.range[1] && row.range[0] >= waterfall.low && row.range[1] <= waterfall.high), 'waterfall: every bar inside the axis')
  assert.ok(waterfall.low <= 0 && waterfall.high >= 0, 'waterfall: the axis includes zero')
}
assert.ok(!buildReturnWaterfall(run(cash(JOB_A)), 10).rows.some(row => row.label === 'Interest on your loan'), 'cash job: no loan-interest row')

// Job E: incentives cover the whole price and there's nothing to replace, so every return part is zero or positive.
{
  const waterfall = buildReturnWaterfall(run(JOB_E), 10)
  assert.ok(waterfall.rows.every(row => row.kind !== 'cost') && waterfall.low === 0, 'waterfall: no negative parts → no cost bars, axis starts at 0')
}

// Cost of waiting, built from job A's projection.
{
  const waiting = buildCostOfWaiting(run(JOB_A))
  const hvac = waiting.trades[0]
  assert.deepEqual(hvac.rows.map(row => row.name).slice(0, 2), ['Today', 'Year 3'], 'cost of waiting: today, then the year it gives out')
  near(hvac.rows[1].total, 18522 + 1891.5, 'cost of waiting: the give-out row adds the repairs until then')
  assert.ok(hvac.rows.slice(2).every(row => row.repairs === 0), 'cost of waiting: repairs only on the first give-out')
  assert.ok(waiting.trades.every(trade => trade.rows.every(row => row.total <= waiting.max)), 'cost of waiting: one scale fits every row')
  const blank = buildCostOfWaiting(run(job((v) => {
    v.trades.hvac = picks.hvac
    v.project.price = 32000
  })))
  assert.deepEqual(blank.trades, [], 'cost of waiting: nothing to wait for → no trades')
}

// Job D. Hand-checked: paint aged 8 of 10 → year 2 at 8,000 × 1.05² = $8,820, renewed in year 12 at 8,000 × 1.05¹² = $14,366.85.
{
  const p = run(JOB_D)
  assert.deepEqual(p.replacements[0].installs.map(install => install.year), [2, 12], 'paint renews every 10 years inside the projection')
  near(p.replacements[0].installs[1].price, 14366.85, 'second repaint price')
  assert.deepEqual(p.milestones, { paysForItselfYear: 8, costsLessMonthlyYear: 12, payoffYear: 15 }, 'D milestones (pinned)')
  near(p.years[20].benefit, 30805.51, 'D +20 yrs (pinned)')
  near(p.years[13].valueWait, 0.8 * 14366.85 * 1.04, 'the renewal replaces the earlier repaint\'s value')
}

// Jobs B and C (pinned).
{
  const b = run(JOB_B)
  assert.deepEqual(b.milestones, { paysForItselfYear: 4, costsLessMonthlyYear: 5, payoffYear: 15 }, 'B milestones')
  near(b.years[10].benefit, 24138.33, 'B +10 yrs')
  const c = run(JOB_C)
  assert.deepEqual(c.milestones, { paysForItselfYear: 10, costsLessMonthlyYear: 16, payoffYear: 15 }, 'C milestones')
  near(c.years[10].benefit, 272.54, 'C +10 yrs')
}

// Job E. Incentives cover the whole price, so netPrice is 0 and the job is still ready — the project-price
// return part must print as $0, never "-$0" (the negative-zero trap: 0 - 0 is +0, but -0 is not).
{
  const p = run(JOB_E)
  assert.equal(p.ready, true, 'a fully-incentivized project is still ready')
  assert.equal(p.project.netPrice, 0, 'net price is 0 when incentives cover the price')
  assert.equal(p.years[10].returnParts.projectPrice, 0, 'projectPrice is +0, never -0')
  assert.ok(!Object.is(p.years[10].returnParts.projectPrice, -0), 'never negative zero')
}

// The return parts sum to the benefit every year, financed and cash, for every job.
for (const values of [JOB_A, JOB_B, JOB_C, JOB_D, JOB_E].flatMap(values => [values, cash(values)])) {
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
  near(p.years[10].benefit, 35865.25, 'cash A +10 yrs (pinned)')
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
  assert.equal(p.milestones.costsLessMonthlyYear, 9, 'costs less monthly only from the year it stays cheaper')
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
  assert.deepEqual(p.assumptions.ratesPercent.electric, { value: 7.57, source: 'working' }, 'blank rate → working')
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

// ── Story copy ─────────────────────────────────────────────────────────
{
  const story = (values: RemodelRoiFormValues, lookAhead: 10 | 15 | 20 = 10) => buildStory({ projection: run(values), config, lookAhead })
  const text = (parts: { text: string }[]) => parts.map(part => part.text).join('')
  const a = story(JOB_A)
  assert.deepEqual(a.answer.stats.map(stat => stat.value), ['Year 3', 'Year 4', '+$23,000'], 'A headline figures')
  assert.deepEqual(story(JOB_A, 20).answer.stats.map(stat => stat.value), ['Year 3', 'Year 4', '+$96,000'], 'the look-ahead moves only the amount')
  assert.ok(a.answer.note, 'pays for itself before it costs less monthly → the note explains why')
  assert.equal(text(a.monthly.answer), 'For the first 3 years, upgrading costs up to about $106 more a month. From year 4, it costs less every month: $196 less by year 10.', 'A monthly answer')
  assert.equal(text(a.waiting.answer), 'Waiting doesn\'t skip the HVAC. It moves it to about year 3 and makes it $4,400 more expensive.', 'A waiting answer keeps HVAC uppercase and rounds')
  assert.match(a.intro.body, /Your HVAC is near the end of its life\./, 'intro names the trade')
  assert.equal(formatMoney(1891.5), '$1,892', 'exact dollars in receipts')
  assert.equal(roundMoney(26733.45), '$27,000', 'nearest $1,000 at 10k+')
  assert.equal(roundMoney(4413.5), '$4,400', 'nearest $100 at 1k+')
  assert.equal(roundMoney(-6307.59), '−$6,300', 'negative money keeps its sign')
  assert.equal(formatMoney(-0), '$0', 'negative zero never prints as "-$0"')
  assert.equal(formatMoney(-0.3), '$0', 'a value that rounds to negative zero never prints as "-$0"')
  assert.equal(roundMoney(-0), '$0', 'roundMoney: negative zero never prints as "-$0"')
  assert.equal(joinWords(['roof', 'HVAC']), 'roof and HVAC', 'two words')

  const tags = (content: typeof a.monthly) => Object.fromEntries(content.uses.map(row => [row.label, row.tag]))
  assert.equal(tags(a.monthly).Financing, 'assumption', 'a blank APR is tagged as a working number')
  assert.equal(tags(a.waiting)['HVAC price today'], 'assumption', 'a blank like-for-like price is a working number')
  assert.equal(tags(a.waiting)['HVAC age'], 'yours', 'the age is the homeowner\'s')
  const typed = story({ ...JOB_A, project: { ...JOB_A.project, aprPercent: 6.5 } })
  assert.equal(tags(typed.monthly).Financing, 'yours', 'a typed APR is tagged "You told us"')

  const d = story(JOB_D)
  assert.match(text(d.waiting.answer), /The same kind of exterior paint needs doing again in year 12\./, 'a renewal inside the look-ahead is named')
  assert.match(d.intro.wait, /about year 2, and again in year 12/, 'the intro names both installs')

  const paid = story(cash(JOB_A))
  assert.ok(!paid.monthly.receipt.some(row => row.kind === 'line' && row.label === 'Loan payment'), 'cash → no loan line in the math')
  assert.equal(text(paid.monthly.answer), 'Upgrading costs $218 less a month from the very first month.', 'cash is cheaper from year 1')

  const c = story(JOB_C)
  assert.match(text(c.waiting.answer), /Nothing in this project is about to give out/, 'no aging current one → said plainly')

  const windows = story(job((v) => {
    v.trades.windowsAndDoors = { current: { ...picks.windowsAndDoors.current, ageYears: 22 } }
    v.project.price = 30000
  }))
  assert.match(windows.intro.body, /Your windows and doors are near the end of their life\./, 'plural reads as plural')

  // Job E: incentives cover the whole price, so "paid" (project price + interest, negated) is -0 on both payment modes.
  for (const values of [JOB_E, cash(JOB_E)]) {
    const total = story(values).total
    assert.ok(!total.equation.includes('-$0') && !total.equation.includes('−$0'), 'the total equation never prints negative zero')
    assert.ok(total.receipt.every(row => row.kind !== 'line' || (!row.value.includes('-$0') && !row.value.includes('−$0'))), 'the total receipt never prints negative zero')
  }

  const banned = /\b(?:Cost|Multiplier|Margin)\b/
  for (const content of [a, paid, c, d]) {
    const all = JSON.stringify(content)
    assert.ok(!banned.test(all), 'no Cost / Multiplier / Margin in homeowner copy')
    assert.ok(!/\bhvac\b/.test(all), 'HVAC never lowercased')
  }

  const strings = (value: unknown): string[] => typeof value === 'string'
    ? [value]
    : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : []
  const chapters = (content: ReturnType<typeof story>) => [content.today, content.monthly, content.waiting, content.value, content.total, content.basis]

  // The op carries the sign, so a "+" or "−" line never shows a negative value too ("− Project price −$32,000").
  for (const values of [JOB_A, JOB_B, JOB_C, JOB_D, JOB_E].flatMap(values => [values, cash(values)])) {
    for (const lookAhead of [10, 15, 20] as const) {
      for (const chapter of chapters(story(values, lookAhead))) {
        for (const row of chapter.receipt) {
          if (row.kind === 'line' && (row.op === '+' || row.op === '−')) {
            assert.ok(!/^[−-]/.test(row.value), `"${row.op} ${row.label}" shows ${row.value}`)
          }
        }
      }
    }
  }

  // A loan that doesn't exist is never mentioned; the homeowner's own other loans may be.
  const JOB_A_COVERED = job((v) => {
    v.trades.hvac = { ducts: true, current: { ...picks.hvac.current, ageYears: 15 } }
    v.project.price = 32000
    v.project.incentives = 32000
  })
  assert.equal(run(JOB_A).project.hasLoan, true, 'a financed price leaves a loan')
  for (const values of [cash(JOB_A), JOB_E, JOB_A_COVERED, cash(JOB_A_COVERED)]) {
    assert.equal(run(values).project.hasLoan, false, 'cash or a fully covered price → no project loan')
  }
  for (const values of [cash(JOB_A), JOB_E, cash(JOB_E)]) {
    for (const line of strings(story(values))) {
      assert.ok(!/loan/i.test(line.replace(/other loans/g, '')), `no loan exists, yet: "${line}"`)
    }
  }
  {
    const covered = story(JOB_A_COVERED)
    for (const line of strings(covered)) {
      // The replacement loans are real here, so the headline may still count loans.
      assert.ok(!/loan/i.test(line.replace(/other loans|replacement loans?|counting home value and loans/g, '')), `only the replacement is financed, yet: "${line}"`)
    }
    assert.ok(!covered.intro.wait.includes('the same way'), 'no project loan → the replacement is not "financed the same way"')
    assert.ok(a.monthly.receipt.some(row => row.kind === 'line' && row.label === 'Loan payment'), 'a real loan keeps its line')
  }

  // Each tag says where that value came from.
  const receiptTag = (content: typeof a.monthly, label: string) => content.receipt.find((row): row is ReceiptLine => row.kind === 'line' && row.label === label)?.tag
  assert.equal(receiptTag(a.waiting, 'Age today'), 'yours', 'the current one\'s age is the homeowner\'s')
  assert.equal(receiptTag(a.waiting, 'These usually last'), 'assumption', 'the standard life is a working number')
  assert.equal(receiptTag(a.total, 'Project price'), 'yours', 'a price without incentives is typed')
  assert.equal(receiptTag(story(JOB_E).total, 'Project price, after incentives'), 'calc', 'a price after incentives is calculated')
  assert.equal(tags(a.monthly)['Electric bill'], 'yours', 'today\'s bill is typed')
  assert.equal(tags(a.monthly)['Electric bill after'], 'calc', 'the bill after the cut is calculated')
  assert.equal(tags(a.monthly)['HVAC cut on electric'], 'assumption', 'a trade\'s cut is a working number')
  assert.equal(a.monthly.uses.find(row => row.label === 'HVAC cut on electric')?.value, '−25%', 'the cut shows its percent')
  const typedCut = story({ ...JOB_A, bills: { ...JOB_A.bills, electric: { now: 380, cut: { mode: 'percent', value: 40 } } } })
  assert.equal(tags(typedCut.monthly)['Electric cut'], 'yours', 'a typed cut is the homeowner\'s')
  assert.equal(tags(typedCut.monthly)['HVAC cut on electric'], undefined, 'a typed cut replaces the working cuts')
  assert.equal(tags(a.total)['Project price'], 'yours', 'the price is typed')
  assert.equal(tags(a.total).Financing, 'assumption', 'a blank APR is a working number')
  assert.equal(tags(typed.total).Financing, 'yours', 'a typed APR is the homeowner\'s')
  assert.equal(tags(paid.total).Financing, 'yours', 'paying cash is the homeowner\'s')

  // Sentences round money.
  {
    const big = story(job((v) => {
      v.bills.electric.now = 780
      v.bills.gas.now = 467
      v.trades.atticBasement = picks.atticBasement
      v.project.price = 30000
    }))
    assert.equal(text(big.today.answer), 'You pay about $1,200 a month in household bills today.', 'a bills total over $1,000 rounds in the sentence')
    assert.ok(big.today.receipt.some(row => row.kind === 'line' && row.value === '$780/mo'), 'the receipt stays exact')
  }

  // Every aged current one outlasts the projection: say so, never ask for its age.
  {
    const young = story(job((v) => {
      v.trades.roof = { current: { ...picks.roof.current, ageYears: 2 } }
      v.project.price = 32000
    }))
    assert.equal(text(young.waiting.answer), 'Your roof lasts past year 20, so waiting has no replacement bill attached.', 'an outlasting current one is said plainly')
    assert.ok(!young.waiting.guide.includes('add its age') && !young.waiting.method.includes('None do'), 'no contradiction with the entered age')
    const blank = story(job((v) => {
      v.trades.hvac = picks.hvac
      v.project.price = 32000
    }))
    assert.ok(blank.waiting.guide.includes('add its age'), 'no age entered → the guide asks for it')
  }

  // "Near the end of its life" only when it gives out soon.
  {
    const midlife = story(job((v) => {
      v.trades.hvac = { ducts: false, current: { ...picks.hvac.current, ageYears: 8 } }
      v.project.price = 32000
    }))
    assert.ok(!midlife.intro.body.includes('near the end'), 'ten years left is not near the end')
    assert.match(midlife.intro.body, /^Your HVAC is 8 years old and usually lasts about 18 years, so it gives out in about year 10\./, 'the plain fact instead')
  }

  // The early months: "the first year", and no "$0 more".
  {
    const early = (extra: number) => {
      const projection = structuredClone(run(JOB_A))
      projection.milestones.costsLessMonthlyYear = 2
      projection.years[1].monthlyNow = projection.years[1].monthlyWait + extra
      return text(buildStory({ projection, config, lookAhead: 10 }).monthly.answer)
    }
    assert.match(early(50), /^For the first year, upgrading costs up to about \$50 more a month\. From year 2,/, 'singular first year')
    assert.match(early(0.3), /^For the first year, the two paths cost about the same each month\. From year 2,/, 'a rounded $0 is never "costs more"')
  }

  // A falling construction rate reads as falling, with a true minus sign where one is shown.
  {
    const falling = story({ ...JOB_A, assumptions: { ...JOB_A.assumptions, constructionPercent: -20 } })
    assert.equal(text(falling.waiting.answer), 'Waiting doesn\'t skip the HVAC. It moves it to about year 3 and makes it $6,300 cheaper.', 'cheaper, not "−$6,300 more expensive"')
    assert.match(falling.waiting.guide, /^Building costs keep falling, about 20% a year\./, 'fall, not "rise -20%"')
    assert.ok(falling.waiting.receipt.some(row => row.kind === 'line' && row.label === 'Building costs fall 20%/yr for 3 years'), 'the receipt says fall')
    assert.ok(!strings(falling).some(line => /(?:^|\W)-\$?\d/.test(line)), 'no hyphen-minus before a figure')
  }
}

// Figures stay glued to their neighbours without regex lookbehind, which older Safari can't parse.
assert.equal(glueFigures('year 3'), 'year 3', 'glued before a figure')
assert.equal(glueFigures('$4,400 more expensive'), '$4,400 more expensive', 'glued after a figure')
assert.equal(glueFigures('about 3 years'), 'about 3 years', 'glued on both sides')
assert.equal(glueFigures('no figures here'), 'no figures here', 'text without digits is unchanged')
assert.ok(!glueFigures.toString().includes('(?<'), 'no lookbehind')

// ── Panel summaries ────────────────────────────────────────────────────
{
  const p = run(JOB_A)
  assert.deepEqual(panelSummaries(p), {
    trades: 'HVAC (~3 years left) and Attic & Basement',
    project: '$32,000 · 15 yrs at 8.99%',
    bills: '$470/mo today → $302/mo after',
    home: 'Optional · adds net worth',
  }, 'section summaries')
  assert.deepEqual(panelDone(p), { trades: true, project: true, bills: true, home: false }, 'done marks')
  assert.equal(panelSummaries(run(createRemodelRoiDefaults(config))).trades, 'Pick the trades in the project', 'empty trades summary')
  assert.equal(panelSummaries(run({ ...JOB_A, homeValue: 850500 })).home, 'Home $850,500 · 0 loans · $0/mo', 'the home value echoes the input exactly')
}

assert.equal(formatYears(1), '1 year', 'singular')
assert.equal(formatYears(10), '10 years', 'plural')

console.log('✅ verify-remodel-roi: all checks passed')
