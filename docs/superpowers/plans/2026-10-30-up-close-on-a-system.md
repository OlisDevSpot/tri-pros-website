# TS3b.4b: Up close on a system, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Re-planned 2026-11-03 on the Controls head** (`f4c57008c`, with Benefits still building), after a second stress test. Owner rulings R228–R231:
> - up close is **Look inside**, a deeper step of the system in focus on its system card;
> - house pins pick the system, like its rail chip;
> - systems become areas later, so the rename stays cheap;
> - 4b builds after Benefits and Layout L1+L2, before Layout L3.

**Goal:** Retire the roof & attic close-up slice (a second model) and the close-up card. Picking a system (rail chip or house pin) brings its camera and system card, as Controls does today; the card's **Look inside** then fades the rest of the house and steps the system open on the home's own model, with the peel and the parts list in the same card. Along the way, rename the insulation levels and make the insulation offers follow what is there.

| Part | Requirements | Tasks |
|---|---|---|
| Insulation data | R133, R122, R134, R126 | 1–3 |
| System parts, shared system parts, spots | R119, R123, R124, R135, R136 | 4–5 |
| The package unit fix | R125 | 6 |
| The fade, Look inside, house pins | R119, R120, R228, R229 | 7–9 |
| Stepped cutaways and their flows | R119, R60, R123, R124 | 10–12 |
| By-eye pass and hand-over | all | 13 |

**Architecture:**
- **One system, one card, one camera.**
  - The System in focus (`cameraFocus: HomeSystemId | null`, set by the Systems rail) stays the one way a system is chosen.
  - `zoom: AssemblyId | null` is replaced by `lookInside: boolean`, which only means something while a system is in focus.
  - The close-up card, `AssemblyScreen`, the assembly kit, its registry and its `kit-*` libs are deleted in one switch (Task 8), along with today's mutual exclusion between Systems and a close-up.
- **Everything up close shows is a system part** (R135): a whole construction part, a piece of one, or a shared system part lit only for its story (R136). System parts are their own table; no part's `group` changes and no construction part is added or split, so no heat, water or savings figure moves.
- **The fade:** every home mesh that draws a system part sits in a tag group. `applyGhost` keeps the lit system parts solid and fades the rest.
- **The cutaway:** layered systems step open on the house through one pure `stepCutBack`. The kit's flows (rain, leaks, heat lanes, readings, part paint) are rebuilt on the home's geometry (Task 11).
- **Insulation** becomes depth and R-value levels defined once in the construction core. A top off must raise the R-value, a replace must not lower it, and with nothing there only the adding scope is offered. R-38 earns its 2 extra points through a new `stepUp` on the material.
- **Every write goes through the one scene change** (`applySceneChange`), so Modify and the card share every new option, and the "keep" rules run once.
- **Areas later (R230):** everything stays keyed on `HomeSystemId`. No DOM id or three.js `userData` key carries the word "system".

**Tech Stack:** Next.js 15, React 19.2, `@react-three/fiber` 9.8.2, three 0.180, the zustand scene store, Tailwind v4, motion, shadcn `Button`. Checks are the repo's `tsx` verify scripts (`node:assert/strict`) and local Playwright screenshots.

**Spec:** `docs/superpowers/specs/2026-10-30-up-close-on-a-system-design.md` (§2 rewritten 2026-11-03). The executor reads it beside this plan. Each task cites the sections it implements.

## Global Constraints

- **Binding rules:** `.superpowers/sdd/2026-11-03-trade-scene-benefits/standing-rules.md` (the newest set) binds every task in full, with these changes:
  - the binding spec is the one above;
  - this build's records (ledger, briefs, shots, probes) go in `.superpowers/sdd/2026-10-30-up-close-on-a-system/`;
  - Task 1 may edit these otherwise off-limits paths, because spec §8.1 names them:
    - `src/shared/entities/customers/**`;
    - `src/features/meeting-visualizations/**`;
    - `src/features/meeting-flow/ui/components/context-panel-field.tsx`.

    The DB schema file stays untouched.

  The rules this plan leans on most:
  - `flock …/.superpowers/heavy.lock` for `tsc` and eslint;
  - no defensive code;
  - copy functions take at most 3 arguments;
  - every control is the shadcn `Button`;
  - the page is `/dashboard/trade-scene`, and screenshots wait for `data-load-phase="live"`;
  - the commit rule for files holding other sessions' hunks (`git apply --cached`, then a plain `git commit -F -`);
  - the claim files in `.superpowers/claims/` for the verify scripts, `F/types.ts` and `F/constants/home-geometry.ts`.

  `F/` = `src/features/trade-scenes/`, `CORE/` = `src/shared/modules/construction/core/`.
- **Build order (R231):** Task 1 starts only when all of these are true:
  1. the Benefits plan (`docs/superpowers/plans/2026-11-03-trade-scene-benefits.md`) is committed;
  2. the owner has looked at it;
  3. `feat/scene-layout-lab` (Layout L1+L2) has merged into `feat/trade-scenes-foundation`.

  Layout L3 builds after this plan.
- **Before Task 1:**
  - Check whether `feat/trade-scene-ship` has merged (`git branch -r --merged origin/main | grep trade-scene-ship`). If it has, stop and ask the owner which base 4b builds on (CLAUDE.md: one feature, one worktree branch, one PR off `origin/main`).
  - Re-run `grep -rnw 'zoom\|zoomed' src/features/trade-scenes scripts`, matching identifiers, not comments. Add any reader that isn't in Task 8's list to Task 8's brief.
- **Hands off other sessions' work:** never stage, revert or reformat another session's hunks, Benefits' least of all (`controls-window.tsx`, `ui/components/benefits/**`, `r-value-scopes.ts` and the rest while it builds).
- **Docs:** builders never stage `docs/**` or `CONTEXT.md`. The tracker, the energy-impact tracker and `CONTEXT.md` edits are the controller's steps, committed only when the owner asks.
- **Database:**
  - The insulation column is `text(..., { enum })`, so `db:push` changes nothing.
  - Old values are cleared by Task 1's script: the controller runs it on dev after the owner's yes, and on prod only when the owner asks.
  - No other DB write of any kind.
- **Controls rules this plan keeps** (Controls spec `docs/superpowers/specs/2026-11-01-trade-scene-controls-design.md`):
  - a tap away exits Systems (R194);
  - no Done buttons (R193);
  - **a pick never flips the scene**; only the Today ⇄ Build toggle does (spec §4 "A system's card");
  - Escape steps back one layer at a time;
  - the blueprint load's `live` gate holds pins and shortcuts (blueprint D10);
  - placement comes from `SCENE_LAYOUT` and the scene visible area.
- **Copy:** screen copy lives only in `F/constants/home-scene-copy.ts`, except the insulation level names in `CORE/constants/enums.ts` (spec §8.1) and part and material copy in the assembly files. Copy never says "your" and never mentions solar.
- **Vocabulary:**
  - **System part** (R135), never "layer", "ply" or "sub-part" in code.
  - **Look inside** (R228), never "zoom", "close-up mode" or "system view" in new code or copy.
  - **existing** / **proposed**, never "today", in code.
  - New shared feature types go in the end block of `F/types.ts`.
- **No shims:** a renamed or deleted export has every caller repointed in the same task.
- **Working numbers:** every hand-tuned figure (camera views, step depths, fade, piece thicknesses, positions) is marked as a working number in one comment on its constant, and settled by screenshot.
- **Screenshots:**
  - Sizes: 1194×834 (iPad landscape), 1280×800, 834×1194 (iPad portrait) and 390×844 (phone), light and dark.
  - Pitched and flat roof. Normal, Summer, Winter, Rain, and Thermal on.
  - Read every PNG.
  - The pre-Controls baseline of the close-up is in `.superpowers/brainstorm/2026-10-30-up-close-screens/baseline/`. Shoot a fresh one of today's close-up card before Task 8.
- **Savings never move from a regroup:** no part's `group` is retagged and no construction part is added or split. The glazing's R-2 and the duct R-values stay as they are.

## Review Focus

1. **One card, never two.** With a system in focus and Look inside on, only the system card shows: no close-up card, and no second card on a phone. The house keeps its share of the visible area as today's system focus does. Test: `sceneVisibleAreaFor` has no close-up branch (Task 8); phone and portrait shots.
2. **A tap is either a part tap or a tap away, never both.** While looking inside, a tap on a lit system part emphasizes it and Systems stays open. A tap on the lawn exits Systems (R194). A house tap with Systems closed shows pins and nothing else. Test: the tap-claim check and a Playwright walk (Task 9).
3. **Escape steps back one layer at a time.** The order is: a menu, then Look inside, then the system, then Systems; and with nothing open, the pins. Focus lands on the way back in: the card's Look inside button, then the rail chip, then the Systems button. Test: `escapeStep` (Task 8) and a keyboard walk.
4. **The R-38 option follows the existing level both ways, from any control.**
   - Raising the existing level after a pick (in the card or in Modify) switches a now-required R-38 on.
   - Modify can't switch a required R-38 off.
   - Raising the level to R-38 drops a top off.

   Test: `applySceneChange` cases (Task 2).
5. **A system that stops having Look inside leaves it in the same write.** Up close on the flat roof's attic, the rep drops the redeck (torch down alone never keeps it). Or up close on heating & cooling, the rep picks a wall-mounted unit. Either way the scene steps back to the system in focus, never rendering a frame of an empty cutaway. Test: `keepLookInside` (Task 8).

---

### Task 1: Insulation levels named by depth and R-value (R133; spec §3.2, §8.1)

**Files:**
- Modify:
  - `CORE/constants/enums.ts:43-45` (`insulationLevels`, `InsulationLevel`; add `INSULATION_LEVEL_LABELS`)
  - `CORE/constants/roof-attic-inference.ts:6`: `BATTS_BY_LEVEL` is renamed `INSULATION_BY_LEVEL`.
  - `CORE/constants/era-defaults.ts:7-13`
  - `CORE/lib/assemblies/roof-attic/infer-existing-conditions.ts:21`
  - `F/constants/home-scene-copy.ts`: delete `INSULATION_LEVEL_LABELS` (`:94`).
  - `F/lib/scene-change-slots.ts:11,53`: the attic insulation slot reads the core labels.
  - `F/constants/home-profile-choices.ts`, if it still reads the labels (grep).
  - Modify's search words (`F/lib/search-scene-changes.ts`), so "R-30", "r30" and "10 in" find their level.
  - `src/shared/entities/customers/types.ts` (`ProfileFieldConfig`)
  - `src/shared/entities/customers/constants/property-profile-fields.ts:21`
  - `src/shared/entities/customers/lib/format-profile-value.ts`
  - `src/shared/entities/customers/components/profile/profile-card.tsx:64-66` (the edit select) and `:171` (the read value)
  - `src/features/meeting-flow/ui/components/context-panel-field.tsx:163-185`
  - `src/features/meeting-visualizations/lib/resolve-roof-assembly.ts:17,20,24-30`
  - `src/features/meeting-visualizations/ui/components/roof-cutaway/profile-controls.tsx`
  - `src/features/meeting-visualizations/ui/views/roof-cutaway-view.tsx`
  - Every level literal in the verify scripts (claim them first). Re-grep `'low'\|'medium'\|'high'` in `scripts/`; the lines have moved since 2026-10-30.
- Create: `scripts/clear-old-insulation-levels.ts`

**Interfaces:**
- Produces:
  - `insulationLevels = ['none', 'r11', 'r19', 'r30', 'r38'] as const` and `InsulationLevel`.
  - `INSULATION_LEVEL_LABELS = { 'none': 'None', 'r11': '3.5 in. (R-11)', 'r19': '6 in. (R-19)', 'r30': '10 in. (R-30)', 'r38': '12 in. (R-38)' } as const satisfies Record<InsulationLevel, string>` in `enums.ts`.
  - `INSULATION_BY_LEVEL = { none: null, r11: 'batts-r11', r19: 'batts-r19', r30: 'batts-r30', r38: 'blown-r38' } as const satisfies Record<InsulationLevel, string | null>`.
  - `INSULATION_BY_ERA`: `Pre-1950` and `1950-1978` become `r11`, `1978-1998` and `1998-2014` become `r19`, and `Post-2014` becomes `r30`. These are today's guesses, renamed.
  - **`ProfileFieldConfig.optionLabels?: Readonly<Record<string, string>>`.**
    - `formatProfileValue(value, field?: ProfileFieldConfig)` returns `field?.optionLabels?.[value] ?? <today's result>`.
    - Every select in `profile-card.tsx` and `context-panel-field.tsx` shows `optionLabels?.[option] ?? option`.
  - **`resolve-roof-assembly.ts`:**
    - It reads the core `INSULATION_BY_ERA` in place of its local table.
    - `R_VALUE_BY_LEVEL = { none: 0, r11: 11, r19: 19, r30: 30, r38: 38 }`.
    - `INCHES_BY_R_VALUE[38] = 12`.

- [ ] **Step 1: Write the failing checks.**
  - In `verify-construction-model.ts`:
    - `deepEqual([...insulationLevels], ['none','r11','r19','r30','r38'])`.
    - `INSULATION_LEVEL_LABELS.r38 === '12 in. (R-38)'`.
    - `'r19'` infers `'batts-r19'`, `'r38'` infers `'blown-r38'`, and `'none'` infers absent.
    - The `Post-2014` era guess infers `'batts-r30'`.
  - In `verify-trade-scene.ts`:
    - the `attic-insulation` slot's option labels from `sceneChangeSlots` deep-equal the core labels (one source);
    - `searchSceneChanges('r-30')` and `searchSceneChanges('10 in')` both return the attic insulation slot.
- [ ] **Step 2: Run** `pnpm tsx scripts/verify-construction-model.ts`. Expected: a failure on the new ids.
- [ ] **Step 3: Implement** the renames and repoint every reader. Then run `grep -rn "'low'\|'medium'\|'high'" src scripts` and confirm none of the hits is an insulation level.
- [ ] **Step 4: Write `scripts/clear-old-insulation-levels.ts`** on the pattern of `scripts/normalize-customer-phones.ts` and `scripts/set-main-line.ts:13-21`:
  - the guarded `load-env` import;
  - `describeTargetDb()`;
  - a dry run unless `--apply`;
  - one drizzle `update(customerProfiles).set({ insulationLevel: null })` where the value is not in `insulationLevels`, with a one-line comment on why (a one-time migration; no DAL query finds rows by an invalid level).

  Don't run it.
- [ ] **Step 5: Run** the verify set, `tsc` and eslint. All exit 0.
- [ ] **Step 6: Screenshots,** read only and no saves:
  - Systems → Attic's card, with the existing-level menu open;
  - Modify searching "R-30";
  - the meeting flow's context-panel select;
  - the customer profile card in read mode and in edit mode.

  Expected: the five depth and R-value names everywhere, never `r19`.
- [ ] **Step 7: Commit:** `feat(construction): insulation levels are named by depth and R-value, from one place in the construction core`.

### Task 2: Insulation offers follow what is there (R122, R134; spec §3.2, §8.2)

**Files:**
- Modify:
  - `CORE/constants/assemblies/roof-attic.ts:26-31`: add materials `blown-r30` and `batts-r38`.
  - `CORE/types.ts:123`: the `installs[]` entry gains `addsTo` and `styles`; `ResolvedPart` gains `over`.
  - `CORE/constants/scope-installs.ts:29-30`
  - `CORE/lib/installed-material.ts` (Benefits' file; extend it, never replace it)
  - `CORE/lib/resolve-assembly.ts:58`
  - `CORE/constants/efficiency-upgrades.ts:1`: add `'r38-insulation'`.
  - `F/lib/upgrade-rows.ts:21`
  - `F/lib/build-benefits.ts:44` (passes `installStyles`)
  - `F/types.ts`: `TradeSceneInputs.installStyles`, the `SceneChange` kind `install-style`, slot ids, `UpgradeRowState`.
  - `F/constants/home-scene-defaults.ts`
  - `F/lib/scene-resolve-inputs.ts`
  - `F/lib/scene-burst-key.ts`
  - `F/lib/part-offers.ts`
  - `F/lib/keep-efficiency-upgrades.ts`
  - `F/lib/apply-scene-change.ts:37`
  - `F/lib/scene-change-slots.ts` (`:89-131`, the efficiency slots)
  - `F/lib/upgrade-row-state.ts` (`UpgradeRowState` and `upgradeRowBlockedLine`)
  - `F/constants/scene-change-words.ts`
  - `F/ui/components/controls/system-card-body.tsx:65-97` (the R-38 and Batts chips)
  - `F/ui/components/controls/proposed-chip.tsx`, if a required chip needs a state `kind="reason" included` can't show (prefer reuse)
  - `F/constants/home-scene-copy.ts`:
    - `EFFICIENCY_UPGRADE_LABELS['r38-insulation']`;
    - `PANEL_COPY.efficiencyUpgradeHints['r38-insulation']`;
    - the `needs-redeck` reason;
    - a new end block.
  - `F/constants/home-heat-figures.ts:48-68`
  - `F/constants/home-geometry.ts` (`INSULATION_DEPTH`)
  - `scripts/verify-trade-scene.ts`, including its Benefits `{material}` assertion near `:2955` ("a replace installs blown R-38"), which this task changes.
- Create:
  - `CORE/constants/install-styles.ts`
  - `CORE/lib/attic-reachable.ts`
  - `F/lib/required-upgrade.ts`
  - `F/lib/keep-pick-options.ts`
- Test: `scripts/verify-construction-model.ts`, `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `InsulationLevel` (Task 1).
- Produces:
  - **New materials on `attic-insulation`:**
    - `'blown-r30'`: R-30, energyRank 2, label `'R-30 blown-in insulation'`.
    - `'batts-r38'`: R-38, energyRank 3, label `'R-38 batts'`, with a detail saying orderly rows with the joists slightly showing, at the same efficiency as blown-in.
  - **`INSTALL_STYLE_IDS = ['batts'] as const`** and `InstallStyleId`, in `install-styles.ts`. A style changes how an install looks, never its efficiency.
  - **The install entry type** gains:
    - `addsTo?: true`: the new material goes on top of what's there;
    - `styles?: Partial<Record<InstallStyleId, Readonly<Record<string, string>>>>`: maps the material after the efficiency swap to its styled version.
  - **`installedMaterialId(install, efficiencyUpgrades, installStyles: readonly InstallStyleId[] = [])`** (`installed-material.ts:8`): the first matching `swapsWith`, then the first matching `styles` map. `installedMaterial(scopeId, efficiencyUpgrades, installStyles = [])` (`:12`) passes it on, and `buildBenefits` passes the scene's `installStyles`, so a batts replace's benefit line names batts. It stays the one copy of the swap rule.
  - **Scope installs:**
    - Replace: `{ part: 'attic-insulation', material: 'blown-r30', swapsWith: { 'r38-insulation': 'blown-r38' }, styles: { batts: { 'blown-r30': 'batts-r30', 'blown-r38': 'batts-r38' } } }`.
    - Top off: `{ part: 'attic-insulation', material: 'blown-r30', swapsWith: { 'r38-insulation': 'blown-r38' }, addsTo: true }`.
  - **`ResolveInput`** gains `installStyles`. When the install `addsTo` and the existing material is not null, the resolver sets `ResolvedPart.over = <existing material>`.
  - **`TradeSceneInputs.installStyles: InstallStyleId[]`**, default `[]`. It's a resolver input and in `sceneBurstKey`.
  - **`atticReachable(form: RoofForm | null, picks: readonly string[]): boolean`** in `CORE/lib/attic-reachable.ts`:
    - pitched gives `true`;
    - low-slope gives `picks.includes(SCOPE_IDS.roofRedeck)`, never `redeckAllowed`, which torch down alone satisfies.

    It's the one R134 rule, read here and by `systemsAtSpot` (Task 4).
  - **`requiredUpgrade(scopeId: string, part: PartDefinition, existing: string | null): EfficiencyUpgradeId | null | 'not-offered'`** in `F/lib/required-upgrade.ts`. A material "meets the bar" when:
    - for an `addsTo` install, `installKind(part, existing, m) === 'saves-energy'`;
    - otherwise, its `energyRank` is at least the existing one's;
    - with nothing existing, always.

    It returns `null` if the base material meets the bar, else the first `swapsWith` upgrade whose material meets it, else `'not-offered'`.
  - **`offeredScopes`** adds three rules:
    1. When the home lacks the part and the offer has an `addsTo` scope, drop the scopes without `addsTo`.
    2. Drop any scope whose `requiredUpgrade` is `'not-offered'`.
    3. **R134:** when the part is `'attic-insulation'` and `!atticReachable(roofFormOf(ctx.roofType), ctx.picks)`, return `{ scopeIds: [], blocked: 'needs-redeck' }`. `OfferBlockedReason` gains `'needs-redeck'`.

    The row stays (spec §8.2, 2026-11-03), so the Attic card keeps its existing insulation chip, and `upgradeRowBlockedLine` shows the reason "Needs a redeck", as the deck shows "needs a tear-off".
  - **In `keep-pick-options.ts`:**
    - **`keepPickOptions(state, year): Pick<TradeSceneInputs, 'efficiencyUpgrades' | 'installStyles'>`**:
      - it adds every upgrade `requiredUpgrade` returns for each pick against the existing material;
      - it drops `'r38-insulation'` when no insulation scope is picked;
      - it drops `'batts'` when the replace isn't picked.

      `keepEfficiencyUpgrades` keeps its other rules (cool roof, cool paint and R-8, with today's `offersEfficiencyUpgrade(scopeIds, upgrade, existingMaterial)` signature).
    - **`applySceneChange`** spreads `keepPickOptions` over every change's result, once, after the switch. Every control writes through it (Review Focus 4).
  - **The chips:**
    - The R-38 chip is the `upgrade:r38-insulation` slot, through `sceneChangeSlots` and the card's efficiency chips, like R-8.
      - While required, the slot carries `required: true`, beside `unavailable`.
      - The card shows it as `ProposedChip kind="reason" included`.
      - Modify lists it as included, with no switch.
    - **Batts:**
      - the `SceneChange` kind `{ kind: 'install-style', style: InstallStyleId, on: boolean }`;
      - the slot id `` `style:${InstallStyleId}` ``;
      - its words in `scene-change-words.ts`;
      - a toggle chip on the replace row only.
    - `UpgradeRowState` gains `holdsR38` and `holdsBatts`.
    - Copy:
      - `EFFICIENCY_UPGRADE_LABELS['r38-insulation'] = 'Step up to R-38'`;
      - its efficiency hint;
      - `INSTALL_STYLE_LABELS = { batts: 'Batts' }`;
      - the `needs-redeck` line.
  - **Figures:**
    - `PART_HEAT_EFFECTS['attic-insulation']` gains `'blown-r30'` (equal to `'batts-r30'`) and `'batts-r38'` (equal to `'blown-r38'`).
    - `INSULATION_DEPTH` gains `'blown-r30': 0.24` and `'batts-r38': 0.31`.

- [ ] **Step 1: Write the failing checks.**
  - **Resolver:**
    - Top off over `batts-r19` resolves `blown-r30` with `over: 'batts-r19'`.
    - Replace over `batts-r19` resolves `blown-r30` with no `over`.
    - `installStyles: ['batts']` gives `batts-r30`.
    - `['batts']` with `['r38-insulation']` gives `batts-r38`.
    - Top off ignores `batts`.
  - **Offers**, pitched:

    | Existing level | Offered | R-38 |
    |---|---|---|
    | none | top off only | optional |
    | R-11, R-19 | both | optional |
    | R-30 | top off | required |
    | R-30 | replace | optional |
    | R-38 | top off | not offered |
    | R-38 | replace | required |
    | R-38 at wear New | nothing (`'already-new'`) | n/a |

  - **Flat roof:**
    - no picks: the row is blocked `'needs-redeck'`;
    - **torch down, no redeck: still blocked**;
    - torch down and redeck: offered.
    - A top-off pick drops through `keepOffered` when the redeck goes, even with torch down still picked.
    - The Attic card's existing chip is still there.
  - **Review Focus 4**, all through `applySceneChange`:
    - Top off over R-19 with R-38 off, then `{ kind: 'option', field: 'insulationLevel', value: 'r30' }`: `efficiencyUpgrades` contains `'r38-insulation'`, and the resolved material is `blown-r38`.
    - `{ kind: 'efficiency-upgrade', upgrade: 'r38-insulation', on: false }` over an R-30 top off leaves it on.
    - Raising the level to `r38` drops the top off.
    - Removing the pick removes `'r38-insulation'`.
    - Picking replace after top off leaves one insulation pick (R81).
  - **Benefits:** a batts replace's benefit line names batts, and the `:2955` assertion is updated to the new base material.
  - **A pick never flips the scene:** after a `scope` change on Today, `view` is still `'existing'`.
- [ ] **Step 2: Run.** Expected: failures on the new rules.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the verify set (with `verify-bill-cut-claims`), `tsc` and eslint. All exit 0. Don't run `verify-scope-installs.ts`, which reads Notion; note in the ledger that it's owed.
- [ ] **Step 5: Screenshot** the Attic card at existing None, R-19, R-30 and R-38, pitched and flat (with and without a redeck), with the build row's menu open, and Modify searching "R-38". Expected: the offers and chips in the table.
- [ ] **Step 6: Commit:** `feat(trade-scenes): attic insulation offers follow what is there, with R-38 and batts as options`.

### Task 3: R-38 cuts 2 points more (R126; spec §3.2, §8.2)

**Files:**
- Modify:
  - `CORE/types.ts`: `PartMaterialDefinition` gains `stepUp`.
  - `CORE/constants/assemblies/roof-attic.ts`: `blown-r38` and `batts-r38` take `stepUp`.
  - `CORE/constants/bill-cut-add-ons.ts`
  - `CORE/constants/trade-bill-cuts.ts`
  - `F/lib/scene-savings.ts`: `landed()`, editing around its `repairsEndWith`.
  - `F/constants/benefit-systems.ts:20` (`ADD_ON_SYSTEM`)
- Test: `scripts/verify-construction-model.ts`, `scripts/verify-trade-scene.ts`, `scripts/verify-bill-cut-claims.ts`, `scripts/verify-remodel-roi.ts`

**Interfaces:**
- Produces:
  - **`PartMaterialDefinition`** gains `stepUp?: { from: string, cut: BillCutAddOnId }`, typed so a material has `cut` or `stepUp`, never both.
  - **`BILL_CUT_ADD_ON_IDS`** gains `'insulation-step-up'`, labelled `'R-38 insulation'`. It's kept apart from the efficiency upgrade id `'r38-insulation'`, as `'ducts'` is from `'r8-ducts'`.
  - `trade-bill-cuts.ts` `'attic-and-basement'.addOns['insulation-step-up'] = { electric: 2, gas: 2 }`.
  - `ADD_ON_SYSTEM['insulation-step-up'] = 'attic'`.
  - **`landed()` rule** for an installed part with `stepUp`:
    - the trade base is credited only when `installKind(definition, existing, stepUp.from) === 'saves-energy'`;
    - the add-on is credited when `installKind(definition, existing, part.material) === 'saves-energy'`.
  - **The ROI calculator doesn't change.** Its add-ons are hard-coded to ducts (`remodel-roi-calculator/lib/project-remodel-roi.ts:52`). The controller reports this to the owner.

- [ ] **Step 1: Write the failing checks.** Cuts combine as `1 − Π(1 − p)`:

  | Existing | Install | Electric | Gas |
  |---|---|---|---|
  | R-19 | R-30 | 10 | 15 |
  | R-19 | R-38 | `combineCuts` of 10 and 2 | `combineCuts` of 15 and 2 |
  | R-30 | top off to R-38 | 2 | 2 |
  | R-30 | replace with R-30 | 0 | 0 |
  | R-38 | replace with R-38 | 0 | 0 |
  | none | R-38 | base plus add-on | base plus add-on |

  Plus:
  - the radiant barrier and the attic fan still earn their add-on alone;
  - `verify-bill-cut-claims` and `verify-remodel-roi` pass;
  - Benefits' two futures for an R-19 → R-38 build use the new cut.
- [ ] **Step 2: Run, implement, run** the verify set, `tsc` and eslint.
- [ ] **Step 3: Commit:** `feat(construction): R-38 insulation cuts 2 points more than R-30 on both bills`.
- [ ] **Step 4 (controller): the energy-impact tracker** in the main checkout, `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/docs/plans/2026-10-21-proposal-energy-impact-epic.md`.
  - Add the row `EI-D28 | **R-38 attic insulation is a step-up add-on: electric +2, gas +2 over R-30.** Owner (scenes TS3b.4b brainstorm, R126): "R38 slightly better, 2% better." Claude's reading: both bills. It counts on top of the insulation base only when the home is below R-30; topping off an R-30 attic to R-38 earns the 2 alone. The 3D scene and the proposal use the same figure (scenes tracker R126). | <date> |`.
  - Extend the §3.2 `attic-and-basement` row with "R-38: +2 electric, +2 gas (EI-D28)".
  - Commit only when the owner asks.
- [ ] **Step 5 (controller): owner items.**
  - Any R-38 wording in Benefits' statements is a savings claim that needs the owner's approval (R226).
  - It falls under the FTC R-value Rule, because Benefits lists the insulation scopes in `R_VALUE_SCOPES`.

### Task 4: System parts and spots (R119, R123, R124, R135; spec §3, §7, §10)

**Files:**
- Modify:
  - `CORE/constants/assemblies/windows.ts`: copy only.
  - `F/types.ts` (end block; and the renamed `BuildRowPartId`)
  - `F/constants/home-systems.ts`: `SYSTEM_PART_IDS` is renamed `BUILD_ROW_PART_IDS`, and its stale "Upgrades list" comment is fixed.
  - Every reader of `SystemPartId` / `SYSTEM_PART_IDS` (grep; the `` `build:${…}` `` slot ids keep their strings)
  - `F/ui/components/controls/system-card-body.tsx:38-41`: reads `systemMaterialIds`.
  - `F/constants/home-scene-copy.ts` (end block)
- Create:
  - `F/constants/system-parts.ts`
  - `F/lib/system-of-part.ts`
  - `F/lib/system-material-ids.ts`
  - `F/lib/systems-at-spot.ts`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `atticReachable` (Task 2).
- Produces (types in `F/types.ts`):
  - **The rename:** `BuildRowPartId` (the parts a system card's build row offers) replaces `SystemPartId`, so "system part" keeps the meaning R135 gives it.
  - **`LOOK_INSIDE_SYSTEM_IDS = ['roof', 'attic', 'windows', 'heating-cooling'] as const satisfies readonly HomeSystemId[]`** in `home-systems.ts`. It's a list, not a new id type, so the later rename to areas touches one type (R230).
  - **Spots:**
    - `HOME_SPOT_IDS = ['roof', 'window', 'equipment'] as const` and `HomeSpotId`.
    - `SPOT_OF: Record<(typeof LOOK_INSIDE_SYSTEM_IDS)[number], HomeSpotId> = { roof: 'roof', attic: 'roof', windows: 'window', 'heating-cooling': 'equipment' }`.
  - **`interface SystemPart { id: SystemPartId, assembly: AssemblyId, part: string, systems: readonly HomeSystemId[], story?: Partial<Record<HomeSystemId, SystemPartStory>>, drawnFor?: (part: ResolvedPart) => boolean }`**, with `SystemPartId = (typeof SYSTEM_PARTS)[number]['id']` and `type SystemPartStory = 'leak' | 'air-gaps'`.
  - **`SYSTEM_PARTS`** in `system-parts.ts`, `as const satisfies readonly SystemPart[]`, in step order within each system:
    - **Roof:** `covering`, `underlayment`, `ice-and-water`, `drip-edge`, `deck`, `rafters`, `ridge-vent`, `gutter`.
    - **Attic:** `radiant-barrier`, `attic-fan`, `air-sealing`, `attic-insulation`.
    - **Shared:** `ceiling`, with `systems: ['roof', 'attic']` and `story: { roof: 'leak', attic: 'air-gaps' }` (Task 5).
    - **Windows:**
      - whole parts `frame` and `glazing`;
      - pieces of `glazing`: `pane` (single-pane), `outer-pane`, `low-e` (installed double-pane only), `argon` (installed double-pane only), `air-gap` (retained or worn double-pane), `inner-pane`;
      - pieces of `frame`: `seals`, `flashing`.
    - **Heating & cooling:**
      - whole parts `duct-runs`, `air-handler`, `refrigerant-lines`, `condenser`, `package-unit`;
      - pieces of `duct-runs`: `jacket`, `blanket`, `core`.
    - **Walls** (`exterior-wall`) and **foundation** (`crawl-space`): one whole system part each. `yard-ground` has none.
  - **`systemOfPart(assembly, part): HomeSystemId | null`**: looked up, never set by hand. A shared system part returns `null`.
  - **`systemMaterialIds(system: HomeSystemId, home: ResolvedHomeMaterials): HomeMaterialId[]`**: the materials the home has whose parts belong to the system, in `HOME_MATERIAL_IDS` order. `SystemCardBody` reads it in place of its own derivation (`:38-41`). Its gutters chip still rides with the roof.
  - **`systemsAtSpot(spot: HomeSpotId, ctx: { form: RoofForm, picks: readonly string[], hvacType: HVACType | null }): HomeSystemId[]`**:
    - `'roof'` gives `['roof', 'attic']` when `atticReachable(form, picks)`, else `['roof']`;
    - `'equipment'` gives `['heating-cooling']` when `ASSEMBLIES['hvac-attic'].appliesTo` holds, else `[]`;
    - `'window'` gives `['windows']`.
  - **`canLookInside(system: HomeSystemId, ctx): boolean`**: `LOOK_INSIDE_SYSTEM_IDS` includes it, and `systemsAtSpot(SPOT_OF[system], ctx)` includes it. In the same file.
  - **Copy:**
    - `SYSTEM_PART_LABELS` for the pieces: `{ pane: 'Glass', 'outer-pane': 'Outer pane', 'low-e': 'Low-E coating', argon: 'Argon gas', 'air-gap': 'Air gap', 'inner-pane': 'Inner pane', seals: 'Seals', flashing: 'Flashing', jacket: 'Silver mylar jacket', blanket: 'Insulation blanket', core: 'Inner core on its wire coil' }`. Whole parts keep their resolved part label.
    - `windows.ts`:
      - the `'vinyl-frame'` detail says virgin vinyl, sturdier than recycled vinyl;
      - the `'original-frame'` detail says aluminum on single-pane windows, vinyl on double-pane.

- [ ] **Step 1: Write the failing checks:**
  - Every construction part of the five home assemblies is exactly one whole system part, except the shared `ceiling`.
  - Every `HOME_SYSTEMS` row's part is a whole system part of that row's system.
  - System part ids are unique.
  - `systemMaterialIds('heating-cooling', home)` gives `['heating-cooling', 'ducts']` for a central home.
  - The union of `systemMaterialIds` over all systems is `HOME_MATERIAL_IDS`, each once.
  - `systemsAtSpot('roof', …)` on low-slope:
    - with no picks, `['roof']`;
    - **with torch down alone, `['roof']`;**
    - with torch down and redeck, `['roof', 'attic']`.
  - `canLookInside('heating-cooling', …)` with `hvacType: 'wall-mounted'` is false. `canLookInside('walls', …)` is false.
  - `low-e`'s `drawnFor` is true for an installed double-pane and false for a worn one; `air-gap`'s is the reverse.
  - The `` `build:${BuildRowPartId}` `` slot ids are unchanged against a captured list.
- [ ] **Step 2: Run, implement, run.**
- [ ] **Step 3: Commit:** `feat(trade-scenes): each home system lists its system parts and the spots that open it`.

### Task 5: Shared system parts show only for their story (R136; spec §7, §8.1)

**Files:**
- Modify: `F/constants/system-parts.ts` (the `ceiling` entry), `F/types.ts` (end block)
- Create: `F/lib/system-parts-shown.ts`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - **`interface SystemStory { leak: boolean, airGaps: boolean }`** and **`systemStory(targets: SceneTargets): SystemStory`**:
    - `leak` = `targets.leak.reachesInside > 0`;
    - `airGaps` = the resolved `roof-attic` `air-sealing` part is `absent`.
  - **`systemPartsShown(system: HomeSystemId, parts: Readonly<Partial<Record<AssemblyId, readonly ResolvedPart[]>>>, story: SystemStory): SystemPart[]`**: the system's system parts in table order. It keeps:
    - every whole part that resolves;
    - every piece whose `drawnFor` holds;
    - every shared system part whose `story[system]` holds now.

    It's the one rule the fade, the steps, the parts list and the pins read. Mold (TS3b.7) is a later story.

- [ ] **Step 1: Write the failing checks:**
  - **Roof:**
    - Rain with a failing roof whose leak reaches inside contains `ceiling`.
    - Normal with the same roof doesn't.
  - **Attic:**
    - With no air sealing it contains `ceiling`.
    - With air sealing in the build (`proposed`) it doesn't.
  - A flat roof shows no `radiant-barrier`, `air-sealing` or `attic-fan`.
  - A single-pane home's windows show `pane` and not `outer-pane`.
- [ ] **Step 2: Run, implement, run.**
- [ ] **Step 3: Commit:** `feat(trade-scenes): a system part two systems share shows in each only for the story it tells there`.

### Task 6: The package unit on the far slope, tied to the plenum, and its camera (R125; spec §3.4)

**Files:**
- Modify:
  - `F/constants/home-equipment-sizes.ts` (`PACKAGE_UNIT.gableX`, `gableZ`)
  - `F/lib/package-unit-placement.ts`
  - `F/ui/components/home-kit/package-unit.tsx`
  - `F/ui/components/home-kit/attic-ducts.tsx:36` (`TRUNK`)
  - `F/constants/system-camera-views.ts`: heating & cooling.
  - `F/ui/components/home-kit/home-camera-rig.tsx:63`
- Test: `scripts/verify-trade-scene.ts`, `scripts/verify-trade-scene-lot.ts`

**Interfaces:**
- Produces:
  - **The placement:**
    - `PACKAGE_UNIT.gableX` near `EQUIPMENT.plenum.position[0]` and `gableZ` on the back slope (negative z), working numbers. Start from the mirror of today's `HOUSE.halfDepth - 1.5`, and move as close to the plenum as the curb clears the ridge cap and the eave.
    - `packageUnitPlacement` returns a levelled curb on the back slope; `slopeY` handles the back slope.
  - **`packageUnitDrop(placement: { position: Vec3, curb: BoxSpec }): BoxSpec`**: a duct box from the unit's underside through the deck to the top of `TRUNK`. It draws in the ducts group. The flat-roof placement is unchanged.
  - **The camera view:** `SYSTEM_CAMERA_VIEWS` takes `(form, shape, lift, hvac: { type: HVACType | null, scale: number })`.
    - Heating & cooling aims at the package unit's placement on a package home, and at the condenser pad otherwise.
    - This closes the Controls follow-up "heating & cooling aims at the pad for every HVAC type".
    - The rig passes the home's HVAC type and AC scale.

- [ ] **Step 1: Write the failing checks** at every `AC_SCALE`:
  - The pitched placement's z is below 0.
  - All four curb bottom corners sit within 0.02 under the back slope.
  - The unit clears the ridge cap.
  - The drop meets the curb and the trunk.
  - The flat placement is unchanged.
  - **The camera:** on a package home, the heating & cooling view's target equals the unit's position; on a central home, the pad's.
- [ ] **Step 2: Run, implement, run.**
- [ ] **Step 3: Screenshots,** package home, pitched, at 3, 4 and 5 ton:
  - the default framing, Complete and Partly open (no unit on the near slope; it stays solid);
  - from behind (the unit by the plenum, its drop entering it);
  - Systems → Heating & cooling (the camera on the unit).
- [ ] **Step 4: Commit:** `fix(trade-scenes): the package unit sits on the far slope by the plenum and drops into it, and its system's camera finds it`.

### Task 7: The house fades by system (R119; spec §2.2, §7, §8.2)

**Files:**
- Create:
  - `F/lib/system-part-tag.ts`
  - `F/lib/system-part-opacity.ts`
  - `F/constants/look-inside.ts`
- Modify:
  - `F/ui/lib/apply-ghost.ts:81`
  - `F/ui/components/home-kit/home-kit.tsx`: the `ghosted` prop becomes `lit`; `hideUnseen`; the `!ghosted` gates at about `:232, 254, 288, 294`.
  - `F/types.ts` (end block)
  - The files that wrap their meshes in tag groups:
    - `roof-slope.tsx`, `gable-roof.tsx`, `low-slope-roof.tsx`
    - `attic-floor.tsx` (joists → `ceiling`, insulation)
    - `rooms.tsx` (`ceiling`)
    - `house-shell.tsx` (frame, glass)
    - `attic-ducts.tsx` (ducts, boots, plenum → `duct-runs`)
    - `home-equipment.tsx`, `package-unit.tsx`, `condenser-unit.tsx`
    - `attic-fan.tsx`, `attic-openings.tsx` (collars → `air-sealing`)
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `SYSTEM_PARTS`, `systemPartsShown` (Tasks 4–5).
- Produces:
  - **`systemPartTag(id: SystemPartId): Readonly<{ scenePart: SystemPartId }>`**: cached like `thermalTag`. The `userData` key is `scenePart`, with no "system" in it (R230).
    - **The nesting rule:** a group's `userData` is one object, so the tag always goes on its own nested `<group>`, inside or around any group that carries a `thermalTag`, `HOME_FADE_TAGS` or `HOME_GHOST_TAG`. Never merge it into theirs.
  - **`interface SystemLit { system: HomeSystemId, shown: ReadonlySet<SystemPartId>, emphasized: SystemPartId | null }`** in `types.ts`.
  - **`systemPartOpacity(tag: { scenePart?: SystemPartId }, completeOnly: boolean, lit: SystemLit, ghost: number): number`**:
    - It returns 1 for a shown system part not under `HOME_FADE_TAGS.complete`, and `LOOK_INSIDE.dimmedOpacity` for one dimmed by another's emphasis.
    - It returns `ghost` for everything else. Untagged meshes and Complete-only pieces count as everything else, which is how the roof's steps show on the near slope's kept piece.
  - **`applyGhost(root, opacity, levels?, sheets?, lit?: SystemLit | null)`**: with `lit`, each mesh's opacity is `systemPartOpacity(...) × the homeFade product`. Without `lit` it's byte-for-byte today's behaviour.
  - **`LOOK_INSIDE = { ghostOpacity: HOME_GHOST_OPACITY, dimmedOpacity: 0.25, pinsFromPeel: 0.2 }`** in `look-inside.ts`. The last two are `KIT_MOTION`'s values, which move here in Task 8.
  - **`HomeKit`** takes `lit: SystemLit | null` in place of `ghosted`. Until Task 8, the canvas passes the roof's `SystemLit` while `zoom` is set, so this task can be seen.
  - **`hideUnseen`** shows the attic group when the attic is lit, and the ducts group when heating & cooling is, even when sealed.

- [ ] **Step 1: Write the failing checks:**
  - **Pure opacity:**
    - A shown roof system part gives 1.
    - An attic part under a lit roof gives ghost.
    - A roof part under `complete` gives ghost.
    - `ceiling` not shown gives ghost.
    - With `emphasized: 'deck'`, `covering` gives 0.25 and `deck` gives 1.
  - **The three walk:** a `thermalTag` group holding a nested `systemPartTag` group, plus another tagged mesh and an untagged one, under and not under `complete`. Read each `opacity`, and check that `tagOf` (`F/ui/lib/thermal-paint-set.ts:50-66`) still finds the `thermalPart`.
  - Restoring with `applyGhost(root, 1, HOME_FADES_SHOWN)` returns every material to its `ghostBase`.
  - **Every whole system part the house draws has a tag** (source grep, as the existing checks do). Exempt, each with its reason:
    - `ice-and-water` and `drip-edge` (Task 10);
    - every piece (Task 12);
    - any HVAC part the house doesn't draw separately (confirm in `home-equipment.tsx` and `condenser-unit.tsx`).
- [ ] **Step 2: Run, implement, run.**
- [ ] **Step 3: Screenshots,** up close on the roof today (the old kit still mounts):
  - the house fades except the roof's kept near-slope piece and back slope;
  - leaving restores Complete fully opaque, with the attic hidden;
  - the Thermal zone paint is unchanged in the whole home.
- [ ] **Step 4: Commit:** `feat(trade-scenes): up close fades the house by system, keeping that system's parts solid`.

### Task 8: Look inside replaces the close-up (R119, R120, R228; spec §2.2–§2.4, §8.2)

The switch, in one commit. Before starting:
- shoot today's close-up card;
- record the head SHA in the ledger as `PRE_SWITCH` (Task 11 reads the deleted kit from it).

**Files:**
- **Delete:**
  - `F/ui/components/assembly-kits/**`
  - `F/constants/assembly-kits.ts`, `assembly-kit-components.ts`, `roof-attic-kit.ts`, `roof-attic-flows.ts`, `assembly-screens.ts`
  - `F/contexts/assembly-kit-fade-context.ts`
  - `F/lib/kit-framing.ts`, `kit-heat-lanes.ts`, `kit-line-spans.ts`, `kit-paint-temperatures.ts`, `roof-attic-kit-points.ts`, `ribbon-paths.ts`, `assembly-at-anchor.ts`
  - `F/ui/components/panel/close-up-card.tsx`, `assembly-screen.tsx`, `assembly-screen-block.tsx`, `panel-header.tsx`, `parts-block.tsx`
  - In `types.ts`: `AssemblyKitProps`, `PartRendererProps`, `AssemblyScreenBlock`, `LineSpan` (if nothing else reads it), and `SceneTargets.heading`.
  - In `resolve-scene.ts`: `headingFor`, the `kits` parameter, and the kit gating of `mode`/`water`.
  - In copy: `ASSEMBLY_HEADINGS`, `ASSEMBLY_LABELS`, `ANCHOR_PIN_LABELS`, `PANEL_COPY.closeUp`, `PANEL_COPY.kitWeatherMissing`.
  - The `zoomed` branches of `sceneVisibleAreaFor` and `dockLayoutFor`/`dockRegionFor`, and `SceneVisibleAreaValue.zoomed`.
  - Today's mutual exclusion: `scene-controls-context.tsx:55-56` (Systems leaves a close-up) and `systems-section.tsx:30-40` (a zoom closes Systems).
  - Every verify check of the above: the kit lane, ribbon, paint and registry blocks in `verify-trade-scene.ts`; the `zoomed` area and dock asserts in `verify-trade-scene-layout.ts:352-378`.
- **Rename:**
  - `F/ui/lib/leave-close-up.ts` → `F/ui/lib/leave-look-inside.ts`.
  - `KIT_EMPHASIS_FRAMING` moves from `assembly-kits.ts:22` into `system-camera-views.ts` as `PART_EMPHASIS_FRAMING`, before the kit file is deleted (`framing-toward-part.ts:3` imports it).
  - `KIT_MOTION`'s readers move to `LOOK_INSIDE` (Task 7).
- **Create:**
  - `F/lib/system-part-focus.ts`
  - `F/lib/keep-look-inside.ts`
  - `F/lib/escape-step.ts`
  - `F/ui/components/controls/look-inside-button.tsx`
  - `F/ui/components/controls/look-inside-body.tsx` (the peel and the parts list in the card)
- **Modify:** every `zoom`/`zoomed` reader on the head:
  - `types.ts:69,82`
  - `home-scene-defaults.ts`
  - `scene-controls.ts` (`LEAVE_CLOSE_UP`)
  - `scene-resolve-inputs.ts`
  - `resolve-scene.ts`
  - `scene-burst-key.ts`
  - `use-scene-shortcuts.ts:49-52,90-113`
  - `scene-keys-button.tsx:26`, and the keys sheet's Escape line
  - `scene-controls-context.tsx`
  - `systems-section.tsx`
  - `system-card.tsx`
  - `system-card-body.tsx`
  - `scene-stage.tsx:37`
  - `scene-visible-area-for.ts`, the visible-area context
  - `dock-layout-for.ts`, `scene-dock.tsx:15`
  - `trade-scene-view.tsx:72,112`
  - `ui/components/blueprint/blueprint-paper.tsx:47`
  - `home-scene-canvas.tsx`
  - `home-camera-rig.tsx`
  - `framing-toward-part.ts`
  - `part-pins.tsx`
  - `use-emphasize-part.ts`
  - `home-kit.tsx`
  - `home-anchors-layer.tsx` (the standing "Inside the roof" chip goes)
  - `system-camera-views.ts`
  - `home-scene-copy.ts`
  - `apply-scene-change.ts`
  - scripts: `verify-trade-scene.ts:473` (rain stays outside up close), `verify-trade-scene-load.ts:46` (the scene mounts not looking inside), `verify-trade-scene-lot.ts:156-165` (it walks the `HOME_ANCHOR_IDS` framings: keep the anchors it walks, or update its count)
- **Off limits:** `src/shared/components/scene/**`.
- **Test:** `scripts/verify-trade-scene.ts`, `scripts/verify-trade-scene-layout.ts`, `scripts/verify-trade-scene-load.ts`, `scripts/verify-trade-scene-lot.ts`

**Interfaces:**
- Consumes: Tasks 4, 5 and 7.
- Produces:
  - **State:**
    - `TradeSceneInputs.lookInside: boolean`, default `false`, replaces `zoom`. It's drawing only: in `sceneBurstKey`, not in `SceneResolveInputs`, since nothing resolved depends on it now that the heading goes.
    - `emphasizedPart` holds a `SystemPartId | null`.
    - **`LEAVE_LOOK_INSIDE = { lookInside: false, peel: 0, emphasizedPart: null }`** replaces `LEAVE_CLOSE_UP`. Letting the system go (`focusSystem(null)`, Recenter, a tap away, Systems closing) writes it too.
  - **`keepLookInside(state: TradeSceneInputs, year: number): Partial<TradeSceneInputs>`**: `LEAVE_LOOK_INSIDE` when `state.lookInside` and `!canLookInside(state.cameraFocus, ctx)`, else `{}`.
    - `applySceneChange` spreads it after the switch, beside `keepPickOptions`, so a roof-form, HVAC or redeck change steps back in the same write (Review Focus 5).
    - The system stays in focus.
  - **`escapeStep(ctx: { menu: boolean, lookInside: boolean, focus: SystemsFocus, open: ControlsSection | null, pins: boolean }): 'menu' | 'look-inside' | 'focus' | 'systems' | 'pins' | null`**: one layer per press, in that order. Pins only count with nothing open (Review Focus 3).
    - `use-scene-shortcuts` dispatches on it.
    - Its early return reads `escapeStep(...) === null`.
    - The keys sheet's Escape line names the new order.
  - **The card:**
    - **`LookInsideButton({ system })`**: a shadcn `Button` in the system card's body, below its two rows. It shows only when `canLookInside`, and is labelled `LOOK_INSIDE_COPY.open` ('Look inside').
      - Pressing it writes `{ lookInside: true }`.
      - While looking inside, the same button reads `LOOK_INSIDE_COPY.close` ('Back to the system') and writes `LEAVE_LOOK_INSIDE`.
      - Its DOM hook is `data-look-inside`, never `data-system-…` (R230).
    - **`LookInsideBody({ system })`**: shown below the button while looking inside. It holds the existing `PeelControl` and `PartList` over `systemPartsShown(...)`: resolved parts, or labelled pieces in one flat list (R135). It replaces `AssemblyScreen`.
    - The card keeps its Today and Tri Pros build rows unchanged, and its placement from `SCENE_LAYOUT`. On a portrait stage its body scrolls inside a height the visible area still frames the system below; the cap is a working number, set by screenshot.
  - **`leaveLookInside(store, stage)`**: focus a leaving control held goes to the card's `[data-look-inside]`, then the system's `[data-rail-chip]`, then the Systems button, with today's `focusFell` rule.
  - **The camera:**
    - **`lookInsideView(system, form, shape, lift, hvac): CameraFraming`** in `system-camera-views.ts`: a closer variant of `SYSTEM_CAMERA_VIEWS[system]` (same direction, nearer by a working factor), so going inside glides straight in.
    - The rig uses it while looking inside.
    - `systemPartFocus(system, form, id, peel): Vec3 | null` (`F/lib/system-part-focus.ts`) returns a world point. The rig passes `framingTowardPart` its offset from the view's target, with `PART_EMPHASIS_FRAMING`.
    - `open = homeView === 'partly-open'`: looking inside never forces Partly open.
  - **The resolver:** `resolveScene(inputs, cuts, year?)` loses its `kits` parameter. `targets.mode` and `targets.water` are the model's for every weather, since the house draws them all.
  - **Pins (until Task 9):** `PartPins` registers each shown system part at `systemPartFocus` while looking inside, inside `live &&` as today.
  - **Copy** (end block): `LOOK_INSIDE_COPY = { open: 'Look inside', close: 'Back to the system' }`.
  - **The heading:** the x-rayed heading and its leads go with the close-up card (spec §9; owner check in Task 13).

- [ ] **Step 1: Write the failing checks:**
  - **`escapeStep`:**
    - `{ menu: true, … }` gives `'menu'`.
    - Looking inside gives `'look-inside'` before `'focus'`.
    - Systems open with no focus gives `'systems'`.
    - Nothing open with pins gives `'pins'`.
    - Nothing at all gives `null`.
  - **`keepLookInside`:**
    - Looking inside the flat attic with torch down and redeck, then a `scope` change dropping the redeck: `lookInside: false` with `cameraFocus: 'attic'` kept, in the same result.
    - The same for `propertyPatch` to `hvacType: 'wall-mounted'` on heating & cooling.
    - The same for a `roof-form` change to flat on the attic.
  - **`sceneVisibleAreaFor`** has no close-up branch: with a system card and Look inside, the area equals the system focus's area (Review Focus 1).
  - `resolveScene` in Rain gives `targets.assemblies['roof-attic'].water` not null, with no kit.
  - `verify-trade-scene.ts:473` becomes `cameraFocus: 'roof', lookInside: true`, with the same assertion.
  - `verify-trade-scene-load.ts:46` becomes `HOME_SCENE_DEFAULTS.lookInside === false`.
  - **Nothing points at the old path:**
    - no import of a deleted path;
    - no `zoom`/`zoomed` identifier in `F/` (identifiers, not comments);
    - no `ASSEMBLY_KITS`, `LEAVE_CLOSE_UP` or `CloseUpCard`.
  - **R120:** one component draws the roof covering (`roof-covering.tsx`), mounted once, by the house.
- [ ] **Step 2: Run** to see it fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the verify set, `tsc` and eslint. All exit 0.
- [ ] **Step 5: Screenshots** at the four sizes, light and dark:
  - Systems → each of roof, attic, windows and heating & cooling: the card with Look inside.
  - Walls, foundation, and a wall-mounted heating & cooling: no Look inside.
  - **Look inside:**
    - the camera glides in, the house fades, and the peel and parts list show in the card;
    - **one card only**, and on the phone the system is still visible below it.
  - **Escape walk** (Playwright keyboard), from inside: back to the system (focus on Look inside), then to the rail (focus on the chip), then out (focus on the Systems button).
  - **The guard:** inside heating & cooling, set the unit to wall-mounted. Expected: back to the system, no empty frame (a rAF-sampled probe, `reference-measuring-ui-jitter`).
- [ ] **Step 6: Commit:** `feat(trade-scenes): Look inside on a system's card replaces the close-up; the roof & attic slice and its card retire`.

### Task 9: House pins pick the system, and parts answer taps (R119, R229; spec §2.1, §2.4)

**Files:**
- Modify:
  - `F/types.ts`: `TradeSceneInputs.tappedSpot: HomeSpotId | null`, drawing only, default `null`.
  - `F/lib/controls-press.ts`: add `pressPin`.
  - `F/contexts/scene-controls-context.tsx`: expose `pickFromPin`.
  - `F/hooks/use-scene-tap-away.ts`: skip a claimed tap.
  - `F/ui/components/home-scene-canvas.tsx`
  - `F/ui/components/home-kit/home-kit.tsx`, `house-roof.tsx`, `house-shell.tsx`, `condenser-unit.tsx`, `package-unit.tsx`
  - `F/ui/components/home-kit/home-anchors-layer.tsx` → `F/ui/components/home-kit/spot-pins-layer.tsx` (`git mv`)
  - `F/lib/anchor-pin-id.ts` → `F/lib/spot-pin-id.ts` (`git mv`)
  - `F/ui/components/anchor-pin.tsx` (its label and its `data-` hook)
  - the home-view writers (`dock-home-view.tsx` and the V shortcut)
  - `F/constants/home-scene-copy.ts`
- Create:
  - `F/lib/spot-pin-point.ts`
  - `F/contexts/scene-tap-claim-context.tsx`, with its reader hook in `F/hooks/` (standing rules)
- Test: `scripts/verify-trade-scene.ts`, `scripts/verify-trade-scene-layout.ts`

**Interfaces:**
- Consumes: `systemsAtSpot`, `SPOT_OF` (Task 4); `LEAVE_LOOK_INSIDE`, `escapeStep` (Task 8).
- Produces:
  - **House taps.** `HomeKit` takes `onSpotTap: (spot: HomeSpotId) => void` in place of `onAnchorTap`:
    - the roof sends `'roof'`;
    - any window's glass or frame sends `'window'`;
    - the condenser and the package unit send `'equipment'`.

    Each keeps the `SCENE_MOTION.tapSlopPx` guard and writes `{ tappedSpot: spot }`, which is idempotent, so the double-tap's first tap is harmless. Spot taps do nothing while looking inside.
  - **Pins:**
    - `SpotPinsLayer` places one `SceneAnchor id={spotPinId(system)}` for each of `systemsAtSpot(tappedSpot, ctx)` at `spotPinPoint(system, form, hvac)`:
      - roof and attic at `HOME_ANCHORS[form].roof` / `.attic`;
      - windows at the window the system's camera view frames;
      - heating & cooling above the condenser or the package unit.
    - The canvas renders an `AnchorPin` labelled `SYSTEM_PIN_LABELS[system]` for each, inside `live &&`, and only while not looking inside.
    - `SYSTEM_PIN_LABELS = { roof: 'Look inside the roof', attic: 'Look inside the attic', windows: 'Look inside the window', 'heating-cooling': 'Look inside heating & cooling' }`.
    - The DOM hook is `data-spot-pin` (R230).
  - **A pin picks the system (R229).**
    - **`pressPin(state: ControlsPressState, system: HomeSystemId): ControlsPressResult`** returns `{ open: 'systems', focus: system, view: state.view, toast: false }`. It's exactly what opening Systems and pressing that rail chip gives.
    - `pickFromPin(system)` applies it and clears `tappedSpot`.
    - A pin never sets `lookInside`; the card's button does.
  - **Pins clear:**
    - on Escape (`escapeStep`'s `'pins'`);
    - on a tap away (with nothing open, a canvas tap clears them);
    - on picking a pin;
    - on a home-view change (the home-view writers write `{ homeView, tappedSpot: null }`).
  - **Parts answer taps while looking inside.** A tap on a mesh under a shown system part's tag group calls `useEmphasizePart` with its id (the spec's "tap a part, on the card or on the house").
  - **The tap claim** (Review Focus 2):
    - R3F dispatches the part's click from the canvas's own `pointerup`, before the document's `pointerup` that `useSceneTapAway` hears.
    - The part handler calls `claimTap()` from `SceneTapClaimContext`, and `useSceneTapAway` skips the tap it was claimed for.
    - The same claim keeps a spot tap from also clearing the pins it shows.
    - If the dispatch order turns out to differ in the browser, stop and report. Don't work around it with timers.

- [ ] **Step 1: Write the failing checks:**
  - `pressPin({ open: null, focus: null, view: 'existing' }, 'roof')` gives `{ open: 'systems', focus: 'roof', view: 'existing', toast: false }`.
  - It deep-equals pressing Systems, then the roof chip, through `pressSection` and `pressFocus`.
  - The home-view writer's patch clears `tappedSpot`.
  - The spot pin ids round-trip through `spotPinId` and its reader.
- [ ] **Step 2: Run, implement, run.**
- [ ] **Step 3: Playwright walk** at the four sizes, light and dark:
  - **Taps:**
    - Tap the roof (pitched): two pins. Flat: one. Flat with torch down only: one. Flat with torch down and redeck: two.
    - Tap a window, the condenser, or the package unit (package home): one pin each.
    - Tap the lawn: pins gone.
    - Double-tap the lawn: the camera glides, no pins.
    - Flip the home view with pins showing: pins gone.
  - **A pin:** Systems opens with that system in focus, exactly as its rail chip does: the same camera and the same card.
  - **Systems open, tap the roof:** Systems closes (tap away), and the roof's pins show.
  - **Looking inside:**
    - tap a part on the house: it's emphasized, and Systems stays open;
    - tap the lawn: Systems closes and the house returns.
  - **During the blueprint load:** no pins and no taps.
- [ ] **Step 4: Commit:** `feat(trade-scenes): a pin on the house picks its system, as the rail does, and up close each part answers a tap`.

### Task 10: The roof and attic step open on the house (R119, R60, R136; spec §2.3, §3.1, §3.2, §8.2)

**Files:**
- Create:
  - `F/lib/step-cut-back.ts`
  - `F/ui/components/home-kit/roof-steps.tsx`
  - `F/ui/components/home-kit/attic-steps.tsx`
  - `F/ui/components/home-kit/drip-edge.tsx`
  - `F/ui/components/home-kit/eave-membrane.tsx`
- Modify:
  - `roof-slope.tsx` (its kept near-slope piece)
  - `low-slope-roof.tsx`
  - `attic-floor.tsx`
  - `rooms.tsx`
  - `F/lib/system-part-focus.ts`
  - `F/constants/look-inside.ts`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - **`stepCutBack(index: number, count: number, peel: number, step: number): number`** = `(count − 1 − index) × step × clamp(peel, 0, 1)`. The top moves furthest; the bottom never moves.
  - **The step order** is `systemPartsShown(system, …)` without its edge parts. Read `edge: true` (`drip-edge`, `gutter`) plus `ridge-vent`, named once in `look-inside.ts`. So on a flat roof every system part that resolves steps, and the ceiling steps only while its story holds.
  - **`STEP_DEPTHS: Record<(typeof LOOK_INSIDE_SYSTEM_IDS)[number], number>`** in `look-inside.ts`, working numbers: roof 0.45, attic 0.4, windows 0.06, heating & cooling 0.25.
  - **The steps:**
    - On the near slope's kept piece (`HOUSE.cutX..ROOF_HALF_LENGTH`), each roof system part starts at `HOUSE.cutX + stepCutBack(…)` while the roof is lit.
    - The attic does the same while it's lit.
    - With `lit` null, the geometry is today's, and so are the merged boxes.
  - **The ceiling** is one grouped component: `attic-floor.tsx`'s joists and `rooms.tsx`'s drywall, each under `systemPartTag('ceiling')`. It steps as one system part.
  - **New home parts,** on the kept near slope in every view, tagged: the drip edge along the near eave, and the ice & water membrane in the eave band, under the underlayment.
  - **Insulation looks (R60):**
    - With `over`, it draws the `over` material's depth, then the new blown layer up to the new depth. Without `over`, it draws only the new material.
    - `batts-*` draws as rows between the joists, with the joist tops showing. `blown-*` draws as one blanket.
    - Depths come from `laidInsulationDepth` (`F/lib/laid-insulation-depth.ts:4`).
    - Both roof forms reuse `atticInsulationBoxes(material, lowSlope, span)` (`F/lib/attic-insulation-boxes.ts:56`), with each step's span.
  - **`systemPartFocus`** returns the centre of each system part's exposed step for the roof and the attic.

- [ ] **Step 1: Write the failing checks:**
  - `stepCutBack(0, 5, 1, 0.45) === 1.8`; `(4, 5, 1, 0.45) === 0`; `(0, 5, 0, 0.45) === 0`; `(0, 5, 1.4, 0.45) === 1.8`.
  - **Both roof forms, both ways:** every non-edge shown roof and attic system part has a step, and no step exists without a shown system part. `systemPartFocus(system, form, id, 1)` is non-null, with x ≥ `HOUSE.cutX`.
  - The ceiling's step exists only when `systemPartsShown` includes it.
- [ ] **Step 2: Run, implement, run.**
- [ ] **Step 3: Screenshots** at the four sizes:
  - **Roof,** pitched and flat (with and without a redeck), at peel 0, 0.5 and 1.
  - **Attic** at peel 1 with:
    - no insulation;
    - R-19 existing;
    - top off to R-30;
    - top off to R-38;
    - replace with R-30 blown;
    - replace with R-30 batts.

    Each with and without air sealing, to see the ceiling come and go.
  - **Coverings:** each covering material (shingle at 3 colours, tile, shake, metal) at Worn and Failing. Expected: the house's own colour and wear (R120).
  - **The parts list** in the card matches the steps.
- [ ] **Step 4: Commit:** `feat(trade-scenes): the roof and the attic step open on the house, and a top off shows the new insulation over the old`.

### Task 11: The cutaway's flows: rain, leaks, heat and paint (spec §4)

Read the deleted code with `git show PRE_SWITCH:<path>`. Port the behaviour, not the kit's coordinates:

| Deleted source | Ports to |
|---|---|
| `src/features/trade-scenes/lib/kit-heat-lanes.ts` | `F/lib/cutaway-heat-lanes.ts` |
| `src/features/trade-scenes/lib/ribbon-paths.ts`, `src/features/trade-scenes/lib/kit-line-spans.ts` | `F/lib/cutaway-rain-path.ts` |
| `src/features/trade-scenes/lib/kit-paint-temperatures.ts` | `F/lib/part-paint-temperatures.ts` |
| `src/features/trade-scenes/ui/components/assembly-kits/roof-attic/roof-attic-flows.tsx`, `rain-ribbons.tsx`, `leak-drip.tsx` | `F/ui/components/home-kit/cutaway-flows.tsx` |
| `src/features/trade-scenes/ui/components/assembly-kits/roof-attic/rot-patch.tsx` | `F/ui/components/home-kit/cutaway-rot-patch.tsx` |
| `src/features/trade-scenes/ui/components/assembly-kits/roof-attic/part-thermal-paint.tsx` | `F/ui/components/home-kit/cutaway-part-paint.tsx` |
| `src/features/trade-scenes/ui/components/assembly-kits/lib/kit-part-paint.ts` | `F/ui/lib/part-paint.ts` (three.js, its own file) |
| `scripts/verify-trade-scene.ts` (the kit lane and ribbon checks) | ported to the new functions |

**Files:**
- Create: the "Ports to" column.
- Modify:
  - `home-kit.tsx`: mount `CutawayFlows` while the roof or the attic is lit.
  - `F/constants/look-inside.ts` (flow spots)
  - `F/constants/home-palette.ts` (the flow colours from `KIT_FLOW_COLORS`)
  - `F/constants/heat-arrow-look.ts` (`size.kit` → `size.cutaway`)
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - **`cutawayHeatLanes(form: RoofForm, parts: readonly ResolvedPart[], heat: HomeHeat, season: Season, peel: number, system: 'roof' | 'attic'): ArrowLane[]`**:
    - Lanes cross the stepped system parts, sun side to room, bouncing at the radiant barrier and a cool covering.
    - The attic fan's lane leaves through the gable vent while it runs.
    - Winter reverses.
    - Drawn in every heat weather, as the kit did.
  - **`cutawayRainPath(form: RoofForm, parts: readonly ResolvedPart[], water: WaterFlow, peel: number): Vec3[]`**: rain runs down the covering's step to the gutter, drops in at each soaked part's step, and drips onto the ceiling (lit by its leak story) when `reachesInside > 0`.
  - **Rot patches** sit at each soaked wood part's step.
  - **`partPaintTemperatures(parts, heat, season): Record<SystemPartId, { inner: number, outer: number }>`**: each lit system part is painted from its inner face to its outer face; the zone paint covers the rest.
  - **Readings** pin bare at the steps: the roof reading on the covering, the attic one in the attic air, the ceiling one on the ceiling (the kit's `KIT_READING_SPOTS`, moved). They stay inside `live &&`.

- [ ] **Step 1: Write the failing checks** (ported):
  - **Summer, pitched:** lanes run from above the covering step to below the insulation's step. With the radiant barrier, one bounces back up at its height.
  - **Winter:** lanes reverse.
  - **Rain at Failing:** the path reaches below the deck. At New it ends at the gutter.
  - Every `partPaintTemperatures` key is a lit system part.
  - While looking inside, the whole-house lanes (`homeHeatLanes`) aren't mounted (source check, plus the shots).
- [ ] **Step 2: Run, implement, run.**
- [ ] **Step 3: Screenshots,** roof and attic, pitched and flat:
  - Summer, Winter and Normal, Thermal off and on;
  - Rain at Fair, Worn and Failing.

  Compare with the close-up shot taken before Task 8. Expected:
  - the same story on the house's steps;
  - in Rain at Failing, the ceiling lit, with the drip on it.
- [ ] **Step 4: Commit:** `feat(trade-scenes): rain, leaks, heat and thermal paint run through the house's stepped roof and attic`.

### Task 12: A window and a duct open into their system parts (R123, R124, R135; spec §3.3, §3.4, §8.2)

**Files:**
- Create:
  - `F/ui/components/home-kit/window-panes.tsx`
  - `F/ui/components/home-kit/window-seals.tsx`
  - `F/ui/components/home-kit/duct-wraps.tsx`
  - `F/constants/system-part-looks.ts`
- Modify:
  - `house-shell.tsx`: the window the windows camera view frames draws its panes and seals while windows is lit; the frame's look follows glazing.
  - `attic-ducts.tsx`: the run named `LOOK_INSIDE_DUCT_RUN` in `look-inside.ts` draws its wraps while heating & cooling is lit.
  - `F/constants/look-inside.ts`
  - `F/lib/system-part-focus.ts`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - **`system-part-looks.ts`**, working numbers:
    - `PANE_LOOKS` (per glazing piece: thickness, colour, opacity; Low-E a faint tinted film, argon a faint tint between the panes);
    - `DUCT_WRAP_LOOKS: Record<DuctMaterial, { core: number, blanket: number, jacket: number, crush: number }>`. `r8-flex`'s blanket is thicker than `r6-silver-flex`'s, which is thicker than `original-flex`'s; `original-flex` has `crush > 0`;
    - `ORIGINAL_FRAME_LOOK = { 'single-pane': 'aluminum', 'double-pane': 'vinyl' }`, with the aluminum colour in `HOME_PALETTE`.
  - **`WindowPanes({ glazing: ResolvedPart, peel: number })`**, **`WindowSeals({ frame: ResolvedPart, peel: number })`** and **`DuctWraps({ duct: ResolvedPart, peel: number })`**: each piece stepped by `stepCutBack` and wrapped in `systemPartTag(<its id>)`.

- [ ] **Step 1: Write the failing checks:**
  - The `DUCT_WRAP_LOOKS` blanket order: `r8-flex` > `r6-silver-flex` > `original-flex`.
  - `ORIGINAL_FRAME_LOOK['single-pane'] === 'aluminum'`.
  - `systemPartFocus('windows', form, 'low-e', 1)` and `systemPartFocus('heating-cooling', form, 'jacket', 1)` are non-null.
  - `sceneSavings` and the readings for a window replacement and an R-8 ducts pick equal their values captured at Task 11's head.
- [ ] **Step 2: Run, implement, run.**
- [ ] **Step 3: Screenshots** at the four sizes, peel 0 and 1:
  - **Windows:** single-pane existing, double-pane existing, and the build's window.
  - **Heating & cooling:** a split home and a package home, with ducts original, R-6 and R-8.
- [ ] **Step 4: Commit:** `feat(trade-scenes): a window and a duct open into their system parts up close`.

### Task 13: The by-eye pass and the hand-over

**Files:**
- Shots and ledger: `.superpowers/sdd/2026-10-30-up-close-on-a-system/`

- [ ] **Step 1: Frame cost.**
  - Measure draw calls and triangles for the whole home, for each system in focus, and for each Look inside at peel 1, against the head before Task 7.
  - The gate:
    - the whole home rises by no more than 5%;
    - no Look inside exceeds today's close-up by more than 10%.

    Over the gate, merge the stepped pieces.
- [ ] **Step 2: The full matrix.**
  - All four sizes, light and dark.
  - Pitched and flat.
  - Each system.
  - Normal, Summer, Winter, Rain, Thermal.
  - Peel 0 and 1.
  - Existing and Proposed.

  List each spec §2 line with its shot in the ledger.
- [ ] **Step 3 (controller): the docs,** committed only when the owner asks:
  - **The tracker:** TS3b.4b built, with a §6 line naming the commit range.
  - **`CONTEXT.md`:** reword the entries the switch made stale:
    - Close-up card (retired);
    - Assembly kit (retired);
    - Anchor (now the pins' spots and the crawl framing);
    - Assembly screen;
    - System (`:125`, "The Upgrades tab groups its rows");
    - the entry naming `ScopesAndAddons`/`ScopeOrAddonRow` (`:180`);
    - Trade scene ("one scene kit").
- [ ] **Step 4: Owner items** for the controller's report (ask, never act on them unasked):
  - running `clear-old-insulation-levels.ts --apply` on dev, and on prod when asked;
  - running `verify-scope-installs.ts`;
  - R-38's wording in Benefits (R226, the R-value Rule);
  - the ROI calculator not listing add-ons other than ducts;
  - the x-rayed heading and leads leaving with the close-up card;
  - recording "Stepped cutaway" in `CONTEXT.md`;
  - the iPad and phone check.
