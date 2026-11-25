# Scene layout L1 + L2: the lot as data, and the lot editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `PropertyLayout` (tile grid, ground materials today and proposed, fences per side, masses) drives the lot of the trade scene in a new lab page, where a rep draws tile-snapped regions with a finger and sees their perimeter and area; on the default layout the lab looks like today's scene.

**Architecture:** Pure code (types, constants, a resolver, tile-map and region functions, a codec) under `F/lib` and `F/constants` turns a `PropertyLayout` into world rectangles, region outlines and box lists. A `layout-kit/` beside `home-kit/` draws the lot from it: one ground strip on the grade, one merged strip mesh per ground material per layer, outlines and a drag preview in draw mode. The working scene changes in eight small, guarded hunks (a `layout` input, a lot slot, an optional store prop, a `drawing` flag on the scene camera store, the lot's box helpers moved to their own file, three assertions); the house and the garage are still drawn by today's components, placed by today's constants, and the layout's main mass is anchored to them. L3 makes the house itself data.

**Tech Stack:** Next.js 15, React Three Fiber 9.8, drei 10.7, three 0.180, zustand, zod. Checks are `tsx` assertion scripts (no test runner in this repo).

**Spec:** `docs/superpowers/specs/2026-11-02-scene-layout-design.md` (approved 2026-11-02, stress-tested and amended the same day: §15 holds the rulings S1–S4; §5 model, §6 resolve, §7 materials, §8 editor, §11 lab and parity, §12 phasing). Research: `docs/plans/2026-11-02-trade-scene-layout-research.md`. Tracker rows R206–R214 in `docs/plans/2026-10-16-trade-scenes-epic.md`.

Abbreviations: `F/` = `src/features/trade-scenes/`. "Layout check" = `pnpm tsx scripts/verify-property-layout.ts`. "Kit check" = `pnpm tsx scripts/verify-layout-kit.ts`. "Scene check" = `pnpm tsx scripts/verify-trade-scene.ts`. "Lot check" = `pnpm tsx scripts/verify-trade-scene-lot.ts`. "Types and lint" = `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock pnpm tsc` and `flock … env CI=1 pnpm eslint <every file created or modified>`.

## Global Constraints

- **Worktree:** `feat/scene-layout-lab` off `feat/trade-scenes-foundation` (S2: the owner's ruling at the stress test; the spec's earlier "off the ship branch" is superseded), created by the controller before Task 1 (see "Before Task 1"). Everything in this plan lands there. Never edit `.worktrees/trade-scenes`. The branch merges `origin/main` into itself after the ship squash; never rebase.
- **The working scene changes only in these hunks** (spec §11, O9, S1): `F/types.ts` (appended types and the `layout` field on `TradeSceneInputs`), `F/constants/home-scene-defaults.ts` (`layout: DEFAULT_LAYOUT`), `F/ui/components/home-kit/home-kit.tsx` (the lot slot, Task 5), `F/ui/views/trade-scene-view.tsx` (the optional `inputs` prop, Task 7), `F/lib/lot-height-at.ts` (delegates to `heightOnRows`, Task 4), `F/constants/home-lot.ts` (`STREET_BAND = { sidewalk: 1.52, parkway: 2.13, street: 11.0 }`, which `STREET_Z` is then built from; `FAR_RISE` and `GRADE.curb` are already exported and stay the single source of those two figures, Task 4), `F/lib/lot-boxes.ts` (its private `run`, `onGrade`, `fromPadToSidewalk`, `boards`, cap and street helpers move to a new `F/lib/lot-box-parts.ts` and it imports them; `lotBoxes()` returns the same boxes to the millimetre and the lot check guards it, Task 4), the scene camera's `drawing` flag (`src/shared/components/scene/types.ts` `SceneCameraState.drawing: boolean`, `lib/create-scene-camera.ts` defaults it `false` and exports `setSceneCameraDrawing(store, drawing)`, `ui/camera-rig.tsx` feeds `enabled && !drawing` to `useSceneTaps` and `useCameraWheel` and `!drawing` to `OrbitControls`' `enabled`; Task 8), `scripts/verify-trade-scene.ts` (`'schemas'` joins the tier guard's folder list and three assertions are added, Task 5). Anything else under `home-kit/`, `controls/`, `home-scene-canvas.tsx` is not touched; if a task seems to need it, stop and report.
- **Names are the glossary's** (R214): `PropertyLayout`, tile, region, ground material, mass, face, draft, lot edge, gate. Never `SceneLayout` (`F/constants/scene-layout.ts` is the controls' chrome), never zone, cell, surface, module, auto-layout, return. The lab's files and components say property layout (`PropertyLayoutLabView`, `property-layout-lab-view.tsx`, "Property layout lab"); only the route `/dashboard/labs/scene-layout` keeps the name R211 agreed. The lot's two layers are `existing` and `proposed` in code (S3: the scene's `view` axis, so no mapping), "Today" and "Tri Pros build" in copy through `SCENE_VIEW_LABELS`; `today` never appears as a code name. The fence across a side yard is a gate (`LotGate`), as `LOT.gateZ` already says.
- **`LAYOUT_TILE` is the only place 0.6096 appears.** Every metre comes from `layout.tile` through `metresOf` / `tilesOf` (`F/lib/tile-units.ts`: helpers never live in `constants/`, where no file exports a function). The layout check greps for the literal and excludes itself; it pins the value as `near(LAYOUT_TILE * FEET_PER_METRE, 2, 1e-3)`.
- **No three.js** in `F/lib/`, `F/constants/`, `F/schemas/` or `F/types.ts`, type-only imports included. The scene check's tier guard scans `lib/` and `constants/` plus `types.ts` today; Task 5 adds `'schemas'` to its folder list once Task 3 has created the folder. R3F types (`ThreeElements`) stay under `ui/` and `hooks/`. Geometry builders go under `F/ui/lib/`.
- **No import cycle:** `layout-fixtures.ts` reads `home-geometry.ts` and `home-lot.ts`; neither may import anything under the layout files.
- Never `pnpm build`. Never start a dev server: the owner runs `pnpm dev` in the lab worktree; its port is `PORT=` in that worktree's `.env.local`. Shots and probes sign in with `/api/dev/playwright-session?secret=…&as=info%40triprosremodeling.com&redirect=<route>`, never `role=`; read the secret the way `.superpowers/sdd/2026-11-01-ts3b6a-lot-and-light/lib.mjs` does.
- Commit by explicit path. Never `git add -A`, never bare `git stash`, never `git reset` or `git checkout` of another path, never `git commit --amend` in any form (a wrong trailer gets a ledger line). Never stage `CONTEXT.md` or `docs/**` (the controller does). `git diff --shortstat` after any scripted edit.
- Every geometry a component builds goes through `useOwnedGeometry`; every texture is disposed on unmount. Box lists handed to `MergedBoxes` are memoized.
- **Budget is measured, never a number** (spec §11): the lab on the default layout draws no more calls and triangles than `/dashboard/trade-scene` on the same inputs, measured by the same probe in the same session (Task 10).
- Areas and perimeters are shown, never passed to anything that prices or scopes (R206). No function in this plan takes an area as an input.
- Comments say why, never what. No banners, no citing the spec or plan from code.

## Review Focus

1. **A drag that leaves the canvas or the lot.** Pointer capture ends the stroke on pointer-up wherever it lands; the rectangle is clamped to the lot and clipped out of every mass; a stroke that starts outside the lot or on a mass paints nothing. Task 8 asserts `rectBetween` clamps and `paintTiles` clips, and the Playwright pass drags off-canvas once.
2. **A second finger lands mid-stroke** (a pinch to zoom while drawing). The stroke is cancelled, nothing is painted, the camera's gestures come back and the preview disappears. With `touch-action: none` (three's `OrbitControls` already sets it on the canvas) the browser fires no `pointercancel` for a pinch, and a second finger that lands on the house never reaches the ground mesh, so Task 8 cancels from a document-level `pointerdown` listener on any non-primary pointer and ignores non-primary moves and ups.
3. **A hostile or old `?layout=`.** Wrong lengths, unknown material ids, a mass outside the lot, a different tile size: the decode returns `null` (or the re-tiled layout for a tile mismatch) and the lab opens on `DEFAULT_LAYOUT` without throwing. Task 3's checks feed each case through `decodePropertyLayout`.
4. **No proposals yet.** With every proposed tile `0` (keep), the build view renders exactly the existing view; flipping Today / Tri Pros Build changes nothing on the lot, and painting the build row's Keep over a turf region takes the turf away again (Keep paints `PROPOSED_KEEP`; "No change" is the brush state that leaves the layer alone). Task 6 asserts the proposed-layer picker falls back to the existing id, Task 8 asserts the Keep stroke, and Task 10 shots both views on the default layout.
5. **Tiles under the house.** Tiles under a mass are never painted and never drawn; the strip between a mass edge and the house's wall (a tile does not divide 12 × 8 m) stays under one tile wide, and the lot's right edge snaps 0.2 m out (one more fence board on the right return: a known difference, Task 10). Task 1 asserts the alignment bound; Task 2 asserts the mask; Task 10's shots look at the wall foot.

---

## Before Task 1 (controller)

- [ ] Create the worktree from the repo root with absolute paths: `git -C /home/olis-solutions/olis-v3/nextjs/tri-pros-website worktree add /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/scene-layout-lab -b feat/scene-layout-lab feat/trade-scenes-foundation` (S2). A plain `git worktree add` does not apply `.worktreeinclude`: copy `.env`, `.env.local` and `.claude/settings.local.json` in by hand, then set `PORT=` in `.env.local` to the next port that no sibling worktree's `.env.local` holds and nothing listens on (`orca.yaml`'s rule: today 3001–3005 are held, so 3006). Run `pnpm install` there.
- [ ] Copy into it and commit as docs: `docs/superpowers/specs/2026-11-02-scene-layout-design.md`, `docs/plans/2026-11-02-trade-scene-layout-research.md`, this plan. Commit message: `docs(trade-scenes): the scene layout design, research and L1+L2 plan`.
- [ ] Create `.superpowers/sdd/2026-11-02-property-layout-l1-l2/` with `progress.md`. `.superpowers/` is gitignored, so copy the probes from the absolute path `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/trade-scenes/.superpowers/sdd/2026-11-01-ts3b6a-lot-and-light/{lib.mjs,perf.mjs}` and parametrise them before any task shoots: `lib.mjs` hardcodes port 3002, the deleted `labs/trade-scene` route and absolute imports into the trade-scenes worktree; it must take `WORKTREE` (root, for playwright and the secret in that root's `.env.local`), `PORT` and `LAB_ROUTE` from the environment. Smoke it once against `/dashboard/trade-scene` on the lab worktree's port.

---

### Task 1: The layout types, the grid, the ground materials and the default layout

**Files:**
- Create: `F/constants/layout-grid.ts`, `F/lib/tile-units.ts`, `F/constants/ground-materials.ts`, `F/lib/ground-material-at.ts`, `F/constants/layout-fixtures.ts`, `F/lib/default-layout.ts`, `scripts/verify-property-layout.ts`
- Modify: `F/types.ts` (append)

**Interfaces:**
- Produces (in `F/types.ts`):
  ```ts
  export type RoofShape = 'gable' | 'hip' | 'flat'
  export type MassRole = 'main' | 'wing' | 'garage'
  export interface TileRect { c0: number, r0: number, cols: number, rows: number }
  export interface Mass extends TileRect { id: string, stories: 1 | 2, ridgeAxis?: 'x' | 'z', role: MassRole }
  export type LotSide = 'left' | 'right' | 'back' | 'front'
  export type LotEdgeKind = 'blockWall' | 'lowWall' | 'woodFence' | 'none'
  // `from`/`to` are tile indices along the side: columns on front/back, rows on left/right; `to` exclusive.
  export interface LotEdge { side: LotSide, kind: LotEdgeKind, from: number, to: number }
  // The fence that closes a side yard, from the house's face to the lot wall, at a row.
  export interface LotGate { side: 'left' | 'right', row: number, kind: 'woodFence' | 'blockWall' }
  export interface LotGrade { padEndRow: number, walkDrop: number, streetDrop: number }
  export interface LotLayout { cols: number, rows: number, existing: Uint8Array, proposed: Uint8Array, edges: readonly LotEdge[], gates: readonly LotGate[], grade: LotGrade }
  export interface RoomStandIn { massId: string, kind: 'living' | 'kitchen' | 'bed' | 'bath', span: TileRect, story: 1 | 2 }
  export interface HouseLayout { masses: readonly Mass[], roof: RoofShape, foundation: FoundationType, rooms: readonly RoomStandIn[] }
  export interface DraftProvenance { address: string, imageryDate: string | null, sources: readonly string[], confidence: number }
  export type LayoutSource = 'default' | 'drafted' | 'edited'
  export interface PropertyLayout { version: 1, tile: number, lot: LotLayout, house: HouseLayout, source: LayoutSource, draft?: DraftProvenance }
  export type GroundMaterialId = typeof GROUND_MATERIAL_IDS[number]
  export type GroundLayer = TradeSceneInputs['view']   // 'existing' | 'proposed' (S3)
  ```
  `FoundationType` is the construction core's. A tile's value in `existing`/`proposed` is `0` (unset / keep) or `GROUND_MATERIAL_IDS.indexOf(id) + 1`. `GroundHandlers` (R3F) is not here: it lives beside `LayoutGround` (Task 6).
- Produces (`F/constants/layout-grid.ts`): `LAYOUT_TILE = 0.6096`; `FEET_PER_METRE = 3.28084`. Produces (`F/lib/tile-units.ts`): `metresOf(tiles: number, tile: number): number`; `tilesOf(metres: number, tile: number): number` (rounds to the nearest whole tile).
- Produces (`F/constants/ground-materials.ts`): `GROUND_MATERIAL_IDS = ['sod', 'dirt', 'concrete', 'asphalt', 'pavers', 'gravel', 'mulch', 'turf', 'pool', 'dg', 'river-rock'] as const`; `GROUND_MATERIALS: Record<GroundMaterialId, GroundMaterial>` with `GroundMaterial = { label: string, sets: readonly GroundLayer[], look: { color: string, roughness: number, raise: number, texture?: 'lawn' }, catalog?: { scopeAccessor: string, materialAccessor: string } }`; `GROUND_MATERIAL_INDEX: Record<GroundMaterialId, number>` (id → tile value); `PROPOSED_KEEP = 0`. Produces (`F/lib/ground-material-at.ts`): `groundMaterialAt(value: number): GroundMaterialId | null`. Sets: existing = sod, dirt, concrete, asphalt, pavers, gravel, mulch, turf, pool; proposed = turf, mulch, gravel, dg, river-rock, concrete, pavers (R212; pool existing-only). Ids stay short words and **every proposed id carries a `catalog` link** (S4; a material accessor is per variant, so an id cannot be one accessor): turf → `installArtificial` + `artificialTurf`, mulch → `installMulch` + `redMulch` (black is a look variant later), gravel → `installGravel` + `gravel`, dg → `installDg` + `decomposedGranite`, river-rock → `installGravel` + `riverRocks` (no scope of its own in the seed), concrete → `installConcrete` + `concrete`, pavers → `installPavers` + `pavers`; read them in `src/shared/db/seeds/data/scopes.ts` (`dryscapingHardscaping`) and `materials.ts`, do not invent. Looks that must match today's scene: `sod` texture `lawn` (the ground strip is the sod), `concrete.color = HOME_PALETTE.path`, `asphalt.color = LOT_PALETTE.asphalt`, `mulch.color = LOT_PALETTE.mulch`; `raise` 0.04 for concrete and pavers (today's `SLAB`), 0.03 mulch, 0.02 gravel/dg/river-rock/dirt, 0.015 turf; **pool is a flat water-blue strip at `raise` 0.005 in L2** (a strip sunk under the opaque lawn would never show; the recess and coping come with objects, after L2). The other colours are working numbers tuned by eye in Task 10.
- Produces (`F/lib/default-layout.ts`): `defaultLayout(tile: number): PropertyLayout`, today's scene as a layout: lot `cols = tilesOf(LOT.right - LOT.left, tile)`, `rows = tilesOf(LOT.front - LOT.back, tile)`; main mass `c0 = tilesOf(-HOUSE.halfLength - LOT.left, tile)`, `r0 = tilesOf(LOT.front - HOUSE.halfDepth, tile)`, `cols = tilesOf(2 * HOUSE.halfLength, tile)`, `rows = tilesOf(2 * HOUSE.halfDepth, tile)`, `id: 'main'`, `stories: 1`, `role: 'main'`; garage mass from `GARAGE` the same way, `id: 'garage'`, `role: 'garage'`; `roof: 'gable'`, `foundation: 'raised'`, `rooms` = today's three (`ROOMS` spans along the main mass, full depth, story 1); a metre rectangle becomes tiles as `c0 = tilesOf(x0 - LOT.left)`, `c1 = tilesOf(x1 - LOT.left)`, `r0 = tilesOf(LOT.front - zNear)`, `r1 = tilesOf(LOT.front - zFar)` (ends exclusive); `existing` = all `sod`, then the driveway (`GARAGE.x0 + 0.15 .. GARAGE.x1 - 0.15`, from the garage face `GARAGE.z1` to the lot front) and the walk (`WALK.x0 .. WALK.x1`, from the stoop's far edge `HOUSE.halfDepth + 0.9` to the lot front) `concrete`, the three mulch beds of `lot-boxes.ts` `mulch`; `proposed` all `0`; edges: left and right `blockWall` from the back to the gate row, back `blockWall` full width, left `lowWall` from the gate row to the front, right `none` in front of the gate (the garage closes it), front `none`; gates: left and right `woodFence` at the gate row (`tilesOf(LOT.front - LOT.gateZ, tile)`); grade `padEndRow = tilesOf(LOT.front - GRADE.padEnd, tile)`, `walkDrop = -GRADE.walk`, `streetDrop = -GRADE.street`; `source: 'default'`. On a 2 ft tile this is a 37 × 55 grid, main mass at tile (4, 10) 20 × 13, garage at (24, 10) 10 × 11.
- Produces (`F/constants/layout-fixtures.ts`): `DEFAULT_LAYOUT = defaultLayout(LAYOUT_TILE)`; `LAYOUT_FIXTURES: Record<'ranch', PropertyLayout> = { ranch: DEFAULT_LAYOUT }` (L3 adds the L, the T and the flat slab home).

- [ ] **Step 1: Write the failing layout check.** Create `scripts/verify-property-layout.ts` in `verify-trade-scene-lot.ts`'s style (`near(actual, expected, tolerance, label)`, `console.log('verify-property-layout: ok')` at the end). Assert:
  - `near(LAYOUT_TILE * FEET_PER_METRE, 2, 1e-3)` (the literal never appears in the check); `near(metresOf(tilesOf(12, LAYOUT_TILE), LAYOUT_TILE), 12, LAYOUT_TILE / 2)`.
  - `GROUND_MATERIAL_IDS.length === 11`; every id has a label, at least one set, a `look.color` matching `/^#[0-9a-f]{6}$/`; `'pool'` is in `existing` only; **every** `proposed` id has a `catalog`; every `catalog.scopeAccessor` appears in `readFileSync('src/shared/db/seeds/data/scopes.ts')` and every `materialAccessor` in `materials.ts`; `GROUND_MATERIAL_INDEX.sod === 1`; `groundMaterialAt(0) === null`; `pool.look.raise > 0`.
  - **The literal lives once:** grep every `.ts`/`.tsx` under `F/` and `scripts/` except this check: `0.6096` appears only in `F/constants/layout-grid.ts`.
  - `DEFAULT_LAYOUT`: `existing.length === cols * rows === proposed.length`; `proposed.every(v => v === 0)`; `house.masses.length === 2`, exactly one `role: 'main'`; the main mass's offsets inside the lot match today's: `near(metresOf(main.c0, tile), -HOUSE.halfLength - LOT.left, LAYOUT_TILE)`, `near(metresOf(main.r0, tile), LOT.front - HOUSE.halfDepth, LAYOUT_TILE)`, `near(metresOf(main.cols, tile), 2 * HOUSE.halfLength, LAYOUT_TILE)`, rows likewise; the garage mass matches `GARAGE` the same way within `LAYOUT_TILE`; `near(metresOf(cols, tile), LOT.right - LOT.left, LAYOUT_TILE)` and the same for rows; the count of `concrete` tiles is within 10% of `(driveway area + walk area) / tile²` computed from `GARAGE`, `WALK`, `LOT.front`, `HOUSE.halfDepth` (118 on the 2 ft grid); the three mulch beds give three separate runs (Task 2 turns this into a region count); masses are not painted, so `existing` under every mass tile is `sod`; `edges` hold exactly one `lowWall` and three `blockWall`s; `gates.length === 2`; `source === 'default'`; `tile === LAYOUT_TILE`.
- [ ] **Step 2: Run the layout check.** Expected: FAIL, cannot resolve `@/features/trade-scenes/constants/layout-grid`.
- [ ] **Step 3: Implement** the four files and append the types to `F/types.ts`. `defaultLayout` paints rectangles by writing the tile map directly (Task 2's `paintTiles` does not exist yet; keep a private `fill(map, cols, rect, value)` here and replace it with `paintTiles` in Task 2).
- [ ] **Step 4: Run the layout check.** Expected: `verify-property-layout: ok`. Scene check ok (no three.js in the new files). Types and lint exit 0.
- [ ] **Step 5: Commit** by path: `feat(trade-scenes): the property layout types, the tile grid, the ground materials and today's scene as the default layout`.

### Task 2: Tile-map operations and regions

**Files:**
- Create: `F/lib/paint-tiles.ts`, `F/lib/mass-mask.ts`, `F/lib/lot-regions.ts`, `F/lib/region-rings.ts`
- Modify: `F/lib/default-layout.ts` (use `paintTiles`), `F/types.ts` (append `LotRegion`), `scripts/verify-property-layout.ts`

**Interfaces:**
- Consumes: Task 1's types and `DEFAULT_LAYOUT`.
- Produces:
  - `paintTiles(map: Uint8Array, cols: number, rows: number, rect: TileRect, value: number, mask?: Uint8Array): Uint8Array` — a new array; `rect` clamped to the grid; tiles where `mask[i] === 1` keep their value; returns the same instance when nothing changes.
  - `massMask(layout: PropertyLayout): Uint8Array` — `1` under any mass, else `0`.
  - `rectBetween(a: readonly [number, number], b: readonly [number, number]): TileRect` — the inclusive rectangle between two tiles in either drag direction.
  - `regionRings(tiles: ReadonlySet<number>, cols: number): readonly (readonly [number, number])[][]` — boundary-edge chaining over tile corners: the outer ring first (counter-clockwise in tile space), holes after (clockwise); collinear corners dropped.
  - `lotRegions(lot: LotLayout, mask: Uint8Array): readonly LotRegion[]` with
    ```ts
    export interface LotRegion { id: string, existing: GroundMaterialId | null, proposed: GroundMaterialId | null, tiles: number, rings: readonly (readonly [number, number])[][], bbox: TileRect }
    ```
    A region is one 4-connected component of tiles sharing the pair (`existing` value, `proposed` value), excluding masked tiles and tiles with `existing === 0`. `id` = `${firstTileIndex}` (stable while the first tile stays). Order: by `bbox.r0`, then `bbox.c0`.
  - `regionAt(regions: readonly LotRegion[], lot: LotLayout, mask: Uint8Array, col: number, row: number): LotRegion | null` — the region whose component holds the tile; builds the component map once per `regions` instance (a `Int32Array` cached in a `WeakMap`).
  - `regionPerimeterM(region: LotRegion, tile: number): number` (sum of ring edge lengths × tile) and `regionAreaM2(region: LotRegion, tile: number): number` (`tiles × tile²`). Display only (R206): these two are the only callers' source of ft and sq ft.

- [ ] **Step 1: Add the failing checks** to `scripts/verify-property-layout.ts`:
  - `paintTiles` on a 4 × 3 map: a rect `{c0: 2, r0: 1, cols: 5, rows: 5}` paints only the 2 × 2 inside the grid; a masked tile keeps its value; painting the same value twice returns the same instance the second time; the input array is never mutated.
  - `rectBetween([3, 4], [1, 2])` equals `{ c0: 1, r0: 2, cols: 3, rows: 3 }`.
  - `regionRings` of a 2 × 2 block at the origin on `cols = 4` is one ring of four corners `[[0,0],[2,0],[2,2],[0,2]]` (orientation as defined); an L of three tiles gives six corners; a 3 × 3 block with its centre missing gives two rings, the hole second with four corners.
  - `lotRegions` on a 6 × 4 lot: two separate `mulch` blocks are two regions; a `sod` block touching a `mulch` block are two regions; a block whose proposed differs splits the region; `regionAt` returns the right region for a tile inside each and `null` on a masked tile.
  - On `DEFAULT_LAYOUT` with `massMask`: `massMask` has exactly `main.cols × main.rows + garage.cols × garage.rows` ones; `lotRegions` has exactly **two** `sod` regions (the lawn between the walk and the driveway is an island: the walk, the house, the garage and the driveway close it off, as on the real lot; the larger holds ≥ 1,400 tiles, the island ≤ 100); **every region's `rings.length === 1`** (the beds abut the house mask and the lot edge, the walk and the driveway reach the front row, so nothing is an enclosed hole; the hole case is the synthetic 3 × 3 above); two `concrete` regions (driveway, walk; the driveway's `bbox.cols === tilesOf(GARAGE.x1 - GARAGE.x0 - 0.3, LAYOUT_TILE)`), three `mulch` regions; `near(regionAreaM2(driveway, LAYOUT_TILE), (GARAGE.x1 - GARAGE.x0 - 0.3) * (LOT.front - GARAGE.z1), 2 * LAYOUT_TILE * (LOT.front - GARAGE.z1))`; `regionPerimeterM` of a 2 × 3 block equals `10 × tile`.
- [ ] **Step 2: Run the layout check.** Expected: FAIL on the first new import.
- [ ] **Step 3: Implement** the four lib files; replace `default-layout.ts`'s private fill with `paintTiles`.
- [ ] **Step 4: Run the layout check.** Expected ok. Scene check ok. Types and lint 0.
- [ ] **Step 5: Commit** by path: `feat(trade-scenes): tile painting, the mass mask and regions with rings, perimeter and area`.

### Task 3: The wire shape, the codec and re-tiling

**Files:**
- Create: `F/schemas/property-layout.ts`, `F/lib/layout-codec.ts`, `F/lib/retile-property-layout.ts`
- Modify: `scripts/verify-property-layout.ts`

**Interfaces:**
- Produces:
  - `propertyLayoutWireSchema` (zod) for the JSON the URL and, later, `sceneLayoutJSON` carry: `{ _v: 1, t: number, lot: { c, r, existing: string, proposed: string, edges, gates, grade }, house, source, draft? }` where `existing`/`proposed` are run-length strings `"1*220,3*12,1*40"` (value × count, comma-separated); `_v` is the persisted-blob version key the JSONB convention asks for. Edge kinds, sides, roles, roof shapes and sources are enums; masses have non-negative integers.
  - `encodePropertyLayout(layout: PropertyLayout): string` — the compact JSON string.
  - `decodePropertyLayout(text: string, tile: number): PropertyLayout | null` — parses, validates with the schema, expands the runs, checks `existing.length === proposed.length === c × r`, every tile value `< GROUND_MATERIAL_IDS.length + 1`, every mass inside the lot and no two masses overlapping, exactly one `main`; re-tiles when `t !== tile`; `null` on any failure, never throws.
  - `retilePropertyLayout(layout: PropertyLayout, tile: number): PropertyLayout` — nearest-neighbour resample of both maps, indices of masses, edges, gates, rooms and `grade.padEndRow` scaled by `layout.tile / tile` and rounded; `tile` set; a same-tile call returns the input.

- [ ] **Step 1: Add the failing checks:** `decodePropertyLayout(encodePropertyLayout(DEFAULT_LAYOUT), LAYOUT_TILE)` deep-equals `DEFAULT_LAYOUT` (compare `Array.from` of the maps); `encodePropertyLayout(DEFAULT_LAYOUT).length < 2000`; decode returns `null` for: not JSON, a run string whose total is `c × r − 1`, a tile value of `99`, a mass with `c0 + cols > c`, two overlapping masses, two `main`s; `retilePropertyLayout(DEFAULT_LAYOUT, LAYOUT_TILE / 2)` has four times the tiles, the same number of `concrete` tiles × 4 within 2%, and re-tiling it back gives the main mass's `TileRect` unchanged; `decodePropertyLayout` of a layout encoded at `LAYOUT_TILE / 2` returns one with `tile === LAYOUT_TILE`.
- [ ] **Step 2: Run the layout check.** Expected: FAIL.
- [ ] **Step 3: Implement** the three files. `zod` is imported as `import { z } from 'zod'`.
- [ ] **Step 4: Run the layout check.** Expected ok. Scene check ok (the three.js guard scans `lib/` and `constants/`; `schemas/` holds no three either). Types and lint 0.
- [ ] **Step 5: Commit** by path: `feat(trade-scenes): the property layout's wire shape, codec and re-tiling`.

### Task 4: The resolver: a layout in the world

**Files:**
- Create: `F/lib/lot-box-parts.ts`, `F/lib/resolve-property-layout.ts`, `F/lib/height-on-rows.ts`, `F/lib/layout-ground-rows.ts`, `F/lib/layout-lot-boxes.ts`, `F/lib/tile-at.ts`
- Modify: `F/lib/lot-boxes.ts` (composes `lot-box-parts.ts`; same output), `F/constants/home-lot.ts` (`STREET_BAND`), `F/lib/lot-height-at.ts` (delegate), `F/types.ts` (append), `scripts/verify-property-layout.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces (`F/types.ts`):
  ```ts
  export interface LotOrigin { originX: number, frontZ: number, tile: number }   // not "frame": that word is the presentation's
  export interface WorldRect { x0: number, x1: number, z0: number, z1: number }
  export interface LotBounds { left: number, right: number, front: number, back: number }
  export type LayoutLotBoxes = Omit<LotBoxes, 'concreteJoints' | 'mulch'>   // the stoop and the driveway apron ride in `concrete`, as today
  export interface ResolvedLayout { origin: LotOrigin, bounds: LotBounds, groundRows: readonly (readonly [number, number])[], heightAt: (z: number) => number, mask: Uint8Array, regions: readonly LotRegion[], main: WorldRect, garage: WorldRect | null, boxes: LayoutLotBoxes }
  ```
- Produces:
  - `lot-box-parts.ts` (pure, first step of this task): `run(x0, z0, x1, z1, height, thickness): BoxSpec`, `onGrade(heightAt, x0, x1, z0, z1, thickness, raise?)`, `padToFront(heightAt, padEnd, front, x0, x1, zStart, thickness, raise?)` (today's `fromPadToSidewalk`), `boards(x0, x1, z, height)`, `capsOf(walls, cap)` (today's cap mapping), `streetBand(front, grade): { concrete: BoxSpec[], asphalt: BoxSpec[] }` (the two sidewalks, two curbs, two gutters and the asphalt from a front edge, with `STREET_BAND`, `FAR_RISE` and `GRADE`). `lot-boxes.ts` keeps its exports and composes these with `lotHeightAt`, `GRADE.padEnd` and `LOT.front`; `lotBoxes()` returns the same boxes to the millimetre (the lot check's literal assertions prove it).
  - `heightOnRows(rows: readonly (readonly [z: number, y: number])[], z: number): number` — today's `lotHeightAt` body, generalised. `lot-height-at.ts` becomes `export const lotHeightAt = (z: number) => heightOnRows(GROUND_ROWS, z)`.
  - `layoutGroundRows(layout: PropertyLayout, origin: LotOrigin): readonly (readonly [number, number])[]` — the same ten rows `home-lot.ts` builds, from `bounds.front`, `grade.padEndRow`, `walkDrop`, `streetDrop`, `STREET_BAND` (`home-lot.ts` gains `export const STREET_BAND = { sidewalk: 1.52, parkway: 2.13, street: 11.0 } as const` and builds `STREET_Z` from it; the private `SIDEWALK`/`PARKWAY`/`STREET` consts go), `FAR_RISE` and `GRADE.curb` (both already exported; never copied into `STREET_BAND`).
  - `lotOrigin(layout: PropertyLayout): LotOrigin` — the main mass's front-left corner sits at `(-HOUSE.halfLength, HOUSE.halfDepth)` (L1: the house is drawn by today's constants): `originX = -HOUSE.halfLength - metresOf(main.c0, tile)`, `frontZ = HOUSE.halfDepth + metresOf(main.r0, tile)`. Tile `(c, r)` spans `x ∈ [originX + c·tile, originX + (c + 1)·tile]`, `z ∈ [frontZ − (r + 1)·tile, frontZ − r·tile]`; row 0 is the street side.
  - `tileAt(origin: LotOrigin, lot: LotLayout, x: number, z: number): readonly [col: number, row: number] | null` — `null` outside the lot.
  - `worldRectOf(origin: LotOrigin, rect: TileRect): WorldRect`.
  - `layoutLotBoxes(layout: PropertyLayout, origin: LotOrigin, bounds: LotBounds, heightAt: (z: number) => number): LayoutLotBoxes` — composed from `lot-box-parts.ts`: edges → walls (`blockWall` 1.83 high with caps; `lowWall` on the grade through `padToFront`, body + cap ≤ 1.07; `woodFence` boards + rails; `none` nothing); **the front edge never stands taller than 42 in (R130): a front `blockWall` is built as a `lowWall` and a front `woodFence`'s boards are `LOT.frontFence` high**; gates → boards + rails from the house face (`-HOUSE.halfLength` on the left, `GARAGE.x1` on the right in L1) to the lot wall at the gate row's z; the street band from `streetBand(bounds.front, …)`; **the driveway apron by rule**: every run of paved tiles (`concrete`, `pavers` or `asphalt`) on row 0 at least 4 tiles wide continues across the parkway to the curb as one box 1.2 m wider than the run (today's apron), in the run's material list; `stoop` = today's stoop box (`[1.9, 0.14, 0.9]` at `[-0.6, 0.07, HOUSE.halfDepth + 0.45]`) inside `concrete`. No driveway, walk, joints or mulch boxes: those are regions now.
  - `resolvePropertyLayout(layout: PropertyLayout): ResolvedLayout` — composes the above; `heightAt = z => heightOnRows(groundRows, z)`; `regions = lotRegions(layout.lot, mask)`.

- [ ] **Step 0: Extract the box parts.** Create `F/lib/lot-box-parts.ts` from `lot-boxes.ts`'s private helpers and make `lot-boxes.ts` compose them (`SIDEWALK` there reads `STREET_BAND.sidewalk`). Run the lot check: ok, unchanged. Types and lint 0. Commit by path: `refactor(trade-scenes): the lot's box helpers move to lot-box-parts.ts, so a layout can build the same walls and street`.
- [ ] **Step 1: Add the failing checks:** on `resolvePropertyLayout(DEFAULT_LAYOUT)`: `near(bounds.left, LOT.left, LAYOUT_TILE)`, right, front, back likewise; `main` equals `{ x0: -6, x1: ≈6, z0: ≈-4, z1: 4 }` within `LAYOUT_TILE` and `near(x0, -HOUSE.halfLength, 1e-9)`, `near(z1, HOUSE.halfDepth, 1e-9)`; `garage` matches `GARAGE` within `LAYOUT_TILE`; `heightAt(0) === 0`, `heightAt(bounds.front - 1e-9)` within 0.02 of `GRADE.walk`, the street's middle equals `GRADE.street`; `groundRows.length === GROUND_ROWS.length`; `boxes.blockWalls.length === 3 + lowWallParts` where the low wall's top with its cap stays ≤ 1.07 above `heightAt` at its centre z (R130); every `blockWall` box is 1.83 high; **each gate's board count equals `boards()` over that gate's own span** (the right gate has one board more than today's, the lot's right edge having snapped 0.2 m out: `|lab − today| ≤ 1` per side) and `fenceRails.length === 3`; `boxes.concrete` holds the six street boxes, the apron and the stoop (eight) and `asphalt` one; the apron's width is the driveway run's width + 1.2 and it spans `bounds.front` to the curb; a layout whose front edge is `blockWall` builds no box taller than 1.07 on the front; `tileAt(origin, lot, -8.3, 9.9)` is `[0, 0]`; `tileAt` just outside the lot is `null`; `worldRectOf(origin, main)` round-trips `tileAt` at its centre to the main mass's tile.
  - `lotHeightAt` is unchanged: the lot check still passes (run it).
- [ ] **Step 2: Run the layout check.** Expected: FAIL.
- [ ] **Step 3: Implement** the five lib files, the `STREET_BAND` export (and `STREET_Z` from it) and the `lot-height-at.ts` delegation.
- [ ] **Step 4: Run** the layout check, the lot check and the scene check. All ok. Types and lint 0.
- [ ] **Step 5: Commit** by path: `feat(trade-scenes): resolve a property layout into its frame, grade, regions and lot boxes`.

### Task 5: The layout joins the scene inputs, and the home kit gets a lot slot

**Files:**
- Create: `F/contexts/lot-slot-context.ts`
- Modify: `F/types.ts` (`TradeSceneInputs.layout: PropertyLayout`), `F/constants/home-scene-defaults.ts` (`layout: DEFAULT_LAYOUT`), `F/ui/components/home-kit/home-kit.tsx` (one hunk), `scripts/verify-trade-scene.ts` (`'schemas'` joins the tier guard's folders; three assertions in their own block after the guard, not beside line 926, so a later merge of the ship branch's 442-line diff in this file stays clean)

**Interfaces:**
- Produces: `LotSlotContext = createContext<((ground: WeatherSky['ground']) => ReactNode) | null>(null)` and `useLotSlot()`. In `home-kit.tsx`, the line `<Lot ground={sky.ground} />` becomes `{lotSlot ? lotSlot(sky.ground) : <Lot ground={sky.ground} />}` with `const lotSlot = useLotSlot()` above; nothing else in the file changes.
- `layout` is a drawing-tier input: it is not in `SceneResolveInputs`, not in `HomeKitInputs`, and not in `sceneBurstKey`. (The canvas's own `onPointerDown={wake}` already restarts the burst on any touch, a stroke included; that is the intended wake. The assertion is about the key, not the touch.)

- [ ] **Step 1: Add the failing assertions** to `scripts/verify-trade-scene.ts`, beside the `homeViewIsDrawingOnly` one: `const layoutIsDrawingOnly: 'layout' extends keyof SceneResolveInputs ? never : true = true`; `assert.equal(sceneBurstKey({ ...HOME_SCENE_DEFAULTS, layout: { ...HOME_SCENE_DEFAULTS.layout, source: 'edited' } }), sceneBurstKey(HOME_SCENE_DEFAULTS), 'a layout edit redraws, it never wakes the home')`; `assert.equal(HOME_SCENE_DEFAULTS.layout, DEFAULT_LAYOUT, 'the scene opens on the default layout')`.
- [ ] **Step 2: Run the scene check.** Expected: FAIL at runtime on the third assertion (`HOME_SCENE_DEFAULTS.layout` is undefined; `tsx` strips types, so the type-level one bites under `pnpm tsc`, which also fails).
- [ ] **Step 3: Implement**: the field, the default, the context, the home-kit hunk, `'schemas'` in `pureTier`. Check `git diff F/ui/components/home-kit/home-kit.tsx` shows the import, the hook line and the slot line only.
- [ ] **Step 4: Run** the scene check, the layout check. Types and lint 0. Open `/dashboard/trade-scene` on the owner's server in the lab worktree: unchanged (the slot is null there).
- [ ] **Step 5: Commit** by path: `feat(trade-scenes): the property layout is a drawing-tier scene input, and the home kit takes a lot slot`.

### Task 6: Drawing the lot from the layout

**Files:**
- Create: `F/lib/pick-layer.ts`, `F/ui/lib/region-strip-geometry.ts`, `F/ui/components/layout-kit/layout-ground.tsx`, `F/ui/components/layout-kit/layout-regions.tsx`, `F/ui/components/layout-kit/layout-lot.tsx`, `F/contexts/resolved-layout-context.tsx`, `scripts/verify-layout-kit.ts`

**Interfaces:**
- Consumes: `resolvePropertyLayout`, `GROUND_MATERIALS`, `groundStripGeometry`, `createLawnTexture`, `MergedBoxes`, `LotPlants`, `Neighbours`, `ignoreRaycast`, `useOwnedGeometry`.
- Produces:
  - `pickLayer(lot: LotLayout, layer: GroundLayer, i: number): number` (pure, in `F/lib/pick-layer.ts`): the existing value, or for `proposed` the proposed value falling back to the existing one when `0`.
  - `regionStripGeometry(lot: LotLayout, origin: LotOrigin, heightAt: (z: number) => number, mask: Uint8Array, picks: (i: number) => boolean, raise: number): BufferGeometry` — for each row, each run of consecutive picked unmasked tiles becomes one quad (two triangles) whose four corners sit at the tile edges with `y = heightAt(z) + raise` at the front and back edge; normals up; `uv = (x, z)` in metres; an empty pick returns an empty geometry.
  - `ResolvedLayoutProvider({ store, children })` and `useResolvedLayout(): ResolvedLayout` in `F/contexts/resolved-layout-context.tsx`: one `resolvePropertyLayout` per layout write, shared by the canvas and the panel, as `SceneTargetsProvider` does for the targets (`useStore(store, state => state.layout)` + `useMemo`). It takes the scene inputs store as a prop because the lab view owns that store and mounts the provider around `TradeSceneView`; R3F bridges the context into the canvas.
  - `LayoutGround({ ground, resolved, handlers })` — the base strip from `resolved.groundRows` (`groundStripGeometry(rows, 140, 4)`), the lawn texture, `receiveShadow`; the regions pass taps through to it, the walls and the street take their own as today. `handlers?: GroundHandlers | null` is spread onto the mesh (Task 8 supplies it; `null` here). `export type GroundHandlers = Pick<ThreeElements['mesh'], 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'>` is declared and exported from this file (an R3F type never enters `F/types.ts`).
  - `LayoutRegions({ resolved, layer })` — one `<mesh>` per ground material present in the layer except `sod` (the base strip is the sod), geometry from `regionStripGeometry`, `meshStandardMaterial` with the look's colour and roughness, `receiveShadow`, `raycast={ignoreRaycast}`; memoised on `(resolved, layer)`.
  - `LayoutLot({ ground })` — mirrors `Lot`: `BLUEPRINT_OMIT_TAG` group with `LayoutGround`, `LotPlants`, `Neighbours`; `LayoutRegions` with `layer = useSceneInputs(state => state.view)`; `MergedBoxes` for `boxes.asphalt`, `concrete` (`HOME_PALETTE.path`, the stoop and apron inside it), `blockWalls`, `wallCaps`, `fenceBoards`, `fenceRails` with today's colours and flags from `lot.tsx`. Nine lot meshes on the default layout (ground, two region strips, six merged lists): the same count as today's `Lot`.

- [ ] **Step 1: Write the failing kit check.** `scripts/verify-layout-kit.ts` imports three (as `verify-scene-primitives.ts` does) and asserts on `regionStripGeometry` over a 4 × 3 lot with a flat `heightAt = () => 0`: a 2 × 2 block gives 2 quads = 12 vertices (non-indexed) or 8 with an index; every `y === raise`; `uv.x` spans the block's world x; with `heightAt = z => z` the front corners sit lower than the back ones; a masked tile breaks a run into two quads; `pickLayer` on `existing = [2]`, `proposed = [0]` gives 2 for both layers and 5 when `proposed = [5]`. End with `console.log('verify-layout-kit: ok')`.
- [ ] **Step 2: Run the kit check.** Expected: FAIL.
- [ ] **Step 3: Implement** the files.
- [ ] **Step 4: Run** the kit check, the scene check, types and lint. Nothing on screen yet (no page mounts it).
- [ ] **Step 5: Commit** by path: `feat(trade-scenes): the layout kit draws the lot's ground, regions, walls and street from a property layout`.

### Task 7: The lab page

**Files:**
- Create: `src/app/(frontend)/dashboard/labs/scene-layout/page.tsx` (the route R211 agreed), `F/ui/views/property-layout-lab-view.tsx`, `F/constants/property-layout-lab-copy.ts`, `F/constants/property-layout-query-parsers.ts`
- Modify: `F/ui/views/trade-scene-view.tsx` (optional `inputs` prop)

**Interfaces:**
- `TradeSceneView({ inputs }: { inputs?: StoreApi<TradeSceneInputs> })`: `const [store] = useState(() => inputs ?? createSceneInputs(HOME_SCENE_DEFAULTS))`. Two lines; nothing else.
- `PropertyLayoutLabView()`: URL state goes through nuqs, the repo's URL-state tool (`NuqsAdapter` is mounted app-wide; parsers live in a feature `constants/*-query-parsers.ts` file, as `schedule-management` does). `property-layout-query-parsers.ts`: `propertyLayoutParser = createParser<PropertyLayout>({ parse: text => decodePropertyLayout(text, LAYOUT_TILE), serialize: encodePropertyLayout, eq: (a, b) => a === b }).withOptions({ history: 'replace', throttleMs: 300 })`. The view reads `const [fromUrl, setUrlLayout] = useQueryState('layout', propertyLayoutParser)` and seeds the store once with `{ ...HOME_SCENE_DEFAULTS, layout: fromUrl ?? DEFAULT_LAYOUT }`; a store subscription calls `setUrlLayout(layout)` whenever `layout` changes and `encodePropertyLayout(layout).length <= 8000` (a heavily edited lot can encode to ~16 KB; above the cap the URL is left as it was and Copy link says the layout is too large for a link). It renders
  ```tsx
  <ResolvedLayoutProvider store={store}>
    <LotSlotContext value={lotSlot}>
      <TradeSceneView inputs={store} />
    </LotSlotContext>
  </ResolvedLayoutProvider>
  ```
  where `lotSlot` and `LayoutLot` are module-scope: `const LayoutLot = dynamic(() => import('…/layout-kit/layout-lot').then(m => m.LayoutLot), { ssr: false, loading: () => null })` (both existing views load three only through `next/dynamic`, so the blueprint paper paints before three parses; a module-scope slot function also keeps the home kit from re-rendering on every lab render) and `const lotSlot = (ground: WeatherSky['ground']) => <LayoutLot ground={ground} />`. Plus a "TEST" badge (`property-layout-lab-copy.ts`: `badge: 'TEST'`, `title: 'Property layout lab'`): `fixed top-4 left-4 z-20`, `cn(CONTROLS_CLASSES.tag, 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300')` (no realism-spike badge exists in the tree any more; this is the whole spec of it). The page file mirrors `labs/cutaway-look/page.tsx` (`dynamic = 'force-dynamic'`; the labs layout already gates super-admins).

- [ ] **Step 1: Write the failing check:** add to `scripts/verify-property-layout.ts` a source check: `src/app/(frontend)/dashboard/labs/scene-layout/page.tsx` exists and imports `PropertyLayoutLabView`; `F/ui/views/trade-scene-view.tsx` contains `inputs ?? createSceneInputs(HOME_SCENE_DEFAULTS)`; `F/ui/views/property-layout-lab-view.tsx` contains `LotSlotContext`, `ResolvedLayoutProvider`, `useQueryState` and `dynamic(`; `propertyLayoutParser.parse('not json')` is `null` and `parse(serialize(DEFAULT_LAYOUT))` deep-equals `DEFAULT_LAYOUT`; no file under `F/` contains `SceneLayoutLab`.
- [ ] **Step 2: Run the layout check.** Expected: FAIL.
- [ ] **Step 3: Implement.** Then open `/dashboard/labs/scene-layout` on the owner's server: today's scene with the lot drawn by the layout kit. Take two shots (lab vs `/dashboard/trade-scene`, default inputs) into `.superpowers/sdd/2026-11-02-property-layout-l1-l2/shots/task-7/` and look at them: the driveway, walk, beds, walls and gates sit where they do today; the concrete joints are gone (expected); note any colour drift for Task 10.
- [ ] **Step 4: Run** the layout check, types and lint.
- [ ] **Step 5: Commit** by path: `feat(trade-scenes): the scene layout lab draws the trade scene with the lot from a property layout`.

### Task 8: Draw mode

**Files:**
- Create: `F/lib/create-layout-editor.ts`, `F/contexts/layout-editor-context.tsx` (it renders a provider, so `.tsx` like `scene-targets-context.tsx`), `F/hooks/use-lot-draw-handlers.ts`, `F/ui/components/layout-kit/lot-draw-preview.tsx`, `F/ui/components/layout-kit/layout-region-outlines.tsx`, `F/ui/components/layout-kit/layout-tile-grid.tsx`
- Modify: `F/ui/components/layout-kit/layout-lot.tsx` (passes `useLotDrawHandlers(resolved)` to `LayoutGround`; mounts the grid, the preview and the outlines in draw mode), `F/ui/views/property-layout-lab-view.tsx` (provide the editor store), `src/shared/components/scene/types.ts`, `src/shared/components/scene/lib/create-scene-camera.ts`, `src/shared/components/scene/ui/camera-rig.tsx` (the `drawing` flag, S1), `scripts/verify-property-layout.ts`

**Interfaces:**
- Produces (`create-layout-editor.ts`, zustand, pure):
  ```ts
  export interface LayoutEditorState {
    mode: 'orbit' | 'draw'
    brush: { existing: GroundMaterialId | null, proposed: GroundMaterialId | typeof PROPOSED_KEEP | null }   // null = "No change" (the stroke leaves that layer alone); PROPOSED_KEEP = the build row's Keep, painted as 0
    selected: string | null                 // a LotRegion id
    stroke: { from: readonly [number, number], to: readonly [number, number] } | null
    undo: readonly PropertyLayout[]         // at most 10
  }
  export function createLayoutEditor(): StoreApi<LayoutEditorState>   // createSceneInputs<LayoutEditorState>(…), as create-scene-camera.ts does
  export function applyStroke(layout: PropertyLayout, rect: TileRect, brush: LayoutEditorState['brush']): PropertyLayout   // paintTiles on each layer the brush names, through massMask; source: 'edited'
  ```
  `LayoutEditorProvider({ store, children })`, `useLayoutEditor(selector)`, `useLayoutEditorApi()` in the context file.
- **The camera's `drawing` flag (S1):** `SceneCameraState` gains `drawing: boolean` (`createSceneCamera` sets `false`; `setSceneCameraDrawing(store, drawing)` beside `recenterCamera`); `CameraRig` reads it with `useSceneCamera(state => state.drawing)` and passes `enabled && !drawing` to `useSceneTaps` and `useCameraWheel` and `enabled={!drawing}` to `OrbitControls`. The rig's tap tracker listens on the DOM (`use-scene-taps.ts`), which R3F's `stopPropagation` never reaches, so without this flag two taps on a region would glide the camera mid-edit. The flag is the whole hunk; nothing else in the rig changes.
- `useLotDrawHandlers(resolved: ResolvedLayout): GroundHandlers | null` — `null` outside `draw` mode (so the ground takes no pointer events and orbit works as today); in draw mode the four R3F handlers: on `pointerdown` with `event.isPrimary` and `button === 0`: `event.stopPropagation()`, `event.target.setPointerCapture(event.pointerId)`, `setSceneCameraDrawing(camera, true)` (`useSceneCameraApi()`), `stroke = { from: tile, to: tile }`; on `pointermove`: `stroke.to = tile` clamped to the lot (a point outside keeps the last tile), `invalidate()`; on `pointerup`: if `from` equals `to` → `selected = regionAt(...)?.id ?? null`, else `commit(applyStroke(layout, rectBetween(from, to), brush))` pushing the previous layout onto `undo`; release capture, `setSceneCameraDrawing(camera, false)`, `stroke = null`; on `pointercancel`: cancel the same way without committing. **A second finger:** the hook also attaches one `pointerdown` listener to `document` while a stroke is open and cancels the stroke when any non-primary pointer goes down anywhere (with `touch-action: none` the browser fires no `pointercancel` for a pinch, and a finger on the house never reaches the ground mesh); non-primary moves and ups are ignored. `commit` writes `store.setState({ layout })` on the scene inputs store.
- `LotDrawPreview({ resolved })` — one translucent plane (`opacity 0.35`, the brush's existing colour or the proposed colour) scaled and positioned from `stroke` via a ref in `useFrame`, `raycast={ignoreRaycast}`; unmounted when `stroke === null`.
- `LayoutTileGrid({ resolved })` — the tile grid the spec shows in draw mode: one `<lineSegments>` over the lot's rows and columns, each line a polyline on the grade (`y = heightAt(z) + 0.01`, one segment per row step), `raycast={ignoreRaycast}`, mounted only in `draw` mode (drei's `Grid` is a flat plane; the front yard slopes 0.45 m).
- `LayoutRegionOutlines({ resolved, selected })` — one `<lineSegments>` for every region's rings (tile corners → world, `y = heightAt(z) + 0.02`), a second brighter one for the selected region; `raycast={ignoreRaycast}`; mounted only in `draw` mode.

- [ ] **Step 1: Add the failing checks** to `scripts/verify-property-layout.ts`: `applyStroke` with `brush = { existing: 'pavers', proposed: null }` changes only `existing`; with `{ existing: null, proposed: 'turf' }` only `proposed`; with `{ existing: null, proposed: PROPOSED_KEEP }` over a turf region sets those proposed tiles back to `0`; a stroke over the main mass leaves the mass tiles untouched; the result has `source: 'edited'` and the input is unchanged; `createLayoutEditor().getState()` opens in `mode: 'orbit'` with an empty brush and no stroke; pushing 11 layouts onto `undo` through the store's helper keeps 10; `createSceneCamera().getState().drawing === false` and `setSceneCameraDrawing` flips it; source check: `camera-rig.tsx` passes `!drawing` to `useSceneTaps`, `useCameraWheel` and `OrbitControls`.
- [ ] **Step 2: Run the layout check.** Expected: FAIL.
- [ ] **Step 3: Implement.** The lab view wraps the trade scene view in `LayoutEditorProvider` and a keyboard shortcut `D` toggles the mode for now (the panel comes in Task 9; `d` is free in `SCENE_SHORTCUTS`, and the lab keeps its own `window` listener because the registry's actions run in the working scene, which has no draw mode). Tap-tap (two corners) is not built in L2: the owner judges on the iPad whether a drag across the lot feels long (spec §8, amended). Playwright pass into `shots/task-8/`: enter draw mode, drag a rectangle on the front lawn, read the URL's `layout` back through `decodePropertyLayout` and assert the tiles changed; drag from inside the lot to outside the canvas and assert the rectangle stopped at the lot edge; start a drag and dispatch a second touch point through CDP (`Input.dispatchTouchEvent`), assert nothing was painted and the camera store's `drawing` is back to `false`; tap a region and assert the outline brightens and the camera did not move (shot).
- [ ] **Step 4: Run** the layout check, the kit check, types and lint.
- [ ] **Step 5: Commit** by path: `feat(trade-scenes): draw mode paints tile-snapped regions on the lot with a finger`.

### Task 9: The editor panel: brush, region card, fences

**Files:**
- Create: `F/ui/components/layout-editor/layout-editor-panel.tsx`, `brush-picker.tsx`, `region-card.tsx`, `lot-edges-fields.tsx`, `layout-mode-toggle.tsx`, `F/constants/layout-editor-copy.ts`, `F/lib/format-feet.ts`
- Modify: `F/ui/views/property-layout-lab-view.tsx` (mount the panel), `scripts/verify-property-layout.ts`

**Interfaces:**
- `formatFeet(metres: number): string` → `"12 ft"` (rounded) and `formatSquareFeet(m2: number): string` → `"1,240 sq ft"`, the grouping through the shared `formatAsCount`; display only.
- `LayoutEditorPanel()` — a fixed card on the stage's left (`z-20`, under the controls' modals; on stages under 800 px wide it docks to the bottom above the Controls' band, full width, and the brush rows scroll sideways; `bg-card` on the stage's CARD rung, as the system card), shadcn `Card`, `ToggleGroup`, `Select`, `Button`; sections: **Mode** (`Orbit` / `Draw`, `LayoutModeToggle`), **Brush** (`BrushPicker`: two rows of `ToggleGroup` items labelled with `SCENE_VIEW_LABELS.existing` and `SCENE_VIEW_LABELS.proposed`, the first over `sets` containing `existing`, the second over `proposed` plus a `Keep` item (= `PROPOSED_KEEP`, paints 0) and a `No change` item (= `null`, leaves the layer alone); the row label says which layer a stroke paints), **Region** (`RegionCard`: for `selected`, the region's existing and proposed labels as two `Select`s that rewrite the region's tiles through `applyStroke` over the region's component, `formatFeet(regionPerimeterM)`, `formatSquareFeet(regionAreaM2)`, a `Clear` button that paints `PROPOSED_KEEP` on proposed; hidden when nothing is selected), **Fences** (`LotEdgesFields`: one `Select` per side over `LotEdgeKind`, writing `layout.lot.edges` as one span per side; the front side offers `lowWall`, `woodFence` and `none` only, R130), **Layout** (`Undo`, `Reset to default`, `Copy link`, disabled with a note when the layout exceeds the URL cap). Copy lives in `layout-editor-copy.ts`.
- The Today / Tri Pros Build switch that already exists in the Controls (`view`) is what flips the lot between layers; the panel does not duplicate it.

- [ ] **Step 1: Add the failing checks:** `formatFeet(3.6576) === '12 ft'`; `formatSquareFeet(115.2) === '1,240 sq ft'`; the panel's copy object has `mode`, `brush`, `region`, `fences`, `layout` keys with non-empty strings and no `Today`/`Tri Pros build` literals of its own (the rows read `SCENE_VIEW_LABELS`); source check: `region-card.tsx` imports `regionPerimeterM` and `regionAreaM2` and nothing under `F/` imports them except the card, `lot-regions.ts` (which defines them) and the check (R206: display only); `lot-edges-fields.tsx` never offers `blockWall` on the front.
- [ ] **Step 2: Run the layout check.** Expected: FAIL.
- [ ] **Step 3: Implement.** Playwright pass into `shots/task-9/`: pick `turf` on the build row, draw on the back yard, flip the Controls' switch to the build, shot both; select the driveway, shot the card (perimeter and area present); set the right fence to `woodFence`, shot.
- [ ] **Step 4: Run** the layout check, types and lint.
- [ ] **Step 5: Commit** by path: `feat(trade-scenes): the layout editor panel picks the brush, shows a region's materials, perimeter and area, and sets the fences`.

### Task 10: Parity and budget

**Files:**
- Create: `.superpowers/sdd/2026-11-02-property-layout-l1-l2/parity/report.md`, `shots.mjs` beside the parametrised `perf.mjs` and `lib.mjs`
- Modify: `F/constants/ground-materials.ts` (colours, by eye), `F/ui/components/layout-kit/*` (only what the shots demand)

- [ ] **Step 1: Check the probes.** `lib.mjs` already takes `WORKTREE`, `PORT` and `LAB_ROUTE` from the environment (Before Task 1); `perf.mjs` runs unchanged against both `/dashboard/trade-scene` and `/dashboard/labs/scene-layout`.
- [ ] **Step 2: Measure.** For `default` and `worst`, `flat` and `tile`, on both routes: record `drawCalls` and `triangles`. Expected: the lab's are `≤` the scene's in every cell (nine lot meshes each: no joints mesh, but one strip mesh per material present; the stoop and the apron ride in `concrete`; the grid and the outlines are not mounted outside draw mode). If a cell is over, find the extra mesh and merge it; never raise the gate.
- [ ] **Step 3: Shots side by side.** `shots.mjs` captures both routes at 1280 × 800 for: Normal / Summer / Winter / Rain × Complete / Partly open, plus Thermal on Summer, slab foundation, flat roof (12 pairs). Put them in `parity/` as `<case>-scene.png` / `<case>-lab.png`.
- [ ] **Step 4: Tune by eye.** The lab's lawn, driveway, walk, beds, walls, gates and street must read as today's; adjust the ground materials' colours and `raise` until they do. The known differences stay and are listed in the report: no concrete joints; the one-tile strip at the wall foot where the house's 12 × 8 m does not divide into tiles; the beds' edges snapped to tiles; the lot's right edge 0.2 m out, one more board on the right gate; the pool flat (no recess yet); the plants still placed by today's constants, so painting over a bed leaves its shrubs.
- [ ] **Step 5: Write `parity/report.md`:** the measured table, the shot pairs, the tuning made, the known differences, open eye calls for the owner.
- [ ] **Step 6: Run** every check (layout, kit, scene, lot, primitives), types and lint. Commit by path: `feat(trade-scenes): the layout lab matches the scene on the default layout; parity report`.

---

## After the plan

- The controller updates the tracker's Layout row (`[~] L1+L2 built, awaiting the owner's look`) and `progress.md`; the spec's §12 L1 row already reads "the house drawn by today's components; the house's own re-implementation is L3's".
- Open for the owner's look: the lab on the iPad (draw with a finger, pinch while drawing, the card's numbers), the three known differences, colour calls on the new materials (dirt, pavers, gravel, turf, pool, dg, river rock).
- Next plan: L3 (masses: the house from the layout, attached and detached garage, gable / hip / flat, the valley, the cut on the main mass), re-planned on this head.
