Build the attic plan while another session builds the TS3b.4a fixes in the same worktree. The owner has said build. Use `superpowers:subagent-driven-development`: one fresh builder and one fresh reviewer per task, then one whole-branch review at the end.

The owner has also ruled that this plan may start before the fixes land. That covers only the tasks that don't collide with them. The gate table below says which tasks those are, and when each later task may start.

**Where:** worktree `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/trade-scenes`, branch `feat/trade-scenes-foundation`. Work from that directory.

**What to build**
- **Plan:** `docs/superpowers/plans/2026-10-30-attic-ventilated-and-sealed.md`, Tasks 1–8. It is untracked and must stay that way. Your session owns it; amend it where this hand-off says to.
- **Spec:** `docs/superpowers/specs/2026-10-30-attic-ventilated-and-sealed-design.md`. The owner approved it 2026-10-30, it was stress-tested the same day, and it is the binding authority.
- **Tracker:** `docs/plans/2026-10-16-trade-scenes-epic.md`, row Attic, R105–R111.
- **Records:** `.superpowers/sdd/2026-10-30-attic-ventilated-and-sealed/`, which is gitignored. Create it, and keep the ledger, briefs, shots and foreign-hunk snapshots there.
- **Don't touch:** the fixes session's folder `.superpowers/sdd/2026-10-30-ts3b4a-fixes/`. You may only read its `progress.md`.

## The plan's "fixes first" gate
The plan's Global Constraints says the TS3b.4a fixes must be committed before Task 1. The owner has replaced that rule with the table below. Each task starts only when its gate holds.

The fixes ledger is `.superpowers/sdd/2026-10-30-ts3b4a-fixes/progress.md`. A fixes task counts as landed only when that file has a `Task <N>: complete` line, because a commit alone may still get review fixes. Check the ledger before you dispatch each task, and wait for the gate if it doesn't hold yet. Never build on a fixes task that hasn't landed. When you are waiting, ask to be told when the fixes session goes idle, rather than polling.

| Attic task | May start when | Why |
|---|---|---|
| 1 (flat roof hides attic-only rows) | now | It touches `C/constants/assemblies/roof-attic.ts`, `F/lib/part-offers.ts`, `F/constants/home-scene-copy.ts` and `scripts/verify-trade-scene-layout.ts`. No fixes task edits these. **But in Step 0,** write and dry-run `perf.mjs` now, and record the baseline only once the fixes ledger has `Task 7: complete`. The fixes add draw calls (gable and parapet cracks, front corners, wall and window legs), so a baseline taken earlier would let the attic spend the fixes' cost against the 10% gate. The baseline must be recorded before attic Task 4 commits. |
| 2 (attic fan part, scope, bill cut) | now | It touches the core constants, `infer-existing-conditions.ts`, `scope-verbs.ts`, `home-systems.ts`, `field-glyphs.ts` and `home-scene-copy.ts`. No fixes task edits these. Its checks go into `scripts/verify-trade-scene.ts`, which fixes Tasks 3–6 also edit, so follow the claim rule below. |
| 3 (fan thermostat and its heat) | fixes `Task 5: complete` | Both tasks change `F/types.ts` (`HomeHeat`, `StartingHomeHeat`), `F/lib/home-heat.ts` (`applied()`) and `home-heat-figures.ts`. Amendment A applies first. |
| 4 (gable vents, fan on the whole home) | fixes `Task 3: complete` and `Task 4: complete` | Both tasks edit `home-geometry.ts`. Amendment C applies first. `F/constants/home-palette.ts` holds another session's uncommitted `crawlSkirt` hunk, so follow the foreign-hunk procedure for it. |
| 5 (openings, boots, ducts, collars) | fixes `Task 6: complete` | It edits `F/lib/home-heat-lanes.ts` and `home-geometry.ts`. |
| 6 (fan lane, ceiling leaks) | fixes `Task 6: complete` | It edits both lane files. Amendment B applies first. |
| 7 (up close: gable end and fan) | your own Tasks 2–3 are done | It touches only kit files and `gable-geometry.ts` (lifted from `gable-roof.tsx`, which fixes Task 2 already changed: re-read it). |
| 8 (frame cost, full look, tracker) | fixes `Task 8` hand-over written, and the baseline recorded | It has to measure the finished scene. |

In practice: build Tasks 1 and 2 now, then wait at Task 3 until fixes Task 5 lands. The fixes are likely to stay ahead after that.

## Amendments to make in the attic plan before the task they gate
The fixes change the code under these tasks. Re-read the fixes' committed diff (`git log -p` on each named file) and amend the plan to match before you dispatch. The binding fixes spec is `docs/superpowers/specs/2026-10-30-ts3b4a-fixes-design.md` (§7 for A and B, §3 for C).

- **A. Before Task 3:** build on the wall and window legs.
  - `HomeHeatFlows.wall` and `.window` are now the sun's flow, which no part changes. `wallPasses` and `windowPasses` are new, as is `HomeHeatBounce.window`.
  - `HeatEffect.flows` can no longer name `wall` or `window`, and `applied()` no longer multiplies them.
  - The merged type the attic ends at is `StartingHomeHeat = Omit<HomeHeat, 'bounce' | 'flows' | 'atticFanRunning'> & { flows: Omit<HomeHeatFlows, 'wallPasses' | 'windowPasses'> }`. It replaces the plan's `Omit<HomeHeat, 'bounce' | 'atticFanRunning'>`.
- **B. Before Task 6:** recapture its lane snapshot ("pin today's lanes") after fixes Task 6.
  - The lane sets are now `HOME_WALL_HEAT_LANES` (6), `HOME_COMPLETE_WALL_HEAT_LANES` (8), `HOME_WINDOW_HEAT_LANES` (5) and `HOME_COMPLETE_WINDOW_HEAT_LANES` (7).
  - `WallHeatLane` now has a `face`.
  - `HeatLaneFlows.wall` and `.window` are `[source, through]` pairs.
  - The verify-call line numbers the plan lists (`:835, 855, …`) will have moved. Re-find all 11 `homeHeatLanes` calls by grep.
- **C. Before Task 4:** keep `GABLE_VENT` clear of the gable cracks.
  - Fixes Task 2 draws gable cracks in a band from `WALL_TOP_Y + 0.1` to `WALL_TOP_Y + 0.55`, from `gableCracks()` in `F/lib/roof-cracks.ts`.
  - The vent starts at `WALL_TOP_Y + 0.525`, so its bottom overlaps the band's top.
  - Either raise the vent, or clip the cracks around the vent's footprint with the existing `clear` mechanism in `stuccoCracks`.
  - Add a pure check that no gable crack box intersects the vent's boxes.
  - Gables and parapets now take `paint: PaintLook` (`HouseRoof`, `GableRoof`, `LowSlopeRoof`), so the up-close gable end's paint look comes from the same `paintLook()` in `F/ui/lib/paint-look.ts`.

Also note that `PARAPET_TOP` now lives in `F/constants/home-geometry.ts`.

## Sharing the tree with the fixes session (binding on you and every builder)
- **Standing rules.** `.superpowers/sdd/2026-10-24-upgrades-that-follow-the-home/standing-rules.md` binds every builder in full, with three exceptions:
  - The spec is the attic spec.
  - `SDD/shots/` and `SDD/foreign/` map to this plan's records folder.
  - The commit rule for foreign-hunk files is the one in the next bullet.
- **Commit trap: the standing rules are wrong here.** I tested it: `git commit -- <path>` commits that path's working-tree version, so it includes the other session's hunks even after `git apply --cached`.
  - For a file that holds anyone else's hunks: snapshot it, edit it, stage your hunks with `git apply --cached`, and run `git diff --cached --name-only` (it must list only your task's files). Then commit with plain `git commit -F -`, with no pathspec.
  - Every other file keeps `git add <paths>` and `git commit -F - -- <paths>`.
- **Claim rule for `scripts/verify-trade-scene.ts`.** Both sessions edit this file, and the snapshot procedure breaks if the other session edits it between your snapshot and your commit.
  - Before a builder's first edit, it waits until `.superpowers/claims/verify-trade-scene.ts` doesn't exist. Then it writes that file with its session, task and time. It deletes the file right after its commit.
  - A claim older than 90 minutes goes to the owner. Never delete a claim that isn't yours.
  - The fixes session holds the claim now, for its Task 3.
  - Apply the same rule to `F/types.ts` and `F/constants/home-geometry.ts`, with claim files of the same names, if your task edits them while a fixes task is open on them.
- **Type and lint checks.** `pnpm tsc` and eslint read the shared working tree. If they fail only in files your task didn't touch, the other session is mid-edit: wait a few minutes and re-run. Never "fix" them, and record it in the report.
- **Screenshots.** :3002 serves this working tree, so a screenshot can show the other session's uncommitted work. Say in the report when a shot does.
- **Hands off the other session's work.** Never stage, revert or reformat their hunks.
  - Uncommitted foreign hunks right now: `CONTEXT.md` (paint wear terms), `F/constants/home-palette.ts` (`crawlSkirt`), `.claude/agents/knowledge/convention-auditor-ledger.md`, and several `docs/**` files including the tracker.
  - Before each task, run `git log --oneline -5 -- <file>` and `git diff <file>` on every file it touches.

## The rest of the binding rules (unchanged)
- **Sign-in.** Use only `/api/dev/playwright-session?secret=…&as=info%40triprosremodeling.com`. Never `role=`, because it writes to the database. Never print the secret, the URL or any token.
- **Dev server.** Never `pnpm build`. Never start, stop or restart a dev server: :3002 is the owner's. Ask before clearing `.next`.
- **Data and config.** No database writes. Never edit `eslint.config.*`, `package.json` or `tsconfig*`.
- **Ask first** before touching `src/shared/components/scene/**`, or any shared file the spec doesn't name.
- **`scripts/verify-scope-installs.ts`** reads Notion. Run it only with the owner's OK.
- **Verification.** Run it under `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock`, which the fixes session shares. Use `pnpm tsc`, eslint on the touched files, and the three pure verify scripts the plan names.
- **Git.**
  - Never stage `docs/**` or `CONTEXT.md`.
  - Never `git add -A`, stash, reset, `checkout --`, `--amend`, merge or push.
  - Run `git diff --cached` before every dispatch and commit.
  - Every commit message ends with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Put that line verbatim in each builder's dispatch, whatever model the builder is.
- **Vocabulary.** Follow `CONTEXT.md`: **existing** (never "today") in code and copy, **part** (never "layer"), **system**, **efficiency upgrade option**, and an add-on is only the catalog's bill-cut kind.
  - New terms need the owner's OK.
  - Copy never says "your" and never mentions solar.
  - Comments say why, never what.

## Stop points: bring these to the owner, don't decide them
- **Task 4, Step 0:** stop if the look-first shot shows the fan edge-on from the default camera.
- **Task 8:** stop if the frame cost is over the gate (more than 10% over the post-fixes baseline in draw calls or triangles in any scene, or more than one draw per new kind).
- **Gate stuck:** a gate in the table hasn't moved for over two hours while the fixes session is idle.
- **Collision:** a fixes commit changes something your next task builds on in a way the three amendments don't cover.
- **Outside the lists:** anything that needs a file outside the plan's lists.

## When the build is done
1. **Tracker.** Update only the Attic row and R105–R111. Leave the other hunks alone, and don't stage the tracker.
2. **Memory.** Update `project-3d-trade-scenes.md`: the attic's commit range, built and unmerged, and what awaits the owner's look. Keep the fixes session's lines.
3. **Hand over in plain words.** Tell the owner what changed on screen, with the screenshots to look at, the frame-cost numbers, and anything left open.
