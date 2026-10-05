# JustCall Provider

The JustCall Sales Dialer API client for voip-campaigns (lead conversion
delegated to JustCall's managed dialer). Replaced CloudTalk 2026-08-19.

See [docs/plans/voip-campaigns/justcall-api-research.md](../../../../../docs/plans/voip-campaigns/justcall-api-research.md)
for the verified API facts, [the migration spec](../../../../../docs/superpowers/specs/2026-08-19-justcall-dialer-migration-design.md)
for the design, and [service-architecture.md](../../../../../docs/codebase-conventions/service-architecture.md)
for the four-tier convention.

## The neutral seam — this provider is NOT imported directly

Unlike most providers, nothing in `services/voip/campaigns/*` imports
`providers/justcall/*` directly. The dialer is reached ONLY through the neutral
`DialerProvider` binding:

```ts
import { dialerProvider } from '@/shared/services/voip/dialer'
await dialerProvider.enroll({ providerCampaignId, phoneE164, name, fields })
```

`providers/justcall/dialer-provider.ts` is the single implementation of that
interface, and `services/voip/dialer/index.ts` is the single line that binds it.
JustCall-specific shapes (numeric ids, `custom_fields:[{id,value}]`, webhook
payloads) never cross the `DialerProvider` line — they are translated in
`dialer-provider.ts` (outbound) and `webhooks/adapter.ts` (inbound). Swapping to
a future provider = a new `providers/<x>/` impl + one line in `dialer/index.ts`.

## superset-client

`justcallClient` (in `client.ts`) is the single, uniform entry point for every
JustCall REST interaction — the same one-factory-one-singleton pattern as every
other provider. It is a leaf: primitives/scalar shapes in and out, no app-domain
types.

```ts
import { justcallClient } from '@/shared/services/providers/justcall/client'

const { contactId } = await justcallClient.addContactToCampaign({ campaignId, phoneE164, customFields })
await justcallClient.removeContactFromCampaign({ campaignId, contactId })
await justcallClient.sendSms({ fromE164, toE164, body })
const campaigns = await justcallClient.listCampaigns()
const fields = await justcallClient.listContactFields()
```

The provider layer above it (`dialer-provider.ts`) maps these to the neutral
`DialerProvider`; the webhook adapter maps inbound payloads to canonical events.

## enroll = explicit campaign push (no tags)

JustCall has **no membership-tag idiom**. Enrollment is an explicit
`POST /sales_dialer/campaigns/contact` (upsert-on-phone) carrying the campaign id
+ the numeric `custom_fields`. Unenroll is `POST /sales_dialer/campaigns/contact/remove`.
This is why the reshaped schema dropped `ct_membership_tag`/`ct_tag_id` and the
enrollment service reads `provider_campaign_id` off the campaign row.

## Webhook verification

`webhooks/adapter.ts` verifies inbound requests via `verifyJustcallSignature`
(HMAC-SHA256, keyed with `JUSTCALL_API_SECRET` — there is no separate webhook
secret), then normalizes the body to a `CanonicalDialerEvent`. The route handler
(`app/api/webhooks/justcall/route.ts`) never sees a JustCall shape.

Signature recipe (verified 2026-08-19): `secret|encodeURIComponent(webhook_url)|type|timestamp`,
the secret doubling as HMAC key and first field. `webhook_url` + `type` are read
from the **body** (not the request URL / a header); only the timestamp comes from
a header (`x-justcall-request-timestamp`). Every webhook shares the envelope
`{ request_id, webhook_url, url_id, type, data:{…} }` — payload fields nest under
`data` (e.g. `data.call_info.disposition`, `data.sms_info.body`,
`data.sales_dialer_number`). See [the API research doc](../../../../../docs/plans/voip-campaigns/justcall-api-research.md#webhooks-verified).

## What lives where

```
justcall/
  client.ts                 THE REST entry point (justcallClient + JustcallApiError + JustcallResponseValidationError)
  dialer-provider.ts        justcallDialerProvider — the sole DialerProvider impl (JustCall → neutral)
  constants/index.ts        base URL, retry/bulk caps, field app-keys, disposition→unenroll-reason map
  lib/config.ts             env fragment + getJustcallConfig / isJustcallConfigured / justcallConfigMeta
  schemas/                  Zod for each SD endpoint response
  mappers/resolve-field-ids.ts   neutral fields → numeric custom_fields
  webhooks/
    events.ts               inbound Zod (sd.call_completed / sd.call_updated / sms.received) + HMAC verify
    adapter.ts              verify + normalize → CanonicalDialerEvent
```
