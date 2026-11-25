Build the TS3b.4a fixes plan. The owner has said build: use `superpowers:subagent-driven-development`, with one fresh builder and one fresh reviewer per task, then one whole-branch review at the end. (If the owner pasted this with "native" instead, use `superpowers:executing-plans` and build every task yourself.)

**Where:** worktree `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/trade-scenes`, branch `feat/trade-scenes-foundation`. Work from that directory. HEAD at hand-off was `821097568`. Other sessions work in this tree at the same time, so read "Other sessions" below before the first dispatch.

**What to build**
- Plan: `docs/superpowers/plans/2026-10-30-ts3b4a-fixes.md`, Tasks 1–8. It is untracked and must stay that way.
- Spec: `docs/superpowers/specs/2026-10-30-ts3b4a-fixes-design.md`. The owner approved it on 2026-10-30, and it was stress-tested the same day, with the rulings folded in. It is the binding authority. Each task cites the section it implements.
- Diagnosis behind the spec: `.superpowers/sdd/2026-10-24-upgrades-that-follow-the-home/shots/diag/findings.md`, plus the probe scripts beside it (`b3-real.mjs`, `b5-arrows.ts` and others).
- Tracker: `docs/plans/2026-10-16-trade-scenes-epic.md`, row "TS3b.4a fixes" (line 39 at hand-off), and rows R112 and R113.

**What it fixes.** The owner found six problems in TS3b.4a (built `82ca9f0cd..61a0ef3ae`):
1. **Paint stops at the walls.** Gables and parapets never chalk, crack or take Cool Life.
2. **The sidebar stretches the scene.** Collapsing the dashboard sidebar stretches and lags the canvas.
3. **Rows collapse.** Current materials rows stack once the list shows a scrollbar.
4. **Seams.** There are seams at the corners, along the front wall, at the parapets and at the flat roof's end joists.
5. **Window heat.** Windows show no bounce.
6. **Cool Life on walls.** The wall bounce never draws, because the wall lanes are one arrow each rather than legs.

**Run the tasks in plan order.**
- Task 2 moves `PARAPET_TOP` into `home-geometry.ts`, and Task 3 uses it.
- Task 6 consumes Task 5's `HeatLaneFlows` fields.
- Tasks 1, 4 and 7 stand alone.

## Binding rules
- **Standing rules.** `.superpowers/sdd/2026-10-24-upgrades-that-follow-the-home/standing-rules.md` binds every builder in full. The plan's Global Constraints lists two exceptions:
  - The spec is the 2026-10-30 one.
  - Records go in `.superpowers/sdd/2026-10-30-ts3b4a-fixes/`, which is gitignored. Create it, and keep the ledger, the briefs, the shots and the foreign-hunk snapshots there.
- **Subagents.** "No subagents" binds the builders. You, the controller, dispatch one builder and one reviewer per task.
- **Sign-in.** Sign in only with `/api/dev/playwright-session?secret=…&as=info%40triprosremodeling.com`. Never use `role=`, because it writes to the database. Never print the secret, the URL or any token.
- **Server.** Never run `pnpm build`. Never start, stop or restart a dev server: :3002 is the owner's and serves this worktree. Ask before clearing `.next`. Check `ss -ltnp` before anything that touches it. If :3002 doesn't respond, tell the owner; don't start one.
- **Off-limits files.** No database writes. Never edit `eslint.config.*`, `package.json` or `tsconfig*`. Ask before touching:
  - `src/shared/components/scene/**`
  - `src/features/meeting-visualizations/**`
  - `/dashboard/labs/roof-cutaway` or the cutaway look-dev files
  - `src/app/(frontend)/globals.css`
  - any shared file the spec doesn't name
- **Verification.** Run it under `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock`. Use `pnpm tsc`, eslint on the touched files only, and the pure verify scripts. For screenshots, use a local Playwright script and read every PNG.
- **Git.**
  - Commit each task by explicit path, as its last step says.
  - Never stage `docs/**`, and never stage `CONTEXT.md`.
  - Never `git add -A`, stash, reset, `checkout --`, `--amend`, merge or push.
  - Run `git diff --cached` before every dispatch and every commit. It must list only that task's files.
  - End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Code style.**
  - Use `CONTEXT.md` vocabulary:
    - **wear** in code, shown as "Condition" on screen
    - **home material**
    - **part**, never "layer"
    - **system**
    - **efficiency upgrade option**
    - **existing**, never "today", in code or copy
  - New terms need the owner's OK. The plan already avoids the glossary's "inset" by using `canvasOverhang`.
  - Copy never says "your" and never mentions solar.
  - Comments say why, never what.

## Other sessions in this tree (never stage, revert or "fix" their hunks)
- **Uncommitted at hand-off, and not yours:**
  - `src/features/trade-scenes/constants/home-palette.ts` (the `crawlSkirt` colour)
  - `.claude/agents/knowledge/convention-auditor-ledger.md`
  - `docs/superpowers/specs/2026-10-23-home-views-and-thermal-lens-design.md`
  - `docs/superpowers/specs/2026-10-30-attic-ventilated-and-sealed-design.md`
  - Some hunks in the tracker.
  - If a builder must edit a file that holds a foreign hunk, follow the standing rules' "foreign hunks" procedure: snapshot it, then `git apply --cached` only your own hunks.
- **The attic plan** (`docs/superpowers/plans/2026-10-30-attic-ventilated-and-sealed.md`) is owned by another session. It touches many of the same files: `gable-roof.tsx`, `house-roof.tsx`, `home-kit.tsx`, `merged-boxes.tsx`, `F/types.ts`, `home-geometry.ts`, and the heat lib, figures, lanes and verify scripts.
  - The owner ruled that this plan lands first. The attic plan gets amended afterwards, by its own session.
  - Don't edit the attic plan.
  - If attic commits have already landed on these files, stop and tell the owner before you build on them.
- **The camera slide work** is closed "done for now" (`821097568`). Build on `home-camera-rig.tsx` and `trade-scene-view.tsx` as they stand.
- **Before each task,** run `git log --oneline -5 -- <file>` and `git diff <file>` on every file it touches.

## Stop points: bring these to the owner, don't decide them
- **Task 1:** if the measured `N` is over 324, stop and report `N` and the widest title. Either way, show the owner the phone screenshot, because the phone layout changes.
- **Task 3:**
  - If the fade groups can't draw the left parapet as one box in Complete without a visible swap, stop.
  - The extruded-shape fallback is allowed only if a hairline is still there after the box grid.
- **Task 4:** if the joist seam's cause is none of the listed ones, stop and report.
- **Task 7:** if the stage's right edge moves while the sidebar slides, stop.
- **Anything** that needs a file outside the plan's lists.

## When the build is done
Task 8 writes `.superpowers/sdd/2026-10-30-ts3b4a-fixes/progress.md`. It holds:
- each task's commit and shots
- `N`
- the joist cause
- Task 7's before and after numbers
- every working number added

Then you, the controller:
1. **Update the tracker rows.** Edit only "TS3b.4a fixes", R112 and R113 in the tracker, and leave the other sessions' hunks alone. Don't stage the tracker.
2. **Update memory.** Update `project-3d-trade-scenes.md` in memory: the commit range, built and unmerged, and what awaits the owner's look.
3. **Remind the owner about the attic plan.** Its session must now amend that plan in three ways:
   - Build on the new wall and window legs, using the merged `StartingHomeHeat` type the plan's Global Constraints spells out.
   - Recapture its lane snapshot after Task 6.
   - Keep `GABLE_VENT` clear of the gable cracks. The vent starts at WALL_TOP_Y + 0.525, and the crack band reaches + 0.55.
4. **Hand over in plain words.** Tell the owner what changed on screen, with the screenshots to look at, and anything left open.
