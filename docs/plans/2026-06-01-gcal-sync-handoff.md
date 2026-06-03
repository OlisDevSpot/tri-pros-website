# Session Handoff: GCal Sync — Cron Schedule + Pre-Commit Review

> Date: 2026-06-01 | Branch: `main` (working tree uncommitted)
> Predecessor session: GCal sync architectural overhaul (5 steps, all in working tree)

## Why this matters

A previous session shipped a 5-step overhaul that fixes the systemic GCal sync bugs:

- sean@ creating intake meetings → events never landing on info@'s master calendar (sean@'s 32/59 meetings had no GCal event; info@ and oliver@ had 0 misses)
- Customer name/address changes → events embedding stale customer data with no propagation
- Meeting deletion → orphan events lingering on the master calendar
- Inbound GCal→app sync flaky (likely channel-expiry related, no automated renewal)

The overhaul is in working tree, type-checks clean (`pnpm tsc`), lints clean (`pnpm lint` — only pre-existing warnings remain in `date-time-picker.tsx`, `optimized-image.tsx`, `push-subscription-banner.tsx`). **Nothing is committed yet.**

You have two tasks:

1. **Review every change** for correctness, edge cases, and conventions adherence before commit.
2. **Schedule the renewal cron** — the one deferred deliverable that keeps inbound sync alive long-term.

---

## Task 1 — Review the GCal-fix changes

### How to get oriented

```bash
git status                  # see all modified + new files in working tree
git diff                    # the full diff
```

Some unmodified files in the working tree are NOT part of this work (voip docs, `.gitignore`, `src/shared/config/server-env.ts`, voip enums, `src/shared/db/schema/customers.ts` voip columns, `docs/plans/voip-*.md`). Those belong to a parallel VoIP session — **do not touch them**.

### Files that ARE part of this work

**Schema + UI (hotfix carryover from earlier)**
- `src/shared/db/schema/meetings.ts` — `scheduled_for.notNull()`
- `src/shared/entities/meetings/components/create-meeting-form.tsx` — required-field UI on the date picker
- `docs/codebase-conventions/service-architecture.md` — new `background-side-effects-via-qstash-jobs` rule + anti-pattern (replaced an interim `background-side-effects-via-after` rule in a follow-up session — `after()` proved unreliable for critical work)

**Step 1 — Meeting hook parity**
- `src/shared/entities/meetings/lib/server-spec.ts` — `update.after` reads `row.ownerId` not `ctx.session!.user.id`; all three side effects (`syncMeeting`, `notifyMeetingScheduledTimeChanged`, ably publish) wrapped in `after()`; `duplicate.overrides` defensive
- `src/shared/services/notification.service.ts` — `notifyMeetingScheduledTimeChanged.excludeUserId` is now optional

**Step 2 — `pushToGCal` split into named entry points**
- `src/shared/services/scheduling.service.ts` — `pushToGCal` removed; replaced by `syncMeeting(meetingId)`, `deleteMeetingEvent({gcalEventId})`, `propagateCustomerChange(customerId)`, `syncActivity(userId, activityId)`. Two new module-private helpers: `resolveSystemCalendarAuth()` and `pushMeetingEventToCalendar()`.
- `src/shared/entities/meetings/dal/server/google-calendar.ts` — new DAL function `getMeetingsForCustomerWithGCalEvent(customerId)`
- Callers migrated: `src/shared/entities/meetings/lib/server-spec.ts`, `src/trpc/routers/schedule.router/sync.router.ts`, `src/trpc/routers/meetings.router/participants.router.ts`, `src/trpc/routers/schedule.router/activities.router.ts`, `scripts/rebuild-gcal-descriptions.ts`

**Step 3 — Meeting seam end-to-end (writes + delete hook + customer cascade)**
- `src/shared/entities/meetings/lib/server-spec.ts` — `projectId` added to update.after trigger set; new `delete.before` hook captures `gcalEventId` + fires `deleteMeetingEvent` via `after()`
- `src/shared/entities/customers/lib/server-spec.ts` — delete cascade routes through `meetingCrud.delete` per meeting (was raw `tx.delete(meetings)`); transaction dropped (`meetingCrud.delete` isn't tx-aware)
- `src/shared/entities/meetings/dal/server/mutations.ts` — `deriveOutcomeOnProposalSent` routes through `meetingCrud.update` (with the `OVERWRITABLE_OUTCOMES` pre-check kept as raw SELECT since entity API has no compare-and-set)
- `src/features/customer-pipelines/dal/server/move-customer-to-pipeline.ts` — bulk pipeline-pipeline write loops through `meetingCrud.update(SYSTEM_CONTEXT, ...)` per row
- `src/trpc/routers/projects.router/business.router.ts` — project-creation meeting update routes through `meetingCrud.update(buildUserContext, ...)`

**Step 4 — Customer→event propagation**
- `src/shared/entities/customers/lib/server-spec.ts` — new `hooks.update.after` fires `propagateCustomerChange` via `after()`. NO field filter (decision T2 with the user — every customer update fires; `propagateCustomerChange` short-circuits if customer has no synced events). Contains an `@migration(ably-realtime-kernel)` placeholder for the future Ably emit.

**Step 5 — Inbound sync observability + scheduling docs**
- `src/trpc/routers/schedule.router/sync.router.ts` — new `systemOwnerHealth` query + `renewSystemOwnerChannel` mutation (both super-admin gated)
- `src/shared/services/providers/upstash/jobs/sync-calendars.ts` — scheduling-requirements docblock

**Also touched**
- `src/trpc/routers/customers.router/business.router.ts` — `createFromIntake` got a BAD_REQUEST guard on missing `scheduledFor` for `customer_and_meeting` mode (the schema is NOT NULL now)

### Review priorities

Walk through these in order. Read the file + read the diff + check the listed concerns.

1. **`src/shared/entities/meetings/lib/server-spec.ts`** — the central nervous system. Confirm:
   - `create.after` uses `row.ownerId` ✓
   - `update.after` uses `row.ownerId` ✓
   - `update.after` trigger set includes `scheduledFor || meetingType || agentNotes || projectId` ✓
   - `delete.before` queries `gcalEventId` and schedules `deleteMeetingEvent` via `after()`
   - `duplicate.overrides` falls back to `source.ownerId` for SYSTEM_CONTEXT

2. **`src/shared/entities/customers/lib/server-spec.ts`** — the upstream trigger. Confirm:
   - `hooks.update.before` geocode invalidation untouched (this was pre-existing)
   - `hooks.update.after` is NEW, fires `propagateCustomerChange` via `after()`, no field filter
   - `hooks.delete.before` cascades through `meetingCrud.delete(SYSTEM_CONTEXT, ...)` per meeting — DOUBLE-CHECK the transaction-was-dropped tradeoff is acceptable for your team

3. **`src/shared/services/scheduling.service.ts`** — the operations layer. Confirm:
   - `syncMeeting(meetingId)` — no `userId` param (the swap-to-system-owner is internal)
   - `propagateCustomerChange` short-circuits BEFORE `resolveSystemCalendarAuth` if no synced meetings exist (avoids `console.error` noise on every customer update in dev)
   - `deleteMeetingEvent({ gcalEventId })` exists and uses `resolveSystemCalendarAuth` + `googleCalendarClient.deleteEvent` (which already swallows 404 at the provider layer)
   - `syncActivity(userId, activityId)` — keeps per-user calendar semantics
   - Two module-private helpers (`resolveSystemCalendarAuth`, `pushMeetingEventToCalendar`) sit above `createSchedulingService` and are NOT exported

4. **All migrated meeting-write callers** — confirm each compiles + the migration preserves semantics:
   - `src/features/customer-pipelines/dal/server/move-customer-to-pipeline.ts` — loops `meetingCrud.update(SYSTEM_CONTEXT, ...)`. Cost: N round-trips instead of 1. Justified by hook-firing.
   - `src/shared/entities/meetings/dal/server/mutations.ts` — `deriveOutcomeOnProposalSent` uses `meetingCrud.update(ctx, ...)` with the OVERWRITABLE_OUTCOMES pre-check. Confirm: the SELECT-then-UPDATE flow is correct (no race window concern given the small invocation surface).
   - `src/trpc/routers/projects.router/business.router.ts` — uses `buildUserContext(ctx.session.user.id, ctx.session.user.role, meetingServerSpec)`. Confirm: the calling agent IS expected to be a participant in the meeting they're converting to a project. If not, the update silently no-ops.

5. **`src/trpc/routers/customers.router/business.router.ts`** — the intake flow. Confirm:
   - BAD_REQUEST guard at top for `customer_and_meeting && !leadMetaJSON?.scheduledFor`
   - `meetingCrud.create(SYSTEM_CONTEXT, { ownerId: ownerId!, ..., scheduledFor: scheduledFor! })` — both non-null assertions are guarded by the BAD_REQUEST check

6. **`src/shared/services/notification.service.ts`** — `excludeUserId` optional. Confirm the `ne(...) : undefined` ternary preserves the original participant-recipient logic when an actor IS provided.

### Verification commands

```bash
pnpm tsc                    # should be clean
pnpm lint                   # should be clean (pre-existing warnings OK; no errors in our files)
git diff --stat             # eyeball the touched-files list against the section above
```

### Manual smoke (recommended before commit)

The full end-to-end is hard to test without a real GCal account. Minimum smoke:

1. Spin up `pnpm dev`
2. As sean@ (or any agent), open a customer profile and create a meeting via "Add Meeting" → confirm meeting appears
3. Open the GCal calendar UI for info@triprosremodeling.com → confirm event landed
4. Edit the customer's address from the agent dashboard → confirm the event's location updates within ~10s (the `after()` background work)
5. Delete the meeting → confirm the event disappears from info@'s calendar

If you can't run the full smoke, at minimum confirm `pnpm tsc` + `pnpm lint` and the schema migration:

```bash
# Dev DB already has scheduled_for NOT NULL applied manually (see earlier session).
# Verify:
psql $DATABASE_DEV_URL -c "\d meetings" | grep scheduled_for
# expected: scheduled_for | timestamp with time zone | not null
```

---

## Task 2 — Schedule the renewal cron

### Why this is the load-bearing remaining item

Google Calendar push channels expire on a 7-day max. Without renewal:
1. Inbound webhooks stop firing
2. The app silently stops receiving GCal edits (datetime moves in GCal don't propagate to the app)
3. The user reported this exact bug ("two-way datetime sync used to work, now broken")

`syncCalendarsJob` exists and does the right thing (loop all accounts, inbound sync + `renewChannelIfNeeded`). It's registered at `/api/qstash-jobs?job=sync-calendars` and ready to fire. **The only missing piece is the trigger.**

See the docblock on `src/shared/services/providers/upstash/jobs/sync-calendars.ts` — it lays out the two options. Pick one and ship it.

### Option A (recommended) — QStash schedule

The existing `/api/qstash-jobs` route already verifies QStash signatures and dispatches to handlers by `?job=<key>`. To run on a schedule, configure QStash to send a recurring POST.

**Two ways to register the schedule:**

**A1. QStash dashboard** (zero code, click-ops):
- Go to https://console.upstash.com/qstash → Schedules → Create
- Destination URL: `${NEXT_PUBLIC_BASE_URL}/api/qstash-jobs?job=sync-calendars`
- HTTP method: POST
- Body: `{}` (empty JSON)
- Cron: `0 */12 * * *` (every 12h — channel expiry window is 24h pre-end, so ≤24h cadence keeps things evergreen; 12h leaves headroom for a missed tick)
- Save

**A2. Programmatic schedule via `qstashClient`** (in-source, repeatable across environments):

`@upstash/qstash` SDK supports `schedules.create(...)`. Add a one-time setup script:

```ts
// scripts/setup-gcal-cron.ts (NEW)
import { qstashClient } from '@/shared/services/providers/upstash/qstash-client'
import { getPublicBaseUrl } from '@/shared/config/public-url'
import './lib/load-env'   // matches convention from memory/feedback-scripts-load-env.md

async function main() {
  const result = await qstashClient.schedules.create({
    destination: `${getPublicBaseUrl()}/api/qstash-jobs?job=sync-calendars`,
    cron: '0 */12 * * *',
    method: 'POST',
    body: JSON.stringify({}),
  })
  console.log('Scheduled:', result.scheduleId)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

Run once per environment (`NODE_ENV=production` with prod DATABASE_URL):

```bash
DRIZZLE_TARGET=prod pnpm tsx scripts/setup-gcal-cron.ts
```

Document the script in `package.json` if you want `pnpm gcal:cron:setup` convenience.

**Either way:** verify the schedule fired by querying `scheduleRouter.sync.systemOwnerHealth` after ~12h. `channelExpiresAt` should always be > 24h in the future.

### Option B — Vercel Cron (alternative)

Use this if you'd rather not rely on QStash for scheduling. Requires a new env var and a new route.

```jsonc
// vercel.json (NEW)
{
  "crons": [
    { "path": "/api/cron/sync-calendars", "schedule": "0 */12 * * *" }
  ]
}
```

```ts
// src/shared/config/server-env.ts — add to the schema:
CRON_SECRET: z.string(),
```

```ts
// src/app/api/cron/sync-calendars/route.ts (NEW)
import env from '@/shared/config/server-env'
import { syncCalendarsJob } from '@/shared/services/providers/upstash/jobs/sync-calendars'

export const maxDuration = 60

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  await syncCalendarsJob.handler({})
  return new Response('ok')
}
```

Add `CRON_SECRET` to Vercel project env vars (any high-entropy string; Vercel will inject it on the cron call).

**Note**: a parallel VoIP session has uncommitted edits to `src/shared/config/server-env.ts` in the working tree. If you go with Option B, coordinate the env-schema edit so you don't collide with their work.

### Decision rationale

| Factor | Option A (QStash) | Option B (Vercel Cron) |
|---|---|---|
| Code surface | 0 new files (dashboard) OR 1 setup script | 2 new files + 1 env var |
| Env vars | None | New `CRON_SECRET` |
| Source-of-truth | Dashboard (A1) OR script (A2) | `vercel.json` |
| Conflicts with parallel VoIP work | None | Touches `server-env.ts` |
| Existing infra reuse | Uses `/api/qstash-jobs` already in place | New route |

**Recommended: Option A2** (programmatic QStash). Smallest source-controlled footprint, no env-schema collisions, replays cleanly across environments.

### After scheduling

1. Hit `scheduleRouter.sync.systemOwnerHealth` from the dashboard (or via curl/tRPC dev tools). Confirm `connected: true`, `channelExpired: false`, `hasSyncToken: true`.
2. Wait for one cron tick (or trigger manually via QStash console → "Run now").
3. Re-check health. `channelExpiresAt` should now be ~7 days out.
4. Optional: edit a meeting's start time directly in GCal → wait <2 minutes → confirm the meeting row's `scheduled_for` updated in the DB (`SELECT scheduled_for FROM meetings WHERE id = '<known meeting>'`).

### Once scheduled, retire the docblock TODO

Update `src/shared/services/providers/upstash/jobs/sync-calendars.ts` — replace the "Scheduling required" block with a one-liner stating the current schedule:

```
Scheduled via QStash at <schedule_id> (every 12h). See scripts/setup-gcal-cron.ts.
```

---

## Prior-session decisions (locked, do not re-litigate)

These were grilled in the predecessor session. Treat as binding unless you find a concrete reason to revisit:

- **T1**: GCal event title/location/description are RENDERINGS of in-app data. Edits in GCal silently overwritten on next propagation. Only `scheduledFor` is two-way. (Feature, not a bug.)
- **T2**: No field filter inside `customer.update.after`. Every customer update fires `propagateCustomerChange`. Short-circuit is at the service layer (no synced meetings → no work).
- **T3**: Customer delete cascade flows through `meetingCrud.delete` (not raw `db.delete`). Transactional atomicity dropped. Partial-failure is acceptable per pre-existing comment.
- **T4**: Meeting `hooks.create.before` is session-conditional (already in main as of commit `512dab19`). SYSTEM_CONTEXT callers (like `createFromIntake`) supply ownerId in input.
- **T5**: Ably realtime emit deferred. `@migration(ably-realtime-kernel)` placeholder in customer `update.after` points at the future addition.

## Commit strategy suggestion

Five natural commit slices map to the 5 steps; use `git add -p` if you want them separate. Or one big commit titled `feat(gcal): full customer↔meeting↔calendar sync overhaul` — your call. The hotfix carryover (schema NOT NULL + form UI + service-architecture.md doc) is a logical sixth slice but can also fold into the first commit since it's the foundation everything else builds on.

## What's intentionally OUT of scope for this handoff

- **The Meeting entity full migration to the Entity Server System.** Meeting already has a `meetingServerSpec` + `meetingCrud` from PR #209. This session relied on that being in place. If you find anything that requires deeper meeting-entity-router work, that's a separate PR.
- **Orphan-GCal-event sweeper script.** The meeting `delete.before` uses `after()` (best-effort). If the Google API call fails after row deletion, the event lingers. A future sweeper script could find events on info@'s calendar with no matching DB meeting row and clean them up. Out of scope here.
- **Field-filter optimization in `customer.update.after`.** Per T2 decision. Revisit when/if accounting service or another high-frequency writer creates noticeable load.
