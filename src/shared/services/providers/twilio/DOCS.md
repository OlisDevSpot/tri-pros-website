# Twilio Provider

The Twilio API client for voip-in-house (Phase 2 — agent comms post-conversion).
See [CONTEXT.md](../../../../../../CONTEXT.md) for the voip-in-house vs
voip-campaigns split, and [docs/codebase-conventions/service-architecture.md](../../../../../../docs/codebase-conventions/service-architecture.md)
for the four-tier backend convention.

## superset-client

**The `twilioClient` singleton is the single, uniform entry point for every
Twilio interaction.** It is a *superset of the raw `twilio` SDK* — it exposes
the REST surface we use AND the local Twilio-ecosystem helpers (JWT minting,
TwiML builders, webhook signature verification) under one import:

```ts
import { twilioClient, RestException } from '@/shared/services/providers/twilio/client'

// REST
await twilioClient.placeOutboundCall({ from, to, applicationSid, ... })
await twilioClient.sendMessage({ from, to, body })
await twilioClient.listIncomingPhoneNumbers()

// Local Twilio-ecosystem helpers
const jwt = twilioClient.mintVoiceAccessToken({ identity: userId })
const xml = twilioClient.buildInboundVoiceTwiml({ dialTarget, callerId })
const ok  = twilioClient.verifyWebhookSignature({ url, signature, params })
```

**There is no other action import path.** No `lib/voice.ts`, no `lib/jwt.ts`,
no `webhooks/verify.ts`. Anything you can do with Twilio happens through
`twilioClient.X(...)`.

**Why uniform**: callers have one mental model + one tab-complete surface
per provider. Adding a new capability = adding a method to the client, never
a new import path. This is the pattern across every provider in the codebase
(`zohoSignClient`, `notionClient`, ...) — Twilio is no exception.

**Why "superset"**: the raw `twilio` SDK exposes REST methods. Our client
adds the rest of the Twilio interaction surface — JWT mint, TwiML builders,
webhook signature verify — that conceptually belongs *with* the SDK but isn't
on the SDK's REST root. By colocating them on `twilioClient`, every Twilio
concern is reachable from the same handle.

## What lives where

```
twilio/
  client.ts             ← THE entry point (twilioClient + RestException + TwilioClient type)
  types.ts              SDK type re-exports (CallInstance, MessageInstance, ...)
  constants/
    index.ts            TTLs, PILOT_DIDS, VETTING, ACCESS_TOKEN_IDENTITY_PREFIX, ...
  schemas/              outbound-API Zod (request shapes for typed inputs)
    primitives.ts       e164Schema, twilioSidSchema, isoDateTimeSchema
    access-token.ts     mintVoiceAccessTokenInputSchema
  webhooks/             inbound-payload Zod (form-urlencoded parsing at the seam)
    voice.ts            voice* webhook schemas (status callback, dial action, etc.)
    messaging.ts        messaging* webhook schemas (inbound, status callback)
```

**Action surface** = `client.ts` only. **Data shapes** (Zod schemas + SDK
types) live in `schemas/` / `webhooks/` / `types.ts` and are imported
separately where parsing/typing happens (route handlers, service signatures).
That mirrors how `zohoSignClient` exposes actions while its companion
`interface AttachFile` / `interface DocumentOrder` live as sibling exports.

## Provider invariants

The provider is a **leaf** — see
[service-architecture.md `dependency-direction-is-one-way`](../../../../../../docs/codebase-conventions/service-architecture.md#dependency-direction-is-one-way).

- **No DB writes.** No `import { db }` or `import from '@/shared/dal/...'`.
- **No service imports.** Provider doesn't know about `compliance.service`,
  `scheduling.service`, etc.
- **No business rules.** Compliance gate, DNC lookup, dev-override
  rewriting, STOP-keyword detection, recording-retention policy — all live
  in Slug C's `services/voip/*.service.ts`. The provider translates intent
  to Twilio; the services know what we want.
- **No domain types in signatures.** Methods accept primitives + SDK option
  types (`CallListInstanceCreateOptions`, `MessageListInstanceCreateOptions`,
  `MintVoiceAccessTokenInput`). They return primitives + SDK instance types
  (`Promise<CallInstance>`, `Promise<MessageInstance>`, `string` for TwiML
  + JWT). Domain translation happens in the caller.

## Webhook payload Zod

`webhooks/voice.ts` + `webhooks/messaging.ts` Zod schemas parse Twilio's
form-urlencoded webhook bodies into typed records at the route-handler seam:

```ts
import { voiceStatusCallbackSchema } from '@/shared/services/providers/twilio/webhooks/voice'

// In /api/webhooks/twilio/route.ts
const params = Object.fromEntries(formData.entries())
const payload = voiceStatusCallbackSchema.parse(params)
// payload is now { CallSid: string, CallStatus: 'completed' | ..., Duration?: number, ... }
```

These are *separate* exports (not methods on `twilioClient`) because they're
data shapes used at the boundary, not actions you invoke. Same treatment as
zoho-sign's `interface AttachFile` — sibling exports, not properties of the
client.

## Errors

REST methods throw the SDK's `RestException` on non-2xx responses. Re-exported
from `client.ts` so callers `instanceof` it:

```ts
try {
  await twilioClient.placeOutboundCall({ ... })
}
catch (e) {
  if (e instanceof RestException) {
    // e.code, e.status, e.message, e.moreInfo
  }
}
```

Do NOT wrap `RestException` in a provider-specific error class — the SDK's
shape is the source of truth.

## Env var surface

Reads (via `@/shared/config/server-env`):
- `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` — REST client + webhook signature validation
- `TWILIO_API_KEY_SID` + `TWILIO_API_KEY_SECRET` — JWT signing (NOT the auth token)
- `TWILIO_TWIML_APP_SID` — granted on minted JWTs for outbound dial
- `TWILIO_TRUST_PROFILE_SID` (optional — Trust Hub pending)
- `TWILIO_10DLC_CAMPAIGN_SID` (optional — 10DLC pending)
- Pilot DIDs (`TWILIO_TRANSFER_TARGET_DID_*`, `TWILIO_DID_424_*`, `TWILIO_DID_626_*`)

Webhook signing uses `TWILIO_AUTH_TOKEN` — that's Twilio's standard signing
key for both REST + webhook callbacks. There is no separate
`*_FOR_WEBHOOK_VALIDATION` env var.

## What callers MUST NOT do

- **`import { placeOutboundCall } from '.../twilio/lib/voice'`** — `lib/`
  doesn't exist. Use `twilioClient.placeOutboundCall(...)`.
- **`import twilio from 'twilio'`** outside this directory — the provider is
  the single boundary that knows the SDK. Slug E enforces this via ESLint
  `no-restricted-imports`.
- **Call `twilioClient.placeOutboundCall` / `.sendMessage` from a route
  handler directly** — go through Slug C's `services/voip/*.service.ts`
  which run the compliance gate + DNC check + dev-override rewriting first.
