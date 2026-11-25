# Handoff: build the attic Look inside corrections

**Written:** 2026-11-11, at `aa4c59e38` (Gutters Tasks 1 to 7 done, its final fix wave still running).
**For:** a fresh session that builds this plan with superpowers:subagent-driven-development.
**Your job:** build `docs/superpowers/plans/2026-11-11-attic-look-inside-corrections.md`, Tasks 0 to 6, ending with the owner's look on the running page.
**Worktree and branch:** `.worktrees/trade-scenes`, `feat/trade-scenes-foundation`. Build here. No new worktree, no new branch.

## 0. Gates before you write any code

1. **Gutters must have finished.** Its final fix wave was still running when this was written, and it reshapes build-row chips (`existing-chip.tsx`, the build row menus), which Task 2 edits. Read `.superpowers/sdd/2026-11-09-trade-scene-gutters/progress.md`: the final fix wave must read done and committed, and `git status --short -- src scripts` must show none of its files. If not, stop and tell the owner. Never build alongside it.
2. **Covering wear must not have started.** The owner ruled on 2026-11-11 that this plan builds first. If `.superpowers/sdd/2026-11-11-covering-wear/` exists with commits in its ledger, stop and ask the owner. Its handoff (`docs/superpowers/handoff/2026-11-11-covering-wear-build-handoff.md`) does not yet carry this ordering: tell the owner so it gets a gate line.
3. **The owner must say "build", "execute" or "run".** "Go ahead" is not a build call. The method is subagent-driven.

## 1. Where things stand

| | |
|---|---|
| Plan | `docs/superpowers/plans/2026-11-11-attic-look-inside-corrections.md`. Untracked. Stress-tested with 4 lenses and amended 2026-11-11. Its **Design** section is the spec; there is no separate spec file |
| Tracker | `docs/plans/2026-10-16-trade-scenes-epic.md`. R297 is NOT written yet: Task 0 writes it, plus a §2 order row and a change-log row. Uncommitted, and it holds other sessions' hunks |
| Code | Nothing built. `src/features/trade-scenes/constants/home-palette.ts` holds the covering wear plan's `feltAged` hunk: never stage it |
| Workspace | None yet. Start `.superpowers/sdd/2026-11-11-attic-look-inside/` with a `progress.md` ledger and a `global-constraints.md` (see §5) |
| Dev server | The owner's, port 3002 (`.env.local`). Only Oliver starts one. Check with `ss -ltnp \| grep :3002`. If nothing answers, ask him |

## 2. What to do, in order

1. Read the plan in full. Its Design, Global Constraints and Review Focus are binding.
2. **Re-derive the plan's references.** They were checked at `aa4c59e38`; the Gutters fix wave lands after. The plan cites verify checks by assertion message on purpose; check each task's files and "about NN" lines before you dispatch it, and note any change in the ledger.
3. Run the checks once for a green baseline: `pnpm tsx scripts/verify-trade-scene.ts`, `verify-trade-scene-layout.ts`, `verify-construction-model.ts`, then tsc and lint under the lock (§5).
4. Run Tasks 0 to 6 in order, each with an implementer and then a reviewer. Later tasks use the exact names from earlier tasks' Interfaces blocks.
5. You (the controller) take the screenshot steps yourself, not a subagent (§5).
6. Task 6: the final check set, the leftover grep, the owner's shots, then wait for the owner's look. Tune the working numbers to their rulings.
7. Run the final whole-branch review only after the comment grep in §5.

## 3. Owner rulings: do not reopen these

- **Air sealing doesn't replace the ceiling, it seals the ceiling's openings.** The ceiling never disappears in attic Look inside. One row: "Ceiling leakage" unsealed, "Ceiling air sealed" sealed; no separate Air sealing row.
- **Today can be sealed** through a chip on the attic card, "Not air sealed" (default) or "Air sealed", built like the Gutters chip. A home sealed today is not offered air sealing in the build ("Already air sealed").
- **Dust** sits on the ceiling round each light can, pipe and duct boot of an unsealed home, under the insulation, seen only where the blanket is cut back. Sealed openings show foam and no dust.
- **Debris on the insulation grows with wear:** New clean, Good mild ("Good should have mild dust/debris (amount grows with wear)"), heavy on Failing, sealed or not. A top off is clean.
- **The attic opens at its left end,** over the left room's joist bay with its can and boot. **The left vent pipe moves next to them** ("Move the plumbing pipe closer to the boot/can light (either same in-between joist space or one next to it)"). The strip stays one step deep (0.8 m). The camera stands at the left end and looks along the attic.
- **Roof Look inside and heating & cooling Look inside are unchanged.**
- **Order:** this plan before covering wear (2026-11-11).
- **Visual companion:** declined. Don't offer it.

## 4. Calls made at the stress test that a reviewer may question

Each was weighed against the code. Reopen one only with new evidence.

- **The chip shows on any roof but flat** (`!== 'low-slope'`), not only pitched: an unset roof resolves as shingle (`infer-existing-conditions.ts`, `roofType ?? 'shingle'`), so it has an air-sealing part and a ceiling row.
- **`'already-sealed'` is a special case on purpose.** Without it a sealed home is offered sealing again: `partWear` is null for air sealing (no home material), and `sealed` has no energy rank.
- **The story key is `'sealing'` and the flag `sealable`,** never `'air-sealing'`/`airGaps`, so the leftover grep can tell the removed system part from the story.
- **`foam-collars-shown.ts` is deleted.** A flat roof never resolves an air-sealing part (its `forms` list), so the form check was dead.
- **Debris scales by `wornShare`** and lives in `wear-looks.ts` as `INSULATION_DEBRIS`, tuned at Worn like every other wear look. Specks lie only on tops nothing covers (batts carry a sheet over the bays).
- **Cut lines are a `STEP_CUTS` table** typed by `CutawaySystemId` beside `STEP_DEPTHS`, read behind `isCutawaySystem`; no casts.
- **The ceiling pin picks from `ceilingOpenings(false)`,** so a ductless home never gets a pin on a boot it doesn't draw.
- **Today's savings are always zero,** so Task 1 compares parts and the ceiling reading, never savings. Sealing moves the ceiling and the load, not the attic air in normal or summer weather.

## 5. Traps the plan doesn't fully spell out

- **Screenshots:** never sweep the scene in a software-rendered browser; a multi-case sweep crashed the owner's machine. The controller takes every shot, one page and one case per run, never in parallel, browser closed between runs. No subagent opens the scene. Pass this rule in every dispatch.
- **The probe is gone.** Task 2 Step 5 writes a new one (Playwright, sign in through `/api/dev/playwright-session`, memory `reference-playwright-auth.md`).
- **`task-brief` extracts only the task's text.** Global Constraints don't travel with it. Copy them, the Design section and §3–§5 of this file into `global-constraints.md` in the workspace and attach it to every dispatch.
- **Comments in briefs get copied.** Tell every implementer that the brief's test code is verbatim in its assertions, but its inline comments are notes: reword each to its reason or drop it. Before the final review, run `grep -rniE "review focus|plan call|task [0-9]|R29[0-9]" scripts src`.
- **Other sessions share this tree.** Commit only through `.superpowers/sdd/2026-11-06-trade-scene-colour-picking/commit-own.sh <message-file> <path>…`, with `patch:<file>` for a file that holds foreign hunks (snapshot those hunks to a `foreign/` folder in the workspace first). Never use `git commit -- <path>`, `git add -A`/`.`, `--amend`, stash, restore, reset or `checkout --`. Give each commit a 300000 ms timeout (the pre-commit hook is slow), then run `git show --stat HEAD`.
- **Heavy commands queue on one lock.** Run tsc and lint as `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock …`, one at a time.
- **In parallel shell calls,** use `git -C <path>` and absolute paths.
- **Never put `docs/**` or `CONTEXT.md` in a commit.** Task 0's tracker and glossary edits stay unstaged.
- **The moved vent pipe also moves its stub through the back slope** (`lib/vent-pipe-stub-cylinders.ts` reads `CEILING_OPENINGS`). No check kept pipes off the rafters before; Task 5 adds one. Shoot the back slope from outside on shingle and tile.
- **Draw calls:** the attic's worst case was accepted at 126. Debris adds one merged mesh per span (two when split). Report the new worst case; the owner judges it.
- **The flat roof's cut is not settled.** If, in Task 5's shot, the flat roof's faded deck covers the moved strip, stop and show the owner.
- **Keep the workspace after the final review.** The owner's look and the tuning rounds still need it.
- **Don't run `finishing-a-development-branch`'s merge or push options.** The owner decides shipping; this branch is never pushed directly. The next release is a new branch off `origin/main` (memory `project-trade-scene-ship-2026-11-04.md`).

## 6. What hasn't been proven

- **The amended plan hasn't been compiled.** Its signatures were checked against the code by reading, at `aa4c59e38`.
- **The pipe spot.** About (−4.45, −2.7) was worked out from `ATTIC_JOIST_XS` (−4.595, −3.995) and a rafter grid assumed to start at −6 + `rafterWidth` (about −4.755 and −4.155 here). Confirm `rafterWidth`'s source in `roof-slope.tsx` before Task 5's check.
- **The strip numbers.** `STEP_CUTS.attic = -4.65` puts the can, the boot and the moved pipe inside [−4.65, −3.85] with their foam clear; the blanket then runs about 9.7 m, 3.7× today's. All working numbers, set by screenshot.
- **The attic camera's sight check** (no opening between the camera and the heat marks) has not been run against a camera standing at the left end, right behind the openings. If it trips, move the camera or the heat marks; never weaken the check.
- **Debris and dust have never been seen.** `INSULATION_DEBRIS` and `ATTIC_DUST` are working numbers. Expect tuning rounds after the owner's look.
