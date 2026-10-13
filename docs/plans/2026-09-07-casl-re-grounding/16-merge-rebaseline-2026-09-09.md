# 16 — Merge rebaseline: `main` @ `a4ff81bb` → issue-285 (2026-09-09)

Worktree: `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/issue-285`
Branch: `refactor/285-refactor-permissions-casl-scope-compiler` @ `b40403b6` (unchanged since report 04)
`main` @ `a4ff81bb` · merge-base `bd35a168` (unchanged) · generated read-only (no git state changed; only this file written)
Supersedes the merge picture in `04-branch-drift-and-baseline.md` §2 (computed against `main` @ `8df1c206`). Feeds README §H (H1–H4) and §K step 7.1.

## 0. TL;DR

| Fact | Report 04 (09-06) | Now (09-09) |
|---|---|---|
| `main` HEAD | `8df1c206` | `a4ff81bb` (+10 commits: meeting-reschedule feature) |
| ahead / behind | 74 / 36 | **74 / 46** |
| Dry-run merge conflicts | 9 entries / 8 paths | **10 entries / 9 paths** (+`outcome-pipeline-map.ts`) |
| Worst conflicts | `media.router.ts`, `customer-notes/lib/server-spec.ts`, `create-crud-dal.ts`+`types.ts` | same three, plus `outcome-pipeline-map.ts` carries a **prod behaviour change** (§2.3 #4) |
| New permission-relevant sites on main the epic must re-classify (post-merge tree vs branch) | "~20 `SYSTEM_CONTEXT` / `scope:null`" | **35 sites** across 8 classes (§3.3) |
| `pnpm tsc` / `pnpm lint` | PASS / PASS (63 warn) | **PASS / PASS (0 errors, 63 warnings)** |
| Uncommitted / untracked at risk | epic doc + `CLAUDE.local.md` | epic doc (+52/−2) + agent ledger + a whitespace reformat under `src/` + **720 KB untracked audit folder (14 files, this one included)** |

Nothing in the new window touches the #285 plumbing file set; every new conflict and every new decision point is in **meeting/pipeline business code**. The merge is still mechanical except for `media.router.ts` (human ruling) and the H2 port of the `canAccess` probe.

---

## 1. Recompute

```
git merge-base main HEAD                       → bd35a1682325b87f84ad8b947a9e6ecd7e286683
git rev-list --left-right --count main...HEAD  → 46 (main-only)  74 (branch-only)
git diff --stat bd35a168..main | tail -1       → 220 files changed, +11647 / −4452
git diff --stat 8df1c206..main | tail -1       → 24 files changed,  +498  / −44     (the new window)
```

### 1.1 The 10 commits on `main` not in report 04's window (`8df1c206..main`, newest first)

| SHA | Subject | Files touched |
|---|---|---|
| `a4ff81bb` | refactor(meetings): final-review cleanups — reuse `clearMeetingGCalFields`, extract reschedule-reason constant, drop dead field + dangling label | `src/features/meeting-flow/ui/views/meeting-flow.tsx` · `src/shared/constants/enums/meetings.ts` · `src/shared/entities/meetings/DOCS.md` · `src/shared/entities/meetings/dal/server/crud.ts` · `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx` · `src/shared/hooks/use-reschedule.tsx` |
| `3a94f0cc` | feat(pipelines): fresh-pipeline Reschedule column driven by `reschedule_needed` | `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` · `src/features/customer-pipelines/types/index.ts` · `src/shared/constants/enums/pipelines.ts` · `src/shared/domains/pipelines/constants/fresh-pipeline.ts` · `src/shared/domains/pipelines/lib/compute-fresh-stage.ts` |
| `a0bd5eeb` | feat(meetings): wire Reschedule action into all meeting surfaces with per-row gate | `src/features/meeting-flow/ui/components/table/index.tsx` · `src/features/meeting-flow/ui/views/meeting-flow.tsx` · `src/features/schedule-management/ui/views/schedule-view.tsx` · `src/shared/entities/meetings/components/overview-card.tsx` · `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx` |
| `269b1adc` | feat(meetings): reschedule action constant, datetime+note modal, change wrapper, mutation | `src/shared/entities/meetings/constants/actions.ts` · `src/shared/entities/meetings/hooks/use-meeting-actions.ts` · **A** `src/shared/entities/meetings/hooks/use-reschedule-change.tsx` · **A** `src/shared/hooks/use-reschedule.tsx` |
| `4c00f0c0` | feat(entity-actions): per-action `getDisabledReason` with tooltip | `src/shared/components/entity-actions/types.ts` · `src/shared/components/entity-actions/ui/entity-action-dropdown.tsx` |
| `5451bedf` | feat(meetings): `rescheduleMeeting` procedure (cancel original + book replacement) | `src/trpc/routers/meetings.router/business.router.ts` |
| `7dffcdfb` | refactor(meetings): shared meeting-note date helper + reschedule note builder | **A** `src/shared/entities/meetings/lib/notes.ts` · `src/trpc/routers/meetings.router/business.router.ts` |
| `7fee8104` | feat(meetings): remove GCal event when a meeting is cancelled (archived) | `src/shared/entities/meetings/DOCS.md` · `src/shared/entities/meetings/dal/server/crud.ts` |
| `407c3b23` | docs(meetings): cancelled=archived + reschedule contract; fix stale `sales_agent` role; clarify router-orchestration | `docs/codebase-conventions/service-architecture.md` · `src/shared/entities/meetings/DOCS.md` |
| `c9762d18` | feat(meetings): add `reschedule_needed` outcome + reschedulability classifier | `src/shared/constants/enums/meetings.ts` · `src/shared/domains/pipelines/lib/outcome-pipeline-map.ts` · `src/shared/entities/meetings/constants/status-colors.ts` |

Files in this window that the **branch also changed since base** (`comm -12` of the two `--name-only` sets): `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` · `src/shared/constants/enums/meetings.ts` · `src/shared/domains/pipelines/lib/outcome-pipeline-map.ts` · `src/shared/entities/meetings/DOCS.md`. Only the third conflicts textually; the other three auto-merge and are verified in §2.4.

Whole-window both-sides set is now **20 files** (report 04 had 16): the 16 from before + these 4.

---

## 2. Dry-run merge

**Direction used:** `git merge-tree --write-tree main HEAD` — side 1 = `main` (appears as `<<<<<<< main` / "ours" in the markers), side 2 = `HEAD` (branch, `>>>>>>> HEAD`). Exit **1**, result tree **`ce71b4ce`** (previously `e270c224`). The reverse direction (`git merge-tree --write-tree HEAD main`) yields the **identical** conflict set — the picture is symmetric, so "merge main → branch" (README §H1) and "rebase" would meet the same nine paths.

Note: merge-tree operates on the **committed** `b40403b6`, not the working tree. The uncommitted epic-doc section (+52 lines) and the `projects.router/procedures.ts` reformat are not in the result tree (§6 covers them; neither adds a conflict — `main` did not touch either file since base).

### 2.1 Conflict inventory (10 entries / 9 paths)

Plumbing set (per task): `src/trpc/{init,types}.ts`, `src/trpc/lib/{create-http-context,get-cached-session,create-crud-router,shareable-middleware}.ts`, `src/shared/dal/server/types.ts`, `src/shared/dal/server/lib/{create-crud-dal,resolve-actor-scope,resolve-trpc-actor-scope,scope}.ts`, `src/shared/domains/permissions/**`, `src/trpc/routers/*/{procedures,crud.router}.ts`, `src/shared/entities/*/lib/{server-spec,visibility}.ts`.

| # | Path | Kind | Hunks (main lines / HEAD lines) | In plumbing set? | Branch permissions commits touch it? | Severity | Resolution (one line) |
|---|---|---|---|---|---|---|---|
| 1 | `docs/plans/2026-08-10-casl-scope-compiler-epic.md` | add/add | 6 hunks (5/9, 0/140, 29/113, 5/11, 1/1, 4/4); main copy = 90-line self-labelled "STALE DRAFT", HEAD = 324 lines, working tree = 374 | no | yes (tracker) | docs add/add | Take the **working-tree** branch version wholesale; fold main's STALE-DRAFT banner into a one-line "historical" note. |
| 2 | `src/shared/dal/server/lib/create-crud-dal.ts` | content | 3 hunks at result-tree l.84–90 (getById), l.188–194 (update), l.245–251 (delete); each 2–3 lines per side | **yes** | yes (`7be79ab0` `requireResolvedScope`) | real logic, mechanical | Keep BOTH: main's `const exec = ctx.tx ?? db` + `exec.…` AND branch's `requireResolvedScope(ctx.scope)` in the `and(...)`. Do **not** pre-implement C2 here; these are the exact three lines `resolveActorScope(spec, ctx.actor, <action>)` later replaces (README §C2, L7/L8). |
| 3 | `src/shared/dal/server/types.ts` | content | 1 hunk at l.40–52 in `ScopedContext`: main `tx?: Tx` (2 lines) vs branch `actor: Actor` (+6-line JSDoc) | **yes** | yes (`d6302917`) | trivial | Keep both fields. Resulting `ScopedContext = { session, ability, scope, actor, tx? }` is the pre-L7 shape; L7's `{ actor, tx? }` collapse is Phase-7 work, not merge work. |
| 4 | `src/shared/domains/pipelines/lib/outcome-pipeline-map.ts` | content | 1 hunk = whole file (16/11) | no | yes (`db87d28d`, Phase 5) | **real logic + prod behaviour change** — see §2.3 | Take **branch** (derived from `MEETING_OUTCOME_CLASS`). Main's only intent (`reschedule_needed: null`) is already satisfied: the auto-merged `enums/meetings.ts` puts `reschedule_needed: 'neutral'` inside `MEETING_OUTCOME_CLASS` (result tree l.88) → `classToPipeline('neutral')` = `null`. |
| 5 | `src/shared/entities/customer-notes/lib/server-spec.ts` | content | 3 hunks, all branch-only text (0/3 imports, 0/2 imports, 0/56 `hooks:` block) | **yes** | yes (`c215c3d2`, `5a983124`) | real logic | Drop the branch `hooks:` block + its 5 imports (`spec.hooks` no longer exists on `EntityServerSpec` after `43f7dec9`). **PORT** `canAccess(customerServerSpec, ctx.actor, input.customerId)` into main's `src/shared/entities/customer-notes/dal/server/crud.ts:41-50` `create.before`, replacing the `buildUserContext(userId, ctx.session!.user.role, customerServerSpec)` / `SYSTEM_CONTEXT` probe (= README H2). Keep main's `crudHandlers.getById` update-gate and G4 `delete.before(row, ctx)`. Branch's `parent: { spec: customerServerSpec, fk: … }` and the `visibility:` deletion **auto-merged correctly** (verified: no `visibility:` at customer-notes in the result tree). |
| 6 | `src/shared/entities/voip-campaign-contacts/lib/visibility.ts` | modify/delete (deleted on HEAD by Phase A `a8ec6c3f`; 1-line comment edit on main) | — | **yes** | yes | trivial | Delete. Result tree confirms `voip-campaign-contacts/lib/server-spec.ts` no longer imports it (orphan file). |
| 7 | `src/shared/entities/voip-contact-attributes/lib/server-spec.ts` | modify/delete (deleted on main by JustCall rename `26c54190`; HEAD dropped its `visibility:` line) | — | **yes** | yes | trivial | Delete; then **re-apply the same edit to the renamed entity**: drop `src/shared/entities/voip-contact-fields/lib/server-spec.ts:17 visibility: voipContactFieldVisibility,` and the import at `:4`. |
| 8 | `voip-contact-attributes/lib/visibility.ts` → `voip-contact-fields/lib/visibility.ts` | rename/delete | — | **yes** | yes | trivial | Delete the renamed file (after #7). |
| 9 | `src/shared/entities/voip-contact-fields/lib/visibility.ts` | modify/delete (same file as #8, modified on main) | — | **yes** | yes | trivial | Delete (with #7/#8). |
| 10 | `src/trpc/routers/projects.router/media.router.ts` | content | 4 hunks: imports (3/5), `movePhase` (1/1), `toggleHero` (1/1), `listImportableProposalMedia` body (2/20) | no (not a `procedures.ts`/`crud.router.ts`) | **yes** — Phase 6 `59676416` + `f286b3c6` (`projectMediaProcedure`, `canAccess` IDOR closures) | **worst — semantic** | Keep branch's `projectMediaProcedure` + `canAccess(projectServerSpec, ctx.actor, input.projectId)` guard; call **main's** `listImportableProjectMedia(input.projectId)` (`proposal-media-files/dal/server/queries.ts`, unscoped by design) *behind* that guard and delete the branch's inline `db.select` (main's Phase 3 outlawed raw `db` in routers). For `movePhase`/`toggleHero`: pick ONE of branch `mediaService.movePhase/setHero(projectMediaStore, ctx, …)` (`media-ops.ts`) vs main `moveMediaPhase/setHeroImage(ctx, …)` (`media-files/dal/server/mutations.ts`, added by `92830c01`, **absent on HEAD**); the loser is dead code post-merge. **Needs a human ruling** (README H2 already flags `listImportableProjectMedia`). |

Conflict count by severity: 5 trivial (#3, #6–#9), 1 docs add/add (#1), 3 real-logic mechanical (#2, #4, #5), 1 semantic needing a ruling (#10). Seven of nine paths are in the plumbing set; the two that are not (#4, #10) are the two that need thought.

### 2.2 Auto-merged but semantically hot (re-read + `pnpm tsc` after the merge)

Verified in the result tree `ce71b4ce`:

- `src/shared/constants/enums/meetings.ts` — main's `reschedule_needed: 'neutral'` (added to `MEETING_OUTCOME_SENTIMENT` in `c9762d18`) landed by context-match **inside** the branch's `MEETING_OUTCOME_CLASS` at result-tree l.88. That is the correct home (branch derives sentiment from class), the record type stays exhaustive, and `outcomeRequiresReason` (l.146), `DID_NOT_OCCUR_OUTCOMES` (l.165) and `canRescheduleFromOutcome` (l.172) all survive. Lucky, but right.
- `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` — main's `hasRescheduleNeeded` (3 lines) landed inside the branch's actor-based builder: `getFreshPipelineItems(actor: Actor, customerScope, inBucket, canSeeUngated)` at l.175, with the new `bool_or(...)` at l.192 and the two mappings at l.325/l.336. `compute-fresh-stage.ts` (l.10, l.35) and `customer-pipelines/types/index.ts` (l.94) carry the field. Should type-check.
- `src/shared/entities/meetings/DOCS.md` — both sides edited (branch: visibility/actor prose; main: `#participant-roles-are-meeting-contextual` rewrite, three new sections). Prose merge; re-read for contradictions (§4.5).
- Unchanged from report 04 §2.4: `helpers.ts` (`withTx` + `requireResolvedScope`), `abilities.ts` (`LEAD_SOURCE`/`VoipContactField` + dispatcher grants), `customers/dal/server/queries.ts`, `projects/lib/server-spec.ts`, `proposals/dal/server/queries.ts` (4 new `ctx.scope ?? undefined` sites, §3.3-D), `voip-campaign-contacts/dal/server/queries.ts`, `src/trpc/DOCS.md`, `customers/DOCS.md`.
- Files the branch deleted that main never touched merge as clean deletes: `app-settings|applications|customer-notes|voip-calls|voip-campaigns|voip-dids|voip-link-tokens|voip-messages /lib/visibility.ts` are **MISSING** in the result tree and nothing in it imports them (checked by exact path). The only `visibility:` declarations left post-merge are `customers:37`, `meetings:22`, `proposals:27` (branch's known three) **+ `lead-sources:27` + `voip-contact-fields:17`** (main's two new legacy consumers — §3.3-F).

### 2.3 ⚠️ Stale ref / behaviour change carried by conflict #4

⚠️ Stale ref — memory `reference-meeting-outcome-abbreviations.md:22` says "Terminal-bad → `dead` pipeline: `lost_to_competitor`, `not_good`, `ftd`", and branch `enums/meetings.ts:96-98` (`MEETING_OUTCOME_CLASS`) encodes exactly that — but **main's** `src/shared/domains/pipelines/lib/outcome-pipeline-map.ts:12,15` still says `not_good: 'rehash'` and `ftd: 'rehash'` (only `lost_to_competitor` → `dead`). Main is the copy that runs in prod today. Resolving #4 to the branch version therefore **changes prod meeting→pipeline derivation for `not_good` and `ftd` (rehash → dead)** the moment #285 merges to main. This is the branch's intended Phase-5 ruling (`db87d28d`), not a merge accident — but it must be surfaced as a deliberate behaviour change in the merge commit / PR body, and the user should confirm the ruling still stands before it ships. (Proposed fix for the doc side: none needed — memory and branch agree; main's map is the stale artefact and the merge retires it.)

---

## 3. What `main` added that the epic must re-classify

Method: `git grep -n -F <pat> <ref> -- src` for `main`, `HEAD` and the merge result tree `ce71b4ce`; per-pattern "new" = (file, trimmed line content) pairs present in the **post-merge tree** but absent from `HEAD` (line numbers shift, content does not). Counts below are grep **lines** (imports and comments included); the site lists are code lines only.

### 3.1 Counts

| Pattern | `main` lines (files) | branch lines (files) | post-merge lines | post-merge lines NOT on branch |
|---|---|---|---|---|
| `SYSTEM_CONTEXT` | 106 (43) | 83 (35) | 98 | 21 (14 code, §3.3-A/B) |
| `systemContext(` | 0 | 3 (3) | 3 | 0 |
| `SystemReason` | 0 | 7 (3) | 7 | 0 |
| `{ ...ctx, scope: null }` | 10 (3) | 0 | 10 | **10** |
| `scope: null` (any) | 19 (11) | 7 (5) | 19 | 12 (10 code) |
| `ctx.scope` | 86 (36) | 81 (34) | 93 | 12 (8 code) |
| `ctx.ability` | 61 (30) | 53 (24) | 54 | 1 |
| `ctx.actor` | **0** | 21 (12) | 21 | 0 |
| `resolveVisibilityScope` | 25 (10) | 18 (8) | 18 | **0** (main's extra 7 are pre-CASL versions of the 4 root `procedures.ts` + `create-crud-router.ts`; branch versions win) |
| `resolveEffectiveScope` | 20 (8) | 23 (11) | 23 | 0 |
| `buildUserContext` | 20 (10) | 13 (9) | 16 | 3 (1 code — the probe, §3.3-B) |
| `userParticipatesInMeeting` | 24 (10) | 15 (9) | 15 | 0 |
| `agentProcedure` | 114 (25) | 100 (24) | 102 | 3 (1 code) |
| `superAdminProcedure` | 45 (7) | 42 (5) | 45 | 4 (1 code — a rename) |
| `baseProcedure` | 49 (16) | 49 (16) | 49 | 0 |
| `shareableProcedure` / `ShareableProcedure` | 6 (3) / 14 (6) | 6 (3) / 14 (6) | same | 0 |
| `visibility:` in `*/lib/server-spec.ts` | 15 specs | 3 specs | 5 specs | **2** |
| `spec.visibility` reads | 1 (`scope.ts:38`) | 1 | 1 | 0 |
| `canAccess(` / `resolveActorScope` / `resolveTrpcActorScope` / `requireResolvedScope` | 0 | 12 / 42 / 22 / 59 | branch's | 0 |

Read: the legacy read engine did **not** grow on main; what grew is (a) privileged `SYSTEM_CONTEXT` bypasses inside services/hooks, (b) `scope: null` omni-by-construction spreads, (c) `ctx.scope ?? undefined` reads that the branch convention (`7be79ab0`) forbids, and (d) two new entities wired to legacy `spec.visibility`.

### 3.2 Which side wins on the files main did not touch (no action needed)

`git diff --shortstat bd35a168..main -- <f>` is empty for every plumbing file the branch rewrote, so the branch version simply wins: `src/trpc/init.ts`, `src/trpc/types.ts`, `src/trpc/lib/create-crud-router.ts`, `src/trpc/lib/create-http-context.ts`, `src/trpc/lib/shareable-middleware.ts`, `src/trpc/lib/get-cached-session.ts`, `src/shared/dal/server/lib/resolve-actor-scope.ts`, `src/shared/dal/server/lib/scope.ts`, all four root `procedures.ts`, and the §8 fix sites `api/proposals/[proposalId]/{pdf,summary}/route.ts`, `proposals.router/{views,contracts}.router.ts`, `meeting-flow.router.ts`, `customers/lib/phone-gating-sql.ts`. (Their "main-only" `SYSTEM_CONTEXT`/`resolveVisibilityScope` hits in a raw main-vs-branch diff are red herrings — none survive the merge.)

### 3.3 New sites post-merge (file:line in the **result tree**, which ≈ main's numbering for these files)

**A. Net-new privileged bypasses (`SYSTEM_CONTEXT`) — 9.** Branch convention `4b352564` wants `systemContext(reason)` with a `SystemReason` variant; L7 makes `systemAbility(reason)` the only system principal.
- `src/shared/services/accounting.service.ts:24` `customerCrud.getById(SYSTEM_CONTEXT…)`, `:77` `customerCrud.update` (pre-existing on branch too, listed for context), `:86` `projectCrud.getById`, `:117` `projectCrud.update({qbSubCustomerId})`, `:122` `projectCrud.getById`, `:128` `getProposalsByIds`, `:192` `getProposalsByInvoiceIds`, `:230` `getProposalByInvoiceId` — 7 new (Phase-3 `c33adb9c` replaced raw `db` with CRUD/DAL calls under the system context).
- `src/shared/entities/lead-sources/dal/server/crud.ts:66` `crudHandlers.getById(SYSTEM_CONTEXT, …)` inside the update hook — 1 new (D-d `909b9066`).
- `src/trpc/routers/meetings.router/business.router.ts:118` `meetingCrud.create(SYSTEM_CONTEXT, { ownerId: replacementOwnerId, … })` — 1 new (§4.1).
- Relocations/renames, net 0 but the file changed: `src/app/api/webhooks/justcall/route.ts:63,95` (was `cloudtalk/route.ts:62,96`; cloudtalk route is deleted on main and in the result tree), `src/shared/entities/customers/dal/server/crud.ts:115` (was `customers/lib/server-spec.ts:140`), `src/shared/entities/proposals/dal/server/crud.ts:35` (was `proposals/lib/server-spec.ts:54`).

**B. Legacy probe to port (README H2) — 1 block.** `src/shared/entities/customer-notes/dal/server/crud.ts:41-50`: `isOmni = ctx.ability?.can('manage','all')` (`:42`, an `ability`-as-role-proxy — L3 retires these), `probeCtx = (!userId || isOmni) ? SYSTEM_CONTEXT : buildUserContext(userId, ctx.session!.user.role, customerServerSpec)` (`:43-45`), then `customerCrud.getById(probeCtx, …)`. Replace with the branch's `canAccess(customerServerSpec, ctx.actor, input.customerId)` from `5a983124` or the dispatcher note-create NOT_FOUND regresses (and, new since 09-09, so does `rescheduleMeeting` — §4.1 step 7).

**C. Omni-by-construction spreads (`{ ...ctx, scope: null }`) — 10.** All new; C2 (DAL self-scoping off `ctx.actor`) changes behaviour at every one (agents get their real scope). Main's own comment at `projects.router/crud.router.ts` calls this "the #285 tail".
- `src/trpc/routers/lead-sources.router.ts` ×4 (`update`, `delete`, `duplicate`, + one create/list spread) — super-admin-only router, so omni is currently true by construction.
- `src/trpc/routers/projects.router/business.router.ts` ×3 (`customerCrud.getById`, `getProposalsByMeetingId`, `projectCrud.create`).
- `src/trpc/routers/projects.router/crud.router.ts` ×3 (`createProjectWithScopes`, `updateProjectWithScopes`, `projectCrud.delete`) — on bare `agentProcedure`, i.e. **any agent, unscoped** (known #285 tail; README A.3 "Project mutations: none").

**D. `ctx.scope ?? undefined` reads the branch forbids (`requireResolvedScope`, `7be79ab0`) — 7 (+1 in the conflict line).**
- `src/shared/entities/media-files/dal/server/mutations.ts` ×3 (`moveMediaPhase` select + update, `setHeroImage` update) — file **absent on HEAD**; fate decided by conflict #10.
- `src/shared/entities/proposals/dal/server/queries.ts:322` `getProposalsByIds`, `:335` `getProposalsByMeetingId`, `:351` `getProposalsByInvoiceIds`, `:364` `getProposalByInvoiceId` — 4 new DAL reads (called under `SYSTEM_CONTEXT` from accounting and `{scope:null}` from projects; the fallthrough is silent-omni when `scope` is undefined).
- `src/shared/dal/server/lib/create-crud-dal.ts:86` — conflict #2, resolved to `requireResolvedScope`.

**E. New tRPC procedures — 2.**
- `src/trpc/routers/meetings.router/business.router.ts:83` `rescheduleMeeting: meetingProcedure` — §4.1.
- `src/trpc/routers/voip-campaigns.router.ts:52` `listContactFields: agentProcedure.query(async () => …)` — ctx-less read of `voip_contact_fields`; no branch equivalent (`listContact*` has 0 hits on HEAD). Also `:110` `resyncDialer: superAdminProcedure` is a rename of HEAD's `resyncFromCloudtalk` (`:110`) — net 0.

**F. New legacy-engine consumers (`spec.visibility`) — 2.** `src/shared/entities/lead-sources/lib/server-spec.ts:27 visibility: leadSourceVisibility` (fn = `sql\`false\``, super-admin-only via omni; file absent on HEAD) and `src/shared/entities/voip-contact-fields/lib/server-spec.ts:17 visibility: voipContactFieldVisibility` (renamed from the entity the branch already stripped). Both `createCrudDal(...)`-only specs (`lead-sources/dal/server/crud.ts:39`, `voip-contact-fields/dal/server/crud.ts:5`) with no `createCrudRouter`/`scopeMiddleware` consumer → the `visibility` fn is dead at runtime today, exactly like the 9 the branch deleted in Phase A. Apply Phase A to both during the merge (#7) or immediately after; Phase 8's deletion list must include them either way.

**G. ctx-less DAL calls on new mutation paths — 3.** `getParticipantsForMeeting(meetingId)` (`meetings/dal/server/participants.ts:36`, read), `addParticipant(meetingId, userId, role)` (`:168`, write, looped in reschedule), `clearMeetingGCalFields(meetingId)` (`meetings/dal/server/google-calendar.ts:110-114`, raw `db.update(meetings)` outside the CRUD chokepoint). Relevant to the flow catalog (07: "authz decided nowhere") and to the CRUD-mutation-standardization rule ("mutations always route through CRUD").

**H. New DAL hook side-effect on the mutation path — 1.** `src/shared/entities/meetings/dal/server/crud.ts:150-160` `update.after`: on `previousRow.meetingOutcome !== 'cancelled' && row.meetingOutcome === 'cancelled' && row.gcalEventId` → `deleteMeetingEventJob.dispatchOrThrow` + `clearMeetingGCalFields(row.id)`. Grill C's auth-in-hooks inventory must list it (it is not an auth hook, but it is a hook that fires on every `cancelled` transition regardless of who did it, including the `SYSTEM_CONTEXT` reschedule path).

**Total: 9 + 1 + 10 + 7 + 2 + 2 + 3 + 1 = 35 net-new sites** (41 grep lines including the 4 relocations/renames and the rename in E).

---

## 4. Meeting-reschedule commits — authorization decision points to fold in

The five commits named in the task (`a4ff81bb`, `3a94f0cc`, `a0bd5eeb`, `269b1adc`, `4c00f0c0`) are almost entirely UI; the server-side decision points live in the five *earlier* commits of the same feature (`5451bedf`, `7dffcdfb`, `7fee8104`, `407c3b23`, `c9762d18`). All ten were inspected.

### 4.1 `5451bedf` — `rescheduleMeeting` (`src/trpc/routers/meetings.router/business.router.ts:83-149`)

| Step | Line | What it does | Authz classification |
|---|---|---|---|
| rung | `:83` | `meetingProcedure` | Post-merge this is the branch's CASL rung (`meetings.router/procedures.ts:20-21` `resolveTrpcActorScope(meetingServerSpec, …)`); on main today it is legacy `resolveVisibilityScope`. L5 deletes per-entity rungs → this becomes `agentProcedure` + DAL self-scope. |
| 1 | `:89` | `newScheduledFor` must be in the future | validation, not authz |
| 2 | `:95` | `meetingCrud.getById(ctx, …)` → NOT_FOUND | **read gate** (scope-checked). Fine under L8 (mutation WHERE ∧ read). |
| 3 | `:99` | `canRescheduleFromOutcome(original.meetingOutcome)` → BAD_REQUEST | **business-state gate**, not a permission. Source: `enums/meetings.ts:165-173` (`DID_NOT_OCCUR_OUTCOMES`). Keep outside CASL; the rules matrix (10) should note it so nobody tries to express "may reschedule" as a CASL rule. |
| 4 | `:107` | `getParticipantsForMeeting(input.meetingId)` | **ctx-less read**, no scope (safe only because step 2 already proved visibility). |
| 5 | `:118` | `meetingCrud.create(SYSTEM_CONTEXT, { ownerId: replacementOwnerId, customerId, projectId, meetingType, scheduledFor })` | **Privilege bypass by construction.** The comment (`:114-117`) says the system context exists to defeat `create.before`'s owner reassignment (`resolve-owner.ts`: an authed non-`own`-capable caller would become owner / a dispatcher booking lands unassigned). Consequences: (i) the caller's `create Meeting` verb and any create-side conditions are skipped; (ii) `create.after` (owner participant + GCal sync + graduation + Meta CAPI) fires as system; (iii) needs a `SystemReason` (e.g. `'meetings:reschedule-rebook'`) under `4b352564`/L7; (iv) it is a **rules-matrix question**: "may an agent/dispatcher create a Meeting owned by another user?" — belongs in Q8 (Meeting ownership vs participation). Today the answer is "yes, if they can read the original", encoded nowhere but here. |
| 6 | `:125-129` | loop `addParticipant(replacement.id, p.userId, p.role)` | **ctx-less writes** (`participants.ts:168`); copies `co_owner`/`helper` rows. No verb gate. |
| 7 | `:134` | `meetingCrud.update(ctx, { meetingOutcome: 'cancelled' })` | scoped mutation (read-scope reuse = the L8 invariant as it exists today). Triggers §4.3's hook. |
| 8 | `:139-146` | `customerNoteCrud.create(ctx, { customerId, content })`; failure → `INTERNAL_SERVER_ERROR 'Meeting rescheduled but note failed.'` | Passes through customer-notes `create.before`. **Post-merge without the H2 port**, a dispatcher rescheduling a meeting on a non-`leads` customer hits main's legacy `buildUserContext` probe (`customer-notes/dal/server/crud.ts:41-50`, dispatcher branch = `['leads']` only) → NOT_FOUND → this error — **after** the replacement was created (system) and the original cancelled (+ GCal event deleted). Non-atomic by design: no `withTx` although sub-plan B's `withTx`/`ctx.tx` is available on main (`helpers.ts`). H2 is therefore not just a dispatcher-note fix any more; it is what keeps this flow from half-applying. |

### 4.2 `7dffcdfb` — `src/shared/entities/meetings/lib/notes.ts` (new)
Pure formatting helpers (`formatMeetingDateShort`, `buildRescheduleNote`). No authz.

### 4.3 `7fee8104` + `a4ff81bb` — `src/shared/entities/meetings/dal/server/crud.ts:150-160` (`update.after`)
New hook side-effect on `→ cancelled` (§3.3-H): `deleteMeetingEventJob.dispatchOrThrow` + `clearMeetingGCalFields(row.id)` (raw writer, `google-calendar.ts:110-114`). `a4ff81bb` swapped an inline `db.update(meetings)` for the helper — same raw write, now shared with the delete-cascade path. Fires for every principal, including the `SYSTEM_CONTEXT` create in §4.1 step 5 (not on create, on the later cancel of the original, which runs under `ctx`). Inventory item for Grill C + the raw-writer audit (Ably kernel amendment).

### 4.4 `c9762d18` — classifier + map
- `enums/meetings.ts`: `reschedule_needed` added to `selectableMeetingOutcomes` (`:49`) and the sentiment/class map; `outcomeRequiresReason` widened (`:146`); `DID_NOT_OCCUR_OUTCOMES` + `canRescheduleFromOutcome` (`:165-173`). Business-state predicate shared by UI and server — not a permission.
- `outcome-pipeline-map.ts:9` `reschedule_needed: null` — conflict #4; satisfied by the branch's derived map (§2.2).
- `status-colors.ts:59` label only.

### 4.5 `407c3b23` — docs (permissions-relevant prose)
- `src/shared/entities/meetings/DOCS.md` `#participant-roles-are-meeting-contextual` rewritten: roles are `owner | co_owner | helper` (`meetingParticipantRoles`, `enums/meeting-participants.ts:1`; `sales_agent` never existed in code), "the `owner` participant role is distinct from `meetings.ownerId` (row-level permission owner)", and — new, load-bearing — **"Write capability is separate from participant role … comes from the CASL `agent` role (`can('read'|'create'|'update'|'own','Meeting')`)… A participant row … is not itself the permission gate."** Verified: `can('own','Meeting')` exists on both sides (`abilities.ts:135` main / `:134` HEAD; `AppAction` includes `'own'`, `permissions/types.ts:20`), so the DOCS claim is accurate. The rules matrix (10) Meeting rows and Q8 should cite this section as the current ruling on ownership-vs-participation; it is the first per-entity DOCS text that names CASL as the write gate.
- New sections `#outcome-cancelled-means-archived`, `#gcal-removed-on-cancel`, `#reschedule-cancels-and-rebooks` document §4.1/§4.3 as contracts.
- `docs/codebase-conventions/service-architecture.md`: "Pure entity-CRUD flows … orchestrate in the **tRPC router** instead — e.g. `meetings.business.setOutcomeWithReason` / `rescheduleMeeting`." This legitimises handler-body orchestration, which is where 07 found 47 of the authz decision points. Not in conflict with L5 (verb gates in the DAL slot), but it means router-hosted flows like §4.1 will keep composing `SYSTEM_CONTEXT`/ctx-less DAL calls unless the epic's wall (E2) or a convention says otherwise. Worth one line in the conventions rewrite (Q9).

### 4.6 `4c00f0c0`, `269b1adc`, `a0bd5eeb`, `3a94f0cc` — UI + pipeline column
- `src/shared/components/entity-actions/types.ts` gains `getDisabledReason?: (entity: TEntity) => string | null` and `entity-action-dropdown.tsx` renders it as a disabled item + tooltip. **New per-row affordance seam** — the natural host for L10's `ability.can(action, subject(type,row))` checks; report 12 (client UI gating) should register it as the target API instead of the three hand mirrors it plans to delete. First consumer: `use-meeting-action-configs.tsx:138-141` (`canRescheduleFromOutcome` → `CANNOT_RESCHEDULE_REASON`, `enums/meetings.ts:143`), plus the ad-hoc header button in `meeting-flow.tsx:198-201`.
- `use-meeting-actions.ts:43-44` `useMutation(trpc.meetingsRouter.business.rescheduleMeeting…)`; `use-reschedule.tsx`, `use-reschedule-change.tsx`: modal plumbing. No authz.
- `3a94f0cc`: `hasRescheduleNeeded` column through `get-customer-pipeline-items.ts` → `computeFreshStage` (`'reschedule'` stage, `FRESH_ALLOWED_DRAG_TRANSITIONS.reschedule: []`). No authz; auto-merged into the actor-based builder (§2.2).

---

## 5. Baseline (worktree @ `b40403b6` + the uncommitted edits in §6)

| Check | Command | Result | Log |
|---|---|---|---|
| Type-check | `pnpm tsc` (`tsc --noEmit`) | **PASS — exit 0, 0 errors** | `<scratchpad>/tsc.log` |
| Lint | `pnpm lint` | **PASS — exit 0, 0 errors, 63 warnings** (same 63 as report 04: `react/no-array-index-key`, `react-hooks-extra/no-direct-set-state-in-use-effect`, e.g. `src/shared/domains/multi-step-flow/hooks/use-step-engine.ts:56,61`, `src/shared/services/providers/resend/emails/proposal-email.tsx:174`) | `<scratchpad>/lint.log` |

Nothing fixed. Any post-merge red is new. Note the post-merge tree has never been type-checked (merge-tree produces a tree, not a checkout); §2.2's "should type-check" claims are by inspection only.

---

## 6. Working-tree state (at risk until committed — not committed by this report)

```
git status --short
 M .claude/agents/knowledge/convention-auditor-ledger.md      (+13/−3, agent ledger)
 M docs/plans/2026-08-10-casl-scope-compiler-epic.md         (+52/−2, the "CASL-native re-orientation" section + 2 header pointers, incl. one to the README of this folder)
 M src/trpc/routers/projects.router/procedures.ts            (+8/−2, whitespace-only reformat of the two `next({ ctx: … })` calls — no semantic change; main does not touch this file, so no merge impact)
?? CLAUDE.local.md                                            (4 KB; stale Phase-0 dispatch file — still says `pnpm build`)
?? docs/plans/2026-09-07-casl-re-grounding/                   (14 files, 720 KB — reports 01–13, README with the §L decision log, and this file)
```

Confirmed: `docs/plans/2026-09-07-casl-re-grounding/` is **untracked**, **not ignored** (`git check-ignore` exit 1), and **not on `main`** (`git ls-tree main <dir>` empty). The epic-tracker diff is **uncommitted**. Plainly: the entire re-grounding audit — including the L1–L10 decision log that supersedes §C/§J — plus the re-orientation section exist only as files on this one worktree's disk. A `git checkout -- .`, `git clean -fd`, a worktree prune, or a disk event loses them; they also cannot be referenced from a merge commit or a PR until committed. Recommended first action of the merge session (README G-hygiene, §K 7.0): commit the docs and the ledger as `docs(permissions): …` on this branch, decide separately whether to keep the `procedures.ts` reformat, and leave `CLAUDE.local.md` untracked (it is a personal dispatch file) after correcting its `pnpm build` line.

The merge-tree result above does not include these edits; when the real `git merge main` runs, the tracked-but-dirty `procedures.ts` and epic doc must be committed (or the epic doc will collide with conflict #1 in the working tree).

---

## 7. Delta vs report 04 (what changed in 3 days)

1. `main` +10 commits, all one feature (meeting reschedule); behind 36 → 46.
2. Conflicts 9/8 → **10/9**: +`outcome-pipeline-map.ts` (whole-file, carries the `not_good`/`ftd` rehash→dead prod change, §2.3). Prior nine unchanged in content and recommended resolution; result tree `e270c224` → `ce71b4ce`.
3. Three new auto-merged-hot files: `enums/meetings.ts`, `get-customer-pipeline-items.ts`, `meetings/DOCS.md` (all verified sane in §2.2).
4. New authz decision points to fold into the matrix / flow catalog: `rescheduleMeeting` (1 `SYSTEM_CONTEXT` create with explicit `ownerId`, 3 ctx-less participant calls, 1 non-atomic multi-write depending on the H2 port), the `→ cancelled` GCal hook, `listContactFields`, and the `getDisabledReason` UI seam. README H2's "~20 new `SYSTEM_CONTEXT`/`scope:null` sites" is now **35 sites in 8 classes** (§3.3).
5. Two new legacy `spec.visibility` consumers confirmed dead-at-runtime (no `createCrudRouter`/`scopeMiddleware` consumer) → Phase-A treatment is safe during the merge.
6. `meetings/DOCS.md` now states in prose that CASL (`can('own','Meeting')`) is the Meeting write gate and participants are not — a citable ruling for Q8.
7. Uncommitted set grew from 2 items to 5 (§6); baseline still green.

---

## Appendix — commands (all read-only)

```
git rev-parse --abbrev-ref HEAD; git rev-parse --short HEAD; git rev-parse --short main
git merge-base main HEAD
git rev-list --left-right --count main...HEAD
git log --oneline --no-decorate bd35a168..main
git log --format='%n=== %h %ad %s' --date=short --name-status 8df1c206..main
git diff --stat bd35a168..main | tail -1; git diff --stat 8df1c206..main | tail -1
comm -12 <(git diff --name-only bd35a168..main | sort) <(git diff --name-only bd35a168..HEAD | sort)
comm -12 <(git diff --name-only 8df1c206..main | sort) <(git diff --name-only bd35a168..HEAD | sort)
git merge-tree --write-tree main HEAD          # exit 1, tree ce71b4ceb1b319be6730032d79fc624fee272c64
git merge-tree --write-tree HEAD main          # exit 1, identical conflict list
git show ce71b4ce:<path> | awk '/^<<<<<<< /…/^>>>>>>> /'   # conflict hunks + per-side line counts
git diff --name-status bd35a168..HEAD | grep -E '^(D|R)'
git cat-file -e {HEAD,main,ce71b4ce}:<path>
git grep -n -E "from '(\./visibility|@/shared/entities/<e>/lib/visibility)'" ce71b4ce -- src
git grep -n -E '^\s*visibility:' {main,HEAD,ce71b4ce} -- 'src/shared/entities/*/lib/server-spec.ts'
git grep -c -F <pat> {main,HEAD,ce71b4ce} -- src   # summed per pattern
git grep -n -F <pat> {main,HEAD,ce71b4ce} -- src   # (file, content) set-diff via comm -23
git diff --shortstat bd35a168..{main,HEAD} -- <plumbing file>
git show 5451bedf 7dffcdfb 7fee8104 c9762d18 a4ff81bb 3a94f0cc -- src
git show 269b1adc a0bd5eeb 4c00f0c0 --stat; git show <sha> -- src | grep -E '^\+'
git show 407c3b23 -- docs/codebase-conventions/service-architecture.md src/shared/entities/meetings/DOCS.md
git grep -n -A8 'export async function clearMeetingGCalFields' main -- src
git grep -n -E "'own'" {main,HEAD} -- src/shared/domains/permissions/
git status --short; git diff --stat; git diff -- src/; git check-ignore -v <paths>; git ls-tree main docs/plans/2026-09-07-casl-re-grounding
pnpm tsc; pnpm lint     # logs in the session scratchpad (tsc.log, lint.log)
```
