# Handoff: build the trade scene Benefits interior

You are taking over a finished design run. The spec is approved, the plan is written and stress-tested, and the owner's rulings are folded in (R215–R227). Your job is to build the plan, verify it, polish it, and stop.

## Where

- Worktree: `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/trade-scenes`, branch `feat/trade-scenes-foundation`. Run everything from here. Never `cd` to the main checkout.
- Plan: `docs/superpowers/plans/2026-11-03-trade-scene-benefits.md` (12 tasks, Global Constraints, Review Focus, Rulings P1–P14).
- Spec: `docs/superpowers/specs/2026-11-03-trade-scene-benefits-design.md` (D1–D21, §3.3 statement table, §4 logic, §8 files).
- Tracker: `docs/plans/2026-10-16-trade-scenes-epic.md`, rows R215–R227.
- Glossary: `CONTEXT.md`, the Benefits entries (Kind of benefit, Benefit statement, Benefit line, Upgrade registry, Upkeep, Today's costs, Two futures).
- Earlier handoff, for the background only: `docs/superpowers/handoff/2026-11-02-benefits-interior-handoff.md`.
- Statements artifact, where the owner signed off the benefit text: https://claude.ai/artifact/R72Gatc8cE4Bn4QeHaFW1f. The spec's §3.3 already holds the final text; the artifact is the record, not a source to re-read.

The plan and spec are untracked on purpose. They live only in this worktree. Never stage them.

## Read first, in this order

1. The plan, in full. Its Global Constraints apply to every task.
2. The spec, in full.
3. `docs/design-system/theme-conventions.md`, before any colour, surface or state work.
4. Memory files the index marks for this area: `project-3d-trade-scenes.md`, `project-trade-scene-layout-exploration.md`, `project-proposal-energy-impact.md`, `reference-chart-touch-tooltips.md`, `reference-motion-aschild-replay.md`, `feedback-subagent-shared-tree-safety.md`, `feedback-preflight-staged-index-and-dev-server.md`, `feedback-verify-ui-with-own-browser.md`, `coding-conventions.md`.

Known stale refs in `coding-conventions.md`, already reported to the owner: Rule 16 (`index.tsx`), the `:61` types barrel, and the `:159` context hook placement. Follow the code where they disagree, and don't edit the memory file unless the owner asks.

## Preflight, before Task 1

- Run `git diff --cached`. If anything is staged, it belongs to another session. Leave it alone and tell the owner before you dispatch.
- Check that `src/shared/modules/construction/core/constants/bill-growth-rates.ts` does not exist. If it does, the energy-impact build got there first, and Task 1 changes to "consume it". Stop and tell the owner.
- `feat/trade-scene-ship` was not in `origin/main` as of 2026-11-03. Note its state in your first report. Don't merge or rebase anything.
- Run `ss -ltnp`. The owner's dev server for this worktree is on :3002 (`.env.local`). It was not running at handoff. Never start, stop or restart it. When you reach the first Playwright step, ask the owner to start it if it is down.

## How to run it

The owner chose this in the message that came with this handoff: the execution method (subagent-driven or native) and whether to commit after each task. Use what they said. If they didn't say, ask with `AskUserQuestion` before Task 1, with "Subagent-driven, commit per task" as the recommended option.

- **Subagent-driven:** use `superpowers:subagent-driven-development`. A fresh implementer works each task, and a fresh reviewer checks it against the plan and spec before the next task starts. Give each implementer its task, the Global Constraints, the Interfaces blocks of the tasks it consumes, and the hard rules below, word for word.
- **Native:** use `superpowers:executing-plans`. Finish with one whole-branch review by a fresh reviewer.

Tasks run in order, 1 to 12. Each one ends green on its own verify step.

## Hard rules (bind you and every subagent)

- Never run `pnpm build`. Type-check and lint only under the lock: `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock pnpm tsc` and the same for eslint. Logic checks run with `pnpm tsx scripts/verify-trade-scene.ts` (and `scripts/verify-bill-cut-claims.ts`).
- No DB writes of any kind, not even for testing.
- Browser sign-in goes only through `/api/dev/playwright-session?secret=…&as=info%40triprosremodeling.com`, read from the env. Never use `role=`. Never print the secret, the URL or a token. The scene is at `/dashboard/trade-scene`.
- Check light and dark, at 1280 and at 390. No UI task is done without your own screenshots.
- Commit by explicit path only. Never stage `docs/**` or `CONTEXT.md`. Never use `git add -A`, stash, reset, `checkout --`, restore, amend, merge, rebase or push. Run `git diff --cached` before every commit and every dispatch. Other sessions commit on this branch, so never stage, revert or "fix" their hunks. The Claude pre-commit hook takes about 110 s, so give `git commit` a long timeout.
- Protected files: `package.json`, eslint and tsconfig, `src/shared/components/scene/**`, `globals.css`. Ask before editing any file the plan doesn't name. The plan's §Files and the spec's §8 list every allowed file, including the extra files the owner approved in R227.
- Ask before clearing `.next`, and run `ss -ltnp` first.
- Code style:
  - Comments say why, never what, and never cite plans, specs or tasks.
  - One component per file. Constants go in `constants/`, pure helpers in `lib/`.
  - Named exports.
  - Copy lives only in `home-scene-copy.ts`. Never "your", never solar.
  - Copy functions take at most 3 arguments, because the copy walk in `verify-trade-scene.ts` enforces it.
  - Never name a type `Benefit`; a line in the window is a `BenefitLine`.
- Company facts come only from `src/shared/constants/company/`.
- If a doc, memory or plan line disagrees with the code, stop and report it as `⚠️ Stale ref — <doc>:<line> says X, but code at <path> does Y`. Favour the code.
- If the owner rules on something new, log it as the next R-row (R228 onward) in the tracker that day, and fold it into the plan and spec.

## Stop points

- Any task whose verify step fails twice with no clear cause: stop, use `superpowers:systematic-debugging`, and report before you carry on.
- Task 11 (full verification): show the owner the screenshots of light and dark at 1280 and 390, plus the check output, before polishing.
- Task 12: run `/impeccable polish` on the Benefits interior, apply it, re-verify once, then stop. Don't push, don't open a PR, and don't start follow-ups (spec §10).

## Final report to the owner

- What was built, task by task, with the commit SHAs if commits were made.
- The check results, quoted: tsc, eslint, both verify scripts, and the Playwright check `.superpowers/sdd/2026-11-03-trade-scene-benefits/benefits-check.mjs`.
- Screenshots, or their paths.
- Anything skipped or deviated from, with the reason.
- Open items: the disclosure still pending sign-off (D21), the spec §10 follow-ups, and the three stale memory refs.
- A table of changed files as clickable links.
