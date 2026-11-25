# Trade scene: a composable lot and home layout (research, 2026-11-02)

Research for the brainstorm the owner opened on 2026-11-02: make the trade scene's layout data instead of one hard-coded 12 × 8 m ranch, so a rep can compose the real property (lot, house footprint, stories, garage, ground materials today vs proposed) while every thermal, material and weather rule keeps working. Four read-only passes fed this: a coupling audit of the scene, three.js prior art, property data sources, and AI drafting from an aerial tile. Facts marked *(unverified)* came only from third-party pages.

## 1. What the owner asked for (this brainstorm)

- Compose the lot (a rectangle of varying size) and the home (900–3,000+ sq ft, one or two stories, garage attached or detached) per property.
- The ground is the product: regions of the lot each carry a material today and a proposed material. Today: sod, dirt, concrete, asphalt, pavers. Proposed leans dryscape: mulch, artificial turf, decomposed granite, pavers, concrete, keep as is.
- The rep draws regions with a finger on the iPad, **snapped to a tile grid**: lines and rectangles, tiles grouped into regions that move together; a region shows a perimeter and an area. **Areas are display only** (never pricing or scope). **No preset named regions** (too limiting).
- The inside of the house stays **plausible stand-ins**; the outline, stories and garage must be right. No floor-plan data exists.
- Ideal flow: property enrichment (ATTOM or cheaper) + aerial imagery → "on command" draft of the building blocks → the rep fills in the blanks, mostly the landscape.
- Keep the ground math, thermal differences, material logic. Stand on existing work (three.js prior art).

Rulings already on the tracker that a layout system inherits: R79 structure vs materials, R80 stories + garage as inputs, R129/R146/R196/R197 attached-garage heat, R130 6 ft walls / 42 in front fence, R137 single-story neighbours, R139 grade, R140 garage roof follows the house, R142 sun bearing is a scene attribute, R149 the Lot tab (placeholder) feeds dryscaping, R195 gable or hip (open), R198–R201 roof vents per face. It supersedes R144 (every home gets the attached two-car garage) and the 6-A/6-B spec's "house unchanged, 12 × 8 at the origin".

## 2. What exists today (coupling audit)

- **62 files** import `constants/home-geometry.ts` and/or `constants/home-lot.ts`; `src/shared/components/scene/` imports none of them. Almost every consumer builds its box lists **at module scope**, so the refactor is "turn ~60 module-level tables into functions of a layout", not "pass an argument".
- Buckets: **(a) ~30** files of pure shape math a face/plane/region list could replace (shell, rooms, roof, attic, foundation, garage, lot, pan and shadow bounds, wear placers); **(b) ~24** hand-tuned world positions that must become anchors resolved from the layout (equipment, ceiling openings, furniture, residents, rain/leak spots, pins, lane `along`s, plants, piers, flat-roof patches); **(c) ~8** presentation files (framings, orbit, far plane, floor lift) that only need retuning.
- **Already generic:** `HouseWall { run: 'x'|'z', line, outward, from, to, openings }` drives stucco skins (`wall-skin-geometry.ts`), paint, sills, frames, cracks, stains, peeling, wall and window heat lanes and `facesSummerSun`. A rectilinear L/T never needs a diagonal wall, so this contract survives as the **face** type.
- **The five riskiest couplings:** (1) the Partly-open cut (`cutX`, `atticFrontZ`, no front wall, `HOME_FADE_TAGS.complete`) is defined only for a rectangle whose front is +z; (2) roof, insulation bands, `coveringBaseY`, `insideHouse` and the package-unit curb are all f(z) for two rectangular slopes; (3) pins, lanes and system camera views are literal points tuned to the left wall and today's framing, and 6-B edits the same files; (4) ~24 files of equipment/furniture/plant literals that dodge lanes and view lines by hand; (5) ~900 assertions across `verify-trade-scene.ts` and `verify-trade-scene-lot.ts`, many pinned to literal numbers, and a draw budget with +17 draws left after 6-A.
- **The lot today** is the cheap half: one ground strip flat across x (`groundStripGeometry(GROUND_ROWS)`), one lawn canvas texture, eight merged box lists (concrete, joints, asphalt, mulch, walls, caps, fence boards, rails), plants placed by literal x/z, 1-D grade along z. Eleven files touch it.
- **Untouched by a layout refactor:** `resolve-scene` and the construction core, `home-heat`, `heat-lane-flows`, `heat-arrow-lane`, thermal paint and `thermalTag`, ghost/fade sheets, `CameraRig`, sky/sun/fog, `MergedBoxes`/`InstancedPieces`, `neighbour-geometry` (a rect-to-hip-roof seed), `plant-geometry`.
- **Guards:** `verify-trade-scene.ts:907-915` fails any three.js import under `lib/`, `constants/`, `types.ts`; `check-scene-assets.ts` caps `public/scenes/home` at 4 MB; TS3b.6 budget after 6-A: default flat 160 draws / 67.6k tris, +17 draws / +23.5k tris left for 6-B, ≤ 8 MB textures.

## 3. Building blocks (the proposal)

Three ideas carry the whole design. **Tiles** are the unit of the lot. **Masses** are the unit of the house: rectangles on the same grid, each with its own stories and roof. **Faces** and **planes** are derived from the masses and are what everything else (skins, lanes, vents, pins, wear) is generated against.

### 3.1 Data model (sketch; builder refines)

```ts
type GroundMaterial = 'sod' | 'dirt' | 'concrete' | 'asphalt' | 'pavers' | 'turf' | 'mulch' | 'dg' | 'pool'

interface LotLayout {
  grid: { tile: 0.6096; cols: number; rows: number }        // 2 ft tiles; origin = front-left corner, front faces +z
  ground: { today: Uint8Array; proposed: Uint8Array }        // one material id per tile; 0 = unset
  edges: { side: 'left' | 'right' | 'back' | 'front'; kind: 'blockWall' | 'woodFence' | 'vinylFence' | 'none'; from: number; to: number }[]
  grade?: { padEnd: number; walk: number; street: number }   // today's GRADE, per lot
}
// Regions, outlines, perimeter, area and region ids are DERIVED from `ground` by boundary-edge chaining; never stored.

type RoofForm = 'gable' | 'hip' | 'flat'
interface Mass {
  id: string
  cell: { c0: number; r0: number; cols: number; rows: number }   // grid-snapped rectangle
  stories: 1 | 2
  roof: { form: RoofForm; ridgeAxis?: 'x' | 'z' }                // ridge defaults to the long axis; pitch stays a kit constant
  role: 'main' | 'wing' | 'garage'
}
interface HouseLayout {
  masses: Mass[]                 // footprint = union of masses; attached garage = a garage mass sharing an edge with main/wing
  foundation: 'raised' | 'slab'
  front: 'front'                 // the lot side the house faces; the cut and the camera derive from it
  rooms?: { massId: string; cell: Mass['cell']; kind: 'living' | 'kitchen' | 'bed' | 'bath' }[]   // stand-ins, one mass each
}
interface SceneLayout { lot: LotLayout; house: HouseLayout; source: 'default' | 'drafted' | 'edited'; drafted?: DraftProvenance }
```

Derived once per layout by a pure `lib/resolve-layout.ts` (no three.js, same tier as `resolve-scene`): the exterior **face list** (today's `HouseWall`, plus `id`, `sunlit` from the bearing, `eave | gable | shared` flag), **roof planes** per mass with hips and valleys, **attic prisms** per mass, the **cut** (see 3.3), the **garage rect** and whether it shares a face, the **lot bounds**, region outlines, and the **anchor table** (`Record<AnchorId, Vec3>`) that pins, lanes, equipment and camera views read instead of literals.

### 3.2 Why masses, not a straight skeleton

A straight skeleton gives a hip roof over any polygon, but the only maintained JS builds are CGAL in Wasm (330–490 KB gzipped, GPL-tainted) or an unverified 2023 pure-TS port, and the output is planar faces you still have to slice into rafters. Rectangle decomposition keeps everything the attic kit relies on: each mass has a ridge axis, a rafter grid, a triangular attic prism, its own gable ends or hip triangles. The junction rule is the one every SoCal tract L has: the wing's roof runs into the main slope and the valley is the intersection of the two slope planes (45° in plan at equal pitch); the wing's rafters are clipped at that plane. OSMBuildings shows the failure to avoid: one ridge line through the centroid, which silently falls back to flat on most L and T shapes. Constraints to accept on the first cut: a wing is never wider than the main mass; a two-story mass is never smaller than its one-story neighbour; a room lives in one mass.

### 3.3 The Partly-open cut on an L

The cut is the deepest shape assumption in the code. Proposal: the cut is a property of the **main mass** only. "Partly open" removes the main mass's near slope for the part left of a cut plane placed at a fraction of its length, removes its ceiling and attic floor forward of its ridge, and omits its front face, exactly as today; wings and the garage stay Complete. Rooms, the kitchen cut and the attic opening keep their meaning because the main mass is still a rectangle. The front face is the main mass's face toward the lot's front side.

### 3.4 Faces drive everything that is per wall

Wall and window lanes are already generated from `HouseWall`s. The hand-picked `WALL_LANE_ALONGS` become a rule (two per face at ⅓ and ⅔ of the clear run, skipping openings, the door, the steps and a shared garage span). Roof lanes become a per-plane rule (the plane the opening shows from inside, between the attic pin and the roof pin). Roof vents (R199) become "per 400 sq ft of that plane". Gable vents and the attic fan belong to gable faces; a hip mass has none (R195). The sunny side comes from `SCENE_ATTRIBUTES.frontBearing` (R142), which today turns the sun but never the house.

### 3.5 Rendering the ground on an iPad

Store the material map, derive region outlines, and draw **one `ShapeGeometry` per region merged by material** (≤ 9 draws for the whole lot), rebuilt on commit, never during a drag. `THREE.Shape` with holes triangulates through earcut, which three already ships, and `generateTopUV` gives world-metre UVs so a 0.6 m paver texture tiles true. Keep the id map as the source of truth so the one-draw alternative (a plane with a data texture of material ids and a texture array, edits by `texSubImage2D`) is a drop-in later if draws bite. Polygon ops: boundary-edge chaining needs no library; offsets for curbs, borders and fence lines use `clipper2-js` (19 KB gz, BSL); unions across grids, if ever, use `martinez-polygon-clipping` (6 KB gz). Skip `@turf/buffer` (66 KB gz, geodesic) and the Wasm Clippers.

### 3.6 Drawing on the grid

The R3F pattern every source converges on: one invisible ground plane (or `ray.intersectPlane`, so a pointer leaving the mesh never drops the drag), `setPointerCapture` on pointer-down, OrbitControls disabled for the drag (`makeDefault` + `useThree(s => s.controls)`), snap `floor(p / tile)` on move, a single translucent preview plane scaled to the snapped rectangle, commit on up. iPad specifics: `touch-action: none` on the canvas, ignore non-primary touches so a pinch never extends the rectangle, and an explicit **draw mode** so one-finger orbit keeps working outside it. Offer tap-tap (two corners) beside press-drag: a finger drag across a 60-tile lot is long. The editing grid is drei's `<Grid cellSize={0.6096} sectionSize={3.048}>`, one shader plane. No `@use-gesture` or `@react-three/handle` needed.

### 3.7 Where the layout enters

A `layout` is a **drawing-tier input beside `homeMaterials`** (R79 structure), held in the scene inputs store, resolved by `resolve-layout.ts`, carried by a context like `SceneTargets`, and consumed by functions (`lotBoxes(layout)`, `garageBoxes(layout, form)`, `homeAnchors(layout, form)`, `heatLanes(layout, form)`) in place of today's `const` tables. Only the **attached-garage flag** must also enter `SceneResolveInputs`, because R129/R146 make the garage part of the heat model; stories and footprint stay drawing-only unless the owner wants them to move the figures (R43: figures are hand-tuned). Persisting a layout per customer is a JSONB question (ADR 0005) the spec must answer; `PropertyProfile` has no stories, garage or footprint today.

## 4. The draft: from an address to a first layout

### 4.1 The legal gate, first

Google Maps Platform ToS §3.2.3(c): the customer will not "trace or digitize … building outlines … from the … Satellite base map type" nor use Google Maps Content "to improve machine learning and artificial intelligence models". Solar API Service-Specific Terms §20.1 restrict use to the feasibility, design or commercial proposal of **energy systems**, with a 30-day cache (§20.2). Tri Pros no longer sells solar (`project-no-solar.md`). So Google Static satellite tiles and the Solar API's building mask, the cheapest technical route, are **not** usable for a drawing without an owner or legal call. The pipeline below avoids them by default and lists them as an option the owner can switch on.

### 4.2 Three stacks

| Stack | One address returns | Still for the rep | Cost | Risk |
|---|---|---|---|---|
| **A. Free: county GIS + public footprints + public imagery** | LA: parcel polygon with situs address, `YearBuilt1`, `SQFTmain1`, `DesignType1`, plus countywide building outlines with `HEIGHT` ft (every polygon on the parcel is a structure, a second ≥ 300 sq ft one reads as a detached garage or ADU; height ÷ 11 ft ≈ stories). Riverside: parcel + `NUMBER_OF_STORIES`, `ROOF_TYPE`, `GARAGE_TYPE`, `GARAGE_SIZE`, `LIVING_AREA`, `HAS_POOL`. OC: polygon + `YEAR_BUILT`, plus a county 3-inch ortho ImageServer. San Bernardino: polygon + acreage. San Diego: SanGIS shapefile loaded once. Elsewhere: Microsoft/Overture footprints. Imagery: NAIP 0.6 m public domain (may be shown and sent to a model); OC's 3-inch. | Roof form outside Riverside; attached vs detached when one footprint; stories outside LA/Riverside; living area in OC/SB/SD; L/T confirmation where outlines are 2008 vintage. | $0 | Five schemas and CRSs; LA 2020 outlines carry 2008 geometry where unchanged; OC Landbase licence wording *(unverified)*. |
| **B. Cheap: Realie + A's footprints + public imagery** | One Realie (ex-Estated) lookup: parcel MultiPolygon, `lotFrontage/lotDepth`, `stories`, `actualYearBuilt`, `livingArea`, `garageCount`, `pool`, `roofStyle`, `roofMaterial`, `building.shape`, one schema for all counties. Rentcast is the no-polygon alternative (`floorCount`, `garageType`, `roofType`, 50 free a month). ATTOM has no published price and a ~1,000-call lifetime trial. | Garage attachment; a sanity check on `stories`. | Realie free at 25/mo, $50/mo for 1,250 | Tokens per lookup *(unverified)*. |
| **C. Premium: Nearmap AI** | Vector roofs by facet with shape and material, pool, driveway, lawn vs turf, trees, on 5–7 cm imagery: the only source whose output already *is* the draft. Per-report alternatives: Hover $29–69, EagleView $24–87 (roof only). | Verification only. | Quote-based, anecdotally $2k+/yr *(unverified)*; per-report routes cost $1–2k/mo at 50 lookups | Not "relatively free". |

Option the owner can switch on: Google Solar `buildingInsights` (free under 10,000/mo) gives per-plane pitch and azimuth (two opposing azimuths = gable, four = hip, ~0 = flat) and `dataLayers` (free under 1,000/mo) a 0.1 m building mask; both fall under §20.1.

### 4.3 The yard needs one vision pass

No free dataset says lawn vs dirt vs pavers, or where the patio and pool are. The data-only stack covers about half the draft elements (lot, footprint, roof form where available, a garage guess, a driveway corridor from the garage face to the street edge) and nothing in the yard. The evidence on vision models at this task is sobering: on aerial localisation benchmarks the proprietary models score very low when asked for pixel coordinates (IoU 0.03–0.12 on EarthSpatialBench; Gemini 2.5 Pro 8.4 mAP zero-shot on RF100-VL Aerial against 90 for a fine-tuned detector). The lever that works is **asking for grid cells, not pixels**: a thin labelled grid overlaid on the image roughly doubled localisation IoU in Grid-Augmented Vision, and cell or superpixel classification is how EPFL extracts segmentation from GPT-4o, Gemini and Claude. That matches our product exactly, because the rep's grid is the output format.

Recommended pipeline:

0. **Deterministic skeleton** (no AI). Geocode → parcel polygon → footprint polygons → street side (parcel edge nearest the road) → rotate everything to the street-edge bearing → snap to 2 ft tiles → regularise the footprint to right angles → masses by rectangle decomposition → garage lobe = the lobe nearest the street → driveway corridor. Roof form from Riverside/Realie where present, else the house default.
1. **One Claude grid pass** for the yard. Public-domain imagery cropped to the parcel plus 2 m, rotated to the lot axis, ≤ 1,024 px, with the parcel outline and the known footprint drawn on it and a thin labelled grid at 4 ft (2 × 2 tiles). Ask for one row string per grid row, one character per cell (`L` lawn, `T` turf, `D` dirt/mulch/gravel, `C` concrete, `P` pavers, `A` asphalt, `W` pool, `R` roof, `V` canopy, `?` unsure) and objects as polygons in grid coordinates, under a JSON schema; run Haiku twice and Sonnet once, majority-vote cells, keep `?` where no two agree. Cost per address in cents (a 1,024² image is ~1,400 visual tokens). Validate row lengths server-side and retry on mismatch, the main failure of row-string output. Runs as a background job in a Vercel Node function; no Python worker.
2. **Optional edge tightening**: SAM 3 by text prompt through fal.ai at $0.005 per request for the pool, patio or a detached structure, replacing the model's polygon with the mask boundary. A quality knob, not a requirement.

Fallbacks: no imagery → skeleton only with every yard tile `unset`; schema failure twice → the same. Every path ends on the rep's iPad; the draft never blocks. Show the imagery date under the draft.

Known failure modes to design for: shadows read as dirt or asphalt; canopy over the roof distorts footprints (use the county outline, never the model, for the house); covered or green pools read as patio; artificial turf vs lawn is not separable from RGB alone (keep the code, expect the rep to flip it); pavers vs concrete vs asphalt are all grey at 25 cm; parcel lines and fence lines differ by 0.3–1 m (draw the parcel as a dashed hint and let drawn fences win); coordinates must be normalised by the resized image, never a 0–1000 scale, per Anthropic's own guidance.

## 5. Prior art, condensed

| Repo / library | Takeaway |
|---|---|
| furnishup/blueprint3d (MIT, 2k stars, 2021) and blueprint3d-modern (TS, three 0.181, Next 15) | Corners + walls, rooms derived as cycles (unstable ids). Walls as a `Shape` with door/window **holes**, no CSG. Copy the holes idea; skip the model. |
| cvdlab/react-planner (MIT, 1.5k) | Layers with altitude = floors; `Hole { line, offset }` = an opening lives on a wall by offset. Per-wall CSG with a bundled ThreeBSP: avoid. |
| Sweet Home 3D (GPL; model only) | Explicit rooms and explicit levels beat cycle-finding; `heightAtEnd` for gable-end walls. |
| jeepcreep/house-maker-3d (no licence; read only) | A house = rectangular modules on a cell grid with attachments by face and a roof per module: the closest existing model to "masses". |
| OSMBuildings | Ridge through the centroid fails on L/T and falls back to flat silently. |
| StrandedKitty/straight-skeleton (v3 CGAL Wasm 330 KB gz; v1 pure TS, 2023) | Too heavy or unverified; threejs-maplibre's author rejected both and wrote their own (unlicensed). |
| mfogel/polygon-clipping · w8r/martinez · clipper2-js · earcut (in three) | Union/offset/triangulation options; see 3.5. |
| drei `<Grid>` · R3F pointer capture pattern | Drawing grid and drag handling; see 3.6. |
| three `ExtrudeGeometry` | Side UVs are metre-true only for axis-aligned walls: one more reason to snap to the grid. Never stack a second-story extrusion on the first's cap (z-fight); extrude the full height and draw slabs inside, or offset 1–2 mm. |

## 6. A phased route (recommendation)

The lot is cheap and is where the dryscaping value is; the house is expensive and collides with 6-B. So:

- **L1 — Layout object, zero visual change.** `resolve-layout.ts` reproduces today's 12 × 8 house, garage and lot as a `SceneLayout`; the ~60 module-scope tables become functions of it; anchors move into the anchor table; both verify scripts assert layout-relative properties instead of literals. Nothing moves on screen. This is the step that pays for everything after and the one most tempting to skip.
- **L2 — The lot editor.** Tile grid, material map today/proposed, region outlines, draw mode on the iPad, per-region material pickers in the Lot tab (R149), lot size and fence kind per side, the garage and the house staying where L1 put them. Ships dryscaping's visual with no house refactor.
- **L3 — Masses.** Footprint as masses, attached or detached garage from a shared edge (supersedes R144), one story, gable or flat per mass, the cut on the main mass, faces driving skins, lanes, vents and wear. Hip (R195) and the valley rule.
- **L4 — Two stories.** Per mass, with the slab and ceiling rules from 3.2.
- **L5 — The draft.** Stack A or B behind one `draftLayout(address)` job, then the grid pass, then the rep.

Order against the tracker: 6-B (the garage joins the house) edits the same anchor, lane, geometry, vent and shell files. Either 6-B lands first on the rectangle and L1 absorbs it, or L1 lands first and 6-B becomes "an attached garage mass", which is smaller. The owner picks; building both at once in those files is the one thing not to do.

## 7. Questions only the owner can answer

1. **Google.** Use the Solar API and Static satellite under their terms anyway, ask Google, or stay on county data and public imagery? The answer decides whether roof form comes free.
2. **Tile size.** 2 ft (0.6096 m, lines up with 24 in framing and a 60 × 55 grid on an 18 × 33 m lot) or 1 ft (finer paths, four times the tiles)?
3. **Who draws the house.** Does the rep ever draw or move the footprint and garage on the iPad, or only correct what the draft produced (stories, attached/detached, roof form) from pickers?
4. **Persistence.** Does a layout belong to the customer (stored, reopened at the next visit) or to the meeting?
5. **Order.** L1 before or after 6-B?
6. **Scope of materials.** Confirm the today and proposed sets, and whether a pool is a region material or an object.

## 8. Facts not verified

ATTOM prices and whether its detail payload carries garage/roof keys; Regrid API tiers; Google Solar HIGH coverage over LA/OC/SD and Static Maps max zoom; Overture attribute fill rates in SoCal; SanGIS public fields; OC Landbase licence and 3-inch aerial terms; NAIP 2024/2025 vintage; Esri World Imagery derivation rights; Nearmap, OpenSolar, Melissa, Realie per-lookup figures; `straight-skeleton@1` robustness; clipper2-js's exact Clipper2 version; closed editors' touch behaviour; how many of the ~900 assertions would fail (estimated from symbol use, not run); any iPad draw figures (all budgets are headless).

## 9. Sources

Google: [Maps Platform ToS](https://cloud.google.com/maps-platform/terms) · [Service-Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms) · [Pricing](https://developers.google.com/maps/billing-and-pricing/pricing) · [Solar buildingInsights](https://developers.google.com/maps/documentation/solar/building-insights) · [Solar data layers](https://developers.google.com/maps/documentation/solar/data-layers) · [Static Maps](https://developers.google.com/maps/documentation/maps-static/start).
Counties: [LA parcels](https://cache.gis.lacounty.gov/cache/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0) · [LA building outlines 2020](https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/Countywide_Building_Outlines_(2020)/FeatureServer/0) · [Riverside Assessor open data](https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer) · [OC parcels](https://www.ocgis.com/arcpub/rest/services/Map_Layers/Parcels/FeatureServer/0) · [OC aerials](https://www.ocgis.com/arcpub/rest/services/Aerial_Imagery_Countywide) · [San Bernardino parcels](https://services.arcgis.com/aA3snZwJfFkVyDuP/arcgis/rest/services/Parcels_for_San_Bernardino_County/FeatureServer/0) · [SanGIS downloads](https://www.sangis.org/download/index.html) · [USGS NAIP](https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer) · [Microsoft footprints](https://github.com/microsoft/GlobalMLBuildingFootprints) · [Overture buildings](https://docs.overturemaps.org/schema/reference/buildings/building/).
Vendors: [Realie](https://docs.realie.ai/api-reference/v3/property-data-schema.md) · [Rentcast](https://developers.rentcast.io/reference/property-records) · [ATTOM](https://api.developer.attomdata.com/docs) · [Regrid](https://regrid.com/api) · [Nearmap AI](https://developer.nearmap.com/docs/ai-api) · [EagleView](https://www.eagleview.com/pricing/) · [Hover](https://hover.to/pricing/) · [fal SAM 3](https://fal.ai/models/fal-ai/sam-3/image).
Vision: [Anthropic coordinates guidance](https://platform.claude.com/docs/en/build-with-claude/vision-coordinates) · [EarthSpatialBench](https://arxiv.org/html/2602.15918) · [EPFL vision evals](https://fm-vision-evals.epfl.ch/) · [RF100-VL](https://arxiv.org/pdf/2505.20612) · [Grid-Augmented Vision](https://arxiv.org/html/2411.18270) · [SCAFFOLD](https://arxiv.org/pdf/2402.12058) · [Gemini image understanding](https://aistudio.google.com/docs/image-understanding).
Three.js: [blueprint3d](https://github.com/furnishup/blueprint3d) · [blueprint3d-modern](https://github.com/charmlinn/blueprint3d-modern) · [react-planner](https://github.com/cvdlab/react-planner) · [house-maker-3d](https://github.com/jeepcreep/house-maker-3d) · [straight-skeleton](https://github.com/StrandedKitty/straight-skeleton) · [OSMBuildings](https://github.com/OSMBuildings/OSMBuildings) · [polygon-clipping](https://github.com/mfogel/polygon-clipping) · [martinez](https://github.com/w8r/martinez) · [clipper2-js](https://www.npmjs.com/package/clipper2-js) · [three-bvh-csg](https://github.com/gkjohnson/three-bvh-csg) · [drei Grid](https://github.com/pmndrs/drei#grid).
