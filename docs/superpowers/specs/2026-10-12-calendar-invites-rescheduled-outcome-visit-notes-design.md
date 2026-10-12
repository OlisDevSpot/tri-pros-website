# Calendar invites, the `rescheduled` outcome, and visit notes

**Status:** design approved in conversation 2026-10-12; written spec awaiting owner review.
**Amends:** `docs/superpowers/specs/2026-09-29-home-visit-page-and-visit-messages-design.md` (the parent spec). Where the two disagree, this document wins. The parent's §5, §7.1, §7.2, §7.3, §10, §11 and §12a are affected; §3 below lists each change.
**Built on:** plan 2 (`docs/superpowers/plans/2026-10-08-visit-messages-sending-and-replies.md`), which is built and reviewed on local `main`.
**Next:** one replacement plan for this amendment, built before plans 3 and 4.

## 1. Why

The owner's first real test (2026-10-09) showed that the visit summary email does not do the job. The owner wants the visit to be **in the homeowner's calendar already**, as a real Google invite, with Google sending the updates and the cancellation. Building that showed three more things to settle:

- The office calendar event is the single source of truth for a meeting, and it is not safe for a homeowner to see today (internal notes, internal meeting type, dashboard links).
- A reschedule today cancels the original meeting, so it reads as a cancellation everywhere, and it would send the homeowner a cancellation plus a fresh invite.
- Homeowner-facing notes ("please park in the driveway") have no home on the meeting.

## 2. Decisions (owner, 2026-10-09 → 2026-10-12)

| # | Decision |
|---|---|
| C1 | The visit summary **text** is canonically the **meeting welcome text**. Code keys (`visit_summary`) keep their names until a rename is agreed. |
| C2 | The welcome text gets **no** calendar link. Calendar delivery is Google Calendar only, for now. |
| C3 | **One event per meeting**: the existing office event on info@'s Tri Pros calendar. The agent is a guest once assigned (as today); the **homeowner joins the same event**. |
| C4 | The event is **homeowner-safe for everyone**: trades and scopes, address, the visit note and the home visit link. No dashboard links, no internal communication. |
| C5 | Event title: `Home visit: <customer name> · Tri Pros Remodeling`. |
| C6 | The homeowner joins when the **welcome text is sent**. Inviting is stored state (`homeowner_invited_at`), so a switch on the meeting form can set it later. |
| C7 | Our summary email and cancellation email go away; Google sends the invite, the updates and the cancellation. |
| C8 | New outcome **`rescheduled`** (approach A): set by the system on a not-yet-happened original when it is rescheduled. The replacement continues through `rescheduledFromId`. |
| C9 | The meeting form gets a homeowner-facing **visit note** (on the meeting) and an editable **internal note** (a customer note linked to the meeting). **Simple version, not final** (§9). |
| C10 | A customer note can link to an entity the customer owns (`entity_type` + `entity_id`). |
| C11 | Replies' long-term home is a customer **timeline** (activities + messages, later calls, conversation-style). Its own follow-up plan; out of scope here. |
| C12 | A resilient processing design (outbox: routes persist, a worker processes from the database) is wanted later; a working system comes first. |

## 3. Changes to the parent spec

- **§5 data model:** add `meetings.visit_note`, `meetings.homeowner_invited_at`, `customer_notes.entity_type` / `entity_id`; add the outcome `rescheduled` (§6 here).
- **§7.1 sends:** the welcome text's email leg becomes the calendar invite (§5 here). The visit cancellation is Google's (§6 here); the `send-visit-cancellation` job is removed.
- **§7.2 copy:** `{{coordinator_note}}` becomes `{{visit_note}}`, read from the meeting. The welcome text takes no per-send note.
- **§7.3 replies:** unchanged, except that the YES target never matches a `rescheduled` original (it is not live).
- **§10 failure handling:** add the calendar cases in §8 here.
- **§11 verification:** the summary-email and invite-`.ics` checks are replaced by §10 here.
- **§12a:** this amendment is built after plan 2 and before plans 3 and 4.

## 4. The one event

`meetingToGCalEvent` (`src/shared/services/providers/google-calendar/lib/map-to-gcal.ts`) builds every meeting's event, whether or not the homeowner is a guest yet.

- **Title:** `Home visit: <customer name> · Tri Pros Remodeling`. The company name comes from `companyInfo`. The internal meeting type leaves the title. Project meetings keep a project title, since homeowners are not invited to those.
- **Location:** the customer address, as today.
- **Description, in order:**
  1. the visit note (`meetings.visit_note`), when there is one;
  2. trades and scopes;
  3. the home visit link, `publicUrl(ROOTS.public.homeVisit(meetingId, shareToken))`;
  4. "Questions? Call or text Tri Pros at <main line>", the main line read from `voipDidsService.getMainLineDid()`, falling back to the company phone.
- **Removed from the event:** `agentNotes`, the dashboard schedule link, the customer's phone and email, and the "Synced from" footer.
- **Colors** stay by meeting type. A color is set on the organizer's calendar and is not part of what guests see.

`agentNotes` stops triggering a calendar sync (it is no longer on the event). `visit_note` and `homeowner_invited_at` start triggering one (`gcalFieldChanged` in `entities/meetings/dal/server/crud.ts`).

**Until plan 4 ships**, the home visit link opens an unfinished page. Production welcome texts, and so production invites, wait for plan 4 (parent D24).

## 5. Inviting the homeowner

### 5.1 Stored state

`meetings.homeowner_invited_at timestamptz NULL` records the intent: set = the homeowner should be a guest. The calendar sync makes the event match it.

- The welcome-text action sets it (§5.3). A switch on the meeting form can set it later with no other change.
- Setting it back to null removes the homeowner from the event, and Google emails them a cancellation.
- `homeowner_invited_at` is excluded from Duplicate (a fresh visit) and carried by a reschedule (§6).

### 5.2 The sync owns every Google email

`schedulingService.syncMeeting` (run by the existing `sync-meeting-to-gcal` job):

1. builds the guest list: the participants (as today), plus the homeowner when `homeowner_invited_at` is set and the customer has an email;
2. reads the current event from Google (one extra call) and compares it with the new payload;
3. decides the `sendUpdates` value with a **pure function** (`decideCalendarNotice(current, next)`, in `src/shared/services/providers/google-calendar/lib/`):
   - homeowner added → `externalOnly` (the invite);
   - homeowner removed → `externalOnly` (Google's cancellation to them);
   - start time or location changed while the homeowner is a guest → `externalOnly` ("Updated invitation");
   - anything else (visit note, trades, title, staff guests) → `none`.

Staff are on the company domain, so `externalOnly` never emails them; they keep today's silent behavior. Comparing against Google, rather than our own history, means a retried job or an edit made in Google Calendar never sends a second email.

The Google Calendar client's `createEvent`, `updateEvent` and `deleteEvent` take a `sendUpdates` argument (`'all' | 'externalOnly' | 'none'`), passed as the query parameter Google's API defines.

### 5.3 The welcome-text action

`meetingService.business.sendVisitSummary(ctx, { meetingId })` (no `note` input any more):

1. sends the welcome text (unchanged, plan 2);
2. sets `homeowner_invited_at` when it is not set yet.

It returns `{ sms, invite }`, `invite` being `'invited' | 'already_invited' | 'no_email'`. The invite is not a `meeting_messages` row: the meeting column is the record, which plan 3's control panel and the future timeline read as "Calendar invite sent at …". Delivery of the invite itself is Google's and is not tracked.

### 5.4 Environments (fail closed)

Outside production (`env.VERCEL_ENV !== 'production'`):

- the homeowner guest is always `EMAIL_DEV_OVERRIDE`; without it, the homeowner is never added;
- **staff are not added as guests**, so dev events never land on real agents' calendars;
- the sync writes to the **Tri Pros Schedule (DEV)** calendar. As of 2026-10-12 the dev system owner has no calendar connected (the dev sync does nothing); the owner connects it once from dev settings before testing (§10).

## 6. Reschedule, the `rescheduled` outcome, and cancellation

### 6.1 The outcome

- `rescheduled` joins `derivedMeetingOutcomes` (system-set, shown but disabled in pickers).
- The visit did not occur, but `rescheduled` stays **out of** `DID_NOT_OCCUR_OUTCOMES`, the list a Reschedule may start from: the replacement is what gets rescheduled next, never the original. It is not live (`LIVE_MEETING_OUTCOMES` excludes it), it never requires a reason, and its sentiment is neutral.
- It leaves the lead pipelines: the original does not go to `rehash`. It is not a cancellation in analytics.
- Its class (neutral / did-not-occur) is added to `MEETING_OUTCOME_CLASS` on the permissions branch (wt 285) in the same release, so both branches agree.
- The sales-lifecycle map (`docs/plans/2026-10-01-sales-lifecycle-rules-map.md`) records the ruling: **S2 resolved** (a reschedule's original leaves the lead pipelines), **M5 rewritten** (original → `rescheduled`, not `cancelled`).
- The meeting outcome column is text checked in code, so no enum migration is needed.

### 6.2 The reschedule order

`meetingService.business.reschedule`:

1. Create the replacement (`rescheduledFromId` = the original), as today, **without** dispatching its own calendar sync.
2. In one transaction, hand the original's share token (as today), `gcalEventId`, `gcalEtag` and `homeowner_invited_at` to the replacement, and clear them on the original. The homeowner confirmation columns are not carried; the replacement starts unconfirmed.
3. Set the original's outcome: `not_set` or `reschedule_needed` → `rescheduled`. A `no_show` or `cancelled` original keeps its outcome (a rebook); today's code overwrites it with `cancelled`, losing a real no-show.
4. Dispatch the replacement's calendar sync. Google finds the new start on the same event and, with the homeowner a guest, sends one "Updated invitation".

Step 2 must finish before step 3, so that no hook on the original sees an event to delete. The plan pins this order with a test.

### 6.3 Cancellation

Outcome **Cancelled** keeps today's hook: the event is deleted. The delete passes `externalOnly` when the homeowner is a guest and the visit is still ahead, and `none` when the visit is already past (no cancellation for a visit that has happened).

### 6.4 Visit-message rules

`isVisitMessageEligible`, the planner and the runs treat `rescheduled` like `cancelled`: nothing is sent for it. The YES target query already looks only at live meetings, so a YES finds the replacement.

### 6.5 Edits made in Google Calendar

Unchanged: Google asks the editor about notifying guests, and the inbound sync mirrors the new time into the database. Our next sync finds no difference and sends nothing.

## 7. Visit notes (simple version, not final)

### 7.1 Data

- `meetings.visit_note text NULL`: the homeowner-facing note.
- `customer_notes.entity_type text NULL` (const set `['meeting', 'proposal', 'project']`, plain text, no database enum) and `customer_notes.entity_id uuid NULL`, set together or not at all. An unlinked note is a plain customer note (every existing row). No foreign key, since the id points at different tables; a note whose entity was deleted stays on the customer and readers treat the entity as removed.

### 7.2 The meeting form

`create-meeting-form.tsx` (create and edit):

- **Note for the homeowner** → `visit_note`. Helper text names who sees it: the homeowner and the specialist, in the welcome text, the calendar invite and the visit page.
- **Internal note** → a customer note with `entity_type = 'meeting'`, `entity_id` = the meeting. On create it is written after the meeting exists. On edit the form loads that note and saves changes to it; clearing it deletes the note.

### 7.3 Where the visit note appears

- **Welcome text:** `{{visit_note}}` (replacing `{{coordinator_note}}`) inside its section: "One more thing: <visit note>".
- **Calendar event:** first in the description (§4). Editing it updates the event with no email.
- **Home visit page:** plan 4.

The existing reschedule note (`buildRescheduleNote`) is linked to the replacement meeting (`entity_type = 'meeting'`).

### 7.4 Permissions

`visit_note` and `homeowner_invited_at` join the meeting field lists on wt 285 (field-level read and update), with the same reach as neighboring meeting fields. The customer-note entity link inherits the customer-note rules.

## 8. Failure handling

- **No Google calendar connected** (`resolveSystemCalendarAuth` returns null): the sync does nothing, as today; the welcome text still sends and reports `invite: 'invited'` (the intent is stored, and the next sync after connection applies it).
- **The customer has no email:** `invite: 'no_email'`; nothing is stored.
- **Google refuses the guest** (an invalid address): the sync job logs and leaves the event without the homeowner; the stored intent stays set. Plan 3's control panel surfaces it.
- **A sync retry:** the diff finds nothing new, so no second email.
- **A reschedule that fails after step 1:** today's rule holds; the error says so (a replacement exists).

## 9. Not final, recorded

- **Notes:** another session is designing "compound" events (a meeting lifecycle event with its context note). Before the notes model is final, a grill reconciles §7 with that work, including editing both notes from the event component.
- **Timeline** (C11) and **outbox processing** (C12): separate plans.
- **iPhone add-to-calendar link:** not now (C2).

## 10. Verification

**Pinned in `scripts/verify-visit-messages.ts`** (pure; it runs with no environment):

- `meetingToGCalEvent`: title for a lead and a project meeting; description order; no agent notes, dashboard link, customer phone or email.
- `decideCalendarNotice`: homeowner added, removed, unchanged; start moved; location moved; note-only change; past cancellation.
- The outcome tables: `rescheduled` is derived, not live, not reschedulable, neutral; its pipeline mapping.
- The welcome text with and without a visit note.

**Wiring script** (stubs Google and Twilio; restores every row it touches): the reschedule order (token, event and invite move before the original becomes `rescheduled`; a `no_show` original keeps its outcome); the welcome-text action's `invite` result for invited, already invited and no email.

**Owner checks (dev):** connect the dev calendar first.

1. Send a welcome text: the Google invite arrives at the override inbox; the event shows no internal content; the welcome text has no calendar link.
2. Edit the visit note: the event updates; no email.
3. Reschedule: one "Updated invitation"; the original reads `rescheduled`.
4. Cancel: Google's cancellation arrives.

## 11. Rollout

- One `pnpm db:push:dev` (owner): `meetings.visit_note`, `meetings.homeowner_invited_at`, `customer_notes.entity_type`, `customer_notes.entity_id`. The same push on production before deploy.
- The outcome class and field lists land on wt 285.
- Production invites wait for plan 4, with the welcome texts.
