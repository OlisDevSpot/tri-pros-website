# Home scene: a lived-in home that zooms into the work

**Status:** approved by the owner 2026-10-16.
**Requirements:** `docs/plans/2026-10-16-trade-scenes-epic.md` §3 (R1–R31) is the register. This spec argues from it, and a requirement changes there first.
**Builds on:** `docs/superpowers/specs/2026-10-15-3d-presentation-scenes-and-assembly-cutaway-design.md` (the "foundation spec"). That spec keeps its authority for the three tiers (§4), the construction model (§4.2), savings (§5.3), the meeting opening and closing (§5.1, built in TS4), and its §12 amendments. **This spec replaces its §5.2, §5.4 and phase 3**, and amends what §2 below lists.

## 1. Intent

In the living room, the agent opens a home that looks like the homeowner's: the same kind of roof, the same era, the same kind of household. The sun beats on it, it rains on it, a cold night falls on it. A thermal camera shows the heat the way an inspector's FLIR does. The residents feel it, the AC strains and the meter spins. Tap the roof and the camera glides inside to the layers we install. Switch to the Tri Pros build: the parts drop in, the heat narrows to a trickle (or the water sheds to the gutter), the residents relax, and the savings show.

It must stay **general** (R6). The home is drawn once. Every later trade (HVAC and ducts, dryscaping, pavers, walls, the crawl space) plugs in as one assembly kit at an anchor on the same home.

## 2. Amendments to the foundation spec

| Foundation | Now | Why |
|---|---|---|
| D13: WebGL plus a WebGPU look-dev option | **WebGL only.** The WebGPU option is dropped; a port goes on the tally (T11). | Thermal paint cannot draw under WebGPU (foundation §12.1), so the option cannot show the story. R20. |
| D18: wood shake and metal draw as the nearest covering | **Wood shake is modeled as its own covering.** Metal still draws as the nearest covering (T1). | R4, R14. |
| D19: phase 3 deletes every prototype file and `/dashboard/labs/roof-cutaway` | **The prototype stays, frozen**, as a stable reference. Nothing in this build edits `src/features/meeting-visualizations/`. | R21. |
| D11, §5.4: a premium architectural look with three material options | **Warm stylized** (§6.1); ironbow is the thermal palette. Ribbon style stays a super-admin option until picked. | R9, R11, R20. |
| §5.2: a section-only cutaway | **A home kit plus assembly kits** (§4). | R8, R19. |
| Season `summer \| winter` | **Weather `summer \| winter \| rain`** plus **Climate `coastal \| inland`** (§7). | R12, R13. |
| `FLOW_ENDS` and "temperatures are never shown as numbers" | **°F readings are shown** as estimates behind an asterisk, from a readings walk under a climate preset (§7.1). The relative drawing walk stays for paint and ribbons. | R12, R26. |
| §12.2 open: the radiant barrier narrows the ribbon but does not cool the paint | **Closed.** The barrier cools the paint and has a winter reflectance (§7.2). | R27, R16. |
| `/dashboard/labs/cutaway-look` is the look-dev page | Superseded by `/dashboard/labs/trade-scene` (§8). It stays until the owner retires it. | R20, R21, owner rule: keep liked surfaces. |

## 3. Vocabulary

Added to `CONTEXT.md` § *Trade scene terms*:

- **Home kit**: the scene kit that draws the whole house from the property profile, plus the residents, the sky and the yard. It exposes anchors. One per app.
- **Assembly kit**: the scene kit for one assembly (`roof-attic` first), drawn at its anchor when zoomed. It replaces the foundation's "scene kit" for this meaning (folder `assembly-kits/<assembly-id>/`). _Avoid_: section kit (CONTEXT.md avoids "section" for assemblies).
- **Anchor**: a named place on the home where an assembly kit sits, plus its camera framing (`roof`, `attic`, `exterior-wall`, `yard`, `under-floor`).
- **Weather**: `summer | winter | rain`. Picks the assembly's mode (heat or water) and the sky. _Avoid_: condition (taken by part condition), season (code keeps `Season` only inside the heat walk).
- **Climate**: `coastal | inland`, the preset behind the °F readings.
- **Readings**: the °F estimates pinned on the thermal camera (roof surface, attic air, ceiling surface).
- **Comfort**: `strained | fair | comfortable` (summer: hot → comfortable; winter: cold → cozy), derived from the ceiling surface reading. It drives the residents and the equipment.
- **Residents**: the people in the home, cast from the household type and age group. _Avoid_: family (only one household type), avatars.
- **Burst**: the ~10 s of life after an input changes, before the scene rests (R23).
- **Thermal camera**: the whole-scene ironbow view with readings. On screen "Thermal camera". It replaces the foundation's "heat view" toggle.

Unchanged: scene, scene inputs, scene targets, trade scene, assembly, part, part material, part condition, existing conditions, proposed build, basis. "Tri Pros build" is screen copy only; code says proposed build.

## 4. Architecture

```
Controls (DOM) ──► Scene inputs (one store per open scene)
                         │
                         ▼  pure
              resolveScene(inputs) → scene targets
        ┌────────────────┼──────────────────────────┐
        ▼                ▼                          ▼
   Home kit         Assembly kit at its anchor   DOM panel
   (house, residents,   (layers, ribbons,        (story, layer list,
    sky, equipment)      pins)                    readings, savings)
```

- **One resolved model feeds every surface.** `resolveScene` composes the construction model (existing conditions → resolved parts → relative flow → readings → savings) once. The home kit, the assembly kit and the panel read the same targets, so a colour, a reading, a ribbon width and a dollar figure can never disagree.
- **The kit registry** (`features/trade-scenes/constants/assembly-kits.ts`) maps each `AssemblyId` with a kit to `{ anchor, weathers, framing, Kit }`. v1 registers `roof-attic` → `roof`, `['summer', 'winter', 'rain']`.
- **The contract (the generalization test):** a later kit (HVAC and ducts, T3) adds its construction data (already in the model), one assembly kit and one registry line. It changes nothing in the home kit, the camera rig, the weather, the thermal camera or the panel. If it has to, the contract is wrong and is fixed before that kit ships.
- **Home-level comfort** combines the heat walks of every thermal assembly the home draws. In v1 that is only `roof-attic`.
- The foundation's three tiers and its ESLint boundary stand. New primitives (§9) know nothing about construction. The construction changes (§7) import no three.js.

**Scene inputs** (seeded once on open, discarded on close):

| Input | Values |
|---|---|
| `property` | `PropertyProfile` |
| `household` | `{ type, ageGroup }`, both nullable |
| `view` | existing \| proposed |
| `weather` | summer \| winter \| rain |
| `climate` | coastal \| inland |
| `thermalCamera` | on \| off |
| `zoom` | `null` \| an `AssemblyId` |
| `proposedScopeIds` | previewed scopes |
| `addOns` | `cool-roof`, `ducts` |
| `peel` | 0..1 |
| `emphasizedPart` | a part, or none |
| `bills` | typed amounts |
| `overrides` | per the foundation |
| `look` | `{ ribbonStyle }` |

## 5. Folders

`src/features/trade-scenes/`, following the repo's file rules (one component per file, `constants/`, `hooks/`, `lib/`, named exports):

- `ui/views/trade-scene-view.tsx`: the lab page's view.
- `ui/components/home-kit/`: house shell, rooms, roof forms at house scale, yard, sky, equipment (condenser, wall unit, window unit, meter, thermostat), residents, bucket and stain.
- `ui/components/assembly-kits/roof-attic/`: one renderer per part, at section scale.
- `ui/components/panel/`: story panel, layer list, readings legend, weather and climate controls, savings, the Look drawer.
- `lib/resolve-scene.ts`, `lib/cast-residents.ts`, `lib/comfort-from-readings.ts`.
- `constants/`: anchors, the kit registry, the cast table, comfort thresholds, copy.

The lab page is `src/app/(frontend)/dashboard/labs/trade-scene/page.tsx`, super-admin only, with the same guard as the other labs pages.

## 6. The home kit

### 6.1 Look (R9, R18)

Warm stylized: soft rounded forms, matte materials, a restrained warm palette, no faces (or simple ones). Residents and furniture come from **CC0 packs** (rigged, animated, recoloured to the palette). Anything missing is built in code from simple shapes. **The house itself is built in code** so it can be cut open, painted thermally and have its parts swapped.

### 6.2 The house from the profile

| Profile field | What the home draws |
|---|---|
| `roofType` | Gable roof at house scale with shingle, tile or wood shake (wood shake on spaced boards). `flat` is a low-slope roof with a parapet and a thin joist space instead of an attic. `metal` draws as the nearest covering. |
| `yearBuilt` | Era cues only: window frames and trim. The parts themselves come from the existing conditions. |
| `foundationType` | `raised`: a crawl-space skirt with vents. `slab`: the house on grade. Unknown: slab. |
| `hvacType` + `hvacComponents` | `central`: a side-yard condenser and attic ducts. `wall-mounted`: a wall unit. `portable`: a window unit. Furnace-only: no outdoor unit. Unknown: central. |
| `windowsType` | Single or double glazing (frame thickness). Unknown: single. |

The house is a one-story SoCal ranch with stucco walls (R20; two-story is T15). It is cut open toward the camera like a dollhouse: living room, kitchen, one bedroom, and the attic above. An electric meter is on the outside wall; a thermostat is in the hall.

### 6.3 Residents (R15)

| `householdType` | Cast |
|---|---|
| Single man / Single woman | one adult |
| Couple | two adults |
| Family | two adults, two children |
| Relatives | three adults across two generations |
| unknown | a neutral couple |

`ageGroup` sets how old the adults look: 25–45, 45–65 or 65+. The agent recasts with one tap in the panel (a scene input, never saved). The residents are stylized and faceless, so the cast never reads as a portrait.

### 6.4 Comfort and life (R10, R23)

- **Comfort** comes from the gap between the ceiling surface reading (§7.1) and the preset's indoor setpoint. A gap of 1.5 °F or more is strained; 1.0 °F or less is comfortable; either season (tracker R33). These are starting values, tuned at the owner's look pick.
- **Comfort drives:**

  | Who / what | Strained | Comfortable |
  |---|---|---|
  | Summer residents | fan themselves, slump | sit relaxed, play, watch TV |
  | Winter residents | wrapped in blankets, hunched | cozy |
  | Equipment | runs hard: condenser shake, heat shimmer, fan speed (the heater glows in winter) | cycles calmly |
  | Thermostat | shows the setpoint with a "running" mark | calm |
  | Meter | spins in proportion to the energy cost the savings panel shows; with no bill typed, it spins in proportion to relative heat flow | |

- **Rain** (§6.5) has its own life: the residents look up at the drip and the bucket.
- **Bursts (R23):** any input change wakes the scene for about 10 s of animation, then everything eases to a resting pose and the scene stops drawing. A touch wakes it. Reduced motion: no bursts, and the final pose shows at once.

### 6.5 Weather (R13)

| Weather | Sky and setting | Existing conditions | Proposed build |
|---|---|---|---|
| Summer | afternoon: hard sun high, warm sky, shimmer off the roof | | |
| Winter | evening: cold blue sky, warm-lit windows, breath-cold outside | | |
| Rain | overcast, falling rain, gutters running | where the water walk (§7.3) reaches the ceiling, a stain spreads over the room below and a drip falls into a bucket | the home stays dry, water sheds to the gutters |

### 6.6 Thermal camera (R11)

- **The toggle** repaints the whole scene in ironbow (black → purple → red → orange → yellow → white) on one fixed °F scale, so the colours mean the same thing in every view.
- **The scale bar** sits at the edge of the canvas.
- **Readings** are pinned as °F labels with an asterisk: roof surface, attic air (or joist space on a flat roof) and ceiling surface. The asterisk opens a popover: "Estimate for a typical {coastal | inland} {summer afternoon | winter night}. Real temperatures vary." Its wording is finalized with the disclosure sign-off.
- **Residents read about 98 °F** (warm bodies), the signature FLIR look. Equipment reads hot when strained.
- **Under Rain**, the thermal camera shows wet areas cooler (evaporation), where the water walk soaks.

### 6.7 Zoom

- Tap an anchor (in v1 the roof), or the "Inside the roof" chip. The camera glides to the anchor's framing (`SCENE_MOTION` timing), the home fades to a ghost around it, and the assembly kit fades in at the anchor.
- "Back to the home", or a pinch out, reverses it.
- The view, weather, climate, thermal camera and scopes carry across the zoom unchanged, and so do the readings.

## 7. Construction model changes

### 7.1 Climate presets and readings (R12, R26)

- `core/constants/climate-presets.ts` holds the presets:

  | Climate × weather | Outside | Indoor setpoint |
  |---|---|---|
  | coastal × summer (afternoon) | 82 °F | 76 °F |
  | inland × summer (afternoon) | 100 °F | 76 °F |
  | coastal × winter (night) | 45 °F | 70 °F |
  | inland × winter (night) | 38 °F | 70 °F |

  Summer adds a solar load on the outer surface, scaled by its reflectance. **All starting values; sourced before release.**
- `core/lib/thermal-readings.ts`:
  - **signature:** `thermalReadings(parts, climate, season) → { roofSurface, atticAir, ceilingSurface }` in °F;
  - **method:** a steady-state series walk: outer surface (sol-air in summer) → each part's R-value and reflectance → the attic air node (the air space between deck and insulation) → ceiling surface → indoor setpoint;
  - **estimates:** shown only with the asterisk.
- **Rule: room air is never shown.** With the AC running it sits near the setpoint. What people feel, and what comfort reads, is the ceiling surface.
- The relative drawing walk (`relativeHeatFlow`) stays for paint and ribbon widths. Its ends come from the same preset, normalized to the fixed thermal scale, so the paint and the readings agree. `FLOW_ENDS` is deleted. Its comment "never shown as numbers" no longer holds.
- **Assertions:**
  - more insulation lowers the ceiling surface;
  - a cool covering lowers the roof surface;
  - inland reads hotter than coastal in summer and colder in winter;
  - every reading falls within the thermal scale.

### 7.2 Radiant barrier (R16, R27)

- The radiant barrier's `thermal` gains a winter reflectance. **Placeholder until sourced.**
- `relativeHeatFlow` and `thermalReadings` both apply every present part's reflectance in the season where it acts, so the barrier cools the paint and narrows the ribbon alike.
- In winter, the share the barrier turns back is drawn as a ribbon branch arcing back down toward the rooms (the foundation's `FlowRibbon` supports branches).
- **Assertion:** in winter, the barrier's reflected share is above 0 and below its summer share.

### 7.3 Modes per weather and the rain walk (R28)

- An assembly's single `mode` becomes `modes: Partial<Record<Weather, EnergyMode>>`. Values:
  - `roof-attic`: `{ summer: 'thermal', winter: 'thermal', rain: 'water' }`;
  - `yard-ground`: `{ summer: 'water', rain: 'water' }`;
  - the other assemblies: thermal for summer and winter.

  A weather missing from an assembly's `modes` still renders the home in that weather, but its assembly kit shows that weather's sky with no flow and the panel says so.
- **The rain walk.** `relativeWaterFlow` gains a rain source: rain demand 1 at the outer surface, walking outside → in.
  - A water-shedding part (`role: 'shed-water'`) passes water through only when it is `worn` or `absent`. An intact one sends it on to the drip edge and gutter, and records the shed share.
  - Below the shedding parts, a `worn` deck absorbs and shows rot. Whatever passes the deck reaches the ceiling (stain + drip).
  - **Irrigation rule:** the existing irrigation rule stays for the yard (`irrigate` gates supply).
- **Assertions:**
  - existing conditions of a 1950–1978 shingle roof reach the ceiling in rain;
  - every proposed re-roof sheds 100 % to the gutter;
  - a deck-only redeck under worn shingles still leaks.

### 7.4 Cool roof add-on (R25, R29)

- `BILL_CUT_ADD_ON_IDS` becomes `['ducts', 'cool-roof']`, labelled "Cool roof".
- The `roof-and-gutters` energy cut moves from the trade's base cut into its `cool-roof` add-on. The base cut keeps only what holds without a cool covering: none in v1, unless the owner gives a figure.
- **Scope installs** gain a `swapsWith: { 'cool-roof': … }` on the covering entry:
  - shingle → cool-shingle;
  - membrane → cool-membrane;
  - tile has none.
  So the same scope installs the cool covering when the add-on is on.
- **The ROI calculator** gains `trades['roof-and-gutters'].coolRoof: boolean`, **default true**, with the label "Cool roof (reflective)". `scripts/verify-remodel-roi.ts` and the numeric snapshot stay byte-identical with it on. With it off, the roof contributes no energy cut.
- **The scene** shows "Cool roof" as an add-on chip beside the roof scope chips. It starts on when a roof scope is previewed, and the agent can turn it off.
- **Assertions:**
  - with cool roof off, the roof energy cut is 0 and the covering is the standard one;
  - with it on, the figures equal today's.

### 7.5 Wood shake (R4, R30)

- `roof-attic` covering gains `wood-shake` (forms: pitched).
  - **Copy:** "Wood shakes". Existing condition `worn`: "Dried, split shakes", with the detail "They curl, split and catch embers; many insurers will not cover them."
  - **Thermal:** data comparable to shingle.
  - **Deck:** spaced boards (the rule exists: spaced boards only under wood shake).
- `COVERING_BY_ROOF.woodshake` becomes `wood-shake`. `woodshake` leaves `NEAREST_DRAWN_ROOFS`, so a recorded wood-shake roof draws exactly and its basis can be `recorded`.
- `metal` stays nearest (T1).
- **A new covering over spaced boards brings a plywood deck.** Shingles and tile cannot be fastened to spaced boards. So when the resolver installs any covering other than wood shake on a home whose deck is spaced boards, it also installs a plywood deck labelled "New solid decking, needed for the new roof". This happens whether or not the redeck scope is previewed. Whether pricing pairs a redeck with every such tear-off is an owner input (§14), not a drawing rule. **Assertion:** no proposed build draws shingle or tile on spaced boards.

### 7.6 Profile and household

- `PropertyProfile` gains `windowsType` and `hvacComponents` (already columns on `customer_profiles`). Both are nullable.
- `household` is a scene input, **not** a property fact (R31). The meeting maps `customer_profiles.householdType` and `ageGroup` into it at TS4.
- `NOT_DRAWN` keeps "Roof torch down (repair)": a patch, not a new covering (T18 draws it later). The live scope check is unchanged.

## 8. The lab page and controls (R1, R17, R20, R21)

- **`/dashboard/labs/trade-scene`** (super-admin) is the one place the Home scene is built and judged. The original `/dashboard/labs/roof-cutaway` stays untouched as the reference. `/dashboard/labs/cutaway-look` stays until the owner retires it.
- **Layout** carries over from the reference: the story panel on the left (stacked below in portrait), the scene on the right.
- **The panel holds:**
  - the era-aware heading and lead line (foundation basis rules: no "your" over a guess);
  - the Today / Tri Pros build toggle;
  - weather (Summer / Winter / Rain), climate (Coastal / Inland) and the thermal camera;
  - scope chips and the Cool roof chip;
  - when zoomed: the peel slider and the layer list with numbered pins;
  - the bill fields and the savings (foundation §5.3);
  - the Home profile popover: roof, era, insulation, foundation, HVAC, windows, residents.
- **Free controls only:** no story beats, no autoplay. Orbit is bounded. Tap a part to emphasize it, tap the roof to zoom.
- **The Look drawer** (super-admin) holds only the ribbon style (stream / dashes / glow) until the owner picks.
- **Carry-over from the reference** (tracker §3a, owner to confirm): the split layout, the x-rayed header and era lead, the peel slider with numbered pins tied to the layer list, the build toggle wording, the instanced shingles and tile, the layer copy's tone. The roof-attic assembly kit is rebuilt from these on the shared primitives and the construction model. The reference's code is read, never imported.

## 9. New scene primitives

`src/shared/components/scene/`. None of them knows about construction.

| Primitive | Job |
|---|---|
| `CameraRig` (completes the foundation's) | Eased glide between named framings, bounded orbit, aspect-aware framing |
| `AnimatedFigure` | Loads a rigged GLB, plays named clips with crossfades, recolours to a palette, settles to a rest pose when the burst ends |
| `RainField` | Instanced falling streaks within a box; intensity eases; a still-streak form for reduced motion |
| `ReadingPins` | Pinned DOM labels at 3D anchors (extends `ScenePins`), with an asterisk slot |
| `ThermalScale` | The fixed °F ↔ palette mapping, plus the scale-bar DOM component |
| `useSceneBurst(duration)` | Keeps the demand frameloop drawing for a burst after any input change, then lets it rest; reduced motion turns it off |
| `useGltfAsset` | Loads a GLB with meshopt decoding (no Draco), disposal, and a fallback stand-in if the file fails |

These also land here: thermal paint for skinned and instanced meshes (fixing the instanced-normals carry-over in T17), and the settled-ribbon write fix (T17). They are in this build's path.

## 10. Assets (R18)

- **CC0 only.** Each pack is recorded in `public/scenes/LICENSES.md` (source URL, author, licence).
- **Files:** `public/scenes/home/`, glTF binary, meshopt-compressed, textures at most 1K.
- **Budget:** at most **4 MB** for the whole home kit, at most **5 animated figures** at once, clips limited to the ones the comfort states use.
- **Picking the packs** is a plan task with a screenshot sheet for the owner. The packs must share one style.

## 11. Graceful paths

- **No WebGL**, or the context is lost: the panel, readings, layer list and savings carry the story, with one still per weather in place of the scene.
- **Reduced motion:** no bursts, inputs apply instantly, residents hold the final pose, rain is still streaks, ribbons hold still and show flow by width.
- **An asset fails to load:** the house still draws, with simple code-built stand-ins for residents and props. Nothing blocks the story.
- **Offline:** TS4 prefetches the 3D chunk and the GLBs on meeting open (foundation D20).

## 12. Success criteria

1. **Every surface agrees.** For every roof type × weather × climate × view × cool roof on/off, the readings, the paint's scale positions, the ribbon widths and the savings figures all come from one `resolveScene` call. Measured by an assertion script that calls it and checks each consumer's inputs.
2. **No "your" over a guess.** Every roof type × era. Measured by an assertion script.
3. **ROI byte-identical** with Cool roof on, and zero roof energy cut with it off. Measured by `verify-remodel-roi.ts` and the numeric snapshot.
4. **The scene rests after a burst.** It stops drawing within 12 s of the last input (render frame counter unchanged over 2 s), and reaches 60 fps during a burst on an iPad Pro. Measured by Playwright, plus on the device at the look pick.
5. **Complete screenshots:** every roof type (shingle, tile, wood shake, flat) × weather × view × thermal camera on/off, home and zoomed, both iPad orientations. Measured by Playwright in our own browser, reviewed before the owner's pick.
6. **The generalization contract holds:** a stub assembly kit registered for `hvac-attic` at `attic` renders with no change to the home kit (a throwaway check, deleted after).
7. **The asset budget holds:** at most 4 MB of GLB and textures for the home kit. Measured by a size check.

## 13. Testing

As in the foundation:
- pure logic is proved by throwaway `tsx` assertion scripts (no test runner);
- UI is proved by Playwright screenshots in our own browser;
- verification is `pnpm tsc` and `CI=1 pnpm lint`, never `pnpm build`;
- commits by explicit path;
- no DB writes.

The assertions named in §7 join `scripts/verify-construction-model.ts`.

## 14. Owner, field and release inputs

1. **Look pick on the iPad Pro.** It covers the CC0 pack sheet, the ribbon style, the comfort thresholds and the overall warmth.
2. **Carry-over list** from the reference cutaway (tracker §3a).
3. **Sourced numbers before release:**
   - the climate presets;
   - the solar load;
   - the radiant barrier's winter reflectance;
   - cool shingle and reflective cap sheet reflectances.
   All are placeholders until then. The thermal-camera disclosure joins the existing savings sign-off.
4. **Any roof energy cut that holds without a cool covering** (§7.4). Default: none.
5. **Whether pricing pairs a redeck with every tear-off on spaced boards.** The drawing always shows the new deck (§7.5).

## 15. Risks

- **Readings are claims.** Mitigated by one model, the asterisk popover, placeholders flagged until sourced, and the sign-off gate.
- **CC0 style mismatch.** Packs from different authors may clash. Mitigated by picking from one or two authors, a recolour to one palette, and the owner's pick sheet.
- **iPad heat over a long meeting.** Mitigated by bursts then rest, demand rendering, the asset budget, and instancing.
- **Kit contract drift.** The first later kit (T3) may want home-kit changes. Mitigated by criterion 6's stub check now, before any real kit leans on it.

## 16. Out of scope

Everything on the tracker's tally (§5 there), notably:
- metal (T1);
- the thermal lens (T2);
- other assembly kits (T3–T7);
- attic fan (T8);
- form conversions (T9);
- WebGPU (T11);
- two-story homes (T15);
- the flat-roof patch repair (T18).

Meeting integration is TS4 under the foundation spec §5.1 and §5.5.
