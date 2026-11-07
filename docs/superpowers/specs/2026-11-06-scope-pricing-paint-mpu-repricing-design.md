# Scope Pricing: exterior paint and MPU repricing, per-scope multipliers

> Owner brainstorm 2026-11-06, stress-tested the same day (rulings in §Stress-test rulings). Amends the Sales Calculators epic (`docs/plans/2026-09-26-sales-calculators-epic.md`): ruling **R19** supersedes **D3** ("one global default; per-trade defaults wait for C2"). Delete this file when the work ships; the tracker keeps the rulings. Vocabulary: `CONTEXT.md` §Scope Pricing terms.

## Intent

The Scope Pricing calculator prices two scopes wrong today, and the owner's fix needs a multiplier layer the engine does not have.

- **Exterior paint** (`installExteriorPaint`, both paint types) shows about $16,800 for a small CoolLife job; the owner's in-home price is about $23,000. The home sizes also moved (the painter's real sizes are 0–1,350 / 1,350–1,800 / 1,800–3,000 sq ft, with 3,000+ priced by hand), a garage is a flat add rather than square footage, and each story above the first costs more.
- **MPU** (`mpu`) costs changed to $4,500 / $5,500 and the owner wants it sold at about 2.5×, not the house 2.8×.

The owner's instruction is to **keep Cost honest and fix the price through the multiplier**: Cost stays what the trade charges Tri Pros; a scope may carry its own default multiplier; 2.8 remains the fallback; and the agent can override the multiplier scope by scope in the home. Prices stay non-round.

## Goals

1. Exterior paint prices land near the owner's targets at the scope's default multiplier (3.5): CoolLife ≈ $23,000 / $25,000 / $27,000 and water paint ≈ $15,500 / $17,500 / $19,500 for a small / average / large home, garage ≈ +$1,700, each extra story ≈ +$3,500 (it costs $1,000).
2. MPU shows $11,250 / $13,750 (costs $4,500 / $5,500 at 2.5).
3. Three multiplier layers resolve per scope line, never below the floor: **scope multiplier override → proposal-wide multiplier (a shift) → scope default → 2.8**.
4. The homeowner-facing render still shows no Cost, multiplier or margin (R1 / O1). Everything multiplier-related stays inside the agent panel (`data-agent-only`).

## Non-goals

- No admin screen or `app_settings` storage. Scope defaults are Admin-configured values served from code by the one resolver, like every other Admin-configured value today (tracker I3, C2).
- No change to any other scope's cost or multiplier.
- No change to the SOW catalog seeds under `src/shared/db/seeds/data/` (they still carry a `garageSqFt` variable for SOW text; the calculator's `VARIABLES` is a separate list).
- No persistence; the calculator stays a stateless form (C0). "Proposal-wide" is the owner's term for the one control; in C0 the quote is standalone (R2) and the code keeps `QuoteResult`.

## Anti-goals

- Deriving Cost from a target price. Costs are entered as costs.
- A per-scope multiplier control that the homeowner can see.
- A target-price solve that silently moves a scope the agent overrode.

## Constraints

- `price = round(cost × multiplier)`; tax is backed out of the price (D2 as amended). Unchanged.
- `multiplier.floor` (2.0) binds every layer, including scope defaults, the proposal-wide multiplier and scope overrides (CF4). A target that cannot be reached without going under the floor shows the floor price and says so (CF4).
- Values live in `SCOPE_PRICING_CONFIG_DEFAULTS` and are validated by `scopePricingConfigSchema`; labels for every unit cost are type-enforced in `UNIT_COST_LABELS`.
- The engine's goldens live in `scripts/verify-scope-pricing.ts` (tracker V2: `node:assert/strict`, run with `npx tsx scripts/verify-scope-pricing.ts`, type-checked by `pnpm tsc`). It asserts every value this work changes (MPU 3,200 / 4,000, the 1,500 / 3,000 paint edges, `garageSqFt`, a finite-and-non-negative sweep over every formula) and must be updated in the same change; `pnpm tsc` fails otherwise.
- The pre-commit gate runs `pnpm tsc && pnpm lint && pnpm theme:check`; every task verifies all three before committing.

## The owner's decisions (verbatim intent, numbers as agreed)

### Exterior paint

| Home size | Home sq ft | CoolLife cost → price @3.5 | Water cost → price @3.5 |
|---|---|---|---|
| Small | ≤ 1,350 | $6,560 → $22,960 | $4,430 → $15,505 |
| Average | 1,350 – 1,800 | $7,140 → $24,990 | $4,990 → $17,465 |
| Large | 1,800 – 3,000 | $7,720 → $27,020 | $5,570 → $19,495 |
| Custom scope | > 3,000 | no formula price; the agent enters the price | same |

- **Garage** is yes/no. Cost **+$485** (≈ $1,700 on the price). The garage square footage input goes away; the home size comes from home square footage alone. Unit Cost label: "Garage" ("add-on" is the catalog's kind, `CONTEXT.md`).
- **Stories**: cost **+$1,000 per story above the first** (owner: "$6,000 → $7,000"), read from the existing job-level `numStories`. About +$3,500 on the price per story at 3.5. Unit Cost `additionalStory`, label "Each additional story" — its own name, because roof's `dollarPerAdditionalStory` is $25 **per BSQ** per story and the two sit in the same Unit Costs list (stress-test ruling).
- Scope default multiplier **3.5**.

Size edges (owner-confirmed by reading): a house exactly on an edge takes the smaller size (1,350 is small, 1,800 is average, 3,000 is large). Only above 3,000 is a custom scope.

### MPU

- Costs **$4,500** (no relocation) / **$5,500** (relocation). Scope default multiplier **2.5** → $11,250 / $13,750.

### Multipliers

- Scope defaults are an Admin-configured value: `multiplier.byScope`, keyed by pricing key (= scope), initially `{ installExteriorPaint: 3.5, mpu: 2.5 }`. A scope with no entry uses `multiplier.default` (2.8).
- The agent can override the multiplier **per scope line** (the **scope multiplier override**, agent-only; a line is one scope on the quote, and the same scope added twice carries two overrides) and **proposal-wide** (the existing control). **The proposal-wide multiplier is a shift, not a replacement** (owner ruling 2026-11-06, after the builder check showed that one replacing number undoes the per-scope spread the moment the agent touches the target price): it reads as a multiplier and rests at 2.8; set to `m`, every scope without an override moves by `m − default` (paint 3.5 → 3.55 at 2.85, MPU 2.5 → 2.55, a 2.8 scope → 2.85). The target-price solver solves for that one shift, so the spread between scopes is preserved. Scopes the agent overrode stay where the agent put them.
- **Below the floor** (stress-test ruling 2026-11-06, "clamp and keep solving"): when the shift a target needs would take one scope under the floor but the others can still carry the total, that scope is held at the floor and the rest carry the target — the target is **reached**. The target is **below-floor** only when it is under the total with the proposal-wide multiplier at the floor; then the control shows the floor and the floor total, exactly as CF4 reads today.

## Design

### Config (`schemas/config.ts`, `constants/config-defaults.ts`, `constants/unit-cost-labels.ts`)

- `unitCosts.exteriorPaintSiding`: keep the six paint costs (new values above); add `garage: 485` and `additionalStory: 1000`. Labels: "Garage", "Each additional story".
- `unitCosts.electricals`: `mpuBase: 4500`, `mpuWithRelocation: 5500`.
- `exteriorPaintTiers` becomes `exteriorPaintHomeSizes`, three ascending edges: `{ smallMaxSqFt: 1350, averageMaxSqFt: 1800, largeMaxSqFt: 3000 }`, refined ascending. (Replaces `smallBelowSqFt` / `largeAboveSqFt`; the old names encoded two sizes, and "tier" already means the multiplier tier and the R9 configuration tiers.)
- `multiplier`: `{ default: 2.8, floor: 2, byScope: Partial<Record<PricingKey, number>> }`; refine every `byScope` value ≥ floor as `default` already is.

### Variables (`constants/variables.ts`)

- Remove `garageSqFt`. Add `garageIncluded: { trade: 'exteriorPaintSiding', label: 'Garage included?', kind: 'boolean', unit: null, default: false }` (renders as the module's boolean `Switch`, like `relocationRequired`).
- `homeSqFt` and `paintType` unchanged.

### Formulas

- `compute` may now return `number | null`. `null` means "this formula has no price for these inputs; the agent prices it" (a custom scope). The `ComputeFn` return type widens accordingly; every other formula still returns a number.
- `installExteriorPaint`: variables `['paintType', 'homeSqFt', 'garageIncluded']`. Home size from `homeSqFt` against the three edges; `> largeMaxSqFt` → `null`. Otherwise `sizeCost + (garageIncluded ? costs.garage : 0) + (context.numStories − 1) × costs.additionalStory`.
- `mpu`: unchanged code; new costs.

### Form (`schemas/form.ts`, `lib/create-quote-line.ts`)

- A formula line gains two nullable fields: `multiplierOverride` (the scope multiplier override, `min(floor)`, so `formulaLineSchema` moves inside `createScopePricingFormSchema(multiplierFloor)`) and `price` (the agent's price for a custom scope, `min(0)`). Both default to `null` in `createFormulaLine`; `duplicateLine` copies them.

### Engine (`lib/price-quote.ts`, `lib/solve-multiplier.ts`, `lib/describe-target-result.ts`, `types/index.ts`)

- `QuoteLineInput` (formula) carries `multiplierOverride?: number | null` and `price?: number | null`.
- Per formula line: `scopeDefault = byScope[pricingKey] ?? default`; `shift = (overrides.multiplier ?? default) − default`; `multiplier = max(floor, line.multiplierOverride ?? scopeDefault + shift)`. An override is absolute and ignores the shift. The resolver is a private function of `price-quote.ts` beside `resolveMultiplier`; the engine's goldens cover it and the agent panel reads the applied value from the result, so nothing else needs it.
- Compute `null`: if `line.price` is a finite number ≥ 0 the line is `priced` with `cost: null` (uncosted, exactly like a manual line; no multiplier applies); otherwise `incomplete` with `needs: []` and `reason: 'custom'` so the UI can say why; `reason` is set only on custom scopes. The existing `'Needs a price'` text is the fallback. A priced formula line adds its trade to the permit set as today, costed or not.
- `PricedLine` gains `multiplier: number | null` (null for uncosted lines) so the agent panel can show each scope's applied multiplier.
- `QuoteResult.multiplier` keeps meaning the proposal-wide control's value (`overrides.multiplier ?? default`), which the control displays; the shift is derived from it, never stored.
- Permit lines use `default + shift` (they have no scope default of their own).
- `solveMultiplier` solves for the proposal-wide value. Manual and custom prices and every overridden scope's price are **held**. Over the open scopes `i` (scope default `d_i`, cost `c_i`): `shift = (target − held − Σ c_i·d_i) / Σ c_i`. If `default + shift < floor` → **`below-floor`**: `multiplier` is the floor and `achievedTotal` the total priced at the floor (CF4). Otherwise any open scope with `d_i + shift < floor` is held at its floor price and the shift is re-solved over the rest, until no scope clamps; if no open scope remains the result is `below-floor` as above. Else **`reached`** with `multiplier = default + shift`. **`no-cost`** when no line has cost; **`all-overridden`** when every costed scope has an override (the old `no-cost` copy, "a target needs a formula", would be false). `achievedTotal` is still re-priced at the solved value, since per-line rounding and clamping can move it.
- `describeTargetResult` gains the `all-overridden` branch: "Every costed scope has its own multiplier, so there is nothing left to solve. Clear one to use a target." The hook and the panel treat a target as active when the result carries a `multiplier` (`'multiplier' in solved`), not by comparing against `'no-cost'`.

### Agent panel (`ui/components/agent-panel/`)

- **Proposal-wide multiplier control**: same widget, now a shift. It rests at 2.8 and `+`/`−` step it by `MULTIPLIER_STEP` from its own value as today (every scope moves by the same step). Its description lists the scope defaults present in the quote ("Floor 2.00x · default 2.80x · Install exterior paint 3.50x · Main panel upgrade 2.50x") and, when shifted, says so ("+0.05x on every scope", formatted with `formatMultiplier`). The lower bound stays the floor.
- **New `ScopeMultiplierOverrides`** list, titled "Scope multipliers": one row per costed formula line, plus any formula line that still carries an override while uncosted (a custom scope the agent overrode earlier) so the override can be cleared instead of silently re-applying when the scope is costed again. Row: label · cost → price (or `—`) · a `NumberField` bound to `lines.{i}.multiplierOverride` (step `MULTIPLIER_STEP`, min floor, placeholder = the applied multiplier from the result) · "Back to the default" link when set (the same words as the proposal-wide control). Sits between the target-price control and the unit costs. The row selection is a pure helper with goldens (`scopeMultiplierRows`). Manual lines never appear.
- **Readouts**: the uncosted note reads "Lines without cost data (manual, or a custom scope priced by hand) are left out of cost, margin and multiplier."
- **Unit costs list**: unchanged; the two new paint costs appear through the label map.

### Homeowner-facing line card (`ui/components/formula-line-card.tsx`, `ui/components/line-price.tsx`)

- Variables render as today: paint type, home square footage, garage switch.
- When the result is `incomplete` with `reason: 'custom'`, the card shows a price field bound to `lines.{i}.price` (the same `MoneyField` block `ManualLineCard` uses) and the line price text reads "Over 3,000 sq ft, enter a price". Once priced, the line shows its price like any other and the field stays while the scope is custom. No multiplier, cost or home size name is visible.

### Goldens (`scripts/verify-scope-pricing.ts`, the existing V2 script; no new test files, no `package.json` change)

- Replace the old paint and MPU goldens and the `exteriorPaintTiers` literal with the new ones; the finite-and-non-negative sweep asserts `null` for the paint formula above 3,000 sq ft and finite elsewhere (1,160 inputs).
- Paint: each home size × each paint type prices to the table above at the scope default; edges (1,350 / 1,800 / 3,000) fall in the smaller size; 3,001 is a custom scope, incomplete until priced, then priced uncosted; garage adds ≈ $1,698; two stories add $3,500.
- MPU: $11,250 / $13,750.
- Precedence: an override is absolute and beats everything; the proposal-wide value shifts every open scope by `m − 2.8` (paint 3.5 → 3.55 and MPU 2.5 → 2.55 at 2.85); a scope with no `byScope` entry sits at 2.8 + shift; any result below the floor prices at the floor.
- Solver: MPU + roof at their defaults, target = the current total → the solved value is 2.8 and no line moves; a higher target shifts both equally; an overridden scope stays put and the solver reaches the target through the others; `all-overridden` when every costed scope is overridden; a shift that puts MPU exactly on the floor is reached; a shift that would take MPU under the floor holds it there and the roof carries the target (reached); a target under the floor total is `below-floor` with the floor and the floor total.
- Agent panel helpers: `describeMultiplierDefaults`, `scopeMultiplierRows`, `isCustomLine`, `describeCustomLine`, the `all-overridden` copy.
- `pnpm lint && pnpm tsc && pnpm theme:check` clean.

### Tracker edits (`docs/plans/2026-09-26-sales-calculators-epic.md`)

- Add **R19** (this ruling, dated 2026-11-06): per-scope default multipliers now, the proposal-wide control as a shift, the scope multiplier override, paint home sizes/costs, MPU costs, the below-floor rule; supersedes D3's "wait for C2" and amends PR11 (the target solves for the shift).
- §3.6: "Default multiplier and multiplier floor" row gains "and per-scope defaults (paint 3.5, MPU 2.5)"; the paint thresholds row reads 1,350 / 1,800 / 3,000 with a custom scope above; add an Agent-only row for the scope multiplier override.
- §7 formula table: `installExteriorPaint` row reads the new variables and home-size rule; `mpu` costs.
- PR2's MPU figure and D6's historical note stay as history; add a one-line "superseded by R19" marker on D3 and PR2.
- New terms live in `CONTEXT.md` §Scope Pricing terms (written with the stress-test amendment, 2026-11-06).

## Stress-test rulings (owner, 2026-11-06)

1. **Below-floor = unreachable, not "a scope would clamp".** A scope that would go under the floor is held there and the others carry the target. `below-floor` only when the target is under the floor total; then the floor and the floor total are reported (CF4).
2. **Paint's per-story cost has its own name**: `additionalStory`, "Each additional story". Roof's `dollarPerAdditionalStory` ($/BSQ) is untouched.
3. **Vocabulary**: *Proposal-wide multiplier* (not job-wide), *Scope multiplier override* (not line override / pinned / fixed), *Custom scope*, *Home size* (not tier / band). Users are *agents*, not reps (`CONTEXT.md` §People terms). Config field `exteriorPaintHomeSizes`; form field `multiplierOverride`.
4. Accepted from the reviewers without an owner call: `all-overridden` solver status with its own copy and `'multiplier' in solved` gates; the resolver stays private to the engine; `formatMultiplier` for the shift text; the readouts' uncosted copy; "Garage" label; the `Scope multipliers` list keeps a row for an overridden custom scope; every verify step runs lint + tsc + theme:check; UI tasks carry pure row/predicate helpers with goldens because no dev server is available to the build.

## Left to the builder

- Row layout of the `Scope multipliers` list within the sheet's width; the panel is agent-only so no homeowner design pass is needed, but it follows the existing panel's spacing.
- The exact `aria-label` wording on the per-scope `NumberField`.
