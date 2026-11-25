# TS3b.4b: up close on a system

**Status:** §1–§10 built 2026-11-05 (`4914f38fd`..`d93a6efc3`, unmerged). **§11 (round 2, R247–R252) approved by the owner 2026-11-05**; nothing in it is built until the owner says "build" or "execute".
**Tracker:** `docs/plans/2026-10-16-trade-scenes-epic.md`, row TS3b.4b; requirements R60, R92 (changed), R119, R120, R122–R126, R133–R136, R228–R231; round 2 R247–R252.
**Branch:** `feat/trade-scenes-foundation`, worktree `.worktrees/trade-scenes`.

---

## 1. Why

The trade scene is the meeting's product-benefits presentation (R118). The rep sells each upgrade by showing the homeowner what their home is made of, what's worn or missing, and what the Tri Pros build puts in its place.

Today only the roof can be shown that way. The rep taps the roof, the camera glides into a separate cut slice of roof and attic, and its layers peel apart. That slice is a second model of the roof, drawn on its own. So it has drifted from the house:
- It ignores the Owens Corning colour the rep picked (`assembly-kits/roof-attic/covering-part.tsx:15` colours from its own `KIT_COVERING_COLORS`; the home uses `installedShingleTone`, `home-kit/house-roof.tsx:58`).
- It draws wear as "worn or not", while the home draws all five condition steps (`PartRendererProps`, `types.ts:207`, carries no wear).
- It mixes two systems: the attic (ceiling, air sealing, insulation) sits inside "the roof".

The owner wants one general way to focus on **any** home system, built on the house the homeowner is already looking at, and wants the rep to be able to change that system right there.

## 2. What the rep sees

Rewritten 2026-11-03 for the Controls head (R228, R229). Controls already gives every system a way in: the **Systems rail** puts a system **in focus** (the camera goes to it) and its **system card** shows only its inputs, a Today row and a Tri Pros build row. Up close builds on that; it is never a second mode beside it.

1. **The rep picks a system.** Two doors lead to the same thing (R229):
   - its chip on the Systems rail;
   - a tap on the house, which shows a pin for every system at that spot: Roof and Attic on a pitched roof, only Roof on a flat roof (Attic too once a redeck is in the build), Heating & cooling on the condenser or the package unit, Windows on a window. A pin does exactly what that system's rail chip does. Nothing goes up close on the tap itself, and no pin shows until a tap asks for one, so today's standing "Inside the roof" chip goes.

   The camera glides to the system and its card appears beside it, as Controls does today.
2. **Look inside.** The system card's **Look inside** takes the rep up close (R228). Everything that isn't this system drops to a low opacity; the system's own parts stay solid and lit. Only this round's systems (roof, attic, windows, heating & cooling) offer it.
3. **A layered system opens as a stepped cutaway**, on the house itself, like a roofing brochure: each system part is cut back a little further than the one above, so every system part shows at once (R135). The peel slider opens and closes the steps. (R119)
4. **The same system card carries the rest** (R228): its Today and Tri Pros build rows, as today, then the peel slider and the system's parts list (tap a part, on the card or on the house, and it stays whole while the rest of the system dims). The close-up card on the left retires: one system, one card, one camera. Every change is the same scene change Modify and the card already make, and a pick never flips the scene: only the Today ⇄ Build toggle does (Controls ruling).
5. **What's drawn up close is exactly what the rep set**: material, condition, every upgrade and its options. There is one model and one set of picks, so a view can never disagree with the house. (R120)

## 3. The systems

The systems are the Upgrades groups, with the same names (`HOME_SYSTEMS`, `HOME_SYSTEM_LABELS`): Roof & gutters, Attic, Windows, Walls, Heating & cooling, Foundation, more to come. Adding a system means adding one entry to that list, plus its parts and its look.

**This round:** Roof & gutters, Attic, Windows, Heating & cooling; Walls joins in round 2 (§11, R248).
**Not this round:** Foundation. Tapping it shows no pin. The crawl space waits until it's fully modelled (T7, R102).

### 3.1 Roof & gutters
- **Parts:** covering, underlayment, ice & water shield, drip edge, deck, rafters, ridge vent, gutters.
- **Steps:** down the near slope, covering on top and rafters at the bottom.
- **Flat roof:** the torch-down layers on its deck and joists.

### 3.2 Attic (pitched roof only, R111)
- **Parts:** radiant barrier (foil stapled to the rafters from inside the attic, a retrofit, never faced decking), the attic fan on its gable end (R106), air sealing (foam collars round each ceiling opening, R110), insulation, and the ceiling (its joists and drywall, one grouped component shared with the roof system, lit here only for the gaps that leak air through it, R136). The gable vents, ceiling openings and hung ducts come from the Attic work (R105–R110), which lands first and builds on the home only.
- **Steps:** across the attic floor, through insulation and air sealing, down to the ceiling when it shows (R136).
- **Insulation, top off vs replace (R60, R122):**
  - Switching the pick redraws the attic. A top off shows the new blown-in layer over the old one. A replace shows the old one gone and the new one in its place. That's the whole comparison; there's no side-by-side (owner).
  - With no insulation today, only top off is offered.
  - With R-30 already there, top off offers R-38 only. With R-38 already there, there's no top off, and replace shows only when it's below New. A replace at the same R-value fixes the insulation but cuts no bill.
  - Levels are named by depth and R-value everywhere they're shown or picked: None, 3.5 in. (R-11), 6 in. (R-19), 10 in. (R-30), 12 in. (R-38). 12 in. (R-38) joins as a level a home can already have (R133). Today `insulationLevels` is `none, low, medium, high` (`enums.ts:44`), stored in `customer_profiles.insulation_level`, and also used by the customer profile fields and the older roof cutaway in `meeting-visualizations`.
  - Top off is always to R-30, with R-38 (12 in.) as the step up, in blown-in fiberglass.
  - Replace is R-30 or R-38, in blown-in fiberglass or fiberglass batts. Batts look more orderly, with the joists slightly showing, at exactly the same efficiency.
  - R-38 is an efficiency upgrade option over R-30, 2 points better (R126).
- **Flat roof:** no attic, so no radiant barrier, air sealing or fan (R111). Its insulation sits in the closed joist cavities, so it's offered only with a redeck in the build (R134). See §8.2 for where it shows up close.

### 3.3 Windows (R123)
- **Today, typically:** single-pane glass in an aluminum frame.
- **New window:** outer pane, Low-E coating, argon gas, inner pane, vinyl frame, seals, flashing, and a screen (round 2, R251). No spacer.
- **Frame copy:** virgin vinyl is sturdier than recycled vinyl.
- **Steps:** through the window's face: outer pane, Low-E coating, argon gap, inner pane, with the frame, seals and flashing around them.
- **Which window:** one the camera can reach from the default framing (builder picks it; see §7).

### 3.4 Heating & cooling (R124, R125)
- **Parts:** the ducts where they really run, the register boots on the ceiling (R108), the air handler and its plenum, plus the condenser and refrigerant lines on a split system or the package unit on a package system.
- **A duct opens into its system parts:** inner core on its wire coil, insulation blanket, silver mylar jacket. The blanket's thickness is what R-6 vs R-8 means (R124 said the jacket; built on the blanket, `DUCT_WRAP_LOOKS`). The original ducts show their own thinner, crushed make-up.
- **The package unit fix (a fix to the house, seen from every view):** on a pitched roof it moves to the far slope beside the plenum and connects down into the plenum and ducts. It stays solid on its curb in every view. The far slope never opens in Partly open (only the near slope's end does, `gable-roof.tsx`, `HOME_FADE_TAGS.complete`), so Partly open itself doesn't change.

## 4. Goals

- One system view, for every system, on the home's own model (R119).
- The card's system page carries that system's Home and Upgrades rows (R119).
- Every view draws the home's own state: the shingle colour and the five condition steps up close, as on the house (R120).
- The roof & attic slice (the assembly kit) retires. What it draws well moves onto the home's parts: each covering per material, rain over the layers, leaks at worn spots, heat lanes through the layers with their readings, and thermal paint.
- Insulation offers and bill cuts follow R122 and R126, in the shared construction rules, so the scene and the proposal agree (R101).
- Window and duct system parts as above; the package unit fix.

## 5. Non-goals

- Foundation up close; the crawl space system (T7, R102). (Walls left this list in round 2, R248.)
- Tap a part to pick its upgrade, and jumping into sections (TS3b.5). This design must not block either one. A tap that only reveals a pin is safe alongside the camera's double-tap: the first tap of a double-tap just shows a pin.
- Better models and realism (TS3b.6). Their brainstorm is running now.
- Window frame colours as a pick (R116). Up close draws the frame the house has.
- Arrows that only show where they are (R113); Benefits and the upgrade registry (R127, R128).

## 6. Anti-goals: what would make this a failure even if it works

- A view that draws anything from its own copy of the state: a colour, a wear, an R-value, a pick.
- A second model of any system.
- Going up close becoming the only way to change a system.
- Heat or savings figures changing because parts were regrouped (see §8.1).

## 7. Constraints and traps

- **The part `group` drives the heat math.** `thermal-walk.ts:36-38` splits the outer path from the inner one on `assembly.readings.outerGroup`. The radiant barrier is `group: 'roof'` because it reflects from under the deck. A system's membership must be its own list, never the `group` tag, and no part is retagged. `HOME_SYSTEMS` already lists the offered rows per system; the full set of lit parts per system belongs beside it.
- **Every part belongs to exactly one system, except a shared system part** (R136: the ceiling, in the roof and attic systems), which each system lights only for its own story. Look up a material's system through its parts (`HOME_MATERIALS[id].parts` → the system listing that part). Never set it by hand, so a system card's Today chips (keyed by `HomeMaterialId`) and its build row always agree on the system.
- **System parts that aren't construction parts must not move the savings.** The panes, argon and Low-E of a double-pane window, the seals and flashing round its frame, and the core, insulation and jacket of a duct, are system parts the scene names and steps open, drawn on the construction part they belong to. The glazing's R-2 and the duct's R-6/R-8 stay the construction model's figures.
- **Up close today is keyed by assembly** (`TradeSceneInputs.zoom: AssemblyId | null`), mutually exclusive with the System in focus (`cameraFocus`): opening Systems leaves a close-up (`scene-controls-context.tsx`), and a zoom closes Systems (`systems-section.tsx`). Up close becomes a deeper step of the System in focus (R228), so `zoom` goes and that exclusion goes with it. Its readers span the canvas, the close-up card, the Controls (context, Systems section, shortcuts, keys sheet), the stage's visible area and dock region (`zoomed`), the resolver's heading, the burst key, the blueprint load's checks and the kit. Re-grep `\bzoom\b` and `zoomed` (identifiers, not comments) when planning; the 2026-11-03 list is in the plan.
- **The house already fades whole up close** (`home-kit.tsx`, `ghosted` → `HOME_GHOST_OPACITY` via `applyGhost`). The system view fades per part instead. The house's meshes already carry part tags for thermal paint (`thermalTag(...)` userData), which a per-part fade can likely read.
- **The settled Complete house hides the attic and ducts groups** (`home-kit.tsx` `hideUnseen`). Up close on the attic or heating & cooling must show them.
- **Build order (R231):** after Benefits lands and the owner's look, and after Layout L1+L2 merges into this branch; before Layout L3, whose house masses build on 4b's fade and system parts, as 6-B does. The Attic work, the TS3b.4a fixes, paint wear, the blueprint load and Controls have all landed.
- **Controls rules 4b keeps:** a tap away exits Systems; no Done buttons; Escape steps back menu → system → window, and Look inside joins that order; the blueprint load's `live` gate holds pins and shortcuts (blueprint D10); every write goes through the one scene change (`applySceneChange`).
- **Systems become areas later (R230).** 4b stays keyed on the system id and puts no system-named key in DOM ids or 3D tags, so the rename stays one type plus its labels.
- **The owner judges by eye.** Every framing, step depth and fade level is settled from screenshots at iPad landscape (1194×834) and 1280×800, on a pitched and a flat roof, in Normal, Summer, Winter, Rain and Thermal. Baseline shots of today's close-up are in `.superpowers/brainstorm/2026-10-30-up-close-screens/baseline/`.

## 8. Decided

### 8.1 By the owner (2026-10-30)
- One general system view on the home's own model; everything else at low opacity; layers expanded in place as a stepped cutaway; the kit retires (R119).
- Systems = the Upgrades groups; this round roof, attic, windows, heating & cooling; crawl space waits (R119).
- The card is the system's page with its Today and Tri Pros build rows (R119); on the Controls head that card is the system card, and up close is its Look inside (R228).
- Tap → pin(s); no standing chip; one pin per system at the tapped spot (R119). A pin picks the system, as its rail chip does (R229).
- Up close draws the home's own state (R120).
- Insulation offers and the top off vs replace comparison (R60, R122), including the offers at R-30 and R-38; R-38 2 points better (R126); levels named by depth and R-value (R133); a flat roof offers insulation only with a redeck (R134).
- Look inside sits on the system card (R228). The 2026-10-30 links on the Current materials and Upgrades headings are moot: Controls removed those lists.
- **Insulation levels are renamed outright, not relabelled** (owner, 2026-10-30): no customer insulation data is worth keeping, so there's no defensive path.
  - The level's values become depth and R-value ids (none, R-11, R-19, R-30, R-38).
  - Their names, "None, 3.5 in. (R-11), 6 in. (R-19), 10 in. (R-30), 12 in. (R-38)", come from one place in the construction module, the source of truth for construction data, beside `insulationLevels` (`enums.ts:44`).
  - Every reader takes them from there, with no local label map (today: `INSULATION_LEVEL_LABELS` in `home-scene-copy.ts`):
    - the trade scene;
    - the customer profile fields (`property-profile-fields.ts`, `customers/schemas`);
    - `customer_profiles.insulation_level`;
    - `era-defaults.ts`, `roof-attic-inference.ts` (`BATTS_BY_LEVEL`);
    - the older roof cutaway in `meeting-visualizations`.
  - Values stored under the old names are cleared by a one-off script, on dev with the owner's yes and on prod only when the owner asks. The column is `text(..., { enum })`, so `db:push` changes nothing.
- **Everything a system view shows is a system part** (R135): a whole construction part, a piece of one (a pane, the Low-E coating, a duct's jacket), or a shared component. It replaces "layer" for the pieces of a part.
- **Shared system parts** (R136): the ceiling, drawn as one grouped component (joists and drywall), belongs to the roof and the attic systems and is lit in each only for its story there: a leak reaching it (roof), the gaps that leak air (attic), mold later. It stays one construction part. The rule is general, for the next component two systems share.
- **Build order (2026-11-03):** after Benefits and Layout L1+L2, before Layout L3 (R231).
- **Systems become areas later** (R230).
- Window parts (R123); duct system parts (R124); the package unit's place, connection and Partly open look (R125).
- The Attic work builds only on the home (told to its session; it dropped its kit task).

### 8.2 Claude's calls (for the owner to check)
- **Rafters belong to the roof system.**
- **Flat-roof insulation up close:** on a flat roof the Attic system holds just the insulation in the joist cavities. Its pin (next to the roof's) and its Look inside appear only when the build has a redeck. Without one, the Attic card keeps its existing insulation chip and shows the insulation upgrade as blocked, "needs a redeck", as the deck shows "needs a tear-off" (2026-11-03).

- **R-38's +2 means +2 on both electric and gas** (R126 records this reading).
- **Up close no longer opens the house.** Today it forces Partly open (`home-scene-canvas.tsx`: `open = homeView === 'partly-open' || zoom !== null`). The system view's own fade replaces that: everything that isn't the system is already see-through. So:
  - the roof's stepped cutaway is built on the part of the near slope that's always there (`HOUSE.cutX..ROOF_HALF_LENGTH`);
  - the attic and duct groups show up close even when the house is a settled Complete (an exception to `hideUnseen`);
  - leaving up close returns to the home view the rep picked.
- **Existing double-pane looks older than new double-pane, with no new material.** The glazing part's condition already tells them apart:
  - `installed` (the build's window) draws argon and the Low-E coating;
  - `retained` or `worn` double-pane (the home's own) draws an air gap with no coating.

  The construction model and its R-2 don't change.
- **The original frame draws by glazing.** With single-pane glass it's aluminum, the common old window (owner). With double-pane glass it's vinyl. It's still the one `original-frame` material, with copy to match.
- ~~Picking an upgrade on the system page shows the Tri Pros build.~~ Withdrawn 2026-11-03: the Controls ruling stands, a pick never flips the scene and only the Today ⇄ Build toggle does.
- **The duct's system part names:** inner core on its wire coil, insulation blanket, silver mylar jacket.
- **Tri Pros installs virgin vinyl**, so it's copy on the frame, not a pick.

## 9. Left to the builder

- The name and shape of the up-close state (replacing `zoom`), and where a system's full part list lives beside `HOME_SYSTEMS`.
- How the house's system parts are built so they can step: which of today's merged boxes and instanced pieces split, and how a step cuts a system part back.
- Which window and which duct run each view opens, the camera framings, the step depths, and the fade level, all settled by screenshot.
- Moving the kit's flows (rain ribbons, leak drips, heat lanes and their readings, thermal paint) onto the home's geometry, and deleting the kit, its registry (`ASSEMBLY_KITS`, `ASSEMBLY_SCREENS`), its host and its `kit-*` libraries in the same change (no shims).
- The heading copy per system, in the voice of today's "Roof & attic, x-rayed" heading.
- The insulation materials and scope installs needed for R122 (R-30 and R-38, blown-in and batts), and R-38's efficiency upgrade option in the bill cuts. The energy-impact tracker (`docs/plans/2026-10-21-proposal-energy-impact-epic.md`) gets the matching edit, as the attic fan's EI-D27 did.

## 10. Terms

Recorded in `GLOSSARY.md`:
- **System part** (R135, R136): everything up close shows, whether a whole construction part, a piece of one, or a shared system part.
- **Look inside** (R228): the system card's step from a system in focus to up close.

Proposed, to record once the owner agrees:
- **Stepped cutaway:** how a layered system opens up close, each system part cut back further than the one above.

Superseded 2026-11-03: "System view" (now Look inside on the System in focus) and "System page" (now the System card).

## 11. Round 2: the owner's first look (2026-11-05, R247–R251)

Five changes from the owner's first look at the built work, on the same branch and before it merges. Each section gives what the owner said, then the calls that are Claude's (marked), for the owner to check.

### 11.1 The attic and heating & cooling open the house (R247)
- **Owner:** putting the Attic system in focus shows Partly open on its own, so the roof is out of the way. Heating & cooling does the same, since its ducts and air handler are in the attic. Leaving the system puts back the home view the rep picked.
- **Claude's call: the open house is derived, never written.**
  - The house reads open when the rep picked Partly open, or when the Attic or Heating & cooling is in focus. It is the same rule up close used to have (`open = homeView === 'partly-open' || zoom !== null`) before §8.2 removed it.
  - The rep's `homeView` is never overwritten, so leaving the system restores it with nothing to remember.
  - **Owner (2026-11-05): the dock's home view control stays pressable.** It keeps showing and toggling the rep's own pick, as the `v` key does; while a system holds the house open, the pick shows once the rep leaves the system.
- **Claude's call: one list sits beside `LOOK_INSIDE_SYSTEM_IDS`** naming the systems that open the house. A later system (the crawl space) only joins it.

### 11.2 Walls up close (R248)
- **Owner:** Walls gets its pin on a wall tap and its Look inside, like the other systems. It overturns §3 and §5. Foundation still waits.
- **The way in.** A tap on a wall's face shows the **Walls system** pin. A tap on a window still shows Windows only; the glass and its frame are the window's, the wall around them is the wall's.
- **System parts.** These are the ones `SYSTEM_PARTS` already lists for the form the home has:
  - **Stucco:** paint, finish coat, brown coat, scratch coat, lath, weather-resistive barrier, sheathing when there is any, studs with their cavity insulation (or the empty cavities), drywall.
  - **Siding:** the siding, the barrier, then the same.
  - Paint wear (cracks, stains, peeling, R121) shows on the paint as it does on the house.
- **Steps (Claude's call; superseded by §11.9, the wall is looked inside whole).** The steps run through the wall's face, the paint outermost, each part cut back further than the one outside it, down to the drywall.
  - Today the house draws a wall as one skin (`wall-skin.tsx`), so the cutaway's parts are new pieces on that wall's own spot, each wrapped in `systemPartTag`. It works the way the window's panes did (Task 12).
  - The wall it opens is the one the Walls camera view frames (`READING_ANCHORS[form]['exterior-wall']`), clear of the window Look inside opens. The patch's size and step depths are set by screenshot.
- **The card.** It holds the repaint and Cool Life paint rows, as Controls shows them today.

### 11.3 The tear-off repairs the old deck (R249)
- **Owner:** a tear-off removes every layer down to the deck, and Tri Pros repairs up to 15% of the wood automatically (the roof SOW's agreement note). Every roof is assumed to have a deck with at least some damage: shingle condition says nothing about the deck's.
- **Today, every home:**
  - The deck shows a few rotted, water-darkened areas whatever its condition.
  - The deck's text: *"An old deck often has some areas that need to be replaced due to wood rot or water damage over time."*
- **The build with a tear-off:**
  - The same areas show as new wood. Their area together stays within 15% of the deck that is shown.
  - The text: *"An old deck often has some areas that need to be replaced due to wood rot or water damage over time. Once the old roof is off, we repair those sections up to the allowable limit."* The 15% is not named in the copy (owner).
  - **Claude's call (with the plan):** the build's line keeps the Today sentence, so "those sections" has something to point at. It says "once the old roof is off" rather than "with a tear-off", because a torch down and a tile reset get the same repair (below). *For the owner to check.*
- **Other builds:**
  - **An overlay** keeps the old deck, rot and all, under the old roof: an overlay repairs nothing.
  - **A redeck** (and the solid decking that replaces spaced boards) is all new wood, so it has no patches.
- **Claude's call: every scope that takes the roof off to the deck gets the repair.** That is tear-off, torch down and tile reset (`ROOF_OFF_SCOPE_IDS`), not the tear-off alone, because each one bares the same deck. *For the owner to check.*
- **Claude's call: the copy moves in the construction module,** on the deck's own copy. It replaces today's *"Decades of heat and leaks leave soft spots…"* line, so the scene and anything else that reads the deck's copy say the same thing. The meeting presentations keep their own deck line (`meeting-visualizations/constants/roof-cutaway-copy.ts:17`), which reads nothing from the module; it is out of this round.
- **Owner (2026-11-05): the name is Wood replacement,** the roof SOW's own words (`CONTEXT.md`). In code: a roof-off scope's `replacesWood`, a kept deck's `woodReplaced`, the material's `woodReplacementCopy`; never `repair*`, which is Upkeep's. The customer copy keeps "repair". The patches draw with the rain's own rot patch and colour; only the replaced wood gets a new colour.
- **Claude's call: the patches show only up close,** on the deck's step. The deck is never visible on the whole house.

### 11.4 Each system's own heat flow (R250)
- **Owner:** Look inside shows the heat moving through the system being looked at. The roof's flow stays as it is; the attic, the windows and the walls (their paint) each get their own.
- **One table for every lane.** They are all counted from the one heat table the whole home's lanes use (`heatLaneFlows`): `roof`, `wall` and `window`, with their bounces. So up close and the whole home always agree, and no figure moves.
- **Attic (Claude's call on the legs):**
  - The flow starts where the roof's ends, with the heat that gets past the deck into the attic.
  - With a radiant barrier, it turns back at the foil under the rafters.
  - The rest crosses the attic air to the insulation's step, then the ceiling, into the room, thinning as it crosses each one.
  - A running fan sends its share out of the gable vent.
  - Winter runs the other way: from the room up through the ceiling and the insulation into the attic.
  - The attic shows no lanes through the covering's steps; those are the roof's.
- **Where the attic's flow sits (stress test, 2026-11-05).** The house the attic holds open lifts away the attic floor's front span (z ≥ `HOUSE.atticFrontZ`), where today's cutaway line drops. The attic's lanes, leak lanes, readings and Look inside camera therefore sit on the span the open house keeps. The attic's lanes are a branch of the roof's (`cutawayHeatLanes`), and the heat reaching the foil is the roof's own `pastCovering`.
- **Attic air gaps (Claude's call):** with no air sealing in the picture, a thin lane of attic air comes down through the ceiling openings' gaps. It is the attic's story for the ceiling (R136), drawn with no figure of its own; with air sealing, it is gone. *For the owner to check.*
- **Windows:**
  - In summer the sun crosses the panes into the room.
  - On the build's window, the Low-E coating turns back the window's bounce share at its own step, and the argon gap thins the rest.
  - Single-pane glass lets it straight through.
  - Winter runs from the room out.
- **Walls:**
  - In summer the sun lands on the paint, and Cool Life paint turns back the wall's bounce share there.
  - The rest crosses the coats, the sheathing, the cavity insulation and the drywall into the room.
  - Winter runs out.
- **The readings stay where the whole home has them:** the wall's and the window's reading anchors, the attic air and the ceiling.
- **The window's and the wall's lanes reuse the whole home's face legs** (one helper, `faceLegs`), so up close and the whole home draw a face's heat one way.

### 11.5 The window's parts (R251, changes R123)
- **The list.** The **Double-pane glass** row goes from the card and the pins; the outer and inner panes already say it. The glazing stays a lit system part, so every other window stays solid up close (stress test, 2026-11-05).
  - **Claude's call:** the same rule for every glazing that opens into pieces: the list names the pieces, not the whole part. Single-pane glass's one piece is labelled "Single-pane glass", so its list still says what the window has.
- **The screen.** It comes with every new window, so it is drawn on the build's window only: a fine mesh outside the outer pane, its own step, and a row on the list.
  - **Claude's call:** it is a system part drawn with the new window's glass, the outermost step of its run (amended with the plan: the installed glazing is what marks a new window, and riding its steps puts the screen outermost). It is not a construction part, so no savings move (§7).
  - The home's own windows draw no screen.
- **The Low-E coating's text:** *"The coating that gives the gas-filled glass its darker, more opaque look: harder to see inside, so more privacy."*
  - Pieces carry no text today (`systemPartRows`: "with no detail of its own"). The coating and the screen gain a line each.
  - **Claude's call:** the screen's line reads *"Comes with every new window."*
- **Darker glass.** The build's new windows draw darker, nearly black, without the blue tint.
  - Today they use `HOME_PALETTE.glass` `#a8c3cc`.
  - This applies on the whole house and up close.
  - The home's own glass keeps today's look, so the difference shows, whatever its wear: only the build's installed double-pane is new glass.
  - The colour is set by screenshot in both themes, with the lit-room glow at night still reading.

### 11.6 The attic has no peel (R252; amended by §11.9: no slider, but its steps stand fully open)
- **Owner:** "Attic shouldn't have a 'peel it' as there are no layers really."
- Its card has no peel slider. Its Look inside shows the radiant barrier, the fan, the air sealing, the insulation and the ceiling's story where they sit, lit while the rest fades, as heating & cooling's equipment does.
- **Claude's call: the attic's steps go.** That includes the 1.2-deep step that gave the air-sealing strip room (ledger ruling AK). The attic's heat lanes (§11.4) cross its parts where they sit.
- The roof, the windows, the walls and the duct keep their peel.

### 11.7 Copy ruled with round 2
- **The radiant barrier** (`roof-attic.ts:45`): *"Foil stapled to the rafters from inside the attic. It turns back most of the heat the roof radiates."* It is never "under the deck".
- **The roof's pin** stays **"Roof & gutters system"**.

### 11.8 Not in round 2
- Foundation and the crawl space (T7, R102).
- A wall insulation upgrade (none is sold).
- Screens on the home's own windows.
- The 15% in the copy.

### 11.9 Amended after the owner's look at the build (2026-11-06)
- **The attic (owner):** "the attic Look inside should still show the peel-off view without needing to slide the peel; the air sealing showed the foam round the can light and duct boot." Its Look inside stands fully stepped open, as round 1 at full peel: the blanket cut back furthest, the air sealing's strip bare round a can light and the duct boot, the ceiling whole. Its card has no slider. Its heat lanes cross each floor part on its strip; everything else in §11.1 and §11.4 stays.
  - **Claude's call:** one list beside `STEP_DEPTHS` names the systems that stand fully open (the attic), and every reader of the peel takes 1 for them.
- **Walls (owner):** "Walls should not have a peel; it was my bad call." Asked, the owner kept the Walls Look inside without the patch: the house fades, the walls stay lit, the camera goes to the side yard, and the heat lanes cross the whole wall (outer face to inner face, the paint's bounce off the outer face). No cut-open patch, no slider, no pins for the wall's parts; the card still lists them.
  - **Claude's call:** the lanes and the camera keep the patch's old place on the left wall (along 1.85), where the camera is tuned.
- **The attic, the owner's second look:** the blanket's step stands only a little past the cut (one joist bay, 0.8 m), in view rather than under the roof that stays. The can light, a duct boot and the sink's vent pipe sit in that bay and show lit with their foam (or bare, with the gaps story). A pick on the attic fan faces the fan from inside the attic.
  - **Claude's call:** the ceiling openings and run 3's last point moved into the bay past the cut (working positions).
- **The deck (owner):** "rot should not be symbolized with weird circles but gradients/textures… wood replacement rectangular, we often cut out rectangles from the deck." The old deck's rot, and the rain's soak, draw as soft water stains (the paint stains' way, simpler); the build's wood replacement draws the same areas as crisp cut-in sheets of fresh wood with a faint seam.
  - **Claude's call:** the sheets hide under the Thermal lens, as every mark does.

## 12. Round 3: inside out, and the window comes apart (owner, 2026-11-06)

Grilled with the owner after the round 2 amendment. It builds on that amendment (`b9a17c0d5`, same branch). Where it differs, it supersedes §3.3's Steps, §11.2, §11.5's order and §11.9's Walls entry. Heating & cooling stays as it is.

### 12.1 Every list reads inside out
- **Owner:** "think from the inside of the house to the outside." Each system's card list and its pin numbers start at the innermost part and end at the outermost.
- **Only the order of the story changes, not the motion** (owner). The stepped cutaway still cuts the outermost part back furthest, so the inner ones show. No slider builds the system up.
- **Trap:** today one list (`SYSTEM_PARTS`' order, read by `stepOrder`/`stepStarts`/`stepCutBack`) sets both the card's order and which part is cut back furthest. Flipping the list must not flip the cut: the steps keep cutting outside-in.

### 12.2 The orders (owner)
- **Roof:**
  1. Ceiling, only while rain gets in, with its leak stain. The owner keeps it.
  2. Rafters.
  3. Deck.
  4. Drip edge.
  5. Eave membrane.
  6. Underlayment.
  7. Covering (shingles, cool shingles, tile or membrane).
  8. Ridge vent.
  9. Gutter.
  - A flat roof keeps the same order without the parts it doesn't have.
- **Attic:**
  1. Ceiling.
  2. Air sealing (build only).
  3. Ceiling joists.
  4. Attic insulation.
  5. Radiant barrier.
  6. Attic fan.
- **Windows:**
  1. Flashing.
  2. Frame.
  3. Seals.
  4. Inner pane.
  5. Argon, or the old double pane's air gap.
  6. Low-E coating.
  7. Outer pane.
  8. Screen.
  - An old single-pane window: flashing, frame, seals, pane.
  - An old double-pane window: flashing, frame, seals, inner pane, air gap, outer pane.
- **Walls:** the wall (stucco), eaves & trim, paint. See §12.5.
- **Heating & cooling:** unchanged.

### 12.3 The window separates instead of peeling (owner)
- **Owner:** "the layers shouldn't peel apart (makes no sense); it should separate the layers so we can focus on each layer." Only the window separates. The roof keeps its stepped peel, and the attic stays fully stepped open (§11.9).
- **The slider spreads the parts apart:**
  - At 0 the window is whole.
  - As it moves, the parts slide apart along the wall's outward normal, toward the camera in the side yard.
  - The flashing stays against the wall. Each part after it, in the §12.2 order, moves one step further out, and the screen ends furthest out.
  - None are cut back.
- **A pick** lights the part and fades the rest, as the stepped systems' picks do. Each part's pin rides with it.
- **The flashing fix (owner's bug):**
  - The flashing is drawn as a band on the stucco's face (`window-seals.tsx`), so on the new window it shows over the vinyl frame.
  - It goes behind the frame, where the frame's flange laps it. Whole, the frame hides it; spread, it shows as its own part.
- **Copy (owner):** the window's slider reads **"Pull it apart"**, with a **"Put it back together"** button. The roof keeps "Peel it apart" / "Close it up".
- **Claude's call:**
  - the window's heat lanes cross each part where it stands, so spread apart they pass through the gaps, and the Low-E's bounce leaves from its own part;
  - the spread distance per step is a working number set by screenshot.

### 12.4 The attic's ceiling joists and the dust (owner)
- **Ceiling joists become their own part:**
  - They're a piece drawn on the `ceiling` construction part, like the panes on the glazing, so no savings move.
  - The attic already draws them (`attic-floor.tsx`, `atticJoistBoxes`), tagged as the ceiling. They get their own row, pin and pick.
  - On a flat roof the joists stay the roof's rafters, as now.
- **The existing home's ceiling tells the air-leak story:** air pours through the gaps round the can light, the duct boot and the vent pipe, and there's dust where it leaks.
  - **Claude's call:** the dust is drawn as dirty patches on the insulation right over each gap, the tell an installer looks for. It shows only while air sealing is absent. It's a working look, set by screenshot.

### 12.5 The walls: three parts, picked one at a time (owner)
- **Owner:** "drop anything stucco related (too much information)."
  - The card lists three rows: **Stucco** (Siding once siding is drawn, later), **Eaves & trim**, and **Paint**.
  - The model's other wall parts (drywall, studs, cavity insulation, sheathing, weather barrier, lath, scratch and brown coats) leave the list and are never drawn as their own parts. They still count in the savings, unchanged.
- **The look (owner):**
  - the whole wall, no slider and no cut-open patch, as §11.9;
  - the camera and heat lanes as now;
  - each row can now be picked, since each has something of its own to light. This reverses round 2's plain rows, `drawsItsParts`.
  - A pick lights its part and fades the other two:

| Row | Existing home | Build (any new paint) |
|---|---|---|
| Stucco | the bare wall, its paint faded off, with its cracks, discoloration and peeling | the cracks patched |
| Eaves & trim | every trim piece (`CONTEXT.md` Body / trim): the fascia and rakes, a flat roof's coping, the door frame and the garage's trim and fascia, peeling; wood rot at fascia board ends where the home has it (§12.6) | repainted; the paint stops at the rot unless the build replaces the rotted boards or all of them (§12.6.2) |
| Paint | the faded coat | the new coat: water-based paint or the Cool Life coating |

- **What the Eaves & trim pick lights** (owner, 2026-11-06, asked in the plan's stress test):
  - the garage's trim and fascia, and a flat roof's coping, light with the rest of the trim;
  - the door frame lights too, although the front face it sits on fades in Look inside.
- **Every paint job includes crack repair** (owner). Eaves & trim are repainted with it, but replacing fascia boards is not included (§12.6.2).
- **Eaves & trim is a piece, not a construction part:**
  - the model has no trim or fascia part (`scope-not-drawn.ts`), so it's a system part the scene draws, on an existing construction part;
  - its pieces are the fascia (`ROOF_TRIM.fascia`, drawn with the roof today) and the door frame (`doorFramePeeling`), which must answer to the Walls pick.
- **Claude's call:**
  - no pins on the wall's three parts, since they'd crowd one face; the card's rows pick them;
  - Stucco and Paint share one face, so the Stucco pick draws the wall in its bare base coat (`WEAR_LOOKS.paint.peeling.bareStucco`) with the damage marks, and the Paint pick draws the coat's colour.

### 12.6 Fascia rot, set by the rep (owner)
- **Not every home has it** (owner). It's a fourth kind on the paint wear control, beside cracks, stains and peeling (`paintWearKinds`, `ui/components/panel/paint-wear-fields.tsx`), on the same none/light/moderate/heavy levels. It's stored where the other three are.
- **A flat roof has no fascia** (owner, 2026-11-15): "There is no 'fascia' on flat roofs (there is often a cap, like a spanish tile cap)." A flat-roof home shows no fascia rot and offers no fascia replacement.
  - **Claude's call:** on a flat roof the Fascia rot level leaves the paint wear control, and the rot in force reads None (`fasciaRotInForce`), so a replacement pick goes with it as it does at None.
  - The front fascia the scene draws behind a flat roof's parapet today (`FRONT_FASCIA`, `FASCIA_RUNS['low-slope']`) is logged in the tracker (R326) to revisit, not changed by this work beyond leaving the rot runs.
- **It defaults to none at every overall wear level**, never read from the wear (`PAINT_WEAR_START`). It shows only when the rep has seen it.
- **Which ends rot:** light is one board end; moderate, two or three; heavy, about three quarters of the ends (`fasciaRotSpots`, seed `FASCIA_ROT.seed`). The ends are shuffled as one set over the whole home, so each level keeps a lighter level's ends and adds more.
- **The garage's fascia rots and is replaced too** (owner, 2026-11-06, asked in the plan's stress test). Its board ends join the house's in one set.
- **Constraint:**
  - no savings move (checked against the savings baseline);
  - the rot and the new boards are drawing and copy only. They add no construction part, and nothing new shows on the proposal's Scope chapter beyond the scope lines the rep picks.

#### 12.6.1 The look (owner, 2026-11-13 grilling, stress-tested 2026-11-15; replaces the 2026-11-06 "soft darkening" look)
- **Owner, 2026-11-07:** "you created circles and discoloration, i'm looking for actual wood damage and rotten wood texture." The see-through stain (`CutawayRotStains` with `createRotStainTexture`) goes from the fascia. The deck's rot stains keep it.
- **The damage changes the board's shape** (owner). Wood is really missing at the end, and the dark gap behind it shows. The face around the missing wood is rotted wood: checked and split along the grain, dark wet wood with lighter punky fibres, and cracks across it. A texture on an intact board (the round 3 look) and a whole chunk gone with clean edges were both turned down.
- **Each level** (owner):

| Level | What the rotted end shows |
|---|---|
| Light | **One corner nibbled.** One board loses about 5 cm of its bottom corner, tapering to nothing about 8 cm up. Early rot and checking around it, a narrow band of loose paint, and the top of the board sound. |
| Moderate | **Corners chewed** (option B). The bottom corner is eaten back about 8–9 cm, tapering to nothing about 12 cm up the 20 cm board. Rotted wood about 5 cm into the face beside it, paint gone about 11 cm in, and a little of the bottom edge eaten near the end. |
| Heavy | **A mix across the home** of three kinds of end: the **open joint** (option C: a gap about 1 cm wide running the full height, widening to about 6 cm at the bottom, ragged), the chewed corner (B), and the **two-sided joint** (C on one board, B on the other). Each rotted board's **bottom edge is eaten back in patches along its whole length**, up to about 3 cm, deepest near its rotted end. |

- **The figures are metres on the board, never stretched** (Claude's call, stress test 2026-11-15). The house's eave boards are 20 cm tall and the garage's 18 cm (`garage-boxes.ts`), so the same centimetres reach a little higher up a garage board.
- **One board or both at an end** (owner, Q9; made exact in the stress test):
  - At Light and Moderate the rot sits on **one** board, and its neighbour's end is sound.
  - At Heavy an end's kind decides: the chewed corner takes one board, and the open joint and the two-sided joint take **both**.
  - **A run's own end** (where an eave meets a rake, and the garage eave's two ends) has only one board, so it always takes the chewed corner (Claude's call). 6 of a pitched home's 13 ends are run ends.
  - Only a board that carries rot has its bottom edge eaten.
  - Each end's board and kind come from the seed **before** the level picks which ends rot, so raising the level never changes an end that already rotted.
- **A little variation** (owner): each end has its own ragged edge and crack pattern, and sizes and proportions stay close to the level's figures. Fixed per end by seed.
- **True size at every camera** (owner): nothing is enlarged to read from the whole-home view.
- **The Eaves & trim close-up keeps today's framing** (owner, 2026-11-15, "leave it"). It leans to the front eave's left end, and the rep turns the camera to the rot. At Light the one rotted end can sit at the far end of the eave (today's seed puts it about 10 m away).
- **Paint** (owner):
  - On the existing home, the paint has gone round the rot: rot, then bare weathered wood, then the paint's broken edge.
  - **After a paint job without new boards, the paint stops at the rot.** New paint covers the sound wood, the loose paint is gone, and the rotted wood and missing wood stay raw, on every trim colour. That's the rep's cue to offer the boards.
  - **The fascia's peeling steps aside where the rot draws** (owner, Q15): on a rotted end, and along a Heavy board's eaten bottom edge. It stays on the sound wood elsewhere. A replaced board shows no peeling, and no flake pokes through it. (`fasciaPeeling` doesn't know the rot today: its patches are filtered by the rot's spans, as the drawer already filters them by the new boards.)
  - The drawers learn whether the build repaints, so the paint can stop at the rot (Claude's call; today they get no such input).
- **How it's drawn** (owner, Q16 and Q17; the method made exact in the stress test, Claude's calls):
  - **Made in code, from each end's seed**, as the scene's lawn and stains are: a cut-out where the wood is missing, and a bump map from the same height field so the checks and crumble catch the scene's light. No image files, licences or new dependencies.
  - **The board itself loses the wood.** Today a run's fascia is one solid box, and a cut-out laid over it would only show the sound board through the hole. So each drawer draws the board as merged pieces that stop at every rotted end and above a Heavy board's eaten bottom edge (`mergeBoxes`), and the rot mesh fills those gaps: rotted wood where the cut-out keeps it, the dark gap behind where it doesn't.
  - **The height field is a pure function** of the end's seed and kind, so the checks can read each level's cut-out sizes. The pixels are drawn from it in `ui/lib`.
  - **The paint's broken edge takes the trim colour without rebuilding a texture.** The rot's texture holds the wood tones and where the paint still holds, and the trim colour comes in at draw time, so a colour pick never redraws it.
  - **Two textures, shared by the whole home:** a colour map, and the cut-out with the bump packed in one linear map. Each is an atlas of seeded variants, and each end takes a cell by its seed (as `create-stain-atlas.ts` does).
  - **One draw per drawer**, as today: every rotted end in a drawer is one mesh. At most about 2,000 extra triangles at Heavy (about 700 by count). Real carved geometry, at about 6,000, is ruled out.
  - **Against a fresh baseline** taken before the build. The round 3 file (`.superpowers/sdd/2026-11-06-up-close-round-3/shots/out/baseline-perf-1194x834-dark.json`) reads 160 draws / 75,418 triangles from before round 3, and gutters, covering wear and HVAC have landed since.
  - **Under the Thermal lens and in the blueprint the board reads whole and plain.** The rot mesh stays, loses its cut-out and colour, and paints as the fascia, since hiding it would leave holes in the board. While a view fades, the fade's depth stand-in keeps the cut-out (`fade-sheets.ts`), so missing wood never flashes solid.
- **Colours** (Claude's call, for the owner to check): existing tokens first.
  - rotted wood `WEAR_LOOKS.fascia.rot` (`#3a2c20`, kept, its "soft darkening" comment goes);
  - bare weathered wood `WEAR_LOOKS.paint.peeling.bareWood` and the loose paint's edge `…peeling.flake`, shared with the peeling;
  - the lighter punky fibres from `HOME_PALETTE.lumber`, mixed toward bare wood;
  - the dark gap behind missing wood `HOME_PALETTE.ventBacking`;
  - any new tone goes in `WEAR_LOOKS.fascia`, never as a literal in a drawer.
- **Working numbers:** the figures above come from the mock-ups on the grilling page (claude.ai artifact `4Mw1TgJJfwFx9rVmtM4NW9`) and are set again by screenshot in the scene.
- **Unchanged:** the rot's colour detail hides under the Thermal lens and stays out of the blueprint (the board reads whole there, above). The Eaves & trim pick lights it.
- **Gutters** (owner, Q18): a gutter covers the house board from about 6 cm to 17 cm above its bottom edge, so about 6 cm shows below it and 3 cm above (Claude's sums from the constants, not a render; a Worn or Failing gutter sags lower). Light's nibble shows below it, and Moderate's taper is about half hidden. The garage has no gutter. The gutters themselves don't change, and the rot stays where the seed puts it. The build checks with one Eaves & trim shot, with gutters on, that the pick fades the gutter.
- **The overflow stain** (Claude's call): a Failing gutter's stain on the fascia stays its own mark. Today any new fascia clears it from the whole fascia (`overflow-stains.ts`). Rotted boards clears it only on the new boards, and All boards clears it all, as a repaint does.
- **Checks** (Claude's call, for the plan):
  - **Pure checks in `verify-trade-scene.ts`:** each level's cut-out sizes, each end's board and kind and their stability across levels, run ends taking the chewed corner, no peeling over rot or new boards, new boards joint to joint with a seam at every joint, the triangle count, and one mesh per drawer.
  - **Shots, one view at a time on the CPU, never a sweep:** pitched Light, Moderate and Heavy on the existing home; Heavy after a repaint without boards; Rotted boards; All boards; and Eaves & trim with gutters on.

#### 12.6.2 Replacing the fascia (owner, 2026-11-13 grilling, stress-tested 2026-11-15; replaces the 1.2 m new lengths)
- **Fascia is replaced a whole board at a time, never repaired** (owner): "we can either replace the rotten board, or opt for full replacement of entire fascia boards. Most frequently it'll be replacing individual boards."
- **Two picks, one or the other** (owner, Q8, Q10):
  - **Rotted boards:** every board that shows rot is replaced, joint to joint (`FASCIA_ROT.boardLength`), at every level. That's one board per rotted end whose kind takes one board, and both boards at an open or two-sided joint. `FASCIA_ROT.newLength` goes.
  - **All boards** (owner, Q13): every board on the roof's edge is new, whether or not it rotted: the house's front and back eave fascia, both rakes, and both of the garage's eaves (the garage draws no rakes).
    - That's its own set of boards, apart from the eaves the rot runs on (`FASCIA_RUNS` holds only the two house eaves and the garage's street eave).
    - Rakes take a seam every board length, like the eaves (Claude's call; today a rake is one plain slab with no joints).
  - Both are offered only while fascia rot is above None, and both go with it (`keepFasciaReplacement`). The rep picks one, or neither. A flat roof has neither (§12.6).
- **New boards are crisp and square, with a seam at every joint** (`HOME_PALETTE.woodSeam`), between two new boards as well as between a new board and an old one, and covering the board's full profile, so no missing wood shows through. The drip edge's lip laps a new board as it does today (`afeb0ae11`), and over an open joint it spans the gap.
- **Their colour** (owner, Q14, keeping today's rule, for both picks): the build's trim colour when the build repaints, primer white (`HOME_PALETTE.primer`) otherwise. The scope primes the new boards and does not paint them.
- **On the Walls card's Build row** (owner, Q11, for now): one menu chip beside Repaint, built like New roof's, in place of today's on/off switch.
  - **One slot** (`replace:fascia`) with the choices No change, Rotted boards and All boards (Claude's call). Today's slot has no choices while the rot is None, and a menu chip on it then would break, so the chip stays hidden on the card then, as today.
  - **Modify** lists both choices with the reason they can't be taken while the rot is None. Its search words gain "all", "full", "new" and "boards" (`scene-change-words.ts`), so "all boards" finds the pick.
- **When it's built** (owner, 2026-11-15): **after the layout lab (`feat/scene-layout-lab`) merges.** The lab moved today's switch out of `system-card-body.tsx` into a shared `BuildSwitch`, which the spot chip's quick edit uses too. So the menu is built there, and the spot chip offers it as well. The lab also rewrites the garage and flat-roof drawers, and this branch's HVAC plan (Tasks 10–13) touches the scope files, `home-kit.tsx` and the camera views, so both land first.
- **The scopes** (owner, Q12):
  - Rotted boards is the existing **Fascia board replacement** scope (`FASCIA_REPLACEMENT_SCOPE_ID`).
  - All boards is a **new scope the owner adds in Notion** (name and description from Claude). Its id joins the first one outside `SCOPE_INSTALLS`, both held in one record in the construction core, and `scripts/verify-scope-installs.ts` and the change that writes the pick (`apply-scene-change.ts`) go over both. All boards can't be built until that scope exists.
- **The data** (Claude's call, for the owner to check):
  - `fasciaRotSpots` keeps which ends rot, the seed and the counts. An end gains which board carries it (or both) and its kind. The replacement code reads boards from that.
  - The resolved scene's `fasciaReplaced` becomes which pick the build holds: rotted boards, all boards, or none (`null`), as `existingGutterWear` carries the gutter. Its readers change with it: `eaves-trim-detail.ts`, `fascia-boards-color.ts`, `look-inside-body.tsx`, the three drawers and the overflow stain.
  - The new look figures go in `FASCIA_ROT`, one entry per level, and the end kinds in a constant list.
- **Copy to check in the copy pass:** "Fascia" alone reads bare beside "New roof" and "Repaint", and "Rotted fascia boards" can read as the damage, not the fix. The chip's picked words are a lookup per choice, not one template.
- **Copy (working copy, owner 2026-11-13; refined in the copy pass):**

| Where | Words |
|---|---|
| Build chip, nothing picked | Fascia |
| Menu choices | Rotted boards · All boards |
| Chip once picked | Rotted fascia boards · All new fascia |
| Hint while there's no rot | Set fascia rot to offer this. |
| Eaves & trim line, rot | Rotted fascia ends. Water gets behind the paint and softens the wood. |
| Eaves & trim line, rotted boards | Rotted fascia boards replaced, a whole board at a time. |
| Eaves & trim line, all boards | Every fascia and rake board replaced with new boards. |

### 12.7 The roof's felt and the deck's wood replacement (owner)
- **The old felt looks brittle and crumbling**, so it's clear why leaks happen. Roofers and inspectors describe failing felt as dried out and brittle from attic heat, cracking, and crumbling or tearing when handled, no longer shedding water.
  - On a home with felt underlayment it draws:
    - faded grey-brown in place of fresh black (`HOME_PALETTE.felt`);
    - fine cracks across it;
    - torn, ragged edges at the laps;
    - a few holes where pieces have crumbled away, showing bare deck.
  - In Rain, the water passes through one of those holes to the deck.
  - The build's synthetic underlayment stays clean and smooth.
  - The look is set by screenshot.
- **The replaced sheets and the rot stains belong to the deck:**
  - Today they're drawn with the flows (`cutaway-flows.tsx`), so picking Rafters fades the deck and leaves them solid.
  - They light, fade and hide with the deck's own part instead.
- **Fewer, larger, staggered sheets** (owner): "a real wood replacement would have larger repair squares, and slightly fewer"; "they shouldn't all have the same dimensions and relative widths/heights/starting points."
  - 3 sheets, each square-cut, about a metre up the slope.
  - Each differs in width across the strip, in height and in where it starts: one may span only part of the strip, one may run on under the next step.
  - The existing home's rot stains sit in the same three places.
  - Working numbers, set by screenshot.

### 12.8 Not in round 3
- Heating & cooling's order.
- Drawing siding.
- A build-up slider.
- Separating the roof or the attic.
- Pricing the fascia boards.
- **Glossary proposals for the owner, not applied:**
  - "Look inside": the window separates, the wall picks its three parts;
  - "Fascia rot";
  - "Fascia board replacement" (the rotted boards, a whole board each) and "Full fascia replacement" (every board on the roof's edge), with "fascia repair" as the word to avoid: Tri Pros never repairs fascia (2026-11-13);
  - a fix to the Paint wear entry: fascia rot starts at none at every wear level, never from the paint's wear (`PAINT_WEAR_START`), and a flat roof has none (it has no fascia, 2026-11-15).
  - "Open joint", "chewed corner" and "two-sided joint" stay code names for the drawn kinds, not glossary words.

### 12.9 Settled after the builder check (Claude's calls, for the owner to check)
- **How the fascia replacement is signalled** (round 3's single switch; §12.6.2 makes it a choice of two scopes):
  - **No new construction part.** A part would reach the proposal's Scope chapter and the Upgrades lists.
  - The Fascia board replacement scope id is named once in the construction core, outside `SCOPE_INSTALLS` (which drives the Upgrades rows and the savings), and the resolved scene says whether the build replaces the fascia, as it carries `existingGutterWear` (`woodReplaced` is worked out per part from `SCOPE_INSTALLS`, the other way round).
  - It leaves `NOT_DRAWN`; the scope check counts it as accounted for.
  - The replacement pick goes whenever the fascia rot in force reads None. That happens when the rep sets it back to None, sends the paint back to its era guess (which clears the recorded levels), or rates the paint New.
  - A paint option change keeps the recorded levels, and so keeps the pick.
  - Removing the build's paint pick keeps it too, and the new boards then show primed white.
- **Storing fascia rot:**
  - `paintWear` is already a partial record, so a home saved before round 3 has no rot key and reads it as none.
  - If any stored-shape validator lists the kinds, the new kind joins it there. Built: `paintWearKinds` already lists `fascia-rot` (`core/constants/enums.ts`).
- **The fascia is shared by two systems:**
  - Roof Look inside treats it exactly as it does now.
  - Walls Look inside lights it as part of Eaves & trim.
- **The cut order and the list order:**
  - One list stays the source.
  - The stepped cut reads it reversed, over the parts that step, so the outermost is still cut back furthest.
  - A conditional part, like the roof's ceiling, is still simply absent from both orders.
- **Pins and picks are keyed by part id, never by position.** The plan confirms this. The pin numbers and the checks that assert order follow the new lists.
- **The window's camera:**
  - It stays put while the slider moves.
  - Its framing is set so the full spread fits.
  - A window with fewer parts spreads less.
- **The ceiling openings** (can light, duct boot, vent pipe) already exist from the round 2 amendment. The dust patches sit over them.

### 12.10 Settled while planning (Claude's calls, for the owner to check)
- **The ceiling joists keep their place:** they don't step. They're drawn whole over the bare strip, as today, so the blanket's step stays one bay past the cut (§11.9). In the Roof's Look inside they take the ghost with the rest of the attic; only the ceiling is lit for the leak.
- **The dust** sits on the blanket over each opening it covers, cut back with the blanket's step, so the openings in the bare strip show their gaps and the ones under the blanket show their dirt. It belongs to the Ceiling row, which tells the air-leak story.
- **The deck's stains and new sheets move into the house** (today they're drawn with the flows, which the ghost never touches), so a Rafters pick fades them with the deck. The rain's soak stains move with them, each with its own part.
- **The window's slider button** still reads "Open it up" at rest, since only the label and the close button were renamed. The parts move as whole pieces; nothing is rebuilt as the slider moves.
- **Eaves & trim sits on the paint part**, so it reads New with a paint job. An unpainted home lists only its Stucco.
- **The wall's finish row** is a piece named "Stucco" (or "Siding") on the finish part, so the model's "Finish coat" label stays where it is.

**Added after the plan's stress test (Claude's calls):**
- **The wall's other parts keep their entries in the parts list, unlisted** (as the window's whole glass is). The card never shows them, every construction part still has one entry, and the wall's heat lanes still see its insulation and studs.
- **The garage joins the fade only while the walls are up close.** That's how its trim can light and its door dim. In every other view it stays solid, as today.
- **The door frame lights over the faded front** through a mark on its own tag. Every other piece only the Complete house draws still fades.
- **A home whose paint is rated New shows no fascia rot.** The paint wear control already hides there.
- **The window's camera leans to a picked part's resting point,** so it stays put while the slider moves.
- **The dust draws only while the attic is up close, or nothing is.** In the Roof's Look inside the ceiling lights for the leak while the blanket fades, and dust on the ceiling's tag would float there.
- **The fascia scope's code names say "replacement"** (`fasciaReplacement`, slot `replace:fascia`), never "repair": Tri Pros replaces fascia a whole board at a time and never repairs it (owner, 2026-11-13). The glossary's Wood replacement entry covers only the roof deck, so the fascia terms are proposed in §12.8. The chip's words are in §12.6.2.
