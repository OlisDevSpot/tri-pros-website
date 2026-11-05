# Home scene v2, part 1: layout and inputs (TS3b.1)

Tracker: `docs/plans/2026-10-16-trade-scenes-epic.md` §2 row TS3b.1, requirements R39, R48, R49, R53, R54, R56, R57, R58, R59 (§3b). Builds on the Home scene spec `docs/superpowers/specs/2026-10-16-home-scene-design.md` and the code on branch `feat/trade-scenes-foundation`. Page: `/dashboard/labs/trade-scene`, view `src/features/trade-scenes/ui/views/trade-scene-view.tsx`.

## 1. Intent

The scene works as a demo but is hard to run in a meeting. Every input shows all the time, the left panel is big, and inputs that do nothing in the current state still look live. This project gives the scene a layout that follows how a rep actually uses it at the kitchen table. Every later TS3b project (heat through the home, view modes, new upgrades, tap and jump) adds controls, and they all need a place to go first.

### The meeting, as the owner runs it

1. **Set the scene.** The rep explains what the homeowner is looking at: a tool Tri Pros built to show how green upgrades keep heat out in summer and in during winter. Nothing to read yet.
2. **Map the home together.** Rep and homeowner fill in the house out loud ("your roof is 25 years old, regular shingles", "single pane", "insulation's low", "foundation is raised"). The scene changes as each answer goes in. These facts are entered live in the meeting, not beforehand.
3. **Look around.** The rep shows the views and weathers so the homeowner gets a feel for what the 3D shows (temperatures, heat flow).
4. **Build the upgrade.** Starting from the home as it is today, the rep adds upgrades one at a time and flips **Today / Tri Pros build** to show bad vs good, both in the materials and in the heat.
5. **Up close.** The rep jumps into one section for the details: its layers, the old vs the new, and the selling points.
6. **The money.** Savings come last.

The rep drives. The homeowner may orbit or tap the house but never has to find a control. The screen is an iPad in landscape or a laptop, with equal weight.

## 2. Goals, non-goals, anti-goals

**Goals**
- The controls are grouped by topic (owner's pick: groups, not guided stages): **Home**, **Upgrades**, **Savings** in a left panel, and the switches flipped all the time in a right dock.
- The left panel is smaller, collapses to a rail, and still works collapsed (R58).
- The home's facts (the truth) are kept apart from what is being shown (the presentation) (R54).
- Only inputs that do something in the current state are offered (R48).
- Normal weather exists and is the default (R49).
- Up close has a screen built from content blocks, so each section can carry its own mix of layers, selling points, charts, tables and text.
- The camera can go lower (R39), and the black artifact behind the zoomed-out home is gone (R57).

**Non-goals** (each is a later TS3b project)
- The new view modes beyond what exists (Normal and X-ray, R40), the AC/furnace switch's effect (R41) and heat through the whole home (R42–R45).
- New upgrades (windows, Cool Life paint, R-6 ducts, condenser size, shingle colour) and new home facts (roof age, paint condition) (TS3b.4).
- New sections to jump into, and tap-a-part-to-pick-its-upgrade (R52, R55, TS3b.5).
- New models (R34–R38).

**Anti-goals** (what would make this a failure even if it works)
- A control that looks live but changes nothing.
- The homeowner having to read a form or a long list.
- The scene losing its room to panels: the house stays the focus.
- Off-system styling. The look follows `DESIGN.md` (Command Desk, dark presentation ground), the same as the current panel.

## 3. Layout (owner picked option C for the whole home, option A for up close)

Visual reference: the companion mockups under `.superpowers/brainstorm/1287083-1792553506/content/` (`layout-options.html` option C for structure only, since its styling is not the system's; `up-close-options-v2.html` option A, drawn in the real tokens).

### 3.1 Whole home

- **Scene:** fills the stage, right of the left panel.
- **Today / Tri Pros build:** a segmented toggle floating at the top centre of the scene. It keeps today's behaviour and labels.
- **Left panel:** three tabs, **Home | Upgrades | Savings**, with one group showing at a time. Above the tabs, the scene's heading (eyebrow and title from `targets.heading`) stays as a compact header.
- **Right dock:** a vertical strip of large icon-and-label buttons at the scene's right edge, vertically centred. Each opens a small pop-out beside it:
  - **View**: the view modes that exist today. "Partial open" is today's cutaway and the default for now; "Thermal" is today's thermal camera switch. Normal and X-ray join in TS3b.3, and Normal then becomes the default.
  - **Weather**: Normal, Summer, Winter, Rain. Normal is the default.
  - **A third button follows the weather**: "AC on" in Summer and "Heat on" in Winter, shown only when the home has that equipment. It is hidden in Normal and Rain. Its switch and its effect on the scene are built in TS3b.2; until then the button does not exist (no dead control).
- **Collapsed:** the left panel folds to a rail of three icon buttons (Home, Upgrades, Savings). Tapping one opens that tab as a pop-out over the scene's edge, so every input stays reachable. The scene widens into the freed space. The collapse control sits at the panel's top edge. The panel remembers its state for the session.

### 3.2 Up close (jumping into a section)

- Jumping into a section swaps the left panel's tabs for that section's screen, and the panel widens a little while up close. **"← Whole home"** at the top takes you back to the tabs (and zooms out, as the back button does today).
- The section's screen is a column of **blocks**, scrolling inside the panel when it runs long:
  - **Layers**: the named parts, numbered to match the pins on the scene. Tapping one emphasizes it, as the part list does today.
  - **Peel**: the existing explode slider.
  - **Selling points**: short lines with a bullet.
  - **Chart**: a simple comparison (for example Today vs Tri Pros build), bars with values.
  - **Table**: a small side-by-side (for example water-based paint vs Cool Life).
  - **Text**: a short paragraph.
- Each section lists its blocks in data (one definition per assembly, in `constants/`). A block can read the resolved scene (parts, readings) or carry its own copy. Copy and claims come only from the owner.
- **This project builds the block list and the two block types the roof uses: layers and peel.** The roof's screen is those two. Selling points, chart, table and text are built with the first section that carries the owner's copy for them (expected in TS3b.4, paint or windows); the block type union grows then. The roof's temperature readings stay as pins on the scene, as today, and do not move into the panel.
- The dock stays as it is while up close.
- Collapsed while up close, the rail shows the section's screen as its pop-out.

## 4. Where every input goes

| Input today | Kind (R54) | New home |
|---|---|---|
| Home profile popover: roof type, year built, insulation, foundation, heating and cooling type, its parts, windows | home's facts | **Home** tab |
| Household type, age group | home's facts | **Home** tab, under a "Who lives here" heading |
| Climate (Coastal / Inland), in the weather controls today | home's facts | **Home** tab, first field |
| Today / Tri Pros build | presentation | top centre of the scene |
| Proposed work chips and the cool roof chip | presentation | **Upgrades** tab |
| Weather | presentation | dock: **Weather** |
| Thermal camera switch | presentation | dock: **View** (Thermal) |
| Peel slider, part list | presentation | up close screen (blocks) |
| Bills, cut override, savings figures, repairs line | money | **Savings** tab |
| Look drawer (ribbon style) | lab look pick | stays lab-only: a small button below the dock, not part of the meeting layout |

**Home tab.** Each fact is a quick tap with the existing segmented fields, and none starts open as a long form. Every field keeps its "Unknown" choice.

**Upgrades tab.** Grouped by part of the house (one group per section, today only the roof and attic), not just the zoomed section. Within a group, the chips work as today.

**Savings tab.** Owner ruling 2026-10-20: **both bills, always.** The tab asks for the electric and the gas bill whatever the weather, and shows the monthly savings on each, the repairs line, and the total. The bills are facts about the home, like the profile. This replaces today's rule that the weather picks the bill (`SAVINGS_CATEGORY_BY_WEATHER`: summer → electric, winter → gas, rain → none), so `sceneSavings` works out both categories. The cut override, disclosures and rounding keep their current behaviour per bill.

## 5. Only what does something (R48)

- **Upgrades on Today:** the tab stays usable. Picking an upgrade while on Today switches the scene to Tri Pros build, so the pick is seen at once. The tab carries a one-line hint on Today.
- **Upgrades that don't fit the home** are not offered. Today that is the cool roof chip's existing rule; the rule extends to the new upgrades in TS3b.4 (R50).
- **Savings on Today:** the bill fields stay (they are facts the rep types), and the figures area says the savings show with the Tri Pros build, with a one-tap switch to it. The weather never hides a bill (§4).
- **Dock:** the third button exists only when its season and the home's equipment allow it (§3.1).
- **Inputs never sit disabled without a reason shown.** Where an input is held back, a short line says why.

## 6. Normal weather (R49)

Owner ruling 2026-10-20: **Normal is a real, mild average day with gentle heat.** It is the default.

- It is a domain weather: `'normal'` joins `Weather` in the construction core (`src/shared/modules/construction/core/types.ts`), and every assembly that has a thermal mode in summer and winter has one in Normal too.
- It has its own working preset per climate: a mild daytime outside temperature (around the mid 70s °F, inland a little warmer than coastal), the same thermostat setting as summer, and a weaker sun than the summer peak. Heat still flows a little. Thermal, the readings and the ribbons all work, and Today vs Tri Pros build still shows a difference, only smaller than Summer or Winter. How the season-keyed code (presets, reflectance, readings, home paint, the setpoint) takes the new value is the builder's call.
- The residents act comfortable unless the gap rule (R33) says otherwise.
- The numbers are working numbers; they are tuned by hand with the other figures in TS3b.2 (R43).
- Its sky and still: a clear, soft day, distinct from the summer peak. A no-WebGL still for Normal is added beside the other three.
- The verify scripts that loop over weathers cover Normal.

## 7. Camera and artifact

- **Lower camera (R39):** raise `HOME_ORBIT.maxPolarAngle` (1.45 today, `constants/home-geometry.ts:175`) so the camera reaches nearer the horizon without going under the ground. Tune by eye on the iPad.
- **Black artifact (R57):** a black shape shows behind the home when zoomed out. Find its cause first (sky dome radius 95 in `constants/weather-skies.ts` against the orbit's max distance of 36 and the camera's far plane, fog, or the yard's edge) and fix that cause.

## 8. Devices

iPad landscape and laptop get equal care: touch targets at least 44 px, and pop-outs that never cover the Today / Tri Pros toggle. Phone and portrait keep working (the panel stacks under the scene as today), but they are not tuned.

## 9. Success

- The rep can run the whole meeting arc (§1) with the left panel collapsed.
- On every state (each weather, Today and build, whole home and up close), no visible input does nothing.
- Climate sits with the home's facts. Weather and view sit in the dock.
- Up close shows the roof's blocks in the panel, and "← Whole home" returns to the tabs.
- The camera reaches a lower angle, and no black shape shows behind the home at any zoom.
- `pnpm tsc`, `CI=1 pnpm lint` and the existing verify scripts pass. Screenshots on iPad landscape and laptop sizes, both expanded and collapsed.

## 10. Calls made in this design (for the owner to check)

- Picking an upgrade on Today switches to Tri Pros build.
- The third dock button follows the weather and the home's equipment, and is not built until TS3b.2.
- "Partial open" stays the default view until Normal exists (TS3b.3).
- Climate moves to the Home tab.
- The ribbon-style look drawer stays as a lab-only button.
- The panel's open or collapsed state is remembered for the session only.
- Only the layers and peel blocks are built now; selling points, chart, table and text come with the first section that has the owner's copy.
- The roof's readings stay as pins on the scene.
- Roof age and paint condition are new home facts that arrive with their upgrades in TS3b.4.

## 11. Left to the builder

- The exact widths of the panel (open and up close), the rail and the dock, set with `/impeccable layout`, and the motion of collapse and pop-outs.
- The block data shape (built to grow to the six types) and how a block reads the resolved scene.
- How the season-keyed code takes Normal (§6).
- Icons (lucide, as the panel uses today).
- Where the panel's open or collapsed state lives (component state or the scene store).
