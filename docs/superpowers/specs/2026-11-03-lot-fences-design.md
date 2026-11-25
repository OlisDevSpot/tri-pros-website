# Lot fences as drawn lengths — design

**Status:** approved by the owner 2026-11-04 (calls 1–12 stand); stress-tested 2026-11-04, rulings in §11 and folded into the plan `docs/superpowers/plans/2026-11-04-lot-fences.md` · **Parent spec:** `docs/superpowers/specs/2026-11-02-scene-layout-design.md` (§5 `edges`/`gates`, §8 "Fences and walls are per lot side", §15) · **Branch:** `feat/scene-layout-lab` (worktree `.worktrees/scene-layout-lab`, port 3003) · **Project 1 of 4** from the owner's first look (2026-11-03): fences first, then Property facts + Areas, the patio cover, session-storage persistence.

## 1. Intent

The lot's fences and walls today are four per-side spans plus two fixed side-yard "gates", set from a per-side select. The owner wants to model a property's fences the way they stand, while walking the job or at the kitchen table, and to sell fencing: every fence and wall type, vinyl and composite included, with gates, drawn in the scene the way the lot's ground is drawn. A pool fence or a dog run through the back yard is as real a sale as the perimeter. So a fence becomes something the rep **traces** anywhere on the lot, and the perimeter is just the fence the lot starts with.

Owner's words (2026-11-03): "We should also be able to draw the fence (similar to how we draw the lot design)" · "Anywhere on the lot. That being said, perimeter fences are special as they are much more common than any other fence (most homes will have some form of fence/wall on the perimeter, barring the front of the home which only sometimes has a fence/wall)."

## 2. Goals, non-goals, anti-goals

**Goals**
- A fence or wall is a length along the tile grid's lines, anywhere on the lot, traced with one finger in draw mode, the same gesture family as painting a region.
- Every type the trade sells or meets: wood, vinyl, composite, wrought iron, chain link, block wall, low wall; gates in the wood, vinyl, composite and iron families.
- Two layers, as the ground has: what stands today and what the build installs, shown by the Today / Build switch.
- The perimeter is pre-drawn and quick to set per side, and the front of the lot starts open.
- The default lot draws exactly as it does now (the parity shots hold), so this is a model change under an unchanged picture.

**Non-goals (this project)**
- Where the per-side perimeter setting lives in the Controls (project 2 moves it under Property facts → Lot; here the lab panel's Fences section keeps working on the new model).
- A build that removes a fence and leaves nothing. Replacement is expressible; bare demolition is not a scene sale today.
- Fence heights other than the two the code allows (the 42 in front-yard cap and the 6 ft side and rear).
- Diagonal or curved fences. Lengths follow the grid's lines, 2 ft steps, as regions follow its tiles.
- Fence posts as separate data. Posts are drawn by rule.
- Persistence (project 4). The URL codec carries the new model until then.

**Anti-goals**
- A second geometry system. Fences reuse the lot's tile grid, its paint, re-tile, run-encoding and undo; nothing new is invented for "where".
- Breaking the default lot's look. If the parity shots change, something is wrong.
- A gesture that needs explaining. One drag draws one straight length; a corner is two drags.

## 3. Vocabulary (proposed; the owner agrees the words before code uses them)

- **Fence** — any drawn length of fence or wall on the lot, one **fence kind**, on one layer. Walls are fence kinds. _Avoid_: run (the glossary already notes two meanings of "run"), edge (the grid line's word in code), barrier.
- **Fence kind** — `woodFence | vinylFence | compositeFence | wroughtIron | chainLink | blockWall | lowWall | woodGate | vinylGate | compositeGate | ironGate`. On screen: Wood fence, Vinyl fence, Composite fence, Wrought iron, Chain link, Block wall, Low wall, Wood gate, Vinyl gate, Composite gate, Iron gate. _Avoid_: type, material (the ground's word), style.
- **Gate** — a fence kind drawn over one or more cells of a grid line: a hinged leaf in that family's look, single up to two cells, double beyond. _Avoid_: opening, gap, door.
- **Cell** — one tile-length of a grid line, where a fence can stand; indexed along its line as tiles are along a row (owner-agreed 2026-11-04; Tile's _Avoid_ narrows to "cell, for a tile"). _Avoid_: tile (the square), segment, slot.
- **Fence line** — one straight stretch of cells on one grid line sharing one (today, build) pair of kinds, derived from the fence maps the way regions are derived from the tile maps; what the rep taps and the card describes. In code the kind-free `{ axis, line, from, to }` is a `LineRange`. _Avoid_: segment, span (the old `LotEdge` word), run.
- **Perimeter** — the lot line's four sides, front, left, right, back: the grid lines on the lot's boundary. _Avoid_: boundary, property line (the survey's word).
- **Front yard cap** — anything drawn in the front yard builds no taller than 42 in; a block wall there is built as a low wall. _Avoid_: front fence (the constant `LOT.frontFence` keeps its name).

The parent spec's §4 words (Layout, Tile, Region, Ground material, Mass, Face, Draft) are owner-agreed (R214) and live in the trade-scenes worktree's uncommitted `CONTEXT.md`; the lab's committed copy lacked them. Ruling 2026-11-04: the lab's `CONTEXT.md` takes that block verbatim, then this section's words, with Lot edge retired and Gate rewritten (done in the stress test; the owner commits and reconciles on the next sync).

## 4. The model

A fence lives on the **grid's lines**, not its tiles. Two maps per layer, one per direction, indexed like the tile maps and holding a fence-kind index (0 = none on the existing layer, 0 = keep on the proposed layer; the kinds are 1-based in order of `FENCE_KIND_IDS`, as `GROUND_MATERIAL_INDEX` is):

```ts
// types.ts
export type FenceKindId = typeof FENCE_KIND_IDS[number]
// Lines parallel to the street ("across"): rows + 1 of them, cols cells each, index line * cols + col; line 0 is the front lot line.
// Lines toward the back ("along"): cols + 1 of them, rows cells each, index line * rows + cell, so a lot-line wall is one run on the wire; line 0 is the left lot line.
export interface FenceMap { across: Uint8Array, along: Uint8Array }
export interface LotLayout {
  cols: number, rows: number
  existing: Uint8Array, proposed: Uint8Array
  fence: { existing: FenceMap, proposed: FenceMap }      // replaces edges and gates
  grade: LotGrade
}
```

`LotEdge`, `LotGate`, `LotEdgeKind`, `lot.edges`, `lot.gates` go away, with their schema enums, wire fields, re-tile branches and checks (non-defensive migration: consumers move in the same change).

Derived at resolve time, beside `regions`:

```ts
// As a region is a run of equal (existing, proposed) tile pairs, a fence line is a run of equal pairs of cells on one
// grid line, so one tap finds one line with both its kinds, whichever view is shown.
export interface FenceLine {
  id: string                       // `${axis}-${line}-${from}`: the seed cell, as a region's id is its seed tile
  axis: 'across' | 'along'
  line: number                     // which grid line
  from: number, to: number         // cells along it, `to` exclusive
  existing: FenceKindId | null     // null = nothing there today
  proposed: FenceKindId | null     // null = the build keeps what is there
  perimeter: boolean               // on a lot-line grid line
  frontYard: boolean               // every cell in front of the main mass's front face
}
// ResolvedLayout gains `fences: readonly FenceLine[]`; a cell with 0 on both maps belongs to no line.
```

Rules the resolver enforces and `verify-property-layout.ts` asserts:
- A fence line is a maximal straight sequence of cells on one grid line whose (existing, proposed) pair is equal, the `sameRegion` rule of `lot-regions.ts` on cells. A gate painted mid-line changes the pair there, so it splits the line into fence, gate, fence: three lines, on either layer.
- **Mass mask on lines:** a cell whose two neighbouring tiles are both inside a mass is unpaintable and never drawn (the house's interior). A cell with a mass on one side is paintable: that is where a side-yard fence meets the house.
- **Front yard cap:** a cell is in the front yard when its row (for "along" cells) or its line (for "across" cells) is in front of the main mass's front face row. Every kind there builds at the 42 in height; `blockWall` builds as `lowWall`. The rule is applied at build time, per cell: an along line that crosses the face row builds its front-yard stretch at the capped height and the rest at full height (one span when the two heights are equal, as for a low wall). `FenceLine.frontYard` stays "every cell in front" and is read, never used for the height. The map keeps what the rep drew, so dragging the house back later raises the fence.
- **Proposed shows through keep:** at a cell where the proposed map is 0, the build view draws the existing kind; where it is non-zero, the proposed kind replaces it in the build view. The today view never reads the proposed map.
- Until L3, a fence line that ends against a mass's tile edge is extended to the drawn house's or garage's metre face (the `HOUSE` and `GARAGE` constants; `ResolvedLayout.main` / `.garage` are tile rectangles and do not carry the metre face), as the gates are today; L3 makes the tile edge exact.

**Perimeter per side** is a paint over one lot-line grid line from end to end (what the lab panel's Fences section writes), and "Mixed" reads as it does today. It is nothing special in the model; it is special in the defaults and the copy.

**Default lot** (parity): the same fences the default has today, expressed on the maps: block wall on the back line, on the left and right lines from the gate row to the back; low wall on the left line from the front to the gate row; nothing on the right front stretch and the front line; `woodFence` across each side yard at the gate row from the lot line to the house or garage face. No gate leaf on the default (the picture must not change); adding one is a rep's edit and an eye call for the owner on the next look.

## 5. Kinds, layers and the look

| Kind | Layers | Look (first cut; the builder tunes by eye, both weathers) |
|---|---|---|
| `woodFence` | today, build | today's cedar boards and two rails, no posts (posts are an eye call for the owner's next look, not drawn here) |
| `vinylFence` | today, build | white panels between posts with caps, no visible rails, smooth, roughness low |
| `compositeFence` | today, build | grey-brown horizontal boards between dark posts |
| `wroughtIron` | today, build | thin dark pickets at 0.1 m, top and bottom rail, square posts |
| `chainLink` | today only | galvanised posts and top rail, the mesh as one translucent plane per line (Tri Pros does not install chain link: Claude's guess, the owner strikes it if wrong) |
| `blockWall` | today, build | today's block wall and cap |
| `lowWall` | today, build | today's 42 in wall and cap |
| `woodGate` / `vinylGate` / `compositeGate` / `ironGate` | today, build | a leaf in the family's look, framed, between two posts, over any length: one or two cells is a single leaf, three or more a double leaf meeting in the middle (a driveway gate is five or six cells); a gate drawn where no fence is still draws as a gate |

Each kind draws as merged boxes in one or two material groups, mounted only when the kind is present on the shown layer (as region strips are), so the default lot's draw count is unchanged. Chain link's mesh is the one plane material. All colours come from `LOT_PALETTE` / `HOME_PALETTE` additions, never a literal in a component.

**Catalog link (owner ruling 2026-11-03: link now, not in project 2).** Every kind on the Build row carries `catalog: { scopeAccessor, materialAccessor }` as the ground materials do (S4), and the same check proves both accessors exist in the seed files. The scopes exist (`installFencingGates`, `installBlockWall` in `src/shared/db/seeds/data/scopes.ts`); the materials do not, so this project adds them to the seeds, by explicit edit, nothing else in those files touched:

| Kind | Scope | Material (new seed row) |
|---|---|---|
| `woodFence`, `woodGate` | `installFencingGates` | `woodFencing` |
| `vinylFence`, `vinylGate` | `installFencingGates` | `vinylFencing` (most popular) |
| `compositeFence`, `compositeGate` | `installFencingGates` | `compositeFencing` |
| `wroughtIron`, `ironGate` | `installFencingGates` | `wroughtIronFencing` |
| `blockWall`, `lowWall` | `installBlockWall` | `cmuBlock` |

Seed files: `materials.ts` (five rows: label, accessor, one-line description, an image URL the owner may swap), `x-scope-materials.ts` (five links, vinyl `isMostPopular`), `x-material-benefits.ts` (five lists drawn from the existing benefit accessors only; no new benefit rows). The check reads the files as text, so proving the link needs no database; the owner runs `pnpm db:seed:dev` when the dev catalog should carry them. `chainLink` has no link because it is not on the Build row.

Heights: 1.83 m (`LOT.wall.height`) for every kind off the front yard; 1.07 m (`LOT.frontFence`) in it. Everything stands on the grade as today's side pieces do (`padToFront` / `onGrade` through the front yard's slope; boards lifted to the grade under each).

## 6. The editor

In draw mode the brush gains a **tool**: Ground (today's two material rows) or Fence (two rows of fence kinds, Today and Build, with No change and Keep exactly as the ground rows have them, plus None on the Today row, since a fence, unlike the ground, can stand nowhere). The tool is one toggle above the rows; the hint under the rows reads for the tool shown.

- **Trace:** press on the ground near a grid line, drag. The stroke snaps to the grid: the press picks the nearest grid vertex; the drag's dominant axis picks the line; the length follows the finger's projection on it. **One drag is one straight length.** The preview is the same translucent strip as a region's, drawn as a thin band on the line and following the grade (the preview strip from the drift fix). Commit on lift paints the cells on the layers the brush names. The same pointer rules as the rectangle: capture, camera held while drawing, a second finger closes the stroke and the camera stays off until every finger lifts.
- **Tap a fence line** to select it: the card shows its kind today and in the build, its length in ft, whether it is perimeter and which side, and lets the rep change either kind or clear it, as the region card does for a region. In draw mode the fence meshes carry their own pointer handlers that map a hit to its fence line, since a tap aimed at a 6 ft wall lands on the wall and the ground behind it is tiles away at a low camera angle; a press on the ground within a quarter tile of a line that carries a fence also picks the line over the region. Outside draw mode the fence meshes keep today's double-tap behaviour.
- **Erase** is the Today row's None (0) or the Build row's Keep (0), as the ground's are.
- **Per-side perimeter** stays in the lab panel as four selects writing a whole lot-line grid line on the existing layer; project 2 moves it under Property facts → Lot and gives it a build-layer twin.
- Undo, reset and the link behave as for regions: one undo step per commit, the default lot on reset.

## 7. Wire, schema, re-tile

- Wire `_v: 2`. `lot.fence: { existing: { across, along }, proposed: { across, along } }`, each a run string like the tile maps. `edges` and `gates` are gone. A `_v: 1` payload is rejected (decode returns `null`, the default lot shows): nothing is persisted anywhere but copied lab links, and project 4 retires the URL. The schema bounds each map's run total to its line count × cell count and every value to the kinds list.
- Re-tile scatters each source line to `scaled(line, lines − 1)` (the rule the tile rectangles' boundaries use) and samples the cells along it at their centres as the tile maps are; every other line stays empty, so a fence lands on exactly one line (sampling lines backwards would put each on two at 1 ft). A fence stays on the same lot-line or house-face line after re-tiling, which a check asserts for the default at 1 ft, with the line count.
- `LAYOUT_URL_MAX` stays 8,000. Today's default link is 1,292 characters; with the four fence maps it measures about 1,500 row-major and about 1,000 with the along map line-major, which is why the along index is line-major. A check prints the default's length and bounds it at 2,000.

## 8. Checks and the owner's look

`verify-property-layout.ts`: the default lot's fence maps build the same boxes as today's `LOT_BOXES` within the existing tolerances (board counts per side-yard fence, the low wall's parts on the slope, nothing floating), with one stated exception: today's right side-yard fence has one rail and the left has two by an accident of the constants (`lot-boxes.ts`), and a per-cell kind cannot know a side, so every wood fence gets two rails, the right side yard gains its lower one, the rail check reads four, and that parity pair is re-measured against the same pixel budget as the others; the front yard cap for every kind that can stand there; a traced interior fence across the back yard stands on the grade and ends where drawn; a gate splits a fence line into three; a cell inside the house is unpaintable; codec round trip, v1 rejected, re-tile keeps the lines. `verify-layout-kit.ts`: the fence preview geometry follows the grade. Live probe (the workspace's `draw.mjs`, extended): trace a fence with a finger, the camera holds still, the URL carries it; a second finger mid-trace leaves the camera still. Parity: the 11 shot pairs still match on the default lot, the right side yard's new lower rail being the one known, measured difference. The box parity check matches each fence box to its nearest scene box (the lines sort across-first, so the index order differs from `LOT_BOXES`). Also checked: Today's None erases a fence; a fence line crossing the front face builds in two heights; six fence lines at 1 ft.

For the owner's look afterwards: the new kinds' colours, the gate leaf, whether the default side yards should start with a gate leaf, whether posts should be drawn, the seed rows' descriptions and images, and whether chain link belongs on the build row.

## 9. Left to the builder

Exact box specs per kind (post size, picket spacing, panel thickness, the gate's frame and inset); where fence line ids are stable enough for re-selection after a repaint; how the fence tool reads in the narrow panel; the snapping thresholds; the chain link plane's opacity under the double-tap rule (`isDoubleTapStop`); whether `FenceMap` lives in `types.ts` or `schemas/`; the order of the kind rows on the phone.

## 10. Calls made in this design (Claude's; the owner can overturn any)

1. Fences live on grid lines as two Uint8Array maps per layer, mirroring the tile maps, rather than as a list of polylines. Cost if wrong: the maps are the whole model; a polyline list would redo the paint, re-tile and codec work.
2. One drag draws one straight length. Cost: a corner costs two drags.
3. Chain link is today-only. Cost: one flag flip if Tri Pros installs it.
4. No bare demolition in the build layer. Cost: a `cleared` value added later.
5. The default lot gains no gate leaf, so the parity shots hold. Cost: the default side yards read as closed panels, as they do today.
6. Wire v1 is rejected, not migrated. Cost: copied lab links from before this change open the default lot.
7. The front-yard cap applies to every kind by position, and the block wall drawn there builds low rather than being refused. Cost: a rep who wants a 6 ft wall in a front yard cannot draw one, which is the code.
8. A fence line is a run of equal (existing, proposed) pairs, the regions' rule, not one line per layer (the first draft said per layer, which left the card with no single build kind to show). Cost: none; it is the precedent.
9. The wood fence draws as today's boards and two rails, no posts; the right side yard gains the lower rail the left already has. Cost: one parity pair moves by one rail, measured; posts wait for the owner's eye.
10. A gate may be any length, single leaf to two cells, double beyond. Cost: a width rule in the leaf builder.
11. Fence meshes take their own taps in draw mode. Cost: one handler set; the double-tap rule is untouched outside draw mode.
12. The five material accessors and the gate-to-family mapping in the catalog table (the owner ruled "link now"; the names are Claude's). Cost: a rename in three seed files before the first seed run.

## 11. Stress-test rulings (2026-11-04, after the plan)

| # | Ruling |
|---|---|
| F1 | **Cell is a word.** One tile-length of a grid line; Tile's _Avoid_ narrows to "cell, for a tile". The plan's `fenceCell…` names stand. |
| F2 | **The lab's `CONTEXT.md` takes the trade-scenes glossary block verbatim, then the fence words.** Lot edge retired, Gate rewritten. The owner reconciles the two copies on the next foundation → lab sync. |
| F3 | **Second foundation sync before Task 1.** The two Look-inside commits were merged into the lab (never rebase) as `a4f9dc8f4`; a third sync follows when TS3b.4b commits. |
| F4 | **The front-yard cap is per cell at build time**, not per line (§4); `FenceLine.frontYard` is descriptive only. |
| F5 | **The along map is line-major** (`line * rows + cell`), so the paint, re-tile and run encoding of both maps are the tile maps' own code (`paintTiles`, `paintList`, `encodeRuns`) and a lot-line wall is one run. |
| F6 | **Re-tile scatters lines forward** (`scaled(line, lines − 1)`); sampling backwards doubled every line at 1 ft. |
| F7 | **The Today row and the card offer None** (`FENCE_NONE = 0`); the perimeter selects write through the same `applyFenceStroke`. |
| F8 | **Wire v2 lands with the maps (Task 2)**, edges and gates still on the wire until the task that stops drawing them deletes them everywhere (Task 4a absorbs the old Task 5): no commit where the selects write what nothing draws. |
| F9 | **The box parity check matches by nearest box**, never by index. |
| F10 | **Editor chrome colours live in `LAYOUT_EDITOR_LOOK`** (selected, outline, preview); each fence kind carries a `look.color` from the palettes for the preview band. |
| F11 | **`LineRange`** is the code name for `{ axis, line, from, to }`; `GridVertex` for a grid vertex; `vertexAt` lives beside `tileAt`. |
