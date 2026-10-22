# Proposal Energy Impact: Foundation Implementation Plan (EI0–EI2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land everything the energy impact chapter stands on: the construction bill-cut slice on main (EI0), the pure energy model with goldens (EI1), and the customer's utility bills with a share-link write (EI2).

**Architecture:**
- **EI0** copies the finished construction slice from `feat/trade-scenes-foundation` onto main as one commit built from file contents.
- **EI1** extends that slice in `src/shared/modules/construction/core` with:
  - HVAC partials and the radiant barrier add-on;
  - bill-cutting scopes keyed by catalog scope id;
  - one yearly bill loop that the Remodel ROI calculator and the proposal both call;
  - utility rates and EPA factors;
  - `projectEnergyImpact`.

  A verify script checks it all, including a cross-check against the calculator.
- **EI2** adds a 1:1 child table `customer_utility_bills` under the customer. It follows ADR-0005's 2026-07-14 amendment and copies `customer_profiles`:
  - a sub-entity spec under the customer, named `utilityBills` for permissions;
  - writes through `upsertOneToOne`;
  - a flattened left join in `getFullView`.

  One proposal-shareable mutation writes only that table. The customer is resolved from the proposal, never from a client-sent id.

**Tech Stack:** TypeScript, zod 4, Drizzle (Neon Postgres), tRPC, CASL, `node:assert/strict` verify scripts run with `npx tsx`, `node:test` run with `pnpm exec tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-20-proposal-energy-impact-design.md`. The live tracker `docs/plans/2026-10-21-proposal-energy-impact-epic.md` holds:
- rulings EI-D1–D22;
- the scope ids (§3.2) and the rates (§3.3);
- the lift recipe (§3.1).

The stress test of 2026-10-21 led to EI-D19–D22 and this revision.

**Out of this plan:**
- EI3 (shared charts) and EI5 (the chapter) depend on EI4, the `/ui-exploration` of the chapter; they get their own plan after the owner picks a direction.
- EI6 is a calculator follow-up.
- The chapter's label and its accessor stay with EI4.

## Global Constraints

- **Verification:**
  - Every task ends with `pnpm tsc`, `pnpm lint` and `pnpm theme:check` passing; the pre-commit gate runs the same three.
  - `npx tsx scripts/verify-remodel-roi.ts` keeps passing from Task 1 on, because the calculator's numbers must not move (C2).
  - Never `pnpm build`.
- **Database:**
  - Schema goes to the dev DB only, with `pnpm db:push:dev`. Prod is pushed by the owner.
  - **Prod gate (EI-D19):** `pnpm db:push:prod` must run before any commit from Task 7 on reaches `origin/main`. `getFullView` joins the new table, so without it every prod proposal page fails.
  - No DB writes for testing: never seed or update rows, dev included.
- **Git:**
  - Stage exact files with one `git add <files>` call. Then commit with a separate call that **starts with** `git commit -m … -- <same files>`. The pre-commit gate only fires on a command starting with `git commit`, and its timeout is fixed at 120 s.
  - Never add a folder.
  - The index already holds someone else's staged deletions (`docs/superpowers/plans/2026-10-01-proposal-page-redesign.md`, `docs/superpowers/specs/2026-10-01-proposal-page-design.md`). Never include them.
  - `CONTEXT.md` § Energy impact terms ships in the docs commit before Task 1. No task edits `CONTEXT.md`.
  - Never stash, switch branches, reset or amend.
  - The only branch read allowed is Task 1's pathspec checkout (`git checkout feat/trade-scenes-foundation -- <path>`).
  - Never edit `.worktrees/trade-scenes`. Another session owns it.
- **Code style:**
  - Comments say why, never what.
  - External constants (utility rates, EPA factors) carry their source URL in a comment.
  - No file banners, and no citations of plans or specs in code.
  - One thing per file, named exports, and the module's `constants/`, `lib/`, `schemas/` layout. `lib/` files are `verb-noun.ts`.
- **Vocabulary (EI-D22, `CONTEXT.md` § Energy impact terms):**
  - **bill cut**: a trade's or add-on's share off a bill.
  - **bill-cutting scope**: a scope that makes its trade's bill cut count. Never "qualify" or "qualifying"; those mean program eligibility.
  - **electric utility**: LADWP or SCE. The code name is `electricProvider`, matching the `electricProviders` enum. Never "provider" alone in copy.
  - **utility bills**: the customer's monthly electric, gas and water bills.
- **Money:**
  - Stored bills are integer cents (`*_cents`, EI-D20).
  - The energy model works in dollars, because rates are per kWh, therm and gallon. Cents become dollars at the chapter's edge (EI5).
- **No solar:** not in any figure, fixture, example or copy.
- **Working numbers verbatim:**
  - **Cuts in percent** (tracker §3.2):
    - HVAC: electric 25, gas 20; ducts +5/+5.
    - Cool roof: electric 8.
    - Windows: electric 10, gas 8.
    - Attic insulation: electric 10, gas 15.
    - Radiant barrier: electric +5, gas +2.
    - Cool Life paint: electric 4.
    - Dryscaping: water 40.
  - **Rates** (§3.3):
    - SCE $0.344/kWh; LADWP $0.276/kWh.
    - SoCalGas $2.10/therm.
    - Water $0.017/gal.
  - **CO₂ factors** (§3.3):
    - 5.04e-4 t/kWh (CAMX); 0.0053 t/therm.
    - Gasoline 8.887e-3 t/gal; coal 9.00e-4 t/lb.
    - Tree seedling 0.060 t; forest acre 1.00 t/yr.
    - Mile 3.93e-4 t; smartphone charge 1.24e-5 t.
  - **Yearly growth:** electric 7.57, gas 9.1, water 8.9, gardening 5, misc 0 (%/yr).

## Review Focus

1. **Undashed ids.** An older SOW stores a scope id or a trade id undashed or in upper case. It still counts, exactly as the dashed id does (Task 3 tests).
2. **One trade, two scopes.**
   - A/C plus furnace, split system plus A/C, or insulation plus radiant barrier count the trade once, never twice.
   - A/C plus furnace together cut both bills (Task 3 and Task 6 tests).
3. **Bad bill values.** A bill that is 0, null, negative or NaN gives zero savings for that bill. Its kWh, therms and CO₂ are 0, never NaN (Task 6 test).
4. **Unknown utility.** An electric utility other than LADWP or SCE (for example `pg&e`), or none at all, is priced at the SCE rate and flagged `assumed`, so the chapter can name the assumption (Task 4 test).
5. **Over-wide writes.**
   - A share-link caller sends extra keys (`name`, `phone`, `customerId`) or an out-of-range bill. The write is rejected and nothing outside `customer_utility_bills` changes (Task 8 test).
   - A staff session without the `utilityBills` grant is refused (Task 8: rule grants plus `upsertOneToOne`'s per-column check).

---

### Task 1: EI0, land the construction slice from the scenes branch

**Files:**
- **Checkout from branch** (`git checkout feat/trade-scenes-foundation -- <path>`):
  - **Construction core** (`src/shared/modules/construction/core/`):
    - `constants/`: `trade-slugs.ts`, `bill-categories.ts`, `bill-cut-add-ons.ts`, `cut-modes.ts`, `repairs-per-year.ts`, `trade-bill-cuts.ts`
    - `lib/`: `combine-cuts.ts`, `cut-for.ts`, `resolve-trade-bill-cuts.ts`
    - `schemas/bill-cuts.ts`
  - **Shared lib:** `src/shared/lib/resolve-overridable.ts`
  - **Scripts:** `scripts/generate-trade-slugs.ts`, `scripts/verify-remodel-roi.ts`
  - **Calculator** (`src/features/calculators/remodel-roi-calculator/`):
    - `constants/`: `bill-colors.ts`, `config-defaults.ts`, `form-defaults.ts`, `form-options.ts`, `rates.ts`, `trades.ts`
    - `lib/`: `format-cuts.ts`, `panel-summaries.ts`, `project-remodel-roi.ts`, `resolve-config.ts`
    - `lib/story/`: `build-basis.ts`, `build-monthly.ts`, `build-today.ts`, `tag-for.ts`
    - `schemas/`: `config.ts`, `form.ts`
    - `types/index.ts`
    - `ui/components/charts/`: `bills-by-category-chart.tsx`, `monthly-breakdown-chart.tsx`
    - `ui/components/inputs-panel/`: `bill-row.tsx`, `bills-section.tsx`, `trade-row.tsx`, `trades-section.tsx`
    - `ui/components/story/assumptions-sheet.tsx`
- **Create:** `src/shared/modules/construction/core/types.ts`, taken from `git show a259011a3:src/shared/modules/construction/core/types.ts`.
- **Modify:** `src/features/calculators/remodel-roi-calculator/ui/components/story/story-canvas.tsx`. Keep main's version and change only the `BILL_CATEGORIES` import.
- **Delete** (`git rm`): `src/features/calculators/remodel-roi-calculator/constants/bill-categories.ts`, `src/features/calculators/remodel-roi-calculator/lib/combine-cuts.ts`. Every importer of these two files is in the checkout set or is `story-canvas.tsx`.
- **Modify:** `docs/plans/2026-10-21-proposal-energy-impact-epic.md`, §4 EI0 row.

**Interfaces:**
- **Produces**, used by every later task:
  - `TradeSlug`, `tradeSlugs`
  - `BillCategory`, `BILL_CATEGORIES`
  - `BillCutAddOnId`, `BILL_CUT_ADD_ON_IDS`, `BILL_CUT_ADD_ON_LABELS`
  - `TRADE_BILL_CUTS`
  - `TradeBillCuts`, `tradeBillCutsSchema`
  - `combineCuts({ trades, addOns }, category, cuts): { parts: CutPart[], combined: number }`
  - `cutFor(entry: BillEntry, parts, combined): BillCut`
  - `resolveTradeBillCuts(): TradeBillCuts`
  - `CutPart`, `BillEntry`, `BillCut`, `CutSource` (`core/types.ts`)
- **Known name clash, carried as-is from the branch:** the calculator keeps its own `CutSource` (`constants/trades.ts`, `TradeKey | BillCutAddOnId`). Don't rename it in this task.

- [ ] **Step 1: Preflight**

Run these from the repo root:

```bash
git log -1 --format=%h -- docs/superpowers/plans/2026-10-21-proposal-energy-impact-foundation.md
git diff --stat 47be8f8e3 feat/trade-scenes-foundation -- src/shared/modules/construction/core src/shared/lib/resolve-overridable.ts scripts/generate-trade-slugs.ts scripts/verify-remodel-roi.ts src/features/calculators
git diff --name-only aaaa40726 main -- src/features/calculators src/shared/modules/construction/core src/shared/lib/resolve-overridable.ts scripts/verify-remodel-roi.ts
git diff --cached --name-only
git status --short src/shared/modules/construction/core src/shared/lib/resolve-overridable.ts scripts/generate-trade-slugs.ts scripts/verify-remodel-roi.ts src/features/calculators/remodel-roi-calculator docs/plans/2026-10-21-proposal-energy-impact-epic.md
```

Expected:
- **First command:** prints a hash. The plan, spec, tracker and `CONTEXT.md` must be committed as a docs commit before Task 1. If nothing prints, stop and ask the owner to commit them.
- **Second command:** prints nothing. The branch tip moves (it was `f8d49b0de` on 2026-10-21), but the slice must not. If anything prints, stop and re-run tracker §3.1's analysis.
- **Third command:** exactly these five files. Any other calculator file means main gained an overlap: stop.
  - `contexts/story-ui-context.tsx`
  - `ui/components/story/chapter-rail.tsx`
  - `ui/components/story/headline-stats.tsx`
  - `ui/components/story/story-canvas.tsx`
  - `src/features/calculators/ui/views/calculators-view.tsx`
- **Fourth command:** only the two staged deletions named in Global Constraints.
- **Fifth command:** prints nothing. If it prints anything, stop and ask.

- [ ] **Step 2: Take the slice files**

Run `git checkout feat/trade-scenes-foundation -- <path>` for every "Checkout from branch" path. Then:

```bash
git rm src/features/calculators/remodel-roi-calculator/constants/bill-categories.ts src/features/calculators/remodel-roi-calculator/lib/combine-cuts.ts
git show a259011a3:src/shared/modules/construction/core/types.ts > src/shared/modules/construction/core/types.ts
```

Expected: `types.ts` declares exactly `CutSource`, `CutPart`, `BillEntry` and `BillCut`.

- [ ] **Step 3: Swap `story-canvas.tsx`'s import**

Change the `BILL_CATEGORIES` import to `@/shared/modules/construction/core/constants/bill-categories`. Then run:

```bash
git diff main -- src/features/calculators/remodel-roi-calculator/ui/components/story/story-canvas.tsx
```

Expected: a one-line import change.

- [ ] **Step 4: Verify**

Run `pnpm tsc`, `pnpm lint`, `pnpm theme:check` and `npx tsx scripts/verify-remodel-roi.ts`.

Expected: all pass. The verify script asserts the calculator's numbers to the last digit, including cool roof on = electric 8%.

- [ ] **Step 5: Tick the tracker**

In tracker §4, set EI0 to `[x]`. Leave the hash cell `—`; Task 2 fills it in.

- [ ] **Step 6: Commit (one content commit)**

- `git add` every path listed under Files, by exact name.
- Then, as a separate call: `git commit -m "<message>" -- <the same paths>`.

Message:
- **Subject:** `refactor(construction): bill cuts, add-ons and trade slugs land on main from feat/trade-scenes-foundation`
- **Body:**
  - Names the source commits: `0feaf9ff8`, `5be5bcf5e`, `438a0ec84`, `a259011a3`, and the slice hunks of `63b680386` and `7a0aeb9b4`.
  - States that `story-canvas.tsx` keeps main's version with only the import swapped.
  - States that the scenes branch rebases afterwards, per the energy tracker §3.1.
  - Ends with the attribution line.

- [ ] **Step 7: Tell the scenes session**

Run `ListAgents`. If a session is working on trade scenes, `SendMessage` it these facts:

1. The EI0 commit hash. Its branch now rebases onto main, following the energy tracker §3.1 notes. `scripts/verify-remodel-roi.ts` may come out with a duplicated `resolveOverridable` block.
2. Main adds `'radiant-barrier'` to `BILL_CUT_ADD_ON_IDS` (Task 2).
3. Bill-cutting scopes are now defined in `core/constants/bill-cutting-scopes.ts` (Task 3).
4. The branch's `SCOPE_INSTALLS` credits the whole attic trade for Air-leak sealing (`32f0ca1b-…`), which earns nothing under EI-D16. It does the same for Radiant barrier (`c050ca1b-…`), which earns its own add-on only under EI-D18. Its savings should read `pickBillCuts`.

If no such session is listed, put the same note in the hand-back to the owner. Never write to `.worktrees/trade-scenes`.

---

### Task 2: Partial picks and the radiant barrier add-on in `combineCuts`

**Files:**
- Modify (all in `src/shared/modules/construction/core/`): `constants/bill-cut-add-ons.ts`, `constants/trade-bill-cuts.ts`, `lib/combine-cuts.ts`, `types.ts`
- Create: `scripts/verify-energy-impact.ts`
- Modify: `docs/plans/2026-10-21-proposal-energy-impact-epic.md` (the EI0 hash)

**Interfaces:**
- **Consumes:** Task 1's `combineCuts`, `TRADE_BILL_CUTS`, `BillCategory`, `BillCutAddOnId`, `TradeSlug`.
- **Produces:**
  - `BILL_CUT_ADD_ON_IDS = ['ducts', 'cool-roof', 'radiant-barrier']`, with the label `'Radiant barrier'`.
  - `TRADE_BILL_CUTS['attic-and-basement'] = { base: { electric: 10, gas: 15 }, addOns: { 'radiant-barrier': { electric: 5, gas: 2 } } }`.
  - `BillCutPicks` in `types.ts`, not in `combine-cuts.ts`, so the two don't import each other. It replaces the private `Picks`:

```ts
export interface BillCutPicks<T extends TradeSlug = TradeSlug> {
  trades: readonly T[]
  addOns: readonly BillCutAddOnId[]
  // A trade listed here, and its add-ons, cut only these bills (an HVAC partial).
  only?: Partial<Record<T, readonly BillCategory[]>>
  // Picked for its add-ons alone (radiant barrier without insulation): the trade's own cut does not count.
  addOnsOnly?: readonly T[]
}
```

  - `combineCuts(picks: BillCutPicks<T>, category, cuts)` keeps its return shape and behaviour when `only` and `addOnsOnly` are absent. The calculator never passes them.

- [ ] **Step 1: Write the failing test**

Create `scripts/verify-energy-impact.ts`, in the style of `verify-remodel-roi.ts`: `/* eslint-disable no-console */`, `node:assert/strict`, and a `near(actual, expected, message, tolerance = 1e-9)` helper.

```ts
const cuts = resolveTradeBillCuts()

// HVAC partials: the trade and its ducts cut only the named bill.
near(combineCuts({ trades: ['hvac'], addOns: ['ducts'], only: { hvac: ['electric'] } }, 'electric', cuts).combined, 0.2875, 'A/C only: electric 25 then ducts 5')
assert.deepEqual(combineCuts({ trades: ['hvac'], addOns: ['ducts'], only: { hvac: ['electric'] } }, 'gas', cuts).parts, [], 'A/C only cuts no gas, ducts included')
near(combineCuts({ trades: ['hvac'], addOns: ['ducts'], only: { hvac: ['gas'] } }, 'gas', cuts).combined, 0.24, 'furnace only: gas 20 then ducts 5')

// Radiant barrier is an attic add-on, counted with or without the insulation.
assert.deepEqual(combineCuts({ trades: ['attic-and-basement'], addOns: ['radiant-barrier'], addOnsOnly: ['attic-and-basement'] }, 'electric', cuts).parts, [{ source: 'radiant-barrier', percent: 5 }], 'radiant barrier alone: electric 5, no insulation cut')
near(combineCuts({ trades: ['attic-and-basement'], addOns: ['radiant-barrier'], addOnsOnly: ['attic-and-basement'] }, 'gas', cuts).combined, 0.02, 'radiant barrier alone: gas 2')
near(combineCuts({ trades: ['attic-and-basement'], addOns: ['radiant-barrier'] }, 'electric', cuts).combined, 1 - 0.9 * 0.95, 'insulation 10 then radiant barrier 5')

// The calculator's picks are untouched by the new fields.
near(combineCuts({ trades: ['hvac', 'attic-and-basement'], addOns: ['ducts'] }, 'electric', cuts).combined, 0.35875, 'calculator shape unchanged')

console.log('✅ energy impact verified')
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx tsx scripts/verify-energy-impact.ts`

Expected: it fails, either on types or on `A/C only cuts no gas`.

- [ ] **Step 3: Implement**

- Add `'radiant-barrier'` to the add-on ids and labels, and add its cut to the attic entry.
- Move `BillCutPicks` into `types.ts`.
- In `combineCuts`:
  - skip the base part for a trade in `addOnsOnly`;
  - skip both base and add-on parts of a trade whose `only` list excludes `category`.
- Keep the order "trades' base first, then add-ons".

- [ ] **Step 4: Run both scripts**

Run `npx tsx scripts/verify-energy-impact.ts` and `npx tsx scripts/verify-remodel-roi.ts`.

Expected: both exit 0. The calculator builds its add-ons from its own two switches only, so radiant barrier never reaches its numbers.

- [ ] **Step 5: Commit**

- Fill the EI0 hash in tracker §4.
- Run tsc, lint and theme:check.
- `git add` the four construction files, the script and the tracker; then `git commit -m … -- <same files>`:

`feat(construction): HVAC partials and the radiant barrier add-on in the bill cuts`

---

### Task 3: M2, bill-cutting scopes

**Files:**
- Create: `src/shared/modules/construction/core/constants/bill-cutting-scopes.ts`, `src/shared/modules/construction/core/lib/pick-bill-cuts.ts`
- Modify: `scripts/verify-energy-impact.ts`

**Interfaces:**
- **Consumes:** Task 2's `BillCutPicks`, and `CatalogIndex` (`core/lib/build-catalog-index.ts`).
- **Produces:**

```ts
// bill-cutting-scopes.ts
export type BillCuttingScope =
  | { trade: TradeSlug, appliesTo: 'all' | readonly BillCategory[] }
  | { trade: TradeSlug, addOn: BillCutAddOnId }
export const BILL_CUTTING_SCOPES: Readonly<Record<string, BillCuttingScope>>
export const TRADES_BILL_CUTTING_ON_EVERY_SCOPE: Partial<Record<TradeSlug, { except: readonly string[] }>>
export const ALWAYS_ON_ADD_ONS: Partial<Record<TradeSlug, readonly BillCutAddOnId[]>>

// pick-bill-cuts.ts
export interface SowScopes { trade: { id: string }, scopes: readonly { id: string }[] }
export function pickBillCuts(sow: readonly SowScopes[], index: Pick<CatalogIndex, 'tradesById'>): Required<BillCutPicks>
```

`SowScopes` is structural, so a proposal's `projectJSON.data.sow` and the catalog index pass straight in. The parameter is typed as `Pick<CatalogIndex, …>`, the way `resolve-catalog-ids.ts` does it.

**Values** (tracker §3.2, keyed by dashed catalog id, each with a name comment):

| Scope | Id | Entry |
|---|---|---|
| Window replacement | `3e40ca1b-548b-824d-b0db-81cc10787e73` | `windows-and-doors`, `appliesTo: 'all'` |
| Repaint w/ Cool Life | `9d60ca1b-548b-824a-8aef-81f1e29b9b34` | `exterior-paint-stucco-and-siding`, `'all'` |
| Roof tear-off | `bd60ca1b-548b-821d-bd96-011624aa0fbb` | `roof-and-gutters`, `'all'` |
| Roof torch down | `31a0ca1b-548b-8013-9ad6-fbb929ef9b06` | `roof-and-gutters`, `'all'` |
| Roof redeck | `a2c0ca1b-548b-8296-a58d-01b88fb83405` | `roof-and-gutters`, `'all'` |
| Roof overlay | `32f0ca1b-548b-804e-9fa1-f5009c68668e` | `roof-and-gutters`, `'all'` |
| Split system replacement | `6450ca1b-548b-830a-ac5e-018e7fd3064a` | `hvac`, `'all'` |
| Package unit replacement | `9460ca1b-548b-8375-8d63-814dddf36b71` | `hvac`, `'all'` |
| A/C replacement | `e450ca1b-548b-8269-adc7-019776a6acf7` | `hvac`, `['electric']` |
| Furnace replacement | `88d0ca1b-548b-82b2-bb26-017081659f61` | `hvac`, `['gas']` |
| Attic insulation replacement | `a5f0ca1b-548b-838a-89da-8134c5bfc738` | `attic-and-basement`, `'all'` |
| Attic insulation top-off | `6d70ca1b-548b-835e-a8be-017c9038ac42` | `attic-and-basement`, `'all'` |
| Radiant barrier installation | `c050ca1b-548b-825d-b707-01aff56ca25d` | `attic-and-basement`, `addOn: 'radiant-barrier'` |

The other two constants:
- `TRADES_BILL_CUTTING_ON_EVERY_SCOPE = { dryscaping: { except: ['3490ca1b-548b-8086-8f5c-d5727a876786'] } }`. The excluded id is Install sod; its comment says why: natural grass needs water.
- `ALWAYS_ON_ADD_ONS = { 'hvac': ['ducts'], 'roof-and-gutters': ['cool-roof'] }`. Its comment carries the owner's words: "assume ducts included".

Any scope id not in these tables cuts nothing.

- [ ] **Step 1: Write the failing test**

Append before the final `console.log`:

```ts
const HVAC_ID = '11111111-2222-3333-4444-555555555555'
const DRY_ID = '66666666-7777-8888-9999-000000000000'
const index = { tradesById: new Map([[HVAC_ID, { slug: 'hvac' }], [DRY_ID, { slug: 'dryscaping' }]]) } as unknown as Pick<CatalogIndex, 'tradesById'>
const section = (tradeId: string, ...scopeIds: string[]) => ({ trade: { id: tradeId }, scopes: scopeIds.map(id => ({ id })) })
const NONE = { trades: [], addOns: [], only: {}, addOnsOnly: [] }

assert.deepEqual(pickBillCuts([section(HVAC_ID, '6450ca1b-548b-830a-ac5e-018e7fd3064a')], index), { trades: ['hvac'], addOns: ['ducts'], only: {}, addOnsOnly: [] }, 'split system: full HVAC, ducts assumed')
assert.deepEqual(pickBillCuts([section(HVAC_ID, 'e450ca1b-548b-8269-adc7-019776a6acf7')], index).only, { hvac: ['electric'] }, 'A/C alone: electric only')
assert.deepEqual(pickBillCuts([section(HVAC_ID, 'e450ca1b-548b-8269-adc7-019776a6acf7', '88d0ca1b-548b-82b2-bb26-017081659f61')], index).only, { hvac: ['electric', 'gas'] }, 'A/C plus furnace: both bills, trade once')
assert.deepEqual(pickBillCuts([section(HVAC_ID, '6450ca1b-548b-830a-ac5e-018e7fd3064a', 'e450ca1b-548b-8269-adc7-019776a6acf7')], index).only, {}, 'a full scope wins over a partial')
assert.deepEqual(pickBillCuts([section('x', 'c050ca1b-548b-825d-b707-01aff56ca25d')], index), { trades: ['attic-and-basement'], addOns: ['radiant-barrier'], only: {}, addOnsOnly: ['attic-and-basement'] }, 'radiant barrier alone')
assert.deepEqual(pickBillCuts([section('x', 'c050ca1b-548b-825d-b707-01aff56ca25d', 'a5f0ca1b-548b-838a-89da-8134c5bfc738')], index).addOnsOnly, [], 'radiant barrier with insulation counts the insulation too')
assert.deepEqual(pickBillCuts([section('x', '32f0ca1b-548b-804e-9fa1-f5009c68668e')], index), { trades: ['roof-and-gutters'], addOns: ['cool-roof'], only: {}, addOnsOnly: [] }, 'roof overlay: cool roof assumed')
assert.deepEqual(pickBillCuts([section(DRY_ID, 'any-artificial-grass-id')], index).trades, ['dryscaping'], 'any dryscaping scope but sod')
assert.deepEqual(pickBillCuts([section(DRY_ID.replace(/-/g, '').toUpperCase(), 'any-artificial-grass-id')], index).trades, ['dryscaping'], 'an undashed, upper-case trade id still counts')
assert.deepEqual(pickBillCuts([section(DRY_ID, '3490ca1b-548b-8086-8f5c-d5727a876786')], index), NONE, 'sod alone cuts nothing')
assert.deepEqual(pickBillCuts([section(HVAC_ID, '8aa0ca1b-548b-82dd-9148-81d0b51076bf', 'dcb0ca1b-548b-8303-9f65-01730423e685')], index), NONE, 'new-cut and mini-split cut nothing')
assert.deepEqual(pickBillCuts([section(HVAC_ID, '6450CA1B548B830AAC5E018E7FD3064A')], index).trades, ['hvac'], 'an undashed, upper-case scope id still counts')
assert.deepEqual(pickBillCuts([section(HVAC_ID, '6450ca1b-548b-830a-ac5e-018e7fd3064a'), section(HVAC_ID, '9460ca1b-548b-8375-8d63-814dddf36b71')], index).trades, ['hvac'], 'two HVAC sections, one trade')
assert.deepEqual(pickBillCuts([], index), NONE, 'an empty SOW')
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx tsx scripts/verify-energy-impact.ts`

Expected: it fails because `pickBillCuts` doesn't exist.

- [ ] **Step 3: Implement the constants and `pickBillCuts`**

How it works:
- **Id matching:** compare every id, scope and trade, with dashes removed and lower-cased. Build one lookup from `BILL_CUTTING_SCOPES` at module load, and a compact-keyed view of `tradesById` per call.
  - Use a private helper in this file. Its comment says why: core can't import `sources/notion`'s `normalizeNotionId`.
- **Trade:** a scope's trade comes from its `BILL_CUTTING_SCOPES` entry. Only `TRADES_BILL_CUTTING_ON_EVERY_SCOPE` needs the section's trade slug.
- **Merging per trade:**
  - any `'all'` → no `only` entry;
  - otherwise, the union of the partials' bills, in `BILL_CATEGORIES` order;
  - an `addOn` entry adds its add-on;
  - a trade goes in `addOnsOnly` when add-on entries are all it has.
- **Always-on add-ons:** added for every trade that counts.
- **Ordering:** `trades` in first-appearance order; `addOns` in `BILL_CUT_ADD_ON_IDS` order.

- [ ] **Step 4: Run both verify scripts**

Expected: both exit 0.

- [ ] **Step 5: Commit**

Run tsc, lint and theme:check. Then add the two new files and the script; commit:

`feat(construction): bill-cutting scopes, complete replacements only`

---

### Task 4: Rates, growth rates and EPA factors (M4, M6 constants, M7 constants)

**Files:**
- **Create** (`src/shared/modules/construction/core/`):
  - `constants/`: `energy-categories.ts`, `bill-growth-rates.ts`, `utility-rates.ts`, `emission-factors.ts`
  - `schemas/utility-rates.ts`
  - `lib/`: `resolve-utility-rates.ts`, `electric-rate-for.ts`
- **Modify:** `src/shared/modules/construction/core/types.ts` (`ElectricRate`)
- **Modify:** `src/features/calculators/remodel-roi-calculator/constants/config-defaults.ts`. `defaultRatesPercent` reads `BILL_GROWTH_RATES_PERCENT`, and the "thousands of customer bills" comment moves with the numbers.
- **Modify:** `scripts/verify-energy-impact.ts`

**Interfaces:**
- **Consumes:** `BillCategory`, `ElectricProvider` (`@/shared/constants/enums/customers`).
- **Produces:**

```ts
export const ENERGY_CATEGORIES = ['electric', 'gas', 'water'] as const satisfies readonly BillCategory[]
export type EnergyCategory = typeof ENERGY_CATEGORIES[number]

export const BILL_GROWTH_RATES_PERCENT = { electric: 7.57, water: 8.9, gas: 9.1, gardening: 5, misc: 0 } as const satisfies Record<BillCategory, number>

export const UTILITY_RATES = { electricPerKwh: { ladwp: 0.276, edison: 0.344 }, gasPerTherm: 2.10, waterPerGallon: 0.017 }
export const utilityRatesSchema   // every rate z.number().positive()
export type UtilityRates = z.infer<typeof utilityRatesSchema>
export function resolveUtilityRates(): UtilityRates   // the same seam comment as resolveTradeBillCuts

export const CO2_TONNES_PER_KWH = 5.04e-4
export const CO2_TONNES_PER_THERM = 0.0053
export const CO2_EQUIVALENT_IDS = ['gasolineGallons', 'coalPounds', 'treeSeedlings', 'forestAcres', 'milesDriven', 'smartphoneCharges'] as const
export type Co2EquivalentId = typeof CO2_EQUIVALENT_IDS[number]
export const CO2_TONNES_PER_EQUIVALENT = { gasolineGallons: 8.887e-3, coalPounds: 9.00e-4, treeSeedlings: 0.060, forestAcres: 1.00, milesDriven: 3.93e-4, smartphoneCharges: 1.24e-5 } as const satisfies Record<Co2EquivalentId, number>

// types.ts
export interface ElectricRate { perKwh: number, pricedAs: 'ladwp' | 'edison', assumed: boolean }
// electric-rate-for.ts
export function electricRateFor(utility: ElectricProvider | null, rates: UtilityRates): ElectricRate
```

**Source comments** (the URLs from tracker §3.3):
- **SCE:** the 2026-06-01 Rates Advisory.
- **LADWP:** the EIA-861M 12-month average.
- **SoCalGas:** the March 2026 update.
- **Water:** LADWP Tier 1 per HCF ÷ 748, a third-party figure noted as unverified.
- **CO₂ per kWh:** the EPA equivalencies page. The comment says this is the CAMX non-baseload rate, because California's grid is cleaner than the national 6.72e-4.

- [ ] **Step 1: Confirm the tree factor's basis**

Open <https://www.epa.gov/energy/ghg-equivalencies-calculator-calculations-and-references> (WebFetch) and confirm two things: the urban tree seedling factor is 0.060 t per tree as the 10-year total, and the other five factors match the values above.

Write the basis in the factor's comment. If any value differs, stop and report the difference.

- [ ] **Step 2: Write the failing test**

```ts
const rates = resolveUtilityRates()
assert.deepEqual(electricRateFor('ladwp', rates), { perKwh: 0.276, pricedAs: 'ladwp', assumed: false })
assert.deepEqual(electricRateFor('edison', rates), { perKwh: 0.344, pricedAs: 'edison', assumed: false })
assert.deepEqual(electricRateFor('pg&e', rates), { perKwh: 0.344, pricedAs: 'edison', assumed: true }, 'any other utility is priced at SCE, and says so')
assert.deepEqual(electricRateFor(null, rates), { perKwh: 0.344, pricedAs: 'edison', assumed: true }, 'no utility yet: SCE')
assert.equal(utilityRatesSchema.safeParse({ ...rates, gasPerTherm: 0 }).success, false, 'a zero rate would divide by zero')
assert.equal(resolveRemodelRoiConfig().defaultRatesPercent.electric, 7.57, 'the calculator reads the shared growth rates')
```

- [ ] **Step 3: Run it to see it fail**

Expected: the imports don't resolve.

- [ ] **Step 4: Implement**

`pricedAs` is `'ladwp'` only when the utility is `'ladwp'`; otherwise it's `'edison'`. `assumed` is `pricedAs !== utility`.

- [ ] **Step 5: Run both verify scripts**

Expected: both exit 0.

- [ ] **Step 6: Commit**

Run tsc, lint and theme:check. Then add the new files, `types.ts`, `config-defaults.ts` and the script; commit:

`feat(construction): utility rates, bill growth rates and EPA factors as shared working numbers`

---

### Task 5: One yearly bill loop for both surfaces (M6, EI-D21)

**Files:**
- Create: `src/shared/modules/construction/core/lib/project-bill-years.ts`
- Modify: `src/shared/modules/construction/core/types.ts` (`BillYear`)
- Modify: `src/features/calculators/remodel-roi-calculator/lib/project-remodel-roi.ts`. The year loop reads `billsNowByCategory` and `billsAfterByCategory` from `projectBillYears` instead of computing them inline.
- Modify: `scripts/verify-energy-impact.ts`

**Interfaces:**
- **Produces:**

```ts
// types.ts
export interface BillYear<C extends string> { t: number, billsNow: Record<C, number>, billsAfter: Record<C, number> }
// project-bill-years.ts
export function projectBillYears<C extends string>(bills: Record<C, { now: number, after: number }>, growthPercent: Record<C, number>, years: number): BillYear<C>[]
```

How it computes:
- It returns `t = 0..years`. At `t = 0` every value is 0.
- At `t ≥ 1`, `billsNow[c] = now × (1 + g_c/100)^(t−1)`, and `billsAfter` likewise from `after`. These are the calculator's monthly amounts, unchanged.
- The calculator passes `cuts[c].bill` and `cuts[c].after` with `assumptions.ratesPercent[c].value`, over `PROJECTION_YEARS`. Everything else in its loop stays as it is.

- [ ] **Step 1: Write the failing test**

```ts
const billYears = projectBillYears({ electric: { now: 300, after: 213.75 } }, { electric: 7.57 }, 3)
assert.equal(billYears.length, 4)
assert.deepEqual(billYears[0], { t: 0, billsNow: { electric: 0 }, billsAfter: { electric: 0 } })
near(billYears[1].billsNow.electric, 300, 'year 1 is today\'s bill')
near(billYears[3].billsAfter.electric, 213.75 * 1.0757 ** 2, 'year 3 compounds twice')
```

- [ ] **Step 2: Run it to see it fail**

Expected: `projectBillYears` doesn't exist.

- [ ] **Step 3: Implement it and move the calculator onto it**

- [ ] **Step 4: Run both verify scripts**

Expected: both exit 0. `verify-remodel-roi.ts` is the guard that the calculator's numbers did not move.

- [ ] **Step 5: Commit**

Run tsc, lint and theme:check. Then add the new file, `types.ts`, `project-remodel-roi.ts` and the script; commit:

`refactor(construction): one yearly bill loop shared by the ROI calculator and the energy model`

---

### Task 6: `projectEnergyImpact` and the goldens (M3, M5, M7–M9)

**Files:**
- Create: `src/shared/modules/construction/core/lib/project-energy-impact.ts`, `src/shared/modules/construction/core/lib/resolve-energy-impact-config.ts`
- Modify: `src/shared/modules/construction/core/types.ts`
- Modify: `scripts/verify-energy-impact.ts`, `docs/plans/2026-10-21-proposal-energy-impact-epic.md` (§4 EI1 row)

**Interfaces:**
- **Consumes:**
  - Task 1: `cutFor`, `BillCut`
  - Task 2: `combineCuts`, `BillCutPicks`
  - Task 4: everything it produces
  - Task 5: `projectBillYears`
- **Produces:**

```ts
// types.ts
export type Co2Equivalents = Record<Co2EquivalentId, number>
export interface EnergyFigures { dollars: number, kwh: number, therms: number, gallons: number, co2Tonnes: number, equivalents: Co2Equivalents }
export interface EnergyImpactYear extends BillYear<EnergyCategory> { saved: number, cumulativeSaved: number, cumulativeCo2Tonnes: number }
export interface EnergyImpactConfig { billCuts: TradeBillCuts, rates: UtilityRates, growthPercent: Record<EnergyCategory, number> }
export interface EnergyImpactInput { bills: Record<EnergyCategory, number | null>, electricUtility: ElectricProvider | null, picks: BillCutPicks, config: EnergyImpactConfig, years: number }
export interface EnergyImpact {
  applies: boolean                       // some energy bill has a combined cut > 0 (P2); depends on picks only, never on bills
  cutsBill: EnergyCategory[]             // the bills the picks cut, in ENERGY_CATEGORIES order (P3: which sliders show)
  cuts: Record<EnergyCategory, BillCut>
  electricRate: ElectricRate
  monthly: EnergyFigures                 // one month at today's prices
  firstYear: EnergyFigures               // 12 × monthly
  overYears: EnergyFigures               // dollars compound yearly; kWh, therms, gallons and CO₂ stay flat × years
  years: EnergyImpactYear[]              // t = 0..years, from projectBillYears
}

// project-energy-impact.ts
export function projectEnergyImpact(input: EnergyImpactInput): EnergyImpact
// resolve-energy-impact-config.ts
export function resolveEnergyImpactConfig(): EnergyImpactConfig   // resolveTradeBillCuts() + resolveUtilityRates() + the energy categories of BILL_GROWTH_RATES_PERCENT
```

How it computes:
- `bills` are monthly dollars. The chapter converts the stored cents.
- Each category's cut is `cutFor({ now: bill, cut: { mode: 'trades', value: null } }, parts, combined)`.
- kWh = electric $ saved ÷ `electricRate.perKwh`; therms = gas $ ÷ `gasPerTherm`; gallons = water $ ÷ `waterPerGallon`. All use today's rate (M5).
- CO₂ = kWh × `CO2_TONNES_PER_KWH` + therms × `CO2_TONNES_PER_THERM`. Water carries no CO₂.
- Each equivalent = CO₂ ÷ `CO2_TONNES_PER_EQUIVALENT[id]`.
- `years` comes from `projectBillYears`, with `saved = 12 × Σ(now − after)`.

- [ ] **Step 1: Write the failing test**

Shared fixtures: electric $300, gas $80, water $120, SCE, 10 years, and `cfg = resolveEnergyImpactConfig()`.

```ts
const BILLS = { electric: 300, gas: 80, water: 120 }
const run = (picks: BillCutPicks, edit: Partial<EnergyImpactInput> = {}) => projectEnergyImpact({ bills: BILLS, electricUtility: 'edison', picks, config: cfg, years: 10, ...edit })
const geo = (percent: number, n: number) => ((1 + percent / 100) ** n - 1) / (percent / 100)
const FULL_HVAC = { trades: ['hvac'], addOns: ['ducts'] } as const

// Full HVAC
const hvac = run(FULL_HVAC)
near(hvac.cuts.electric.after, 213.75, 'electric 300 × (1 − 0.2875)')
near(hvac.cuts.gas.after, 60.8, 'gas 80 × (1 − 0.24)')
near(hvac.monthly.dollars, 105.45, '86.25 + 19.20')
near(hvac.monthly.kwh, 86.25 / 0.344, 'SCE kWh')
near(hvac.monthly.therms, 19.2 / 2.10, 'SoCalGas therms')
near(hvac.monthly.co2Tonnes, (86.25 / 0.344) * 5.04e-4 + (19.2 / 2.10) * 0.0053, 'CO₂ from kWh and therms')
near(hvac.monthly.equivalents.treeSeedlings, hvac.monthly.co2Tonnes / 0.060, 'trees from CO₂')
near(hvac.firstYear.kwh, 12 * hvac.monthly.kwh, 'a year of kWh')
near(hvac.overYears.kwh, 120 * hvac.monthly.kwh, 'usage held flat over 10 years')
near(hvac.overYears.dollars, 12 * 86.25 * geo(7.57, 10) + 12 * 19.2 * geo(9.1, 10), 'dollars compound by bill', 1e-6)
assert.equal(hvac.years.length, 11)
assert.equal(hvac.years[0].cumulativeSaved, 0)
near(hvac.years[10].cumulativeSaved, hvac.overYears.dollars, 'series ends at the total', 1e-6)
assert.deepEqual(hvac.cutsBill, ['electric', 'gas'])
near(run(FULL_HVAC, { electricUtility: 'ladwp' }).monthly.kwh, 312.5, 'LADWP: 86.25 / 0.276')

// Partials and add-ons
assert.deepEqual(run({ ...FULL_HVAC, only: { hvac: ['electric'] } }).cutsBill, ['electric'], 'A/C only')
assert.deepEqual(run({ ...FULL_HVAC, only: { hvac: ['gas'] } }).cutsBill, ['gas'], 'furnace only')
const windowsAttic = run({ trades: ['windows-and-doors', 'attic-and-basement'], addOns: [] })
near(windowsAttic.cuts.electric.combined, 0.19, 'windows 10, attic 10')
near(windowsAttic.cuts.gas.combined, 0.218, 'windows 8, attic 15')
const barrier = run({ trades: ['attic-and-basement'], addOns: ['radiant-barrier'], addOnsOnly: ['attic-and-basement'] })
near(barrier.cuts.electric.combined, 0.05, 'radiant barrier electric')
near(barrier.cuts.gas.combined, 0.02, 'radiant barrier gas')
const overlay = run({ trades: ['roof-and-gutters'], addOns: ['cool-roof'] })
near(overlay.cuts.electric.combined, 0.08, 'cool roof')
assert.deepEqual(overlay.cutsBill, ['electric'])
const dry = run({ trades: ['dryscaping'], addOns: [] })
near(dry.monthly.gallons, 48 / 0.017, 'water 120 × 0.4 at $0.017/gal')
assert.equal(dry.monthly.co2Tonnes, 0, 'water carries no CO₂')
assert.deepEqual(dry.cutsBill, ['water'])

// Nothing counts: the chapter hides
const none = run({ trades: [], addOns: [] })
assert.equal(none.applies, false)
assert.deepEqual(none.cutsBill, [])
assert.equal(run(FULL_HVAC, { bills: { electric: null, gas: null, water: null } }).applies, true, 'applies follows the trades, not the bills')

// Every trade at once
const all = run({ trades: ['hvac', 'roof-and-gutters', 'windows-and-doors', 'attic-and-basement', 'exterior-paint-stucco-and-siding', 'dryscaping'], addOns: ['ducts', 'cool-roof', 'radiant-barrier'] })
near(all.cuts.electric.combined, 0.51576904, 'every electric cut, multiplied', 1e-8)
near(all.cuts.gas.combined, 0.4175664, 'every gas cut, multiplied', 1e-8)
near(all.cuts.water.combined, 0.4, 'dryscaping water')

// Bad bill values give zero savings, never NaN
const bad = run(FULL_HVAC, { bills: { electric: -50, gas: Number.NaN, water: 0 } })
assert.equal(bad.monthly.dollars, 0)
assert.equal(bad.monthly.kwh, 0)
assert.equal(bad.monthly.co2Tonnes, 0)
assert.ok(bad.years.every(year => Number.isFinite(year.cumulativeSaved)), 'no NaN in the series')
```

**Calculator cross-check (M9).** Same trades and bills:
- Build the calculator input with `createRemodelRoiDefaults(config)` and `createTradePicks()`:
  - `hvac` with `ducts: true`, the other five energy trades, and `roof-and-gutters` with `coolRoof: true`;
  - bills electric 300, gas 80, water 120.
- Run `projectRemodelRoi`.
- Compare against `allNoBarrier`, the every-trade picks without `'radiant-barrier'`, which the calculator doesn't have:
  - for each energy category, `calc.cuts[c].after` and `allNoBarrier.cuts[c].after` are `near` each other;
  - for `t` in 1..10, `calc.years[t].returnParts.billsSaved` and `allNoBarrier.years[t].cumulativeSaved` are `near` each other, with tolerance 1e-6.
- Repeat with HVAC alone (ducts on).

- [ ] **Step 2: Run it to see it fail**

Expected: `projectEnergyImpact` doesn't exist.

- [ ] **Step 3: Implement the types, `resolveEnergyImpactConfig` and `projectEnergyImpact`**

- [ ] **Step 4: Run both verify scripts**

Expected: both exit 0.

- [ ] **Step 5: Tick the tracker and commit**

- Set EI1 (M1–M9) to `[x]` in tracker §4, with the commit range of Tasks 2–6. M1 holds because both surfaces read `resolveTradeBillCuts()`.
- Run tsc, lint and theme:check.
- Add the files and commit:

`feat(construction): projectEnergyImpact turns bills and picks into dollars, kWh, therms, gallons and CO₂, matching the ROI calculator`

---

### Task 7: The `customer_utility_bills` table and its read (S1, S2, S5)

**Files:**
- **Create:**
  - `src/shared/db/schema/customer-utility-bills.ts`
  - `src/shared/modules/customers/core/constants/monthly-bill-bounds.ts`
- **Modify:**
  - `src/shared/db/schema/index.ts`: export the new schema, beside `customer-profiles`.
  - `src/shared/entities/customers/lib/constants.ts`: `CUSTOMER_UTILITY_BILLS`.
  - `src/shared/entities/customers/lib/server-spec.ts`: `customerUtilityBillsServerSpec`.
  - The spec registries: `src/shared/domains/permissions/abilities.ts` (`ENTITY_NAMES`), `src/shared/dal/server/specs.ts` (`SERVER_SPECS`), `src/shared/domains/permissions/specs.ts` (the `ServerSpec` union).
  - `src/shared/modules/proposals/core/dal/server/queries.ts`: `ProposalCustomer`, a `leftJoin`, and the mapping.
  - `src/shared/modules/proposals/core/lib/shareable-customer.test.ts`, and any other site that builds a `ProposalCustomer`. Find them by running `pnpm tsc`, or by grepping `hasSentProposal:`.
  - Tracker §4: the owner's prod-push to-do.

**Interfaces:**
- **Consumes:** `electricProviders`, `ElectricProvider`, and the `customer_profiles` precedent:
  - `src/shared/db/schema/customer-profiles.ts`: PK-as-FK, and `customerProfilePatchSchema = insert.omit(...).partial()`;
  - `customerProfileServerSpec` (`defineSubEntitySpec` with `parent.field: 'profile'`).
- **Produces:**

```ts
// monthly-bill-bounds.ts. Storage bounds in cents; the chapter's slider ranges (EI4) sit inside them.
export const MONTHLY_BILL_MIN_CENTS = 0
export const MONTHLY_BILL_MAX_CENTS = 200_000

// customer-utility-bills.ts
export const customerUtilityBills = pgTable('customer_utility_bills', {
  customerId: uuid('customer_id').primaryKey().references(() => customers.id, { onDelete: 'cascade' }),
  electricProvider: text('electric_provider', { enum: electricProviders }),
  monthlyElectricBillCents: bigint('monthly_electric_bill_cents', { mode: 'number' }),
  monthlyGasBillCents: bigint('monthly_gas_bill_cents', { mode: 'number' }),
  monthlyWaterBillCents: bigint('monthly_water_bill_cents', { mode: 'number' }),
  createdAt,
  updatedAt,
}, table => [/* check(... >= 0) per bill, as lead-source-monthly-spend.ts does */])
export const insertCustomerUtilityBillsSchema   // bills: z.number().int().min(MIN).max(MAX).nullable().optional()
export const selectCustomerUtilityBillsSchema
export const customerUtilityBillsPatchSchema    // insert.omit({ customerId: true }).partial(); undefined = untouched, null = clear
export type CustomerUtilityBillsPatch
export type CustomerUtilityBillsRow

// constants.ts
export const CUSTOMER_UTILITY_BILLS = 'CustomerUtilityBills' as const

// server-spec.ts: a part of the customer, named `utilityBills` in rules
export const customerUtilityBillsServerSpec = defineSubEntitySpec({ entityName: CUSTOMER_UTILITY_BILLS, table: customerUtilityBills, schemas: { insert, update: customerUtilityBillsPatchSchema, select }, primaryKey: 'customerId', parent: { spec: customerServerSpec, fk: customerUtilityBills.customerId, field: 'utilityBills' } })

// queries.ts: ProposalCustomer gains (null when the customer has no row yet)
electricProvider: ElectricProvider | null
monthlyElectricBillCents: number | null
monthlyGasBillCents: number | null
monthlyWaterBillCents: number | null
```

- **Why its own table:** the schema file's top comment gives the reason in one line. The homeowner writes it through the share link while staff write the rest of the customer, and a row existing means the bills were collected. That is ADR-0005's 2026-07-14 amendment.
- **Read:** `getFullView` gets a `.leftJoin(customerUtilityBills, eq(customerUtilityBills.customerId, customers.id))`, and the fields are flattened into `ProposalCustomer`, as the ADR's read shape says.
- **Share-link view:** `toShareableCustomer` strips only `hasSentProposal`, so the homeowner's view carries the fields with no further change.

- [ ] **Step 1: Add the bounds, the table, its schemas, the spec and the registry entries**

- [ ] **Step 2: Push to the dev DB**

Run: `pnpm db:push:dev`

Expected: drizzle-kit proposes only `CREATE TABLE customer_utility_bills` with its FK and checks. If it proposes any other change (a drop, a truncate, an altered table), abort and report it.

- [ ] **Step 3: Join it in `getFullView`**

- [ ] **Step 4: Verify**

Run tsc, lint and theme:check. Expected: all pass, and every `ProposalCustomer` site supplies the four fields.

- [ ] **Step 5: Record the prod gate and commit**

- In tracker §4, add the owner to-do: "`pnpm db:push:prod` for `customer_utility_bills` before any commit from foundation Task 7 on reaches origin/main".
- Add the files and commit:

`feat(customers): a customer's utility bills and electric utility live in their own table, read with the proposal`

---

### Task 8: The share-link write (S3, S4, S6 server side)

**Files:**
- **Create:**
  - `src/trpc/routers/proposals.router/customer-bills.router.ts`
  - `src/shared/entities/customers/lib/customer-bills-input.test.ts`
- **Modify:**
  - `src/shared/entities/customers/dal/server/mutations.ts`: `upsertCustomerUtilityBills`, beside `upsertCustomerProfile`.
  - `src/shared/domains/permissions/rules/system.ts`: add the `'derived:homeowner-bills'` reason.
  - `src/shared/domains/permissions/rules/agent.ts` and `dispatcher.ts`: add `'utilityBills', 'utilityBills.*'` to their `update Customer` field lists, next to `'profile', 'profile.*'`. The comment says why the rep needs them: they set the bills while presenting.
  - `src/trpc/routers/proposals.router/index.ts`: register `customerBills: customerBillsRouter`.
  - Tracker §4: the EI2 row.

**Interfaces:**
- **Consumes:**
  - Task 7's spec, patch schema and bounds;
  - `upsertOneToOne` (`src/shared/dal/server/lib/upsert-one-to-one.ts`). It parses the update schema, checks `update Customer` on `utilityBills` and on each `utilityBills.<column>` against the customer row, and upserts. It doesn't go through `customerCrud`, so no calendar sync fires.
  - `getFullView`, `systemContext`, `proposalShareableProcedure`, `dalToTrpc`.
- **Produces:**

```ts
// mutations.ts
export async function upsertCustomerUtilityBills(ctx: ScopedContext, input: { customerId: string, patch: CustomerUtilityBillsPatch }): Promise<DalReturn<CustomerUtilityBillsRow>>   // one upsertOneToOne call, the upsertCustomerProfile shape

// customer-bills.router.ts: client path trpc.proposalsRouter.customerBills.set
export const customerBillsInputSchema = z.object({
  id: z.string().uuid(),
  token: z.string().optional(),
  bills: customerUtilityBillsPatchSchema.strict().refine(v => Object.keys(v).length > 0, { message: 'Nothing to save' }),
})
set: proposalShareableProcedure.input(customerBillsInputSchema).mutation(...)
  → { electricProvider, monthlyElectricBillCents, monthlyGasBillCents, monthlyWaterBillCents }   // from the upserted row
```

How the mutation works:
- Fetch `getFullView(ctx, { id: input.id })`. A share token only reaches its own proposal (`rules/bearer.ts`), so this also proves the caller may act on that customer.
- Throw `NOT_FOUND` when there's no proposal or no customer.
- Call `upsertCustomerUtilityBills(writeCtx, { customerId: proposal.customer.id, patch: input.bills })`, where `writeCtx` is:
  - **Staff session:** `ctx`, so their role's `utilityBills` grant governs the write.
  - **Share link:** `systemContext('derived:homeowner-bills')`. The comment says why: share-link rules name only the proposal, and reaching the proposal is the homeowner's right to set their own bills.
- Comments also say:
  - there is no frozen-proposal check (S4): bills are the customer's data and the chapter is a projection;
  - the customer is keyed off the proposal the caller reached, never a client-supplied id.

- [ ] **Step 1: Write the failing test**

`customer-bills-input.test.ts`, with the same header as `src/shared/modules/proposals/core/lib/gate-customer-phone.test.ts`, including its `eslint-disable-next-line test/no-import-node-test` comment. It tests `customerBillsInputSchema`:

```ts
const ID = '11111111-2222-3333-4444-555555555555'
const parse = (bills: unknown) => customerBillsInputSchema.safeParse({ id: ID, bills }).success

describe('customerBillsInputSchema', () => {
  it('takes any subset of the four fields, and null clears one', () => {
    assert.equal(parse({ monthlyElectricBillCents: 28000 }), true)
    assert.equal(parse({ electricProvider: 'ladwp', monthlyGasBillCents: 0 }), true)
    assert.equal(parse({ monthlyWaterBillCents: null }), true)
  })
  it('refuses anything else on the customer', () => {
    assert.equal(parse({ monthlyElectricBillCents: 28000, name: 'X' }), false)
    assert.equal(parse({ monthlyElectricBillCents: 28000, phone: '8185550100' }), false)
    assert.equal(parse({ monthlyElectricBillCents: 28000, customerId: ID }), false)
  })
  it('refuses an empty write and out-of-range or fractional cents', () => {
    assert.equal(parse({}), false)
    assert.equal(parse({ monthlyWaterBillCents: -1 }), false)
    assert.equal(parse({ monthlyWaterBillCents: 200_001 }), false)
    assert.equal(parse({ monthlyWaterBillCents: 120.5 }), false)
    assert.equal(parse({ electricProvider: 'sdge' }), false)
  })
})
```

The schema lives in the router file. If the test can't import a tRPC router file without a server runtime, move `customerBillsInputSchema` to `src/shared/entities/customers/lib/customer-bills-input.ts` and import it from both places. Decide by running the test.

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec tsx --test src/shared/entities/customers/lib/customer-bills-input.test.ts`

Expected: it fails because the module doesn't exist.

- [ ] **Step 3: Implement**

Write the DAL function, add the system reason and the role grants, write the router and register it.

- [ ] **Step 4: Verify**

Run the test file, then tsc, lint and theme:check.

Expected:
- All pass.
- `src/shared/domains/permissions/type-checks/` still compiles. If a `must-not-compile` case fails because of the new grant, read it and report it; don't edit it to pass.
- The mutation is not called against any database, because there are no DB writes for testing. Its first live use is EI5's slider, checked by the owner.

- [ ] **Step 5: Tick the tracker and commit**

- Set EI2 (S1–S5 and S6's server half) to `[x]`, with the commit range of Tasks 7–8, and note "dev DB pushed; prod push = owner, before origin".
- Add the files and commit:

`feat(proposals): the share link saves the customer's utility bills, nothing else`

---

## After this plan

- **Owner:** `pnpm db:push:prod` for `customer_utility_bills` before Task 7's commit reaches origin/main.
- **Next:**
  - EI4 `/ui-exploration` of the chapter. Its numbers come from `projectEnergyImpact`, and the slider ranges must sit within `MONTHLY_BILL_MAX_CENTS`.
  - Then a second plan for EI3 and EI5. That plan also updates `CONTEXT.md`'s "Proposal chapter" (six → seven sections) and handles cache invalidation of `getFullView` across a customer's proposals after a save.
