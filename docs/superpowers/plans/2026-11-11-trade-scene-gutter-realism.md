# Trade scene gutters, round 2 (R316): a real gutter, and rain that shows why it matters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the rain a rep can show a K-style gutter carrying the roof's water to downspouts that throw it out onto the lawn, and show that where there is no gutter, or where it has failed, the water drops beside the wall and soaks the foundation.

| Part | Spec | Tasks |
|---|---|---|
| The frame-cost baseline, before any change | Constraints | 0 |
| One run, one piece: the path a run follows (sag, pulled end, the cut) | Goal 2 | 1 |
| The K-profile drawn along it, streaks in its colours. **Owner look, not blocking** | Goals 1, 2 | 2 |
| Downspouts at all four corners: gooseneck, foot elbow, extension on the lawn; the torn one | Goal 3 | 3 |
| The water: outlets, curtains, the trickle; one rain component; the up-close rule | Goal 4 | 4 |
| The roof's sheen, over the edge into the gutter | Goal 4 | 5 |
| The wet band at the wall's foot, in rain only | Goal 5 | 6 |
| Frame cost, the owner's shots, every check | Constraints | 7 |

**Architecture:**
- **One rule decides where the roof's water goes: `gutterCatches(wear, x)`.**
  - It is false with no gutter, and false inside the pulled span at Failing. Everywhere else it is true.
  - The curtains, the wet band and the up-close rain path all follow it. So a failed section is exactly no gutter (the owner's rule), and the sound part still drains.
- **A run is a path of stations, and the K-profile is extruded along it.** One geometry per fade group holds every run in that group, plus the downspouts' house-frame boxes and the hangers, so no join can show.
  - A sag is a smooth dip (`sag × sin²`), with zero slope where it meets the straight run.
  - The pulled end bends away inside the same run (`t²` in drop, out and roll).
  - The Complete and kept front runs meet at `HOUSE.cutX` on identical sections with flat, uncapped ends. End plates go only at the true ends, ±`ROOF_HALF_LENGTH`.
- **The streaks move from `TintedMarks` boxes into the run's vertex colours.** A flat box cannot lie on a curved face.
  - The material is white, and the vertex colours carry the gutter's colour and the streak colour exactly, so a streak on a black gutter still reads lighter, as it does today.
  - Thermal swaps the whole material for its shader (`thermal-paint-set.ts` `paintThermal`) and the blueprint draws with its override material, so neither shows the streaks, as today.
- **Two frames, so nothing floats while the floor eases.**
  - **House frame (rides the lift):** the gutter runs, the goosenecks, the verticals, the curtains and the trickle. The verticals and the water columns run down to `LOWEST_LAWN_Y`, the house-frame lawn on a raised floor (today's downspout `BOTTOM`), so they reach the lawn on every foundation and through every ease; on a slab the rest sits under the lawn.
  - **Ground level (world frame, never lifts):** each downspout's foot elbow and extension, and in rain its outlet. They draw in `home-kit`'s existing `groundLevel` group, which ghosts with the house (the condenser's group), so they rest on the lawn even mid-ease.
- **The water's house-frame columns live in `GableRoof`'s fade groups**, outside the gutter's draw gate and its part tag, so with no gutter the curtains still draw. The left front set and its water fade with the Complete house, and the curtain splits at the cut.
  - Every rain column draws through one shared `RainField`, generalised to take a list of columns: one instanced mesh per list. `HomeRain`'s six sky fields become one `RainField`.
  - `GutterFlow` and `gutterFlow` are deleted. They have no reader left once the rule above exists.
- **Draw budget (in calls).**

  | Condition | Dry change | Rain before | Rain after | Rain change |
  |---|---|---|---|---|
  | Good | +2 feet | 6 sky + 2 spouts = 8 | 1 sky + 2 outlets + 2 sheen = 5 | −3 |
  | Worn | +2 | 9 | 1 + 1 trickle + 2 + 2 = 6 | −3 |
  | Failing | +2 | 7 | 1 + 1 trickle/curtain + 2 + 2 + 1 band = 7 | 0 |
  | No gutter | 0 | 6 | 1 + 2 curtains + 2 sheen + 2 bands = 7 | +1 |
  | Flat, with gutters | +1 | 8 | 1 + 1 outlets = 2 | −6 |

  The dry +2 is the owner's ruling (2026-11-12): grounded feet over a half-second float, one mesh per fade group.

**Rulings (each costs only rework if wrong):**
- **The wet band joins the foot bands,** not `stains.front`. It goes in `HouseShell`'s `frontSplash` and `sidesSplash`, and the `Foundation`'s `stains.front` and `stains.kept`. Those are the wall-foot bands per foundation, already split into the Complete and kept groups.
- **The feet are grounded (owner, 2026-11-12).** Foot elbows, extensions and outlets draw at ground level, in the world frame, for a dry cost of one mesh per fade group (+2 on a gable, +1 on a flat roof). This overrides the spec's "the dry count may not rise".
- **Up close follows the rule (owner, 2026-11-12).** The cutaway's rain lands near `HOUSE.cutX`, never inside the pulled span, so up close at Failing the rain goes into the sound gutter, as at Worn. The failure is told in the full view.
- **`RainField` is generalised (owner, 2026-11-12).** It is a shared file (`src/shared/components/scene/ui/rain-field.tsx`); its only user is `HomeRain`.
- **The sheen unmounts while a system is up close** (`lit !== null`). It would otherwise float over the near slope's opened steps. The water columns stay and ghost with the house.
- **`GutterFlow` is deleted, not renamed.**

**Tech Stack:** Next.js 15, React 19.2, `@react-three/fiber` 9.8.2, three 0.180, the zustand scene store. Checks are the repo's `tsx` verify scripts (`node:assert/strict`), the Playwright probe against the owner's dev server, and screenshots.

**Spec:** `docs/superpowers/specs/2026-11-11-trade-scene-gutter-realism-design.md` (owner, 2026-11-11, R316; stress-test rulings 2026-11-12). The owner-approved mockups are `.superpowers/brainstorm/1033110-1794459079/content/gutter-profile.html` (card B) and `rain-story.html`.

## Global Constraints

- **Committing:**
  - Commit per task, only through `.superpowers/sdd/2026-11-06-trade-scene-colour-picking/commit-own.sh <message-file> <path>... [patch:<file>]`, by explicit paths.
  - Other sessions edit this worktree. At Task 0, list `git status --short -- src scripts` in the ledger; every hunk it shows is foreign (on 2026-11-12: the removed `PIN_CLEARANCE` check in `scripts/verify-trade-scene.ts`). Before each commit, list it again.
  - Never commit a foreign hunk. For a file that holds one, snapshot your own hunks to a patch under `.superpowers/sdd/2026-11-11-trade-scene-gutter-realism/foreign/` and pass `patch:<file>`.
  - Run `git show --stat HEAD` after each commit. The commit gets a 300000 ms timeout, and never `--no-verify`.
  - Every file this plan edits is LF. After any scripted edit, check that `git diff --shortstat` still shows only your lines.
- **Forbidden git:** never `git add -A` or `.`, stash, reset, `checkout --`, restore, amend, merge, rebase or push. Never push `feat/trade-scenes-foundation`.
- **Never stage** `docs/**` or `CONTEXT.md`.
- **Never:** DB writes of any kind, or `pnpm build`.
- **Dev server:** never start, stop or restart it. :3002 is the owner's and serves this worktree. Never `rm -rf .next`. If it doesn't answer (`ss -ltnp`), stop and ask.
- **The probes render in software (SwiftShader), and a multi-case sweep has crashed the owner's machine.** Run one scene case per process (`--only <case>`), each under `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock`, never two at once. Whatever a task's list leaves out, the owner checks on the device.
- **Signing in:** only via `/api/dev/playwright-session?…&as=info%40triprosremodeling.com`, never `role=`. Never print the secret.
- **Never add** a hook, `window` global or `data-` attribute to the app to reach the store. The probe reaches it through the React devtools hook (`.superpowers/sdd/2026-11-09-trade-scene-gutters/shots/black-probe.mjs` is the pattern, with its `--set frame`).
- **Commands:**
  - `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock pnpm tsc`
  - `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock env CI=1 pnpm eslint <files>`
  - `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsx scripts/verify-construction-model.ts`, `pnpm tsx scripts/verify-bill-cut-claims.ts`, `pnpm tsx scripts/verify-trade-scene-layout.ts`, `pnpm tsx scripts/verify-trade-scene-lot.ts`
- **Paths:** `F/` = `src/features/trade-scenes/`. Build records go in `.superpowers/sdd/2026-11-11-trade-scene-gutter-realism/` (gitignored; Task 0 creates it). `R` below is `ROOF_HALF_LENGTH`.
- **Verify-script places are named by their assertion text, never by line number:** the file moves under other sessions.
- **Base:** `feat/trade-scenes-foundation` at `791819c62` or later.
- **The layout lab (`feat/scene-layout-lab`) edits eight of these files** (`gable-roof`, `house-roof`, `house-shell`, `foundation`, `home-kit`, `home-details`, `lot-height-at`, the verify script). This plan lands on the foundation branch first; the lab merges it in, as it already merges the foundation. `lotHeightAt(z)` keeps its signature there.
- **Shared files in scope (owner, 2026-11-12):** `src/shared/components/scene/ui/rain-field.tsx` and `src/shared/components/scene/types.ts`. No other shared file.
- **Code rules:**
  - Comments say why, never what, and never cite a plan, spec, task or Review Focus line.
  - One component per file, named exports. Constants go in `constants/`, pure helpers in `lib/`, three.js helpers in `ui/lib/`.
  - No defensive code for states the types rule out.
  - Callers pass memoized or module-level arrays to every geometry-building component.
  - Every new mesh owns its geometry through `useOwnedGeometry`, and a texture it creates is disposed or module-level.
  - Water and sheen meshes take `raycast={ignoreRaycast}`, so a tap passes through to the wall or roof. The gutter mesh keeps the gutter's part tag and stays tappable, as today.
  - Hide by unmounting or by a group's `visible`, never a mesh's own: `applyGhost` writes each mesh's `visible`.
  - A gutter's condition is always `wear` in code.
- **Nothing else moves:** savings, the resolver and the controls. No copy is added.
- **Rain only:** every water, sheen and band effect mounts or fills only while the weather is Rain.
- **Working numbers:** every size, count, colour and speed this plan gives is a working number, settled by shot. Each one's constant gets the file's usual "A working number, set by shot." comment.

## Review Focus

1. **Partly open, at every wear.** The kept run's end at the cut shows a clean flat section, with no gap or overlap against the Complete run. The left front downspout, its foot and its water fade and rise with the Complete house; the right ones and the back stay. Tests: Task 2 (flush sections, the cut faces' area) and Tasks 3 and 4 (the fade split, front sets only).
2. **Slab, raised, and the ease between.** The feet and outlets rest on the lawn on both foundations and mid-ease; the verticals and water columns always reach at least the lawn. Tests: Task 3 (feet on grade; the vertical meets its elbow at every eased floor height) and Task 4 (every house-frame column reaches `LOWEST_LAWN_Y`, every outlet's foot on grade).
3. **Rain, then a dry weather.** No band, curtain, outlet, sheen or trickle is left. Tests: Task 6 (`gutterWetSpans(…, raining: false)` is empty), Task 4 (the source checks that the water mounts only under `raining`), and the dry shots.
4. **"+ Gutters" over a Failing gutter, proposed view.** The new gutter drains to all four downspouts, with no curtain, no trickle and no band, while the old fascia's overflow stain keeps its rule. Test: Task 4 (`gutterWater('new', …)` against `'failing'`) and Task 6 (`'new'` spans empty).
5. **A flat roof in every gutter state.** No sheen, curtain, trickle or band. With gutters, only its two back outlets, at the extension ends. Tests: Task 4 (flat roof deep-equal across wears, none when `null`) and Task 6 (flat roof spans empty).

---

### Task 0: The frame-cost baseline

**Files:** none in `src/`. Records go in the workspace.

- [ ] **Step 1:** Create the workspace. Copy `black-probe.mjs` into its `shots/` and add frame cases. Each case is the gable Existing 1998 home (and the flat-roof home for `flat`) with gutters at:
  - not set;
  - `'present'` at Good, Worn and Failing;
  - flat, `'present'` at Good.

  Each case runs once under Normal and once under Rain: ten cases in all.
- [ ] **Step 2:** On the owner's server at the current head, before Task 1 touches anything, record the probe's `info()` draw calls for each case, one case per process.
- [ ] **Step 3:** Ledger: the head SHA, `git status --short -- src scripts`, and the ten rows. Task 7 compares against them. The owner's server serves only the head, so a baseline cannot be taken again later: if other sessions commit to `F/ui/components/home-kit/` before Task 7, record those commits and the meshes they add, and Task 7 counts them out.

### Task 1: The path a run follows

**Files:**
- Create: `F/lib/gutter-run.ts`
- Delete: `F/lib/gable-gutter-boxes.ts`. Its readers move: `gutter-marks.ts`; `home-rain.tsx` (its only reader of `gutterRunSpans`, whose shape changes from `{ sag: [a, b] | null, pulled }` to `{ sagLow, pulled }`: its drip column narrows to `HOME_RAIN.drip.width` centred on `sagLow` until Task 4 replaces it); and `gable-roof.tsx`, which keeps drawing the runs through a temporary `runBoxes` adapter in `gable-roof.tsx` that Task 2 deletes. `gable-roof.tsx` drops the gutter's two `TintedMarks` now; the streaks come back in Task 2's vertex colours.
- Modify: `F/types.ts`, `F/constants/home-details.ts` (`ROOF_TRIM.gutter.station: 0.1`, `hangerSpacing: 0.6`), `F/constants/wear-looks.ts` (`streaks.feather: 0.004`), `F/lib/gutter-marks.ts`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces, in `F/types.ts`:
  - `GutterStation = { x: number, drop: number, out: number, roll: number }`. Drop is down from `GUTTER_Y`, out is away from the house, roll is about the run, in radians;
  - `GutterRun = { face: 'front' | 'back', stations: readonly GutterStation[], capStart: boolean, capEnd: boolean }`.
- Produces, in `F/lib/gutter-run.ts`:
  - `gutterRuns(wear: Wear): { kept: readonly GutterRun[], complete: readonly GutterRun[] }`. `kept` is `[back, front from cutX to R]`; `complete` is `[front from −R to cutX]`;
  - `gutterRunSpans(wear: Wear): { sagLow: number | null, pulled: readonly [number, number] | null }`;
  - `gutterCatches(wear: Wear | null, x: number): boolean`;
  - `gutterDropAt(wear: Wear, face: 'front' | 'back', x: number): number`, the run's drop at x, interpolated between stations (Task 3 seats the downspout tops on it);
  - `stationPoint(face: 'front' | 'back', station: GutterStation): Vec3`, which is `[x, GUTTER_Y − drop, side × (GUTTER_OUT + out)]` with side ±1;
  - `gutterHangers(runs: readonly GutterRun[]): BoxSpec[]`: the hidden hangers, thin straps across the open top every `ROOF_TRIM.gutter.hangerSpacing` (0.6), following each station's drop. There are none where `out > 0`, because the pulled end has come off its hangers.
- Produces, in `F/lib/gutter-marks.ts`: `gutterStreaks(wear: Wear): readonly number[]`, the first `count[wear]` of the existing `STREAK_XS`. It replaces `gutterMarks`; `STREAK_END_MARGIN` and `streakOn` go from `gutter-marks.ts` (the unrelated `STREAK_END_MARGIN` in `stain-boxes.ts` stays). `gutterFasciaStains`, `gutterWallStains` and `OVERFLOW_ALONG` stay as they are.

- [ ] **Step 1: Write the failing checks.** They replace the `gableGutterBoxes`, `gutterRunSpans` and `gutterMarks` blocks. Let `sag = WEAR_LOOKS.gutter.sag`, `pulled = WEAR_LOOKS.gutter.pulled` and `end = R − pulled.length`.
  - `gutterRuns('good')` deep-equals `gutterRuns('new')`.
  - New: `kept.length === 2` and `complete.length === 1`. Every station has `drop`, `out` and `roll` all 0.
  - **Caps.** Back `capStart` and `capEnd` are true. Complete front `capStart` is true and `capEnd` false. Kept front `capStart` is false and `capEnd` true.
  - **At every wear,** the Complete front's last station and the kept front's first both sit at x `HOUSE.cutX`, with drop, out and roll 0 — "the two pieces meet on the same section".
  - At every wear, each run's stations rise strictly in x, and no gap exceeds `ROOF_TRIM.gutter.station + 1e-9`.
  - **Worn:** the maximum drop is `sag.worn` (±1e-9), at x `gutterRunSpans('worn').sagLow`, which is `(HOUSE.cutX + R) / 2`. Drop is 0 at `cutX` and at `R`.
    - Between neighbouring gaps the slope changes by at most 0.02 — "the sag is a smooth dip".
    - The first gap's slope is ≤ 0.01 — "no kink where the kept run meets the Complete one".
  - **Failing:** at `R`, the drop is `pulled.drop`, out `pulled.out` and roll `pulled.tilt`. At `end`, all three are 0. Every station below `end` has out and roll 0. `gutterRunSpans('failing')` gives `{ sagLow: (HOUSE.cutX + end) / 2, pulled: [end, R] }`.
  - Every station with a non-zero drop, out or roll has `x ≥ HOUSE.cutX − 1e-9`.
  - `gutterDropAt('worn', 'front', sagLow)` is `sag.worn`; `gutterDropAt(w, 'back', x)` is 0 at every wear.
  - **`gutterCatches`:**
    - `(null, 0)` is false;
    - `('good', R)` and `('worn', R)` are true;
    - `('failing', R − 0.6)` is false;
    - `('failing', HOUSE.cutX)` is true.
  - **Streaks.** `gutterStreaks(wear).length === WEAR_LOOKS.gutter.streaks.count[wear]` for each wear. Each streak `x` has stations at `x ± width / 2` and at `x ± (width / 2 + feather)`, in whichever front run covers it.
  - **Hangers.** `gutterHangers(gutterRuns('failing').kept)` has no hanger with x inside `pulled`. On New, each run's hangers are no more than `hangerSpacing` apart.
  - Keep the existing `gutterFasciaStains` and `gutterWallStains` assertions as they are.
- [ ] **Step 2:** Run the script. Expected: FAIL on the imports.
- [ ] **Step 3: Implement.**
  - Stations every `station`, plus exact stations at `cutX`, `end`, `sagLow`, `R`, `−R` and each streak's four.
  - Sag on `[cutX, end]` (`end` is `R` below Failing): `drop = sag × sin²(π t)`, where t runs 0→1 over that span.
  - Pulled on `[end, R]`, with t running 0→1 over that span: `drop = pulled.drop × t²`, `out = pulled.out × t²`, `roll = pulled.tilt × t²`.
  - The back run is straight at every wear.
  - The temporary `runBoxes(runs)` in `gable-roof.tsx` turns each pair of stations into a box, as `segment` did, so the scene still draws until Task 2.
- [ ] **Step 4:** Run the verify scripts, `tsc` and eslint. Expected: all `ok`.
- [ ] **Step 5: Commit.** `refactor(trade-scenes): a gutter run is one path of stations, with a smooth sag and a pulled end that bends away`.

### Task 2: The K-profile, one piece per run

**Files:**
- Create: `F/ui/lib/gutter-geometry.ts`, `F/ui/components/home-kit/gutter-run-mesh.tsx`
- Modify: `F/constants/home-details.ts` (`ROOF_TRIM.gutter.profile`), `F/ui/components/home-kit/gable-roof.tsx` (the `runBoxes` adapter goes)
- Test: `scripts/verify-trade-scene.ts`, plus shots

**Interfaces:**
- Consumes: Task 1's runs, `gutterStreaks`, `gutterHangers`, and `downspoutBoxes('pitched')` as it is today.
- Produces:
  - `ROOF_TRIM.gutter.profile: { outline: readonly (readonly [number, number])[], cap: readonly (readonly [number, number])[], front: readonly [number, number] }`. All three are in metres, as (out, up) about the run's centre line:
    - `outline` is the sheet's closed section, counter-clockwise;
    - `cap` is the end plate's closed polygon, the outer contour shut across the top;
    - `front` is the `[first, last]` indices of the outline's outer front-face points.

    Take the shape from the mockup's card B path, scaled so its width is `ROOF_TRIM.gutter.size` and centred on the run's centre line: a flat back, a flat bottom, the cove and ogee front, the rolled lip, and an open top. The sheet is 0.003 thick.
  - `gutterGeometry(runs: readonly GutterRun[], boxes: readonly BoxSpec[], streaks: readonly number[], color: string, streakColor: string): BufferGeometry`.
    - It extrudes `outline` along each run's stations, turned by each station's roll and following the path's slope.
    - Every end gets the section face. Only a `capStart` or `capEnd` end also gets the `cap` plate.
    - It merges in `tintVertices(mergeBoxes(boxes, 0.01), color)` (`F/ui/lib/vertex-tinted-geometry.ts`), so every part carries `position`, `normal`, `uv` and `color`; the sweep writes a zero `uv`. Not `mergeTinted`: it recomputes the normals.
    - The sweep's normals come from three's `toCreasedNormals` at 30°: smooth across the curved front, hard at the corners.
    - Every vertex takes `color`, except a front run's `front`-range vertices at a station within `width / 2` of a streak, which take `streakColor`.
  - `GutterRunMesh({ runs, boxes, streaks, color, streakColor, roughness }: { runs: readonly GutterRun[], boxes: readonly BoxSpec[], streaks: readonly number[], color: string, streakColor: string, roughness: number })` draws one mesh through `useOwnedGeometry`, castShadow, `meshStandardMaterial` with `vertexColors`, colour `'#ffffff'` and the roughness passed in.

- [ ] **Step 1: Write the failing checks** on `gutterGeometry` in node. "A face at x" means a triangle whose three vertices all have x within 1e-9 of it.
  - A New back run alone: its bounding box runs `−R..R` in x, and in y it spans `GUTTER_Y +` the outline's min and max up.
  - **Flush at the cut, at every wear.** The vertices at x `cutX` of the Complete front run and of the kept front run give the same set of (y, z) points, rounded to 1e-6.
  - **Ends.** The Complete run's faces at `cutX` have a total area equal to the outline's area (±1%). Its faces at `−R` total the outline's area plus the cap's — "flat at the cut, capped only at the true ends".
  - **Streaks.** For `gutterRuns('failing')` with `gutterStreaks('failing')`, at a station within a streak, the `front`-range vertices carry `streakColor` and the back face's carry `color`. A station outside every streak carries `color` throughout. `gutterRuns('new')` with no streaks is all `color`.
  - **Boxes.** The vertex count with `boxes` equals the count without plus `mergeBoxes(boxes, 0.01)`'s, and every attribute's item count matches `position`'s.
- [ ] **Step 2:** Run the script. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `GableRoof` memoizes `gutterRuns(gutter.wear)` and `gutterStreaks(gutter.wear)` on the wear. It splits the streaks at `cutX` into the Complete run's and the kept run's.
  - The kept group draws `GutterRunMesh` with `runs.kept`, `[...downspoutBoxes('pitched'), ...gutterHangers(runs.kept)]`, and the kept streaks. The Complete group draws `runs.complete`, with `gutterHangers(runs.complete)` as its only boxes.
  - Both take `gutterLook`'s colour and roughness, with `WEAR_LOOKS.gutter.streaks.color` as the streak colour.
  - The fascia's `PaintStains` stays.
- [ ] **Step 4: Shots,** one case per run at 1194x834 dark, Normal weather:
  - the whole home at New in Almond;
  - the close-up front of the kept run at Fair, Worn and Failing in Almond;
  - Failing in Black;
  - Failing on Partly open;
  - Fair under the Thermal lens: the gutter reads one temperature, no streaks.

  Then the owner's own open look: do the Fair streaks still read as seams?
- [ ] **Step 5:** Run the verify scripts, `tsc` and eslint. **Commit:** `feat(trade-scenes): gutters are K-style, one seamless piece per run, sagging and pulling away within it`.
- [ ] **Step 6: Owner look, not blocking.** List the shots' paths for the owner and carry on with Task 3. Any retune of the profile or the path lands as a fix before Task 7.

### Task 3: Downspouts at all four corners

**Files:**
- Create: `F/ui/components/home-kit/downspout-feet.tsx`
- Modify: `F/constants/home-geometry.ts` (`DOWNSPOUTS`, `DOWNSPOUT_LOOK`, `LOWEST_LAWN_Y`), `F/lib/downspout-boxes.ts`, `F/ui/components/home-kit/gable-roof.tsx`, `F/ui/components/home-kit/low-slope-roof.tsx`, `F/ui/components/home-kit/home-kit.tsx`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- **`DOWNSPOUTS`.**
  - `pitched.at` gains `[-HOUSE.halfLength + 0.3, HOUSE.halfDepth + 0.08]` and `[HOUSE.halfLength - 0.3, HOUSE.halfDepth + 0.08]`. Move them out if the front wall's face or the corner trim (`CORNER_Z`) is closer than 0.01.
  - Both forms' `size` becomes `section: { across: 0.076, out: 0.051 }`, a 2 × 3 in downspout with its wide face to the street.
  - A set's outward direction is the sign of its z. **A front set is one with z > 0;** the fade split and the torn set apply to front sets only (the back sets stand at the same x).
- **`DOWNSPOUT_LOOK`,** beside `DOWNSPOUTS`: `{ gooseneckDrop: 0.1, footRise: 0.12, extension: 1.2, tornGap: 0.3 }`.
- **`LOWEST_LAWN_Y`** in `home-geometry.ts`: `-(HOME_FLOOR_Y.raised - HOUSE.floorY)`, today's `BOTTOM` in `downspout-boxes.ts`, which then imports it.
- **House frame — `downspoutBoxes(form: RoofForm): BoxSpec[]`** (signature unchanged). Every set intact: a gable set's gooseneck from the gutter's outlet back to the wall and its vertical down to `LOWEST_LAWN_Y`; a flat-roof set's scupper box and vertical, as today.
- **`gableDownspouts(wear: Wear): { kept: BoxSpec[], complete: BoxSpec[] }`,** house frame.
  - The left front set goes in `complete`; the other three in `kept`.
  - Each gable set's top meets the gutter's bottom at its own x: `GUTTER_Y − gutterDropAt(wear, face, x) +` the profile's min up.
  - At Failing, the front set whose x lies in `gutterRunSpans('failing').pulled` is torn: no gooseneck, and its vertical's top stops `tornGap` below the gutter's bottom.
- **Ground level — `downspoutFeet(form: RoofForm): { kept: BoxSpec[], complete: BoxSpec[] }`,** in the world frame, where the lawn's height is `lotHeightAt(z)`.
  - Each set's foot elbow, `footRise` tall, and its extension, which angles down to rest its far end on `lotHeightAt(endZ)`, `extension` further out than the vertical.
  - Every set at every wear, the torn one included. The left front set in `complete`; a flat roof's all in `kept`.
- **`downspoutOutlet(at: readonly [number, number]): Vec3`,** world frame: the centre of the extension's open end, for Task 4.
- **`DownspoutFeet({ form, thermal })`** draws `downspoutFeet(form)` as `MergedBoxes` (module-level per form), wrapped in `thermalTag('roof', 'gutter')` and `systemPartTag('gutter')`, the Complete list in `HOME_FADE_TAGS.complete`. It takes the gutter's colour and roughness.
- **`home-kit`** mounts `DownspoutFeet` in the `groundLevel` group whenever the home has a gutter, and also runs `riseFadeGroup(groundLevel.current, 'complete', …)` beside the house's, so the left front foot rises with its vertical.
- **`GableRoof`** memoizes `gableDownspouts(wear)` and passes `kept` and `complete` (with the hangers) to their `GutterRunMesh`es. `LowSlopeRoof`'s module-level `DRAINS` stays.

- [ ] **Step 1: Write the failing checks.** They replace the "reach the ground on a raised floor" check.
  - Every set of both forms has the same pieces, front and back.
  - **Feet:** each extension's far end rests on `lotHeightAt(endZ)`, no lower than 0.005 below it and no higher than 0.03 above, and lies at least 1.1 m further from the house than its vertical (`|z|`).
  - **Through the ease:** for each set and every floor height `floorY` from `HOME_FLOOR_Y.slab` to `HOME_FLOOR_Y.raised` in 10 steps, the vertical's world foot (`LOWEST_LAWN_Y + floorY − HOUSE.floorY`) is no higher than its foot elbow's top — "the vertical never leaves its elbow".
  - **Front sets** clear every `FRONT_OPENINGS` entry by at least 0.3 m in x. The existing garage check covers them.
  - **`gableDownspouts` and `downspoutFeet`, at every wear:**
    - `complete` holds exactly the set at `[-HOUSE.halfLength + 0.3, z > 0]`;
    - no box straddles `cutX`;
    - `kept` holds the other three, the back-left set among them.
  - **Below Failing,** each gable set's top meets the gutter's bottom at its x within 1e-6, Worn included.
  - **At Failing,** the set at `[HOUSE.halfLength − 0.3, z > 0]` has no box above its gutter bottom `− tornGap + 1e-9`. The other three, the back-right set among them, are as at Good.
- [ ] **Step 2:** Run the script. Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces.
- [ ] **Step 4: Shots,** one case per run, Normal weather:
  - the front at Good on a slab and on a raised floor;
  - mid-ease, raised to slab: the feet on the lawn;
  - the front at Failing, showing the torn right set;
  - the front at Good on Partly open: the left set gone with its foot;
  - the back at Good;
  - the flat roof's back.
- [ ] **Step 5:** Run the verify scripts, `tsc` and eslint. **Commit:** `feat(trade-scenes): gutters drain to a downspout at each corner, each with a gooseneck, a foot elbow and an extension out onto the lawn; a failing gutter's torn end leaves its downspout hanging`.

### Task 4: The water

**Files:**
- Create: `F/lib/gutter-water.ts`, `F/lib/eave-drip.ts`
- Delete: `F/lib/gutter-flow.ts`, and `GutterFlow` from `F/types.ts`
- Modify: `src/shared/components/scene/ui/rain-field.tsx`, `src/shared/components/scene/types.ts` (`RainColumn`), `F/constants/home-life.ts` (`HOME_RAIN` loses `spout`, `drip` and `overflow`; `GUTTER_WATER` is added), `F/lib/drip-edge-boxes.ts` (`eaveLipBox`), `F/ui/components/home-kit/home-rain.tsx`, `house-roof.tsx`, `gable-roof.tsx`, `home-kit.tsx` (and its now-unused `GUTTER_Y`, `homeLift` and `gutterFlow` imports go), `F/lib/cutaway-rain-path.ts`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- **`RainColumn = { box: Vec3, position: Vec3, streaks: number }`** in `src/shared/components/scene/types.ts`.
- **`RainField({ columns, running }: { columns: readonly RainColumn[], running: boolean })`.**
  - One `InstancedMesh` with `Σ streaks` instances, keyed on that total; each instance seeded inside its own column, falling and wrapped as today.
  - The instances are interleaved across columns, so the existing ease of the count from 0 thins every column alike.
  - `ignoreRaycast`, `frustumCulled={false}`, and the frame callback only while running, as today. Nothing renders for an empty list.
- **`HomeRain({ running })`** draws its sky fields as one `RainField`, each field a column whose `streaks` is today's `intensityOf(box) × RAIN.maxStreaks`, rounded.
- **`eaveLipBox(zFrom: number, zTo: number): BoxSpec`,** pulled out of `dripEdgeBoxes` (which uses it), in the slope's frame.
- **`EAVE_DRIP: { y: number, out: number }`** in `F/lib/eave-drip.ts` (not `home-geometry.ts`: `drip-edge-boxes.ts` imports that file). It is the lip's outer face carried from the slope's frame into the house frame: `out` is a z (`HOUSE.halfDepth +` the lip's outer offset from the wall face), `y` the lip's bottom. The verify script's `lipOuter` derivation uses `eaveLipBox` too.
- **`GUTTER_WATER = { curtain: { perMetre: 30, depth: 0.05 }, outlet: { box: [0.07, 0.18, 0.07], streaks: 14 }, trickle: { width: 0.05, streaks: 22 } }`.**
- **`gutterWater(wear: Wear | null, form: RoofForm): { kept: RainColumn[], complete: RainColumn[] }`,** house frame. Every column's foot is at `LOWEST_LAWN_Y`.
  - **Pitched, `null`:** curtains from `EAVE_DRIP.y` down. Front `[−R, cutX]` goes in `complete`; front `[cutX, R]` and back `[−R, R]` go in `kept`.
  - **Worn and Failing:** a trickle at `sagLow`, from the gutter's bottom at the sag down, at the lip's z.
  - **Failing:** also a curtain over exactly the pulled span, at `EAVE_DRIP`.
  - A curtain's `streaks` is `round(length × perMetre)`.
  - **Flat roof, or New, Good, Fair:** empty.
- **`gutterOutlets(wear: Wear | null, form: RoofForm): { kept: RainColumn[], complete: RainColumn[] }`,** world frame: one outlet at `downspoutOutlet` for each set `gableDownspouts` leaves whole (a flat roof: its two back sets, in `kept`), its foot on `lotHeightAt` there. `null` gives nothing.
- **Mounting.**
  - `GableRoof` takes `raining: boolean` and `running: boolean`. Under `raining` it draws `gutterWater`'s lists as `RainField`s in `thermalTag(OWN_PAINT)` groups: kept beside the gutter, Complete inside the existing `HOME_FADE_TAGS.complete` group. Both sit outside the `gutters !== null` gate and outside `systemPartTag('gutter')`. Memoized on wear.
  - `HouseRoof` takes `raining` and passes `running={burst.running}`. `LowSlopeRoof` takes nothing new.
  - `home-kit` passes `raining={weather === 'rain'}`, and under it draws `gutterOutlets`' lists as `RainField`s in `groundLevel`, beside `DownspoutFeet`, with the same tags.
- **`cutawayRainPath`, pitched:** with `gutterCatches(drawnGutterWear(parts), landing[0])`, it goes into the gutter and stops. Otherwise it spills from the last point, as with no gutter. (Owner, 2026-11-12: up close at Failing lands on the sound part and drains.)

- [ ] **Step 1: Write the failing checks.** They replace the `gutterFlow` block. Run every outlet check on each foundation's `lotHeightAt`.
  - New and Good: `gutterWater` empty; `gutterOutlets` 3 kept and 1 Complete.
  - Worn: one trickle at x `sagLow` in `kept`; the four outlets.
  - Failing: one trickle and one curtain whose x extent is exactly `pulled`; 2 kept outlets and 1 Complete outlet.
  - **`null`, pitched:**
    - the Complete curtain's x extent is `[−R, cutX]` and the kept front's is `[cutX, R]`;
    - the back curtain's is `[−R, R]` at negative z;
    - each curtain's z is `±EAVE_DRIP.out`;
    - there are no outlets.
  - **`new` against `failing`:** `new` has no curtain and no trickle, and 4 outlets. This is the "+ Gutters over a Failing gutter" case.
  - **Flat roof:** `gutterWater` always empty; `gutterOutlets(null)` empty; `new`, `worn` and `failing` deep-equal one another, with 2 kept outlets.
  - **Every house-frame column's** foot (`position[1] − box[1] / 2`) is at `LOWEST_LAWN_Y` within 1e-9; **every outlet's** at `lotHeightAt` of its z. Every `streaks > 0`.
  - **`EAVE_DRIP`:** `out` lies between the fascia's face and the gutter's back; the verify script's lip-to-gutter clearance reads it.
  - **`RainField`:** a source check that it builds `Σ streaks` instances and interleaves columns (by the seeded order's assertion message), in the style of the existing source-text checks.
  - **Mount checks** (source text of `gable-roof.tsx`): the water's `RainField`s sit under `raining` and outside the `gutters !== null` block.
  - **Up close.** Replace the Failing rain-path assertions: `gutterCatches('failing', wornEnd[0])` is true, and the Failing path's end deep-equals `wornEnd` — "a sound part of a failing gutter still takes the rain". Beside it, `gutterCatches('failing', R − 0.6)` is false.
- [ ] **Step 2:** Run the script. Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces.
- [ ] **Step 4: Shots** in Rain, one case per run:
  - Good, front;
  - Failing, front;
  - no gutters, front, and no gutters on a raised floor (the curtain against the front steps);
  - Good on a raised floor;
  - the flat roof's back;
  - the up-close roof at Failing;
  - Good under the Thermal lens, where the streaks keep their own look.

  Then one dry shot at Failing: no water anywhere. Record the draw calls of each.
- [ ] **Step 5:** Run the verify scripts, `tsc` and eslint. **Commit:** `feat(trade-scenes): in the rain the gutters carry the water to the downspouts and out onto the lawn; with no gutter, or where one has failed, it falls off the eave beside the wall`.

### Task 5: The roof's sheen

**Files:**
- Create: `F/ui/lib/create-sheen-texture.ts`, `F/ui/lib/roof-sheen-geometry.ts`, `F/ui/components/home-kit/roof-sheen.tsx`
- Modify: `F/constants/home-life.ts` (`ROOF_SHEEN`), `F/ui/components/home-kit/gable-roof.tsx`, `F/ui/components/home-kit/roof-steps.tsx` (if it needs to pass a second child)
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- `ROOF_SHEEN = { lift: 0.012, color: '#dfe9f2', opacity: 0.35, speed: 0.6, tile: [1.5, 1] }`. The speed is metres per second down the slope; the tile is the texture's size in metres, across and down.
- `createSheenTexture(): CanvasTexture`: thin streaks of varied length drawn grey-to-white on black (an `alphaMap`; no colour space), with `RepeatWrapping` both ways. `create-rot-stain-texture.ts` is the pattern: a canvas keeps no colour under clear pixels.
- **`roofSheenGeometry(zFrom: number, zTo: number, rise: number): BufferGeometry`,** in the slope's own frame (`RoofSlope`'s children frame: x up the slope, z along the ridge).
  - A quad from `SLOPE_LENGTH` down to `COVERING_EAVE_X`, at `COVERING_BASE + rise + ROOF_SHEEN.lift` off the rafters' top, across `[zFrom, zTo]`.
  - A second strip turning down over the drip edge, from the covering's edge to `eaveLipBox`'s outer bottom, so the sheen tips over the edge into the gutter's open top or past it.
  - UVs are in tile units: u along the ridge, v rising down the slope and on down the strip, so a growing offset moves the streaks downhill and over the edge.
- **`RoofSheen({ zFrom, zTo, covering, running }: { zFrom: number, zTo: number, covering: string | null, running: boolean })`.**
  - One mesh through `useOwnedGeometry`, `raycast={ignoreRaycast}`, with the module-level texture (made once, `texture ??= createSheenTexture()`) as `alphaMap`. `meshStandardMaterial` is transparent, with `depthWrite={false}`, `ROOF_SHEEN`'s colour and opacity, and roughness 0.2.
  - `rise` is `CUTAWAY_COVERING_RISE[covering ?? 'default'] ?? CUTAWAY_COVERING_RISE.default`; `GableRoof` passes `covering.material`.
  - While running, a frame callback sets (never adds to) the shared texture's offset from `state.clock.elapsedTime × speed`, so every slope's sheen is in step at the cut.
- **In `GableRoof`,** under `raining` and only while `lit === null` (unmounted otherwise), each as a child of its slope, in the `thermalTag(OWN_PAINT)` wrapping:
  - the back `RoofSlope`, `[−R, R]`;
  - the near slope's Complete `RoofSlope`, its `[zFrom, zTo]`;
  - the near slope's kept part, through `RoofSteps`' child, its `[zFrom, zTo]`.

  `LowSlopeRoof` gets none.

- [ ] **Step 1: Write the failing checks** on `roofSheenGeometry(HOUSE.cutX, R, 0.03)`.
  - Every vertex's z lies in `[cutX, R]`.
  - Every quad vertex lies `COVERING_BASE + 0.03 + lift` off the rafters' plane (±1e-6).
  - The quad's lowest vertex is at `COVERING_EAVE_X` along the slope; the strip's lowest at the lip's outer bottom.
  - v rises from the ridge to the strip's end.
- [ ] **Step 2:** Run the script. Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces.
- [ ] **Step 4: Shots** in Rain, one per run:
  - the front at Good in shingle;
  - no gutters in tile (crooked Failing tiles: nothing pokes through);
  - the eave close: the sheen going over into the gutter;
  - the up-close roof, where the sheen is gone.

  Record the draw calls.
- [ ] **Step 5:** Run the verify scripts, `tsc` and eslint. **Commit:** `feat(trade-scenes): in the rain a sheen of water slides down each slope and over the eave`.

### Task 6: The wet band, in rain only

**Files:**
- Modify: `F/lib/stain-boxes.ts`, `F/lib/gutter-water.ts`, `F/constants/wear-looks.ts` (`wetBand`, beside the splash band's colour and alpha), `F/types.ts` (`GutterWetSpans`), `F/ui/components/home-kit/house-shell.tsx`, `F/ui/components/home-kit/foundation.tsx`, `F/ui/components/home-kit/home-kit.tsx`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- `wetBand = { height: 0.35, color: '#3e3a35', alpha: 0.55 }` in `wear-looks.ts`, beside `splashColor`.
- `GutterWetSpans = { front: readonly (readonly [number, number])[], back: readonly (readonly [number, number])[] }`.
- **`gutterWetSpans(wear: Wear | null, form: RoofForm, raining: boolean): GutterWetSpans`.**
  - Not raining, or a flat roof: both empty.
  - Pitched `null`: `[[−R, R]]` on each.
  - Failing: the front holds `[pulled]` and the back is empty.
  - Otherwise: both empty.
- **`bandBoxes(wall: HouseWall, span: readonly [number, number], base: number, top: number, openings: readonly WallOpening[]): BoxSpec[]`** in `stain-boxes.ts`: `splashBand`'s per-layer body (clamped to the wall's run, stepping round an opening whose sill is below the top), pulled out so `splashBand` and the wet band share it. An opening straddling the span's edge still steps the band.
- **`wetBandBoxes(wall, span, base, height, openings, stretch = 1): BoxSpec[]`** is `bandBoxes` at `height / stretch` tall.
- **`HouseShell` and `Foundation` take `wetSpans: GutterWetSpans`.** Each appends one `{ cell: 'splash', boxes, color, alpha }` list:
  - in `HouseShell`: to `frontSplash` (`FRONT_STAIN_WALL`, `FRONT_OPENINGS`, base `STUCCO_BOTTOM`) and to `sidesSplash` (the back entry of `STAIN_WALLS`);
  - in `Foundation`: to `stains.front` (`FRONT_SKIRT_STAIN_WALL`) and to `stains.kept` (the skirt's back wall), base 0, `RAISED_GROUND_STRETCH`.
- **`home-kit`** memoizes `gutterWetSpans(drawnGutterWear(parts), roofForm, weather === 'rain')` on its three inputs.

- [ ] **Step 1: Write the failing checks.**
  - `gutterWetSpans` for:
    - every wear with `raining: false`;
    - `null` pitched;
    - `'failing'`;
    - `'good'`;
    - `'new'`;
    - `null` on a flat roof.
  - `splashBand`'s existing checks still pass on `bandBoxes`.
  - `wetBandBoxes(FRONT_STAIN_WALL, [−R, R], …, FRONT_OPENINGS)`:
    - every box lies within the wall's run;
    - no box overlaps `FRONT_DOOR`'s width;
    - every box is `height` tall.
  - With `stretch = RAISED_GROUND_STRETCH`, every box is `height / stretch` tall.
  - `wetBandBoxes` over `pulled` ends at the wall's end, `HOUSE.halfLength`.
- [ ] **Step 2:** Run the script. Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces.
- [ ] **Step 4: Shots,** one per run:
  - Rain, Failing on a slab and on a raised floor;
  - Rain, no gutters;
  - Normal, no gutters: no band.

  Record the draw calls.
- [ ] **Step 5:** Run the verify scripts, `tsc` and eslint. **Commit:** `feat(trade-scenes): where the water lands at the wall, the foundation darkens wet while it rains`.

### Task 7: Frame cost, the owner's shots, every check

**Files:** none in `src/` unless a check fails. Records go in the workspace.

- [ ] **Step 1: Frame cost.** Rerun Task 0's ten cases at HEAD, one per process. It passes when every row is within the Architecture's budget table: dry at most +2 on a gable with gutters, +1 on a flat roof with gutters, 0 with none; Rain at most +6 over its own row. Record the table and any foreign commits since Task 0 in the ledger. If a row fails, find the mesh and fix it before going on.
- [ ] **Step 2: The owner's shots,** at 1194x834, one per run. Skip any the machine can't take, and say which.
  - In Rain, the whole home's front:
    - New in Almond;
    - Failing in Almond;
    - no gutters;
    - the "+ Gutters" build over the Failing home, in Black.
  - The close-up of the kept run at Worn and at Failing, Normal weather.
  - Failing on Partly open, in Rain.
  - Raised to slab, mid-ease, in Rain.

  List the paths for the owner.
- [ ] **Step 3:** Run all five verify scripts, `tsc`, and eslint on every file the plan touched.
  - Then grep the diff's added lines for "your", "solar" and "today", and for comments that cite a plan, task, spec or Review Focus line. Expected: clean.
  - Grep `src` and `scripts` for `gableGutterBoxes`, `gutterFrontRun`, `gutterFlow`, `GutterFlow`, `gutterMarks`, `streakOn`, `HOME_RAIN.spout`, `HOME_RAIN.drip`, `HOME_RAIN.overflow` and `DOWNSPOUTS.pitched.size`. Expected: none.
- [ ] **Step 4:** Ledger: `Task 7: complete`, the commit range, and the working numbers the owner still owes a look at: the profile, the sag curve, the extension length, the curtain density, the sheen, and the band's height and tone.
