# Schedule Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/dashboard/meetings` with a full schedule management system backed by bidirectional Google Calendar sync, introducing activities (notes, reminders, tasks, events) alongside meetings.

**Architecture:** Two-layer service design — raw Google Calendar REST client (`google-calendar/`) and business-facing scheduling service (`scheduling.service.ts`). Activities table with polymorphic entity links consolidates all note/task/reminder/event data. Bidirectional sync uses webhooks + QStash polling safety net with last-write-wins conflict resolution. Calendar UI components are generalized from meeting-specific to multi-entity.

**Tech Stack:** Next.js 15, Drizzle ORM (Postgres/Neon), tRPC, better-auth (Google OAuth), Upstash QStash, Google Calendar REST API v3, TanStack React Query, Tailwind v4, shadcn/ui, motion/react

**Spec:** `docs/superpowers/specs/2026-04-15-schedule-management-design.md`

---

## File Structure

### New Files

```
# Enums & Types
src/shared/constants/enums/activities.ts              # const arrays + inferred types

# Database
src/shared/db/schema/activities.ts                     # activities table definition

# Entity Module
src/shared/entities/activities/schemas/index.ts        # activityMetaSchema, select/insert schemas
src/shared/entities/activities/constants/index.ts      # ACTIVITY_ACTIONS, ACTIVITY_TYPE_CONFIG
src/shared/entities/activities/hooks/use-activity-actions.ts
src/shared/entities/activities/hooks/use-activity-action-configs.ts

# Google Calendar Service
src/shared/services/google-calendar/types.ts           # GCal API types
src/shared/services/google-calendar/client.ts          # Raw REST client
src/shared/services/google-calendar/lib/map-to-gcal.ts # Entity -> GCal event
src/shared/services/google-calendar/lib/map-from-gcal.ts # GCal event -> local shape
src/shared/services/google-calendar/lib/conflict.ts    # Last-write-wins comparator

# tRPC Routers
src/trpc/routers/schedule.router/index.ts              # Compose sub-routers
src/trpc/routers/schedule.router/activities.router.ts  # Activity CRUD
src/trpc/routers/schedule.router/sync.router.ts        # GCal sync operations

# QStash Jobs
src/shared/services/upstash/jobs/sync-calendars.ts     # Cron: incremental sync + channel renewal
src/shared/services/upstash/jobs/initial-calendar-sync.ts # One-shot: first connection

# Webhook Route
src/app/api/google-calendar/webhook/route.ts           # POST handler for Google push notifications

# Feature Module
src/features/schedule-management/types/index.ts
src/features/schedule-management/constants/activity-table-columns.ts
src/features/schedule-management/constants/activity-filter-config.ts
src/features/schedule-management/constants/schedule-calendar-config.ts
src/features/schedule-management/hooks/use-schedule-filters.ts
src/features/schedule-management/lib/to-calendar-event.ts
src/features/schedule-management/ui/views/schedule-view.tsx
src/features/schedule-management/ui/components/schedule-calendar.tsx
src/features/schedule-management/ui/components/schedule-today-view.tsx
src/features/schedule-management/ui/components/schedule-week-view.tsx
src/features/schedule-management/ui/components/schedule-calendar-dot.tsx
src/features/schedule-management/ui/components/activities-table.tsx
src/features/schedule-management/ui/components/activity-form.tsx
src/features/schedule-management/ui/components/activity-calendar-card.tsx
src/features/schedule-management/ui/components/sync-status-badge.tsx

# Route
src/app/(frontend)/dashboard/schedule/page.tsx
```

### Modified Files

```
src/shared/constants/enums/index.ts                    # Add activities re-export
src/shared/db/schema/meta.ts                           # Add activityTypeEnum, activityEntityTypeEnum
src/shared/db/schema/meetings.ts                       # Add gcal sync columns
src/shared/db/schema/auth.ts                           # Add gcal state columns to account
src/shared/db/schema/index.ts                          # Add activities export
src/shared/domains/auth/server.ts                      # Add calendar.events scope
src/shared/domains/permissions/types.ts                # Add Activity, Calendar subjects
src/shared/domains/permissions/abilities.ts            # Add Activity/Calendar permissions
src/shared/services/scheduling.service.ts              # Expand from stub to full implementation
src/trpc/routers/app.ts                                # Register scheduleRouter
src/app/api/qstash-jobs/route.ts                       # Register new jobs
src/features/agent-dashboard/lib/get-sidebar-nav.ts    # Meetings -> Schedule
src/app/(frontend)/dashboard/meetings/page.tsx         # Redirect to /dashboard/schedule

# Data migration script (one-time)
src/shared/db/migrations/migrate-notes-to-activities.ts
```

### Deleted Files (Phase 3 — after migration verified)

```
src/shared/db/schema/customer-notes.ts
src/features/meeting-flow/ui/components/calendar/meeting-calendar.tsx
src/features/meeting-flow/ui/components/calendar/meeting-today-view.tsx
src/features/meeting-flow/ui/components/calendar/meeting-week-view.tsx
src/features/meeting-flow/ui/components/calendar/meeting-calendar-dot.tsx
src/features/meeting-flow/ui/views/meetings-view.tsx
```

---

## Task 1: Activity Enums & Constants

**Files:**
- Create: `src/shared/constants/enums/activities.ts`
- Modify: `src/shared/constants/enums/index.ts`

- [ ] **Step 1: Create activity enums file**

Create `src/shared/constants/enums/activities.ts`:

```typescript
export const activityTypes = ['note', 'reminder', 'task', 'event'] as const
export type ActivityType = (typeof activityTypes)[number]

export const activityEntityTypes = ['customer', 'meeting', 'project', 'proposal'] as const
export type ActivityEntityType = (typeof activityEntityTypes)[number]

/** Activity types that sync to Google Calendar (must have scheduledFor) */
export const gcalSyncableActivityTypes = ['event', 'reminder'] as const
export type GCalSyncableActivityType = (typeof gcalSyncableActivityTypes)[number]

export const activityTaskPriorities = ['low', 'medium', 'high'] as const
export type ActivityTaskPriority = (typeof activityTaskPriorities)[number]

export const activityNoteSources = ['agent', 'system'] as const
export type ActivityNoteSource = (typeof activityNoteSources)[number]
```

- [ ] **Step 2: Add re-export to barrel**

In `src/shared/constants/enums/index.ts`, add:

```typescript
export * from './activities'
```

Add it in alphabetical order (first line, before `./customer-pipelines`).

- [ ] **Step 3: Verify lint passes**

Run: `pnpm lint --filter src/shared/constants/enums/`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/constants/enums/activities.ts src/shared/constants/enums/index.ts
git commit -m "feat(schedule): add activity enum constants and types"
```

---

## Task 2: Database Schema — Activities Table + GCal Columns

**Files:**
- Modify: `src/shared/db/schema/meta.ts`
- Create: `src/shared/db/schema/activities.ts`
- Modify: `src/shared/db/schema/meetings.ts`
- Modify: `src/shared/db/schema/auth.ts`
- Modify: `src/shared/db/schema/index.ts`

- [ ] **Step 1: Add pgEnums to meta.ts**

In `src/shared/db/schema/meta.ts`, add imports at the top:

```typescript
import { activityEntityTypes, activityTypes } from '@/shared/constants/enums'
```

Add the pgEnums alongside the existing ones:

```typescript
export const activityTypeEnum = pgEnum('activity_type', activityTypes)
export const activityEntityTypeEnum = pgEnum('activity_entity_type', activityEntityTypes)
```

- [ ] **Step 2: Create activities table schema**

Create `src/shared/db/schema/activities.ts`:

```typescript
import type z from 'zod'

import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { activityEntityTypeEnum, activityTypeEnum } from './meta'
import { user } from './auth'

export const activities = pgTable('activities', {
  id,
  type: activityTypeEnum().notNull(),
  title: text('title').notNull(),
  description: text('description'),
  entityType: activityEntityTypeEnum('entity_type'),
  entityId: uuid('entity_id'),
  ownerId: text('owner_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  scheduledFor: timestamp('scheduled_for', { mode: 'string', withTimezone: true }),
  dueAt: timestamp('due_at', { mode: 'string', withTimezone: true }),
  completedAt: timestamp('completed_at', { mode: 'string', withTimezone: true }),
  gcalEventId: text('gcal_event_id'),
  gcalEtag: text('gcal_etag'),
  gcalSyncedAt: timestamp('gcal_synced_at', { mode: 'string', withTimezone: true }),
  metaJSON: jsonb('meta_json'),
  createdAt,
  updatedAt,
})

export const activitiesRelations = relations(activities, ({ one }) => ({
  owner: one(user, { fields: [activities.ownerId], references: [user.id] }),
}))

export const selectActivitySchema = createSelectSchema(activities)
export type Activity = z.infer<typeof selectActivitySchema>

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertActivity = z.infer<typeof insertActivitySchema>
```

- [ ] **Step 3: Add GCal sync columns to meetings table**

In `src/shared/db/schema/meetings.ts`, add after the `agentNotes` column:

```typescript
  // Google Calendar sync
  gcalEventId: text('gcal_event_id'),
  gcalEtag: text('gcal_etag'),
  gcalSyncedAt: timestamp('gcal_synced_at', { mode: 'string', withTimezone: true }),
```

- [ ] **Step 4: Add GCal state columns to account table**

In `src/shared/db/schema/auth.ts`, add to the `account` table after the existing columns (before `createdAt`/`updatedAt` or at the end of the column list):

```typescript
  gcalCalendarId: text('gcal_calendar_id'),
  gcalSyncToken: text('gcal_sync_token'),
  gcalChannelId: text('gcal_channel_id'),
  gcalChannelExpiry: timestamp('gcal_channel_expiry', { mode: 'string', withTimezone: true }),
```

- [ ] **Step 5: Export activities from schema barrel**

In `src/shared/db/schema/index.ts`, add:

```typescript
export * from './activities'
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No type errors

- [ ] **Step 7: Push schema to dev database (Phase 1)**

Run: `pnpm db:push:dev`
Expected: Schema changes applied — new `activities` table, new columns on `meetings` and `account`

- [ ] **Step 8: Commit**

```bash
git add src/shared/db/schema/meta.ts src/shared/db/schema/activities.ts src/shared/db/schema/meetings.ts src/shared/db/schema/auth.ts src/shared/db/schema/index.ts
git commit -m "feat(schedule): add activities table and gcal sync columns"
```

---

## Task 3: Activity Entity Module

**Files:**
- Create: `src/shared/entities/activities/schemas/index.ts`
- Create: `src/shared/entities/activities/constants/index.ts`

- [ ] **Step 1: Create activity meta schemas**

Create `src/shared/entities/activities/schemas/index.ts`:

```typescript
import z from 'zod'

import { activityNoteSources, activityTaskPriorities } from '@/shared/constants/enums'

// ── Type-specific meta schemas (discriminated by activity type) ──────────────

export const noteMetaSchema = z.object({
  source: z.enum(activityNoteSources).optional(),
})
export type NoteMeta = z.infer<typeof noteMetaSchema>

export const reminderMetaSchema = z.object({
  reminderMinutesBefore: z.number().int().min(0).optional(),
})
export type ReminderMeta = z.infer<typeof reminderMetaSchema>

export const taskMetaSchema = z.object({
  priority: z.enum(activityTaskPriorities).optional(),
})
export type TaskMeta = z.infer<typeof taskMetaSchema>

export const eventMetaSchema = z.object({
  location: z.string().optional(),
  allDay: z.boolean().optional(),
})
export type EventMeta = z.infer<typeof eventMetaSchema>

/** Discriminated union — validate metaJSON based on activity type */
export const activityMetaSchemas = {
  note: noteMetaSchema,
  reminder: reminderMetaSchema,
  task: taskMetaSchema,
  event: eventMetaSchema,
} as const
```

- [ ] **Step 2: Create activity constants**

Create `src/shared/entities/activities/constants/index.ts`:

```typescript
import type { EntityAction } from '@/shared/components/entity-actions/types'

import {
  BellIcon,
  CalendarIcon,
  CheckSquareIcon,
  EditIcon,
  EyeIcon,
  StickyNoteIcon,
  TrashIcon,
} from 'lucide-react'

export const ACTIVITY_TYPE_CONFIG = {
  note: { icon: StickyNoteIcon, label: 'Note', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  reminder: { icon: BellIcon, label: 'Reminder', color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  task: { icon: CheckSquareIcon, label: 'Task', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  event: { icon: CalendarIcon, label: 'Event', color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
} as const

export const ACTIVITY_ACTIONS = {
  view: { id: 'view', label: 'View', icon: EyeIcon, permission: ['read', 'Activity'] as const, primary: true },
  edit: { id: 'edit', label: 'Edit', icon: EditIcon, permission: ['update', 'Activity'] as const },
  complete: { id: 'complete', label: 'Mark Complete', icon: CheckSquareIcon, permission: ['update', 'Activity'] as const },
  delete: { id: 'delete', label: 'Delete', icon: TrashIcon, permission: ['delete', 'Activity'] as const, destructive: true, separatorBefore: true },
} satisfies Record<string, EntityAction>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/activities/
git commit -m "feat(schedule): add activity entity schemas and constants"
```

---

## Task 4: Permissions — Add Activity & Calendar Subjects

**Files:**
- Modify: `src/shared/domains/permissions/types.ts`
- Modify: `src/shared/domains/permissions/abilities.ts`

- [ ] **Step 1: Add subjects to types**

In `src/shared/domains/permissions/types.ts`, add `'Activity'` and `'Calendar'` to the `AppSubjects` union type. The updated union should be:

```typescript
export type AppSubjects = 'Activity' | 'Calendar' | 'Customer' | 'CustomerPipeline' | 'Dashboard' | 'Meeting' | 'Project' | 'Proposal' | 'User' | 'all'
```

- [ ] **Step 2: Add abilities for agent role**

In `src/shared/domains/permissions/abilities.ts`, inside the `agent` role case, add after the existing Meeting permissions:

```typescript
      // Activities
      can('read', 'Activity')
      can('create', 'Activity')
      can('update', 'Activity')
      can('delete', 'Activity')
      // Calendar sync
      can('manage', 'Calendar')
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/permissions/types.ts src/shared/domains/permissions/abilities.ts
git commit -m "feat(schedule): add Activity and Calendar permission subjects"
```

---

## Task 5: OAuth Scope — Add Google Calendar

**Files:**
- Modify: `src/shared/domains/auth/server.ts`

- [ ] **Step 1: Add calendar.events scope**

In `src/shared/domains/auth/server.ts`, find the Google provider `scope` array and add the calendar scope:

```typescript
      scope: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/calendar.events',
      ],
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/domains/auth/server.ts
git commit -m "feat(schedule): add Google Calendar OAuth scope"
```

---

## Task 6: Google Calendar REST Client — Types

**Files:**
- Create: `src/shared/services/google-calendar/types.ts`

- [ ] **Step 1: Create GCal API types**

Create `src/shared/services/google-calendar/types.ts`:

```typescript
/** Google Calendar Event resource (subset of fields we use) */
export interface GCalEvent {
  id: string
  summary: string
  description?: string
  location?: string
  start: GCalDateTime
  end: GCalDateTime
  etag: string
  updated: string // ISO 8601 timestamp
  status: 'confirmed' | 'tentative' | 'cancelled'
  htmlLink?: string
}

export interface GCalDateTime {
  dateTime?: string // RFC 3339 (for timed events)
  date?: string     // YYYY-MM-DD (for all-day events)
  timeZone?: string
}

export interface GCalEventInput {
  summary: string
  description?: string
  location?: string
  start: GCalDateTime
  end: GCalDateTime
}

export interface GCalEventListResponse {
  kind: 'calendar#events'
  etag: string
  summary: string
  updated: string
  nextSyncToken?: string
  nextPageToken?: string
  items: GCalEvent[]
}

export interface GCalCalendar {
  id: string
  summary: string
  etag: string
}

export interface GCalWatchRequest {
  id: string        // Channel ID (UUID)
  type: 'web_hook'
  address: string   // Webhook URL
  expiration?: string // Unix timestamp in ms
}

export interface GCalWatchResponse {
  kind: 'api#channel'
  id: string
  resourceId: string
  resourceUri: string
  expiration: string // Unix timestamp in ms
}

/** Shape returned by our mapping functions for local upsert */
export interface LocalEventUpsert {
  title: string
  description: string | null
  scheduledFor: string | null  // ISO timestamp
  location: string | null
  allDay: boolean
  gcalEventId: string
  gcalEtag: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/services/google-calendar/types.ts
git commit -m "feat(schedule): add Google Calendar API types"
```

---

## Task 7: Google Calendar REST Client — Core

**Files:**
- Create: `src/shared/services/google-calendar/client.ts`

- [ ] **Step 1: Create the GCal REST client**

Create `src/shared/services/google-calendar/client.ts`:

```typescript
import type {
  GCalCalendar,
  GCalEvent,
  GCalEventInput,
  GCalEventListResponse,
  GCalWatchRequest,
  GCalWatchResponse,
} from './types'

const GCAL_BASE = 'https://www.googleapis.com/calendar/v3'

function authHeaders(accessToken: string) {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

async function handleResponse<T>(res: Response, context: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google Calendar ${context} failed (${res.status}): ${body}`)
  }
  return res.json() as Promise<T>
}

function createGoogleCalendarClient() {
  return {
    /** Create a secondary calendar for Tri Pros events */
    createCalendar: async (accessToken: string, title: string): Promise<GCalCalendar> => {
      const res = await fetch(`${GCAL_BASE}/calendars`, {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ summary: title }),
      })
      return handleResponse<GCalCalendar>(res, 'createCalendar')
    },

    /** List events with optional syncToken for incremental sync */
    listEvents: async (
      accessToken: string,
      calendarId: string,
      syncToken?: string,
    ): Promise<GCalEventListResponse> => {
      const params = new URLSearchParams()
      if (syncToken) {
        params.set('syncToken', syncToken)
      } else {
        // Initial full sync — get events from past 30 days
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        params.set('timeMin', thirtyDaysAgo.toISOString())
        params.set('singleEvents', 'true')
        params.set('orderBy', 'startTime')
      }
      params.set('maxResults', '2500')

      const res = await fetch(
        `${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        { headers: authHeaders(accessToken) },
      )

      // If sync token is invalid (410 Gone), caller should do a full sync
      if (res.status === 410) {
        throw new GCalSyncTokenExpiredError()
      }

      return handleResponse<GCalEventListResponse>(res, 'listEvents')
    },

    /** Get a single event */
    getEvent: async (
      accessToken: string,
      calendarId: string,
      eventId: string,
    ): Promise<GCalEvent> => {
      const res = await fetch(
        `${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        { headers: authHeaders(accessToken) },
      )
      return handleResponse<GCalEvent>(res, 'getEvent')
    },

    /** Create a new event */
    createEvent: async (
      accessToken: string,
      calendarId: string,
      event: GCalEventInput,
    ): Promise<GCalEvent> => {
      const res = await fetch(
        `${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: authHeaders(accessToken),
          body: JSON.stringify(event),
        },
      )
      return handleResponse<GCalEvent>(res, 'createEvent')
    },

    /** Update an existing event. Pass etag for conflict detection. */
    updateEvent: async (
      accessToken: string,
      calendarId: string,
      eventId: string,
      event: GCalEventInput,
      etag?: string,
    ): Promise<GCalEvent> => {
      const headers: Record<string, string> = authHeaders(accessToken)
      if (etag) {
        headers['If-Match'] = etag
      }

      const res = await fetch(
        `${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(event),
        },
      )
      return handleResponse<GCalEvent>(res, 'updateEvent')
    },

    /** Delete an event */
    deleteEvent: async (
      accessToken: string,
      calendarId: string,
      eventId: string,
    ): Promise<void> => {
      const res = await fetch(
        `${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: 'DELETE',
          headers: authHeaders(accessToken),
        },
      )
      if (!res.ok && res.status !== 404) {
        const body = await res.text()
        throw new Error(`Google Calendar deleteEvent failed (${res.status}): ${body}`)
      }
    },

    /** Register a webhook channel for push notifications */
    watchEvents: async (
      accessToken: string,
      calendarId: string,
      webhookUrl: string,
      channelId: string,
    ): Promise<GCalWatchResponse> => {
      const body: GCalWatchRequest = {
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
      }
      const res = await fetch(
        `${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events/watch`,
        {
          method: 'POST',
          headers: authHeaders(accessToken),
          body: JSON.stringify(body),
        },
      )
      return handleResponse<GCalWatchResponse>(res, 'watchEvents')
    },

    /** Stop a webhook channel */
    stopWatch: async (
      accessToken: string,
      channelId: string,
      resourceId: string,
    ): Promise<void> => {
      const res = await fetch(
        `${GCAL_BASE}/channels/stop`,
        {
          method: 'POST',
          headers: authHeaders(accessToken),
          body: JSON.stringify({ id: channelId, resourceId }),
        },
      )
      // 404 is fine — channel may have already expired
      if (!res.ok && res.status !== 404) {
        const body = await res.text()
        throw new Error(`Google Calendar stopWatch failed (${res.status}): ${body}`)
      }
    },
  }
}

export class GCalSyncTokenExpiredError extends Error {
  constructor() {
    super('Google Calendar sync token expired (410 Gone). Full sync required.')
    this.name = 'GCalSyncTokenExpiredError'
  }
}

export type GoogleCalendarClient = ReturnType<typeof createGoogleCalendarClient>
export const googleCalendarClient = createGoogleCalendarClient()
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/google-calendar/client.ts
git commit -m "feat(schedule): add Google Calendar REST client"
```

---

## Task 8: Google Calendar Mapping & Conflict Utilities

**Files:**
- Create: `src/shared/services/google-calendar/lib/map-to-gcal.ts`
- Create: `src/shared/services/google-calendar/lib/map-from-gcal.ts`
- Create: `src/shared/services/google-calendar/lib/conflict.ts`

- [ ] **Step 1: Create map-to-gcal utility**

Create `src/shared/services/google-calendar/lib/map-to-gcal.ts`:

```typescript
import type { GCalEventInput } from '../types'

interface MeetingForGCal {
  id: string
  scheduledFor: string | null
  customerName?: string | null
  meetingType?: string | null
  agentNotes?: string | null
}

interface ActivityForGCal {
  id: string
  type: string
  title: string
  description: string | null
  scheduledFor: string | null
  metaJSON: unknown
}

const DEFAULT_MEETING_DURATION_MS = 2 * 60 * 60 * 1000 // 2 hours

export function meetingToGCalEvent(meeting: MeetingForGCal): GCalEventInput | null {
  if (!meeting.scheduledFor) {
    return null
  }

  const start = new Date(meeting.scheduledFor)
  const end = new Date(start.getTime() + DEFAULT_MEETING_DURATION_MS)

  return {
    summary: `${meeting.meetingType ?? 'Meeting'}: ${meeting.customerName ?? 'No Customer'}`,
    description: meeting.agentNotes ?? undefined,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  }
}

export function activityToGCalEvent(activity: ActivityForGCal): GCalEventInput | null {
  if (!activity.scheduledFor) {
    return null
  }

  const meta = activity.metaJSON as { allDay?: boolean, location?: string } | null
  const isAllDay = meta?.allDay ?? false

  if (isAllDay) {
    // All-day events use date (YYYY-MM-DD) instead of dateTime
    const dateStr = activity.scheduledFor.split('T')[0]
    return {
      summary: `[${activity.type}] ${activity.title}`,
      description: activity.description ?? undefined,
      location: meta?.location ?? undefined,
      start: { date: dateStr },
      end: { date: dateStr },
    }
  }

  const start = new Date(activity.scheduledFor)
  const end = new Date(start.getTime() + 60 * 60 * 1000) // Default 1 hour

  return {
    summary: `[${activity.type}] ${activity.title}`,
    description: activity.description ?? undefined,
    location: meta?.location ?? undefined,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  }
}
```

- [ ] **Step 2: Create map-from-gcal utility**

Create `src/shared/services/google-calendar/lib/map-from-gcal.ts`:

```typescript
import type { GCalEvent, LocalEventUpsert } from '../types'

export function gcalEventToLocal(event: GCalEvent): LocalEventUpsert {
  const isAllDay = !!event.start.date && !event.start.dateTime

  let scheduledFor: string | null = null
  if (event.start.dateTime) {
    scheduledFor = event.start.dateTime
  } else if (event.start.date) {
    scheduledFor = new Date(event.start.date).toISOString()
  }

  return {
    title: event.summary ?? 'Untitled Event',
    description: event.description ?? null,
    scheduledFor,
    location: event.location ?? null,
    allDay: isAllDay,
    gcalEventId: event.id,
    gcalEtag: event.etag,
  }
}
```

- [ ] **Step 3: Create conflict resolution utility**

Create `src/shared/services/google-calendar/lib/conflict.ts`:

```typescript
/**
 * Last-write-wins conflict resolution.
 *
 * Compares local `updatedAt` against GCal `updated` timestamp.
 * Returns 'local' if local record is newer, 'remote' if GCal is newer.
 *
 * If timestamps are identical, prefer local (our data is richer).
 */
export function resolveConflict(
  localUpdatedAt: string,
  gcalUpdatedAt: string,
): 'local' | 'remote' {
  const localTime = new Date(localUpdatedAt).getTime()
  const remoteTime = new Date(gcalUpdatedAt).getTime()

  return localTime >= remoteTime ? 'local' : 'remote'
}

/**
 * Check if a GCal event has changed since we last synced.
 * Compares the etag from GCal against our stored etag.
 */
export function hasRemoteChanged(storedEtag: string | null, remoteEtag: string): boolean {
  return storedEtag !== remoteEtag
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/google-calendar/lib/
git commit -m "feat(schedule): add GCal mapping and conflict resolution utilities"
```

---

## Task 9: Scheduling Service — Expand from Stub

**Files:**
- Modify: `src/shared/services/scheduling.service.ts`

This is the largest task. The scheduling service is the business-facing API that orchestrates all sync operations.

- [ ] **Step 1: Rewrite scheduling.service.ts**

Replace the entire contents of `src/shared/services/scheduling.service.ts` with the full implementation. This service uses:

- `googleCalendarClient` for raw API calls
- `refreshAccessToken` from google-drive for token refresh
- Drizzle `db` for direct database reads/writes (following DAL patterns from the codebase)
- Mapping functions from `google-calendar/lib/`
- Conflict resolution from `google-calendar/lib/conflict.ts`

```typescript
import { and, eq, isNotNull } from 'drizzle-orm'

import { db } from '@/shared/db'
import { account } from '@/shared/db/schema/auth'
import { activities } from '@/shared/db/schema/activities'
import { meetings } from '@/shared/db/schema/meetings'
import { gcalSyncableActivityTypes } from '@/shared/constants/enums'
import { env } from '@/shared/config/server-env'
import { refreshAccessToken } from '@/shared/services/google-drive/lib/refresh-access-token'

import { googleCalendarClient, GCalSyncTokenExpiredError } from './google-calendar/client'
import { resolveConflict, hasRemoteChanged } from './google-calendar/lib/conflict'
import { activityToGCalEvent, meetingToGCalEvent } from './google-calendar/lib/map-to-gcal'
import { gcalEventToLocal } from './google-calendar/lib/map-from-gcal'

const TRI_PROS_CALENDAR_NAME = 'Tri Pros Schedule'

/** Get a fresh access token for a user's Google account */
async function getAccessTokenForUser(userId: string): Promise<{ accessToken: string, accountId: string } | null> {
  const row = await db.query.account.findFirst({
    where: and(eq(account.userId, userId), eq(account.providerId, 'google')),
  })

  if (!row?.refreshToken) {
    return null
  }

  // Check if token is expired or will expire within 5 minutes
  const expiresAt = row.accessTokenExpiresAt ? new Date(row.accessTokenExpiresAt) : new Date(0)
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000)

  let accessToken = row.accessToken
  if (!accessToken || expiresAt < fiveMinFromNow) {
    const refreshed = await refreshAccessToken({ refreshToken: row.refreshToken })
    accessToken = refreshed.accessToken

    await db.update(account)
      .set({
        accessToken: refreshed.accessToken,
        accessTokenExpiresAt: refreshed.expiresAt.toISOString(),
      })
      .where(eq(account.id, row.id))
  }

  return { accessToken: accessToken!, accountId: row.id }
}

function createSchedulingService() {
  return {
    /**
     * Connect a user's Google Calendar.
     * Creates the Tri Pros secondary calendar, does initial sync, registers webhook.
     */
    connectCalendar: async (userId: string): Promise<{ calendarId: string }> => {
      const auth = await getAccessTokenForUser(userId)
      if (!auth) {
        throw new Error('No Google account linked for this user')
      }

      // Create secondary calendar
      const calendar = await googleCalendarClient.createCalendar(
        auth.accessToken,
        TRI_PROS_CALENDAR_NAME,
      )

      // Store calendar ID on account
      await db.update(account)
        .set({ gcalCalendarId: calendar.id })
        .where(eq(account.id, auth.accountId))

      // Initial sync — pull existing GCal events (if any)
      const eventList = await googleCalendarClient.listEvents(auth.accessToken, calendar.id)

      // Store sync token
      await db.update(account)
        .set({ gcalSyncToken: eventList.nextSyncToken ?? null })
        .where(eq(account.id, auth.accountId))

      // Push existing meetings with scheduledFor to GCal
      const userMeetings = await db.select().from(meetings).where(
        and(eq(meetings.ownerId, userId), isNotNull(meetings.scheduledFor)),
      )

      for (const meeting of userMeetings) {
        const payload = meetingToGCalEvent({
          id: meeting.id,
          scheduledFor: meeting.scheduledFor,
          customerName: null, // Would need join — initial sync can use basic info
          meetingType: meeting.meetingType,
          agentNotes: meeting.agentNotes,
        })

        if (payload) {
          const created = await googleCalendarClient.createEvent(auth.accessToken, calendar.id, payload)
          await db.update(meetings)
            .set({
              gcalEventId: created.id,
              gcalEtag: created.etag,
              gcalSyncedAt: new Date().toISOString(),
            })
            .where(eq(meetings.id, meeting.id))
        }
      }

      // Push syncable activities
      const userActivities = await db.select().from(activities).where(
        and(eq(activities.ownerId, userId), isNotNull(activities.scheduledFor)),
      )

      for (const activity of userActivities) {
        if (!gcalSyncableActivityTypes.includes(activity.type as any)) {
          continue
        }

        const payload = activityToGCalEvent(activity)
        if (payload) {
          const created = await googleCalendarClient.createEvent(auth.accessToken, calendar.id, payload)
          await db.update(activities)
            .set({
              gcalEventId: created.id,
              gcalEtag: created.etag,
              gcalSyncedAt: new Date().toISOString(),
            })
            .where(eq(activities.id, activity.id))
        }
      }

      // Register webhook
      const webhookUrl = `${env.NEXT_PUBLIC_BASE_URL}/api/google-calendar/webhook`
      const channelId = crypto.randomUUID()
      const watchResponse = await googleCalendarClient.watchEvents(
        auth.accessToken,
        calendar.id,
        webhookUrl,
        channelId,
      )

      await db.update(account)
        .set({
          gcalChannelId: channelId,
          gcalChannelExpiry: new Date(Number(watchResponse.expiration)).toISOString(),
        })
        .where(eq(account.id, auth.accountId))

      return { calendarId: calendar.id }
    },

    /**
     * Disconnect Google Calendar.
     * Stops webhook, clears GCal state.
     */
    disconnectCalendar: async (userId: string): Promise<void> => {
      const auth = await getAccessTokenForUser(userId)
      if (!auth) {
        return
      }

      const row = await db.query.account.findFirst({
        where: eq(account.id, auth.accountId),
      })

      // Stop webhook if active
      if (row?.gcalChannelId) {
        await googleCalendarClient.stopWatch(auth.accessToken, row.gcalChannelId, '').catch(() => {})
      }

      // Clear GCal columns on account
      await db.update(account)
        .set({
          gcalCalendarId: null,
          gcalSyncToken: null,
          gcalChannelId: null,
          gcalChannelExpiry: null,
        })
        .where(eq(account.id, auth.accountId))

      // Clear GCal references on meetings
      await db.update(meetings)
        .set({ gcalEventId: null, gcalEtag: null, gcalSyncedAt: null })
        .where(eq(meetings.ownerId, userId))

      // Clear GCal references on activities
      await db.update(activities)
        .set({ gcalEventId: null, gcalEtag: null, gcalSyncedAt: null })
        .where(eq(activities.ownerId, userId))
    },

    /**
     * Push a local entity change to Google Calendar.
     * Called after tRPC mutations on meetings/activities.
     */
    pushToGCal: async (
      userId: string,
      entityType: 'meeting' | 'activity',
      entityId: string,
    ): Promise<void> => {
      const auth = await getAccessTokenForUser(userId)
      if (!auth) {
        return
      }

      const acct = await db.query.account.findFirst({
        where: eq(account.id, auth.accountId),
      })

      if (!acct?.gcalCalendarId) {
        return // Calendar not connected
      }

      const calendarId = acct.gcalCalendarId

      if (entityType === 'meeting') {
        const meeting = await db.query.meetings.findFirst({
          where: eq(meetings.id, entityId),
        })
        if (!meeting) {
          return
        }

        const payload = meetingToGCalEvent({
          id: meeting.id,
          scheduledFor: meeting.scheduledFor,
          meetingType: meeting.meetingType,
          agentNotes: meeting.agentNotes,
        })

        if (!payload) {
          // No scheduledFor — delete from GCal if it existed
          if (meeting.gcalEventId) {
            await googleCalendarClient.deleteEvent(auth.accessToken, calendarId, meeting.gcalEventId)
            await db.update(meetings)
              .set({ gcalEventId: null, gcalEtag: null, gcalSyncedAt: null })
              .where(eq(meetings.id, entityId))
          }
          return
        }

        if (meeting.gcalEventId) {
          // Update existing
          const updated = await googleCalendarClient.updateEvent(
            auth.accessToken,
            calendarId,
            meeting.gcalEventId,
            payload,
            meeting.gcalEtag ?? undefined,
          )
          await db.update(meetings)
            .set({ gcalEtag: updated.etag, gcalSyncedAt: new Date().toISOString() })
            .where(eq(meetings.id, entityId))
        } else {
          // Create new
          const created = await googleCalendarClient.createEvent(auth.accessToken, calendarId, payload)
          await db.update(meetings)
            .set({
              gcalEventId: created.id,
              gcalEtag: created.etag,
              gcalSyncedAt: new Date().toISOString(),
            })
            .where(eq(meetings.id, entityId))
        }
      }

      if (entityType === 'activity') {
        const activity = await db.query.activities.findFirst({
          where: eq(activities.id, entityId),
        })
        if (!activity) {
          return
        }

        // Only syncable types get pushed to GCal
        const isSyncable = gcalSyncableActivityTypes.includes(activity.type as any)
          || (activity.type === 'task' && activity.scheduledFor)

        if (!isSyncable) {
          return
        }

        const payload = activityToGCalEvent(activity)

        if (!payload) {
          if (activity.gcalEventId) {
            await googleCalendarClient.deleteEvent(auth.accessToken, calendarId, activity.gcalEventId)
            await db.update(activities)
              .set({ gcalEventId: null, gcalEtag: null, gcalSyncedAt: null })
              .where(eq(activities.id, entityId))
          }
          return
        }

        if (activity.gcalEventId) {
          const updated = await googleCalendarClient.updateEvent(
            auth.accessToken,
            calendarId,
            activity.gcalEventId,
            payload,
            activity.gcalEtag ?? undefined,
          )
          await db.update(activities)
            .set({ gcalEtag: updated.etag, gcalSyncedAt: new Date().toISOString() })
            .where(eq(activities.id, entityId))
        } else {
          const created = await googleCalendarClient.createEvent(auth.accessToken, calendarId, payload)
          await db.update(activities)
            .set({
              gcalEventId: created.id,
              gcalEtag: created.etag,
              gcalSyncedAt: new Date().toISOString(),
            })
            .where(eq(activities.id, entityId))
        }
      }
    },

    /**
     * Handle inbound sync from GCal (webhook or poll).
     * Fetches changed events via syncToken, upserts locally.
     */
    handleInboundSync: async (userId: string): Promise<void> => {
      const auth = await getAccessTokenForUser(userId)
      if (!auth) {
        return
      }

      const acct = await db.query.account.findFirst({
        where: eq(account.id, auth.accountId),
      })

      if (!acct?.gcalCalendarId) {
        return
      }

      let eventList
      try {
        eventList = await googleCalendarClient.listEvents(
          auth.accessToken,
          acct.gcalCalendarId,
          acct.gcalSyncToken ?? undefined,
        )
      } catch (err) {
        if (err instanceof GCalSyncTokenExpiredError) {
          // Full re-sync needed — clear sync token and retry without it
          await db.update(account)
            .set({ gcalSyncToken: null })
            .where(eq(account.id, auth.accountId))

          eventList = await googleCalendarClient.listEvents(
            auth.accessToken,
            acct.gcalCalendarId,
          )
        } else {
          throw err
        }
      }

      for (const gcalEvent of eventList.items) {
        // Check if this GCal event is linked to a meeting
        const linkedMeeting = await db.query.meetings.findFirst({
          where: eq(meetings.gcalEventId, gcalEvent.id),
        })

        if (linkedMeeting) {
          if (gcalEvent.status === 'cancelled') {
            // Event deleted in GCal — clear the link but keep the meeting
            await db.update(meetings)
              .set({ gcalEventId: null, gcalEtag: null, gcalSyncedAt: null })
              .where(eq(meetings.id, linkedMeeting.id))
            continue
          }

          if (!hasRemoteChanged(linkedMeeting.gcalEtag, gcalEvent.etag)) {
            continue // No change
          }

          const winner = resolveConflict(linkedMeeting.updatedAt, gcalEvent.updated)
          if (winner === 'remote') {
            const local = gcalEventToLocal(gcalEvent)
            await db.update(meetings)
              .set({
                scheduledFor: local.scheduledFor,
                gcalEtag: local.gcalEtag,
                gcalSyncedAt: new Date().toISOString(),
              })
              .where(eq(meetings.id, linkedMeeting.id))
          } else {
            // Local wins — update etag only (our data is already correct)
            await db.update(meetings)
              .set({ gcalEtag: gcalEvent.etag, gcalSyncedAt: new Date().toISOString() })
              .where(eq(meetings.id, linkedMeeting.id))
          }
          continue
        }

        // Check if linked to an activity
        const linkedActivity = await db.query.activities.findFirst({
          where: eq(activities.gcalEventId, gcalEvent.id),
        })

        if (linkedActivity) {
          if (gcalEvent.status === 'cancelled') {
            await db.delete(activities).where(eq(activities.id, linkedActivity.id))
            continue
          }

          if (!hasRemoteChanged(linkedActivity.gcalEtag, gcalEvent.etag)) {
            continue
          }

          const winner = resolveConflict(linkedActivity.updatedAt, gcalEvent.updated)
          if (winner === 'remote') {
            const local = gcalEventToLocal(gcalEvent)
            await db.update(activities)
              .set({
                title: local.title,
                description: local.description,
                scheduledFor: local.scheduledFor,
                gcalEtag: local.gcalEtag,
                gcalSyncedAt: new Date().toISOString(),
              })
              .where(eq(activities.id, linkedActivity.id))
          } else {
            await db.update(activities)
              .set({ gcalEtag: gcalEvent.etag, gcalSyncedAt: new Date().toISOString() })
              .where(eq(activities.id, linkedActivity.id))
          }
          continue
        }

        // Unknown event — created in GCal directly. Create as local activity.
        if (gcalEvent.status !== 'cancelled') {
          const local = gcalEventToLocal(gcalEvent)
          await db.insert(activities).values({
            type: 'event',
            title: local.title,
            description: local.description,
            scheduledFor: local.scheduledFor,
            ownerId: userId,
            gcalEventId: local.gcalEventId,
            gcalEtag: local.gcalEtag,
            gcalSyncedAt: new Date().toISOString(),
            metaJSON: { location: local.location, allDay: local.allDay },
          })
        }
      }

      // Store new sync token
      if (eventList.nextSyncToken) {
        await db.update(account)
          .set({ gcalSyncToken: eventList.nextSyncToken })
          .where(eq(account.id, auth.accountId))
      }
    },

    /**
     * Handle webhook notification from Google.
     * Verifies channel and delegates to inbound sync.
     */
    handleWebhookNotification: async (channelId: string): Promise<void> => {
      // Find the account with this channel
      const acct = await db.query.account.findFirst({
        where: eq(account.gcalChannelId, channelId),
      })

      if (!acct) {
        return // Unknown channel — ignore
      }

      await schedulingService.handleInboundSync(acct.userId)
    },

    /**
     * Renew webhook channel if expiring within 24 hours.
     * Called by the safety-net cron job.
     */
    renewChannelIfNeeded: async (userId: string): Promise<void> => {
      const auth = await getAccessTokenForUser(userId)
      if (!auth) {
        return
      }

      const acct = await db.query.account.findFirst({
        where: eq(account.id, auth.accountId),
      })

      if (!acct?.gcalCalendarId || !acct.gcalChannelExpiry) {
        return
      }

      const expiryTime = new Date(acct.gcalChannelExpiry).getTime()
      const twentyFourHoursFromNow = Date.now() + 24 * 60 * 60 * 1000

      if (expiryTime > twentyFourHoursFromNow) {
        return // Not expiring soon
      }

      // Stop old channel
      if (acct.gcalChannelId) {
        await googleCalendarClient.stopWatch(auth.accessToken, acct.gcalChannelId, '').catch(() => {})
      }

      // Create new channel
      const webhookUrl = `${env.NEXT_PUBLIC_BASE_URL}/api/google-calendar/webhook`
      const newChannelId = crypto.randomUUID()
      const watchResponse = await googleCalendarClient.watchEvents(
        auth.accessToken,
        acct.gcalCalendarId,
        webhookUrl,
        newChannelId,
      )

      await db.update(account)
        .set({
          gcalChannelId: newChannelId,
          gcalChannelExpiry: new Date(Number(watchResponse.expiration)).toISOString(),
        })
        .where(eq(account.id, auth.accountId))
    },

    /** Get sync status for a user */
    getSyncStatus: async (userId: string): Promise<{
      connected: boolean
      calendarId: string | null
      lastSynced: string | null
      channelExpiry: string | null
    }> => {
      const acct = await db.query.account.findFirst({
        where: and(eq(account.userId, userId), eq(account.providerId, 'google')),
      })

      return {
        connected: !!acct?.gcalCalendarId,
        calendarId: acct?.gcalCalendarId ?? null,
        lastSynced: acct?.gcalSyncToken ? new Date().toISOString() : null,
        channelExpiry: acct?.gcalChannelExpiry ?? null,
      }
    },

    scheduleFollowUp: async (_params: { proposalId: string, delayMs: number }): Promise<void> => {
      // TODO: Implement with QStash delayed job
      throw new Error('schedulingService.scheduleFollowUp not implemented')
    },

    scheduleMeetingReminder: async (_params: { meetingId: string, reminderAt: string }): Promise<void> => {
      // TODO: Implement with QStash scheduled job
      throw new Error('schedulingService.scheduleMeetingReminder not implemented')
    },

    cancelScheduled: async (_params: { jobId: string }): Promise<void> => {
      // TODO: Implement QStash job cancellation
      throw new Error('schedulingService.cancelScheduled not implemented')
    },
  }
}

export type SchedulingService = ReturnType<typeof createSchedulingService>
export const schedulingService = createSchedulingService()
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No type errors. Some `account` column references may fail if the schema hasn't been pushed yet — ensure Task 2 is done first.

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/scheduling.service.ts
git commit -m "feat(schedule): expand scheduling service with GCal sync engine"
```

---

## Task 10: tRPC Router — Activities CRUD

**Files:**
- Create: `src/trpc/routers/schedule.router/activities.router.ts`

- [ ] **Step 1: Create activities router**

Create `src/trpc/routers/schedule.router/activities.router.ts`:

```typescript
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { activityEntityTypes, activityTypes } from '@/shared/constants/enums'
import { db } from '@/shared/db'
import { activities } from '@/shared/db/schema/activities'
import { user } from '@/shared/db/schema/auth'
import { schedulingService } from '@/shared/services/scheduling.service'
import { createTRPCRouter } from '@/trpc/init'
import { agentProcedure } from '@/trpc/init'

export const activitiesRouter = createTRPCRouter({
  getAll: agentProcedure.query(async ({ ctx }) => {
    const isSuperAdmin = ctx.ability.can('manage', 'all')
    const where = isSuperAdmin ? undefined : eq(activities.ownerId, ctx.session.user.id)

    const rows = await db.select({
      activity: activities,
      ownerName: user.name,
      ownerImage: user.image,
    })
      .from(activities)
      .leftJoin(user, eq(activities.ownerId, user.id))
      .where(where)
      .orderBy(desc(activities.createdAt))

    return rows.map(r => ({
      ...r.activity,
      ownerName: r.ownerName,
      ownerImage: r.ownerImage,
    }))
  }),

  getById: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const row = await db.query.activities.findFirst({
        where: eq(activities.id, input.id),
      })
      return row ?? null
    }),

  create: agentProcedure
    .input(z.object({
      type: z.enum(activityTypes),
      title: z.string().min(1),
      description: z.string().nullish(),
      entityType: z.enum(activityEntityTypes).nullish(),
      entityId: z.string().uuid().nullish(),
      scheduledFor: z.string().nullish(),
      dueAt: z.string().nullish(),
      metaJSON: z.any().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [created] = await db.insert(activities)
        .values({
          type: input.type,
          title: input.title,
          description: input.description ?? null,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          ownerId: ctx.session.user.id,
          scheduledFor: input.scheduledFor ?? null,
          dueAt: input.dueAt ?? null,
          metaJSON: input.metaJSON ?? null,
        })
        .returning()

      // Push to GCal if syncable
      if (created.scheduledFor) {
        await schedulingService.pushToGCal(ctx.session.user.id, 'activity', created.id)
          .catch(console.error) // Don't fail the mutation if sync fails
      }

      return created
    }),

  update: agentProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1).optional(),
      description: z.string().nullish(),
      type: z.enum(activityTypes).optional(),
      entityType: z.enum(activityEntityTypes).nullish(),
      entityId: z.string().uuid().nullish(),
      scheduledFor: z.string().nullish(),
      dueAt: z.string().nullish(),
      metaJSON: z.any().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input

      const [updated] = await db.update(activities)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(and(
          eq(activities.id, id),
          ctx.ability.can('manage', 'all') ? undefined : eq(activities.ownerId, ctx.session.user.id),
        ))
        .returning()

      if (updated) {
        await schedulingService.pushToGCal(ctx.session.user.id, 'activity', id)
          .catch(console.error)
      }

      return updated
    }),

  complete: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db.update(activities)
        .set({
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(and(
          eq(activities.id, input.id),
          ctx.ability.can('manage', 'all') ? undefined : eq(activities.ownerId, ctx.session.user.id),
        ))
        .returning()

      return updated
    }),

  delete: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Get activity first to check GCal link
      const activity = await db.query.activities.findFirst({
        where: eq(activities.id, input.id),
      })

      if (!activity) {
        throw new Error('Activity not found')
      }

      // Delete from GCal if linked
      if (activity.gcalEventId) {
        await schedulingService.pushToGCal(ctx.session.user.id, 'activity', input.id)
          .catch(console.error)
      }

      await db.delete(activities)
        .where(and(
          eq(activities.id, input.id),
          ctx.ability.can('manage', 'all') ? undefined : eq(activities.ownerId, ctx.session.user.id),
        ))

      return { deleted: true }
    }),
})
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/trpc/routers/schedule.router/activities.router.ts
git commit -m "feat(schedule): add activities tRPC router with CRUD"
```

---

## Task 11: tRPC Router — Sync + Compose

**Files:**
- Create: `src/trpc/routers/schedule.router/sync.router.ts`
- Create: `src/trpc/routers/schedule.router/index.ts`
- Modify: `src/trpc/routers/app.ts`

- [ ] **Step 1: Create sync router**

Create `src/trpc/routers/schedule.router/sync.router.ts`:

```typescript
import { schedulingService } from '@/shared/services/scheduling.service'
import { createTRPCRouter } from '@/trpc/init'
import { agentProcedure } from '@/trpc/init'

export const syncRouter = createTRPCRouter({
  getSyncStatus: agentProcedure.query(async ({ ctx }) => {
    return schedulingService.getSyncStatus(ctx.session.user.id)
  }),

  connectCalendar: agentProcedure.mutation(async ({ ctx }) => {
    return schedulingService.connectCalendar(ctx.session.user.id)
  }),

  disconnectCalendar: agentProcedure.mutation(async ({ ctx }) => {
    await schedulingService.disconnectCalendar(ctx.session.user.id)
    return { disconnected: true }
  }),

  triggerSync: agentProcedure.mutation(async ({ ctx }) => {
    await schedulingService.handleInboundSync(ctx.session.user.id)
    return { synced: true }
  }),
})
```

- [ ] **Step 2: Create schedule router index**

Create `src/trpc/routers/schedule.router/index.ts`:

```typescript
import { createTRPCRouter } from '@/trpc/init'

import { activitiesRouter } from './activities.router'
import { syncRouter } from './sync.router'

export const scheduleRouter = createTRPCRouter({
  activities: activitiesRouter,
  sync: syncRouter,
})
```

- [ ] **Step 3: Register schedule router in app.ts**

In `src/trpc/routers/app.ts`, add the import and register:

```typescript
import { scheduleRouter } from './schedule.router'
```

Add to the router object:

```typescript
  scheduleRouter,
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/trpc/routers/schedule.router/ src/trpc/routers/app.ts
git commit -m "feat(schedule): add schedule tRPC router (activities + sync)"
```

---

## Task 12: Webhook Route + QStash Jobs

**Files:**
- Create: `src/app/api/google-calendar/webhook/route.ts`
- Create: `src/shared/services/upstash/jobs/sync-calendars.ts`
- Create: `src/shared/services/upstash/jobs/initial-calendar-sync.ts`
- Modify: `src/app/api/qstash-jobs/route.ts`

- [ ] **Step 1: Create webhook route**

Create `src/app/api/google-calendar/webhook/route.ts`:

```typescript
import { NextResponse } from 'next/server'

import { schedulingService } from '@/shared/services/scheduling.service'

/**
 * Google Calendar push notification handler.
 * Google sends POST with headers (no body) when events change.
 * See: https://developers.google.com/calendar/api/guides/push
 */
export async function POST(request: Request) {
  const channelId = request.headers.get('X-Goog-Channel-ID')
  const resourceState = request.headers.get('X-Goog-Resource-State')

  if (!channelId) {
    return NextResponse.json({ error: 'Missing channel ID' }, { status: 400 })
  }

  // Ignore sync messages (sent when channel is first created)
  if (resourceState === 'sync') {
    return NextResponse.json({ ok: true })
  }

  try {
    await schedulingService.handleWebhookNotification(channelId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[GCal Webhook] Error handling notification:', error)
    return NextResponse.json({ ok: true }) // Always return 200 to avoid Google retries
  }
}
```

- [ ] **Step 2: Create sync-calendars QStash job**

Create `src/shared/services/upstash/jobs/sync-calendars.ts`:

```typescript
import { and, eq, isNotNull } from 'drizzle-orm'

import { db } from '@/shared/db'
import { account } from '@/shared/db/schema/auth'
import { schedulingService } from '@/shared/services/scheduling.service'

import { createJob } from '../lib/create-job'

/**
 * Safety-net cron job: runs every 15 minutes.
 * - Incremental sync for all connected accounts
 * - Renew webhook channels expiring within 24 hours
 */
export const syncCalendarsJob = createJob<Record<string, never>>(
  'sync-calendars',
  async () => {
    const connectedAccounts = await db.select()
      .from(account)
      .where(and(
        eq(account.providerId, 'google'),
        isNotNull(account.gcalCalendarId),
      ))

    for (const acct of connectedAccounts) {
      try {
        await schedulingService.handleInboundSync(acct.userId)
        await schedulingService.renewChannelIfNeeded(acct.userId)
      } catch (error) {
        console.error(`[sync-calendars] Failed for user ${acct.userId}:`, error)
      }
    }
  },
)
```

- [ ] **Step 3: Create initial-calendar-sync QStash job**

Create `src/shared/services/upstash/jobs/initial-calendar-sync.ts`:

```typescript
import { schedulingService } from '@/shared/services/scheduling.service'

import { createJob } from '../lib/create-job'

/**
 * One-shot job: triggered when a user first connects Google Calendar.
 * Dispatched by the sync.connectCalendar tRPC mutation if needed.
 */
export const initialCalendarSyncJob = createJob<{ userId: string }>(
  'initial-calendar-sync',
  async (payload) => {
    await schedulingService.connectCalendar(payload.userId)
  },
)
```

- [ ] **Step 4: Register jobs in QStash route handler**

In `src/app/api/qstash-jobs/route.ts`, add imports:

```typescript
import { syncCalendarsJob } from '@/shared/services/upstash/jobs/sync-calendars'
import { initialCalendarSyncJob } from '@/shared/services/upstash/jobs/initial-calendar-sync'
```

Add to the job registry map (wherever the other jobs are registered):

```typescript
jobs.set(syncCalendarsJob.key, syncCalendarsJob.handler)
jobs.set(initialCalendarSyncJob.key, initialCalendarSyncJob.handler)
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add src/app/api/google-calendar/ src/shared/services/upstash/jobs/sync-calendars.ts src/shared/services/upstash/jobs/initial-calendar-sync.ts src/app/api/qstash-jobs/route.ts
git commit -m "feat(schedule): add GCal webhook route and QStash sync jobs"
```

---

## Task 13: Data Migration Script

**Files:**
- Create: `src/shared/db/migrations/migrate-notes-to-activities.ts`

- [ ] **Step 1: Create idempotent migration script**

Create `src/shared/db/migrations/migrate-notes-to-activities.ts`:

```typescript
/**
 * Phase 2: Migrate customer_notes and meetings.agentNotes into activities table.
 *
 * Run: pnpm tsx src/shared/db/migrations/migrate-notes-to-activities.ts
 *
 * This script is idempotent — safe to re-run. It checks for existing
 * activity records before inserting to avoid duplicates.
 */

import { and, eq, isNotNull, sql } from 'drizzle-orm'

import { db } from '@/shared/db'
import { activities } from '@/shared/db/schema/activities'
import { customerNotes } from '@/shared/db/schema/customer-notes'
import { meetings } from '@/shared/db/schema/meetings'

async function migrateCustomerNotes() {
  console.log('--- Migrating customer_notes -> activities ---')

  const notes = await db.select().from(customerNotes)
  console.log(`Found ${notes.length} customer notes to migrate`)

  let migrated = 0
  let skipped = 0

  for (const note of notes) {
    // Idempotency check: look for existing activity
    const existing = await db.query.activities.findFirst({
      where: and(
        eq(activities.entityType, 'customer'),
        eq(activities.entityId, note.customerId),
        eq(activities.type, 'note'),
        eq(activities.description, note.content),
      ),
    })

    if (existing) {
      skipped++
      continue
    }

    const firstLine = note.content.split('\n')[0]?.slice(0, 80) ?? 'Customer Note'

    await db.insert(activities).values({
      type: 'note',
      title: firstLine,
      description: note.content,
      entityType: 'customer',
      entityId: note.customerId,
      ownerId: note.authorId ?? 'system', // fallback if authorId is null
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    })

    migrated++
  }

  console.log(`  Migrated: ${migrated}, Skipped (already exists): ${skipped}`)
}

async function migrateMeetingAgentNotes() {
  console.log('--- Migrating meetings.agentNotes -> activities ---')

  const meetingsWithNotes = await db.select()
    .from(meetings)
    .where(isNotNull(meetings.agentNotes))

  console.log(`Found ${meetingsWithNotes.length} meetings with agent notes`)

  let migrated = 0
  let skipped = 0

  for (const meeting of meetingsWithNotes) {
    if (!meeting.agentNotes) {
      continue
    }

    // Idempotency check
    const existing = await db.query.activities.findFirst({
      where: and(
        eq(activities.entityType, 'meeting'),
        eq(activities.entityId, meeting.id),
        eq(activities.type, 'note'),
        eq(activities.description, meeting.agentNotes),
      ),
    })

    if (existing) {
      skipped++
      continue
    }

    const firstLine = meeting.agentNotes.split('\n')[0]?.slice(0, 80) ?? 'Meeting Note'

    await db.insert(activities).values({
      type: 'note',
      title: firstLine,
      description: meeting.agentNotes,
      entityType: 'meeting',
      entityId: meeting.id,
      ownerId: meeting.ownerId,
      createdAt: meeting.createdAt,
      updatedAt: meeting.updatedAt,
    })

    migrated++
  }

  console.log(`  Migrated: ${migrated}, Skipped (already exists): ${skipped}`)
}

async function main() {
  console.log('=== Notes to Activities Migration (Phase 2) ===\n')

  await migrateCustomerNotes()
  await migrateMeetingAgentNotes()

  console.log('\n=== Migration complete ===')
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Commit (do NOT run yet — Phase 2 is run after Phase 1 schema push)**

```bash
git add src/shared/db/migrations/migrate-notes-to-activities.ts
git commit -m "feat(schedule): add notes-to-activities data migration script"
```

---

## Task 14: Schedule Management Feature — Types & Constants

**Files:**
- Create: `src/features/schedule-management/types/index.ts`
- Create: `src/features/schedule-management/constants/schedule-calendar-config.ts`
- Create: `src/features/schedule-management/constants/activity-filter-config.ts`
- Create: `src/features/schedule-management/constants/activity-table-columns.ts`
- Create: `src/features/schedule-management/lib/to-calendar-event.ts`
- Create: `src/features/schedule-management/hooks/use-schedule-filters.ts`

- [ ] **Step 1: Create schedule event types**

Create `src/features/schedule-management/types/index.ts`:

```typescript
import type { CalendarEvent } from '@/shared/components/calendar/types'
import type { ActivityType } from '@/shared/constants/enums'
import type { MeetingOutcome } from '@/shared/constants/enums'

export interface ScheduleMeetingEvent extends CalendarEvent {
  kind: 'meeting'
  meetingId: string
  meetingType: string | null
  meetingOutcome: MeetingOutcome
  customerId: string | null
  ownerId: string
  ownerName: string | null
  ownerImage: string | null
  customerName: string | null
  customerPhone: string | null
  customerAddress: string | null
  customerCity: string | null
  customerState: string | null
  customerZip: string | null
  createdAt: string
}

export interface ScheduleActivityEvent extends CalendarEvent {
  kind: 'activity'
  activityId: string
  activityType: ActivityType
  description: string | null
  entityType: string | null
  entityId: string | null
  ownerId: string
  ownerName: string | null
  dueAt: string | null
  completedAt: string | null
}

export type ScheduleCalendarEvent = ScheduleMeetingEvent | ScheduleActivityEvent

/** Active tab in table view mode */
export type ScheduleTableTab = 'meetings' | 'activities'
```

- [ ] **Step 2: Create calendar config constants**

Create `src/features/schedule-management/constants/schedule-calendar-config.ts`:

```typescript
import type { ActivityType } from '@/shared/constants/enums'

/** Background tint classes for activity events on the calendar */
export const ACTIVITY_TYPE_BG_TINTS: Record<ActivityType, string> = {
  note: 'bg-blue-500/5 border-blue-500/20',
  reminder: 'bg-amber-500/5 border-amber-500/20',
  task: 'bg-emerald-500/5 border-emerald-500/20',
  event: 'bg-purple-500/5 border-purple-500/20',
}
```

- [ ] **Step 3: Create activity filter config**

Create `src/features/schedule-management/constants/activity-filter-config.ts`:

```typescript
import type { DataTableFilterConfig } from '@/shared/components/data-table/types'

import { activityEntityTypes, activityTypes } from '@/shared/constants/enums'
import { DEFAULT_TIME_PRESETS } from '@/shared/components/data-table/constants'

export const activityFilterConfig: DataTableFilterConfig[] = [
  {
    type: 'search',
    columnId: 'title',
    placeholder: 'Search activities...',
  },
  {
    type: 'select',
    columnId: 'type',
    label: 'Type',
    options: activityTypes.map(t => ({ label: t.charAt(0).toUpperCase() + t.slice(1), value: t })),
  },
  {
    type: 'select',
    columnId: 'entityType',
    label: 'Linked To',
    options: activityEntityTypes.map(t => ({ label: t.charAt(0).toUpperCase() + t.slice(1), value: t })),
  },
  {
    type: 'time-preset',
    columnId: 'scheduledFor',
    label: 'Scheduled',
    presets: DEFAULT_TIME_PRESETS,
  },
]
```

- [ ] **Step 4: Create activity table columns**

Create `src/features/schedule-management/constants/activity-table-columns.ts`:

```typescript
import type { ColumnDef } from '@tanstack/react-table'

import { ACTIVITY_TYPE_CONFIG } from '@/shared/entities/activities/constants'

interface ActivityRow {
  id: string
  type: string
  title: string
  description: string | null
  entityType: string | null
  entityId: string | null
  ownerId: string
  ownerName: string | null
  ownerImage: string | null
  scheduledFor: string | null
  dueAt: string | null
  completedAt: string | null
  createdAt: string
}

export const activityColumns: ColumnDef<ActivityRow>[] = [
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ getValue }) => {
      const type = getValue<string>() as keyof typeof ACTIVITY_TYPE_CONFIG
      const config = ACTIVITY_TYPE_CONFIG[type]
      return config?.label ?? type
    },
    size: 100,
  },
  {
    accessorKey: 'title',
    header: 'Title',
    size: 250,
  },
  {
    accessorKey: 'entityType',
    header: 'Linked To',
    cell: ({ getValue }) => {
      const val = getValue<string | null>()
      return val ? val.charAt(0).toUpperCase() + val.slice(1) : '—'
    },
    size: 120,
  },
  {
    accessorKey: 'scheduledFor',
    header: 'Scheduled',
    cell: ({ getValue }) => {
      const val = getValue<string | null>()
      return val ? new Date(val).toLocaleDateString() : '—'
    },
    size: 140,
  },
  {
    accessorKey: 'dueAt',
    header: 'Due',
    cell: ({ getValue }) => {
      const val = getValue<string | null>()
      return val ? new Date(val).toLocaleDateString() : '—'
    },
    size: 140,
  },
  {
    accessorKey: 'completedAt',
    header: 'Status',
    cell: ({ getValue }) => {
      const val = getValue<string | null>()
      return val ? 'Done' : 'Open'
    },
    size: 80,
  },
  {
    accessorKey: 'ownerName',
    header: 'Owner',
    size: 140,
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ getValue }) => new Date(getValue<string>()).toLocaleDateString(),
    size: 120,
  },
]
```

- [ ] **Step 5: Create activity-to-calendar-event mapper**

Create `src/features/schedule-management/lib/to-calendar-event.ts`:

```typescript
import type { ScheduleActivityEvent } from '../types'

interface ActivityRow {
  id: string
  type: string
  title: string
  description: string | null
  entityType: string | null
  entityId: string | null
  ownerId: string
  ownerName: string | null
  scheduledFor: string | null
  dueAt: string | null
  completedAt: string | null
  createdAt: string
}

export function activityToCalendarEvent(activity: ActivityRow): ScheduleActivityEvent {
  return {
    kind: 'activity',
    id: activity.id,
    activityId: activity.id,
    activityType: activity.type as ScheduleActivityEvent['activityType'],
    startAt: activity.scheduledFor ?? activity.dueAt ?? activity.createdAt,
    title: activity.title,
    description: activity.description,
    entityType: activity.entityType,
    entityId: activity.entityId,
    ownerId: activity.ownerId,
    ownerName: activity.ownerName,
    dueAt: activity.dueAt,
    completedAt: activity.completedAt,
  }
}
```

- [ ] **Step 6: Create schedule filters hook**

Create `src/features/schedule-management/hooks/use-schedule-filters.ts`:

```typescript
import { useCallback } from 'react'

import { usePersistedState } from '@/shared/hooks/use-persisted-state'
import { STORAGE_KEYS } from '@/shared/constants/storage-keys'

import type { ScheduleTableTab } from '../types'

// Add to STORAGE_KEYS if not present:
// SCHEDULE_TABLE_TAB: 'tri-pros:schedule-table-tab'

export function useScheduleTableTab() {
  const [tab, setTab] = usePersistedState<ScheduleTableTab>(
    'tri-pros:schedule-table-tab',
    'meetings',
  )

  const handleTabChange = useCallback((newTab: ScheduleTableTab) => {
    setTab(newTab)
  }, [setTab])

  return { tab, setTab: handleTabChange }
}
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No type errors

- [ ] **Step 8: Commit**

```bash
git add src/features/schedule-management/
git commit -m "feat(schedule): add schedule-management feature types, constants, and hooks"
```

---

## Task 15: Generalize Calendar Components

**Files:**
- Move + modify: `meeting-flow/ui/components/calendar/meeting-calendar.tsx` -> `schedule-management/ui/components/schedule-calendar.tsx`
- Move + modify: `meeting-flow/ui/components/calendar/meeting-today-view.tsx` -> `schedule-management/ui/components/schedule-today-view.tsx`
- Move + modify: `meeting-flow/ui/components/calendar/meeting-week-view.tsx` -> `schedule-management/ui/components/schedule-week-view.tsx`
- Move + modify: `meeting-flow/ui/components/calendar/meeting-calendar-dot.tsx` -> `schedule-management/ui/components/schedule-calendar-dot.tsx`

This is a large refactoring task. The key changes for each component:

1. Replace `MeetingCalendarEvent` with `ScheduleCalendarEvent` in all type signatures
2. Rename components from `Meeting*` to `Schedule*`
3. The `renderCard` and `renderCompact` prop patterns are already generic — they just need the type parameter updated
4. Add event type filtering (show/hide meetings, events, reminders, tasks)

- [ ] **Step 1: Copy and rename calendar files**

Copy each file from `meeting-flow/ui/components/calendar/` to `schedule-management/ui/components/`, renaming:

```bash
cp src/features/meeting-flow/ui/components/calendar/meeting-calendar.tsx src/features/schedule-management/ui/components/schedule-calendar.tsx
cp src/features/meeting-flow/ui/components/calendar/meeting-today-view.tsx src/features/schedule-management/ui/components/schedule-today-view.tsx
cp src/features/meeting-flow/ui/components/calendar/meeting-week-view.tsx src/features/schedule-management/ui/components/schedule-week-view.tsx
cp src/features/meeting-flow/ui/components/calendar/meeting-calendar-dot.tsx src/features/schedule-management/ui/components/schedule-calendar-dot.tsx
```

- [ ] **Step 2: Update schedule-calendar.tsx**

In `src/features/schedule-management/ui/components/schedule-calendar.tsx`:

- Replace all `MeetingCalendarEvent` references with `ScheduleCalendarEvent`
- Rename the component export from `MeetingCalendar` to `ScheduleCalendar`
- Update imports to use `ScheduleCalendarEvent` from `@/features/schedule-management/types`
- Replace `MeetingTodayView` with `ScheduleTodayView`, `MeetingWeekView` with `ScheduleWeekView`, `MeetingCalendarDot` with `ScheduleCalendarDot`
- Update the import paths to local `./schedule-today-view`, `./schedule-week-view`, `./schedule-calendar-dot`
- The `renderCard` prop already accepts a generic event — just update the type parameter
- Add an `eventTypeFilter` prop: `readonly string[]` controlling which event kinds are visible. The component filters `events` before passing to sub-views.

- [ ] **Step 3: Update schedule-today-view.tsx**

In `src/features/schedule-management/ui/components/schedule-today-view.tsx`:

- Replace `MeetingCalendarEvent` with `ScheduleCalendarEvent`
- Rename export from `MeetingTodayView` to `ScheduleTodayView`
- Update imports

- [ ] **Step 4: Update schedule-week-view.tsx**

In `src/features/schedule-management/ui/components/schedule-week-view.tsx`:

- Replace `MeetingCalendarEvent` with `ScheduleCalendarEvent`
- Rename export from `MeetingWeekView` to `ScheduleWeekView`
- Update imports

- [ ] **Step 5: Update schedule-calendar-dot.tsx**

In `src/features/schedule-management/ui/components/schedule-calendar-dot.tsx`:

- Replace `MeetingCalendarEvent` with `ScheduleCalendarEvent`
- Rename export from `MeetingCalendarDot` to `ScheduleCalendarDot`
- Update to handle both `kind: 'meeting'` and `kind: 'activity'` events in the popover display
- For activity events, show activity type icon + title instead of meeting-specific fields

- [ ] **Step 6: Delete old meeting calendar files**

```bash
rm src/features/meeting-flow/ui/components/calendar/meeting-calendar.tsx
rm src/features/meeting-flow/ui/components/calendar/meeting-today-view.tsx
rm src/features/meeting-flow/ui/components/calendar/meeting-week-view.tsx
rm src/features/meeting-flow/ui/components/calendar/meeting-calendar-dot.tsx
```

- [ ] **Step 7: Update any imports in meeting-flow that referenced the old calendar components**

Search for imports of the deleted files and update them. The main consumer is `meetings-view.tsx` which will be replaced by `schedule-view.tsx` (Task 16), so most references will be eliminated. If `meeting-flow.tsx` or other meeting-flow views reference these components, update their imports to point to `schedule-management`.

- [ ] **Step 8: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No type errors

- [ ] **Step 9: Commit**

```bash
git add src/features/schedule-management/ui/components/ src/features/meeting-flow/ui/components/calendar/
git commit -m "refactor(schedule): generalize calendar components from meeting-specific to multi-entity"
```

---

## Task 16: Schedule View + Route

**Files:**
- Create: `src/features/schedule-management/ui/views/schedule-view.tsx`
- Create: `src/features/schedule-management/ui/components/activities-table.tsx`
- Create: `src/features/schedule-management/ui/components/activity-calendar-card.tsx`
- Create: `src/features/schedule-management/ui/components/sync-status-badge.tsx`
- Create: `src/features/schedule-management/ui/components/activity-form.tsx`
- Create: `src/app/(frontend)/dashboard/schedule/page.tsx`
- Modify: `src/app/(frontend)/dashboard/meetings/page.tsx`
- Modify: `src/features/agent-dashboard/lib/get-sidebar-nav.ts`

This is the main UI task. It replaces the existing `MeetingsView` with the new `schedule-view.tsx`.

- [ ] **Step 1: Create sync status badge**

Create `src/features/schedule-management/ui/components/sync-status-badge.tsx`:

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { CloudIcon, CloudOffIcon, RefreshCwIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { useTRPC } from '@/trpc/helpers'
import { cn } from '@/shared/lib/utils'

export function SyncStatusBadge() {
  const trpc = useTRPC()
  const syncStatus = useQuery(trpc.scheduleRouter.sync.getSyncStatus.queryOptions())

  if (syncStatus.isLoading) {
    return null
  }

  const connected = syncStatus.data?.connected ?? false

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
          {connected
            ? <CloudIcon size={14} className="text-emerald-500" />
            : <CloudOffIcon size={14} className="text-muted-foreground" />}
          <span className={cn('hidden sm:inline', connected ? 'text-emerald-600' : 'text-muted-foreground')}>
            {connected ? 'Synced' : 'Not Connected'}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {connected ? 'Google Calendar connected and syncing' : 'Click to connect Google Calendar'}
      </TooltipContent>
    </Tooltip>
  )
}
```

- [ ] **Step 2: Create activity calendar card**

Create `src/features/schedule-management/ui/components/activity-calendar-card.tsx`:

```typescript
'use client'

import type { ScheduleActivityEvent } from '@/features/schedule-management/types'

import { ACTIVITY_TYPE_CONFIG } from '@/shared/entities/activities/constants'
import { ACTIVITY_TYPE_BG_TINTS } from '@/features/schedule-management/constants/schedule-calendar-config'
import { cn } from '@/shared/lib/utils'

interface ActivityCalendarCardProps {
  event: ScheduleActivityEvent
}

export function ActivityCalendarCard({ event }: ActivityCalendarCardProps) {
  const config = ACTIVITY_TYPE_CONFIG[event.activityType]
  const Icon = config.icon
  const bgTint = ACTIVITY_TYPE_BG_TINTS[event.activityType]

  return (
    <div className={cn(
      'group relative flex h-full flex-col gap-1 overflow-hidden rounded-md border p-2 text-xs cursor-pointer transition-colors hover:border-foreground/20',
      bgTint,
    )}>
      <div className="flex items-center gap-1.5 min-w-0">
        <Icon size={12} className={config.color} />
        <span className="font-medium truncate flex-1 leading-tight">{event.title}</span>
      </div>
      {event.description && (
        <p className="text-[11px] text-muted-foreground truncate">{event.description}</p>
      )}
      {event.completedAt && (
        <span className="text-[10px] text-emerald-500 font-medium">Completed</span>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create activities table**

Create `src/features/schedule-management/ui/components/activities-table.tsx`:

```typescript
'use client'

import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@/trpc/routers/app'

import { useCallback } from 'react'

import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { activityColumns } from '@/features/schedule-management/constants/activity-table-columns'
import { activityFilterConfig } from '@/features/schedule-management/constants/activity-filter-config'

type ActivityRow = inferRouterOutputs<AppRouter>['scheduleRouter']['activities']['getAll'][number]

interface ActivitiesTableProps {
  data: ActivityRow[]
  onFilteredDataChange?: (data: ActivityRow[]) => void
}

export function ActivitiesTable({ data, onFilteredDataChange }: ActivitiesTableProps) {
  const handleFilteredDataChange = useCallback(
    (filtered: ActivityRow[]) => onFilteredDataChange?.(filtered),
    [onFilteredDataChange],
  )

  return (
    <DataTable
      data={data}
      columns={activityColumns}
      filters={activityFilterConfig}
      defaultSort={[{ id: 'createdAt', desc: true }]}
      onFilteredDataChange={handleFilteredDataChange}
    />
  )
}
```

- [ ] **Step 4: Create activity form (modal)**

Create `src/features/schedule-management/ui/components/activity-form.tsx`:

```typescript
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { z } from 'zod'

import { activityEntityTypes, activityTypes } from '@/shared/constants/enums'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import { useTRPC } from '@/trpc/helpers'

interface ActivityFormProps {
  isOpen: boolean
  onClose: () => void
  /** Pre-fill entity link (e.g., from a customer profile) */
  defaultEntityType?: string
  defaultEntityId?: string
}

export function ActivityForm({
  isOpen,
  onClose,
  defaultEntityType,
  defaultEntityId,
}: ActivityFormProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const [type, setType] = useState<string>('note')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [entityType, setEntityType] = useState(defaultEntityType ?? '')
  const [entityId, setEntityId] = useState(defaultEntityId ?? '')
  const [scheduledFor, setScheduledFor] = useState('')
  const [dueAt, setDueAt] = useState('')

  const createActivity = useMutation(trpc.scheduleRouter.activities.create.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.scheduleRouter.activities.getAll.queryKey() })
      onClose()
      resetForm()
    },
  }))

  function resetForm() {
    setType('note')
    setTitle('')
    setDescription('')
    setEntityType(defaultEntityType ?? '')
    setEntityId(defaultEntityId ?? '')
    setScheduledFor('')
    setDueAt('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    createActivity.mutate({
      type: type as z.infer<typeof z.enum<typeof activityTypes>>,
      title,
      description: description || null,
      entityType: entityType ? (entityType as any) : null,
      entityId: entityId || null,
      scheduledFor: scheduledFor || null,
      dueAt: dueAt || null,
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Activity</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="activity-type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="activity-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activityTypes.map(t => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="activity-title">Title</Label>
            <Input
              id="activity-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Activity title..."
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="activity-description">Description</Label>
            <Textarea
              id="activity-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
            />
          </div>

          {(type === 'event' || type === 'reminder') && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="activity-scheduled">Scheduled For</Label>
              <Input
                id="activity-scheduled"
                type="datetime-local"
                value={scheduledFor}
                onChange={e => setScheduledFor(e.target.value ? new Date(e.target.value).toISOString() : '')}
              />
            </div>
          )}

          {type === 'task' && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="activity-due">Due Date</Label>
              <Input
                id="activity-due"
                type="datetime-local"
                value={dueAt}
                onChange={e => setDueAt(e.target.value ? new Date(e.target.value).toISOString() : '')}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="activity-entity-type">Link To</Label>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger id="activity-entity-type">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {activityEntityTypes.map(t => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {entityType && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="activity-entity-id">Entity ID</Label>
              <Input
                id="activity-entity-id"
                value={entityId}
                onChange={e => setEntityId(e.target.value)}
                placeholder="UUID of linked entity"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createActivity.isPending}>
              {createActivity.isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 5: Create schedule-view.tsx**

Create `src/features/schedule-management/ui/views/schedule-view.tsx`. This is the main view that replaces `MeetingsView`. It follows the same layout structure but adds:

- Contextual tabs: calendar mode shows Today/Week/Month, table mode shows Meetings/Activities
- Combined calendar with meetings + activities
- Activities table under the Activities tab
- Sync status badge
- New Activity button

The full implementation should mirror `meetings-view.tsx` structure but:
1. Query both `meetingsRouter.getAll` and `scheduleRouter.activities.getAll`
2. Map both to `ScheduleCalendarEvent[]` using their respective `toCalendarEvent` functions
3. Pass combined events to `ScheduleCalendar`
4. In table mode, render `PastMeetingsTable` or `ActivitiesTable` based on active tab
5. Add `useScheduleTableTab()` hook for tab state
6. Add `SyncStatusBadge` and "New Activity" button to controls bar

This component is complex — the implementing agent should read the existing `meetings-view.tsx` line by line and follow its patterns exactly, with the additions described above.

- [ ] **Step 6: Create schedule page route**

Create `src/app/(frontend)/dashboard/schedule/page.tsx`:

```typescript
import { redirect } from 'next/navigation'

import { ScheduleView } from '@/features/schedule-management/ui/views/schedule-view'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function SchedulePage() {
  const result = await protectDashboardPage()

  if (result.status === 'unauthenticated') {
    redirect('/api/auth/signin')
  }

  return <ScheduleView />
}
```

- [ ] **Step 7: Redirect old meetings route**

Replace the contents of `src/app/(frontend)/dashboard/meetings/page.tsx` with:

```typescript
import { redirect } from 'next/navigation'

export default function MeetingsPage() {
  redirect('/dashboard/schedule')
}
```

- [ ] **Step 8: Update sidebar nav**

In `src/features/agent-dashboard/lib/get-sidebar-nav.ts`, find the "Meetings" nav item and update:

- Change `label` from `'Meetings'` to `'Schedule'`
- Change `href` from `'/dashboard/meetings'` to `'/dashboard/schedule'`
- Keep the same icon and permission check (`can('read', 'Meeting')`)

- [ ] **Step 9: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No type errors

- [ ] **Step 10: Verify lint passes**

Run: `pnpm lint`
Expected: No errors

- [ ] **Step 11: Commit**

```bash
git add src/features/schedule-management/ui/ src/app/(frontend)/dashboard/schedule/ src/app/(frontend)/dashboard/meetings/page.tsx src/features/agent-dashboard/lib/get-sidebar-nav.ts
git commit -m "feat(schedule): add schedule view, route, and sidebar nav update"
```

---

## Task 17: Activity Entity Hooks

**Files:**
- Create: `src/shared/entities/activities/hooks/use-activity-actions.ts`
- Create: `src/shared/entities/activities/hooks/use-activity-action-configs.ts`

- [ ] **Step 1: Create activity mutation hooks**

Create `src/shared/entities/activities/hooks/use-activity-actions.ts`:

```typescript
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useTRPC } from '@/trpc/helpers'

export function useActivityActions() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  function invalidateActivities() {
    queryClient.invalidateQueries({ queryKey: trpc.scheduleRouter.activities.getAll.queryKey() })
  }

  const deleteActivity = useMutation(trpc.scheduleRouter.activities.delete.mutationOptions({
    onSuccess: () => {
      toast.success('Activity deleted')
      invalidateActivities()
    },
    onError: () => toast.error('Failed to delete activity'),
  }))

  const completeActivity = useMutation(trpc.scheduleRouter.activities.complete.mutationOptions({
    onSuccess: () => {
      toast.success('Activity marked complete')
      invalidateActivities()
    },
    onError: () => toast.error('Failed to complete activity'),
  }))

  const updateActivity = useMutation(trpc.scheduleRouter.activities.update.mutationOptions({
    onSuccess: () => {
      toast.success('Activity updated')
      invalidateActivities()
    },
    onError: () => toast.error('Failed to update activity'),
  }))

  return { deleteActivity, completeActivity, updateActivity }
}
```

- [ ] **Step 2: Create activity action configs**

Create `src/shared/entities/activities/hooks/use-activity-action-configs.ts`:

```typescript
'use client'

import type { EntityActionConfig } from '@/shared/components/entity-actions/types'

import { useMemo } from 'react'

import { ACTIVITY_ACTIONS } from '@/shared/entities/activities/constants'
import { useConfirm } from '@/shared/hooks/use-confirm'

import { useActivityActions } from './use-activity-actions'

interface ActivityActionEvent {
  activityId: string
  activityType: string
}

interface ActivityActionOverrides {
  onView?: (event: ActivityActionEvent) => void
}

export function useActivityActionConfigs(overrides: ActivityActionOverrides = {}) {
  const { deleteActivity, completeActivity } = useActivityActions()
  const { confirm, ConfirmDialog: DeleteConfirmDialog } = useConfirm({
    title: 'Delete Activity',
    description: 'This action cannot be undone.',
    confirmLabel: 'Delete',
    variant: 'destructive',
  })

  const actions: EntityActionConfig<ActivityActionEvent>[] = useMemo(() => [
    {
      ...ACTIVITY_ACTIONS.view,
      onClick: (event: ActivityActionEvent) => overrides.onView?.(event),
    },
    {
      ...ACTIVITY_ACTIONS.complete,
      onClick: (event: ActivityActionEvent) => {
        completeActivity.mutate({ id: event.activityId })
      },
    },
    {
      ...ACTIVITY_ACTIONS.delete,
      onClick: async (event: ActivityActionEvent) => {
        const confirmed = await confirm()
        if (confirmed) {
          deleteActivity.mutate({ id: event.activityId })
        }
      },
    },
  ], [overrides, completeActivity, deleteActivity, confirm])

  return { actions, DeleteConfirmDialog }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/activities/hooks/
git commit -m "feat(schedule): add activity entity hooks (actions + configs)"
```

---

## Task 18: Integration Verification

- [ ] **Step 1: Run full type check**

Run: `pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Expected: No errors

- [ ] **Step 3: Start dev server and verify routes**

Run: `pnpm dev`

Verify:
- `/dashboard/schedule` renders the schedule view
- `/dashboard/meetings` redirects to `/dashboard/schedule`
- Sidebar shows "Schedule" instead of "Meetings"
- Calendar mode shows Today/Week/Month tabs
- Table mode shows Meetings/Activities tabs
- Activities table renders (even if empty)
- Sync status badge appears
- "New Activity" button opens the activity form
- Creating an activity works and appears in the table

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(schedule): integration fixes from manual verification"
```

---

## Task 19: Phase 2 — Run Data Migration (Production)

This task runs AFTER Phase 1 (schema push) is deployed to production.

- [ ] **Step 1: Run migration script against dev database**

Run: `pnpm tsx src/shared/db/migrations/migrate-notes-to-activities.ts`
Expected: Logs showing migrated/skipped counts for customer notes and meeting agent notes

- [ ] **Step 2: Verify migrated data**

Check the activities table has the expected notes by querying the database.

- [ ] **Step 3: Re-run to verify idempotency**

Run: `pnpm tsx src/shared/db/migrations/migrate-notes-to-activities.ts`
Expected: All records show as "Skipped (already exists)"

---

## Task 20: Phase 3 — Drop Legacy Note Sources

This task runs AFTER Phase 2 migration is verified and all code references to `customer_notes` and `meetings.agentNotes` are updated to use activities.

- [ ] **Step 1: Search for remaining references to customer_notes**

```bash
grep -r "customerNotes\|customer_notes\|customer-notes" src/ --include="*.ts" --include="*.tsx"
```

Update or remove any remaining references.

- [ ] **Step 2: Search for remaining references to agentNotes**

```bash
grep -r "agentNotes\|agent_notes" src/ --include="*.ts" --include="*.tsx"
```

Update or remove any remaining references.

- [ ] **Step 3: Remove customer-notes schema**

Delete `src/shared/db/schema/customer-notes.ts` and remove its export from `src/shared/db/schema/index.ts`.

- [ ] **Step 4: Remove agentNotes column from meetings schema**

In `src/shared/db/schema/meetings.ts`, remove the `agentNotes: text('agent_notes')` column.

- [ ] **Step 5: Push schema changes**

Run: `pnpm db:push:dev`
Expected: `customer_notes` table dropped, `agent_notes` column dropped from `meetings`

- [ ] **Step 6: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No type errors

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(schedule): drop legacy customer_notes table and meetings.agentNotes column (Phase 3)"
```
