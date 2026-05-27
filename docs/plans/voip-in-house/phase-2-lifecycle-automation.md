# Phase 2 — Lifecycle SMS Automation + DNC Scrub Cron + Recording Retention

> **Parent EPIC:** [EPIC.md](./EPIC.md)
> **Prerequisite:** Phase 1 complete (manual verification gate passed; boundary verification done).
> **Status:** Not started — written after Phase 1 lands so its emergent details inform scope.

## What Phase 2 ships

The manual click-to-call + send-SMS surface from Phase 1 lets agents reach out one customer at a time. Phase 2 layers **automated lifecycle SMS** on top: when a meeting is booked, a confirmation goes out; the day before, a reminder; when a proposal is sent, a link arrives; when project status changes, the customer hears about it. Sends route through `services/voip/voip-lifecycle-sms.service.ts` (new), are queued via QStash (`@migration: → Inngest`), respect per-customer local timezone (derived in `entities/customers/lib/local-tz.ts`), and skip quiet hours for cold sends but flow for transactional (the customer expects them).

Phase 2 also delivers two compliance / retention duties that should have lived in Phase 1 but were correctly deferred: a daily **FTC DNC scrub cron** (consuming the `FTC_DNC_SAN` issued in Phase 0) that batch-inserts new federal opt-outs into `voip_dnc(source='ftc')`; and a **recording auto-delete cron** that drops Twilio recordings (and clears the `recording_url` column) after the `app_settings.configJson.recordingRetentionDays` window.

## Task categories (sketch)

1. **Lifecycle SMS service + templates**
   - `services/voip/voip-lifecycle-sms.service.ts` — `sendMeetingReminder`, `sendProposalLink`, `sendProjectStatusUpdate`, `sendDocUploadRequest` (mints L-DOC link via Phase 1 service + sends SMS with URL).
   - Templates colocated per lead source in `voipConfigJSON.inHouse.transactionalSmsTemplates` (already in Phase 1 schema; Phase 2 actually consumes them).
   - Customer-local timezone derivation (`entities/customers/lib/local-tz.ts`) — derives from zip if not set; falls back to PT.
2. **QStash-driven sends** (`@migration: → Inngest`)
   - Trigger hooks: `meetings.create` → schedule reminder for `scheduled_for - 24h`; `proposals.send` → immediate link send; `projects.statusUpdate` → immediate notify.
   - Job handler routes at `src/app/api/qstash-jobs/voip-lifecycle/route.ts` (matches existing `qstash-jobs/` pattern).
   - Idempotency via job `messageId` + `voip_messages.template_key` uniqueness per-customer-per-template (preventing double-sends on retries).
3. **FTC DNC scrub cron**
   - Daily cron (vercel.json) hits `src/app/api/cron/ftc-dnc-scrub/route.ts`.
   - Pulls deltas from telemarketing.donotcall.gov using `FTC_DNC_SAN` credentials.
   - Batch-inserts into `voip_dnc(source='ftc')` via existing `recordDnc` service.
   - Sentry alert on failure.
4. **Recording auto-delete cron**
   - Reads `app_settings.configJson.recordingRetentionDays` (default 90).
   - For every `voip_calls` row older than the window with `recording_url IS NOT NULL`: call Twilio Recordings API delete + null out the column.
   - Audit-logged via existing analytics service.
5. **Disposition side effects**
   - Centralize in `services/voip/voip-call-disposition.service.ts`: `opt_out` → DNC entry (Phase 1's setDisposition was minimal; Phase 2 adds the side-effect chain); `callback_scheduled` → schedule QStash job to remind the agent; `booked_meeting` → potentially trigger the meeting reminder via the lifecycle service.

## Manual verification gate

Booking a meeting in the dev DB triggers a scheduled QStash job; pushing the clock forward shows the reminder SMS land on the test phone at T-24h. Sending a proposal triggers the link SMS within seconds. Daily DNC cron run picks up at least one delta from the FTC list (or completes successfully with zero deltas). Recording cron deletes a recording from a `voip_calls` row aged past retention.
