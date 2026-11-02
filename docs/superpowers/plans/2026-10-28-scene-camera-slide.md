# Scene camera: slide, tap to look, recenter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the rep can slide the trade scene's camera, double-tap a spot on the whole home to look at it, and recenter, on the iPad and on a laptop (trackpad or mouse).

**Architecture:** the shared scene tier (`src/shared/components/scene/`, `S/` below) gains pure camera and gesture helpers, a small camera store, and opt-in pan and double-tap in `CameraRig`. The trade scene (`src/features/trade-scenes/`, `F/` below) passes its pan box, mounts the store, the Recenter chip and the tap ring, and adds the `R` shortcut.

**Code words (owner, 2026-10-29):** "slide" and "tap to look" are the spec's words for the gestures only. "Slide" is already a presentation slide (`CONTEXT.md`) and "Look" is the dock's Look drawer, so code says **pan** for the slide (OrbitControls' word: `PanBox`, `HOME_PAN`, `panSpeedFor`, the rig's `pan` option) and names the double-tap pieces after the gesture (`doubleTapFraming`, `TapRing`, `tapMark`, `doubleTapDistance`). Never `focus` (taken by `cameraFocus` and `partFocus`). On screen only "Recenter" appears.

**Tech Stack:** three 0.180.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9 (`OrbitControls` = three-stdlib 2.36.1), zustand vanilla stores, React 19, Next.js 15, Tailwind v4, motion/react.

**Spec:** `docs/superpowers/specs/2026-10-25-scene-camera-slide-design.md` (R103). Research: `docs/plans/2026-10-25-scene-camera-gestures-research.md`. Read both. Stress-tested 2026-10-29; the owner's rulings are folded in below.

## Global Constraints

- Worktree `.worktrees/trade-scenes`, branch `feat/trade-scenes-foundation`. pnpm. Never `pnpm build`.
- **Verification**, every task: `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock pnpm tsc` exits 0; `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock env CI=1 pnpm eslint <every file the task created or modified>` exits 0 (not the whole-repo `pnpm lint`); after any `eslint --fix`, `tsc` again. Plus the verify scripts the task names: `pnpm tsx scripts/verify-scene-primitives.ts`, `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsx scripts/verify-trade-scene-layout.ts`. Task 7 also runs `pnpm theme:check`.
- **Shared tree: other sessions commit here** (the iPad session; earlier TS3b.4a). No stash, checkout, restore, reset, `git add -A/./-u`. Before editing a shared file and again before staging it, run `git diff HEAD -- <file>` (it shows staged hunks too): any hunk that is not this task's → do not stage that file; report BLOCKED. Stage by explicit path, check `git diff --cached --name-only` lists only this task's files, commit with `git commit -m "…" -- <paths>` (300000 ms timeout: the pre-commit hook takes ~110 s), confirm with `git show --stat HEAD`. After any scripted edit, `git diff --shortstat <file>` shows only your lines. Never revert another session's edits.
- Conventions: one component per file, named exports, no file-level constants in component files (constants in `constants/`, pure helpers in `lib/`, contexts in `contexts/`, shared scene types in `S/types.ts`, object factories in `lib/create-*.ts`), comments say why only, no citations of plans or specs in code. New logic that can be pure goes in `lib/` with a check, not into `camera-rig.tsx`.
- Copy, verbatim: chip label `Recenter`; shortcut sheet line `Recenter the camera`; key `r` via `SCENE_SHORTCUT_KEYS`/`keycapLabel` (no literal in the chip).
- Numbers, from the spec and research: one press-travel limit per pointer type, `pressTravelPx = { touch: SCENE_MOTION.tapSlopPx (6), mouse: 4 }` (pen = touch): a press within it is a tap, past it is a move. Tap ≤ 300 ms; double-tap 300 ms between taps and 35 px between them; wheel stream gap 400 ms, decide-timeout 40 ms, mouse notch multiple 4.000244140625, trackpad small delta < 4, trackpad cadence `|Δt·deltaY| < 200`; double-tap distance 9 m; ring 600 ms; chip 22 px above the visible area's bottom beside a side card, 14 px above a bottom card (both in `SCENE_LAYOUT`).
- Keyboard camera movement stays off (no `keyEvents`). OrbitControls' wheel zoom never runs (our capture listener stops it).
- Reduced motion: the rig's existing behaviour for glides; the chip appears and leaves without its rise; the ring does not animate.
- Files off limits: anything outside `S/`, `F/`, the three verify scripts. No DAL, tRPC, schema or `package.json` change.
- **Playwright** (Task 6 Step 4, Task 8): use the owner's running dev server on port 3002 (`ss -ltnp` to confirm); never restart it or touch `.next` without asking. Auth `http://localhost:3002/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET>&as=info%40triprosremodeling.com&redirect=/dashboard/labs/trade-scene` (`as=` keeps the route from writing the user row). Chromium with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
- **GATE before Task 6 (owner, 2026-10-29):** TS3b.4a is done (crawl framing in `23acc3bdf`, `0ac039ae8`; final fix `61a0ef3ae`). The **iPad session's** `home-camera-rig.tsx` work and its `scripts/verify-trade-scene-layout.ts` edits go **first**: Tasks 6–8 start only once that session has committed them or said it has none, and `git diff HEAD` shows no foreign hunks in the files Tasks 6–7 touch (`home-camera-rig.tsx`, `home-scene-canvas.tsx`, `home-geometry.ts`, `scene-layout.ts`, `home-scene-copy.ts`, `scene-shortcuts.ts`, `use-scene-shortcuts.ts`, `trade-scene-view.tsx`, the verify scripts). Tasks 1–5 touch only `S/` (plus `F/ui/components/heat-arrows.tsx` and `F/ui/components/home-kit/heat-shimmer.tsx` in Task 5) and may run now. Re-read `home-camera-rig.tsx` after the gate: the snippets below assume its shape at `61a0ef3ae`.

## Review Focus

1. **A pinch or two-finger slide is never a tap or a double-tap**: a second pointer cancels the press (Task 2 test `two pointers never tap`; Task 8 check `two-finger pan`).
2. **A double-tap on the roof on the whole home** goes up close once and does not then look or lean: the first tap's zoom turns double-tap off before the second `pointerup`, read through a ref (Task 8 check `double-tap roof`, which also asserts `emphasizedPart === null`).
3. **Wheel over the card, the dock or the chip never moves the camera**: the listener sits on the canvas container only (Task 4; Task 8 check `wheel over card`).
4. **A pan stays put through a card fold, except with the crawl row open, and a turn across square drops it**: panSpeed follows the area; the fold that ends the crawl view is a framing change and drops the pan (owner, 2026-10-29) (Task 8 checks `fold keeps pan`, `crawl fold drops pan`, `turn drops pan`).
5. **Recenter mid-glide or pressed repeatedly never snaps**, `R` typed into a field does nothing, and a re-render (every press re-renders the rig through `touches`) never resets the tap tracker or the moved flag (Task 3 reducer checks; Task 8 checks `R twice`, `double-tap touch`).
6. **The iPad pinch zooms once**: Safari's `gesture*` listeners bind only on macOS (`navigator.maxTouchPoints === 0`) (Task 4; Task 8 check `touch context binds no gesture listeners`).

---

### Task 1: Camera math helpers

**Files:**
- Create: `S/lib/pan-scale.ts`, `S/lib/clamp-orbit-to-box.ts`, `S/lib/double-tap-framing.ts`, `S/lib/pan-offset.ts`
- Modify: `S/types.ts` (add `PanBox`), `S/ui/camera-rig.tsx` (only: import the shared `MIN_SHARE`; see below)
- Create: `S/constants/scene-camera-limits.ts` only if `MIN_SHARE` has no better home in `S/constants/scene-camera.ts` (prefer adding it there)
- Test: `scripts/verify-scene-primitives.ts`

**Interfaces:**
- Produces:
  - `type PanBox = { min: [number, number, number], max: [number, number, number] }` in `S/types.ts`
  - `MIN_SHARE = 1e-6` moved out of `camera-rig.tsx` into `S/constants/scene-camera.ts`, imported by the rig and by `panSpeedFor` (one number, not two copies)
  - `panSpeedFor(bottomShare: number): number` — `1 / max(1 − bottomShare, MIN_SHARE)`
  - `worldPerPixel(distance: number, fovDeg: number, visibleHeightPx: number): number` — `2·distance·tan(fov/2) / visibleHeightPx`
  - `clampOrbitToBox(target: Vector3, position: Vector3, box: Box3): boolean` — clamps `target` into `box` with `Box3.clampPoint`, moves `position` by the same delta, returns whether it moved
  - `doubleTapFraming(args: { point: Vector3, position: Vector3, target: Vector3, box: Box3, maxDistance: number }): { position: [number, number, number], target: [number, number, number] }` — target = `point` clamped into `box`; position = target + unit(position − target) × min(|position − target|, maxDistance)
  - `panOffset(args: { dxPx: number, dyPx: number, right: Vector3, up: Vector3, worldPerPx: number }): Vector3` — `right·(−dxPx·w) + up·(dyPx·w)` so the content follows the fingers (sign checked below)

- [ ] **Step 0:** Record the head; run the Global Constraints verification and the three verify scripts. Expected: all pass. Otherwise stop and report.
- [ ] **Step 1: Write the failing checks** in `scripts/verify-scene-primitives.ts`:

```ts
assert.equal(panSpeedFor(0), 1)
assert.ok(Math.abs(panSpeedFor(0.46) - 1 / 0.54) < 1e-9, 'a bottom card speeds the pan by the hidden share')
assert.ok(Number.isFinite(panSpeedFor(1)), 'a fully covered canvas never divides by zero')
assert.ok(Math.abs(worldPerPixel(10, 90, 500) - 0.04) < 1e-9)

const box = new Box3(new Vector3(-1, 0, -1), new Vector3(1, 2, 1))
const t = new Vector3(3, 1, 0), p = new Vector3(3, 1, 5)
assert.equal(clampOrbitToBox(t, p, box), true)
assert.deepEqual(t.toArray(), [1, 1, 0])
assert.deepEqual(p.toArray(), [1, 1, 5], 'the camera moves by the same delta, so the orbit keeps its angle')
assert.equal(clampOrbitToBox(t, p, box), false, 'inside the box nothing moves')

const goal = doubleTapFraming({ point: new Vector3(0.5, 0.5, 0.5), position: new Vector3(0, 0, 20), target: new Vector3(0, 0, 0), box, maxDistance: 9 })
assert.deepEqual(goal.target, [0.5, 0.5, 0.5])
assert.ok(Math.abs(new Vector3(...goal.position).distanceTo(new Vector3(...goal.target)) - 9) < 1e-9, 'a far camera comes in to the double-tap distance')
const near = doubleTapFraming({ point: new Vector3(0, 0, 0), position: new Vector3(0, 0, 4), target: new Vector3(0, 0, 1), box, maxDistance: 9 })
assert.ok(Math.abs(near.position[2] - 3) < 1e-9, 'a camera nearer than the double-tap distance keeps its distance')
const outside = doubleTapFraming({ point: new Vector3(5, 5, 5), position: new Vector3(0, 0, 20), target: new Vector3(0, 0, 0), box, maxDistance: 9 })
assert.deepEqual(outside.target, [1, 2, 1], 'a point outside the box is clamped first')

// Dragging right moves the content right, so the camera and target move left (−right axis); dragging down moves them up.
const off = panOffset({ dxPx: 10, dyPx: 0, right: new Vector3(1, 0, 0), up: new Vector3(0, 1, 0), worldPerPx: 0.1 })
assert.deepEqual(off.toArray(), [-1, 0, 0])
assert.deepEqual(panOffset({ dxPx: 0, dyPx: 10, right: new Vector3(1, 0, 0), up: new Vector3(0, 1, 0), worldPerPx: 0.1 }).toArray(), [0, 1, 0])
```

- [ ] **Step 2:** `pnpm tsx scripts/verify-scene-primitives.ts`. Expected: fails (imports missing).
- [ ] **Step 3:** Implement the exports above; the rig imports `MIN_SHARE` and its behaviour is otherwise unchanged.
- [ ] **Step 4:** Script plus the Global Constraints verification. Expected: pass.
- [ ] **Step 5: Commit** `feat(scene): camera math for panning inside a box and gliding to a double-tapped point` with its paths.

### Task 2: Gesture classifiers

**Files:**
- Create: `S/constants/scene-gestures.ts`, `S/lib/create-tap-tracker.ts`, `S/lib/classify-wheel-stream.ts`
- Modify: `S/types.ts` (`PointerSample`, `WheelSample`, `WheelDevice`)
- Test: `scripts/verify-scene-primitives.ts`

**Interfaces:**
- Produces:
  - `SCENE_GESTURES = { tapMs: 300, doubleMs: 300, doubleSlopPx: 35, pressTravelPx: { touch: SCENE_MOTION.tapSlopPx, mouse: 4 }, tapRingMs: 600, wheel: { streamGapMs: 400, decideMs: 40, mouseNotch: 4.000244140625, trackpadSmall: 4, trackpadCadence: 200, zoomPerDelta: <tuned in Task 4, start 0.002> } } as const`. Pen uses the touch number. Touch reuses `SCENE_MOTION.tapSlopPx` so the double-tap detector and R3F's part and roof taps (`house-roof.tsx`, `kit-part.tsx`) agree on what a tap is.
  - `interface PointerSample { pointerId: number, pointerType: string, x: number, y: number, time: number }` in `S/types.ts`
  - `createTapTracker(): { down(s: PointerSample): void, move(s: PointerSample): 'moved' | null, up(s: PointerSample): 'double' | null, cancel(pointerId: number): void }` — a press is a tap if it has one pointer, lasts ≤ `tapMs` and travels ≤ `pressTravelPx`; `move` returns `'moved'` once per press, when any pointer of the press passes `pressTravelPx` (so a tap is never a move and a move is never a tap); `up` returns `'double'` on the second qualifying tap (same pointer type, its `pointerdown` ≤ `doubleMs` after the first tap's `pointerup` and ≤ `doubleSlopPx` from it). A press that ever has two pointers down is never a tap.
  - `interface WheelSample { deltaX: number, deltaY: number, deltaMode: number, shiftKey: boolean, timeStamp: number }`, `type WheelDevice = 'trackpad' | 'mouse'` in `S/types.ts`
  - `classifyWheelStream(samples: readonly WheelSample[], lastConfident: WheelDevice | null): WheelDevice | null` — research §2 rules on the stream so far: trackpad if any sample has `deltaX ≠ 0` without Shift or `0 < |deltaY| < trackpadSmall`; mouse if `deltaMode ≠ 0` or `|deltaY|` is a whole multiple of `mouseNotch`; with two or more samples, cadence (`|Δt·deltaY| < trackpadCadence` → trackpad, else mouse); otherwise `null` (undecided). The caller resolves `null` after `decideMs` as `lastConfident ?? 'mouse'`.

- [ ] **Step 1: Write the failing checks** (helper `s(id, type, x, y, time)` builds a `PointerSample`; wheel helper `w({ deltaX, deltaY, deltaMode, shiftKey, timeStamp })` with defaults 0/false):
  - `single tap is not double`: down/up at (100,100) t=0/80 → `up` returns `null`.
  - `double tap`: taps at t=0–80 and t=250–320, second 20 px away → second `up` returns `'double'`.
  - `slow second tap`: second `pointerdown` at t=80+301 → `null`.
  - `far second tap`: second tap 40 px away → `null`.
  - `long press`: down t=0, up t=350 → no tap; a following quick tap is not `'double'`.
  - `two pointers never tap`: pointer 1 down, pointer 2 down, both up within 100 ms, twice → never `'double'`.
  - `touch moved`: move 7 px from a touch press → `'moved'`, once; a further move → `null`; that press's `up` is not a tap. Mouse: 5 px → `'moved'`; 3 px → `null` and still a tap.
  - `drifting touch tap`: a touch tap that travels 8 px is not a tap (matches R3F's 6 px roof tap), so two of them are never `'double'`.
  - `mixed types`: a mouse tap then a touch tap → `null`.
  - wheel: `[w({deltaY: 8.000488281})]` → `'mouse'`; `[w({deltaX: 1.5, deltaY: 6})]` → `'trackpad'`; `[w({deltaY: 2})]` → `'trackpad'`; `[w({deltaY: 100, timeStamp: 0})]` → `null`; the same plus `w({deltaY: 100, timeStamp: 60})` → `'mouse'`; `[w({deltaY: 9, timeStamp: 0}), w({deltaY: 9, timeStamp: 16})]` → `'trackpad'`; `w({deltaX: 3, shiftKey: true})` alone → not decided by the `deltaX` rule; `w({deltaMode: 1, deltaY: 3})` → `'mouse'`.
- [ ] **Step 2:** Run the script. Expected: fails.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Script plus the Global Constraints verification. Expected: pass.
- [ ] **Step 5: Commit** `feat(scene): tell taps, double-taps and moves apart, and a trackpad stream from a mouse wheel`.

### Task 3: The camera store, the glide goal, and a glide that can restart on the same target

**Files:**
- Create: `S/lib/create-scene-camera.ts`, `S/contexts/scene-camera-context.tsx`, `S/lib/camera-goal.ts`, `S/lib/create-wheel-router.ts`
- Modify: `S/hooks/use-eased.ts`, `S/types.ts` (`SceneCameraState`)
- Test: `scripts/verify-scene-primitives.ts`

**Interfaces:**
- Produces:
  - `interface SceneCameraState { moved: boolean, recenters: number, tapMark: { x: number, y: number, at: number } | null }` in `S/types.ts`
  - `createSceneCamera(): StoreApi<SceneCameraState>` built on the same zustand-vanilla shape as `createSceneInputs` (`S/lib/create-scene-inputs.ts`; reuse it if its signature fits), initial `{ moved: false, recenters: 0, tapMark: null }`
  - `recenterCamera(store: StoreApi<SceneCameraState>): void` — `moved: false`, `recenters + 1`
  - `SceneCameraProvider({ store, children })`, `useSceneCamera<U>(selector)`, `useSceneCameraApi(): StoreApi<SceneCameraState>` (throws without a provider, as `scene-inputs-context.tsx`, for the chip and the shortcut), and **`useOptionalSceneCameraApi(): StoreApi<SceneCameraState> | null`** (a plain `use(SceneCameraContext)`, for `CameraRig`, which must keep working without a provider when it is given no `pan`)
  - `useEased(target, apply, seed?, restartKey?: string | number)` — `restartKey` joins the target's key, so a new key starts a glide (seeded from the live value) even when the target value is unchanged. Existing callers are unchanged.
  - The glide goal as a pure reducer, so the races are tested here instead of first seen in Task 8:
    `cameraGoal(state: { framingKey: string, recenters: number, doubleTap: GoalFraming | null }, event: { kind: 'render', framingKey: string, recenters: number } | { kind: 'double-tap', goal: GoalFraming }): { state, resetMoved: boolean }` — a `render` whose `framingKey` (the framing's **value** string, `position|target|fov`, never object identity) or `recenters` differs clears `doubleTap` and returns `resetMoved: true`; an equal `render` changes nothing (every press re-renders the rig through `touches`, and StrictMode re-runs effects); `double-tap` sets `doubleTap`. The rig's target is `state.doubleTap ?? framing`.
  - `createWheelRouter(options: { now: () => number, schedule: (fn: () => void, ms: number) => () => void, onPan: (dx, dy) => void, onZoom: (deltaY) => void }): { wheel(sample: WheelSample & { ctrlKey: boolean, metaKey: boolean }): void, dispose(): void }` — ctrl/meta → zoom; Shift → pan (`dx = deltaX || deltaY`); else per stream (gap > `streamGapMs` starts one): hold samples while `classifyWheelStream` returns `null`, decide at `decideMs` as `lastConfident ?? 'mouse'`, then replay held samples; trackpad → pan by `(deltaX, deltaY)`, mouse → zoom. `dispose` cancels a pending decide.

- [ ] **Step 1: Write the failing checks** for `cameraGoal` and `createWheelRouter` (fake clock and scheduler):
  - `cameraGoal`: a double-tap then an equal render keeps the goal and returns `resetMoved: false`; a render with a new framing key clears it and returns `resetMoved: true`; double-tap at the home → up close → back to the home key returns the **framing**, not the old double-tap goal; a `recenters` bump clears the goal; two equal renders in a row (StrictMode) never reset.
  - `createWheelRouter`: a mouse notch held then decided at 40 ms zooms once with the held sample; a trackpad stream pans every sample; a stream after a 400 ms gap re-classifies; ctrl-wheel zooms without classifying; `dispose` before 40 ms fires nothing.
- [ ] **Step 2:** Run. Expected: fails.
- [ ] **Step 3:** Implement the store, the context (both readers), `useEased`'s parameter, `cameraGoal` and `createWheelRouter`.
- [ ] **Step 4:** Script plus the Global Constraints verification. Expected: pass.
- [ ] **Step 5: Commit** `feat(scene): a camera store for the rep's moves, a glide goal that survives re-renders, and a glide that can restart on the same framing`.

### Task 4: Pan and wheel in CameraRig

**Files:**
- Create: `S/hooks/use-scene-taps.ts`, `S/hooks/use-camera-wheel.ts`
- Modify: `S/ui/camera-rig.tsx`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - `CameraRigProps.pan?: { box: PanBox, doubleTapDistance: number | null }` — absent = today's rig exactly (no pan, `onStart` stops glides, no store read beyond `useOptionalSceneCameraApi()` returning null). Present with no provider → throw a clear error. `doubleTapDistance: null` = double-tap off; it is read in Task 5.
  - `useSceneTaps(options: { enabled: boolean, onMoved: () => void, onDouble?: (clientX: number, clientY: number) => void }): void` — the tracker lives in `useState(() => createTapTracker())`; `onMoved`, `onDouble` (and anything they read, like `doubleTapDistance`) are read through refs updated in a layout effect; the listener effect's deps are `[element, enabled]` only, where `element = useThree(s => s.events.connected)`, so a re-render (every press re-renders the rig) never rebuilds the tracker between two taps. `pointerup`/`pointercancel` are also listened on the document, so an up outside the canvas ends the press.
  - `useCameraWheel(options: { enabled: boolean, panBy: (dxPx: number, dyPx: number) => void, zoomBy: (deltaY: number) => void, onMoved: () => void }): void` — one capture-phase `wheel` listener `{ passive: false }` on the same container: `preventDefault` + `stopPropagation`, then `createWheelRouter` (callbacks through refs; `dispose` in cleanup). Safari pinch: `gesturestart/gesturechange/gestureend` are bound **only when `'GestureEvent' in window && navigator.maxTouchPoints === 0`** (macOS Safari; iPadOS reports a Mac user agent and fires both gesture events and touch pointers for one pinch, so binding there zooms twice): `preventDefault`, zoom by `e.scale`, ctrl-wheel ignored while a gesture runs. Wheel zoom = `exp(deltaY · SCENE_GESTURES.wheel.zoomPerDelta)`, tuned so a notch ≈ OrbitControls' default step. The first wheel event of a stream also calls `onMoved` (which wakes nothing; see Task 6 for waking).
- Rig behaviour when `pan` is present:
  - `enablePan`, `screenSpacePanning` on; `frameVisibleArea` takes the controls too and sets `controls.panSpeed = panSpeedFor(bottom)` from the bottom share it applies (1 with no area).
  - `onChange`: `clampOrbitToBox(controls.target, camera.position, box3)`; never `update()` inside. `box3` is a `useMemo` over the box's numbers.
  - `panBy` moves camera and target by `panOffset(... worldPerPixel(distance, camera.fov, visibleH))` along the camera's matrix columns 0 and 1, clamps, `controls.update()`. `zoomBy` uses `controls.dollyIn/dollyOut` (they call `update()`, whose `change` invalidates the demand loop and clamps).
  - "Moved" (tap tracker `'moved'` while a press is down, or a handled wheel or gesture): stop both glides and set `moved: true`. `onStart` no longer stops glides.
  - The goal: `cameraGoal` state in a ref, advanced by a `render` event in a layout effect each render with the framing's value key and the store's `recenters`; when it returns `resetMoved`, set `moved: false`. Glide target = `goal.doubleTap ?? framing`, `restartKey = recenters`.
  - On unmount (context loss swaps in the fallback; leaving the page) set `moved: false`, so the chip never stays over a scene with no camera.
- [ ] **Step 1:** Implement the two hooks and the rig changes.
- [ ] **Step 2:** Global Constraints verification and both scene verify scripts. Expected: pass; the lab page behaves exactly as before (no caller passes `pan` yet): open `/dashboard/labs/trade-scene` on port 3002 and orbit once; no console error.
- [ ] **Step 3: Commit** `feat(scene): the camera rig can pan inside a box, on two fingers, right-drag or a trackpad swipe, and zooms on a pinch or a mouse wheel`.

### Task 5: Double-tap to look

**Files:**
- Create: `S/ui/tap-ring.tsx`, `S/lib/is-double-tap-stop.ts`, `S/lib/ignore-raycast.ts`
- Modify: `S/ui/camera-rig.tsx`, `S/ui/rain-field.tsx`, `F/ui/components/heat-arrows.tsx`, `F/ui/components/home-kit/heat-shimmer.tsx`
- Test: `scripts/verify-scene-primitives.ts`

**Interfaces:**
- Consumes: `doubleTapFraming` (Task 1), `useSceneTaps.onDouble` (Task 4), `tapMark` and `cameraGoal` (Task 3).
- Produces:
  - `TapRing(): ReactNode` — DOM, outside the Canvas, so reduced motion comes from motion/react's `useReducedMotion` (not `useSceneMotion`, which exists only inside the Canvas); reads `tapMark`; draws a ring centred on it (canvas-relative px) for `SCENE_GESTURES.tapRingMs`, keyed by `at`; `pointer-events-none`; colours from the `on-media`/`scrim` tokens as `thermal-legend.tsx`; no animation under reduced motion. Hosted by the scene in Task 6.
  - `ignoreRaycast(): void` — a shared no-op raycast assigned to meshes that must never catch a double-tap (a why-comment there says so once).
  - `isDoubleTapStop(object: Object3D, materialIndex: number | undefined): 'stop' | 'through'` — `through` when the object or any ancestor is not `visible`, or its material (the face's material for an array, via `materialIndex`) is transparent with `opacity < 0.3` and not tagged `userData.doubleTapStop`; otherwise `stop`.
- Rig: when `pan.doubleTapDistance !== null` (read through the ref), `onDouble(clientX, clientY)` raycasts with R3F's raycaster from the full canvas rect; walks the hits in order and takes the **first** `stop` (a wall, a tree or the back wall stops the ray; it never passes through to the house behind); none → nothing. The hit point is **clamped** into the box (spec §6), so a far tree or the back wall glides to the nearest edge of the box. Then `cameraGoal` gets `double-tap` with `doubleTapFraming(...)`, and the store gets `moved: true` and `tapMark` (canvas-relative px, `at: performance.now()`).
- `rain-field.tsx`, `heat-arrows.tsx` (its quads are placed in the shader, so a CPU raycast would hit phantom geometry) and `heat-shimmer.tsx` (a transparent additive plane at opacity 1, invisible at low load): their meshes take `ignoreRaycast`.
- Window glass is tagged `userData.doubleTapStop` where `house-shell.tsx` builds it **only if** new glass (opacity 0.4) would otherwise pass through; with the 0.3 threshold it already stops, so no edit to `house-shell.tsx` is expected. Check, don't edit by default.

- [ ] **Step 1: Write the failing checks** for `isDoubleTapStop`: an opaque mesh → `stop`; a mesh under a hidden group → `through`; transparent at 0.2 → `through`; transparent at 0.4 (new glass) → `stop`; a material array picks the face's material.
- [ ] **Step 2:** Run. Expected: fails.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Script plus the Global Constraints verification. Expected: pass.
- [ ] **Step 5: Commit** `feat(scene): a double-tap glides to the spot under it, and rain, heat arrows and shimmer let it through`.

## GATE: the iPad session's rig and layout-script work committed (or none); Tasks 6–7 files clean (Global Constraints)

### Task 6: The home pans and takes a double-tap

**Files:**
- Create: `F/lib/home-pan-box.ts`, `F/lib/home-lift.ts`
- Modify: `F/constants/home-geometry.ts`, `F/ui/components/home-kit/home-camera-rig.tsx`, `F/ui/components/home-scene-canvas.tsx`, `F/ui/views/trade-scene-view.tsx`, `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - `HOME_PAN = { margin: 3, frontReach: YARD.walk.position[2] + YARD.walk.size[2] / 2 + 0.5, aboveRidge: 1, doubleTapDistance: 9 } as const`, declared **after `YARD`** in `home-geometry.ts` (before it is a TS2448 use-before-declaration).
  - `homeLift(foundationType: FoundationType | null): number` — `homeFloorY(foundationType) − HOUSE.floorY`; replaces the two existing copies in `home-scene-canvas.tsx` and `home-camera-rig.tsx`.
  - `homePanBox(lift: number): PanBox` — x `±(ROOF_HALF_LENGTH + margin)`, y `0 … RIDGE_Y + aboveRidge + max(lift, 0)`, z `−(HOUSE.halfDepth + margin) … frontReach`.
- `HomeCameraRig` passes `pan={{ box: homePanBox(lift), doubleTapDistance: zoomFraming === null ? HOME_PAN.doubleTapDistance : null }}` (double-tap stays on in the crawl framing, which is a whole-home framing). Its comment "a fold only shifts the view and keeps the user's orbit" is corrected: a fold that ends the crawl view changes the framing.
- `TradeSceneView` creates one camera store (`useState(() => createSceneCamera())`) and wraps `<SceneStage>` (which calls `useSceneShortcuts` itself, so the provider must sit **outside** it, not inside its render prop) in `SceneCameraProvider`, inside `SceneInputsProvider`.
- `HomeSceneCanvas` hosts `<TapRing />` in the shell's `overlay` beside the thermal legend, and wakes a still home once per wheel stream the same way a press does (the `touches` bump), via the rig's `onMoved` path or a store subscription, so a trackpad pan on a still home sees it live.

- [ ] **Step 1: Write the failing checks** in `verify-trade-scene.ts`, only for framings the app can reach (the `yard` and `under-floor` anchors sit below ground on a slab and no slab path uses them): for each lift of `slab` and `raised`, these targets lie inside `homePanBox(lift)`: `HOME_FRAMINGS.wide/tall`; the `roof` anchor framing of both forms lifted by `liftedFraming` (the only anchor with a kit, `ASSEMBLY_KITS`); every `framingTowardPart` of that roof framing over every `roofAtticPartFocus` part and insulation material at peel 0, 0.5 and 1, both forms; and at the `raised` lift only, the crawl framing (`HOME_ANCHORS.pitched['under-floor']` lifted). Also: the box floor is 0; the box contains the yard anchor's position; `homeLift('slab')` and `homeLift('raised')` match the two old inline copies.
- [ ] **Step 2:** Run. Expected: fails (no `homePanBox`).
- [ ] **Step 3:** Implement; widen `HOME_PAN` only if a check fails, and say which in the report. Never lower the floor below 0.
- [ ] **Step 4:** Verify scripts plus the Global Constraints verification. Expected: pass. On port 3002: two-finger (or right-) drag pans, double-click a window glides there.
- [ ] **Step 5: Commit** `feat(trade-scenes): the home pans inside a box around the house and yard, and a double-tap glides to a spot`.

### Task 7: Recenter chip and the R key

**Files:**
- Create: `F/ui/components/recenter-chip.tsx`
- Modify: `F/constants/home-scene-copy.ts`, `F/constants/scene-shortcuts.ts`, `F/constants/scene-layout.ts` (or wherever `SCENE_LAYOUT` lives), `F/hooks/use-scene-shortcuts.ts`, `F/ui/views/trade-scene-view.tsx`, `scripts/verify-trade-scene-layout.ts`

**Interfaces:**
- Consumes: `useSceneCamera`, `useSceneCameraApi`, `recenterCamera` (Task 3); `Keycap`, `SCENE_SHORTCUT_KEYS`, `keycapLabel`; `useSceneVisibleArea()`; shadcn `Button`.
- Produces: `RecenterChip(): ReactNode` — a shadcn `Button variant="outline"` with `min-h-11 rounded-full shadow-lg` (as `anchor-pin.tsx` and `back-to-home-button.tsx`), label `SCENE_COPY.recenter`, lucide `LocateFixedIcon`, `aria-keyshortcuts` from `SCENE_SHORTCUT_KEYS.recenter`, a `Keycap` offset off the pill's curve as `back-to-home-button.tsx` does (`-top-2 -right-2`; it shows once keys are in use, as every keycap does), visible focus ring. **Placed like `ThermalLegend`**: a `motion` element centred in the visible area (BuildSwitch's centring formula), `animate` on `useSceneVisibleArea()`'s area with `SCENE_MOTION.transition` (so it glides with a card fold, never jumps on the `--scene-visible-*` variables), its bottom `SCENE_LAYOUT.recenter.besideCard` (22) or `.overBottomCard` (14) px above the visible area's bottom. Shown only while `moved`; enters and leaves with opacity and an 8 px rise (opacity only under reduced motion, via motion/react's `useReducedMotion`); `inert` and `aria-hidden` while hidden. Mounted in `TradeSceneView` beside `BuildSwitch`, inside the camera provider.
- Copy: `SCENE_COPY.recenter = 'Recenter'`, `SHORTCUT_COPY.lines.recenter = 'Recenter the camera'`. `SCENE_SHORTCUTS` gains `'r': 'recenter'`; `SHORTCUT_SHEET_ROWS` gains `{ line: 'recenter', keys: ['r'] }` after `wholeHome`. `useSceneShortcuts` reads `useSceneCameraApi()` and handles `recenter` with `recenterCamera(cameraStore)`; like Escape's early return (`use-scene-shortcuts.ts`, `wholeHome` with `zoom === null`), a press while `moved` is false returns before `preventDefault` and `markInUse` (which the hook already calls for every action, so no second call).

- [ ] **Step 1: Write the failing checks** in `verify-trade-scene-layout.ts`: `SCENE_SHORTCUTS.r === 'recenter'`; `SHORTCUT_COPY.lines.recenter === 'Recenter the camera'`; `SCENE_COPY.recenter === 'Recenter'`; `SCENE_LAYOUT.recenter` is `{ besideCard: 22, overBottomCard: 14 }`. (The existing check at `verify-trade-scene-layout.ts` already asserts the sheet lists each key once.)
- [ ] **Step 2:** Run. Expected: fails.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Verify scripts, the Global Constraints verification, `pnpm theme:check`. Expected: pass.
- [ ] **Step 5: Commit** `feat(trade-scenes): a Recenter chip and the R key glide the camera back once the rep has moved it`.

### Task 8: Screenshots, checks and tuning

**Files:**
- Create (gitignored): `.superpowers/sdd/2026-10-28-scene-camera-slide/shots/` scripts and images (reuse the login and wait helpers of `.superpowers/sdd/2026-10-23-trade-scene-layout/shots/t11-lib.mjs`)
- Modify: only `HOME_PAN`, `SCENE_GESTURES` numbers or `SCENE_LAYOUT.recenter`, if a check below fails

- [ ] **Step 1:** Playwright on port 3002 (Global Constraints) at 1440×900, 1024×768, 820×1180 (`hasTouch`), 390×844 (`hasTouch`), in light and dark schemes. Every press starts the home's 120 s burst (residents, rain, arrows), so **"unchanged" checks run in a context with `reducedMotion: 'reduce'`** (the burst then never wakes) and compare canvas pixels after the demand loop settles, or read a DOM proxy (an anchor pin's box); **glide checks run without reduced motion** and sample the pin's box over time. The chip's state is read from the DOM (`inert`, bounding box). Log `pointerdown` timestamps from an init script so double-tap timing is evidence, not hope. Checks:
  - `pan`: right-drag 200 px → the house moved with the pointer; chip shown.
  - `two-finger pan`: through a CDP session, `Input.dispatchTouchEvent` with two touch points down, moved 150 px, up, twice in a row → the view pans, no double-tap glide, no ring.
  - `box edge`: right-drag 3000 px toward the card → stops; drag down 3000 px → the camera stays above ground.
  - `look`: double-click a window (new glass and worn glass both) → glide, ring, chip stays; `double-tap touch`: two quick taps on a touch context (via `page.touchscreen.tap`, or CDP if the logged gap exceeds 300 ms) → same; `back wall`: orbit to the back, double-click the block wall → glides toward the wall's side of the box, never to the house behind it.
  - `double-tap roof`: double-click the roof on the whole home → up close on the roof's framing, no double-tap glide afterwards, and `emphasizedPart` is still `null`; repeat once the kit is cached (second visit).
  - `recenter` and `R twice`: chip click → back on the framing, chip hidden; press `r` twice quickly → no snap; `r` while focused in a card control (the peel slider up close, `peel-control.tsx`) → nothing; `r` before any move → nothing and no keycaps appear.
  - `up close drops pan`: pan, then tap Inside the roof → the roof's framing, chip hidden; `Esc back out`: double-tap a window, go up close, press Escape → the home's framing, not the window.
  - `fold keeps pan`: pan, fold the card with `/` → camera target unchanged; the chip glides with the card, never over it mid-fold.
  - `crawl fold drops pan` (raised floor, Partly open, crawl row open): pan, fold the card → glides back up to the home's framing, chip hidden (owner, 2026-10-29).
  - `turn drops pan`: pan at 1024×768, resize to 768×1024 → the tall framing, chip hidden.
  - `wheel over card`: wheel over the card and the dock → camera unchanged.
  - `touch context binds no gesture listeners`: in a `hasTouch` context, an init-script spy on `addEventListener` records no `gesturestart`.
  - `chip clear`: the chip's box does not overlap the card, the dock, the knob or the thermal legend (Thermal on).
- [ ] **Step 2:** Fix what fails at the narrowest level, one batch; rerun once.
- [ ] **Step 3:** `node /home/olis-solutions/.claude/skills/impeccable/scripts/detect.mjs --json src/features/trade-scenes/ui/components/recenter-chip.tsx src/shared/components/scene/ui/tap-ring.tsx`; resolve findings.
- [ ] **Step 4:** Verify scripts plus the Global Constraints verification. Commit any tuning by path: `fix(trade-scenes): …` naming what moved.
- [ ] **Step 5:** Update the tracker's Camera row and R103 status (built, unmerged, commit range) and add a change-log line; leave it uncommitted. Report for the owner's iPad check: two-finger pan with the card open (landscape, portrait), double-tap a window, pinch (zooms once, not twice), Recenter; and a laptop with a mouse and with a trackpad.
