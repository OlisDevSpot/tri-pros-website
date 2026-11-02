# Home Scene Layout and Inputs (TS3b.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Home scene a meeting layout. A tabbed left panel (Home | Upgrades | Savings) collapses to a rail, a right dock holds View and Weather, Today / Tri Pros build floats over the scene, up close becomes a block-built panel screen, and Normal weather is the default. Both bills always count, the camera goes lower, and the black shape behind the home is gone.

**Architecture:**
- **Model.** Normal enters the construction core as a heat weather. A per-weather profile carries the direction, sun share and flow share, so the walk and the ribbons take it with no new branches.
- **Savings.** `sceneSavings` works out both bills every time. A pure `savingsFigures` decides which figures show.
- **UI.** The view is rebuilt from small panel and dock components. The up-close screen reads a block list per assembly from constants.

**Tech Stack:** Next.js 15, React 19, three 0.180, @react-three/fiber 9, @react-three/drei 10, zustand 5, Tailwind v4, shadcn (Tabs, Popover, ToggleGroup, Button), lucide.

**Spec:** `docs/superpowers/specs/2026-10-20-home-scene-layout-and-inputs-design.md` (owner approved 2026-10-20). Requirements register: `docs/plans/2026-10-16-trade-scenes-epic.md` §3b. The rows are R39, R48, R49, R53, R54, R56, R57, R58, R59 and R62.

## Global Constraints

- **Worktree and branch:**
  - Worktree: `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/trade-scenes`, branch `feat/trade-scenes-foundation`.
  - Never `cd` to the main checkout. Never use `git -C`.
- **Dev server:**
  - The owner runs it, on port 3002.
  - Before any screenshot step, check with `ss -ltnp | grep 3002`. If nothing listens, stop and ask the owner to start `pnpm dev`. Never start it yourself.
- **Verification:**
  - `pnpm tsc` and `CI=1 pnpm lint`. **Never `pnpm build`.**
  - Scripts are linted with `CI=1 pnpm exec eslint <files>`.
- **Tests:**
  - Pure logic is proved by `tsx` assertion scripts (`pnpm tsx scripts/<name>.ts`). There is no test runner, and adding one is out of scope.
  - UI is proved by Playwright screenshots in our own browser. Auth: `http://localhost:3002/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET>&role=super-admin&redirect=/dashboard/labs/trade-scene`.
  - Viewports: iPad landscape 1180×820 and 1024×768, and laptop 1440×900.
- **Commits:**
  - Stage by explicit path (`git add -- <paths>`), then check `git diff --cached --stat`.
  - Never `git add -A`, stash, reset, `checkout --`, `--amend` or push.
  - Messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - After any scripted edit, run `git diff --shortstat -- <file>`. A whole-file diff means the line endings flipped; fix it.
- **No DB writes. Notion is read-only.**
- **Code rules:**
  - One component per file.
  - Constants in `constants/`, hooks in `hooks/`, pure helpers in `lib/`.
  - Named exports.
  - Comments say why, never what. Never cite plans, specs, tasks or R-ids in code.
- **Vocabulary** (`CONTEXT.md` § Trade scene terms):
  - In code an assembly is never a "section" and a part is never a "layer". The up-close screen is the **assembly screen**, and its blocks are `parts` and `peel`. Screen copy may say "Layers".
  - "Tri Pros build" is screen copy only; in code it is `view: 'proposed'`.
  - "Season" lives only inside the heat walk.
- **Tiers:**
  - `src/shared/modules/construction/core/` imports no three.js and nothing from `features/`.
  - three.js loads only through the existing `next/dynamic` canvas.
- **Never touch:**
  - `src/features/meeting-visualizations/`;
  - `/dashboard/labs/roof-cutaway` and `/dashboard/labs/cutaway-look`, including `look-dev-*` constants and `ThermalSeason`;
  - `eslint.config.js` and `package.json`.
- **Placeholders stay labelled.**
  - Every new °F value, sun share and flow share carries the one-line "working number, sourced before release" comment.
  - New copy sits under the existing "Placeholder copy until the owner's copy pass" notes.
- **Copy:** never "your" unless the basis is `recorded`. Never mention solar. Savings are estimates with the asterisk popover.
- **Styling** follows `DESIGN.md` and `docs/design-system/theme-conventions.md`:
  - Command Desk dark on `--presentation-ground`;
  - touch targets at least 44 px (`min-h-11`);
  - font sizes from the type scale only;
  - pop-outs portal out of the stage, so their content carries `dark text-foreground`, as `HomeProfilePopover` does today.

## Review Focus

1. **One bill typed, the other empty.** With $300 electric, no gas, and attic work landed, only the electric figure and repairs show. "Together" sums only the shown figures, and a gas cut never shows as $0. Pinned in Task 3 (`savingsFigures`).
2. **Unticking work while on Today.** Removing a scope, or picking one in a group that is already empty, must not flip the view. Only a pick that adds work switches to the build. Pinned in Task 4 (`scopePreviewPatch`).
3. **A kit that cannot draw Normal.** The home still shows Normal's readings and colours. The kit's targets carry `mode: null`, and the header says the close-up has no Normal view. Pinned in Task 2 (a stub kit without `'normal'`).
4. **Coastal Normal is cooler outside than the thermostat** (74 °F against 76 °F). The sun must still push a little heat in: the ceiling reads above the setpoint, and Today vs build still differs. Pinned in Task 1.
5. **Session storage that throws** (a private window, blocked site data). Collapse and expand still work for the page's life and nothing throws. Pinned in Task 9 (a Playwright run with a throwing `sessionStorage`).

---

### Task 1: Normal weather in the construction model

**Files:**
- Modify: `src/shared/modules/construction/core/types.ts:43-44`
- Modify: `src/shared/modules/construction/core/constants/climate-presets.ts`
- Create: `src/shared/modules/construction/core/lib/season-of.ts`
- Modify: `src/shared/modules/construction/core/lib/thermal-walk.ts`
- Modify: `src/shared/modules/construction/core/lib/relative-heat-flow.ts`
- Modify: `src/shared/modules/construction/core/constants/assemblies/{roof-attic,exterior-wall,hvac-attic,crawl-space}.ts` (the `modes` line)
- Modify: `CONTEXT.md` § Trade scene terms (Weather line; add Heat weather)
- Test: `scripts/verify-construction-model.ts`

**Interfaces:**
- Produces:
  - `type Weather = 'normal' | 'summer' | 'winter' | 'rain'`
  - `type HeatWeather = Exclude<Weather, 'rain'>`
  - `type Season = 'summer' | 'winter'` (unchanged)
  - `CLIMATE_PRESETS: Record<Climate, Record<HeatWeather, { outside: number, setpoint: number }>>`, with Normal set to coastal `{ outside: 74, setpoint: 76 }` and inland `{ outside: 78, setpoint: 76 }`
  - `HEAT_WEATHER_PROFILES = { normal: { season: 'summer', sun: 0.45, flow: 0.35 }, summer: { season: 'summer', sun: 1, flow: 1 }, winter: { season: 'winter', sun: 0, flow: 1 } } as const satisfies Record<HeatWeather, { season: Season, sun: number, flow: number }>`, in `climate-presets.ts`
  - `seasonOf(weather: Weather): Season | null`. Rain gives `null`.
  - `thermalWalk(assembly, parts, weather: HeatWeather, climate): ThermalWalk`
  - `relativeHeatFlow(assembly, parts, weather: HeatWeather, climate): FlowProfile`

- [ ] **Step 1: Write the failing assertions** in `scripts/verify-construction-model.ts`, beside the readings checks. Use the script's own roof-attic parts helpers and `thermalWalk` / `relativeHeatFlow`.
  - `normal: inland ceiling sits between the thermostat and summer's`: `setpoint(76) < normal.innerSurface < summer.innerSurface`, for today's R-11 shingle home.
  - `normal: coastal sun still pushes heat in`: for the same home on the coast, `normal.innerSurface > 76`.
  - `normal: roof surface is cooler than summer's`: `normal.outerSurface < summer.outerSurface`, for both climates.
  - `normal: ribbons carry the flow share`: each of `relativeHeatFlow(..., 'normal', 'inland').boundaries[i]` equals the summer boundary × 0.35, to 1e-9.
  - `normal: build still beats today, by less`: `0 < todayCeiling(normal) − buildCeiling(normal) < todayCeiling(summer) − buildCeiling(summer)`. Use the full build (tear-off, attic replacement, radiant barrier).
  - `seasonOf`: normal → summer, summer → summer, winter → winter, rain → null.
  - `ROOF_ATTIC.modes.normal === 'thermal'`, and the same for `exterior-wall`, `hvac-attic` and `crawl-space`.
  - Every existing summer and winter assertion stays as it is. The profiles' `sun: 1, flow: 1` must leave them unchanged.
- [ ] **Step 2:** Run `pnpm tsx scripts/verify-construction-model.ts`. Expected: FAIL (type errors on `'normal'`).
- [ ] **Step 3: Implement.**
  - **Types:** add the types above.
  - **Presets:** key `CLIMATE_PRESETS` by `HeatWeather`, add `HEAT_WEATHER_PROFILES`, and add `seasonOf`, which reads the profile's `season`. Each new number gets the working-number comment.
  - **`thermalWalk`:** the direction and reflectance come from the profile's `season`. A summer-direction source becomes `outside + SOLAR_GAIN_F * sun * (1 − reflectance)`.
  - **`relativeHeatFlow`:** multiply every boundary by the profile's `flow`. `reflected` stays the raw share.
  - **Assemblies:** add `normal: 'thermal'` beside every `summer: 'thermal'`. Leave `yard-ground` alone.
  - **`CONTEXT.md`:**
    - Weather becomes `normal | summer | winter | rain`, with Normal "a mild average afternoon, the default".
    - Add **Heat weather**: "a weather whose assembly mode can be heat (every weather but rain); carries the season, sun share and flow share the heat walk reads."
- [ ] **Step 4:** Run `pnpm tsx scripts/verify-construction-model.ts` and `pnpm tsx scripts/verify-remodel-roi.ts`. Expected: both pass. Then run `pnpm tsc`. Expected: errors only in `src/features/trade-scenes/` and `scripts/verify-trade-scene.ts`, which are the trade-scene files keyed by `Weather` that Task 2 fixes. Any error elsewhere is this task's to fix.
- [ ] **Step 5: No commit yet.** The tree does not type-check until Task 2, and the commit hook checks it. Task 2's commit carries both, with the message `feat(construction, trade-scenes): Normal weather, a mild afternoon with gentle heat, is the default`.

### Task 2: Normal weather in the trade scene

**Files:**
- Modify (constants):
  - `src/features/trade-scenes/constants/scene-controls.ts` (`SCENE_WEATHERS = ['normal', 'summer', 'winter', 'rain']`)
  - `home-scene-defaults.ts` (`weather: 'normal'`)
  - `scene-control-icons.ts` (`normal: CloudSunIcon`)
  - `weather-skies.ts` (a `normal` sky)
  - `roof-attic-flows.ts` (`KIT_FLOW_COLORS.normal`)
  - `resident-clips.ts` (`normal` acts as summer does)
  - `home-scene-copy.ts`: the `WEATHER_LABELS.normal = 'Normal'`, Normal lead lines, `READING_SEASON_PHRASE` re-keyed by `HeatWeather` with `normal: 'mild afternoon'`, and `READING_COPY.disclosure(climate, weather: HeatWeather)`
  - `home-scene-stills.ts` (`normal: '/scenes/stills/normal.webp'`; the file is captured in Task 10)
  - `home-temperatures.ts`: `RAIN_PRESET_SEASON` becomes `RAIN_PRESET_WEATHER: HeatWeather = 'winter'`
  - `assembly-kits.ts` (roof-attic `weathers` gains `'normal'`)
- Modify (lib):
  - `src/features/trade-scenes/lib/resolve-scene.ts:43-46,94-96`
  - `lib/home-paint-temperatures.ts`: `sunlit` takes `SOLAR_GAIN_F * sun * SUNLIT_WALL_SOLAR_SHARE`. The condenser stays `weather === 'summer'`.
  - `lib/ribbon-paths.ts` (unchanged signature; callers pass a `Season`)
- Modify (ui):
  - `ui/components/home-kit/home-kit.tsx:84,112`: the setpoint from `CLIMATE_PRESETS[climate][weather === 'rain' ? RAIN_PRESET_WEATHER : weather]`; fanning when `seasonOf(weather) === 'summer'`
  - `ui/components/assembly-kits/roof-attic/roof-attic-flows.tsx`
  - `ui/components/assembly-kits/roof-attic/heat-ribbons.tsx`: the prop `season: Season` becomes `weather: HeatWeather`, and the colour is `KIT_FLOW_COLORS[weather]`
  - `ui/components/home-scene-canvas.tsx:71-72`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: Task 1's `HeatWeather`, `seasonOf` and `HEAT_WEATHER_PROFILES`.
- Produces: Normal is a full scene weather and the default. `SCENE_WEATHERS[0] === 'normal'`.
- The Normal sky is a clear, soft day, distinct from summer's peak. Working values:
  - sky top `#8ec0e6`, horizon `#e8e6d8`;
  - sun at `[-8, 15, 10]`, colour `#fff6e6`, intensity 1.8;
  - fill sky `#d6e6f2`, ground `#c8c0a6`, intensity 0.9;
  - bounce `#efe0c4` at 0.55;
  - environment `#f6f4ec` at 0.45;
  - fog 40–95;
  - ground `#8fa35c`, roughness 0.95;
  - window glow 0, room light 0.

  Tune them by eye in Task 10's screenshots.
- `KIT_FLOW_COLORS.normal = '#f6a25e'`: a softer warm than summer's.
- Normal leads (placeholder copy):
  - existing: `'A mild afternoon. A little of the sun\'s heat still works its way down to the ceiling.'`
  - proposed: `'The same mild afternoon, with the new layers in place.'`
- The equipment's indoor side (`home-equipment.tsx` `indoorSide`) stays as it is, so Normal shows neither side. The AC/heat switch arrives in TS3b.2.

- [ ] **Step 1: Write the failing assertions** in `scripts/verify-trade-scene.ts`.
  - `WEATHERS` becomes `SCENE_WEATHERS`, imported. Every per-weather loop now runs Normal.
  - `HOME_SCENE_DEFAULTS.weather === 'normal'`.
  - In Normal, the existing view of the R-11 shingle home has `readings !== null`, `roofAttic.mode === 'thermal'` and `heat !== null`.
  - `normal equipment load is below summer's`, for the same home and view.
  - `today vs build ceiling gap: normal < summer`.
  - `a kit without normal`: register `{ 'roof-attic': { anchor: 'roof', weathers: ['summer', 'winter', 'rain'] } }` as `noNormalKit`. Then `roofAttic(resolveScene(inputs({ weather: 'normal' }), cuts, noNormalKit)).mode === null`, while `.readings !== null`.
  - The heading lead for every view × `SCENE_WEATHERS` is a non-empty string.
- [ ] **Step 2:** Run `pnpm tsx scripts/verify-trade-scene.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the edits listed under Files.
  - In `resolve-scene.ts`, the per-assembly `season` becomes a heat weather: `weather === 'rain' ? null : weather`, typed `HeatWeather | null`, and passed to `thermalWalk` / `relativeHeatFlow`. `comfort` reads `CLIMATE_PRESETS[climate][weather].setpoint` once rain is excluded.
  - In `roof-attic-flows.tsx`, call `heatRibbonPaths(..., seasonOf(weather)!, ...)` inside the `weather !== 'rain'` branch and pass `weather` to `HeatRibbons`.
  - In the canvas, the reading disclosure takes the narrowed weather.
- [ ] **Step 4:** Run `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsx scripts/verify-construction-model.ts`, `pnpm tsc` and `CI=1 pnpm lint`. Expected: all pass.
- [ ] **Step 5: Screenshot** the page at 1180×820 in Normal, Today, with the thermal camera off and on, at home and zoomed into the roof. Normal must read as a clear soft day, with ribbons visibly thinner than Summer's.
- [ ] **Step 6: Commit** Task 1's and Task 2's files together, with Task 1's message.

### Task 3: Both bills, always

**Files:**
- Modify: `src/features/trade-scenes/constants/savings-categories.ts`. `SAVINGS_CATEGORY_BY_WEATHER` is replaced by `SAVINGS_CATEGORIES = ['electric', 'gas'] as const satisfies readonly SavingsCategory[]`.
- Modify: `src/features/trade-scenes/types.ts` (`SceneSavings`)
- Modify: `src/features/trade-scenes/lib/scene-savings.ts` (drop `weather` from the input)
- Modify: `src/features/trade-scenes/lib/resolve-scene.ts:98-109` (the meter)
- Create: `src/features/trade-scenes/lib/savings-figures.ts`
- Modify: `src/features/trade-scenes/constants/home-scene-copy.ts`: delete `SAVINGS_COPY.noBill`; add `savingsOnBuild: 'Savings show with the Tri Pros build.'` and `showBuild: 'Show the Tri Pros build'`
- Modify, to keep compiling until Task 7 replaces it: `src/features/trade-scenes/ui/components/panel/savings-panel.tsx` (render one bill block per category, using `savingsFigures`)
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - `interface SceneSavings { cuts: Record<SavingsCategory, BillCut>, repairsMonthly: number, repairsByTrade: Partial<Record<TradeSlug, Resolved>> }`
  - `sceneSavings(input: { resolved, proposedScopeIds, addOns, bills, repairsOverrides }, cuts, installs?): SceneSavings`. Each category's cut comes from the same `combineCuts` + `cutFor` as today. With nothing landed, the cut is the whole bill.
  - `savingsFigures(savings: SceneSavings): { bills: Record<SavingsCategory, number | null>, repairs: number | null, total: number | null }`:
    - A bill figure is `Math.round(cut.bill) − Math.round(cut.after)` when work landed, the bill is above 0 and the figure is above 0. Otherwise it is `null`.
    - `repairs` is `repairsMonthly` when work landed and the value is above 0. Otherwise it is `null`.
    - `total` is the sum of the non-null figures when at least two are non-null. Otherwise it is `null`.
    - "Landed" means `Object.keys(repairsByTrade).length > 0`, as today.
  - The meter speed is `0` in rain. Otherwise it is `cuts.electric.after / cuts.electric.bill` when an electric bill is typed (the meter is electric), and `equipmentLoad` when none is.

- [ ] **Step 1: Write the failing assertions** in `scripts/verify-trade-scene.ts`. Replace the per-weather `category` block (lines ~149–160) and the rain-null block (~125–126) with these:
  - In every weather × view × scope set, `scene.savings.cuts.electric` and `.gas` both deep-equal the script's own `combineCuts` + `cutFor` result for that category. That includes rain: `bills are facts, the weather never hides one`.
  - The cool-roof part appears in `cuts.electric.parts` exactly when a cool covering is drawn, in every weather. It never appears in `cuts.gas.parts`.
  - The meter, with BILLS set: rain → 0; otherwise `cuts.electric.after / cuts.electric.bill`.
  - `savingsFigures`, with hand-built `SceneSavings`:
    - Electric $300 → after $210, gas $0 bill, repairs 33: `bills.electric === 90`, `bills.gas === null`, `repairs === 33`, `total === 123`.
    - Electric only, with no repairs entry: `total === null`.
    - Nothing landed (`repairsByTrade` empty) with both bills typed: every field `null`.
    - Gas $120 → after $120 (no cut): `bills.gas === null`.
  - The ROI parity cases compare `scene.cuts[category]` to the ROI cut.
- [ ] **Step 2:** Run `pnpm tsx scripts/verify-trade-scene.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces. Rework the interim `savings-panel.tsx` so it compiles: it renders a `BillField`, the figure, the no-cut line and `CutOverride` per category, then repairs and the total from `savingsFigures`.
- [ ] **Step 4:** Run `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsc` and `CI=1 pnpm lint`. Expected: all pass. Run `grep -rn SAVINGS_CATEGORY_BY_WEATHER src scripts`. Expected: no hits.
- [ ] **Step 5: Commit**: `feat(trade-scenes): savings always count both bills, whatever the weather`.

### Task 4: Picking work on Today shows the build

**Files:**
- Create: `src/features/trade-scenes/lib/scope-preview-patch.ts`
- Modify: `src/features/trade-scenes/ui/components/panel/scope-chips.tsx:30-41`
- Modify: `src/features/trade-scenes/constants/home-scene-copy.ts` (`PANEL_COPY.workHint: 'Picking work switches to the Tri Pros build.'`)
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces: `scopePreviewPatch(state: Pick<TradeSceneInputs, 'proposedScopeIds' | 'addOns' | 'view'>, groupScopeIds: readonly string[], nextInGroup: readonly string[], coolRoofSettled: boolean): { patch: Partial<TradeSceneInputs>, settlesCoolRoof: boolean }`.
  - It moves the current `previewGroup` logic out of the component: replacing the group's scopes, and seeding the cool roof once.
  - It adds `view: 'proposed'` only when `state.view === 'existing'` and the next list holds a scope the current one did not.

- [ ] **Step 1: Write the failing assertions.**
  - `today + a pick → build`: from `{ view: 'existing', proposedScopeIds: [] }`, picking `[TEAR_OFF]` in the roof group gives a patch with `view: 'proposed'`.
  - `today + unticking → stays today`: from `{ view: 'existing', proposedScopeIds: [TEAR_OFF] }` with `nextInGroup: []`, the patch has no `view` key.
  - `build + a pick → no view write`: from `view: 'proposed'`, the patch has no `view` key.
  - `cool roof seeds once`: a tear-off with `coolRoofSettled: false` adds `'cool-roof'` and returns `settlesCoolRoof: true`. With `coolRoofSettled: true` the add-ons stay as they were.
- [ ] **Step 2:** Run `pnpm tsx scripts/verify-trade-scene.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `scopePreviewPatch`, and have `ScopeChips` call it and write the patch. The Today hint shows the new `workHint`.
- [ ] **Step 4:** Run `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsc` and `CI=1 pnpm lint`. Expected: all pass.
- [ ] **Step 5: Commit**: `feat(trade-scenes): picking work on Today switches to the Tri Pros build`.

### Task 5: A lower camera, and no black shape behind the home

**Files:**
- Modify: `src/features/trade-scenes/constants/home-geometry.ts:175` (`HOME_ORBIT.maxPolarAngle`)
- Likely modify (decided by Step 1):
  - `src/shared/components/scene/ui/scene-shell.tsx:22,49`: the `camera` prop gains an optional `far`; the default stays 120;
  - `src/features/trade-scenes/ui/components/home-scene-canvas.tsx`: passes `far`;
  - `src/features/trade-scenes/constants/weather-skies.ts` (`SKY_RIG`)

**Interfaces:**
- Produces: `HOME_ORBIT.maxPolarAngle` raised from 1.45 to a value below π/2 (start at 1.53). The camera nears the horizon but never dips under the yard.
- The working hypothesis for the black shape needs Step 1 to confirm it. The sky dome's radius is 95 and the orbit reaches 36 from its target, so the far side of the dome can sit 131 away. The camera's far plane is 120, so the dome is clipped and the clear colour shows through.
  - If that is the cause, the fix is a home camera whose `far` covers `SKY_RIG.domeRadius + HOME_ORBIT.maxDistance` plus a margin, derived from those constants and not hand-typed.
  - The fog and the yard's edge are the other suspects.

- [ ] **Step 1: Diagnose.**
  - Zoom fully out at 1180×820 and orbit until the black shape shows. Screenshot it.
  - Temporarily set the far plane to 400 and look again.
  - Record which of these removes it: far plane, dome radius, fog, or yard. Revert the probe.
- [ ] **Step 2: Fix the cause** that Step 1 found, and raise `maxPolarAngle`. Any new number gets a why-comment.
- [ ] **Step 3: Screenshot** at full zoom-out from four orbit angles, and at the lowest polar angle, in Normal and in Winter (the darkest sky). Expected: no black shape, and the camera never shows under the yard.
- [ ] **Step 4:** Run `pnpm tsc` and `CI=1 pnpm lint`, and `pnpm tsx scripts/verify-scene-primitives.ts` if `scene-shell.tsx` changed. Expected: all pass.
- [ ] **Step 5: Commit**: `fix(trade-scenes): the camera reaches nearer the horizon, and the sky no longer clips behind a zoomed-out home`.

### Task 6: The dock, and Today / Tri Pros build over the scene

**Files:**
- Create:
  - `src/features/trade-scenes/ui/components/dock/scene-dock.tsx`
  - `dock/dock-button.tsx`
  - `dock/view-mode-picker.tsx`
  - `dock/weather-picker.tsx`
- Create: `src/features/trade-scenes/constants/view-modes.ts`:
  - `VIEW_MODES = ['partial-open', 'thermal'] as const`
  - `type ViewMode`, in `types.ts`
  - `viewModeOf(thermalCamera: boolean): ViewMode`
- Modify:
  - `constants/home-scene-copy.ts`: add `DOCK_COPY = { view: 'View', weather: 'Weather', viewModes: { 'partial-open': 'Partial open', 'thermal': 'Thermal' }, thermalHint: <today's thermalCameraHint> }`
  - `constants/scene-control-icons.ts`: `VIEW_MODE_ICONS`
- Modify: `ui/components/panel/view-toggle.tsx`: the toggle sizes to its labels, not `w-full`, and floats.
- Modify: `ui/components/panel/look-drawer.tsx`: an icon-only trigger with an `aria-label`, placed under the dock.
- Modify:
  - `ui/components/panel/weather-controls.tsx`: keeps the climate field only, until Task 7 moves it;
  - `ui/components/panel/story-panel.tsx`: drops `ViewToggle`;
  - `ui/views/trade-scene-view.tsx`: mounts the dock and the floating toggle in the scene area.
- Test: `scripts/verify-trade-scene.ts` (`viewModeOf`)

**Interfaces:**
- Produces:
  - `<SceneDock />` is a vertical strip of `DockButton`s, centred on the scene's right edge: View, then Weather, then the Look trigger under them, smaller.
    - Each button is at least 56×56, with an icon over a short label. It opens a `Popover` with `side="left"`, `align="center"` and `collisionPadding={{ top: 80, bottom: 16, left: 16, right: 16 }}`, so no pop-out covers the toggle.
    - The Weather button's icon is the current weather's icon.
  - `<ViewModePicker />` is a `SegmentedField` over `VIEW_MODES`. It writes `thermalCamera: next === 'thermal'` and carries the thermal hint under it.
  - `<WeatherPicker />` is a `SegmentedField` over `SCENE_WEATHERS` with `WEATHER_ICONS`, in 2 columns.
  - The Today / Tri Pros build toggle sits at `absolute top-4 left-1/2 -translate-x-1/2` in the scene area, above the pins.
  - The third dock button (AC on / Heat on) is not built.

- [ ] **Step 1: Write the failing assertion**: `viewModeOf(false) === 'partial-open'`, `viewModeOf(true) === 'thermal'`.
- [ ] **Step 2:** Run `pnpm tsx scripts/verify-trade-scene.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the files. The zoom's back button (top left), the thermal legend (bottom left) and the dock (right) must not overlap at 1024×768.
- [ ] **Step 4:** Run `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsc` and `CI=1 pnpm lint`. Expected: all pass.
- [ ] **Step 5: Screenshot** at 1024×768 and 1440×900, with the View pop-out open, the Weather pop-out open, and the thermal camera on. Expected: the pop-outs sit beside the dock, the toggle stays uncovered, and every target is at least 44 px.
- [ ] **Step 6: Commit**: `feat(trade-scenes): view and weather move to a dock, and Today / Tri Pros build floats over the scene`.

### Task 7: The tabbed panel: Home, Upgrades, Savings

**Files:**
- Create (in `src/features/trade-scenes/ui/components/panel/`):
  - `scene-panel.tsx`: the aside's content; for now it always shows the tabs (Task 8 adds up close)
  - `panel-header.tsx`: the compact heading, which replaces `story-heading.tsx`
  - `panel-tabs.tsx`
  - `home-tab.tsx`, `home-facts.tsx`
  - `upgrades-tab.tsx`
  - `savings-tab.tsx`, `bill-savings.tsx`, `savings-on-build.tsx`
- Create: `src/features/trade-scenes/constants/panel-tabs.ts`:
  - `PANEL_TABS = ['home', 'upgrades', 'savings'] as const`
  - `type PanelTab`, in `types.ts`
- Modify:
  - `constants/home-scene-copy.ts`: add `PANEL_TAB_LABELS = { home: 'Home', upgrades: 'Upgrades', savings: 'Savings' }`; `PROFILE_COPY.residents` becomes `'Who lives here'`; drop `PROFILE_COPY.trigger` and `intro`
  - `constants/scene-control-icons.ts`: `PANEL_TAB_ICONS`
- Modify: `ui/views/trade-scene-view.tsx`:
  - The aside renders `ScenePanel`. Its starting width is `22rem` beside the scene; Task 10 tunes it.
  - The side-by-side breakpoint must give 1024×768 the side-by-side layout. Measure the stage width there, and set the `@[…]/trade-scene` breakpoint just below it.
  - Phone and portrait still stack the panel under the scene.
- Delete:
  - `panel/home-profile-popover.tsx`, `panel/weather-controls.tsx`, `panel/story-panel.tsx`, `panel/story-heading.tsx`, `panel/savings-panel.tsx`
  - `PANEL_COPY.weather`, `PANEL_COPY.climate`, `PANEL_COPY.thermalCamera*` and `PANEL_COPY.viewGroup`, if no longer read (grep first).

**Interfaces:**
- Consumes: Task 3's `SAVINGS_CATEGORIES` and `savingsFigures`, and Task 4's Today hint.
- Produces:
  - **`<PanelHeader />`:**
    - The eyebrow, then the title one step down from today's `text-3xl`, then the lead in `text-sm` muted.
    - The `kitWeatherMissing` status stays.
    - It has a slot on the right for the collapse control (Task 9).
  - **`<PanelTabs />`:**
    - shadcn `Tabs` with a full-width list of three triggers, each with an icon and label, at least 44 px tall. The content scrolls inside the panel.
    - The active tab is component state, and starts on `home`.
  - **`<HomeFacts />` (home tab):**
    - Climate first (the `CLIMATES` segmented field with `CLIMATE_ICONS`).
    - Then the seven property fields, in `HomeProfilePopover`'s order and with its column counts.
    - Then a "Who lives here" heading with the household and age fields. Every field keeps its Unknown choice.
  - **`<UpgradesTab />`:**
    - One group per registered kit's assembly, in `ASSEMBLY_KITS` order. Each group is labelled from a new `ASSEMBLY_LABELS: Partial<Record<AssemblyId, string>> = { 'roof-attic': 'Roof & attic' }` in `home-scene-copy.ts`. The heading eyebrow is not reused, because it reads "x-rayed".
    - Inside a group, `ScopeChips` for that assembly (it gains an `assemblyId` prop in place of reading `zoom`).
    - The Today hint shows once, at the top.
  - **`<SavingsTab />`:**
    - A `BillSavings` per `SAVINGS_CATEGORIES`:
      - the `BillField`, always;
      - then, in the build, the figure from `savingsFigures(...).bills[category]`, the no-cut line, and `CutOverride`.
    - In the build with work landed, `RepairsLine` follows, then "Together" when `total !== null`.
    - On Today, `SavingsOnBuild` sits under the bill fields: the `savingsOnBuild` line, plus a button that writes `view: 'proposed'`.
- Keep what `SavingsPanel` does today: the one reader of the resolved savings sits at the tab, so typing a bill re-renders only that field.

- [ ] **Step 1: Implement** the files and the view change. Delete the replaced files.
- [ ] **Step 2:** Run `grep -rn "HomeProfilePopover\|WeatherControls\|StoryPanel\|StoryHeading\|SavingsPanel" src scripts`. Expected: no hits.
- [ ] **Step 3:** Run `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsc` and `CI=1 pnpm lint`. Expected: all pass.
- [ ] **Step 4: Screenshot** each tab at 1024×768 and 1440×900:
  - Home with a filled profile;
  - Upgrades on Today: pick a tear-off and check the scene switches to the build;
  - Savings on Today, with the hint and button;
  - Savings in the build with $300 electric and $120 gas, the full build, and the total.

  Then one 390×844 phone screenshot showing the stacked panel still works.
- [ ] **Step 5: Commit**: `feat(trade-scenes): a tabbed panel groups the home's facts, the upgrades and the savings`.

### Task 8: Up close: the assembly screen

**Files:**
- Create: `src/features/trade-scenes/constants/assembly-screens.ts`. `ASSEMBLY_SCREENS: Partial<Record<AssemblyId, readonly AssemblyScreenBlock[]>> = { 'roof-attic': [{ kind: 'peel' }, { kind: 'parts' }] }`. Peel comes first, as the close-up orders it today.
- Modify: `src/features/trade-scenes/types.ts`: `type AssemblyScreenBlock = { kind: 'parts' } | { kind: 'peel' }`. The union grows with the first assembly that carries the owner's copy.
- Create (in `ui/components/panel/`):
  - `assembly-screen.tsx`
  - `assembly-screen-block.tsx`: switches on `kind`
  - `parts-block.tsx`: wraps `PartList` with the emphasis, as `ZoomedParts` did
- Modify:
  - `panel/scene-panel.tsx`: it shows `AssemblyScreen` while `zoom !== null`, and the panel widens (starting at `26rem`);
  - `ui/components/back-to-home-button.tsx`: moves into the assembly screen's top;
  - `ui/components/home-scene-canvas.tsx:117-122`: removes the canvas's back button;
  - `constants/home-scene-copy.ts`: `SCENE_COPY.backToHome` becomes `'Whole home'`.
- Delete: `panel/zoomed-parts.tsx`.
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - `<AssemblyScreen zoom={AssemblyId} />`:
    - "← Whole home" at the top. It writes `{ zoom: null, peel: 0, emphasizedPart: null }`, as the canvas button did.
    - Then the `PanelHeader`, which already speaks for the zoomed assembly.
    - Then the blocks in data order, scrolling inside the panel.
  - An assembly with no screen entry renders the header and back button only.
  - The readings stay as pins on the scene.
  - The dock is unchanged while zoomed.

- [ ] **Step 1: Write the failing assertion**: `every registered kit has an assembly screen with at least one block`. For each key of `ASSEMBLY_KITS`, `ASSEMBLY_SCREENS[key]?.length > 0`.
- [ ] **Step 2:** Run `pnpm tsx scripts/verify-trade-scene.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the files and the move. Delete `zoomed-parts.tsx`.
- [ ] **Step 4:** Run `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsc` and `CI=1 pnpm lint`. Expected: all pass. Run `grep -rn ZoomedParts src`. Expected: no hits.
- [ ] **Step 5: Screenshot** at 1180×820:
  - zoomed into the roof, peel at 0 and at 1, with one layer tapped;
  - after "← Whole home": the panel is back on the tabs, peel reset, nothing emphasized.
- [ ] **Step 6: Commit**: `feat(trade-scenes): up close takes over the panel with the assembly's screen`.

### Task 9: Collapse to a rail

**Files:**
- Create:
  - `src/features/trade-scenes/hooks/use-panel-collapsed.ts`
  - `src/features/trade-scenes/ui/components/panel/panel-rail.tsx`
  - `panel/panel-collapse-button.tsx`
- Create: `src/features/trade-scenes/constants/panel-storage.ts`: `PANEL_COLLAPSED_KEY = 'trade-scene.panel-collapsed'`
- Modify:
  - `panel/scene-panel.tsx` and `ui/views/trade-scene-view.tsx`: the aside narrows to the rail, and the scene widens into the freed space;
  - `constants/home-scene-copy.ts`: `PANEL_COPY.collapse: 'Hide panel'`, `PANEL_COPY.expand: 'Show panel'`.

**Interfaces:**
- Produces:
  - **`usePanelCollapsed(): [collapsed: boolean, setCollapsed: (next: boolean) => void]`:**
    - It reads and writes `sessionStorage[PANEL_COLLAPSED_KEY]` through `useSyncExternalStore`, as `use-session-once.ts` does.
    - Every storage access sits in try/catch, with an in-memory value as the fallback. The server snapshot is `false`.
  - **`<PanelRail />`:**
    - The expand button sits at the top.
    - Under it come three icon buttons with `aria-label`s (Home, Upgrades, Savings), each at least 44×44. Each opens a `Popover` with `side="right"`, holding that tab's content at the open panel's width.
    - While zoomed, the rail instead shows one button that opens the `AssemblyScreen` in the pop-out.
  - The collapse button sits in `PanelHeader`'s slot.
  - Collapse exists only in the side-by-side layout. The stacked phone layout never shows it.

- [ ] **Step 1: Implement** the hook, rail and button, and wire them in.
- [ ] **Step 2:** Run `pnpm tsc` and `CI=1 pnpm lint`. Expected: pass.
- [ ] **Step 3: Playwright checks** at 1180×820:
  - Collapse, then reload: the page still opens collapsed.
  - Each rail pop-out: Home changes the climate, Upgrades picks a tear-off and the scene switches to the build, and Savings types a bill.
  - Zoomed and collapsed: the rail pop-out shows the roof's screen, and "← Whole home" works from it.
  - With `page.addInitScript(() => { Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('blocked') } }) })`: collapse and expand still work, and the console shows no uncaught error.
- [ ] **Step 4:** Screenshot the collapsed layout at 1024×768 and 1440×900, at home and zoomed.
- [ ] **Step 5: Commit**: `feat(trade-scenes): the panel folds to a rail that still reaches every input`.

### Task 10: Layout pass, the Normal still, the full check, and the tracker

**Files:**
- Create: `public/scenes/stills/normal.webp`
- Modify: the widths and spacing in the panel, dock and view files, from the layout pass
- Modify: `CONTEXT.md` § Trade scene terms: add **Scene panel**, **Rail**, **Dock**, **View mode** and **Assembly screen** (whose blocks are `parts` and `peel`)
- Modify: `docs/plans/2026-10-16-trade-scenes-epic.md`: the TS3b.1 row becomes built (unmerged); add a §6 change-log line naming what the build decided (the meter follows the electric bill, and the cause of the black shape)
- Modify: memory `project-3d-trade-scenes.md`: TS3b.1 built; next is the TS3b.2 brainstorm

- [ ] **Step 1: Capture the Normal still.**
  - Settings: Today, home framing, 1180×820 canvas, unknown profile.
  - Method: the same Playwright capture used for the other three stills.
  - Save as webp, about the same size as `summer.webp`.
  - Check it with `pnpm tsx scripts/check-scene-assets.ts`.
- [ ] **Step 2: Layout pass.**
  - Run `/impeccable layout` on `/dashboard/labs/trade-scene`.
  - Decide in it, against `DESIGN.md`: the open and up-close panel widths, the rail and dock widths, the spacing rhythm inside each tab, and the collapse and pop-out motion. Respect `prefers-reduced-motion`.
  - Apply the changes in one batch. Confirm with one more screenshot round, then stop.
- [ ] **Step 3: Screenshot matrix**, at 1180×820, 1024×768 and 1440×900, expanded and collapsed. Cover:
  - each weather × Today and build, at home;
  - zoomed into the roof, with the thermal camera on and off.

  On every screenshot, check that no visible input does nothing in that state.
- [ ] **Step 4: Run every script.** Expected: all pass.
  - `pnpm tsx scripts/verify-construction-model.ts`
  - `pnpm tsx scripts/verify-trade-scene.ts`
  - `pnpm tsx scripts/verify-scene-inputs.ts`
  - `pnpm tsx scripts/verify-scene-primitives.ts`
  - `pnpm tsx scripts/verify-remodel-roi.ts`
  - `pnpm tsx scripts/check-scene-assets.ts`
  - then `pnpm tsc` and `CI=1 pnpm lint`
- [ ] **Step 5:** Update `CONTEXT.md`, the tracker and the memory file.
- [ ] **Step 6: Commit** (the code, still, `CONTEXT.md` and tracker; memory lives outside the repo): `feat(trade-scenes): the meeting layout's spacing, the Normal still, and the tracker`.
