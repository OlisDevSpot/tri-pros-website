# Schedule Management — DAL Extraction

## Context

The `scheduling.service.ts` and `sync-calendars.ts` job violate Rule 19 of our coding conventions: **services and jobs must use DAL, never direct DB calls.** Currently, `scheduling.service.ts` directly imports `db` + schema tables (`account`, `meetings`, `activities`, `customers`) and runs 15+ inline queries/mutations throughout the file. The `sync-calendars.ts` QStash job also directly queries the `account` table.

This was a pragmatic shortcut during initial implementation. The service works correctly — this is a code organization refactor, not a bug fix.

## What needs to happen

### 1. Create DAL functions in `src/shared/dal/server/`

**`src/shared/dal/server/accounts/google-calendar.ts`** — Account-level GCal operations:
- `getGoogleAccountForUser(userId)` — find account by userId + providerId='google', return full row
- `updateAccountGCalFields(accountId, fields)` — update gcalCalendarId, gcalSyncToken, gcalChannelId, gcalChannelExpiry, accessToken, accessTokenExpiresAt
- `clearAccountGCalFields(accountId)` — set all gcal fields to null
- `getAccountsWithGCalEnabled()` — all accounts where gcalCalendarId is not null (for sync-calendars job)
- `getAccountByChannelId(channelId)` — find account by gcalChannelId (for webhook handler)

**`src/shared/dal/server/meetings/google-calendar.ts`** — Meeting GCal operations:
- `getMeetingForGCal(meetingId)` — the existing `getMeetingForGCal` function (JOIN with customers, includes flowStateJSON trade selections, gcalEventId, gcalEtag)
- `getMeetingsByOwnerWithSchedule(userId)` — meetings with scheduledFor for a user (used in connectCalendar)
- `getMeetingByGCalEventId(gcalEventId)` — find meeting linked to a GCal event (used in inbound sync)
- `updateMeetingGCalFields(meetingId, fields)` — update gcalEventId, gcalEtag, gcalSyncedAt
- `clearMeetingGCalFields(meetingId)` — set gcal fields to null
- `clearAllMeetingGCalFieldsForUser(userId)` — bulk clear for disconnect
- `updateMeetingScheduledFor(meetingId, scheduledFor)` — update scheduledFor (inbound sync)

**`src/shared/dal/server/activities/google-calendar.ts`** — Activity GCal operations:
- `getSyncableActivitiesForUser(userId)` — activities with scheduledFor for syncable types
- `getActivityByGCalEventId(gcalEventId)` — find activity linked to a GCal event
- `updateActivityGCalFields(activityId, fields)` — update gcalEventId, gcalEtag, gcalSyncedAt
- `clearActivityGCalFields(activityId)` — set gcal fields to null
- `clearAllActivityGCalFieldsForUser(userId)` — bulk clear for disconnect
- `updateActivityFromGCal(activityId, fields)` — update scheduledFor only (inbound sync, app-authoritative)
- `createActivityFromGCalEvent(data)` — insert new activity from unknown GCal event
- `deleteActivity(activityId)` — delete (for cancelled GCal events)

### 2. Refactor `scheduling.service.ts`

Replace all direct `db.*` calls with the DAL functions above. The service should:
- Import ONLY from `@/shared/dal/server/` (accounts, meetings, activities)
- Import from `./google-calendar/` (client, mapping, conflict)
- Import from `@/shared/config/server-env` (env)
- Import from `@/shared/services/google-drive/lib/refresh-access-token` (token refresh)
- NO longer import `db`, `account`, `meetings`, `activities`, `customers` from schema

### 3. Refactor `sync-calendars.ts`

Replace the direct `db.select().from(account)` query with `getAccountsWithGCalEnabled()` from the DAL.

### 4. All DAL functions must have explicit return type annotations (Rule 15)

## How to verify

```bash
# After refactoring, these imports should NOT exist in scheduling.service.ts:
grep "from '@/shared/db'" src/shared/services/scheduling.service.ts
# Should return nothing

# And not in the job:
grep "from '@/shared/db'" src/shared/services/upstash/jobs/sync-calendars.ts
# Should return nothing

# TypeScript should compile:
pnpm tsc --noEmit

# Lint should pass:
pnpm lint
```

## Files to create/modify

- Create: `src/shared/dal/server/accounts/google-calendar.ts`
- Create: `src/shared/dal/server/meetings/google-calendar.ts`
- Create: `src/shared/dal/server/activities/google-calendar.ts`
- Modify: `src/shared/services/scheduling.service.ts` (remove all direct DB imports, use DAL)
- Modify: `src/shared/services/upstash/jobs/sync-calendars.ts` (use DAL)

## Important notes

- The `getAccessTokenForUser` helper currently lives inside `scheduling.service.ts` and returns the full account row. This function does two things: (1) reads the account, (2) refreshes the token if expired. The account read should move to DAL; the token refresh logic stays in the service since it's business orchestration.
- The `getMeetingForGCal` helper also lives inside `scheduling.service.ts`. Move to meetings DAL.
- `performInboundSync` is a standalone function above `createSchedulingService()`. It should stay in the service file but call DAL functions instead of `db` directly.
- Don't change any behavior — this is a pure structural refactor. All sync logic, conflict resolution, and GCal API calls remain exactly the same.
