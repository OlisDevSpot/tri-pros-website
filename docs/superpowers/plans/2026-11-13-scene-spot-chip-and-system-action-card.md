# Trade scene spot chip and system action card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Picking a system never moves the camera. A tap opens a spot chip at the tapped point, and its quick edit changes the side shown in place. The system action card carries Focus, Look inside and the yards' draw actions. A drag pans and Shift + drag spins, and the cursor shows which. A quick summary shows the weather, the outside °F and Thermal. The window Look inside no longer ghosts the left front window.

**Architecture:**
- **Two fields, two meanings.** The store's one `cameraFocus` field splits in two. `pickedSystem` is the system whose card is open, and every pick writes it. `cameraFocus` is what the camera frames, and only Focus and Look inside write it.
- **Releasing focus holds the camera's pose.** Only Recenter goes home.
- **Taps keep their point.** A tap stores the hit point in the house's lift space. The chip hangs off a `SceneAnchor` at that point, so it follows every pan and spin.
- **Testable placement.** Placement and actions are pure functions in `lib/`, checked by the tsx assert scripts.

**Tech Stack:**
- React 19, R3F 9 and three 0.180.
- drei `OrbitControls` (three-stdlib).
- zustand scene inputs (`useSceneInputs`).
- motion/react.
- Radix (`ValueMenu`, Collapsible).
- shadcn `Button`.
- lucide icons.
- tsx assert scripts as the tests.

**Spec:** `docs/superpowers/specs/2026-11-13-scene-spot-chip-and-system-action-card-design.md`. Read it first. Its §3 copy table and §4 architecture are binding. The approved prototype is https://claude.ai/artifact/RQnLSzmd2JhWJ7kGXYkz3v. Read it with the Artifact tool's `read` action when a motion detail is unclear.

## Global Constraints

**Branch and shared tree**
- All work is on `feat/scene-layout-lab` (worktree `.worktrees/scene-layout-lab`).
- Another session commits texture work on this branch. Never revert their edits, including the uncommitted `CONTEXT.md`.
- No stash, checkout, restore, reset or `--amend`. Before each dispatch, `git diff --cached` is empty.
- After any scripted edit, `git diff --shortstat` shows only the lines meant.

**Commits** (the owner answered: commit each task)
- **Commit only through `commit-own.sh`.** The build's SDD folder holds a copy of the trade-scenes helper `.superpowers/sdd/2026-11-06-trade-scene-colour-picking/commit-own.sh`: `commit-own.sh <msg-file> <path>… [patch:<file>]`. It builds the commit in a throwaway index from HEAD plus your items, so another session's staged work never rides along. `DRY=1` previews it. Never `git add` or a bare `git commit`.
- **Foreign-hunk gate, before every edit and commit.** On 2026-11-13 the texture session had uncommitted edits in `types.ts`, `scripts/verify-trade-scene.ts`, `home-kit/house-shell.tsx`, `home-kit/foundation.tsx` and others (it committed them as `9a7b8024e`; more will come). Run `git status --short -- src scripts` before a task edits a file. If the file already holds hunks that are not this plan's, save `git diff <file>` first, and commit only your hunks with the `patch:<file>` item. When the two cannot be told apart, stop and ask the owner.
- The message ends with the `Co-Authored-By` trailer the session gives.
- The pre-commit hook runs `pnpm tsc && pnpm lint && pnpm theme:check` against the **main checkout**, not this worktree, and takes about 110 s. Run the commit with a 300 s Bash timeout. The task's own checks below are the real gate; a hook block means look at main.
- After each commit, `git show --stat HEAD` lists exactly the task's files and no foreign hunk (`git show HEAD -- <shared file>`).

**Machine safety**
- Only the owner starts a dev server. The lab's port is `:3003` (`.env.local`). If it does not answer (`ss -ltnp`), stop and ask.
- Never `pnpm build`.
- Never sweep the scene in a software-rendered browser: it crashed the machine. Task 12 takes one batch of five shots, and nothing else opens the scene.
- No DB writes and no new npm dependency.

**Checks** (every task ends with all five clean):
- `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock pnpm tsc`
- `flock … env CI=1 pnpm eslint <every file the task created or modified>`
- `pnpm theme:check`
- `pnpm exec tsx scripts/verify-trade-scene.ts` and `pnpm exec tsx scripts/verify-trade-scene-layout.ts`, both ending `ok`.
- `grep -rlE "from '(three|@react-three)|trade-scenes/ui/" src/features/trade-scenes/constants src/features/trade-scenes/lib` prints nothing. (The older pattern `/ui/` also matched the shared chart type import in `constants/two-futures-chart.ts:1`, so it could never pass.)

**Tests**
- Flat top-level `assert` calls in the existing scripts.
- The assert message is the case name given in the task.
- New checks go in a `{ }` block headed by a one-line `//` comment, as the scripts do now.

**Conventions**
- One component per file, with named exports.
- No file-level constants in component files: numbers go to `constants/scene-layout.ts` and copy to `constants/home-scene-copy.ts`.
- Contexts live in `contexts/`, and pure helpers in `lib/`.
- Feature paths below are under `src/features/trade-scenes/`.

**Comments** say why, never what. They never cite plans, specs, tasks or the prototype. When code is deleted, its comments go with it.

**Copy** (spec §3) is exact. The chip never says "system". The card title is `${label} system`.
- Placeholder copy (Q4) is marked in the spec, not in code.
- Code spells `color` and the screen spells "Colour".

**Motion**
- Ease: `CONTROLS_EASE`.
- Reduced motion: every animation is instant (`useReducedMotion`).
- No `layout` prop and no scale animation on the chip or the summary.

**Vocabulary** (owner, D15 and D17): spot chip, quick edit, system action card, quick summary, Focus, Pick. Code names follow: `SpotChip`, `QuickEdit*`, `SystemActionCard`, `SceneSummary`, `focusCamera`. "Focus" in code means only the camera (`cameraFocus`, `focusCamera`, `FocusPing`, `focusFraming`, `systemPartFocus`) or the browser's keyboard focus. The open card is the **pick** (`picked`, `pickSystem`, `SystemsPick`), and the yard editor's choice is a **selection**. The glossary entries are already in `CONTEXT.md` (written at the stress test).
- Fonts stop at `font-bold`: lint rejects `font-extrabold` everywhere (`eslint.config.js:225-243`).
- Styling for new controls goes in `constants/controls-classes.ts` entries, as `railChip` does, never as inline class strings that copy one.
- Read-only overlays on the scene use `bg-scrim/70 text-on-media` (as `panel/thermal-legend.tsx:25`). No `backdrop-blur`, and no status colour (`text-warning`) for decoration.

**Line numbers** were read on the lab head `8d6a8a3d8`. Re-grep before every edit; the texture session moves lines.

**Files off limits:** the files below must not be touched.
- Anything outside `src/features/trade-scenes/`, `src/shared/components/scene/ui/camera-rig.tsx`, `public/cursors/` and `scripts/verify-trade-scene*.ts`, except the two shared scene files named below. `CONTEXT.md` already holds this plan's glossary entries; the build does not edit it.
- No tRPC, DAL, schema or service file. The spec's Data access section is "none".
- The texture files: `ui/lib/texture-*`, `ui/lib/patch-textured-material.ts`, `ui/lib/inject-covering-wear.ts`, `lib/texture-binding.ts`, `lib/texture-map-urls.ts`, `ui/components/home-kit/textured-material.tsx`, `constants/material-textures.ts`, `hooks/use-texture-maps.ts`.
- `src/shared/components/scene/constants/` is allowed for one new file, `camera-gesture-maps.ts` (Task 5), and `src/shared/components/scene/ui/scene-pins-projector.tsx` for one attribute (Task 9).

## Review Focus

1. **A rep pans or spins while a chip is open.** The chip and its mark stay on the tapped point. They hide when the point goes behind the camera or off the stage, and come back with it. The chip's side and its offset never change mid-pan. *Pinned in Task 8 (placement is computed only at first show and at quick-edit open) and Task 9 (placement waits for the first `data-anchored`; the projector marks `data-off-stage` and the host hides on it).*
2. **The rep presses Focus, then picks another system, then closes the card.** The camera stays where Focus left it at each step, Recenter stays visible and R works, and only Recenter glides home. Focus pressed again after a hand pan glides back. *Pinned in Task 2's `restingFraming` cases (`away`, Focus over recentered) and Task 1's `focusCamera` bump.*
3. **The attic or the foundation is picked from a Complete house, then the card closes.** The house goes back to Complete, and the rep's own home view is never written. The same holds while a chip is in quick edit for one of them. *Pinned in Task 1's `houseOpen` cases.*
4. **Today ⇄ Build flips with quick edit open.** The pinned corner stays, the Paint wear / Roof wear fold closes, and only a folded height that no longer fits lifts the chip. *Pinned in Task 8's "flip keeps the corner" case and Task 10's fold reset.*
5. **Escape with a value menu open inside quick edit.** The menu closes first, then the fold, then quick edit, then the chip. One layer goes per press. *Pinned in Task 10's `escapeStep` cases.*

## File map

| Path (under `src/features/trade-scenes/` unless noted) | Job |
|---|---|
| `types.ts`, `constants/home-scene-defaults.ts` | `pickedSystem`, `TappedSpot`, `'foundation'` spot |
| `contexts/scene-controls-context.tsx`, `lib/controls-press.ts` | Picks write `pickedSystem`; new `focusCamera`, `toggleLookInside` |
| `lib/house-open.ts`, `constants/home-systems.ts` | Open/close follows the pick or a quick edit; foundation opens |
| `lib/resting-framing.ts` (new), `ui/components/home-kit/home-camera-rig.tsx` | Release holds the pose; Recenter goes home |
| `src/shared/components/scene/ui/camera-rig.tsx` | `gestures` prop |
| `lib/scene-cursor.ts` (new), `ui/components/scene-cursor.tsx` (new), `public/cursors/spin.svg` (new) | Cursor from `{ overPart, shift, dragging }` |
| `lib/system-actions.ts` (new), `ui/components/controls/system-action-card.tsx` (replaces `system-card.tsx`), `system-actions-row.tsx`, `system-action-button.tsx` (new) | The card and its actions row |
| `lib/material-input-groups.ts` (new), `ui/components/controls/material-input-group.tsx` (new) | One source for a material's inputs |
| `lib/system-input-slots.ts`, `lib/system-build-entries.ts` (new) | The system's today list and build entries, shared by the card and quick edit |
| `lib/spot-chip-placement.ts`, `hooks/use-spot-chip-free.ts` (new) | Pure placement, and the free region it reads |
| `ui/components/spot-chip/*` (new) | Chip host, chip, head, quick edit (Today, Build), Paint wear / Roof wear fold, mark and line |
| `lib/outside-temperature.ts` (new), `ui/components/scene-summary/*` (new) | Quick summary |
| Renamed only (Task 0) | `SystemsFocus` → `SystemsPick`, `focus` → `picked`, `focusSystem` → `pickSystem`, `pressFocus` → `pressPick`, `pressPin` → `pressChip`, Escape `'focus'` → `'card'`, `focusCardBottom` → `openCardBottom`, `YardFocusBody` → `YardSelectionBody` (file too), `isFocusableRegion` → `isSelectableRegion` |
| Deleted | `ui/components/spot-pin.tsx`, `lib/spot-pin-point.ts`, `ui/components/controls/look-inside-button.tsx`, `ui/components/controls/system-card.tsx` |

---

### Task 0: Honest names (rename only)

The owner ruled (D17) that "Focus" is only the camera's. Today the code also says `focus` for the open card and for the yard editor's selection. This task renames those and changes no behaviour, so a reviewer can check it mechanically and every later task is written in the new names.

**Files:** every reader the greps below list. On 2026-11-13 these were `types.ts:651-652`, `lib/controls-press.ts`, `lib/escape-step.ts`, `contexts/scene-controls-context.tsx`, `hooks/use-scene-shortcuts.ts`, `ui/components/controls/{systems-rail,systems-section,system-card,lot-areas-section,controls-recenter,draw-bar,yard-card-body}.tsx`, `ui/components/controls/yard-focus-body.tsx` (renamed to `yard-selection-body.tsx`), `lib/lot-regions.ts`, `lib/lot-tap.ts`, `ui/components/scene-stage.tsx`, `lib/scene-visible-area-for.ts`, `constants/home-systems.ts:22,26` (comments), `constants/home-anchors.ts:111,121-122` (comments), and both verify scripts.

**Interfaces:**
- Produces:
  - `type SystemsPick = HomeSystemId | 'year-built' | null`.
  - `SceneControlsValue.picked: SystemsPick` and `pickSystem: (pick: SystemsPick) => void`.
  - `ControlsPressState.picked` and `ControlsPressResult.picked`; `pressPick(state, pick)`, `pressChip(state, system)`.
  - `escapeStep` context field `picked`, and its step `'card'` in place of `'focus'`.
  - `SystemCard({ subject })` (Task 6 renames the component itself).
  - `sceneVisibleAreaFor({ …, openCardBottom })`.
  - `YardSelectionBody`, `isSelectableRegion`.
- Unchanged: `cameraFocus`, `FocusPing`, `focusFraming`, `systemPartFocus`, `pieceFocus`, and DOM focus names (`focusFell`, `focusSearch`, `returnFocus`).

- [ ] **Step 1: Rename.** Use the editor or `sed -i` with word boundaries, one name at a time, then re-read each hunk. Comments follow the same meaning:
  - "in focus" for the open card becomes "picked".
  - In `home-anchors.ts`, "in focus" stays only where the camera frames the system; there it reads "framed".
  - "focused" for a yard thing becomes "selected".
- [ ] **Step 2: Check.** `grep -rnE "\bSystemsFocus\b|\bfocusSystem\b|\bpressFocus\b|\bpressPin\b|\bfocusCardBottom\b|YardFocusBody|isFocusableRegion|'focus'" src/features/trade-scenes scripts` prints nothing. The escape-step test cases expecting `'focus'` now expect `'card'`; no other assertion changes.
- [ ] **Step 3: Run the global checks.** Commit with: `refactor(trade-scenes): the open card is the pick and the yard editor's choice a selection; Focus is only the camera's`.

---

### Task 1: Picked vs framed

**Files:**
- Modify: `types.ts:81-101` (`TradeSceneInputs`), `:649-650` (`SystemsFocus` comment), `constants/home-scene-defaults.ts`, `constants/home-systems.ts:22-23`
- Modify: `ui/views/trade-scene-view.tsx` (provider order), `contexts/scene-controls-context.tsx`, `lib/house-open.ts`, `lib/keep-look-inside.ts`, `ui/lib/leave-look-inside.ts`, `hooks/use-system-opened.ts`
- Modify: `ui/components/home-scene-canvas.tsx` (`lit`, `houseOpen` call), `ui/components/controls/systems-section.tsx` (FocusPing input), `ui/components/controls/controls-recenter.tsx`, `hooks/use-scene-shortcuts.ts` (recenter case), `ui/components/scene-stage.tsx` (the card's room follows the open card, D16)
- Test: `scripts/verify-trade-scene.ts:995-1008` (rewrite), the `stepsBack` fixtures (≈`:3686-3700`), `scripts/verify-trade-scene-layout.ts`

**Interfaces:**
- Produces:
  - `TradeSceneInputs.pickedSystem: HomeSystemId | null` (default `null`).
  - `houseOpen(state: Pick<TradeSceneInputs, 'homeView' | 'pickedSystem' | 'tappedSpot'>): boolean`.
  - `houseHeldOpen(system: HomeSystemId | null): boolean` and `houseHeldClosed(system: HomeSystemId | null): boolean`, with unchanged names.
  - `SceneControlsValue` gains `focusCamera: () => void` and `toggleLookInside: () => void`. `picked` (Task 0's name) now derives from `pickedSystem`.
- Task 4 widens `tappedSpot` to `TappedSpot | null`, so `houseOpen` must read it through a helper that accepts both shapes. Write `heldSystem(state)` in `lib/house-open.ts`. It returns `state.pickedSystem` for now. Task 4 adds the quick-edit system.

- [ ] **Step 1: Write the failing tests.** Replace the `houseOpen` block at `verify-trade-scene.ts:995-1005`. Keep every case and swap `cameraFocus` for `pickedSystem`, adding `tappedSpot: null`. Then add these cases:

```ts
assert.equal(houseOpen({ homeView: 'complete', pickedSystem: 'foundation', tappedSpot: null }), true, 'the foundation picked opens a Complete house')
assert.equal(houseOpen({ homeView: 'complete', pickedSystem: null, tappedSpot: null }), false, 'closing the card puts Complete back')
const cameraFocusAlone: Pick<TradeSceneInputs, 'cameraFocus' | 'pickedSystem'> = { cameraFocus: 'attic', pickedSystem: null }
assert.equal(houseOpen({ homeView: 'complete', ...cameraFocusAlone, tappedSpot: null }), false, 'the camera framing the attic does not open the house; the pick does')
```

  The `sceneBurstKey` cases at `:1007-1008` swap `cameraFocus` for `pickedSystem`. Next to the `cameraFocusIsDrawingOnly` check at `:581`, add the same check for `pickedSystem`, named "a pick is drawing-only".

  The `stepsBack` fixtures (≈`:3696-3700`) set only `cameraFocus`. Once `keepLookInside` reads `pickedSystem`, "up close holds before the change" would fail, so give each fixture `pickedSystem` equal to its `cameraFocus`. The "back to the system, still in focus" assertion keeps checking `cameraFocus`, and adds `next.pickedSystem === state.pickedSystem`.

- [ ] **Step 2: Run** `pnpm exec tsx scripts/verify-trade-scene.ts`. Expected: a type error or FAIL, because `pickedSystem` does not exist yet.

- [ ] **Step 3: Implement.**
  - **Store and constants.**
    - Add `pickedSystem` after `cameraFocus` in `TradeSceneInputs`, with the comment "The system whose action card is open; a pick never moves the camera."
    - Add `pickedSystem: null` to the defaults.
    - `HOUSE_OPENING_SYSTEM_IDS = ['attic', 'heating-cooling', 'foundation']`. Its comment says the house opens while one is *picked*.
  - **`house-open.ts`.** `houseOpen` reads `heldSystem(state)` in place of `cameraFocus`. `houseHeldOpen` and `houseHeldClosed` take a `system` parameter.
  - **Provider order (`ui/views/trade-scene-view.tsx:70-73`).** `SceneControlsProvider` sits outside `SceneCameraProvider` today, so it cannot read `moved`. Move `<SceneCameraProvider store={camera}>` up to wrap `<SceneControlsProvider>`. It is a plain store provider, and the camera store is created above both. Keep the closing tags balanced, and check that the shortcuts' comment ("outside the stage, so its shortcuts reach it") still holds.
  - **`scene-controls-context.tsx`.**
    - `picked` = `yearBuilt ? 'year-built' : pickedSystem`.
    - `apply()` writes `pickedSystem` instead of `cameraFocus`. When the pick changes (`next pick !== held pick`), it also writes `cameraFocus: null`, plus `LEAVE_LOOK_INSIDE` if `lookInside`, all in the same `setState`. A press that keeps the pick (flip) leaves `cameraFocus` alone.
    - A press that **opens a card** (a non-null pick from the rail, a key or a chip's name) also writes `tappedSpot: null`, so the card never sits under a chip (spec §6). `close` and the Systems tap-away leave `tappedSpot` alone: the tap-away runs after the R3F house tap (`home-scene-canvas.tsx:89-94`, `systems-section.tsx:24`), so clearing there would swallow every chip tapped while Systems is open.
    - `focusCamera()`: `cameraFocus === pickedSystem && !cameraStore.moved` → `{ cameraFocus: null }`. Otherwise write `{ cameraFocus: pickedSystem }` **and** call `recenterCamera(cameraStore)` in the same handler. The rig glides only on a framing-key or recenter change (`camera-goal.ts:30`), and after a release the held framing equals the system's framing, so without the bump Focus after a hand pan would never move. Read the camera store with `useSceneCameraApi()`.
    - `toggleLookInside()`: when `lookInside` is set, write `LEAVE_LOOK_INSIDE`; otherwise `{ lookInside: true, cameraFocus: pickedSystem }`.
    - Update the provider's comment, since it no longer says "a system in focus is the store's cameraFocus".
  - **Readers.**
    - `keepLookInside` and `leaveLookInside` read `pickedSystem`.
    - `useSystemOpened`: `state.pickedSystem === system || houseOpen(state)`.
    - `home-scene-canvas.tsx`: `system = lookInside ? pickedSystem : null`, and `houseOpen` gets the state's three fields.
    - `SystemsSection` passes `cameraFocus` (read from the store) to `FocusPing`. The ping is camera-only.
  - **Recenter (button and R).** It no longer clears the pick. It writes `{ cameraFocus: null, ...(lookInside ? LEAVE_LOOK_INSIDE : {}) }` and then `recenterCamera`, in one handler. Today Recenter leaves Look inside through `apply`, and without that write the camera would stay up close with Focus shown unpressed. It shows when `moved || cameraFocus !== null` (Task 2 makes a held pose count as `moved`).
    - In `use-scene-shortcuts.ts`, the recenter case and the early-return guard read `cameraFocus` in the same way. *(Claude's call: the card stays open on Recenter.)*
  - **The card's room (D16).** In `scene-stage.tsx`, `openCardBottom` is the measured `systemCardBottom` whenever it is non-null, no longer gated on `cameraFocus`. The card already reports `null` when it unmounts (`system-card.tsx:77-83`). A pick therefore slides the picture aside without re-aiming, and closing the card slides it back.

- [ ] **Step 4: Update the press tests.** In `verify-trade-scene-layout.ts:360-372`, the press results are unchanged because they speak of `focus`. Rename the case "a pin opens …" to "a chip's name opens Systems on its system". Run both scripts. Expected: `ok`.

- [ ] **Step 5: Run the global checks**, then commit every file in this task's Files block under the commit rules (the foreign-hunk gate applies to `types.ts` and the verify script). Message: `feat(trade-scenes): a pick opens the system's card and never re-aims the camera; Focus and Look inside frame it`.

### Task 2: Releasing focus holds the camera's pose

**Files:**
- Create: `lib/resting-framing.ts`
- Modify: `ui/components/home-kit/home-camera-rig.tsx:60-86`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `cameraFocus` (Task 1).
- Produces: `restingFraming(input: { focus: CameraFraming | null, held: CameraFraming | null, home: CameraFraming, recentered: boolean }): { framing: CameraFraming, held: CameraFraming | null, away: boolean }`.
  - `focus` is the system's **own** framing only (`SYSTEM_CAMERA_VIEWS[cameraFocus](…)`). The up-close framing (`lit`), the part lean and the crawl view are layered over the result by the rig, never fed in, so they are never held.
  - `away` is true while a pose is held with nothing focused. The rig writes it to the camera store as `moved: true`, because Recenter and R show only on `moved || cameraFocus !== null` (`controls-recenter.tsx:33`, `use-scene-shortcuts.ts:67`).

- [ ] **Step 1: Write the failing tests** in a block headed `// Releasing focus holds the pose; only Recenter goes home.` `F` and `H` are two `CameraFraming` literals, taken from `SYSTEM_CAMERA_VIEWS.roof('pitched', 'landscape', 0, { type: null, scale: 1 })` and `homeFramingFor(1.4)`.

```ts
assert.deepEqual(restingFraming({ focus: F, held: null, home: H, recentered: false }), { framing: F, held: F, away: false }, 'Focus frames the system and remembers it')
assert.deepEqual(restingFraming({ focus: null, held: F, home: H, recentered: false }), { framing: F, held: F, away: true }, 'releasing Focus keeps the framing, so nothing glides, and Recenter stays')
assert.deepEqual(restingFraming({ focus: null, held: F, home: H, recentered: true }), { framing: H, held: null, away: false }, 'Recenter goes home')
assert.deepEqual(restingFraming({ focus: F, held: F, home: H, recentered: true }), { framing: F, held: F, away: false }, 'Focus pressed again after a pan wins over its own recenter bump')
assert.deepEqual(restingFraming({ focus: null, held: null, home: H, recentered: false }), { framing: H, held: null, away: false }, 'with nothing held the home framing stands')
```

- [ ] **Step 2: Run.** Expected: FAIL, because the module is missing.

- [ ] **Step 3: Implement `restingFraming`** and wire it into the rig.
  - Keep `{ held, recenters }` in state, using the adjust-state-during-render pattern that `FocusPing` uses. Read `recenters` with `useSceneCamera(state => state.recenters)`.
  - A change in `recenters` sets `recentered: true` for that render.
  - `homeFramingFor(aspect)` stays the `home` input.
  - The rig's final framing is `partFraming ?? upClose-with-lean ?? crawl ?? resting.framing`. That way, letting go from up close or from the crawl view (whose house closes with the card) glides to the system's own view and holds it, never a crawl pose at a closed skirt. *(Claude's call, spec §4.1.)*
  - In a layout effect, when `away` is true the rig writes `{ moved: true }` to the camera store. It runs after the shared `CameraRig`'s own layout effect, which resets `moved` only on a reframe.

- [ ] **Step 4: Run** the script. Expected: `ok`.
- [ ] **Step 5: Run the global checks.** Commit `lib/resting-framing.ts`, `home-camera-rig.tsx` and `scripts/verify-trade-scene.ts` under the commit rules, with: `feat(trade-scenes): letting a system go leaves the camera where it is; only Recenter goes home`.

### Task 3: The window Look inside keeps the left front window (bug i)

**Files:**
- Modify: `constants/look-inside.ts:56-58` (rename to `FRONT_WALL_WINDOW_TAG`, with its comment), `ui/components/home-kit/house-shell.tsx` (the Complete-only front `frame` group, now at ≈`:264`, and the front `glazing` group at ≈`:281`; the `:220`/`:231` side-wall groups stay; foreign-hunk gate applies), `ui/components/home-kit/window-seals.tsx:62`, `ui/components/home-kit/window-panes.tsx:46`, `lib/system-part-opacity.ts:7-9` (comment)
- Test: `scripts/verify-trade-scene.ts:45,3491-3497,3585`

**Interfaces:**
- Produces: `FRONT_WALL_WINDOW_TAG = { overFront: true } as const`. `LOOK_INSIDE_WINDOW_TAG` is deleted.

- [ ] **Step 1: Write the failing tests.** After `:3497`, add these cases:

```ts
const windowsLit = { system: 'windows', shown: new Set(['frame', 'glazing']), emphasized: null } as SystemLit
assert.equal(systemPartOpacity(systemPartTag('frame', FRONT_WALL_WINDOW_TAG), true, windowsLit, ghost), 1, 'the left front window\'s frame stays solid while the windows look inside')
assert.equal(systemPartOpacity(systemPartTag('glazing', FRONT_WALL_WINDOW_TAG), true, windowsLit, ghost), 1, 'and its glass')
assert.equal(systemPartOpacity(systemPartTag('frame'), true, windowsLit, ghost), ghost, 'an untagged Complete-only frame still ghosts')
```

  Also add a source check on `house-shell.tsx`. It passes only when every `systemPartTag('frame'…)` and `systemPartTag('glazing'…)` group inside the `HOME_FADE_TAGS.complete` group carries `FRONT_WALL_WINDOW_TAG`. Name it "every front-wall window piece is tagged over the front". The `:3585` regex takes the new name.

- [ ] **Step 2: Run.** Expected: FAIL on the house-shell check.
- [ ] **Step 3: Implement** the rename and the two tags. Rewrite the comments that say "the windows' framed window" so they cover every front-wall window.
- [ ] **Step 4: Run.** Expected: `ok`.
- [ ] **Step 5: Run the global checks.** Commit the five files and the script with: `fix(trade-scenes): the windows' Look inside keeps the left front window solid`.

### Task 4: A tap keeps its point; every system has a spot; the foundation is tappable

**Files:**
- Modify: `types.ts:96-98,737`, `constants/home-systems.ts:29-31`
- Modify: `lib/systems-at-spot.ts`, `lib/spot-pin-id.ts` (keyed by `HomeSpotId` now: one anchor per tap; the `-pin-id` name stays beside `part-pin-id.ts` and `reading-pin-id.ts`, since "anchor" is already a glossary word for a named home place), `lib/house-open.ts` (`heldSystem`), `lib/controls-press.ts:41-42`
- Modify: `ui/components/home-kit/home-kit.tsx:99,319-330,357-361,371,433`, `ui/components/home-kit/foundation.tsx` (an `onTap` prop on the skirt and raised-wall groups; foreign-hunk gate applies), `ui/components/home-kit/spot-pins-layer.tsx` (one `SceneAnchor` at the tapped point), `ui/components/home-scene-canvas.tsx` (`tapSpot`)
- Delete: `lib/spot-pin-point.ts`
- Modify for now: `ui/components/spot-pin.tsx` renders the stack of systems at the spot. Task 9 deletes it.
- Test: `scripts/verify-trade-scene.ts:152-153,3427-3444` and the spot-pin-point block

**Interfaces:**
- Produces:
  - `HOME_SPOT_IDS = ['roof', 'window', 'wall', 'equipment', 'foundation'] as const`.
  - `SPOT_OF: Record<HomeSystemId, HomeSpotId>`, with `foundation: 'foundation'`.
  - `interface TappedSpot { id: number, spot: HomeSpotId, point: Vec3, rides: 'lift' | 'ground', editing: HomeSystemId | null }`, so the store has `tappedSpot: TappedSpot | null`.
    - `id` grows by one per tap, so the chip host can be keyed by it and a second tap on the same spot places a fresh chip.
    - `point` is in the space of the group the tapped part rides. The house is in the lift group (`home-kit.tsx:371`), but a ground condenser is in `groundLevel` (`:357-361`), which a foundation change never lifts.
  - `HomeKitProps.onSpotTap: (spot: HomeSpotId, point: Vec3, rides: 'lift' | 'ground') => void`.
  - `spotPinId(spot: HomeSpotId): string` and `spotFromPinId(id: string): HomeSpotId | null`.
  - `heldSystem(state) = state.pickedSystem ?? state.tappedSpot?.editing ?? null`.
  - `systemsAtSpot('foundation', ctx) → ['foundation']`.

- [ ] **Step 1: Write the failing tests.**

```ts
assert.deepEqual(systemsAtSpot('foundation', { form: 'pitched', picks: [], hvacType: null }), ['foundation'], 'the foundation is its own spot')
assert.deepEqual(HOME_SYSTEM_IDS.map(id => SPOT_OF[id]), ['roof', 'roof', 'window', 'wall', 'equipment', 'foundation'], 'every system has a spot')
const spot = (editing: HomeSystemId | null): TappedSpot => ({ id: 1, spot: 'roof', point: [0, 0, 0], rides: 'lift', editing })
assert.equal(houseOpen({ homeView: 'complete', pickedSystem: null, tappedSpot: spot('attic') }), true, 'the attic in quick edit opens a Complete house')
assert.equal(houseOpen({ homeView: 'complete', pickedSystem: null, tappedSpot: spot(null) }), false, 'a chip at rest leaves the house as it is')
assert.equal(houseOpen({ homeView: 'partly-open', pickedSystem: null, tappedSpot: { ...spot('windows'), spot: 'window' } }), false, 'the windows in quick edit hold the house closed')
assert.equal(spotFromPinId(spotPinId('foundation')), 'foundation', 'a foundation spot pin reads back')
assert.equal(spotFromPinId(spotPinId('roof')), 'roof', 'a spot pin is keyed by spot, so a stack shares one anchor')
assert.match(readFileSync('src/features/trade-scenes/ui/components/home-kit/home-kit.tsx', 'utf8'), /<CondenserUnit[^>]*spotTap\('equipment', 'ground'\)/, 'the ground condenser\'s tap rides the ground, not the lift')
```

  Delete the `spotPinPoint` checks and the `SYSTEM_PIN_LABELS.walls` case (`:3439`). Task 9 deletes the constant itself. The `:3444` case becomes the second case above.

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Implement.**
  - **`spotTap(spot, rides = 'lift')` in `home-kit.tsx`.** It converts the hit into the riding group's space with `(rides === 'lift' ? lift : groundLevel).current!.worldToLocal(event.point.clone())`, and calls `onSpotTap(spot, [x, y, z], rides)`. The condenser passes `spotTap('equipment', 'ground')`. A package unit on the roof keeps `'lift'`.
  - **Foundation.** `<Foundation onTap={spotTap('foundation')} …>` attaches `onClick` to the skirt and raised-wall groups only. The ground slab is not a spot, so a slab home has no foundation spot. Quick edit reaches a slab foundation through the card.
  - **Anchors.** `SpotPinsLayer` takes a `rides` prop and is mounted twice: inside the lift group, where it is today, and inside `groundLevel`. It reads `tappedSpot` and renders **one** `SceneAnchor` with `id={spotPinId(tappedSpot.spot)}` at `tappedSpot.point`, only when `tappedSpot.rides` matches its own `rides` and not while `lookInside`.
  - **`tapSpot` in `home-scene-canvas.tsx`.** It writes `tappedSpot: { id: (previous?.id ?? 0) + 1, spot, point, rides, editing: null }`.
  - **`pressHomeView`.** It still writes `tappedSpot: null`.
  - **`ScenePins`.** `visible` and `render` use `spotFromPinId`. For the spot it renders the existing `SpotPin` stack, one per `systemsAtSpot` system, `stackIndex * STACK_STEP_REM` apart, at the new point. This keeps the app usable until Task 9.

- [ ] **Step 4: Run.** Expected: `ok`. Then `grep -rn "spotPinPoint" src scripts` prints nothing.
- [ ] **Step 5: Run the global checks.** Commit every file named above, including the deleted `lib/spot-pin-point.ts`, under the commit rules, with: `feat(trade-scenes): a tap keeps where it landed, every system has a spot, and the foundation is tappable`.

### Task 5: Drag pans, Shift + drag spins, and the cursor says so

**Files:**
- Modify: `src/shared/components/scene/ui/camera-rig.tsx:28-35,61,240-253`, `ui/components/home-kit/home-camera-rig.tsx` (pass `gestures="pan-first"`)
- Create: `src/shared/components/scene/constants/camera-gesture-maps.ts` (beside `scene-gestures.ts`, which stays three-free because the wheel router reads it), `lib/scene-cursor.ts`, `constants/scene-cursors.ts`, `hooks/use-scene-cursor.ts`, `ui/components/scene-cursor.tsx` (a thin mount for the hook, as `scene-shortcuts.tsx` is for `use-scene-shortcuts.ts`), `public/cursors/spin.svg`
- Modify (every group that carries a spot tap gets `onPointerOver` / `onPointerOut`): `ui/components/home-kit/home-kit.tsx`, `house-shell.tsx` (the `onWallTap` / `onWindowTap` groups at ≈`:201,:220,:231,:236,:264,:275,:281`), `house-roof.tsx:73`, `condenser-unit.tsx:66`, `foundation.tsx` (Task 4's `onTap` groups). The foreign-hunk gate applies to `house-shell.tsx` and `foundation.tsx`.
- Modify: `ui/components/home-scene-canvas.tsx` (mount `<SceneCursor />` inside `SceneShell`; no hover state here)
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - `CameraRigProps.gestures?: 'orbit-first' | 'pan-first'`, default `'orbit-first'`. `'pan-first'` with `pan` unset throws, as the rig's provider guard does, since a left drag would then do nothing.
  - `CAMERA_GESTURE_MAPS = { 'pan-first': { mouseButtons: { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }, touches: { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE } } } as const`.
  - `sceneCursor(state: { overPart: boolean, shift: boolean, dragging: 'pan' | 'spin' | null }): string`.
  - `SPIN_CURSOR = "url('/cursors/spin.svg') 14 14, ew-resize"` in `constants/scene-cursors.ts`.
  - A hover setter the house's groups call: `useSceneCursorHover(): (over: boolean) => void`, from a tiny context the `SceneCursor` mount provides. It writes a ref and the cursor directly, never React state, so a hover never re-renders `HomeKit` (no React Compiler here).

- [ ] **Step 1: Write the failing tests.**

```ts
assert.equal(sceneCursor({ overPart: false, shift: false, dragging: null }), 'move', 'over the scene a drag pans')
assert.equal(sceneCursor({ overPart: true, shift: false, dragging: null }), 'pointer', 'over a tappable part')
assert.equal(sceneCursor({ overPart: true, shift: false, dragging: 'pan' }), 'grabbing', 'while panning')
assert.equal(sceneCursor({ overPart: false, shift: true, dragging: null }), SPIN_CURSOR, 'Shift held says a drag spins')
assert.equal(sceneCursor({ overPart: true, shift: true, dragging: null }), SPIN_CURSOR, 'Shift wins over a part')
assert.equal(sceneCursor({ overPart: false, shift: false, dragging: 'spin' }), SPIN_CURSOR, 'while spinning')
assert.deepEqual(CAMERA_GESTURE_MAPS['pan-first'], { mouseButtons: { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }, touches: { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE } }, 'pan-first maps the buttons and fingers')
assert.match(readFileSync('src/shared/components/scene/ui/camera-rig.tsx', 'utf8'), /mouseButtons=\{[^}]*CAMERA_GESTURE_MAPS/, 'the rig passes the maps to OrbitControls')
```

  The verify script imports `MOUSE` and `TOUCH` from `three` (scripts are not under the purity rule).

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Implement.**
  - **Camera rig.** With `'pan-first'`, `CameraRig` passes `CAMERA_GESTURE_MAPS['pan-first'].mouseButtons` and `.touches` to `<OrbitControls>`. three-stdlib 2.36.1 rotates on a PAN button with Shift, Ctrl or Meta held (`OrbitControls.js:684-689`, verified), and `TOUCH.DOLLY_ROTATE` exists (`:768-772`). The comment in the maps file says that, so no handler is custom. `'orbit-first'` passes nothing, which keeps today's defaults.
  - **`spin.svg`** is the prototype's drawing:
    - Two arcs and two arrowheads.
    - A white stroke of 2 over a `#061226` stroke of 4.5, on a 24 viewBox at 28 px.
    - A centre dot.

    Copy it from the template's `.screen.is-spinning` rule.
  - **`useSceneCursor`** runs inside the canvas on the element OrbitControls and `useSceneTaps` listen on: `useThree(state => state.events.connected)`, falling back to `gl.domElement`. It owns `shift`, read from `keydown`/`keyup` for `Shift` on `window` (the canvas never holds keyboard focus) and cleared on `blur`. While the lot is drawing (`lot.mode === 'draw'`), it writes nothing and the draw bar's cursor stands.
  - **Dragging state.**
    - `pointerdown` on the element starts a drag: `'spin'` when `button === 2 || shiftKey || ctrlKey || metaKey`, otherwise `'pan'` for button 0.
    - `pointerup` and `pointercancel` clear it.
    - A touch pointer (`pointerType === 'touch'`) never sets it.
  - **Writing the cursor.** Each change of `overPart`, `shift` or `dragging` (all refs) writes `element.style.cursor = sceneCursor(…)` directly. Unmount restores `''`.
  - **Hover.**
    - The groups call the hover setter: `onPointerOver` → `true`, `onPointerOut` → `false`. Both call `event.stopPropagation()` and skip while `lit !== null`.
    - Hover never changes what is drawn (D9: no hover boxes).
    - Known gap: Shift + wheel pans (`create-wheel-router.ts:57`) while the cursor says spin. The cursor speaks for a drag only. Leave it.

- [ ] **Step 4: Run.** Expected: `ok`. Confirm `grep -rn "gestures=" src` shows only the trade scene rig, so the roof-cutaway lab and look-dev rigs are unchanged. `grep -rn "useState" src/features/trade-scenes/hooks/use-scene-cursor.ts` prints nothing.
- [ ] **Step 5: Run the global checks.** Commit every file in the Files block under the commit rules, with: `feat(trade-scenes): a drag pans and Shift + drag spins, and the cursor says which`.

### Task 6: The system action card

**Files:**
- Create: `lib/system-actions.ts`, `ui/components/controls/system-action-card.tsx`, `system-actions-row.tsx`, `system-action-button.tsx`
- Delete: `ui/components/controls/system-card.tsx`, `look-inside-button.tsx`
- Modify: `ui/components/controls/systems-section.tsx:8,32`, `ui/components/controls/lot-areas-section.tsx:10,41` (it renders the card for a yard too), `system-card-body.tsx` (drop `LookInsideButton`; `LookInsideBody` stays under the rows while `lookInside`), `yard-card-body.tsx:164-176` (the two draw buttons move out; the `drawHint` paragraph stays in the yard body, under the rows, as the one line of help), `constants/home-scene-copy.ts` (§3), `constants/scene-control-icons.ts` (`SYSTEM_ACTION_ICONS`), `constants/controls-classes.ts` (`actionButton`), `types.ts` (`SystemActionId`; foreign-hunk gate applies)
- Modify: `hooks/use-scene-shortcuts.ts:110-112` (`[data-yard-draw]` focus target unchanged: the row's yard buttons keep `data-yard-draw`), `ui/lib/leave-look-inside.ts:22` (`[data-look-inside]` now on the action button)
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `focusCamera` and `toggleLookInside` (Task 1). `canLookInside` and `homeSpotContext`.
- Produces:
  - `type SystemActionId = 'focus' | 'look-inside' | 'draw-region' | 'draw-fence'`.
  - `interface SystemAction { id: SystemActionId, label: string, pressed: boolean | null, run: () => void }`, where `pressed: null` means the action is not a toggle.
  - `systemActions(subject: HomeSystemId | 'year-built' | YardId, state: { cameraFocus: HomeSystemId | null, moved: boolean, lookInside: boolean, canLookInside: boolean }, run: { focusCamera: () => void, toggleLookInside: () => void, draw: (tool: 'ground' | 'fence') => void }): SystemAction[]`.
  - `SystemActionCard({ subject }: { subject: HomeSystemId | 'year-built' | YardId })`.
  - Copy:
    - `CONTROLS_COPY.systems.cardTitle(label)`.
    - `SYSTEM_ACTION_COPY = { focus: 'Focus', lookInside: 'Look inside' }`. The yard actions' labels stay `LOT_COPY.drawRegion` / `LOT_COPY.drawFence`.
    - `CONTROLS_COPY.systems.showing` and `LOOK_INSIDE_COPY` are deleted (`.open` has no other reader).
  - `CONTROLS_CLASSES.actionButton`, modelled on `railChip` (`controls-classes.ts:21`): `h-10 rounded-full`, `font-bold`, the same hover, press and `aria-pressed:bg-muted aria-pressed:inset-ring aria-pressed:inset-ring-primary` states. Not shadcn's `variant="outline"`, which `theme-conventions.md` rules out for a neutral button on a card.

- [ ] **Step 1: Write the failing tests.**

```ts
const noop = { focusCamera: () => {}, toggleLookInside: () => {}, draw: () => {} }
const at = (over: Partial<Parameters<typeof systemActions>[1]> = {}) => ({ cameraFocus: null, moved: false, lookInside: false, canLookInside: true, ...over })
const ids = (actions: SystemAction[]) => actions.map(action => [action.id, action.pressed])
assert.deepEqual(ids(systemActions('roof', at(), noop)), [['focus', false], ['look-inside', false]], 'a system: Focus and Look inside')
assert.deepEqual(ids(systemActions('foundation', at({ canLookInside: false }), noop)), [['focus', false]], 'no Look inside where the home has none')
assert.deepEqual(ids(systemActions('roof', at({ cameraFocus: 'roof' }), noop)), [['focus', true], ['look-inside', false]], 'Focus pressed while it frames the pick')
assert.deepEqual(ids(systemActions('roof', at({ cameraFocus: 'roof', moved: true }), noop)), [['focus', false], ['look-inside', false]], 'a hand move un-presses Focus')
assert.deepEqual(ids(systemActions('roof', at({ cameraFocus: 'roof', lookInside: true }), noop)), [['focus', true], ['look-inside', true]], 'Look inside pressed')
assert.deepEqual(ids(systemActions('year-built', at(), noop)), [], 'Year built has no actions')
assert.deepEqual(ids(systemActions('back-yard', at(), noop)), [['draw-region', null], ['draw-fence', null]], 'a yard draws')
assert.equal(CONTROLS_COPY.systems.cardTitle(HOME_SYSTEM_LABELS.walls), 'Walls system', 'the card says system')
```

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Implement.**
  - **`SystemActionCard`.** Copy `SystemCard` and make these changes:
    - The title is `cardTitle(HOME_SYSTEM_LABELS[system])` for a system. A yard and Year built keep their titles.
    - The tag `<span data-system-tag>` is removed in every shape. Year built's `setsToday` line moves to the top of `YearBuiltCardBody` as a muted `text-xs` line.
    - `SystemActionsRow` sits in the header's second row, under the title, inside the same border-bottom block. It renders nothing when the list is empty.
    - `data-system-card` stays. Rename the remaining identifiers (`SystemCardProps` and others) and the file's comment.
  - **`SystemActionsRow`.** It builds the state from the store, the camera store's `moved`, and `canLookInside(system, homeSpotContext(state))`. It builds `run` from `useSceneControls()`, and from `startDrawing(editor, tool)` for a yard. It renders `SystemActionButton` per action. There is no overflow menu: no subject has more than three actions.
  - **`SystemActionButton`.** A `<button type="button">` with `CONTROLS_CLASSES.actionButton`, the icon from `SYSTEM_ACTION_ICONS` (`focus: LocateIcon`, `look-inside: ScanSearchIcon`, `draw-region: SquareDashedIcon`, `draw-fence: FenceIcon`), and the label.
    - It carries `aria-pressed` when `pressed !== null`.
    - Data attributes: `data-look-inside` on Look inside, and `data-yard-draw="ground" | "fence"` on the draw buttons, which keeps the Escape focus targets.
    - Focus (`LocateIcon`) and Recenter (`LocateFixedIcon`) look alike when both show. Check them side by side in Task 12's shot 5, and flag it to the owner if they read as one.

- [ ] **Step 4: Run.** Expected: `ok`. `grep -rn "SystemCard\b\|system-card'\|LookInsideButton\|LOOK_INSIDE_COPY\|systems.showing" src scripts` prints only `SystemCardBody`, `SystemCardRow` and `system-card-bottom` hits.
- [ ] **Step 5: Run the global checks.** Commit every file in the Files block, including the two deleted files, under the commit rules, with: `feat(trade-scenes): the system action card, titled "<X> system", with Focus, Look inside and the yards' draw actions in one row`.

### Task 7: One source for a material's inputs and a system's lists

**Files:**
- Create: `lib/material-input-groups.ts`, `ui/components/controls/material-input-group.tsx`, `lib/system-input-slots.ts`, `lib/system-build-entries.ts`
- Modify: `ui/components/controls/existing-chip.tsx:46-91`, `ui/components/controls/system-card-body.tsx:43-117`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - `type MaterialInputGroupId = 'hvac-components' | 'ac-tons' | 'paint-colors' | 'gutter-colors' | 'condition' | 'wear'`.
    - `condition` is the `WearDots` / `GutterWearDots`.
    - `wear` is `PaintWearFields` (exterior paint) or `CoveringWearFields` (roof), which today sit inside `ConditionMenuGroup` at `existing-chip.tsx:85-90`.
  - `materialInputGroupIds(slot: SceneChangeSlot, slots: readonly SceneChangeSlot[], material: ResolvedHomeMaterial | null): MaterialInputGroupId[]`. This pure function holds the rules that `existing-chip.tsx:46-91` has inline today.
  - `MaterialInputGroup({ id, slot, slots, material }): ReactNode` renders one group's **body** only, with no header and no wrapper. One component, one file; no hook returns React elements.
  - `materialInputGroupHeader(id, slot): string | null` in `lib/material-input-groups.ts`. It returns the header text the chip shows today, or null for `condition` and `wear` (`ConditionMenuGroup` carries its own).
  - `systemInputSlotIds(system: HomeSystemId, home: ResolvedHomeMaterials, slots: readonly SceneChangeSlot[]): { slotId: string, material: ResolvedHomeMaterial | null }[]`. It returns the system's materials plus the gutters (with the roof) and air sealing (with the attic insulation), as `system-card-body.tsx:43-47` builds them.
  - `type BuildSwitchId = 'replace:fascia' | 'upgrade:cool-roof' | 'upgrade:r8-ducts' | 'upgrade:cool-paint' | 'upgrade:r38-insulation' | 'style:batts'`.
  - `systemBuildEntries(rows: HomeSystemRow[], picks: readonly string[], upgrades: readonly EfficiencyUpgradeId[]): { row: HomeSystemRow, picked: string | null, kind: WorkDetailsKind | null, switches: BuildSwitchId[] }[]`. It is built on `upgradeRowState` and `workDetailsKind`, and holds the switch order and conditions that `system-card-body.tsx:100-117` has inline (for example, the cool roof only while `kind === null`, and the fascia only on the paint row). A blocked row comes back with `switches: []`.

- [ ] **Step 1: Write the failing tests.** Use the slots of `sceneChangeSlots(HOME_SCENE_DEFAULTS, resolveScene(…), year)`, as the existing slot checks build them.

```ts
assert.deepEqual(materialInputGroupIds(slotOf('heating-cooling'), slots, home['heating-cooling']!), ['hvac-components', 'ac-tons', 'condition'], 'heating & cooling: equipment, AC size, condition')
assert.deepEqual(materialInputGroupIds(slotOf('exterior-paint'), slots, home['exterior-paint']!), ['paint-colors', 'condition', 'wear'], 'paint: colours, condition, then its paint wear')
assert.deepEqual(materialInputGroupIds(slotOf('roof'), slots, home.roof!), ['condition', 'wear'], 'the roof: condition, then its roof wear')
assert.deepEqual(materialInputGroupIds(slotOf('gutters'), slots, null), ['gutter-colors', 'condition'], 'gutters: colours then condition')
assert.deepEqual(materialInputGroupIds(slotOf('air-sealing'), slots, null), [], 'air sealing has nothing to ride')
assert.deepEqual(systemInputSlotIds('roof', home, slots).map(entry => entry.slotId), ['roof', 'gutters'], 'the roof brings the gutters')
assert.deepEqual(systemBuildEntries(roofRows, [], []).filter(entry => entry.picked !== null), [], 'nothing picked, nothing in the build')
assert.deepEqual(systemBuildEntries(roofRows, [SCOPE_IDS.roofTearOff], []).filter(entry => entry.picked !== null).map(entry => entry.picked), [SCOPE_IDS.roofTearOff], 'a pick shows its row')
```

  - `roofRows` is `upgradeRows(facts, picks, upgrades).find(entry => entry.id === 'roof')!.rows`, built from `HOME_SCENE_DEFAULTS` as the existing row checks build it.
  - `SCOPE_IDS.roofTearOff` is the existing constant. There is no `reroof`.
  - Correct the expected ids to the code's real slot ids and row order if they differ, and say so in the report.

- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `ExistingChip` renders each id through `MaterialInputGroup`. It draws the header div from `materialInputGroupHeader` and the `menuRow` around the colour groups, and wraps `condition` + `wear` in its `ConditionMenuGroup`, as today. The menu must look the same before and after: compare the class names in the diff.
  - `SystemCardBody` builds `existing` from `systemInputSlotIds` and `proposed` from `systemBuildEntries`. It renders exactly the chips it renders today.
- [ ] **Step 4: Run.** Expected: `ok`.
- [ ] **Step 5: Run the global checks.** Commit every file in the Files block under the commit rules, with: `refactor(trade-scenes): a material's inputs and a system's lists come from one place, for the card and the spot chip`.

### Task 8: Spot chip placement

**Files:**
- Create: `lib/spot-chip-placement.ts`, `hooks/use-spot-chip-free.ts`
- Modify: `constants/scene-layout.ts` (a new `spotChip` entry)
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - `SCENE_LAYOUT.spotChip = { gap: 28, nameRowHalf: 27, margin: 12, stackStep: 48, markRadius: 10, lineInset: 20, sizeMs: 260, enterMs: 220 }`. These are the prototype's numbers.
  - `interface SpotChipFree { left: number, right: number, top: number, bottom: number }`, as stage px edges.
  - `spotChipFree(input: { stage: { width: number, height: number }, area: SceneVisibleArea, railShown: boolean, portrait: boolean }): SpotChipFree` in the same lib file. With `m = spotChip.margin`, it returns `{ left: area.left + m, right: stage.width − area.right − m, top: area.top + m, bottom: stage.height − max(area.bottom, railShown ? railBottom + railHeight : 0) − m }`, using `SCENE_LAYOUT.controls.railBottom[portrait ? 'portrait' : 'wide']` and `railHeight`.
    - After Task 1 the area reserves the open card whenever one is open (D16).
    - The area never reserves the rail (`scene-visible-area-for.ts:25-46`), so this function adds it.
  - `useSpotChipFree(): SpotChipFree`. It reads the stage size, `useSceneVisibleArea()` and whether the systems rail is shown, then calls `spotChipFree`.
  - `interface SpotChipPlacement { side: 'right' | 'left' | 'below', left: number, top: number, width: number, maxHeight: number, lifted: boolean }`. `left` and `top` are in stage px. The chip turns them into offsets from the point.
  - `spotChipPlacement(input: { point: { x: number, y: number }, free: SpotChipFree, widest: number, foldedHeight: number | null, current: SpotChipPlacement | null }): SpotChipPlacement`.
    - `widest` is the chip's widest width (its quick edit width), a constant from `spotChip`: the chip at rest is narrower, and the side is chosen so quick edit fits too.
    - `foldedHeight` is non-null only when quick edit has just opened or the side flipped.
    - `current` is the placement held so far.
  - `spotChipLine(point, placement, chip: { height: number }): { from: {x,y}, to: {x,y} }`. The line runs from the mark's edge to the chip's near side (`below`: its top edge), at the point's height clamped into `[top + lineInset, top + height − lineInset]`.

- [ ] **Step 1: Write the failing tests.** Use a free region of `{ left: 12, right: 1104, top: 12, bottom: 742 }` and a widest chip of 360.

```ts
const free = { left: 12, right: 1104, top: 12, bottom: 742 }
const first = spotChipPlacement({ point: { x: 400, y: 300 }, free, widest: 360, foldedHeight: null, current: null })
assert.deepEqual(first, { side: 'right', left: 428, top: 273, width: 360, maxHeight: 469, lifted: false }, 'right of the point, its name row level with it')
assert.equal(spotChipPlacement({ point: { x: 900, y: 300 }, free, widest: 360, foldedHeight: null, current: null }).side, 'left', 'left near the dock')
assert.deepEqual(pick(spotChipPlacement({ point: { x: 560, y: 300 }, free: { ...free, right: 900 }, widest: 560, foldedHeight: null, current: null }), ['side', 'left', 'top']), { side: 'below', left: 280, top: 328 }, 'neither side fits: centred under the point')
assert.deepEqual(pick(spotChipPlacement({ point: { x: 200, y: 300 }, free: { ...free, right: 284 }, widest: 360, foldedHeight: null, current: null }), ['side', 'left', 'width']), { side: 'below', left: 12, width: 272 }, 'a 390 px portrait stage: below, clamped, at the free width')
assert.equal(spotChipPlacement({ point: { x: 400, y: 20 }, free, widest: 360, foldedHeight: null, current: null }).top, 12, 'clamped into the free region')
const lifted = spotChipPlacement({ point: { x: 400, y: 600 }, free, widest: 360, foldedHeight: 400, current: spotChipPlacement({ point: { x: 400, y: 600 }, free, widest: 360, foldedHeight: null, current: null }) })
assert.deepEqual([lifted.top, lifted.lifted], [342, true], 'quick edit lifts once, just enough for the folded panel')
const after = spotChipPlacement({ point: { x: 400, y: 600 }, free, widest: 360, foldedHeight: null, current: lifted })
assert.equal(after.top, lifted.top, 'a fold opening later never moves it')
assert.equal(after.maxHeight, 742 - 342, 'past the room left, the panel scrolls')
assert.equal(spotChipPlacement({ point: { x: 400, y: 300 }, free, widest: 360, foldedHeight: 200, current: first }).top, first.top, 'a folded panel that fits never lifts')
assert.equal(spotChipPlacement({ point: { x: 400, y: 600 }, free, widest: 360, foldedHeight: 300, current: lifted }).top, lifted.top, 'a flip whose folded height fits keeps the corner')
const shrunk = spotChipPlacement({ point: { x: 400, y: 300 }, free: { ...free, bottom: 600 }, widest: 360, foldedHeight: null, current: first })
assert.deepEqual([shrunk.top, shrunk.maxHeight], [273, 327], 'a smaller free region never moves it; only its room shrinks')
assert.deepEqual(spotChipFree({ stage: { width: 1194, height: 834 }, area: { left: 0, right: 94, top: 0, bottom: 80 }, railShown: true, portrait: false }), { left: 12, right: 1088, top: 12, bottom: 690 }, 'the free region leaves the rail out')
```

  `pick` is a two-line local helper in the script.

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Implement.** The rules, in order:
  1. Width: `min(widest, free.right − free.left)`.
  2. Side: with `current`, keep `current.side` and `current.left`. Otherwise use right when `point.x + gap + width <= free.right`, else left when `point.x − gap − width >= free.left`, else `'below'`. Left edge: right `point.x + gap`; left `point.x − gap − width`; below `clamp(point.x − width / 2, free.left, free.right − width)`.
  3. Top: with `current`, keep `current.top`. Otherwise `clamp(point.y − nameRowHalf, free.top, free.bottom − 2 * nameRowHalf)`. `'below'` uses `point.y + gap`, clamped the same way.
  4. Lift: when `foldedHeight !== null`, `top = max(free.top, min(top, free.bottom − foldedHeight))`, and `lifted` is true when `top` changed.
  5. `maxHeight = free.bottom − top`.

- [ ] **Step 4: Run.** Expected: `ok`.
- [ ] **Step 5: Run the global checks.** Commit every file in the Files block under the commit rules, with: `feat(trade-scenes): where a spot chip stands, pinned beside the point and lifting at most once`.

### Task 9: The spot chip at rest

**Files:**
- Create: `ui/components/spot-chip/spot-chips.tsx` (the host for one tap), `spot-chip.tsx`, `spot-chip-head.tsx`, `spot-chip-mark.tsx`
- Delete: `ui/components/spot-pin.tsx`, `SYSTEM_PIN_LABELS` in `constants/home-scene-copy.ts:496`
- Modify: `ui/components/home-scene-canvas.tsx` (render), `constants/home-scene-copy.ts` (`QUICK_EDIT_COPY`), `constants/controls-classes.ts` (`spotChip`), `contexts/scene-controls-context.tsx` (`pickFromPin` → `pickFromChip`), `src/shared/components/scene/ui/scene-pins-projector.tsx` (`data-off-stage`)
- Test: `scripts/verify-trade-scene.ts` (copy checks, and the source check at ≈`:3681` that reads `spot-pin.tsx`)

**Interfaces:**
- Consumes:
  - `spotChipPlacement`, `spotChipLine` and `useSpotChipFree` (Task 8).
  - `TappedSpot` and `spotFromPinId` (Task 4).
  - `pickFromPin`, renamed to `pickFromChip`.
- Produces:
  - `SpotChips({ spot }: { spot: HomeSpotId })`. One host per tap, keyed by `tappedSpot.id`. It places the stack once and renders a `SpotChip` per `systemsAtSpot` system.
  - `SpotChip({ system, offset }: { system: HomeSystemId, offset: { left: number, top: number } })`.
  - `QUICK_EDIT_COPY = { edit: (label) => \`Quick edit ${label}\`, done: 'Done editing', openCard: (label) => \`Open the ${label} system\`, wearFold: { 'exterior-paint': 'Paint wear', roof: 'Roof wear' }, nothingInBuild: (label) => \`Nothing for ${label.toLowerCase()} in the build yet.\`, addInCard: 'Add in the system card' }` (D18).

- [ ] **Step 1: Write the failing tests.**

```ts
assert.equal(QUICK_EDIT_COPY.openCard(HOME_SYSTEM_LABELS.walls), 'Open the Walls system', 'the chip\'s name opens the card')
assert.ok(!('SYSTEM_PIN_LABELS' in HOME_SCENE_COPY), 'the pin labels are gone')
const head = readFileSync('src/features/trade-scenes/ui/components/spot-chip/spot-chip-head.tsx', 'utf8')
assert.match(head, /HOME_SYSTEM_LABELS\[system\]/, 'the chip shows the system\'s own label')
assert.doesNotMatch(head, /cardTitle/, 'the chip never says system')
```

  The source check at ≈`:3681` reads `spot-pin.tsx` for `pickFromPin(system)`. Point it at `spot-chip-head.tsx` and `pickFromChip(system)`.

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Implement.**
  - **Mounting.** `ScenePins` renders `<SpotChips key={tappedSpot.id} spot={…} />` for the spot pin, so a second tap on the same spot places a fresh chip.
  - **Placement waits for the projector.** The anchor registers in an effect, and the pin element sits at the stage's top-left until the next frame places it (`scene-anchor.tsx:20-28`, `scene-pins.tsx:36-50`, `scene-pins-projector.tsx:13-31`). So `SpotChips` watches its anchored element's `data-anchored` attribute with a `MutationObserver`. On the first `data-anchored`, it reads the element's `getBoundingClientRect()` against `stageElement`, runs `spotChipPlacement` with `useSpotChipFree()`, and stores the placement. Nothing renders before then.
  - **Offsets.** Each chip is positioned relative to the point at `left = placement.left − pointX` and `top = placement.top − pointY + stackIndex * stackStep`. These stay fixed while the projector moves the anchor, so the chip follows the point.
  - **Off the stage.** The projector hides a point only behind the camera (`scene-pins-projector.tsx:24`), and the pins' `overflow-hidden` clips a pin at the edge. A chip offset from its point would still show when the point leaves. So the shared projector also sets `data-off-stage` on the element while `x < 0 || x > size.width || y < 0 || y > size.height`, and removes it otherwise; a pin that ignores it is unchanged. `SpotChips` hides by opacity while its element carries `data-off-stage`, and comes back with the point. Add a source check named "the projector marks a point off the stage" that matches `data-off-stage` in `scene-pins-projector.tsx`.
  - **Mark and line.** `SpotChipMark` draws the ring: 20 px, a 2 px `--presentation-accent` border, at the origin. It also draws the line from `spotChipLine`, 2 px in the same accent at 70% opacity. Both are `aria-hidden` and `pointer-events-none`. No hover box is ever drawn (D9).
  - **`SpotChipHead`.**
    - The name button is `HOME_SYSTEM_LABELS[system]` at `text-base font-bold` (700; lint stops weights there, so the prototype's 800 is not used), with a 44 px tap target. It carries a trailing `PanelRightOpenIcon` and `aria-label={openCard(label)}`. It calls `claimTap()`, then `pickFromChip(system)`, which opens the card and clears `tappedSpot`.
    - The pencil button (`PencilIcon`) uses `aria-label={edit(label)}`. Task 10 makes it work; until then, render it disabled.
  - **Chip surface.** `bg-card border rounded-[26px] shadow-2xl`, using the controls' tokens and no new colours. Put the class string in `CONTROLS_CLASSES.spotChip`.
  - **Entry.** It comes in with opacity and an 8 px x-slide from the point's side over `enterMs`. It is instant under reduced motion.
  - **Delete** `SpotPin` and `SYSTEM_PIN_LABELS`.

- [ ] **Step 4: Run.** Expected: `ok`. `grep -rn "SpotPin\b\|SYSTEM_PIN_LABELS\|pickFromPin" src scripts` prints nothing.
- [ ] **Step 5: Run the global checks.** Commit every file in the Files block, including the deleted `spot-pin.tsx`, under the commit rules, with: `feat(trade-scenes): a tap opens a spot chip at the point, whose name opens the system's card`.

### Task 10: Quick edit

**Files:**
- Create: `ui/components/spot-chip/quick-edit.tsx`, `quick-edit-today.tsx`, `quick-edit-build.tsx`, `wear-fold.tsx`, `lib/wear-summary.ts`
- Modify: `ui/components/spot-chip/spot-chips.tsx`, `spot-chip.tsx`, `spot-chip-head.tsx`, `lib/escape-step.ts`, `hooks/use-scene-shortcuts.ts:57-60,131-134`
- Test: `scripts/verify-trade-scene.ts:3614-3625` (escapeStep block)

**Interfaces:**
- Consumes:
  - `materialInputGroupIds`, `MaterialInputGroup`, `systemInputSlotIds` and `systemBuildEntries` (Task 7).
  - `TappedSpot.editing` (Task 4).
  - `WorkDetails`, `UpgradeSwitch`, `ChoicePill`, `MissingChip`, `CollapseRegion` (`controls/collapse-region.tsx`).
  - `paintWearInForce` (`lib/paint-wear-in-force.ts:9`), `coveringWearInForce` (`lib/covering-wear-in-force.ts:9`) and `wearInForce` (`shared/modules/construction/core/lib/resolve-home-materials.ts:21`).
- Produces:
  - `wearSummary<K extends string>(levels: Partial<Record<K, PaintWearLevel>>, labels: Record<K, string>): string`. Kinds above `none` read as `${label} ${level label lowercased}`, joined by `' · '`. With none above `none` it returns `PAINT_WEAR_LEVEL_LABELS.none`.
  - `wearFoldSummary(material: ResolvedHomeMaterial | undefined, recorded: Partial<PaintWear> | Partial<CoveringWear>, kind: 'paint' | 'covering', roofType: RoofType): string | null`. It summarises the **levels in force**, the ones the fields inside the fold show, so a Poor paint with nothing recorded never reads "None". It returns null (the fold is hidden) when there is no material or `wearInForce(material) === 'new'`, as the fields hide themselves then.
  - `escapeStep` context: `pins` becomes `spotChip: boolean`, and it gains `editing: boolean` and `fold: boolean`. The returned union gains `'fold' | 'quick-edit'`, and `'pins'` becomes `'spot-chip'`.

- [ ] **Step 1: Write the failing tests.**

```ts
assert.equal(wearSummary({ cracks: 'moderate', stains: 'light', peeling: 'none' }, PAINT_WEAR_LABELS), 'Cracks moderate · Stains light', 'the fold reads its set levels')
assert.equal(wearSummary({}, PAINT_WEAR_LABELS), 'None', 'with none set it says None')
assert.equal(wearFoldSummary(poorPaint, {}, 'paint', 'shingle'), wearSummary(paintWearInForce(poorPaint, {}), PAINT_WEAR_LABELS), 'the fold reads the levels in force, as its fields do')
assert.notEqual(wearFoldSummary(poorPaint, {}, 'paint', 'shingle'), 'None', 'a poor paint with nothing recorded never reads None')
assert.equal(wearFoldSummary(newPaint, {}, 'paint', 'shingle'), null, 'new paint has no fold')
const bareChip = { ...bare, spotChip: false, editing: false, fold: false }
assert.equal(escapeStep({ ...bareChip, menu: true, spotChip: true, editing: true, fold: true }), 'menu', 'a value menu inside quick edit closes first')
assert.equal(escapeStep({ ...bareChip, spotChip: true, editing: true, fold: true }), 'fold', 'then the fold')
assert.equal(escapeStep({ ...bareChip, spotChip: true, editing: true }), 'quick-edit', 'then quick edit')
assert.equal(escapeStep({ ...bareChip, spotChip: true }), 'spot-chip', 'then the chip')
```

  - `poorPaint` and `newPaint` are the resolved exterior-paint material at the wear values the paint-wear checks already build; reuse those fixtures.
  - Update the existing escape cases at `:3614-3625`: rename `pins` to `spotChip` and `'pins'` to `'spot-chip'`, and add `editing: false, fold: false` to `bare`.

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Implement.**
  - **The pencil.** It writes `{ tappedSpot: { ...tappedSpot, editing: system } }` (never a mutation). The × (`XIcon`, `aria-label={done}`) writes `editing: null`. While either chip of a stack is editing, the other hides, and the editing chip takes the stack's first slot, so the lift never has to count a stack offset.
  - **`QuickEdit`.**
    - A side line (`SCENE_VIEW_LABELS[view]`, muted `text-xs`, with the build's accent when proposed).
    - Then `QuickEditToday` or `QuickEditBuild`, keyed by `view`, so a flip remounts it and the fold resets.
    - Rows rise in a 30 ms stagger, on open only.
  - **`QuickEditToday`.**
    - It renders one section per `systemInputSlotIds(system, targets.home, slots)`, the same list the card reads.
    - Each section has the material's name as its header, a `ChoicePill` over `slot.options`, and then its groups from `materialInputGroupIds`, each through `MaterialInputGroup`. Headers come from `materialInputGroupHeader`.
    - `condition` renders directly. `wear` goes inside a `WearFold`.
    - A foundation with `foundationType === null` shows `MissingChip`, as the card does.
  - **`WearFold`.**
    - A trigger button with `aria-expanded` and `data-wear-fold`, plus `data-state="open" | "closed"`, over `CollapseRegion` (the controls' own disclosure, already on `CONTROLS_EASE`). No new Collapsible.
    - Its trigger row shows `QUICK_EDIT_COPY.wearFold[material id]` ("Paint wear" or "Roof wear", D18), the `wearFoldSummary`, and a chevron. With a null summary, nothing renders.
    - When it opens past the room left, it scrolls its rows into view smoothly. Reduced motion jumps instead.
  - **`QuickEditBuild`.**
    - It renders one section per `systemBuildEntries(rows, picks, upgrades)` entry whose `picked !== null`. Each has the row's `PART_LABELS` header and a `ChoicePill` over `row.scopeIds` when there are several, using the `build:<part>` slot's options. It also has `WorkDetails` for `entry.kind`, with the same `upgrade` argument `SystemCardBody.details` passes. Then come `entry.switches`, rendered as the card renders them.
    - `UpgradeSwitch`'s reason path (a `ProposedChip kind="reason"` popover) still opens its popover, portalled to the stage as today (spec §4.3).
    - With none picked, it shows `nothingInBuild(label)` and a `Button variant="link"` labelled `addInCard`, which calls `pickFromChip(system)`.
    - Slab, foundation and the `noneOnSlab` note behave as the card does.
  - **Size motion** (`SpotChip`):
    - Measure the content at its final size with a `ResizeObserver` on an inner wrapper. That wrapper's width is fixed to the final width while the box animates.
    - Animate the outer box's `width` and `height` with `motion.div animate={{ width, height }}` over `sizeMs` with `CONTROLS_EASE`.
    - On quick edit opening, or on a flip while editing, `SpotChips` re-runs `spotChipPlacement` with `foldedHeight` = the measured folded height (fold closed) and `current` = the held placement. Animate `top` in the same transition.
    - The body is `overflow-y-auto overscroll-contain` with `maxHeight`. Keep `scrollTop` across re-renders; a pick never resets it.
  - **`escapeStep` order:**
    1. `menu`
    2. `drawing`
    3. While `open === null && spotChip`: `fold`, then `quick-edit`, then `spot-chip`.
    4. `look-inside`
    5. The Systems branch, as today (Task 0's `'card'`).

    A chip and Look inside never coexist (taps are ignored while lit). A house tap with Systems open shows the chip and leaves the card, because `close` leaves `tappedSpot` alone (Task 1).
  - **Escape.** In `use-scene-shortcuts.ts`, build the context:
    - `spotChip`: `tappedSpot !== null`.
    - `editing`: `tappedSpot?.editing != null`.
    - `fold`: `stage.querySelector('[data-wear-fold][data-state="open"]') !== null`.

    Then:
    - `'fold'` clicks that fold's trigger.
    - `'quick-edit'` writes `editing: null` and focuses the chip's pencil.
    - `'spot-chip'` writes `tappedSpot: null`.
  - **Tap-away.** Tapping the empty scene still clears `tappedSpot`, which closes quick edit with it.

- [ ] **Step 4: Run.** Expected: `ok`.
- [ ] **Step 5: Run the global checks.** Commit every file in the Files block under the commit rules, with: `feat(trade-scenes): quick edit changes the side shown in place, inside the spot chip`.

### Task 11: Quick summary

**Files:**
- Create: `lib/outside-temperature.ts`, `ui/components/scene-summary/scene-summary.tsx`, `summary-slot.tsx`
- Modify: `ui/components/scene-stage.tsx` (mount), `constants/scene-layout.ts` (`summary`), `constants/scene-control-icons.ts` (`WEATHER_SUMMARY_ICONS`), `constants/home-scene-copy.ts` (`SUMMARY_COPY.label`), `constants/controls-classes.ts` (`summaryPill`), `ui/views/property-layout-lab-view.tsx:86` only if the lab badge needs the summary's room (see below)
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - `outsideTemperature(state: Pick<TradeSceneInputs, 'weather' | 'climate'>): number | null`.
  - `SUMMARY_COPY.label({ weather, outside, thermal }): string`, which returns, for example, `'Summer, 100°F outside, thermal on'`. It builds from `WEATHER_LABELS[weather]` and `READING_COPY.unit` (`home-scene-copy.ts:17,117`), never a repeated "Summer" or "°F".
  - `SCENE_LAYOUT.summary = { top: 16, left: 16, height: 36, icon: 18, row: 20, slotMs: 320, leaveMs: 200, rise: 10, flameNudge: 0.5 }`.

- [ ] **Step 1: Write the failing tests.**

```ts
assert.equal(outsideTemperature({ weather: 'summer', climate: 'inland' }), 100, 'inland summer')
assert.equal(outsideTemperature({ weather: 'winter', climate: 'coastal' }), 45, 'coastal winter')
assert.equal(outsideTemperature({ weather: 'normal', climate: null }), CLIMATE_PRESETS[CLIMATE_FALLBACK].normal.outside, 'no climate falls back')
assert.equal(outsideTemperature({ weather: 'rain', climate: 'inland' }), null, 'rain has no temperature')
assert.equal(SUMMARY_COPY.label({ weather: 'summer', outside: 100, thermal: true }), 'Summer, 100°F outside, thermal on', 'the summary\'s words')
assert.equal(SUMMARY_COPY.label({ weather: 'rain', outside: null, thermal: false }), 'Rain', 'rain says only rain')
```

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Implement.**
  - **`SceneSummary`.**
    - It is read-only: `role="status"`, `aria-label`, and `title` set from `SUMMARY_COPY.label`. It has no buttons.
    - Position: absolute at `summary.top`/`summary.left` on the stage. Check that nothing else sits in the top-left corner at 1194×834 and 390×844, and move to the free corner if something does.
    - A pill 36 px tall in `CONTROLS_CLASSES.summaryPill`: `bg-scrim/70 text-on-media rounded-full px-3`, the feature's read-only overlay look (`panel/thermal-legend.tsx:25`). No `backdrop-blur` and no muted text, which falls below the contrast floor over a summer sky.
    - Contents: the weather `SummarySlot` (`WEATHER_SUMMARY_ICONS`: `CloudSunIcon`, `SunIcon`, `MoonIcon`, `CloudRainIcon`), then the °F slot (none in rain, D19), then `THERMAL_ICON` (`scene-control-icons.ts:8`) while `thermalCamera`, untinted as the dock draws it (`dock/dock-thermal.tsx:36`) and nudged up `flameNudge` px. No status colour.
    - It is hidden when `shape !== 'landscape'` and any system action card is open (a system, Year built or a yard: the measured `openCardBottom !== null`), since the card spans the top then.
    - The corner: the trade scene's top left is free. In the layout lab the lab badge stands at `top-4 left-4` (`property-layout-lab-view.tsx:86`), and `LayoutEditorPanel` starts at `top-16`. There, the summary sits right of the badge: the stage offsets the summary's `left` by the badge's measured width plus 8 px when the badge is present (a `data-lab-badge` attribute on it). *(Claude's call.)*
  - **`SummarySlot` (`{ value: string, children }`).** It stays mounted.
    - On a value change, the leaving node takes `position: absolute` at once and rolls up and out (opacity, −`rise` px, `leaveMs`). The entering one rises in (opacity, +`rise` px, `slotMs`, 50 ms delay).
    - The slot's `width` animates from the old measured width to the new one over `slotMs`.
    - The flame slot enters and leaves by `width` and opacity.
    - Use motion's `AnimatePresence mode="popLayout"` or the Web Animations API on refs. Never `layout` and never scale.
    - Alignment: one `summary.row` row, icons `display: block` at `summary.icon`, and the number `leading-none tabular-nums` with `[text-box:trim-both_cap_alphabetic]`.
    - Reduced motion: instant.

- [ ] **Step 4: Run.** Expected: `ok`.
- [ ] **Step 5: Run the global checks.** Commit every file in the Files block under the commit rules, with: `feat(trade-scenes): a quick summary of the weather, the outside temperature and Thermal`.

### Task 12: Glossary check, sweep and the rendered check

**Files:**
- Read only: `CONTEXT.md`. The six entries (Pick, Focus, System action card, Spot chip, Quick edit, Quick summary) and the reworded Look inside were written at the stress test, on top of the texture session's uncommitted edits. The owner commits `CONTEXT.md`; the build never stages it.
- Shots: `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/scene-layout-lab/.superpowers/sdd/2026-11-13-scene-spot-chip/shots/`

- [ ] **Step 1: Check the glossary against the build.** Each entry still says what the code does: the names in code, Paint wear / Roof wear, no °F in rain, and the card's room. Report any drift to the owner; do not edit `CONTEXT.md`.
- [ ] **Step 2: Sweep.**
  - `grep -rn "cameraFocus" src/features/trade-scenes` lists only the camera readers in spec §4.1's table and `focusCamera` / `toggleLookInside`.
  - `grep -rnE "spot pin|Spot pin|system card's\b|in focus" src/features/trade-scenes` finds no stale comment. One known: `systems-section.tsx:16` ("the system the camera holds") now reads "the picked system".
- [ ] **Step 3: Take the rendered check.** Ask the owner whether `:3003` is running (`ss -ltnp | grep 3003`). If it is not, stop here and report. If it is, take **one** batch under the heavy lock.
  - Settings: iPad landscape 1194×834, dark scheme, `/dashboard/trade-scene`, Playwright auth via `/api/dev/playwright-session`.
  - Model the script on `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/trade-scenes/.superpowers/sdd/2026-11-09-trade-scene-gutters/shots/t4-walk.mjs`.
  - Take five shots:
    1. A wall tap: the chip at the point. Then its quick edit.
    2. Paint's Paint wear fold open. Compare the chip's name-row box with shot 1; it must be the same within 1 px.
    3. Windows, Look inside: the left front window is solid.
    4. Summer with Thermal on: the summary.
    5. The Walls card: "Walls system", the actions row, no badge, and the house slid clear of the card at the same angle as before the pick. Recenter beside Focus: say whether their icons read apart.
- [ ] **Step 4: Report** the five shot paths, the 1 px measurement and the Focus / Recenter icon read. The owner's iPad check follows: one-finger pan, two-finger spin and pinch, the chip staying pinned while panning, and Focus → close → Recenter.
