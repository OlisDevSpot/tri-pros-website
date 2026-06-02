# voip-dids

Twilio DIDs (or future provider's DIDs) assigned to Tri Pros humans for
post-conversion comms. Vendor-neutral schema — `provider_did_id` opaque, no
`twilio_*` columns.

## Invariants

### Cardinality is 1:N (user → DIDs)

A single user can own multiple DIDs (e.g., `info@` with main reception line + 424
marketing line + 626 marketing line). Don't model this as a per-user column.

### Exactly one primary per user

`is_primary=TRUE` is allowed on at most one row per `assigned_user_id`. Enforced
by a partial unique index (`voip_dids_assigned_user_primary_uniq`). The sticky
outbound DID lookup (`services/voip/voip-dids.service.ts#getStickyDidForUser`)
uses `WHERE assigned_user_id = ? AND is_active AND is_primary LIMIT 1`.

### Visibility via assignment

Agents see only DIDs they own (`assigned_user_id = userId`). Shared / inbound-
only DIDs (`assigned_user_id IS NULL`, e.g., main reception fanned out by the
provider call flow) are invisible to agents — super-admin manages those via the
admin observability view.

### Provider-neutral naming

`provider_did_id` is opaque (Twilio Phone SID today). Migration to another
provider doesn't require schema changes — just a backfill of the new vendor's
ID into the same column.

## Forward references

- `services/voip/voip-dids.service.ts` (Task 21) — assign / markPrimary /
  unassign / getStickyDidForUser
- Seed script (Task 35) — provisions the initial DID set
