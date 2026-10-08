# Visit Messages Sending and Replies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Twilio path live and send every visit message: the summary a setter sends by hand (text with the contact card, email with a calendar invite), the two automatic runs that act on the plan, the cancellation email, and the replies (YES, STOP, everything else) that come back on the main line.

**Architecture:** One send core in the VoIP messages service that both the agent's sticky DID and the main line use, fail-closed outside production. Every visit text is rendered by plan 1's renderer from the current template and sent through `sendFromMainLine`; the result lands as a `meeting_messages` row. The two runs load candidates, compute plan 1's `planVisitMessages` at their scheduled instant, and act only on steps the plan marks `due`, claiming each send with the partial unique index. Two Twilio routes: status callbacks (async webhook) and inbound messages (TwiML). No UI: every surface in this plan is a service verb, a job, a route or a script, and each is exercised by a wiring script that intercepts the provider slots.

**Tech Stack:** Next.js 15, TypeScript, tRPC, Drizzle (Postgres on Neon), Zod 4, Twilio SDK (lazy), Resend + React Email, Upstash QStash, web-push, `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-29-home-visit-page-and-visit-messages-design.md` (§12a steps 2 and 3; step 4 moved to plan 3 by the owner on 2026-10-08). Read §5, §7.1 to §7.4, §10, §11 and §18 before starting. Plan 1 (`2026-10-05-visit-messages-foundation.md`, built 2026-10-07) produced every name this plan consumes.

**Owner rulings on 2026-10-08, folded in below:**
1. Step 4 (the card badge, the Send summary action and dialog) moves to plan 3. This plan is backend only.
2. `meetings.scheduled_for_set_at` records when the time was last set; `booked_after_run` keys on it (Task 1).
3. The template validator rejects only a spelled-out opt-out instruction ("reply STOP", "text STOP"), not every word "stop" (Task 2).
4. No run sends after 9:00 PM Pacific (Task 2).

## Global Constraints

- Package manager is **pnpm**. Verify with `pnpm tsc` and `pnpm lint`. **Never** run `pnpm build`. `pnpm lint` is `next lint` and never lints `scripts/`; lint a script with `pnpm exec eslint <path>`.
- Work on local `main`, in the shared tree. No branch, no worktree, no `git stash`, `git checkout` or `git reset`. Stage by explicit path (`git add <path> …`), never `git add -A` or `git add .`: another session has uncommitted files in this tree.
- A commit hook runs `pnpm tsc`, `pnpm lint` and `pnpm theme:check` and takes about 110 s. Every commit must pass all three on its own. Put the whole `git add … && git commit …` in one Bash call.
- **Never run `pnpm db:push:dev` or `pnpm db:push:prod`.** Task 1 stops for the owner. Never accept a truncate prompt.
- **No database writes for testing**, dev included, except a wiring script that deletes every row it created before it exits (the service-wiring recipe). Never change an existing row. Never run a script's `--apply` mode; those are owner actions.
- **No real text or email leaves a test.** Wiring scripts intercept the provider slots (`twilioClient.sendMessage`, `voipMessagesService.sendFromMainLine`, `emailService.send…`, `webPushClient.sendToUsers`). Those are plain object literals, so a slot is assignable: `(voipMessagesService as any).sendFromMainLine = async (...args) => { captured.push(args); return dalSuccess(...) }`. The owner does the one real send (Task 7's gate and Task 11's smoke test).
- Outside production (`env.VERCEL_ENV !== 'production'`) a text goes to `VOIP_DEV_OVERRIDE_NUMBER` or does not go, and an email goes to `EMAIL_DEV_OVERRIDE` or does not go. The dev database holds real customer phones and emails.
- Wiring scripts run as `DRIZZLE_TARGET=dev NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-<name>.ts`, start with `import './lib/load-env'`, and are deleted before the task's commit.
- Comments say why, never what. No file banners, no citations of plans, specs, tasks or docs from code, no new `DOCS.md`.
- A service is one object literal per file that spreads its CRUD and reaches itself and peers by exported name. No `this`, no factory for new services, no `core` namespace. Raw `db` calls live in a DAL file, never in a service, route or job. Routes hold no business logic: verify, parse, call a service, respond.
- Option sets are a `readonly` const array with its type derived beside it. No new `pgEnum`.
- All SMS copy is **GSM-7 only**. Company data comes from `src/shared/constants/company/`; never hardcode the company name, phone or address.
- A move is non-defensive: consumers switch and the old code is deleted in the same change. No re-export shims, no fallbacks for a move that has not happened.
- Code lives where its module will be (spec D28): VoIP primitives in `src/shared/services/voip/lib/`, meeting-core rules in `src/shared/modules/meetings/core/lib/`, visit-message code in `src/shared/modules/meetings/messages/`. Nothing new in naked `src/shared/lib/`.
- `scripts/verify-visit-messages.ts` stays pure: it may not import anything that reaches `@/shared/config/server-env`, `@/shared/db` (the client, not types), `@/shared/config/public-url`, or the `twilio` / `resend` SDKs. Type-only imports are fine.
- No static import of the `resend` or `twilio` REST SDKs (lint rule `lazy-only/imports`); go through `twilioClient` and `resendClient`.
- Approved vocabulary (spec §3a): home visit page, main line, visit message, visit summary, day-before reminder, rep confirmation, confirmation reply, visit cancellation, homeowner reply, confirmation track, homeowner confirmed, rep, reschedule chain, sequence, skip, paused, visit message plan. Do not coin other terms.
- Visit-message surfaces are super-admin only (D25): `sendVisitSummary` sits on `visitMessagesProcedure`. Jobs and webhooks pass `SYSTEM_CONTEXT`.
- Every method on a service takes `ctx` first.

## Review Focus

Inputs the spec implies and a person would trip over. Each has a test in the task named.

1. **Two customers share one phone.** A YES must confirm the soonest eligible meeting across both; a STOP must mark every row with that phone do-not-contact. Expected: one confirmation, every customer protected. (Task 10)
2. **QStash delivers a run twice at the same moment.** Expected: one text. The claim row's partial unique index makes the second delivery's insert a no-op. (Task 8)
3. **A YES arrives after a reschedule.** The summary went out for the original, which is now cancelled. Expected: the replacement is confirmed, found through the reschedule chain. (Task 10 builds it; Task 11's gate exercises it with a real reschedule, since a wiring script cannot reschedule without side effects)
4. **Resend rejects the customer's email address.** Expected: the email leg records `failed` with `send_error`, the text leg is unaffected, and the caller sees both. (Task 7)
5. **A status callback arrives for a SID the table does not hold yet.** Twilio can call back before the REST return patched the row. Expected: nothing updates, the route answers 200, nothing throws. (Task 5)

## File map

| File | Responsibility |
|---|---|
| `src/shared/db/schema/meetings.ts` | `scheduled_for_set_at` |
| `src/shared/modules/meetings/core/lib/scheduled-for-set.ts` | the time-set rule for a moved meeting |
| `src/shared/entities/meetings/dal/server/crud.ts` | the hook sets it on create and on a move; duplicate excludes it; `update.after` dispatches the cancellation |
| `src/shared/entities/meetings/dal/server/google-calendar.ts` | SQL mirror of the time-set rule |
| `src/shared/entities/meetings/lib/server-spec.ts` | client schemas omit the column |
| `src/shared/modules/meetings/messages/lib/plan-visit-messages.ts`, `types.ts` | `booked_after_run` keys on the time-set fact |
| `src/shared/modules/meetings/messages/lib/validate-visit-message-template.ts` | the narrowed STOP check |
| `src/shared/modules/meetings/messages/constants/schedule.ts`, `lib/resolve-run-instant.ts` | the 9 PM ceiling |
| `src/shared/modules/meetings/messages/lib/run-window.ts` | which business day a run covers |
| `src/shared/modules/meetings/messages/lib/google-calendar-link.ts` | the "Add to Google Calendar" link |
| `src/shared/entities/voip-dids/dal/server/{queries,mutations}.ts`, `src/shared/services/voip/voip-dids.service.ts` | `getMainLineDid`, `setMainLine` |
| `scripts/set-main-line.ts` | resync DIDs from Twilio and flag the main line |
| `src/shared/services/voip/voip-messages.service.ts` | the shared send core, `sendSms`, `sendFromMainLine` (MMS), `applyStatusCallback` with the status mapping |
| `src/shared/services/voip/lib/map-twilio-message-status.ts` | Twilio status to the table's status |
| `src/shared/constants/enums/voip.ts` | the status rank (never backwards) |
| `src/shared/entities/voip-messages/dal/server/{queries,mutations}.ts` | `hasOutboundOnThread`; the guarded status patch |
| `src/shared/services/providers/twilio/schemas/{messaging,voice}.ts`, `client.ts`, `DOCS.md` | the webhook payload Zod moves out of `webhooks/`, a directory a provider does not have; schema additions; the 401 doc fix |
| `docs/codebase-conventions/service-architecture.md` | the provider shape loses `webhooks/` |
| `src/app/api/webhooks/twilio/route.ts` | status callbacks |
| `src/app/api/voip/twiml/messaging-inbound/route.ts` | inbound messages |
| `src/app/api/company/vcard/route.ts` | the company contact card |
| `src/shared/modules/meetings/messages/dal/server/{queries,mutations,settings}.ts` | contexts, chain messages, reply target, claims, templates and pauses |
| `src/shared/modules/meetings/messages/lib/deliver-visit-text.ts` | render a visit text and send it from the main line |
| `src/shared/modules/meetings/messages/lib/deliver-visit-email.ts` | the invite, the summary email and the cancellation email |
| `src/shared/modules/meetings/messages/lib/run-automatic-kind.ts` | the loop both runs share |
| `src/shared/modules/meetings/messages/service.ts` | `recordDeliveryFailure` |
| `src/shared/modules/meetings/business/service.ts` | `sendVisitSummary`, `sendDayBeforeReminders`, `sendRepConfirmations`, `sendVisitCancellation`, `confirmByHomeowner`, `handleHomeownerReply` |
| `src/trpc/routers/meetings.router/business.router.ts` | `sendVisitSummary` on the visit-messages procedure |
| `src/shared/entities/customers/dal/server/queries.ts` | `findCustomersByPhone` |
| `src/shared/services/providers/resend/emails/{visit-summary-email,visit-cancellation-email}.tsx`, `lib/render-emails.tsx` | the two email templates |
| `src/shared/services/email.service.ts` | `sendVisitSummaryEmail`, `sendVisitCancellationEmail` |
| `src/shared/services/notification.service.ts` | `notifyVisitTextFailed`, `notifyHomeownerReply`, `notifyHomeownerOptedOut` |
| `src/shared/services/providers/upstash/jobs/{send-day-before-reminders,send-rep-confirmations,send-visit-cancellation}.ts`, `src/app/api/qstash-jobs/route.ts` | the three jobs |
| `scripts/setup-visit-message-crons.ts` | the two QStash schedules, built from `VISIT_MESSAGE_SCHEDULE` |
| `scripts/run-visit-message-job.ts` | run a kind at a chosen instant (dev) |
| `scripts/verify-visit-messages.ts` | pins for every pure rule this plan adds |

---

### Task 1: When was the time set

**Files:**
- Modify: `src/shared/db/schema/meetings.ts:32`
- Create: `src/shared/modules/meetings/core/lib/scheduled-for-set.ts`
- Modify: `src/shared/entities/meetings/dal/server/crud.ts:55,109,170-188`
- Modify: `src/shared/entities/meetings/dal/server/google-calendar.ts:122-135`
- Modify: `src/shared/entities/meetings/lib/server-spec.ts:13-19`
- Modify: `src/shared/modules/meetings/messages/types.ts:55-65`
- Modify: `src/shared/modules/meetings/messages/lib/plan-visit-messages.ts:94-97`
- Modify: `scripts/verify-visit-messages.ts:266-284,400-410`

**Interfaces:**
- Consumes: `confirmationsClearedByMove` (`core/lib/confirmation-reset.ts`), `getMeetingSchedule` (`entities/meetings/dal/server/queries.ts:255`), `planVisitMessages`.
- Produces: `meetings.scheduledForSetAt: string` (NOT NULL); `scheduledForSetByMove(current, patch, now): { scheduledForSetAt?: string }`; `VisitMessagePlanInput.meeting.scheduledForSetAt` replaces `createdAt`.

- [ ] **Step 1: Add the column**

In `src/shared/db/schema/meetings.ts`, directly after the `scheduledFor` line:

```ts
  // When scheduledFor was last set. A run that had already gone when the time was set never picks the meeting up.
  scheduledForSetAt: timestamp('scheduled_for_set_at', { mode: 'string', withTimezone: true }).notNull().defaultNow(),
```

The database default exists only so the push fills existing rows; the hook below always supplies the value.

- [ ] **Step 2: Write the rule and its pin**

Create `src/shared/modules/meetings/core/lib/scheduled-for-set.ts`:

```ts
import type { Meeting } from '@/shared/db/schema'

/** The fact follows the instant, not the spelling: a same-time re-save (a calendar sync) keeps it. */
export function scheduledForSetByMove(
  current: Pick<Meeting, 'scheduledFor'>,
  patch: Partial<Pick<Meeting, 'scheduledFor'>>,
  now: Date,
): Partial<Pick<Meeting, 'scheduledForSetAt'>> {
  if (!patch.scheduledFor || new Date(current.scheduledFor).getTime() === new Date(patch.scheduledFor).getTime()) {
    return {}
  }
  return { scheduledForSetAt: now.toISOString() }
}
```

In `scripts/verify-visit-messages.ts`, add the import next to `confirmationsClearedByMove`:

```ts
import { scheduledForSetByMove } from '@/shared/modules/meetings/core/lib/scheduled-for-set'
```

and append inside section 12's block, before its `console.log`:

```ts
  const setAt = new Date('2026-10-08T03:00:00.000Z')
  assert.deepEqual(scheduledForSetByMove({ scheduledFor: VISIT_AS_POSTGRES }, { scheduledFor: OLD_VISIT }, setAt), { scheduledForSetAt: '2026-10-08T03:00:00.000Z' }, 'a moved time is set now')
  assert.deepEqual(scheduledForSetByMove({ scheduledFor: VISIT_AS_POSTGRES }, { scheduledFor: VISIT }, setAt), {}, 'a same-time re-save in another spelling keeps the fact')
  assert.deepEqual(scheduledForSetByMove({ scheduledFor: VISIT }, {}, setAt), {}, 'a patch that does not touch the time sets nothing')
```

- [ ] **Step 3: Run the pin to see it fail**

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: section 12 fails before the rule file exists, or passes once Step 2's file is in place. Then run `pnpm tsc` and expect errors in `plan-visit-messages.ts` and the verify script's fixtures once Step 5 changes the type; those are fixed in Steps 5 and 6.

- [ ] **Step 4: The hooks, the mirror, the client schemas**

In `src/shared/entities/meetings/dal/server/crud.ts`:

Add the import beside `confirmationsClearedByMove`:

```ts
import { scheduledForSetByMove } from '@/shared/modules/meetings/core/lib/scheduled-for-set'
```

In `create.before`, replace the `withToken` line with:

```ts
        const withToken = { ...input, setBy, shareToken: generateToken(), scheduledForSetAt: new Date().toISOString() }
```

In `update.before`, replace the `confirmationsClearedByMove` spread line with:

```ts
            next = { ...next, ...confirmationsClearedByMove(current, data), ...scheduledForSetByMove(current, data, new Date()) }
```

In `duplicate.exclude`, add `'scheduledForSetAt',` after `'rescheduledFromId',`. The copy gets its own value from `create.before`.

In `src/shared/entities/meetings/dal/server/google-calendar.ts`, `updateMeetingScheduledFor`, add one line to the `.set({ … })` after `homeownerConfirmedVia`:

```ts
      scheduledForSetAt: sql`CASE WHEN ${meetings.scheduledFor} = ${scheduledFor}::timestamptz THEN ${meetings.scheduledForSetAt} ELSE now() END`,
```

In `src/shared/entities/meetings/lib/server-spec.ts`, add to `SERVER_OWNED_COLUMNS`:

```ts
  scheduledForSetAt: true,
```

- [ ] **Step 5: The plan keys on it**

In `src/shared/modules/meetings/messages/types.ts`, in `VisitMessagePlanInput.meeting`, replace `createdAt: string` with:

```ts
    /** When scheduledFor was last set; a time moved after a run's instant is never that run's business. */
    scheduledForSetAt: string
```

In `src/shared/modules/meetings/messages/lib/plan-visit-messages.ts`, replace the `createdAt` check:

```ts
    // The run for this step had already gone when the time was set, so no run will ever pick it up.
    if (new Date(meeting.scheduledForSetAt).getTime() > plannedFor.getTime()) {
      return { ...step, reason: 'booked_after_run' }
    }
```

- [ ] **Step 6: Fix the fixtures and pin the in-place move**

In `scripts/verify-visit-messages.ts`, `planInput`: replace `createdAt: '2026-10-07T17:00:00.000Z',` with `scheduledForSetAt: '2026-10-07T17:00:00.000Z',`. In the "Nothing recorded and nothing will send" block, replace every `{ createdAt: … }` meeting override with `{ scheduledForSetAt: … }` (three places) and append, before `const missed`:

```ts
  const movedAfterRun = planInput({ now: new Date('2026-10-09T16:20:00.000Z') }, { scheduledFor: '2026-10-09T21:00:00.000Z', scheduledForSetAt: '2026-10-09T16:15:00.000Z' })
  assert.equal(step(movedAfterRun, 'rep_confirmation').state, 'not_sent')
  assert.equal(step(movedAfterRun, 'rep_confirmation').reason, 'booked_after_run', 'moved in place at 9:15 AM into 2 PM today: the 8:30 run had gone, and a retry must not text it')
  const movedBeforeRun = planInput({ now: new Date('2026-10-09T16:20:00.000Z') }, { scheduledFor: '2026-10-09T21:00:00.000Z', scheduledForSetAt: '2026-10-09T14:00:00.000Z' })
  assert.equal(step(movedBeforeRun, 'rep_confirmation').state, 'due', 'moved at 7 AM: the 8:30 run owns it')
```

- [ ] **Step 7: Verify**

Run: `pnpm tsx scripts/verify-visit-messages.ts && pnpm tsc && pnpm lint`
Expected: `✅ verify-visit-messages passed`, no type errors, no lint errors.

- [ ] **Step 8: Commit**

```bash
git add src/shared/db/schema/meetings.ts src/shared/modules/meetings/core/lib/scheduled-for-set.ts src/shared/entities/meetings/dal/server/crud.ts src/shared/entities/meetings/dal/server/google-calendar.ts src/shared/entities/meetings/lib/server-spec.ts src/shared/modules/meetings/messages/types.ts src/shared/modules/meetings/messages/lib/plan-visit-messages.ts scripts/verify-visit-messages.ts && git commit -m "feat(meetings): record when a meeting's time was last set, so a run that had already gone never texts a moved meeting late

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 9: OWNER GATE. Stop here.**

The owner runs `pnpm db:push:dev` and reads the statements. Expected, and nothing else from this plan:
- `ALTER TABLE "meetings" ADD COLUMN "scheduled_for_set_at" timestamp with time zone DEFAULT now() NOT NULL;`
- the same identical index and check drop/recreate pairs the 2026-10-07 push showed (drizzle-kit normalization churn; safe).

Existing rows take the push instant, which is harmless: no run before the push could have sent anything. Do not continue to Task 3's gate until this push is done; Task 2 needs no database.

---

### Task 2: The narrowed STOP check and the 9 PM ceiling

**Files:**
- Modify: `src/shared/modules/meetings/messages/lib/validate-visit-message-template.ts:53-55`
- Modify: `src/shared/modules/meetings/messages/constants/schedule.ts`
- Modify: `src/shared/modules/meetings/messages/lib/resolve-run-instant.ts`
- Modify: `scripts/verify-visit-messages.ts` (the validator section and section 10)

**Interfaces:**
- Produces: `VISIT_MESSAGE_SEND_CEILING_HOUR = 21`; `resolveRunInstant` returns `null` for an instant at or after 9:00 PM Pacific.

- [ ] **Step 1: Pin both rules**

In `scripts/verify-visit-messages.ts`, find the validator block (the one asserting `contains_stop`) and change its STOP pins to:

```ts
  assert.ok(validateVisitMessageTemplate('rep_confirmation', 'Reply STOP to end these texts {{rep_name}} {{arrival_window}} {{visit_link}}').errors.some(issue => issue.code === 'contains_stop'), 'a spelled-out opt-out line would repeat the one the renderer adds')
  assert.ok(validateVisitMessageTemplate('rep_confirmation', 'text stop to unsubscribe {{rep_name}} {{arrival_window}} {{visit_link}}').errors.some(issue => issue.code === 'contains_stop'))
  assert.equal(validateVisitMessageTemplate('rep_confirmation', '{{rep_name}} will stop by between {{arrival_window}}. Your visit page: {{visit_link}}').errors.length, 0, '"stop by" is ordinary English')
```

Keep every other pin in that block as it is. In section 10 (run time), append before its `console.log`:

```ts
  assert.equal(resolveRunInstant('day_before_reminder', new Date('2026-10-09T04:00:00.000Z')), null, 'a retry at 9:00 PM Pacific sends nothing')
  assert.equal(resolveRunInstant('day_before_reminder', new Date('2026-10-09T03:59:00.000Z'))?.toISOString(), '2026-10-09T03:59:00.000Z', '8:59 PM still runs')
  assert.equal(resolveRunInstant('rep_confirmation', new Date('2026-10-10T04:30:00.000Z')), null, 'the ceiling holds for both kinds')
```

- [ ] **Step 2: Run the pins to see them fail**

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: the "stop by" assertion fails (`contains_stop` is raised today), then the 9 PM assertion fails.

- [ ] **Step 3: Narrow the check**

In `validate-visit-message-template.ts`, replace the `contains_stop` block with:

```ts
  // The renderer appends "Reply STOP to opt out." to a thread's first text; a template that spells it too would repeat it.
  if (/\b(?:reply|text|send)\s+stop\b/i.test(body)) {
    errors.push({ code: 'contains_stop', message: 'Leave out the STOP line. It is added to the first text automatically.' })
  }
```

- [ ] **Step 4: The ceiling**

In `constants/schedule.ts`, append:

```ts
/** No run sends at or after this Pacific hour: a retried delivery late in the evening would text homeowners at night. */
export const VISIT_MESSAGE_SEND_CEILING_HOUR = 21
```

Replace `resolve-run-instant.ts` with:

```ts
import type { PausableVisitMessageKind } from '@/shared/modules/meetings/messages/constants/kinds'

import { businessDateTime, businessDayKey, businessHour } from '@/shared/lib/business-time'
import {
  VISIT_MESSAGE_RUN_EARLY_TOLERANCE_MS,
  VISIT_MESSAGE_SCHEDULE,
  VISIT_MESSAGE_SEND_CEILING_HOUR,
} from '@/shared/modules/meetings/messages/constants/schedule'

/**
 * The instant a run evaluates the plan at, or null when this delivery is not today's run.
 * A delivery a moment early still counts as the scheduled time, so a due step is not seen as scheduled and missed.
 * A retry that lands after midnight is hours before the new day's run and gets null, so it cannot send a day early.
 * A retry that lands late in the evening gets null too, so nobody is texted at night.
 */
export function resolveRunInstant(kind: PausableVisitMessageKind, now: Date): Date | null {
  const { hour, minute } = VISIT_MESSAGE_SCHEDULE[kind]
  const scheduled = businessDateTime(businessDayKey(now), hour, minute)
  if (now.getTime() < scheduled.getTime() - VISIT_MESSAGE_RUN_EARLY_TOLERANCE_MS) {
    return null
  }
  const instant = new Date(Math.max(now.getTime(), scheduled.getTime()))
  if (businessHour(instant) >= VISIT_MESSAGE_SEND_CEILING_HOUR) {
    return null
  }
  return instant
}
```

- [ ] **Step 5: Verify**

Run: `pnpm tsx scripts/verify-visit-messages.ts && pnpm tsc && pnpm lint`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/shared/modules/meetings/messages/lib/validate-visit-message-template.ts src/shared/modules/meetings/messages/constants/schedule.ts src/shared/modules/meetings/messages/lib/resolve-run-instant.ts scripts/verify-visit-messages.ts && git commit -m "feat(meetings): a template may say \"stop by\" and no run texts after 9 PM Pacific

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The main line

**Files:**
- Modify: `src/shared/entities/voip-dids/dal/server/queries.ts`
- Modify: `src/shared/entities/voip-dids/dal/server/mutations.ts`
- Modify: `src/shared/services/voip/voip-dids.service.ts:1-8,103-118`
- Create: `scripts/set-main-line.ts`

**Interfaces:**
- Consumes: `voipDids.isMainLine` + partial unique index (plan 1), `voipDidsService.resyncFromTwilio(ctx)`.
- Produces: `getMainLineDid(): Promise<DalReturn<VoipDid | null>>` (DAL and `voipDidsService.getMainLineDid()`); `setMainLine({ e164 }): Promise<DalReturn<VoipDid>>` (DAL and `voipDidsService.setMainLine(ctx, { e164 })`).

- [ ] **Step 1: The query**

Append to `src/shared/entities/voip-dids/dal/server/queries.ts`:

```ts
/** The one company number that sends visit messages and receives their replies; null until the owner flags one. */
export async function getMainLineDid(): Promise<DalReturn<VoipDid | null>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select()
      .from(voipDids)
      .where(and(eq(voipDids.isMainLine, true), eq(voipDids.isActive, true)))
      .limit(1)

    return row ?? null
  })
}
```

- [ ] **Step 2: The mutation**

Append to `src/shared/entities/voip-dids/dal/server/mutations.ts` (add `import { ThrowableDalError } from '@/shared/dal/server/types'` if the file does not import it yet):

```ts
interface SetMainLineInput {
  e164: string
}

/** One transaction: the partial unique index allows one main line, so the old flag clears before the new one lands. */
export async function setMainLine(input: SetMainLineInput): Promise<DalReturn<VoipDid>> {
  return dalDbOperation(async () => {
    return db.transaction(async (tx) => {
      const [target] = await tx
        .select()
        .from(voipDids)
        .where(eq(voipDids.e164, input.e164))
        .limit(1)
      if (!target) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      await tx.update(voipDids).set({ isMainLine: false }).where(eq(voipDids.isMainLine, true))
      const [row] = await tx
        .update(voipDids)
        .set({ isMainLine: true, isActive: true })
        .where(eq(voipDids.id, target.id))
        .returning()
      return row!
    })
  })
}
```

- [ ] **Step 3: The service passthroughs**

In `src/shared/services/voip/voip-dids.service.ts`, extend the two DAL imports:

```ts
import { assignToUser, promoteToPrimary, reconcileWithProvider, setMainLine, unassign } from '@/shared/entities/voip-dids/dal/server/mutations'
import { getDidByE164, getDidByProviderId, getMainLineDid, getStickyDidForUser } from '@/shared/entities/voip-dids/dal/server/queries'
```

and add, in the read-side passthroughs block after `getDidByProviderId`:

```ts
    getMainLineDid: (): Promise<DalReturn<VoipDid | null>> => {
      return getMainLineDid()
    },

    setMainLine: (_ctx: ScopedContext, input: { e164: string }): Promise<DalReturn<VoipDid>> => {
      return setMainLine(input)
    },
```

- [ ] **Step 4: The script**

Create `scripts/set-main-line.ts`:

```ts
/**
 * Lists the DIDs the app knows, optionally after pulling them from Twilio, and flags one as the main line.
 * `voip_dids` fills only through a resync; nothing in the app calls it.
 *
 * Usage:
 *   DRIZZLE_TARGET=dev NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/set-main-line.ts --resync
 *   DRIZZLE_TARGET=dev NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/set-main-line.ts --e164 +16265550123
 *   DRIZZLE_TARGET=dev NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/set-main-line.ts --e164 +16265550123 --apply
 *   DRIZZLE_TARGET=prod … (same flags)
 *
 * Dry run unless --apply. The `--conditions=react-server` flag lets the CLI import server-only modules.
 */
import './lib/load-env'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { voipDids } from '@/shared/db/schema/voip-dids'
import { voipDidsService } from '@/shared/services/voip/voip-dids.service'

function flagValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

async function main() {
  const apply = process.argv.includes('--apply')
  const resync = process.argv.includes('--resync')
  const e164 = flagValue('--e164')

  console.log(`--- MAIN LINE (${process.env.DRIZZLE_TARGET ?? 'dev'}) ---`)
  if (resync) {
    const result = dalVerifySuccess(await voipDidsService.resyncFromTwilio(SYSTEM_CONTEXT))
    console.log(`Resynced from Twilio: ${result.created} created, ${result.updated} updated, ${result.deactivated} deactivated`)
  }

  const rows = await db.select().from(voipDids).orderBy(voipDids.e164)
  if (rows.length === 0) {
    console.log('No DIDs in the table. Run with --resync first.')
  }
  for (const row of rows) {
    console.log(`${row.isMainLine ? '*' : ' '} ${row.e164}  ${row.label ?? row.cnamDisplayName ?? ''}  active=${row.isActive}  assigned=${row.assignedUserId ?? '-'}`)
  }

  if (!e164) {
    return
  }
  if (!rows.some(row => row.e164 === e164)) {
    console.error(`${e164} is not in the table. Check the number, or run with --resync.`)
    process.exit(1)
  }
  if (!apply) {
    console.log(`Dry run: ${e164} would become the main line. Re-run with --apply.`)
    return
  }
  const row = dalVerifySuccess(await voipDidsService.setMainLine(SYSTEM_CONTEXT, { e164 }))
  console.log(`* ${row.e164} is the main line.`)
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error)
  process.exit(1)
})
```

- [ ] **Step 5: Verify (read-only)**

Run: `DRIZZLE_TARGET=dev NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/set-main-line.ts`
Expected: the header, then either the DID list or "No DIDs in the table".

Run: `DRIZZLE_TARGET=dev NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/set-main-line.ts --e164 +10000000000`
Expected: "… is not in the table", exit code 1. Nothing was written.

Run: `pnpm tsc && pnpm lint && pnpm exec eslint scripts/set-main-line.ts`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/shared/entities/voip-dids/dal/server/queries.ts src/shared/entities/voip-dids/dal/server/mutations.ts src/shared/services/voip/voip-dids.service.ts scripts/set-main-line.ts && git commit -m "feat(voip): the main line, read by name and flagged by a script that first pulls the DIDs from Twilio

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 7: OWNER GATE. Stop here.**

Tasks 4 and later send through the main line and need the dev environment wired. The owner:
1. Runs `DRIZZLE_TARGET=dev NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/set-main-line.ts --resync`, then flags the 626 reserve number: `… --e164 +1626XXXXXXX --apply` (spec §11: dev uses 626; production will use 213, flagged the same way with `DRIZZLE_TARGET=prod` at rollout).
2. In `.env.local`: `VOIP_DEV_OVERRIDE_NUMBER=+1<the owner's mobile>` and `VOIP_WEBHOOK_BASE_URL=https://destined-emu-bold.ngrok-free.app` (the static tunnel; `.env` points it at production, which makes every dev callback fail its signature check). Restart the dev server: env is read at boot.
3. In the Twilio console, on the 626 number: messaging webhook `https://destined-emu-bold.ngrok-free.app/api/voip/twiml/messaging-inbound` (HTTP POST); Advanced Opt-Out on; YES removed from the opt-in keywords; confirm MMS-capable.
4. In the dashboard, by hand: a test customer whose phone is the owner's mobile and whose email is the owner's address, and a future meeting for that customer with a rep. Nothing is seeded by code.

---

### Task 4: One send core, and the main line sends

**Files:**
- Modify: `src/shared/services/voip/voip-messages.service.ts`
- Test: a throwaway `scripts/tmp-send-core.ts`, deleted before the commit

**Interfaces:**
- Consumes: `voipDidsService.getMainLineDid()` (Task 3), `getStickyDidForUser`, `complianceService.canOutboundTo`, `twilioClient.sendMessage`, `VOIP_DEV_OVERRIDE_NUMBER`, `getVetting()`.
- Produces: `voipMessagesService.sendFromMainLine(ctx, { customerId: string | null, remoteE164: string, body: string, mediaUrl?: string[] }): Promise<DalReturn<SendSmsResult>>` where `SendSmsResult = { messageId, providerMessageId: string | null, status: VoipMessage['status'], failureReason: string | null }`. `sendSms` keeps its signature.

- [ ] **Step 1: Replace the send path**

In `src/shared/services/voip/voip-messages.service.ts`, add the import:

```ts
import { voipDidsService } from '@/shared/services/voip/voip-dids.service'
```

Replace everything from `interface SendSmsInput` through the end of `buildTwilioMessageParams` with:

```ts
// Production is the deployment environment, not the build mode: preview deploys build in production mode too.
const isProduction = env.VERCEL_ENV === 'production'

interface OutboundLine {
  id: string
  e164: string
}

interface SendOutboundInput {
  customerId: string | null
  remoteE164: string
  body: string
  from: OutboundLine
  /** Null for the main line: it is nobody's sticky DID. */
  agentUserId: string | null
  mediaUrl?: string[]
}

interface SendSmsInput {
  customerId: string
  remoteE164: string
  agentUserId: string
  body: string
}

interface SendFromMainLineInput {
  customerId: string | null
  remoteE164: string
  body: string
  mediaUrl?: string[]
}

interface SendSmsResult {
  messageId: string
  providerMessageId: string | null
  status: VoipMessage['status']
  failureReason: string | null
}

interface RecordInboundMessageInput {
  providerMessageId: string
  voipDidId: string | null
  customerId: string | null
  remoteE164: string
  body: string
}

interface ApplyMessageStatusCallbackInput {
  providerMessageId: string
  status: VoipMessage['status']
  deliveredAt?: string
  failedAt?: string
  failureReason?: string
}

interface FetchThreadInput {
  voipDidId: string
  remoteE164: string
  limit?: number
}

function buildTwilioMessageParams(input: {
  fromE164: string
  toE164: string
  body: string
  mediaUrl?: string[]
}): MessageListInstanceCreateOptions {
  return {
    from: input.fromE164,
    to: input.toE164,
    body: input.body,
    statusCallback: STATUS_CALLBACK_URL,
    ...(input.mediaUrl && input.mediaUrl.length > 0 ? { mediaUrl: input.mediaUrl } : {}),
  }
}
```

Keep `describeTwilioError` as it is. Then, above `function createVoipMessagesService()`, add the core:

```ts
/**
 * The one path a text leaves on, whichever line it leaves from:
 *  1. Do-not-contact gate.
 *  2. 10DLC vetting check, production only.
 *  3. Dev override on the Twilio leg, fail-closed: outside production the number must be set.
 *  4. Persist the row as `queued`.
 *  5. Fire Twilio and patch the row.
 */
async function sendOutbound(ctx: ScopedContext, input: SendOutboundInput): Promise<DalReturn<SendSmsResult>> {
  const allowed = await complianceService.canOutboundTo(input.remoteE164)
  if (!allowed) {
    const failureReason = 'dnc'
    const inserted = await voipMessageCrud.create(ctx, {
      customerId: input.customerId,
      voipDidId: input.from.id,
      remoteE164: input.remoteE164,
      body: input.body,
      direction: 'outbound',
      status: 'failed',
      failureReason,
      agentUserId: input.agentUserId,
    })
    if (!inserted.success) {
      return inserted
    }
    return dalSuccess({
      messageId: inserted.data.id,
      providerMessageId: null,
      status: 'failed' as const,
      failureReason,
    })
  }

  if (isProduction && !getVetting().tenDlcCampaignSid) {
    return dalError({
      type: 'precondition-failed',
      reason: '10DLC campaign approval pending: outbound SMS is disabled in production.',
    })
  }

  // The dev database is a copy of production with real customer phones, so outside production
  // a text goes to one configured number or does not go.
  if (!isProduction && !VOIP_DEV_OVERRIDE_NUMBER) {
    return dalError({
      type: 'precondition-failed',
      reason: 'VOIP_DEV_OVERRIDE_NUMBER is not set. Outside production every text goes to that number, so nothing was sent.',
    })
  }
  const dialTarget = VOIP_DEV_OVERRIDE_NUMBER ?? input.remoteE164

  const created = await voipMessageCrud.create(ctx, {
    customerId: input.customerId,
    voipDidId: input.from.id,
    remoteE164: input.remoteE164,
    body: input.body,
    direction: 'outbound',
    status: 'queued',
    agentUserId: input.agentUserId,
  })
  if (!created.success) {
    return created
  }
  const messageRow = created.data

  let twilioMessage: MessageInstance
  try {
    twilioMessage = await twilioClient.sendMessage(
      buildTwilioMessageParams({
        fromE164: input.from.e164,
        toE164: dialTarget,
        body: input.body,
        mediaUrl: input.mediaUrl,
      }),
    )
  }
  catch (e) {
    const errorCode = describeTwilioError(e)
    const patched = await voipMessageCrud.update(ctx, {
      id: messageRow.id,
      data: { status: 'failed', failureReason: errorCode },
    })
    if (!patched.success) {
      return patched
    }
    return dalSuccess({
      messageId: messageRow.id,
      providerMessageId: null,
      status: 'failed' as const,
      failureReason: errorCode,
    })
  }

  const patched = await voipMessageCrud.update(ctx, {
    id: messageRow.id,
    data: {
      providerMessageId: twilioMessage.sid,
      status: 'sent',
      sentAt: new Date().toISOString(),
    },
  })
  if (!patched.success) {
    return patched
  }
  return dalSuccess({
    messageId: messageRow.id,
    providerMessageId: twilioMessage.sid,
    status: 'sent' as const,
    failureReason: null,
  })
}
```

Then replace the whole `sendSms` member with these two members:

```ts
    /** An agent texts a customer from the agent's sticky DID. */
    sendSms: async (
      ctx: ScopedContext,
      input: SendSmsInput,
    ): Promise<DalReturn<SendSmsResult>> => {
      const didResult = await getStickyDidForUser(input.agentUserId)
      if (!didResult.success) {
        return didResult
      }
      if (!didResult.data) {
        return dalError({
          type: 'precondition-failed',
          reason: 'agent has no active primary DID — assign one via the admin panel',
        })
      }
      return sendOutbound(ctx, {
        customerId: input.customerId,
        remoteE164: input.remoteE164,
        body: input.body,
        from: { id: didResult.data.id, e164: didResult.data.e164 },
        agentUserId: input.agentUserId,
      })
    },

    /** Every visit message leaves from the one main line, with no agent on the row. */
    sendFromMainLine: async (
      ctx: ScopedContext,
      input: SendFromMainLineInput,
    ): Promise<DalReturn<SendSmsResult>> => {
      const mainLine = await voipDidsService.getMainLineDid()
      if (!mainLine.success) {
        return mainLine
      }
      if (!mainLine.data) {
        return dalError({
          type: 'precondition-failed',
          reason: 'No main line is configured. Flag one DID as the main line first.',
        })
      }
      return sendOutbound(ctx, {
        customerId: input.customerId,
        remoteE164: input.remoteE164,
        body: input.body,
        mediaUrl: input.mediaUrl,
        from: { id: mainLine.data.id, e164: mainLine.data.e164 },
        agentUserId: null,
      })
    },
```


- [ ] **Step 2: Type-check**

Run: `pnpm tsc`
Expected: clean. The `NODE_ENV` check is gone; `env.VERCEL_ENV` is the only environment read.

- [ ] **Step 3: The wiring test (needs Task 3's gate: a main line in dev and `VOIP_DEV_OVERRIDE_NUMBER` set)**

Create `scripts/tmp-send-core.ts`:

```ts
import './lib/load-env'

import assert from 'node:assert/strict'

import { eq } from 'drizzle-orm'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { voipMessages } from '@/shared/db/schema/voip-messages'
import { twilioClient } from '@/shared/services/providers/twilio/client'
import { voipDidsService } from '@/shared/services/voip/voip-dids.service'
import { voipMessagesService } from '@/shared/services/voip/voip-messages.service'

const FAKE_SID = `SM${'0'.repeat(32)}`
const sent: Record<string, unknown>[] = []
;(twilioClient as any).sendMessage = async (params: Record<string, unknown>) => {
  sent.push(params)
  return { sid: FAKE_SID }
}

const created: string[] = []
try {
  const mainLine = dalVerifySuccess(await voipDidsService.getMainLineDid())
  assert.ok(mainLine, 'the owner flagged a main line in dev')

  const result = dalVerifySuccess(await voipMessagesService.sendFromMainLine(SYSTEM_CONTEXT, {
    customerId: null,
    remoteE164: '+15555550100',
    body: 'wiring test',
    mediaUrl: ['https://example.com/tri-pros.vcf'],
  }))
  created.push(result.messageId)

  assert.equal(result.status, 'sent')
  assert.equal(result.providerMessageId, FAKE_SID)
  assert.equal(sent.length, 1)
  assert.equal(sent[0]!.from, mainLine.e164, 'leaves from the main line')
  assert.equal(sent[0]!.to, process.env.VOIP_DEV_OVERRIDE_NUMBER, 'outside production the Twilio leg goes to the override number')
  assert.deepEqual(sent[0]!.mediaUrl, ['https://example.com/tri-pros.vcf'])
  assert.ok(String(sent[0]!.statusCallback).endsWith('/api/webhooks/twilio'))

  const [row] = await db.select().from(voipMessages).where(eq(voipMessages.id, result.messageId))
  assert.equal(row!.agentUserId, null, 'the main line is nobody\'s sticky DID')
  assert.equal(row!.voipDidId, mainLine.id)
  assert.equal(row!.remoteE164, '+15555550100', 'the row records the customer\'s number, not the override')
  console.log('send core ✓')
}
finally {
  for (const id of created) {
    await db.delete(voipMessages).where(eq(voipMessages.id, id))
  }
}
```

Run: `DRIZZLE_TARGET=dev NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-send-core.ts`
Expected: `send core ✓`, and the row it created is gone (`finally`). Then delete the script: `rm scripts/tmp-send-core.ts`.

- [ ] **Step 4: Lint and commit**

Run: `pnpm lint`
Expected: clean.

```bash
git add src/shared/services/voip/voip-messages.service.ts && git commit -m "feat(voip): one send core for the sticky DID and the main line, fail-closed outside production, with MMS media

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Delivery status comes back

**Files:**
- Move: `src/shared/services/providers/twilio/webhooks/{messaging,voice}.ts` to `src/shared/services/providers/twilio/schemas/{messaging,voice}.ts`, then modify `schemas/messaging.ts`
- Modify: `src/shared/services/providers/twilio/DOCS.md:30,54-59,63,88,92`
- Modify: `docs/codebase-conventions/service-architecture.md:126,135,155-159,169-172,175,182`
- Modify: `src/shared/services/providers/twilio/client.ts:196`
- Modify: `src/shared/constants/enums/voip.ts`
- Create: `src/shared/services/voip/lib/map-twilio-message-status.ts`
- Modify: `src/shared/entities/voip-messages/dal/server/mutations.ts:56-88`
- Modify: `src/shared/services/voip/voip-messages.service.ts` (`applyStatusCallback`)
- Create: `src/app/api/webhooks/twilio/route.ts`
- Modify: `scripts/verify-visit-messages.ts`
- Test: a throwaway `scripts/tmp-twilio-signature.ts`, deleted before the commit

**Interfaces:**
- Consumes: `twilioClient.verifyWebhookSignature({ url, signature, params })`, `patchMessageStatusByProviderId`.
- Produces: `mapTwilioMessageStatus(status: string): VoipMessageStatus | null`; `VOIP_MESSAGE_STATUS_RANK`; `messagingInboundWebhookSchema` gains `OptOutType?: 'STOP' | 'START' | 'HELP'` and `MessagingServiceSid?`; `messagingStatusCallbackSchema.MessageStatus` is any string; `voipMessagesService.applyStatusCallback(ctx, { providerMessageId, twilioStatus, errorCode?, at }): Promise<DalReturn<{ status: VoipMessageStatus | null, rowsAffected: number }>>`; the route `POST /api/webhooks/twilio` (Task 10 adds the meeting hook to it).

- [ ] **Step 1: Pin the mapping**

In `scripts/verify-visit-messages.ts`, add the imports:

```ts
import { VOIP_MESSAGE_STATUS_RANK } from '@/shared/constants/enums/voip'
import { mapTwilioMessageStatus } from '@/shared/services/voip/lib/map-twilio-message-status'
```

and append before the final `console.log('✅ …')`:

```ts
{
  assert.equal(mapTwilioMessageStatus('accepted'), 'queued')
  assert.equal(mapTwilioMessageStatus('Sent'), 'sent')
  assert.equal(mapTwilioMessageStatus('read'), 'delivered')
  assert.equal(mapTwilioMessageStatus('undelivered'), 'undelivered')
  assert.equal(mapTwilioMessageStatus('partially_delivered'), null, 'a state the table has no word for is ignored')
  assert.ok(VOIP_MESSAGE_STATUS_RANK.sent < VOIP_MESSAGE_STATUS_RANK.delivered, 'delivered outranks sent')
  assert.equal(VOIP_MESSAGE_STATUS_RANK.failed, VOIP_MESSAGE_STATUS_RANK.delivered, 'one terminal state never overwrites another')
}
console.log('13. Twilio status mapping ✓')
```

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: fails at the import.

- [ ] **Step 2: Move the webhook payload schemas into `schemas/`**

A provider has no `webhooks/` directory; its Zod lives in `schemas/`. Nothing imports these two files yet, so the move is a rename, and `git mv` stages it:

```bash
git mv src/shared/services/providers/twilio/webhooks/messaging.ts src/shared/services/providers/twilio/schemas/messaging.ts
git mv src/shared/services/providers/twilio/webhooks/voice.ts src/shared/services/providers/twilio/schemas/voice.ts
```

In both moved files, change `from '../schemas/primitives'` to `from './primitives'`.

`src/shared/services/providers/twilio/DOCS.md` names the old directory five times. Line 30: the phrase "no `webhooks/verify.ts`" becomes "no `lib/verify.ts`". Line 63: "live in `schemas/` / `webhooks/` / `types.ts`" becomes "live in `schemas/` / `types.ts`". Line 88: "`webhooks/voice.ts` + `webhooks/messaging.ts`" becomes "`schemas/voice.ts` + `schemas/messaging.ts`". Line 92: the import path ends in `twilio/schemas/voice`. Lines 54 to 59, the directory tree, become:

```text
  schemas/              Zod: outbound request shapes and inbound webhook payloads (form-urlencoded parsing at the seam)
    primitives.ts       e164Schema, twilioSidSchema, isoDateTimeSchema
    access-token.ts     mintVoiceAccessTokenInputSchema
    voice.ts            voice* webhook schemas (status callback, dial action, etc.)
    messaging.ts        messaging* webhook schemas (inbound, status callback)
```

`docs/codebase-conventions/service-architecture.md` prescribes the same `webhooks/` directory under `provider-directory-shape`, so it changes in the same commit. Line 126: "no `webhooks/verify.ts`" becomes "no `lib/verify.ts`". Line 135: "**Data-shape Zod** (`schemas/`, `webhooks/`)" becomes "**Data-shape Zod** (`schemas/`)". Line 175: "schemas + types live in `schemas/` / `webhooks/` / `types.ts`" becomes "schemas + types live in `schemas/` / `types.ts`". Line 182: "Standalone `webhooks/verify.ts`" becomes "Standalone `lib/verify.ts`", and a new anti-pattern bullet follows it: "- A `webhooks/` directory — webhook payload Zod is a data shape and lives in `schemas/` with the rest." Lines 155 to 159, the two tree entries, become:

```text
  schemas/                  Zod data shapes: what we send (request shapes) and what the provider sends us (webhook payloads)
    primitives.ts           shared primitives (E.164, timestamps, IDs)
    <resource>.ts           per-resource request + response zod schemas
    <event-class>.ts        per-event-class webhook payload Zod (often a discriminated union)
```

Lines 169 to 172, the "`schemas/` vs `webhooks/`" block, become:

```text
**`schemas/` holds both directions:**
- what WE send to the provider (request shapes, JWT-mint input shapes, etc.)
- what THE PROVIDER sends to us (inbound webhook form payloads, status callbacks)
- Zero internal dependencies other than `schemas/primitives.ts`. Parsed with `.parse()` at the boundary.
```

Run: `grep -rn "webhooks/" docs/codebase-conventions/service-architecture.md src/shared/services/providers/twilio/DOCS.md`
Expected: no matches.

Run: `grep -rn "twilio/webhooks" src scripts`
Expected: no matches.

Run: `pnpm tsc`
Expected: green; the files had no importers.

- [ ] **Step 3: The schemas**

In `src/shared/services/providers/twilio/schemas/messaging.ts`, replace `messagingInboundWebhookSchema` and `messagingStatusCallbackSchema`:

```ts
export const messagingInboundWebhookSchema = z.object({
  MessageSid: twilioSidSchema,
  AccountSid: twilioSidSchema,
  // `From` is the customer; `To` is one of OUR DIDs.
  From: e164Schema,
  To: e164Schema,
  Body: z.string(),
  // Number of media attachments. Twilio also sends MediaUrl0..MediaUrlN +
  // MediaContentType0..N as separate fields when NumMedia > 0; the route
  // handler iterates by index. We don't model the dynamic-keyed fields here.
  NumMedia: z.coerce.number().int().nonnegative(),
  // Present when Advanced Opt-Out handled the message; Twilio has already sent the carrier-required reply.
  OptOutType: z.enum(['STOP', 'START', 'HELP']).optional(),
  MessagingServiceSid: twilioSidSchema.optional(),
})
export type MessagingInboundWebhookPayload = z.infer<typeof messagingInboundWebhookSchema>

// Outbound message status callback. Fires throughout delivery lifecycle when
// `statusCallback` was set on the original send.
export const messagingStatusCallbackSchema = z.object({
  MessageSid: twilioSidSchema,
  AccountSid: twilioSidSchema,
  From: e164Schema,
  To: e164Schema,
  // Any string: Twilio adds lifecycle states over time, and one it did not have yesterday must not 400 the callback.
  MessageStatus: z.string().min(1),
  // ErrorCode is present on `undelivered` / `failed`. Twilio's full list:
  // https://www.twilio.com/docs/api/errors
  ErrorCode: z.coerce.number().int().optional(),
})
export type MessagingStatusCallbackPayload = z.infer<typeof messagingStatusCallbackSchema>
```

Keep `messagingStatusSchema` and its type where they are.

In `src/shared/services/providers/twilio/client.ts`, the doc comment above `verifyWebhookSignature`: change `` `false` ⇒ respond 403 `` to `` `false` ⇒ respond 401 ``.

- [ ] **Step 4: The rank and the mapper**

Append to `src/shared/constants/enums/voip.ts`, after `VoipMessageStatus`:

```ts
/** Delivery only moves forward: a late `sent` callback must not overwrite `delivered`. */
export const VOIP_MESSAGE_STATUS_RANK: Record<VoipMessageStatus, number> = {
  queued: 0,
  received: 0,
  sent: 1,
  delivered: 2,
  undelivered: 2,
  failed: 2,
}
```

Create `src/shared/services/voip/lib/map-twilio-message-status.ts`:

```ts
import type { VoipMessageStatus } from '@/shared/constants/enums/voip'

// Twilio's lifecycle has more states than the table keeps; everything before `sent` reads as queued.
const TWILIO_TO_VOIP: Record<string, VoipMessageStatus> = {
  accepted: 'queued',
  scheduled: 'queued',
  queued: 'queued',
  sending: 'queued',
  sent: 'sent',
  delivered: 'delivered',
  read: 'delivered',
  undelivered: 'undelivered',
  failed: 'failed',
}

/** Null for a state the table has no word for; the callback is then acknowledged and ignored. */
export function mapTwilioMessageStatus(status: string): VoipMessageStatus | null {
  return TWILIO_TO_VOIP[status.toLowerCase()] ?? null
}
```

- [ ] **Step 5: The guarded patch**

In `src/shared/entities/voip-messages/dal/server/mutations.ts`, change the imports to:

```ts
import { and, eq, lt, sql } from 'drizzle-orm'

import { VOIP_MESSAGE_STATUS_RANK } from '@/shared/constants/enums/voip'
import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { voipMessages } from '@/shared/db/schema/voip-messages'
```

and replace `patchMessageStatusByProviderId` with:

```ts
// The row's current rank, from the same table the service ranks the incoming status with.
const currentStatusRank = sql.join([
  sql`CASE ${voipMessages.status}::text`,
  ...Object.entries(VOIP_MESSAGE_STATUS_RANK).map(([status, rank]) => sql`WHEN ${status} THEN ${sql.raw(String(rank))}`),
  sql`ELSE 0 END`,
], sql` `)

/**
 * Apply a delivery-status callback to an outbound message row. No-op when the
 * row isn't found yet (race with our own REST-return patch — eventually
 * consistent) and when the row already holds a later state: a callback never
 * moves a message backwards. Returns rowsAffected so callers can detect both.
 */
export async function patchMessageStatusByProviderId(
  input: PatchMessageStatusByProviderIdInput,
): Promise<DalReturn<{ rowsAffected: number }>> {
  return dalDbOperation(async () => {
    const result = await db
      .update(voipMessages)
      .set({
        status: input.status,
        deliveredAt: input.deliveredAt,
        failedAt: input.failedAt,
        failureReason: input.failureReason,
      })
      .where(and(
        eq(voipMessages.providerMessageId, input.providerMessageId),
        lt(currentStatusRank, VOIP_MESSAGE_STATUS_RANK[input.status]),
      ))
      .returning({ id: voipMessages.id })

    return { rowsAffected: result.length }
  })
}
```

- [ ] **Step 6: The service applies the mapping**

In `voip-messages.service.ts`, add the import:

```ts
import { mapTwilioMessageStatus } from '@/shared/services/voip/lib/map-twilio-message-status'
```

replace `ApplyMessageStatusCallbackInput` with:

```ts
interface ApplyMessageStatusCallbackInput {
  providerMessageId: string
  /** Twilio's MessageStatus, unmapped. */
  twilioStatus: string
  errorCode?: number
  /** When the callback arrived; Twilio sends no event time. */
  at: string
}

interface ApplyMessageStatusCallbackResult {
  /** Null when Twilio's state has no word in the table. */
  status: VoipMessage['status'] | null
  rowsAffected: number
}
```

and replace the `applyStatusCallback` member with:

```ts
    /** Maps Twilio's state onto the table's and never moves a message backwards. */
    applyStatusCallback: async (
      _ctx: ScopedContext,
      input: ApplyMessageStatusCallbackInput,
    ): Promise<DalReturn<ApplyMessageStatusCallbackResult>> => {
      const status = mapTwilioMessageStatus(input.twilioStatus)
      if (!status) {
        return dalSuccess({ status: null, rowsAffected: 0 })
      }
      const terminalFailure = status === 'failed' || status === 'undelivered'
      const patched = await patchMessageStatusByProviderId({
        providerMessageId: input.providerMessageId,
        status,
        deliveredAt: status === 'delivered' ? input.at : undefined,
        failedAt: terminalFailure ? input.at : undefined,
        failureReason: terminalFailure ? `twilio:${input.errorCode ?? 'unknown'}` : undefined,
      })
      if (!patched.success) {
        return patched
      }
      return dalSuccess({ status, rowsAffected: patched.data.rowsAffected })
    },
```

- [ ] **Step 7: The route**

Create `src/app/api/webhooks/twilio/route.ts`:

```ts
import env from '@/shared/config/server-env'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { twilioClient } from '@/shared/services/providers/twilio/client'
import { messagingStatusCallbackSchema } from '@/shared/services/providers/twilio/schemas/messaging'
import { voipMessagesService } from '@/shared/services/voip/voip-messages.service'

const PATH = '/api/webhooks/twilio'

/**
 * Twilio's async callbacks. Messaging status today; voice and recording status will share
 * the endpoint and branch on their own discriminants. Twilio signs the exact public URL plus
 * the form fields, so the URL is rebuilt from VOIP_WEBHOOK_BASE_URL, never from the request.
 */
export async function POST(request: Request): Promise<Response> {
  const params = Object.fromEntries(new URLSearchParams(await request.text()))
  const signature = request.headers.get('x-twilio-signature')
  if (!signature || !twilioClient.verifyWebhookSignature({ url: `${env.VOIP_WEBHOOK_BASE_URL}${PATH}`, signature, params })) {
    return new Response('Invalid signature', { status: 401 })
  }

  if (!('MessageStatus' in params)) {
    return new Response('OK', { status: 200 })
  }

  const parsed = messagingStatusCallbackSchema.safeParse(params)
  if (!parsed.success) {
    console.warn('[twilio webhook] malformed status callback', parsed.error.flatten())
    return new Response('Malformed payload', { status: 400 })
  }

  try {
    await voipMessagesService.applyStatusCallback(SYSTEM_CONTEXT, {
      providerMessageId: parsed.data.MessageSid,
      twilioStatus: parsed.data.MessageStatus,
      errorCode: parsed.data.ErrorCode,
      at: new Date().toISOString(),
    })
  }
  catch (error) {
    // Twilio retries on a non-2xx; a handler fault must not turn one callback into a storm.
    console.error('[twilio webhook] status callback failed', error)
  }

  return new Response('OK', { status: 200 })
}
```

- [ ] **Step 8: Verify**

Run: `pnpm tsx scripts/verify-visit-messages.ts && pnpm tsc && pnpm lint`
Expected: section 13 passes; no type or lint errors.

Then, with the dev server running (started after Task 3's gate set `VOIP_WEBHOOK_BASE_URL`), create `scripts/tmp-twilio-signature.ts`:

```ts
import './lib/load-env'

import assert from 'node:assert/strict'

import { getExpectedTwilioSignature } from 'twilio/lib/webhooks/webhooks'

import env from '@/shared/config/server-env'

const port = process.env.PORT ?? '3000'
const endpoint = `http://localhost:${port}/api/webhooks/twilio`
const url = `${env.VOIP_WEBHOOK_BASE_URL}/api/webhooks/twilio`

async function post(params: Record<string, string>, signature: string): Promise<number> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': signature },
    body: new URLSearchParams(params).toString(),
  })
  return response.status
}

const valid = {
  MessageSid: `SM${'a'.repeat(32)}`,
  AccountSid: env.TWILIO_ACCOUNT_SID!,
  From: '+16265550123',
  To: '+13105550123',
  MessageStatus: 'delivered',
}
assert.equal(await post(valid, getExpectedTwilioSignature(env.TWILIO_AUTH_TOKEN!, url, valid)), 200, 'a signed callback for a SID the table does not hold is acknowledged and changes nothing')
assert.equal(await post(valid, 'not-a-signature'), 401, 'a bad signature is refused')
const malformed = { MessageStatus: 'delivered', MessageSid: 'nope' }
assert.equal(await post(malformed, getExpectedTwilioSignature(env.TWILIO_AUTH_TOKEN!, url, malformed)), 400, 'a signed but malformed envelope is a 400')
const voice = { CallSid: `CA${'b'.repeat(32)}`, CallStatus: 'completed' }
assert.equal(await post(voice, getExpectedTwilioSignature(env.TWILIO_AUTH_TOKEN!, url, voice)), 200, 'a voice callback is acknowledged until a handler exists')
console.log('twilio signature ✓')
```

Run: `NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-twilio-signature.ts`
Expected: `twilio signature ✓`. Review Focus 5 is the first assertion. Then `rm scripts/tmp-twilio-signature.ts`.

- [ ] **Step 9: Commit**

```bash
git add src/shared/services/providers/twilio/schemas/messaging.ts src/shared/services/providers/twilio/schemas/voice.ts src/shared/services/providers/twilio/DOCS.md docs/codebase-conventions/service-architecture.md src/shared/services/providers/twilio/client.ts src/shared/constants/enums/voip.ts src/shared/services/voip/lib/map-twilio-message-status.ts src/shared/entities/voip-messages/dal/server/mutations.ts src/shared/services/voip/voip-messages.service.ts src/app/api/webhooks/twilio/route.ts scripts/verify-visit-messages.ts && git commit -m "feat(voip): Twilio status callbacks land on a signed route, map onto the table's states and never move a message backwards

The webhook payload schemas move from webhooks/ to schemas/; a provider has no webhooks directory, and the provider-shape convention says so now.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: A visit text leaves, and the summary's text leg

**Files:**
- Create: `src/shared/modules/meetings/messages/dal/server/queries.ts`
- Create: `src/shared/modules/meetings/messages/dal/server/settings.ts`
- Modify: `src/shared/entities/voip-messages/dal/server/queries.ts`
- Create: `src/shared/modules/meetings/messages/lib/deliver-visit-text.ts`
- Create: `src/app/api/company/vcard/route.ts`
- Modify: `src/shared/modules/meetings/business/service.ts`
- Modify: `src/trpc/routers/meetings.router/business.router.ts`
- Test: a throwaway `scripts/tmp-send-summary.ts`, deleted before the commit

**Interfaces:**
- Consumes: `renderVisitMessage`, `buildVisitMessageVars` (plan 1), `VISIT_MESSAGE_TEMPLATE_DEFAULTS`, `isVisitMessageEligible`, `voipMessagesService.sendFromMainLine` (Task 4), `voipDidsService.getMainLineDid` (Task 3), `meetingMessageCrud`, `ROOTS.public.homeVisit`, `publicUrl`, `toE164`.
- Produces: `VisitMessageContext`; `getVisitMessageContext(meetingId)`; `listVisitMessageContexts({ from, to })`; `listChainMessages(meetingIds)`; `getTemplateBodies()`; `listPausedKinds()`; `hasOutboundOnThread({ voipDidId, remoteE164 })`; `deliverVisitText(ctx, { context, templateKey, bodies, officeNote?, mediaUrl? }): Promise<VisitTextOutcome>` with `VisitTextOutcome = { status: 'sent' | 'failed' | 'skipped', reason: string | null, voipMessageId: string | null }`; `visitLinkFor(meeting)`; `repDisplayName(rep)`; `meetingService.business.sendVisitSummary(ctx, { meetingId, note? })` returning `{ sms: MeetingMessage }` (Task 7 adds `email`); `meetingsRouter.business.sendVisitSummary`; `GET /api/company/vcard`.

- [ ] **Step 1: The reads**

Create `src/shared/modules/meetings/messages/dal/server/queries.ts`:

```ts
import type { SQL } from 'drizzle-orm'

import type { Meeting } from '@/shared/db/schema'
import type { MeetingMessage } from '@/shared/db/schema/meeting-messages'

import { and, asc, eq, gte, inArray, lt } from 'drizzle-orm'

import { db } from '@/shared/db'
import { user } from '@/shared/db/schema/auth'
import { customers } from '@/shared/db/schema/customers'
import { meetingMessages } from '@/shared/db/schema/meeting-messages'
import { meetingParticipants } from '@/shared/db/schema/meeting-participants'
import { meetings } from '@/shared/db/schema/meetings'

export interface VisitMessageContext {
  meeting: Pick<Meeting, 'id' | 'customerId' | 'ownerId' | 'scheduledFor' | 'scheduledForSetAt' | 'meetingType' | 'meetingOutcome' | 'confirmedAt' | 'homeownerConfirmedAt' | 'homeownerConfirmedVia' | 'shareToken'>
  customer: {
    id: string
    name: string
    /** Bare national digits, as stored. */
    phone: string | null
    email: string | null
    address: string | null
    city: string
    state: string | null
    zip: string
    doNotContact: boolean
  } | null
  /** The owner participant. Null for a system-owned meeting, which has none. */
  rep: { userId: string, name: string, nickname: string | null } | null
}

// Unscoped: jobs and webhooks read these, and a procedure that reaches them has checked the meeting first.
async function listContexts(where: SQL): Promise<VisitMessageContext[]> {
  const rows = await db
    .select({
      meeting: {
        id: meetings.id,
        customerId: meetings.customerId,
        ownerId: meetings.ownerId,
        scheduledFor: meetings.scheduledFor,
        scheduledForSetAt: meetings.scheduledForSetAt,
        meetingType: meetings.meetingType,
        meetingOutcome: meetings.meetingOutcome,
        confirmedAt: meetings.confirmedAt,
        homeownerConfirmedAt: meetings.homeownerConfirmedAt,
        homeownerConfirmedVia: meetings.homeownerConfirmedVia,
        shareToken: meetings.shareToken,
      },
      customer: {
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        address: customers.address,
        city: customers.city,
        state: customers.state,
        zip: customers.zip,
        dncOptedOutAt: customers.dncOptedOutAt,
      },
      rep: { userId: user.id, name: user.name, nickname: user.nickname },
    })
    .from(meetings)
    .leftJoin(customers, eq(customers.id, meetings.customerId))
    .leftJoin(meetingParticipants, and(eq(meetingParticipants.meetingId, meetings.id), eq(meetingParticipants.role, 'owner')))
    .leftJoin(user, eq(user.id, meetingParticipants.userId))
    .where(where)
    .orderBy(asc(meetings.scheduledFor))

  // A leftJoin miss yields an all-null object rather than null.
  return rows.map(row => ({
    meeting: row.meeting,
    customer: row.customer?.id
      ? {
          id: row.customer.id,
          name: row.customer.name!,
          phone: row.customer.phone,
          email: row.customer.email,
          address: row.customer.address,
          city: row.customer.city!,
          state: row.customer.state,
          zip: row.customer.zip!,
          doNotContact: row.customer.dncOptedOutAt != null,
        }
      : null,
    rep: row.rep?.userId ? { userId: row.rep.userId, name: row.rep.name!, nickname: row.rep.nickname } : null,
  }))
}

export async function getVisitMessageContext(meetingId: string): Promise<VisitMessageContext | undefined> {
  const [context] = await listContexts(eq(meetings.id, meetingId))
  return context
}

/** Every meeting whose time falls in a half-open window of instants, soonest first. */
export async function listVisitMessageContexts(window: { from: string, to: string }): Promise<VisitMessageContext[]> {
  return listContexts(and(gte(meetings.scheduledFor, window.from), lt(meetings.scheduledFor, window.to))!)
}

/** Every visit message across a reschedule chain, oldest first. */
export async function listChainMessages(meetingIds: string[]): Promise<MeetingMessage[]> {
  if (meetingIds.length === 0) {
    return []
  }
  return db
    .select()
    .from(meetingMessages)
    .where(inArray(meetingMessages.meetingId, meetingIds))
    .orderBy(asc(meetingMessages.createdAt))
}
```

Create `src/shared/modules/meetings/messages/dal/server/settings.ts`:

```ts
import type { PausableVisitMessageKind, VisitMessageTemplateKey } from '@/shared/modules/meetings/messages/constants/kinds'

import { db } from '@/shared/db'
import { visitMessagePauses } from '@/shared/db/schema/visit-message-pauses'
import { visitMessageTemplates } from '@/shared/db/schema/visit-message-templates'
import { VISIT_MESSAGE_TEMPLATE_DEFAULTS } from '@/shared/modules/meetings/messages/constants/templates'

/** The current wording of every text: a super-admin's edit where one exists, the default otherwise. */
export async function getTemplateBodies(): Promise<Record<VisitMessageTemplateKey, string>> {
  const rows = await db.select({ key: visitMessageTemplates.key, body: visitMessageTemplates.body }).from(visitMessageTemplates)
  const bodies = { ...VISIT_MESSAGE_TEMPLATE_DEFAULTS }
  for (const row of rows) {
    bodies[row.key] = row.body
  }
  return bodies
}

export async function listPausedKinds(): Promise<PausableVisitMessageKind[]> {
  const rows = await db.select({ kind: visitMessagePauses.kind }).from(visitMessagePauses)
  return rows.map(row => row.kind)
}
```

Append to `src/shared/entities/voip-messages/dal/server/queries.ts` (its imports already have `and`, `eq` and `db`; add any that are missing):

```ts
/** Whether this line has ever texted this number: the first text of a thread carries the opt-out line. */
export async function hasOutboundOnThread(input: { voipDidId: string, remoteE164: string }): Promise<boolean> {
  const [row] = await db
    .select({ id: voipMessages.id })
    .from(voipMessages)
    .where(and(
      eq(voipMessages.voipDidId, input.voipDidId),
      eq(voipMessages.remoteE164, input.remoteE164),
      eq(voipMessages.direction, 'outbound'),
    ))
    .limit(1)
  return row !== undefined
}
```

- [ ] **Step 2: Deliver one text**

Create `src/shared/modules/meetings/messages/lib/deliver-visit-text.ts`:

```ts
import type { ScopedContext } from '@/shared/dal/server/types'
import type { VisitMessageTemplateKey } from '@/shared/modules/meetings/messages/constants/kinds'
import type { VisitMessageContext } from '@/shared/modules/meetings/messages/dal/server/queries'

import { publicUrl } from '@/shared/config/public-url'
import { ROOTS } from '@/shared/config/roots'
import { hasOutboundOnThread } from '@/shared/entities/voip-messages/dal/server/queries'
import { toE164 } from '@/shared/lib/phone'
import { buildVisitMessageVars, renderVisitMessage } from '@/shared/modules/meetings/messages/lib/render-visit-message'
import { voipDidsService } from '@/shared/services/voip/voip-dids.service'
import { voipMessagesService } from '@/shared/services/voip/voip-messages.service'

export interface VisitTextOutcome {
  status: 'sent' | 'failed' | 'skipped'
  reason: string | null
  voipMessageId: string | null
}

// Twilio refuses a send to a number that opted out at the carrier; that is do-not-contact, not a fault.
const TWILIO_OPTED_OUT = 'twilio:21610'

export function visitLinkFor(meeting: Pick<VisitMessageContext['meeting'], 'id' | 'shareToken'>): string {
  return publicUrl(ROOTS.public.homeVisit(meeting.id, meeting.shareToken))
}

/** Homeowner copy names the rep by nickname, else first name; null when the meeting has no rep. */
export function repDisplayName(rep: VisitMessageContext['rep']): string | null {
  if (!rep) {
    return null
  }
  return rep.nickname?.trim() || rep.name.trim().split(/\s+/)[0] || null
}

/**
 * Renders one visit text from the current wording and sends it from the main line. The caller records
 * the outcome: the summary inserts its row, a run finishes its claim.
 */
export async function deliverVisitText(ctx: ScopedContext, input: {
  context: VisitMessageContext
  templateKey: VisitMessageTemplateKey
  bodies: Record<VisitMessageTemplateKey, string>
  officeNote?: string | null
  mediaUrl?: string[]
}): Promise<VisitTextOutcome> {
  const { meeting, customer, rep } = input.context
  const remoteE164 = toE164(customer?.phone)
  if (!customer || !remoteE164) {
    return { status: 'skipped', reason: 'no_phone', voipMessageId: null }
  }

  const mainLine = await voipDidsService.getMainLineDid()
  if (!mainLine.success || !mainLine.data) {
    return { status: 'failed', reason: 'no_main_line', voipMessageId: null }
  }

  const stopLine = !(await hasOutboundOnThread({ voipDidId: mainLine.data.id, remoteE164 }))
  const body = renderVisitMessage(
    input.bodies[input.templateKey],
    buildVisitMessageVars({
      customerName: customer.name,
      repName: repDisplayName(rep),
      scheduledFor: meeting.scheduledFor,
      visitLink: visitLinkFor(meeting),
      officeNote: input.officeNote,
    }),
    { stopLine },
  )

  const sent = await voipMessagesService.sendFromMainLine(ctx, { customerId: customer.id, remoteE164, body, mediaUrl: input.mediaUrl })
  if (!sent.success) {
    console.error('[deliverVisitText] send refused', { meetingId: meeting.id, error: sent.error })
    return { status: 'failed', reason: 'send_error', voipMessageId: null }
  }
  const { messageId, status, failureReason } = sent.data
  if (status === 'sent') {
    return { status: 'sent', reason: null, voipMessageId: messageId }
  }
  if (failureReason === 'dnc' || failureReason === TWILIO_OPTED_OUT) {
    return { status: 'skipped', reason: 'dnc', voipMessageId: messageId }
  }
  return { status: 'failed', reason: failureReason ?? 'send_error', voipMessageId: messageId }
}
```

- [ ] **Step 3: The contact card**

Create `src/app/api/company/vcard/route.ts`:

```ts
import { APP_HOSTS } from '@/shared/config/roots'
import { companyInfo } from '@/shared/constants/company'
import { toE164 } from '@/shared/lib/phone'
import { voipDidsService } from '@/shared/services/voip/voip-dids.service'

// The phone comes from the database, so the file is built per request, never at build time.
export const dynamic = 'force-dynamic'

function contact(accessor: 'mainOffice' | 'phone' | 'email'): string {
  return companyInfo.contactInfo.find(item => item.accessor === accessor)!.value
}

// The office address is one display string ("street, \ncity, ST zip"); vCard wants its parts.
function officeAddress(): { street: string, city: string, state: string, zip: string } {
  const [street = '', cityLine = ''] = contact('mainOffice').split('\n').map(part => part.trim().replace(/,$/, ''))
  const [city = '', stateZip = ''] = cityLine.split(',').map(part => part.trim())
  const [state = '', zip = ''] = stateZip.split(/\s+/)
  return { street, city, state, zip }
}

function escapeVcard(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** The contact card the visit summary's MMS carries, so the main line shows a name when it texts. */
export async function GET(): Promise<Response> {
  const mainLine = await voipDidsService.getMainLineDid()
  const phone = (mainLine.success && mainLine.data?.e164) || toE164(contact('phone'))!
  const address = officeAddress()
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVcard(companyInfo.name)}`,
    `ORG:${escapeVcard(companyInfo.name)}`,
    `TEL;TYPE=CELL,VOICE:${phone}`,
    `EMAIL:${contact('email')}`,
    `URL:https://${APP_HOSTS.prod[0]}`,
    `ADR;TYPE=WORK:;;${escapeVcard(address.street)};${escapeVcard(address.city)};${address.state};${address.zip};USA`,
    'END:VCARD',
  ]
  return new Response(`${lines.join('\r\n')}\r\n`, {
    headers: {
      // Twilio wants a matching content type and a filename of 20 ASCII characters or fewer.
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': 'attachment; filename="tri-pros.vcf"',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
```

- [ ] **Step 4: The verb and its procedure**

In `src/shared/modules/meetings/business/service.ts`, add the imports:

```ts
import type { MeetingMessage } from '@/shared/db/schema/meeting-messages'

import { publicUrl } from '@/shared/config/public-url'
import { meetingMessageCrud } from '@/shared/modules/meetings/messages/dal/server/crud'
import { getVisitMessageContext } from '@/shared/modules/meetings/messages/dal/server/queries'
import { getTemplateBodies } from '@/shared/modules/meetings/messages/dal/server/settings'
import { deliverVisitText } from '@/shared/modules/meetings/messages/lib/deliver-visit-text'
import { isVisitMessageEligible } from '@/shared/modules/meetings/messages/lib/is-visit-message-eligible'
import { voipDidsService } from '@/shared/services/voip/voip-dids.service'
```

and the member, after `reschedule`:

```ts
  /**
   * The setter sends the visit summary during the booking call, and staff resend it after a time change.
   * One row per leg, so a dialog can report each.
   */
  async sendVisitSummary(
    ctx: ScopedContext,
    input: { meetingId: string, note?: string | null },
  ): Promise<DalReturn<{ sms: MeetingMessage }>> {
    return dalDbOperation(async () => {
      // The scoped read is the visibility check; the unscoped context read is for the send.
      const meeting = dalVerifySuccess(await meetingCrud.getById(ctx, { id: input.meetingId }))
      if (!meeting) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      if (!isVisitMessageEligible(meeting, new Date())) {
        throw new ThrowableDalError({ type: 'precondition-failed', reason: 'Visit messages go to upcoming, undecided, non-project meetings only.' })
      }
      const mainLine = dalVerifySuccess(await voipDidsService.getMainLineDid())
      if (!mainLine) {
        throw new ThrowableDalError({ type: 'precondition-failed', reason: 'No main line is configured.' })
      }

      const context = await getVisitMessageContext(meeting.id)
      if (!context) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      const bodies = await getTemplateBodies()
      const note = input.note?.trim() || null
      const actorUserId = ctx.session?.user.id ?? null

      const text = await deliverVisitText(ctx, {
        context,
        templateKey: 'visit_summary',
        bodies,
        officeNote: note,
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
        actorUserId,
        note,
      }))

      return { sms }
    })
  },
```

In `src/trpc/routers/meetings.router/business.router.ts`, change the procedures import to `import { meetingProcedure, visitMessagesProcedure } from './procedures'` and add:

```ts
  sendVisitSummary: visitMessagesProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      note: z.string().trim().max(300).optional(),
    }))
    .mutation(async ({ input, ctx }) => dalToTrpc(await meetingService.business.sendVisitSummary(ctx, input))),
```

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean. The `NAV_PATH_RE` lint rule guards `href` and `redirect()` literals only, so the `'/api/company/vcard'` argument to `publicUrl` passes, as `create-job.ts`'s does.

- [ ] **Step 6: The wiring test (needs the owner's test meeting from Task 3's gate)**

Create `scripts/tmp-send-summary.ts`:

```ts
import './lib/load-env'

import assert from 'node:assert/strict'

import { eq } from 'drizzle-orm'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { meetingMessages } from '@/shared/db/schema/meeting-messages'
import { voipMessages } from '@/shared/db/schema/voip-messages'
import { meetingService } from '@/shared/modules/meetings/service'
import { twilioClient } from '@/shared/services/providers/twilio/client'

const meetingId = process.argv[process.argv.indexOf('--meeting') + 1]
assert.ok(meetingId, 'pass --meeting <the owner\'s test meeting id>')

const sent: Record<string, unknown>[] = []
;(twilioClient as any).sendMessage = async (params: Record<string, unknown>) => {
  sent.push(params)
  return { sid: `SM${'1'.repeat(32)}` }
}

const rows: string[] = []
const voipRows: string[] = []
try {
  const { sms } = dalVerifySuccess(await meetingService.business.sendVisitSummary(SYSTEM_CONTEXT, { meetingId, note: 'Park in the driveway' }))
  rows.push(sms.id)
  if (sms.voipMessageId) {
    voipRows.push(sms.voipMessageId)
  }

  assert.equal(sms.status, 'sent')
  assert.equal(sms.kind, 'visit_summary')
  assert.equal(sms.channel, 'sms')
  assert.equal(sms.note, 'Park in the driveway')
  assert.equal(sms.actorUserId, null, 'no session, no actor')

  const body = String(sent[0]!.body)
  assert.match(body, /Park in the driveway/)
  assert.match(body, new RegExp(`/home-visits/${meetingId}\\?token=[0-9a-f]{32}`), 'the link carries the meeting\'s token')
  assert.match(body, /Reply YES to confirm\./)
  assert.match(body, /Reply STOP to opt out\.$/, 'the first text on the thread carries the opt-out line')
  assert.ok(!/[\u202F\u00A0]/.test(body), 'GSM-7 only')
  const media = sent[0]!.mediaUrl as string[] | undefined
  assert.ok(media?.[0]?.endsWith('/api/company/vcard'), 'the summary goes as MMS with the contact card')
  console.log('send summary ✓')
}
finally {
  for (const id of rows) {
    await db.delete(meetingMessages).where(eq(meetingMessages.id, id))
  }
  for (const id of voipRows) {
    await db.delete(voipMessages).where(eq(voipMessages.id, id))
  }
}
```

Run: `DRIZZLE_TARGET=dev NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-send-summary.ts --meeting <id>`
Expected: `send summary ✓`; both rows removed. Run it a second time: the opt-out assertion still holds because the first run's row was deleted. Then `rm scripts/tmp-send-summary.ts`.

With the dev server running: `curl -s -D - http://localhost:3000/api/company/vcard`
Expected: `Content-Type: text/vcard`, `Content-Disposition: attachment; filename="tri-pros.vcf"`, a body from `BEGIN:VCARD` to `END:VCARD` whose `TEL` is the main line.

- [ ] **Step 7: Commit**

```bash
git add src/shared/modules/meetings/messages/dal/server/queries.ts src/shared/modules/meetings/messages/dal/server/settings.ts src/shared/entities/voip-messages/dal/server/queries.ts src/shared/modules/meetings/messages/lib/deliver-visit-text.ts src/app/api/company/vcard/route.ts src/shared/modules/meetings/business/service.ts src/trpc/routers/meetings.router/business.router.ts && git commit -m "feat(meetings): a visit text renders from the current wording and leaves from the main line; the summary goes as MMS with the company contact card

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The summary's email leg, with the invite

**Files:**
- Create: `src/shared/modules/meetings/messages/lib/google-calendar-link.ts`
- Create: `src/shared/services/providers/resend/emails/visit-summary-email.tsx`
- Modify: `src/shared/services/providers/resend/lib/render-emails.tsx`
- Modify: `src/shared/services/email.service.ts`
- Create: `src/shared/modules/meetings/messages/lib/deliver-visit-email.ts`
- Modify: `src/shared/modules/meetings/business/service.ts` (`sendVisitSummary`)
- Create: `scripts/visit-messages.ts` (the dev tool; Tasks 8 and 9 extend it)
- Modify: `scripts/verify-visit-messages.ts`
- Test: a throwaway `scripts/tmp-summary-email.ts`, deleted before the commit

**Interfaces:**
- Consumes: `buildIcs` (plan 1, `IcsEventInput`), `getRescheduleChain`, `listChainMessages`, `formatArrivalWindow`, `formatBusinessDay`, `formatBusinessDayTime`, `formatCustomerAddress`, `formatPhone`, `buildSenderFrom`, `RESEND_LEAD_INBOX`, `MEETING_ESTIMATED_DURATION_MS`.
- Produces: `buildGoogleCalendarLink({ summary, start, durationMs, location?, description? })`; `VisitSummaryEmailProps`, `VisitSummaryEmail`, `buildVisitSummaryText(props)`; `renderVisitSummaryEmail(props)`; `emailService.sendVisitSummaryEmail({ to, repName, visitDay, props, text, ics }): Promise<{ id: string }>`; `buildVisitInvite({ context, chainIds, sequence, method, now })`; `deliverVisitSummaryEmail(input): Promise<VisitEmailOutcome>` with `VisitEmailOutcome = { status: 'sent' | 'failed', reason: string | null, emailProviderId: string | null }`; `sendVisitSummary` returns `{ sms, email }`.

- [ ] **Step 1: Pin the calendar link**

In `scripts/verify-visit-messages.ts`, add the import:

```ts
import { buildGoogleCalendarLink } from '@/shared/modules/meetings/messages/lib/google-calendar-link'
```

and append before the final `console.log('✅ …')`:

```ts
{
  const link = buildGoogleCalendarLink({ summary: 'Home visit with Tri Pros', start: VISIT, durationMs: 2 * 60 * 60 * 1000, location: '1 Main St, Calabasas, CA 91302', description: 'Oliver will arrive between 10:00 and 10:30 AM.' })
  assert.ok(link.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE'))
  assert.ok(link.includes('dates=20261009T170000Z%2F20261009T190000Z'), 'UTC stamps for the booked time and two hours after')
  assert.ok(link.includes('text=Home+visit+with+Tri+Pros'))
  assert.ok(link.includes('location=1+Main+St%2C+Calabasas%2C+CA+91302'))
}
console.log('14. Google Calendar link ✓')
```

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: fails at the import.

- [ ] **Step 2: The link builder**

Create `src/shared/modules/meetings/messages/lib/google-calendar-link.ts`:

```ts
function utcStamp(date: Date | string): string {
  return new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** For a homeowner whose mail client ignores the attached invite. */
export function buildGoogleCalendarLink(input: {
  summary: string
  start: Date | string
  durationMs: number
  location?: string
  description?: string
}): string {
  const start = new Date(input.start)
  const end = new Date(start.getTime() + input.durationMs)
  const search = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.summary,
    dates: `${utcStamp(start)}/${utcStamp(end)}`,
  })
  if (input.location) {
    search.set('location', input.location)
  }
  if (input.description) {
    search.set('details', input.description)
  }
  return `https://calendar.google.com/calendar/render?${search.toString()}`
}
```

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: section 14 passes.

- [ ] **Step 3: The template**

Create `src/shared/services/providers/resend/emails/visit-summary-email.tsx`:

```tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export interface VisitSummaryEmailProps {
  firstName: string
  /** Null when the meeting has no rep yet. */
  repName: string | null
  /** "Wed, Oct 7, 10:00 AM" */
  visitDayTime: string
  /** "10:00 and 10:30 AM" */
  arrivalWindow: string
  addressLine1: string
  addressLine2: string
  visitUrl: string
  googleCalendarUrl: string
  officeNote: string | null
  /** "(626) 555-0123" */
  mainLinePhone: string
  companyName: string
  logoUrl: string
}

const styles = {
  body: {
    backgroundColor: '#f6f9fc',
    fontFamily: '-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif',
    padding: '20px 0',
  },
  container: {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '32px',
    borderRadius: 8,
    maxWidth: '600px',
  },
  heading: {
    fontSize: 26,
    fontWeight: 700,
    textAlign: 'center' as const,
    marginBottom: 16,
  },
  text: {
    fontSize: 16,
    lineHeight: '24px',
    color: '#333',
    marginBottom: 16,
  },
  subtle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center' as const,
  },
  noteSection: {
    backgroundColor: '#f0f7ff',
    borderLeft: '3px solid #2563eb',
    padding: '12px 16px',
    borderRadius: 4,
    marginBottom: 16,
  },
  noteLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#2563eb',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 16,
    lineHeight: '24px',
    color: '#333',
    margin: 0,
  },
  button: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    padding: '14px 28px',
    borderRadius: 6,
    fontSize: 16,
    fontWeight: 600,
    textDecoration: 'none',
  },
  hr: {
    borderColor: '#e6ebf1',
    margin: '24px 0',
  },
  footer: {
    fontSize: 12,
    color: '#8898aa',
    textAlign: 'center' as const,
    marginTop: 24,
  },
}

function repOrFallback(repName: string | null): string {
  return repName ?? 'Your rep'
}

export function VisitSummaryEmail(props: VisitSummaryEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Your home visit is booked for
        {' '}
        {props.visitDayTime}
      </Preview>

      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={{ textAlign: 'center', marginBottom: 24 }}>
            <Img src={props.logoUrl} width="140" alt={props.companyName} />
          </Section>

          <Heading style={styles.heading}>Your home visit is booked</Heading>

          <Text style={styles.text}>
            Hi
            {' '}
            {props.firstName}
            ,
          </Text>

          <Text style={styles.text}>
            {repOrFallback(props.repName)}
            {' '}
            from
            {' '}
            {props.companyName}
            {' '}
            will see you on
            {' '}
            <strong>{props.visitDayTime}</strong>
            , arriving between
            {' '}
            {props.arrivalWindow}
            .
          </Text>

          {(props.addressLine1 || props.addressLine2) && (
            <Text style={styles.text}>
              {props.addressLine1}
              {props.addressLine1 && props.addressLine2 && <br />}
              {props.addressLine2}
            </Text>
          )}

          {props.officeNote && (
            <Section style={styles.noteSection}>
              <Text style={styles.noteLabel}>A note from our team</Text>
              <Text style={styles.noteText}>{props.officeNote}</Text>
            </Section>
          )}

          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={props.visitUrl} style={styles.button}>
              See your visit details
            </Button>
          </Section>

          <Text style={styles.subtle}>
            The attached invite adds the visit to your calendar, or
            {' '}
            <Link href={props.googleCalendarUrl}>add it to Google Calendar</Link>
            .
          </Text>

          <Hr style={styles.hr} />

          <Text style={styles.text}>
            We kindly request that everyone needed to make this decision is present during our meeting.
            Want to keep your partner in the loop? Forward this email or share your visit link.
          </Text>

          <Text style={styles.text}>
            Need to change the time? Call or text us at
            {' '}
            {props.mainLinePhone}
            .
          </Text>

          <Text style={styles.footer}>{props.companyName}</Text>
        </Container>
      </Body>
    </Html>
  )
}

/** The plain-text part, so a text-only client and the spam filters see the same message. */
export function buildVisitSummaryText(props: VisitSummaryEmailProps): string {
  return [
    `Hi ${props.firstName},`,
    '',
    `${repOrFallback(props.repName)} from ${props.companyName} will see you on ${props.visitDayTime}, arriving between ${props.arrivalWindow}.`,
    [props.addressLine1, props.addressLine2].filter(Boolean).join('\n'),
    ...(props.officeNote ? ['', `A note from our team: ${props.officeNote}`] : []),
    '',
    `Your visit details: ${props.visitUrl}`,
    `Add to Google Calendar: ${props.googleCalendarUrl}`,
    '',
    'We kindly request that everyone needed to make this decision is present during our meeting.',
    `Need to change the time? Call or text us at ${props.mainLinePhone}.`,
    '',
    props.companyName,
  ].join('\n')
}
```

In `src/shared/services/providers/resend/lib/render-emails.tsx`, add:

```tsx
import type { VisitSummaryEmailProps } from '@/shared/services/providers/resend/emails/visit-summary-email'
import { VisitSummaryEmail } from '@/shared/services/providers/resend/emails/visit-summary-email'

export function renderVisitSummaryEmail(props: VisitSummaryEmailProps) {
  return <VisitSummaryEmail {...props} />
}
```

- [ ] **Step 4: The email service**

In `src/shared/services/email.service.ts`, add the type import:

```ts
import type { VisitSummaryEmailProps } from '@/shared/services/providers/resend/emails/visit-summary-email'
```

and the member, after `sendProposalEmail`:

```ts
    /** The visit summary. The invite travels as a `text/calendar` attachment, which mail clients add to the calendar. */
    sendVisitSummaryEmail: async (params: {
      to: string
      repName: string | null
      /** "Wed, Oct 7" */
      visitDay: string
      props: VisitSummaryEmailProps
      text: string
      ics: string
    }): Promise<{ id: string }> => {
      const templates = await loadEmailTemplates()
      const { data, error } = await resendClient.emails.send({
        from: buildSenderFrom(params.repName),
        to: params.to,
        replyTo: RESEND_LEAD_INBOX,
        subject: `Your home visit on ${params.visitDay}`,
        // see List-Unsubscribe rationale on sendProposalEmail
        headers: {
          'List-Unsubscribe': `<mailto:${RESEND_LEAD_INBOX}?subject=unsubscribe>`,
        },
        react: templates.renderVisitSummaryEmail(params.props),
        text: params.text,
        attachments: [{
          filename: 'home-visit.ics',
          content: Buffer.from(params.ics, 'utf8'),
          contentType: 'text/calendar; method=REQUEST',
        }],
      })

      if (error || !data) {
        throw new Error(`Failed to send visit summary email: ${JSON.stringify(error)}`)
      }

      return { id: data.id }
    },
```

- [ ] **Step 5: Deliver the email leg**

Create `src/shared/modules/meetings/messages/lib/deliver-visit-email.ts`:

```ts
import type { VisitMessageContext } from '@/shared/modules/meetings/messages/dal/server/queries'
import type { VisitSummaryEmailProps } from '@/shared/services/providers/resend/emails/visit-summary-email'

import { publicUrl } from '@/shared/config/public-url'
import { APP_HOSTS } from '@/shared/config/roots'
import { companyInfo } from '@/shared/constants/company'
import { MEETING_ESTIMATED_DURATION_MS } from '@/shared/entities/meetings/constants/scheduling'
import { formatBusinessDay, formatBusinessDayTime } from '@/shared/lib/business-time'
import { formatCustomerAddress } from '@/shared/lib/formatters'
import { formatPhone } from '@/shared/lib/phone'
import { formatArrivalWindow } from '@/shared/modules/meetings/core/lib/arrival-window'
import { repDisplayName, visitLinkFor } from '@/shared/modules/meetings/messages/lib/deliver-visit-text'
import { buildIcs } from '@/shared/modules/meetings/messages/lib/build-ics'
import { buildGoogleCalendarLink } from '@/shared/modules/meetings/messages/lib/google-calendar-link'
import { emailService } from '@/shared/services/email.service'
import { buildVisitSummaryText } from '@/shared/services/providers/resend/emails/visit-summary-email'
import { RESEND_LEAD_INBOX } from '@/shared/services/providers/resend/constants'

export interface VisitEmailOutcome {
  status: 'sent' | 'failed'
  reason: string | null
  emailProviderId: string | null
}

const PROD_ID = `-//${companyInfo.name}//Home Visit//EN`

function eventSummary(): string {
  return `Home visit with ${companyInfo.name}`
}

/** The calendar entry for a visit. One UID per reschedule chain, so a resend updates the entry instead of adding one. */
export function buildVisitInvite(input: {
  context: VisitMessageContext
  /** Oldest first; the first id names the entry for the life of the chain. */
  chainIds: string[]
  sequence: number
  method: 'REQUEST' | 'CANCEL'
  now: Date
}): string {
  const { meeting, customer, rep } = input.context
  const visitUrl = visitLinkFor(meeting)
  const address = customer
    ? formatCustomerAddress({ address: customer.address, city: customer.city, state: customer.state, zip: customer.zip })
    : null
  return buildIcs({
    method: input.method,
    prodId: PROD_ID,
    uid: `${input.chainIds[0] ?? meeting.id}@${APP_HOSTS.prod[0]}`,
    sequence: input.sequence,
    start: meeting.scheduledFor,
    durationMs: MEETING_ESTIMATED_DURATION_MS,
    summary: eventSummary(),
    description: `${repDisplayName(rep) ?? 'Your rep'} from ${companyInfo.name} will arrive between ${formatArrivalWindow(meeting.scheduledFor)}.\nYour visit details: ${visitUrl}`,
    location: address?.hasAddress ? address.singleLine : undefined,
    url: visitUrl,
    organizer: { name: companyInfo.name, email: RESEND_LEAD_INBOX },
    attendee: { name: customer?.name ?? '', email: customer?.email ?? '' },
    now: input.now,
  })
}

export function buildVisitSummaryEmailProps(input: {
  context: VisitMessageContext
  officeNote: string | null
  mainLineE164: string
}): VisitSummaryEmailProps {
  const { meeting, customer, rep } = input.context
  const visitUrl = visitLinkFor(meeting)
  const address = customer
    ? formatCustomerAddress({ address: customer.address, city: customer.city, state: customer.state, zip: customer.zip })
    : null
  return {
    firstName: customer?.name.trim().split(/\s+/)[0] || 'there',
    repName: repDisplayName(rep),
    visitDayTime: formatBusinessDayTime(meeting.scheduledFor),
    arrivalWindow: formatArrivalWindow(meeting.scheduledFor),
    addressLine1: address?.line1 ?? '',
    addressLine2: address?.line2 ?? '',
    visitUrl,
    googleCalendarUrl: buildGoogleCalendarLink({
      summary: eventSummary(),
      start: meeting.scheduledFor,
      durationMs: MEETING_ESTIMATED_DURATION_MS,
      location: address?.hasAddress ? address.singleLine : undefined,
      description: `Your visit details: ${visitUrl}`,
    }),
    officeNote: input.officeNote,
    mainLinePhone: formatPhone(input.mainLineE164),
    companyName: companyInfo.name,
    logoUrl: publicUrl('/company/logo/logo-light-right.jpg'),
  }
}

/** Sends the summary email with its invite. The caller records the outcome. */
export async function deliverVisitSummaryEmail(input: {
  context: VisitMessageContext
  chainIds: string[]
  /** How many summary emails the chain already sent; the invite's SEQUENCE. */
  sequence: number
  officeNote: string | null
  mainLineE164: string
  now: Date
}): Promise<VisitEmailOutcome> {
  const { meeting, customer } = input.context
  if (!customer?.email) {
    return { status: 'failed', reason: 'no_email', emailProviderId: null }
  }
  const props = buildVisitSummaryEmailProps({ context: input.context, officeNote: input.officeNote, mainLineE164: input.mainLineE164 })
  try {
    const { id } = await emailService.sendVisitSummaryEmail({
      to: customer.email,
      repName: props.repName,
      visitDay: formatBusinessDay(meeting.scheduledFor),
      props,
      text: buildVisitSummaryText(props),
      ics: buildVisitInvite({ context: input.context, chainIds: input.chainIds, sequence: input.sequence, method: 'REQUEST', now: input.now }),
    })
    return { status: 'sent', reason: null, emailProviderId: id }
  }
  catch (error) {
    console.error('[deliverVisitSummaryEmail] send failed', { meetingId: meeting.id, error })
    return { status: 'failed', reason: 'send_error', emailProviderId: null }
  }
}
```

- [ ] **Step 6: The email leg in `sendVisitSummary`**

In `business/service.ts`, add the imports:

```ts
import { getRescheduleChain } from '@/shared/entities/meetings/dal/server/queries'
import { listChainMessages } from '@/shared/modules/meetings/messages/dal/server/queries'
import { deliverVisitSummaryEmail } from '@/shared/modules/meetings/messages/lib/deliver-visit-email'
```

(merge `getRescheduleChain` into the existing import from that queries module). Change the return type to `Promise<DalReturn<{ sms: MeetingMessage, email: MeetingMessage }>>` and, after the `sms` row is written, before `return`, add:

```ts
      const forScheduledFor = meeting.scheduledFor
      const base = { meetingId: meeting.id, kind: 'visit_summary' as const, channel: 'email' as const, forScheduledFor, actorUserId, note }
      let email: MeetingMessage
      if (!context.customer?.email) {
        email = dalVerifySuccess(await meetingMessageCrud.create(ctx, { ...base, status: 'skipped', reason: 'no_email' }))
      }
      else {
        const chainIds = dalVerifySuccess(await getRescheduleChain(ctx, { meetingId: meeting.id }))
        const chainMessages = await listChainMessages(chainIds)
        const sequence = chainMessages.filter(message => message.kind === 'visit_summary' && message.channel === 'email' && message.status === 'sent').length
        const outcome = await deliverVisitSummaryEmail({ context, chainIds, sequence, officeNote: note, mainLineE164: mainLine.e164, now: new Date() })
        email = dalVerifySuccess(await meetingMessageCrud.create(ctx, { ...base, status: outcome.status, reason: outcome.reason, emailProviderId: outcome.emailProviderId }))
      }

      return { sms, email }
```

and change the existing `return { sms }` accordingly (there is now one return).

- [ ] **Step 7: The dev tool**

Create `scripts/visit-messages.ts`:

```ts
/**
 * Drives the visit-message verbs without the dashboard, for dev checks. Sends are real: outside production
 * every text goes to VOIP_DEV_OVERRIDE_NUMBER and every email to EMAIL_DEV_OVERRIDE.
 *
 *   NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/visit-messages.ts summary --meeting <id> [--note "..."]
 */
import './lib/load-env'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { meetingService } from '@/shared/modules/meetings/service'

function flagValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function requireFlag(name: string): string {
  const value = flagValue(name)
  if (!value) {
    console.error(`Missing ${name}`)
    process.exit(1)
  }
  return value
}

async function main() {
  const command = process.argv[2]
  switch (command) {
    case 'summary': {
      const meetingId = requireFlag('--meeting')
      const result = dalVerifySuccess(await meetingService.business.sendVisitSummary(SYSTEM_CONTEXT, { meetingId, note: flagValue('--note') }))
      console.log(`sms:   ${result.sms.status}${result.sms.reason ? ` (${result.sms.reason})` : ''}`)
      console.log(`email: ${result.email.status}${result.email.reason ? ` (${result.email.reason})` : ''}`)
      return
    }
    default:
      console.error('Usage: visit-messages.ts summary --meeting <id> [--note "..."]')
      process.exit(1)
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error)
  process.exit(1)
})
```

- [ ] **Step 8: Verify**

Run: `pnpm tsx scripts/verify-visit-messages.ts && pnpm tsc && pnpm lint`
Expected: green.

Create `scripts/tmp-summary-email.ts` (needs the owner's test meeting):

```ts
import './lib/load-env'

import assert from 'node:assert/strict'

import { render } from '@react-email/components'
import { eq } from 'drizzle-orm'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { meetingMessages } from '@/shared/db/schema/meeting-messages'
import { voipMessages } from '@/shared/db/schema/voip-messages'
import { getVisitMessageContext } from '@/shared/modules/meetings/messages/dal/server/queries'
import { buildVisitInvite, buildVisitSummaryEmailProps } from '@/shared/modules/meetings/messages/lib/deliver-visit-email'
import { meetingService } from '@/shared/modules/meetings/service'
import { emailService } from '@/shared/services/email.service'
import { renderVisitSummaryEmail } from '@/shared/services/providers/resend/lib/render-emails'
import { twilioClient } from '@/shared/services/providers/twilio/client'

const meetingId = process.argv[process.argv.indexOf('--meeting') + 1]
assert.ok(meetingId, 'pass --meeting <the owner\'s test meeting id>')

const context = await getVisitMessageContext(meetingId)
assert.ok(context?.customer?.email, 'the test customer has an email')

// 1. Pure: the template and the invite.
const props = buildVisitSummaryEmailProps({ context, officeNote: 'Gate code 1234', mainLineE164: '+16265550123' })
const html = await render(renderVisitSummaryEmail(props))
assert.match(html, /Your home visit is booked/)
assert.match(html, new RegExp(`/home-visits/${meetingId}\\?token=`))
assert.match(html, /Gate code 1234/)
assert.match(html, /\(626\) 555-0123/)
const invite = buildVisitInvite({ context, chainIds: [meetingId], sequence: 0, method: 'REQUEST', now: new Date('2026-10-08T00:00:00.000Z') })
assert.match(invite, /METHOD:REQUEST/)
assert.match(invite, new RegExp(`UID:${meetingId}@`))
assert.match(invite, /SEQUENCE:0/)
assert.match(invite, /ORGANIZER;CN=/)

// 2. Wired: both legs, with the providers intercepted.
;(twilioClient as any).sendMessage = async () => ({ sid: `SM${'2'.repeat(32)}` })
const emails: Record<string, unknown>[] = []
let emailShouldFail = false
;(emailService as any).sendVisitSummaryEmail = async (params: Record<string, unknown>) => {
  emails.push(params)
  if (emailShouldFail) {
    throw new Error('422 invalid `to`')
  }
  return { id: 'email_test' }
}

const rows: string[] = []
const voipRows: string[] = []
try {
  const first = dalVerifySuccess(await meetingService.business.sendVisitSummary(SYSTEM_CONTEXT, { meetingId }))
  rows.push(first.sms.id, first.email.id)
  if (first.sms.voipMessageId) {
    voipRows.push(first.sms.voipMessageId)
  }
  assert.equal(first.email.status, 'sent')
  assert.equal(first.email.emailProviderId, 'email_test')
  assert.equal(emails[0]!.to, context.customer!.email)
  assert.match(String(emails[0]!.ics), /SEQUENCE:0/)

  // Review Focus 4: a rejected address fails the email leg alone.
  emailShouldFail = true
  const second = dalVerifySuccess(await meetingService.business.sendVisitSummary(SYSTEM_CONTEXT, { meetingId }))
  rows.push(second.sms.id, second.email.id)
  if (second.sms.voipMessageId) {
    voipRows.push(second.sms.voipMessageId)
  }
  assert.equal(second.sms.status, 'sent')
  assert.equal(second.email.status, 'failed')
  assert.equal(second.email.reason, 'send_error')
  assert.match(String(emails[1]!.ics), /SEQUENCE:1/, 'a resend after a sent invite carries the next SEQUENCE')
  console.log('summary email ✓')
}
finally {
  for (const id of rows) {
    await db.delete(meetingMessages).where(eq(meetingMessages.id, id))
  }
  for (const id of voipRows) {
    await db.delete(voipMessages).where(eq(voipMessages.id, id))
  }
}
```

Run: `DRIZZLE_TARGET=dev NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-summary-email.ts --meeting <id>`
Expected: `summary email ✓`; every row removed. Then `rm scripts/tmp-summary-email.ts`. Also lint the dev tool: `pnpm exec eslint scripts/visit-messages.ts`.

- [ ] **Step 9: Commit**

```bash
git add src/shared/modules/meetings/messages/lib/google-calendar-link.ts src/shared/services/providers/resend/emails/visit-summary-email.tsx src/shared/services/providers/resend/lib/render-emails.tsx src/shared/services/email.service.ts src/shared/modules/meetings/messages/lib/deliver-visit-email.ts src/shared/modules/meetings/business/service.ts scripts/visit-messages.ts scripts/verify-visit-messages.ts && git commit -m "feat(meetings): the visit summary also goes by email, with a calendar invite that a resend updates instead of duplicating

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 10: OWNER GATE. The first real summary.**

With the tunnel up (`pnpm dev:mobile`, this worktree holds it) and the dev server restarted after Task 3's `.env.local` changes, the owner runs:

```bash
NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/visit-messages.ts summary --meeting <the test meeting id> --note "Park in the driveway"
```

Expected: an MMS from the 626 number on the owner's phone with the summary wording, the link and the contact card; an email in the `EMAIL_DEV_OVERRIDE` inbox with the subject `[to <customer email>] Your home visit on <day>` and the invite attached, which Gmail offers to add to the calendar. The Twilio status callbacks reach the tunnel (the `voip_messages` row moves to `delivered`). This is the first traffic this Twilio path has ever carried (spec §11). Reply nothing yet; replies arrive with Task 10.

---

### Task 8: The two automatic runs

**Files:**
- Create: `src/shared/modules/meetings/messages/lib/run-window.ts`
- Create: `src/shared/modules/meetings/messages/dal/server/mutations.ts`
- Create: `src/shared/modules/meetings/messages/lib/run-automatic-kind.ts`
- Modify: `src/shared/modules/meetings/business/service.ts`
- Create: `src/shared/services/providers/upstash/jobs/send-day-before-reminders.ts`
- Create: `src/shared/services/providers/upstash/jobs/send-rep-confirmations.ts`
- Modify: `src/app/api/qstash-jobs/route.ts`
- Create: `scripts/setup-visit-message-crons.ts`
- Modify: `scripts/visit-messages.ts`
- Modify: `scripts/verify-visit-messages.ts`
- Test: a throwaway `scripts/tmp-run.ts`, deleted before the commit

**Interfaces:**
- Consumes: `resolveRunInstant`, `planVisitMessages`, `VISIT_MESSAGE_SCHEDULE` (its `daysBefore` is read here for the first time), `listVisitMessageContexts`, `listChainMessages`, `getTemplateBodies`, `listPausedKinds`, `deliverVisitText`, `getRescheduleChain`, `createJob`, `qstashClient.schedules`.
- Produces: `runWindowFor(kind, runAt): { day, from, to }`; `claimAutomaticSend({ meetingId, kind, channel, forScheduledFor }): Promise<MeetingMessage | null>`; `recordAutomaticSkip({ …, reason })`; `setMeetingMessageOutcome(id, { status, reason, voipMessageId?, emailProviderId? })`; `runAutomaticKind(ctx, kind, now): Promise<VisitMessageRunReport>`; `meetingService.business.sendDayBeforeReminders(ctx, { now })` and `.sendRepConfirmations(ctx, { now })`; jobs `send-day-before-reminders`, `send-rep-confirmations`.

- [ ] **Step 1: Pin the run window**

In `scripts/verify-visit-messages.ts`, add the import:

```ts
import { runWindowFor } from '@/shared/modules/meetings/messages/lib/run-window'
```

and append before the final `console.log('✅ …')`:

```ts
{
  assert.deepEqual(runWindowFor('day_before_reminder', new Date('2026-10-09T01:00:00.000Z')), { day: '2026-10-09', from: '2026-10-09T07:00:00.000Z', to: '2026-10-10T07:00:00.000Z' }, 'the 6 PM run on Oct 8 covers Oct 9, Pacific')
  assert.deepEqual(runWindowFor('rep_confirmation', new Date('2026-10-09T15:30:00.000Z')), { day: '2026-10-09', from: '2026-10-09T07:00:00.000Z', to: '2026-10-10T07:00:00.000Z' }, 'the 8:30 run covers its own day')
  assert.deepEqual(runWindowFor('day_before_reminder', new Date('2026-11-02T02:00:00.000Z')), { day: '2026-11-02', from: '2026-11-02T08:00:00.000Z', to: '2026-11-03T08:00:00.000Z' }, 'the window after the fall-back switch starts at the PST midnight')
}
console.log('15. Run window ✓')
```

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: fails at the import.

- [ ] **Step 2: The window**

Create `src/shared/modules/meetings/messages/lib/run-window.ts`:

```ts
import type { PausableVisitMessageKind } from '@/shared/modules/meetings/messages/constants/kinds'

import { addCalendarDays, businessDayKey, businessDayWindow } from '@/shared/lib/business-time'
import { VISIT_MESSAGE_SCHEDULE } from '@/shared/modules/meetings/messages/constants/schedule'

/** The meetings a run looks at: the business day its kind describes, counted from the run's own day. */
export function runWindowFor(kind: PausableVisitMessageKind, runAt: Date): { day: string, from: string, to: string } {
  const day = addCalendarDays(businessDayKey(runAt), VISIT_MESSAGE_SCHEDULE[kind].daysBefore)
  return { day, ...businessDayWindow(day) }
}
```

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: section 15 passes.

- [ ] **Step 3: The claims**

Create `src/shared/modules/meetings/messages/dal/server/mutations.ts`:

```ts
import type { MeetingMessage } from '@/shared/db/schema/meeting-messages'
import type { MeetingMessageChannel, MeetingMessageKind } from '@/shared/modules/meetings/messages/constants/kinds'

import { eq } from 'drizzle-orm'

import { db } from '@/shared/db'
import { meetingMessages } from '@/shared/db/schema/meeting-messages'

type AutomaticKind = Extract<MeetingMessageKind, 'day_before_reminder' | 'rep_confirmation' | 'visit_cancellation'>

interface AutomaticRowInput {
  meetingId: string
  kind: AutomaticKind
  channel: MeetingMessageChannel
  forScheduledFor: string
}

/**
 * Claims an automatic send for one meeting time. Null means another delivery got there first: the
 * partial unique index is the only thing between at-least-once delivery and a double text.
 */
export async function claimAutomaticSend(input: AutomaticRowInput): Promise<MeetingMessage | null> {
  const [row] = await db
    .insert(meetingMessages)
    .values({ ...input, status: 'pending' })
    .onConflictDoNothing()
    .returning()
  return row ?? null
}

/** Records why a run did not send; null when a row for this time already exists. */
export async function recordAutomaticSkip(input: AutomaticRowInput & { reason: string }): Promise<MeetingMessage | null> {
  const { reason, ...rest } = input
  const [row] = await db
    .insert(meetingMessages)
    .values({ ...rest, status: 'skipped', reason })
    .onConflictDoNothing()
    .returning()
  return row ?? null
}

export async function setMeetingMessageOutcome(id: string, outcome: {
  status: 'sent' | 'failed' | 'skipped'
  reason: string | null
  voipMessageId?: string | null
  emailProviderId?: string | null
}): Promise<void> {
  await db.update(meetingMessages).set(outcome).where(eq(meetingMessages.id, id))
}
```

- [ ] **Step 4: The loop**

Create `src/shared/modules/meetings/messages/lib/run-automatic-kind.ts`:

```ts
import type { ScopedContext } from '@/shared/dal/server/types'
import type { PausableVisitMessageKind, VisitMessageTemplateKey } from '@/shared/modules/meetings/messages/constants/kinds'

import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { getRescheduleChain } from '@/shared/entities/meetings/dal/server/queries'
import { claimAutomaticSend, recordAutomaticSkip, setMeetingMessageOutcome } from '@/shared/modules/meetings/messages/dal/server/mutations'
import { listChainMessages, listVisitMessageContexts } from '@/shared/modules/meetings/messages/dal/server/queries'
import { getTemplateBodies, listPausedKinds } from '@/shared/modules/meetings/messages/dal/server/settings'
import { deliverVisitText } from '@/shared/modules/meetings/messages/lib/deliver-visit-text'
import { planVisitMessages } from '@/shared/modules/meetings/messages/lib/plan-visit-messages'
import { resolveRunInstant } from '@/shared/modules/meetings/messages/lib/resolve-run-instant'
import { runWindowFor } from '@/shared/modules/meetings/messages/lib/run-window'

export interface VisitMessageRunReport {
  kind: PausableVisitMessageKind
  /** Null when this delivery was not the kind's run: too early, after midnight, or past the send ceiling. */
  runAt: string | null
  candidates: number
  sent: string[]
  skipped: { meetingId: string, reason: string }[]
  failed: { meetingId: string, reason: string }[]
}

function templateKeyFor(kind: PausableVisitMessageKind, variant: 'confirmed' | 'unconfirmed' | null): VisitMessageTemplateKey {
  if (kind === 'rep_confirmation') {
    return 'rep_confirmation'
  }
  return variant === 'confirmed' ? 'day_before_reminder_confirmed' : 'day_before_reminder_unconfirmed'
}

/**
 * Both runs are this loop: load the day's meetings, compute each plan at the run's instant, and act only on
 * the step the plan marks due. One failing meeting never stops the run.
 */
export async function runAutomaticKind(ctx: ScopedContext, kind: PausableVisitMessageKind, now: Date): Promise<VisitMessageRunReport> {
  const report: VisitMessageRunReport = { kind, runAt: null, candidates: 0, sent: [], skipped: [], failed: [] }
  const runAt = resolveRunInstant(kind, now)
  if (!runAt) {
    return report
  }
  report.runAt = runAt.toISOString()

  const contexts = await listVisitMessageContexts(runWindowFor(kind, runAt))
  report.candidates = contexts.length
  if (contexts.length === 0) {
    return report
  }

  const [bodies, pausedKinds] = await Promise.all([getTemplateBodies(), listPausedKinds()])

  for (const context of contexts) {
    const { meeting, customer } = context
    try {
      const chain = await getRescheduleChain(SYSTEM_CONTEXT, { meetingId: meeting.id })
      const messages = await listChainMessages(chain.success ? chain.data : [meeting.id])
      const step = planVisitMessages({
        meeting: { ...meeting, hasRep: context.rep != null },
        messages,
        contact: { hasPhone: customer?.phone != null, doNotContact: customer?.doNotContact ?? false },
        pausedKinds,
        now: runAt,
      }).find(candidate => candidate.kind === kind)
      if (!step || step.state !== 'due') {
        continue
      }

      const row = { meetingId: meeting.id, kind, channel: 'sms' as const, forScheduledFor: meeting.scheduledFor }
      if (step.skipReason) {
        if (await recordAutomaticSkip({ ...row, reason: step.skipReason })) {
          report.skipped.push({ meetingId: meeting.id, reason: step.skipReason })
        }
        continue
      }

      const claim = await claimAutomaticSend(row)
      if (!claim) {
        continue
      }
      const outcome = await deliverVisitText(ctx, { context, templateKey: templateKeyFor(kind, step.variant), bodies })
      await setMeetingMessageOutcome(claim.id, outcome)
      if (outcome.status === 'sent') {
        report.sent.push(meeting.id)
      }
      else if (outcome.status === 'skipped') {
        report.skipped.push({ meetingId: meeting.id, reason: outcome.reason ?? 'skipped' })
      }
      else {
        report.failed.push({ meetingId: meeting.id, reason: outcome.reason ?? 'send_error' })
      }
    }
    catch (error) {
      console.error(`[${kind}] failed for meeting`, { meetingId: meeting.id, error })
      report.failed.push({ meetingId: meeting.id, reason: 'run_error' })
    }
  }
  return report
}
```

- [ ] **Step 5: The verbs, the jobs, the registry**

In `business/service.ts`, add the imports:

```ts
import type { VisitMessageRunReport } from '@/shared/modules/meetings/messages/lib/run-automatic-kind'

import { runAutomaticKind } from '@/shared/modules/meetings/messages/lib/run-automatic-kind'
```

and the members:

```ts
  /** The 6 PM Pacific run. `now` is the delivery instant; the run resolves its own scheduled instant from it. */
  async sendDayBeforeReminders(ctx: ScopedContext, input: { now: Date }): Promise<DalReturn<VisitMessageRunReport>> {
    return dalDbOperation(() => runAutomaticKind(ctx, 'day_before_reminder', input.now))
  },

  /** The 8:30 AM Pacific run. */
  async sendRepConfirmations(ctx: ScopedContext, input: { now: Date }): Promise<DalReturn<VisitMessageRunReport>> {
    return dalDbOperation(() => runAutomaticKind(ctx, 'rep_confirmation', input.now))
  },
```

Create `src/shared/services/providers/upstash/jobs/send-day-before-reminders.ts`:

```ts
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { meetingService } from '@/shared/modules/meetings/service'

import { createJob } from '../lib/create-job'

/** Published by the 6 PM Pacific schedule. A throw makes QStash retry; the run refuses a retry that lands too late. */
export const sendDayBeforeRemindersJob = createJob('send-day-before-reminders', async () => {
  const report = dalVerifySuccess(await meetingService.business.sendDayBeforeReminders(SYSTEM_CONTEXT, { now: new Date() }))
  console.warn('[send-day-before-reminders]', report)
})
```

Create `src/shared/services/providers/upstash/jobs/send-rep-confirmations.ts`:

```ts
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { meetingService } from '@/shared/modules/meetings/service'

import { createJob } from '../lib/create-job'

/** Published by the 8:30 AM Pacific schedule. */
export const sendRepConfirmationsJob = createJob('send-rep-confirmations', async () => {
  const report = dalVerifySuccess(await meetingService.business.sendRepConfirmations(SYSTEM_CONTEXT, { now: new Date() }))
  console.warn('[send-rep-confirmations]', report)
})
```

In `src/app/api/qstash-jobs/route.ts`, add the two imports (alphabetical with the others) and both jobs to the `jobs` array.

- [ ] **Step 6: The schedules script and the dev tool**

Create `scripts/setup-visit-message-crons.ts`:

```ts
/**
 * Creates the two QStash schedules that run the automatic visit texts. The cron expressions come from
 * VISIT_MESSAGE_SCHEDULE, so what the dashboard shows is what runs. Dry run unless --apply; refuses a
 * duplicate unless --force.
 *
 *   NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/setup-visit-message-crons.ts            # dev, via the tunnel
 *   DRIZZLE_TARGET=prod NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/setup-visit-message-crons.ts --apply
 */
import './lib/load-env'

import type { PausableVisitMessageKind } from '@/shared/modules/meetings/messages/constants/kinds'

import { publicUrl } from '@/shared/config/public-url'
import { APP_HOSTS } from '@/shared/config/roots'
import { BUSINESS_TIMEZONE } from '@/shared/lib/business-time'
import { pausableVisitMessageKinds } from '@/shared/modules/meetings/messages/constants/kinds'
import { VISIT_MESSAGE_SCHEDULE } from '@/shared/modules/meetings/messages/constants/schedule'
import { sendDayBeforeRemindersJob } from '@/shared/services/providers/upstash/jobs/send-day-before-reminders'
import { sendRepConfirmationsJob } from '@/shared/services/providers/upstash/jobs/send-rep-confirmations'
import { qstashClient } from '@/shared/services/providers/upstash/qstash-client'

const JOB_KEYS: Record<PausableVisitMessageKind, string> = {
  day_before_reminder: sendDayBeforeRemindersJob.key,
  rep_confirmation: sendRepConfirmationsJob.key,
}

const PROD_BASE_URL = `https://${APP_HOSTS.prod[0]}`

function cronFor(kind: PausableVisitMessageKind): string {
  const { hour, minute } = VISIT_MESSAGE_SCHEDULE[kind]
  return `CRON_TZ=${BUSINESS_TIMEZONE} ${minute} ${hour} * * *`
}

function assertReachableDestination(url: string, isProd: boolean): void {
  const looksDev = /ngrok|localhost|127\.0\.0\.1/i.test(url)
  if (isProd && looksDev) {
    console.error(`Refusing: DRIZZLE_TARGET=prod but the resolved URL looks dev-ish: ${url}`)
    process.exit(1)
  }
  if (!isProd && url.startsWith('http://')) {
    console.error(`Refusing: QStash cannot deliver to plain HTTP (${url}). Start the tunnel (pnpm tunnel) first.`)
    process.exit(1)
  }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const force = process.argv.includes('--force')
  const isProd = process.env.DRIZZLE_TARGET === 'prod'
  const baseUrl = isProd ? PROD_BASE_URL : publicUrl()

  console.log('--- VISIT MESSAGE SCHEDULES ---')
  console.log(`Mode:     ${apply ? 'APPLY' : 'dry run (pass --apply to create)'}`)
  console.log(`Base URL: ${baseUrl}`)
  assertReachableDestination(baseUrl, isProd)

  const existing = await qstashClient.schedules.list()
  for (const kind of pausableVisitMessageKinds) {
    const destination = `${baseUrl}/api/qstash-jobs?job=${JOB_KEYS[kind]}`
    const cron = cronFor(kind)
    console.log('')
    console.log(`${kind}: "${cron}" -> ${destination}`)

    const dupes = existing.filter(schedule => schedule.destination === destination)
    if (dupes.length > 0 && !force) {
      for (const schedule of dupes) {
        console.warn(`  exists: scheduleId=${schedule.scheduleId} cron="${schedule.cron}" paused=${schedule.isPaused}`)
      }
      console.warn('  skipped (delete it in the QStash console, or pass --force)')
      continue
    }
    if (!apply) {
      console.log('  dry run')
      continue
    }
    const result = await qstashClient.schedules.create({
      destination,
      cron,
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    console.log(`  created: scheduleId=${result.scheduleId}`)
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error)
  process.exit(1)
})
```

In `scripts/visit-messages.ts`, add the import:

```ts
import { pausableVisitMessageKinds } from '@/shared/modules/meetings/messages/constants/kinds'
```

a `case` before `default`:

```ts
    case 'run': {
      const kind = requireFlag('--kind')
      if (!(pausableVisitMessageKinds as readonly string[]).includes(kind)) {
        console.error(`--kind must be one of ${pausableVisitMessageKinds.join(', ')}`)
        process.exit(1)
      }
      // --at is the delivery instant to pretend, e.g. 2026-10-09T01:00:00Z for 6 PM Pacific on Oct 8.
      const now = flagValue('--at') ? new Date(flagValue('--at')!) : new Date()
      const report = dalVerifySuccess(kind === 'day_before_reminder'
        ? await meetingService.business.sendDayBeforeReminders(SYSTEM_CONTEXT, { now })
        : await meetingService.business.sendRepConfirmations(SYSTEM_CONTEXT, { now }))
      console.log(JSON.stringify(report, null, 2))
      return
    }
```

replace the `default` branch's usage line with:

```ts
      console.error('Usage: visit-messages.ts summary --meeting <id> [--note "..."] | run --kind day_before_reminder|rep_confirmation [--at <iso instant>]')
```

and add to the file's doc comment, under the `summary` example:

```ts
 *   NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/visit-messages.ts run --kind day_before_reminder [--at 2026-10-09T01:00:00Z]
```

- [ ] **Step 7: Verify**

Run: `pnpm tsx scripts/verify-visit-messages.ts && pnpm tsc && pnpm lint && pnpm exec eslint scripts/setup-visit-message-crons.ts scripts/visit-messages.ts`
Expected: green.

Run: `NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/setup-visit-message-crons.ts`
Expected: the dry run prints two cron lines, `CRON_TZ=America/Los_Angeles 0 18 * * *` and `CRON_TZ=America/Los_Angeles 30 8 * * *`, with tunnel destinations. Nothing is created.

Create `scripts/tmp-run.ts` (the owner's test meeting must be at least two days out, at 9:00 AM Pacific or later, with a rep):

```ts
import './lib/load-env'

import assert from 'node:assert/strict'

import { eq } from 'drizzle-orm'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { meetingMessages } from '@/shared/db/schema/meeting-messages'
import { voipMessages } from '@/shared/db/schema/voip-messages'
import { addCalendarDays, businessDateTime, businessDayKey } from '@/shared/lib/business-time'
import { claimAutomaticSend } from '@/shared/modules/meetings/messages/dal/server/mutations'
import { getVisitMessageContext } from '@/shared/modules/meetings/messages/dal/server/queries'
import { meetingService } from '@/shared/modules/meetings/service'
import { twilioClient } from '@/shared/services/providers/twilio/client'

const meetingId = process.argv[process.argv.indexOf('--meeting') + 1]
assert.ok(meetingId, 'pass --meeting <the owner\'s test meeting id>')
const context = await getVisitMessageContext(meetingId)
assert.ok(context?.rep && context.customer?.phone, 'the test meeting has a rep and the customer a phone')

const sent: Record<string, unknown>[] = []
;(twilioClient as any).sendMessage = async (params: Record<string, unknown>) => {
  sent.push(params)
  return { sid: `SM${String(sent.length).padStart(32, '3')}` }
}

const visitDay = businessDayKey(new Date(context.meeting.scheduledFor))
const reminderRun = businessDateTime(addCalendarDays(visitDay, -1), 18, 0)
const repRun = businessDateTime(visitDay, 8, 30)

const rows: string[] = []
const voipRows: string[] = []
async function collect(): Promise<void> {
  const mine = await db.select().from(meetingMessages).where(eq(meetingMessages.meetingId, meetingId))
  for (const row of mine) {
    if (!rows.includes(row.id)) {
      rows.push(row.id)
    }
    if (row.voipMessageId && !voipRows.includes(row.voipMessageId)) {
      voipRows.push(row.voipMessageId)
    }
  }
}

try {
  // Not this run: a delivery hours early does nothing.
  const early = dalVerifySuccess(await meetingService.business.sendDayBeforeReminders(SYSTEM_CONTEXT, { now: new Date(reminderRun.getTime() - 60 * 60 * 1000) }))
  assert.equal(early.runAt, null)
  assert.equal(sent.length, 0)

  // The run, delivered two seconds early, sends exactly once.
  const first = dalVerifySuccess(await meetingService.business.sendDayBeforeReminders(SYSTEM_CONTEXT, { now: new Date(reminderRun.getTime() - 2000) }))
  await collect()
  assert.equal(first.runAt, reminderRun.toISOString())
  assert.deepEqual(first.sent, [meetingId])
  assert.equal(sent.length, 1)
  assert.match(String(sent[0]!.body), /tomorrow/)
  assert.match(String(sent[0]!.body), /Reply YES to confirm/, 'the unconfirmed wording: nothing confirmed this visit')

  // The same run again: the recorded row wins, no second text.
  const again = dalVerifySuccess(await meetingService.business.sendDayBeforeReminders(SYSTEM_CONTEXT, { now: reminderRun }))
  assert.deepEqual(again.sent, [])
  assert.equal(sent.length, 1)

  // Review Focus 2: two deliveries claiming at once. The index lets exactly one through.
  const claimRow = { meetingId, kind: 'rep_confirmation' as const, channel: 'sms' as const, forScheduledFor: context.meeting.scheduledFor }
  const [a, b] = await Promise.all([claimAutomaticSend(claimRow), claimAutomaticSend(claimRow)])
  assert.ok((a === null) !== (b === null), 'one claim wins, the other is a no-op')
  await collect()

  // The 8:30 run sees the pending claim and leaves it alone.
  const rep = dalVerifySuccess(await meetingService.business.sendRepConfirmations(SYSTEM_CONTEXT, { now: repRun }))
  assert.deepEqual(rep.sent, [])
  assert.equal(sent.length, 1)

  // Past the ceiling: nothing.
  const late = dalVerifySuccess(await meetingService.business.sendDayBeforeReminders(SYSTEM_CONTEXT, { now: businessDateTime(addCalendarDays(visitDay, -1), 21, 30) }))
  assert.equal(late.runAt, null)
  console.log('runs ✓')
}
finally {
  await collect()
  for (const id of rows) {
    await db.delete(meetingMessages).where(eq(meetingMessages.id, id))
  }
  for (const id of voipRows) {
    await db.delete(voipMessages).where(eq(voipMessages.id, id))
  }
}
```

Run: `DRIZZLE_TARGET=dev NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-run.ts --meeting <id>`
Expected: `runs ✓`; every row the script created is gone. Then `rm scripts/tmp-run.ts`.

- [ ] **Step 8: Commit**

```bash
git add src/shared/modules/meetings/messages/lib/run-window.ts src/shared/modules/meetings/messages/dal/server/mutations.ts src/shared/modules/meetings/messages/lib/run-automatic-kind.ts src/shared/modules/meetings/business/service.ts src/shared/services/providers/upstash/jobs/send-day-before-reminders.ts src/shared/services/providers/upstash/jobs/send-rep-confirmations.ts src/app/api/qstash-jobs/route.ts scripts/setup-visit-message-crons.ts scripts/visit-messages.ts scripts/verify-visit-messages.ts && git commit -m "feat(meetings): the day-before reminder and the rep confirmation run on the plan, claim each send once, and are scheduled from the same constant the dashboard will show

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: A cancelled visit leaves the calendar

**Files:**
- Create: `src/shared/services/providers/upstash/jobs/send-visit-cancellation.ts`
- Modify: `src/shared/entities/meetings/dal/server/crud.ts:146-154`
- Modify: `src/app/api/qstash-jobs/route.ts`
- Create: `src/shared/services/providers/resend/emails/visit-cancellation-email.tsx`
- Modify: `src/shared/services/providers/resend/lib/render-emails.tsx`
- Modify: `src/shared/services/email.service.ts`
- Modify: `src/shared/modules/meetings/messages/lib/deliver-visit-email.ts`
- Modify: `src/shared/modules/meetings/business/service.ts`
- Modify: `scripts/visit-messages.ts`
- Test: a throwaway `scripts/tmp-cancellation.ts`, deleted before the commit

**Interfaces:**
- Consumes: `shouldSendVisitCancellation` (plan 1), `getRescheduleSuccessorId`, `claimAutomaticSend`, `setMeetingMessageOutcome`, `buildVisitInvite` (Task 7).
- Produces: job `send-visit-cancellation` (`{ meetingId }`); `emailService.sendVisitCancellationEmail({ to, repName, visitDay, props, text, ics })`; `deliverVisitCancellationEmail({ context, chainIds, sequence, mainLineE164, now })`; `meetingService.business.sendVisitCancellation(ctx, { meetingId }): Promise<DalReturn<{ sent: boolean, reason: string | null }>>`.

- [ ] **Step 1: The dispatch and the job**

Create `src/shared/services/providers/upstash/jobs/send-visit-cancellation.ts`:

```ts
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
// The meetings CRUD hook dispatches this job, and the root meetingService spreads that CRUD at load time:
// importing the root here would read it before it exists. The business child reaches the CRUD lazily.
import { meetingBusinessService } from '@/shared/modules/meetings/business/service'

import { createJob } from '../lib/create-job'

/** Dispatched when a meeting turns cancelled. Whether an email is due is decided here, at run time. */
export const sendVisitCancellationJob = createJob('send-visit-cancellation', async (payload: { meetingId: string }) => {
  const result = dalVerifySuccess(await meetingBusinessService.sendVisitCancellation(SYSTEM_CONTEXT, payload))
  console.warn('[send-visit-cancellation]', { meetingId: payload.meetingId, ...result })
})
```

In `src/shared/entities/meetings/dal/server/crud.ts`, add the import beside the other jobs:

```ts
import { sendVisitCancellationJob } from '@/shared/services/providers/upstash/jobs/send-visit-cancellation'
```

and in `update.after`, directly before the existing "newly-cancelled meeting leaves the shared calendar" block:

```ts
        // A cancelled visit whose invite went out gets a calendar cancellation; the job checks, at run time, whether one is due.
        if (previousRow.meetingOutcome !== 'cancelled' && row.meetingOutcome === 'cancelled') {
          await sendVisitCancellationJob.dispatchOrThrow({ meetingId: row.id })
        }
```

Register the job in `src/app/api/qstash-jobs/route.ts` (import plus the `jobs` array).

- [ ] **Step 2: The email**

Create `src/shared/services/providers/resend/emails/visit-cancellation-email.tsx`:

```tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export interface VisitCancellationEmailProps {
  firstName: string
  /** "Wed, Oct 7, 10:00 AM" */
  visitDayTime: string
  /** "(626) 555-0123" */
  mainLinePhone: string
  companyName: string
  logoUrl: string
}

const styles = {
  body: {
    backgroundColor: '#f6f9fc',
    fontFamily: '-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif',
    padding: '20px 0',
  },
  container: {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '32px',
    borderRadius: 8,
    maxWidth: '600px',
  },
  heading: {
    fontSize: 26,
    fontWeight: 700,
    textAlign: 'center' as const,
    marginBottom: 16,
  },
  text: {
    fontSize: 16,
    lineHeight: '24px',
    color: '#333',
    marginBottom: 16,
  },
  footer: {
    fontSize: 12,
    color: '#8898aa',
    textAlign: 'center' as const,
    marginTop: 24,
  },
}

export function VisitCancellationEmail(props: VisitCancellationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Your home visit on
        {' '}
        {props.visitDayTime}
        {' '}
        is cancelled
      </Preview>

      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={{ textAlign: 'center', marginBottom: 24 }}>
            <Img src={props.logoUrl} width="140" alt={props.companyName} />
          </Section>

          <Heading style={styles.heading}>Your home visit is cancelled</Heading>

          <Text style={styles.text}>
            Hi
            {' '}
            {props.firstName}
            ,
          </Text>

          <Text style={styles.text}>
            Your visit on
            {' '}
            <strong>{props.visitDayTime}</strong>
            {' '}
            is cancelled, and the attached update removes it from your calendar.
          </Text>

          <Text style={styles.text}>
            Questions or want a new time? Call or text us at
            {' '}
            {props.mainLinePhone}
            .
          </Text>

          <Text style={styles.footer}>{props.companyName}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export function buildVisitCancellationText(props: VisitCancellationEmailProps): string {
  return [
    `Hi ${props.firstName},`,
    '',
    `Your visit on ${props.visitDayTime} is cancelled, and the attached update removes it from your calendar.`,
    `Questions or want a new time? Call or text us at ${props.mainLinePhone}.`,
    '',
    props.companyName,
  ].join('\n')
}
```

In `render-emails.tsx`, add:

```tsx
import type { VisitCancellationEmailProps } from '@/shared/services/providers/resend/emails/visit-cancellation-email'
import { VisitCancellationEmail } from '@/shared/services/providers/resend/emails/visit-cancellation-email'

export function renderVisitCancellationEmail(props: VisitCancellationEmailProps) {
  return <VisitCancellationEmail {...props} />
}
```

In `email.service.ts`, add the type import and the member after `sendVisitSummaryEmail`:

```ts
import type { VisitCancellationEmailProps } from '@/shared/services/providers/resend/emails/visit-cancellation-email'
```

```ts
    /** The calendar cancellation: the same UID as the invite, one SEQUENCE above it, METHOD:CANCEL. */
    sendVisitCancellationEmail: async (params: {
      to: string
      repName: string | null
      visitDay: string
      props: VisitCancellationEmailProps
      text: string
      ics: string
    }): Promise<{ id: string }> => {
      const templates = await loadEmailTemplates()
      const { data, error } = await resendClient.emails.send({
        from: buildSenderFrom(params.repName),
        to: params.to,
        replyTo: RESEND_LEAD_INBOX,
        subject: `Your home visit on ${params.visitDay} is cancelled`,
        headers: {
          'List-Unsubscribe': `<mailto:${RESEND_LEAD_INBOX}?subject=unsubscribe>`,
        },
        react: templates.renderVisitCancellationEmail(params.props),
        text: params.text,
        attachments: [{
          filename: 'home-visit-cancelled.ics',
          content: Buffer.from(params.ics, 'utf8'),
          contentType: 'text/calendar; method=CANCEL',
        }],
      })

      if (error || !data) {
        throw new Error(`Failed to send visit cancellation email: ${JSON.stringify(error)}`)
      }

      return { id: data.id }
    },
```

- [ ] **Step 3: Deliver it**

In `deliver-visit-email.ts`, add the import:

```ts
import { buildVisitCancellationText } from '@/shared/services/providers/resend/emails/visit-cancellation-email'
```

and append:

```ts
/** Sends the calendar cancellation. `sequence` is how many summary emails the chain sent, so the update outranks the last one. */
export async function deliverVisitCancellationEmail(input: {
  context: VisitMessageContext
  chainIds: string[]
  sequence: number
  mainLineE164: string
  now: Date
}): Promise<VisitEmailOutcome> {
  const { meeting, customer, rep } = input.context
  if (!customer?.email) {
    return { status: 'failed', reason: 'no_email', emailProviderId: null }
  }
  const props = {
    firstName: customer.name.trim().split(/\s+/)[0] || 'there',
    visitDayTime: formatBusinessDayTime(meeting.scheduledFor),
    mainLinePhone: formatPhone(input.mainLineE164),
    companyName: companyInfo.name,
    logoUrl: publicUrl('/company/logo/logo-light-right.jpg'),
  }
  try {
    const { id } = await emailService.sendVisitCancellationEmail({
      to: customer.email,
      repName: repDisplayName(rep),
      visitDay: formatBusinessDay(meeting.scheduledFor),
      props,
      text: buildVisitCancellationText(props),
      ics: buildVisitInvite({ context: input.context, chainIds: input.chainIds, sequence: input.sequence, method: 'CANCEL', now: input.now }),
    })
    return { status: 'sent', reason: null, emailProviderId: id }
  }
  catch (error) {
    console.error('[deliverVisitCancellationEmail] send failed', { meetingId: meeting.id, error })
    return { status: 'failed', reason: 'send_error', emailProviderId: null }
  }
}
```

- [ ] **Step 4: The verb**

In `business/service.ts`, add the imports:

```ts
import { claimAutomaticSend, setMeetingMessageOutcome } from '@/shared/modules/meetings/messages/dal/server/mutations'
import { deliverVisitCancellationEmail } from '@/shared/modules/meetings/messages/lib/deliver-visit-email'
import { shouldSendVisitCancellation } from '@/shared/modules/meetings/messages/lib/should-send-visit-cancellation'
```

(merge into existing import lines where the module is already imported) and the member:

```ts
  /**
   * Removes the calendar entry of a cancelled visit whose invite went out. A reschedule's original has a
   * successor whose next summary updates the same entry, so it gets none.
   */
  async sendVisitCancellation(
    ctx: ScopedContext,
    input: { meetingId: string },
  ): Promise<DalReturn<{ sent: boolean, reason: string | null }>> {
    return dalDbOperation(async () => {
      const context = await getVisitMessageContext(input.meetingId)
      if (!context) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      if (context.meeting.meetingOutcome !== 'cancelled') {
        return { sent: false, reason: 'not_cancelled' }
      }
      const chainIds = dalVerifySuccess(await getRescheduleChain(SYSTEM_CONTEXT, { meetingId: input.meetingId }))
      const chainMessages = await listChainMessages(chainIds)
      const hasSuccessor = (await getRescheduleSuccessorId(input.meetingId)) != null
      if (!shouldSendVisitCancellation({ chainMessages, hasSuccessor })) {
        return { sent: false, reason: hasSuccessor ? 'rescheduled' : 'no_invite' }
      }

      const claim = await claimAutomaticSend({ meetingId: input.meetingId, kind: 'visit_cancellation', channel: 'email', forScheduledFor: context.meeting.scheduledFor })
      if (!claim) {
        return { sent: false, reason: 'already_sent' }
      }
      const mainLine = dalVerifySuccess(await voipDidsService.getMainLineDid())
      if (!mainLine) {
        await setMeetingMessageOutcome(claim.id, { status: 'failed', reason: 'no_main_line' })
        return { sent: false, reason: 'no_main_line' }
      }
      const sequence = chainMessages.filter(message => message.kind === 'visit_summary' && message.channel === 'email' && message.status === 'sent').length
      const outcome = await deliverVisitCancellationEmail({ context, chainIds, sequence, mainLineE164: mainLine.e164, now: new Date() })
      await setMeetingMessageOutcome(claim.id, outcome)
      return { sent: outcome.status === 'sent', reason: outcome.reason }
    })
  },
```

`ctx` is unused on purpose: the job runs it as the system, and the claim's index makes a retry a no-op.

In `scripts/visit-messages.ts`, add before `default`:

```ts
    case 'cancel': {
      const meetingId = requireFlag('--meeting')
      const result = dalVerifySuccess(await meetingService.business.sendVisitCancellation(SYSTEM_CONTEXT, { meetingId }))
      console.log(`sent: ${result.sent}${result.reason ? ` (${result.reason})` : ''}`)
      return
    }
```

Append ` | cancel --meeting <id>` to the usage line and a `cancel --meeting <id>` example to the file's doc comment.

- [ ] **Step 5: Verify**

Run: `pnpm tsc && pnpm lint && pnpm exec eslint scripts/visit-messages.ts`
Expected: green.

Create `scripts/tmp-cancellation.ts` (the test meeting is upcoming and not cancelled; the script never changes it):

```ts
import './lib/load-env'

import assert from 'node:assert/strict'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { getVisitMessageContext } from '@/shared/modules/meetings/messages/dal/server/queries'
import { deliverVisitCancellationEmail } from '@/shared/modules/meetings/messages/lib/deliver-visit-email'
import { meetingService } from '@/shared/modules/meetings/service'
import { emailService } from '@/shared/services/email.service'

const meetingId = process.argv[process.argv.indexOf('--meeting') + 1]
assert.ok(meetingId, 'pass --meeting <the owner\'s test meeting id>')
const context = await getVisitMessageContext(meetingId)
assert.ok(context?.customer?.email)

const emails: Record<string, unknown>[] = []
;(emailService as any).sendVisitCancellationEmail = async (params: Record<string, unknown>) => {
  emails.push(params)
  return { id: 'email_cancel_test' }
}

// An upcoming meeting is not cancelled: the verb refuses before any read of the chain.
const refused = dalVerifySuccess(await meetingService.business.sendVisitCancellation(SYSTEM_CONTEXT, { meetingId }))
assert.deepEqual(refused, { sent: false, reason: 'not_cancelled' })

// The email itself, with two summaries already sent: the update outranks the last invite.
const outcome = await deliverVisitCancellationEmail({ context, chainIds: [meetingId], sequence: 2, mainLineE164: '+16265550123', now: new Date('2026-10-08T00:00:00.000Z') })
assert.equal(outcome.status, 'sent')
assert.equal(outcome.emailProviderId, 'email_cancel_test')
const ics = String(emails[0]!.ics)
assert.match(ics, /METHOD:CANCEL/)
assert.match(ics, /STATUS:CANCELLED/)
assert.match(ics, /SEQUENCE:2/)
assert.match(ics, new RegExp(`UID:${meetingId}@`), 'the same entry the invite created')
assert.match(String(emails[0]!.text), /\(626\) 555-0123/)
console.log('cancellation ✓')
```

Run: `DRIZZLE_TARGET=dev NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-cancellation.ts --meeting <id>`
Expected: `cancellation ✓`; nothing was written. Then `rm scripts/tmp-cancellation.ts`. The full path (cancel in the dashboard, the hook dispatches, the entry leaves the calendar) is the owner's gate in Task 11.

- [ ] **Step 6: Commit**

```bash
git add src/shared/services/providers/upstash/jobs/send-visit-cancellation.ts src/shared/entities/meetings/dal/server/crud.ts src/app/api/qstash-jobs/route.ts src/shared/services/providers/resend/emails/visit-cancellation-email.tsx src/shared/services/providers/resend/lib/render-emails.tsx src/shared/services/email.service.ts src/shared/modules/meetings/messages/lib/deliver-visit-email.ts src/shared/modules/meetings/business/service.ts scripts/visit-messages.ts && git commit -m "feat(meetings): a cancelled visit whose invite went out gets a calendar cancellation; a reschedule's original does not

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Replies come back on the main line

**Files:**
- Modify: `src/shared/entities/customers/dal/server/queries.ts:100-116`
- Modify: `src/shared/modules/meetings/messages/dal/server/queries.ts`
- Modify: `src/shared/services/notification.service.ts`
- Modify: `src/shared/modules/meetings/business/service.ts`
- Modify: `src/shared/modules/meetings/messages/service.ts`
- Create: `src/app/api/voip/twiml/messaging-inbound/route.ts`
- Modify: `src/app/api/webhooks/twilio/route.ts`
- Test: throwaway `scripts/tmp-replies.ts` and `scripts/tmp-inbound-signature.ts`, deleted before the commit

**Interfaces:**
- Consumes: `matchReplyKeyword` (plan 1), `homeownerConfirmationOptions` / `HomeownerConfirmation`, `complianceService.addToDnc`, `voipMessagesService.recordInboundMessage`, `voipDidsService.getDidByE164`, `webPushClient.sendToUsers`, `getParticipantsForMeeting`, `getSystemOwnerId`, `twilioClient.buildInboundMessagingTwiml`.
- Produces: `findCustomersByPhone(phone): Promise<DalReturn<Customer[]>>`; `findReplyTargetMeeting({ customerIds, now }): Promise<VisitMessageContext | null>`; `getMeetingMessageByVoipMessageId(id)`; `getMeetingMessageByProviderMessageId(sid)`; `notificationService.notifyVisitTextFailed`, `.notifyHomeownerReply`, `.notifyHomeownerOptedOut`; `meetingService.business.confirmByHomeowner(ctx, { meetingId, via })`; `meetingService.business.handleHomeownerReply(ctx, { providerMessageId, from, to, body, optOutType })`; `meetingService.messages.recordDeliveryFailure(ctx, { providerMessageId, reason })`; `POST /api/voip/twiml/messaging-inbound`.

- [ ] **Step 1: The reads**

In `src/shared/entities/customers/dal/server/queries.ts`, directly after `findCustomerByPhone`:

```ts
/** Ungated (webhook callers). Every customer with this phone: a household can share one. */
export async function findCustomersByPhone(phone: string): Promise<DalReturn<Customer[]>> {
  return dalDbOperation(async () => {
    const national = toNationalDigits(phone)
    if (!national) {
      return []
    }
    return db
      .select()
      .from(customers)
      .where(eq(customers.phone, national))
  })
}
```

In `src/shared/modules/meetings/messages/dal/server/queries.ts`, extend the drizzle import to `{ and, asc, eq, gte, inArray, lt, ne }`, add:

```ts
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { voipMessages } from '@/shared/db/schema/voip-messages'
import { getRescheduleChain } from '@/shared/entities/meetings/dal/server/queries'
```

and append:

```ts
const REPLY_MATCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/**
 * The meeting a reply is about: the soonest eligible one in the next 7 days, across every customer with
 * that phone, whose reschedule chain has a sent visit message. `meetingType <> 'Project'` mirrors isProjectMeeting.
 */
export async function findReplyTargetMeeting(input: { customerIds: string[], now: Date }): Promise<VisitMessageContext | null> {
  if (input.customerIds.length === 0) {
    return null
  }
  const candidates = await listContexts(and(
    inArray(meetings.customerId, input.customerIds),
    gte(meetings.scheduledFor, input.now.toISOString()),
    lt(meetings.scheduledFor, new Date(input.now.getTime() + REPLY_MATCH_WINDOW_MS).toISOString()),
    ne(meetings.meetingType, 'Project'),
    eq(meetings.meetingOutcome, 'not_set'),
  )!)
  for (const candidate of candidates) {
    const chain = await getRescheduleChain(SYSTEM_CONTEXT, { meetingId: candidate.meeting.id })
    const chainMessages = await listChainMessages(chain.success ? chain.data : [candidate.meeting.id])
    if (chainMessages.some(message => message.status === 'sent')) {
      return candidate
    }
  }
  return null
}

export async function getMeetingMessageByVoipMessageId(voipMessageId: string): Promise<MeetingMessage | undefined> {
  const [row] = await db
    .select()
    .from(meetingMessages)
    .where(eq(meetingMessages.voipMessageId, voipMessageId))
    .limit(1)
  return row
}

/** The visit message behind a Twilio SID, for status callbacks. */
export async function getMeetingMessageByProviderMessageId(providerMessageId: string): Promise<MeetingMessage | undefined> {
  const [row] = await db
    .select({ message: meetingMessages })
    .from(meetingMessages)
    .innerJoin(voipMessages, eq(voipMessages.id, meetingMessages.voipMessageId))
    .where(eq(voipMessages.providerMessageId, providerMessageId))
    .limit(1)
  return row?.message
}
```

- [ ] **Step 2: The pushes**

In `src/shared/services/notification.service.ts`, add a module-level helper after `buildCustomerLabel`:

```ts
// Every visit-message alert goes to the meeting's participants and the office account.
async function visitRecipientIds(meetingId: string | null): Promise<string[]> {
  const systemOwnerId = await getSystemOwnerId()
  const participants = meetingId ? (await getParticipantsForMeeting(meetingId)).map(p => p.userId) : []
  return [...new Set([...participants, systemOwnerId])]
}

// A push body is a glance; a long reply is read in the app.
function pushExcerpt(body: string): string {
  const oneLine = body.replace(/\s+/g, ' ').trim()
  return oneLine.length > 140 ? `${oneLine.slice(0, 139)}…` : oneLine
}
```

and three members at the end of the service literal:

```ts
    /** A visit summary text did not arrive (a landline, a carrier failure): a person has to call. */
    notifyVisitTextFailed: async (params: { meetingId: string, customerName: string, scheduledFor: string }) => {
      const result = await webPushClient.sendToUsers(await visitRecipientIds(params.meetingId), {
        title: `Text failed | ${params.customerName}`,
        body: `Text to ${params.customerName} failed, call them about ${formatBusinessDayTime(params.scheduledFor)}.`,
        navigate: ROOTS.dashboard.scheduleWithMeetingHighlight(params.meetingId, params.scheduledFor),
        urgency: 'high',
      })
      if (result.failed > 0 || result.errors.length > 0) {
        console.warn(`[notificationService] notifyVisitTextFailed partial failure:`, result)
      }
    },

    /** A homeowner wrote something only a person can answer. Staff answer by calling. */
    notifyHomeownerReply: async (params: { meetingId: string | null, scheduledFor: string | null, customerName: string, body: string }) => {
      const result = await webPushClient.sendToUsers(await visitRecipientIds(params.meetingId), {
        title: `Reply | ${params.customerName}`,
        body: `${params.customerName} replied: ${pushExcerpt(params.body)}`,
        navigate: params.meetingId ? ROOTS.dashboard.scheduleWithMeetingHighlight(params.meetingId, params.scheduledFor) : ROOTS.dashboard.customers.root(),
        urgency: 'high',
      })
      if (result.failed > 0 || result.errors.length > 0) {
        console.warn(`[notificationService] notifyHomeownerReply partial failure:`, result)
      }
    },

    notifyHomeownerOptedOut: async (params: { meetingId: string | null, scheduledFor: string | null, customerName: string, body: string }) => {
      const about = params.scheduledFor ? ` Call them about ${formatBusinessDayTime(params.scheduledFor)}.` : ''
      const result = await webPushClient.sendToUsers(await visitRecipientIds(params.meetingId), {
        title: `Opted out | ${params.customerName}`,
        body: `${params.customerName} texted '${pushExcerpt(params.body)}' and is opted out of texts.${about}`,
        navigate: params.meetingId ? ROOTS.dashboard.scheduleWithMeetingHighlight(params.meetingId, params.scheduledFor) : ROOTS.dashboard.customers.root(),
        urgency: 'high',
      })
      if (result.failed > 0 || result.errors.length > 0) {
        console.warn(`[notificationService] notifyHomeownerOptedOut partial failure:`, result)
      }
    },
```

- [ ] **Step 3: The verbs**

In `business/service.ts`, add the imports:

```ts
import type { HomeownerConfirmation } from '@/shared/constants/enums/meetings'

import { findCustomersByPhone } from '@/shared/entities/customers/dal/server/queries'
import { formatPhone } from '@/shared/lib/phone'
import { findReplyTargetMeeting, getMeetingMessageByVoipMessageId } from '@/shared/modules/meetings/messages/dal/server/queries'
import { matchReplyKeyword } from '@/shared/modules/meetings/messages/lib/match-reply-keyword'
import { notificationService } from '@/shared/services/notification.service'
import { complianceService } from '@/shared/services/voip/compliance.service'
import { voipMessagesService } from '@/shared/services/voip/voip-messages.service'
```

(merge into existing lines where the module is already imported), the type above the literal:

```ts
export type HomeownerReplyAction = 'opt_out' | 'opt_in' | 'help' | 'confirmed' | 'already_confirmed' | 'forwarded' | 'duplicate'
```

and the members:

```ts
  /** The homeowner's own "I'll be there", by text or on the page. Never sets `confirmedAt`: that stays the office's. */
  async confirmByHomeowner(
    ctx: ScopedContext,
    input: { meetingId: string, via: HomeownerConfirmation },
  ): Promise<DalReturn<Meeting>> {
    return dalDbOperation(async () => {
      const meeting = dalVerifySuccess(await meetingCrud.getById(ctx, { id: input.meetingId }))
      if (!meeting) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      if (!isVisitMessageEligible(meeting, new Date())) {
        throw new ThrowableDalError({ type: 'precondition-failed', reason: 'This visit can no longer be confirmed.' })
      }
      if (meeting.homeownerConfirmedAt) {
        return meeting
      }
      return dalVerifySuccess(await meetingCrud.update(ctx, {
        id: meeting.id,
        data: { homeownerConfirmedAt: new Date().toISOString(), homeownerConfirmedVia: input.via },
      }))
    })
  },

  /**
   * A text that arrived on the main line. Every reply is stored on the thread; a reply that matches a visit
   * is recorded against it. Opt-outs come from Twilio's own verdict, never from a keyword list of ours.
   */
  async handleHomeownerReply(
    ctx: ScopedContext,
    input: { providerMessageId: string, from: string, to: string, body: string, optOutType: 'STOP' | 'START' | 'HELP' | null },
  ): Promise<DalReturn<{ action: HomeownerReplyAction, meetingId: string | null }>> {
    return dalDbOperation(async () => {
      const did = dalVerifySuccess(await voipDidsService.getDidByE164(input.to))
      const matched = dalVerifySuccess(await findCustomersByPhone(input.from))
      const recorded = dalVerifySuccess(await voipMessagesService.recordInboundMessage(ctx, {
        providerMessageId: input.providerMessageId,
        voipDidId: did?.id ?? null,
        customerId: matched[0]?.id ?? null,
        remoteE164: input.from,
        body: input.body,
      }))

      const target = await findReplyTargetMeeting({ customerIds: matched.map(customer => customer.id), now: new Date() })
      const meetingId = target?.meeting.id ?? null
      const scheduledFor = target?.meeting.scheduledFor ?? null
      const customerName = target?.customer?.name ?? matched[0]?.name ?? formatPhone(input.from)

      if (target) {
        // Twilio delivers at least once; the first delivery wrote this row and did everything below.
        if (await getMeetingMessageByVoipMessageId(recorded.id)) {
          return { action: 'duplicate', meetingId }
        }
        dalVerifySuccess(await meetingMessageCrud.create(ctx, {
          meetingId: target.meeting.id,
          kind: 'homeowner_reply',
          channel: 'sms',
          forScheduledFor: target.meeting.scheduledFor,
          status: 'received',
          voipMessageId: recorded.id,
        }))
      }

      if (input.optOutType === 'STOP') {
        for (const customer of matched) {
          await complianceService.addToDnc({ customerId: customer.id, reason: 'stop_keyword' })
        }
        await notificationService.notifyHomeownerOptedOut({ meetingId, scheduledFor, customerName, body: input.body })
        return { action: 'opt_out', meetingId }
      }
      if (input.optOutType === 'START') {
        // Opting back in to texts says nothing about calls, so do-not-contact stays.
        await notificationService.notifyHomeownerReply({ meetingId, scheduledFor, customerName, body: input.body })
        return { action: 'opt_in', meetingId }
      }
      if (input.optOutType === 'HELP') {
        return { action: 'help', meetingId }
      }

      if (target && matchReplyKeyword(input.body) === 'confirm') {
        if (target.meeting.homeownerConfirmedAt) {
          return { action: 'already_confirmed', meetingId }
        }
        dalVerifySuccess(await meetingBusinessService.confirmByHomeowner(ctx, { meetingId: target.meeting.id, via: 'sms_reply' }))
        const outcome = await deliverVisitText(ctx, { context: target, templateKey: 'confirmation_reply', bodies: await getTemplateBodies() })
        dalVerifySuccess(await meetingMessageCrud.create(ctx, {
          meetingId: target.meeting.id,
          kind: 'confirmation_reply',
          channel: 'sms',
          forScheduledFor: target.meeting.scheduledFor,
          status: outcome.status,
          reason: outcome.reason,
          voipMessageId: outcome.voipMessageId,
        }))
        return { action: 'confirmed', meetingId }
      }

      await notificationService.notifyHomeownerReply({ meetingId, scheduledFor, customerName, body: input.body })
      return { action: 'forwarded', meetingId }
    })
  },
```

Replace `src/shared/modules/meetings/messages/service.ts` with:

```ts
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { meetingMessageCrud } from '@/shared/modules/meetings/messages/dal/server/crud'
import { setMeetingMessageOutcome } from '@/shared/modules/meetings/messages/dal/server/mutations'
import { getMeetingMessageByProviderMessageId, getVisitMessageContext } from '@/shared/modules/meetings/messages/dal/server/queries'
import { notificationService } from '@/shared/services/notification.service'

export const meetingMessageService = {
  ...meetingMessageCrud,

  /** A text Twilio could not deliver. A summary that did not arrive means someone has to call. */
  async recordDeliveryFailure(
    _ctx: ScopedContext,
    input: { providerMessageId: string, reason: string },
  ): Promise<DalReturn<{ meetingMessageId: string | null }>> {
    return dalDbOperation(async () => {
      const message = await getMeetingMessageByProviderMessageId(input.providerMessageId)
      if (!message) {
        return { meetingMessageId: null }
      }
      await setMeetingMessageOutcome(message.id, { status: 'failed', reason: input.reason })
      if (message.kind === 'visit_summary') {
        const context = await getVisitMessageContext(message.meetingId)
        if (context) {
          await notificationService.notifyVisitTextFailed({
            meetingId: message.meetingId,
            customerName: context.customer?.name ?? 'the homeowner',
            scheduledFor: context.meeting.scheduledFor,
          })
        }
      }
      return { meetingMessageId: message.id }
    })
  },
} as const

export type MeetingMessageService = typeof meetingMessageService
```

- [ ] **Step 4: The routes**

Create `src/app/api/voip/twiml/messaging-inbound/route.ts`:

```ts
import env from '@/shared/config/server-env'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { meetingService } from '@/shared/modules/meetings/service'
import { twilioClient } from '@/shared/services/providers/twilio/client'
import { messagingInboundWebhookSchema } from '@/shared/services/providers/twilio/schemas/messaging'

const PATH = '/api/voip/twiml/messaging-inbound'

/**
 * A text arrived on one of our numbers. Twilio waits for TwiML; the answer is always empty, because the
 * confirmation reply is sent as its own message so it is recorded and gets status callbacks.
 */
export async function POST(request: Request): Promise<Response> {
  const params = Object.fromEntries(new URLSearchParams(await request.text()))
  const signature = request.headers.get('x-twilio-signature')
  if (!signature || !twilioClient.verifyWebhookSignature({ url: `${env.VOIP_WEBHOOK_BASE_URL}${PATH}`, signature, params })) {
    return new Response('Invalid signature', { status: 401 })
  }

  const parsed = messagingInboundWebhookSchema.safeParse(params)
  if (!parsed.success) {
    console.warn('[twilio inbound] malformed payload', parsed.error.flatten())
    return new Response('Malformed payload', { status: 400 })
  }

  try {
    await meetingService.business.handleHomeownerReply(SYSTEM_CONTEXT, {
      providerMessageId: parsed.data.MessageSid,
      from: parsed.data.From,
      to: parsed.data.To,
      body: parsed.data.Body,
      optOutType: parsed.data.OptOutType ?? null,
    })
  }
  catch (error) {
    console.error('[twilio inbound] handler failed', error)
  }

  return new Response(twilioClient.buildInboundMessagingTwiml({}), {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}
```

In `src/app/api/webhooks/twilio/route.ts`, add `import { meetingService } from '@/shared/modules/meetings/service'` and replace the `try` body with:

```ts
    const applied = await voipMessagesService.applyStatusCallback(SYSTEM_CONTEXT, {
      providerMessageId: parsed.data.MessageSid,
      twilioStatus: parsed.data.MessageStatus,
      errorCode: parsed.data.ErrorCode,
      at: new Date().toISOString(),
    })
    if (applied.success && applied.data.rowsAffected > 0 && (applied.data.status === 'failed' || applied.data.status === 'undelivered')) {
      await meetingService.messages.recordDeliveryFailure(SYSTEM_CONTEXT, {
        providerMessageId: parsed.data.MessageSid,
        reason: `twilio:${parsed.data.ErrorCode ?? 'unknown'}`,
      })
    }
```

- [ ] **Step 5: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: green.

Create `scripts/tmp-replies.ts`. It uses the owner's test meeting and customer. It writes a sent summary row so the reply has a target, confirms the meeting through the real verb and then puts the two homeowner columns back to null, which this plan allows for this one script because the row ends as it began; every other row it creates is deleted.

```ts
import './lib/load-env'

import assert from 'node:assert/strict'

import { eq } from 'drizzle-orm'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { meetingMessages } from '@/shared/db/schema/meeting-messages'
import { meetings } from '@/shared/db/schema/meetings'
import { voipMessages } from '@/shared/db/schema/voip-messages'
import { findCustomersByPhone } from '@/shared/entities/customers/dal/server/queries'
import { toE164 } from '@/shared/lib/phone'
import { getVisitMessageContext } from '@/shared/modules/meetings/messages/dal/server/queries'
import { meetingService } from '@/shared/modules/meetings/service'
import { notificationService } from '@/shared/services/notification.service'
import { twilioClient } from '@/shared/services/providers/twilio/client'
import { complianceService } from '@/shared/services/voip/compliance.service'
import { voipDidsService } from '@/shared/services/voip/voip-dids.service'

const meetingId = process.argv[process.argv.indexOf('--meeting') + 1]
assert.ok(meetingId, 'pass --meeting <the owner\'s test meeting id>')
const context = await getVisitMessageContext(meetingId)
assert.ok(context?.customer?.phone, 'the test customer has a phone')
assert.equal(context.meeting.homeownerConfirmedAt, null, 'start from an unconfirmed meeting')
const from = toE164(context.customer.phone)!
const mainLine = dalVerifySuccess(await voipDidsService.getMainLineDid())
assert.ok(mainLine)

const texts: Record<string, unknown>[] = []
;(twilioClient as any).sendMessage = async (params: Record<string, unknown>) => {
  texts.push(params)
  return { sid: `SM${'4'.repeat(32)}` }
}
const pushes: { name: string, params: Record<string, unknown> }[] = []
for (const name of ['notifyHomeownerReply', 'notifyHomeownerOptedOut', 'notifyVisitTextFailed'] as const) {
  ;(notificationService as any)[name] = async (params: Record<string, unknown>) => {
    pushes.push({ name, params })
  }
}
const dnc: string[] = []
;(complianceService as any).addToDnc = async (input: { customerId: string }) => {
  dnc.push(input.customerId)
}

const sids = [`SM${'5'.repeat(32)}`, `SM${'6'.repeat(32)}`, `SM${'7'.repeat(32)}`, `SM${'8'.repeat(32)}`]
const rows: string[] = []
try {
  // A sent summary, so the reply has something to be about.
  const [summary] = await db.insert(meetingMessages).values({ meetingId, kind: 'visit_summary', channel: 'sms', forScheduledFor: context.meeting.scheduledFor, status: 'sent' }).returning()
  rows.push(summary!.id)

  const reply = (sid: string, body: string, optOutType: 'STOP' | 'START' | 'HELP' | null = null) =>
    meetingService.business.handleHomeownerReply(SYSTEM_CONTEXT, { providerMessageId: sid, from, to: mainLine.e164, body, optOutType })

  // "Yes!" confirms, and the thank-you goes out.
  const yes = dalVerifySuccess(await reply(sids[0]!, 'Yes!'))
  assert.deepEqual(yes, { action: 'confirmed', meetingId })
  const after = await getVisitMessageContext(meetingId)
  assert.equal(after?.meeting.homeownerConfirmedVia, 'sms_reply')
  assert.ok(after?.meeting.homeownerConfirmedAt)
  assert.equal(texts.length, 1)
  assert.match(String(texts[0]!.body), /you're confirmed for/)
  assert.ok(!/Reply STOP/.test(String(texts[0]!.body)), 'the thread already carried the opt-out line')

  // The same delivery again: nothing happens twice.
  assert.deepEqual(dalVerifySuccess(await reply(sids[0]!, 'Yes!')), { action: 'duplicate', meetingId })
  assert.equal(texts.length, 1)

  // "Yes but..." is a message for a person.
  assert.deepEqual(dalVerifySuccess(await reply(sids[1]!, 'Yes but my husband cannot make it')), { action: 'forwarded', meetingId })
  assert.equal(pushes.at(-1)?.name, 'notifyHomeownerReply')
  assert.match(String(pushes.at(-1)?.params.body), /husband/)

  // Review Focus 1: STOP marks every customer with this phone, and the office hears about it.
  const sharing = dalVerifySuccess(await findCustomersByPhone(from))
  assert.ok(sharing.length >= 1)
  assert.deepEqual(dalVerifySuccess(await reply(sids[2]!, 'STOP', 'STOP')), { action: 'opt_out', meetingId })
  assert.deepEqual([...dnc].sort(), sharing.map(customer => customer.id).sort(), 'one do-not-contact per customer sharing the phone')
  assert.equal(pushes.at(-1)?.name, 'notifyHomeownerOptedOut')

  // A delivery failure on the summary reaches the office.
  const [voipRow] = await db.select().from(voipMessages).where(eq(voipMessages.providerMessageId, `SM${'4'.repeat(32)}`))
  assert.ok(voipRow, 'the confirmation reply has its Twilio SID')
  await db.update(meetingMessages).set({ voipMessageId: voipRow!.id }).where(eq(meetingMessages.id, summary!.id))
  const failure = dalVerifySuccess(await meetingService.messages.recordDeliveryFailure(SYSTEM_CONTEXT, { providerMessageId: `SM${'4'.repeat(32)}`, reason: 'twilio:30006' }))
  assert.equal(failure.meetingMessageId, summary!.id)
  assert.equal(pushes.at(-1)?.name, 'notifyVisitTextFailed')
  assert.match(String(pushes.at(-1)?.params.customerName), new RegExp(context.customer.name.split(' ')[0]!))
  console.log('replies ✓')
}
finally {
  const mine = await db.select({ id: meetingMessages.id, voipMessageId: meetingMessages.voipMessageId }).from(meetingMessages).where(eq(meetingMessages.meetingId, meetingId))
  for (const row of mine) {
    await db.delete(meetingMessages).where(eq(meetingMessages.id, row.id))
  }
  for (const sid of [...sids, `SM${'4'.repeat(32)}`]) {
    await db.delete(voipMessages).where(eq(voipMessages.providerMessageId, sid))
  }
  await db.update(meetings).set({ homeownerConfirmedAt: null, homeownerConfirmedVia: null }).where(eq(meetings.id, meetingId))
}
```

Run: `DRIZZLE_TARGET=dev NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-replies.ts --meeting <id>`
Expected: `replies ✓`; afterwards the test meeting is unconfirmed again and has no visit messages. Then `rm scripts/tmp-replies.ts`.

Create `scripts/tmp-inbound-signature.ts` (dev server running; the body is a HELP opt-out so the handler records the text and pushes nobody):

```ts
import './lib/load-env'

import assert from 'node:assert/strict'

import { eq } from 'drizzle-orm'
import { getExpectedTwilioSignature } from 'twilio/lib/webhooks/webhooks'

import env from '@/shared/config/server-env'
import { db } from '@/shared/db'
import { voipMessages } from '@/shared/db/schema/voip-messages'

const port = process.env.PORT ?? '3000'
const endpoint = `http://localhost:${port}/api/voip/twiml/messaging-inbound`
const url = `${env.VOIP_WEBHOOK_BASE_URL}/api/voip/twiml/messaging-inbound`
const sid = `SM${'9'.repeat(32)}`
const params = { MessageSid: sid, AccountSid: env.TWILIO_ACCOUNT_SID!, From: '+15555550100', To: '+15555550199', Body: 'HELP', NumMedia: '0', OptOutType: 'HELP' }

try {
  const ok = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': getExpectedTwilioSignature(env.TWILIO_AUTH_TOKEN!, url, params) }, body: new URLSearchParams(params).toString() })
  assert.equal(ok.status, 200)
  assert.match(await ok.text(), /<Response\s*\/>/, 'an empty TwiML answer')
  const [row] = await db.select().from(voipMessages).where(eq(voipMessages.providerMessageId, sid))
  assert.equal(row?.direction, 'inbound', 'the text was recorded on the thread')
  const bad = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': 'nope' }, body: new URLSearchParams(params).toString() })
  assert.equal(bad.status, 401)
  console.log('inbound signature ✓')
}
finally {
  await db.delete(voipMessages).where(eq(voipMessages.providerMessageId, sid))
}
```

Run: `NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-inbound-signature.ts`
Expected: `inbound signature ✓`. Then `rm scripts/tmp-inbound-signature.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/shared/entities/customers/dal/server/queries.ts src/shared/modules/meetings/messages/dal/server/queries.ts src/shared/services/notification.service.ts src/shared/modules/meetings/business/service.ts src/shared/modules/meetings/messages/service.ts src/app/api/voip/twiml/messaging-inbound/route.ts src/app/api/webhooks/twilio/route.ts && git commit -m "feat(meetings): replies on the main line confirm the visit, opt the homeowner out, or reach a person; a failed summary text reaches the office

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Docs, the spec amendments, and the owner gate

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-home-visit-page-and-visit-messages-design.md` (header, §5, §7.1, §7.5, §11, §12a)
- Modify: `docs/codebase-conventions/webhook-routes.md:155`
- Modify: `src/shared/entities/meetings/DOCS.md` (the cancellation email, next to `#gcal-removed-on-cancel`)
- Modify: `docs/superpowers/specs/2026-09-29-customers-module-design.md` (§7, the voip row)
- Modify: `docs/plans/voip-in-house/EPIC.md` (decisions log)
- Modify: `docs/plans/voip-campaigns/*-booking-call-script.md` (step 5.7 and the consent question)

**Interfaces:** none; documentation only.

- [ ] **Step 1: The spec says what the code does**

In the spec:
- Header **Plans:** line: add `docs/superpowers/plans/2026-10-08-visit-messages-sending-and-replies.md` covers §12a steps 2 and 3; step 4 moved to plan 3 (owner, 2026-10-08).
- §5 "`meetings`, new columns": add `- scheduled_for_set_at timestamptz NOT NULL: when scheduledFor was last set. Written by create.before, by update.before on a move, and by the Google Calendar inbound mirror. The planner's booked_after_run keys on it (owner, 2026-10-08).`
- §7.1 "Rules for both runs": add `- No run sends at or after 9:00 PM Pacific (VISIT_MESSAGE_SEND_CEILING_HOUR). A retried delivery that lands later records nothing; the steps then read not_sent / no_record once their window closes (owner, 2026-10-08).`
- §7.5 states table, `not_sent` row: `booked_after_run` "when the meeting was created after the planned time" becomes "when the time was set (scheduled_for_set_at) after the planned time, by booking or by an in-place move". Replace the sentence after the table ("`no_record` cannot tell an in-place time move from a failed run …") with: "`no_record` means a run was due and recorded nothing; an in-place move after the run reads `booked_after_run`, because the time-set fact is recorded."
- §7.5 validator errors: "the word STOP. The renderer adds the STOP line, and a second copy would repeat it." becomes "a spelled-out opt-out instruction (`reply STOP`, `text STOP`, `send STOP`). The renderer adds the STOP line, and a second copy would repeat it; 'will stop by' passes (owner, 2026-10-08)."
- §11 owner gate: add the dev tool lines (`scripts/visit-messages.ts summary | run | cancel`) and `scripts/set-main-line.ts` where the gate says "trigger both runs by publishing each job URL once from the QStash console" (either works; the tool takes `--at`).
- §12a **Plans**: "(2) sending and replies = steps 2–3; (3) message control and the staff entry points = steps 4–5; (4) the home visit page = step 6".

- [ ] **Step 2: The other docs**

- `docs/codebase-conventions/webhook-routes.md`, the Twilio row: status becomes "live for messaging: `/api/webhooks/twilio` (message status) and `/api/voip/twiml/messaging-inbound`; voice and recording callbacks not yet handled".
- `src/shared/entities/meetings/DOCS.md`, next to `#gcal-removed-on-cancel`: a cancelled meeting also dispatches `send-visit-cancellation`; the job sends the calendar cancellation only when a summary email went out in the chain and the meeting has no successor.
- `docs/superpowers/specs/2026-09-29-customers-module-design.md` §7, the voip row: no longer "dormant: no route, no job, no caller"; the main line sends visit messages and receives replies (two routes, three jobs).
- `docs/plans/voip-in-house/EPIC.md`, decisions log: meeting lifecycle SMS ships through the visit-messages spec from one main line (`voip_dids.is_main_line`), not the agent's sticky DID; this supersedes the meeting parts of Phase 2 and the Phase 5 "Confirm meeting via SMS" item.
- Each `docs/plans/voip-campaigns/*-booking-call-script.md`: before step 5.7 add the consent question, "Is it okay if we text you the visit details and a reminder at this number? Message and data rates may apply, and you can reply STOP any time."; step 5.7 becomes "I'm sending your visit details from Tri Pros now; reply YES so I know it came through." The same consent wording goes into the 10DLC campaign's message-flow description (spec §12 item 2; owner action).

- [ ] **Step 3: Verify and commit**

Run: `pnpm tsx scripts/verify-visit-messages.ts && pnpm tsc && pnpm lint`
Expected: green (nothing in this task touches code; this is the whole-branch check before the review).

```bash
git add docs/superpowers/specs/2026-09-29-home-visit-page-and-visit-messages-design.md docs/codebase-conventions/webhook-routes.md src/shared/entities/meetings/DOCS.md docs/superpowers/specs/2026-09-29-customers-module-design.md docs/plans/voip-in-house/EPIC.md docs/plans/voip-campaigns/ && git commit -m "docs(meetings): the spec carries the time-set fact, the 9 PM ceiling and the narrowed STOP check; the Twilio routes are live; the booking scripts ask for consent

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 4: OWNER GATE. The sequence, with real texts.**

Everything below goes to the owner's own phone and inbox. The tunnel is up and holds the webhooks; the dev server was restarted after `.env.local` changed.

1. `scripts/visit-messages.ts summary --meeting <id>` again if the test meeting's time moved; otherwise skip.
2. Reply **YES** from the phone. Expect the thank-you text, `homeowner_confirmed_at` / `_via = sms_reply` on the meeting (visible in the records table once plan 3 lands; until then in the dev database), and no push.
3. Reply **"Yes but my husband can't make it"**, then free text. Expect a push for each, no auto-reply.
4. Reply **STOP**, then **START**. Expect Twilio's own replies, a push for each, and `dnc_opted_out_at` set on the test customer. Clear it by hand afterwards (`Remove from DNC` in the customer profile) so later texts go.
5. Reschedule the test meeting from the dashboard, then reply **YES**. Expect the replacement confirmed (Review Focus 3), the original cancelled with no cancellation email, and the old link still opening the replacement once plan 4 lands.
6. Run `scripts/visit-messages.ts summary --meeting <the replacement id>`: the email updates the same calendar entry instead of adding one (same UID, next SEQUENCE).
7. Cancel the replacement from the dashboard (outcome **Cancelled**). Expect the cancellation email and the calendar entry gone. The hook dispatches through QStash, so the tunnel must be up; `scripts/visit-messages.ts cancel --meeting <id>` runs the same verb directly.
8. Book a fresh test meeting two days out, 10:00 AM, with a rep. Run `scripts/visit-messages.ts run --kind day_before_reminder --at <6 PM Pacific the day before, as a UTC instant>` and expect the reminder text; run `--kind rep_confirmation --at <8:30 AM Pacific on the day>` and expect the "Good morning" text. Run each a second time: nothing.
9. `NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/setup-visit-message-crons.ts --apply` creates the two dev schedules against the tunnel. Watch one tick in the QStash console. Delete the dev schedules when done testing, or they keep hitting the tunnel.
10. Score one summary email on mail-tester.

Production, when the owner says so, in this order: `pnpm db:push:prod` (the plan-1 statements plus Task 1's column), deploy, `DRIZZLE_TARGET=prod … set-main-line.ts --resync` then `--e164 +1213… --apply`, the Twilio console steps from spec §12 on the 213 number with the production host in `VOIP_WEBHOOK_BASE_URL`, `TWILIO_10DLC_CAMPAIGN_SID` once the campaign is approved, and `setup-visit-message-crons.ts --apply` with `DRIZZLE_TARGET=prod`. No homeowner gets a text before plans 3 and 4 ship (D24); the schedules can wait until then.
