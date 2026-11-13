# Scope Pricing: paint + MPU repricing, per-scope multipliers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reprice exterior paint (three home sizes from home sq ft, garage yes/no, +$1,000 cost per extra story, a custom scope above 3,000 sq ft) and MPU ($4,500 / $5,500), and give the engine three multiplier layers (scope multiplier override → proposal-wide shift → scope default → 2.8, floor binds all) so paint sells at 3.5× and MPU at 2.5× without touching Cost.

**Architecture:** Config gains `multiplier.byScope` and three paint home-size edges; the pure engine (`priceQuote`, `solveMultiplier`) resolves a multiplier per scope line and the target solver solves for the one proposal-wide shift, holding overridden scopes and any scope the floor clamps; a formula may return `null` (custom scope) and the agent then prices the line uncosted. The agent panel gets a `Scope multipliers` list; the homeowner card gets a price field only for a custom scope. Goldens stay in the existing `scripts/verify-scope-pricing.ts`, including a pure row/predicate helper per UI task because no dev server is available to the build.

**Tech Stack:** TypeScript, zod v4, react-hook-form, shadcn `Form` / `NumberField` / `MoneyField`, `node:assert/strict` via `npx tsx`.

**Spec:** `docs/superpowers/specs/2026-11-06-scope-pricing-paint-mpu-repricing-design.md` (owner-approved 2026-11-06, stress-tested and amended the same day). Read it first; this plan argues from it. Vocabulary: `CONTEXT.md` §Scope Pricing terms — *proposal-wide multiplier*, *scope multiplier override*, *custom scope*, *home size*, *agent* (never "rep", "job-wide", "pinned", "band", "tier").

## Global Constraints

- `price = round(cost × multiplier)`; `base = round(price / 1.075)`, `tax = price − base`. Unchanged.
- `multiplier.floor` 2.0 binds every layer: scope defaults, the proposal-wide value, scope overrides. A target under the floor total shows the floor and the floor total (CF4).
- Paint costs (cost → price at 3.5): CoolLife 6,560 → 22,960 · 7,140 → 24,990 · 7,720 → 27,020; water 4,430 → 15,505 · 4,990 → 17,465 · 5,570 → 19,495. Garage cost 485. Story cost 1,000 per story above the first. Home-size edges take the smaller size: 1,350 small, 1,800 average, 3,000 large, > 3,000 custom scope.
- MPU costs 4,500 / 5,500; scope default 2.5 → 11,250 / 13,750.
- `multiplier.byScope` initially `{ installExteriorPaint: 3.5, mpu: 2.5 }`; `default` 2.8.
- Homeowner-facing render shows no Cost, multiplier or margin; everything multiplier-related lives inside `<SheetContent data-agent-only>`.
- Goldens: only `scripts/verify-scope-pricing.ts` changes; no new test files, no `package.json` change. Run: `npx tsx scripts/verify-scope-pricing.ts`.
- Verification before every commit: `npx tsx scripts/verify-scope-pricing.ts && pnpm tsc && pnpm lint && pnpm theme:check` — the pre-commit gate (`.claude/settings.json`, PreToolUse on `git commit`) runs tsc + lint + theme:check and blocks the commit otherwise; never `pnpm build`.
- **No dev server is available to this build**: the only servers on this machine belong to other worktrees (`.worktrees/*`), and no agent starts one. Every UI task records "visual check owed to Oliver" in its commit body; the visual-check steps run only if `ss -ltnp` shows a `next-server` whose `readlink /proc/<pid>/cwd` is this repo root.
- Git: stage and commit by explicit path (`git add -- <new file>` for untracked files, then `git commit -m "…" -- <paths>`), never `git add -A`, never `--amend`, never `git stash`, `git checkout <ref> -- .`, `git restore` outside the task's own files, or `git reset`. A pathspec commit takes the whole working-tree file, so before Task 5's commit `git diff -- docs/plans/2026-09-26-sales-calculators-epic.md` must show only this plan's hunks. After every commit run `git show --stat HEAD`; a wrong commit → stop and report, never amend. The pre-commit hook takes ~110 s, so commits run with a 300 s timeout. Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Files are LF; check `git diff --shortstat` after any scripted edit.
- No DB writes for testing (nothing here touches a DB). No `package.json` edits.
- House rules: comments say why, never what, no plan/spec citations in code; one component per file; named exports; copy uses "agent", "scope", "story".
- Seeds under `src/shared/db/seeds/data/` keep their `garageSqFt`; they are the SOW catalog, not the calculator.

## Review Focus

Inputs the spec implies but did not name; each has its pinning test in the task that owns the code.

1. A scope multiplier override typed below the floor (e.g. 1.5): the engine prices at the floor and the form field shows the floor message — Task 1 golden "an override below the floor is clamped".
2. Editing a scope override while a target price is active: the proposal-wide control stays disabled under a target; the `Scope multipliers` list stays enabled and the solver holds the overridden scope — Task 1 golden "an overridden scope stays put", Task 3 does not disable the list under a target.
3. The paint line at exactly 0 sq ft (the variable's `min`) and at 20,000 (its `max`): 0 prices as a small home, 20,000 is a custom scope and never throws — Task 2 sweep assertion.
4. A custom scope whose price the agent clears again: it drops back to incomplete `reason: 'custom'` and out of the total — Task 2 golden "custom scope unpriced again".
5. A custom scope with a story count or garage set: those adds must not leak into the agent's typed price (uncosted lines carry no cost) — Task 2 golden "custom scope is uncosted".

---

### Task 1: Multiplier layers in config, form and engine (MPU repriced)

**Files:**
- Modify: `src/features/calculators/scope-pricing-calculator/schemas/config.ts:63-65`
- Modify: `src/features/calculators/scope-pricing-calculator/constants/config-defaults.ts:28,40`
- Modify: `src/features/calculators/scope-pricing-calculator/schemas/form.ts:16-39`
- Modify: `src/features/calculators/scope-pricing-calculator/lib/create-quote-line.ts:8-26`
- Modify: `src/features/calculators/scope-pricing-calculator/types/index.ts:57-60,74-129`
- Modify: `src/features/calculators/scope-pricing-calculator/lib/price-quote.ts`
- Modify: `src/features/calculators/scope-pricing-calculator/lib/solve-multiplier.ts`
- Modify: `src/features/calculators/scope-pricing-calculator/lib/describe-target-result.ts`
- Modify: `src/features/calculators/scope-pricing-calculator/hooks/use-scope-pricing-quote.ts:17`
- Modify: `src/features/calculators/scope-pricing-calculator/ui/components/agent-panel/index.tsx:37`
- Test: `scripts/verify-scope-pricing.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `ScopePricingConfig['multiplier']` = `{ default: number, floor: number, byScope: Partial<Record<PricingKey, number>> }`.
  - `FormulaLineValues` gains `multiplierOverride: number | null` and `price: number | null`.
  - `QuoteLineInput` (formula) gains `multiplierOverride?: number | null`, `price?: number | null`.
  - `PricedLine.multiplier: number | null` (the applied multiplier; null for uncosted lines); `IncompleteLine.reason?: 'custom'` (declared here, produced by Task 2).
  - `SolveMultiplierResult` = `{ status: 'reached' | 'below-floor', multiplier: number, achievedTotal: number } | { status: 'no-cost' | 'all-overridden' }`; a target is active iff `'multiplier' in solved`.
  - `priceQuote` and `solveMultiplier` keep their signatures; `QuoteResult.multiplier` is the proposal-wide control value, `SolveMultiplierResult.multiplier` the proposal-wide value that hits the target (or the floor when `below-floor`).
  - No new export: the per-line resolver is a private function of `price-quote.ts`.

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

`pnpm tsc` type-checks this script, so the `compute` widening in Step 5 needs three edits here too: `costOf` returns `number | null` (`const cost = formula.compute(…); return cost == null ? null : Math.round(cost)`), the `golden` tuple type becomes `[PricingKey, VariableInputs, ProjectContext, number | null][]`, and the sweep asserts `cost != null && Number.isFinite(cost) && cost >= 0`. The paint goldens themselves stay as they are until Task 2 (the formula is unchanged in this task).

Add a new section after the `// ── Quote pricing` asserts and before `// ── Target price` (the attic/tear-off helpers above it stay as they are; attic and roof have no `byScope` entry, so every existing golden there still holds):

```ts
// ── Multiplier layers ──────────────────────────────────────────────────────
const mpuLine = (id: string, multiplierOverride: number | null = null): QuoteLineInput => ({ id, kind: 'formula', pricingKey: 'mpu', variables: { relocationRequired: false }, multiplierOverride })
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
```

Add to the `// ── Target price` section, after the existing asserts (keep `reached`, `withManual`, `tooLow`, `1000` and `no-cost`; they still hold: attic has no scope default, and a target under the floor total still reports `{ below-floor, 2, floor total }`):

```ts
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
```

In `// ── Agent panel helpers`, after the two `describeTargetResult` matches:
```ts
assert.match(describeTargetResult({ status: 'all-overridden' }, 2), /own multiplier/, 'all-overridden copy')
```

- [ ] **Step 2: Run the script to see it fail**

Run: `npx tsx scripts/verify-scope-pricing.ts`
Expected: FAIL at `MPU base` (`3200 !== 4500`).

- [ ] **Step 3: Config schema and defaults**

In `schemas/config.ts` replace the `multiplier` object with one whose shape is `{ default: positive, floor: positive, byScope: z.partialRecord(z.enum(PRICING_KEYS), z.number().positive()) }` and whose refine checks `default >= floor` **and** every `byScope` value `>= floor` (message: `'No multiplier default can be below the floor'`). Import `PRICING_KEYS` from `constants/pricing-keys` (it imports nothing, so no cycle). In `config-defaults.ts` set `electricals: { mpuBase: 4500, mpuWithRelocation: 5500 }` and `multiplier: { default: 2.8, floor: 2, byScope: { installExteriorPaint: 3.5, mpu: 2.5 } }`.

- [ ] **Step 4: Form schema and line factories**

In `schemas/form.ts` move `formulaLineSchema` inside `createScopePricingFormSchema(multiplierFloor)` and add `multiplierOverride: z.number().min(multiplierFloor, { message: \`The multiplier can't go below ${multiplierFloor}\` }).nullable()` and `price: z.number().min(0).nullable()` to it. In `create-quote-line.ts`, `createFormulaLine` returns `{ id, kind: 'formula', pricingKey, variables, multiplierOverride: null, price: null }`; `duplicateLine` already spreads the line, so both fields copy.

- [ ] **Step 5: Types**

In `types/index.ts`: formula `QuoteLineInput` gains `multiplierOverride?: number | null, price?: number | null`; `PricedLine` gains `multiplier: number | null`; `IncompleteLine` gains `reason?: 'custom'`; `ComputeFn`'s return type (line 59) becomes `number | null` (the `bivarianceHack` disable stays valid); `SolveMultiplierResult`'s second member becomes `{ status: 'no-cost' | 'all-overridden' }`. (`FormulaConfig` is untouched here; Task 2 renames the home-size field.)

- [ ] **Step 6: Engine**

In `price-quote.ts`: keep `resolveMultiplier` as the proposal-wide value (finite override or default, clamped to the floor) and pass it to `summarize` as today. Add a private `resolveLineMultiplier(config, jobMultiplier, pricingKey, override)` beside it returning `Math.max(floor, finite override ?? (byScope[pricingKey] ?? default) + (jobMultiplier − default))`; its one comment says why the shift is additive (the proposal-wide control preserves the spread between scope defaults). Each formula line prices at `resolveLineMultiplier(config, jobMultiplier, line.pricingKey, line.multiplierOverride)` and records it in `multiplier`; manual lines record `multiplier: null`; permit lines use `Math.max(floor, jobMultiplier)` (no scope default of their own — equal to `default + shift`). Handle `compute` returning `null` now so `tsc` passes: `line.price` finite and `>= 0` → `priced` with `cost: null`, `multiplier: null`, `splitPrice(null, Math.round(line.price), …)`; otherwise `incomplete` with `needs: []` and `reason: 'custom'` — set `reason` only on that branch (the goldens `deepEqual` whole line objects). `pricedTrades` is unchanged: every priced formula line adds its trade.

- [ ] **Step 7: Solver**

Rewrite `solve-multiplier.ts` to solve for the proposal-wide value. The body is lint-clean as written (`antfu/if-newline`, `style/max-statements-per-line` are live); keep every `if` braced on its own lines:

```ts
export function solveMultiplier(targetTotal: number, input: PriceQuoteInput): SolveMultiplierResult {
  const { default: defaultMultiplier, floor } = input.config.multiplier
  // At the resting value the shift is zero, so every open scope sits at its own scope default.
  const resting = priceQuote({ ...input, overrides: { multiplier: defaultMultiplier } })
  const overriddenIds = new Set(input.lines.flatMap(line => (line.kind === 'formula' && line.multiplierOverride != null ? [line.id] : [])))
  let open: { cost: number, scopeDefault: number }[] = []
  let heldPrice = resting.uncostedPrice
  let costedLines = 0
  for (const line of resting.lines) {
    if (line.status !== 'priced' || line.cost == null || line.multiplier == null) {
      continue
    }
    costedLines += 1
    if (overriddenIds.has(line.id)) {
      heldPrice += line.price
      continue
    }
    open.push({ cost: line.cost, scopeDefault: line.multiplier })
  }
  if (costedLines === 0) {
    return { status: 'no-cost' }
  }
  if (open.length === 0) {
    return { status: 'all-overridden' }
  }
  const target = Number.isFinite(targetTotal) ? targetTotal : 0
  const atFloor = (): SolveMultiplierResult => ({ status: 'below-floor', multiplier: floor, achievedTotal: priceQuote({ ...input, overrides: { multiplier: floor } }).totalPrice })
  let shift = 0
  // The engine clamps a scope whose default + shift falls under the floor, so such a scope is held at its
  // floor price and the shift is re-solved over the rest until no scope clamps.
  while (open.length > 0) {
    const openCost = open.reduce((sum, scope) => sum + scope.cost, 0)
    const openPriceAtDefaults = open.reduce((sum, scope) => sum + scope.cost * scope.scopeDefault, 0)
    shift = (target - heldPrice - openPriceAtDefaults) / openCost
    if (defaultMultiplier + shift < floor - 1e-9) {
      return atFloor()
    }
    const clamped = open.filter(scope => scope.scopeDefault + shift < floor - 1e-9)
    if (clamped.length === 0) {
      break
    }
    heldPrice += clamped.reduce((sum, scope) => sum + scope.cost * floor, 0)
    open = open.filter(scope => !clamped.includes(scope))
  }
  if (open.length === 0) {
    return atFloor()
  }
  const multiplier = defaultMultiplier + shift
  // Line prices round to whole dollars, so report what the quote actually adds up to at this multiplier.
  const achievedTotal = priceQuote({ ...input, overrides: { multiplier } }).totalPrice
  return { status: 'reached', multiplier, achievedTotal }
}
```

- [ ] **Step 8: Target copy and the two gates**

`describe-target-result.ts`: add the branch `if (result.status === 'all-overridden') return 'Every costed scope has its own multiplier, so there is nothing left to solve. Clear one to use a target.'` (braced). `use-scope-pricing-quote.ts:17` → `const multiplier = solved != null && 'multiplier' in solved ? solved.multiplier : agent.multiplier`. `agent-panel/index.tsx:37` → `targetActive={solved != null && 'multiplier' in solved}`.

- [ ] **Step 9: Run the script, the type-check, the lint and the theme check**

Run: `npx tsx scripts/verify-scope-pricing.ts && pnpm tsc && pnpm lint && pnpm theme:check`
Expected: `✅ verify-scope-pricing passed`, all three clean. (`pnpm tsc` also compiles the UI, which does not yet read the new fields; that is fine.)

- [ ] **Step 10: Commit**

```bash
git commit -m "feat(calculators): per-scope multiplier defaults, scope overrides and a proposal-wide shift; MPU 4,500 / 5,500 at 2.5

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- scripts/verify-scope-pricing.ts src/features/calculators/scope-pricing-calculator/schemas/config.ts src/features/calculators/scope-pricing-calculator/schemas/form.ts src/features/calculators/scope-pricing-calculator/constants/config-defaults.ts src/features/calculators/scope-pricing-calculator/lib/create-quote-line.ts src/features/calculators/scope-pricing-calculator/lib/price-quote.ts src/features/calculators/scope-pricing-calculator/lib/solve-multiplier.ts src/features/calculators/scope-pricing-calculator/lib/describe-target-result.ts src/features/calculators/scope-pricing-calculator/hooks/use-scope-pricing-quote.ts src/features/calculators/scope-pricing-calculator/ui/components/agent-panel/index.tsx src/features/calculators/scope-pricing-calculator/types/index.ts
git show --stat HEAD
```

---

### Task 2: Exterior paint home sizes, garage, stories and the custom scope

**Files:**
- Modify: `src/features/calculators/scope-pricing-calculator/schemas/config.ts:50-61`
- Modify: `src/features/calculators/scope-pricing-calculator/constants/config-defaults.ts:29-38`
- Modify: `src/features/calculators/scope-pricing-calculator/constants/unit-cost-labels.ts:48-55`
- Modify: `src/features/calculators/scope-pricing-calculator/constants/variables.ts:18-20`
- Modify: `src/features/calculators/scope-pricing-calculator/types/index.ts:52` (`FormulaConfig` picks the renamed field)
- Modify: `src/features/calculators/scope-pricing-calculator/lib/formulas/exterior-paint-siding.ts`
- Create: `src/features/calculators/scope-pricing-calculator/lib/describe-custom-line.ts`
- Test: `scripts/verify-scope-pricing.ts`

**Interfaces:**
- Consumes: `ComputeFn` returning `number | null`, engine `reason: 'custom'` and `price` handling (Task 1).
- Produces:
  - `ScopePricingConfig['exteriorPaintHomeSizes']` = `{ smallMaxSqFt: number, averageMaxSqFt: number, largeMaxSqFt: number }` (replaces `exteriorPaintTiers`).
  - `UnitCostsOf<'exteriorPaintSiding'>` gains `garage` and `additionalStory`.
  - `VARIABLES.garageIncluded` (boolean); `garageSqFt` is gone.
  - `describeCustomLine(config: FormulaConfig): string` → `"Over 3,000 sq ft, enter a price"` at the defaults.

- [ ] **Step 1: Replace the paint goldens in `scripts/verify-scope-pricing.ts`**

Config section: replace the inverted-tiers assert (line 38) with
```ts
assert.deepEqual(config.exteriorPaintHomeSizes, { smallMaxSqFt: 1350, averageMaxSqFt: 1800, largeMaxSqFt: 3000 }, 'paint home sizes')
assert.equal(scopePricingConfigSchema.safeParse({ ...config, exteriorPaintHomeSizes: { smallMaxSqFt: 1800, averageMaxSqFt: 1350, largeMaxSqFt: 3000 } }).success, false, 'home sizes must ascend')
```

`costOf` and the `golden` tuple already accept `null` (Task 1). Replace the five paint rows with:
```ts
['installExteriorPaint', { paintType: 'coolLife', homeSqFt: 1200, garageIncluded: false }, oneStory, 6560],
['installExteriorPaint', { paintType: 'coolLife', homeSqFt: 1350, garageIncluded: false }, oneStory, 6560], // on the edge → small
['installExteriorPaint', { paintType: 'coolLife', homeSqFt: 1351, garageIncluded: false }, oneStory, 7140],
['installExteriorPaint', { paintType: 'coolLife', homeSqFt: 1800, garageIncluded: false }, oneStory, 7140], // on the edge → average
['installExteriorPaint', { paintType: 'coolLife', homeSqFt: 3000, garageIncluded: false }, oneStory, 7720], // on the edge → large
['installExteriorPaint', { paintType: 'coolLife', homeSqFt: 3001, garageIncluded: false }, oneStory, null], // custom scope
['installExteriorPaint', { paintType: 'water', homeSqFt: 0, garageIncluded: false }, oneStory, 4430],
['installExteriorPaint', { paintType: 'water', homeSqFt: 1500, garageIncluded: false }, oneStory, 4990],
['installExteriorPaint', { paintType: 'water', homeSqFt: 2500, garageIncluded: false }, oneStory, 5570],
['installExteriorPaint', { paintType: 'coolLife', homeSqFt: 1200, garageIncluded: true }, oneStory, 7045], // + garage 485
['installExteriorPaint', { paintType: 'coolLife', homeSqFt: 1200, garageIncluded: false }, twoStory, 7560], // + 1,000 per story above the first
['installExteriorPaint', { paintType: 'coolLife', homeSqFt: 1200, garageIncluded: true }, { numStories: 3, currentRoofType: 'shingle' }, 9045],
```
Incomplete section: `needsOf('installExteriorPaint', { homeSqFt: 1200, garageIncluded: false })` → `['paintType']`.

Sweep: replace the finite assert with
```ts
const custom = key === 'installExteriorPaint' && typeof inputs.homeSqFt === 'number' && inputs.homeSqFt > config.exteriorPaintHomeSizes.largeMaxSqFt
if (custom) {
  assert.equal(cost, null, `${key} ${JSON.stringify(inputs)} above the large home is a custom scope`)
}
else {
  assert.ok(cost != null && Number.isFinite(cost) && cost >= 0, `${key} ${JSON.stringify(inputs)} gave ${cost}`)
}
```

Quote pricing section, append after the multiplier-layers block:
```ts
// ── Paint prices and the custom scope ──────────────────────────────────────
const paintLine = (homeSqFt: number, paintType: 'coolLife' | 'water' = 'coolLife', extra: Partial<Extract<QuoteLineInput, { kind: 'formula' }>> = {}): QuoteLineInput =>
  ({ id: `p-${paintType}-${homeSqFt}`, kind: 'formula', pricingKey: 'installExteriorPaint', variables: { paintType, homeSqFt, garageIncluded: false }, ...extra })
const paintPrices = priceQuote({ lines: [paintLine(1000), paintLine(1500), paintLine(2500), paintLine(1000, 'water'), paintLine(1500, 'water'), paintLine(2500, 'water')], context: oneStory, config })
assert.deepEqual(paintPrices.lines.map(line => line.status === 'priced' && line.price), [22960, 24990, 27020, 15505, 17465, 19495], 'paint ladder at the scope default 3.5')
assert.equal(priceQuote({ lines: [{ ...paintLine(1000), variables: { paintType: 'coolLife', homeSqFt: 1000, garageIncluded: true } }], context: oneStory, config }).totalPrice, 24658, 'garage adds 485 × 3.5 = 1,698 on the price')
assert.equal(priceQuote({ lines: [paintLine(1000)], context: twoStory, config }).totalPrice, 26460, 'a second story adds 1,000 × 3.5 = 3,500')

const customUnpriced = priceQuote({ lines: [paintLine(3001)], context: twoStory, config })
assert.deepEqual(customUnpriced.lines[0], { id: 'p-coolLife-3001', kind: 'formula', status: 'incomplete', label: 'Install exterior paint', trade: 'exteriorPaintSiding', needs: [], reason: 'custom' }, 'above 3,000 sq ft is a custom scope until priced')
assert.equal(customUnpriced.totalPrice, 0, 'an unpriced custom scope is left out of the total')
const customPriced = priceQuote({ lines: [paintLine(3001, 'coolLife', { price: 31000 }), mpuLine('m')], context: twoStory, config, overrides: { multiplier: 3 } })
const customLine = customPriced.lines[0]
assert.ok(customLine?.status === 'priced', 'custom scope priced once the agent enters a price')
assert.deepEqual({ cost: customLine.cost, price: customLine.price, multiplier: customLine.multiplier }, { cost: null, price: 31000, multiplier: null }, 'custom scope is uncosted: no cost, no multiplier, stories and the proposal-wide shift leave the typed price alone')
assert.equal(customPriced.hasUncostedLines, true, 'custom scopes flag as uncosted')
assert.equal(customPriced.margin, 12150 - 4500, 'custom scope left out of margin')
assert.equal(priceQuote({ lines: [paintLine(3001, 'coolLife', { price: null })], context: oneStory, config }).lines[0]?.status, 'incomplete', 'custom scope unpriced again')
assert.equal(solveMultiplier(40000, { lines: [paintLine(3001, 'coolLife', { price: 31000 }), mpuLine('m')], context: oneStory, config }).status, 'reached', 'the custom price is held before solving, like a manual line')
assert.equal(describeCustomLine(config), 'Over 3,000 sq ft, enter a price', 'custom scope copy names the size edge')
```
Add `import { describeCustomLine } from '@/features/calculators/scope-pricing-calculator/lib/describe-custom-line'` with the other lib imports.

- [ ] **Step 2: Run the script to see it fail**

Run: `npx tsx scripts/verify-scope-pricing.ts`
Expected: FAIL at module load — `Cannot find module '…/lib/describe-custom-line'` (tsx resolves imports before any assert runs).

- [ ] **Step 3: Config, labels, variables, `FormulaConfig`**

`schemas/config.ts`: `exteriorPaintSiding` adds `garage: unitCost, additionalStory: unitCost`; `exteriorPaintTiers` becomes `exteriorPaintHomeSizes: z.object({ smallMaxSqFt, averageMaxSqFt, largeMaxSqFt })` (each `z.number().positive()`) with a refine `small < average && average < large` (message `'Home sizes must ascend: small, average, large'`). `types/index.ts:52`: `FormulaConfig = Pick<ScopePricingConfig, 'exteriorPaintHomeSizes'>`. `config-defaults.ts`: paint costs 6560 / 7140 / 7720 and 4430 / 4990 / 5570, `garage: 485`, `additionalStory: 1000`; `exteriorPaintHomeSizes: { smallMaxSqFt: 1350, averageMaxSqFt: 1800, largeMaxSqFt: 3000 }`. `unit-cost-labels.ts`: `garage: 'Garage'`, `additionalStory: 'Each additional story'`. `variables.ts`: delete `garageSqFt`; add `garageIncluded: { trade: 'exteriorPaintSiding', label: 'Garage included?', kind: 'boolean', unit: null, default: false }`.

- [ ] **Step 4: The paint formula**

`exterior-paint-siding.ts`: `variables: ['paintType', 'homeSqFt', 'garageIncluded']`; `compute({ paintType, homeSqFt, garageIncluded }, context, costs, config)` returns `null` when `homeSqFt > largeMaxSqFt`, else `sizeCost + (garageIncluded ? costs.garage : 0) + (context.numStories - 1) * costs.additionalStory`, where `sizeCost` is the small / average / large cost for the paint type with `<=` comparisons against `smallMaxSqFt` and `averageMaxSqFt`.

- [ ] **Step 5: `lib/describe-custom-line.ts`**

`export function describeCustomLine(config: FormulaConfig): string` returning `` `Over ${config.exteriorPaintHomeSizes.largeMaxSqFt.toLocaleString('en-US')} sq ft, enter a price` ``. Its one comment says why the copy is paint's: exterior paint is the only Formula that returns `null`; a second one moves the hint onto the Formula.

- [ ] **Step 6: Run the script, type-check, lint, theme check**

Run: `npx tsx scripts/verify-scope-pricing.ts && pnpm tsc && pnpm lint && pnpm theme:check`
Expected: `✅ verify-scope-pricing passed`; `swept 1160 Formula inputs` (the paint combos changed from 2×3×3 to 2×3×2; it was 1280); all clean. `grep -rn "garageSqFt\|exteriorPaintTiers" src/features scripts` prints nothing.

- [ ] **Step 7: Commit**

```bash
git add -- src/features/calculators/scope-pricing-calculator/lib/describe-custom-line.ts
git commit -m "feat(calculators): exterior paint priced by home size, garage, +1,000 per story; custom scope above 3,000 sq ft

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- scripts/verify-scope-pricing.ts src/features/calculators/scope-pricing-calculator/schemas/config.ts src/features/calculators/scope-pricing-calculator/types/index.ts src/features/calculators/scope-pricing-calculator/constants/config-defaults.ts src/features/calculators/scope-pricing-calculator/constants/unit-cost-labels.ts src/features/calculators/scope-pricing-calculator/constants/variables.ts src/features/calculators/scope-pricing-calculator/lib/formulas/exterior-paint-siding.ts src/features/calculators/scope-pricing-calculator/lib/describe-custom-line.ts
git show --stat HEAD
```

---

### Task 3: Agent panel — shift description and the `Scope multipliers` list

**Files:**
- Create: `src/features/calculators/scope-pricing-calculator/lib/describe-multiplier-defaults.ts`
- Create: `src/features/calculators/scope-pricing-calculator/lib/scope-multiplier-rows.ts`
- Create: `src/features/calculators/scope-pricing-calculator/ui/components/agent-panel/scope-multiplier-overrides.tsx`
- Modify: `src/features/calculators/scope-pricing-calculator/ui/components/agent-panel/multiplier-control.tsx:16-24,54,70-74`
- Modify: `src/features/calculators/scope-pricing-calculator/ui/components/agent-panel/index.tsx`
- Test: `scripts/verify-scope-pricing.ts` (the two pure helpers)

**Interfaces:**
- Consumes: `FormulaLineValues.multiplierOverride`, `PricedLine.multiplier`, `QuoteLineInput` (Task 1); `paintLine` goldens helper (Task 2); `MULTIPLIER_STEP`; `formatMultiplier`, `formatAsDollars`.
- Produces:
  - `describeMultiplierDefaults(config: ScopePricingConfig, pricingKeys: readonly PricingKey[], jobMultiplier: number): string`
  - `interface ScopeMultiplierRow { index: number, id: string, pricingKey: PricingKey, override: number | null, priced: PricedLine | null }` and `scopeMultiplierRows(quote: QuoteResult, lines: readonly QuoteLineInput[]): ScopeMultiplierRow[]` — one row per formula line whose result is priced with `cost != null` (`priced` set) **or** that carries an override (`priced` null when the scope is custom or incomplete); manual lines never.
  - `ScopeMultiplierOverrides({ config, quote, lines }: { config: ScopePricingConfig, quote: QuoteResult, lines: ScopePricingFormValues['lines'] })` — `AgentPanel` watches `lines` once and passes them down (the list needs the live `multiplierOverride` values, which `useFieldArray`'s `fields` do not carry); the list uses `useFormContext` only for `control`.
  - `MultiplierControl` gains prop `pricingKeys: readonly PricingKey[]`.

- [ ] **Step 1: Add the helpers' goldens to the `// ── Agent panel helpers` section**

```ts
assert.equal(describeMultiplierDefaults(config, [], 2.8), 'Floor 2.00x · default 2.80x', 'no scopes: floor and default only')
assert.equal(describeMultiplierDefaults(config, ['installExteriorPaint', 'mpu', 'rnrAttic', 'mpu'], 2.8), 'Floor 2.00x · default 2.80x · Install exterior paint 3.50x · Main panel upgrade 2.50x', 'lists each scope default present once; scopes on the default are not repeated')
assert.equal(describeMultiplierDefaults(config, ['mpu'], 2.85), 'Floor 2.00x · default 2.80x · Main panel upgrade 2.50x · +0.05x on every scope', 'a shift is named')
assert.equal(describeMultiplierDefaults(config, ['mpu'], 2.7), 'Floor 2.00x · default 2.80x · Main panel upgrade 2.50x · −0.10x on every scope', 'a negative shift uses a real minus sign')

const rowLines = [mpuLine('m1'), mpuLine('m2', 3), manual, paintLine(3001), paintLine(3002, 'coolLife', { multiplierOverride: 3 })]
const rows = scopeMultiplierRows(priceQuote({ lines: rowLines, context: oneStory, config }), rowLines)
assert.deepEqual(rows.map(row => [row.index, row.pricingKey, row.override, row.priced?.price ?? null]), [[0, 'mpu', null, 11250], [1, 'mpu', 3, 13500], [4, 'installExteriorPaint', 3, null]], 'a row per costed scope, plus an overridden custom scope so its override can be cleared; manual and plain custom scopes have none')
```
Import both helpers from their lib paths.

- [ ] **Step 2: Run the script to see it fail**

Run: `npx tsx scripts/verify-scope-pricing.ts`
Expected: FAIL — cannot find module `describe-multiplier-defaults`.

- [ ] **Step 3: `lib/describe-multiplier-defaults.ts` and `lib/scope-multiplier-rows.ts`**

`describeMultiplierDefaults`: parts `Floor ${formatMultiplier(floor)}`, `default ${formatMultiplier(default)}`, then for each unique key in order of first appearance whose `byScope` entry exists: `${FORMULAS[key].label} ${formatMultiplier(byScope[key])}`, then when `Math.abs(jobMultiplier − default) >= 0.005`: `${sign}${formatMultiplier(Math.abs(delta))} on every scope` with `sign` `'+'` or `'−'` (U+2212). Join with `' · '`. (`formatMultiplier` is the one way a multiplier renders — `docs/ubiquitous-language.md`.)

`scopeMultiplierRows`: iterate `lines` with index; for `kind === 'formula'`, find `quote.lines` by `id`; `priced = result?.status === 'priced' && result.cost != null ? result : null`; `override = line.multiplierOverride ?? null`; push when `priced != null || override != null`.

- [ ] **Step 4: Run the script to see it pass**

Run: `npx tsx scripts/verify-scope-pricing.ts`
Expected: `✅ verify-scope-pricing passed`.

- [ ] **Step 5: `MultiplierControl` description**

Add prop `pricingKeys: readonly PricingKey[]`. The non-target description becomes `describeMultiplierDefaults(config, pricingKeys, appliedMultiplier)`; the target description stays `Set by the target price: ${formatMultiplier(appliedMultiplier)}`. The placeholder becomes `config.multiplier.default.toFixed(2)` ("2.80") so both multiplier inputs in the sheet show the same shape (an input placeholder, not a rendered multiplier, so no `x` suffix). The label, buttons, `stepMultiplier` calls, `min={floor}` and "Back to the default" link are unchanged (the control rests at 2.8 and steps from its own value; the shift is what the engine derives).

- [ ] **Step 6: `agent-panel/scope-multiplier-overrides.tsx`**

`'use client'`. `const { control } = useFormContext<ScopePricingFormValues>()`; `lines` arrive as a prop; `const rows = scopeMultiplierRows(quote, lines)`. Inside `<section aria-label="Scope multipliers">` with `<h3 className="text-sm font-medium">Scope multipliers</h3>` and a `<ul className="flex flex-col gap-3">`, one `<li className="flex flex-col gap-1" key={row.id}>` per row:

```tsx
const label = FORMULAS[row.pricingKey].label
const applied = row.priced == null ? '—' : `${formatAsDollars(row.priced.cost ?? 0)} → ${formatAsDollars(row.priced.price)}`
…
<div className="flex items-baseline justify-between gap-3 text-sm">
  <span className="min-w-0 truncate">{label}</span>
  <span className="shrink-0 text-muted-foreground tabular-nums">{applied}</span>
</div>
<FormField
  control={control}
  name={`lines.${row.index}.multiplierOverride`}
  render={({ field }) => (
    <FormItem>
      <div className="flex items-center gap-2">
        <FormControl>
          <NumberField
            {...field}
            aria-label={`Multiplier for ${label}`}
            className="h-11 w-28 text-center"
            inputMode="decimal"
            min={floor}
            placeholder={row.priced?.multiplier == null ? '' : row.priced.multiplier.toFixed(2)}
            step={MULTIPLIER_STEP}
          />
        </FormControl>
        {field.value != null && (
          <Button className="min-h-11 px-0" onClick={() => field.onChange(null)} type="button" variant="link">
            Back to the default
          </Button>
        )}
      </div>
      <FormMessage />
    </FormItem>
  )}
/>
```
Write the JSX multi-line as above (`style/jsx-one-expression-per-line`, `jsx-first-prop-new-line`, `jsx-max-props-per-line`, `jsx-closing-bracket-location` are live; a template literal keeps the `cost → price` text on one line). The placeholder is the applied multiplier from the engine's own result; it is visible only while the field is empty, which is exactly when the result carries the un-overridden value. When `rows` is empty render `<p className="text-sm text-muted-foreground">Costed scopes show here, each with its own multiplier.</p>`. The list is **not** disabled under a target: the solver holds an overridden scope and re-solves.

- [ ] **Step 7: `agent-panel/index.tsx`**

`const { control } = useFormContext<ScopePricingFormValues>()` and `const lines = useWatch({ control, name: 'lines' })` (quote lines carry no pricing key or override, so the form is the source). `pricingKeys = lines.flatMap(line => line.kind === 'formula' ? [line.pricingKey] : [])`. Pass `lines` to `ScopeMultiplierOverrides`. Order inside the sheet: `AgentReadouts` · `MultiplierControl` (with `pricingKeys`) · `TargetPriceControl` · `ScopeMultiplierOverrides` · `UnitCostsList`.

- [ ] **Step 8: Verify**

Run: `npx tsx scripts/verify-scope-pricing.ts && pnpm tsc && pnpm lint && pnpm theme:check`
Expected: all clean.

- [ ] **Step 9: Visual check — only against this tree's own dev server**

Run: `for pid in $(ss -ltnp 2>/dev/null | grep -o 'next-server[^,]*,pid=[0-9]*' | grep -o '[0-9]*$'); do readlink /proc/$pid/cwd; done` and compare with `git rev-parse --show-toplevel`. Only if one matches, drive that port with a local Playwright script (auth: `/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET from .env.local>&redirect=/dashboard/calculators`), open the Scope Pricing tab, add "Install exterior paint" and "Main panel upgrade", open the agent panel, screenshot at 1180 and 820 wide, and confirm: description reads `Floor 2.00x · default 2.80x · Install exterior paint 3.50x · Main panel upgrade 2.50x`; two rows under Scope multipliers with placeholders `3.50` and `2.50`; typing `3` in MPU's field changes only MPU's price; stepping the proposal-wide control to 2.85 moves both prices and appends `+0.05x on every scope`. Otherwise **do not start a server**; write "visual check owed to Oliver" in the commit body and the task is still done.

- [ ] **Step 10: Commit**

```bash
git add -- src/features/calculators/scope-pricing-calculator/lib/describe-multiplier-defaults.ts src/features/calculators/scope-pricing-calculator/lib/scope-multiplier-rows.ts src/features/calculators/scope-pricing-calculator/ui/components/agent-panel/scope-multiplier-overrides.tsx
git commit -m "feat(calculators): agent panel lists scope defaults, names the shift and overrides the multiplier per scope

Visual check owed to Oliver (no dev server in this tree).

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- scripts/verify-scope-pricing.ts src/features/calculators/scope-pricing-calculator/lib/describe-multiplier-defaults.ts src/features/calculators/scope-pricing-calculator/lib/scope-multiplier-rows.ts src/features/calculators/scope-pricing-calculator/ui/components/agent-panel/scope-multiplier-overrides.tsx src/features/calculators/scope-pricing-calculator/ui/components/agent-panel/multiplier-control.tsx src/features/calculators/scope-pricing-calculator/ui/components/agent-panel/index.tsx
git show --stat HEAD
```

---

### Task 4: Homeowner-facing card — the custom scope's price field

**Files:**
- Create: `src/features/calculators/scope-pricing-calculator/lib/is-custom-line.ts`
- Modify: `src/features/calculators/scope-pricing-calculator/ui/components/line-price.tsx`
- Modify: `src/features/calculators/scope-pricing-calculator/ui/components/formula-line-card.tsx`
- Modify: `src/features/calculators/scope-pricing-calculator/ui/components/agent-panel/agent-readouts.tsx:28-32`
- Modify: `src/features/calculators/scope-pricing-calculator/ui/views/scope-pricing-calculator.tsx:48`
- Test: `scripts/verify-scope-pricing.ts` (the pure helper only)

**Interfaces:**
- Consumes: `IncompleteLine.reason`, `PricedLine.cost` (Task 1), `describeCustomLine` (Task 2), `MoneyField`.
- Produces:
  - `isCustomLine(result: QuoteLineResult | undefined): boolean` — true for a formula line that is `incomplete` with `reason: 'custom'` **or** `priced` with `cost == null` (so the price field stays while the agent edits a priced custom scope).
  - `LinePrice` gains optional prop `customHint: string`.
  - `FormulaLineCard` gains prop `config: ScopePricingConfig`.

- [ ] **Step 1: Add the helper's goldens to the `// ── Agent panel helpers` section**

```ts
assert.equal(isCustomLine(customUnpriced.lines[0]), true, 'custom scope, unpriced')
assert.equal(isCustomLine(customPriced.lines[0]), true, 'custom scope stays custom once priced, so its price field stays')
assert.equal(isCustomLine(mixed.lines[1]), false, 'a manual line is not a custom scope')
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

Add prop `config: ScopePricingConfig`. `const custom = isCustomLine(result)`. Pass `customHint={describeCustomLine(config)}` to `LinePrice`. Below the variables, when `custom`, render the same `FormField` block `ManualLineCard` uses for `lines.${index}.price` (label `Price`, `MoneyField` `className="h-11"` `placeholder="$0"`), inside the same `grid gap-3 sm:grid-cols-2` so it sits beside the variables. Nothing about cost, home size or multiplier appears on the card.

- [ ] **Step 7: View and readouts**

`scope-pricing-calculator.tsx:48` passes `config={config}` to `FormulaLineCard`. `agent-readouts.tsx` uncosted note → `Lines without cost data (manual, or a custom scope priced by hand) are left out of cost, margin and multiplier.`

- [ ] **Step 8: Verify**

Run: `npx tsx scripts/verify-scope-pricing.ts && pnpm tsc && pnpm lint && pnpm theme:check`
Expected: all clean.

- [ ] **Step 9: Visual check — same ownership rule as Task 3 Step 9**

Add "Install exterior paint", choose CoolLife, type 3,200 sq ft: the price slot reads `Over 3,000 sq ft, enter a price` and a Price field appears; type 31,000 → the line shows `$31,000`, the field stays; change to 2,500 sq ft → the field disappears and the line shows `$27,020`. Screenshot once at 820 wide. Confirm no Cost, multiplier or margin text outside the sheet. Otherwise record "visual check owed to Oliver".

- [ ] **Step 10: Commit**

```bash
git add -- src/features/calculators/scope-pricing-calculator/lib/is-custom-line.ts
git commit -m "feat(calculators): exterior paint above 3,000 sq ft is a custom scope priced on the card

Visual check owed to Oliver (no dev server in this tree).

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- scripts/verify-scope-pricing.ts src/features/calculators/scope-pricing-calculator/lib/is-custom-line.ts src/features/calculators/scope-pricing-calculator/ui/components/line-price.tsx src/features/calculators/scope-pricing-calculator/ui/components/formula-line-card.tsx src/features/calculators/scope-pricing-calculator/ui/components/agent-panel/agent-readouts.tsx src/features/calculators/scope-pricing-calculator/ui/views/scope-pricing-calculator.tsx
git show --stat HEAD
```

---

### Task 5: Tracker ruling R19 and the amended rows

**Files:**
- Modify: `docs/plans/2026-09-26-sales-calculators-epic.md:50,65,137,146,180-185,299-300`

**Interfaces:** none (documentation). The spec and this plan are **not** deleted here: the repo deletes them when the work ships to prod (the local-main queue drains through `/pre-ship`), not when it lands on the workbench. The new terms are already in `CONTEXT.md` §Scope Pricing terms (written with the stress-test amendment); verify the section is present and matches before committing.

- [ ] **Step 1: Preflight the tracker**

Run: `git diff -- docs/plans/2026-09-26-sales-calculators-epic.md`
Expected: empty (another session's uncommitted edit here would ride along with the pathspec commit; if not empty, stop and report).

- [ ] **Step 2: Add R19 after the R18 row (line 65)**

```markdown
| **R19** | **Scope Pricing repricing and per-scope multipliers (owner brainstorm + stress test, 2026-11-06).** Supersedes D3's "per-trade defaults wait for C2" and amends PR11. Terms: `CONTEXT.md` §Scope Pricing terms. (1) **Cost stays honest; the price is fixed through the multiplier.** `multiplier.byScope` is an Admin-configured value served from code by the one resolver (I3): `installExteriorPaint` 3.5, `mpu` 2.5; every other scope uses the 2.8 default. The floor binds every layer. (2) **Three layers per scope line:** the agent's **scope multiplier override** (absolute) → the **proposal-wide multiplier** → the **scope default** → 2.8. **The proposal-wide control is a shift:** it rests at 2.8 and moves every scope without an override by `m − 2.8`, so the spread between scopes survives a target price; the target solver solves for that one shift. A scope the shift would take under the floor is held at the floor and the others carry the target; `below-floor` only when the target is under the floor total, and then the floor and the floor total are shown (CF4). (3) **Exterior paint** prices by **home size** from home square footage alone: ≤ 1,350 small, ≤ 1,800 average, ≤ 3,000 large (an edge takes the smaller size), above 3,000 a **custom scope**: the Formula returns no cost and the agent types the price on the card, carried uncosted like a manual line. Costs: CoolLife 6,560 / 7,140 / 7,720, water 4,430 / 4,990 / 5,570, garage yes/no +485, +1,000 per story above the first (`additionalStory`, from `numStories`). At 3.5: ≈ $23,000 / $25,000 / $27,000 and $15,500 / $17,500 / $19,500, garage ≈ +$1,700. `garageSqFt` leaves the calculator's Variables (the SOW seeds keep theirs). (4) **MPU** costs 4,500 / 5,500 → $11,250 / $13,750 at 2.5. (5) Agent panel: the multiplier description lists the scope defaults in the quote and names the shift; a **Scope multipliers** list overrides per scope. The homeowner card shows a price field only for a custom scope ("Over 3,000 sq ft, enter a price"). (6) Goldens stay in `scripts/verify-scope-pricing.ts`. Spec: `docs/superpowers/specs/2026-11-06-scope-pricing-paint-mpu-repricing-design.md` (deleted when shipped). | 2026-11-06 |
```

- [ ] **Step 3: Markers on D3 (line 50) and PR2 (line 137), amendment on PR11 (line 146)**

Append to D3's cell: ` **Superseded by R19 (2026-11-06):** per-scope defaults ship now as `multiplier.byScope`.` Append to PR2: ` *MPU figures superseded by R19: 4,500 / 5,500.*` Append to PR11: ` *Amended by R19: the target solves for the proposal-wide shift; scopes with their own override stay put; a scope the floor clamps is held there.*`

- [ ] **Step 4: §3.6 rows**

Line 180 ("Multiplier override and target price") → `| Proposal-wide multiplier (a shift on every scope without an override) and target price | **Agent-only** | Bounded below by the multiplier floor; the target solves for the shift (R19) |`. Insert after it: `| Scope multiplier override | **Agent-only** | Absolute for that scope line; ignores the shift; never below the floor (R19) |`. Line 183 → `| Default multiplier, **per-scope defaults** and **multiplier floor** | **Admin-configured** | Default 2.8 (D3); paint 3.5 and MPU 2.5 (R19). The floor defaults to 2.0, the existing "danger" boundary |`. Line 185 → `| Exterior-paint home sizes (1,350 / 1,800 / 3,000 sqft; custom scope above) | **Admin-configured** | Pricing sizes, not formula structure (R19) |`.

- [ ] **Step 5: §7 formula rows**

Line 299 → `| Electrical | \`mpu\` | relocationRequired | relocation ? mpuWithRelocation : mpuBase (4,500 / 5,500, R19) |`. Line 300 → `| Exterior paint | \`installExteriorPaint\` | paintType, homeSqFt, garageIncluded | home size by sqft (≤ 1,350 small, ≤ 1,800 average, ≤ 3,000 large, above: custom scope, no cost) + garage + (stories − 1) × additionalStory; per paint type (R19) |`.

- [ ] **Step 6: Final verification**

Run: `npx tsx scripts/verify-scope-pricing.ts && pnpm lint && pnpm tsc && pnpm theme:check && git status --short src/features/calculators scripts docs/plans/2026-09-26-sales-calculators-epic.md`
Expected: green, and `git status` shows only the tracker as modified.

- [ ] **Step 7: Commit**

```bash
git commit -m "docs(tracker): R19 scope pricing repricing and per-scope multipliers; D3, PR2, PR11, §3.6, §7 amended

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- docs/plans/2026-09-26-sales-calculators-epic.md
git show --stat HEAD
```
