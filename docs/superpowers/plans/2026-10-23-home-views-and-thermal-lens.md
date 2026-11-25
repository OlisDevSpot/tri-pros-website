# The home, its views and the thermal lens (TS3b.3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Home scene opens on a Complete, closed house; the rep opens it to today's cutaway (Partly open) and puts the Thermal lens on either view; the foundation is drawn as built, every switch eases, and no rafter pokes through the roof.

**Architecture:**
- **Home view input.** A new drawing-only input `homeView` sits beside the existing `thermalCamera` boolean, which stays as the Thermal lens. Neither enters `SceneResolveInputs`. Unlike the thermal camera, a home view change wakes the home (it joins `sceneBurstKey`), so residents move again as the house opens *(owner, 2026-10-23)*.
- **One fade mechanism.** Every house part that only one home view or one foundation draws sits under a fade-tagged wrapper group, named for the state it shows in: `complete` (the parts Partly open cuts away), `partly-open` (the parts drawn only to finish the cut), `raised`, `slab`. The home's one fade function multiplies the ghost by those fade levels, and the thermal paint gives each fade combination its own materials, so the front of the house can fade without dimming the rest. It runs whenever the ghost **or any fade level** is below 1, including on a late mount or a repaint.
- **House on a lift group.** The house and everything anchored to it (readings, arrows, the up-close kit) ride on one lift group, eased to the foundation's floor height. Ground-standing foundation parts sit in a scaled ground frame. Neither group carries `userData`.
- **One ease.** The ghost, the open share and the floor height ease together in one `useEased([ghost, open, floorY], apply)`, so each frame runs the home's fade once.

**Tech Stack:** Next.js 15, React 19, three.js via @react-three/fiber (`frameloop="demand"`), Tailwind v4, zustand scene store, lucide icons, shadcn `Switch`.

**Spec:** `docs/superpowers/specs/2026-10-23-home-views-and-thermal-lens-design.md` (owner approved 2026-10-23). Tracker `docs/plans/2026-10-16-trade-scenes-epic.md` R34, R38, R40, R69, R72–R76.

## Global Constraints

- **Worktree:** branch `feat/trade-scenes-foundation`. Commit by explicit path only. Never `git add -A`, stash, reset, `checkout --`, `--amend` or push. Run `git diff --cached --name-only` before each commit and commit only the task's files. Never stage this plan; stage the tracker only in Task 8. Each commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The pre-commit hook takes about 110 s, so give `git commit` a 300 s timeout.
- **No DB writes**, dev included, for any test or screenshot.
- **SDD workspace:** `.superpowers/sdd/2026-10-23-home-views-and-thermal-lens/` (briefs, `perf-baseline.md`, shots).
- **Another session may edit trade-scenes UI files in parallel.** Never revert a change you did not make. If a file you are about to edit has changed under you, build on what is there.
- **Verification is these three commands, all passing:**
  - `pnpm tsx scripts/verify-trade-scene.ts` prints `verify-trade-scene: ok`;
  - `pnpm tsc` exits 0;
  - `CI=1 pnpm eslint scripts/verify-trade-scene.ts src/features/trade-scenes src/shared/components/scene` exits 0.
- **Never run `pnpm build`.**
- **Never start, stop or restart a dev server.** :3002 is the owner's. Screenshot rounds run as subagents against it, signing in through `/api/dev/playwright-session`, and never print `DEV_LOGIN_SECRET` or a session token.
- **Do not touch** `src/shared/components/scene/`, `eslint.config.js`, `package.json`, `src/features/meeting-visualizations/`, `/dashboard/labs/roof-cutaway`, or the cutaway look-dev files (`ui/views/cutaway-look-view.tsx`, `ui/components/look-dev/*`, `constants/look-dev-*.ts`).
- **Code rules:** comments say why, never what, and never cite plans, specs or tasks. One component per file. Constants in `constants/`, pure helpers in `lib/`, three.js helpers in `ui/lib/`. Named exports. A kit component's own box lists may stay module-level in its file, as `foundation.tsx` and `rooms.tsx` do today; any list a verify check reads moves to `constants/`. ("Part", not "piece", in comments: `CONTEXT.md`.)
- **Never mention solar** anywhere: code, copy or comments.
- **Glossary terms** (`CONTEXT.md`): *home view* (`complete | partly-open`), *lens* (Thermal is the one lens). Avoid "view mode", "mode", "Normal" (that word is the weather), "X-ray", "layer" and "overlay" in names and copy, and "closed" / "closing" for the Complete house *(owner, 2026-10-23: names use `complete`)*. "Rise" is the opening move; "lift" is only the foundation's lift group.
- **Working numbers** (offsets, ring points, heights, step sizes, standoffs) start at the values given here and are tuned by screenshot in Task 8. A comment says they are working numbers, as the existing ones do.

## Review Focus

0. **A part that mounts after the house settled.** On a settled Partly open (ghost 1, `complete` 0), tapping Tri Pros build mounts new covering, foil and blanket under the near slope's cut-away part, and a thermal repaint hands meshes fresh materials. Each must take the fade at once, never draw solid over the open rooms. The test is Task 2, `homeFadeNeeded`, and Task 8's Tri Pros build shot on Partly open.
1. **Switching the lens or the home view mid-transition.** Turning Thermal on or off while the house is opening swaps every mesh's material. The swapped materials must take the current fade at once, so nothing pops opaque and the back walls never dim with the front. The test is Task 2, `fade survives a repaint`.
2. **Back-and-forth taps.** Tapping Complete, Partly open, Complete before an ease settles reverses from where the house is. `useEased` already does this; the test is Task 8's mid-move frames, which include one reversal.
3. **Going up close from a raised Complete home.** Up close, the kit, its pins and the camera land on the lifted roof, and backing out returns to the Complete house. The tests are Task 3, `liftedFraming`, and Task 8's up-close shots on raised.
4. **An unknown foundation draws as slab.** That means floor 0.15, no steps and no crawl space. The test is Task 3, `homeFloorY(null)`.
5. **Rain on the Complete home.** It shows no arrows and no readings, the rain still reaches the ground around a raised house, and the downspouts touch the ground on both foundations. The tests are Task 3's downspout check and Task 8's rain shot on raised.

---

### Task 1: The home view input and the dock's View pop-out

**Files:**
- Create: `src/features/trade-scenes/ui/components/dock/view-picker.tsx` (named for the dock's View button, as `weather-picker.tsx` is for Weather)
- Modify: `src/features/trade-scenes/types.ts`, `constants/scene-controls.ts`, `constants/home-scene-defaults.ts`, `constants/scene-control-icons.ts`, `constants/home-scene-copy.ts`, `lib/scene-burst-key.ts`, `ui/components/dock/scene-dock.tsx`, `scripts/verify-trade-scene.ts`
- Delete: `constants/view-modes.ts`, `lib/view-mode-of.ts`, `ui/components/dock/view-mode-picker.tsx`

**Interfaces:**
- Produces:
  - `HOME_VIEWS = ['complete', 'partly-open'] as const`, in `constants/scene-controls.ts` beside `SCENE_VIEWS` and `SCENE_WEATHERS`
  - `type HomeView = typeof HOME_VIEWS[number]`
  - `TradeSceneInputs.homeView: HomeView`, defaulting to `'complete'`
  - `HOME_VIEW_ICONS: Record<HomeView, LucideIcon>`, which is `{ 'complete': PanelTopIcon, 'partly-open': PanelTopOpenIcon }` (`HouseIcon` is already the Home tab's)
  - `THERMAL_ICON = FlameIcon`
  - `HOME_VIEW_LABELS: Record<HomeView, string>`, top level in `home-scene-copy.ts` like `WEATHER_LABELS`
  - `DOCK_COPY.homeView`, `DOCK_COPY.thermal`
  - `ViewPicker()`

- [ ] **Step 0: Measure the baseline frame time,** before any edit in this plan. A subagent measures frame time on the opening view at 1280×800 on the lab page on :3002 (today's only look, the cutaway, with Thermal on so the arrows keep the canvas drawing). The script averages `requestAnimationFrame` deltas over 3 s. It writes the number to the SDD workspace as `perf-baseline.md`.

- [ ] **Step 1: Write the failing checks.** In `scripts/verify-trade-scene.ts`, replace the two `viewModeOf` asserts (and its import) with:

```ts
assert.deepEqual(HOME_VIEWS, ['complete', 'partly-open'], 'the two home views, Complete first')
assert.equal(HOME_SCENE_DEFAULTS.homeView, 'complete', 'the scene opens on the Complete home')
assert.equal(HOME_SCENE_DEFAULTS.thermalCamera, false, 'the scene opens with no lens')
// A type-level check: tsc fails here if the home view ever joins what resolveScene reads.
const homeViewIsDrawingOnly: 'homeView' extends keyof SceneResolveInputs ? never : true = true
assert.ok(homeViewIsDrawingOnly)
const partlyOpen: TradeSceneInputs = { ...HOME_SCENE_DEFAULTS, homeView: 'partly-open' }
assert.notEqual(sceneBurstKey(partlyOpen), sceneBurstKey(HOME_SCENE_DEFAULTS), 'opening the house wakes the home')
```

- [ ] **Step 2: Run** `pnpm tsx scripts/verify-trade-scene.ts`. Expected: it fails, because `HOME_VIEWS` does not exist yet.

- [ ] **Step 3: Implement.**
  - **Types:** add `HomeView` to `types.ts` and drop `ViewMode` and its `VIEW_MODES` import. Add `homeView` to `TradeSceneInputs`. Add the home view to the drawing-only list in the existing comment above `SceneResolveInputs` (`types.ts:73`) rather than a second comment.
  - **Default:** `homeView: 'complete'`.
  - **Wake:** `sceneBurstKey` adds `state.homeView`, and its comment says the home view wakes the home (residents move as the house opens), unlike the thermal camera.
  - **Icons:** `HOME_VIEW_ICONS` and `THERMAL_ICON` replace `VIEW_MODE_ICONS`.
  - **Copy:** `HOME_VIEW_LABELS = { 'complete': 'Complete', 'partly-open': 'Partly open' }`. `DOCK_COPY` becomes `view: 'View', weather: 'Weather', homeView: 'Home view', thermal: 'Thermal', thermalHint: <unchanged>`, its `satisfies` updated.
  - **`ViewPicker`:**
    - A `SegmentedField` for the home view: label `DOCK_COPY.homeView`, options `HOME_VIEWS`, labels `HOME_VIEW_LABELS`, icons `HOME_VIEW_ICONS`; it writes `homeView`.
    - A row with a `Label htmlFor` and the shadcn `Switch` (`@/shared/components/ui/switch`, its id from `useId`). The whole row is the tap target, at least `min-h-11` like the `SegmentedField` cells, since the switch itself is only 18 px tall. The row reads `DOCK_COPY.thermal` and writes `thermalCamera`.
    - Today's hint line under it.
  - **`SceneDock`:** its View button icon is `thermalCamera ? THERMAL_ICON : HOME_VIEW_ICONS[homeView]`, and the pop-out renders `ViewPicker`.
  - **Clean-up:** delete the three old files. Grep `ViewMode`, `viewModeOf`, `VIEW_MODE` across `src/features/trade-scenes` and `scripts/verify-trade-scene.ts` (proposal-flow has its own unrelated `ViewMode`); nothing may remain there.

- [ ] **Step 4: Run** the three Global Constraints commands. Expected: all pass.

- [ ] **Step 5: Commit** the files above: `feat(trade-scenes): the home view input, Complete by default, with the Thermal lens beside it`.

---

### Task 2: Fades that can dim one part of the house

**Files:**
- Create: `src/features/trade-scenes/constants/home-fades.ts`, `src/features/trade-scenes/lib/home-fade-needed.ts`
- Modify: `src/features/trade-scenes/types.ts`, `ui/lib/apply-ghost.ts`, `ui/lib/thermal-paint-set.ts`, `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - `HOME_FADES = ['complete', 'partly-open', 'raised', 'slab'] as const`: each names the state its parts show in (a home view or a foundation)
  - `type HomeFade = typeof HOME_FADES[number]`
  - `type HomeFadeLevels = Readonly<Record<HomeFade, number>>`; the kit's own ref is a mutable `Record<HomeFade, number>`
  - `HOME_FADES_SHOWN: HomeFadeLevels`, with every level at 1
  - `HOME_FADE_TAGS: Readonly<Record<HomeFade, Readonly<{ homeFade: HomeFade }>>>`, in `constants/home-fades.ts`: one fixed object per fade, never written to (so R3F never rewrites a group's `userData`)
  - `homeFadeNeeded(ghost: number, levels: HomeFadeLevels): boolean`: true when the ghost or any level is below 1
  - `applyGhost(root: Object3D, opacity: number, levels?: HomeFadeLevels): void`
- **How a wrapper is tagged:** a wrapper group takes `userData={HOME_FADE_TAGS[…]}`, carries no position or thermal tag of its own, and nests inside or outside the thermal-tagged groups.

- [ ] **Step 1: Write the failing checks** in `scripts/verify-trade-scene.ts`, using real three objects. Build this tree, every mesh with its own `MeshStandardMaterial`:

```ts
// scene ─ exterior (thermalTag('exterior')) ─ root
//   root ─ completeGroup (HOME_FADE_TAGS.complete) ─ front, raisedGroup (HOME_FADE_TAGS.raised) ─ nested
//   root ─ back, backTwin
applyGhost(root, 1, { ...HOME_FADES_SHOWN, complete: 0.4 })
near(front.material.opacity, 0.4, 1e-9, 'a part of the Complete house takes its fade')
assert.equal(front.material.transparent, true, 'a faded part draws see-through')
assert.equal(front.material.depthWrite, false, 'below half it stops writing depth')
assert.equal(back.material.opacity, 1, 'the rest of the house keeps its opacity')
assert.equal(back.material.transparent, false, 'and stays solid')
applyGhost(root, 1, { ...HOME_FADES_SHOWN, complete: 0 })
assert.equal(front.visible, false, 'a part faded all the way out costs no draw')
applyGhost(root, 0.15)
near(front.material.opacity, 0.15, 1e-9, 'with no levels, the ghost is today\'s ghost')
assert.equal(front.visible, true, 'and the part is drawn again')
applyGhost(root, 0.5, { ...HOME_FADES_SHOWN, complete: 0.4, raised: 0.5 })
near(nested.material.opacity, 0.1, 1e-9, 'fades multiply with the ghost')
// a subtree woken later still finds the fade tags above it
applyGhost(front, 1, { ...HOME_FADES_SHOWN, complete: 0.4 })
near(front.material.opacity, 0.4, 1e-9, 'fade tags are read up to the scene, not only inside the root')
// the guard the home's scan uses: a settled Partly open still needs its fade on a late mount or a repaint
assert.equal(homeFadeNeeded(1, HOME_FADES_SHOWN), false, 'a whole house at full strength needs no pass')
assert.equal(homeFadeNeeded(1, { ...HOME_FADES_SHOWN, complete: 0 }), true, 'a settled Partly open does')
assert.equal(homeFadeNeeded(0.15, HOME_FADES_SHOWN), true, 'and so does the ghost')
const late = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
completeGroup.add(late)
applyGhost(late, 1, { ...HOME_FADES_SHOWN, complete: 0 })
assert.equal(late.visible, false, 'a part mounted after the house opened stays hidden')
// thermal paint keeps a faded part's material apart
const set = createThermalPaintSet(<the values the existing paint checks use>)
paintThermal(scene, set, new Set())
assert.notEqual(front.material, back.material, 'a part of the Complete house gets its own paint, so fading it leaves the back walls alone')
assert.equal(backTwin.material, back.material, 'two parts with the same zone and no fade still share one paint')
applyGhost(root, 1, { ...HOME_FADES_SHOWN, complete: 0.4 })
near(front.material.opacity, 0.4, 1e-9, 'fade survives a repaint')
assert.equal(back.material.opacity, 1, 'the back wall\'s paint stays solid')
restoreThermalPaint(set)
```

- [ ] **Step 2: Run** the verify script. Expected: it fails, because `HOME_FADE_TAGS` does not exist yet.

- [ ] **Step 3: Implement.**
  - **`applyGhost`:**
    - A mesh's final opacity is `opacity` times the product of `levels[fade]` over every ancestor carrying a `homeFade` tag, up to the scene root (`parent === null`), not just to `root`.
    - Walk `root`'s own ancestors once for the starting product, then pass the product down a recursive walk. Do not walk each mesh's ancestors: this runs on every ease frame.
    - The transparent, depthWrite and castShadow rules use that final opacity.
    - A mesh is hidden when its final opacity is 0. Record its own visibility the way `ghostCastShadow` is recorded (`userData.ghostVisible ??= object.visible`), so a mesh's own `visible` survives. No home component toggles `visible` today.
    - No `levels` means every level is 1.
  - **`thermal-paint-set.ts`:**
    - `tagOf` also returns `fades`, a bitmask in `HOME_FADES` order. It keeps walking to `root` until it has the zone, the part and every fade tag.
    - `surfaceFor` keys on `(fades * HOME_PAINT_KEYS.length + keyIndex) * 3 + side`, still a number.
    - `wearsPaint` and `paintFor` take the mask through.
    - Decals stay keyed by their original material.

- [ ] **Step 4: Run** the three commands. Expected: all pass, and the existing paint checks are unchanged (the script has no ghost checks before this task).

- [ ] **Step 5: Commit**: `feat(trade-scenes): fade one part of the house without dimming the rest, under the thermal camera too`.

---

### Task 3: The floor at the foundation's height, the house riding on it

**Files:**
- Create: `lib/home-floor-y.ts`, `lib/lifted-framing.ts`, `lib/indoor-side.ts`, `lib/has-outdoor-unit.ts`, `lib/downspout-boxes.ts`, `ui/lib/apply-home-floor.ts`
- Modify: `constants/home-geometry.ts`, `constants/home-details.ts`, `ui/components/home-kit/foundation.tsx`, `house-shell.tsx`, `home-equipment.tsx`, `gable-roof.tsx`, `low-slope-roof.tsx`, `home-kit.tsx`, `ui/components/home-scene-canvas.tsx`, `scripts/verify-trade-scene.ts`

All paths are under `src/features/trade-scenes/` except the script.

**Interfaces:**
- Consumes: `HOME_FADE_TAGS`, `HomeFadeLevels`, `HOME_FADES_SHOWN`, `homeFadeNeeded`, `applyGhost(root, opacity, levels)` (Task 2).
- Produces:
  - **Geometry constants:**
    - `HOME_FLOOR_Y = { slab: 0.15, raised: 0.75 } as const`. `HOUSE.floorY` keeps 0.45 as the height the house is drawn at. Its comment becomes a trap warning: it is not the floor's real height, which is `homeFloorY`, and the lift group carries the difference.
    - `FRONT_DOOR: WallOpening`, which is `{ along: -0.6, width: 0.95, sill: 0, head: 2.1 }`. It sits at the end of `YARD.walk`.
    - `FRONT_STEPS = { risers: 4, tread: 0.28, width: 1.3 }`, in `home-details.ts`.
    - `FLOOR_FRAMING` and `PIERS` move from `foundation.tsx` to `constants/home-geometry.ts` so the script can check them. The piers hang from the girders (see Step 4).
  - **Pure helpers:**
    - `homeFloorY(foundationType: FoundationType | null): number`
    - The raised share is `normalizeOnScale(y, { min: HOME_FLOOR_Y.slab, max: HOME_FLOOR_Y.raised })` (`@/shared/components/scene/lib/normalize-on-scale`), clamped to 0..1, with no helper of its own.
    - `liftedFraming(framing: CameraFraming, lift: number): CameraFraming`
    - `indoorSide(weather: Weather, hvacComponents: HVACComponent | null): 'heating' | 'cooling' | null`, moved out of `home-equipment.tsx`
    - `hasOutdoorUnit(hvacType: HVACType | null, hvacComponents: HVACComponent | null): boolean`, moved out of `home-equipment.tsx` (`type === 'central' && hvacComponents !== 'furnace'`, unknown drawn as central), so the rule lives in one place
    - `downspoutBoxes(form: HomeRoofForm): BoxSpec[]`: the downspout and drain boxes today built inside `gable-roof.tsx` and `low-slope-roof.tsx`, now running down to `-(HOME_FLOOR_Y.raised - HOUSE.floorY)`
  - **`applyHomeFloor(lift: Object3D, ground: Object3D, floorY: number): void`:**
    - `lift.position.y = floorY - HOUSE.floorY`
    - `ground.position.y = -(floorY - HOUSE.floorY)`
    - `ground.scale.y = (floorY - HOUSE.floorThickness) / (HOUSE.floorY - HOUSE.floorThickness)`
  - **`Foundation({ ground }: { ground: Ref<Group> })`:** always mounts both sets, which the fades show and hide.
  - **`HomeKit` gains `children?: ReactNode`.** They are drawn on the lift group, outside the ghosted house group.
  - **Neither the lift group nor the ground frame carries `userData`.** The thermal paint walks the whole scene, and only the untagged lift group keeps it off the up-close kit, the arrows and the anchors.

- [ ] **Step 1: Write the failing checks:**

```ts
assert.equal(homeFloorY(null), HOME_FLOOR_Y.slab, 'an unknown foundation draws as slab')
assert.equal(homeFloorY('slab'), 0.15, 'a slab floor sits just above grade')
assert.equal(homeFloorY('raised'), 0.75, 'a raised floor sits up over its crawl space')
assert.ok(HOME_FLOOR_Y.raised - HOUSE.floorThickness - FOUNDATION.joistDepth >= 0.4572, 'at least 18 in under the joists')
assert.ok(HOME_FLOOR_Y.raised / FRONT_STEPS.risers <= 0.196, 'no riser taller than 7 3/4 in')
const lifted = liftedFraming({ position: [1, 2, 3], target: [4, 5, 6], fov: 35 }, 0.3)
assert.deepEqual(lifted, { position: [1, 2.3, 3], target: [4, 5.3, 6], fov: 35 }, 'the zoom rises with the house')
// three Groups: ground is a child of lift, as in the kit
applyHomeFloor(lift, ground, HOME_FLOOR_Y.raised)
near(lift.position.y + ground.position.y, 0, 1e-9, 'the ground frame stays on the ground')
near(lift.position.y + ground.position.y + ground.scale.y * (HOUSE.floorY - HOUSE.floorThickness), HOME_FLOOR_Y.raised - HOUSE.floorThickness, 1e-9, 'and reaches the floor\'s underside')
assert.ok(Math.abs(FRONT_DOOR.along - YARD.walk.position[0]) <= (YARD.walk.size[0] - FRONT_DOOR.width) / 2, 'the door opens onto the walk')
const raisedLift = HOME_FLOOR_Y.raised - HOUSE.floorY
const bottomOf = (boxes: readonly BoxSpec[]) => Math.min(...boxes.map(b => b.position[1] - b.size[1] / 2))
const topOf = (boxes: readonly BoxSpec[]) => Math.max(...boxes.map(b => b.position[1] + b.size[1] / 2))
for (const form of HOME_ROOF_FORMS) assert.ok(bottomOf(downspoutBoxes(form)) + raisedLift <= 1e-9, 'the downspouts reach the ground on a raised floor')
const girders = FLOOR_FRAMING.filter(b => b.size[0] > b.size[2])
near(topOf(PIERS), bottomOf(girders), 1e-9, 'the piers meet the girders')
near(bottomOf(PIERS) + raisedLift, 0, 1e-9, 'and stand on the ground on a raised floor')
```

- [ ] **Step 2: Run** the verify script. Expected: it fails on the missing exports.

- [ ] **Step 3: Implement the pure tier.** Write the helpers and constants above. Delete `SLAB_EDGE`.

- [ ] **Step 4: Rebuild `Foundation`.**
  - **Ground frame.** A `<group ref={ground}>` holds every ground-standing box, drawn from local y 0 up to `HOUSE.floorY - HOUSE.floorThickness`:
    - the slab;
    - the skirt, including a front skirt the cut used to leave off;
    - the crawl ground;
    - the steps.
  - **Fade sets:**
    - The slab sits under `HOME_FADE_TAGS.slab`.
    - The skirt, piers, floor framing, crawl ground, vents and steps sit under `HOME_FADE_TAGS.raised`.
    - The front skirt also sits under `HOME_FADE_TAGS.complete`, and so do the front vents at `CRAWL_VENTS_X`. Task 4 fades them; until then they show.
  - **Steps:** `FRONT_STEPS.risers` boxes run from grade up to the floor at `FRONT_DOOR.along` and stand out from the front wall. They grow and fold with the ground scale and the raised fade.
  - **No framing through the foundation wall** *(owner, 2026-10-23)*. Every joist and girder stops inside the skirt's inner faces, so on a raised home no beam end shows through the foundation wall. A verify check asserts every `FLOOR_FRAMING` box lies within `|x| ≤ L − T` and `|z| ≤ D − T`.
  - **Hung under the floor.** Outside the ground frame, the floor framing, the vents and the **piers** hang at fixed depths under the floor. Each pier hangs from its girder and is sized for the raised floor (`HOME_FLOOR_Y.raised - HOUSE.floorThickness - FOUNDATION.joistDepth - FOUNDATION.girderDepth`), so it meets the girder at every height and stands on grade when raised. Scaled with the ground frame, it would stop about 0.21 m short of the girders.
- [ ] **Step 5: Rebuild `HouseShell`.** Its stucco always stops at the floor's underside (`HOUSE.floorY - HOUSE.floorThickness`), and the foundation shows below it. Drop its `foundationType` prop.
- [ ] **Step 6: Extend the downspouts.** `gable-roof.tsx` and `low-slope-roof.tsx` draw `downspoutBoxes(form)`, so they touch the ground on either foundation. On a slab the extra length sits under the lawn.
- [ ] **Step 7: Restructure `HomeKit`.**
  - **Ground level:** `WeatherSky`, `Yard`, the rain and a new ground group stay at ground level. The ground group is ghosted with the house and carries no `userData` of its own. It draws `{hasOutdoorUnit(...) && <group userData={thermalTag(indoorSide(...) ?? 'interior')}><CondenserUnit load={coolingLoad} burst={burst} /></group>}` directly: one rule, no wrapper component. `HomeEquipment` no longer draws the condenser.
  - **Lift group:** a lift group holds the ghosted house group (Foundation included), `HomeAnchorsLayer`, `ReadingLabels`, `HeatArrows` and `children`.
  - **One ease:** `useEased([ghostTarget, homeFloorY(property.foundationType)], apply)`. Task 4 adds the open share as a third value. Its `apply`:
    - sets `ghost.current`;
    - calls `applyHomeFloor`;
    - sets `levels.current.raised = share` and `levels.current.slab = 1 - share`, where `share` is the raised share of `y`;
    - runs the home's fade once.
  - **The home's fade is one local function:** `applyGhost(house, ghost.current, levels.current)` and `applyGhost(groundGroup, ghost.current, levels.current)`. Every place that calls `applyGhost` today calls it instead: the ease, the scan and the thermal effect.
  - **Scan:** the scan's guard becomes `homeFadeNeeded(ghost.current, levels.current)`, not `ghost.current < 1`. The ground group gets a scan of its own with the same body, so a condenser mounting while zoomed takes the ghost.
- [ ] **Step 8: Wire the canvas.** `HomeSceneCanvas` passes `AssemblyKitHost` as `HomeKit`'s children, and rewrites its "outside the home's groups" comment to say the kit rides the lift group but sits outside the ghosted, painted house group. The zoom framing becomes `liftedFraming(anchors[kit.anchor].framing, homeFloorY(inputs.property.foundationType) - HOUSE.floorY)`. The part focus is an offset from that framing, so it follows without a change.
- [ ] **Step 9: Run** the three commands. Expected: all pass.
- [ ] **Step 10: Commit**: `feat(trade-scenes): the house sits at its foundation's height, steps up to a raised floor, and rises or settles when it changes`.

---

### Task 4: The Complete home, and opening it

**Files:**
- Modify: `constants/home-geometry.ts`, `constants/home-palette.ts`, `ui/components/home-kit/house-shell.tsx`, `roof-slope.tsx`, `roof-covering.tsx` (and the covering layouts it calls, if the seam needs it), `gable-roof.tsx`, `low-slope-roof.tsx`, `attic-floor.tsx`, `rooms.tsx`, `foundation.tsx`, `home-kit.tsx`, `ui/components/home-scene-canvas.tsx`, `scripts/verify-trade-scene.ts`
- Create: `ui/lib/rise-fade-group.ts`

**Interfaces:**
- Consumes: `HOME_FADE_TAGS.complete` and `HOME_FADE_TAGS['partly-open']`, the home's fade function, its levels and its one ease (Tasks 2–3), `FRONT_DOOR` (Task 3), `TradeSceneInputs.homeView` (Task 1).
- Produces:
  - **`FRONT_WALL: HouseWall`:** `{ run: 'x', line: HOUSE.halfDepth - HOUSE.wallThickness / 2 + FRONT_WALL_PROUD, outward: 1, from: -HOUSE.halfLength + HOUSE.wallThickness, to: HOUSE.halfLength - HOUSE.wallThickness, openings: [{ along: -4, width: 1.4, sill: 0.95, head: 2.15 }, { along: 1.3, width: 1.2, sill: 0.95, head: 2.15 }] }`. It stays out of `HOUSE_WALLS`, so Partly open and the rooms' paint never see it.
  - **`FRONT_WALL_PROUD = 0.003`:** the partitions, the floors and the side rooms' paint all end at z = `HOUSE.halfDepth`, the cut face Partly open shows. A front wall whose outer face sat on that plane would flicker against their end faces, so it stands 3 mm proud.
  - **`HOME_OPENING_RISE = 0.3`:** how far the Complete house's cut-away parts rise as they fade.
  - **`HOME_PALETTE.door`:** a painted front-door colour.
  - **`riseFadeGroup(root: Object3D, fade: HomeFade, rise: number): void`:** sets `position.y` on every object under `root` whose userData is that fade's tag. The rise is divided by the parent's world y scale, so a part inside the scaled ground frame (the front skirt) rises the same distance as the rest.
  - **`HomeKit` gains `open: boolean`** and exposes `openShare: RefObject<number>`, the eased 0..1, to the arrows it renders (Task 5).
- **What `open` means:** `HomeSceneCanvas` passes `open = homeView === 'partly-open' || zoom !== null`. Up close always opens the house and leaves the input alone.

- [ ] **Step 1: Write the failing checks:**

```ts
near(FRONT_WALL.line + HOUSE.wallThickness / 2, HOUSE.halfDepth + FRONT_WALL_PROUD, 1e-9, 'the front wall stands just proud of the cut face'); assert.equal(FRONT_WALL.outward, 1)
const front = [...FRONT_WALL.openings, FRONT_DOOR].sort((a, b) => a.along - b.along)
front.forEach(o => assert.ok(o.along - o.width / 2 >= FRONT_WALL.from && o.along + o.width / 2 <= FRONT_WALL.to, 'every front opening fits its wall'))
front.slice(1).forEach((o, i) => assert.ok(o.along - o.width / 2 - (front[i].along + front[i].width / 2) >= 0.3, 'front openings keep a pier between them'))
assert.equal(FRONT_DOOR.sill, 0, 'the door opens at the floor')
assert.ok(!Object.values(HOUSE_WALLS).includes(FRONT_WALL), 'the open house never draws the front wall')
```

  `riseFadeGroup` gets a three check. A tagged group under a root moves to the rise, and an untagged sibling stays at 0. A tagged group under a parent scaled 1.7 in y ends at the same world height as an unscaled one.
- [ ] **Step 2: Run** the verify script. Expected: it fails.
- [ ] **Step 3: Add the Complete house's parts.** Each goes in one `HOME_FADE_TAGS.complete` wrapper per component, with no position of its own:
  - **`HouseShell`:** the front wall.
    - Stucco from `wallBoxes(FRONT_WALL, …, [...FRONT_WALL.openings, FRONT_DOOR])`. It sits under `thermalTag('sunlit')` or untagged by `facesSummerSun(0, 1)`, as the other walls do.
    - Window frames and glass through `windowBoxes`, the glass under `thermalTag('window')`.
    - A door leaf and frame in `FRONT_DOOR`'s opening, the leaf in `HOME_PALETTE.door`, under the same thermal tag as the front wall's stucco.
    - The front wall is drawn full thickness in stucco; no room paint goes on its inside face *(Claude's call: the inside only shows through the glass)*.
  - **`GableRoof`:**
    - `<RoofSlope face="front" zFrom={-ROOF_HALF_LENGTH} zTo={HOUSE.cutX} trimmedEnds={['from']} …/>` (the prop names say z, but along the ridge they run in x).
    - **No seam at `cutX`.** Today each `RoofSlope` lays its covering out from its own `zFrom`, so shingle tabs and tile pans would restart at the cut and draw a straight joint from eave to ridge. Both near-slope parts lay their covering out on one grid running from `-ROOF_HALF_LENGTH`, each keeping only the parts in its own span, with the same seed. No rafter is drawn twice at `cutX`.
    - The front gutter's missing run, from `-ROOF_HALF_LENGTH` to `HOUSE.cutX`.
  - **`LowSlopeRoof`:**
    - The deck and membrane over the front left (`x` from −L to `cutX`, front half).
    - The seams over it.
    - A front parapet between the side parapets (not overlapping their ends), the left parapet's front half, and their coping.
  - **`AtticFloor`:** the joists and the blanket from `HOUSE.atticFrontZ` to `HOUSE.halfDepth - HOUSE.wallThickness`, for every joist that does not already run the full span.
  - **`Rooms`:** the ceiling over the same span.
  - **`Foundation`:** the front skirt and front vents are already tagged (Task 3).
- [ ] **Step 4: Tag the parts drawn only to finish the cut.** Every part today's cutaway draws only because the house is open goes in a `HOME_FADE_TAGS['partly-open']` wrapper, so the Complete house does not draw it inside its own shell. One example is the low-slope kitchen's front fascia (`low-slope-roof.tsx:47-48`), which would otherwise stand in front of the new front parapet. The builder lists every part they tag in the commit message.
- [ ] **Step 5: Open and close.**
  - The home's one ease gains a third value, `open ? 1 : 0`.
  - Its `apply` sets `openShare.current = value`, `levels.current.complete = 1 - value` and `levels.current['partly-open'] = value`. It calls `riseFadeGroup(house, 'complete', HOME_OPENING_RISE * value)`, then runs the home's fade once.
  - The camera never moves for this.
- [ ] **Step 6: Wire the canvas.** `HomeSceneCanvas` reads `homeView` and passes `open`.
- [ ] **Step 7: Run** the three commands. Expected: all pass.
- [ ] **Step 8: Commit**: `feat(trade-scenes): the Complete home, closed all round, opening to Partly open in front of the homeowner`.

---

### Task 5: Heat arrows on the Complete house

**Files:**
- Create: `lib/inside-house.ts`
- Modify: `constants/home-heat-lanes.ts`, `lib/home-heat-lanes.ts`, `types.ts`, `ui/components/heat-arrows.tsx`, `ui/components/home-kit/home-kit.tsx`, `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `FRONT_WALL` (Task 4), `openShare` (Task 4), `heatLaneFlows`, `heatArrowLane`, `bounceArrowLane`, the resolved roof covering's material (`partState(parts, <covering part>)`).
- Produces:
  - **`insideHouse(point: Vec3, form: HomeRoofForm): boolean`:** true inside the walls' footprint (`|x| < halfLength`, `|z| < halfDepth`), above grade, and below the roof's underside. On pitched, the underside is `RAFTER_ORIGIN_Y + (halfDepth - |z|) * tan(pitch)`. On low-slope, it is `LOW_SLOPE_DECK_Y`.
  - **`type CompleteRoofLane = Pick<RoofHeatLane, 'sky' | 'covering' | 'coveringBounceTo'>`**, in `types.ts` beside `RoofHeatLane`.
  - **`HOME_COMPLETE_ROOF_HEAT_LANES: Record<HomeRoofForm, readonly CompleteRoofLane[]>`:**
    - Pitched: today's pitched roof lanes mirrored onto the near slope at z `+0.8` (the covering height from `COVERING_Y` read with `-Math.abs(z)`), with the bounce `[0.3, 1.3, 0.9]`.
    - Low-slope: today's `sky`, `covering` and `coveringBounceTo` as they are (the membrane is in sight from the yard).
  - **`LANE_STANDOFF = 0.05`:** outside legs stop this far off the face they strike.
  - **`coveringStandoff(covering: string | null): number`** (with its table in `constants/home-heat-lanes.ts`, keyed by the covering material ids `RoofCovering` already switches on, plus a default): how far above `COVERING_BASE` a roof lane stops on each covering. This keeps the arrowheads from being buried under tile crowns (`TILE.radius` 0.105 in `lib/home-roof-layout.ts`). Shingles start near `LANE_STANDOFF`; tile starts near the crown height. These are working numbers.
  - **`COMPLETE_WALL_LANE_REACH ≈ 1.2`:** how far out from the wall the Complete house's wall lanes start. Today's lane `outside` sits only 0.3 m off the wall, which would leave a 0.25 m lane: a strobing clump of 0.55 m arrows.
  - **`homeHeatLanes(form, heat, season, homeView: HomeView, covering: string | null)`:** today's builder gains the home view. `'partly-open'` returns today's lanes unchanged. `'complete'` returns the outside legs only. The run and bounce closures, the flow lookup and the winter reversal are shared, not copied. The window lanes come from a `windowLanes(walls, …)` helper, no longer the module-level `WINDOW_LANES`, so the Complete set can include `FRONT_WALL`.
  - **`HeatArrows` gains `depthTest?: boolean`** (default false).

- [ ] **Step 1: Write the failing checks** for summer and winter, pitched and low-slope, using the `sceneHeat` helper already in the script:

```ts
const completeLanes = homeHeatLanes(form, heat, season, 'complete', 'shingle')
for (const lane of completeLanes) lane.points.forEach(p => assert.ok(!insideHouse(p, form), 'no arrow on the Complete house goes inside it'))
for (const lane of completeLanes) assert.ok(laneLength(lane) >= 2 * HEAT_ARROW_LOOK.size.home, 'every outside lane is long enough to read as moving heat')
assert.ok(HOME_COMPLETE_ROOF_HEAT_LANES.pitched.every(l => l.covering[2] > 0), 'on the Complete gable the sun lands on the near slope')
// winter runs each lane outward: the roof lane starts on the covering
const winterRoof = homeHeatLanes('pitched', winterHeat, 'winter', 'complete', 'shingle')[0]
assert.deepEqual(winterRoof.points[0], <HOME_COMPLETE_ROOF_HEAT_LANES.pitched[0].covering stood off for shingles>)
// tile: the lanes stop above the crowns
assert.ok(<the tile roof lane's covering end y> >= <shingle's> + TILE.radius * 0.8, 'arrows on tile land on the crowns')
// one window lane per window, the front's included (LISTED_POINTS gains the Complete roof and wall points first)
assert.equal(windowLanes(completeLanes).length, Object.values(HOUSE_WALLS).flatMap(w => w.openings).length + FRONT_WALL.openings.length)
// the open house's lanes are unchanged: the existing homeHeatLanes checks run on 'partly-open' as they are
```

  `laneLength` is a small helper local to the script. The script's `windowLanes` (`verify-trade-scene.ts:746`) filters by the points in `LISTED_POINTS`, so the Complete set's roof and wall points join that set first. Roof flows: summer's outer leg is `flows.roof[0]` and winter's is `flows.roof[2]`, as `homeHeatLanes` already does. There is no barrier bounce on the Complete house, since the foil is inside.
- [ ] **Step 2: Run.** Expected: it fails.
- [ ] **Step 3: Implement** the helpers above.
  - **Walls:** from x `-HOUSE.halfLength - COMPLETE_WALL_LANE_REACH` to x `-HOUSE.halfLength - LANE_STANDOFF` (every wall lane is on the left wall today), plus today's wall bounce.
  - **Windows:** every window of `HOUSE_WALLS` and `FRONT_WALL`, from `line + outward * WINDOW_LANE_REACH` to `line + outward * (HOUSE.wallThickness / 2 + LANE_STANDOFF)`.
  - **Roof:** stops `coveringStandoff(covering)` above the covering's base.
  - **Direction:** winter reverses every run.
  - **`HeatArrows`:**
    - It sets `material.depthTest` from the prop in a layout effect and invalidates.
    - In its frame callback it sets the instanced mesh's `visible = brightness > 0`, so a set faded all the way out does not draw on frames the other set asks for.
- [ ] **Step 4: Render both lane sets.** In `HomeKit`, both mount under today's conditions (Thermal on, not zoomed, not rain, heat present):
  - the Complete lanes with `depthTest` and `fade={completeArrowFade}`, a ref the open ease sets to `1 - value`;
  - today's lanes with `fade={openShare}`.
  - Rewrite the comment above them (`home-kit.tsx:151`): the sets stay mounted and fade, and a set faded to 0 stops asking for frames and stops drawing.
  - Depth-tested arrows behind the house (the back windows' outside legs) are hidden by it. That follows the owner's ruling that arrows hide behind surfaces on the Complete home only (tracker §6, 2026-10-23). Partly open keeps today's arrows.
- [ ] **Step 5: Run** the three commands. Expected: all pass.
- [ ] **Step 6: Commit**: `feat(trade-scenes): on the Complete house the heat shows only outside, the sun landing on the near slope`.

---

### Task 6: Every reading on a callout, rings on the Complete house

**Files:**
- Modify: `constants/home-anchors.ts`, `ui/components/callout-pin.tsx`, `ui/components/home-scene-canvas.tsx`, `scripts/verify-trade-scene.ts`

The ring stays on the reading's own spot inside *(owner, 2026-10-23)*. The pins are drawn over the canvas and never hidden behind the house, so from outside a ring at the inside spot already lands on the house, right over where the reading is taken. A point "on the shell" along the camera's line of sight projects to the same pixel from the opening view. There is no shell point, no second anchor table and no moving anchor.

**Interfaces:**
- Produces:
  - **`INSIDE_READING_IDS = ['attic', 'ceiling'] as const`**, in `home-anchors.ts`: the readings taken inside the house, shown hollow while it is Complete.
  - **`READING_CALLOUTS` becomes a full `Record<ReadingId, ReadingCallout>`** (no longer `Partial`), so tsc enforces a callout for every reading. It gains `attic: { offset: [24, -30] }` and `ceiling: { offset: [-22, 30], narrowOffset: [22, 30] }` (working numbers).
  - **`CalloutPin` gains `hollow?: boolean`.**

- [ ] **Step 1: Write the failing checks:**

```ts
assert.ok(READING_IDS.every(id => READING_CALLOUTS[id] !== undefined), 'every reading stands on a callout')
assert.ok(INSIDE_READING_IDS.every(id => (READING_IDS as readonly string[]).includes(id)), 'the inside readings are readings')
```

  `READING_CALLOUTS` typed as a full `Record` also makes a missing entry a tsc error.
- [ ] **Step 2: Run.** Expected: it fails.
- [ ] **Step 3: Implement.**
  - **`CalloutPin`:** when `hollow`, the dot is an on-media ring with a clear centre, keeping the scrim ring around it. The fill eases with a CSS colour transition lasting about the open ease's second, so the ring fills in as the house opens rather than at the tap.
  - **`HomeSceneCanvas` `renderReading`:** callouts now apply to every reading while `zoom === null`. `hollow` is `zoom === null && !open && INSIDE_READING_IDS.includes(id)`.
  - `ReadingLabels` and `READING_ANCHORS` are unchanged.
- [ ] **Step 4: Run** the three commands. Expected: all pass.
- [ ] **Step 5: Commit**: `feat(trade-scenes): attic and ceiling read on callouts too, as rings on the Complete house`.

---

### Task 7: No rafter through the roof (R34)

**Files:** found by the investigation; expected under `ui/components/home-kit/` and `constants/home-geometry.ts`, plus `scripts/verify-trade-scene.ts`.

- [ ] **Step 1: Take close shots and find the clipping.**
  - A subagent takes close screenshots of the gable on :3002, on both views, from the opening camera orbited in close to the eave, the rake and the ridge.
  - It also shoots up close at peel 0 and peel 1.
  - It marks where any rafter, ridge board or fascia shows through the covering.
- [ ] **Step 2: Find the number at fault.** Check the rafter length against the eave and ridge, the rafter top against the deck underside, the rafters beyond the rake, and the near slope's seam at `cutX`.
- [ ] **Step 3: Write a failing check** in the verify script that pins that number. For example: no rafter's top edge rises above the deck's underside anywhere along the slope.
- [ ] **Step 4: Fix it.** Then run the three commands. Expected: all pass.
- [ ] **Step 5: Confirm by eye.** Re-shoot the same views, and confirm by eye that nothing pokes through.
- [ ] **Step 6: Commit**: `fix(trade-scenes): no rafter shows through the roof`.

---

### Task 8: Screenshot round, tuning, and frame time

**Files:** working numbers only (`constants/home-anchors.ts`, `home-heat-lanes.ts`, `home-geometry.ts`, `home-details.ts`), plus the tracker.

- [ ] **Step 1: One screenshot round, as a subagent.** Brief it on the pattern of `.superpowers/sdd/2026-10-21-heat-through-the-whole-home/shots-callout2-brief.md`. Viewports: 1280×800 and 1024×768 with the panel open, 1440×900 with the panel hidden, light scheme, plus one dark shot. Cover:
  - Complete with no lens: gable and low-slope × slab and raised. Looking for a whole house, a door, steps only on raised, no exposed framing, no seam across the near slope at the cut, no flicker where the partitions and floors meet the front wall, and the condenser line set meeting the wall on both foundations.
  - Complete with Thermal: inland summer Today and Tri Pros build, and coastal winter. Looking for the shell colours, five readings with the attic and ceiling rings, roof arrows on the near slope, no arrow through a surface of the Complete house, and wall arrows reading as moving heat, not a clump.
  - Complete with Thermal on a **tile** roof: the arrowheads land on the crowns, not under them.
  - Partly open with Thermal: today's look, the crawl joists on raised with the piers meeting the girders, and five callouts with no overlap.
  - Raised, Complete and Partly open, close to the foundation wall: no joist or girder end shows through it.
  - Partly open, then Tri Pros build (Review Focus 0): no new covering, foil or blanket drawn solid over the open rooms.
  - Mid-move frames of opening, closing, one reversal mid-ease, and raised ↔ slab. The front skirt and its vents rise together.
  - Up close from a raised Complete home and back. Up close with Thermal: check whether the yard dims with the house's ghost (they may share a paint today); if it does, log it in the tracker as an open item and leave it unfixed.
  - Rain on a raised Complete home: the rain clears the ridge.
  - At 1024 with the panel open on a slab: the roof pin against the dock (the house now sits 0.3 m lower than today). Report it; it stays the known dock item.
- [ ] **Step 2: Frame time.** The same subagent measures frame time as in Task 1 Step 0, on the Complete opening view, and compares it with `perf-baseline.md`. A rise the homeowner could feel on an iPad is a finding; anything over 20% gets reported.
- [ ] **Step 3: Tune and confirm.** Fix every finding in one batch by tuning the working numbers. Confirm with at most one more round.
- [ ] **Step 4: Update the tracker.** The TS3b.3 row becomes "built, awaiting the owner's review", with the commit range, and a change-log line goes under §6. The line must:
  - name every place a plain cut was taken instead of a transition (R73), or say there were none;
  - say whether the inside of the house is drawn while it is fully Complete;
  - list the open items: the no-3D fallback stills (`constants/home-scene-stills.ts`) still show the cutaway and are to be recaptured later *(owner, 2026-10-23)*, and the yard-dimming check, if it failed.
- [ ] **Step 5: Run** the three commands. Expected: all pass.
- [ ] **Step 6: Commit** the tuned constants and the tracker: `fix(trade-scenes): tune the Complete house's callouts, arrows and steps by screenshot`.
