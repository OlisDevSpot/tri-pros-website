# TS3b.6-B: the garage joins the house, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The attached garage becomes part of the home: it has its own temperature (shown as a pin and painted under Thermal) and pushes heat across the shared wall. It meets the house honestly (door, vent, downspout, no arrows over it), its roof is built from the house's own covering pieces, and its walls wear like the house's. Along the way a tear-off gains the code's roof vents and loses the default ridge vent.

| Part | Rulings | Tasks |
|---|---|---|
| Roof vents in the tear-off, the ridge vent out | R198, R199, R200, R201 | 1–2 |
| The garage's reading, paint, pin and arrows | R129, R146, R196, R197 | 3–4 |
| Where the garage meets the house | R144, R198, R202 | 2, 5, 7 |
| The garage roof from the house's pieces | R140 | 6 |
| Paint wear on the garage, the sunny wall by bearing | R121, R142 | 8 |
| Budget and hand-over | §9 | 9 |

**Architecture:**
- **Heat.**
  - `garage` joins the readings, hand-set per climate and weather like the others.
  - Cool Life and a cool roof move it through `PART_HEAT_EFFECTS`.
  - `homeHeat` derives one signed `garageFlow` from the garage reading minus the setpoint, and the open house draws the shared wall's lanes from it.
  - The roof vents are a construction part the tear-off installs. Their heat effect hangs on the part in `PART_HEAT_EFFECTS` like every other part's, so it runs before the fan's thermostat reads the attic, and in a few mixes the fan idles because of it (R201, accepted by the owner).
- **Drawing.**
  - The garage moves out of the `exterior` group into the ground-level ghost group. It fades with the house but never lifts.
  - Its walls paint as the `garage` zone and its roof as `roof`.
  - Its covering is laid by the house's own `RoofCovering`, in a garage slope frame.
- **Bound pieces.** Everything the garage draws is a module-level box list in `garage-boxes.ts`, or a memoized one, as in 6-A.

**Tech Stack:** Next.js 15, React 19.2, `@react-three/fiber` 9.8.2, three 0.180, zustand scene store, `frameloop="demand"`. Checks are the repo's `tsx` verify scripts (`node:assert/strict`, no test framework) and local Playwright screenshots.

**Spec:** `docs/superpowers/specs/2026-11-01-ts3b6b-garage-joins-the-house-design.md`. The executor reads it beside this plan; each task cites the sections it builds.

Abbreviations:
- `F/` = `src/features/trade-scenes/`, `CORE/` = `src/shared/modules/construction/core/`.
- "Scene check" = `pnpm tsx scripts/verify-trade-scene.ts`. "Lot check" = `pnpm tsx scripts/verify-trade-scene-lot.ts`. "Model check" = `pnpm tsx scripts/verify-construction-model.ts`.
- "Types and lint" = the locked `tsc` and per-file `eslint` in Global Constraints.

## Global Constraints

- **Written ahead of the code it meets.** The owner asked for this plan on 2026-11-01, while paint wear (R121), the Controls build and the blueprint load were mid-build and TS3b.4b hadn't started. It names files, lines and interfaces as of head `74f8c1bad` (stress-tested there), plus the interfaces TS3b.4b's current plan (`docs/superpowers/plans/2026-10-30-up-close-on-a-system.md`) promises: `SYSTEM_PARTS`, `systemPartTag`, `SystemLit`, `applyGhost(…, lit)`, HomeKit's `lit` prop, `SYSTEM_VIEW_WINDOW`, its R120 covering check and its list of edge parts kept out of the step order. **Every TS3b.4b name is provisional:** the Controls plan (`docs/superpowers/plans/2026-11-01-trade-scene-controls.md:18`, Task 11) has TS3b.4b re-planned on the Controls head, so Before Task 1 re-reads them from the re-planned plan and the code it built.
- **Build order (R145, and the Controls plan's own order):** paint wear, the blueprint load and Controls, then TS3b.4b (re-planned), then this. The build starts only once all of them are committed and the owner says "build". "Go ahead" is not "build".
- **Binding rules:** `.superpowers/sdd/2026-10-24-upgrades-that-follow-the-home/standing-rules.md` binds every task in full, with these exceptions:
  - the binding spec is the one above;
  - this build's records (ledger, briefs, shots, probe scripts) go in `.superpowers/sdd/2026-11-01-ts3b6b-garage-joins-the-house/`;
  - **commits** (one rule, two cases, from `docs/superpowers/handoff/2026-10-30-attic-parallel-build-handoff.md:58-68`):
    - by default, commit by explicit path: `git commit -F - -- <paths>`;
    - for a file holding anyone else's hunks, stage only your own with `git apply --cached`, check `git diff --cached --name-only`, and commit with plain `git commit -F -`, no pathspec;
  - **claims:** while any other session builds in this worktree, take the claim in `.superpowers/claims/` before editing `scripts/verify-trade-scene.ts`, `F/types.ts` or `F/constants/home-geometry.ts`.
- Never `pnpm build`. Run checks under the shared lock: `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock pnpm tsc`, and `flock … env CI=1 pnpm eslint <every file created or modified>` (this replaces `pnpm lint`). Run `tsc` again after any `eslint --fix`.
- Never start a dev server and never `rm -rf .next`. Shots and probes use the owner's server on `http://localhost:3002`.
- Sign in with `/api/dev/playwright-session?…&as=info%40triprosremodeling.com`, never `role=`. Read the secret through `.superpowers/sdd/2026-10-24-upgrades-that-follow-the-home/shots/t7-lib.mjs`, and never print it. No DB writes of any kind.
- Commit with a 300000 ms timeout. Never `git add -A`, `git stash`, `git reset` or `git checkout -- <file>` (`standing-rules.md`). Run `git diff --shortstat` after any scripted edit.
- Builders never stage `docs/**` or `CONTEXT.md`. Tracker and spec edits are the controller's, left unstaged for the owner.
- **No import cycle:** `home-geometry.ts` and `home-details.ts` never import `home-lot.ts` or `garage-boxes.ts`. Modules that load after them (`home-anchors.ts`, `home-heat-lanes.ts`, `F/lib/*`) may import `GARAGE` from `home-lot.ts`.
- **No three.js** in `F/lib/`, `F/constants/` or `F/types.ts`, type-only imports included. The scene check enforces it.
- Every geometry a component builds goes through `useOwnedGeometry`. Box lists handed to `MergedBoxes` are module-level or memoized.
- **No shims:** a renamed or deleted export has every caller repointed in the same task.
- **Working numbers:** every hand-set figure (temperatures, effects, the flow factor, positions, sizes) carries one comment marking it a working number, tuned at the owner's review (R43).
- **Copy:**
  - screen copy lives in `F/constants/home-scene-copy.ts`; part and material copy stays in the assembly file;
  - it never says "your" and never mentions solar.
- **Comments say why, never what.** No banners, and no citing the spec, the plan or a ruling from code.
- **The meeting visualizations are left alone** (`src/features/meeting-visualizations/`, spec §5.3). They don't read `SCOPE_INSTALLS`.
- **Budget (spec §9):** measured against the head 6-B builds on, at 1280 × 800, Complete, Normal, with the 6-A probe scripts:
  - at most **+17 draw calls** and **+23.5k triangles** on a flat roof;
  - at most **+60k triangles on tile**;
  - **no new textures**;
  - shadow map stays 2048; no `EffectComposer`, no post pass.
- **Screenshots:**
  - Sizes: 1280 × 800 and 1194 × 834 for every task. Pin tasks add 390 × 844 and 834 × 1194.
  - Cover pitched and flat. Normal, Summer, Winter and Rain, with Thermal on and off.
  - Read every PNG.

## Review Focus

1. **A home without a tear-off reads exactly as it did.** Every house reading (roof, attic, ceiling, wall, window), in both climates, all three heat weathers and both roof forms, matches the value captured at the base SHA. That holds for the default home and for the **cool home**: Cool Life plus an overlay (pitched) or a cool torch down (flat), built through `resolveScene` in the proposed view, so no tear-off is in it. Only the new `garage` key is added. Test: Task 3, step 1. (A home *with* a tear-off moves on purpose; Task 1 lists the checks that move.)
2. **Rain.** No garage pin and no garage arrows. The garage paints at the storm's outside air plus 3 °F, and no figure errors on `readings: null`. Tests: Task 3 (paint), Task 4 (shots in Rain, Thermal on).
3. **No upgrade turns the shared wall's heat around or makes the garage a room.** With every mix of Cool Life, cool shingle, cool membrane and tile:
   - the garage stays hotter than the setpoint in Normal and Summer and colder in Winter;
   - the garage arrows never exceed the sunny wall's flow.

   Test: Task 3, step 1.
4. **A raised house.** The garage stays at grade, its pin doesn't rise with the house, and the landing and steps show only on a raised house. Tests: Task 3 (the garage anchor is an unlifted reading), Task 5 (steps), and the Task 4 and 5 shots on slab and raised.
5. **A tear-off on anything but a plain pitched roof.** A flat roof never resolves roof vents, even with a tear-off picked. A tile reset adds neither roof vents nor a ridge vent. The default tear-off's savings don't move. Test: Task 1, step 1.

---

## Before Task 1

- [ ] **Gates:**
  - Paint wear's ledger (`.superpowers/sdd/2026-10-30-exterior-paint-wear-kinds/progress.md`), the blueprint load's (`.superpowers/sdd/2026-11-01-trade-scene-blueprint-load/progress.md`) and the Controls build's show no open task, and the tracker's Controls row reads "built".
  - TS3b.4b has been re-planned on the Controls head, and that plan's ledger shows its hand-over task done with no open task. Record the re-planned plan's path in this build's ledger; every "TS3b.4b's" below means that plan and the code it built.
  - No other session is building in this worktree, or its claims are honoured.
  - The owner has said "build".

  If any of these fails, stop and tell the owner.
- [ ] **Re-baseline (the plan predates the code).** Re-read each interface below at the new head. Where one differs, stop with `⚠️ Stale ref — <plan line> says X, but <path> does Y`, and propose the plan fix before any task starts.
  - **TS3b.4b:**
    - `SYSTEM_PARTS` (and whether it still lists `ridge-vent` as a roof part);
    - `systemPartTag`;
    - `applyGhost`'s signature;
    - HomeKit's `ghosted` → `lit` change, and every `!ghosted` gate (ReadingLabels, arrows, rain);
    - `SYSTEM_VIEW_WINDOW` (must index a front-wall window, spec §5.1);
    - whether `homeHeatLanes`'s signature moved (Task 11 of that plan rebuilds the flows);
    - whether the Roof & gutters view lights parts by `systemPartTag`;
    - its R120 check that only the house mounts `RoofCovering` (Task 6 rewrites it);
    - its list of edge parts kept out of the step order (today's plan, :739: `drip-edge`, `gutter`, `ridge-vent`; Task 1 adds `roof-vent`);
    - that the roof-attic assembly kit and its `drawPart` switch are deleted (if any of it survives, Task 2 gives `roof-vent` a drawing there).
  - **Paint wear:**
    - `PaintLook`;
    - `PaintMarks` and `PaintStains`;
    - `stuccoCracks`, `splashBand`, `runoffStreaks`, `sillDirt`, `fadeBlotches` and `wallPeeling` (each still takes a `HouseWall`; which take an `openings` list);
    - `F/lib/front-door-boxes.ts` (`FRONT_DOOR_BOXES`), and whether its builder takes a wall and an opening;
    - `FRONT_OPENINGS` and where it lives (paint wear moves it into `home-geometry.ts`).
    - `F/lib/foundation-walls.ts` (paint wear's Task 3).
  - **The blueprint load:** `BLUEPRINT_OMIT_TAG` (on `RoofCovering`, `roof-covering.tsx:69`, so the garage's courses inherit it) and what the blueprint draws of the garage today.
  - **This plan's targets:**
    - `HomeHeat`;
    - `homeHeat`;
    - `homePaintTemperatures`;
    - `READING_IDS`;
    - `GARAGE_BOXES`;
    - `RoofCovering`'s props;
    - `HOUSE_WALLS.right`;
    - `DOWNSPOUTS`;
    - `GableVent` and `GableVentBackings`.
- [ ] Create `.superpowers/sdd/2026-11-01-ts3b6b-garage-joins-the-house/`. Copy `perf.mjs`, `lib.mjs` and `shots.mjs` from `.superpowers/sdd/2026-11-01-ts3b6a-lot-and-light/`, then:
  - replace `lib.mjs`'s fixed wait after the canvas appears (`:43`) with the blueprint load's `waitPhase(page, 'live')` (`.superpowers/sdd/2026-11-01-trade-scene-blueprint-load/lib.mjs:41`): the stage takes no input until the load reaches `live`;
  - re-point the panel paths (roof, weather, view, thermal) to the Controls build's controls;
  - record both in a `scripts-readme.md` beside them.
- [ ] **Record the base**, saved as JSON beside the script:
  - the head SHA as `BASE` in the ledger;
  - `node perf.mjs default base flat`, `… default base tile`, `… worst base flat`, `… worst base tile`.
- [ ] **Capture, at `BASE`, the figures Tasks 1 and 3 compare against**, with a throwaway `tsx` script kept in the records folder (never in `scripts/`), printing them as TypeScript literals. **`.superpowers/` is gitignored**, so the committed checks never read a file from it: Task 1 and Task 3 paste the printed literals into `scripts/verify-trade-scene.ts` as a `BASE_READINGS` table and a `BASE_TEAR_OFF_SAVINGS` value, each with one comment saying they were captured before the garage and the vents.
  - `homeHeat(climate, weather, shell).readings` for 2 climates × 3 heat weathers × 2 forms, on the default home, on the cool home (Review Focus 1), and on a tile reset;
  - `sceneSavings` for the default home with the tear-off picked.
  - Also record today's `EXTERIOR_WALL_READING` and `WINDOW_READING` as computed (the window's x is −5.84, not −5.8) for Task 8.
- [ ] Shoot the base opening view and an up-close roof view in all four weathers, with Thermal on and off, pitched and flat, plus one shot mid-blueprint (the garage's blueprint today).

---

### Task 1: The tear-off installs the code's roof vents, not a ridge vent (R198–R200; spec §5.3)

**Files:**
- Modify:
  - `CORE/constants/assemblies/roof-attic.ts`: the `roof-vent` part, after `ridge-vent`.
  - `CORE/constants/scope-installs.ts`: `SHINGLE_ROOF`.
  - `CORE/lib/assemblies/roof-attic/infer-existing-conditions.ts`: `'roof-vent'` absent.
  - `F/constants/home-heat-figures.ts`: `PART_HEAT_EFFECTS['roof-vent']`.
  - `F/constants/system-parts.ts` (TS3b.4b's): a whole `roof-vent` system part, after `ridge-vent`.
  - TS3b.4b's list of edge parts kept out of the step order (its current plan :739): `roof-vent` joins `drip-edge`, `gutter` and `ridge-vent`, so a tear-off's vents are never cut back as a step.
- Test: `scripts/verify-construction-model.ts`, `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - **The part:** `{ id: 'roof-vent', group: 'roof', role: 'ventilate', forms: ['pitched'], absentCopy: { label: 'No roof vents', detail: … }, materials: { static: { copy: { label: 'Roof vents', detail: … } } } }`.
    - The material id is `static`, with no `thermal` and no `energyRank`, so the thermal walk treats it as a fitting and no bill figure moves.
    - The copy describes real homes, not the scene's drawing (no "its one gable vent", no "two on each side"). Absent detail: with no vents near the ridge, the attic's hottest air has few ways out, so summer heat builds under the roof. Installed detail: low-profile vents near the ridge let the attic's hottest air out, as code requires on a new roof.
  - **`SHINGLE_ROOF`** loses `{ part: 'ridge-vent', material: 'vent' }` and gains `{ part: 'roof-vent', material: 'static' }` in its place. `TILE_ROOF` is unchanged. The `ridge-vent` part stays in the assembly, absent on every existing home, for the later add-on (R200).
  - **`PART_HEAT_EFFECTS['roof-vent'].static`**, working numbers:
    - `normal: { readings: { attic: -3, ceiling: -0.2 }, flows: { roofPasses: [0.95, 1] } }`;
    - `summer: { readings: { attic: -8, ceiling: -0.6 }, flows: { roofPasses: [0.92, 1] } }`;
    - no winter entry and no `load` or `bounce` in any weather.

    One comment says why it sits with the parts, not with `ATTIC_FAN_HEAT_EFFECTS`: the fan's thermostat reads the attic after every part's effect, so it reads the vented attic, and it may idle because of the vents (R201, the owner's ruling; never "fix" it by moving the effect after the fan).

- [ ] **Step 1: Write the failing checks.**
  - **Model check:**
    - `SCOPE_INSTALLS[SCOPE_IDS.roofTearOff].installs` holds `roof-vent`/`static` and no `ridge-vent`.
    - `roofTileReset`, `roofOverlay`, `roofTorchDown` and `roofRedeck` install no `roof-vent`.
    - The existing pitched home resolves `roof-vent` absent with the label "No roof vents".
    - The proposed tear-off on a pitched home resolves `roof-vent` installed and `ridge-vent` absent.
    - **A flat home resolves no `roof-vent` part, even with `roofTearOff` among the proposed scopes** (Review Focus 5).
    - The existing `ridge-vent` asserts (`verify-construction-model.ts:182-185`) still pass.
  - **Scene check:**
    - For each climate, the tear-off home's attic reading is 3 °F below its existing view in Normal and 8 °F below in Summer, and equal in Winter.
    - Each vent effect is smaller than `ATTIC_FAN_HEAT_EFFECTS`' attic effect in the same weather.
    - No weather of `PART_HEAT_EFFECTS['roof-vent'].static` has `load` or `bounce`.
    - **`sceneSavings` for the default tear-off equals `BASE_TEAR_OFF_SAVINGS`** (Review Focus 5).
    - A tile reset's readings equal `BASE_READINGS`.
    - TS3b.4b's check that every construction part is exactly one whole system part passes with `roof-vent`.
    - **R201, pinned:** coastal Summer, pitched, a tear-off with its default cool shingle plus a radiant barrier and the attic fan. The fan idles (`atticFanRunning === false`), and the attic reads the vented figure (the starting attic plus the covering, barrier and vent effects, ≈ 96.4 °F). The same home with an overlay instead (no vents) runs the fan. The message names R201, so no one "fixes" it.
    - The existing "summer runs the fan" sweep (`verify-trade-scene.ts:644-657`) builds its homes without `roof-vent` and stays as it is.
  - **Approved figures this task moves on purpose** (the tear-off is in them). Recompute each from the new code, update the literal, and put old → new in the ledger for the owner's set (Task 9). Never loosen a tolerance:
    - `FULL_BUILD` (`verify-trade-scene.ts:147`) feeds `buildIn`: the inland Summer build attic (`:579`, 120.6 ± 2, expected ≈ 112.6) and build ceiling (`:581`, 78.2 ± 0.5);
    - `builtHeat` (`:1059`) and the build figures at `:397` and `:420`;
    - any other check whose message fails in step 2 because a tear-off home's attic or ceiling moved. List it in the ledger before changing it.
- [ ] **Step 2: Run them.** Expected: FAIL on the missing part.
- [ ] **Step 3: Implement** the part, installs, existing condition, effect, system part and step-order exclusion.
- [ ] **Step 4: Run** the model check, the scene check, and types and lint. Expected: PASS, with only the listed figures changed.
- [ ] **Step 5: Commit:** `feat(construction): a tear-off installs the code's roof vents, and the ridge vent leaves the default`.

### Task 2: Roof vents on the roof, their arrow, and the covered gable's vent gone (R198, R199; spec §5.3)

**Files:**
- Create:
  - `F/lib/roof-vent-boxes.ts`
  - `F/ui/components/home-kit/roof-vents.tsx`
- Modify:
  - `F/constants/home-details.ts`: `ROOF_VENT = { xs: [-3, 3], belowRidge: 0.7 }` (working numbers), beside `GABLE_VENT`. Tuning literals live in constants, and `home-details.ts` imports nothing, so no cycle.
  - `F/types.ts`: `HomeHeat.roofVented`, and `StartingHomeHeat`'s `Omit`.
  - `F/lib/home-heat.ts`
  - `F/constants/home-heat-lanes.ts`: `ROOF_VENT_LANE`.
  - `F/lib/home-heat-lanes.ts`
  - `F/ui/components/home-kit/house-roof.tsx`: passes `partState(parts, 'roof-vent')`.
  - `F/ui/components/home-kit/gable-roof.tsx`: mounts `RoofVents` and drops the right `GableVent`.
  - `F/ui/components/home-kit/gable-vent.tsx`
  - `F/ui/components/home-kit/gable-vent-backings.tsx`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: the `roof-vent` part (Task 1); `coveringBaseY`, `coveringStandoff`, `HOUSE`, `RIDGE_Y`, `SLOPE_LENGTH`, `ROOF_VENT`; TS3b.4b's `systemPartTag`.
- Produces:
  - **`HomeHeat.roofVented: boolean`**: the shell has `roof-vent` with a material. Set in `homeHeat` beside `atticFanRunning`, and omitted from `StartingHomeHeat` the same way.
  - **`roofVentBoxes(): { kept: BoxSpec[], complete: BoxSpec[] }`**, module-level as `ROOF_VENT_BOXES`.
    - Two low-profile static vents per slope at `ROOF_VENT.xs`, `ROOF_VENT.belowRidge` m down the slope from the ridge.
    - Each vent is a flashing plate and a hood, tilted with its slope and standing on the covering by the shingle's `coveringStandoff`, as `ventPipeStubCylinders` (`F/lib/vent-pipe-stub-cylinders.ts:17`) stands its stubs. The vents only ever come with a shingle tear-off, so the shingle's standoff is the only one they meet, and the list stays module-level.
    - The near slope's vents at x < `HOUSE.cutX` go in `complete`; every other vent goes in `kept`.
  - **`RoofVents({ part: PartState })`**:
    - draws nothing when `part.material === null`;
    - `kept` draws in one `MergedBoxes`;
    - `complete` draws under `HOME_FADE_TAGS.complete`, as the near slope's Complete-only piece does;
    - both sit under `thermalTag(null, 'roof-vent')` and `systemPartTag('roof-vent')`, nested per TS3b.4b's nesting rule.
  - **`ROOF_VENT_LANE: { from: Vec3, to: Vec3, share: number }`**:
    - from just above the kept near-slope vent (`ROOF_VENT.xs[1]`, `ROOF_VENT.belowRidge` down the slope, on `coveringBaseY`), derived from those constants, not retyped; rising 1.2 m;
    - `share: 0.5` (working numbers).

    `homeHeatLanes` pushes it in both views when `heat.roofVented && season === 'summer'` (Normal and Summer, `HEAT_WEATHER_PROFILES`). Its flow is `share × flows.roof[1]`, the fan lane's flow scaled down. It goes through `heatArrowLane` directly, never `run`: vents only ever let heat out.
  - **The covered gable:**
    - `GableVent()` loses its `side` prop and draws the left gable's louvres;
    - `GableVentBackings()` draws only the left backing;
    - `gable-roof.tsx` mounts no vent on the right gable.

    One comment, on `GableVent`, says why the right gable has none: the attached garage's roof covers it. The right gable's stucco and cracks stay.

- [ ] **Step 1: Write the failing checks:**
  - `ROOF_VENT_BOXES` has 2 vents on each slope (four in all). Every vent box's centre lies within 0.02 m above the covering's surface plus standoff.
  - Every vent is within `ROOF_VENT.belowRidge + 0.3` m of the ridge, along the slope.
  - Exactly one near-slope vent is in `complete`.
  - With the tear-off, Summer: the vent lane is in both views' lanes, and its count is below the fan lane's at the same heat. In Winter, or without the tear-off, it's absent.
  - **Source checks**, in the scene check's existing grep style:
    - `homeGableVent(1)` appears nowhere under `F/ui/`;
    - `gable-roof.tsx` mounts `GableVent` once.
- [ ] **Step 2: Run, implement, run** the scene check, then types and lint.
- [ ] **Step 3: Screenshots,** pitched, existing view and tear-off picked:
  - opening view, Normal: the front pair shows near the ridge;
  - the right gable from the front-right: plain stucco above the garage roof;
  - the left gable: its vent still there;
  - Partly open: the complete-only vent fades with the near slope;
  - Thermal, Summer, tear-off: one faint lane above the vents and the fan lane at the left gable;
  - flat roof with torch down: no vents;
  - the tear-off's ridge: the plain cap in the covering's colour, no ridge vent (`gable-roof.tsx:64-69`);
  - the panel's tear-off offer reads "Also new: Roof vents", not "Ridge vent" (`part-offers.ts:164-172`).
- [ ] **Step 4: Commit:** `feat(trade-scenes): a new roof's vents stand near the ridge and let the attic's heat out, and the gable the garage covers has no vent`.

### Task 3: The garage's temperature and its heat across the shared wall (R129, R146, R196, R197; spec §4)

All pure. `READING_IDS` grows, so every `Record<ReadingId, …>` is filled in this task, or `tsc` fails.

**Files:**
- Modify:
  - `F/constants/home-anchors.ts`: `READING_IDS`, `READING_CALLOUTS`, `READING_ANCHORS`, and new `HOUSE_READING_IDS`/`UNLIFTED_READING_IDS`.
  - `F/constants/home-heat-figures.ts`
  - `F/constants/home-temperatures.ts`: `GARAGE_STORM_RISE_F`.
  - `F/constants/home-thermal-zones.ts`: `'garage'`.
  - `F/lib/home-paint-temperatures.ts`
  - `F/types.ts`: `HomeHeat.garageFlow`, `StartingHomeHeat`.
  - `F/lib/home-heat.ts`
  - `F/constants/home-heat-lanes.ts`: `GARAGE_WALL_LANES`.
  - `F/lib/home-heat-lanes.ts`
  - `F/constants/home-scene-copy.ts`: `READING_COPY.labels`.
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `GARAGE`, `GARAGE_BOXES`; `CLIMATE_PRESETS`; `RAIN_PRESET_WEATHER`.
- Produces:
  - **The reading:**
    - `READING_IDS = [...SECTION_READING_IDS, 'exterior-wall', 'window', 'garage'] as const`.
    - `UNLIFTED_READING_IDS = ['garage'] as const`, the readings taken on the garage, which never lifts with a raised house. (Not "ground": that word is the foundation's stretching `ground` group and the lot's ground.)
    - `HOUSE_READING_IDS`, the rest, in order.
    - `garage` is not an inside reading.
  - **`STARTING_HOME_HEAT[climate][weather].readings.garage`:** inland 92 / 118 / 45 and coastal 84 / 102 / 50, for Normal / Summer / Winter. These are the spec's placeholders. `ROOF_FORM_HEAT_EFFECTS` gains no garage effect.
  - **Garage effects in `PART_HEAT_EFFECTS`**, working numbers, merged into the existing weather entries:

    | Material | Normal | Summer | Winter |
    |---|---|---|---|
    | `paint.cool` | −2 | −5 | +1 (a new winter entry with only `readings.garage`) |
    | `covering['cool-shingle']` | −3 | −8 | +1 (new winter entry) |
    | `covering['cool-membrane']` | −3 | −10 | +1 (new winter entry) |

    No other entry gains a `garage` key.
  - **`GARAGE_WALL_FLOW_PER_F = 0.01`** in `home-heat-figures.ts`. One comment: a working number, set so the shared wall carries a little less than the sunny wall at the default figures.
  - **`HomeHeat.garageFlow: number`:** signed, positive when the garage's heat comes into the rooms. `homeHeat` sets it last, after the fan, as `(readings.garage − CLIMATE_PRESETS[climate][weather].setpoint) × GARAGE_WALL_FLOW_PER_F`, held to −1..1. It feeds no `load`.
    - **Trap:** `home-heat.ts:9`'s `clamp` floors at 0, so it would erase the winter sign. Use `Math.min(1, Math.max(-1, …))`.
    - **Trap:** `applied()` (`home-heat.ts:21-39`) rebuilds `HomeHeat` field by field, so `garageFlow` and `roofVented` are set after the last `applied()` call, or carried through it.
  - **The paint:**
    - `HOME_THERMAL_ZONES` gains `'garage'`.
    - `homePaintTemperatures` returns `garage: readings?.garage ?? outside + GARAGE_STORM_RISE_F`.
    - `GARAGE_STORM_RISE_F = 3`, a working number.
  - **`GARAGE_WALL_LANES: readonly { outside: Vec3, face: Vec3, inside: Vec3 }[]`**, the same point names as the wall lanes (`home-heat-lanes.ts:108-110`), where `outside` is the garage side:
    - on `HOUSE_WALLS.right` at `GARAGE_LANE_ALONGS = [-1.3, 2.4]` (working numbers, clear of the door at along 0.6), `y = WALL_LANE_Y`;
    - built with the file's own `wallPoint` (`home-heat-lanes.ts:96`): `outside` at `HOUSE.wallThickness / 2 + SHARED_WALL_LANE_OUT` (`SHARED_WALL_LANE_OUT = 0.5`; not `GARAGE_…`, which would sit beside the unrelated private `GARAGE_REACH`), `face` at `FACE_OUT`, `inside` at `−OPEN_LANE_REACH`.
  - **`homeHeatLanes`'s Partly open branch** pushes each garage lane's two legs at `|heat.garageFlow|`: outside → face → inside when the flow is positive, and inside → face → outside when it's negative. They go through `heatArrowLane` directly, never `run`: the sign sets the direction, not the season. The Complete branch draws none, because the garage hides that wall.
  - **The anchor:** `READING_ANCHORS[form].garage = [(GARAGE.x0 + GARAGE.x1) / 2, GARAGE.door.height + 0.35, GARAGE.z1 + 0.05]` for both forms, in the ground's frame (never lifted). `READING_CALLOUTS.garage = { offset: [22, -36] }`, a working number.
  - **Copy:** both forms' labels gain `garage: 'Garage'`.

- [ ] **Step 1: Write the failing checks:**
  - **Review Focus 1:** every non-garage reading equals `BASE_READINGS` for all 24 captured cases (default home and cool home).
  - **Review Focus 3:**
    - For 2 climates × 3 heat weathers × every combination of `paint` ∈ {original, cool} and `covering` ∈ {shingle, cool-shingle, tile} (pitched), or {membrane, cool-membrane} (flat):
      - `garageFlow > 0` in Normal and Summer and `< 0` in Winter;
      - `0 < |garageFlow| < STARTING_HOME_HEAT[c][w].flows.wall`.
    - Cool Life and the cool roof each lower the garage in Normal and Summer and raise it in Winter.
    - No `PART_HEAT_EFFECTS` entry but those three carries a `garage` key.
  - **R196 grouping,** at the default figures in all six cases: `min(|g − outside|, |g − exterior-wall|) < |g − setpoint|`.
  - **Review Focus 2:**
    - Rain's `homePaintTemperatures({ readings: null, weather: 'rain', … }).garage` equals the winter preset's outside plus 3.
    - In a heat weather it equals `readings.garage`.
  - **Lanes, Partly open:**
    - The lanes hold `GARAGE_WALL_LANES.length × 2` garage legs.
    - In Summer the first leg starts at an `outside` point and ends at its `face`. In Winter the first leg starts at `inside`.
    - Every garage lane point's z lies inside `GARAGE.z0..GARAGE.z1`, and 0.2 m clear of the opening at along 0.6 (`HOUSE_WALLS.right.openings[0]`, still the window here; Task 5 makes it `HOUSE_GARAGE_DOOR` at the same along and repoints this check).
    - Complete has no garage legs.
    - The existing "no lane crosses the right wall under the garage" check (`verify-trade-scene.ts:1033-1036`) loops only `OPEN_FACE_LANES` and `COMPLETE_FACE_LANES`, so it needs no exemption and stays as it is.
  - **Existing checks this task changes on purpose:**
    - the Cool Life `deepEqual`s (`verify-trade-scene.ts:798-803`) gain the `garage` key with the new figures (for the placeholders: inland Summer 118 − 5 = 113, coastal Winter 50 + 1 = 51);
    - the open-house lane count (`:1050`, `9 + 2 × OPEN_FACE_LANES`) gains `2 × GARAGE_WALL_LANES.length`.
  - **Anchors and copy:**
    - `UNLIFTED_READING_IDS` and `HOUSE_READING_IDS` partition `READING_IDS`.
    - Every reading has a callout and a label for both forms.
- [ ] **Step 2: Run, implement, run** the scene check, then types and lint.
- [ ] **Step 3: Commit:** `feat(trade-scenes): the garage has its own temperature, and its heat crosses the wall it shares with the house`.

### Task 4: The garage under Thermal: its paint, its pin, and the ghost (R196, R197; spec §4.1, §4.2, §7)

**Files:**
- Modify:
  - `F/ui/components/home-kit/home-kit.tsx`
  - `F/ui/components/home-kit/garage.tsx`
  - `F/ui/components/home-kit/reading-labels.tsx`
  - `F/ui/components/home-scene-fallback.tsx`: it lists every `READING_IDS` pin (`:21`), so it lists `HOUSE_READING_IDS` unless the fallback stills show the garage (Task 9 decides by looking at the stills; the default is `HOUSE_READING_IDS`).
- Test: `scripts/verify-trade-scene.ts` (source checks), and screenshots.

**Interfaces:**
- Consumes: `UNLIFTED_READING_IDS`, `HOUSE_READING_IDS`, the `garage` zone (Task 3); TS3b.4b's ghost and `lit`.
- Produces:
  - **`ReadingLabels({ form, ids }: { form: string | null, ids: readonly ReadingId[] })`** (`ids`, since `heat.readings` already means the °F values):
    - HomeKit mounts `HOUSE_READING_IDS` in the lift group, where it is today;
    - it mounts `UNLIFTED_READING_IDS` beside the garage, outside the lift;
    - both sit behind the same gate the house's labels use today (`thermal && <not up close> && targets.heat !== null`).
  - **The garage moves** from the `thermalTag('exterior')` group into the ground-level ghost group (`groundLevel`, `HOME_GHOST_TAG`), so it fades with the house up close but never lifts. The `Lot` stays in the exterior group.
  - **Thermal tags inside `Garage`.** The `groundLevel` group carries only `HOME_GHOST_TAG` (`home-kit.tsx:222`), and the thermal paint skips any mesh with no zone (`F/ui/lib/thermal-paint-set.ts`), so a piece left untagged would keep its daylight colour under Thermal. So the tags sit on groups, not pieces:
    - `Garage`'s root group is `thermalTag('garage')`, so every piece added later (Task 5's steps and gutter excepted, which carry their own tags) paints as the garage;
    - one roof subgroup, `thermalTag('roof')`, holds the slopes, membrane, fascia, gable end and everything Task 6 adds (ridge, seams, patches, deck);
    - the gable end is stucco, but it stands above the garage's open ceiling, so it reads with the roof that heats it.
  - The garage stays closed in Partly open: no part of it carries `HOME_FADE_TAGS.complete`.

- [ ] **Step 1: Write the failing source checks:**
  - In `home-kit.tsx`, `<Garage` sits inside the `groundLevel` group and not inside the `lift` group.
  - `ReadingLabels` is mounted twice, once with each id list.
  - `garage.tsx`'s root group carries `thermalTag('garage')`, and its roof pieces sit under one `thermalTag('roof')` group.
- [ ] **Step 2: Run, implement, run** the scene check, then types and lint.
- [ ] **Step 3: Screenshots,** inland and coastal, pitched and flat, slab and raised:
  - **Thermal on, all four weathers.**
    - Normal, Summer, Winter: the garage pin reads its number; the walls paint near the yard's colours, not the rooms'.
    - Partly open, Summer: the arrows come out of the garage into the kitchen (the right room, `home-geometry.ts:125`). Winter: the reverse.
    - Rain: no garage pin, no arrows.
  - **Raised vs slab** at the same camera: the garage pin sits at the same pixel (Review Focus 4).
  - **Up close** on the roof and on a window: the garage fades with the house. Leaving restores it fully opaque.
  - **The pin's place:** 390 × 844 and 834 × 1194, so the garage pin clears the build switch and the other pins.
- [ ] **Step 4: Commit:** `feat(trade-scenes): the garage paints and reads at its own temperature under Thermal, and fades with the house up close`.

### Task 5: The house door to the garage, its steps, and the garage's gutter (R202; spec §5.1, §5.2, §5.4)

**Files:**
- Create: `F/lib/house-garage-door-boxes.ts`
- Modify:
  - `F/constants/home-geometry.ts`: `HOUSE_GARAGE_DOOR`, `RIGHT_OPENINGS`, `HOUSE_WALLS.right.openings`, the `DOWNSPOUTS` comment.
  - `F/lib/front-door-boxes.ts` (paint wear's): its builder becomes `doorBoxes(wall, opening, frame)`, with `FRONT_DOOR_BOXES` a call of it, unless it already takes a wall and an opening (Before Task 1).
  - `F/ui/components/home-kit/house-shell.tsx`: mounts the door, and passes `RIGHT_OPENINGS` to the right wall's cut.
  - `F/ui/components/home-kit/rooms.tsx`: the room paint cuts `RIGHT_OPENINGS`.
  - `F/constants/home-heat-lanes.ts`: `windowLanes` loses `underGarage`.
  - `F/lib/downspout-boxes.ts`: exports `downspout(x, z, size, top, bottom = BOTTOM)`.
  - `F/lib/garage-boxes.ts`
  - `F/types.ts`: `GarageBoxes`.
  - `F/ui/components/home-kit/garage.tsx`
  - `F/ui/components/home-kit/home-kit.tsx`: passes the gutter part.
- Test: `scripts/verify-trade-scene.ts`, `scripts/verify-trade-scene-lot.ts`

**Interfaces:**
- Produces:
  - **`HOUSE_GARAGE_DOOR`** in `home-geometry.ts`: `{ along: 0.6, width: PARTITION_DOOR.width, sill: 0, head: PARTITION_DOOR.head }`. The name is the owner's (R202): "garage door" is the car's door (`GARAGE.door`).
  - **The front door's pattern, followed.** In the code a wall's `openings` are its windows only: `FRONT_DOOR` stays out of `FRONT_WALL.openings` and joins it only where the wall is cut (`FRONT_OPENINGS`, `house-shell.tsx:64`). So:
    - `HOUSE_WALLS.right.openings = []`: the right window goes;
    - `RIGHT_OPENINGS = [...HOUSE_WALLS.right.openings, HOUSE_GARAGE_DOOR]` sits beside `FRONT_OPENINGS` and goes wherever the right wall is cut: its skin (`WallSkinSpec.openings`), the room paint (`rooms.tsx`), and the cracks if they cut openings;
    - window drawing, window lanes and paint wear's sill-placed marks keep reading `wall.openings`, so they see no window on the right wall and put nothing at the door. `windowLanes`' `underGarage` filter goes, since no window remains under the garage;
    - no `windowOpenings` helper.
  - **The door:** a frame and a leaf on `HOUSE_WALLS.right` at `HOUSE_GARAGE_DOOR`, `HOUSE_GARAGE_DOOR_BOXES = doorBoxes(HOUSE_WALLS.right, HOUSE_GARAGE_DOOR, …)` plus the mirrored leaf for the garage's face, in `HOME_PALETTE.door` and `HOME_PALETTE.trim`. Module-level, in `F/lib/house-garage-door-boxes.ts`.
    - It is part of the house wall, so `house-shell.tsx` mounts it, inside the lift group: it rises with a raised house.
    - Faces on both sides of the wall: the room's face shows in Partly open; the garage's face lies inside the garage's solid body and shows only through its ghost.
  - **`GarageBoxes` gains:**
    - `gutter: readonly BoxSpec[]`:
      - pitched: the front eave gutter from `GARAGE.x0` to the garage roof's outer rake end. `GARAGE.z1 === HOUSE.halfDepth`, so the house's `GUTTER.out` applies as it is, and its y is the house's `GUTTER_Y` moved by `GARAGE_GABLE.baseY − RAFTER_ORIGIN_Y`. Plus a downspout from `downspout(GARAGE.x1 − 0.3, GARAGE.z1 + 0.08, …, bottom = 0)`: the house's downspouts end below 0 because the house frame lifts, and the garage never lifts;
      - flat: a scupper through the garage's back parapet and a downspout behind it, through the same `downspout`.
    - `steps: readonly BoxSpec[]`: inside the garage at the door, a landing whose top is `HOME_FLOOR_Y.raised` and steps down to `HOME_FLOOR_Y.slab`, built like the front steps (`FRONT_STEPS` and the `STEPS` builder, `foundation.tsx:40`), so each riser keeps the code's under-7¾-inch rule (≤ 0.197 m).
  - **`Garage` takes `gutter: PartState`.**
    - The gutter draws only when `gutter.material !== null`, in `wornColor(HOME_PALETTE.gutter, HOME_PALETTE.gutterWorn, gutter.wear)`, under `thermalTag('exterior', 'gutter')` and TS3b.4b's `systemPartTag('gutter')`.
    - The steps draw under `HOME_FADE_TAGS.raised`, so the foundation switch cross-fades them like the house's raised parts.

- [ ] **Step 1: Write the failing checks:**
  - `HOUSE_WALLS.right.openings` is empty and `RIGHT_OPENINGS` holds `HOUSE_GARAGE_DOOR`. `HOME_WINDOW_HEAT_LANES.length` equals the sum of `openings.length` over `HOUSE_WALLS`, and the old under-garage expression in that check goes.
  - Task 3's lane-clearance check now measures against `HOUSE_GARAGE_DOOR`.
  - **Source check:** the right wall's skin and the room paint get `RIGHT_OPENINGS`, as the front wall's get `FRONT_OPENINGS`.
  - TS3b.4b's `SYSTEM_VIEW_WINDOW` indexes a `FRONT_WALL` window.
  - `HOUSE_GARAGE_DOOR` lies inside `GARAGE.z0..GARAGE.z1` with 0.3 m to spare on each side.
  - The steps' top equals `HOME_FLOOR_Y.raised`, every riser is at most 0.197, and every step box lies inside the garage body.
  - **Pitched gutter:**
    - its top lies under the garage fascia's bottom;
    - the downspout's top meets the gutter, and its bottom is at 0;
    - the existing "no downspout stands inside the garage" check holds.
  - **Flat:** the scupper crosses the garage's back parapet.
  - The house's downspouts are unchanged (`downspout`'s default `bottom`).
- [ ] **Step 2: Run, implement, run** the scene check, the lot check, and types and lint.
- [ ] **Step 3: Screenshots:**
  - Partly open on slab and raised: a door, not a window, in the kitchen's right wall.
  - Up close (ghost) on a raised house: the landing and steps through the faded garage.
  - Paint wear at Heavy: no sill dirt, streaks or peeling at the door.
  - Gutters on, off and worn, pitched and flat.
  - The front-right corner: the downspout.
- [ ] **Step 4: Commit:** `feat(trade-scenes): the kitchen has a door into the garage, and the garage drains through its own gutter`.

### Task 6: The garage's roof is laid with the house's covering (R140; spec §6)

**Files:**
- Create: `F/ui/components/home-kit/garage-roof.tsx`
- Modify:
  - `F/ui/components/home-kit/roof-covering.tsx`: `slopeLength`.
  - `F/lib/garage-boxes.ts`
  - `F/types.ts`: `GarageSlopeFrame`, `GarageBoxes`.
  - `F/ui/components/home-kit/garage.tsx`
  - `F/ui/components/home-kit/home-kit.tsx`
  - `scripts/verify-trade-scene.ts`: TS3b.4b's R120 covering check.
- Test: `scripts/verify-trade-scene-lot.ts`, `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - **`RoofCovering`** gains `slopeLength?: number`, defaulting to `SLOPE_LENGTH`. The area's `xTo` becomes `slopeLength + COVERING_BASE * Math.tan(HOUSE.pitch)`. The house's call sites pass nothing, and the house is unchanged. `slopeLength` joins the courses' `useMemo` deps beside `layout`.
  - **`interface GarageSlopeFrame { face: 'front' | 'back', position: Vec3, rotationY: number, zFrom: number, zTo: number, layout: readonly [number, number], slopeLength: number }`**: the same frame `RoofSlope` uses (x eave to ridge, y the roof normal, z along the ridge), placed so the courses lie on the deck: the frame's y = 0 is `COVERING_BASE` below the deck's top face, as `RoofSlope` puts the rafter line `COVERING_BASE` under the courses (`roof-slope.tsx:88,118`). 6-A's deck boxes are 0.09 m thick (`GARAGE_GABLE.thickness`, `garage-boxes.ts:38`) against `COVERING_BASE` = 0.04, so a frame copied from `RoofSlope`'s origin would bury the courses in the deck. `layout` is `[zFrom, zTo]`, built once at module level, because `RoofCovering` re-lays its courses whenever it gets a new array.
  - **`GARAGE_SLOPE_FRAMES: readonly GarageSlopeFrame[]`** in `garage-boxes.ts`: two frames, front and back. `slopeLength = (GARAGE.z1 − GARAGE.z0) / 2 / cos(HOUSE.pitch)`, and `zFrom..zTo` span the garage from `GARAGE.x0` to its outer rake, in each slope's own z.
  - **`GarageBoxes` gains:**
    - `ridge`: the cap, in the covering's colour, like the house's unvented ridge;
    - `seams`, `patches`: the flat membrane's laps at `LOW_SLOPE.seamSpacing`, and its patches.

    The 6-A `slopes` stay as the deck the courses lie on, drawn in the deck colour (`GarageRoof` takes it from `HOME_PALETTE`, as the house's deck is coloured).
  - **`GarageRoof({ form, covering: PartState, shingleTone: string | null })`:**
    - **pitched:** for each frame, `<RoofCovering material wear zFrom zTo layout={frame.layout} seed slopeLength newTone={shingleTone} />` inside the frame's group turned by `HOUSE.pitch`, plus the ridge cap. The seeds differ from the house's 7 and 19.
    - **flat:** the membrane in `COVERING_COLORS` worn by `covering.wear`, with `wornValue(0.75, 0.95, wear)` roughness as in `LowSlopeRoof`, plus the seams, and the patches once `wear >= WEAR_AMOUNT.worn`.
    - the ridge cap and the flat membrane take their colour from `coveringTone(covering.material, flat ? 'membrane' : 'shingle', covering.wear, shingleTone)` (`F/ui/lib/covering-tone.ts:7`): it is already the covering's flat colour with the house's fallbacks, so it stays, with its lot checks;
    - the covering pieces sit under the garage's `thermalTag('roof')` group (Task 4) and TS3b.4b's `systemPartTag('covering')`, so the Roof & gutters view lights them with the house's covering;
    - `RoofCovering` carries `BLUEPRINT_OMIT_TAG` itself (`roof-covering.tsx:69`), so the garage's courses stay out of the blueprint, as the house's do; its deck, ridge and membrane stay in.
  - **`Garage`'s props** lose `roofTone` and gain `covering` and `shingleTone`. HomeKit passes the covering part and `shingleTone` instead of `coveringTone(…)`.

- [ ] **Step 1: Write the failing checks:**
  - Each frame's eave end lies on the garage's eave, and its ridge end within 0.02 m of `garageGableApexY`.
  - The two frames' z-spans together cover `GARAGE.x0` to the outer rake.
  - The flat seams lie inside the membrane's footprint.
  - **The courses lie on the deck:** in each frame, the covering's base (`COVERING_BASE`) is at or above the deck box's top face, within 0.005 m.
  - The house's `RoofCovering` calls pass no `slopeLength` (source check).
  - **TS3b.4b's R120 check** ("exactly one component draws the roof covering, mounted once, by the house"; find it by its message) becomes: `roof-covering.tsx` is the only covering component, mounted by `roof-slope.tsx` and by `garage-roof.tsx`, and nowhere else.
  - **Where the house's rake meets the garage roof (slab house):** the house roof and its front gutter run to x = `ROOF_HALF_LENGTH` (6.3, `gable-roof.tsx:76`), and the garage roof starts at `GARAGE.x0` (6.0), at about the same eave height on slab. Check that no garage course or gutter box overlaps a house covering or gutter box in that band within 2 mm (coplanar faces flicker); if they do, the garage's pieces start at the house's rake end on slab.
  - The 6-A "one plain colour" lot checks are replaced by these, found by their messages.
- [ ] **Step 2: Run, implement, run** the lot check, the scene check, and types and lint.
- [ ] **Step 3: Screenshots,** opening view and the front-right corner:
  - shingle new and worn; a tear-off to cool shingle in a picked colour; tile; wood shake;
  - flat membrane worn, and cool;
  - Thermal, Summer: the garage roof paints as the house's roof does;
  - slab, front-right, close: the seam between the house's rake and the garage roof, no flicker while orbiting;
  - mid-blueprint: the garage's deck in the blueprint, its courses not;
  - TS3b.4b's Roof & gutters view: the garage covering is lit and the rest of the garage faded.
- [ ] **Step 4: Probe** `perf.mjs default t6 tile`, and record draws and triangles against `BASE` in the ledger. Over +60k triangles on tile, stop and report.
- [ ] **Step 5: Commit:** `feat(trade-scenes): the garage's roof is laid course by course with the house's own covering`.

### Task 7: No house arrow draws over the garage (spec §5.5)

**Files:**
- Modify: whatever the chosen method needs. Expect `F/constants/home-heat-lanes.ts`, `F/ui/components/home-kit/home-kit.tsx` and the `HeatArrows` call. Name the files in the ledger, and take any claim they need, before the first edit.
- Test: screenshots, plus a pure check if the method allows one.

**Interfaces:**
- Produces: from any camera the orbit and pan limits allow (`HOME_ORBIT`, `homePanBox`), Partly open, no house lane draws over the garage's roof or walls. The garage's own lanes still show, and the Complete set is unchanged.
- The method is the builder's (spec §12): depth testing against the garage, trimming the lanes, or draw order. Record the choice and its reason in the ledger.
  - If it trims lanes, add a pure check that no lane point lies inside the garage's footprint above its roof.
  - If it uses depth or draw order, the shots are the proof.
  - Trap: the open set's `HeatArrows` draws with no depth test today (`home-kit.tsx:290`). Turning depth testing on against the whole garage would also hide the garage's own lanes, whose `outside` points lie inside the garage's solid body.

- [ ] **Step 1: Shots before** (the failing state): Partly open, Thermal, Summer, pitched and flat. Four cameras, each at `HOME_ORBIT.maxDistance` and the lowest `maxPolarAngle`, panned to the limits of `homePanBox`: high front-right, high back-right, front-left, high front. Expected: the back-wall rows over the garage roof from the high front-right camera.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Shots after,** the same four cameras. Expected: nothing over the garage, every inside lane still showing through the open front, the garage's lanes still showing at the shared wall.
- [ ] **Step 4: Run** the scene check, then types and lint. **Commit:** `fix(trade-scenes): no house arrow draws over the garage from any camera the rep can reach`.

### Task 8: Paint wear on the garage, and the sunny wall follows the bearing (R121, R142; spec §8)

**Files:**
- Create: `F/lib/sunny-wall.ts`, `F/lib/sunny-wall-readings.ts` (one function per file, the glossary's "sunny wall")
- Modify:
  - `F/constants/home-lot.ts`: `GARAGE_WALLS`, beside `GARAGE` (wall records live in constants, as `HOUSE_WALLS` does).
  - `F/ui/components/home-kit/garage.tsx`
  - `F/constants/home-anchors.ts`
- Test: `scripts/verify-trade-scene.ts`, `scripts/verify-trade-scene-lot.ts`

**Interfaces:**
- Consumes: paint wear's placement functions, `PaintMarks`, `PaintStains` and `PaintLook.paintWear`, as re-read in Before Task 1; `facesSummerSun`, `weatherSunDirection`.
- Produces:
  - **`GARAGE_WALLS: Readonly<Record<'front' | 'right' | 'back', HouseWall>>`.** Each wall's outer face (`line + outward × HOUSE.wallThickness / 2`) is the garage body's face. `openings` is `[{ along: <the car door's centre along the front wall>, width: GARAGE.door.width, sill: 0, head: GARAGE.door.height }]` on the front and empty elsewhere (the car door is a door; paint wear's sill marks find no window there). The shared wall is the house's, so the garage has no wall there.
  - **The garage's marks:** `Garage` builds its cracks, stains, peeling and fade blotches with paint wear's functions on `GARAGE_WALLS`:
    - floor `HOME_FLOOR_Y.slab`, base 0 (grade), top `GARAGE.wallTop`;
    - the house's `paint.paintWear` levels and `paint.wear`;
    - `sunlit` from `facesSummerSun`;
    - seeds distinct from the house's.

    They're memoized on the levels, and drawn through `PaintMarks` and `PaintStains`, so the hide-under-Thermal rule comes with them.
  - **`sunnyWall(sun: readonly [number, number]): HouseWall`** (the same dot `facesSummerSun` takes, `faces-summer-sun.ts:7`): of `HOUSE_WALLS.left`, `HOUSE_WALLS.back` and `FRONT_WALL`, the one whose outward direction has the largest dot with `sun`. The right wall never counts: the garage covers it.
  - **`sunnyWallReadings(wall: HouseWall): { 'exterior-wall': Vec3, 'window': Vec3 }`:**
    - `exterior-wall` sits at along `wall.to − 0.6`, `HOUSE.floorY + 0.55`, `HOUSE.wallThickness / 2 + 0.05` out;
    - `window` sits at `wall.openings[0]`'s along (openings are windows only, Task 5), `HOUSE.floorY + 1.15`, `HOUSE.wallThickness / 2` in.

    `READING_ANCHORS` takes both from `sunnyWallReadings(sunnyWall(<summer sun's x, z>))`, replacing `EXTERIOR_WALL_READING` and `WINDOW_READING`. Their `READING_CALLOUTS` offsets follow the wall: they point away from the house on whichever wall is sunny (today's offsets on the left wall). The Controls build aims its walls and windows cameras at `READING_ANCHORS`, so at the default bearing they don't move either.

- [ ] **Step 1: Write the failing checks:**
  - **`GARAGE_WALLS`:**
    - each outer face equals the garage body box's face;
    - the front's opening is the door;
    - at every kind on `heavy` each wall gets marks, and at `none` none;
    - each list at a lower share is a prefix of the list at a higher share.
  - **`sunnyWall`:** (−1, 0) → left; (0, −1) → back; (0, 1) → `FRONT_WALL`; (1, 0) → never the right wall.
  - **Default anchors and callouts:** at the default bearing they equal the values recorded Before Task 1 (today's `EXTERIOR_WALL_READING` and `WINDOW_READING` as computed; the window's x is −5.84), so nothing moves on screen.
  - At each other sunny wall, both callouts point away from the house.
- [ ] **Step 2: Run, implement, run** the checks, then types and lint.
- [ ] **Step 3: Screenshots:**
  - Cracks, Stains and Peeling at Heavy, and at None: the garage wears as the house does, and Thermal hides its marks.
  - The default bearing's pins: unmoved against `BASE`.
  - One throwaway local edit of `frontBearing` to 0, shot and reverted, never committed: the wall pin on the sunny wall.
- [ ] **Step 4: Commit:** `feat(trade-scenes): the garage's walls wear like the house's, and the sunny wall's readings follow the house's bearing`.

### Task 9: Budget, stills, and the owner's set (spec §9)

**Files:**
- Modify: `F/constants/home-scene-stills.ts` and the still images it names, only if the garage now looks different in them.
- Records: the ledger, and the perf JSON.

- [ ] **Step 1: Probe** `perf.mjs` for default and worst, flat and tile, labelled `after`. Compare with `BASE`:
  - flat: draws within +17 and triangles within +23.5k;
  - tile: triangles within +60k;
  - no new textures.

  Over budget, stop and report the counts with the biggest new meshes. Don't trim unasked.
- [ ] **Step 2: Fallback stills.** Regenerate them the way 6-A's Task 8 did (its ledger at `.superpowers/sdd/2026-11-01-ts3b6a-lot-and-light/progress.md` names the script), only if the garage's roof or gutter changed them. Decide here whether the fallback lists the garage pin (Task 4): only if the garage is in the still's frame.
- [ ] **Step 3: The owner's set,** at 1280 × 800 and 1194 × 834:
  - opening view in the four weathers, Thermal on and off, pitched and flat;
  - Partly open, Summer and Winter, Thermal;
  - up close on the roof (the garage covering lit);
  - a raised house;
  - a tear-off with its vents;
  - Heavy paint wear.

  Hand them over, with the working numbers the owner tunes (R43):
  - the garage figures;
  - the three garage effects;
  - `GARAGE_WALL_FLOW_PER_F`;
  - the vents' effect, and the R201 case where the fan idles because of them (coastal Summer, cool roof, radiant barrier and fan: 96.4 against 84.4 °F without vents);
  - `GARAGE_STORM_RISE_F`;
  - the approved build figures Task 1 moved (old → new, from the ledger);
  - that the garage's lanes barely shrink with the upgrades: a lane always draws at least one arrow, so the coastal garage lane changes only speed.

  The owner checks a camera slide on the iPad in all four weathers.
- [ ] **Step 4:** The controller updates the tracker's TS3b.6 row (unstaged). After the owner's review, delete this plan, the spec and the TS3b.6 spec when TS3b.6 ships, as CLAUDE.md asks.
