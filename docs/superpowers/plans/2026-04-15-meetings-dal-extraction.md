# Meetings DAL Extraction Plan

## Context

After extracting GCal-specific operations to `shared/dal/server/meetings/google-calendar.ts`, we audited every remaining direct `meetings` table interaction across the codebase. There are **6 source files** (excluding docs, our new GCal DAL, and feature DALs) that directly import and query/mutate the `meetings` schema:

1. `src/trpc/routers/meetings.router.ts` — 10 procedures, 15+ raw queries
2. `src/trpc/routers/customers.router.ts` — 1 procedure (`createFromIntake`)
3. `src/trpc/routers/proposals.router/crud.router.ts` — 1 procedure (`createProposal`)
4. `src/trpc/routers/projects.router/business.router.ts` — 1 procedure (`create`)
5. `src/trpc/routers/schedule.router/sync.router.ts` — 1 procedure (`triggerSync`)
6. `src/shared/dal/server/proposals/api.ts` — 2 functions (`getProposal`, `getProposals`)

Additionally, 4 feature DALs in `customer-pipelines/` and `agent-dashboard/` use meetings in JOINs, but these are properly scoped per convention.

## Key Finding: Business Rule Inconsistency

The `OUTCOME_PIPELINE_MAP` (in `shared/domains/pipelines/lib/outcome-pipeline-map.ts`) auto-assigns a `pipeline` value when `meetingOutcome` changes. Currently this logic is applied in **only one place**:

- `meetings.router.ts` → `update` procedure (lines 95-105) — applies the map

But `meetingOutcome` is SET in **four places** that do NOT apply the map:

| Location | Sets `meetingOutcome` to | Applies pipeline map? |
|---|---|---|
| `meetings.router.ts` → `linkProposal` | `'proposal_created'` | **NO** |
| `meetings.router.ts` → `assignToProject` | `'converted_to_project'` | **NO** |
| `projects.router/business.router.ts` → `create` | `'converted_to_project'` | **NO** |
| `customer-pipelines/.../move-customer-pipeline-item.ts` | `'not_set'` or `'follow_up_needed'` | **NO** |

Today this doesn't cause visible bugs because `OUTCOME_PIPELINE_MAP` returns `null` for `proposal_created`, `converted_to_project`, `not_set`, and `follow_up_needed` — meaning "don't change pipeline." But if someone later adds a pipeline mapping for any of these outcomes, 4 out of 5 callers will silently ignore it.

## Strategy: Extract Only Cross-Consumer Operations

**Not everything needs extraction.** Convention Rule 19 says "Jobs/services must use DAL, never direct DB calls." Routers are the glue layer — they CAN do direct queries. The reason to extract is **duplication and consistency**, not compliance.

### What to extract (used by 2+ consumers OR enforces a business rule)

| DAL Function | Why | Consumers |
|---|---|---|
| `createMeeting(data, tx?)` | 2 consumers, transaction support needed | meetings.router `create`, customers.router `createFromIntake` |
| `updateMeeting(meetingId, fields, ownerFilter?)` | Core CRUD, returns full row | meetings.router `update` |
| `updateMeetingOutcome(meetingId, outcome)` | **Enforces pipeline auto-assignment.** Eliminates 4-way inconsistency | meetings.router `update`, `linkProposal`, `assignToProject`; projects.router `create`; move-customer-pipeline-item |
| `linkMeetingToProject(meetingId, projectId)` | Duplicate mutation in 2 routers (exact same `.set()`) | meetings.router `assignToProject`, projects.router `create` |
| `getMeetingFlowState(meetingId)` | Cross-router read | proposals.router `createProposal` |
| `getUnsyncedMeetings(userId)` | Cross-router read | schedule.router `triggerSync` |
| `deleteMeeting(meetingId, ownerFilter?)` | Simple CRUD, easy win | meetings.router `delete` |

### What to leave in the router (single consumer, complex shapes)

| Operation | Why leave it | Location |
|---|---|---|
| `getAll` (meetings list) | Complex shape with subqueries, only used by meetings.router | meetings.router |
| `getById` (meeting detail) | Complex shape with JOINs + subqueries, only used by meetings.router | meetings.router |
| `duplicate` | Single consumer, simple logic | meetings.router |
| `assignOwner` | Single consumer, simple update | meetings.router |
| `getPersonaProfile` query | Single consumer, very specific JOIN for persona builder | meetings.router |
| `getCustomerProjects` query | Single consumer, gets customerId then queries projects | meetings.router |
| `getInternalUsers` | Not a meetings query at all (queries `user` table) | meetings.router |

### What stays in proposals DAL

`getProposal` and `getProposals` in `proposals/api.ts` use meetings as a **bridge table** to reach customers. These are proposals-domain operations that happen to JOIN through meetings. They should keep importing the `meetings` schema directly — this is not a "meetings operation."

## Implementation Plan

### Step 1: Create `src/shared/dal/server/meetings/api.ts`

```typescript
// Types
import type { DB } from '@/shared/db'
type Meeting = typeof meetings.$inferSelect
type InsertMeeting = typeof meetings.$inferInsert

// ── Queries ──────────────────────────────────────────────────────────

// getMeetingFlowState(meetingId) → { flowStateJSON } | undefined
// Used by: proposals.router/crud.router.ts → createProposal
// Reads only flowStateJSON from a meeting (for trade selection snapshot)

// getUnsyncedMeetings(userId) → { id }[]
// Used by: schedule.router/sync.router.ts → triggerSync
// Meetings with scheduledFor but no gcalEventId (need initial GCal push)

// ── Mutations ────────────────────────────────────────────────────────

// createMeeting(data, tx?) → Meeting
// Used by: meetings.router → create, customers.router → createFromIntake
// Accepts optional transaction parameter for use inside db.transaction()
// The tx parameter type: DB (Drizzle's db and tx share the query interface)

// updateMeeting(meetingId, fields, ownerFilter?) → Meeting | undefined
// Used by: meetings.router → update
// Generic partial update, returns full row. Does NOT handle side effects
// (GCal push, realtime publish, outcome→pipeline) — those stay in router

// updateMeetingOutcome(meetingId, outcome) → void
// Used by: meetings.router (update, linkProposal, assignToProject),
//          projects.router (create), move-customer-pipeline-item
// KEY: Applies OUTCOME_PIPELINE_MAP automatically.
//      If map returns non-null, also sets `pipeline`.
//      This is the ONLY way to change meetingOutcome going forward.

// linkMeetingToProject(meetingId, projectId) → void
// Used by: meetings.router → assignToProject, projects.router → create
// Sets projectId AND calls updateMeetingOutcome('converted_to_project')
// Eliminates the duplicate .set({ projectId, meetingOutcome }) pattern

// deleteMeeting(meetingId, ownerFilter?) → void
// Used by: meetings.router → delete
```

### Step 2: Wire up consumers

**`meetings.router.ts`** — Replace direct DB calls in:
- `create` → `createMeeting(data)`
- `update` → `updateMeeting(id, fields)` + `updateMeetingOutcome(id, outcome)` (replaces inline pipeline logic)
- `linkProposal` → `updateMeetingOutcome(meetingId, 'proposal_created')` (replaces raw `.set()`)
- `assignToProject` → `linkMeetingToProject(meetingId, projectId)` (replaces raw `.set()`)
- `delete` → `deleteMeeting(id, ownerFilter)`
- Leave `getAll`, `getById`, `duplicate`, `assignOwner`, `getPersonaProfile`, `getCustomerProjects`, `getInternalUsers` as-is (single-consumer, complex shapes)

**`customers.router.ts`** — Replace `createFromIntake`'s meeting insert:
- `createMeeting({ ownerId, customerId, meetingType: 'Fresh', scheduledFor }, tx)` inside the transaction

**`proposals.router/crud.router.ts`** — Replace `createProposal`'s flowState read:
- `getMeetingFlowState(rawInput.meetingId)` instead of raw `db.select({ flowStateJSON }).from(meetings)`

**`projects.router/business.router.ts`** — Replace project creation's meeting link:
- `linkMeetingToProject(input.meetingId, project.id)` instead of raw `.update(meetings).set({ projectId, meetingOutcome })`

**`schedule.router/sync.router.ts`** — Replace unsynced meetings query:
- `getUnsyncedMeetings(userId)` instead of raw `db.select().from(meetings).where(...)`
- Also needs unsynced activities query → already covered by `getActivityById` or could add `getUnsyncedActivities` to activities DAL

**`customer-pipelines/.../move-customer-pipeline-item.ts`** — Replace outcome update:
- `updateMeetingOutcome(meetingId, targetOutcome)` instead of raw `.update(meetings).set({ meetingOutcome })`

### Step 3: Add `getUnsyncedActivities` to activities DAL

The `schedule.router/sync.router.ts` → `triggerSync` also queries unsynced activities directly. Add to `shared/dal/server/activities/google-calendar.ts`:

```typescript
// getUnsyncedActivities(userId) → { id }[]
// Activities with scheduledFor, no gcalEventId, and syncable type
```

### Step 4: Verify

```bash
# After refactoring, these direct schema imports should be removed from routers:
# - meetings.router.ts: keep only for getAll/getById/duplicate/assignOwner/getPersonaProfile/getCustomerProjects
# - customers.router.ts: remove meetings import entirely
# - proposals.router/crud.router.ts: remove meetings import entirely
# - projects.router/business.router.ts: remove meetings import entirely
# - schedule.router/sync.router.ts: remove meetings AND activities imports entirely

pnpm tsc --noEmit  # No new type errors
pnpm lint           # No new lint errors
```

## Files to create/modify

| Action | File | What changes |
|---|---|---|
| **Create** | `src/shared/dal/server/meetings/api.ts` | New DAL with 6 functions |
| **Modify** | `src/trpc/routers/meetings.router.ts` | Use DAL for create, update outcome, link-to-project, delete |
| **Modify** | `src/trpc/routers/customers.router.ts` | Use `createMeeting(data, tx)` in createFromIntake |
| **Modify** | `src/trpc/routers/proposals.router/crud.router.ts` | Use `getMeetingFlowState` |
| **Modify** | `src/trpc/routers/projects.router/business.router.ts` | Use `linkMeetingToProject` |
| **Modify** | `src/trpc/routers/schedule.router/sync.router.ts` | Use `getUnsyncedMeetings` + `getUnsyncedActivities` |
| **Modify** | `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts` | Use `updateMeetingOutcome` |
| **Modify** | `src/shared/dal/server/activities/google-calendar.ts` | Add `getUnsyncedActivities` |

## Important notes

- **`updateMeetingOutcome` is the key function.** It centralizes the outcome→pipeline business rule. After this refactor, no code should ever do `.set({ meetingOutcome: ... })` directly — always go through this DAL function.
- **Transaction support**: `createMeeting` accepts an optional `tx` parameter (typed as `DB`) for use inside `db.transaction()`. Drizzle's transaction object is API-compatible with the top-level `db` for basic operations.
- **No behavior changes** except: `linkProposal`, `assignToProject`, `projects.router create`, and `move-customer-pipeline-item` will now apply `OUTCOME_PIPELINE_MAP` when changing outcome. Today this is a no-op for those outcomes (map returns `null`), so there is no visible behavior change — but it future-proofs the pipeline assignment.
- **Side effects stay in routers.** GCal push, Ably realtime publish, and other side effects remain in the router layer. The DAL is pure data access.
- **`meetings.router.ts` will still import the meetings schema** for `getAll`, `getById`, `duplicate`, `assignOwner`, `getPersonaProfile`, and `getCustomerProjects`. These are single-consumer queries with complex shapes. They can be extracted later if they gain a second consumer.
- **`proposals/api.ts` is unchanged.** Its meetings JOIN is a bridge-table pattern, not a meetings operation.
