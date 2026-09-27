# Sales Calculators C0 Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two standalone, homeowner-facing calculators at `/dashboard/calculators`: **Scope Pricing** (remodel-x's 24 per-scope Formulas, ported exactly) and **Remodel ROI Calculator** (the now-vs-future idea, rebuilt with correct math). Nothing is persisted.

**Architecture:** A new feature `src/features/calculators/` holds a tabs shell and two independent sub-features, `scope-pricing-calculator/` and `remodel-roi-calculator/`. Each sub-feature has a pure engine in `lib/` that takes a resolved config as a plain argument, a Zod config schema with System defaults, react-hook-form UI that derives results through a hook, and a `scripts/verify-*.ts` self-check. The only shared-file edits are `remainingBalance` in `src/shared/lib/loan-calculations.ts`, one root in `src/shared/config/roots.ts`, and one sidebar entry.

**Tech Stack:** Next.js 15, React, TypeScript (strict), Zod 4 (`import { z } from 'zod'`), react-hook-form 7 + `@hookform/resolvers/zod`, nuqs 2, recharts 2.15, shadcn/ui, lucide-react, `tsx` for verify scripts.

**Spec:** `docs/superpowers/specs/2026-09-26-sales-calculators-c0-port-design.md` (owner-approved 2026-09-26). **Tracker:** `docs/plans/2026-09-26-sales-calculators-epic.md` (IDs R*, D*, O*, SP-*, PR*, UI*, V*, CF*, I*, B-*). Read both before starting.

**Amended 2026-09-26 (tracker R11), after Task 8:** the calculator is renamed Remodel ROI Calculator (tracker R12; names below are updated), and it is the first, default tab. Its fields and data are being redefined in a separate session (`docs/plans/2026-09-26-remodel-roi-calculator-fields-handoff.md`), so its Task 9 layout follows that. **Amended again (R15):** solar is removed from Scope Pricing (21 Formulas); the solar code and golden values in earlier tasks below are history, and the code is authoritative. Task 5's tab code below predates that; `src/features/calculators/constants/query-parsers.ts` and `ui/views/calculators-view.tsx` are authoritative.

## Global Constraints

- **Branch:** work on local `main` (house rule). The tree has unrelated uncommitted files. Stage **by explicit path only**. Never `git add -A`, `git add .`, `git stash`, `git checkout -- .` or `git reset`.
- **Gates on every commit:** `pnpm tsc` and `pnpm lint` both pass. Never run `pnpm build`. Fix style with `pnpm exec eslint --fix <the files you touched>`, never with a repo-wide `--fix`.
- **Verify scripts:** run with `pnpm tsx scripts/<name>.ts`, use `node:assert/strict`, and print one `✅` line on success.
- **Nothing persisted:** no DB, no tRPC, no `localStorage`, no form values in the URL. Only the active tab (`?tab=`) is in the URL (O4, UI2).
- **Engines are pure:** nothing under either `lib/` imports React, tRPC, the DB, `next/*`, or the other sub-feature (O5).
- **The two sub-features never import from each other.** Only `src/features/calculators/ui/views/calculators-view.tsx` knows both exist.
- **Layout rules (V5):** one component per file, named exports only, no module-level constants in component files (they go in `constants/`), `hooks/` holds only `use-*`, `schemas/` is a sibling of `lib/`, and prop interfaces stay in the component file.
- **Imports:** absolute `@/…` paths, type imports first, as in the surrounding code.
- **Comments say why, never what.** No file banners, and never cite a plan, spec, tracker ID or doc in code. Each interim site in spec §11 gets a one-line why-comment. This plan gives the exact wording.
- **Names (spec §2):** Remodel ROI Calculator, Scope Pricing, Formula, Unit Cost, Pricing Key. Never "Snapshot". Tiers: On-screen, Agent-only, Admin-configured, System default.
- **Homeowner copy (O1, O7, O8):** outside the agent panel, the visible text never contains the words "Cost", "Multiplier" or "Margin" (case-sensitive), never shows a Unit Cost, and never makes an uncited claim. "Price" is the only money word on the Scope Pricing screen.
- **Values come verbatim from the seeds.** Unit Costs, Variable labels, scope labels, `outcomeStatement` subtitles and trade labels are copied exactly as this plan gives them (spec §4.1, §10). Do not "tidy" their capitalization.
- **Numbers:** numeric inputs use `NumberField` (`src/shared/components/ui/number-field.tsx`: `null` means empty). Never use `convertToNumber` (UI4). Whole-dollar display uses `formatAsDollars` (`src/shared/lib/formatters.ts`). Multipliers use `formatMultiplier`, and tiers use `getMultiplierTier` (`src/shared/modules/proposals/core/lib/financials/tiers.ts`) and `MULTIPLIER_STYLES` (`src/shared/modules/proposals/core/constants/multiplier-styles.ts`), all reused and never copied.
- **Buttons:** every button that is not a submit button has `type="button"` (UI7). Touch targets are at least 44 px (`h-11` / `size-11`).

## Review Focus

These are the inputs and conditions the spec implies but does not spell out. Each one has a test in the task that owns it.

1. **Switching tabs keeps the rep's entries.** Radix `Tabs` unmounts inactive panels by default, which would wipe a half-built quote when the rep flips to Remodel ROI Calculator and back. Both panels are force-mounted and hidden when inactive. Test: Task 10's Playwright step fills a line, switches tabs twice, and checks the value is still there.
2. **A cleared field falls back sensibly.** Clearing a Variable that has a default (e.g. flat BSQ) prices at the default. Clearing a required one (e.g. watts per panel) makes the line `incomplete` and never priced. An out-of-range entry (900 BSQ) or an unknown option (7 tons) is also `incomplete`, and the field shows its allowed range. Tests: Task 2's verify cases.
3. **Paying cash, or a down payment above the price, counts the project exactly once.** With no loan term, the whole net price is paid at t = 0. A down payment larger than the net price is clamped, so the loan principal is never negative. Tests: Task 4's verify cases.
4. **The word "Cost" never reaches the homeowner.** This includes the Savings chart title and legend (they say "Total paid", "Without the project" and "With the project"). The HVAC outcome line contains a lowercase "costs", so the check is a case-sensitive whole-word match. Test: Task 10's Playwright step on both tabs.
5. **A target price below the manual lines, or one that needs a multiplier under the floor, never prices under the floor.** It reports `below-floor` with the floor price. A quote with only manual lines reports `no-cost`. The same scope added twice prices twice, and an enabled permit is added once per trade. Tests: Task 3's verify cases.

## File map

`SP` = `src/features/calculators/scope-pricing-calculator`, `SV` = `src/features/calculators/remodel-roi-calculator`.

| File | Responsibility | Task |
|---|---|---|
| `src/shared/lib/loan-calculations.ts` (modify) | `+ remainingBalance` | 1 |
| `scripts/verify-remodel-roi.ts` | V4 self-check | 1, 4 |
| `SP/schemas/config.ts` | `scopePricingConfigSchema`, `ScopePricingConfig`, `PricingTrade`, `UnitCostsOf`, `PermitTrade` | 2 |
| `SP/constants/config-defaults.ts` | `SCOPE_PRICING_CONFIG_DEFAULTS` | 2 |
| `SP/lib/resolve-config.ts` | `resolveScopePricingConfig()` (I3) | 2 |
| `SP/constants/trade-labels.ts` | `PRICING_TRADES`, `TRADE_LABELS`, `PERMIT_TRADES` | 2 |
| `SP/constants/unit-cost-labels.ts` | `UNIT_COST_LABELS` (seed verbatim) | 2 |
| `SP/constants/pricing-keys.ts` | `PRICING_KEYS`, `PricingKey` | 2 |
| `SP/constants/project-context.ts` | `NUM_STORIES_OPTIONS`, `CURRENT_ROOF_TYPES` (I9), labels | 2 |
| `SP/constants/variables.ts` | `VARIABLES` (I10) | 2 |
| `SP/constants/variable-units.ts` | `UNIT_SUFFIXES` for option labels | 2 |
| `SP/types/index.ts` | Variable, Formula, quote and solve types | 2, 3 |
| `SP/schemas/form.ts` | `projectContextSchema` (I6), `createScopePricingFormSchema`, form value types | 2, 5 |
| `SP/schemas/formula-variables.ts` | `buildFormulaVariablesSchema(formula)` | 2 |
| `SP/lib/define-formula.ts` | `defineFormula` | 2 |
| `SP/lib/formulas/*.ts` (8 files) | the 24 Formulas | 2 |
| `SP/lib/formula-registry.ts` | `FORMULAS` (I2), `FORMULA_GROUPS` | 2 |
| `SP/lib/resolve-formula-variables.ts` | defaults, then validate, then `needs` | 2 |
| `scripts/verify-scope-pricing.ts` | V2 + V3 self-check | 2, 3 |
| `SP/lib/price-quote.ts` | `priceQuote` (I1, I5) | 3 |
| `SP/lib/solve-multiplier.ts` | `solveMultiplier` | 3 |
| `SV/schemas/config.ts`, `SV/constants/config-defaults.ts` (I4), `SV/lib/resolve-config.ts` (I3) | savings config | 4 |
| `SV/constants/bill-categories.ts`, `SV/constants/rates.ts`, `SV/constants/uplift-modes.ts`, `SV/constants/form-defaults.ts` | savings constants | 4 |
| `SV/schemas/form.ts` | `remodelRoiFormSchema` | 4 |
| `SV/types/index.ts` | `ProjectionYear`, `ProjectionSummary`, `RemodelRoiProjection` | 4 |
| `SV/lib/project-remodel-roi.ts` | `projectRemodelRoi` (I1, I7) | 4 |
| `src/shared/config/roots.ts` (modify) | `+ dashboard.calculators` | 5 |
| `src/features/agent-dashboard/lib/get-sidebar-nav.ts` (modify) | `+ Calculators` entry | 5 |
| `src/app/(frontend)/dashboard/calculators/page.tsx` | thin page | 5 |
| `src/features/calculators/constants/query-parsers.ts` | `CALCULATOR_TABS`, `calculatorTabParser` | 5 |
| `src/features/calculators/ui/views/calculators-view.tsx` | tabs shell (I8) | 5 |
| `SP/ui/views/scope-pricing-calculator.tsx`, `SV/ui/views/remodel-roi-calculator.tsx` | placeholders (5), real (6, 8) | 5, 6, 8 |
| `SP/constants/form-defaults.ts`, `SP/lib/create-quote-line.ts`, `SP/lib/format-variable-option.ts`, `SP/lib/describe-variable-issue.ts`, `SP/hooks/use-scope-pricing-quote.ts` | Scope Pricing UI support | 6 |
| `SP/ui/components/{project-context-fields,variable-field,formula-line-card,manual-line-card,line-price,line-actions,permit-lines,add-scope-picker,quote-total}.tsx` | Scope Pricing UI | 6 |
| `SP/constants/agent-panel.ts`, `SP/lib/{step-multiplier,describe-target-result,format-unit-cost,unit-cost-entries,trades-in-quote}.ts` | agent panel support | 7 |
| `SP/ui/components/agent-panel/{index,agent-readouts,multiplier-control,target-price-control,unit-costs-list}.tsx` | agent panel (Agent-only) | 7 |
| `SV/lib/format-years.ts`, `SV/hooks/use-remodel-roi.ts` | Savings UI support | 8 |
| `SV/ui/components/{step-section,projection-number-field,home-and-loans-step,liability-row,bills-step,project-step,assumptions-step,savings-headline,comparison-card,total-paid-chart}.tsx` | Savings UI | 8 |
| `docs/ubiquitous-language.md`, `docs/plans/2026-09-26-sales-calculators-epic.md` (modify) | glossary + tracker | 11 |

## Sequencing note (one change from spec §9)

Spec §9 put `/ui-warmup` (step 5) before the UI build. The `ui-warmup` skill only works on a surface that already exists ("not for surfaces that do not exist yet"). So this plan builds the calculators first with a plain, functional baseline layout (Tasks 6–8). It then runs `/ui-warmup` on the working screens, and the owner picks a direction (Task 9, **the one owner pause**) before the three-skill audit (Task 10). The engines, form wiring and hooks don't depend on the visual direction. Task 9 changes only layout and styling classes.

---

### Task 1: `remainingBalance` in the shared loan helper

**Files:**
- Modify: `src/shared/lib/loan-calculations.ts` (append after `amortizedMonthlyPayment`, before `getLoanValues`)
- Create: `scripts/verify-remodel-roi.ts`

**Interfaces:**
- Consumes: `amortizedMonthlyPayment(principal, annualRatePercent, termMonths): number` (existing).
- Produces: `remainingBalance(principal: number, annualRatePercent: number, termMonths: number, monthsPaid: number): number`. The rate is a PERCENT (6 means 6%). `termMonths` may be fractional. The result is clamped to `[0, principal]`, and `monthsPaid >= termMonths` returns 0.

- [ ] **Step 1: Write the failing test**

Create `scripts/verify-remodel-roi.ts`:

```ts
/* eslint-disable no-console */
import assert from 'node:assert/strict'

import { amortizedMonthlyPayment, remainingBalance } from '@/shared/lib/loan-calculations'

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

console.log('✅ verify-remodel-roi passed')
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm tsx scripts/verify-remodel-roi.ts`
Expected: FAIL. Either `remainingBalance is not a function` or a missing-export error.

- [ ] **Step 3: Implement**

Append to `src/shared/lib/loan-calculations.ts`, directly after `amortizedMonthlyPayment`:

```ts
/**
 * Balance left on an amortized loan after `monthsPaid` payments. Same PERCENT
 * convention as `amortizedMonthlyPayment`. Clamped to [0, principal]; paid off → 0.
 */
export function remainingBalance(
  principal: number,
  annualRatePercent: number,
  termMonths: number,
  monthsPaid: number,
): number {
  if (principal <= 0 || termMonths <= 0 || monthsPaid >= termMonths) {
    return 0
  }
  const k = Math.max(0, monthsPaid)
  if (annualRatePercent === 0) {
    return principal * (1 - k / termMonths)
  }
  const monthlyRate = annualRatePercent / 100 / 12
  const payment = amortizedMonthlyPayment(principal, annualRatePercent, termMonths)
  const growth = (1 + monthlyRate) ** k
  const balance = principal * growth - (payment * (growth - 1)) / monthlyRate
  return Math.min(principal, Math.max(0, balance))
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm tsx scripts/verify-remodel-roi.ts`
Expected: `✅ verify-remodel-roi passed`

- [ ] **Step 5: Gates**

Run: `pnpm exec eslint --fix src/shared/lib/loan-calculations.ts scripts/verify-remodel-roi.ts && pnpm tsc && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/lib/loan-calculations.ts scripts/verify-remodel-roi.ts
git commit -m "feat(calculators): remainingBalance loan helper

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Scope Pricing catalog (config, Variables, 24 Formulas, registry)

This covers PR1–PR7, PR12 (at the Formula level), CF1, CF2, D5, D6 and R10.

**Files:**
- Create: `SP/schemas/config.ts`, `SP/constants/config-defaults.ts`, `SP/lib/resolve-config.ts`
- Create: `SP/constants/trade-labels.ts`, `SP/constants/unit-cost-labels.ts`, `SP/constants/pricing-keys.ts`, `SP/constants/project-context.ts`, `SP/constants/variables.ts`, `SP/constants/variable-units.ts`
- Create: `SP/types/index.ts`, `SP/schemas/form.ts` (context schema only), `SP/schemas/formula-variables.ts`
- Create: `SP/lib/define-formula.ts`, `SP/lib/resolve-formula-variables.ts`, `SP/lib/formula-registry.ts`
- Create: `SP/lib/formulas/{roof,solar,hvac,windows-and-doors,attic-basement,dryscaping-hardscaping,electricals,exterior-paint-siding}.ts`
- Create: `scripts/verify-scope-pricing.ts`

**Interfaces:**
- Produces:
  - `scopePricingConfigSchema`; the types `ScopePricingConfig`, `PricingTrade`, `UnitCostsOf<T>`, `PermitTrade`.
  - `SCOPE_PRICING_CONFIG_DEFAULTS` and `resolveScopePricingConfig(): ScopePricingConfig`.
  - `PRICING_TRADES`, `TRADE_LABELS`, `PERMIT_TRADES`, `UNIT_COST_LABELS`.
  - `PRICING_KEYS` and `PricingKey`.
  - `NUM_STORIES_OPTIONS`, `CURRENT_ROOF_TYPES`, `CURRENT_ROOF_TYPE_LABELS`.
  - `VARIABLES` and `UNIT_SUFFIXES`.
  - The types `VariableDef`, `VariableKey`, `VariableValues<Keys>`, `VariableInputs`, `Formula`, `FormulaDef<T, Keys>` and `FormulaConfig`.
  - `projectContextSchema` and `ProjectContext`.
  - `buildFormulaVariablesSchema(formula)`.
  - `defineFormula(def)`.
  - `resolveFormulaVariables(formula, inputs): { ok: true, values } | { ok: false, needs: VariableKey[] }`.
  - `FORMULAS: Record<PricingKey, Formula>` and `FORMULA_GROUPS: { trade: PricingTrade, label: string, formulas: Formula[] }[]`.
- A Formula's `compute(vars, context, unitCosts, config)` returns the Cost in dollars (unrounded). `config` is `FormulaConfig = Pick<ScopePricingConfig, 'exteriorPaintTiers'>`: spec §5.2 says exterior paint reads its tiers from config, and this is how the tiers reach the Formula without handing it other trades' Unit Costs.

- [ ] **Step 1: Write the failing test**

Create `scripts/verify-scope-pricing.ts`:

```ts
/* eslint-disable no-console */
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

// ── Golden Costs (one per Formula; the §6 fixes are marked) ─────────────────
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
  ['installBattery', { numBatteries: 2, kWhPerBattery: 10 }, oneStory, 22000], // B-P5: 10 kWh uses battery10kWh
  ['replaceSplitSystem', { systemTonnage: 4 }, oneStory, 9300],
  ['replaceSplitSystem', { systemTonnage: 2 }, oneStory, 7700],
  ['replaceSplitSystem', { systemTonnage: null }, oneStory, 8500], // B-P1: an unselected tonnage uses the default 3, not $6,100
  ['replaceFurnace', { systemTonnage: 3 }, oneStory, 7000],
  ['installMiniSplit', { numMiniSplits: 3 }, oneStory, 9000],
  ['replaceWindows', { numSmallWindows: 4, numLargeWindows: 2 }, oneStory, 3500],
  ['replaceSlidingDoor', { numStandardSliders: 1, numSpecialSliders: 1 }, oneStory, 5500],
  ['replaceFrenchDoors', { numFrenchDoors: 2 }, oneStory, 10000], // B-P4: no longer $0
  ['rnrAttic', { sqft: 1000 }, oneStory, 2500],
  ['topOffAttic', { sqft: 1000 }, oneStory, 1300],
  ['installCrawlSpaceInsulation', { sqft: 1000 }, oneStory, 2300],
  ['installArtificial', { installSqFt: 500 }, oneStory, 3500],
  ['installGravel', { installSqFt: 500 }, oneStory, 3000],
  ['installMulch', { installSqFt: 500 }, oneStory, 2500],
  ['installConcrete', { installSqFt: 500 }, oneStory, 5500],
  ['installPavers', { installSqFt: 500 }, oneStory, 5500],
  ['installDg', { installSqFt: 500 }, oneStory, 2500], // B-P3: prices instead of NaN
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
assert.deepEqual(needsOf('installExteriorPaint', { homeSqFt: 1200, garageSqFt: 200 }), ['paintType'], 'B-P1: missing paint type')
assert.deepEqual(needsOf('overlay', { numFlatBSQ: 5, numPitchedBSQ: 900 }), ['numPitchedBSQ'], 'out of range')
assert.deepEqual(needsOf('replaceSplitSystem', { systemTonnage: 7 }), ['systemTonnage'], 'not one of the options')
assert.deepEqual(needsOf('rnrAttic', { sqft: -5 }), ['sqft'], 'negative area')
assert.equal(costOf('overlay', { numFlatBSQ: null, numPitchedBSQ: 10 }, oneStory), 4200, 'cleared defaulted Variable uses its default')

// ── Exhaustive sweep (V3): every option and boundary, every context ─────────
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm tsx scripts/verify-scope-pricing.ts`
Expected: FAIL with a module-not-found error for `@/features/calculators/...`.

- [ ] **Step 3: Config schema, defaults and resolver**

`SP/schemas/config.ts`:

```ts
import { z } from 'zod'

const unitCost = z.number().min(0)
const permitFee = z.object({ amount: z.number().min(0), enabled: z.boolean() })

export const scopePricingConfigSchema = z.object({
  unitCosts: z.object({
    roof: z.object({
      BSQTearOffFlat: unitCost,
      BSQTearOffShingles: unitCost,
      BSQTearOffTile: unitCost,
      BSQRedeckFlat: unitCost,
      BSQRedeckPitched: unitCost,
      BSQTileReset: unitCost,
      BSQOverlayPitched: unitCost,
      BSQOverlayFlat: unitCost,
      dollarPerAdditionalStory: unitCost,
      dollarPerAdditionalLayer: unitCost,
    }),
    solar: z.object({
      dollarPerWatt: unitCost,
      dollarPerPanelRnr: unitCost,
      battery5kWh: unitCost,
      battery10kWh: unitCost,
    }),
    hvac: z.object({
      threeTonRnr: unitCost,
      furnace36kBTURnr: unitCost,
      miniSplits: unitCost,
      perTonStep: unitCost,
    }),
    windowsAndDoors: z.object({
      windowSmall: unitCost,
      windowLarge: unitCost,
      slidingDoorStandard: unitCost,
      slidingDoorSpecial: unitCost,
      frenchDoor: unitCost,
    }),
    atticBasement: z.object({
      dollarPerSqFtTopOff: unitCost,
      dollarPerSqFtRnr: unitCost,
      dollarPerSqFtCrawlSpace: unitCost,
    }),
    dryscapingHardscaping: z.object({
      dollarPerSqFtArtificial: unitCost,
      dollarPerSqFtGravel: unitCost,
      dollarPerSqFtMulch: unitCost,
      dollarPerSqFtConcrete: unitCost,
      dollarPerSqFtPavers: unitCost,
      dollarPerSqFtDg: unitCost,
    }),
    electricals: z.object({
      mpuBase: unitCost,
      mpuWithRelocation: unitCost,
    }),
    exteriorPaintSiding: z.object({
      coolLifePaintSm: unitCost,
      coolLifePaintAvg: unitCost,
      coolLifePaintLarge: unitCost,
      waterPaintSm: unitCost,
      waterPaintAvg: unitCost,
      waterPaintLarge: unitCost,
    }),
  }),
  exteriorPaintTiers: z
    .object({ smallBelowSqFt: z.number().positive(), largeAboveSqFt: z.number().positive() })
    .refine(tiers => tiers.smallBelowSqFt < tiers.largeAboveSqFt, { message: 'The small-home threshold must be below the large-home threshold' }),
  permitFees: z.object({ roof: permitFee, hvac: permitFee }),
  multiplier: z
    .object({ default: z.number().positive(), floor: z.number().positive() })
    .refine(multiplier => multiplier.default >= multiplier.floor, { message: 'The default multiplier cannot be below the floor' }),
  taxRatePercent: z.number().min(0).max(20),
})

export type ScopePricingConfig = z.infer<typeof scopePricingConfigSchema>
export type PricingTrade = keyof ScopePricingConfig['unitCosts']
export type UnitCostsOf<T extends PricingTrade> = ScopePricingConfig['unitCosts'][T]
export type PermitTrade = keyof ScopePricingConfig['permitFees']
```

`SP/constants/config-defaults.ts`:

```ts
import type { ScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/schemas/config'

export const SCOPE_PRICING_CONFIG_DEFAULTS = {
  unitCosts: {
    roof: {
      BSQTearOffFlat: 530,
      BSQTearOffShingles: 480,
      BSQTearOffTile: 750,
      BSQRedeckFlat: 650,
      BSQRedeckPitched: 700,
      BSQTileReset: 580,
      BSQOverlayPitched: 420,
      BSQOverlayFlat: 420,
      dollarPerAdditionalStory: 25,
      dollarPerAdditionalLayer: 25,
    },
    solar: { dollarPerWatt: 3.5, dollarPerPanelRnr: 225, battery5kWh: 6000, battery10kWh: 11000 },
    hvac: { threeTonRnr: 8500, furnace36kBTURnr: 7000, miniSplits: 3000, perTonStep: 800 },
    windowsAndDoors: { windowSmall: 550, windowLarge: 650, slidingDoorStandard: 2500, slidingDoorSpecial: 3000, frenchDoor: 5000 },
    atticBasement: { dollarPerSqFtTopOff: 1.3, dollarPerSqFtRnr: 2.5, dollarPerSqFtCrawlSpace: 2.3 },
    dryscapingHardscaping: {
      dollarPerSqFtArtificial: 7,
      dollarPerSqFtGravel: 6,
      dollarPerSqFtMulch: 5,
      dollarPerSqFtConcrete: 11,
      dollarPerSqFtPavers: 11,
      dollarPerSqFtDg: 5,
    },
    electricals: { mpuBase: 3200, mpuWithRelocation: 4000 },
    exteriorPaintSiding: {
      coolLifePaintSm: 6000,
      coolLifePaintAvg: 7000,
      coolLifePaintLarge: 8500,
      waterPaintSm: 4000,
      waterPaintAvg: 5000,
      waterPaintLarge: 6500,
    },
  },
  exteriorPaintTiers: { smallBelowSqFt: 1500, largeAboveSqFt: 3000 },
  permitFees: { roof: { amount: 250, enabled: false }, hvac: { amount: 250, enabled: false } },
  multiplier: { default: 2.8, floor: 2 },
  taxRatePercent: 7.5,
} satisfies ScopePricingConfig
```

`SP/lib/resolve-config.ts`:

```ts
import type { ScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/schemas/config'

import { SCOPE_PRICING_CONFIG_DEFAULTS } from '@/features/calculators/scope-pricing-calculator/constants/config-defaults'
import { scopePricingConfigSchema } from '@/features/calculators/scope-pricing-calculator/schemas/config'

// Admin-configured pricing has no storage or admin screen yet, so the System defaults are the whole answer for now.
export function resolveScopePricingConfig(): ScopePricingConfig {
  return scopePricingConfigSchema.parse(SCOPE_PRICING_CONFIG_DEFAULTS)
}
```

- [ ] **Step 4: Labels, keys and context constants**

`SP/constants/trade-labels.ts` (the labels are the tri-pros trade seed labels, verbatim):

```ts
import type { PermitTrade, PricingTrade } from '@/features/calculators/scope-pricing-calculator/schemas/config'

export const PRICING_TRADES = [
  'roof',
  'solar',
  'hvac',
  'windowsAndDoors',
  'atticBasement',
  'dryscapingHardscaping',
  'electricals',
  'exteriorPaintSiding',
] as const satisfies readonly PricingTrade[]

export const TRADE_LABELS = {
  roof: 'Roof',
  solar: 'Solar',
  hvac: 'HVAC',
  windowsAndDoors: 'Windows & Doors',
  atticBasement: 'Attic & Basement',
  dryscapingHardscaping: 'Dryscaping & Hardscaping',
  electricals: 'Electricals',
  exteriorPaintSiding: 'Exterior Paint & Siding',
} as const satisfies Record<PricingTrade, string>

export const PERMIT_TRADES = ['roof', 'hvac'] as const satisfies readonly PermitTrade[]
```

`SP/constants/unit-cost-labels.ts` (the remodel-x pricing seed labels verbatim; the last three are new because those values were formula literals):

```ts
import type { PricingTrade, UnitCostsOf } from '@/features/calculators/scope-pricing-calculator/schemas/config'

type UnitCostLabels = { [T in PricingTrade]: Record<keyof UnitCostsOf<T>, string> }

export const UNIT_COST_LABELS = {
  roof: {
    BSQTearOffFlat: 'Tear-Off (Flat) per BSQ',
    BSQTearOffShingles: 'Tear-Off (Shingles) per BSQ',
    BSQTearOffTile: 'Tear-Off (Tile) per BSQ',
    BSQRedeckFlat: 'Redeck (Flat) per BSQ',
    BSQRedeckPitched: 'Redeck (Pitched) per BSQ',
    BSQTileReset: 'Tile Reset per BSQ',
    BSQOverlayPitched: 'Overlay (Pitched) per BSQ',
    BSQOverlayFlat: 'Overlay (Flat) per BSQ',
    dollarPerAdditionalStory: 'Dollar per Additional Story',
    dollarPerAdditionalLayer: 'Dollar per Additional Layer',
  },
  solar: {
    dollarPerWatt: 'Dollar per Watt',
    dollarPerPanelRnr: 'Dollar per Panel (Remove & Reinstall)',
    battery5kWh: 'Battery (5 kWh)',
    battery10kWh: 'Battery (10 kWh)',
  },
  hvac: {
    threeTonRnr: '3 Ton HVAC Replace & Install',
    furnace36kBTURnr: '36k BTU Furnace Replace & Install',
    miniSplits: 'Mini-Splits (Per Unit)',
    perTonStep: 'Per additional ton (HVAC)',
  },
  windowsAndDoors: {
    windowSmall: 'Small Window',
    windowLarge: 'Large Window',
    slidingDoorStandard: 'Sliding Door (Standard)',
    slidingDoorSpecial: 'Sliding Door (Special)',
    frenchDoor: 'French Door',
  },
  atticBasement: {
    dollarPerSqFtTopOff: 'Dollar per SqFt (Top-Off)',
    dollarPerSqFtRnr: 'Dollar per SqFt (Remove & Replace)',
    dollarPerSqFtCrawlSpace: 'Dollar per SqFt (Crawl space insulation)',
  },
  dryscapingHardscaping: {
    dollarPerSqFtArtificial: 'Dollar per SqFt (Artificial Turf)',
    dollarPerSqFtGravel: 'Dollar per SqFt (Gravel)',
    dollarPerSqFtMulch: 'Dollar per SqFt (Mulch)',
    dollarPerSqFtConcrete: 'Dollar per SqFt (Concrete)',
    dollarPerSqFtPavers: 'Dollar per SqFt (Pavers)',
    dollarPerSqFtDg: 'Dollar per SqFt (DG)',
  },
  electricals: {
    mpuBase: 'Main panel upgrade',
    mpuWithRelocation: 'Main panel upgrade (with relocation)',
  },
  exteriorPaintSiding: {
    coolLifePaintSm: 'CoolLife Paint (Small Home)',
    coolLifePaintAvg: 'CoolLife Paint (Average Home)',
    coolLifePaintLarge: 'CoolLife Paint (Large Home)',
    waterPaintSm: 'Water Paint (Small Home)',
    waterPaintAvg: 'Water Paint (Average Home)',
    waterPaintLarge: 'Water Paint (Large Home)',
  },
} as const satisfies UnitCostLabels
```

`SP/constants/pricing-keys.ts`:

```ts
export const PRICING_KEYS = [
  'overlay',
  'tearOff',
  'redeck',
  'tileReset',
  'installPanels',
  'rnrPanels',
  'installBattery',
  'replaceSplitSystem',
  'replaceFurnace',
  'installMiniSplit',
  'replaceWindows',
  'replaceSlidingDoor',
  'replaceFrenchDoors',
  'rnrAttic',
  'topOffAttic',
  'installCrawlSpaceInsulation',
  'installArtificial',
  'installGravel',
  'installMulch',
  'installConcrete',
  'installPavers',
  'installDg',
  'mpu',
  'installExteriorPaint',
] as const

export type PricingKey = typeof PRICING_KEYS[number]
```

`SP/constants/project-context.ts`:

```ts
export const NUM_STORIES_OPTIONS = [1, 2, 3, 4] as const

// Only shingle and tile have tear-off rates; any other roof type would silently price at the tile rate.
export const CURRENT_ROOF_TYPES = ['shingle', 'tile'] as const

export const CURRENT_ROOF_TYPE_LABELS = {
  shingle: 'Shingle',
  tile: 'Tile',
} as const satisfies Record<typeof CURRENT_ROOF_TYPES[number], string>
```

`SP/constants/variable-units.ts`:

```ts
import type { VariableUnit } from '@/features/calculators/scope-pricing-calculator/types'

export const UNIT_SUFFIXES = {
  BSQ: 'BSQ',
  count: '',
  W: 'W',
  kWh: 'kWh',
  tons: 'tons',
  sqft: 'sq ft',
} as const satisfies Record<Exclude<VariableUnit, null>, string>
```

- [ ] **Step 5: Types, Variables and schemas**

`SP/types/index.ts`:

```ts
import type { PricingKey } from '@/features/calculators/scope-pricing-calculator/constants/pricing-keys'
import type { VARIABLES } from '@/features/calculators/scope-pricing-calculator/constants/variables'
import type { PricingTrade, ScopePricingConfig, UnitCostsOf } from '@/features/calculators/scope-pricing-calculator/schemas/config'
import type { ProjectContext } from '@/features/calculators/scope-pricing-calculator/schemas/form'

export type VariableUnit = 'BSQ' | 'count' | 'W' | 'kWh' | 'tons' | 'sqft' | null
export type SelectOption = number | string

interface VariableDefBase {
  trade: PricingTrade
  label: string
  unit: VariableUnit
}

export interface NumberVariableDef extends VariableDefBase {
  kind: 'number'
  min: number
  max: number
  default?: number
}

export interface SelectVariableDef extends VariableDefBase {
  kind: 'select'
  options: readonly SelectOption[]
  optionLabels?: Readonly<Record<string, string>>
  default?: SelectOption
}

export interface BooleanVariableDef extends VariableDefBase {
  kind: 'boolean'
  default?: boolean
}

export type VariableDef = NumberVariableDef | SelectVariableDef | BooleanVariableDef

export type VariableKey = keyof typeof VARIABLES

type DefOf<K extends VariableKey> = (typeof VARIABLES)[K]

export type VariableValue<K extends VariableKey>
  = DefOf<K> extends { kind: 'number' } ? number
    : DefOf<K> extends { kind: 'boolean' } ? boolean
      : DefOf<K> extends { options: readonly (infer O)[] } ? O
        : never

export type VariableValues<Keys extends readonly VariableKey[]> = { [K in Keys[number]]: VariableValue<K> }

/** What the rep has entered on one line: any declared Variable may still be empty. */
export type VariableInputs = Partial<Record<VariableKey, SelectOption | boolean | null>>

export type FormulaConfig = Pick<ScopePricingConfig, 'exteriorPaintTiers'>

export interface FormulaDef<T extends PricingTrade, Keys extends readonly VariableKey[]> {
  key: PricingKey
  trade: T
  label: string
  outcome: string
  variables: Keys
  defaults?: Partial<VariableValues<Keys>>
  // Method syntax on purpose: it lets the registry hold Formulas with different Variable sets under one type.
  compute(vars: VariableValues<Keys>, context: ProjectContext, unitCosts: UnitCostsOf<T>, config: FormulaConfig): number
}

export type Formula = FormulaDef<PricingTrade, readonly VariableKey[]>
```

`SP/constants/variables.ts` (labels are the seed labels, verbatim):

```ts
import type { VariableDef } from '@/features/calculators/scope-pricing-calculator/types'

// Inputs that only shape SOW text (desired roof type, free deck %, inverter type, insulation types, demo area, duct replacement) are left out because none of them changes a price.
export const VARIABLES = {
  numFlatBSQ: { trade: 'roof', label: 'Number of flat BSQ', kind: 'number', unit: 'BSQ', min: 0, max: 200, default: 0 },
  numPitchedBSQ: { trade: 'roof', label: 'Number of pitched BSQ', kind: 'number', unit: 'BSQ', min: 0, max: 200, default: 0 },
  numLayers: { trade: 'roof', label: 'Number of current roof layers', kind: 'select', unit: null, options: [1, 2, 3], default: 1 },
  numPanels: { trade: 'solar', label: 'Number of panels', kind: 'number', unit: 'count', min: 0, max: 200 },
  wattsPerPanel: { trade: 'solar', label: 'Watts per panel', kind: 'number', unit: 'W', min: 100, max: 700 },
  numBatteries: { trade: 'solar', label: 'Number of batteries', kind: 'select', unit: null, options: [0, 1, 2, 3], default: 0 },
  kWhPerBattery: { trade: 'solar', label: 'kWh per battery', kind: 'select', unit: 'kWh', options: [5, 10], default: 5 },
  systemTonnage: { trade: 'hvac', label: 'System tonnage', kind: 'select', unit: 'tons', options: [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5], default: 3 },
  numMiniSplits: { trade: 'hvac', label: 'Number of mini splits', kind: 'select', unit: 'count', options: [1, 2, 3, 4, 5, 6, 7, 8], default: 1 },
  numSmallWindows: { trade: 'windowsAndDoors', label: 'Number of small windows', kind: 'number', unit: 'count', min: 0, max: 100, default: 0 },
  numLargeWindows: { trade: 'windowsAndDoors', label: 'Number of large windows', kind: 'number', unit: 'count', min: 0, max: 100, default: 0 },
  numStandardSliders: { trade: 'windowsAndDoors', label: 'Number of standard sliding doors', kind: 'number', unit: 'count', min: 0, max: 100, default: 0 },
  numSpecialSliders: { trade: 'windowsAndDoors', label: 'Number of special sliding doors', kind: 'number', unit: 'count', min: 0, max: 100, default: 0 },
  numFrenchDoors: { trade: 'windowsAndDoors', label: 'Number of french doors', kind: 'number', unit: 'count', min: 0, max: 100, default: 0 },
  sqft: { trade: 'atticBasement', label: 'Square feet of insulation', kind: 'number', unit: 'sqft', min: 0, max: 10000 },
  installSqFt: { trade: 'dryscapingHardscaping', label: 'Square feet of installation', kind: 'number', unit: 'sqft', min: 0, max: 20000 },
  relocationRequired: { trade: 'electricals', label: 'Relocation required?', kind: 'boolean', unit: null, default: false },
  paintType: { trade: 'exteriorPaintSiding', label: 'Paint type', kind: 'select', unit: null, options: ['coolLife', 'water'], optionLabels: { coolLife: 'CoolLife', water: 'Water' } },
  homeSqFt: { trade: 'exteriorPaintSiding', label: 'Home square footage', kind: 'number', unit: 'sqft', min: 0, max: 20000 },
  garageSqFt: { trade: 'exteriorPaintSiding', label: 'Garage square footage', kind: 'number', unit: 'sqft', min: 0, max: 20000 },
} as const satisfies Record<string, VariableDef>
```

Variables are keyed flat by their seed key, and each carries its `trade`. That is how spec §3's "Variable definitions by trade" is realized: the keys are unique across trades, and a Formula lists them by key.

`SP/schemas/form.ts` (Task 6 extends this file):

```ts
import { z } from 'zod'

import { CURRENT_ROOF_TYPES } from '@/features/calculators/scope-pricing-calculator/constants/project-context'

// Stories and roof type are typed in by the rep until they can be prefilled from the customer's profile.
export const projectContextSchema = z.object({
  numStories: z.number().int().min(1).max(4),
  currentRoofType: z.enum(CURRENT_ROOF_TYPES),
})

export type ProjectContext = z.infer<typeof projectContextSchema>
```

`SP/schemas/formula-variables.ts`:

```ts
import type { Formula, VariableDef, VariableKey } from '@/features/calculators/scope-pricing-calculator/types'

import { z } from 'zod'

import { VARIABLES } from '@/features/calculators/scope-pricing-calculator/constants/variables'

function variableSchema(key: VariableKey) {
  const def: VariableDef = VARIABLES[key]
  if (def.kind === 'number') {
    return z.number().min(def.min).max(def.max)
  }
  if (def.kind === 'boolean') {
    return z.boolean()
  }
  const options = def.options
  return z.union([z.number(), z.string()]).refine(value => options.includes(value), { message: 'Not one of the options' })
}

export function buildFormulaVariablesSchema(formula: Formula) {
  return z.object(Object.fromEntries(formula.variables.map(key => [key, variableSchema(key)])))
}
```

- [ ] **Step 6: `defineFormula` and variable resolution**

`SP/lib/define-formula.ts`:

```ts
import type { FormulaDef, VariableKey } from '@/features/calculators/scope-pricing-calculator/types'
import type { PricingTrade } from '@/features/calculators/scope-pricing-calculator/schemas/config'

export function defineFormula<const T extends PricingTrade, const Keys extends readonly VariableKey[]>(
  formula: FormulaDef<T, Keys>,
): FormulaDef<T, Keys> {
  return formula
}
```

`SP/lib/resolve-formula-variables.ts`:

```ts
import type { Formula, VariableDef, VariableInputs, VariableKey, VariableValues } from '@/features/calculators/scope-pricing-calculator/types'

import { VARIABLES } from '@/features/calculators/scope-pricing-calculator/constants/variables'
import { buildFormulaVariablesSchema } from '@/features/calculators/scope-pricing-calculator/schemas/formula-variables'

export type ResolvedVariables
  = | { ok: true, values: VariableValues<readonly VariableKey[]> }
    | { ok: false, needs: VariableKey[] }

function isVariableKey(key: unknown): key is VariableKey {
  return typeof key === 'string' && key in VARIABLES
}

export function resolveFormulaVariables(formula: Formula, inputs: VariableInputs): ResolvedVariables {
  const merged: Record<string, unknown> = {}
  for (const key of formula.variables) {
    const def: VariableDef = VARIABLES[key]
    merged[key] = inputs[key] ?? formula.defaults?.[key] ?? def.default
  }
  const parsed = buildFormulaVariablesSchema(formula).safeParse(merged)
  if (parsed.success) {
    // The schema was built from this Formula's own Variable list, so the parsed shape is exactly that list.
    return { ok: true, values: parsed.data as VariableValues<readonly VariableKey[]> }
  }
  const needs = [...new Set(parsed.error.issues.map(issue => issue.path[0]))].filter(isVariableKey)
  return { ok: false, needs }
}
```

- [ ] **Step 7: The 24 Formulas**

Each body is the remodel-x logic from tracker §7.1, carried over exactly. The only changes are: the three literals become named Unit Costs (`perTonStep`, `mpuBase`, `mpuWithRelocation`), tear-off reads `context.currentRoofType`, and exterior paint reads `config.exteriorPaintTiers`. Labels and outcomes are the tri-pros scope seed, verbatim.

`SP/lib/formulas/roof.ts`:

```ts
import { defineFormula } from '@/features/calculators/scope-pricing-calculator/lib/define-formula'

export const overlay = defineFormula({
  key: 'overlay',
  trade: 'roof',
  label: 'Roof Overlay',
  outcome: 'Add a fresh, protective roofing layer that extends lifespan without a full tear-off',
  variables: ['numFlatBSQ', 'numPitchedBSQ'],
  compute({ numFlatBSQ, numPitchedBSQ }, context, costs) {
    const totalBSQ = numFlatBSQ + numPitchedBSQ
    const additionalStories = (context.numStories - 1) * costs.dollarPerAdditionalStory * totalBSQ
    return numFlatBSQ * costs.BSQOverlayFlat + numPitchedBSQ * costs.BSQOverlayPitched + additionalStories
  },
})

export const tearOff = defineFormula({
  key: 'tearOff',
  trade: 'roof',
  label: 'Roof Tear-off',
  outcome: 'Replace your entire roof for maximum durability, energy performance, and weather protection',
  variables: ['numFlatBSQ', 'numPitchedBSQ', 'numLayers'],
  compute({ numFlatBSQ, numPitchedBSQ, numLayers }, context, costs) {
    const totalBSQ = numFlatBSQ + numPitchedBSQ
    const pitchedRate = context.currentRoofType === 'shingle' ? costs.BSQTearOffShingles : costs.BSQTearOffTile
    const additionalLayers = (numLayers - 1) * costs.dollarPerAdditionalLayer * numPitchedBSQ
    const additionalStories = (context.numStories - 1) * costs.dollarPerAdditionalStory * totalBSQ
    return numPitchedBSQ * pitchedRate + numFlatBSQ * costs.BSQTearOffFlat + additionalLayers + additionalStories
  },
})

export const redeck = defineFormula({
  key: 'redeck',
  trade: 'roof',
  label: 'Roof Redeck',
  outcome: 'Replace the entire roof deck and finish to restore structural integrity and upgrade long-term performance',
  variables: ['numFlatBSQ', 'numPitchedBSQ', 'numLayers'],
  compute({ numFlatBSQ, numPitchedBSQ, numLayers }, context, costs) {
    const totalBSQ = numFlatBSQ + numPitchedBSQ
    const base = numFlatBSQ * costs.BSQRedeckFlat + numPitchedBSQ * costs.BSQRedeckPitched
    const additionalLayers = (numLayers - 1) * costs.dollarPerAdditionalLayer * numPitchedBSQ
    const additionalStories = (context.numStories - 1) * costs.dollarPerAdditionalStory * totalBSQ
    return base + additionalLayers + additionalStories
  },
})

export const tileReset = defineFormula({
  key: 'tileReset',
  trade: 'roof',
  label: 'Tile Reset',
  outcome: 'Reinstall your tile roof with upgraded underlayment for improved longevity and leak protection',
  variables: ['numPitchedBSQ'],
  compute({ numPitchedBSQ }, context, costs) {
    const additionalStoriesRate = (context.numStories - 1) * costs.dollarPerAdditionalStory
    return numPitchedBSQ * (costs.BSQTileReset + additionalStoriesRate)
  },
})
```

`SP/lib/formulas/solar.ts`:

```ts
import { defineFormula } from '@/features/calculators/scope-pricing-calculator/lib/define-formula'

export const installPanels = defineFormula({
  key: 'installPanels',
  trade: 'solar',
  label: 'Install Panels',
  outcome: 'Generate your own power and cut dependence on the grid',
  variables: ['numPanels', 'wattsPerPanel'],
  compute({ numPanels, wattsPerPanel }, _context, costs) {
    return numPanels * wattsPerPanel * costs.dollarPerWatt
  },
})

export const rnrPanels = defineFormula({
  key: 'rnrPanels',
  trade: 'solar',
  label: 'Remove & Reinstall Panels',
  outcome: 'Safely remove and reinstall your solar system so roof work can proceed without damaging equipment',
  variables: ['numPanels'],
  defaults: { numPanels: 0 },
  compute({ numPanels }, _context, costs) {
    return numPanels * costs.dollarPerPanelRnr
  },
})

export const installBattery = defineFormula({
  key: 'installBattery',
  trade: 'solar',
  label: 'Install Battery',
  outcome: 'Store excess solar energy and keep your home powered during outages',
  variables: ['numBatteries', 'kWhPerBattery'],
  compute({ numBatteries, kWhPerBattery }, _context, costs) {
    const perBattery = kWhPerBattery === 5 ? costs.battery5kWh : costs.battery10kWh
    return numBatteries * perBattery
  },
})
```

`SP/lib/formulas/hvac.ts`:

```ts
import { defineFormula } from '@/features/calculators/scope-pricing-calculator/lib/define-formula'

export const replaceSplitSystem = defineFormula({
  key: 'replaceSplitSystem',
  trade: 'hvac',
  label: 'Replace split system',
  outcome: 'Install a modern HVAC system that delivers better comfort, quieter operation, and lower energy costs',
  variables: ['systemTonnage'],
  compute({ systemTonnage }, _context, costs) {
    return costs.threeTonRnr + (systemTonnage - 3) * costs.perTonStep
  },
})

export const replaceFurnace = defineFormula({
  key: 'replaceFurnace',
  trade: 'hvac',
  label: 'Replace furnace',
  outcome: 'Replace your aging furnace for improved heating performance, safety, and efficiency',
  variables: ['systemTonnage'],
  compute({ systemTonnage }, _context, costs) {
    return costs.furnace36kBTURnr + (systemTonnage - 3) * costs.perTonStep
  },
})

export const installMiniSplit = defineFormula({
  key: 'installMiniSplit',
  trade: 'hvac',
  label: 'Install mini-split',
  outcome: 'Add targeted, high-efficiency heating and cooling with compact, quiet mini-split units',
  variables: ['numMiniSplits'],
  compute({ numMiniSplits }, _context, costs) {
    return costs.miniSplits * numMiniSplits
  },
})
```

`SP/lib/formulas/windows-and-doors.ts`:

```ts
import { defineFormula } from '@/features/calculators/scope-pricing-calculator/lib/define-formula'

export const replaceWindows = defineFormula({
  key: 'replaceWindows',
  trade: 'windowsAndDoors',
  label: 'Window replacement',
  outcome: 'Improve comfort, efficiency, and curb appeal with modern double-pane windows',
  variables: ['numSmallWindows', 'numLargeWindows'],
  compute({ numSmallWindows, numLargeWindows }, _context, costs) {
    return numSmallWindows * costs.windowSmall + numLargeWindows * costs.windowLarge
  },
})

export const replaceSlidingDoor = defineFormula({
  key: 'replaceSlidingDoor',
  trade: 'windowsAndDoors',
  label: 'Replace sliding door',
  outcome: 'Upgrade to a smoother, more efficient sliding door that improves access, insulation, and aesthetics',
  variables: ['numStandardSliders', 'numSpecialSliders'],
  compute({ numStandardSliders, numSpecialSliders }, _context, costs) {
    return numStandardSliders * costs.slidingDoorStandard + numSpecialSliders * costs.slidingDoorSpecial
  },
})

export const replaceFrenchDoors = defineFormula({
  key: 'replaceFrenchDoors',
  trade: 'windowsAndDoors',
  label: 'Replace french doors',
  outcome: 'Enhance your entryway with elegant, energy-efficient french doors that brighten the space',
  variables: ['numFrenchDoors'],
  compute({ numFrenchDoors }, _context, costs) {
    return numFrenchDoors * costs.frenchDoor
  },
})
```

`SP/lib/formulas/attic-basement.ts`:

```ts
import { defineFormula } from '@/features/calculators/scope-pricing-calculator/lib/define-formula'

export const rnrAttic = defineFormula({
  key: 'rnrAttic',
  trade: 'atticBasement',
  label: 'Replace attic insulation',
  outcome: 'Improve comfort and cut energy waste with fresh, high-performance attic insulation',
  variables: ['sqft'],
  compute({ sqft }, _context, costs) {
    return sqft * costs.dollarPerSqFtRnr
  },
})

export const topOffAttic = defineFormula({
  key: 'topOffAttic',
  trade: 'atticBasement',
  label: 'Top-off attic insulation',
  outcome: 'Boost home efficiency and comfort with a quick insulation upgrade',
  variables: ['sqft'],
  compute({ sqft }, _context, costs) {
    return sqft * costs.dollarPerSqFtTopOff
  },
})

export const installCrawlSpaceInsulation = defineFormula({
  key: 'installCrawlSpaceInsulation',
  trade: 'atticBasement',
  label: 'Install crawl-space insulation',
  outcome: 'Reduce heat loss and moisture issues by insulating your raised-foundation home properly',
  variables: ['sqft'],
  compute({ sqft }, _context, costs) {
    return sqft * costs.dollarPerSqFtCrawlSpace
  },
})
```

`SP/lib/formulas/dryscaping-hardscaping.ts`:

```ts
import { defineFormula } from '@/features/calculators/scope-pricing-calculator/lib/define-formula'

export const installArtificial = defineFormula({
  key: 'installArtificial',
  trade: 'dryscapingHardscaping',
  label: 'Install Artificial',
  outcome: 'Eliminate lawn maintenance and save water with year-round, lush-looking artificial turf',
  variables: ['installSqFt'],
  compute({ installSqFt }, _context, costs) {
    return installSqFt * costs.dollarPerSqFtArtificial
  },
})

export const installGravel = defineFormula({
  key: 'installGravel',
  trade: 'dryscapingHardscaping',
  label: 'Install Gravel',
  outcome: 'Create a clean, low-maintenance landscape that improves drainage and curb appeal',
  variables: ['installSqFt'],
  compute({ installSqFt }, _context, costs) {
    return installSqFt * costs.dollarPerSqFtGravel
  },
})

export const installMulch = defineFormula({
  key: 'installMulch',
  trade: 'dryscapingHardscaping',
  label: 'Install Mulch',
  outcome: 'Refresh your yard with a clean, moisture-retaining mulch layer that boosts plant health and appearance',
  variables: ['installSqFt'],
  compute({ installSqFt }, _context, costs) {
    return installSqFt * costs.dollarPerSqFtMulch
  },
})

export const installConcrete = defineFormula({
  key: 'installConcrete',
  trade: 'dryscapingHardscaping',
  label: 'Install Concrete',
  outcome: 'Add a solid, long-lasting concrete surface that improves function, durability, and property value',
  variables: ['installSqFt'],
  compute({ installSqFt }, _context, costs) {
    return installSqFt * costs.dollarPerSqFtConcrete
  },
})

export const installPavers = defineFormula({
  key: 'installPavers',
  trade: 'dryscapingHardscaping',
  label: 'Install Pavers',
  outcome: 'Upgrade outdoor areas with elegant, long-lasting pavers that enhance aesthetics and usability',
  variables: ['installSqFt'],
  compute({ installSqFt }, _context, costs) {
    return installSqFt * costs.dollarPerSqFtPavers
  },
})

export const installDg = defineFormula({
  key: 'installDg',
  trade: 'dryscapingHardscaping',
  label: 'Install DG',
  outcome: 'Give your yard a durable, desert-modern look while reducing maintenance and water use',
  variables: ['installSqFt'],
  compute({ installSqFt }, _context, costs) {
    return installSqFt * costs.dollarPerSqFtDg
  },
})
```

`SP/lib/formulas/electricals.ts`:

```ts
import { defineFormula } from '@/features/calculators/scope-pricing-calculator/lib/define-formula'

export const mpu = defineFormula({
  key: 'mpu',
  trade: 'electricals',
  label: 'Main panel upgrade',
  outcome: 'Increase electrical capacity and safety to support modern appliances, solar, and home expansions',
  variables: ['relocationRequired'],
  compute({ relocationRequired }, _context, costs) {
    return relocationRequired ? costs.mpuWithRelocation : costs.mpuBase
  },
})
```

`SP/lib/formulas/exterior-paint-siding.ts`:

```ts
import { defineFormula } from '@/features/calculators/scope-pricing-calculator/lib/define-formula'

export const installExteriorPaint = defineFormula({
  key: 'installExteriorPaint',
  trade: 'exteriorPaintSiding',
  label: 'Install exterior paint',
  outcome: 'Protect your home from weather while giving it a fresh, modern exterior look',
  variables: ['paintType', 'homeSqFt', 'garageSqFt'],
  compute({ paintType, homeSqFt, garageSqFt }, _context, costs, config) {
    const totalSqFt = homeSqFt + garageSqFt
    const { smallBelowSqFt, largeAboveSqFt } = config.exteriorPaintTiers
    if (paintType === 'coolLife') {
      if (totalSqFt < smallBelowSqFt) {
        return costs.coolLifePaintSm
      }
      return totalSqFt > largeAboveSqFt ? costs.coolLifePaintLarge : costs.coolLifePaintAvg
    }
    if (totalSqFt < smallBelowSqFt) {
      return costs.waterPaintSm
    }
    return totalSqFt > largeAboveSqFt ? costs.waterPaintLarge : costs.waterPaintAvg
  },
})
```

- [ ] **Step 8: Registry**

`SP/lib/formula-registry.ts`. The type annotation `Record<PricingKey, Formula>` gives the same exhaustiveness check as spec §5.2's `satisfies` (a missing or extra key fails `pnpm tsc`), and it also gives every entry the one `Formula` type the engine indexes by key:

```ts
import type { PricingKey } from '@/features/calculators/scope-pricing-calculator/constants/pricing-keys'
import type { PricingTrade } from '@/features/calculators/scope-pricing-calculator/schemas/config'
import type { Formula } from '@/features/calculators/scope-pricing-calculator/types'

import { PRICING_TRADES, TRADE_LABELS } from '@/features/calculators/scope-pricing-calculator/constants/trade-labels'
import { installCrawlSpaceInsulation, rnrAttic, topOffAttic } from '@/features/calculators/scope-pricing-calculator/lib/formulas/attic-basement'
import { installArtificial, installConcrete, installDg, installGravel, installMulch, installPavers } from '@/features/calculators/scope-pricing-calculator/lib/formulas/dryscaping-hardscaping'
import { mpu } from '@/features/calculators/scope-pricing-calculator/lib/formulas/electricals'
import { installExteriorPaint } from '@/features/calculators/scope-pricing-calculator/lib/formulas/exterior-paint-siding'
import { installMiniSplit, replaceFurnace, replaceSplitSystem } from '@/features/calculators/scope-pricing-calculator/lib/formulas/hvac'
import { overlay, redeck, tearOff, tileReset } from '@/features/calculators/scope-pricing-calculator/lib/formulas/roof'
import { installBattery, installPanels, rnrPanels } from '@/features/calculators/scope-pricing-calculator/lib/formulas/solar'
import { replaceFrenchDoors, replaceSlidingDoor, replaceWindows } from '@/features/calculators/scope-pricing-calculator/lib/formulas/windows-and-doors'

// Keyed by the old app's scope accessors because Notion scopes don't store a slug yet; the keys become scope slugs once they do.
export const FORMULAS: Record<PricingKey, Formula> = {
  overlay,
  tearOff,
  redeck,
  tileReset,
  installPanels,
  rnrPanels,
  installBattery,
  replaceSplitSystem,
  replaceFurnace,
  installMiniSplit,
  replaceWindows,
  replaceSlidingDoor,
  replaceFrenchDoors,
  rnrAttic,
  topOffAttic,
  installCrawlSpaceInsulation,
  installArtificial,
  installGravel,
  installMulch,
  installConcrete,
  installPavers,
  installDg,
  mpu,
  installExteriorPaint,
}

export const FORMULA_GROUPS: { trade: PricingTrade, label: string, formulas: Formula[] }[] = PRICING_TRADES.map(trade => ({
  trade,
  label: TRADE_LABELS[trade],
  formulas: Object.values(FORMULAS).filter(formula => formula.trade === trade),
}))
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `pnpm tsx scripts/verify-scope-pricing.ts`
Expected: `swept N Formula inputs`, then `✅ verify-scope-pricing passed`.

If `pnpm tsc` later rejects a Formula's assignment into `FORMULAS` (method-parameter variance), the fix is in the `FormulaDef` type, not a cast at the registry.

- [ ] **Step 10: Gates**

Run: `pnpm exec eslint --fix src/features/calculators scripts/verify-scope-pricing.ts && pnpm tsc && pnpm lint`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add src/features/calculators/scope-pricing-calculator scripts/verify-scope-pricing.ts
git commit -m "feat(calculators): Scope Pricing catalog — config, Variables, 24 Formulas

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `priceQuote` and `solveMultiplier`

This covers PR8–PR11, D2, D3, CF4, B-P1 and B-P2.

**Files:**
- Modify: `SP/types/index.ts` (append the quote types)
- Create: `SP/lib/price-quote.ts`, `SP/lib/solve-multiplier.ts`
- Modify: `scripts/verify-scope-pricing.ts` (add imports, and insert a section before the final `console.log`)

**Interfaces:**
- Consumes: `FORMULAS`, `resolveFormulaVariables`, `TRADE_LABELS`, `PERMIT_TRADES` and `ScopePricingConfig` (Task 2); `getMultiplierTier` and `MultiplierTier` (shared).
- Produces:
  - `priceQuote(input: PriceQuoteInput): QuoteResult`.
  - `solveMultiplier(targetTotal: number, input: PriceQuoteInput): SolveMultiplierResult`. Spec §5.3 wrote this as `(targetTotal, quote)`. It takes the quote's *input* instead, because `achievedTotal` has to re-price the lines at the solved multiplier.
  - The types `QuoteLineInput`, `QuoteOverrides`, `PriceQuoteInput`, `PricedLine`, `IncompleteLine`, `QuoteLineResult`, `QuoteResult` and `SolveMultiplierResult`.
- Result lines keep input order, followed by permit lines (`id: 'permit-roof' | 'permit-hvac'`).

- [ ] **Step 1: Write the failing test**

Add these imports to the top of `scripts/verify-scope-pricing.ts`, in the existing import groups:

```ts
import type { PriceQuoteInput, QuoteLineInput } from '@/features/calculators/scope-pricing-calculator/types'

import { priceQuote } from '@/features/calculators/scope-pricing-calculator/lib/price-quote'
import { solveMultiplier } from '@/features/calculators/scope-pricing-calculator/lib/solve-multiplier'
```

Insert this block immediately before `console.log('✅ verify-scope-pricing passed')`:

```ts
// ── Quote pricing (PR8–PR11) ────────────────────────────────────────────────
const panels: QuoteLineInput = { id: 'a', kind: 'formula', pricingKey: 'installPanels', variables: { numPanels: 20, wattsPerPanel: 400 } }
const panelsQuote = priceQuote({ lines: [panels], context: oneStory, config })
const panelLine = panelsQuote.lines[0]
assert.ok(panelLine?.status === 'priced', 'panels line priced')
assert.deepEqual(
  { cost: panelLine.cost, price: panelLine.price, tax: panelLine.tax, base: panelLine.base },
  { cost: 28000, price: 78400, tax: 5880, base: 72520 },
  'golden: 20 × 400 W → Cost 28,000 → Price 78,400 → tax 5,880 → base 72,520',
)
assert.equal(panelsQuote.totalPrice, 78400, 'total price')
assert.equal(panelsQuote.multiplier, 2.8, 'default multiplier applied')
assert.equal(panelsQuote.tier, 'healthy', '2.8 is healthy')
assert.equal(panelsQuote.margin, 50400, 'margin')

assert.equal(priceQuote({ lines: [panels], context: oneStory, config, overrides: { multiplier: 1.5 } }).multiplier, 2, 'override below the floor is clamped')
assert.equal(priceQuote({ lines: [panels], context: oneStory, config, overrides: { multiplier: Number.NaN } }).multiplier, 2.8, 'NaN override is ignored')
assert.equal(priceQuote({ lines: [panels], context: oneStory, config, overrides: { multiplier: 3.25 } }).totalPrice, 91000, 'override above the floor applies')

const tearOffLine = (id: string): QuoteLineInput => ({ id, kind: 'formula', pricingKey: 'tearOff', variables: { numFlatBSQ: 5, numPitchedBSQ: 20, numLayers: 2 } })
const twice = priceQuote({ lines: [tearOffLine('r1'), tearOffLine('r2')], context: twoStory, config })
assert.equal(twice.lines.filter(line => line.status === 'priced').length, 2, 'the same scope twice prices twice')
assert.equal(twice.totalCost, 26750, 'both tear-offs counted')

const manual: QuoteLineInput = { id: 'm', kind: 'manual', label: 'Gutters', price: 5000 }
const mixed = priceQuote({ lines: [panels, manual], context: oneStory, config })
const manualResult = mixed.lines[1]
assert.ok(manualResult?.status === 'priced', 'manual line priced')
assert.deepEqual({ cost: manualResult.cost, tax: manualResult.tax, base: manualResult.base }, { cost: null, tax: 375, base: 4625 }, 'manual line: no cost, tax inside the price')
assert.equal(mixed.totalPrice, 83400, 'manual price counts toward the total')
assert.equal(mixed.margin, 50400, 'manual line left out of margin')
assert.equal(mixed.effectiveMultiplier, 2.8, 'manual line left out of the multiplier')
assert.equal(mixed.hasUncostedLines, true, 'flags uncosted lines')

const unpriced = priceQuote({
  lines: [panels, { id: 'x', kind: 'manual', label: '', price: null }, { id: 'y', kind: 'formula', pricingKey: 'installPanels', variables: { numPanels: 10, wattsPerPanel: null } }],
  context: oneStory,
  config,
})
assert.equal(unpriced.totalPrice, 78400, 'incomplete lines are left out of the total')
assert.deepEqual(unpriced.lines.map(line => line.status), ['priced', 'incomplete', 'incomplete'], 'order kept, incomplete marked')
const incompletePanels = unpriced.lines[2]
assert.ok(incompletePanels?.status === 'incomplete', 'narrow')
assert.deepEqual(incompletePanels.needs, ['wattsPerPanel'], 'incomplete line names what it needs')

assert.equal(priceQuote({ lines: [tearOffLine('r1')], context: twoStory, config }).lines.length, 1, 'permits are off by default')
const withPermit = { ...config, permitFees: { ...config.permitFees, roof: { amount: 250, enabled: true } } }
const permitted = priceQuote({ lines: [tearOffLine('r1'), tearOffLine('r2'), panels], context: twoStory, config: withPermit })
const permitLines = permitted.lines.filter(line => line.kind === 'permit')
assert.equal(permitLines.length, 1, 'one permit per trade, however many roof lines')
assert.deepEqual(
  permitLines.map(line => line.status === 'priced' && { id: line.id, label: line.label, cost: line.cost, price: line.price }),
  [{ id: 'permit-roof', label: 'Permit (Roof)', cost: 250, price: 700 }],
  'permit priced like a formula line',
)
assert.equal(permitted.lines[permitted.lines.length - 1]?.kind, 'permit', 'permit lines come last')
assert.equal(priceQuote({ lines: [panels], context: oneStory, config: withPermit }).lines.length, 1, 'no roof line → no roof permit')

// ── Target price (PR11, CF4) ────────────────────────────────────────────────
const panelsInput: PriceQuoteInput = { lines: [panels], context: oneStory, config }
const reached = solveMultiplier(100000, panelsInput)
assert.equal(reached.status, 'reached', 'target above the floor is reached')
assert.ok(reached.status !== 'no-cost' && Math.abs(reached.achievedTotal - 100000) <= 1, 'achieved total is within rounding of the target')
const withManual = solveMultiplier(100000, { lines: [panels, manual], context: oneStory, config })
assert.ok(withManual.status === 'reached' && Math.abs(withManual.multiplier - 95000 / 28000) < 1e-9, 'manual price is subtracted before solving')
const tooLow = solveMultiplier(40000, panelsInput)
assert.deepEqual(tooLow, { status: 'below-floor', multiplier: 2, achievedTotal: 56000 }, 'target under the floor → floor price')
assert.equal(solveMultiplier(1000, { lines: [panels, manual], context: oneStory, config }).status, 'below-floor', 'target under the manual lines → below floor')
assert.deepEqual(solveMultiplier(100000, { lines: [manual], context: oneStory, config }), { status: 'no-cost' }, 'no Cost to solve against')
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm tsx scripts/verify-scope-pricing.ts`
Expected: FAIL with module not found for `lib/price-quote`.

- [ ] **Step 3: Quote types**

Append to `SP/types/index.ts`, and add `import type { MultiplierTier } from '@/shared/modules/proposals/core/lib/financials/tiers'` to its imports:

```ts
export type QuoteLineInput
  = | { id: string, kind: 'formula', pricingKey: PricingKey, variables: VariableInputs }
    | { id: string, kind: 'manual', label: string, price: number | null }

export interface QuoteOverrides {
  multiplier?: number | null
}

export interface PriceQuoteInput {
  lines: readonly QuoteLineInput[]
  context: ProjectContext
  config: ScopePricingConfig
  overrides?: QuoteOverrides
}

export interface PricedLine {
  id: string
  kind: 'formula' | 'manual' | 'permit'
  status: 'priced'
  label: string
  trade: PricingTrade | null
  cost: number | null
  price: number
  tax: number
  base: number
}

export interface IncompleteLine {
  id: string
  kind: 'formula' | 'manual'
  status: 'incomplete'
  label: string
  trade: PricingTrade | null
  needs: VariableKey[]
}

export type QuoteLineResult = PricedLine | IncompleteLine

export interface QuoteResult {
  lines: QuoteLineResult[]
  multiplier: number
  totalPrice: number
  totalTax: number
  totalBase: number
  totalCost: number
  costedPrice: number
  uncostedPrice: number
  margin: number
  effectiveMultiplier: number | null
  tier: MultiplierTier
  hasUncostedLines: boolean
}

export type SolveMultiplierResult
  = | { status: 'reached' | 'below-floor', multiplier: number, achievedTotal: number }
    | { status: 'no-cost' }
```

- [ ] **Step 4: `priceQuote`**

`SP/lib/price-quote.ts`:

```ts
import type { PricingTrade, ScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/schemas/config'
import type { PriceQuoteInput, QuoteLineResult, QuoteOverrides, QuoteResult } from '@/features/calculators/scope-pricing-calculator/types'

import { PERMIT_TRADES, TRADE_LABELS } from '@/features/calculators/scope-pricing-calculator/constants/trade-labels'
import { FORMULAS } from '@/features/calculators/scope-pricing-calculator/lib/formula-registry'
import { resolveFormulaVariables } from '@/features/calculators/scope-pricing-calculator/lib/resolve-formula-variables'
import { getMultiplierTier } from '@/shared/modules/proposals/core/lib/financials/tiers'

function resolveMultiplier(config: ScopePricingConfig, overrides: QuoteOverrides | undefined): number {
  const requested = overrides?.multiplier
  const multiplier = requested != null && Number.isFinite(requested) ? requested : config.multiplier.default
  return Math.max(config.multiplier.floor, multiplier)
}

function splitPrice(cost: number | null, price: number, taxRatePercent: number) {
  // Tax is carried inside the Price, as the ported calculator did, until the tax rule is confirmed.
  const tax = Math.round((price * taxRatePercent) / 100)
  return { cost, price, tax, base: price - tax }
}

function summarize(lines: QuoteLineResult[], multiplier: number): QuoteResult {
  let totalPrice = 0
  let totalTax = 0
  let totalCost = 0
  let costedPrice = 0
  let uncostedPrice = 0
  for (const line of lines) {
    if (line.status !== 'priced') {
      continue
    }
    totalPrice += line.price
    totalTax += line.tax
    if (line.cost == null) {
      uncostedPrice += line.price
    }
    else {
      totalCost += line.cost
      costedPrice += line.price
    }
  }
  const effectiveMultiplier = totalCost > 0 ? costedPrice / totalCost : null
  return {
    lines,
    multiplier,
    totalPrice,
    totalTax,
    totalBase: totalPrice - totalTax,
    totalCost,
    costedPrice,
    uncostedPrice,
    margin: costedPrice - totalCost,
    effectiveMultiplier,
    tier: getMultiplierTier(effectiveMultiplier),
    hasUncostedLines: lines.some(line => line.status === 'priced' && line.cost == null),
  }
}

// Kept free of React and I/O so the engine can move to a shared module once its permanent home is decided.
export function priceQuote({ lines, context, config, overrides }: PriceQuoteInput): QuoteResult {
  const multiplier = resolveMultiplier(config, overrides)
  const results: QuoteLineResult[] = []
  const pricedTrades = new Set<PricingTrade>()

  for (const line of lines) {
    if (line.kind === 'manual') {
      if (line.price == null || !Number.isFinite(line.price) || line.price < 0) {
        results.push({ id: line.id, kind: 'manual', status: 'incomplete', label: line.label, trade: null, needs: [] })
        continue
      }
      results.push({ id: line.id, kind: 'manual', status: 'priced', label: line.label, trade: null, ...splitPrice(null, Math.round(line.price), config.taxRatePercent) })
      continue
    }

    const formula = FORMULAS[line.pricingKey]
    const resolved = resolveFormulaVariables(formula, line.variables)
    if (!resolved.ok) {
      results.push({ id: line.id, kind: 'formula', status: 'incomplete', label: formula.label, trade: formula.trade, needs: resolved.needs })
      continue
    }
    const cost = Math.round(formula.compute(resolved.values, context, config.unitCosts[formula.trade], config))
    pricedTrades.add(formula.trade)
    results.push({ id: line.id, kind: 'formula', status: 'priced', label: formula.label, trade: formula.trade, ...splitPrice(cost, Math.round(cost * multiplier), config.taxRatePercent) })
  }

  for (const trade of PERMIT_TRADES) {
    const fee = config.permitFees[trade]
    if (fee.enabled && pricedTrades.has(trade)) {
      results.push({ id: `permit-${trade}`, kind: 'permit', status: 'priced', label: `Permit (${TRADE_LABELS[trade]})`, trade, ...splitPrice(fee.amount, Math.round(fee.amount * multiplier), config.taxRatePercent) })
    }
  }

  return summarize(results, multiplier)
}
```

- [ ] **Step 5: `solveMultiplier`**

`SP/lib/solve-multiplier.ts`:

```ts
import type { PriceQuoteInput, SolveMultiplierResult } from '@/features/calculators/scope-pricing-calculator/types'

import { priceQuote } from '@/features/calculators/scope-pricing-calculator/lib/price-quote'

export function solveMultiplier(targetTotal: number, input: PriceQuoteInput): SolveMultiplierResult {
  const quote = priceQuote(input)
  if (quote.totalCost <= 0) {
    return { status: 'no-cost' }
  }
  const floor = input.config.multiplier.floor
  const target = Number.isFinite(targetTotal) ? targetTotal : 0
  const exact = (target - quote.uncostedPrice) / quote.totalCost
  const multiplier = Math.max(floor, exact)
  // Line prices round to whole dollars, so report what the quote actually adds up to at this multiplier.
  const achievedTotal = priceQuote({ ...input, overrides: { multiplier } }).totalPrice
  return { status: exact >= floor ? 'reached' : 'below-floor', multiplier, achievedTotal }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm tsx scripts/verify-scope-pricing.ts`
Expected: `✅ verify-scope-pricing passed`

- [ ] **Step 7: Gates**

Run: `pnpm exec eslint --fix src/features/calculators scripts/verify-scope-pricing.ts && pnpm tsc && pnpm lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/features/calculators/scope-pricing-calculator scripts/verify-scope-pricing.ts
git commit -m "feat(calculators): priceQuote and solveMultiplier with floor, tax and permits

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Remodel ROI Calculator engine

This covers SP-I1–I8, SP-M1–M9, D4, D7 and D8.

**Files:**
- Create: `SV/schemas/config.ts`, `SV/constants/config-defaults.ts`, `SV/lib/resolve-config.ts`
- Create: `SV/constants/bill-categories.ts`, `SV/constants/rates.ts`, `SV/constants/uplift-modes.ts`, `SV/constants/form-defaults.ts`
- Create: `SV/schemas/form.ts`, `SV/types/index.ts`, `SV/lib/project-remodel-roi.ts`
- Modify: `scripts/verify-remodel-roi.ts`

**Interfaces:**
- Consumes: `amortizedMonthlyPayment` and `remainingBalance` (Task 1).
- Produces:
  - `remodelRoiConfigSchema`; the types `RemodelRoiConfig` and `RateKey`.
  - `REMODEL_ROI_CONFIG_DEFAULTS` and `resolveRemodelRoiConfig()`.
  - `BILL_CATEGORIES`, `BillCategory` and `BILL_CATEGORY_LABELS`.
  - `RATE_KEYS` and `RATE_LABELS`.
  - `UPLIFT_MODES` and `UPLIFT_MODE_LABELS`.
  - `EMPTY_LIABILITY` and `createRemodelRoiDefaults(config)`.
  - `remodelRoiFormSchema` and `RemodelRoiFormValues`.
  - The types `ProjectionYear`, `ProjectionSummary` and `RemodelRoiProjection`.
  - `projectRemodelRoi(input: RemodelRoiFormValues, config: RemodelRoiConfig): RemodelRoiProjection`.
- **Null means absent (SP-M9).** A null amount counts as 0, a null rate uses its config default, and a null horizon uses `config.defaultHorizonYears`. This is what `config` is for in `projectRemodelRoi(input, config)`.
- **Cash purchase.** A `termMonths` that is null or 0 means the project is paid in cash: the whole net price (price − incentives) is paid at t = 0. The down payment is clamped to the net price, so the loan principal is never negative.
- Two fields are added to `summary` beyond spec §6.2 for the UI: `horizonYears`, and `heldFlatLiabilities` (the indexes of liabilities held at today's balance). Spec §6.2 requires that "held at today's balance" label, and this is how the UI learns which rows get it.

- [ ] **Step 1: Write the failing test**

Add these imports to `scripts/verify-remodel-roi.ts`:

```ts
import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'

import { createRemodelRoiDefaults } from '@/features/calculators/remodel-roi-calculator/constants/form-defaults'
import { RATE_KEYS } from '@/features/calculators/remodel-roi-calculator/constants/rates'
import { projectRemodelRoi } from '@/features/calculators/remodel-roi-calculator/lib/project-remodel-roi'
import { resolveRemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/lib/resolve-config'
import { remodelRoiConfigSchema } from '@/features/calculators/remodel-roi-calculator/schemas/config'
```

Insert this block immediately before `console.log('✅ verify-remodel-roi passed')`:

```ts
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

// SP-M1: appreciation golden
{
  const { projection, last } = lastYear(scenario((v) => {
    v.homeValue = 1000000
  }))
  assert.equal(projection.years.length, 6, 't = 0…5')
  assert.equal(Math.round(last.homeValueBefore), 1216653, '$1,000,000 at 4% for 5 years')
}

// SP-M3: cumulative bills at g = 0 and g > 0
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

// SP-M4: loan payment parity
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

// Cash purchase and an oversized down payment (Review Focus 3)
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

// SP-M5 liabilities: amortized with an APR, held flat without one
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

// SP-M7 monthly now
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

// SP-M8 break-even found and not found
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

// SP-I8 uplift as a percent of price
{
  const { projection } = lastYear(scenario((v) => {
    zeroRates(v)
    v.homeValue = 400000
    v.project.price = 50000
    v.project.uplift = { mode: 'percentOfPrice', value: 10 }
  }))
  near(projection.summary.valueGained, 5000, '10% of a $50,000 project')
}

// SP-M9 no NaN for any valid input, including the untouched defaults
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm tsx scripts/verify-remodel-roi.ts`
Expected: FAIL with module not found for `remodel-roi-calculator/...`.

- [ ] **Step 3: Config**

`SV/schemas/config.ts`:

```ts
import { z } from 'zod'

const ratePercent = z.number().min(-20).max(50)

export const remodelRoiConfigSchema = z.object({
  defaultHorizonYears: z.number().int().min(1).max(30),
  defaultRatesPercent: z.object({
    homeAppreciation: ratePercent,
    electric: ratePercent,
    gas: ratePercent,
    water: ratePercent,
    gardening: ratePercent,
    misc: ratePercent,
  }),
})

export type RemodelRoiConfig = z.infer<typeof remodelRoiConfigSchema>
export type RateKey = keyof RemodelRoiConfig['defaultRatesPercent']
```

`SV/constants/config-defaults.ts`:

```ts
import type { RemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/schemas/config'

export const REMODEL_ROI_CONFIG_DEFAULTS = {
  defaultHorizonYears: 5,
  // Carried over from the old calculator, which cited no source for these rates; they stay visible and editable on screen.
  defaultRatesPercent: { homeAppreciation: 4, electric: 9.4, gas: 13.1, water: 10.3, gardening: 5, misc: 0 },
} satisfies RemodelRoiConfig
```

`SV/lib/resolve-config.ts`:

```ts
import type { RemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/schemas/config'

import { REMODEL_ROI_CONFIG_DEFAULTS } from '@/features/calculators/remodel-roi-calculator/constants/config-defaults'
import { remodelRoiConfigSchema } from '@/features/calculators/remodel-roi-calculator/schemas/config'

// Admin-configured savings defaults have no storage or admin screen yet, so the System defaults are the whole answer for now.
export function resolveRemodelRoiConfig(): RemodelRoiConfig {
  return remodelRoiConfigSchema.parse(REMODEL_ROI_CONFIG_DEFAULTS)
}
```

- [ ] **Step 4: Constants and form schema**

`SV/constants/bill-categories.ts`:

```ts
export const BILL_CATEGORIES = ['electric', 'gas', 'water', 'gardening', 'misc'] as const

export type BillCategory = typeof BILL_CATEGORIES[number]

export const BILL_CATEGORY_LABELS = {
  electric: 'Electric',
  gas: 'Gas',
  water: 'Water',
  gardening: 'Gardening',
  misc: 'Misc',
} as const satisfies Record<BillCategory, string>
```

`SV/constants/rates.ts`:

```ts
import type { RateKey } from '@/features/calculators/remodel-roi-calculator/schemas/config'

export const RATE_KEYS = ['homeAppreciation', 'electric', 'gas', 'water', 'gardening', 'misc'] as const satisfies readonly RateKey[]

export const RATE_LABELS = {
  homeAppreciation: 'Home appreciation',
  electric: 'Electric rate increase',
  gas: 'Gas rate increase',
  water: 'Water rate increase',
  gardening: 'Gardening price increase',
  misc: 'Misc increase (0 keeps it flat)',
} as const satisfies Record<RateKey, string>
```

`SV/constants/uplift-modes.ts`:

```ts
export const UPLIFT_MODES = ['amount', 'percentOfPrice'] as const

export type UpliftMode = typeof UPLIFT_MODES[number]

export const UPLIFT_MODE_LABELS = {
  amount: '$',
  percentOfPrice: '% of price',
} as const satisfies Record<UpliftMode, string>
```

`SV/schemas/form.ts`:

```ts
import { z } from 'zod'

import { UPLIFT_MODES } from '@/features/calculators/remodel-roi-calculator/constants/uplift-modes'

const amount = z.number().min(0).nullable()
const aprPercent = z.number().min(0).max(40).nullable()
const ratePercent = z.number().min(-20).max(50).nullable()
const bills = z.object({ electric: amount, gas: amount, water: amount, gardening: amount, misc: amount })

export const remodelRoiFormSchema = z.object({
  homeValue: amount,
  liabilities: z.array(z.object({
    label: z.string().max(60),
    balance: amount,
    monthlyPayment: amount,
    aprPercent,
  })),
  billsNow: bills,
  billsAfter: bills,
  project: z.object({
    price: amount,
    incentives: amount,
    downPayment: amount,
    aprPercent,
    termMonths: z.number().int().min(0).max(480).nullable(),
    uplift: z.object({ mode: z.enum(UPLIFT_MODES), value: amount }),
  }),
  assumptions: z.object({
    horizonYears: z.number().int().min(1).max(30).nullable(),
    ratesPercent: z.object({
      homeAppreciation: ratePercent,
      electric: ratePercent,
      gas: ratePercent,
      water: ratePercent,
      gardening: ratePercent,
      misc: ratePercent,
    }),
  }),
})

export type RemodelRoiFormValues = z.infer<typeof remodelRoiFormSchema>
```

`SV/constants/form-defaults.ts`:

```ts
import type { RemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/schemas/config'
import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'

type Bills = RemodelRoiFormValues['billsNow']
type Liability = RemodelRoiFormValues['liabilities'][number]

export const EMPTY_LIABILITY: Liability = { label: '', balance: null, monthlyPayment: null, aprPercent: null }

function emptyBills(): Bills {
  return { electric: null, gas: null, water: null, gardening: null, misc: null }
}

export function createRemodelRoiDefaults(config: RemodelRoiConfig): RemodelRoiFormValues {
  return {
    homeValue: null,
    liabilities: [],
    billsNow: emptyBills(),
    billsAfter: emptyBills(),
    project: {
      price: null,
      incentives: null,
      downPayment: null,
      aprPercent: null,
      termMonths: null,
      uplift: { mode: 'amount', value: 0 },
    },
    assumptions: {
      horizonYears: config.defaultHorizonYears,
      ratesPercent: { ...config.defaultRatesPercent },
    },
  }
}
```

`SV/types/index.ts`:

```ts
export interface ProjectionYear {
  t: number
  homeValueBefore: number
  homeValueAfter: number
  cumulativeCostBefore: number
  cumulativeCostAfter: number
  netWorthBefore: number
  netWorthAfter: number
  netBenefit: number
}

export interface ProjectionSummary {
  monthlyBefore: number
  monthlyAfter: number
  monthlyDifference: number
  cumulativeSavings: number
  valueGained: number
  netBenefit: number
  breakEvenYear: number | null
  projectMonthlyPayment: number
  horizonYears: number
  heldFlatLiabilities: number[]
}

export interface RemodelRoiProjection {
  years: ProjectionYear[]
  summary: ProjectionSummary
}
```

- [ ] **Step 5: `projectRemodelRoi`**

`SV/lib/project-remodel-roi.ts`:

```ts
import type { RateKey, RemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/schemas/config'
import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'
import type { RemodelRoiProjection, ProjectionYear } from '@/features/calculators/remodel-roi-calculator/types'

import { BILL_CATEGORIES } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
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

function sumBills(bills: RemodelRoiFormValues['billsNow']): number {
  return BILL_CATEGORIES.reduce((sum, category) => sum + amountOf(bills[category]), 0)
}

// Kept free of React and I/O so the engine can move to a shared module once its permanent home is decided.
export function projectRemodelRoi(input: RemodelRoiFormValues, config: RemodelRoiConfig): RemodelRoiProjection {
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

  function billsPaid(bills: RemodelRoiFormValues['billsNow'], t: number): number {
    return BILL_CATEGORIES.reduce((sum, category) => sum + cumulativeBills(amountOf(bills[category]), rate(category), t), 0)
  }

  const years: ProjectionYear[] = []
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
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm tsx scripts/verify-remodel-roi.ts`
Expected: `✅ verify-remodel-roi passed`

- [ ] **Step 7: Gates**

Run: `pnpm exec eslint --fix src/features/calculators scripts/verify-remodel-roi.ts && pnpm tsc && pnpm lint`
Expected: no errors. (`tsconfig` does not enable `noUncheckedIndexedAccess`, so indexing `years` needs no non-null assertion.)

- [ ] **Step 8: Commit**

```bash
git add src/features/calculators/remodel-roi-calculator scripts/verify-remodel-roi.ts
git commit -m "feat(calculators): Remodel ROI Calculator engine

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Route, sidebar entry and tabs shell

This covers UI1, UI2 and I8.

**Files:**
- Modify: `src/shared/config/roots.ts` (inside `APP_ROOTS.dashboard`, after `analytics`)
- Modify: `src/features/agent-dashboard/lib/get-sidebar-nav.ts`
- Create: `src/app/(frontend)/dashboard/calculators/page.tsx`
- Create: `src/features/calculators/constants/query-parsers.ts`
- Create: `src/features/calculators/ui/views/calculators-view.tsx`
- Create (placeholders, replaced in Tasks 6 and 8): `SP/ui/views/scope-pricing-calculator.tsx`, `SV/ui/views/remodel-roi-calculator.tsx`

**Interfaces:**
- Produces:
  - `ROOTS.dashboard.calculators(): '/dashboard/calculators'`.
  - `CALCULATOR_TABS`, `CalculatorTab` and `calculatorTabParser`.
  - `CalculatorsView`, `ScopePricingCalculator` and `RemodelRoiCalculator` (both views take no props).

- [ ] **Step 1: Root and sidebar**

In `src/shared/config/roots.ts`, add after `analytics: () => '/dashboard/analytics',`:

```ts
    calculators: () => '/dashboard/calculators',
```

In `src/features/agent-dashboard/lib/get-sidebar-nav.ts`, add `CalculatorIcon` to the lucide import (alphabetical, after `BarChart3Icon`). Then append this entry to `mainItems` after the Schedule item:

```ts
    {
      href: ROOTS.dashboard.calculators(),
      icon: CalculatorIcon,
      label: 'Calculators',
      enabled: ability.can('access', 'Dashboard'),
    },
```

- [ ] **Step 2: Tab parser**

`src/features/calculators/constants/query-parsers.ts`:

```ts
import { parseAsStringLiteral } from 'nuqs'

export const CALCULATOR_TABS = ['scope-pricing', 'remodel-roi'] as const

export type CalculatorTab = typeof CALCULATOR_TABS[number]

export const calculatorTabParser = parseAsStringLiteral(CALCULATOR_TABS).withDefault('scope-pricing')
```

- [ ] **Step 3: Placeholder views**

`SP/ui/views/scope-pricing-calculator.tsx`:

```tsx
'use client'

import { EmptyState } from '@/shared/components/states/empty-state'

export function ScopePricingCalculator() {
  return <EmptyState title="Scope Pricing" description="Being built." />
}
```

`SV/ui/views/remodel-roi-calculator.tsx`:

```tsx
'use client'

import { EmptyState } from '@/shared/components/states/empty-state'

export function RemodelRoiCalculator() {
  return <EmptyState title="Remodel ROI Calculator" description="Being built." />
}
```

- [ ] **Step 4: Tabs shell**

`src/features/calculators/ui/views/calculators-view.tsx`. Both panels are force-mounted so the rep's entries survive a tab switch (Review Focus 1):

```tsx
'use client'

import type { CalculatorTab } from '@/features/calculators/constants/query-parsers'

import { useQueryState } from 'nuqs'

import { calculatorTabParser } from '@/features/calculators/constants/query-parsers'
import { RemodelRoiCalculator } from '@/features/calculators/remodel-roi-calculator/ui/views/remodel-roi-calculator'
import { ScopePricingCalculator } from '@/features/calculators/scope-pricing-calculator/ui/views/scope-pricing-calculator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'

// Nothing entered here is saved: the calculators are a live aid in the home until results can be kept against a meeting or proposal.
export function CalculatorsView() {
  const [tab, setTab] = useQueryState('tab', calculatorTabParser)

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Calculators</h1>
      </header>

      <Tabs className="flex min-h-0 flex-1 flex-col" onValueChange={value => setTab(value as CalculatorTab)} value={tab}>
        <TabsList>
          <TabsTrigger className="min-h-11" value="scope-pricing">Scope Pricing</TabsTrigger>
          <TabsTrigger className="min-h-11" value="remodel-roi">Remodel ROI Calculator</TabsTrigger>
        </TabsList>

        <TabsContent className="min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden" forceMount value="scope-pricing">
          <ScopePricingCalculator />
        </TabsContent>
        <TabsContent className="min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden" forceMount value="remodel-roi">
          <RemodelRoiCalculator />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 5: Page**

`src/app/(frontend)/dashboard/calculators/page.tsx`. The dashboard layout already renders the sign-in screen for anonymous visitors:

```tsx
import { CalculatorsView } from '@/features/calculators/ui/views/calculators-view'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function CalculatorsPage() {
  await protectDashboardPage()
  return <CalculatorsView />
}
```

- [ ] **Step 6: Gates and smoke**

Run: `pnpm exec eslint --fix src/features/calculators "src/app/(frontend)/dashboard/calculators" src/features/agent-dashboard/lib/get-sidebar-nav.ts src/shared/config/roots.ts && pnpm tsc && pnpm lint`
Expected: no errors.

Before starting a dev server, run `ss -ltnp | grep -E ':300[0-9]'` and reuse a running one if there is one. Open `/dashboard/calculators`. Expected: the sidebar shows "Calculators", both tab placeholders render, and `?tab=remodel-roi` selects the second tab.

- [ ] **Step 7: Commit**

```bash
git add src/shared/config/roots.ts src/features/agent-dashboard/lib/get-sidebar-nav.ts "src/app/(frontend)/dashboard/calculators/page.tsx" src/features/calculators/constants/query-parsers.ts src/features/calculators/ui/views/calculators-view.tsx src/features/calculators/scope-pricing-calculator/ui/views/scope-pricing-calculator.tsx src/features/calculators/remodel-roi-calculator/ui/views/remodel-roi-calculator.tsx
git commit -m "feat(calculators): /dashboard/calculators route, sidebar entry, tabs shell

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Scope Pricing UI (homeowner screen)

This covers PR9, PR10, UI4–UI7 and O1. The layout here is a plain, functional baseline. Task 9 restyles it to the owner's chosen direction.

**Files:**
- Modify: `SP/schemas/form.ts` (append the form schema)
- Create: `SP/constants/form-defaults.ts`
- Create: `SP/lib/create-quote-line.ts`, `SP/lib/format-variable-option.ts`, `SP/lib/describe-variable-issue.ts`
- Create: `SP/hooks/use-scope-pricing-quote.ts`
- Create: `SP/ui/components/{project-context-fields,variable-field,line-price,line-actions,formula-line-card,manual-line-card,permit-lines,add-scope-picker,quote-total}.tsx`
- Replace: `SP/ui/views/scope-pricing-calculator.tsx`

**Interfaces:**
- Consumes: `priceQuote`, `solveMultiplier` and the quote types (Task 3); `FORMULAS`, `FORMULA_GROUPS`, `VARIABLES`, `UNIT_SUFFIXES`, the project-context constants and `resolveScopePricingConfig` (Task 2).
- Produces:
  - `createScopePricingFormSchema(multiplierFloor: number)`. Spec §5.3 calls this `scopePricingFormSchema`. It is a factory because the multiplier floor is config.
  - The types `ScopePricingFormValues`, `ScopePricingLineValues`, `FormulaLineValues` and `ManualLineValues`.
  - `SCOPE_PRICING_FORM_DEFAULTS`.
  - `createFormulaLine(key)`, `createManualLine()` and `duplicateLine(line)`.
  - `useScopePricingQuote(control, config): { quote: QuoteResult, solved: SolveMultiplierResult | null }`.
  - Task 7's `AgentPanel` is imported by the view. Until Task 7 lands, the view renders without it (Step 7 below).

- [ ] **Step 1: Form schema and defaults**

Append to `SP/schemas/form.ts` (and add the `PRICING_KEYS` import next to `CURRENT_ROOF_TYPES`):

```ts
const variableInputValue = z.union([z.number(), z.string(), z.boolean()]).nullable()

const formulaLineSchema = z.object({
  id: z.string(),
  kind: z.literal('formula'),
  pricingKey: z.enum(PRICING_KEYS),
  variables: z.record(z.string(), variableInputValue),
})

const manualLineSchema = z.object({
  id: z.string(),
  kind: z.literal('manual'),
  label: z.string().max(80),
  price: z.number().min(0).nullable(),
})

export function createScopePricingFormSchema(multiplierFloor: number) {
  return z.object({
    context: projectContextSchema,
    lines: z.array(z.discriminatedUnion('kind', [formulaLineSchema, manualLineSchema])),
    agent: z.object({
      multiplier: z.number().min(multiplierFloor, { message: `The multiplier can't go below ${multiplierFloor}` }).nullable(),
      targetPrice: z.number().min(0).nullable(),
    }),
  })
}

export type ScopePricingFormValues = z.infer<ReturnType<typeof createScopePricingFormSchema>>
export type ScopePricingLineValues = ScopePricingFormValues['lines'][number]
export type FormulaLineValues = Extract<ScopePricingLineValues, { kind: 'formula' }>
export type ManualLineValues = Extract<ScopePricingLineValues, { kind: 'manual' }>
```

`SP/constants/form-defaults.ts`:

```ts
import type { ScopePricingFormValues } from '@/features/calculators/scope-pricing-calculator/schemas/form'

export const SCOPE_PRICING_FORM_DEFAULTS: ScopePricingFormValues = {
  context: { numStories: 1, currentRoofType: 'shingle' },
  lines: [],
  agent: { multiplier: null, targetPrice: null },
}
```

- [ ] **Step 2: Pure helpers**

`SP/lib/create-quote-line.ts`. A new line is prefilled with its defaults, so the fields show the values the price uses:

```ts
import type { PricingKey } from '@/features/calculators/scope-pricing-calculator/constants/pricing-keys'
import type { FormulaLineValues, ManualLineValues, ScopePricingLineValues } from '@/features/calculators/scope-pricing-calculator/schemas/form'
import type { VariableDef } from '@/features/calculators/scope-pricing-calculator/types'

import { VARIABLES } from '@/features/calculators/scope-pricing-calculator/constants/variables'
import { FORMULAS } from '@/features/calculators/scope-pricing-calculator/lib/formula-registry'

export function createFormulaLine(pricingKey: PricingKey): FormulaLineValues {
  const formula = FORMULAS[pricingKey]
  const variables: FormulaLineValues['variables'] = {}
  for (const key of formula.variables) {
    const def: VariableDef = VARIABLES[key]
    variables[key] = formula.defaults?.[key] ?? def.default ?? null
  }
  return { id: crypto.randomUUID(), kind: 'formula', pricingKey, variables }
}

export function createManualLine(): ManualLineValues {
  return { id: crypto.randomUUID(), kind: 'manual', label: '', price: null }
}

export function duplicateLine(line: ScopePricingLineValues): ScopePricingLineValues {
  return line.kind === 'formula'
    ? { ...line, id: crypto.randomUUID(), variables: { ...line.variables } }
    : { ...line, id: crypto.randomUUID() }
}
```

`SP/lib/format-variable-option.ts`:

```ts
import type { SelectOption, SelectVariableDef } from '@/features/calculators/scope-pricing-calculator/types'

import { UNIT_SUFFIXES } from '@/features/calculators/scope-pricing-calculator/constants/variable-units'

export function formatVariableOption(def: SelectVariableDef, option: SelectOption): string {
  const named = def.optionLabels?.[String(option)]
  if (named) {
    return named
  }
  const suffix = def.unit ? UNIT_SUFFIXES[def.unit] : ''
  return suffix ? `${option} ${suffix}` : String(option)
}
```

`SP/lib/describe-variable-issue.ts`:

```ts
import type { VariableDef } from '@/features/calculators/scope-pricing-calculator/types'

export function describeVariableIssue(def: VariableDef, value: unknown): string {
  if (value == null) {
    return 'Required'
  }
  if (def.kind === 'number') {
    return `Enter ${def.min.toLocaleString('en-US')}–${def.max.toLocaleString('en-US')}`
  }
  return 'Choose an option'
}
```

- [ ] **Step 3: Hook**

`SP/hooks/use-scope-pricing-quote.ts`. While a target price is set, it derives the multiplier. The solved value is never written back into the form (UI6):

```ts
import type { Control } from 'react-hook-form'
import type { ScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/schemas/config'
import type { ScopePricingFormValues } from '@/features/calculators/scope-pricing-calculator/schemas/form'

import { useMemo } from 'react'
import { useWatch } from 'react-hook-form'

import { priceQuote } from '@/features/calculators/scope-pricing-calculator/lib/price-quote'
import { solveMultiplier } from '@/features/calculators/scope-pricing-calculator/lib/solve-multiplier'

export function useScopePricingQuote(control: Control<ScopePricingFormValues>, config: ScopePricingConfig) {
  const [context, lines, agent] = useWatch({ control, name: ['context', 'lines', 'agent'] })

  return useMemo(() => {
    const input = { lines, context, config }
    const solved = agent.targetPrice == null ? null : solveMultiplier(agent.targetPrice, input)
    const multiplier = solved != null && solved.status !== 'no-cost' ? solved.multiplier : agent.multiplier
    return { quote: priceQuote({ ...input, overrides: { multiplier } }), solved }
  }, [context, lines, agent, config])
}
```

- [ ] **Step 4: Field components**

`SP/ui/components/project-context-fields.tsx`:

```tsx
'use client'

import type { ScopePricingFormValues } from '@/features/calculators/scope-pricing-calculator/schemas/form'

import { useFormContext } from 'react-hook-form'

import { CURRENT_ROOF_TYPE_LABELS, CURRENT_ROOF_TYPES, NUM_STORIES_OPTIONS } from '@/features/calculators/scope-pricing-calculator/constants/project-context'
import { FormControl, FormField, FormItem, FormLabel } from '@/shared/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

export function ProjectContextFields() {
  const { control } = useFormContext<ScopePricingFormValues>()

  return (
    <fieldset className="grid flex-1 grid-cols-2 gap-3">
      <legend className="sr-only">About the home</legend>
      <FormField
        control={control}
        name="context.numStories"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Number of stories</FormLabel>
            <Select onValueChange={value => field.onChange(Number(value))} value={String(field.value)}>
              <FormControl>
                <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {NUM_STORIES_OPTIONS.map(option => <SelectItem key={option} value={String(option)}>{option}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="context.currentRoofType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Starting roof type</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {CURRENT_ROOF_TYPES.map(option => <SelectItem key={option} value={option}>{CURRENT_ROOF_TYPE_LABELS[option]}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />
    </fieldset>
  )
}
```

`SP/ui/components/variable-field.tsx` renders one generic field per Variable kind (UI5):

```tsx
'use client'

import type { ScopePricingFormValues } from '@/features/calculators/scope-pricing-calculator/schemas/form'
import type { VariableDef, VariableKey } from '@/features/calculators/scope-pricing-calculator/types'

import { useFormContext } from 'react-hook-form'

import { VARIABLES } from '@/features/calculators/scope-pricing-calculator/constants/variables'
import { describeVariableIssue } from '@/features/calculators/scope-pricing-calculator/lib/describe-variable-issue'
import { formatVariableOption } from '@/features/calculators/scope-pricing-calculator/lib/format-variable-option'
import { FormControl, FormField, FormItem, FormLabel } from '@/shared/components/ui/form'
import { NumberField } from '@/shared/components/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'

interface Props {
  lineIndex: number
  variableKey: VariableKey
  flagged: boolean
}

export function VariableField({ lineIndex, variableKey, flagged }: Props) {
  const { control } = useFormContext<ScopePricingFormValues>()
  const def: VariableDef = VARIABLES[variableKey]

  return (
    <FormField
      control={control}
      name={`lines.${lineIndex}.variables.${variableKey}`}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{def.label}</FormLabel>
          {def.kind === 'number' && (
            <FormControl>
              <NumberField
                className="h-11"
                inputMode="decimal"
                max={def.max}
                min={def.min}
                name={field.name}
                onBlur={field.onBlur}
                onChange={field.onChange}
                ref={field.ref}
                value={typeof field.value === 'number' ? field.value : null}
              />
            </FormControl>
          )}
          {def.kind === 'select' && (
            <Select
              onValueChange={next => field.onChange(def.options.find(option => String(option) === next) ?? null)}
              value={field.value == null ? '' : String(field.value)}
            >
              <FormControl>
                <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Choose" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {def.options.map(option => (
                  <SelectItem key={String(option)} value={String(option)}>{formatVariableOption(def, option)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {def.kind === 'boolean' && (
            <div className="flex h-11 items-center">
              <FormControl>
                <Switch checked={field.value === true} onCheckedChange={field.onChange} />
              </FormControl>
            </div>
          )}
          {flagged && <p className="text-sm text-destructive">{describeVariableIssue(def, field.value)}</p>}
        </FormItem>
      )}
    />
  )
}
```

- [ ] **Step 5: Line components**

`SP/ui/components/line-price.tsx`:

```tsx
import type { QuoteLineResult } from '@/features/calculators/scope-pricing-calculator/types'

import { VARIABLES } from '@/features/calculators/scope-pricing-calculator/constants/variables'
import { formatAsDollars } from '@/shared/lib/formatters'

interface Props {
  result: QuoteLineResult | undefined
}

export function LinePrice({ result }: Props) {
  if (result == null) {
    return null
  }
  if (result.status === 'priced') {
    return <p className="shrink-0 text-lg font-semibold tabular-nums">{formatAsDollars(result.price)}</p>
  }
  const needs = result.needs.length > 0
    ? `Needs ${result.needs.map(key => VARIABLES[key].label.toLowerCase()).join(', ')}`
    : 'Needs a price'
  return <p className="max-w-48 shrink-0 text-right text-sm text-amber-600 dark:text-amber-400">{needs}</p>
}
```

`SP/ui/components/line-actions.tsx`:

```tsx
'use client'

import { CopyIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'

interface Props {
  onDuplicate: () => void
  onRemove: () => void
}

export function LineActions({ onDuplicate, onRemove }: Props) {
  return (
    <div className="flex justify-end gap-1">
      <Button aria-label="Duplicate line" className="size-11" onClick={onDuplicate} size="icon" type="button" variant="ghost">
        <CopyIcon />
      </Button>
      <Button aria-label="Remove line" className="size-11" onClick={onRemove} size="icon" type="button" variant="ghost">
        <Trash2Icon />
      </Button>
    </div>
  )
}
```

`SP/ui/components/formula-line-card.tsx`:

```tsx
'use client'

import type { PricingKey } from '@/features/calculators/scope-pricing-calculator/constants/pricing-keys'
import type { QuoteLineResult } from '@/features/calculators/scope-pricing-calculator/types'

import { FORMULAS } from '@/features/calculators/scope-pricing-calculator/lib/formula-registry'
import { LineActions } from '@/features/calculators/scope-pricing-calculator/ui/components/line-actions'
import { LinePrice } from '@/features/calculators/scope-pricing-calculator/ui/components/line-price'
import { VariableField } from '@/features/calculators/scope-pricing-calculator/ui/components/variable-field'
import { Card } from '@/shared/components/ui/card'

interface Props {
  index: number
  pricingKey: PricingKey
  result: QuoteLineResult | undefined
  onDuplicate: () => void
  onRemove: () => void
}

export function FormulaLineCard({ index, pricingKey, result, onDuplicate, onRemove }: Props) {
  const formula = FORMULAS[pricingKey]
  const needs = result?.status === 'incomplete' ? result.needs : []

  return (
    <Card className="gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium">{formula.label}</h3>
          <p className="text-sm text-muted-foreground">{formula.outcome}</p>
        </div>
        <LinePrice result={result} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {formula.variables.map(key => (
          <VariableField flagged={needs.includes(key)} key={key} lineIndex={index} variableKey={key} />
        ))}
      </div>
      <LineActions onDuplicate={onDuplicate} onRemove={onRemove} />
    </Card>
  )
}
```

`SP/ui/components/manual-line-card.tsx`:

```tsx
'use client'

import type { ScopePricingFormValues } from '@/features/calculators/scope-pricing-calculator/schemas/form'

import { useFormContext } from 'react-hook-form'

import { LineActions } from '@/features/calculators/scope-pricing-calculator/ui/components/line-actions'
import { Card } from '@/shared/components/ui/card'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { NumberField } from '@/shared/components/ui/number-field'

interface Props {
  index: number
  onDuplicate: () => void
  onRemove: () => void
}

export function ManualLineCard({ index, onDuplicate, onRemove }: Props) {
  const { control } = useFormContext<ScopePricingFormValues>()

  return (
    <Card className="gap-4 p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <FormField
          control={control}
          name={`lines.${index}.label`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input className="h-11" maxLength={80} placeholder="What this line covers" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`lines.${index}.price`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price</FormLabel>
              <FormControl>
                <NumberField {...field} className="h-11" inputMode="decimal" min={0} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <LineActions onDuplicate={onDuplicate} onRemove={onRemove} />
    </Card>
  )
}
```

`SP/ui/components/permit-lines.tsx`:

```tsx
import type { QuoteResult } from '@/features/calculators/scope-pricing-calculator/types'

import { formatAsDollars } from '@/shared/lib/formatters'

interface Props {
  quote: QuoteResult
}

export function PermitLines({ quote }: Props) {
  const permits = quote.lines.filter(line => line.kind === 'permit' && line.status === 'priced')
  if (permits.length === 0) {
    return null
  }
  return (
    <ul className="flex flex-col gap-1 px-1 text-sm">
      {permits.map(line => (
        <li className="flex justify-between" key={line.id}>
          <span>{line.label}</span>
          <span className="tabular-nums">{line.status === 'priced' ? formatAsDollars(line.price) : null}</span>
        </li>
      ))}
    </ul>
  )
}
```

`SP/ui/components/add-scope-picker.tsx`. It lists scopes grouped by trade, and "Manual price line" is the last option:

```tsx
'use client'

import type { PricingKey } from '@/features/calculators/scope-pricing-calculator/constants/pricing-keys'

import { PlusIcon } from 'lucide-react'
import { useState } from 'react'

import { FORMULA_GROUPS } from '@/features/calculators/scope-pricing-calculator/lib/formula-registry'
import { Button } from '@/shared/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/shared/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

interface Props {
  onAddFormula: (pricingKey: PricingKey) => void
  onAddManual: () => void
}

export function AddScopePicker({ onAddFormula, onAddManual }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button className="h-11 self-start" type="button" variant="outline">
          <PlusIcon />
          Add scope
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Search scopes" />
          <CommandList>
            <CommandEmpty>No scope matches.</CommandEmpty>
            {FORMULA_GROUPS.map(group => (
              <CommandGroup heading={group.label} key={group.trade}>
                {group.formulas.map(formula => (
                  <CommandItem
                    className="min-h-11"
                    key={formula.key}
                    onSelect={() => {
                      onAddFormula(formula.key)
                      setOpen(false)
                    }}
                    value={`${group.label} ${formula.label}`}
                  >
                    {formula.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                className="min-h-11"
                onSelect={() => {
                  onAddManual()
                  setOpen(false)
                }}
                value="Manual price line"
              >
                Manual price line
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

`SP/ui/components/quote-total.tsx`:

```tsx
import type { QuoteResult } from '@/features/calculators/scope-pricing-calculator/types'

import { formatAsDollars } from '@/shared/lib/formatters'

interface Props {
  quote: QuoteResult
}

export function QuoteTotal({ quote }: Props) {
  const unfinished = quote.lines.filter(line => line.status === 'incomplete').length

  return (
    <section aria-label="Your price" className="sticky bottom-0 rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">Your price</p>
      <p className="text-4xl font-semibold tabular-nums">{formatAsDollars(quote.totalPrice)}</p>
      <p className="text-xs text-muted-foreground">Includes tax</p>
      {unfinished > 0 && (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
          {unfinished === 1 ? '1 line needs details and is not in this price yet' : `${unfinished} lines need details and are not in this price yet`}
        </p>
      )}
    </section>
  )
}
```

- [ ] **Step 6: The view**

Replace `SP/ui/views/scope-pricing-calculator.tsx`. `keyName: 'fieldKey'` keeps RHF's generated key from shadowing each line's own `id`, which is how each card finds its result:

```tsx
'use client'

import type { ScopePricingFormValues } from '@/features/calculators/scope-pricing-calculator/schemas/form'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'

import { SCOPE_PRICING_FORM_DEFAULTS } from '@/features/calculators/scope-pricing-calculator/constants/form-defaults'
import { useScopePricingQuote } from '@/features/calculators/scope-pricing-calculator/hooks/use-scope-pricing-quote'
import { createFormulaLine, createManualLine, duplicateLine } from '@/features/calculators/scope-pricing-calculator/lib/create-quote-line'
import { resolveScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/lib/resolve-config'
import { createScopePricingFormSchema } from '@/features/calculators/scope-pricing-calculator/schemas/form'
import { AddScopePicker } from '@/features/calculators/scope-pricing-calculator/ui/components/add-scope-picker'
import { FormulaLineCard } from '@/features/calculators/scope-pricing-calculator/ui/components/formula-line-card'
import { ManualLineCard } from '@/features/calculators/scope-pricing-calculator/ui/components/manual-line-card'
import { PermitLines } from '@/features/calculators/scope-pricing-calculator/ui/components/permit-lines'
import { ProjectContextFields } from '@/features/calculators/scope-pricing-calculator/ui/components/project-context-fields'
import { QuoteTotal } from '@/features/calculators/scope-pricing-calculator/ui/components/quote-total'
import { Form } from '@/shared/components/ui/form'

export function ScopePricingCalculator() {
  const [config] = useState(resolveScopePricingConfig)
  const [schema] = useState(() => createScopePricingFormSchema(config.multiplier.floor))
  const form = useForm<ScopePricingFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: SCOPE_PRICING_FORM_DEFAULTS,
  })
  const lines = useFieldArray({ control: form.control, name: 'lines', keyName: 'fieldKey' })
  const { quote } = useScopePricingQuote(form.control, config)

  return (
    <Form {...form}>
      <form className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-8" noValidate onSubmit={event => event.preventDefault()}>
        <div className="flex items-end gap-3">
          <ProjectContextFields />
        </div>

        <section aria-label="Quote" className="flex flex-col gap-3">
          {lines.fields.map((field, index) => {
            const result = quote.lines.find(line => line.id === field.id)
            const onDuplicate = () => lines.insert(index + 1, duplicateLine(form.getValues(`lines.${index}`)))
            const onRemove = () => lines.remove(index)
            return field.kind === 'formula'
              ? <FormulaLineCard index={index} key={field.fieldKey} onDuplicate={onDuplicate} onRemove={onRemove} pricingKey={field.pricingKey} result={result} />
              : <ManualLineCard index={index} key={field.fieldKey} onDuplicate={onDuplicate} onRemove={onRemove} />
          })}
          {lines.fields.length === 0 && (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Add the scopes you measured to see the price.
            </p>
          )}
          <PermitLines quote={quote} />
          <AddScopePicker onAddFormula={key => lines.append(createFormulaLine(key))} onAddManual={() => lines.append(createManualLine())} />
        </section>

        <QuoteTotal quote={quote} />
      </form>
    </Form>
  )
}
```

- [ ] **Step 7: Gates and smoke**

Run: `pnpm exec eslint --fix src/features/calculators && pnpm tsc && pnpm lint`
Expected: no errors. If `pnpm tsc` rejects the template-literal `name` paths into the discriminated-union `lines` array, type the path with `FieldPath<ScopePricingFormValues>` at that one site rather than loosening the schema.

Smoke on `/dashboard/calculators` (tablet width, 1024×768):
1. Add "Roof Tear-off" with 20 pitched BSQ; the line shows $26,880 (Cost 9,600 × 2.8).
2. Add "Install Panels" with 20 panels and no watts; the line shows "Needs watts per panel", and the total is unchanged.
3. Enter 400 W; the line shows $78,400.
4. Add a manual line at $5,000, and duplicate and remove a line.
5. Check that nothing on screen says Cost, Multiplier or Margin.

- [ ] **Step 8: Commit**

```bash
git add src/features/calculators/scope-pricing-calculator
git commit -m "feat(calculators): Scope Pricing homeowner screen

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Agent panel

This covers O2, CF4, CF5, PR11 and D2's breakdown line.

**Files:**
- Create: `SP/constants/agent-panel.ts`
- Create: `SP/lib/step-multiplier.ts`, `SP/lib/describe-target-result.ts`, `SP/lib/format-unit-cost.ts`, `SP/lib/unit-cost-entries.ts`, `SP/lib/trades-in-quote.ts`
- Create: `SP/ui/components/agent-panel/{index,agent-readouts,multiplier-control,target-price-control,unit-costs-list}.tsx`
- Modify: `SP/ui/views/scope-pricing-calculator.tsx` (mount the panel)
- Modify: `scripts/verify-scope-pricing.ts` (pure-helper checks)

**Interfaces:**
- Consumes: `QuoteResult`, `SolveMultiplierResult`, `ScopePricingConfig`, `UNIT_COST_LABELS` and `TRADE_LABELS`; `formatMultiplier` and `MULTIPLIER_STYLES` (shared).
- Produces:
  - `AgentPanel({ config, quote, solved })`.
  - `stepMultiplier(current, delta, floor): number`.
  - `describeTargetResult(result, floor): string`.
  - `formatUnitCost(value): string`.
  - `unitCostEntries(config, trade)`.
  - `tradesInQuote(quote): PricingTrade[]`.

- [ ] **Step 1: Write the failing test**

Add these imports to `scripts/verify-scope-pricing.ts`:

```ts
import { describeTargetResult } from '@/features/calculators/scope-pricing-calculator/lib/describe-target-result'
import { formatUnitCost } from '@/features/calculators/scope-pricing-calculator/lib/format-unit-cost'
import { stepMultiplier } from '@/features/calculators/scope-pricing-calculator/lib/step-multiplier'
import { tradesInQuote } from '@/features/calculators/scope-pricing-calculator/lib/trades-in-quote'
import { unitCostEntries } from '@/features/calculators/scope-pricing-calculator/lib/unit-cost-entries'
```

Insert before the final `console.log`:

```ts
// ── Agent panel helpers ─────────────────────────────────────────────────────
assert.equal(stepMultiplier(2.8, 0.05, 2), 2.85, 'step up rounds to 2 decimals')
assert.equal(stepMultiplier(2.03, -0.05, 2), 2, 'step down stops at the floor')
assert.equal(formatUnitCost(3.5), '$3.50', 'fractional Unit Cost keeps cents')
assert.equal(formatUnitCost(8500), '$8,500', 'whole Unit Cost has no cents')
assert.deepEqual(unitCostEntries(config, 'electricals'), [
  { key: 'mpuBase', label: 'Main panel upgrade', value: 3200 },
  { key: 'mpuWithRelocation', label: 'Main panel upgrade (with relocation)', value: 4000 },
], 'Unit Cost entries carry the seed labels')
assert.deepEqual(tradesInQuote(mixed), ['solar'], 'trades from formula lines only')
assert.match(describeTargetResult(tooLow, 2), /2\.00x floor/, 'below-floor copy names the floor')
assert.match(describeTargetResult({ status: 'no-cost' }, 2), /formula/, 'no-cost copy')
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm tsx scripts/verify-scope-pricing.ts`
Expected: FAIL with module not found for `lib/describe-target-result`.

- [ ] **Step 3: Constants and pure helpers**

`SP/constants/agent-panel.ts`:

```ts
export const MULTIPLIER_STEP = 0.05
```

`SP/lib/step-multiplier.ts`:

```ts
export function stepMultiplier(current: number, delta: number, floor: number): number {
  return Math.max(floor, Math.round((current + delta) * 100) / 100)
}
```

`SP/lib/describe-target-result.ts`:

```ts
import type { SolveMultiplierResult } from '@/features/calculators/scope-pricing-calculator/types'

import { formatAsDollars } from '@/shared/lib/formatters'
import { formatMultiplier } from '@/shared/modules/proposals/core/lib/financials/tiers'

export function describeTargetResult(result: SolveMultiplierResult | null, floor: number): string {
  if (result == null) {
    return 'Enter a total and the multiplier is solved for you.'
  }
  if (result.status === 'no-cost') {
    return 'Only lines with a formula have cost data, so a target needs at least one.'
  }
  if (result.status === 'below-floor') {
    return `Out of reach without going under the ${formatMultiplier(floor)} floor. Lowest price: ${formatAsDollars(result.achievedTotal)}.`
  }
  return `${formatMultiplier(result.multiplier)} gives ${formatAsDollars(result.achievedTotal)}.`
}
```

`SP/lib/format-unit-cost.ts`:

```ts
export function formatUnitCost(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })
}
```

`SP/lib/unit-cost-entries.ts`:

```ts
import type { PricingTrade, ScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/schemas/config'

import { UNIT_COST_LABELS } from '@/features/calculators/scope-pricing-calculator/constants/unit-cost-labels'

export function unitCostEntries(config: ScopePricingConfig, trade: PricingTrade): { key: string, label: string, value: number }[] {
  const labels: Record<string, string> = UNIT_COST_LABELS[trade]
  return Object.entries(config.unitCosts[trade]).map(([key, value]) => ({ key, label: labels[key] ?? key, value }))
}
```

`SP/lib/trades-in-quote.ts`:

```ts
import type { PricingTrade } from '@/features/calculators/scope-pricing-calculator/schemas/config'
import type { QuoteResult } from '@/features/calculators/scope-pricing-calculator/types'

export function tradesInQuote(quote: QuoteResult): PricingTrade[] {
  return [...new Set(quote.lines.flatMap(line => (line.kind === 'formula' && line.trade != null ? [line.trade] : [])))]
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm tsx scripts/verify-scope-pricing.ts`
Expected: `✅ verify-scope-pricing passed`

- [ ] **Step 5: Panel components**

`SP/ui/components/agent-panel/agent-readouts.tsx`:

```tsx
import type { QuoteResult } from '@/features/calculators/scope-pricing-calculator/types'

import { cn } from '@/shared/lib/utils'
import { formatAsDollars } from '@/shared/lib/formatters'
import { MULTIPLIER_STYLES } from '@/shared/modules/proposals/core/constants/multiplier-styles'
import { formatMultiplier } from '@/shared/modules/proposals/core/lib/financials/tiers'

interface Props {
  quote: QuoteResult
}

export function AgentReadouts({ quote }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Price</dt>
        <dd className="text-right font-medium tabular-nums">{formatAsDollars(quote.totalPrice)}</dd>
        <dt className="text-muted-foreground">Cost</dt>
        <dd className="text-right tabular-nums">{formatAsDollars(quote.totalCost)}</dd>
        <dt className="text-muted-foreground">Margin</dt>
        <dd className="text-right tabular-nums">{formatAsDollars(quote.margin)}</dd>
        <dt className="text-muted-foreground">Multiplier</dt>
        <dd className={cn('text-right font-semibold tabular-nums', MULTIPLIER_STYLES[quote.tier])}>{formatMultiplier(quote.effectiveMultiplier)}</dd>
        <dt className="text-muted-foreground">Tax (inside the price)</dt>
        <dd className="text-right tabular-nums">{formatAsDollars(quote.totalTax)}</dd>
        <dt className="text-muted-foreground">Base</dt>
        <dd className="text-right tabular-nums">{formatAsDollars(quote.totalBase)}</dd>
      </dl>
      {quote.hasUncostedLines && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Manual lines have no cost data, so they are left out of cost, margin and multiplier.
        </p>
      )}
    </div>
  )
}
```

`SP/ui/components/agent-panel/multiplier-control.tsx`:

```tsx
'use client'

import type { ScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/schemas/config'
import type { ScopePricingFormValues } from '@/features/calculators/scope-pricing-calculator/schemas/form'

import { MinusIcon, PlusIcon } from 'lucide-react'
import { useFormContext } from 'react-hook-form'

import { MULTIPLIER_STEP } from '@/features/calculators/scope-pricing-calculator/constants/agent-panel'
import { stepMultiplier } from '@/features/calculators/scope-pricing-calculator/lib/step-multiplier'
import { Button } from '@/shared/components/ui/button'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { NumberField } from '@/shared/components/ui/number-field'
import { formatMultiplier } from '@/shared/modules/proposals/core/lib/financials/tiers'

interface Props {
  config: ScopePricingConfig
  appliedMultiplier: number
  targetActive: boolean
}

export function MultiplierControl({ config, appliedMultiplier, targetActive }: Props) {
  const { control } = useFormContext<ScopePricingFormValues>()
  const { floor } = config.multiplier

  return (
    <FormField
      control={control}
      name="agent.multiplier"
      render={({ field }) => {
        const current = field.value ?? config.multiplier.default
        return (
          <FormItem>
            <FormLabel>Multiplier</FormLabel>
            <div className="flex items-center gap-2">
              <Button
                aria-label="Lower the multiplier"
                className="size-11"
                disabled={targetActive || current <= floor}
                onClick={() => field.onChange(stepMultiplier(current, -MULTIPLIER_STEP, floor))}
                size="icon"
                type="button"
                variant="outline"
              >
                <MinusIcon />
              </Button>
              <FormControl>
                <NumberField
                  {...field}
                  className="h-11 text-center"
                  disabled={targetActive}
                  inputMode="decimal"
                  min={floor}
                  placeholder={String(config.multiplier.default)}
                  step={MULTIPLIER_STEP}
                />
              </FormControl>
              <Button
                aria-label="Raise the multiplier"
                className="size-11"
                disabled={targetActive}
                onClick={() => field.onChange(stepMultiplier(current, MULTIPLIER_STEP, floor))}
                size="icon"
                type="button"
                variant="outline"
              >
                <PlusIcon />
              </Button>
            </div>
            <FormDescription>
              {targetActive
                ? `Set by the target price: ${formatMultiplier(appliedMultiplier)}`
                : `Floor ${formatMultiplier(floor)} · default ${formatMultiplier(config.multiplier.default)}`}
            </FormDescription>
            <FormMessage />
            {field.value != null && !targetActive && (
              <Button className="self-start px-0" onClick={() => field.onChange(null)} type="button" variant="link">
                Back to the default
              </Button>
            )}
          </FormItem>
        )
      }}
    />
  )
}
```

`SP/ui/components/agent-panel/target-price-control.tsx`:

```tsx
'use client'

import type { ScopePricingFormValues } from '@/features/calculators/scope-pricing-calculator/schemas/form'
import type { SolveMultiplierResult } from '@/features/calculators/scope-pricing-calculator/types'

import { useFormContext } from 'react-hook-form'

import { describeTargetResult } from '@/features/calculators/scope-pricing-calculator/lib/describe-target-result'
import { Button } from '@/shared/components/ui/button'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { NumberField } from '@/shared/components/ui/number-field'

interface Props {
  solved: SolveMultiplierResult | null
  floor: number
}

export function TargetPriceControl({ solved, floor }: Props) {
  const { control } = useFormContext<ScopePricingFormValues>()

  return (
    <FormField
      control={control}
      name="agent.targetPrice"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Target price</FormLabel>
          <FormControl>
            <NumberField {...field} className="h-11" inputMode="decimal" min={0} placeholder="Total the homeowner should see" />
          </FormControl>
          <FormDescription>{describeTargetResult(solved, floor)}</FormDescription>
          <FormMessage />
          {field.value != null && (
            <Button className="self-start px-0" onClick={() => field.onChange(null)} type="button" variant="link">
              Clear the target
            </Button>
          )}
        </FormItem>
      )}
    />
  )
}
```

`SP/ui/components/agent-panel/unit-costs-list.tsx`:

```tsx
import type { PricingTrade, ScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/schemas/config'

import { Fragment } from 'react'

import { TRADE_LABELS } from '@/features/calculators/scope-pricing-calculator/constants/trade-labels'
import { formatUnitCost } from '@/features/calculators/scope-pricing-calculator/lib/format-unit-cost'
import { unitCostEntries } from '@/features/calculators/scope-pricing-calculator/lib/unit-cost-entries'

interface Props {
  config: ScopePricingConfig
  trades: PricingTrade[]
}

export function UnitCostsList({ config, trades }: Props) {
  return (
    <section aria-label="Unit Costs" className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">Unit Costs</h3>
      {trades.length === 0 && <p className="text-sm text-muted-foreground">Add a scope to see its Unit Costs.</p>}
      {trades.map(trade => (
        <div className="flex flex-col gap-1" key={trade}>
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{TRADE_LABELS[trade]}</h4>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
            {unitCostEntries(config, trade).map(entry => (
              <Fragment key={entry.key}>
                <dt>{entry.label}</dt>
                <dd className="text-right tabular-nums">{formatUnitCost(entry.value)}</dd>
              </Fragment>
            ))}
          </dl>
        </div>
      ))}
    </section>
  )
}
```

`SP/ui/components/agent-panel/index.tsx`. The sheet overlays the page and closes on an outside tap. `data-agent-only` is the hook for the Task 10 leak check:

```tsx
'use client'

import type { ScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/schemas/config'
import type { QuoteResult, SolveMultiplierResult } from '@/features/calculators/scope-pricing-calculator/types'

import { SlidersHorizontalIcon } from 'lucide-react'

import { tradesInQuote } from '@/features/calculators/scope-pricing-calculator/lib/trades-in-quote'
import { AgentReadouts } from '@/features/calculators/scope-pricing-calculator/ui/components/agent-panel/agent-readouts'
import { MultiplierControl } from '@/features/calculators/scope-pricing-calculator/ui/components/agent-panel/multiplier-control'
import { TargetPriceControl } from '@/features/calculators/scope-pricing-calculator/ui/components/agent-panel/target-price-control'
import { UnitCostsList } from '@/features/calculators/scope-pricing-calculator/ui/components/agent-panel/unit-costs-list'
import { Button } from '@/shared/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/components/ui/sheet'

interface Props {
  config: ScopePricingConfig
  quote: QuoteResult
  solved: SolveMultiplierResult | null
}

export function AgentPanel({ config, quote, solved }: Props) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button aria-label="Open agent tools" className="size-11 shrink-0 text-muted-foreground" size="icon" type="button" variant="ghost">
          <SlidersHorizontalIcon />
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto" data-agent-only side="right">
        <SheetHeader>
          <SheetTitle>Agent tools</SheetTitle>
          <SheetDescription>Only you see this panel.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-6">
          <AgentReadouts quote={quote} />
          <MultiplierControl appliedMultiplier={quote.multiplier} config={config} targetActive={solved != null && solved.status !== 'no-cost'} />
          <TargetPriceControl floor={config.multiplier.floor} solved={solved} />
          <UnitCostsList config={config} trades={tradesInQuote(quote)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 6: Mount it**

In `SP/ui/views/scope-pricing-calculator.tsx`:
- import `AgentPanel` from `@/features/calculators/scope-pricing-calculator/ui/components/agent-panel`;
- change `const { quote } = useScopePricingQuote(...)` to `const { quote, solved } = useScopePricingQuote(...)`;
- render it next to the context fields:

```tsx
        <div className="flex items-end gap-3">
          <ProjectContextFields />
          <AgentPanel config={config} quote={quote} solved={solved} />
        </div>
```

- [ ] **Step 7: Gates and smoke**

Run: `pnpm exec eslint --fix src/features/calculators scripts/verify-scope-pricing.ts && pnpm tsc && pnpm lint && pnpm tsx scripts/verify-scope-pricing.ts`
Expected: no errors, then `✅`.

Smoke:
1. With the Task 6 quote on screen, open the panel. It shows Cost, Margin, Multiplier 2.80x (healthy colour), Tax and Base.
2. Step the multiplier down to the floor; the minus button disables at 2.00x.
3. Type 1.5; the field shows the floor error and the price stays at the floor.
4. Enter a target of $150,000; the multiplier field locks and shows the solved value. Clear it.
5. Enter a target under the floor price; the "Out of reach" copy shows the floor price.
6. Tap outside; the panel closes and the layout doesn't shift.

- [ ] **Step 8: Commit**

```bash
git add src/features/calculators/scope-pricing-calculator scripts/verify-scope-pricing.ts
git commit -m "feat(calculators): agent panel — readouts, multiplier, target price, Unit Costs

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Remodel ROI Calculator UI

This covers SP-O1–O4, O8, UI4, UI6 and I7's label. The layout is a plain baseline that Task 9 restyles.

**Files:**
- Create: `SV/lib/format-years.ts`, `SV/hooks/use-remodel-roi.ts`
- Create: `SV/ui/components/{step-section,projection-number-field,liability-row,home-and-loans-step,bills-step,project-step,assumptions-step,savings-headline,comparison-card,total-paid-chart}.tsx`
- Replace: `SV/ui/views/remodel-roi-calculator.tsx`
- Modify: `scripts/verify-remodel-roi.ts` (`formatYears` check)

**Interfaces:**
- Consumes: `projectRemodelRoi`, `resolveRemodelRoiConfig`, `createRemodelRoiDefaults`, `EMPTY_LIABILITY`, `remodelRoiFormSchema`, the savings types, `BILL_CATEGORIES` / `BILL_CATEGORY_LABELS`, `RATE_KEYS` / `RATE_LABELS` and `UPLIFT_MODES` / `UPLIFT_MODE_LABELS` (Task 4).
- Produces: `useRemodelRoi(control, config): RemodelRoiProjection` and `formatYears(n): string`.
- **Homeowner copy:** never the word "Cost". The chart is "Total paid over time", with the series "Without the project" and "With the project".

- [ ] **Step 1: Write the failing test**

Add `import { formatYears } from '@/features/calculators/remodel-roi-calculator/lib/format-years'` to `scripts/verify-remodel-roi.ts`. Then insert before the final `console.log`:

```ts
assert.equal(formatYears(1), '1 year', 'singular')
assert.equal(formatYears(5), '5 years', 'plural')
```

Run: `pnpm tsx scripts/verify-remodel-roi.ts`
Expected: FAIL with module not found.

- [ ] **Step 2: Helper and hook**

`SV/lib/format-years.ts`:

```ts
export function formatYears(years: number): string {
  return years === 1 ? '1 year' : `${years} years`
}
```

Run: `pnpm tsx scripts/verify-remodel-roi.ts`. Expected: `✅`.

`SV/hooks/use-remodel-roi.ts`:

```ts
import type { Control } from 'react-hook-form'
import type { RemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/schemas/config'
import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { useMemo } from 'react'
import { useWatch } from 'react-hook-form'

import { projectRemodelRoi } from '@/features/calculators/remodel-roi-calculator/lib/project-remodel-roi'

export function useRemodelRoi(control: Control<RemodelRoiFormValues>, config: RemodelRoiConfig): RemodelRoiProjection {
  const [homeValue, liabilities, billsNow, billsAfter, project, assumptions] = useWatch({
    control,
    name: ['homeValue', 'liabilities', 'billsNow', 'billsAfter', 'project', 'assumptions'],
  })

  return useMemo(
    () => projectRemodelRoi({ homeValue, liabilities, billsNow, billsAfter, project, assumptions }, config),
    [homeValue, liabilities, billsNow, billsAfter, project, assumptions, config],
  )
}
```

- [ ] **Step 3: Input components**

`SV/ui/components/step-section.tsx`:

```tsx
interface Props {
  step: number
  title: string
  children: React.ReactNode
}

export function StepSection({ step, title, children }: Props) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-xl border p-4">
      <h3 className="text-sm font-medium">
        <span className="mr-2 text-muted-foreground tabular-nums">{step}</span>
        {title}
      </h3>
      {children}
    </section>
  )
}
```

`SV/ui/components/projection-number-field.tsx`:

```tsx
'use client'

import type { FieldPathByValue } from 'react-hook-form'
import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'

import { useFormContext } from 'react-hook-form'

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { NumberField } from '@/shared/components/ui/number-field'

interface Props {
  name: FieldPathByValue<RemodelRoiFormValues, number | null>
  label: string
  suffix?: string
  min?: number
  max?: number
  step?: number
}

export function ProjectionNumberField({ name, label, suffix, min = 0, max, step }: Props) {
  const { control } = useFormContext<RemodelRoiFormValues>()

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{suffix ? `${label} (${suffix})` : label}</FormLabel>
          <FormControl>
            <NumberField {...field} className="h-11" inputMode="decimal" max={max} min={min} step={step} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
```

`SV/ui/components/liability-row.tsx`:

```tsx
'use client'

import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'

import { Trash2Icon } from 'lucide-react'
import { useFormContext } from 'react-hook-form'

import { ProjectionNumberField } from '@/features/calculators/remodel-roi-calculator/ui/components/projection-number-field'
import { Button } from '@/shared/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'

interface Props {
  index: number
  heldFlat: boolean
  onRemove: () => void
}

export function LiabilityRow({ index, heldFlat, onRemove }: Props) {
  const { control } = useFormContext<RemodelRoiFormValues>()

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
      <div className="flex items-end gap-2">
        <FormField
          control={control}
          name={`liabilities.${index}.label`}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Loan</FormLabel>
              <FormControl>
                <Input className="h-11" maxLength={60} placeholder="e.g. Car loan" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <Button aria-label="Remove loan" className="size-11" onClick={onRemove} size="icon" type="button" variant="ghost">
          <Trash2Icon />
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <ProjectionNumberField label="Balance" name={`liabilities.${index}.balance`} />
        <ProjectionNumberField label="Payment" name={`liabilities.${index}.monthlyPayment`} suffix="/mo" />
        <ProjectionNumberField label="APR, if known" max={40} name={`liabilities.${index}.aprPercent`} step={0.01} suffix="%/yr" />
      </div>
      {heldFlat && <p className="text-xs text-muted-foreground">Held at today&apos;s balance in the projection.</p>}
    </div>
  )
}
```

`SV/ui/components/home-and-loans-step.tsx`:

```tsx
'use client'

import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'

import { PlusIcon } from 'lucide-react'
import { useFieldArray, useFormContext } from 'react-hook-form'

import { EMPTY_LIABILITY } from '@/features/calculators/remodel-roi-calculator/constants/form-defaults'
import { LiabilityRow } from '@/features/calculators/remodel-roi-calculator/ui/components/liability-row'
import { ProjectionNumberField } from '@/features/calculators/remodel-roi-calculator/ui/components/projection-number-field'
import { StepSection } from '@/features/calculators/remodel-roi-calculator/ui/components/step-section'
import { Button } from '@/shared/components/ui/button'

interface Props {
  heldFlatLiabilities: number[]
}

export function HomeAndLoansStep({ heldFlatLiabilities }: Props) {
  const { control } = useFormContext<RemodelRoiFormValues>()
  const liabilities = useFieldArray({ control, name: 'liabilities' })

  return (
    <StepSection step={1} title="Home & loans">
      <ProjectionNumberField label="Home value today" name="homeValue" />
      {liabilities.fields.map((field, index) => (
        <LiabilityRow heldFlat={heldFlatLiabilities.includes(index)} index={index} key={field.id} onRemove={() => liabilities.remove(index)} />
      ))}
      <Button className="h-11 self-start" onClick={() => liabilities.append({ ...EMPTY_LIABILITY })} type="button" variant="outline">
        <PlusIcon />
        Add a loan
      </Button>
    </StepSection>
  )
}
```

`SV/ui/components/bills-step.tsx`:

```tsx
'use client'

import { BILL_CATEGORIES, BILL_CATEGORY_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import { ProjectionNumberField } from '@/features/calculators/remodel-roi-calculator/ui/components/projection-number-field'
import { StepSection } from '@/features/calculators/remodel-roi-calculator/ui/components/step-section'

interface Props {
  group: 'billsNow' | 'billsAfter'
  step: number
  title: string
}

export function BillsStep({ group, step, title }: Props) {
  return (
    <StepSection step={step} title={title}>
      <div className="grid gap-3 sm:grid-cols-2">
        {BILL_CATEGORIES.map(category => (
          <ProjectionNumberField key={category} label={BILL_CATEGORY_LABELS[category]} name={`${group}.${category}`} suffix="/mo" />
        ))}
      </div>
    </StepSection>
  )
}
```

`SV/ui/components/project-step.tsx`:

```tsx
'use client'

import type { UpliftMode } from '@/features/calculators/remodel-roi-calculator/constants/uplift-modes'
import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'

import { useFormContext, useWatch } from 'react-hook-form'

import { UPLIFT_MODE_LABELS, UPLIFT_MODES } from '@/features/calculators/remodel-roi-calculator/constants/uplift-modes'
import { ProjectionNumberField } from '@/features/calculators/remodel-roi-calculator/ui/components/projection-number-field'
import { StepSection } from '@/features/calculators/remodel-roi-calculator/ui/components/step-section'
import { FormControl, FormField, FormItem, FormLabel } from '@/shared/components/ui/form'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'

export function ProjectStep() {
  const { control } = useFormContext<RemodelRoiFormValues>()
  const upliftMode = useWatch({ control, name: 'project.uplift.mode' })

  return (
    <StepSection step={4} title="The project">
      <div className="grid gap-3 sm:grid-cols-3">
        <ProjectionNumberField label="Project price" name="project.price" />
        <ProjectionNumberField label="Incentives" name="project.incentives" />
        <ProjectionNumberField label="Down payment" name="project.downPayment" />
        <ProjectionNumberField label="Loan APR" max={40} name="project.aprPercent" step={0.01} suffix="%/yr" />
        <ProjectionNumberField label="Loan term (0 = cash)" max={480} name="project.termMonths" step={1} suffix="months" />
      </div>
      <div className="flex items-end gap-3">
        <FormField
          control={control}
          name="project.uplift.mode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Home value added</FormLabel>
              <FormControl>
                <ToggleGroup
                  onValueChange={(value) => {
                    if (value) {
                      field.onChange(value as UpliftMode)
                    }
                  }}
                  type="single"
                  value={field.value}
                  variant="outline"
                >
                  {UPLIFT_MODES.map(mode => (
                    <ToggleGroupItem className="h-11 px-3" key={mode} value={mode}>{UPLIFT_MODE_LABELS[mode]}</ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex-1">
          <ProjectionNumberField
            label={upliftMode === 'amount' ? 'Amount' : 'Percent of project price'}
            name="project.uplift.value"
            suffix={upliftMode === 'amount' ? undefined : '%'}
          />
        </div>
      </div>
    </StepSection>
  )
}
```

`SV/ui/components/assumptions-step.tsx`:

```tsx
'use client'

import { RATE_KEYS, RATE_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/rates'
import { ProjectionNumberField } from '@/features/calculators/remodel-roi-calculator/ui/components/projection-number-field'
import { StepSection } from '@/features/calculators/remodel-roi-calculator/ui/components/step-section'

export function AssumptionsStep() {
  return (
    <StepSection step={5} title="Assumptions">
      <ProjectionNumberField label="Years to project" max={30} min={1} name="assumptions.horizonYears" step={1} />
      <div className="grid gap-3 sm:grid-cols-2">
        {RATE_KEYS.map(key => (
          <ProjectionNumberField
            key={key}
            label={RATE_LABELS[key]}
            max={50}
            min={-20}
            name={`assumptions.ratesPercent.${key}`}
            step={0.1}
            suffix="%/yr"
          />
        ))}
      </div>
    </StepSection>
  )
}
```

- [ ] **Step 4: Result components**

`SV/ui/components/savings-headline.tsx`:

```tsx
import type { ProjectionSummary } from '@/features/calculators/remodel-roi-calculator/types'

import { formatYears } from '@/features/calculators/remodel-roi-calculator/lib/format-years'
import { formatAsDollars } from '@/shared/lib/formatters'

interface Props {
  summary: ProjectionSummary
}

export function SavingsHeadline({ summary }: Props) {
  const span = formatYears(summary.horizonYears)
  const saves = summary.cumulativeSavings >= 0

  return (
    <section aria-label="Savings" className="flex flex-col gap-1 rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{saves ? `Savings over ${span}` : `Extra spent over ${span}`}</p>
      <p className="text-4xl font-semibold tabular-nums">{formatAsDollars(Math.abs(summary.cumulativeSavings))}</p>
      <p className="text-sm">
        {summary.breakEvenYear == null
          ? `Does not come out ahead within ${span}`
          : `Comes out ahead in year ${summary.breakEvenYear}`}
      </p>
      <p className="text-xs text-muted-foreground">
        {`Counting home value and what is left on the loan, after ${span} you are ${formatAsDollars(Math.abs(summary.netBenefit))} ${summary.netBenefit >= 0 ? 'ahead' : 'behind'}.`}
      </p>
    </section>
  )
}
```

`SV/ui/components/comparison-card.tsx`:

```tsx
import { Card } from '@/shared/components/ui/card'
import { formatAsDollars } from '@/shared/lib/formatters'

interface Props {
  title: string
  moneyLabel: string
  money: number
  homeValue: number
  netWorth: number
}

export function ComparisonCard({ title, moneyLabel, money, homeValue, netWorth }: Props) {
  return (
    <Card className="gap-2 p-4">
      <h4 className="text-sm font-medium">{title}</h4>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{moneyLabel}</dt>
        <dd className="text-right tabular-nums">{formatAsDollars(money)}</dd>
        <dt className="text-muted-foreground">Home value</dt>
        <dd className="text-right tabular-nums">{formatAsDollars(homeValue)}</dd>
        <dt className="text-muted-foreground">Net worth</dt>
        <dd className="text-right tabular-nums">{formatAsDollars(netWorth)}</dd>
      </dl>
    </Card>
  )
}
```

`SV/ui/components/total-paid-chart.tsx`:

```tsx
'use client'

import type { ProjectionYear } from '@/features/calculators/remodel-roi-calculator/types'

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatAsDollars } from '@/shared/lib/formatters'

interface Props {
  years: ProjectionYear[]
}

export function TotalPaidChart({ years }: Props) {
  return (
    <section aria-label="Total paid over time" className="flex flex-col gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total paid over time</h3>
      <div className="h-56 w-full">
        <ResponsiveContainer height="100%" width="100%">
          <LineChart data={years} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis className="text-xs" dataKey="t" stroke="var(--muted-foreground)" tickFormatter={t => `Yr ${t}`} />
            <YAxis className="text-xs" stroke="var(--muted-foreground)" tickFormatter={value => formatAsDollars(Number(value))} width={88} />
            <Tooltip formatter={value => formatAsDollars(Number(value))} labelFormatter={t => `Year ${t}`} />
            <Legend iconType="line" wrapperStyle={{ fontSize: 12 }} />
            <Line activeDot={{ r: 4 }} dataKey="cumulativeCostBefore" dot={false} name="Without the project" stroke="var(--muted-foreground)" strokeWidth={2} type="monotone" />
            <Line activeDot={{ r: 4 }} dataKey="cumulativeCostAfter" dot={false} name="With the project" stroke="var(--chart-1)" strokeWidth={2} type="monotone" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: The view**

Replace `SV/ui/views/remodel-roi-calculator.tsx`:

```tsx
'use client'

import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { createRemodelRoiDefaults } from '@/features/calculators/remodel-roi-calculator/constants/form-defaults'
import { useRemodelRoi } from '@/features/calculators/remodel-roi-calculator/hooks/use-remodel-roi'
import { formatYears } from '@/features/calculators/remodel-roi-calculator/lib/format-years'
import { resolveRemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/lib/resolve-config'
import { remodelRoiFormSchema } from '@/features/calculators/remodel-roi-calculator/schemas/form'
import { AssumptionsStep } from '@/features/calculators/remodel-roi-calculator/ui/components/assumptions-step'
import { BillsStep } from '@/features/calculators/remodel-roi-calculator/ui/components/bills-step'
import { ComparisonCard } from '@/features/calculators/remodel-roi-calculator/ui/components/comparison-card'
import { HomeAndLoansStep } from '@/features/calculators/remodel-roi-calculator/ui/components/home-and-loans-step'
import { ProjectStep } from '@/features/calculators/remodel-roi-calculator/ui/components/project-step'
import { SavingsHeadline } from '@/features/calculators/remodel-roi-calculator/ui/components/savings-headline'
import { TotalPaidChart } from '@/features/calculators/remodel-roi-calculator/ui/components/total-paid-chart'
import { Form } from '@/shared/components/ui/form'

export function RemodelRoiCalculator() {
  const [config] = useState(resolveRemodelRoiConfig)
  const form = useForm<RemodelRoiFormValues>({
    resolver: zodResolver(remodelRoiFormSchema),
    mode: 'onChange',
    defaultValues: createRemodelRoiDefaults(config),
  })
  const { years, summary } = useRemodelRoi(form.control, config)
  const today = years[0]
  const later = years[years.length - 1]
  const inYears = `In ${formatYears(summary.horizonYears)}`

  return (
    <Form {...form}>
      <form className="grid gap-6 pb-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" noValidate onSubmit={event => event.preventDefault()}>
        <div className="flex flex-col gap-6 lg:order-2">
          <SavingsHeadline summary={summary} />
          <div className="grid gap-3 sm:grid-cols-2">
            <ComparisonCard homeValue={today.homeValueBefore} money={summary.monthlyBefore} moneyLabel="Monthly bills and payments" netWorth={today.netWorthBefore} title="Today, without the project" />
            <ComparisonCard homeValue={today.homeValueAfter} money={summary.monthlyAfter} moneyLabel="Monthly bills and payments" netWorth={today.netWorthAfter} title="Today, with the project" />
            <ComparisonCard homeValue={later.homeValueBefore} money={later.cumulativeCostBefore} moneyLabel="Total paid by then" netWorth={later.netWorthBefore} title={`${inYears}, without the project`} />
            <ComparisonCard homeValue={later.homeValueAfter} money={later.cumulativeCostAfter} moneyLabel="Total paid by then" netWorth={later.netWorthAfter} title={`${inYears}, with the project`} />
          </div>
          <TotalPaidChart years={years} />
        </div>
        <div className="flex flex-col gap-6 lg:order-1">
          <HomeAndLoansStep heldFlatLiabilities={summary.heldFlatLiabilities} />
          <BillsStep group="billsNow" step={2} title="Monthly bills today" />
          <BillsStep group="billsAfter" step={3} title="Monthly bills after the project" />
          <ProjectStep />
          <AssumptionsStep />
        </div>
      </form>
    </Form>
  )
}
```

- [ ] **Step 6: Gates and smoke**

Run: `pnpm exec eslint --fix src/features/calculators scripts/verify-remodel-roi.ts && pnpm tsc && pnpm lint && pnpm tsx scripts/verify-remodel-roi.ts`
Expected: no errors, then `✅`.

Smoke on the Remodel ROI Calculator tab:
1. Enter a home value of $800,000, electric $400/mo now and $80/mo after, and a project price of $30,000 at 8% APR for 120 months.
2. The headline, the four cards and the chart update live, and the break-even year shows.
3. Clear a rate field; the projection keeps working on the default rate.
4. Add a loan without an APR; it shows "Held at today's balance in the projection."

- [ ] **Step 7: Commit**

```bash
git add src/features/calculators/remodel-roi-calculator scripts/verify-remodel-roi.ts
git commit -m "feat(calculators): Remodel ROI Calculator screen

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Visual direction (owner pause)

**Files:** these are decided by the pick. Only `ui/components/**` and `ui/views/**` under `src/features/calculators/` may change. No engine, hook, schema or constant values change.

- [ ] **Step 1: Warm up.** Invoke `/ui-warmup src/features/calculators tablet`. It publishes at least 3 working layout options for both calculators on one private page. Brief it with the spec §7 focal points:
  - Scope Pricing: "Your price" plus "includes tax", and the agent panel stays a closed side sheet.
  - Remodel ROI Calculator: cumulative savings plus the break-even year.
  - The context: a rep in the living room, on a tablet turned toward the homeowner.
- [ ] **Step 2: STOP.** Send the owner the artifact link and wait for their pick. Record it in the tracker's C0 row, e.g. "Direction: option B (owner 2026-09-xx)".
- [ ] **Step 3: Apply the pick.** Apply the handoff brief to the components. After each calculator, re-run the Task 6/7/8 smokes.
- [ ] **Step 4: Gates.** Run `pnpm exec eslint --fix src/features/calculators && pnpm tsc && pnpm lint`, then both verify scripts.
- [ ] **Step 5: Commit.**

```bash
git add src/features/calculators
git commit -m "feat(calculators): apply the chosen visual direction

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Audit and the homeowner-leak check (V6, M3)

**Files:** fixes land only under `src/features/calculators/**/ui/**`.

- [ ] **Step 1: Three-skill audit.** Run `ui-ux-pro-max`, then `web-design-guidelines`, then `impeccable` against both calculator screens at tablet width, in that order. Fix the findings that fall inside the calculators' UI.
- [ ] **Step 2: Authenticate Playwright.** Navigate to `http://localhost:<port>/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET from .env.local>&role=agent&redirect=/dashboard/calculators`.
- [ ] **Step 3: Leak check on both tabs.** On `?tab=scope-pricing`:
  1. Run the check below with `browser_evaluate`.
  2. Add "Roof Tear-off" and "Install Panels" (with values), then run it again.
  3. Switch to `?tab=remodel-roi` and run it again.

  The check:

```js
() => {
  const main = document.querySelector('main')
  const text = main ? main.innerText : ''
  return {
    words: text.match(/\b(Cost|Multiplier|Margin)\b/g),
    unitCostLabels: text.match(/per BSQ|Dollar per|Unit Cost/g),
    agentOnlyNodes: document.querySelectorAll('[data-agent-only]').length,
  }
}
```

  Expected every time: `words: null`, `unitCostLabels: null`, `agentOnlyNodes: 0`.
- [ ] **Step 4: Panel check.** Open the agent panel with the icon button. Expected: `document.querySelectorAll('[data-agent-only]').length === 1`, and its text contains "Cost" and "Multiplier". Close it with an outside click; the count returns to 0.
- [ ] **Step 5: Tab persistence (Review Focus 1).** With the tear-off line filled in, switch to Remodel ROI Calculator, type a home value, and switch back. The tear-off line and its price are still there. Switch again; the home value is still there.
- [ ] **Step 6: Gates.** Run `pnpm tsc && pnpm lint`, then both verify scripts.
- [ ] **Step 7: Commit.** If the audit changed files:

```bash
git add src/features/calculators
git commit -m "fix(calculators): UI audit findings

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 8: Owner smoke (M4).** Ask the owner to price a roof tear-off + solar + windows quote on a tablet, including one multiplier adjustment, and report the time (target under 2 minutes).

---

### Task 11: Glossary, tracker and memory

**Files:**
- Modify: `docs/ubiquitous-language.md` (the Sales & Pricing table, and the Variable row in Construction Hierarchy)
- Modify: `docs/plans/2026-09-26-sales-calculators-epic.md`
- Modify: `/home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory/project-sales-calculators-port.md`

- [ ] **Step 1: Glossary rows.** Add these to the `## Sales & Pricing` table after the **Multiplier** row, matching the table's format:

```markdown
| **Scope Pricing** | The per-scope sales calculator at `/dashboard/calculators`: a quote of Formula lines and manual lines, priced as `Price = round(Cost × Multiplier)`, tax inside the Price. Homeowner-facing; Cost and Multiplier live only in its agent panel. Code: `src/features/calculators/scope-pricing-calculator/`. | Roof tear-off + solar quote |
| **Remodel ROI Calculator** | The sales calculator that estimates the return on the money a homeowner puts into a remodel: utility savings that grow as rates rise, home appreciation and loan paydown, shown as bills, loans, home value and net worth before and after the project over N years. Every assumption is on screen. Never called a "snapshot" (reserved term). Code: `src/features/calculators/remodel-roi-calculator/`. | "Comes out ahead in year 5" |
| **Formula** | Per-scope code that turns Variables (and project context) into a **Cost**. Declares the Variables it reads; that declaration drives both its form fields and its argument type. | `tearOff`, `rnrAttic` |
| **Unit Cost** | A named Cost constant a Formula multiplies by, e.g. $/BSQ or $/W. Admin-configured (System defaults in code until an admin screen exists). Agent-only on screen. | Tear-Off (Shingles) per BSQ = $480 |
| **Pricing Key** | The key a Formula is registered under. Today it is the old remodel-x scope accessor; it becomes the Notion scope slug once scopes store one. | `replaceSplitSystem` |
| **Configuration tiers** | Where a calculator value is set: **On-screen** (rep edits live, homeowner sees), **Agent-only** (rep edits/reads in the agent panel), **Admin-configured** (super-admin sets occasionally), **System default** (code). Resolve System default → Admin-configured → the session's On-screen / Agent-only value. | Multiplier floor = Admin-configured |
```

Change the **Variable** row's definition to: `Configurable field that affects SOW content, and the measured input a Scope Pricing Formula reads. Types: text, select, number, boolean.`

- [ ] **Step 2: Tracker.**
  - Update the status line: "C0 built (plan `docs/superpowers/plans/2026-09-26-sales-calculators-c0-port.md`)".
  - Mark the C0 phase row `[x]`, with the direction the owner picked.
  - Tick every O*, SP*, PR*, UI*, V1–V6 and CF1–CF5 box that the build and checks satisfied. Leave M4 until the owner reports the timing.
  - **I-row audit (M6).** `grep -rn` the why-comments under `src/features/calculators` and `src/shared/lib/loan-calculations.ts`, and confirm each of I1–I10 has a code site. Record the file for each I-row in a new "Site" column of §5.
  - Add a one-line note under §0 recording the sequencing change (UI built, then `/ui-warmup`, then the pick) and why.
- [ ] **Step 3: Memory.** In the memory file, replace the "State" paragraph with the built state (the commit range, the owner's pick, and that M4 is pending), and keep the rest.
- [ ] **Step 4: Commit.**

```bash
git add docs/ubiquitous-language.md docs/plans/2026-09-26-sales-calculators-epic.md
git commit -m "docs(calculators): glossary terms and C0 tracker close-out

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Spec coverage

| Spec § | Task |
|---|---|
| §2 names | 5 (tab labels), 6–8 (copy), 11 (glossary) |
| §3 layout and rules | all; the Global Constraints section |
| §4.1 `ScopePricingConfig` and MPU, trade keys, labels | 2 |
| §4.2 `RemodelRoiConfig` | 4 |
| §5.1 Variables and project context | 2 |
| §5.2 Formulas and registry | 2 |
| §5.3 pricing math, permits, floor, target | 3 |
| §5.4 quote API and incomplete lines | 2, 3 |
| §6.1–6.2 Savings math and output | 4 |
| §6.3 `remainingBalance` | 1 |
| §7.1 Scope Pricing UI | 6 |
| §7.2 agent panel | 7 |
| §7.3 Remodel ROI Calculator UI | 8 |
| §7.4 both calculators (RHF, `type="button"`, `NumberField`, 44 px, tablet-first) | 6–8, 10 |
| §8 V1–V4 | 1–4 (plus the gates in every task) |
| §8 V6 and M4 | 10 |
| §9 build order | Tasks 1–11 (sequencing note above) |
| §11 interim markers | I1: 3, 4 · I2: 2 · I3: 2, 4 · I4: 4 · I5: 3 · I6: 2 · I7: 4 · I8: 5 · I9: 2 · I10: 2 · audit: 11 |
