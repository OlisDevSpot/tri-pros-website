# TS3b.6-B: the garage joins the house

> **Status:** written 2026-11-01 from the owner's 6-B brainstorm; builder-checked the same day (R199, R200 and the Rain and arrow-strength calls came from it); the plan stress-tested the same day (R201, R202). Approved 2026-11-01 (the owner asked for the plan): `docs/superpowers/plans/2026-11-01-ts3b6b-garage-joins-the-house.md`. Replaces §8 of `docs/superpowers/specs/2026-10-31-ts3b6-lot-garage-and-light-design.md` (the TS3b.6 spec), which now points here.
> **Order (R145, kept by the owner 2026-11-01):** paint wear (R121), then TS3b.4b, then this. The owner asked for the plan before TS3b.4b landed, so the plan carries a re-baseline step: before Task 1 it re-reads every interface it names from paint wear and TS3b.4b and stops on any stale ref. The build still waits for both.
> **Tracker:** `docs/plans/2026-10-16-trade-scenes-epic.md` (TS3b.6 row; R129, R140, R142, R144, R146, R195–R200).
> **Branch:** `feat/trade-scenes-foundation` (worktree `.worktrees/trade-scenes`).

## 1. Intent

6-A put a two-car garage beside the house as a standalone building: walls in the house's paint colour, a raised-panel door, a roof that follows the house's form in one plain colour, under the `exterior` thermal tag, outside the house group. It has no heat story, and two things it buries were dropped to keep the screen honest (the right wall's heat lanes and the right-front downspout).

6-B makes the garage a real part of the home. The homeowner should come away understanding one thing (owner, 2026-11-01): **the garage is still outside space.** It is a hot volume in summer that pushes heat into the house through the wall they share, and a cold volume in winter that pulls the home's heat out through it. Cool Life paint and a cool roof soften that push; they never make the garage a room. That story belongs to an **attached** garage; a detached garage (later, R80) is just another building on the lot with no thermal story at all.

Along the way the garage stops lying where it meets the house: the window that looks into it becomes a door, the gable vent it covers goes away (and a new roof brings the ventilation back through roof vents), its roof is built from the house's real roof pieces, and its walls wear like the house's.

**Why it matters to the business.** Attached garages are on most of the homes the reps sit in. "Your garage is cooking the bedroom next to it, and here's what a cool roof and Cool Life do about it" is a story a homeowner feels. And "your attic lost half its ventilation when the garage was built; a tear-off puts it back" is a real reason for a new roof.

## 2. Owner rulings this design rests on

| Ruling | What it says | Where |
|---|---|---|
| R129 | The garage is unconditioned: hotter than the house in summer, much colder in winter, at its own hand-tuned temperature (R43) | tracker |
| R140 | The garage roof is the house's roof: same form and covering, changing with it | tracker |
| R142 | The house's bearing is a scene attribute everything sun-dependent derives from | tracker |
| R144 | Every home gets the attached two-car garage for now; the none / attached / detached input waits for R80 | tracker |
| R145 | 6-B builds after TS3b.4b (paint wear before that); kept 2026-11-01 | tracker |
| R146 | The shared wall lets in a little less heat than a sunny outside wall; the garage has no attic and no windows, its roof heats it directly; Cool Life paint and a cool roof passively cool it in summer and keep it warmer in winter | tracker |
| R195 | A pitched roof is a gable or a pyramid (hip) roof; a pyramid roof has no gables, gable vents or gable attic fan. **Logged for later, not built here** | owner, 2026-11-01 |
| R196 | **The garage reads as outside space.** Under Thermal it is a hot volume in summer that heats the house through the shared wall and a cold volume in winter that pulls heat from it; Cool Life and a cool roof soften it. The story applies to an attached garage only; a detached garage (later) has no thermal story | owner, 2026-11-01 |
| R197 | **The garage shows its temperature as a number**, a reading pin like the rooms' and the attic's | owner, 2026-11-01 |
| R198 | **The covered gable loses its vent; a tear-off adds roof vents.** With the garage attached, the house attic vents only through the remaining (left) gable vent, the common under-ventilated case. A new roof (tear-off) adds roof vents (no whirlybirds for now), and the extra ventilation cools the attic. It moves the scene's attic reading and arrows only; no bill cut for now. A tile reset adds none (agreed) | owner, 2026-11-01 |
| R199 | **The roof vents are the code's.** Code has required them on a re-roof since 2014: one roof vent per 400 sq ft, which for the scene's house draws **two vents on each roof face**. They come with every pitched tear-off, not as an add-on | owner, 2026-11-01 (builder check) |
| R200 | **The ridge vent is an extra add-on, off by default.** The code installs it with every shingle tear-off today (`scope-installs.ts`); 6-B takes it out of the default tear-off. The add-on the rep can switch on is logged for later | owner, 2026-11-01 (builder check) |
| R201 | **The vents cool the attic before the fan's thermostat reads it, and the fan may idle because of them.** In a few mixes (coastal Summer, cool roof, radiant barrier and fan) the vented attic stays under the fan's 100 °F switch-on point, the fan idles, and the tear-off's attic reads warmer than the same home without vents (96 °F against 84 °F). Accepted | owner, 2026-11-01 (plan stress test) |
| R202 | **The door from the rooms into the garage is the house door to the garage** (`HOUSE_GARAGE_DOOR`); "garage door" stays the car's roll-up door | owner, 2026-11-01 (plan stress test) |

## 3. Goals, non-goals, anti-goals

**Goals**
1. The garage has its own temperature per climate and weather, shown as a number, painted under Thermal, with arrows across the shared wall whose direction and strength follow the difference to the rooms (R129, R146, R196, R197).
2. Cool Life paint and a cool roof cool the garage in summer and warm it in winter, and its arrows into the house shrink with them (R146).
3. Where the garage meets the house, nothing is wrong: a house door to the garage in place of the right window, no buried gable vent, the downspout back, no arrow drawing over the garage that doesn't belong to it.
4. A tear-off on a pitched roof adds roof vents and cools the attic (R198).
5. The garage's roof is built from the house's covering pieces, and its walls take paint wear's marks.
6. It stays inside the TS3b.6 budget (§9).

**Non-goals**
- The garage input (none / attached / detached, R80) and stories. Every home keeps the attached garage (R144).
- Pyramid roofs (R195).
- A garage up-close system view or a garage anchor pin (a TS3b.4b-style system view, later).
- A bill cut for roof ventilation (R198) or for the garage's temperature (the hand-tuned bills don't model it).
- Whirlybirds; a home that already has roof vents today; ventilation that varies with era or condition; the ridge vent as an add-on the rep switches on (R200, later).
- The 6-A known gaps the owner left for later: the door's colour under AgX, the lawn's tile grid, pins covering the house at phone width, the stoop under a raised house's stair. The floating `yard` anchor goes to TS3b.4b.
- Opening the garage door, or anything inside the garage beyond what §5.2 names.

**Anti-goals: it fails, even if it works, if…**
- the garage reads as a room under Thermal: it must group with the outdoors, and the shared wall must read as the line between outside and inside;
- an arrow draws through the garage roof or walls from any camera the rep can reach, unless it is the garage's own lane;
- the Thermal lens, the home views, the ghost, the system view's fades or the foundation switch break or look wrong on the garage;
- the attic's approved readings shift for a home without a tear-off;
- the iPad frame stutters on a camera slide.

## 4. Heat

### 4.1 The garage reading (R129, R197)

- A `garage` reading joins the readings (today `roof`, `attic`, `ceiling`, `exterior-wall`, `window`, in `home-anchors.ts` `READING_IDS` and the per-climate, per-weather `STARTING_HOME_HEAT` in `home-heat-figures.ts`). Hand-tuned (R43). Placeholders for the owner to tune at the review:

  | | Inland | Coastal |
  |---|---|---|
  | Normal | 92 °F | 84 °F |
  | Summer | 118 °F | 102 °F |
  | Winter | 45 °F | 50 °F |

- **Rain** computes no heat today (`resolve-scene.ts` sets heat to `null` in rain): no readings, no pins, no arrows, and the thermal paint falls back to the storm's air (`home-paint-temperatures.ts`, which paints a storm against the winter preset). The garage follows: no pin and no arrows in Rain, and its paint falls back to the storm's outside air plus 3 °F, the TS3b.6 spec's Rain row (Claude's call; see §11).
- **The pin (R197):** the garage shows its reading as a pin, like `exterior-wall`, on the garage's front wall above the door or wherever it reads cleanly at the opening view, with a `READING_CALLOUTS` entry and an anchor per roof form. Its copy names it "Garage". It shows wherever the other outside readings show (so not in Rain).

### 4.2 Thermal paint (R196)

- A `garage` thermal zone (`home-thermal-zones.ts`) paints the garage's walls, door and slab at the garage reading.
- The garage's roof paints as the house's roof does (the roof heats the garage directly, R146).
- The garage's figures sit near the outdoors' (the inland summer garage at 118 °F against a 124 °F sunlit wall, 100 °F air and 76 °F rooms), so on the fixed palette it groups with the outside, not the rooms. If the owner's tuning ever pulls it toward the rooms, that breaks R196.

### 4.3 Arrows across the shared wall (R146)

- In place of the right-wall and right-window lanes 6-A dropped, lanes cross the shared right wall (the span the garage covers, `GARAGE_REACH` in `home-heat-lanes.ts` today):
  - **from the garage into the rooms** when the garage is hotter than the rooms (Normal, Summer);
  - **from the rooms into the garage** when it is colder (Winter; Rain draws no arrows, §4.1).
- **Strength is computed, not hand-set per weather** (Claude's call). "The rooms" are the thermostat setpoint for the climate and weather (`CLIMATE_PRESETS[climate][weather].setpoint`, what the `interior` zone paints). The flow is the garage reading minus the setpoint, times one hand-set shared-wall factor, chosen so that at the default figures the shared wall carries a little less than the sunny wall's hand-set flow (R146). The sign sets the direction. Because the flow comes from the reading, every upgrade that moves the garage reading (§4.4) moves the arrows with no flow multipliers of its own. (The house's other lanes stay hand-set, as today.)
- The lanes run on the room side of the shared wall and a short way into the garage, so in Partly open they read as heat coming through the wall from the garage, not as arrows floating over the garage's roof.
- The garage's lanes feed the meter's load no more than today: the existing upgrade effects already carry the load, and the garage figure feeds no savings (Claude's call).

### 4.4 Upgrades move the garage (R146)

- Cool Life paint and a cool roof get a `garage` reading effect in each weather, through the same per-part, per-material, per-weather effects that move the house's readings today (`PART_HEAT_EFFECTS`): cooler in Normal and Summer, slightly warmer in Winter. Hand-tuned (R43).
- The lanes follow the new reading, so they shrink with the upgrades.
- Nothing else touches the garage reading for now (insulation, windows and ducts are the house's).

### 4.5 Attached only (R196)

- The garage's reading, zone, pin, lanes and upgrade effects are the attached garage's. There is no garage input yet (R144, R80) and none is added. Keep them in garage-named entries, so the day a detached garage exists, it leaves them out in one place and paints as an ordinary outside building (Claude's call: no scene attribute is added now; R80 owns that input).

## 5. Where the garage meets the house

### 5.1 The right window becomes a door

- The right wall's window (`HOUSE_WALLS.right.openings[0]`) sits inside the garage. It becomes the **house door to the garage** (R202), which is how attached garages are built. In Partly open the room shows a door instead of a window looking at a wall.
- The door is plain, in the house's door style, drawn from both faces; it does not open.
- **TS3b.4b's windows view:** 4b picks "one window the camera can reach from the default framing". 6-B checks that 4b did not pick the right window. If it did, the plan moves that view to another window (a ⚠️ for the plan, not a design question).

### 5.2 The foundation switch

- The garage is always on a slab at grade. On a raised-foundation house the house floor is higher than the garage floor, so the house door to the garage opens onto a small landing with steps down to the slab, inside the garage (Claude's call; the builder sizes it). It shows only when the garage ghosts, since the garage stays closed.
- The garage never lifts with the house (it stays outside the lift, as in 6-A).

### 5.3 The covered gable and the roof vents (R198)

- **The covered gable loses its vent.** On a pitched house the right gable vent, its backing and anything the Attic build hung on it (`gable-vent-boxes.ts`, `gable-vent-backings.tsx`) are gone while the garage is attached. That gable shows plain stucco above the garage roof.
- The left gable vent and the attic fan behind it stay as the Attic build placed them.
- **Today's attic readings stand.** The figures the Attic build tuned are the under-ventilated, one-vent attic. They do not rise because a vent went away (Claude's call: re-tuning would move every approved figure).
- **A tear-off adds the code's roof vents (R199).** One per 400 sq ft: **two low-profile static vents on each face** of the house's pitched roof (four on today's gable roof), upslope near the ridge, so the front pair shows in the opening view. No whirlybirds (R198). They become a construction part, `roof-vent`, that the tear-off installs (`SHINGLE_ROOF` in `src/shared/modules/construction/core/constants/scope-installs.ts`, beside the underlayment and drip edge), so TS3b.4b's Roof & gutters view can name them and their effect hangs on the part like every other (Claude's call). The existing home never has them. A tile reset adds none (R198), nor does any other roof scope. A flat roof adds none: its shallow joist space has no attic to vent (Claude's call). The garage roof gets none: it has no attic (R146).
- **The ridge vent leaves the default tear-off (R200).** It is an extra add-on, off by default. 6-B removes `ridge-vent` from `SHINGLE_ROOF`, so a default tear-off draws no ridge vent. The rep's add-on switch for it is later (§3 non-goals). The meeting visualizations' older roof cutaway (`src/features/meeting-visualizations/`) keeps its own ridge vent and rules; 6-B leaves it alone.
- **The vents cool the attic.** With the `roof-vent` part installed, a hand-tuned ventilation effect per weather lowers the attic reading in Normal and Summer and eases the roof's lanes into the rooms, as a part effect like every other part's (`PART_HEAT_EFFECTS`), so it applies before the fan's thermostat reads the attic, and in a few mixes the fan idles because of it (R201). Smaller than the fan's. Winter unchanged.
- **The vents' own arrow:** in Normal and Summer one faint lane rises out of the roof vents, weaker than the fan's lane out of the left gable, so the extra ventilation reads under Thermal above the ridge from the front (Claude's call).
- **Bills:** none. The tear-off's own bill cut stays as it is; ventilation gets a bill cut later, through the energy-impact work, if the owner wants one (R198).

### 5.4 The downspout and gutters

- The right-front pitched downspout 6-A dropped comes back at the garage's front-right corner.
- On a pitched house the garage's front eave carries a gutter that follows the house's gutter part (its material, colour and wear), draining to that downspout. A flat garage drains as the house's flat deck does (Claude's call).

### 5.5 Arrows over the garage roof

- From a high front-right camera in Partly open, two back-wall lane rows draw over the back of the garage roof today (a 6-A known gap). After 6-B, no house lane draws over the garage from any camera the rep can reach (orbit and pan limits). The builder picks how (depth testing against the garage, trimming the lanes, or drawing order) and proves it with shots from the corners of the orbit.

## 6. The garage's roof, built from the house's pieces (R140)

- **Pitched:** the garage's slopes are built from the house's own roof pieces: real shingle, tile or shake courses, the covering's colour and wear, and the cool-roof finish, all following the house. 6-A's plain-colour slopes go.
- **Flat:** the garage deck takes the membrane's real pieces (seams, wear, cool membrane).
- The garage roof has no attic and no deck layers to show. The garage's ceiling is open to its roof (R146), so its underside is the deck seen from inside, drawn only if a view can reach it.
- **TS3b.4b's roof system view:** the garage's covering pieces carry the roof covering's part tags, so the Roof & gutters view lights them with the house's covering. Everything else on the garage fades with the house (§7).

## 7. Home views, ghost and system views

- **Partly open:** the garage stays closed. Partly open opens the house's front, not the garage.
- **Ghost and fades:** the garage joins the house's fades when the camera goes up close, so it never blocks an up-close view of the right side. TS3b.4b replaces the whole-house ghost with per-part fades. The garage follows whichever the house uses when 6-B builds: it fades like house geometry, except its roof covering in the Roof & gutters view (§6). It joins the fades without joining the foundation lift (§5.2).
- **Thermal tag:** the garage moves from the `exterior` tag to its own `garage` zone (§4.2), except its roof (`roof`).

## 8. Paint wear and the sunny wall

- **Paint wear on the garage (R121).** The garage's walls take paint wear's marks (cracks, stains, peeling), placed by the same pure per-wall functions as the house's walls, handed the garage's faces (the paint wear plan already shapes its placement functions to take a `HouseWall`, so this is a hand-off). The garage keeps the house's paint colour, condition and levels; it has no settings of its own.
- **The sunny wall follows the bearing (R142).** The `exterior-wall` and `window` readings, the `exterior-wall` pin and their callouts in `home-anchors.ts` go on the sunniest house wall under the bearing (`SCENE_ATTRIBUTES`), not on a hard-coded left wall. With the default bearing nothing moves on screen. The shared right wall is never the sunny wall: the garage covers it.

## 9. Budget

The TS3b.6 budget (6-A + 6-B together, against the original at the same view) left 6-B, after 6-A was measured on 2026-11-01:

- **+17 draw calls** and **+23.5k triangles** on a flat roof;
- the garage's real courses at most **+60k triangles on tile**;
- **2.4 MB** of texture memory (6-B adds no textures);
- no 4096 shadow map, no post-processing composer.

Paint wear (R121) and TS3b.4b land first and move the scene's head. Their own costs are theirs (paint wear's marks' extra draws were accepted with its plan). So 6-B is measured **against the head it builds on**, with the allowance above, using the 6-A probe scripts (1280 × 800, Complete, Normal, flat and tile, default and worst views). The owner confirms on the iPad that a camera slide stays smooth in all four weathers.

## 10. Files 6-B is expected to touch

Named for the plan's coordination, as of 2026-11-01. TS3b.4b and paint wear will have moved some of them:

- heat: `home-heat-figures.ts`, `home-heat.ts`, `home-anchors.ts` (readings, callouts, anchors, the sunny wall), `home-thermal-zones.ts`, `home-paint-temperatures.ts`, `home-heat-lanes.ts` (constants and lib), `reading-labels.tsx`, the scene copy;
- the meeting with the house: `home-geometry.ts` (`HOUSE_WALLS.right` opening, `DOWNSPOUTS`), `downspout-boxes.ts`, `gable-vent-boxes.ts`, `gable-vent-backings.tsx`, `gable-vent.tsx`, the window and door boxes, `house-shell.tsx`;
- the garage: `garage-boxes.ts`, `garage.tsx`, `garage-gable-end.tsx`, and the house's covering and membrane components (`roof-covering.tsx`, `roof-slope.tsx`, `low-slope-roof.tsx` and their layout libs) so they can draw the garage's slopes;
- roof vents: `src/shared/modules/construction/core/constants/scope-installs.ts` (`roof-vent` in, `ridge-vent` out of `SHINGLE_ROOF`), the construction part and material lists and their copy, a new vent component and its boxes, the heat effect in `home-heat-figures.ts`;
- views: `home-kit.tsx` (the garage's tags, fades and props), whatever TS3b.4b leaves as the fade mechanism;
- paint wear: the R121 placement functions' callers;
- checks: `scripts/verify-trade-scene.ts`, `scripts/verify-trade-scene-lot.ts`.

## 11. Calls Claude made (check while reading)

1. The plan carries a re-baseline step, run once TS3b.4b lands (the owner asked for the plan before it did).
2. Rain follows the code: no garage pin or arrows, as for every reading, and the garage paints at the storm's outside air plus 3 °F.
3. The garage's walls, door and slab paint at the garage reading; its roof paints as the roof.
4. The garage's lanes don't move the meter's load or any savings. Their strength is computed from the garage reading minus the setpoint, times one hand-set shared-wall factor.
5. No scene attribute for attached / detached now; the garage's heat sits in garage-named entries so R80 can drop it in one place.
6. A raised house's door to the garage opens onto a landing and steps inside the garage.
7. Today's attic figures stand as the one-vent attic; the tear-off's vents lower them from there.
8. Roof vents: a `roof-vent` construction part in the tear-off's installs; two per face, upslope near the ridge; pitched tear-offs only; none on flat roofs or the garage.
9. One faint outflow lane from the roof vents in Normal and Summer.
10. The garage's front eave gets a gutter following the house's gutter part; a flat garage drains like the house's deck.
11. In the Roof & gutters view the garage's covering lights with the house's; everything else on the garage fades.
12. 6-B is measured against the head it builds on, with the allowance 6-A left.
13. The garage pin's copy is "Garage" and it sits on the garage's front wall.

## 12. Left to the builder

- File and component names beyond those named here.
- Where exactly the garage pin and the roof vents sit, settled by screenshot.
- How the lanes stop drawing over the garage (§5.5).
- The landing's and steps' sizes, the door's look within the house's door style.
- The working effect sizes for the vents and the upgrades on the garage, until the owner tunes them (R43).
