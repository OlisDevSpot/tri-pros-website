# Schedule Management Feature Design

**Date:** 2026-04-15
**Status:** Draft
**Replaces:** `/dashboard/meetings` flat meeting list

## Overview

Transform the dashboard meetings tab into a full schedule management system backed by bidirectional Google Calendar sync. The schedule displays both **meetings** (existing) and **activities** (new: notes, reminders, tasks, events). A sync engine keeps the local schedule and each agent's Google Calendar in sync using webhooks with a polling safety net.

### Goals

1. Replace `/dashboard/meetings` with `/dashboard/schedule`
2. Introduce an `activities` table that becomes the single source of truth for notes, reminders, tasks, and events — consolidating `customer_notes` and `meetings.agentNotes`
3. Build a Google Calendar service + bidirectional sync engine
4. Generalize the existing calendar UI components to render any schedule event type, not just meetings

### Non-Goals

- Google Tasks API integration (tasks stay app-only unless they have a `scheduledFor`)
- Public-facing schedule (this is agent-only)
- Modifying the meeting flow (`/dashboard/meetings/[meetingId]`) — that stays as-is

---

## 1. Google Calendar Service

### Architecture

Two layers, following the `contract.service.ts` / `zoho-sign/` pattern:

- **`src/shared/services/google-calendar/`** — Raw Google Calendar REST API client. Handles auth headers, endpoint URLs, request/response serialization. No business logic.
- **`src/shared/services/scheduling.service.ts`** — Business-facing service (expanded from existing stub). Orchestrates sync, maps entities to/from GCal events, handles conflict resolution. Called by tRPC routers and QStash jobs.

### Google Calendar Client (`google-calendar/`)

```
src/shared/services/google-calendar/
  client.ts        # GoogleCalendarClient — raw CRUD + watch + sync
  types.ts         # GCal API request/response types
  lib/
    map-to-gcal.ts     # Meeting/Activity -> GCal event payload
    map-from-gcal.ts   # GCal event -> local upsert shape
    conflict.ts        # Last-write-wins comparator (etag + timestamps)
```

**`client.ts` methods:**
- `createCalendar(accessToken, title)` — creates secondary "Tri Pros Schedule" calendar
- `listEvents(accessToken, calendarId, syncToken?)` — incremental fetch via `syncToken`
- `getEvent(accessToken, calendarId, eventId)` — single event fetch
- `createEvent(accessToken, calendarId, event)` — create, returns `gcalEventId` + `gcalEtag`
- `updateEvent(accessToken, calendarId, eventId, event, etag)` — update with etag for conflict detection
- `deleteEvent(accessToken, calendarId, eventId)` — delete
- `watchEvents(accessToken, calendarId, webhookUrl, channelId)` — register push notification channel
- `stopWatch(accessToken, channelId, resourceId)` — unregister channel

All methods accept `accessToken` as first param. Token refresh uses existing `refreshAccessToken()` from `google-drive/lib/`.

### Scheduling Service (`scheduling.service.ts`)

Expanded from current stub. Business methods:

- `connectCalendar(userId)` — create secondary calendar, initial full sync, register webhook
- `disconnectCalendar(userId)` — stop webhook, clear GCal columns on account, clear `gcalEventId` on local records
- `pushToGCal(userId, entityType, entityId)` — outbound: map entity to GCal event, create/update/delete
- `handleInboundSync(userId)` — pull changes via `syncToken`, upsert locally with conflict resolution
- `handleWebhookNotification(channelId, resourceId)` — verify channel, delegate to `handleInboundSync`
- `scheduleFollowUp(params)` — existing stub, now implemented
- `scheduleMeetingReminder(params)` — existing stub, now implemented
- `cancelScheduled(params)` — existing stub, now implemented

### OAuth Scope Changes

In `src/shared/domains/auth/server.ts`, add to Google provider scopes:

```
'https://www.googleapis.com/auth/calendar.events'
```

Existing users will re-consent on next login (Google provider already has `prompt: 'consent'`). This scope allows full read/write on events across all calendars the user has access to, including the secondary calendar we create.

---

## 2. Data Model

### New Table: `activities`

```sql
activities (
  id                UUID PK DEFAULT random
  type              activity_type_enum NOT NULL        -- 'note' | 'reminder' | 'task' | 'event'
  title             TEXT NOT NULL
  description       TEXT nullable
  entityType        activity_entity_type_enum nullable -- 'customer' | 'meeting' | 'project' | 'proposal'
  entityId          UUID nullable
  ownerId           TEXT NOT NULL FK -> user.id
  scheduledFor      TIMESTAMP TZ nullable              -- when it happens (events, reminders)
  dueAt             TIMESTAMP TZ nullable              -- deadline (tasks)
  completedAt       TIMESTAMP TZ nullable              -- when marked done (tasks)
  gcalEventId       TEXT nullable                      -- Google Calendar event ID
  gcalEtag          TEXT nullable                      -- GCal etag for conflict detection
  gcalSyncedAt      TIMESTAMP TZ nullable              -- last successful sync timestamp
  metaJSON          JSONB nullable                     -- type-specific data
  createdAt         TIMESTAMP TZ DEFAULT now
  updatedAt         TIMESTAMP TZ DEFAULT now
)
```

### New Columns on `meetings`

```sql
ALTER TABLE meetings ADD COLUMN gcal_event_id TEXT;
ALTER TABLE meetings ADD COLUMN gcal_etag TEXT;
ALTER TABLE meetings ADD COLUMN gcal_synced_at TIMESTAMP WITH TIME ZONE;
```

### New Columns on `account` (better-auth)

```sql
ALTER TABLE account ADD COLUMN gcal_calendar_id TEXT;
ALTER TABLE account ADD COLUMN gcal_sync_token TEXT;
ALTER TABLE account ADD COLUMN gcal_channel_id TEXT;
ALTER TABLE account ADD COLUMN gcal_channel_expiry TIMESTAMP WITH TIME ZONE;
```

### New Enums

In `src/shared/db/schema/meta.ts`:
```typescript
export const activityTypeEnum = pgEnum('activity_type', activityTypes)
export const activityEntityTypeEnum = pgEnum('activity_entity_type', activityEntityTypes)
```

Const arrays in `src/shared/constants/enums/activities.ts`:
```typescript
export const activityTypes = ['note', 'reminder', 'task', 'event'] as const
export const activityEntityTypes = ['customer', 'meeting', 'project', 'proposal'] as const
```

Types in `src/shared/types/enums/activities.ts`:
```typescript
export type ActivityType = (typeof activityTypes)[number]
export type ActivityEntityType = (typeof activityEntityTypes)[number]
```

### Activity Meta Schema (Discriminated Union)

In `src/shared/entities/activities/schemas/index.ts`:

```typescript
// Discriminated by activity type
note:     { source?: 'agent' | 'system' }
reminder: { reminderMinutesBefore?: number }
task:     { priority?: 'low' | 'medium' | 'high' }
event:    { location?: string, allDay?: boolean }
```

### GCal Sync Rules

Which activity types sync to Google Calendar:
- **meetings** — always (have `scheduledFor`)
- **events** — always (have `scheduledFor`)
- **reminders** — yes (have `scheduledFor`)
- **tasks** — only if they have a `scheduledFor` timestamp
- **notes** — never (timeless)

---

## 3. Migration Strategy (3 Phases)

### Phase 1: Schema Push

- Create `activities` table
- Add GCal columns to `meetings` table
- Add GCal columns to `account` table
- `customer_notes` table and `meetings.agentNotes` column remain intact

### Phase 2: Data Migration

Run an idempotent migration script:

1. Read all `customer_notes` rows -> insert as activities:
   - `type: 'note'`
   - `entityType: 'customer'`
   - `entityId: customerId`
   - `ownerId: authorId`
   - `title: 'Customer Note'` (or first line of content)
   - `description: content`

2. Read all `meetings` where `agentNotes IS NOT NULL` -> insert as activities:
   - `type: 'note'`
   - `entityType: 'meeting'`
   - `entityId: meetingId`
   - `ownerId: ownerId` (meeting owner)
   - `title: 'Meeting Note'` (or first line of agentNotes)
   - `description: agentNotes`

Idempotency: check for existing activity with matching `entityType` + `entityId` + `title` before inserting.

### Phase 3: Drop

After verifying migration and updating all code references:
- Drop `customer_notes` table
- Drop `meetings.agentNotes` column
- Update all UI/tRPC code that referenced these to use activities

---

## 4. Sync Engine

### Sync Lifecycle

**First connection (per user):**
1. Agent clicks "Connect Google Calendar" in schedule view
2. `schedulingService.connectCalendar(userId)` is called
3. Creates "Tri Pros Schedule" secondary calendar on their Google account
4. Stores `gcalCalendarId` on the `account` row
5. Full initial sync: pull all existing GCal events, push all local meetings/activities with `scheduledFor`
6. Stores `gcalSyncToken` on account
7. Registers webhook channel -> stores `gcalChannelId` + `gcalChannelExpiry`

**Outbound (local write -> GCal):**
1. Agent creates/updates/deletes a meeting or syncable activity
2. tRPC mutation calls `schedulingService.pushToGCal(userId, entityType, entityId)`
3. Service maps entity to GCal event payload via `map-to-gcal.ts`
4. Calls `googleCalendarClient.createEvent()` / `.updateEvent()` / `.deleteEvent()`
5. Stores `gcalEventId`, `gcalEtag`, `gcalSyncedAt` on the local record
6. On 409 conflict: fetch latest from GCal, apply last-write-wins, retry

**Inbound (GCal -> local):**
1. Google sends POST to `/api/google-calendar/webhook`
2. Route verifies `X-Goog-Channel-ID` + `X-Goog-Resource-ID` against stored channel
3. Calls `schedulingService.handleInboundSync(userId)`
4. Service calls `googleCalendarClient.listEvents(syncToken)` for incremental changes
5. For each changed event:
   - Match by `gcalEventId` on meetings/activities
   - If found: compare `gcalEtag` — if different, apply last-write-wins using `updatedAt` vs GCal `updated` timestamp
   - If not found + event created in GCal: create new activity with `type: 'event'`
   - If event deleted in GCal: soft-mark or delete local record
6. Stores new `gcalSyncToken`

**Safety net (QStash cron — every 15 minutes):**
1. `sync-calendars` job iterates all accounts with `gcalCalendarId`
2. Calls `schedulingService.handleInboundSync(userId)` for each
3. Checks `gcalChannelExpiry` — if within 24 hours, renews webhook channel

**Webhook channel renewal:**
- Channels expire (~1 week, Google default)
- Safety net cron detects near-expiry
- Calls `googleCalendarClient.watchEvents()` to create new channel
- Stops old channel, stores new `gcalChannelId` + `gcalChannelExpiry`

### Conflict Resolution

**Strategy:** Last-write-wins with etag-based conflict detection.

- Every local write updates `updatedAt` and `gcalSyncedAt`
- Every GCal event has an `etag` and `updated` timestamp
- On inbound sync, if `gcalEtag` differs from stored:
  - Compare local `updatedAt` vs GCal `updated`
  - Most recent timestamp wins
  - Winner's data overwrites loser
- Outbound pushes include the stored `etag` — GCal returns 409 if stale, triggering re-fetch + resolution

### API Routes

```
src/app/api/google-calendar/
  webhook/
    route.ts    # POST handler for Google push notifications
```

### QStash Jobs (added to existing registry)

```
sync-calendars         # Cron: every 15 min — incremental sync + channel renewal
initial-calendar-sync  # One-shot: triggered on first GCal connection
```

---

## 5. Route & UI Structure

### Route Change

- `/dashboard/meetings` -> `/dashboard/schedule` (new route, new page)
- `/dashboard/meetings/[meetingId]` stays as-is (meeting flow untouched)
- Sidebar nav item: "Meetings" (CalendarIcon) -> "Schedule" (CalendarIcon)

### Schedule View Layout

The schedule view preserves the exact layout structure of the current `MeetingsView`:

**Top bar:** StatBar (left) + controls (right)

**Controls (right side):**
- PipelineScopeToggle (`all` / `fresh` / `projects`)
- **Contextual tab group** (same button group position):
  - Calendar mode: `Today` / `Week` / `Month` tabs (existing behavior)
  - Table mode: `Meetings` / `Activities` tabs (new — each shows full-screen table)
- Days filter (calendar week mode only, existing)
- DataViewTypeToggle (calendar / table, existing)
- "New Activity" button
- GCal sync status badge

**Main area (full height):**
- **Calendar mode:** Unified calendar rendering both meetings and activities as color-coded events. Event type filter (show/hide: meetings, events, reminders, tasks) available as a filter popover.
- **Table mode:** Full-screen table, switched by `Meetings` / `Activities` tabs. Only one table visible at a time.

### Calendar Component Generalization

The existing meeting-specific calendar components move from `meeting-flow/ui/components/calendar/` to `schedule-management/ui/components/` and are generalized:

| Before (meeting-flow) | After (schedule-management) |
|---|---|
| `MeetingCalendar` | `ScheduleCalendar` |
| `MeetingTodayView` | `ScheduleTodayView` |
| `MeetingWeekView` | `ScheduleWeekView` |
| `MeetingCalendarDot` | `ScheduleCalendarDot` |

These components accept a `ScheduleCalendarEvent` (discriminated union of meeting + activity shapes) instead of `MeetingCalendarEvent`. The `renderCard` prop pattern is already in place — card rendering varies by event type.

**What stays in `meeting-flow/`:**
- Meeting flow views (step flow, intake, etc.)
- Meeting-specific card rendering logic (passed as `renderCard` to schedule calendar)
- Meeting table columns
- `toCalendarEvent()` for meetings (maps meeting row -> `ScheduleCalendarEvent`)

**What lives in `schedule-management/`:**
- Generalized calendar shell components
- Schedule view (replaces `MeetingsView`)
- Activity card rendering
- Event type filtering
- `toCalendarEvent()` for activities
- Activities table

---

## 6. Feature & Entity Module Structure

### Entity Module: `src/shared/entities/activities/`

```
activities/
  schemas/
    index.ts                      # activityMetaSchema, selectActivitySchema, insertActivitySchema
  constants/
    index.ts                      # ACTIVITY_ACTIONS, ACTIVITY_TYPE_CONFIG (icon/label/color per type)
  hooks/
    use-activity-actions.ts       # CRUD mutations
    use-activity-action-configs.ts # Action menu configs
  types/
    index.ts                      # Activity, InsertActivity, ActivityType, ActivityEntityType
```

### Feature Module: `src/features/schedule-management/`

```
schedule-management/
  constants/
    activity-table-columns.ts     # TanStack column defs for activities table
    activity-filter-config.ts     # DataTableFilterConfig[] for activities
    schedule-calendar-config.ts   # Color mappings, event type visual config
  hooks/
    use-schedule-filters.ts       # nuqs URL state for table mode active tab
  lib/
    to-calendar-event.ts          # Activity -> ScheduleCalendarEvent
  types/
    index.ts                      # ScheduleCalendarEvent (discriminated union)
  ui/
    views/
      schedule-view.tsx           # Main view
    components/
      schedule-calendar.tsx       # Unified calendar (meetings + activities)
      schedule-today-view.tsx     # Generalized from MeetingTodayView
      schedule-week-view.tsx      # Generalized from MeetingWeekView
      schedule-calendar-dot.tsx   # Generalized from MeetingCalendarDot
      activities-table.tsx        # Activities table (full-screen in table mode)
      activity-form.tsx           # Create/edit activity modal
      activity-calendar-card.tsx  # Activity card for calendar day/week views
      sync-status-badge.tsx       # GCal connection & sync state indicator
```

### tRPC Router: `src/trpc/routers/schedule.router/`

```
schedule.router/
  index.ts                # Composes sub-routers
  activities.router.ts    # create, update, delete, getAll, getById, complete (mark task done)
  sync.router.ts          # connectCalendar, disconnectCalendar, triggerSync, getSyncStatus
```

Existing `meetingsRouter` stays untouched.

---

## 7. Permissions

Extend CASL permission model:

| Permission | Agents | Super-Admin |
|---|---|---|
| `read.Activity` | Own activities | All activities |
| `create.Activity` | Yes | Yes |
| `update.Activity` | Own only | All |
| `delete.Activity` | Own only | All |
| `manage.Calendar` | Yes (own) | Yes (all) |

Homeowners and `user` role do not see the schedule.

---

## 8. File Changes Summary

### New Files

- `src/shared/services/google-calendar/client.ts`
- `src/shared/services/google-calendar/types.ts`
- `src/shared/services/google-calendar/lib/map-to-gcal.ts`
- `src/shared/services/google-calendar/lib/map-from-gcal.ts`
- `src/shared/services/google-calendar/lib/conflict.ts`
- `src/shared/db/schema/activities.ts`
- `src/shared/constants/enums/activities.ts`
- `src/shared/types/enums/activities.ts`
- `src/shared/entities/activities/` (full entity module)
- `src/features/schedule-management/` (full feature module)
- `src/trpc/routers/schedule.router/` (router directory)
- `src/app/(frontend)/dashboard/schedule/page.tsx`
- `src/app/api/google-calendar/webhook/route.ts`

### Modified Files

- `src/shared/services/scheduling.service.ts` — expand from stub to full implementation
- `src/shared/domains/auth/server.ts` — add `calendar.events` scope
- `src/shared/db/schema/meetings.ts` — add GCal sync columns
- `src/shared/db/schema/auth.ts` — add GCal state columns to account table
- `src/shared/db/schema/index.ts` — export new activities schema
- `src/shared/constants/enums/index.ts` — export activity enums
- `src/shared/types/enums/index.ts` — export activity types
- `src/shared/permissions/` — add Activity and Calendar subjects
- `src/features/agent-dashboard/lib/get-sidebar-nav.ts` — rename "Meetings" to "Schedule", update route
- `src/trpc/routers/app.ts` — register scheduleRouter
- `src/shared/services/upstash/` — register new QStash jobs
- `src/app/(frontend)/dashboard/meetings/page.tsx` — add `redirect('/dashboard/schedule')` so bookmarks and links don't break

### Deleted Files (Phase 3 of migration)

- `src/shared/db/schema/customer-notes.ts`
- `src/features/meeting-flow/ui/components/calendar/meeting-calendar.tsx` (moved + generalized)
- `src/features/meeting-flow/ui/components/calendar/meeting-today-view.tsx` (moved + generalized)
- `src/features/meeting-flow/ui/components/calendar/meeting-week-view.tsx` (moved + generalized)
- `src/features/meeting-flow/ui/components/calendar/meeting-calendar-dot.tsx` (moved + generalized)
- `src/features/meeting-flow/ui/views/meetings-view.tsx` (replaced by schedule-view)
