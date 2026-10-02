---
name: pre-ship
description: Critical pre-push audit of everything on local main that is not yet on origin/main (prod) — commits the working tree logically, reviews the range with parallel read-only subagents, finds half-done features, hands confirmed defects to fix subagents, builds a release candidate that holds back unfinished work, compares it against the live site in a browser, and ends with a ship / hold verdict. Use when the owner says "/pre-ship", "pre-check before we push", "are we good to push to prod", "don't ship garbage", "sift through what we're shipping", "clean out the working tree and ship", or asks to review main before a prod push.
---

# Pre-ship

Local main is a shared workbench; origin/main is prod. Many sessions commit here, so the range mixes finished fixes, features waiting on an owner check, and stopped work. The goal is to ship every correction that is ready and hold back everything that is not, with evidence. **Never push, force anything, or touch the prod DB** — the owner pushes after reading the verdict.

## Workflow

Copy this checklist into the todo list and work it in order.

1. **Preflight** — `bash .claude/skills/pre-ship/scripts/preflight.sh` (read-only). If the staged index is not empty, STOP and ask: another session staged it. Note any other session committing in parallel (re-check `git log` before the verdict).
2. **Commit the working tree** with `/sc:git`, one logical commit per concern, staging **explicit paths only** (never `add -A`, `commit -a`, stash, checkout, reset). Commit only finished work; for in-progress files (half-edited, another session's, untracked WIP) ask whether to commit, leave, or hold. Run `pnpm tsc`, `pnpm lint`, and the `scripts/verify-*.ts` touched by the range before each code commit.
3. **Map the range** — list every commit oldest first and group them by feature. For each feature read its memory file (`MEMORY.md` index) and tracker under `docs/plans/` for status words: *unpushed, owner check pending, stopped, superseded, not applied, WIP, gate*. Classify each feature **ready / waiting on owner / half-done**. A feature the owner stopped or is about to retune is half-done even if it compiles.
4. **Clean-checkout check** — `git worktree add --detach <scratchpad>/head-wt main`, symlink `node_modules`, copy `.env*`, regenerate `next-env.d.ts` (see REFERENCE §Gotchas), then tsc, lint, `pnpm theme:check`, the verify scripts. The main tree has other sessions' edits; only a clean checkout tells you what ships.
5. **Fan out reviewers** — 4–6 read-only `general-purpose` subagents in ONE message, one per area from step 3, using the reviewer prompt in [REFERENCE.md](REFERENCE.md). Run them in the background.
6. **Verify every HIGH/BLOCKER yourself** before repeating it — read the code, run a script under `TZ=UTC`, etc. Drop what you cannot confirm or label it unverified.
7. **Fix** — confirmed must-fix defects go to a fix subagent (REFERENCE §Fix prompt), grouped so no two agents touch the same files and none touches files another session is editing. Re-verify its commits yourself (tsc, lint, the repro).
8. **Release candidate** — if anything is half-done, on a scratch branch in the worktree `git revert` those commits newest first; on conflict abort and report the dependency. Then hunt dangling references (REFERENCE §Dangling) and rerun step 4's checks. If nothing is half-done, the candidate is main.
9. **See it** — a visual subagent runs the candidate on its own port and compares it with the live site (REFERENCE §Visual prompt). Open the worst screenshots yourself.
10. **Verdict** — report in the shape of REFERENCE §Report. End with the exact push steps and one question: which fixes to dispatch next, or ship as is.

## Rules

- Read-only reviewers; one fix agent per file set; explicit-path commits with the session's attribution line.
- Evidence over vibes: every finding carries file:line and a concrete failure scenario.
- Production-only failure classes get extra attention: see REFERENCE §Prod-only traps.
- Keep the worktree and scratch branch until the owner decides; tell them where it is.
