# SMS appointment reminders — demo build

Status: demo on branch `claude/twilio-sms-appointment-reminders-vuwrjg`. Compiles and lints; not yet deployed, no DB push, no Twilio console changes. Delete this file when the feature ships.

## What the customer experiences

| When | Text (from the Messaging Service number) |
|---|---|
| Right after booking (or 8 am next day if booked after 9 pm) | `Tri Pros Remodeling: Hi Maria, Oliver is booked to visit you Tue, Oct 7 at 2:00 PM. We'll text a reminder the day before. Reply STOP to opt out.` |
| 6 pm the day before, only if not yet confirmed | `Tri Pros Remodeling: Hi Maria, Oliver is coming by tomorrow (Tue, Oct 7) at 2:00 PM and we're looking forward to it! Reply C to confirm or R to reschedule.` |
| Customer replies `C` / `yes` | `Tri Pros Remodeling: Thanks Maria, you're confirmed for Tue, Oct 7 at 2:00 PM. See you then!` and `meetings.confirmed_at` is set live in the app. |
| Customer replies `R` / `no` / anything else | Reschedule ack (for `R`), and the last-interacting agent is notified. Nothing is auto-changed. |
| Customer replies `STOP` | Twilio blocks carrier-side; we also write the DNC row. |

Templates live in `src/shared/services/voip/lib/meeting-sms-templates.ts`. Each is one GSM-7 segment for short names.

## Code map (read in this order)

1. `src/shared/services/voip/lib/meeting-sms-templates.ts` — bodies + `classifyReminderReply`.
2. `src/shared/services/voip/lib/sms-send-window.ts` — 8 am–9 pm Pacific quiet-hours guard.
3. `src/shared/services/voip/voip-messages.service.ts` → `sendLifecycleSms` — compliance gate, prod 10DLC gate, dev override, `voip_messages` row, Twilio send through the Messaging Service.
4. `src/shared/services/voip/meeting-reminders.service.ts` — `sendBookingConfirmation`, `sendDayBeforeReminders`, `handleInboundReply`.
5. `src/shared/entities/meetings/dal/server/queries.ts` — `listReminderCandidates(dayKey)`, `getReminderTargetByMeetingId`, `findNextMeetingByCustomerPhone`.
6. `src/shared/entities/meetings/dal/server/mutations.ts` — `claimReminderSend` / `releaseReminderClaim` (idempotency).
7. `src/shared/services/providers/upstash/jobs/send-booking-confirmation.ts`, `send-meeting-reminders.ts` — QStash jobs, registered in `src/app/api/qstash-jobs/route.ts`.
8. `src/app/api/voip/twiml/messaging-inbound/route.ts` — inbound SMS (sync, returns TwiML).
9. `src/app/api/webhooks/twilio/route.ts` — delivery status callbacks.
10. `src/app/api/cron/meeting-reminders/route.ts` — Vercel Cron entry point (option B below).
11. `scripts/setup-meeting-reminders-cron.ts` — creates the QStash schedule (option A below).

Schema change: `meetings.reminder_sent_at` (nullable timestamptz). Cleared together with `confirmed_at` whenever `scheduled_for` moves, so a rescheduled meeting gets a fresh reminder.

## The 6 pm batch, end to end

```
clock (QStash schedule or Vercel Cron)
  └─ POST /api/qstash-jobs?job=send-meeting-reminders       (QStash-signed)
       └─ meetingRemindersService.sendDayBeforeReminders()
            ├─ listReminderCandidates(tomorrow)   scheduled tomorrow, not cancelled,
            │                                     confirmed_at IS NULL, reminder_sent_at IS NULL,
            │                                     customer has a phone
            └─ for each row (sequential):
                 ├─ claimReminderSend(meetingId)   UPDATE … WHERE reminder_sent_at IS NULL
                 ├─ voipMessagesService.sendLifecycleSms()
                 │    ├─ complianceService.canOutboundTo   (DNC)
                 │    ├─ 10DLC campaign SID present in prod
                 │    ├─ VOIP_DEV_OVERRIDE_NUMBER rewrite in dev/preview
                 │    ├─ voip_messages row (queued → sent)
                 │    └─ twilioClient.sendMessage({ messagingServiceSid, to, body, statusCallback })
                 └─ on Twilio failure (not DNC): releaseReminderClaim
```

Why claim-before-send: QStash retries the whole handler on a non-2xx. Claiming each row first means a retry after a partial batch resumes where it stopped instead of texting the first N customers twice. Vercel's 60 s `maxDuration` on the jobs route covers a few dozen sends; past ~50 meetings a day, page the batch through QStash (dispatch one job per row).

## Deliverability and branding (the "don't get flagged" list)

Everything below is a Twilio console / process item, not code, except where noted.

1. **A2P 10DLC is mandatory.** Brand is approved, campaign is still vetting (`docs/plans/voip/HANDOFF-from-twilio-build.md`). Register the campaign as *Mixed / Customer Care + Account Notifications* and paste the exact templates above as the sample messages. Unregistered traffic on a 10-digit number is throttled and filtered by carriers.
2. **Send through a Messaging Service, never a bare `from`.** Attach the 10DLC campaign and the DID pool to one Messaging Service, enable *Sticky Sender* (same number per customer, so replies thread) and *Advanced Opt-Out* (carrier-standard STOP/HELP handled by Twilio, with a custom HELP body naming the company). Code reads `TWILIO_MESSAGING_SERVICE_SID`.
3. **Consent.** The appointment-set flow (in-home meeting booked by phone or funnel) is the transactional consent event. Record it in the customer's timeline note and in the 10DLC campaign's *message flow* description. Do not reuse this Messaging Service for cold campaigns; carriers score per campaign.
4. **Content rules the templates follow:** brand name first; no URL shorteners (bit.ly and similar are a hard filter trigger); no ALL CAPS, no `$`, no exclamation clusters; opt-out language in the first message; one segment where possible.
5. **Timing.** TCPA quiet hours: nothing before 8 am or after 9 pm local. The 6 pm batch is inside the window; booking confirmations defer themselves to 8 am via QStash `notBefore`.
6. **Throughput.** 10DLC caps per-number throughput by trust score. A single number does roughly 1 msg/s at a high score; the batch is sequential, so a 40-meeting day takes under a minute.
7. **Local presence.** A 424 / 818 / 909 area-code DID in the pool reads as a neighbour, not a shortcode. Keep CNAM set on each DID.
8. **Watch the status callbacks.** `undelivered` with error 30007 means carrier filtering; two in a row on a fresh campaign is the signal to pause and re-check the samples registered.

## Trigger options for the 6 pm job

| Option | How | Timezone | Retries | Cost / limits | Verdict |
|---|---|---|---|---|---|
| **A. QStash schedule** (`pnpm reminders:cron:setup -- --apply`) | Cron in Upstash posts to `/api/qstash-jobs?job=send-meeting-reminders`, same path the gcal renewal uses | `CRON_TZ=America/Los_Angeles 0 18 * * *`, DST-safe | Yes, with dead-letter queue and dashboard "run now" | Already paid for; one more schedule | **Recommended.** Infra exists, signature verification exists, nothing new to secure. |
| **B. Vercel Cron** (`vercel.json` + `/api/cron/meeting-reminders`) | Vercel GETs the route with `Authorization: Bearer $CRON_SECRET`; route enqueues the QStash job | UTC only. 6 pm Pacific = `0 1 * * *` in PDT, `0 2 * * *` in PST, so it drifts one hour twice a year | None from Vercel; QStash handles the job side | Hobby: once per day, fires anywhere in the hour. Pro: minute-precise | Fine as a belt-and-braces backup or if Upstash is ever dropped. Route is built; `vercel.json` snippet is in the route header. |
| **C. Per-meeting delayed job** | On booking, dispatch `send-meeting-reminders` with `notBefore = day-before 6 pm` and a `deduplicationId = meetingId`; on reschedule, dispatch again (new time) | Exact per meeting | Yes | One QStash message per meeting | Precise but stateful: needs cancel-on-confirm and cancel-on-reschedule. The batch already handles both by re-reading the DB at 6 pm. Not worth it at this volume. |
| **D. Twilio Message Scheduling** (`scheduleType: 'fixed'`, `sendAt`) | Twilio holds the message up to 35 days and sends it itself | Exact | Twilio-side | Requires a Messaging Service (we have one); opt-outs do not cancel scheduled messages, so a confirm or STOP needs an explicit cancel call | Same statefulness problem as C plus a compliance gap. Skip. |
| **E. Manual / admin** | `curl -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron/meeting-reminders?day=2026-10-07` | n/a | via QStash | none | Built into B; use it for testing and for re-running a day. |

## Rollout checklist

1. `pnpm db:push:dev` (adds `meetings.reminder_sent_at`); prod push when the feature ships.
2. Twilio console: Messaging Service with the 10DLC campaign, sticky sender, advanced opt-out. Set its inbound webhook to `https://voip.triprosremodeling.com/api/voip/twiml/messaging-inbound` and each DID's status callback to `https://voip.triprosremodeling.com/api/webhooks/twilio`.
3. Env (Vercel + `.env.local`): `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_10DLC_CAMPAIGN_SID` (already planned), `VOIP_WEBHOOK_BASE_URL`, `CRON_SECRET` (only for option B). Dev/preview also set `VOIP_DEV_OVERRIDE_NUMBER` to a team phone.
4. Dev test: `pnpm dev:mobile`, book a meeting for tomorrow with a customer whose phone is yours, watch the booking text land; then `pnpm reminders:cron:setup:dev -- --apply` or curl the cron route with `?day=<tomorrow>`; reply `C` and watch `confirmed_at` flip in the meeting view.
5. Prod: `pnpm reminders:cron:setup -- --apply` once. Confirm the first 6 pm tick in the QStash dashboard.

## Deliberately out of scope here

- Per-customer timezone (every customer is in SoCal; `BUSINESS_TIMEZONE` stands in).
- A reschedule flow from the text itself (link to a slot picker). An `R` reply notifies the agent; that is the existing human path.
- Attaching `voip_did_id` to lifecycle rows (the Messaging Service picks the sender; the status callback carries `From` if this is wanted later).
- Admin UI for pausing or previewing the batch. Pausing today = pause the schedule in the QStash dashboard.
