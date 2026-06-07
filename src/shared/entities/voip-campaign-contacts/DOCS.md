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

## Related

- `services/voip/campaigns/enrollment.service.ts` — owns enroll/unenroll verbs
- `voip_campaigns.voip_campaign_id` ← FK target carrying the membership tag
- `src/app/api/webhooks/cloudtalk/route.ts` — resolves customer via `findCustomerIdByCtContactId`
