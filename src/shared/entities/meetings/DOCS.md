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

### participant-roles-three

Meeting participants have three roles: `owner`, `co_owner`, `helper`.

- **Owner**: at most ONE per meeting (DB partial unique index `meeting_one_owner_idx`). The primary salesperson.
- **Co-owner**: at most ONE per meeting (DB partial unique index `meeting_one_co_owner_idx`). The secondary lead — often a manager or trainee.
- **Helper**: any number per meeting. Observers, assistants, junior reps shadowing.

The `(meetingId, userId)` unique constraint prevents the same user holding multiple roles on one meeting.

**Why**: the owner/co-owner partial unique indexes close the TOCTOU window in the app's check-then-insert pattern — atomic DB enforcement, no race.
**Reference impl**: `src/shared/db/schema/meeting-participants.ts` (indexes); `dal/server/participants.ts` (helpers)
**Enforced by**: Postgres (duplicate insert fails on the partial unique indexes)

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

### meeting-owner-not-just-creator

`meetings.ownerId` (the text column on the meetings table) is the agent who **created** the meeting record. This is **not** the same as the participants `owner` role — participation owner-roles are set independently via `meetingParticipants`. A meeting can be created by one user (`ownerId`) but have a different participant as the `owner` role.

**Why**: the create-meeting form auto-adds the creator as participant `owner` by convention, but the system permits reassignment (e.g., super-admin creates a meeting and assigns the actual rep).
**Reference impl**: schema (`ownerId` column); create-meeting handler in `dal/server/mutations.ts`
**Enforced by**: convention

## Anti-patterns

- **Adding `'projects'` to `meetings.pipeline` enum.** Use `projectId IS NOT NULL` — see `#meeting-pipeline-storage-vs-derived`.
- **Setting `meetingOutcome = 'converted_to_project'` manually.** Derived from proposal approval — see `../proposals/DOCS.md#conversion-trigger`.
- **Unconditionally setting `meetingOutcome = 'proposal_sent'` when sending a proposal.** Use `deriveOutcomeOnProposalSent` — see `#outcome-flips-on-proposal-sent`.
- **Storing computed deal values** (`finalTcp`, `monthlyPayment`, `depositPercent`) on the meeting. Always derive.
- **Joining `meetingParticipants` directly into a meetings list query without `getOwnerCoOwnerForMeetings`.** The raw join cross-products when duplicates exist; the batch helper deduplicates safely.
- **Re-snapshotting trade selections from meeting on proposal update.** Snapshot is at create only.
- **Trusting `meetings.ownerId` as the salesperson for visibility purposes.** Use participant `owner` role.

## See also

- `../customers/DOCS.md#visibility-via-meeting-participation` — meeting participation is the visibility bridge
- `../proposals/DOCS.md#conversion-trigger` — proposal approval sets meeting outcome
- `../proposals/DOCS.md#sow-snapshot-from-meeting-on-create` — proposal-side of trade-selections snapshot
- `../projects/DOCS.md` (when written) — projectId link semantics
- `memory/project-gcal-sync-architecture.md` — GCal sync architecture (planned)
- `docs/codebase-conventions/dal-conventions.md` — DAL conventions
