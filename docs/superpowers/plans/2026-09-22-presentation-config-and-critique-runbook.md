# Spec C execution runbook — Who We Are, presentation config and critique

> **Read this before dispatching anything.** It is the operating procedure for running
> `2026-09-22-presentation-config-and-critique.md`. The **spec** is the binding authority, the **plan** is
> its argument and carries the code, and this runbook says how the run is conducted, where the owner is
> asked, and what stops the run.

**Plan:** `docs/superpowers/plans/2026-09-22-presentation-config-and-critique.md` (10 tasks, ~4.6k lines, revised 2026-09-22 for spec §12)
**Spec:** `docs/superpowers/specs/2026-09-20-presentation-config-and-critique-design.md`
**Tracker:** `docs/plans/2026-09-14-upgrading-meeting-flow-epic.md` (row C)
**Workspace:** `$WS` = `.superpowers/sdd/2026-09-22-presentation-config-and-critique` (git-ignored)

## 0. Where things stand at hand-off (2026-09-22)

| Fact | Detail |
|---|---|
| H1 gate | **Released.** Step 2's V1 failures are fixed (`725954a9`, `77c30a9f`) and re-run: 28 PASS / 3 FAIL / 0 NOT RUN, report `.superpowers/sdd/2026-09-14-specialties-stage-and-rail/task-v1-rerun-report.md` |
| The 3 remaining FAILs | Contrast on shared tokens. **Owner: follow-ups, not part of this run** (§7) |
| Branch | `main`, unpushed. Nothing is pushed without the owner saying so |
| Other sessions | A construction-p1 session commits in `src/features/meeting-flow/**` concurrently. Treat every foreign hunk as a hard stop |
| Dev server | Port 3000 is the owner's. Never start, stop or restart it. It compiled CSS at boot; `touch globals.css` does **not** make it recompile |
| Uncommitted docs | Spec C, the plan, this runbook and the tracker edits are untracked or modified on purpose |
| Semantics | **Grilled 2026-09-22; spec §12 is binding.** The engine lives in `src/shared/components/presentation/`; beat → slide; frame `'column' \| 'full'`; vocabulary in `CONTEXT.md#presentation-terms`. The plan was revised to match; Task 4 now includes the move |

## 1. Pre-flight, before Task 1

**Owner, first:** commit the `docs/design-system/DESIGN.md` motion-gate amendment (lines 63–65, working tree only). HEAD still mandates `useReducedMotion()`, the plan cites the amended rule, and the executor may not touch `docs/design-system/**`.

1. **Load the skill:** `superpowers:subagent-driven-development`, with the plan path. Read the spec and the
   plan's Global Constraints once. Do not paste either into a dispatch.
2. **Workspace and ledger:** run the skill's `scripts/sdd-workspace <plan>`. First ledger line names the plan.
   Copy the plan's "Before Task 1" answers and §3's gates into the ledger.
3. **Foreign-work snapshot:** record `git status --short` for `src/features/meeting-flow/**` and the staged
   entry count N. Re-read both before every commit; N must come back unchanged.
4. **scrim.tsx:** commit the other session's one-line doc comment on its own, path-only, as
   `docs(who-we-are): scrim doc comment`. Do this at pre-flight, not mid-Task 4.
5. **Harness:** create `$WS/tools/` and `$WS/checks/`. Port `build-css.mjs` and write `common.mjs` with
   `setup`, `buildCss`, `openStep1`, `dismissSplash`, `deckState`. **Never copy a built `.css` from an older
   workspace** — `injectCss` takes a path built this run and throws when it is missing.
6. **Conflict scan:** one table row per task pair that shares a file or an interface, one row per task for
   self-consistency. Write the table to the ledger, rule on every finding, then dispatch Task 1.
7. **Todos:** one per task, so a compaction mid-run can be recovered from the ledger plus `git log`.

## 2. The task loop

Per task, in order:

1. Record `BASE` (`git rev-parse HEAD`).
2. `scripts/task-brief <plan> N` → dispatch one implementer with: one line of context, the brief path,
   interfaces from earlier tasks, your resolution of anything ambiguous, and the report path. Nothing else.
   No implementer dispatches subagents; review comes from the controller.
3. **Model:** cheapest tier where the brief carries the full code (Tasks 1, 2, 3, 5, 7); mid tier for
   integration and judgment (Tasks 4, 6, 8, 9, 10). Always name the model explicitly.
4. **Test first, every time.** The check is written and *seen failing* before the implementation. A null
   measurement is a FAIL, never a pass. Pure functions get a `$WS/checks/*.ts` assertion script.
5. On DONE: `scripts/review-package <plan> BASE HEAD` → task review (spec compliance **and** quality, both
   verdicts required). Fix rounds: resume the implementer for rounds 1-3, fresh implementer one tier up for
   4-5, scoped re-review after each round.
6. **Commit the task** with the plan's exact commit recipe (owner confirmed per-task commits), then append
   the ledger line and tick the todo.

### What stops the run (ask the owner, never rule)

- Anything outside the task's brief, any shared component, or the realtime/data path.
- An off-limits path (`src/trpc/**`, `src/shared/entities|modules|db|services|dal/**`, `docs/design-system/**`, `scripts/**`).
- A foreign uncommitted hunk in a file the task must edit.
- A spec/plan conflict where both readings are defensible, or a check that can only pass by changing the spec.
- Anything irreversible or outward-facing: a push, a shared branch, a production or R2 touch.

Everything else is a ruling: decide, log `Ruling: <what> — <why> — <cost if wrong>`, keep going.

## 3. Owner gates (four, plus the final report)

At each gate the controller posts: what changed, screenshots from `$WS/tools`, every ruling made since the
last gate, and anything that looks off. The owner says go or adjust; an adjustment becomes a fix round inside
the current task, not a re-plan. Between gates the run does not stop for progress reports.

| Gate | After | What the owner sees |
|---|---|---|
| **A** | Task 2 | The type scale and palette in place: step 1 at 1440 and 820 with the six role tokens, the new accent `#5cc6f2` (step 2 reads it too), capsule clearance. Centre-line activation evidence from Task 1 |
| **B** | Task 4 | The restructure and the engine's move to shared: every slide at 1440 (column) and 820 (band), the heading column per run, keyboard jumps, the deleted and moved files list, and `pnpm tsc` clean with no import left on the old meeting-flow paths |
| **C** | Task 6 | The content pass: bathroom photos, agent card and monogram, documents and tap cue, reputation grid — nothing unfinished, nothing tilted |
| **D** | Task 8 | The splash: the press sequence, the reduced-motion still, focus handback, and the `sessionStorage` key behaviour. Name two things: `PwaSplashScreen` inherits the primitive change though it is not edited beyond that, and the splash gates on step 1 with write-on-press (beyond E5's text) |
| **Final** | Task 10 | Six-size screenshots, the zoom pass, the impeccable critique score, the NOT RUN list, and the follow-ups |

**Dev server:** every browser check injects a CSS build made from source that run, so no check reads a stale
sheet. The live server will not show new classes until the owner restarts it; the controller says so at each
gate rather than restarting anything.

## 4. Anti-slop guards

These are the specific ways this work has gone wrong before, and what prevents each.

| Failure mode | Guard |
|---|---|
| A check measured a stale stylesheet (V1's G1 read round 1's CSS and reported a false 30px) | Build CSS from source per run; `injectCss` throws on a missing path; never reuse another workspace's sheet |
| A check passed vacuously (an animation filter with no `type`, a capsule selector that matched nothing, a fiber walk capped at depth 120) | Watch every check fail first; print the keys or elements it depends on; scope selectors to `[data-step-root]` / `[data-splash]` |
| A check measured the wrong element (Task 8's "outcome" was a sibling at 14px) | Assert the element's own identity — text, role, or a `data-` marker the component sets |
| A script left the dev meeting dirty, or a forced click hit an overlay | Step 1 writes nothing but `sessionStorage`; no `force: true`; any script that writes restores and verifies |
| Unapproved scope creep (the reverted realtime work, 2026-09-16) | The owner rule in §2; declined alternatives never return |
| Design drift | Sizes only from the six role tokens; spacing from `gap-presentation-*`; no `font-medium`; no new colour literals; no viewport variants in presentation code after Task 6; utility classes stay in `.tsx` |
| Vocabulary drift | No "beat", "section", "pinned" or "stage" in engine code, names or new comments; names exactly as spec §12 and `CONTEXT.md#presentation-terms` give them. The task review greps for the avoid-words |
| Review theatre | Both verdicts required per task; scoped re-review after every fix round; final whole-branch review on the most capable model |
| Git accidents in a shared tree | Pathspec commits only; no `add -A`, stash, reset or broad restore; staged count N verified before and after |
| A stale doc quietly misleading the next session | Ping the moment it appears: `⚠️ Stale ref — <doc>:<line> says X, but code at <path> does Y` |
| A verification that never reaches the owner (V1 sat unreported for five days) | The verification task's results go in the ledger **and** the gate message the day they are measured |

## 5. Known risks

- **Task 4 is the largest task by far** (the engine's move to `src/shared/components/presentation/`, runs, frames,
  one `Slide`, ten who-we-are views, the deletions). If the implementer reports BLOCKED, or the task review returns
  more than five findings, split it at its own seam — the engine move first, the who-we-are views second — and note
  the split in the ledger. No `git mv`: it pre-stages renames and breaks the recipe's staged-count check.
- **Concurrent meeting-flow edits.** The other session touched `use-trade-catalog.ts` and
  `lib/group-scopes-by-trade.ts` today. Task 4 and Task 8 touch `meeting-flow.tsx` and the shell; re-check
  `git diff --stat` on each file immediately before editing it.
- **The splash is the riskiest surface for the homeowner-facing moment**: it takes over the screen, holds
  focus, and has a capture-phase key listener. Gate D exists for that; do not fold it into an earlier gate.
- **Tailwind's `.ts` scan gap** means a class that only ever appears in a `.ts` file renders as nothing.

## 6. Done means

- All 10 tasks committed on `main`, each with its own commit and ledger line.
- Final whole-branch review clean; `pnpm tsc` and `pnpm lint` clean (never `pnpm build`).
- Task 9's docs landed: `src/features/meeting-flow/DOCS.md`, spec status lines, tracker row C, memory.
- Task 10's report lists what passed, what failed and what could not run, with evidence.
- Follow-ups logged (§7). Nothing pushed; the owner decides that separately.

## 7. Follow-ups carried into this run but not part of it

1. **Contrast, three items** (owner decision 2026-09-22, measured in the step-2 re-run report): muted labels
   over the CRM shell's radial glow read 3.91–4.41 in light mode; white on `--primary` reads 3.68 on every
   default button; `text-destructive` ghost text reads 3.76 light / 4.35 dark. All are shared tokens and
   deserve their own scoped pass.
2. **Dev server restart** before the owner judges the top bar (`77c30a9f`) or any new presentation class.
3. **`820` top-bar overlap** (step-2 audit E6) — likely resolved by `77c30a9f`; verify when convenient.
4. From step 2's round 2, still open: `/dashboard/meetings` hydration flake, the cadence-dialog toast gap,
   the unused `ui/sonner.tsx`, and the stuck "Syncing…" indicator.
5. **Rename the pre-existing feature types** `PresentationAgent`, `PresentationDocument`, `PresentationPartner`: their prefix now reads as the engine's (spec §12 S3). Shipped names, out of this run's scope.
