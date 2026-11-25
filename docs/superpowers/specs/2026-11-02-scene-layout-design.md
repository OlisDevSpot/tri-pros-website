# Scene layout: a composable lot and home (design)

Status: APPROVED by the owner 2026-11-02 (answers to §14, words agreed; treated as approval of the document); stress-tested the same day, rulings S1–S4 in §15 folded in. Tracker rows R206–R214. Research behind it: `docs/plans/2026-11-02-trade-scene-layout-research.md`. Tracker: `docs/plans/2026-10-16-trade-scenes-epic.md` (rows to be registered on approval, from R206).

## 1. Intent

The trade scene draws one hand-measured 12 × 8 m ranch. Every rafter, room, gutter, pin and lane, and the lot and garage around it, derive from the `HOUSE` constants, so the geometry math is reusable but the layout is a single hard-coded instance. The owner wants the layout to be **data**: the real property's lot, house footprint, stories, garage and ground materials, drafted on command from property data and aerial imagery, corrected by the rep on the iPad, and persisted with the customer once the scene joins the meeting flow. Everything the scene already does (thermal model, heat arrows, pins, weather, lenses, materials and upgrades, wear) keeps working on the new layout.

The first business use is **dryscaping**: the rep paints what the yard is today and what Tri Pros proposes, region by region, and the homeowner sees their own lot change.

## 2. Goals, non-goals, anti-goals

**Goals**
- The lot is a tile grid; regions are drawn by finger, snapped to tiles; each region shows its material today and its proposed material, its perimeter and its area.
- The house is one or more rectangles on the same grid: L and T footprints, one or two stories, a garage attached or detached, gable, hip or flat roofs. The rep can correct all of it.
- One address → a draft layout, on command, that the rep corrects. The draft never blocks the meeting.
- The default layout reproduces today's scene closely enough that no owner-accepted look is lost.
- Built in a separate lab beside the working scene, in its own worktree, and swapped in only at parity.

**Non-goals**
- Real floor plans. Rooms stay plausible stand-ins. No data source has them.
- Areas as pricing or scope inputs. Areas are display only; the Notion scope and the proposal stay the truth for quantities.
- Freeform drawing. Everything snaps to tiles.
- Preset named regions ("front yard", "patio"). Too limiting; regions are whatever the rep groups.
- Survey accuracy. Visually plausible, true to what we know of the property.

**Anti-goals** (what would make this a failure even if it worked)
- A refactor that touches the working scene's 60-odd files in place and breaks the look the owner has accepted. The lab exists so this cannot happen.
- Heat lanes, pins or thermal zones that only work on the rectangle. Every per-wall and per-roof rule must be a rule on faces and planes.
- A yard editor that feels like CAD. Two gestures (drag a rectangle, tap a region) and a material picker.

## 3. Owner rulings from this brainstorm (2026-11-02)

| # | Ruling |
|---|---|
| O1 | Drawing is **lines and rectangles snapped to tiles**; tiles group into regions that are affected together; a region has a perimeter and an area; **areas are never used for pricing or scope**. |
| O2 | **No preset named regions.** |
| O3 | Rooms are **plausible stand-ins**; the outline, stories and garage must be right. |
| O4 | Ideal flow: property enrichment + aerial imagery → on-command draft of the building blocks → the rep fills in the blanks, mostly the landscape. |
| O5 | **Google Solar API and Static Maps are used for this test**, despite their terms (the research flagged §3.2.3(c) and Solar §20.1). |
| O6 | **2 ft tiles** now; drop to 1 ft if needed. The model must not bake the tile size in. |
| O7 | **The rep can correct the house layout too**, not only the yard. |
| O8 | **A layout belongs to the customer**: one address, one layout, once the scene links to the meeting flow and the customer. |
| O9 | **The layout object comes before 6-B**, built in a **separate lab** like the realism spike, in its own worktree, so the working scene is untouched until the new approach proves itself. |
| O10 | **Materials come from the Notion catalog** (the Dryscaping & Hardscaping trade); start by inferring from it, then HITL. Pool: Claude's call (see §7). |

Rulings this design inherits from the tracker: R79 (structure vs materials), R80 (stories and garage as inputs), R129/R146/R196/R197 (attached-garage heat and reading), R130 (6 ft property walls, front fence ≤ 42 in), R137 (single-story neighbours), R139 (grade), R140 (garage roof follows the house), R142 (sun bearing is a scene attribute), R149 (the Lot tab feeds dryscaping), R195 (gable or hip; hip has no gable vents or fan), R198–R201 (roof vents per face), R43 (figures are hand-tuned). It supersedes R144 (every home gets the attached two-car garage) once the layout kit replaces the home kit.

## 4. Vocabulary (proposed for CONTEXT.md; the owner agrees the words before code uses them)

- **Layout** — the data that places a home on its lot: the lot's tile grid and ground materials, the house's masses, the garage, the fences. One per customer address. In code `PropertyLayout` (`constants/scene-layout.ts` already names the controls' pixel chrome `SCENE_LAYOUT`, and `verify-trade-scene-layout.ts` checks it; the two must not share a word). _Avoid_: floor plan, site plan, map, scene layout.
- **Tile** — the grid unit of a layout, 2 ft square today (`LAYOUT_TILE` metres; never a literal). _Avoid_: cell, pixel, square.
- **Region** — a connected group of tiles sharing one ground material today and one proposed. Derived from the tile map, never stored; has a perimeter and an area, shown, never priced. _Avoid_: zone, area (the word is taken by Home facts' Area tab), section.
- **Ground material** — what a tile is covered with: today (sod, dirt, concrete, asphalt, pavers, gravel, mulch, artificial turf, pool) or proposed (the catalog's dryscaping materials, or keep). _Avoid_: surface, finish, landscaping.
- **Mass** — one rectangle of the house footprint on the grid, with its own stories and roof form; an L is two masses, the garage is a mass. _Avoid_: wing (a role of a mass), block, volume, module.
- **Face** — one exterior wall of the footprint as the scene draws and reasons about it (today's `HouseWall`, plus its id, whether the summer sun hits it, and whether it is an eave side, a gable end or shared with the garage). _Avoid_: wall (the construction part), side, elevation.
- **Draft** — a layout produced from property data and imagery, before the rep touches it; a layout carries its provenance (`default | drafted | edited`). _Avoid_: auto-layout, AI layout, generated.
- **Lot edge** — one side of the lot's boundary in tile spans, each span with a kind: block wall, low wall, wood fence or none. The front edge never stands taller than 42 in (R130). _Avoid_: fence line, border.
- **Gate** — the wood fence that closes a side yard between the house's face and the lot wall, at a row of the lot; one per side. In code `LotGate`. _Avoid_: return, side fence.
- The lot's two layers are **existing** and **proposed** in code, the scene's `view` axis (S3); the copy says "Today" and "Tri Pros build" through `SCENE_VIEW_LABELS`. `today` is never a code name.

## 5. The layout model

```ts
// constants/layout-grid.ts
export const LAYOUT_TILE = 0.6096            // metres; 2 ft (O6). 1 ft = 0.3048 later; nothing else may hold the number.

// types.ts
export type GroundMaterialId = (typeof GROUND_MATERIAL_IDS)[number]   // §7

export interface LotLayout {
  cols: number; rows: number                 // tiles; origin = front-left corner at grade; the front edge faces the street (+z)
  existing: Uint8Array                       // one GroundMaterialId index per tile; 0 = unset (S3: the scene's `view` word)
  proposed: Uint8Array                       // 0 = keep what is there today
  edges: LotEdge[]                           // per side, in tile spans: blockWall | lowWall | woodFence | none (lowWall = today's 42 in front wall; a front edge is never taller, R130)
  gates: LotGate[]                           // the fence across each side yard at a row, house face to lot wall (today's gate span)
  grade: { padEndRow: number; walkDrop: number; streetDrop: number }   // today's GRADE, per lot (R139)
}

export type RoofShape = 'gable' | 'hip' | 'flat'       // the construction core's RoofForm ('pitched' | 'low-slope') is DERIVED: gable | hip → pitched, flat → low-slope
export interface Mass {
  id: string
  c0: number; r0: number; cols: number; rows: number     // grid rectangle on the lot
  stories: 1 | 2
  ridgeAxis?: 'x' | 'z'                                  // defaults to the long axis; pitch stays the kit's constant
  role: 'main' | 'wing' | 'garage'
}

export interface HouseLayout {
  masses: Mass[]                            // exactly one 'main'; a 'garage' mass sharing an edge with main/wing is attached
  roof: RoofShape                           // one shape for the whole house (R140: the garage follows the house; SoCal wings match their main); per-mass shapes later if ever needed
  foundation: 'raised' | 'slab'
  rooms: RoomStandIn[]                      // stand-ins, one mass each (O3); default from the main mass's length
}

export interface PropertyLayout {
  version: 1
  tile: number                               // LAYOUT_TILE at write time, so an old layout re-tiles instead of mis-scaling
  lot: LotLayout
  house: HouseLayout
  source: 'default' | 'drafted' | 'edited'
  draft?: DraftProvenance                    // address, imagery date, sources used, confidence per part, grid-pass votes
}
```

Rules the resolver enforces (and a verify script asserts):
- Masses do not overlap; a `wing` or `garage` shares at least one full tile edge with another mass or is `garage` + detached; a wing is never wider than the main mass across the main's ridge; a two-story mass is never smaller than a one-story mass it touches (first cut; §12 leaves relaxations to later).
- The main mass's face toward the lot's front row is the **front face**. The cut (§6.3) and the opening camera derive from it.
- Everything is in tiles; metres come only from `tile`. Changing `LAYOUT_TILE` must change nothing on screen for a layout written at the old size (the resolver re-tiles by `tile / LAYOUT_TILE`).

**The layout owns the structure facts (Claude's call, from R79).** The house's `roof` shape and `foundation` live on the layout; `PropertyProfile.foundationType` and the form half of `PropertyProfile.roofType` stop being inputs of their own and are read from the layout at resolve time (`roofFormOf` takes the layout's shape: gable or hip → `pitched`, flat → `low-slope`; the covering material stays on the property). So editing the roof shape on a mass card is a structure edit that re-resolves and changes the offered upgrades, exactly as changing the pitch does today, and "Not sure" on the property falls back to the layout's value instead of a guess. The layout is otherwise a **drawing-tier input** beside `homeMaterials`; stories and footprint do not move the figures (R43). `garageAttached` is derived but enters `SceneResolveInputs` only with 6-B (§11), not before.

## 6. Resolve: layout → what the kit draws

A pure `lib/resolve-property-layout.ts` (no three.js; the tier rule in `scripts/verify-trade-scene.ts` applies) turns a `PropertyLayout` into a `ResolvedLayout`, memoised per layout, carried to the kit by a context like `SceneTargets`:

- **Footprint** — the union outline of the house masses by boundary-edge chaining (no polygon library).
- **Faces** — the outline's segments as `Face extends HouseWall { id; sunlit; kind: 'eave' | 'gable' | 'shared' }`. Openings are placed by rule per face (a window per N tiles of clear run, the front door on the front face at the head of the walk, no openings on a shared face; the shared face gets the interior garage door, superseding 6-B §5.1's "the right window becomes a door"). `sunlit` comes from `facesSummerSun` on the face normal and `SCENE_ATTRIBUTES.frontBearing` (R142).
- **Roof planes** — per mass: two slopes (gable) or four (hip), or a parapet deck (flat), in each plane's own frame as `RoofSlope` draws today. Where a wing meets the main mass, the wing's planes are clipped at the valley plane (the intersection of the two slope planes; 45° in plan at equal pitch) and the wing's ridge stops where it meets the main slope. Gable ends, gable vents (R198) and the attic fan belong to `gable` faces; hip masses have none (R195). Roof vents per plane by area (R199).
- **Attic prisms** — one per pitched mass (joist grid along its ridge, insulation bands by distance from its ridge); `coveringBaseY`, `roofUndersideY`, `insideHouse` become functions of (mass, plane) instead of f(z).
- **The cut** — §6.3.
- **Rooms** — stand-ins laid along the main mass between partitions at fractions of its length (today's thirds), kitchen at the cut end; wings get one room each; the garage is unconditioned (R196).
- **Lot** — bounds in metres, the ground regions (outline + holes per region, perimeter, area), fences and walls per edge span, the driveway as a region the draft paints (not a special object), the walk likewise, the grade profile.
- **Anchors** — `Record<LayoutAnchorId, Vec3>` for every pin, lane endpoint, equipment spot, furniture spot, resident spot, leak and rain field and camera framing target that today is a literal: resolved by rule from faces, planes and masses (the condenser on the sunlit side yard face, the meter beside it, the plenum centred in the main mass's attic, duct runs to each room's centre, and so on). The 24 files of literals become consumers of this table.

### 6.1 Lanes and pins

Wall and window lanes are already generated from `HouseWall`s. `WALL_LANE_ALONGS` becomes a rule: two lanes per face at ⅓ and ⅔ of the clear run, skipping openings, the door, the steps and a shared span. Roof lanes become a rule per plane: the plane the opening shows from inside, between the attic pin and the roof pin of that mass. Reading pins keep the callout-pin standard (dot on the measured spot, short pixel offsets) and sit on the main mass's sunlit face, roof plane and ceiling; the garage gets its reading (R197).

### 6.2 Thermal zones

Zone tags are on groups and resolved by nearest tagged ancestor; that stays. The garage mass is its own zone (R196). A wing shares the main mass's room zone. Faces carry `sunlit`, so the paint's sunlit/shaded split follows the bearing on any footprint.

### 6.3 The Partly-open cut on an L

The cut is a property of the **main mass only**. Partly open removes the main mass's near slope for the part left of a cut plane at today's fraction of its length (`cutX / halfLength`), removes its ceiling and attic floor forward of its ridge, and omits its front face, exactly as today. Wings and the garage stay Complete. The fade tags (`complete`, `raised`, `slab`) and the fade sheets keep their meaning because the cut parts are still the main rectangle's.

## 7. Ground materials

Two sets, both `GroundMaterialId`s in `constants/ground-materials.ts`, each with a label, a render look (colour, texture key, a height: a pool is recessed, pavers and concrete sit a hair proud of sod) and a catalog link where one exists:

- **Today** (what SoCal yards are): `sod`, `dirt`, `concrete`, `asphalt`, `pavers`, `gravel`, `mulch`, `turf` (artificial), `pool`.
- **Proposed** (what Tri Pros installs; `0` = keep): the catalog's Dryscaping & Hardscaping scopes, which today seed as Install Artificial Turf, Gravel, Mulch, Decomposed Granite, Concrete, Pavers, with their materials (artificial turf, red and black mulch, gravel, decomposed granite, river rocks, concrete, pavers). The ids are short words (`turf`, `dg`, `river-rock`, `mulch`) and every proposed material carries an explicit `catalog` link to the seed's scope and material accessors (S4: a material accessor is per variant, red and black mulch, so one id cannot be one accessor; river rock links to the gravel scope, having none of its own). A region's proposed material resolves to a scope through that link (O10). Material **variants** (red vs black mulch) are a look on one material, not separate regions.

**Pool: a ground material, today only.** It occupies ground, has a perimeter the dryscape is drawn against, and shows as recessed water with coping (L2 draws it as a flat water strip; the recess and coping come with objects, since a strip sunk under the lawn would never show). It never appears in the proposed set except as "keep". Things that sit on tiles without covering them (trees, the condenser, a patio cover, a shed) are **objects** on anchors, not materials; the draft places trees and the rep moves them later (objects beyond trees are out of this design's first cut).

First cut (L2): the proposed set is a constant whose catalog accessors are checked against the seed files by the layout check. Reading the Notion catalog at build time, so a new scope appears as a material without a code change once it has a look, comes with the meeting-flow integration (TS4).

## 8. The editor

A **draw mode** on the scene, entered from the Lot tab (R149) or a chip; outside it, one-finger orbit and the camera slide work as today.

- The ground shows the tile grid (one line mesh on the grade, draw mode only; drei's `Grid` is a flat plane and the front yard slopes) and the regions' outlines.
- **Drag a rectangle** on the ground: pointer capture, OrbitControls off for the drag, snap on move, one translucent preview plane, commit on up. **Tap-tap** (two corners) is the alternative to add after the owner's iPad look if a finger drag across a 60-tile lot feels long (L2 ships drag only; plan decision 2026-11-02). Non-primary touches are ignored so a pinch never extends the rectangle. `touch-action: none` on the canvas.
- A committed rectangle takes the **current brush**: an existing material, a proposed material, or both; on the build row **Keep** paints `0` (keep what is there) and **No change** leaves the layer alone. Painting over an existing region re-groups tiles; regions are recomputed on commit.
- **Tap a region** to select it: a small card shows its two materials, its perimeter and its area (ft and sq ft, from tiles), and lets the rep change either material or clear it.
- **Fences and walls** are per lot side in the Lot tab (kind per side; a front fence ≤ 42 in).
- **House editing (O7)**: in draw mode, the masses show handles; the rep drags a mass, resizes it by its edges, adds a wing or a garage from the Lot tab, toggles attached by snapping it against a face, sets stories and roof form per mass from the mass's card. Invalid states (overlap, a wing wider than the main) snap back, never error.
- **Today / Tri Pros toggle** paints the lot with the today or the proposed materials, the way the home's build switch already works, so the homeowner sees their yard change.
- Undo is per commit, in the store, ten steps.

The lot renders as **one merged strip mesh per ground material per layer** (a quad per run of tiles in a row, its corners on the grade, world-metre UVs so a 0.6 m paver texture tiles true; ≤ 9 draws for the lot), rebuilt on commit; sod is the base ground strip itself. Strips beat one `ShapeGeometry` per region because the front yard slopes and a region spanning the pad's end must bend with it (plan decision 2026-11-02). The tile map stays the truth so a one-draw data-texture ground can replace it later if draws bite.

## 9. The draft

One server procedure, `draftLayout({ address, lat, lng })`, in the trade-scenes feature's server tier. **Before TS4 it is a synchronous tRPC mutation that returns the layout** (Claude's call: no schema change for the lab; county + Solar + Static Maps + three model runs take tens of seconds, within the route's `maxDuration`); the lab shows a progress state and drops the result into the store and the URL. With TS4 the same procedure runs as a background job that writes `sceneLayoutJSON` (§10) and the editor polls it. Either way the draft carries its provenance and the rep's screen shows the scene until it lands.

0. **Deterministic skeleton.** Parcel polygon from the county (LA, Riverside, OC, San Bernardino ArcGIS REST; San Diego from the SanGIS file loaded once; Realie as the one-schema fallback if the owner wants it). **Google Solar** `buildingInsights` (roof segments: pitch and azimuth → gable, hip or flat; height) and `dataLayers` building mask (0.1 m/px) → footprint polygon → right-angle regularisation → **masses by rectangle decomposition** → the main mass is the largest, the garage is the lobe nearest the street with a garage-sized footprint, stories from height ÷ ~11 ft or the county's stories field. Street side = the parcel edge nearest the road; rotate to it; snap to tiles. Driveway = the corridor from the garage face to the street edge, painted `concrete` (or `asphalt` if the imagery says so).
1. **One vision grid pass** for the yard. **Google Static Maps** satellite at the highest zoom with tiles, cropped to the parcel + 2 m, rotated to the lot axis, ≤ 1,024 px, with the parcel outline and the known footprint drawn on it and a thin labelled grid at 4 ft (2 × 2 tiles). The model returns one row string per grid row (one character per cell from the today set plus `?`) and objects as polygons in grid coordinates, under a JSON schema; three runs (two small, one larger model), majority vote per cell, `?` where no two agree, row lengths validated and retried once. The result upsamples to tiles, is clipped to the parcel, and the footprint from step 0 overrides it. Runs through the app's existing `ai` SDK; the provider is the one already configured (OpenAI). Adding Anthropic's provider is a dependency change the owner approves separately.
2. **Optional edge tightening** (not in the first cut): SAM 3 by text prompt for the pool and patio.

Every path ends in the editor; a failed step leaves that part `unset` with a note on the card. The imagery date shows under the draft. Provenance keeps what each part came from so the rep knows what to trust.

Known weaknesses the editor must absorb: shadows read as dirt or asphalt; artificial turf and sod are not separable from RGB; pavers, concrete and asphalt are all grey; parcel lines and fences differ by up to a metre (the parcel is a dashed hint; drawn fences win); covered pools read as patio.

## 10. Persistence

The layout is fetched whole with its customer and never queried into in SQL, so by ADR 0005 it is **JSONB**, a `sceneLayoutJSON` column on `customer_profiles` (1:1 with the customer, O8), validated by a zod schema with `version`, written whole. It lands with the meeting-flow integration (TS4), not with the lab; until then the lab keeps the layout in the scene inputs store and the URL (`?layout=` for sharing a test case), and ships a handful of **fixture layouts** (today's ranch, an L with an attached garage, a two-story T with a detached garage, a flat-roof slab home) that double as the verify script's cases.

## 11. The lab, the worktree, parity

- **Worktree** off `feat/trade-scenes-foundation` (S2, the owner's ruling at the stress test: the branch the plan was written against, ten commits past the ship snapshot); the branch merges `origin/main` into itself after the ship squash (never rebased). Branch `feat/scene-layout-lab`.
- **Lab page** `/dashboard/labs/scene-layout` (super-admin, like the realism spike), components under `src/features/trade-scenes/ui/components/layout-kit/` beside `home-kit/`, pure code under `lib/` and `constants/` as everywhere else. The lab mounts the **layout kit**: a second kit built from `ResolvedLayout`, reusing every primitive the audit found untouched (`MergedBoxes`, `InstancedPieces`, `wall-skin-geometry`, `wall-boxes`, `window-boxes`, the wear placers, thermal paint and tags, fade sheets, `CameraRig`, sky, sun, fog, `neighbour-geometry`, `plant-geometry`) and re-implementing only what reads the constants, as functions of the layout. **In L1 and L2 the layout kit replaces the lot only**: the house and the garage are still drawn by today's components at today's constants, and the layout's main mass is anchored to them (`lotOrigin`); L3 brings the house itself under the layout. The working scene changes in eight guarded hunks and nowhere else (S1): `types.ts` (the types and the `layout` input), `home-scene-defaults.ts`, `home-kit.tsx` (a lot slot read from `LotSlotContext`, default = today's `Lot`), `trade-scene-view.tsx` (an optional `inputs` store prop), `lot-height-at.ts` (delegates to `heightOnRows`), `home-lot.ts` (an exported `STREET_BAND` that `STREET_Z` is built from), `lot-boxes.ts` (its private wall, fence and street helpers move to `lot-box-parts.ts`, which both kits compose; the lot check proves the output unchanged) and the shared scene camera store's `drawing` flag (the camera rig's DOM tap tracker and wheel and the orbit controls honour it, so a draw never glides the camera), plus `schemas/` joining the scene check's three.js guard and three assertions in it.
- **Parity gate** before the swap: on the default layout the layout kit matches the home kit by eye in the four weathers, both home views, Thermal, raised and slab, pitched and flat, within budget: **the layout kit draws no more calls and triangles than the home kit measured on the same layout at build time** (the tracker's figures move with every build: R121 and R204 already added to the 160 / 67.6k in the research; never copy a number), with screenshots side by side in the lab. Then one change swaps `/dashboard/trade-scene` to the layout kit and deletes `home-kit/`, the two geometry constants files and the literal tables; `verify-trade-scene-lot.ts`'s literal assertions are rewritten as layout-relative properties.
- **6-B** (the garage joins the house) is re-planned on the layout kit as "an attached garage mass", which is smaller than its current spec. **L3 is geometry only** (O9: the layout comes before 6-B): until 6-B the attached garage reads under Thermal as today's standalone garage does, and `garageAttached` has no resolve-tier consumer. 6-B then brings the heat rulings (R129/R146/R196–R201: the garage zone and reading, the shared face losing its vent, roof vents per plane) onto the garage mass.

## 12. Phasing

| Step | Delivers | Gate |
|---|---|---|
| **L1** The lot as data, at parity | `PropertyLayout`, `resolve-property-layout.ts`, the layout kit drawing the lot on the default fixture with the house drawn by today's components (the house's own re-implementation and the anchors table are L3's), `verify-property-layout.ts` | parity screenshots + budget |
| **L2** Lot editor | tile grid, today/proposed materials, regions, draw mode, region card, fences per side, Today/Tri Pros on the lot | owner on the iPad |
| **L3** Masses | L/T footprints, attached/detached garage, gable/hip/flat per mass, the valley, the cut on the main mass, mass editing | the four fixtures |
| **L4** Two stories | stories per mass, slabs, lower-roof meeting a wall | fixtures |
| **L5** Draft | `draftLayout` with Solar + county + Static Maps + grid pass, provenance, imagery date | ten real SoCal addresses the owner picks |
| **Swap** | layout kit replaces home kit; 6-B re-planned | owner's call |

L1 and L2 can run in one plan; L3 after; L5 is independent of L3/L4 once the model exists and can run in parallel in its own files (server tier).

## 13. Left to the builder

The exact opening rule per face (window count and spacing); the valley clipping math and the wing-ridge termination; the regularisation of a Solar mask into right angles; the region-card layout (the Controls' value-menu conventions apply); how the brush is chosen on the phone; fixture dimensions; the shape of `DraftProvenance`; texture choices per ground material within the 8 MB budget; where the grid pass prompt and schema live (server tier, beside the job).

## 14. Open questions (after the builder check, 2026-11-02): all settled

The builder check asked five questions. Settled in the text above: structure facts are owned by the layout (§5, Claude's call); the draft is a synchronous mutation before TS4 (§9, Claude's call); L3 is geometry only and 6-B brings the heat (§11, from O9); the parity budget is measured, never a number (§11); the new type is `PropertyLayout`, not `SceneLayout` (§4). The owner answered the rest the same day:

1. **Partly open on a two-story main mass (L4): both floors are exposed** (owner: "the 1st story also exposed in partial view in 2+ story houses"). The cut treats the upper floor like the ground floor today (near slope off left of the cut plane, the upper ceiling and attic floor off forward of the ridge, the upper front face off) and also cuts the upper floor's slab forward of the ridge, so the ground rooms read from above; kitchen and living stay downstairs, bedrooms and their residents go upstairs; lanes run attic → upper ceiling → upper rooms and upper floor → ground rooms; the thermal zones gain an upper room zone. L3 and L4 shape `insideHouse` / `coveringBaseY` per (mass, story) for this; L1 and L2 leave the house to today's components (§12).
2. **Counties for the first draft (L5): the service area, no San Diego.** Encino up through the Antelope Valley (LA County), the rest of LA, Riverside and Orange: all live ArcGIS REST calls, nothing to store; San Bernardino stays a live call too. The SanGIS import is out. The Solar API + Static Maps still need enabling on a **server** key with billing (the app's only Google key is the public Places/geocoding one): an owner console action before L5 starts.
3. **Words agreed** (§4): Layout, Tile, Region, Ground material, Mass, Face, Draft; added to CONTEXT.md.

## 15. Stress-test rulings (2026-11-02, after the L1+L2 plan)

| # | Ruling |
|---|---|
| S1 | **Eight guarded hunks, not six.** The scene camera store gains a `drawing` flag the camera rig honours (taps, wheel, orbit), and `lot-boxes.ts`'s private helpers move to `lot-box-parts.ts` so the layout kit composes the same walls, fences and street instead of copying them. Both are additive and guarded by the existing checks. |
| S2 | **The lab worktree branches off `feat/trade-scenes-foundation`**, not the ship snapshot; it merges `origin/main` after the ship squash. |
| S3 | **The lot's first layer is `existing` in code**, the scene's `view` word; "Today" stays the copy. `today` is never a code name (the glossary's Existing-conditions entry already avoids it). |
| S4 | **Material ids stay short words with an explicit `catalog` link** per proposed material (scope and material accessors, checked against the seed files); river rock links to the gravel scope; mulch's default variant is red. |

Plan-level corrections folded in at the same time: two sod regions on the default lot (the strip between the walk and the driveway is an island) and no holes; the fence board count per gate; the driveway apron across the parkway by rule (a paved run on the front row at least 4 tiles wide); the pool flat in L2; the stoop inside the concrete list (nine lot meshes, as today); the tile grid as a line mesh in draw mode; the front edge capped at 42 in; URL state through nuqs with an 8,000-character cap; the probes parametrised before any task shoots; `LotGate` for the side-yard fence and `LotOrigin` for the lot's placement (frame is the presentation's word).
