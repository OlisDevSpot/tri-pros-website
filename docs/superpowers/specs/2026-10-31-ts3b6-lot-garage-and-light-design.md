# TS3b.6: the lot, the garage and the light (merging the realism spike)

> **Status:** approved by the owner 2026-11-01 ("Yes, looks good for now"). Plan for 6-A: `docs/superpowers/plans/2026-11-01-ts3b6a-lot-and-light.md`, stress-tested 2026-11-01 with the owner's rulings folded in here (R146, §13). **Part 6-A built 2026-11-01** (`91c463e9f`..`725c1da9c`, unmerged; owner rulings during the build in the tracker's 2026-11-01 log). Part 6-B (§8) is pending, after TS3b.4b.
> **Tracker:** `docs/plans/2026-10-16-trade-scenes-epic.md` (TS3b.6 row, §2b, R9, R18, R80, R129–R132, R137–R141).
> **Research:** `docs/plans/2026-10-30-trade-scene-realism-research.md` (reference inventory, gap analysis with file:line, lot numbers, iPad realism costs).
> **Reference:** `docs/plans/assets/trade-scene-realism/reference-render.jpg`.

## 1. Intent

The owner wants the Home scene to feel like a real Southern California home on a real street. The aim is not a toy house on a green disc. The target is the owner's AI render: a single-story stucco home with an attached two-car garage on a walled tract lot, with tile-roof neighbours, palms, and a low golden sun. The bar is "a good middle ground toward the render" (R132): real proportions, real light and a believable lot, still built in code and still fast on an iPad.

A throwaway spike tested how far that goes. The original scene is `/dashboard/labs/trade-scene`, which is the real one and untouched. The test is `/dashboard/labs/trade-scene-realism-spike`, code in `src/features/trade-scenes/realism-spike/`. The owner reviewed it twice. After round 1 they asked for single-story neighbours, a two-car garage on a wider lot, a rise from the street, a garage door fix, and a garage roof that follows the house (R137–R140). After round 3 they asked for a raised-panel garage door like their photo, and said: "this looks like a great starting point. Let's come up with the proper way to merge it into our main trade scene."

This document is that proper way. It turns what the spike proved into real scene code that respects the scene's contracts (Thermal lens, home views, ghost, fades, wear, camera, heat figures). It never promotes the spike's files. The spike is deleted once part 6-A lands.

**Why it matters to the business.** The rep shows this scene in a homeowner's living room. A home that looks like theirs on a street that looks like theirs makes the heat story believable. A floating toy house reads as a sales gimmick.

## 2. What the owner has already decided

| Ruling | What it says | Where |
|---|---|---|
| R129 | The garage is unconditioned: hotter than the house in summer (heat arrows run into the rooms), much colder in winter (the home's heat runs out into it), at its own hand-tuned temperature (R43) | tracker §3b |
| R130 | Property-line walls 6 ft (1.83 m) on the left, right and back; a front fence at most 42 in (1.07 m) | tracker |
| R131 | Later: a typical day per season with a 5 am to 12 am slider (T19). Not built now, but the sun must be built so a season and an hour can drive it, never a fixed look per weather | tracker |
| R132 | The house stays built in code for now; models may dress it later; credited licences are fine; the bar is a middle ground toward the render | tracker |
| R137 | Neighbours are single-story | spike round 2 |
| R138 | A two-car garage, flush with the house front, 6.4 × 6.6 m with a 16 × 7 ft door, on a lot about 22 m wide (left side yard 2.5 m for the condenser, right 1.52 m) | spike round 2 |
| R139 | The lot rises about 0.45 m (18 in) from the sidewalk to a flat house pad, plus the curb's 6 in step to the street; the walk, driveway and low front wall follow the grade | spike round 2 |
| R140 | The garage roof is the house's roof: same form (pitched or flat) and same covering, changing with it | spike round 2 |
| R141 | The garage door is a raised-panel sectional door like the owner's photo: four sections, short raised panels (eight across on a 16 ft door), the top section glazed, charcoal | spike round 3 |
| (new) | The spike is "a great starting point" to merge | spike round 3 |
| R142 | The afternoon sun comes from the **front-left** by default, but the house's bearing is a **scene attribute**, one value that everything sun-dependent derives from, so it is easy to change later and a future agent can pick scene attributes such as the sun's direction | builder check |
| R143 | The opening view **fits the house and the garage**: the house is smaller on screen and the reading pins are re-tuned to suit | builder check |
| R144 | **Every home gets the attached two-car garage** for now; the none / attached / detached input waits for R80 | builder check |
| R145 | **6-A builds right after the Attic build**, ahead of paint wear and TS3b.4b; 6-B waits for TS3b.4b | builder check |
| R146 | **The garage's heat (6-B).** The wall the garage shares with the house lets in a little less heat than a sunny outside wall, but the garage is unconditioned and much hotter than the rooms in summer (colder in winter), so heat comes into the house through it. The garage has **no attic and no windows**: its roof heats the garage directly. **Cool Life paint and a cool roof passively cool the garage in summer** (and keep it warmer in winter), so its temperature, and the arrows from it into the house, follow those upgrades | plan stress test |

What the owner liked in the spike, and what this spec carries over: the golden-hour light, the haze, the walled lot with gates, the street with sidewalk and curb, single-story tile-roof neighbours, the palms, agaves, sagos and shrubs in mulch beds, the lawn's colour variation, the garage, and the rise from the street.

## 3. Goals, non-goals, anti-goals

**Goals**
1. The real scene shows the spike's lot, surroundings and light, built to the scene's contracts.
2. The garage is a real part of the home: its own space at its own temperature (R129), its roof built from the house's own roof pieces (R140), and correct where it meets the house (the right wall, the attic, the arrows).
3. The sun is a function of season and hour (R131), so T19 is a slider later and not a rewrite.
4. It stays inside an agreed iPad budget (§9).

**Non-goals (this spec)**
- **Textures** (stucco grain, block joints, concrete, roof grain). The owner has not seen them yet. They come later as their own spike, then their own spec (§10).
- **House trim** (taller parapet, cornice, window surrounds, stoop, dark frames). The spike did not change the house, so the owner has not judged any of it. It goes with the textures (§10).
- **Ready-made or Blender models** (R132): car, patio furniture, better palms. Neighbours and plants are built so a model can replace them later (§10).
- **The time-of-day slider and seasonal highs** (R131, T19). Only the sun's plumbing is built now.
- **A garage input** (none / attached / detached, R80) and stories. Every home gets the garage for now (R144).
- **Ambient occlusion as a post pass.**

**Anti-goals: it fails, even if it works, if…**
- the Thermal lens, the home views (Complete / Partly open), the ghost or the fades break or look wrong on any new piece;
- the rep's opening view loses what it is for (§7.4);
- an iPad Safari tab is killed for memory, or the frame stutters on a camera slide;
- the scene downloads anything from a third-party host at runtime. The spike fetched its sky from Poly Haven's CDN; the real build self-hosts it.

## 4. The split, and why

The lot, sky, neighbours and plants live in files nobody else is editing. The garage's join with the house lives in files three in-flight builds hold: the attic, exterior paint wear (R121) and TS3b.4b. So the work is two builds, each with its own plan:

- **6-A, the lot and the light.** Sky, sun, tone mapping, haze, the lot and its grade, walls, fences, gates, street, neighbours, plants, and the garage as a standalone building beside the house, with its roof form following the house's and plain covering colour, as the spike draws it. It touches the shared files only in small, named places: the HomeKit mount, the yard constants, the pan box and framings, the canvas tone mapping, and the two things the garage would otherwise show wrong (§6.7).
- **6-B, the garage joins the house.** Its own heat (R129), the right wall and attic where they meet it, its roof built from the house's covering pieces (courses, wear, cool roof), its behaviour in the home views and the ghost, and its anchors. This build waits for the in-flight house work (§11).

After 6-A lands the lab page already looks like the spike (with a garage), and nothing on screen is wrong: §6.7 removes what the garage would otherwise bury or pierce. The garage simply has no heat story of its own until 6-B, which may be some time, since it waits for TS3b.4b.

## 5. Part 6-A: the light

### 5.1 The sun from a season and an hour (R131)

Today each weather in `WEATHER_SKIES` (`constants/weather-skies.ts`) hard-codes a sun position. In its place:

- A pure function gives the sun's direction (azimuth and elevation) from a **day of the year** and a **clock hour** (local time, daylight saving included, since the T19 slider reads as a clock), using a standard solar-position formula at about 34° N, 118° W (Southern California).
- The **house bearing** maps compass directions to scene axes, and decides which side the afternoon sun comes from. It is a **scene attribute** (R142): one value in a small scene-attributes object (`SCENE_ATTRIBUTES` in a new `constants/scene-attributes.ts`), never baked into a light position, a wall choice or a pin. The default is the front (+z) facing **south**, so +x is east and −x west. The afternoon sun then comes from the front-left in every weather, the left wall stays the sunny one, and today's Thermal story, readings and pins stand. A future agent, or a later input, may set the bearing (for instance from the customer's real home), and the scene must follow it with no other edit.
- Each weather names a default **day and hour**, plus its colours, intensities, fog, sky and environment as today. T19 later replaces the default hour with the slider's.
- **The key light is the sun's direction with a floor on its elevation**, set per weather. A dusk or late hour would otherwise lay the light flat on the horizon, with endless shadows. The azimuth always follows the sun; the elevation is the larger of the sun's and the weather's floor. What lights the scene once the sun has set (a moon, the sky alone) is T19's question, not this build's. Signature to keep for T19: `(dayOfYear, clockHour) → { azimuth, elevation }`, with the floor applied by the caller.

| Weather | Proposed default | Look |
|---|---|---|
| Normal | mid-October, about 4:30 pm (sun about 20° up, as in the spike) | the spike's golden hour: low warm sun, long shadows, warm haze |
| Summer | mid-July, 3 pm (about 60° up; "about 50°" was a mis-estimate, and 4 pm's 48° would leave the front nearly unlit) | a hard, high, hot afternoon sun, pale warm haze |
| Winter | mid-January, about 5 pm, elevation floored at today's 28° | the current cold blue evening with the rooms lit warm |
| Rain | any day, 1 pm (just west of south, so the key light stays front-left like the other weathers; noon would put it front-right) | the current flat overcast |

The sun's light position is that direction times a fixed distance, aimed at the lot's centre. Sun colour and intensity stay per weather, hand-tuned (R43), until T19 makes them follow elevation.

**Everything sun-dependent derives from the bearing (R142).** Two places choose a sunny wall today:
- `lib/faces-summer-sun.ts` decides which walls the Thermal lens paints as sunlit, from Summer's hard-coded sun position. In 6-A it reads the sun function at Summer's default day and hour, through the bearing, so the lens and the light agree.
- `constants/home-anchors.ts` puts the wall and window readings and the `exterior-wall` pin on the left wall because "the sunny wall is the left one". That file belongs to TS3b.4b, so it moves to 6-B: there the readings, the pin and their callouts go on whichever house wall is sunniest under the bearing (the left one by default). Until 6-B, a bearing other than the default would leave them on the left wall. The default bearing changes nothing on screen, so nothing is wrong in the meantime.

Normal and Summer afternoons come from almost the same compass direction, so the sunny wall is the same in both, whatever the bearing.

### 5.2 Sky, haze and environment

- **Sky dome:** a radius of 118 m (95 today), so the lot and neighbours sit inside it. `HOME_CAMERA_FAR` already follows `SKY_RIG.domeRadius`.
- **Fog:** set per weather and matched to the horizon colour. The spike's golden values were near 28 and far 125.
- **Environment (reflections and sky fill):** Normal and Summer use a **self-hosted 512 × 256 HDR**, the spike's `citrus_orchard_road_puresky` from Poly Haven (CC0), halved from Poly Haven's 1k file (the smallest it publishes; CC0 allows a derived file), under `public/scenes/sky/`, credited in `public/scenes/LICENSES.md`. The 1k file costs about 10–16 MB of GPU memory once loaded and its lighting maps are built, over the §9 budget; the image only lights reflections and fill (the sky you see is the drawn dome), so halving it barely changes the look (owner, 2026-11-01). Winter and Rain keep the code-built `Lightformer` environment, since a sunny sky image would light a night or an overcast day wrongly. The code comment "never downloads an HDR" changes to "never downloads one from another host".
- **Tone mapping:** AgX (the spike used exposure 1.05). It moves into `SceneShell` (`src/shared/components/scene/ui/scene-shell.tsx`) as a prop, set by the Home canvas. It is never an effect that flips `gl.toneMapping` and recompiles every material, as the spike does. Look-dev keeps its current tone mapping.
- **Re-tune pass:** the palette was tuned under ACES. The re-tune changes **only the lights, sky, fog, the ground's tint and exposure** in `weather-skies.ts`, by eye in all four weathers. The ground's colour becomes a light tint over the lawn texture (the texture is already green; today's green tint would darken it to a third, and Rain's nearly to black). Surface colours (`home-palette.ts`, `wear-looks.ts`, `COVERING_COLORS`) are not touched, except that the old yard's three colours (`trunk`, `crown`, `shrub`) are deleted with the yard (owner, 2026-11-01): the shingle swatches are real Owens Corning product colours, and those files belong to in-flight builds. If a surface reads wrong under AgX, the builder reports it with shots rather than changing the colour. Then the four fallback stills (`public/scenes/stills/*.webp`, `constants/home-scene-stills.ts`) are captured again. The Thermal shaders are not tone mapped, so they are unaffected.

### 5.3 Shadows

- **Shadow map:** stays at 2048. The spike used 4096, which costs about 64 MB of GPU memory, too much for an iPad.
- **Shadow camera:** fitted to the lot rather than a square of ±15 m, so the house, garage, walls and nearby plants cast and receive. It is fitted again on every weather change: three only rebuilds a shadow camera's frustum when the shadow map is first made, so the build updates it itself.
- **Neighbours and far plants:** cast no shadows.
- **Check:** if the house's shadows look too soft at 2048, the builder reports it with shots before going further. Do not raise the map size to fix it.
- **Thermal:** the existing hold on the shadow map under Thermal stays.

## 6. Part 6-A: the lot

### 6.1 Layout (metres; the house unchanged: 12 × 8, centred on the origin, front at +z = 4)

Taken from the spike's `spike-lot-layout.ts`, which the owner approved by eye:

| Piece | Value |
|---|---|
| Lot | left −8.5 (side yard 2.5 m for the condenser), right = garage's right face + 1.52, front 10.1 (setback 6.1), back −23.4 (depth 33.5) |
| Garage | x 6 → 12.4, z −2.6 → 4 (flush with the house front), wall top = slab + 2.5; flat garage top 0.62 above that (the spike's step) |
| Garage door | 4.88 × 2.13, raised-panel sectional, 4 sections × 8 panels, top section glazed, charcoal (R141) |
| Property walls | 1.83 high, 0.15 thick, with a cap, on the left, right and back (R130) |
| Front | a low wall, 1.07 at most, down the left side of the front yard to the sidewalk, on the grade (R130); no full front fence |
| Side-yard returns | a 1.83 wood fence and gate across each side yard just behind the front corners (z 3.4); see owner question Q2 |
| Grade (R139) | flat pad to 1.6 m in front of the house, falling 0.45 to the sidewalk; sidewalk 1.52; parkway 2.13; curb 0.15; street 11 curb to curb, 0.6 below the pad; the houses across the street on their own pad, the same rise |
| Paving | driveway to the garage door on the grade with control joints; an apron across the parkway; a walk from a small stoop to the sidewalk; sidewalks both sides, joints every 1.5 m; curbs and gutters |
| Planting beds | mulch beds along the house front either side of the walk, and at the front of the left side yard |

The layout constants go in a **new** `constants/home-lot.ts`, not in `home-geometry.ts`. The box lists that come from them go in a new `lib/lot-boxes.ts`. `YARD` leaves `home-geometry.ts`, and the pan box (`lib/home-pan-box.ts`) reads the lot instead of `HOME_PAN.frontReach`. `home-lot.ts` reads the house's size from `home-geometry.ts`, so `home-geometry.ts` must never import `home-lot.ts` (the two would load in a cycle and crash the page).

### 6.2 Ground

The 60 m green disc becomes a strip of ground rows that follow the grade (the spike's `groundStrip`). Its UVs are counted in 4 m tiles, and the canvas-drawn lawn texture (blade strokes, dry flecks, tired patches) repeats on it. The lawn is the only texture in 6-A, because the owner has already seen it. Rain wets it as today, through the weather's `ground.roughness`; the lawn's colour comes from the texture, with the weather's ground colour as its tint.

### 6.3 Neighbours

- **Houses:** 19 single-story homes (R137), 15 × 10 m, with stucco walls, clay hip roofs, some chimneys and dark windows. They stand on 22 m spacing in our row, the row behind, across the street, and a second row behind.
- **Draw cost:** all of them are merged into three draw calls (walls, roofs, windows) with vertex colours, as the spike does.
- **Shadows and contracts:** they cast no shadows. They sit outside the house group, so they are never ghosted, faded or cut.
- **Placement:** the placements move from the spike into `constants/neighbourhood.ts`.
- **The camera inside a neighbour.** The orbit (max distance 36) can carry the camera into a neighbour's house or its roof. The neighbours are closed boxes drawn front faces only, so from inside one every face is culled and the house simply vanishes while the camera is in it. That is acceptable, and no orbit change is made (the Camera slide is closed). The builder confirms it with a shot from inside the left neighbour. A property wall in front of a low camera blocks the view, as a real one would.

### 6.4 Plants

- **Species:** the spike's code-built species, each one instanced draw call: Mexican fan palm, queen palm, pygmy date palm, sago, agave, shrub, eucalyptus and Italian cypress.
- **Materials:** vertex colours, no alpha cut-outs. The thermal shader already handles instancing, and a cut-out leaf would paint as a solid card under Thermal.
- **Old yard:** they replace `YARD.trees` and `YARD.shrubs`, and the `yard-blobs` lollipops go.
- **Heat arrows:** a planting bed may not sit in a wall's heat-arrow lane. The TS3b.4a fixes moved the arrows to clear the old front shrub (`2a8bcb169`), so the builder checks the front beds against the lanes under Thermal, and moves the plants rather than the lanes.
- **Double-sided leaves:** fronds and blades are drawn double-sided. If the thermal paint draws only front faces, the builder makes the thermal paint double-sided for these meshes, so the plants don't half-vanish under the lens.

### 6.5 The garage, standalone (6-A)

As in the spike, the garage is its own building beside the house:

- **Walls:** in the house's paint colour, following the paint's wear **as colour only** (the worn and chalk tone). Paint wear's marks (cracks, stains, peeling, R121) come to the garage in 6-B, after R121 has landed.
- **Door:** the raised-panel door with a recessed surround, every surface on its own plane, so nothing flickers.
- **Flat roof:** when the house is flat, the garage gets a deck with a parapet, a cornice step and a membrane in the house's covering colour.
- **Pitched roof:** when the house is pitched, the garage gets a gable at the house's pitch, the ridge running the same way, with fascia and a gable end. Its covering is a **plain colour** that follows the house's covering and its wear: the installed shingle tone, or the covering's new or worn colour. Real courses come in 6-B.

In 6-A it carries the `exterior` thermal tag, as the yard does. It is not part of the house group, so it is not ghosted, faded or lifted with the house.

### 6.6 Thermal and the home views on the lot

- **Thermal tag:** every lot piece, neighbour and plant sits under the `exterior` tag (as `Yard` does today, `home-kit.tsx`), and the sky keeps its own `sky` tag.
- **Home views and the ghost:** none of them reacts to Complete or Partly open, or to the ghost.
- **Raycasts:** the lot receives camera raycasts, so a double-tap on the yard still looks at that spot. The neighbours and far plants ignore raycasts.
- **Rain:** today's rain fields (`constants/home-life.ts`) cover the old ±15 m yard, so on the lot they would stop in mid-air over the sloping front lawn, fall through the left neighbour and leave the back yard dry. 6-A widens them to the lot and lets each field reach its lowest ground (owner, 2026-11-01).

### 6.7 What the garage would otherwise get wrong (6-A)

The garage stands against the house's right wall from z −2.6 to 4. Until 6-B, two things there would show wrong, so 6-A removes them while a garage stands:

- **The right wall's outside heat lanes** (in `HOME_WALL_HEAT_LANES` and `HOME_COMPLETE_WALL_HEAT_LANES`, `constants/home-heat-lanes.ts`). Partly open draws its lanes without depth testing, so under Thermal they would come out through the garage's walls. 6-A drops the right wall's lanes that fall inside the garage's span. 6-B replaces them with the garage's own lanes.
- **The pitched roof's right-front downspout** (`DOWNSPOUTS`, at x 6.08, z 3.7), which would sit inside the garage. 6-A drops it. 6-B moves it to the garage's front corner.

The right window's own heat lane drops with the wall's (owner, 2026-11-01): until 6-B no arrow crosses the shared wall, and 6-B brings the garage's arrows in their place (R146). The window itself stays until 6-B. From outside it is hidden, and from inside, in Partly open, it looks at the garage's wall. The attic plan's right gable vent, if it shows above the garage's lower ridge, also waits for 6-B. These touch `home-heat-lanes.ts` and the downspout boxes, small hunks named in §11.

## 7. Part 6-A: the camera

### 7.1 Pan box

`HOME_PAN` grows to the house plus the garage, and out to the sidewalk in front, so the rep can slide over the whole lot.

### 7.2 Orbit

`HOME_ORBIT.maxDistance` stays at 36. The lot is visible from inside it.

### 7.3 A drone framing?

**No.** The rep can orbit up to the render's view. A preset drone button is out of scope.

### 7.4 The opening view

`HOME_FRAMINGS.wide` and `.tall` were tuned to show the house edge to edge from the front-left, under the ceiling into the rooms, with the side yard's meter and condenser in view. The owner ruled:

- **Fit the house and the garage (R143).** The framings re-centre on x −6.3 to 12.7 (about 19 m instead of 12.6 m) and keep the 92% fit, so the house is about 65% of today's size on screen. The builder keeps the look under the ceiling into the rooms by tuning the framings' height and target, and shows the owner shots at a wide stage, a tall stage, and with the card open and folded. The stacked reading pins in `READING_CALLOUTS` (`constants/home-anchors.ts`) assume dots about 30 px apart on a house that runs edge to edge, so 6-A re-tunes their offsets for the smaller house. That is one more small hunk in a TS3b.4b-held file, named in §11.
- **The gate stays closed** (Claude's call; the owner's answer did not cover it). The 6 ft side-yard gate hides the condenser from the opening view, as a real side yard would; the condenser shows once the rep orbits or taps in.

## 8. Part 6-B: the garage joins the house

> **Superseded 2026-11-01** by `docs/superpowers/specs/2026-11-01-ts3b6b-garage-joins-the-house-design.md` (the owner's 6-B brainstorm: R196–R198). Kept below for history until 6-B ships.

This part waits for the in-flight house work (§11). Each item names the contract it meets.

1. **Heat (R129).**
   - **Readings:** a `garage` reading per climate and weather in `home-heat-figures.ts`, hand-tuned (R43). Placeholders for the owner to tune:

     | | Inland | Coastal |
     |---|---|---|
     | Normal | 92 °F | 84 °F |
     | Summer | 118 °F | 102 °F |
     | Winter | 45 °F | 50 °F |
     | Rain | the outside air's reading plus 3 °F | the outside air's reading plus 3 °F |

   - **Thermal zone:** a `garage` zone (`home-thermal-zones.ts`) paints its walls, slab and air at that reading under Thermal.
   - **Arrows:** in place of the right-wall and right-window lanes 6-A dropped, heat lanes cross the shared right wall from the garage into the rooms when the garage is hotter than the rooms (Summer, Normal), and from the rooms into the garage when it is colder (Winter), with flow scaled by the difference, as the attic's are. The shared wall lets in a little less than a sunny outside wall (R146).
   - **No attic, no windows (R146).** The garage roof heats the garage directly; there is no garage attic and no garage window.
   - **Upgrades (R146):** Cool Life paint and a cool roof passively cool the garage in summer and keep it warmer in winter, so the garage reading, and the arrows from it into the house, shrink with them; the figures are hand-tuned (R43). The garage figure feeds no savings, because the hand-tuned bills do not model it.
2. **The right wall.**
   - **The window:** the right wall's window (`HOUSE_WALLS.right.openings[0]`) sits inside the garage, so it becomes an **interior door into the garage**. That is how attached garages are built, and in Partly open the room shows a door instead of a window looking at a wall.
   - **Downspout:** the right-front downspout 6-A dropped comes back at the garage's front corner.
3. **The attic and the roof.**
   - **Covering:** on a pitched house the garage roof is built from the house's own roof pieces: the slopes with real shingle, tile or shake courses, and the covering's wear, colour and cool-roof finish, all following the house (R140).
   - **Gable vent:** the attic plan's right gable vent ends up behind the garage roof. The garage has no attic (R146), so where the house attic vents once the garage covers that gable is a 6-B design question (the earlier "move it to the garage's outer gable, the two attics connect" is withdrawn).
   - **Flat roof:** on a flat house the garage deck takes the membrane's real pieces (seams, wear, cool membrane).
4. **Home views, ghost and fades.**
   - **Partly open:** the garage stays closed. Partly open opens the house's front, not the garage.
   - **Ghost:** the garage ghosts with the house when the camera zooms into a part (it joins the house group's ghost tag), so it never blocks an up-close view of the right side.
   - **Foundation switch:** the garage is always on a slab. On a raised-foundation house, the garage floor stays at grade and the house steps up to it, which is real.
5. **The sunny wall follows the bearing (R142).** The wall and window readings, the `exterior-wall` pin and their callouts in `home-anchors.ts` go on the sunniest house wall under the bearing, not on a hard-coded left wall (§5.1).
6. **Paint wear on the garage.** The garage walls take R121's marks (cracks, stains, peeling), placed by the same pure functions as the house's walls, extended to the garage's faces.
7. **Anchors.** No garage pin in this build. A garage up-close view is a TS3b.4b-style system view for later.
8. **Clean-up.** The spike route and folder are deleted at the end of 6-A, not 6-B.

## 9. Budget (Claude's call; the owner may change it)

Measured headless (software renderer, 1280 × 800, Complete, Normal, flat roof, shadows included):

| Scene | Draw calls | Triangles |
|---|---|---|
| Original today | 133 | 50.7k |
| Spike (flat roof) | 160–167 | 73–75k |
| Spike (tile roof) | 180 | 138k (most of it the house's own drawn tiles, which the original also pays) |

**Proposed budget for 6-A + 6-B together, against the original at the same view:**
- at most +40 draw calls;
- at most +40k triangles on a flat roof;
- the garage's real courses at most +60k triangles on tile;
- texture memory at most 8 MB (lawn plus HDR, counted by hand from their sizes, since three's `renderer.info` counts textures but not bytes: the halved sky about 1 MB plus its lighting maps about 1.5–3 MB, the lawn about 1.4 MB);
- no 4096 shadow map, no post-processing composer.

The builder measures before and after with the existing probe scripts. The owner confirms on the iPad that a camera slide stays smooth on all four weathers.

## 10. Later, not in this spec (for the tracker)

- **6-C, surfaces and trim, spike first.** Stucco, block, concrete and roof textures with world-scaled UVs (KTX2, about 25–35 MB), plus house trim: the parapet and cornice, window surrounds and sills, dark frames, the stoop. The owner judges them in the spike before any spec. The research's texture traps apply, so the thermal decal rule must key off an explicit tag, `wornColor` needs neutral maps, and merged boxes need world UVs.
- **Models (R132).** A car in the driveway, patio furniture, better palms. Neighbours and plants are each one component behind a placement list, so a model swaps in without touching the lot.
- **T19.** The time-of-day slider and seasonal highs on the sun function from §5.1.
- **Scene attributes picked by an agent (R142).** The bearing is the first scene attribute. Later ones (garage side, lot width, which neighbours, plant mix) can join the same object, so an agent can set up a scene to match a customer's home.

## 11. Order and coordination (R145)

The owner's current order for the house work is: the Attic build, then the TS3b.4a fixes (built), then paint wear (R121), then TS3b.4b. Proposed:

- **6-A** builds as soon as the Attic build lands (owner, R145). It is almost all new files, and its hunks in shared files are small and named: `home-kit.tsx` (the mount), `home-geometry.ts` (`YARD`, `HOME_PAN`, `HOME_FRAMINGS`, the right-front pitched downspout), `weather-skies.ts`, `weather-sky.tsx` (the sun, its shadow camera and the sky image), `scene-shell.tsx` (the tone-mapping prop) and `home-scene-canvas.tsx` (passing it), `faces-summer-sun.ts`, `home-heat-lanes.ts` (§6.7), `home-pan-box.ts` (§7.1), `home-anchors.ts` (`READING_CALLOUTS` offsets only, §7.4), `home-life.ts` (the rain fields, §6.6), `home-palette.ts` (the three yard colours deleted, §5.2), `types.ts` (appended types and the `WeatherSky` shape), and `scripts/verify-trade-scene.ts`.
- **6-B** builds after TS3b.4b, because it changes the right wall, the roof pieces, the heat lanes and the attic vents those builds hold.

## 12. Left to the builder

- File and component names beyond those named here.
- How the solar function is written. A standard low-precision formula is enough.
- The by-eye re-tune of colours under AgX, with before and after shots in all four weathers for the owner.
- Exact plant placements, as long as no bed sits in a heat-arrow lane.
- The neighbour and plant colours.
- How the lot pieces are grouped into draw calls, inside the budget.

## 13. Owner rulings from the builder check (2026-10-31)

R142 (sun from the front-left by default; the bearing a scene attribute everything derives from, for an agent to pick later), R143 (the opening view fits the house and garage), R144 (the garage on every home for now), R145 (6-A right after the Attic build). Folded into §2, §5.1, §7.4, §8 and §11.

**From the 6-A plan stress test (2026-11-01):** the right wall's and the right window's heat lanes both drop until 6-B (§6.7); the sky image is halved to 512 × 256 to stay inside the 8 MB budget (§5.2, §9); the rain covers the lot (§6.6); the yard's three unused colours are deleted (§5.2); and R146, the garage's heat for 6-B (the shared wall a little weaker than a sunny outside wall, no garage attic or windows, Cool Life paint and the cool roof cooling the garage), folded into §2 and §8.

## 14. Calls Claude made (check while reading)

- The side-yard gate stays closed, hiding the condenser from the opening view until the rep orbits or taps in (§7.4).
- The re-tune touches lights, sky, fog and exposure only; surface and product colours stay (§5.2).
- Clock time with daylight saving, and a per-weather floor on the light's elevation; after-sunset light is T19's (§5.1).
- 6-A drops the right wall's buried heat lanes and downspout while the garage stands; the window and the right gable vent wait for 6-B (§6.7). (The right window's lane dropping too is now the owner's ruling.)
- Rain at 1 pm rather than noon, so its key light stays front-left (§5.1).
- The sky image's own baked-in sun does not turn with the bearing; a known gap for T19 or a non-default bearing.
- The garage's walls take paint wear as colour only until 6-B (§6.5).
- A camera inside a neighbour just sees it vanish; no orbit change (§6.3).
- 2048 shadow map, the budget in §9, the self-hosted HDR for Normal and Summer only.
- The interior door in place of the right window, the garage closed in Partly open and ghosted with the house, and the placeholder garage temperatures (§8).
