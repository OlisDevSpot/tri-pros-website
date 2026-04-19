# Meeting Participants & Google Calendar Sync Redesign

**Date:** 2026-04-17
**Status:** Draft
**Scope:** Meeting participant model, GCal sync engine, permission/visibility queries

## Problem

1. **No participant model:** Meetings have a single `ownerId` column. No concept of co-owners, helpers, or collaboration between agents.
2. **Reassignment is invisible to GCal:** The `assignOwner` mutation updates `ownerId` in the database but does nothing in Google Calendar. The event stays on the old owner's calendar and never appears on the new owner's.
3. **Per-user calendars don't scale:** Each user gets their own "Tri Pros Schedule" calendar. Events are siloed — no shared visibility, no attendee management, no cross-calendar coordination.
4. **Silent sync failures:** GCal push errors are swallowed with `.catch(() => {})`, making it impossible to diagnose sync issues.

## Solution Overview

- Add a `meeting_participants` junction table that tracks all agents assigned to a meeting with roles (`owner`, `co_owner`, `helper`)
- Keep `meetings.ownerId` as a denormalized fast-path for the primary owner, always in sync with the `owner` row in `meeting_participants`
- Centralize GCal events on the `info@triprosremodeling.com` super-admin account's calendar
- Use Google Calendar's native attendee system to invite participants by email
- Add color coding, title prefixes, and dashboard deep links to GCal events

---

## 1. Schema

### New pgEnum: `meeting_participant_role`

Location: `src/shared/db/schema/meta.ts`

Values: `owner`, `co_owner`, `helper`

### New table: `meeting_participants`

Location: `src/shared/db/schema/meeting-participants.ts`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, defaultRandom |
| `meetingId` | uuid | FK → meetings.id, NOT NULL, onDelete CASCADE |
| `userId` | text | FK → user.id, NOT NULL, onDelete CASCADE |
| `role` | meeting_participant_role | NOT NULL |
| `createdAt` | timestamp | defaultNow |
| `updatedAt` | timestamp | defaultNow |

**Constraints:**
- `UNIQUE(meetingId, userId)` — one assignment per user per meeting

**Relations:**
- `meeting`: one → meetings
- `user`: one → user

### Existing table changes: `meetings`

**No schema changes.** `ownerId` stays as-is:
- `NOT NULL`, FK → user.id, onDelete CASCADE
- Denormalized mirror of the `owner` role in `meeting_participants`
- Defaults to `info@triprosremodeling.com` user ID (semantically "unassigned")
- Updated via application logic whenever the owner assignment changes

### Resolving the `info@` super-admin user ID

The `info@triprosremodeling.com` user ID is resolved at runtime by querying `user.email`. Existing precedent at `src/trpc/routers/customers.router.ts:226`. A shared constant/helper should be created:

Location: `src/shared/constants/system-users.ts`
```typescript
export const SYSTEM_OWNER_EMAIL = 'info@triprosremodeling.com'
```

A DAL helper to resolve the ID:
Location: `src/shared/dal/server/users/system.ts`
```typescript
export async function getSystemOwnerId(): Promise<string>
```

Cached per-request to avoid repeated lookups.

### Activities: No changes

Activities keep their simple `ownerId` column. Activities are personal (tasks, reminders, events). The participant model applies to meetings only in v1.

### Application-level constraints

- Max 1 `owner` per meeting (enforced in mutation logic)
- Max 1 `co_owner` per meeting (enforced in mutation logic, v1 constraint)
- No limit on `helper` count
- `meetings.ownerId` must always match the `owner` row in `meeting_participants`

---

## 2. GCal Sync Engine Redesign

### Architecture shift

**Before:** Each user has their own "Tri Pros Schedule" calendar. Events are created on the meeting owner's calendar. No attendee management.

**After:** The `info@triprosremodeling.com` super-admin account owns a single "Tri Pros Schedule" calendar. All meeting events live on that calendar. Participants are added as Google Calendar attendees by email.

### Why attendees, not separate events

- Edits to time/location propagate to all participants automatically
- Cancellations notify everyone via Google
- No N-way sync to keep in parity
- Fewer API calls, fewer failure points
- Agents see the meeting on their primary Google Calendar via the invite — native experience

### Sync lifecycle

| Action | GCal Effect |
|--------|------------|
| Meeting created (owned by `info@`, unassigned) | Event created on `info@`'s calendar, no attendees |
| Owner assigned (Agent A) | Agent A's email added as attendee |
| Co-owner assigned (Agent B) | Agent B's email added as attendee |
| Helper added (Agent C) | Agent C's email added as attendee |
| Owner reassigned (A → D) | Agent A removed from attendees, Agent D added |
| Co-owner removed | Their email removed from attendees |
| `scheduledFor` changed | Event time updated, all attendees auto-notified by Google |
| Meeting deleted | Event deleted, all attendees auto-notified by Google |

### Attendee list derivation

On every GCal push for a meeting, the attendee list is derived fresh:

```
SELECT u.email FROM meeting_participants mp
JOIN user u ON u.id = mp.user_id
WHERE mp.meeting_id = :meetingId
AND mp.role IN ('owner', 'co_owner', 'helper')
```

The full attendee array is sent with the event update. Google Calendar handles the diff internally (who to add, who to remove, who to notify).

### `pushToGCal` changes

- The `userId` parameter for meeting pushes is always the `info@` super-admin's ID (the calendar organizer)
- The function queries `meeting_participants` + `user.email` to build the attendee array
- Attendees are included in the `GCalEventInput` payload

### Inbound sync

- Only the `info@` account's calendar is synced inbound
- Agent calendars are read-only recipients via Google's invite system
- No change to the inbound sync flow — it continues to process events from the organizer's calendar

### Per-agent calendars for activities

Agents' personal "Tri Pros Schedule" calendars continue to exist for activities (tasks, reminders, events). Only **meeting events** move to the centralized `info@` calendar. Activity sync remains per-user as-is.

---

## 3. Event Visual Identity

All events on the single "Tri Pros Schedule" calendar use color coding and title prefixes for visual distinction.

### Color mapping

| Entity Type | `colorId` | Color Name | Title Format |
|-------------|-----------|------------|-------------|
| Meeting (Fresh) | `9` | Blueberry | `Meeting: {customerName}` |
| Meeting (Rehash) | `3` | Grape | `Rehash: {customerName}` |
| Meeting (Project) | `10` | Basil | `Project: {projectTitle or customerName}` |
| Activity (event) | `5` | Banana | `[event] {title}` |
| Activity (reminder) | `6` | Tangerine | `[reminder] {title}` |
| Activity (task) | `2` | Sage | `[task] {title}` |

### Color constant location

`src/shared/constants/gcal-colors.ts` — mapping from entity type/meeting type to Google Calendar `colorId`.

Referenced by `map-to-gcal.ts` when building event payloads.

### Dashboard deep link

Every meeting event description includes a link back to the dashboard:

```
🔗 View in Dashboard: {NEXT_PUBLIC_BASE_URL}/dashboard/meetings/{meetingId}
```

Added to `buildMeetingDescription()` in `src/shared/services/google-calendar/lib/map-to-gcal.ts`, using the existing `roots.dashboard.meetings.byId()` helper from `src/shared/config/roots.ts`.

---

## 4. Permissions & Visibility

### Current model

Queries filter by `eq(meetings.ownerId, userId)` for agents. Super-admins (`isOmni`) bypass all filters.

### New model

An agent can see/interact with a meeting if they are **any participant** (owner, co_owner, or helper). Super-admins still see everything.

### Query pattern change

```typescript
// Before
isOmni ? undefined : eq(meetings.ownerId, userId)

// After
isOmni ? undefined : exists(
  db.select().from(meetingParticipants)
    .where(and(
      eq(meetingParticipants.meetingId, meetings.id),
      eq(meetingParticipants.userId, userId),
    ))
)
```

### Shared helper

A `userParticipatesInMeeting(userId, meetingIdColumn)` helper in the DAL returns the `exists()` clause. All queries use this instead of duplicating the subquery.

Location: `src/shared/dal/server/meetings/participants.ts`

### Role-based permissions

| Role | View meeting | Update meeting/customer | Delete meeting | Assign participants |
|------|-------------|------------------------|----------------|-------------------|
| `owner` | Yes | Yes | No | No |
| `co_owner` | Yes | Yes | No | No |
| `helper` | Yes | No | No | No |
| Super-admin | Yes | Yes | Yes | Yes |

### CASL integration

Existing CASL abilities stay untouched. `can('manage', 'all')` for super-admins continues to work. The participant check is at the query/DAL layer (which records are visible), not the CASL layer (which actions are allowed).

### Affected files (~15 references across ~9 source files)

- `src/trpc/routers/meetings.router.ts` — getAll, getById, duplicate, delete
- `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` — pipeline queries
- `src/features/customer-pipelines/dal/server/get-customer-profile.ts` — profile query
- `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts` — move query
- `src/features/agent-dashboard/dal/server/get-action-queue.ts` — action queue
- `src/trpc/routers/schedule.router/sync.router.ts` — sync queries
- `src/shared/dal/server/meetings/google-calendar.ts` — GCal sync queries

---

## 5. Mutations / API Layer

### New: `meetings.manageParticipants`

Super-admin only. Single mutation for all participant operations.

```typescript
input: {
  meetingId: z.string().uuid(),
  action: z.enum(['add', 'remove', 'change_role']),
  userId: z.string(),
  role: z.enum(['owner', 'co_owner', 'helper']).optional(),  // required for 'add' and 'change_role'
}
```

**`add` logic:**
- Validate max 1 owner, max 1 co_owner
- If adding as `owner` and one exists → reject (use `change_role` to swap)
- Insert into `meeting_participants`
- If role is `owner` → update `meetings.ownerId`
- Push to GCal (rebuild attendee list)

**`remove` logic:**
- Cannot remove if it leaves the meeting with no owner → set `meetings.ownerId` back to `info@` super-admin, insert participant row for `info@` with `owner` role
- Delete from `meeting_participants`
- If removed user was `owner` → reset `meetings.ownerId` to `info@`
- Push to GCal (rebuild attendee list, removed user gets disinvited)

**`change_role` logic:**
- If changing to `owner` → current owner auto-demoted to `co_owner` (swap)
- If changing to `co_owner` and one exists → reject
- Update role in `meeting_participants`
- If owner changed → update `meetings.ownerId`
- Push to GCal (attendee list unchanged, roles are app-level)

### Removed: `meetings.assignOwner`

Replaced entirely by `meetings.manageParticipants`. All UI call sites updated.

### Modified: `meetings.create`

After inserting the meeting, also insert a `meeting_participants` row:
```
{ meetingId: created.id, userId: info@superAdminId, role: 'owner' }
```

### Modified: `meetings.delete`

No code changes needed — `onDelete: CASCADE` on `meeting_participants.meetingId` handles cleanup.

---

## 6. Migration Strategy

### Step 1: Schema migration

1. Create `meeting_participant_role` pgEnum
2. Create `meeting_participants` table with unique constraint
3. No changes to `meetings` table

### Step 2: Data migration

For every existing meeting row:
```sql
INSERT INTO meeting_participants (id, meeting_id, user_id, role)
SELECT gen_random_uuid(), id, owner_id, 'owner'
FROM meetings
ON CONFLICT DO NOTHING;
```

This ensures the junction table is immediately in sync with existing `ownerId` values.

### Step 3: Code migration (incremental)

1. Add schema, enum, table, relations
2. Add `manageParticipants` mutation
3. Update `meetings.create` to insert participant row
4. Add `userParticipatesInMeeting` helper
5. Migrate visibility queries from `ownerId` check to participant `exists()` check
6. Update GCal sync engine (centralize on `info@` calendar, add attendee management)
7. Update `map-to-gcal.ts` with color coding, prefixes, deep links
8. Remove `assignOwner` mutation, update UI call sites

### Step 4: Dead code cleanup

- Remove per-agent "Tri Pros Schedule" calendar creation for meetings (keep for activities)
- Remove stale `assignOwner` mutation and any references
- Audit all `meetings.ownerId` direct-equality checks — ensure each uses the participant helper or is a deliberate denormalized read
- Remove orphaned GCal helper functions that assumed per-user calendars for meetings

---

## 7. What This Design Does NOT Cover

- **Activity participants** — Activities stay single-owner. If collaboration needs emerge, apply the same junction table pattern.
- **Project participants** — Projects will get their own participant model (`project_participants` or `project_helpers`) in a separate spec. Different roles (project manager, QA, trade specialist).
- **Multiple calendars** — Deferred. Single "Tri Pros Schedule" calendar with color coding for now. Multiple calendars (e.g., "Tri Pros Meetings" vs "Tri Pros Activities") can be added later.
- **Notification preferences** — Google Calendar handles attendee notifications natively. Custom in-app notifications for participant changes are out of scope.
- **Agent self-service** — Agents cannot add/remove themselves from meetings. Only super-admins manage participants.

---

## 8. Verification Plan

1. **Schema:** Run `pnpm db:push:dev`, verify `meeting_participants` table and enum exist
2. **Data migration:** Verify every meeting has a corresponding participant row with `owner` role
3. **Create meeting:** New meeting → participant row created → GCal event on `info@` calendar with no attendees
4. **Add owner:** `manageParticipants(add, agentA, owner)` → `ownerId` updated → Agent A invited on GCal
5. **Add co-owner:** `manageParticipants(add, agentB, co_owner)` → Agent B invited on GCal
6. **Swap roles:** `manageParticipants(change_role, agentB, owner)` → Agent A demoted to co_owner, Agent B promoted, `ownerId` updated
7. **Remove participant:** `manageParticipants(remove, agentA)` → Agent A disinvited from GCal
8. **Visibility:** Agent A can only see meetings they participate in. Super-admin sees all.
9. **Permissions:** Agent cannot delete meeting. Agent can update meetings they own/co-own. Helper is read-only.
10. **Color coding:** Fresh meetings show blueberry, rehash shows grape, project shows basil
11. **Deep link:** GCal event description contains clickable dashboard URL
12. **Dead code:** No references to per-user meeting calendar creation remain
13. **Lint + typecheck:** `pnpm lint` and `pnpm tsc` pass clean
