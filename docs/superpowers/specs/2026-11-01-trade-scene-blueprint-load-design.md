# Trade scene loads as a blueprint that becomes the home

Status: approved by the owner 2026-11-01 ("looks good"); plan `docs/superpowers/plans/2026-11-01-trade-scene-blueprint-load.md` stress-tested the same day, with the owner's rulings D10–D12 and the findings folded in below. Builds after lot-and-light (TS3b.6-A) finishes on this branch (D9). Studies page: https://claude.ai/artifact/Q1JPzqGxcBuXsmGnAd1kE3 (version 2, Study A). Research: `docs/plans/2026-11-01-trade-scene-blueprint-load-research.md`.

## 1. Goal

The homeowner is watching when the rep opens the trade scene on the iPad. Today they see the wrong page's skeleton, an empty dark stage, controls popping in, then the house popping in. The owner wants "an architectural style still that transforms to the loaded screen when it's ready … almost like a blueprint, that ideally morphs into the live scene."

So the scene opens on a blueprint of this home, drawn from the scene's own geometry, and the blueprint turns into the live home once the scene is ready. Nothing on screen ever belongs to another page.

## 2. Decisions already made

| # | Decision | Source |
|---|---|---|
| D1 | No captured stills of the scene as the loading screen. The loading screen is an architectural blueprint. | Owner, 2026-11-01 |
| D2 | Study A, "ink fills in": colour and light soak in under the lines, the blueprint paper fades, the lines go last; about 1 s. | Owner pick on the studies page |
| D3 | The drawing always finishes (about 1.4 s) before the handover, even when the scene is ready sooner. | Owner |
| D4 | Blueprint look as on the studies page, version 2: single hairlines, outlines a touch heavier than inner edges, the roof as one plane (no shingle tabs), the site drawn as a plan (walkway, sidewalk, curb, street; no horizon, no far ground), a double-rule drafting-sheet border, a fine and a coarse grid on blueprint navy. | Owner: "Yes, write the spec" |
| D5 | The homeowner watches the load, so the load itself must look finished. | Owner (usage scene) |
| D6 | No title block, sheet number, dimensions, north arrow or company details in the drawing: nothing the scene's constants do not hold. | Company-facts rule |
| D7 | The wrong-skeleton bug is fixed by giving the route its own loading screen (this blueprint paper), not by a separate patch. | Root-cause rule |
| D8 | Reduced motion: no drawing in; the drawing appears whole, and the handover is a 220 ms fade. | Studies page, owner did not object |
| D9 | This build runs after lot-and-light (TS3b.6-A) finishes on `feat/trade-scenes-foundation`, because that work's Task 7 changes the opening framing and its Task 8 sets the frame-time budget. The Lightformer 64 → 128 change is a task in this build's plan, flagged to that work. | Owner, 2026-11-01 |
| D10 | This build runs before TS3b.4b (up close on a system). Both rewrite the canvas's pins and the shortcut handler; TS3b.4b's plan keeps this build's `live` gate on its system pins and shortcuts, and renames the load check's `zoom` line to `systemView`. | Owner, stress test 2026-11-01 |
| D11 | The loading line shows from the first paint at its final place: CSS knows the stage's shape and the paper reads the card's remembered fold, so it stands at the visible area's centre before the measure. Revised from "centred on the full stage, then slide": on desktop the slide landed inside the 3D code's first long task and read as a 147 px jump. A direct load with a folded card still moves it once (the server cannot see the fold). | Owner, stress test 2026-11-01; revised 2026-11-02 |
| D12 | Words: the navy sheet is the **blueprint paper** (phase `paper`, `BlueprintPaper`, `--blueprint-paper`); "ink" means only the lines' colour; the live scene's colour arriving is the **colour-in** (`SceneColourIn`). In `CONTEXT.md`. | Owner, stress test 2026-11-01 |

## 3. Content

| Beat | What shows | Copy source |
|---|---|---|
| Page arrives (server-rendered) | Blueprint paper over the whole stage: navy, two grids, the sheet border; the loading line at the visible area's centre from the first paint (D11) | `SCENE_COPY.loading` ("Loading the home…") in `constants/home-scene-copy.ts` |
| Engine starts | The house and site linework draws in, left to right, over 1.4 s | none |
| Waiting | Drawing complete, the loading line's small progress tick keeps running | `SCENE_COPY.loading` |
| Handover | Live canvas fades in from desaturated and bright to full colour (1 s); blueprint paper fades (0.7 s); lines fade last (0.7 s after a 0.45 s delay); the loading line fades; pins appear with the live scene | none |
| Live | Today's scene, unchanged | — |

The card, dock, build switch, keys button and recenter chip keep their current arrival (they appear once the stage is measured) and sit over the blueprint like they sit over the scene. Holding them until the colour-in was tried 2026-11-02 and reverted: with the card gone the line read off centre on an empty sheet.

## 4. Architecture

### 4.1 Where the blueprint paper comes from

- One component, `BlueprintPaper` (feature-local, `ui/components/blueprint/`), draws the navy, both grids and the sheet border as CSS over the full stage, and the loading line placed in the visible area (`--scene-visible-left/right`, already set by `SceneStage`; D11).
- The route gets its own loading screen: `src/app/(frontend)/dashboard/labs/trade-scene/loading.tsx` renders `TradeScenePendingView`, a stage-shaped wrapper around `BlueprintPaper`, named like the pending-views map's other entries. A sidebar click shows it at once instead of holding the previous page.
- The dashboard layout's session fallback learns the route: `DASHBOARD_ROUTE_PENDING_VIEWS[ROOTS.dashboard.tradeSceneLab()] = TradeScenePendingView`, so a direct load paints the blueprint paper, not `DashboardGenericContentSkeleton`.
- Inside the real view, `HomeSceneCanvas`'s `dynamic()` loading fallback becomes `null` (no text-only fallback): the paper is already mounted under the canvas, and stays until the handover ends. Every step hands over to the same pixels.

### 4.2 The blueprint lines

- A component inside the `<Canvas>`, `BlueprintPass` (feature tier, `ui/components/blueprint/`), runs once the scene graph has mounted, the stage is measured and the camera holds its opening framing (the rig opens framed, never gliding, `use-eased.ts`).
- It draws the linework in one screen-space pass, not from `EdgesGeometry` or drei `<Edges>` (research Q1):
  - The scene renders once with a normal-material override into a render target that has a depth texture.
  - One small shader pass draws the inner edges from jumps in normal and depth, as hairlines.
  - The heavier outline comes from the depth coverage's edge widened by 1–1.5 CSS px.
  - Instanced meshes need no extra code, and lines where two meshes meet are drawn, which `EdgesGeometry` misses.
- The result goes into `BlueprintLines`, a DOM 2D canvas stacked over the WebGL canvas. The copy is `drawImage(gl.domElement)` in the same `requestAnimationFrame` callback, right after the blueprint render, because WebKit clears the drawing buffer after a composite. No `readRenderTargetPixels`, which would copy about 22 MB through JS at the iPad's pixel ratio (research Q2).
- The draw-in is a wipe made of two counter-moving `transform` animations (an outer clip box sliding in, its content sliding the other way), not a CSS mask animation. WebKit runs transform and opacity on the compositor, but not mask or clip-path, and shader linking can block the main thread during exactly these 1.4 s (research Q4; WebKit bug 251514).
- The blueprint layers (`BlueprintPaper`, `BlueprintLines`, the loading line) live in `TradeSceneView`, outside `HomeSceneCanvas`. Any child that suspends without its own boundary drops the whole `next/dynamic` subtree to its loading fallback, and the layers must survive that (research Q5).
- Objects left out of the drawing carry a tag, a frozen `userData` object on a group like `HOME_GHOST_TAG`, never on a mesh. Untagged means drawn.
  - **Drawn** (Claude's call, after the builder check): the subject home only. That is the house, its garage, the lot's hardscape (walkway, driveway, sidewalk, curb, the street's edge), and its walls and fences.
  - **Left out by tag:** the lot's graded ground strip, plants and trees, and the neighbour houses (one group in `lot.tsx`), and every roof covering's courses (one group in `RoofCovering`: shingle tabs, tile pans and caps, shakes), so every roof reads as one plane (D4).
  - **Left out by rule:** anything whose material writes no depth (the sky dome, the condenser's heat shimmer, the meter glass). The normal-material override would give these see-through effects solid depth and outline them as boxes, so the pass hides them whatever their tag. The override is double-sided, as instanced pieces are.
  - **Never on screen during the load:** rain and heat arrows (the store opens on normal weather with thermal off, and the stage takes no input), so they carry no tag.
- If the stage resizes, the iPad rotates or the dashboard sidebar folds before the handover, the pass redraws for the new framing, without a second draw-in. A sidebar fold keeps the canvas size and only tweens the camera's view offset, so that redraw waits for the tween to settle.

### 4.3 Knowing the scene is ready

A second in-Canvas component, `SceneReadySignal`, runs the ready rule from research Q3, in order:
1. The scene graph has mounted and its effects have run. R3F mounts the scene only after the canvas's first size measure.
2. The environment is final: the scene's environment is the sky image (drei sets it as an equirect texture; the Lightformer stand-in is a cube), or the weather has no image, or a 2 s cap passed and the Lightformer light stays.
3. `await gl.compileAsync(scene, camera)`. Then texture uploads run through `gl.initTexture`, because `compileAsync` neither uploads textures nor compiles the shadow-caster programs.
4. One true frame is drawn while the canvas is still at opacity 0.
5. On the next frame, the phase moves to `handover` (after D3's drawing has finished).

Supporting rules:
- **Hold R3F's own render while loading.** A `useFrame(…, 1)` gate keeps it from drawing, so R3F does not compile every real material synchronously on its first frame. With `frameloop="demand"`, each async step ends with an explicit `invalidate()`.
- **Overall cap: 6 s.** After that it hands over whatever is drawn. An error in any step jumps to the true frame too.
- **Watchdog: 10 s** from `HomeSceneCanvas`'s mount, outside the Canvas. If the phase is not `live` by then (a pass that never gets a frame, a draw-in or fade that never ends), it moves to `live`, so the inert stage can never freeze in front of the homeowner.
- **Compile once.** Today the house's shaders compile twice: the Lightformer stand-in's environment is 64 px, and the sky image replaces it with a map of a different size. three's program cache key includes the env map's height (`WebGLPrograms.js:56`), so every lit material recompiles. Raising the Lightformer resolution to 128 makes the two sizes match, so the swap costs nothing.
- **Preload the sky image** as soon as the view mounts, so it is in flight while the 3D code downloads.

Unconfirmed on the iPad (research "Unverified"): the edge pass, `drawImage` and fade timings; whether WebKit presents a canvas drawn at opacity 0 (drawing the first true frame there and invalidating at the fade's start covers both cases); whether WebKit bug 251514 is fixed in current iOS; the cap values. The build measures these on the device.

### 4.4 The load phase

- A small store per open scene (the `createSceneCamera` / `createSceneInputs` pattern, `shared/components/scene/lib/`): `phase: 'paper' | 'drawing' | 'waiting' | 'handover' | 'live'`, created in `TradeSceneView` beside the camera store and provided through a feature context (`contexts/scene-load-context.tsx`).
- `BlueprintPass` moves `paper → drawing`. The draw-in's end moves `drawing → waiting`. `SceneReadySignal` and the draw-in together move to `handover`. The handover's end moves to `live`.
- The stage carries `data-load-phase` for CSS and for the Playwright checks.
- The phase never goes backwards. A context loss or an error (`SceneShell` swaps in the fallback) ends the sequence where it is and shows today's fallback, through `SceneShell`'s opt-in `onFallback` (§4.7). It cannot be signalled from inside the fallback: R3F always mounts `<Canvas fallback>` as hidden children of the `<canvas>` element, so anything there would end every load at once.
- At `live` the colour-in layer is always fully shown with no filter, whatever phase the load ended from, so a fallback is never left behind an invisible layer.

### 4.5 The handover (Study A)

- Implemented on DOM layers with CSS, as on the studies page. Research Q4 confirms opacity and filter on a canvas run as accelerated animations in WebKit.
  - The colour-in: the canvas wrapper (`SceneColourIn`) animates `opacity` 0→1 with `filter: saturate(0) brightness(1.25) contrast(0.85)` → none over 1 s on `BRAND_EASE` (the `--ease-brand` variable is scoped to the marketing and funnel themes). The filter is set to `none` when the fade ends, so the live scene never stays behind a filter.
  - The paper fades over 0.7 s.
  - The lines fade over 0.7 s after a 0.45 s delay.
  - With motion, animate `filter` and `transform` directly, never the `x`/`scale` shorthands, so WebKit keeps them on the compositor.
- Until `live`, nothing on the stage takes input (Claude's call, after the builder check): not the canvas, the card, the dock, the build switch, the keys button, the recenter chip, nor the stage's keyboard shortcuts (`useSceneShortcuts`). The stage carries `aria-busy="true"`, and the announced "Loading the home…" status sits outside it (an inert subtree leaves the accessibility tree; the visible line is `aria-hidden`). So no input can change the house, the weather or the camera under the static line image, and the ready rule never restarts. The controls look as they do today; they just wait about 2.5 s.
- The pins (`ScenePins`, `PartPins`) stay hidden until `live`, and the burst of life (`SCENE_BURST`) restarts its two minutes at `live` (the phase joins `burstKey`). `useSceneBurst` itself runs from mount; its frames during the load are thrown away by the gate, and their cost is measured on the device.
- Reduced motion (motion's `useReducedMotion`, the source `SceneShell` already reads): no draw-in, a 220 ms fade.

### 4.6 Tokens

Two new presentation tokens beside `--presentation-ground` in `globals.css`: `--blueprint-paper` (the navy, `oklch(0.29 0.075 254)` on the studies page) and `--blueprint-ink` (`rgb(214 240 255)`), with the grid and border alphas derived in the component. The stage is scoped dark, so one value serves both schemes. As every new token, they get a contrast pair in `scripts/check-theme-contrast.ts` (ink on paper) and an entry in `DESIGN.md` (theme-conventions §11). The loading line keeps the 12 px type floor.

### 4.7 Tiers

Everything is feature-local to `src/features/trade-scenes` except the route `loading.tsx`, the pending-views entry, the tokens (with their guard and `DESIGN.md` entry) and one opt-in `SceneShell` prop. `SceneShell` (shared, also used by the look-dev scene) gains `onFallback?: () => void`, called from its context-loss listener and its error boundary's `onError`; callers that leave it out see no change.

## 5. Data access

None. The trade scene reads and writes no server data; every input is the per-page client store. No DAL, tRPC, schema or seed change.

## 6. Error handling and edge cases

- **No WebGL / context lost:** today's `HomeSceneFallback` takes over through `onFallback`; the blueprint paper hides when it does.
- **Anything else stalls:** the 10 s watchdog moves to `live` (§4.3).
- **Sky image slow or failing:** after 2 s the ready rule stops waiting for it and goes on with the Lightformer light (the 6 s overall cap backs it). When the sky image arrives later it lights the scene as today, and with the Lightformer at 128 the swap no longer recompiles shaders.
- **Fast cached load:** the drawing still finishes first (D3), so the shortest load is about 1.4 s plus the 1 s handover.
- **Leaving and returning in the same session:** the scene mounts again and the sequence replays.
- **Rotation or sidebar slide during the blueprint:** the pass redraws for the new framing (§4.2); the draw-in does not restart.
- **Rep taps or presses keys during the blueprint:** ignored until `live` (§4.5).

## 7. Verification

- `pnpm tsc`, `pnpm lint`; the trade-scene verify scripts keep passing (pure tier untouched or extended).
- Playwright on the worktree's dev server at 1366×1024, 820×1180 and 1440×900:
  - direct load: the server HTML holds the blueprint paper (`[data-blueprint-paper]`) inside the layout's pending wrapper, and not the generic skeleton (`DashboardGenericContentSkeleton`'s `page-insets` block). The wrapper (`dashboard-content-skeleton.tsx`) stays as it is, since it applies the same `DASHBOARD_MAIN_CLASS` the real page sits in;
  - sidebar click from the dashboard: the time until the blueprint paper paints, prefetched and cold, against a 100 ms budget (the sidebar entry exists in dev only, and dev does not prefetch `loading.tsx` the way prod does; the direct load is the homeowner's path);
  - `data-load-phase` runs `paper → drawing → waiting → handover → live` in order, never backwards, with `drawing` always before `live` on a normal load;
  - the sidebar folded mid-draw: the lines still sit on the house;
  - a stalled frame loop: the watchdog reaches `live`;
  - the line image overlays the live frame within 1 px at the handover (screenshot diff along the house outline);
  - reduced motion emulated: no draw-in, a 220 ms handover;
  - the sky image request blocked: the cap hands over on the Lightformer light;
  - context loss forced: the fallback shows and the paper hides.
- The owner checks it on the iPad, landscape and portrait, with the homeowner's eye.

## 8. Files

The plan holds the full list; in short (`F/` = `src/features/trade-scenes/`):

Create:
- `src/app/(frontend)/dashboard/labs/trade-scene/loading.tsx`, `F/ui/views/trade-scene-pending-view.tsx`
- `F/ui/components/blueprint/`: `blueprint-paper.tsx`, `blueprint-lines.tsx`, `blueprint-pass.tsx`, `scene-ready-signal.tsx`, `blueprint-fade.tsx`, `scene-colour-in.tsx`
- `F/ui/lib/`: `blueprint-edge-pass.ts`, `copy-blueprint-lines.ts`, `upload-scene-textures.ts`
- `F/contexts/scene-load-context.tsx`
- `F/lib/create-scene-load.ts` (store) and `F/lib/blueprint-tag.ts`
- `F/constants/scene-load.ts` (timings, caps, watchdog, edge values, the omit tag), `F/constants/scene-stage.ts`, `F/constants/blueprint-edge-shader.ts`
- `scripts/verify-trade-scene-load.ts`

Modify:
- `F/ui/views/trade-scene-view.tsx` (store, paper, layers, status, preload)
- `F/ui/components/home-scene-canvas.tsx` (pass, ready signal, watchdog, pins until live, `burstKey`, `onFallback`)
- `F/ui/components/scene-stage.tsx` and `F/hooks/use-scene-shortcuts.ts` (`data-load-phase`, inert until `live`, `aria-busy`)
- `F/ui/components/home-kit/lot.tsx` (one tagged group round the ground strip, plants and neighbours)
- `F/ui/components/home-kit/roof-covering.tsx` (one tagged group round the courses)
- `F/ui/components/home-kit/lightformer-environment.tsx` (resolution 64 → 128; lot-and-light owns this look, so the change is flagged to it) and `F/constants/weather-skies.ts` (`LIGHTFORMER_RESOLUTION`)
- `F/types.ts`
- `src/shared/components/scene/ui/scene-shell.tsx` (opt-in `onFallback`)
- `src/features/agent-dashboard/constants/route-pending-views.ts`
- `src/app/(frontend)/globals.css` (two tokens), `DESIGN.md`, `scripts/check-theme-contrast.ts`

Delete: none.

## 9. Out of scope and follow-ups

- The stills in `public/scenes/stills/` are out of date and still feed the no-3D fallback and the dock's weather thumbnails. Not part of loading (D1); a follow-up decides whether they are recaptured or the thumbnails change.
- Making the card and dock appear before the stage is measured.
- Using the blueprint in the look-dev scene, the realism spike or the roof-cutaway lab.
- Dimension lines, a north arrow or a scale bar from real scene numbers (offered; not asked for).
- A failed download of the 3D code was already unhandled (no error boundary round the `dynamic()` import, no `error.tsx` in `src/app`); with it the paper stays up and the rep leaves by the sidebar. A follow-up gives the route an error state.
- `HomeSceneFallback`'s still mounts inside every live `<canvas>` (R3F's fallback children), so it may download on every load beside the sky image. Checked on the device; a follow-up if it costs.

## Research

Folded into §4.2, §4.3 and §4.5 from `docs/plans/2026-11-01-trade-scene-blueprint-load-research.md`. That note was checked against the installed three 0.180.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9 and motion 12.43.0. Its env-map claim was re-verified for this spec at `node_modules/three/src/renderers/webgl/WebGLPrograms.js:56` and `lightformer-environment.tsx:17`.
