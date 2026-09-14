# Meetings — Business Rules

A **Meeting** is a scheduled (or completed) in-home sales appointment between an agent and a customer. Customer (1) → Meeting (many) → Proposal (many). The meeting is the unit of agent participation — visibility for customers, proposals, and contracts all flow from "did this agent participate in this meeting?"

This directory holds: schemas (`schemas/`), constants (status colors, outcome options, actions), business helpers + computed values (`lib/`), CRUD + business DAL + participants + GCal sync (`dal/server/`), action-config hooks (`hooks/`), and reusable components (`components/`, including `participant-picker/` and `manage-participants-modal/` sub-groups).

## Relationships

```
Customer ──► Meeting ──► Proposal
                │
                ├──► MeetingParticipants (many: owner, co_owner, helpers)
                │
                └──► Project (set on conversion; null until then)
```

## Rules

### ownership-model

`meetings.ownerId` is a **permission level**, not a meeting role. It answers "who can delete/fully-edit this meeting?" The owner is the user who created the meeting record.

- If info@ (system account) creates → info@ is owner. The meeting has no implicit primary rep.
- If any other user creates → that user is owner AND is implicitly the meeting's primary rep (equivalent to the `owner` participant role) until explicit participants are added.
- Only the owner OR a super-admin can delete a meeting.

**Why**: ownership controls permissions (delete, full update). Participation roles control meeting-contextual function (who's the sales rep, who's QA). These are orthogonal concerns — see `#participant-roles-are-meeting-contextual`.
**Reference impl**: schema (`ownerId` column); `create.before` in `dal/server/crud.ts` (resolves ownerId via `lib/resolve-owner.ts`)
**Enforced by**: CASL conditions (planned: `can('delete', 'Meeting', { ownerId: user.id })`) + convention

### system-account-not-a-person

The system account (`info@triprosremodeling.com`, resolved via `getSystemOwnerId()`) is a godmode super-admin. It is NOT a person — it cannot be dispatched to a meeting, cannot be a sales agent, cannot attend. It exists to create and manage things on behalf of the company.

When info@ owns a meeting with no participants: the meeting has **no sales agent**. It's an unassigned meeting waiting for dispatch.

When any other user owns a meeting with no participants: that user **implicitly fills the primary rep role** (equivalent to the `owner` participant) because someone has to do the work.

**Why**: info@ is the company identity, not a person. Sean (sean@) is a person who happens to be super-admin. The system must distinguish between "company created this" and "a person created this" for dispatch logic.
**Reference impl**: `src/shared/constants/system-users.ts` (`SYSTEM_OWNER_EMAIL`); `src/shared/entities/users/dal/server/system.ts` (`getSystemOwnerId`)
**Enforced by**: convention + dispatch derivation logic (planned)

### participant-roles-are-meeting-contextual

Participant roles describe a user's function **in the context of a specific meeting**, not their system-wide role. Real, current roles (`meetingParticipantRoles`):

- **`owner`**: the primary rep running this meeting — the dispatch-relevant role. At most one per meeting (Postgres partial unique index). This is a *participant role*, distinct from `meetings.ownerId` (the row-level permission owner, see `#ownership-model`) — the two are often but not always the same user, and the doubled "owner" name is a known naming collision, not two names for the same thing.
- **`co_owner`**: a second rep with equal functional standing. At most one per meeting (partial unique index).
- **`helper`**: any number of additional participants. Unconstrained.

**Write capability is separate from participant role.** Whether a user can create/read/update a Meeting at all comes from the CASL `agent` role (`can('read'|'create'|'update'|'own', 'Meeting')` — see `src/shared/domains/permissions/abilities.ts`), not from holding a participant role. A participant row only describes function within a meeting the user is already permitted to act on (dispatch status, visibility bridging) — it is not itself the permission gate.

The `(meetingId, userId)` unique constraint prevents the same user holding multiple roles on one meeting.

**Why**: `meetings.ownerId` is a permission concern (who can delete/fully-edit?); participation is a functional concern (who's the primary rep, who's the co-rep, who's just along). Separating them lets both systems evolve independently — see `#ownership-model` for the ownership half.
**Reference impl**: `src/shared/constants/enums/meeting-participants.ts` (`meetingParticipantRoles`); `src/shared/db/schema/meeting-participants.ts` (partial unique indexes on `owner`/`co_owner`); `dal/server/participants.ts` (`getOwnerCoOwnerForMeetings`, `getParticipantByRole`); `src/shared/domains/permissions/abilities.ts` (CASL `agent` role grants)
**Enforced by**: Postgres unique constraint (one `owner`, one `co_owner` per meeting) + CASL ability checks (`can('read'|'create'|'update'|'own', 'Meeting')`) + convention

### dispatched-derived

A meeting is **dispatched** when it has a primary rep — either explicit or implicit:

- Row owner is system account (info@) + no `owner` participant → **not dispatched**
- Row owner is system account (info@) + has `owner` participant → **dispatched**
- Row owner is any real person + no participants → **dispatched** (that person implicitly fills the `owner` participant role)
- Row owner is any real person + has `owner` participant → **dispatched** (explicit assignment)

`isDispatched` is a **derived boolean** — computed from ownerId + participants, never stored.

**Why**: dispatch status determines whether a meeting is actionable. A meeting created by info@ with no primary rep is an inbox item waiting for assignment. A meeting created by an agent is immediately actionable.
**Reference impl**: planned — `lib/is-dispatched.ts` helper
**Enforced by**: convention (derived, never stored)

### visibility-via-participation

A non-omni agent sees a meeting only if they are a participant (any of `owner | co_owner | helper`). Super-admins (`ability.can('manage', 'all')`) bypass scoping.

This predicate cascades upward to customers (`../customers/DOCS.md#visibility-via-meeting-participation`) and downward to proposals (`../proposals/DOCS.md#visibility-via-meeting-participation`).

**Why**: meeting participation is the single source of "did this agent work with this customer." Every visibility predicate in the entity graph derives from here.
**Reference impl**: `dal/server/participants.ts:userParticipatesInMeeting`
**Enforced by**: `scopeMiddleware(meetingServerSpec)` on every entity procedure (when meetings is migrated to the entity server system)

### meeting-type-vs-pipeline-are-orthogonal

`meetingType` and `pipeline` are independent enums tracking different things:

| Field | Values | Meaning |
|---|---|---|
| `meetingType` | `Fresh | Follow-up | Rehash | Project` | What kind of appointment is this? |
| `pipeline` | `fresh | rehash | dead` | What sales-funnel pipeline does this meeting live in? |

Only `Fresh` and `Project` are creatable (`creatableMeetingTypes`); `Follow-up` and `Rehash` are outcomes of prior meetings, not creation types.

**Why**: the type captures the appointment's nature (first visit vs. follow-up vs. rehash vs. construction site visit); the pipeline captures the kanban bucket. Conflating them would prevent agents from distinguishing "a follow-up in the fresh pipeline" from "a fresh first-meeting in the rehash pipeline."
**Reference impl**: `src/shared/constants/enums/meetings.ts` (types); `src/shared/constants/enums/pipelines.ts` (pipelines)
**Enforced by**: tsc (separate enums) + create form (only creatable types in dropdown)

### meeting-pipeline-storage-vs-derived

The `meetings.pipeline` column stores 3 values (`fresh | rehash | dead`). A meeting's display pipeline includes `projects` — derived from `projectId IS NOT NULL`. The customer-pipeline `derivedPipelineSql` mirrors this (see `../customers/DOCS.md#derived-5-bucket-pipeline`).

**Why**: a meeting with a project IS a project-pipeline meeting; the projectId link is the source of truth, not a separate enum value.
**Reference impl**: schema; consumers branch on `meetings.projectId IS NOT NULL`
**Enforced by**: convention

### outcome-selectable-vs-derived

`meetingOutcomes` is a composite of:

- **Selectable** (`selectableMeetingOutcomes`) — `not_set | not_good | pns | npns | ftd | no_show | lost_to_competitor | follow_up_needed`. These appear in the outcome dropdown.
- **Derived** (`derivedMeetingOutcomes`) — `proposal_created | proposal_sent | converted_to_project`. These appear in the dropdown but are **disabled** — set automatically by upstream events.

**Why**: derived outcomes encode pipeline progression and must not be hand-set. `converted_to_project` is set when a project is created or linked (`projects.router/business.router.ts` `create`, or `customerPipelinesRouter.assignToProject`) — proposal approval only unlocks the dropdown option, it does not itself write the outcome (see `../proposals/DOCS.md#conversion-trigger`); `proposal_sent` is set by sending a proposal (see `#outcome-flips-on-proposal-sent`).
**Reference impl**: `src/shared/constants/enums/meetings.ts`
**Enforced by**: convention + disabled UI options in outcome picker

### outcome-flips-on-proposal-sent

When a proposal is sent on a meeting, the meeting's outcome **conditionally** flips to `proposal_sent`:

- If outcome is `not_set` or `proposal_created` → overwrite to `proposal_sent`
- Anything else (manually-set outcome, terminal derived outcome like `converted_to_project`) → preserve

**Why**: this prevents overwriting meaningful outcomes when a second proposal is sent on the same meeting (`converted_to_project` is sticky once a project exists; agent's `follow_up_needed` shouldn't be silently clobbered by a re-send).
**Reference impl**: `dal/server/mutations.ts:deriveOutcomeOnProposalSent`
**Enforced by**: SQL WHERE clause (`inArray(meetings.meetingOutcome, OVERWRITABLE_OUTCOMES)`)

### outcome-change-single-controller

User-initiated meeting-outcome changes go through `useOutcomeChange` (`hooks/use-outcome-change.tsx`) — the ONE controller that applies the reason gate (`outcomeRequiresReason` → reason modal → `setOutcomeWithReason`; else `updateOutcome`). Server-side derivations (see `#outcome-flips-on-proposal-sent`) bypass this controller by design. `updateOutcome`/`setOutcomeWithReason` are never called for user-initiated outcome changes outside that controller. Config-driven surfaces get it via `useMeetingActionConfigs`, which owns one instance and returns `changeOutcome` + `OutcomeReasonDialog`; consumers render the dialog like they render `DeleteConfirmDialog`. Adding a direct `updateOutcome.mutate` at a call site is the bypass this rule exists to prevent.

### outcome-cancelled-means-archived

`cancelled` canonically means **archived**: the meeting did not happen and is
not currently being rescheduled, but the record is kept. It is negative
sentiment and maps to the `rehash` pipeline (customer returns to the recall
pool). Distinguish from `no_show` — the customer failed to appear at the
scheduled time — which is also negative/rehash but records a different fact.
Setting an outcome to `cancelled` removes the meeting's Google Calendar event
(the meeting row is preserved); see `#gcal-removed-on-cancel`.

### gcal-removed-on-cancel

When a meeting's `meetingOutcome` transitions to `cancelled`, the `update.after`
hook dispatches `deleteMeetingEventJob` for its `gcalEventId` and clears the
`gcalEventId`/`gcalEtag`/`gcalSyncedAt` fields on the row. The row itself is
preserved. `no_show` is intentionally NOT treated this way (its event is already
in the past). The one-time transition guard + gcalEventId null-check prevent
re-dispatch.

**Reference impl**: `dal/server/crud.ts:hooks.update.after`
**Enforced by**: convention (one-time transition guard in the hook)

### reschedule-cancels-and-rebooks

The Reschedule action (`meetingsRouter.business.rescheduleMeeting`) keeps the
original meeting and sets it to `cancelled`, then books a NEW meeting at the new
time copying the original's owner + all participants + customer + project +
type + `flowStateJSON` (outcome resets to `not_set`), and posts one customer
note. Available only from `DID_NOT_OCCUR_OUTCOMES` (`canRescheduleFromOutcome`)
so a meeting that already happened can never have its disposition clobbered.

**Why the flow state carries**: a reschedule is the same sit moved to a new slot. Trade selections, program, deal structure and closing adjustments entered before the customer no-showed or had to stop are still the opportunity's working state, and nothing in that blob is bound to the calendar date — so the replacement resumes where the original left off instead of making the agent re-enter it. This is the ONLY path that carries `flowStateJSON`; duplicate deliberately drops it (`#duplicate-copies-setup-only`). The cancelled original keeps its own copy as the archived record.
**Reference impl**: `src/trpc/routers/meetings.router/business.router.ts:rescheduleMeeting`

### trade-selections-snapshot-source

`meetings.flowStateJSON.tradeSelections` is the meeting-time scope picker output. On proposal creation, the create handler snapshots these into the proposal's SOW (`projectJSON.data.sow`). After snapshot, the proposal SOW is independent.

**Why**: the agent picks trades during the meeting; that picks-list flows into the first proposal as a starting point. Once the proposal exists, the agent edits the SOW independently — re-pulling from meeting state would erase their work.
**Reference impl**: `../proposals/dal/server/crud.ts:hooks.create.before` (the snapshot step, reads meeting via `meetingCrud.getById`); `dal/server/google-calendar.ts:getMeetingForGCal` (also reads tradeSelections for the GCal event description)
**Enforced by**: convention

### gcal-sync-state-fields

Three columns track Google Calendar sync state:

| Column | Purpose |
|---|---|
| `gcalEventId` | The GCal event ID this meeting is pushed to. Null = not yet pushed. |
| `gcalEtag` | Last-known ETag from Google for conflict detection. |
| `gcalSyncedAt` | Timestamp of last successful push. |

**Why**: the app is the source of truth for meeting content; GCal is a downstream cache. Tracking etag + synced-at enables conflict-aware re-pushes.
**Reference impl**: `dal/server/google-calendar.ts`
**Enforced by**: convention (only GCal sync code touches these)
**Related**: `memory/project-gcal-sync-architecture.md` — planned per-entity QStash sync (defers full bidirectional sync; currently one-way push)

### dealStructure-derived-helpers

Meeting `flowStateJSON.dealStructure` carries the agent's in-meeting pricing scratchpad. Three derived values are computed (never persisted):

- `computeDealFinalTcp(deal)` → `max(0, startingTcp − Σ incentive.amount)`. Every incentive is a discount at the meeting stage (no discriminator, unlike proposal incentives).
- `computeDealMonthlyPayment(deal)` → amortized monthly when `mode === 'finance'`. Zero-interest falls back to `P / n`.
- `computeDealDepositPercent(deal)` → `round(depositAmount / finalTcp * 100)` when `mode === 'cash'`.

**Why**: derived = single source of truth (see `../proposals/DOCS.md#final-tcp-derived` for the same pattern). The meeting scratchpad mirrors what eventually flows into the proposal's `fundingJSON`.
**Reference impl**: `lib/compute-deal-derived.ts`
**Enforced by**: convention (no persisted columns; helpers exported from `lib/`)

### one-customer-per-meeting-nullable

`meeting.customerId` is nullable (`onDelete: 'set null'`). A meeting without a customer is rare but valid (e.g., a customer is deleted, the meeting record survives for historical accounting).

**Why**: meeting history must outlive customer record changes; setting null on customer delete preserves the meeting without orphaning its FK.
**Reference impl**: schema
**Enforced by**: Postgres FK constraint

### meeting-owner-is-creator

`meetings.ownerId` is the user who created the meeting record. It controls **permissions** (delete, full update), not meeting function. See `#ownership-model` for the full ownership rules and `#participant-roles-are-meeting-contextual` for the distinction between ownership and participation.

**Reference impl**: schema (`ownerId` column); `create.before` in `dal/server/crud.ts` (resolves ownerId via `lib/resolve-owner.ts`)
**Enforced by**: `create.before` in `dal/server/crud.ts` (server-resolves ownerId for authed callers; `SYSTEM_CONTEXT` passes its explicit ownerId through)

### duplicate-copies-setup-only

The Duplicate action (`meetingsRouter.crud.duplicate`) copies the source row minus the PK and the `duplicate.exclude` list in `dal/server/crud.ts`, then routes through `create` — so `create.before` re-resolves the owner and `create.after` adds the owner participant and enqueues a fresh GCal push. Anything not in the exclude list is copied; the list is the single source of truth.

| Survives | Starts fresh |
|---|---|
| `customerId`, `meetingType`, `scheduledFor` | `meetingOutcome` → `not_set`, `pipeline` → `fresh` (column defaults) |
| `contextJSON` | `flowStateJSON` — the sit's working state (trade selections, program, deal structure, closing adjustments) |
| | `projectId` — the copy is not a project meeting |
| | `agentNotes` |
| | `gcalEventId` / `gcalEtag` / `gcalSyncedAt` — the copy is pushed as a new calendar event |
| | `ownerId` → the duplicating user (`duplicate.overrides`; falls back to the source owner under `SYSTEM_CONTEXT`) |

**Why**: a duplicate is a fresh sit that shares the customer and setup — not a continuation of the source. Working state, project link, outcome, notes and calendar identity all describe the source sit and must not leak into a new one. The ONE path that carries `flowStateJSON` forward is reschedule (`#reschedule-cancels-and-rebooks`), because a reschedule is the same sit moved to a new slot.
**Reference impl**: `dal/server/crud.ts` (`duplicate.exclude` + `duplicate.overrides`); engine `src/shared/dal/server/lib/create-crud-dal.ts` (`duplicateImpl`)
**Enforced by**: config — `duplicate.exclude` in `dal/server/crud.ts`

## Anti-patterns

- **Carrying `flowStateJSON` (or `projectId`) on duplicate.** A duplicate is a fresh sit; only reschedule continues one — see `#duplicate-copies-setup-only` / `#reschedule-cancels-and-rebooks`.
- **Adding `'projects'` to `meetings.pipeline` enum.** Use `projectId IS NOT NULL` — see `#meeting-pipeline-storage-vs-derived`.
- **Selecting `meetingOutcome = 'converted_to_project'` from the outcome dropdown without actually creating/linking a project.** The dropdown option is enabled once the meeting has an approved proposal, and selecting it writes the enum directly (`useOutcomeChange` → plain `updateOutcome`) — it does NOT create a project. This desyncs the outcome from reality; always drive the outcome via project creation (`projects.router/business.router.ts` `create`) or `customerPipelinesRouter.assignToProject` instead. See `../proposals/DOCS.md#conversion-trigger`.
- **Unconditionally setting `meetingOutcome = 'proposal_sent'` when sending a proposal.** Use `deriveOutcomeOnProposalSent` — see `#outcome-flips-on-proposal-sent`.
- **Storing computed deal values** (`finalTcp`, `monthlyPayment`, `depositPercent`) on the meeting. Always derive.
- **Joining `meetingParticipants` directly into a meetings list query without `getOwnerCoOwnerForMeetings`.** The raw join cross-products when duplicates exist; the batch helper deduplicates safely.
- **Re-snapshotting trade selections from meeting on proposal update.** Snapshot is at create only.
- **Trusting `meetings.ownerId` as the salesperson.** `meetings.ownerId` is a permission level, not a functional role. Check the `owner` participant role (or implicit owner-fills-role for non-system row owners). See `#ownership-model`.
- **Treating the system account (info@) as a person.** It cannot be dispatched, cannot be a sales agent. See `#system-account-not-a-person`.
- **Storing `isDispatched` as a column.** Always derive from ownerId + participants. See `#dispatched-derived`.
- **Conflating `meetings.ownerId` (row permission owner) with the `owner` participant role (primary rep).** They track different concerns on different tables and are not always the same user. See `#ownership-model` and `#participant-roles-are-meeting-contextual`.

## See also

- `../customers/DOCS.md#visibility-via-meeting-participation` — meeting participation is the visibility bridge
- `../proposals/DOCS.md#conversion-trigger` — approval is a precondition for project creation, not the trigger itself; project creation/linking sets `converted_to_project`
- `../proposals/DOCS.md#sow-snapshot-from-meeting-on-create` — proposal-side of trade-selections snapshot
- `../projects/DOCS.md#one-project-per-birthing-meeting` — projectId link semantics (a project has one birthing meeting; later meetings on it are typed `Project`)
- `memory/project-gcal-sync-architecture.md` — GCal sync architecture (planned)
- `docs/codebase-conventions/dal-conventions.md` — DAL conventions
- `docs/codebase-conventions/jsonb-columns.md#never-shallow-merge-nested` — `contextJSON`/`flowStateJSON` are whole-document writers; always plain-replaced, never merged (the `jsonbMergeColumns` opt-in mechanism these columns deliberately stayed out of was deleted entirely in Wave 2, epic #256)
- ADR-0005 — JSONB vs column vs child table (storage-shape decision rule)
