# Scene camera: slide, tap to look, recenter (R103)

> **Status:** draft for the owner's review, 2026-10-25. Tracker row **Camera**, requirement **R103** (`docs/plans/2026-10-16-trade-scenes-epic.md`).
> **Direction:** study **C, Tap to look**, picked by the owner on the studies page "Scene Camera Studies" (https://claude.ai/artifact/19jf86HrHdenVH4PPbjnsL), no corrections.
> **Research:** `docs/plans/2026-10-25-scene-camera-gestures-research.md` (double-tap on iPad, wheel classification, pan math, the clamp, the moved flag).
> **Size:** grew from "about four files" to about ten once double-tap and the laptop wheel joined. Camera only: no new scene inputs, no data, no backend.

## 1. Goal

In the living room the rep walks the homeowner through their own home: the windows, the attic, later the kitchen. The rep needs to bring the part they are talking about to the middle of the screen, fluidly, then turn and zoom around it, on the iPad and on a laptop. Today the camera only turns around one fixed point (`CameraRig` passes `enablePan={false}`), so anything off-centre can be spun past but never looked at.

## 2. Decisions already made

- **Both tapping and dragging matter** (owner). Tapping into a system is already how the camera jumps to a part; future systems (windows, walls, kitchen, bathrooms) bring their own anchor framing and pin. Kitchen and bathrooms become systems later (aesthetic, functional, structural), not now.
- **Dragging works on the whole home and up close on a system** (owner).
- **Study C** (owner, studies page): sliding and pinch as in study A, plus double-tap to look, plus a Recenter chip. Not B's dock buttons.
- **Laptops use either a trackpad or a mouse** (owner: "both / unsure"), so the wheel is classified per stream (§4.3).
- **Any framing change the app makes drops the slide** (owner: "looks good" to the reset rule; extended by Claude, §6): going up close or back out, a part tap or peel that leans the framing up close, the iPad turning across square, a foundation change up close, and TS3b.4a's crawl-space framing.
- **Recenter's framing is the current framing**: the home's, the system's, or the part-lean framing up close.
- **Stress test rulings** (owner, 2026-10-29):
  - Code says **pan** for the slide (`PanBox`, `HOME_PAN`, the rig's `pan` option), because "Slide" is already a presentation slide. The double-tap pieces are named after the gesture (`doubleTapFraming`, `TapRing`, `tapMark`, `doubleTapDistance`), because "Look" is the dock's Look drawer and "focus" is taken by `cameraFocus` and `partFocus`.
  - The iPad session's `home-camera-rig.tsx` work goes before this build's trade-scene tasks.
  - Double-tap is built now. TS3b.5 (Tap and jump) owns the clash with its single tap: its action must wait out the double-tap window or be harmless to repeat.
  - With the crawl row open, folding the card glides the camera back up to the home and drops the pan. It is a framing change like any other.

## 3. Content

| Element | Copy | Source |
|---|---|---|
| Recenter chip label | "Recenter" | new `SCENE_COPY.recenter` in `features/trade-scenes/constants/home-scene-copy.ts` |
| Shortcut sheet line | "Recenter the camera" | new `SHORTCUT_COPY.lines.recenter` |
| Shortcut key | `R` | new `'r': 'recenter'` in `SCENE_SHORTCUTS` (`constants/scene-shortcuts.ts`), a row in `SHORTCUT_SHEET_ROWS` |

No other words appear on screen. "Slide" and "tap to look" are this spec's words for the gestures and do not join CONTEXT.md; the code says "pan" and names the double-tap pieces after the gesture (§2).

## 4. Architecture

### 4.1 What the rep can do

| Gesture | iPad | Laptop |
|---|---|---|
| Turn | one finger | drag |
| Slide | two fingers | right-drag, Shift-drag, trackpad two-finger swipe, Shift + mouse wheel |
| Zoom | pinch | trackpad pinch, mouse wheel |
| Look at a spot | double-tap the house or the yard | double-click |
| Back to the framing | Recenter chip | Recenter chip or `R` |

- **Slide limits.** The point the camera turns around stays inside a box around the house and its yard: the footprint plus a margin, out past the yard anchor in front, from the ground to just above the ridge, rising and settling with the foundation's lift. Every glide destination (each framing's target, a look point) lies inside it, so a glide never fights the clamp.
- **Tap to look** (whole home only, the crawl framing included). A double-tap glides the camera's target to the first solid thing under the tap (see-through glass still stops it; rain, heat arrows, heat shimmer and hidden parts let it through), clamped into the box, keeps the camera's direction, and brings it no farther than a look distance (about 9 m in the mock; tuned by eye). A ring marks the tapped spot for 600 ms (none under reduced motion). The look is the rep's move: the Recenter chip stays.
- **Up close, a tap on a part already looks at it** (the existing part lean), so double-tap is off up close; slide, turn and pinch work there.
- **A single tap keeps its meaning**: a tap on the roof on the whole home still goes up close, so a double-tap on the roof goes up close (its first tap wins, and up close the second tap does nothing). A tap on the canvas still wakes a still home.
- **Recenter chip.** A small pill (recenter icon, "Recenter", and the `R` keycap once keys are in use, like the other keycaps) centred at the bottom of the scene visible area: 22 px above the visible area's bottom beside a side card, 14 px above a bottom card. It glides with a card fold on the card's own motion, as the thermal legend does. It shows from the moment the rep really moves the camera (§4.4) until the app next glides to a framing (any framing change, or Recenter itself). It and `R` glide back to the current framing on the rig's own glide.

### 4.2 Where the pieces live

- **Shared scene tier** (`src/shared/components/scene/`), opt-in so another scene decides for itself (today `HomeCameraRig` is the rig's only user):
  - `CameraRig` takes a slide option (the box) and turns on pan with it; sets `panSpeed` inside `frameVisibleArea` (§4.3); clamps in the controls' change event; runs a look glide and a recenter glide on the same easing and clock as its framing glides; stops glides on a real move, not on `onStart`.
  - A tap detector on R3F's container element: tap, double-tap and "moved" from pointer events (§4.4), and a raycast for the look point.
  - A wheel handler on the container in the capture phase (§4.3).
  - A small camera store (context), not the scene inputs, holding "the rep has moved the camera" and the look and recenter requests. A camera move must never touch the scene inputs or the burst key. (Every press already re-renders the home canvas through its wake counter, by design; the store adds nothing to that.) The rig reads the store through a reader that returns nothing without a provider, so a rig given no pan needs no store.
- **Trade scenes** (`src/features/trade-scenes/`): the home's slide box next to `HOME_ORBIT` in `constants/home-geometry.ts`; `HomeCameraRig` passes it and turns look off up close; a `RecenterChip` component mounted in `TradeSceneView` beside the build switch, placed by the `--scene-visible-*` variables; the `R` shortcut in `useSceneShortcuts`; the copy in §3.

### 4.3 Techniques (from the research note)

- **Slide speed under the view offset.** OrbitControls sizes a pan by the canvas height and ignores `setViewOffset`; the lens spans only the uncovered height. `panSpeed = 1 / max(1 − bottom, MIN_SHARE)`, set inside `frameVisibleArea` from the `bottom` it applies, so it follows the card's tween and resizes. The wheel slide uses the same world-per-pixel, `2·d·tan(fov/2) / visibleH`. The image is not stretched (verified in the note, §3).
- **Clamp.** In the controls' change listener, clamp the target into the box and move the camera by the same delta. Never call `update()` there. Clamp only the target together with the camera, never one alone.
- **Double-tap detection.** Our own pointer-event detector on R3F's container for every pointer type: one active pointer, at most 300 ms down, at most 6 px of travel for touch (`SCENE_MOTION.tapSlopPx`, the same limit the roof and part taps use, so the detector and R3F always agree on what a tap is) and 4 px for a mouse; a second tap within 300 ms and 35 px of the first, same pointer type. The look fires on the second `pointerup`. Raycast with R3F's raycaster from the full canvas rect, which is correct under the view offset. iPad Safari would probably also send `dblclick`, but our detector is tunable, testable in Playwright and one path for all pointers.
- **Wheel.** One capture-phase listener on the container (`passive: false`, `preventDefault` + `stopPropagation`), so OrbitControls' own wheel zoom never sees it. Ctrl or meta wheel (trackpad pinch) zooms with `controls.dollyIn/Out`. On macOS Safari (bound only when `navigator.maxTouchPoints === 0`: iPadOS reports a Mac user agent and also fires these for a pinch the touch pointers already zoom), `gesturestart/change/end` zoom by scale and ctrl-wheel is ignored while a gesture runs. Otherwise each stream (a new one after a 400 ms gap) is classified once: `deltaX ≠ 0` without Shift, or `0 < |deltaY| < 4`, is a trackpad and slides; `deltaMode ≠ 0` or `|deltaY|` a multiple of 4.000244 is a mouse and zooms; otherwise the second event's cadence decides (`|Δt·deltaY| < 200` = trackpad), with a 40 ms timeout falling to mouse. The last confident class biases ambiguous streams. Shift + wheel slides sideways.

### 4.4 The "moved" flag

Decided by pointer travel, not by OrbitControls' `start` (which fires on every press, a plain tap included): a pointer moving more than 6 px (touch) or 4 px (mouse) from its press, the same limits as a tap, so a press is either a tap or a move and never both; or any wheel or gesture event handled. That flag stops a running glide and shows the chip; a tap, or the first tap of a double-tap, no longer cancels a glide.

### 4.5 Responsive and motion

- The chip sits in the visible area at every stage shape; it must clear the dock, the card, the folded knob and the thermal legend (bottom-left of the canvas) at 1440 × 900, 1024 × 768, 820 × 1180 and 390 × 844.
- Glides use `SCENE_MOTION` (the rig's existing easing and clock). Reduced motion: the chip appears and leaves without its slide; the ring does not animate; camera glides keep the rig's existing reduced-motion behaviour.
- Damping: a slide lags the finger slightly while dragging and lands right; accepted.

### 4.6 Accessibility

The chip is a real button with its label, `aria-keyshortcuts="r"`, a 44 px hit area and a visible focus ring. `R` is listed in the shortcut sheet. Gestures have no keyboard equivalent beyond Recenter; keyboard camera movement stays off (the rig passes no `keyEvents`).

## 5. Data access

None. No tRPC, DAL, schema or seed change; nothing for the owner to run first.

## 6. Error handling and edge cases

- **A double-tap that misses** the house and the ground does nothing.
- **A look point outside the box** (a tree past the yard, the back wall) is clamped before the glide; the ray never passes through it to the house behind.
- **The WebGL context is lost** after a move: the rig unmounts and clears the moved flag, so the chip leaves with the canvas.
- **The crawl row open, then the card folded**: the crawl view ends, the camera glides back up to the home and the pan drops (owner, 2026-10-29).
- **A slide pressed against the box edge** stops there. Damping residue keeps rendering about 1.5 s against the wall (the demand loop); acceptable.
- **Turning the iPad, a foundation change up close, a part tap or peel up close, the crawl-space framing (TS3b.4a Task 11)**: each is a framing change, so each glides and drops the slide (Claude's call; no rule picks changes that keep a slide).
- **Misclassified wheel** (smooth-scrolling mice, a fast trackpad flick, Windows touchpads): slides or zooms for one stream; both are reversible and Recenter exists. A one-time Mouse / Trackpad preference is the fallback if reps report it.
- **No WebGL**: the fallback view has no camera; the chip never shows there.

## 7. Verification

- `pnpm tsc`, `pnpm lint`, and the trade-scene verify script with new assertions: every framing the app can reach (home wide and tall, the roof anchor in both forms at both lifts, every part lean, the crawl framing on a raised floor) lies inside the slide box (the unused yard and under-floor anchors sit below ground on a slab and are not checked); the wheel classifier (pure function) on sample streams (mouse notches, trackpad swipe, pinch, Shift).
- Playwright on the lab page (`/dashboard/labs/trade-scene`, software WebGL flags as in the earlier shot scripts) at 1440 × 900, 1024 × 768, 820 × 1180, 390 × 844, stage dark in both schemes: a slide to the side of the house; the box stopping a slide past the house and below ground; a double-click on a window gliding there with the chip shown; Recenter and `R` returning and hiding the chip; a slide then up close landing on the roof's framing; the card folded after a slide keeping it; the chip clear of the dock, card, knob and thermal legend; a simulated touch double-tap through pointer events.
- Owner on the iPad: slide tracks two fingers with the card open (landscape and portrait), double-tap on a window, pinch, Recenter.

## 8. Files

Expected; the plan settles names.

- **Modify** `src/shared/components/scene/ui/camera-rig.tsx`, `src/features/trade-scenes/ui/components/home-kit/home-camera-rig.tsx`, `src/features/trade-scenes/constants/home-geometry.ts`, `src/features/trade-scenes/constants/scene-shortcuts.ts`, `src/features/trade-scenes/constants/home-scene-copy.ts`, `src/features/trade-scenes/hooks/use-scene-shortcuts.ts`, `src/features/trade-scenes/ui/views/trade-scene-view.tsx`, the trade-scene verify script.
- **Create** in the shared scene tier: the camera store (context), the tap detector hook, the wheel hook, the tap ring, and pure `lib/` helpers (pan math, the double-tap framing, the tap tracker, the wheel-stream classifier and router, the glide goal, the double-tap stop test), each checked in `scripts/verify-scene-primitives.ts`. In trade scenes: `lib/home-pan-box.ts`, `lib/home-lift.ts`, `ui/components/recenter-chip.tsx`. The plan names each file.
- **Shared with other sessions:** TS3b.4a is done (its crawl framing is in `home-camera-rig.tsx`). The iPad session holds `home-camera-rig.tsx` and edits `scripts/verify-trade-scene-layout.ts`; its rig work goes first (owner, 2026-10-29). Commit by path; never revert another session's edits.

## 9. Out of scope and follow-ups

- **Out of scope:** new systems, anchors or pins (R52, R92); guided tours (R17 keeps controls free); lower angles (R39); the 1024 lab page's cramped visible area with the app nav open (about 340 px for the house; the meeting's full-screen overlay, TS4, removes the nav); a raycast "grab" slide that keeps nearer points exactly under the finger.
- **Follow-ups:** TS3b.5 (Tap and jump) gives a single tap on the whole home a meaning, so its action must wait out the 300 ms double-tap window or be harmless to repeat (owner, 2026-10-29); a Mouse / Trackpad preference if the wheel guess bites; confirm on a real iPad whether `dblclick` also fires (the detector makes it moot, the note's Unverified list); kitchen and bathroom systems will make double-tap on those rooms less needed but it stays.
