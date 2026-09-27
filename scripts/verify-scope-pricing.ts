import type { PricingKey } from '@/features/calculators/scope-pricing-calculator/constants/pricing-keys'
import type { ProjectContext } from '@/features/calculators/scope-pricing-calculator/schemas/form'
import type { VariableDef, VariableInputs, VariableKey } from '@/features/calculators/scope-pricing-calculator/types'

import assert from 'node:assert/strict'

import { PRICING_KEYS } from '@/features/calculators/scope-pricing-calculator/constants/pricing-keys'
import { CURRENT_ROOF_TYPES, NUM_STORIES_OPTIONS } from '@/features/calculators/scope-pricing-calculator/constants/project-context'
import { PRICING_TRADES } from '@/features/calculators/scope-pricing-calculator/constants/trade-labels'
import { UNIT_COST_LABELS } from '@/features/calculators/scope-pricing-calculator/constants/unit-cost-labels'
import { VARIABLES } from '@/features/calculators/scope-pricing-calculator/constants/variables'
import { FORMULAS } from '@/features/calculators/scope-pricing-calculator/lib/formula-registry'
import { resolveScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/lib/resolve-config'
import { resolveFormulaVariables } from '@/features/calculators/scope-pricing-calculator/lib/resolve-formula-variables'
import { scopePricingConfigSchema } from '@/features/calculators/scope-pricing-calculator/schemas/config'

const config = resolveScopePricingConfig()

// ── Config ──────────────────────────────────────────────────────────────────
assert.equal(config.unitCosts.roof.BSQTearOffShingles, 480, 'roof tear-off shingles unit cost')
assert.equal(config.unitCosts.solar.dollarPerWatt, 3.5, 'solar $/W')
assert.equal(config.unitCosts.hvac.perTonStep, 800, 'HVAC per-ton step')
assert.equal(config.unitCosts.electricals.mpuBase, 3200, 'MPU base')
assert.equal(config.unitCosts.electricals.mpuWithRelocation, 4000, 'MPU with relocation')
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
assert.equal(Object.keys(FORMULAS).length, 24, '24 Formulas')
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

function costOf(key: PricingKey, inputs: VariableInputs, context: ProjectContext): number {
  const formula = FORMULAS[key]
  const resolved = resolveFormulaVariables(formula, inputs)
  if (!resolved.ok) {
    throw new Error(`${key}: expected variables to resolve, missing ${resolved.needs.join(', ')}`)
  }
  return Math.round(formula.compute(resolved.values, context, config.unitCosts[formula.trade], config))
}

const roofInputs: VariableInputs = { numFlatBSQ: 5, numPitchedBSQ: 20, numLayers: 2 }
const golden: [PricingKey, VariableInputs, ProjectContext, number][] = [
  ['overlay', { numFlatBSQ: 5, numPitchedBSQ: 20 }, twoStory, 11125],
  ['tearOff', roofInputs, twoStory, 13375],
  ['tearOff', roofInputs, twoStoryTile, 18775],
  ['redeck', roofInputs, twoStory, 18375],
  ['tileReset', { numPitchedBSQ: 20 }, twoStory, 12100],
  ['installPanels', { numPanels: 20, wattsPerPanel: 400 }, oneStory, 28000],
  ['rnrPanels', { numPanels: 20 }, oneStory, 4500],
  ['rnrPanels', {}, oneStory, 0],
  ['installBattery', { numBatteries: 1, kWhPerBattery: 5 }, oneStory, 6000],
  ['installBattery', { numBatteries: 2, kWhPerBattery: 10 }, oneStory, 22000], // 10 kWh uses battery10kWh
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
  ['mpu', { relocationRequired: false }, oneStory, 3200],
  ['mpu', { relocationRequired: true }, oneStory, 4000],
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
assert.deepEqual(needsOf('installPanels', { numPanels: 20, wattsPerPanel: null }), ['wattsPerPanel'], 'required Variable cleared')
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
        assert.ok(Number.isFinite(cost) && cost >= 0, `${key} ${JSON.stringify(inputs)} gave ${cost}`)
        swept++
      }
    }
  }
}
console.log(`swept ${swept} Formula inputs`)

console.log('✅ verify-scope-pricing passed')
