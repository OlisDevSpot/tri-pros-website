# Home Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A super-admin lab page, `/dashboard/labs/trade-scene`. It shows a lived-in, profile-driven home that zooms into the roof-and-attic layers, with Summer / Winter / Rain, a FLIR-style thermal camera with °F readings, residents who react to comfort, and the savings.

**Architecture:** The pure construction model gains climate readings, a rain walk, per-weather modes, wood shake and the cool-roof add-on. Scene primitives gain an inputs store, a camera rig, pins, a thermal scale, rain, animated figures and bursts. The trade scene composes them: one `resolveScene(inputs)` feeds a home kit, the `roof-attic` assembly kit at the `roof` anchor, and the DOM panel.

**Tech Stack:** Next.js 15, React 19, three 0.180, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, @react-three/postprocessing 3.2.0, zustand 5, zod, tRPC, Tailwind v4, shadcn.

**Spec:** `docs/superpowers/specs/2026-10-16-home-scene-design.md`, built on `docs/superpowers/specs/2026-10-15-3d-presentation-scenes-and-assembly-cutaway-design.md` (the foundation spec). Requirements register: `docs/plans/2026-10-16-trade-scenes-epic.md` §3 (R1–R32).

## Global Constraints

- **Worktree and branch:**
  - Worktree: `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/trade-scenes`, branch `feat/trade-scenes-foundation`.
  - Dev port: 3005, from `.env.local`.
  - Never `cd` to the main checkout. Never use `git -C`.
- **Verification:**
  - `pnpm tsc` and `CI=1 pnpm lint`. **Never `pnpm build`.**
  - Scripts are linted with `CI=1 pnpm exec eslint <files>`.
  - If tsc complains about route types, run `pnpm exec next typegen`.
- **Tests:**
  - Pure logic is proved by `tsx` assertion scripts (`pnpm tsx scripts/<name>.ts`). There is no test runner, and adding one is out of scope.
  - UI is proved by Playwright screenshots in our own browser. Auth: `http://localhost:3005/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET>&role=super-admin&redirect=<path>`.
- **Commits:**
  - By explicit path (`git add -- <paths>`), then check `git diff --cached --stat`.
  - Never `git add -A`, stash, reset, `checkout --`, `--amend` or push.
  - Messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - After any scripted edit, run `git diff --shortstat -- <file>`. A whole-file diff means CRLF flipped; fix it.
- **No DB writes. Notion is read-only.**
- **Code rules:**
  - One component per file.
  - File-level constants in `constants/`, hooks in `hooks/`, contexts in `contexts/`.
  - Named exports (pages and layouts excepted).
  - Comments say why, never what. No banners. Never cite plans, specs, tasks or R-ids in code.
- **Vocabulary** (`CONTEXT.md` § Trade scene terms):
  - Use: home kit, assembly kit, anchor, weather, climate, readings, comfort, residents, burst, thermal camera, part, part condition, existing conditions, proposed build.
  - Never use in new code: "experience", "visualization", "variant", "section kit", "condition" for weather, "layer" for a part, or "Tri Pros build" (screen copy only).
- **Tiers and imports:**
  - `src/shared/components/scene/` imports nothing from `@/shared/modules/construction`.
  - `src/shared/modules/construction/core/` imports no three.js. ESLint enforces both.
  - three.js loads only through `next/dynamic(() => import(...).then(m => m.X), { ssr: false })`.
- **Never touch** `src/features/meeting-visualizations/` or `/dashboard/labs/roof-cutaway` (the frozen reference) or `/dashboard/labs/cutaway-look`. Read the reference; never import it.
- **Placeholders stay labelled.** Every °F constant, the solar gain, the radiant barrier's winter reflectance and the cool-covering reflectances carry a one-line comment that they are working numbers to be sourced before release.
- **Copy:** never "your" unless the basis is `recorded`. Never mention solar. Savings are estimates with an asterisk popover.
- **Renderer: WebGL only.** No WebGPU paths in new code.
- **Assets:** CC0 only, under `public/scenes/home/`, each recorded in `public/scenes/LICENSES.md`. Budget: home kit GLB + textures ≤ 4 MB, at most 5 animated figures.
- **Rendering:** stays `frameloop="demand"`. Life runs only inside a burst (~10 s after the last input), then the scene stops drawing.

## Review Focus

1. **Unknown profile fields.** Every `PropertyProfile` field and the household may be null. The home must still draw (slab, central HVAC, single glazing, a neutral couple, era fallback) and copy must fall back to "typical" wording. Pinned in Task 9's script (an all-null input resolves and casts two adults).
2. **Flat roof with insulation unknown.** A low-slope home with no recorded insulation draws no batts, and its readings still compute through the joist space. Pinned in Task 2's script and Task 4's readings grid.
3. **Cool roof off with a roof scope previewed.** The covering stays standard, the roof energy cut is 0, and the readings show no cool-roof effect. Pinned in Task 3 (model and ROI) and Task 9 (scene targets).
4. **A weather the zoomed assembly doesn't support.** The home renders that weather while the kit shows its sky with no flow and the panel says so. Pinned in Task 9 (targets carry `mode: null`) and checked by Task 18's stub kit.
5. **An asset fails to load mid-meeting** (offline, 404, decoder error). Code-built stand-ins draw and nothing throws past the canvas. Pinned in Task 8 (a forced-404 page check) and Task 18's screenshots.

---

## Phase A: Construction model (pure)

### Task 1: Weather, per-weather modes, cavity readings config, edge parts, profile additions

**Files:**
- Modify: `src/shared/modules/construction/core/types.ts`
- Modify: `src/shared/modules/construction/core/constants/assemblies/{roof-attic,crawl-space,exterior-wall,yard-ground,hvac-attic}.ts`
- Modify: `scripts/verify-construction-model.ts`
- Modify: every `PropertyProfile` literal that tsc flags (the verify script's `profile()` helper, look-dev constants, if any)

**Interfaces:**
- Produces, in `core/types.ts`:
  - `export type Weather = 'summer' | 'winter' | 'rain'`
  - `Assembly.modes: Partial<Record<Weather, EnergyMode>>` replaces `energyMode`.
  - `Assembly.readings?: { outerGroup: string }`: parts whose `group` equals `outerGroup` lie between outside and the cavity air; the rest lie between the cavity and inside. Absent means no cavity.
  - `PartDefinition.edge?: true`: an edge fitting that collects shed water rather than sitting in the rain path.
  - `PropertyProfile` gains `windowsType: WindowsType | null` and `hvacComponents: HVACComponent | null` (types from `core/constants/enums.ts`).
- Values:
  - `roof-attic`: `modes: { summer: 'thermal', winter: 'thermal', rain: 'water' }`, `readings: { outerGroup: 'roof' }`, `edge: true` on `drip-edge` and `gutter`.
  - `yard-ground`: `{ summer: 'water', rain: 'water' }`.
  - `crawl-space`, `exterior-wall`, `hvac-attic`: `{ summer: 'thermal', winter: 'thermal' }`.

- [ ] **Step 1:** Change the verify script's three `energyMode === 'thermal'` checks to `modes.summer === 'thermal'` (and `yard-ground` to `modes.rain === 'water'`). Add these assertions:
  - every assembly has at least one mode;
  - `roof-attic` has `modes.rain === 'water'` and `readings.outerGroup === 'roof'`;
  - exactly `drip-edge` and `gutter` are `edge` in `roof-attic`.
- [ ] **Step 2:** Run `pnpm tsx scripts/verify-construction-model.ts`. Expected: FAIL (type errors or the missing `modes` property).
- [ ] **Step 3:** Make the type and data changes above. Fix every tsc-reported `PropertyProfile` literal by adding `windowsType: null, hvacComponents: null`.
- [ ] **Step 4:** Run `pnpm tsx scripts/verify-construction-model.ts`, then `pnpm tsc`, then `CI=1 pnpm lint`. Expected: all pass.
- [ ] **Step 5:** Commit: `refactor(construction): assemblies carry a mode per weather, a readings cavity and edge fittings; the profile records windows and HVAC components`.

### Task 2: Wood shake and the deck a new covering needs

**Files:**
- Modify: `src/shared/modules/construction/core/types.ts`
- Modify: `core/constants/assemblies/roof-attic.ts`
- Modify: `core/constants/roof-attic-inference.ts`
- Modify: `core/lib/assemblies/roof-attic/infer-existing-conditions.ts`
- Modify: `core/lib/resolve-assembly.ts`
- Modify: `scripts/verify-construction-model.ts`

**Interfaces:**
- Produces:
  - `PartMaterialDefinition.needsBase?: { part: string, replaces: readonly string[], with: string, copy: PartCopy }`. When this material is installed and the named part's current material is in `replaces`, the resolver also installs `with` on that part and uses `copy` for its label and detail. This is data, so the resolver stays assembly-agnostic.
  - `roof-attic` covering material `'wood-shake'`:
    - `forms: ['pitched']`
    - `copy: { label: 'Wood shakes', detail: 'Split cedar shakes laid in overlapping courses.' }`
    - `conditionCopy.worn: { label: 'Dried, split shakes', detail: 'They curl, split and catch embers; many insurers will not cover them.' }`
    - `thermal: { rValue: 0.97, reflectance: 0.1 }`
  - `needsBase` on `shingle`, `cool-shingle` and `tile`: `{ part: 'deck', replaces: ['spaced-boards'], with: 'plywood', copy: { label: 'New solid decking, needed for the new roof', detail: 'Shingles and tile cannot be fastened to spaced boards, so solid decking goes down first.' } }`.
  - Inference changes:
    - `COVERING_BY_ROOF.woodshake = 'wood-shake'`;
    - `NEAREST_DRAWN_ROOFS = ['metal']`;
    - on a `flat` roof with `insulationLevel === null`, `attic-insulation` is `{ material: null, condition: 'absent' }` (no era guess under a flat roof).

- [ ] **Step 1:** Add these assertions:
  - a recorded wood-shake profile (`roofType: 'woodshake'`, `yearBuilt` and `insulationLevel` set) infers covering `wood-shake`, deck `spaced-boards`, basis `recorded`;
  - for every roof type, previewing the tear-off scope `bd60ca1b-548b-821d-bd96-011624aa0fbb` never yields `covering ∈ {shingle, cool-shingle, tile}` with `deck = spaced-boards`;
  - on a wood-shake home, that tear-off yields deck `plywood`, condition `installed`, label `'New solid decking, needed for the new roof'`;
  - a flat profile with `insulationLevel: null` has `attic-insulation` absent, and with `insulationLevel: 'low'` has `batts-r11`;
  - the existing `'metal' → 'shingle'` assertion still holds.

  Delete the old `woodshake → shingle` expectation.
- [ ] **Step 2:** Run the script. Expected: FAIL on the wood-shake covering.
- [ ] **Step 3:** Implement the data, the inference changes, and the `needsBase` pass in `resolveAssembly`. The pass runs after collecting `installed`. For each installed material with `needsBase`, read the target part's material (installed, else existing). If it is in `replaces`, set `installed[part] = with` and remember the override copy for that part.
- [ ] **Step 4:** Run the script, `pnpm tsc` and `CI=1 pnpm lint`. Expected: pass.
- [ ] **Step 5:** Commit: `feat(construction): wood shakes draw as themselves, and a new roof over spaced boards brings its solid deck`.

### Task 3: The cool roof add-on in the model and the ROI calculator

**Files:**
- Modify: `core/constants/bill-cut-add-ons.ts`
- Modify: `core/constants/trade-bill-cuts.ts`
- Modify: `core/constants/scope-installs.ts`
- Modify: `core/types.ts`
- Modify: `core/lib/resolve-assembly.ts`
- Modify (ROI): `src/features/calculators/remodel-roi-calculator/{schemas/form.ts,constants/form-defaults.ts,lib/project-remodel-roi.ts,lib/story/build-basis.ts,ui/components/inputs-panel/trade-row.tsx,ui/components/inputs-panel/trades-section.tsx,ui/components/story/assumptions-sheet.tsx}`
- Modify: `scripts/verify-remodel-roi.ts`, `scripts/verify-construction-model.ts`
- Scratch (never committed): `$SCRATCH/roi-snapshot.ts`, copied from `.superpowers/sdd/2026-10-15-trade-scenes-foundation/roi-snapshot.ts`

**Interfaces:**
- Produces:
  - `BILL_CUT_ADD_ON_IDS = ['ducts', 'cool-roof'] as const`, with `BILL_CUT_ADD_ON_LABELS['cool-roof'] = 'Cool roof'`.
  - `TRADE_BILL_CUTS['roof-and-gutters'] = { base: {}, addOns: { 'cool-roof': { electric: 8 } } }`.
  - Install entries become `{ part: string, material: string, swapsWith?: Partial<Record<BillCutAddOnId, string>> }`.
    - `SHINGLE_ROOF`'s and "Roof overlay"'s covering: `swapsWith: { 'cool-roof': 'cool-shingle' }`.
    - "Roof torch down": `swapsWith: { 'cool-roof': 'cool-membrane' }`.
    - Tile: none.
  - `resolveAssembly(assembly, { existing, proposedScopeIds, view, addOns = [] }, installs?)`: an install's material becomes `swapsWith[addOn]` for the first active add-on that names one.
  - ROI form: `trades['roof-and-gutters']: z.object({ coolRoof: z.boolean(), current }).nullable()`. `createTradePicks()` sets `coolRoof: true`. The projection passes `addOns: [...(ducts ? ['ducts'] : []), ...(coolRoof ? ['cool-roof'] : [])]`.
  - ROI UI: a "Cool roof (reflective)" checkbox in the roof row (the "New ducts too" pattern), and a cool-roof cut line in the basis and the assumptions sheet (the ducts lines' pattern). The trades-section note drops "cool roof," from its "assume the energy-efficient version" list.

- [ ] **Step 1:** Before any edit, copy the snapshot script into SCRATCH, run it, and save `roi-snapshot-before.txt`. Update its fixed inputs so the roof trade carries `coolRoof: true` after this task. Keep a key-name map in the scratch script only.
- [ ] **Step 2:** Add assertions.
  - In `verify-construction-model.ts`:
    - tear-off with `addOns: []` installs covering `shingle`, and with `['cool-roof']` installs `cool-shingle`;
    - "Roof torch down" on a flat home with `['cool-roof']` installs `cool-membrane`;
    - tile reset ignores the add-on.
  - In `verify-remodel-roi.ts`: with roof chosen and `coolRoof: false`, the electric cut has no roof or cool-roof part; with `coolRoof: true`, the combined electric cut equals the pre-change value for the same inputs.
- [ ] **Step 3:** Run both scripts. Expected: FAIL.
- [ ] **Step 4:** Implement. Every `Record<BillCutAddOnId, …>` and `CUT_SOURCE_LABELS` site tsc flags gets its `cool-roof` entry.
- [ ] **Step 5:** Run both scripts, `pnpm tsc`, `CI=1 pnpm lint`, then the scratch snapshot into `roi-snapshot-after.txt`. Diff the two. Expected:
  - every projected figure is identical;
  - the only differences are the roof part's `source` (`roof-and-gutters` → `cool-roof`) and the config dump's relocated `8`.
  Record the diff summary in the report.
- [ ] **Step 6:** Screenshot `/dashboard/calculators` (the ROI calculator with roof chosen) before and after. Expected: the new checkbox, ticked, and identical figures.
- [ ] **Step 7:** Commit: `feat(construction): cool roof is an add-on on Roof & gutters, the only path to roof energy savings; the ROI calculator ticks it by default`.

### Task 4: Climate presets, °F readings, and a barrier that acts in winter

**Files:**
- Create: `core/constants/climate-presets.ts`, `core/lib/thermal-walk.ts`
- Modify: `core/constants/flow-model.ts` (delete `FLOW_ENDS`; keep `SURFACE_FILM_R_VALUE` and `DRAWING_REFERENCE_R_VALUE`)
- Modify: `core/lib/relative-heat-flow.ts`, `core/types.ts`
- Modify: `core/constants/assemblies/roof-attic.ts` (barrier `winterReflectance`)
- Modify: `scripts/verify-construction-model.ts`

**Interfaces:**
- Produces (`core/constants/climate-presets.ts`):
  - `CLIMATES = ['coastal', 'inland'] as const`, `type Climate`, `CLIMATE_LABELS = { coastal: 'Coastal', inland: 'Inland' }`.
  - `CLIMATE_PRESETS: Record<Climate, Record<Season, { outside: number, setpoint: number }>>`: coastal summer 82/76, inland summer 100/76, coastal winter 45/70, inland winter 38/70.
  - `SOLAR_GAIN_F = 80`: a black surface's rise over air at a summer peak.
  - `NIGHT_SKY_DROP_F = 5`, `OUTSIDE_FILM_R = 0.25`, `INSIDE_FILM_R = 0.68`, `CAVITY_VENT_R = 2.2`.
  - `THERMAL_SCALE_F = { min: 20, max: 180 }`.
  - Each value carries a "working number, sourced before release" comment.
- Produces (`core/types.ts`):
  - `thermal.winterReflectance?: number` on `PartMaterialDefinition` and `ResolvedPart`. The radiant barrier `foil` gets `winterReflectance: 0.2`.
  - `ThermalReadings = { outerSurface: number, cavityAir: number | null, innerSurface: number }` (°F).
  - `ThermalWalk = { readings: ThermalReadings, faces: Record<string, { inner: number, outer: number }> }` (°F).
- Produces (functions):
  - `thermalWalk(assembly: Assembly, parts: ResolvedPart[], season: Season, climate: Climate): ThermalWalk` (same argument order as `relativeHeatFlow`).
  - `relativeHeatFlow(assembly: Assembly, parts: ResolvedPart[], season: Season, climate: Climate): FlowProfile`: `boundaries` and `reflected` as today, but each part's reflectance is `reflectance` in summer and `winterReflectance ?? 0` in winter. `parts` = `thermalWalk` faces normalized by `THERMAL_SCALE_F` and clamped to 0..1.
- Algorithm (the signature doesn't determine it):
  ```
  r(p)      = present ? (rValue ?? 0) : 0;  refl(p) = present ? season reflectance : 0
  outer     = parts in assembly.readings.outerGroup (all parts when no cavity), inner = the rest
  T_src     = summer: outside + SOLAR_GAIN_F × (1 − refl(outermost present thermal part))
              winter: outside − NIGHT_SKY_DROP_F
  R_out     = OUTSIDE_FILM_R + Σ r(outer) ;  then R_out /= Π over outer parts except the outermost of (1 − refl)
  R_in      = Σ r(inner) + INSIDE_FILM_R
  cavity    = (T_src/R_out + setpoint/R_in + outside/CAVITY_VENT_R) / (1/R_out + 1/R_in + 1/CAVITY_VENT_R)
              (no cavity: one series path T_src → setpoint over R_out + R_in, cavityAir = null)
  outerSurface = T_src − (T_src − cavity) × OUTSIDE_FILM_R / R_out
  innerSurface = setpoint + (cavity − setpoint) × INSIDE_FILM_R / R_in
  faces     = linear in crossed R along each path (outer path T_src→cavity, inner path cavity→setpoint), parts walked inside → out as stored
  ```

- [ ] **Step 1:** Add assertions:
  - **Calibration:** a 1950–1978 shingle, R-11 inland summer existing build reads `outerSurface` in 160–180, `cavityAir` in 130–150, and `innerSurface` in 78–82.
  - **Monotonic:**
    - R-38 lowers `innerSurface` versus R-11;
    - `cool-roof` lowers `outerSurface`;
    - adding the radiant barrier lowers `cavityAir` in summer and raises it in winter;
    - inland is hotter than coastal in summer and colder in winter.
  - **Range:** every reading and face across roof type × era × view × climate × season lies within `THERMAL_SCALE_F`.
  - **Barrier in winter:** the barrier's winter reflected share is > 0 and < its summer share, and the winter final boundary with the barrier is below the one without it.
  - **Flat roof:** a flat profile with insulation unknown produces readings (`cavityAir` not null).
  - **Snapshot:** print the full readings grid at the end of the script (one line per case) for the report.

  Update the pinned ribbon widths: the summer values stay; recompute the winter "+ radiant barrier" value and pin it.
- [ ] **Step 2:** Run. Expected: FAIL (no `thermalWalk`).
- [ ] **Step 3:** Implement. Update every caller of `relativeHeatFlow` (the verify script only).
- [ ] **Step 4:** Run the script, `pnpm tsc`, `CI=1 pnpm lint`. Expected: pass.
- [ ] **Step 5:** Commit: `feat(construction): °F readings from a climate preset, and a radiant barrier that holds heat in winter`.

### Task 5: The rain walk

**Files:**
- Modify: `core/lib/relative-water-flow.ts`, `core/types.ts`, `core/constants/flow-model.ts`
- Modify: `scripts/verify-construction-model.ts`

**Interfaces:**
- Produces:
  - `relativeWaterFlow(parts: ResolvedPart[], source: 'irrigation' | 'rain'): WaterFlow`, where `WaterFlow = FlowProfile & { shed: number, soaked: Record<string, number>, reachesInside: number }`.
  - `RAIN_WORN_SOAK = 0.4` in `flow-model.ts`.
  - **Irrigation** keeps today's behaviour, with `shed = 0`, `soaked = {}`, and `reachesInside` = the last boundary.
- Rain rule:
  - Walk outside → in over the non-`edge` parts, starting at demand 1.
  - A present part with role `surface` or `shed-water` that is `retained` or `installed` stops everything left; that amount adds to `shed`. A `worn` or `absent` one passes it all.
  - Any other `worn` part soaks `RAIN_WORN_SOAK` of what reaches it (recorded in `soaked[partId]`) and passes the rest.
  - Other parts pass everything.
  - `reachesInside` = what passes the innermost part.

- [ ] **Step 1:** Add assertions:
  - the 1950–1978 shingle existing build in rain has `reachesInside > 0` and `soaked.deck > 0`;
  - every proposed re-roof scope (tear-off, overlay, torch-down on flat, tile reset) gives `shed === 1` and `reachesInside === 0`;
  - redeck alone under worn shingles gives `reachesInside > 0` and `soaked.deck` undefined (the new deck does not rot);
  - the two existing yard assertions now call `relativeWaterFlow(parts, 'irrigation')`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the script, `pnpm tsc`, `CI=1 pnpm lint`. Expected: pass.
- [ ] **Step 5:** Commit: `feat(construction): rain finds worn coverings, soaks a worn deck and reaches the ceiling; a new roof sheds it all`.

## Phase B: Scene primitives

### Task 6: Scene inputs store and bursts

**Files:**
- Create: `src/shared/components/scene/lib/create-scene-inputs.ts`
- Create: `src/shared/components/scene/contexts/scene-inputs-context.ts`
- Create: `src/shared/components/scene/hooks/use-scene-burst.ts`
- Create: `src/shared/components/scene/constants/scene-burst.ts`
- Modify: `src/shared/components/scene/constants/scene-motion.ts` (only if a burst timing token belongs there)
- Test: `scripts/verify-scene-inputs.ts`

**Interfaces:**
- Produces:
  - `createSceneInputs<T extends object>(defaults: T): StoreApi<T>`: a zustand vanilla `createStore`, one per open scene.
  - `SceneInputsProvider<T>` and `useSceneInputs<T, S>(selector: (state: T) => S): S` (with `useStore`), plus `useSceneInputsApi<T>(): StoreApi<T>` for writes. The context holds the store, never its state.
  - `SCENE_BURST = { seconds: 10 } as const`.
  - `useSceneBurst(key: string): number`, called inside the canvas:
    - while fewer than `SCENE_BURST.seconds` have passed since `key` last changed, it calls `invalidate()` every frame and returns burst progress (0 → 1);
    - after that it returns 1 and stops invalidating;
    - under reduced motion it returns 1 immediately and never loops.
    The caller builds `key` from its inputs (e.g. `JSON.stringify` of the inputs that matter).

- [ ] **Step 1:** Write `scripts/verify-scene-inputs.ts`:
  - two stores from `createSceneInputs({ a: 1 })` are independent (`setState` on one leaves the other at 1);
  - `getState()` after `setState({ a: 2 })` is 2.
- [ ] **Step 2:** Run it. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement the store, provider and hooks, and `useSceneBurst` (clock read via `useFrame` state, one ref for the last key and its start time). Also fix the foundation carry-over in `hooks/use-eased.ts`: once a value has settled and its target is unchanged, `apply` is not called again on later frames. Add a settled ref that the target-key effect clears. Today settled ribbons re-apply their widths on every frame while mounted.
- [ ] **Step 4:** Run the script, `pnpm tsc`, `CI=1 pnpm lint`. Expected: pass.
- [ ] **Step 5:** Commit: `feat(scene): a per-open scene inputs store and bursts that wake the scene, then let it rest`.

### Task 7: Camera rig, pins and the thermal scale

**Files:**
- Create: `src/shared/components/scene/ui/camera-rig.tsx`
- Create: `src/shared/components/scene/ui/scene-pins.tsx`, `src/shared/components/scene/ui/scene-anchor.tsx`
- Create: `src/shared/components/scene/contexts/scene-pins-context.ts`
- Create: `src/shared/components/scene/ui/thermal-scale-bar.tsx`
- Create: `src/shared/components/scene/lib/normalize-on-scale.ts`
- Modify: `src/shared/components/scene/types.ts`

**Interfaces:**
- Produces:
  - `type CameraFraming = { position: [number, number, number], target: [number, number, number], fov: number }`.
  - `<CameraRig framing={CameraFraming} orbit={{ minDistance, maxDistance, maxPolarAngle }} />`: eases position, target and fov with `useEased` on `SCENE_MOTION` timing whenever `framing` changes, and wraps drei `OrbitControls` (pan off, damping on). It adapts to portrait by widening fov from the canvas aspect: `fov / min(1, aspect / (4/3))`.
  - `<SceneAnchor id: string position: [number, number, number] />` registers into `ScenePinsContext`. `<ScenePins render={(id: string) => ReactNode} visible={(id) => boolean} />` is a DOM overlay sibling of the canvas: it projects each registered anchor every rendered frame and writes `transform` on the pin element (no React re-render on orbit). The precedent is the reference's `pin-anchors.tsx` / `layer-pins.tsx`; port the approach, not the import.
  - `normalizeOnScale(value: number, scale: { min: number, max: number }): number`, clamped to 0..1.
  - `<ThermalScaleBar scale={{ min, max }} palette={readonly string[]} unit="°F" ticks={5} />`: a vertical DOM gradient with labelled ticks.

- [ ] **Step 1:** Implement all five. `normalizeOnScale` gets a three-line assertion added to `scripts/verify-scene-inputs.ts` (20 → 0, 180 → 1, 200 → 1).
- [ ] **Step 2:** Run the script, `pnpm tsc`, `CI=1 pnpm lint`. Expected: pass. (These are exercised visually in Tasks 12–16.)
- [ ] **Step 3:** Commit: `feat(scene): camera framings that glide, anchors projected to DOM pins, and a thermal scale bar`.

### Task 8: Rain, animated figures, and models that may fail

**Files:**
- Create: `src/shared/components/scene/ui/rain-field.tsx`
- Create: `src/shared/components/scene/ui/animated-figure.tsx`
- Create: `src/shared/components/scene/hooks/use-gltf-asset.ts`
- Create: `src/shared/components/scene/ui/asset-boundary.tsx`
- Create (throwaway, deleted in the same task): a scratch page under SCRATCH driven by Playwright, or a temporary route under `/dashboard/labs/trade-scene` created and removed within this task

**Interfaces:**
- Produces:
  - `<RainField box={[w, h, d]} position intensity={0..1} />`: instanced streaks falling inside the box. Intensity eases. It animates only while the parent's burst runs (prop `running: boolean`). With `running = false` or reduced motion, the streaks hold still.
  - `useGltfAsset(url: string): GLTF`: drei `useGLTF` with meshopt decoding (`useGLTF(url, true, true)`) and disposal on unmount.
  - `<AssetBoundary fallback={ReactNode}>`: an error boundary plus Suspense, so a failed or slow model renders `fallback` and never takes the canvas down.
  - `<AnimatedFigure url clip={string} palette={Record<string, string>} running={boolean} thermal?: { color: string } />`: plays `clip` with a 0.4 s crossfade on change, recolours materials by name from `palette`, and freezes on the current clip's rest frame when `running` is false. With `thermal`, every material becomes a `MeshBasicMaterial` of that colour (warm-body glow without a skinned thermal shader).

- [ ] **Step 1:** Implement the four.
- [ ] **Step 2:** Prove the failure path with a temporary page:
  - mount `<AssetBoundary fallback={<mesh/>}>` with `useGltfAsset('/scenes/home/missing.glb')`;
  - screenshot it;
  - confirm the stand-in draws and the console shows the 404 but no uncaught error.
  Delete the temporary page.
- [ ] **Step 3:** `pnpm tsc`, `CI=1 pnpm lint`. Expected: pass.
- [ ] **Step 4:** Commit: `feat(scene): rain, animated figures, and models that fall back to stand-ins when they cannot load`.

## Phase C: The trade scene

### Task 9: Scene inputs, `resolveScene`, casting, comfort and savings (pure)

**Files:**
- Create: `src/features/trade-scenes/constants/{home-scene-defaults.ts,comfort.ts,residents.ts,home-anchors.ts,assembly-kits.ts,home-scene-copy.ts}`
- Create: `src/features/trade-scenes/lib/{resolve-scene.ts,cast-residents.ts,comfort-from-readings.ts,scene-savings.ts}`
- Modify: `src/features/trade-scenes/types.ts`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: Tasks 1–5 (`resolveAssembly` with `addOns`, `thermalWalk`, `relativeHeatFlow(assembly, parts, season, climate)`, `relativeWaterFlow(parts, source)`, `Weather`, `Climate`), plus `combineCuts`, `cutFor`, `resolveTradeBillCuts`, `REPAIRS_PER_YEAR` and `resolveOverridable`.
- Produces (`features/trade-scenes/types.ts`):
  ```ts
  interface TradeSceneInputs {
    property: PropertyProfile
    household: { type: HouseholdType | null, ageGroup: CustomerAgeGroup | null }
    view: 'existing' | 'proposed'
    weather: Weather
    climate: Climate
    thermalCamera: boolean
    zoom: AssemblyId | null
    proposedScopeIds: string[]
    addOns: BillCutAddOnId[]
    peel: number
    emphasizedPart: string | null
    bills: Record<'electric' | 'gas', BillEntry>
    repairsOverrides: Partial<Record<TradeSlug, number | null>>
    look: { ribbonStyle: RibbonStyle }
  }
  type Comfort = 'strained' | 'fair' | 'comfortable'
  interface ResidentSpec { id: string, role: 'adult' | 'child', age: 'young' | 'middle' | 'senior' }
  interface AssemblyTargets {
    assemblyId: AssemblyId
    form: string | null
    basis: Basis
    parts: ResolvedPart[]
    mode: EnergyMode | null
    heat: FlowProfile | null
    water: WaterFlow | null
    walk: ThermalWalk | null
  }
  interface SceneTargets {
    assemblies: Partial<Record<AssemblyId, AssemblyTargets>>
    readings: ThermalReadings | null
    comfort: Comfort | null
    equipmentLoad: number            // 0..1
    meterSpeed: number               // 0..1
    leak: { reachesInside: number, soakedPartIds: string[] }
    residents: ResidentSpec[]
    savings: SceneSavings
    heading: { eyebrow: string, title: string, lead: string }
  }
  interface SceneSavings {
    category: 'electric' | 'gas' | null   // summer → electric, winter → gas, rain → null
    cut: BillCut | null
    repairsMonthly: number
    repairsByTrade: Partial<Record<TradeSlug, Resolved<number>>>
  }
  ```
- Values:
  - `HOME_SCENE_DEFAULTS: TradeSceneInputs` (all-null profile and household, existing, summer, inland, thermal off, no zoom, no scopes, no add-ons, peel 0, ribbon `stream`).
  - `COMFORT_GAP_F = { strained: 1.5, comfortable: 1.0 }`: comfort from `|innerSurface − setpoint|`, so `≥ 1.5` is strained and `≤ 1.0` is comfortable.
  - `HOME_ANCHORS: Record<'roof' | 'attic' | 'exterior-wall' | 'yard' | 'under-floor', { position: [n,n,n], framing: CameraFraming }>` (positions finalized in Task 12; seed values are allowed here).
  - `ASSEMBLY_KITS: Partial<Record<AssemblyId, { anchor: keyof typeof HOME_ANCHORS, weathers: readonly Weather[] }>> = { 'roof-attic': { anchor: 'roof', weathers: ['summer', 'winter', 'rain'] } }`. The component is attached in Task 15 through a separate lazy map, so this file stays three-free.
- Functions:
  - `resolveScene(inputs: TradeSceneInputs, cuts: TradeBillCuts): SceneTargets`.
  - `castResidents(household): ResidentSpec[]`:

    | Household | Cast |
    |---|---|
    | single | 1 adult |
    | couple | 2 adults |
    | family | 2 adults + 2 children |
    | relatives | 2 adults of the group's age + 1 senior (or + 1 middle when the group is senior) |
    | null | 2 middle adults |

    Age mapping: `under-25`/`25-45` → young, `45-65` → middle, `65-75`/`75-or-older` → senior, null → middle.
  - `comfortFromReadings(readings, setpoint): Comfort`.
  - `sceneSavings(...)`: trades = those with ≥ 1 previewed scope installing into the assembly; add-ons from inputs; the cut from `combineCuts` + `cutFor` for the weather's category; repairs from `REPAIRS_PER_YEAR` through `resolveOverridable`, ÷ 12 and rounded to whole dollars.
  - `meterSpeed`: `cut.after / cut.bill` when a bill is typed, else the heat flow's last boundary; 0 in rain.
  - `equipmentLoad`: the heat flow's last boundary; 0 in rain.
  - `heading`: eyebrow `'Roof & attic, x-rayed'`, plus the basis rules from the foundation:
    - title "What is above your ceiling" (`recorded`) / "What homes built {era} usually hide" (`era-typical`) / "What is above a typical ceiling" (`typical`);
    - lead line from `home-scene-copy.ts`.

- [ ] **Step 1:** Write `scripts/verify-trade-scene.ts` asserting:
  - **Criterion 1:** for every roof type × weather × climate × view × `addOns ∈ {[], ['cool-roof']}`, the targets' `readings`, `heat.parts` and `savings.cut` come from the same resolved parts. Recompute each independently from `resolveAssembly` and `deepEqual`.
  - **Criterion 2:** no `heading.title` contains "your" unless the basis is `recorded`.
  - **Comfort:** 1950–1978 shingle, R-11, inland summer existing is `strained`. The same with tear-off + "Attic insulation replacement" + "Radiant barrier installation" + `['cool-roof']` proposed is `comfortable`.
  - **Rain:** the existing build has `leak.reachesInside > 0` and `savings.category === null`; the proposed re-roof has `reachesInside === 0`.
  - **Cool roof off:** tear-off proposed with `addOns: []` has a summer cut with no roof part, and the covering is `shingle`.
  - **Casting:** an all-null input casts 2 adults; family/senior casts 2 senior adults and 2 children; relatives/senior has exactly one `middle`.
  - **Missing weather:** a stub `ASSEMBLY_KITS` entry without `rain` gives `mode: null` in rain (pass the registry as an optional parameter for the test).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the script, `pnpm tsc`, `CI=1 pnpm lint`. Expected: pass.
- [ ] **Step 5:** Commit: `feat(trade-scenes): one resolveScene feeds the home, the assembly kit and the panel, with residents, comfort and savings`.

### Task 10: CC0 assets and the owner's pick sheet

**Files:**
- Create: `public/scenes/home/*.glb`, `public/scenes/LICENSES.md`
- Create: `scripts/check-scene-assets.ts`
- Scratch: download area and pick sheet under SCRATCH

**Interfaces:**
- Produces: GLB files named for what they are (`resident-adult.glb`, `resident-child.glb`, `sofa.glb`, `bed.glb`, `kitchen.glb`, `tv.glb`, `condenser.glb`, `wall-unit.glb`, `window-unit.glb`, `bucket.glb`, `blanket.glb`, `fan-hand.glb` or equivalent). Characters must carry named clips covering idle, sit, fan-self (or wave), shiver (or hug-self) and look-up. `LICENSES.md` has one row per file: source URL, author, licence.
- `scripts/check-scene-assets.ts`: sums `public/scenes/home/**` and fails over 4 MB. It lists each character file's clip names.

- [ ] **Step 1:** Source CC0, stylized, rigged packs from one or two authors. Candidates:
  - **Quaternius:** e.g. the Ultimate Animated Character Pack or Universal Animation Library;
  - **Kenney:** Furniture Kit and others.
  - **Poly Pizza:** filter to CC0.
  Download with `curl` into SCRATCH; record each source page.
- [ ] **Step 2:** Convert and compress with `npx @gltf-transform/cli` (`resize --width 1024`, `meshopt`, `prune`, `dedup`). Copy only the files the scene uses into `public/scenes/home/`.
- [ ] **Step 3:** Run `pnpm tsx scripts/check-scene-assets.ts`. Expected: ≤ 4 MB, and the clips are listed.
- [ ] **Step 4:** Build the pick sheet: a throwaway HTML page in SCRATCH rendering each GLB with `<model-viewer>` from cdnjs. Screenshot it to `SCRATCH/asset-pick-sheet.png` for the owner.
- [ ] **Step 5:** If a pack cannot be downloaded (blocked host, no CC0 match), stop and report **NEEDS_CONTEXT** with what was found. Don't substitute a non-CC0 asset. Code-built stand-ins (Task 8) cover anything missing.
- [ ] **Step 6:** `CI=1 pnpm exec eslint scripts/check-scene-assets.ts`, `pnpm tsc`. Commit by path: `feat(trade-scenes): CC0 residents, furniture and equipment for the home, with their licences`.

### Task 11: The lab page, view, panel shell and store wiring

**Files:**
- Create: `src/app/(frontend)/dashboard/labs/trade-scene/page.tsx`
- Create: `src/features/trade-scenes/ui/views/trade-scene-view.tsx`
- Create: `src/features/trade-scenes/ui/components/panel/{story-panel.tsx,weather-controls.tsx,view-toggle.tsx,home-profile-popover.tsx,look-drawer.tsx,scope-chips.tsx}`
- Create: `src/features/trade-scenes/hooks/use-scene-targets.ts`
- Create: `src/features/trade-scenes/ui/components/home-scene-canvas.tsx` (an empty `SceneShell` for now; it gains the kits in Tasks 12–16)

**Interfaces:**
- Consumes: Task 6 (store), Task 9 (`TradeSceneInputs`, `resolveScene`, `HOME_SCENE_DEFAULTS`), and `trpc.constructionRouter.scopes.getAll` (scope names for chips).
- Produces:
  - `useSceneTargets(): SceneTargets`: memoized `resolveScene(state, resolveTradeBillCuts())` from the store.
  - `TradeSceneView` creates the store once (`useState(() => createSceneInputs(HOME_SCENE_DEFAULTS))`) inside `SceneInputsProvider`.
  - **Layout** is the reference's: the panel on the left at `@[60rem]` (stacked below in portrait), the scene on the right, on `--presentation-ground`, scoped `dark` like the look-dev view.
  - **Panel controls:**
    - view toggle "Today" / "Tri Pros build" (the reference's wording rules);
    - weather (Summer / Winter / Rain);
    - climate (Coastal / Inland);
    - Thermal camera switch;
    - scope chips (every `SCOPE_INSTALLS` key for the zoomed or primary assembly, named from the scopes query) and a "Cool roof" chip that turns on when a roof scope is previewed (§7.4);
    - the Home profile popover (roof, era, insulation, foundation, HVAC type and components, windows, household type, age group);
    - the Look drawer (ribbon style only).
  - Copy constants in `home-scene-copy.ts`.

- [ ] **Step 1:** Implement the page (no guard of its own; the labs layout guards it), the view, the hook and the panel.
- [ ] **Step 2:** Run the dev server, then screenshot `/dashboard/labs/trade-scene` in landscape (1366×1024) and portrait (1024×1366). Expected: the panel renders every control; changing them updates the heading (check one basis change).
- [ ] **Step 3:** `pnpm tsc`, `CI=1 pnpm lint`.
- [ ] **Step 4:** Commit: `feat(trade-scenes): the trade scene lab page, its panel and its scene inputs`.

### Task 12: Home kit: the house, roof forms, rooms, yard, sky and anchors

**Files:**
- Create: `src/features/trade-scenes/ui/components/home-kit/{home-kit.tsx,house-shell.tsx,house-roof.tsx,rooms.tsx,yard.tsx,weather-sky.tsx,home-anchors-layer.tsx,home-equipment.tsx}`
- Create: `src/features/trade-scenes/constants/home-geometry.ts`, `src/features/trade-scenes/constants/weather-skies.ts`
- Modify: `home-scene-canvas.tsx`, `constants/home-anchors.ts`

**Interfaces:**
- Consumes: Tasks 7, 8, 9, 10, 11.
- Produces:
  - `<HomeKit targets={SceneTargets} inputs={TradeSceneInputs} ghosted={boolean} onAnchorTap={(anchor) => void} />`.
  - **House shell:** a code-built one-story ranch with stucco walls, cut open toward the camera (front wall and the near half of the roof removed).
  - **Roof by form:**
    - gable at house scale with instanced shingles, tile or shakes, per the resolved `covering` material;
    - low-slope with a parapet when `form === 'low-slope'`;
    - the cool versions read lighter.
  - **Foundation:** a raised skirt with vents, or slab.
  - **HVAC:** central → condenser + attic duct runs (simple tubes); wall-mounted → a wall unit; portable → a window unit; furnace-only → no outdoor unit; unknown → central.
  - Window frame thickness by `windowsType`; a meter on the side wall; a thermostat in the hall.
  - **Sky and light per weather** from `WEATHER_SKIES` (sun direction, colour, intensity, background).
  - **Anchors:** `HOME_ANCHORS` positions match the geometry; `roof` sits mid-slope on the cut edge.
  - **Zoom:** tapping the roof anchor sets `zoom = 'roof-attic'`; the camera glides to `HOME_ANCHORS.roof.framing`; "Back to the home" clears it. While zoomed, `ghosted` fades the home to 0.15 opacity.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Screenshot at the home framing: each roof type (shingle, tile, woodshake, flat, metal) × each weather, raised vs slab, the three HVAC types. Then a zoomed frame. Expected: each reads as described. Check a few frames in your own browser; note anything off in the report.
- [ ] **Step 3:** `pnpm tsc`, `CI=1 pnpm lint`.
- [ ] **Step 4:** Commit: `feat(trade-scenes): the home kit draws a cut-open home from the profile, under each weather, with anchors to zoom`.

### Task 13: Home kit life: residents, equipment, meter, rain and leaks

**Files:**
- Create: `src/features/trade-scenes/ui/components/home-kit/{residents.tsx,resident.tsx,comfort-props.tsx,meter-dial.tsx,thermostat-display.tsx,home-rain.tsx,ceiling-leak.tsx}`
- Create: `src/features/trade-scenes/constants/resident-clips.ts`, `src/features/trade-scenes/constants/resident-placements.ts`

**Interfaces:**
- Consumes: Tasks 6 (`useSceneBurst`), 8, 9, 10, 12.
- Produces:
  - **`RESIDENT_CLIPS: Record<Weather, Record<Comfort, string>>`**, mapping to the pack's clip names:
    - summer: strained → fan-self, comfortable → sit or idle;
    - winter: strained → shiver, comfortable → sit;
    - rain: look-up while `leak.reachesInside > 0`, else idle.
  - **`RESIDENT_PLACEMENTS`:** sofa and kitchen spots by index, children on the floor.
  - **Ages and roles** pick the model and scale (children 0.65).
  - **Comfort props:** blankets on residents in winter when strained; a ceiling fan spinning when strained in summer.
  - **Equipment strain:**
    - condenser shake amplitude, fan speed and heat shimmer = `equipmentLoad`;
    - the winter heater glow = `equipmentLoad`.
  - **Meter dial speed** = `meterSpeed`. The thermostat shows the preset setpoint and a "running" dot while `equipmentLoad > 0.3`.
  - **Rain:** `RainField` over the house in rain. When `leak.reachesInside > 0`, a stain spreads on the living-room ceiling (radius eases to `reachesInside`), a drip falls into a bucket placed under it, and gutters run. On the proposed build, no stain and no bucket.
  - **Bursts:** everything above animates only while `useSceneBurst(key)` < 1, where `key` covers view, weather, climate, scopes, add-ons, household and profile. Then it settles to the rest pose. Reduced motion shows the final pose.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Screenshots across summer, winter and rain × Today and the 1950–1978 shingle full proposed build × households (single, couple, family, relatives, unknown). Expected:
  - Today summer: fanning residents, shaking condenser;
  - proposed: relaxed;
  - rain Today: stain + bucket; rain proposed: dry.
- [ ] **Step 3:** Frame-count check in Playwright: after one input, `renderer.info.render.frame` keeps rising, then stays unchanged over 2 s by 12 s after the input (criterion 4).
- [ ] **Step 4:** `pnpm tsc`, `CI=1 pnpm lint`.
- [ ] **Step 5:** Commit: `feat(trade-scenes): residents and the home react to comfort and rain in bursts, then rest`.

### Task 14: The thermal camera on the home

**Files:**
- Create: `src/features/trade-scenes/ui/components/home-kit/{home-thermal-paint.tsx,reading-labels.tsx}`
- Create: `src/features/trade-scenes/constants/home-temperatures.ts`
- Create: `src/features/trade-scenes/ui/components/panel/{thermal-legend.tsx,reading-disclosure.tsx}`

**Interfaces:**
- Consumes: Tasks 4 (`THERMAL_SCALE_F`, `ThermalWalk`), 7 (`ThermalScaleBar`, pins), 8 (`thermal` on figures), 9, 12, 13.
- Produces:
  - **Paint:** with `thermalCamera` on, every home surface paints through `ThermalMaterial` using the **ironbow `summer` ramp in every weather** (one fixed scale; a real FLIR keeps one palette). Temperatures:
    - roof surfaces: `readings.outerSurface`;
    - attic volume and its contents: `readings.cavityAir`;
    - ceilings: `readings.innerSurface`;
    - interior walls and furniture: the preset setpoint;
    - exterior walls and ground: the preset outside temperature (plus `SOLAR_GAIN_F × 0.3` on the sun side in summer);
    - residents: 98 °F (via `AnimatedFigure` `thermal`);
    - equipment: setpoint + 30 °F × `equipmentLoad`;
    - rain-soaked areas: outside − 5 °F.
    These constants go in `home-temperatures.ts`, all normalized with `normalizeOnScale(…, THERMAL_SCALE_F)`.
  - **Readings:** pinned labels "Roof 166°F*", "Attic 140°F*" ("Joist space" on low-slope) and "Ceiling 80°F*" at their anchors. The asterisk opens `ReadingDisclosure` with the spec's copy:

    > "Estimate for a typical {coastal | inland} {summer afternoon | winter night}. Real temperatures vary."

  - **Legend:** `ThermalLegend` places `ThermalScaleBar` at the canvas edge.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Screenshots of the thermal camera on, for summer, winter and rain × Today and proposed × coastal and inland, at the home framing. Expected: Today summer's roof is near white-yellow, the attic orange and the residents purple-red; the proposed build is visibly cooler; the readings match `scripts/verify-construction-model.ts`'s grid for the same case.
- [ ] **Step 3:** `pnpm tsc`, `CI=1 pnpm lint`.
- [ ] **Step 4:** Commit: `feat(trade-scenes): a thermal camera repaints the home in ironbow with pinned °F estimates`.

### Task 15: The `roof-attic` assembly kit: parts, forms, peel, emphasis and pins

**Files:**
- Create: `src/features/trade-scenes/ui/components/assembly-kits/roof-attic/{roof-attic-kit.tsx,ceiling-part.tsx,insulation-part.tsx,rafters-part.tsx,radiant-barrier-part.tsx,deck-part.tsx,membrane-part.tsx,underlayment-part.tsx,drip-edge-part.tsx,covering-part.tsx,shingle-covering.tsx,tile-covering.tsx,wood-shake-covering.tsx,flat-membrane-covering.tsx,ridge-vent-part.tsx,gutter-part.tsx}`
- Create: `src/features/trade-scenes/constants/roof-attic-kit.ts` (dimensions, colours, peel axes)
- Create: `src/features/trade-scenes/lib/{shingle-layout.ts,tile-layout.ts,shake-layout.ts}`
- Create: `src/features/trade-scenes/ui/components/assembly-kits/assembly-kit-host.tsx`, `src/features/trade-scenes/constants/assembly-kit-components.ts`
- Create: `src/features/trade-scenes/ui/components/panel/{layer-list.tsx,layer-pins.tsx,peel-control.tsx}`

**Interfaces:**
- Consumes: Tasks 7, 9, 11, 12.
- Produces:
  - **`ASSEMBLY_KIT_COMPONENTS`** maps each assembly id to a `next/dynamic` kit component. `<AssemblyKitHost zoom targets inputs />` mounts the registered kit at its anchor's position and crossfades it in (opacity eased 0 → 1) while the home ghosts.
  - **`<RoofAtticKit targets: AssemblyTargets, peel, emphasizedPart, onEmphasize />`:** one renderer per part, each taking `{ material, condition, form, opacity }`.
  - **Pitched form:** rebuilt from the reference's `roof-slope.tsx` / `attic-floor.tsx` look (read them; don't import them).
  - **Low-slope form:** parapet, deck on joists, ceiling right below, batts only when present.
  - **Coverings:**
    - shingle and tile instanced as in the reference;
    - **wood shake:** thick tapered shakes in staggered courses with uneven widths, weathered grey-brown, over spaced boards with visible gaps;
    - **flat membrane:** a dark granulated cap sheet; `cool-membrane` is white;
    - `cool-shingle` is lighter.
  - **Part conditions:** worn parts look aged; installed parts drop in with an eased y-offset on view change (the foundation's eased-unit-box pattern).
  - **Peel:** parts separate along their own axes; the roof group lifts to show the attic.
  - **Emphasis:** a tapped part keeps full opacity and the rest fade to 0.25; the camera eases toward the part.
  - **Pins:** numbered pins on every part (`SceneAnchor` + `ScenePins`), visible when `peel > 0.2`, tied to the panel's layer list (the reference's behaviour). The layer list and the peel control show only while zoomed.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Zoomed screenshots: shingle, tile, woodshake (existing and tear-off proposed, showing the new solid deck) and flat (existing; proposed with and without cool roof) × peel 0 and 1 × one emphasized part, in both orientations. Expected: each covering is distinct and recognizable; no shingle sits on spaced boards in any proposed shot.
- [ ] **Step 3:** `pnpm tsc`, `CI=1 pnpm lint`.
- [ ] **Step 4:** Commit: `feat(trade-scenes): the roof-attic assembly kit draws every covering, peels apart and ties pins to the layer list`.

### Task 16: The assembly kit's flows: heat, winter reflection, rain and thermal paint

**Files:**
- Create: `src/features/trade-scenes/ui/components/assembly-kits/roof-attic/{heat-ribbons.tsx,reflected-ribbon.tsx,rain-ribbons.tsx,leak-drip.tsx,part-thermal-paint.tsx}`
- Create: `src/features/trade-scenes/lib/ribbon-paths.ts`

**Interfaces:**
- Consumes: Tasks 4, 5, 9, 15; `FlowRibbon`, `ThermalMaterial`.
- Produces:
  - **Heat:** ribbon widths come from `targets.heat.boundaries`, along paths through each part's position (`ribbonPaths(form, peel)`).
    - Summer flows down; winter flows up.
    - The colour follows the weather (warm in summer, a cooler warm in winter).
    - The style comes from `inputs.look.ribbonStyle`.
  - **Reflection:**
    - summer: a short ribbon peels back to the sky at the covering, width = `heat.reflected`;
    - winter, when the radiant barrier is present: a ribbon arcs back down at the barrier, width = the share the barrier turned back (the boundary drop across it).
  - **Rain:** blue ribbons.
    - An intact shedding part makes the flow run along the covering to the drip edge and gutter (width = `water.shed`).
    - Otherwise the flow passes down through the parts, thinning by `soaked`.
    - A dark rot patch on soaked parts; a drip from the ceiling when `reachesInside > 0`, aligned with the home's bucket.
  - **Paint:** with `thermalCamera` on, every part paints with `ThermalMaterial` from `heat.parts` (inner and outer, already on the fixed scale), ironbow `summer` ramp.
  - **Readings:** the three reading pins show in the section too, with the same values as the home view.

- [ ] **Step 1:** Implement. Also fix the foundation carry-over in `src/shared/components/scene/constants/thermal-shader.ts`: the vertex shader applies `instanceMatrix` to normals when `USE_INSTANCING` is defined, so instanced shingles, tiles and shakes shade correctly under thermal paint.
- [ ] **Step 2:** Zoomed screenshots: summer, winter and rain × Today and the full proposed build (with and without barrier, with and without cool roof) × thermal on and off. Expected:
  - the summer proposed ribbon visibly narrower than Today;
  - the winter barrier arc present only with the barrier;
  - rain Today reaching the ceiling, rain proposed running to the gutter;
  - readings equal to the home view's.
- [ ] **Step 3:** `pnpm tsc`, `CI=1 pnpm lint`.
- [ ] **Step 4:** Commit: `feat(trade-scenes): heat narrows, winter heat bounces back at the barrier, and rain either leaks or sheds, in the assembly kit`.

### Task 17: Savings panel

**Files:**
- Create: `src/features/trade-scenes/ui/components/panel/{savings-panel.tsx,bill-field.tsx,cut-override.tsx,repairs-line.tsx,estimate-disclosure.tsx}`
- Modify: `story-panel.tsx`

**Interfaces:**
- Consumes: Task 9 (`SceneSavings`), `CUT_MODES` and `CUT_MODE_LABELS`, `BILL_CATEGORY_LABELS`.
- Produces:
  - **Proposed view only:**
    - a bill field for the weather's category (Electric in summer, Gas in winter; none in rain);
    - "about $X a month less*" once a bill is typed, with the cut override (From trades / % / $);
    - a repairs & upkeep line from `repairsByTrade`, with each trade's $/yr editable;
    - the combined total.
  - **Asterisks** open `EstimateDisclosure`:
    - "Tri Pros customer bills";
    - "Savings vary";
    - for the attic insulation scope, the FTC R-value wording placeholder from the foundation spec §5.3, marked for verification.
  - **Rules:** whole dollars. A trade with no cut in the category contributes nothing.
  - **Motion:** figures animate with `SCENE_MOTION.transition`.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Add an assertion to `scripts/verify-trade-scene.ts`: for a $300 summer electric bill with tear-off + `['cool-roof']`, `savings.cut` equals `projectRemodelRoi`'s electric cut for the roof trade with `coolRoof: true` and the same bill (foundation criterion 3).
- [ ] **Step 3:** Screenshots: summer with a $300 bill, winter with $120 gas, rain (no bill field) × proposed. Run the script.
- [ ] **Step 4:** `pnpm tsc`, `CI=1 pnpm lint`.
- [ ] **Step 5:** Commit: `feat(trade-scenes): savings show in the panel from a typed bill, with repairs and their disclosures`.

### Task 18: Graceful paths, the full screenshot matrix, and the contract check

**Files:**
- Create: `src/features/trade-scenes/ui/components/home-scene-fallback.tsx`, `public/scenes/stills/{summer,winter,rain}.webp`
- Modify: `home-scene-canvas.tsx`
- Modify: `docs/plans/2026-10-16-trade-scenes-epic.md` (TS3 status, §6 change-log line)
- Throwaway (deleted before commit): a stub `hvac-attic` kit registered at `attic`

**Interfaces:**
- Produces:
  - **No WebGL:** `SceneShell`'s fallback renders `HomeSceneFallback`: the weather's still image, plus the panel, readings and savings unchanged. Stills are captured from the scene in Playwright (Today, home framing) and saved as webp.
  - **Reduced motion:** bursts off, final poses, still rain streaks, still ribbons. Already wired in Tasks 6, 8 and 13; verify here.

- [ ] **Step 1:** Implement the fallback and capture the stills.
- [ ] **Step 2:** Run the full screenshot matrix in Playwright, both iPad orientations: roof type (shingle, tile, woodshake, flat) × weather × view × thermal camera on/off, home and zoomed. Check in your own browser. Record any defect in the report.
- [ ] **Step 3:** Graceful-path screenshots:
  - Chromium `--disable-3d-apis`;
  - `WEBGL_lose_context` mid-scene;
  - `prefers-reduced-motion: reduce`;
  - a forced 404 on one resident GLB via Playwright route interception (stand-ins drawn).
- [ ] **Step 4:** Contract check (criterion 6): temporarily register a stub `hvac-attic` kit (one box) at `attic` in both registries. Zoom to it and confirm it renders with **no edit** to any `home-kit/` file. Then delete the stub and its registry lines. `git status` must show no trace.
- [ ] **Step 5:** Run every script: `pnpm tsx scripts/verify-construction-model.ts`, `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsx scripts/verify-scene-inputs.ts`, `pnpm tsx scripts/verify-remodel-roi.ts`, `pnpm tsx scripts/check-scene-assets.ts`. Then `pnpm tsc` and `CI=1 pnpm lint`. Expected: all pass.
- [ ] **Step 6:** Update the tracker: TS3 built (unmerged), and a §6 line naming the comfort-gap ruling and anything the build changed.
- [ ] **Step 7:** Commit: `feat(trade-scenes): the home scene falls back to stills without 3D, holds still for reduced motion, and keeps the kit contract`.
