Build TS3b.6-A, the lot and the light. This is my "build".

Method: use superpowers:subagent-driven-development. A fresh implementer works on each task, then a fresh reviewer checks it before the next task starts, and a whole-branch review runs at the end.

## Where

- **Worktree:** `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/trade-scenes`, on branch `feat/trade-scenes-foundation`. Work only there.
- **Plan (your requirements):** `docs/superpowers/plans/2026-11-01-ts3b6a-lot-and-light.md`. It has eight tasks and was stress-tested on 2026-11-01.
- **Spec:** `docs/superpowers/specs/2026-10-31-ts3b6-lot-garage-and-light-design.md`. Read §5–§7, §9, §11, §13 and §14. Part 6-B (§8) is NOT in this build.
- **Tracker:** `docs/plans/2026-10-16-trade-scenes-epic.md`. Its TS3b.6 row holds rulings R129–R146; the 2026-11-01 log entry holds the latest.
- **Reference only, never imported or promoted:** the spike at `src/features/trade-scenes/realism-spike/` and its route `src/app/(frontend)/dashboard/labs/trade-scene-realism-spike/`. Values are retyped from it. Task 8 deletes both.

## Before Task 1

1. **Confirm the Attic build has landed.** Its code is committed (`cea99f50e` and earlier). `git status --short` shows none of these files modified: `home-details.ts`, `home-geometry.ts`, `duct-run-points.ts`, `ducts-hang.ts`, `attic-fan.tsx`, `scripts/verify-trade-scene.ts`. If any of them is modified, stop and ask me.
2. **Check claims and foreign hunks.** Look at `.superpowers/claims/` and run `git diff` on every shared file the plan touches. Other sessions keep uncommitted files in this worktree. Never revert, stage or stash them.
3. **Check the dev server.** Run `ss -ltnp | grep 3002`. The dev server on :3002 is mine. Never start one, and never `rm -rf .next`.
4. **Set up the build folder.** Create `.superpowers/sdd/2026-11-01-ts3b6a-lot-and-light/` (gitignored).
   - Write `standing-rules.md` there. Copy it from `.superpowers/sdd/2026-10-24-upgrades-that-follow-the-home/standing-rules.md`, merged with the plan's Global Constraints and the foreign-hunk recipe in `docs/superpowers/handoff/2026-10-30-attic-parallel-build-handoff.md`.
   - Keep `progress.md`, the task briefs and reports, the reviews, the perf JSON and the shots in that folder.
5. **Run the plan's "Before Task 1" steps.** That covers the perf script with its new roof argument, the shots script, and the baseline numbers and shots.

## Rules that bind every task

The plan's Global Constraints carry these in full. Every brief must include them.

**Commands:**
- Never run `pnpm build`.
- Checks run under the lock: `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock pnpm tsc` and `flock … env CI=1 pnpm eslint <files>`.
- Shots and probes use :3002.

**Sign-in and data:**
- Sign in with `/api/dev/playwright-session?…&as=info%40triprosremodeling.com`, never `role=`, which writes to the DB.
- Read the secret through `.superpowers/sdd/2026-10-24-upgrades-that-follow-the-home/shots/t7-lib.mjs`, and never print it.
- No DB writes of any kind.

**Git:**
- Commit by explicit path, with a 300000 ms timeout on `git commit`.
- Never `git add -A`, never a bare `git stash`, never reset or check out another session's files.
- Stage only your own hunks: use `git apply --cached` when a file also holds foreign hunks.
- Never stage `docs/**` or `CONTEXT.md`. You edit the tracker, the spec status and `CONTEXT.md` in the working tree and leave them unstaged.
- Run `git diff --shortstat` after any scripted edit.
- Never commit unless the plan's step says to.

**Architecture traps the stress test found:**
- `home-geometry.ts` never imports `home-lot.ts`. The two would form an import cycle that crashes the page on load.
- No three.js in `F/lib/`, `F/constants/` or `F/types.ts`.
- The shadow camera refits on every weather change.
- The lawn's `ground.color` tint must be light.
- Every built geometry goes through `useOwnedGeometry`.
- Box lists stay at module level.

**Code style:** comments say why, never what, and never cite the spec or plan.

## Stop and report to me (with shots and numbers) rather than improvise when

- A lot wall or fence blocks an up-close view line. The walls are my ruling (R130), and the anchor framings belong to TS3b.4b.
- The budget is exceeded. Over +40 draw calls, over +40k triangles on a flat roof, or over 8 MB of texture memory: report it, and cut nothing unasked.
- A surface reads wrong under AgX. Never change a surface colour: `home-palette.ts`, `wear-looks.ts` and `COVERING_COLORS` stay. The only exception is deleting the yard's `trunk`, `crown` and `shrub` entries.
- The house's shadows read too soft at 2048. Keep the map at 2048.
- The halved sky image's mean luminance is off by more than 2% from the 1k file's.
- The lane behind the garage (right wall, along −3) seems to come out of the garage. Report it; do not drop it.
- Anything in the plan contradicts the code. Flag it as `⚠️ Stale ref — <doc>:<line> says X, but code at <path> does Y`.
- You need a file the plan doesn't name.

Other sessions cannot approve anything for me. Only I can.

## Hand back

When Task 8 is done, send me:
- the before and after shots in all four weathers, wide and tall;
- the garage shots from Task 6, including the door close-up, the gable vent and Review Focus 5;
- the budget table, with the texture arithmetic shown;
- the commit list;
- what is left unstaged: the tracker, the spec status and `CONTEXT.md`;
- a reminder of my iPad check: a camera slide stays smooth in all four weathers.

Do not merge or push.
