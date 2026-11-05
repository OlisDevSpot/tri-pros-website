# TS3b.4b: up close on a system

**Status:** design, awaiting the owner's approval. Nothing is built until the owner approves this and says "build" or "execute".
**Tracker:** `docs/plans/2026-10-16-trade-scenes-epic.md`, row TS3b.4b; requirements R60, R92 (changed), R119, R120, R122–R126, R133–R136, R228–R231.
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

**This round:** Roof & gutters, Attic, Windows, Heating & cooling.
**Not this round:** Walls and Foundation. Tapping them shows no pin. The crawl space waits until it's fully modelled (T7, R102).

### 3.1 Roof & gutters
- **Parts:** covering, underlayment, ice & water shield, drip edge, deck, rafters, ridge vent, gutters.
- **Steps:** down the near slope, covering on top and rafters at the bottom.
- **Flat roof:** the torch-down layers on its deck and joists.

### 3.2 Attic (pitched roof only, R111)
- **Parts:** radiant barrier under the deck, the attic fan on its gable end (R106), air sealing (foam collars round each ceiling opening, R110), insulation, and the ceiling (its joists and drywall, one grouped component shared with the roof system, lit here only for the gaps that leak air through it, R136). The gable vents, ceiling openings and hung ducts come from the Attic work (R105–R110), which lands first and builds on the home only.
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
- **New window:** outer pane, Low-E coating, argon gas, inner pane, vinyl frame, seals, flashing. No spacer.
- **Frame copy:** virgin vinyl is sturdier than recycled vinyl.
- **Steps:** through the window's face: outer pane, Low-E coating, argon gap, inner pane, with the frame, seals and flashing around them.
- **Which window:** one the camera can reach from the default framing (builder picks it; see §7).

### 3.4 Heating & cooling (R124, R125)
- **Parts:** the ducts where they really run, the register boots on the ceiling (R108), the air handler and its plenum, plus the condenser and refrigerant lines on a split system or the package unit on a package system.
- **A duct opens into its system parts:** inner core on its wire coil, insulation blanket, silver mylar jacket. The jacket's thickness is what R-6 vs R-8 means. The original ducts show their own thinner, crushed make-up.
- **The package unit fix (a fix to the house, seen from every view):** on a pitched roof it moves to the far slope beside the plenum and connects down into the plenum and ducts. It stays solid on its curb in every view. The far slope never opens in Partly open (only the near slope's end does, `gable-roof.tsx`, `HOME_FADE_TAGS.complete`), so Partly open itself doesn't change.

## 4. Goals

- One system view, for every system, on the home's own model (R119).
- The card's system page carries that system's Home and Upgrades rows (R119).
- Every view draws the home's own state: the shingle colour and the five condition steps up close, as on the house (R120).
- The roof & attic slice (the assembly kit) retires. What it draws well moves onto the home's parts: each covering per material, rain over the layers, leaks at worn spots, heat lanes through the layers with their readings, and thermal paint.
- Insulation offers and bill cuts follow R122 and R126, in the shared construction rules, so the scene and the proposal agree (R101).
- Window and duct system parts as above; the package unit fix.

## 5. Non-goals

- Walls and Foundation up close; the crawl space system (T7, R102).
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

Recorded in `CONTEXT.md`:
- **System part** (R135, R136): everything up close shows, whether a whole construction part, a piece of one, or a shared system part.
- **Look inside** (R228): the system card's step from a system in focus to up close.

Proposed, to record once the owner agrees:
- **Stepped cutaway:** how a layered system opens up close, each system part cut back further than the one above.

Superseded 2026-11-03: "System view" (now Look inside on the System in focus) and "System page" (now the System card).
