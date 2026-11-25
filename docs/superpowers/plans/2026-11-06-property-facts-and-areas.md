# Property facts and Areas — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The lot moves into the scene's own Controls: Property facts sets each yard's base ground, wear and whole-side fences; Areas gains a Lot group whose yards have a card shaped like a system card; drawing, the lot-line magnet and one-action Remove run from that card.

**Architecture:** Yards are derived from the main mass (`yardOfTile`), never stored. The layout gains a per-tile `wear` map and a stored base per yard; a tile whose Today material and wear equal its yard's base is base, anything else is a drawn region, so no "drawn" flag exists. Regions gain the wear and the yard in their sameness rule. Every yard pick is a pure repaint of the tile or fence maps (`lib/yard-picks.ts`). On screen, `SystemCard` is widened to take a yard, one `LotPickChip` serves every lot pick, and the lot kit's meshes report what a press landed on so the Controls' own tap tracker decides between a tap and a camera turn.

**Tech Stack:** Next.js 15, React 19, R3F 9.8 + three 0.180, zustand (`createSceneInputs`), zod wire schema, nuqs URL state, Radix popover (`ValueMenu`), `tsx` check scripts, Playwright probes against the owner's dev server.

**Spec:** `docs/superpowers/specs/2026-11-06-property-facts-and-areas-design.md`, approved by the owner 2026-11-06. Its §13 calls 1–25 stand; this plan adds its own, marked *(plan call)*. Builds on `docs/superpowers/specs/2026-11-03-lot-fences-design.md`.

**Branch / worktree:** `feat/scene-layout-lab` in `.worktrees/scene-layout-lab`, from `26a0e7629`. The owner's dev server runs this worktree on port 3003.

**Stress-tested 2026-11-06.** Four read-only reviews; the owner ruled: merge `feat/trade-scenes-foundation` into the lab first (Task 0), the camera freezes wholly while drawing, and no drawn mark is stored. **Execution order: 0, 1, 2, 3, 4, 5, 6, 9, 7, 8, 10.** Task 9 runs before Task 7 because it deletes the two lab cards that still read the brush copy Task 7 removes.

## Global constraints

- Never `pnpm build`. Never start or stop a dev server. No database writes. Checks: `pnpm exec tsx scripts/<name>.ts`; type-check with `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock pnpm tsc`; lint with `env CI=1 pnpm eslint <files>`.
- Commit by explicit path: `git add <new paths>` then `git commit -F - -- <paths>`. Before every dispatch and every commit `git diff --cached --name-status` must be empty or name only this task's files. Never `git add -A`, never bare `git stash`, never `git reset`, `git checkout` or `git restore` of any path, never `--amend`. Never stage `CONTEXT.md`, `docs/**` or `.superpowers/**` (the owner commits those). Trailer on every commit: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. The pre-commit hook runs about 110 s: give `git commit` a 300 s timeout.
- Scope is the spec. No `package.json` edit, no new script entry, no file outside `src/features/trade-scenes/**`, `scripts/verify-property-layout.ts`, `scripts/verify-trade-scene-layout.ts`, `scripts/verify-layout-kit.ts`, `scripts/verify-trade-scene.ts` (its copy and `escapeStep` assertions only) and (unstaged) `CONTEXT.md`. Anything else is a question to the owner before the edit. *(plan call)* The checks extend those four existing scripts; no new script file.
- The scripts end with `verify-property-layout: ok`, `✓ trade scene layout`, `verify-layout-kit: ok` and `verify-trade-scene: ok`. New check code sits inside its own `{ … }` block and never redeclares a top-level name of the script (`lot`, `mask`, `main`, `regions`, `paved`, `at`, `mulch`, `origin` are taken in `verify-property-layout.ts`). A task that changes what an existing assertion pins rewrites or retires that assertion in the same step; each task below lists the lines.
- After any scripted or multi-file edit, `git diff --shortstat` must show no whole-file rewrite (a CRLF file re-saved as LF).
- Every read of the layout editor store or the resolved layout inside a Controls component (`controls/`, `hooks/use-scene-shortcuts.ts`) goes through `useLayoutEditorStore(): StoreApi<LayoutEditorState> | null` or `useResolvedLayoutOrNull(): ResolvedLayout | null`, which never throw, and the reads of their state live in children mounted only when the store is non-null. The Controls also mount on `/dashboard/trade-scene`, which has neither provider.
- Draw mode freezes the whole camera: orbit, pan, pinch, wheel and double-tap, until Done, Escape or D (owner 2026-11-06). No drawn mark is stored; a tile equal to its yard's base is base (owner 2026-11-06).
- Yards: `YARD_IDS = ['front-yard', 'back-yard', 'left-side-yard', 'right-side-yard']`, on screen Front yard, Back yard, Left side yard, Right side yard, always in that order. Area groups on screen: Exterior, Interior, Lot.
- Systems read from the material: Landscaping = sod, dirt, mulch, gravel, turf, dg, river-rock; Hardscaping = concrete, pavers, asphalt; pool = none. Wear: every ground material except dirt and pool.
- Wear on the `wear` map: `0` none, then `new=1, good=2, fair=3, worn=4, failing=5` (the order of `wears` in `@/shared/modules/construction/core/constants/enums`). `DEFAULT_GROUND_WEAR = 'good'`. New and Good draw today's look.
- Wire `_v: 3`; a `_v: 2` payload still decodes (Task 2). `LAYOUT_URL_MAX` stays 8000.
- The default lot draws exactly as it does now: same picture, same draw-call count. Good is the only wear on it.
- Colours only from `LOT_PALETTE` / `HOME_PALETTE` for scene materials and `LAYOUT_EDITOR_LOOK` for editor chrome. Controls words from `home-scene-copy.ts`, draw-bar and lab-panel words from `LAYOUT_EDITOR_COPY`, material and kind labels from `GROUND_MATERIALS` / `FENCE_KINDS`. One component per file; named exports; comments say why and never cite a plan, spec or task.
- Words: Region and Fence line keep their meanings. Avoid zone, section, segment, edge, boundary. "Area" means a place that holds systems.
- Non-defensive: when a component loses its last caller it is deleted in the same task, with its copy keys.

## Review focus

Conditions the spec implies but its §11 checks do not name. Each has its test in the task that owns the code.

1. A lot whose house reaches a lot line has a yard with no tiles: no rail chip, no Lot tab row, and every yard writer returns the same layout. → Task 1, Task 3.
2. A "Back to base" stroke that crosses two yards writes each tile its own yard's base, material and wear. → Task 2.
3. A `_v: 2` link with mixed ground in a yard decodes to the same existing, proposed and fence maps byte for byte, takes Good wear, and survives encode then decode unchanged. → Task 2.
4. A yard Fencing pick never writes a gate cell or a masked cell, and never a cell off the lot line. → Task 3.
5. Flipping Today and the build mid-draw with a pick the other layer does not offer (sod on the build, chain link on the build) falls back to the first offered pick and never writes an unoffered value. → Task 7.
6. A press that turns the camera is not a tap: it opens no card. A tap on a fence is the fence's tap, never the ground's under it. A tap on the sky with Areas on Lot closes Areas. → Task 9, Task 10.
7. A base change in a yard that is wholly drawn over repaints nothing and still stores the new base; a drawn region that equals the new base becomes base. → Task 3.
8. Leaving Areas while drawing (Property facts, Modify, Benefits, the M key) ends drawing and hands the camera back. → Task 7, Task 10.
9. Escape steps back one layer: a menu, then drawing, then the focused thing, then the yard, then Areas. → Task 4, Task 7, `scripts/verify-trade-scene.ts`.
10. On `/dashboard/trade-scene` the rail shows no group switch, the Lot tab shows its soon tiles, Areas and a system card's wear dots work as before, and nothing throws. → Task 10.
11. A build chip whose ground the build covers only in part reads Mixed; a chip whose value is outside its own list (pavers proposed over lawn, a block wall on the front yard) still shows that value's label. → Task 3, Task 4.

## File structure

All paths under `src/features/trade-scenes/` unless they start with `scripts/`.

| File | Responsibility |
|---|---|
| `constants/yards.ts` (new) | `YARD_IDS`, `AREA_GROUP_IDS`, `GROUND_SYSTEM_IDS`, `YARD_SYSTEM_IDS` |
| `constants/ground-materials.ts` | each material gains `system`, `wears`, `wearLook`; `GROUND_MATERIALS_BY_LAYER`; `GROUND_WEAR_INDEX`, `GROUND_WEAR_NONE`, `DEFAULT_GROUND_WEAR`, `GROUND_BASE` |
| `constants/draw-pick.ts` (new) | `DRAW_ERASE` |
| `lib/perimeter-kinds.ts` | `perimeterKindsFor(side, layer)` |
| `constants/ground-wear-looks.ts` (new) | `GROUND_WEAR_LOOKS`: how fair, worn and failing draw for lawn, paving and loose ground |
| `constants/home-lot.ts` | `LOT_PALETTE` gains `dryGrass`, `bareSoil`, `stain`, `crack`, `fade` |
| `constants/layout-grid.ts` | `MAGNET_TILES = 1` |
| `constants/layout-editor-look.ts` | `yard` and `magnet` colours |
| `constants/layout-editor-copy.ts` | `draw` section; `mode`, `tool`, `brush`, `region` and unread `fenceLine` keys deleted |
| `constants/home-scene-copy.ts` | sections renamed; `AREA_GROUP_LABELS`, `AREA_GROUP_NAMES`, `YARD_LABELS`, `YARD_SYSTEM_LABELS`, `LOT_COPY` |
| `constants/scene-control-icons.ts` | `YARD_ICON` |
| `types.ts` | `YardId`, `AreaGroupId`, `GroundSystemId`, `YardSystemId`, `YardBase`; `LotLayout.wear`, `.bases`; `LotRegion.wear`, `.yard`, `.base`; `ResolvedLayout.yards`; `SystemsFocus` unchanged |
| `schemas/property-layout.ts` | wire `_v` 2 or 3; `lot.wear`, `lot.bases` |
| `lib/yards.ts` (new) | `yardOfTile`, `yardMap`, `presentYards`, `yardTileIndices`, `yardLotLineCells` |
| `lib/ground-wear-at.ts` (new) | `groundWearAt` |
| `lib/lot-regions.ts` | sameness gains wear and yard; regions carry `wear`, `yard`, `base` |
| `lib/create-layout-editor.ts` | `applyStroke` writes wear and the base sentinel; editor state gains `yard`, `pick`; `brush` and `fenceBrush` go; `undoLayout`, `startDrawing`, `endDrawing` beside `commitLayout` |
| `lib/escape-step.ts`, `hooks/use-scene-shortcuts.ts` | Escape layers for drawing, the focused thing and the yard |
| `lib/default-layout.ts`, `lib/layout-codec.ts`, `lib/retile-property-layout.ts`, `lib/resolve-property-layout.ts` | carry `wear`, `bases`, `yards` |
| `lib/yard-picks.ts` (new) | every yard read and write: ground, base, build, fence, Remove, build dot |
| `lib/selection-at.ts` (new) | `regionSelectionAt`, `fenceSelectionAt`, moved out of the deleted cards |
| `lib/draw-brush.ts` (new) | pure: `drawPickFor`, `groundBrushFor`, `fenceBrushFor` |
| `lib/fence-stroke.ts` | `magnetVertex`, `vertexAlong`, `LineLock` |
| `lib/lot-tap.ts` (new) | `lotTapTarget` over a hit |
| `lib/shown-ground.ts` (new) | `shownGround`, `groundStripKeys` |
| `contexts/layout-editor-context.tsx` | `useLayoutEditorStore` (nullable), `useLotIsData` |
| `contexts/resolved-layout-context.tsx` | `useResolvedLayoutOrNull` |
| `contexts/scene-controls-context.tsx` | `group`, `setGroup` |
| `hooks/use-lot-draw-handlers.ts` | brush from the pick and the view; magnet; no tap selection; no camera writes |
| `hooks/use-lot-tap-handlers.ts` (new) | a tap on the lot ground or a fence claims the tap and opens its yard, in orbit mode |
| `hooks/use-fence-tap-handlers.ts` | deleted |
| `ui/components/layout-kit/lot-draw-preview.tsx` | the stroke colour from the pick and the view |
| `ui/components/controls/fact-row.tsx`, `home-facts-tabs.tsx` | `id` widened to `HomeFactId \| YardId`; the Lot tab is soon only where the lot is not data |
| `ui/components/panel/wear-scale.tsx` (new), `wear-dots.tsx` | the five dots without the home material; `WearDots` renders it |
| `ui/components/controls/value-menu.tsx`, `choice-pill.tsx` | option `group` headings; a `disabled` option list |
| `ui/components/controls/lot-pick-chip.tsx` (new) | the one chip for every lot pick |
| `ui/components/controls/area-group-switch.tsx`, `yard-rail-chips.tsx`, `lot-areas-section.tsx` (new), `systems-rail.tsx`, `systems-section.tsx` | the group switch, the yard chips, and the lab-only child that reads the editor |
| `ui/components/controls/system-card.tsx`, `system-card-row.tsx` (new), `system-card-body.tsx` | the card takes a yard; the row is shared |
| `ui/components/controls/yard-card-body.tsx`, `yard-focus-body.tsx` (new) | the yard's rows; one region or one fence |
| `ui/components/controls/lot-facts.tsx` (new), `lot-perimeter-fields.tsx` (moved from `layout-editor/`), `home-facts-body.tsx` | the Lot tab |
| `ui/components/controls/draw-bar.tsx` (new), `ui/components/layout-editor/layout-editor-panel.tsx` | the bar, a Controls piece; the panel keeps Layout only |
| `ui/components/layout-editor/{layout-mode-toggle,brush-picker,brush-rows,fence-brush-rows,ground-brush-rows,region-card,fence-card}.tsx`, `ui/lib/brush-row-values.ts` | deleted |
| `ui/components/layout-kit/layout-regions.tsx`, `layout-lot.tsx`, `layout-yard-outline.tsx`, `layout-magnet-band.tsx` (new) | wear strips; press handlers; the yard outline; the lit band |
| `ui/lib/create-wear-texture.ts` (new) | the worn lawn and worn paving textures |
| `ui/views/property-layout-lab-view.tsx` | D and Escape end drawing |
| `scripts/verify-property-layout.ts`, `scripts/verify-trade-scene-layout.ts`, `scripts/verify-layout-kit.ts`, `scripts/verify-trade-scene.ts` | the checks |

---

### Task 0: Sync the lab with the foundation branch, and the baseline

`feat/trade-scenes-foundation` is 36 commits past the merge base `d9b8138fc`. It rewrote `hooks/use-scene-tap-away.ts` so the tap fires on the click after the release and a mesh can claim it (`contexts/scene-tap-claim-context.tsx`, `hooks/use-scene-tap-claim.ts`, `claimTap()` in `home-kit.tsx`, `spot-pin.tsx`, `part-pins.tsx`), and it changed `scene-controls-context.tsx`, `use-scene-shortcuts.ts`, `home-scene-copy.ts`, `home-systems.ts`, `types.ts` and `scripts/verify-trade-scene.ts`. Of those, the lab's commits since the merge base touch only `types.ts` (52 added lines) and `scripts/verify-trade-scene.ts` (9), so a conflict, if any, sits there. Neither branch changed the committed `CONTEXT.md`. Task 9 is built on the claim.

- [ ] **Step 1: Preflight.** `git diff --cached --name-status` is empty. `git diff --name-only d9b8138fc feat/trade-scenes-foundation -- CONTEXT.md` must print nothing; if it names `CONTEXT.md`, stop and ask the owner to commit their unstaged `CONTEXT.md` first, since the merge would refuse it.
- [ ] **Step 2: Merge.** `git merge --no-edit feat/trade-scenes-foundation` (a merge, never a rebase; 300 s timeout for the hook). A conflict is resolved by hand and staged with `git add <that path>` only, then `git commit --no-edit`. Never `git add -A`.
- [ ] **Step 3: Check.** The four scripts print their closing lines. `pnpm tsc` clean. `git grep -n "useSceneTapClaim" src/features/trade-scenes/hooks/use-scene-tap-away.ts` has one hit.
- [ ] **Step 4: Baseline.** If `ss -ltnp | grep 3003` answers: with `GL_COUNTER` from the probe lib, write the default lot's draw-call count on Today and on the build to `.superpowers/sdd/2026-11-06-property-facts-and-areas/baseline.json`, and re-shoot the parity pairs with `parity/shots.mjs` into `baseline/`. If it does not answer, stop and ask the owner to start it: Task 10 compares against this baseline and nothing else can produce it.

### Task 1: Yards, systems and the glossary

**Files:**
- Create: `constants/yards.ts`, `lib/yards.ts`
- Modify: `constants/ground-materials.ts`, `types.ts`, `lib/resolve-property-layout.ts`, `CONTEXT.md` (unstaged)
- Test: `scripts/verify-property-layout.ts`

**Interfaces:**
- Produces:
  - `YARD_IDS`, `AREA_GROUP_IDS = ['exterior', 'interior', 'lot']`, `GROUND_SYSTEM_IDS = ['landscaping', 'hardscaping']`, `YARD_SYSTEM_IDS = ['landscaping', 'hardscaping', 'fencing', 'patio-cover']`; types `YardId`, `AreaGroupId`, `GroundSystemId`, `YardSystemId` in `types.ts`.
  - `GROUND_MATERIALS[id].system: GroundSystemId | null` and `.wears: boolean` (values in Global constraints); `GROUND_MATERIALS_BY_LAYER: Record<GroundLayer, readonly GroundMaterialId[]>`, the twin of `FENCE_KINDS_BY_LAYER` (`fence-kinds.ts:36`), which Tasks 4 and 7 offer in their menus.
  - `yardOfTile(main: TileRect, col: number, row: number): YardId` — `row < main.r0` front; `row >= main.r0 + main.rows` back; else `col < main.c0` left side; else right side.
  - `yardMap(layout: PropertyLayout): Int8Array` — per tile, the index into `YARD_IDS`, `-1` under any mass.
  - `presentYards(yards: Int8Array): readonly YardId[]` — in `YARD_IDS` order, only yards with a tile.
  - `yardTileIndices(yards: Int8Array, yard: YardId): readonly number[]`.
  - `yardLotLineCells(lot: Pick<LotLayout, 'cols' | 'rows'>, yards: Int8Array, yard: YardId): readonly { axis: FenceAxis, indices: readonly number[] }[]` — the perimeter cells (across lines `0` and `rows`, along lines `0` and `cols`) whose one in-lot tile (`fenceCellTiles`) is in the yard; an axis with no cells is left out. No mask parameter: a perimeter cell has one tile off the lot, so `fenceCellMask` never masks it. `indices` are map indices, as `paintFenceList` and `applyFenceStroke` take them.
  - `ResolvedLayout.yards: Int8Array`.

- [ ] **Step 1: Write the failing checks** at the end of `scripts/verify-property-layout.ts`, before its `ok` line, inside one `{ … }` block that every later task extends. The script already holds `layout` (the default), `lot`, `main`, `mask` and `cellMask` at its top level (`:120-:198`): reuse them and declare nothing else by those names. The names below are the block's own:

```ts
const fenceMask = cellMask
assert.equal(yardOfTile(main, 0, 0), 'front-yard')
assert.equal(yardOfTile(main, 0, main.r0 - 1), 'front-yard')
assert.equal(yardOfTile(main, 0, main.r0), 'left-side-yard')
assert.equal(yardOfTile(main, main.c0 + main.cols, main.r0), 'right-side-yard')
assert.equal(yardOfTile(main, 0, main.r0 + main.rows), 'back-yard')
const yards = yardMap(DEFAULT_LAYOUT)
assert.equal(yards[main.r0 * lot.cols + main.c0], -1, 'a tile under the house is in no yard')
assert.deepEqual(presentYards(yards), YARD_IDS)
assert.equal(YARD_IDS.reduce((n, yard) => n + yardTileIndices(yards, yard).length, 0), yards.filter(v => v !== -1).length)
// The front yard's lot lines: the whole front line, and the side lines only as far back as the house face.
const frontCells = yardLotLineCells(lot, yards, 'front-yard')
assert.equal(frontCells.find(c => c.axis === 'across')!.indices.length, lot.cols)
assert.equal(frontCells.find(c => c.axis === 'along')!.indices.length, main.r0 * 2)
assert.ok(yardLotLineCells(lot, yards, 'back-yard').every(c => c.indices.every(i => fenceMask[c.axis][i] === 0)), 'no lot-line cell is ever masked')
// Review focus 1: a house built to the left lot line leaves no left side yard.
const flush = { ...DEFAULT_LAYOUT, house: { ...DEFAULT_LAYOUT.house, masses: DEFAULT_LAYOUT.house.masses.map(m => m.role === 'main' ? { ...m, cols: m.cols + m.c0, c0: 0 } : m) } }
assert.ok(!presentYards(yardMap(flush)).includes('left-side-yard'))
for (const id of GROUND_MATERIAL_IDS) {
  assert.equal(GROUND_MATERIALS[id].wears, id !== 'dirt' && id !== 'pool')
  assert.equal(GROUND_MATERIALS[id].system, id === 'pool' ? null : ['concrete', 'pavers', 'asphalt'].includes(id) ? 'hardscaping' : 'landscaping')
}
```

- [ ] **Step 2: Run** `pnpm exec tsx scripts/verify-property-layout.ts`. Expected: fails on the missing imports.
- [ ] **Step 3: Implement** the constants, the two material fields, `lib/yards.ts` and `ResolvedLayout.yards` (set in `resolvePropertyLayout` from `yardMap(layout)`).
- [ ] **Step 4: Run** the check. Expected: `verify-property-layout: ok`. Then `pnpm tsc`: clean.
- [ ] **Step 5: Glossary.** In `CONTEXT.md` (leave unstaged) add **Area**, **Area group**, **Yard**, **Base** and **Lot-line fence** as the spec's §3 words them; add **Draw bar** and **Lot-line magnet** under Fence line; extend **System** (`:125`) to the lot's four systems; extend **Wear** (`:127`) from "home material" to ground as well; add wear and the yard to **Region** (`:155`) and change its _Avoid_ note from "area (Home facts' Area tab)" to "area (a place holding systems, see Area)"; under **Ground material** (`:156`) remove "landscaping" from _Avoid_ now that Landscaping is a system's name; under **Perimeter** (`:164`) replace the region card as the place a perimeter is read with the focused yard card. Add the **Property facts** entry the sibling branch's glossary carries (facts about the home, one set per customer; the scene's Home facts section takes the name) with a note that the Lot tab's base, wear and fences are a build's starting fill and where they are saved is project 4's call.
- [ ] **Step 6: Commit** the source and the script by path: `feat(trade-scenes): yards derived from the main mass; ground materials name their system and whether they wear`.

### Task 2: Wear and bases in the model, the wire and the regions

**Files:**
- Create: `lib/ground-wear-at.ts`
- Modify: `constants/ground-materials.ts`, `types.ts`, `lib/create-layout-editor.ts`, `lib/default-layout.ts`, `schemas/property-layout.ts`, `lib/layout-codec.ts`, `lib/retile-property-layout.ts`, `lib/lot-regions.ts`, `lib/resolve-property-layout.ts`, and every caller of `lotRegions` / `regionAt` / `regionTileIndices`
- Test: `scripts/verify-property-layout.ts`

**Interfaces:**
- Consumes: Task 1's `yardMap`, `yardTileIndices`, `GROUND_MATERIALS[id].wears`.
- Produces:
  - `GROUND_WEAR_NONE = 0`, `GROUND_WEAR_INDEX: Record<Wear, number>` (1–5), `DEFAULT_GROUND_WEAR: Wear = 'good'`, `GROUND_BASE = 'base'`; `groundWearAt(value: number): Wear | null`.
  - `interface YardBase { material: GroundMaterialId, wear: Wear | null }`; `LotLayout.wear: Uint8Array` (one per tile); `LotLayout.bases: Record<YardId, YardBase>`.
  - `GroundBrush = { existing: GroundMaterialId | typeof GROUND_BASE | null, proposed: GroundMaterialId | typeof PROPOSED_KEEP | null, wear?: Wear }`.
  - `applyStroke(layout, target, brush)`, same signature. With `existing` a material: writes it and writes `wear` (default Good) where the material wears, `0` where it does not. With `existing: GROUND_BASE`: writes each target tile its own yard's base material and wear. With `existing: null` and `wear` set: writes that wear on target tiles whose Today material wears. Same layout back when nothing changes.
  - `LotRegion` gains `wear: Wear | null`, `yard: YardId`, `base: boolean` (Today material and wear equal the yard's base).
  - `lotRegions(lot: LotLayout, mask: Uint8Array, yards: Int8Array)`, `regionAt(regions, lot, mask, yards, col, row)`, `regionTileIndices(regions, lot, mask, yards, id)` — two tiles are one region when existing, proposed, wear and yard are all equal.
  - Wire: `_v: 3`, `lot.wear: string` (runs), `lot.bases: Record<YardId, { m: number, w: number }>` (material index, wear index). `decodePropertyLayout` accepts `_v: 2` and fills: wear Good on every tile whose Today material wears, else none; each yard's base the most common Today material among its unmasked tiles, pool and unset tiles left out of the count (a tie goes to the earlier id in `GROUND_MATERIAL_IDS`; a yard with no tiles, or only pool, gets sod), with Good or none. A `_v: 3` payload is rejected when a base material is pool, unset or a build-only material, or a wear is above 5.

- [ ] **Step 0: Retire what this task changes** in `scripts/verify-property-layout.ts`: the `lotRegions` / `regionAt` calls on the small fixtures (`:273-:301`) take a yards map built by hand for the fixture (`new Int8Array(cells).fill(0)`) and the `LotRegion` literal gains `wear: 'good', yard: 'front-yard', base: true`; the two-sod-regions and lawn-size assertions (`:306-:308`) become "the back yard's sod is one region of `yardTileIndices(yards, 'back-yard').length` tiles"; the wire assertion (`:404`) reads `3`. In `scripts/verify-layout-kit.ts:23` the `LotLayout` literal gains `wear` and `bases`. Every other `LotLayout` literal: `git grep -n "fence: {" src scripts` lists them.
- [ ] **Step 1: Write the failing checks:**

```ts
const good = GROUND_WEAR_INDEX.good
assert.ok(DEFAULT_LAYOUT.lot.wear.every((w, i) => w === (yards[i] === -1 ? w : good)), 'every yard tile of the default lot is Good')
assert.deepEqual(DEFAULT_LAYOUT.lot.bases['back-yard'], { material: 'sod', wear: 'good' })
// Regions stop at the yard line, and say which yard and whether they are base.
const regions = lotRegions(lot, mask, yards)
for (const region of regions) {
  const tiles = regionTileIndices(regions, lot, mask, yards, region.id)
  assert.ok(tiles.every(i => YARD_IDS[yards[i]] === region.yard), `region ${region.id} sits in one yard`)
}
assert.ok(regions.some(r => r.existing === 'sod' && r.base && r.yard === 'back-yard'))
assert.ok(regions.filter(r => r.existing === 'mulch').every(r => !r.base && r.wear === 'good'))
assert.equal(regions.filter(r => r.existing === 'mulch').reduce((n, r) => n + r.tiles, 0), lot.existing.filter((v, i) => v === GROUND_MATERIAL_INDEX.mulch && yards[i] !== -1).length, 'splitting a bed at the yard line loses no tile')
// Wear splits a region; dirt carries none.
const back = yardTileIndices(yards, 'back-yard')
const worn = applyStroke(DEFAULT_LAYOUT, back.slice(0, 2), { existing: null, proposed: null, wear: 'worn' })
assert.equal(worn.lot.wear[back[0]], GROUND_WEAR_INDEX.worn)
assert.equal(lotRegions(worn.lot, mask, yards).filter(r => r.yard === 'back-yard' && r.existing === 'sod').length, 2)
const dirt = applyStroke(DEFAULT_LAYOUT, back.slice(0, 2), { existing: 'dirt', proposed: null })
assert.equal(dirt.lot.wear[back[0]], GROUND_WEAR_NONE)
assert.equal(applyStroke(dirt, back.slice(0, 2), { existing: null, proposed: null, wear: 'worn' }), dirt, 'wear on dirt changes nothing')
// Review focus 2: Back to base across two yards writes each tile its own yard's base.
const twoBases = { ...dirt, lot: { ...dirt.lot, bases: { ...dirt.lot.bases, 'left-side-yard': { material: 'concrete', wear: 'fair' } } } } as PropertyLayout
const left = yardTileIndices(yards, 'left-side-yard')
const erased = applyStroke(twoBases, [back[0], left[0]], { existing: GROUND_BASE, proposed: null })
assert.equal(erased.lot.existing[back[0]], GROUND_MATERIAL_INDEX.sod)
assert.equal(erased.lot.existing[left[0]], GROUND_MATERIAL_INDEX.concrete)
assert.equal(erased.lot.wear[left[0]], GROUND_WEAR_INDEX.fair)
// Wire v3 round trip, and review focus 3: a v2 link.
const text = encodePropertyLayout(worn)
assert.equal(JSON.parse(text)._v, 3)
assert.deepEqual(decodePropertyLayout(text, worn.tile), worn)
const v2 = JSON.parse(encodePropertyLayout(dirt)); v2._v = 2; delete v2.lot.wear; delete v2.lot.bases
const old = decodePropertyLayout(JSON.stringify(v2), dirt.tile)!
assert.deepEqual(old.lot.existing, dirt.lot.existing)
assert.deepEqual(old.lot.proposed, dirt.lot.proposed)
assert.deepEqual(old.lot.fence, dirt.lot.fence)
assert.equal(old.lot.wear[back[2]], good)
assert.equal(old.lot.wear[back[0]], GROUND_WEAR_NONE, 'old dirt carries no wear')
assert.deepEqual(old.lot.bases['back-yard'], { material: 'sod', wear: 'good' })
assert.deepEqual(decodePropertyLayout(encodePropertyLayout(old), old.tile), old)
assert.deepEqual(decodePropertyLayout((() => { const w = JSON.parse(encodePropertyLayout(DEFAULT_LAYOUT)); w._v = 2; delete w.lot.wear; delete w.lot.bases; return JSON.stringify(w) })(), DEFAULT_LAYOUT.tile), DEFAULT_LAYOUT, 'an old link to the default lot is the default lot')
const pooled = applyStroke(DEFAULT_LAYOUT, back, { existing: 'pool', proposed: null })
const pooledV2 = JSON.parse(encodePropertyLayout(pooled)); pooledV2._v = 2; delete pooledV2.lot.wear; delete pooledV2.lot.bases
assert.deepEqual(decodePropertyLayout(JSON.stringify(pooledV2), pooled.tile)!.lot.bases['back-yard'], { material: 'sod', wear: 'good' }, 'pool is never a base')
const badBase = JSON.parse(text); badBase.lot.bases['back-yard'].m = GROUND_MATERIAL_INDEX.pool
assert.equal(decodePropertyLayout(JSON.stringify(badBase), worn.tile), null, 'a pool base is refused')
// Re-tile carries wear.
assert.equal(retilePropertyLayout(worn, worn.tile / 2).lot.wear.length, worn.lot.wear.length * 4)
```

- [ ] **Step 2: Run** the check. Expected: fails.
- [ ] **Step 3: Implement.** `defaultLayout` writes Good on every tile and sod with Good as all four bases. The codec encodes and decodes `wear` with `encodeRuns` / `decodeRuns`, rejects as above, and fills a `_v: 2` payload as above. `retilePropertyLayout` resamples `wear` with `resample`. `resolvePropertyLayout` passes `yards` to `lotRegions`. The other `lotRegions` / `regionAt` / `regionTileIndices` callers take the new parameter: `ui/components/layout-editor/region-card.tsx:32,51` and `hooks/use-lot-draw-handlers.ts:181` (`git grep -n "regionAt(\|regionTileIndices(\|lotRegions(" src scripts` is the full list).
- [ ] **Step 4: Run** `pnpm exec tsx scripts/verify-property-layout.ts` and `pnpm exec tsx scripts/verify-layout-kit.ts`: both `ok`. `pnpm tsc`: clean.
- [ ] **Step 5: Commit:** `feat(trade-scenes): ground wear and a base per yard in the layout and its link; regions stop at the yard line`.

### Task 3: Yard picks

**Files:**
- Create: `lib/yard-picks.ts`, `lib/selection-at.ts`
- Modify: `lib/perimeter-kinds.ts`, `ui/components/layout-editor/region-card.tsx`, `fence-card.tsx` (import the moved helpers; both cards are deleted in Task 9)
- Test: `scripts/verify-property-layout.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces, all pure, all returning the same layout when nothing changes. `Mixed` is the literal `'mixed'`.
  - `yardSystemTiles(lot: LotLayout, yards: Int8Array, yard: YardId, system: GroundSystemId): readonly number[]` — the yard's tiles whose Today material is of that system.
  - `yardGroundToday(lot, yards, yard, system): { material: GroundMaterialId | 'mixed', wear: Wear | 'mixed' | null } | null` — `null` when the yard has none of that system.
  - `yardGroundBuild(lot, yards, yard, system): GroundMaterialId | 'mixed' | null` — over the same tiles; `null` when the build keeps all of them; one material when the build puts that material on every one of them; otherwise `'mixed'` (keep counts as a value, so a build that covers part of the lawn reads Mixed). The material may be of another system: pavers proposed over lawn sits under the Landscaping chip, since Today's material decides the chip.
  - `setYardGround(layout: PropertyLayout, yard: YardId, system: GroundSystemId, patch: { material?: GroundMaterialId, wear?: Wear }): PropertyLayout` — writes every tile of `yardSystemTiles`; when the yard's base material is of that system the base takes the patch too. A material patch alone keeps each tile's wear, except that a material that does not wear writes none and one that does, over none, writes Good (the same rule as `setYardBase`).
  - `setYardBase(layout, yard, patch: { material?: GroundMaterialId, wear?: Wear }): PropertyLayout` — repaints the yard's tiles that equal the old base, then stores the new base. A new material that does not wear stores `wear: null`; one that does, coming from none, stores Good. `proposed` is left alone on every tile.
  - `setYardBuild(layout, yard, system, material: GroundMaterialId | typeof PROPOSED_KEEP): PropertyLayout` — writes the proposed map over `yardSystemTiles`.
  - `perimeterKindsFor(side: LotSide, layer: GroundLayer = 'existing'): readonly FenceKindId[]` in `lib/perimeter-kinds.ts`, widened: the layer's kinds (`FENCE_KINDS_BY_LAYER[layer]`) without gates; the front also without `blockWall`. The yard card calls it with the yard's side (`front-yard` → `front`, `back-yard` → `back`, the side yards → `left` / `right`); there is no separate `yardFenceKinds`.
  - `yardFence(layout, yards, yard, layer: GroundLayer): FenceKindId | 'mixed' | null` — over the yard's lot-line cells where a fence stands today and is not a gate (an empty cell counts for nothing); `null` when no such cell; on `proposed`, `null` when the build changes none of them. It can answer a kind outside `perimeterKindsFor` (a block wall drawn on the front yard's lot line): the chip then labels that kind from `FENCE_KINDS` and offers the cap's list.
  - `setYardFence(layout, yard, layer, kind: FenceKindId | typeof PROPOSED_KEEP): PropertyLayout` — writes the lot-line cells that stand today and are not gates; on `existing`, when none stand, every lot-line cell.
  - `yardBuildChanges(layout, yards, yard): boolean` — a proposed tile in the yard, or a proposed fence cell touching one of its tiles.
  - `removeRegion(layout, tiles: readonly number[]): PropertyLayout` — Today back to each tile's base, the build cleared.
  - `removeFenceLine(layout, line: FenceLine): PropertyLayout` — both layers cleared on the line's cells.
  - `regionSelectionAt(layout, tile: number): EditorSelection | null`, `fenceSelectionAt(layout, axis, line, cell): EditorSelection | null` in `lib/selection-at.ts`, moved unchanged in behaviour from the two lab cards.

- [ ] **Step 1: Write the failing checks:**

```ts
// A yard chip acts on the whole yard's share of a system, base included.
const turf = setYardBuild(DEFAULT_LAYOUT, 'back-yard', 'landscaping', 'turf')
assert.equal(yardGroundBuild(turf.lot, yards, 'back-yard', 'landscaping'), 'turf')
assert.equal(yardGroundBuild(turf.lot, yards, 'front-yard', 'landscaping'), null, 'a back yard pick leaves the front yard alone')
assert.deepEqual(yardGroundToday(DEFAULT_LAYOUT.lot, yards, 'front-yard', 'landscaping'), { material: 'mixed', wear: 'good' }, 'lawn and mulch')
assert.deepEqual(yardGroundToday(DEFAULT_LAYOUT.lot, yards, 'front-yard', 'hardscaping'), { material: 'concrete', wear: 'good' })
assert.equal(yardGroundToday(DEFAULT_LAYOUT.lot, yards, 'back-yard', 'hardscaping'), null)
assert.ok(yardBuildChanges(turf, yards, 'back-yard') && !yardBuildChanges(turf, yards, 'front-yard'))
// Review focus 11: part of the lawn covered reads Mixed; a material of another system still sits under Today's chip.
const halfPavers = applyStroke(DEFAULT_LAYOUT, back.slice(0, 4), { existing: null, proposed: 'pavers' })
assert.equal(yardGroundBuild(halfPavers.lot, yards, 'back-yard', 'landscaping'), 'mixed')
assert.equal(yardGroundBuild(applyStroke(DEFAULT_LAYOUT, back, { existing: null, proposed: 'pavers' }).lot, yards, 'back-yard', 'landscaping'), 'pavers')
// The Today chip moves the base with it.
const wornLawn = setYardGround(DEFAULT_LAYOUT, 'back-yard', 'landscaping', { wear: 'worn' })
assert.deepEqual(wornLawn.lot.bases['back-yard'], { material: 'sod', wear: 'worn' })
assert.ok(lotRegions(wornLawn.lot, mask, yards).filter(r => r.yard === 'back-yard').every(r => r.base))
// A base change leaves a drawn region alone; review focus 7.
const patio = applyStroke(DEFAULT_LAYOUT, back.slice(0, 4), { existing: 'concrete', proposed: null, wear: 'fair' })
const gravel = setYardBase(patio, 'back-yard', { material: 'gravel' })
assert.equal(gravel.lot.existing[back[0]], GROUND_MATERIAL_INDEX.concrete)
assert.equal(gravel.lot.wear[back[0]], GROUND_WEAR_INDEX.fair)
assert.equal(gravel.lot.existing[back[10]], GROUND_MATERIAL_INDEX.gravel)
const absorbed = setYardBase(patio, 'back-yard', { material: 'concrete', wear: 'fair' })
assert.ok(lotRegions(absorbed.lot, mask, yards).filter(r => r.yard === 'back-yard').every(r => r.base), 'a region equal to the new base is base')
const paved = applyStroke(DEFAULT_LAYOUT, back, { existing: 'pavers', proposed: null })
const stored = setYardBase(paved, 'back-yard', { material: 'dirt' })
assert.deepEqual(stored.lot.existing, paved.lot.existing, 'a yard wholly drawn over repaints nothing')
assert.deepEqual(stored.lot.bases['back-yard'], { material: 'dirt', wear: null })
// Remove returns the tiles to the base and clears the build.
const built = applyStroke(patio, back.slice(0, 4), { existing: null, proposed: 'pavers' })
const removed = removeRegion(built, back.slice(0, 4))
assert.equal(removed.lot.existing[back[0]], GROUND_MATERIAL_INDEX.sod)
assert.equal(removed.lot.proposed[back[0]], PROPOSED_KEEP)
// Fencing: lot lines only, never a gate; review focus 4.
assert.equal(yardFence(DEFAULT_LAYOUT, yards, 'back-yard', 'existing'), 'blockWall')
assert.equal(yardFence(DEFAULT_LAYOUT, yards, 'back-yard', 'proposed'), null)
assert.equal(yardFence(DEFAULT_LAYOUT, yards, 'left-side-yard', 'existing'), 'mixed', 'the default left lot line holds a low wall and a block wall')
assert.ok(!perimeterKindsFor('front', 'existing').includes('blockWall') && perimeterKindsFor('back', 'existing').includes('blockWall'))
assert.ok(perimeterKindsFor('back', 'proposed').every(id => !FENCE_KINDS[id].gate && FENCE_KINDS[id].sets.includes('proposed')))
assert.deepEqual([...perimeterKindsFor('front')], [...perimeterKindsFor('front', 'existing')], 'the old one-argument call keeps its answer')
const backCells = yardLotLineCells(lot, yards, 'back-yard')
// A yard with no lot-line fence standing: the pick stands the kind along every lot-line cell.
const bare = removeFenceLine(removeFenceLine(DEFAULT_LAYOUT, lotFenceLines(DEFAULT_LAYOUT, fenceMask).find(l => l.axis === 'across' && l.existing === 'blockWall')!), lotFenceLines(DEFAULT_LAYOUT, fenceMask).find(l => l.axis === 'along' && l.line === lot.cols)!)
assert.equal(yardFence(bare, yards, 'right-side-yard', 'existing'), null)
const fencedRight = setYardFence(bare, 'right-side-yard', 'existing', 'woodFence')
assert.ok(yardLotLineCells(lot, yards, 'right-side-yard').every(c => c.indices.every(i => fencedRight.lot.fence.existing[c.axis][i] === FENCE_KIND_INDEX.woodFence)))
const acrossBack = backCells.find(c => c.axis === 'across')!.indices
const gated = applyFenceStroke(DEFAULT_LAYOUT, { axis: 'across', indices: acrossBack.slice(0, 2) }, { existing: 'woodGate', proposed: null })
const vinyl = setYardFence(gated, 'back-yard', 'proposed', 'vinylFence')
assert.equal(vinyl.lot.fence.proposed.across[acrossBack[0]], 0, 'the gate is left alone')
assert.equal(vinyl.lot.fence.proposed.across[acrossBack[2]], FENCE_KIND_INDEX.vinylFence)
const untouched = [...vinyl.lot.fence.proposed.across].filter((v, i) => v !== 0 && !acrossBack.includes(i)).length
assert.equal(untouched, 0, 'no across cell off the back yard\'s lot line is written')
const fenceLine = lotFenceLines(vinyl, fenceMask).find(l => l.proposed === 'vinylFence')!
const gone = removeFenceLine(vinyl, fenceLine)
assert.ok(fenceLineCells(fenceLine, lot).every(i => gone.lot.fence.existing[fenceLine.axis][i] === 0 && gone.lot.fence.proposed[fenceLine.axis][i] === 0))
// Review focus 1: a yard with no tiles.
assert.equal(setYardBuild(flush, 'left-side-yard', 'landscaping', 'turf'), flush)
assert.equal(setYardFence(flush, 'left-side-yard', 'existing', 'woodFence'), flush)
```

- [ ] **Step 2: Run** the check. Expected: fails.
- [ ] **Step 3: Implement** `lib/yard-picks.ts` on `applyStroke`, `applyFenceStroke` and Task 1's readers; widen `perimeterKindsFor`; move the two selection helpers (`regionSelectionAt` at `region-card.tsx:29`, `fenceSelectionAt` at `fence-card.tsx:29`).
- [ ] **Step 4: Run** the check: `ok`. `pnpm tsc`: clean. The `perimeterKindsFor` assertions at `verify-property-layout.ts:977-:978` still hold.
- [ ] **Step 5: Commit:** `feat(trade-scenes): yard picks: ground, base, build, lot-line fences and Remove as pure repaints`.

### Task 4: Property facts, Areas, the Lot group and the yard card

**Files:**
- Create: `ui/components/panel/wear-scale.tsx`, `ui/components/controls/lot-pick-chip.tsx`, `area-group-switch.tsx`, `yard-rail-chips.tsx`, `lot-areas-section.tsx`, `system-card-row.tsx`, `yard-card-body.tsx`, `ui/components/layout-kit/layout-yard-outline.tsx`
- Modify: `constants/home-scene-copy.ts`, `constants/scene-control-icons.ts`, `constants/layout-editor-look.ts`, `lib/create-layout-editor.ts`, `lib/escape-step.ts`, `hooks/use-scene-shortcuts.ts`, `contexts/layout-editor-context.tsx`, `contexts/resolved-layout-context.tsx`, `contexts/scene-controls-context.tsx`, `ui/components/panel/wear-dots.tsx`, `ui/components/controls/value-menu.tsx`, `choice-pill.tsx`, `systems-rail.tsx`, `systems-section.tsx`, `system-card.tsx`, `system-card-body.tsx`, `ui/components/layout-kit/layout-lot.tsx`, `.superpowers/sdd/2026-11-02-scene-layout-l1-l2-lot-as-data/lib.mjs` (git-ignored: the probes' button name)
- Test: `scripts/verify-trade-scene-layout.ts`, `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: Task 3's readers and writers; `commitLayout`.
- Produces:
  - Copy, exact: `CONTROLS_COPY.sections.facts = 'Property facts'`, `.systems = 'Areas'`, `factsMissing: count => \`Property facts, ${count} missing\``, `CONTROLS_COPY.systems.title = 'Areas'`, and every other place the two old names are written in `home-scene-copy.ts`: `:147` "Set the roof under Property facts", `:253` `groupTags.facts = 'Property facts'` and `.systems = 'Areas'`, `:282` "From Property facts → Area; change it there.", `:330` "Pick upgrades in Modify or Areas, …". After the edit `git grep -n "Home facts\|'Systems'" src scripts` names nothing but the facts tab "Area" and code identifiers. `scripts/verify-trade-scene.ts:2747` takes the new roof line. `AREA_GROUP_LABELS = { exterior: 'Exterior', interior: 'Interior', lot: 'Lot' }`, `AREA_GROUP_NAMES = { exterior: 'Home exterior', interior: 'Home interior, coming soon', lot: 'Lot' }`, `YARD_LABELS` and `YARD_SYSTEM_LABELS = { 'landscaping': 'Landscaping', 'hardscaping': 'Hardscaping', 'fencing': 'Fencing', 'patio-cover': 'Patio cover' }`, `LOT_COPY = { mixed: 'Mixed', keep: 'Keep what is there', wearDot: (ground: string, wear: string) => \`${ground}: ${wear}\` }` (later tasks add keys). Condition is `CONTROLS_COPY.systems.condition` (`:216`) and soon is `CONTROLS_COPY.facts.soon` (`:202`), already there; no second copy of either.
  - `LayoutEditorState.yard: YardId | null` (starts `null`).
  - `useLayoutEditorStore(): StoreApi<LayoutEditorState> | null` and `useLotIsData(): boolean` (`useLayoutEditorStore() !== null`) in `layout-editor-context.tsx`; `useResolvedLayoutOrNull(): ResolvedLayout | null` in `resolved-layout-context.tsx`. None throws. The throwing `useLayoutEditorApi`, `useLayoutEditor` and `useResolvedLayout` stay for the lab-only pieces.
  - `escapeStep` gains `yard: boolean` and `thing: boolean` in its context and the answers `'thing'` and `'yard'`: after `look-inside`, with Areas open, `thing` first (clears `selected`), then `yard` (clears `yard`, focus returns to `[data-rail-chip="<yard>"]`), then `focus`, then `systems`. `useSceneShortcuts` reads both from `useLayoutEditorStore()`, false when it is null. `scripts/verify-trade-scene.ts` gains two assertions beside `:3297`.
  - `SceneControlsValue.group: Exclude<AreaGroupId, 'interior'>` (starts `'exterior'`) and `setGroup(group)`; choosing `'lot'` lets the system in focus go (`focusSystem(null)`).
  - `WearScale({ value: Wear | null, label: (wear: Wear) => string, onPick: (wear: Wear) => void, disabled?: boolean, guessed?: boolean })` — the dots, the arrow keys and the 40 px targets lifted out of `WearDots`, which now renders it with its years label and `applyChange`.
  - `ValueMenu` options take an optional `group: string`; consecutive options sharing one sit under a caps heading. `ChoicePill` takes `disabled?: readonly T[]`.
  - `LotPickChip<T extends string>({ id: string, keyLabel?: string, label: string, options: readonly { value: T, label: string, group?: string }[], value: T | 'mixed' | null, labelOf: (value: T) => string, proposed?: boolean, addText?: string, keep?: boolean, wear?: { value: Wear | 'mixed' | null, onPick: (wear: Wear) => void }, extra?: ReactNode, onPick: (value: T | typeof PROPOSED_KEEP) => void })` — `ControlsChip` in a `ValueMenu`, the same two primitives `ExistingChip` and `ProposedChip` compose; it forks neither. The chip's text comes from `labelOf(value)` (`GROUND_MATERIALS[v].label` or `FENCE_KINDS[v].label`), never from the options, so a value outside the list (pavers proposed over lawn, a block wall on the front yard's line) still reads as itself while the menu offers the list. Today (`proposed` false): variant `value`, text is the label, `LOT_COPY.mixed` or `addText`, joined to the wear's label with `CONTROLS_COPY.systems.valueJoin`; the menu's `extra` is `CONTROLS_COPY.systems.condition` with a `WearScale` when `wear` is given. Build: variant `on` with a check when picked, `add` with a plus and `addText` when `null`; `keep` appends `LOT_COPY.keep`. `data-lot-chip={id}`.
  - `SystemCardRow({ side: 'existing' | 'proposed', children })` — the body's `sideRow`, moved, used by both bodies.
  - `SystemCard({ focus: HomeSystemId | 'year-built' | YardId })`; a yard takes `YARD_LABELS`, `YARD_ICON`, `YardCardBody`, measures no bottom (as Year built), and its close sets the editor's `yard` and `selected` to `null` and returns focus to `[data-rail-chip="<yard>"]`.
  - `YardCardBody({ yard })` — a lab-only child: it reads the editor and the resolved layout with the throwing hooks, and is mounted only from a branch that has already seen `useLotIsData()` true. Today row: one `LotPickChip` per ground system with `yardGroundToday !== null` (`keyLabel` the system's label; options that system's existing materials from `GROUND_MATERIALS_BY_LAYER.existing`; `wear` shown when any of its ground wears), then the Fencing chip (`yardFence` on `existing`; options `perimeterKindsFor(side, 'existing')`; `addText` the system's label). Build row: Landscaping and Hardscaping chips for the systems the yard has today (`yardGroundBuild`; options that system's proposed materials; `keep`), the Fencing chip when a lot-line fence stands today, and an inert `ControlsChip` variant `add`, `aria-disabled`, reading "Patio cover · soon" through `CONTROLS_COPY.facts.soon`. Each pick is `commitLayout(inputs, editor, <Task 3 writer>)`.
  - `LayoutYardOutline({ resolved, yard })` — the yard's outline from `regionRings` over its tiles, dashed, `LAYOUT_EDITOR_LOOK.yard`, raycast ignored; mounted by `LayoutLot` whenever the editor's `yard` is set.

- [ ] **Step 1: Write the failing checks** in `scripts/verify-trade-scene-layout.ts`:

```ts
assert.equal(CONTROLS_COPY.sections.facts, 'Property facts')
assert.equal(CONTROLS_COPY.sections.systems, 'Areas')
assert.equal(CONTROLS_COPY.factsMissing(2), 'Property facts, 2 missing')
assert.deepEqual(YARD_IDS.map(id => YARD_LABELS[id]), ['Front yard', 'Back yard', 'Left side yard', 'Right side yard'])
assert.deepEqual(AREA_GROUP_IDS.map(id => AREA_GROUP_LABELS[id]), ['Exterior', 'Interior', 'Lot'])
```

And in `scripts/verify-trade-scene.ts`, beside `:3297`:

```ts
assert.equal(escapeStep({ ...bare, open: 'systems', yard: true, thing: true }), 'thing', 'the focused thing goes before the yard')
assert.equal(escapeStep({ ...bare, open: 'systems', yard: true }), 'yard', 'the yard goes before Areas')
```

- [ ] **Step 1b: Retire** `scripts/verify-property-layout.ts:558`, the editor's opening state, which gains `yard: null` here (Task 7 reshapes it again).
- [ ] **Step 2: Run** `pnpm exec tsx scripts/verify-trade-scene-layout.ts` and `pnpm exec tsx scripts/verify-trade-scene.ts`. Expected: both fail.
- [ ] **Step 3: Implement the copy, the state and the widened pieces** (`WearScale`, `ValueMenu` groups, `ChoicePill` `disabled`, `SystemCardRow`, the nullable accessors, `group`, the `escapeStep` layers and their handling in `useSceneShortcuts`).
- [ ] **Step 4: Implement the rail.** `SystemsRail` renders `AreaGroupSwitch` first when `useLotIsData()` (a `ChoicePill` over `AREA_GROUP_IDS` with `disabled={['interior']}`, a separator after it), then the Exterior chips unchanged, or for Lot `YardRailChips`: a lab-only child with one `Toolbar.Button` per `presentYards(resolved.yards)`, `data-rail-chip={yard}`, `aria-pressed` on the editor's `yard`, the build dot and `changedByBuild` name from `yardBuildChanges`, a press toggling the editor's `yard` and clearing `selected`. Without lot data the rail is exactly today's.
- [ ] **Step 5: Implement the card.** `SystemsSection` itself reads nothing from the editor. It renders a `LotAreasSection` child only when `useLotIsData()`; that child reads the editor's `yard`, shows `SystemCard key={yard} focus={yard}` when the group is Lot and a yard is held, and clears the editor's `yard` and `selected` when it unmounts or the group leaves Lot (an effect cleanup; Task 7 adds `endDrawing` to the same cleanup). `SystemCard` takes the store through `useLayoutEditorStore()` and its yard close writes `yard` and `selected` to `null` through it when it is non-null; the yard's rows are `YardCardBody`. Mount `LayoutYardOutline`.
- [ ] **Step 6: Run** `scripts/verify-trade-scene-layout.ts`, `scripts/verify-trade-scene.ts` and `scripts/verify-property-layout.ts`: all pass. `pnpm tsc` clean. `env CI=1 pnpm eslint src/features/trade-scenes`: clean. `git grep -n "Home facts\|'Systems'" src scripts`: only the facts tab "Area" and identifiers. Change the probe lib's button name (`lib.mjs:82`) from `/Home facts/` to `/Property facts/`.
- [ ] **Step 7: Commit:** `feat(trade-scenes): Property facts and Areas; a Lot group whose yards open a card with the system card's rows`.

### Task 5: The Lot tab

**Files:**
- Create: `ui/components/controls/lot-facts.tsx`
- Move: `ui/components/layout-editor/lot-perimeter-fields.tsx` → `ui/components/controls/lot-perimeter-fields.tsx`
- Modify: `constants/home-scene-copy.ts`, `constants/layout-editor-copy.ts`, `ui/components/controls/home-facts-body.tsx`, `home-facts-tabs.tsx`, `fact-row.tsx`, `ui/components/layout-editor/layout-editor-panel.tsx`
- Test: `scripts/verify-property-layout.ts`

**Interfaces:**
- Consumes: `LotPickChip`, `setYardBase`, `useLotIsData`, `FactRow`, `SoonTiles`.
- Produces:
  - `LOT_COPY` gains `yardsToday: 'Yards today'`, `yardsHint: 'The base each yard starts from'`, `fencesToday: 'Fences today'`, `base: (yard: string) => \`${yard} · base\``, `soonTiles: [{ title: 'Patio cover', hint: 'Its own design, soon.' }, { title: 'Lot size', hint: 'Filled from the address, soon.' }]`, and its own `sides` and `noFence`, the four side names and "None" that `lot-perimeter-fields.tsx:49-:61` reads from `LAYOUT_EDITOR_COPY.fences` today, so the moved fields read `LOT_COPY` only. `LAYOUT_EDITOR_COPY.fences` stays for the fence card until Task 7 deletes the copy nothing reads.
  - `FactRow.id: HomeFactId | YardId` (`fact-row.tsx:12`); `value` already takes `null` and needs no change.
  - `LotFacts()` — a lab-only child: a caps heading and hint, then one `FactRow` per present yard (`id={yard}`, never missing) whose control is a `LotPickChip` on `layout.lot.bases[yard]`: options every existing ground material except pool, each with `group` its system's label; `label` `LOT_COPY.base(...)`; `wear` when the base material wears; picks through `setYardBase`. Then, under a `LOT_COPY.fencesToday` caps heading, `LotPerimeterFields` with its own `h3` removed (`:61`), then `SoonTiles tiles={LOT_COPY.soonTiles}`.
  - `HomeFactsBody`'s Lot panel renders `LotFacts` when `useLotIsData()`, else today's two soon tiles. `HomeFactsTabs` (`home-facts-tabs.tsx:38`) marks the Lot tab soon only when the lot is not data, so the tab's name and label stop saying soon on the lab.

- [ ] **Step 0: Retire** in `scripts/verify-property-layout.ts`: `:968` reads the fields at the old path, point it at `ui/components/controls/lot-perimeter-fields.tsx`; `:995` expects the panel to mount `<LotPerimeterFields`, drop that half of the assertion.
- [ ] **Step 1: Implement** as above.
- [ ] **Step 2: Remove** `LotPerimeterFields` and its separator from the lab panel.
- [ ] **Step 3: Run** `pnpm exec tsx scripts/verify-property-layout.ts`: `ok`. `pnpm tsc` and `env CI=1 pnpm eslint src/features/trade-scenes`: clean. `git grep -n "layout-editor/lot-perimeter-fields"`: no hits. `git grep -n "LAYOUT_EDITOR_COPY" src/features/trade-scenes/ui/components/controls`: no hits.
- [ ] **Step 4: Commit:** `feat(trade-scenes): the Lot tab sets each yard's base and wear and holds the four fence sides`.

### Task 6: Wear in the scene

**Files:**
- Create: `constants/ground-wear-looks.ts`, `lib/shown-ground.ts`, `ui/lib/create-wear-texture.ts`
- Modify: `constants/ground-materials.ts`, `constants/home-lot.ts`, `ui/components/layout-kit/layout-regions.tsx`, `layout-lot.tsx`
- Test: `scripts/verify-layout-kit.ts`

**Interfaces:**
- Produces:
  - `GROUND_MATERIALS[id].wearLook: 'lawn' | 'paving' | 'loose' | null` — sod lawn; concrete, asphalt, pavers paving; mulch, gravel, turf, dg, river-rock loose; dirt, pool `null`.
  - `shownGround(lot: LotLayout, layer: GroundLayer, i: number): { material: number, wear: number }` — the proposed material at New where the build installs one, else the Today material and its wear.
  - `groundStripKeys(lot, layer, mask): readonly { material: GroundMaterialId, wear: Wear | null }[]` — the strips to mount: New folds into Good, sod at Good is left out (the ground strip is the lawn), one key per remaining pair.
  - `GROUND_WEAR_LOOKS: Record<'lawn' | 'paving' | 'loose', Record<'fair' | 'worn' | 'failing', { tint: keyof typeof LOT_PALETTE, mix: number, marks: number, breaks: number }>>` with: lawn fair `dryGrass 0.15 / 0 / 0`, worn `dryGrass 0.4 / 0.1 / 0`, failing `dryGrass 0.7 / 0.3 / 0` (marks are bare-soil patches as a share of the area); paving fair `stain 0.15 / 0 / 0`, worn `stain 0.3 / 6 / 0`, failing `stain 0.45 / 14 / 0.1` (marks are cracks per 4 m square, breaks the broken share); loose `fade 0.15`, `fade 0.3`, `fade 0.5`, no marks.
  - `createWearTexture(look: 'lawn' | 'paving', wear: 'fair' | 'worn' | 'failing', colour: string): CanvasTexture` — a canvas drawn with `seededRandom`, so a wear step looks the same on every render. It covers a 4 m square, as the lawn texture does, but a region strip's UVs are in metres (`ui/lib/region-strip-geometry.ts:23`) where the ground strip's are per 4 m (`ground-strip-geometry.ts:17`), so the texture's `repeat` is `1 / 4` on a region strip, never the lawn's `1`. Loose ground mixes its colour only, through `wornColor` (`ui/lib/worn-color.ts:11`).
  - `LOT_PALETTE.dryGrass`, `.bareSoil`, `.stain`, `.crack`, `.fade`.

- [ ] **Step 1: Write the failing checks** in `scripts/verify-layout-kit.ts`:

```ts
const keysOf = (layout: PropertyLayout, layer: GroundLayer) => groundStripKeys(layout.lot, layer, massMask(layout)).map(k => `${k.material}:${k.wear}`).sort()
assert.deepEqual(keysOf(DEFAULT_LAYOUT, 'existing'), ['concrete:good', 'mulch:good'], 'the default lot mounts the strips it mounts today')
const lawn = yardTileIndices(yardMap(DEFAULT_LAYOUT), 'back-yard')
const wornSod = applyStroke(DEFAULT_LAYOUT, lawn.slice(0, 3), { existing: null, proposed: null, wear: 'worn' })
assert.ok(keysOf(wornSod, 'existing').includes('sod:worn'))
const fresh = applyStroke(DEFAULT_LAYOUT, lawn.slice(0, 3), { existing: null, proposed: null, wear: 'new' })
assert.deepEqual(keysOf(fresh, 'existing'), keysOf(DEFAULT_LAYOUT, 'existing'), 'New draws as Good')
// The build keeps a worn lawn worn and draws what it installs as New.
const turfed = applyStroke(wornSod, lawn.slice(0, 1), { existing: null, proposed: 'turf' })
assert.deepEqual(shownGround(turfed.lot, 'proposed', lawn[0]), { material: GROUND_MATERIAL_INDEX.turf, wear: GROUND_WEAR_INDEX.new })
assert.deepEqual(shownGround(turfed.lot, 'proposed', lawn[1]), { material: GROUND_MATERIAL_INDEX.sod, wear: GROUND_WEAR_INDEX.worn })
for (const id of GROUND_MATERIAL_IDS) {
  assert.equal(GROUND_MATERIALS[id].wearLook === null, !GROUND_MATERIALS[id].wears)
}
```

- [ ] **Step 2: Run** `pnpm exec tsx scripts/verify-layout-kit.ts`. Expected: fails.
- [ ] **Step 3: Implement.** `LayoutRegions` builds one strip per `groundStripKeys` entry, picking tiles with `shownGround` (`groundStripKeys` replaces its private `materialsIn`, `layout-regions.tsx:25`). A Good or wear-less strip keeps today's material props exactly. A lawn or paving strip at fair, worn or failing takes `createWearTexture` as its `map` (cached per look and wear, disposed with the strips); a loose strip takes its colour mixed toward `LOT_PALETTE.fade` by `mix`. `LayoutLot` passes `LayoutRegions` the weather's `ground` tint it already gives `LayoutGround` (`layout-lot.tsx:72`, `layout-ground.tsx:33`), so a worn lawn darkens in the rain as the lawn does. Worn sod strips rise `0.005` so they never fight the ground strip.
- [ ] **Step 4: Run** the four check scripts: all pass. `pnpm tsc` and eslint: clean.
- [ ] **Step 5: Commit:** `feat(trade-scenes): ground draws its wear: a thinning lawn, stained and cracked paving, faded loose ground`.

### Task 7: Drawing from the card, and the lab panel cut down

Runs after Task 9, which has already deleted the region card, the fence card and the fence tap hook.

**Files:**
- Create: `constants/draw-pick.ts`, `lib/draw-brush.ts`, `ui/components/controls/draw-bar.tsx`
- Modify: `lib/create-layout-editor.ts`, `lib/escape-step.ts`, `hooks/use-scene-shortcuts.ts`, `constants/layout-editor-copy.ts`, `constants/home-scene-copy.ts`, `hooks/use-lot-draw-handlers.ts`, `ui/components/controls/yard-card-body.tsx`, `lot-areas-section.tsx`, `ui/components/layout-kit/layout-lot.tsx`, `lot-draw-preview.tsx`, `ui/components/layout-editor/layout-editor-panel.tsx`, `ui/views/property-layout-lab-view.tsx`
- Delete: `ui/components/layout-editor/layout-mode-toggle.tsx`, `brush-picker.tsx`, `brush-rows.tsx`, `fence-brush-rows.tsx`, `ground-brush-rows.tsx`, `ui/lib/brush-row-values.ts`; the `mode`, `tool`, `brush`, `region`, `fenceLine` and `fences` sections of `LAYOUT_EDITOR_COPY` (nothing reads them once the cards and rows are gone)
- Test: `scripts/verify-property-layout.ts`, `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - `DRAW_ERASE = 'erase'` in `constants/draw-pick.ts`; `interface DrawPick { ground: GroundMaterialId | typeof DRAW_ERASE, fence: FenceKindId | typeof DRAW_ERASE }` in `create-layout-editor.ts` beside the other editor types; `LayoutEditorState.pick: DrawPick` (starts `{ ground: 'concrete', fence: 'woodFence' }`) replaces `brush` and `fenceBrush`.
  - The bar offers Task 1's `GROUND_MATERIALS_BY_LAYER[view]` for ground and `FENCE_KINDS_BY_LAYER[view]` for a fence (gates included). There is no `drawOptions`.
  - `drawPickFor<T extends string>(pick: T | typeof DRAW_ERASE, offered: readonly T[]): T | typeof DRAW_ERASE` — the pick when offered or the eraser, else `offered[0]`. `groundBrushFor(pick, view): GroundBrush` and `fenceBrushFor(pick, view): FenceBrush` (values in Step 1). All three pure, in `lib/draw-brush.ts`, which imports nothing from the editor store.
  - In `lib/create-layout-editor.ts`, beside `commitLayout` (`:73`, the feature's one home for store writers): `startDrawing(editor: StoreApi<LayoutEditorState>, tool: EditorTool, pick?: GroundMaterialId | FenceKindId): void` — draw mode, the tool, the pick when given, `selected` and `stroke` cleared; `endDrawing(editor): void` — orbit mode, `stroke` cleared, a no-op in orbit mode; `undoLayout(inputs, editor): void` — the panel's private undo (`layout-editor-panel.tsx:46-:54`) lifted out, used by the panel and the bar.
  - `LAYOUT_EDITOR_COPY.draw = { drawing: 'Drawing', done: 'Done', backToBase: 'Back to base', noFence: 'No fence', hintGround: 'Drag across the ground', hintFence: 'Drag along a line' }` (flat strings, as `verify-property-layout.ts:951-:956` requires of every copy line). Undo reads `LAYOUT_EDITOR_COPY.layout.undo` and Keep reads `LOT_COPY.keep`; neither is written twice. `LOT_COPY` gains `drawRegion: 'Draw a region'`, `drawFence: 'Draw a fence'`, `drawHint: 'Part of the yard gets its own ground or its own fence.'`.
  - `DrawBar()` in `ui/components/controls/` — a lab-only child, shown in draw mode, top centre of the stage, `data-draw-bar`: the word Drawing, a `LotPickChip` over the view's list whose last entry is the view's eraser, the hint, Undo (`undoLayout`, disabled at depth 0) and Done (`endDrawing`). At a stage under 480 px the hint is dropped.
  - `escapeStep` gains `drawing: boolean`, answered `'drawing'` right after `'menu'`; `useSceneShortcuts` handles it with `endDrawing`. The lab view keeps the D key only: while drawing D calls `endDrawing`, otherwise it does nothing (D no longer starts drawing).

- [ ] **Step 0: Retire** in `scripts/verify-property-layout.ts`: `:558` (the editor's opening state, now `{ mode: 'orbit', tool: 'ground', pick: { ground: 'concrete', fence: 'woodFence' }, yard: null, selected: null, stroke: null, undo: [] }`), `:947` (the copy's sections, now `['draw', 'layout']`), `:977-:986` (brush rows and brush picker; Task 9 already retired the cards' lines). Adapt `.superpowers/sdd/…/shots/perimeter/press.mjs`, which finds the editor store by `'brush' in state`, to `'pick' in state`.
- [ ] **Step 1: Write the failing checks:**

```ts
assert.deepEqual(groundBrushFor('pavers', 'existing'), { existing: 'pavers', proposed: null })
assert.deepEqual(groundBrushFor(DRAW_ERASE, 'existing'), { existing: GROUND_BASE, proposed: null })
assert.deepEqual(groundBrushFor('pavers', 'proposed'), { existing: null, proposed: 'pavers' })
assert.deepEqual(groundBrushFor(DRAW_ERASE, 'proposed'), { existing: null, proposed: PROPOSED_KEEP })
assert.deepEqual(fenceBrushFor('vinylFence', 'existing'), { existing: 'vinylFence', proposed: null })
assert.deepEqual(fenceBrushFor(DRAW_ERASE, 'existing'), { existing: FENCE_NONE, proposed: null })
assert.deepEqual(fenceBrushFor('vinylFence', 'proposed'), { existing: null, proposed: 'vinylFence' })
assert.deepEqual(fenceBrushFor(DRAW_ERASE, 'proposed'), { existing: null, proposed: PROPOSED_KEEP })
// Review focus 5.
assert.ok(!GROUND_MATERIALS_BY_LAYER.proposed.includes('sod') && !FENCE_KINDS_BY_LAYER.proposed.includes('chainLink'))
assert.equal(drawPickFor('sod', GROUND_MATERIALS_BY_LAYER.proposed), GROUND_MATERIALS_BY_LAYER.proposed[0])
assert.equal(drawPickFor('chainLink', FENCE_KINDS_BY_LAYER.proposed), FENCE_KINDS_BY_LAYER.proposed[0])
assert.equal(drawPickFor(DRAW_ERASE, GROUND_MATERIALS_BY_LAYER.proposed), DRAW_ERASE)
assert.ok(FENCE_KINDS_BY_LAYER.existing.some(id => FENCE_KINDS[id].gate), 'gates are drawn from the bar')
const drawStore = createLayoutEditor()
startDrawing(drawStore, 'fence', 'vinylFence')
assert.deepEqual([drawStore.getState().mode, drawStore.getState().tool, drawStore.getState().pick.fence], ['draw', 'fence', 'vinylFence'])
endDrawing(drawStore)
assert.equal(drawStore.getState().mode, 'orbit')
assert.equal(endDrawing(drawStore), undefined)
assert.equal(drawStore.getState().undo.length, 0, 'ending drawing writes no layout')
```

And in `scripts/verify-trade-scene.ts`, beside the two Task 4 added: `assert.equal(escapeStep({ ...bare, open: 'systems', drawing: true, yard: true, thing: true }), 'drawing', 'drawing goes before the thing')`.

- [ ] **Step 2: Run** both scripts. Expected: both fail.
- [ ] **Step 3: Implement** `constants/draw-pick.ts`, `GROUND_MATERIALS_BY_LAYER`, `lib/draw-brush.ts`, the editor state and the three store writers, the `escapeStep` layer. `lot-draw-preview.tsx:26-:43` takes its stroke colour from `groundBrushFor(pick.ground, view)` / `fenceBrushFor(pick.fence, view)`, with `GROUND_BASE` drawing `LAYOUT_EDITOR_LOOK.previewNeutral`.
- [ ] **Step 4: Rework the stroke.** `useLotDrawHandlers` builds its brush at pointer-up from `drawPickFor(pick[tool], <the view's list>)` and the inputs' `view`. A stroke that starts and ends on one tile or one vertex paints nothing and selects nothing. Draw mode owns the camera: an effect in `LayoutLot` calls `setSceneCameraDrawing(camera, mode === 'draw')`, and the stroke code stops writing that flag (its hold still refuses a new stroke until every finger is up). That flag already stops orbit, pan, pinch, wheel and double-tap together (`camera-rig.tsx:237-:244`); the owner chose the whole freeze.
- [ ] **Step 5: Wire the card and the section.** `YardCardBody` gains the action line (two buttons calling `startDrawing(editor, 'ground')` and `startDrawing(editor, 'fence')`, then the hint) and, in the build row, an add chip for each ground system the yard lacks today, which sets the inputs' `view` to `proposed` and calls `startDrawing(editor, 'ground', <that system's first proposed material>)`; a yard with no lot-line fence standing gets the same add chip for Fencing, starting `startDrawing(editor, 'fence', perimeterKindsFor(side, 'proposed')[0])`. `LotAreasSection`: while drawing, the yard card is not shown, `DrawBar` is, the tap-away is off, and its cleanup (unmount, or the group leaving Lot) calls `endDrawing` as well, so leaving Areas by any door hands the camera back (review focus 8).
- [ ] **Step 6: Keys and the panel.** The lab view's key listener keeps D as above and loses Escape. `LayoutEditorPanel` keeps its title and the Layout section and loses the toggle and the brush picker. Delete the files and copy sections listed above.
- [ ] **Step 7: Run** the four check scripts: all pass. `pnpm tsc` and eslint: clean. `git grep -nw "fenceBrush\|brush\|BrushPicker\|LayoutModeToggle\|BRUSH_ROW_VALUES" src/features/trade-scenes`: no hits (`-w`, so `fenceBrushFor` and `fenceBrushColor` do not count). `git grep -n "LAYOUT_EDITOR_COPY\.\(mode\|tool\|brush\|region\|fenceLine\|fences\)" src scripts`: no hits.
- [ ] **Step 8: Commit:** `feat(trade-scenes): drawing starts from a yard card and is steered from a bar; the camera holds still until Done; the lab panel keeps Undo, Reset and Copy link`.

### Task 8: The lot-line magnet

**Files:**
- Create: `ui/components/layout-kit/layout-magnet-band.tsx`
- Modify: `constants/layout-grid.ts`, `constants/layout-editor-look.ts`, `lib/fence-stroke.ts`, `lib/create-layout-editor.ts`, `hooks/use-lot-draw-handlers.ts`, `ui/components/layout-kit/layout-lot.tsx`
- Test: `scripts/verify-property-layout.ts`

**Interfaces:**
- Produces:
  - `MAGNET_TILES = 1`.
  - `interface LineLock { axis: FenceAxis, line: number }`; the fence member of `EditorStroke` gains `lock: LineLock | null`.
  - `vertexAlong(origin: LotOrigin, lot: Grid, lock: LineLock, x: number, z: number): GridVertex` — the point projected onto the locked line and clamped to its ends.
  - `magnetVertex(origin: LotOrigin, lot: Grid, x: number, z: number, withinTiles: number): { vertex: GridVertex, lock: LineLock } | null` — the nearest lot line within `withinTiles` on either side of it, the point no more than `withinTiles` past the line's ends; a tie goes to the front or back line; `null` further in or further out.
  - `LayoutMagnetBand({ resolved })` — four flat strips, `2 × MAGNET_TILES` wide, centred on the lot lines, `LAYOUT_EDITOR_LOOK.magnet`, raycast ignored; mounted in draw mode with the fence tool.

- [ ] **Step 1: Write the failing checks,** with `origin = lotOrigin(DEFAULT_LAYOUT)`, `t = DEFAULT_LAYOUT.tile`, and `at = (col: number, row: number) => [origin.originX + col * t, origin.frontZ - row * t] as const`:

```ts
const mid = Math.floor(lot.rows / 2)
// On the lot line, just inside it, just outside it on the neighbour's ground, and on the far face of a wall standing on it.
for (const col of [0, 0.9, -0.9, 0.4]) {
  assert.deepEqual(magnetVertex(origin, lot, ...at(col, mid + 0.2), MAGNET_TILES), { vertex: [0, mid], lock: { axis: 'along', line: 0 } })
}
assert.equal(magnetVertex(origin, lot, ...at(1.2, mid), MAGNET_TILES), null, 'further inside, the nearest grid line draws as before')
assert.equal(magnetVertex(origin, lot, ...at(-1.2, mid), MAGNET_TILES), null)
assert.deepEqual(magnetVertex(origin, lot, ...at(lot.cols + 0.5, mid), MAGNET_TILES)!.lock, { axis: 'along', line: lot.cols })
assert.deepEqual(magnetVertex(origin, lot, ...at(3, lot.rows - 0.3), MAGNET_TILES)!.lock, { axis: 'across', line: lot.rows })
assert.deepEqual(magnetVertex(origin, lot, ...at(0.3, 0.3), MAGNET_TILES)!.lock, { axis: 'across', line: 0 }, 'a corner tie goes to the front line')
// The drag runs along the locked line however far the finger strays.
assert.deepEqual(vertexAlong(origin, lot, { axis: 'along', line: 0 }, ...at(4, mid + 5.4)), [0, mid + 5])
assert.deepEqual(vertexAlong(origin, lot, { axis: 'along', line: 0 }, ...at(4, lot.rows + 9)), [0, lot.rows])
```

- [ ] **Step 2: Run** the check. Expected: fails.
- [ ] **Step 3: Implement** the two functions and the constant.
- [ ] **Step 4: Use them.** With the fence tool, pointer-down opens the stroke from `magnetVertex(...)` when it answers (carrying its `lock`), else from `vertexAt` as now with `lock: null`; pointer-move uses `vertexAlong` while a lock is held. The fence group takes the same four draw handlers in draw mode with the fence tool, so a press on a wall standing on the lot line starts a stroke instead of falling through. Mount `LayoutMagnetBand`.
- [ ] **Step 5: Run** the four check scripts: all pass. `pnpm tsc` and eslint: clean.
- [ ] **Step 6: Commit:** `feat(trade-scenes): a fence press near a lot line lands on it and the drag runs along it`.

### Task 9: A tap in the scene, the focused card and Remove

Runs after Task 6 and before Task 7. Built on the foundation branch's tap claim (Task 0): `useSceneTapAway` fires its callback on the click that follows a tap unless a mesh called `claimTap()` first (`hooks/use-scene-tap-away.ts`, `hooks/use-scene-tap-claim.ts`), the way `home-kit.tsx`, `spot-pin.tsx` and `part-pins.tsx` claim theirs. R3F runs a mesh's `onClick` only when the pointer moved two pixels or less since its press (`calculateDistance` in its event layer), so a drag that turns the camera never reaches the handler, and the handler needs no pointer bookkeeping of its own.

**Files:**
- Create: `lib/lot-tap.ts`, `hooks/use-lot-tap-handlers.ts`, `ui/components/controls/yard-focus-body.tsx`
- Modify: `constants/home-scene-copy.ts`, `ui/components/controls/yard-card-body.tsx`, `ui/components/layout-kit/layout-lot.tsx`, `ui/components/layout-editor/layout-editor-panel.tsx` (stops mounting the two cards)
- Delete: `hooks/use-fence-tap-handlers.ts`, `ui/components/layout-editor/region-card.tsx`, `fence-card.tsx`
- Unchanged: `hooks/use-scene-tap-away.ts`, `systems-section.tsx`'s one `useSceneTapAway(shown, close)` call
- Test: `scripts/verify-property-layout.ts`

**Interfaces:**
- Consumes: `removeRegion`, `removeFenceLine`, `regionSelectionAt`, `fenceSelectionAt`, `LotPickChip`, `useSceneTapClaim`, `isNearestSolidHit`, `fenceLineNear`, `fenceCellTiles`.
- Produces:
  - `interface LotHit { tile: readonly [col: number, row: number] | null, fenceId: string | null }`.
  - `lotTapTarget(hit: LotHit, resolved: Pick<ResolvedLayout, 'layout' | 'mask' | 'yards' | 'regions' | 'fences'>): { yard: YardId, selected: EditorSelection | null } | null` — `null` when the tile is `null` or in no yard. A fence gives `{ type: 'fence', id }` and the yard of the tile. A region that is not base, or that the build changes, gives `{ type: 'region', id }`. Base ground the build keeps gives `selected: null`.
  - `useLotTapHandlers(resolved): { ground: Pick<ThreeElements['mesh'], 'onClick'>, fence: Pick<ThreeElements['group'], 'onClick'> } | null` — non-null only in orbit mode while the Controls are open on Areas with the group on Lot (`useSceneControls()` reaches the canvas as every other Controls context does). The fence handler: when its hit is the nearest solid hit, it takes the fence line under the hit (`fenceLineNear` with `FENCE_MESH_TAP_SHARE`), the tile on the hit's side of the line (`fenceCellTiles`, the one nearer the hit point), calls `event.stopPropagation()` so the ground's handler never runs for the same click, and acts. The ground handler: when its hit is the nearest solid hit, `tileAt` under the point and `fenceLineNear` with `LINE_TAP_SHARE`, and acts. To act: `lotTapTarget` answering non-null calls `claimTap()` and writes the editor's `yard` and `selected`; answering `null` claims nothing, so the tap-away closes Areas as today (a tap on the sky, which hits no handler, closes it too: review focus 6).
  - `LOT_COPY` gains `removeRegion: 'Remove region'`, `removeRegionHint: "Back to the yard's base."`, `removeFence: 'Remove fence'`, `removeFenceHint: 'Gone from today and the build.'`, `wholeYard: 'Whole yard'`, `inside: 'Inside the lot'` (a fence between two yards is inside the lot, not inside a yard).
  - `YardFocusBody({ yard, selected })` — a line naming the thing (a region: its system's label, or Pool, and `formatSquareFeet`; a fence: its side from `LOT_COPY.sides` or `LOT_COPY.inside`, and `formatFeet`); a Today `LotPickChip` and a build `LotPickChip` writing that one thing (region: every existing material with its wear, every proposed material with keep; fence: the existing kinds with gates, the proposed kinds with gates and keep), the selection re-found after each write with the `selection-at` helpers, by the region's anchor tile or the fence's first cell, since a region's id is its first tile and can name another region after a write; a destructive Remove button with its hint; a Whole yard button that clears `selected`. `data-yard-focus={selected.type}`. Undo and Reset clear `selected` (`undoLayout` and the panel's reset do it; before Task 7 lifts `undoLayout`, the panel's own undo does).

- [ ] **Step 0: Retire** in `scripts/verify-property-layout.ts`: `:678-:681` and `:991` read `use-fence-tap-handlers.ts`; `:961-:965` read the region card and pin it as the one measurer (the focused card now measures: the list becomes `yard-focus-body.tsx` and `lot-regions.ts`); `:987-:990` read the fence card; `:996` the panel's mounts.
- [ ] **Step 1: Write the failing checks:**

```ts
const resolvedDefault = resolvePropertyLayout(DEFAULT_LAYOUT)
const lawnTile = [back[0] % lot.cols, Math.floor(back[0] / lot.cols)] as const
assert.deepEqual(lotTapTarget({ tile: lawnTile, fenceId: null }, resolvedDefault), { yard: 'back-yard', selected: null }, 'base ground opens the yard, unfocused')
assert.equal(lotTapTarget({ tile: null, fenceId: null }, resolvedDefault), null, 'off the lot')
assert.equal(lotTapTarget({ tile: [main.c0, main.r0], fenceId: null }, resolvedDefault), null, 'under the house')
const mulchRegion = resolvedDefault.regions.find(r => r.existing === 'mulch')!
const mulchTile = [mulchRegion.bbox.c0, mulchRegion.bbox.r0] as const
assert.deepEqual(lotTapTarget({ tile: mulchTile, fenceId: null }, resolvedDefault), { yard: mulchRegion.yard, selected: { type: 'region', id: mulchRegion.id } })
const wall = resolvedDefault.fences.find(f => f.existing === 'blockWall' && f.axis === 'across')!
assert.deepEqual(lotTapTarget({ tile: [1, lot.rows - 1], fenceId: wall.id }, resolvedDefault), { yard: 'back-yard', selected: { type: 'fence', id: wall.id } }, 'a fence tap is the fence, not the ground under it')
const resolvedTurf = resolvePropertyLayout(applyStroke(DEFAULT_LAYOUT, back.slice(0, 2), { existing: null, proposed: 'turf' }))
assert.equal(lotTapTarget({ tile: lawnTile, fenceId: null }, resolvedTurf)!.selected?.type, 'region', 'base ground the build changes can be opened and removed')
```

- [ ] **Step 2: Run** the check. Expected: fails.
- [ ] **Step 3: Implement** `lotTapTarget`, the tap handlers and `YardFocusBody`.
- [ ] **Step 4: Wire the card and the scene.** `YardCardBody` renders `YardFocusBody` when `selected` names a region or a fence line that still exists, else its rows. `LayoutLot` gives the ground mesh and the fence group the tap handlers in orbit mode, shows `LayoutRegionOutlines` and `LayoutFenceHighlight` whenever `selected` is set, in either mode, and no longer mounts the fence tap handlers. The lab panel stops mounting the two cards. Delete the two cards and the hook.
- [ ] **Step 5: Run** the four check scripts: all pass. `pnpm tsc` and eslint: clean. `git grep -n "RegionCard\|FenceCard\|useFenceTapHandlers" src`: no hits.
- [ ] **Step 6: Commit:** `feat(trade-scenes): a tap on the lot opens its yard on that region or fence; Remove clears it from today and the build`.

### Task 10: Live probes, parity, the owner's screens

Needs the owner's dev server on port 3003. If `ss -ltnp | grep 3003` shows nothing, stop and ask the owner to start it. Probes live under `.superpowers/sdd/2026-11-06-property-facts-and-areas/` (git-ignored), import `../2026-11-02-scene-layout-l1-l2-lot-as-data/lib.mjs` (its facts button now reads Property facts, Task 4), sign in through `signInUrl`, and run one at a time. The parity scripts are `../2026-11-02-scene-layout-l1-l2-lot-as-data/parity/shots.mjs` and `parity/both-views.mjs`.

- [ ] **Step 1: Parity.** Re-shoot the default lot's parity pairs with `parity/shots.mjs` and `parity/both-views.mjs` and compare them with Task 0's `baseline/`. Expected: every pair matches. Any change is a defect to fix before going on.
- [ ] **Step 2: Draw calls.** With `GL_COUNTER`, the default lot's draw-call count on Today and on the build equals Task 0's `baseline.json`.
- [ ] **Step 3: `press.mjs`,** adapted from `shots/perimeter/press.mjs` (the store is found by `'pick' in state`): start "Draw a fence" from the Back yard card, then press and drag along each lot line from the four camera turns. Expected: every sample a stroke, `totals.orbit === 0`, and each stroke's cells on the lot line.
- [ ] **Step 4: `remove.mjs`.** Tap a fence, Remove fence: its cells are 0 on both fence maps; Undo restores both. Draw a concrete region on Today, propose pavers on it, tap it, Remove region: Today reads the yard's base, the build reads keep; one Undo restores both.
- [ ] **Step 5: `base.mjs`.** Draw a region in the back yard, change the back yard's base and wear from the Lot tab: the region keeps its material and wear; the rest of the yard follows the base.
- [ ] **Step 6: `old-link.mjs`.** Open a link whose payload is `_v: 2` (encode the default layout, set `_v` to 2, drop `wear` and `bases`): the scene matches the default lot's parity shot and the address bar rewrites to `_v: 3` after the first edit.
- [ ] **Step 7: `tap.mjs`.** With Areas closed, a tap on the lawn opens nothing. With Areas on Exterior, it closes Areas as today. With Areas on Lot, a tap on the lawn opens that yard, a tap on a mulch bed focuses it, a tap on the back wall focuses the wall and not the lawn under it, a tap on the house closes Areas, a tap on the sky closes Areas, and a drag that turns the camera opens nothing. While drawing, pressing Modify's button ends drawing and the camera turns again (review focus 8). Escape on a focused fence returns to the yard card, Escape again closes the card and leaves Areas open (review focus 9).
- [ ] **Step 8: `scene-route.mjs`.** On `/dashboard/trade-scene` (review focus 10): the rail shows no group switch, Property facts' Lot tab shows two soon tiles, Areas opens and a roof card's wear dots answer the arrow keys, and the page logs no error.
- [ ] **Step 9: Screens for the owner,** at 1180 × 820 and 390 × 844, saved beside the probes: the Lot tab; each yard card on Today and on the build; a focused region; a focused fence; the draw bar with the lit band; sod and concrete at all five wear steps; the lab panel beside the rail at 390 px, so the owner sees whether Undo and Reset sit clear of the rail.
- [ ] **Step 10: Report** each probe's output line, the parity result and the screen paths. No commit: nothing here is tracked.

## Self-review notes

- Spec coverage: §4 yards, systems, base, wear, regions at the yard line → Tasks 1–3; storage limits → Task 2; §5 → Task 5 (rename in Task 4); §6 rail, card, one rule → Task 4, add chips → Task 7, tap and focus → Task 9, "where it shows" → the nullable accessors and lab-only children in Tasks 4–5; §7 → Tasks 7–8; §8 → Tasks 5, 7, 9; §9 → Task 6; §10 → Tasks 4 and 7 (the card docks as a system card, the bar drops its hint), screens in Task 10; §11 → Task 10; §3 → Task 1 Step 5.
- Plan calls: a tile equal to its yard's base is base, so no drawn flag is stored (owner-confirmed 2026-11-06); yard focus lives in the editor store because the scene must draw its outline; a lot mesh claims its own tap through the foundation branch's claim, and R3F's two-pixel click rule keeps a drag out; one `LotPickChip` for every lot pick, composed of the same `ControlsChip` and `ValueMenu` the home chips compose; the chip's text comes from the material or kind, never from its option list; New draws as Good; checks extend the four existing scripts; store writers live beside `commitLayout`; the bar is a Controls piece.
- Stress test 2026-11-06 folded in: Task 0 (sync and baseline); the retire steps in Tasks 2, 4, 5, 7, 9; the nullable accessors and lab-only children; Escape layers; the full rename list and the probe lib; `perimeterKindsFor` widened in place of `yardFenceKinds`; `GROUND_MATERIALS_BY_LAYER` in place of `drawOptions`; no `fenceMask` on the yard readers; the wear texture's `1 / 4` repeat and the weather tint; `undoLayout`; Task 9 before Task 7.
- Names used across tasks: `yardMap`, `presentYards`, `yardTileIndices`, `yardLotLineCells(lot, yards, yard)`, `GROUND_BASE`, `GROUND_WEAR_INDEX`, `GROUND_MATERIALS_BY_LAYER`, `applyStroke`, `lotRegions(lot, mask, yards)`, `setYardGround`, `setYardBase`, `setYardBuild`, `perimeterKindsFor(side, layer)`, `yardFence(layout, yards, yard, layer)`, `setYardFence`, `yardBuildChanges(layout, yards, yard)`, `removeRegion`, `removeFenceLine`, `useLayoutEditorStore`, `useResolvedLayoutOrNull`, `useLotIsData`, `LotPickChip`, `WearScale`, `SystemCardRow`, `LotAreasSection`, `startDrawing`, `endDrawing`, `undoLayout`, `DrawPick`, `DRAW_ERASE`, `LineLock`, `magnetVertex`, `vertexAlong`, `LotHit`, `lotTapTarget`, `useLotTapHandlers`.
