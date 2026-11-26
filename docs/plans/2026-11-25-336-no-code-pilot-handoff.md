# Handoff: #336, first step of the no-code flow pilot (#369)

Work in the main checkout on `main` (`origin/main` was `45875c3d3` at handoff). No worktree, no branch, no PR, no `/to-spec`, no `/to-tickets`. #336 changes no code, so it runs as the pilot of #369, the flow for work that changes no code (ruling SL5).

## Read first, in this order
1. `docs/plans/2026-11-23-move-live-work-onto-issues-epic.md`, the #336 tracker. Read the Status block, the Buckets table, Rulings (EB1–EB8, SL1 struck, SL2–SL5), Gaps 1–16, and "Original request", steps 1–5.
2. #369's body (`gh issue view 369`). It gives the flow's starting shape: **Ask → Inventory → Dry run → owner "apply" → Apply → Read-back → Log**. It also lists what the pilot has to settle.
3. #336's body (`gh issue view 336`). It is the contract: Done when and Out of scope.
4. `docs/agents/issue-tracker.md`, then the "Docs (WF16)" bullet in the GitHub workflow section of `CLAUDE.md`.

Verify before you trust any of this. If the tracker and the code or git disagree, stop and flag it as stale.

## The task: bucket 1 and 2 prunes, run as one pilot unit
The GitHub half of buckets 1 and 2 is done: epics #354 and #355, plus their plan issues. The tracker status blocks on the lane branches and the memory moves are done too (`f1ab8d8ee`). What is left is the prune: about 15 data-view and filter-rule plan and spec files on `main` that are shipped or superseded.

Walk it through #369's stages and stop at the gate:

1. **Ask.** One line restating the unit: which files are in scope and what "done" means.
2. **Inventory** (read-only, with evidence). For each candidate file under `docs/plans/` and `docs/superpowers/`, record:
   - state, with proof (a merged PR or a SHA on `origin/main`);
   - where its leftovers go (which issue or tracker now holds them);
   - what still points at it (`grep` across `docs/`, `CLAUDE.md`, `memory/`, issue bodies);
   - whether an open lane changed it. Compare `feat/data-views` and `feat/filter-rules` with `main`. Those lanes changed up to 24 docs files on their branches.

   A file may be deleted only if all four checks pass (shaping outcome 3). If a lane changed a file, it stays.
3. **Dry run.** Write a file in your scratchpad with:
   - the per-file ledger (file · state · proof · leftovers' home · pointers · lane-changed? · last SHA);
   - the exact `git rm` and pointer edits;
   - the milestone comment for #336 (EB4: a short dated note that links the commit).

   Then show the owner a short list of the files to delete and stop.
4. **Apply**, only after the owner says "apply":
   - Commit by explicit path on `main` and push.
   - `git merge origin/main` into every branch under `.worktrees/`.
     - Skip `review` (detached) and any worktree that is mid-merge.
     - On a conflict, run `git merge --abort` and report it.
   - Then post the milestone comment on #336.
5. **Read-back.**
   - `git ls-tree origin/main` shows the files gone.
   - `grep` finds no dangling pointers.
   - The comment shows on #336.
6. **Log.**
   - Add a tracker Log line.
   - Update the Status block and the bucket 1 and 2 rows.
   - Add a numbered gap for anything the flow got wrong or left unclear. Gaps are #369's evidence, so name the stage.

After that, buckets 3–8 can run in parallel the same way (SL3). They wait on these:
- Bucket 7 waits on trade-scenes' uncommitted docs being committed.
- Bucket 8 waits on `issue-285` merging `main`. It conflicted on 2026-11-24 and again on 2026-11-25.

Bucket 9 runs last.

## Things the pilot should notice and log as gaps (feed #369)
- The tracker's **Context** section still has the bullet "How this epic runs", which says `/to-spec #336` and `/to-tickets` with "each bucket a plan issue". SL5 and the struck SL1 contradict it. Fix it in place in the same docs commit, and list the fix in the dry run.
- Shaping outcome 4 mentions "eight checks" per bucket, but the tracker never lists them. Say what you actually checked.
- **Board row:** #369 proposes "a board row with no branch", which is not settled. Don't create a row. Log what was missing without one.
- **Access:** note which access each write used: `gh` CLI, the git remote, and `ArtifactData` if you read the board. Note how you proved the target before writing (repo, branch). #369 needs this for its per-service access rule.

## Hard rules
- Only Oliver starts a dev server. Never run `pnpm dev`, `next dev` or `pnpm build`.
- Every push to `main`, GitHub write or board write follows the same order: a dry-run file first, then the owner says "apply", then the write, then a read-back.
- Re-read the live object right before each shared write (gap 12). For example, `gh issue view 336` again before you comment.
- Commit by explicit path. Never force-push, rebase, stash or reset.
- Never touch other sessions' uncommitted files. Today these are `scene-layout-lab` (`CONTEXT.md`), `trade-scenes` (the convention-auditor ledger), and `issue-285`'s untracked `CLAUDE.local.md`.
- To override a ruling, strike the original row in place with `~~`, then add the new text.
- Scripted edits use Python with `newline=''`. Check `git diff --shortstat` afterwards.
- End with a short report: what was deleted, the commit SHA, the lane merge results, the new gaps, and the next unit.
