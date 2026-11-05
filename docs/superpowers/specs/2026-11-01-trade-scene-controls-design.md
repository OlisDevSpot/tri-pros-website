# Trade scene controls: the bottom group and one modal

> **Status:** **approved by the owner 2026-11-01** (studies round 12.2, the system's card beside the system). Tracker row **Controls** in `docs/plans/2026-10-16-trade-scenes-epic.md` (R147–R194).
> **Plan rules (owner):** build it to match the approved studies page as closely as possible (sizes, spacing, motion, copy, behaviour), and write no defensive code.
> **What the owner approved:** studies round 12.2 with version B (Version 16), https://claude.ai/artifact/L78TX1prrziGqKSJEGiCsB. A frozen copy is in the repo at `docs/plans/assets/2026-11-01-trade-scene-controls/studies.html`; open it with `assets.js` beside it. Where this spec and the mock disagree, this spec wins only where it says why.
> **Scope:** UI only, feature-local to `src/features/trade-scenes`. No DAL, tRPC, schema or seed change (see §5).
> **Stress-tested 2026-11-01:** the owner's rulings and the plan's corrections are in §10; where §10 and an earlier section disagree, §10 wins.

## 1. Goal

In the customer's home, about 95% of the time on an iPad at the table or a phone on the walk, the rep changes the home's specs fast while the homeowner watches. The scene stays the hero. One small group at the bottom of the scene holds everything:

- **Home facts:** the facts that hold either way.
- **Systems:** a rail of the home's systems; tapping one takes the camera to it and shows only its inputs, today and the build.
- **Modify:** a search for one change.
- **The Today ⇄ Build toggle.**
- **Benefits:** coming soon.
- **Recenter**, which comes and goes.

Home facts, Modify and Benefits open one modal shell. Owner, round 11: *"Should feel and act as native search for scene configurations."* Owner, round 12: the inputs stay hidden unless their system is in focus.

## 2. Decisions already made

These are settled; do not re-open them. The IDs are the tracker's.

| Area | Decision | IDs |
|---|---|---|
| Group | One group at the bottom of the scene where Recenter sits today. Order: Home facts, Systems, Modify, the toggle, Benefits, then Recenter at the right end, which comes and goes. | R160, R175, R194 |
| Group | Icons at rest. Only the open section's name slides open and shut. | R167 |
| Group | Drawn once; only its states change, so nothing jumps. | R169 |
| Group | On the iPad it centres on the scene's middle, the same line the modals centre on. On the phone it is as wide as its contents and centred. | R180, R173 |
| Toggle | One button: swap arrows plus the side's name ("Today" / "Build"). One size on both sides. A tap flips the scene and opens nothing. | R164, R168 |
| Modals | Home facts, Modify and Benefits open one modal shell; Systems is a rail, not a modal. Modify is neutral at rest and wears the primary colour only while open. Every sheet opens above the group, never under or over it. No Done buttons: the head's x closes, and a tap outside closes. | R172, R162, R163, R193 |
| Home facts | Tabs Main home, Household, Area, Lot, drawn like the scene card's underlined sub-tabs, with an amber missing count on each tab. Area and Lot read "soon" where they have no inputs. No tag and no restating lines. On wide frames the tabs sit in the head row, centred on the title's line; the phone keeps them on their own row. | R174, R177, R176, R192 |
| Home facts | Facts hold for both sides: household type, age group, foundation, roof form, coastal or inland. | R159 |
| Systems | Systems opens a rail above the group: Year built, then Roof & gutters, Attic, Windows, Walls, Heating & cooling, Foundation. Nothing else shows until a chip is tapped. A dot marks each system the build changes. | R194 |
| Systems | Tapping a system takes the camera to it and shows one card with only that system's inputs: today and the Tri Pros build, the side the scene is not showing dimmed. **The card sits beside the system** (version B): at the right on the iPad and desktop, with the system brought left of centre; dropping in from the top on the phone, with the system below it. Tapping the system again, the card's x, Escape, Recenter, a tap on the open scene, or opening another section lets it go and returns the camera. | R194 |
| Systems | Year built's card is the era picker and the code line; it does not move the camera. A material set by hand keeps its pick; **Use code** resets them. | R171, R194 |
| Systems | The build side uses quiet chips. Picked work is a solid neutral chip with a small primary check; work to add is dashed with a plus. | R179 |
| Menus | Picks open as a menu anchored to the chip: a list with a check. A material's menu carries its condition dots. | R161 |
| Modify | A search for one change. Autofocused. With nothing typed, it shows only chips for missing facts. The clear x sits inside the field (InputGroup). No Done, no footer, no Undo; it closes with Escape, a tap outside, or Modify again. Focus returns to the search after any change. Escape clears first, then closes. The M shortcut opens it without typing an M. The Missing section slides shut and leaves nothing when the last fact is filled. | R178, R181–R183, R186, R187, R193 |
| Coastal / inland | One value shown in two places (Area tab, Benefits' bills), with shared state. Missing until set. Until then the bills use the inland defaults. | R184 |
| Bills | Default bills come from the climate: inland $200 electric / $100 gas, coastal $155 / $110 a month. | R148 |
| Benefits | Only ever shows the build; tapping it on Today flips to the build first. Large and fixed. Ships as **coming soon** with the bills footer. Its interior is a separate `/ui-exploration` from the matrix. | R166, R185, R188, R189 |
| Parked | The savings bars, cut overrides and the repairs list stay in the code, unmounted, for the Benefits session. | R189 |
| Close-up | Keeps a card until TS3b.4b: the current card shell shows the existing close-up screen while zoomed. | R190 |
| Missing | "Not sure" does not clear a missing fact; only a real value does. | R191 |
| Era | No new rule needed. The era guesses already exist in code: attic `INSULATION_BY_ERA`, plus windows, paint, ducts and crawl via `HOME_MATERIALS[id].eraGuess`. Not sure assumes `ERA_FALLBACK` (1950–1978). | code, 2026-11-01 |
| Persistence | Saving the specs to the meeting waits for TS4. Every write goes through the existing patch functions, so saving plugs in at one place. | R153 |

## 3. Content

All labels come from existing constants in `src/features/trade-scenes/constants/home-scene-copy.ts`, abbreviated **copy** below, unless a row says **new**. New strings go in one new `CONTROLS_COPY` object in the same file, with the existing comment "Placeholder copy until the owner's copy pass." The new strings are the mock's own words.

### 3.1 The group

| Item | Icon (lucide) | Name | Source |
|---|---|---|---|
| Home facts | `House` | "Home facts" | new |
| Systems | `Layers` | "Systems" | new |
| Modify | `SlidersHorizontal` | "Modify" | new |
| Toggle | `ArrowLeftRight` | "Today" / "Build" | `BUILD_SWITCH_COPY.compact` (kept; the rest of that object goes) |
| Benefits | `Sparkles` | "Benefits" | new |
| Recenter | `LocateFixed` | "Recenter" | `SCENE_COPY.recenter` |

- **Toggle accessible name:** "Showing the Tri Pros build; tap to show today", and the mirror on Today (new, from the mock).
- **Home facts:** wears an amber dot while anything is missing. Its accessible name is "Home facts, N missing" (new).
- **Benefits:** no count badge while it is coming soon.

### 3.2 The modal head

Each head has the section's icon in a tile, the title, what sits beside it, and a close button ("Close").

| Section | Beside the title |
|---|---|
| Home facts | The tabs on wide frames; nothing on the phone (the tabs take their own row) |
| Benefits | The tag "Tri Pros build" (new) |
| Modify | No head. The search row takes its place. |

### 3.3 Home facts

| Tab | Fields | Label source | Choices source |
|---|---|---|---|
| Main home | Foundation, Roof form | `PROFILE_COPY.foundationType`; new "Roof form" (the old `STRUCTURE_COPY.roofForm` "Roof" goes) | `HOME_PROFILE_CHOICES.foundationType`; `withUnknown(ROOF_FORMS, ROOF_FORM_LABELS)` |
| Household | Household, Age group | `PROFILE_COPY.householdType`, `.ageGroup` | `HOME_PROFILE_CHOICES.householdType`, `.ageGroup` |
| Area | Coastal or inland (new label; `PROFILE_COPY.climate` goes), then two soon tiles | `CLIMATES` / `CLIMATE_LABELS` (`@/shared/modules/construction/core/constants/climate-presets`) | Coastal, Inland (no Not sure; it is either) |
| Lot | Two soon tiles | | |

- **Tab labels** (new): "Main home", "Household", "Area", "Lot".
- **Each field row:** the label at left; the value at right, or "Missing" (new) in the attention colour with a dot; the choices below as a segmented row.
- **Soon tiles** (new, from the mock):
  - Area: "Utility · LADWP, SCE and the rest." and "Wind · The wind zone the home sits in."
  - Lot: "Lot size, fence, driveway · For fencing and an ADU." and "Landscape and hardscape · For dryscaping."
  - The tab's mark reads "soon"; on the phone it shrinks to a dot.

### 3.4 Systems

**The rail**
- Accessible name "Systems" (new). Chips, in order:
  - **Year built:** a calendar icon, "Built" (new) and the range (`YEAR_BUILT_LABELS`), or "Year built · Not sure" in the attention colour when unset. Then a thin divider.
  - **One chip per system**, labelled by `HOME_SYSTEM_LABELS` in the order `upgradeRows` uses, with a primary dot when the build changes that system.
- The chip in focus is raised with a primary ring. On the phone the rail scrolls sideways with no edge fades, and the chip in focus scrolls into the middle.

**A system's card**
- Head: the system's icon in a tile, its name, the tag "Showing today" / "Showing the build" (new; primary while on the build; hidden on the phone), and a close button.
- Two rows, each with a label and its chips: "Today" and "Tri Pros build" (new). The row for the side the scene is not showing is dimmed, but its chips still work. A pick on the build side while on Today does **not** flip the scene; the toggle alone flips.
- **Today chips:** one per material of that system that the home has (`HOME_MATERIAL_IDS` present in `targets.home`).
  - Text: the option label from `HOME_MATERIAL_OPTION_LABELS`, plus AC tons (`AC_TON_LABELS`), then " · " and the wear (`WEAR_LABELS`). Gutters is its own chip (`GUTTER_LABELS`); a raised foundation's crawl insulation is its own chip under Foundation.
  - Each opens the value menu, with the condition dots for materials that have bands.
  - Choices come from the same sources `material-choices.tsx` uses today, with the same rules: the roof covering is filtered by form, and a flat roof shows a static "Torch down"; equipment only when central; AC size only with AC; ducts exclude R-8 flex.
- **Build chips:** one per upgrade row of that system from `upgradeRows(facts, picks, efficiencyUpgrades)`.
  - Text: the verb (`SCOPES_AND_ADDONS_COPY.verbs[SCOPE_VERBS[…]]`) or `PART_LABELS`. Efficiency upgrades are chips too (`EFFICIENCY_UPGRADE_LABELS`, e.g. "Cool roof", "Step up to R-8").
  - A picked scope with variants opens a menu (e.g. Tear-off → shingle line and swatches from `ShingleColors`); others toggle on tap.
  - A blocked row is a disabled dashed chip whose menu shows the blocked reason. A system with nothing to offer shows a hint (new: "Nothing to add on a slab").

**Year built's card**
- Head: calendar icon, "Year built" (new), the tag "Sets today's materials" (new; hidden on the phone), close.
- Choices: `HOME_PROFILE_CHOICES.yearBuilt` (`YEAR_BUILT_LABELS` plus Not sure).
- The era line under them (new):
  - "`<era>` code: R-11 attic · Single pane · Original ducts", or "Not sure, so 1950–1978: …".
  - Built from the era-guess tables and the option labels (`INSULATION_LEVEL_LABELS` and the batt names, `WINDOWS_TYPE_LABELS`, `DUCT_LABELS`).
  - When a material was set by hand: "`<names>` kept as set." plus a **Use code** link (new).

### 3.5 Modify

- **Field placeholder** (new): "Search a change: tile, attic fan, 4 ton…" (phone: "Search a change"). Accessible name "Search a change". The clear button is "Clear search". There is no Done.
- **Empty query:** a "Missing" group (new title) of chips, one per missing fact, each opening that fact's value menu. With none missing, the panel is shut and the modal is the search row alone.
- **Results:** one row per matching slot.
  - Scope tag, one of "Home facts", "Area", "Systems" (Year built), "Today", "Build", "Bills" (new).
  - The slot's name, with an "Enter" key mark on the top row.
  - The current value at the right, or "Missing".
  - Every value as a chip: the current one checked, the Enter target outlined.
  - Bills rows hold a money field ("/mo", `SAVINGS_COPY.billSuffix`) instead of chips.
- **No results** (new): "Nothing matches "`<query>`". Try a material, a system or a value: tile, attic fan, 4 ton."

### 3.6 Benefits (coming soon)

- Body (new): a centred coming-soon state with the title "What the build brings" and "Coming soon" ("Benefits are being designed. The bills below already feed them."). The owner's copy pass may replace it.
- Footer, from the mock:
  - "Based on **`<Coastal|Inland|Area missing>` · $200 electric · $100 gas**".
  - An **Edit bills** / **Close bills** link (new) that opens a row: coastal or inland (the same control as the Area tab), then `SAVINGS_COPY.billLabel('electric')` and `('gas')` money fields, then a source hint (new): "Electric from the inland defaults" or "Electric as typed".
  - No Done.

## 4. Architecture

### 4.1 Composition

`TradeSceneView` changes as follows:

| Removed | Added |
|---|---|
| `PanelTabsProvider` | `SceneControlsProvider` (`contexts/scene-controls-context.tsx`) |
| `SceneCard`, `PanelKnob`, `RecenterChip`, `BuildSwitch` | `CloseUpCard` (renders only while `zoom !== null`), `SceneControls` (the group), `SystemsRail` and `SystemCard`, `ControlsModal` |

- `SceneDock` and `SceneKeysButton` stay.
- The modal, the rail, the system card and every menu portal into (or render inside) the stage element, not `document.body`. They are placed against the scene the way the mock places them, and the scene's shortcut guard (`isUnclaimedKey`, which drops keys from outside the stage) keeps working while a modal is open.

`SceneControlsProvider` holds UI state only (React state; nothing in the inputs store):
- `open: 'facts' | 'systems' | 'modify' | 'benefits' | null`
- `factsTab`
- `query` (Modify's text)
- `billsOpen`

It exposes `openSection(id)` (pressing the open section closes it), `close()`, `setQuery`, `setFactsTab` and `toggleBills`. Benefits' `openSection` writes `view: 'proposed'` first when on Today (R166).

The system in focus is **not** UI state: it is the inputs store's `cameraFocus` (§4.6), because the camera rig already reads it. Closing Systems, or opening any other section, clears it.

### 4.2 The group: `ui/components/controls/`

**`scene-controls.tsx`**
- A pill (`rounded-full`, the scene's glass surface; the same glass the dock uses today), 5 px padding, 2 px gap, at `bottom: 16` (phone 10).
- Centre at the stage's centre: `left: 50%; translateX(-50%); width: max-content`. The `max-content` stops the pill being squeezed at `left: 50%`, the mock's phone fix.
- On wide shapes, a 1 px divider sits either side of the toggle; on the phone there are no dividers.

**`controls-section-button.tsx`**
- 44 px tall, min 44 px wide (phone 40), `aria-expanded` when open.
- The name sits in an inline grid whose `grid-template-columns` animates 0fr → 1fr (300 ms, `cubic-bezier(.2,.8,.2,1)`), with opacity delayed 80 ms. That is the whole name animation: no measuring, no re-render of siblings.
- Open state: raised fill plus a 1 px inset edge.
- Modify's open state uses the primary colour (R162).

**`build-toggle.tsx`**
- Raised fill, swap icon, and the two names stacked in one grid cell (`grid-area: 1/1`), so its width is the wider name's and never changes.
- The flip cross-fades the names (180 ms) and turns the arrows (350 ms).
- `aria-pressed` follows the build side. Keycap `B` on fine pointers.

**`controls-recenter.tsx`**
- Replaces `recenter-chip.tsx`, with the same camera hooks and focus rule: when the camera stops being moved while Recenter has focus, focus goes to the Modify button.
- It also shows while a system is in focus (the camera has moved), and pressing it then clears the focus as well as recentring.
- Its wrapper animates `max-width` 0 → 60 px plus opacity (300 ms), so the pill grows at its right end. Keycap `R`.

**Build tint**
- While the scene shows the build, a 3 px inset primary ring at 0.55 opacity frames the stage (`.m-build-tint` in the mock), fading 250 ms.
- It is drawn by `scene-controls.tsx` as a sibling layer under the group, with `pointer-events: none`.

### 4.3 The modal: `controls-modal.tsx`

**One shell for Home facts, Modify and Benefits**
- Radix Dialog from `@/shared/components/ui/dialog` with `modal={false}`, its own scrim (a plain layer inside the stage: Radix draws no overlay for a non-modal dialog), and the content portaled into the stage.
- Non-modal, because the group must stay usable with a modal open: switch sections, flip the toggle, Recenter.
- `onInteractOutside` calls `preventDefault()` when the target is inside the group or a value menu; any other outside press closes.
- `onOpenAutoFocus` sends focus to the body's first control; for Modify it sends it to the search input. `onCloseAutoFocus` returns focus to the section's button.

**Placement**, in stage pixels. "Band" means the group's top edge plus 12 px.

| Section | iPad / desktop | Phone (portrait shape) |
|---|---|---|
| Modify | `top: 24`, centred, `width: min(780px, stage − 48)`, grows downward, `max-height: stage − 24 − band` | `top: 12`, `left/right: 10` |
| Home facts | bottom at the band, centred, same width, grows upward, same max height | `left/right: 10`, bottom at the band |
| Benefits | `top: 24`, `left/right: 24`, bottom at the band: fixed, never resizes | `top: 12`, `left/right: 10`, bottom at the band |

**Look**
- Surface: the card's tokens as the current scene card uses them (card fill, 1 px edge, 16 px radius, phone 20), with the card's deep shadow.
- Opening rises 8 px and fades in over 220 ms. Switching sections cross-fades the body only; the shell stays.
- Head: icon tile, title, what sits beside it (§3.2), close. Body: scrolls inside (`PANEL_SCROLL_CLASS`'s fade mask, kept). Footer: Benefits only (its bills); no Done anywhere.
- Home facts on wide shapes: the tabs sit in the head, `align-self: center`, 18 px after the title, each trigger 42 px tall so its label shares the title's centre line.

**Modify's shell**
- No head and no footer.
- The search row is `[InputGroup: Search icon | input | clear button]`, full width; no Done.
- Below the row sits the collapsing region (§4.5).

### 4.4 The sections

**Home facts: `home-facts-body.tsx` + `home-facts-tabs.tsx`**
- The tabs use shared `Tabs` with the underline variant and the trigger classes `panel-sub-tabs.tsx` uses today: `gap-5.5`, `min-h-11 px-0 text-sm font-bold`, active border `--presentation-accent`, 15 px icons.
- Those classes move into a `UNDERLINE_TAB_TRIGGER_CLASS` constant before `panel-sub-tabs.tsx` is deleted.
- Each field is a `ChoicePill` (the mock's segmented pill, Not sure inside it) inside a `fact-row.tsx` (label, value or Missing); see §10.

**Systems: `systems-rail.tsx`, `system-card.tsx`** (no modal)
- `systems-rail.tsx`: a glass pill (the group's surface), 5 px padding, 4 px gap, `bottom` = the group's top + 8; iPad and desktop centred on the stage's centre (`translate: -50% 0`, `width: max-content`); phone `left/right: 10`, `overflow-x: auto`, no scrollbar, no edge fades. Chips 40 px tall. `role="toolbar"`, arrow keys rove. It enters with an 8 px rise and fade (220 ms).
- `system-card.tsx`: the card's surface (card fill, 1 px edge, 16 px radius, phone 20, deep shadow), entering with the modal's rise. Placement (version B), in stage pixels:

  | Shape | Card | Where the camera puts the system |
  |---|---|---|
  | Landscape, narrow | `top: 140`, `left` = stage centre + 46, `width: 440` (clear of the dock) | left of centre, at about 30% across and the card's middle height |
  | Portrait | `top: 54` (under the dock strip, or 12 where the dock is beside), `left/right: 10` | centred below the card, about two thirds down |

  - Its parts: `year-built-card-body.tsx` (picker plus era line), `system-card-body.tsx` (the two rows), `today-chip.tsx`, `build-chip.tsx`.
  - A pick inside keeps the card mounted, so its entrance never replays; a new focus remounts it (keyed by the focus).
- **No scrim.** The scene stays bright and the camera stays usable. A tap on the scene outside the group, the rail, the card and any value menu closes Systems (one tap, even with a menu open), as a tap outside a modal does. A drag that turns the camera, a pinch or a long press is not a tap (the shared tap tracker decides).

**Modify: `modify-body.tsx`**
- `modify-search-row.tsx`, `missing-chips.tsx`, `modify-results.tsx`, `modify-result-row.tsx`.

**Benefits: `benefits-body.tsx` + `bills-footer.tsx`**

**Home facts' head:** `home-facts-tabs.tsx` renders into the head on wide shapes and as its own row on the phone.

**The value menu: `value-menu.tsx`**
- The one menu every chip opens (R161), in Home facts, the system card, Modify and the bills.
- A Radix Popover anchored to the chip, collision-aware, portaled into the stage, holding:
  - a `role="radiogroup"` list of choices with a check on the current one;
  - for a material with bands, the existing `WearDots` under a "Condition" label;
  - for a blocked upgrade, the reason text.
- Picking closes the menu and keeps the modal open.
- A Popover, not a DropdownMenu, because the menu holds a radio group and the wear dots, and Radix menus forbid non-item children.

### 4.5 Modify's search

**`lib/scene-change-slots.ts`: `sceneChangeSlots(state, targets)`**
- Returns every change Modify can make, one slot per spec.
- Each slot has: `{ id, scope, name, words, options: { value, label }[], current, isFact, change: SceneChange }`.

**`SceneChange`** is the single write vocabulary, a discriminated union over the existing patch functions:

| Kind | Writes through |
|---|---|
| `property` | `propertyPatch` (`lib/property-patch.ts`) |
| `homeMaterial` | `homeMaterialPatch` (`lib/home-material-patch.ts`; kinds wear, option, era-guess, fact) |
| `scope` | `scopePick` |
| `efficiencyUpgrade` | `efficiencyUpgradePatch` |
| `household` | merge |
| `climate` | set |
| `bill` | `bills[category].now` |

- **One hook, `useApplySceneChange()`** (`hooks/use-apply-scene-change.ts`), applies a `SceneChange` to the store.
- Every control in every section writes through it: Home facts, the system card, Modify and the bills. That makes it the one place R153's saving will attach.
- The existing `useSetProperty` and `useSetHomeMaterial` fold into it. Their callers that survive the migration, `wear-dots.tsx` and `shingle-colors.tsx`, move to it in the same task.

**`lib/search-scene-changes.ts`: `searchSceneChanges(slots, query)`**
- A pure function returning ranked `{ slot, hit }`.
- A slot matches when every query token prefixes a word of its name, scope, synonyms (`words`) or an option label.
- A token matching an option label makes that option the `hit`, the Enter target. Digits match too ("4" → "4 ton").
- A condition word ("worn") lists every material's wear slot.
- Synonyms name the thing, never its values; this was the round-8 fix for "tile" noise.
- Ranking: an exact name first, then a value hit, then the order of `sceneChangeSlots`.

**Keyboard and focus**
- Enter applies the top result's `hit` when it differs from the current value.
- Escape with text clears the text; Escape on an empty field closes, through the Dialog's `onEscapeKeyDown`. When a value menu is open, Escape closes the menu first, which Radix gives for free.
- After any change made in Modify, focus returns to the search input, unless a value menu is still open.
- The M key opens Modify with `preventDefault()`, so no M is typed.

**`collapse-region.tsx`**
- `grid-template-rows` 0fr → 1fr (260 ms) plus opacity.
- While shutting, it keeps showing its last children and clears them on `transitionend`. The Missing group and the results leave with no padding, border or empty box left behind (R186). A `.m [hidden]{display:none}`-style guard is not needed in React.

**`lib/missing-facts.ts`**
- `HOME_FACTS`: the five facts with `{ id, tab, read(state) }`, in tab order.
- `missingFacts(state)`: those whose value is `null` (R191).
- Tab counts and the group's dot read it.

### 4.6 State and the edges that change

| Change | Where | Why |
|---|---|---|
| `TradeSceneInputs.climate: Climate \| null`, default `null` | `types.ts`, `constants/home-scene-defaults.ts` | Missing until set (R184) |
| `CLIMATE_FALLBACK = 'inland'` | `constants/climate-bills.ts` (new) | One fallback for heat and bills |
| `CLIMATE_DEFAULT_BILLS = { inland: { electric: 200, gas: 100 }, coastal: { electric: 155, gas: 110 } }` (dollars a month, as `BillEntry.now` holds them) | same file | R148 |
| `resolveScene` resolves `inputs.climate ?? CLIMATE_FALLBACK` once at its top and passes it to `homeHeat`, the comfort setpoint and `sceneSavings` | `lib/resolve-scene.ts`, `lib/scene-savings.ts` | The selection keeps the raw value, so the shallow compare stays stable |
| `sceneSavings` reads `bill.now ?? CLIMATE_DEFAULT_BILLS[climate][category]` | `lib/scene-savings.ts` | Default bills |
| The draw-side selectors resolve the fallback | `assembly-kit-host.tsx:29`, `home-scene-canvas.tsx:51` (feeds `home-kit` and the reading disclosure) | Heat paint needs a climate |
| `SceneResolveInputs.climate` becomes nullable; `scene-burst-key.ts` unchanged | `types.ts` | |
| `sceneVisibleAreaFor({ shape, w, h, zoomed, band })` | `lib/scene-visible-area-for.ts` | Replaces `collapsed`; see below |
| `dockRegionBottom` and the dock region in portrait: `top: 16`, bottom at the band | `lib/dock-layout-for.ts`, `trade-scene-view.tsx` | The build switch and bottom card are gone |
| Remove `PanelTab`, `PanelTabsState` and `HomeMaterialChange` (it moves into `SceneChange`) | `types.ts` | |
| `TradeSceneInputs.cameraFocus: 'under-floor' \| null` becomes `HomeSystemId \| null` (the keys of `HOME_SYSTEM_LABELS`) | `types.ts`, `home-scene-defaults.ts` | The system in focus; the rig already reads `cameraFocus` |
| `SYSTEM_CAMERA_VIEWS: Record<HomeSystemId, …>`: the look-at point and distance per system, in the home's anchors | `constants/system-camera-views.ts` (new) | A camera view per system (new; today only the crawl's under-floor look exists) |
| `home-camera-rig.tsx` frames `SYSTEM_CAMERA_VIEWS[cameraFocus]` inside the visible area left by the card (§4.4); Foundation keeps today's under-floor look when the home is partly open | `ui/components/home-kit/home-camera-rig.tsx` | Version B puts the system beside its card |
| `hooks/use-crawl-camera-focus.ts` is deleted: the Foundation system's focus replaces it | | |

**The visible area** decides camera framing, the blueprint paper, the thermal legend and the callout pins.
- `right` stays 94 (the dock).
- `bottom` is the group's band on every shape.
- `left` is 0, except while zoomed on landscape and narrow shapes, where it is the close-up card's width plus its gap (today's open-card numbers, 388 / 336).
- While zoomed on portrait, `bottom` adds the close-up card's height (`round(h × 0.46) + 12`).
- While a system is in focus, the visible area excludes its card: on landscape and narrow shapes `right` grows to the card's left edge; on portrait `top` grows to the card's bottom edge. So the camera frames the system beside (or below) the card.
- Modals do not change the visible area; they are passing layers over the scene.

### 4.7 The close-up card: `close-up-card.tsx`

- What remains of `scene-card.tsx` plus the zoomed branch of `scene-panel.tsx`: `<AssemblyScreen zoom />` in the card shell.
- Placement: left on landscape and narrow shapes, as today; on portrait, above the group's band.
- No fold and no knob. Its header action is the existing whole-home button (`back-to-home-button.tsx`, `SCENE_COPY.backToHome`), and Escape still leaves the close-up.
- `// LAZY:` header: replaced by the general system view (TS3b.4b).

### 4.8 Shortcuts

`constants/scene-shortcuts.ts` and the sheet rows:

| Key | Change |
|---|---|
| `/` | Removed (no panel to fold) |
| `m` | Added: open Modify |
| `b` | Stays: flips the toggle. Its focus fallback becomes the toggle button. |
| `escape` | With Systems open: closes a value menu, then lets the system in focus go, then closes Systems. Leaves the close-up only while nothing is open; the Dialog owns Escape while a modal is open |

- 1–4, `v`, `t`, `r` and `?` are unchanged.
- `SHORTCUT_COPY.lines` gains the Modify line (new: "Modify: search a change") and loses the panel line.
- `SceneKeysButton`: in portrait it sits above the group's band instead of following the card.

### 4.9 Responsive

- Breakpoints are the existing stage shapes (`stageShapeOf`): portrait when `h > w` or `w < 600`; narrow when `w < 800`; landscape otherwise. "Phone" above means the portrait shape.
- iPad landscape (1180 × 820) and the desktop dashboard share the iPad placements.
- iPad portrait (820 × 1180) uses the phone placements, with the modal capped at 780 px wide and centred.
- No horizontal scroll. Every hit target is at least 40 × 40 (44 on the iPad).

### 4.10 Motion and reduced motion

- Every duration above uses `cubic-bezier(.2,.8,.2,1)` (the mock's), as Tailwind arbitrary values or motion transitions, matching how the feature animates today.
- The camera's glide to a system uses the rig's existing framing transition.
- Under `prefers-reduced-motion: reduce`, the name slide, Recenter's width, the toggle's flip, the build tint, the modal's rise, the rail's and card's entrances, the body cross-fade and the collapse region all jump with no transition, and the camera cuts instead of gliding.

### 4.11 Accessibility

- The group is a `role="toolbar"` labelled "Scene controls" (new), with arrow-key roving between items.
- Section buttons carry `aria-expanded` and `aria-controls` pointing at the modal.
- The modal is `role="dialog"` named by its section.
- Missing counts are part of each tab's and button's accessible name.
- The results announce through a polite live region: "`N` changes match" (new).
- Value menus are radio groups.

## 5. Data access

- **Reads used as-is:** the scene inputs store (`createSceneInputs(HOME_SCENE_DEFAULTS)`) and `useSceneTargets()`.
- **Writes used as-is:** the store, through the existing patch functions, gathered behind `useApplySceneChange`.
- **Required changes the owner runs first:** none. Nothing touches the DAL, tRPC, schema or seeds.
- **UI adaptations at the edge:** the nullable climate and the default bills (§4.6) are feature-local.
- **Later (R153, TS4):** saving to the meeting will persist `property`, `household`, `climate`, `homeMaterials`, `proposedScopeIds`, `efficiencyUpgrades`, `bills` and `repairsOverrides`. It attaches inside `useApplySceneChange`.

## 6. Error handling and edge cases

**Roof form, covering and cool roof**
- Roof form Flat writes the flat covering through `propertyPatch`, which already trims picks and upgrades that no longer apply.
- The covering menu shows only the coverings of the current form.
- The cool roof's hint chip (`PANEL_COPY.efficiencyUpgradeHints`) appears as a disabled dashed chip with that text in its menu.

**Materials that change shape**
- Changing the HVAC type to a non-central type hides the Equipment and AC size slots.
- The search registry is rebuilt from state on every render, so a hidden slot never matches.

**Year built**
- Picking a year writes only `property.yearBuilt`.
- Materials never set by hand follow the new era's guesses at resolve time; hand-set ones keep their pick.
- **Use code** writes `era-guess` for every material with a recorded option and records nothing else.

**Climate and bills**
- Climate stays missing (`null`) even though heat and bills run on the inland fallback. The bills footer says "Area missing".
- Typing a bill and then clearing it returns it to the climate default.

**Systems**
- Tapping another system moves the camera straight there; the card swaps.
- Turning the camera by hand with a system in focus keeps the card; Recenter lets the system go.
- Zooming into a close-up from a part pin closes Systems.
- A Modify change to a system's spec does not move the camera; only Systems does.

**Benefits on Today**
- Tapping Benefits on Today flips to the build, then opens (R166).
- Flipping back to Today with Benefits open closes Benefits, which only shows the build.

**Close-up**
- A part-pin tap while a modal is open is a tap outside it: the modal closes and the zoom happens (owner, 2026-11-01).
- The close-up card and a section modal can show together on landscape: the card is on the left, and the modal is centred over the scene and draws above the card.
- On portrait, opening a section modal while zoomed hides the close-up card under the modal; it reappears on close.

**Loading**
- The group and modals mount only once the stage has its size, as the card does today.
- During the blueprint load the group is inert and dimmed. The `SceneLoadProvider` phase is read where the card reads it today, if anywhere; otherwise this is new.

**Keyboard**
- Shortcuts are ignored while typing (`isUnclaimedKey`), so letters typed into the search never trigger B, R, V or T.

## 7. Verification

- **Static checks:** `pnpm tsc` and `pnpm lint` only; never `pnpm build`.

**Assertion scripts**
- Rewrite `scripts/verify-trade-scene-layout.ts`, lines 299–355, for the new geometry:
  - drop `pressPanelTab`, `BUILD_TABS` and the build-switch slide;
  - assert `sceneVisibleAreaFor` (landscape: left 0, bottom = band; zoomed landscape: left 388; portrait zoomed: bottom = band + round(h × 0.46) + 12);
  - assert `dockRegionBottom`, the visible area with a system in focus (landscape: `right` = stage width − the card's left; portrait: `top` = the card's bottom), and that the shortcut sheet covers every key including `m` and not `/`.
- Add assertions for:
  - `searchSceneChanges`: "tile" → Roof with hit Tile; "4" → AC size hit 4 ton; "worn" → every wear slot; "attic fan" → Build; no result for a nonsense word.
  - `missingFacts`: the defaults give five; Not sure keeps a fact missing.
  - The default bills: inland and null climate give 200/100; coastal gives 155/110; a typed bill wins.
  - The era line: 1950–1978 gives "R-11 attic · Single pane · Original ducts".
- Run `verify-trade-scene.ts`, `verify-trade-scene-load.ts` (its `HOME_SCENE_DEFAULTS` assertion changes for `climate: null`) and `verify-scene-inputs.ts`.

**Playwright** (local script; auth via `/api/dev/playwright-session`; route `/dashboard/labs/trade-scene`)
- Viewports: iPad landscape 1180 × 820, iPad portrait 820 × 1180, phone 390 × 844, desktop 1440 × 900 with the sidebar.
- At each:
  1. At rest: the group is centred (iPad: its centre within 1 px of the stage's), with no horizontal overflow.
  2. Open each section: the name slides open, and the toggle's x moves by half the name's width (symmetric) on every shape, since the group stays centred.
  3. Systems: the rail shows and no card; tap Roof & gutters: the card sits beside the system (right on the iPad, top on the phone) and the camera frames the roof inside the visible area; flip: the tag changes and the dimmed row swaps; tap Heating & cooling: the camera moves and the card swaps; tap the open scene: Systems closes and the camera returns. No Done button exists anywhere.
  4. Modify:
     - the input is focused on open; M opens it with an empty field;
     - "tile" then Enter sets the roof to tile;
     - fill both missing chips and the region collapses to height 0 with nothing inside;
     - Escape clears, then closes.
  5. Benefits on Today flips to the build and opens large; its box is identical before and after editing a bill.
  6. Tap a part pin: the close-up card shows (left on the iPad, above the group on the phone) and the group remains.
  7. Home facts on the iPad: the selected tab's label centre is within 1 px of the title's.
  8. Reduced motion: the transitions are none.
- The scene is a dark presentation surface. Check once each with the app in light and in dark to confirm nothing leaks.
- **Hands-on:** the owner on the real iPad and phone.

## 8. Files

All paths are under `src/features/trade-scenes/` unless noted.

**Create**
- `contexts/scene-controls-context.tsx`
- `constants/climate-bills.ts`
- `constants/system-camera-views.ts`
- `constants/scene-controls-layout.ts`: the group's and modals' numbers, folded into `SCENE_LAYOUT` if that reads better.
- `lib/scene-change-slots.ts`, `lib/search-scene-changes.ts`, `lib/missing-facts.ts`, `lib/era-code-line.ts`, `lib/apply-scene-change.ts` (pure)
- `hooks/use-apply-scene-change.ts`
- `ui/components/controls/`:
  - group: `scene-controls.tsx`, `controls-section-button.tsx`, `build-toggle.tsx`, `controls-recenter.tsx`
  - modal: `controls-modal.tsx`, `collapse-region.tsx`, `value-menu.tsx`
  - Home facts: `home-facts-body.tsx`, `home-facts-tabs.tsx`, `fact-row.tsx`
  - Systems: `systems-rail.tsx`, `system-card.tsx`, `system-card-body.tsx`, `year-built-card-body.tsx`, `today-chip.tsx`, `build-chip.tsx`
  - Modify: `modify-body.tsx`, `modify-search-row.tsx`, `missing-chips.tsx`, `modify-results.tsx`, `modify-result-row.tsx`
  - Benefits: `benefits-body.tsx`, `bills-footer.tsx`
- `ui/components/panel/close-up-card.tsx`

**Modify**
- `ui/views/trade-scene-view.tsx`, `ui/components/scene-stage.tsx`
- `types.ts`, `constants/home-scene-defaults.ts`, `constants/home-scene-copy.ts`, `constants/scene-layout.ts`, `constants/scene-shortcuts.ts`
- `hooks/use-scene-shortcuts.ts`, `lib/scene-visible-area-for.ts`, `lib/dock-layout-for.ts`, `lib/resolve-scene.ts`, `lib/scene-savings.ts`
- `ui/components/assembly-kits/assembly-kit-host.tsx`, `ui/components/home-scene-canvas.tsx`, `ui/components/scene-keys-button.tsx`, `ui/components/shortcut-keys-dialog.tsx`
- `ui/components/home-kit/home-camera-rig.tsx` (frames the system in focus)
- Other consumers of the visible area, as `tsc` finds them: `blueprint-paper.tsx`, `thermal-legend.tsx`, `callout-pin.tsx`
- `scripts/verify-trade-scene-layout.ts`, `scripts/verify-trade-scene-load.ts` (repo root)

**Delete**
- `ui/components/build-switch/` (all 6 files)
- In `ui/components/panel/`: `scene-card.tsx`, `scene-panel.tsx`, `panel-knob.tsx`, `panel-sub-tabs.tsx`, `living-tab.tsx`, `home-tab.tsx`, `household-section.tsx`, `structure-section.tsx`, `materials-section.tsx`, `material-row.tsx`, `material-choices.tsx`, `wear-header.tsx`, `scopes-and-addons.tsx`, `scope-or-addon-row.tsx`, `efficiency-upgrade-chip.tsx`
- `ui/components/recenter-chip.tsx`
- `contexts/panel-tabs-context.tsx`, `hooks/use-panel-collapsed.ts`, `hooks/use-set-property.ts`, `hooks/use-set-home-material.ts`, `hooks/use-crawl-camera-focus.ts`
- `constants/panel-tabs.ts`, `constants/panel-storage.ts`, `constants/build-switch.ts`
- `lib/panel-tab-press.ts`, `lib/sub-tabs-of.ts`, `lib/build-switch-compact.ts`
- `ui/lib/panel-fold-focus.ts`
- The copy that only they used: `PANEL_TAB_LABELS`, `SUB_TAB_LABELS`, `STRUCTURE_COPY`, `PANEL_COPY.collapse/expand`, most of `BUILD_SWITCH_COPY`, `HOME_MATERIALS_COPY.tapHint`
- Before deleting, `rg` each file's exports; anything still imported elsewhere is kept and listed in the plan.

**Keep unmounted (R189)**, each with a `// LAZY:` header naming the Benefits interior as its destination:
- `savings-tab.tsx`, `savings-bars.tsx`, `savings-bar.tsx`, `savings-figure.tsx`, `savings-read-amounts.tsx`, `counted-dollars.tsx`, `estimate-disclosure.tsx`, `cut-override.tsx`, `repairs-section.tsx`, `repairs-row-field.tsx`

**Kept and reused:** `wear-dots.tsx`, `shingle-colors.tsx`, `segmented-field.tsx`, `unit-money-field.tsx`, `offer-kind-mark.tsx`, the `fields/` components, `assembly-screen*.tsx` and the close-up's part list, pins and peel control.

**Sequencing:** another session has uncommitted blueprint-load edits in `scene-stage.tsx`, `trade-scene-view.tsx`, `home-scene-canvas.tsx` and `constants/scene-load.ts`. The build starts only after those are committed.

## 9. Out of scope and follow-ups

**Out of scope**
- The Benefits interior (its own `/ui-exploration` from the matrix, R157 → R185).
- AI in Modify (R152).
- Saving to the meeting (R153, TS4).
- The Area mapping (R156) and the Lot inputs (R149).
- The general system view (TS3b.4b).
- The owner's copy pass.

**Follow-ups**
- The Benefits session re-homes or deletes the parked savings and repairs components (R189).
- TS3b.4b replaces `close-up-card.tsx`, and builds on `SYSTEM_CAMERA_VIEWS` for its system views.
- R153 attaches saving inside `useApplySceneChange`.
- The owner's copy pass covers `CONTROLS_COPY`.
- The underline tab classes become a shared primitive if a second feature needs them.

## 10. Stress-test rulings and corrections (2026-11-01)

**Owner rulings**

| # | Ruling |
|---|---|
| S1 | **Build order:** Controls builds before TS3b.4b (up close on a system). TS3b.4b's plan cites the scene card, panel, build switch and `'under-floor'` focus this build removes, so it is re-planned on the Controls head. |
| S2 | **Colours follow the theme rules** where the mock breaks one: fields, chips and the era block on `input-background` (not the canvas), the value menu on `popover`, a pill track inside the window on `bg-(--card)`. Everything else keeps the mock's look through the stage's tokens. |
| S3 | **Names:** the glossary gains Controls, Controls window, Today ⇄ Build toggle, Home facts, Missing fact, Systems rail, System in focus, System card, Modify (and its change slots), Scene change, Benefits and Close-up card (`CONTEXT.md`). In code the two sides are `existing` / `proposed` (`existing-chip.tsx`, `proposed-chip.tsx`, `proposed-tint.tsx`); Modify's groups are `SlotGroup`, not a scope. |
| S4 | **A part-pin tap closes an open window** before the zoom (§6). |

**Corrections the code required**

- Home facts, Modify and Benefits share **one** dialog root; a section switch swaps the body and the placement.
- Picks use a `ChoicePill` (Not sure inside), which keeps the toggle group's guard against the empty value a second tap sends. Roof form has no Not sure (the mock's).
- **Use code** resets only materials that have an era guess; the roof (no era code) keeps its Condition. It replaces the per-material "Back to era guess".
- The option rules inside `material-choices.tsx` and `scope-or-addon-row.tsx` move into `lib/` first; Modify's slots and the system card's chips both read them, so a package unit shows its AC size in both.
- `SceneChange`'s `fact` kind includes `paintWear`; the paint-wear build's `PaintWearFields` writes through `useApplySceneChange` and shows under the exterior paint's Condition.
- `HomeMaterialChange` is removed outright; `homeMaterialPatch` takes the `Extract` of `SceneChange`.
- A tap on the scene is decided by the shared tap tracker, which gains a `'tap'` result.
- `panel-header.tsx` stays (the close-up's `AssemblyScreen` imports it). The tray fields, glyphs, `slim-pair-value`, `offer-kind-mark` and `tray-group-context` go with the card, and the dead maps in `scene-control-icons.ts` go too (`HOME_SYSTEM_ICONS` lives there).
- The system card's measured bottom has its own context, so typing in Modify never re-renders the stage.
- The section rules (`openSection`, `flip`, `focusSystem`) are pure functions with assertions.
- The UI is checked one Playwright slice per section, from the first mounted task on.
