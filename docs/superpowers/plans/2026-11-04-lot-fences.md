# Lot fences as drawn lengths — implementation plan

> **Status**
> - Stage: built · looked at 2026-11-05, unmerged; corrections R233–R235 go to project 2 (R236)
> - Built on: `feat/scene-layout-lab` · Verified at: `feat/scene-layout-lab@26a0e7629` (2026-11-05) · page: https://claude.ai/artifact/YVeibi9ZBirurCNe6Hs9T9
> - Done: T1 · T2 · T3 · T4a (T5 folded in, F8) · T4b · T6 · T7; stress-tested 2026-11-04 (F1–F11)
> - Next: project 2 brainstorm, Property facts + Areas, with R233–R235 inside (R236) → T8 live runs once 3003 is up
> - Open: T8 parity re-shoot (12 pairs) · fence overlay never seen live · look list (23; the tapping items are superseded) · three older probes · sync 3 (foundation 8 ahead, 41 uncommitted there) · spec call 11, F7 and the §6 chip rows overturned by R233–R235 · ⚠️ stale ref: Task 8 expects `%22_v%22%3A2` in the link, the page writes `%22_v%22:2` · spec, plan, CONTEXT.md uncommitted (owner)
> - Blocked: T8 on the owner's dev server (3003)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fence or wall is a length on the lot's grid lines, on the Today and Build layers, traced with one finger in draw mode, in every kind the trade sells; the default lot draws as it does today.

**Architecture:** Fences live in two `Uint8Array` maps per layer (lines across the lot, lines along it), each a tile grid of its own (across: `cols` cells × `rows + 1` lines; along: `rows` cells × `cols + 1` lines, line-major), so they are painted, re-tiled, run-encoded and undone by the tile maps' own code. Resolve derives fence lines from the maps as regions are derived from tiles (stretches of equal `(existing, proposed)` pairs) and builds one set of merged boxes per layer, capping the front yard per cell; the lot mounts the shown layer's groups. The editor's brush gains a tool, the stroke a fence variant snapped to the grid, and the panel a fence card.

**Tech Stack:** Next.js 15, React 19, R3F 9.8 + three 0.180, zustand (`createSceneInputs`), zod wire schema, nuqs URL state (until project 4), `tsx` check scripts, Playwright probes against the owner's dev server.

**Spec:** `docs/superpowers/specs/2026-11-03-lot-fences-design.md` (parent: `docs/superpowers/specs/2026-11-02-scene-layout-design.md`). The spec's §10 calls 1–12 and §11 rulings F1–F11 stand; this plan adds its own calls, marked *(plan call)*.

**Branch / worktree:** `feat/scene-layout-lab` in `.worktrees/scene-layout-lab`, after the second foundation sync `a4f9dc8f4`. The owner's dev server runs this worktree on port 3003.

## Global constraints

- Never `pnpm build`. Never start or stop a dev server. Checks: `pnpm exec tsx scripts/<name>.ts`; type-check with `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock pnpm tsc`; lint with `env CI=1 pnpm eslint <files>`.
- Commit by explicit path: `git add <new paths>` then `git commit -F - -- <paths>`. Before every dispatch and every commit: `git diff --cached --name-status` must be empty or name only this task's files. Never `git add -A`, never bare `git stash`, never `git reset`, `git checkout` or `git restore` of any path, never `--amend`. Never stage `CONTEXT.md`, `docs/**` or `.superpowers/**` in a task commit (the owner commits those). Trailer on every commit: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. The pre-commit hook runs about 110 s: give `git commit` a 300 s timeout and batch a task's files into one commit.
- CRLF: the three seed files are CRLF (`materials.ts` 112 CRs, `x-scope-materials.ts` 110, `x-material-benefits.ts` 170). Edit them with the Edit tool or `sed -i`, never a Python rewrite with default newlines; after the edit, `git diff --shortstat` must show only the added lines and `grep -c $'\r' <file>` must equal the old count plus the lines added.
- No DB writes for testing: the seed files are edited as text; the owner runs `pnpm db:seed:dev`.
- Fence kinds: `woodFence | vinylFence | compositeFence | wroughtIron | chainLink | blockWall | lowWall | woodGate | vinylGate | compositeGate | ironGate`, 1-based in that order on the maps; `FENCE_NONE = 0` on `existing`, `PROPOSED_KEEP = 0` on `proposed`. On screen: Wood fence, Vinyl fence, Composite fence, Wrought iron, Chain link, Block wall, Low wall, Wood gate, Vinyl gate, Composite gate, Iron gate.
- Map indexing (F5): across map `line * cols + cell`, `rows + 1` lines, line 0 the front lot line; along map `line * rows + cell`, `cols + 1` lines, line 0 the left lot line. A cell is one tile-length of a grid line (F1).
- Heights: `LOT.wall.height` (1.83 m) off the front yard, `LOT.frontFence` (1.07 m) in it, applied per cell at build time (F4); a `blockWall` cell in the front yard builds as `lowWall`. `chainLink` sets `['existing']` only; every other kind `['existing', 'proposed']`.
- Catalog: every Build-row kind carries `catalog: { scopeAccessor: ScopeAccessor, materialAccessor: MaterialAccessor }` typed from `@/shared/db/types/{scopes,materials}` per the spec's §5 table, so `tsc` proves the accessors exist; the check proves the links through the seed arrays.
- Colours: scene materials only from `LOT_PALETTE` / `HOME_PALETTE` (each fence kind's `look.color` points at a palette key); the editor's own chrome colours (selected, outline, preview neutral) only from `LAYOUT_EDITOR_LOOK` (F10). Copy only from `LAYOUT_EDITOR_COPY`; kind labels from `FENCE_KINDS[id].label`, as ground labels come from `GROUND_MATERIALS`. One component per file; named exports; comments say why and never cite a plan, spec or task.
- The default lot's draw-call count is unchanged: a fence group mounts only when its list is non-empty.
- Wire `_v: 2` from Task 2; a `_v: 1` payload decodes to `null`. `LAYOUT_URL_MAX` stays 8000.
- Words: `LineRange` is `{ axis, line, from, to }` (never "span" or "run" in copy); `GridVertex` is a grid vertex `[col, row]` with `0..cols` / `0..rows` inclusive (never "tile"); avoid edge, segment, barrier, type, material (for a kind), style, opening, gap, door, boundary, property line. `gateRow` in the default layout and the checks becomes `sideYardRow` (the gate word now means the fence kind); `LOT.gateZ` keeps its name.
- The second foundation sync is done (`a4f9dc8f4`, F3). A third follows when `.worktrees/trade-scenes` commits TS3b.4b; foundation → lab, never rebase.

## Review focus

Inputs the spec implies but no §8 check names; each gets its test in the task that owns the code.

1. A press that snaps to a vertex on the lot line from just outside the lot (the sidewalk edge) still opens a fence stroke; a press more than half a tile outside opens nothing. → Task 6 (`vertexAt`).
2. A fence stroke whose every cell is unpaintable (traced through the house) paints nothing, pushes no undo step and writes no URL. → Task 6 (`applyFenceStroke` returns the same layout).
3. Undo after a fence stroke restores both fence maps, and a ground stroke after a fence stroke leaves the fence maps untouched. → Task 6.
4. A one-cell gate survives a re-tile to the finer 1 ft grid as two cells and back to one, and no line doubles. → Task 2 (re-tile check).
5. A proposed fence drawn where nothing stands today shows in the Build view only; the Today view's boxes are unchanged, and a selected line's card shows both kinds whichever view is on. → Task 4b (boxes) and Task 7 (card).
6. A fence line crossing the front face row builds its front-yard cells at 42 in and the rest at 6 ft; a low wall builds as one span. → Task 4a.
7. Today's None erases an existing fence from the tool, the card and the perimeter selects. → Task 6, Task 7, Task 4a.

## File structure

| File | Responsibility |
|---|---|
| `src/features/trade-scenes/constants/fence-kinds.ts` (new) | `FENCE_KIND_IDS`, `FENCE_KINDS` (label, sets, family, gate, look, catalog), `FENCE_KIND_INDEX`, `FENCE_NONE` |
| `src/features/trade-scenes/constants/home-lot.ts` | `LOT_PALETTE` gains the new kinds' colours |
| `src/features/trade-scenes/constants/layout-editor-look.ts` (new) | `LAYOUT_EDITOR_LOOK`: the selected, outline and preview-neutral colours and the band widths |
| `src/features/trade-scenes/constants/layout-grid.ts` | `LINE_TAP_SHARE` (¼ tile: a ground tap picks a fence line) and `FENCE_MESH_TAP_SHARE` (½ tile: a tap on a fence mesh finds its cell) |
| `src/features/trade-scenes/constants/layout-editor-copy.ts` | `tool` and `fenceLine` sections; `fences` loses its kind lines |
| `src/features/trade-scenes/types.ts` | `FenceKindId`, `FenceAxis`, `FenceMap`, `FenceLayers`, `LineRange`, `GridVertex`, `FenceLine`, `FenceBoxes`; `LotLayout.fence`; `ResolvedLayout.fenceMask`, `.fences`, `.fenceBoxes`; `LotEdge`/`LotGate`/`LotEdgeKind` deleted (Task 4a) |
| `src/features/trade-scenes/lib/fence-kind-at.ts` (new) | map value → kind id, as `ground-material-at.ts` |
| `src/features/trade-scenes/lib/fence-cells.ts` (new) | map sizes and indices, empty maps, the cell mask, front-yard and perimeter tests |
| `src/features/trade-scenes/lib/paint-tiles.ts` | exports `paintList` (moved out of `create-layout-editor.ts`) |
| `src/features/trade-scenes/lib/paint-fence.ts` (new) | `paintFenceCells`, `paintFenceList`, each one call into `paint-tiles.ts` on the map's own grid |
| `src/features/trade-scenes/lib/lot-fences.ts` (new) | fence lines from the maps, `fenceLineAt`, `fenceLineCells`, `fenceLengthM`, `perimeterSideOf` |
| `src/features/trade-scenes/lib/perimeter-kinds.ts` (new) | `perimeterKindsFor(side)`: the kinds a per-side select offers |
| `src/features/trade-scenes/lib/tile-at.ts` | gains `vertexAt` beside `tileAt` |
| `src/features/trade-scenes/lib/fence-stroke.ts` (new) | `lineRangeBetween`, `fenceCellNear` |
| `src/features/trade-scenes/lib/lot-box-parts.ts` | gains `lifted`, `alongZ`, `rails`, `graded` and the wall constants moved from `layout-lot-boxes.ts` |
| `src/features/trade-scenes/lib/layout-fence-boxes.ts` (new) | one `FenceBoxes` per layer from the fence lines |
| `src/features/trade-scenes/lib/layout-lot-boxes.ts` | keeps only the street, aprons and stoop |
| `src/features/trade-scenes/lib/default-layout.ts` | today's fences on the maps |
| `src/features/trade-scenes/lib/retile-property-layout.ts` | scatters the fence maps' lines, samples their cells |
| `src/features/trade-scenes/lib/resolve-property-layout.ts` | adds `fenceMask`, `fences` and `fenceBoxes` |
| `src/features/trade-scenes/lib/layout-codec.ts`, `schemas/property-layout.ts` | wire v2 (Task 2), spans dropped (Task 4a) |
| `src/features/trade-scenes/lib/create-layout-editor.ts` | tool, fence brush, stroke and selection variants, `applyFenceStroke` |
| `src/features/trade-scenes/hooks/use-lot-draw-handlers.ts` | the fence tool's press/drag/lift and taps |
| `src/features/trade-scenes/hooks/use-fence-tap-handlers.ts` (new) | taps on the fence meshes in draw mode |
| `src/features/trade-scenes/ui/lib/region-strip-geometry.ts` | exports its quad pusher |
| `src/features/trade-scenes/ui/lib/fence-band-geometry.ts` (new) | a thin band on a grid line that follows the grade |
| `src/features/trade-scenes/ui/components/layout-kit/lot-draw-preview.tsx` | the fence stroke's preview band |
| `src/features/trade-scenes/ui/components/layout-kit/layout-fence-highlight.tsx` (new) | the selected fence line's band |
| `src/features/trade-scenes/ui/components/layout-kit/layout-region-outlines.tsx` | reads the selection shape and `LAYOUT_EDITOR_LOOK` |
| `src/features/trade-scenes/ui/components/layout-kit/layout-lot.tsx` | mounts the shown layer's fence groups, the highlight and the tap handlers |
| `src/features/trade-scenes/ui/components/layout-editor/brush-picker.tsx` | the tool toggle; renders one of the two row components |
| `.../layout-editor/brush-rows.tsx` (new) | the presentational two-row segmented picker both tools render |
| `.../layout-editor/ground-brush-rows.tsx` (new) | binds the ground brush to `BrushRows` |
| `.../layout-editor/fence-brush-rows.tsx` (new) | binds the fence brush to `BrushRows` |
| `.../layout-editor/fence-card.tsx` (new) | the selected fence line |
| `.../layout-editor/region-card.tsx` | reads the new selection shape |
| `.../layout-editor/lot-perimeter-fields.tsx` (renamed from `lot-edges-fields.tsx`) | per-side selects writing a whole lot line on the existing map |
| `.../layout-editor/layout-editor-panel.tsx` | mounts the fence card and the renamed fields |
| `src/shared/db/seeds/data/{materials,x-scope-materials,x-material-benefits}.ts` | five material rows, five links, five benefit lists |
| `scripts/verify-property-layout.ts`, `scripts/verify-layout-kit.ts` | the checks |
| `.superpowers/sdd/2026-11-02-scene-layout-l1-l2-lot-as-data/shots/fence/trace.mjs` (new), `shots/task-8/draw.mjs`, `shots/drift/probe.mjs`, `shots/task-9/panel.mjs`, `parity/` | live probe, the older probes on the new store shape, parity re-run |
| `CONTEXT.md` | done in the stress test (F2): the layout block and the fence words, unstaged; Task 1 only verifies it is still there |

---

### Task 1: Kinds, palette, seeds and the catalog check

**Files:**
- Create: `src/features/trade-scenes/constants/fence-kinds.ts`, `src/features/trade-scenes/lib/fence-kind-at.ts`
- Modify: `src/features/trade-scenes/constants/home-lot.ts` (`LOT_PALETTE`), `src/features/trade-scenes/types.ts` (`FenceKindId`), `src/shared/db/seeds/data/materials.ts`, `src/shared/db/seeds/data/x-scope-materials.ts`, `src/shared/db/seeds/data/x-material-benefits.ts`
- Test: `scripts/verify-property-layout.ts` (after the ground-material loop, line 60)

**Interfaces:**
- Produces: `FENCE_KIND_IDS` (the eleven ids in order), `FENCE_NONE = 0`, `FENCE_KINDS: Record<FenceKindId, FenceKind>` with
  ```ts
  interface FenceKind {
    label: string
    sets: readonly GroundLayer[]
    family: 'wood' | 'vinyl' | 'composite' | 'iron' | 'chain' | 'block'
    gate: boolean
    look: { color: string }                                              // a LOT_PALETTE / HOME_PALETTE value: the preview band's tint
    catalog?: { scopeAccessor: ScopeAccessor, materialAccessor: MaterialAccessor }
  }
  ```
  `FENCE_KIND_INDEX: Record<FenceKindId, number>` (1-based), `fenceKindAt(value: number): FenceKindId | null`, `LOT_PALETTE.{vinyl, compositeBoard, compositePost, iron, galvanised, chainMesh}`.

- [ ] **Step 1: Confirm the words are recorded.** `grep -n "^- \*\*Cell\*\*\|^- \*\*Fence line\*\*" CONTEXT.md` prints both lines (the stress test wrote them). If either is missing, stop and tell the owner; never stage `CONTEXT.md`.

- [ ] **Step 2: Write the failing check** in `scripts/verify-property-layout.ts` after `assert.equal(GROUND_MATERIAL_INDEX.sod, 1, …)`:

```ts
assert.equal(FENCE_KIND_IDS.length, 11, 'eleven fence kinds')
assert.equal(FENCE_NONE, 0, 'no fence is the map\'s zero')
const paletteColours: readonly string[] = [...Object.values(LOT_PALETTE), ...Object.values(HOME_PALETTE)]
let kindsChecked = 0
for (const id of FENCE_KIND_IDS) {
  const kind = FENCE_KINDS[id]
  kindsChecked++
  assert.equal(fenceKindAt(FENCE_KIND_INDEX[id]), id, `${id}: its map value maps back to it`)
  assert.ok(kind.label.length > 0 && kind.sets.length > 0, `${id} has a label and a layer`)
  assert.equal(id.endsWith('Gate'), kind.gate, `${id}: a gate is a gate`)
  assert.ok(paletteColours.includes(kind.look.color), `${id}: its preview colour is a palette colour`)
  if (kind.sets.includes('proposed')) {
    assert.ok(kind.catalog, `${id} is on the Build row, so it links to the catalog`)
  }
  if (kind.catalog) {
    const { scopeAccessor, materialAccessor } = kind.catalog
    assert.ok(xScopeMaterialsData.some(link => link.scopeAccessor === scopeAccessor && link.materialAccessor === materialAccessor), `${id}: ${materialAccessor} is linked to ${scopeAccessor}`)
    assert.ok((materialBenefitsData[materialAccessor]?.length ?? 0) > 0, `${id}: ${materialAccessor} lists benefits`)
  }
}
assert.equal(kindsChecked, 11, 'the kind loop covers all eleven')
assert.equal(fenceKindAt(FENCE_NONE), null, 'zero is no kind')
assert.deepEqual(FENCE_KINDS.chainLink.sets, ['existing'], 'chain link is today-only')
assert.equal(FENCE_KIND_INDEX.woodFence, 1, 'wood fence is the first kind')
assert.equal(FENCE_KINDS.vinylFence.catalog?.materialAccessor, 'vinylFencing')
assert.equal(FENCE_KINDS.lowWall.catalog?.scopeAccessor, 'installBlockWall')
assert.ok(xScopeMaterialsData.some(link => link.materialAccessor === 'vinylFencing' && link.isMostPopular), 'vinyl is the most popular fencing')
```

Import `FENCE_KIND_IDS`, `FENCE_KIND_INDEX`, `FENCE_KINDS`, `FENCE_NONE` from the new constants file, `fenceKindAt` from `lib/fence-kind-at`, `HOME_PALETTE` from `constants/home-palette`, `xScopeMaterialsData` from `@/shared/db/seeds/data/x-scope-materials` and `materialBenefitsData` from `@/shared/db/seeds/data/x-material-benefits` (both files import types only, so the check stays DB-free). The existing `scopesSeed` / `materialsSeed` text reads stay for the ground materials; `tsc` proves the fence accessors through the typed `catalog`.

- [ ] **Step 3: Run it to see it fail.** `pnpm exec tsx scripts/verify-property-layout.ts` → fails at the import (module not found).

- [ ] **Step 4: Write `fence-kinds.ts`** with the eleven entries per the spec's §5 tables (catalog: wood/woodGate → `installFencingGates`/`woodFencing`; vinyl pair → `vinylFencing`; composite pair → `compositeFencing`; wroughtIron/ironGate → `wroughtIronFencing`; blockWall/lowWall → `installBlockWall`/`cmuBlock`; chainLink none), `look.color` per family (wood → `LOT_PALETTE.fenceBoard`, vinyl → `.vinyl`, composite → `.compositeBoard`, iron → `.iron`, chain → `.chainMesh`, block → `HOME_PALETTE.blockWall`), `FENCE_KIND_INDEX` built as `GROUND_MATERIAL_INDEX` is, `export type FenceKindId = typeof FENCE_KIND_IDS[number]` in `types.ts`, and `fenceKindAt` mirroring `groundMaterialAt`. The `catalog` accessor types come from `@/shared/db/types/scopes` and `@/shared/db/types/materials` (type imports), so the seed rows of Step 5 must exist for `tsc` to pass.

- [ ] **Step 5: Add the five seed rows** by explicit edit, nothing else touched, CRLF kept (see Global constraints): `materials.ts` rows `woodFencing` (Wood Fencing), `vinylFencing` (Vinyl Fencing), `compositeFencing` (Composite Fencing), `wroughtIronFencing` (Wrought Iron Fencing), `cmuBlock` (CMU Block), each with a one-line description and an image URL (a Cloudinary or manufacturer URL the owner may swap); `x-scope-materials.ts` five links (vinyl `isMostPopular: true`); `x-material-benefits.ts` five lists drawn only from existing benefit accessors (`homeSecurity`, `homeAppeal`, `increasePropertyValue`, `reduceMaintenance`, `noiseReduction`, `functionality`, `financing`; block adds `fireResistance`). Then `git diff --shortstat` and the CR counts.

- [ ] **Step 6: Add the palette colours** to `LOT_PALETTE`: `vinyl: '#f2f1ec'`, `compositeBoard: '#6e6257'`, `compositePost: '#2f2b28'`, `iron: '#2a2a2c'`, `galvanised: '#9ea3a6'`, `chainMesh: '#b7bcbf'` (working numbers, tuned by eye in Task 4b).

- [ ] **Step 7: Run the check, tsc and eslint.** `pnpm exec tsx scripts/verify-property-layout.ts` → `verify-property-layout: ok`; tsc 0; eslint on the new and edited `src/` files 0.

- [ ] **Step 8: Commit** the constants, the kind helper, `types.ts`, `home-lot.ts`, the three seed files and the check script: `feat(trade-scenes): the eleven fence kinds, linked to the catalog with five fencing material seeds`.

---

### Task 2: Fence maps in the model, the default lot's fences on them, re-tile, wire v2

**Files:**
- Create: `src/features/trade-scenes/lib/fence-cells.ts`, `src/features/trade-scenes/lib/paint-fence.ts`
- Modify: `src/features/trade-scenes/types.ts` (`FenceAxis`, `FenceMap`, `FenceLayers`, `LineRange`, `LotLayout.fence`), `src/features/trade-scenes/lib/paint-tiles.ts` (`paintList` moves in), `src/features/trade-scenes/lib/create-layout-editor.ts` (imports `paintList`), `src/features/trade-scenes/lib/default-layout.ts`, `src/features/trade-scenes/lib/retile-property-layout.ts`, `src/features/trade-scenes/lib/layout-codec.ts`, `src/features/trade-scenes/schemas/property-layout.ts`, `scripts/verify-layout-kit.ts` (`lotOf` gains `fence`)
- Test: `scripts/verify-property-layout.ts`

`lot.edges` and `lot.gates` stay in the model and on the wire until Task 4a, when the boxes stop reading them and they are deleted everywhere in one change. The wire moves to v2 here because `LotLayout.fence` is required and the decoder builds every URL-loaded lot (F8).

**Interfaces:**
- Consumes: `FENCE_KIND_INDEX`, `FENCE_NONE` (Task 1).
- Produces, in `types.ts`:
  ```ts
  export type FenceAxis = 'across' | 'along'
  // Each map is a tile grid of its own: across has rows + 1 lines of cols cells (line 0 the front lot line), along has
  // cols + 1 lines of rows cells (line 0 the left lot line); a cell's index is line * cellsPerLine + cell on both.
  export interface FenceMap { across: Uint8Array, along: Uint8Array }
  export interface FenceLayers { existing: FenceMap, proposed: FenceMap }
  export interface LineRange { axis: FenceAxis, line: number, from: number, to: number }   // cells along the line, `to` exclusive
  export interface LotLayout { cols, rows, existing, proposed, edges, gates, fence: FenceLayers, grade }
  ```
- Produces, in `paint-tiles.ts`: `export function paintList(map: Uint8Array, indices: readonly number[], value: number, mask?: Uint8Array): Uint8Array` (the body of `create-layout-editor.ts`'s private `paintList`, which now imports it).
- Produces, in `fence-cells.ts`:
  ```ts
  type Grid = Pick<LotLayout, 'cols' | 'rows'>
  export function fenceMapSizes(lot: Grid): { across: number, along: number }                     // (rows + 1) * cols, (cols + 1) * rows
  export function fenceGridOf(lot: Grid, axis: FenceAxis): { cells: number, lines: number }         // across: cols × rows + 1; along: rows × cols + 1
  export function emptyFenceMap(lot: Grid): FenceMap
  export function fenceCellIndex(lot: Grid, axis: FenceAxis, line: number, cell: number): number   // line * cells + cell
  // The two tiles either side of a cell, as tile indices, -1 off the lot: across (line, cell) → tiles (cell, line - 1), (cell, line); along (line, cell) → tiles (line - 1, cell), (line, cell).
  export function fenceCellTiles(lot: Grid, axis: FenceAxis, line: number, cell: number): readonly [number, number]
  // 1 where both neighbouring tiles lie in a mass: the house's interior, never paintable. `mask` is the tile mask (massMask).
  export function fenceCellMask(lot: Grid, mask: Uint8Array): FenceMap
  export function isPerimeterLine(lot: Grid, axis: FenceAxis, line: number): boolean
  // In front of the main mass's front face: an across cell on a line ≤ main.r0, an along cell on a row < main.r0 (plan call).
  export function isFrontYardCell(main: Mass, axis: FenceAxis, line: number, cell: number): boolean
  ```
- Produces, in `paint-fence.ts`:
  ```ts
  // Each map is a tile grid of its own, so a range is a one-line rectangle for paintTiles and a list is paintList: same instance back when nothing changes.
  export function paintFenceCells(map: FenceMap, lot: Grid, range: LineRange, value: number, mask?: FenceMap): FenceMap
  export function paintFenceList(map: FenceMap, axis: FenceAxis, indices: readonly number[], value: number, mask?: FenceMap): FenceMap
  ```
  Both return `map` itself when the painted axis map comes back unchanged, else `{ ...map, [axis]: next }`.
- Wire: `propertyLayoutWireSchema` gains `_v: z.literal(2)` and `lot.fence: { existing: { across: string, along: string }, proposed: { across: string, along: string } }` (run strings as the tile maps; `edges` and `gates` stay until Task 4a). `decodePropertyLayout` decodes each map with `decodeRuns` against `fenceMapSizes` and rejects a value `≥ FENCE_KIND_IDS.length + 1`; `encodePropertyLayout` writes the four run strings with `encodeRuns`.

- [ ] **Step 1: Write the failing checks** in `scripts/verify-property-layout.ts`, after the `lot.gates.length` assertion (line 146):

```ts
const sideYardRow = lot.gates[0].row
const sizes = fenceMapSizes(lot)
assert.equal(lot.fence.existing.across.length, sizes.across, 'one across cell per column on every line')
assert.equal(lot.fence.existing.along.length, sizes.along, 'one along cell per row on every line')
assert.ok(lot.fence.proposed.across.every(v => v === 0) && lot.fence.proposed.along.every(v => v === 0), 'the default proposes no fence')
const K = FENCE_KIND_INDEX
const across = (line: number, cell: number) => lot.fence.existing.across[fenceCellIndex(lot, 'across', line, cell)]
const along = (line: number, cell: number) => lot.fence.existing.along[fenceCellIndex(lot, 'along', line, cell)]
assert.equal(fenceCellIndex(lot, 'along', 1, 0), lot.rows, 'the along map is line-major: line 1 starts after one line of rows cells')
for (let c = 0; c < lot.cols; c++) {
  assert.equal(across(lot.rows, c), K.blockWall, `the back line is block wall at ${c}`)
  assert.equal(across(0, c), 0, `the front line is open at ${c}`)
}
for (let r = 0; r < lot.rows; r++) {
  assert.equal(along(0, r), r < sideYardRow ? K.lowWall : K.blockWall, `the left line at row ${r}`)
  assert.equal(along(lot.cols, r), r < sideYardRow ? 0 : K.blockWall, `the right line at row ${r}`)
}
const sideYardCells = Array.from({ length: lot.cols }, (_, c) => across(sideYardRow, c))
assert.ok(sideYardCells.slice(0, main.c0).every(v => v === K.woodFence), 'the left side yard is fenced at the side-yard row')
assert.ok(sideYardCells.slice(garage.c0 + garage.cols).every(v => v === K.woodFence), 'the right side yard is fenced at the side-yard row')
assert.ok(sideYardCells.slice(main.c0, garage.c0 + garage.cols).every(v => v === 0), 'nothing is drawn under the house')
const cellMask = fenceCellMask(lot, mask)
assert.equal(cellMask.across[fenceCellIndex(lot, 'across', main.r0 + 1, main.c0 + 1)], 1, 'a line through the house is unpaintable')
assert.equal(cellMask.across[fenceCellIndex(lot, 'across', main.r0, main.c0 + 1)], 0, 'the house\'s front face is paintable')
assert.equal(cellMask.along[fenceCellIndex(lot, 'along', main.c0, main.r0 + 1)], 0, 'the house\'s left face is paintable')
assert.equal(cellMask.along[fenceCellIndex(lot, 'along', main.c0 + 1, main.r0 + 1)], 1, 'a line one tile inside the house is not')
assert.ok(isPerimeterLine(lot, 'across', 0) && isPerimeterLine(lot, 'along', lot.cols) && !isPerimeterLine(lot, 'across', sideYardRow), 'the lot lines are the perimeter')
assert.ok(isFrontYardCell(main, 'across', 0, 3) && isFrontYardCell(main, 'along', 0, 0) && isFrontYardCell(main, 'across', main.r0, 0), 'the front lot line, the first row and the face line are in the front yard')
assert.ok(!isFrontYardCell(main, 'across', sideYardRow, 0) && !isFrontYardCell(main, 'along', 0, main.r0) && !isFrontYardCell(main, 'along', 0, lot.rows - 1), 'the side-yard row, the face row\'s along cell and the back are not')
const painted = paintFenceCells(lot.fence.proposed, lot, { axis: 'across', line: lot.rows - 2, from: 2, to: 6 }, K.vinylFence, cellMask)
assert.notEqual(painted, lot.fence.proposed, 'a paint that changes a cell returns a new map')
assert.equal(painted.across[fenceCellIndex(lot, 'across', lot.rows - 2, 4)], K.vinylFence)
assert.equal(painted.across[fenceCellIndex(lot, 'across', lot.rows - 2, 6)], 0, 'the cell past `to` is untouched')
assert.equal(painted.along, lot.fence.proposed.along, 'the other axis is shared, untouched')
assert.equal(paintFenceCells(painted, lot, { axis: 'across', line: lot.rows - 2, from: 2, to: 6 }, K.vinylFence, cellMask), painted, 'a no-op paint returns the same map')
assert.equal(paintFenceCells(lot.fence.proposed, lot, { axis: 'across', line: main.r0 + 1, from: main.c0, to: main.c0 + main.cols }, K.vinylFence, cellMask), lot.fence.proposed, 'a paint through the house changes nothing')
assert.equal(paintFenceCells(lot.fence.proposed, lot, { axis: 'along', line: 3, from: lot.rows - 2, to: lot.rows + 5 }, K.vinylFence, cellMask).along.filter(v => v === K.vinylFence).length, 2, 'cells past the line\'s end are skipped')
const listed = paintFenceList(lot.fence.proposed, 'along', [fenceCellIndex(lot, 'along', 3, 3), -1, 10 ** 6], K.ironGate, cellMask)
assert.equal(listed.along[fenceCellIndex(lot, 'along', 3, 3)], K.ironGate, 'a list paints its cells and skips indices off the map')
```

and, beside the existing re-tile checks, the one-cell gate round trip and the no-doubling rule:

```ts
{
  const gated = { ...layout, lot: { ...lot, fence: { ...lot.fence, existing: paintFenceCells(lot.fence.existing, lot, { axis: 'across', line: lot.rows, from: 5, to: 6 }, K.woodGate, cellMask) } } }
  const fine = retilePropertyLayout(gated, LAYOUT_TILE / 2)
  const fineAcross = (line: number) => Array.from({ length: fine.lot.cols }, (_, c) => fine.lot.fence.existing.across[fenceCellIndex(fine.lot, 'across', line, c)])
  const fineAlong = (line: number) => Array.from({ length: fine.lot.rows }, (_, r) => fine.lot.fence.existing.along[fenceCellIndex(fine.lot, 'along', line, r)])
  assert.equal(fineAcross(fine.lot.rows).filter(v => v === K.woodGate).length, 2, 'a one-cell gate is two cells at 1 ft')
  assert.ok(fineAcross(fine.lot.rows - 1).every(v => v === 0) && fineAcross(2 * sideYardRow - 1).every(v => v === 0), 'no across line doubles at 1 ft')
  assert.ok(fineAlong(1).every(v => v === 0) && fineAlong(fine.lot.cols - 1).every(v => v === 0), 'no along line doubles at 1 ft')
  const acrossLinesUsed = Array.from({ length: fine.lot.rows + 1 }, (_, l) => l).filter(l => fineAcross(l).some(v => v !== 0))
  assert.deepEqual(acrossLinesUsed, [2 * sideYardRow, fine.lot.rows], 'the side-yard row and the back line are the only across lines at 1 ft')
  for (let r = 0; r < fine.lot.rows; r++) {
    assert.equal(fineAlong(fine.lot.cols)[r], r < sideYardRow * 2 ? 0 : K.blockWall, `the right lot line keeps its wall at 1 ft, row ${r}`)
  }
  const back = retilePropertyLayout(fine, LAYOUT_TILE)
  assert.deepEqual(Array.from(back.lot.fence.existing.across), Array.from(gated.lot.fence.existing.across), 'and one cell again at 2 ft')
  assert.deepEqual(Array.from(back.lot.fence.existing.along), Array.from(gated.lot.fence.existing.along), 'the along map survives the round trip')
}
```

Wire checks: replace `reject('a wrong version is rejected', …_v = 2)` (line 298) and add after the existing `reject` cases:

```ts
reject('a wire version 1 is rejected', (w) => { w._v = 1 })
reject('a fence map one cell short is rejected', (w) => { w.lot.fence.existing.across = w.lot.fence.existing.across.replace(/\*(\d+)$/, (_m: string, n: string) => `*${Number(n) - 1}`) })
reject('a fence kind of 12 is rejected', (w) => { w.lot.fence.proposed.along = `12*${fenceMapSizes({ cols: wire.lot.c, rows: wire.lot.r }).along}` })
reject('a payload without fences is rejected', (w) => { delete w.lot.fence })
assert.equal(wire._v, 2, 'the wire is version 2')
console.log(`  default layout URL length: ${encoded.length} of ${LAYOUT_URL_MAX}`)
assert.ok(encoded.length < 2000, 'the default lot\'s link stays short (1,292 before fences; the along map is line-major so a lot line is one run)')
```

Change the round-trip `deepEqual` so the fence maps are compared as arrays (as `existing`/`proposed` are).

- [ ] **Step 2: Run it to see it fail.** `pnpm exec tsx scripts/verify-property-layout.ts` → fails on the missing imports.

- [ ] **Step 3: Add the types**, move `paintList` into `paint-tiles.ts` (exported, mask optional) and import it in `create-layout-editor.ts`, write `fence-cells.ts` and `paint-fence.ts` to the signatures above: `paintFenceCells` is `paintTiles(map[axis], cells, lines, { c0: from, r0: line, cols: to - from, rows: 1 }, value, mask?.[axis])` on the axis's own grid (`fenceGridOf`), `paintFenceList` is `paintList(map[axis], indices, value, mask?.[axis])`.

- [ ] **Step 4: Fill the default lot's maps** in `defaultLayout`: rename `gateRow` to `sideYardRow`; block wall on the back line and on the left and right lines from `sideYardRow` to `rows`; low wall on the left line from 0 to `sideYardRow`; `woodFence` on across line `sideYardRow` for cells `0..main.c0` and `garage.c0 + garage.cols..cols`. Use `paintFenceCells` with `fenceCellMask(lot, massMask-of-the-masses)` (build the tile mask from `[main, garage]` with `paintTiles` as `massMask` does, since no `PropertyLayout` exists yet). `proposed` = `emptyFenceMap`. Keep `edges` and `gates` as they are.

- [ ] **Step 5: Re-tile the maps.** In `retilePropertyLayout`, per axis: start from an empty map at the new size; for each source line `ℓ`, write its cells to target line `scaled(ℓ, lines − 1)` where `lines` is the new line count, sampling target cell `k` from source cell `min(sourceCells − 1, floor((k + 0.5) / scale))` (`resample`'s rule); when two source lines land on one target line (a coarser re-tile), a non-zero value wins over 0 and the later line over the earlier. *(plan call, F6: lines scatter forward as a rectangle's boundaries do; sampling lines backwards put each on two fine lines.)*

- [ ] **Step 6: Move the wire to v2**: the schema and codec per the interface above (edges and gates still carried). Give the kit check's `lotOf` a `fence: { existing: emptyFenceMap({ cols: COLS, rows: ROWS }), proposed: emptyFenceMap({ cols: COLS, rows: ROWS }) }`.

- [ ] **Step 7: Run both checks, tsc, eslint** → ok / 0 / 0. `verify-trade-scene-lot.ts` and `verify-trade-scene-layout.ts` still ok.

- [ ] **Step 8: Commit** `types.ts`, `paint-tiles.ts`, `create-layout-editor.ts`, the two new libs, `default-layout.ts`, `retile-property-layout.ts`, `layout-codec.ts`, `schemas/property-layout.ts`, both check scripts: `feat(trade-scenes): fences live on the lot's grid lines as two maps per layer; the default lot draws its walls and side fences on them; the layout wire is version 2`.

---

### Task 3: Fence lines

**Files:**
- Create: `src/features/trade-scenes/lib/lot-fences.ts`
- Modify: `src/features/trade-scenes/types.ts` (`FenceLine`, `ResolvedLayout.fenceMask`, `.fences`), `src/features/trade-scenes/lib/resolve-property-layout.ts`
- Test: `scripts/verify-property-layout.ts`

**Interfaces:**
- Consumes: Task 2's maps, mask, perimeter and front-yard tests; `fenceKindAt` (Task 1).
- Produces:
  ```ts
  // types.ts — a stretch of cells on one grid line whose (existing, proposed) pair is equal, the regions' rule on cells.
  export interface FenceLine extends LineRange { id: string /* `${axis}-${line}-${from}` */, existing: FenceKindId | null, proposed: FenceKindId | null, perimeter: boolean, frontYard: boolean }
  // ResolvedLayout gains: fenceMask: FenceMap, fences: readonly FenceLine[]
  // lot-fences.ts
  export function lotFenceLines(layout: PropertyLayout, fenceMask: FenceMap): readonly FenceLine[]   // sorted by axis (across first), line, from
  export function fenceLineAt(lines: readonly FenceLine[], axis: FenceAxis, line: number, cell: number): FenceLine | null
  export function fenceLineCells(range: LineRange, lot: Pick<LotLayout, 'cols' | 'rows'>): readonly number[]   // map indices of its cells
  export function fenceLengthM(range: LineRange, tile: number): number
  export function perimeterSideOf(lot: Pick<LotLayout, 'cols' | 'rows'>, range: LineRange): LotSide | null   // across 0 → 'front', across rows → 'back', along 0 → 'left', along cols → 'right'
  ```
  A cell is in a line when it is unmasked and `existing || proposed` is non-zero. `frontYard` is true when every cell of the line is a front-yard cell (descriptive only; the height is capped per cell in Task 4a, F4); `perimeter` when its grid line is a lot line. `isPerimeterLine` is `perimeterSideOf(...) !== null` and is kept only as the readable name.

- [ ] **Step 1: Write the failing checks** after `const resolved = resolvePropertyLayout(layout)` and its destructuring (line 356 onward), since they read `resolved`:

```ts
const fences = resolved.fences
assert.deepEqual(Array.from(resolved.fenceMask.across), Array.from(cellMask.across), 'the resolved fence mask is the cell mask')
assert.equal(fences.length, 6, 'the default lot has six fence lines: back wall, left low wall, left wall, right wall, two side-yard fences')
const backWall = fenceLineAt(fences, 'across', lot.rows, 3)
assert.ok(backWall && backWall.from === 0 && backWall.to === lot.cols && backWall.existing === 'blockWall' && backWall.proposed === null && backWall.perimeter && !backWall.frontYard, 'the back wall is one perimeter line')
assert.equal(backWall.id, `across-${lot.rows}-0`)
assert.equal(perimeterSideOf(lot, backWall), 'back')
const leftLow = fenceLineAt(fences, 'along', 0, 0)
assert.ok(leftLow && leftLow.existing === 'lowWall' && leftLow.to === sideYardRow && !leftLow.frontYard, 'the left low wall runs to the side-yard row, one row past the face, so it is not wholly in the front yard')
assert.equal(fenceLineAt(fences, 'along', 0, sideYardRow)?.existing, 'blockWall', 'the left wall starts at the side-yard row')
assert.equal(fenceLineAt(fences, 'along', lot.cols, 0), null, 'the right front stretch carries nothing')
const leftSideYard = fenceLineAt(fences, 'across', sideYardRow, 0)
assert.ok(leftSideYard && leftSideYard.to === main.c0 && leftSideYard.existing === 'woodFence' && !leftSideYard.perimeter, 'the left side-yard fence ends at the house')
near(fenceLengthM(leftSideYard, tile), -HOUSE.halfLength - LOT.left, LAYOUT_TILE, 'its length is the side yard\'s width')
assert.deepEqual(fenceLineCells(leftSideYard, lot), Array.from({ length: main.c0 }, (_, c) => fenceCellIndex(lot, 'across', sideYardRow, c)))
{
  const withGate = { ...layout, lot: { ...lot, fence: { ...lot.fence, proposed: paintFenceCells(lot.fence.proposed, lot, { axis: 'across', line: lot.rows, from: 4, to: 6 }, K.ironGate, cellMask) } } }
  const split = resolvePropertyLayout(withGate).fences.filter(f => f.axis === 'across' && f.line === lot.rows)
  assert.deepEqual(split.map(f => [f.from, f.to, f.existing, f.proposed]), [[0, 4, 'blockWall', null], [4, 6, 'blockWall', 'ironGate'], [6, lot.cols, 'blockWall', null]], 'a gate painted mid-wall splits it into three lines')
  const newFence = resolvePropertyLayout({ ...layout, lot: { ...lot, fence: { ...lot.fence, proposed: paintFenceCells(lot.fence.proposed, lot, { axis: 'along', line: 10, from: main.r0 + main.rows + 2, to: lot.rows }, K.vinylFence, cellMask) } } }).fences.find(f => f.axis === 'along' && f.line === 10)
  assert.ok(newFence && newFence.existing === null && newFence.proposed === 'vinylFence' && !newFence.perimeter && !newFence.frontYard, 'a proposed fence where nothing stands is a line of its own')
  const frontOnly = resolvePropertyLayout({ ...layout, lot: { ...lot, fence: { ...lot.fence, existing: paintFenceCells(lot.fence.existing, lot, { axis: 'along', line: lot.cols, from: 0, to: main.r0 }, K.woodFence, cellMask) } } }).fences.find(f => f.axis === 'along' && f.line === lot.cols && f.from === 0)
  assert.ok(frontOnly?.frontYard, 'a line that stops at the face row is wholly in the front yard')
}
```

- [ ] **Step 2: Run to see it fail.** → `resolved.fences` undefined / import missing.

- [ ] **Step 3: Write `lot-fences.ts`** and wire `fenceMask: fenceCellMask(layout.lot, mask)` and `fences: lotFenceLines(layout, fenceMask)` into `resolvePropertyLayout`. *(plan call: the fence mask is computed once in resolve beside `mask` and read by the boxes, the card, the tap hook and the stroke.)*

- [ ] **Step 4: Run the check, tsc, eslint** → ok / 0 / 0.

- [ ] **Step 5: Commit** `lot-fences.ts`, `types.ts`, `resolve-property-layout.ts`, the check: `feat(trade-scenes): fence lines are stretches of equal today-and-build pairs on a grid line, derived at resolve`.

---

### Task 4a: Today's three kinds built from fence lines, per layer, at parity; the old spans gone; the perimeter selects on the maps

**Files:**
- Create: `src/features/trade-scenes/lib/layout-fence-boxes.ts`, `src/features/trade-scenes/lib/perimeter-kinds.ts`
- Modify: `src/features/trade-scenes/types.ts` (`FenceBoxes`, `LayoutLotBoxes = Pick<LotBoxes, 'concrete' | 'asphalt'>`, `ResolvedLayout.fenceBoxes`; delete `LotEdge`, `LotGate`, `LotEdgeKind`, `LotLayout.edges`, `LotLayout.gates`; keep `LotSide`), `src/features/trade-scenes/lib/lot-box-parts.ts` (gains `lifted`, `alongZ`, `rails`, `graded`, `WALL_H`, `WALL_T`, `WALL_CAP`, `LOW_WALL_BODY` from `layout-lot-boxes.ts`), `src/features/trade-scenes/lib/layout-lot-boxes.ts` (drops the edge and gate loops and the moved helpers), `src/features/trade-scenes/lib/resolve-property-layout.ts`, `src/features/trade-scenes/lib/default-layout.ts` (edges/gates gone), `src/features/trade-scenes/lib/retile-property-layout.ts` (edge/gate scaling gone), `src/features/trade-scenes/lib/layout-codec.ts`, `src/features/trade-scenes/schemas/property-layout.ts` (`edgeSchema`, `gateSchema`, `lotSpansFit`, `lotSides`, `lotEdgeKinds`, `gateSides`, `gateKinds` and their `Covers` rows gone), `src/features/trade-scenes/constants/layout-editor-copy.ts` (`fences` keeps `title`, the four sides, `none`, `mixed`), `src/features/trade-scenes/ui/components/layout-kit/layout-lot.tsx`, `src/features/trade-scenes/ui/components/layout-editor/layout-editor-panel.tsx`
- Rename: `src/features/trade-scenes/ui/components/layout-editor/lot-edges-fields.tsx` → `lot-perimeter-fields.tsx` (`LotPerimeterFields`)
- Test: `scripts/verify-property-layout.ts` (the box parity block, lines 468–504, the `frontTops`/`withEdges` blocks 539–588, the default-lot span assertions 139–146, the reject cases 301–312, the file checks 654–658), `scripts/verify-layout-kit.ts` (`lotOf` drops `edges`/`gates`)

This task is the one change that moves every consumer of the spans and deletes them (F8): the boxes read lines, the selects write the maps, the wire drops `edges`/`gates`, the types go.

**Interfaces:**
- Consumes: `FenceLine[]`, `fenceMask` (Task 3), `boards`, `capsOf`, `onGrade`, `padToFront`, `run` and the moved helpers from `lot-box-parts.ts`.
- Produces:
  ```ts
  export interface FenceBoxes { blockWalls, wallCaps, fenceBoards, fenceRails, vinylParts, compositeBoards, compositePosts, ironwork, chainPosts, chainMesh: readonly BoxSpec[] }
  // ResolvedLayout gains: fenceBoxes: Record<GroundLayer, FenceBoxes>
  export function layoutFenceBoxes(layout: PropertyLayout, origin: LotOrigin, bounds: LotBounds, heightAt: (z: number) => number, lines: readonly FenceLine[], fenceMask: FenceMap, layer: GroundLayer): FenceBoxes
  // perimeter-kinds.ts — every kind that sets 'existing' and is not a gate; the front omits blockWall (the 42 in cap).
  export function perimeterKindsFor(side: LotSide): readonly FenceKindId[]
  ```
  Rules the builder encodes (Task 4b adds the other kinds to the same function):
  - Kind shown for a line on a layer: `layer === 'proposed' ? line.proposed ?? line.existing : line.existing`; null builds nothing.
  - World span: across → `x0 = colX(from)`, `x1 = colX(to)`, `z = rowZ(line)`; along → `x = colX(line)`, `zNear = rowZ(from)`, `zFar = rowZ(to)`.
  - An end that abuts a mass (the cell past the end is masked in `fenceMask`, or the line's end lands on a mass's tile edge) snaps to that mass's constant face until L3: main `±HOUSE.halfLength` / `±HOUSE.halfDepth`, garage `GARAGE.x0/x1/z0/z1`.
  - Boards at an end that meets a perimeter line are inset by `LOT.wall.thickness / 2` (today's gate boards).
  - **Height per cell (F4):** the main mass's front face row `faceRow = main.r0`. An across line is wholly capped when `line <= faceRow`, else full. An along line splits into the capped stretch `[from, min(to, faceRow))` and the full stretch `[max(from, faceRow), to)`; when the kind's capped height equals its full height (`lowWall`) the line builds as one span. Capped height `LOT.frontFence`, full `LOT.wall.height`; a `blockWall` stretch that is capped builds as `lowWall`.
  - Wood rails at `[height - 0.08, 0.3]`, offset 0.03 toward the lot's interior: across lines at `z - 0.03` when `line < rows / 2` (the front half: today's front and side-yard rails), else `z + 0.03` (today's back line); along lines at `x + 0.03` when `line <= cols / 2`, else `x - 0.03`. Every wood fence gets both rails (spec call 9).
  - Along lines on the slope use today's `graded` logic (`padToFront` when the span crosses `padEnd`, else `onGrade`); across lines are lifted to `heightAt(z)`; boards on an along line are lifted to the grade under each board.
- `LotPerimeterFields`: four selects; value = the one kind every cell of that lot line carries on the existing map (`''` → "Mixed" placeholder when they differ; `none` when all 0); on change, `commitLayout(inputs, editor, applyFenceStroke(layout, { axis, line, from: 0, to: length }, { existing: kind ?? FENCE_NONE, proposed: null }))` (`applyFenceStroke` arrives in Task 6; until then the fields call `paintFenceCells` on the existing map directly and set `source: 'edited'`; Task 6 swaps the call). Offered kinds from `perimeterKindsFor(side)` plus None; `SelectContent className="dark"` as the region card's.

- [ ] **Step 1: Rewrite the parity checks** so they read `resolved.fenceBoxes.existing` for the wall and fence lists and `resolved.boxes` for concrete and asphalt, matching by nearest box rather than by index (F9):

```ts
const fenceBoxes = resolved.fenceBoxes.existing
assert.deepEqual(resolved.fenceBoxes.proposed, fenceBoxes, 'with nothing proposed, the build layer shows today\'s fences')
const sameBox = (a: BoxSpec, b: BoxSpec) => a.position.every((v, i) => Math.abs(v - b.position[i]) <= LAYOUT_TILE) && a.size.every((v, i) => Math.abs(v - b.size[i]) <= LAYOUT_TILE)
const matchAll = (list: 'blockWalls' | 'wallCaps', label: string) => {
  assert.equal(fenceBoxes[list].length, LOT_BOXES[list].length, `${label}: as many as the scene's`)
  for (const [i, was] of LOT_BOXES[list].entries()) {
    assert.ok(fenceBoxes[list].some(now => sameBox(now, was)), `${label} ${i} has a match within a tile`)
  }
}
matchAll('blockWalls', 'block walls')
matchAll('wallCaps', 'wall caps')
const tallWalls = fenceBoxes.blockWalls.filter(wall => Math.abs(wall.size[1] - LOT.wall.height) <= 1e-9)
assert.equal(tallWalls.length, 3, 'three walls stand 1.83 high')
const lowParts = fenceBoxes.blockWalls.filter(wall => wall.size[1] < LOT.frontFence)
assert.equal(lowParts.length, lowWallParts, 'the low wall builds in its slope parts')
for (const wall of lowParts) {
  const cap = fenceBoxes.wallCaps.find(c => Math.abs(c.position[2] - wall.position[2]) <= 1e-6 && Math.abs(c.position[0] - wall.position[0]) <= 1e-6)
  assert.ok(cap, 'every low wall part carries a cap')
  const top = cap.position[1] + cap.size[1] / 2
  assert.ok(top - resolved.heightAt(cap.position[2]) <= LOT.frontFence + 1e-9, `a low wall part stays within 1.07 m, cap included`)
}
// The rail list: today's right side-yard fence has one rail by an accident of the constants; every wood fence now gets two.
assert.equal(fenceBoxes.fenceRails.length, 4, 'two rails on each side-yard fence')
const sceneRails = LOT_BOXES.fenceRails
const matchedRails = sceneRails.map(was => fenceBoxes.fenceRails.find(rail => Math.abs(rail.position[0] - was.position[0]) <= LAYOUT_TILE && Math.abs(rail.position[1] - was.position[1]) <= 1e-6 && Math.abs(rail.position[2] - was.position[2]) <= LAYOUT_TILE))
assert.ok(matchedRails.every(Boolean), 'each of the scene\'s three rails has a match')
const extraRail = fenceBoxes.fenceRails.find(rail => !matchedRails.includes(rail))
assert.ok(extraRail && extraRail.position[0] > GARAGE.x1 && Math.abs(extraRail.position[1] - 0.3) <= 1e-6, 'the one new rail is the right side yard\'s lower rail')
```

Keep the board checks (`leftBoards`, `rightBoards` spans and within-a-board-of-the-scene) reading `fenceBoxes.fenceBoards`; `wallLists` and its index loop go. Rewrite `frontTops(kind)` and `withEdges(side, kind)` as `withPerimeter(side, kind)`: paint a whole lot line on the existing map with `paintFenceCells` (front: across line 0; left/right: along line 0 / cols) and read `resolvePropertyLayout(...).fenceBoxes.existing`. Their assertions stand (42 in cap on the front for `blockWall` and `woodFence`, side boards and rails on the grade, no wall part floating, front boards on the ground) except the whole-left `blockWall` block, which now asserts the per-cell cap (F4):

```ts
{
  const walled = withPerimeter('left', 'blockWall')
  const faceZ = walled.bounds.front - metresOf(main.r0, tile)
  const inFront = walled.fenceBoxes.existing.blockWalls.filter(b => b.position[2] > faceZ && b.position[2] <= walled.bounds.front)
  assert.ok(inFront.length > 0, 'a whole left blockWall has parts in the front yard')
  for (const wall of inFront) {
    const cap = walled.fenceBoxes.existing.wallCaps.find(c => Math.abs(c.position[2] - wall.position[2]) <= 1e-6)
    assert.ok(cap && cap.position[1] + cap.size[1] / 2 - walled.heightAt(cap.position[2]) <= LOT.frontFence + 1e-9, `the front-yard stretch builds low at z ${wall.position[2]}`)
  }
  const behind = walled.fenceBoxes.existing.blockWalls.filter(b => b.position[2] < faceZ)
  assert.ok(behind.length > 0 && behind.every(b => Math.abs(b.size[1] - LOT.wall.height) <= 1e-9), 'the stretch behind the face stands 1.83')
  for (const wall of walled.fenceBoxes.existing.blockWalls) {
    const bottom = wall.position[1] - wall.size[1] / 2
    assert.ok(bottom - walled.heightAt(wall.position[2]) <= 0.05, `no wall part floats over the grade (z ${wall.position[2]}, ${bottom})`)
  }
  const fenced = withPerimeter('left', 'woodFence')
  const boardTop = (b: BoxSpec) => b.position[1] + b.size[1] / 2 - fenced.heightAt(b.position[2])
  assert.ok(fenced.fenceBoxes.existing.fenceBoards.filter(b => b.position[2] > faceZ).every(b => boardTop(b) <= LOT.frontFence + 1e-9), 'front-yard boards stop at 42 in')
  assert.ok(fenced.fenceBoxes.existing.fenceBoards.filter(b => b.position[2] < faceZ).every(b => Math.abs(boardTop(b) - LOT.wall.height) <= 0.02), 'boards behind the face stand 6 ft')
}
```

Replace the four edge/gate `reject` cases (lines 301–312) with nothing (the fence rejects are Task 2's) and add `assert.ok(!('edges' in wire.lot) && !('gates' in wire.lot), 'the wire carries no spans')`. Replace the default-lot `edges`/`gates` assertions (lines 139–146) with `const sideYardRow = tilesOf(LOT.front - LOT.gateZ, tile)` (Task 2's `const sideYardRow = lot.gates[0].row` goes). Replace the `lot-edges-fields.tsx` file checks (lines 654–658) with behavioural ones:

```ts
assert.deepEqual([...perimeterKindsFor('front')], FENCE_KIND_IDS.filter(id => FENCE_KINDS[id].sets.includes('existing') && !FENCE_KINDS[id].gate && id !== 'blockWall'), 'the front offers every today kind but gates and the block wall')
assert.deepEqual([...perimeterKindsFor('left')], FENCE_KIND_IDS.filter(id => FENCE_KINDS[id].sets.includes('existing') && !FENCE_KINDS[id].gate), 'a side offers every today kind but gates')
const perimeterFields = readFileSync(`${editorDir}/lot-perimeter-fields.tsx`, 'utf8')
assert.ok(perimeterFields.includes('perimeterKindsFor(') && perimeterFields.includes('className="dark"'), 'the perimeter selects take their kinds from the rule and open in the scoped dark')
assert.ok(!existsSync(`${editorDir}/lot-edges-fields.tsx`), 'the edge fields are gone')
```

Add a unit check of the fields' write rule beside the editor checks: paint along line `lot.cols` with `K.vinylFence` from 0 to `rows` on the existing map → `fenceLineAt(fences, 'along', cols, 0)` is one line `0..rows`, `perimeterSideOf` = `'right'`; paint it with `FENCE_NONE` → no line on that grid line.

- [ ] **Step 2: Run to see it fail.** → `fenceBoxes` undefined.

- [ ] **Step 3: Write `layoutFenceBoxes`** for `woodFence`, `blockWall`, `lowWall` (the other seven lists empty for now) and `perimeter-kinds.ts`; move the helpers to `lot-box-parts.ts`; move `resolvePropertyLayout` to `fenceBoxes: { existing: layoutFenceBoxes(..., 'existing'), proposed: layoutFenceBoxes(..., 'proposed') }`; cut the fence code out of `layoutLotBoxes` (it returns `{ concrete, asphalt }`); in `layout-lot.tsx` read `const fence = resolved.fenceBoxes[layer]` and mount its `blockWalls`, `wallCaps`, `fenceBoards`, `fenceRails` groups as today, each only when `list.length > 0`. Delete the span types and fields from `types.ts`, `default-layout.ts`, `retile-property-layout.ts`, the schema, the codec and the kit check's `lotOf`; rename and rewrite the fields component; update the panel's import; trim the `fences` copy. `grep -rn "LotEdge\|LotGate\|lot\.edges\|lot\.gates\|LotEdgesFields\|lot-edges-fields" src/features/trade-scenes scripts` returns nothing.

- [ ] **Step 4: Run both checks, tsc, eslint** → ok / 0 / 0. `pnpm exec tsx scripts/verify-trade-scene.ts`, `verify-trade-scene-layout.ts` and `verify-trade-scene-lot.ts` still ok.

- [ ] **Step 5: Commit** `layout-fence-boxes.ts`, `perimeter-kinds.ts`, `lot-box-parts.ts`, `layout-lot-boxes.ts`, `types.ts`, `resolve-property-layout.ts`, `default-layout.ts`, `retile-property-layout.ts`, `layout-codec.ts`, `schemas/property-layout.ts`, `layout-editor-copy.ts`, `layout-lot.tsx`, `layout-editor-panel.tsx`, the renamed fields (`git add` the new path and `git rm` the old), both checks: `feat(trade-scenes): the lot's walls and fences are built from fence lines, one box set per layer, capped per cell in the front yard; the per-side perimeter selects write whole lot lines; the lot's edge spans and gates are gone`.

---

### Task 4b: Vinyl, composite, wrought iron, chain link and the gates

**Files:**
- Modify: `src/features/trade-scenes/lib/layout-fence-boxes.ts`, `src/features/trade-scenes/ui/components/layout-kit/layout-lot.tsx`
- Test: `scripts/verify-property-layout.ts`

**Interfaces:**
- Consumes: Task 4a's function and lists; `LOT_PALETTE` (Task 1).
- Produces (the box groups per kind, first cut; the builder tunes by eye in both weathers). Every post's top, cap included, stands at most 0.08 above the kind's height, so the front-yard check holds for every kind:
  - `vinylFence` → `vinylParts`: posts 0.12 square every 2.44 m (8 ft) and at both ends, height + 0.04, with a 0.16 cap 0.04 high on top (post + cap = height + 0.08); one panel per bay 0.03 thick, bottom 0.05 above the grade, top at height.
  - `compositeFence` → `compositeBoards`: horizontal boards 0.14 high, 0.02 thick, 0.012 gaps, filling the bays; `compositePosts`: 0.1 square posts, height + 0.05, every 1.83 m and at both ends.
  - `wroughtIron` → `ironwork`: pickets 0.02 square every 0.1 m, top and bottom rails 0.03 × 0.03 at height − 0.05 and 0.12, square posts 0.06, height + 0.05, every 2.44 m and at both ends.
  - `chainLink` → `chainPosts`: 0.05 square posts, height + 0.03, every 3.05 m and at both ends plus a top rail 0.04; `chainMesh`: one box per line, 0.005 thick, full height, drawn with `opacity={0.45}` (a look choice; the pass-through to the ground comes from `ignoreTaps`, since 0.45 is above `SCENE_GESTURES.doubleTapStopOpacity`, 0.3).
  - Gates (`woodGate`, `vinylGate`, `compositeGate`, `ironGate`): two posts 0.1 square (height + 0.08) at the ends; a leaf per side: one leaf when the line is ≤ 2 cells, two meeting in the middle beyond; each leaf is a 0.06 frame (top, bottom, two stiles) with a 0.02 hinge gap at the post and 0.05 clearance under, infilled in the family's look (wood: `boards` within the frame; vinyl: a panel; composite: horizontal boards; iron: pickets). Frames and infill go in the family's lists (`fenceRails`/`fenceBoards`, `vinylParts`, `compositePosts`/`compositeBoards`, `ironwork`). A gate drawn where no fence stands still draws.
  - All on the grade as the wood fence is; the per-cell front-yard cap applies to every kind.
- `layout-lot.tsx` mounts, from one `FENCE_BOX_LOOKS: Record<keyof FenceBoxes, { color, roughness, metalness?, opacity?, ignoreTaps?, radius? }>` table mapped once (so "only when non-empty" lives in one place): `vinylParts` `LOT_PALETTE.vinyl` roughness 0.35; `compositeBoards` `LOT_PALETTE.compositeBoard` 0.8; `compositePosts` `LOT_PALETTE.compositePost` 0.7; `ironwork` `LOT_PALETTE.iron` roughness 0.5 metalness 0.6; `chainPosts` `LOT_PALETTE.galvanised` 0.4 metalness 0.7; `chainMesh` `LOT_PALETTE.chainMesh` opacity 0.45 `ignoreTaps`; today's four lists keep today's looks (`fenceRails` keeps `ignoreTaps`).

- [ ] **Step 1: Write the failing checks** after the parity block:

```ts
function withExisting(axis: FenceAxis, line: number, from: number, to: number, kind: FenceKindId, layer: GroundLayer = 'existing') {
  const map = paintFenceCells(lot.fence[layer], lot, { axis, line, from, to }, FENCE_KIND_INDEX[kind], cellMask)
  const r = resolvePropertyLayout({ ...layout, lot: { ...lot, fence: { ...lot.fence, [layer]: map } } })
  return { r, boxes: r.fenceBoxes[layer] }
}
const backRow = lot.rows - 3
const listOf: Record<FenceKindId, (keyof FenceBoxes)[]> = { woodFence: ['fenceBoards', 'fenceRails'], vinylFence: ['vinylParts'], compositeFence: ['compositeBoards', 'compositePosts'], wroughtIron: ['ironwork'], chainLink: ['chainPosts', 'chainMesh'], blockWall: ['blockWalls', 'wallCaps'], lowWall: ['blockWalls', 'wallCaps'], woodGate: ['fenceBoards', 'fenceRails'], vinylGate: ['vinylParts'], compositeGate: ['compositeBoards', 'compositePosts'], ironGate: ['ironwork'] }
const topOf = (boxes: readonly BoxSpec[], heightAt: (z: number) => number) => Math.max(...boxes.map(box => box.position[1] + box.size[1] / 2 - heightAt(box.position[2])))
for (const kind of FENCE_KIND_IDS) {
  const { r, boxes: b } = withExisting('across', backRow, 2, 10, kind)
  const drawn = listOf[kind].flatMap(list => b[list]).filter(box => Math.abs(box.position[2] - (r.bounds.front - metresOf(backRow, tile))) < 0.2)
  assert.ok(drawn.length > 0, `${kind} across the back yard draws in its own lists`)
  const expectedHeight = kind === 'lowWall' ? LOT.frontFence : LOT.wall.height
  const top = topOf(drawn, r.heightAt)
  assert.ok(top >= expectedHeight - 0.02 && top <= expectedHeight + 0.08 + 1e-9, `${kind} stands at its height in the back yard, posts carrying at most 0.08 (${top})`)
  const untouched = (Object.keys(b) as (keyof FenceBoxes)[]).filter(list => !listOf[kind].includes(list))
  assert.ok(untouched.every(list => b[list].length === fenceBoxes[list].length), `${kind} adds boxes to no other list`)
  const front = withExisting('across', 0, 2, 10, kind)
  const onFront = listOf[kind].flatMap(list => front.boxes[list]).filter(box => Math.abs(box.position[2] - front.r.bounds.front) < 0.2)
  assert.ok(onFront.length > 0, `${kind} on the front line draws`)
  assert.ok(topOf(onFront, front.r.heightAt) <= LOT.frontFence + 0.08 + 1e-9, `${kind} on the front stands no taller than 42 in, posts carrying at most 0.08`)
}
assert.equal(withExisting('across', 0, 2, 10, 'blockWall').boxes.blockWalls.filter(b => Math.abs(b.position[2] - bounds.front) < 0.2).every(b => b.size[1] <= LOT.frontFence), true, 'a block wall on the front builds low')
{
  const single = withExisting('across', backRow, 4, 6, 'woodGate').boxes
  const double = withExisting('across', backRow, 4, 9, 'woodGate').boxes
  const stiles = (b: FenceBoxes) => b.fenceRails.filter(box => Math.abs(box.position[2] - (bounds.front - metresOf(backRow, tile))) < 0.2 && box.size[1] > 1 && box.size[0] < 0.1).length
  assert.equal(stiles(single), 2, 'a two-cell gate is one leaf: two stiles')
  assert.equal(stiles(double), 4, 'a five-cell gate is two leaves: four stiles')
}
{
  const from = main.r0 + main.rows + 2
  const { r, boxes: b } = withExisting('along', 10, from, lot.rows, 'vinylFence')
  const zNear = r.bounds.front - metresOf(from, tile)
  const zFar = r.bounds.front - metresOf(lot.rows, tile)
  const standing = b.vinylParts.filter(box => box.size[1] > 0.5)
  assert.ok(standing.length > 0, 'posts and panels are the tall vinyl parts')
  for (const box of standing) {
    assert.ok(box.position[1] - box.size[1] / 2 - r.heightAt(box.position[2]) <= 0.06, `a vinyl part at z ${box.position[2]} stands on the grade`)
  }
  for (const box of b.vinylParts) {
    assert.ok(box.position[2] - box.size[2] / 2 >= zFar - 0.1 && box.position[2] + box.size[2] / 2 <= zNear + 0.1, `a vinyl part at z ${box.position[2]} stays between the drawn ends`)
  }
  const toHouse = withExisting('along', main.c0 + 2, main.r0 + main.rows, lot.rows, 'vinylFence').boxes.vinylParts
  near(Math.max(...toHouse.map(box => box.position[2] + box.size[2] / 2)), -HOUSE.halfDepth, 0.1, 'a fence traced up to the house\'s back face ends on that face')
}
{
  const { r } = withExisting('along', 10, main.r0 + main.rows + 2, lot.rows, 'compositeFence', 'proposed')
  assert.deepEqual(r.fenceBoxes.existing, fenceBoxes, 'a proposed fence leaves the today view\'s boxes unchanged')
  assert.ok(r.fenceBoxes.proposed.compositeBoards.length > 0, 'and shows in the build view')
  assert.equal(r.fenceBoxes.proposed.blockWalls.length, fenceBoxes.blockWalls.length, 'the build view keeps today\'s walls where nothing is proposed')
}
assert.ok(withExisting('across', backRow, 2, 10, 'chainLink').boxes.chainMesh.length === 1, 'chain link is one mesh plane per line')
const lotFile = readFileSync('src/features/trade-scenes/ui/components/layout-kit/layout-lot.tsx', 'utf8')
assert.ok(lotFile.includes('FENCE_BOX_LOOKS') && !/color="#/.test(lotFile), 'the fence groups mount from one look table with palette colours')
```

- [ ] **Step 2: Run to see it fail.** → the first kind beyond today's three draws nothing.

- [ ] **Step 3: Build the kinds and the gates** in `layoutFenceBoxes` per the rules above, and mount the groups from `FENCE_BOX_LOOKS` in `layout-lot.tsx`.

- [ ] **Step 4: Run the check, tsc, eslint** → ok / 0 / 0.

- [ ] **Step 5: Look.** With the owner's dev server on 3003, a Playwright script in the SDD workspace (`openLab`, then the editor store through the canvas fiber as `shots/task-8/draw.mjs` does; the fence maps are painted through `inputs.setState({ layout })` with maps built in the page from `paintFenceCells`'s rule, since the fence tool is Task 6) paints one line of each kind on the back yard's existing map and shoots Today in Normal and Summer at 1280 × 800; keep the shots for the owner's look. Tune colours and sizes by eye; every colour stays in `LOT_PALETTE`.

- [ ] **Step 6: Commit** `layout-fence-boxes.ts`, `layout-lot.tsx`, `home-lot.ts` if tuned, the check: `feat(trade-scenes): vinyl, composite, wrought iron and chain link fences, and a hinged gate leaf in each family`.

---

### Task 5: folded into Task 4a (stress-test ruling F8)

No work here. The number is kept so the owner's brief, which names Tasks 4b, 7 and 8, still reads.

---

### Task 6: The fence tool: tracing, snapping, preview, selection

**Files:**
- Create: `src/features/trade-scenes/constants/layout-editor-look.ts`, `src/features/trade-scenes/lib/fence-stroke.ts`, `src/features/trade-scenes/ui/lib/fence-band-geometry.ts`, `src/features/trade-scenes/ui/components/layout-kit/layout-fence-highlight.tsx`
- Modify: `src/features/trade-scenes/types.ts` (`GridVertex`), `src/features/trade-scenes/constants/layout-grid.ts` (`LINE_TAP_SHARE`, `FENCE_MESH_TAP_SHARE`), `src/features/trade-scenes/lib/tile-at.ts` (`vertexAt`), `src/features/trade-scenes/lib/create-layout-editor.ts`, `src/features/trade-scenes/hooks/use-lot-draw-handlers.ts`, `src/features/trade-scenes/ui/lib/region-strip-geometry.ts` (exports `pushGradeQuad`), `src/features/trade-scenes/ui/components/layout-kit/lot-draw-preview.tsx`, `src/features/trade-scenes/ui/components/layout-kit/layout-lot.tsx`, `src/features/trade-scenes/ui/components/layout-kit/layout-region-outlines.tsx` (reads `selected?.type === 'region'` and `LAYOUT_EDITOR_LOOK`), `src/features/trade-scenes/ui/components/layout-editor/region-card.tsx` (reads the new selection shape; the fence card is Task 7), `src/features/trade-scenes/ui/components/layout-editor/lot-perimeter-fields.tsx` (writes through `applyFenceStroke`)
- Test: `scripts/verify-property-layout.ts`, `scripts/verify-layout-kit.ts`

**Interfaces:**
- Produces, in `types.ts`: `export type GridVertex = readonly [col: number, row: number]` (`0..cols` / `0..rows` inclusive: a corner, not a tile).
- Produces, in `layout-editor-look.ts`: `LAYOUT_EDITOR_LOOK = { selected: '#ffd54a', outline: '#ffffff', previewNeutral: '#ffffff', previewOpacity: 0.35, bandWidth: 0.12, bandLift: 0.05, highlightWidth: 0.16, highlightLift: 0.04 }` (the two literals `layout-region-outlines.tsx` holds today move here).
- Produces, in `layout-grid.ts`: `LINE_TAP_SHARE = 0.25` (a ground tap within this share of a tile of a line that carries a fence picks the line), `FENCE_MESH_TAP_SHARE = 0.5`.
- Produces, in `create-layout-editor.ts`:
  ```ts
  export type EditorTool = 'ground' | 'fence'
  export type EditorSelection = { type: 'region', id: string } | { type: 'fence', id: string }
  export type EditorStroke = { tool: 'ground', from: GridVertex, to: GridVertex } | { tool: 'fence', from: GridVertex, to: GridVertex }   // ground: tiles; fence: vertices
  export interface GroundBrush { existing: GroundMaterialId | null, proposed: GroundMaterialId | typeof PROPOSED_KEEP | null }      // today's brush type, named
  export interface FenceBrush { existing: FenceKindId | typeof FENCE_NONE | null, proposed: FenceKindId | typeof PROPOSED_KEEP | null }
  export interface LayoutEditorState { mode, tool: EditorTool, brush: GroundBrush, fenceBrush: FenceBrush, selected: EditorSelection | null, stroke: EditorStroke | null, undo }
  // Same layout back when nothing changes. A LineRange target paints a traced length; an index list repaints a line's cells (the card, the perimeter selects).
  export function applyFenceStroke(layout: PropertyLayout, target: LineRange | { axis: FenceAxis, indices: readonly number[] }, brush: FenceBrush): PropertyLayout
  ```
  `createLayoutEditor()` opens with `tool: 'ground'`, `fenceBrush: { existing: null, proposed: null }`. `applyStroke` and `applyFenceStroke` share one private `edited(layout, lot)` tail (`{ ...layout, lot, source: 'edited' }`); the fence mask is `fenceCellMask(lot, massMask(layout))`.
- Produces, in `tile-at.ts`: `vertexAt(origin, lot, x, z): GridVertex | null`, the nearest grid vertex, clamped to the lot's lines; null when the point lies more than half a tile outside the lot.
- Produces, in `fence-stroke.ts`:
  ```ts
  // One straight length on the dominant axis: |Δcol| ≥ |Δrow| → across on line a[1] over the columns between; else along on line a[0] over the rows between. null when a equals b.
  export function lineRangeBetween(a: GridVertex, b: GridVertex): LineRange | null
  // The nearest grid line within `within` metres of the point, and the cell on it under the point; null when none is that close.
  export function fenceCellNear(origin: LotOrigin, lot: Pick<LotLayout, 'cols' | 'rows'>, x: number, z: number, within: number): { axis: FenceAxis, line: number, cell: number } | null
  ```
- Produces, in `fence-band-geometry.ts`: `fenceBandGeometry(range: LineRange, origin: LotOrigin, heightAt: (z: number) => number, width: number, lift: number): BufferGeometry`, one quad per cell through `pushGradeQuad` exported from `region-strip-geometry.ts` (across: `x` from `colX(c)` to `colX(c + 1)`, `z` from `z − width / 2` to `z + width / 2`; along: `x ± width / 2`, `z` from `rowZ(r + 1)` to `rowZ(r)`), every corner on the grade at its own z, facing up, normals and uvs as the strips'.
- Draw handlers (`use-lot-draw-handlers.ts`), fence tool: press → `vertexAt`; null → no stroke (the camera orbits). Stroke `{ tool: 'fence', from: v, to: v }`; `OpenStroke` also keeps `downTile = tileAt(downPoint)`. Move → `to = vertexAt(...)` when non-null and changed. Lift with `from === to` → a tap: `fenceCellNear(..., tile * LINE_TAP_SHARE)` on a line carrying a fence → `selected: { type: 'fence', id }`; else the region under `downTile` as today (never the vertex). Lift with a range → `commitLayout(inputs, editor, applyFenceStroke(layout, lineRangeBetween(from, to), fenceBrush))`. Pointer capture, camera hold and the second-finger rules are the existing ones, untouched. The ground tool's lift sets `selected: { type: 'region', id }`.
- Preview: `LotDrawPreview` builds `fenceBandGeometry(lineRangeBetween(from, to) ?? a one-cell range at `from`, …, LAYOUT_EDITOR_LOOK.bandWidth, .bandLift)` for a fence stroke and the region strip for a ground stroke; its colour is `FENCE_KINDS[kind].look.color` for the fence brush's existing kind, else its proposed kind, else `previewNeutral` (as `brushColor` does for the ground).
- `LayoutFenceHighlight({ resolved, selected })`: the selected fence line as a band, `highlightWidth` / `highlightLift`, `LAYOUT_EDITOR_LOOK.selected`, `depthWrite={false}`, `raycast={ignoreRaycast}`; mounted beside `LayoutRegionOutlines` in draw mode.
- `LotPerimeterFields` now writes through `applyFenceStroke` (Task 4a's interim direct paint goes).

- [ ] **Step 1: Write the failing checks.** In `verify-property-layout.ts`, update the editor opening-state `deepEqual` (line 433) to `{ mode: 'orbit', tool: 'ground', brush: { existing: null, proposed: null }, fenceBrush: { existing: null, proposed: null }, selected: null, stroke: null, undo: [] }`, then after the `applyStroke`/`commitLayout` block:

```ts
assert.deepEqual(vertexAt(origin, lot, bounds.left - 0.2, bounds.front + 0.2), [0, 0], 'a press just outside the street-side corner snaps to it')
assert.equal(vertexAt(origin, lot, bounds.left - tile, bounds.front), null, 'a press a whole tile outside snaps to nothing')
assert.deepEqual(vertexAt(origin, lot, bounds.right + 0.1, bounds.back - 0.1), [lot.cols, lot.rows], 'the far corner is vertex (cols, rows)')
assert.deepEqual(lineRangeBetween([3, 5], [9, 6]), { axis: 'across', line: 5, from: 3, to: 9 }, 'a mostly sideways drag is an across length on the press row')
assert.deepEqual(lineRangeBetween([3, 5], [4, 12]), { axis: 'along', line: 3, from: 5, to: 12 }, 'a mostly backward drag is an along length on the press column')
assert.deepEqual(lineRangeBetween([9, 6], [3, 6]), { axis: 'across', line: 6, from: 3, to: 9 }, 'direction does not matter')
assert.equal(lineRangeBetween([3, 5], [3, 5]), null, 'no drag, no length')
const backLineZ = bounds.front - metresOf(lot.rows, tile)
assert.deepEqual(fenceCellNear(origin, lot, bounds.left + 2.5 * tile, backLineZ + 0.05, tile * LINE_TAP_SHARE), { axis: 'across', line: lot.rows, cell: 2 }, 'a point near the back line finds its cell')
assert.equal(fenceCellNear(origin, lot, bounds.left + 2.5 * tile, backLineZ + tile / 2, tile * LINE_TAP_SHARE), null, 'a point mid-tile finds no line')
const fenceEditor = createLayoutEditor()
assert.equal(fenceEditor.getState().tool, 'ground', 'the brush opens on the ground tool')
const traced = applyFenceStroke(layout, { axis: 'across', line: lot.rows - 3, from: 2, to: 10 }, { existing: null, proposed: 'vinylFence' })
assert.notEqual(traced, layout)
assert.equal(traced.lot.fence.proposed.across[fenceCellIndex(lot, 'across', lot.rows - 3, 5)], K.vinylFence, 'a trace paints the build map')
assert.equal(traced.lot.fence.existing, lot.fence.existing, 'No change leaves the today map alone')
assert.equal(traced.lot.existing, lot.existing, 'a fence trace never touches the ground')
assert.equal(traced.source, 'edited')
assert.equal(applyFenceStroke(layout, { axis: 'across', line: main.r0 + 1, from: main.c0, to: main.c0 + main.cols }, { existing: 'woodFence', proposed: null }), layout, 'a trace through the house changes nothing')
assert.equal(applyFenceStroke(layout, { axis: 'across', line: 3, from: 2, to: 4 }, { existing: null, proposed: null }), layout, 'No change on both rows paints nothing')
const kept = applyFenceStroke(traced, { axis: 'across', line: lot.rows - 3, from: 2, to: 10 }, { existing: null, proposed: PROPOSED_KEEP })
assert.deepEqual(Array.from(kept.lot.fence.proposed.across), Array.from(lot.fence.proposed.across), 'Keep erases the build layer')
const erased = applyFenceStroke(layout, { axis: 'across', line: lot.rows, from: 0, to: lot.cols }, { existing: FENCE_NONE, proposed: null })
assert.ok(Array.from({ length: lot.cols }, (_, c) => erased.lot.fence.existing.across[fenceCellIndex(lot, 'across', lot.rows, c)]).every(v => v === 0), 'None erases the today layer: the back wall is gone')
assert.equal(resolvePropertyLayout(erased).fences.length, 5, 'and its line with it')
const fenceInputs = createSceneInputs({ ...HOME_SCENE_DEFAULTS, layout })
commitLayout(fenceInputs, fenceEditor, traced)
const groundAfter = applyStroke(traced, { c0: 2, r0: 2, cols: 2, rows: 2 }, { existing: 'pavers', proposed: null })
assert.equal(groundAfter.lot.fence, traced.lot.fence, 'a ground stroke after a fence stroke leaves the fence maps untouched')
assert.equal(fenceEditor.getState().undo.at(-1), layout, 'undo holds the layout before the trace, fence maps included')
const sameTile = fenceInputs.getState().layout
commitLayout(fenceInputs, fenceEditor, applyFenceStroke(sameTile, { axis: 'across', line: main.r0 + 1, from: main.c0, to: main.c0 + main.cols }, { existing: 'woodFence', proposed: null }))
assert.equal(fenceEditor.getState().undo.length, 1, 'a trace that paints nothing pushes no undo step')
const outlinesFile = readFileSync('src/features/trade-scenes/ui/components/layout-kit/layout-region-outlines.tsx', 'utf8')
const highlightFile = readFileSync('src/features/trade-scenes/ui/components/layout-kit/layout-fence-highlight.tsx', 'utf8')
assert.ok(!/#[0-9a-f]{6}/i.test(outlinesFile) && !/#[0-9a-f]{6}/i.test(highlightFile) && highlightFile.includes('LAYOUT_EDITOR_LOOK'), 'the editor\'s chrome colours come from LAYOUT_EDITOR_LOOK')
```

In `verify-layout-kit.ts`:

```ts
const band = fenceBandGeometry({ axis: 'along', line: 1, from: 0, to: 3 }, origin, z => -z, 0.12, 0.05)
assert.equal(quadsOf(band), 3, 'one quad per cell')
const bandPositions = band.getAttribute('position')
for (let v = 0; v < bandPositions.count; v++) {
  assert.ok(Math.abs(bandPositions.getY(v) - (-bandPositions.getZ(v) + 0.05)) < 1e-5, `band vertex ${v} sits on the grade at its own z`)
  assert.ok(Math.abs(Math.abs(bandPositions.getX(v) - (origin.originX + origin.tile)) - 0.06) < 1e-5, `band vertex ${v} is half a width off the line`)
}
const acrossBand = fenceBandGeometry({ axis: 'across', line: 2, from: 1, to: 3 }, origin, flat, 0.12, 0)
assert.equal(quadsOf(acrossBand), 2)
```

- [ ] **Step 2: Run both to see them fail.** → missing exports.

- [ ] **Step 3: Write `layout-editor-look.ts`, `fence-stroke.ts`, `vertexAt`, `fence-band-geometry.ts` (with `pushGradeQuad` exported from the strip geometry), the editor state and `applyFenceStroke`**, the handlers' fence path, the preview's fence branch, the highlight component, the selection shape in the outlines and the region card, the outlines' colours from `LAYOUT_EDITOR_LOOK`, the perimeter fields' write through `applyFenceStroke`. *(plan call: a fence tap wins over a region tap only when a fence line is within `LINE_TAP_SHARE` of a tile; a tap elsewhere selects the region as today.)*

- [ ] **Step 4: Run both checks, tsc, eslint** → ok / 0 / 0.

- [ ] **Step 5: Commit** the new constants and libs, `types.ts`, `layout-grid.ts`, `tile-at.ts`, `region-strip-geometry.ts`, the editor, the handlers, the preview, the highlight, the outlines, the region card, the perimeter fields, both checks: `feat(trade-scenes): the fence tool traces one straight length snapped to the grid, previews it on the grade and selects a fence line with a tap`.

---

### Task 7: The panel: tool toggle, fence rows, fence card, fence mesh taps

**Files:**
- Create: `src/features/trade-scenes/ui/components/layout-editor/brush-rows.tsx`, `.../ground-brush-rows.tsx`, `.../fence-brush-rows.tsx`, `.../fence-card.tsx`, `src/features/trade-scenes/hooks/use-fence-tap-handlers.ts`
- Modify: `.../layout-editor/brush-picker.tsx`, `.../layout-editor/layout-editor-panel.tsx`, `src/features/trade-scenes/constants/layout-editor-copy.ts`, `src/features/trade-scenes/ui/components/layout-kit/layout-lot.tsx`
- Test: `scripts/verify-property-layout.ts` (copy and file checks, lines 633–665)

**Interfaces:**
- Copy:
  ```ts
  tool: { title: 'Tool', ground: 'Ground', fence: 'Fence', hint: 'One drag draws one straight length; a corner is two drags.' },
  fenceLine: { title: 'Fence', length: 'Length', side: 'Side', interior: 'Inside the lot', clear: 'Clear', none: 'None' },
  ```
  `brush.hint` stays for the ground tool. Kind labels come from `FENCE_KINDS[id].label`; side labels from `fences.<side>`; `fences.none` is the perimeter selects' None and `fenceLine.none` the Today row's and card's.
- `BrushRows<Id extends string>` (`brush-rows.tsx`): the presentational two-row segmented picker: `{ narrow, existing: { ids, value, onChange, extras }, proposed: { ids, value, onChange, extras }, labelOf }` where `extras` are the trailing items (`[{ value: 'no-change', label }]`, `[{ value: 'keep', label }, …]`, `[{ value: 'none', label }, …]`); today's row markup and the `NO_CHANGE` / `KEEP` string values move here (Radix reads `''` as nothing chosen).
- `GroundBrushRows({ narrow })`: binds `brush` to `BrushRows` with today's ids and extras (`materialsFor` lives here once; the region card keeps its own copy until a later clean-up, out of scope).
- `FenceBrushRows({ narrow })`: binds `fenceBrush` to `BrushRows` over `FENCE_KIND_IDS` filtered by `sets`, Today with None and No change, Build with Keep and No change.
- `BrushPicker({ narrow })`: the tool as a two-item segmented `ToggleGroup` (`aria-label={copy.tool.title}`) above the rows; renders `<GroundBrushRows narrow />` or `<FenceBrushRows narrow />`; the hint under the rows reads `brush.hint` or `tool.hint` for the tool shown.
- `FenceCard()`: returns null unless `selected?.type === 'fence'`; the line from `resolved.fences`; Today select (kinds with `'existing'` + None), Build select (kinds with `'proposed'` + Keep), both `SelectContent className="dark"`; `dl` with Length (`formatFeet(fenceLengthM(line, tile))`, `data-fence-length`) and Side (`fences[perimeterSideOf(...)]` or `fenceLine.interior`); Clear button disabled when `proposed === null`, writing Keep. A repaint calls `applyFenceStroke(resolved.layout, { axis, indices: fenceLineCells(line, lot) }, brush)`, commits, and re-selects the line at the same seed cell (`fenceLineAt` on `lotFenceLines` of the new layout with `fenceCellMask(lot, massMask(next))`), as the region card does.
- `useFenceTapHandlers(resolved): Pick<ThreeElements['group'], 'onClick'> | null`: in draw mode only; `onClick` with `event.delta <= SCENE_GESTURES.pressTravelPx.touch` (a press that moved is an orbit, not a tap) → `fenceCellNear(origin, lot, event.point.x, event.point.z, tile * FENCE_MESH_TAP_SHARE)` → `fenceLineAt` → `editor.setState({ selected: { type: 'fence', id } })`, `event.stopPropagation()`. `layout-lot.tsx` wraps the fence groups in `<group {...fenceTaps}>`; R3F raycasts a handler group's descendants, so the walls and boards take the tap while `fenceRails` and `chainMesh` keep `ignoreTaps` and pass it to what is behind them. Outside draw mode the group carries no handlers, so the double-tap rule is untouched.
- The panel mounts `<FenceCard />` after `<RegionCard />` and the renamed perimeter fields.

- [ ] **Step 1: Write the failing checks.** Update the copy-section assertion to `['brush', 'fenceLine', 'fences', 'layout', 'mode', 'region', 'tool']`, change the brush-picker label check (line 648) to read `ground-brush-rows.tsx`, and add:

```ts
for (const file of ['brush-rows.tsx', 'ground-brush-rows.tsx', 'fence-brush-rows.tsx', 'fence-card.tsx']) {
  assert.ok(existsSync(`${editorDir}/${file}`), `${file} exists`)
}
const brushRows = readFileSync(`${editorDir}/brush-rows.tsx`, 'utf8')
assert.ok(brushRows.includes('SCENE_VIEW_LABELS.existing') && brushRows.includes('SCENE_VIEW_LABELS.proposed'), 'the shared rows read the view labels')
const fenceRows = readFileSync(`${editorDir}/fence-brush-rows.tsx`, 'utf8')
assert.ok(fenceRows.includes('<BrushRows') && fenceRows.includes('FENCE_KINDS[') && fenceRows.includes('FENCE_NONE') && !/'(Wood|Vinyl|Composite|Wrought|Chain|Block|Low) /.test(fenceRows), 'the fence rows render the shared rows with the kinds\' labels and None, never their own copy')
assert.ok(readFileSync(`${editorDir}/ground-brush-rows.tsx`, 'utf8').includes('<BrushRows'), 'the ground rows render the shared rows')
const brushPickerNow = readFileSync(`${editorDir}/brush-picker.tsx`, 'utf8')
assert.ok(brushPickerNow.includes('GroundBrushRows') && brushPickerNow.includes('FenceBrushRows') && brushPickerNow.includes('LAYOUT_EDITOR_COPY.tool'), 'the brush picker switches the rows by tool')
const fenceCard = readFileSync(`${editorDir}/fence-card.tsx`, 'utf8')
assert.ok(fenceCard.includes('fenceLengthM') && fenceCard.includes('perimeterSideOf') && fenceCard.includes('data-fence-length') && fenceCard.includes('FENCE_NONE') && fenceCard.includes('className="dark"'), 'the fence card shows the length and the side, offers None, and opens its selects in the scoped dark')
const fenceMeasurers = filesUnder('src/features/trade-scenes').filter(path => /\bfenceLengthM\b/.test(readFileSync(path, 'utf8'))).sort()
assert.deepEqual(fenceMeasurers, [`${editorDir}/fence-card.tsx`, 'src/features/trade-scenes/lib/lot-fences.ts'].sort(), 'a fence line\'s length is shown, never passed on')
const fenceTaps = readFileSync('src/features/trade-scenes/hooks/use-fence-tap-handlers.ts', 'utf8')
assert.ok(fenceTaps.includes('onClick') && fenceTaps.includes('event.delta') && !fenceTaps.includes('onPointerDown'), 'a fence mesh selects on a tap, never on a press that became an orbit')
assert.ok(lotFile.includes('useFenceTapHandlers'), 'the lot\'s fence meshes take taps in draw mode')
assert.ok(editorPanel.includes('<FenceCard') && editorPanel.includes('<LotPerimeterFields'), 'the panel mounts the fence card and the perimeter fields')
```

(`lotFile` is re-read after Task 7's edit; `editorPanel` is the existing read.)

- [ ] **Step 2: Run to see it fail.**

- [ ] **Step 3: Build the components and the hook** to the interfaces above.

- [ ] **Step 4: Run the check, tsc, eslint** → ok / 0 / 0.

- [ ] **Step 5: Look** at 1280 × 800 and 760 × 1000 (narrow): the tool toggle, both rows, the fence card with a selected line, in the dark scoped panel. Keep the shots.

- [ ] **Step 6: Commit** the components, the hook, the copy, the panel, the lot, the check: `feat(trade-scenes): the brush picks Ground or Fence, the fence card reads and rewrites a selected line, and a tap on a fence in draw mode selects it`.

---

### Task 8: Live probe, parity, the owner's look list

**Files:**
- Create: `.superpowers/sdd/2026-11-02-scene-layout-l1-l2-lot-as-data/shots/fence/trace.mjs` (never staged)
- Modify (never staged): `.superpowers/sdd/2026-11-02-scene-layout-l1-l2-lot-as-data/shots/task-8/draw.mjs:81-82`, `shots/drift/probe.mjs:99`, `shots/task-9/panel.mjs:38,138` (the selection is `{ type, id }` now and `lot.edges` is gone: read `selected?.type === 'region' && …existing[Number(selected.id)]`, and the perimeter through the fence maps)
- Run: `.superpowers/sdd/2026-11-02-scene-layout-l1-l2-lot-as-data/parity/shots.mjs`; update `parity/report.md`
- Modify (edit only, never staged): `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/trade-scenes/docs/plans/2026-10-16-trade-scenes-epic.md` (Layout row; the absolute path, since `.worktrees/` does not resolve from this worktree and this worktree's own copy of the tracker is the older one), the SDD `progress.md`

**Interfaces:**
- Consumes: `openLab`, `R3F_HOOK`, `pixelDiff`, `scrub` from the workspace's `lib.mjs`; the store install helper copied from `shots/task-8/draw.mjs`.

- [ ] **Step 1: Write `trace.mjs`.** Open the lab with `hasTouch: true`; press D; set `tool: 'fence'` and `fenceBrush: { existing: 'vinylFence', proposed: null }` through the editor store; shoot `before`; with the touchscreen, press at a back-yard point 0.2 m from a grid line and drag 6 cells sideways in 8 steps; after the lift assert through the stores: `stroke === null`, the camera's `drawing === false`, the across map on that line carries `vinylFence` on the dragged cells and nothing else changed (compare the four maps to `before`), `location.href` contains `%22_v%22%3A2`; `pixelDiff(before, after)` over the back yard > 0.5 %; a second trace with a second finger landing mid-drag leaves the camera's position where it was (three decimals) and the stroke closed; a tap on the traced fence's mesh selects it (`selected.type === 'fence'`) and a drag that starts on it does not change the selection. Print each assertion's line; exit non-zero on the first failure.

- [ ] **Step 2: Run it** against the owner's server on 3003: `cd .superpowers/sdd/2026-11-02-scene-layout-l1-l2-lot-as-data/shots/fence && node trace.mjs` → every line `ok`. Re-run the three updated older probes once each; each still passes.

- [ ] **Step 3: Re-run the parity shots** (`node parity/shots.mjs`) and compare each lab shot to its scene shot with `pixelDiff`; the only expected difference is the right side yard's new lower rail. Record the per-case percentages in `report.md` under a "Fences as drawn lengths" heading, with the rail named as the one known difference and its pixel share. Any other difference is a defect: fix it before moving on.

- [ ] **Step 4: Write the owner's look list** at the end of the report: the new kinds' colours, the gate leaf, whether the default side yards should start with a gate leaf, whether posts should be drawn on the wood fence, the seed rows' descriptions and images, whether chain link belongs on the Build row, the whole-side wall now building low through the front yard (F4), and the three shot sets from Tasks 4b and 7.

- [ ] **Step 5: Tracker and ledger.** Add to the epic tracker's Layout row and the SDD `progress.md` one line: fences as drawn lengths built (commit range), wire v2, five seed rows awaiting `pnpm db:seed:dev`, the look list. Do not stage either file.

- [ ] **Step 6: Final checks** at the branch head: the five scene and layout checks, tsc and eslint all pass; report the outputs.

---

## Self-review notes

- **Spec coverage:** §3 words → recorded in the stress test (F1, F2), T1 verifies; §4 maps, `FenceLine`, mask-on-lines, per-cell front-yard cap, proposed-shows-through, mass-face extension, default lot → T2, T3, T4a; §5 kinds/layers/look and catalog → T1, T4b; §6 tool, trace, tap, erase (None and Keep), per-side perimeter, undo → T4a, T6, T7; §7 wire v2, v1 rejected, re-tile scatter, URL length → T2, T4a; §8 checks → T2–T7, live probe and parity → T8; §9 builder items left open as named; §11 rulings F1–F11 folded.
- **Types:** `LineRange` (T2) is the shape `lineRangeBetween` returns (T6) and `applyFenceStroke` takes (T6); `GridVertex` (T6) is the stroke's endpoint shape; `FenceBoxes` keys named in T4a are the ones T4b's `listOf` reads; `EditorSelection` (T6) is what T7's card and T6's outlines read; `fenceLineCells(line, lot)` (T3) feeds the card's repaint (T7); `fenceMask` (T3) feeds the boxes (T4a) and the card (T7).
- **Stress-test findings folded (2026-11-04):** codec in T2 (blocker); along-call argument order (blocker); re-tile scatter; per-cell cap; parity by nearest box; link bound 2,000 with the line-major along map; `FENCE_NONE`; T5 into T4a; vinyl grade check on tall parts only; `paintTiles`/`paintList` reused; fence mask passed down; helpers moved to `lot-box-parts.ts`; `pushGradeQuad` shared; `LAYOUT_EDITOR_LOOK` and `FenceKind.look`; typed catalog accessors and seed arrays in the check; `perimeterKindsFor`; rails toward the interior; tap fallback through `tileAt`; mesh selection on click with a travel limit; the two existing check lines named; CRLF rule; older probes updated; tracker path absolute; `GridVertex`, `LineRange`, `sideYardRow`, `fenceLine` copy key; chain-mesh opacity rationale corrected.
- **Proportion:** the plan's code is assertions and signatures; no body is written except the rules the signatures do not determine (re-tile scatter, snapping, the rail side, the per-cell cap split).
