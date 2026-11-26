# Heating & cooling equipment that looks like the real thing

**Date:** 2026-11-18, updated 2026-11-25 · **Epic:** #302 (3D trade scenes) · **Plans:** phase 1 #370, phase 2 #371 (blocked by #370). Builds on heating & cooling (#304), merged into `feat/302-trade-scenes` by #368 on 2026-11-25. · **Method and approved mockups:** the `/scene-realism` skill (`~/.claude/skills/scene-realism/`), examples `hvac-equipment-finish.html`, `duct-runs.html`; and the attic round `one-unit-two-spots.html`.

## Why

In the in-home meeting the rep shows the homeowner their own heating and cooling. Homeowners know the box in their hallway closet and the unit out back. Today the scene draws the indoor unit as four grey boxes and the condenser as a small furniture-pack model whose side fan makes it look like the mini-split. The owner wants to "strip apart the mystery": show each component close enough to the real thing that the homeowner recognises it, and let the rep explain the rest in their own words.

## Goals

1. The indoor unit, the condenser and the heat pump outdoor unit read as the real equipment, in the approved mockups' look.
2. One model set for the closet and the attic. The furnace cabinet, the coil case and the plenum are built once and turned to fit the placement. Only what joins the unit differs by spot (owner: leaner code; the scene is already heavy).
3. Every line the unit needs runs its real path end to end and never stops in mid-air: the line set to the outdoor unit, the condensate drains to the outside, the gas from a gas meter, and the flue through the roof.
4. Today shows age and a Build shows a fresh install, driven by the wear the scene already carries for each part.
5. Phase 2: the duct runs and their boots get the approved duct look, and a run always joins its boot.

## Non-goals

- Nothing inside any box: no burners, blower wheel, heat exchanger or coil fins (owner ruling). The one exception is the duct core, which Look inside already opens (phase 2).
- No new Look inside views, pins or part copy. Showcasing comes from the models themselves plus the part looks that exist.
- The package unit, the mini-split outdoor unit, the wall furnace and the window unit. They come later through `/scene-realism`.
- Where the HVAC closet stands. It stays where the build put it until the realistic home layout work moves it; the models fit any placement.
- No fan-only mode (owner, 2026-11-15).

## Anti-goals

- **Two copies of the unit's code, one per orientation.** That fails even if both look right.
- **Theatrical damage.** The owner called the duct crush exaggerated. Age shows as believable wear.
- **A run pulled off its boot, or any gap between parts that join.** That isn't a real problem we show. A gap is a bug.
- **Dropping the iPad's frame rate.** The models must merge into a handful of draws per part.
- **Brand names or logos on any label.**

## Constraints (verify each against the code when building)

- **Section sizes:** sizes and positions come from `IndoorUnitPlacement` (`constants/indoor-unit-placements.ts`) and `lib/indoor-unit-boxes.ts`. A model takes its section's box; it never moves the line. A missing furnace or coil closes the line up (a heat pump has no furnace; the attic unit anchors at the plenum end).
- **Tags:** keep one `systemPartTag` per section on its group (`blower`, `furnace`, `coil`, `plenum`), plus `return`, `refrigerant-lines` and `duct-runs`. Look inside emphasises and fades by these. Thermal paint reads the nearest ancestor's `thermalTag`, and each section keeps its running zone (`runningZone`, `RUNS_WITH`).
- **Running cues stay:** the furnace takes the heat glow (`useHeatGlow`, through a material ref). The outdoor unit's fan spins on a burst, its shake and shimmer stay, and `heating` is already passed to `CondenserUnit`.
- **Wear inputs:** `DrawnHvac.indoor` carries `blower`, `furnace` and `coil` as `PartState` (wear 0–1); `IndoorUnit` ignores them today. `DrawnHvac.outdoor` carries wear and `kind: 'condenser' | 'heat-pump'`. Ducts carry `PartState` with a material (`original-flex`, `r6-silver-flex`, `r8-flex`).
- **Cost:** geometry and textures are built once (at module level or memoized per placement), never per render. Repeats are merged or instanced. Draw calls today: 141 at the original baseline, 164 for Today Complete, 170 worst (central system with two mini-split heads, Build Complete). Record the before and after counts for the same cases.
- **Look in the real scene:** Playwright against the lane's Vercel preview, signed in through `/api/dev/playwright-session`. One case per run, never a sweep: a multi-case sweep in a software-rendered browser crashed the machine. The heating & cooling build's probe lived in its scratchpad, so the lane writes its own first.

## Approaches considered

- **A. Exteriors built in code, with procedural surfaces (picked).** Real silhouettes and details (doors, louvers, labels, collars, tape, mastic, pipes), surfaces drawn on canvases (painted steel, galvanized spangle, fin coil, labels, frost), and grime that grows with wear. It fits the section boxes exactly, turns for either orientation, keeps one tag per part, and merges for cost.
- **B. Ready-made models (marketplace or manufacturers' 3D catalogs), trimmed in Blender.** These look real fastest, but they don't fit our boxes, can't be split per tag, are heavy for the iPad, and carry brand markings. Kept only as proportion reference.
- **C. Photos printed onto boxes.** Cheapest, but flat up close, the photo's own lighting fights the scene's, and the attic version needs its own photo. Dropped.

The owner picked A, open to changing course if it doesn't hold up in the scene.

## The design

### 1. One unit, drawn in its own frame

- **One function or component draws the unit in a local frame.** The air enters at the return end and travels along the line, and the doors face one fixed side. The placement decides how it's turned:
  - **Closet:** upright, doors toward the room.
  - **Attic:** on its side, doors toward the walk side the Look inside view sees.
  - On the attic unit the labels read sideways, as on a real unit laid down.
- **Blower and furnace are one cabinet with two doors.** The blower sits behind the lower door (return end) and the burners behind the upper door with its louvers. Both stay separately tagged groups. The seam between them is the door gap, not a box gap.
- **Details from the approved mockup:**
  - Doors stand proud of the cabinet, with finger pulls.
  - Combustion-air louvers on the burner door.
  - An unbranded rating sticker on the blower door and a warning label on the burner door.
  - The blower door's green status light.
  - The cased coil with its screwed access panel.
  - A galvanized plenum with corner seams and foil tape where it meets the coil.
- **A heat pump's indoor unit has no burner compartment.** It is the blower compartment plus the coil, an air handler. It gets no louvers, flue or gas.
- **Proportions:** the cabinet is about 0.53 m across. Retune the placement's working numbers toward real sizes (furnace cabinet about 1.0 m long, coil case about 0.55 m) where the layout allows. Never draw off the box; if a retune would move runs, boots or checks, keep today's numbers and note it.

### 2. What joins the unit, per spot

These are drawn from placement data in world space, not turned with the unit:

- **Closet:**
  - The return platform the unit stands on, with the filter in it. Its front stays plain (my call). The return grille the build added stays the one return, lowered to line up with the platform. The `return` tag stays on that grille and its duct, and the closet's section lengths shrink by the platform's height (the plenum takes what's left up to the ceiling).
  - The plenum rises through the ceiling into the trunk.
  - A service switch on the wall.
- **Attic:**
  - A plywood platform over the joists, and the galvanized secondary drain pan under the unit, on blocks, with its float switch on the rim.
  - At the return end: a filter rack, a return box, and the return duct the build added (big flex, with the jacket look from phase 2) from the ceiling grille's box.
  - Supply collars on the plenum where the runs start.

### 3. Every line, end to end

Each line belongs to the part that needs it and is drawn only when that part is there. Each takes its finish from that part's wear.

| Line | Belongs to | Path | Look |
|---|---|---|---|
| Line set | coil (and the outdoor unit) | Coil connections → across the attic on the joists, strapped → out through the gable wall → down the outside wall in a line-set cover → the outdoor unit's service valves. From a closet: out through the wall behind the coil, down to the run along the wall. Replaces today's single felt-coloured tube. | Thick suction line in black foam, thin bare copper liquid line, thermostat wire taped along. |
| Primary condensate | coil | Coil drain port → trap at the unit → sloping down → out the wall, ending by the outdoor unit's pad. | White PVC. |
| Secondary condensate | coil, attic only | Drain pan → out through the eave → ending over a window on that wall (code puts it where the homeowner sees it drip). | White PVC. |
| Gas | furnace | New gas meter on the left side yard wall, near the front (the condenser and electric meter side) → up the wall → into the attic → across to the unit → tee, capped sediment trap, yellow-handled shutoff, yellow flex connector into the cabinet. A closet unit's gas comes down from the attic. | Black iron. Meter as it looks on a SoCal house. |
| Flue, old furnace (80%) | furnace, Today's | Straight up from the burner compartment → through the roof → storm collar and rain cap above the covering. Offsets with 45° elbows if it has to clear framing or reach a slope that stays put. | Galvanized B-vent with joint collars. |
| Vent pipes, new furnace (90%) | furnace, a Build's | Two pipes from the burner compartment, one bringing combustion air in and one carrying exhaust out → through the roof → their terminations above the covering. The old metal flue and its cap are gone. | White PVC. |
| Furnace condensate, new furnace (90%) | furnace, a Build's | The furnace's drain port → its own trap → joins the primary condensate run (or runs beside it where there's no coil). | White PVC. |

- **Which furnace:** Tri Pros installs 90% furnaces (owner, 2026-11-25). A furnace whose material is the catalog's `high-efficiency-furnace` (every furnace a Build puts in) draws as a 90% unit. Any other furnace draws as the old 80% unit with the metal flue. Rule this from the furnace part's material, not from Today/Build, so a home that already has a high-efficiency furnace on file draws it right.
- **Furnace only:** gas and the flue (80%) or the vent pipes plus the furnace condensate (90%), no line set, no coil condensate.
- **Heat pump:** line set and condensate, no gas, no flue.
- **Wear:** the gas line takes the furnace's wear, and the line set takes the outdoor unit's.
- **The gas meter belongs to the house, not the furnace (my call).** It's always drawn, whatever the system, with mild age of its own. A furnace Build never renews it, because the water heater and range still use gas. Only the gas line from the meter to the furnace comes and goes with the furnace.
- **On a flat roof there's no attic for the closet unit's lines to cross (my call).** The flue or vent pipes go straight up through the roof. The gas runs up the outside wall and across the roof on supports to a penetration over the closet, as on a SoCal flat-roof house. The line set and condensate leave through the closet's wall, as they do today.
- **Tags (my call; no new pins or copy):**
  - gas line, meter and flue → `furnace`
  - condensate lines, pan and float switch → `coil`
  - line set and its cover → `refrigerant-lines`
- **Thermal paint:** the line set reads with the outdoor unit's running zone, as today. The flue reads warm while the furnace runs. Everything else reads the air it sits in.

### 4. The outdoor unit

- **A code-built top-discharge box replaces `condenser.glb` and the pack placement for both kinds.** Delete the old model, its placements and `CondenserFan`'s side-fan blades in the same change. The new box has:
  - Louvers on three sides and a service corner with a rating sticker.
  - A round top grille with the fan under it.
  - Service valves, an insulated line set and the electrical whip to a disconnect box on the wall.
  - The concrete pad, staining with wear.
- **Heat pump:** the same box with a "HEAT PUMP" badge. In winter, while it heats, its coil frosts and a thin rim of ice forms on its base. A condenser stands idle in winter.
- **Size and running cues stay:** the AC size multiplier stays (scale about the base centre), and the fan, shake and shimmer keep working.

### 5. Finish from wear

- **The finish is a function of wear:** 0 is the day it was installed, 1 is decades in.
- **As wear rises:**
  - The paint yellows a little.
  - Dust settles on top faces and grime collects low.
  - Labels yellow.
  - Galvanized metal and foil tape dull.
  - Copper darkens.
  - The pad stains.
- **Each section follows its own part's wear,** so a replaced furnace beside an old coil reads new next to old. A Build's new parts have wear 0.
- **Textures are cached, colours are continuous:** textures are generated once per wear step (a few steps, cached at module level), while colour, roughness and metalness move continuously. Share textures across meshes; give each section its own material, because `applyGhost` writes opacity per material.

### 6. Cost

- Per section, merge geometry by material, and merge label planes under one label material.
- Louvers, screws and grille bars are geometry merged into their section, not separate meshes.
- Routes are tubes merged per material.
- Aim: the whole indoor unit plus its lines about 15–20 draws, the outdoor unit about 6. Record actual counts against the cases above.

### 7. Phase 2: duct runs and boots

The approved duct mockup carries into `attic-ducts.tsx` and `duct-wraps.tsx`.

**Original run, growing with the ducts' wear:**
- Torn jacket with ragged dark-rimmed edges, the tears on the sides the camera sees.
- Fiberglass bulging out through the tears, and the black core showing where the insulation is gone too.
- Black leak stains around the tears and at the boot joint.
- A slight press where it was stepped on, at most about a fifth of its girth.
- Lying on the insulation and kinked into its boot.
- Dried cloth tape at the joints, its end peeling at the boot.

**New run (`r6-silver-flex`, `r8-flex`):**
- Bright metallized jacket printed "R-8 · FLEXIBLE AIR DUCT · UL 181", or R-6 for an R-6 run, with the wire's ridges just showing.
- Hung on straps with saddles, swept down into the boot through a straight stretch.
- At both ends: drawn tight over the collar, a black zip tie, foil tape.
- The boot's and plenum collar's seams sealed with grey mastic.

**Boots:**
- A galvanized box with a round collar on top.
- Every run ends over its collar, old or new, never beside it. Today's gap is a bug: trace its cause first.

**Look inside, cut open:**
- The jacket, insulation and core step back from the plenum end as they do today.
- The exposed core is open along its top.
- Its inside wall is caked with decades of dust, streaked the way the air runs, with fine grey grit and lint settled along the bottom. It's drawn on the core's back faces plus instanced specks, no bigger than the mockup's.

### 8. Phases

1. Phase 1 (#370): the indoor unit (both spots), what joins it, every line end to end, the gas meter and the flue cap, and the outdoor unit (condenser and heat pump).
2. Phase 2 (#371): duct runs, boots, and the cut-open core.

Each phase is its own plan, lane and PR into the epic branch, and ends with the owner looking at its preview on the iPad before the next starts.

## Left to the builder

- Module and file layout under `ui/components/home-kit/` and `ui/lib/` (canvas texture generators as `create-*-texture.ts`, as the scene already does).
- Exact route points against the house geometry: gable exit height, line-set cover drop, meter height, window for the secondary drain, flue offset. Set by screenshot, as working numbers.
- How the wear steps are cut, and how grime is applied: cached textures per step, or a small shader mix.
- Whether the closet's service switch and the attic's float switch survive the draw-call budget. Drop small parts before big ones if the budget bites.
- New part or domain names: check `GLOSSARY.md` first, and ask the owner before introducing a term.

## Verification

- `pnpm tsc`, ESLint on touched paths, `pnpm tsx scripts/verify-heating-cooling.ts`, `verify-trade-scene.ts`, `verify-trade-scene-layout.ts`, `verify-trade-scene-lot.ts`. Extend the checks where a rule is mechanical:
  - every line ends where it belongs (the line set at the outdoor unit's valves, the gas line at the meter, the flue or both vent pipes above the covering, each run over its boot's collar);
  - a furnace-only home draws no line set;
  - a heat pump home draws no gas line, flue or vent pipes (the meter stays);
  - a `high-efficiency-furnace` draws the two vent pipes and its condensate, and never the metal flue; any other furnace draws the reverse.
- Screenshots through the lane's probe on its preview, one case per run, in light and in the thermal view: closet Today and Build, attic Today and Build, condenser in summer, heat pump in winter, Look inside on the indoor unit, and (phase 2) the ducts cut open. Draw counts recorded for each.
