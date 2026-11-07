import type { PricingKey } from '@/features/calculators/scope-pricing-calculator/constants/pricing-keys'
import type { ProjectContext } from '@/features/calculators/scope-pricing-calculator/schemas/form'
import type { PriceQuoteInput, QuoteLineInput, VariableDef, VariableInputs, VariableKey } from '@/features/calculators/scope-pricing-calculator/types'

import assert from 'node:assert/strict'

import { PRICING_KEYS } from '@/features/calculators/scope-pricing-calculator/constants/pricing-keys'
import { CURRENT_ROOF_TYPES, NUM_STORIES_OPTIONS } from '@/features/calculators/scope-pricing-calculator/constants/project-context'
import { PRICING_TRADES } from '@/features/calculators/scope-pricing-calculator/constants/trade-labels'
import { UNIT_COST_LABELS } from '@/features/calculators/scope-pricing-calculator/constants/unit-cost-labels'
import { VARIABLES } from '@/features/calculators/scope-pricing-calculator/constants/variables'
import { describeTargetResult } from '@/features/calculators/scope-pricing-calculator/lib/describe-target-result'
import { formatUnitCost } from '@/features/calculators/scope-pricing-calculator/lib/format-unit-cost'
import { FORMULAS } from '@/features/calculators/scope-pricing-calculator/lib/formula-registry'
import { priceQuote } from '@/features/calculators/scope-pricing-calculator/lib/price-quote'
import { resolveScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/lib/resolve-config'
import { resolveFormulaVariables } from '@/features/calculators/scope-pricing-calculator/lib/resolve-formula-variables'
import { solveMultiplier } from '@/features/calculators/scope-pricing-calculator/lib/solve-multiplier'
import { stepMultiplier } from '@/features/calculators/scope-pricing-calculator/lib/step-multiplier'
import { tradesInQuote } from '@/features/calculators/scope-pricing-calculator/lib/trades-in-quote'
import { unitCostEntries } from '@/features/calculators/scope-pricing-calculator/lib/unit-cost-entries'
import { scopePricingConfigSchema } from '@/features/calculators/scope-pricing-calculator/schemas/config'

const config = resolveScopePricingConfig()

// ── Config ──────────────────────────────────────────────────────────────────
assert.equal(config.unitCosts.roof.BSQTearOffShingles, 480, 'roof tear-off shingles unit cost')
assert.equal(config.unitCosts.hvac.perTonStep, 800, 'HVAC per-ton step')
assert.equal(config.unitCosts.electricals.mpuBase, 4500, 'MPU base')
assert.equal(config.unitCosts.electricals.mpuWithRelocation, 5500, 'MPU with relocation')
assert.deepEqual(config.multiplier.byScope, { installExteriorPaint: 3.5, mpu: 2.5 }, 'scope defaults')
assert.equal(scopePricingConfigSchema.safeParse({ ...config, multiplier: { ...config.multiplier, byScope: { mpu: 1.5 } } }).success, false, 'scope default below floor is rejected')
assert.equal(config.unitCosts.dryscapingHardscaping.dollarPerSqFtDg, 5, 'DG $/sqft')
assert.equal(config.multiplier.default, 2.8, 'default multiplier')
assert.equal(config.multiplier.floor, 2, 'multiplier floor')
assert.equal(config.taxRatePercent, 7.5, 'tax rate')
assert.equal(config.permitFees.roof.enabled, false, 'roof permit off by default')
assert.equal(scopePricingConfigSchema.safeParse({ ...config, multiplier: { default: 1.5, floor: 2 } }).success, false, 'default below floor is rejected')
assert.equal(scopePricingConfigSchema.safeParse({ ...config, taxRatePercent: 25 }).success, false, 'tax rate above 20 is rejected')
assert.equal(scopePricingConfigSchema.safeParse({ ...config, exteriorPaintTiers: { smallBelowSqFt: 3000, largeAboveSqFt: 1500 } }).success, false, 'inverted paint tiers are rejected')
for (const trade of PRICING_TRADES) {
  assert.deepEqual(Object.keys(UNIT_COST_LABELS[trade]).sort(), Object.keys(config.unitCosts[trade]).sort(), `${trade}: every Unit Cost has a label`)
}

// ── Registry ────────────────────────────────────────────────────────────────
assert.equal(Object.keys(FORMULAS).length, 21, '21 Formulas')
for (const key of PRICING_KEYS) {
  const formula = FORMULAS[key]
  assert.equal(formula.key, key, `${key}: registry key matches the Formula's key`)
  assert.ok(formula.label.length > 0 && formula.outcome.length > 0, `${key}: label and outcome present`)
  for (const variable of formula.variables) {
    assert.equal(VARIABLES[variable].trade, formula.trade, `${key}: ${variable} belongs to the Formula's trade`)
  }
}

// ── Golden Costs (one per Formula) ───────────────────────────────────────────
const oneStory: ProjectContext = { numStories: 1, currentRoofType: 'shingle' }
const twoStory: ProjectContext = { numStories: 2, currentRoofType: 'shingle' }
const twoStoryTile: ProjectContext = { numStories: 2, currentRoofType: 'tile' }

function costOf(key: PricingKey, inputs: VariableInputs, context: ProjectContext): number | null {
  const formula = FORMULAS[key]
  const resolved = resolveFormulaVariables(formula, inputs)
  if (!resolved.ok) {
    throw new Error(`${key}: expected variables to resolve, missing ${resolved.needs.join(', ')}`)
  }
  const cost = formula.compute(resolved.values, context, config.unitCosts[formula.trade], config)
  return cost == null ? null : Math.round(cost)
}

const roofInputs: VariableInputs = { numFlatBSQ: 5, numPitchedBSQ: 20, numLayers: 2 }
const golden: [PricingKey, VariableInputs, ProjectContext, number | null][] = [
  ['overlay', { numFlatBSQ: 5, numPitchedBSQ: 20 }, twoStory, 11125],
  ['tearOff', roofInputs, twoStory, 13375],
  ['tearOff', roofInputs, twoStoryTile, 18775],
  ['redeck', roofInputs, twoStory, 18375],
  ['tileReset', { numPitchedBSQ: 20 }, twoStory, 12100],
  ['replaceSplitSystem', { systemTonnage: 4 }, oneStory, 9300],
  ['replaceSplitSystem', { systemTonnage: 2 }, oneStory, 7700],
  ['replaceSplitSystem', { systemTonnage: null }, oneStory, 8500], // an unselected tonnage uses the default 3, not $6,100
  ['replaceFurnace', { systemTonnage: 3 }, oneStory, 7000],
  ['installMiniSplit', { numMiniSplits: 3 }, oneStory, 9000],
  ['replaceWindows', { numSmallWindows: 4, numLargeWindows: 2 }, oneStory, 3500],
  ['replaceSlidingDoor', { numStandardSliders: 1, numSpecialSliders: 1 }, oneStory, 5500],
  ['replaceFrenchDoors', { numFrenchDoors: 2 }, oneStory, 10000], // no longer $0
  ['rnrAttic', { sqft: 1000 }, oneStory, 2500],
  ['topOffAttic', { sqft: 1000 }, oneStory, 1300],
  ['installCrawlSpaceInsulation', { sqft: 1000 }, oneStory, 2300],
  ['installArtificial', { installSqFt: 500 }, oneStory, 3500],
  ['installGravel', { installSqFt: 500 }, oneStory, 3000],
  ['installMulch', { installSqFt: 500 }, oneStory, 2500],
  ['installConcrete', { installSqFt: 500 }, oneStory, 5500],
  ['installPavers', { installSqFt: 500 }, oneStory, 5500],
  ['installDg', { installSqFt: 500 }, oneStory, 2500], // prices instead of NaN
  ['mpu', { relocationRequired: false }, oneStory, 4500],
  ['mpu', { relocationRequired: true }, oneStory, 5500],
  ['installExteriorPaint', { paintType: 'coolLife', homeSqFt: 1200, garageSqFt: 200 }, oneStory, 6000],
  ['installExteriorPaint', { paintType: 'water', homeSqFt: 2000, garageSqFt: 400 }, oneStory, 5000],
  ['installExteriorPaint', { paintType: 'coolLife', homeSqFt: 2800, garageSqFt: 400 }, oneStory, 8500],
  ['installExteriorPaint', { paintType: 'water', homeSqFt: 1500, garageSqFt: 0 }, oneStory, 5000], // exactly 1,500 → average
  ['installExteriorPaint', { paintType: 'water', homeSqFt: 3000, garageSqFt: 0 }, oneStory, 5000], // exactly 3,000 → average
]
for (const [key, inputs, context, expected] of golden) {
  assert.equal(costOf(key, inputs, context), expected, `${key} ${JSON.stringify(inputs)} ${JSON.stringify(context)}`)
}
assert.equal(new Set(golden.map(([key]) => key)).size, PRICING_KEYS.length, 'every Formula has a golden case')

// ── Incomplete inputs are never priced ──────────────────────────────────────
function needsOf(key: PricingKey, inputs: VariableInputs): VariableKey[] {
  const resolved = resolveFormulaVariables(FORMULAS[key], inputs)
  assert.equal(resolved.ok, false, `${key} ${JSON.stringify(inputs)} should be incomplete`)
  return resolved.ok ? [] : resolved.needs
}
assert.deepEqual(needsOf('rnrAttic', { sqft: null }), ['sqft'], 'required Variable cleared')
assert.deepEqual(needsOf('installExteriorPaint', { homeSqFt: 1200, garageSqFt: 200 }), ['paintType'], 'missing paint type')
assert.deepEqual(needsOf('overlay', { numFlatBSQ: 5, numPitchedBSQ: 900 }), ['numPitchedBSQ'], 'out of range')
assert.deepEqual(needsOf('replaceSplitSystem', { systemTonnage: 7 }), ['systemTonnage'], 'not one of the options')
assert.deepEqual(needsOf('rnrAttic', { sqft: -5 }), ['sqft'], 'negative area')
assert.equal(costOf('overlay', { numFlatBSQ: null, numPitchedBSQ: 10 }, oneStory), 4200, 'cleared defaulted Variable uses its default')

// ── Exhaustive sweep: every option and boundary, every context ──────────────
function candidates(key: VariableKey): (number | string | boolean)[] {
  const def: VariableDef = VARIABLES[key]
  if (def.kind === 'number') {
    return [def.min, (def.min + def.max) / 2, def.max]
  }
  if (def.kind === 'boolean') {
    return [false, true]
  }
  return [...def.options]
}
function combos(keys: readonly VariableKey[]): VariableInputs[] {
  return keys.reduce<VariableInputs[]>(
    (acc, key) => acc.flatMap(partial => candidates(key).map(value => ({ ...partial, [key]: value }))),
    [{}],
  )
}
let swept = 0
for (const key of PRICING_KEYS) {
  for (const inputs of combos(FORMULAS[key].variables)) {
    for (const numStories of NUM_STORIES_OPTIONS) {
      for (const currentRoofType of CURRENT_ROOF_TYPES) {
        const cost = costOf(key, inputs, { numStories, currentRoofType })
        assert.ok(cost != null && Number.isFinite(cost) && cost >= 0, `${key} ${JSON.stringify(inputs)} gave ${cost}`)
        swept++
      }
    }
  }
}
console.log(`swept ${swept} Formula inputs`)

// ── Quote pricing ─────────────────────────────────────────────────────────
const attic: QuoteLineInput = { id: 'a', kind: 'formula', pricingKey: 'rnrAttic', variables: { sqft: 4000 } }
const atticQuote = priceQuote({ lines: [attic], context: oneStory, config })
const atticLine = atticQuote.lines[0]
assert.ok(atticLine?.status === 'priced', 'attic line priced')
assert.deepEqual(
  { cost: atticLine.cost, price: atticLine.price, tax: atticLine.tax, base: atticLine.base },
  { cost: 10000, price: 28000, tax: 1953, base: 26047 },
  'golden: 4,000 sq ft → Cost 10,000 → Price 28,000 → base 26,047 (28,000 / 1.075) → tax 1,953',
)
assert.equal(atticQuote.totalPrice, 28000, 'total price')
assert.equal(atticQuote.multiplier, 2.8, 'default multiplier applied')
assert.equal(atticQuote.tier, 'healthy', '2.8 is healthy')
assert.equal(atticQuote.margin, 18000, 'margin')

assert.equal(priceQuote({ lines: [attic], context: oneStory, config, overrides: { multiplier: 1.5 } }).multiplier, 2, 'override below the floor is clamped')
assert.equal(priceQuote({ lines: [attic], context: oneStory, config, overrides: { multiplier: Number.NaN } }).multiplier, 2.8, 'NaN override is ignored')
assert.equal(priceQuote({ lines: [attic], context: oneStory, config, overrides: { multiplier: 3.25 } }).totalPrice, 32500, 'override above the floor applies')

type FormulaLineInput = Extract<QuoteLineInput, { kind: 'formula' }>
const tearOffLine = (id: string): FormulaLineInput => ({ id, kind: 'formula', pricingKey: 'tearOff', variables: { numFlatBSQ: 5, numPitchedBSQ: 20, numLayers: 2 } })
const twice = priceQuote({ lines: [tearOffLine('r1'), tearOffLine('r2')], context: twoStory, config })
assert.equal(twice.lines.filter(line => line.status === 'priced').length, 2, 'the same scope twice prices twice')
assert.equal(twice.totalCost, 26750, 'both tear-offs counted')

const manual: QuoteLineInput = { id: 'm', kind: 'manual', label: 'Gutters', price: 5000 }
const mixed = priceQuote({ lines: [attic, manual], context: oneStory, config })
const manualResult = mixed.lines[1]
assert.ok(manualResult?.status === 'priced', 'manual line priced')
assert.deepEqual({ cost: manualResult.cost, tax: manualResult.tax, base: manualResult.base }, { cost: null, tax: 349, base: 4651 }, 'manual line: no cost, tax inside the price')
assert.equal(mixed.totalPrice, 33000, 'manual price counts toward the total')
assert.equal(mixed.margin, 18000, 'manual line left out of margin')
assert.equal(mixed.effectiveMultiplier, 2.8, 'manual line left out of the multiplier')
assert.equal(mixed.hasUncostedLines, true, 'flags uncosted lines')

const unpriced = priceQuote({
  lines: [attic, { id: 'x', kind: 'manual', label: '', price: null }, { id: 'y', kind: 'formula', pricingKey: 'rnrAttic', variables: { sqft: null } }],
  context: oneStory,
  config,
})
assert.equal(unpriced.totalPrice, 28000, 'incomplete lines are left out of the total')
assert.deepEqual(unpriced.lines.map(line => line.status), ['priced', 'incomplete', 'incomplete'], 'order kept, incomplete marked')
const incompleteAttic = unpriced.lines[2]
assert.ok(incompleteAttic?.status === 'incomplete', 'narrow')
assert.deepEqual(incompleteAttic.needs, ['sqft'], 'incomplete line names what it needs')

assert.equal(priceQuote({ lines: [tearOffLine('r1')], context: twoStory, config }).lines.length, 1, 'permits are off by default')
const withPermit = { ...config, permitFees: { ...config.permitFees, roof: { amount: 250, enabled: true } } }
const permitted = priceQuote({ lines: [tearOffLine('r1'), tearOffLine('r2'), attic], context: twoStory, config: withPermit })
const permitLines = permitted.lines.filter(line => line.kind === 'permit')
assert.equal(permitLines.length, 1, 'one permit per trade, however many roof lines')
assert.deepEqual(
  permitLines.map(line => line.status === 'priced' && { id: line.id, label: line.label, cost: line.cost, price: line.price }),
  [{ id: 'permit-roof', label: 'Permit (Roof)', cost: 250, price: 700 }],
  'permit priced like a formula line',
)
assert.equal(permitted.lines[permitted.lines.length - 1]?.kind, 'permit', 'permit lines come last')
assert.equal(priceQuote({ lines: [attic], context: oneStory, config: withPermit }).lines.length, 1, 'no roof line → no roof permit')

// ── Multiplier layers ──────────────────────────────────────────────────────
const mpuLine = (id: string, multiplierOverride: number | null = null): FormulaLineInput => ({ id, kind: 'formula', pricingKey: 'mpu', variables: { relocationRequired: false }, multiplierOverride })
const roofLine = tearOffLine('roof') // cost 13,375 at twoStory
const mpuQuote = priceQuote({ lines: [mpuLine('m1'), mpuLine('m2', null)], context: oneStory, config })
const mpuPriced = mpuQuote.lines[0]
assert.ok(mpuPriced?.status === 'priced', 'MPU priced')
assert.deepEqual({ cost: mpuPriced.cost, price: mpuPriced.price, multiplier: mpuPriced.multiplier }, { cost: 4500, price: 11250, multiplier: 2.5 }, 'MPU sells at its scope default 2.5')
assert.equal(priceQuote({ lines: [{ ...mpuLine('m'), variables: { relocationRequired: true } }], context: oneStory, config }).totalPrice, 13750, 'MPU with relocation at 2.5')
assert.equal(mpuQuote.multiplier, 2.8, 'the proposal-wide value rests at the default even when every scope has its own default')

const shifted = priceQuote({ lines: [mpuLine('m'), roofLine], context: twoStory, config, overrides: { multiplier: 2.85 } })
assert.deepEqual(shifted.lines.map(line => line.status === 'priced' && line.price), [11475, 38119], 'proposal-wide 2.85 shifts MPU to 2.55 and roof to 2.85')
assert.ok(shifted.lines[0]?.status === 'priced' && Math.abs((shifted.lines[0].multiplier ?? 0) - 2.55) < 1e-9, 'shifted MPU multiplier is 2.55')
assert.equal(shifted.multiplier, 2.85, 'QuoteResult.multiplier is the control value, not the shift')

const overridden = priceQuote({ lines: [mpuLine('m', 3), roofLine], context: twoStory, config, overrides: { multiplier: 2.85 } })
assert.deepEqual(overridden.lines.map(line => line.status === 'priced' && line.price), [13500, 38119], 'a scope multiplier override is absolute and ignores the shift')
assert.equal(priceQuote({ lines: [mpuLine('m', 1.5)], context: oneStory, config }).totalPrice, 9000, 'an override below the floor is clamped')
assert.equal(priceQuote({ lines: [mpuLine('m')], context: oneStory, config, overrides: { multiplier: 2.6 } }).totalPrice, 10350, 'the control shifts a scope default down too (2.5 − 0.2 = 2.3)')
assert.equal(priceQuote({ lines: [mpuLine('m')], context: oneStory, config, overrides: { multiplier: 2 } }).totalPrice, 9000, 'proposal-wide at the floor would put MPU at 1.7; the floor clamps it to 2.0')
assert.equal(priceQuote({ lines: [mpuLine('m')], context: oneStory, config: { ...config, multiplier: { ...config.multiplier, byScope: { mpu: 2 } } }, overrides: { multiplier: 2.5 } }).totalPrice, 9000, 'a scope default at the floor shifted down prices at the floor')
assert.ok(mixed.lines[1]?.status === 'priced' && mixed.lines[1].multiplier === null, 'manual lines carry no multiplier')
const permitShifted = priceQuote({ lines: [roofLine], context: twoStory, config: withPermit, overrides: { multiplier: 2.85 } }).lines.find(line => line.kind === 'permit')
assert.equal(permitShifted?.status === 'priced' && permitShifted.price, 713, 'permit lines use default + shift (250 × 2.85)')

// ── Target price ──────────────────────────────────────────────────────────
const atticInput: PriceQuoteInput = { lines: [attic], context: oneStory, config }
const reached = solveMultiplier(35000, atticInput)
assert.equal(reached.status, 'reached', 'target above the floor is reached')
assert.ok(Math.abs(reached.achievedTotal - 35000) <= 1, 'achieved total is within rounding of the target')
const withManual = solveMultiplier(35000, { lines: [attic, manual], context: oneStory, config })
assert.ok(withManual.status === 'reached' && Math.abs(withManual.multiplier - 30000 / 10000) < 1e-9, 'manual price is subtracted before solving')
const tooLow = solveMultiplier(15000, atticInput)
assert.deepEqual(tooLow, { status: 'below-floor', multiplier: 2, achievedTotal: 20000 }, 'target under the floor → floor price')
assert.equal(solveMultiplier(1000, { lines: [attic, manual], context: oneStory, config }).status, 'below-floor', 'target under the manual lines → below floor')
assert.deepEqual(solveMultiplier(100000, { lines: [manual], context: oneStory, config }), { status: 'no-cost' }, 'no Cost to solve against')
const spread: PriceQuoteInput = { lines: [mpuLine('m'), roofLine], context: twoStory, config }
const resting = priceQuote(spread) // 11,250 + 37,450 = 48,700
const keepTotal = solveMultiplier(resting.totalPrice, spread)
assert.ok(keepTotal.status === 'reached' && Math.abs(keepTotal.multiplier - 2.8) < 1e-9, 'target = current total solves to the resting 2.8')
assert.equal(keepTotal.status === 'reached' && keepTotal.achievedTotal, resting.totalPrice, 'and no line moves')
const higher = solveMultiplier(resting.totalPrice + 17875, spread) // Σ cost = 17,875, so +1.00 on every scope
assert.ok(higher.status === 'reached' && Math.abs(higher.multiplier - 3.8) < 1e-9, 'a higher target shifts every scope equally')
const overriddenSolve = solveMultiplier(13500 + 40125, { ...spread, lines: [mpuLine('m', 3), roofLine] }) // MPU overridden at 3 → 13,500; roof must reach 40,125 = 13,375 × 3
assert.ok(overriddenSolve.status === 'reached' && Math.abs(overriddenSolve.multiplier - 3) < 1e-9, 'an overridden scope stays put and the shift reaches the target through the others')
assert.deepEqual(solveMultiplier(50000, { ...spread, lines: [mpuLine('m', 3), { ...roofLine, multiplierOverride: 3 }] }), { status: 'all-overridden' }, 'every costed scope overridden → nothing to solve')
assert.equal(solveMultiplier(9000 + 13375 * 2.3, spread).status, 'reached', 'a shift that lands MPU exactly on the floor is reached')
const clampedCarry = solveMultiplier(8000 + 13375 * 2.3, spread) // −0.556 would put MPU at 1.944: MPU is held at the floor ($9,000) and the roof carries the rest
assert.ok(clampedCarry.status === 'reached' && Math.abs(clampedCarry.multiplier - (2.8 - 7687.5 / 13375)) < 1e-9, 'a scope the floor clamps is held there and the shift is re-solved over the rest')
assert.ok(clampedCarry.status === 'reached' && Math.abs(clampedCarry.achievedTotal - (8000 + 13375 * 2.3)) <= 1, 'the target is still reached within rounding')
assert.deepEqual(solveMultiplier(30000, spread), { status: 'below-floor', multiplier: 2, achievedTotal: 35750 }, 'a target under the floor total reports the floor and the floor total')

// ── Agent panel helpers ─────────────────────────────────────────────────────
assert.equal(stepMultiplier(2.8, 0.05, 2), 2.85, 'step up rounds to 2 decimals')
assert.equal(stepMultiplier(2.03, -0.05, 2), 2, 'step down stops at the floor')
assert.equal(formatUnitCost(3.5), '$3.50', 'fractional Unit Cost keeps cents')
assert.equal(formatUnitCost(8500), '$8,500', 'whole Unit Cost has no cents')
assert.deepEqual(unitCostEntries(config, 'electricals'), [
  { key: 'mpuBase', label: 'Main panel upgrade', value: 4500 },
  { key: 'mpuWithRelocation', label: 'Main panel upgrade (with relocation)', value: 5500 },
], 'Unit Cost entries carry the seed labels')
assert.deepEqual(tradesInQuote(mixed), ['atticBasement'], 'trades from formula lines only')
assert.match(describeTargetResult(tooLow, 2), /2\.00x floor/, 'below-floor copy names the floor')
assert.match(describeTargetResult({ status: 'no-cost' }, 2), /formula/, 'no-cost copy')
assert.match(describeTargetResult({ status: 'all-overridden' }, 2), /own multiplier/, 'all-overridden copy')

console.log('✅ verify-scope-pricing passed')
