# Meeting "wow" visualizations: X-ray cutaway + Sun & Energy

Status: scoping, not approved. Owner picked ideas 3 and 4 to flesh out first.

## Backlog kept in view (not scoped here)

1. **Your Home, Reimagined.** Photo of the homeowner's house (rep snaps it, or Street View) rendered with the selected upgrades by an image model, revealed with a WebGL light-sweep dissolve. Needs an image-gen provider (none in-app today) and a visible "concept rendering" label.
2. **Build-your-upgrade configurator.** Homeowner picks shingle color, window frames, siding, paint on a 3D house; picks feed idea 1 and save into `flowStateJSON.tradeSelections`.

Ideas 3 and 4 below are built so their foundation (3D runtime, lazy loading, iPad budget, sync) carries ideas 1 and 2 later.

## Narrative placement

| Step today | Addition | Job in the story |
|---|---|---|
| 2 `specialties` | **Cutaway** inside the showcase media panel, per selected trade | Trust: "this is what we build that others hide" |
| new, after `specialties` | **Sun & Energy** as its own customer-facing step ("Your Home Today") | Pain: their own house, their own sun, their own bill |
| 3 `portfolio` | unchanged | Proof |
| later | idea 1 reveal after portfolio | Desire peak before price |

Adding a step touches four places by hand: `MeetingStepId` in `features/meeting-flow/types/index.ts`, `MEETING_STEPS` in `constants/step-config.ts`, the conditional render in `ui/views/meeting-flow.tsx`, and the hard-coded `currentStep … .max(7)` in `shared/entities/meetings/schemas/index.ts` (trap: forgetting it rejects step 8 at the DAL).

## Shared foundation (both ideas)

- **Runtime:** `three` + `@react-three/fiber` v9 (React 19) + `@react-three/drei`. Loaded with `next/dynamic({ ssr: false })` inside the step only, so the rest of the meeting flow and the public site pay nothing.
- **iPad budget:** `dpr={[1, 2]}`, `frameloop="demand"` (render only on interaction/animation), meshopt/Draco geometry, KTX2 or small WebP textures, under ~3 MB of assets per scene. Need the actual rep iPad model as the performance floor.
- **Offline:** in-home Wi-Fi is unreliable. Preload scene assets when the meeting opens; add a next-pwa runtime cache rule for model/texture paths. Per-home data (idea 4) is fetched before the visit, never live in the living room.
- **No-WebGL fallback:** static pre-rendered stills per state so the step never shows a blank canvas.
- **Reduced motion:** honor the existing `MotionConfig reducedMotion="user"`; skip auto-orbit and particle streams, keep state changes.
- **Second screen (later phase):** the meeting already syncs over Ably `meeting:{id}`. Broadcasting camera pose + slider/toggle state lets a TV or second device mirror while the rep drives from the tablet.

## Idea 3: X-ray cutaway

### Experience

1. A clean 3D section of the roof-and-attic opens, slowly turning. Title: "Your roof today," built from their profile (roof type, year-built era, insulation level).
2. One drag explodes the assembly: layers fan apart vertically, each labeled with what it is and one line on why it matters.
3. Tap a layer for a callout card: what failure looks like (a tagged "during" photo from a matched portfolio project), what we install, lifespan, warranty.
4. "Tri Pros build" toggle: the old assembly rebuilds layer by layer into ours (decking, ice-and-water, synthetic underlayment, drip edge, starter, field shingles/tile, ridge vent, radiant barrier, insulation depth).
5. Optional stress test (bridges to idea 4): rain finds the old flashing; heat arrows pour through the thin attic. Same scene, our version holds.

### Assemblies

| Trade slug | Assembly | Priority |
|---|---|---|
| `roof-and-gutters` | roof section, variants: shingle, tile, flat | 1 |
| `attic-and-basement` | attic bay under the same roof: insulation depth, air sealing, radiant barrier | 1 (same model as roof) |
| `windows-and-doors` | window section: single-pane aluminum vs dual-pane low-E, warm-edge spacer, gas fill | 2 |
| `hvac` | attic ductwork: leaky flex vs sealed insulated ducts | 3 |

Roof + attic share one model, and they are the two energy trades with the highest ticket. Start there.

### Data mapping

| Source | Drives |
|---|---|
| `customer_profiles.roof_type` | roof covering variant (shingle / tile / flat / metal / woodshake) |
| `customer_profiles.year_built` (5 ranges) | era-typical "today" assembly: deck type, underlayment, whether a radiant barrier exists |
| `customer_profiles.insulation_level` (low/medium/high) | visible insulation depth in the "today" state |
| `customer_profiles.windows_type` (single/double) | window "today" variant |
| `flowStateJSON.tradeSelections` | which assemblies appear, which layers highlight |
| `materials` (label, description, outcome, image, lifespan, warranty) via `x_scope_materials` | layer callout copy, so copy lives in data the team already edits |
| `project_media_files` with phase `during` | failure / install photos in callouts |

Missing profile data falls back to the most common SoCal case and the label says "typical," not "your."

### Asset approach

- **Recommended: procedural geometry in code.** Layers are extrusions with PBR textures (CC0 sources such as Poly Haven). Crisp manufacturer-diagram look, tiny payload, and dimensions bind directly to data (insulation depth is a height). No outside artist in the loop.
- Alternative: commissioned Blender models exported as GLB. More realistic, slower to change, harder to parametrize, and each assembly is an outside purchase.

### What the owner must supply

- The exact layer list and products crews install per assembly (brand names, R-values, warranty terms). This is the content that makes it true, and only the field team knows it.
- Which era-typical "today" assumptions are safe to show per year-built range.

### Rough effort

| Slice | Estimate |
|---|---|
| Shared foundation (deps, lazy step shell, fallback, preload) | 2 to 3 days |
| Roof + attic cutaway, two roof variants, three insulation levels, callouts | 1.5 to 2 weeks |
| Each further assembly (windows, ducts) | 3 to 5 days |

## Idea 4: Sun & Energy on their actual lot

### Experience

1. Opens above their real house: aerial imagery of their roof on the ground plane, with a simple 3D massing of the house built from Google Solar API roof segments (pitch, azimuth). Fallback: generic single-story massing.
2. A sun arc computed for their latitude/longitude. A time-of-day slider and month picker, defaulting to a July afternoon. Shadows sweep across their roof live. A heat map from the Solar API flux layer shows which roof planes bake.
3. "Look inside" toggle: the house turns translucent. Heat streams through the roof into the attic and through sun-facing windows. An attic thermometer climbs.
4. A bill meter shows estimated cooling (and heating) cost today.
5. Upgrade toggles, only for trades they selected: cool roof, attic insulation, dual-pane windows, HVAC. Streams thin, thermometer drops, meter ticks down. Savings show as a range.

### Data pipeline

| Need | Source | Notes |
|---|---|---|
| Sun position | `suncalc` (tiny, client-side) + `customers.latitude/longitude` | already stored |
| Roof geometry, sun exposure, flux raster, aerial image | Google Solar API `buildingInsights` + `dataLayers` | per-request billed; call **once when the meeting is scheduled**, decode GeoTIFF server-side, store a PNG + JSON in R2. Server-only key, not the public `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Climate zone | ZIP to California climate zone table, generated once into a constant (same pattern as `scripts/generate-service-area-zips.ts`) | service area spans mostly coastal, LA-basin, inland and high-desert zones |
| Baseline usage + per-measure savings | static table by climate zone × vintage, built once from a published source (CPUC DEER / eTRM deemed measure packages, or NREL ResStock) | do not build a physics simulation |
| Their actual bill | **rep asks "what's your highest summer bill?"** and enters it | anchors every number to something the homeowner said; most persuasive and most defensible |
| Square footage, stories | **not in the schema today** | new fields; placement (column vs JSONB) per ADR 0005 |

### Claims and compliance (must resolve before build)

- The FTC R-value Rule (16 CFR 460.19) requires a reasonable basis for any insulation savings claim and a fixed "savings vary" disclosure; combination claims must break out each product's share. Bill-meter numbers are savings claims.
- The existing outcome lines in `features/meeting-flow/constants/trade-outcomes.ts` already say "20-40%" (attic) and "nearly in half" (HVAC). The visualization's numbers must agree with those lines or the lines change. A homeowner seeing two different numbers in one meeting loses trust.
- Every figure shows as a range, labeled "estimate," with a source footnote. Someone on the business side signs off on the table before it ships.

### Rough effort

| Slice | Estimate |
|---|---|
| Phase A: sun arc + shadows on generic massing, heat-stream overlay, bill meter from rep-entered bill + lookup table | ~2 weeks |
| Phase B: Solar API pre-fetch on scheduling, R2 caching, real roof massing + flux heat map | +1 to 1.5 weeks |
| Phase C: second-screen mirror over Ably | +3 to 5 days |

## Open decisions for the owner

1. Approve roof + attic as the first cutaway.
2. Provide the real layer and product list per assembly.
3. Who signs off energy figures, and is asking for the summer bill acceptable in the meeting script?
4. Enable the Solar API on the Google Cloud project and accept per-request cost (one call per scheduled meeting).
5. Which iPad model reps carry.

## Suggested first slice

A one-week throwaway prototype on an internal dev route, outside the meeting flow: procedural roof + attic cutaway with the explode gesture, and the sun arc with live shadows on a generic house at a real address. Test it on a rep's iPad in a real living room, then decide go / no-go and order of the phases above.
