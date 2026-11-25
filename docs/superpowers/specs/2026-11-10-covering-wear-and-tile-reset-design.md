# Covering wear and the tile reset: design

Status: approved by the owner 2026-11-10 ("looks good for now"); amended at the plan's stress test 2026-11-11. Tracker: `docs/plans/2026-10-16-trade-scenes-epic.md` (R293–R296).

## 1. Why

A tile reset takes the homeowner's own tiles off, lays new waterproofing, and puts the same tiles back: crooked ones set straight, broken ones replaced, the years of dirt cleaned off. When the rep flips from Today to Build, the homeowner should see **the same roof, but much nicer** (owner, 2026-11-09).

The scene gets this wrong today. `SCOPE_INSTALLS` lists the reset's covering as an install, and `resolveAssembly` marks every install `condition: 'installed'` and drops its wear, so `partState` returns wear 0 and the roof draws as brand-new tile. The old side is also too tidy to improve on: about 4% of tiles at Worn are missing, about 4% tilt, and every other tile is perfectly straight and clean.

Paint already solves the general problem of a material whose wear comes in several kinds, each with its own amount. The roof covering takes the same shape.

## 2. Goals

1. Every old roof covering shows its own kinds of wear, each with an amount the rep can set.
2. Old roofs carry real-looking dirt, which the build cleans off.
3. A tile reset draws the same tiles, in the same places and the same weathered colour: clean, straight, with the cracked and broken ones replaced.

## 3. Non-goals

- Leaves, needles, dark streaks, lichen and white mineral bloom. The owner picked settled dust only, "for now". Studies: https://claude.ai/artifact/3WxprrrthiFkxPN7xiSnoR (option A).
- Any change to savings, heat, water or leak figures. Covering wear is drawing only, like paint wear.
- A new tile colour for the reset as a whole.
- Colour picking, TS4 (the home on file) and the TS3b.6-C textures work.
- The garage roof. It keeps its one plain colour until the planned garage work matches its materials to the house's (owner, 2026-11-10).
- Blisters and Open seams on flat roofs. The scene draws neither today, so they wait until a look is picked (Claude's call, flagged to the owner).
- Metal roofs. They are not modelled (R14), so they get no wear controls and keep drawing as the nearest covering, at shingle's starting amounts (Claude's call). A level the rep set on another roof type never draws on metal.

## 4. Anti-goals

- **Dirt that looks like a grey film painted over the roof.** This is the owner's named failure. A build that meets every other line here and has this look has failed.
- A reset roof so perfect it reads as a new roof.
- Replacement tiles that read as a patchwork.

## 5. Covering wear

"Covering wear" is a proposed name, added to `CONTEXT.md` once agreed, written like the **Paint wear** entry.

Each covering has its own kinds (owner, 2026-11-09):

| Covering | Kinds |
|---|---|
| Tile | Dirt, Cracked, Misaligned, Broken |
| Shingle | Dirt, Missing, Curling |
| Wood shake | Dirt, Split, Curling |
| Membrane (flat roof) | Dirt |

The dark patches a flat roof shows from Worn stay tied to Condition (`low-slope-roof.tsx`).

Same behaviour as paint wear (`paintWearInForce`, `PaintWearFields`):

- Amounts are None, Light, Moderate, Heavy. Moderate is the Worn look and Heavy the Failing look (`PAINT_WEAR_SHARE`).
- The covering's Condition sets a starting amount for each kind. A level the rep sets wins and survives a Condition change. Back to the era guess clears the rep's levels.
- A New covering shows none of it.
- The controls sit in the roof's Condition card, in `existing-chip.tsx` beside where `PaintWearFields` renders for paint.
- The rep's levels are a drawing-only fact on `HomeMaterialFacts`, beside `paintWear`, so they are saved with the rest of the Today inputs when Builds are stored (R264).

Starting amounts (Claude's call, following paint's shape; the owner's eye may move them):

| Condition | Dirt | Cracked / Curling / Split | Misaligned | Broken / Missing |
|---|---|---|---|---|
| New | None | None | None | None |
| Good | Light | None | None | None |
| Fair | Light | Light | Light | None |
| Worn | Moderate | Moderate | Moderate | Moderate (shingle Missing), Light (tile Broken) |
| Failing | Heavy | Heavy | Heavy | Heavy (shingle Missing), Moderate (tile Broken) |

**Wood shake is never better than Worn** (owner, 2026-11-11, R296): wood shakes have been against code for decades, so none is new. Condition offers only Worn and Failing on a wood shake roof, and an unrated one guesses Failing whatever the home's age. The Good and Fair rows above never apply to it.

Each level moves only its own kind: changing one never moves, adds or re-shades a piece another level placed.

Shingle Missing at Moderate must keep today's amount (5% of tabs), though the gaps fall in different tabs, since each level now draws its own rolls. Those gaps were the original complaint, and the darkened `feltAged` (`#3b3530`, approved by the owner 2026-11-10 and still uncommitted) is what makes them read. Shingle Curling is today's lifted tabs. Wood shake's curl keeps its current look at Moderate. Its split exists in the layout but no course switches it on today, so this work switches it on.

Condition keeps driving what it drives now: the covering's colour, roughness and tile-to-tile shade.

## 6. What each kind looks like

**Dirt.** Settled tan grit (studies option A):
- Tile: in the channels (the pans), heaviest just above where each tile laps the next. The raised caps stay cleaner because rain rinses them, with a faint trace on the shaded side.
- It varies across the roof in soft, large patches, so no two areas match and no repeat shows.
- Claude's call, accepted in playback: shingle and wood shake collect it along the bottom edge of each course and more toward the eaves; a flat roof collects it in soft patches where water would sit.

**Cracked.** A tile still in place with a visible crack.

**Misaligned.** Tiles visibly out of line and some slipped out of place, across the whole roof, not 4% of it. Scales with the amount.

**Broken.** Now and then a tile with a piece missing. It replaces today's whole gaps on tile, which become rare or go away.

Curling starts from how the scene already draws it, Split from the two-halves drawing already in the shake layout.

## 7. The tile reset

Construction module:

- The reset's covering install is marked as a reuse, in `TILE_ROOF`: `{ part: 'covering', material: 'tile', reuses: true }`.
- `resolveAssembly` keeps it `condition: 'installed'`, keeps the existing part's `wear`, and adds `reused: true` to the `ResolvedPart` (code says `reused`, never `reset`: the not-drawn "Tile roof reset (repair)" scope is a different job). Staying `installed` means the part list, savings (`scene-savings.ts`), offers and water flow need no change, and the existing card copy ("Tile lifted, sorted and reset over a new waterproof layer") stays.
- `partState` reads the kept wear for a reset part, so the weathered colour follows.

Drawing, from the covering wear in force on Today's side:

| On the old roof | After the reset |
|---|---|
| Dirt at any amount | Gone |
| Misaligned tiles | Straight and lined up |
| Cracked and Broken tiles | Whole replacement tiles, a little fresher than the tiles around them |
| Every other tile | Same place, same tile-to-tile shade, same weathered colour |

The two sides are drawn from the same seed so each tile stays where it was. More Cracked or Broken on Today means more replacements in the Build.

The new underlayment, ice-and-water membrane and drip edge are unchanged, except that the drip edge and the garage roof take their colour from the roof's, as they do today, so after a reset they follow the weathered tile tone (Claude's call, on the owner's look list).

Every other install of a covering (tear-off, overlay, torch down) draws a new covering with no wear, as it does now. A scope that leaves the covering alone (a redeck on its own) leaves its wear and dirt alone.

## 8. Constraints

- iPad budget. Coverings are one instanced draw per course type (`InstancedPieces`), and that is what keeps the frame rate. Dirt must not add a draw call per tile or draw specks as separate objects; it belongs in the tile's own drawing. A reset may add replacement tiles as their own list per course (at most one extra draw per course per slope part, on a tile reset only). Cracked and Broken may add one merged marks mesh per slope, on the pattern paint's `TintedMarks` uses, which already handles Thermal (Claude's call).
- Follow the scene's fade and lens rules: dirt and replacements must behave under the Thermal lens, ghosting up close, and the blueprint load as the covering does. In code, Thermal swaps the covering's material (no dirt or cracks, broken tiles whole), while ghosting fades the covering's own material (the dirt fades with it).
- Tuned by eye on the real 3D roof, from the whole-home view and up close. Dirt must read from the whole-home view. Never sweep the scene in a software-rendered browser (it crashed the machine); the owner looks at it on the running page.
- `meeting-visualizations` has its own separate `layoutTiles` and is out of scope.

## 9. Left to the builder

How the dirt is drawn inside that budget; the geometry of a crack and a broken corner; the exact misalignment numbers; how fresh a replacement tile is; whether the None-to-Heavy levels and the card field are shared with paint by renaming or reused as they are. Numbers are working numbers, set by eye and marked so, the way `WEAR_LOOKS` marks them.

## 10. Order

Its own row in the tracker. It builds **after Gutters** (R284): both edit the same roof files, and Gutters was already building in this worktree (owner, 2026-11-11, reversing the first order, which put this ahead). The white-balance fix (R285, Gutters Task 1, committed `e0deb98da`) is in, so the dirt is tuned under that light.
