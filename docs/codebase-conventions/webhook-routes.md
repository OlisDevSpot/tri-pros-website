# Webhook Routes — Convention

How inbound HTTP from external systems is shaped in this codebase. Establishes the **async-vs-sync split**: webhooks are for event notifications; synchronous lookup/instruction endpoints live elsewhere.

> Companion docs: [service-architecture.md](./service-architecture.md) — the four-tier service/provider/DAL pattern; [environment.md](./environment.md) — where webhook env vars live; ADR-0003 — service/provider boundary rationale.

---

## The async-vs-sync split

Every external HTTP request into our app falls into exactly one of two buckets. The bucket determines URL namespace, response semantics, and which code owns the handler.

| Bucket | What it is | URL namespace | Response semantics |
|---|---|---|---|
| **Async webhook** | Event notification — external service tells us something happened (a call ended, a payment processed, a status changed). Fire-and-forget. They don't wait for business data; they just want a 200 ack. | `src/app/api/webhooks/<provider>/route.ts` | Return 200 with `{ ok: true }` body (or empty). No business data in response. |
| **Sync request-response** | Lookup or instruction — external service is mid-flight and **waits for our response to decide what to do next**. Mid-call enrichment (CloudTalk's Call Flow Designer HTTP Request asking "who is this caller?"), Twilio inbound voice asking for TwiML, third-party gates asking "may we proceed?". | `src/app/api/<domain>/<purpose>/...` (e.g., `/api/voip/routing/caller-lookup`) | Return business data the caller needs to continue. JSON body, TwiML body, etc. |

**The deciding question:** *"Does the caller need data back from us to decide what happens next on their side?"* If yes → sync request-response (not under `/webhooks/`). If no → async webhook (under `/webhooks/`).

---

## Async webhook rules

### Rule 1 — One route file per external source

Every provider gets exactly ONE webhook route handler. **Not one per event-type.**

```
src/app/api/webhooks/cloudtalk/route.ts        ← ALL 6 CloudTalk events
src/app/api/webhooks/twilio/route.ts           ← ALL Twilio async events (voice status, recording status, messaging status)
src/app/api/webhooks/zoho-sign/route.ts        ← ALL Zoho Sign events (existing)
src/app/api/webhooks/quickbooks/route.ts       ← ALL QuickBooks events (existing)
src/app/api/webhooks/bina/route.ts             ← ALL Bina events (existing)
```

In the provider's dashboard, **every webhook URL points to the same single endpoint.** Differentiation happens internally via switch on event-type (or payload discriminant, if the provider doesn't send an explicit event-type field).

### Rule 2 — The route handler IS the orchestrator

No dedicated "webhook handler service" wrapper. The route handler:
1. Verifies the shared secret (and/or HMAC if the provider supports it).
2. Parses the event type from the body / headers.
3. Switches on the event type.
4. **Directly calls into the existing services** that own the business logic (`voipCalls.recordEvent`, `voipMessages.recordInbound`, `voipDnc.add`, etc.).
5. Returns 200.

```ts
// src/app/api/webhooks/cloudtalk/route.ts
export async function POST(req: Request) {
  if (!verifySecret(req)) return new Response('unauthorized', { status: 401 })
  const body = await req.json()
  if (!isValidEnvelope(body)) return new Response('bad request', { status: 400 })

  try {
    switch (body.event_type) {
      case 'call.started':
        await voipCalls.recordEvent({ ...body.payload, source: 'cloudtalk' })
        break
      case 'sms.received':
        if (isOptOutKeyword(body.payload.text)) {
          await voipDnc.add({ phone: body.payload.from, source: 'cloudtalk_stop' })
        } else {
          await voipMessages.recordInbound({ ...body.payload, source: 'cloudtalk' })
          await notifications.notifyLastInteractingAgent({ ... })
        }
        break
      // ...
    }
  } catch (err) {
    // see Rule 4 — log + persist to voip_webhook_errors; still return 200
    await logWebhookFailure({ provider: 'cloudtalk', event: body.event_type, err, body })
  }

  return Response.json({ ok: true })
}
```

**Why no wrapper service:** an extra `webhook-handler.service.ts` that just does the switch + delegates adds a layer with no behavior. The orchestration IS the routing logic — colocating it in the route handler keeps the call graph one hop shorter and obvious in code review.

### Rule 3 — Allowed imports

Route handlers are above the service layer (same tier as tRPC procedures). They may import:
- ✅ Any service (`services/*.service.ts`, `services/<domain>/*.service.ts`)
- ✅ Any provider (`services/providers/*/client.ts`, `services/providers/*/lib/*`) — for verifying signatures, parsing webhooks, etc.
- ✅ Auth / context helpers
- ❌ DAL **never directly** — go through a service (per ADR-0003: only services may touch DAL)

### Rule 4 — Failure handling: 200 always once secret + envelope are valid

| Failure | Status | Behavior |
|---|---|---|
| Invalid/missing secret | 401 | Return immediately. Don't log payload (could be probe traffic). |
| Malformed envelope (can't determine event type) | 400 | Return immediately. Log envelope shape for debugging. |
| Service-call throws inside a switch arm | **200** | Log the error to console + insert into `<provider>_webhook_errors` table (or shared `webhook_errors` table). **Do not return 500.** |

**Why 200-on-handler-failure:** undocumented retry semantics from providers can compound a broken handler into a thundering herd. The reconciliation cron (per-provider) catches genuinely missed events by polling list endpoints; a single failed delivery is recoverable that way.

Sentry / structured error tracking is not yet provisioned in this codebase — `console.error` + DB-row is the durable failure record until it lands.

---

## Sync request-response rules

### Rule 5 — Live outside `/webhooks/`, under a verb- or domain-based namespace

Sync endpoints aren't webhooks. Pick a namespace that names the purpose:

| URL | Purpose |
|---|---|
| `src/app/api/voip/routing/caller-lookup/route.ts` | Mid-call enrichment — CloudTalk asks "who is +1...?", we respond with customer data |
| `src/app/api/voip/routing/transfer-target/route.ts` | Mid-call routing — CloudTalk asks "where do I transfer this?", we respond with `target_e164` + intro |
| `src/app/api/voip/routing/compliance-check/route.ts` | Pre-dial gate — "may we call +1...?", we respond with allowed/denied |
| `src/app/api/voip/twiml/voice-inbound/route.ts` | Twilio inbound voice — we respond with TwiML instructions |
| `src/app/api/voip/twiml/messaging-inbound/route.ts` | Twilio inbound SMS — we respond with TwiML (or empty 200) |

### Rule 6 — These ARE thin glue, but they return business data

Same thinness as webhook route handlers, but the body of the response carries the answer the caller is waiting on. Structure:
1. Verify any auth/signing the caller provides.
2. Parse the request envelope.
3. Call into the owning service (e.g., `voipRouting.lookupCaller(e164)`).
4. **Return the service's response as JSON / TwiML.**

```ts
// src/app/api/voip/routing/transfer-target/route.ts
export async function POST(req: Request) {
  if (!verifySecret(req)) return new Response('unauthorized', { status: 401 })
  const { caller_e164, customer_id } = await req.json()

  const result = await voipRouting.findTransferTarget({ caller_e164, customer_id })
  // Phase 0: result is mocked to `{ target_e164: env.CLOUDTALK_PHASE0_TRANSFER_TARGET_E164, warm_intro: '...' }`
  // Phase 1: result is computed against agent availability + sticky DID rules

  return Response.json(result)
}
```

### Rule 7 — Failure handling: depends on the caller's expectations

Sync endpoints can't pretend a failure succeeded — the caller is waiting for an answer. Each route should:
- Return a **structured failure shape** the caller can interpret (e.g., `{ target_e164: null, reason: 'no_human_available' }`)
- Document the **MANDATORY fallback branch** the caller must configure (for CloudTalk, this is configured in Call Flow Designer; for Twilio TwiML, this is built into the response)
- Use 5xx **only** for unrecoverable failures the caller couldn't have anticipated

---

## Vendor-by-vendor route map (current state)

| Vendor | Webhook URL (async) | Sync endpoints | Status |
|---|---|---|---|
| CloudTalk | `/api/webhooks/cloudtalk` (6 events: call.started/answered/ended/missed + voicemail.received + sms.received) | `/api/voip/routing/{caller-lookup,transfer-target,compliance-check}` (Phase 0 mocked; Phase 1 real) | voip-campaigns Phase 0 in flight |
| Twilio | `/api/webhooks/twilio` (voice status + recording status + messaging status; one endpoint, switch on payload discriminant `CallStatus` vs `MessageStatus` vs `RecordingStatus`) | `/api/voip/twiml/{voice-inbound,messaging-inbound}` (returns TwiML); `/api/voip/softphone/access-token` (browser softphone) | voip-in-house Phase 1 (not yet scaffolded) |
| Zoho Sign | `/api/webhooks/zoho-sign` (existing) | — | live |
| QuickBooks | `/api/webhooks/quickbooks` (existing) | — | live |
| Bina | `/api/webhooks/bina` (existing) | — | live |

---

## When you add a new external integration

1. **Identify which bucket each inbound endpoint falls into** using the deciding question (Rule 1 of the split).
2. **Webhooks**: one route file at `src/app/api/webhooks/<provider>/route.ts`. In the provider's dashboard, point ALL webhook URLs to that one path. Switch on event-type internally.
3. **Sync endpoints**: pick a domain namespace (`/api/<domain>/<purpose>/...`). One route per logical operation. The route's owning service lives in `services/<domain>/`.
4. **Verify the secret in the route handler**, not in a wrapped service. Auth is a route concern.
5. **Failure mode**: webhooks → 200-always-once-secret-valid; sync endpoints → structured failure shape the caller can interpret.

## Why we don't use `/webhooks/<provider>/<event>/` sub-routes

We considered per-event sub-routes (e.g., `/api/webhooks/cloudtalk/call-ended`, `/api/webhooks/cloudtalk/sms-received`) but rejected because:
1. **One URL per provider** matches every provider's actual dashboard model — they accept a single URL and fan out by event-type field. Multi-URL setups require redundant config per event.
2. **One file per provider** keeps the entire orchestration in one place. When `sms.received` needs to also fire a notification that `call.ended` doesn't, the diff is one switch arm — not a new file with duplicated secret-verification + envelope-parsing scaffolding.
3. **Easier to track / debug** — `tail -f vercel logs` filtered to `/api/webhooks/cloudtalk` shows every CloudTalk event in order.

## Why we don't use a dedicated webhook-handler service

We considered `services/<domain>/webhook-handler.service.ts` as a wrapper that the route handler delegates to (`await dispatchCloudtalkWebhook(event, payload)`). Rejected because:
1. The wrapper has no behavior — it's just a switch + delegate. Adding a layer with no behavior obscures the call graph.
2. The route handler is already a single-purpose unit — webhook orchestration IS its job. Hiding the switch behind a function in another file doesn't reduce surface; it spreads it.
3. Real per-event business logic lives in the *underlying* domain services (`voip-calls`, `voip-messages`, etc.) — not in a webhook-specific service. Those domain services are what get reused beyond the webhook context (e.g., a manual admin "record this call" action calls the same `voipCalls.recordEvent`).
