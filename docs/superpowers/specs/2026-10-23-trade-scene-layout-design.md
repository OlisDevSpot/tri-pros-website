# Trade scene layout: the glass HUD

**Date:** 2026-10-23 · **Status:** draft, stress-tested 2026-10-23 and amended with the owner's rulings (D22–D25); plan stress-tested 2026-10-23 and amended (D26–D28, C11); plan `docs/superpowers/plans/2026-10-23-trade-scene-layout.md` · **Epic:** `docs/plans/2026-10-16-trade-scenes-epic.md` (R78–R83 logged from this exploration) · **Studies page:** "Trade Scene Layout Studies" (private artifact https://claude.ai/artifact/SdisF1HyuQxzVModw4N2oP, version 7; Study B round 2 and bar A are what this spec describes)

## 1. Goal

In the owner's words: improve the layout of the 3D trade scene, meaning where the buttons are, how the panel shows, the UI primitives, and the alignment. Today the panel is a settings form beside a 3D scene; the in-home meeting needs a presentation console:

- the panel follows the build being shown: today's build is about the home and how it is lived in, the Tri Pros build is about the upgrades and what they save;
- the scene's home view, Thermal lens and weather are one tap, or one key, away;
- collapsing the panel never jitters or shifts the scene.

## 2. Decisions already made (do not re-open)

| # | Decision | Source |
|---|---|---|
| D1 | Direction: **B, the glass HUD**. The scene is full screen; the panel is a floating card; scene controls are the **dock** on the right edge (D23). | owner pick, round 1 |
| D2 | Usage: **iPad first, touch first**; a keyboard sometimes. | owner |
| D3 | **Build switch = option A, "shared spotlight".** One bar, top centre of the visible scene: *Today* fixed at the left end, *Tri Pros build* fixed at the right end, the open build's two tabs between them. The open build's end and its tabs share one tinted region that slides across when the build switches (neutral for Today, blue for the Tri Pros build); one lozenge marks the open tab. The middle is exactly as wide as its two tabs (no slack either side). The tab set slides in from the side of the build just chosen. The bar switches the existing scene input `view` (`existing` / `proposed`). | owner, round 2; named D23 |
| D4 | **Today** has *Living situation* and *Home*. **Tri Pros build** has *Upgrades* and *Savings*. No Upgrades or Savings in Today. Each build remembers its last tab. | owner |
| D5 | **Tabs inside Today's tabs**, as underline tabs at the top of the card: Living situation → *Household* · *Upkeep & Bills*; Home → *Structure* · *Current materials*. Upgrades and Savings have none. Each remembers its last sub-tab. | owner |
| D6 | **Collapse:** the card leaves the scene completely; a small knob stays on the left edge (on a portrait stage, at the bottom edge). Tap the knob, press `/` (owner, 2026-10-24; was `\`), or tap the open tab again to bring it back. | owner |
| D7 | **The 3D canvas is never resized by the panel** (root cause of today's jitter, §4.1). | Claude, owner saw the before/after demo |
| D8 | **Lighter controls** in place of rows of segmented buttons: ordered choices are a stepped scale; long lists are one row that opens a tray of picture tiles; two-way choices are a slim pair; "Not sure" is a quiet link, never a button. | owner ("bulky, mundane") |
| D9 | **Amounts sit tight to their unit** (`$240/mo`, `$400/yr`). | owner |
| D10 | **Upkeep & Bills** = the electric and gas bills, plus repairs and upkeep for each material the home has today (roof, windows, exterior paint, heating & cooling), each prefilled with the team's working number until typed, and a total for running the home today. The Tri Pros build's savings start from these. | owner (R82) |
| D11 | **Home = Structure + Current materials.** Structure is rigid (built, foundation, roof form; stories and garage when R80 lands). Materials can be swapped (roof material, windows, insulation, heating & cooling; paint when TS3b.4 lands). The roof form decides the roof material: flat → torch down only; pitched → shingle, tile, wood shake or metal. | owner (R79) |
| D12 | **Upgrades follow the existing structure**, one pick per layer (R81): shingle → overlay or tear-off; torch down → torch down; tile → tile reset; wood shake → tear-off; metal → nothing yet; redeck on every roof but metal; insulation → top off or replace. | owner (R81) |
| D13 | **Upgrades list the scopes and addons part by part** (`ScopesAndAddons`, D27): one row per part, roof down to ceiling, today's state on the left; a picked part shows a green check and a short verb ("Tear-off (cool roof)", "Add", "Replace", "Seal"); the full scope name shows in the row's options. | owner |
| D14 | **Savings** leads with one total ("about $84 a month less*"), then one bar per source (electric, gas, roof upkeep), then the amounts it read from Upkeep & Bills. | owner (kept from B) |
| D15 | **Shortcut keys**: `1`–`4` weather (Normal, Summer, Winter, Rain), `V` home view, `T` Thermal, `B` Today / Tri Pros build, `/` panel (owner, 2026-10-24; was `\`), `?` the shortcut sheet. Keycaps show only after a key has been pressed on the stage. Keys never fire while a field has the cursor. | owner (iPad first) |
| D16 | Living situation holds who lives here and the money only: no new habit inputs. | owner |
| D17 | Condition per material (R78), stories and garage (R80) and exterior paint are **not built here**; see §6 and §10. | owner (R78 "later phase") + Claude's call |
| D18 | **Redeck only with a covering that takes the old roof off** (Tear-off, Torch down, Tile reset). With Overlay or no covering picked, the deck row offers nothing and says why ("Needs a tear-off: an overlay keeps the old roof on"). Picking Overlay drops a picked redeck. | owner, after the builder check |
| D19 | **The R81 constant is task 0 of the plan**, written in the construction module (§5); the epic session is told it exists. | owner, after the builder check |
| D20 | **Built in parallel with TS3b.3, split by file** (§9); amended by D26. | owner, after the builder check |
| D21 | **Phone (390 px): works, not polished.** Same layout as the portrait stage; the build switch shows the open build's tabs with compact Today / Build ends; the design effort goes to the iPad. | owner, after the builder check |
| D22 | **Cool roof stays a toggle in the covering row, on by default**: the first covering pick ticks it (today's `coolRoofSettled` rule); the rep can untick it to show the roof without it. It is presentation (EI-D26): what it does to the figures follows EI-D25/EI-D26 (folding cool roof into the roof's base cut is the epic's work, not this layout's). | owner, stress test |
| D23 | **Names.** The right-edge strip stays the **Dock** (redefined: every choice visible, no pop-outs). The top bar is the **build switch**: it switches between today's build and the Tri Pros build; its end labels stay "Today" and "Tri Pros build" (`SCENE_VIEW_LABELS`). Never "story", "story bar" or "chapter" (CONTEXT.md avoids them); "lens strip" is withdrawn (Lens is Thermal only). | owner, stress test |
| D24 | **Money inputs use the shared `MoneyField`** from main (`src/shared/components/ui/money-field.tsx`, commit 7cddbbfda, `suffix` gives `$240/mo`). Main is merged into `feat/trade-scenes-foundation` first (it brings `react-number-format`), coordinated with the epic session. The feature's own `panel/money-field.tsx` goes (renamed a unit number field, kept only for the percent cut); no new `AmountField`. The unit sits in an `InputGroup` addon, as main's `FormMoneyField` does, so `$` and the unit show while the field is empty. | owner, stress test |
| D25 | **Narrow landscape stage** (an iPad at 1024 with the app nav open leaves a 768 px stage): below 800 px of stage width the card is 320 px, the build switch uses the compact Today / Build ends, and the camera also offsets for the dock (the dock covers the visible area's right edge). | owner, stress test |
| D26 | **One phase.** TS3b.3 Task 8 is committed (a494df01f), so the build no longer waits on a gate: the card mounts floating over the full-size canvas from the start, with no temporary mount in today's panel box. The file split (§9) holds only until the epic session says its TS3b.3 whole-branch review is done; the tasks that touch its files (camera, overlays, dock, framings) wait for that yes. | owner, plan stress test |
| D27 | **Names.** The Upgrades tab's list is **`ScopesAndAddons`** (rows `ScopeOrAddonRow`), after the Notion scopes and addons it offers. The part of the scene the card and dock leave uncovered is the **scene visible area** (`SceneVisibleArea`). The folded card's tab stays the **knob** (`PanelKnob`). "Receipt" and "scene inset" are withdrawn. The scene input `addOns` (bill-cut add-ons, today cool roof only) clashes with Notion's addons; noted, not fixed here (§10). | owner, plan stress test |
| D28 | **The studies page is the visual floor** (Study B round 2, bar A): the built UI is at least as crisp, and every UI screenshot is compared with the study at the same viewport. | owner, 2026-10-23 |

### 2a. Claude's calls (the owner may overturn any)

| # | Call | Why |
|---|---|---|
| C1 | **Folding the card keeps the rep's camera.** The wide/tall framing is chosen from the *stage's* aspect (changes only when the window does); the fold only shifts the view (view offset) and eases the field of view for the visible aspect. No glide back to the default framing on a fold. | Today every fold crosses `TALL_BELOW_ASPECT = 1` at common sizes, swaps `HOME_FRAMINGS` and throws away the rep's orbit; that is part of the "shift" the owner asked to remove. |
| C2 | **While up close** (`zoom !== null`), the card shows the assembly screen and no tab is marked in the build switch. Tapping any tab leaves the close-up with the back button's full reset (`{ zoom: null, peel: 0, emphasizedPart: null }`, `assembly-screen.tsx:28`) and opens that tab; tapping a build end switches the build and stays up close. The card keeps its width (today's 26rem widen goes), so the visible area never changes on a zoom. | One state machine, one visible area; `AssemblyScreen` scrolls if it needs more room. |
| C3 | **Savings keeps the typed bill cut** (`CutOverride`, writes `bills[c].cut`), the "no cut" note and each figure's `EstimateDisclosure`, placed under that source's bar. | Dropping them would remove something the rep can do today. |
| C4 | **Upkeep rows show for every trade with a working number**, whatever the home has: every home has a roof, windows, an exterior and (usually) heating and cooling. The row's note names today's material ("Single pane", "Heating & cooling · not set"), never a condition (R78 is deferred); the figure is the trade's working number until per-material numbers come with R78. | `REPAIRS_PER_YEAR` is per trade, not per material. |
| C5 | **Only the covering and the redeck depend on the existing roof.** Gutters, radiant barrier, attic insulation and air sealing are offered on every roof (insulation as top off or replace). A metal or unset roof empties only those two rows. | R81 names roof work only. |
| C6 | **Row order in Scopes and addons** = the assembly's parts reversed (outside in: covering → deck → radiant barrier → attic insulation → air sealing), with `edge: true` parts (gutter, drip edge) moved to the end. Generic, so a new kit still needs no layout work. | `ASSEMBLIES['roof-attic'].parts` runs ceiling → covering → ridge vent → gutter. |
| C7 | **Portrait stage:** the dock's four weather tiles always fold into one weather button that opens the four tiles as a tray, so the first key press (which brings the shortcut button) never reflows the strip; the shortcut button shows only on devices with a fine pointer or after a key press. **Any stage too short for the strip** (a landscape iPad inside Safari's bars, about 1024×690) folds the weather by measured room too; where that is still too tall the home view folds to one button as well, and last the shortcut button gives way (`?` still opens the sheet). `dockLayoutFor` holds the rule. | At 820×1180 the full strip runs into the sheet. Amended 2026-10-24 (final review I2): the room-based fold had replaced the portrait fold, so an iPad's strip reflowed on its first key press. |
| C8 | **The card is solid and sits on the stage's card rung** (`bg-card` with a 1 px `border`, so the fields inside take their rungs from the card's, D28's study). Glass was measured and rejected: muted text reached only 4.31:1 over the brightest portrait sky, against 8.65:1 solid. Blur never counts toward contrast. | The feature already painted pop-outs solid because glass washed out labels over the sky. Amended 2026-10-24 (Task 11 and Task 18 rulings): the card rung replaced `--popover` and the `surface-overlay` clip. |
| C9 | **Opening tabs:** Today opens on Living situation › Household; the Tri Pros build opens on Upgrades. After that each build reopens on its last tab (D4) and each tab on its last sub-tab (D5). | The owner's order puts the household first. |
| C10 | **Picked states use tokens:** a picked tile is `bg-control-selected` and a picked pill keeps the segmented on state (`bg-tab-active`); the row's green check is the app's success token (theme-conventions §8), never a raw green; the build switch's blue tint for the Tri Pros build is an existing token or a new one through §11. | No raw colours on this surface. |
| C11 | **The stage's shape is measured, not queried:** one `ResizeObserver` measures the stage; `stageShapeOf(width, height)` and the visible area read the same numbers, and the stage exposes `data-shape`. Replaces size containment (§4.2). | CSS and the camera can never disagree about the shape. |

## 3. Content

**Every string lives in `features/trade-scenes/constants/home-scene-copy.ts`**, so the copy gate in `scripts/verify-trade-scene.ts` (no "your", never solar) reads it. The other new constants files (`scope-verbs.ts`, `repairs-row-labels.ts`, `scene-shortcuts.ts`, `build-switch.ts`) hold only keys into that copy and measurements. Items marked **new** are placeholders until the owner's copy pass.

| Where | Item | Source |
|---|---|---|
| Build switch | Today, Tri Pros build; compact Today, Build | `SCENE_VIEW_LABELS`; **new**: compact "Build" |
| Build switch | Living situation, Home, Upgrades, Savings | `PANEL_TAB_LABELS` gains `living`; `home` stays; **new**: "Living situation" |
| Card heading | eyebrow, title, lead | `ASSEMBLY_HEADINGS` via `targets.heading` (unchanged) |
| Household | Household (tray with figure tiles), Age group (scale) | `PROFILE_COPY.householdType`, `.ageGroup`; `HOUSEHOLD_TYPE_LABELS`, `AGE_GROUP_LABELS` |
| Upkeep & Bills | Electric bill, Gas bill, "Monthly average. Kept on this screen only." | `SAVINGS_COPY.billLabel`, `.billHint` |
| Upkeep & Bills | Repairs rows: Roof, Windows, Exterior paint, Heating & cooling; working numbers | rows = trades in `REPAIRS_PER_YEAR` with a figure > 0 (`hvac` 600, `roof-and-gutters` 400, `windows-and-doors` 200, `exterior-paint-stucco-and-siding` 150); row label and the "what the home has" note are **new** (§4.8) |
| Upkeep & Bills | "Running and keeping up this home today", "a month*", "The build's savings start from these." | **new** |
| Structure | Climate, Built, Foundation, Roof form | `PROFILE_COPY`; **new**: "Roof", "Pitched", "Flat" (labels for the form `pitched` / `low-slope`) |
| Current materials | Roof material, Windows, Insulation, Heating & cooling, Equipment | `PROFILE_COPY`, `ROOF_TYPE_LABELS` (`flat` reads **"Torch down"**, new; a relabel, not additive, see §9), `WINDOWS_TYPE_LABELS`, `INSULATION_LEVEL_LABELS`, `HVAC_TYPE_LABELS`, `HVAC_COMPONENT_LABELS` |
| Every field | "Not sure" link | **new**; `PROFILE_COPY.unknown` ("Unknown") is relabelled "Not sure" |
| Sub-tabs | Household, Upkeep & Bills, Structure, Current materials | **new** (owner's words) |
| Upgrades (Scopes and addons) | part names (`PART_LABELS`, **new**); "No change"; short verbs (Overlay, Torch down, Tear-off, Tile reset, Redeck, Add, Top off, Replace, Seal, New); "(cool roof)"; "Also new: …"; the deck's base line | **new**; full scope names from the construction catalog (`useConstructionCatalog`, fallback `scopeFallbackLabel`); the decking line reuses `SOLID_DECK.copy.label` |
| Savings | total, per-source figures, disclosure | `SAVINGS_COPY` (unchanged wording); "Roof upkeep" bar label **new** |
| Dock | Complete, Partly open, Thermal (+ its hint), Normal/Summer/Winter/Rain | `HOME_VIEW_LABELS`, `DOCK_COPY.thermal`, `DOCK_COPY.thermalHint`, `WEATHER_LABELS` |
| Weather tiles | thumbnail per weather | `HOME_SCENE_STILLS` (the existing no-3D stills) |
| Shortcut sheet | one line per key | **new** |

No company facts appear anywhere in this surface. The FTC R-value wording stays as it is (`SAVINGS_COPY.disclosure.rValue`, pending verification).

## 4. Architecture

### 4.1 The stage: canvas full size, the card floats, the camera offsets (D7)

**Root cause (measured 2026-10-23):** in `trade-scene-view.tsx` the canvas box's `left` follows the panel's width (`left-[22rem]` → `left-18`). A collapse therefore resizes the WebGL canvas: the box snaps, R3F keeps the old drawing stretched into the new box until its resize lands (72 ms at 1440, 540 ms at 1024 under a software renderer), then `HomeCameraRig` re-frames for the new aspect and the house jumps again. The toggle centred on that box jumps 140 px.

**Fix:** the canvas fills the whole stage at every width; nothing the panel does changes its size. The card, build switch, dock and knob are DOM layers over it. The part of the scene the card and dock leave uncovered is the **scene visible area** (`SceneVisibleArea`: how far it starts in from each canvas edge, `{ left, right, bottom }` in CSS px: `left` past a side card, `bottom` above a bottom sheet, `right` short of the dock on a landscape stage; the card's terms are zero when folded). The camera frames for the *visible* rectangle and shifts its frustum into it:

```
visibleW = canvasW − area.left − area.right        visibleH = canvasH − area.bottom
camera.setViewOffset(visibleW, visibleH, −area.left, 0, canvasW, canvasH)
```

`setViewOffset` sets `camera.aspect = visibleW / visibleH` and moves the frustum by `offsetX · width / fullWidth` (three.js `PerspectiveCamera.updateProjectionMatrix`, verified twice 2026-10-23). The house is framed exactly as if the canvas were the visible rectangle, and the strip under the card still draws scene. Pins project through the same projection matrix, so `ScenePinsProjector` positions stay correct with no change.

- The visible area moves as a **fraction of the canvas** (0–1) on a time-based tween (`useTweened`) on the card's own `SCENE_MOTION.transition` (0.5 s, `BRAND_EASE`), started on the same clock, so the house and the card move as one frame for frame; it asks for frames until it lands (the canvas is `frameloop="demand"`) and jumps under reduced motion. The fov is worked out in the same step from the framing's eased fov and the tweened area, so the lens widens in step with the slide. Amended 2026-10-24 (final review I1): exponential damping (`useEased`) put the house up to 25% of the way behind the card and still drifting after the card landed.
- **Trap:** R3F resets `camera.aspect` on every canvas resize. The rig re-applies the offset after any size change (window resize, the app nav folding), not only when the visible area changes.
- `homeFramingFor` reads the **stage** aspect (C1: the framing, and so the rep's orbit, survives a fold); `widenFovForAspect` reads the **visible** aspect so the house stays whole while the card is open.
- The shared `CameraRig` (`shared/components/scene/ui/camera-rig.tsx`) gains an optional `visibleArea` prop; with none it behaves exactly as today. `HomeCameraRig` is its only consumer (the roof-cutaway lab has its own rig; the look-dev scene uses drei's `OrbitControls`). The TS3b.3 plan forbids touching `src/shared/components/scene/`, so this edit waits for the epic session's yes (§9, D26).
- The visible area comes from one place: a `SceneVisibleAreaContext` with its provider and hook (feature `contexts/scene-visible-area-context.tsx`) written by the stage from the card's state, the stage size and the dock, read by `HomeCameraRig` inside the canvas (R3F 9 carries React context into the canvas) and by the DOM overlays below.
- **Overlays placed by the canvas box move to the visible rectangle:** `ThermalLegend` (`absolute bottom-4 left-4`, would sit under the card), the fallback still's caption, and `CalloutPin`'s wide/narrow leader switch (`@max-[64rem]/scene-canvas`, keyed to the canvas width) becomes keyed to the visible width (the stage's `data-visible-narrow` attribute). Pins draw under the card.

### 4.2 Stage regions

| Region | Landscape stage | Narrow landscape stage (< 800 px wide, D25) | Portrait stage |
|---|---|---|---|
| Card | floating card, 16 px from the left, top and bottom edges, 372 px wide; slides left out of view on collapse | the same, 320 px wide | floating sheet, 12 px from the sides and bottom, about 46% of the stage tall; slides down out of view |
| Knob | left edge, vertically centred, about 22 × 88 px visible, 44 px hit area | same | bottom edge, centred, about 104 × 28 px visible, 44 px hit area |
| Build switch | top centre of the **visible** area (moves with the visible area) | same, compact ends | top centre of the stage, compact ends below 600 px wide |
| Dock | right edge, vertically centred | same | right edge, below the build switch; weather folded (C7) |
| Visible area starts at | `left = 16 + 372`, `right` = dock width + its margin | `left = 16 + 320`, `right` as landscape | `bottom` = sheet height, `right` = 0 |

**One rule for the stage's shape:** portrait when the stage is taller than wide **or** narrower than 600 px; otherwise landscape, narrow below 800 px. The stage (`scene-stage.tsx`) measures itself (C11) and exposes the shape as `data-shape` (today's `@container/trade-scene` is inline-size only, so an orientation query could never match). An iPad in portrait with the app nav folded (764 px wide) still gets the sheet. The current `47rem` stack-under breakpoint goes away.

### 4.3 The build switch (D3, D23)

One feature-local component, `BuildSwitch`, in `ui/components/build-switch/build-switch.tsx` (named file, no barrel; parts beside it):

- Order: Today button, the middle, Tri Pros build button. Fixed ends; the middle width is the open set's own width.
- **The middle's width change animates without layout animation**: both tab sets are measured once (they never change at runtime except on font load); the middle is laid out at the wider set's width and clipped with `clip-path: inset(0 Xpx 0 Ypx round …)` (or the bar's contents shift by a transform) so the visible width eases between the two. The builder picks between clip-path and transform; both must leave `width` untouched during the animation.
- The spotlight (tint under the open build's end plus its tabs) and the tab lozenge are absolutely positioned and move by `transform: translateX()` and `scaleX()` (or clip-path), not `left`/`width`.
- Set swap: the outgoing set fades and slides 56 px toward its own end; the incoming one slides in from its end. On `SCENE_MOTION.transition`.
- Keyboard: `role="tablist"` per set; the ends are toggle buttons (`aria-pressed`). Arrow keys move between the two tabs.
- Tapping the open tab again folds the card (D6).
- `prefers-reduced-motion`: no slides, the tint and lozenge jump.
- It reads and writes the panel state of §4.4, not state of its own.

### 4.4 The card

- Surface per C8 (solid, the stage's card rung: `bg-card` and a 1 px `border` on the inner clip), and a soft shadow on the frame. The card is two elements: an outer frame that carries the shadow and an inner clip that carries `overflow` (never both on one element). Verify text contrast in Summer and Normal (the brightest skies) by sampling screenshots, muted text included, in both app colour schemes (the stage is always `dark`).
- Contents, top to bottom: the heading (`PanelHeader`, compact), the fold button, the sub-tabs (Today only), then one scroll column (`PANEL_SCROLL_CLASS`).
- **Up close** (`zoom !== null`), the card shows `AssemblyScreen` exactly as today, at the card's usual width; the build switch and dock stay, and the build switch behaves as C2 says.
- **Panel state is lifted to the stage**, because the build switch, the `B` key and "tap the open tab to fold" live outside the card: one stage-level state (`PanelTabsProvider` and `usePanelTabs` in `contexts/panel-tabs-context.tsx`, provided by `TradeSceneView`) holds the open tab, each build's last tab and each tab's last sub-tab, with the opening tabs of C9. The open build is the scene input `view` (unchanged). The fold stays in `usePanelCollapsed` (session storage).
- A collapsed card unmounts nothing that holds state; it is `inert` and off-screen by transform.
- **Focus:** folding from the card's own fold button moves focus to the knob; unfolding moves it to the build switch's open tab, so keys keep reaching the stage.

### 4.5 The dock (replaces today's dock pop-outs, D23)

Vertical strip on the right edge, every choice visible, one tap each:

- Home view: Complete, Partly open (two buttons, house glyphs, `HOME_VIEW_ICONS`).
- Thermal: one toggle, its pressed state shown by a ramp swatch beside the label (named `THERMAL_PALETTES` entry; no text sits on the ramp, as `ThermalScaleBar` does), with `DOCK_COPY.thermalHint` kept.
- Weather: four tiles, each a thumbnail of `HOME_SCENE_STILLS[weather]` with its label.
- Shortcut sheet button (keyboard glyph) at the foot.
- The look drawer (owner's look-dev palette) stays as a small button at the foot, unchanged.
- Each control shows its keycap in its corner once keys are in use.
- 64 × 58 px buttons; 44 px minimum hit area everywhere.
- Portrait stage: weather is one button opening the four tiles (C7).

`SceneDock` is rebuilt in place as this strip; `ViewPicker`, `WeatherPicker`, `DockButton` and the dock's popovers are retired; their inputs (`homeView`, `thermalCamera`, `weather`) are written the same way.

### 4.6 Shortcut keys (D15)

A feature hook `useSceneShortcuts(stageRef)`:

- **Reuses the meeting flow's key guard**, promoted to shared (`TYPING_TARGET_SELECTOR` from `meeting-flow/constants/keyboard-hints.ts` and the guards in `meeting-flow/hooks/use-meeting-flow-keys.ts:44-81`): skips `defaultPrevented`, IME composition, `event.repeat` (holding `T` must not flap Thermal), Meta/Ctrl/Alt, typing targets (input, textarea, select, contenteditable, slider, spinbutton, combobox, listbox roles) and focus inside a portaled layer. The meeting flow switches to the shared copy in the same change. A handled key calls `preventDefault`.
- Listens on `window` with the stage as the guard's root, as the meeting flow does, so `defaultPrevented` means React or Radix already used the key; it acts when focus is inside the stage or on `body`.
- Writes the same inputs the controls write. `B` toggles `view`; the build switch's middle follows.
- `keysInUse` is a module-level store following `use-panel-collapsed.ts` (subscribe + `useSyncExternalStore`), set on the first handled key, lasting the page's life; keycaps (`<kbd>`, `aria-hidden`) render only when it is true.
- `?` opens the shortcut sheet (a small dialog over the stage, `Escape` closes it; it portals out, so it carries the `dark` class as `look-drawer.tsx` does).
- A tap on the canvas leaves focus on `body`, which the guard accepts, so the stage needs no `tabIndex`.

### 4.7 The field primitives (D8, D9, D24)

Feature-local in `ui/components/fields/` first (promoted to `shared/components` later if another surface wants them), each built on an existing primitive and on the `ProfileChoices` / `UNKNOWN_CHOICE` contract (`lib/profile-choice.ts`, `constants/home-profile-choices.ts`), which renders "Not sure":

| Primitive | Use | Built on | Behaviour |
|---|---|---|---|
| `ScaleField` | ordered choices: Built, Age group, Insulation | `ui/radio-group` (roving arrow keys) | a track with one stop per option; the chosen stop is large, the track fills to it; the value reads at the top right; end labels under the track; "Not sure" writes `null` and draws the track dashed. 34 px stops, 44 px hit area. |
| `TrayField` | long lists: Household, Roof material, Heating & cooling, Equipment | `ui/accordion` `type="single"` (one tray open at a time) | one row (label · glyph + value · chevron); tapping opens a tray of picture tiles under it; picking closes it. "Not sure" is the tray's last tile. |
| `SegmentedField`, slim | two or three options: Climate, Foundation, Roof form, Windows | the existing `SegmentedField`, given a slim size and a label-row slot for the "Not sure" link | a slim pill pair, 36 px tall. "Not sure" link in the label row. |
| money | bills, repairs, the typed cut | the shared `MoneyField` (D24) with the unit in an `InputGroup` addon and a `ch`-based width; `cents` on bills | `$` · digits · unit, tight, shown while empty too; a working number shows as the placeholder. |

Glyphs for the tiles (roof profiles, heating units, household figures) are small inline SVG components in `ui/components/fields/glyphs/`, one per file; their path data lives in `constants/`.

`SegmentedField` serves the look drawer and the slim pairs.

### 4.8 Tabs, and the edge mappers that feed them

**Household:** `TrayField` household (figures), `ScaleField` age group. Writes `household`.

**Upkeep & Bills:** money fields for electric, gas (writes `bills[c].now`); one row per repairs trade (writes `repairsOverrides[trade]`, placeholder `REPAIRS_PER_YEAR[trade]`), reusing `RepairsLine`'s row (`repairs-line.tsx`) restyled; the total.

- `lib/repairs-rows.ts` (pure): the rows = trades with a working number > 0; each row's label and note ("Shingle", "Single pane") come from the home's profile through a small `REPAIRS_ROW_LABELS` key map into the copy. **No new store field.** "Upkeep" is UI copy only; code says `repairs`, as `repairsOverrides` and `REPAIRS_PER_YEAR` do.
- **One fold for the repairs figure:** extract the override-or-working-number sum from `lib/scene-savings.ts:67-76` (`resolveOverridable`) into one pure helper used by both `sceneSavings` and the Living total, so Living and Savings never differ by a rounding. The Living total = bills + that repairs figure / 12, rounded as `scene-savings.ts` rounds.
- Savings no longer edits repairs; it shows them read-only (§6).

**Structure:** Climate (pair), Built (scale), Foundation (pair), Roof form (pair: Pitched / Flat).

**Current materials:** Roof material (tray; options depend on the form), Windows (pair), Insulation (scale), Heating & cooling (tray), Equipment (tray).

- **Roof form is derived, not stored**, in the construction module (`ROOF_FORMS`, `RoofForm` = `pitched | low-slope`; the feature's `HomeRoofForm` in `home-anchors.ts:10` spells the same union and moves onto the core type): export one `roofFormOf(roofType)` from construction core (the rule already inline at `infer-existing-conditions.ts:22`) and use it there and here; `null` → unknown. Setting Flat writes `roofType: 'flat'`. **Setting Pitched on a flat or unset roof writes `roofType: 'shingle'`** (the inference's own default, so panel and scene agree; the rep then changes the material); on a pitched roof it keeps the type. The material options are `PROFILE_ROOF_TYPES` filtered by `roofFormOf` (no hand-kept `MATERIALS_BY_PITCH`); flat has one option, "Torch down", shown as a fixed value, not a tray.
- After any roof change, upgrade picks the new roof cannot take are dropped from `proposedScopeIds` (same write path as the picks, `scopePreviewPatch`).

**Upgrades:** scopes and addons (D13, D27).

- `lib/part-offers.ts` (pure) **replaces** `scopeGroupsForAssembly` (`lib/scope-chip-options.ts`): it groups the primary assembly's scopes by the part each **first** installs (`SCOPE_INSTALLS[id].installs[0].part`), in the order C6 sets (parts reversed, `edge` parts last), so a new kit needs no layout work. Code says *part*; "layer" is UI copy only (CONTEXT.md, Part). The list never shows up close (C2).
- Which scopes a part offers: for the covering and the deck, the scopes for that part **∩ the scopes the existing roof can take** (R81, §5); every other part offers all its scopes (C5). A part with nothing offered shows the reason ("Nothing offered on a metal roof yet", "Set the roof material under Today › Home"). "Set the roof material" shows when `property.roofType === null`, read from the profile, because the inference turns an unset roof into shingle.
- **Today's state on each row** comes from the pure `resolveAssembly(assembly, { existing: INFER_EXISTING_CONDITIONS[id](property), proposedScopeIds: [], view: 'existing' })`, which gives the parts with their labels; no second scene resolve and no change to `useSceneTargets`.
- **Single choice per part, one write:** picking writes through `scopePreviewPatch` with a group that spans **both the covering and the deck**, so picking Overlay removes a picked redeck in the same patch (D18), and picking a scope removes that part's other scope.
- **The deck's base:** when the picked covering needs a base (`SOLID_DECK.needsBase`: shingle or tile over spaced boards, as on a wood-shake tear-off), the deck row shows its own label (`SOLID_DECK.copy.label`, "New solid decking, needed for the new roof") with a check and offers no separate redeck, matching what `resolveAssembly` draws.
- Cool roof per D22: a toggle in the covering row, ticked by the first covering pick (`coolRoofSettled` unchanged), shown as "(cool roof)" after the verb while ticked; `CoolRoofChip` is reused for it.
- Row: the part's name (`PART_LABELS`, new copy keyed by part id; `ResolvedPart.label` is the material's wording, not the part's name), today's state (the material's label and `PART_COPY.condition`), the verb (`SCOPE_VERBS`, keyed by scope id into the copy, **new**), the success-token check when picked (C10).
- Picking work in Today is no longer possible (no Upgrades tab there), so `PANEL_COPY.workHint` goes, and `scopePreviewPatch`'s "a pick on Today moves to the build" branch goes with its assertions in `verify-trade-scene.ts`.

**Savings:** reads `targets.savings` exactly as `SavingsTab` does today; layout changes only (total first, bars, the amounts it read as chips). The bars are `scaleX` transforms. Under each bar: the typed cut (`CutOverride`, on the shared money field), the "no cut" note and the figure's `EstimateDisclosure`, as today (C3). The "Show the Tri Pros build" button goes (`SavingsOnBuild`, `SAVINGS_COPY.showBuild`), since Savings only exists in the build.

### 4.9 Motion

The card slide, the knob, the build switch's set swap and the visible area all run on `SCENE_MOTION.transition` / `SCENE_MOTION.damping` (0.5 s), so house and card move as one; tray open 200 ms. Only `transform`, `opacity` and `clip-path` animate. Reduced motion: every slide is an instant swap; the camera's visible area jumps (`useEased` already honours it).

### 4.10 Accessibility

44 px hit areas; visible focus rings on the dark stage (`--ring`); the build switch's ends are `aria-pressed` buttons and each set a `tablist`; the knob is a button labelled "Show panel"; keycaps are `aria-hidden` (the shortcut sheet lists them for everyone); the collapsed card is `inert`, with focus moved as §4.4 says.

## 5. Data access

| Kind | Item | Status |
|---|---|---|
| Reads used as-is | `useSceneTargets()` (heading, assemblies' resolved parts, savings), `useConstructionCatalog()` (scope and trade names), pure `resolveAssembly` for today's parts | no change |
| Writes used as-is | scene inputs `view`, `weather`, `homeView`, `thermalCamera`, `property.*`, `household.*`, `bills.*.now`, `bills.*.cut`, `repairsOverrides[trade]`, `proposedScopeIds` (via `scopePreviewPatch`), `addOns`, `coolRoofSettled` | no change; all client-side in the scene's own store |
| UI adaptations at the edge | roof form from `roofType` (§4.8); repairs rows from `REPAIRS_PER_YEAR`; parts from `SCOPE_INSTALLS` + `ASSEMBLIES` | feature `lib/`, pure, checked in `scripts/verify-trade-scene.ts` |
| **Task 0 (R81, D18, D19)** | **Which scopes each existing roof can take**: `src/shared/modules/construction/core/constants/scopes-by-existing-roof.ts`, `SCOPES_BY_EXISTING_ROOF: Record<RoofType, readonly string[]>` keyed by scope id with a name comment per id (as `scope-installs.ts` does): shingle → overlay, tear-off; flat → torch down; tile → tile reset; woodshake → tear-off; metal → none; redeck on every roof but metal. The redeck pairing rule (redeck needs tear-off, torch down or tile reset among the picks) is a function in `core/lib/`. Also `roofFormOf` (§4.8). Checks in `scripts/verify-construction-model.ts` (pure, no catalog fetch): every `SCOPE_INSTALLS` id that installs a covering or deck appears in the R81 map, every scope id has an `SCOPE_VERBS` entry, and the redeck rule's truth table. Named scope-id constants replace the bare UUIDs the verify scripts repeat (`TEAR_OFF` is declared twice today). | **task 0**; the epic session and the energy-impact EI0 plan (which lifts `construction/core` from a pinned tip) are told it exists |
| Not needed | DAL, tRPC, schema, seeds | none |
| Deferred, not built here | condition per material (R78), stories and garage (R80), exterior paint as a home fact (TS3b.4, R65), a tear-off rate for wood shake in the pricing calculator (`scope-pricing-calculator/constants/project-context.ts:3-4` prices tear-off for shingle and tile only) | the epic models them; this layout leaves room (§6) |

## 6. Edge cases and what is left out

- **Roof type not set:** Current materials shows "Not sure" for the material; the build's covering row says "Set the roof material under Today › Home" and offers nothing.
- **Metal:** the covering offers nothing ("Nothing offered on a metal roof yet"); redeck too.
- **Bills empty:** Savings shows those bars as "—" and totals what is known. It shows the amounts it read as read-only chips with the hint "Change these in Today › Living situation"; it does not jump there, because switching to Today also switches the scene back to today's home.
- **A material changes after a pick:** picks the new roof cannot take are dropped (§4.8) in the same write. A part the new roof still offers work on reads "No change"; a part it offers nothing on shows its blocked reason instead (Metal: "Nothing offered on a metal roof yet"; not set: "Set the roof material under Today › Home"). Amended 2026-10-24 (Task 11 ruling).
- **Condition, stories, garage, paint:** not rendered. The mock showed them as concepts; drawing inputs that feed nothing would be dead UI. Their slots are the Structure and Current materials tabs; they join when the epic models them (R78, R80, TS3b.4).
- **Up close:** the card shows the assembly screen; the sub-tabs hide; the build switch still switches the build.
- **No 3D (fallback stills):** the card, build switch and dock still work; the visible area has no camera to move, and the still and its caption sit in the visible rectangle.
- **Stage shape:** one rule, §4.2 (portrait below 600 px wide or when taller than wide; narrow landscape below 800 px).
- **Phone (D21):** portrait layout; compact ends; weather is one button (C7). Checked for "usable, nothing overlaps", not polished.
- **Metal or unset roof, today's covering:** the inference draws shingles for both, so the row's today state reads the profile (`ROOF_TYPE_LABELS.metal`, or "Not sure") instead of the inferred part.
- **Redeck without a tear-off (D18):** the deck row shows "Needs a tear-off: an overlay keeps the old roof on" (**new** copy) and offers nothing.

## 7. Verification

There is no unit-test runner in the repo; every "check" below is an assertion block in `scripts/verify-trade-scene-layout.ts` (this build's feature `lib/`; the shared `verify-trade-scene.ts` keeps its copy gate) or `scripts/verify-construction-model.ts` (task 0), or a Playwright capture.

Playwright on the lab page `/dashboard/labs/trade-scene` (dev server on the worktree's port; log in through `/api/dev/playwright-session?secret=…&as=…`, never `role=`, which writes to the DB; never print the URL):

- Viewports 1440×900, 1024×768 with the app nav open (768 px stage, narrow landscape) and folded, 820×1180 portrait, 390×844.
- **Collapse with no jitter:** sample the canvas element's box and the house's framed centre (the orbit target projected through the camera, not a pin) each animation frame through a fold and an unfold. The canvas box must not change; the framed centre moves monotonically with no frame jumping more than 2% of the stage width; **at rest the framed centre is within ±2% of the visible rectangle's centre, card open and folded** (folded, the visible rectangle is the stage less the dock, §4.1; a camera that ignores the visible area fails this). The roof pin is sampled beside it as a second probe. Measured 2026-10-24 with the lockstep tween: 1.7–2.1% a frame at 1440 and 1280, 2.6–2.9% at the 958 and 768 px stages, where the house's 168–194 px shift on `BRAND_EASE` peaks at 13.7% of its way in one frame; the rule is open there for the owner (final-fix report). Repeat after a window resize and after an app-nav fold with the card open (the R3F aspect trap).
- **C1:** orbit the camera, fold, unfold: the camera position is unchanged.
- **Stage shape:** at 820×1180 the card is the bottom sheet; at 768 px wide landscape the card is 320 px and the ends are compact; at 390 nothing overlaps (card, build switch, dock, knob boxes do not intersect).
- Build switch: the middle's visible width equals its open set's width ±1 px in both builds; the tint covers the open end and its tabs.
- **Tab memory (D4, D5, C9):** open Home › Current materials, switch to the Tri Pros build and back: Home › Current materials is open again.
- **Scopes and addons (D12, D18, D22):** for each roof type the covering and deck rows offer exactly the R81 set; pick Tear-off then Redeck then Overlay: the redeck is gone from `proposedScopeIds`; on a wood-shake tear-off the deck row reads the included solid decking; the first covering pick ticks cool roof.
- **Roof form:** tap Pitched on a flat roof: the pill stays on Pitched and the material reads Shingle.
- Keys: each key changes its input; no key fires with the cursor in a bill field; holding `T` toggles once; keycaps absent until the first key; after folding from the card's button, `/` still unfolds.
- **Against the studies page (D28):** each UI shot is paired with the study's at the same viewport; one that reads less crisp is a finding. A final `/impeccable` pass in both app colour schemes.
- No 3D: Chromium launched with `--disable-3d-apis`; the card, build switch and dock work, and the still sits in the visible area.
- Reduced motion (emulated): slides are instant, nothing animates `left` or `width`.
- Contrast: card text, muted text included, over the Summer and Normal skies ≥ 4.5:1, sampled from screenshots; `pnpm theme:check` if a `--scene-glass` token is added.
- `pnpm tsc`, `pnpm lint`, `scripts/verify-trade-scene.ts`, `scripts/verify-construction-model.ts`.
- Clear `.next` before judging rendered CSS on a long-running dev server (ask the owner; never kill their server).

## 8. Files

**Before anything:** main merged into `feat/trade-scenes-foundation` (D24), coordinated with the epic session.

**Create** (feature `src/features/trade-scenes/` unless noted): `ui/components/build-switch/build-switch.tsx` (+ parts) · `ui/components/panel/scene-card.tsx`, `panel-knob.tsx`, `panel-sub-tabs.tsx`, `living-tab.tsx` (+ `household-section.tsx`, `repairs-section.tsx`, `repairs-row-field.tsx`), `structure-section.tsx`, `materials-section.tsx`, `scopes-and-addons.tsx` (+ `scope-or-addon-row.tsx`) · `ui/components/shortcut-keys-dialog.tsx`, `keycap.tsx` · `ui/components/fields/*` (scale, tray, glyphs) · `hooks/use-scene-shortcuts.ts`, `hooks/use-keys-in-use.ts`, `hooks/use-stage-size.ts`, `hooks/use-set-property.ts` · `contexts/scene-visible-area-context.tsx`, `contexts/panel-tabs-context.tsx` · `lib/repairs-figure.ts`, `lib/repairs-rows.ts`, `lib/part-offers.ts`, `lib/property-patch.ts`, `lib/scope-pick.ts`, `lib/panel-tab-press.ts`, `lib/stage-shape-of.ts`, `lib/scene-visible-area-for.ts` · `constants/scope-verbs.ts`, `repairs-row-labels.ts`, `scene-shortcuts.ts`, `build-switch.ts` · `src/shared/modules/construction/core/constants/scopes-by-existing-roof.ts` + the redeck rule and `roofFormOf` in `core/lib/` (task 0) · the shared key guard (promoted from the meeting flow; the plan names its shared path).

**Modify:** `ui/views/trade-scene-view.tsx` (stage regions, full-size canvas, panel-tabs provider) · `ui/components/scene-stage.tsx` (measured shape, `data-shape`) · `ui/components/home-scene-canvas.tsx` (overlays in the visible rectangle) · `ui/components/callout-pin.tsx` (leader switch by visible width) · `ui/components/panel/thermal-legend.tsx` · `ui/components/panel/scene-panel.tsx`, `panel-header.tsx`, `home-tab.tsx` / `home-facts.tsx` (split), `savings-tab.tsx`, `segmented-field.tsx` (slim size), `cut-override.tsx`, `cool-roof-chip.tsx` · `ui/components/dock/scene-dock.tsx` (rebuilt as the strip) · `ui/components/home-kit/home-camera-rig.tsx` · `shared/components/scene/ui/camera-rig.tsx` (optional `visibleArea`) · `lib/scene-savings.ts` (repairs fold extracted) · `lib/scope-chip-options.ts` (grouping replaced by `part-offers`) · `lib/scope-preview-patch.ts` (Today branch removed) · `constants/home-scene-copy.ts` · `constants/panel-tabs.ts` (`PANEL_TABS` gains `living`; `PanelTab` follows; `types.ts` gains the panel-state types) · `constants/scene-control-icons.ts` (`PANEL_TAB_ICONS` gains `living`, or `tsc` fails) · `meeting-flow/hooks/use-meeting-flow-keys.ts` (uses the shared guard) · `src/shared/modules/construction/core/lib/assemblies/roof-attic/infer-existing-conditions.ts` (uses `roofFormOf`) · `scripts/verify-trade-scene.ts`, `scripts/verify-construction-model.ts` (and the new `scripts/verify-trade-scene-layout.ts`) · `CONTEXT.md` (Dock, Scene panel and Rail entries when this ships).

**Delete** (each with every consumer moved first): `ui/components/panel/view-toggle.tsx`, `panel-rail.tsx`, `rail-popover.tsx`, `panel-tabs.tsx`, `panel-collapse-button.tsx`, `upgrades-tab.tsx`, `scope-chips.tsx`, `scope-chip-group.tsx`, `savings-on-build.tsx`, `bill-field.tsx`, `bill-savings.tsx`, `repairs-line.tsx` · `money-field.tsx` becomes `unit-number-field.tsx` (percent only) · `ui/components/dock/view-picker.tsx`, `weather-picker.tsx`, `dock-button.tsx` · `ui/components/scene-popout-content.tsx` (if the dock no longer needs it) · constants `RAIL_POPOUT_CLASS`, `SCENE_POPOUT_COLLISION_PADDING`, `SCOPE_CHIP_CLASS`, `PANEL_COLLAPSE_ICONS`, `SAVINGS_COPY.showBuild`, `PANEL_COPY.workHint`, `DOCK_COPY` keys for the pop-outs, the rail labels. The plan runs `grep -rn` on each before deleting.

**Off limits:** DAL, `src/trpc/`, `src/shared/db/`, seeds, entity services; the construction module except task 0's files and `roofFormOf`'s one call site.

## 9. Sequencing with the epic session (D20, D26)

TS3b.3 Tasks 1–8 are committed (913ac94f3..a494df01f); its whole-branch review remains. This build runs as one phase (D26): the card mounts floating over the full-size canvas from the start.

| Owner | Files |
|---|---|
| **This build** | everything under **Create** in §8; `ui/components/panel/*`; `trade-scene-view.tsx`, `scene-stage.tsx`; `scene-control-icons.ts`, `panel-tabs.ts`, `scene-controls.ts`, `scene-popouts.ts`; the construction-core files of task 0; the meeting-flow key guard |
| **Epic session, until it says its TS3b.3 review is done** | `ui/components/dock/*` (existing files), `ui/components/home-kit/*` (incl. `home-camera-rig.tsx`), `home-scene-canvas.tsx`, `callout-pin.tsx`, `constants/home-geometry.ts`, `constants/home-anchors.ts`, heat, pins, resolve, and `shared/components/scene/ui/camera-rig.tsx` |
| **Shared, each session its own hunks** | `constants/home-scene-copy.ts`, `scripts/verify-trade-scene.ts`, `CONTEXT.md`, the epic tracker, and any `constants/` file (the epic session's tuning may touch them): `git diff <file>` before staging |

Order inside this build:

0. Main merged into the branch (D24). `CONTEXT.md` was committed (2eb52636a), so the merge can start.
1. Task 0 (construction core), the pure `lib/` mappers, the field primitives, the tabs, the panel state and the stage's shape; then the card, knob and build switch floating over the full-size canvas.
2. **The epic session's yes** (its TS3b.3 review is done). Then: the camera frames the visible area (§4.1), the overlays follow it, the dock becomes the strip, the feature's `HomeRoofForm` moves onto core's `RoofForm`, and `HOME_FRAMINGS`, the callout offsets and `TALL_BELOW_ASPECT` are retuned for the visible area by screenshot. Until the camera task lands, the house sits at the canvas centre with the card over its left side.
3. Each commit is by explicit pathspec after `git diff --cached --name-only`; neither session stages the other's files; a conflict is resolved by reading the other session's change, never by reverting it.

**Global constraints the plan must carry:** commit by explicit pathspec only, with a 300 s timeout on `git commit` (the pre-commit hook runs ~110 s); no stash, reset, `checkout --`, amend or push; never stage `CONTEXT.md`, the tracker or `scripts/verify-trade-scene.ts` while the other session has them dirty; `pnpm tsc` and `pnpm lint` only, never `pnpm build`; no DB writes (Playwright login with `as=`, never `role=`); never revert the other session's edits.

## 10. Out of scope and follow-ups

- **R78 condition per material**: a brainstorm, then a model in the epic; the Current materials tab is its home.
- **R80 stories and garage**: modeled in the scene; the Structure tab is their home.
- **Exterior paint** as a home fact (TS3b.4); then its upkeep row's note reads from it.
- **Cool roof folded into the roof's base cut** (EI-D25/EI-D26): the epic's work; D22 only places the toggle.
- **A wood-shake tear-off rate** in the scope pricing calculator.
- **The owner's copy pass** for every **new** string above, the R-value wording, and "Running and keeping up this home today".
- **Promote the field primitives** to `shared/components` if another surface adopts them.
- **CONTEXT.md on ship:** the Scene panel, Rail and Dock entries rewritten for the card, knob and strip (Knob, Scene visible area and Scopes and addons entered 2026-10-23, D27).
- **The `addOns` name clash (D27):** the scene input `addOns` holds bill-cut add-ons (today cool roof), while Notion's addons are rows in the scopes database (air sealing, radiant barrier) that the scene holds in `proposedScopeIds`. Rename `addOns` when the epic next touches it.
- **The query toolbar's own key guard** (`use-toolbar-shortcuts.ts`) could adopt the shared guard; outside this spec.
- **R50 (TS3b.4)** needs an offered-work rule per part; `SCOPES_BY_EXISTING_ROOF` covers the roof only.
- The no-3D fallback stills are recaptured once TS3b.3's Complete home lands (already open in the epic).
