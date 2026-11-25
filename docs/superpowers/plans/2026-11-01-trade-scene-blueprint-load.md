# Trade scene blueprint load — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The trade scene opens on a blueprint of this home, drawn from the scene's own geometry, which turns into the live home once the scene is ready; no other page's skeleton ever shows.

**Architecture:** The route gets its own pending view (the CSS blueprint paper) that the dashboard layout's session fallback also uses. Inside the live view a per-page load store runs `paper → drawing → waiting → handover → live`. Two in-Canvas components do the WebGL work: `BlueprintPass` renders a normal/depth edge pass and copies it into a DOM canvas, and `SceneReadySignal` holds R3F's render until the environment, shaders and textures are ready and one true frame is drawn. The draw-in and the handover are DOM layers animated with `transform`, `opacity` and `filter` only. A watchdog ends the load whatever fails.

**Tech Stack:** Next.js 15 App Router, React 19, three 0.180, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, motion 12.43, zustand vanilla stores, Tailwind v4. Checks are `tsx` assertion scripts (no test runner) plus Playwright scripts against the dev server.

**Spec:** `docs/superpowers/specs/2026-11-01-trade-scene-blueprint-load-design.md` (approved 2026-11-01, amended after the stress test the same day: D10–D12). Research it cites: `docs/plans/2026-11-01-trade-scene-blueprint-load-research.md` (read Evidence 1–5 before Task 3). The approved look: studies page https://claude.ai/artifact/Q1JPzqGxcBuXsmGnAd1kE3, version 2, Study A.

Abbreviations: `F/` = `src/features/trade-scenes/`. `S/` = `src/shared/components/scene/`. `SDD/` = `.superpowers/sdd/2026-11-01-trade-scene-blueprint-load/` (git-ignored). "Load check" = `pnpm tsx scripts/verify-trade-scene-load.ts`. "Scene checks" = `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsx scripts/verify-trade-scene-layout.ts` and `pnpm tsx scripts/verify-trade-scene-lot.ts`. "Types and lint" = the locked `pnpm tsc` and per-file `eslint` below.

Words (owner, 2026-11-01, in `CONTEXT.md`): the navy sheet is the **blueprint paper**; "ink" means only the lines' colour; the live scene's colour arriving is the **colour-in**; the five steps are the **load phase**.

## Global Constraints

- Build only after TS3b.6-A lot-and-light has fully landed on `feat/trade-scenes-foundation` (its Task 8 included: `F/realism-spike/` is gone), and only after the owner says "build". "Go ahead" is not "build" (D9). This plan builds **before** TS3b.4b up close on a system (D10).
- Never `pnpm build`. Checks run under the shared lock: `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock pnpm tsc` and `flock … env CI=1 pnpm eslint <every file created or modified>` (this replaces `pnpm lint`). After any `eslint --fix`, run `pnpm tsc` again. Run `pnpm theme:check` in Task 2.
- Never start a dev server. Shots and probes use the server on `http://localhost:3002`.
- Sign in with `/api/dev/playwright-session?…&as=info%40triprosremodeling.com`, never `role=`. Read the secret through `.superpowers/sdd/2026-10-24-upgrades-that-follow-the-home/shots/t7-lib.mjs`, never print it. No DB writes of any kind.
- The worktree is shared. Follow `.superpowers/sdd/2026-10-24-upgrades-that-follow-the-home/standing-rules.md`: commit by explicit path (`git add <paths>`, `git commit -F - -- <paths>`), never `git add -A`, bare `git stash`, reset or checkout; never stage `CONTEXT.md` or `docs/**`; `git diff <file>` before editing and before staging any shared file; `git diff --shortstat` after any scripted edit; `git commit` gets a 300000 ms timeout. Before editing a file, check `.superpowers/claims/` for another session's claim on it.
- Outside `F/`, only these change: `src/app/(frontend)/dashboard/labs/trade-scene/loading.tsx` (new), `src/features/agent-dashboard/constants/route-pending-views.ts`, `src/app/(frontend)/globals.css` (two tokens), `DESIGN.md` and `scripts/check-theme-contrast.ts` (the tokens' entry and guard), `scripts/verify-trade-scene-load.ts` (new), and `S/ui/scene-shell.tsx` (one opt-in prop, `onFallback`, Task 4; spec §4.7). Nothing else in `S/` changes, and `SceneShell`'s other callers keep working untouched.
- **No three.js** in `F/lib/`, `F/constants/` or `F/types.ts`, type-only imports included (`scripts/verify-trade-scene.ts` enforces it). Three code goes in `F/ui/lib/` or a component. GLSL source is a string, so it may live in `F/constants/` (as `heat-arrow-shader.ts` does).
- One component per file, named exports, constants in `F/constants/`, pure helpers in `F/lib/`.
- Timings and values (spec §2–§4, studies v2), copied exactly:
  - draw-in 1400 ms; colour-in 1000 ms, keyframes at 0 / 0.55 / 1 of `opacity 0 / 1 / 1` and `filter saturate(0) brightness(1.25) contrast(0.85)` / `saturate(0.35) brightness(1.1) contrast(0.95)` / `saturate(1) brightness(1) contrast(1)`, then `filter: none`; paper fade 700 ms; lines fade 700 ms after a 450 ms delay; reduced motion: no draw-in, every handover fade 220 ms with no delay;
  - environment cap 2000 ms and overall cap 6000 ms, both from the Canvas's mount; watchdog 10000 ms from `HomeSceneCanvas`'s mount;
  - constants are in ms; motion takes seconds, so divide by 1000 at the call;
  - ease `BRAND_EASE` from `src/shared/constants/motion.ts` (the `--ease-brand` CSS variable is scoped to `.theme-marketing, .funnel-light`, so motion takes the constant);
  - `--blueprint-paper: oklch(0.29 0.075 254)`, `--blueprint-ink: rgb(214 240 255)`;
  - no text under 12 px (`DESIGN.md` type floor).
- Animate only `transform`, `opacity` and `filter`, as those keys (never motion's `x`/`scale` shorthands, never `mask` or `clip-path`): WebKit keeps only these on the compositor while shader linking blocks the main thread. **This overrides the standing rules' motion line** (which lists `clip-path` and omits `filter`) for this plan only. motion's `layout` slide (Task 2) runs as a transform.
- No title block, sheet number, dimensions, north arrow or company details in the drawing (D6). The only copy is `SCENE_COPY.loading`.
- Comments say why, never what. No banners, no citing the spec or plan from code.

## Review Focus

1. **The stage changes shape during the drawing**: the iPad rotates, the PWA viewport height changes, or the rep folds the dashboard sidebar (which sits outside the inert stage). The line image is redrawn for the new framing, the draw-in does not restart, and the lines still sit on the house. Task 3 step 6 resizes the page and folds the sidebar mid-draw, then runs the alignment probe.
2. **The 3D code downloads slowly** (weak in-home Wi-Fi). The paper and the loading line stay up with nothing blank and no text fallback, and the caps count from the engine's start, not the page's. Task 3 step 6 throttles the network and shoots at 1 s and 4 s.
3. **The rep taps the scene or presses a shortcut during the load.** Nothing changes (weather, view, camera, card), the sequence does not restart, and everything works at `live`. Task 4 step 3.
4. **The sky image fails or is slow.** The handover goes ahead on the Lightformer light at the 2 s cap, never on the no-3D stills, and the image arriving later recompiles nothing. Task 6 steps 1 and 4.
5. **Any step fails** (a shader that will not link, a 2D context that is not given, a frame that never comes, a lost context). The sequence still reaches `live` (empty lines, or the fallback, or the watchdog at 10 s), the stage never stays inert, and the live scene never keeps the normal-map override. Task 3 step 6 and Task 4 step 3.

---

## Before Task 1

- [ ] Confirm the preconditions: `F/realism-spike/` does not exist, `git log --oneline -15` shows lot-and-light's Task 8 commit, TS3b.4b's commits are not on the branch (`git log --oneline -- F/ui/components/home-kit/system-pins-layer.tsx` is empty), and the owner has said "build". If not, stop.
- [ ] Re-read the files this plan modifies; lot-and-light changed several (`lot.tsx`, `home-kit.tsx`, `weather-skies.ts`, `lightformer-environment.tsx`). Check two things it may have moved:
  - the camera still opens framed (no glide) once the stage is measured (`use-stage-size.ts`'s layout effect runs before the canvas mounts), since its Task 7 reframes the opening view;
  - the garage still draws its roof as plain slopes (`garage.tsx`, `MergedBoxes boxes.slopes`), not through `RoofCovering`. If it now uses `RoofCovering`, Task 5's group covers it.
- [ ] Create `SDD/` and `SDD/lib.mjs` from `.superpowers/sdd/2026-10-30-realism-spike/shots.mjs`'s sign-in (`secret`, `scrub`, the `playwright-session` URL with `as=`). Add two helpers every probe uses:
  - `recordPhases(page)`: an init script with a `MutationObserver` on `document` (`subtree`, `childList`, `attributes`, `attributeFilter: ['data-load-phase']`). It pushes `{ phase, t: performance.now() }` to `window.__loadPhases` whenever a `[data-stage]` element is inserted or its `data-load-phase` changes, and drops a phase equal to the last one pushed. The pending view's stage node is replaced by the real one, so an observer on the first node alone would miss the rest.
  - `waitPhase(page, phase, timeout)`.
- [ ] Shoot the baseline: a direct load and a sidebar click into `/dashboard/labs/trade-scene` at 1366×1024, 820×1180 and 1440×900, a frame every 100 ms for 4 s. Save under `SDD/baseline/`.

---

### Task 1: The load phase, the omit tag and the constants

**Files:**
- Create: `F/constants/scene-load.ts`, `F/lib/create-scene-load.ts`, `F/lib/blueprint-tag.ts`, `scripts/verify-trade-scene-load.ts`
- Modify: `F/types.ts` (append `SceneLoadPhase`, `SceneLoadState`), `F/constants/weather-skies.ts` (append `LIGHTFORMER_RESOLUTION` beside `SKY_IMAGE`)

**Interfaces:**
- Produces:
  - `F/types.ts`: `type SceneLoadPhase = typeof SCENE_LOAD_PHASES[number]`; `interface SceneLoadState { phase: SceneLoadPhase, ready: boolean }`.
  - `F/constants/scene-load.ts`:
    - `SCENE_LOAD_PHASES = ['paper', 'drawing', 'waiting', 'handover', 'live'] as const`.
    - `SCENE_LOAD = { drawMs: 1400, colourInMs: 1000, colourInTimes: [0, 0.55, 1], paperFadeMs: 700, linesFadeMs: 700, linesDelayMs: 450, reducedFadeMs: 220, envCapMs: 2000, overallCapMs: 6000, watchdogMs: 10000 } as const`.
    - `BLUEPRINT_EDGES = { edgeAngleDeg: 30, depthJump: 0.015, innerAlpha: 0.62, outlineCssPx: 0.75 } as const`. Starting values, tuned by eye in Task 3 against the studies v2 frames (inner edges one device pixel at 62 % ink, the outline about 1.5 CSS px wide).
    - `BLUEPRINT_OMIT_TAG: Readonly<{ blueprintOmit: true }>` (frozen), like `HOME_GHOST_TAG` in `home-fades.ts`. A group's tag (never a mesh's); untagged means drawn.
    - `BLUEPRINT_LINE_CLASS`: the loading line's placement as one class literal (Task 2 fills it in), so its portrait condition can be checked against `SCENE_LAYOUT.portraitBelowWidth`.
  - `F/constants/weather-skies.ts`: `LIGHTFORMER_RESOLUTION = 128`, beside `SKY_IMAGE`, with a why-comment: it must equal the sky image's PMREM cube size, or every lit material compiles a second program when the image replaces the Lightformer light.
  - `F/lib/create-scene-load.ts`:
    - `createSceneLoad(): StoreApi<SceneLoadState>`, seeded `{ phase: 'paper', ready: false }`, built with `createSceneInputs` like `S/lib/create-scene-camera.ts`.
    - `advanceSceneLoad(store, to: SceneLoadPhase): void`: writes only when `to` lies after the current phase in `SCENE_LOAD_PHASES`.
    - `finishDrawIn(store): void`: advances to `waiting`, then to `handover` if `ready`.
    - `markSceneReady(store): void`: sets `ready`, and advances to `handover` if the phase is `waiting`.
  - `F/lib/blueprint-tag.ts`: `isBlueprintOmitted(userData: Record<string, unknown>): boolean`.

- [ ] **Step 1: Write the failing load check** in `scripts/verify-trade-scene-load.ts`, in the style of `verify-trade-scene-lot.ts` (`node:assert/strict`, a message on every assertion, `console.log('ok')` at the end):

```ts
const store = createSceneLoad()
advanceSceneLoad(store, 'drawing')
advanceSceneLoad(store, 'paper')
assert.equal(store.getState().phase, 'drawing', 'the phase never goes backwards')

markSceneReady(store)
assert.equal(store.getState().phase, 'drawing', 'a scene ready mid-draw still waits for the drawing to finish')
finishDrawIn(store)
assert.equal(store.getState().phase, 'handover', 'the drawing ending on a ready scene hands over')

const slow = createSceneLoad()
advanceSceneLoad(slow, 'drawing')
finishDrawIn(slow)
assert.equal(slow.getState().phase, 'waiting', 'the drawing ending before the scene is ready waits')
markSceneReady(slow)
assert.equal(slow.getState().phase, 'handover', 'the scene turning ready while waiting hands over')

const lost = createSceneLoad()
advanceSceneLoad(lost, 'live')
assert.equal(lost.getState().phase, 'live', 'a fallback or the watchdog can end the sequence from the paper')

assert.ok(isBlueprintOmitted({ ...thermalTag('exterior'), ...BLUEPRINT_OMIT_TAG }), 'a merged tag is omitted')
assert.equal({ ...thermalTag('exterior'), ...BLUEPRINT_OMIT_TAG }.thermalZone, 'exterior', 'merging keeps the thermal zone')
assert.ok(!isBlueprintOmitted(thermalTag('exterior')), 'untagged means drawn')
assert.ok(Object.isFrozen(BLUEPRINT_OMIT_TAG), 'the tag is shared, so it is frozen')
```

  Also assert:
  - **Compile once:** read the header of `public/scenes/sky/` + the file `SKY_IMAGE` names, parse `-Y <h> +X <w>`, and assert `2 ** Math.floor(Math.log2(w / 4)) === LIGHTFORMER_RESOLUTION` ("the Lightformer cube matches the sky image's PMREM size").
  - **Nothing unexpected mounts during the load:** `HOME_SCENE_DEFAULTS.weather !== 'rain'`, `HOME_SCENE_DEFAULTS.thermalCamera === false`, `HOME_SCENE_DEFAULTS.zoom === null`. The store is seeded from these on every mount and the stage takes no input until `live` (Task 4), so rain, heat arrows and kits can never be in the drawing, and they carry no tag. (TS3b.4b renames `zoom` to `systemView`; its plan updates this line.)
  - **The watchdog comes last:** `SCENE_LOAD.watchdogMs > SCENE_LOAD.overallCapMs + SCENE_LOAD.drawMs + SCENE_LOAD.linesDelayMs + SCENE_LOAD.linesFadeMs`.
  - **One portrait rule:** `BLUEPRINT_LINE_CLASS.includes(\`${SCENE_LAYOUT.portraitBelowWidth}px\`)` ("the loading line's portrait condition is `stageShapeOf`'s"). Task 1 seeds `BLUEPRINT_LINE_CLASS` with just that condition; Task 2 completes it.

- [ ] **Step 2: Run the load check.** Expected: FAIL, the modules do not exist.
- [ ] **Step 3: Implement the files and the two types** as the Interfaces block gives them.
- [ ] **Step 4: Run the load check, the scene checks, types and lint.** Expected: `ok` from each script (the scene check's three.js-in-lib check included), tsc and eslint exit 0.
- [ ] **Step 5: Commit** by path: `feat(trade-scenes): a load phase that only moves forward, and a tag for what the blueprint leaves out`.

---

### Task 2: The blueprint paper as the route's pending view

Fixes the wrong skeleton on its own (D7): after this task a direct load and a sidebar click both paint the blueprint paper.

**Files:**
- Create: `F/ui/components/blueprint/blueprint-paper.tsx`, `F/ui/views/trade-scene-pending-view.tsx`, `F/constants/scene-stage.ts`, `src/app/(frontend)/dashboard/labs/trade-scene/loading.tsx`
- Modify: `src/app/(frontend)/globals.css`, `DESIGN.md`, `scripts/check-theme-contrast.ts`, `src/features/agent-dashboard/constants/route-pending-views.ts`, `F/constants/scene-load.ts` (`BLUEPRINT_LINE_CLASS`), `F/ui/components/scene-stage.tsx` (its `className` becomes `SCENE_STAGE_CLASS`, nothing else)

**Interfaces:**
- Consumes: `SCENE_COPY.loading`, `BLUEPRINT_LINE_CLASS`.
- Produces:
  - `F/constants/scene-stage.ts`: `SCENE_STAGE_CLASS = 'group/stage dark relative h-full overflow-hidden bg-(--presentation-ground) text-foreground'`, today's stage class, so the pending view and the stage share one string. The "scoped dark / data-stage" why-comment at `scene-stage.tsx` moves here with it.
  - `BlueprintPaper({ area }: { area?: { left: number, right: number } }): JSX.Element`, root carries `data-blueprint-paper`. Client component (motion's `layout`). `TradeSceneView` passes `layout.area` from `SceneStage`'s render prop; the pending view passes nothing. (Not `useSceneVisibleArea()`: it throws outside its provider, and the pending view has none.)
  - `TradeScenePendingView(): JSX.Element`: `<div data-stage data-load-phase="paper" aria-busy="true" className={SCENE_STAGE_CLASS}><BlueprintPaper /><p role="status" className="sr-only">{SCENE_COPY.loading}</p></div>`. `data-stage` is what the dashboard's edge-to-edge and mobile-nav CSS keys on, so the chrome matches the real page. Named like the map's other entries (`DashboardHomePendingView`, `PipelineRoutePendingView`).
  - `loading.tsx`: `export default function TradeSceneLoading()` rendering `<TradeScenePendingView />`, as `dashboard/schedule/loading.tsx` does (no `DataViewPending`: the view fetches nothing).

- [ ] **Step 1: Add the tokens** in their own `:root` block right after the presentation palette in `globals.css`, with an `Owner:` line as at the palette blocks there, and a why-comment: the stage is scoped dark, so one value serves both schemes; the ink is `rgb()` because the lines canvas reads it raw into a 2D `fillStyle`. `--blueprint-paper: oklch(0.29 0.075 254); --blueprint-ink: rgb(214 240 255);`. Then, per `docs/design-system/theme-conventions.md` §11 steps 4–5: a pair in `scripts/check-theme-contrast.ts` (ink on paper, text minimum, one scheme-independent case like the `--on-media` block) and both tokens with their roles in `DESIGN.md` beside the presentation palette. `pnpm theme:check` passes.
- [ ] **Step 2: Build `BlueprintPaper`** to the studies v2 values. The root is `absolute inset-0 pointer-events-none bg-(--blueprint-paper)` with `container-type: size`, so `cqw` is the stage's width and the line can ask the stage's shape before it is measured:
  - **Grids** (inline `backgroundImage`): a coarse grid at `8cqw` and a fine grid at `1.6cqw`, each one 1 px line per axis, `color-mix(in oklab, var(--blueprint-ink) 11%, transparent)` coarse and `4.5%` fine, `background-position: -1px -1px`.
  - **Sheet border:** two absolutely placed boxes, `inset: 1.6cqw` with a 1 px border at ink 32 %, and `inset: 2.1cqw` at ink 14 %.
  - **Loading line** (`aria-hidden`; the announced status sits outside the stage, Task 4): `SCENE_COPY.loading` in `font-mono uppercase tracking-[0.18em] text-(--blueprint-ink)`, over a 1 px rule `14cqw` wide at ink 25 % with a tick `w-1/3` in full ink running the existing `animate-toolbar-shimmer` keyframe (transform-only, 1.6 s, as `LoadingHairline` uses), `motion-reduce:animate-none`.
    - **Shows from the first paint (owner, D11).** Its box spans `left: var(--scene-visible-left, 0px)` to `right: var(--scene-visible-right, 0px)`, so before the measure it is centred on the full stage. When the visible area arrives it slides to its centre: the box is a `motion.div` with `layout="position"` and `layoutDependency` set from `area?.left`/`area?.right` (none in the pending view: the line stays centred), 400 ms on `BRAND_EASE`; reduced motion: no slide.
    - **Its height and size never jump:** `BLUEPRINT_LINE_CLASS` places it by the stage's shape through a size container query that mirrors `stageShapeOf`: portrait when `(orientation: portrait) or (width < 600px)` (`SCENE_LAYOUT.portraitBelowWidth`): `top: 49%`, `text-[max(12px,1.9cqw)]`; otherwise `top: 74%`, `text-[max(12px,1.05cqw)]`. CSS knows the shape on the first paint, so only the horizontal centre ever moves.
- [ ] **Step 3: Add the route's pending view and the map entry:** `[ROOTS.dashboard.tradeSceneLab()]: dynamic(() => import('@/features/trade-scenes/ui/views/trade-scene-pending-view').then(m => m.TradeScenePendingView))`.
- [ ] **Step 4: Probe** (`SDD/t2-paper.mjs`), at 1366×1024, 820×1180 and 1440×900:
  - **Direct load:** fetch the route's raw HTML in a signed-in context (`page.request.get`, no rendering). It holds `data-blueprint-paper` inside `data-slot="dashboard-content-skeleton"`, and no `page-insets` generic skeleton block. (The homeowner's path: the sidebar entry exists in dev only, `get-sidebar-nav.ts`.)
  - **Sidebar click** from `/dashboard`: in a rAF loop started on the click, record the time until `[data-blueprint-paper]` is in the document, once after the route's prefetch has settled and once cold. Report both against a 100 ms budget; dev does not prefetch `loading.tsx` the way prod does, so a cold miss is recorded, not failed.
  - **The line:** in the first frame with the paper it is visible, at its final height, centred on the full stage; after the measure it sits centred in the visible area. Shoot both and compare with `SDD/baseline/`. The live view still shows today's text fallback behind it at this point; Task 3 replaces it.
- [ ] **Step 5: Run the load check, `pnpm theme:check`, types and lint.** Expected: `ok`, and exit 0.
- [ ] **Step 6: Commit** by path: `fix(trade-scenes): the trade scene loads on its own blueprint paper, not another page's skeleton`.

---

### Task 3: The scene loads through the blueprint

The core sequence: the line pass, the draw-in, the ready rule, the Study A handover and the watchdog.

**Files:**
- Create:
  - `F/contexts/scene-load-context.tsx`
  - `F/constants/blueprint-edge-shader.ts`
  - `F/ui/lib/blueprint-edge-pass.ts`, `F/ui/lib/upload-scene-textures.ts`, `F/ui/lib/copy-blueprint-lines.ts`
  - `F/ui/components/blueprint/blueprint-pass.tsx`, `scene-ready-signal.tsx`, `blueprint-lines.tsx`, `blueprint-fade.tsx`, `scene-colour-in.tsx`
- Modify: `F/ui/views/trade-scene-view.tsx`, `F/ui/components/home-scene-canvas.tsx`, `F/ui/components/scene-stage.tsx`

**Interfaces:**
- Consumes: Task 1's store functions and constants, `isBlueprintOmitted`, Task 2's `BlueprintPaper`.
- Produces:
  - `scene-load-context.tsx`, modelled on `S/contexts/scene-camera-context.tsx`: `SceneLoadProvider({ store, lines, children })`, where `lines: RefObject<HTMLCanvasElement | null>`; `useSceneLoadApi(): StoreApi<SceneLoadState>` (throws outside the provider); `useSceneLoad<U>(selector): U`; `useSceneLoadLines(): RefObject<HTMLCanvasElement | null>`. The context carries the store and the ref, never state. R3F 9 bridges it into the Canvas (as `HomeCameraRig` already reads outside contexts).
  - `blueprint-edge-shader.ts`: the edge pass's vertex and fragment GLSL as strings.
  - `blueprint-edge-pass.ts`:
    - `createBlueprintEdgePass(): BlueprintEdgePass`, holding a `WebGLRenderTarget` with a `DepthTexture`, one `MeshNormalMaterial({ side: DoubleSide })` override (instanced pieces are double-sided), a full-screen quad with the edge `ShaderMaterial` and its orthographic camera, plus `dispose()`.
    - `drawBlueprint(gl: WebGLRenderer, scene: Scene, camera: Camera, pass: BlueprintEdgePass): void`: size the target to `gl.getDrawingBufferSize`; hide (`visible = false`, restored after) every object whose `userData` passes `isBlueprintOmitted`, **and every object whose material (or any material of an array) has `depthWrite === false`**: the override would otherwise give additive and see-through effects solid depth (the condenser's `HeatShimmer` plane, the meter glass, the sky dome). Render with `scene.overrideMaterial` set; then `setRenderTarget(null)`, clear to alpha 0 and draw the quad into the canvas. Save the clear colour, clear alpha, override material, render target and every changed `visible`, and restore them in a `finally`, so a throw never leaves the live scene in normal-map colours.
    - The shader writes premultiplied white × alpha:
      - **Inner edges:** one-sided, comparing the centre with its right and lower neighbours (the studies filter). Normal jump: `dot(n, n') < cos(edgeAngleDeg)`. Depth jump: relative linear depth difference above `depthJump`, linearised from `cameraNear`/`cameraFar`. Alpha `innerAlpha`.
      - **Outline:** coverage (depth < 1) differs between the centre and any of 8 samples at radius `max(1, round(outlineCssPx × dpr))` device px. Alpha 1.
  - `copyBlueprintLines(target: HTMLCanvasElement, source: HTMLCanvasElement): boolean`: sizes `target` to `source.width/height`, `drawImage(source, 0, 0)`, then fills with `--blueprint-ink` read from `getComputedStyle(target)` under `globalCompositeOperation = 'source-in'`. Returns `false` when no 2D context is given.
  - `uploadSceneTextures(gl: WebGLRenderer, scene: Scene): void`: every `Texture` on every object's material goes through `gl.initTexture` once: the material's texture properties and, for a `ShaderMaterial`, every uniform whose `value` is a `Texture`.
  - `BlueprintPass()` (in Canvas):
    - A `useFrame(…, 1)` that, while a capture is due, runs `drawBlueprint` then `copyBlueprintLines` in that same callback, then `advanceSceneLoad(store, 'drawing')`.
    - A capture is due on mount, on every change of `size` or `viewport.dpr` (`useThree`), and on every change of the scene visible area (`useSceneVisibleArea().area`), each followed by `invalidate()`. An area change waits `SCENE_MOTION.transition`'s duration first: folding the sidebar keeps the canvas size and only tweens the camera's view offset on that clock (`S/ui/camera-rig.tsx`), so the capture must come after the tween settles.
    - A throw or a `false` copy is logged once with `console.warn` and still advances to `drawing`, so the sequence goes on with empty lines.
    - Disposes the pass on unmount.
  - `SceneReadySignal()` (in Canvas): the ready rule, spec §4.3.
    - A `useFrame(…, 1)` gate draws `gl.render(scene, camera)` only once `showReal` is set, and sets a `drewReal` ref right after its own render (not `gl.info.render.frame`, which any render moves, a recapture or a PMREM build included).
    - One async run from mount:
      1. Wait until the environment is final: `!WEATHER_SKIES[weather].environment.image`, or `scene.environment?.mapping === EquirectangularReflectionMapping` (drei sets the sky image as an equirect texture in a layout effect; the Lightformer stand-in is a cube texture), or `envCapMs` passed. `weather` is the inputs store's, read once. Checked from the gate's `useFrame`, with an `invalidate()` per wait tick.
      2. `await gl.compileAsync(scene, camera)`, raced against what is left of `overallCapMs`.
      3. `uploadSceneTextures`.
      4. Set `showReal`, `invalidate()`, and wait for `drewReal`.
      5. One more `requestAnimationFrame`, then `markSceneReady(store)`.
      6. `invalidate()` after each step.
    - A timer at `overallCapMs` jumps to step 4. Any throw in steps 1–3 is logged once and jumps to step 4.
    - The run stops on unmount: StrictMode mounts it twice.
    - When the phase reaches `handover`, it calls `invalidate()` once, so a fresh frame is presented while the canvas is visible.
  - `BlueprintLines()`:
    - An `overflow-hidden` box holding the `<canvas ref={lines}>` at `absolute inset-0 size-full`, `pointer-events-none`, `aria-hidden`.
    - On `drawing`, motion's `animate` runs `transform: translateX(-100%) → translateX(0%)` on the box and `translateX(100%) → translateX(0%)` on the canvas, over `drawMs / 1000` s on `BRAND_EASE`, and calls `finishDrawIn(store)` when both end. Both animations stop on unmount.
    - Reduced motion: no transforms, `finishDrawIn` at once.
    - Sets the canvas `width = 0` on unmount, to release its surface.
  - `BlueprintFade({ durationMs, delayMs?, onFaded?, children })`: a declarative `motion.div` (`absolute inset-0`), as `scene-card.tsx` and `recenter-chip.tsx` animate, that at `handover` animates `opacity` 1 → 0 (reduced motion via `useReducedMotion`: `reducedFadeMs`, no delay), then calls `onFaded`.
  - `SceneColourIn({ children })`: a declarative `motion.div` (`absolute inset-0`) at `opacity: 0` until `handover`. It then runs the Global Constraints' keyframes over `colourInMs` (reduced motion: opacity only, `reducedFadeMs`), and sets `filter: none` when they end. **At `live` it is always `opacity: 1, filter: none`, whatever phase it came from**, so a load that ends early (a lost context, an error, the watchdog) shows the fallback or the scene, never an invisible layer.
  - The watchdog, in `HomeSceneCanvas`'s DOM body (outside the `<Canvas>`): an effect from its mount sets a `watchdogMs` timer that, if the phase is not yet `live`, warns once and calls `advanceSceneLoad(load, 'live')`; cleared at `live` and on unmount. It catches what no cap reaches: a pass that never gets a frame, a draw-in that never ends, a fade that never finishes.

- [ ] **Step 1: Wire the store and the layers in `TradeSceneView`:**
  - `const [load] = useState(createSceneLoad)` and a `useRef<HTMLCanvasElement>(null)` for the lines. `SceneLoadProvider` sits outside `SceneStage`.
  - Under `SceneStage`, in this order:
    1. While not `live`: `<BlueprintFade durationMs={paperFadeMs}><BlueprintPaper area={stage.width > 0 ? area : undefined} /></BlueprintFade>`, with `area` from the render prop's layout.
    2. The existing canvas wrapper, now holding `<SceneColourIn><HomeSceneCanvas /></SceneColourIn>`, then, while not `live`, `<BlueprintFade durationMs={linesFadeMs} delayMs={linesDelayMs} onFaded={() => advanceSceneLoad(load, 'live')}><BlueprintLines /></BlueprintFade>`. The lines share the canvas's box, so they overlay it pixel for pixel, but sit outside `SceneColourIn`, so the canvas's filter never reaches them.
  - The lines' fade ends last (1150 ms), so it is the one that moves to `live`.
  - `dynamic()`'s `loading` becomes `() => null`: the paper under the canvas is already the loading state (spec §4.1), and the text fallback goes.
  - The layers live here, outside `HomeSceneCanvas`, so a child that suspends without its own boundary cannot take them down (research Q5).
- [ ] **Step 2: Mount the in-Canvas pair** last inside `SceneShell` in `HomeSceneCanvas`, `BlueprintPass` before `SceneReadySignal`: equal-priority frames run in mount order, so the copy happens before the real frame can overwrite the buffer. `BlueprintPass` mounts while the phase is `paper`, `drawing` or `waiting`; `SceneReadySignal` while it is not `live`. At `live` both unmount and R3F renders on its own again. Add the watchdog effect.
- [ ] **Step 3: `SceneStage`** carries `data-load-phase={phase}`.
- [ ] **Step 4: Tune the lines by eye.** Shoot the `waiting` phase at 1366×1024 and 820×1180 next to the studies v2 frames (the artifact's Study A). Adjust `BLUEPRINT_EDGES` until the inner edges are hairlines and the outline reads a touch heavier. Check the condenser draws no rectangle (the shimmer is skipped). Everything else is still drawn here: the shingle tabs and the plants scribble until Task 5.
- [ ] **Step 5: Run the load check, the scene checks, types and lint.** Expected: each `ok`, and exit 0.
- [ ] **Step 6: Probe** (`SDD/t3-sequence.mjs`) at the three sizes:
  - **Phase order:** `window.__loadPhases` runs `paper, drawing, waiting|–, handover, live` in that order, each once (`waiting` may be skipped on a fast load only if `finishDrawIn` found the scene ready). `drawing → handover` takes at least 1400 ms, and `handover → live` about 1150 ms.
  - **Alignment:** at `waiting`, grab the lines canvas (`toDataURL`), and at `live`, a screenshot. In `SDD/align.py`: for the outline pixels (alpha > 0.9), at least 90 % have a live-frame Sobel maximum within 1 CSS px.
  - **Resize mid-draw (Review Focus 1):** at `drawing` + 500 ms, `setViewportSize` from 1366×1024 to 1024×1366. The phase never returns to `drawing`, the lines canvas takes the new size, and the alignment check passes at `waiting`.
  - **Sidebar fold mid-draw (Review Focus 1):** at `drawing` + 500 ms, fold the dashboard sidebar (its trigger, outside the stage). The lines are recaptured after the tween, and the alignment check passes at `waiting`.
  - **Slow download (Review Focus 2):** with CDP throttling (1.5 Mbps, 300 ms RTT), shots at 1 s and 4 s show the paper and the loading line; never a blank stage or text.
  - **Pass failure (Review Focus 5):** an init script makes `getContext('2d')` return `null` for the lines canvas. The sequence still reaches `live`, with one console warning.
  - **Watchdog (Review Focus 5):** an init script replaces `requestAnimationFrame` with a no-op once the phase is `drawing`. The phase still reaches `live` by 10 s from the canvas's mount, with one warning, and the stage takes input.
  - Save frames every 100 ms of one direct load for the owner.
- [ ] **Step 7: Commit** by path: `feat(trade-scenes): the home loads as a blueprint drawn from its own geometry and colours in once the scene is ready`.

---

### Task 4: Nothing moves until the scene is live

**Files:**
- Modify: `F/ui/components/scene-stage.tsx`, `F/hooks/use-scene-shortcuts.ts`, `F/ui/components/home-scene-canvas.tsx`, `F/ui/views/trade-scene-view.tsx`, `S/ui/scene-shell.tsx`

**Interfaces:**
- Consumes: `useSceneLoad`, `useSceneLoadApi`, `advanceSceneLoad`.
- Produces: `SceneShellProps.onFallback?: () => void`. `SceneShell` calls it from its `webglcontextlost` listener (beside `setLost(true)`) and from the `ErrorBoundary`'s `onError`, so it fires only when the fallback really replaces the canvas. (R3F always mounts `<Canvas fallback>` as hidden children of the `<canvas>` element, so nothing rendered inside the fallback can tell the two apart.) Callers that leave it out see no change.

- [ ] **Step 1: Inert until live:**
  - `SceneStage`: `inert` and `aria-busy="true"` while the phase is not `live` (both left off at `live`). That covers the canvas, card, dock, build switch, keys button and recenter chip. The dashboard sidebar is outside the stage and stays live.
  - `TradeSceneView`: while not `live`, a `<p role="status" className="sr-only">{SCENE_COPY.loading}</p>` outside `SceneStage`, since `inert` takes the stage's subtree out of the accessibility tree.
  - `useSceneShortcuts`: takes `const loadStore = useSceneLoadApi()`, and the handler returns first thing while `loadStore.getState().phase !== 'live'`. The listener is on `window`, which `inert` does not reach.
- [ ] **Step 2: Pins, burst and fallback in `HomeSceneCanvas`:**
  - Render `ScenePins` and `PartPins` only at `live`.
  - `burstKey` becomes `` `${inputKey}|${touches}|${live}` ``. `useSceneBurst` runs from mount whatever the key (`useState(!reducedMotion)`), and its frames during the load are dropped by the gate; the key change restarts the two minutes at `live`, so the burst the homeowner sees is whole. The load-time cost (priority-0 subscribers running per invalidated frame while shaders link) is measured in Task 7 and goes on the iPad list.
  - Pass `onFallback={() => advanceSceneLoad(load, 'live')}` to `SceneShell`. Either a lost context or the error boundary ends the sequence, and the paper and lines unmount.
- [ ] **Step 3: Probe** (`SDD/t4-inert.mjs`):
  - **A normal load still draws (regression for the fallback trap):** `__loadPhases` holds `drawing` and `handover` before `live`.
  - **Input during the load (Review Focus 3):** at `waiting`, press each key in `SCENE_SHORTCUTS`, click the dock's weather buttons, the build switch and the canvas, and drag on the canvas. At `live`, screenshot and compare with an undisturbed load: same weather, view, card state and camera. `__loadPhases` shows no repeat.
  - **Everything works at `live`:** a shortcut and a dock tap then change the scene.
  - **Pins:** none in the DOM before `live`, all after.
  - **The status:** the accessibility snapshot holds "Loading the home…" before `live`, and not after.
  - **Context loss:** an init script calls `WEBGL_lose_context.loseContext()` on the scene's canvas at `drawing`. The fallback shows (visible, not behind an opacity-0 layer), `[data-blueprint-paper]` is gone, `data-load-phase="live"`, and the fallback takes input.
  - **The look-dev scene** (`SceneShell`'s other caller) still loads and draws.
- [ ] **Step 4: Run types and lint.** Expected: exit 0.
- [ ] **Step 5: Commit** by path: `feat(trade-scenes): the stage takes no input and the home stays still until it has coloured in`. `scene-shell.tsx` is shared: `git diff` it before staging.

---

### Task 5: What the drawing leaves out

**Files:**
- Modify: `F/ui/components/home-kit/lot.tsx`, `F/ui/components/home-kit/roof-covering.tsx`

**Interfaces:**
- Consumes: `BLUEPRINT_OMIT_TAG`.

The sky dome needs no tag: its material does not write depth, so Task 3's pass already skips it.

- [ ] **Step 1: Tag the left-out groups:**
  - **Lawn, plants, neighbours:** in `lot.tsx`, `LotGround`, `LotPlants` and `Neighbours` go in one `<group userData={BLUEPRINT_OMIT_TAG}>`. The lawn strip is the 280 m graded mesh (`lot-ground.tsx`, `HALF_WIDTH = 140`) that the studies capture hid as "the far ground". The paving, walls and fences stay drawn. The thermal lookup (`thermal-paint-set.ts`) reads `thermalZone` up the ancestors, so the extra group leaves the `exterior` zone in place.
  - **Roof covering:** `RoofCovering` returns its courses inside one `<group userData={BLUEPRINT_OMIT_TAG}>`. That covers shingle, tile and shake on every slope of the home. With the covering gone, the underlayment's slab is the roof plane (D4). The garage draws plain slopes today and needs nothing; when 6-B gives it real courses through `RoofCovering`, this group covers them.
- [ ] **Step 2: Shots** at `waiting`, 1366×1024 and 820×1180, under each covering (shingle, tile, wood shake) and both roof forms: every roof reads as one plane, with no tab or pan courses, no trees and no neighbours. The site reads as a plan: walkway, driveway, sidewalk, curb and the street's edge, with no horizon. If a shake roof on spaced boards shows rafters through the gaps, report it with the shot; do not tag the deck unasked.
- [ ] **Step 3: Run the alignment probe again,** types and lint. Expected: pass, and exit 0.
- [ ] **Step 4: Commit** by path: `feat(trade-scenes): the blueprint draws the home and its site, not the lawn, plants, neighbours or roof courses`.

---

### Task 6: Compile once, and the sky image in flight early

**Files:**
- Modify: `F/ui/components/home-kit/lightformer-environment.tsx`, `F/ui/views/trade-scene-view.tsx`

**Interfaces:**
- Consumes: `LIGHTFORMER_RESOLUTION`, `SKY_IMAGE`.

- [ ] **Step 1: Write the failing probe** (`SDD/t6-programs.mjs`). An init script captures the renderer (the `window.__THREE_DEVTOOLS__` `EventTarget` trick). A route delays the sky image by 3 s. At `live`, record `renderer.properties.get(material).currentProgram` for every material in the scene; 2 s after the image lands, record them again. Expected now: FAIL, the lit materials' programs change. (Do not count `renderer.info.programs`: PMREM builds one equirect program the first time it meets the image, so the total rises by one even when the fix works.)
- [ ] **Step 2: Raise the Lightformer resolution:** `resolution={LIGHTFORMER_RESOLUTION}` in `lightformer-environment.tsx`. This file's look belongs to lot-and-light, so the commit message says so, and the tracker note goes to the controller.
- [ ] **Step 3: Preload the sky image** from `TradeSceneView`'s render with react-dom's `preload(SKY_IMAGE, { as: 'fetch', crossOrigin: 'anonymous' })`. three's `FileLoader` fetches it in `cors` mode with same-origin credentials, which this matches. Not drei's `useEnvironment.preload`: that would pull three.js into the view's bundle ahead of the dynamic import.
- [ ] **Step 4: Run the probe again.** Expected:
  - no scene material's program changes when the late image lands;
  - the network log shows the sky image requested once, and before the 3D chunk (Safari's reuse of the preload goes on the iPad list);
  - with the image blocked outright (Review Focus 4), the handover starts at about 2 s after the Canvas mounts, on the Lightformer light, and the no-3D stills never show.
- [ ] **Step 5: Run the load check** (the resolution assertion), types and lint. Expected: `ok`, and exit 0.
- [ ] **Step 6: Commit** by path: `perf(trade-scenes): the stand-in light matches the sky image's size so shaders compile once, and the image starts loading with the page (touches lot-and-light's Lightformer)`.

---

### Task 7: The whole load, checked

**Files:**
- Modify: none in `src/`; probes in `SDD/`.

- [ ] **Step 1: Run the spec §7 sweep** at 1366×1024, 820×1180 and 1440×900, re-using the Task 2–6 probes and adding two:
  - **Reduced motion** (`emulateMedia({ reducedMotion: 'reduce' })`): no draw-in (the lines are whole at the first `drawing` frame), no line slide, a static tick, and `handover → live` takes about 220 ms.
  - **Leave and return:** go to `/dashboard`, then back by the sidebar. The sequence replays from the paper.
- [ ] **Step 2: Budget at `live`:** `SDD/perf.mjs`, copied from lot-and-light's, on the default home. Draw calls and triangles equal lot-and-light's final figures, since the pass and the gate are unmounted. Recount texture memory against lot-and-light's 8 MB budget with the Lightformer cube at 128 (its target and PMREM grow), and report the delta for the tracker. Record the time from navigation to `live`, cached and uncached, and the main-thread time spent in frame callbacks during the load (the burst, M6), for the owner.
- [ ] **Step 3: Run the load check, the scene checks, types and lint** one last time. Expected: each `ok`, and exit 0.
- [ ] **Step 4: Hand over to the owner** for the iPad check (spec §7), landscape and portrait, with the homeowner's eye. Leave a short list of what only the device can settle (research "Unverified"):
  - the pass and the `drawImage` cost at 5.6 MP;
  - whether the fades hold while shaders link, and what the burst's frames cost meanwhile;
  - whether resident and furniture models resolving after the compile make the colour-in stutter;
  - whether Safari reuses the sky preload;
  - whether the caps and the watchdog need moving.
- [ ] **Step 5: Note for TS3b.4b** (to the controller, for that plan): its system pins (`system-pins-layer`) render only at `live`, its `escapePatch` keeps the shortcut handler's `live` guard first, and `verify-trade-scene-load.ts`'s `zoom === null` line becomes `systemView === null`.
