# Proposal Energy Impact — Epic Tracker

> **Status:** opened 2026-10-20. Design approved 2026-10-21; foundation plan (EI0–EI2) `docs/superpowers/plans/2026-10-21-proposal-energy-impact-foundation.md` written, stress-tested 2026-10-21 (EI-D19–D22) and 2026-10-22 (EI-D23–D25 folded in). EI0 waits on the cool-roof fold on the scenes branch (EI-D25). Nothing built.
> **Goal:** a proposal chapter right after Funding that answers "wow, it's expensive" with live bill-savings projections (dollars, kWh, therms, gallons, environmental equivalents) for the proposal's energy upgrades. The rep presents it, and the homeowner can play with it alone through their link.
> **Design:** `docs/superpowers/specs/2026-10-20-proposal-energy-impact-design.md`. Requirement IDs (M, S, P, C) and phases (EI0–EI6) are defined there. This tracker holds their status, the owner's rulings, the research, and what is still open.
> **Adjacent, owned elsewhere (link, don't duplicate):**
> - Sales calculators epic `docs/plans/2026-09-26-sales-calculators-epic.md`: the Remodel ROI calculator, D9 (the savings figures move to `modules/construction/core` "for now"), I11 (the per-trade cuts).
> - 3D trade scenes epic `docs/plans/2026-10-16-trade-scenes-epic.md`, branch `feat/trade-scenes-foundation`: it already built the construction slice EI0 lifts onto main (§3).
> - Proposal page rework spec `docs/superpowers/specs/2026-10-16-proposal-page-rework-design.md`: P1 (six chapters) and P40 (band order) are amended by EI-D1.
> - Construction data standardization epic `docs/plans/2026-09-15-construction-data-standardization-epic.md`: trade slugs (P2 plan 1 Task 3) and scope identity (calculators C1).

Legend: `[ ]` open · `[x]` done · `[~]` in progress · ⚠️ blocked on a §2 question · ✅ settled (decision, nothing to build).

**Sync protocol:** (1) specs and plans cite these IDs and link here instead of restating a rule; (2) a new owner ruling becomes a dated row in §1 before the spec that relies on it is approved; (3) when work lands, tick its IDs and record the commit range in §4; (4) owner input goes into §1 in the owner's words, with the date.

---

## 1. Settled (owner rulings)

| # | Ruling | Date |
|---|---|---|
| EI-D1 | The chapter sits right after Funding, before Next steps. It exists to soften the price the homeowner just saw ("wow it's expensive" → "sophisticated projections"). | 2026-10-20 |
| EI-D2 | Sliders for the **monthly** electric, gas and water bills. Inputs must feel natural: easy to grasp, dynamic. | 2026-10-20 |
| EI-D3 | Electric utility: LADWP or SCE, priced at that utility's average rate. Gas: "every home we go to is SoCal Gas". Gas savings convert to therms and count toward the environmental figures. | 2026-10-20 |
| EI-D4 | Show kWh saved, then environmental equivalents ("trees and other such metrics: tons of fuel, tons of coal… creative and environmental/ecological"), and water saved for landscape work. | 2026-10-20 |
| EI-D5 | No published savings research this pass. The model is the calculator's: pick the upgrade, assume bad, old, inefficient material is replaced with good, efficient material, and apply the team's cut. | 2026-10-20 |
| EI-D6 | Bills and utility are stored **on the customer**, like `age`, and the homeowner changes them through the token. | 2026-10-20 |
| EI-D7 | The homeowner sees the bills the rep set, and can move the sliders. | 2026-10-20 |
| EI-D8 | Shared logic and charts are co-located "temporarily" in `modules/construction`, because they are real-world construction data and derivations. The calculators and proposal-flow features import from there. | 2026-10-20 |
| EI-D9 | Layout and interaction go through `/ui-exploration`. | 2026-10-20 |
| EI-D10 | **Only complete replacements earn a cut**: "all windows, full cool life exterior paint, full roof tear off (shingles/flat) or redeck, full hvac replacement (yes, assume ducts included), attic insulation installation or replacement, dryscaping". §3.2 maps this to catalog scopes. | 2026-10-21 |
| EI-D11 | EI0 lands by **option (b)**: lift only the construction slice from `feat/trade-scenes-foundation` onto main, "clearly documented and noted" (§3.1). | 2026-10-21 |
| EI-D12 | Utility rates are researched by Claude, with the owner in the loop to confirm (§3.3). | 2026-10-21 |
| EI-D13 | **Roof overlay counts**: "an additional layer of cool roof". | 2026-10-21 |
| EI-D14 | **Windows:** any `Window replacement` scope counts as all windows. Door scopes don't count. (Closes Q-W.) | 2026-10-21 |
| EI-D15 | **HVAC partials**, "exactly as mentioned": split system and package unit replacement earn the full cut; A/C replacement alone earns only the electric cut; furnace replacement alone earns only the gas cut; new-cut installs and mini-splits earn nothing. (Closes Q-H.) Claude's call: the always-on ducts add-on follows the same split, so A/C alone gets +5 electric and furnace alone gets +5 gas. | 2026-10-21 |
| EI-D16 | **Attic:** air sealing is an add-on and doesn't count. Radiant barrier counts: "definitely helps with reducing the attic heat and the ambient heat around the cold air running in the air ducts (also lower overall ambient attic temperature). Great product for this actually." Top-off counts too (Claude's recommendation; not contradicted). (Closes Q-A; the radiant barrier's number is EI-D18.) | 2026-10-21 |
| EI-D17 | **Rates:** §3.3 stands "for now", but "we may need to look deeper in the future". (Closes Q-R; the deeper look is F-R1.) | 2026-10-21 |
| EI-D18 | **Radiant barrier's cut**: a new add-on on `attic-and-basement`, **electric +5 · gas +2**, earned even when sold without insulation. Owner on gas: "as long as it doesn't allow ambient heat to escape, it will trap more heat in the attic, thus increasing the ceiling temperature (less furnace usage required for the same temp)". The +5 is Claude's recommendation and the +2 is Claude's number for "even if tiny". (Closes Q-RB.) | 2026-10-21 |
| EI-D19 | **The bills get their own table** under the customer (`customer_utility_bills`, 1:1, like `customer_profiles`), per ADR-0005's 2026-07-14 amendment: the homeowner writes it through the token while staff write the rest of the customer. Still "on the customer" in EI-D6's sense. | 2026-10-21 |
| EI-D20 | **Bills are stored in cents** (`*_cents`), the house money convention; the sliders still move in whole dollars. | 2026-10-21 |
| EI-D21 | **One yearly bill loop** in the construction module, called by the Remodel ROI calculator and the energy model, so they can never compound differently. The calculator's numbers must not move (its verify script guards it). | 2026-10-21 |
| EI-D22 | **Vocabulary:** a scope that makes its trade's bill cut count is a **bill-cutting scope** ("bill-cut scope" for short). Owner: "this is a bill-cutting scope", "we're after bill-cuts, that's why we choose this scope", "a badge for bill-cutting". Not "qualify" (that is program eligibility). The customer's power company is the **electric utility** (code: `electricProvider`); the route is `proposalsRouter.customerBills`; the table is `customer_utility_bills`. Recorded in `CONTEXT.md` § Energy impact terms. Owner rejected "earns" as unclear. | 2026-10-21 |
| EI-D23 | **The read moves to EI5.** `getFullView`'s left join (S2) and its `pnpm db:push:prod` ship with the chapter, so the foundation's commits can reach prod before the table does: nothing reads it until then. The EI5 plan carries the gate as an enforced STOP. `db:push:prod` pushes the whole schema, so it runs from a checkout of exactly what ships. | 2026-10-22 |
| EI-D24 | **Keyed by `BillCategory`.** No energy-category type. Owner: "Can be `billCategory` as we generalized it from 'utility bills' (water/electric/gas) to bills (includes gardening and other maintenance, repairs)". The model computes every bill category; kWh, therms and gallons exist only where a rate does. | 2026-10-22 |
| EI-D25 | **Add-on has one meaning: the catalog's.** Owner: "An addon is a type of work that is still part of the general trade, but under normal circumstances we will not perform this job as a standalone… ducts, radiant barrier etc ARE ALREADY ADDONS in our catalog. We should just note that these addons can also be bill-cutting. Cool roof is more special, as it's about a material type… all our roofing is assumed to be cool roof." "We only offer cool roofs." **Cool roof folds into roof-and-gutters' base cut (electric 8)**, done on the scenes branch first, before EI0 lifts. The calculator's cool-roof switch goes with it. Scenes presentation: EI-D26. | 2026-10-22 |
| EI-D26 | **The scenes keep "+ cool roof" as presentation only** (owner agreed with Claude's recommendation; closes Q-CR). The roof's base cut stays the one number, and the scene shows it arriving with the cool covering, from a baseline roof without it. The scenes session proposes the exact interaction, and the owner confirms. Owner on sequencing: the scenes session "has already moved along and we need to figure out the new state before doing anything". | 2026-10-23 |
| EI-D27 | **Attic fan installation is a bill-cutting add-on: electric +4, with or without insulation.** Owner (scenes attic stress test): "Of course there is bill cuts for attic fan, as it reduces the temperature in the attic on a hot summer day… which will in turn reduce the ceiling temperature and thus the air conditioning doesn't work as hard. I would say at least a 4% reduction in electric bill." It is a catalog add-on (Notion Entry Type "Addon", checked 2026-10-30) and counts like radiant barrier (EI-D18). The proposal and the 3D scene use the same number (scenes tracker R106). Supersedes its "not bill-cutting" listing in §3.2. | 2026-10-30 |
| EI-D28 | **R-38 attic insulation is a step-up add-on: electric +2, gas +2 over R-30.** Owner (scenes TS3b.4b brainstorm, R126): "R38 slightly better, 2% better." Claude's reading: both bills. It counts on top of the insulation base only when the home is below R-30; topping off an R-30 attic to R-38 earns the 2 alone. The 3D scene and the proposal use the same figure (scenes tracker R126). Built on the scenes branch 2026-11-03 (`6ad19b22b`, add-on id `insulation-step-up`). | 2026-11-03 |

---

## 2. Open (needs the owner)

| # | Question | Blocks | Claude's recommendation |
|---|---|---|---|
| Q-L | Chapter label and accessor (working: "Energy impact" / `energy`). The field, table and route names were ruled in EI-D19–D22. | P1 | Decide at the UI exploration. |
---

## 3. Research and mappings

### 3.1 EI0: the construction slice lifted from `feat/trade-scenes-foundation`

Read-only analysis, 2026-10-21. Merge-base `aaaa40726`. The branch was 73 commits ahead and main 81 ahead.

**Re-checked 2026-10-23:** the tip is `d3bcf36e8` (TS3b.3 design; its plan is uncommitted in the worktree), and the slice is still unchanged since `47be8f8e3`. The fold has not started. The request went to the scenes session on 2026-10-23.

**Re-checked 2026-10-22:** the tip was `167a661bf`, 3 scenes-only commits past `f8d49b0de`. The slice was unchanged since `47be8f8e3`, and main's overlap was still exactly the five files. **The cool-roof fold (EI-D25) lands on the branch next, so this analysis must be re-run at the post-fold tip**, and its tip recorded here, before EI0. The fold touches `trade-bill-cuts.ts`, `bill-cut-add-ons.ts`, `verify-remodel-roi.ts` and the calculator's `coolRoof` switch files.

**The branch is live.** Its worktree `.worktrees/trade-scenes` moved from `910b5d2e5` to `47be8f8e3` during this analysis. Before EI0 runs:
- Re-check the slice files at the branch tip (`git diff <analysed tip> feat/trade-scenes-foundation -- <slice paths>`).
- Add this note to the scenes tracker. That file, `docs/plans/2026-10-16-trade-scenes-epic.md`, exists only on the branch, so tell the session working there instead of editing its worktree.

**Branch commits the slice comes from:**

| Commit | Subject | Take |
|---|---|---|
| `0feaf9ff8` | generated TradeSlug snapshot | `scripts/generate-trade-slugs.ts`, `core/constants/trade-slugs.ts`. Not its plan-doc line. |
| `5be5bcf5e` | resolve-overridable to shared/lib | the whole commit |
| `438a0ec84` | calculator keyed on slugs | the whole commit |
| `a259011a3` | bill cuts, cut modes, repairs move to construction | the whole commit |
| `63b680386` | offline check catches bad forms | only the calculator `types/index.ts` hunk and the `verify-remodel-roi.ts` move. Not `eslint.config.js`, `verify-construction-model.ts` or `flow-model.ts`. |
| `7a0aeb9b4` | cool roof add-on | `bill-cut-add-ons.ts`, `trade-bill-cuts.ts`, `verify-remodel-roi.ts` and the 8 calculator files. Not `scope-installs.ts`, `resolve-assembly.ts`, `verify-construction-model.ts`, or the `ScopeInstall.swapsWith` hunk. |

**Recipe: one commit on main, built from file contents, not cherry-picks.**
1. Take each of these files from the branch with `git checkout feat/trade-scenes-foundation -- <path>` (a pathspec checkout, not a branch switch):
   - `src/shared/modules/construction/core/constants/{trade-slugs,bill-categories,bill-cut-add-ons,cut-modes,repairs-per-year,trade-bill-cuts}.ts`
   - `core/lib/{combine-cuts,cut-for,resolve-trade-bill-cuts}.ts`
   - `core/schemas/bill-cuts.ts`
   - `src/shared/lib/resolve-overridable.ts`
   - `scripts/generate-trade-slugs.ts`
   - `scripts/verify-remodel-roi.ts`
   - every calculator file the slice changed, except `story-canvas.tsx`

   Then `git rm` the calculator's old `constants/bill-categories.ts` and `lib/combine-cuts.ts`.
2. Write `core/types.ts` from `git show a259011a3:src/shared/modules/construction/core/types.ts`. That version holds only `CutSource`, `CutPart`, `BillEntry` and `BillCut`, so none of the scenes' types come along.
3. In `story-canvas.tsx`, keep main's version (it has main's bar-height work, `a770d7ea5`) and swap only the `BILL_CATEGORIES` import to the construction module.
4. Leave out `package.json` (three.js only), `CONTEXT.md` (the scenes' glossary) and every scenes or assembly verify script.
5. Check with `pnpm tsc`, `pnpm lint` and `npx tsx scripts/verify-remodel-roi.ts`. That script asserts the calculator's numbers to the last digit, including cool roof on = electric 8% and the cool-roof default.

Main has not touched `src/shared/modules/construction/core/`. The only main-side overlap is `story-canvas.tsx`, handled in step 3.

**Note for the scenes branch (EI-D11):** once EI0 lands, `feat/trade-scenes-foundation` rebases onto main.
- `0feaf9ff8` applies cleanly.
- `5be5bcf5e`, `438a0ec84` and `a259011a3` replay older states onto files that already hold the final state, so they conflict. Resolve each to the replayed commit's version.
- The slice hunks of `63b680386` and `7a0aeb9b4` become no-ops or conflicts.
- `9573c71c8` applies cleanly.

Afterwards, `git diff <old-tip> HEAD -- <slice paths>` must be empty. Watch for duplicated `resolveOverridable` asserts in `verify-remodel-roi.ts`. Merging main into the branch would be easier: its only real conflict is a `types.ts` add/add, where you take the branch's version.

### 3.2 Bill-cutting scopes (EI-D10, EI-D13–D16, EI-D22, EI-D27 → catalog, live Notion read 2026-10-21)

Cuts are keyed by catalog scope id, with a name comment, like the branch's `SCOPE_INSTALLS` (scope slugs don't exist yet). A trade's bill cut counts only when the proposal includes at least one bill-cutting scope under it (code: `BILL_CUTTING_SCOPES`).

| Trade (slug) | Bill-cutting scopes | Not bill-cutting | Cut |
|---|---|---|---|
| `windows-and-doors` | `3e40ca1b-548b-824d-b0db-81cc10787e73` Window replacement (any quantity = all windows, EI-D14) | Window installation (new), French door replacement, sliding door replacement or installation | electric 10 · gas 8 |
| `exterior-paint-stucco-and-siding` | `9d60ca1b-548b-824a-8aef-81f1e29b9b34` Repaint w/ Cool Life (exterior) | water-based repaint, trim, stucco, stain, siding repair, epoxy | electric 4 |
| `roof-and-gutters` | `bd60ca1b-548b-821d-bd96-011624aa0fbb` Roof tear-off (shingles) · `31a0ca1b-548b-8013-9ad6-fbb929ef9b06` Roof torch down (flat) · `a2c0ca1b-548b-8296-a58d-01b88fb83405` Roof redeck · `32f0ca1b-548b-804e-9fa1-f5009c68668e` Roof overlay (a cool-roof layer, EI-D13) | tile reset, every repair, tune-up, fascia, gutters | electric 8, the roof's base cut: Tri Pros sells only cool roofs (EI-D25). |
| `hvac` | **Full:** `6450ca1b-548b-830a-ac5e-018e7fd3064a` Split system replacement · `9460ca1b-548b-8375-8d63-814dddf36b71` Package unit replacement. **Electric only:** `e450ca1b-548b-8269-adc7-019776a6acf7` A/C replacement. **Gas only:** `88d0ca1b-548b-82b2-bb26-017081659f61` Furnace replacement (EI-D15) | `8aa0ca1b-548b-82dd-9148-81d0b51076bf` Split system new-cut installation, `dcb0ca1b-548b-8303-9f65-01730423e685` Mini-split installation, `3190ca1b-548b-805f-8d87-f51275832424` Kit: mini-split | Full: electric 25 · gas 20, **plus ducts (+5 / +5) always on** ("assume ducts included"). A/C only: electric 25 + 5. Furnace only: gas 20 + 5. |
| `attic-and-basement` | **Insulation:** `a5f0ca1b-548b-838a-89da-8134c5bfc738` Attic insulation replacement · `6d70ca1b-548b-835e-a8be-017c9038ac42` Attic insulation top-off. **Radiant barrier:** `c050ca1b-548b-825d-b707-01aff56ca25d` Radiant barrier installation (EI-D16). **Attic fan:** `e050ca1b-548b-8263-8634-01293821c390` Attic fan installation (EI-D27) | `32f0ca1b-548b-80da-a907-ee6613d8d94e` Air-leak sealing | Insulation: electric 10 · gas 15. Radiant barrier: a catalog add-on that cuts bills, electric +5 · gas +2, even without insulation (EI-D18). Attic fan: a catalog add-on, electric +4, even without insulation (EI-D27). R-38: +2 electric, +2 gas (EI-D28). |
| `dryscaping` | every scope except sod: artificial grass, gravel, river rocks, mulch, DG, pavers, concrete, hardscaping, general mixed landscaping/hardscaping | `3490ca1b-548b-8086-8f5c-d5727a876786` Install sod (natural grass, which needs water) | water 40 (gardening 50 is not shown; see the spec §6) |
| `water-heating` | none: not on the owner's list | Tankless installation | — |

- `Air ducts replacement` (`bc50ca1b-548b-8366-9ef9-811c2f36877f`) adds nothing more, because ducts are already assumed.
- Catalog add-ons sit in a SOW's `scopes` beside the scopes (`meeting-flow/lib/trade-selection.ts:116`), so radiant barrier is matched like any scope.
- **Model consequence:** HVAC's base cut now depends on which bill-cutting scope is on the proposal (full, electric only, or gas only), and radiant barrier joins `BILL_CUT_ADD_ON_IDS`. So M2 returns per-trade categories, not just trade slugs. The branch's `combineCuts` reads a whole trade's `base`, so EI1 extends it after EI0 lands.

### 3.3 Rates and factors (researched 2026-10-21; working numbers, Admin-configured later)

| Value | Working number | Source and notes |
|---|---|---|
| SCE electric | **$0.344 / kWh** | SCE Rates Advisory, effective 2026-06-01: average residential 34.4¢/kWh without the Climate Credit (33.2¢ with it); typical non-CARE bill $187.40 at 500 kWh/month. <https://www.sce.com/save-money/rates-financing/sce-rate-advisory/20260601> |
| LADWP electric | **$0.276 / kWh** | EIA-861M 12-month average to July 2026 (July: 28.37¢); average bill $128 at 464 kWh/month (via kadoa.com). Posted R-1A Tier 1 is 27.292¢ from 2026-10-01; heavy users pay Tier 2 (~33¢) or Tier 3 (~41¢). <https://www.kadoa.com/energy-prices/electricity/california/ladwp> |
| SoCalGas | **$2.10 / therm** | SoCalGas March 2026 rate update: bundled residential average (transport, public purpose surcharge and commodity). No later change was found. A rate case raises it from 2028-01-01. |
| Water | **$0.017 / gallon** (EI-D17: for now) | LADWP Tier 1 is reportedly $12.495/HCF (Jan–Jun 2026, third-party, unverified), and 1 HCF = 748 gal. Outdoor use often bills at Tier 2+, so this is conservative. The official LADWP notice PDF could not be read. |
| CO₂ per kWh | **5.04 × 10⁻⁴ t** | EPA GHG Equivalencies, Table 1, CAMX (WECC California) non-baseload rate 1,055.0 lb/MWh, with the page's 5.1% line loss. Claude's call: California's grid, not the national 6.72 × 10⁻⁴. <https://www.epa.gov/energy/ghg-equivalencies-calculator-calculations-and-references> (updated 2026-08-04) |
| CO₂ per therm | 0.0053 t | same page |
| Gallon of gasoline | 8.887 × 10⁻³ t | same page |
| Pound of coal | 9.00 × 10⁻⁴ t | same page |
| Urban tree seedling grown 10 years | 0.060 t per tree | same page. The builder confirms on the page whether this is the 10-year total. |
| Acre of US forest, one year | 1.00 t | same page |
| Mile driven (gasoline car) | 3.93 × 10⁻⁴ t | same page |
| Smartphone charged | 1.24 × 10⁻⁵ t | same page |

Rates escalate with the calculator's existing yearly rates (electric 7.57, gas 9.1, water 8.9 %/yr; calculators tracker R18.8).

**Follow-ups (not blocking):**
- **F-R1:** look deeper at the rates (EI-D17). Candidates: tiered or seasonal rates for LADWP and SCE; the marginal tier a saved kWh actually comes off; the official LADWP water rates and their outdoor tiers; water districts other than LADWP; re-checking the rates on each Jan 1 and Jun 1 change.

---

## 4. Requirements status

| Phase | IDs | Status | Commits |
|---|---|---|---|
| EI0 construction slice onto main | §3.1 | ⚠️ planned (foundation plan Task 1), **blocked on the cool-roof fold on the scenes branch (EI-D25)**, then a re-run of §3.1. Tip `167a661bf` on 2026-10-22; slice unchanged since `47be8f8e3`. | — |
| EI1 energy model | M1–M9 | [ ] planned (Tasks 2–6; Task 5 = the shared yearly loop, EI-D21; keyed by `BillCategory`, EI-D24) | — |
| EI2 customer storage and token write | S1, S3–S5, S6 server half | [ ] planned (Tasks 7–8). Dev DB only; no prod gate here, because nothing reads the table yet (EI-D23). | — |
| EI3 shared charts | C1–C2 | [ ] (after EI4 picks the charts) | — |
| EI4 `/ui-exploration` | P3–P8 | [ ] | — |
| EI5 build the chapter | S2, P1–P8 | [ ] Carries `getFullView`'s join and the enforced prod gate (EI-D23). **Owner to-do then:** `pnpm db:push:prod` before the join reaches origin/main. | — |
| EI6 calculator gains kWh and environment | — | [ ] follow-up | — |
