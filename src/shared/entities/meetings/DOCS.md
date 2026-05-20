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

- If info@ (system account) creates → info@ is owner. The meeting has no implicit sales agent.
- If any other user creates → that user is owner AND implicitly fills all participation roles (sales_agent, etc.) until explicit participants are added.
- Only the owner OR a super-admin can delete a meeting.

**Why**: ownership controls permissions (delete, full update). Participation roles control meeting-contextual function (who's the sales rep, who's QA). These are orthogonal concerns — see `#participant-roles-are-meeting-contextual`.
**Reference impl**: schema (`ownerId` column); `hooks.create.before` in `lib/server-spec.ts` (stamps ownerId)
**Enforced by**: CASL conditions (planned: `can('delete', 'Meeting', { ownerId: user.id })`) + convention

### system-account-not-a-person

The system account (`info@triprosremodeling.com`, resolved via `getSystemOwnerId()`) is a godmode super-admin. It is NOT a person — it cannot be dispatched to a meeting, cannot be a sales agent, cannot attend. It exists to create and manage things on behalf of the company.

When info@ owns a meeting with no participants: the meeting has **no sales agent**. It's an unassigned meeting waiting for dispatch.

When any other user owns a meeting with no participants: that user **implicitly fills all roles** (sales_agent, etc.) because someone has to do the work.

**Why**: info@ is the company identity, not a person. Sean (sean@) is a person who happens to be super-admin. The system must distinguish between "company created this" and "a person created this" for dispatch logic.
**Reference impl**: `src/shared/constants/system-users.ts` (`SYSTEM_OWNER_EMAIL`); `src/shared/entities/users/dal/server/system.ts` (`getSystemOwnerId`)
**Enforced by**: convention + dispatch derivation logic (planned)

### participant-roles-are-meeting-contextual

Participant roles describe a user's function **in the context of a specific meeting**, not their system-wide role. Current roles:

- **`sales_agent`**: the rep running this meeting. The primary role for dispatch.
- Future roles: `qa`, `financing`, `co_agent`, etc. — extensible as departments are added.

The `owner` role is **removed** from participants. Ownership lives on `meetings.ownerId` (the row column), not in the participants table. The participants table only tracks meeting-contextual functional roles.

The `(meetingId, userId)` unique constraint prevents the same user holding multiple roles on one meeting.

**Why**: the old system had redundancy — `ownerId` on the row AND an `owner` participant. Ownership is a permission concern (who can delete?); participation is a functional concern (who's the sales rep?). Separating them makes both systems cleaner.
**Reference impl**: `src/shared/db/schema/meeting-participants.ts` (indexes, planned refactor); `dal/server/participants.ts` (helpers)
**Enforced by**: Postgres unique constraint + convention
**Status**: PLANNED — current code still uses `owner`/`co_owner`/`helper` roles. Migration tracked in GitHub issues.

### dispatched-derived

A meeting is **dispatched** when it has a sales agent — either explicit or implicit:

- Owner is system account (info@) + no `sales_agent` participant → **not dispatched**
- Owner is system account (info@) + has `sales_agent` participant → **dispatched**
- Owner is any real person + no participants → **dispatched** (owner implicitly fills sales_agent)
- Owner is any real person + has `sales_agent` participant → **dispatched** (explicit assignment)

`isDispatched` is a **derived boolean** — computed from ownerId + participants, never stored.

**Why**: dispatch status determines whether a meeting is actionable. A meeting created by info@ with no sales agent is an inbox item waiting for assignment. A meeting created by an agent is immediately actionable.
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

**Why**: derived outcomes encode pipeline progression and must not be hand-set. `converted_to_project` is set by proposal approval (see `../proposals/DOCS.md#conversion-trigger`); `proposal_sent` is set by sending a proposal (see `#outcome-flips-on-proposal-sent`).
**Reference impl**: `src/shared/constants/enums/meetings.ts`
**Enforced by**: convention + disabled UI options in outcome picker

### outcome-flips-on-proposal-sent

When a proposal is sent on a meeting, the meeting's outcome **conditionally** flips to `proposal_sent`:

- If outcome is `not_set` or `proposal_created` → overwrite to `proposal_sent`
- Anything else (manually-set outcome, terminal derived outcome like `converted_to_project`) → preserve

**Why**: this prevents overwriting meaningful outcomes when a second proposal is sent on the same meeting (`converted_to_project` is sticky once a project exists; agent's `follow_up_needed` shouldn't be silently clobbered by a re-send).
**Reference impl**: `dal/server/mutations.ts:deriveOutcomeOnProposalSent`
**Enforced by**: SQL WHERE clause (`inArray(meetings.meetingOutcome, OVERWRITABLE_OUTCOMES)`)

### trade-selections-snapshot-source

`meetings.flowStateJSON.tradeSelections` is the meeting-time scope picker output. On proposal creation, the create handler snapshots these into the proposal's SOW (`projectJSON.data.sow`). After snapshot, the proposal SOW is independent.

**Why**: the agent picks trades during the meeting; that picks-list flows into the first proposal as a starting point. Once the proposal exists, the agent edits the SOW independently — re-pulling from meeting state would erase their work.
**Reference impl**: `../proposals/lib/server-spec.ts:hooks.create.before` (the snapshot step, reads meeting via `meetingCrud.getById`); `dal/server/google-calendar.ts:getMeetingForGCal` (also reads tradeSelections for the GCal event description)
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

**Reference impl**: schema (`ownerId` column); `hooks.create.before` in `lib/server-spec.ts`
**Enforced by**: lifecycle hooks (stamps ownerId from ctx.session)

## Anti-patterns

- **Adding `'projects'` to `meetings.pipeline` enum.** Use `projectId IS NOT NULL` — see `#meeting-pipeline-storage-vs-derived`.
- **Setting `meetingOutcome = 'converted_to_project'` manually.** Derived from proposal approval — see `../proposals/DOCS.md#conversion-trigger`.
- **Unconditionally setting `meetingOutcome = 'proposal_sent'` when sending a proposal.** Use `deriveOutcomeOnProposalSent` — see `#outcome-flips-on-proposal-sent`.
- **Storing computed deal values** (`finalTcp`, `monthlyPayment`, `depositPercent`) on the meeting. Always derive.
- **Joining `meetingParticipants` directly into a meetings list query without `getOwnerCoOwnerForMeetings`.** The raw join cross-products when duplicates exist; the batch helper deduplicates safely.
- **Re-snapshotting trade selections from meeting on proposal update.** Snapshot is at create only.
- **Trusting `meetings.ownerId` as the salesperson.** Owner is a permission level, not a functional role. Check participant `sales_agent` role (or implicit owner-fills-roles for non-system owners). See `#ownership-model`.
- **Treating the system account (info@) as a person.** It cannot be dispatched, cannot be a sales agent. See `#system-account-not-a-person`.
- **Storing `isDispatched` as a column.** Always derive from ownerId + participants. See `#dispatched-derived`.
- **Using `owner` as a participant role.** Ownership lives on `meetings.ownerId`. Participant roles are meeting-contextual functions (`sales_agent`, etc.). See `#participant-roles-are-meeting-contextual`.

## See also

- `../customers/DOCS.md#visibility-via-meeting-participation` — meeting participation is the visibility bridge
- `../proposals/DOCS.md#conversion-trigger` — proposal approval sets meeting outcome
- `../proposals/DOCS.md#sow-snapshot-from-meeting-on-create` — proposal-side of trade-selections snapshot
- `../projects/DOCS.md` (when written) — projectId link semantics
- `memory/project-gcal-sync-architecture.md` — GCal sync architecture (planned)
- `docs/codebase-conventions/dal-conventions.md` — DAL conventions
