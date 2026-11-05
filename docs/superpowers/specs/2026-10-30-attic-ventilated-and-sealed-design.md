# The attic, ventilated and sealed — design

Branch `feat/trade-scenes-foundation`. Tracker: `docs/plans/2026-10-16-trade-scenes-epic.md`, §2 row **Attic**, register **R105–R111** (takes T8). The register is the authority; this document says how the work hangs together. Stress-tested 2026-10-30; the owner's rulings from that test are folded in.

## Intent

The whole-home attic is where a rep sells attic work, and today it does not look or behave like a real attic. It has no gable vents, no lights or pipes through the ceiling, and register boots and ducts floating in mid-air. Air sealing and the attic fan can't be seen at all.

This work makes the attic read as a real one: vented, with real openings in the ceiling. It gives two upgrades a story the rep can show:

- **Attic fan:** on a hot day it pulls the attic's heat out the gable. The ceiling is cooler and the AC works less, so the electric bill drops. The owner's words: "attic fan really helps!"
- **Air sealing:** foam collars close the ceiling openings attic air leaks through.

It also draws ducts to today's code: new ducts are hung from the rafters.

## Goals

1. **Gable vents (R105).** A louvred vent high in each gable end of every pitched home, seen from outside in every view.
2. **The attic fan upgrade (R106).**
   - It is a new part in the Attic system, beside radiant barrier, insulation and air sealing.
   - It mounts inside one gable vent and is run by its fan thermostat.
   - In Thermal it clearly lowers the attic reading and the ceiling under it, and shows the attic's heat leaving through that vent.
   - It cuts the electric bill by at least 4%.
   - It is drawn in the whole-home attic and in today's up-close roof & attic screen.
3. **Ceiling openings (R107).** Recessed light cans and plumbing vent pipes in the whole-home attic, like the can and pipe up close. Here the pipes go on out through the roof.
4. **Boots on the ceiling (R108).** Every register boot sits on the ceiling over its register. Today the boots float, and so do today's ducts.
5. **Hung ducts (R109).** R-6 and R-8 ducts hang from the rafters. Other ducts rest on the attic floor.
6. **Foam collars and leaks (R110).**
   - Air sealing shows as a foam collar round every boot, can and pipe where it meets the ceiling, seen only when the attic has no insulation.
   - Without sealing, Thermal shows each opening leaking as short heat arrows: hot attic air down into the rooms in summer, the rooms' heat up into the attic in winter.
7. **Attic-only upgrades hidden on a flat roof (R111).** Radiant barrier, air sealing and the attic fan show no row at all on a flat-roof home. This replaces today's blocked "needs an attic" row.

## Non-goals

- **Attic dust drifting into the rooms** (R104). It is a home stress and belongs to TS3b.7.
- **Any interaction between the fan and air sealing** (owner: sold separately, too much detail).
- **Air pulled in through the other gable vent.** The fan's one story is hot air out.
- **Finer up-close screens** (TS3b.4b). The fan goes into today's single roof & attic slice. R92 notes that the fan and its gable end move to the attic screen when that screen is split.
- **Changing the up-close air-sealing collars or pipe.** Up close keeps today's collars and a pipe that stops inside the attic.
- **Duct changes on a flat roof.** They keep today's drawing in the joist space.
- **Any new catalog or database row.** The "Attic fan installation" scope already exists in the catalog.

## Anti-goals (would be a failure even if it works)

- **The fan out of step with its thermostat.** A fan that runs or changes a reading while the attic reads under 100 °F would teach the rep something false. So would one that stays idle when an attic over 100 °F, on any day, should run it.
- **Foam collars showing through any depth of insulation** (owner: even low insulation covers the foam).
- **Anything on a flat roof that implies an attic:** no gable vents, no fan, no row for radiant barrier, air sealing or the fan, no foam collars, no leak arrows.
- **The scene and the proposal disagreeing on the fan's bill cut** (R101: one rule).
- **A double-tap that lands on a vent slat, a leak arrow or the fan's heat lane** instead of the house behind it.
- **A slower iPad.** More than 10% added frame time on the existing frame-time probe, before vs after.

## Constraints

**Parts come from the assembly** (`src/shared/modules/construction/core/constants/assemblies/roof-attic.ts`).
- The fan is a part of `ROOF_ATTIC`.
- **Flat roof hiding (R111):** `attic-fan`, `air-sealing` and `radiant-barrier` take part-level `forms: ['pitched']`, the way `ridge-vent` does. `resolveAssembly` then drops them on a flat roof (`resolve-assembly.ts:77`), so `upgradeRows` builds no row (`upgrade-rows.ts:43-45`).
- **The `needs-an-attic` blocked reason goes once nothing uses it.** Today it is used in `part-offers.ts:26,121`, its copy at `home-scene-copy.ts:218`, and `verify-trade-scene-layout.ts:111`. That assertion becomes "no row on a flat roof". Whether the material-level `NEEDS_AN_ATTIC` stays is the builder's call, settled with `pnpm tsc`.
- **Unset roof, my call:** the scene draws an unset roof as a gable (`home-roof-form.ts`). So while the roof is unset, the three attic rows still show, blocked `roof-not-set`, like the roof rows. Today a part with `forms` is dropped when the form is `null` too. The builder keeps these three rows when the form is unset, without changing what the ridge vent does.

**The scope is wired by name.**
- Add `SCOPE_IDS.atticFan` (`e050ca1b-548b-8263-8634-01293821c390`) in `scope-ids.ts`.
- `scope-verbs.ts`: verb `'add'`, as radiant barrier has. The `Record<ScopeId,…>` makes tsc enforce it.
- `scope-installs.ts`: `{ assembly: 'roof-attic', trade: 'attic-and-basement', installs: [{ part: 'attic-fan', material: 'thermostat-fan' }] }`. Delete the `scope-not-drawn.ts` entry.
- `infer-existing-conditions.ts`: the fan starts `absent`.
- `HOME_SYSTEMS`: the Attic row gains the fan.

**Heat stays hand-tuned** (`constants/home-heat-figures.ts`). Every figure here is a working number the owner tunes at review.

**Bill rule R101, "count what's installed".**
- The fan adds a bill-cut add-on to the attic trade.
- The energy-impact tracker on main records the ruling as EI-D27 and lists the fan as a bill-cutting add-on in §3.2 (2026-10-30). Its foundation plan (Task 2, `pickBillCuts`) adds the same `attic-fan` add-on, so whichever lands second takes the other's identical entry.

**Build order.**
- After the camera plan's Task 6 (`docs/superpowers/plans/2026-10-28-scene-camera-slide.md`). That task edits `home-geometry.ts` and `verify-trade-scene.ts`. Its Task 5 brings `ignoreRaycast`, which every new effect takes.
- Before TS3b.4b.

**Code placement.**
- Pure rules in `features/trade-scenes/lib`: the running flag, collar visibility, hung vs floor, and leak direction.
- three.js helpers in `ui/lib`; figures and geometry in `constants`.
- One component per file.
- Repeated small pieces are merged or instanced. Cylinders (cans, collars, pipes) use `InstancedPieces` (`shared/components/scene/ui/instanced-pieces.tsx`) or `mergeGeometries`, as `attic-ducts.tsx` does. `MergedBoxes` draws boxes only.

**Fades and views.**
- Every new attic piece joins the `attic` group (`HouseRoof`) or the `ducts` group (`HomeEquipment`), which the settled Complete house hides (`home-kit.tsx:111-125`).
- So collars, cans, pipes inside the attic and boots show wherever the attic shows, not in every view.
- Gable vents and the pipes' roof stubs are on the outside, so they show in every view.

**Words.** Use the glossary: gable vent, attic fan, fan thermostat, Running and Idle, ceiling opening, foam collar, hung ducts. The owner agreed them in `CONTEXT.md` 2026-10-30. Never "swap" or "add-on" in a new name; extending `BILL_CUT_ADD_ON_IDS` is not a new name.

## The owner's decisions (as decided)

- Gable vents on the home (R105).
- **The attic fan (R106):**
  - It is an upgrade like radiant barrier and air sealing.
  - It is thermostat-run, on only above about 100 °F.
  - In Thermal it pushes the attic's heat out through the gable vent.
  - It is drawn up close too.
  - **It cuts the electric bill by at least 4%**, because the attic is cooler, so the ceiling is cooler and the AC works less. This holds for the scene and the proposal, and overrules the energy-impact tracker.
  - **A running fan spins in bursts and keeps a status light lit.**
- Plumbing vent pipes as up close, and recessed lights (R107).
- Boots hovering is a bug: they sit on the ceiling (R108).
- New ducts hang from the rafters, per current code (R109).
- **Foam collars and leaks (R110):**
  - Foam collars round every ceiling opening, only with no insulation.
  - The leak story: hot attic air into the rooms in summer, the home's heat out in winter.
  - **Leaks show as heat arrows.**
- **Radiant barrier, air sealing and the attic fan don't appear on a flat roof at all (R111):** "not even a feasible option".
- No fan and sealing interaction. The fan's story is "hot air out the gable".
- Dust is a home stress, under TS3b.7 (R104).

## How it works

### Gable vents

- A rectangular louvred vent, centred high in each gable triangle. Both ends, every view, every weather.
- It is a dark frame with horizontal slats, set just proud of the stucco. The slats read as open air.
- Reuse the crawl-vent pattern: `MergedBoxes`, `HOME_PALETTE.vent`, and the `proud` depth (`foundation.tsx:47-52`, `home-details.ts:15`). Draw it inside each gable's existing `thermalTag` group (`gable-roof.tsx:79-88`).
- The slats take `ignoreRaycast`, so a double-tap reaches the gable.
- **The ridge vent's copy changes in the same work.** Its `absentCopy` today says "Hot air pools at the top of the attic with nowhere to go", which is untrue once every home has gable vents. New copy, pending the owner's copy pass: "No ridge vent" / "Gable vents alone leave the hottest air pooled under the ridge."
- The ridge vent stays a part, because it is a roof scope the rep can sell. Gable vents are part of every pitched home, so they are drawn with the house.

### The attic fan

**The part.** It goes in `ROOF_ATTIC` as `{ id: 'attic-fan', group: 'attic', role: 'ventilate', forms: ['pitched'] }`.
- One material, **`thermostat-fan`**, with `cut: 'attic-fan'` and `energyRank: 0`. `installKind` needs the `energyRank` to credit its cut, as with radiant barrier.
- Copy: "Attic fan" / "A thermostat-run fan behind the gable vent that pushes the hottest attic air outside on hot days."
- `absentCopy`: "No attic fan" / "On hot days the attic's heat has only the vents to leave by."
- The owner's copy pass may reword both.
- It needs a field glyph (`field-glyphs.ts`) and a label (`PART_LABELS`, `home-scene-copy.ts:197`). The panel crashes without the glyph and shows a blank without the label.

**Where it sits.**
- **Whole home:** inside the left (−x) gable, behind its vent. Partly open opens the attic for x < 2.4, so the fan is seen there. In Complete only the vent shows.
- **Up close:** today's pitched slice gains a **gable end** at its far end from the camera. This is a stucco triangle stub with its vent, a frame piece like `kit-walls.tsx`. The fan sits on the inside of it.
  - The fan's peel offset is `AT_REST`, so it stays on its mount while the rest peels.
  - Its pin sits on the fan itself, not at `KIT_PIN_Z`.
  - Its up-close paint faces are `{ inner: 'attic', outer: 'attic' }` (`KIT_PART_PAINT_FACES`). Without that entry it falls back to the roof's heat.
  - A flat-roof slice gets no gable end.
- **What it looks like:** a round shroud with blades, and a small thermostat box beside it with a status light, on a short frame against the gable studs.

**The fan thermostat.**
- The fan runs while the attic reading, before the fan's own effect, is over **100 °F**. The constant is `ATTIC_FAN_ON_ABOVE = 100` in `home-heat-figures.ts`.
- The threshold decides, never the weather name. With today's figures:
  - Every pitched summer day runs it. The coolest case is coastal with a cool roof and radiant barrier, at 104.4 °F.
  - Winter never runs it.
  - In rain heat is `null`, so the fan is idle.
  - A normal day usually reads 93–97 °F, but a hot-running roof can push it over. An inland home with wood shakes reads 96.7 + 5.4 = 102.1 °F, and runs it.
- **How it is computed** (`lib/home-heat.ts`):
  - The fan's figures are **not** in `PART_HEAT_EFFECTS`. That loop applies every entry with no condition.
  - They live in their own `ATTIC_FAN_HEAT_EFFECTS: WeatherHeatEffects`.
  - `homeHeat()` runs the existing loop first. Then, if the fan's material is `thermostat-fan` and `readings.attic > ATTIC_FAN_ON_ABOVE`, it applies the fan's effect with the existing `applied()`.
  - It sets `atticFanRunning` last.
  - `StartingHomeHeat` becomes `Omit<HomeHeat, 'bounce' | 'atticFanRunning'>` (`types.ts:321`).
  - Every `HomeHeat` literal in `scripts/verify-trade-scene.ts` gains the field.
- **Running and Idle.**
  - Running: the blades spin during a burst, the way `CondenserFan` spins (`useBurstMotion`), and the status light stays lit while it runs.
  - Idle (installed, attic not over 100 °F): drawn still, light off, never hidden.
  - The kit's `drawPart` gets the running flag and `burst` beside its `PartRendererProps` (`types.ts:208`, `roof-attic-kit.tsx:38`). `GableRoof` gets them through `HouseRoof`.

**Heat while running.**

| Weather | Attic | Ceiling | Load |
|---|---|---|---|
| Summer | −20 °F | −1.5 °F | 0.9 |
| Normal day | −6 °F | −0.4 °F | 0.96 |

- These are working numbers, my call, set so the drop reads clearly, per the owner's "attic fan really helps!". The owner tunes them.
- They stack with radiant barrier and the rest the way existing effects stack.
- A fan that pulls the attic back under 100 °F keeps running, because the thermostat reads the attic before the fan.

**Thermal flow.**
- While running, a heat lane leaves the attic through the fan's gable vent to the outside.
- Its geometry goes in `constants/home-heat-lanes.ts` (both the Complete and the Partly open sets, so it shows in both home views under Thermal). It is built in `lib/home-heat-lanes.ts`.
  - It uses `heatArrowLane([vent, outside], heatLaneFlows(heat).roof[1])`.
  - It does not go through `run()`, because the fan only ever blows out, and `run()` would reverse it outside summer.
- Up close it is built the same way in `lib/kit-heat-lanes.ts`, with its points in `KIT_FLOW` (`constants/roof-attic-flows.ts`).
- Idle: no lane.

**Bill.**
- `BILL_CUT_ADD_ON_IDS` gains `'attic-fan'` with label "Attic fan".
- The attic trade gains `addOns['attic-fan']: { electric: 4 }`. Electric only, because the fan works on hot days. 4 is the owner's floor.
- `CUT_SOURCE_LABELS` and the zod enum pick it up by themselves.
- The ROI calculator passes only `['ducts']` (`project-remodel-roi.ts:52`), so it never offers the fan. Radiant barrier has the same gap today, and closing it is not this work.
- Main's energy-impact tracker §3.2 moves "Attic fan installation" from "Not bill-cutting" to bill-cutting under `attic-and-basement`, electric +4. Done 2026-10-30 with the owner's agreement (EI-D27); the energy-impact spec and foundation plan follow it.

### Ceiling openings

**One list.** `CEILING_OPENINGS` in `constants/home-geometry.ts` holds every boot (the end of each `EQUIPMENT.ductRuns` run), can and pipe, each with its ceiling point and radius. Boots, cans, pipes, foam collars and leak arrows all read it.

**Recessed cans.**
- One per room (bedroom, living, kitchen), kept off the Partly open cut line (z ≈ 0).
- The camera always sits above the ceiling (`HOME_FRAMINGS`), so a can is drawn as its housing, a short cylinder standing on the ceiling between the joists.
- Pitched: in the attic. Flat: in the joist space, which Partly open shows.
- A white trim ring under the ceiling is optional and costs little. It only shows if the camera goes under the ceiling.

**Plumbing vent pipes.**
- Two: over the kitchen (the sink vent) and over the bedroom (the bath stack).
- The bedroom pipe goes out through the back slope, since Partly open removes the front slope over that room.
- Each rises from the ceiling through the attic and out through the roof, with pipe flashing on the covering. (Not "boot": that word is the register boot.)
- On a flat roof each rises through the joist space and stands a short stub above the roof.

These are part of every home, not parts. The insulation buries their bases, as it buries the joists.

### Register boots and ducts

- **Boots** sit on the ceiling at `WALL_TOP_Y`, over each register.
  - Pitched: remove the `+0.2` at `attic-ducts.tsx:63`. Flat already sits there.
  - The boot's top stands just clear of the deepest insulation (`laidInsulationDepth('blown-r38')`), so the duct connection reads.
  - Wall and portable units have no boots, so there are none to draw.
- **Today's ducts float.** The runs sit about +0.25 m off the ceiling, against joist tops at +0.14 (`home-geometry.ts:202-204`). The note "lying on the attic floor" at `:200` is stale.
  - Ducts that don't hang now rest on the joists, sagging as today, each ending in its boot.
- **Hung ducts** (`r6-silver-flex`, `r8-flex`):
  - The trunk and runs hang level on thin straps from the rafters. The strap top comes from `roofUndersideY` (`lib/roof-underside.ts:6`).
  - They run clear above the deepest insulation and below the radiant barrier, and each run drops straight down to its boot.
  - No sag; silver as today; R-8 fatter as today.
  - Reuse `ductRuns()` with level points.
  - **Decided by material, not by the build.** A home the rep sets as already having R-6 or R-8 ducts had them put in to today's code, so they hang on both sides of the build switch. Post-2014 homes guess R-6 (`home-materials.ts:57`), so those hang on Today by default.
- **Flat roof:** unchanged, in the joist space.

### Foam collars and leaks

**Foam collars.**
- When air sealing is installed and the attic has no insulation, a yellow expanding-foam collar is drawn round the base of every ceiling opening, on the attic side.
- It matches the up-close look (`air-sealing-part.tsx`). The colours `foam`, `lightCan` and `pipe` move into `HOME_PALETTE`, and `KIT_COLORS` references them, as `ridgeVent` already does.
- With any insulation material, no collars.
- One instanced or merged draw for all of them.
- Pitched only (R111).

**Leak arrows, Thermal only, when air sealing is not installed.**
- Each unsealed ceiling opening gets a short heat lane, built in `homeHeatLanes` alongside the others. `homeHeatLanes` takes a `sealed` argument, since today it takes no parts.
- Direction comes from the existing `run()`: in summer and on normal days, from the attic down into the room; in winter, from the room up into the attic.
- They show whether or not there is insulation, because the gap is in the ceiling, under the blanket.
- Sealing removes them. No lanes in rain, as for every arrow.
- Pitched only (R111).
- They are heat arrows, so they are instanced with the rest and already ignore taps.
- The existing `'air-sealing'` heat figures stay as they are.

### Up close

Today's roof & attic kit gains, on the pitched form only:

- the gable end stub with its vent;
- the fan part, drawn when installed, Running or Idle by the same flag;
- the fan's heat lane under Thermal.

Everything else up close is unchanged.

## My calls (not confirmed by the owner)

- **Vents and placement.**
  - The vents are a rectangular louvre, high in each gable.
  - The fan sits behind the left (−x) vent, and up close at the far end of the slice.
  - New ridge vent copy.
- **Fan look and rule.** An Idle fan is drawn still, not hidden. "Running" is one flag, worked out from the attic before the fan.
- **Fan numbers.**
  - Summer: attic −20 °F, ceiling −1.5 °F, load 0.9.
  - Normal day: attic −6 °F, ceiling −0.4 °F, load 0.96.
  - Bill: exactly 4% electric, the owner's floor.
- **Unset roof:** the three attic rows show, blocked `roof-not-set`, rather than vanish.
- **Openings.**
  - One can per room, drawn from the attic side.
  - Two pipes, kitchen and bedroom (back slope).
  - Flat-roof pipes stand above the roof.
- **Ducts.**
  - Boot tops stay visible above the deepest insulation, for readability.
  - Ducts that don't hang rest on the joists. This fixes the float.
  - Hung by material, so existing R-6 and R-8 hang on Today too.
- **No intake** through the other vent.

## Left to the builder

- Exact sizes, colours, louvre count, strap spacing and hung duct height, within the rules above, checked against screenshots.
- Whether the material-level `NEEDS_AN_ATTIC` stays once the part-level `forms` hide the rows.
- How to keep the three attic rows on an unset roof without changing the ridge vent.
- The status light's look; `useHeatGlow` or a plain emissive.
- Lane timing, matching the existing heat-arrow language.

## Done looks like

**Automated** (`scripts/verify-trade-scene.ts`, `verify-trade-scene-layout.ts`, plus `pnpm tsc` and `pnpm lint`):
- [ ] The fan runs at an attic of 100.1 °F before the fan, and is idle at 99.9 °F, in winter, and in rain.
- [ ] The inland wood-shake normal day runs it. Every pitched summer case runs it.
- [ ] Idle changes no reading. Running changes them by exactly `ATTIC_FAN_HEAT_EFFECTS`.
- [ ] No upgrade raises the attic reading. Otherwise an upgrade could switch the fan off.
- [ ] Flat roof: no row for radiant barrier, air sealing or the fan. Unset roof: they show, blocked `roof-not-set`.
- [ ] The fan starts absent. The starting-home figures hold, and `FULL_BUILD` stays as pinned.
- [ ] The fan's 4% electric cut counts only when it is installed. The savings oracle (`verify-trade-scene.ts:185-188`) learns a second add-on.
- [ ] Every `HOME_SYSTEMS` row has a label, a glyph, a `KIT_PEEL` entry and a pin.
- [ ] The attic fan scope is drawn and no longer listed as not drawn. `verify-scope-installs.ts` reads Notion, so it runs only with the owner's OK.
- [ ] Hung vs floor is decided by material. Collars show only when sealed with no insulation on a pitched home.

**By eye** (own browser, a local playwright script; both home views and up close; summer, normal, winter and rain; iPad viewport):
- [ ] Vents in both gables of every pitched home, none on flat.
- [ ] Fan behind the left vent and up close. In summer it spins in a burst, its light is lit, the attic reads cooler, and a heat lane leaves the vent.
- [ ] A can in each room, and two pipes out through the roof, on both roof forms.
- [ ] Boots on the ceiling. Old ducts on the joists. Hung ducts on straps.
- [ ] Collars with sealing and no insulation; none with any insulation.
- [ ] Leak arrows without sealing: down in summer and normal, up in winter. None on a flat roof.
- [ ] A double-tap on a vent, an arrow or the fan's lane reaches the house behind it.
- [ ] Frame time no more than 10% above the same probe on the pre-work head. Use the TS3b.3 probe at `.superpowers/sdd/2026-10-23-home-views-and-thermal-lens/shots/final/perf.mjs`, or the iPad.
