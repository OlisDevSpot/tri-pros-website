# Handoff: build the trade scene gutters plan and the black-reads-brown fix

**Written:** 2026-11-10, at `afeb0ae11`.
**For:** a fresh session that builds this plan.
**Your job:** build `docs/superpowers/plans/2026-11-09-trade-scene-gutters.md` (Tasks 0 to 7), stopping after Task 1 for the owner's look.
**Worktree and branch:** `.worktrees/trade-scenes`, `feat/trade-scenes-foundation`. Build here. No new worktree, no new branch.

**Do not start until the owner has said "build", "execute" or "run" and picked a method.** "Go ahead" is not a build call. Neither has happened at the time of writing. Subagent-driven was recommended, because later tasks depend on names set by earlier ones.

## 1. Where things stand

| | |
|---|---|
| Plan | `docs/superpowers/plans/2026-11-09-trade-scene-gutters.md`. Untracked. Stress-tested and amended 2026-11-10 |
| Spec | `docs/superpowers/specs/2026-11-07-trade-scene-gutters-design.md`. Untracked. Its "Owner rulings, 2026-11-10" section overrides anything older in it |
| Tracker | `docs/plans/2026-10-16-trade-scenes-epic.md`, rows R283 (done), R284 (gutters), R285 (black reads brown). Uncommitted, and it holds other sessions' hunks |
| Glossary | `CONTEXT.md` gained "Gutter condition". Uncommitted, also shared |
| Code | Nothing built. The only `src` change in the tree is another session's `feltAged` hunk in `F/constants/home-palette.ts` |
| Workspace | `.superpowers/sdd/2026-11-09-trade-scene-gutters/` holds only `oc-swatches-report.md`. No ledger yet, so start one |
| Dev server | The owner's, on :3002, serving this worktree. It answered at the time of writing |

## 2. What to do, in order

1. Read the plan, then the spec. The plan's Global Constraints are binding and cover commits, forbidden git, sign-in, checks and copy.
2. Check `git log` and `git status --short -- src scripts`. The branch moves under other sessions, so the plan's line numbers may have drifted past `afeb0ae11`.
3. Task 0: the baseline, on the owner's server, before anything changes.
4. Task 1: the light and the Owens Corning hexes. **Then stop, list the shots and wait.** The owner asked for this because the light changes every Normal and Summer scene. It overrides subagent-driven's "don't stop between tasks". Any retune lands before Task 2.
5. Tasks 2 to 7 once the owner has looked.

## 3. Owner rulings: do not reopen these

All from 2026-11-10 unless marked.

- **The gutter condition (`gutterWear`) is a resolver input,** so the card's part list, the up-close rain path and the drawing agree. It moves no savings and no water. The two colours stay drawing-only.
- **The gutters' own condition decides whether + Gutters is offered,** not the roof's. Failing gutters on a new roof can be sold. Gutters set to New are not offered, even on a worn roof.
- **A gutter at Good is `retained` and reads "Gutters" on the card,** because it draws clean. Only Fair and worse read "Old gutters". This applies whether the Good was set or inherited from the roof.
- **No Gray** for now.
- **Modify keeps "Missing" for gutters not set,** while the chip reads "No gutters".
- **The gutters' condition is findable in Modify** while the home has gutters (the `'gutter-wear'` slot).
- From 2026-11-07: not set stays a choice but draws none; Existing defaults to Almond; Proposed defaults to the existing colour, else White; a tear-off adds no gutters; no supplier chart; nothing is saved to a proposal.

## 4. Calls made at the stress test that a reviewer may question

Each was weighed. Reopen one only with new evidence from the code.

- **`GutterChip` was dropped; `ExistingChip` is extended.** That chip already owns the gutters slot, so a fork would drift from its header, tone and dots wrapper.
- **`GutterWearDots` stays as one small adapter,** though a reviewer wanted none. It needs store reads that would bloat `ExistingChip`.
- **`WearScale` is copied unchanged from `feat/scene-layout-lab`** so that branch merges cleanly. `existing-chip.tsx` will still conflict at that merge, because the lab moved the group headers into the group bodies. The lab's `ConditionMenuGroup` was not adopted.
- **`partWear` special-cases the gutter** instead of reading every part's resolved wear, so no other part's offer changes.
- **The wall's overflow stain joins `stains.front` in `HouseShell`.** The front wall exists only in the Complete fade group, so a stain drawn with the gutter would float on a partly-open home.
- **`gutterPart` doesn't reuse `drawnPart`'s result as is,** because the Good rule differs from it.

## 5. Traps the plan doesn't fully spell out

- **The probes render in software.** A multi-case sweep crashed the owner's machine (CPU over 1000%). One case per process, under `heavy.lock`, and pass this rule to every subagent.
- **`black-probe.mjs` only has the `black` set** (`night-sky-normal`, `night-sky-rain`, `night-sky-summer`, `midnight-normal`, `shasta-white-normal`). Task 0 and Tasks 5 to 7 need cases added to its `SETS` for gable, flat, and gutters at a given condition. It's gitignored, so edit it freely. Its harness already has `info` and `closeUp`, and `measure` already takes `'gutter'`.
- **`task-brief` extracts only the task's text.** Global Constraints don't travel with it. The last build kept them in a `global-constraints.md` in its workspace (`.superpowers/sdd/2026-11-06-trade-scene-colour-picking/`). Do the same.
- **`F/` and `CORE/` are the plan's shorthand** (defined in Global Constraints). Say so in each dispatch.
- **Comments in briefs get copied.** Plan text must not reach the code as "Review Focus N" or a task number. Grep before the final review.
- **Other sessions share this tree.** Commit only through `commit-own.sh`, which builds the commit in a throwaway index. Task 3 edits `home-palette.ts`, so snapshot your hunks to `foreign/` (create it) and pass `patch:<file>`. `feltAged` is clear of the lines you delete.
- **In parallel shell calls, use `git -C <path>` and absolute paths.** Two parallel `cd`s have returned output from the wrong checkout.
- **Never `docs/**` or `CONTEXT.md` in a commit.** Tracker and spec edits are the controller's, left unstaged.
- **Keep the workspace after the final review,** despite subagent-driven's cleanup step. It holds the source table and the owner's shots until the owner has looked.
- **Don't run `finishing-a-development-branch`'s merge or push options.** The owner decides shipping, and this branch is never pushed. The next release is a new branch off `origin/main`; see memory `project-trade-scene-ship-2026-11-04.md`.

## 6. What hasn't been proven

- **Task 1's light numbers have never been rendered.** They're computed to keep each light's luminance. The measured facts are the before (frame rgb(76, 58, 46) under Normal) and the white-lights control (rgb(79, 79, 81)). Expect Step 3's retune loop to run.
- **The amended plan hasn't been compiled.** Its signatures were checked against the code by reading.
- **Savings equal across no gutters and gutters on a tear-off plus Gutters build** is expected from reading `installKind` and `scene-savings.ts`, and has not been run. Task 2 says to stop and report if they differ. Do that rather than loosening the check.
- **The sag, pulled-section, streak and hex values are working numbers,** settled by screenshot and by the owner's eye.

## 7. When the build is done

- Update R284 and R285's status in the tracker, unstaged.
- List for the owner: the commit range, the shot paths, the frame-cost table against Task 0, and the working numbers still to look at (lights, gutter hexes, looks).
- The owner still owes the iPad look.
