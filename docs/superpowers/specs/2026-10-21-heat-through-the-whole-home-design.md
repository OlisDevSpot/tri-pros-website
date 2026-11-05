# Heat through the whole home (TS3b.2): design

**Tracker:** `docs/plans/2026-10-16-trade-scenes-epic.md`, §2 row TS3b.2, requirements R42–R45 and R68, plus the Normal-meter issue logged in the 2026-10-20 change-log line. R41 (AC or furnace switch) is deferred (§2 of this spec).
**Branch:** `feat/trade-scenes-foundation` (worktree `.worktrees/trade-scenes`), on top of TS3b.1. Lab page `/dashboard/labs/trade-scene`.
**Status:** written 2026-10-21 from the owner's brainstorm; approved by the owner 2026-10-21; built (see the tracker).

Marks used below: *(owner)* is the owner's decision; *(Claude's call)* is a decision made while writing, for the owner to check; anything unmarked follows directly from the code or an owner ruling already in the tracker.

---

## 1. Intent

The Home scene is a sales tool a rep runs on a tablet across the table from a homeowner. Its job here is one picture the homeowner gets at a glance: **heat is pouring into (or out of) my house through the roof, the walls and the windows, and the Tri Pros build slows it to a trickle.**

Today that story only shows in the small roof cut-out, as a ribbon, and the thermal image of the house is a still picture (R42). The readings come out of the construction model's heat walk, which produces two results the owner does not want shown: adding insulation makes the summer attic read slightly warmer (R45), and the winter build barely differs from Today (R44). The owner's ruling (R43) is that the figures are an example, not science: take today's numbers as the baseline and tune them by hand.

So this project does three things:

1. **Heat moves through the whole home** as glowing comet arrows, in the Thermal view and up close. Fewer, slower arrows mean less heat gets through.
2. **Every figure the scene shows comes from one hand-tuned table**: the temperature pins, the thermal colours, the arrows, the equipment load and the meter. The heat walk no longer feeds the scene.
3. **Temperature pins on the walls and windows** join the roof, attic and ceiling pins (R68).

## 2. Goals, non-goals, anti-goals

**Goals**
- In the Thermal view, heat visibly moves through the roof, the sunny walls and the windows of the whole house, and keeps moving (R42).
- Today vs Tri Pros build reads instantly: the build sends fewer and slower arrows; the cool roof and cool paint bounce some arrows back out *(owner)*. In this project the build changes the roof, attic and ceiling; the walls and windows change with the build once TS3b.4 adds their upgrades (§3.2).
- Winter runs the other way: the house is the heat source and the arrows leave it *(owner)*.
- The winter attic shows about a 5 °F gap between Today and the build, e.g. coastal 44 → 39 °F (R44, *owner*: "44 → 39").
- Adding insulation never shows the summer attic warming up (R45).
- Pins on the walls and windows, with Today and build values (R68).
- On a Normal (mild) day the meter reads like a typical spring or fall month, a small share of the summer bill (about 40%) *(owner, accepted)*. Summer reads the full bill.
- One file holds every hand-tuned figure, so the owner can tune the example in one place *(owner)*.

**Non-goals**
- **The AC or furnace switch (R41).** Not drawn and not switchable in this project. The AC and furnace still count in the savings dollars exactly as today. R41 moves to a later project that shows a typical day per season *(owner)*.
- **The window and cool-paint upgrades themselves** (their chips, their before and after models, R46, R47). They belong to TS3b.4. This project gives the table their rows and reads the windows the home already has (§5.4).
- **The view modes** Normal, Partial open and X-ray (R40, TS3b.3). This project uses the Thermal view that exists today (`thermalCamera`, `view-mode-of.ts`).
- **The savings dollars.** The bill cuts, repairs and the Savings tab stay as they are.
- **Physics.** No new heat model and no attempt to make the table "right" beyond the owner's rules.
- **Thermal in Rain** (the open TS3b.1 issue: the home paints with no readings). Untouched here.
- The frozen surfaces: `/dashboard/labs/roof-cutaway`, the cutaway look (`ui/views/cutaway-look-view.tsx`, `ui/components/look-dev/*`) and `src/features/meeting-visualizations/`.

**Anti-goals** (what would make this a failure even if it works)
- Any reading, colour, arrow count or meter that tells a different story from the others for the same home and weather.
- Arrows so dense the house turns into an orange wash from across the table.
- A tablet that runs hot or stutters during a meeting because the arrows animate expensively.
- A figure that contradicts the owner's three rules (5 °F winter gap, attic never warmer with insulation, Normal gap smaller than summer's).

## 3. What the rep and homeowner see

### 3.1 The arrows

- **Style: Comet** *(owner)*. A notched arrowhead with a light-to-hot gradient and a fading, glowing tail behind it. The picked mockup, pointing along +x, in SVG units:
  ```svg
  <!-- glow: feGaussianBlur stdDeviation 1.4 merged under the source -->
  <path d="M-24,0 L-3,-2.4 L-3,2.4 Z" fill="tail gradient: oklch(0.74 0.17 50) at 0% opacity → oklch(0.88 0.12 75) at 95%"/>
  <path d="M7,0 L-5,-6 L-2,0 L-5,6 Z" fill="head gradient: oklch(0.66 0.2 35) → oklch(0.88 0.12 75)"
        stroke="oklch(0.88 0.12 75)" stroke-width="0.6" stroke-linejoin="round"/>
  ``` In 3D each arrow is a **flat sprite that always faces the camera** *(owner)* and points along its path.
- **Where:** on the whole home, arrows run along fixed lanes through each surface *(owner)*: the roof (down through the roof into the attic and on through the ceiling), the walls that face the summer sun (`facesSummerSun`), and the windows. Lanes are fixed per surface, not simulated *(owner)*.
- **How much:** the number of arrows on a surface and their speed show how much heat gets through *(owner)*. Both come from the table (§4), not from physics *(owner)*. The build has fewer and slower arrows.
- **Bounce:** on the cool roof and the cool paint, some arrows hit the surface and turn back out *(owner)*. The radiant barrier also turns some arrows back up toward the deck *(Claude's call: the barrier's own selling point is "turns back most of the heat the roof radiates", `assemblies/roof-attic.ts:34`; drop it if the owner wants bounce only on the outside surfaces)*.
- **Weather:**
  - **Summer:** many fast arrows inward.
  - **Normal:** a few slow arrows inward, and a smaller Today vs build gap *(owner)*.
  - **Winter:** the arrows run outward, from the rooms through the ceiling, attic and roof, and out through the walls and windows *(owner)*. No bounce in winter *(Claude's call: there is no sun to turn back)*.
  - **Rain:** no arrows *(owner)*.
- **When they show:** on the whole home, **only in the Thermal view** *(owner)*. **Up close** (zoomed into the roof section) the arrows replace the ribbon *(owner: "no more ribbon")*. Up close they show in every view, as the ribbon does today *(owner, 2026-10-21)*.
- **Up close, layer by layer:** the arrows enter at the covering, and the parts thin them out where they stop heat: the cool covering and the barrier bounce some back, the insulation lets only a few through to the ceiling. The arrow counts above and below each layer follow the table, so the section and the whole home agree. To make that possible, the roof's flow is held at two points, **into the attic** (after the covering, deck and barrier) and **through the ceiling** (after the insulation and air sealing), and every rung of the insulation ladder, the starting home's R-11 included, carries the share it lets through. So Today's thin R-11 already visibly stops some arrows, and R-38 stops most *(Claude's call)*.
- **Motion:** the arrows never stop while the Thermal view or up close is open, not only during the 10-second burst the rest of the scene uses (`SCENE_BURST`, `shared/components/scene/constants/scene-burst.ts`) *(owner, 2026-10-21, knowing the tablet keeps drawing and runs warmer)*. This is the one exception to R23 ("bursts of life, then rest"); everything else in the scene keeps its burst. With reduced motion on, the arrows hold still, spaced along their lanes, so the count still reads.

### 3.2 The temperature pins

Today the Thermal view pins three readings: roof surface, attic air, ceiling surface (`READING_IDS`, `constants/home-anchors.ts:62`). Three join them (R68):

| Pin | What it reads | Where it sits *(Claude's call)* |
|---|---|---|
| Wall, outside | The outside surface of a wall that faces the summer sun | On that wall's outside face, clear of the window |
| Wall, inside | The inside surface of the same wall, what you feel from the room | On the same wall's inside face, in a room the cut shows |
| Window | The inside surface of the glass, what you feel sitting next to it | On a window in that same sunny wall |

- **In this project the build does not change the walls or windows.** The only things that differ there are the home's own windows (single or double pane, from `windowsType`). The wall and window pins and arrows show the home as it is; their Today vs build difference arrives when TS3b.4 adds the window and cool-paint upgrades *(owner, accepted in the brainstorm playback)*. The table already holds those upgrades' effects, so TS3b.4 adds no figures. The cool paint will mostly move the outside wall pin. No upgrade puts insulation in the walls, so the inside wall pin moves only a little, with the paint.
- The window pin shows single vs double pane: e.g. inland summer about 92 °F single, 80 °F double; winter about 50 °F single, 62 °F double *(Claude's call: example numbers, tuned in the table)*.
- Like today's pins, the new pins show only in the Thermal view and never in Rain. Up close keeps the section's own roof, attic and ceiling pins; the wall and window pins belong to the whole-home view.
- The pins must not crowd each other or today's pins, and at 1024 px with the app nav open they must clear the dock (the TS3b.1 issue with the roof pin stays its own item).
- Each pin carries the same "typical day, estimate" disclosure today's pins do.

### 3.3 Colours

The thermal colours on the house, the walls, the glass and the section's parts come from the same table as the pins, so a colour and a number never disagree (today's rule, `lib/home-paint-temperatures.ts:16`). The sunlit wall takes the wall-outside reading; the glass takes the window reading *(Claude's call)*.

### 3.4 The meter and the equipment

- **The meter** (the electric meter's dial on the house) reads **the weather's level × what is left of the electric bill after the build**:
  - weather level: Summer 1.0, Normal about 0.4 *(owner, accepted)*, Winter about 0.5 *(Claude's call: most SoCal homes heat with gas, so the winter electric bill is the furnace fan and the house, not the heat)*, Rain 0 (unchanged, the meter stands still in rain);
  - what is left: 1 on Today; on the build, 1 minus the electric cut the Savings figures already apply (`savings.cuts.electric.combined`, set whether or not a bill is typed, and 0 on Today), so the meter and the dollars agree.
  This replaces `resolve-scene.ts:109`, which gives 1.0 Today and 0.83 build in every weather, so a mild day ran the meter flat out.
- **The equipment load** (the condenser fan, the strain, the condenser's and ducts' thermal colours) comes from the table too (§4), per climate × weather, cut by each upgrade. The AC still shows idle on a Normal day (`home-equipment.tsx:19-27` and the `> 0.3` running threshold in `constants/home-life.ts:10` are unchanged) *(Claude's call: the AC is not drawn or switchable in this project, R41)*.
- **Comfort** (the residents' reactions) stays the ceiling-to-thermostat gap (R33, `lib/comfort-from-readings.ts`), now read from the table's ceiling value.

## 4. The figures table

One file holds every hand-tuned figure *(owner)*. Location *(Claude's call)*: `src/features/trade-scenes/constants/home-heat-figures.ts`, with the code that composes it in `src/features/trade-scenes/lib/`. Every number in it carries the repo's usual "working number" note.

### 4.1 What it holds

1. **The starting home's readings and flow**, for each climate (coastal, inland) × weather (normal, summer, winter): roof surface, attic air, ceiling surface, wall outside, wall inside, window glass (°F); the arrow flow on each surface (roof, walls, windows), from which the arrow count and speed follow; and the equipment load (0..1).
2. **Each upgrade's fixed effect**, per weather: °F deltas on any of the six readings, a cut to the arrow flow on its own surface, and for the cool roof, cool paint and radiant barrier the share of arrows that bounce.
3. **The meter level per weather** (§3.4).

Rain has no row: no readings, no arrows, meter 0.

### 4.2 The starting home

The starting home is the default home the current readings were taken from: built 1950–1978, R-11 batts, regular asphalt shingles on a pitched roof, no radiant barrier, open air gaps, single-pane windows, regular paint. Its roof, attic and ceiling numbers are today's Today readings, taken once from the current heat walk:

| Climate, weather | Roof °F | Attic °F | Ceiling °F | Load |
|---|---|---|---|---|
| Inland summer | 166.1 | 140.2 | 79.6 | 0.552 |
| Coastal summer | 148.3 | 123.4 | 78.6 | — |
| Inland normal | 107.9 | 96.7 | 77.2 | 0.193 |
| Coastal normal | 103.9 | 92.9 | 76.9 | 0.193 |
| Inland winter | 33.8 | 37.2 | 68.2 | — |
| Coastal winter | 40.7 | 43.7 | 68.5 | 0.613 |

The "—" loads, and the wall and window readings, are the builder's to set by the same method (today's model or `homePaintTemperatures` for the wall, judgment for the glass), then tuned by eye.

### 4.3 How a home's numbers are composed

- A home's numbers are **the starting home plus the effect of every way it differs from it**. A difference applies **the same fixed effect whether the home already has it or the build adds it**, and it applies once. So a home that already has double-pane windows shows the window effect on Today, and the build adds nothing more for windows. *(Claude's call: this is what lets the build era fill in the home's current state later, R64, without new figures.)*
- What counts as a difference is read from what the scene draws: the roof-attic parts and their materials (insulation level, radiant barrier, covering including the cool coverings, air sealing, ridge vent) and the home's windows (`windowsType`, single or double). Paint has no state today and reads as regular until TS3b.4 adds it.
- **Insulation is a ladder, not one upgrade:** none, R-11, R-19, R-30, R-38, each step with its own effect. In summer and Normal the attic never rises as the level goes up (R45); the ceiling falls. In winter the attic falls and the ceiling rises.
- **Roof coverings** other than the shingle (tile, shake, flat membrane) carry a small roof-surface effect taken once from the current model *(Claude's call: keeps today's difference between coverings without a second baseline)*.
- The owner's examples to start from *(owner, accepted)*:
  - insulation: attic −2 °F in summer, −5 °F in winter, never up;
  - radiant barrier: attic −13 °F in summer;
  - cool roof: roof −13 °F and attic −6 °F in summer, plus bounce;
  - windows: fewer window arrows (and the glass readings above);
  - cool paint: fewer wall arrows, plus bounce.
- Normal's effects are smaller than summer's, so its Today vs build gap is smaller *(owner)*.

### 4.4 The targets the table must hit

These are checked by script (§7):

- **Inland summer, full build** (R-38 + radiant barrier + cool shingle) lands near today's build row: roof about 153 °F, attic about 121 °F, ceiling about 77 °F, load about 0.09.
- **Coastal winter attic:** Today about 44 °F, full build about 39 °F (R44).
- **Coastal winter roof:** Today about 2 °F warmer than the full build (e.g. 41 → 39 °F): the house's heat warms the roof from the inside, but its surface faces the night sky, so its gap is smaller than the attic's *(owner, 2026-10-21; settles R44's "reading to confirm")*.
- **No warmer attic with more insulation** in summer or Normal, for every climate and every other upgrade combination (R45).
- **Normal's gap is smaller than summer's** for every reading and the meter.
- **Every upgrade only ever lowers the heat flow on its surface**, never raises it, in every weather.
- **Normal Today's meter** reads 0.4; Summer Today's reads 1.0; Rain's 0.

## 5. What changes in the code

### 5.1 The scene stops using the heat walk

`resolveScene` (`lib/resolve-scene.ts`) stops calling `thermalWalk` and `relativeHeatFlow` for the scene. The readings, the arrow flows, the equipment load, the meter and the section's part colours all come from the table. The construction module's heat walk itself stays where it is *(Claude's call: the proposal energy impact epic may still need it, and deleting shared model code is outside this project)*; the builder checks for other consumers and lists any it finds.

### 5.2 The readings grow to six

`READING_IDS` and `READING_ANCHORS` gain the wall-outside, wall-inside and window pins, with their copy. `readingValue` and the readings type change shape to match; `ThermalReadings` from the construction module is no longer the scene's readings type *(Claude's call)*. The section's pins still show only roof, attic and ceiling.

### 5.3 The ribbon goes

The roof section's heat ribbon (`assembly-kits/roof-attic/heat-ribbons.tsx`, `reflected-ribbon.tsx`, the heat side of `roof-attic-flows.tsx` and `lib/ribbon-paths.ts`) is replaced by the arrows. Whatever only the heat ribbon used goes with it, including the ribbon-style look option if nothing else reads it. The **rain ribbons stay** (`rain-ribbons.tsx`; the owner's "no more ribbon" was about heat) *(Claude's call)*. The shared `flow-ribbon.tsx` and the frozen look-dev ribbons stay, because the frozen surfaces use them.

### 5.4 Windows and paint

- The table carries rows for double-pane windows and cool paint now.
- Today reads the home's windows from `windowsType`; the window panes already draw single or double (`lib/window-boxes.ts`). An unknown `windowsType` reads as single *(Claude's call: the worst case, matching R64's pre-1950 starting point)*.
- The build adds no window or paint effect until TS3b.4 adds those upgrades; the composition takes the window and paint state as inputs, so TS3b.4 only has to feed them.

### 5.5 Performance

The arrows must not cost the tablet much: a single instanced draw (or very few) for all arrows, one shared texture, positions advanced on the GPU or in one loop, and nothing allocated per frame *(Claude's call)*. The canvas renders on demand today (`frameloop="demand"`, `scene-shell.tsx:47`); while arrows are on screen they keep requesting frames themselves, and stop the moment they leave the screen (Thermal off on the whole home, back out of up close, rain, reduced motion). Everything else in the scene still rests after its burst; the arrows' loop must not keep the residents, AC or meter moving.

## 6. Constraints

- Pure logic is proved by `tsx` assertion scripts (`pnpm tsx scripts/verify-trade-scene.ts`); there is no test runner and adding one is out of scope.
- Verify with `pnpm tsc` and `CI=1 pnpm lint`. Never `pnpm build`. The owner runs the dev server (port 3002).
- No edits to `eslint.config.js` or `package.json`; no new dependencies.
- Colours in DOM UI use the design tokens; the arrows' colours live with the scene's other 3D colours.
- Comments say why, never what; one component per file; constants in `constants/`, logic in `lib/`.
- Never mention solar.
- UI is verified with screenshots in both colour schemes before it is called done.

## 7. How we know it works

- **Script checks** (in `scripts/verify-trade-scene.ts`): every target in §4.4; a difference applied once (a home that already has double-pane windows gives the same build as one that gets them); Rain gives no readings, no arrows and a still meter; the meter follows the electric cut with and without a typed bill.
- **By eye**, at 1280 and 1024, light and dark: Summer Today vs build inland, Winter Today vs build coastal, Normal, Rain; up close on each; pins clear of each other and the dock; arrows readable from across a table, not a wash; reduced motion holds them still.
- **The owner tunes** the numbers at review by editing the one file.
- **Tablet cost:** with Thermal on and the scene left alone, the frame time stays smooth and the arrows' frame loop is the only thing drawing (the residents, AC and meter are at rest). Measured in the browser's performance panel; the owner checks warmth on the iPad in a long session.

## 8. Calls for the owner to check

1. **The radiant barrier bounces arrows** too, not just the cool roof and cool paint.
2. **The winter meter level is 0.5** of the bill.
3. **Pin placement:** one sunny wall carries both wall pins and its window the glass pin.
4. **A difference applies once**, whether the home already has it or the build adds it.
5. **The roof's flow is held at two points** (into the attic, through the ceiling), and every insulation rung, R-11 included, carries the share it lets through.
6. **An unknown `windowsType` reads as single pane.**
7. **The table lives in** `src/features/trade-scenes/constants/home-heat-figures.ts`.
8. **The rain ribbons stay**; only the heat ribbon goes.

Settled by the owner on 2026-10-21 after the builder check: the arrows never stop while Thermal or up close is open (an exception to R23); up close shows the arrows in every view; the winter roof shows a smaller gap (about 2 °F) than the attic.

## 9. Left to the builder

- The exact lanes, the arrow count per unit of flow, the speeds, the sprite size and the bounce paths, tuned by eye against §3.1.
- The wall and window starting numbers and every effect not given above, within §4.4's targets.
- How the section's parts get their colours from the table's roof, attic and ceiling numbers.
- The pin copy (short labels in the voice of today's pins).
- Whether `heat` and `walk` leave `AssemblyTargets` entirely or stay for rain.
