# main ↔ #285 synchronization plan (2026-09-13)

Read-only analysis; nothing was committed, merged, stashed, or reset. Companion to the branch's own
`docs/plans/2026-09-07-casl-re-grounding/16-merge-rebaseline-2026-09-09.md` (report 16), which this doc
re-verifies against today's `main` and extends with main's uncommitted work.

## 1. Where the three states are

| Ref | SHA | Date | Notes |
|---|---|---|---|
| `origin/main` | `22974394` | 2026-08-24 | strict ancestor of local `main` (0 behind) → push is a plain fast-forward whenever wanted |
| `main` (local) | `15142414` | 2026-09-13 | 33 unpushed commits; 68 commits since the #285 fork point |
| `refactor/285-refactor-permissions-casl-scope-compiler` | `b40403b6` | 2026-09-06 | local only (no `origin/` branch); 74 commits since fork, incl. its own merge-from-main `31181df0` (08-18) |
| fork point / merge-base | `bd35a168` | 2026-08-18 | pushed; = second parent of `31181df0`, i.e. #285 last absorbed main on 08-18 |

Dry run `git merge-tree --write-tree main <285>` today: exit 1, **10 conflict entries / 9 paths** — identical to
report 16's list. The 22 main commits newer than report 16's baseline (`a4ff81bb..15142414`, all meeting-flow UI +
2 docs) touch only `src/shared/entities/meetings/DOCS.md` among #285's files, and it auto-merges.

Files changed on both sides since fork: 20. Conflicting: `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (add/add),
`src/shared/dal/server/lib/create-crud-dal.ts`, `src/shared/dal/server/types.ts`,
`src/shared/domains/pipelines/lib/outcome-pipeline-map.ts`, `src/shared/entities/customer-notes/lib/server-spec.ts`,
`src/trpc/routers/projects.router/media.router.ts`, plus 4 modify/delete + rename/delete entries on
`voip-campaign-contacts|voip-contact-attributes|voip-contact-fields /lib/{visibility,server-spec}.ts`.
Per-path resolutions: report 16 §2.1 (still accurate; deltas from main's WIP noted in §5 below).

## 2. Uncommitted work (the "data" that must not be lost)

**main working tree** (`pnpm tsc` exit 0 on the whole tree, verified 2026-09-13):
- Staged (43): 41 renames `src/shared/entities/{proposals,proposal-incentives,proposal-media-files,proposal-views}/**`
  → `src/shared/modules/proposals/{core,incentives,media,views}/**`, all **100 % similarity** (pure renames as staged),
  + 2 deletions (`proposals/dal/server/duplicate.ts`, `proposal-views/dal/server/mutations.ts`).
- Unstaged (143 files, +916/−1007): content edits on 24 of the renamed files, import rewires across schema/routers/
  features/scripts, `createCrudDal` generic-over-spec typing (`create-crud-dal.ts`, `dal/server/types.ts`,
  `create-crud-router.ts`, `media-files/dal/server/crud.ts`), thin-seams pass 1 (10 shim deletions, 3 stage-shim
  trims, 5 barrel lines, 6 type co-locations), meeting-flow shell WIP (`meeting-flow.tsx`, `snap-presentation.tsx`),
  meetings `duplicate-copies-setup-only` (crud.ts + DOCS.md), abilities `PROPOSAL_VIEW`/`PROPOSAL_INCENTIVE`.
- Untracked (58): 11 new `src/shared/modules/proposals/**` + `entities/users/dal/server/queries.ts`; 18 docs
  specs/plans/how-to + `.claude/commands/ui-exploration.md`; 20 `scripts/tmp-*.ts`; `t7-1440.png`.

**#285 worktree** (`.worktrees/issue-285`):
- Modified (4): epic tracker rewrite (+288/−275), convention-auditor ledger, `proposals/dal/server/duplicate.ts`
  (relative-import tweak — **moot**, main deletes that file), `projects.router/procedures.ts` (whitespace only).
- Untracked: `docs/plans/2026-09-07-casl-re-grounding/` (18 files — the ONLY copy of decision log L1–L12 + reports
  00–17) and a stale `CLAUDE.local.md` (says `pnpm build`).

**Stash stack**: 8 entries, all ≤ June 2026, none relevant; shared across worktrees — **do not stash anything**.

## 3. Overlap of main's UNCOMMITTED work with #285's COMMITTED work (17 paths)

| Path | main WIP does | #285 did | Merge outlook |
|---|---|---|---|
| `dal/server/lib/create-crud-dal.ts` | generic-over-spec signatures (`SpecInsert/SpecUpdate/SpecId`) | `requireResolvedScope(ctx.scope)` in getById/update/delete `where` (`7be79ab0`) | same 3 conflict hunks as report 16 #2; adjacent (not overlapping) edits → keep both |
| `dal/server/types.ts` | Crud* generics + `Spec*` helper types (l.61–227) | `actor: Actor` on `ScopedContext` (l.40–52, `d6302917`) | different hunks → conflict #3 unchanged (keep `tx?` + `actor`) |
| `domains/permissions/abilities.ts` | PROPOSAL imports → `modules/…`; +2 `ENTITY_NAMES` | +3 imports next to the same block; rules with conditions | adjacent import hunks → small conflict or clean; rules auto-merge |
| `trpc/lib/create-crud-router.ts` | `z.input<TInsert/TUpdate>` typing | `resolveScope?` option (`3e901178`, slated for REVERT) | clean once #285 reverts the seam first (Phase 2) |
| `entities/proposals/dal/server/{queries,mutations}.ts`, `proposal-incentives/dal/server/mutations.ts` | RENAMED to `modules/proposals/**` (+ content edits) | `?? undefined` → `requireResolvedScope` (`7be79ab0`) | rename detection carries #285's hunks to the new paths **iff** the rename is committed as a pure-rename commit; verify post-merge (§5) |
| `trpc/routers/projects.router/media.router.ts` | import path only | Phase-6 `projectMediaProcedure` + `canAccess` (`f286b3c6`) | conflict #10 unchanged — human ruling |
| `features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` | `computeFreshStage` import (thin-seams) | rewritten onto `ctx.actor` (`13f361bb`) | auto-merge into the actor builder; re-read |
| `entities/meetings/DOCS.md` | new `#duplicate-copies-setup-only` section | visibility/actor prose | prose auto-merge; re-read |
| `api/proposals/[proposalId]/{pdf,summary}/route.ts`, `proposals.router/{contracts,media,views,procedures}.ts`, `move-customer-pipeline-item.ts`, `create-crud-router.ts` | import path rewires | §8 fixes / actor seam | expected clean |

## 4. What on #285 is NOT permissions work

Only one commit is cleanly separable: **`db87d28d` (2026-08-19) refactor(pipelines): derive 5-bucket pipeline from
meeting outcomes; single outcome-class SoT** — 5 files (`enums/meetings.ts`, `outcome-pipeline-map.ts`,
`customers/lib/derived-pipeline-sql.ts`, `customers/DOCS.md`, `meetings/DOCS.md`). No later #285 commit touches
those files. Dry-run cherry-pick onto committed `main`: **1 conflict**, `outcome-pipeline-map.ts` (whole file:
main's literal map incl. `reschedule_needed: null` vs the derived `classToPipeline`); `enums/meetings.ts`
auto-merges with main's `reschedule_needed: 'neutral'` landing inside `MEETING_OUTCOME_CLASS` (correct home).
⚠ It changes prod derivation: `not_good`/`ftd` rehash → dead (tracker Q11; the 2026-08-19 ruling; main's map is
the stale artefact). Needs the user's explicit go.

Everything else business-flavoured on #285 (`a9808587` leadsPoolVisibility drop, `30268c71`/`13f361bb`
customer-pipelines on actor scope, `3390aaff` phone gate, `c62813d5` financial gate, `21758862`/`ad71a076`
dispatcher widening, `59676416` media DAL ops) is built on `ctx.actor`/CASL and stays on the branch.
`59676416` duplicates main's `92830c01` (`moveMediaPhase`/`setHeroImage`) → that is conflict #10's ruling.

Two commits on #285 are slated for **revert** by the branch's own plan (README §B1, tracker unit 7.0):
`3e901178` (customer) + `b40403b6` (meeting) router-seam flips — wrong layer. Reverting them BEFORE the merge also
removes #285's only edit to `create-crud-router.ts`, so main's WIP there merges clean.

## 5. Recommendation

**Direction: merge `main` → #285 with a merge commit (`git merge --no-ff main` in the #285 worktree).** Not a
rebase:
1. #285 already contains a merge commit (`31181df0`); rebasing replays 73 commits and re-hits `create-crud-dal.ts`
   / `types.ts` at each of the several commits that touched them (`7be79ab0`, `4b352564`, `d6302917`).
2. The re-grounding reports, the tracker ledger and memory cite #285 SHAs by the dozen; a rebase invalidates all.
3. `merge-tree` in both directions yields the identical conflict set — rebase buys no conflict reduction.
4. This is the branch's own recorded policy: README §H1/§H4/§J4 "merge first", tracker unit 7.1; the 08-18 sync was
   a merge too. (Memory's 2026-08-11 "rebase onto updated main" wording is stale — see §8.)

"Stash some commits, sync, pop" is not a git operation; the equivalents are **revert** (the 2 seam commits) and
**cherry-pick** (`db87d28d` → main). No `git stash` anywhere (shared stack).

## 6. Ordered steps (none executed)

**Phase 0 — bank the uncommitted work**
- 0.1 `main`: make logical commits from the WIP (next job of this session). Commit the 41 staged renames + 2 deletions
  as ONE pure-rename commit **from the index only** (verify `git diff --cached --stat` first; do not `git add` the
  unstaged RM edits into it) so rename detection works in the merge. Then content commits: (a) proposals-module
  content + import rewires + `createCrudDal` generic-over-spec typing; (b) thin-seams pass 1; (c) meetings
  duplicate-copies-setup-only; (d) meeting-flow shell WIP (check the SDD ledger — may be mid-task); (e) docs.
  Leave `scripts/tmp-*.ts` and `t7-1440.png` uncommitted. `pnpm tsc && pnpm lint` per group.
- 0.2 #285: commit `docs/plans/2026-09-07-casl-re-grounding/` + tracker rewrite + ledger as
  `docs(permissions): …` (report 16 §6). `git restore -- src/shared/entities/proposals/dal/server/duplicate.ts`
  (scoped to that one path in the #285 worktree; the file is deleted on main). Commit or drop the `procedures.ts`
  whitespace. Leave `CLAUDE.local.md` untracked; fix its `pnpm build` line.
- 0.3 Safety net (cheap, local): `git tag pre-sync/main-2026-09-13 main`, `git branch backup/285-pre-sync <285>`.

**Phase 1 — move the non-permissions ruling to main** (needs Q11 go)
- 1.1 On `main`: `git cherry-pick -x db87d28d`; resolve `outcome-pipeline-map.ts` by taking the derived version;
  confirm `reschedule_needed` is `'neutral'` in `MEETING_OUTCOME_CLASS`; re-read both DOCS.md auto-merges; `pnpm tsc`;
  commit body states the `not_good`/`ftd` rehash→dead change. Conflict #4 then disappears from the merge.
  If the user does NOT confirm Q11: skip, and resolve #4 by hand in the merge (keep rehash for those two).

**Phase 2 — #285 unwinds the wrong-layer seam** (README §B1)
- 2.1 One hand-authored `revert(permissions): unwind router-seam flips 3e901178 + b40403b6` on #285:
  `create-crud-router.ts` (drop `resolveScope?`), `customers.router/crud.router.ts`, `meetings.router/crud.router.ts`,
  corrected comment in `customers/lib/visibility.ts`. Re-opens the dispatcher "Failed to update profile" regression
  → J3 interim decision (one-line legacy widen) if dispatchers are live.

**Phase 3 — merge `main` → #285** (clean trees on both sides)
- 3.1 In `.worktrees/issue-285`: `git merge --no-ff main` (no `-X ours/theirs`). Expected after Phases 0–2:
  - #1 epic doc add/add → keep #285's rewritten tracker; main's "STALE DRAFT" copy → one historical line.
  - #2 `create-crud-dal.ts` → keep BOTH main's `exec = ctx.tx ?? db` + generic signatures AND #285's
    `requireResolvedScope(ctx.scope)` in the three `and(...)`. Do not pre-implement C2.
  - #3 `dal/server/types.ts` → `ScopedContext` keeps `tx?: Tx` AND `actor: Actor`; main's `Spec*` block is separate.
  - #4 gone (Phase 1) or take #285.
  - #5 `customer-notes/lib/server-spec.ts` → drop #285's `hooks:` block + 5 imports (`spec.hooks` is dead on main);
    PORT `canAccess(customerServerSpec, ctx.actor, input.customerId)` into main's
    `customer-notes/dal/server/crud.ts` `create.before` (H2). Without it the dispatcher note-create AND
    `rescheduleMeeting` step 8 regress (report 16 §4.1).
  - #6–#9 voip `visibility.ts`/`server-spec.ts` → delete; strip `visibility:` from
    `voip-contact-fields/lib/server-spec.ts` and `lead-sources/lib/server-spec.ts` (Phase-A treatment, §3.3-F).
  - #10 `projects.router/media.router.ts` → keep #285's `projectMediaProcedure` + `canAccess` guard; call main's
    `listImportableProjectMedia` (now `modules/proposals/media/dal/server/queries.ts`) behind it and delete the
    inline `db.select`; choose ONE of `mediaService.movePhase/setHero` (#285) vs `moveMediaPhase/setHeroImage`
    (main, `media-files/dal/server/mutations.ts`) and delete the loser. **Human ruling.**
  - New small ones from main's WIP: `abilities.ts` import block; `get-customer-pipeline-items.ts`
    (`computeFreshStage` + `hasRescheduleNeeded` into the actor builder); `meetings/DOCS.md` prose.
  - Rename-following check: `git grep -n '?? undefined' -- src/shared/modules/proposals` — expect only the 4
    `getProposalsBy*` reads main added (§3.3-D), which #285's convention converts later.
- 3.2 Gates: `pnpm tsc && pnpm lint`; then report 16 §3.3's 35 sites are Phase-7 backlog, not merge work.
- 3.3 Merge-commit body: the 10 resolutions + the Q11 behaviour change if not already in 1.1. Update tracker §0 and
  README §A.1 ahead/behind; update memory.

**Phase 4 — after**
- Push `main` (fast-forward) when wanted; #285 stays local until the Phase-9 single merge. Keep H4: merge
  `main` → #285 at every phase boundary.

## 7. Guards
- Never `git stash`; never `git add -A`/`.`/`-u <dir>` in main's shared tree; pathspec commits only; the index holds
  the user's 43 staged paths.
- Do not touch `.next`; do not start/stop the dev server.
- The #285 untracked docs folder is the only copy of the decision log — 0.2 before anything else.

## 8. Stale refs surfaced (ping-on-staleness)
1. memory `project-permissions-casl-compiler.md`: "74 ahead / 36 behind" and the 2026-08-11 "we rebase this branch
   onto updated main" ruling — reality: 74 / 68 behind `15142414`; the 08-18 sync was a MERGE and README §H4 says
   merge at phase boundaries. Propose: update the memory line to "merge main → #285 at phase boundaries; no rebase
   (SHA-cited docs)".
2. #285 tracker §0 / README §A.1: "46 behind `a4ff81bb`" → now 68 behind `15142414` (expected drift; fix post-merge).
3. report 16 §2.1 #10 names `proposal-media-files/dal/server/queries.ts` — after main's WIP lands it is
   `src/shared/modules/proposals/media/dal/server/queries.ts`.
4. #285 `CLAUDE.local.md` instructs `pnpm build`; repo rule is `pnpm tsc` + `pnpm lint` only (already flagged in
   report 16 §6).

## 9. Projects/media modules restructure landed on main (2026-09-17) — resolve #285's edits at their new paths

Between this plan being written and the merge happening, main landed the **projects and media modules restructure** (tracker `docs/plans/2026-09-14-upgrading-meeting-flow-epic.md`, spec A) as its own commit sequence, ahead of the sync (C20, as planned in §5 point 4 / M7). It renamed four files #285 also edits — the sync must resolve #285's hunks at the paths below, not at the old ones §1–§8 above still name:

| #285 edits (old path, still current on the #285 branch) | New path on `main` |
|---|---|
| `entities/media-files/dal/server/media-ops.ts` | `src/shared/modules/media/core/dal/server/media-ops.ts` |
| `entities/projects/dal/server/queries.ts` | `src/shared/modules/projects/core/dal/server/queries.ts` |
| `entities/media-files/lib/server-spec.ts` (`mediaFileServerSpec`) | `src/shared/modules/projects/media/server-spec.ts` (renamed to `projectMediaServerSpec` — MD9; #285 references the old name by string, so any #285 code/doc that does `mediaFileServerSpec` needs the rename ported, not just the path) |
| `entities/projects/lib/visibility.ts` | `src/shared/modules/projects/core/lib/visibility.ts` |

**Conflict #10, updated ruling** (was "Human ruling" in §6/Phase 3 above — **no longer open**, C24 already decided it): #285 adds table-generic `movePhase`/`setHero` to `media-ops.ts` and to the media service — a design C24 rules out (the media module stays generic over the owner's table; project-only mutations live on the project media unit, not the shared module). The sync takes **main's shape** — `moveMediaPhase`/`setHeroImage` staying on the project media unit's own DAL, now at `src/shared/modules/projects/media/dal/server/mutations.ts` — and **ports #285's scoping onto it**: `requireResolvedScope(ctx.scope)`, the `inArray` bulk update, and the bounded unset (whichever of #285's guards `59676416` added to its `media-ops.ts` copy) move into `modules/projects/media/dal/server/mutations.ts` and `crud.ts`. Delete #285's `movePhase`/`setHero` additions to the shared media module and its service — main's project-only versions are the ones that survive the merge.

One more thing #285 will not expect: the project media unit's `create`/`delete` used to be service-level overrides on the router-facing service; they are now `createCrudDal` hooks on `modules/projects/media/dal/server/crud.ts` (`create.after` dispatches the optimize job, `delete.before` purges R2) — C32, landed after this plan was written. If #285's own changes assumed a `create`/`delete` override to patch on the project media service, there is nothing there to patch anymore; the equivalent point to extend (e.g. to add #285's authorization) is the hook or the DAL, not a service override.
