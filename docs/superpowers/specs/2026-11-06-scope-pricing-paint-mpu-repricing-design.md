# Scope Pricing: exterior paint and MPU repricing, per-scope multipliers

> Owner brainstorm 2026-11-06. Amends the Sales Calculators epic (`docs/plans/2026-09-26-sales-calculators-epic.md`): ruling **R19** supersedes **D3** ("one global default; per-trade defaults wait for C2"). Delete this file when the work ships; the tracker keeps the rulings.

## Intent

The Scope Pricing calculator prices two scopes wrong today, and the owner's fix needs a multiplier layer the engine does not have.

- **Exterior paint** (`installExteriorPaint`, both paint types) shows about $16,800 for a small CoolLife job; the owner's in-home price is about $23,000. The size bands also moved (the painter's real bands are 0–1,350 / 1,350–1,800 / 1,800–3,000 sq ft, with 3,000+ priced by hand), a garage is a flat add-on rather than square footage, and each storey above the first costs more.
- **MPU** (`mpu`) costs changed to $4,500 / $5,500 and the owner wants it sold at about 2.5×, not the house 2.8×.

The owner's instruction is to **keep Cost honest and fix the price through the multiplier**: Cost stays what the trade charges Tri Pros; a scope may carry its own default multiplier; 2.8 remains the fallback; and the agent can override the multiplier line by line in the home. Prices stay non-round.

## Goals

1. Exterior paint prices land near the owner's targets at the scope's default multiplier (3.5): CoolLife ≈ $23,000 / $25,000 / $27,000 and water paint ≈ $15,500 / $17,500 / $19,500 for small / average / large, garage ≈ +$1,700, each extra storey ≈ +$3,500 (it costs $1,000).
2. MPU shows $11,250 / $13,750 (costs $4,500 / $5,500 at 2.5).
3. Three multiplier layers resolve per line, never below the floor: **agent's line override → agent's job-wide override → scope default → 2.8**.
4. The homeowner-facing render still shows no Cost, multiplier or margin (R1 / O1). Everything multiplier-related stays inside the agent panel (`data-agent-only`).

## Non-goals

- No admin screen or `app_settings` storage. Scope defaults are Admin-configured values served from code by the one resolver, like every other Admin-configured value today (tracker I3, C2).
- No change to any other scope's cost or multiplier.
- No change to the SOW catalog seeds under `src/shared/db/seeds/data/` (they still carry a `garageSqFt` variable for SOW text; the calculator's `VARIABLES` is a separate list).
- No persistence; the calculator stays a stateless form (C0).

## Anti-goals

- Deriving Cost from a target price. Costs are entered as costs.
- A per-line multiplier control that the homeowner can see.
- A target-price solve that silently moves a line the agent pinned.

## Constraints

- `price = round(cost × multiplier)`; tax is backed out of the price (D2 as amended). Unchanged.
- `multiplier.floor` (2.0) binds every layer, including scope defaults and line overrides (CF4).
- Values live in `SCOPE_PRICING_CONFIG_DEFAULTS` and are validated by `scopePricingConfigSchema`; labels for every unit cost are type-enforced in `UNIT_COST_LABELS`.
- The engine's goldens live in `scripts/verify-scope-pricing.ts` (tracker V2: `node:assert/strict`, run with `npx tsx scripts/verify-scope-pricing.ts`, type-checked by `pnpm tsc`). It asserts every value this work changes (MPU 3,200 / 4,000, the 1,500 / 3,000 paint edges, `garageSqFt`, a finite-and-non-negative sweep over every formula) and must be updated in the same change; `pnpm tsc` fails otherwise.

## The owner's decisions (verbatim intent, numbers as agreed)

### Exterior paint

| Band | Home sq ft | CoolLife cost → price @3.5 | Water cost → price @3.5 |
|---|---|---|---|
| Small | ≤ 1,350 | $6,560 → $22,960 | $4,430 → $15,505 |
| Average | 1,350 – 1,800 | $7,140 → $24,990 | $4,990 → $17,465 |
| Large | 1,800 – 3,000 | $7,720 → $27,020 | $5,570 → $19,495 |
| Custom | > 3,000 | no formula price; the rep enters the price | same |

- **Garage** is yes/no. Cost **+$485** (≈ $1,700 on the price). The garage square footage input goes away; the band comes from home square footage alone.
- **Storeys**: cost **+$1,000 per storey above the first** (owner: "$6,000 → $7,000"), read from the existing job-level `numStories`. About +$3,500 on the price per storey at 3.5.
- Scope default multiplier **3.5**.

Band edges (my call, owner to confirm by reading): a house exactly on an edge takes the lower band (1,350 is small, 1,800 is average, 3,000 is large). Only above 3,000 is custom.

### MPU

- Costs **$4,500** (no relocation) / **$5,500** (relocation). Scope default multiplier **2.5** → $11,250 / $13,750.

### Multipliers

- Scope defaults are an Admin-configured value: `multiplier.byScope`, keyed by pricing key (= scope), initially `{ installExteriorPaint: 3.5, mpu: 2.5 }`. A scope with no entry uses `multiplier.default` (2.8).
- The agent can override the multiplier **per line** (agent-only) and **job-wide** (the existing control). **The job-wide control is a shift, not a replacement** (owner ruling 2026-11-06, after the builder check showed that one replacing number undoes the per-scope spread the moment the agent touches the target price): it reads as a multiplier and rests at 2.8; set to `m`, every line without its own override moves by `m − default` (paint 3.5 → 3.55 at 2.85, MPU 2.5 → 2.55, a 2.8 scope → 2.85). The target-price solver solves for that one shift, so the spread between scopes is preserved. Lines the agent pinned individually stay pinned.

## Design

### Config (`schemas/config.ts`, `constants/config-defaults.ts`, `constants/unit-cost-labels.ts`)

- `unitCosts.exteriorPaintSiding`: keep the six paint costs (new values above); add `garage: 485` and `dollarPerAdditionalStory: 1000` (same name the roof trade uses). Labels: "Garage (add-on)", "Dollar per Additional Story".
- `unitCosts.electricals`: `mpuBase: 4500`, `mpuWithRelocation: 5500`.
- `exteriorPaintTiers` becomes three ascending edges: `{ smallMaxSqFt: 1350, averageMaxSqFt: 1800, largeMaxSqFt: 3000 }`, refined ascending. (Replaces `smallBelowSqFt` / `largeAboveSqFt`; the old names encoded two bands.)
- `multiplier`: `{ default: 2.8, floor: 2, byScope: Partial<Record<PricingKey, number>> }`; refine every `byScope` value ≥ floor as `default` already is.

### Variables (`constants/variables.ts`)

- Remove `garageSqFt`. Add `garageIncluded: { trade: 'exteriorPaintSiding', label: 'Garage included?', kind: 'boolean', unit: null, default: false }`.
- `homeSqFt` and `paintType` unchanged.

### Formulas

- `compute` may now return `number | null`. `null` means "this formula has no price for these inputs; the rep prices it" (the custom band). The `ComputeFn` return type widens accordingly; every other formula still returns a number.
- `installExteriorPaint`: variables `['paintType', 'homeSqFt', 'garageIncluded']`. Band from `homeSqFt` against the three edges; `> largeMaxSqFt` → `null`. Otherwise `bandCost + (garageIncluded ? costs.garage : 0) + (context.numStories − 1) × costs.dollarPerAdditionalStory`.
- `mpu`: unchanged code; new costs.

### Form (`schemas/form.ts`, `lib/create-quote-line.ts`)

- A formula line gains two nullable fields: `multiplier` (agent's line override, `min(floor)`, so `formulaLineSchema` moves inside `createScopePricingFormSchema(multiplierFloor)`) and `price` (the rep's price for a custom line, `min(0)`). Both default to `null` in `createFormulaLine`; `duplicateLine` copies them.

### Engine (`lib/price-quote.ts`, `lib/solve-multiplier.ts`, `types/index.ts`)

- `QuoteLineInput` (formula) carries `multiplier?: number | null` and `price?: number | null`.
- Per formula line: `scopeDefault = byScope[pricingKey] ?? default`; `shift = (overrides.multiplier ?? default) − default`; `multiplier = max(floor, line.multiplier ?? scopeDefault + shift)`. A line override is absolute and ignores the shift.
- Compute `null`: if `line.price` is a finite number ≥ 0 the line is `priced` with `cost: null` (uncosted, exactly like a manual line; no multiplier applies); otherwise `incomplete` with `needs: []` and a new `reason: 'custom'` so the UI can say why. The existing `'Needs a price'` text is the fallback.
- `PricedLine` gains `multiplier: number | null` (null for uncosted lines) so the agent panel can show each line's applied multiplier.
- `QuoteResult.multiplier` keeps meaning the job-wide control's value (`overrides.multiplier ?? default`), which the control displays; the shift is derived from it, never stored.
- Permit lines use `default + shift` (they have no scope default of their own).
- `solveMultiplier` solves for the shift. Lines with their own override are **fixed**. Over the solvable costed lines `i` (scope default `d_i`, cost `c_i`): `exact = default + (target − uncostedPrice − fixedLinesPrice − Σ c_i·d_i) / Σ c_i`, which is the job-wide value that hits the target; `below-floor` when any solvable line would land under the floor (report the floor-clamped total as today); `no-cost` when no solvable cost remains. `achievedTotal` is still re-priced at the solved value, since per-line rounding and clamping can move it.

### Agent panel (`ui/components/agent-panel/`)

- **Job-wide multiplier control**: same widget, now a shift. It rests at 2.8 and `+`/`−` step it by `MULTIPLIER_STEP` from its own value as today (every line moves by the same step). Its description lists the scope defaults present in the quote (for example "Floor 2.0 · default 2.8 · paint 3.5 · MPU 2.5") and, when shifted, says so ("+0.05 on every line"). The lower bound stays the floor (shifting below it would clamp every line to the floor anyway).
- **New `LineMultipliersList`**: one row per costed formula line: label · cost → price · a `NumberField` bound to `lines.{i}.multiplier` (step `MULTIPLIER_STEP`, min floor, placeholder = the multiplier that applies without an override) · "Back to default" link when set. Sits between the target-price control and the unit costs. Custom and manual lines do not appear (no multiplier applies).
- **Unit costs list**: unchanged; the two new paint costs appear through the label map.

### Homeowner-facing line card (`ui/components/formula-line-card.tsx`, `ui/components/line-price.tsx`)

- Variables render as today: paint type, home square footage, garage switch.
- When the result is `incomplete` with `reason: 'custom'`, the card shows a price field bound to `lines.{i}.price` (reuse whatever `ManualLineCard` uses) and the line price text reads "Over 3,000 sq ft, enter a price". Once priced, the line shows its price like any other. No multiplier, cost or band name is visible.

### Goldens (`scripts/verify-scope-pricing.ts`, the existing V2 script; no new test files, no `package.json` change)

- Replace the old paint and MPU goldens and the `exteriorPaintTiers` literal with the new ones; the finite-and-non-negative sweep skips (or asserts `null` for) the paint formula above 3,000 sq ft.
- Paint: each band × each paint type prices to the table above at the scope default; edges (1,350 / 1,800 / 3,000) fall in the lower band; 3,001 is custom and incomplete until priced, then priced uncosted; garage adds ≈ $1,698; two storeys add $3,500.
- MPU: $11,250 / $13,750.
- Precedence: a line override is absolute and beats everything; the job-wide value shifts every unpinned line by `m − 2.8` (paint 3.5 → 3.55 and MPU 2.5 → 2.55 at 2.85); a scope with no `byScope` entry sits at 2.8 + shift; any result below the floor prices at the floor.
- Solver: paint + roof at their defaults, target = the current total → the solved value is 2.8 and no line moves; a higher target shifts both lines equally; a pinned line stays fixed and the solver reaches the target through the others; `no-cost` when every costed line is pinned.
- `pnpm lint && pnpm tsc` clean.

### Tracker edits (`docs/plans/2026-09-26-sales-calculators-epic.md`)

- Add **R19** (this ruling, dated 2026-11-06): per-scope default multipliers now, the job-wide control as a shift, agent line override, paint bands/costs, MPU costs; supersedes D3's "wait for C2" and amends PR11 (the target solves for the shift).
- §3.6: "Default multiplier and multiplier floor" row gains "and per-scope defaults (paint 3.5, MPU 2.5)"; the paint thresholds row reads 1,350 / 1,800 / 3,000 with custom above; add an Agent-only row for the per-line multiplier override.
- §7 formula table: `installExteriorPaint` row reads the new variables and band rule; `mpu` costs.
- PR2's MPU figure and D6's historical note stay as history; add a one-line "superseded by R19" marker on D3 and PR2.

## Left to the builder

- Exact component for the custom price field (reuse the manual line's money input).
- Whether `reason` lives on `IncompleteLine` as an optional field or the UI derives it from `needs.length === 0` plus the formula; the spec only requires the "Over 3,000 sq ft" text.
- Row layout of `LineMultipliersList` within the sheet's width; the panel is agent-only so no homeowner design pass is needed, but it follows the existing panel's spacing.
