# The attic, ventilated and sealed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the whole-home attic reads as a real one, with gable vents, recessed cans, vent pipes, boots on the ceiling, today's ducts on the joists and new ducts hung from the rafters. The attic fan and air sealing become upgrades the rep can show: the fan runs on its thermostat, cools the attic, and cuts the electric bill 4%; air sealing shows as foam collars, and without it Thermal shows leaks at every ceiling opening.

**Architecture:** the core assembly gains the `attic-fan` part, and three attic-only parts take part-level `forms`, so a flat roof drops their rows. The heat model applies the fan's effect after every other effect, and only while the attic reads over 100 °F. Pure rules live in `F/lib`: when the fan runs, whether ducts hang and how their runs lie, and when collars show. The whole home draws the new pieces in the `attic` and `ducts` fade groups, except the vents and the pipe stubs on the outside. The heat lanes gain the fan lane and the leak lanes. Up close, the pitched slice gains a gable end that the fan sits on.

**Tech Stack:** three 0.180.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, React 19, Next.js 15. Checks are `tsx` verify scripts with `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-10-30-attic-ventilated-and-sealed-design.md` (R105–R111, approved 2026-10-30). Read it first. `F/` below is `src/features/trade-scenes/`, `C/` is `src/shared/modules/construction/core/`.

## Global Constraints

- Worktree `.worktrees/trade-scenes`, branch `feat/trade-scenes-foundation`. pnpm. Never `pnpm build`.
- **Gates** (owner ruling 2026-10-30: the TS3b.4a fixes land first):
  - **The TS3b.4a fixes** (`docs/superpowers/specs/2026-10-30-ts3b4a-fixes-design.md`) must be approved, built and committed first. They edit `gable-roof.tsx`, `house-roof.tsx`, `home-heat-lanes.ts`, `heat-lane-flows.ts`, `home-geometry.ts`, `attic-floor.tsx` and `home-scene-copy.ts`, give the gables the house's paint look, and split the wall and window lanes. Before Task 1, re-read every file this plan touches, and re-check each `file:line` below against the code. Where the fixes changed a signature this plan quotes (`HomeHeat`'s flows, `homeHeatLanes`, `HouseRoof`'s props), follow the code and note the change in the ledger.
  - **The camera plan** (`docs/superpowers/plans/2026-10-28-scene-camera-slide.md`): Tasks 1–7 are committed (Task 6 `120cdfa9b`, Task 7 `74bc9a0f9`). Its Task 8 may still tune `HOME_PAN` in `home-geometry.ts`. Never edit `HOME_PAN`. If its hunks are uncommitted when Task 5 starts, the shared-tree rule below applies.
  - `ignoreRaycast` is at `src/shared/components/scene/lib/ignore-raycast.ts`.
- **Verification**, every task:
  - `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock pnpm tsc` exits 0.
  - `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock env CI=1 pnpm eslint <every file the task created or modified>` exits 0. After any `--fix`, run `tsc` again.
  - `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsx scripts/verify-trade-scene-layout.ts` and `pnpm tsx scripts/verify-construction-model.ts` all exit 0. The last one checks `ROOF_ATTIC`, `SCOPE_INSTALLS` and the inference keys offline.
  - `scripts/verify-scope-installs.ts` reads Notion: run it only with the owner's OK.
  - No DB writes for testing, dev included. Never seed or edit rows to set up a shot; use the lab's own controls.
- **Shared tree: other sessions commit here.**
  - Never stash, checkout, restore, reset, or `git add -A/./-u`.
  - Before editing a shared file, and again before staging it, run `git diff HEAD -- <file>`. If any hunk is not this task's, do not stage that file; report BLOCKED.
  - Stage by explicit path. Check that `git diff --cached --name-only` lists only this task's files.
  - Commit with `git commit -m "…" -- <paths>`, using a 300000 ms timeout (the pre-commit hook takes ~110 s), then confirm with `git show --stat HEAD`.
- **Conventions:**
  - One component per file, named exports.
  - Content and config (copy, figures, lists other files read) go in `constants/`. A private value only one file reads may sit at the top of that file, as `gable-roof.tsx` does.
  - Pure rules go in `lib/` with a check. Comments say why, never what, and never cite plans or specs.
  - **`home-details.ts` never imports `home-geometry.ts`.** `home-geometry.ts:4` already imports from it, so a back-import makes a load-order cycle that `tsc` passes but that throws `ReferenceError` at load. Anything worked out from `HOUSE`, `WALL_TOP_Y` or `INSULATION_DEPTH` goes in `home-geometry.ts`; `home-details.ts` holds plain literals.
  - **Up-close parts never import from `ui/components/home-kit/`.** A piece both views draw goes in `ui/components/` (as `heat-arrows.tsx` does), and box layouts both views share are a pure `lib/*-boxes.ts`.
  - **One rule, one place.** Whether a home has ducts is decided once by `hvac-attic`'s `appliesTo` (`C/constants/assemblies/hvac-attic.ts:10`), read through the resolved scene. A part counts as installed when its material is not null, as the kit draws it (`roof-attic-kit.tsx:56`).
- **Words** (glossary, owner-agreed): gable vent, attic fan, fan thermostat, Running / Idle, ceiling opening, foam collar, hung ducts. Never "boot" for the pipe's flashing; "boot" is the register boot. Never "swap" or "add-on" in a new name.
- **Copy, verbatim** (pending the owner's copy pass):
  - Fan: label `Attic fan`, detail `A thermostat-run fan behind the gable vent that pushes the hottest attic air outside on hot days.`
  - Fan absent: `No attic fan` / `On hot days the attic's heat has only the vents to leave by.`
  - Ridge vent absent: `No ridge vent` / `Gable vents alone leave the hottest air pooled under the ridge.`
  - Panel label `Attic fan`.
- **Numbers, verbatim** (working numbers the owner tunes):
  - `ATTIC_FAN_ON_ABOVE = 100` (°F).
  - Fan while Running: summer attic −20, ceiling −1.5, load ×0.9; normal attic −6, ceiling −0.4, load ×0.96; nothing in winter.
  - Bill cut: `'attic-fan': { electric: 4 }` on `attic-and-basement`.
- **Unset roof:** the roof-attic form is never null, because `inferRoofAtticExistingConditions` uses `roofType ?? 'shingle'` (`infer-existing-conditions.ts:19`). So on an unset roof the three attic rows stay **offered**, as TS3b.4a pins (`verify-trade-scene-layout.ts:112-114` asserts `blocked: null` for `roofType: null`). Task 1 keeps those assertions.
- **Overlap with main:** the energy-impact foundation plan on main (Task 2, EI-D27) adds the same add-on. Task 2 here writes it byte-identical to that plan's entries: `BILL_CUT_ADD_ON_IDS = ['ducts', 'radiant-barrier', 'attic-fan']`, label `'Attic fan'`, and `'attic-and-basement': { base: { electric: 10, gas: 15 }, addOns: { 'radiant-barrier': { electric: 5, gas: 2 }, 'attic-fan': { electric: 4 } } }`. Main's Task 2 was amended 2026-10-30 to keep entries the fold already brings.
- **Frame time** (owner ruling 2026-10-30): headless SwiftShader milliseconds are not evidence of iPad speed. The gate is the worst-case home's **draw calls and triangles** per frame, before vs after. Probe milliseconds are recorded for information only, and the owner checks the iPad by eye at review.
- **The tracker** (`docs/plans/2026-10-16-trade-scenes-epic.md`) often carries other sessions' uncommitted hunks. If it does at Task 8, write the tracker text into the ledger and hand it back to the controller; never stage a file with someone else's hunks.
- **Playwright** (Tasks 1, 4–8):
  - Use the owner's running dev server on port 3002 (check with `ss -ltnp`). Never restart it or touch `.next`.
  - Auth `http://localhost:3002/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET>&as=info%40triprosremodeling.com&redirect=/dashboard/labs/trade-scene`. Use `as=`, never `role=`: `role=` writes the user row.
  - Chromium with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
  - Shots and the ledger go in `.superpowers/sdd/2026-10-30-attic-ventilated-and-sealed/`.
- **Off limits:** anything outside `F/`, `C/`, `src/shared/components/scene/` and the three verify scripts. No DAL, tRPC, schema, catalog or `package.json` change.

## Review Focus

1. **A fan pushed under its threshold by another upgrade.** Inland wood-shake on a normal day reads 102.1 °F, and adding radiant barrier (−6) leaves 96.1. The fan must go Idle with readings exactly as without it, never half-applied (Task 3 test `barrier idles the fan`).
2. **A wall or portable unit.** It has no boots, so there are no boot collars or boot leak arrows, but cans and pipes still get theirs (Task 5 test `no boots without ducts`, Task 6 test `leaks without ducts`).
3. **Attic picks, then the roof set to flat.** Radiant barrier, air sealing and fan picks drop, and nothing attic-only is drawn (Task 1 test `flat drops every attic-only pick`).
4. **Rain while the fan runs.** Heat is `null`, so the fan reads Idle and has no lane. Every consumer reads `heat?.atticFanRunning ?? false`; `targets.heat` is typed `HomeHeat | null`, so `tsc` forces the fallback (Task 8 by eye).
5. **R-8 hung ducts.** The fatter run still clears the deepest insulation below and the roof underside above (Task 5 test `R-8 hangs clear`).

---

### Task 1: Attic-only upgrades leave a flat roof (R111)

**Files:**
- Modify: `C/constants/assemblies/roof-attic.ts`, `F/lib/part-offers.ts`, `F/constants/home-scene-copy.ts`, `scripts/verify-trade-scene-layout.ts`

**Interfaces:**
- Produces: `const ATTIC_ONLY = ['pitched'] as const` in `roof-attic.ts` (replaces `NEEDS_AN_ATTIC`; keep its comment), used as part-level `forms` by `air-sealing` and `radiant-barrier` now and by `attic-fan` in Task 2.
- Produces: `OfferBlockedReason` without `'needs-an-attic'`.

- [ ] **Step 0: Write the frame probe and record the baseline.**
  - Start from `.superpowers/sdd/2026-10-23-home-views-and-thermal-lens/shots/final/perf.mjs` and save it as `perf.mjs` in this work's sdd folder. Fix three things it gets wrong today:
    - **Auth:** the `as=` URL above, not `role=`.
    - **Output:** `out` points at this work's sdd folder.
    - **Dock:** since `f2f0687ce` the dock has no `View` button or `Thermal` switch. Drive the home view with its one toggle (`dock-home-view.tsx`), press Thermal by its `aria-pressed` tile (`dock-thermal.tsx`), and pick the weather from the tile group (`dock-weather.tsx`). Read each selector from those files.
  - **Counting:** an `addInitScript` wraps `drawArrays`, `drawElements`, `drawArraysInstanced` and `drawElementsInstanced` on `WebGL2RenderingContext.prototype`. It counts calls and triangles (`count / 3 × instances`) per `requestAnimationFrame` frame, and reports the median over 120 settled frames.
  - **Scenes:** the default home, and the worst case: an inland pitched home, summer, Thermal on, Partly open. Today that is the most the attic can draw. After Task 7 it becomes the same home with Attic fan, Air sealing, insulation `none` and the R-8 Ducts pick.
  - Run it on the current head and write draw calls, triangles and ms (for information) to `ledger.md` as "baseline". Keep the script unchanged after this step, so Task 8 runs the same one.

- [ ] **Step 1: Write the failing checks** in `verify-trade-scene-layout.ts`. Replace the flat-roof block at `:109-116`, keeping its `keep(…)` and insulation lines:

```ts
const rowsOn = (roofType: PropertyProfile['roofType']) => upgradeRows(unset(profile({ roofType })), [], []).flatMap(system => system.rows.map(row => row.offer.partId))
for (const partId of ['radiant-barrier', 'air-sealing']) {
  assert.ok(!rowsOn('flat').includes(partId), `flat: no ${partId} row`)
  for (const roofType of [null, 'shingle', 'tile', 'woodshake', 'metal'] as const) {
    assert.ok(rowsOn(roofType).includes(partId), `${roofType}: ${partId} has a row`)
    assert.equal(offered(partId, roofType).blocked, null, `${roofType}: ${partId} is offered`)
  }
}
assert.deepEqual(keep([roofTorchDown, radiantBarrier, airSealing, atticInsulationTopOff], 'flat'), [roofTorchDown, atticInsulationTopOff], 'flat drops every attic-only pick')
```

  `upgradeRows` is already imported (`:34`). Also add the guard that replaces `buildsOn`'s general check: no material of a part whose offer does not depend on the roof carries material-level `forms`. A limit like that must sit on the part, or a row would be offered whose install `resolve-assembly.ts:65` silently skips.

```ts
for (const part of ROOF_ATTIC.parts.filter(part => !partOffers(...).find(offer => offer.partId === part.id)?.dependsOnRoof)) {
  for (const [id, material] of Object.entries(part.materials)) {
    assert.equal(material.forms, undefined, `${part.id} ${id}: a form limit sits on the part, not the material`)
  }
}
```

  Read the exact `partOffers` call and its `dependsOnRoof` field from `part-offers.ts` before writing it.

- [ ] **Step 2: Run it to see it fail.** `pnpm tsx scripts/verify-trade-scene-layout.ts` fails at `flat: no radiant-barrier row`.

- [ ] **Step 3: Implement.**
  - **`roof-attic.ts`:** give `air-sealing` and `radiant-barrier` `forms: ATTIC_ONLY` at part level. Drop the material-level `forms: NEEDS_AN_ATTIC` from `sealed` and `foil`, so a part that resolves is always installable.
  - **Ridge-vent `absentCopy`:** the verbatim copy above.
  - **`part-offers.ts`:**
    - Delete `buildsOn` and `'needs-an-attic'`.
    - The `!offer.dependsOnRoof` branch returns `{ scopeIds: offer.scopeIds, blocked: null }`.
    - Reword the comment over it: a part its form lacks never resolves, so it has no row.
    - Drop the imports this leaves unused.
  - **`home-scene-copy.ts:212`:** remove the `'needs-an-attic'` entry.

- [ ] **Step 4: Run** the three verify scripts, `tsc` and `eslint`. All pass.

- [ ] **Step 5: Commit** `feat(trade-scenes): radiant barrier and air sealing have no row on a flat roof, where there is no attic to work from`

---

### Task 2: The attic fan part, its scope and its bill cut (R106)

**Files:**
- Modify (in `C/constants/`): `assemblies/roof-attic.ts`, `scope-ids.ts`, `scope-installs.ts`, `scope-not-drawn.ts`, `bill-cut-add-ons.ts`, `trade-bill-cuts.ts`.
- Modify (other): `C/lib/assemblies/roof-attic/infer-existing-conditions.ts`, `F/constants/scope-verbs.ts`, `F/constants/home-systems.ts`, `F/constants/field-glyphs.ts`, `F/constants/home-scene-copy.ts`.
- Test: `scripts/verify-trade-scene.ts`, `scripts/verify-trade-scene-layout.ts`

**Interfaces:**
- Produces:
  - The part `attic-fan` (group `attic`, role `ventilate`, `forms: ATTIC_ONLY`) with its one material `thermostat-fan` (`energyRank: 0`, `cut: 'attic-fan'`).
  - `SCOPE_IDS.atticFan = 'e050ca1b-548b-8263-8634-01293821c390'`.
  - `BillCutAddOnId` includes `'attic-fan'`.
- Placement: in `ROOF_ATTIC.parts`, between `rafters` and `radiant-barrier`. `partOffers` lists parts in reverse, so the offer order becomes `['covering', 'deck', 'radiant-barrier', 'attic-fan', 'attic-insulation', 'air-sealing', 'gutter']`. `HOME_SYSTEMS`' attic row appends `{ assembly: 'roof-attic', part: 'attic-fan' }` after `air-sealing`.

- [ ] **Step 1: Write the failing checks.**
  - **`verify-trade-scene-layout.ts`:**
    - Update the part-order assertion at `:65` to the order above.
    - Add `'attic-fan'` to Task 1's flat-roof loop.
    - Add the registry check. The heating rows borrow `hvac.central`, as `part-glyph.tsx:12` does:

```ts
const BORROWS_HVAC_GLYPH = ['air-handler', 'package-unit']
for (const row of HOME_SYSTEMS.flatMap(system => system.rows)) {
  assert.ok(PART_LABELS[row.part], `${row.part}: has a label`)
  if (!BORROWS_HVAC_GLYPH.includes(row.part)) {
    assert.ok((FIELD_GLYPHS.part as Record<string, unknown>)[row.part], `${row.part}: has a glyph`)
  }
}
```

  - **`verify-trade-scene.ts`**, beside `barrierOnly` (`:426`):

```ts
const fanOnly = resolveScene(inputs({ property: shingleR11, weather: 'summer', view: 'proposed', proposedScopeIds: [SCOPE_IDS.atticFan], bills: BILLS }), cuts)
assert.deepEqual(fanOnly.savings.cuts.electric.parts, [{ source: 'attic-fan', percent: 4 }], 'attic fan alone: electric 4')
assert.deepEqual(fanOnly.savings.cuts.gas.parts, [], 'attic fan cuts no gas')
const fanToday = resolveScene(inputs({ property: shingleR11, weather: 'summer', bills: BILLS }), cuts)
assert.equal(roofAttic(fanToday).parts.find(part => part.id === 'attic-fan')?.condition, 'absent', 'the fan starts absent')
```

  - In `checkOneScene` (`:191`), the oracle's `addOns` collects every installed add-on **in `ROOF_ATTIC.parts` order**, because `sceneSavings` adds them in part order (`scene-savings.ts:53`) and `combineCuts` keeps that order (`combine-cuts.ts:21`). With the fan placed before radiant barrier, the full build reads `[attic-fan 4, radiant-barrier 5]`. Derive the list; never hand-order it:
    `const addOns = ROOF_ATTIC.parts.flatMap(part => { const cut = installed(part.id) ? part.materials[parts.find(p => p.id === part.id)!.material!]?.cut : undefined; return cut ? [cut] : [] })`
  - Add `assert.equal(NOT_DRAWN[SCOPE_IDS.atticFan], undefined, 'the attic fan is drawn')`, so the deleted `NOT_DRAWN` line is checked offline.
  - Add `[SCOPE_IDS.atticFan]` and `[...FULL_BUILD, SCOPE_IDS.atticFan]` to the scope sets `checkOneScene` runs over (`:119`). The pinned `FULL_BUILD` savings at `:228` stay as they are.

- [ ] **Step 2: Run them to see them fail** (tsc names the missing `SCOPE_IDS.atticFan` first).

- [ ] **Step 3: Implement.**
  - The part and its copy, verbatim from Global Constraints.
  - `scope-ids.ts`: `atticFan` after `radiantBarrier`.
  - `scope-verbs.ts`: `'add'`.
  - `scope-installs.ts`: `{ assembly: 'roof-attic', trade: 'attic-and-basement', installs: [{ part: 'attic-fan', material: 'thermostat-fan' }] }`.
  - Delete the `NOT_DRAWN` line for `e050ca1b…`.
  - `infer-existing-conditions.ts`: `'attic-fan': { material: null, condition: 'absent' }`.
  - `BILL_CUT_ADD_ON_IDS = ['ducts', 'radiant-barrier', 'attic-fan']`, with the label `'Attic fan'`.
  - `TRADE_BILL_CUTS['attic-and-basement'].addOns['attic-fan'] = { electric: 4 }`.
  - `PartGlyphId` and `FIELD_GLYPHS.part` gain `'attic-fan'`, drawn on the 24-unit grid of its neighbours: a ring and four curved blades, e.g. `'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18'`, `'M12 12c0-3 1.5-5 4-5'`, `'M12 12c3 0 5 1.5 5 4'`, `'M12 12c0 3-1.5 5-4 5'`, `'M12 12c-3 0-5-1.5-5-4'`.
  - `PART_LABELS['attic-fan'] = 'Attic fan'`.
  - If `tsc` names another `Record<BillCutAddOnId, …>`, add the fan there. The ROI calculator keeps passing only `['ducts']`.

- [ ] **Step 4: Run** the three verify scripts, `tsc` and `eslint`. All pass.

- [ ] **Step 5: Commit** `feat(trade-scenes): the attic fan is an attic upgrade that cuts the electric bill 4%`

---

### Task 3: The fan thermostat and its heat

**Files:**
- Create: `F/lib/attic-fan-runs.ts`
- Modify: `F/types.ts`, `F/constants/home-heat-figures.ts`, `F/lib/home-heat.ts`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - `HomeHeat.atticFanRunning: boolean`, with a why-comment: installed, and the attic over the threshold before the fan's own effect.
  - `StartingHomeHeat = Omit<HomeHeat, 'bounce' | 'flows' | 'atticFanRunning'> & { flows: Omit<HomeHeatFlows, 'wallPasses' | 'windowPasses'> }` (amendment A, 2026-10-30: the TS3b.4a fixes Task 5, `a17351b10`, made `HomeHeatFlows.wall`/`.window` the sun's flow only, added `wallPasses`, `windowPasses` and `HomeHeatBounce.window`; `HeatEffect.flows` can no longer name `wall` or `window` and `applied()` copies them through untouched, so `ATTIC_FAN_HEAT_EFFECTS` names neither).
  - `ATTIC_FAN_ON_ABOVE = 100`.
  - `ATTIC_FAN_HEAT_EFFECTS: WeatherHeatEffects`, outside `PART_HEAT_EFFECTS`.
  - `atticFanRuns(fanMaterial: string | null, atticReading: number): boolean`, true only for `'thermostat-fan'` with a reading strictly over the threshold.

- [ ] **Step 1: Write the failing checks** in the heat section after `:612` (reuse `heatOf`, `near`, `LADDER`):

```ts
assert.equal(atticFanRuns('thermostat-fan', 100.1), true, 'over 100 runs')
assert.equal(atticFanRuns('thermostat-fan', 100), false, '100 itself idles')
assert.equal(atticFanRuns('thermostat-fan', 99.9), false, 'under 100 idles')
assert.equal(atticFanRuns(null, 140), false, 'no fan, nothing runs')

const FAN = { 'attic-fan': 'thermostat-fan' } as const
const shakeNormal = heatOf('inland', 'normal', { 'covering': 'wood-shake' })
const shakeNormalFan = heatOf('inland', 'normal', { 'covering': 'wood-shake', ...FAN })
assert.equal(shakeNormalFan.atticFanRunning, true, 'inland wood shakes on a normal day run the fan')
near(shakeNormalFan.readings.attic, shakeNormal.readings.attic - 6, 1e-9, 'normal: attic −6')
near(shakeNormalFan.readings.ceiling, shakeNormal.readings.ceiling - 0.4, 1e-9, 'normal: ceiling −0.4')
near(shakeNormalFan.load, shakeNormal.load * 0.96, 1e-9, 'normal: load ×0.96')

const coastSummer = heatOf('coastal', 'summer', { 'covering': 'shingle' })
const coastSummerFan = heatOf('coastal', 'summer', { 'covering': 'shingle', ...FAN })
near(coastSummerFan.readings.attic, coastSummer.readings.attic - 20, 1e-9, 'summer: attic −20')
near(coastSummerFan.readings.ceiling, coastSummer.readings.ceiling - 1.5, 1e-9, 'summer: ceiling −1.5')
near(coastSummerFan.load, coastSummer.load * 0.9, 1e-9, 'summer: load ×0.9')

const barrierShake = (fan: boolean) => heatOf('inland', 'normal', { 'covering': 'wood-shake', 'radiant-barrier': 'foil', ...(fan ? FAN : {}) })
assert.equal(barrierShake(true).atticFanRunning, false, 'barrier idles the fan')
assert.deepEqual({ ...barrierShake(true), atticFanRunning: false }, barrierShake(false), 'an Idle fan changes nothing')

for (const climate of CLIMATES) {
  for (const covering of ['shingle', 'cool-shingle', 'tile', 'wood-shake']) {
    for (const barrier of [null, 'foil']) {
      for (const sealed of [null, 'sealed']) {
        for (const insulation of LADDER) {
          const swaps = { covering, 'radiant-barrier': barrier, 'air-sealing': sealed, 'attic-insulation': insulation, ...FAN }
          assert.equal(heatOf(climate, 'summer', swaps).atticFanRunning, true, `${climate} ${covering} ${barrier} ${sealed} ${insulation}: summer runs the fan`)
          assert.equal(heatOf(climate, 'winter', swaps).atticFanRunning, false, `… winter never does`)
        }
      }
    }
  }
}

// An upgrade that raised the attic could switch the fan on by itself. A flat roof's materials are skipped: it has no fan.
for (const entry of Object.values(SCOPE_INSTALLS)) {
  for (const { part, material, swapsWith } of entry?.installs ?? []) {
    for (const installed of [material, ...Object.values(swapsWith ?? {})]) {
      const forms = entry && ASSEMBLIES[entry.assembly].parts.find(candidate => candidate.id === part)?.materials[installed]?.forms
      if (forms && !forms.includes('pitched')) {
        continue
      }
      for (const weather of ['normal', 'summer'] as const) {
        assert.ok((PART_HEAT_EFFECTS[part]?.[installed]?.[weather]?.readings?.attic ?? 0) <= 0, `${part} ${installed} ${weather}: never raises the attic`)
      }
    }
  }
}
```

  - `CLIMATES` is whatever list the file's existing loops use (`:525`), and `'coastal'` is one of its ids; check the id before writing it.
  - `PART_HEAT_EFFECTS` is not imported in `verify-trade-scene.ts` yet. Add the import.
  - There is no rain test: heat is always `null` in rain, so it could not fail. The `HomeHeat | null` type carries that case.

- [ ] **Step 2: Run it to see it fail** (`atticFanRuns` is not defined).

- [ ] **Step 3: Implement.**
  - **Types and figures:** as in Interfaces, with the figures verbatim from Global Constraints.
  - **`applied()`:** carries `atticFanRunning: heat.atticFanRunning` through unchanged.
  - **`homeHeat()`:**
    - Seed `atticFanRunning: false`.
    - Run the existing loop untouched.
    - Then, if `atticFanRuns(<the attic-fan part's material>, heat.readings.attic)`, return `{ ...applied(heat, ATTIC_FAN_HEAT_EFFECTS[weather]), atticFanRunning: true }`.
  - Add `atticFanRunning: false` to the `heatLaneFlows` literal at `:645`, and to every other `HomeHeat` literal `tsc` names.

- [ ] **Step 4: Run** the three verify scripts, `tsc` and `eslint`. The starting-home check (`:527`) still passes, since the fan starts absent.

- [ ] **Step 5: Commit** `feat(trade-scenes): the attic fan's thermostat runs it over 100 °F, and a running fan cools the attic and the ceiling`

---

### Task 4: Gable vents and the attic fan on the whole home (R105, R106)

> **Amended 2026-10-30 (owner ruling: nothing up close, the kit retires in TS3b.4b):** `AtticFan` lives in `F/ui/components/home-kit/attic-fan.tsx` (only the home draws it). `gableVentBoxes` takes only the home's facing: `gableVentBoxes(look, centre, sign: -1 | 1)`, vents in the y–z plane, proud along x; drop the `axis` parameter and its z-axis check. `HOME_PALETTE` gains `foam`, `lightCan`, `pipe` and the fan colours as new entries; leave `roof-attic-kit.ts` / `KIT_COLORS` untouched.

**Files:**
- Create: `F/ui/components/attic-fan.tsx` (shared by the home and the kit), `F/ui/components/home-kit/gable-vent.tsx`, `F/constants/attic-fan-look.ts`, `F/lib/gable-vent-boxes.ts`
- Modify: `F/constants/home-details.ts`, `F/constants/home-geometry.ts`, `F/constants/home-palette.ts`, `F/ui/components/home-kit/merged-boxes.tsx`, `gable-roof.tsx`, `house-roof.tsx`, `home-kit.tsx`, `F/constants/roof-attic-kit.ts` (`KIT_COLORS` references)
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `HomeHeat.atticFanRunning` (Task 3), `SceneBurst`, `useBurstMotion`, `ignoreRaycast`, and the gables' paint look from the TS3b.4a fixes (read its prop name from `gable-roof.tsx`).
- Produces:
  - **`GABLE_VENT`** in `home-details.ts`, plain literals: `{ width: 0.7, height: 0.45, rise: 0.85, frame: 0.05, slats: 5, slat: 0.035, proud: FOUNDATION.vent.proud }`. `rise` is the vent's centre above `WALL_TOP_Y`. Task 6 reads it.
  - **`gableVentBoxes(look: GableVentLook, centre: Vec3, facing: { axis: 'x' | 'z', sign: -1 | 1 }): BoxSpec[]`** in `F/lib/gable-vent-boxes.ts`: the frame's four sides plus `look.slats` evenly spaced horizontal slats, in the plane across `facing.axis`, all set `look.proud / 2` out along it. The home's gables face along x; the kit's gable end faces along z. `GableVentLook` is `{ width, height, frame, slats, slat, proud }`, the shape both `GABLE_VENT` and Task 7's `KIT_GABLE_END.vent` satisfy. Task 7 reuses it.
  - **`ATTIC_FAN_SPOT`** in **`home-geometry.ts`** (never `home-details.ts`, see Global Constraints): `{ position: [-HOUSE.halfLength + HOUSE.wallThickness + ATTIC_FAN_LOOK.depth / 2, WALL_TOP_Y + GABLE_VENT.rise, 0], rotationY: <facing out through the −x gable> }`.
  - **`ATTIC_FAN_LOOK`**: `{ radius: 0.22, depth: 0.1, blades: 5, box: [0.12, 0.16, 0.05], boxAt: [0.34, -0.06], light: 0.018, turnsPerSecond: 2.5 }`.
  - **`AtticFan({ running, burst, scale = 1 }: { running: boolean, burst: SceneBurst, scale?: number })`:**
    - A shroud ring, blades, and a thermostat box with its status light, all facing +z in its own frame.
    - The blades spin through `useBurstMotion` only while `running`, as `CondenserFan` does.
    - The light's material is emissive while `running`, dark otherwise. Under Thermal the light keeps its own paint: it sits in a `thermalTag(OWN_PAINT)` group, as `home-kit.tsx:219` does, so a running fan's light stays lit.
  - **`GableVent({ side }: { side: -1 | 1 })`:** `MergedBoxes` of `gableVentBoxes(GABLE_VENT, [side * HOUSE.halfLength, WALL_TOP_Y + GABLE_VENT.rise, 0], { axis: 'x', sign: side })`, coloured `HOME_PALETTE.vent`.
  - **`MergedBoxes` gains `ignoreTaps?: true`:** it spreads `{ raycast: ignoreRaycast }` onto its mesh only when set. Never pass `raycast={undefined}`, which would replace three's raycast.
  - **`HouseRoof` gains `atticFanRunning: boolean` and `burst: SceneBurst`.**
  - **`HOME_PALETTE`:** gains `foam: '#e9d27c'`, `lightCan: '#bfc3c4'`, `pipe: '#e8e4dc'` (moved from `KIT_COLORS`, which now references them), plus `fanShroud`, `fanBlade`, `fanBox` and `statusLight`.

- [ ] **Step 0: Look first.** Before writing the fan, take one shot from the default camera of a pitched home in Partly open with a placeholder disc at `ATTIC_FAN_SPOT`. If the fan reads edge-on or hidden behind the gable's stucco, stop and report it with the shot; the controller brings it to the owner. Do not move the fan to the other gable on your own.

- [ ] **Step 1: Write the failing checks** in `verify-trade-scene.ts`, a new section "Gable vents and the fan":
  - `gableVentBoxes(GABLE_VENT, centre, { axis: 'x', sign: 1 })` has `4 + GABLE_VENT.slats` boxes, and every box lies within `GABLE_VENT.width / 2` and `GABLE_VENT.height / 2` of `centre` (z and y), proud on +x. With `{ axis: 'z', sign: 1 }` the same holds with x and z swapped.
  - The vent fits under the rake: at the vent's top corners (`z = ±GABLE_VENT.width / 2`), `WALL_TOP_Y + GABLE_VENT.rise + GABLE_VENT.height / 2` is under `roofUndersideY(z, 'pitched')`.
  - The fan fits behind the vent: `ATTIC_FAN_LOOK.radius <= GABLE_VENT.height / 2`.
  - **Amendment C (2026-10-30):** the TS3b.4a fixes draw gable cracks (`gableCracks()` in `F/lib/roof-cracks.ts`) in a band from `WALL_TOP_Y + 0.1` to `WALL_TOP_Y + 0.55`; a segment that leaves the band stops. `rise` is raised from 0.75 to 0.85 so the vent's bottom (`+0.625`) clears the band's top by 0.075. Add the pure check: at full wear (`WEAR_AMOUNT` failing, read the max from `wear-looks.ts`), no box of `gableCracks(wear).left` / `.right` intersects any box of `gableVentBoxes(GABLE_VENT, <that side's centre>, side)` (axis-aligned box overlap on y and z, using each box's size). The gables take `paint: PaintLook` now; the vent keeps `HOME_PALETTE.vent`.
  - The fan sits where Partly open opens the attic: `ATTIC_FAN_SPOT.position[0] < HOUSE.cutX`, and it lies inside the inner gable face.

- [ ] **Step 2: Run it to see it fail.**

- [ ] **Step 3: Implement.**
  - **`GableRoof`:** draws `<GableVent side={-1} />` and `<GableVent side={1} />`, each inside its gable's existing `thermalTag` group. `MergedBoxes` takes `ignoreTaps`.
  - **`HouseRoof`:** when the form is pitched and `partState(parts, 'attic-fan').material !== null`, it draws `AtticFan` at `ATTIC_FAN_SPOT` **inside the `attic` group**, so the settled Complete house hides it with the attic. Wrap it in `thermalTag('attic', 'attic-fan')`: `HouseRoof`'s root is tagged `'roof'` (`house-roof.tsx:44`), and without its own tag the fan would paint roof-hot.
  - **`home-kit.tsx`:** passes `atticFanRunning={heat?.atticFanRunning ?? false}` and `burst` to `HouseRoof`.
  - **Flat roofs:** a flat roof draws no vent and no fan.

- [ ] **Step 4: Check by eye** with a playwright script (Global Constraints); save shots as `t4-*.png`:
  - A pitched home in Complete and Partly open, summer and winter, with and without the Attic fan pick.
  - A flat-roof home.
  - Vents in both gables on every pitched home, none on flat.
  - The fan behind the left vent in Partly open, and not in Complete.
  - Summer: the blades turn during the burst and the light is lit after it settles. Winter: still and dark.
  - A double-tap on a vent glides to the gable behind it.
  - Under Thermal in summer the fan paints with the attic, not the roof, and its light stays lit.

- [ ] **Step 5: Run** `tsc`, `eslint` and the verify scripts.

- [ ] **Step 6: Commit** `feat(trade-scenes): every pitched home has gable vents, and an attic fan sits behind the left one, spinning while its thermostat runs it`

---

### Task 5: Ceiling openings, boots, ducts and foam collars (R107–R110)

> **Amended 2026-10-30 (owner ruling: the kit retires):** do not edit `F/constants/roof-attic-kit.ts`; `KIT_PENETRATIONS.collar` keeps its own values. `CEILING_OPENING_LOOK` is the home's source only.
> **Amended 2026-10-31:** `HOME_PALETTE` gains `foam: '#e9d27c'`, `lightCan: '#bfc3c4'`, `pipe: '#e8e4dc'` here (moved from Task 4; add `F/constants/home-palette.ts` to this task's files), as new entries; `KIT_COLORS` keeps its own. Task 4 shipped as two commits: gable vents are a through-vent (frame and slats on both gable faces, dark `ventBacking`), and `AtticFan` sits behind the left vent in `HouseRoof`'s attic group; `HouseRoof` already takes `atticFanRunning` and `burst`.

**Files:**
- Create in `F/lib/`: `ceiling-openings.ts`, `ducts-hang.ts`, `duct-run-points.ts`, `duct-strap-boxes.ts`, `foam-collars-shown.ts`, `covering-base-y.ts`
- Create in `F/ui/components/home-kit/`: `attic-openings.tsx`, `vent-pipe-stubs.tsx`
- Modify: `F/types.ts`, `F/constants/home-geometry.ts`, `F/constants/home-details.ts`, `F/constants/roof-attic-kit.ts` (`KIT_PENETRATIONS.collar`), `F/lib/home-heat-lanes.ts` (reads `coveringBaseY`), `F/ui/components/home-kit/attic-ducts.tsx`, `home-equipment.tsx`, `house-roof.tsx`, `home-kit.tsx`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - `interface CeilingOpening { kind: 'boot' | 'can' | 'pipe', at: readonly [number, number], radius: number }` in `types.ts`.
  - **`CEILING_OPENINGS: readonly CeilingOpening[]`** in `home-geometry.ts`. Positions are working, tuned by eye:
    - Boots: one at the last point of each `EQUIPMENT.ductRuns` run, radius 0.17, derived from the runs, never retyped.
    - Cans: one per room (bedroom, living, kitchen), radius 0.09, starting near bedroom `[-4.4, -2.2]`, living `[1.2, -2.3]`, kitchen `[3.4, -2.2]`.
    - Pipes: kitchen near `[4.6, -1.3]`, bedroom near `[-3.0, -2.7]` (back slope), radius 0.04.
    - **Every opening clears the joists:** its footprint (`radius`, plus the collar's `reach`) stays off every `ATTIC_JOIST_XS` joist (`HOUSE.joistWidth` wide). Measured 2026-10-30, a living can at `x = 1.4` and the run ends at `x = −4` and `4.2` would sit on joists. Move the cans and pipes to clear them. If a run end sits on a joist, move the end of that run in `EQUIPMENT.ductRuns` by the least amount that clears it, and record the move in the ledger.
  - **`DEEPEST_INSULATION = Math.max(...Object.values(INSULATION_DEPTH))`** in `home-geometry.ts`, beside `INSULATION_DEPTH` (`:89`). Boots and hung ducts clear it, so a deeper material added later moves them too.
  - **Duct and opening figures** in `home-details.ts`, plain literals:
    - `HUNG_DUCT_MATERIALS = ['r6-silver-flex', 'r8-flex'] as const satisfies readonly DuctMaterial[]` (`C/constants/enums.ts:60`).
    - `REGISTER_BOOT = { size: 0.34, clear: 0.04 }`: a pitched boot runs from `WALL_TOP_Y` to `WALL_TOP_Y + DEEPEST_INSULATION + clear`.
    - `HUNG_DUCTS = { clear: 0.05, strap: 0.02, strapSpacing: 1.2 }`.
    - `CEILING_OPENING_LOOK = { canHeight: 0.16, stubAbove: 0.3, flashing: { reach: 0.05, height: 0.02 }, collar: { reach: 0.03, height: 0.03 } }`. This is the one source of the collar's size: `KIT_PENETRATIONS.collar` (`roof-attic-kit.ts:96`, same values today) references `CEILING_OPENING_LOOK.collar`, as `KIT_COLORS` references `HOME_PALETTE`. `AtticOpenings` tapers its collars and cans by the same factors as `air-sealing-part.tsx:12` (`reach × 1.4`) and `ceiling-part.tsx:34` (`radius × 1.1`). The up-close parts themselves stay as they are, a spec non-goal.
  - **Pure rules:**
    - **Ducts come from the resolved scene, not a new predicate:** `const ducted = targets.assemblies['hvac-attic'] !== undefined` in `home-kit.tsx`. `resolveScene` drops the assembly when `hvac-attic`'s `appliesTo` is false (`resolve-scene.ts:94`). `HomeEquipment` takes `ducted` as a prop in place of its own `type === 'central' || type === 'package-unit'` test (`home-equipment.tsx:53`).
    - `ceilingOpenings(ducted: boolean): readonly CeilingOpening[]` drops the boots when there are no ducts.
    - `ductsHang(material: string | null, lowSlope: boolean): boolean` is true for a `HUNG_DUCT_MATERIALS` material on a pitched roof. `AtticDucts`' `renewed` reads the same list.
    - `ductRunPoints(layout: 'low-slope' | 'floor' | 'hung', radius: number, sag: number): Vec3[][]` is the **one** place the drop and the sag are applied:
      - `low-slope`: today's points, with today's drop and sag.
      - `floor`: each run's lowest point rests on the joists, at `WALL_TOP_Y + HOUSE.joistDepth + radius`, with the ends raised by `sag` (the sag as today).
      - `hung`: every point level at `WALL_TOP_Y + DEEPEST_INSULATION + radius + HUNG_DUCTS.clear`, plus a last point straight above the boot at its top.
      - `attic-ducts.tsx`'s `ductRuns(drop, radius, sag)` (`:36-41`) becomes `ductRuns(points: readonly (readonly Vec3[])[], radius: number): TubeGeometry[]`, which only builds the tubes. Otherwise the sag is applied twice.
    - `ductStrapBoxes(runs: readonly (readonly Vec3[])[], radius: number): BoxSpec[]` (the `lib/*-boxes.ts` naming): one strap every `strapSpacing` along each level run, from the duct's top up to `roofUndersideY(z, 'pitched')`.
    - `foamCollarsShown(form: RoofForm, sealing: string | null, insulation: string | null): boolean`: true only when the form is pitched, `sealing !== null` and `insulation === null`.
    - `coveringBaseY(z: number, form: RoofForm): number` in `F/lib/covering-base-y.ts`: the private `COVERING_Y` moved out of `home-heat-lanes.ts:25-28` unchanged. `home-heat-lanes.ts` reads it from there, so the roof lanes and the pipe stubs agree on the roof's surface.

- [ ] **Step 1: Write the failing checks** in a new section "The attic's openings and ducts":

```ts
for (const [hvacType, ducted] of [[null, true], ['central', true], ['package-unit', true], ['wall-mounted', false], ['portable', false]] as const) {
  const scene = resolveScene(inputs({ property: { ...shingleR11, hvacType }, weather: 'summer' }), cuts)
  assert.equal(scene.assemblies['hvac-attic'] !== undefined, ducted, `${hvacType}: ducts ${ducted}`)
}
assert.ok(!ceilingOpenings(false).some(opening => opening.kind === 'boot'), 'no boots without ducts')
for (const opening of CEILING_OPENINGS) {
  const reach = opening.radius + CEILING_OPENING_LOOK.collar.reach
  for (const joist of ATTIC_JOIST_XS) {
    assert.ok(Math.abs(opening.at[0] - joist) >= reach + HOUSE.joistWidth / 2, `${opening.kind} at ${opening.at}: clears the joist at ${joist}`)
  }
}
assert.deepEqual(ceilingOpenings(true).filter(o => o.kind === 'boot').map(o => o.at), EQUIPMENT.ductRuns.map(run => [run.at(-1)![0], run.at(-1)![2]]), 'a boot at every run end')
for (const opening of CEILING_OPENINGS.filter(o => o.kind !== 'boot')) {
  assert.ok(opening.at[1] < ATTIC_SPANS.open.to - opening.radius, `${opening.kind} at ${opening.at}: off the cut line`)
}
for (const [material, lowSlope, hangs] of [['r6-silver-flex', false, true], ['r8-flex', false, true], ['original-flex', false, false], [null, false, false], ['r6-silver-flex', true, false]] as const) {
  assert.equal(ductsHang(material, lowSlope), hangs, `${material} ${lowSlope}: hangs ${hangs}`)
}
const floorRuns = ductRunPoints('floor', EQUIPMENT.ductRadius, 0.05)
near(Math.min(...floorRuns.flat().map(p => p[1])), WALL_TOP_Y + HOUSE.joistDepth + EQUIPMENT.ductRadius, 1e-9, 'old ducts rest on the joists')
for (const radius of [EQUIPMENT.ductRadius, EQUIPMENT.ductRadius * WEAR_LOOKS.newDucts.r8Girth]) {
  const hung = ductRunPoints('hung', radius, 0)
  for (const run of hung) {
    const level = run.slice(0, -1)
    assert.ok(level.every(p => p[1] === level[0]![1]), 'a hung run is level')
    assert.ok(level[0]![1] - radius >= WALL_TOP_Y + DEEPEST_INSULATION, 'R-8 hangs clear of the deepest insulation')
    assert.ok(level.every(p => p[1] + radius < roofUndersideY(p[2], 'pitched')), 'and under the roof')
  }
  for (const strap of ductStrapBoxes(hung, radius)) {
    near(strap.position[1] + strap.size[1] / 2, roofUndersideY(strap.position[2], 'pitched'), 1e-9, 'a strap hangs from the roof underside')
  }
}
assert.equal(foamCollarsShown('pitched', 'sealed', null), true)
for (const [form, sealing, insulation] of [['pitched', 'sealed', 'batts-r11'], ['pitched', null, null], ['low-slope', 'sealed', null]] as const) {
  assert.equal(foamCollarsShown(form, sealing, insulation), false, `${form} ${sealing} ${insulation}: no collars`)
}
```

- [ ] **Step 2: Run it to see it fail.**

- [ ] **Step 3: Implement the rules**, then the drawing:
  - **`AtticDucts`:**
    - Builds its runs from `ductRunPoints`: `low-slope` on a flat roof, otherwise `hung` when `ductsHang`, else `floor`.
    - Pitched boots stand on the ceiling at the `REGISTER_BOOT` height. This removes the `+0.2`.
    - Hung runs add their straps as one `MergedBoxes`.
    - Wall and portable units keep drawing no ducts, so they have no boots.
  - **`AtticOpenings({ lowSlope, ducted, collars })`**, in `HouseRoof`'s `attic` group under `thermalTag('attic')`:
    - Cans stand on the ceiling between the joists.
    - Pipes rise from the ceiling to the roof underside, or to `LOW_SLOPE_DECK_Y` on a flat roof.
    - When `collars`, a foam collar goes round the base of every opening from `ceilingOpenings(ducted)`.
    - Each kind is one merged `CylinderGeometry` draw (`mergeGeometries` + `useOwnedGeometry`, as `attic-ducts.tsx` does).
    - Colours: `HOME_PALETTE.lightCan` / `pipe` / `foam`.
  - **`VentPipeStubs({ lowSlope })`**, outside the `attic` group, so it shows in every view:
    - Each pipe stands `stubAbove` over the covering at its `[x, z]`, with a flashing collar on the covering.
    - The stub's base is `coveringBaseY(z, form) + coveringStandoff(covering)` (`home-heat-lanes.ts:38`), so it meets tile and shingle alike. On a flat roof `coveringBaseY` gives the roof top.
  - **`HouseRoof`** gains `ducted: boolean`. It passes `collars={foamCollarsShown(form, air-sealing material, attic-insulation material)}`.
  - **`home-kit.tsx`** works out `ducted` once from `targets` (above) and passes it to `HouseRoof` and `HomeEquipment`.

- [ ] **Step 4: Check by eye** (`t5-*.png`): pitched and flat, Partly open.
  - A can in each room, and two pipes out through the roof with flashing.
  - Boots on the ceiling.
  - Old ducts on the joists; R-6 and R-8 hung on straps (Today with a post-2014 home, and the build with the Ducts pick).
  - Collars with Air sealing and insulation `none`; none with R-11.
  - A wall-unit home has no boots.
  - A package-unit home with R-6 ducts: the hung runs meet the trunk without a visible step.
  - Nothing new shows in a settled Complete house except the stubs.

- [ ] **Step 5: Run** `tsc`, `eslint` and the three verify scripts, then **commit** `feat(trade-scenes): the attic gets recessed lights, vent pipes out through the roof, boots on the ceiling, ducts on the joists or hung from the rafters, and foam collars where it is sealed and bare`

---

### Task 6: Thermal: the fan's lane and the ceiling's leaks

**Files:**
- Modify: `F/constants/home-heat-lanes.ts`, `F/lib/home-heat-lanes.ts`, `F/ui/components/home-kit/home-kit.tsx`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `GABLE_VENT` (Task 4), `ceilingOpenings` and `CeilingOpening` (Task 5), `HomeHeat.atticFanRunning` (Task 3).
- Produces:
  - **`homeHeatLanes(form, heat, season, homeView, covering, leaks: readonly CeilingOpening[]): ArrowLane[]`**. `leaks` is the openings that leak: `home-kit.tsx` passes `airSealed ? [] : ceilingOpenings(ducted)`. No new type. If the TS3b.4a fixes changed the signature, append `leaks` as its last argument.
  - **Every existing call passes `[]`**: the two in `home-kit.tsx` before they are wired, and the 11 in `verify-trade-scene.ts` (`:835, 855, 862, 870, 888, 913, 955, 969, 971, 974, 1106` today; re-find them after the fixes). The arrow-count and kit-agreement assertions at `:913` and `:1106` then hold unchanged.
  - **`ATTIC_FAN_LANE: { vent: Vec3, outside: Vec3 }`**, at the left vent's height: from 0.5 m inside the gable to 1.2 m outside it, z 0.
  - **`CEILING_LEAK_LANE = { above: 0.35, below: 0.5, flow: 0.3 }`**, a working flow: two arrows a lane.

- [ ] **Step 1: Write the failing checks.** Make a running and an idle `HomeHeat` from `heatOf` (Task 3).
  - **The fan's lane:**
    - Running: both views have exactly one lane with `points[0]` equal to `ATTIC_FAN_LANE.vent` and its last point equal to `outside`, even when the season passed is `'winter'`.
    - Idle: no such lane.
    - Its flow is `heatLaneFlows(heat).roof[1]`.
  - **Leak lanes** are vertical lanes at an opening's `[x, z]`:
    - Pitched, Partly open: exactly one per opening passed, for `ceilingOpenings(true)` and `ceilingOpenings(false)` (`leaks without ducts`).
    - Summer and normal run downward (first y > last y); winter runs upward.
    - None for `[]`, none in Complete, none on `low-slope` even when openings are passed.
  - **Today's lanes are untouched:** with no fan installed and `leaks: []`, the result equals today's lanes. Capture today's output on the head after the TS3b.4a fixes, before editing, and pin it.

- [ ] **Step 2: Run it to see it fail.**

- [ ] **Step 3: Implement.**
  - **Fan lane:** when `heat.atticFanRunning`, push `heatArrowLane([ATTIC_FAN_LANE.vent, ATTIC_FAN_LANE.outside], flows.roof[1])` in both branches, **not** through `run()`, which reverses lanes in the winter season. The fan only ever blows out.
  - **Leak lanes:** in the Partly open branch only, on a pitched roof, `run([x, WALL_TOP_Y + above, z], [x, WALL_TOP_Y - below, z], CEILING_LEAK_LANE.flow)` for each opening in `leaks`.
  - **`home-kit.tsx`:** `const airSealed = partState(parts, 'air-sealing').material !== null`. The name keeps it apart from the existing `sealed` at `home-kit.tsx:88`. Memoise `leaks` on `[airSealed, ducted]`, pass it to both calls, and add it to their memo deps.

- [ ] **Step 4: Check by eye** (`t6-*.png`), Thermal:
  - Summer with the fan: a lane out the left vent in both views.
  - Without air sealing: short arrows at every opening, down in summer and normal, up in winter.
  - With sealing: none. Flat roof: none. Rain: no arrows.

- [ ] **Step 5: Run** `tsc`, `eslint` and the three verify scripts, then **commit** `feat(trade-scenes): under the thermal camera a running attic fan blows the attic's heat out its gable, and an unsealed ceiling leaks at every opening`

---

### Task 7: Up close: the gable end and the fan — DROPPED (owner ruling 2026-10-30, TS3b.4b, R119/R120)

**Replaced by:** nothing goes into the kit, which retires in TS3b.4b. Task 8's by-eye pass checks only that up close still works with the fan's "No attic fan" row in its list (no crash, pins still match their rows; `KIT_PEEL` falls back to `AT_REST`). If it breaks, the smallest fix that keeps it working goes in Task 8. The text below is kept for the record only; do not build it.

**Files:**
- Create: `F/ui/components/assembly-kits/roof-attic/kit-gable-end.tsx`, `attic-fan-part.tsx`, `F/ui/lib/gable-geometry.ts`
- Modify: `F/constants/roof-attic-kit.ts`, `F/constants/roof-attic-flows.ts` (`KIT_FLOW` and `KIT_PART_PAINT_FACES`, `:101`), `F/lib/roof-attic-kit-points.ts`, `F/lib/kit-heat-lanes.ts`, `F/types.ts`, `F/ui/components/home-kit/gable-roof.tsx` (reads the lifted geometry), `F/ui/components/assembly-kits/roof-attic/kit-walls.tsx`, `roof-attic-kit.tsx`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `AtticFan` (Task 4), `gableVentBoxes` and `GableVentLook` (Task 4), `HomeHeat.atticFanRunning`, and the house's paint look (TS3b.4a fixes).
- Produces:
  - **`gableGeometry(shape: { halfSpan: number, baseY: number, eaveY: number, ridgeY: number, thickness: number }): ExtrudeGeometry`** in `F/ui/lib/gable-geometry.ts`: `gable-roof.tsx:40-51`'s private `gableGeometry()`, lifted out with its numbers as parameters. `GableRoof` passes today's values and draws the same gable.
  - **In `roof-attic-kit.ts`:**
    - `KIT_GABLE_END = { thickness: 0.06, vent: { width: 0.5, height: 0.32, rise: <tuned by eye>, frame: 0.035, slats: 4, slat: 0.025, proud: 0.012 } }`. Its `vent` satisfies `GableVentLook`. It sits at the slice's far end, `z = PITCHED_KIT.depth / 2`. Its base is the wall line at the ceiling's top, and its apex and slopes come from `frontSlopePoint` and `PITCHED_RIDGE_TOP` (`roof-attic-kit-points.ts:34,47`), so it meets the kit's own rafters.
    - `KIT_ATTIC_FAN = { position: Vec3, rotationY: number, scale: number }`, on the gable end's inside face, behind its vent.
    - `KIT_PEEL.pitched['attic-fan'] = [0, 0, 0]`.
  - `KIT_PART_PAINT_FACES['attic-fan'] = { inner: 'attic', outer: 'attic' }`, in `roof-attic-flows.ts`.
  - `KIT_FLOW.atticFan = { inside: Vec3, outside: Vec3 }`: from in front of the fan, out 0.6 m past the gable end.
  - **`interface AtticFanState { running: boolean, burst: SceneBurst }`**, private to `roof-attic-kit.tsx`. `drawPart(id, props, fan)` passes it to `AtticFanPart(fan)`, which places `AtticFan` at `KIT_ATTIC_FAN`. `RoofAtticKit` builds it from `heat?.atticFanRunning ?? false` and `burst`.
  - **`roofAtticPinPoint`:** for `'attic-fan'`, returns a point just above the fan at `KIT_ATTIC_FAN.position`, not at `KIT_PIN_Z`.

- [ ] **Step 1: Write the failing checks:**
  - **Every roof-attic row has a pitched peel and a pin:** for every `HOME_SYSTEMS` row on `roof-attic`, `KIT_PEEL.pitched[row.part]` is defined, and `roofAtticPinPoint('pitched', { id: row.part, material: <its first material> })` is not null.
  - **Paint faces:** `KIT_PART_PAINT_FACES['attic-fan']` deep-equals `{ inner: 'attic', outer: 'attic' }`.
  - **The fan's kit lane:**
    - `kitHeatLanes('pitched', parts, running heat, 'summer', 0.5)` contains one lane from `KIT_FLOW.atticFan.inside` to `outside`, at every peel.
    - Idle heat: none.
    - `'low-slope'`: none.

- [ ] **Step 2: Run it to see it fail.**

- [ ] **Step 3: Implement.**
  - **`KitWalls`:** draws `KitGableEnd` on the pitched form only. Its triangle is `gableGeometry(…)` via `useOwnedGeometry`, painted in the house's paint look as the fixes paint the home's gables, never a hard-coded `HOME_PALETTE.stucco`. Its vent is `gableVentBoxes(KIT_GABLE_END.vent, centre, { axis: 'z', sign: 1 })`, each box drawn as a `Slab` (`@/shared/components/scene/ui/slab`), as `kit-walls.tsx` draws its pieces. Never `MergedBoxes` from `home-kit/`.
  - **`kitHeatLanes`:** when the form is pitched and `heat.atticFanRunning`, push `heatArrowLane([inside, outside], heatLaneFlows(heat).roof[1])`.

- [ ] **Step 4: Check by eye** (`t7-*.png`):
  - Up close on the roof of a pitched home, peel 0 and full: the gable end with its vent at the far end, and the fan on it, unmoved by the peel.
  - Summer with the fan: it spins in a burst, its light is lit, and under Thermal its lane leaves through the gable end. Its pin sits on the fan.
  - Flat roof: no gable end, no fan.
  - The gable end wears the same paint as the house's walls, and so does the whole home's gable (`gable-roof.tsx` unchanged to the eye after the geometry lift).
  - The part list up close now has a "No attic fan" row on every pitched home, and the pins number in list order (`part-pins.tsx:42`). Shoot both and check the numbers match their rows.

- [ ] **Step 5: Run** `tsc`, `eslint` and the three verify scripts, then **commit** `feat(trade-scenes): up close the roof slice ends in a gable with its vent, and the attic fan sits on it`

---

### Task 8: Frame cost, the full look, and the tracker

**Files:**
- Modify: `docs/plans/2026-10-16-trade-scenes-epic.md`
- Shots and ledger: `.superpowers/sdd/2026-10-30-attic-ventilated-and-sealed/`

- [ ] **Step 1: Frame cost.**
  - Run Task 1's probe, unchanged, on the final head: the default home and the worst case (Attic fan, Air sealing, insulation `none`, R-8 Ducts pick, inland summer, Thermal, Partly open).
  - **The gate:** each new piece kind adds at most one draw call (each kind is one merged draw), and draw calls and triangles rise by no more than 10% over the baseline in each scene. Write before and after to `ledger.md`, with the probe's ms beside them for information only.
  - If either is over, merge the next most numerous new draws (the collars, then the cans) before going on.
  - The owner checks the iPad by eye at review; note that it is still owed.

- [ ] **Step 2: The spec's by-eye list (§Done looks like).**
  - Run through every line on the iPad viewport (1180×820 and 820×1180): both home views and up close; summer, normal, winter and rain.
  - Cover pitched and flat, sealed and unsealed, no insulation and R-38, ducts original / R-6 / R-8, and a wall-unit home.
  - Save `t8-*.png` and list each line with its shot in the ledger.

- [ ] **Step 3: Tracker.**
  - §2 Attic row: built, with the commit range.
  - R105–R111: status "built (Attic)".
  - T8: `[x]`.
  - Change log: what was built, the draw-call and triangle figures, and the unset-roof correction (the three attic rows stay offered on an unset roof, as TS3b.4a pins).
  - If `git diff HEAD -- docs/plans/2026-10-16-trade-scenes-epic.md` shows any hunk that is not this task's, do not edit or stage it. Write the tracker text into `ledger.md` and report DONE_WITH_CONCERNS, so the controller applies it.

- [ ] **Step 4: Commit** `docs(trade-scenes): the attic work is built; frame cost and the by-eye checks recorded`
