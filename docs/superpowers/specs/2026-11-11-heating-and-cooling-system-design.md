# Heating & cooling, the whole system

> Status: drafted 2026-11-11 from the owner's brainstorm; builder check done; owner questions answered 2026-11-13; approved by the owner 2026-11-13; plan
> `docs/superpowers/plans/2026-11-13-heating-and-cooling-system.md`, stress-tested 2026-11-13 (owner rulings R323, R324).
> Tracker: `docs/plans/2026-10-16-trade-scenes-epic.md`, §2 row "Heating & cooling", R297–R310, R312–R315, R318, R319, R323 and R324.
> Branch: `feat/trade-scenes-foundation` (worktree `.worktrees/trade-scenes`).

## 1. Intent

Heating & cooling is the system the scene has paid least attention to. Today it is one box in the attic standing for the
"furnace and coil", a condenser on its pad, ducts, and a package unit for flat-roof homes; the camera goes to the condenser,
the roof spot never offers it, and half the catalog's HVAC scopes are marked not drawn (mini-splits, furnace replacement,
A/C replacement, a first-time install).

In the meeting the rep walks the homeowner through a central system the way an installer builds one: the indoor unit first
(blower, furnace, then the coil, which works with the condenser outside to cool the air), then the plenum, the ducts, the
registers and the thermostat. The scene should carry that walk, on the homeowner's own system, and show honestly what each
HVAC build changes: a furnace-only home gaining A/C sees a new coil go into its indoor unit as well as a condenser outside;
a home with a wall furnace sees a whole central system arrive while the old wall furnace stays on its wall, idle; any home
can add mini-splits; any central build can be a heat pump.

## 2. Owner rulings this design rests on (2026-11-10/11)

| Tracker | Ruling |
|---|---|
| R297 | **Heating & cooling opens on the indoor unit, not the condenser.** In the attic for an attic unit (the house opens, as the attic does), in its HVAC closet for a closet unit. A package unit keeps its roof view. |
| R298 | **The indoor unit lies flat in the attic or stands upright in a closet or the garage.** Attic first whenever the attic is there and reachable enough; otherwise a closet; otherwise the garage. A flat-roof home has no attic unit: it has a package unit on the roof or an upright unit inside. |
| R299 | **The garage location waits for the garage plan (TS3b.6-B), but this work is not blocked by it.** The location is built so the garage plan adds its own spot and nothing else. The garage plan carries a note that the upright garage unit is part of its move. |
| R300 | **A replacement keeps the indoor unit where it is; the rep can move it**, almost always into the attic. Keeping it in place is the common case. |
| R301 | **The indoor unit shows its components**: furnace only = blower + furnace; furnace with A/C = blower + furnace + evaporator coil; then the plenum and the ducts. Look inside marks each one. |
| R302 | **Adding A/C to a furnace-only home adds a component inside**: the coil appears in the indoor unit as new, with the condenser and line set outside. |
| R303 | **Each component works in its season.** Summer: blower + coil (and the condenser and line set outside). Winter: blower + furnace. Normal: nothing runs. A heat pump runs blower + coil and its outdoor unit in both seasons. |
| R304 | **Look inside follows the sales walk, one tap at a time**: indoor unit (blower, furnace, coil, the coil lighting the condenser and line set as its partner), plenum, ducts, registers, thermostat. |
| R305 | **Hung ducts carry their reasoning**: new runs hang from the rafters on straps, clear of the insulation, for better airflow and supported as code asks. |
| R306 | **Which conversions exist.** A package unit is only ever replaced by a package unit; nothing converts to or from one. Mini-splits can be added to any home. A central system can be replaced whole, have only its condenser and coil or only its furnace replaced, or gain A/C. A wall, window or portable home can get a central system from scratch. |
| R307 | **A heat pump can replace the gas furnace on any central build**: a full replacement, a furnace-only home, and a from-scratch install. |
| R308 | **Today's home has one main system.** Central (furnace only, or furnace + A/C), package unit, wall (a heat-and-cool wall unit on an exterior wall, or a heat-only wall furnace on an interior wall in older homes), window or portable units, or (rarely) mini-splits. A leftover wall furnace beside a real system is not shown. |
| R309 | **An old wall unit stays drawn after a central install, idle.** Removing it is interior remodeling outside heating & cooling, so to stay honest the scene keeps it on its wall, never running. |
| R310 | **Mini-splits: the rep sets the number of heads; one outdoor unit serves them all.** Heads sit on exterior walls. |
| R312 | **A heat pump is sold on what it is, not on savings**: one outdoor unit heats and cools, there is no flame in the house, and the home qualifies for SCE's rate plan for heat pump homes (TOU-D-PRIME). |
| R313 | **A bill is never shown going up.** Where the honest change is a rise (cooling a home never had; a heat pump's heating moving from gas to electric), the scene shows no saving for it, not a negative one. |
| R314 | **The old central system is taken as about 8 SEER**, what the team finds in the homes it visits. Every system Tri Pros installs is at least 14.3 SEER2 (mini-splits 18+), so an HVAC replacement is always an efficiency gain, never like for like. |
| R318 | **Gas stays as it is**: a new furnace cuts 20% of the gas bill, new ducts add 5% compounded. Kept simple on purpose; the gas research is parked for a later pass. |
| R319 | **The heat pump is its own Notion scope, two entries mirroring the split system pair**: "Heat pump replacement" (a home with central) and "Heat pump new-cut installation" (a first central system), not an upgrade switch, so the trades & scopes data stays one source. It draws blower + coil (no furnace) and a heat pump outdoor unit, and is picked instead of split replacement or new-cut. | owner, 2026-11-11 | spec drafted |
| R323 | **New ducts save only on a bill the home already pays that side on**: the ducts' 5% lands on gas where the home heats today and on electric where it cools today. A furnace-only home getting a split system plus ducts shows electric 0%, gas 24% (owner, 2026-11-13). |
| R324 | **"Added" is one rule for every system**: a part the build adds where the home had none reads "Added" on every system's part list, not only heating & cooling's (owner, 2026-11-13). |
| R315 | **The bill math stays simple and the duct math stays as it is**: a new system cuts 25% of the electric bill, and new ducts (replaced and hung) add today's 5% on top, compounded (about 29% together). The gas figure waits on research. |

## 3. Goals, non-goals, anti-goals

**Goals**
- The homeowner sees their own indoor unit, where it really is, and every component in it.
- Every HVAC scope in the catalog draws what it installs (section 6), including the five marked not drawn today.
- The rep can walk the system in the sales order, one tap at a time.
- Components run in their season and the thermal lens shows which ones carry the load.

**Non-goals (this round)**
- The garage location before 6-B lands (R299); boilers, ventilation (HRV/ERV), ground-source and dual-fuel systems; removing
  an old wall unit; mini-split heads on interior walls or ceiling cassettes; more than one mini-split outdoor unit.
- New heat figures: the hand-tuned table (`constants/home-heat-figures.ts`) is not re-tuned for mini-splits or heat pumps.
- Pricing. The heat pump's Notion entry is the one new scope (R319).

**Anti-goals (a failure even if it works)**
- A build that shows parts it does not install, or hides parts it does (a furnace-only home "gaining A/C" with no coil inside).
- A from-scratch install that quietly erases the old wall furnace.
- A savings figure for cooling a home never had, or any bill shown going up (section 9, R313).
- Heat pump copy that claims savings, a tax credit or a code mandate (6.2).
- Look inside that opens on the condenser for a central system.

## 4. Today's home: the system facts

The scene holds `hvacType` (`central | wall-mounted | portable | package-unit`, null = unknown, drawn as central) and
`hvacComponents` (`furnace | ac | both`) as inputs. Where they live is already ruled: HVAC type and components are set in the
scene only, on the Build's Today side, and leave the customer profile (R275, refining R264; the approved Property facts plan
`docs/superpowers/plans/2026-11-06-property-facts.md` removes them from `customer_profiles`). Every new fact below lives there too.

- **Wall furnace vs wall unit** (my call): no new type. `wall-mounted` + `furnace` is a wall furnace (interior wall, heat only);
  `wall-mounted` + `both` is today's heat-and-cool wall unit on the exterior wall; `wall-mounted` + `ac` is that wall unit cooling
  only (it never heats, as `indoorSide` already rules). The value menu's labels say "Wall furnace" and "Wall unit" so the rep never
  reads the components row to understand the type.
- **Central with A/C only** (my call): the indoor unit is blower + coil (an air handler, no furnace); winter runs nothing; furnace
  replacement is not offered on it (it would add a part the home never had).
- **Window units** are `portable` (it already draws a window unit); its label reads "Window / portable". There is no "none" value:
  null stays unknown, drawn as central.
- **Existing mini-splits**: a fifth main system, `mini-split`, joins the construction core's `hvacTypes`. It draws as section 8's
  mini-split with its head count. (Rare, owner: "still an option".) The profile form that also reads `hvacTypes` is on its way out
  (R275); the column is `text({ enum })`, so the extra value needs no database change.
- **Indoor unit location**: a new fact, `hvacIndoorLocation`, `attic | closet | garage`, asked only for central. Its first guess
  is `attic` on a pitched roof and `closet` on a flat roof; the rep corrects it. `garage` is in the enum from the start but not
  offered until 6-B adds its spot (R299).

## 5. The indoor unit and its components

### 5.1 Components

`hvac-attic`'s single `air-handler` part splits into three construction parts, each a system part of heating & cooling:

| Part | What it is | When it is there |
|---|---|---|
| `blower` | The fan that moves the air | Always on a central system |
| `furnace` | The gas burner and heat exchanger | A gas central system; absent on a heat pump |
| `coil` | The evaporator coil | A central system with A/C or a heat pump; absent on furnace only |

`plenum` (the supply box the ducts leave from), `registers` (one per room) and `thermostat` become system parts of heating &
cooling too, so Look inside can mark them. What exists today: the box at `EQUIPMENT.plenum` is the air handler itself on a central
system (tagged `air-handler`, `attic-ducts.tsx`), and a bare trunk only under a package unit; on a flat roof nothing is drawn there
(the air handler is "in a closet below, out of sight"); registers are not drawn, only the attic-side boots, which belong to the
attic's ceiling and air-sealing story (`ceiling-opening-part.ts`) and stay there. So the plenum becomes its own box on top of the
new cabinet line, and each register is new: a grille on the room side of the ceiling under its boot. The thermostat is drawn
today (`thermostat.tsx`).

The assembly keeps its id `hvac-attic` though a closet unit is not in the attic (my call: renaming moves every reader for no
gain; the id names the assembly, not the location).

### 5.2 Drawn by location

The components are drawn in the order the air passes through them, as one cabinet line with seams between the sections:
return → blower → furnace → coil → plenum.

- **Attic, flat:** the line lies along the attic floor where today's air-handler box stands (`EQUIPMENT.plenum`), its plenum
  where the duct runs leave today.
The **indoor unit** (CONTEXT.md) is the blower, furnace, coil and plenum together; the part list names each one.

- **Closet, upright:** an HVAC closet in the house with the blower at the bottom, the furnace above it, the coil on top and the plenum
  through the ceiling into the attic (pitched) or the joist space (flat roof), where the duct runs leave it as today's
  `lowSlope` runs do. The closet is a small walled space against the back wall at the partition between the living room and the
  kitchen (my call; any spot that keeps the room furnishings and the arrow lanes clear is fine, the builder picks it by
  screenshot). Partly open shows it the way it shows the rooms.
- **Garage, upright (6-B):** the same upright line in the garage against the shared wall. This round defines the location as data
  (one placement per location, keyed on `hvacIndoorLocation`) so 6-B adds a `garage` placement and its offer, and nothing
  in this design's code needs to change.

The line set runs from the coil to the condenser: along the attic floor and down the left wall for an attic unit, through the
wall behind the closet for a closet unit.

### 5.3 Drawing follows the resolved parts

Today every piece of HVAC drawing reads the home's `property.hvacType` / `hvacComponents` (`home-kit.tsx`, `home-equipment.tsx`,
`has-outdoor-unit.ts`), never the Build's resolved parts, so even today's split replacement never draws the condenser it adds to a
furnace-only home. From this design on, what is drawn follows the resolved parts of the side on show: Today draws today's parts,
Build draws the build's (the coil, line set and condenser a build adds; a new-cut's whole system beside the idle wall unit). This is
the cross-cutting change the rest rests on, so the plan does it first, at parity.

### 5.4 Running by season (R303)

Uses today's `indoorSide(weather, …)`: summer is cooling, winter is heating, Normal is neither.

| System | Summer | Winter |
|---|---|---|
| Gas furnace + A/C | blower, coil, line set, condenser | blower, furnace (glows, as the plenum glows today) |
| Furnace only | nothing | blower, furnace |
| Heat pump | blower, coil, line set, outdoor unit | blower, coil (warm), line set, outdoor unit |
| Package unit | as today | as today |
| Mini-split | heads and outdoor unit | heads and outdoor unit |
| Old wall unit after a central install (R309) | never | never |

"Running" means the cues the scene already has: the thermal tag (cooling/heating side), the heat glow, the condenser fan's spin
on a burst, the thermostat's running state. A component not running takes the attic's (or the room's) tag like any part.

## 6. What each build draws

| Today | Build (catalog scope) | Draws |
|---|---|---|
| Central, any | **Split system replacement** (`6450…`, drawn today) | New blower, furnace, coil, line set, condenser; a furnace-only home sees the coil, line set and condenser arrive new (R302). Location kept unless moved (6.1). |
| Central with A/C | **A/C replacement** (`e450…`, not drawn today) | New coil, line set, condenser; blower and furnace stay. |
| Central, any | **Furnace replacement** (`88d0…`, not drawn today) | New blower and furnace; the coil (if any) and outside stay. |
| Wall, window/portable, or mini-split | **Split system new-cut installation** (`8aa0…`, not drawn today) | A whole central system: indoor unit at the first place R298 allows, plenum, ducts (R-6, R-8 option as today), registers and boots, thermostat, line set, condenser. The old wall unit stays, idle (R309). |
| Central, or wall, window/portable, or mini-split | **Heat pump** (new Notion scope, R319) | As split replacement on a central home, or as new-cut on any other, but blower + coil with no furnace and a heat pump outdoor unit (6.2). |
| Package unit | **Package unit replacement** (drawn today) | As today. Offered only on a package-unit home; a package-unit home is offered no central scope. |
| Any | **Mini-split installation** (`dcb0…`) / **Kit: mini-split** (`3190…`), both add-ons | Section 8. |
| Any with ducts | **Air ducts replacement** (add-on, drawn today) | As today, hung (R109), with R305's reasoning. |

All five HVAC entries in `NOT_DRAWN` (A/C, furnace, new-cut and both mini-split entries) leave it and gain `SCOPE_INSTALLS`
entries; their `SCOPE_IDS` are added. "Kit: mini-split" and "Mini-split installation" draw the same (my call).

Each new scope also needs its `UPGRADE_REGISTRY` entry (a `Record` over the scope ids) with written benefits. I draft them from the
Notion scopes and the owner reads them at the look. Comfort a home never had (cooling added) goes under **Looks & use** (my call:
no new benefit kind). Split replacement's "lowers the gas and electric bills" follows section 9 on a furnace-only home.

### 6.1 Moving the indoor unit (R300)

On a split system replacement the system card offers "Move to the attic" when today's unit is not in the attic and the roof is
pitched. (Not `atticReachable`: that counts a flat roof with a redeck, and a flat roof's joist space holds no indoor unit.) On, the build draws the indoor unit in the attic and the old location empty. It is a build choice, not a fact: it
changes nothing about today's home.

### 6.2 Heat pump (R307)

There is no heat pump scope in Notion or the catalog today. **The heat pump is its own Notion scope** (R319), like every other
HVAC build, so the catalog stays one source for trades and scopes; it is not an efficiency upgrade option. Its install draws
blower + coil (no furnace) and a heat pump outdoor unit, at the location rules of section 5.2, and it is picked instead of split
replacement or new-cut (the three are mutually exclusive, 6.3). Its copy says what it is: the same refrigerant loop as A/C run
either way, so one outdoor unit heats and cools, on electricity. Two entries mirror the split pair: **Heat pump replacement** on a
central home, **Heat pump new-cut installation** on any other (it carries the new ducts, registers and thermostat, as new-cut does).
Both entries exist (created 2026-11-12 as copies of the split pair, so they keep its trade, pricing unit, subcontractor and
variables): **Heat pump replacement** `4160ca1b-548b-819e-a910-ea397cc25800`, **Heat pump new-cut installation**
`4160ca1b-548b-81f1-84f9-d141be573ad1`; they join `SCOPE_IDS` by these ids. The plan builds the heat pump last.

**What the heat pump says (R312, R313).** Its benefits are facts: one outdoor unit heats and cools; no flame, flue or gas line
at the indoor unit; the home qualifies for SCE's heat pump rate plan (TOU-D-PRIME). Its heating earns no bill cut on either bill
(gas falls, electric rises, and at about $2/therm and $0.32–0.40/kWh the two come out close to even). Its cooling is a new
high-efficiency cooling side and earns what an A/C replacement earns (section 9; my reading of R313, to confirm at the look).

Copy guardrails, researched 2026-11-11 (installer and trade sources, not tariffs; re-check before any copy ships):
- No federal tax credit: 25C ended for equipment installed after 2025-12-31. State single-family money (HEEHRA, TECH Clean
  California) is used up or waitlisted. The copy names no rebate.
- Not required by code: the 2025 Energy Code (§150.2(b)1F) sets charge, airflow and thermostat rules on a replacement, not a heat
  pump; §150.2(b)1E requires sealing the connected ducts when the condenser, coil or air handler is replaced. SCAQMD rejected the
  gas furnace phase-out (PAR 1111) 7–5 on 2025-06-06. "California is moving to heat pumps" is a direction, never "required".

### 6.3 What the rows offer

`upgrade-rows.ts` stops blocking unitless homes (`no-offer-for-unit`): a wall, window or portable home is offered new-cut, heat
pump and mini-splits; a central home is offered split replacement, A/C replacement (only with A/C today), furnace replacement,
heat pump, ducts and mini-splits; a package-unit home is offered package replacement, ducts and mini-splits. Split replacement,
A/C replacement, furnace replacement and heat pump are mutually exclusive picks on a central home (a full replacement already
holds the other two; a heat pump replaces the whole indoor and outdoor system), and new-cut and heat pump on any other home.

## 7. The camera, the spots and Look inside

- **System view (R297):** `SYSTEM_CAMERA_VIEWS['heating-cooling']` looks at the indoor unit: the attic unit with the house opened
  (heating & cooling is already in `HOUSE_OPENING_SYSTEM_IDS`), the closet unit through the opened house; a package unit as today;
  a wall home at its wall unit or wall furnace; a mini-split-only home at its living-room head. With a new-cut build on, the view
  is the new indoor unit's.
- **Roof spot (item 3):** `systemsAtSpot('roof')` adds `heating-cooling` when the home's indoor unit or its ducts are in the attic
  (central on a reachable attic, or a package unit's trunk), after Roof and Attic. The equipment spot keeps its condenser pin.
- **Look inside order (R304):** the system card lists the system parts in the sales order: blower, furnace, coil, plenum, the
  duct run (jacket, blanket, core as today), registers, thermostat, then the line set and the condenser. Tapping a row
  emphasises it as today; tapping the coil also lights the line set and the condenser (paired emphasis), the coil's story.
  No Next button (my call: the list in order is the one-tap walk; revisit after the owner's look).
- **Up close views:** the Look inside framing for central looks at the indoor unit, not `condenser-pad` (today the system-wide
  view for every non-package system); the condenser gains a part look of its own in `PART_LOOK_INSIDE_VIEWS` (today holds only
  `attic-fan`) built from today's `condenser-pad` numbers, used when the condenser or line set is picked.
- **New on Build:** the scene has no shared "proposed" tint; a new part draws as the fresh version of its material. A component
  the build adds where today has none (the coil in a furnace-only home, every part of a new-cut) appears on Build, and its row
  in the part list says "Added" (my call, so R302's "clearly see" holds on a still frame too). The word is one rule for every
  system (R324): a radiant barrier, attic fan, gutters or air sealing on a home that had none read "Added" too. A part a build
  takes out (the heat pump's furnace) reads "Taken out" (placeholder, read at the look).
- **Hung ducts (R305):** the duct-runs row's detail on a duct build says why they hang: "Hung from the rafters on straps, clear of
  the insulation: no run crushed or kinked, so air reaches every room, and supported the way code requires." Copy check before
  release: code (CMC / SMACNA flex duct rules) requires support at set spacing and no compression; it does not, as far as we know,
  require hanging from the rafters, so the wording claims support to code and hanging as how Tri Pros meets it.

## 8. Mini-splits (R310)

- A head is a wall cassette high on an exterior wall of a room; heads fill the rooms in order living room, bedroom, kitchen
  (today's `ROOMS`), so the count is 1–3 this round (my call: one per room; the cap follows the rooms when Layout L3 adds them).
- One outdoor unit on the ground beside the house (left side yard, near the condenser's pad but clear of it), its line set
  running along the outside wall to each head.
- The count is a field on the mini-split pick (build) and on a `mini-split` home (today), default 1.
- Heads and the outdoor unit run summer and winter (a mini-split is a heat pump). They join heating & cooling's Look inside list
  after the central parts.

## 9. Bill cuts (being worked through with the owner)

The "count what's installed" rule (R101) stays, and the change is made in the shared model, so the ROI calculator and the savings
copy move with the scene (owner: "change everywhere"). Today `TRADE_BILL_CUTS.hvac` is electric 25 / gas 20 for any HVAC pick,
ducts +5/+5 on top (about 29% electric with ducts), applied to the whole bill.

Settled so far:
- **Electric stays as today** (R315): a new system's cooling side cuts 25% of the electric bill; new ducts add 5% compounded, as
  now. Whole-bill percentages stay; no end-use model.
- **Every HVAC replacement earns** (R314): old ≈ 8 SEER, new ≥ 14.3 SEER2, so no HVAC install reads "Like for like".
- **Cooling earns on electric, heating on gas**: A/C replacement earns the electric side only, furnace replacement the gas side
  only, a full replacement both.
- **Never a rise** (R313): cooling a home never had and a heat pump's heating earn nothing on that bill; comfort shows in Benefits.
- **Mini-splits:** no cut this round.
- **Ducts land on the bills the home pays today** (R323): the ducts' 5% lands on gas where the home heats today and on electric
  where it cools today; a home whose system declares neither (a package unit) keeps both. Ducts alone on a central home stay
  5% / 5% as now.

- **Gas stays as today** (R318): a new furnace's heating side cuts 20% of the gas bill, new ducts add 5% compounded. The research
  (`docs/plans/2026-11-11-hvac-gas-savings-research.md`) puts the honest figure lower for most homes (about 5% for an 80% furnace,
  10% for 95%+, 20% only over an original standing-pilot furnace); the owner kept 20% to keep the model simple, and the note is
  there for a later pass.

Copy that moves with it: `trade-outcomes.ts` says "off cooling" while the math cuts the whole electric bill; the copy is reworded
to the bill (my call). ⚠️ Stale today: `src/pain-points.ts:999` promises federal IRA credits and "40–60% more efficient than 10
years ago"; `trade-outcome-statements.ts:4` says "roughly half the energy". Both are rewritten to this section's figures.

## 10. Tracker and other plans

- Tracker: §2 row "Heating & cooling" (R297–R310), §6 change-log line, the R-rows in §3b.
- 6-B plan (`docs/superpowers/plans/2026-11-01-ts3b6b-garage-joins-the-house.md`): a note in its Before Task 1 that the garage's
  move includes the upright indoor unit's `garage` placement and offer (R299), built against this design's location table.
- CONTEXT.md terms, owner agreed 2026-11-13 and written: **Indoor unit** (the blower, furnace, coil and plenum, wherever they
  stand), **HVAC closet** (where an upright indoor unit stands; this spec's "closet" location, enum value `closet`),
  **Wall furnace**, **Wall unit**, **Mini-split head**, **New-cut**, **Heat pump**.

## 11. Open for the owner

Nothing open. To confirm at the look: a heat pump's cooling earns what an A/C replacement earns (6.2).

## 12. Left to the builder

The closet's exact spot and size, the cabinet proportions, the line set path, the head look, the pin points: by screenshot, both home views, Today and Build, raised and slab, pitched and flat, and a
draw-call count against the TS3b.6 budget (record, don't stop).

Files expected to change: `assemblies/hvac-attic.ts`, `infer-existing-conditions.ts`, `scope-ids.ts`, `scope-installs.ts`,
`scope-not-drawn.ts`, `enums.ts`, `trade-bill-cuts.ts`; trade scenes `home-equipment.tsx`, `attic-ducts.tsx`, `wall-unit.tsx`,
new indoor-unit / closet / mini-split components, `system-parts.ts`, `home-systems.ts`, `systems-at-spot.ts`,
`system-camera-views.ts`, `spot-pin-point.ts`, `has-outdoor-unit.ts`, `indoor-side.ts`, `upgrade-rows.ts`,
`upgrade-row-state.ts`, `home-profile-choices.ts`, `home-scene-copy.ts`, `home-geometry.ts` (`EQUIPMENT`), the scene checks
(`scripts/verify-trade-scene*.ts`).
