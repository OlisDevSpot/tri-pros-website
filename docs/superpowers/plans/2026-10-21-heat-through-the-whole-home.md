# Heat Through the Whole Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Heat moves through the Home scene's roof, sunny wall and windows as comet arrows, every figure the scene shows comes from one hand-tuned table, and the walls and windows get temperature pins.

**Architecture:** A constants file holds the starting home's figures per climate × weather and each upgrade's fixed effect; a pure `homeHeat` composes them from the drawn roof-attic parts, the windows and the paint. `resolveScene` stops calling the construction model's heat walk and returns that composition (readings, arrow flows, bounce, load) plus a meter from the weather's level and the electric cut. One instanced, camera-facing comet sprite component draws arrows along fixed lanes, built by pure functions for the whole home and for the roof section; the heat ribbon is deleted.

**Tech Stack:** Next.js 15, React 19, TypeScript, three.js via @react-three/fiber, zustand scene store. Logic is proved by `tsx` assertion scripts.

**Spec:** `docs/superpowers/specs/2026-10-21-heat-through-the-whole-home-design.md` (owner approved 2026-10-21). Tracker: `docs/plans/2026-10-16-trade-scenes-epic.md` row TS3b.2.

## Global Constraints

- Pure logic is proved by `tsx` assertion scripts (`pnpm tsx scripts/verify-trade-scene.ts`); there is no test runner and adding one is out of scope.
- Verify with `pnpm tsc` and `CI=1 pnpm lint`. Never `pnpm build`. The owner runs the dev server on port 3002; never start one.
- No edits to `eslint.config.js` or `package.json`; no new dependencies.
- Never touch `src/features/meeting-visualizations/`, `/dashboard/labs/roof-cutaway`, `ui/views/cutaway-look-view.tsx` or `ui/components/look-dev/*`, nor `src/shared/components/scene/ui/flow-ribbon.tsx` (frozen surfaces use it).
- The construction module's heat walk (`thermal-walk.ts`, `relative-heat-flow.ts`) stays; the scene simply stops calling it.
- Comments say why, never what; one component per file; constants in `constants/`, logic in `lib/`, named exports; types in `src/features/trade-scenes/types.ts`.
- Every hand-tuned number carries a "Working number, tuned at the owner's review" comment at its group, never per line.
- Never mention solar in code or copy.
- Arrows on the whole home show only in the Thermal view (`thermalCamera`), never in Rain, never while zoomed. Up close they show in every view, never in Rain.
- Arrows never stop while on screen (owner exception to R23); with reduced motion they hold still. Nothing else in the scene leaves its burst.
- Commit by explicit path (never `git add -A`, stash, reset, checkout, amend or push). Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A flat-roof home with no recorded insulation** draws the attic insulation absent (`infer-existing-conditions.ts:17`). Its figures must come out finite, warmer than R-11, and its arrows must still draw. Test in Task 1.
2. **Unknown `windowsType`** (null) reads as single pane, as the house already draws it (`house-shell.tsx:46`). Test in Task 1.
3. **A typed % or $ electric cut** moves the build's meter by exactly that cut, in every weather, and Today's meter ignores it. Test in Task 2.
4. **Switching to Rain or zooming while arrows run** unmounts them, so nothing keeps requesting frames. Check in Task 5 and Task 6 by reading the render condition and watching the frame counter.
5. **Reduced motion** holds every arrow still at its rest spacing with no frame requests. Test of `arrowStations` in Task 4; render path checked in Task 4.

---

## File map

| File | Task | Responsibility |
|---|---|---|
| `src/features/trade-scenes/constants/home-heat-figures.ts` (create) | 1 | Every hand-tuned figure: starting home, effects, meter levels, arrow scale |
| `src/features/trade-scenes/lib/home-heat.ts` (create) | 1 | Compose a home's `HomeHeat` from its shell |
| `src/features/trade-scenes/lib/heat-lane-flows.ts` (create) | 1 | Arrow flow on each segment and bounce |
| `src/features/trade-scenes/constants/home-anchors.ts` | 1, 3 | Reading ids (six), section ids, pin points |
| `src/features/trade-scenes/types.ts` | 1, 2, 4 | New types; `SceneTargets`, `AssemblyTargets`, `AssemblyKitProps` change |
| `src/features/trade-scenes/lib/resolve-scene.ts` | 2 | Table instead of heat walk; meter |
| `src/features/trade-scenes/lib/comfort-from-readings.ts` | 2 | Reads the ceiling from `HomeReadings` |
| `src/features/trade-scenes/lib/home-paint-temperatures.ts`, `lib/kit-paint-temperatures.ts`, `constants/roof-attic-flows.ts` | 2 | Paint from the table |
| `src/features/trade-scenes/ui/components/assembly-kits/roof-attic/heat-ribbons.tsx`, `reflected-ribbon.tsx` (delete); `lib/ribbon-paths.ts`, `roof-attic-flows.tsx` | 2 | Heat ribbon removed |
| `src/features/trade-scenes/lib/reading-value.ts` (delete) | 2 | Readings are indexed directly |
| `src/features/trade-scenes/constants/home-scene-copy.ts`, `constants/home-thermal-zones.ts`, `ui/components/home-kit/house-shell.tsx`, `reading-labels.tsx`, `home-scene-canvas.tsx`, `home-scene-fallback.tsx`, `panel/part-pins.tsx`, `lib/roof-attic-kit-points.ts` | 3 | Six pins, the window paint zone |
| `src/features/trade-scenes/lib/arrow-stations.ts`, `lib/heat-arrow-lane.ts`, `constants/heat-arrow-look.ts`, `ui/lib/create-comet-texture.ts`, `ui/components/heat-arrows.tsx` (create) | 4 | The comet arrow primitive |
| `src/features/trade-scenes/lib/home-heat-lanes.ts`, `constants/home-heat-lanes.ts` (create); `home-kit.tsx` | 5 | Arrows on the whole home |
| `src/features/trade-scenes/lib/kit-line-spans.ts`, `lib/kit-heat-lanes.ts` (create); `roof-attic-kit.tsx`, `roof-attic-flows.tsx`, `assembly-kit-host.tsx` | 6 | Arrows up close |
| `scripts/verify-trade-scene.ts` | 1, 2, 4, 5, 6 | Assertions |
| `docs/plans/2026-10-16-trade-scenes-epic.md` | 7 | Status |

---

### Task 1: The figures table and its composition

**Files:**
- Create: `src/features/trade-scenes/constants/home-heat-figures.ts`
- Create: `src/features/trade-scenes/lib/home-heat.ts`
- Create: `src/features/trade-scenes/lib/heat-lane-flows.ts`
- Modify: `src/features/trade-scenes/constants/home-anchors.ts:60-63` (reading ids)
- Modify: `src/features/trade-scenes/types.ts`
- Test: `scripts/verify-trade-scene.ts` (new section at the end, before the copy checks)

**Interfaces:**
- Produces, in `constants/home-anchors.ts`:
  - `SECTION_READING_IDS = ['roof', 'attic', 'ceiling'] as const`, `type SectionReadingId`
  - `READING_IDS = [...SECTION_READING_IDS, 'wall-outside', 'wall-inside', 'window'] as const`, `type ReadingId`
  - (Task 3 adds the three new points to `READING_ANCHORS`; until then keep `READING_ANCHORS` typed `Record<HomeRoofForm, Record<SectionReadingId, …>>`.)
- Produces, in `types.ts`:
  ```ts
  export type HomeReadings = Record<ReadingId, number>
  export interface HomeHeatFlows { roofSource: number, roofPasses: readonly [number, number], wall: number, window: number }
  export interface HomeHeatBounce { covering: number, barrier: number, wall: number }
  export interface HomeHeat { readings: HomeReadings, flows: HomeHeatFlows, bounce: HomeHeatBounce, load: number }
  export type StartingHomeHeat = Omit<HomeHeat, 'bounce'>
  export interface HeatEffect {
    readings?: Partial<HomeReadings>          // °F added
    flows?: Partial<HomeHeatFlows>            // multipliers (roofPasses multiplies element-wise)
    bounce?: Partial<HomeHeatBounce>          // shares added
    load?: number                             // multiplier
  }
  export type WeatherHeatEffects = Partial<Record<HeatWeather, HeatEffect>>
  export type ExteriorPaint = 'regular' | 'cool'
  export interface HomeShell { parts: readonly ResolvedPart[], windows: WindowsType | null, paint: ExteriorPaint }
  export interface HeatLaneFlows {
    /** In flow order from the heat's source: summer and normal sky → covering → attic → room, winter room → attic → covering → sky. */
    roof: readonly [number, number, number]
    coveringBounce: number
    barrierBounce: number
    wall: number
    wallBounce: number
    window: number
  }
  ```
- Produces, in `constants/home-heat-figures.ts`: `STARTING_HOME_HEAT: Record<Climate, Record<HeatWeather, StartingHomeHeat>>`, `PART_HEAT_EFFECTS: Readonly<Record<string, Readonly<Record<string, WeatherHeatEffects>>>>` (part id → material, or `'absent'` for a part drawn with no material → effects), `WINDOW_HEAT_EFFECTS: Partial<Record<WindowsType, WeatherHeatEffects>>`, `PAINT_HEAT_EFFECTS: Partial<Record<ExteriorPaint, WeatherHeatEffects>>`, `METER_LEVEL: Record<HeatWeather, number>`, `HEAT_FLOW_STOPPED = 0.02`, `HEAT_ARROW_SCALE = { arrowsAtFull: 5, speedAtFull: 1.2, speedAtLeast: 0.35 }` (arrows per lane at flow 1; metres per second along the lane), `BOUNCE_MAX = 0.9`.
- Produces: `homeHeat(climate: Climate, weather: HeatWeather, shell: HomeShell): HomeHeat` in `lib/home-heat.ts`; `heatLaneFlows(heat: HomeHeat): HeatLaneFlows` in `lib/heat-lane-flows.ts`.

**The table's values** (all °F unless a share; "×" is a multiplier, "+" an addition):

Starting home (`STARTING_HOME_HEAT`), readings roof / attic / ceiling / wall-outside / wall-inside / window; flows roofSource / roofPasses / wall / window; load:

| | readings | flows | load |
|---|---|---|---|
| coastal normal | 103.9 / 92.9 / 76.9 / 85 / 77.5 / 80 | 0.35 / [0.85, 0.6] / 0.17 / 0.26 | 0.16 |
| coastal summer | 148.3 / 123.4 / 78.6 / 106 / 79 / 86 | 0.85 / [0.85, 0.6] / 0.4 / 0.65 | 0.42 |
| coastal winter | 40.7 / 43.7 / 68.5 / 46 / 66 / 55 | 0.7 / [0.6, 0.9] / 0.4 / 0.65 | 0.55 |
| inland normal | 107.9 / 96.7 / 77.2 / 89 / 77.8 / 81 | 0.4 / [0.85, 0.6] / 0.2 / 0.3 | 0.19 |
| inland summer | 166.1 / 140.2 / 79.6 / 124 / 81 / 92 | 1 / [0.85, 0.6] / 0.5 / 0.8 | 0.55 |
| inland winter | 33.8 / 37.2 / 68.2 / 40 / 65 / 50 | 0.85 / [0.6, 0.9] / 0.5 / 0.8 | 0.61 |

Effects, by weather (normal | summer | winter); unlisted fields have no effect:

| Key | normal | summer | winter |
|---|---|---|---|
| `attic-insulation` · `absent` | attic +0.5, ceiling +1.1, roofPasses ×[1, 1.4], load ×1.3 | attic +1, ceiling +2.5, roofPasses ×[1, 1.4], load ×1.3 | roof +1.2, attic +3, ceiling −1.5, roofSource ×1.15, roofPasses ×[1.4, 1], load ×1.25 |
| `attic-insulation` · `batts-r19` | attic −0.3, ceiling −0.45, roofPasses ×[1, 0.8], load ×0.8 | attic −0.7, ceiling −1, roofPasses ×[1, 0.8], load ×0.8 | roof −0.8, attic −2, ceiling +0.5, roofSource ×0.85, roofPasses ×[0.8, 1], load ×0.8 |
| `attic-insulation` · `batts-r30` | attic −0.6, ceiling −0.7, roofPasses ×[1, 0.65], load ×0.63 | attic −1.4, ceiling −1.5, roofPasses ×[1, 0.65], load ×0.63 | roof −1.4, attic −3.5, ceiling +0.8, roofSource ×0.75, roofPasses ×[0.65, 1], load ×0.63 |
| `attic-insulation` · `blown-r38` | attic −0.9, ceiling −0.9, roofPasses ×[1, 0.5], load ×0.55 | attic −2, ceiling −2, roofPasses ×[1, 0.5], load ×0.55 | roof −2, attic −5, ceiling +1, roofSource ×0.6, roofPasses ×[0.5, 1], load ×0.55 |
| `radiant-barrier` · `foil` | attic −6, ceiling −0.2, bounce.barrier +0.35, roofPasses ×[0.85, 1], load ×0.4 | attic −13, ceiling −0.5, bounce.barrier +0.5, roofPasses ×[0.9, 1], load ×0.4 | roofPasses ×[1, 0.85], load ×0.85 |
| `covering` · `cool-shingle` | roof −6, attic −2.7, ceiling −0.15, bounce.covering +0.25, load ×0.78 | roof −13, attic −6, ceiling −0.3, bounce.covering +0.3, load ×0.78 | — |
| `covering` · `tile` | roof −5.3, attic −1, roofSource ×0.85, load ×0.85 | roof −11.7, attic −1.8, ceiling −0.1, roofSource ×0.85, load ×0.85 | attic −0.7 |
| `covering` · `wood-shake` | roof +2.8, attic +5.4, ceiling +0.3, roofSource ×1.1, load ×1.12 | roof +6.4, attic +12.3, ceiling +0.7, roofSource ×1.1, load ×1.12 | attic −1 |
| `covering` · `membrane` | attic +0.8 | attic +2, ceiling +0.1 | attic −0.2 |
| `covering` · `cool-membrane` | roof −21.7, attic −13.4, ceiling −0.8, bounce.covering +0.5, load ×0.3 | roof −48, attic −29.5, ceiling −1.7, bounce.covering +0.6, load ×0.3 | — |
| `air-sealing` · `sealed` | ceiling −0.1, roofPasses ×[1, 0.92], load ×0.95 | ceiling −0.2, roofPasses ×[1, 0.92], load ×0.95 | attic −0.5, ceiling +0.3, roofSource ×0.9, load ×0.9 |
| windows · `double` | window −4, window ×0.45, load ×0.95 | window −10, window ×0.45, load ×0.93 | window +12, window ×0.45, load ×0.93 |
| paint · `cool` | wall-outside −6, wall-inside −0.6, bounce.wall +0.25, load ×0.97 | wall-outside −14, wall-inside −1.5, bounce.wall +0.35, load ×0.95 | — |

`METER_LEVEL = { normal: 0.4, summer: 1, winter: 0.5 }`.

**Composition rules for `homeHeat`:** start from `STARTING_HOME_HEAT[climate][weather]` with bounce all 0. For each part id in `PART_HEAT_EFFECTS`, find the part in `shell.parts`; skip if the id is not there; its key is `part.material ?? 'absent'`; apply `PART_HEAT_EFFECTS[id][key]?.[weather]` if present. Then apply `WINDOW_HEAT_EFFECTS[shell.windows ?? 'single']?.[weather]` and `PAINT_HEAT_EFFECTS[shell.paint]?.[weather]`. Readings add; flows and load multiply, each clamped to [0, 1]; bounce adds, clamped to [0, `BOUNCE_MAX`]. A part's condition (worn, installed) never matters: an effect applies once, however the home came to have it.

**`heatLaneFlows` rules:** with `s = flows.roofSource`, `bc = bounce.covering`, `bb = bounce.barrier`: `roof = [s, s·(1−bc)·(1−bb)·roofPasses[0], that·roofPasses[1]]`; `coveringBounce = s·bc`; `barrierBounce = s·(1−bc)·bb`; `wall = flows.wall·(1−bounce.wall)`; `wallBounce = flows.wall·bounce.wall`; `window = flows.window`.

- [ ] **Step 1: Write the failing checks** in `scripts/verify-trade-scene.ts`, a section headed `// The heat figures: one hand-tuned table, composed from what the home has.` Build shells from real resolved parts: `const shellOf = (scene) => ({ parts: roofAttic(scene).parts, windows: null, paint: 'regular' as const })`, using the script's existing `shingleR11`, `FULL_BUILD`, `TEAR_OFF`, `inputs`, `profile`. Assertions (use a helper `near(actual, expected, tolerance, label)`):
  ```ts
  const todayIn = (climate, weather) => homeHeat(climate, weather, shellOf(resolveScene(inputs({ property: shingleR11, weather, climate }), cuts)))
  const buildIn = (climate, weather) => homeHeat(climate, weather, shellOf(resolveScene(inputs({ property: shingleR11, weather, climate, view: 'proposed', proposedScopeIds: FULL_BUILD, addOns: ['cool-roof'] }), cuts)))
  // The starting home is today's default home: no effect applies to it.
  assert.deepEqual(todayIn('inland', 'summer').readings, STARTING_HOME_HEAT.inland.summer.readings)
  // §4.4 targets.
  near(buildIn('inland', 'summer').readings.roof, 153.4, 2, 'inland summer build roof')
  near(buildIn('inland', 'summer').readings.attic, 120.6, 2, 'inland summer build attic')
  near(buildIn('inland', 'summer').readings.ceiling, 76.8, 0.5, 'inland summer build ceiling')
  near(buildIn('inland', 'summer').load, 0.094, 0.02, 'inland summer build load')
  near(todayIn('coastal', 'winter').readings.attic, 43.7, 0.5, 'coastal winter attic today')
  near(buildIn('coastal', 'winter').readings.attic, 39, 1, 'coastal winter attic build')
  near(todayIn('coastal', 'winter').readings.attic - buildIn('coastal', 'winter').readings.attic, 5, 0.5, 'R44 attic gap')
  near(todayIn('coastal', 'winter').readings.roof - buildIn('coastal', 'winter').readings.roof, 2, 0.5, 'R44 roof gap')
  ```
  Then, over every climate × `['normal', 'summer']`, every covering in `['shingle', 'cool-shingle', 'tile']`, barrier on/off and sealed on/off (build the parts by patching the default home's parts' materials), the attic reading over the ladder `absent, batts-r11, batts-r19, batts-r30, blown-r38` never rises, and the ceiling never rises (R45). In winter over the same grid the attic never rises and the ceiling never falls up the ladder.
  For every climate, the Today − build gap in Normal is strictly smaller than in Summer for roof, attic and ceiling, and `<=` for the three wall and window readings.
  Every upgrade lowers what gets through, in every climate and weather: `heatLaneFlows(...).roof[2]` for `batts-r19`, `batts-r30`, `blown-r38` against `batts-r11`, for `foil` against no barrier, for `cool-shingle` against `shingle`, for `sealed` against unsealed; `.window` for `windows: 'double'` against `'single'`; `.wall` for `paint: 'cool'` against `'regular'`. Each `<=`, and `<` in summer.
  Apply-once: a home whose parts already hold `blown-r38` as `worn` gives a `HomeHeat` deep-equal to one holding it `installed`; `windows: null` deep-equals `windows: 'single'`.
  Review Focus 1: a flat home with unknown insulation, `profile({ yearBuilt: '1950-1978', roofType: 'flat', insulationLevel: null })`, in every climate × weather: every reading, flow and load is finite, the summer attic is above the same home's with `batts-r11` patched in, and `heatLaneFlows(...).roof[2] > HEAT_FLOW_STOPPED`.
  `heatLaneFlows` itself: for `{ roofSource: 1, roofPasses: [0.5, 0.5] }` with bounce `{ covering: 0.2, barrier: 0.5, wall: 0.25 }` and wall 0.8, assert `roof` deep-equals `[1, 0.2, 0.1]`, `coveringBounce` 0.2, `barrierBounce` 0.4, `wall` 0.6, `wallBounce` 0.2 (within 1e-9).
- [ ] **Step 2: Run** `pnpm tsx scripts/verify-trade-scene.ts`. Expected: FAIL (`homeHeat` is not defined).
- [ ] **Step 3: Implement** the types, the reading ids, `constants/home-heat-figures.ts` with the values above, `homeHeat` and `heatLaneFlows`. Existing code keyed by `ReadingId` that stops compiling once it has six members (`READING_COPY.labels`, `READING_ANCHORS`, `readingValue`, the kit's reading points in `lib/roof-attic-kit-points.ts`, `ReadingLabels`, the canvas's and the fallback's loops) is re-keyed to `SectionReadingId` / `SECTION_READING_IDS` for now; Tasks 2 and 3 widen it. Nothing on screen changes in this task.
- [ ] **Step 4: Run** `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsc` and `CI=1 pnpm lint`. Expected: all pass. If a §4.4 target fails, adjust only the effect it names, keep the owner's examples (insulation attic −2 summer / −5 winter, barrier attic −13 summer, cool roof −13 / −6 summer) unchanged, and note the change in the report.
- [ ] **Step 5: Commit**
  ```bash
  git add src/features/trade-scenes/constants/home-heat-figures.ts src/features/trade-scenes/lib/home-heat.ts src/features/trade-scenes/lib/heat-lane-flows.ts src/features/trade-scenes/constants/home-anchors.ts src/features/trade-scenes/types.ts scripts/verify-trade-scene.ts
  git commit -m "feat(trade-scenes): one hand-tuned heat table composed from what the home has"
  ```

### Task 2: The scene reads the table, not the heat walk

**Files:**
- Modify: `src/features/trade-scenes/lib/resolve-scene.ts`
- Modify: `src/features/trade-scenes/types.ts` (`SceneTargets`, `AssemblyTargets`, `AssemblyKitProps`)
- Modify: `src/features/trade-scenes/lib/comfort-from-readings.ts`, `lib/home-paint-temperatures.ts`, `lib/kit-paint-temperatures.ts`, `constants/roof-attic-flows.ts`
- Modify: `src/features/trade-scenes/ui/components/assembly-kits/roof-attic/roof-attic-flows.tsx`, `roof-attic-kit.tsx`, `assembly-kits/assembly-kit-host.tsx`, `home-kit/home-kit.tsx`, `home-kit/reading-labels.tsx`, `home-scene-canvas.tsx`, `home-scene-fallback.tsx`, `panel/part-pins.tsx`, `lib/roof-attic-kit-points.ts`, `lib/ribbon-paths.ts`
- Delete: `src/features/trade-scenes/ui/components/assembly-kits/roof-attic/heat-ribbons.tsx`, `reflected-ribbon.tsx`, `src/features/trade-scenes/lib/reading-value.ts`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `homeHeat`, `HomeHeat`, `HomeReadings`, `METER_LEVEL`, `SECTION_READING_IDS` (Task 1).
- Produces:
  - `SceneTargets`: `readings: ThermalReadings | null` becomes `heat: HomeHeat | null` (null in Rain); `equipmentLoad` is `heat?.load ?? 0`; `meterSpeed` is `weather === 'rain' ? 0 : METER_LEVEL[weather] * (1 - savings.cuts.electric.combined)`.
  - `AssemblyTargets` loses `heat` and `walk`; `mode` and `water` stay.
  - `AssemblyKitProps.readings` becomes `heat: HomeHeat | null` (the home's, passed by the host only while zoomed, as today).
  - `comfortFromReadings(readings: HomeReadings, setpoint: number): Comfort` reads `readings.ceiling`.
  - `homePaintTemperatures({ readings: HomeReadings | null, equipmentLoad, weather, climate })`: `sunlit` is `readings['wall-outside']` when readings exist (today's formula otherwise); the rest unchanged.
  - `KIT_PART_PAINT_ZONES` becomes `KIT_PART_PAINT_FACES: Readonly<Record<string, { inner: HomePaintKey, outer: HomePaintKey }>>` with `ceiling: { inner: 'ceiling', outer: 'attic' }`, `air-sealing: { inner: 'ceiling', outer: 'attic' }`, `attic-insulation: { inner: 'ceiling', outer: 'attic' }`, `rafters` and `radiant-barrier: { inner: 'attic', outer: 'attic' }`, any other part `{ inner: 'attic', outer: 'roof' }`. `kitPaintTemperatures({ parts, water, weather, climate, readings })` paints each part's inner and outer face from those zones (soaked parts as today).
- The shell the scene composes: the `roof-attic` entry's resolved parts (`[]` if no kit resolved it), `property.windowsType`, `paint: 'regular'`.

- [ ] **Step 1: Rewrite the failing checks** in `scripts/verify-trade-scene.ts`:
  - In `checkOneScene`: delete the `thermalWalk` / `relativeHeatFlow` comparisons, the `target.heat` / `target.walk` asserts and their imports. For a heat weather assert `scene.heat` deep-equals `homeHeat(climate, weather, { parts, windows: property.windowsType, paint: 'regular' })`, `scene.equipmentLoad === scene.heat.load`, `scene.comfort === comfortFromReadings(scene.heat.readings, setpoint)`, and `scene.meterSpeed === METER_LEVEL[weather] * (1 - scene.savings.cuts.electric.combined)`. In Rain: `scene.heat === null`, load 0, meter 0. On Today: meter `=== METER_LEVEL[weather]`.
  - Line 85: the untyped default scene's meter is `METER_LEVEL.normal` (0.4).
  - Lines 197–200: the typed 30% cut on the default (Normal) scene gives Today 0.4 and the build `0.4 * 0.7`; add the same in Summer (1 and 0.7) and a typed `$` cut of 90 on a 300 bill in Winter (Today 0.5, build `0.5 * 0.7`) for Review Focus 3.
  - Comfort helper (line 276): `readings(ceiling)` builds a full `HomeReadings` with that ceiling. Lines 285–288 read `heat.readings.ceiling`.
  - Normal block (307–314) and the kit-without-a-weather block (356–362): `scene.heat !== null` where they checked readings; drop `.heat`/`.walk` on the target; `ceilingGap` reads `heat.readings.ceiling`.
  - Delete the heat-ribbon block (364–405: `heatEnd` and the Normal ribbon width checks); keep the rain-ribbon checks.
  - Add: `HOME_SCENE_DEFAULTS.weather` Normal on Today gives `meterSpeed` 0.4 (the logged Normal-meter issue).
- [ ] **Step 2: Run** `pnpm tsx scripts/verify-trade-scene.ts`. Expected: FAIL (type errors on `scene.heat`).
- [ ] **Step 3: Implement.** `resolveScene` no longer imports `thermalWalk` or `relativeHeatFlow`; `resolveKitAssembly` returns `mode` and `water` only. Delete the heat ribbon: `heat-ribbons.tsx`, `reflected-ribbon.tsx`, and from `lib/ribbon-paths.ts` `HeatRibbonPaths`, `heatRibbonPaths`, `summerBounce`, `barrierArc`; `RoofAtticFlows` keeps only its rain branch for now (Task 6 adds the arrows). Remove from `KIT_FLOW` and `KIT_FLOW_COLORS` whatever only the heat ribbon read (confirm each with `grep -rn` before deleting; keep `reflected` and `sky`, which Task 6 reuses). Delete `reading-value.ts` and index readings directly (`heat.readings[reading]`). The section, the canvas's `renderReading` and the fallback use `targets.heat?.readings`. The kit's pins iterate `SECTION_READING_IDS`; `roofAtticReadingRider` and `roofAtticReadingPoint` take a `SectionReadingId`. The home's `ReadingLabels` and the canvas keep showing only the section's three ids until Task 3 (iterate `SECTION_READING_IDS`).
- [ ] **Step 4: Run** `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsx scripts/verify-construction-model.ts`, `pnpm tsc`, `CI=1 pnpm lint`. Expected: all pass. Run `grep -rn "thermalWalk\|relativeHeatFlow\|heatRibbonPaths\|readingValue\|ThermalReadings" src/features scripts/verify-trade-scene.ts`. Expected: no hits in `src/features/trade-scenes` other than the frozen look-dev files; list any other consumer in the report.
- [ ] **Step 5: Commit** every file above by path, message `feat(trade-scenes): the scene reads the heat table, and the meter reads a mild month in Normal`.

### Task 3: Pins on the wall and window, and the glass's own colour

**Files:**
- Modify: `src/features/trade-scenes/constants/home-anchors.ts` (`READING_ANCHORS`)
- Modify: `src/features/trade-scenes/constants/home-scene-copy.ts` (`READING_COPY.labels`)
- Modify: `src/features/trade-scenes/constants/home-thermal-zones.ts`, `lib/home-paint-temperatures.ts`, `ui/components/home-kit/house-shell.tsx`
- Modify: `src/features/trade-scenes/ui/components/home-kit/reading-labels.tsx`, `home-scene-canvas.tsx`, `home-scene-fallback.tsx`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `READING_IDS`, `HomeReadings` (Task 1); `SceneTargets.heat` (Task 2).
- Produces: `READING_ANCHORS: Record<HomeRoofForm, Record<ReadingId, [number, number, number]>>`; `'window'` in `HOME_THERMAL_ZONES`; `homePaintTemperatures(...).window` = `readings.window`, or `(outside + setpoint) / 2` with no readings.

The sunlit wall is the left wall (`HOUSE_WALLS.left`, x = −`HOUSE.halfLength`, the only wall `facesSummerSun` picks); its window is at z 0.4. Starting points, tuned by screenshot:
- `wall-outside`: `[-HOUSE.halfLength - 0.05, HOUSE.floorY + 1.7, -2.2]`
- `wall-inside`: `[-HOUSE.halfLength + HOUSE.wallThickness + 0.05, HOUSE.floorY + 1.6, 2.4]`
- `window`: `[-HOUSE.halfLength + HOUSE.wallThickness, HOUSE.floorY + 1.55, 0.4]`
Same points for both roof forms. Labels for both forms: `'wall-outside': 'Wall, outside'`, `'wall-inside': 'Wall, inside'`, `window: 'Window glass'`.

- [ ] **Step 1: Write the failing checks**: every `ReadingId` has a label in both forms and an anchor in both forms; `homePaintTemperatures` with readings returns `sunlit === readings['wall-outside']` and `window === readings.window`; with `readings: null` in Rain, `window` is finite.
- [ ] **Step 2: Run** `pnpm tsx scripts/verify-trade-scene.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `ReadingLabels`, the canvas pins and the fallback list iterate `READING_IDS`; the kit stays on `SECTION_READING_IDS`. In `HouseShell`, wrap the glass `MergedBoxes` in `<group userData={thermalTag('window')}>`.
- [ ] **Step 4: Run** the script, `pnpm tsc`, `CI=1 pnpm lint`. Expected: pass. Then screenshot `/dashboard/labs/trade-scene` with Thermal on, inland Summer, at 1280×800 and 1024×768 (app nav open), light and dark. Sign in first by navigating to `http://localhost:3002/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET from .env.local>&redirect=/dashboard/labs/trade-scene`, using a local Playwright script (never print the secret). Expected: six pins, none overlapping another or the dock, the glass coloured apart from the wall. Move the three new points until that holds.
- [ ] **Step 5: Commit** by path, message `feat(trade-scenes): temperature pins on the sunny wall and its window`.

### Task 4: The comet arrow

**Files:**
- Create: `src/features/trade-scenes/lib/arrow-stations.ts`, `lib/heat-arrow-lane.ts`, `constants/heat-arrow-look.ts`, `ui/lib/create-comet-texture.ts`, `ui/components/heat-arrows.tsx`
- Modify: `src/features/trade-scenes/types.ts`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `HEAT_ARROW_SCALE`, `HEAT_FLOW_STOPPED` (Task 1).
- Produces:
  ```ts
  // types.ts
  export type Vec3 = readonly [number, number, number]
  export interface ArrowLane { points: readonly Vec3[], count: number, speed: number }
  export interface ArrowStation { position: Vec3, direction: Vec3, fade: number }
  // lib/heat-arrow-lane.ts
  export function heatArrowLane(points: readonly Vec3[], flow: number): ArrowLane
  // lib/arrow-stations.ts
  export function arrowStations(lane: ArrowLane, seconds: number): ArrowStation[]
  // constants/heat-arrow-look.ts
  export const HEAT_ARROW_LOOK = { size: { home: 0.55, kit: 0.22 }, edgeFade: 0.12, colors: { head: '#e4572e', tip: '#f7d38a', tail: '#f48a3c' }, renderOrder: 10 } as const
  // ui/components/heat-arrows.tsx
  export function HeatArrows(props: { lanes: readonly ArrowLane[], size: number, fade?: RefObject<number> }): JSX.Element | null
  ```
- `heatArrowLane`: `count = flow < HEAT_FLOW_STOPPED ? 0 : Math.max(1, Math.round(flow * arrowsAtFull))`; `speed = speedAtLeast + (speedAtFull - speedAtLeast) * clamp(flow, 0, 1)`.
- `arrowStations`: arrows evenly spaced along the polyline's length L; arrow i sits at `s = (i * L / count + seconds * speed) mod L`; `direction` is the unit tangent of the segment holding `s`; `fade` rises 0 → 1 over the first `edgeFade · L` and falls back over the last, so arrows appear and vanish softly at the lane's ends. A lane with count 0 or fewer than two points gives `[]`.
- The comet, pointing along +x (spec §3.1): tail `M-24,0 L-3,-2.4 L-3,2.4 Z` filled with a gradient from `tail` at opacity 0 to `tip` at 0.95; head `M7,0 L-5,-6 L-2,0 L-5,6 Z` filled `head` → `tip`, stroked `tip` 0.6 wide, round joins; a soft glow under both (canvas `shadowBlur` or a blurred pass). Draw it onto a 2D canvas about 256 × 96 px into a `CanvasTexture`, once, shared.
- `HeatArrows`: one `InstancedMesh` of a unit quad for every arrow of every lane; per-instance attributes centre (vec3), direction (vec3) and fade (float), rewritten each frame; a `ShaderMaterial` whose vertex shader turns the quad to face the camera and lines its long axis up with the direction projected on screen, `size` metres long. Additive blending, `transparent`, `depthTest: false`, `depthWrite: false`, `toneMapped: false`, `renderOrder` from the look. Each frame it calls `state.invalidate()` so the arrows never stop; it reads `useSceneMotion()` (`shared/components/scene/contexts/scene-motion-context.ts`) and with reduced motion uses `seconds = 0` and requests no frames. Brightness follows `fade.current` when given. It allocates nothing per frame and disposes geometry, material and attributes on unmount; the texture is module-level.

- [ ] **Step 1: Write the failing checks**: `heatArrowLane(points, 1)` gives count 5 and speed 1.2; `(points, 0.01)` gives count 0; `(points, 0.05)` count 1; `(points, 0.5)` count 3 (rounded 2.5 → 3) and speed 0.775. On a straight lane `[[0,0,0],[2,0,0]]`, count 4, speed 1: at seconds 0 the positions' x are `[0, 0.5, 1, 1.5]` and every direction is `[1, 0, 0]`; at seconds 2 (one full lap) positions equal those at 0; at seconds 0.25 the first x is 0.25; the arrow at x 0 has fade 0 and the one at x 1 has fade 1. On an L-shaped lane `[[0,0,0],[1,0,0],[1,1,0]]` count 4 at seconds 0, the station at s 1.5 is `[1, 0.5, 0]` with direction `[0, 1, 0]`. A lane with count 0 gives `[]`. Review Focus 5: `arrowStations(lane, 0)` called twice gives deep-equal results.
- [ ] **Step 2: Run** `pnpm tsx scripts/verify-trade-scene.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the five files.
- [ ] **Step 4: Run** the script, `pnpm tsc`, `CI=1 pnpm lint`. Expected: pass. (The component is seen on screen in Task 5.)
- [ ] **Step 5: Commit** by path, message `feat(trade-scenes): the comet heat arrow, a camera-facing sprite that keeps moving`.

### Task 5: Arrows through the whole home

**Files:**
- Create: `src/features/trade-scenes/constants/home-heat-lanes.ts`, `lib/home-heat-lanes.ts`
- Modify: `src/features/trade-scenes/ui/components/home-kit/home-kit.tsx`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `heatLaneFlows`, `HomeHeat` (Task 1); `heatArrowLane`, `ArrowLane`, `HeatArrows`, `HEAT_ARROW_LOOK` (Task 4); `SceneTargets.heat` (Task 2).
- Produces:
  ```ts
  // constants/home-heat-lanes.ts: the home's fixed lanes, in world metres, drawn as for summer (outside → in)
  export interface RoofHeatLane { sky: Vec3, covering: Vec3, atticFloor: Vec3, room: Vec3, coveringBounceTo: Vec3, barrier: Vec3, barrierBounceTo: Vec3 }
  export const HOME_ROOF_HEAT_LANES: Record<HomeRoofForm, readonly RoofHeatLane[]>   // three lanes over the near slope's cut, clear of the roof anchor pin
  export const HOME_WALL_HEAT_LANES: readonly { outside: Vec3, inside: Vec3, bounceTo: Vec3 }[]  // two lanes on the left (sunny) wall, clear of its window and the meter
  // lib/home-heat-lanes.ts
  export function homeHeatLanes(form: HomeRoofForm, heat: HomeHeat, season: Season): ArrowLane[]
  ```
  Window lanes are derived, not listed: one per opening of every wall in `HOUSE_WALLS`, from 0.9 m outside the glass centre to 0.9 m inside it along the wall's `outward`.
- `homeHeatLanes` with `f = heatLaneFlows(heat)`: for each roof lane, in summer three lanes `[sky, covering]`, `[covering, atticFloor]`, `[atticFloor, room]` with flows `f.roof[0..2]`; in winter `[room, atticFloor]`, `[atticFloor, covering]`, `[covering, sky]` with `f.roof[0..2]` (season comes from `seasonOf(weather)`, so Normal runs as summer). Bounce lanes only in summer and only with flow above `HEAT_FLOW_STOPPED`: `[covering, coveringBounceTo]` at `f.coveringBounce`, `[barrier, barrierBounceTo]` at `f.barrierBounce`. Each wall lane: summer `[outside, inside]` at `f.wall` plus `[outside, bounceTo]` at `f.wallBounce`; winter `[inside, outside]` at `f.wall`. Each window lane: summer outside → inside, winter reversed, at `f.window`. Every lane goes through `heatArrowLane`; lanes with count 0 are dropped.
- `HomeKit` renders `<HeatArrows lanes={…} size={HEAT_ARROW_LOOK.size.home} />` only when `thermal && !ghosted && weather !== 'rain' && targets.heat !== null`, with the lanes memoised on `form`, `targets.heat` and the season. It sits outside the `house` group so the ghost and thermal paint leave it alone.

- [ ] **Step 1: Write the failing checks** on `homeHeatLanes` for the default pitched home: inland Summer Today has 3 roof lanes × 3 segments, 2 wall lanes and 5 window lanes, and no bounce lanes (a regular shingle bounces nothing); the full build with cool roof adds covering and barrier bounce lanes, and its room-segment arrow total is below Today's; inland Winter Today's roof lanes start at the lane's `room` point and end at `sky`, with no bounce lanes; the sum of counts on the room segments equals `3 * heatArrowLane([], f.roof[2]).count` (Summer) and on the room-side segments in Winter `3 * heatArrowLane([], f.roof[0]).count`.
- [ ] **Step 2: Run** `pnpm tsx scripts/verify-trade-scene.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, placing the lane points from the house geometry constants (`HOUSE`, `RIDGE_Y`, `WALL_TOP_Y`, `HOUSE_WALLS`) so the roof lanes cross the cut slope into the visible attic and down into the rooms.
- [ ] **Step 4: Run** the script, `pnpm tsc`, `CI=1 pnpm lint`. Expected: pass. Screenshot (as in Task 3) Thermal on: inland Summer Today and full build with cool roof, coastal Winter Today and build, Normal, and Rain (no arrows), at 1280 and 1024, light and dark. Expected: arrows readable from a normal viewing distance, not an orange wash, visible against the hot thermal colours (if they wash out, add a thin darker edge to the comet texture), fewer and slower on the build, bouncing off the cool roof and barrier, running outward in Winter. Turn Thermal off and on, and zoom in and out: the arrows go and the canvas stops requesting frames once the burst ends (check with the browser's performance panel or a frame counter in the Playwright script). With reduced motion emulated, the arrows hold still.
- [ ] **Step 5: Commit** by path, message `feat(trade-scenes): heat arrows through the roof, the sunny wall and every window`.

### Task 6: Arrows up close

**Files:**
- Create: `src/features/trade-scenes/lib/kit-line-spans.ts`, `lib/kit-heat-lanes.ts`
- Modify: `src/features/trade-scenes/lib/ribbon-paths.ts` (imports the moved helpers), `constants/roof-attic-flows.ts` (`KIT_FLOW.barrierBounce`)
- Modify: `src/features/trade-scenes/ui/components/assembly-kits/roof-attic/roof-attic-flows.tsx`, `roof-attic-kit.tsx`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `heatLaneFlows`, `HomeHeat` (Task 1); `AssemblyKitProps.heat` (Task 2); `heatArrowLane`, `HeatArrows`, `HEAT_ARROW_LOOK` (Task 4).
- Produces:
  ```ts
  // lib/kit-line-spans.ts: moved out of ribbon-paths.ts unchanged
  export interface LineSpan { partId: string, inner: RibbonPoint, outer: RibbonPoint }
  export function lineSpans(form: HomeRoofForm, parts: readonly ResolvedPart[], peel: number): LineSpan[]
  export function lift(...), faceHeights(...)   // whatever rainRibbonPath still needs
  // lib/kit-heat-lanes.ts
  export function kitHeatLanes(form: HomeRoofForm, parts: readonly ResolvedPart[], heat: HomeHeat, season: Season, peel: number): ArrowLane[]
  ```
- `kitHeatLanes`, with the spans inside → out and `f = heatLaneFlows(heat)`: points `sky = covering.outer + KIT_FLOW.sky[form]`; `atticTop` = the insulation span's outer face, else the ceiling's outer face; `room = ceiling.inner` lowered by `KIT_FLOW.room`. Summer: `[sky, covering.outer]` at `f.roof[0]`; `[covering.outer, …each span's faces outward → in down to atticTop]` at `f.roof[1]`; `[atticTop, ceiling.inner, room]` at `f.roof[2]`; covering bounce `[covering.outer, covering.outer + KIT_FLOW.reflected[form]]` at `f.coveringBounce`; barrier bounce `[barrier.inner, barrier.inner + KIT_FLOW.barrierBounce[form]]` at `f.barrierBounce`. Winter: the same three paths reversed, flows `f.roof[0..2]` from the room side, no bounce. No spans gives `[]`. Lanes with count 0 are dropped.
- `KIT_FLOW.barrierBounce: Record<HomeRoofForm, Vec2>`, a short upward offset back toward the deck (start from `[-0.35, 0.3]` pitched, `[0.25, 0.3]` low-slope, tuned by eye).
- `RoofAtticFlows` draws `<HeatArrows lanes={kitHeatLanes(form, targets.parts, heat, seasonOf(weather), easedPeel)} size={HEAT_ARROW_LOOK.size.kit} fade={fade} />` when `weather !== 'rain' && targets.mode === 'thermal' && heat !== null`, in every view (not only Thermal); its rain branch is unchanged. Memoise the lanes on the parts, the heat, the season and the eased peel.

- [ ] **Step 1: Write the failing checks** for gable and flat (`shingleR11`, `flatR11`): Summer Today's first lane starts at `sky` and the last main lane ends at `room`; the full build with cool roof (gable: `TEAR_OFF`; flat: `TORCH_DOWN`; plus `ATTIC_REPLACEMENT`, `RADIANT_BARRIER`) has a covering bounce lane and a barrier bounce lane and fewer arrows on the room lane than Today; Winter's first lane starts at `room`; `kitHeatLanes` with peel 1 moves the covering lane's points by the covering's `KIT_PEEL` offset compared with peel 0. The rain-ribbon checks still pass unchanged.
- [ ] **Step 2: Run** `pnpm tsx scripts/verify-trade-scene.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Move the span helpers first and confirm the rain checks still pass before writing `kitHeatLanes`.
- [ ] **Step 4: Run** the script, `pnpm tsc`, `CI=1 pnpm lint`. Expected: pass. Screenshot up close on the gable and the flat roof, Summer Today vs build, Winter, Normal, Rain (rain ribbon only), with Thermal off and on, peel at 0 and 1, light and dark. Expected: arrows follow the layers as they peel, thin out at the insulation, bounce off the cool covering and the barrier, never cover the part pins; backing out of up close removes them.
- [ ] **Step 5: Commit** by path, message `feat(trade-scenes): heat arrows through the roof section, in place of the ribbon`.

### Task 7: Tracker

**Files:**
- Modify: `docs/plans/2026-10-16-trade-scenes-epic.md` (status line 3, §2 row TS3b.2, §6 change log)

- [ ] **Step 1:** Set the status line to "TS3b.2 built, awaiting the owner's review; TS3b.3 next", mark row TS3b.2 `[x] built <date> (unmerged)` with the commit range and this plan's path, and add a change-log line saying what the build decided beyond the spec (any target or effect changed in Task 1 Step 4, the final pin points, anything the screenshots forced).
- [ ] **Step 2:** Run `CI=1 pnpm lint` and `pnpm tsc`. Expected: pass.
- [ ] **Step 3: Commit** the tracker together with this plan and the spec, by path:
  ```bash
  git add docs/plans/2026-10-16-trade-scenes-epic.md docs/superpowers/plans/2026-10-21-heat-through-the-whole-home.md docs/superpowers/specs/2026-10-21-heat-through-the-whole-home-design.md
  git commit -m "docs(trade-scenes): TS3b.2 heat through the whole home, spec, plan and tracker"
  ```
