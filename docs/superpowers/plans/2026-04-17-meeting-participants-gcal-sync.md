# Meeting Participants & Google Calendar Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single-owner meeting model with a multi-participant system (`meeting_participants` junction table) and centralize Google Calendar sync on the `info@triprosremodeling.com` account with attendee-based invites.

**Architecture:** New `meeting_participants` table tracks all agents assigned to a meeting with roles (`owner`, `co_owner`, `helper`). The existing `meetings.ownerId` column stays as a denormalized fast-path for the primary owner. GCal events live on the `info@` account's calendar; participants are added as attendees by email. Color coding and dashboard deep links enrich event metadata.

**Tech Stack:** Drizzle ORM (Postgres), tRPC, Google Calendar REST API, CASL (query-layer permissions)

**Spec:** `docs/superpowers/specs/2026-04-17-meeting-participants-gcal-sync-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/shared/db/schema/meeting-participants.ts` | Junction table schema, relations, Zod schemas |
| `src/shared/constants/enums/meeting-participants.ts` | `meetingParticipantRoles` const array |
| `src/shared/types/enums/meeting-participants.ts` | `MeetingParticipantRole` type |
| `src/shared/constants/gcal-colors.ts` | GCal colorId mapping by entity type |
| `src/shared/constants/system-users.ts` | `SYSTEM_OWNER_EMAIL` constant |
| `src/shared/dal/server/meetings/participants.ts` | Participant DAL: queries, mutations, `userParticipatesInMeeting` helper |
| `src/shared/dal/server/users/system.ts` | `getSystemOwnerId()` cached helper |

### Modified Files
| File | Change |
|------|--------|
| `src/shared/db/schema/meta.ts` | Add `meetingParticipantRoleEnum` pgEnum |
| `src/shared/db/schema/index.ts` | Export `meeting-participants` schema |
| `src/shared/constants/enums/index.ts` | Re-export meeting participant enums |
| `src/shared/types/enums/index.ts` | Re-export meeting participant types |
| `src/shared/services/google-calendar/types.ts` | Add `attendees` and `colorId` to `GCalEventInput` |
| `src/shared/services/google-calendar/lib/map-to-gcal.ts` | Add color coding, attendees, dashboard deep links |
| `src/shared/services/scheduling.service.ts` | Centralize on `info@` calendar, add attendee management |
| `src/trpc/routers/meetings.router.ts` | Add `manageParticipants`, remove `assignOwner`, update create/visibility |
| `src/trpc/routers/schedule.router/sync.router.ts` | Update sync queries for participant model |
| `src/shared/dal/server/meetings/google-calendar.ts` | Update queries for participant model |
| `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` | Replace `ownerId` filters with participant exists |
| `src/features/customer-pipelines/dal/server/get-customer-profile.ts` | Update selected columns |
| `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts` | Replace `ownerId` filter |
| `src/features/agent-dashboard/dal/server/get-action-queue.ts` | Replace `ownerId` filter |
| `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx` | Update assign action to use `manageParticipants` |
| `src/shared/entities/meetings/components/assign-rep-dialog.tsx` | Update to call `manageParticipants` instead of `assignOwner` |

---

## Task 1: Enum & Constant Setup

**Files:**
- Create: `src/shared/constants/enums/meeting-participants.ts`
- Create: `src/shared/types/enums/meeting-participants.ts`
- Create: `src/shared/constants/system-users.ts`
- Create: `src/shared/constants/gcal-colors.ts`
- Modify: `src/shared/constants/enums/index.ts`
- Modify: `src/shared/types/enums/index.ts`

- [ ] **Step 1: Create meeting participant role const array**

```typescript
// src/shared/constants/enums/meeting-participants.ts
export const meetingParticipantRoles = ['owner', 'co_owner', 'helper'] as const
```

- [ ] **Step 2: Create meeting participant role type**

```typescript
// src/shared/types/enums/meeting-participants.ts
import type { meetingParticipantRoles } from '@/shared/constants/enums/meeting-participants'

export type MeetingParticipantRole = (typeof meetingParticipantRoles)[number]
```

- [ ] **Step 3: Create system user constant**

```typescript
// src/shared/constants/system-users.ts
export const SYSTEM_OWNER_EMAIL = 'info@triprosremodeling.com'
```

- [ ] **Step 4: Create GCal color mapping**

```typescript
// src/shared/constants/gcal-colors.ts

/** Google Calendar colorId mapping. See: https://developers.google.com/calendar/api/v3/reference/colors */
export const GCAL_MEETING_COLORS = {
  Fresh: '9',       // Blueberry
  Rehash: '3',      // Grape
  Project: '10',    // Basil
} as const

export const GCAL_ACTIVITY_COLORS = {
  event: '5',       // Banana
  reminder: '6',    // Tangerine
  task: '2',        // Sage
} as const
```

- [ ] **Step 5: Re-export from barrel files**

Add to `src/shared/constants/enums/index.ts`:
```typescript
export * from './meeting-participants'
```

Add to `src/shared/types/enums/index.ts`:
```typescript
export * from './meeting-participants'
```

- [ ] **Step 6: Commit**

```bash
git add src/shared/constants/enums/meeting-participants.ts src/shared/types/enums/meeting-participants.ts src/shared/constants/system-users.ts src/shared/constants/gcal-colors.ts src/shared/constants/enums/index.ts src/shared/types/enums/index.ts
git commit -m "feat(schema): add meeting participant role enums, system user constant, and gcal color mapping"
```

---

## Task 2: Database Schema — `meeting_participants` Table

**Files:**
- Create: `src/shared/db/schema/meeting-participants.ts`
- Modify: `src/shared/db/schema/meta.ts`
- Modify: `src/shared/db/schema/index.ts`

- [ ] **Step 1: Add pgEnum to meta.ts**

Add to `src/shared/db/schema/meta.ts` (with the other enum imports and definitions):

```typescript
// At the top, add to imports:
import { meetingParticipantRoles } from '@/shared/constants/enums'

// With the other pgEnum definitions:
export const meetingParticipantRoleEnum = pgEnum('meeting_participant_role', meetingParticipantRoles)
```

- [ ] **Step 2: Create the meeting_participants schema file**

```typescript
// src/shared/db/schema/meeting-participants.ts
import type z from 'zod'

import { relations } from 'drizzle-orm'
import { pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { meetings } from './meetings'
import { meetingParticipantRoleEnum } from './meta'

export const meetingParticipants = pgTable('meeting_participants', {
  id,
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: meetingParticipantRoleEnum().notNull(),
  createdAt,
  updatedAt,
}, table => [
  unique('meeting_id_user_id_unique').on(table.meetingId, table.userId),
])

export const meetingParticipantRelations = relations(meetingParticipants, ({ one }) => ({
  meeting: one(meetings, {
    fields: [meetingParticipants.meetingId],
    references: [meetings.id],
  }),
  user: one(user, {
    fields: [meetingParticipants.userId],
    references: [user.id],
  }),
}))

export const selectMeetingParticipantSchema = createSelectSchema(meetingParticipants)
export type MeetingParticipant = z.infer<typeof selectMeetingParticipantSchema>

export const insertMeetingParticipantSchema = createInsertSchema(meetingParticipants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertMeetingParticipant = z.infer<typeof insertMeetingParticipantSchema>
```

- [ ] **Step 3: Export from schema barrel**

Add to `src/shared/db/schema/index.ts`:
```typescript
export * from './meeting-participants'
```

- [ ] **Step 4: Push schema to dev database**

```bash
pnpm db:push:dev
```

Expected: Table `meeting_participants` created with columns `id`, `meeting_id`, `user_id`, `role`, `created_at`, `updated_at` and unique constraint.

- [ ] **Step 5: Verify with typecheck**

```bash
pnpm tsc
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/db/schema/meeting-participants.ts src/shared/db/schema/meta.ts src/shared/db/schema/index.ts
git commit -m "feat(schema): add meeting_participants junction table with role enum"
```

---

## Task 3: Data Migration — Backfill Existing Meetings

**Files:**
- None created — this is a one-time migration script run via `psql` or Drizzle

- [ ] **Step 1: Write and run the backfill migration**

Run this SQL against the dev database (via `psql` or Drizzle Studio):

```sql
INSERT INTO meeting_participants (id, meeting_id, user_id, role, created_at, updated_at)
SELECT
  gen_random_uuid(),
  m.id,
  m.owner_id,
  'owner',
  NOW(),
  NOW()
FROM meetings m
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Verify the migration**

```sql
-- Count should match
SELECT COUNT(*) FROM meetings;
SELECT COUNT(*) FROM meeting_participants WHERE role = 'owner';

-- No meetings without a participant
SELECT m.id FROM meetings m
LEFT JOIN meeting_participants mp ON mp.meeting_id = m.id
WHERE mp.id IS NULL;
```

Expected: Both counts match. Third query returns 0 rows.

- [ ] **Step 3: Commit any migration file if created**

```bash
git commit -m "chore(db): backfill meeting_participants from existing ownerId data"
```

---

## Task 4: System User DAL & Participant DAL

**Files:**
- Create: `src/shared/dal/server/users/system.ts`
- Create: `src/shared/dal/server/meetings/participants.ts`

- [ ] **Step 1: Create the system user ID resolver**

```typescript
// src/shared/dal/server/users/system.ts
import { eq } from 'drizzle-orm'

import { db } from '@/shared/db'
import { user } from '@/shared/db/schema'
import { SYSTEM_OWNER_EMAIL } from '@/shared/constants/system-users'

let cachedSystemOwnerId: string | null = null

export async function getSystemOwnerId(): Promise<string> {
  if (cachedSystemOwnerId) {
    return cachedSystemOwnerId
  }

  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, SYSTEM_OWNER_EMAIL))
    .limit(1)

  if (!row) {
    throw new Error(`System owner user not found: ${SYSTEM_OWNER_EMAIL}`)
  }

  cachedSystemOwnerId = row.id
  return row.id
}
```

- [ ] **Step 2: Create the participant DAL**

```typescript
// src/shared/dal/server/meetings/participants.ts
import type { SQL } from 'drizzle-orm'

import { and, eq, exists } from 'drizzle-orm'

import { db } from '@/shared/db'
import { meetingParticipants, user } from '@/shared/db/schema'

import type { MeetingParticipantRole } from '@/shared/types/enums'

// ── Visibility Helper ───────────────────────────────────────────────────────

/**
 * Returns an `exists()` SQL clause that checks if a user participates in a meeting.
 * Use in WHERE clauses to replace `eq(meetings.ownerId, userId)`.
 *
 * @param userId - The user ID to check participation for
 * @param meetingIdColumn - The column reference to meetings.id (from the outer query)
 */
export function userParticipatesInMeeting(userId: string, meetingIdColumn: SQL | ReturnType<typeof eq> | any): SQL {
  return exists(
    db.select({ id: meetingParticipants.id })
      .from(meetingParticipants)
      .where(and(
        eq(meetingParticipants.meetingId, meetingIdColumn),
        eq(meetingParticipants.userId, userId),
      )),
  )
}

// ── Queries ─────────────────────────────────────────────────────────────────

export async function getParticipantsForMeeting(meetingId: string) {
  return db
    .select({
      id: meetingParticipants.id,
      userId: meetingParticipants.userId,
      role: meetingParticipants.role,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
    })
    .from(meetingParticipants)
    .innerJoin(user, eq(user.id, meetingParticipants.userId))
    .where(eq(meetingParticipants.meetingId, meetingId))
}

export async function getParticipantEmails(meetingId: string): Promise<string[]> {
  const rows = await db
    .select({ email: user.email })
    .from(meetingParticipants)
    .innerJoin(user, eq(user.id, meetingParticipants.userId))
    .where(eq(meetingParticipants.meetingId, meetingId))

  return rows.map(r => r.email).filter((e): e is string => e !== null)
}

export async function getParticipantByRole(meetingId: string, role: MeetingParticipantRole) {
  return db.query.meetingParticipants.findFirst({
    where: and(
      eq(meetingParticipants.meetingId, meetingId),
      eq(meetingParticipants.role, role),
    ),
  })
}

export async function countParticipantsByRole(meetingId: string, role: MeetingParticipantRole): Promise<number> {
  const rows = await db
    .select({ id: meetingParticipants.id })
    .from(meetingParticipants)
    .where(and(
      eq(meetingParticipants.meetingId, meetingId),
      eq(meetingParticipants.role, role),
    ))

  return rows.length
}

// ── Mutations ───────────────────────────────────────────────────────────────

export async function addParticipant(
  meetingId: string,
  userId: string,
  role: MeetingParticipantRole,
): Promise<void> {
  await db.insert(meetingParticipants).values({ meetingId, userId, role })
}

export async function removeParticipant(meetingId: string, userId: string): Promise<void> {
  await db.delete(meetingParticipants).where(
    and(
      eq(meetingParticipants.meetingId, meetingId),
      eq(meetingParticipants.userId, userId),
    ),
  )
}

export async function updateParticipantRole(
  meetingId: string,
  userId: string,
  newRole: MeetingParticipantRole,
): Promise<void> {
  await db.update(meetingParticipants)
    .set({ role: newRole })
    .where(and(
      eq(meetingParticipants.meetingId, meetingId),
      eq(meetingParticipants.userId, userId),
    ))
}
```

- [ ] **Step 3: Verify with typecheck**

```bash
pnpm tsc
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/shared/dal/server/users/system.ts src/shared/dal/server/meetings/participants.ts
git commit -m "feat(dal): add participant DAL with visibility helper and system user resolver"
```

---

## Task 5: GCal Types & Color Mapping

**Files:**
- Modify: `src/shared/services/google-calendar/types.ts`
- Modify: `src/shared/services/google-calendar/lib/map-to-gcal.ts`

- [ ] **Step 1: Extend GCalEventInput with attendees and colorId**

In `src/shared/services/google-calendar/types.ts`, update the `GCalEventInput` interface:

```typescript
export interface GCalEventInput {
  summary: string
  description?: string
  location?: string
  start: GCalDateTime
  end: GCalDateTime
  attendees?: Array<{ email: string }>
  colorId?: string
}
```

- [ ] **Step 2: Update meetingToGCalEvent with color, deep link, and attendees**

In `src/shared/services/google-calendar/lib/map-to-gcal.ts`:

Add imports at the top:
```typescript
import { GCAL_ACTIVITY_COLORS, GCAL_MEETING_COLORS } from '@/shared/constants/gcal-colors'
import { ROOTS } from '@/shared/config/roots'
```

Update the `MeetingForGCal` interface to include `projectId`:
```typescript
export interface MeetingForGCal {
  id: string
  scheduledFor: string | null
  meetingType: string | null
  projectId: string | null
  // Customer info
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  customerAddress: string | null
  customerCity: string | null
  customerState: string | null
  customerZip: string | null
  // Meeting details
  agentNotes: string | null
  tradeSelections: TradeSelectionForGCal[]
  // GCal sync fields
  gcalEventId: string | null
  gcalEtag: string | null
  // Participant emails for attendees
  participantEmails: string[]
}
```

Update `buildMeetingDescription` to include the dashboard deep link — add before the footer:
```typescript
// Dashboard link
const dashboardUrl = ROOTS.dashboard.meetings.byId(meeting.id, { absolute: true, isProduction: true })
sections.push(`View in Dashboard: ${dashboardUrl}`)
```

Update `meetingToGCalEvent` to add color and attendees:
```typescript
export function meetingToGCalEvent(meeting: MeetingForGCal): GCalEventInput | null {
  if (!meeting.scheduledFor) {
    return null
  }

  const start = new Date(meeting.scheduledFor)
  const end = new Date(start.getTime() + DEFAULT_MEETING_DURATION_MS)

  const colorId = meeting.projectId
    ? GCAL_MEETING_COLORS.Project
    : GCAL_MEETING_COLORS[meeting.meetingType as keyof typeof GCAL_MEETING_COLORS] ?? GCAL_MEETING_COLORS.Fresh

  const prefix = meeting.projectId
    ? 'Project'
    : meeting.meetingType ?? 'Meeting'

  return {
    summary: `${prefix}: ${meeting.customerName ?? 'No Customer'}`,
    description: buildMeetingDescription(meeting),
    location: buildMeetingAddress(meeting),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    colorId,
    attendees: meeting.participantEmails.map(email => ({ email })),
  }
}
```

Update `activityToGCalEvent` to add color:
```typescript
export function activityToGCalEvent(activity: ActivityForGCal): GCalEventInput | null {
  if (!activity.scheduledFor) {
    return null
  }

  const meta = activity.metaJSON as { allDay?: boolean, location?: string } | null
  const isAllDay = meta?.allDay ?? false
  const colorId = GCAL_ACTIVITY_COLORS[activity.type as keyof typeof GCAL_ACTIVITY_COLORS]

  if (isAllDay) {
    const dateStr = activity.scheduledFor.split('T')[0]
    return {
      summary: `[${activity.type}] ${activity.title}`,
      description: activity.description ?? undefined,
      location: meta?.location ?? undefined,
      start: { date: dateStr },
      end: { date: dateStr },
      colorId,
    }
  }

  const start = new Date(activity.scheduledFor)
  const end = new Date(start.getTime() + 60 * 60 * 1000)

  return {
    summary: `[${activity.type}] ${activity.title}`,
    description: activity.description ?? undefined,
    location: meta?.location ?? undefined,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    colorId,
  }
}
```

- [ ] **Step 3: Update getMeetingForGCal DAL to include projectId and participant emails**

In `src/shared/dal/server/meetings/google-calendar.ts`, update `getMeetingForGCal` to also select `projectId` and fetch participant emails:

Add import:
```typescript
import { getParticipantEmails } from '@/shared/dal/server/meetings/participants'
```

Add `projectId` to the select:
```typescript
projectId: meetings.projectId,
```

Add to the return object:
```typescript
return {
  ...row,
  // existing fields
  tradeSelections,
  participantEmails: await getParticipantEmails(meetingId),
}
```

- [ ] **Step 4: Verify with typecheck**

```bash
pnpm tsc
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/google-calendar/types.ts src/shared/services/google-calendar/lib/map-to-gcal.ts src/shared/dal/server/meetings/google-calendar.ts
git commit -m "feat(gcal): add attendees, color coding, and dashboard deep links to event payloads"
```

---

## Task 6: GCal Sync Engine — Centralize on `info@` Calendar

**Files:**
- Modify: `src/shared/services/scheduling.service.ts`
- Modify: `src/trpc/routers/schedule.router/sync.router.ts`
- Modify: `src/shared/dal/server/meetings/google-calendar.ts`

- [ ] **Step 1: Update scheduling.service.ts — pushToGCal for meetings uses info@ calendar**

The key change: when pushing a meeting to GCal, always use the `info@` super-admin's access token and calendar ID, not the meeting owner's.

In `src/shared/services/scheduling.service.ts`, add import:
```typescript
import { getSystemOwnerId } from '@/shared/dal/server/users/system'
```

Update `pushToGCal` for the meeting branch. Replace the `userId` parameter usage for meetings with the system owner:

```typescript
pushToGCal: async (userId: string, entityType: 'meeting' | 'activity', entityId: string): Promise<void> => {
  if (entityType === 'meeting') {
    // Meetings always push to the info@ system calendar
    const systemUserId = await getSystemOwnerId()
    const auth = await getAccessTokenForUser(systemUserId)
    if (!auth) {
      console.error('[pushToGCal] No Google account linked for system owner')
      return
    }

    const acct = auth.account
    if (!acct.gcalCalendarId) {
      console.error('[pushToGCal] No calendar ID for system owner')
      return
    }

    const calendarId = acct.gcalCalendarId
    const meeting = await getMeetingForGCal(entityId)
    if (!meeting) {
      return
    }

    const payload = meetingToGCalEvent(meeting)

    if (!payload) {
      if (meeting.gcalEventId) {
        await googleCalendarClient.deleteEvent(auth.accessToken, calendarId, meeting.gcalEventId)
        await clearMeetingGCalFields(entityId)
      }
      return
    }

    if (meeting.gcalEventId) {
      const updated = await googleCalendarClient.updateEvent(
        auth.accessToken,
        calendarId,
        meeting.gcalEventId,
        payload,
        meeting.gcalEtag ?? undefined,
      )
      await updateMeetingGCalFields(entityId, {
        gcalEtag: updated.etag,
        gcalSyncedAt: new Date().toISOString(),
      })
    }
    else {
      const created = await googleCalendarClient.createEvent(auth.accessToken, calendarId, payload)
      await updateMeetingGCalFields(entityId, {
        gcalEventId: created.id,
        gcalEtag: created.etag,
        gcalSyncedAt: new Date().toISOString(),
      })
    }
    return
  }

  // Activities still use the per-user calendar (unchanged)
  if (entityType === 'activity') {
    const auth = await getAccessTokenForUser(userId)
    if (!auth) {
      return
    }
    // ... rest of activity logic stays the same
  }
}
```

- [ ] **Step 2: Update triggerSync to push meetings via system owner**

In `src/trpc/routers/schedule.router/sync.router.ts`, the `triggerSync` mutation's meeting push section should use the system owner ID:

```typescript
import { getSystemOwnerId } from '@/shared/dal/server/users/system'

// Inside triggerSync mutation:
const systemOwnerId = await getSystemOwnerId()

// 1. Push unsynced meetings (have scheduledFor but no gcalEventId)
// Use system owner for all meeting pushes
const unsyncedMeetings = await db
  .select({ id: meetings.id })
  .from(meetings)
  .where(and(
    isNotNull(meetings.scheduledFor),
    isNull(meetings.gcalEventId),
  ))

for (const m of unsyncedMeetings) {
  await schedulingService
    .pushToGCal(systemOwnerId, 'meeting', m.id)
    .catch((err) => {
      console.error(`[triggerSync] pushToGCal meeting ${m.id} failed:`, err)
    })
}
```

Note: The `ownerId` filter is removed from the meetings query because all meetings go to the centralized calendar regardless of owner. The activity section keeps the `userId` filter since activities remain per-user.

- [ ] **Step 3: Update connectCalendar and handleInboundSync**

In `scheduling.service.ts`:

- `connectCalendar`: Only the `info@` user should call this (it creates the centralized calendar). Update to iterate ALL meetings with `scheduledFor` (not just one user's).
- `handleInboundSync`: Only needs to run for the `info@` user's calendar.

Update `connectCalendar`:
```typescript
connectCalendar: async (userId: string): Promise<{ calendarId: string }> => {
  // userId here should be the info@ system user
  const auth = await getAccessTokenForUser(userId)
  if (!auth) {
    throw new Error('No Google account linked for this user')
  }

  const acct = auth.account
  const calendar = await googleCalendarClient.createCalendar(auth.accessToken, TRI_PROS_CALENDAR_NAME)
  await updateAccountGCalFields(acct.id, { gcalCalendarId: calendar.id })

  const eventList = await googleCalendarClient.listEvents(auth.accessToken, calendar.id)
  await updateAccountGCalFields(acct.id, { gcalSyncToken: eventList.nextSyncToken ?? null })

  // Push ALL scheduled meetings to the centralized calendar
  const allScheduledMeetings = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(isNotNull(meetings.scheduledFor))

  for (const { id: meetingId } of allScheduledMeetings) {
    const meeting = await getMeetingForGCal(meetingId)
    if (!meeting) continue

    const payload = meetingToGCalEvent(meeting)
    if (payload) {
      const created = await googleCalendarClient.createEvent(auth.accessToken, calendar.id, payload)
      await updateMeetingGCalFields(meetingId, {
        gcalEventId: created.id,
        gcalEtag: created.etag,
        gcalSyncedAt: new Date().toISOString(),
      })
    }
  }

  // Activities still sync per-user (only sync this user's activities)
  const userActivities = await getSyncableActivitiesForUser(userId)
  for (const activity of userActivities) {
    if (!(gcalSyncableActivityTypes as readonly string[]).includes(activity.type)) continue
    const payload = activityToGCalEvent(activity)
    if (payload) {
      const created = await googleCalendarClient.createEvent(auth.accessToken, calendar.id, payload)
      await updateActivityGCalFields(activity.id, {
        gcalEventId: created.id,
        gcalEtag: created.etag,
        gcalSyncedAt: new Date().toISOString(),
      })
    }
  }

  // Register webhook
  const webhookBaseUrl = env.NGROK_URL ?? env.NEXT_PUBLIC_BASE_URL
  const webhookUrl = `${webhookBaseUrl}/api/google-calendar/webhook`
  const channelId = crypto.randomUUID()
  const watchResponse = await googleCalendarClient.watchEvents(
    auth.accessToken,
    calendar.id,
    webhookUrl,
    channelId,
  )

  await updateAccountGCalFields(acct.id, {
    gcalChannelId: channelId,
    gcalChannelExpiry: new Date(Number(watchResponse.expiration)).toISOString(),
  })

  return { calendarId: calendar.id }
}
```

- [ ] **Step 4: Verify with typecheck**

```bash
pnpm tsc
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/scheduling.service.ts src/trpc/routers/schedule.router/sync.router.ts
git commit -m "feat(gcal): centralize meeting events on info@ calendar with attendee invites"
```

---

## Task 7: `manageParticipants` Mutation

**Files:**
- Modify: `src/trpc/routers/meetings.router.ts`

- [ ] **Step 1: Add the manageParticipants mutation**

Add imports at the top of `meetings.router.ts`:
```typescript
import { meetingParticipantRoles } from '@/shared/constants/enums'
import { meetingParticipants } from '@/shared/db/schema'
import {
  addParticipant,
  countParticipantsByRole,
  getParticipantByRole,
  removeParticipant,
  updateParticipantRole,
} from '@/shared/dal/server/meetings/participants'
import { getSystemOwnerId } from '@/shared/dal/server/users/system'
```

Add the mutation (super-admin only via CASL check):
```typescript
manageParticipants: agentProcedure
  .input(z.object({
    meetingId: z.string().uuid(),
    action: z.enum(['add', 'remove', 'change_role']),
    userId: z.string().min(1),
    role: z.enum(meetingParticipantRoles).optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    if (ctx.ability.cannot('assign', 'Meeting')) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only super-admins can manage meeting participants' })
    }

    const { meetingId, action, userId, role } = input

    if (action === 'add') {
      if (!role) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Role is required when adding a participant' })
      }

      if (role === 'owner') {
        const existingOwner = await getParticipantByRole(meetingId, 'owner')
        if (existingOwner && existingOwner.userId !== userId) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Meeting already has an owner. Use change_role to swap.' })
        }
      }

      if (role === 'co_owner') {
        const count = await countParticipantsByRole(meetingId, 'co_owner')
        if (count >= 1) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Meeting already has a co-owner.' })
        }
      }

      await addParticipant(meetingId, userId, role)

      if (role === 'owner') {
        await db.update(meetings).set({ ownerId: userId }).where(eq(meetings.id, meetingId))
      }
    }

    if (action === 'remove') {
      const existing = await getParticipantByRole(meetingId, 'owner')
      const isRemovingOwner = existing?.userId === userId

      await removeParticipant(meetingId, userId)

      if (isRemovingOwner) {
        const systemOwnerId = await getSystemOwnerId()
        await addParticipant(meetingId, systemOwnerId, 'owner')
        await db.update(meetings).set({ ownerId: systemOwnerId }).where(eq(meetings.id, meetingId))
      }
    }

    if (action === 'change_role') {
      if (!role) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Role is required when changing role' })
      }

      if (role === 'owner') {
        const currentOwner = await getParticipantByRole(meetingId, 'owner')
        if (currentOwner && currentOwner.userId !== userId) {
          await updateParticipantRole(meetingId, currentOwner.userId, 'co_owner')
        }
        await updateParticipantRole(meetingId, userId, 'owner')
        await db.update(meetings).set({ ownerId: userId }).where(eq(meetings.id, meetingId))
      }
      else if (role === 'co_owner') {
        const existingCoOwner = await getParticipantByRole(meetingId, 'co_owner')
        if (existingCoOwner && existingCoOwner.userId !== userId) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Meeting already has a co-owner.' })
        }
        await updateParticipantRole(meetingId, userId, role)
      }
      else {
        await updateParticipantRole(meetingId, userId, role)
      }
    }

    // Push updated attendee list to Google Calendar
    const systemOwnerId = await getSystemOwnerId()
    await schedulingService
      .pushToGCal(systemOwnerId, 'meeting', meetingId)
      .catch(err => console.error(`[manageParticipants] GCal push failed for ${meetingId}:`, err))

    return { success: true }
  }),
```

- [ ] **Step 2: Update meetings.create to insert participant row**

In the `create` mutation, after the meeting is inserted, add a participant row:

```typescript
// After: const [created] = await db.insert(meetings).values(...).returning()

// Add participant row for the owner
await addParticipant(created.id, ctx.session.user.id, 'owner')
```

- [ ] **Step 3: Update meetings.duplicate to insert participant row**

In the `duplicate` mutation, after the meeting is inserted:

```typescript
// After: const [created] = await db.insert(meetings).values(...).returning()

// Add participant row for the owner
await addParticipant(created.id, ctx.session.user.id, 'owner')
```

- [ ] **Step 4: Remove the assignOwner mutation**

Delete the entire `assignOwner` mutation block from `meetings.router.ts` (lines ~276-291).

- [ ] **Step 5: Verify with typecheck and lint**

```bash
pnpm tsc && pnpm lint
```

Expected: May get errors from UI files still referencing `assignOwner`. That's expected — we'll fix those in Task 9. For now, verify no other type errors.

- [ ] **Step 6: Commit**

```bash
git add src/trpc/routers/meetings.router.ts
git commit -m "feat(meetings): add manageParticipants mutation, remove assignOwner"
```

---

## Task 8: Migrate Visibility Queries

**Files:**
- Modify: `src/trpc/routers/meetings.router.ts`
- Modify: `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts`
- Modify: `src/features/customer-pipelines/dal/server/get-customer-profile.ts`
- Modify: `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts`
- Modify: `src/features/agent-dashboard/dal/server/get-action-queue.ts`
- Modify: `src/shared/dal/server/meetings/google-calendar.ts`

- [ ] **Step 1: Add participant import to each file**

Every file that currently does `eq(meetings.ownerId, userId)` for visibility needs:

```typescript
import { userParticipatesInMeeting } from '@/shared/dal/server/meetings/participants'
```

- [ ] **Step 2: Replace visibility filters across all files**

The mechanical replacement in each file. Every occurrence of:
```typescript
isOmni ? undefined : eq(meetings.ownerId, userId)
```
becomes:
```typescript
isOmni ? undefined : userParticipatesInMeeting(userId, meetings.id)
```

And every occurrence of:
```typescript
eq(meetings.ownerId, userId)
```
(without the isOmni guard) becomes:
```typescript
userParticipatesInMeeting(userId, meetings.id)
```

**Files and approximate line numbers:**

1. `meetings.router.ts` — getAll (line ~40), duplicate (line ~213), delete (line ~246)
2. `get-customer-pipeline-items.ts` — lines ~106, ~163, ~209, ~382, and the raw SQL at ~349
3. `move-customer-pipeline-item.ts` — line ~89
4. `get-action-queue.ts` — line ~149
5. `google-calendar.ts` (meetings DAL) — lines ~61, ~97

**Special case — raw SQL at `get-customer-pipeline-items.ts:349`:**
```sql
-- Before:
m.owner_id = ${userId}

-- After (use a subquery):
EXISTS (SELECT 1 FROM meeting_participants mp WHERE mp.meeting_id = m.id AND mp.user_id = ${userId})
```

**Note:** Join conditions like `eq(user.id, meetings.ownerId)` at lines ~39, ~167, ~206, ~378 should **stay unchanged**. These are joins to get the owner's display name/image for the UI, not visibility filters. The `ownerId` column is still valid for this purpose.

- [ ] **Step 3: Update get-customer-profile.ts**

At line ~27, the select includes `ownerId: meetings.ownerId`. This stays as-is — it's selecting the column for display, not filtering.

- [ ] **Step 4: Verify with typecheck and lint**

```bash
pnpm tsc && pnpm lint
```

Expected: Clean pass.

- [ ] **Step 5: Commit**

```bash
git add src/trpc/routers/meetings.router.ts src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts src/features/customer-pipelines/dal/server/get-customer-profile.ts src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts src/features/agent-dashboard/dal/server/get-action-queue.ts src/shared/dal/server/meetings/google-calendar.ts
git commit -m "refactor(permissions): replace ownerId visibility filters with participant-based exists checks"
```

---

## Task 9: Update UI — Assign Rep Dialog

**Files:**
- Modify: `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx`
- Modify: `src/shared/entities/meetings/components/assign-rep-dialog.tsx`

- [ ] **Step 1: Update AssignRepDialog to call manageParticipants**

In `src/shared/entities/meetings/components/assign-rep-dialog.tsx`:

Replace the `assignOwner` mutation with `manageParticipants`:

```typescript
// Before:
const assignMutation = useMutation(
  trpc.meetingsRouter.assignOwner.mutationOptions({ ... })
)

// After:
const assignMutation = useMutation(
  trpc.meetingsRouter.manageParticipants.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success('Participant assigned')
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
)
```

Update the assign handler to pass the new input shape:

```typescript
// Before:
await assignMutation.mutateAsync({ meetingId, newOwnerId: selectedUserId })

// After:
await assignMutation.mutateAsync({
  meetingId,
  action: 'add',
  userId: selectedUserId,
  role: 'owner',  // or let user choose role — v1 defaults to owner
})
```

- [ ] **Step 2: Update use-meeting-action-configs.tsx**

The action config references `assignOwner` — update to match the new mutation name. The `defaultAssignOwner` callback and state management stay the same since the dialog handles the mutation internally.

Verify the `MEETING_ACTIONS.assignOwner` constant still matches what the UI expects. If needed, rename to `MEETING_ACTIONS.manageParticipants` or keep as `assignOwner` (it's a UI label, not an API name).

- [ ] **Step 3: Verify with typecheck and lint**

```bash
pnpm tsc && pnpm lint
```

Expected: Clean. No more references to the deleted `assignOwner` tRPC procedure.

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx src/shared/entities/meetings/components/assign-rep-dialog.tsx
git commit -m "feat(ui): update assign dialog to use manageParticipants mutation"
```

---

## Task 10: Dead Code Cleanup & Audit

**Files:**
- Audit all files for stale references

- [ ] **Step 1: Search for any remaining assignOwner references**

```bash
# Search for any remaining references to the removed mutation
pnpm exec rg "assignOwner" src/ --type ts --type tsx
```

Fix any remaining references.

- [ ] **Step 2: Search for direct ownerId equality checks that should use participant helper**

```bash
pnpm exec rg "meetings\.ownerId" src/ --type ts
```

For each result, verify it's either:
- A join condition for display (keep)
- A denormalized column update in `manageParticipants` (keep)
- The schema definition (keep)
- A visibility filter (should have been migrated — fix if missed)

- [ ] **Step 3: Verify per-agent calendar creation is only used for activities**

In `scheduling.service.ts`, confirm `connectCalendar` creates one centralized calendar for the `info@` user, not per-agent calendars for meetings.

- [ ] **Step 4: Run full verification**

```bash
pnpm tsc && pnpm lint
```

Expected: Clean pass.

- [ ] **Step 5: Commit any cleanup**

```bash
git add -A
git commit -m "chore: dead code cleanup — remove stale assignOwner refs and verify participant migration"
```

---

## Task 11: End-to-End Verification

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Verify meeting creation inserts participant row**

Create a new meeting in the UI. Check the `meeting_participants` table in Drizzle Studio — it should have a row with the creator's user ID and role `owner`.

- [ ] **Step 3: Verify participant management**

Use the assign rep dialog to add an owner to an unassigned meeting. Verify:
- `meeting_participants` row created with role `owner`
- `meetings.ownerId` updated
- GCal event on `info@` calendar has the agent as an attendee

- [ ] **Step 4: Verify role swap**

Change a participant's role from `co_owner` to `owner`. Verify:
- Previous owner demoted to `co_owner`
- `meetings.ownerId` updated to new owner
- GCal attendee list unchanged (both still invited)

- [ ] **Step 5: Verify visibility**

Log in as an agent. Verify:
- Agent only sees meetings they participate in
- Super-admin sees all meetings

- [ ] **Step 6: Verify GCal event metadata**

Check a synced meeting event in Google Calendar:
- Correct color (blueberry for Fresh, grape for Rehash, basil for Project)
- Title prefix matches meeting type
- Description includes dashboard deep link
- Attendees list shows assigned agents

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: meeting participants & gcal sync redesign — complete"
```
