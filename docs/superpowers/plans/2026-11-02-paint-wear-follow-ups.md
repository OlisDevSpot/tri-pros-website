# Paint wear follow-ups (R204, R205) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The repaint offers water-based paint with Cool Life paint as its efficiency upgrade (R205), and the paint stains run up the gable and the parapet so the seam where they meet the wall no longer shows (R204).

**Architecture:**
- **R205.** Notion files the two paints as two scopes. The picks always hold the true one (owner, 2026-11-02, stress test):
  - `coolLifeRepaint` ("Repaint w/ Cool Life") installs `cool`, as it does today;
  - `waterBasedRepaint` ("Repaint w/ water-based", today `NOT_DRAWN`) joins the scene and installs `standard`.
  - An **upgrade scope pair** (`UPGRADE_SCOPES['cool-paint']`) makes the rep's Cool Life paint switch pick between them. The switch shows one Repaint chip, and every pick, fact and switch write settles the pick through `withUpgradeScopes`.
  - A home that already has Cool Life always holds the Cool Life scope.
  - The resolver, the kinds and the savings are unchanged: each scope installs a plain material, so water-based paint is Like for like and Cool Life saves energy.
  - The Controls chip follows the R-8 chip's pattern.
- **Order.** This plan lands before TS3b.4b (owner, 2026-11-02). TS3b.4b's plan carries a re-baseline note for the files both edit.
- **R204** places every top stain on the whole painted face: the wall plus the gable or parapet above it, up to the face's true top edge.
  - Each stain that crosses the seam is then cut into two boxes. The atlas's `v` range is split between them, so the two halves read as one streak or one blotch.
  - The wall halves stay in the house shell's existing stain meshes. The upper halves draw in one new `PaintStains` per gable or parapet fade group (+2 draws).

**Tech Stack:** TypeScript, React Three Fiber / three.js, the `pnpm tsx scripts/verify-*.ts` assertion scripts, Playwright scripts for the screenshots and draw counts.

**Spec:** `docs/superpowers/specs/2026-11-02-paint-wear-follow-ups-design.md` (owner-approved 2026-11-02). Tracker rows R204 and R205 in `docs/plans/2026-10-16-trade-scenes-epic.md`.

`F/` below means `src/features/trade-scenes/`, and `C/` means `src/shared/modules/construction/core/`.

## Global Constraints

- **Binding rules.** `.superpowers/sdd/2026-10-24-upgrades-that-follow-the-home/standing-rules.md` binds every task in full:
  - explicit-path commits;
  - no stash, reset or checkout;
  - the CRLF `git diff --shortstat` check;
  - the 300 s commit timeout and trailer;
  - no subagents;
  - foreign hunks.

  Records go in this plan's SDD workspace.
- **Worktree rules:**
  - no DB writes;
  - never run `pnpm build`;
  - never start, stop or restart the dev server on :3002 (it is the owner's);
  - never stage `docs/**` or `CONTEXT.md`;
  - run `git diff --cached` before each commit.
- **Protected files.** No edits to `src/shared/components/scene/**`, `package.json`, the eslint or tsconfig config, or `src/app/(frontend)/globals.css`. A file this plan does not name is asked about first.
- **Heavy checks** run under the lock, exactly:
  - tsc: `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock pnpm tsc`;
  - eslint: `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock env CI=1 pnpm eslint <every file you created or modified>`.

  The `pnpm tsx scripts/…` verify scripts run without the lock.
- **Browser sign-in** goes only through `/api/dev/playwright-session?secret=…&as=info%40triprosremodeling.com`.
  - Never use `role=`, which writes to the DB.
  - Never print the secret, the URL or a token.
  - The scene lives at `/dashboard/trade-scene` since `7f75f334c`. The 6-A scripts still say `/dashboard/labs/trade-scene`, so fix the redirect in your copy.
- **Another session commits on this branch.** Never stage, revert or fix its hunks.
- **Labels.**
  - The upgrade's label is exactly `Cool Life paint`.
  - Its hint is exactly `Preview a repaint to add Cool Life paint.`
  - The paint row's build chip says exactly `Repaint`, both in `add` and in `short`.
- **Cool Life never changes the colour** (owner, 2026-11-02). Both paints in the build draw `HOME_PALETTE.paintCool`, and today's colours stay as they are.
- **Draw calls.** At most +2 per home over the base.
  - **Measure as R121 did:**
    - use a copy of the 6-A counter `.superpowers/sdd/2026-11-01-ts3b6a-lot-and-light/perf.mjs`, with `signIn` and `waitPhase(page, 'live')` from `.superpowers/sdd/2026-11-01-trade-scene-blueprint-load/lib.mjs:41` (both `lib.mjs` files still say `/labs/`; fix it in your copy);
    - set Failing, all three kinds Heavy, Complete;
    - at 1280 × 800, at rest;
    - for all four homes (raised and slab, pitched and flat), two runs each.
  - **The base.** The controller measures it before Task 1 and writes it in the ledger. R121's final figures were 198, 175, 187 and 164.
  - **If the cap fails, cut in this order:**
    1. merge the new stains into a mesh already drawn in that fade group;
    2. drop the gable and parapet peeling;
    3. drop the gable and parapet blotches.

    The streaks always stay. Anything still over +2 after those cuts stops and asks.
- **The garage.** No garage file is touched (6-B).

## Review Focus

1. **A Cool Life home in a state without `'cool-paint'`.** This can come from a scene-change code, or after the rep switched Cool Life off on another home. Expected:
   - the pick is the Cool Life scope, never the water-based one;
   - the row reads Like for like;
   - no Cool Life chip shows.

   Tests: Task 1 (`upgradeScope`, `withUpgradeScopes`, kind) and Task 2 (chip).
2. **Switching Cool Life off, then unpicking and repicking the repaint.** The repick is the water-based scope, and Cool Life stays off: `keepEfficiencyUpgrades` keeps the rep's choice as it keeps the cool roof's. Test: Task 1 (the layout script's paint walk).
3. **The home's paint set to Cool Life after a water-based repaint is picked.** The same write swaps the pick to the Cool Life scope, so the picks never hold a repaint that goes down. Test: Task 1 (the fact write).
4. **Partly open on a flat home.** The left parapet's front half lifts away with its stains. Nothing hangs in the air over the cut, and the kept back half loses no part of a stain it keeps. Test: Task 3 (no upper box crosses z = 0; kept boxes end at z ≤ 0).
5. **The gable vent over the side window.** A vent streak stops at the window's head and never draws over the glass. Test: Task 3.

---

### Task 1: The water-based repaint joins the scene, and Cool Life paint picks between the two repaint scopes

The owner's ruling (2026-11-02, stress test): the picks always hold the true Notion scope. With Cool Life paint on, the repaint is `coolLifeRepaint` ("Repaint w/ Cool Life"). With it off, the repaint is `waterBasedRepaint` ("Repaint w/ water-based", today in `NOT_DRAWN`). Each scope puts on its own paint, so there is no `swapsWith` on paint and no material swap. `'cool-paint'` is the rep's remembered choice, and an **upgrade scope pair** turns it into the right pick.

**Files:**
- Create:
  - `C/constants/upgrade-scopes.ts`
  - `F/lib/upgrade-scopes.ts`
- Modify:
  - `C/constants/scope-ids.ts` (add `waterBasedRepaint: '4020ca1b-548b-82d2-96c2-81068068e903'`)
  - `C/constants/scope-not-drawn.ts:13` (remove the water-based line)
  - `C/constants/scope-installs.ts:35` (add the water-based entry; `coolLifeRepaint` stays as it is)
  - `C/constants/efficiency-upgrades.ts:1`
  - `C/constants/trade-bill-cuts.ts:11` (comment only)
  - `F/lib/part-offers.ts` (`OfferContext`, `offeredScopes`, `keepOffered`)
  - `F/lib/upgrade-rows.ts:48` (pass `efficiencyUpgrades` into the offer context)
  - `F/lib/scope-pick.ts:16`, `F/lib/home-material-patch.ts:26`, `F/lib/property-patch.ts:26` (each pick or fact write runs `withUpgradeScopes` before `keepOffered`)
  - `F/lib/apply-scene-change.ts:52` (the switch swaps the pick in the same write)
  - `F/constants/home-scene-defaults.ts:24`
  - `F/lib/keep-efficiency-upgrades.ts:5` (comment only)
  - `F/constants/scope-verbs.ts:19` (`[SCOPE_IDS.waterBasedRepaint]: 'repaint'`; the map `satisfies Record<ScopeId, …>`, so tsc needs it here)
  - `F/constants/scene-change-words.ts:63` (the new slot id's search words; the map `satisfies Record<SceneChangeSlotId, string>`)
- Test:
  - `scripts/verify-construction-model.ts`, after `wallFor`'s declaration at line 681 (it is a `const`, so earlier lines throw)
  - `scripts/verify-trade-scene.ts`, beside `regularTearOff` (about line 476), at line 510 and at line 2424
  - `scripts/verify-trade-scene-layout.ts:209-216`

**Interfaces:**
- Produces:
  - `UPGRADE_SCOPES = { 'cool-paint': { plain: SCOPE_IDS.waterBasedRepaint, upgraded: SCOPE_IDS.coolLifeRepaint } } as const satisfies Partial<Record<EfficiencyUpgradeId, { plain: ScopeId, upgraded: ScopeId }>>` in `C/constants/upgrade-scopes.ts`. Its why-comment: Notion files the two paints as two scopes, so this upgrade picks the scope instead of swapping a material, and a proposal reads the picks as they are.
  - In `F/lib/upgrade-scopes.ts`:
    - `upgradeScope(upgrade: keyof typeof UPGRADE_SCOPES, efficiencyUpgrades: readonly EfficiencyUpgradeId[], existingMaterial: string | null): ScopeId` returns `upgraded` when the upgrade is on, or when the existing material's `energyRank` is at least that of the `upgraded` scope's install material (the home already has it, so a repaint never goes down). Otherwise it returns `plain`.
    - `withUpgradeScopes(picks: readonly string[], efficiencyUpgrades: readonly EfficiencyUpgradeId[], facts: HomeFacts): string[]` replaces any picked pair member with `upgradeScope(…)`, reading the existing material from `existingParts(assembly, facts)` for the `upgraded` scope's first install.
  - `OfferContext.efficiencyUpgrades: readonly EfficiencyUpgradeId[]`. `offeredScopes` offers only the pair member `upgradeScope` names, so the paint row shows one Repaint chip.
  - `keepOffered(picks, facts, efficiencyUpgrades)`.
  - `EfficiencyUpgradeId` gains `'cool-paint'`. Task 2's labels, hints and slot ids key on it.
- Unchanged on purpose:
  - `resolveAssembly`, `kindOf`'s swap line and `scene-savings.ts`. Each scope installs a plain material, so the existing machinery gives water-based paint Like for like (no cut, no heat) and Cool Life Saves energy.
  - `TRADE_BILL_CUTS`' paint base of electric 4.
  - The `installedMaterial` helper is TS3b.4b's. This plan creates no material helper.

- [ ] **Step 1: Write the failing checks.**

  In `verify-construction-model.ts`, below line 681:

  ```ts
  const repaintWith = (scopeId: ScopeId) => resolveAssembly(ASSEMBLIES['exterior-wall'], { existing: wallFor({ property: profile({}), materials: HOME_MATERIAL_FACTS_UNSET, year: 2026 }), proposedScopeIds: [scopeId], view: 'proposed' }).find(part => part.id === 'paint')!
  assert.deepEqual([repaintWith(SCOPE_IDS.waterBasedRepaint).material, repaintWith(SCOPE_IDS.waterBasedRepaint).condition], ['standard', 'installed'], 'the water-based repaint puts on regular paint, new')
  assert.equal(repaintWith(SCOPE_IDS.coolLifeRepaint).material, 'cool')
  assert.equal(NOT_DRAWN[SCOPE_IDS.waterBasedRepaint], undefined, 'the water-based repaint is drawn')
  ```

  In `verify-trade-scene.ts`, beside `regularTearOff`. Import what is missing: `keepEfficiencyUpgrades`, `applySceneChange` or the file's `applyAll`, `withUpgradeScopes`, `upgradeScope`.

  ```ts
  const regularHome = profile({ yearBuilt: '1950-1978', roofType: 'shingle' })
  const paintOf = (scene: ReturnType<typeof at>) => scene.assemblies['exterior-wall']!.parts.find(part => part.id === 'paint')!
  const waterBased = at({ property: regularHome, view: 'proposed', proposedScopeIds: [SCOPE_IDS.waterBasedRepaint], efficiencyUpgrades: [], bills: BILLS })
  assert.equal(paintOf(waterBased).material, 'standard')
  assert.ok(!waterBased.savings.cuts.electric.parts.some(part => part.source === 'exterior-paint-stucco-and-siding'), 'a water-based repaint cuts no bill')
  assert.ok((waterBased.savings.repairsByTrade['exterior-paint-stucco-and-siding']?.value ?? 0) > 0, 'and fresh paint still earns its repairs')
  const coolLife = at({ property: regularHome, view: 'proposed', proposedScopeIds: [SCOPE_IDS.coolLifeRepaint], efficiencyUpgrades: ['cool-paint'], bills: BILLS })
  assert.ok(coolLife.savings.cuts.electric.parts.some(part => part.source === 'exterior-paint-stucco-and-siding'), 'Cool Life paint cuts the electric bill')
  const todayHeat = at({ property: regularHome, weather: 'summer' }).heat
  assert.deepEqual(at({ property: regularHome, weather: 'summer', view: 'proposed', proposedScopeIds: [SCOPE_IDS.waterBasedRepaint], efficiencyUpgrades: [] }).heat, todayHeat, 'a water-based repaint moves no reading, arrow or load')
  assert.notDeepEqual(at({ property: regularHome, weather: 'summer', view: 'proposed', proposedScopeIds: [SCOPE_IDS.coolLifeRepaint], efficiencyUpgrades: ['cool-paint'] }).heat, todayHeat, 'Cool Life does')
  const regularFacts = { property: regularHome, materials: HOME_MATERIAL_FACTS_UNSET, year: YEAR }
  const coolFacts = { ...regularFacts, materials: { ...HOME_MATERIAL_FACTS_UNSET, exteriorPaint: 'cool' as const } }
  assert.equal(upgradeScope('cool-paint', ['cool-paint'], 'standard'), SCOPE_IDS.coolLifeRepaint)
  assert.equal(upgradeScope('cool-paint', [], 'standard'), SCOPE_IDS.waterBasedRepaint)
  assert.equal(upgradeScope('cool-paint', [], 'cool'), SCOPE_IDS.coolLifeRepaint, 'a Cool Life home repaints with Cool Life whatever the switch says')
  assert.deepEqual(withUpgradeScopes([SCOPE_IDS.coolLifeRepaint], [], regularFacts), [SCOPE_IDS.waterBasedRepaint], 'switched off, the pick is the water-based scope')
  assert.deepEqual(withUpgradeScopes([SCOPE_IDS.waterBasedRepaint], [], coolFacts), [SCOPE_IDS.coolLifeRepaint], 'a Cool Life home never holds the water-based scope')
  const paintRow = (facts: Parameters<typeof upgradeRows>[0], picks: string[], upgrades: EfficiencyUpgradeId[]) => upgradeRows(facts, picks, upgrades).flatMap(system => system.rows).find(row => row.offer.partId === 'paint')!
  assert.deepEqual(paintRow(regularFacts, [], ['cool-paint']).scopeIds, [SCOPE_IDS.coolLifeRepaint], 'one repaint chip, the Cool Life scope while the switch is on')
  assert.deepEqual(paintRow(regularFacts, [], []).scopeIds, [SCOPE_IDS.waterBasedRepaint], 'and the water-based scope while it is off')
  assert.equal(paintRow(regularFacts, [SCOPE_IDS.waterBasedRepaint], []).kinds[SCOPE_IDS.waterBasedRepaint], 'like-for-like')
  assert.equal(paintRow(regularFacts, [SCOPE_IDS.coolLifeRepaint], ['cool-paint']).kinds[SCOPE_IDS.coolLifeRepaint], 'saves-energy')
  assert.equal(paintRow(coolFacts, [SCOPE_IDS.coolLifeRepaint], []).kinds[SCOPE_IDS.coolLifeRepaint], 'like-for-like', 'Cool Life over Cool Life saves nothing')
  assert.deepEqual(keepEfficiencyUpgrades(['cool-roof', 'cool-paint'], []), ['cool-roof', 'cool-paint'], 'Cool Life paint stays as the rep left it when the repaint is unpicked')
  ```

  Then add the state-level checks. Start from a regular-paint state whose picks hold the water-based scope and whose `efficiencyUpgrades` lack `'cool-paint'`:
  - Switching on (`{ kind: 'efficiency-upgrade', upgrade: 'cool-paint', on: true }`) leaves `proposedScopeIds` holding `coolLifeRepaint` and not `waterBasedRepaint`. Switching off swaps it back.
  - A fact write that sets the home's paint to Cool Life (the `'option'` change for `exteriorPaint`, as `materialSlots` builds it) leaves the picks holding `coolLifeRepaint` in the same write.

  Line 510 becomes `assert.deepEqual(HOME_SCENE_DEFAULTS.efficiencyUpgrades, ['cool-roof', 'cool-paint'], 'every roof and repaint pick starts on the upgrade')`, and line 2424's expectation becomes `['cool-roof', 'cool-paint', 'r8-ducts']`.

  In `verify-trade-scene-layout.ts:209-216`, the walk's expectations carry `'cool-paint'` beside `'cool-roof'`. Add a paint walk through `applySceneChange`, which is Review Focus 2's test:
  1. pick Repaint, and the pick is `coolLifeRepaint`;
  2. switch Cool Life paint off, and the pick is `waterBasedRepaint`;
  3. unpick;
  4. repick, and it is still `waterBasedRepaint` with `'cool-paint'` still off.

- [ ] **Step 2: Run** `pnpm tsx scripts/verify-construction-model.ts`, `pnpm tsx scripts/verify-trade-scene.ts` and `pnpm tsx scripts/verify-trade-scene-layout.ts`. Expected: each fails at run time, because tsx doesn't type-check. The failures are on the missing `waterBasedRepaint` id and module, and on the defaults.

- [ ] **Step 3: Implement** the Interfaces above. Then:
  - **The scope id and install.** `waterBasedRepaint` installs `[{ part: 'paint', material: 'standard' }]` on `exterior-wall`, trade `exterior-paint-stucco-and-siding`. Put it next to `coolLifeRepaint`, and remove its `NOT_DRAWN` line.
  - **The id list and the default.** `EFFICIENCY_UPGRADE_IDS = ['cool-roof', 'r8-ducts', 'cool-paint']`, and `efficiencyUpgrades: ['cool-roof', 'cool-paint']`.
  - **The three write points** (`scopePick`, `settled`, `propertyPatch`) call `withUpgradeScopes(picks, upgrades, facts)` before `keepOffered(…, upgrades)`.
  - **The switch.** The `'efficiency-upgrade'` case returns `efficiencyUpgradePatch(…)` plus `proposedScopeIds: withUpgradeScopes(state.proposedScopeIds, <the new upgrades>, facts)`. `efficiencyUpgradePatch` keeps its narrow signature, since its two script callers pass bare upgrade states.
  - **Comments.**
    - `keepEfficiencyUpgrades`: the cool roof and Cool Life paint are defaults and stay.
    - The bill-cut line: the trade's cut is Cool Life's, since a water-based repaint installs like-for-like paint and earns none.

- [ ] **Step 4: Run** the three verify scripts and tsc. Expected: all exit 0. Also run `pnpm tsx scripts/verify-scope-installs.ts`, a read-only Notion call. It must pass with the water-based scope now in `SCOPE_INSTALLS` and out of `NOT_DRAWN`; skip it only if Notion is unreachable, and record that.

- [ ] **Step 5: Commit** the listed files by explicit path: `feat(trade-scenes): the water-based repaint joins the scene and Cool Life paint, on by default, picks the Cool Life repaint`.

### Task 2: The Cool Life paint chip, the neutral repaint copy and the build's colour

**Files:**
- Modify:
  - `F/lib/scope-chip-options.ts:7`
  - `F/lib/upgrade-row-state.ts`
  - `F/types.ts:597-606` (`UpgradeRowState`)
  - `F/lib/scene-change-slots.ts:90-125`
  - `F/ui/components/controls/system-card-body.tsx:64-90`
  - `F/constants/home-scene-copy.ts:70,215,297`
  - `F/constants/scene-change-words.ts:40`
  - `F/ui/lib/paint-look.ts`
  - `F/ui/components/home-kit/home-kit.tsx:198`
- Test: `scripts/verify-trade-scene.ts`: the slot checks (about line 2441), the copy loop (about line 825) and the `paintLook` checks (about line 1811)

**Interfaces:**
- Consumes: Task 1's `'cool-paint'`, `UPGRADE_SCOPES`, `upgradeScope` and the swap on the switch.
- Produces:
  - `offersEfficiencyUpgrade(scopeIds, upgrade, existingMaterial?: string | null): boolean`. It is true when an install swaps for the upgrade, or a scope is a member of `UPGRADE_SCOPES[upgrade]`. With `existingMaterial` given, the switch is not offered when `upgradeScope(upgrade, [], existingMaterial)` already names `upgraded` (the home has it).
  - `UpgradeRowState` gains `holdsCoolPaint: boolean` and `coolPaintOn: boolean`.
  - `paintLook(paint: PartState, paintWear: PaintWear, repainted: boolean): PaintLook`.

- [ ] **Step 1: Write the failing checks** beside the cool roof slot checks. Build `noCoolPaint` from `base` without `'cool-paint'`, because `base` holds it by default and the chip check would otherwise pass before any work.

  ```ts
  const coolPaintOf = (state: TradeSceneInputs) => slotsOf(state).find(s => s.id === 'upgrade:cool-paint')
  assert.equal(coolPaintOf(base)?.unavailable, 'Preview a repaint to add Cool Life paint.', 'Cool Life paint stays listed before a repaint is picked')
  const repaintOption = (state: TradeSceneInputs) => slotsOf(state).find(s => s.id === 'build:paint')!.options
  assert.deepEqual(repaintOption(base).map(o => [o.value, o.label]), [[SCOPE_IDS.coolLifeRepaint, 'Repaint']], 'one Repaint option, the Cool Life scope by default')
  const repainted = applyAll(base, [slotsOf(base).find(s => s.id === 'build:paint')!.change(SCOPE_IDS.coolLifeRepaint)])
  assert.deepEqual([coolPaintOf(repainted)?.unavailable, coolPaintOf(repainted)?.current], [null, 'on'], 'a repaint takes Cool Life paint, on by default')
  const switchedOff = applyAll(repainted, [coolPaintOf(repainted)!.change('off')])
  assert.deepEqual([switchedOff.efficiencyUpgrades.includes('cool-paint'), switchedOff.proposedScopeIds.includes(SCOPE_IDS.waterBasedRepaint)], [false, true], 'off, the repaint is the water-based scope')
  assert.deepEqual(repaintOption(switchedOff).map(o => o.label), ['Repaint'], 'and still reads Repaint')
  const coolPainted = applyAll(noCoolPaint, [{ kind: 'option', field: 'exteriorPaint', value: 'cool' }])
  assert.equal(coolPaintOf(applyAll(coolPainted, [slotsOf(coolPainted).find(s => s.id === 'build:paint')!.change(repaintOption(coolPainted)[0]!.value)])), undefined, 'a Cool Life home shows no Cool Life switch')
  assert.deepEqual([CONTROLS_COPY.systems.buildChips.paint.add, CONTROLS_COPY.systems.buildChips.paint.short('Repaint')], ['Repaint', 'Repaint'], 'the repaint never names Cool Life, which may be off')
  assert.equal(EFFICIENCY_UPGRADE_LABELS['cool-paint'], 'Cool Life paint')
  ```

  - Import `CONTROLS_COPY` and `EFFICIENCY_UPGRADE_LABELS` if the file lacks them.
  - The paint option change's real `kind` and `field` are in `scene-change-slots.ts` `materialSlots`, case `'exterior-paint'`. Use those.
  - If the build slot's id is not `build:paint`, read it from the slots.

  Replace the `paintLook` checks at line 1811 with:

  ```ts
  assert.equal(paintLook({ material: 'standard', wear: 0 }, PAINT_WEAR_START.worn, true).color, HOME_PALETTE.paintCool, 'a water-based repaint takes the build colour')
  assert.equal(paintLook({ material: 'cool', wear: 0 }, PAINT_WEAR_START.worn, true).color, HOME_PALETTE.paintCool, 'so does Cool Life: the switch never changes the colour')
  assert.equal(paintLook({ material: 'cool', wear: 0.75 }, PAINT_WEAR_START.worn, false).color, wornColor(HOME_PALETTE.paintCool, WEAR_LOOKS.paint.chalk, 0.75), 'today\'s Cool Life keeps its colour')
  assert.equal(paintLook({ material: 'standard', wear: 0 }, PAINT_WEAR_START.worn, false).color, HOME_PALETTE.stucco, 'today\'s new regular paint keeps the stucco colour')
  ```

  Keep the other three `paintLook` checks, passing `false`.

- [ ] **Step 2: Run** `pnpm tsx scripts/verify-trade-scene.ts`. Expected: it fails at run time on the missing slot, labels and the copy.

- [ ] **Step 3: Implement.**
  - **The hold rule.** Widen `offersEfficiencyUpgrade` as the Interfaces say, and say in its comment why an upgrade the home already has is not offered. Only `holdsCoolPaint` passes the existing material (`row.existing.material`). The cool roof and R-8 calls stay as they are.
  - **`upgradeRowState`.**
    - `holdsCoolPaint`: `offersEfficiencyUpgrade(row.offer.scopeIds, 'cool-paint', row.existing.material)`.
    - `coolPaintOn`: `picked === UPGRADE_SCOPES['cool-paint'].upgraded`. The pick is the truth, not the flag.
  - **The slot (`scene-change-slots.ts`).**
    - `upgrade:cool-paint` follows R-8's pattern: it is taken by an unblocked row with a pick, and otherwise listed with its hint.
    - Reuse `upgradeSlot` (line 96) and widen its parameter to `EfficiencyUpgradeId`.
    - Fold the R-8 and Cool Life paint selection (`taken ?? first listed`) into one local `heldBy(hold)` helper, so it isn't written twice.
    - The switch's change is the existing `'efficiency-upgrade'` change. Task 1 made it swap the pick.
  - **The chip (`system-card-body.tsx`).** Append `holdsCoolPaint && upgrade('cool-paint', false)`, since the Repaint chip beside it already says why. Widen `upgrade`'s parameter the same way.
  - **Copy (`home-scene-copy.ts`):**
    - hint `'cool-paint': 'Preview a repaint to add Cool Life paint.'`;
    - label `'cool-paint': 'Cool Life paint'`;
    - `buildChips.paint`: `{ add: 'Repaint', short: () => 'Repaint' }`.
  - **Search words (`scene-change-words.ts`).** `BUILD_WORDS.paint` becomes `'repaint'`. The upgrade's own words came in Task 1.
  - **`paintLook`.** The colour is `paintCool` when `repainted || paint.material === 'cool'`, and otherwise `stucco`. Its comment gives the reason only, with no tracker id: the build's paint takes the build colour whichever paint goes on, until paint colour becomes its own pick.
  - **`home-kit.tsx`.** Pass `repainted` as `wallParts.find(part => part.id === 'paint')?.condition === 'installed'`.
  - **The old panel.** It is not wired: it renders no upgrade chip, and `EFFICIENCY_UPGRADE_LABELS` has no consumer there (spec §4).
  - **`CONTEXT.md`.** The controller already applied the new wording (unstaged) during the stress test. Check it matches what this task ships.

- [ ] **Step 4: Run** `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsx scripts/verify-trade-scene-layout.ts`, tsc, and eslint on the files. Expected: all exit 0.

- [ ] **Step 5: Screens.** Write them to `<workspace>/shots/task-2/` with a one-page `report.md`. Use a regular-paint pitched home with Repaint picked, in the Tri Pros build:
  - the paint system card with the chip on and off, at 1280 and 390, light and dark;
  - Thermal in Summer with Cool Life on and off, at 1280 and 390, light and dark. Expected: the walls' readings and arrows change only with Cool Life on, and the wall colour is the same in both;
  - a Cool Life home with Repaint picked, at 1280 and 390, light and dark: no chip.

- [ ] **Step 6: Commit** by explicit path: `feat(trade-scenes): the Cool Life paint chip sits under the repaint, which reads Repaint and keeps one colour either way`.

### Task 3: Stains placed on the whole painted face, cut at the seam

**Files:**
- Create: `F/lib/painted-surface-stains.ts`
- Modify:
  - `F/lib/stain-boxes.ts:68-106,123-140`
  - `F/constants/paint-wear.ts:25-30`
  - `F/constants/wear-looks.ts` (paint: vent streak numbers)
  - `F/types.ts:623-632`
  - `F/ui/lib/vertex-tinted-geometry.ts:66-77`
  - `F/lib/roof-cracks.ts:17-18` (export `LEFT_PARAPET_CUT`)
- Test: `scripts/verify-trade-scene.ts`, a new block after the stain checks (about line 1985)

**Interfaces:**
- **Types (`types.ts`):**
  - `interface StainBox extends BoxSpec { u?: readonly [number, number], v?: readonly [number, number] }`: the share of the atlas cell's width (`u`, along the run) and height (`v`) this box shows, each defaulting to `[0, 1]`;
  - `StainBoxes.boxes: readonly StainBox[]`;
  - `interface SurfaceStains { streaks: StainBox[], blotches: StainBox[] }`.
- **Constants (`paint-wear.ts`):** `STAIN_SEEDS`.
  - `streaks: { back: 21, left: 22, right: 23, front: 25 }` and `blotches: { back: 31, left: 32, right: 33, front: 35 }`: today's seeds, so the eave walls keep their look.
  - `vent: { left: 141, right: 142 }`.
  - `PEELING_SEEDS` gains `gable: { left: 121, right: 122 }` and `parapet: { back: 131, left: 132, right: 133, front: 135 }`.
- **Placement (`stain-boxes.ts`):**
  - `runoffStreaks(wall, floorY, top, share, seed, openings = wall.openings, face?: PaintedSurface)`;
  - `fadeBlotches(wall, floorY, top, share, seed, sunlit, openings = wall.openings, stretch = 1, face?: PaintedSurface)`;
  - `interface PaintedSurface { topEdge: (along: number) => number, vents: readonly WallOpening[] }`, in `types.ts` beside `StainBoxes`, where the feature keeps its shared shapes.
- **The surface module (`painted-surface-stains.ts`):**
  - `STAIN_WALLS` and `FRONT_STAIN_WALL`, moved here from `house-shell.tsx:80-84`. They no longer read the shell's `SUNLIT_WALLS` (`:38`) or `FRONT_ZONE` (`:75`). Each wall's `sunlit`, the front's included, comes from `facesSummerSun` (`F/lib/faces-summer-sun.ts`), the one sun test. The shell keeps its own `SUNLIT_WALLS` for the stucco skins;
  - `gableVentOpening(side: 'left' | 'right'): WallOpening`: `{ along: 0, width: GABLE_VENT.width, sill: GABLE_VENT_Y − GABLE_VENT.height / 2 − HOUSE.floorY, head: sill + GABLE_VENT.height }`, from `home-details.ts:32` and `home-geometry.ts:204`. Check the sill against `gable-vent-boxes.ts` and use the vent's real centre. The gable's vents are `[gableVentOpening(side)]`. That is the one list 6-B filters when the garage covers the right gable (6-B §5.3);
  - `paintTopEdge(side: 'back' | 'left' | 'right' | 'front', form: RoofForm): (along: number) => number`;
  - `splitAtSeam(boxes: readonly StainBox[], seam: number): { below: StainBox[], above: StainBox[] }`;
  - `splitAlong(boxes: readonly StainBox[], at: number): { before: StainBox[], after: StainBox[] }`: the same cut across the run, remapping `u` (used at the left parapet's z = 0);
  - `paintedSurfaceStains(form: RoofForm, stainShare: number, fadeShare: number): { walls: { sides: SurfaceStains, front: SurfaceStains }, gables: { left: SurfaceStains, right: SurfaceStains }, parapets: { kept: SurfaceStains, complete: SurfaceStains } }`. The other form's lists are empty;
  - `surfaceStainLists(face: SurfaceStains, stainShare: number, fadeShare: number): StainBoxes[]`: the streak and blotch lists with their colours and alphas, moved from house-shell's `list`/`onWalls` (`house-shell.tsx:137-143`). Task 4 deletes the shell's copy, so there is one source for those alphas;
  - `roofPeeling(form: RoofForm, share: number): { gables: { left: PeelingBoxes, right: PeelingBoxes }, parapets: { kept: PeelingBoxes[], complete: PeelingBoxes[] } }`.

The rules these signatures do not settle:

- **The top edge.**
  - Pitched: the left and right walls are gable walls, with `topEdge = z => roofUndersideY(z, 'pitched')` (the rake). `gableCracks` keeps 0.08 clear of it, but the stains run to the edge, as the owner asked. The screens check that nothing pokes past the rake trim; if anything does, add a named clearance constant. The back and front are eave walls, at `WALL_TOP_Y`.
  - Flat: every wall reaches `PARAPET_TOP`, right under the coping.
  - A box's top is the edge's lower value at its two along ends.
- **Eave streaks with a `face`.**
  - Today's draws, and today's length below `top` (the seam), are kept. The streak reaches up from the seam to the top edge, so on an eave wall nothing changes.
  - A streak that crosses a vent or an opening runs from the edge down to the vent's or opening's top and stops there (today's stop rule, with vents counted).
- **Vent streaks.** Each vent takes `STREAKS_PER_SILL` slots after the windows' slots. They hang from the vent's bottom, within its width, and keep the windows' length band.
  - They stop at the head of any opening below them. The left and right windows sit under the vents, so a streak there ends at the window head.
  - Vents never take sill streaks or sill dirt. They stay in `face.vents` and never join `openings`, because `runoffStreaks` treats any opening with `sill > 0` as a window (`stain-boxes.ts:69`).
- **Blotches with a `face`.**
  - Today's four draws per blotch are kept. The middle is drawn between `floorY` and the box's top edge.
  - The count scales by the face's average height over the wall's. Take the top edge at the wall's two ends and its middle, averaged.
  - Vents count as openings for the overlap drop.
  - At the Worn look, every gable and every parapet run must carry at least one blotch part above the seam. Tune the working numbers (in `WEAR_LOOKS.paint`) until the check holds.
- **`splitAtSeam`.**
  - A box wholly below or above the seam goes to that side unchanged.
  - A crossing box becomes two boxes on the same face line and the same along span, meeting exactly at `seam`. Each `v` is the share of the original height its half covers: below `[0, s]`, above `[s, 1]`.
  - It keeps the box's own `v` if it already has one.
- **Which list an upper half joins.**
  - Pitched: the left wall's go to `gables.left`, and the right wall's to `gables.right`.
  - Flat:
    - the back and right go to `kept`;
    - the front goes to `complete`;
    - on the left, the upper boxes are first cut at z = 0 with `splitAlong`. The part behind goes to `kept`, and the part in front goes to `complete`, so it lifts away with the parapet's front half (as `parapetCracks` splits the left run at `roof-cracks.ts:17-18`). Sending a straddling blotch wholly to `complete` would strip part of it off the kept back half in Partly open, while its wall half stays, and the seam would show again. Name the cut once: export `LEFT_PARAPET_CUT = 0` from `roof-cracks.ts` and use it in both places.
- **`roofPeeling`.**
  - `wallPeeling` on each gable or parapet face is called with `floorY` and `bottom` at `WALL_TOP_Y`, the face's vents as openings, and `top` at the face's highest edge. Every bare patch and flake whose top passes the edge at either end is dropped.
  - The left parapet splits as above. A flat roof's front parapet peels too.
  - Peeling costs no draw call: it joins the gable's or parapet's existing `PaintMarks` lists.
- **`mergeStainBoxes`.**
  - A box's `v` remaps its vertices' `v` as `v0 + v × (v1 − v0)`. Its `u` remaps the vertex's place within the cell's `u` span the same way, so the cell offset still holds. Each list's boxes merge as square 36-vertex boxes in order, so a box's vertices are `uv.count / boxes.length` long.
  - Throw if that division leaves a remainder: it would mean the merge changed shape.

- [ ] **Step 1: Write the failing checks** in a new `{ … }` block. For each form in `['pitched', 'low-slope']` and each share in `[0.5, 1, 4 / 3]`, with `fadeShare = share`:
  - **None places nothing.** `paintedSurfaceStains(form, 0, 0)` and `roofPeeling(form, 0)` place nothing, in every list.
  - **The eave walls keep their look.**
    - An eave face changes nothing. Given `{ topEdge: () => WALL_TOP_Y, vents: [] }`, `runoffStreaks` and `fadeBlotches` place exactly what they place with no face, for every house wall and seed (deep-equal).
    - `paintTopEdge('back', 'pitched')(0)` and `paintTopEdge('front', 'pitched')(0)` are both `WALL_TOP_Y`.
  - **The wall halves stay on the wall.** Every wall-list box has its top at or under `WALL_TOP_Y` (+1e-9) and its bottom at or over the floor clearance.
  - **The upper halves stay inside the face.**
    - Every gable box has its bottom at or over `WALL_TOP_Y`, its top at or under `roofUndersideY(z, 'pitched')` at both along ends (+1e-9), and its along within `[-HOUSE.halfDepth, HOUSE.halfDepth]`.
    - Every parapet box sits within `[WALL_TOP_Y, PARAPET_TOP]`.
    - Every box is flat and on its wall's stain face line (as the existing check does, `near(…, 0.01)`).
  - **The kept parapet is behind the cut.**
    - Every `parapets.kept` box on the left wall (x < 0, run z) ends at z ≤ 0 (+1e-9), and every `parapets.complete` box there starts at z ≥ 0.
    - No upper box on the left run crosses z = 0.
    - A box cut there becomes two, whose `u` ranges meet.
  - **Halves line up across the seam.**
    - For every box on the wall list whose top equals `WALL_TOP_Y` and whose `v[1] < 1`, exactly one upper box exists on the same face with the same along span (1e-9).
    - Its bottom equals `WALL_TOP_Y` and its `v[0]` equals the lower box's `v[1]`.
    - At Moderate, each gable and each parapet run has at least one such pair of streaks.
  - **Blotches reach above the seam.** At `fadeShare = 1`, each gable and each parapet run (back, left, right, front) has at least one blotch box in its upper list.
  - **Vents stay clear.**
    - No box overlaps a gable vent (`gableVentOpening(side)`'s span, in z and y, using the same `GABLE_VENT` constants).
    - No list's `openings` holds a vent.
    - At Moderate, each gable has a streak hanging from just under its vent (top within 0.05 under the vent's bottom).
    - No wall box overlaps an opening, which the existing per-opening rule already covers. Run it over the new lists.
  - **More share keeps what less placed.**
    - At Moderate, the upper lists' streaks are Heavy's first ones, in place.
    - Peeling's bare patches are Heavy's first ones, by the existing peeling rule.
  - **Peeling stays inside the face.** Every gable or parapet peeling box sits inside its face, as the stains do.
  - **The merge carries `v` and `u`.**
    - `mergeStainBoxes` of one streak box with `v: [0.25, 1]` has every vertex `v` within `[0.25, 1]` (1e-6), and the top face's vertices at 1.
    - A box with `u: [0, 0.5]` keeps its vertex `u` within the first half of its cell's span.
    - The existing cell-`u` check still holds.

- [ ] **Step 2: Run** `pnpm tsx scripts/verify-trade-scene.ts`. Expected: it fails at run time on the missing module and exports (tsx doesn't type-check).

- [ ] **Step 3: Implement** the signatures and rules above.
  - **`STAIN_SEEDS`** gets the why-comment `PEELING_SEEDS` has: these are today's literal seeds, which replace house-shell's `seed + index` arithmetic, so the eave walls look as they do now.
  - Comments say why. For example: why an upper half lifts away with the parapet's front half, and why a crossing stain is two boxes (the gable and parapet draw in the roof's fade groups, the wall in the shell's).

- [ ] **Step 4: Run** `pnpm tsx scripts/verify-trade-scene.ts`, tsc, and eslint on the files. Expected: all exit 0.

  House-shell keeps its own module-local `STAIN_WALLS` until Task 4 moves it to the import.

- [ ] **Step 5: Commit** by explicit path: `feat(trade-scenes): stains are placed on the whole painted face up to its top edge and cut at the seam`.

### Task 4: The gables and parapets draw their stains and peeling, and the wall's halves meet them

**Files:**
- Modify:
  - `F/ui/components/home-kit/house-shell.tsx:28-35,77-84,135-151`
  - `F/ui/components/home-kit/home-kit.tsx:242-249`
  - `F/ui/components/home-kit/gable-roof.tsx:62-106`
  - `F/ui/components/home-kit/low-slope-roof.tsx:68-115`
- Test:
  - tsc, eslint, the screens and the draw counts below;
  - source checks in `scripts/verify-trade-scene.ts`, in the style the file already uses at about lines 1836 and 2124:
    - a `<PaintStains` sits inside each gable's group in `gable-roof.tsx`, and inside the kept and the complete parapet groups in `low-slope-roof.tsx`;
    - `house-shell.tsx` builds its stain lists with `surfaceStainLists`, and no longer holds `onWalls`;
    - the three components take the shares exactly as house-shell does (`house-shell.tsx:103-104`): `stainShare = PAINT_WEAR_SHARE[paint.paintWear.stains]` and `fadeShare = wornShare(paint.wear)`. If one passed a different share, the halves would stop lining up.

**Interfaces:**
- Consumes: Task 3's `paintedSurfaceStains`, `surfaceStainLists`, `roofPeeling`, `STAIN_WALLS` and `FRONT_STAIN_WALL`.
- Produces: `HouseShellProps.roofForm: RoofForm`, passed by `home-kit.tsx` from its `roofForm`.

- [ ] **Step 1: The wall's halves (house-shell).**
  - Import `STAIN_WALLS` and `FRONT_STAIN_WALL`; peeling keeps using them.
  - The `stains` memo, keyed on `[roofForm, stainShare, fadeShare]`, builds `sides` and `front` with `surfaceStainLists(faces.walls.sides | front, …)`. Delete the shell's `onWalls` and the streak and blotch use of `list`. The splash lists stay as they are.
  - Pass `roofForm` from `home-kit.tsx`.

- [ ] **Step 2: The gables (gable-roof).**
  - In each gable's `thermalTag` group, after its `PaintMarks`, add `<PaintStains lists={…} thermal={thermal} />` from `surfaceStainLists(faces.gables.left | right, …)`.
  - Its marks lists gain `...peelingMarks([peeling.gables.left], WEAR_LOOKS.paint.peeling.bareStucco)` (and the right).
  - Memoize each level on its own share, as house-shell does: cracks on `cracks`, stains on stains and fade, peeling on peeling.
  - `GableRoofProps.paint` already carries `wear` and `paintWear`, so the shares come from it as house-shell takes them.

- [ ] **Step 3: The parapets (low-slope-roof).**
  - Add one `PaintStains` in the kept `thermalTag('exterior')` group, after `marks.kept`, and one in the complete parapet group, after `marks.complete`.
  - Peeling joins `marks.kept` and `marks.complete` through `peelingMarks`.

- [ ] **Step 4: Run** `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsx scripts/verify-trade-scene-load.ts`, tsc, and eslint on the four files. Expected: all exit 0.

- [ ] **Step 5: Draw calls.** Count with the perf copy, per Global Constraints, at this task's HEAD. Write the base → now pairs for all four homes in the ledger, with what is left of 177 for 6-B.
  - More than +2 on any home: apply the cut order and re-count.
  - A call beyond the two new stain meshes is a merging bug: fix it.

- [ ] **Step 6: Screens.** Write them to `<workspace>/shots/task-4/` with `report.md`.
  - **The level set.** For a raised pitched home and a slab flat home, at Stains Light, Moderate and Heavy (Condition Failing, Cracks and Peeling at their defaults), light and dark, at 1280 and 390. Use the camera that shows a gable or the left parapet with its seam.
  - **Close-ups.** At 1280, close on the left gable, its vent and its window, and on the left parapet's front corner.
  - **Partly open on the flat home**, at 1280 and 390, light and dark. The parapet's front half and its stains lift away together: no stain hangs in the air, and no stain on the kept back half is cut short at the seam.
  - **Thermal and the blueprint load**, at 1280 and 390, light and dark.
  - **The checks in each shot:**
    - the seam no longer shows in the stains;
    - streaks run unbroken from under the rake or cap onto the wall;
    - nothing shows under Thermal or during the blueprint load;
    - New paint shows nothing.

- [ ] **Step 7: Commit** by explicit path: `feat(trade-scenes): the gables and parapets stain and peel up to their top edge, so the seam no longer shows`.

### After the last task (controller, docs unstaged)

- **The spec.** Set its status line to "approved 2026-11-02; plan `docs/superpowers/plans/2026-11-02-paint-wear-follow-ups.md`".
- **The tracker.** Mark R204 and R205 built, with the commit range and the draw counts.
- **`CONTEXT.md`.** Already updated during the stress test (unstaged): **Efficiency upgrade option** names Cool Life paint and the upgrade scope pair. **Bill-cutting scope** keeps "full Cool Life repaint", which is now literally true: the bill-cutting scope is the Cool Life repaint scope, and the water-based repaint is a different scope. Check both entries against what shipped.
- **Memory.** Update `project-3d-trade-scenes.md`.
