# TS3b.4a fixes: design

> **Status:** approved by the owner 2026-10-30, and stress-tested the same day (rulings folded in below). No code yet.
> **Branch:** `feat/trade-scenes-foundation` (worktree `.worktrees/trade-scenes`), on top of TS3b.4a (`82ca9f0cd`..`61a0ef3ae`, unmerged).
> **Diagnosis:** `.superpowers/sdd/2026-10-24-upgrades-that-follow-the-home/shots/diag/findings.md` (gitignored), with the probe scripts and screenshots beside it.
> **Binds:** `.superpowers/sdd/2026-10-24-upgrades-that-follow-the-home/standing-rules.md`, and `CONTEXT.md` for vocabulary.

`F` = `src/features/trade-scenes/`.

## 1. Why

The owner's look at TS3b.4a found six problems. The diagnosis traced them to five causes:

- **A.** The paint look stops at the house walls.
- **B.** The geometry has seams.
- **C.** The Current materials rows jump to two lines.
- **D.** The canvas resizes on every frame of the sidebar's slide.
- **E.** Walls and windows tell the heat story wrong.

Only C was new in TS3b.4a. The rest are older, and TS3b.4a made them visible. Each section below says what the owner ruled and what is left to the builder.

## 2. Goals, non-goals, anti-goals

**Goals**
- Paint reads as one coat over the whole house: the walls, the gables and the parapets.
- No visible seams at the wall corners, along the front wall, at the parapets, or at the flat roof's end joists.
- The Current materials rows keep their layout whether or not the list scrolls.
- Folding or unfolding the dashboard sidebar never stretches the scene, and never resizes the canvas.
- The sun's arrows never change with an upgrade. Reflecting parts show heat bouncing off their face, and what changes is how much gets inside.

**Non-goals**
- **Hiding arrows behind the structure.** This is R113 in the tracker. The owner deferred it, to be brainstormed when its turn comes. Until then, arrows on the far side of the house show through it, as window arrows already do today.
- Any change to readings, load, bill cuts or the heat figures' effect on the money story. Only the arrow flows change.
- Fixing the sidebar slide for other scenes or for the shared `SceneShell`.
- A second dev server, or a baseline run of `82ca9f0cd^`. The owner ruled the fix goes ahead without one.

**Anti-goals**
- **A second bounce mechanism.** Wall and window bounce reuse the roof's code: `bounceArrowLane`, legs, `bounce.*` figures.
- **Dropping the whole-arrow rule for bounces** (`bac7750cc`). The owner kept it: a mild day's small bounce stays hidden.
- **Smaller touch targets** on the condition dots. The 36 px targets stay.
- **Edits to the shared scene files** (`src/shared/components/scene/`). The D fix lives in `F`.

## 3. A: one paint look for walls, gables and parapets (bug 1)

**Cause.** `F/ui/components/home-kit/house-shell.tsx:92` works out the wall colour from the paint's wear and Cool Life, and passes it nowhere. The gables (`gable-roof.tsx:81,86`) and the parapets (`low-slope-roof.tsx`, `PARAPETS` and `COMPLETE_PARAPETS`) hardcode `HOME_PALETTE.stucco`.

**Ruled (owner, 2026-10-30).**
- The paint look is worked out once, from the exterior paint's material and condition, in `HomeKit` or a helper it calls.
- That one look goes to `HouseShell`, and through `HouseRoof` to `GableRoof` and `LowSlopeRoof`.
- Gables and parapets take the same colour, the same fade with wear, Cool Life, and the cracks at Worn and worse.

**Builder's call.**
- **Look shape.** The look's shape is whatever the three consumers need: a colour and a crack flag, or a small object. The gable's roughness of 0.92 joins the walls' value.
- **Crack positions.** Positions on the gable triangles and the parapet faces are hand-placed and marked as working numbers. They follow how `stuccoCracks()` places them on the walls.

**Found in the stress test (2026-10-30).**
- **Gable cracks follow the rake.** The gable is a five-sided shape, not a band: at its upper reach it is about ±2.65 m wide, while wall cracks start out to ±3.6 m. Gable cracks stay under the roof's underside at every point along the wall (`roofUndersideY`), checked by a pure assert, not only by eye.
- **The left parapet's cracks split at z = 0.** Its front half belongs to the Complete house and lifts away in Partly open, so the cracks on that half leave with it, like the front parapet's.

## 4. B: seams (bug 4)

None of these geometries changed in TS3b.4a. They used to be hidden because every piece was the same colour. Fix each one where it is built.

| Seam | Cause | Fix |
|---|---|---|
| Front corners | `FRONT_WALL` stands 3 mm proud (`home-geometry.ts:160`) of the side walls' end faces, with a 1.2 cm gap behind it. On the flat roof the front parapet stands 3 mm proud of the side parapets the same way. | Keep the 3 mm: it stops the front wall flickering against the cut face in Partly open. The side walls' outer skin wraps round to meet the front wall's outer face, so no gap shows from any angle. On the flat roof the wrap runs up to the parapet top. |
| Back corners | The side walls start at `BACK_INNER`, and the back wall's skin is `T − paintThickness` deep, which leaves a 1.2 cm slit on the outer face. | The side walls' paint runs to the back wall's outer face. |
| Front wall hairlines | `wallBoxes()` splits the wall into piers, sills and heads around each opening, and the hairlines show at the joins. | The boxes share edges exactly, so no gap or overlap shows between them. Merging them into one shape with holes is also fine. |
| Parapets | The parapet boxes have rounded edges (`radius 0.03`) and sit on square wall tops, so a groove runs all the way round. The left parapet is two rounded boxes that meet at z = 0. | Square edges where a parapet meets a wall. The left parapet is one piece in Complete, and splits only where Partly open's cut needs it to. |
| Flat roof end joists (owner: both ends, kitchen and bedroom) | Likely cause: the joist tops sit exactly on the underside of the roof deck (`attic-floor.tsx`: joist depth = `joistSpace`). Since `9ea940689` (another session, owner's bug), the kitchen's `FRONT_FASCIA` draws in both views, 3.5 cm thick with its face 1 mm inside the Complete front parapet's. The full-span joists now run about 3.3 cm into it, so their ends are buried rather than 0.5 mm behind it. Build on that position, and keep the fascia visible in both views. | **Confirm the cause first,** with a close-up of each end in both views. Check too that the fascia's top and its rounded edges meet no deck or parapet face exactly. Then move whichever face is coincident: for example, stop the joists a few mm short of the deck (a working number). If the cause turns out to be something else, report it before fixing. |

## 5. C: Current materials rows (bug 3)

**Cause.**
- The rows switch layout at `@min-[330px]`: `material-row.tsx:63`, `wear-dots.tsx:47` (twice) and `wear-header.tsx:10-12` (three times). The list's container (`materials-section.tsx:20`) is 334 px wide at 1280 and 1440.
- The panel scroller (`F/constants/panel-layout.ts:4`, `PANEL_SCROLL_CLASS`) reserves no scrollbar gutter.
- When the list scrolls, Chrome's thin scrollbar takes 10 px. The container drops to 324 px, and every row stacks at once.
- The stacked rows are taller, so the scrollbar stays even after the row closes.

**Ruled (owner, 2026-10-30).**
- **Gutter.** `PANEL_SCROLL_CLASS` reserves the scrollbar's space (`scrollbar-gutter: stable`), so the card's content is the same width whether or not it scrolls. This applies to every tab on the card. Each one loses about 10 px on desktop Chrome; touch devices are unchanged.
- **Switch point.** It is set from the widest real row title beside the 180 px of dots, measured at the steady width.
- **Phones (owner, stress test 2026-10-30).** One rule everywhere: a row goes on one line wherever its title and dots fit. A real phone has overlay scrollbars and a 324 px card, so its rows may now go on one line instead of stacking. The builder shows the owner the phone shot.

**Builder's call.**
- **If the widest title can't fit beside the dots at the steady width,** the rows stack at that width every time, which is consistent rather than random. Stop and show the owner; don't shrink the dots.
- **Verification** uses real scrollbars: launch Chromium with `ignoreDefaultArgs: ['--hide-scrollbars']`, as in `diag/b3-real.mjs`. Check 1440×760 and 1280×800 with the roof row open and closed. Phones and iPads use overlay scrollbars, so check them in touch contexts (390×844 and 1180×820), not headless desktop at that width.

## 6. D: the sidebar slide (bug 2)

**Cause.**
- The dashboard sidebar animates its width over 200 ms (`shared/components/ui/sidebar.tsx:252,265`). The stage narrows or widens on every frame of that.
- R3F's Canvas measures its parent, sets React state, and resizes the drawing buffer one frame later. So each frame paints the previous frame stretched, then redraws the whole scene at the new size.
- Per frame, the stage measure (`F/hooks/use-stage-size.ts`) also re-renders the dock, the build switch (whose fit check came with `0de1b737d`) and both camera rigs.
- We measured 13 drawn frames during one collapse.

**Ruled (owner, 2026-10-30).**
- **No baseline.** The baseline comparison is skipped; fix the cause.
- **A wider wrapper.** The canvas and its pin layers sit in one wrapper as wide as the window, pinned to the stage's right edge, with the stage's `overflow-hidden` clipping it.
- **The sidebar as a cover.** The camera's visible area treats the hidden strip under the sidebar (the wrapper's width minus the stage's) as one more left cover. The card's and the dock's placement stay in stage coordinates.
- **The canvas resizes only when the window does.** During the slide the house glides to its new framing on the camera's existing tween. Nothing stretches.
- The pins stay correct without touching `src/shared/components/scene/`. `ScenePinsProjector` places pins in canvas pixels inside their own container, so the pin layer and the canvas share the wrapper.

**Costs (accepted).** With the sidebar open, the canvas also draws the strip under it, about 18% more pixels at 1440 wide.

**Builder's call.**
- **How the wrapper gets the window's width:** `100vw`, `100dvw`, or a measured width.
- **How the extra cover enters `sceneVisibleAreaFor`.** Keep the card's layout reading the stage's own area.
- **Cutting the per-frame re-renders** of the dock and the build switch during the slide is welcome, but not required.

**Constraint.** The camera slide plan (`docs/superpowers/plans/2026-10-28-scene-camera-slide.md`) also touches the camera rig and the visible area. Read it first, and keep the two from colliding.

**Found in the stress test (2026-10-30).** The home's framing (`homeFramingFor`) is picked from the canvas's shape. Once the canvas is wider than the stage, it reads the stage's shape instead, so the framing a rep sees with the sidebar open doesn't change.

**Verification.**
- **Measured before and after on :3002,** with the same probe as `diag/b2-gl.mjs`. During a collapse and an expand, the canvas's drawing buffer resizes 0 times. Frames drawn and React renders per toggle are reported.
- **Screenshots mid-slide** show no stretch.
- Headless WebGL runs on the CPU, so frame times are not evidence. The owner judges the feel in a real browser.

## 7. E: heat for walls and windows (bugs 5 and 6)

**Cause.**
- Roof lanes are drawn in legs: the sun's flow reaches the covering, some of it bounces off, and only the rest goes on inside.
- Walls and windows are one lane each (`F/lib/home-heat-lanes.ts`), and the part you pick cuts that whole lane's flow (`F/lib/heat-lane-flows.ts`). Double pane multiplies `flows.window` by 0.45, and Cool Life takes `flows.wall × (1 − bounce.wall)`. So the sun's own arrow shrinks.
- Cool Life's bounce on an inland summer day is about 0.9 of an arrow. The whole-arrow rule hides it, so it never draws. Windows have no bounce at all.

**Ruled (owner, 2026-10-30).**
1. **The sun's arrows never change.** A wall or window lane's outside leg carries the climate's and the weather's flow. The part you pick never changes it.
2. **Bounce comes off the face** in summer, through the roof's `bounceArrowLane` and the whole-arrow rule.
   - Add `bounce.window` to the heat model, the way `bounce.wall` works.
   - Cool Life's summer `bounce.wall` goes from 0.35 to 0.5. Double pane gets a summer `bounce.window` of 0.31. Both are working numbers, set so each clears one arrow on a summer day in both climates; the coast's weaker sun is the binding case (coastal summer wall 0.4 × 0.5 = 0.2, window 0.65 × 0.31 ≈ 0.2).
   - The Normal-weather figures may stay hidden under the rule, the same as the cool roof today.
3. **The inside leg** carries what gets through, and shows in Partly open.
   - Double pane: its pass-through is tuned so the inside arrows match today's count (inland summer 2).
   - Cool Life: with half the wall's sun bounced, its inside arrows drop to 1 inland in summer, against 3 for existing paint (owner, 2026-10-30, accepted for a bounce that shows on the coast).
   - Readings don't change.
4. **Every window shows its bounce** when the windows are replaced, so the envelope reads as protective. This covers the 7 window lanes in Complete and the 5 in Partly open.
5. **Paint arrows run on every wall,** laid out the way windows are, instead of only the one sunny side wall.
   - Complete: the back, left, right and front walls.
   - Partly open: the back, left and right walls. The front wall is cut away.

**Expected arrows, inland summer**

| | Sun (outside leg) | Bounce | Inside (Partly open) |
|---|---|---|---|
| Existing windows | 4 | 0 | 4 |
| Double pane | 4 | 1 | 2 |
| Existing paint (per wall lane) | 3 | 0 | 3 |
| Cool Life | 3 | 1 | 1 |

On the coast in summer, double pane and Cool Life each show one bounce arrow too.

**Model (builder's call, following the roof).**
- **Separate the sun's flow from the part's effect,** the way `roofSource` and `roofPasses` do:
  - The starting heat keeps `wall` and `window` as the sun's flow.
  - The parts' effects become pass-through factors (say `wallPasses` and `windowPasses`) plus `bounce.*`.
  - `heatLaneFlows` returns, for each of walls and windows, the source, the bounce (`source × bounce`) and the through (`source × (1 − bounce) × passes`).
- **Winter mirrors the roof:** the room's flow is the inside leg, and what escapes is the outside leg. There's no bounce.
- **Leg geometry:**
  - Complete keeps outside → face.
  - Partly open becomes outside → face → inside, with the bounce leaving from the face.
  - The window face is the glass's wall face, plus `LANE_STANDOFF`.
- **Each wall's bounce direction** is outward and up from that wall: the left wall's `WALL_BOUNCE` turned to each wall's outward side. These are working numbers, tuned by eye.
- **Lane placement.** One or two lanes per wall, clear of the windows and the front door. The sunny wall keeps its two. Working numbers, tuned by eye at the owner's review.
- **Leg length (stress test 2026-10-30).** At the existing 0.9 m reach a window's 4 arrows would sit 0.19 m apart on the new outside leg, under the 0.275 m spacing floor. The Partly-open lanes reach 1.3 m out and in (a working number), so every leg keeps its arrows apart.
- **Readings, load and the bill don't change.** Only `flows` and `bounce` move. Check `home-heat.test`, or whatever covers `homeHeat`, still passes for readings and load.

**Verification.**
- A pure check of the counts above, like `diag/b5-arrows.ts`, for inland and coastal in summer, Normal and winter.
- Screenshots in Thermal at inland summer: existing home, double pane, Cool Life, and both together, in Complete and Partly open, on both roof forms.

## 8. Constraints that apply to every section

- Standing rules (`standing-rules.md`) apply in full:
  - No subagents.
  - Copy only in `F/constants/home-scene-copy.ts`.
  - One component per file.
  - No three.js in `lib/` or `constants/`.
  - Hand-tuned figures marked as working numbers.
  - Comments say why, never what.
- **Server and database:**
  - Never `pnpm build`, and never start or stop a dev server. :3002 is the owner's.
  - No database writes.
  - Sign in only with `as=`, never `role=`.
- **Shared files:**
  - Don't touch `src/shared/components/scene/`, `src/features/meeting-visualizations/`, or the roof-cutaway files.
  - Don't touch any shared file this spec doesn't name without asking first. `src/app/(frontend)/globals.css` is not named; the gutter goes in `PANEL_SCROLL_CLASS`.
- Other sessions edit trade-scene files in this tree. Commit by explicit path only, and never touch their hunks.
- `pnpm tsc` and `pnpm lint` are clean before each commit.

## 9. Order

Every step below ends with screenshots the builder has read.

1. **C**: the smallest step, and it unblocks the owner's panel testing.
2. **A**: the paint look.
3. **B**: the seams. A goes first because matching colours change which seams still show.
4. **E**: the heat model and its lanes.
5. **D**: the sidebar slide, last, because it shares the visible area with the camera slide work.

**Against the attic plan (owner, stress test 2026-10-30).** These fixes land first. The attic plan (`2026-10-30-attic-ventilated-and-sealed.md`) rewrites the same starting heat, `applied()`, `homeHeat`, `homeHeatLanes` and arrow checks, so it is amended to build on the wall and window legs here and to capture its lane snapshot after them. Its gable vent must also keep clear of the gable cracks.

## 10. Calls made in this spec (for the owner to check)

- **Steady width:** the gutter lives in `PANEL_SCROLL_CLASS`, not in `globals.css`.
- **Inside counts:** windows keep today's inside counts. Only the outside and bounce legs are new for them.
- **Winter** mirrors the roof: no bounce, and the outside leg shows what escapes.
- **Normal weather:** the bounce may stay hidden under the whole-arrow rule.
- **Lanes:** one or two per wall, placed by eye.
- **Bounce direction:** each wall's bounce is turned to face outward from that wall.
- **End joists:** the cause is confirmed before the fix. If it's not the deck contact, the builder reports back first.
- **Front wall hairlines (stress test):** cut the wall boxes at every opening's edges so no T-junction remains, keeping the boxes, thermal groups and fades as they are. An extruded shape with holes is the fallback only if the close-ups show that isn't enough.
- **Open lane reach (stress test):** 1.3 m out and in, so the new legs keep the arrow spacing floor.
