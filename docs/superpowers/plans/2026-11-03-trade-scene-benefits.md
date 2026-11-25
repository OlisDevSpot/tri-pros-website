# Trade scene Benefits interior Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Benefits' coming-soon body and bills footer with the approved interior. That means today's costs in the window's head with an editor, the two futures band (readout, year-by-year chart, the "?" breakdown), and the matrix of kinds of benefit by home systems, which opens a rail for a dot, a system or a kind.

**Architecture:**
- **Construction core** gains what both this build and the ROI calculator read:
  - the bill growth rates (`BILL_GROWTH_RATES_PERCENT`, named as in the energy-impact plan) and the construction growth rate;
  - `projectBillYears`, which the calculator's year loop moves onto;
  - one efficiency-swap helper (`installedMaterialId`) and one compound helper (`compoundCut`), each shared by every caller;
  - the upgrade registry of benefit statements, keyed by `ScopeId`.
- **The feature** derives everything shown from the scene store and `useSceneTargets()` through pure libs, pinned by assertions in `scripts/verify-trade-scene.ts`. A `BenefitsFiguresProvider` computes them once per store write for the head and the body.
- **UI state** (selection, look-ahead, the two panels) sits in its own `BenefitsProvider` inside `SceneControlsProvider`. Escape steps back through `ControlsModal`'s per-section `onEscapeKeyDown`.
- **The UI** is pinned by one Playwright check, grown one slice per UI task.

**Tech Stack:** Next.js 15, React 19, Tailwind v4, shadcn (`Button`, `RadioGroup`, the shared `ChartContainer`), recharts 3.10 (loaded with `next/dynamic`), motion/react 12 (`layout`, `AnimatePresence`, `animate`), lucide icons, zustand scene store.

**Spec:** `docs/superpowers/specs/2026-11-03-trade-scene-benefits-design.md` (approved 2026-11-03, R226; stress-test rulings R227). Read it with this plan; the plan does not repeat its copy tables.
**The mock it must match:** `docs/plans/assets/2026-11-03-trade-scene-benefits/studies.html`, section `#future`, version **Round 7** (open with `assets.js` beside it). Line numbers below cite that file as `mock:NNN`.
**Shared with:** `docs/superpowers/plans/2026-10-21-proposal-energy-impact-foundation.md`. Task 1 builds that plan's `bill-growth-rates.ts`, `projectBillYears` and `BillYear` to its exact interface, and moves the calculator onto them. That plan's matching steps then find them done.

## Global Constraints

- **Owner's rules:**
  - Build to match the round-7 mock as closely as possible: sizes, spacing, motion, copy and behaviour. Where the spec and the mock disagree, the spec wins (spec §10 lists the differences).
  - **No defensive code:** no fallbacks for states the types rule out, no `?.` on values that are always there, no try/catch around our own code.
  - **No thin or ad-hoc helpers:** one shared source in `src/shared/modules/construction/` for anything both the scene and another caller compute (R227).
- **No build until the owner says build, execute or run.** "Go ahead" is not execute.
- **Branch:** `feat/trade-scenes-foundation` in `.worktrees/trade-scenes`, unless the owner says otherwise.
  - Before Task 1, check whether `feat/trade-scene-ship` has merged (`git branch -r --merged origin/main | grep trade-scene-ship`). If it has, stop and ask which base to build on.
  - Check that `src/shared/modules/construction/core/constants/bill-growth-rates.ts` still does not exist. If it does, the energy-impact build got there first: use it as it is and skip Task 1's create steps.
- **pnpm only.**
  - Static checks: `pnpm tsc` and eslint, run under `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock`.
  - **Never `pnpm build`.**
  - No DB writes, not even for testing.
- **The dev server on :3002 is the owner's.** Never start, stop or restart it. Ask before clearing `.next`, and run `ss -ltnp` first.
- **Shared working tree.** Other sessions commit on this branch.
  - Never `git add -A` / `.`, stash, `checkout --`, `restore`, `reset`, `--amend`, merge or push. Never stage, revert or "fix" another session's hunks.
  - Never stage `docs/**` or `CONTEXT.md`.
  - Commit by explicit path, and only if the owner answered yes to committing per task. Run `git diff --cached` before every commit and before every subagent dispatch.
  - `git commit -- <path>` commits the whole working-tree file. If `git diff <path>` shows another session's hunks, stage only your hunks with `git apply --cached <patch>` and run a bare `git commit`.
  - The pre-commit hook runs about 110 s against a 120 s timeout, so batch each task's paths into one commit.
  - Check `git show --stat HEAD` after every commit. After a scripted edit, check `git diff --shortstat` (no target file is CRLF today).
  - `.superpowers/` is gitignored: the Playwright check stays local and is never committed.
- **Files off limits:**
  - `package.json`, eslint and tsconfig.
  - `src/shared/components/scene/**`, `src/shared/components/ui/**`, `globals.css`.
  - Any DAL, `src/trpc/**`, schema, seeds.
  - Ask before editing any file this plan does not name.
- **Conventions:**
  - One component per file, named exports.
  - Constants in `constants/`, pure helpers in `lib/`. Contexts in `contexts/`, with their reader hook in `hooks/` (as `scene-targets-context.tsx` / `use-scene-targets.ts`).
  - Feature types in `src/features/trade-scenes/types.ts`; core types in `src/shared/modules/construction/core/types.ts`.
  - Comments say why, never what. No banners, and never cite plans, specs, tracker ids or tasks from code.
  - Match the idiom of `bills-footer.tsx`, `controls-window.tsx` and `scene-savings.ts`.
- **Copy:**
  - Every scene-side string goes in `BENEFITS_COPY` in `constants/home-scene-copy.ts`. Reuse what exists rather than redefining it: `SAVINGS_COPY.billSuffix` ("/mo"), `.repairsSuffix` ("/yr"), `.disclosure`, `HOME_SYSTEM_LABELS`, `WEAR_LABELS`, `CLIMATE_LABELS`.
  - Benefit statements go in the registry, word for word from spec §3.3; derived lines word for word from spec §3.4.
  - Never "your", never solar. Percentages only through `formatRowClaim` / `formatCompoundClaim`.
  - **Copy functions take at most 3 string-safe arguments.** The copy walk at `verify-trade-scene.ts:853-882` calls each one with `SAMPLE_ARGS`. Pass an object as the single argument where more values are needed.
- **Names:** the CONTEXT.md terms: Kind of benefit (`BenefitKind`), Benefit statement (`UpgradeBenefit`), Upgrade registry (`UPGRADE_REGISTRY`), Benefit line (`BenefitLine`), Upkeep, Today's costs, Two futures, future saving.
  - In code, upkeep figures keep the existing `repairs*` names (`REPAIRS_PER_YEAR`, `repairsOverrides`).
  - The sides stay `existing` / `proposed`; "Today" and "Tri Pros build" are copy only.
  - Never name a type `Benefit`: the catalog's `benefits` table owns that name (`db/schema/benefits.ts:32`).
- **Tokens only** (read `docs/design-system/theme-conventions.md` before the first class string, and run its §12 self-check on your own files before each UI commit). The stage is dark-scoped (`SCENE_STAGE_CLASS`). Mock → app:

  | Mock | App |
  |---|---|
  | `--m-card` (window) | `bg-card` (the Controls window already is) |
  | `--m-ground` (rail panel) | `bg-band` (not `surface-well`, which fails inside a rung-1 window); judge by eye against the mock |
  | `--m-raised` (editor and "?" panel) | `bg-popover` |
  | `--m-edge` / `--m-pop` | `border-border` / `border-border-strong` |
  | `--m-fg` / `--m-fg-2` | `text-foreground` / `text-muted-foreground` |
  | `--m-primary` | `primary` (dots, the With columns, the picked year) |
  | `--m-without` | `var(--chart-5)` (spec §3.2) |
  | `--m-success` | `toneClasses('success').text` |
  | `--m-attention` ("Area missing") | `toneClasses('attention').text` |
  | Pressed heads, cells and the picked year | the `aria-pressed:` / `aria-checked:` states `CONTROLS_CLASSES.railChip` uses |
- **Motion:**
  - The matrix ↔ rail width change: 280 ms `cubic-bezier(0.4, 0, 0.2, 1)` (`mock:873`).
  - Every other transition: `CONTROLS_EASE` (`constants/scene-layout.ts:19`), 160–280 ms.
  - The readout counts from the old figure to the new over 520 ms, using motion's `animate(from, to)`. Not `CountUpStat`, which only counts up from 0.
  - Under `prefers-reduced-motion: reduce`, every change is instant.
- **Focus:** whatever closes (the "?", the editor, the rail) hands focus back to the control that opened it, as Modify does with `searchRef.focus()`.
- **Accessibility:** hit targets ≥ 40 px (the Controls' `floorFailures` check). Everything is keyboard-reachable and has an accessible name.
- **Verification recipe:**
  - Logic: `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsx scripts/verify-bill-cut-claims.ts`, and `pnpm tsx scripts/verify-energy-impact.ts` if it exists by then.
  - UI: `node .superpowers/sdd/2026-11-03-trade-scene-benefits/benefits-check.mjs` against `http://localhost:3002`. Base its launch, sign-in, stage wait and per-frame sampling on `.superpowers/sdd/2026-11-01-trade-scene-controls/controls-check.mjs`.
  - Sign-in: `/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET from .env.local>&as=info%40triprosremodeling.com&redirect=/dashboard/trade-scene`. Never `role=`. Never print the secret, the URL or a token: scrub every logged error message of the secret.
  - Every screen in light and dark, at 1280 and 390, plus the viewports Task 11 lists, with your own screenshots. No console errors on any of them.

## Review Focus

1. **A home with no gas bill:** typing $0 gas keeps $0 (D20). Without and With show no gas, and no title, figure or line claims a gas saving (Task 3, Task 5).
2. **A gutters-only, redeck-only or flat-roof tear-off build** shows no "Roof upkeep ends" and keeps the roof's repairs in With (D19). A shingle tear-off or a tile reset still ends them (Task 2, Task 5).
3. **Picks across systems:** each system's Savings line compounds only its own cuts, so the lines add up to more than the build saves. The readout, the Savings kind head and the rail's Savings header all read one figure, year 1's `saves`, and never that sum (Task 5, Task 6, Task 10).
4. **Look-ahead at the ends:** year 1 reads "Now" and equals today's costs; year 10 is the last column; the arrow keys stop at Now and at the last year without wrapping (Task 6, Task 9).
5. **Escape with everything open:** with the "?" open over the costs editor over a selection, closing the window takes four presses, one layer each, and focus returns to the opener after each (Task 7, Task 10).

---

## Rulings (where the spec, the mock and the code meet, and what the plan does)

| # | What | Ruling | Why |
|---|---|---|---|
| P1 | Where the registry's types go | `UpgradeBenefit` and `UpgradeEntry` go in core `types.ts`; `upgrade-registry.ts` holds only the constant. | Core keeps its interfaces in `types.ts` (`ScopeInstall`, `HomeMaterialDefinition`). |
| P2 | The rail's "from" line and each system row's upgrade line | `UpgradeEntry.name` uses the upgrade headings the owner reviewed in the statements page (Roof tear-off … Crawl space insulation; Task 4 lists them). A verify check pins one entry per `SCOPE_IDS` value. | The catalog's scope names load async and can be missing offline. These are the names the owner saw beside every statement. |
| P3 | D19's mechanism | `HomeMaterialDefinition` gains `repairsEndWith`. `landed()` reads it instead of `parts`, which `part-offers.ts:76` still uses. | Spec §8. |
| P4 | D20 for bills | Already true: `MoneyField` emits `0` for a typed 0 and `null` only when cleared, and `sceneSavings` uses `now ??`. Task 3 pins it. | `money-field.tsx:31`, `scene-savings.ts:86`. |
| P5 | Today's materials | `repairsRows(property, useSceneTargets().home)`. The scene already resolves them once (`resolve-scene.ts:94`). | No second resolve. |
| P6 | The chart | recharts `BarChart` in `ChartContainer`, loaded with `next/dynamic` and a skeleton at the band's fixed height. Two `Bar`s (`without`, `with`) over a `data` array memoized on the figures only, so its identity holds across year changes. The picked pair is lit through the bars' `shape`, and the bracket is drawn the same way; no new data per step, no tooltip. The year axis is a shadcn `RadioGroup` under the plot (`mock:701-709`), `loop={false}`. | The recharts recipe in memory `reference-chart-touch-tooltips.md` (fresh data replays the bar animation and remounts every rect). Reference implementations: `bills-by-category-chart.tsx`, `segment-rect.tsx`. Nothing in trade-scenes imports recharts yet. |
| P7 | The phone rail | The same `BenefitsRail`, absolutely over the matrix area, with opacity and a 12 px rise over 200 ms and no width change (`mock:817-819`). | Spec D14. |
| P8 | `CONTROLS_COPY.benefits` | Its coming-soon and bills strings go. `tag`, `areaMissing` and `toast` move into `BENEFITS_COPY`, and every reader moves with them, including `controls-toast.tsx:28`. | No aliases (owner's migration rule). |
| P9 | Growth over the years (R227) | `BILL_GROWTH_RATES_PERCENT` (`core/constants/bill-growth-rates.ts`), `CONSTRUCTION_GROWTH_RATE_PERCENT` (`core/constants/construction-growth-rate.ts`), `projectBillYears` and `BillYear`, with the energy-impact plan's exact interface. The calculator's year loop and the two futures both run on `projectBillYears`; upkeep is a third series at the construction rate. Spec §4.2's `price-rises.ts` and `growForYear` are replaced. | Owner, 2026-11-03: one shared source in `modules/construction` for both use cases, no thin implementations. |
| P10 | A line in the Benefits window | `BenefitLine` (CONTEXT.md "Benefit line"). | Owner, 2026-11-03; `Benefit` is the catalog table's type. |
| P11 | Files outside the spec (R227) | Allowed: `verify-bill-cut-claims.ts`, `resolve-assembly.ts`, `upgrade-rows.ts`, `combine-cuts.ts`, `controls-toast.tsx`, `controls-check.mjs`, `project-remodel-roi.ts`, `savings-figures.ts` (deleted). | Owner, 2026-11-03. |
| P12 | The R-value disclosure (R227) | "Savings vary." (`SAVINGS_COPY.disclosure.vary`) closes every Savings group in the rail and the "?" panel. The R-value line (`.rValue`) replaces it when an insulation upgrade is picked. Both stay marked pending verification in the copy file, as now. | Owner, 2026-11-03. Release stays blocked on the sign-off (tracker line 72). |
| P13 | The build's saving now | One figure: `futureYear(today, after, 1).saves`, with each side's bills rounded on its own (the calculator's rule, now in `todayCosts`/`afterCosts`). `savingsFigures` has no screen reader; its "landed" gate hides every figure for a bills-only build, so it is deleted with its assertions (`verify-trade-scene.ts:334-345`). | Stress test: three places rounding their own way would differ by a dollar. |
| P14 | The plan's signatures vs spec §4.4 | `pickedUpgrades(facts, picks, efficiencyUpgrades)` from `upgradeRows`; `todayCosts(savings, repairs, overrides)`; `BenefitLine.figure: number \| null` and `.soon: boolean` are required; `twoFutures` becomes `futureYear` (it returns one year). | Reuse of existing primitives; the spec's names were sketches. |

---

### Task 1: One shared source for growth over the years

**Files:**
- Create: `src/shared/modules/construction/core/constants/bill-growth-rates.ts`, `core/constants/construction-growth-rate.ts`, `core/lib/project-bill-years.ts`
- Modify: `src/shared/modules/construction/core/types.ts` (`BillYear`)
- Modify: `src/features/calculators/remodel-roi-calculator/constants/config-defaults.ts:7-11`
- Modify: `src/features/calculators/remodel-roi-calculator/lib/project-remodel-roi.ts:128-131`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces, exactly as `2026-10-21-proposal-energy-impact-foundation.md:431,505-510`:

```ts
export const BILL_GROWTH_RATES_PERCENT = { electric: 7.57, water: 8.9, gas: 9.1, gardening: 5, misc: 0 } as const satisfies Record<BillCategory, number>
export interface BillYear<C extends string> { t: number, billsNow: Record<C, number>, billsAfter: Record<C, number> }
export function projectBillYears<C extends string>(bills: Record<C, { now: number, after: number }>, growthPercent: Record<C, number>, years: number): BillYear<C>[]
```

  It returns `t = 0..years`, with every value 0 at `t = 0`. At `t ≥ 1`, `billsNow[c] = now × (1 + g_c/100)^(t−1)`, and `billsAfter[c]` likewise from `after`.
- Also produces `CONSTRUCTION_GROWTH_RATE_PERCENT = 5`.

- [ ] **Step 1: Write the failing assertions** at the end of `verify-trade-scene.ts`, before the final `console.log`:

```ts
{
  assert.deepEqual(REMODEL_ROI_CONFIG_DEFAULTS.defaultRatesPercent, BILL_GROWTH_RATES_PERCENT, 'the calculator reads the core rates')
  assert.equal(REMODEL_ROI_CONFIG_DEFAULTS.defaultConstructionPercent, CONSTRUCTION_GROWTH_RATE_PERCENT)
  const billYears = projectBillYears({ electric: { now: 300, after: 213.75 } }, { electric: 7.57 }, 3)
  assert.equal(billYears.length, 4)
  assert.deepEqual(billYears[0], { t: 0, billsNow: { electric: 0 }, billsAfter: { electric: 0 } })
  near(billYears[1].billsNow.electric, 300, 1e-9, 'year 1 is today\'s bill')
  near(billYears[3].billsAfter.electric, 213.75 * 1.0757 ** 2, 1e-9, 'year 3 compounds twice')
  const form = createRemodelRoiDefaults(roiConfig)
  form.bills.electric = { now: 300, cut: { mode: 'trades', value: null } }
  const years = projectRemodelRoi(form, roiConfig).years
  near(years[5].billsNowByCategory.electric, 300 * 1.0757 ** 4, 1e-9, 'the calculator\'s year 5 is unchanged')
}
```

  `roiConfig` is the script's existing config (`verify-trade-scene.ts:349`).
- [ ] **Step 2: Run** `pnpm tsx scripts/verify-trade-scene.ts`. Expected: FAIL, the imports don't resolve.
- [ ] **Step 3: Implement.**
  - The rates file carries the comment "The team's estimate from thousands of customer bills analysed over the years; editable in the calculator." The construction file carries "The team's working estimate until a sourced construction-cost index replaces it."
  - `config-defaults.ts`: `defaultRatesPercent: { ...BILL_GROWTH_RATES_PERCENT }` and `defaultConstructionPercent: CONSTRUCTION_GROWTH_RATE_PERCENT`. The comments move with the numbers.
  - `project-remodel-roi.ts`: compute `const billYears = projectBillYears(byCategory(c => ({ now: cuts[c].bill, after: cuts[c].after })), byCategory(c => assumptions.ratesPercent[c].value), PROJECTION_YEARS)` once before the loop. Inside it, `billsNowByCategory = billYears[t].billsNow` and `billsAfterByCategory = billYears[t].billsAfter`. Everything else in the loop stays.
- [ ] **Step 4: Run** the verify script. Expected: `verify-trade-scene: ok`; the existing ROI-parity assertions (`:357-372`) stay green. Then `pnpm tsc` under the lock.
- [ ] **Step 5: Commit** `feat(construction): bill growth rates and projectBillYears live in core, and the ROI calculator's years run on them`.

### Task 2: Upkeep ends only when the build replaces the material itself (D19)

**Files:**
- Modify: `src/shared/modules/construction/core/types.ts:188-198` (`HomeMaterialDefinition`)
- Modify: `src/shared/modules/construction/core/constants/home-materials.ts`
- Modify: `src/features/trade-scenes/lib/scene-savings.ts:35-36,64-70`
- Test: `scripts/verify-trade-scene.ts:290-299`

**Interfaces:**
- Produces `HomeMaterialDefinition.repairsEndWith: readonly { assembly: AssemblyId, part: string }[]`:
  - roof: `covering` only.
  - windows: `frame`, `glazing`.
  - exterior-paint: `paint`.
  - heating-cooling: its current four parts.
  - Every `repairs: false` material: `[]`.

- [ ] **Step 1: Change the failing assertions.**
  - In the `noCoolCovering` loop (`:296-299`), split the repairs line by case. Redeck, gutters and flat + tear-off (whose flat roof draws no covering): `assert.equal(scene.savings.repairsByTrade['roof-and-gutters'], undefined, \`${name}: no new covering, so the roof's upkeep runs on\`)`. Tile reset keeps the existing `assert.ok`.
  - Add:

```ts
const wornRoofHome = { homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { roof: 'worn' } } } as const
const guttersAndRedeck = resolveScene(inputs({ ...wornRoofHome, property: profile({ roofType: 'shingle' }), view: 'proposed', proposedScopeIds: [GUTTERS, REDECK] }), cuts).savings
assert.deepEqual(guttersAndRedeck.repairsByTrade, {}, 'gutters and a redeck leave the roof\'s upkeep running')
for (const id of HOME_MATERIAL_IDS) {
  const { repairs, repairsEndWith, parts } = HOME_MATERIALS[id]
  assert.equal(repairsEndWith.length > 0, repairs, `${id}: only a material with upkeep names the parts that end it`)
  assert.ok(repairsEndWith.every(end => parts.some(part => part.assembly === end.assembly && part.part === end.part)), `${id}: they are its own parts`)
}
```

- [ ] **Step 2: Run** the verify script. Expected: FAIL at "redeck: no new covering…".
- [ ] **Step 3: Implement.** Add the field, with the why-comment "the part that is the material: a new gutter is not a new roof". In `landed()`, read `repairsEndWith` instead of `parts`. Update the comment above `landed()` to say repairs end only for a part that is the material itself.
- [ ] **Step 4: Run** the verify script and `pnpm tsc`. Expected: ok. The `wornRoof` repairs assertions (`:325-332`) stay green, since a shingle tear-off draws the covering.
- [ ] **Step 5: Commit** `fix(construction): a material's upkeep ends only when the build replaces the material itself, so gutters or a redeck no longer end the roof's`.

### Task 3: The repairs scene change, and $0 is a real $0 (D20)

**Files:**
- Modify: `src/features/trade-scenes/types.ts:560-572` (`SceneChange`)
- Modify: `src/features/trade-scenes/lib/apply-scene-change.ts:62-64`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces the `SceneChange` member `{ kind: 'repairs', trade: TradeSlug, perYear: number | null }`. `applySceneChange` returns `{ repairsOverrides: { ...state.repairsOverrides, [change.trade]: change.perYear } }`.

- [ ] **Step 1: Write the failing assertions** next to the existing `applySceneChange` checks (`YEAR` is the script's, `:449`):

```ts
{
  const base = inputs({ homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { roof: 'worn' } } })
  const step = (state: TradeSceneInputs, perYear: number | null) => ({ ...state, ...applySceneChange(state, { kind: 'repairs', trade: 'roof-and-gutters', perYear }, YEAR) })
  const typed = step(base, 900)
  assert.equal(typed.repairsOverrides['roof-and-gutters'], 900)
  assert.equal(step(typed, 0).repairsOverrides['roof-and-gutters'], 0, 'a typed 0 is kept')
  assert.equal(step(typed, null).repairsOverrides['roof-and-gutters'], null, 'cleared goes back to the working figure')
  const noGas = resolveScene(inputs({ property: profile({ roofType: 'shingle' }), view: 'proposed', proposedScopeIds: [TEAR_OFF], bills: { ...BILLS, gas: { now: 0, cut: { mode: 'trades', value: null } } } }), cuts).savings
  assert.equal(noGas.cuts.gas.bill, 0, 'a typed $0 gas bill stays $0, not the area default')
  assert.equal(noGas.cuts.gas.after, 0)
}
```

- [ ] **Step 2: Run** it. Expected: FAIL; `tsc` rejects `kind: 'repairs'`.
- [ ] **Step 3: Implement** the union member and its `case`.
- [ ] **Step 4: Run** the verify script and `pnpm tsc`. Expected: ok.
- [ ] **Step 5: Commit** `feat(trade-scenes): a repairs scene change sets one trade's yearly repairs, and a typed $0 stays $0`.

### Task 4: The upgrade registry, on one shared swap rule

**Files:**
- Create: `src/shared/modules/construction/core/constants/benefit-kinds.ts`, `core/constants/upgrade-registry.ts`, `core/lib/installed-material.ts`, `core/lib/fill-benefit-text.ts`
- Modify: `src/shared/modules/construction/core/types.ts` (P1)
- Modify: `src/shared/modules/construction/core/lib/resolve-assembly.ts:56`, `src/features/trade-scenes/lib/upgrade-rows.ts:19` (both onto `installedMaterialId`)
- Modify: `scripts/verify-bill-cut-claims.ts:66-75` (`COPY_FILES` gains `src/shared/modules/construction/core/constants/upgrade-registry.ts` and `src/features/trade-scenes/constants/home-scene-copy.ts`)
- Test: `scripts/verify-trade-scene.ts`, `scripts/verify-bill-cut-claims.ts`

**Interfaces:**
- Produces:
  - `BENEFIT_KINDS`, `BenefitKind`, `WrittenBenefitKind` (spec §4.1), plus `BENEFIT_KIND_LABELS: Record<BenefitKind, string>` beside them, as core keeps labels beside ids (`bill-categories.ts:5`). The labels are Savings, Easier on HVAC, Protection, Lasts longer, Warranty, Looks & use, Planet.
  - `interface UpgradeBenefit { kind: WrittenBenefitKind, title: string, detail: string, onlyWith?: EfficiencyUpgradeId, onlyWithout?: EfficiencyUpgradeId }`.
  - `interface UpgradeEntry { name: string, benefits: readonly UpgradeBenefit[] }`.
  - `UPGRADE_REGISTRY: Record<ScopeId, UpgradeEntry>`, total over all 18 `SCOPE_IDS`. The names are: Roof tear-off, Roof overlay, Torch down, Tile reset, Redeck, Gutters, Attic insulation (replacement), Attic insulation (top-off), Radiant barrier, Air sealing, Attic fan, Window replacement, Cool Life repaint, Water-based repaint, Split system replacement, Package unit replacement, Air ducts replacement, Crawl space insulation.
  - `installedMaterialId(install: ScopeInstall['installs'][number], efficiencyUpgrades: readonly EfficiencyUpgradeId[]): string` returns `efficiencyUpgrades.flatMap(upgrade => install.swapsWith?.[upgrade] ?? []).at(0) ?? install.material`.
  - `installedMaterial(scopeId: ScopeId, efficiencyUpgrades: readonly EfficiencyUpgradeId[]): PartMaterialDefinition` returns the first install's material definition after the swap.
  - `fillBenefitText(text: string, material: PartMaterialDefinition): string`. It fills `{material}` with the copy label, its first letter lowered unless it starts with "R-", and `{rValue}` with `R-${thermal.rValue}`.

- [ ] **Step 1: Write the failing assertions:**

```ts
{
  const placeholder = /\{(?:material|rValue)\}/
  for (const scopeId of Object.values(SCOPE_IDS)) {
    const entry = UPGRADE_REGISTRY[scopeId]
    assert.ok(entry.benefits.length > 0, `${entry.name}: at least one statement`)
    for (const benefit of entry.benefits) {
      for (const text of [benefit.title, benefit.detail]) {
        assert.ok(!/\byour\b/i.test(text) && !/solar/i.test(text), `${entry.name}: copy rules`)
        for (const upgrade of [null, ...EFFICIENCY_UPGRADE_IDS]) {
          assert.ok(!placeholder.test(fillBenefitText(text, installedMaterial(scopeId, upgrade ? [upgrade] : []))), `${entry.name}: every placeholder fills`)
        }
      }
      for (const upgrade of [benefit.onlyWith, benefit.onlyWithout].filter(id => id !== undefined)) {
        assert.ok(offersEfficiencyUpgrade([scopeId], upgrade), `${entry.name}: ${upgrade} applies to this upgrade`)
      }
    }
  }
  for (const scopeId of [SCOPE_IDS.atticInsulationReplacement, SCOPE_IDS.atticInsulationTopOff]) {
    const filled = fillBenefitText(UPGRADE_REGISTRY[scopeId].benefits[0].detail, installedMaterial(scopeId, []))
    assert.ok(filled.includes(`R-${installedMaterial(scopeId, []).thermal.rValue}`), 'the insulation statement names the R-value installed')
  }
  assert.equal(UPGRADE_REGISTRY[SCOPE_IDS.roofTileReset].benefits.some(benefit => benefit.kind === 'warranty'), false, 'the tile reset carries no warranty line')
}
```

  In `verify-bill-cut-claims.ts`, the two new `COPY_FILES` entries must pass as they are. `home-scene-copy.ts` has no literal `N%` today.
- [ ] **Step 2: Run** both scripts. Expected: `verify-trade-scene` FAILs on the imports.
- [ ] **Step 3: Implement.**
  - Transcribe every row of spec §3.3 word for word, in order, with its `onlyWith` / `onlyWithout`. The torch down warranty's parenthesis is a spec note, not copy: its detail is only "The Tri Pros workmanship warranty."
  - Move `resolve-assembly.ts:56` and `upgrade-rows.ts:19` onto `installedMaterialId`, with no behaviour change.
  - Add the registry's strings to the copy scan (`copyStrings`, `verify-trade-scene.ts:861`).
- [ ] **Step 4: Run** the verify script, the claims script and `pnpm tsc`. Expected: ok, with every existing assertion green (the swap moves without changing behaviour).
- [ ] **Step 5: Commit** `feat(construction): the upgrade registry holds each upgrade's owner-approved benefit statements, and one helper resolves an efficiency swap`.

### Task 5: The build's benefit lines, per system and kind

**Files:**
- Create: `src/features/trade-scenes/constants/benefit-systems.ts`
- Create: `src/features/trade-scenes/lib/picked-upgrades.ts`, `lib/system-cuts.ts`, `lib/build-benefits.ts`
- Modify: `src/shared/modules/construction/core/lib/combine-cuts.ts` (export `compoundCut`; `combineCuts` uses it)
- Modify: `src/features/trade-scenes/types.ts` (`BenefitLine`)
- Modify: `src/features/trade-scenes/constants/home-scene-copy.ts` (`BENEFITS_COPY.savings`, `.upkeep`, `.planet`)
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `UPGRADE_REGISTRY`, `fillBenefitText`, `installedMaterial`, `BENEFIT_KIND_LABELS` (Task 4); `upgradeRows`, `upgradeRowState`; `SceneSavings`; `RepairsRow`.
- Produces:
  - `compoundCut(parts: readonly CutPart[]): number` returns `1 − Π(1 − p.percent/100)`.
  - `TRADE_SYSTEM: Record<TradeSlug, HomeSystemId | null>`: roof-and-gutters → roof, attic-and-basement → attic, windows-and-doors → windows, exterior-paint-stucco-and-siding → walls, hvac → heating-cooling, foundation-and-crawl-space → foundation, every other trade → `null`.
  - `ADD_ON_SYSTEM: Record<BillCutAddOnId, HomeSystemId>`: ducts → heating-cooling, radiant-barrier → attic, attic-fan → attic.
  - `pickedUpgrades(facts: HomeFacts, picks: readonly string[], efficiencyUpgrades: readonly EfficiencyUpgradeId[]): Record<HomeSystemId, ScopeId[]>`. It is built from `upgradeRows` + `upgradeRowState(...).picked`, as `systems-rail.tsx:35-37` does, so the order is `HOME_SYSTEMS`' order.
  - `systemCuts(savings: SceneSavings): Partial<Record<HomeSystemId, Partial<Record<SavingsCategory, { percent: number, monthly: number }>>>>`. Each bill's parts are grouped by system and passed to `compoundCut`. A bill whose `savings.cuts[c].bill` is 0 is left out (D20: a bill that isn't there earns no claim).
  - `buildBenefits({ facts, picks, savings, repairs, efficiencyUpgrades }): BenefitLine[]`.
  - `interface BenefitLine { system: HomeSystemId, kind: BenefitKind, title: string, detail: string, from: string | null, figure: number | null, soon: boolean }`. `from` is the upgrade's `name`, or `null` on derived lines; `figure` is $/mo.

- [ ] **Step 1: Write the failing assertions.** Set every repairs-carrying material's wear except the roof to `'new'`, so only the roof carries repairs (unset wear reads Failing).

```ts
{
  const roofOnlyWorn = { homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { 'roof': 'worn', 'windows': 'new', 'exterior-paint': 'new', 'heating-cooling': 'new' } } } as const
  const shingle = profile({ roofType: 'shingle' })
  const facts = { property: shingle, materials: roofOnlyWorn.homeMaterials, year: currentYear() }
  const roofAndAttic = [TEAR_OFF, ATTIC_REPLACEMENT, RADIANT_BARRIER]
  const picks = pickedUpgrades(facts, roofAndAttic, ['cool-roof'])
  assert.deepEqual(picks.roof, [TEAR_OFF])
  assert.deepEqual(picks.attic, [RADIANT_BARRIER, ATTIC_REPLACEMENT], 'in the Upgrades list\'s order')

  const scene = resolveScene(inputs({ ...roofOnlyWorn, property: shingle, view: 'proposed', proposedScopeIds: roofAndAttic, efficiencyUpgrades: ['cool-roof'], bills: BILLS }), cuts)
  const bySystem = systemCuts(scene.savings)
  for (const category of SAVINGS_CATEGORIES) {
    const kept = Object.values(bySystem).reduce((product, cut) => product * (1 - (cut[category]?.percent ?? 0) / 100), 1)
    near(1 - kept, scene.savings.cuts[category].combined, 1e-12, `${category}: the systems' cuts compound to the build's`)
  }

  const lines = buildBenefits({ facts, picks, savings: scene.savings, repairs: repairsRows(shingle, scene.home), efficiencyUpgrades: ['cool-roof'] })
  assert.ok(lines.some(line => line.system === 'roof' && line.kind === 'warranty' && line.title === 'Owens Corning Duration COOL'), 'onlyWith cool-roof shows with it on')
  assert.ok(!lines.some(line => line.title === 'New shingles'), 'onlyWithout cool-roof hides with it on')
  const upkeep = lines.find(line => line.system === 'roof' && line.title === 'Roof upkeep ends')!
  assert.equal(upkeep.detail, 'Keeping up the old roof costs about $400 a year (Worn). The new one starts that at zero.')
  assert.equal(upkeep.figure, 33)
  assert.equal(lines.find(line => line.system === 'roof' && line.kind === 'savings' && line.from === null && line !== upkeep)!.title, 'Electric about 8% lower')
  assert.ok(lines.some(line => line.system === 'roof' && line.kind === 'planet' && line.soon))

  const noGas = resolveScene(inputs({ ...roofOnlyWorn, property: shingle, view: 'proposed', proposedScopeIds: [ATTIC_REPLACEMENT], bills: { ...BILLS, gas: { now: 0, cut: { mode: 'trades', value: null } } } }), cuts)
  const noGasLines = buildBenefits({ facts, picks: pickedUpgrades(facts, [ATTIC_REPLACEMENT], []), savings: noGas.savings, repairs: repairsRows(shingle, noGas.home), efficiencyUpgrades: [] })
  assert.ok(noGasLines.every(line => !/gas/i.test(line.title)), 'a $0 gas bill earns no gas claim')

  const repaint = resolveScene(inputs({ view: 'proposed', proposedScopeIds: [SCOPE_IDS.waterBasedRepaint], bills: BILLS }), cuts)
  const repaintFacts = { property: HOME_SCENE_DEFAULTS.property, materials: HOME_SCENE_DEFAULTS.homeMaterials, year: currentYear() }
  const likeForLike = buildBenefits({ facts: repaintFacts, picks: pickedUpgrades(repaintFacts, [SCOPE_IDS.waterBasedRepaint], []), savings: repaint.savings, repairs: repairsRows(HOME_SCENE_DEFAULTS.property, repaint.home), efficiencyUpgrades: [] })
  assert.ok(!likeForLike.some(line => line.kind === 'planet'), 'a like-for-like build has no Planet dot')
  assert.ok(likeForLike.some(line => line.title === 'Paint upkeep ends'), 'its upkeep still ends')
}
```

  Also assert:
  - The attic pair's two-bill Savings title: "Electric about 15%, gas about 17% lower".
  - For every `SCOPE_INSTALLS` entry, `TRADE_SYSTEM[entry.trade]` equals the system `pickedUpgrades` files it under.
  - For every add-on material's `cut`, `ADD_ON_SYSTEM` maps it to that part's system.
- [ ] **Step 2: Run** it. Expected: FAIL on the imports.
- [ ] **Step 3: Implement.**
  - `buildBenefits`, per system in `HOME_SYSTEMS` order:
    1. The registry statements of its picks, filtered by `onlyWith` / `onlyWithout` and filled with `installedMaterial`.
    2. One Savings line when `systemCuts` has a bill for it (spec §3.4).
    3. One upkeep line per `savings.repairsByTrade` entry whose value is above 0. It takes the noun from `BENEFITS_COPY.upkeep[materialId]` and the wear from the matching `RepairsRow`, and reads "(typed)" when `source === 'input'`.
    4. One Planet line when one of the system's picked rows is `saves-energy` in `HomeSystemRow.kinds` (the classifier `upgrade-rows.ts:14` already applies).
  - Copy goes in `BENEFITS_COPY` exactly as spec §3.4, with every function taking at most 3 arguments.
- [ ] **Step 4: Run** the verify script, the claims script and `pnpm tsc`. Expected: ok.
- [ ] **Step 5: Commit** `feat(trade-scenes): the build's benefit lines per system and kind, from the registry and the savings`.

### Task 6: Today's costs, the two futures, one saving, and the year labels

**Files:**
- Create: `src/features/trade-scenes/lib/today-costs.ts`, `lib/future-year.ts`, `lib/year-label.ts`, `constants/look-ahead.ts`
- Modify: `src/features/trade-scenes/types.ts` (`MonthlyCosts`, `FutureYear`)
- Delete: `src/features/trade-scenes/lib/savings-figures.ts`, its import (`verify-trade-scene.ts:98`) and its assertions (`:334-345`) (P13)
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `projectBillYears`, `BILL_GROWTH_RATES_PERCENT`, `CONSTRUCTION_GROWTH_RATE_PERCENT` (Task 1); `repairsFigure`.
- Produces:
  - `interface MonthlyCosts { electric: number, gas: number, repairs: number, total: number }`, monthly. Each bill is rounded on its own; repairs is `repairsFigure(...).monthly`; total is their sum.
  - `todayCosts(savings: SceneSavings, repairs: readonly RepairsRow[], overrides: TradeSceneInputs['repairsOverrides']): MonthlyCosts` reads the bills from `Math.round(savings.cuts[c].bill)` and the repairs from `repairsFigure(repairs, overrides)`.
  - `afterCosts(...)` takes the same arguments. Its bills come from `Math.round(savings.cuts[c].after)`; its repairs are `repairsFigure(repairs.filter(row => !(row.trade in savings.repairsByTrade)), overrides)`.
  - `interface FutureYear { year: number, without: MonthlyCosts, with: MonthlyCosts, saves: number }`.
  - `futureYear(today: MonthlyCosts, after: MonthlyCosts, year: number): FutureYear` runs `projectBillYears({ electric, gas, repairs }, { electric: BILL_GROWTH_RATES_PERCENT.electric, gas: BILL_GROWTH_RATES_PERCENT.gas, repairs: CONSTRUCTION_GROWTH_RATE_PERCENT }, year)[year]`. The totals are summed, and `saves = without.total − with.total`.
  - `yearLabel(year: number, now?: number): string` returns "Now" for 1, else `String(now + year)`, with `now` defaulting to `currentYear()`. D8 labels each year by the year it ends in (owner, R218/R219).
  - `LOOK_AHEAD = { default: 5, min: 1, max: 10 } as const`.

- [ ] **Step 1: Write the failing assertions:**

```ts
{
  assert.equal(yearLabel(1, 2026), 'Now')
  assert.equal(yearLabel(5, 2026), '2031')
  assert.equal(yearLabel(10, 2026), '2036')
  const today = { electric: 300, gas: 120, repairs: 50, total: 470 }
  const after = { electric: 210, gas: 120, repairs: 0, total: 330 }
  const now = futureYear(today, after, 1)
  assert.deepEqual(now.without, today, 'year 1 is today')
  assert.equal(now.saves, 140)
  const year5 = futureYear(today, after, 5)
  near(year5.without.electric, 300 * 1.0757 ** 4, 1e-9, 'electric at its rate')
  near(year5.without.gas, 120 * 1.091 ** 4, 1e-9, 'gas at its rate')
  near(year5.without.repairs, 50 * 1.05 ** 4, 1e-9, 'upkeep at the construction rate')
  const form = createRemodelRoiDefaults(roiConfig)
  form.bills.electric = { now: 300, cut: { mode: 'trades', value: null } }
  form.bills.gas = { now: 120, cut: { mode: 'trades', value: null } }
  const calculatorYear5 = projectRemodelRoi(form, roiConfig).years[5]
  near(calculatorYear5.billsNowByCategory.electric, year5.without.electric, 1e-9, 'year 5 electric matches the calculator\'s')
  near(calculatorYear5.billsNowByCategory.gas, year5.without.gas, 1e-9, 'year 5 gas matches the calculator\'s')
}
```

  Add `todayCosts` / `afterCosts` checks on the Task 5 fixture, repeating it, since that block's variables are out of scope here:
  - Roof Worn, the rest New, no override: today's repairs are 33 and the total is 300 + 120 + 33.
  - With `repairsOverrides['roof-and-gutters'] = 0`: repairs are 0, the typed $0 kept.
  - `afterCosts` on a tear-off drops the roof's repairs; on gutters alone it keeps them (D19).
  - `futureYear(today, after, 1).saves === today.total − after.total`, the one saving figure (P13).
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement** the files and delete `savings-figures.ts` with its import and assertions. Run `grep -rn savingsFigures src scripts`; expect nothing.
- [ ] **Step 4: Run** the verify script and `pnpm tsc`. Expected: ok.
- [ ] **Step 5: Commit** `feat(trade-scenes): today's costs and the two futures on the shared bill projection, with one saving figure`.

### Task 7: Benefits state, and Escape steps back

**Files:**
- Create: `src/features/trade-scenes/contexts/benefits-context.tsx`, `hooks/use-benefits.ts`, `lib/benefits-step-back.ts`
- Modify: `src/features/trade-scenes/types.ts` (`BenefitSelection`, `BenefitsState`)
- Modify: `src/features/trade-scenes/ui/views/trade-scene-view.tsx:63` (mount `BenefitsProvider` directly inside `SceneControlsProvider`)
- Modify: `src/features/trade-scenes/ui/components/controls/controls-window.tsx` (the benefits `onEscapeKeyDown`)
- Modify: `src/features/trade-scenes/constants/home-scene-copy.ts:213` (`SHORTCUT_COPY.lines.wholeHome`: "Step back: a menu, a Benefits detail, the system, the window, then the close-up")
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - `type BenefitSelection = { type: 'dot', system: HomeSystemId, kind: BenefitKind } | { type: 'system', system: HomeSystemId } | { type: 'kind', kind: BenefitKind }`.
  - `interface BenefitsState { selection: BenefitSelection | null, lookAhead: number, costsOpen: boolean, whyOpen: boolean }`.
  - `useBenefits(): BenefitsState & { select, setLookAhead, setCostsOpen, setWhyOpen, restore }`:
    - `select(selection | null)`: selecting the current selection again clears it.
    - `setLookAhead(year)`: clamped to `LOOK_AHEAD`.
    - `restore(state: BenefitsState)`: applies a whole state.
  - It is a separate context from `SceneControlsValue`, so a year step re-renders only Benefits' readers. That is the reason `ControlsOpenContext` is split out (`scene-controls-context.tsx:31`).
  - `benefitsStepBack(state: BenefitsState): BenefitsState | null`: whyOpen → costsOpen → selection, or `null` when nothing is left to close. `lookAhead` is untouched.
  - The provider reads `useControlsOpen()`. When `open` leaves `'benefits'`, it resets `selection`, `costsOpen` and `whyOpen` with React's "adjust state when a prop changes" pattern (a `previousOpen` state compared during render, no effect), and keeps `lookAhead` (spec §4.3).

- [ ] **Step 1: Write the failing assertions** for `benefitsStepBack`. From `{ selection: dot, lookAhead: 7, costsOpen: true, whyOpen: true }` it steps to `whyOpen: false`, then `costsOpen: false`, then `selection: null`, then `null`, with `lookAhead` 7 throughout.
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement.** In `controls-window.tsx`, the benefits section's `onEscapeKeyDown` calls `benefitsStepBack`. When it returns a state: `event.preventDefault()`, `restore(next)`, and return focus to the closed layer's opener. The opener's ref lives with the control that opened it, and the context exposes `openerRef` per layer.
- [ ] **Step 4: Run** the verify script, `pnpm tsc` and eslint. Expected: ok.
- [ ] **Step 5: Commit** `feat(trade-scenes): Benefits holds its selection, look-ahead and panels in its own context, and Escape steps back through them`.

### Task 8: The head row and the costs editor, and the bills footer goes

**Files:**
- Create: `src/features/trade-scenes/ui/components/benefits/benefits-head.tsx` (from `controls/benefits-head.tsx`, extended), `today-costs-line.tsx`, `costs-editor.tsx`, `costs-bill-row.tsx`, `costs-repairs-row.tsx`
- Create: `src/features/trade-scenes/contexts/benefits-figures-context.tsx`, `hooks/use-benefits-figures.ts`
- Modify: `controls-window.tsx` (the benefits content becomes `<BenefitsFiguresProvider><BenefitsHead /><BenefitsBody /></BenefitsFiguresProvider>` with today's `BenefitsBody`; no footer)
- Modify: `contexts/scene-controls-context.tsx` (`billsOpen` and `toggleBills` go)
- Modify: `constants/home-scene-copy.ts` (`BENEFITS_COPY.head`, `.editor`; the P8 bills strings go)
- Delete: `ui/components/controls/benefits-head.tsx`, `ui/components/controls/bills-footer.tsx`
- Test: `.superpowers/sdd/2026-11-03-trade-scene-benefits/benefits-check.mjs` (new)

**Interfaces:**
- Consumes: `todayCosts`, `afterCosts`, `buildBenefits`, `pickedUpgrades`, `repairsRows` (P5), `useBenefits` (Task 7), and `useApplySceneChange` with the `bill`, `climate` and `repairs` changes.
- Produces: `BenefitsFiguresProvider` and `useBenefitsFigures(): { today: MonthlyCosts, after: MonthlyCosts, repairs: RepairsRow[], repairsResolved: Partial<Record<TradeSlug, Resolved>>, lines: BenefitLine[], picks: Record<HomeSystemId, ScopeId[]> }`. It computes once per store write: `useSceneInputs(useShallow(...))` for `property`, `homeMaterials`, `proposedScopeIds`, `efficiencyUpgrades` and `repairsOverrides`, plus `useSceneTargets()`, memoized on those.

- [ ] **Step 1: Write the failing UI check.** `benefits-check.mjs` opens Benefits on Today at 1180×820 and asserts:
  - The view flips to the build.
  - `[data-benefits-head]` holds "Today's costs", the area word, the four parts and the total.
  - `[data-bills-footer]` is gone.
  - Edit costs reads `aria-expanded="false"`. Clicking it opens `[data-costs-editor]` with one row per `RepairsRow`, each tagged Working number or Typed from `repairsResolved[trade].source`.
  - With climate null, the Coastal | Inland pill shows with its hint. Choosing Inland hides it, shows "Area: Inland. From Home facts → Area; change it there.", and the head starts "Inland".
  - Typing 900 into the roof's repairs changes the head's total to the editor's new sum, computed in the check from the shown figures.
  - Escape closes the editor and focus lands on Edit costs.
  - At 390×844 the head is two rows and the parts are hidden.
  - No console errors.
- [ ] **Step 2: Run** `node .superpowers/sdd/2026-11-03-trade-scene-benefits/benefits-check.mjs`. Expected: FAIL at `[data-benefits-head]`.
- [ ] **Step 3: Implement** to spec §3.1 and §3.5 and the mock's `.hs-*`, `.r7-pop` and `.ed` rules (`mock:834-861`).
  - Edit costs is `Button variant="outline" size="sm"` with `Pencil`, pressed while open. The "?" is `variant="ghost" size="icon"`.
  - The editor opens over the window under Edit costs: absolute, `bg-popover`, `border-border-strong`, 560 px wide (phone: `calc(100% − 16px)`).
  - The fields are `UnitMoneyField` as `bills-footer.tsx` uses it; the repairs fields use `SAVINGS_COPY.repairsSuffix` with the working figure as placeholder.
  - Delete the two files and remove `billsOpen` / `toggleBills`. `grep -rn "BillsFooter\|billsOpen\|toggleBills\|controls/benefits-head" src` returns nothing.
- [ ] **Step 4: Run** the check, `pnpm tsc` and eslint. Take your own screenshots at 1280 and 390, light and dark, with the editor shut and open, and compare them against the mock's round 7.
- [ ] **Step 5: Commit** `feat(trade-scenes): Benefits' head carries today's costs and opens their editor; the bills footer goes`.

### Task 9: The two futures band

**Files:**
- Create: `ui/components/benefits/two-futures-band.tsx`, `two-futures-readout.tsx`, `two-futures-chart.tsx`, `two-futures-chart-loader.tsx` (the `next/dynamic` import and its skeleton), `future-year-axis.tsx`, `future-why-panel.tsx`
- Create: `src/features/trade-scenes/constants/two-futures-chart.ts` (the static `ChartConfig`)
- Modify: `constants/home-scene-copy.ts` (`BENEFITS_COPY.futures`, `.why`)
- Test: `benefits-check.mjs`

**Interfaces:**
- Consumes: `useBenefitsFigures`, `futureYear`, `yearLabel`, `LOOK_AHEAD`, and `useBenefits`' `lookAhead`, `setLookAhead` and `whyOpen`.

- [ ] **Step 1: Extend the failing check.**
  - `[data-futures-readout]` reads "By 2031", with Without, With and Saves for year 5. The quiet line reads "Today $T → $A, saves $S a month", where `$S` equals the year-1 saving.
  - The chart has 10 column pairs. The axis is a `radiogroup` of 10 radios with "2031" checked.
  - ArrowRight ×4 reaches 2035; ArrowRight at 2036 stays put; Home goes to Now.
  - Clicking the plot near the 2033 pair picks 2033.
  - At 390, only Now, +2, +5, +10 and the picked year carry labels.
  - The "?" opens `[data-why-panel]` with its four sections, the picked year's math and the "Savings vary." line (the R-value line with insulation picked). Escape closes only the panel and returns focus to the "?".
  - Per animation frame through a year change: `[data-benefits-head]`, the band's top and the matrix's top move 0 px, and the count of `rect` elements under the chart stays the same (no remount).
  - No console errors.
- [ ] **Step 2: Run** it. Expected: FAIL at `[data-futures-readout]`.
- [ ] **Step 3: Implement** to spec §3.2, P6 and P12, and the mock's `.b6-*`, `.ax6-*` and `.why*` rules.
  - The readout reserves its width with tabular nums, counts to the new figures over 520 ms with motion's `animate`, and is `aria-live="polite"`.
  - The y axis starts at $0.
  - The "?" panel takes the info sheet's section order (question, answer, What it uses with tags, How it's worked out, The math). It reuses only the calculator's presentational pieces that need no provider: `BlockEyebrow` and the `ReceiptRow` / `UsesRow` shapes. Never `UsesList`, which throws outside `StoryUiProvider` (`story-ui-context.tsx:61-65`). Its tags read "Working number", "Typed" and "Calculated" from `BENEFITS_COPY.why.tags`.
  - The panel sits inside the window over the band and the matrix, 470 px wide (`mock:925`), full width on the phone.
- [ ] **Step 4: Run** the check, `pnpm tsc` and eslint. Take screenshots at 1280 and 390, light and dark, at Now, 2031 and 2036, with the "?" open.
- [ ] **Step 5: Commit** `feat(trade-scenes): the two futures band, year by year, with the future savings breakdown`.

### Task 10: The matrix, the rail and the empty build

**Files:**
- Create: `ui/components/benefits/benefits-body.tsx` (replaces `controls/benefits-body.tsx`), `benefits-matrix.tsx`, `matrix-kind-head.tsx`, `matrix-system-head.tsx`, `matrix-cell.tsx`, `benefits-rail.tsx`, `rail-benefit.tsx`, `benefits-empty.tsx`
- Create: `src/features/trade-scenes/constants/benefit-kind-icons.ts` (`CircleDollarSign`, `Wind`, `ShieldCheck`, `Hourglass`, `Award`, `Eye`, `Leaf`), `src/features/trade-scenes/lib/rail-groups.ts`
- Modify: `controls-window.tsx` (mounts the new body), `constants/controls-classes.ts`, `constants/home-scene-copy.ts` (`BENEFITS_COPY.matrix`, `.rail`, `.empty`; the remaining P8 removals and moves)
- Modify: `ui/components/controls/controls-toast.tsx:28` (reads `BENEFITS_COPY.toast`)
- Modify: `.superpowers/sdd/2026-11-01-trade-scene-controls/controls-check.mjs:1242-1355`. Its Benefits scenario asserts only what the Controls own: the flip, the toast, the window's tag and that the x closes. Everything inside the body moves to `benefits-check.mjs`.
- Delete: `ui/components/controls/benefits-body.tsx`
- Test: `scripts/verify-trade-scene.ts`, `benefits-check.mjs`, `controls-check.mjs`

**Interfaces:**
- Produces `railGroups(lines: readonly BenefitLine[], selection: BenefitSelection, savingNow: number): { header: string, groups: { id: HomeSystemId | BenefitKind, label: string, lines: BenefitLine[] }[] }`:
  - A system selection groups by kind, in D3's order.
  - A kind selection groups by system, in `HOME_SYSTEMS` order.
  - A dot gives one group.
  - The header strings come from spec §3.6; the Savings header's figure is `savingNow`, the year-1 saving (P13).

- [ ] **Step 1: Write the failing assertions** for `railGroups`. Rebuild the Task 5 roof-and-attic fixture in this block.
  - A roof system selection: the header starts "Roof & gutters · ", and the groups follow D3's order.
  - The protection kind: the header starts "Protection across the home · ".
  - A roof × protection dot: the header is "Roof & gutters · Protection · 1 benefit", with one group.
  - A Savings kind selection: the header's figure equals the `savingNow` passed, never the sum of the system lines.
- [ ] **Step 2: Extend the failing UI check.**
  - At rest the matrix is full width, with no rail in the DOM.
  - All six systems are visible at 1180×820. Forcing the window short scrolls only the systems rows, and the kinds row stays.
  - Each cell is a button labelled like "Roof & gutters, Protection: 1 benefit", and disabled when empty.
  - Clicking a dot opens the rail with the right header. Clicking it again, "All benefits" or Escape closes it, and focus returns to the cell.
  - Per frame through the width change: a cell moves one way only, at most 40 px per frame and 0 px vertically; the band and the head move 0 px.
  - Escape order with the "?", the editor and a selection open takes four presses.
  - A rail Savings group ends with "Savings vary.".
  - At 390 the rail is a sheet over the matrix area, with no width change.
  - The empty build shows the note, the band shows only the Without columns and "Saves $0", and Open Modify opens Modify.
  - A wall-mounted HVAC home shows Heating & cooling as "No change".
  - A flat roof shows no attic rows.
  - No console errors.
- [ ] **Step 3: Implement** to spec §3.6, §3.7, §4.6, §4.7 and P12, and the mock's `.mx*` and `.r7*` rules (`mock:175-198`, `862-905`).
  - The matrix area is a row: the matrix (motion `layout`) and the rail's width wrapper (`AnimatePresence`). The wrapper animates its width 0 → 380 px and margin-left 0 → 10 px over 280 ms `cubic-bezier(0.4,0,0.2,1)`.
  - Rows have fixed heights (`--cell: 44px`, label column 170 px). The kinds head is sticky on `bg-(--card)`.
  - Each system head's upgrade line lists the picked upgrades' `name`s joined with ", ", clamped to one line.
  - Kind heads show: Savings, the year-1 saving in $/mo; Planet, "soon"; the others, their count.
  - Do the remaining P8 removals, then `grep -rn "CONTROLS_COPY.benefits\|controls/benefits-body" src scripts .superpowers` returns nothing.
- [ ] **Step 4: Run** the verify script, both checks, `pnpm tsc` and eslint. Take screenshots at 1280 and 390, light and dark: at rest, a dot, a system, a kind, and the empty build.
- [ ] **Step 5: Commit** `feat(trade-scenes): the Benefits matrix opens a rail for a dot, a system or a kind`.

### Task 11: Full verification

**Files:** `benefits-check.mjs` only.

- [ ] **Step 1:** Run the whole check at 1180×820, 820×1180, 1440×900 (sidebar open), 390×844 and 375×667, light and dark. The scene stage is dark-scoped; the page chrome around it changes.
- [ ] **Step 2:** Run the Controls' `floorFailures` check on every Benefits control (hit targets ≥ 40 px), and `controls-check.mjs` whole.
- [ ] **Step 3:** Under `page.emulateMedia({ reducedMotion: 'reduce' })`, every change lands within one frame.
- [ ] **Step 4:** Run `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsx scripts/verify-bill-cut-claims.ts`, `pnpm tsc` and eslint under the lock, plus the `theme-conventions.md` §12 self-check on this plan's files only. Expected: all ok. Report the exact output.
- [ ] **Step 5:** Put the screenshots side by side with the mock's round 7 at 1280 and 390, list every visible difference, and fix those the spec doesn't excuse. Commit the fixes per file group.

### Task 12: Polish, then stop

- [ ] **Step 1:** Run `/impeccable polish` on `src/features/trade-scenes/ui/components/benefits/`, with one batched round of fixes and at most one confirming round.
- [ ] **Step 2:** Run Task 11's checks and the static checks again. Expected: green.
- [ ] **Step 3:** Stop. Tell the owner it is ready for the iPad check, with the screenshot list and the commits. Log any owner ruling from that check as a new R-row in the tracker the same day.
