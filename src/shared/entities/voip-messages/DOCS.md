# voip-messages

Twilio SMS records for post-conversion comms between Tri Pros staff and
already-known customers. Inbound STOP/UNSUB keywords also land here and trigger
DNC writes via `complianceService.addToDnc`.

## Invariants

### Thread key is composite

A conversation thread is uniquely keyed by `(voipDidId, remoteE164)`. The same
customer texting two different Tri Pros DIDs = TWO separate threads. The UI shows
an agent only their thread on their DID — never a flat merge across DIDs.

Covered by index `voip_messages_thread_idx`. Cross-DID admin queries ("all
messages with Bob across all DIDs") use index `voip_messages_remote_idx`.

### Idempotency

`provider_message_id` is the vendor's unique message ID (Twilio Message SID).
Webhook handlers MUST use it as the idempotency key — Twilio re-delivers status
callbacks (queued → sent → delivered), so double-writes must converge.

### STOP-keyword path is service-context

Inbound `STOP` / `UNSUB` from a customer arrives at
`/api/voip/twiml/messaging-inbound`. The route writes the inbound row AND calls
`complianceService.addToDnc({ reason: 'stop_keyword' })` under SYSTEM_CONTEXT.
The agent attached to the DID does NOT need read permission on the inbound row
for the DNC write to succeed.

### Compliance gate on outbound

`services/voip/voip-messages.service.ts#sendSms` MUST call
`complianceService.canOutboundTo` before sending. Same rule as voip-calls — DNC
violations are TCPA fines waiting to happen.

### Visibility via agent ownership

Agents see only messages where `agent_user_id` matches their session. Inbound
messages on shared DIDs (no agent attached) are super-admin-only.

## Forward references

- `services/voip/voip-messages.service.ts` (Task 23) — sendSms +
  STOP-keyword handler + Twilio status webhook lifecycle
- `/api/webhooks/twilio/route.ts` (Task 26) — switches on `MessageStatus`
- `/api/voip/twiml/messaging-inbound/route.ts` (Task 27) — inbound TwiML responder
