# Handoff: a real-world home layout, roof and foundation, with the HVAC unit placed in it

**Written:** 2026-11-15, at `6694853ba` on `feat/trade-scenes-foundation` (heating & cooling plan Tasks 0–11 plus the owner's first corrections built; the heat pump task and the final review still to come).
**For:** a fresh session that starts with a brainstorm with the owner. Nothing here is designed yet.
**Your job:** turn the scene's house into a believable Southern California home inside: a hallway, a hall bathroom, bedrooms, a living room and a kitchen, under a roof and on a foundation built the way they are really framed. Then place the heating & cooling indoor unit in it the way an installer would: lying flat in the attic, or standing upright in a hallway HVAC closet, with both sharing one plenum spot in the attic.

## 0. Gates

1. **Brainstorm first** (superpowers:brainstorming), then spec, stress-test (`/stress-test-plan`), plan. The owner must say "build", "execute" or "run" before a plan executes ("go ahead" is not a build call).
2. **This reopens an owner ruling.** R207 (2026-11-02, tracker `docs/plans/2026-10-16-trade-scenes-epic.md`): "Rooms stay plausible stand-ins; the outline, stories and garage must be right. No data source has floor plans." On 2026-11-15 the owner asked for a more realistic layout (hallway, bathroom, bedrooms, living room). Settle with the owner what replaces R207 before designing, and record it as a new R-row.
3. **Where it builds is the owner's call.** The Layout epic (spec `docs/superpowers/specs/2026-11-02-scene-layout-design.md`, phases L1–L5) already owns the house's shape: L3 = masses (L/T footprints, attached garage, gable/hip/flat per mass), L4 = two stories (kitchen and living downstairs, bedrooms upstairs, R213). L1+L2 (the lot as data) and Property facts + Areas are built on `feat/scene-layout-lab` (`.worktrees/scene-layout-lab`), unmerged. An interior floor plan is either L3's interior or its own phase after it. Ask; don't assume. Don't build on `feat/trade-scenes-foundation` while the heating & cooling build is running there (its ledger: `.superpowers/sdd/2026-11-13-heating-and-cooling-system/progress.md`).
4. **The garage plan** (`docs/superpowers/plans/2026-11-01-ts3b6b-garage-joins-the-house.md`, TS3b.6-B) waits on L3 (R211) and carries the upright garage indoor unit (R299). The new layout must leave room for that.

## 1. What the owner said (2026-11-15)

- "Need a more realistic home layout (hallway, bathroom, bedrooms, living room etc). The idea is to locate the HVAC closet in a hallway closet. This leads to a bigger requirement of configuring the home's layout and roof/foundation system more carefully and real-world like."
- "This should also include moving the HVAC unit, whether horizontal or in a hallway HVAC closet."
- Earlier the same day: the closet unit should be central in the house; its plenum should be in the attic at the same spot as the horizontal unit's plenum, so switching Attic ⇄ HVAC closet looks seamless; the horizontal unit must read as the air's path (a big return grille in the ceiling, a return duct into the cabinet's return end, then blower → furnace → coil → plenum as one tube); a central system is never A/C-only. Realistic component models are a separate session (`docs/superpowers/handoff/2026-11-15-hvac-component-models-handoff.md`).

## 2. Why today's house can't hold a hallway closet (found 2026-11-15, verify against the code)

- The interior is three rooms in a row: `ROOMS` = bedroom, living, kitchen (`src/features/trade-scenes/constants/home-geometry.ts`), split by `PARTITIONS_X = [-2, HOUSE.cutX]`, with one shared doorway band per partition (`PARTITION_DOOR`, z −1.55..−0.65). No hallway, no bathroom.
- The attic plenum (`EQUIPMENT.plenum`, x −0.6, z −1.55) is pinned in z by the rafters: its top stays under the rafters' underside only while its back edge is at z ≥ about −1.98, and the attic line must end behind the attic's cut (z −0.03). A closet under it lands on the rug, the coffee table and the ceiling fan (`FURNISHING_BOXES`), and anywhere along that band it blocks half a doorway. The full analysis and four interim options are in `.superpowers/sdd/2026-11-13-heating-and-cooling-system/task-11c-report.md` § C1.
- Interim state: the HVAC closet stands in the bedroom against the left outside wall with a short trunk up to the plenum spot. It is a placeholder until this work places it.
- Much of the scene reads the house constants at module scope: the layout research counted 62 files (`docs/plans/2026-11-02-trade-scene-layout-research.md`). Heat-arrow lanes (`homeHeatLanes`), ceiling openings and duct boots (`ceiling-opening-part.ts`), duct runs, registers, furniture and residents, the Partly-open cut, the camera views and pins all follow the rooms and the plenum.

## 3. What the HVAC side needs from the layout

- **Indoor unit placements** are data: `constants/indoor-unit-placements.ts` (`INDOOR_UNIT_PLACEMENTS[location][roofForm]` → `IndoorUnitPlacement`: `upright`, `base`, `toward`, `section`, `lengths`, `lineSet`, `closet`, `trunk`), read through `lib/indoor-unit-placement.ts`, `lib/indoor-unit-boxes.ts`, `lib/indoor-location.ts` (`atticHoldsUnit`: a flat roof holds no attic unit). Locations: `attic`, `closet`, and `garage` (enum only, added by 6-B). The layout should produce these placements rather than hand numbers.
- **One plenum spot** for both: the attic unit's plenum and the closet unit's plenum are the same box in the attic; the duct runs leave from it to a register in every room (`registers.tsx`, one per boot); only the cabinet below changes.
- **Real-world placement to research and confirm with the owner:** in SoCal ranch and tract homes the forced-air furnace usually stands in a hall closet or lies in the attic; the central return is a large grille in the hallway ceiling (or the closet door/wall for an upright unit); the thermostat is on a hallway wall; an older home's wall furnace sits on an interior hallway wall. Check this against installer sources before proposing it.
- **Return:** the `return` part (built 2026-11-15) is a big ceiling grille for the attic unit and a low grille on the closet for an upright unit; in a real plan it belongs in the hallway.
- **Mini-split heads** fill rooms in `ROOMS` order (living, bedroom, kitchen; count 1–3, "the cap follows the rooms when Layout L3 adds them", spec `docs/superpowers/specs/2026-11-11-heating-and-cooling-system-design.md` §8).
- **Moving the unit** (R300): a replacement keeps the unit where it is; the rep can move it to the attic (`move:indoor-unit` switch, `proposedHvacIndoorLocation`); the old closet is drawn empty. The layout must give both spots so the move reads.

## 4. Roof and foundation, "more carefully and real-world"

The owner wants these framed like real ones; ask what that means to them before designing. Facts to bring: the attic's usable height is set by rafter depth and pitch (this pinned the plenum); a flat roof's joist space holds ducts but no unit; a raised foundation has a crawl space (the crawl-space system is a future area); slab vs raised already changes `homeLift`. Related open items: covering wear, material textures (TS3b.6-C), the gutters and downspouts.

## 5. Rules that bind every change

- Only Oliver starts the dev server (port per worktree, `.env.local`); never sweep the scene in a software-rendered browser, one case per probe run.
- Comments say why, never what; never cite a plan, spec, task or ruling in code. Stage by explicit path; no stash, checkout or reset on a shared branch.
- Domain words come from CONTEXT.md (Indoor unit, HVAC closet, Wall furnace, Wall unit, Mini-split head, New-cut, Heat pump; Layout, Region, Draft, Lot edge, Gate); new words (Hallway, Hall bathroom, …) are agreed with the owner before code uses them.
- Draw calls are recorded against the TS3b.6 budget.
