# Pipeline derivation — handoff from worktree 285 to the sales lifecycle work (2026-10-07)

**Owner ruling, 2026-10-07:** outcome and pipeline derivation is business logic, explored on main by the sales lifecycle session. Worktree 285 (the permissions epic) lands none of it. This document moves every decision, research result and code fact the permissions work accumulated on the topic to the one owner: `docs/plans/2026-10-01-sales-lifecycle-rules-map.md` (R34–R36 in the main checkout's working copy today). Delete this file once the rules map and the code carry what it says.

Written by the permissions session from its own reads of the tree and of both sessions' transcripts. No database was queried or written; the data facts in §4 came through the app's API as the dev super-admin, GET only, no phones or emails recorded.

## 1. Rulings, in date order

| When (UTC) | Said to | Ruling | Recorded |
|---|---|---|---|
| 2026-08-12 | wt 285 | Pipeline is a perfectly derived fact, never a stored column. Negatives split into terminal (→ dead: `lost_to_competitor`, `not_good`, `ftd`) and recallable (→ rehash: `cancelled`, `no_show`, `pns`, `npns`, `nra`). | memory `project-pipelines-domain-rethink`, `reference-meeting-outcome-abbreviations` |
| 2026-08-19 | wt 285 | Bucket order, first match: projects → leads (no meetings) → fresh (any unset or neutral meeting) → rehash (all negative, at least one recallable) → dead (all negative, all terminal). Any recallable among all-negative means rehash (this overrode "one terminal means dead"). A booked `not_set` meeting means fresh. A customer sits in exactly one bucket. Built as `db87d28d` (5 files; reachable from both trees as an ancestor, its content in neither). | epic D-06; memory `project-casl-phase-5-customer-pipelines` |
| 2026-08-20, 09-04 | wt 285 | Dispatcher Customer reach = `$inDerivedPipeline: ['leads','rehash','dead','fresh']`, never projects. Permissions work; stays in wt 285 (§7). | epic D-05 |
| 2026-09-13 | main | Sync plan: cherry-pick `db87d28d` onto main needs the owner's go; one conflict in `outcome-pipeline-map.ts`; confirm `reschedule_needed` neutral. | `docs/plans/2026-09-13-main-285-sync-plan.md` (still on main) |
| 2026-10-01, 10-02 | lifecycle | R3/R4 `site_visit` default and per-type outcome sets; R6 `cancelled_scopes` negative, not terminal; R18 when a meeting's outcome is `cancelled_scopes`; R26 precedence; I12 proposed (project meetings never enter rehash/dead); S57, S2, Q9 open. | rules map |
| 2026-10-07 21:58 | wt 285 | "Restore the derived pipeline model." `reschedule_needed`: stays fresh, Reschedule stage. `site_visit`: project meetings only, no effect on the pipeline, the customer stays in projects. `cancelled_scopes`: negative recallable; the example given was a converted customer who backed out before the project started, and that customer "should push to rehash". | epic D-06 as first amended that day (since corrected, §1.1) |
| 2026-10-08 00:30 | lifecycle | "I want to make an amendment — a project where the initial sale got declined shouldn't move to rehash. It should stay in projects pipeline as 'cancelled' (already exists in projects pipeline). Site visits are definitely not leads, neither is any meeting past the first sittable meeting the customer had." | rules map R35, R36 (uncommitted in the main checkout, file mtime 17:30 local) |

### 1.1 The one contradiction, and which word stands

The two 2026-10-07 rulings disagree on the backed-out customer: rehash (to wt 285, 21:58) against projects-as-cancelled (to the lifecycle session, 00:30 the next day UTC). The later one is framed by the owner as an amendment, so **R35 governs**: a cancelled initial sale keeps the customer in projects, and the projects arm keeps "has a project, at any stage". The permissions tracker's D-06 now says so; the rehash reading recorded there earlier today is withdrawn.

Everything else the owner said to wt 285 that day agrees with R34 and R36: `reschedule_needed` neutral, `site_visit` outside the lead buckets, `cancelled_scopes` negative-recallable.

## 2. The model after R34–R36

| Class | Outcomes | Customer bucket |
|---|---|---|
| unset | `not_set` | fresh |
| neutral | `follow_up_needed`, `reschedule_needed`, `proposal_created`, `proposal_sent`, `site_visit` (when added) | fresh |
| positive | `converted_to_project`, `additional_work` | projects |
| negative, recallable | `cancelled`, `no_show`, `pns`, `npns`, `nra`, `cancelled_scopes` (when added) | rehash |
| negative, terminal | `lost_to_competitor`, `not_good`, `ftd` | dead |

Bucket, first match: **projects** when the customer has a project row at any stage (cancelled included, R35) or any positive outcome; **leads** when they have no meetings; **fresh** when any counted meeting is unset or neutral; **rehash** when every counted meeting is negative and at least one is recallable; **dead** when every counted meeting is negative and all are terminal. Per R36 only non-project meetings (the birth meeting included) are counted; project meetings reach the projects bucket through the project row alone.

The Reschedule stage needs no new code: `src/shared/domains/pipelines/lib/compute-fresh-stage.ts:38` already returns `reschedule` from a `reschedule_needed` outcome.

R34 says the fresh pipeline has no approved or declined stage. The code still has both: `freshProposalStages` in `src/shared/constants/enums/pipelines.ts:30-36` and the first four branches of `computeFreshStage` (`compute-fresh-stage.ts:20-33`). That is a change for the lifecycle work to plan.

## 3. The code on main today (verified 2026-10-07 on `3086eb70`, which equals main)

**3.1 The bucket.** `src/shared/entities/customers/lib/derived-pipeline-sql.ts` — a first-match CASE: stored `customers.pipeline = 'rehash'` → rehash; stored `'dead'` → dead; EXISTS project → projects; EXISTS any meeting → fresh; else leads. Outcomes are never read. `EXISTS_PROJECT` is exported and imported by `signed-customer-sql.ts` (commit `c77a8f41`, newer than `db87d28d`, whose file made it private — keep the export when re-applying).

**3.2 Who consumes the bucket.** `derivedPipelineSql()` / `derivedPipelineWhere(values)`: the permissions operator `src/shared/dal/server/lib/permissions/operators/derived-pipeline.ts` (dispatcher rule `rules/dispatcher.ts`, today `['leads']`); `customers/dal/server/queries.ts` (three sites); `customer-field-sql.ts` (the table's pipeline filter); `voip-campaign-contacts/lib/lead-campaign-status.ts`; voip `eligibility.ts`.

**3.3 Stored-column readers and writers.** `customers.pipeline` (text enum `active|rehash|dead`, default `active`, `db/schema/customers.ts:33-37`): read by the CASE above and by `lead-sources/lib/segment-sql.ts:22,25`; **no writer anywhere in `src`** (write-orphaned since the leads/customers separation). `meetings.pipeline` (`fresh|rehash|dead`, default fresh): written by `meetings/dal/server/crud.ts:101-106` through `OUTCOME_PIPELINE_MAP` on every outcome update (only when the map value is non-null, so an outcome set back to neutral leaves the old rehash/dead in place) and by `move-customer-to-pipeline.ts` (the super-admin's manual drag, `customer-pipelines.router.ts`); read by the kanban's rehash/dead/fresh branches (`customers/dal/server/pipeline-items.ts:160,225`), the meetings table filter (`meeting-field-sql.ts:46`), the proposals queries (`modules/proposals/core/dal/server/queries.ts:175,228,236`) and `features/customer-pipelines/dal/server/move-customer-pipeline-item.ts:107`.

**3.4 The per-meeting map.** `src/shared/domains/pipelines/lib/outcome-pipeline-map.ts` is a hand-written literal: `not_good`, `pns`, `npns`, `ftd`, `no_show`, `cancelled`, `nra` → rehash; `lost_to_competitor` → dead; everything else null. Against the ruling it has `not_good` and `ftd` as rehash. `db87d28d` derived it from `MEETING_OUTCOME_CLASS` (recallable → rehash, terminal → dead, else null).

**3.5 The kanban is not the bucket.** `pipeline-items.ts`: leads = customers with no meeting (ignores the stored column and projects); rehash/dead = customers with a meeting whose stored `meetings.pipeline` is that tab, `project_id IS NULL`, and (unless the viewer can `manage all`) the viewer participates; fresh = inner join on `meetings.pipeline = 'fresh'` with the same gates; projects = customers with a project. So a customer can sit in several tabs today (one cancelled meeting and one fresh meeting = rehash and fresh), while the bucket says one. The branch commit `13f361bb` (an ancestor, not in the tree) rewrote the kanban onto the single bucket (`customerInPipeline(tab)`); the 2026-08-19 ruling "exactly one tab" assumed it.

**3.6 Enum facts.** `meetingOutcomes` has 15 values (`constants/enums/meetings.ts:64`); `site_visit` and `cancelled_scopes` are not in it — the lifecycle slice 2 adds them in one push, prod before deploy. `MEETING_OUTCOME_SENTIMENT` is hand-written there (`:84`); there is no `MEETING_OUTCOME_CLASS` and no recallable/terminal split on main. `db87d28d`'s class map is a `Record<MeetingOutcome, MeetingOutcomeClass>`, so a new enum value fails `pnpm tsc` until it is classed; sentiment, `RECALLABLE_OUTCOMES`, `TERMINAL_OUTCOMES`, `POSITIVE_OUTCOMES` and the map derive from it. Its `derived-pipeline-sql.ts` builds the EXISTS subqueries with `db.select(...)` inside `lib/` (imports `@/shared/db`); the current file uses raw SQL with the `"customers"."id"` literal to dodge drizzle's ambiguous emission of the outer column.

**3.7 Re-applying `db87d28d`.** Five files: `enums/meetings.ts`, `outcome-pipeline-map.ts`, `customers/DOCS.md`, `derived-pipeline-sql.ts`, `meetings/DOCS.md`. The sync plan's dry run found one conflict (`outcome-pipeline-map.ts`, take the derived version). Add `reschedule_needed: 'neutral'`, keep the `EXISTS_PROJECT` export, apply R35 (project at any stage) and R36 (count non-project meetings only; `meetings.type <> 'Project'` or whichever predicate the lifecycle work settles on).

## 4. Data facts (read through the app, no SQL run)

- **Six stale rows.** The super-admin's leads kanban shows 518 cards, the dispatcher's 512. The six are customers with a stored `customers.pipeline = 'rehash'`, stage `schedule_manager_meeting`, no meeting, no proposal, no project, created 2026-03-20 to 03-28. Ids: `b9a89684-7c2f-451a-9408-6724165fd981`, `3137719b-0613-4aff-bb2a-ad7a777f08f0`, `a9fb3d78-80e2-410f-b029-4d47c0b24093`, `85a01fbd-f8d2-43f9-9b85-1686f09535fe`, `84657e80-7f7a-480f-8f0a-89cc5ae51874`, `bf0d60e4-5708-4693-8f3a-5d320fb7959b`. Predicate: `customers.pipeline <> 'active' AND NOT EXISTS meeting AND NOT EXISTS project`. Owner 2026-10-07: legacy moves, deal with them later. Under the derived model the stored column is ignored and they read as leads. Prod may hold more such rows; nobody has counted.
- **Prod effect of the restore.** Customers whose meetings are all `not_good`/`ftd` move from rehash to dead; customers whose only meeting is cancelled, no-show or lost-to-competitor move from fresh (today: "has a meeting") to rehash or dead; a positive outcome without a project row reads as projects. If the kanban keeps reading `meetings.pipeline`, existing rows keep their stored value until a backfill (`UPDATE meetings SET pipeline = 'dead' WHERE meeting_outcome IN ('not_good','ftd') AND project_id IS NULL` is the likely statement; not run, not approved).
- **The 2026-08-19 dev probe** (memory `project-casl-phase-5-customer-pipelines`): 187 customers partitioned 1:1 across tabs under the single-bucket kanban; the leads collapse recovered six customers a stale stored value had hidden — the same class of rows as above.

## 5. Docs that will be stale the day the model lands

- `src/shared/entities/customers/DOCS.md` §derived-5-bucket-pipeline — documents the stored passthrough ("rehash | dead → passthrough", "a dead customer may have no meetings"). `db87d28d` rewrote it.
- `src/shared/db/schema/customers.ts:33-35` — the column comment ("coarse 3-bucket customer-level pipeline").
- `docs/ubiquitous-language.md:125, 271-272` — "Pipeline Stage: computed for Fresh, stored for Projects/Rehash/Dead".
- `docs/plans/2026-10-01-sales-lifecycle-rules-map.md:26` — "customers.pipeline + derived pipeline".
- `docs/permissions/visibility-rules-catalog.md:100` — the old `pipeline = 'active' AND NOT EXISTS meeting` leads predicate.
- `src/shared/entities/meetings/DOCS.md` — `cancelled`/`no_show` → rehash lines agree with the model; fine as they are.
- `docs/plans/2026-09-13-main-285-sync-plan.md` step 1.1 — superseded by this handoff.

## 6. Open for the lifecycle work (ruled nowhere)

1. Kanban onto the single bucket (`13f361bb`'s shape), the two stored pipeline columns dropped, and the super-admin's manual drag between tabs retired — under a derived model a customer moves by an outcome. The pipeline-speed work is rebuilding the same kanban (phase 2 action hosts next); coordinate. The permissions session proposed this as its own change; the owner has not been asked.
2. R34's "no approved/declined stage in fresh" against `computeFreshStage` (§2).
3. Mixed recallable and terminal outcomes → rehash (2026-08-19). A customer lost to a competitor after an earlier cancel lands in rehash; confirm that is wanted.
4. A positive outcome with no project row (outcome set by hand; R2 says it should not be hand-pickable) reads as projects, while `signed-customer-sql.ts` (EXISTS project) says not signed. Two definitions of converted.
5. S2: a lead meeting rescheduled before it happens — the original goes `cancelled` (recallable), the replacement is `not_set`; under the model the customer is fresh, which matches S2's intent; the stored `meetings.pipeline = 'rehash'` on the original is what the kanban shows today.
6. R36's vocabulary: what to call the non-project meetings ("any meeting past the first sittable meeting the customer had").
7. Who runs the prod backfill (§4), and whether `segment-sql.ts` (lead-source segments) moves onto the bucket in the same change.
8. Wt 285 part 2 widens the dispatcher's reach to the four operational buckets (D-05). On today's CASE the rehash and dead arms are dead code (nothing writes the stored column), so the widening shows the dispatcher leads and fresh only until main's model lands; then rehash and dead become real sets for that role.

## 7. The contract with worktree 285

The permissions epic treats the bucket as an opaque operator and lands no outcome logic:

- Keep the two exports and their shapes in `src/shared/entities/customers/lib/derived-pipeline-sql.ts`: `derivedPipelineSql(): SQL<Pipeline>` (a select column correlated on the outer `customers` row) and `derivedPipelineWhere(values: readonly Pipeline[]): SQL | undefined` (empty list → undefined). Keep the `EXISTS_PROJECT` export for `signed-customer-sql.ts`.
- The operator `src/shared/dal/server/lib/permissions/operators/derived-pipeline.ts` calls `derivedPipelineWhere` with the rule's list and refuses any outer table but `customers`. Rules name buckets with `$inDerivedPipeline: [...]`; the type `Pipeline` comes from `constants/enums/pipelines.ts`.
- Whatever main makes the bucket compute flows into the rules unchanged. The branch merges main into itself at every part boundary, so the model arrives on the branch by merge, never by a branch commit.
- Dispatcher reach (D-05: `['leads','rehash','dead','fresh']`) is a one-line rule change in `src/shared/domains/permissions/rules/dispatcher.ts`, planned for part 2 of unit 3.

## 8. Sources folded in

The permissions session's research of 2026-10-07 (scratch, not committed): the Q11 context report (both models, the recorded decisions and their contradictions, the enum facts, the restore's effects) and the six-leads check. Everything of lasting value from both is above. The permissions tracker (`docs/plans/2026-08-10-casl-scope-compiler-epic.md` on the branch) keeps D-05, strikes Q11 and points D-06 here.
