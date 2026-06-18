# voip-campaign-contacts

Per-customer CloudTalk participation record — ONE row per customer ever pushed
to CloudTalk. The single home for all voip-campaigns per-customer state (CT
contact id, enrollment membership, the enrolled campaign FK, dial attempts,
sync). `customers` carries NO `voipCampaign*` fields (only the shared DNC
fields, written by both EPICs).

> Perfect separation (2026-06-04): we own enrollment MEMBERSHIP (an action we
> drive); CloudTalk owns lifecycle STATUS (an outcome it drives). Tracking
> membership locally does NOT violate separation. See
> [EPIC.md](../../../../docs/plans/voip-campaigns/EPIC.md) decisions log 2026-06-04.

## Invariants

### Membership state model (`#membership-state`)

- **Enrolled now** = row exists AND `unenrolled_at IS NULL`.
- **Unenroll** = `removeTags([membershipTag])` + set `unenrolled_at` +
  `unenroll_reason`. The row + `cloudtalk_contact_id` PERSIST so re-enroll reuses
  the same CT contact. Guarantees a customer is always unenrollable.
- **Re-enroll** = clear `unenrolled_at` + reason, reset `dial_attempts`, set a
  fresh `enrolled_at`, possibly point `voip_campaign_id` at a different campaign.

### Three exit paths, one idempotent unenroll (`#three-exit-paths`)

`unenroll_reason` (`graduated | opted_out | disqualified`) attributes OUR action:
- **graduated** — meeting booked. Triggers: app meeting-create job + CT `meeting_booked` disposition.
- **opted_out** — STOP/opt-out. Triggers: `sms.received` STOP + CT `opt_out` disposition. Also writes DNC.
- **disqualified** — manual "stop calling / bad lead, no meeting." Triggers: admin/agent UI button + CT `not_interested`/`wrong_number` dispositions.

The single op `enrollmentService.unenroll(ctx, { customerId, reason })` is
idempotent — `markUnenrolled` only patches rows with `unenrolled_at IS NULL`, so
the app meeting-create job and the CT webhook can both fire without double-effect.

### Which campaign is recorded, not derived (`#campaign-fk`)

A lead source owns MANY campaigns; a customer is in exactly ONE at a time.
`voip_campaign_id` (FK → `voip_campaigns`) records it. The membership tag to
add/remove is read from that campaign row — never derived from the lead source.

### Admin-only visibility (ring 1) (`#admin-only-visibility`)

No scoped-CRUD agent access in ring 1. Enrolled-count badges + the disqualify
action read through the tRPC router under admin gating.

## SMS Cadence State (`#sms-cadence-state`)

Three columns track the SMS cadence orchestration state per-lead. All three
reset to their initial values on re-enrollment (same as `dial_attempts`).

### `dial_attempts` — exactly-once counting via `last_call_uuid` (`#dial-attempts-dedup`)

`dial_attempts` increments on each unique `call.ended` webhook. Webhooks are
at-least-once; redeliveries carry the same `call_uuid`. Dedup is atomic:

```sql
UPDATE voip_campaign_contacts
SET dial_attempts = dial_attempts + 1, last_call_uuid = :callUuid
WHERE customer_id = :customerId
  AND last_call_uuid IS DISTINCT FROM :callUuid
RETURNING dial_attempts;
```

- **First sighting (`rowsAffected = 1`):** `last_call_uuid` was null or different.
  Increment fires. The returned count drives the cadence decision.
- **Redelivery (`rowsAffected = 0`):** `last_call_uuid` equals the current `call_uuid`.
  Increment is skipped. Postgres row-locks the contact, so concurrent identical-uuid
  deliveries serialize — no race, no double-count. On re-enrollment, `last_call_uuid`
  is reset to null.

### `auto_sms_sent_count` — next ladder index

Counts the number of SMS messages already sent to this contact in the current
campaign enrollment. Also the index of the next message to send (strict ladder).
Resets to 0 on re-enrollment. Advances only on a successful `cloudtalkClient.sendSms`.

### `last_auto_sms_at` — ≤1/day gate, LA-local

Timestamp (ISO 8601 string with timezone) of the most recent auto-SMS send.
Drives the `oneSmsPerDay` gate in the cadence decision engine: if
`sameLocalDay(last_auto_sms_at, now, 'America/Los_Angeles')` is true, no SMS
sends that day even if the next message is armed. Resets to null on re-enrollment.

### Design reference

[docs/superpowers/specs/2026-06-17-voip-campaigns-sms-cadence-design.md](../../../../docs/superpowers/specs/2026-06-17-voip-campaigns-sms-cadence-design.md) — section 8.1 for exactly-once dedup, section 6 for orchestration decision flow.

## Related

- `services/voip/campaigns/enrollment.service.ts` — owns enroll/unenroll verbs
- `voip_campaigns.voip_campaign_id` ← FK target carrying the membership tag
- `src/app/api/webhooks/cloudtalk/route.ts` — resolves customer via `findCustomerIdByCtContactId`
