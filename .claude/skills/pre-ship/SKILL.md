---
name: pre-ship
description: Use when the owner says "/pre-ship", "pre-check before we push", "are we good to push to prod", "don't ship garbage", "sift through what we're shipping", "clean out the working tree and ship", "how risky is shipping X", "merge risk", or before any push of local main (the workbench) to origin/main (prod).
---

# Pre-ship

Local main is a shared workbench; origin/main is prod. Many sessions commit here, so the range mixes finished fixes, features waiting on an owner check, and stopped work. The goal is to ship every feature that is ready and hold back everything that is not, with a ship card per feature as the evidence. **Never push, force anything, run `pnpm hotfix sync`, or touch the prod DB** — the owner pushes after reading the verdict.

## Workflow

Copy this checklist into the todo list and work it in order.

1. **Preflight** — `bash .claude/skills/pre-ship/scripts/preflight.sh` (read-only). Staged index not empty → STOP and ask: another session staged it. `behind` > 0 → prod has hotfixes main lacks; ask the owner to run `pnpm hotfix sync` before you build anything, or every candidate would drop them. Note any other session committing in parallel (re-check `git log` before the verdict).
2. **Commit the working tree** with `/sc:git`, one logical commit per concern, staging **explicit paths only** (never `add -A`, `commit -a`, stash, checkout, reset). Commit only finished work; for in-progress files (half-edited, another session's, untracked WIP) ask whether to commit, leave, or hold. Run `pnpm tsc`, `pnpm lint`, and the `scripts/verify-*.ts` touched by the range before each code commit.
3. **Map the range into features** — every commit oldest first, grouped by feature. For each feature find its **intent**: memory file (`MEMORY.md` index), tracker under `docs/plans/`, spec or plan, owner rulings. Read them for status words: *unpushed, owner check pending, stopped, superseded, not applied, WIP, gate*. Mark a feature **half-done** if the owner stopped it or is about to retune it, even if it compiles. Write the map to the scratchpad; every later step reads it.
4. **Clean-checkout check** — `git worktree add --detach <scratchpad>/head-wt main`, symlink `node_modules`, copy `.env*`, regenerate `next-env.d.ts` (REFERENCE §Gotchas), then tsc, lint, `pnpm theme:check`, the verify scripts. Only a clean checkout tells you what ships.
5. **Fan out reviewers** in ONE message, in the background, all read-only: 4–6 `general-purpose` area reviewers (REFERENCE §Reviewer prompt) plus one `convention-auditor` that scores every feature's architecture out of 10 (REFERENCE §Architecture prompt).
6. **Verify every HIGH/BLOCKER yourself** before repeating it — read the code, run a script under `TZ=UTC`, etc. Drop what you cannot confirm or label it UNVERIFIED. A doc that disagrees with the code is reported as `⚠️ Stale ref`.
7. **Fix** — confirmed must-fix defects go to a fix subagent (REFERENCE §Fix prompt), grouped so no two agents touch the same files and none touches files another session is editing. Re-verify its commits yourself (tsc, lint, the repro).
8. **Ship cards** — fill one card per feature (REFERENCE §Ship card). The card's decision is final for the candidate: **ship**, **ship after owner check**, or **hold**.
9. **Release candidate** — pick its shape from the held features (REFERENCE §Candidate shapes): prefix push, or a revert candidate in the worktree. Hunt dangling references (REFERENCE §Dangling) and rerun step 4's checks on it.
10. **See it** — a visual subagent runs the candidate on its own port and compares it with the live site (REFERENCE §Visual prompt). Open the worst screenshots yourself. Update the Verification line of every card the screenshots cover; a regression turns its card to hold or a fix.
11. **Verdict** — report in the shape of REFERENCE §Report, ship cards included. End with the exact push steps, the exact way main records the release, and one question: which fixes to dispatch next, or ship as is.

## Rules

- Read-only reviewers; one fix agent per file set; explicit-path commits with the session's attribution line.
- Evidence over vibes: every finding and every card verdict carries file:line or the evidence path.
- A feature under 8/10 architecture is not "ship" unless the owner waives it in this run.
- Production-only failure classes get extra attention: see REFERENCE §Prod-only traps.
- Keep the worktree and scratch branch until the owner decides; tell them where it is.
