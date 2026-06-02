# voip-calls

Per-call lifecycle records for Twilio voice calls between Tri Pros staff and
already-known customers. **Post-conversion comms only** — lead-conversion call
records (CloudTalk-originated) live in voip-campaigns' own tables, never here.

> No `source` discriminator, no `cloudtalk_*` columns. See [CONTEXT.md](../../../../CONTEXT.md)
> for the lifecycle split and [voip-in-house/EPIC.md](../../../../docs/plans/voip-in-house/EPIC.md)
> 2026-05-30 decisions entry for why.

## Invariants

### Idempotency

`provider_call_id` is the vendor's unique call ID (Twilio Call SID today; vendor-
neutral name keeps the column stable across provider swaps). Webhook handlers MUST
use it as the idempotency key via `INSERT … ON CONFLICT (provider_call_id) DO UPDATE`.
Twilio re-delivers status callbacks; double-writes must converge, not duplicate.

### Visibility via agent ownership

Agents see only calls where `agent_user_id` matches their session user. Super-admin
bypasses scoping via the omni path (see `src/trpc/DOCS.md`). Phase 1 doesn't share
calls cross-agent — that's a Phase 2+ admin-view concern.

### Compliance gate on outbound

`services/voip/voip-calls.service.ts` MUST call `complianceService.canOutboundTo`
before placing an outbound call. Blocked attempts insert a row with
`status='skipped_compliance'` and populated `skip_reason` (`'dnc' | 'outside_calling_hours' | 'kill_switch_active'`)
so admins can audit the block trail. NEVER skip the gate — that's what TCPA fines
are made of.

### Recording URL access

`recording_url` is Twilio-hosted; the URL itself is auth-bearer-protected by Twilio.
Agent UI fetches via a signed proxy (Phase 2+); for Phase 1, super-admin-only access
via the admin observability view.

## Forward references

- `services/voip/voip-calls.service.ts` (Task 22) — placeAgentCall + Twilio
  webhook lifecycle handlers
- `/api/webhooks/twilio/route.ts` (Task 26) — single async webhook switching on
  `CallStatus` / `RecordingStatus` payloads
- `/api/voip/twiml/voice-inbound/route.ts` (Task 27) — inbound TwiML responder
