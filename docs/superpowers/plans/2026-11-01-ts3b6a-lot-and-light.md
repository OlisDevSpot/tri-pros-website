# TS3b.6-A: the lot and the light — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The real Home scene gets the spike's lot, neighbours, plants, standalone two-car garage and golden light, built to the scene's contracts, with the sun computed from a day, an hour and the house's bearing.

**Architecture:** New constants and pure functions describe the lot, the garage, the neighbours, the plants and the sun; new components draw them under the `exterior` thermal tag, outside the house's ghost and lift groups. Shared files change only in the hunks spec §11 names. Values are retyped from the spike (`src/features/trade-scenes/realism-spike/`), never imported from it, and the spike is deleted in the last task.

**Tech Stack:** Next.js 15, React Three Fiber 9.8.2, drei 10.7.9, three 0.180, `frameloop="demand"`. Checks are `tsx` assertion scripts (no test runner in this repo).

**Spec:** `docs/superpowers/specs/2026-10-31-ts3b6-lot-garage-and-light-design.md` (approved 2026-11-01; this plan stress-tested the same day, the owner's rulings folded into both). Read §5–§7, §9 and §11 before Task 1. Part 6-B (§8) is not in this plan.

Abbreviations: `F/` = `src/features/trade-scenes/`. "Lot check" = `pnpm tsx scripts/verify-trade-scene-lot.ts`. "Scene check" = `pnpm tsx scripts/verify-trade-scene.ts`. "Types and lint" = the locked `pnpm tsc` and per-file `eslint` in Global Constraints.

## Global Constraints

- Build only after the Attic build has landed and the owner has said "build" (R145). "Go ahead" is not "build".
- Never `pnpm build`. Checks run under the shared lock, per file: `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock pnpm tsc` and `flock … env CI=1 pnpm eslint <every file created or modified>` (this replaces `pnpm lint`). After any `eslint --fix`, run `pnpm tsc` again.
- Never start a dev server. Shots and probes use the owner's server on `http://localhost:3002`.
- Sign in with `/api/dev/playwright-session?…&as=info%40triprosremodeling.com`, never `role=` (that writes to the DB). Read the secret through the t7-lib helper (`.superpowers/sdd/2026-10-24-upgrades-that-follow-the-home/shots/t7-lib.mjs`), never print it. No DB writes of any kind.
- The worktree is shared with other sessions. Follow the standing rules of the last build (`.superpowers/sdd/2026-10-24-upgrades-that-follow-the-home/standing-rules.md`) and the foreign-hunk recipe in `docs/superpowers/handoff/2026-10-30-attic-parallel-build-handoff.md`:
  - Commit by explicit path. Never `git add -A`, never bare `git stash`, never reset or check out another session's file.
  - Never stage `CONTEXT.md` or anything under `docs/**`. The controller edits the tracker and spec in the working tree, unstaged.
  - Before editing a shared file, check `.superpowers/claims/` and `git diff <file>`. If the file holds another session's hunks, stage only your own with `git apply --cached`.
  - `git diff --shortstat` after any scripted edit. `git commit` gets a 300000 ms timeout.
- Nothing in `F/` outside `realism-spike/` may import from `realism-spike/`.
- **No import cycle:** `home-lot.ts` reads `HOUSE` and `HOME_FLOOR_Y` from `home-geometry.ts`, so `home-geometry.ts` never imports `home-lot.ts`. Each would load before the other was ready, and the page would crash. `HOME_FRAMINGS` stays literals.
- **No three.js** in `F/lib/`, `F/constants/` or `F/types.ts`, type-only imports included. `scripts/verify-trade-scene.ts` enforces it (the "imports three.js, so it belongs under ui/" check). Anything that needs three goes in `F/ui/lib/` or a component. The check scripts may import three.
- Shared files change only in the hunks spec §11 names:
  - **Mount and view:** `F/ui/components/home-kit/home-kit.tsx` (the mount), `F/ui/components/home-scene-canvas.tsx` (one prop), `src/shared/components/scene/ui/scene-shell.tsx` (the tone-mapping prop, WebGL branch only).
  - **Constants:**
    - `F/constants/home-geometry.ts`: `YARD`, `HOME_PAN`, `HOME_FRAMINGS`, the right-front pitched `DOWNSPOUTS` entry, and the stale comments on `HOME_ORBIT` (the yard's disc) and on the downspouts (three corners).
    - `F/constants/weather-skies.ts`.
    - `F/constants/home-heat-lanes.ts`.
    - `F/constants/home-anchors.ts` (`READING_CALLOUTS` offsets only).
    - `F/constants/home-life.ts` (the rain fields only).
    - `F/constants/home-palette.ts` (delete `trunk`, `crown`, `shrub` only).
  - **Libs and types:** `F/lib/faces-summer-sun.ts`, `F/lib/home-pan-box.ts`, `F/types.ts` (appended types, the `WeatherSky` shape).
  - **The sky:** `F/ui/components/home-kit/weather-sky.tsx`.
  - **The scene check:** `scripts/verify-trade-scene.ts`, only the assertions this build breaks. Find them by their assertion messages; the line numbers move.
- Surface colours stay: `wear-looks.ts`, `COVERING_COLORS` and every other `home-palette.ts` entry are not edited (§5.2). If a surface reads wrong under AgX, report it with shots.
- Shadow map stays 2048. No `EffectComposer`, no post pass, no ambient occlusion.
- Nothing downloads from another host at runtime. The sky image is self-hosted under `public/scenes/sky/`.
- Budget for 6-A and 6-B together, against the original at the same view (§9): at most +40 draw calls, at most +40k triangles on a flat roof, texture memory at most 8 MB. 6-A reports what it used, so 6-B knows what is left.
- Every geometry a component builds goes through `useOwnedGeometry` (`src/shared/components/scene/hooks/use-owned-geometry.ts`), and every texture is disposed on unmount. R3F does not dispose geometry passed through `args`, and a leak adds up on the iPad.
- Box lists handed to `MergedBoxes` are module-level or memoized. It rebuilds its geometry when it gets a new array.
- Comments say why, never what. No banners, no citing the spec or plan from code.

## Review Focus

1. **The sky image fails or is slow to arrive** (an in-home connection drops). The scene must draw at once with the code-built Lightformer environment and swap the image in when it lands; a failed load must never fall through to the no-3D stills. Task 3 step 6 blocks the file in Playwright and shoots the result.
2. **A new plant, wall or fence blocks an up-close view.** The crawl-space camera looks low across the front bed (`[-3.2, 0.3, 7.6]` → `[0.8, 0.12, 3]`, `home-anchors.ts`), and the wall camera looks over the low wall. Tasks 4 and 5 assert that no lot box or in-lot plant crosses any anchor framing's view line, on both roof forms and both foundations.
3. **The new opening framing sits farther out than the orbit allows** (`HOME_ORBIT.maxDistance` 36). The orbit would clamp the camera on the first touch and the view would jump. Task 7 asserts both framings' distance is at most 36.
4. **A raised house's front steps meet the new stoop and walk.** The house lifts while the lot stays at grade, so the four risers (1.12 m deep) land on the stoop slab and the walk's top end. Task 4's shots include a raised house from the front, checking for a gap or a buried step.
5. **The Partly open lane behind the garage** (right wall, along −3) is drawn without depth testing, so from the front-left it shows over the garage's walls. The spec keeps it (it only drops lanes inside the garage's span). Task 6 shoots it under Thermal, Summer, Partly open. If it reads as coming out of the garage, report it with the shot; do not drop it unasked.

---

## Before Task 1

- [ ] Confirm the Attic build has landed: `git status --short` shows none of the attic files modified (`home-details.ts`, `home-geometry.ts`, `duct-run-points.ts`, `ducts-hang.ts`, `attic-fan.tsx`, `scripts/verify-trade-scene.ts`). If any are, stop and ask the owner.
- [ ] Create `.superpowers/sdd/2026-11-01-ts3b6a-lot-and-light/` (gitignored). Copy two scripts into it, both pointed at `/dashboard/labs/trade-scene` on :3002 with `as=`:
  - `.superpowers/sdd/2026-10-30-attic-ventilated-and-sealed/perf.mjs` as `perf.mjs`. This is the like-for-like gate. `perf-attic-draws.mjs` is not, because it forces the Attic's own picks. Add a third argument, `flat` or `tile`, that sets the roof through the lab's controls, borrowing `setRoof` from the spike's `shots.mjs`.
  - `.superpowers/sdd/2026-10-30-realism-spike/shots.mjs` as `shots.mjs`.
- [ ] Record the baseline: `node perf.mjs default baseline flat`, `node perf.mjs default baseline tile`, then the same with `worst`. Complete, Normal, 1280 × 800. Save the JSON next to the script. Task 8 measures against it. The Attic's final default was 148 draws and 66.6k triangles, not spec §9's older 133 / 50.7k.
- [ ] Shoot the baseline opening view in all four weathers, wide (1280 × 800) and tall (800 × 1100).

---

### Task 1: The lot's layout as constants and box lists

**Files:**
- Create: `F/constants/home-lot.ts`, `F/lib/lot-height-at.ts`, `F/lib/lot-boxes.ts`, `F/lib/garage-boxes.ts`, `scripts/verify-trade-scene-lot.ts`
- Modify: `F/types.ts` (append `LotBoxes`, `GarageBoxes`)

**Interfaces:**
- Produces:
  - `GARAGE = { x0: 6, x1: 12.4, z0: -2.6, z1: 4, wallTop: number, flatTop: number, door: { width: 4.88, height: 2.13 } }`. `wallTop` is `HOME_FLOOR_Y.slab + HOUSE.wallHeight`, and `flatTop` is `wallTop + 0.62`. Both are derived from `HOUSE`, as in `spike-lot-layout.ts:GARAGE`.
  - `LOT = { left: -8.5, right: GARAGE.x1 + 1.52, front: 10.1, back: -23.4, wall: { height: 1.83, thickness: 0.15, capHeight: 0.05, capWidth: 0.2 }, frontFence: 1.07, gateZ: 3.4 }`.
  - `STREET_Z`, `GRADE = { padEnd: 5.6, walk: -0.45, street: -0.6, curb: 0.15 }`, `WALK = { x0: -1.25, x1: 0.05 }` (the spike's walk span) and `GROUND_ROWS: readonly (readonly [z: number, y: number])[]`, all in `home-lot.ts`.
  - `lotHeightAt(z: number): number`. It interpolates linearly over `GROUND_ROWS`, so the drawn ground and everything set on it share one description of the grade.
  - `lotBoxes(): LotBoxes`, where `LotBoxes = { blockWalls, wallCaps, fenceBoards, fenceRails, concrete, concreteJoints, asphalt, mulch }`, each `readonly BoxSpec[]`. Also `LOT_BOXES: LotBoxes`, built once at module level in `lot-boxes.ts`.
  - `garageBoxes(form: RoofForm): GarageBoxes`, where `GarageBoxes = { body, trim, door, doorMouldings, doorFields, doorWindows, doorLines, membrane, slopes, fascia }`, each `readonly BoxSpec[]`. A pitched form gets an empty `membrane`, and a low-slope form gets empty `slopes` and `fascia`. Also `GARAGE_BOXES: Record<RoofForm, GarageBoxes>`, built once at module level. Components read `LOT_BOXES` and `GARAGE_BOXES`, never the functions, as `low-slope-roof.tsx` does with its module-level lists.

- [ ] **Step 1: Write the failing lot check.** Create `scripts/verify-trade-scene-lot.ts` in the same style as `verify-trade-scene.ts`, with its `near(actual, expected, tolerance, label)` signature. The shorthand `near(a, b)` below means a tolerance of 1e-9. It should assert:
  - **Spec §6.1 values:** `LOT.left === -8.5`, `near(LOT.front, 10.1)`, `near(LOT.back, -23.4)`, `near(LOT.right, 13.92)`, `GARAGE.x0 === HOUSE.halfLength`, `GARAGE.z1 === HOUSE.halfDepth`, `near(GARAGE.x1 - GARAGE.x0, 6.4)`, `near(GARAGE.z1 - GARAGE.z0, 6.6)`, and `GARAGE.door` is `{ width: 4.88, height: 2.13 }`.
  - **The grade (R139):** `lotHeightAt(0) === 0`, `lotHeightAt(GRADE.padEnd) === 0`, `near(lotHeightAt(LOT.front - 1e-9), -0.45, 1e-6)`, and `lotHeightAt` at the street's middle is `-0.6`. `GROUND_ROWS` z values strictly increase, and every row's y is one of `0`, `-0.45` or `-0.6`.
  - **The grade has one source:** at every `GROUND_ROWS` z, `lotHeightAt(z)` equals that row's y, and halfway between two rows it equals their mean.
  - **Walls (R130):** the three property walls (`blockWalls.slice(0, 3)`) are 1.83 high. The low front wall's top, cap included, rises at most 1.07 above `lotHeightAt` at its centre z. The spike's wall plus cap reaches 1.12, so the body comes down to fit.
  - **The door (R141):** `doorMouldings.length === 32`, `doorFields.length === 24`, `doorWindows.length === 8`, `doorLines.length === 3`. No two door surfaces flicker: the outward faces (`position[2] + size[2] / 2`) of the door, a moulding, a field, a window, a line and the surround are pairwise at least 0.002 apart.
  - **The roof follows the house (R140):** `garageBoxes('pitched').membrane` is empty and `slopes.length === 2`. `garageBoxes('low-slope').slopes` is empty and `membrane.length === 1`.
  - **The house's door opens onto the new walk.** Move the assertion that checks the door against `YARD.walk` from `verify-trade-scene.ts` (today near line 1486): `FRONT_DOOR.along` lies within `[WALK.x0, WALK.x1]`.
  - **Mulch beds** overlap neither the walk nor the driveway.
  - **No cycle:** `home-geometry.ts`'s source contains no import of `home-lot`. Read it with `readFileSync`.
  - **Built once:** no `.tsx` file under `F/ui/` calls `garageBoxes(` or `lotBoxes(`. Grep the sources.

  End with `console.log('verify-trade-scene-lot: ok')`.
- [ ] **Step 2: Run the lot check.** Expected: FAIL, cannot resolve `@/features/trade-scenes/constants/home-lot`.
- [ ] **Step 3: Implement the four files.**
  - **Source of the values:** retype them from `spike-lot-layout.ts`, with every value unchanged except the low wall's height (above). The spike's branchy `heightAt` is replaced by the interpolation over `GROUND_ROWS`. The spike's exported box constants become the record fields `lotBoxes()` returns. `garageBody`, `garageTrim`, `GARAGE_GABLE`, `garageGableSlopes`, `garageFascia`, `GARAGE_MEMBRANE` and the door lists go into `garageBoxes(form)`.
  - **`flat` becomes `form`:** the spike's `flat` boolean becomes `form === 'low-slope'`.
  - **Gable apex:** `GARAGE_GABLE` stays a module constant in `garage-boxes.ts`. Export `garageGableApexY: number` for Task 6's gable end.
- [ ] **Step 4: Run the lot check.** Expected: `verify-trade-scene-lot: ok`. Then the scene check prints ok (it guards three.js out of `lib/` and `constants/`), and types and lint exit 0.
- [ ] **Step 5: Commit** the five files and `F/types.ts` by path: `feat(trade-scenes): the lot, its grade and the two-car garage as constants and box lists`.

### Task 2: The sun from a day, an hour and the house's bearing

**Files:**
- Create: `F/constants/scene-attributes.ts`, `F/lib/sun-position.ts`, `F/lib/sun-direction.ts`, `F/lib/weather-sun-direction.ts`, `F/lib/sun-shadow-frustum.ts`
- Modify:
  - `F/types.ts`: the `WeatherSky['sun']` shape, plus `SunShadowFrustum`.
  - `F/constants/weather-skies.ts`: the `sun` entries and `SKY_RIG`.
  - `F/lib/faces-summer-sun.ts`.
  - `F/ui/components/home-kit/weather-sky.tsx`: the key light's position, target and shadow camera.
  - `scripts/verify-trade-scene-lot.ts`.

**Interfaces:**
- Produces:
  - `SCENE_ATTRIBUTES = { latitude: 34, longitude: -118, frontBearing: 180 }`. Compass degrees; `frontBearing` is the bearing the house's +z front faces. "Scene attribute" is the owner's term (R142). The comment says this is the one value everything sun-dependent derives from, and the first an agent may set.
  - `sunPosition(dayOfYear: number, clockHour: number): { azimuth: number, elevation: number }`.
    - Output: degrees; azimuth clockwise from north.
    - Inputs: local clock time, with daylight saving for day 70–307 inclusive (UTC−7, else UTC−8).
    - Latitude and longitude come from `SCENE_ATTRIBUTES`.
    - Formula: the NOAA low-precision one (fractional year → declination and equation of time → hour angle).
  - `sunDirection(sun: { azimuth: number, elevation: number }, frontBearing: number, minElevation: number): Vec3`.
    - Returns a unit vector toward the sun, in scene axes.
    - With `e = max(sun.elevation, minElevation)` and `r = azimuth − frontBearing`, the vector is `[−sin r · cos e, sin e, cos r · cos e]`.
  - `weatherSunDirection(weather: Weather): Vec3`. It reads `WEATHER_SKIES[weather].sun` and `SCENE_ATTRIBUTES.frontBearing`.
  - `sunShadowFrustum(direction: Vec3, box: { min: Vec3, max: Vec3 }, distance: number): SunShadowFrustum`.
    - `SunShadowFrustum = { position: Vec3, target: Vec3, left: number, right: number, top: number, bottom: number, near: number, far: number }`.
    - Fit: the box's eight corners, projected into the light's look-at basis (camera up +y, looking from `position` to `target`). Write it as hand-written vector maths with no three import, since it lives in `lib/`. The lot check tests it against three's own camera.
  - `WeatherSky['sun']` becomes `{ day: number, hour: number, minElevation: number, color: string, intensity: number }`.
  - `SKY_RIG` becomes `{ domeRadius: 95, shadowMapSize: 2048, sunDistance: 60 }`. `shadowReach` is gone, and Task 3 raises `domeRadius`.

- [ ] **Step 1: Add the failing sun checks** to the lot check:
  - **Equinox noon:** `sunPosition(80, 13)` has elevation within 1.5 of 56 and azimuth within 3 of 180.
  - **The per-weather defaults:**

    | Weather | Call | Azimuth | Elevation |
    |---|---|---|---|
    | Normal | `sunPosition(288, 16.5)` | within 3 of 244 | within 2 of 20.6 |
    | Summer | `sunPosition(196, 15)` | within 3 of 253 | within 2 of 60.4 |
    | Winter | `sunPosition(15, 17)` | — | below 2 |

  - **`sunDirection`:**
    - `sunDirection({ azimuth: 270, elevation: 0 }, 180, 0)` is near `[-1, 0, 0]`, west on the left.
    - Azimuth 180 gives `[0, 0, 1]`.
    - With `frontBearing` 0, azimuth 270 gives `[1, 0, 0]`.
    - `sunDirection({ azimuth: 244, elevation: 0 }, 180, 28)` has `y` near `sin 28°`.
    - Every result has length 1.
  - **Normal and Summer from the front-left at the default bearing:** for each, `weatherSunDirection(weather)` has `x < 0` and `z > 0`.
  - **The sunny walls don't move:** `facesSummerSun(-1, 0)` and `facesSummerSun(0, 1)` are true; `facesSummerSun(1, 0)` and `facesSummerSun(0, -1)` are false.
  - **Rain keeps the front-left light:** `weatherSunDirection('rain')` also has `x < 0`.
  - **The shadow fit covers the lot,** in every weather. Take `LOT_SHADOW_BOX = { min: [LOT.left, GRADE.walk, LOT.back], max: [LOT.right, RIDGE_Y + homeLift('raised') + 1, LOT.front] }`.
    - Build a three `OrthographicCamera(left, right, top, bottom, near, far)` from the returned frustum, at `position`, with `lookAt(target)`, then call `updateMatrixWorld()` and `updateProjectionMatrix()`.
    - Every corner's `Vector3.project(camera)` lies within [−1, 1] on all three axes.
    - Also `near > 0`.
    - This checks the hand-written fit against three's own maths, not against itself.
- [ ] **Step 2: Run the lot check.** Expected: FAIL on the missing modules.
- [ ] **Step 3: Implement.**
  - **New files:** the five above. `LOT_SHADOW_BOX` lives in `home-lot.ts`.
  - **`weather-skies.ts` sun entries** (colour and intensity unchanged until Task 3):

    | Weather | `day` | `hour` | `minElevation` |
    |---|---|---|---|
    | Normal | 288 | 16.5 | 0 |
    | Summer | 196 | 15 | 0 |
    | Winter | 15 | 17 | 28 |
    | Rain | 288 | 13 | 0 |

    Rain's hour is 1 pm, not noon. At noon the sun stands at azimuth 166, so the key light would come from the front-right, unlike the other weathers. At 1 pm it is at 188.
  - **`faces-summer-sun.ts`:** reads `weatherSunDirection('summer')`.
  - **`weather-sky.tsx`:**
    - The key light's position and the shadow camera come from `sunShadowFrustum(weatherSunDirection(weather), LOT_SHADOW_BOX, SKY_RIG.sunDistance)`, memoized on `weather`.
    - Give the light a `target` object placed at `frustum.target` and mounted in the scene. A directional light's target only moves once it is in the scene graph.
    - **Refit on every weather change.** three rebuilds a shadow camera's projection only when the shadow map is first made (`WebGLShadowMap.js`), and R3F's prop writes don't call `updateProjectionMatrix`. So a layout effect on the frustum calls:
      - `light.shadow.camera.updateProjectionMatrix()`;
      - `gl.shadowMap.needsUpdate = true`, unless Thermal is on;
      - `invalidate()`.

      Without it, the first weather's frustum stays for the whole session.
    - Shadow bias stays. The Thermal shadow hold (the effect that sets `shadowMap.autoUpdate = !thermal`) stays as it is.
- [ ] **Step 4: Run the checks.** Expected:
  - The lot check prints ok.
  - The scene check prints ok.
  - Types and lint exit 0.
- [ ] **Step 5: Shoot it.**
  - Shoot the opening view in Normal and Summer and compare with the baseline. Light now comes from the computed sun, and the house still casts and receives.
  - **The refit:** load Normal, switch to Summer in the page, and shoot. Then load Summer fresh and shoot. The two shadows match. If the switched one is clipped or missing, the refit is broken.
  - Report if the house's shadows read too soft at 2048 (spec §5.3). Do not raise the map size.
- [ ] **Step 6: Commit** by path: `feat(trade-scenes): the sun follows a day and an hour through the house's bearing, and its shadow fits the lot`.

### Task 3: AgX, the sky image, the haze and the re-tune

**Files:**
- Create: `public/scenes/sky/citrus-orchard-road-puresky-512.hdr`, `F/ui/components/home-kit/lightformer-environment.tsx`
- Modify:
  - `src/shared/components/scene/ui/scene-shell.tsx`.
  - `F/ui/components/home-scene-canvas.tsx`.
  - `F/constants/weather-skies.ts`.
  - `F/types.ts`: the `WeatherSky['environment']` shape.
  - `F/ui/components/home-kit/weather-sky.tsx`.
  - `public/scenes/LICENSES.md`.

**Interfaces:**
- Produces:
  - **`SceneShell` prop:** `toneMapping?: { mapping: ToneMapping, exposure: number }`, passed through on the WebGL branch only as `{ antialias: true, toneMapping, toneMappingExposure }`. The WebGPU option look-dev uses is untouched. R3F only applies ACES when `gl.toneMapping` is undefined (`@react-three/fiber` events build line 1752), so this sets AgX once at creation and nothing recompiles.
  - **`HOME_TONE_MAPPING = { mapping: AgXToneMapping, exposure: 1.05 }`:** a module constant in `home-scene-canvas.tsx`, its only reader. It may not live in `weather-skies.ts`, because `constants/` stays free of three.js.
  - **`weather-skies.ts`:** `SKY_IMAGE = '/scenes/sky/citrus-orchard-road-puresky-512.hdr'`.
  - **`WeatherSky['environment']`** becomes `{ color: string, intensity: number, image: boolean }`. `image` is true for Normal and Summer only.
  - **`<LightformerEnvironment color intensity horizon weather />`:** today's `Lightformer` environment, moved out of `weather-sky.tsx` unchanged. It is not called a "panel" environment, because "panel" is the Scene panel's word (`CONTEXT.md`).

- [ ] **Step 1: Make the sky image (owner, 2026-11-01: halved to stay inside the 8 MB budget).**
  - **Download:** fetch Poly Haven's smallest file, `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/citrus_orchard_road_puresky_1k.hdr`, into the SDD folder, never into `public/`. Check that the size is 1,317,344 bytes and the md5 is `1c22481531c8271cca349b5f5a5e1683`. There is no 512 version on Poly Haven.
  - **Halve it** with a one-off Node script in the SDD folder (uncommitted; no ImageMagick or numpy on this machine):
    - decode the RGBE scanlines (run-length encoded) to linear floats;
    - average each 2 × 2 block;
    - re-encode as RGBE;
    - write a Radiance file with the header `-Y 256 +X 512` and flat (uncompressed) scanlines, to `public/scenes/sky/citrus-orchard-road-puresky-512.hdr`.
  - **Check the file:** open it with three's `RGBELoader().parse` in the script. It is 512 × 256, and its mean luminance is within 2% of the 1k file's.
  - **Credit:** add a row to `LICENSES.md` for `sky/citrus-orchard-road-puresky-512.hdr`:
    - Source: `https://polyhaven.com/a/citrus_orchard_road_puresky` (halved from the 1k file)
    - Author: "Dimitrios Savva (photography), Jarod Guest (processing)"
    - Licence: CC0 1.0
- [ ] **Step 2: Add the lot-check assertions:**
  - `SKY_RIG.domeRadius === 118`.
  - `SKY_RIG.shadowMapSize === 2048`.
  - `HOME_CAMERA_FAR === 118 + HOME_ORBIT.maxDistance + 20`.
  - `environment.image` is true for exactly Normal and Summer.
  - The file at `public${SKY_IMAGE}` exists, its header reads `-Y 256 +X 512`, and it is under 700 KB.
  - `HOME_TONE_MAPPING` is not exported from anything under `F/constants/`.
  - No string in `F/` (outside `realism-spike/`) contains `polyhaven.org`. Use a `readdirSync` walk, as `verify-trade-scene.ts` already does.

  Run them: FAIL.
- [ ] **Step 3: Implement.**
  - **Dome and tone mapping:** dome radius 118. The home canvas passes `toneMapping={HOME_TONE_MAPPING}`; look-dev passes nothing and keeps today's tone mapping.
  - **The sky image:** for an `image` weather, `weather-sky.tsx` mounts `<AssetBoundary fallback={<LightformerEnvironment … />}><Environment files={SKY_IMAGE} environmentIntensity={…} /></AssetBoundary>`. Other weathers mount `LightformerEnvironment` alone.
  - **Don't key the image branch by weather.** A switch between Normal and Summer must keep the same `Environment` mounted. drei disposes the image on unmount, so a key would re-upload it and rebuild its lighting maps on every switch. Only the intensity changes.
  - **The code comment:** "never downloads an HDR" becomes "never downloads one from another host".
- [ ] **Step 4: Re-tune, by eye, in all four weathers.**
  - **What to change:** only `sun.color`, `sun.intensity`, `fill`, `bounce`, `environment.intensity`, `sky` colours, `fog` and `ground.color`, plus the exposure.
  - **`ground.color` becomes a light tint over the lawn texture.** The texture is already green, and the spike tints it `#ffffff`. Today's greens would darken the lawn to about a third, and Rain's `#62744f` nearly to black. Normal starts at `#ffffff`, and the other weathers are tuned by eye from there, Rain darker for wet grass. The lawn itself arrives in Task 4, so set the tints here and confirm them in Task 4's shots.
  - **Normal** starts from the spike's golden values in `realism-spike/spike-sky.tsx:GOLDEN`: fog near 28, far 125, matched to the horizon colour.
  - **Summer:** a hard, high, hot afternoon with a pale warm haze.
  - **Winter:** stays the cold blue evening with the rooms lit warm.
  - **Rain:** stays a flat overcast.
  - **Shots:** before and after, wide and tall, all four weathers, Complete and Partly open.
  - **If a surface reads wrong** under AgX, list it with a shot. Do not change its colour.
- [ ] **Step 5: Run the checks.** Expected: the lot check and the scene check print ok, and types and lint exit 0.
- [ ] **Step 6: Review Focus 1, a failed sky image.**
  - **Blocked:** in `shots.mjs`, `page.route('**/scenes/sky/*', r => r.abort())`, then load Normal. The canvas draws with the Lightformer environment, and the no-3D still never shows.
  - **Slow:** `route` with a 4 s delay. The Lightformer light shows first and the image arrives after.
  - **Switching:** load Normal, switch to Summer and back. The request log shows the `.hdr` fetched once.
  - Shoot all three.
- [ ] **Step 7: Commit** by path, the `.hdr` included: `feat(trade-scenes): AgX tone mapping, a self-hosted sky image on clear days, and the weathers re-tuned for it`.

### Task 4: The lot drawn, in place of the yard

**Files:**
- Create:
  - `F/ui/lib/ground-strip-geometry.ts`.
  - `F/ui/lib/create-lawn-texture.ts`.
  - `F/ui/components/home-kit/lot.tsx`.
  - `F/ui/components/home-kit/lot-ground.tsx`.
- Modify:
  - `F/ui/components/home-kit/home-kit.tsx`: the mount only.
  - `F/constants/home-geometry.ts`: delete `YARD` and `HOME_PAN.frontReach` (it reads `YARD`). Never import `home-lot.ts` here. Update the `HOME_ORBIT` comment that mentions the yard's disc.
  - `F/lib/home-pan-box.ts`: `max[2]` reads `STREET_Z.sidewalk[1]` from `home-lot.ts` (a `lib/` file, so no cycle).
  - `F/constants/home-life.ts`: the rain fields (step 2).
  - `F/constants/home-palette.ts`: delete `trunk`, `crown` and `shrub`, which only `yard.tsx` reads (owner, 2026-11-01).
  - `F/constants/weather-skies.ts`: only if the shots show Task 3's `ground.color` tints need a nudge.
  - `scripts/verify-trade-scene.ts`:
    - drop the `YARD` import and the door-on-the-walk assertion, which moved in Task 1;
    - the "the box reaches past the yard anchor in front" assertion reads `homePanBox(0).max[2]` in place of `HOME_PAN.frontReach`.
  - `scripts/verify-trade-scene-lot.ts`.
- Delete: `F/ui/components/home-kit/yard.tsx`, `F/ui/components/home-kit/yard-blobs.tsx`. `home-life.ts` has its own private `YARD` (the rain field). Step 2 renames it, so a later grep for `YARD` finds nothing.

**Interfaces:**
- Consumes: `lotBoxes()` and `GROUND_ROWS` from Task 1.
- Produces:
  - `groundStripGeometry(rows: readonly (readonly [number, number])[], halfWidth: number, tile: number): BufferGeometry`. Port it from `spike-geometry.ts:groundStrip`.
  - `createLawnTexture(): CanvasTexture`. Port it from `spike-lot.tsx`, unchanged.
  - `<Lot ground={WeatherSky['ground']} />` and `<LotGround ground={WeatherSky['ground']} />`. `LotGround` draws the ground strip with the lawn texture, and `Lot` mounts it beside the merged boxes.
  - A view-line helper in the lot check: `segmentHitsBox(a: Vec3, b: Vec3, box: Box3): boolean`, using three's `Ray.intersectBox`: a hit counts if it lies no farther from `a` than `b` is.
  - `boxSpecBounds(box: BoxSpec): Box3`, also in the lot check: `Box3.setFromCenterAndSize` at the origin, `applyMatrix4` of the box's rotation, then translated to its position. The sloped walk and wall boxes are rotated (`onGrade`), so bounding only their unrotated size would miss their ends. Task 5 reuses both.

- [ ] **Step 1: Write the failing view-line check (Review Focus 2).** Build the view lines:
  - for both roof forms, both foundations and every anchor, `liftedFraming(HOME_ANCHORS[form][anchor].framing, homeLift(foundation))` → `[position, target]`;
  - `HOME_FRAMINGS.wide` and `HOME_FRAMINGS.tall`.

  Skip the slab house's crawl-space framing, which has no crawl space to look at; the scene check skips it the same way. No box in `blockWalls`, `wallCaps`, `fenceBoards` or `fenceRails` (through `boxSpecBounds`) may hit any of those lines. Also add the rain checks below. Run it. The view-line part is a guard, so it may pass at once; it also guards Task 7's framings. If it fails, stop and report the wall and the framing with a shot. The walls are owner rulings (R130), and the anchor framings belong to TS3b.4b, so neither moves without the owner.
- [ ] **Step 2: Implement.**
  - **`Lot`** draws:
    - **Ground:** the ground strip, `halfWidth` 140, 4 m tiles, with the lawn texture as `map` and `ground.color` as its tint, at `ground.roughness`.
    - **Merged boxes:** one `MergedBoxes` per list. Paving uses `HOME_PALETTE.path`, the property walls `HOME_PALETTE.blockWall`, and the other lot colours come from the spike's `SpikeLot` and go into a `LOT_PALETTE` in `home-lot.ts`.
    - **Shadows and taps:** the walls, caps and boards cast and receive shadows. The ground, paving and walls keep raycasts, so a double-tap on the lawn still looks at that spot.
    - **Box lists** come from `LOT_BOXES`, never a call in render.
  - **`home-kit.tsx`:** swaps `<Yard ground={sky.ground} />` for `<Lot ground={sky.ground} />` inside the existing `thermalTag('exterior')` group.
  - **Disposal:** the ground strip goes through `useOwnedGeometry`. The lawn texture is created in a `useMemo` and disposed in an effect cleanup, as `weather-sky.tsx` does with its sky texture. The lawn's random strokes use `seededRandom` (`F/lib/seeded-random.ts`), not a new generator.
  - **Rain over the lot (owner, 2026-11-01):** in `home-life.ts`, the rain fields span the lot (`LOT.left` to `LOT.right`, `LOT.back` to `LOT.front`) in place of the private ±15 m yard, so no streak falls through a neighbour. Each ground-reaching field's floor is the lowest `lotHeightAt` across its z span, so streaks end at or under the ground (the lawn hides the last few centimetres), never in mid-air. The house's clear zone stays. Lot-check assertions:
    - every field's x span lies inside `[LOT.left, LOT.right]`;
    - the fields together reach `LOT.back` and `LOT.front`;
    - each ground field's minimum y is at most `lotHeightAt` at both ends of its z span.
- [ ] **Step 3: Run the checks.** Expected: the lot check and the scene check print ok, and types and lint exit 0.
- [ ] **Step 4: Shoot it.**
  - **Weathers:** the opening view in all four, Rain included, so the lawn reads wet, not black, and the rain reaches the front lawn and the back yard.
  - **Thermal:** under Thermal, Normal and Summer. The lot paints as outside air.
  - **Partly open:** in Summer.
  - **Review Focus 4:** a raised house from the front, close on the steps.
  - **Wall check:** each up-close view whose line passes a wall.
- [ ] **Step 5: Commit** by path, the deletions included: `feat(trade-scenes): the home stands on a graded, walled lot by a street in place of the green disc`.

### Task 5: Neighbours and plants

**Files:**
- Create:
  - `F/constants/neighbourhood.ts`.
  - `F/constants/lot-plants.ts`.
  - `F/ui/lib/vertex-tinted-geometry.ts`.
  - `F/ui/lib/plant-geometry.ts`.
  - `F/ui/lib/neighbour-geometry.ts`.
  - `F/ui/components/home-kit/neighbours.tsx`.
  - `F/ui/components/home-kit/lot-plants.tsx`.
  - `F/ui/components/home-kit/plant-instances.tsx`.
- Modify: `F/ui/components/home-kit/lot.tsx`, `F/types.ts`, `scripts/verify-trade-scene-lot.ts`.

**Interfaces:**
- Produces:
  - **Neighbours:** `NeighbourHouse = { position: [number, number], size: [number, number], facing: 1 | -1, stucco: string, roof: string, chimney?: boolean }`, declared in `F/types.ts`. The spike's `storeys` is dropped, since every neighbour is single-story (R137). `NEIGHBOUR_HOUSES: readonly NeighbourHouse[]` holds the spike's 19, positions unchanged.
  - **Plant species:**
    - `PLANT_SPECIES = ['fan-palm', 'queen-palm', 'pygmy-palm', 'sago', 'agave', 'shrub', 'eucalyptus', 'cypress'] as const` in `lot-plants.ts`.
    - `PlantSpecies = typeof PLANT_SPECIES[number]` in `F/types.ts`, as `HomeFade` is declared.
    - `PlantPlacement = readonly [x: number, z: number, scale: number, turn: number]`, kept in `lot-plants.ts`.
    - `PLANT_PLACEMENTS: Record<PlantSpecies, readonly PlantPlacement[]>`.
  - **Far plant species:** `FAR_PLANT_SPECIES: readonly PlantSpecies[] = ['fan-palm', 'queen-palm', 'eucalyptus', 'cypress']`, after the spec's "far plants" (§5.3, §6.6). These cast no shadows and ignore taps; the bed plants do both. The rule is per species, so a queen palm in the back yard also casts none (Claude's reading).
  - **Geometry builders:**
    - `vertex-tinted-geometry.ts`: `tintVertices`, `placeGeometry` and `mergeTinted`, ported from the spike's `paint`, `place` and `merge`. "Paint" is already the exterior paint part and the Thermal paint, so it is not reused here. Any jitter uses `seededRandom`.
    - `plantGeometry(species: PlantSpecies): BufferGeometry`, from the spike's eight builders.
    - `neighbourGeometry(houses: readonly NeighbourHouse[]): { walls: BufferGeometry, roofs: BufferGeometry, windows: BufferGeometry }`.

- [ ] **Step 1: Write the failing checks.**
  - **Neighbours:**
    - `NEIGHBOUR_HOUSES.length === 19`.
    - No neighbour's footprint overlaps the lot rectangle (`LOT`, with its wall thickness).
    - No two neighbours overlap.
  - **Every plant species builds:** for each species, `plantGeometry(species)` builds, carries a `color` attribute, and has a bounding box whose height is greater than 0.
  - **No in-lot plant blocks a view line (Review Focus 2).**
    - Which plants: placements whose `[x, z]` lies inside the lot rectangle.
    - Each plant's box: the geometry's bounding box, transformed by the plant's full instance matrix (position at `lotHeightAt(z)`, `turn`, `scale`), the same matrix `PlantInstances` sets.
    - The rule: `segmentHitsBox` is false for every view line from Task 4.
  - **No in-lot plant sits in a heat lane (spec §6.4).** Use the same boxes. Check every leg `outside → face` of `HOME_WALL_HEAT_LANES`, `HOME_COMPLETE_WALL_HEAT_LANES`, `HOME_WINDOW_HEAT_LANES` and `HOME_COMPLETE_WINDOW_HEAT_LANES`; each must clear every plant box.

  Run them. They fail on the missing modules. With the spike's placements, the lane check is expected to fail at the front lanes: the sago at `[-1.9, 4.85]` stands under the lane at x −1.6.
- [ ] **Step 2: Implement.**
  - **Neighbours** are three meshes: walls, roofs (`flatShading`) and windows. Each has vertex colours, no shadows, and `raycast={ignoreRaycast}`. The neighbour colours are Claude's call (spec §12).
  - **Plants:** `PlantInstances` is one `instancedMesh` per species, placed at `lotHeightAt(z)`. Its material is `vertexColors`, `side={DoubleSide}`, with no alpha cut-out.
    - Model it on `InstancedPieces` (`src/shared/components/scene/ui/instanced-pieces.tsx`): key the mesh on the instance count, write the matrices in a layout effect, then call `invalidate()`, since the scene renders on demand. `InstancedPieces` itself can't be reused, because it only tilts about z and scales z.
    - Every plant and neighbour geometry goes through `useOwnedGeometry`. `neighbourGeometry`'s three parts take three calls.
  - **Thermal paint:** the surface path of `F/ui/lib/thermal-paint-set.ts` (`surfaceFor(…, original.side)`) already keeps `original.side`, so the double-sided leaves paint on both faces under Thermal. Confirm it with a shot rather than adding code.
  - **Placements:** start from the spike's lists. Move bed plants out of every lane and view line until the checks pass. Move the plants, never the lanes.
  - **Mount:** `Lot` mounts `<Neighbours />` and `<LotPlants />`. Both stay under the `exterior` tag, outside the ghost and the lift.
- [ ] **Step 3: Run the checks.** Expected: the lot check prints ok, and types and lint exit 0.
- [ ] **Step 4: Shoot it.**
  - **Weathers:** the opening view in all four.
  - **Thermal:** Summer, Partly open and Complete. The front lanes stand clear of the beds, and leaves paint on both faces.
  - **Orbit:** to the render's high view.
  - **Inside a neighbour:** the camera at `[-14, 1.6, 0]`. The neighbour vanishes, which is acceptable (§6.3).
- [ ] **Step 5: Commit** by path: `feat(trade-scenes): single-story tile-roof neighbours and instanced SoCal planting round the lot`.

### Task 6: The garage beside the house

**Files:**
- Create:
  - `F/ui/lib/covering-tone.ts`.
  - `F/ui/lib/gable-end-geometry.ts`.
  - `F/ui/components/home-kit/garage.tsx`.
  - `F/ui/components/home-kit/garage-gable-end.tsx`.
- Modify:
  - `F/constants/home-heat-lanes.ts`.
  - `F/constants/home-geometry.ts`: drop the third `DOWNSPOUTS.pitched.at` entry, and fix the comment that says downspouts stand at three corners.
  - `F/ui/components/home-kit/home-kit.tsx`: mount the garage beside `Lot`, inside the same `exterior` group. `home-kit.tsx` already holds `roofForm`, `paint` and the parts, so `Lot` takes no props it would only pass along.
  - `scripts/verify-trade-scene.ts`: the lane counts.
  - `scripts/verify-trade-scene-lot.ts`.

**Interfaces:**
- Consumes: `GARAGE_BOXES` and `garageGableApexY` from Task 1, `paintLook` (`F/ui/lib/paint-look.ts`), `installedShingleTone` and `partState`.
- Produces:
  - `coveringTone(material: string | null, fallback: CoveringMaterial, wear: number, installedTone: string | null): string`. It returns `wornColor(installedTone ?? colours.new, colours.worn, wear)`, where `colours = COVERING_COLORS[material ?? fallback] ?? COVERING_COLORS[fallback]`. Type `material` and `fallback` with the key type `COVERING_COLORS` already uses.
    - The rule is written out three times today: `roof-covering.tsx` (`COVERING_COLORS[material ?? 'shingle'] ?? COVERING_COLORS.shingle`), `gable-roof.tsx` and `low-slope-roof.tsx`. This makes one shared copy, fallback included.
    - The garage calls it with `fallback` `'membrane'` on a low-slope form and `'shingle'` on a pitched one, so it follows the house's covering and its wear.
    - The three house files move to it in 6-B, which rebuilds the covering anyway. They are held by in-flight builds now.
  - `<Garage form={RoofForm} wallColor={string} roofTone={string} />`.
  - `gableEndGeometry(halfDepth: number, wallTopY: number, heelY: number, ridgeY: number, thickness: number): ExtrudeGeometry`. It is the house's own recipe (`gable-roof.tsx`'s private `gableGeometry`: a `Shape` pentagon from the wall top, up the heel, to the ridge, extruded), parameterised. It is not the spike's zero-thickness triangle, which starts at the wall top and leaves a wedge open under the rake. The house's copy moves to it in 6-B.

- [ ] **Step 1: Write the failing checks.**
  - **Roof tone, in the lot check.** `coveringTone` equals:
    - `wornColor(COVERING_COLORS.shingle.new, COVERING_COLORS.shingle.worn, w)` for a shingle covering, at wear 0 and at `WEAR_AMOUNT.worn`;
    - the installed tone when one is given;
    - the membrane's colour with no material and fallback `'membrane'`;
    - `cool-membrane`'s colour when that is the material;
    - the fallback's colour for a material `COVERING_COLORS` doesn't know.
  - **Lanes, in the scene check (spec §6.7).** The right wall's lanes and the right window's lane inside the garage's span all drop until 6-B (owner, 2026-11-01). Find each assertion by its message; the Attic moved the lines.
    - **Counts:** the four lane counts (today near `:973`) become `[5, 7, 4, 6]`. The per-wall table becomes `right: 1` in both views.
    - **The window rule** ("one lane through every window", near `:978`) becomes: the open house has a lane through every window outside the garage's span.
    - **The Complete outside legs:** the hard-coded `15` in "an outside leg on every wall lane and every window" (near `:1164`) becomes 13.
    - **No lane in the span:** add an assertion that no wall or window lane's face stands on the right wall with `along` strictly between `GARAGE.z0` and `GARAGE.z1`.
    - Update `summerLanes.length` (near `:1014`) through `OPEN_FACE_LANES`, which already counts the lanes.
  - **Downspout, in the scene check:** `DOWNSPOUTS.pitched.at` has no point inside the garage's footprint.

  Run them: FAIL.
- [ ] **Step 2: Implement.**
  - **Heat lanes:** in `home-heat-lanes.ts`, `wallLanes` and `windowLanes` skip a right-wall `along` inside the garage's span, importing `GARAGE` from `home-lot.ts`. The right window's lane goes too (owner, 2026-11-01). 6-B brings the garage's own arrows across that wall (R146).
  - **Downspout:** drop the right-front pitched downspout.
  - **`Garage`** draws `GARAGE_BOXES[form]`:
    - **Walls** in `paint.color`: the paint's worn and chalk tone, as colour only (§6.5).
    - **Trim and fascia** in `HOME_PALETTE.trim`.
    - **Door** colours from the spike.
    - **Roof:** the membrane or the slopes in `roofTone`. On a pitched form, the gable end (`gableEndGeometry`, through `useOwnedGeometry`) in `wallColor`.
  - **Mount:** under the `exterior` tag, outside the ghost and the lift. `home-kit.tsx` passes `roofForm`, `paint.color` and `coveringTone(covering.material, roofForm === 'low-slope' ? 'membrane' : 'shingle', covering.wear, installedShingleTone(parts, homeMaterials.shingleColor))`, with `covering = partState(parts, 'covering')`.
- [ ] **Step 3: Run the checks.** Expected: the lot check and the scene check print ok, and types and lint exit 0.
- [ ] **Step 4: Shoot the garage.**
  - **Roof forms:** pitched and flat; the garage's roof follows a switch between them.
  - **Coverings:** shingle, cool shingle with an installed Owens Corning colour, tile, and a worn covering.
  - **Paint:** worn paint and Cool Life paint.
  - **The door, close:** no flicker as the camera slides.
  - **Thermal**, Summer: Partly open and Complete. No lane comes out of the garage. Review Focus 5 shows the lane behind it.
  - **Up close:** on a part. The garage is not ghosted, and shows as the spec allows until 6-B.
  - **The right gable vent:** on a slab house with a pitched roof, from the right and above. The Attic's right gable vent tops out about 1.5 cm above the garage's slope, so a sliver may poke through the garage roof. Report it with the shot; the vent itself waits for 6-B (spec §8.3).
- [ ] **Step 5: Commit** by path: `feat(trade-scenes): a two-car garage beside the house, its roof following the house's form and covering, with the lanes and downspout it would bury dropped`.

### Task 7: The camera fits the house and the garage

**Files:**
- Modify:
  - `F/constants/home-geometry.ts`: `HOME_FRAMINGS`, as literals. It still never imports `home-lot.ts`.
  - `F/lib/home-pan-box.ts`.
  - `F/constants/home-anchors.ts`: `READING_CALLOUTS` offsets only.
  - `scripts/verify-trade-scene-lot.ts`.

**Interfaces:**
- Produces: `homePanBox(lift)`, with `max[0] = GARAGE.x1 + HOME_PAN.margin`. `max[2]` is `STREET_Z.sidewalk[1]` from Task 4. Every other bound is unchanged.

- [ ] **Step 1: Write the failing checks.**
  - **Framing distance (Review Focus 3):** for `HOME_FRAMINGS.wide` and `.tall`, the distance from position to target is at most `HOME_ORBIT.maxDistance`.
  - **Centre:** each framing's target x lies within 1 of 3.2, the middle of −6.3 to 12.7 (§7.4).
  - **Pan box:** for both lifts, the garage's front corners `[GARAGE.x1, 0, GARAGE.z1]` and the sidewalk point `[0, 0, STREET_Z.sidewalk[1]]` lie inside it.
  - **Existing checks:** the scene check's pan-box loop (near `:1691`, found by its messages) must still pass.

  Run them: FAIL on the target x.
- [ ] **Step 2: Re-tune by eye.**
  - **The framings:** re-centre both on x −6.3 to 12.7, keeping the 92% fit and the look under the ceiling into the rooms. Tune height and target, and raise the fov rather than pass the distance cap.
  - **The pins:** re-tune the `READING_CALLOUTS` offsets for the smaller house, so the stacked labels stay clear of each other.
  - **The comments:** update the comments on `HOME_FRAMINGS` and `READING_CALLOUTS` to describe the house and the garage.
  - **Shots:**
    - wide 1280 × 800 and 1024 × 768;
    - tall 800 × 1100 and 390 × 844;
    - each with the card open and folded, Complete and Partly open;
    - Thermal on, Summer, so the labels show.
- [ ] **Step 3: Run the checks.** Expected: the lot check and the scene check print ok, and types and lint exit 0.
- [ ] **Step 4: Commit** by path: `feat(trade-scenes): the opening view fits the house and the garage, and the reading pins re-space for the smaller house`.

### Task 8: Budget, stills, and the spike's removal

**Files:**
- Modify:
  - `public/scenes/stills/{normal,summer,winter,rain}.webp`, recaptured.
  - Edited by the controller in the working tree, never staged: `docs/plans/2026-10-16-trade-scenes-epic.md` (the TS3b.6 row and the decision log), the spec's status line, and `CONTEXT.md` (the Home kit line).
- Delete: `src/features/trade-scenes/realism-spike/` and `src/app/(frontend)/dashboard/labs/trade-scene-realism-spike/`.

- [ ] **Step 1: Measure.**
  - **Draws:** `node perf.mjs default after flat`, `… after tile`, and the same for `worst`, against the baseline. The flat roof must stay within +40 draw calls and +40k triangles.
  - **Texture memory:** count it by hand, since `renderer.info.memory` gives counts, not bytes. Show the arithmetic in the report:
    - the sky image on the GPU: 512 × 256, half-float RGBA, 8 bytes a pixel;
    - its lighting maps: three's cube is a quarter of the image's width (128), so the map is 384 × 512, plus a blur target of the same size;
    - the lawn: 512², RGBA, with mipmaps.

    The total must be 8 MB or less.
  - **Over budget:** stop and report with the numbers. Do not cut anything unasked.
- [ ] **Step 2: Recapture the four stills.** Use a copy of `.superpowers/sdd/2026-10-16-home-scene/task18-shots.mjs stills`, edited to :3002 and `as=` (it uses `role=` today, which writes to the DB). Use the existing home, the home framing, and Complete.
- [ ] **Step 3: Delete the spike.**
  - Delete both spike folders.
  - `grep -rn 'realism-spike\|trade-scene-realism-spike' src scripts` finds nothing.
  - Run the lot check and the scene check, then types and lint: all pass.
- [ ] **Step 4: Update the tracker and the glossary (controller, unstaged).** In the tracker, record:
  - the commits;
  - the draw, triangle and texture numbers, and the headroom left for 6-B;
  - any surface that read wrong under AgX;
  - the Review Focus 5 shot and the gable-vent shot;
  - that the spike is gone;
  - **for TS3b.4b:** its plan deletes the `yard` and `exterior-wall` anchors and adds system-view framings. It must run `verify-trade-scene-lot.ts` and keep its view-line guard covering the framings that exist then;
  - **a known gap:** the sky image's own baked-in sun does not turn with the bearing (R142). It matters once T19 or an agent changes the bearing.

  Mark the spec as built for 6-A, with 6-B pending. In `CONTEXT.md`, the **Home kit** line ("residents, sky and yard") becomes "residents, sky and lot". Add **Scene attribute**, the owner's term (R142): one value describing the home's setting, such as its bearing, that the scene derives everything else from.
- [ ] **Step 5: Commit** by path: the deletions and the stills only, never `docs/**` or `CONTEXT.md`: `chore(trade-scenes): the fallback stills show the lot, and the realism spike is removed`.
- [ ] **Step 6: Hand back to the owner.** Include:
  - the before and after shots in all four weathers;
  - the budget table;
  - the iPad check they owe (a camera slide stays smooth in all four weathers, §9).
