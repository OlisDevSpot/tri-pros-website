# Handoff: build covering wear and the tile reset

**Written:** 2026-11-11, at `62d617b99` (Gutters Task 3 done, Tasks 4 to 7 still building).
**For:** a fresh session that builds this plan with superpowers:subagent-driven-development.
**Your job:** build `docs/superpowers/plans/2026-11-10-covering-wear-and-tile-reset.md`, Tasks 0 to 7, ending with the owner's look on the running page.
**Worktree and branch:** `.worktrees/trade-scenes`, `feat/trade-scenes-foundation`. Build here. No new worktree, no new branch.

## 0. Two gates before you write any code

1. **Gutters must have finished.** The owner ruled on 2026-11-11 that the Gutters plan (`docs/superpowers/plans/2026-11-09-trade-scene-gutters.md`) builds first, because both plans edit the same files. Check its ledger, `.superpowers/sdd/2026-11-09-trade-scene-gutters/progress.md`. Every task through Task 7 should read "complete", and the final review should be done. If it isn't, stop and tell the owner. Never build alongside it.
2. **The owner must say "build", "execute" or "run".** "Go ahead" is not a build call. The method is subagent-driven, and the owner asked for this handoff for that purpose.

## 1. Where things stand

| | |
|---|---|
| Plan | `docs/superpowers/plans/2026-11-10-covering-wear-and-tile-reset.md`. Untracked. Stress-tested with 4 lenses and amended 2026-11-11 |
| Spec | `docs/superpowers/specs/2026-11-10-covering-wear-and-tile-reset-design.md`. Untracked. Approved 2026-11-10, amended 2026-11-11 |
| Tracker | `docs/plans/2026-10-16-trade-scenes-epic.md`: rows R293 to R296, the "Covering wear" row in §2, and the change log for 2026-11-10 and 2026-11-11. Uncommitted, and it holds other sessions' hunks |
| Code | Nothing built. One hunk is already in the tree: `feltAged: '#3b3530'` in `src/features/trade-scenes/constants/home-palette.ts` (R293, owner-approved, uncommitted). Task 3 commits it. Check `git log -p -S'#3b3530' -- <that file>` first: if a Gutters commit already swept it in, skip that part of Task 3 Step 8 |
| Workspace | None yet. Start `.superpowers/sdd/2026-11-11-covering-wear/` with a `progress.md` ledger and a `global-constraints.md` (see §5) |
| Dev server | The owner's. Only Oliver starts one. Check the port with `ss -ltnp`. If nothing answers, ask him |

## 2. What to do, in order

1. Read the plan, then the spec. The plan's header, Global Constraints and Review Focus are binding.
2. **Re-derive the plan's line references.** They were checked at `e0deb98da`, before Gutters landed. Gutters changed `HomeMaterialFacts`, `HOME_MATERIAL_FACTS_UNSET`, `DrawingOnlyMaterialFact`, the `kept` rule in `part-state.ts` (`drawnGutterWear` shares it), the roof component props, `existing-chip.tsx`, `home-palette.ts` and both scene check scripts. Fix each task brief's references before you dispatch it, and note each change in the ledger.
3. Run the existing checks once for a green baseline: `pnpm tsx scripts/verify-trade-scene.ts`, `verify-trade-scene-layout.ts` and `verify-construction-model.ts`, then tsc and lint under the lock.
4. Run Tasks 0 to 6 in order, each with an implementer and then a reviewer. Later tasks use the exact names from earlier tasks' Interfaces blocks.
5. Task 7: the final check set, then hand the owner the look list from the plan and wait. Tune the working numbers to their rulings.
6. Run the final whole-branch review only after the comment grep in §5.

## 3. Owner rulings: do not reopen these

- **Kinds per covering:**

  | Covering | Kinds |
  |---|---|
  | Tile | Dirt, Cracked, Misaligned, Broken |
  | Shingle | Dirt, Missing, Curling |
  | Wood shake | Dirt, Split, Curling |
  | Flat roof | Dirt only |
  | Metal | No controls |
- **Levels:** None, Light, Moderate and Heavy, like paint wear. A level the rep sets survives a Condition change, and going back to the era guess clears it.
- **Dirt is settled tan grit** (study A). "The dirt should feel real." A grey film painted over the roof is the named failure. A build that passes every check but looks like that has failed.
- **A tile reset is the same roof, much nicer.** It has the same tiles in the same places, in their weathered colour. It is cleaned, crooked tiles go straight, and cracked and broken tiles become slightly fresher replacements. It must not read as a new roof, and the replacements must not read as patchwork.
- **The garage roof is out of scope.** The planned garage work will match its materials to the house's.
- **Wood shake is never better than Worn (R296).** It offers only Worn and Failing, and an unrated one guesses Failing whatever the home's age. This is plan Task 0.
- **Order:** Gutters first (2026-11-11).

## 4. Calls made at the stress test that a reviewer may question

Each was weighed. Reopen one only with new evidence from the code.

- **Code says `reused`, never `reset`.** `ScopeInstall.reuses` pairs with `ResolvedPart.reused`, the way `replacesWood` pairs with `woodReplaced`. The not-drawn "Tile roof reset (repair)" scope (`scope-not-drawn.ts:5`) is a different job.
- **Replacement tiles are `replacement`, never "fresh".** In this feature `fresh` already means zero wear (`worn-color.ts:11`). The shared `PieceLayout` gets only the neutral `yaw` and `tint`, because rafters and deck boards share it.
- **Each level draws its own random rolls,** so moving one level never moves another kind's pieces. The cost is that a Worn shingle roof keeps its 5% gaps, but in different tabs than before. The owner has been told.
- **Metal ignores recorded levels.** `coveringWearInForce` takes the roof type and keeps a level only for that roof's kinds.
- **Dirt, cracks, broken corners and replacements all draw inside the covering's own material.** They add zero draw calls, within the spec's budget. The shader is the scene's first `onBeforeCompile`. The course kind is an int uniform `uShape` under one constant cache key.
- **After a reset, the new drip edge and the garage roof follow the weathered tile tone,** as they follow the roof's colour today. This was Claude's call and is on the owner's look list.
- **Under Thermal, the dirt and cracks are gone and broken tiles draw whole,** because Thermal swaps the material. When the house ghosts, the dirt fades with the tile. During the Complete front slope's sheet fade, a broken corner writes depth for the length of the fade. All of these are on the look list, not fixed.

## 5. Traps the plan doesn't fully spell out

- **Never open the scene in a software-rendered browser, and never let a subagent do it.** A sweep crashed the owner's machine. This plan has no screenshot task. The owner judges the look on the running page. Pass this rule in every dispatch.
- **`task-brief` extracts only the task's text.** Global Constraints don't travel with it. Copy them, plus the plan's header "Order" paragraph, into `global-constraints.md` in the workspace and attach it to every dispatch.
- **Comments in briefs get copied.** Tell every implementer that the brief's test code is verbatim in its assertions, but its inline comments are notes: reword each to its reason or drop it. Before the final review, run `grep -rniE "review focus|plan call|task [0-9]" scripts src`.
- **Other sessions share this tree.** Commit only through `.superpowers/sdd/2026-11-06-trade-scene-colour-picking/commit-own.sh <message-file> <path>…`, with `patch:<file>` for a file that holds foreign hunks. Snapshot those hunks to a `foreign/` folder in the workspace first. Never use `git commit -- <path>`, `git add -A`/`.`, `--amend`, stash, restore, reset or `checkout --`. Give each commit a 300000 ms timeout, then run `git show --stat HEAD`.
- **Heavy commands queue on one lock.** Run tsc and lint as `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock …`, one at a time.
- **In parallel shell calls,** use `git -C <path>` and absolute paths.
- **Never put `docs/**` or `CONTEXT.md` in a commit.** Task 7's glossary and tracker edits stay unstaged. `CONTEXT.md:129` is stale: it lists three paint wear kinds, but the code has four, including `fascia-rot`. Task 7 fixes it.
- **The shader test only proves the text was injected.** A GLSL compile error shows up first on the owner's page. Have Task 5's reviewer read the injected GLSL against three r180's `meshphysical` chunks. Check that `instanceMatrix` is only used under `USE_INSTANCING` and that each `vCovering*` varying is declared on both sides.
- **Keep the workspace after the final review.** The owner's look and the tuning rounds still need it.
- **Don't run `finishing-a-development-branch`'s merge or push options.** The owner decides shipping, and this branch is never pushed directly. The next release is a new branch off `origin/main` (memory `project-trade-scene-ship-2026-11-04.md`).

## 6. What hasn't been proven

- **The amended plan hasn't been compiled.** Its signatures were checked against the code by reading, at `e0deb98da`.
- **Fixed rolls and the 5% Missing band.** A reviewer measured 3.3% Missing at Moderate on the old 6 m test area, before the shingle rolls were fixed. The test area is now 12 m and the band 2–8%. If it still fails, check the share first and don't loosen the band.
- **The dirt has never been seen.** `COVERING_DIRT` (`#b8a382`, `maxCover` 0.82), `TILE_WEAR` and `FLAT_DIRT` are working numbers. Expect tuning rounds in Task 7.
- **Frame rate on the iPad** is the owner's to judge. The plan adds no draw calls, but the shader's cost per pixel on the whole roof hasn't been measured.

## 7. When the build is done

- Update R293 to R296 and the Covering wear row in the tracker, unstaged.
- List for the owner:
  - the commit range;
  - the look list from plan Task 7 Step 2;
  - the working numbers still open.
- The owner still owes the iPad look.
