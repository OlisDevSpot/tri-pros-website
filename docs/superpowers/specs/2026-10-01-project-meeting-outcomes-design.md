# Project meeting outcomes — `site_visit`, per-type outcome sets, assign-as-move

> **Status:** approved in conversation 2026-10-01; spec awaiting owner review → writing-plans.
> **Touches the cluster** pulled out in `docs/plans/2026-09-29-approval-project-outcome-handoff.md`. This spec settles that handoff's §7 "linking a meeting to an existing project under the derived outcome" and the approval → outcome derivation for both meeting kinds. Project *creation* on approval stays with that redesign.

## 1. Owner requirements

1. A **project meeting** (`meetingType = 'Project'`) that did not produce an approved proposal is a **site visit**. `site_visit` is the project meeting's default outcome — its `not_set`.
2. Each meeting type offers only its own outcomes. `site_visit` and `additional_work` are project-only; lead outcomes (`pns`, `converted_to_project`, `follow_up_needed`, `nra`, …) never appear on a project meeting.
3. Site visits are **never leads** and never feed sits or sit rate. They serve internal sales analytics — visits per rep against upsell results ("squeezing the lemon" per customer).
4. **Assign to Project = move a misplaced meeting** into the project it was meant for, instead of deleting and recreating it. Any outcome the project type does not allow becomes `site_visit`.
5. `assignToProject` must stop writing `converted_to_project`, and the action must exist on every meeting surface.
6. When a proposal is approved, the **meeting's type** — not the proposal's frozen `kind` — decides the outcome: Project → `additional_work`, lead type → `converted_to_project`.
7. Existing data is backfilled to match these rules, derived from each meeting's real state (not a blind `not_set → site_visit`).

## 2. Outcome model — `src/shared/constants/enums/meetings.ts`

- Add `site_visit` to `selectableMeetingOutcomes` (hand-pickable, never disabled). Place it with the neutrals, before `follow_up_needed`.
- `MEETING_OUTCOME_SENTIMENT.site_visit = 'neutral'` (amber; colour stays a pure function of sentiment).
- `MEETING_OUTCOME_SIT.site_visit = 'sat'`.
- `outcomeRequiresReason('site_visit') === false` falls out of the sentiment (neutral, not in the explicit list).
- `MEETING_OUTCOME_LABELS.site_visit = 'Site Visit'`; `OUTCOME_PIPELINE_MAP.site_visit = null`.
- New single source for per-type outcome sets, co-located with `isProjectMeeting`:

```ts
const PROJECT_MEETING_OUTCOMES = [
  'site_visit', 'proposal_created', 'proposal_sent', 'additional_work',
  'reschedule_needed', 'no_show', 'cancelled',
] as const satisfies readonly MeetingOutcome[]

// Lead types (Fresh, Follow-up, Rehash): every outcome except the project-only ones.
const PROJECT_ONLY_OUTCOMES = ['site_visit', 'additional_work'] as const

export function outcomesForMeetingType(type: MeetingType): readonly MeetingOutcome[]
export function defaultOutcomeForMeetingType(type: MeetingType): MeetingOutcome // Project → site_visit, else not_set
export function isOutcomeAllowedForMeetingType(type: MeetingType, outcome: MeetingOutcome): boolean
```

- DB: `meeting_outcome` enum gains `site_visit` (`ALTER TYPE … ADD VALUE`, non-destructive). Must reach each DB **before** code that compares against the literal deploys there.

## 3. Evergreen rules in `meetingCrud` — `src/shared/entities/meetings/dal/server/crud.ts`

Every outcome writer goes through `meetingCrud`, so the per-type rule lives in its hooks.

- **`create.before`:** when `meetingOutcome` is absent, set `defaultOutcomeForMeetingType(input.meetingType ?? 'Fresh')`. Covers the create form, duplicate (which excludes `meetingOutcome`), reschedule, and SYSTEM_CONTEXT creators. A supplied outcome the type does not allow is refused.
- **`update.before`**, when `meetingType` or `meetingOutcome` is in the patch — resolve the post-update type (reading the stored row when the patch lacks `meetingType`, as the confirmation reset already does):
  - **Type changes:** the stored (or patched) outcome stays if the new type allows it; otherwise it becomes the new type's default.
  - **Outcome set directly** to a value the type does not allow (type unchanged): refuse with `ThrowableDalError({ type: 'precondition-failed', reason: 'outcome_not_allowed_for_meeting_type' })`.
  - The existing `OUTCOME_PIPELINE_MAP` step runs on the resolved outcome.
- `deriveOutcomeOnProposalSent` (`mutations.ts`): `OVERWRITABLE_OUTCOMES` gains `site_visit`.

## 4. Approval derives the outcome — `proposalCrud` `update.after`

- In `src/shared/modules/proposals/core/dal/server/crud.ts`, `update.after`: when `'status' in meta.input`, `row.status === 'approved'`, `meta.previousRow.status !== 'approved'` and `row.meetingId` is set, read the meeting's type and write via `meetingCrud.update` (so meeting hooks fire):
  - `Project` → `additional_work`
  - lead type → `converted_to_project`
- Approval always wins: an approved sale overrides any prior outcome. Both values are allowed for their type, so §3 never refuses it.
- Covers every approval path: records status cell, `AssignProjectDialog`'s approve button, contract `completed` (`applyContractEvent`).
- Delete `deriveOutcomeOnAdditionalWorkApproved` + `ADDITIONAL_WORK_OVERWRITABLE` (`meetings/dal/server/mutations.ts`) and its call in `src/shared/services/contracts.service.ts:210`.
- `projectsRouter.business.create` keeps writing `converted_to_project` with `projectId` (consistent with the derivation; project creation itself is the redesign's).
- Un-approving does not touch the outcome (handoff §7 question, still open).

## 5. Assign to Project = move — router + action

- `customerPipelinesRouter.assignToProject` (`src/trpc/routers/customer-pipelines.router.ts`) writes `{ projectId, meetingType: 'Project' }` — no outcome. §3 maps the outcome (`pns`, `not_set`, `follow_up_needed`, … → `site_visit`; `proposal_sent`, `no_show`, … kept).
- Refuse (`PRECONDITION_FAILED`) when the meeting has an approved `initial-sale` proposal: that meeting birthed its project; moving it would erase the sale and the lead's sit. Project meetings may move between projects (type already `Project`, outcome kept).
- `useMeetingActionConfigs` owns `AssignProjectDialog` (like `AssignOwnerDialog`): returns `AssignProjectDialog` for consumers to render; `assignProject` is always in `actions`, gated by `['update','Meeting']`; `onAssignProject` remains an optional override. Disabled reason via `getDisabledReason`: "This meeting created its project" when the entity reports an approved initial-sale proposal (field added to `MeetingEntity`; surfaces that lack it load it with their meeting data).
- `use-meetings-table.tsx` drops its local dialog/state and renders the hook's dialog. All `useMeetingActionConfigs` consumers (schedule calendar, overview card → kanban card / schedule meeting card / agent dashboard card / customer meetings list / project entity card) render the returned dialog.
- Out of scope, noted for the redesign: the dialog's approve button toast ("a project will be created") is false.

## 6. Outcome pickers

Every outcome editor reads `outcomesForMeetingType(meeting.meetingType)`; disabled-derived behaviour (`getOutcomeDisabledChecker`) is unchanged where it already applies:

| Surface | File | Today |
|---|---|---|
| Action-menu select | `entities/meetings/hooks/use-meeting-action-configs.tsx` (`MEETING_OUTCOME_OPTIONS`) | selectable only |
| Overview card | `entities/meetings/components/overview-card.tsx` (`statuses={selectableMeetingOutcomes}`) | selectable only |
| Meetings table column | `entities/meetings/lib/columns-registry.tsx` | all + disabled checker |
| Closing step | `features/meeting-flow/ui/components/steps/closing-step.tsx` | all + disabled checker |
| Context panel | `features/meeting-flow/ui/components/context-panel.tsx:45` (`options: meetingOutcomes`) | every outcome |

Static `MEETING_OUTCOME_OPTIONS` becomes a per-type lookup (`getOutcomeOptions(type)`). Each surface's meeting shape must carry `meetingType`; add it where missing.

## 7. Analytics — `src/features/analytics/`

- **Site visit** = a project meeting (`order === 'project'`), scheduled in the past, outcome not in `DID_NOT_OCCUR_OUTCOMES` (`not_set`/`reschedule_needed`/`no_show`/`cancelled`). Past-only because `site_visit` is now a default, not a result.
- New tallies/metrics, on the **Sales** tab (figures, columns, chart series), credited by the meeting's closers for visits and the sale's closers for closes:
  - `siteVisits` — count of site visits.
  - `upsellCloses` — sales with `kind !== 'new'`.
  - `upsellRate` — `upsellCloses / siteVisits` (added to the rate table in `analytics-rules.ts`).
  - `revenuePerSiteVisit` — `revenueUpsellCents / siteVisits`.
- `siteVisits` is a sales-stage figure: it stays applicable when Sales is grouped by closer/month/leadSource.
- **`meetings`** (Appointments tab) excludes project meetings — lead meetings only. Booked leads, sits, sit rate already exclude them (`deriveMeetingOrder`, `pickBookedLead`).
- `meetingsWithoutOutcome` hygiene: project meetings default to `site_visit`, so they never show as unresolved.

## 8. Data backfill — `scripts/backfill-meeting-outcomes-by-type.ts`

Follows `scripts/backfill-meeting-participants.ts` (`./lib/load-env`, raw `db`, before/after counts) with `--dry-run` printing every change grouped by `(type, from → to)`. Writes go through raw SQL, not `meetingCrud`, so no GCal/Ably side effects fire for 20-odd historical rows; idempotent.

Derivation, in order, per meeting:

1. **Row fixes first:** `403f9907-6d71-4203-8aca-74a089439a5a` (Project, no project) → `meetingType = 'Fresh'`; `545fe796-fd2f-4734-abaf-99f944b71f9b` (Fresh, linked, no proposals) → `meetingType = 'Project'`. Skipped when the id is absent (dev vs prod).
2. **Approved proposal** on the meeting → Project: `additional_work`; lead: `converted_to_project`.
3. **Project meetings** otherwise: sent proposal → `proposal_sent`; any proposal → `proposal_created`; current outcome in `reschedule_needed`/`no_show`/`cancelled` → keep; else → `site_visit`.
4. **Lead meetings** with an outcome their type does not allow → `not_set` (expected: none).

Dev snapshot (2026-10-01, meetings up to 2026-09-28): Project `not_set` + approved additional-work ×9 → `additional_work`; Project `converted_to_project` + approved additional-work ×2 → `additional_work`; Project `not_set`, no proposals ×11 → `site_visit`; plus the two row fixes. Correct already: Fresh `converted_to_project` ×24, Project `additional_work` ×4, Project `proposal_sent` ×2.

## 9. Rollout order

1. `pnpm db:push:dev` (enum value) → backfill `--dry-run` on dev → backfill on dev.
2. Enum value pushed to prod (`db:push:prod`, owner go-ahead).
3. Backfill `--dry-run` against prod (`DRIZZLE_TARGET=prod`) → owner reviews counts → backfill on prod.
4. Deploy code.

## 10. Docs touched

- `src/shared/entities/meetings/DOCS.md` (outcome derivation table, `additional_work` row), `src/shared/modules/proposals/core/DOCS.md` (`#conversion-trigger`): replace the outcome rules with a pointer to the code (`outcomesForMeetingType`, the two crud hooks).
- `docs/plans/2026-09-29-approval-project-outcome-handoff.md`: record what this spec settled (approval → outcome by meeting type; assign = move) and what stays open (project creation, un-approve, the dialog's false toast).

## 11. Verification

No test runner exists in the repo. Verification is:

- `pnpm tsc` + `pnpm lint`.
- Backfill dry-run output on dev, then read-only SQL: zero meetings whose outcome is outside `outcomesForMeetingType(type)`; zero meetings with an approved proposal and a non-positive outcome.
- Rendered screenshots (own browser): outcome pickers on a project vs a lead meeting on all five surfaces; Assign to Project present on every surface, disabled on a converted meeting; analytics Sales tab grouped by closer showing the four new metrics.
- Manual flow on dev: move a Fresh `pns` meeting into a project → Project + `site_visit`; approve a proposal on a project meeting via the status cell → `additional_work`.

## 12. Out of scope

Project creation on approval, un-approve semantics, ownership of auto-created projects, `CreateProjectModal` removal, the dialog's false toast — all remain with the approval/project/outcome redesign.
