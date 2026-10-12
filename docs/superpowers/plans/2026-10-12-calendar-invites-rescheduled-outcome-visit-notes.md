# Calendar Invites, the `rescheduled` Outcome and Visit Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the visit in the homeowner's calendar as a real Google invite on the one office event, replace our summary and cancellation emails with Google's own, give a reschedule's original the outcome `rescheduled`, and give meetings a homeowner-facing visit note plus internal notes linked to the meeting.

**Architecture:** The meeting's existing Google Calendar event becomes homeowner-safe for everyone. `meetings.homeowner_invited_at` stores the intent to invite. The calendar sync reads the current event from Google, then decides with pure functions who is a guest and whether Google should email anyone. A reschedule hands the event, the share token and the invite to the replacement before the original becomes `rescheduled`, so Google sends one "Updated invitation". The welcome text's email leg becomes "set `homeowner_invited_at`". Customer notes gain an entity link, which the meeting form and a new Notes action use.

**Tech Stack:** Next.js 15, TypeScript, tRPC, Drizzle (Postgres on Neon), Zod 4, Google Calendar REST API v3, Upstash QStash, Twilio (unchanged), `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-12-calendar-invites-rescheduled-outcome-visit-notes-design.md`. It amends `docs/superpowers/specs/2026-09-29-home-visit-page-and-visit-messages-design.md` and wins where the two disagree. Read the amendment in full before starting.

## Rulings made while planning (controller, 2026-10-12)

The spec is silent on these, or cannot work as written. Each is folded into the task named.

| # | Ruling | Why | Task |
|---|---|---|---|
| P1 | When a notice is due, the sync passes `externalOnly` in production and `all` outside it. | `EMAIL_DEV_OVERRIDE` is on the company domain, and Google's `externalOnly` never emails a same-domain guest, so the spec's dev check 1 could never pass. Staff are never guests outside production, so `all` reaches only the override inbox. | 2, 3 |
| P2 | The homeowner guest is marked in the event's `extendedProperties.private.homeownerEmail`, and counts as present only while that email is also in `attendees`. | `decideCalendarNotice` needs to know who the homeowner is on the current event, including after their email changed or someone removed them in Google. | 2 |
| P3 | Each PUT carries over every attendee's `responseStatus` from the current event. | A full-event PUT without it can reset the homeowner's RSVP whenever the visit note changes. | 2, 3 |
| P4 | A meeting can have several linked internal notes: the reschedule note (spec §7.3) plus the coordinator's. The create form adds one. The new **Notes** action lists every linked note, edits each in place and adds more. | Spec §7.2's "load that note" would load the reschedule note on a replacement meeting. | 6 |
| P5 | Editing happens in the Notes action's dialog, not in `CreateMeetingForm`'s edit mode. | No caller passes `editMeetingId`, so that edit mode is unreachable today. | 6 |
| P6 | A reschedule carries `visit_note` to the replacement; Duplicate excludes `visit_note` and `homeowner_invited_at`. | A reschedule is the same visit in a new slot; a duplicate is a fresh visit (the reason `agentNotes` is already excluded). | 1, 4 |
| P7 | `meetingCrud`'s `create.after` skips the calendar sync for a row with `rescheduledFromId`; the reschedule flow syncs it after the hand-off. | Implements spec §6.2 step 1. Otherwise a sync job could create a second event before the hand-off. | 3 |
| P8 | Customer pipeline queries ignore `rescheduled` meetings. | Spec §6.1: "leaves the lead pipelines". An original rescheduled ahead of time still has a future `scheduledFor`, which would otherwise show as the customer's next meeting. | 1 |
| P9 | The welcome-text action sets `homeowner_invited_at` whatever the text's own outcome. | The invite is its own leg, as the email was. | 5 |
| P10 | `connectCalendar`'s backfill never emails anyone (`none`). | A one-time import of every meeting; homeowners already invited know about their visit. | 3 |
| P11 | The calendar name keys on `VERCEL_ENV`, not `NODE_ENV`. | Spec §5.4 says outside production. A Preview deploy is `NODE_ENV=production` and would otherwise name the dev calendar "Tri Pros Schedule". | 3 |
| P12 | `visit_cancellation` and the `email` channel stay in `kinds.ts`, and the claim index is left alone. | Rows from before this plan use them (the dev test meeting has one). | 5 |
| P13 | Existing reschedule originals keep `cancelled`. A backfill would be its own owner-run script. | It changes data, and the spec does not ask for it. | — |
| P14 | `visit_note` is at most 300 characters. | Same bound as the per-send note it replaces; the welcome text stays within `MAX_SEGMENTS`. | 1 |
| P15 | `{{visit_note}}` stays welcome-text-only, as `{{coordinator_note}}` was. | Spec §7.3 places it in the welcome text only. | 5 |

**Open before Task 1 (owner):**
1. `src/shared/modules/meetings/messages/constants/templates.ts` has an uncommitted rewording of `VISIT_MESSAGE_STOP_LINE`, from outside this plan. With it, `pnpm tsx scripts/verify-visit-messages.ts` fails now: it still expects "Reply STOP to opt out.".
2. `src/shared/db/schema/meetings.ts` has an uncommitted `shareToken` default respelling, also from outside this plan.

Tasks 1 and 5 edit both files. The controller records the owner's answer for each as a ledger ruling: either adopt the hunk in this plan's commit (for the STOP line, Task 5 also updates the verify expectations), or leave it out. A hunk that is left out must stay uncommitted in the working tree. To commit only this plan's hunks of a file, stage them through a patch (`git diff <file> > /tmp/x.patch`, edit the patch down, `git apply --cached /tmp/x.patch`), never with `git add -p` (interactive) and never by reverting the other hunk.

## Global Constraints

- Package manager is **pnpm**. Verify with `pnpm tsc` and `pnpm lint`. **Never** run `pnpm build`. `pnpm lint` never lints `scripts/`; lint a script with `pnpm exec eslint <path>`.
- Work on local `main`, in the shared tree. No branch, no worktree, no `git stash`, `git checkout` or `git reset`. Stage by explicit path, never `git add -A` or `git add .`. Another session has uncommitted files here (`CONTEXT.md`, `docs/plans/2026-10-01-sales-lifecycle-rules-map.md`, customer profile components, and more): never stage them.
- A commit hook runs `pnpm tsc`, `pnpm lint` and `pnpm theme:check` and takes about 110 s. Put the whole `git add … && git commit …` in one Bash call with a timeout of at least 400000 ms. End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Never run `pnpm db:push:dev` or `pnpm db:push:prod`.** Task 1 asks the owner. Never accept a truncate prompt.
- **No database writes for testing**, dev included, except a wiring script that deletes every row it created and restores every row it changed before it exits, in a `finally`. Never run a script's `--apply` mode.
- **Nothing leaves a test.** Wiring scripts intercept the provider and job slots: `voipMessagesService.sendFromMainLine`, each job's `dispatch` / `dispatchOrThrow`, `realtimeClient.publish`, and `googleCalendarClient.*`. These are plain object literals, so a slot is assignable: `(syncMeetingToGcalJob as any).dispatchOrThrow = async (payload) => { captured.push(payload) }`. The owner does the real sends (Task 7).
- Wiring scripts run as `DRIZZLE_TARGET=dev NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-<name>.ts`, start with `import './lib/load-env'` inside the eslint-disable block the other scripts use, and are deleted before the task's commit.
- Outside production (`env.VERCEL_ENV !== 'production'`), the homeowner guest is `EMAIL_DEV_OVERRIDE` or nobody, and staff are never guests. The dev database holds real customer emails.
- `scripts/verify-visit-messages.ts` stays pure. It may not import anything that reaches `@/shared/config/server-env`, `@/shared/db` (the client, not types), `@/shared/config/public-url`, or a provider SDK. Type-only imports are fine. Every new test in this plan goes in that file as a numbered section (`console.log('<n>. <name> ✓')`), before the final `✅` line.
- Comments say why, never what. No file banners, no citations of plans, specs, tasks or docs from code, no new `DOCS.md`.
- Raw `db` calls live in DAL files only. A service is one object literal; every method takes `ctx` first. Routes and jobs hold no business logic.
- Option sets are a `readonly` const array with the type derived beside it. No `pgEnum`.
- Company data comes from `src/shared/constants/company/`. Never hardcode the company name or phone.
- A move or removal is non-defensive: consumers switch and the old code is deleted in the same change. No re-export shims, no fallbacks.
- Vocabulary: **meeting welcome text** (code keeps `visit_summary`), **visit note**, **internal note**, **calendar invite**, coordinator (the setter), specialist (the rep), plus the parent spec's §3a terms. Do not coin others.
- Never edit `CONTEXT.md`, `docs/ubiquitous-language.md` or `docs/plans/2026-10-01-sales-lifecycle-rules-map.md` while `git status` shows them modified; Task 7 checks.

## Review Focus

Five inputs the spec implies, a person would trip over, and no task's main path exercises. Each has a test in the task named.

1. **A sync job runs twice** (QStash retry, or an inbound-sync echo). Expected: the second run finds Google already matching and sends no email. `decideCalendarNotice` returns `none` when the current event already has the homeowner at the same time and place. (Task 2)
2. **The visit note is edited after the homeowner accepted.** Expected: no email, and their "Yes" survives the PUT. (Task 2 carries `responseStatus`; Task 3 wires it)
3. **The customer's email changes after the invite.** Expected: one notice; Google cancels the old address and invites the new one in the same update. (Task 2)
4. **A `no_show` meeting is rebooked through Reschedule.** Expected: the original keeps `no_show` (today it becomes `cancelled`), the replacement starts unconfirmed and gets the event and the invite. (Task 4)
5. **Dev without `EMAIL_DEV_OVERRIDE`, or a dev meeting with real agents as participants.** Expected: no homeowner and no staff on the event; nobody real is emailed or shown the event. (Task 2)

## File map

| File | Responsibility | Task |
|---|---|---|
| `src/shared/db/schema/meetings.ts` | `visit_note`, `homeowner_invited_at` | 1 |
| `src/shared/db/schema/customer-notes.ts` | `entity_type`, `entity_id`, check constraint | 1 |
| `src/shared/constants/enums/customer-notes.ts` (new) | `customerNoteEntityTypes` | 1 |
| `src/shared/constants/enums/meetings.ts` | `rescheduled` (derived, neutral, not sat, not live) | 1 |
| `src/shared/domains/pipelines/lib/outcome-pipeline-map.ts` | `rescheduled: null` | 1 |
| `src/shared/entities/meetings/constants/status-colors.ts` | label "Rescheduled" | 1 |
| `src/shared/entities/meetings/constants/visit-note.ts` (new) | max length, field labels and helper copy | 1 |
| `src/shared/entities/customer-notes/lib/server-spec.ts` | link both-or-none | 1 |
| `src/shared/entities/meetings/dal/server/crud.ts` | duplicate excludes; sync triggers; cancel/delete notices; replacement skips sync | 1, 3 |
| `src/shared/entities/customers/dal/server/pipeline-items.ts` | ignore `rescheduled` meetings | 1 |
| `src/shared/services/providers/google-calendar/types.ts` | attendees, extended properties, `GCalSendUpdates` | 2 |
| `src/shared/services/providers/google-calendar/lib/map-to-gcal.ts` | homeowner-safe event, pure | 2 |
| `src/shared/services/providers/google-calendar/lib/calendar-notice.ts` (new) | `decideCalendarNotice` and friends | 2 |
| `src/shared/services/providers/google-calendar/lib/meeting-guests.ts` (new) | `resolveMeetingGuests` | 2 |
| `src/shared/services/providers/google-calendar/client.ts` | `sendUpdates` on create, update, delete; `GCalRequestError` | 3 |
| `src/shared/services/scheduling.service.ts` | read-compare-write sync; guests; notices | 3 |
| `src/shared/entities/meetings/dal/server/google-calendar.ts` | `getMeetingForGCal` selects the new fields | 3 |
| `src/shared/services/providers/upstash/jobs/delete-meeting-event.ts` | carries the notice | 3 |
| `src/shared/entities/meetings/dal/server/mutations.ts` | `handOffVisit` replaces `handOffShareToken` | 4 |
| `src/shared/modules/meetings/core/lib/rescheduled-original-outcome.ts` (new) | which originals become `rescheduled` | 4 |
| `src/shared/modules/meetings/business/service.ts` | reschedule order; welcome text + invite; internal-notes read | 4, 5, 6 |
| `src/shared/modules/meetings/messages/**` | `{{visit_note}}`; removals | 5 |
| `src/trpc/routers/meetings.router/{business,reads}.router.ts` | input without `note`; `internalNotes` read | 5, 6 |
| `scripts/visit-messages.ts` | `summary` prints the invite; `cancel` removed | 5 |
| `src/shared/entities/customer-notes/dal/server/queries.ts` (new) | notes linked to an entity | 6 |
| `src/shared/entities/meetings/components/create-meeting-form.tsx` | two note fields | 6 |
| `src/shared/entities/meetings/components/meeting-notes-dialog.tsx` (new) | the Notes dialog | 6 |
| `src/shared/entities/meetings/constants/actions.ts`, `hooks/use-meeting-action-configs.tsx`, `src/shared/modules/meetings/core/components/meeting-actions-host.tsx` | the Notes action | 6 |
| `src/shared/entities/customers/components/timeline/quick-note-input.tsx` | optional entity link | 6 |
| `scripts/verify-visit-messages.ts` | pinned rules | 1, 2, 4, 5 |

Deleted in Task 5: `messages/lib/deliver-visit-email.ts`, `messages/lib/build-ics.ts`, `messages/lib/google-calendar-link.ts`, `messages/lib/should-send-visit-cancellation.ts`, `services/providers/resend/emails/visit-summary-email.tsx`, `services/providers/resend/emails/visit-cancellation-email.tsx`, `services/providers/upstash/jobs/send-visit-cancellation.ts`.

---

### Task 1: Data model and the `rescheduled` outcome

**Files:**
- Modify: `src/shared/db/schema/meetings.ts`, `src/shared/db/schema/customer-notes.ts`, `src/shared/constants/enums/meetings.ts`, `src/shared/constants/enums/index.ts`, `src/shared/domains/pipelines/lib/outcome-pipeline-map.ts`, `src/shared/entities/meetings/constants/status-colors.ts`, `src/shared/entities/customer-notes/lib/server-spec.ts`, `src/shared/entities/meetings/dal/server/crud.ts` (duplicate excludes only), `src/shared/entities/customers/dal/server/pipeline-items.ts`
- Create: `src/shared/constants/enums/customer-notes.ts`, `src/shared/entities/meetings/constants/visit-note.ts`
- Test: `scripts/verify-visit-messages.ts`

**Interfaces:**
- Produces: `Meeting.visitNote: string | null`, `Meeting.homeownerInvitedAt: string | null`; `CustomerNote.entityType: CustomerNoteEntityType | null`, `CustomerNote.entityId: string | null`; `customerNoteEntityTypes = ['meeting', 'proposal', 'project'] as const`, `type CustomerNoteEntityType`; `'rescheduled'` in `derivedMeetingOutcomes`; `VISIT_NOTE_MAX_LENGTH = 300`, `VISIT_NOTE_FIELD`, `INTERNAL_NOTE_FIELD`.

- [ ] **Step 1: Write the failing test**

Add to `scripts/verify-visit-messages.ts` (import `DID_NOT_OCCUR_OUTCOMES`, `LIVE_MEETING_OUTCOMES`, `MEETING_OUTCOME_SENTIMENT`, `MEETING_OUTCOME_SIT`, `derivedMeetingOutcomes`, `selectableMeetingOutcomes`, `canRescheduleFromOutcome`, `outcomeRequiresReason` from `@/shared/constants/enums/meetings`, and `OUTCOME_PIPELINE_MAP` from `@/shared/domains/pipelines/lib/outcome-pipeline-map`):

```ts
{
  assert.ok((derivedMeetingOutcomes as readonly string[]).includes('rescheduled'), 'the system sets it; pickers show it disabled')
  assert.ok(!(selectableMeetingOutcomes as readonly string[]).includes('rescheduled'))
  assert.equal(MEETING_OUTCOME_SENTIMENT.rescheduled, 'neutral', 'a reschedule is not a loss')
  assert.equal(MEETING_OUTCOME_SIT.rescheduled, 'not_sat')
  assert.ok(!LIVE_MEETING_OUTCOMES.includes('rescheduled'), 'the replacement is the live meeting')
  assert.equal(canRescheduleFromOutcome('rescheduled'), false, 'the replacement is what gets rescheduled next')
  assert.ok(!(DID_NOT_OCCUR_OUTCOMES as readonly string[]).includes('rescheduled'))
  assert.equal(outcomeRequiresReason('rescheduled'), false)
  assert.equal(OUTCOME_PIPELINE_MAP.rescheduled, null, 'the original does not go to rehash')
  assert.equal(isVisitMessageEligible({ meetingType: 'Fresh', meetingOutcome: 'rescheduled', scheduledFor: '2099-01-01T17:00:00.000Z' }, new Date('2026-10-12T17:00:00.000Z')), false, 'nothing is sent for a rescheduled original')
}
console.log('16. The rescheduled outcome ✓')
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: a type or assertion failure at section 16 (`'rescheduled'` is not a `MeetingOutcome`). If the owner left the STOP-line rewording uncommitted (see "Open before Task 1"), section 6 fails first. In that case run the new block on its own through a scratch copy, and record that in the report.

- [ ] **Step 3: Add the outcome**

In `src/shared/constants/enums/meetings.ts`:
- append `'rescheduled'` to `derivedMeetingOutcomes`;
- `MEETING_OUTCOME_SENTIMENT`: `rescheduled: 'neutral'`;
- `MEETING_OUTCOME_SIT`: `rescheduled: 'not_sat'`;
- `LIVE_MEETING_OUTCOMES`: `meetingOutcomes.filter(o => o !== 'cancelled' && o !== 'no_show' && o !== 'rescheduled')`, and its comment becomes "everything except the outcomes that mean this row's visit never happens";
- `DID_NOT_OCCUR_OUTCOMES` is unchanged. Add one line above it: `// rescheduled is absent on purpose: its replacement is the meeting a later reschedule moves.`

In `outcome-pipeline-map.ts` add `rescheduled: null`. In `status-colors.ts` add `rescheduled: 'Rescheduled'` to `MEETING_OUTCOME_LABELS`. Then run `pnpm tsc` and add `rescheduled` to every other `Record<MeetingOutcome, …>` tsc names. A neutral, not-sat value in each; check what the neighbouring `reschedule_needed` entry does.

- [ ] **Step 4: Customer pipelines ignore `rescheduled` meetings**

In `src/shared/entities/customers/dal/server/pipeline-items.ts`, add `ne(meetings.meetingOutcome, 'rescheduled')` to the meeting conditions in `getRehashOrDeadPipelineItems` (inside the `exists` subquery) and `getFreshPipelineItems` (the `innerJoin` condition). Also add it to the third `eq(meetings.pipeline, 'fresh')` query near line 222 if that query lists a customer's meetings. Comment, once, above the first: `// A rescheduled original is history: its replacement carries the visit, and the original's time must not read as the next meeting.`

- [ ] **Step 5: Schema columns**

`src/shared/db/schema/meetings.ts`, after `agentNotes`:

```ts
  // Homeowner-facing: the welcome text, the calendar event and the visit page show it.
  visitNote: text('visit_note'),
  // Set means the homeowner should be a guest on the meeting's calendar event; the calendar sync makes the event match.
  homeownerInvitedAt: timestamp('homeowner_invited_at', { mode: 'string', withTimezone: true }),
```

In `insertMeetingSchema`'s `.extend({...})` add `visitNote: z.string().trim().max(VISIT_NOTE_MAX_LENGTH).nullable().optional(),` (import from `@/shared/entities/meetings/constants/visit-note`).

Create `src/shared/entities/meetings/constants/visit-note.ts`:

```ts
// The welcome text carries the note; past this it would push the text over its segment budget.
export const VISIT_NOTE_MAX_LENGTH = 300

export const VISIT_NOTE_FIELD = {
  label: 'Note for the homeowner',
  helper: 'The homeowner and the specialist see this in the welcome text, the calendar invite and the visit page.',
  placeholder: 'e.g. Please park in the driveway.',
} as const

export const INTERNAL_NOTE_FIELD = {
  label: 'Internal note',
  helper: 'Only the team sees this. It is saved to the customer\'s notes, linked to this meeting.',
  placeholder: 'Anything the team should know.',
} as const
```

Create `src/shared/constants/enums/customer-notes.ts`:

```ts
/** What a customer note can be about. The id points at a different table per type, so there is no foreign key. */
export const customerNoteEntityTypes = ['meeting', 'proposal', 'project'] as const
export type CustomerNoteEntityType = (typeof customerNoteEntityTypes)[number]
```

Add `export * from './customer-notes'` to `src/shared/constants/enums/index.ts`, in alphabetical order.

`src/shared/db/schema/customer-notes.ts`:

```ts
import { sql } from 'drizzle-orm'
import { check, pgTable, text, uuid } from 'drizzle-orm/pg-core'
// …existing imports…
import { customerNoteEntityTypes } from '@/shared/constants/enums/customer-notes'

export const customerNotes = pgTable('customer_notes', {
  id,
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
  // A note whose entity was deleted stays on the customer; readers treat the entity as removed.
  entityType: text('entity_type', { enum: customerNoteEntityTypes }),
  entityId: uuid('entity_id'),
  createdAt,
  updatedAt,
}, table => ({
  entityLinkComplete: check('customer_notes_entity_link_complete', sql`(${table.entityType} IS NULL) = (${table.entityId} IS NULL)`),
}))
```

In `src/shared/entities/customer-notes/lib/server-spec.ts`, the insert schema refuses half a link, and the update schema keeps picking from the unrefined object:

```ts
const insertCustomerNoteSchemaBounded = insertCustomerNoteSchema.extend({ content: boundedContent })
const insertCustomerNoteSchemaLinked = insertCustomerNoteSchemaBounded.refine(
  note => (note.entityType == null) === (note.entityId == null),
  { message: 'A note links to an entity by its type and id together.' },
)
const updateCustomerNoteSchema = insertCustomerNoteSchemaBounded.pick({ content: true })
```

Use `insertCustomerNoteSchemaLinked` wherever `insertCustomerNoteSchemaBounded` was the insert schema (`customerNoteSchemas.insert`, `schemas.insert`). If `createCrudRouter`'s `TInsert extends ZodObject` refuses the refined type under Zod 4, move the both-or-none check into `customerNoteCrud`'s `create.before` instead: throw `ThrowableDalError({ type: 'precondition-failed', reason: … })`. Record which you did in the report.

- [ ] **Step 6: Duplicate excludes both columns**

In `src/shared/entities/meetings/dal/server/crud.ts`, `duplicate.exclude`: add `'visitNote'` and `'homeownerInvitedAt'` after `'agentNotes'`.

- [ ] **Step 7: Run the tests and the type check**

Run: `pnpm tsx scripts/verify-visit-messages.ts && pnpm tsc && pnpm lint`
Expected: section 16 passes, tsc and lint are clean. Sections 1–15 pass too, unless the open STOP-line hunk is present (see Step 2).

- [ ] **Step 8: Commit, then ask the owner for the dev push**

```bash
git add src/shared/db/schema/meetings.ts src/shared/db/schema/customer-notes.ts src/shared/constants/enums/meetings.ts src/shared/constants/enums/customer-notes.ts src/shared/constants/enums/index.ts src/shared/domains/pipelines/lib/outcome-pipeline-map.ts src/shared/entities/meetings/constants/status-colors.ts src/shared/entities/meetings/constants/visit-note.ts src/shared/entities/customer-notes/lib/server-spec.ts src/shared/entities/meetings/dal/server/crud.ts src/shared/entities/customers/dal/server/pipeline-items.ts scripts/verify-visit-messages.ts <any other file tsc required> && git commit -m "feat(meetings): a rescheduled outcome, a homeowner-facing visit note, the stored invite, and customer notes that link to what they are about

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Follow the ledger ruling for `meetings.ts`'s uncommitted `shareToken` hunk (stage through a patch if it is left out). The controller then asks the owner to run `pnpm db:push:dev`: 4 columns and 1 check constraint, nothing dropped, no truncate. Tasks 2 and 3 do not need the push. Task 4's wiring script waits for it.

---

### Task 2: The homeowner-safe event and the notice rules (pure)

**Files:**
- Modify: `src/shared/services/providers/google-calendar/types.ts`, `src/shared/services/providers/google-calendar/lib/map-to-gcal.ts`
- Create: `src/shared/services/providers/google-calendar/lib/calendar-notice.ts`, `src/shared/services/providers/google-calendar/lib/meeting-guests.ts`
- Test: `scripts/verify-visit-messages.ts`

**Interfaces:**
- Consumes: `companyInfo` (`@/shared/constants/company`), `formatPhone` (`@/shared/lib/phone`), `GCAL_MEETING_COLORS`.
- Produces:
  - `type GCalSendUpdates = 'all' | 'externalOnly' | 'none'`; `interface GCalAttendee { email: string, responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted', organizer?: boolean, self?: boolean }`; `interface GCalExtendedProperties { private?: Record<string, string> }`; `attendees?` and `extendedProperties?` on both `GCalEvent` and `GCalEventInput`.
  - `MeetingForGCal` without `customerPhone` and `agentNotes`, with `visitNote: string | null`, `homeownerInvitedAt: string | null`, `shareToken: string`.
  - `meetingToGCalEvent(meeting: MeetingForGCal, extras: MeetingEventExtras): GCalEventInput | null`, where `interface MeetingEventExtras { visitLink: string, questionsPhone: string, guests: MeetingGuests }`.
  - `resolveMeetingGuests(input: { isProduction: boolean, staffEmails: readonly string[], invitedHomeownerEmail: string | null, devOverride: string | null }): MeetingGuests`, where `interface MeetingGuests { attendees: GCalAttendee[], homeownerEmail: string | null }`.
  - `type CalendarNotice = 'notify' | 'none'`; `interface CalendarNoticeState { start: string | null, location: string | null, homeownerEmail: string | null }`; `decideCalendarNotice(current: CalendarNoticeState | null, next: CalendarNoticeState): CalendarNotice`; `decideCancellationNotice(input: { homeownerInvited: boolean, scheduledFor: string, now: Date }): CalendarNotice`; `noticeStateFromEvent(event: GCalEvent): CalendarNoticeState`; `noticeStateFromInput(input: GCalEventInput): CalendarNoticeState`; `homeownerMarker(email: string | null): GCalExtendedProperties`; `toSendUpdates(notice: CalendarNotice, env: { isProduction: boolean }): GCalSendUpdates`; `carryAttendeeResponses(next: GCalAttendee[], current: readonly GCalAttendee[] | undefined): GCalAttendee[]`.

- [ ] **Step 1: Write the failing tests**

Add to `scripts/verify-visit-messages.ts` (import the names above, plus `MeetingForGCal` as a type):

```ts
{
  const meeting: MeetingForGCal = {
    id: 'm1',
    scheduledFor: '2026-10-20T17:00:00.000Z',
    meetingType: 'Fresh',
    projectId: null,
    customerName: 'Maria Lopez',
    customerEmail: 'maria@example.com',
    customerAddress: '1 Main St',
    customerCity: 'Calabasas',
    customerState: 'CA',
    customerZip: '91302',
    visitNote: 'Please park in the driveway.',
    homeownerInvitedAt: '2026-10-12T17:00:00.000Z',
    shareToken: 'tok',
    tradeSelections: [{ tradeName: 'Roofing', selectedScopes: [{ label: 'Tear-off' }, { label: 'Gutters' }] }],
    gcalEventId: null,
    gcalEtag: null,
    participantEmails: ['rep@triprosremodeling.com'],
  }
  const guests = { attendees: [{ email: 'rep@triprosremodeling.com' }, { email: 'maria@example.com' }], homeownerEmail: 'maria@example.com' }
  const extras = { visitLink: 'https://example.com/home-visits/m1?token=tok', questionsPhone: '(818) 555-0100', guests }
  const event = meetingToGCalEvent(meeting, extras)!
  assert.equal(event.summary, `Home visit: Maria Lopez · ${companyInfo.name}`)
  assert.equal(meetingToGCalEvent({ ...meeting, projectId: 'p1', meetingType: 'Project' }, extras)!.summary, 'Project: Maria Lopez', 'homeowners are never invited to project meetings, so those keep a project title')
  const description = event.description!
  const order = ['Please park in the driveway.', 'Roofing: Tear-off, Gutters', extras.visitLink, `Questions? Call or text ${companyInfo.nickname} at (818) 555-0100`]
  const positions = order.map(part => description.indexOf(part))
  assert.ok(positions.every(position => position >= 0), `every part is present: ${description}`)
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'visit note, trades, visit page, then questions')
  assert.ok(!/dashboard|Synced from|maria@example\.com|Phone:/i.test(description), 'no dashboard link, footer, or customer contact details')
  assert.ok(!meetingToGCalEvent({ ...meeting, visitNote: null }, extras)!.description!.startsWith('\n'), 'no blank lead when there is no note')
  assert.deepEqual(event.attendees, guests.attendees)
  assert.deepEqual(event.extendedProperties, homeownerMarker('maria@example.com'))
  assert.equal(event.location, '1 Main St, Calabasas, CA, 91302')
}
console.log('17. The meeting event ✓')

{
  const base = { isProduction: true, staffEmails: ['rep@triprosremodeling.com', 'REP@triprosremodeling.com'], invitedHomeownerEmail: 'maria@example.com', devOverride: 'owner@triprosremodeling.com' }
  assert.deepEqual(resolveMeetingGuests(base), { attendees: [{ email: 'rep@triprosremodeling.com' }, { email: 'maria@example.com' }], homeownerEmail: 'maria@example.com' }, 'production: staff once each, then the homeowner')
  assert.deepEqual(resolveMeetingGuests({ ...base, invitedHomeownerEmail: null }), { attendees: [{ email: 'rep@triprosremodeling.com' }], homeownerEmail: null })
  assert.deepEqual(resolveMeetingGuests({ ...base, isProduction: false }), { attendees: [{ email: 'owner@triprosremodeling.com' }], homeownerEmail: 'owner@triprosremodeling.com' }, 'dev: no staff, and the homeowner is the override inbox')
  assert.deepEqual(resolveMeetingGuests({ ...base, isProduction: false, devOverride: null }), { attendees: [], homeownerEmail: null }, 'dev without an override invites nobody')
  assert.deepEqual(resolveMeetingGuests({ ...base, isProduction: false, invitedHomeownerEmail: null }), { attendees: [], homeownerEmail: null })
}
console.log('18. Meeting guests ✓')

{
  const at = (start: string, homeownerEmail: string | null, location = '1 Main St') => ({ start, location, homeownerEmail })
  const T = '2026-10-20T17:00:00.000Z'
  const sameInstantOtherFormat = '2026-10-20T10:00:00-07:00'
  assert.equal(decideCalendarNotice(null, at(T, null)), 'none', 'a new event without the homeowner emails nobody')
  assert.equal(decideCalendarNotice(null, at(T, 'maria@example.com')), 'notify', 'a new event with the homeowner is their invite')
  assert.equal(decideCalendarNotice(at(T, null), at(T, 'maria@example.com')), 'notify', 'homeowner added')
  assert.equal(decideCalendarNotice(at(T, 'maria@example.com'), at(T, null)), 'notify', 'homeowner removed: Google cancels for them')
  assert.equal(decideCalendarNotice(at(T, 'maria@example.com'), at(T, 'maria.new@example.com')), 'notify', 'a changed email swaps the guest in one update')
  assert.equal(decideCalendarNotice(at(T, 'maria@example.com'), at('2026-10-21T17:00:00.000Z', 'maria@example.com')), 'notify', 'start moved')
  assert.equal(decideCalendarNotice(at(T, 'maria@example.com'), at(T, 'maria@example.com', '2 Oak Ave')), 'notify', 'location moved')
  assert.equal(decideCalendarNotice(at(sameInstantOtherFormat, 'Maria@Example.com'), at(T, 'maria@example.com')), 'none', 'Google already matches: a retry sends nothing')
  assert.equal(decideCalendarNotice(at(T, null), at('2026-10-21T17:00:00.000Z', null)), 'none', 'staff-only changes stay silent')
  assert.equal(decideCalendarNotice(at(T, 'maria@example.com', ' 1 Main St '), at(T, 'maria@example.com')), 'none', 'a note, trades or title change alone is silent')

  const now = new Date('2026-10-19T17:00:00.000Z')
  assert.equal(decideCancellationNotice({ homeownerInvited: true, scheduledFor: T, now }), 'notify')
  assert.equal(decideCancellationNotice({ homeownerInvited: true, scheduledFor: '2026-10-19T16:00:00.000Z', now }), 'none', 'no cancellation for a visit that has happened')
  assert.equal(decideCancellationNotice({ homeownerInvited: false, scheduledFor: T, now }), 'none')

  assert.equal(toSendUpdates('notify', { isProduction: true }), 'externalOnly', 'staff on the company domain stay silent')
  assert.equal(toSendUpdates('notify', { isProduction: false }), 'all', 'the dev override sits on the company domain, which externalOnly never emails')
  assert.equal(toSendUpdates('none', { isProduction: true }), 'none')

  const current = {
    id: 'e', summary: 's', etag: 'x', updated: T, status: 'confirmed' as const,
    start: { dateTime: sameInstantOtherFormat }, end: { dateTime: sameInstantOtherFormat }, location: '1 Main St',
    attendees: [{ email: 'maria@example.com', responseStatus: 'accepted' as const }, { email: 'rep@triprosremodeling.com', responseStatus: 'needsAction' as const }],
    extendedProperties: homeownerMarker('maria@example.com'),
  }
  assert.deepEqual(noticeStateFromEvent(current), { start: sameInstantOtherFormat, location: '1 Main St', homeownerEmail: 'maria@example.com' })
  assert.equal(noticeStateFromEvent({ ...current, attendees: [current.attendees[1]] }).homeownerEmail, null, 'removed in Google: no longer a guest')
  assert.equal(noticeStateFromEvent({ ...current, extendedProperties: undefined }).homeownerEmail, null, 'an event from before the marker has no homeowner')
  assert.deepEqual(
    carryAttendeeResponses([{ email: 'Maria@example.com' }, { email: 'new@triprosremodeling.com' }], current.attendees),
    [{ email: 'Maria@example.com', responseStatus: 'accepted' }, { email: 'new@triprosremodeling.com' }],
    'the homeowner keeps their Yes across an update',
  )
}
console.log('19. Calendar notices ✓')
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: FAIL to compile, since the new modules do not exist.

- [ ] **Step 3: Types**

In `types.ts` add `GCalSendUpdates`, `GCalAttendee` and `GCalExtendedProperties`, exactly as listed under Interfaces. Add `attendees?: GCalAttendee[]` and `extendedProperties?: GCalExtendedProperties` to `GCalEvent`, and the same two to `GCalEventInput` (replacing its `attendees?: { email: string }[]`).

- [ ] **Step 4: `calendar-notice.ts`**

```ts
import type { GCalAttendee, GCalEvent, GCalEventInput, GCalExtendedProperties, GCalSendUpdates } from '../types'

export type CalendarNotice = 'notify' | 'none'

/** The parts of an event a guest-facing email depends on. */
export interface CalendarNoticeState {
  start: string | null
  location: string | null
  homeownerEmail: string | null
}

const HOMEOWNER_KEY = 'homeownerEmail'

function sameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a?.toLowerCase() ?? null) === (b?.toLowerCase() ?? null)
}

// Google answers with an offset ("…-07:00") where we send UTC ("…Z"), so instants are compared, not strings.
function sameInstant(a: string | null, b: string | null): boolean {
  return a === null || b === null ? a === b : new Date(a).getTime() === new Date(b).getTime()
}

function sameLocation(a: string | null, b: string | null): boolean {
  return (a ?? '').trim() === (b ?? '').trim()
}

// The marker names the homeowner among the guests, so a later sync can tell an added, removed or changed homeowner apart from staff.
export function homeownerMarker(email: string | null): GCalExtendedProperties {
  return { private: { [HOMEOWNER_KEY]: email ?? '' } }
}

export function noticeStateFromInput(input: GCalEventInput): CalendarNoticeState {
  return {
    start: input.start.dateTime ?? null,
    location: input.location ?? null,
    homeownerEmail: input.extendedProperties?.private?.[HOMEOWNER_KEY] || null,
  }
}

// Someone can remove the homeowner in Google Calendar, so the marker counts only while they are still a guest.
export function noticeStateFromEvent(event: GCalEvent): CalendarNoticeState {
  const marked = event.extendedProperties?.private?.[HOMEOWNER_KEY] || null
  const stillGuest = marked != null && (event.attendees ?? []).some(attendee => sameEmail(attendee.email, marked))
  return { start: event.start.dateTime ?? null, location: event.location ?? null, homeownerEmail: stillGuest ? marked : null }
}

/**
 * Whether Google should email the homeowner about this write. Compared against Google's copy, not our history,
 * so a retried job or an edit already made in Google Calendar never sends a second email.
 */
export function decideCalendarNotice(current: CalendarNoticeState | null, next: CalendarNoticeState): CalendarNotice {
  const before = current?.homeownerEmail ?? null
  if (!sameEmail(before, next.homeownerEmail)) {
    return 'notify'
  }
  if (current === null || next.homeownerEmail === null) {
    return 'none'
  }
  return sameInstant(current.start, next.start) && sameLocation(current.location, next.location) ? 'none' : 'notify'
}

export function decideCancellationNotice(input: { homeownerInvited: boolean, scheduledFor: string, now: Date }): CalendarNotice {
  return input.homeownerInvited && new Date(input.scheduledFor).getTime() > input.now.getTime() ? 'notify' : 'none'
}

/**
 * externalOnly keeps staff, who share the company domain, out of the emails. Outside production staff are
 * never guests and the override inbox shares that domain, so only `all` reaches it.
 */
export function toSendUpdates(notice: CalendarNotice, env: { isProduction: boolean }): GCalSendUpdates {
  if (notice !== 'notify') {
    return 'none'
  }
  return env.isProduction ? 'externalOnly' : 'all'
}

// A full-event PUT that lists a guest without their answer can reset it.
export function carryAttendeeResponses(next: GCalAttendee[], current: readonly GCalAttendee[] | undefined): GCalAttendee[] {
  return next.map((attendee) => {
    const responseStatus = current?.find(existing => sameEmail(existing.email, attendee.email))?.responseStatus
    return responseStatus ? { ...attendee, responseStatus } : attendee
  })
}
```

`toSendUpdates` tests `!== 'notify'` on purpose. A delete job queued before Task 3 carries no notice, and it then maps to `none`.

- [ ] **Step 5: `meeting-guests.ts`**

```ts
import type { GCalAttendee } from '../types'

export interface MeetingGuests {
  attendees: GCalAttendee[]
  homeownerEmail: string | null
}

/**
 * Production invites the participants and, once invited, the homeowner. Outside production the dev database
 * holds real people, so staff are never guests and the homeowner is the override inbox or nobody.
 */
export function resolveMeetingGuests(input: {
  isProduction: boolean
  staffEmails: readonly string[]
  invitedHomeownerEmail: string | null
  devOverride: string | null
}): MeetingGuests {
  const staff = input.isProduction ? input.staffEmails : []
  const homeownerEmail = input.isProduction ? input.invitedHomeownerEmail : (input.invitedHomeownerEmail && input.devOverride) || null
  const seen = new Set<string>()
  const attendees: GCalAttendee[] = []
  for (const email of [...staff, ...(homeownerEmail ? [homeownerEmail] : [])]) {
    if (!seen.has(email.toLowerCase())) {
      seen.add(email.toLowerCase())
      attendees.push({ email })
    }
  }
  return { attendees, homeownerEmail }
}
```

- [ ] **Step 6: `map-to-gcal.ts`**

Remove the imports of `publicUrl` and `ROOTS`, so the file is pure. Update `MeetingForGCal` as listed under Interfaces. Replace `buildMeetingDescription` and `meetingToGCalEvent`:

```ts
export interface MeetingEventExtras {
  visitLink: string
  /** Formatted for reading, e.g. "(818) 555-0100". */
  questionsPhone: string
  guests: MeetingGuests
}

// Homeowners may be guests, so the event holds nothing internal: no notes, contact details or dashboard links.
function buildMeetingDescription(meeting: MeetingForGCal, extras: MeetingEventExtras): string {
  const sections: string[] = []
  const note = meeting.visitNote?.trim()
  if (note) {
    sections.push(note)
  }
  if (meeting.tradeSelections.length > 0) {
    const tradeLines = meeting.tradeSelections.map((trade) => {
      const scopes = trade.selectedScopes.map(scope => scope.label).join(', ')
      return scopes ? `• ${trade.tradeName}: ${scopes}` : `• ${trade.tradeName}`
    })
    sections.push(`What we'll look at:\n${tradeLines.join('\n')}`)
  }
  sections.push(`Your visit page: ${extras.visitLink}`)
  sections.push(`Questions? Call or text ${companyInfo.nickname} at ${extras.questionsPhone}`)
  return sections.join('\n\n')
}

export function meetingToGCalEvent(meeting: MeetingForGCal, extras: MeetingEventExtras): GCalEventInput | null {
  if (!meeting.scheduledFor) {
    return null
  }
  const start = new Date(meeting.scheduledFor)
  const end = new Date(start.getTime() + DEFAULT_MEETING_DURATION_MS)
  const colorId = meeting.projectId
    ? GCAL_MEETING_COLORS.Project
    : GCAL_MEETING_COLORS[meeting.meetingType as keyof typeof GCAL_MEETING_COLORS] ?? GCAL_MEETING_COLORS.Fresh
  const customerName = meeting.customerName ?? 'No customer'
  return {
    summary: meeting.projectId ? `Project: ${customerName}` : `Home visit: ${customerName} · ${companyInfo.name}`,
    description: buildMeetingDescription(meeting, extras),
    location: buildMeetingAddress(meeting),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    colorId,
    attendees: extras.guests.attendees,
    extendedProperties: homeownerMarker(extras.guests.homeownerEmail),
  }
}
```

If the Step 1 location assertion disagrees with `buildMeetingAddress`'s existing join, change the assertion to the function's real output: the address format is not part of this task. `formatPhone` is no longer used here; drop its import if lint says so.

- [ ] **Step 7: Run the tests**

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: sections 17–19 pass. `pnpm tsc` now fails only in `scheduling.service.ts` (the new mapper signature). Task 3 fixes that, and the commit hook needs a green tsc, so this task's commit comes at the end of Task 3.

- [ ] **Step 8: Hand off to Task 3 without committing**

This task's files are committed in Task 3's commit, because the signature change breaks `scheduling.service.ts` until Task 3 wires it. The controller dispatches Task 3 to the same implementer (a resume), and the reviewer reviews Tasks 2 and 3 as one diff. The ledger records this.

---

### Task 3: Calendar sync owns every Google email

**Files:**
- Modify: `src/shared/services/providers/google-calendar/client.ts`, `src/shared/services/scheduling.service.ts`, `src/shared/entities/meetings/dal/server/google-calendar.ts`, `src/shared/services/providers/upstash/jobs/delete-meeting-event.ts`, `src/shared/entities/meetings/dal/server/crud.ts`
- Test: a wiring script, `scripts/tmp-calendar-sync.ts` (deleted before commit)

**Interfaces:**
- Consumes: everything Task 2 produced; `voipDidsService.getMainLineDid(): Promise<DalReturn<VoipDid | null>>`; `env.VERCEL_ENV`, `env.EMAIL_DEV_OVERRIDE`.
- Produces:
  - `googleCalendarClient.createEvent(accessToken, calendarId, event, sendUpdates: GCalSendUpdates)`; `updateEvent(accessToken, calendarId, eventId, event, sendUpdates: GCalSendUpdates, etag?: string)`; `deleteEvent(accessToken, calendarId, eventId, sendUpdates: GCalSendUpdates)`; `export class GCalRequestError extends Error { readonly status: number }`.
  - `schedulingService.deleteMeetingEvent(input: { gcalEventId: string, notice: CalendarNotice })`.
  - `deleteMeetingEventJob` payload `{ gcalEventId: string, notice: CalendarNotice }`.
  - `meetingCrud` update triggers a sync for `scheduledFor`, `meetingType`, `projectId`, `visitNote` and `homeownerInvitedAt` (not `agentNotes`); create skips the sync for a replacement.

- [ ] **Step 1: Client**

In `client.ts`:
- `handleResponse` throws `new GCalRequestError(res.status, \`Google Calendar ${context} failed (${res.status}): ${body}\`)`, with `export class GCalRequestError extends Error { constructor(readonly status: number, message: string) { super(message) } }`;
- `createEvent`, `updateEvent` and `deleteEvent` take `sendUpdates: GCalSendUpdates` with the signatures above, and append `?sendUpdates=${sendUpdates}` to the event URL;
- `deleteEvent` keeps tolerating 404, and also tolerates 410, which Google returns for an already-deleted event. Throw `GCalRequestError` otherwise.

Find every caller with `grep -rn "googleCalendarClient\.\(create\|update\|delete\)Event" src`. Activity callers pass `'none'`: activities have no guests.

- [ ] **Step 2: Meeting read**

`getMeetingForGCal` drops `agentNotes` and `customerPhone`, and selects `visitNote: meetings.visitNote`, `homeownerInvitedAt: meetings.homeownerInvitedAt` and `shareToken: meetings.shareToken`. It returns them on the `MeetingForGCal` object.

- [ ] **Step 3: Scheduling service**

In `scheduling.service.ts`:

```ts
const isProduction = env.VERCEL_ENV === 'production'
const TRI_PROS_CALENDAR_NAME = isProduction ? 'Tri Pros Schedule' : 'Tri Pros Schedule (DEV)'

// The main line is the number that answers texts; the office line stands in until one is configured.
async function resolveQuestionsPhone(): Promise<string> {
  const mainLine = await voipDidsService.getMainLineDid()
  const fallback = companyInfo.contactInfo.find(item => item.accessor === 'phone')!.value
  return formatPhone((mainLine.success && mainLine.data?.e164) || fallback)
}

function buildMeetingEvent(meeting: MeetingForGCal, questionsPhone: string): GCalEventInput | null {
  const guests = resolveMeetingGuests({
    isProduction,
    staffEmails: meeting.participantEmails,
    invitedHomeownerEmail: meeting.homeownerInvitedAt ? meeting.customerEmail : null,
    devOverride: env.EMAIL_DEV_OVERRIDE || null,
  })
  return meetingToGCalEvent(meeting, {
    visitLink: publicUrl(ROOTS.public.homeVisit(meeting.id, meeting.shareToken)),
    questionsPhone,
    guests,
  })
}
```

Check how `formatPhone` handles E.164 and bare national digits; it accepts both. Rewrite `pushMeetingEventToCalendar`:

```ts
async function pushMeetingEventToCalendar(auth, calendarId, meetingId, meeting): Promise<void> {
  const payload = buildMeetingEvent(meeting, await resolveQuestionsPhone())
  if (!payload) {
    if (meeting.gcalEventId) {
      await googleCalendarClient.deleteEvent(auth.accessToken, calendarId, meeting.gcalEventId, 'none')
      await clearMeetingGCalFields(meetingId)
    }
    return
  }

  const write = async (event: GCalEventInput) => {
    if (meeting.gcalEventId) {
      const current = await googleCalendarClient.getEvent(auth.accessToken, calendarId, meeting.gcalEventId)
      const notice = decideCalendarNotice(noticeStateFromEvent(current), noticeStateFromInput(event))
      const withResponses = { ...event, attendees: carryAttendeeResponses(event.attendees ?? [], current.attendees) }
      const updated = await googleCalendarClient.updateEvent(auth.accessToken, calendarId, meeting.gcalEventId, withResponses, toSendUpdates(notice, { isProduction }), meeting.gcalEtag ?? undefined)
      await updateMeetingGCalFields(meetingId, { gcalEtag: updated.etag, gcalSyncedAt: new Date().toISOString() })
      return
    }
    const notice = decideCalendarNotice(null, noticeStateFromInput(event))
    const created = await googleCalendarClient.createEvent(auth.accessToken, calendarId, event, toSendUpdates(notice, { isProduction }))
    await updateMeetingGCalFields(meetingId, { gcalEventId: created.id, gcalEtag: created.etag, gcalSyncedAt: new Date().toISOString() })
  }

  const homeownerEmail = noticeStateFromInput(payload).homeownerEmail
  try {
    await write(payload)
  }
  catch (error) {
    // Google refuses an address it cannot invite with a 400; the visit still belongs on the office calendar, and the stored intent stays for a corrected email.
    if (!homeownerEmail || !(error instanceof GCalRequestError) || error.status !== 400) {
      throw error
    }
    console.error('[scheduling] Google refused the homeowner as a guest; syncing without them', { meetingId, error })
    await write({
      ...payload,
      attendees: (payload.attendees ?? []).filter(attendee => attendee.email.toLowerCase() !== homeownerEmail.toLowerCase()),
      extendedProperties: homeownerMarker(null),
    })
  }
}
```

Type the parameters as the existing function does. `deleteMeetingEvent` becomes:

```ts
deleteMeetingEvent: async (input: { gcalEventId: string, notice: CalendarNotice }): Promise<void> => {
  const ctx = await resolveSystemCalendarAuth()
  if (!ctx) {
    return
  }
  await googleCalendarClient
    .deleteEvent(ctx.auth.accessToken, ctx.calendarId, input.gcalEventId, toSendUpdates(input.notice, { isProduction }))
    .catch((err) => {
      console.error(`[scheduling] deleteMeetingEvent failed for ${input.gcalEventId}:`, err)
    })
},
```

In `connectCalendar`, the meeting backfill uses `buildMeetingEvent(meeting, questionsPhone)` (resolve the phone once, before the loop) and `createEvent(…, 'none')`. Add a comment: `// A one-time import: homeowners already invited know about their visit, so the backfill emails nobody.` The activity backfill and `syncActivity` pass `'none'`. `propagateCustomerChange` already goes through `pushMeetingEventToCalendar`. Leave the docblocks and comments on unchanged functions alone.

- [ ] **Step 4: Job and hooks**

`delete-meeting-event.ts`: payload `{ gcalEventId: string, notice: CalendarNotice }`, passed straight to `schedulingService.deleteMeetingEvent`. Add one line to its docblock: the notice is decided when the meeting changes, since the row may be gone when the job runs.

`crud.ts`:
- `create.after`: `if (row.scheduledFor && !row.rescheduledFromId)`, with the comment `// A replacement takes over the original's event in the reschedule flow, which syncs it after the hand-off; a sync here would create a second event.`
- `update.after` `gcalFieldChanged`: `'scheduledFor' in data || 'meetingType' in data || 'projectId' in data || 'visitNote' in data || 'homeownerInvitedAt' in data`, and the comment above it becomes `// The fields the event is built from, and the homeowner's invite.`
- the cancelled transition: delete the `sendVisitCancellationJob` dispatch and its import, and dispatch `deleteMeetingEventJob.dispatchOrThrow({ gcalEventId: row.gcalEventId, notice: decideCancellationNotice({ homeownerInvited: row.homeownerInvitedAt != null, scheduledFor: row.scheduledFor, now: new Date() }) })`. Replace the comment `// After the shared-calendar cleanup…` and the next line with nothing; keep `// A newly-cancelled meeting leaves the shared calendar; the row is kept.` and add `Google emails an invited homeowner its cancellation, unless the visit is already past.`
- `delete.before`: the same notice, from `row`.

- [ ] **Step 5: Wiring check**

Write `scripts/tmp-calendar-sync.ts`. It reads one existing dev meeting with a customer email and makes **no database writes**: it calls the pieces, not `syncMeeting`. Intercept `googleCalendarClient.getEvent`, `createEvent` and `updateEvent` to capture their arguments and return a canned `GCalEvent`. Then:
1. `getMeetingForGCal(<id>)`: assert `shareToken`, `visitNote` and `homeownerInvitedAt` are present on the object.
2. Call the module-private `buildMeetingEvent` through a temporary export only if needed. Otherwise assert through `schedulingService.syncMeeting(<id>)` with `updateMeetingGCalFields` intercepted too (it is a module import, so intercept by stubbing `googleCalendarClient` to throw after capturing, and catch). Pick the variant that needs no write, and say which in the report.
3. Assert: outside production with `homeownerInvitedAt` null, the captured payload has `attendees: []`, and `sendUpdates` is `none`.

If no pure route exists for step 2 without a write, skip the wiring script. Say so in the report; Task 7's owner checks cover it.

- [ ] **Step 6: Verify and commit (with Task 2's files)**

Run: `pnpm tsx scripts/verify-visit-messages.ts && pnpm tsc && pnpm lint`
Expected: all green.

```bash
git add src/shared/services/providers/google-calendar/types.ts src/shared/services/providers/google-calendar/lib/map-to-gcal.ts src/shared/services/providers/google-calendar/lib/calendar-notice.ts src/shared/services/providers/google-calendar/lib/meeting-guests.ts src/shared/services/providers/google-calendar/client.ts src/shared/services/scheduling.service.ts src/shared/entities/meetings/dal/server/google-calendar.ts src/shared/services/providers/upstash/jobs/delete-meeting-event.ts src/shared/entities/meetings/dal/server/crud.ts scripts/verify-visit-messages.ts && git commit -m "feat(calendar): the meeting event is homeowner-safe, the homeowner joins it once invited, and Google sends the invite, the updates and the cancellation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Reschedule hands over the visit; the original reads `rescheduled`

**Files:**
- Create: `src/shared/modules/meetings/core/lib/rescheduled-original-outcome.ts`
- Modify: `src/shared/entities/meetings/dal/server/mutations.ts`, `src/shared/modules/meetings/business/service.ts` (`reschedule` only)
- Test: `scripts/verify-visit-messages.ts`; wiring script `scripts/tmp-reschedule-order.ts` (deleted before commit; needs Task 1's dev push)

**Interfaces:**
- Consumes: `syncMeetingToGcalJob.dispatchOrThrow({ meetingId })`; `customerNoteCrud.create(ctx, { customerId, content, entityType, entityId })`; Task 3's `create.after` skip.
- Produces: `rescheduledOriginalOutcome(outcome: MeetingOutcome): 'rescheduled' | null`; `handOffVisit(input: { fromMeetingId: string, toMeetingId: string }): Promise<DalReturn<void>>` (replaces `handOffShareToken`, which is deleted).

- [ ] **Step 1: Write the failing test**

```ts
{
  assert.equal(rescheduledOriginalOutcome('not_set'), 'rescheduled')
  assert.equal(rescheduledOriginalOutcome('reschedule_needed'), 'rescheduled')
  assert.equal(rescheduledOriginalOutcome('no_show'), null, 'a no-show rebooked keeps its no-show')
  assert.equal(rescheduledOriginalOutcome('cancelled'), null, 'a cancellation rebooked keeps its cancellation')
}
console.log('20. Reschedule original outcome ✓')
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: The rule**

```ts
import type { MeetingOutcome } from '@/shared/constants/enums/meetings'

/** A visit moved before it happened reads `rescheduled`; a no-show or cancellation being rebooked keeps what really happened. */
export function rescheduledOriginalOutcome(outcome: MeetingOutcome): 'rescheduled' | null {
  return outcome === 'not_set' || outcome === 'reschedule_needed' ? 'rescheduled' : null
}
```

- [ ] **Step 4: `handOffVisit`**

Replace `handOffShareToken` in `mutations.ts`:

```ts
/**
 * The link, the calendar event and the invite belong to the visit: after a reschedule the homeowner's link opens the
 * replacement, and Google updates the one event they already have. One transaction and raw updates, so no meeting
 * hook fires and the unique index never sees two rows with one token.
 */
export async function handOffVisit(input: { fromMeetingId: string, toMeetingId: string }): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    await db.transaction(async (tx) => {
      const [from] = await tx
        .select({
          shareToken: meetings.shareToken,
          gcalEventId: meetings.gcalEventId,
          gcalEtag: meetings.gcalEtag,
          gcalSyncedAt: meetings.gcalSyncedAt,
          homeownerInvitedAt: meetings.homeownerInvitedAt,
        })
        .from(meetings)
        .where(eq(meetings.id, input.fromMeetingId))
        .for('update')
      if (!from) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      await tx.update(meetings)
        .set({ shareToken: generateToken(), gcalEventId: null, gcalEtag: null, gcalSyncedAt: null, homeownerInvitedAt: null })
        .where(eq(meetings.id, input.fromMeetingId))
      await tx.update(meetings).set(from).where(eq(meetings.id, input.toMeetingId))
    })
  })
}
```

`grep -rn handOffShareToken src scripts` must come back empty afterwards.

- [ ] **Step 5: The reschedule order**

In `meetingBusinessService.reschedule`, after the participants loop, replace everything up to the note:

```ts
      // The hand-off comes first: once the original stops being live, nothing may still find an event on it.
      const handOff = await handOffVisit({ fromMeetingId: original.id, toMeetingId: replacement.id })
      if (!handOff.success) {
        throw new ThrowableDalError({
          type: 'precondition-failed',
          reason: 'Meeting rescheduled, but the visit link and calendar event did not carry over to the new meeting.',
        })
      }

      const originalOutcome = rescheduledOriginalOutcome(original.meetingOutcome)
      if (originalOutcome) {
        dalVerifySuccess(await meetingCrud.update(ctx, { id: input.meetingId, data: { meetingOutcome: originalOutcome } }))
      }

      // One sync after the hand-off: Google moves the event the homeowner already has and sends one updated invitation.
      await syncMeetingToGcalJob.dispatchOrThrow({ meetingId: replacement.id })
```

The replacement's `create` input adds `visitNote: original.visitNote ?? undefined`. The note becomes `customerNoteCrud.create(ctx, { customerId: original.customerId, content: buildRescheduleNote(…), entityType: 'meeting', entityId: replacement.id })`. Rewrite the method's docblock:

```ts
  /**
   * Books the same visit in a new slot: the replacement carries the owner, participants, customer, project, type,
   * setter, flow state and visit note, and takes over the link, the calendar event and the invite. The original
   * then reads `rescheduled`, or keeps a no-show or cancellation it already had.
   * Not one transaction: meetingCrud's after-hooks dispatch jobs and write participants outside one.
   * The replacement is created first, so a failure never leaves a moved visit with nothing after it.
   */
```

Delete the old comment `// Once the replacement exists a failure has to say so…`. Its rule now sits in the new error text. Import `syncMeetingToGcalJob` and `rescheduledOriginalOutcome`.

- [ ] **Step 6: Run the pure tests**

Run: `pnpm tsx scripts/verify-visit-messages.ts && pnpm tsc`
Expected: section 20 passes; tsc is clean.

- [ ] **Step 7: Wiring check (after the owner's dev push)**

`scripts/tmp-reschedule-order.ts`:
- intercept the `dispatchOrThrow` / `dispatch` of `syncMeetingToGcalJob`, `deleteMeetingEventJob`, `graduateFromCampaignJob`, `metaCapiEventJob` and `notifyMeetingTimeChangedJob`, plus `realtimeClient.publish`, each capturing `{ job, payload }`;
- insert one throwaway customer with raw `db` (name `ZZ wiring <timestamp>`, no phone, email `wiring@example.invalid`);
- create the original through `meetingService.create(SYSTEM_CONTEXT, { customerId, meetingType: 'Fresh', scheduledFor: <+3 days>, visitNote: 'Gate code 1234' })`;
- with raw `db`, set the original's `gcalEventId: 'evt-wiring'`, `gcalEtag: 'etag-wiring'` and `homeownerInvitedAt: now` (a row this script created);
- call `meetingService.business.reschedule(SYSTEM_CONTEXT, { meetingId, newScheduledFor: <+4 days>, reason: 'wiring' })`.

Assert:
- the replacement has the original's share token, `gcalEventId 'evt-wiring'`, `homeownerInvitedAt` set, `visitNote 'Gate code 1234'` and `homeownerConfirmedAt` null;
- the original has a new share token, null `gcalEventId` and `homeownerInvitedAt`, and outcome `rescheduled`;
- the captured jobs hold exactly one `sync-meeting-to-gcal`, for the replacement, and no `delete-meeting-event`;
- one customer note has `entityType: 'meeting'` and `entityId` = the replacement.

Then repeat with a fresh original set to `no_show` through raw `db` before the reschedule. Assert it keeps `no_show`.

In `finally`, delete the notes, meetings and participants this script created, then the customer. Run with `DRIZZLE_TARGET=dev NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-reschedule-order.ts`, paste the output into the report, delete the script.

- [ ] **Step 8: Commit**

```bash
git add src/shared/modules/meetings/core/lib/rescheduled-original-outcome.ts src/shared/entities/meetings/dal/server/mutations.ts src/shared/modules/meetings/business/service.ts scripts/verify-visit-messages.ts && git commit -m "feat(meetings): a reschedule hands the link, the calendar event and the invite to the new meeting before the original reads rescheduled; a rebooked no-show keeps its no-show

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The welcome text invites; our visit emails go

**Files:**
- Modify: `src/shared/modules/meetings/messages/constants/templates.ts`, `constants/kinds.ts`, `types.ts`, `lib/render-visit-message.ts`, `lib/deliver-visit-text.ts`, `lib/validate-visit-message-template.ts` (only if it names `coordinator_note`), `dal/server/queries.ts`, `dal/server/mutations.ts`; `src/shared/modules/meetings/business/service.ts`; `src/trpc/routers/meetings.router/business.router.ts`; `src/shared/services/email.service.ts`; `src/shared/services/providers/resend/lib/render-emails.tsx`; `src/app/api/qstash-jobs/route.ts`; `scripts/visit-messages.ts`; `scripts/verify-visit-messages.ts`
- Delete: the seven files listed under the File map.

**Interfaces:**
- Consumes: `Meeting.visitNote`, `Meeting.homeownerInvitedAt` (Task 1); the sync trigger on `homeownerInvitedAt` (Task 3).
- Produces: `visitInviteResults = ['invited', 'already_invited', 'no_email'] as const`, `type VisitInviteResult`; `meetingService.business.sendVisitSummary(ctx, { meetingId }): Promise<DalReturn<{ sms: MeetingMessage, invite: VisitInviteResult }>>`; `VisitMessageVars.visitNote: string` (replaces `coordinatorNote`); `VisitMessageContext.meeting` gains `visitNote` and `homeownerInvitedAt`.

- [ ] **Step 1: Rename the token in the tests first**

In `scripts/verify-visit-messages.ts`, replace every `coordinator_note` with `visit_note` and every `coordinatorNote` with `visitNote`. Then add:

```ts
{
  const vars = buildVisitMessageVars({ customerName: 'Maria Lopez', specialistName: null, coordinatorName: 'Dana', scheduledFor: '2026-10-20T17:00:00.000Z', visitLink: 'https://example.com/v', visitNote: 'Please park in the driveway.' })
  const withNote = renderVisitMessage(VISIT_MESSAGE_TEMPLATE_DEFAULTS.visit_summary, vars, { stopLine: true })
  assert.ok(withNote.includes('One more thing: Please park in the driveway.'), withNote)
  const withoutNote = renderVisitMessage(VISIT_MESSAGE_TEMPLATE_DEFAULTS.visit_summary, { ...vars, visitNote: '' }, { stopLine: true })
  assert.ok(!withoutNote.includes('One more thing'), 'the section drops out with no note')
  assert.ok(!/calendar|\.ics/i.test(withNote), 'the welcome text carries no calendar link')
}
console.log('21. Welcome text and the visit note ✓')
```

Delete sections 4 (Calendar invite), 11 (Cancellation rule) and 14 (Google Calendar link), and their imports. Renumber nothing: section numbers are labels.

If the owner adopted the STOP-line rewording (ledger ruling), update every expected string in section 6 that ends with "Reply STOP to opt out." to the new `VISIT_MESSAGE_STOP_LINE` text and placement. Check what the renderer's `/^reply\b/i` join does with it, and assert that output. If the new line should not join a "Reply YES…" line, record that as a question for the controller rather than changing the renderer.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: FAIL to compile on `visitNote`.

- [ ] **Step 3: Rename through the messages module**

- `templates.ts`: the token row becomes `{ token: 'visit_note', label: 'Visit note', sample: '', resolve: vars => vars.visitNote }`. `VISIT_MESSAGE_SUMMARY_ONLY_TOKENS = ['visit_note']`, with the comment `/** The visit note is said once, in the welcome text. */`. In the `visit_summary` default, `{{#coordinator_note}}One more thing: {{coordinator_note}}{{/coordinator_note}}` becomes `{{#visit_note}}One more thing: {{visit_note}}{{/visit_note}}`. Leave `VISIT_MESSAGE_STOP_LINE` as the ledger ruling says.
- `types.ts`: `coordinatorNote: string` becomes `visitNote: string`.
- `render-visit-message.ts`: input `visitNote?: string | null`; output `visitNote: (input.visitNote ?? '').replace(/\s+/g, ' ').trim()`.
- `queries.ts`: `VisitMessageContext.meeting` picks `visitNote` and `homeownerInvitedAt` too; `listContexts` selects them.
- `deliver-visit-text.ts`: drop the `coordinatorNote` input; pass `visitNote: meeting.visitNote` to `buildVisitMessageVars`.
- `kinds.ts`: add

```ts
/** What the welcome text did about the calendar invite. The meeting column is the record; Google's delivery is not tracked. */
export const visitInviteResults = ['invited', 'already_invited', 'no_email'] as const
export type VisitInviteResult = (typeof visitInviteResults)[number]
```

and, above `meetingMessageKinds`, `// visit_cancellation and the email channel describe rows from before Google sent the invite and the cancellation.`

- [ ] **Step 4: `sendVisitSummary` sends the text and stores the invite**

```ts
  /**
   * The meeting welcome text. The setter sends it during the booking call, and staff resend it after a time change.
   * It also invites the homeowner to the visit's calendar event, whatever the text's outcome: the calendar sync sends
   * Google's invite.
   */
  async sendVisitSummary(
    ctx: ScopedContext,
    input: { meetingId: string },
  ): Promise<DalReturn<{ sms: MeetingMessage, invite: VisitInviteResult }>> {
    return dalDbOperation(async () => {
      // The scoped read is the visibility check; the unscoped context read is for the send.
      const meeting = dalVerifySuccess(await meetingCrud.getById(ctx, { id: input.meetingId }))
      if (!meeting) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      if (!isVisitMessageEligible(meeting, new Date())) {
        throw new ThrowableDalError({ type: 'precondition-failed', reason: 'Visit messages go to upcoming, undecided, non-project meetings only.' })
      }
      if (!dalVerifySuccess(await voipDidsService.getMainLineDid())) {
        throw new ThrowableDalError({ type: 'precondition-failed', reason: 'No main line is configured.' })
      }
      const context = await getVisitMessageContext(meeting.id)
      if (!context) {
        throw new ThrowableDalError({ type: 'not-found' })
      }

      const text = await deliverVisitText(ctx, {
        context,
        templateKey: 'visit_summary',
        bodies: await getTemplateBodies(),
        mediaUrl: [publicUrl('/api/company/vcard')],
      })
      const sms = dalVerifySuccess(await meetingMessageCrud.create(ctx, {
        meetingId: meeting.id,
        kind: 'visit_summary',
        channel: 'sms',
        forScheduledFor: meeting.scheduledFor,
        status: text.status,
        reason: text.reason,
        voipMessageId: text.voipMessageId,
        actorUserId: ctx.session?.user.id ?? null,
      }))

      let invite: VisitInviteResult
      if (!context.customer?.email) {
        invite = 'no_email'
      }
      else if (meeting.homeownerInvitedAt) {
        invite = 'already_invited'
      }
      else {
        dalVerifySuccess(await meetingCrud.update(ctx, { id: meeting.id, data: { homeownerInvitedAt: new Date().toISOString() } }))
        invite = 'invited'
      }
      return { sms, invite }
    })
  },
```

Delete `sendVisitCancellation` from the business service, with its now-unused imports (`deliver-visit-email`, `should-send-visit-cancellation`, `claimAutomaticSend` and `setMeetingMessageOutcome` if nothing else uses them, `listChainMessages`, `getRescheduleChain`, `getRescheduleSuccessorId` if unused). Let tsc and lint find the rest.

- [ ] **Step 5: Remove the visit emails and the cancellation job**

- Delete the seven files in the File map's deleted list.
- `email.service.ts`: delete `sendVisitSummaryEmail` and `sendVisitCancellationEmail` and their type imports. Delete `buildSenderFrom`, `Buffer` and any other import only they used. Check with `grep -n buildSenderFrom -r src` first.
- `render-emails.tsx`: delete `renderVisitSummaryEmail`, `renderVisitCancellationEmail` and their imports.
- `src/app/api/qstash-jobs/route.ts`: remove `sendVisitCancellationJob` from the import and the `jobs` array.
- `messages/dal/server/mutations.ts`: `AutomaticKind` becomes `Extract<MeetingMessageKind, 'day_before_reminder' | 'rep_confirmation'>`. Leave the index in `schema/meeting-messages.ts` alone (P12).
- `business.router.ts`: `sendVisitSummary` input is `z.object({ meetingId: z.string().uuid() })`.
- `scripts/visit-messages.ts`: `summary` drops `--note`, and prints `sms: …` then `invite: ${result.invite}`. Delete the `cancel` command, its usage line in the header comment and the `default` usage string.

Then `grep -rn "coordinator_note\|coordinatorNote\|VisitSummaryEmail\|VisitCancellation\|visit-cancellation\|buildIcs\|build-ics\|google-calendar-link\|shouldSendVisitCancellation" src scripts` must come back empty, except `visit_cancellation` in `kinds.ts` and `schema/meeting-messages.ts`.

- [ ] **Step 6: Run everything**

Run: `pnpm tsx scripts/verify-visit-messages.ts && pnpm tsc && pnpm lint && pnpm exec eslint scripts/visit-messages.ts scripts/verify-visit-messages.ts`
Expected: all green, section 21 included.

- [ ] **Step 7: Wiring check for the invite result**

`scripts/tmp-welcome-invite.ts`:
- intercept `voipMessagesService.sendFromMainLine` (return a canned `dalSuccess({ messageId: null, status: 'sent', failureReason: null })` in the shape `deliverVisitText` reads; check `voip-messages.service.ts` for the exact type), every job dispatch slot and `realtimeClient.publish`;
- if `getMainLineDid` returns null in dev, intercept `voipDidsService.getMainLineDid` with a canned DID;
- insert a throwaway customer with raw `db` (email `wiring@example.invalid`, phone `8185550100`), and create a meeting `+3 days` through `meetingService.create(SYSTEM_CONTEXT, …)`.

Assert:
1. the first call returns `invite: 'invited'`, sets `homeownerInvitedAt`, and captures one `sync-meeting-to-gcal`;
2. the second call returns `'already_invited'` and captures no new sync;
3. with the customer's email nulled through raw `db`, a third meeting returns `'no_email'` and `homeownerInvitedAt` stays null.

Clean up every row in `finally` (meeting messages, meetings, participants, customer). Paste the output, delete the script.

- [ ] **Step 8: Commit**

Stage every modified and deleted path by name (`git add -u <path>` for the deleted files, or `git rm` them in this commit). Follow the ledger ruling on the `templates.ts` STOP-line hunk.

```bash
git add <modified paths> && git rm <deleted paths> && git commit -m "feat(visit-messages): the meeting welcome text invites the homeowner to the calendar event and speaks the meeting's visit note; Google's emails replace ours

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Visit note and internal notes on the meeting

**Files:**
- Create: `src/shared/entities/customer-notes/dal/server/queries.ts`, `src/shared/entities/meetings/components/meeting-notes-dialog.tsx`
- Modify: `src/shared/modules/meetings/business/service.ts` (`listInternalNotes`), `src/trpc/routers/meetings.router/reads.router.ts`, `src/shared/entities/meetings/components/create-meeting-form.tsx`, `src/shared/entities/customers/components/timeline/quick-note-input.tsx`, `src/shared/entities/meetings/constants/actions.ts`, `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx`, `src/shared/modules/meetings/core/components/meeting-actions-host.tsx`

**Interfaces:**
- Consumes: `VISIT_NOTE_FIELD`, `INTERNAL_NOTE_FIELD`, `VISIT_NOTE_MAX_LENGTH` (Task 1); `CustomerNoteWithAuthor` (`@/shared/entities/customers/types`); `useCustomerNoteActions(customerId)` returning `{ createNote, updateNote, deleteNote }`; `useCustomerNoteActionConfigs({ customerId, onEdit })`; `trpc.meetingsRouter.crud.update`, `trpc.customerNotesRouter.crud.create`.
- Produces: `listNotesForEntity(input: { customerId: string, entityType: CustomerNoteEntityType, entityId: string }): Promise<CustomerNoteWithAuthor[]>`; `meetingService.business.listInternalNotes(ctx, { meetingId }): Promise<DalReturn<CustomerNoteWithAuthor[]>>`; `trpc.meetingsRouter.reads.internalNotes({ meetingId })`; `MEETING_ACTIONS.notes`; `onEditNotes` override on `useMeetingActionConfigs`; `QuickNoteInput`'s optional `link?: { entityType: CustomerNoteEntityType, entityId: string }`.

Before writing UI, read `docs/design-system/theme-conventions.md` §12 (self-check) and `src/shared/entities/customers/components/timeline/timeline-event-item.tsx` (how a note row renders its action menu and inline edit). Compose existing pieces, and invent no new primitives.

- [ ] **Step 1: Read path**

`customer-notes/dal/server/queries.ts`. Select the same columns and author join `get-customer-profile.ts` uses for its notes (copy that projection exactly, so the result is `CustomerNoteWithAuthor`):

```ts
/** Notes linked to one thing the customer owns, newest first. The customer id keeps a link to another customer's entity from showing. */
export async function listNotesForEntity(input: { customerId: string, entityType: CustomerNoteEntityType, entityId: string }): Promise<CustomerNoteWithAuthor[]> {
  // select … from customer_notes left join user on author
  // where customer_id = input.customerId and entity_type = input.entityType and entity_id = input.entityId
  // order by created_at desc
}
```

Business verb in `meetingBusinessService`:

```ts
  /** The meeting's internal notes. The scoped read is the visibility check. */
  async listInternalNotes(ctx: ScopedContext, input: { meetingId: string }): Promise<DalReturn<CustomerNoteWithAuthor[]>> {
    return dalDbOperation(async () => {
      const meeting = dalVerifySuccess(await meetingCrud.getById(ctx, { id: input.meetingId }))
      if (!meeting) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      return meeting.customerId ? listNotesForEntity({ customerId: meeting.customerId, entityType: 'meeting', entityId: meeting.id }) : []
    })
  },
```

`reads.router.ts`: `internalNotes: meetingProcedure.input(z.object({ meetingId: z.string().uuid() })).query(async ({ ctx, input }) => dalToTrpc(await meetingService.business.listInternalNotes(ctx, input)))`.

- [ ] **Step 2: `QuickNoteInput` can link**

Add `link?: { entityType: CustomerNoteEntityType, entityId: string }` to its props. Pass `{ customerId, content, ...link }` to `createNote.mutate`. Add an optional `placeholder` prop, defaulting to today's "Add a note...". No other change.

- [ ] **Step 3: The create form**

In `create-meeting-form.tsx`:
- state `visitNote` and `internalNote` (strings, `''`), reset in the create `onSuccess` like the other fields;
- two fields after Trades & scopes. Each is a `Label`, a `Textarea` (rows 2, `maxLength={VISIT_NOTE_MAX_LENGTH}` on the visit note) and the helper copy as `<p className="text-muted-foreground text-xs">`. All copy comes from `VISIT_NOTE_FIELD` / `INTERNAL_NOTE_FIELD`;
- create: send `visitNote: visitNote.trim() || undefined` in the `create.mutate` input. In the create mutation's `onSuccess(created)`, when `internalNote.trim()` is set, call `trpc.customerNotesRouter.crud.create` (a second `useMutation`) with `{ customerId, content: internalNote.trim(), entityType: 'meeting', entityId: created.id }`, and call `onSuccess?.()` after it settles. A note that fails shows `toast.error('Meeting created, but the internal note did not save.')`, and the dialog still closes;
- the unreachable edit branch (P5) is unchanged; the fields render in both modes, and the edit branch ignores them. Add no comment about it.

- [ ] **Step 4: The Notes dialog**

`meeting-notes-dialog.tsx` exports `MeetingNotesDialog({ meetingId, open, onOpenChange })`, using `Dialog`/`DialogContent` as `customer-profile-command-dialogs.tsx` does, titled "Notes". It contains:

1. **Visit note**:
   - `useQuery(trpc.meetingsRouter.reads.getByIdWithJoins.queryOptions({ id: meetingId }, { enabled: open }))` gives `visitNote` and `customerId`;
   - a `Textarea` seeded from it, the `VISIT_NOTE_FIELD` label and helper, and a Save button that runs `trpc.meetingsRouter.crud.update` with `{ id: meetingId, data: { visitNote: value.trim() || null } }`;
   - Save is disabled while unchanged. On success, invalidate that query and `toast.success('Visit note saved')`.
2. **Internal notes**:
   - `useQuery(trpc.meetingsRouter.reads.internalNotes.queryOptions({ meetingId }, { enabled: open }))`;
   - each note shows its content, author and date, and the existing note action menu from `useCustomerNoteActionConfigs({ customerId, onEdit })` through the same entity-actions component `timeline-event-item.tsx` uses, gated by its `canManage(note)`;
   - `onEdit` swaps that row for a `Textarea` with Save/Cancel that calls `updateNote.mutate({ id, data: { content } })`. Render `<DeleteConfirmDialog />` once;
   - below the list, `<QuickNoteInput customerId={customerId} link={{ entityType: 'meeting', entityId: meetingId }} placeholder={INTERNAL_NOTE_FIELD.placeholder} onSuccess={…} />`;
   - every successful create, update or delete invalidates `internalNotes`. `useCustomerNoteActions` already refreshes the customer profile.
   - Empty state: one muted line, "No internal notes yet.".

- [ ] **Step 5: The Notes action**

- `actions.ts`: `notes: { id: 'notes', label: 'Notes', icon: StickyNoteIcon, permission: ['update', 'Meeting'] }`, placed after `reschedule`.
- `use-meeting-action-configs.tsx`: add `onEditNotes?: (entity: T) => void` to the overrides, and push `{ action: MEETING_ACTIONS.notes, onAction: overrides.onEditNotes }` right after the reschedule config when it is provided, as `assignProject` is.
- `meeting-actions-host.tsx`: `const [notesMeetingId, setNotesMeetingId] = useState<string | null>(null)`, pass `onEditNotes: entity => setNotesMeetingId(entity.id)`, and render `<MeetingNotesDialog meetingId={notesMeetingId ?? ''} open={notesMeetingId !== null} onOpenChange={open => !open && setNotesMeetingId(null)} />` beside the participants modal. Mount the dialog only while `notesMeetingId` is set, so a closed host runs no queries: `{notesMeetingId && <MeetingNotesDialog … />}`.

- [ ] **Step 6: Verify by eye**

Run `pnpm tsc && pnpm lint`. Then check the dev server with `ss -ltnp | grep -E ':300[0-9]'` (never `rm -rf .next` while one runs), sign in through `/api/dev/playwright-session`, and screenshot at 1280 px and 390 px, light and dark:
1. the Add meeting dialog from a customer profile, with both note fields;
2. the meeting ⋯ menu showing Notes;
3. the Notes dialog with a visit note and one internal note in edit mode.

**Do not submit any form**: that would write to the dev database. Open, type, and screenshot only. Put the screenshot paths in the report, and run the §12 self-check against them.

- [ ] **Step 7: Commit**

```bash
git add src/shared/entities/customer-notes/dal/server/queries.ts src/shared/modules/meetings/business/service.ts src/trpc/routers/meetings.router/reads.router.ts src/shared/entities/meetings/components/create-meeting-form.tsx src/shared/entities/meetings/components/meeting-notes-dialog.tsx src/shared/entities/customers/components/timeline/quick-note-input.tsx src/shared/entities/meetings/constants/actions.ts src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx src/shared/modules/meetings/core/components/meeting-actions-host.tsx && git commit -m "feat(meetings): the meeting form takes a note for the homeowner and an internal note, and a Notes action edits both

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Records and the owner gate

**Files:**
- Modify, only if `git status` shows it unmodified: `docs/plans/2026-10-01-sales-lifecycle-rules-map.md`
- Ledger: `.superpowers/sdd/<this plan's workspace>/progress.md`

- [ ] **Step 1: The lifecycle map**

If `docs/plans/2026-10-01-sales-lifecycle-rules-map.md` has no uncommitted changes:
- row M5 becomes "Replacement created (2nd CAPI `Schedule`); original → `rescheduled` (from `not_set`/`reschedule_needed`; a `no_show`/`cancelled` original keeps its outcome); pipelines ignore it; no transaction.";
- row S2 marks the question resolved: "the original leaves the lead pipelines (owner, 2026-10-12)";
- the table row near line 326 reads "original `rescheduled`, replacement `not_set`".

Commit it alone. If the file is modified by another session, record in the ledger: "lifecycle map M5/S2 update pending: file held by another session".

- [ ] **Step 2: Follow-ups for the permissions branch (wt 285)**

Do not edit `.worktrees/issue-285`. Write these two items into the ledger, for whoever next merges `main` into `refactor/285-refactor-permissions-casl-scope-compiler`:
- add `rescheduled` to `MEETING_OUTCOME_CLASS` as neutral / did-not-occur (tsc there will demand it once `main` is merged, if the map is a `Record<MeetingOutcome, …>`);
- add `visitNote` and `homeownerInvitedAt` to the meeting field lists (read and update), with the reach of `agentNotes`.

- [ ] **Step 3: Owner gate (dev)**

The controller hands the owner this list and waits:

0. **Connect the dev calendar.** Optionally delete the stale "Tri Pros Schedule (DEV)" in Google Calendar first. Then connect from dev settings, with `pnpm dev:mobile` running so QStash reaches the tunnel. Connecting creates a new "Tri Pros Schedule (DEV)" and backfills every dev meeting with no guests and no email.
1. **Send a welcome text:** `pnpm tsx --import ./scripts/lib/stub-server-only.mjs scripts/visit-messages.ts summary --meeting <id>`. The text arrives at `VOIP_DEV_OVERRIDE_NUMBER` with no calendar link; the script prints `invite: invited`; the Google invite arrives at `EMAIL_DEV_OVERRIDE`. The event shows the title, the visit note, trades, the visit page link and the questions line, and no internal content.
2. **Edit the visit note** from the meeting's ⋯ → Notes. The event updates, and no email arrives.
3. **Reschedule.** One "Updated invitation" arrives, and the original reads Rescheduled.
4. **Set the replacement's outcome to Cancelled.** Google's cancellation arrives.

Record each answer in the ledger. A failure goes back through the fix loop.

---

## Self-review

- **Spec coverage:**
  - §4 → Tasks 2 and 3;
  - §5.1 → Tasks 1 and 3; §5.2 → Tasks 2 and 3; §5.3 → Task 5; §5.4 → Task 2 (`resolveMeetingGuests`) and Task 3 (calendar name);
  - §6.1 → Task 1; §6.2 → Tasks 3 and 4; §6.3 → Tasks 2 and 3; §6.4 → Task 1 (eligibility test); §6.5 needs no change;
  - §7.1 → Task 1; §7.2 → Task 6 (P4, P5); §7.3 → Tasks 3, 4 and 5; §7.4 → Task 7 follow-ups;
  - §8 → Task 3 (no calendar: unchanged early return; refused guest: the 400 fallback; retry: Task 2's test) and Task 5 (`no_email`);
  - §10 → sections 16–21 plus the wiring scripts in Tasks 4 and 5; owner checks → Task 7;
  - §11 → Task 1's push request; production push and deploy stay owner actions after plan 4.
- **Types:** `MeetingEventExtras`, `MeetingGuests`, `CalendarNotice` and `CalendarNoticeState` are defined in Task 2 and consumed unchanged in Task 3. `handOffVisit` is defined and consumed in Task 4. `VisitInviteResult` is defined and consumed in Task 5. `listNotesForEntity` is defined and consumed in Task 6.
- **Placeholders:** Task 3 Step 5 allows skipping the wiring script when no write-free route exists; the report must say so. Task 6 Step 1 copies the author projection from a named file rather than repeating it here, because that file is the source of truth for `CustomerNoteWithAuthor`.
