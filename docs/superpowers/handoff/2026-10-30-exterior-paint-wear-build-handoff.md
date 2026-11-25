Build the exterior paint wear kinds plan. The owner has said build. Use `superpowers:subagent-driven-development`: one fresh builder and one fresh reviewer per task, then one whole-branch review at the end. (If the owner pasted this with "native" instead, use `superpowers:executing-plans` and build every task yourself.)

**Where:** worktree `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/trade-scenes`, branch `feat/trade-scenes-foundation`. Work from that directory. HEAD at hand-off was `e0d213549`. Other sessions build in this tree at the same time; read "Other sessions" before the first dispatch.

## Gate: check before Task 1, stop if it fails
Two other plans are mid-build on the same files. This plan starts only when both have committed their last task:
1. **TS3b.4a fixes** (`docs/superpowers/plans/2026-10-30-ts3b4a-fixes.md`). At hand-off its Tasks 1–3 were in (`af7d50057`, `8dbe06e86`, `9a699167e`). It is done when `.superpowers/sdd/2026-10-30-ts3b4a-fixes/progress.md` has its "## Hand-over" section.
2. **Attic, ventilated and sealed** (`docs/superpowers/plans/2026-10-30-attic-ventilated-and-sealed.md`, Task 7 dropped). At hand-off its Tasks 1–2 were in (`7c5f5956f`, `e0d213549`). It is done when its Task 8 is committed and `.superpowers/sdd/2026-10-30-attic-ventilated-and-sealed/progress.md` says so.

If either is unfinished, or `git status` shows uncommitted hunks of theirs in any file this plan touches, stop and tell the owner. Don't start. (The plan says the attic order is the owner's call; this handoff sets it to "after the attic plan". If the owner pasted this saying otherwise, follow them.)

## What to build
- **Plan:** `docs/superpowers/plans/2026-10-30-exterior-paint-wear-kinds.md`, Tasks 1–6, in order. Committed with the spec's amendments; don't edit it.
- **Spec (binding):** `docs/superpowers/specs/2026-10-30-exterior-paint-wear-kinds-design.md`. Approved in `4206462ab`; the stress-test amendments (§6.2, §6.6, §7, §10.4–10.5) are committed with the plan.
- **Tracker:** `docs/plans/2026-10-16-trade-scenes-epic.md`, row R121.
- **What it does:** worn exterior paint shows three kinds of wear: **Cracks**, **Stains** and **Peeling**.
  - Each kind has its own level: None, Light, Moderate or Heavy.
  - The paint's Condition sets each kind's starting level. The rep can change any kind on the Exterior paint row, using one stops-on-a-track `ScaleField` per kind.
  - A Condition change never resets what the rep set.
  - The raised foundation wall takes the wall's paint and wear.
- **Owner rulings from the stress test:**
  - The level rows are `ScaleField`, the same control as Insulation level.
  - Draw calls: the estimated overage (about +9 on the raised pitched home) is accepted for now. Measure and record; don't stop on it.

## Binding rules
- **Standing rules.** `.superpowers/sdd/2026-10-24-upgrades-that-follow-the-home/standing-rules.md` binds every builder in full, with the exceptions the plan's Global Constraints lists:
  - Records go in `.superpowers/sdd/2026-10-30-exterior-paint-wear-kinds/` (gitignored; create it). Keep the ledger, briefs, shots and foreign-hunk snapshots there.
  - Its note that `scene-burst-key.ts` was deleted is stale; the file is live. Leave it alone.
- **Subagents.** "No subagents" binds the builders. You, the controller, dispatch one builder and one reviewer per task.
- **Sign-in.** Sign in only with `/api/dev/playwright-session?secret=…&as=info%40triprosremodeling.com`. Never use `role=`, which writes to the database. Never print the secret, the URL or any token.
- **Server.**
  - Never run `pnpm build`.
  - Never start, stop or restart a dev server: :3002 is the owner's and serves this worktree. If it doesn't respond, tell the owner.
  - Ask before clearing `.next`, and check `ss -ltnp` first.
- **Off limits.**
  - Make no database writes. Nothing in this plan is persisted.
  - Never edit `package.json`, `eslint.config.*`, `tsconfig*`, `src/shared/components/scene/**` or `src/app/(frontend)/globals.css`.
  - Ask before touching any file the plan doesn't name.
- **Verification.** Run tsc and eslint exactly as the plan's Global Constraints spells them, under `flock …/.superpowers/heavy.lock`. The `pnpm tsx scripts/verify-*` scripts run without the lock. For screenshots, use a local Playwright script and read every PNG.
- **Git.**
  - Commit each task by explicit path, with the message its last step gives.
  - Never stage `docs/**` or `CONTEXT.md`.
  - Never `git add -A`, stash, reset, `checkout --`, `--amend`, merge or push.
  - Run `git diff --cached` before every dispatch and every commit. It must list only that task's files.
  - End every commit with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Words.** Use these terms:
  - **paint wear** for the three kinds and **paint wear level** for their steps.
  - **wear** in code and "Condition" on screen.
  - A level's number is a **share**.
  - "peeling", never "peel"; the peel slider owns `peel`.

  Never write "damage", "defects", "severity" or "amount". Comments say why, never what.
- **Marks never cast shadows.** Every shadow-casting mesh draws again in the shadow pass, which would double the draw-call cost.

## Draw calls (read before Task 1)
- **Measure the base first.** Before Task 1 changes anything, measure each home's draw calls at the base commit and write them in the ledger. Use `renderer.info.render.calls` at Failing, every kind Heavy, Complete, at rest after the fades settle. Measure four homes: raised pitched, slab pitched, raised flat and slab flat. The plan's "63" predates the attic plan, which adds meshes, so the base you measure replaces it.
- **No cap.** The owner accepted the overage for now (2026-10-30). Record the counts; don't stop on them. If performance degrades, the owner revisits it.
- **The counter.** `.superpowers/sdd/2026-10-30-attic-ventilated-and-sealed/perf.mjs` already counts calls and triangles. Copy it into this build's `shots/`; don't edit it in place.
- **Expected extra calls:** about +9 on the raised pitched home: four stain meshes, the foundation wall's two mark meshes and three fascia meshes. Any call beyond the meshes the plan's Global Constraints lists is a merging bug: fix it.

## Other sessions in this tree (never stage, revert or "fix" their hunks)
- **Uncommitted at hand-off, and not yours:**
  - `.claude/agents/knowledge/convention-auditor-ledger.md`
  - `docs/superpowers/specs/2026-10-23-home-views-and-thermal-lens-design.md`
  - `docs/superpowers/specs/2026-10-30-attic-ventilated-and-sealed-design.md`
  - Other hunks in the tracker.

  If a builder must edit a file holding a foreign hunk, follow the standing rules' "foreign hunks" procedure.
- **Shared files with the attic plan:** `gable-roof.tsx`, `home-kit.tsx`, `F/types.ts`, `home-palette.ts`, `home-scene-copy.ts`, `home-geometry.ts`, `merged-boxes.tsx` (the attic plan adds `ignoreTaps`) and both verify scripts. Build on what the attic plan left.
- **Gable vents:** the attic plan's gable vent starts at `WALL_TOP_Y + 0.525`, and the gable crack band reaches `+ 0.55`. When Task 3 reworks `gableCracks(share)`, keep cracks, stains and peeling clear of the vent.
- **Before each task:** run `git log --oneline -5 -- <file>` and `git diff <file>` on every file the task touches.

## Stop points: bring these to the owner, don't decide them
- **Task 3:** if keeping marks off the front door leaves a visible bare band, or the cracks' look changes beyond losing the ones that crossed the door.
- **Anything** that needs a file outside the plan's lists, or a new screen word beyond the plan's exact copy.

## When the build is done
Task 6 writes `.superpowers/sdd/2026-10-30-exterior-paint-wear-kinds/progress.md`. It holds:
- each task's commit and shots
- the four homes' draw counts (base and final)
- every working number added

Then you, the controller:
1. **Update the tracker.** Edit only R121's status cell. Leave the other sessions' hunks alone, and don't stage the tracker.
2. **Update memory.** Update `project-3d-trade-scenes.md` with the commit range, "built, unmerged", and what awaits the owner's look.
3. **Hand over in plain words.** Tell the owner:
   - what changed on screen, with the screenshots to look at;
   - the draw-call numbers;
   - that the iPad frame-time check from TS3b.3 is still owed.
