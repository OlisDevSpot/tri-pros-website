# Scene camera gestures: research findings (2026-10-25)

Scope: slide (pan) with a Box3-clamped target, double-tap/double-click to glide, laptop wheel mapping, Recenter, for `src/shared/components/scene/ui/camera-rig.tsx`.
Stack verified in `.worktrees/trade-scenes/node_modules`: three 0.180.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9 (wraps three-stdlib 2.36.1 `OrbitControls`), @use-gesture/core 10.3.1 (installed, not used by the rig).
Short path names used below: **OC** = `node_modules/.pnpm/three-stdlib@2.36.1_three@0.180.0/node_modules/three-stdlib/controls/OrbitControls.js`; **R3F-events** = `node_modules/.pnpm/@react-three+fiber@9.8.2_…/node_modules/@react-three/fiber/dist/events-e51d7528.esm.js`; **PC** = `node_modules/.pnpm/three@0.180.0/node_modules/three/src/cameras/PerspectiveCamera.js`.

---

## Recommendation

### 1. Double-tap (iPad) and double-click (mouse)

**Detect it yourself with pointer events, for every pointer type.** Don't rely on DOM `dblclick` or R3F `onDoubleClick` for touch.

What the sources say:
- R3F's `onDoubleClick` is the DOM `dblclick` event, listened for on R3F's container div (`events.connected`), and it is always registered (R3F-events 17757–17768 `DOM_EVENTS`, 17808–17816 `connect`). The container is R3F's own wrapper div, because `scene-shell.tsx` passes no `eventSource` (`react-three-fiber.esm.js` 67, 103). drei passes that same div to OrbitControls (`drei/core/OrbitControls.js`: `domElement || events.connected || gl.domElement`).
- iOS WebKit sends `dblclick` on a double tap only when the hit node, or an ancestor, has a `dblclick` listener. The UIKit recognizer `_doubleTapGestureRecognizerForDoubleClick` refuses to begin otherwise (`WKContentViewInteraction.mm`: "Do not start the double-tap-for-double-click gesture recognizer unless we've got a dblclick event handler on the node at the tap location", returning `hitNodeOrWindowHasDoubleClickListener`). Since R3F's container always has a `dblclick` listener, **iPad Safari should send `dblclick` over the canvas, and R3F `onDoubleClick` should fire with `e.point`.** WebKit's own tests confirm the event order `pointerdown, pointerup, pointerdown, pointerup, dblclick`, and `[click][click][double click]` (LayoutTests `pointerevents/ios/pointer-events-for-double-tap.html`, `fast/events/touch/ios/double-tap-for-double-click1.html`). A Window-level listener did not count until WebKit bug 301558, fixed in Oct 2025. That doesn't matter here, because the listener is on an ancestor element.
- So why still roll our own: (a) no WebKit test combines `touch-action: none`, OrbitControls and `dblclick`, so this has to be checked on a device (see Unverified). (b) UIKit owns the timing and movement tolerance of that recognizer, and we can't tune it. (c) Playwright's WebKit can't drive the UIKit double-tap recognizer, but it can dispatch pointer events, so our own detector is testable in `scripts/verify-*`. (d) One code path covers iPad, mouse and pen.

Detector, on the R3F container div (`gl.domElement.parentElement`, or `events.connected`):
- A **tap** is a `pointerdown`→`pointerup` with exactly one active pointer, lasting ≤ 300 ms, that travels ≤ 10 CSS px for touch or ≤ 4 px for mouse. A second pointer arriving cancels the tap.
- A **double** is a second tap whose `pointerdown` comes ≤ 300 ms after the first tap's `pointerup`, ≤ 35 px from it, and with the same `pointerType`. Excalidraw uses exactly `TAP_TWICE_TIMEOUT = 300` and `DOUBLE_TAP_POSITION_THRESHOLD = 35` for its own touch double-tap, and doesn't use `dblclick` for touch (`packages/common/src/constants.ts` 359, 616; `App.tsx` `onTouchStart` ~4533–4585).
- For mouse, you may use native `dblclick` instead, which respects the OS double-click speed. If you do, ignore `dblclick` events whose `pointerType` history says touch, so nothing fires twice.
- Fire the glide on the **second `pointerup`**, not on the second `pointerdown`. Every `pointerdown` makes OrbitControls dispatch `'start'` (touch: OC 739–784, `'start'` at 782; mouse: 649–703, `'start'` at 701), and the rig's current `onStart` stops glides. A glide started at pointerdown would kill itself.
- Raycast with R3F's `raycaster.setFromCamera(ndc, camera)`, using NDC from the full canvas rect. The ray is correct under the view offset, because `setFromCamera` unprojects through `camera.projectionMatrixInverse` (three `core/Raycaster.js` 118–123, `math/Vector3.js` 508–510), and that matrix carries the offset.

Interference from OrbitControls:
- **No pointer capture.** three-stdlib 2.36.1 never calls `setPointerCapture`; it only calls `releasePointerCapture` on the last pointerup (OC 642). It follows moves and ups on `ownerDocument` (OC 617–620). The detector sees every down and up on the container. A `pointerup` outside the container reaches only the document; treat that as "not a tap".
- **The second tap starts a rotate.** One finger maps to `TOUCH.ROTATE` (OC 79, 744–749), so any finger jitter rotates by `2π·dx/clientHeight`, about 0.45° per px on an 800 px canvas (OC 572–576). Damping then carries that rotation into the glide's first frames. It is small but visible. If it matters, set `controls.enableRotate = false` for the 300 ms window after a first tap. Rotation is read live in `onTouchStart`/`onTouchMove`.
- **Taps also produce `click`.** WebKit sends `click, click, dblclick`, and a custom detector sees two taps the same way. Any R3F `onClick` on scene parts (the shell's comment mentions "a tapped part") fires twice before the glide. Defer single-tap actions by 300 ms, or make them idempotent.

Page double-tap-to-zoom needs nothing more; it is already suppressed twice over:
- OrbitControls sets `touch-action: none` on the container (OC 300). WebKit's test `pointerevents/ios/touch-action-none-double-tap-to-zoom.html` asserts that this "prevents double tap to zoom". Its `dispose` sets `touch-action` back to `auto` (OC 307–309); keep that in mind if the controls ever unmount while the canvas stays.
- The app viewport is `width: device-width, initialScale: 1, maximumScale: 1, userScalable: false` (`src/app/(frontend)/layout.tsx` 118–125). WebKit turns off double-tap gestures for such pages to make taps fast (WebKit blog, "More Responsive Tapping on iOS").
- Optionally add `-webkit-user-select: none; -webkit-touch-callout: none` on the container so a double tap or long press over overlay text doesn't select it.

### 2. Trackpad swipe vs mouse wheel

**There's no reliable signal for which device sent a wheel event.** tldraw says so in its source: "because we can't for sure detect whether a user is using a mouse or a trackpad" (`Editor.ts` ~11211). Both tldraw and Excalidraw default to the trackpad mapping (wheel pans, ctrl or pinch zooms) and leave the rest to a user preference. tldraw's `wheelBehavior: 'pan'` comes from `constants.ts` 7, and its `inputMode` preference is at `Editor.ts` 11172–11178. Excalidraw's `inputDevice: "auto"` resolves to `"trackpad"` (`appState.ts` 87, 358–361), and the wheel zooms only when that is `"mouse"` (`App.wheel.ts` 79–91). MapLibre, a map that must zoom with both devices, is the one open-source product that classifies streams heuristically (`src/ui/handler/scroll_zoom.ts`). Figma also uses a preference ("Use scroll wheel zoom"; help.figma.com 1500004414582). Google Maps is closed source.

The signals, and how far to trust each:

| Signal | What it tells you | Reliability |
|---|---|---|
| `ctrlKey` on wheel | trackpad **pinch**: Chrome 31+, Edge, Firefox 55+, Safari 15+ (MDN BCD `WheelEvent.pinch_to_zoom_support`). It is also a real Ctrl+wheel. | High. Both cases should zoom, so it doesn't matter which one it is. |
| Safari `gesturestart/change/end` | macOS Safari trackpad pinch (`GestureEvent`, Safari 9+, BCD) | High, but Safari only. tldraw and Excalidraw both `preventDefault` these on macOS Safari (`useGestureEvents.ts` 285–379; `App.tsx` 4075–4100, 5905–5975). tldraw skips them on iOS, where both kinds fire for the same pinch (`useGestureEvents.ts` 371–374). |
| `deltaMode` | `1` (lines) means a Firefox mouse wheel | Useless in Chrome and Safari. Blink reports pixels (`0`) for everything except page scrolling (`wheel_event.cc` `ConvertDeltaMode`, line 44). |
| `deltaX ≠ 0` without Shift | a 2-D surface: trackpad, Magic Mouse, or a tilt wheel | Good evidence of a trackpad, but a purely vertical swipe has no `deltaX` at all. |
| `|deltaY|` a multiple of `4.000244140625` | mouse wheel on macOS (MapLibre: "definitely a mouse wheel event") | Good on macOS Safari and Firefox. Not established for Chrome or Windows. |
| `|deltaY| < 4` | trackpad (MapLibre: "definitely a trackpad event because it is so small") | Good for slow swipes. A fast swipe opens with large deltas. |
| Fractional `deltaY` | precise pixels, which suggests a trackpad | Weak. Blink divides by `devicePixelRatio` (`wheel_event.cc` 109–110), so a mouse notch can be fractional when the display is scaled or the page is zoomed. |
| `wheelDeltaY` a multiple of 120 | a wheel "tick" (Blink `kTickMultiplier = 120`, `wheel_event.h` 43) | Weak. Blink computes `ticks·120 / devicePixelRatio` (`wheel_event.cc` 107–108), so at 125% scaling a notch is 96. The property is also non-standard and deprecated. |
| Event cadence | trackpads stream events at about 60 Hz with momentum; wheels send sparse notches | MapLibre's rule: on the second event, `|Δt·delta| < 200` means trackpad (`scroll_zoom.ts`). Medium. |

**Recommended heuristic** (MapLibre's classifier, plus `deltaX`, plus ctrl):
1. If `ctrlKey` (or `metaKey`) is set → **zoom** by `exp(-deltaY·k)`. On macOS Safari, also listen to `gesturestart/gesturechange/gestureend` on the container: call `preventDefault`, zoom from `e.scale`, and ignore ctrl-wheel events while a gesture is active, so whichever path Safari uses, it never zooms twice (see Unverified).
2. Otherwise classify each **stream**. A gap of more than 400 ms starts a new stream, and the class sticks for the rest of the stream. The stream is a **trackpad** if `deltaX ≠ 0` and Shift isn't held, or `0 < |deltaY| < 4`. It is a **mouse** if `deltaMode ≠ 0` or `|deltaY| % 4.000244140625 === 0`. If neither, wait for the second event, or a 40 ms timeout that decides "mouse", and use `|Δt·deltaY| < 200` to mean trackpad.
3. Trackpad → **slide** by `(deltaX, deltaY)` px. Mouse → **zoom**. Shift+wheel → slide horizontally, as Excalidraw does (`App.wheel.ts` 95–101). On macOS, Shift+wheel usually arrives as `deltaX`.
4. Remember the last confident class for the session. Bias ambiguous streams toward it.

Failure modes:
- **Magic Mouse** classifies as a trackpad and slides. It is a touch surface, so that is arguably right.
- **Smooth-scrolling mice** (Logitech Options+ smooth scrolling, some Windows drivers) send small pixel streams. They classify as a trackpad and slide instead of zooming.
- **A fast trackpad flick** whose first event is large and sparse can classify as a mouse, so it zooms for one stream.
- **Windows precision touchpads** doing a slow, purely vertical swipe may look like a wheel. Their cadence usually rescues them.
- **Chrome on macOS with a mouse**: we don't know if its deltas are 4.000244… multiples, so it falls to the cadence rule.

Because slide and zoom are both reversible, and Recenter exists, these misclassifications are cosmetic. If owner feedback says otherwise, add a one-time "Mouse / Trackpad" toggle, as Figma, tldraw and Excalidraw do.

Wiring: OrbitControls' own wheel handler zooms on any wheel and ignores `ctrlKey` (OC 725–733, 491–499). `enableZoom = false` would also kill the two-finger dolly (OC 763, 801). Instead, add our wheel listener on the container in the **capture** phase, `{ passive: false }`, and call `preventDefault()` + `stopPropagation()` there. OrbitControls listens in the bubble phase on the same element (OC 304), so it never sees the event. Zoom with the public `controls.dollyIn(scale)` / `controls.dollyOut(scale)` (OC 845–852); they call `update()`. The `pan()` function is private (closure, OC 396), so slide with our own math from §3: move both target and camera, then call `controls.update()`.

### 3. OrbitControls pan math, and the view offset

From the source (OC 398–406), for a perspective camera:
```
targetDistance = |position − target| · tan(fov/2)
panLeft(2·dx·targetDistance / domElement.clientHeight)   // along camera.matrix column 0
panUp  (2·dy·targetDistance / domElement.clientHeight)   // column 1 (screenSpacePanning = true)
```
`dx` and `dy` are pointer pixels times `panSpeed` (OC 487, 588). The formula reads `camera.fov` but **ignores `camera.view` and `camera.zoom`**. three's own jsm OrbitControls does the same in r180 (`examples/jsm/controls/OrbitControls.js` 894–910).

What the projection does with the rig's call (PC 304–330, 353–375): `setViewOffset(visibleW, visibleH, −left·W, 0, W, H)` sets `aspect = visibleW/visibleH`. With near-plane height `Hn = 2·near·tan(fov/2)`, the sub-frustum is `Hn·H/visibleH` high and `aspect·Hn·W/visibleW = Hn·W/visibleH` wide. **Its aspect is W/H, the canvas's own, so the image isn't stretched.** Pixels are square, and world units per CSS pixel at depth d are `2·d·tan(fov/2) / visibleH` on both axes. The `left` and `right` fractions only shift the frustum; they don't scale it.

OrbitControls divides by `clientHeight`, which is the container's height `H`, the same as R3F's `size.height` (wrapper div at 100%; `react-three-fiber.esm.js` 159–167). Its pan is therefore short by a factor of `visibleH/H`. **The fix is `controls.panSpeed = H / visibleH = 1 / max(1 − bottom, MIN_SHARE)`**, and 1 when there's no area. Set it inside `frameVisibleArea` from the same `bottom` it applies, so it follows the tween and resizes. Our own wheel slide (§2) must use the same `2·d·tan(fov/2)/visibleH` per pixel. Rotation also uses `clientHeight` (OC 468, 574), but rotation isn't expected to track the finger.

Two limits on "under the finger":
- (a) This is exact only for points at the **target's depth**. Perspective moves nearer points faster and farther points slower. An exact "grab" needs a raycast pan: at gesture start, intersect the pointer ray with a plane through the hit point, facing the camera or the ground. On each move, re-intersect and translate camera and target by `P0 − P1`.
- (b) With `enableDamping`, each `update()` applies only `dampingFactor` (0.05) of the pending pan (OC 217–221, 233–237). drei calls `update()` every frame at priority −1 (`drei/core/OrbitControls.js`), and `onTouchMove` calls it again on every move (OC 787–815). The total distance is right, but the scene lags the finger during the drag. Accept that, or raise `dampingFactor` while panning.

Aspect bookkeeping: every path keeps `aspect` consistent. With an area, `setViewOffset` sets `aspect` and updates the projection. With no area, the code sets `aspect = W/H` before `clearViewOffset()`, which updates the projection; that is the right order. The fov ease calls `frameVisibleArea`, so a fov change is always followed by `updateProjectionMatrix`. On a canvas resize, R3F's `updateCamera` writes `aspect = W/H` and updates the projection while the offset is still on (R3F-events 561–574). The view stays stretched until the rig's resize `useLayoutEffect` re-applies `setViewOffset`. Whether a frame can render in that gap is in Unverified.

### 4. Keeping the target inside a Box3

**Clamp in the controls' `'change'` listener, shifting the camera by the same delta. Never call `update()` from the handler.**
```ts
onChange={() => {
  const t = controls.target
  scratch.copy(t).clamp(box.min, box.max)
  if (!scratch.equals(t)) { camera.position.add(delta.subVectors(scratch, t)); t.copy(scratch) }
}}
```
Why this works without a feedback loop:
- In `update()`, `'change'` is dispatched (OC 288) **before** `lastPosition.copy(position)` (OC 290). The corrected position becomes `lastPosition`, so the clamp itself triggers no extra `'change'`.
- Moving the target and the camera by the same vector keeps the orbit offset, and with it `spherical`, unchanged. The next `update()` rebuilds `position = target + offset` (OC 229) and lands on the same spot, with no swing or zoom.

Traps:
- **Clamp only the target, never the camera alone.** Moving only the target changes the offset. Damping then re-derives `spherical` from it each frame, and the camera swings and drifts.
- **Damping residue presses on the wall.** `panOffset` is private (OC 340) and decays by `0.95` per update, about 90 frames to 1%. Each frame pushes the target out and the clamp brings it back. The clamp is idempotent, so nothing jitters. But every frame emits `'change'`, which makes drei call `invalidate()`, so the demand loop (`frameloop="demand"`, `scene-shell.tsx` 47) renders for about 1.5 s against a wall. That is acceptable. To stop it sooner, toggling `enableDamping` false for one update zeroes the residue (OC 238–240).
- **Every glide destination must already be inside the box**: the double-tap hit point, Recenter, and every `framing.target`. Otherwise `useEased` writes an outside target each frame, the clamp pushes it back, and the two fight and jitter.
- **Calling `controls.update()` inside the handler re-enters `update()`** before `lastPosition` is copied. Don't.
- Alternatives: clamping in a `useFrame` at default priority (0) runs after drei's −1 and before render. Visually it's equivalent, but `'change'` listeners would see the unclamped target. A rubber-band clamp (soft limit, spring back on `'end'`) feels nicer but is more code. Patching `pan` isn't possible, because it's a closure.

### 5. "The user moved the camera" vs a plain tap

What OrbitControls emits (OC):
- `'start'`: on every mouse button press that maps to an action (701). On every touch `pointerdown`, including the second finger (782). On wheel, as `start` and `end` back to back (730–732).
- `'end'`: on every `pointerup` and `pointercancel`, one per finger (646, 303).
- `'change'`: only when `update()` actually moved or turned the camera by more than `EPS = 1e-6` (287–292; `EPS` at 328). It also fires for programmatic `update()` calls, so the glides trigger it, and for damping residue after `'end'`.

A tap with zero movement emits `start` and `end` but no `change`. One pixel of jitter does emit `change`. So "start plus any change" is too eager, and it also counts glide frames when a tap lands mid-glide.

**Recommendation: decide by pointer travel, from the same detector as §1.** On the container, track active pointers. Mark "user moved" and stop the glide when either is true:
- a pointer goes more than 6 CSS px (touch) or 3 px (mouse) from its `pointerdown` while OrbitControls is between `'start'` and `'end'`;
- any wheel or gesture event is handled (§2).

Move the rig's glide-stopping out of `onStart` and into this hook, so a tap, or the first tap of a double-tap, no longer cancels a running glide. If an OrbitControls-only signal is preferred: snapshot `target` and `position` on `'start'`, and on `'change'` while the gesture is active, count it only if the camera moved beyond a world epsilon **and** no glide is running.

---

## Unverified

- **Real iPad check**: does `dblclick` (R3F `onDoubleClick`) fire over the canvas with `touch-action: none` and OrbitControls attached? Source reading says yes (§1), but no WebKit test covers this combination. The custom detector makes it moot.
- UIKit's double-tap recognizer tolerances on iPadOS (interval, `allowableMovement`) were not read.
- Whether macOS Safari 15+ sends **both** ctrl-wheel and `GestureEvent`s for one pinch, or ctrl-wheel only when gesture events aren't `preventDefault`ed. The recommended "ignore ctrl-wheel during an active gesture" covers both cases.
- Chrome on macOS: the mouse-notch `deltaY` (4.000244… multiples or not) and the trackpad `wheelDeltaY/deltaY` ratio. The well-known `wheelDeltaY === −3·deltaY` trackpad rule was not found in a primary source.
- Windows: Chrome/Edge "percent-based scrolling" notch sizes, and precision-touchpad event cadence, were not verified.
- iPadOS with a Magic Keyboard trackpad: BCD lists `wheel_event` as unsupported on `safari_ios`, yet WebKit has iPad trackpad scroll support. Wheel delivery there was not verified.
- Whether a frame can render between R3F's resize `updateCamera` and the rig's resize `useLayoutEffect`, giving one stretched frame. This depends on reconciler and rAF timing that was not traced.
- Google Maps' wheel classification. It is closed source, and its docs only describe `gestureHandling` `greedy`/`cooperative`.

## Sources

Local (installed versions):
- `src/shared/components/scene/ui/camera-rig.tsx` 32–44 (frameVisibleArea), 104–118 (OrbitControls props, `onStart`).
- `src/shared/components/scene/ui/scene-shell.tsx` 45–67 (`frameloop="demand"`, no `eventSource`).
- `src/app/(frontend)/layout.tsx` 118–125 (viewport).
- OC (three-stdlib 2.36.1 OrbitControls.js): defaults 42–79; `update` 173–293 (pan apply 217–221, position 229, damping decay 233–240, change/lastPosition 287–292); `connect` 298–305; `dispose` 306–318; `panOffset` 340; `pan2` 396–420; `handleMouseMovePan` 485–490; `handleMouseWheel` 491–499; touch rotate/pan 562–590; `onPointerDown` 614–627; `onPointerUp` 638–648; `onMouseDown` 649–703; `onMouseWheel` 725–733; `onTouchStart` 739–784; `onTouchMove` 785–815; public `dollyIn/dollyOut` 845–852.
- `node_modules/@react-three/drei/core/OrbitControls.js` (drei 10.7.9): domElement resolution, `useFrame(update, -1)`, start/change/end wiring.
- R3F-events: `updateCamera` 561–574; `calculateDistance` 659–666; click/dblclick handling 945–1023; `DOM_EVENTS` and `connect` 17757–17840. `react-three-fiber.esm.js` 67, 103, 159–167.
- PC (three 0.180.0 PerspectiveCamera.js): `setViewOffset` 304–331, `clearViewOffset` 337–346, `updateProjectionMatrix` 353–381. three `src/core/Raycaster.js` 118–123; `src/math/Vector3.js` 508–510; `examples/jsm/controls/OrbitControls.js` 894–910.
- `@use-gesture/core` 10.3.1 `dist/actions-fe213e88.esm.js` 162–178 (deltaMode normalization), 1168–1236 (Safari gesture + wheel pinch with `preventDefault`).

Web (primary):
- WebKit `Source/WebKit/UIProcess/ios/WKContentViewInteraction.mm` (main, fetched 2026-10-25): recognizer setup ~1441–1444; `gestureRecognizerShouldBegin` dblclick gate ~3482–3490 — https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/ios/WKContentViewInteraction.mm
- WebKit LayoutTests: `pointerevents/ios/touch-action-none-double-tap-to-zoom.html`, `pointerevents/ios/pointer-events-for-double-tap.html`, `fast/events/touch/ios/double-tap-for-double-click1.html` (+ `-expected.txt`) — https://github.com/WebKit/WebKit/tree/main/LayoutTests
- WebKit bug 301558 / PR 53076 (Window `dblclick` listener on double tap, fixed Oct 2025) — https://bugs.webkit.org/show_bug.cgi?id=301558, https://github.com/WebKit/WebKit/pull/53076 ; changeset r255786 — https://trac.webkit.org/r255786
- WebKit blog, "More Responsive Tapping on iOS" — https://webkit.org/blog/5610/more-responsive-tapping-on-iOS/
- MDN browser-compat-data: `api/Element.json` (`dblclick_event`, `wheel_event`, `gesture*_event`), `api/WheelEvent.json` (`pinch_to_zoom_support`: Chrome 31, Firefox 55, Safari 15), `api/GestureEvent.json` (Safari 9) — https://github.com/mdn/browser-compat-data
- Chromium Blink `third_party/blink/renderer/core/events/wheel_event.{h,cc}` (`kTickMultiplier = 120` h:43; deltas and `wheelDelta` divided by devicePixelRatio cc:107–110; `ConvertDeltaMode` cc:44) — https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/core/events/
- MapLibre GL JS `src/ui/handler/scroll_zoom.ts` (wheel/trackpad classifier, `wheelZoomDelta = 4.000244140625`, `ctrlKey` = trackpad pinch) — https://github.com/maplibre/maplibre-gl-js/blob/main/src/ui/handler/scroll_zoom.ts
- Excalidraw `packages/excalidraw/components/App.wheel.ts` 14–110, `App.tsx` (~4075–4100 gesture listeners, ~4533–4585 tap-twice, ~5905–5975 Safari gesture handlers), `packages/excalidraw/appState.ts` 87, 358–361, `packages/common/src/constants.ts` 359, 616 — https://github.com/excalidraw/excalidraw
- tldraw `packages/editor/src/lib/hooks/useGestureEvents.ts` (67–104 wheel, 285–379 Safari gestures + iOS exclusion), `utils/normalizeWheel.ts`, `editor/Editor.ts` ~11165–11240 (wheel behaviour, "can't for sure detect" comment), `constants.ts` 7 (`wheelBehavior: 'pan'`) — https://github.com/tldraw/tldraw
- Figma Help, "Move around" (scroll-wheel-zoom and right-click-pan preferences) — https://help.figma.com/hc/en-us/articles/1500004414582
- Google Maps JS API, "Controlling zoom and pan" (`gestureHandling`) — https://developers.google.com/maps/documentation/javascript/interaction
