# TS3b.4b round 2: the owner's first look, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold the owner's first look at TS3b.4b into the branch before it merges:
- the attic and heating & cooling open the house (R247);
- Walls gets its pin and its Look inside (R248);
- the old deck shows its rot, and a roof-off build its repair (R249);
- each Look inside shows its own system's heat flow (R250);
- the window's parts list, screen and darker glass (R251);
- the attic loses its peel (R252).

| Part | Requirements | Tasks |
|---|---|---|
| The house opens for the attic and heating & cooling | R247 | 1 |
| The attic has no peel, and its own heat flow | R252, R250 | 2–3 |
| The deck's rot and its repair | R249 | 4 |
| The window's parts and darker glass | R251 | 5 |
| Walls: pin, stepped cutaway | R248 | 6–7 |
| Heat through the window and the wall | R250 | 8 |
| By-eye pass and hand-over | all | 9 |

**Architecture:**
- **Derived, never written.** "The house is open" is one pure function of `homeView` and `cameraFocus`, and every reader that today asks `homeView === 'partly-open'` asks it instead. The rep's pick is never overwritten, so leaving a system puts it back with nothing remembered.
- **Peeled systems are exactly the keys of `STEP_DEPTHS`.** The attic leaves that table. A slider and the pins' wait ask `peels(system)`; stepping on the house stays the roof's alone (`stepStarts` guards `system === 'roof'`). `isCutawaySystem` (roof + attic) keeps meaning "its flows cross the house", and its comment says so.
- **Walls steps open like the window did.** It is a patch of new box pieces on the wall the Walls camera frames, each tagged `systemPartTag(<part>)` and cut back with `stepCutBack`. The patch is a `WallOpening` (`LOOK_INSIDE_WALL = { wall, opening }`, the shape of `LOOK_INSIDE_WINDOW`), so the wall skin and every paint-mark generator leave it out, as they do a window.
- **Every new heat lane is counted from `heatLaneFlows(heat)`,** the one table the whole home's lanes use: the attic from the roof's flows (the foil meets `pastCovering`, as the roof's own lane does), the window and the wall from their own flows and bounce. So no figure moves, and up close always agrees with the whole home. The attic is a branch of `cutawayHeatLanes`, not a copy of it; the window and the wall reuse the whole home's face legs.
- **The deck's wood replacement is construction data.** A roof-off scope names the deck as a part whose wood it replaces (`ScopeInstall.replacesWood`), and the resolver marks a kept deck `woodReplaced` with the material's own `woodReplacementCopy`. The scene draws the patches from that flag with the rain's own rot patch. No condition, R-value or saving changes. (Owner 2026-11-05: "Wood replacement", the roof SOW's own words; never `repairs`, which is yearly upkeep.)

**Tech Stack:** Next.js 15, React 19.2, `@react-three/fiber` 9.8.2, three 0.180, the zustand scene store, Tailwind v4, shadcn `Button`. Checks are the repo's `tsx` verify scripts (`node:assert/strict`) and local Playwright screenshots.

**Spec:** `docs/superpowers/specs/2026-10-30-up-close-on-a-system-design.md` §11 (round 2, approved 2026-11-05), read beside §1–§10, which are built. Tracker rows R247–R252 in `docs/plans/2026-10-16-trade-scenes-epic.md`.

## Global Constraints

- **Binding rules, stated here** (they bind every task):
  - commit by explicit path only, once the task's verify step passes (owner yes to per-task commits, 2026-11-05); `git diff --cached --name-only` before, `git show --stat HEAD` after; `git commit` with a 300000 ms timeout, never `--no-verify`;
  - never `git add -A`/`.`, stash, reset, `checkout --`, restore, amend, merge, rebase or push;
  - after a scripted edit, `git diff --shortstat` (no target file is CRLF today);
  - no DB writes of any kind; `pnpm tsc` and eslint only, never `pnpm build`;
  - never start, stop or restart the dev server.
- **Also binding, from** `.superpowers/sdd/2026-11-03-trade-scene-benefits/standing-rules.md`: its sections on a file holding another session's hunks, tokens (`theme-conventions.md` and its §12 self-check), Playwright sign-in and the claim files. **Void here:** its Benefits spec as authority, `BENEFITS_COPY`, its 1280/390 shot sizes, its Task 1 create-skip, and its per-task commit yes (replaced above). This build's records (ledger, briefs, shots) go in `.superpowers/sdd/2026-11-05-up-close-round-2/`. No off-limits path is opened, except `CORE/` (the construction core) for Task 4.
- **Baselines, before Task 1 (the controller):** with the tree at `d93a6efc3`'s code (nothing of round 2 built yet), record in the ledger `sceneSavings` for a tear-off and for a window replacement, and the frame cost (draw calls, triangles) of the whole home and the roof's Look inside at peel 1. Every "unchanged against `d93a6efc3`" check compares to these; no builder checks out an old commit.

  The rules this plan leans on most:
  - `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock` for `pnpm tsc` and eslint;
  - logic checks: `pnpm tsx scripts/verify-trade-scene.ts`, plus `scripts/verify-construction-model.ts` and `scripts/verify-scope-installs.ts` for Task 4;
  - no defensive code;
  - copy functions take at most 3 arguments;
  - every control is the shadcn `Button`;
  - the page is `/dashboard/trade-scene`, and screenshots wait for `data-load-phase="live"`;
  - Playwright signs in through `/api/dev/playwright-session` with `as=` only;
  - the commit rule for files holding other sessions' hunks;
  - the claim files in `.superpowers/claims/`.

  `F/` = `src/features/trade-scenes/`, `CORE/` = `src/shared/modules/construction/core/`.
- **Never start, stop or restart the dev server** on :3002, and never `rm -rf .next`. If it doesn't answer (`ss -ltnp`), stop and ask the owner.
- **Base:** builds on `feat/trade-scenes-foundation` at `d93a6efc3` or later. Benefits' build is done, but other sessions may still leave hunks in the tree: never stage, revert or reformat them. Layout L1+L2 (`feat/scene-layout-lab`) stays unmerged (owner); it will meet this round in the end block of `F/types.ts`, `home-kit.tsx` and the verify script when it merges, so keep new types in one run at the end of that block.
- **Docs:** builders never stage `docs/**` or `CONTEXT.md`. Tracker and spec edits are the controller's, committed only when the owner asks.
- **No DB writes** of any kind.
- **Kept from §1–§10:**
  - a pick never flips the scene; only the Today ⇄ Build toggle does;
  - a tap away exits Systems;
  - Escape steps back one layer at a time;
  - the blueprint load's `live` gate holds pins and shortcuts;
  - no DOM id or three.js `userData` key carries the word "system" (R230);
  - the userData key is `scenePart`.
- **Savings never move.**
  - No part's `group` is retagged, and no construction part is added or split.
  - The screen and the wall's pieces are system parts drawn on existing construction parts.
  - `woodReplaced` changes copy and drawing only.
- **Copy:**
  - Screen copy lives in `F/constants/home-scene-copy.ts`, and part and material copy in the assembly files.
  - Never "your", never solar.
  - The exact strings are in each task and are used verbatim.
- **Vocabulary:**
  - System part, Look inside, existing/proposed;
  - never "layer", "zoom" or "today" in code, test messages included.
  - Wood replacement (owner 2026-11-05): `replacesWood`, `woodReplaced`, `woodReplacementCopy`; never `repair*`, which is yearly upkeep (`HomeMaterialDefinition.repairs`, `REPAIRS_PER_YEAR`).
  - New shared types go in the end block of `F/types.ts`.
- **Test fixtures:** build scenes with the verify script's own `at({ property: profile({...}), view, proposedScopeIds })` (`:455`, as at `:3513`), `withMaterials` (`:618`) and `heatOf` (`:623`); `stepOrder` is already imported (`:124`). Names like `newWindowParts` or `stuccoHome` below are local consts built from those, never new shared helpers.
- **Working numbers:** every hand-tuned figure (patch size, piece thicknesses, colours, opacities, step depth, patch spots) is marked as a working number in one comment on its constant, and settled by screenshot.
- **Screenshots, kept tight** (the owner asked):
  - Tasks 1–8: 1194×834 in dark and light, plus 390×844 dark, only for the cases each task names.
  - Task 9: the four sizes.
  - Read every PNG you take, and don't take more than the list.

## Review Focus

1. **Leaving restores the rep's view, whichever way they leave.**
   - Ways out: a tap away, Escape, a rail chip to the roof, and the Systems button.
   - Each one puts back the view the rep had: Complete stays Complete, Partly open stays Partly open.
   - Attic → Heating & cooling keeps the house open with no frame closed between them.

   Test: `houseOpen` cases (Task 1) and a Playwright walk (Task 1 Step 6).
2. **A window tap shows only Windows; a wall tap only Walls.** The glass and frame stop the tap before the wall skin behind them can take it. Test: `systemsAtSpot` cases and the house-shell source check (Task 6), plus a Playwright tap on each (Task 6 Step 6).
3. **The attic's flow sits on what the open house draws.** With the house held open, the front span of the attic floor (z ≥ `HOUSE.atticFrontZ`, `HOME_FADE_TAGS.complete`) is lifted away, so the attic's lanes, leak lanes, readings and Look inside camera target all sit on the kept span (z < `HOUSE.atticFrontZ`). Test: every point of every `cutawayHeatLanes` attic lane, and each attic reading spot, has z < `HOUSE.atticFrontZ` (Task 3); a dark shot confirms nothing floats (Task 3 Step 5).
4. **The wood replacement shows only where the deck stays under a roof-off build.**
   - `woodReplaced`: a kept plywood deck under a tear-off, a torch down or a tile reset, in the proposed view.
   - Never: the existing view, an overlay, a redeck, or spaced boards a tear-off replaces.

   Test: resolver cases (Task 4).
5. **Darker glass is the build's alone, and still glows at night.**
   - An installed double-pane draws `HOME_PALETTE.glassNew`.
   - The home's own glass (single, or retained or worn double-pane, even at wear New) draws `HOME_PALETTE.glass`.
   - The night glow still reads on both.

   Test: `glassLook` cases (Task 5) and a dusk shot (Task 5 Step 5).

---

### Task 1: The attic and heating & cooling open the house (R247; spec §11.1)

**Files:**
- Modify:
  - `F/constants/home-systems.ts`: add `HOUSE_OPENING_SYSTEM_IDS`.
  - `F/ui/components/home-scene-canvas.tsx:79`
  - `F/ui/components/home-kit/home-camera-rig.tsx:49`
  - `F/lib/scene-burst-key.ts:12`
- Not touched (owner 2026-11-05, "stays pressable"): `dock-home-view.tsx`, `use-scene-shortcuts.ts`, `pressHomeView`. The dock's control and the `v` key keep showing and toggling the rep's own pick while a system holds the house open; the pick shows once the rep leaves the system.
- Create: `F/lib/house-open.ts`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - `HOUSE_OPENING_SYSTEM_IDS = ['attic', 'heating-cooling'] as const satisfies readonly HomeSystemId[]`
  - `houseHeldOpen(cameraFocus: HomeSystemId | null): boolean`
  - `houseOpen(state: Pick<TradeSceneInputs, 'homeView' | 'cameraFocus'>): boolean`. It is true when `homeView === 'partly-open'` or `houseHeldOpen(cameraFocus)`.

- [ ] **Step 1: Write the failing checks** in `verify-trade-scene.ts`:

```ts
assert.equal(houseOpen({ homeView: 'complete', cameraFocus: 'attic' }), true, 'the attic in focus opens a Complete house')
assert.equal(houseOpen({ homeView: 'complete', cameraFocus: 'heating-cooling' }), true, 'heating & cooling in focus opens it too')
assert.equal(houseOpen({ homeView: 'complete', cameraFocus: 'roof' }), false, 'the roof keeps the rep\'s Complete')
assert.equal(houseOpen({ homeView: 'complete', cameraFocus: null }), false, 'leaving the system puts Complete back')
assert.equal(houseOpen({ homeView: 'partly-open', cameraFocus: null }), true, 'the rep\'s own Partly open stays')
assert.ok(!/homeView === 'partly-open'/.test(readFileSync('src/features/trade-scenes/ui/components/home-scene-canvas.tsx', 'utf8')) && !/homeView === 'partly-open'/.test(readFileSync('src/features/trade-scenes/ui/components/home-kit/home-camera-rig.tsx', 'utf8')), 'the canvas and the camera ask houseOpen, never the pick alone')
```

- [ ] **Step 2:** Run `pnpm tsx scripts/verify-trade-scene.ts`. Expected: FAIL, because `houseOpen` is not defined.
- [ ] **Step 3: Implement** `houseHeldOpen` and `houseOpen` in `F/lib/house-open.ts`, and repoint both readers.
- [ ] **Step 4: The burst key.** `scene-burst-key.ts` keys on `houseOpen(state)` in place of `state.homeView`, so the open-house motion runs when focus opens it. Add the check: `sceneBurstKey` differs between `{homeView:'complete', cameraFocus:null}` and `{homeView:'complete', cameraFocus:'attic'}`, and is equal for `cameraFocus:'attic'` and `'heating-cooling'` (no frame closes between them). The dock and the `v` key stay as they are (see Files).
- [ ] **Step 5:** Run the verify script, then `pnpm tsc` and eslint under the lock. Expected: PASS, with no errors.
- [ ] **Step 6: Screenshots,** 1194×834 light and dark, plus 390×844 dark:
  - the house on Complete, then the Attic chip;
  - then the Heating & cooling chip;
  - then a tap away.

  Expected: open, open, Complete. Also start on Partly open, focus the attic, tap away: still Partly open. And on Complete with the attic in focus, press the dock's control: the house stays open, and on tapping away it is Partly open.
- [ ] **Step 7: Commit:** `feat(trade-scenes): the attic and heating & cooling open the house while in focus`.

### Task 2: The attic has no peel (R252; spec §11.6)

**Files:**
- Modify:
  - `F/constants/look-inside.ts:18-23`: `STEP_DEPTHS` loses `attic`. Its `satisfies Record<(typeof LOOK_INSIDE_SYSTEM_IDS)[number], number>` becomes `satisfies Record<Exclude<(typeof LOOK_INSIDE_SYSTEM_IDS)[number], 'attic'>, number>`, so a Look inside system other than the attic can never go without a depth. Never put the attic back to satisfy tsc.
  - `F/lib/step-cut-back.ts`: `stepStarts` keeps `system: HomeSystemId` and returns an empty map unless `system === 'roof'`; `stepCentre(system: 'roof', …)` narrows to the roof. Rewrite the comment above `stepStarts` ("Only the roof and the attic step…").
  - `F/lib/cutaway-rain-path.ts:83`: call `stepCentre` only when `steps.system === 'roof'` (the attic has no start, so `start === undefined` already sends it to `edge`).
  - `F/lib/system-part-focus.ts:103,143-156`: `:103`'s inline `keyof typeof STEP_DEPTHS` becomes `PeeledSystemId`.
  - `F/ui/components/controls/look-inside-body.tsx`
  - `F/ui/components/panel/part-pins.tsx:27-29`: a new `system: HomeSystemId` prop, passed from `F/ui/components/home-scene-canvas.tsx:144`.
  - The comments that name the attic as stepping: `F/lib/is-cutaway-system.ts:3` (it now means "its flows cross the house"), `F/types.ts:735`, and the assertion message at `verify-trade-scene.ts:3660`.
  - every other reader of `STEP_DEPTHS.attic` or `'attic'` steps that `pnpm tsc` turns up.
- Create: `F/lib/peels.ts`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - `type PeeledSystemId = keyof typeof STEP_DEPTHS`, in the end block of `F/types.ts`.
  - `peels(system: HomeSystemId): system is PeeledSystemId`
  - `stepStarts(system, shown, peel)` returns an empty map for any system but the roof, the only one that steps on the house now.

- [ ] **Step 1: Write the failing checks:**

```ts
assert.equal(peels('attic'), false, 'the attic has no peel')
assert.ok(peels('roof') && peels('windows') && peels('heating-cooling'), 'the stepped systems keep theirs')
assert.equal(stepStarts('attic', new Set(['attic-insulation', 'air-sealing', 'ceiling']), 1).size, 0, 'a peel left over from the roof never steps the attic')
assert.ok(!/STEP_DEPTHS\.attic|'attic':\s*1\.2/.test(readFileSync('src/features/trade-scenes/constants/look-inside.ts', 'utf8')), 'the attic\'s 1.2 m step is gone')
```

- [ ] **Step 2:** Run the verify script. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `LookInsideBody` renders `PeelControl` only when `peels(system)`.
  - `PartPins` shows its pins when `!peels(system) || peel > LOOK_INSIDE.pinsFromPeel`, from its new `system` prop.
  - `systemPartFocus` points every attic part at its resting point.
  - Rewrite the comment on `STEP_DEPTHS` so it no longer explains the attic's width.
- [ ] **Step 4:** Run the verify script, then tsc and eslint. Expected: PASS. Fix the existing attic step assertions the change breaks (the cutaway crossings and pins at peel 1) to the parts sitting in place. Don't delete them.
- [ ] **Step 5: Screenshots,** pitched, Attic Look inside, 1194×834 light and dark, plus phone dark: no slider, and every pin on its part. Check the air-sealing collars, and the ceiling when air sealing is absent: if the blanket covers them, raise their look (a working number), never the step.
- [ ] **Step 6: Commit:** `feat(trade-scenes): the attic opens its parts where they sit, with no peel`.

### Task 3: The attic's own heat flow (R250; spec §11.4 Attic)

**Files:**
- Modify:
  - `F/lib/cutaway-heat-lanes.ts`: `cutawayHeatLanes` gains a `leaks: readonly CeilingOpening[]` argument and an attic branch (`steps.system === 'attic'`); `cutawayReadingSpots` gives the attic's readings on the kept span. No new lane file: the roof and the attic share the crossings, the barrier legs, the bounce and the fan.
  - `F/lib/cutaway-rain-path.ts` (`cutawayCrossings`): the attic's heat line, see "Where the line runs".
  - `F/constants/look-inside.ts`: the attic line's working numbers.
  - `F/constants/system-camera-views.ts:77`: `LOOK_INSIDE_VIEWS.attic.target` moves onto the kept span (a working number).
  - `F/ui/components/home-kit/cutaway-flows.tsx:53` and `F/ui/components/home-kit/home-kit.tsx:366-379`: pass `leaks` (computed at `home-kit.tsx:251`); the roof passes `[]`.
- Test: `scripts/verify-trade-scene.ts`, inside the existing `heatCase` harness (`:3734`) and its `for system of ['roof','attic']` loop (`:3758`), so the loop tests the path `CutawayFlows` draws.

**Interfaces:**
- Consumes:
  - `cutawayCrossings(form, parts, steps, 'heat')` (`F/lib/cutaway-rain-path.ts:67`);
  - `heatLaneFlows`, `heatArrowLane`, `bounceArrowLane`, `cutawayBarrierBounceEnd`;
  - `ATTIC_FAN_LANE`, `CEILING_LEAK_LANE`;
  - Task 2's `stepStarts`, empty for the attic.
- Produces: `cutawayHeatLanes(form: RoofForm, parts: readonly ResolvedPart[], heat: HomeHeat, season: Season, steps: CutawaySteps, leaks: readonly CeilingOpening[]): ArrowLane[]`.

**Where the line runs.** The house the attic holds open lifts away everything tagged `HOME_FADE_TAGS.complete`, including the attic floor's front span (z ≥ `HOUSE.atticFrontZ`, `ATTIC_SPANS.complete`, `attic-floor.tsx:63`). Today's line drops plumb at about z 1.4–1.7 (`cutaway-rain-path.ts:99-103`), on that span. The attic's line, its leak lanes, its readings and its camera target therefore sit on what the open house keeps: they cross the attic floor's kept span (z < `HOUSE.atticFrontZ`), and the line starts under a deck the open house still draws. Where exactly is a working number set by a dark shot; the roof's line does not move.

**The legs, summer** (each figure from `heatLaneFlows(heat)`, never from `heat.flows`):
1. From the deck's underside down to the barrier's `outer` when there is a barrier, carrying `flows.pastCovering`, as the roof's own lane into the barrier does (`cutaway-heat-lanes.ts:63-66`).
2. A bounce lane at the barrier, `[barrier.inner, cutawayBarrierBounceEnd(barrier)]`, carrying `flows.barrierBounce`.
3. From the barrier's `inner` (or the deck's, with no barrier) to the insulation's `outer`, carrying `flows.roof[1]`.
4. On through the insulation and the ceiling into the room (`ceiling.inner` less `CUTAWAY_FLOW.room`), carrying `flows.roof[2]`.

**Also:**
- A running fan adds the `ATTIC_FAN_LANE` lane out of the gable vent, as today.
- Each opening in `leaks` adds a lane down through it at `CEILING_LEAK_LANE.flow`, as `homeHeatLanes` draws them (`F/lib/home-heat-lanes.ts:86-90`).
- Winter reverses every leg except the fan, nothing bounces, and the figures follow the roof's winter ordering (the `fromSource` list and the reverse, `cutaway-heat-lanes.ts:63-68`), never the summer leg order.
- The attic draws no lane above the deck: no sky leg, no covering bounce.

- [ ] **Step 1: Write the failing checks,** in the `:3758` loop's attic case, pitched, Summer, with `quiet = { ...heat, atticFanRunning: false }` so the fan adds no lane, and the barrier climate the existing barrier cases use (`heatOf(...)`), so `flows.barrierBounce` clears a whole arrow:

```ts
const attic = cutawayHeatLanes('pitched', parts, quiet, 'summer', steps, [])
const flows = heatLaneFlows(quiet)
assert.ok(attic.every(lane => lane.points.every(([, y]) => y <= at.deckUnderside[1] + 1e-6)), 'the attic\'s lanes start under the deck, never through the covering')
assert.ok(attic.every(lane => lane.points.every(([, y, z]) => y >= at.deckUnderside[1] - 1e-6 || z < HOUSE.atticFrontZ)), 'below the deck, the attic\'s lanes sit on the span the open house keeps')
const bounce = attic.find(lane => same(lane.points[0], at.barrier) && same(lane.points.at(-1), at.barrierTo))
assert.ok(bounce, 'in summer the foil turns some back')
const intoFoil = attic.find(lane => ends(lane, at.barrierOuter!))
near(intoFoil!.flow, Math.min(flows.pastCovering, 1), 1e-9, 'the heat reaching the foil is what the roof says got past the covering')
assert.ok(!cutawayHeatLanes('pitched', withMaterials(parts, { 'radiant-barrier': null }), quiet, 'summer', steps, []).some(lane => same(lane.points[0], at.barrier)), 'no barrier, nothing turns back')
assert.equal(cutawayHeatLanes('pitched', parts, quiet, 'winter', steps, []).length, attic.length - 1, 'winter runs the same legs out, with no bounce')
assert.equal(cutawayHeatLanes('pitched', parts, quiet, 'summer', steps, ceilingOpenings(true)).length - attic.length, ceilingOpenings(true).length, 'each unsealed opening leaks a lane')
for (const spot of Object.values(cutawayReadingSpots('pitched', parts, steps))) assert.ok(spot[2] < HOUSE.atticFrontZ, 'the attic\'s readings sit on the kept span')
```

`same`, `ends`, `near` and `at` are the harness's own (`:3734-3760`); compare `flow` with whatever clamp `heatArrowLane` applies, read from its code. `at` is rebuilt for the attic's line from its own crossings.
- [ ] **Step 2:** Run the verify script. Expected: FAIL.
- [ ] **Step 3: Implement** the attic branch, the `leaks` argument at both callers, the line, the readings and the camera target.
- [ ] **Step 4:** Run the verify script, tsc and eslint. Expected: PASS. The roof's `cutawayHeatLanes` checks pass unchanged.
- [ ] **Step 5: Screenshots,** Attic Look inside, Summer and Winter, Thermal off and on, with and without a radiant barrier and air sealing in the build. 1194×834 dark is enough here, plus one light. Check that no lane, leak or reading floats where the front span was.
- [ ] **Step 6: Commit:** `feat(trade-scenes): the attic shows its own heat flow up close`.

### Task 4: The old deck's rot and its wood replacement (R249; spec §11.3, §11.7)

**Files:**
- Modify:
  - `CORE/types.ts`: `PartMaterialFields.woodReplacementCopy?: PartCopy`, `ScopeInstall.replacesWood?: readonly string[]`, `ResolvedPart.woodReplaced?: true` (the shape of `edge?: true`). Never `repair*`: `HomeMaterialDefinition.repairs` and `repairsEndWith` (`CORE/types.ts:220-223`) are yearly upkeep.
  - `CORE/lib/resolve-assembly.ts`: the rule below, applied after `installBases` (`:84`), through the same per-part copy map, so a spaced-board deck the tear-off replaces with solid decking is installed, never `woodReplaced`.
  - `CORE/constants/scope-installs.ts`: `replacesWood: ['deck']` on `roofTearOff`, `roofTorchDown` and `roofTileReset`, the `ROOF_OFF_SCOPE_IDS` (`scopes-by-existing-roof.ts:15`).
  - `CORE/constants/assemblies/roof-attic.ts:45,47-53`: the deck's copy and the radiant barrier's copy.
  - `F/constants/look-inside.ts`: `CUTAWAY_ROT` gains `deck: { spots, size, share: 0.15 }`.
  - `F/constants/home-palette.ts`: `woodReplaced` (fresh plywood, lighter than `plywood`) only. The rot's colour is the rain's own `CUTAWAY_FLOW_COLORS.rot` (`:80`); no second rot brown.
  - `F/types.ts`: `CutawayRotSpot` (`:763`) gains `woodReplaced?: true`.
  - `F/ui/components/home-kit/cutaway-rot-patch.tsx`: `CutawayRotPatch` takes the replaced wood's colour when `spot.woodReplaced`.
  - `F/ui/components/home-kit/cutaway-flows.tsx`: mount the deck's spots on the roof.
- Create: `F/lib/deck-rot-spots.ts`
- Test: `scripts/verify-construction-model.ts`, `scripts/verify-trade-scene.ts`. (`verify-scope-installs.ts` reads Notion through `catalogSource`; it gets no pure check.)

**Interfaces:**
- Produces:
  - **The resolver's rule.** In the proposed view, a part named by a proposed scope's `replacesWood` that the build doesn't install, and whose material has `woodReplacementCopy`, resolves `woodReplaced: true`, with `label` and `detail` from `woodReplacementCopy`. Its condition, wear, thermal and water stay as they were.
  - `deckRotSpots(form: RoofForm, parts: readonly ResolvedPart[], steps: CutawaySteps): CutawayRotSpot[]`. It returns the spots on the deck's step strip, placed the way `cutawayRotSpots` places the rain's (`cutaway-rain-path.ts:203-224`: tilt, aside and lift). They are the same spots in the existing and proposed views, `woodReplaced` follows the deck, and an installed deck gets none. The rain's own rot keeps drawing as today; check the two together in a Rain shot.
  - `CUTAWAY_ROT.deck = { spots: readonly (readonly [number, number])[], size: readonly [number, number], share: 0.15 }`. The spots are fractions along and across the strip; spots and size are working numbers. The total spot area never exceeds `share` of the strip at peel 1.

**Copy, verbatim** (`roof-attic.ts`):
- **Plywood `copy`:** `{ label: 'Solid decking', detail: 'An old deck often has some areas that need to be replaced due to wood rot or water damage over time.' }`
- **Plywood `conditionCopy.worn`:** `{ label: 'Original decking', detail: 'An old deck often has some areas that need to be replaced due to wood rot or water damage over time.' }`. It replaces "Decades of heat and leaks…". The `installed` copy stays.
- **Plywood `woodReplacementCopy`:** `{ label: 'Original decking, repaired', detail: 'An old deck often has some areas that need to be replaced due to wood rot or water damage over time. Once the old roof is off, we repair those sections up to the allowable limit.' }` (customer-facing copy keeps the owner's word "repair"; only code names avoid it).
- **Foil `copy.detail`:** `'Foil stapled to the rafters from inside the attic. It turns back most of the heat the roof radiates.'`
- **Spaced boards** keep their own copy. A tear-off replaces them with solid decking, so they are never `woodReplaced`.

- [ ] **Step 1: Write the failing checks.**
  - **In `verify-construction-model.ts`**, on a shingle home with a worn plywood deck:
    - proposed with `roofTearOff`: deck `woodReplaced === true`, condition `'worn'`, R-value unchanged, label `'Original decking, repaired'`;
    - the same with `roofTileReset` on a tile home, and `roofTorchDown` on a flat home;
    - proposed with `roofOverlay`, existing view with `roofTearOff`, proposed with `roofTearOff` + `roofRedeck`, and spaced boards with `roofTearOff`: deck `woodReplaced` undefined;
    - the scopes whose install carries `replacesWood` are exactly `ROOF_OFF_SCOPE_IDS` (one list, checked).
  - **In `verify-trade-scene.ts`:**
    - `deckRotSpots` at peel 1 is non-empty in both views;
    - `woodReplaced` is unset existing and true under a tear-off;
    - empty with a redeck;
    - the total area is ≤ `CUTAWAY_ROT.deck.share` × the deck strip's area;
    - no spot with peel 0;
    - `sceneSavings` for a tear-off equals the ledger's baseline.
  - **The copy walk** (`:1621-1632`) gains a `takeCopy` line for `woodReplacementCopy`, so the new copy meets the "your"/solar checks; it finds no `'under the deck'` in `roof-attic.ts`.
- [ ] **Step 2:** Run both scripts. Expected: FAIL.
- [ ] **Step 3: Implement** the types, the resolver, the installs, the copy, `deckRotSpots`, and the patch's replaced-wood colour.
  - **The mount:** `CutawayFlows` mounts the deck's spots only while `system === 'roof'`, in every weather, beside the rain's rot spots. The spots take no tap (`ignoreRaycast`).
- [ ] **Step 4:** Run both scripts, `pnpm tsx scripts/verify-bill-cut-claims.ts`, tsc and eslint. Expected: PASS.
- [ ] **Step 5: Screenshots,** Roof Look inside at peel 1, pitched and flat, Today and the build with a tear-off (and with a torch down on flat), plus one Rain shot, 1194×834 light and dark. The deck's row in the card reads the new copy.
- [ ] **Step 6: Commit:** `feat(trade-scenes): the old deck shows its rot, and a roof-off build its wood replaced up to the allowable limit`.

### Task 5: The window's parts and darker glass (R251; spec §11.5)

**Files:**
- Modify:
  - `F/types.ts:705-712`: `SystemPart` gains `listed?: false`, and `SystemPartRow` carries it.
  - `F/constants/system-parts.ts`: the screen piece; export `newDoublePane` (`:5`) so `glassLook` shares the one predicate.
  - `F/lib/system-parts-shown.ts`: `systemPartRows` stays whole (it still returns the glazing row, marked `listed: false`), so `systemLit`'s `shown` (`F/lib/system-lit.ts:8`) keeps glazing lit and the `:3497` check (rows equal `systemPartsShown`) holds.
  - `F/ui/components/controls/look-inside-body.tsx:25` and `F/ui/components/home-scene-canvas.tsx:144`: the card's list and `PartPins` take `listedRows(rows)`; `lit` keeps the whole rows.
  - `F/constants/home-scene-copy.ts`
  - `F/constants/system-part-looks.ts`
  - `F/constants/home-palette.ts`
  - `F/ui/components/home-kit/house-shell.tsx:112`
  - `F/ui/components/home-kit/window-panes.tsx:73`
  - `F/lib/system-part-focus.ts`
- Create:
  - `F/lib/listed-rows.ts`: `listedRows(rows: readonly SystemPartRow[]): SystemPartRow[]`, the rows without `listed: false`.
  - `F/ui/lib/glass-look.ts` (beside `paint-look.ts` and `covering-tone.ts`).
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - **The glazing entry** in `SYSTEM_PARTS` is `listed: false`: still a row, shown and lit, so every window but the framed one stays solid up close, but the card and the pins leave it out.
  - **A new piece** `{ id: 'screen', assembly: 'windows', part: 'glazing', systems: ['windows'], drawnFor: newDoublePane }`, placed first among the glazing pieces so it steps outermost.
    - This is a ruling on spec §11.5's "drawn on the frame": a screen comes with the new window, the installed glazing is what marks the new window, and riding the glazing's step run makes it the outermost step. Nothing moves in the savings either way.
    - Spec §11.5 already says so (amended with this plan).
  - **`SYSTEM_PART_LABELS`:** `'pane'` becomes `'Single-pane glass'` (it was `'Glass'`), as spec §11.5 rules, so `satisfies Record<SystemPieceId, string>` holds and the `:3167` check (every piece has a label) passes. `'screen': 'Screen'` is added.
  - **`SYSTEM_PART_DETAILS`** (new, `Partial<Record<SystemPieceId, string>>`), verbatim:
    - `'low-e': 'The coating that gives the gas-filled glass its darker, more opaque look: harder to see inside, so more privacy.'`
    - `'screen': 'Comes with every new window.'`

    `systemPartRows` gives a piece its detail from here, else `''`.
  - **`HOME_PALETTE.glassNew`:** near-black, with no blue cast, a working number (noun first, as `plywoodWorn`, `paintCool`).
  - **`glassLook(glazing: ResolvedPart | undefined): { color: string, opacity: number, roughness: number }`.** `newDoublePane(glazing)` gives `glassNew` at a higher opacity; anything else (single pane, the home's own double-pane at any wear, New included) gives today's `glass` look with its wear. It also returns the roughness both callers compute today. `house-shell.tsx` and `window-panes.tsx` take their pane look from it; `PANE_LOOKS` keeps only what `glassLook` doesn't give (thickness, the coating's and the gas's tints).
  - **`PANE_LOOKS.screen`:** a fine dark mesh (colour, opacity, thickness), standing off the outer pane outward. `PART_PIECES` gains `'screen'`; update the `:3525` deepEqual with it.

- [ ] **Step 1: Write the failing checks** (scenes from `at(...)`; `glazingOf(scene)` is the scene's resolved glazing part):

```ts
const newRows = systemPartRows('windows', newWindowTargets)
assert.ok(!listedRows(newRows).some(row => row.id === 'glazing'), 'no "Double-pane glass" row: the panes say it')
assert.ok(systemLit('windows', newRows, null).shown.has('glazing'), 'every other window stays lit')
assert.deepEqual(listedRows(newRows).filter(row => ['screen', 'outer-pane', 'low-e', 'argon', 'inner-pane'].includes(row.id)).map(row => row.id), ['screen', 'outer-pane', 'low-e', 'argon', 'inner-pane'], 'the new window lists its screen first, then its glass')
assert.equal(newRows.find(row => row.id === 'low-e')!.detail, SYSTEM_PART_DETAILS['low-e'])
assert.ok(!systemPartRows('windows', oldDoublePaneTargets).some(row => row.id === 'screen'), 'the home\'s own windows have no screen')
assert.equal(systemPartRows('windows', singlePaneTargets).find(row => row.id === 'pane')!.label, 'Single-pane glass')
assert.equal(glassLook(glazingOf(newWindowScene)).color, HOME_PALETTE.glassNew)
assert.equal(glassLook(glazingOf(oldDoublePaneAtNewScene)).color, HOME_PALETTE.glass, 'the home\'s own double-pane at wear New is still the home\'s glass')
assert.equal(glassLook(glazingOf(singlePaneScene)).color, HOME_PALETTE.glass)
```
- [ ] **Step 2:** Run the verify script. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **The screen:** `WindowPanes` draws it as the outermost piece, cut back furthest.
  - **Its pin:** `systemPartFocus` points the screen at its strip, like the panes.
  - **The palette:** remove the `glass` key's comment if it described the new window.
- [ ] **Step 4:** Run the verify script, tsc and eslint. Expected: PASS. `sceneSavings` for a window replacement equals the ledger's baseline.
- [ ] **Step 5: Screenshots,** 1194×834 light and dark, plus phone dark:
  - Windows Look inside at peel 1: single-pane existing, double-pane existing, the build's window;
  - the whole house in the build, at noon and at dusk (Today vs build side by side).

  Expected: the new glass reads nearly black, with no blue; the night glow still reads; the old glass is unchanged.
- [ ] **Step 6: Commit:** `feat(trade-scenes): the new window lists its panes and screen, and draws its Low-E glass dark`.

### Task 6: Walls joins the house pins and Look inside (R248; spec §11.2 The way in)

**Files:**
- Modify:
  - `F/constants/home-systems.ts:20-24`: `walls` joins `LOOK_INSIDE_SYSTEM_IDS`, `'wall'` joins `HOME_SPOT_IDS`, `SPOT_OF.walls = 'wall'`.
  - `F/lib/systems-at-spot.ts`: `case 'wall': return ['walls']`.
  - `F/lib/spot-pin-point.ts`: Walls' pin where its camera view already looks, `READING_ANCHORS[form]['exterior-wall']` (`system-camera-views.ts:54`, `home-anchors.ts:63`), set off the reading's own dot so the two never sit on one point with Thermal on.
  - `F/constants/look-inside.ts`: `STEP_DEPTHS.walls`, a working number, and `LOOK_INSIDE_WALL`.
  - `F/constants/home-scene-copy.ts`: `SYSTEM_PIN_LABELS.walls = \`${HOME_SYSTEM_LABELS.walls} system\``.
  - `F/ui/components/home-kit/house-shell.tsx`: an `onWallTap` prop on every `WallSkin` and its corners; `PaintMarks` and `PaintStains` (`:167-171`, `:193-196`) are tagged `systemPartTag('paint')` with the skin, so the cracks, stains and peeling stay lit with it.
  - `F/ui/components/home-kit/home-kit.tsx`: `onWallTap={spotTap('wall')}`.
  - every `Record` over `LOOK_INSIDE_SYSTEM_IDS` that tsc turns up.
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - `LOOK_INSIDE_WALL = { wall: HOUSE_WALLS.left, opening: WallOpening }`, the shape of `LOOK_INSIDE_WINDOW` (`look-inside.ts:32`). The opening is the patch the Walls view frames: on the left wall, between the framed window (`openings[0]`) and the front corner, centred on the exterior-wall reading's `z` (3.4), clear of the electric meter at z 2.7 (`home-geometry.ts:231`). Working numbers.
  - `canLookInside('walls', ctx)` is true on every home.

- [ ] **Step 1: Write the failing checks:**

```ts
assert.deepEqual(systemsAtSpot('wall', ctx), ['walls'])
assert.deepEqual(systemsAtSpot('window', ctx), ['windows'], 'a window tap still shows only Windows')
assert.ok(canLookInside('walls', ctx))
assert.equal(SYSTEM_PIN_LABELS.walls, 'Walls system')
assert.ok(/onClick=\{onWindowTap\}/.test(houseShellCode) && /onClick=\{onWallTap\}/.test(houseShellCode), 'the glass and frame take their own tap, the wall its own')
// The order (glass before wall) is a hit-test fact, not a source fact: Step 5's tap on a window proves it.
```

- [ ] **Step 2:** Run the verify script. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The window groups already stop the event in `spotTap`, and the glass sits in the skin's holes, so a tap on the glass never reaches the wall.
  - The wall's whole skin is tagged `systemPartTag('paint')` (sunlit, shaded, corners and front), so up close on Walls every wall stays lit while the rest fades.
- [ ] **Step 4:** Run the verify script, tsc and eslint. Expected: PASS.
- [ ] **Step 5: A Playwright walk,** 1194×834 dark:
  1. tap the left wall: the Walls pin shows;
  2. tap the pin: Walls is in focus;
  3. tap Look inside: the house fades, the walls stay;
  4. tap a window: the Windows pin only.
- [ ] **Step 6: Commit:** `feat(trade-scenes): a wall tap shows the Walls system, which can be looked inside`.

### Task 7: The wall opens as a stepped cutaway (R248; spec §11.2 System parts, Steps)

**Files:**
- Create: `F/ui/components/home-kit/wall-steps.tsx`
- Modify:
  - `F/constants/system-part-looks.ts`: `WALL_PART_LOOKS`.
  - `F/constants/system-parts.ts`: the walls entries in outside-in step order: paint, finish, brown coat, scratch coat, lath, weather barrier, sheathing, cavity insulation, studs, drywall.
  - `F/ui/components/home-kit/house-shell.tsx`: while Walls is held, the left wall's `WallSkinSpec.openings` (`wall-skin-geometry.ts:14`) gains `LOOK_INSIDE_WALL.opening`, and so does the `openings` argument of `stuccoCracks`, `wallPeeling` and `splashBand`, so no mark floats over the hole; it mounts `WallSteps`.
  - `F/types.ts` end block: `type WallPartId = Extract<SystemPartId, …>` over the walls entries, as `GlazingPieceId` is built (`system-part-looks.ts:13`).
  - `F/lib/system-part-focus.ts`: walls parts point at their strips.
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: Task 6's `LOOK_INSIDE_WALL` and `STEP_DEPTHS.walls`; `stepCutBack`, `clipBoxes`, `systemPartTag`, `useStepPeel`.
- Produces:
  - **`WALL_PART_LOOKS`:** `Record<WallPartId, { band: WallBand, color?: string }>` with `type WallBand` (the outside-in bands: paint, finish or siding, the coats, lath, barrier, sheathing, cavity, drywall; in the end block of `F/types.ts`) and `WALL_BANDS: Record<'stucco' | 'siding', Record<WallBand, number>>`, the depth of each band per form. The studs and the cavity insulation share one band (`'cavity'`). Each form's bands add up to `HOUSE.wallThickness` (0.16, the paint's `HOUSE.paintThickness` included). The paint takes the house's `paint.color` (no colour of its own); the finish takes the stucco colour, and the siding its own (a working number). Studs are vertical boxes at 0.41 m centres, the cavity insulation fills between them, and an empty cavity (resolved `absent`, so no row) is drawn open. All are working numbers.
  - **`WallSteps({ parts: readonly PartState[], paint: PaintLook, lit: SystemLit })`.** Each shown wall part is a box set across the wall, cut back along the wall's run from the patch's front end, the outer the further. Each sits in `systemPartTag(<id>)`.
  - **Pins:** `systemPartFocus('walls', form, id, peel, shown, [])` is non-null for each shown wall part.
  - **The forms:** siding shows its siding in place of the stucco coats and lath, from `systemPartsShown`, which already filters by form.
  - **Wear:** paint wear (cracks, stains, peeling) on the patch's paint follows the house's `paint.paintWear`, through the same `paintLook` the wall uses.

- [ ] **Step 1: Write the failing checks:**

```ts
for (const form of ['stucco', 'siding'] as const) assert.equal(Object.values(WALL_BANDS[form]).reduce((sum, depth) => sum + depth, 0).toFixed(3), HOUSE.wallThickness.toFixed(3), `a ${form} wall's bands fill its thickness`)
const wallShown = systemLit('walls', systemPartRows('walls', stuccoHome), null).shown
assert.deepEqual(stepOrder(wallShown).slice(0, 2), ['paint', 'finish'], 'the paint steps outermost')
for (const id of wallShown) assert.ok(systemPartFocus('walls', 'pitched', id, 1, wallShown, []) !== null, `${id} has a pin up close`)
assert.ok(systemPartRows('walls', sidingHome).some(row => row.id === 'siding') && !systemPartRows('walls', sidingHome).some(row => ['lath', 'scratch-coat', 'brown-coat', 'finish'].includes(row.id)), 'siding shows its siding in place of the coats')
assert.ok(wallStepBoxes(sidingHome).every(box => box.id !== 'lath'), 'and draws none of them') // WallSteps' pure box list, exported for the check
```

- [ ] **Step 2:** Run the verify script. Expected: FAIL.
- [ ] **Step 3: Implement** `WALL_PART_LOOKS`, `WallSteps`, the skin opening (memo the two skin lists at module level, opened and whole), and the pins.
- [ ] **Step 4:** Run the verify script, tsc and eslint. Expected: PASS.
- [ ] **Step 5: Screenshots,** Walls Look inside at peel 0 and 1, stucco, with the paint at New and at Failing. Then the build with Cool Life paint. 1194×834 light and dark, plus phone dark.
- [ ] **Step 6: Commit:** `feat(trade-scenes): the wall opens into its system parts up close`.

### Task 8: Heat through the window and the wall (R250; spec §11.4 Windows, Walls)

**Files:**
- Create:
  - `F/lib/cutaway-face-heat-lanes.ts`
  - `F/ui/components/home-kit/cutaway-face-flows.tsx`
- Modify:
  - `F/lib/home-heat-lanes.ts` and `F/constants/home-heat-lanes.ts`: the extracted `faceLegs`, and `wallPoint`/`faceBounceTo` exported; the whole home's lane checks pass unchanged.
  - `F/ui/components/home-kit/home-kit.tsx`: mount `CutawayFaceFlows` while the held system is windows or walls, outside the house group, as `CutawayFlows` is.
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes:
  - `heatLaneFlows(heat).window`, `.windowBounce`, `.wall`, `.wallBounce`;
  - `heatArrowLane`, `bounceArrowLane`;
  - Task 5's glazing pieces and `PANE_LOOKS`;
  - Task 7's `WALL_BANDS` and Task 6's `LOOK_INSIDE_WALL`;
  - `useStepPeel`.
- Produces: `cutawayFaceHeatLanes(system: CutawayFaceSystemId, parts: readonly ResolvedPart[], heat: HomeHeat, season: Season, steps: { shown: ReadonlySet<SystemPartId>, peel: number }): ArrowLane[]`, with `type CutawayFaceSystemId = 'windows' | 'walls'` in the end block of `F/types.ts` and `CUTAWAY_FACE_FLOW_KEY = { windows: 'window', walls: 'wall' }` mapping it onto `HeatLaneFlows`' keys (`flows.window`, `flows.wall`; there is no `flows.windows`). Not `face…`: CONTEXT's Face is an exterior wall of the footprint.
  - It reuses the whole home's face legs: extract `faceLegs(lane, flows, bounce, season)` from `homeHeatLanes`' `run`/`bounce` closures (`F/lib/home-heat-lanes.ts:33-47, 82-88`) and export `wallPoint` and `faceBounceTo` (`F/constants/home-heat-lanes.ts:101-117`); `homeHeatLanes` calls the extracted helper, so both draw one way.
  - The lanes cross the face along the wall's outward normal, at the strips the steps show.
  - **Summer, the outside leg:** from outside to the outer piece, carrying `flows[key][0]`.
  - **The bounce lane** sits at the Low-E coating's step on the build's window, or at the paint's on the wall, carrying the face's bounce. It is drawn only when that part is shown.
  - **The inside leg:** through the rest into the room, carrying `flows[key][1]`.
  - **Single-pane glass:** a straight lane, with no bounce.
  - **Winter:** the legs reverse, nothing bounces, and the outer leg carries `flows[key][1]`, as the whole home's does (`home-heat-lanes.ts:34-35`).

- [ ] **Step 1: Write the failing checks:**

The window and the wall are on the left wall, so outward is `[-1, 0, 0]`. A bounce is matched by its endpoints, as Task 3's is: it starts at the coating's (or the paint's) strip and ends at `faceBounceTo` of that point. `bounceAt(lanes, start)` is a local const in the check.

```ts
const lowE = cutawayFaceHeatLanes('windows', newWindowParts, heat, 'summer', { shown: newWindowShown, peel: 1 })
assert.ok(bounceAt(lowE, lowEStrip), 'the Low-E coating turns some heat back out')
assert.equal(cutawayFaceHeatLanes('windows', singlePaneParts, heat, 'summer', { shown: singlePaneShown, peel: 1 }).length, 2, 'single pane lets it straight through: two legs, no bounce')
const cool = cutawayFaceHeatLanes('walls', coolPaintParts, heat, 'summer', { shown: wallShown, peel: 1 })
assert.ok(bounceAt(cool, paintStrip), 'Cool Life paint turns some back at the paint')
assert.equal(cutawayFaceHeatLanes('walls', coolPaintParts, heat, 'winter', { shown: wallShown, peel: 1 }).length, cool.length - 1, 'winter runs the same legs out, with no bounce')
assert.ok(lowE.some(lane => Math.abs(lane.flow - Math.min(heatLaneFlows(heat).window[1], 1)) < 1e-9), 'up close carries the whole home\'s window figure')
```

Use a summer climate where both bounces clear a whole arrow, as the whole home's face lane checks do (`faceArrows`, `:791`).
- [ ] **Step 2:** Run the verify script. Expected: FAIL.
- [ ] **Step 3: Implement** `cutawayFaceHeatLanes` and `CutawayFaceFlows`, with `HEAT_ARROW_LOOK.size.cutaway` and the Look inside fade, as `CutawayFlows` draws its lanes.
- [ ] **Step 4:** Run the verify script, tsc and eslint. Expected: PASS.
- [ ] **Step 5: Screenshots,** Windows and Walls Look inside, Summer and Winter, Thermal on, Today and the build. 1194×834 dark, plus one light each.
- [ ] **Step 6: Commit:** `feat(trade-scenes): the window and the wall show their heat flow up close`.

### Task 9: By-eye pass and hand-over

**Files:** shots and the ledger in `.superpowers/sdd/2026-11-05-up-close-round-2/`.

- [ ] **Step 1: The matrix,** kept tight.
  - **Sizes:** the four sizes, dark, plus 1194×834 light.
  - **Cases:**
    - Attic in focus on Complete;
    - the Attic Look inside, Summer;
    - the Walls Look inside at peel 1;
    - the Windows Look inside at peel 1, in the build;
    - the Roof Look inside at peel 1, Today and a tear-off.
  - **The ledger:** list each §11 line with its shot.
- [ ] **Step 2: Frame cost.** Measure draw calls and triangles for the Walls Look inside and the whole home against the ledger's baselines. The whole home rises by no more than 5%; the Walls Look inside stays under the roof's.
- [ ] **Step 3: Docs (the controller), committed only when the owner asks:**
  - **The tracker:** R247–R252 marked built, with a §6 line naming the commit range.
  - **`CONTEXT.md`:** "Wood replacement" is recorded with the plan (owner 2026-11-05). Propose to the owner, never apply unasked: the "Look inside" entry (Walls joins; the attic has no peel) and the "Home view" entry (the attic and heating & cooling hold the house open while in focus; the rep's pick comes back). "Stepped cutaway" still waits for the owner's OK from round 1.
- [ ] **Step 4: Owner items** for the report: the iPad and phone check; the round 1 items still open (the ledger's list).
