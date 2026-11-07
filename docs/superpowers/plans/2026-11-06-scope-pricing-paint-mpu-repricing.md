# Scope Pricing: paint + MPU repricing, per-scope multipliers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reprice exterior paint (three size bands from home sq ft, garage yes/no, +$1,000 cost per extra storey, custom above 3,000 sq ft) and MPU ($4,500 / $5,500), and give the engine three multiplier layers (agent line override → job-wide shift → scope default → 2.8, floor binds all) so paint sells at 3.5× and MPU at 2.5× without touching Cost.

**Architecture:** Config gains `multiplier.byScope` and three paint edges; the pure engine (`priceQuote`, `solveMultiplier`) resolves a multiplier per line and the target solver solves for the one job-wide shift; a formula may return `null` (custom band) and the rep then prices the line uncosted. The agent panel gets a per-line multiplier list; the homeowner card gets a price field only for custom lines. Goldens stay in the existing `scripts/verify-scope-pricing.ts`.

**Tech Stack:** TypeScript, zod v4, react-hook-form, shadcn `Form` / `NumberField` / `MoneyField`, `node:assert/strict` via `npx tsx`.

**Spec:** `docs/superpowers/specs/2026-11-06-scope-pricing-paint-mpu-repricing-design.md` (owner-approved 2026-11-06). Read it first; this plan argues from it.

## Global Constraints

- `price = round(cost × multiplier)`; `base = round(price / 1.075)`, `tax = price − base`. Unchanged.
- `multiplier.floor` 2.0 binds every layer: scope defaults, the job-wide value, line overrides.
- Paint costs (cost → price at 3.5): CoolLife 6,560 → 22,960 · 7,140 → 24,990 · 7,720 → 27,020; water 4,430 → 15,505 · 4,990 → 17,465 · 5,570 → 19,495. Garage cost 485. Storey cost 1,000 per storey above the first. Band edges inclusive of the lower band: 1,350 small, 1,800 average, 3,000 large, > 3,000 custom.
- MPU costs 4,500 / 5,500; scope default 2.5 → 11,250 / 13,750.
- `multiplier.byScope` initially `{ installExteriorPaint: 3.5, mpu: 2.5 }`; `default` 2.8.
- Homeowner-facing render shows no Cost, multiplier or margin; everything multiplier-related lives inside `<SheetContent data-agent-only>`.
- Goldens: only `scripts/verify-scope-pricing.ts` changes; no new test files, no `package.json` change. Run: `npx tsx scripts/verify-scope-pricing.ts`.
- House rules: comments say why, never what, no plan/spec citations in code; one component per file; named exports; `pnpm lint && pnpm tsc` only (never `pnpm build`); no dev server started by an agent; stage and commit by explicit path (`git commit -m "…" -- <paths>`), never `git add -A`, never `--amend`; the pre-commit hook takes ~110 s, so commits run with a 300 s timeout. Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Seeds under `src/shared/db/seeds/data/` keep their `garageSqFt`; they are the SOW catalog, not the calculator.

## Review Focus

Inputs the spec implies but did not name; each has its pinning test in the task that owns the code.

1. A line override typed below the floor (e.g. 1.5): the engine prices at the floor and the form field shows the floor message — Task 1 golden "line override below the floor is clamped".
2. Changing the job-wide control while a target price is active: today the control is disabled under a target; per-line overrides stay editable and the solver treats them as fixed — Task 1 golden "pinned line stays fixed", Task 3 does not disable the line list under a target.
3. The paint line at exactly 0 sq ft (the variable's `min`) and at 20,000 (its `max`): 0 prices in the small band, 20,000 is custom and never throws — Task 2 sweep assertion.
4. A custom paint line whose price the rep clears again: it drops back to incomplete `reason: 'custom'` and out of the total — Task 2 golden "custom line unpriced again".
5. A custom paint line with a storey count or garage set: those add-ons must not leak into the rep's typed price (uncosted lines carry no cost) — Task 2 golden "custom line is uncosted".

---

### Task 1: Multiplier layers in config, form and engine (MPU repriced)

**Files:**
- Modify: `src/features/calculators/scope-pricing-calculator/schemas/config.ts:63-65`
- Modify: `src/features/calculators/scope-pricing-calculator/constants/config-defaults.ts:28,40`
- Modify: `src/features/calculators/scope-pricing-calculator/schemas/form.ts:16-39`
- Modify: `src/features/calculators/scope-pricing-calculator/lib/create-quote-line.ts:8-26`
- Modify: `src/features/calculators/scope-pricing-calculator/types/index.ts:74-129`
- Create: `src/features/calculators/scope-pricing-calculator/lib/resolve-line-multiplier.ts`
- Modify: `src/features/calculators/scope-pricing-calculator/lib/price-quote.ts`
- Modify: `src/features/calculators/scope-pricing-calculator/lib/solve-multiplier.ts`
- Test: `scripts/verify-scope-pricing.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `ScopePricingConfig['multiplier']` = `{ default: number, floor: number, byScope: Partial<Record<PricingKey, number>> }`.
  - `FormulaLineValues` gains `multiplier: number | null` and `price: number | null`.
  - `QuoteLineInput` (formula) gains `multiplier?: number | null`, `price?: number | null`.
  - `PricedLine.multiplier: number | null`; `IncompleteLine.reason?: 'custom'` (declared here, produced by Task 2).
  - `scopeDefaultMultiplier(config: ScopePricingConfig, pricingKey: PricingKey | null): number`
  - `resolveLineMultiplier(config: ScopePricingConfig, jobMultiplier: number, pricingKey: PricingKey | null, lineOverride: number | null | undefined): number`
  - `priceQuote` and `solveMultiplier` keep their signatures; `QuoteResult.multiplier` is the job-wide control value, `SolveMultiplierResult.multiplier` is the job-wide value that hits the target.

- [ ] **Step 1: Add the failing goldens to `scripts/verify-scope-pricing.ts`**

Replace the two MPU config asserts (lines 29–30) and the two MPU `golden` rows (92–93) and the `unitCostEntries` expectation (224–227):

```ts
assert.equal(config.unitCosts.electricals.mpuBase, 4500, 'MPU base')
assert.equal(config.unitCosts.electricals.mpuWithRelocation, 5500, 'MPU with relocation')
assert.deepEqual(config.multiplier.byScope, { installExteriorPaint: 3.5, mpu: 2.5 }, 'scope defaults')
assert.equal(scopePricingConfigSchema.safeParse({ ...config, multiplier: { ...config.multiplier, byScope: { mpu: 1.5 } } }).success, false, 'scope default below floor is rejected')
// golden rows
['mpu', { relocationRequired: false }, oneStory, 4500],
['mpu', { relocationRequired: true }, oneStory, 5500],
// unitCostEntries
{ key: 'mpuBase', label: 'Main panel upgrade', value: 4500 },
{ key: 'mpuWithRelocation', label: 'Main panel upgrade (with relocation)', value: 5500 },
```

Add a new section after `// ── Quote pricing` asserts and before `// ── Target price` (the attic/tear-off helpers above it stay as they are; attic and roof have no `byScope` entry, so every existing golden there still holds):

```ts
// ── Multiplier layers ──────────────────────────────────────────────────────
const mpuLine = (id: string, multiplier: number | null = null): QuoteLineInput => ({ id, kind: 'formula', pricingKey: 'mpu', variables: { relocationRequired: false }, multiplier })
const roofLine = tearOffLine('roof') // cost 13,375 at twoStory
const mpuQuote = priceQuote({ lines: [mpuLine('m1'), mpuLine('m2', null)], context: oneStory, config })
const mpuPriced = mpuQuote.lines[0]
assert.ok(mpuPriced?.status === 'priced', 'MPU priced')
assert.deepEqual({ cost: mpuPriced.cost, price: mpuPriced.price, multiplier: mpuPriced.multiplier }, { cost: 4500, price: 11250, multiplier: 2.5 }, 'MPU sells at its scope default 2.5')
assert.equal(priceQuote({ lines: [{ ...mpuLine('m'), variables: { relocationRequired: true } }], context: oneStory, config }).totalPrice, 13750, 'MPU with relocation at 2.5')
assert.equal(mpuQuote.multiplier, 2.8, 'the job-wide value rests at the default even when every line has its own scope default')

const shifted = priceQuote({ lines: [mpuLine('m'), roofLine], context: twoStory, config, overrides: { multiplier: 2.85 } })
assert.deepEqual(shifted.lines.map(line => line.status === 'priced' && line.price), [11475, 38119], 'job-wide 2.85 shifts MPU to 2.55 and roof to 2.85')
assert.ok(shifted.lines[0]?.status === 'priced' && Math.abs((shifted.lines[0].multiplier ?? 0) - 2.55) < 1e-9, 'shifted MPU multiplier is 2.55')
assert.equal(shifted.multiplier, 2.85, 'QuoteResult.multiplier is the control value, not the shift')

const pinned = priceQuote({ lines: [mpuLine('m', 3), roofLine], context: twoStory, config, overrides: { multiplier: 2.85 } })
assert.deepEqual(pinned.lines.map(line => line.status === 'priced' && line.price), [13500, 38119], 'a line override is absolute and ignores the shift')
assert.equal(priceQuote({ lines: [mpuLine('m', 1.5)], context: oneStory, config }).totalPrice, 9000, 'line override below the floor is clamped')
assert.equal(priceQuote({ lines: [mpuLine('m')], context: oneStory, config, overrides: { multiplier: 2.6 } }).totalPrice, 10350, 'the control shifts a scope default down too (2.5 − 0.2 = 2.3)')
assert.equal(priceQuote({ lines: [mpuLine('m')], context: oneStory, config, overrides: { multiplier: 2 } }).totalPrice, 9000, 'job-wide at the floor would put MPU at 1.7; the floor clamps it to 2.0')
assert.equal(priceQuote({ lines: [mpuLine('m')], context: oneStory, config: { ...config, multiplier: { ...config.multiplier, byScope: { mpu: 2 } } }, overrides: { multiplier: 2.5 } }).totalPrice, 9000, 'a scope default at the floor shifted down prices at the floor')
assert.ok(mixed.lines[1]?.status === 'priced' && mixed.lines[1].multiplier === null, 'manual lines carry no multiplier')
const permitShifted = priceQuote({ lines: [roofLine], context: twoStory, config: withPermit, overrides: { multiplier: 2.85 } }).lines.find(line => line.kind === 'permit')
assert.equal(permitShifted?.status === 'priced' && permitShifted.price, 713, 'permit lines use default + shift (250 × 2.85)')
```

`pnpm tsc` type-checks this script, so the `compute` widening in Step 5 needs two more edits here: `costOf` returns `number | null` (`const cost = formula.compute(…); return cost == null ? null : Math.round(cost)`), the `golden` tuple type becomes `[PricingKey, VariableInputs, ProjectContext, number | null][]`, and the sweep asserts `cost != null && Number.isFinite(cost) && cost >= 0`. The paint goldens themselves stay as they are until Task 2 (the formula is unchanged in this task).

Replace the `// ── Target price` section's first assertion block with the shift-solver cases (keep the existing `reached`, `withManual`, `tooLow`, `1000` and `no-cost` asserts; they still hold because attic has no scope default):

```ts
const spread: PriceQuoteInput = { lines: [mpuLine('m'), roofLine], context: twoStory, config }
const resting = priceQuote(spread)
const keepTotal = solveMultiplier(resting.totalPrice, spread)
assert.ok(keepTotal.status === 'reached' && Math.abs(keepTotal.multiplier - 2.8) < 1e-9, 'target = current total solves to the resting 2.8')
assert.equal(keepTotal.status === 'reached' && keepTotal.achievedTotal, resting.totalPrice, 'and no line moves')
const higher = solveMultiplier(resting.totalPrice + 17875, spread) // Σ cost = 17,875, so +1.00 on every line
assert.ok(higher.status === 'reached' && Math.abs(higher.multiplier - 3.8) < 1e-9, 'a higher target shifts every line equally')
const pinnedSolve = solveMultiplier(13500 + 40125, { ...spread, lines: [mpuLine('m', 3), roofLine] }) // MPU pinned at 3 → 13,500; roof must reach 40,125 = 13,375 × 3
assert.ok(pinnedSolve.status === 'reached' && Math.abs(pinnedSolve.multiplier - 3) < 1e-9, 'a pinned line stays fixed and the shift reaches the target through the others')
assert.deepEqual(solveMultiplier(50000, { ...spread, lines: [mpuLine('m', 3), { ...roofLine, multiplier: 3 }] }), { status: 'no-cost' }, 'every costed line pinned → nothing to solve')
const underScopeFloor = solveMultiplier(9000 + 13375 * 2.3, spread) // needs −0.5: roof 2.3 is fine, MPU would be 2.0 — exactly at the floor is reached
assert.equal(underScopeFloor.status, 'reached', 'landing exactly on the floor is reached')
assert.equal(solveMultiplier(8000 + 13375 * 2.3, spread).status, 'below-floor', 'a shift that would push one scope under the floor is below-floor')
```

- [ ] **Step 2: Run the script to see it fail**

Run: `npx tsx scripts/verify-scope-pricing.ts`
Expected: FAIL at `MPU base` (`3200 !== 4500`).

- [ ] **Step 3: Config schema and defaults**

In `schemas/config.ts` replace the `multiplier` object with one whose shape is `{ default: positive, floor: positive, byScope: z.partialRecord(z.enum(PRICING_KEYS), z.number().positive()) }` and whose refine checks `default >= floor` **and** every `byScope` value `>= floor` (message: `'No multiplier default can be below the floor'`). Import `PRICING_KEYS` from `constants/pricing-keys`. In `config-defaults.ts` set `electricals: { mpuBase: 4500, mpuWithRelocation: 5500 }` and `multiplier: { default: 2.8, floor: 2, byScope: { installExteriorPaint: 3.5, mpu: 2.5 } }`.

- [ ] **Step 4: Form schema and line factories**

In `schemas/form.ts` move `formulaLineSchema` inside `createScopePricingFormSchema(multiplierFloor)` and add `multiplier: z.number().min(multiplierFloor, { message: \`The multiplier can't go below ${multiplierFloor}\` }).nullable()` and `price: z.number().min(0).nullable()` to it. In `create-quote-line.ts`, `createFormulaLine` returns `{ id, kind: 'formula', pricingKey, variables, multiplier: null, price: null }`; `duplicateLine` already spreads the line, so both fields copy.

- [ ] **Step 5: Types**

In `types/index.ts`: formula `QuoteLineInput` gains `multiplier?: number | null, price?: number | null`; `PricedLine` gains `multiplier: number | null`; `IncompleteLine` gains `reason?: 'custom'`; `ComputeFn`'s return type becomes `number | null`. (`FormulaConfig` is untouched here; Task 2 changes the tier names.)

- [ ] **Step 6: `lib/resolve-line-multiplier.ts`**

Create with two exports: `scopeDefaultMultiplier(config, pricingKey)` returns `config.multiplier.byScope[pricingKey] ?? config.multiplier.default` (a `null` key, used by permit lines, returns the default); `resolveLineMultiplier(config, jobMultiplier, pricingKey, lineOverride)` returns `Math.max(floor, finite lineOverride ?? scopeDefaultMultiplier + (jobMultiplier − default))`. The comment on the shift says why it is additive: the job-wide control preserves the spread between scopes.

- [ ] **Step 7: Engine**

In `price-quote.ts`: keep `resolveMultiplier` as the job-wide value (finite override or default, clamped to the floor) and pass it to `summarize` as today. Each formula line prices at `resolveLineMultiplier(config, jobMultiplier, line.pricingKey, line.multiplier)` and records it in `multiplier`; manual lines record `multiplier: null`; permit lines use `resolveLineMultiplier(config, jobMultiplier, null, null)`. Handle `compute` returning `null` now so `tsc` passes: `line.price` finite and `>= 0` → `priced` with `cost: null`, `multiplier: null`, `splitPrice(null, Math.round(line.price), …)`; otherwise `incomplete` with `needs: []`, `reason: 'custom'`. Only costed lines add to `pricedTrades`.

- [ ] **Step 8: Solver**

Rewrite `solve-multiplier.ts` to solve for the job-wide value:

```ts
export function solveMultiplier(targetTotal: number, input: PriceQuoteInput): SolveMultiplierResult {
  const { default: defaultMultiplier, floor } = input.config.multiplier
  // Priced at the resting value the shift is zero, so each unpinned costed line sits at its own scope default.
  const resting = priceQuote({ ...input, overrides: { multiplier: defaultMultiplier } })
  const pinnedIds = new Set(input.lines.flatMap(line => (line.kind === 'formula' && line.multiplier != null ? [line.id] : [])))
  let solvableCost = 0
  let solvableDefaultPrice = 0 // Σ cost_i × default_i
  let fixedPrice = 0
  let lowestDefault = Number.POSITIVE_INFINITY
  for (const line of resting.lines) {
    if (line.status !== 'priced' || line.cost == null || line.multiplier == null) continue
    if (pinnedIds.has(line.id)) { fixedPrice += line.price; continue }
    solvableCost += line.cost
    solvableDefaultPrice += line.cost * line.multiplier
    lowestDefault = Math.min(lowestDefault, line.multiplier)
  }
  if (solvableCost <= 0) return { status: 'no-cost' }
  const target = Number.isFinite(targetTotal) ? targetTotal : 0
  const exact = defaultMultiplier + (target - resting.uncostedPrice - fixedPrice - solvableDefaultPrice) / solvableCost
  const multiplier = Math.max(floor, exact)
  const reached = exact >= floor && lowestDefault + (exact - defaultMultiplier) >= floor - 1e-9
  const achievedTotal = priceQuote({ ...input, overrides: { multiplier } }).totalPrice
  return { status: reached ? 'reached' : 'below-floor', multiplier, achievedTotal }
}
```

- [ ] **Step 9: Run the script and the type-check**

Run: `npx tsx scripts/verify-scope-pricing.ts && pnpm tsc`
Expected: `✅ verify-scope-pricing passed`, tsc clean. (`pnpm tsc` also compiles the UI, which does not yet read the new fields; that is fine.)

- [ ] **Step 10: Commit**

```bash
git commit -m "feat(calculators): per-scope multiplier defaults, line overrides and a job-wide shift; MPU 4,500 / 5,500 at 2.5

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- scripts/verify-scope-pricing.ts src/features/calculators/scope-pricing-calculator/schemas/config.ts src/features/calculators/scope-pricing-calculator/schemas/form.ts src/features/calculators/scope-pricing-calculator/constants/config-defaults.ts src/features/calculators/scope-pricing-calculator/lib/create-quote-line.ts src/features/calculators/scope-pricing-calculator/lib/resolve-line-multiplier.ts src/features/calculators/scope-pricing-calculator/lib/price-quote.ts src/features/calculators/scope-pricing-calculator/lib/solve-multiplier.ts src/features/calculators/scope-pricing-calculator/types/index.ts
```

---

### Task 2: Exterior paint bands, garage, storeys and the custom band

**Files:**
- Modify: `src/features/calculators/scope-pricing-calculator/schemas/config.ts:50-61`
- Modify: `src/features/calculators/scope-pricing-calculator/constants/config-defaults.ts:29-38`
- Modify: `src/features/calculators/scope-pricing-calculator/constants/unit-cost-labels.ts:48-55`
- Modify: `src/features/calculators/scope-pricing-calculator/constants/variables.ts:18-20`
- Modify: `src/features/calculators/scope-pricing-calculator/lib/formulas/exterior-paint-siding.ts`
- Create: `src/features/calculators/scope-pricing-calculator/lib/describe-custom-line.ts`
- Test: `scripts/verify-scope-pricing.ts`

**Interfaces:**
- Consumes: `ComputeFn` returning `number | null`, engine `reason: 'custom'` and `price` handling (Task 1).
- Produces:
  - `ScopePricingConfig['exteriorPaintTiers']` = `{ smallMaxSqFt: number, averageMaxSqFt: number, largeMaxSqFt: number }`.
  - `UnitCostsOf<'exteriorPaintSiding'>` gains `garage` and `dollarPerAdditionalStory`.
  - `VARIABLES.garageIncluded` (boolean); `garageSqFt` is gone.
  - `describeCustomLine(config: FormulaConfig): string` → `"Over 3,000 sq ft, enter a price"` at the defaults.

- [ ] **Step 1: Replace the paint goldens in `scripts/verify-scope-pricing.ts`**

Config section: replace the inverted-tiers assert (line 38) with
```ts
assert.deepEqual(config.exteriorPaintTiers, { smallMaxSqFt: 1350, averageMaxSqFt: 1800, largeMaxSqFt: 3000 }, 'paint bands')
assert.equal(scopePricingConfigSchema.safeParse({ ...config, exteriorPaintTiers: { smallMaxSqFt: 1800, averageMaxSqFt: 1350, largeMaxSqFt: 3000 } }).success, false, 'paint bands must ascend')
```

`costOf` and the `golden` tuple already accept `null` (Task 1). Replace the five paint rows with:
```ts
['installExteriorPaint', { paintType: 'coolLife', homeSqFt: 1200, garageIncluded: false }, oneStory, 6560],
['installExteriorPaint', { paintType: 'coolLife', homeSqFt: 1350, garageIncluded: false }, oneStory, 6560], // on the edge → small
['installExteriorPaint', { paintType: 'coolLife', homeSqFt: 1351, garageIncluded: false }, oneStory, 7140],
['installExteriorPaint', { paintType: 'coolLife', homeSqFt: 1800, garageIncluded: false }, oneStory, 7140], // on the edge → average
['installExteriorPaint', { paintType: 'coolLife', homeSqFt: 3000, garageIncluded: false }, oneStory, 7720], // on the edge → large
['installExteriorPaint', { paintType: 'coolLife', homeSqFt: 3001, garageIncluded: false }, oneStory, null], // custom
['installExteriorPaint', { paintType: 'water', homeSqFt: 0, garageIncluded: false }, oneStory, 4430],
['installExteriorPaint', { paintType: 'water', homeSqFt: 1500, garageIncluded: false }, oneStory, 4990],
['installExteriorPaint', { paintType: 'water', homeSqFt: 2500, garageIncluded: false }, oneStory, 5570],
['installExteriorPaint', { paintType: 'coolLife', homeSqFt: 1200, garageIncluded: true }, oneStory, 7045], // + garage 485
['installExteriorPaint', { paintType: 'coolLife', homeSqFt: 1200, garageIncluded: false }, twoStory, 7560], // + 1,000 per storey above the first
['installExteriorPaint', { paintType: 'coolLife', homeSqFt: 1200, garageIncluded: true }, { numStories: 3, currentRoofType: 'shingle' }, 9045],
```
Incomplete section: `needsOf('installExteriorPaint', { homeSqFt: 1200, garageIncluded: false })` → `['paintType']`.

Sweep: replace the finite assert with
```ts
const custom = key === 'installExteriorPaint' && typeof inputs.homeSqFt === 'number' && inputs.homeSqFt > config.exteriorPaintTiers.largeMaxSqFt
if (custom) assert.equal(cost, null, `${key} ${JSON.stringify(inputs)} above the large band is custom`)
else assert.ok(cost != null && Number.isFinite(cost) && cost >= 0, `${key} ${JSON.stringify(inputs)} gave ${cost}`)
```

Quote pricing section, append after the multiplier-layers block:
```ts
// ── Paint prices and the custom band ───────────────────────────────────────
const paintLine = (homeSqFt: number, paintType: 'coolLife' | 'water' = 'coolLife', extra: Partial<Extract<QuoteLineInput, { kind: 'formula' }>> = {}): QuoteLineInput =>
  ({ id: `p-${paintType}-${homeSqFt}`, kind: 'formula', pricingKey: 'installExteriorPaint', variables: { paintType, homeSqFt, garageIncluded: false }, ...extra })
const paintPrices = priceQuote({ lines: [paintLine(1000), paintLine(1500), paintLine(2500), paintLine(1000, 'water'), paintLine(1500, 'water'), paintLine(2500, 'water')], context: oneStory, config })
assert.deepEqual(paintPrices.lines.map(line => line.status === 'priced' && line.price), [22960, 24990, 27020, 15505, 17465, 19495], 'paint ladder at the scope default 3.5')
assert.equal(priceQuote({ lines: [{ ...paintLine(1000), variables: { paintType: 'coolLife', homeSqFt: 1000, garageIncluded: true } }], context: oneStory, config }).totalPrice, 24658, 'garage adds 485 × 3.5 = 1,698 on the price')
assert.equal(priceQuote({ lines: [paintLine(1000)], context: twoStory, config }).totalPrice, 26460, 'a second storey adds 1,000 × 3.5 = 3,500')

const customUnpriced = priceQuote({ lines: [paintLine(3001)], context: twoStory, config })
assert.deepEqual(customUnpriced.lines[0], { id: 'p-coolLife-3001', kind: 'formula', status: 'incomplete', label: 'Install exterior paint', trade: 'exteriorPaintSiding', needs: [], reason: 'custom' }, 'above 3,000 sq ft is custom until priced')
assert.equal(customUnpriced.totalPrice, 0, 'an unpriced custom line is left out of the total')
const customPriced = priceQuote({ lines: [paintLine(3001, 'coolLife', { price: 31000 }), mpuLine('m')], context: twoStory, config, overrides: { multiplier: 3 } })
const customLine = customPriced.lines[0]
assert.ok(customLine?.status === 'priced', 'custom line priced once the rep enters a price')
assert.deepEqual({ cost: customLine.cost, price: customLine.price, multiplier: customLine.multiplier }, { cost: null, price: 31000, multiplier: null }, 'custom line is uncosted: no cost, no multiplier, storeys and the job-wide shift leave the typed price alone')
assert.equal(customPriced.hasUncostedLines, true, 'custom lines flag as uncosted')
assert.equal(customPriced.margin, 12150 - 4500, 'custom line left out of margin')
assert.equal(priceQuote({ lines: [paintLine(3001, 'coolLife', { price: null })], context: oneStory, config }).lines[0]?.status, 'incomplete', 'custom line unpriced again')
assert.equal(solveMultiplier(40000, { lines: [paintLine(3001, 'coolLife', { price: 31000 }), mpuLine('m')], context: oneStory, config }).status, 'reached', 'the custom price is subtracted before solving, like a manual line')
assert.equal(describeCustomLine(config), 'Over 3,000 sq ft, enter a price', 'custom line copy names the band edge')
```
Add `import { describeCustomLine } from '@/features/calculators/scope-pricing-calculator/lib/describe-custom-line'` with the other lib imports.

- [ ] **Step 2: Run the script to see it fail**

Run: `npx tsx scripts/verify-scope-pricing.ts`
Expected: FAIL at module load — `Cannot find module '…/lib/describe-custom-line'` (tsx resolves imports before any assert runs).

- [ ] **Step 3: Config, labels, variables**

`schemas/config.ts`: `exteriorPaintSiding` adds `garage: unitCost, dollarPerAdditionalStory: unitCost`; `exteriorPaintTiers` becomes `z.object({ smallMaxSqFt, averageMaxSqFt, largeMaxSqFt })` (each `z.number().positive()`) with a refine `small < average && average < large` (message `'Paint bands must ascend: small, average, large'`). `config-defaults.ts`: paint costs 6560 / 7140 / 7720 and 4430 / 4990 / 5570, `garage: 485`, `dollarPerAdditionalStory: 1000`; `exteriorPaintTiers: { smallMaxSqFt: 1350, averageMaxSqFt: 1800, largeMaxSqFt: 3000 }`. `unit-cost-labels.ts`: `garage: 'Garage (add-on)'`, `dollarPerAdditionalStory: 'Dollar per Additional Story'`. `variables.ts`: delete `garageSqFt`; add `garageIncluded: { trade: 'exteriorPaintSiding', label: 'Garage included?', kind: 'boolean', unit: null, default: false }`.

- [ ] **Step 4: The paint formula**

`exterior-paint-siding.ts`: `variables: ['paintType', 'homeSqFt', 'garageIncluded']`; `compute({ paintType, homeSqFt, garageIncluded }, context, costs, config)` returns `null` when `homeSqFt > largeMaxSqFt`, else `bandCost + (garageIncluded ? costs.garage : 0) + (context.numStories - 1) * costs.dollarPerAdditionalStory`, where `bandCost` is the small / average / large cost for the paint type with `<=` comparisons against `smallMaxSqFt` and `averageMaxSqFt`.

- [ ] **Step 5: `lib/describe-custom-line.ts`**

`export function describeCustomLine(config: FormulaConfig): string` returning `` `Over ${config.exteriorPaintTiers.largeMaxSqFt.toLocaleString('en-US')} sq ft, enter a price` ``. Its one comment says why the copy is paint's: exterior paint is the only Formula that returns `null`; a second one moves the hint onto the Formula.

- [ ] **Step 6: Run the script, type-check, lint**

Run: `npx tsx scripts/verify-scope-pricing.ts && pnpm tsc && pnpm lint`
Expected: `✅ verify-scope-pricing passed`; `swept N Formula inputs` with N ≠ 1280 (the paint combos changed from 3×3×3 to 2×3×2); tsc and lint clean. If `grep -rn garageSqFt src/features scripts` prints anything, fix it.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(calculators): exterior paint priced by home sq ft band, garage add-on, +1,000 per storey; custom above 3,000 sq ft

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- scripts/verify-scope-pricing.ts src/features/calculators/scope-pricing-calculator/schemas/config.ts src/features/calculators/scope-pricing-calculator/constants/config-defaults.ts src/features/calculators/scope-pricing-calculator/constants/unit-cost-labels.ts src/features/calculators/scope-pricing-calculator/constants/variables.ts src/features/calculators/scope-pricing-calculator/lib/formulas/exterior-paint-siding.ts src/features/calculators/scope-pricing-calculator/lib/describe-custom-line.ts
```

---

### Task 3: Agent panel — shift description and the per-line multiplier list

**Files:**
- Create: `src/features/calculators/scope-pricing-calculator/lib/describe-multiplier-defaults.ts`
- Create: `src/features/calculators/scope-pricing-calculator/ui/components/agent-panel/line-multipliers-list.tsx`
- Modify: `src/features/calculators/scope-pricing-calculator/ui/components/agent-panel/multiplier-control.tsx:16-24,70-74`
- Modify: `src/features/calculators/scope-pricing-calculator/ui/components/agent-panel/index.tsx`
- Test: `scripts/verify-scope-pricing.ts` (the pure helper only)

**Interfaces:**
- Consumes: `scopeDefaultMultiplier`, `resolveLineMultiplier` (Task 1); `FormulaLineValues.multiplier` (Task 1); `PricedLine.multiplier` (Task 1); `MULTIPLIER_STEP`; `formatMultiplier`, `formatAsDollars`.
- Produces:
  - `describeMultiplierDefaults(config: ScopePricingConfig, pricingKeys: readonly PricingKey[], jobMultiplier: number): string`
  - `LineMultipliersList({ config, quote, lines }: { config: ScopePricingConfig, quote: QuoteResult, lines: ScopePricingFormValues['lines'] })` — `AgentPanel` watches `lines` once and passes them down; the list uses `useFormContext` only for `control`.
  - `MultiplierControl` gains prop `pricingKeys: readonly PricingKey[]`.

- [ ] **Step 1: Add the helper's goldens to the `// ── Agent panel helpers` section**

```ts
assert.equal(describeMultiplierDefaults(config, [], 2.8), 'Floor 2.00x · default 2.80x', 'no scopes: floor and default only')
assert.equal(describeMultiplierDefaults(config, ['installExteriorPaint', 'mpu', 'rnrAttic', 'mpu'], 2.8), 'Floor 2.00x · default 2.80x · Install exterior paint 3.50x · Main panel upgrade 2.50x', 'lists each scope default present once; scopes on the default are not repeated')
assert.equal(describeMultiplierDefaults(config, ['mpu'], 2.85), 'Floor 2.00x · default 2.80x · Main panel upgrade 2.50x · +0.05x on every line', 'a shift is named')
assert.equal(describeMultiplierDefaults(config, ['mpu'], 2.7), 'Floor 2.00x · default 2.80x · Main panel upgrade 2.50x · −0.10x on every line', 'a negative shift uses a real minus sign')
```
Import `describeMultiplierDefaults` from its lib path.

- [ ] **Step 2: Run the script to see it fail**

Run: `npx tsx scripts/verify-scope-pricing.ts`
Expected: FAIL — cannot find module `describe-multiplier-defaults`.

- [ ] **Step 3: `lib/describe-multiplier-defaults.ts`**

Build the parts: `Floor ${formatMultiplier(floor)}`, `default ${formatMultiplier(default)}`, then for each unique key in order of first appearance whose `byScope` entry exists: `${FORMULAS[key].label} ${formatMultiplier(byScope[key])}`, then when `Math.abs(jobMultiplier − default) >= 0.005`: `${sign}${Math.abs(delta).toFixed(2)}x on every line` with `sign` `'+'` or `'−'` (U+2212). Join with `' · '`.

- [ ] **Step 4: Run the script to see it pass**

Run: `npx tsx scripts/verify-scope-pricing.ts`
Expected: `✅ verify-scope-pricing passed`.

- [ ] **Step 5: `MultiplierControl` description**

Add prop `pricingKeys: readonly PricingKey[]`. The non-target description becomes `describeMultiplierDefaults(config, pricingKeys, appliedMultiplier)`; the target description stays `Set by the target price: ${formatMultiplier(appliedMultiplier)}`. The label, buttons, `stepMultiplier` calls, `min={floor}`, placeholder and "Back to the default" link are unchanged (the control rests at 2.8 and steps from its own value; the shift is what the engine derives).

- [ ] **Step 6: `agent-panel/line-multipliers-list.tsx`**

`'use client'`. `const { control } = useFormContext<ScopePricingFormValues>()`; `lines` arrive as a prop. Rows: for each `(line, index)` where `line.kind === 'formula'` and the matching `quote.lines.find(result => result.id === line.id)` is `priced` with `cost != null` (manual and custom lines are skipped). Each row, inside `<section aria-label="Line multipliers">` with `<h3 className="text-sm font-medium">Line multipliers</h3>` and a `<ul className="flex flex-col gap-3">`:

```tsx
<li className="flex flex-col gap-1" key={line.id}>
  <div className="flex items-baseline justify-between gap-3 text-sm">
    <span className="min-w-0 truncate">{FORMULAS[line.pricingKey].label}</span>
    <span className="shrink-0 tabular-nums text-muted-foreground">{formatAsDollars(result.cost)} → {formatAsDollars(result.price)}</span>
  </div>
  <FormField control={control} name={`lines.${index}.multiplier`} render={({ field }) => (
    <FormItem>
      <div className="flex items-center gap-2">
        <FormControl>
          <NumberField {...field} aria-label={`Multiplier for ${label}`} className="h-11 w-28 text-center" inputMode="decimal" min={floor} placeholder={placeholder.toFixed(2)} step={MULTIPLIER_STEP} value={field.value} />
        </FormControl>
        {field.value != null && <Button className="min-h-11 px-0" onClick={() => field.onChange(null)} type="button" variant="link">Back to default</Button>}
      </div>
      <FormMessage />
    </FormItem>
  )} />
</li>
```
`placeholder = resolveLineMultiplier(config, quote.multiplier, line.pricingKey, null)` (the multiplier that applies without an override). When no row qualifies render `<p className="text-sm text-muted-foreground">Costed lines show here with their own multiplier.</p>`. The list is **not** disabled under a target: the solver treats a pinned line as fixed and re-solves. The placeholder is two decimals without the `x` suffix (it sits inside a number input).

- [ ] **Step 7: `agent-panel/index.tsx`**

`const { control } = useFormContext<ScopePricingFormValues>()` and `const lines = useWatch({ control, name: 'lines' })` (quote lines carry no pricing key, so the form is the source). `pricingKeys = lines.flatMap(line => line.kind === 'formula' ? [line.pricingKey] : [])`. Pass `lines` to `LineMultipliersList`. Order inside the sheet: `AgentReadouts` · `MultiplierControl` (with `pricingKeys`) · `TargetPriceControl` · `LineMultipliersList` · `UnitCostsList`.

- [ ] **Step 8: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 9: Visual check, only if a dev server is already up**

Run: `ss -ltnp | grep -E ':3000|:3001'`. If a port answers, drive it with a local Playwright script (auth: `/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET from .env.local>&redirect=/dashboard/calculators`), open the Scope Pricing tab, add "Install exterior paint" and "Main panel upgrade", open the agent panel, screenshot at 1180 and 820 wide, and confirm: description reads `Floor 2.00x · default 2.80x · Install exterior paint 3.50x · Main panel upgrade 2.50x`; two rows in Line multipliers with placeholders `3.50` and `2.50`; typing `3` in MPU's field changes only MPU's price; stepping the job-wide control to 2.85 moves both prices and appends `+0.05x on every line`. If no port answers, **do not start a server**; record "visual check owed to Oliver" in the commit body and the task is still done.

- [ ] **Step 10: Commit**

```bash
git commit -m "feat(calculators): agent panel lists scope defaults, names the shift and overrides the multiplier per line

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- scripts/verify-scope-pricing.ts src/features/calculators/scope-pricing-calculator/lib/describe-multiplier-defaults.ts src/features/calculators/scope-pricing-calculator/ui/components/agent-panel/line-multipliers-list.tsx src/features/calculators/scope-pricing-calculator/ui/components/agent-panel/multiplier-control.tsx src/features/calculators/scope-pricing-calculator/ui/components/agent-panel/index.tsx
```

---

### Task 4: Homeowner-facing card — the custom price field

**Files:**
- Create: `src/features/calculators/scope-pricing-calculator/lib/is-custom-line.ts`
- Modify: `src/features/calculators/scope-pricing-calculator/ui/components/line-price.tsx`
- Modify: `src/features/calculators/scope-pricing-calculator/ui/components/formula-line-card.tsx`
- Modify: `src/features/calculators/scope-pricing-calculator/ui/views/scope-pricing-calculator.tsx:48`
- Test: `scripts/verify-scope-pricing.ts` (the pure helper only)

**Interfaces:**
- Consumes: `IncompleteLine.reason`, `PricedLine.cost` (Task 1), `describeCustomLine` (Task 2), `MoneyField`.
- Produces:
  - `isCustomLine(result: QuoteLineResult | undefined): boolean` — true for a formula line that is `incomplete` with `reason: 'custom'` **or** `priced` with `cost == null` (so the price field stays while the rep edits a priced custom line).
  - `LinePrice` gains optional prop `customHint: string`.
  - `FormulaLineCard` gains prop `config: ScopePricingConfig`.

- [ ] **Step 1: Add the helper's goldens to the `// ── Agent panel helpers` section**

```ts
assert.equal(isCustomLine(customUnpriced.lines[0]), true, 'custom incomplete line')
assert.equal(isCustomLine(customPriced.lines[0]), true, 'custom line stays custom once priced, so its price field stays')
assert.equal(isCustomLine(mixed.lines[1]), false, 'a manual line is not a custom formula line')
assert.equal(isCustomLine(incompleteAttic), false, 'an incomplete formula line with needs is not custom')
assert.equal(isCustomLine(undefined), false, 'no result yet')
```

- [ ] **Step 2: Run the script to see it fail**

Run: `npx tsx scripts/verify-scope-pricing.ts`
Expected: FAIL — cannot find module `is-custom-line`.

- [ ] **Step 3: `lib/is-custom-line.ts`** with the signature above.

- [ ] **Step 4: Run the script to see it pass**

Run: `npx tsx scripts/verify-scope-pricing.ts`
Expected: `✅ verify-scope-pricing passed`.

- [ ] **Step 5: `LinePrice`**

Props `{ result, customHint?: string }`. When `result.status === 'incomplete' && result.reason === 'custom'` render `customHint ?? 'Needs a price'` in the existing pending style; everything else unchanged.

- [ ] **Step 6: `FormulaLineCard`**

Add prop `config: ScopePricingConfig`. `const custom = isCustomLine(result)`. Pass `customHint={describeCustomLine(config)}` to `LinePrice`. Below the variables grid, when `custom`, render the same `FormField` block `ManualLineCard` uses for `lines.${index}.price` (label `Price`, `MoneyField` `className="h-11"` `placeholder="$0"`), inside the same `grid gap-3 sm:grid-cols-2` so it sits beside the variables. Nothing about cost, band or multiplier appears on the card.

- [ ] **Step 7: View**

`scope-pricing-calculator.tsx:48` passes `config={config}` to `FormulaLineCard`.

- [ ] **Step 8: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 9: Visual check, only if a dev server is already up** (same rule as Task 3 Step 9)

Add "Install exterior paint", choose CoolLife, type 3,200 sq ft: the price slot reads `Over 3,000 sq ft, enter a price` and a Price field appears; type 31,000 → the line shows `$31,000`, the field stays; change to 2,500 sq ft → the field disappears and the line shows `$27,020`. Screenshot once at 820 wide. Confirm no Cost, multiplier or margin text outside the sheet.

- [ ] **Step 10: Commit**

```bash
git commit -m "feat(calculators): exterior paint above 3,000 sq ft takes the rep's price on the card

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- scripts/verify-scope-pricing.ts src/features/calculators/scope-pricing-calculator/lib/is-custom-line.ts src/features/calculators/scope-pricing-calculator/ui/components/line-price.tsx src/features/calculators/scope-pricing-calculator/ui/components/formula-line-card.tsx src/features/calculators/scope-pricing-calculator/ui/views/scope-pricing-calculator.tsx
```

---

### Task 5: Tracker ruling R19 and the amended rows

**Files:**
- Modify: `docs/plans/2026-09-26-sales-calculators-epic.md:50,65,137,146,180-185,299-300`

**Interfaces:** none (documentation). The spec and this plan are **not** deleted here: the repo deletes them when the work ships to prod (the local-main queue drains through `/pre-ship`), not when it lands on the workbench.

- [ ] **Step 1: Add R19 after the R18 row (line 65)**

```markdown
| **R19** | **Scope Pricing repricing and per-scope multipliers (owner brainstorm, 2026-11-06).** Supersedes D3's "per-trade defaults wait for C2" and amends PR11. (1) **Cost stays honest; the price is fixed through the multiplier.** `multiplier.byScope` is an Admin-configured value served from code by the one resolver (I3): `installExteriorPaint` 3.5, `mpu` 2.5; every other scope uses the 2.8 default. The floor binds every layer. (2) **Three layers per line:** the agent's line override (absolute) → the agent's job-wide control → the scope default → 2.8. **The job-wide control is a shift:** it rests at 2.8 and moves every unpinned line by `m − 2.8`, so the spread between scopes survives a target price; the target solver solves for that one shift and reports `below-floor` when any unpinned line would clamp. (3) **Exterior paint** prices by home square footage alone: ≤ 1,350 small, ≤ 1,800 average, ≤ 3,000 large (an edge takes the lower band), above 3,000 **custom**: the Formula returns no cost and the rep types the price on the card, carried uncosted like a manual line. Costs: CoolLife 6,560 / 7,140 / 7,720, water 4,430 / 4,990 / 5,570, garage yes/no +485, +1,000 per storey above the first (from `numStories`). At 3.5: ≈ $23,000 / $25,000 / $27,000 and $15,500 / $17,500 / $19,500, garage ≈ +$1,700. `garageSqFt` leaves the calculator's Variables (the SOW seeds keep theirs). (4) **MPU** costs 4,500 / 5,500 → $11,250 / $13,750 at 2.5. (5) Agent panel: the multiplier description lists the scope defaults in the quote and names the shift; a **Line multipliers** list overrides per costed line. The homeowner card shows a price field only for a custom line ("Over 3,000 sq ft, enter a price"). (6) Goldens stay in `scripts/verify-scope-pricing.ts`. Spec: `docs/superpowers/specs/2026-11-06-scope-pricing-paint-mpu-repricing-design.md` (deleted when shipped). | 2026-11-06 |
```

- [ ] **Step 2: Markers on D3 (line 50) and PR2 (line 137), amendment on PR11 (line 146)**

Append to D3's cell: ` **Superseded by R19 (2026-11-06):** per-scope defaults ship now as `multiplier.byScope`.` Append to PR2: ` *MPU figures superseded by R19: 4,500 / 5,500.*` Append to PR11: ` *Amended by R19: the target solves for the job-wide shift; lines with their own override stay fixed.*`

- [ ] **Step 3: §3.6 rows**

Line 180 ("Multiplier override and target price") → `| Job-wide multiplier (a shift on every unpinned line) and target price | **Agent-only** | Bounded below by the multiplier floor; the target solves for the shift (R19) |`. Insert after it: `| Per-line multiplier override | **Agent-only** | Absolute for that line; ignores the shift; never below the floor (R19) |`. Line 183 → `| Default multiplier, **per-scope defaults** and **multiplier floor** | **Admin-configured** | Default 2.8 (D3); paint 3.5 and MPU 2.5 (R19). The floor defaults to 2.0, the existing "danger" boundary |`. Line 185 → `| Exterior-paint size bands (1,350 / 1,800 / 3,000 sqft; custom above) | **Admin-configured** | Pricing tiers, not formula structure (R19) |`.

- [ ] **Step 4: §7 formula rows**

Line 299 → `| Electrical | \`mpu\` | relocationRequired | relocation ? mpuWithRelocation : mpuBase (4,500 / 5,500, R19) |`. Line 300 → `| Exterior paint | \`installExteriorPaint\` | paintType, homeSqFt, garageIncluded | band by home sqft (≤ 1,350 small, ≤ 1,800 average, ≤ 3,000 large, above: custom, no cost) + garage + (stories − 1) × dollarPerAdditionalStory; per paint type (R19) |`.

- [ ] **Step 5: Final verification**

Run: `npx tsx scripts/verify-scope-pricing.ts && pnpm lint && pnpm tsc && git status --short src/features/calculators scripts docs/plans/2026-09-26-sales-calculators-epic.md`
Expected: green, and `git status` shows only the tracker as modified.

- [ ] **Step 6: Commit**

```bash
git commit -m "docs(tracker): R19 scope pricing repricing and per-scope multipliers; D3, PR2, PR11, §3.6, §7 amended

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- docs/plans/2026-09-26-sales-calculators-epic.md
```
