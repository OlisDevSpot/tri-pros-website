# Paint wear follow-ups: stains up the gable and parapet, and a regular repaint with Cool Life as its upgrade

**Status:** approved by the owner 2026-11-02; plan `docs/superpowers/plans/2026-11-02-paint-wear-follow-ups.md`. Tracker rows R203–R205 (`docs/plans/2026-10-16-trade-scenes-epic.md`). Builds on paint wear (R121, built 2026-11-02 on `feat/trade-scenes-foundation`).

## 1. Why

The owner's first look at the paint wear build (2026-11-02) raised three things:

1. **R203.** The garage walls show no paint wear.
2. **R204.** The stains stop at the line where the house wall meets the gable or the parapet, so they look cut off. The cracks already run up there (owner: good).
3. **R205.** The only repaint is Cool Life. The rep also needs to be able to say: "You can repaint with regular water-based paint, and it'll fix the look. But the temperature stays the same: there's no energy benefit." (owner, 2026-11-02)

The repaint should work the way the roof already does. The job (the tear-off) fixes the problem, and the cool material (the cool roof) is an upgrade on top of it.

## 2. Scope

| Row | What | Where it is built |
|---|---|---|
| R203 | Paint wear on the garage | **Not here.** It is already in the 6-B design (`docs/superpowers/specs/2026-11-01-ts3b6b-garage-joins-the-house-design.md` §8). This design adds one line to that section (§5 below). |
| R204 | Stains up the gable and the parapet | Here (§3) |
| R205 | A regular repaint, with Cool Life as its upgrade | Here (§4) |

**Non-goals:**
- New paint wear kinds or levels.
- New Controls settings for the gable or the parapet.
- Changes to the ROI or pricing calculators. The pricing calculator already prices `paintType: 'coolLife' | 'water'`.
- A paint colour picker.
- Renaming the Notion scope.

**Anti-goals** (failure even if it works):
- The seam between the house wall and the gable or parapet still shows in the stains.
- Regular paint moves any temperature, arrow or energy saving.
- Switching Cool Life off leaves wear marks on the new paint.

## 3. R204: a painted surface stains all the way up to its top edge

### What the owner agreed (2026-11-02)

- **Gable** (pitched roof: the triangle above each end wall):
  - streaks running down from the gable vent and from under the rake;
  - fade blotches that carry on across the seam, as if the wall and the gable were one wall.
- **Parapet** (flat roof):
  - streaks that start right under the cap and run down across the seam onto the wall below, as one continuous streak;
  - fade blotches on the parapet face too, since it takes the most sun.
- **The top streaks move up.** The faint streaks that hang from the top of the wall today start at the true top edge instead: under the rake on a gable wall, and under the cap on a flat roof. This also fixes the paint wear hand-over note "flat-roof cap streaks start a hand-width below the cap".
- **One rule everywhere:** a painted surface wears all the way up to its top edge.

### How it works today (read from the code)

- **House walls.** `stain-boxes.ts` lays every stain against a wall's `floorY..top`, with `top` at `WALL_TOP_Y`:
  - `splashBand` (the splash band at the foot);
  - `runoffStreaks` (under each sill, plus faint ones from the eave line);
  - `sillDirt`;
  - `fadeBlotches`.

  `house-shell.tsx` draws them in groups: `stains.sides`, `sidesSplash`, `front` and `frontSplash`.
- **Gables and parapet.** These carry only cracks:
  - `gableCracks` (`lib/roof-cracks.ts`, left and right, kept under the rake through `roofUndersideY`), drawn in `gable-roof.tsx`;
  - `parapetCracks` (`kept` and `complete`), drawn in `low-slope-roof.tsx`.

  Each surface sits in its own roof fade group.

### What changes

- **New pure placement.** Add gable and parapet stain placement beside `roofCracks`, reusing the `stain-boxes.ts` functions where they fit:
  - gable streaks from the vent (`homeGableVent`) and from under the rake, using `roofUndersideY` as `gableCracks` does;
  - parapet streaks from under `PARAPET_TOP`;
  - blotches on both.

  They take the existing stain level (`PAINT_WEAR_SHARE[paint.paintWear.stains]`) and the shared seed source (`PEELING_SEEDS`' sibling in `constants/paint-wear.ts`).
- **Streaks across the seam.** A streak that runs down across the seam is two boxes, one on each side, lined up so the eye reads one streak. The wall's eave-line streaks move up to start at the gable or parapet's top edge, wherever a gable or parapet sits above that wall.
- **Drawn with the roof.** The new stains draw as `PaintStains` in `gable-roof.tsx` and `low-slope-roof.tsx`, inside the same fade groups the cracks use there. They follow every existing rule:
  - the hide group (`visible={!thermal}`, `BLUEPRINT_OMIT_TAG`);
  - the fade-sheet render order;
  - the empty stain geometry pre-compile.
- **Peeling** (Claude's call, owner to confirm). The same "wears to its top edge" rule says peeling should reach the gable and the parapet too, since `wallPeeling` also stops at the wall top today. Include it, unless it costs more draw calls than the cap below allows. If it does, leave it out and note it.

### Draw calls

- **The cap: at most +2 per home** (pitched: one per gable; flat: one per parapet fade group). This is measured the way R121 was: Failing, all three kinds Heavy, Complete, 1280 × 800, all four homes, two runs.
- **Why the cap matters.** The 6-A reference house sits at 164 with 13 left of 177, and 6-B still has to fit in that room.
- **If the cap can't hold, cut in this order** (Claude's call):
  1. Merge the new stains into the meshes already drawn in that fade group.
  2. Leave out the peeling.
  3. Leave out the gable and parapet blotches.

  Keep the streaks and their line-up across the seam, since they are what the owner saw cut off. Anything still over +2 after those cuts stops and asks.
- **The top edge** of a gable wall is the rake, which varies along the wall (`roofUndersideY`, as `gableCracks` uses), not the apex. The "stays inside the face" check tests against it.
- **The garage is left entirely to 6-B.** This build touches no garage file.

## 4. R205: the repaint puts on regular paint, and Cool Life is its upgrade

### What the owner agreed (2026-11-02)

- **One job, two paints.** The repaint is one job that fixes the worn paint. Cool Life is its efficiency upgrade option, on by default. The rep switches it off to show the plain option.
- **Either paint fixes the look.** The new paint shows no cracks, stains, peeling or fade, whichever paint goes on.
- **Only Cool Life changes heat.** With regular paint, nothing changes under Thermal: wall and room readings, arrows and load stay as they are Today, and the repaint earns no bill saving.
- **The garage follows the same rule** when 6-B lands. Only Cool Life softens the garage's heat (R146, §5).
- **The label is "Cool Life paint"**, sitting under the repaint the way "Cool roof" sits under the roof job (Claude's call, agreed).
- **The switch only shows when the paint today is regular** (Claude's call, agreed).
  - A home that already has Cool Life paint repaints with Cool Life. That fixes the look, saves no energy, and shows no switch.
  - This is R87's rule: savings come only from an inefficient material becoming an efficient one.

### How it works today (read from the code)

- **The repaint always installs Cool Life.** `scope-installs.ts:35`: `SCOPE_IDS.coolLifeRepaint` installs `{ part: 'paint', material: 'cool' }`, with no `swapsWith`.
- **The paint materials.** The exterior-wall assembly's `paint` part has `standard` (reflectance 0.25, `energyRank` 0) and `cool` (0.6, `energyRank` 1).
- **The roof's pattern** is what this design copies:
  - `swapsWith: { 'cool-roof': 'cool-shingle' }` on the install;
  - `EFFICIENCY_UPGRADE_IDS = ['cool-roof', 'r8-ducts']`;
  - `resolveAssembly` picks the swapped material when the upgrade is on;
  - `installKind` marks a lower-or-equal `energyRank` as Like for like, and `scene-savings.ts` only counts `saves-energy`;
  - the default state is `efficiencyUpgrades: ['cool-roof']`.
- **Heat** comes only from the `cool` material (`home-heat-figures.ts` `'paint'.cool`). `standard` has no entry, so it already moves nothing.
- **Colour.** `paint-look.ts:13` draws `cool` in `HOME_PALETTE.paintCool` and everything else in `HOME_PALETTE.stucco`.
- **Bill cut.** `trade-bill-cuts.ts` gives the paint trade `base: { electric: 4 }`.
- **The Controls chips** are named per system in `system-card-body.tsx` (`holdsCoolRoof`, `holdsR8`), and in `upgrade-row-state.ts` and `scene-change-slots.ts`.

### Repairs are a separate benefit (Claude's call, from the roof's precedent)

- **Fresh paint still earns the repairs figure.** `scene-savings.ts` (the repairs loop after `installKind`) credits a repairs saving for any installed part drawn by a material with `repairs: true`. `exterior-paint` has it (`home-materials.ts`). So a regular repaint of worn paint still shows a repairs figure.
- **The roof already works this way.** A regular tear-off with the cool roof off saves no energy but still earns repairs.
- **What "no saving" means here:** no energy cut. The repairs figure stays, since fresh paint avoids the repair costs worn paint brings.

### What changes

- **The upgrade id.** Add `'cool-paint'` to `EFFICIENCY_UPGRADE_IDS`, labelled "Cool Life paint" in `EFFICIENCY_UPGRADE_LABELS`.
- **What the repaint installs: two scopes, one chip** (owner, 2026-11-02, plan stress test, which supersedes the earlier `swapsWith` design).
  - **Why.** Notion already files the two paints as two scopes: "Repaint w/ Cool Life" (`coolLifeRepaint`, the bill-cutting one) and "Repaint w/ water-based" (`4020ca1b-548b-82d2-96c2-81068068e903`, in `NOT_DRAWN` today). A proposal reads the picks as they are, so the picks must always hold the true scope.
  - **What changes in the code.**
    - The water-based scope joins the scene and installs `{ part: 'paint', material: 'standard' }`. `coolLifeRepaint` keeps installing `cool`.
    - An **upgrade scope pair** (`UPGRADE_SCOPES['cool-paint'] = { plain: water-based, upgraded: Cool Life }`) lets the Cool Life paint switch pick between them.
    - The paint row offers one Repaint chip, whose scope follows the switch. Every pick, fact and switch write settles the pick.
  - **What the rep sees.** Off, the repaint is the water-based scope: Like for like, no saving, no heat change. All of that falls out of the existing machinery, since each scope installs a plain material.
- **On by default.** The default state becomes `efficiencyUpgrades: ['cool-roof', 'cool-paint']`. Here `'cool-paint'` is the rep's remembered choice, so a repick after an unpick follows it. `keepEfficiencyUpgrades` keeps it as it keeps the cool roof.
- **The bill cut** stays the paint trade's base of electric 4. It is Cool Life's cut, as the roof's 8 is the cool roof's. Add a matching comment, as the roof line has.
- **The switch.** A "Cool Life paint" chip sits on the paint row in the Controls card, the way "Cool roof" sits on the covering row, through the same `offersEfficiencyUpgrade` and `upgradeRowState` path.
  - It shows only when the existing paint is not `cool` (§4 above).
  - **On a Cool Life home the repaint is always the Cool Life scope, whatever the state holds** (Claude's call). This covers a state without `'cool-paint'`, such as a scene-change code, or after the rep switched it off on another home. The pair resolves from the existing material, not the toggle alone, so a repaint never goes down to water-based. Setting the home's paint to Cool Life after a water-based pick swaps the pick in the same write.
- **Colour: the switch never changes it** (owner, 2026-11-02).
  - Cool Life comes in colours, as the cool roof does. So colour is its own choice, the paint colour pick of R117, not what tells the two paints apart.
  - Both paints draw the same colour, and switching Cool Life on or off changes only what Thermal and the savings show.
  - Until R117 adds the pick, both draw the colour the build draws today (`HOME_PALETTE.paintCool`, `paint-look.ts:13`). `paintLook` keys the build's colour on the repaint, not on the `cool` material.
  - The colours' slightly different heat absorption is ignored for now (owner, 2026-11-02).
- **Copy and glossary.**
  - The scene copy that names the repaint (`scope-verbs.ts` `'repaint'`, scene-change words) stays neutral: "repaint".
  - The CONTEXT.md entry for **Efficiency upgrade option** lists Cool Life paint on a repaint and the upgrade scope pair (done 2026-11-02).
  - The **Bill-cutting scope** entry keeps "full Cool Life repaint". With two scopes it is literally true.
- **The Notion scopes** keep their ids and names. The scene's labels come from the app's copy, so the rep reads "Repaint" for either scope and never "Cool Life repaint" while Cool Life is off (the plan verifies this).

### The old panel

The Controls build is replacing the old scene panel. Wire the new chip only into the Controls card (`system-card-body.tsx`) and the scene-change slots (`scene-change-slots.ts`). Add it to the old panel only if the old panel is still live when this builds. This follows the owner's ruling for paint wear: "add controls for now and alter them when the controls plan lands".

## 5. R203: the garage (one line added to the 6-B design)

Add to 6-B §8:

> **The garage's gable or parapet stains and peels too**, by R204's placement, since the garage roof follows the house's form (`garage-gable-end.tsx`).
>
> Its heat effects (R146) belong to the `cool` paint material, so a regular repaint softens nothing (R205).

## 6. Constraints

- **The worktree's binding rules** (the paint wear build's handoff):
  - no DB writes;
  - no `pnpm build`;
  - never touch the dev server on :3002;
  - tsc and eslint run under the heavy lock;
  - commits go by explicit path, and `docs/**` is never staged.
- **No shared files.** No edits to `src/shared/components/scene/**`, `package.json`, `eslint` or `tsconfig` config, or `globals.css`.
- **The order** is the plan's to set with the owner. The Controls build and TS3b.4b are in flight on the same branch. R204 touches the roof components 6-B also edits.
- **Checks.** Extend `verify-trade-scene.ts`:
  - the R204 placement stays inside each gable or parapet face and under the rake or cap;
  - the streaks line up across the seam;
  - R205's pick is the water-based scope (`standard`) with Cool Life off and the Cool Life scope (`cool`) with it on;
  - R205's pick is the Cool Life scope on a home that already has Cool Life;
  - a regular repaint is Like for like and earns no saving.
- **Screens.** Shots of the gable and parapet stains at each level, light and dark, at 1280 and 390, plus Cool Life on and off under Thermal, for the owner's look.

## 7. Left to the builder

- The exact streak and blotch numbers (working numbers, tuned by eye, in `WEAR_LOOKS.paint`).
- Where the new placement code lives (beside `roof-cracks.ts`, or inside it).
- How the "no switch on a Cool Life home" rule is expressed.
- Whether peeling joins in, under the draw-call cap.

## 8. Owner rulings in this design (2026-11-02)

- **R204:** the gable and parapet stains as described in §3.
- **R205:** a regular repaint fixes the look but moves no temperature and no energy saving. Cool Life paint is its upgrade, on by default, shown only when today's paint is regular. Its label is "Cool Life paint".
- **R205's colour:** switching Cool Life on or off never changes the colour. Paint colours are R117's pick, and their heat differences are ignored for now.
- **R205's scopes (plan stress test):** the switch picks the Notion scope, Cool Life on as "Repaint w/ Cool Life" and off as "Repaint w/ water-based", so the scene's picks always hold the true scope for a proposal. The rep still sees one Repaint chip with the Cool Life paint switch.
- **Order (plan stress test):** this build lands before TS3b.4b. TS3b.4b's plan carries a re-baseline note.
