import type { TradeBillCuts } from '@/shared/modules/construction/core/schemas/bill-cuts'

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { tradeBenefits } from '@/features/landing/constants/trade-benefits'
import { BENEFIT_TEMPLATES } from '@/features/meeting-flow/constants/persona-profile-maps'
import { TRADE_BENEFIT_EXCLUSIONS } from '@/features/meeting-flow/constants/trade-benefit-exclusions'
import { BILL_CUT_CLAIMS } from '@/shared/modules/construction/core/constants/bill-cut-claims'
import { TRADE_BILL_CUTS } from '@/shared/modules/construction/core/constants/trade-bill-cuts'
import { claimCutPercent, formatCompoundClaim, formatCompoundTile, formatRowClaim, formatRowTile, tradeCutPercent } from '@/shared/modules/construction/core/lib/bill-cut-claims'

function near(actual: number, expected: number, message: string, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`)
}

// ── The heating-and-cooling claim, recomputed by hand from the table ───────────
const table: TradeBillCuts = TRADE_BILL_CUTS
const picks = BILL_CUT_CLAIMS['heating-and-cooling']
assert.deepEqual([...picks.trades], ['hvac', 'attic-and-basement', 'windows-and-doors'], 'the claim is the envelope-plus-HVAC job')
assert.deepEqual([...picks.addOns], ['ducts'], 'ducts ride along')

for (const category of ['electric', 'gas'] as const) {
  let kept = 1
  for (const trade of picks.trades) {
    kept *= 1 - (table[trade]?.base[category] ?? 0) / 100
    for (const addOn of picks.addOns) {
      kept *= 1 - (table[trade]?.addOns?.[addOn]?.[category] ?? 0) / 100
    }
  }
  const combined = (1 - kept) * 100
  const rounded = Math.round(combined / 5) * 5
  assert.equal(claimCutPercent('heating-and-cooling', category), rounded, `${category}: the helper rounds the compound figure to the nearest 5`)
  assert.equal(rounded, 40, `${category}: the table moved the owner-approved "up to about 40%" claim (now ${combined.toFixed(2)}%)`)
}
near((1 - 0.75 * 0.90 * 0.90 * 0.95) * 100, 42.2875, 'electric compounds to 42.29% by hand')
near((1 - 0.80 * 0.85 * 0.92 * 0.95) * 100, 40.568, 'gas compounds to 40.57% by hand')

// ── Single rows read the table as typed ────────────────────────────────────────
assert.equal(tradeCutPercent('attic-and-basement', 'electric'), 10)
assert.equal(tradeCutPercent('attic-and-basement', 'gas'), 15)
assert.equal(tradeCutPercent('hvac', 'electric'), 25)
assert.equal(tradeCutPercent('hvac', 'gas'), 20)
assert.equal(tradeCutPercent('windows-and-doors', 'electric'), 10)
assert.equal(tradeCutPercent('dryscaping', 'water'), 40)
assert.equal(tradeCutPercent('dryscaping', 'electric'), 0, 'a category the trade does not cut reads 0')
assert.equal(tradeCutPercent('kitchen-remodel', 'electric'), 0, 'a trade with no row reads 0')
assert.equal(tradeCutPercent('hvac', 'electric', ['ducts']), 29, 'add-ons compound on the row (28.75 → 29)')

// ── One phrasing convention ────────────────────────────────────────────────────
assert.equal(formatCompoundClaim(40), 'up to about 40%')
assert.equal(formatRowClaim(10), 'about 10%')
assert.equal(formatCompoundTile(40), 'Up to ~40%')
assert.equal(formatRowTile(25), '–25%')

// ── The copy renders the table's numbers ───────────────────────────────────────
assert.equal(BENEFIT_TEMPLATES['Financial Leak'].byTrade.HVAC, 'A high-efficiency system can cut cooling costs by about 25% and heating by about 20% compared to an aging unit')
assert.equal(BENEFIT_TEMPLATES['Deferred Lifestyle Upgrades'].byTrade.Dryscaping, 'Drought-resistant landscaping cuts water bills by about 40% and eliminates maintenance headaches')
const liveBenefitBodies = new Set(Object.values(BENEFIT_TEMPLATES).flatMap(template => Object.values(template.byTrade)))
for (const excluded of TRADE_BENEFIT_EXCLUSIONS) {
  assert.ok(liveBenefitBodies.has(excluded), `an exclusion no longer matches any rendered benefit, so it excludes nothing: ${excluded}`)
}
assert.equal(tradeBenefits.hvac?.[0]?.stat, '–25%', 'the HVAC tile reads the table')
assert.ok(tradeBenefits['water-heating']?.every(benefit => !/%/.test(benefit.stat ?? '')), 'water heating carries no savings stat')

// ── No savings percentage typed by hand ────────────────────────────────────────
const COPY_FILES = [
  'src/features/meeting-flow/constants/programs.ts',
  'src/features/meeting-flow/lib/profile-benefits.ts',
  'src/features/meeting-flow/constants/trade-outcomes.ts',
  'src/features/meeting-flow/constants/persona-profile-maps.ts',
  'src/features/meeting-flow/constants/trade-benefit-exclusions.ts',
  'src/features/landing/constants/pillar-config.ts',
  'src/features/landing/constants/trade-benefits.ts',
  'src/features/landing/constants/trade-outcome-statements.ts',
]
const STRING_LITERAL = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g
const RANGE_CLAIM = /(?<!\d)\d{1,2}[–—-]\d{1,2}%/
const PERCENT_CLAIM = /(?<!\d)\d{1,2}%/
// The tile forms are savings claims by convention, and a tile keeps its bill word in a sibling label literal.
const TILE_CLAIM = /[~–]\d{1,2}%/
const BILL_WORDS = /\b(?:bills?|energy|heating|cooling|electric|gas|water|utility)/i
// Resale and ROI figures are not bill cuts. A stat tile keeps its label in a sibling literal, so the allow reads the whole line.
const RESALE_LINE = /resale|ROI|at closing/

for (const file of COPY_FILES) {
  const source = readFileSync(file, 'utf8')
  for (const match of source.matchAll(STRING_LITERAL)) {
    const literal = match[0]
    const lineStart = source.lastIndexOf('\n', match.index) + 1
    const lineEnd = source.indexOf('\n', match.index)
    const line = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd)
    if (RESALE_LINE.test(line)) {
      continue
    }
    const at = `${file}:${source.slice(0, match.index).split('\n').length}`
    assert.ok(!RANGE_CLAIM.test(literal), `${at} types a savings range by hand: ${literal}`)
    assert.ok(!(PERCENT_CLAIM.test(literal) && BILL_WORDS.test(literal)), `${at} types a bill-savings percent by hand: ${literal}`)
    assert.ok(!TILE_CLAIM.test(literal), `${at} types a savings tile by hand: ${literal}`)
  }
}

console.log('✅ verify-bill-cut-claims: all checks passed')
