# Trade scene blueprint loading sequence: research findings (2026-11-01)

Stack checked against this worktree's installed packages: three **0.180.0**, @react-three/fiber **9.8.2**, @react-three/drei **10.7.9**, motion **12.43.0** (motion-dom 12.43.0).
WebKit facts were read from WebKit `main` at commit `4e04b9730506` (2026-11-01) and from WebKit Bugzilla.

Short path names used below:
- **WR** = `node_modules/three/src/renderers/WebGLRenderer.js`
- **WPs** = `node_modules/three/src/renderers/webgl/WebGLPrograms.js`
- **WP** = `node_modules/three/src/renderers/webgl/WebGLProgram.js`
- **PMREM** = `node_modules/three/src/extras/PMREMGenerator.js`
- **R3F** = `node_modules/@react-three/fiber/dist/react-three-fiber.esm.js`
- **R3F-ev** = `node_modules/@react-three/fiber/dist/events-e51d7528.esm.js`
- **drei-Env** = `node_modules/@react-three/drei/core/Environment.js`
- **WK** = `github.com/WebKit/WebKit/blob/main/`

---

## Question

The house is shown first as blueprint linework (from the live scene graph and camera), then the real lit scene fades in under the lines. Questions:

1. How to draw the edge lines, including a heavier silhouette.
2. How to copy one rendered pass into a DOM 2D canvas.
3. What "the real scene is ready" means, and how to detect the first true frame.
4. Whether CSS opacity and filter on the WebGL canvas are cheap and safe on iOS Safari.
5. What in R3F 9 and drei 10 could get in the way.

---

## Recommendation

1. **Use one screen-space edge pass, not EdgesGeometry or drei `<Edges>`.** Render the included objects once with `scene.overrideMaterial = MeshNormalMaterial` into a render target that has a `DepthTexture`. Then draw one full-screen shader into the canvas. It finds inner edges from normal and depth jumps, and the outer silhouette from the depth coverage mask, dilated by about 1–1.5 CSS px for weight. Hide excluded objects (sky dome, far ground disc, rain, heat arrows) for that one render, using a `userData` tag like the existing `thermalTag`. InstancedMesh works with no extra code. Decide by eye whether the shingle tabs stay in: they will draw every tab course.
2. **Use `ctx.drawImage(gl.domElement, 0, 0)` in the same rAF callback, right after the blueprint render.** Do it inside a `useFrame` gate (see 3). Do not use `readRenderTargetPixels`. Size the 2D canvas to the WebGL drawing buffer (`gl.domElement.width/height`) and scale it with CSS.
3. **Readiness rule:** (a) the scene graph has mounted and its effects have run; (b) `scene.environment` is final (the HDR has resolved, or the environment wait cap has passed); (c) `await gl.compileAsync(scene, camera)`; (d) one true frame is drawn while the canvas is still at opacity 0; (e) start the CSS handover on the next rAF. Caps: about 2 s for the environment wait and about 6 s overall from engine start. After the overall cap, hand over anyway. While loading, block R3F's own render with a `useFrame(…, 1)` gate, or R3F compiles every real material synchronously on its first frame. Also **match the Lightformer environment's resolution to the HDR (128, not 64)**. The HDR then swaps in with no shader recompile (see Evidence 3).
4. **Fade with CSS opacity and filter on the R3F canvas wrapper. Do not fade inside WebGL.** In WebKit, opacity, filter, transform, translate, scale, rotate and backdrop-filter run as accelerated animations. Mask and clip-path do not. So **do not animate a CSS mask for the 1.4 s draw-in**: it runs on the main thread, and that is the thread that shader linking blocks. Build the sweep from two counter-moving `transform` animations: an `overflow:hidden` window slides in while the line canvas inside it slides the other way, so the lines stay put. In motion, animate `transform`, `opacity` and `filter` keys directly. motion's `x` and `scale` shorthands run on its JS loop, not on WAAPI. Set `filter: none` and drop `will-change` when the fade ends.
5. **Plan for these R3F/drei behaviours:** the Canvas mounts its scene only after the first ResizeObserver measure. A resize or dpr change reallocates (clears) the drawing buffer and invalidates, so the line image must be captured again. Any child that suspends without its own `<Suspense>` makes R3F throw to the DOM Suspense above SceneShell, which hides the blueprint DOM layers too. A `useFrame` with priority > 0 turns off R3F's automatic render for as long as it is mounted. Under `frameloop="demand"`, nothing draws unless something calls `invalidate()`. The `fallback` prop of `<Canvas>` is only the canvas's inner no-canvas content. It is not a loading state.

---

## Evidence

### 1. Edge lines

**EdgesGeometry is CPU work on the main thread, per mesh, with string hashing.**
- `EdgesGeometry` builds three string hashes per triangle (`Math.round(x*1e4)` joined by commas), then two edge keys per edge, and stores each in an object map (`node_modules/three/src/geometries/EdgesGeometry.js` 69–144). Unmatched edges are added in a second loop (147–160).
- Measured here (Node 24, WSL desktop, three 0.180 build, threshold 20°): box 12 tris = 0.19 ms, cylinder 128 tris = 0.97 ms, sphere 32×16 (960 tris) = 6.0 ms, sphere 128×64 (16 128 tris) = 118 ms. That is about **6–8 µs per triangle**. An iPad was not measured. Bench script: `/tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/4f262008-5752-4fb0-a6b2-a705b95e91a4/scratchpad/bench-edges.mjs`.
- The cost falls exactly when the engine starts, which is when the draw-in should begin.
- EdgesGeometry lines are not occluded by anything. Hidden-line removal needs a depth-only pre-render of the meshes first. Without it the house reads as an x-ray wireframe.
- It only finds creases and open borders inside one geometry. It misses where two meshes meet, such as wall to roof or wall to ground.
- InstancedMesh: one EdgesGeometry draws only one instance. Per-instance lines need an `InstancedBufferGeometry` or a merged buffer. That is more code, for the ~200–600 shingle tabs (`src/shared/components/scene/ui/instanced-pieces.tsx` 51).

**drei `<Edges>` is EdgesGeometry plus a fat line per mesh.**
- It reads `parent.geometry`, runs `new THREE.EdgesGeometry(geometry, threshold)` and feeds the points to drei `Line` with `segments: true` (`node_modules/@react-three/drei/core/Edges.js` 16–35).
- drei `Line` builds a three-stdlib `LineSegments2` and a new `LineMaterial` for each instance (`node_modules/@react-three/drei/core/Line.js` 5, 19–20).
- For 145 meshes that means 145 extra scene objects and draw calls, the same CPU cost, and the same occlusion and instancing gaps.

**WebGL lines are 1 px.**
- three's own doc for `LineBasicMaterial.linewidth`: "WebGL and WebGPU ignore this setting and always render line primitives with a width of one pixel" (`node_modules/three/src/materials/LineBasicMaterial.js` 58–64).
- `Line2` / `LineSegments2` draw screen-space quads, and their width is set in CSS px (`node_modules/three/examples/jsm/lines/LineMaterial.js` 500–515). For a silhouette they still need silhouette edges first, and those depend on the view. Not worth it for a single still image.

**The screen-space pass is what three already ships for this look.**
- `RenderPixelatedPass` renders the scene with `scene.overrideMaterial = MeshNormalMaterial` into a target with a `DepthTexture`. It then finds edges from depth and normal neighbours in a shader (`node_modules/three/examples/jsm/postprocessing/RenderPixelatedPass.js` 87, 93, 169–176, 227–245). The blueprint shader is the same idea without the pixelation. It writes line colour and alpha to a transparent canvas (R3F creates the context with `alpha: true`, R3F-ev 1090).
- The override applies per render item when `material.allowOverride === true`, which is the default (WR 1976–1989; `node_modules/three/src/materials/Material.js` 436).
- Only `MeshNormalMaterial` programs compile for this pass, plus its instancing and instance-colour variants: `instancingColor` is in the program key whenever an InstancedMesh has `instanceColor` (WPs 198), and `InstancedPieces` sets colours with `setColorAt` (`instanced-pieces.tsx` 40). These are tiny compared with the ~145 lit `MeshStandardMaterial` programs. So the line image does not wait for the real materials.
- Silhouette weight: sample the depth texture at radius r (for example 2–3 device px at dpr 2) in 8 directions. Mark a pixel as outline where any sample is background (depth = 1) and the centre is not, or the other way round. That is a dilation, one pass, no extra geometry.
- `renderer.render` still runs `shadowMap.render` before drawing (WR 1600–1606). With `autoUpdate` true (`weather-sky.tsx` 38–40), the blueprint render also draws the shadow map once. That is harmless: it compiles the shadow depth programs early.
- Exclusion: `projectObject` skips `visible === false` objects and objects whose layers fail `camera.layers` (WR 1690–1696). A visibility toggle around the one render is the simplest. Layers would also change raycasting.

### 2. Copying the pass into a DOM canvas

**Spec.** WebGL 1.0 §"The Drawing Buffer": "If this flag is false, attempting to perform operations using this context as a source image after the rendering function has returned can lead to undefined behavior. This includes readPixels or toDataURL calls, using this context as the source image of another context's texImage2D or drawImage call, or creating an ImageBitmap from this context's canvas." It also says: "Techniques like synchronous drawing buffer access (e.g., calling readPixels or toDataURL in the same function that renders to the drawing buffer) can be used to get the contents of the drawing buffer." So drawImage in the same task as the render is the case the spec supports.

**WebKit does exactly that.**
- `drawImage(canvas)` calls `sourceCanvas.copyNativeImage()` (WK `Source/WebCore/html/canvas/CanvasRenderingContext2DBase.cpp` 2120–2156). For a WebGL canvas that returns `surfaceBufferToNativeImage(SurfaceBuffer::DrawingBuffer)` (WK `Source/WebCore/html/CanvasBase.cpp` 110–114).
- That reads the drawing buffer after `clearIfComposited`, which clears it if a composite has happened since the last draw. It also resolves MSAA first (WK `Source/WebCore/html/canvas/WebGLRenderingContextBase.cpp` 841–857, 741–771).
- So the copy is valid only before the next composite. That means in the same rAF task, after `gl.render`.
- The copy is a native image inside WebKit's GPU path. No pixels pass through JS.

**Where to call it in R3F.**
- The R3F loop runs all `useFrame` subscribers, then `gl.render`, then the global after-effects, inside one `requestAnimationFrame` callback (R3F-ev 17528–17541, 17548–17575).
- A priority-1 `useFrame` that renders the blueprint pass and then calls `drawImage` stays in that one task.
- Draw to the default framebuffer: call `gl.setRenderTarget(null)` before the final full-screen pass. A Firefox bug once copied the last bound framebuffer instead ([bugzilla 877309](https://bugzilla.mozilla.org/show_bug.cgi?id=877309)).

**Why not `readRenderTargetPixels`.**
- It is a synchronous `readPixels` into a JS buffer (WR 2849). At the iPad size (about 2732×2048 at dpr 2 = 5.6 MP) that is ~22 MB copied out of the GPU process into JS. Then `putImageData` uploads it again.
- `readRenderTargetPixelsAsync` (WR 2931–2993) avoids the stall with a PBO and a fence, but it still makes the same 22 MB round trip and adds frames of latency.
- `createImageBitmap(canvas)` takes its copy during the call (HTML spec: "Set imageBitmap's bitmap data to a copy of image's bitmap data", in the synchronous steps; only the promise resolves later). It has the same same-task rule. Its only advantage is a zero-copy display through a `bitmaprenderer` context. Not needed.
- Memory: the 2D canvas holds one more 5.6 MP RGBA surface (~22 MB) until the lines fade out. Release it afterwards (`width = 0`). WebKit's iOS canvas area cap is 8192×8192 (WK `Source/WebCore/html/CanvasBase.cpp` 119–131), far above this.

### 3. "Real scene ready"

**What `compile` / `compileAsync` do in r180.**
- `compile` gathers visible lights (and pushes shadows for `castShadow` lights) and calls `setupLights`. Then it walks the **whole** scene (`traverse`, not `traverseVisible`) and calls `getProgram` for every material on Mesh, Points, Line and Sprite. Double-sided transparent materials compile their back and front variants (WR 1267–1286, 1301–1390).
- The doc says: "the (target) scene's lighting and environment must be configured before calling this method" (WR 1294).
- `compileAsync` calls `compile`, then polls `program.isReady()` every 10 ms. It polls straight away when `KHR_parallel_shader_compile` exists, and after 10 ms when it does not (WR 1408–1460).
- `isReady()` is `true` at once without the extension. With it, it queries `COMPLETION_STATUS_KHR` (WP 1047–1060).

**Shadows.**
- The shadow-receiving variants are covered. Program parameters include `numDirLightShadows`, `shadowMapEnabled` (`renderer.shadowMap.enabled && shadows.length > 0`) and `shadowMapType`, and `compile` pushes shadows into the render state (WPs 326, 338–339; WR 1316–1322).
- The shadow **caster** depth programs (`MeshDepthMaterial`, `MeshDistanceMaterial` in `node_modules/three/src/renderers/webgl/WebGLShadowMap.js` 24–25, 253) are not compiled by `compile`. They compile on the first `shadowMap.render`. They are small, and the blueprint render (Evidence 1) already triggers them.
- Textures are not uploaded by `compile`. They upload on first use in a render. `gl.initTexture(texture)` can upload one ahead of time (WR 3324). This is one reason the first true frame should be drawn at opacity 0.

**Environment.**
- The program key includes `envMapMode` and `envMapCubeUVHeight`. For `MeshStandardMaterial` the env map is `scene.environment` run through PMREM (WPs 53–56, 207–209, 421–422).
- When `scene.environment` changes, `setProgram` sees `materialProperties.envMap !== envMap` and calls `getProgram` (WR 2294). A new program compiles only if the key differs: the program is looked up by key in the material's map and in the global cache (WR 2034–2075; WPs 593–618).
- The CubeUV height is `4 × cubeSize`, with `cubeSize = 2^floor(log2(n))` (PMREM 230–233, 289–292).
  - For an equirect source, n = `width / 4`. For a cube source, n = `image[0].width` (PMREM 261–270).
  - The Lightformer fallback is a drei `EnvironmentPortal` with a `WebGLCubeRenderTarget(resolution)` (drei-Env 86–134) at `resolution={64}` (`lightformer-environment.tsx` 17). That gives cubeSize 64 and **height 256**.
  - The sky HDR is 512×256 (`public/scenes/sky/citrus-orchard-road-puresky-512.hdr` header `-Y 256 +X 512`). That gives n = 128, cubeSize 128 and **height 512**.
- **So when the HDR resolves after the fallback, every lit `MeshStandardMaterial` gets a new program, compiled synchronously on the next frame.** The fallback is exactly what `AssetBoundary` mounts while the HDR suspends (`weather-sky.tsx` 94–100; `asset-boundary.tsx` 15–19).
- Fix: set the Lightformer resolution to 128. The keys then match (both `CubeUVReflectionMapping`, both height 512, both PMREM targets HalfFloat at PMREM 293–298). The swap becomes a texture change only.
- Also preload the HDR before the engine mounts. drei's `useEnvironment.preload({ files })` calls `useLoader.preload` (`node_modules/@react-three/drei/core/useEnvironment.js` 76–100). It is not used in `src/` today.

**KHR_parallel_shader_compile on iOS.**
- WebKit added it in 2020 ([bug 219266](https://bugs.webkit.org/show_bug.cgi?id=219266)). web3dsurvey reports it on 98.33% of iOS and 98.96% of Safari WebGL2 clients ([web3dsurvey](https://web3dsurvey.com/webgl2/extensions/KHR_parallel_shader_compile)).
- But [WebKit bug 251514](https://bugs.webkit.org/show_bug.cgi?id=251514) ("KHR_parallel_shader_compile does not allow for shader compilation without blocking", status NEW, last change 2023-03-23) says link is where the work happens and it blocks. A WebKit engineer: "parallel linking is not yet implemented in ANGLE Metal backend."
- **Expect compileAsync to resolve correctly on iPad, but to block the main thread while it runs.** This is why the draw-in must use accelerated CSS animations (Recommendation 4).

**Detecting the first true frame in R3F 9 with `frameloop="demand"`.**
- R3F renders only when `internal.priority` is 0 (R3F-ev 17537).
- Any `useFrame(cb, n > 0)` increments `internal.priority`. While it is mounted, R3F never calls `gl.render` itself (R3F-ev 1306–1328).
- A frame runs only after `invalidate()` (R3F-ev 17587–17604). Any store change invalidates (R3F-ev 1372).
- `renderer.info.render.frame` increments once per `render()` call (WR 1600). `scene.onAfterRender` fires at the end of each render (WR 1673).
- `addAfterEffect` runs after all roots in the same rAF (R3F-ev 17487–17515, 17571).
- Rule: in the gate's frame after `compileAsync` resolves, call `gl.render(scene, camera)` yourself and record `gl.info.render.frame`. Then `requestAnimationFrame` once more and start the CSS handover. Then unmount the gate so R3F's own rendering resumes, and `invalidate()`.
- Order the readiness work after the scene's effects. `InstancedPieces` sets `instanceColor` in a layout effect (`instanced-pieces.tsx` 26–47). Compiling before that would compile the wrong instancing variant.

**Suggested rule with caps** (numbers are starting points to tune on the device):
- `t0` = R3F `onCreated`.
- Blueprint capture on the first gated frame after mount.
- `envReady` = the HDR is in `scene.environment`, or `t0 + 2 s`, whichever is first. With matched resolutions, a late HDR costs nothing.
- `compiled` = `await gl.compileAsync(scene, camera)`, raced against `t0 + 6 s`.
- First true frame drawn at opacity 0.
- `handoverStart = max(drawInEnd, firstTrueFrame + 1 rAF)`.

### 4. CSS opacity and filter on the WebGL canvas (iOS Safari)

**Which animations WebKit accelerates.**
- WebKit's `CSSProperties.json` marks `"animation-wrapper-acceleration": "always"` for **opacity, filter, backdrop-filter, transform, translate, scale, rotate**, and `"threaded-only"` for the `offset-*` properties. No mask or clip-path property has it (WK `Source/WebCore/css/CSSProperties.json`: opacity 7603/7610, filter 10858/10868, transform 12812/12819).
- `KeyframeEffect` uses `Style::Interpolation::isAccelerated` to decide whether an animation can run accelerated (WK `Source/WebCore/animation/KeyframeEffect.cpp` 1370, 1742).
- Cocoa composites every filter list except drop-shadow when it is not last (WK `Source/WebCore/platform/graphics/ca/cocoa/PlatformCALayerCocoa.mm` 931–951). So `saturate()` and `brightness()` on the canvas layer composite.

**motion.**
- motion uses WAAPI only when the animated key is in `acceleratedValues` = opacity, clipPath, filter, transform, backgroundColor (`motion-dom/dist/es/animation/waapi/utils/accelerated-values.mjs`; `.../waapi/supports/waapi.mjs` 33–51).
- `x`, `y` and `scale` are not in that list, so they run on motion's JS frame loop.
- `clipPath` goes to WAAPI, but WebKit does not accelerate it.

**Why not fade in WebGL.**
- With `frameloop="demand"` it needs ~60 full scene renders during the 1 s fade. They would run exactly when texture uploads and late compiles can still hitch.
- A CSS fade on an accelerated property keeps running when the main thread stalls.

**Known WebKit bugs.**
- No bug was found that matches "canvas at opacity 0 never presents" or "flicker when fading a WebGL canvas".
- Related, all older and fixed or different:
  - [215141](https://bugs.webkit.org/show_bug.cgi?id=215141): blank texture swapped in on composite, fixed in 2020.
  - [239582](https://bugs.webkit.org/show_bug.cgi?id=239582): opacity+transform transition flicker on iOS 15.4, duplicate of 237972.
  - [291537](https://bugs.webkit.org/show_bug.cgi?id=291537): canvas skips a frame in a view transition, fixed 2025.
  - [301627](https://bugs.webkit.org/show_bug.cgi?id=301627): WebGPU canvas flicker on iOS 26. Not this renderer.
- Mitigation that costs nothing: draw the first true frame while the canvas is at opacity 0, and call `invalidate()` once more when the fade starts. A fresh frame is then presented while the layer is visible.

### 5. R3F 9 / drei 10 behaviours the plan must handle

**Mount timing.**
- `CanvasImpl` creates the root and renders children only when `containerRect.width > 0 && height > 0` (R3F 79–131). The size comes from `react-use-measure`, with `debounce: { scroll: 50, resize: 0 }` (R3F 42–49).
- So the blueprint ground must be plain DOM outside `<Canvas>`. It is on screen for at least one ResizeObserver tick.

**Resize and dpr.**
- On a size or dpr change, R3F calls `gl.setPixelRatio` and `gl.setSize` (R3F-ev 1340–1357), and invalidates on any store change (R3F-ev 1372).
- Per the WebGL spec, a canvas resize reallocates and presents the drawing buffer, so the line image becomes the wrong size.
- Capture it again on any `size` or `viewport.dpr` change while the blueprint is up. The iPad PWA viewport can change height after sign-in.
- `dpr={[1, 2]}` is clamped `min(max(1, devicePixelRatio), 2)` (R3F-ev 125–130). `watchDpr` follows zoom and display changes (R3F-ev 138, 1787–1789).

**Suspense.**
- R3F wraps the children in `<Suspense fallback={<Block set={setBlock} />}>` (R3F 121–131).
- `Block` sets a never-resolving promise. `CanvasImpl` then throws it (`if (block) throw block`, R3F 55–59; R3F-ev 85–94).
- So a child that suspends without its own boundary suspends the whole SceneShell subtree into the nearest DOM Suspense. In this route that is the `next/dynamic` loading text (`trade-scene-view.tsx` 26). The blueprint layers would vanish too.
- Today the HDR has `AssetBoundary`, GLTF furniture loads through `useGltfAsset` with stand-ins, and the assembly kits have `<Suspense fallback={null}>` (`assembly-kit-host.tsx` 64). Keep it that way.

**Render gate.**
- A priority > 0 `useFrame` stops R3F's automatic render (R3F-ev 1306–1312, 17537). That is how the gate keeps R3F from compiling the real scene synchronously while the lines show.
- If `bloom` is ever turned on, `@react-three/postprocessing`'s `EffectComposer` also renders from a priority `useFrame`. The gate must then hold it off too. The home scene does not pass `bloom` today (`home-scene-canvas.tsx` 106–118).

**`fallback` prop.**
- The `fallback` on `<Canvas>` is rendered as children of the `<canvas>` element (R3F 166–173). It is not a loading view.

**Environment portal.**
- drei's Lightformer `EnvironmentPortal` with `frames={1}` renders its cube camera in a layout effect and sets `scene.environment` (drei-Env 120–134). That direct render is not blocked by the gate.
- `setEnvProps` restores the previous environment on unmount (drei-Env 23–40). So the Suspense fallback to HDR swap sets the environment twice in one commit. With matched resolutions this is free.

**Late GLTF models.**
- Furniture and residents arrive after the line capture (`loaded-furniture-piece.tsx`, `load-gltf-asset.ts`). They will not be in the line image, and they compile when they first draw.
- The line image is a still under a static camera, so that is acceptable. Check by eye whether a closed house shows them at all.

---

## Unverified

- iPad cost of the screen-space pass at 5.6 MP, of `drawImage` into a 2D canvas, and of a `saturate()` filter animation on a full-screen WebGL layer. Measure on the device.
- iPad EdgesGeometry speed. Only the desktop Node figure (~6–8 µs/triangle) was measured. The scene's total triangle count was not measured.
- Whether WebKit bug 251514 (blocking link) is fixed in current iOS. No fix was found after 2023-03.
- Whether WebKit presents a WebGL canvas drawn while its layer (or an ancestor) has opacity 0, and keeps that image when the opacity rises with no new draw. No bug or source line was found either way. The mitigation in Evidence 4 makes this moot.
- Whether WebKit's 2D canvas behind `drawImage` is GPU-accelerated on iPad at this size. The source shows a native-image copy, not the rendering mode chosen.
- Whether a filter on the R3F wrapper `div`, rather than on the `<canvas>` itself, still composites as one cheap Core Animation filter over the WebGL layer. Until that is checked, the safer choice is to put the filter on the canvas element through a `canvas` selector.
- The cap numbers (2 s, 6 s) are starting points, not measured.
- Whether the shingle-tab lines look like drawing or like noise. That needs an owner look.

---

## Sources

- three.js 0.180.0 source in `node_modules/three/src/` and `node_modules/three/examples/jsm/` (paths and lines above).
- @react-three/fiber 9.8.2 dist (`react-three-fiber.esm.js`, `events-e51d7528.esm.js`); @react-three/drei 10.7.9 (`core/Edges.js`, `core/Line.js`, `core/Environment.js`, `core/useEnvironment.js`); motion-dom 12.43.0.
- Khronos WebGL 1.0 specification, "The Drawing Buffer": https://registry.khronos.org/webgl/specs/latest/1.0/
- WHATWG HTML, `createImageBitmap`: https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html
- WebKit source (main @ 4e04b9730506): `Source/WebCore/css/CSSProperties.json`, `Source/WebCore/animation/KeyframeEffect.cpp`, `Source/WebCore/style/StyleInterpolation.cpp`, `Source/WebCore/platform/graphics/ca/cocoa/PlatformCALayerCocoa.mm`, `Source/WebCore/html/CanvasBase.cpp`, `Source/WebCore/html/canvas/CanvasRenderingContext2DBase.cpp`, `Source/WebCore/html/canvas/WebGLRenderingContextBase.cpp` — https://github.com/WebKit/WebKit
- WebKit bugs: 219266, 251514, 215141, 239582, 291537, 301627 (https://bugs.webkit.org/show_bug.cgi?id=N)
- Mozilla bug 877309: https://bugzilla.mozilla.org/show_bug.cgi?id=877309
- web3dsurvey, KHR_parallel_shader_compile: https://web3dsurvey.com/webgl2/extensions/KHR_parallel_shader_compile
- Repo files: `src/shared/components/scene/ui/scene-shell.tsx`, `src/shared/components/scene/ui/instanced-pieces.tsx`, `src/shared/components/scene/ui/asset-boundary.tsx`, `src/features/trade-scenes/ui/components/home-kit/weather-sky.tsx`, `.../home-kit/lightformer-environment.tsx`, `.../home-scene-canvas.tsx`, `src/features/trade-scenes/constants/weather-skies.ts` (`SKY_IMAGE`, line 58).
