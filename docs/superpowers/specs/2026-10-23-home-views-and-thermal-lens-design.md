# The home, its views and the thermal lens (TS3b.3): design

**Tracker:** `docs/plans/2026-10-16-trade-scenes-epic.md`, §2 row TS3b.3, requirements R38, R40, R69, R72–R76 and R34 (the rafters only).
**Branch:** `feat/trade-scenes-foundation` (worktree `.worktrees/trade-scenes`), on top of TS3b.2 and its fix round (head `b5166b749`). Lab page `/dashboard/labs/trade-scene`.
**Status:** written 2026-10-23 from the owner's brainstorm; approved by the owner 2026-10-23.

Marks used below: *(owner)* is the owner's decision; *(Claude's call)* is a decision made while writing, for the owner to check; anything unmarked follows directly from the code or an owner ruling already in the tracker.

---

## 1. Intent

The Home scene is shown in the homeowner's living room. Today it opens on a cut-open dollhouse: no front wall, half the near roof slope gone, the ceiling cut back. It reads as a diagram from the first second.

The owner wants the meeting to ease in. The house first appears whole and believable, the way the homeowner's own home looks from the street, in a mild Normal day with no thermal colour. The homeowner gets their bearings while the rep explains that Tri Pros built this program. Then the rep reveals more, one step at a time: opening the house to show its layers, previewing the upgrades (Today / Tri Pros build), then putting on the thermal camera as the conversation gets there *(owner, R73)*.

So this project gives the scene two separate controls *(owner, R72)*:

- **Home view**: how much of the house is drawn. **Complete** (the default) or **Partly open** (today's cutaway).
- **Lens**: what the home is looked at through, on top of either home view. Today there is one, **Thermal**, switched on and off.

It also draws the foundation the way it is built (R38, R75), and fixes the rafters that poke through the roof (R34).

The terms *home view* and *lens* are in `CONTEXT.md` (agreed 2026-10-23). "Complete" replaces the owner's first word "Normal", which is already the mild-day weather. "Mode" is avoided because it is taken twice: the proposal pages' customer / agent view mode, and an assembly's heat or water mode.

## 2. Goals, non-goals, anti-goals

**Goals**

1. A **Complete** home: every wall closed, a front door, windows on every side, and a roof covering the whole structure, on both roof forms (gable and low-slope). It is the default *(owner, R69)*.
2. **Partly open** stays exactly today's cut-open house, plus the crawl space opened on a raised foundation *(owner, R75)*.
3. A **Thermal lens** that works on both home views. On the Complete home it still tells the inside story (§3.3) *(owner, R74)*.
4. The **foundation drawn as built**: a raised home sits up on foundation walls with steps to the front door; a slab home sits low with its door nearly at ground level *(owner, R38, R75)*.
5. **Smooth transitions always**: opening and closing the house, and switching the foundation, move instead of snapping *(owner, R73, R76)*.
6. **No rafter pokes through the roof covering** in any home view, roof form or peel state (R34).

**Non-goals**

- **The X-ray lens.** Named on 2026-10-23, then deferred by the owner: keep it simple; Partly open is how we glance inside.
- **A richer, more detailed Southern California home, lot and surroundings.** The owner wants one, in its own modeling plan later (R69). This project closes up today's house at roughly today's level of detail.
- **The storm weather and home stress** (R70, R71, proposed TS3b.7).
- **The upgrades that follow the home** (TS3b.4): windows, cool paint, worn parts, the era template. **Crawl space insulation** is a future upgrade; this project only makes the joists it would sit between visible.
- **Tap a part, jump into any section** (TS3b.5). Up close stays the roof's one zoom.
- Thermal in Rain painting the home with no readings (the open issue from TS3b.1) is not this project's to fix, unless the builder finds it falls out of the lens change for free.

**Anti-goals** (would make this a failure even if it works)

- A switch that jitters, pops or flashes. A plain cut is acceptable only where a transition would be too complex to build (R73), and the builder must say where they took that fallback.
- A Complete home that still reads as a diagram (exposed framing, open edges, a missing wall face).
- Readings or arrows drifting off the surfaces they belong to when the foundation changes the house's height.
- The camera moving when the home view changes. The house opens in front of the homeowner; the view stays put (R76).
- Heat arrows drawn through a closed wall or roof on the Complete home (§3.3).

## 3. What the rep and the homeowner see

### 3.1 The meeting arc (R73)

1. The scene opens on Normal weather, the Complete home, no lens. Today's defaults already have Normal weather and the thermal camera off; the change is the home view.
2. The rep switches to Partly open: the house opens up (§3.4).
3. The rep previews the upgrades with Today / Tri Pros build, in either home view.
4. The rep puts on the Thermal lens, in either home view.

The rep drives every switch from the dock's **View** pop-out, which today holds the Partial open / Thermal picker (`ViewModePicker`). It becomes two controls *(Claude's call)*: a **Home view** segmented field (Complete / Partly open) and a **Thermal** on/off switch with today's hint line. Both stay one tap away; the homeowner never has to find a control.

### 3.2 The Complete home (R69)

- **Walls:** the front wall (+z, facing the camera) is added, so all four walls are closed. It carries a **front door** at the end of the existing front walk (`YARD.walk`, x ≈ −0.6) and windows *(Claude's call: one or two windows into the living rooms, placed so the opening camera reads the facade as a home; the builder picks the openings)*.
- **Roof:** the near slope covers the whole length of the house, not only beyond the cut. On the low-slope form the membrane, parapet and coping run all the way round.
- **Ceiling and attic floor:** whole, not cut back to `HOUSE.atticFrontZ`. They are hidden by the closed roof anyway, but they must be whole so nothing reads as cut when the house opens and closes.
- **Foundation:** see §3.5.
- **Inside:** the rooms, furniture and residents keep drawing (they show the moment the house opens). Whether to skip drawing them while fully closed, for performance, is left to the builder.

### 3.3 The Thermal lens on the Complete home (R74, proposed by Claude, approved by the owner)

- **The shell shows what a camera in the yard sees** *(owner, 2026-10-23: keep it honest)*. The closed shell takes the thermal colours from today's figures, unchanged: the roof from its reading, sunlit walls from the exterior-wall reading, shaded walls from outside air (`lib/home-paint-temperatures.ts`). So the sun shows on the roof and the sunny walls, and on a winter night the windows glow; the roof does not, since it reads colder than the air. Attic insulation does not change the closed shell's colours: on the closed house its story is told by the attic and ceiling numbers, and in colour on Partly open. No heat figure changes in this project. The new front wall, door and foundation walls take thermal paint like the existing walls (sunlit or shaded, `thermalTag`).
- **All five readings stay on screen.** Roof, exterior wall and window glass keep their callout with a solid dot on the surface they measure (as built in `b5166b749`). Attic and ceiling become callouts too, with a **hollow ring** instead of a dot. The ring sits on the shell in front of the spot inside where each is read, as seen from the opening camera, meaning "inside, behind this" *(Claude's call: the ring's shell points are working numbers tuned by screenshot, like the other callout values)*.
- **Arrows show only outside.** The sun's arrows onto the roof and the arrows striking the walls and windows show, right up to the surface they strike. Their path inside is hidden by the closed shell. Today the arrows draw with `depthTest: false` (`heat-arrows.tsx`), so they show through everything; the builder chooses how to hide the inside path (for example, dropping each lane's inside legs while the home is closed, or depth-testing against the shell), as long as no arrow draws through a closed wall or roof and the outside arrows still read as clearly as they do now.
- **The sun's roof arrows land on the near slope** *(Claude's call)*. Today's roof lanes (`home-heat-lanes.ts`) strike the back slope at z −0.8, which the cut lets the camera see; from both opening framings that spot sits just below the ridge line, out of sight on a closed roof. So the Complete home gets its own roof lanes striking the near slope, with their covering and barrier bounces leaving from there, and the opening and closing transition fades one set out as the other comes in. Partly open keeps today's lanes. The §6 lane checks cover both sets.
- **On Partly open** the arrows keep today's material, drawing through everything *(owner, 2026-10-23)*; hiding arrows behind surfaces is for the Complete home only. The back windows' arrows drawing over the roof on Partly open stay an open item in the tracker. Otherwise the lens works as it does today, with one change *(Claude's call)*: the attic and ceiling readings also become callouts, with solid dots, carrying the callout standard (owner ruling, tracker §6 2026-10-22) to every reading. Their offsets are tuned by screenshot so nothing crowds; the "Inside the roof" pin is not a reading and keeps its own look.

### 3.4 Opening and closing the house (R76, proposed by Claude, approved by the owner)

- **Complete → Partly open:** the camera stays still. The pieces Partly open cuts away are the front wall (with its door and windows), the part of the near roof slope over the open rooms, the front of the ceiling and attic floor, and the front of the foundation wall. They **lift a little and fade out over about a second**. Then the rooms, the attic and the crawl space are in view.
- **Partly open → Complete:** the same move backwards; the pieces drift back into place and turn solid.
- **Readings and arrows fade with their surfaces.** The attic and ceiling rings turn into solid dots as their spots come into view, and back.
- **Up close:** tapping "Inside the roof" from the Complete home opens the house as the camera glides in, since the roof's section sits at the cut. Backing out returns to the home view the rep was in, Complete or Partly open. The home view input itself does not change on the way in *(Claude's call: up close draws the house open whatever the home view, so the rep's choice survives the round trip)*.
- The scene renders on demand (`frameloop="demand"`), so the transition must keep frames coming while it runs and stop when it settles.

### 3.5 The foundation (R38, R75)

- **Raised, Complete:** the house sits up on foundation walls around the crawl space, with its crawl vents (today's `SKIRT` and `VENTS`, plus the front wall the cut leaves off today). **Steps** lead up to the front door.
- **Raised, Partly open:** the cut also opens the crawl space, so the floor joists and girders under the house show (today's `FLOOR_FRAMING`, `PIERS`, `CRAWL_GROUND`).
- **Slab:** the house sits low, its front door nearly at ground level on the slab, no steps. Unknown still draws as slab.
- **Heights.** Today both foundations put the floor at the same height (`HOUSE.floorY` 0.45 m, "so every anchor stays put"), which leaves a slab house standing on a 0.42 m concrete block. That breaks R38. *(Claude's call:)* the floor sits about 0.15 m above grade on a slab and about 0.75 m on a raised foundation (roughly the 18 in crawl clearance under the joists that California's residential code asks for, plus the framing), and a raised home gets as many steps as that rise needs at a comfortable riser height. The builder may tune both heights by eye.
- **Everything that sits on the house rides with it.** Readings, arrow lanes, the roof anchor, the zoom framing and the up-close kit must land on the same spots of the house on either foundation. *(Claude's call:)* the house and everything anchored to it move as one, for example by lifting the house as a group, instead of every constant learning two heights; the builder picks the mechanism. The yard, sky, condenser pad and camera framings stay where they are.
- **Switching** raised ↔ slab, the house rises or settles smoothly while the steps and the foundation walls grow or fold away (R38 asks for a smooth switch).

### 3.6 The rafters (R34)

The owner reported the house rafters clipping through the roof. No rafter, ridge board or fascia may show through the covering, on either roof form, in either home view, at any peel. Finding the cause is the builder's; verify it by screenshot close to the roof.

## 4. What changes in the code (orientation, not a plan)

- **Inputs:** `TradeSceneInputs` gains the home view (`'complete' | 'partly-open'`, default `'complete'`); the `thermalCamera` boolean stays as the Thermal lens. `VIEW_MODES`, `ViewMode`, `viewModeOf`, `VIEW_MODE_ICONS` and `DOCK_COPY.viewModes` give way to the home view's own constant, copy and icons. The home view changes no resolved target, so like the thermal camera it stays out of `SceneResolveInputs`.
- **Home kit:** `HouseShell` gains the front wall, door and its windows; `HouseRoof` / `GableRoof` / `LowSlopeRoof` gain the near slope's open part; `AtticFloor` and the ceiling gain their front; `Foundation` gains the front skirt, the steps and its two heights. The pieces Partly open removes are grouped so they can be faded and lifted together; the existing ghost machinery (`ui/lib/apply-ghost.ts`) already fades a group's materials and may serve.
- **Readings and callouts:** `READING_CALLOUTS` gains the attic and ceiling, and a reading's dot can be hollow; the ring's shell points join `READING_ANCHORS`.
- **Copy:** dock labels for Home view, Complete, Partly open and Thermal live in `home-scene-copy.ts`.
- **Glossary:** `CONTEXT.md` already has *home view* and *lens*; the "View mode" entry is gone. Code names follow the glossary.

## 5. Constraints

- Stack and rules as for TS3b.1 and TS3b.2: three.js via @react-three/fiber with `frameloop="demand"`, Tailwind v4, zustand scene store; comments say why, never what; one component per file; constants in `constants/`, pure helpers in `lib/`, three.js helpers in `ui/lib/`.
- `scripts/verify-trade-scene.ts` guards the pure tier; it must keep passing and gain the checks in §6.
- Verification is `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsc` and `CI=1 pnpm eslint scripts/verify-trade-scene.ts src/features/trade-scenes src/shared/components/scene`. Never `pnpm build`.
- Screenshot rounds run as subagents against the owner's dev server on :3002, which is never started, stopped or restarted.
- `src/shared/components/scene/` is shared with other scenes; change it only where the scene primitives truly need it, and say so in the plan.
- Never mention solar anywhere.
- Another session may be editing trade-scenes UI files in parallel (owner, 2026-10-22): never revert changes you did not make; commit by explicit path only.
- No performance regression the homeowner could feel on an iPad: the closed house adds geometry, so the builder checks frame time on the opening view before and after.

## 6. How we know it works

- **Pure checks** in `verify-trade-scene.ts`: the default home view is Complete; every reading has a callout; on both foundations every reading anchor, the roof anchor and the arrow lanes sit at the same height above the house's floor; the raised floor is higher than the slab floor; the home view is not among the resolve inputs.
- **Screenshots** at 1280×800 and 1024×768 (panel open) and one at 1440×900 (panel hidden), light scheme, plus one dark:
  - Complete, Normal, no lens, gable and low-slope, slab and raised: a whole house, a front door, steps only on raised, no exposed framing, no rafter through the roof.
  - Complete with Thermal, inland summer Today and Tri Pros build, and coastal winter: the shell's colours, five readings with the attic and ceiling rings, the roof arrows landing on the near slope, no arrow through a closed surface.
  - Partly open with Thermal: today's look, crawl space joists on raised, all five readings as callouts with no overlaps.
  - The open and close transition, and the raised ↔ slab switch, captured as a few frames mid-move to show no pop.
  - Up close from Complete and back: the house opens on the way in and returns closed.
- **By eye:** the owner judges the transitions and the Complete home's first impression on the lab page.

## 7. Calls for the owner to check

1. The dock's View pop-out holds a Home view field and a Thermal switch (§3.1).
2. The front wall's windows and the door's exact place (§3.2).
3. The hollow-ring callouts for attic and ceiling on the Complete home, and solid-dot callouts for them on Partly open (§3.3).
4. Up close always draws the house open, leaving the rep's home view unchanged (§3.4).
5. Floor heights of about 0.15 m on slab and 0.75 m raised, and the house moving as one with everything anchored to it (§3.5).
6. The Complete home's own roof arrows striking the near slope, cross-fading with today's lanes as the house opens (§3.3).

## 8. Left to the builder

- How the inside path of the arrows is hidden on the Complete home (§3.3).
- The fade and lift mechanism, the easing and the exact timing around one second (§3.4).
- How the house and its anchors move with the foundation (§3.5).
- The rafter fix (§3.6).
- Whether the inside of a fully closed house is drawn at all.
- All working numbers (callout offsets, ring points, heights, step counts), tuned by screenshot.
