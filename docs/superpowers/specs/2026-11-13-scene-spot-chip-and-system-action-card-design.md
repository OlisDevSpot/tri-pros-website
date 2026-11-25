# Trade scene: spot chip, system action card, camera and quick summary

Date: 2026-11-13 · Branch: `feat/scene-layout-lab` (worktree `.worktrees/scene-layout-lab`, dev `:3003`) · Prototype (approved): https://claude.ai/artifact/RQnLSzmd2JhWJ7kGXYkz3v (study A, version 7)

## 1. Goal

In the owner's words, from a home visit: *"I wanted to show different colour options. I was at a specific camera angle and wanted to alter a system, and it auto-panned to the system view. That gets annoying if I want to keep the current angle. I want to quickly alter portions of the system that were already chosen."*

So the scene must:

- **Leave the camera alone unless the rep asks.** Picking a system never moves the camera. Focus and Look inside are explicit actions.
- **Allow quick edits in place.** Tap a part of the house and a chip opens at that spot. Its pencil turns it into quick edits for the side being shown: Today edits what the home has, and Build edits only the picks already made.
- **Make the system action card the entry point for a system.** It is titled "Walls system" and carries the system's actions (Focus, Look inside, and later documents, warranties and spec sheets).
- **Use the drag gestures of a map.** Drag pans and Shift + drag spins, and the cursor says which one a drag will do.
- **Show a quiet summary for the homeowner** of what the scene shows: the weather, its outside temperature, and Thermal.

It must also fix two bugs. The window Look inside ghosts the left front window. The chip for windows and walls opens away from where the rep tapped.

## 2. Decisions already made

| # | Decision | Source |
|---|---|---|
| D1 | Picking a system (rail chip, chip name, house tap) never moves the camera. **Focus** in the system action card frames it, the way a pick does today. | Owner, item 1 |
| D2 | The attic and the foundation open the house to Partly open when picked, because they cannot be seen otherwise. Focus still frames them. | Owner, items 1–2 |
| D3 | The foundation is tappable on the house, like the attic. | Owner, item 2 |
| D4 | The chip is study **A**: it grows into a panel. At rest it shows the system name, a pencil, and an "open the card" icon on the name. In quick edit the pencil becomes ×. | Owner pick, studies page |
| D5 | Quick edit shows **only the side the scene shows**. Today shows the home's materials and their inputs. Build shows only the picks already made, with their options. If the build has nothing for the system, it shows an empty state with a way into the card. | Owner |
| D6 | **No "system" on the chip.** The card title says "<Name> system". The card loses its "Showing today / the build" badge. | Owner |
| D7 | Focus and Look inside are **actions**: a row of pressed-state buttons under the card's title. Look inside replaces the full-width button and "Back to the system". | Owner, item a |
| D8 | The card is the hub for everything about a system: actions, facts and documents. Each subject (system, yard, Year built) supplies its own actions. Yards already have draw actions in the layout lab and join the same row. | Owner |
| D9 | **Nothing is drawn on the scene to show what is tappable.** No hover boxes. The tap mark (a small ring at the hit point) and its line to the chip stay. | Owner |
| D10 | The chip **stays where it is placed.** It is pinned beside the hit point, with its name row level with the point. It grows only down and outward from its pinned top corner. It lifts at most once, when quick edit opens, and only if the folded panel would not fit. A fold that opens later never moves it; past the room left, the panel scrolls. A pick never resets that scroll. | Owner, rounds 3–5 |
| D11 | **Drag pans, Shift + drag spins.** The cursor is a four-way move over the scene, a pointer over a tappable part, a closed hand while panning, and a spin cursor while Shift is held or while spinning. **iPad:** one finger pans; two fingers pinch to zoom and drag to spin. | Owner, rounds 4–5 |
| D12 | **Quick summary**, top left: the weather icon, the outside °F, and a flame while Thermal is on. No home-view icon, and no labels (hover and aria give the words). It is a glance for the homeowner, not a control. It stays mounted and swaps only what changed: a ticker roll for the value, the slot easing to its new width, and the flame entering by width. Nothing scales. | Owner, rounds 5–7 |
| D13 | **Build on `feat/scene-layout-lab`**, so the yards get the actions row now. The lab already holds the foundation head `b9e603525`. Line references in this spec were read on that head; re-grep in the lab before editing. Another session commits texture work on this branch, so use the shared-tree rules. | Owner |
| D14 | Heating & cooling keeps opening the house when picked, as the attic and the foundation do. | Owner |
| D15 | Glossary words agreed: **spot chip** (the chip at a tapped spot), **quick edit** (its edit state), **system action card**, **quick summary**, **Focus** (the card's camera action). They go into `CONTEXT.md` and the code names. | Owner |
| D16 | **The card's room follows the open card, not the camera.** Opening any system action card (system, Year built, yard) narrows the scene visible area so the picture slides aside and the card never covers the house; closing it slides back. The angle and zoom never change on a pick; only Focus and Look inside change them. | Owner, stress test 2026-11-13 |
| D17 | **Honest names.** "Focus" is only the camera's (`cameraFocus`, `focusCamera`). What the code calls `focus` for the open card becomes the **pick** (`SystemsFocus` → `SystemsPick`, `focus` → `picked`, `focusSystem` → `pickSystem`, `pressFocus` → `pressPick`, `pressPin` → `pressChip`, Escape step `'focus'` → `'card'`, `SystemCard({ focus })` → `SystemActionCard({ subject })`, `focusCardBottom` → `openCardBottom`). The yard editor's "focus" becomes **selection** (`YardFocusBody` → `YardSelectionBody`, `isFocusableRegion` → `isSelectableRegion`). DOM keyboard focus keeps the browser's word. A rename-only task runs first. | Owner, stress test 2026-11-13 |
| D18 | The quick edit fold is labelled **"Paint wear"** or **"Roof wear"**, never "Wear" alone (Wear is the five-step Condition). | Owner, stress test 2026-11-13 |
| D19 | **No °F in rain**, as §4.6 says, even though Thermal draws rain from winter's outside air (`RAIN_PRESET_WEATHER`). | Owner, stress test 2026-11-13 |

## 3. Content

| Element | Copy source |
|---|---|
| Chip name | `HOME_SYSTEM_LABELS[system]` (`constants/home-scene-copy.ts:174`). `SYSTEM_PIN_LABELS` is deleted. |
| Card title | New `CONTROLS_COPY.systems.cardTitle(label)` → `${label} system`. Year built keeps `CONTROLS_COPY.systems.yearBuilt`. |
| Card actions | New `SYSTEM_ACTION_COPY = { focus: 'Focus', lookInside: 'Look inside' }`. `LOOK_INSIDE_COPY.close` is deleted (the pressed state replaces "Back to the system"). |
| Quick edit side line | `SCENE_VIEW_LABELS` (Today / Tri Pros build), as the card's rows already use. |
| Quick edit groups | Today: `CONTROLS_COPY.systems.condition`, `PAINT_COLOR_COPY`, `GUTTER_COLOR_COPY`, `WEAR_LABELS`, `PAINT_WEAR_LABELS` / `PAINT_WEAR_LEVEL_LABELS`, `COVERING_WEAR_LABELS`. Build: the existing `WorkDetails` copy. |
| Paint wear / Roof wear fold | New `QUICK_EDIT_COPY.wearFold = { 'exterior-paint': 'Paint wear', roof: 'Roof wear' }` (D18). Its summary line joins the levels **in force** (`paintWearInForce` / `coveringWearInForce`, as the fields inside show them): "Cracks moderate · Stains light". |
| Empty build | New `QUICK_EDIT_COPY.nothingInBuild(label)` → `Nothing for ${label.toLowerCase()} in the build yet.` and `QUICK_EDIT_COPY.addInCard = 'Add in the system card'`. Placeholder until the owner's copy pass. |
| Chip buttons (aria) | `QUICK_EDIT_COPY.edit(label)` → `Quick edit ${label}`, `QUICK_EDIT_COPY.done = 'Done editing'`, `QUICK_EDIT_COPY.openCard(label)` → `Open the ${label} system`. |
| Summary words (title / aria only) | `WEATHER_LABELS`, plus the outside °F from `CLIMATE_PRESETS[climate ?? CLIMATE_FALLBACK][weather].outside` with the unit from `READING_COPY.unit`. Rain has none (D19). Thermal: `DOCK_COPY.thermal`. |

## 4. Architecture

### 4.1 Picked vs framed (the root of item 1)

Today one store field, `cameraFocus`, means both "this system's card is open" and "the camera frames it". It is written only in `apply()` (`contexts/scene-controls-context.tsx:53-64`) and read by about fifteen places (code map in §10). The two get split:

- **`pickedSystem: HomeSystemId | null`** (new, in the scene inputs store). This is the system whose action card is open. Every current "focus" press writes it (`pressFocus`, `pressPin`, the rail, the card ×, Escape, a section press). It **never** moves the camera.
- **`cameraFocus`** keeps its name and meaning: the system the camera frames. Only two things write it: **Focus** (sets it to the picked system, or clears it on a second press) and **Look inside** (sets it, because its framing needs it).
- **Releasing focus never moves the camera.** Picking another system, closing the card, or a second Focus press clears `cameraFocus`, and the camera **holds its pose**. Only Recenter (button or R) returns home. Today `focusFraming === null` falls back to `homeFramingFor(aspect)` and glides home (`home-camera-rig.tsx:86`); that fallback moves to the recenter path only.
  - The pose held is the system's **own** framing. When Focus is let go from up close or from the crawl view (whose house closes with the card), the camera glides to that system's own view and holds there. *(Claude's call, stress test: holding the crawl view would leave the camera low at a closed skirt.)*
  - A held pose counts as away from home, so Recenter shows and R works: the rig marks the camera store `moved` while it holds a pose with nothing focused (today Recenter and R key off `moved || cameraFocus !== null`, `controls-recenter.tsx:33`, `use-scene-shortcuts.ts:67`).
  - Every Focus press that sets `cameraFocus` also bumps `recenters`, so Focus after a release and a hand move glides back even though the framing is unchanged (the rig glides only on a framing-key or recenter change, `camera-goal.ts:30`).
  - Recenter also leaves Look inside, as it does today through `apply`; the card stays open.
- **Focus pressed state:** `cameraFocus === pickedSystem && !moved`. Moving the camera by hand un-presses it.
- **The card's room (D16).** `scene-stage.tsx:37-40` reserves the card in the scene visible area only while `cameraFocus` is set; it reserves it while any system action card is open instead (`openCardBottom`). The card measures its own bottom today (`system-card.tsx:77-83` → `SystemCardBottomProvider`), so this is the stage reading the measured bottom whenever it is non-null.

Who follows which:

| Reader | Follows |
|---|---|
| `SystemsSection` / card / rail chip pressed | `pickedSystem` |
| `house-open.ts` opening list (attic, foundation, heating & cooling: D14) | `pickedSystem`, or a chip of that system in quick edit (§4.3) |
| `house-open.ts` closing list (windows, walls) | `pickedSystem`. Their parts stand in the Complete house's front wall; this is a view change, not a camera move. |
| Camera rig framing, FocusPing, reading-label anchors, Recenter's `systemHeld` | `cameraFocus` |
| `scene-stage` card inset (`openCardBottom`, D16) | the open card's measured bottom |
| Look inside `lit`, `leaveLookInside` / `keepLookInside`, `escapeStep` | `pickedSystem` + `lookInside` (Look inside sets `cameraFocus` too) |

`HOUSE_OPENING_SYSTEM_IDS` gains `'foundation'`. The crawl framing (`CRAWL_FRAMING` when the foundation is raised and the house open) still comes only through Focus.

### 4.2 Taps, spots and the foundation (items 2, ii)

- **The hit point is kept.** `spotTap` (`home-kit.tsx:324-330`) forwards R3F's `event.point` with the spot. `tappedSpot` becomes `{ spot, point: Vec3 }`. The chip and the tap mark anchor to that world point through the existing `SceneAnchor` + `ScenePinsProjector`, so they follow the house when it pans or spins. That fixes bug ii for every window, wall face and roof slope with no per-part table. `spotPinPoint` and its fixed points are deleted.
- **Spots cover every system, not only the ones with Look inside.** `SPOT_OF` is keyed by `HomeSystemId`. A new `'foundation'` spot is wired to `<Foundation>`'s meshes (skirt and raised wall) through `spotTap`. `systemsAtSpot` still lists roof + attic (attic only when reachable) for the roof spot.
- **The point rides the part's own group.** The house's parts sit in the lift group (`home-kit.tsx:371`), but a ground condenser sits in `groundLevel` (`:357-361`). `tappedSpot` records which (`rides: 'lift' | 'ground'`), the point is stored in that group's space, and the anchor is mounted inside that group, so it follows the house when a foundation change lifts it.
- **One anchor per tap.** A tap registers one `SceneAnchor` for its spot (keyed by spot, as `spotPinId` keys pins today), and one chip host renders the systems at that spot. The host is keyed by the tap's id, so a second tap on the same spot places a fresh chip.
- **Two systems at one spot** (roof and attic) show two chips stacked one step apart, as pins do today (`STACK_STEP_REM`). Quick edit on either hides the other until × closes it. *(Claude's call; the studies page did not exercise it.)*

### 4.3 The spot chip

Feature-local, in `ui/components/spot-chip/`:

- `SpotChip`: the container. It owns placement, the pinned corner and the size animation.
- `SpotChipHead`: the name button (opens the card), the pencil / × button.
- `QuickEdit`: picks the side, then renders `QuickEditToday` or `QuickEditBuild`.
- `QuickEditToday`: one section per material of the system (`systemMaterialIds`, plus the gutters and air-sealing riders as the card does). Each section has the material's option pick (`ChoicePill` over `slot.options`) and its groups.
- `QuickEditBuild`: one section per **picked** row only. Each has the picked way (a `ChoicePill` when the row has several scope ids), `WorkDetails`, and the row's upgrade switches.
- `WearFold`: the disclosure row that holds `PaintWearFields` / `CoveringWearFields`.

**One source for a material's inputs.** The `{ id, header, body }` group list that `ExistingChip` builds inline (`existing-chip.tsx:64-91`) moves out. Its ids and rules go to `lib/material-input-groups.ts` (`materialInputGroupIds`), with the condition group split in two: `condition` (the `WearDots` / `GutterWearDots`) and `wear` (`PaintWearFields` / `CoveringWearFields`, today nested inside `ConditionMenuGroup` at `:85-90`). One component, `MaterialInputGroup({ id, … })`, renders a group's body with no header or wrapper. `ExistingChip` wraps `condition` + `wear` in its `ConditionMenuGroup` as today, and `QuickEditToday` shows `condition` directly and `wear` inside the Paint wear / Roof wear fold. The card, the chip and Modify cannot drift.

**The system's lists are shared too.** The today list (the system's materials plus the gutters and air-sealing riders, `system-card-body.tsx:43-47`) and the build entries (the picked rows, their `WorkDetails` kind and their switches, `:49-51`, `:109-117`) move to helpers that both `SystemCardBody` and quick edit read. The leaf inputs (`WearDots`, `PaintColors`, `ShingleColors`, `FrameColors`, `GutterColors`, `GutterWearDots`, `PaintWearFields`, `CoveringWearFields`) already read and write the store themselves and have no menu coupling, so they are reused as they are. `WorkDetails` already renders outside a menu (Modify, `modify-result-row.tsx:133`).

**Placement**, as a pure function `spotChipPlacement({ point, free, widest, foldedHeight, current })` in `lib/`, so it can be checked without a browser:

1. On first show: the side is right of the point if the chip at its widest fits, otherwise left, otherwise centred below the point. The chip's width is the smaller of its widest and the free width. The top is `point.y − nameRowHalf`, clamped into the stage's free region. The free region is the stage minus the dock, the bottom band, the systems rail's band and the open card's measured box. ⚠️ `useSceneVisibleArea` alone is not that region: it never reserves the rail (`scene-visible-area-for.ts:25-46`). Placement runs once the projector has placed the anchor (its first `data-anchored`); before that the anchor sits at the stage's top-left (`scene-pins.tsx:36-50`).
2. On quick edit opening: `top = min(top, freeBottom − foldedEditHeight)`, done once, animated with the size change.
3. Afterwards: the top and the side are fixed. `maxHeight = freeBottom − top`, and the body scrolls.
4. The line runs from the mark to the chip's near edge, at the point's height clamped into the chip's span.

**Motion** (motion/react, already in the app):

- Width and height animate explicitly (`animate={{ width, height }}` from measured values, `CONTROLS_EASE`, ~260 ms). The content is laid out at its final size from the first frame, so nothing reflows mid-animation.
- **No `layout` prop and no scale.** `layout` animates by scaling, which smears text.
- Quick edit's rows rise in a short stagger only on open.
- Reduced motion: instant.

**Closing:** tapping empty scene, Esc (it steps: fold → quick edit → chip), picking another part, or any press that opens a card (a rail chip, a key, the chip's name). Closing the Systems section by its tap-away leaves the chip alone, because that tap-away runs after the house tap that opened it. **Esc order** in `escape-step.ts`: value menu → drawing → fold → quick edit → chip → Look inside → card → section.

**Inside the chip, the name button** is 16 px at `font-bold` (700): lint stops weights there (`eslint.config.js:225-243`), so the prototype's 800 is not used.

**Attic and foundation in quick edit** open the house while the chip is in quick edit (D2 holds for the chip too). Picking them from the chip's name opens the card and keeps it open.

**Inside the chip, `UpgradeSwitch`'s "reason" path** (a `ProposedChip kind="reason"` popover) still opens its popover, portalled to the stage as today. *(Claude's call; acceptable inside a panel.)*

### 4.4 The system action card (item a)

- `SystemCard` → **`SystemActionCard`** (file `system-action-card.tsx`). In the lab it already serves systems, yards and Year built (`system-card.tsx:39-112`). `data-system-card` stays for scripts.
- The title is `cardTitle(label)` for a system. A yard keeps `YARD_LABELS[yard]`, and Year built keeps its label. The badge and `CONTROLS_COPY.systems.showing` are deleted. The dimmed row and the blue "Tri Pros build" heading already say which side is shown.
- **The actions row** sits under the title. `systemActions(subject, state, run)` in `lib/` returns `{ id, label, pressed, run }[]`; the icon comes from `SYSTEM_ACTION_ICONS[id]` in the component, so `lib/` stays free of React:
  - Systems: Focus, plus Look inside where `canLookInside`.
  - Year built: none.
  - Yards: **Draw a region** and **Draw a fence** (their existing copy), moved out of the yard card's body (`yard-card-body.tsx:107-114`, `LOT_COPY.drawRegion` / `drawFence`, `startDrawing(editor, 'ground' | 'fence')`). The in-row "add by drawing" chips stay in the rows. A yard's selection stays in the layout editor (`yard`), with no camera view, so a yard has no Focus.

  It renders `SystemActionButton`s with `aria-pressed`, styled by a new `CONTROLS_CLASSES.actionButton` modelled on `railChip` (the controls' own pressed look, `aria-pressed:bg-muted inset-ring-primary`), not shadcn's `outline`. No overflow menu until a subject has more than three actions.
- `LookInsideButton` is deleted. `LookInsideBody` (peel + parts) stays below the rows while Look inside is pressed.

### 4.5 Camera input and cursors (items 3, D11)

- **Shared `CameraRig`** (`shared/components/scene/ui/camera-rig.tsx:240-253`) gains a prop `gestures: 'orbit-first' | 'pan-first'`, default `'orbit-first'` (today's three-stdlib defaults). The trade scene passes `'pan-first'`: `mouseButtons = { LEFT: PAN, MIDDLE: DOLLY, RIGHT: ROTATE }` and `touches = { ONE: PAN, TWO: DOLLY_ROTATE }`. three-stdlib's `OrbitControls` already rotates on a PAN button with Shift, Ctrl or Cmd held (verified in the installed copy), so no handler is custom. Other rigs (the roof-cutaway lab, look-dev) are unchanged.
- **The cursor** is derived from one small state, `{ overPart, shift, dragging: 'pan' | 'spin' | null }`, and set on the canvas element:
  - Over a tappable part: `pointer`.
  - Elsewhere: `move`.
  - While panning: `grabbing`.
  - While Shift is held or while spinning: the spin cursor. The spin cursor is an SVG in `public/cursors/spin.svg` with a hotspot at its centre and an `ew-resize` fallback.
  - Over the chip, the card or a control: their own cursors.

  `overPart` comes from `onPointerOver`/`onPointerOut` on the groups that already carry `spotTap` (in `house-shell.tsx`, `house-roof.tsx`, `condenser-unit.tsx` and `foundation.tsx`). It is kept in a ref owned by `useSceneCursor`, never in the canvas's state, so a hover never re-renders the house. `shift` comes from keydown/keyup on `window` (the canvas cannot hold keyboard focus), and is cleared on blur. The cursor is written on the element OrbitControls listens on (R3F's `events.connected`). Touch devices show no cursor. While the lot is drawing, the draw bar's cursor wins. *(The spin cursor's drawing is Claude's; the prototype shows it.)*
- The `mouseButtons` / `touches` maps are constants in `shared/components/scene/constants/` (`CAMERA_GESTURE_MAPS`), and `gestures: 'pan-first'` with panning disabled throws, as the rig's provider guard does.
- The double-tap "look at this spot" (`useSceneTaps`) and the wheel router are unchanged.

### 4.6 Quick summary (item 4)

- `SceneSummary` in `ui/components/scene-summary/`, top left of the stage, clear of the nav. It is read-only (no buttons) and has `aria-label` such as "Summer, 100°F outside, thermal on".
- **Surface:** the feature's read-only overlay look, `bg-scrim/70 text-on-media` (as `panel/thermal-legend.tsx:25`), not a translucent card with muted text: over a summer sky that falls below the contrast floor.
- **Content:** the weather icon (`normal` cloud-sun, `summer` sun, `winter` moon, `rain` cloud-rain), then the outside °F, then the Thermal icon (`THERMAL_ICON`, as the dock draws it) while Thermal is on.
- **Temperature:** `outsideTemperature(state)` in `lib/` reads `CLIMATE_PRESETS[climate ?? CLIMATE_FALLBACK][weather].outside`, and returns null for rain (D19). It is the summary's seam only. ⚠️ The scene itself reads `CLIMATE_PRESETS` in several places (`resolve-scene.ts:93`, `home-kit.tsx:279`, `thermal-walk.ts:34`); the property-enrichment work must replace those too.
- **Corner:** top left of the stage. In the layout lab the lab badge already stands there (`property-layout-lab-view.tsx:86`); the summary sits to the badge's right there. *(Claude's call.)*
- **Motion:** each value sits in a slot. A change rolls the old value up and out (out of layout at once) and the new one up into place, with opacity and 8–10 px of movement only. The slot's width eases from old to new (~320 ms), so the flame slides with it. The flame enters and leaves by width + opacity. The pill stays mounted, its edge follows its contents, and nothing scales. Reduced motion: instant.
- **Alignment:** one 20 px row; icons 18 px `display:block`; the number `line-height:1` with `text-box: trim-both cap alphabetic`; the flame nudged up 0.5 px to centre its bottom-heavy drawing (measured in the prototype).
- **Portrait and narrow:** hidden while any system action card (a system, Year built or a yard) spans the top.

### 4.7 Window Look inside ghost (bug i)

Root cause, verified (regression from `890d24fca`, 2026-11-07): when Look inside moved to the front wall's right window, only that window's pieces got `LOOK_INSIDE_WINDOW_TAG` (`overFront`). The left front window still sits in the Complete-only front-wall groups, so `systemPartOpacity` (`lib/system-part-opacity.ts:11`) ghosts it to 0.15 (glass ≈ 0.05).

The fix: tag the plain front-window groups the same way. In the lab these are `house-shell.tsx:264` (frame) and `:281` (glazing); `:220` and `:231` are the side walls' groups and stay as they are. Rename the tag to say what it now covers, for example `FRONT_WALL_WINDOW_TAG`, and fix the two comments that say "the windows' framed window".

## 5. Data access

**None.** The scene is client state only (no tRPC, DAL or schema in `src/features/trade-scenes`). `pickedSystem` and `tappedSpot.point` live in the scene inputs store. Nothing for the owner to run first.

## 6. Error handling and edge cases

- **The hit point goes off screen or behind the camera** after a pan or spin: the chip and the mark hide, and come back when the point does. ⚠️ The projector reports only "behind the camera" (`scene-pins-projector.tsx:24`, `z > 1`); the chip host hides itself when its anchor leaves the stage. A point hidden behind the house's own walls is not detected, and the chip stays (no occlusion test).
- **A tap on a part whose system is in Look inside:** taps are ignored while `lit`, as today.
- **The foundation type is unset:** Today quick edit shows the `MissingChip` choice (raised / slab). Build shows "Nothing … yet".
- **A slab foundation** has no crawl space: Today shows "Slab"; Build has no crawl insulation (the existing `noneOnSlab` note).
- **Today / Build flips while quick edit is open:** the panel re-renders for the new side. Its pinned corner stays, the fold resets, and the lift rule (D10 step 2) re-runs only if the new folded height does not fit.
- **The card opens while a chip is open:** the chip closes. The card can never sit under a chip.
- **A narrow or portrait stage:** the chip's free region excludes the top-spanning card. If neither side fits, the chip centres under the point, clamped into the free region, at the free width when that is narrower than the chip (390 px portrait leaves 272 px).
- **Thermal on in Rain:** the summary shows the flame and the rain icon, with no temperature.

## 7. Verification

**Pure checks** in `scripts/verify-trade-scene.ts`:

- The `spotChipPlacement` cases: the right side, the left side near the dock, the lift-once rule, and that the top never changes when the reserved height grows.
- `houseOpen` with `pickedSystem` = attic / foundation / windows, and with a chip in quick edit.
- Releasing focus leaves the camera's goal untouched.
- `systemActions` per subject (a system with and without Look inside, a yard, Year built).
- `systemPartOpacity` for front-wall frame and glazing tagged and untagged (bug i).
- `outsideTemperature` per weather and per climate, including rain → null.
- `materialInputGroupIds` parity with today's `ExistingChip` groups, with `condition` and `wear` split.
- The held pose counts as away from home (Recenter shows), and Focus after a release re-glides.
- The Paint wear fold's summary reads the levels in force.

**Rendered checks: few and gated.** Never sweep the scene in a software-rendered browser; it crashed the machine. Follow the existing SDD shot recipe with `.superpowers/heavy.lock`, one batch only, iPad landscape 1194×834 dark, on the owner's dev server (`:3003`, only if it is running):

1. A wall tap → a chip at the point, and its quick edit.
2. The Paint wear fold open: the name row is in the same place as in shot 1.
3. The left front window solid during the window Look inside.
4. The summary in Summer + Thermal.
5. The action card: "Walls system", the actions row, no badge.

Plus `pnpm tsc`, `pnpm lint`, and the owner's hands-on check on the iPad: one-finger pan, two-finger spin and pinch, the chip pinned while panning.

## 8. Files

**Create**
- `ui/components/spot-chip/spot-chip.tsx`, `spot-chip-head.tsx`, `quick-edit.tsx`, `quick-edit-today.tsx`, `quick-edit-build.tsx`, `wear-fold.tsx`
- `ui/components/controls/system-action-card.tsx` (replaces `system-card.tsx`), `system-actions-row.tsx`, `system-action-button.tsx`
- `ui/components/scene-summary/scene-summary.tsx`, `summary-slot.tsx`
- `ui/components/controls/material-input-group.tsx`, `hooks/use-scene-cursor.ts`
- `lib/material-input-groups.ts`, `lib/spot-chip-placement.ts`, `lib/system-actions.ts`, `lib/outside-temperature.ts`, `lib/resting-framing.ts`, `lib/scene-cursor.ts`
- `public/cursors/spin.svg`

**Modify**
- `types.ts` (`pickedSystem`, `tappedSpot` shape), `constants/home-scene-defaults.ts`, `constants/home-systems.ts` (`HOUSE_OPENING_SYSTEM_IDS` + foundation, `SPOT_OF` over all systems), `constants/home-scene-copy.ts` (§3)
- `contexts/scene-controls-context.tsx` (`apply` writes `pickedSystem`; new `focusCamera`, `toggleLookInside`), `lib/controls-press.ts`, `lib/house-open.ts`, `lib/escape-step.ts`, `lib/systems-at-spot.ts`, `lib/system-part-opacity.ts` (comment), `constants/look-inside.ts` (tag name)
- `ui/components/home-kit/home-kit.tsx` (`spotTap` forwards the point; foundation spot; pointer over/out), `home-camera-rig.tsx` (null framing holds; gestures prop), `house-shell.tsx` (bug i tags), `home-scene-canvas.tsx` (chip layer replaces pin layer)
- `ui/components/controls/system-card-body.tsx` (actions out, LookInsideButton out), `yard-card-body.tsx` (the draw buttons move to the actions row), `existing-chip.tsx` (groups from the hook), `systems-section.tsx`, `systems-rail.tsx`, `controls-recenter.tsx`, `ui/lib/leave-look-inside.ts`, `lib/keep-look-inside.ts`, `ui/components/scene-stage.tsx`
- `shared/components/scene/ui/camera-rig.tsx` (`gestures` prop)
- `scripts/verify-trade-scene.ts`
- The D17 renames, across their readers (rename-only, before any behaviour change).
- `CONTEXT.md`: the five terms in D15 plus **Pick**, written at the stress test (2026-11-13). The lab's `CONTEXT.md` already has uncommitted edits from another session; the owner commits it.

**Delete**
- `ui/components/spot-pin.tsx`, `ui/components/home-kit/spot-pins-layer.tsx`, `lib/spot-pin-point.ts`, `ui/components/controls/look-inside-button.tsx`, `SYSTEM_PIN_LABELS`, `LOOK_INSIDE_COPY.close`, `CONTROLS_COPY.systems.showing`

## 9. Out of scope, follow-ups, open questions

**Out of scope**
- Documents, warranties and spec sheets in the card (the row is ready for them).
- The property-enrichment temperature (`outsideTemperature` is the seam).
- A twist-to-spin gesture on the iPad (OrbitControls spins with a two-finger drag; a twist needs a custom recognizer).

**Open, for the owner**
- **Q4:** the empty-build copy and the chip's aria words are placeholders until your copy pass.

## 10. Code map behind §4.1 (for the planner)

**`cameraFocus` writers:** only `apply()`, reached through `openSection`, `close`, `flip`, `focusSystem`, `pickFromPin`, the card ×, Recenter, Escape, and a Systems tap-away.

**Readers:**
- `home-camera-rig.tsx:50-86`
- `house-open.ts`, through `home-camera-rig`, `home-scene-canvas:81` and `scene-burst-key:13`
- `home-scene-canvas.tsx:62,83` (`lit`)
- `scene-stage.tsx:37-40`
- `controls-recenter.tsx:28-33`
- `use-scene-shortcuts.ts:62,123`
- `leave-look-inside.ts:17`, `keep-look-inside.ts:17`
- `reading-labels.tsx:17` / `home-anchors.ts:123`
- `focus-ping.tsx:20`
- `escape-step.ts:22`
