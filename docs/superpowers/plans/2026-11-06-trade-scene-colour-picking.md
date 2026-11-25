# Trade scene colour picking (roof, paint, window frames) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the roof, the exterior paint (body and trim) and the vinyl window frames a colour pick each. The pick shows the moment the work is picked and is never lost behind a closed menu.

| Part | Spec section | Tasks |
|---|---|---|
| Product data, and where the picks are held | Constraints (R128), Left to the builder | 1 |
| Roof: the right shingle line for the switch | Roof | 2 |
| Paint body and trim on the house | Paint, Today side | 3 |
| Window frame colours on the house | Window frames | 4 |
| The details: where they appear, the switches move | Where the details appear | 5 |
| Paint pickers: combos, quick colours, more colours, the Today side | Paint, Today side | 6 |
| By-eye pass and hand-over | all | 7 |

**Architecture:**
- **Product data lives in the construction core.** That means the standard shingles, the Cool Life colours (with their families, quick set, combos and fan deck URL) and the window frame colours, beside `owens-corning-shingles.ts` (R128). The scene feature only reads them.
- **Every pick is a draw-only home material fact, held as `shingleColor` is today.** The new facts are `existingPaintColors`, `proposedPaintColors` and `windowFrameColor`. They are written through `{ kind: 'fact' }`, never reach the resolver, and never re-resolve the scene, so no saving moves.
  - One named type, `DrawingOnlyMaterialFact`, lists them for the three places that leave them out.
- **One shared details piece, `WorkDetails`.** It renders the colours and the efficiency switch that belong to a picked piece of work. Three places mount it:
  - inside the shingle roof menu, below its separator, with the menu kept open by a pick that has details;
  - last in the Build row, full width, for a toggle row that is on (repaint, new windows, wood-shake tear-off, torch down);
  - under the options of a Modify result row whose pick has details, with no switch: Modify lists the switches as rows of their own.

  Which details a pick has is one pure function, `workDetailsKind`.
- **Paint colour is two hexes, body and trim, carried on `PaintLook`.** Every painted surface already receives `PaintLook`. The trim surfaces stop reading `HOME_PALETTE.trim` and read `paint.trim`. The vinyl frames read the frame colour, so dark trim never darkens a window.

**Tech Stack:** Next.js 15, React 19.2, `@react-three/fiber` 9.8.2, three 0.180, the zustand scene store, Radix Popover / ToggleGroup / RadioGroup through the shared shadcn wrappers, and Tailwind v4. Checks are the repo's `tsx` verify scripts (`node:assert/strict`) and local Playwright screenshots.

**Spec:** `docs/superpowers/specs/2026-11-06-trade-scene-colour-picking-design.md` (approved by the owner 2026-11-06). Tracker: R267, R116 and R117 (amended 2026-11-06) in `docs/plans/2026-10-16-trade-scenes-epic.md`.

## Global Constraints

- **Binding rules, stated here.** They bind every task.
  - **Committing:**
    - Commit by explicit path only, and only if the owner says yes to per-task commits. Ask once, before Task 1.
    - Run `git diff --cached --name-only` before each commit and `git show --stat HEAD` after it.
    - `git commit` gets a 300000 ms timeout, and never `--no-verify`.
  - **Forbidden git:** never `git add -A` or `.`, stash, reset, `checkout --`, restore, amend, merge, rebase or push. Never push `feat/trade-scenes-foundation`.
  - **Files holding another session's hunks:** `git commit -- <path>` commits the whole working-tree file. If `git diff <path>` shows hunks that are not yours, stage only your own with `git apply --cached <patch>` and run a bare `git commit`.
  - **Scripted edits:** after one, run `git diff --shortstat`.
  - **Database:** no DB writes of any kind.
  - **Checks:** `pnpm tsc` and eslint only, never `pnpm build`.
  - **Dev server:** never start, stop or restart it (:3002 is the owner's), and never `rm -rf .next`. If it doesn't answer (`ss -ltnp`), stop and ask the owner.
- **Commands:**
  - `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock pnpm tsc`
  - `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock env CI=1 pnpm eslint <files>`
  - The logic checks: `pnpm tsx scripts/verify-trade-scene.ts`.
- **Paths:** `F/` = `src/features/trade-scenes/` and `CORE/` = `src/shared/modules/construction/core/`. Build records (ledger, briefs, shots) go in `.superpowers/sdd/2026-11-06-trade-scene-colour-picking/` (gitignored).
- **Base:** `feat/trade-scenes-foundation` at `b9a17c0d5` or later, in `.worktrees/trade-scenes`.
  - Before Task 1, confirm two things:
    - the last task line of `.superpowers/sdd/2026-11-05-up-close-round-2/progress.md` is `Task 12: complete (commits 346c2df84..b9a17c0d5)`, with no round-2 task in flight;
    - `git status --short -- src scripts` shows nothing. `docs/` holds other sessions' edits and is never staged.

    If either fails, stop and ask.
- **Off limits:**
  - `package.json`, eslint and tsconfig, `globals.css`, `src/shared/components/scene/**`;
  - `docs/**` and `CONTEXT.md`: builders never stage them, and tracker and spec edits are the controller's.

  Ask before editing any file this plan does not name.
- **Code rules:**
  - Comments say why, never what, and never cite a plan, spec or task.
  - One component per file, named exports. Constants go in `constants/`, pure helpers in `lib/`.
  - No defensive code: no fallback for a state the types rule out, and no `?.` on a value that is always there.
  - Every control is the shared shadcn `Button` (or the shared `ToggleGroup` / `RadioGroup` the controls already use).
- **Copy:**
  - Screen copy lives in `F/constants/home-scene-copy.ts`. Product names (colours, combos, frames, shingles) live in the CORE data.
  - Never "your", never solar. Copy functions take at most 3 arguments.
  - The exact strings in each task are used verbatim.
- **Vocabulary:**
  - Existing/proposed, never "today" in code or test messages.
  - Body, trim and combo are the owner's words.
  - The standard shingles carry no brand name.
- **Look:**
  - Pickers use `CONTROLS_CLASSES`, `ChoicePill`, `ControlsChip`, `ValueMenu` and the design-system tokens. Read `docs/design-system/theme-conventions.md` and do its §12 self-check before adding any class that sets a colour, surface or edge.
  - Swatch fills are the one non-token colour, as `shingle-colors.tsx` already says. Swatches keep the 28 px face with a 40 px reach, 12 px apart.
- **Savings never move.** No scope, part, material or bill-cut figure changes. Every new fact is drawing-only.
- **Working numbers:** the black frame hex, the details panel's spacing, and any hand-set colour are each marked as a working number in one comment on the constant, and settled by screenshot.
- **Screenshots:**
  - Page `/dashboard/trade-scene`. Wait for `data-load-phase="live"`.
  - Sign in through `/api/dev/playwright-session?…&as=info%40triprosremodeling.com`, never `role=`, and never print the secret.
  - Tasks 2–6: 1194×834 dark and light, plus 390×844 dark, only for the cases each task names. Task 7: those three plus 1194×834 dark Partly open.
  - Nothing exposes the scene store to the page, and none is added. A colour gets set through the pickers, so colour shots wait for the task that builds the picker (Tasks 5 and 6).
  - Read every PNG you take, and take no more than the list.

## Review Focus

1. **Flipping the cool roof keeps a colour that fits.**
   - Forest Brown ↔ Dark brown, Summerwood ↔ Grey brown, Sand Castle ↔ Light brown.
   - Any other cool colour clears to nothing picked.
   - The house never draws a cool colour on a standard shingle, or a standard colour on a cool one, even with a stale id held.

   Test: `shingleColorFor` and `installedShingleTone` cases (Task 2).
2. **The Today side never shows a Build colour.**
   - On the existing view, a picked repaint colour does not reach the walls, which keep the existing colours, worn.
   - An existing double-pane vinyl frame stays white whatever `windowFrameColor` says.

   Test: `paintHexes(…, false)` (Task 3) and `windowFrameLook` on an `original-frame` (Task 4).
3. **A repaint with no colour picked looks like the home, freshly painted.** Body and trim fall back to `existingPaintColors`, then to the neutral palette, with no chalk. Turning the repaint off and on keeps the picked colours, because a scope toggle never writes the paint facts. Test: `paintHexes` cases (Task 3), and an `applySceneChange` scope round trip that leaves `proposedPaintColors` as it was (Task 3).
4. **"No change" still closes the roof menu, and a pick with details keeps it open.** The arrow keys still move without closing.
   - Overlay or tear-off stays open with the details below.
   - "No change" closes.
   - Torch down is a toggle and opens its inline details.

   Test: the `workDetailsKind` cases and a Playwright walk (Task 5).
5. **The new facts never re-resolve the scene.** A change to `shingleColor`, `existingPaintColors`, `proposedPaintColors` or `windowFrameColor` selects equal resolver inputs, and survives `applySceneChange` as it was. Test: the drawing-only checks at `:535-541` and the loop at `:3074`, both extended (Task 1).
6. **A home that already has Cool Life paint can still be repainted.** It has no Cool Life switch: the repaint uses Cool Life whatever the switch says, so `sceneChangeSlots` makes no `upgrade:cool-paint` slot. Its repaint details show the colours and no switch, and nothing throws. Test: a `sceneChangeSlots` case on `exteriorPaint: 'cool'` with the repaint picked: there is no cool-paint slot, and `workDetailsKind` is still `'paint'` (Task 5).

---

### Task 1: Product data in the core, and the picks as drawing-only facts

**Files:**
- Create:
  - `CORE/constants/standard-shingles.ts`
  - `CORE/constants/cool-life-colors.ts`
  - `CORE/constants/window-frame-colors.ts`
- Modify:
  - `CORE/types.ts`: the `HomeMaterialFacts` fields, and the new interfaces after `ShingleColor` (`:199`).
  - `CORE/constants/home-materials.ts:74`: `HOME_MATERIAL_FACTS_UNSET`.
  - `F/types.ts`: `DrawingOnlyMaterialFact` in the end block, used at `:90`, `:432` and `:543`.
  - `F/lib/resolve-scene.ts:72-73`: the facts become `{ ...HOME_MATERIAL_FACTS_UNSET, ...inputs.homeMaterials }`, and the comment names the drawing-only facts generally.
  - `F/lib/scene-resolve-inputs.ts:3`: the comment only. The function already picks its keys explicitly.
  - These must widen with `shingleColor`, or `pnpm tsc` fails at this task:
    - `F/lib/installed-shingle-tone.ts:8`: the `colorId` parameter becomes `ShingleColorId | null`. Its body changes in Task 2.
    - `F/ui/components/home-kit/house-roof.tsx:31`: the `shingleColor` prop becomes `ShingleColorId | null`.
  - `scripts/verify-construction-model.ts:597`: the `facts()` helper's full `HomeMaterialFacts` literal becomes `{ ...HOME_MATERIAL_FACTS_UNSET, ...materials }`.
- Test: `scripts/verify-trade-scene.ts`, at the drawing-only block (`:535-541`), the drawing-only loop (`:3074`) and the core copy walk (`:1656`).

**Interfaces:**
- **Produces, in CORE types:**
  - `StandardShingleColor { id: string, name: string, hex: string, coolTwin: OwensCorningColorId }`
  - `ShingleColorId = OwensCorningColorId | StandardShingleColorId`
  - `CoolLifeColor { id: string, name: string, code: string, hex: string, family: CoolLifeFamilyId }`
  - `PaintColorIds { body: CoolLifeColorId | null, trim: CoolLifeColorId | null }`
  - `PaintPick extends PaintColorIds { combo: PaintComboId | null }`
  - `PaintCombo { id: string, name: string, body: CoolLifeColorId, trim: CoolLifeColorId }`
  - `WindowFrameColor { name: string, outside: string, inside: string }`
- **`HomeMaterialFacts`:** `shingleColor` widens to `ShingleColorId | null`, and it gains `existingPaintColors: PaintColorIds`, `proposedPaintColors: PaintPick` and `windowFrameColor: WindowFrameColorId`.
  - In `HOME_MATERIAL_FACTS_UNSET`, these start as `{ body: null, trim: null }`, `{ body: null, trim: null, combo: null }` and `'white'`.
- **`F/types.ts`:** `type DrawingOnlyMaterialFact = 'acTons' | 'shingleColor' | 'paintWear' | 'existingPaintColors' | 'proposedPaintColors' | 'windowFrameColor'`.
  - `SceneResolveInputs['homeMaterials']` and `SceneResolveSelection` omit it.
  - The `fact` change becomes `Partial<Pick<HomeMaterialFacts, 'gutters' | DrawingOnlyMaterialFact>>`.
- **Constants:**
  - `STANDARD_SHINGLES` (`as const satisfies readonly StandardShingleColor[]`) and `StandardShingleColorId`.
  - `COOL_LIFE_FAMILIES`, `CoolLifeFamilyId`, `COOL_LIFE_COLORS`, `CoolLifeColorId`, `COOL_LIFE_QUICK_COLOR_IDS`, `PAINT_COMBOS`, `PaintComboId` and `COOL_LIFE_FAN_DECK_URL`.
  - `WINDOW_FRAME_COLOR_IDS`, `WindowFrameColorId` and `WINDOW_FRAME_COLORS` (a record by id).

The data, verbatim:

```ts
// standard-shingles.ts. The distributor's generic bundles are only "very similar" to these Owens Corning colours, so the
// swatches are screen approximations, and the names carry no brand.
export const STANDARD_SHINGLES = [
  { id: 'dark-brown', name: 'Dark brown', hex: '#685347', coolTwin: 'forest-brown' },
  { id: 'grey-brown', name: 'Grey brown', hex: '#686359', coolTwin: 'summerwood' },
  { id: 'light-brown', name: 'Light brown', hex: '#8D7D6B', coolTwin: 'sand-castle' },
] as const satisfies readonly StandardShingleColor[]
```

```ts
// cool-life-colors.ts: heat-reflective colours from Cool Life's own palette
// (coollifepalette.lifetimepluscoatings.com/tenants/lifecoatings/colors.json). A subset: Cool Life matches any paint it is
// given. Hex values are Cool Life's screen values, so approximations only.
export const COOL_LIFE_FAMILIES = [
  { id: 'whites', name: 'Whites' },
  { id: 'neutrals', name: 'Neutrals' },
  { id: 'earth-tones', name: 'Earth Tones' },
  { id: 'blue-green-gray', name: 'Blue Green Gray' },
  { id: 'peaches-pinks-yellows', name: 'Peaches Pinks Yellows' },
] as const
export const COOL_LIFE_COLORS = [
  { id: 'sugar-dust', name: 'Sugar Dust', code: '0011', hex: '#f6f4ea', family: 'whites' },
  { id: 'cotton-ball', name: 'Cotton Ball', code: '0007', hex: '#f4eedf', family: 'whites' },
  { id: 'casa-blanca', name: 'Casa Blanca', code: '0008', hex: '#f3ecd9', family: 'whites' },
  { id: 'elusive-white', name: 'Elusive White', code: '0002', hex: '#e9e5d8', family: 'whites' },
  { id: 'moon-drop', name: 'Moon Drop', code: '0026', hex: '#dbd4c8', family: 'whites' },
  { id: 'private-white', name: 'Private White', code: '0292', hex: '#f2ead7', family: 'neutrals' },
  { id: 'maple-pecan', name: 'Maple Pecan', code: '0174', hex: '#e1d1bc', family: 'neutrals' },
  { id: 'ivory-ridge', name: 'Ivory Ridge', code: '0182', hex: '#d8cab8', family: 'neutrals' },
  { id: 'mulled-cider', name: 'Mulled Cider', code: '0244', hex: '#e3c59e', family: 'neutrals' },
  { id: 'candle-light', name: 'Candle Light', code: '0168', hex: '#dbc1a7', family: 'neutrals' },
  { id: 'soft-leather', name: 'Soft Leather', code: '0336', hex: '#c5bba9', family: 'neutrals' },
  { id: 'caramel-cloud', name: 'Caramel Cloud', code: '0245', hex: '#d3b188', family: 'neutrals' },
  { id: 'season-finale', name: 'Season Finale', code: '0267', hex: '#bfa57f', family: 'neutrals' },
  { id: 'tailored-tan', name: 'Tailored Tan', code: '0239', hex: '#bea182', family: 'neutrals' },
  { id: 'pavilion-tan', name: 'Pavilion Tan', code: '0149', hex: '#b39383', family: 'neutrals' },
  { id: 'moonscape', name: 'Moonscape', code: '0227', hex: '#8e826e', family: 'neutrals' },
  { id: 'golden-summer', name: 'Golden Summer', code: '0305', hex: '#846f4b', family: 'neutrals' },
  { id: 'brown-suede', name: 'Brown Suede', code: '0221', hex: '#62584c', family: 'neutrals' },
  { id: 'film-noir', name: 'Film Noir', code: '0144', hex: '#524641', family: 'neutrals' },
  { id: 'cheddar-corn', name: 'Cheddar Corn', code: '1001', hex: '#f3d3b5', family: 'earth-tones' },
  { id: 'goby-desert', name: 'Goby Desert', code: '0898', hex: '#d3ac73', family: 'earth-tones' },
  { id: 'orestes', name: 'Orestes', code: '0379', hex: '#a29e87', family: 'earth-tones' },
  { id: 'orange-ballad', name: 'Orange Ballad', code: '1019', hex: '#b57248', family: 'earth-tones' },
  { id: 'april-love', name: 'April Love', code: '1061', hex: '#8e4b3f', family: 'earth-tones' },
  { id: 'felicity', name: 'Felicity', code: '0523', hex: '#e5e4df', family: 'blue-green-gray' },
  { id: 'raindance', name: 'Raindance', code: '0474', hex: '#d6ddd5', family: 'blue-green-gray' },
  { id: 'snowglory', name: 'Snowglory', code: '0531', hex: '#c9c8c4', family: 'blue-green-gray' },
  { id: 'water-droplet', name: 'Water Droplet', code: '0503', hex: '#bec9ce', family: 'blue-green-gray' },
  { id: 'hearthstone', name: 'Hearthstone', code: '0567', hex: '#c6beb2', family: 'blue-green-gray' },
  { id: 'in-the-blue', name: 'In the Blue', code: '0504', hex: '#a0b2bc', family: 'blue-green-gray' },
  { id: 'smoky-tone', name: 'Smoky Tone', code: '0541', hex: '#a0a09f', family: 'blue-green-gray' },
  { id: 'overcast-day', name: 'Overcast Day', code: '0512', hex: '#939ba4', family: 'blue-green-gray' },
  { id: 'everlasting-sage', name: 'Everlasting Sage', code: '0422', hex: '#97998b', family: 'blue-green-gray' },
  { id: 'greystoke', name: 'Greystoke', code: '0575', hex: '#8b8981', family: 'blue-green-gray' },
  { id: 'deep-lagoon', name: 'Deep Lagoon', code: '0507', hex: '#67737c', family: 'blue-green-gray' },
  { id: 'gargoyle', name: 'Gargoyle', code: '0550', hex: '#655a56', family: 'blue-green-gray' },
  { id: 'queen-of-the-night', name: 'Queen of the Night', code: '0655', hex: '#395e7a', family: 'blue-green-gray' },
  { id: 'deep-space', name: 'Deep Space', code: '0487', hex: '#4f5d5d', family: 'blue-green-gray' },
  { id: 'black-licorice', name: 'Black Licorice', code: '0529', hex: '#474848', family: 'blue-green-gray' },
  { id: 'silent-sea', name: 'Silent Sea', code: '0515', hex: '#3e3f40', family: 'blue-green-gray' },
  { id: 'strawberry-whip', name: 'Strawberry Whip', code: '0055', hex: '#f7d7cd', family: 'peaches-pinks-yellows' },
  { id: 'starlet', name: 'Starlet', code: '0094', hex: '#88585a', family: 'peaches-pinks-yellows' },
] as const satisfies readonly CoolLifeColor[]
// The short row each part shows first; every combo's colours are in it.
export const COOL_LIFE_QUICK_COLOR_IDS = ['sugar-dust', 'cotton-ball', 'maple-pecan', 'hearthstone', 'tailored-tan', 'greystoke', 'in-the-blue', 'deep-space', 'brown-suede', 'black-licorice'] as const satisfies readonly CoolLifeColorId[]
export const PAINT_COMBOS = [
  { id: 'light-dark', name: 'Light & dark', body: 'cotton-ball', trim: 'black-licorice' },
  { id: 'tan-dark', name: 'Tan & dark', body: 'tailored-tan', trim: 'brown-suede' },
  { id: 'dark-light', name: 'Dark & light', body: 'deep-space', trim: 'sugar-dust' },
  { id: 'colourful', name: 'Colourful', body: 'in-the-blue', trim: 'sugar-dust' },
] as const satisfies readonly PaintCombo[]
export const COOL_LIFE_FAN_DECK_URL = 'https://coollifepalette.lifetimepluscoatings.com/#/colors'
```

```ts
// window-frame-colors.ts. Vinyl comes in these three; the white is the frame the scene has always drawn.
export const WINDOW_FRAME_COLOR_IDS = ['white', 'black', 'black-white'] as const
export const WINDOW_FRAME_COLORS = {
  'white': { name: 'White', outside: '#f3ece0', inside: '#f3ece0' },
  // A working number, set by shot.
  'black': { name: 'Black', outside: '#2b2b2c', inside: '#2b2b2c' },
  'black-white': { name: 'Black outside, white inside', outside: '#2b2b2c', inside: '#f3ece0' },
} as const satisfies Record<WindowFrameColorId, WindowFrameColor>
```

(`CoolLifeFamilyId`, `CoolLifeColorId`, `PaintComboId`, `StandardShingleColorId` and `WindowFrameColorId` are each the `[number]['id']` of their list, or the list's element type for `WINDOW_FRAME_COLOR_IDS`.)

- [ ] **Step 0: The frame-cost baseline.** Before any change, at `b9a17c0d5`, record the whole home's draw calls and triangles in the ledger. Task 7 compares against them. Use the dev server's page, with the owner's server answering, and the renderer's `info.render`.
- [ ] **Step 1: Write the failing checks** in `verify-trade-scene.ts`. Extend the drawing-only block:

```ts
assert.ok(shallowEqual(select({ acTons: '3' }), select({ acTons: '5', shingleColor: 'dark-brown', paintWear: { stains: 'heavy' }, existingPaintColors: { body: 'cotton-ball', trim: null }, proposedPaintColors: { body: 'deep-space', trim: 'sugar-dust', combo: 'dark-light' }, windowFrameColor: 'black' })), 'no colour pick re-resolves the scene')
type DrawingOnlyKey = 'acTons' | 'shingleColor' | 'paintWear' | 'existingPaintColors' | 'proposedPaintColors' | 'windowFrameColor'
// …the existing mapped-type check, with the three new keys set to true
```

  The `shallowEqual` line can only fail through the mapped type under tsc, since `selectResolveInputs` names its keys. The check that can fail at run time is the loop at `:3074`. Add three changes to its list: `{ kind: 'fact', patch: { existingPaintColors: { body: 'cotton-ball', trim: null } } }`, `{ kind: 'fact', patch: { proposedPaintColors: { body: 'deep-space', trim: 'sugar-dust', combo: 'dark-light' } } }` and `{ kind: 'fact', patch: { windowFrameColor: 'black' } }`.

  Add the data checks:

```ts
assert.equal(new Set(COOL_LIFE_COLORS.map(color => color.id)).size, COOL_LIFE_COLORS.length, 'Cool Life ids are unique')
assert.ok(COOL_LIFE_COLORS.length >= 38 && COOL_LIFE_COLORS.length <= 45, 'about 40 colours in the fuller list')
assert.equal(COOL_LIFE_QUICK_COLOR_IDS.length, 10, 'ten quick colours')
assert.ok(PAINT_COMBOS.every(combo => (COOL_LIFE_QUICK_COLOR_IDS as readonly string[]).includes(combo.body) && (COOL_LIFE_QUICK_COLOR_IDS as readonly string[]).includes(combo.trim)), 'every combo colour is a quick colour')
assert.ok(COOL_LIFE_FAMILIES.every(family => COOL_LIFE_COLORS.some(color => color.family === family.id)), 'every family has a colour')
// The distributor's bundle is its own product, so its hex is its own fact; only the twin must exist.
assert.ok(STANDARD_SHINGLES.every(color => OWENS_CORNING_SHINGLES.some(cool => cool.id === color.coolTwin)), 'each standard shingle has an Owens Corning twin')
assert.ok(STANDARD_SHINGLES.every(color => !/owens|corning|duration/i.test(color.name)), 'standard shingles carry no brand')
assert.equal(COOL_LIFE_FAN_DECK_URL, 'https://coollifepalette.lifetimepluscoatings.com/#/colors')
```

  The core copy walk pushes every `COOL_LIFE_COLORS`, `COOL_LIFE_FAMILIES`, `PAINT_COMBOS`, `STANDARD_SHINGLES` and `WINDOW_FRAME_COLORS` name.
- [ ] **Step 2:** Run `pnpm tsx scripts/verify-trade-scene.ts`. Expected: FAIL, because the imports don't resolve.
- [ ] **Step 3: Implement** the three constant files, the CORE types, `HOME_MATERIAL_FACTS_UNSET`, `DrawingOnlyMaterialFact` and its three uses, the `resolve-scene.ts` spread, the two widened types and the `verify-construction-model.ts` spread.
- [ ] **Step 4:** Run the verify script, `pnpm tsc` and eslint on the touched files, all under the lock where it applies. Expected: `verify-trade-scene: ok`, with no type or lint errors.
- [ ] **Step 5: Commit:** `feat(construction): standard shingles, the Cool Life colours and the vinyl frame colours, held as drawing-only picks`.

### Task 2: The roof shows the right shingle line for the switch

**Files:**
- Create: `CORE/lib/shingle-color-for.ts`
- Modify:
  - `F/lib/apply-scene-change.ts:55-60`: the `efficiency-upgrade` case.
  - `F/lib/installed-shingle-tone.ts`
  - `F/ui/components/panel/shingle-colors.tsx`
  - `F/constants/home-scene-copy.ts:181`: `SHINGLE_COPY`.
  - `F/ui/components/controls/system-card-body.tsx:79`: the `extra` condition and the `cool` prop.
- Create: `F/ui/components/panel/color-swatches.tsx`, the swatch radio group taken out of `ShingleColors`, so paint (Task 6) uses the same one.
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `STANDARD_SHINGLES`, `ShingleColorId` (Task 1).
- Produces:
  - `shingleColorFor(colorId: ShingleColorId | null, cool: boolean): ShingleColorId | null`.
    - It returns the id when it already belongs to that side.
    - It returns the twin when one exists (a standard colour's `coolTwin`, or the standard colour whose `coolTwin` is the id).
    - Otherwise it returns `null`.
  - `installedShingleTone(parts: readonly ResolvedPart[], colorId: ShingleColorId | null): string | null`.
    - For an installed `cool-shingle`, it returns the hex from `OWENS_CORNING_SHINGLES`.
    - For an installed `shingle`, it returns the hex from `STANDARD_SHINGLES`.
    - It returns `null` when the id is not in that list, or when nothing is installed.
  - `ColorSwatches<T extends string>({ label, colors, value, onPick }: { label: string, colors: readonly { id: T, name: string, hex: string }[], value: T | null, onPick: (id: T) => void })`.
    - It keeps today's look: the 28 px faces, the 40 px reach, the ring on the picked one (`shingle-colors.tsx:38-56`).
    - It is built the way `WearDots` is (`panel/wear-dots.tsx:33-69`): the shared `RadioGroup`, with a transparent 40 px `RadioGroupItem` over each drawn face. So a list is one Tab stop and the arrow keys move through it. Today each swatch is its own Tab stop, which is fine at 10 and not at 42 per part.
  - `ShingleColors({ cool }: { cool: boolean })`.
    - With `cool`, it is today's picker.
    - Without, it shows `STANDARD_SHINGLES` with no line pill, and its line under the swatches shows the name or `SHINGLE_COPY.notPicked`, never an SRI.
  - `SHINGLE_COPY.colorLabel = 'Shingle colour'` labels the swatch group in both lists. Today the swatches and the line pill share the name "Shingle line".

- [ ] **Step 1: Write the failing checks:**

```ts
assert.equal(shingleColorFor('forest-brown', false), 'dark-brown', 'switching the cool roof off keeps the matching brown')
assert.equal(shingleColorFor('dark-brown', true), 'forest-brown', 'and back on')
assert.equal(shingleColorFor('summerwood', false), 'grey-brown')
assert.equal(shingleColorFor('light-brown', true), 'sand-castle')
assert.equal(shingleColorFor('night-sky', false), null, 'a cool colour with no standard twin clears')
assert.equal(shingleColorFor('mojave', true), 'mojave', 'a colour already on its side stays')
assert.equal(shingleColorFor(null, true), null)
const coolOff = { property: profile({ roofType: 'shingle' }), view: 'proposed' as const, proposedScopeIds: [TEAR_OFF] }
const off = applySceneChange({ ...HOME_SCENE_DEFAULTS, ...coolOff, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, shingleColor: 'forest-brown' } }, { kind: 'efficiency-upgrade', upgrade: 'cool-roof', on: false }, YEAR)
assert.equal(off.homeMaterials?.shingleColor, 'dark-brown', 'the switch carries the colour to its twin')
const standardParts = roofAttic(at({ ...coolOff, efficiencyUpgrades: [] })).parts
const coolParts = roofAttic(at(coolOff)).parts
assert.equal(installedShingleTone(standardParts, 'dark-brown'), '#685347', 'a standard shingle takes the standard colour')
assert.equal(installedShingleTone(standardParts, 'forest-brown'), null, 'a standard shingle never draws a cool colour')
assert.equal(installedShingleTone(coolParts, 'dark-brown'), null, 'a cool shingle never draws a standard colour')
assert.equal(installedShingleTone(coolParts, 'forest-brown'), '#685347')
```

- [ ] **Step 2:** Run the verify script. Expected: FAIL, because `shingleColorFor` is not defined.
- [ ] **Step 3: Implement** `shingleColorFor` and the new `installedShingleTone`.
  - In `applySceneChange`, the `efficiency-upgrade` case for `'cool-roof'` adds `homeMaterials: { ...state.homeMaterials, shingleColor: shingleColorFor(state.homeMaterials.shingleColor, change.on) }` to its patch.
  - Extract `ColorSwatches` and add the `cool` prop to `ShingleColors`.
  - `system-card-body.tsx:79` passes `cool={installsCoolShingle}` until Task 5 moves the picker. The `extra` there now shows whenever the picked covering is shingle or cool shingle, not only `installsCoolShingle`, so the cool roof off shows the three browns.
- [ ] **Step 4:** Run the verify script, tsc and eslint. Expected: PASS.
- [ ] **Step 5: Screenshots:** a shingle home, Build, tear-off picked, in the roof menu: cool roof on (the two lines), then the cool roof chip off (three browns, no line pill, no SRI line). Pick Dark brown, switch the cool roof on: Forest Brown is picked, and the roof reads the same brown.
- [ ] **Step 6: Commit:** `feat(trade-scenes): the roof's colours follow the cool roof switch, three standard browns when it is off`.

### Task 3: Paint body and trim on the house

**Files:**
- Create: `F/lib/paint-hexes.ts`
- Modify:
  - `F/types.ts`: `PaintLook` gains `trim: string`; add `PaintHexes { body: string, trim: string }` in the end block.
  - `F/ui/lib/paint-look.ts`
  - `F/constants/home-palette.ts`: delete `paintCool`. `stucco` and `trim` stay as the colours of a home with none set. Its comment says it is now the painted trim's default, not the vinyl frame's.
  - `F/ui/components/home-kit/home-kit.tsx:247` and `:296`.
  - `F/ui/components/home-kit/garage.tsx`: a `trimColor` prop for `boxes.trim` and `boxes.fascia`.
  - `F/ui/components/home-kit/house-shell.tsx:196`: the door frame takes `paint.trim`.
  - `F/ui/components/home-kit/roof-slope.tsx:169,175`: the fascia and rake take `paint.trim`.
  - `F/ui/components/home-kit/low-slope-roof.tsx:125,128,154`: the coping and front fascia take `paint.trim`.
- Test: `scripts/verify-trade-scene.ts`. Rework `:1741-1747`, the checks on the old `paintLook` signature. The `paintCool` ones retire with the new look.

**Interfaces:**
- Consumes: `COOL_LIFE_COLORS`, `PaintColorIds`, `PaintPick` (Task 1).
- Produces:
  - `paintHexes(materials: Pick<HomeMaterialFacts, 'existingPaintColors' | 'proposedPaintColors'>, repainted: boolean): PaintHexes`. Each part falls back in turn:
    - not repainted: `existingPaintColors`'s colour, else `HOME_PALETTE.stucco` (body) or `HOME_PALETTE.trim` (trim);
    - repainted: `proposedPaintColors`'s colour, else `existingPaintColors`'s, else the palette.
  - `paintLook(paint: PartState, paintWear: PaintWear, hexes: PaintHexes): PaintLook`.
    - `color` is `wornColor(hexes.body, WEAR_LOOKS.paint.chalk, paint.wear)`, and `trim` the same for `hexes.trim`.
    - `wear` and `paintWear` are as today.
    - The repainted flag leaves `paintLook`: the caller decides the hexes.

- [ ] **Step 1: Write the failing checks:**

```ts
const unsetPaint = { existingPaintColors: { body: null, trim: null }, proposedPaintColors: { body: null, trim: null, combo: null } }
const setPaint = { existingPaintColors: { body: 'tailored-tan', trim: 'brown-suede' }, proposedPaintColors: { body: 'cotton-ball', trim: null, combo: 'light-dark' } } as const
assert.deepEqual(paintHexes(unsetPaint, false), { body: HOME_PALETTE.stucco, trim: HOME_PALETTE.trim }, 'a home with no colours set keeps the neutral house')
assert.deepEqual(paintHexes(setPaint, false), { body: '#bea182', trim: '#62584c' }, 'the existing view shows the home\'s own colours, never the pick')
assert.deepEqual(paintHexes(setPaint, true), { body: '#f4eedf', trim: '#62584c' }, 'a repaint takes its picks, and a colour not picked keeps the home\'s colour')
assert.deepEqual(paintHexes(unsetPaint, true), { body: HOME_PALETTE.stucco, trim: HOME_PALETTE.trim }, 'a repaint with nothing picked is the home, freshly painted')
assert.equal(paintLook({ material: 'standard', wear: 0.75 }, PAINT_WEAR_START.worn, { body: '#bea182', trim: '#62584c' }).trim, wornColor('#62584c', WEAR_LOOKS.paint.chalk, 0.75), 'the existing trim chalks with the paint')
assert.equal(paintLook({ material: 'cool', wear: 0 }, PAINT_WEAR_START.worn, { body: '#f4eedf', trim: '#474848' }).color, '#f4eedf', 'a fresh coat shows its colour as picked, Cool Life or not')
// A scope pick never touches the colours, on or off.
const painted = { ...HOME_SCENE_DEFAULTS, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, ...setPaint } }
const repaintOffer = partOffers('exterior-wall').find(offer => offer.partId === 'paint')!
const repaintOn = applyAll(painted, [{ kind: 'scope', offer: repaintOffer, scopeId: SCOPE_IDS.coolLifeRepaint }])
assert.ok(repaintOn.proposedScopeIds.includes(SCOPE_IDS.coolLifeRepaint), 'the repaint is on')
const repaintOff = applyAll(repaintOn, [{ kind: 'scope', offer: repaintOffer, scopeId: null }])
assert.equal(repaintOff.homeMaterials.proposedPaintColors, painted.homeMaterials.proposedPaintColors, 'turning a repaint on and off keeps the very same picks')
```

  Also add source checks: none of `roof-slope.tsx`, `low-slope-roof.tsx`, `garage.tsx` or `house-shell.tsx` reads `HOME_PALETTE.trim` any more, and `HOME_PALETTE` has no `paintCool`.

  The old `paintLook(…, true|false)` checks run from `:1741` to `:1747`. All seven move to the new signature or go: the `paintCool` ones go, and the wear and `paintWear` ones keep their meaning with hexes passed in.
- [ ] **Step 2:** Run the verify script. Expected: FAIL, because `paintHexes` is not defined.
- [ ] **Step 3: Implement** `paintHexes` and the new `paintLook`.
  - `home-kit.tsx` computes `paintLook(partState(wallParts, 'paint'), paintWearInForce(...), paintHexes(homeMaterials, repainted))`, where `repainted` is today's `condition === 'installed'` test.
  - Pass `trimColor={paint.trim}` to `Garage`, and repoint the trim readers.
- [ ] **Step 4:** Run the verify script, tsc and eslint. Expected: PASS.
- [ ] **Step 5: Screenshots (the default house only):** with no colours set, take the existing view and the Build with a repaint. Each must read as the same house as at `b9a17c0d5`, except that a repaint drops the brighter Cool Life look. The colour shots wait for Task 6's pickers, which then check:
  - the walls, gables, garage walls and crawl skirt take the body colour;
  - the fascia and rake, door frame, garage trim and fascia take the trim colour;
  - the window frames stay white;
  - on a low-slope home, the coping and parapets.
- [ ] **Step 6: Commit:** `feat(trade-scenes): the paint draws as body and trim, and the trim stops being the window frame's colour`.

### Task 4: Window frame colours on the house

**Files:**
- Create: `F/ui/lib/window-frame-look.ts`
- Modify:
  - `F/lib/window-boxes.ts:23-42`: return `outside` and `inside` beside `frames`.
  - `F/constants/system-part-looks.ts:73-74`: `FRAME_LOOKS.vinyl.color` reads `WINDOW_FRAME_COLORS.white.outside`, and its comment drops "the house's matte trim".
  - `F/ui/components/home-kit/house-shell.tsx:94-114,176-177,204`: a `windowFrameColor: WindowFrameColorId` prop and the two-tone draw.
  - `F/ui/components/home-kit/home-kit.tsx`: pass `homeMaterials.windowFrameColor`.
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `WINDOW_FRAME_COLORS`, `WindowFrameColorId` (Task 1).
- Produces:
  - `windowBoxes(...)` returns `{ frames, outside, inside, glass }`.
    - `frames` is unchanged, so `:1891` and `:2458` still hold.
    - `outside` holds each bar and the mullion at their outer half (`offset +depth/4`, thickness `depth/2`; the mullion at `±depth*0.2`, thickness `depth*0.4`), plus the sill ledge.
    - `inside` holds the inner halves.
  - `windowFrameLook(frame: PartState, double: boolean, picked: WindowFrameColorId): { outside: string, inside: string, roughness: number, metalness: number }`.
    - A `vinyl-frame` takes the pick's colours and the vinyl sheen, with no wear. Only the build installs one: a home's own frame is `original-frame`.
    - Anything else takes today's look (`FRAME_LOOKS` by `ORIGINAL_FRAME_LOOK`), worn by `WEAR_LOOKS.window.frame`, with `outside === inside`.
  - `HouseShell` draws `frames` in one draw when `outside === inside` (as today), and otherwise `outside` and `inside` lists. The extra draws are paid only for the two-tone pick.
    - Both lists render inside the existing frame groups (`house-shell.tsx:176-178` for the side walls and `:203-205` for the front), so they keep `systemPartTag('frame')`, the window tap and the up-close emphasis. The tag check at `verify-trade-scene.ts:3331-3352` only asks that some mesh carries the tag, so it cannot catch a list mounted outside the group.

- [ ] **Step 1: Write the failing checks:**

```ts
const [wall, opening] = [LOOK_INSIDE_WINDOW.wall, LOOK_INSIDE_WINDOW.opening]
const split = windowBoxes(wall, opening, WINDOW_FRAMES.double, HOUSE.floorY, HOUSE.wallThickness)
assert.equal(split.outside.length, split.inside.length + 1, 'the outside holds the sill ledge too')
assert.ok(split.outside.slice(0, 4).every((box, i) => (box.position[wall.run === 'x' ? 2 : 0] - wall.line) * wall.outward > 0 && (split.inside[i].position[wall.run === 'x' ? 2 : 0] - wall.line) * wall.outward < 0), 'the outer half faces out, the inner half in')
const newFrame = { material: 'vinyl-frame', wear: 0 }
assert.deepEqual(windowFrameLook(newFrame, true, 'black-white'), { outside: '#2b2b2c', inside: '#f3ece0', roughness: FRAME_LOOKS.vinyl.roughness, metalness: 0 }, 'the build\'s frame takes the pick, white inside')
assert.equal(windowFrameLook({ material: 'original-frame', wear: 0 }, true, 'black').outside, WINDOW_FRAME_COLORS.white.outside, 'an existing double-pane frame stays white whatever is picked')
assert.equal(windowFrameLook({ material: 'original-frame', wear: 0.75 }, false, 'black').outside, wornColor(HOME_PALETTE.aluminum, WEAR_LOOKS.window.frame, 0.75), 'the old aluminum frame keeps its look')
```
- [ ] **Step 2:** Run the verify script. Expected: FAIL, because `windowFrameLook` is not defined.
- [ ] **Step 3: Implement** the split boxes, `windowFrameLook`, and the shell's draw. Then record the frame cost (draw calls, triangles) for the whole home with each of the three picks in the ledger.
- [ ] **Step 4:** Run the verify script, tsc and eslint. Expected: PASS.
- [ ] **Step 5: Screenshots (the default only):** with new windows installed and nothing picked, the frames read white as at `b9a17c0d5`. The colour shots wait for Task 5's `FrameColors`, whose walk takes them.
- [ ] **Step 6: Commit:** `feat(trade-scenes): new vinyl windows take a frame colour, white inside where the pick says so`.

### Task 5: The details: one shared piece, the switches move in

**Files:**
- Create:
  - `F/lib/work-details-kind.ts`
  - `F/ui/components/controls/work-details.tsx`
  - `F/ui/components/controls/upgrade-switch.tsx`
  - `F/ui/components/panel/frame-colors.tsx`
- Modify:
  - `F/ui/components/controls/value-menu.tsx`: a `staysOpenOn` prop.
  - `F/ui/components/controls/proposed-chip.tsx`: the menu kind takes `staysOpenOn` from its caller and hands it to `ValueMenu`.
  - `F/ui/components/controls/system-card-body.tsx`: the `shingleColors` block, the `upgrade()` helper (it moves out), the `proposed` rows and `sideRow('proposed')`.
  - `F/ui/components/controls/modify-result-row.tsx`: the details under a `build:*` row's options.
  - `F/constants/controls-classes.ts`: `detailsPanel`. The `menu` class also gains a height cap, `max-h-(--radix-popover-content-available-height) overflow-y-auto overscroll-contain`. No menu has one today, and the details make the roof menu, and in Task 6 the Today paint menu, taller than the phone's screen.
  - `F/constants/home-scene-copy.ts`: `FRAME_COLOR_COPY`.
- Test: `scripts/verify-trade-scene.ts`, plus a Playwright walk.

**Interfaces:**
- Consumes: `ShingleColors({ cool })` (Task 2), `upgradeRowState` (`picked`, `installsCoolShingle`), and the `upgrade:*` slots from `sceneChangeSlots`.
- Produces:
  - `workDetailsKind(scopeId: string | null): 'shingle' | 'membrane' | 'paint' | 'vinyl-frame' | null`. It reads `SCOPE_INSTALLS[scopeId].installs`:
    - a `covering` install of `shingle` gives `'shingle'`;
    - a `covering` install of `membrane` gives `'membrane'`;
    - a `paint` install gives `'paint'`;
    - a `frame` install of `vinyl-frame` gives `'vinyl-frame'`;
    - anything else, `NO_CHANGE_CHOICE` and `null` give `null`. So a tile reset has no details.
  - `ValueMenu` gains `staysOpenOn?: (value: T) => boolean`.
    - When it is true for a value newly picked by a click, the click picks and the menu stays open.
    - A click on the value already picked still only closes the menu, as `value-menu.tsx:86-95` does today.
    - The arrow-key path is unchanged.
  - `ProposedChip` menu kind gains an optional `staysOpenOn` prop and hands it to `ValueMenu`. The caller decides, as it decides `extra`. `system-card-body` passes `value => workDetailsKind(value) !== null`.
  - `UpgradeSwitch({ slot, upgrade, saysWhy }: { slot: SceneChangeSlot, upgrade: EfficiencyUpgradeId, saysWhy: boolean })`. This is today's `upgrade()` helper (`system-card-body.tsx:82-93`) moved into its own file unchanged:
    - required: the `reason` chip, `included`;
    - `unavailable === null`: the toggle chip;
    - otherwise: the reason chip when `saysWhy`, else nothing.

    The card's rows and `WorkDetails` both render it, so a switch reads the same in either place, and the helper is deleted.
  - `WorkDetails({ kind, upgrade }: { kind: NonNullable<ReturnType<typeof workDetailsKind>>, upgrade: SceneChangeSlot | null })`.
    - The caller hands in the switch's slot, or `null` when there is none. The card passes `slots.find(…) ?? null`: the `upgrade:cool-roof` slot for `'shingle'` and `'membrane'`, the `upgrade:cool-paint` slot for `'paint'`, and `null` for `'vinyl-frame'`. Modify always passes `null`, because Modify already lists the switches as rows of their own and a second copy would show twice.
    - **A home that already has Cool Life paint has no `upgrade:cool-paint` slot** (`scene-change-slots.ts:153`, `scope-chip-options.ts:15`). The `null` covers it, so its repaint details show the colours alone, as today shows no Cool Life chip there.
    - It reads `installsCoolShingle` from the store for the shingle list.
    - The arms, each switch rendered only when `upgrade` is not null:
      - `'shingle'`: `UpgradeSwitch` for cool roof (`saysWhy` true), then `ShingleColors cool={installsCoolShingle}`;
      - `'membrane'`: `UpgradeSwitch` for cool roof only;
      - `'paint'`: `UpgradeSwitch` for Cool Life (`saysWhy` false), then a placeholder for Task 6, which mounts `PaintColors side="proposed"` there;
      - `'vinyl-frame'`: `FrameColors`.
  - `FrameColors()`: `ChoicePill` over `WINDOW_FRAME_COLOR_IDS` with `WINDOW_FRAME_COLORS[id].name` labels, labelled `FRAME_COLOR_COPY.label`. It writes `{ kind: 'fact', patch: { windowFrameColor } }`.
  - `FRAME_COLOR_COPY = { label: 'Frame colour' } as const`.
  - `CONTROLS_CLASSES.detailsPanel`: the inline panel under the Build chips. It has a border and no fill of its own (a nested surface takes no new rung), and `rounded-lg`, the step down that `theme-conventions.md` gives a piece nested in a surface. Its spacing is a working number, settled by shot; a starting value is `'grid w-full basis-full gap-2 rounded-lg border border-border p-2'`.
- **Where each piece sits** (`system-card-body.tsx`):
  - **`picked`:** take it from `upgradeRowState(...)` beside `installsCoolShingle` (`:66` does not read it today). It is the row's scope id or `null`.
  - **Shingle roof menu:** `extra` is `<WorkDetails kind="shingle" upgrade={…} />` whenever `workDetailsKind(picked) === 'shingle'`, in today's wrapper (`:51-55`).
  - **Toggle rows that are on and have details:** a `<div className={CONTROLS_CLASSES.detailsPanel}>` holding `WorkDetails`, placed **last in the Build row**, full width. The roof card's Build row also holds the deck and gutter chips (`home-systems.ts:11`), so the panel goes after all of them. Then the Redeck chip that a pick unlocks stays beside the chip that unlocked it.
    - Key the panel by the system (`` `details:${system}` ``), never by the scope id. Cool Life swaps `waterBasedRepaint` for `coolLifeRepaint`, and a key that changed with it would remount the panel and close "More colours" on every flip.
  - **The switches leave the row** once the row's pick has details. The row's cool-roof and Cool Life `UpgradeSwitch` render only while `workDetailsKind(picked) === null`. Before a pick, the cool roof stays the reason chip and Cool Life stays the toggle it is now.
  - **Modify:** a result row whose `slot.id` starts with `build:` and whose `workDetailsKind(slot.current)` is not null renders `<WorkDetails kind={…} upgrade={null} />` under its options, in the same `detailsPanel`.

- [ ] **Step 1: Write the failing checks:**

```ts
assert.equal(workDetailsKind(SCOPE_IDS.roofTearOff), 'shingle')
assert.equal(workDetailsKind(SCOPE_IDS.roofOverlay), 'shingle')
assert.equal(workDetailsKind(SCOPE_IDS.roofTorchDown), 'membrane')
assert.equal(workDetailsKind(SCOPE_IDS.roofTileReset), null, 'a tile reset has nothing to pick')
assert.equal(workDetailsKind(SCOPE_IDS.coolLifeRepaint), 'paint')
assert.equal(workDetailsKind(SCOPE_IDS.waterBasedRepaint), 'paint')
assert.equal(workDetailsKind(SCOPE_IDS.windowReplacement), 'vinyl-frame')
assert.equal(workDetailsKind(SCOPE_IDS.roofRedeck), null)
assert.equal(workDetailsKind(NO_CHANGE_CHOICE), null, 'No change closes the menu')
assert.equal(workDetailsKind(null), null)
const valueMenuCode = readFileSync('src/features/trade-scenes/ui/components/controls/value-menu.tsx', 'utf8')
assert.ok(/staysOpenOn\?\.\(option\.value\)/.test(valueMenuCode), 'a pick with details keeps the menu open')
```

  Add the Cool Life home case with the existing state fixtures (`at`, `profile`, `HOME_MATERIAL_FACTS_UNSET`): a home with `exteriorPaint: 'cool'` and `SCOPE_IDS.coolLifeRepaint` picked.
  - `sceneChangeSlots` of it holds no slot with id `'upgrade:cool-paint'`, with the message `'a home already on Cool Life has no Cool Life switch'`.
  - `workDetailsKind(SCOPE_IDS.coolLifeRepaint)` is still `'paint'`, so its details mount with `upgrade` `null`.

  Add a source check that `system-card-body.tsx` no longer declares `const upgrade = (`, and that `upgrade-switch.tsx` renders `kind="reason"` with `included` for a required slot.
- [ ] **Step 2:** Run the verify script. Expected: FAIL, because `workDetailsKind` is not defined.
- [ ] **Step 3: Implement** `workDetailsKind`, `staysOpenOn`, `UpgradeSwitch` (moved from the card), `FrameColors`, `WorkDetails`, the menu height cap and the three mount points. Then delete the now-unused `cool` wiring at `system-card-body.tsx:79` from Task 2, since `WorkDetails` owns it.
- [ ] **Step 4:** Run the verify script, tsc and eslint. Expected: PASS.
- [ ] **Step 5: Playwright walk and screenshots:**
  1. Shingle home: open "New roof" and pick Tear-off. The menu stays open, with the cool roof switch and the swatches below the separator.
  2. Switch the cool roof off inside the menu: three browns. Pick "No change": the menu closes.
  3. Arrow keys on the menu's radios move the pick without closing.
  4. Flat roof: tap "Torch down". The chip turns on, and the panel, last in the Build row, shows only the cool roof switch. Do the same on a wood-shake roof's tear-off: the panel holds the switch and the swatches, and the Redeck chip stays beside the tear-off chip.
  5. Windows: tap "New windows". The panel shows the frame pill.
     - Pick Black: the house's frames go black on Complete.
     - Pick "Black outside, white inside": on Partly open the inside face reads white. Then take the windows up close.
       - The up-close camera looks from outside (`system-camera-views.ts:54,84`), so it may never show the inside face.
       - If it doesn't, write that in the ledger for the owner. Never move the camera to show it.
  6. Modify: search "windows" and pick the replacement. Its details show under the options, with no switch. Search "roof" and pick tear-off: the cool roof shows once, as its own row, not again in the details.
  7. Before any roof pick, the cool roof is still the "why not yet" reason chip.
  8. 390×844: the roof menu with tear-off picked fits the screen, or scrolls inside itself.

  All walks start on the Build side. A pick never flips the scene to the Build (`proposed-chip.tsx:24`), so a colour picked on Today changes nothing you can see.
- [ ] **Step 6: Commit:** `feat(trade-scenes): a picked piece of work shows its colours and its switch in one place, never behind a closed menu`.

### Task 6: Paint pickers: combos, quick colours, more colours, the Today side

**Files:**
- Create:
  - `F/lib/paint-combo-state.ts`
  - `F/ui/components/panel/paint-colors.tsx`
  - `F/ui/components/panel/paint-color-list.tsx`
- Modify:
  - `F/ui/components/controls/work-details.tsx`: the `'paint'` arm mounts `PaintColors side="proposed"`.
  - `F/ui/components/controls/existing-chip.tsx:50-64` (the `groups` array): a colours group for `exterior-paint`.
  - `F/constants/home-scene-copy.ts`: `PAINT_COLOR_COPY`.
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `COOL_LIFE_COLORS`, `COOL_LIFE_FAMILIES`, `COOL_LIFE_QUICK_COLOR_IDS`, `PAINT_COMBOS`, `COOL_LIFE_FAN_DECK_URL` (Task 1), and `ColorSwatches` (Task 2).
- Produces:
  - `paintComboState(materials: Pick<HomeMaterialFacts, 'existingPaintColors' | 'proposedPaintColors'>): { picked: PaintComboId | null, from: PaintComboId | null }`.
    - It compares the colours the swatches show, which for each of body and trim is the proposed colour, else the existing one. So a home whose own colours are Light & dark shows Light & dark picked before anything is tapped.
    - `picked` is the combo whose body and trim both equal those colours.
    - `from` is `proposedPaintColors.combo` when nothing is `picked`, else `null`.
    - The combo is remembered for the open scene, beside body and trim (owner, 2026-11-06). It is where the colours came from, not a third colour.
  - `PaintColorList({ label, value, onPick }: { label: string, value: CoolLifeColorId | null, onPick: (id: CoolLifeColorId) => void })`.
    - A `CONTROLS_CLASSES.capsLabel` line, `` `${label}${CONTROLS_COPY.systems.valueJoin}${name ?? PAINT_COLOR_COPY.notPicked}` ``. The inline panel is not a menu, so it takes the controls' non-menu label. Inside the Today menu's padded row, `menuHeader`'s own padding would double the indent.
    - The quick `ColorSwatches`.
    - A ghost `Button` toggling `PAINT_COLOR_COPY.more` / `PAINT_COLOR_COPY.fewer`. When open, the fuller list shows inline, grouped by `COOL_LIFE_FAMILIES` (a `capsLabel` per family over its `ColorSwatches`). At its foot, `<Button asChild variant="link"><a href={COOL_LIFE_FAN_DECK_URL} target="_blank" rel="noopener noreferrer">{PAINT_COLOR_COPY.fanDeck}</a></Button>`.
    - Open or closed is local `useState`.
  - `PaintColors({ side }: { side: 'existing' | 'proposed' })`.
    - **`'proposed'`:**
      - It starts with a `CONTROLS_CLASSES.capsLabel` line, `PAINT_COLOR_COPY.combos`.
      - Next comes a `ChoicePill` of `PAINT_COMBOS` names, valued `paintComboState(homeMaterials).picked`. Picking writes `proposedPaintColors: { body, trim, combo: id }`.
      - When `from` is set, it adds `PAINT_COLOR_COPY.customFrom(name)` as `text-xs text-muted-foreground`.
      - Then come the body and trim `PaintColorList`, valued `proposedPaintColors.x ?? existingPaintColors.x`. Picking a body colour writes `proposedPaintColors: { ...proposedPaintColors, body: id }` (the same for trim), keeping `combo`.
    - **`'existing'`:** the body and trim `PaintColorList` over `existingPaintColors`, with no combos.
  - `PAINT_COLOR_COPY`:

```ts
export const PAINT_COLOR_COPY = {
  colors: 'Colours',
  combos: 'Popular combos',
  customFrom: (combo: string) => `Custom, from ${combo}`,
  body: 'Body',
  trim: 'Trim',
  notPicked: 'Not picked',
  more: 'More colours',
  fewer: 'Fewer colours',
  fanDeck: 'See the full Cool Life fan deck',
} as const
```

  - `ExistingChip`: when `slot.id === 'exterior-paint'`, it adds a group `{ id: 'colors', header: PAINT_COLOR_COPY.colors, body: <PaintColors side="existing" /> }` before Condition. The menu's 320 px width wraps the quick row to two lines, which is fine. Its height is held by Task 5's menu cap, which scrolls it.

- [ ] **Step 1: Write the failing checks:**

```ts
const noHomeColours = { body: null, trim: null }
const proposing = (proposedPaintColors: PaintPick) => ({ existingPaintColors: noHomeColours, proposedPaintColors })
assert.deepEqual(paintComboState(proposing({ body: 'cotton-ball', trim: 'black-licorice', combo: 'light-dark' })), { picked: 'light-dark', from: null })
assert.deepEqual(paintComboState(proposing({ body: 'maple-pecan', trim: 'black-licorice', combo: 'light-dark' })), { picked: null, from: 'light-dark' }, 'a changed colour reads as custom, from the combo')
assert.deepEqual(paintComboState(proposing({ body: 'cotton-ball', trim: 'black-licorice', combo: null })), { picked: 'light-dark', from: null }, 'matching a combo again marks it picked')
assert.deepEqual(paintComboState(proposing({ body: 'maple-pecan', trim: null, combo: null })), { picked: null, from: null }, 'colours picked freely read as body and trim')
assert.deepEqual(paintComboState({ existingPaintColors: { body: 'cotton-ball', trim: 'black-licorice' }, proposedPaintColors: { body: null, trim: null, combo: null } }), { picked: 'light-dark', from: null }, 'a home already in a combo shows it picked, as its swatches do')
assert.equal(PAINT_COLOR_COPY.customFrom('Light & dark'), 'Custom, from Light & dark')
```

- [ ] **Step 2:** Run the verify script. Expected: FAIL, because `paintComboState` is not defined.
- [ ] **Step 3: Implement** `paintComboState`, `PaintColorList`, `PaintColors`, the `WorkDetails` paint arm and the `ExistingChip` group.
- [ ] **Step 4:** Run the verify script, tsc and eslint. Expected: PASS.
- [ ] **Step 5: Playwright walk and screenshots:**
  1. Walls on Build: tap "Repaint". The panel shows the Cool Life switch, the combos, Body and Trim.
  2. Pick "Light & dark". The house goes light with dark trim, and the frames stay white.
  3. Change the body: the line reads "Custom, from Light & dark". Close and reopen the card, and it still reads so.
  4. Open "More colours" on Trim: the families, and the fan deck link (check its `href` and `target`, never follow it).
  5. Turn Cool Life off: the colours stay.
  6. Today side: open the paint chip and set Body Tailored Tan and Trim Brown Suede. The existing house shows them chalked by the wear.
     - Body: the walls, gables, garage walls and crawl skirt.
     - Trim: the fascia and rake, door frame, and garage trim and fascia.
     - The window frames stay white.
     - Once, on a low-slope home: the coping and parapets.
  7. Back on Build with nothing picked: the house shows those colours, fresh.
  8. The Today paint menu with "More colours" open, at 390×844 and 1194×834: it scrolls inside itself, and nothing runs off the screen.
  9. A home with Cool Life paint on the Today side: tap Repaint. The panel shows the colours with no Cool Life switch, and nothing breaks.
- [ ] **Step 6: Commit:** `feat(trade-scenes): paint picks body and trim, from a popular combo or freely, and the Today side can match the home`.

### Task 7: By-eye pass and hand-over

**Files:** only those Tasks 1–6 touched, and only for what the pass finds.

- [ ] **Step 1: The four sizes:** 1194×834 dark and light, 390×844 dark, and 1194×834 dark Partly open. Take them for the roof menu with tear-off (cool on and off), the repaint panel with More colours open, the Today paint menu, and the windows panel. Check each against the controls' own chips, pills and menu rhythm, in both schemes, by the self-check in `theme-conventions.md` §12.
- [ ] **Step 2: Approved looks that changed** (list each in the hand-over for the owner's iPad look):
  - The Today trim now chalks with the paint wear.
  - The Cool Life walls lose their brighter look, because the colour is the colour.
  - The vinyl frames are no longer tied to the trim.
- [ ] **Step 3: The frame cost:** the whole home with no picks, against the `b9a17c0d5` baseline from Task 1 Step 0, must be the same draw calls. Only the two-tone frame may add draws.
- [ ] **Step 4:** Run the verify script, tsc and full-repo eslint under the lock. Expected: PASS.
- [ ] **Step 5: Hand-over** in the ledger, for the controller to bring to the owner:
  - **Screenshots:** the paths.
  - **Working numbers to settle:** the black frame hex and the details panel spacing.
  - **Lists to trim:** the colour lists and the four combos, which the owner changes at the iPad look.
  - **What isn't built:** T21 (saving picks into a proposal), T22 (the envelope material), and colours for torch down.
  - **For the owner to look at:** whether the windows' up-close view shows the frame's white inside face (Task 5 walk, step 5).
