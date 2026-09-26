# Sales Calculators C0: port design

> **Status:** brainstormed with the owner section by section on 2026-09-25 and 26 (all parts approved). Written 2026-09-26. **Awaiting owner review of this document**; the implementation plan follows that review.
> **Epic tracker (requirements, decisions, metrics, interim register):** `docs/plans/2026-09-26-sales-calculators-epic.md`. This spec cites the tracker's stable IDs (R*, D*, O*, SP-*, PR*, UI*, V*, CF*, I*, B-*) and does not restate them.
> **Source:** the remodel-x app in `/home/olis-solutions/olis-v3/monorepo/turborepos-repos/olissolutions.com` (tracker §7 and §8).

## 1. Purpose and scope

C0 ports remodel-x's per-scope pricing formulas and the idea behind its unfinished "now vs future" calculator into tri-pros. The result is two standalone, homeowner-facing calculators at `/dashboard/calculators`:

- **Scope Pricing** prices a quote of one or more scopes from the rep's measurements.
- **Savings Projection** shows what the homeowner saves, and how their home value and net worth change, over a horizon of years.

Porting is the deliverable (R8). Remodel-x's formulas and Unit Costs carry over exactly. Only the defects listed in tracker §6 are fixed. Every choice we already know is temporary is marked in the code and listed in the tracker's interim register (§5).

**In scope:**
- both calculation engines, with their settings, schemas and verify scripts
- the page, the sidebar entry and the tabs shell
- the two calculator UIs and the agent panel
- the glossary entries for the new terms
- updates to the tracker

**Out of scope:**
- saving anything, and any database, tRPC or `app_settings` work (O4, CF6 → C2)
- linking to the Notion catalog (C1)
- prefilling from a customer (C3)
- proposal pricing (C4)
- any link between the two calculators: they are fully independent in C0 (owner, 2026-09-26)
- percentage-based bill reductions (D8)
- per-trade multipliers (D3)

**Data access:** C0 is a UI-and-pure-code build. It makes no backend change and no database change, and the owner has nothing to run.

## 2. Names (D1, owner 2026-09-26)

**Savings Projection**, **Scope Pricing**, **Formula**, **Unit Cost** and **Pricing Key** are the one name each concept has in UI copy, code, docs and conversation. "Snapshot" is not used (it is a reserved term). Existing terms are reused as they are: Scope, Trade, Variable, Cost, Price, Multiplier, TCP. The four configuration tiers are **On-screen**, **Agent-only**, **Admin-configured** and **System default** (R9).

**Pricing Key** names the remodel-x accessor that keys a Formula in C0 (I2). It is proposed here and needs the owner's sign-off.

## 3. Layout: two sub-features

The owner's direction (2026-09-26): each calculator is its own directory under the feature. The two sub-features never import from each other, and only the tabs shell knows both exist.

```
src/app/(frontend)/dashboard/calculators/page.tsx      await protectDashboardPage() → <CalculatorsView/>

src/features/calculators/
  constants/query-parsers.ts                           CALCULATOR_TABS = ['scope-pricing', 'savings-projection'] as const; calculatorTabParser (nuqs, default 'scope-pricing')
  ui/views/calculators-view.tsx                        tabs shell; renders the two sub-feature views

  scope-pricing-calculator/
    constants/config-defaults.ts                       System defaults for every Admin-configured pricing value (I3)
    constants/variables.ts                             Variable definitions by trade, `as const`
    schemas/config.ts                                  scopePricingConfigSchema (CF1)
    schemas/form.ts                                    scopePricingFormSchema
    lib/resolve-config.ts                              resolveScopePricingConfig(): ScopePricingConfig (CF2)
    lib/define-formula.ts                              defineFormula(...)
    lib/formulas/{roof,solar,hvac,windows,insulation,hardscape,electrical,exterior-paint}.ts
    lib/formula-registry.ts                            FORMULAS satisfies Record<PricingKey, Formula>
    lib/price-quote.ts                                 priceQuote(...)
    lib/solve-multiplier.ts                            solveMultiplier(...)
    hooks/use-scope-pricing-quote.ts
    types/index.ts
    ui/components/…                                    one component per file; agent panel under ui/components/agent-panel/
    ui/views/scope-pricing-calculator.tsx

  savings-projection-calculator/
    constants/config-defaults.ts                       System defaults for the Admin-configured savings values (I3, I4)
    schemas/config.ts                                  savingsProjectionConfigSchema (CF1)
    schemas/form.ts                                    savingsProjectionFormSchema
    lib/resolve-config.ts                              resolveSavingsProjectionConfig(): SavingsProjectionConfig (CF2)
    lib/project-savings.ts                             projectSavings(...)
    hooks/use-savings-projection.ts
    types/index.ts
    ui/components/…
    ui/views/savings-projection-calculator.tsx

src/shared/lib/loan-calculations.ts                    + remainingBalance(...)   (owner-approved shared-file edit)
scripts/verify-scope-pricing.ts, scripts/verify-savings-projection.ts
```

**Rules** (tracker V5, O5):
- One component per file, named exports.
- `hooks/` holds only `use-*`.
- No module-level constants inside components.
- `schemas/` sits next to `lib/`.
- Nothing under either `lib/` imports React, tRPC, the DB, `next/*` or the other sub-feature.
- The page imports only `ui/views/calculators-view.tsx`.
- Each sub-feature has its own settings slice. In C2, each gets its own `app_settings` row, and only its `resolve-config.ts` changes.

**Tracker amendments:** CF1 now reads "one typed config schema **per calculator**". UI2's parser path is `features/calculators/constants/query-parsers.ts`. I1's path is the two sub-feature `lib/` directories.

## 4. Settings (R9, CF1–CF3)

Each calculator declares a Zod config schema. Its `config-defaults.ts` exports a value that `satisfies` the inferred type. `resolve-config.ts` returns that value, and a why-comment on it says the Admin-configured source arrives in C2 (I3).

The engines take the resolved config as a plain argument. Session overrides (On-screen and Agent-only) live in react-hook-form state and are never persisted.

### 4.1 `ScopePricingConfig` (Admin-configured, System defaults from tracker §7.2)

```ts
{
  unitCosts: {
    roof:        { BSQTearOffFlat: 530, BSQTearOffShingles: 480, BSQTearOffTile: 750, BSQRedeckFlat: 650, BSQRedeckPitched: 700,
                   BSQTileReset: 580, BSQOverlayPitched: 420, BSQOverlayFlat: 420, dollarPerAdditionalStory: 25, dollarPerAdditionalLayer: 25 },
    solar:       { dollarPerWatt: 3.5, dollarPerPanelRnr: 225, battery5kWh: 6000, battery10kWh: 11000 },
    hvac:        { threeTonRnr: 8500, furnace36kBTURnr: 7000, miniSplits: 3000, perTonStep: 800 },
    windows:     { windowSmall: 550, windowLarge: 650, slidingDoorStandard: 2500, slidingDoorSpecial: 3000, frenchDoor: 5000 },
    insulation:  { dollarPerSqFtTopOff: 1.3, dollarPerSqFtRnr: 2.5, dollarPerSqFtCrawlSpace: 2.3 },
    hardscape:   { dollarPerSqFtArtificial: 7, dollarPerSqFtGravel: 6, dollarPerSqFtMulch: 5, dollarPerSqFtConcrete: 11, dollarPerSqFtPavers: 11, dollarPerSqFtDg: 5 },
    electrical:  { mpuBase: 3200, mpuWithRelocation: 4000 },
    exteriorPaint: { coolLifePaintSm: 6000, coolLifePaintAvg: 7000, coolLifePaintLarge: 8500, waterPaintSm: 4000, waterPaintAvg: 5000, waterPaintLarge: 6500 },
  },
  exteriorPaintTiers: { smallBelowSqFt: 1500, largeAboveSqFt: 3000 },
  permitFees: { roof: { amount: 250, enabled: false }, hvac: { amount: 250, enabled: false } },
  multiplier: { default: 2.8, floor: 2.0 },
  taxRatePercent: 7.5,
}
```

- Schema bounds: every Unit Cost ≥ 0; `floor` > 0; `default` ≥ `floor`; `taxRatePercent` from 0 to 20; `smallBelowSqFt` < `largeAboveSqFt`.
- `mainPanelTrade` ($2,800) is not carried over (D6).
- Trade groups use tri-pros words (`insulation`, `hardscape`, `electrical`, `exteriorPaint`). The comment on `config-defaults.ts` names the remodel-x trade each one came from.

### 4.2 `SavingsProjectionConfig` (Admin-configured, System defaults from D4)

```ts
{
  defaultHorizonYears: 5,
  defaultRatesPercent: { homeAppreciation: 4, electric: 9.4, gas: 13.1, water: 10.3, gardening: 5, misc: 0 },
}
```

- The five named rates are remodel-x's defaults, carried over exactly. The source cites nothing for them (I4).
- `misc` had no rate in the source. Its System default of 0 keeps misc costs flat, and the input's label says so.

## 5. Scope Pricing engine

### 5.1 Variables (PR1, PR7, D5)

`constants/variables.ts` declares each Variable once, `as const`. Each Variable has a `key`, `label`, `kind` (`number | select | boolean`), `unit` (`BSQ | count | W | kWh | tons | sqft | null`), `min`/`max` for numbers, `options` for selects, and an optional `default`.

- **Default:** a Variable has a default exactly when the source destructured one.
- **Required:** a Variable without a default is required. A line missing a required value is *incomplete* (§5.4).
- **Bounds:** the `min`/`max` values are new, System defaults that guard against absurd input.

| Trade | Key | Kind / unit | Bounds / options | Default |
|---|---|---|---|---|
| roof | numFlatBSQ | number, BSQ | 0–200 | 0 |
| roof | numPitchedBSQ | number, BSQ | 0–200 | 0 |
| roof | numLayers | select | 1, 2, 3 | 1 |
| solar | numPanels | number, count | 0–200 | 0 for `rnrPanels`; required for `installPanels` (declared per Formula, §5.2) |
| solar | wattsPerPanel | number, W | 100–700 | required |
| solar | numBatteries | select | 0, 1, 2, 3 | 0 |
| solar | kWhPerBattery | select, kWh | 5, 10 | 5 |
| hvac | systemTonnage | select, tons | 1–5 in 0.5 steps | 3 |
| hvac | numMiniSplits | select, count | 1–8 | 1 |
| windows | numSmallWindows, numLargeWindows, numStandardSliders, numSpecialSliders, numFrenchDoors | number, count | 0–100 | 0 |
| insulation | sqft | number, sqft | 0–10,000 | required |
| hardscape | installSqFt | number, sqft | 0–20,000 | required |
| electrical | relocationRequired | boolean | — | false |
| exteriorPaint | paintType | select | `coolLife`, `water` | required |
| exteriorPaint | homeSqFt, garageSqFt | number, sqft | 0–20,000 | required |

**Project context** is one set of values per quote, On-screen:
- `stories`: select 1–4, default 1. The source used `numStories || 1`.
- `currentRoofType`: select `shingle | tile`, default `shingle`. The source used `roofType || "shingle"`. D5 limits the choice to these two (I9).

**Not collected (I10):** desiredRoofType, percentFreeDeckReplacement, inverterType, currentRoofType as a line Variable, the insulation types, demoSqFt, and replaceDucts.

### 5.2 Formulas (PR3–PR5)

```ts
defineFormula({
  key,                    // PricingKey (I2)
  trade,                  // one of the §4.1 trade groups
  label,                  // homeowner-facing scope name, e.g. 'Roof tear-off'
  variables: [...keys],   // the Variables this Formula reads: the only source for its form fields and its argument type (PR4)
  defaults?: {...},       // per-Formula default overrides (e.g. numPanels = 0 for rnrPanels)
  compute: (vars, context, unitCosts) => number,  // Cost in dollars
})
```

- **Typing.** `vars` is typed exactly from the declared keys. A select becomes the union of its literal options, a number becomes `number`, and a boolean becomes `boolean`. This is the source's `ExtractFormulaVariables` idea, applied to the declared keys instead of the whole trade.
- **Arguments.** `compute` receives only the unit costs of its own trade, plus `context`.
- **Registry.** `formula-registry.ts` collects all 24 Formulas into `FORMULAS`, which `satisfies Record<PricingKey, Formula>`. `PricingKey` is the union of the 24 keys, so every key has exactly one Formula (PR5).
- **Logic.** Each `compute` body is the remodel-x logic in tracker §7.1, carried over exactly, with three changes:
  - Hidden literals become named Unit Costs: `perTonStep`, `mpuBase`, `mpuWithRelocation`.
  - Tear-off prices a pitched roof by `context.currentRoofType`, which is now always `shingle` or `tile`.
  - Exterior paint reads its tiers from `config.exteriorPaintTiers`.
- **Not carried over.** The eight stubs in tracker §7.1 are priced through manual lines.
- **Interim comment.** The registry file carries a why-comment for I2: keys are remodel-x accessors until Notion scopes have stored slugs.

### 5.3 Pricing math (PR8, D2, D3, CF4)

For each **formula line**:
- `cost = compute(...)`, rounded to whole dollars
- `price = round(cost × multiplier)`
- `tax = round(price × taxRatePercent / 100)`, where tax is **included** in the price (D2, I5)
- `base = price − tax`

For each **manual line**, the rep types the Price and nothing else:
- `cost = null`
- `tax = round(price × taxRatePercent / 100)`, also included in the Price
- `base = price − tax`

Each **enabled permit fee** is added once per trade present in the quote. It appears as its own derived line, labeled "Permit (Roof)" or "Permit (HVAC)", with `cost = amount` priced like a formula line.

`multiplier` = `overrides.multiplier ?? config.multiplier.default`, clamped to at least `config.multiplier.floor`. Both the schema and the engine enforce the floor.

**Totals:**
- `totalPrice = Σ price`
- `totalTax = Σ tax`
- `totalCost = Σ cost` over lines with a cost
- `margin = Σ price(costed lines) − totalCost`
- `effectiveMultiplier = Σ price(costed lines) ÷ totalCost`, or null when `totalCost` is 0
- `tier = getMultiplierTier(effectiveMultiplier)`

The panel displays the multiplier with `formatMultiplier`. It also gets `hasUncostedLines`, which drives its "no cost data" note.

**Target price** (PR11):

`solveMultiplier(targetTotal, quote)` returns `m = (targetTotal − Σ price(manual lines)) ÷ totalCost` and clamps it to the floor. It returns one of three results:
- `{ status: 'reached', multiplier, achievedTotal }`
- `{ status: 'below-floor', multiplier: floor, achievedTotal }`
- `{ status: 'no-cost', … }` when `totalCost` is 0

`achievedTotal` is recomputed from the rounded line prices, so the panel shows what was actually achieved.

### 5.4 Quote API

```ts
priceQuote({ lines, context, config, overrides }): QuoteResult
```

- A line is `{ id, kind: 'formula', pricingKey, variables }` or `{ id, kind: 'manual', label, price }`.
- A formula line whose variables fail its Formula's Zod schema (built from the declared Variables and their bounds) comes back as `status: 'incomplete'` with the missing or invalid keys. It is left out of totals and is **never** priced (B-P1, PR12).
- The result carries every line in its input order, followed by the derived permit lines.

## 6. Savings Projection engine

`projectSavings(input, config): SavingsProjection` is pure. Rates arrive as whole percents, and the function divides by 100 in exactly one place.

### 6.1 Input (SP-I1…I8)

- `homeValue`
- `liabilities[]`: `{ label, balance, monthlyPayment, aprPercent: number | null }`
- `billsNow`: `{ electric, gas, water, gardening, misc }`, monthly
- `billsAfter`: the same five fields, monthly. Misc is included, which the source lacked.
- `project`:
  - `price`, `incentives`, `downPayment`
  - `aprPercent`, `termMonths`
  - `uplift`: `{ mode: 'amount' | 'percentOfPrice', value }`, default `{ 'amount', 0 }`
- `assumptions`: `{ horizonYears (1–30), ratesPercent: { homeAppreciation, electric, gas, water, gardening, misc } }`

The rates and horizon default from config and stay On-screen.

### 6.2 Math (SP-M1…M9)

Let `N` = the horizon in years and `t` = 0…N.

- **Loan principal:** `L = max(0, price − incentives − downPayment)`
- **Monthly loan payment:** `m = amortizedMonthlyPayment(L, aprPercent, termMonths)`
- **Uplift:**
  - `U = value` in `amount` mode
  - `U = price × value / 100` in `percentOfPrice` mode
- **Home value:**
  - before: `V(t) = homeValue × (1 + a)^t`
  - after: `V'(t) = (homeValue + U) × (1 + a)^t`
- **Bills in year t:** `12 × bill × (1 + g)^t` for each category and each scenario.
- **Cumulative bills to year t:** `12 × bill × ((1+g)^t − 1)/g`, or `12 × bill × t` when `g = 0`.
- **Project cash paid to year t:** `downPayment + m × min(12t, termMonths)`
- **Remaining project loan at t:** `remainingBalance(L, aprPercent, termMonths, min(12t, termMonths))`
- **Remaining liability at t:**
  - `remainingBalance(balance, apr, n, 12t)`, where `n` is the months the given payment takes to retire the balance at that APR, derived once
  - without an APR, the balance is held flat (D7, I7), and the projection labels it "held at today's balance"
  - liability payments are identical before and after, so they cancel out of the savings
- **Net worth:**
  - before: `NW(t) = V(t) − Σ remaining liabilities`
  - after: `NW'(t) = V'(t) − Σ remaining liabilities − remaining project loan`
- **Cumulative savings:** `S(t) = Σ cumulative bills before − (Σ cumulative bills after + project cash paid)`
- **Net benefit:** `B(t) = S(t) + (NW'(t) − NW(t))`

  This is total wealth (cash plus net worth), and it counts each loan payment exactly once. A payment lowers cash, and its principal portion lowers the liability. So borrowing adds only its interest to the cost, and the project price itself counts in full unless bill savings and uplift offset it.
- **Break-even year:** the first `t` in 1…N with `B(t) ≥ 0`. If none, `null` ("not within N years").
- **Monthly now:**
  - before: `Σ billsNow + Σ liability payments`
  - after: `Σ billsAfter + Σ liability payments + m`

**Output:**
- `years[]`, for t = 0…N: `{ t, homeValueBefore, homeValueAfter, cumulativeCostBefore, cumulativeCostAfter, netWorthBefore, netWorthAfter, netBenefit }`
- `summary`: `{ monthlyBefore, monthlyAfter, monthlyDifference, cumulativeSavings: S(N), valueGained: V'(N) − V(N), netBenefit: B(N), breakEvenYear, projectMonthlyPayment: m }`

### 6.3 Shared helper (owner-approved)

`remainingBalance(principal, annualRatePercent, termMonths, monthsPaid)` goes into `src/shared/lib/loan-calculations.ts` beside `amortizedMonthlyPayment`, following the same percent convention:
- 0% APR: `principal × (1 − monthsPaid/termMonths)`
- otherwise: the amortization identity `P(1+r)^k − m((1+r)^k − 1)/r`
- the result is clamped to `[0, principal]`, and `monthsPaid ≥ termMonths` gives 0

For liabilities, `n` comes from the standard term-from-payment formula. When the payment does not exceed the monthly interest, the balance is treated as never shrinking and held flat.

## 7. UI

The flow, as approved in the brainstorm:

- **Who:** a rep in the living room with a tablet. The homeowner watches most of the time.
- **Most common scenario:** "I measured the roof and panels; now I show what tear-off + solar costs."
- **Other scenarios:**
  - negotiating in the agent panel
  - running the savings conversation
  - trimming scopes
  - questioning assumptions together

### 7.1 Scope Pricing

- **Focal point:** the grand total, labeled "Your price" with an "includes tax" note.
- **Layout:**
  - Project context (stories, roof type) sits once at the top.
  - The quote is a list of lines. Each line shows the scope name, its few Variable fields (rendered from the Formula's declaration, UI5), and its Price, or "needs …" when it is incomplete.
- **Adding scopes:**
  - "Add scope" opens a searchable picker grouped by trade.
  - "Manual price line" is the last option in the picker.
- **Line actions:** duplicate and remove.
- **Wording:** "Price" is the only money word on the homeowner screen.

### 7.2 Agent panel (O2, CF4, CF5)

- **Opening:** a small, plain icon button opens a side sheet. It closes when the rep taps outside it, and it never moves the main layout.
- **Contents:**
  - Cost, margin, effective multiplier with its tier
  - tax and base
  - the multiplier control, stepping in 0.05 and never going below the floor
  - target price, with its reached / below-floor / no-cost states
  - read-only Unit Costs for the trades in the quote
  - the "no cost data" note when manual lines exist
- **Containment:** nothing Agent-only appears anywhere else, or in the URL.

### 7.3 Savings Projection

- **Focal point:** cumulative savings over N years, plus the break-even year.
- **Below that:**
  - the four cards (now / in N years × before / after)
  - a recharts chart of cumulative cost before vs after by year
- **Inputs** are grouped in plain-language steps: home & loans → bills now → bills after → the project → assumptions.
- **Assumptions** are visible and editable on screen (SP-O4). Rates are labeled "%/yr", and bills "/mo".
- **Copy:** none of the source's marketing claims appear (O8).

### 7.4 Both calculators

- **Forms:** react-hook-form + `zodResolver`. Computed values are derived through the hooks and never written back into the form (UI6).
- **Buttons:** every non-submit button is `type="button"` (UI7).
- **Number inputs:** they use `NumberField` (UI4).
- **Touch:** targets are at least 44 px.
- **Sizes:** tablet first, and usable on a phone and a laptop.
- **Visual direction** is chosen at build time (§9 step 5).

## 8. Verification

- **V1:** `pnpm tsc` and `pnpm lint` pass on every commit.
- **V2 and V3:** `scripts/verify-scope-pricing.ts`, using `node:assert/strict` and run with `npx tsx`. It covers:
  - one golden case per Formula, taken from the source logic. Example: `installPanels` with 20 × 400 W → Cost 28,000 → Price 78,400 → tax 5,880 → base 72,520.
  - the fixed defects:
    - `installDg` prices instead of returning NaN
    - `replaceFrenchDoors` is nonzero
    - a 10 kWh battery uses `battery10kWh`
    - an unselected required Variable → `incomplete`
  - an exhaustive sweep over every select option and the min/max of every number, with no NaN, negative or undefined result
  - floor clamping
  - `solveMultiplier`'s three outcomes
  - manual lines left out of margin
  - a permit line only when enabled
- **V4:** `scripts/verify-savings-projection.ts`. It covers:
  - $1,000,000 at 4% over 5 years → $1,216,653
  - cumulative bills at g = 0 and g > 0
  - `m` matching `amortizedMonthlyPayment`
  - `remainingBalance` at k = 0 → principal and k = n → 0
  - 0% APR
  - a liability held flat without an APR
  - break-even found and not found
  - the accounting identity: with `billsAfter = billsNow` and no uplift, `B(N) = −(price − incentives + interest paid to N)`; with 0% APR and full payoff within N, `B(N) = −(price − incentives)`
- **V6:** a Playwright check, authenticated through `/api/dev/playwright-session`. The default render of each tab contains none of "Cost", "Multiplier", "Margin", or any Unit Cost figure. The panel's contents appear only after it opens.
- **Browser smoke by the owner:** M4, a roof + solar + windows quote in under 2 minutes on a tablet.

## 9. Build order

Steps 1–4 land before any UI decision. Step 5 is the one owner pause.

1. `remainingBalance` in `loan-calculations.ts`, with cases added to `verify-savings-projection.ts`.
2. Scope Pricing engine: config schema and defaults, resolver, Variables, `defineFormula`, the 24 Formulas, registry, `priceQuote`, `solveMultiplier`, and `verify-scope-pricing.ts`.
3. Savings Projection engine: config, resolver, `projectSavings`, and `verify-savings-projection.ts`.
4. The route, `APP_ROOTS.dashboard.calculators`, the sidebar entry (`get-sidebar-nav.ts`, gated on `access Dashboard`), the tab parser and the tabs shell, with placeholder views.
5. `/ui-warmup` for both calculators → **the owner picks a direction.**
6. Scope Pricing UI.
7. Agent panel.
8. Savings Projection UI.
9. The three-skill audit (ui-ux-pro-max → web-design-guidelines → impeccable), then the V6 Playwright check.
10. Glossary entries in `docs/ubiquitous-language.md` for the §2 names, and tracker updates: ticks, the §3 amendments, and an I-row audit (M6).

## 10. Interim markers (R8, O6)

Each of these sites carries a one-line why-comment giving the reason, with no citation:

| Site | Marker |
|---|---|
| each `resolve-config.ts` | I3 |
| `savings-projection-calculator/constants/config-defaults.ts` | I4 (unsourced rates) |
| `price-quote.ts` tax line | I5 |
| the context fields' schema | I6 |
| the liability remaining-balance branch | I7 |
| `calculators-view.tsx` | I8 (nothing persisted) |
| `formula-registry.ts` | I2 |
| the `currentRoofType` options | I9 |
| `variables.ts` | I10 (SOW-only inputs not collected) |
| the two `lib/` directories | I1 (the engines' permanent home is decided later) |
