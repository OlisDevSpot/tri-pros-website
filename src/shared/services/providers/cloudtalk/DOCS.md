# CloudTalk Provider

The CloudTalk API client for voip-campaigns (lead-conversion delegated to CT's
managed dialer). See [docs/plans/voip-campaigns/EPIC.md](../../../../../../docs/plans/voip-campaigns/EPIC.md)
for the EPIC, [docs/codebase-conventions/service-architecture.md](../../../../../../docs/codebase-conventions/service-architecture.md)
for the four-tier convention, and [docs/plans/voip/INTEGRATION-SEAM.md](../../../../../../docs/plans/voip/INTEGRATION-SEAM.md)
for the cross-EPIC contract.

## superset-client

**The `cloudtalkClient` singleton is the single, uniform entry point for every
CloudTalk interaction.** It is a *superset of the raw CT REST surface* — it
exposes the REST endpoints we use AND the local CT-ecosystem helper (webhook
secret verification) under one import:

```ts
import { cloudtalkClient } from '@/shared/services/providers/cloudtalk/client'

// REST — contacts
const { contactId } = await cloudtalkClient.upsertContact({ phoneE164, name, attributes })
await cloudtalkClient.addTags({ contactId, tags: ['Lead', 'Campaign-MetaAds'] })
await cloudtalkClient.removeTags({ contactId, tags: ['Lead'] })
const contact = await cloudtalkClient.getContact(contactId)

// REST — campaigns + attributes (admin Resync)
const campaigns = await cloudtalkClient.listCampaigns()
const attributes = await cloudtalkClient.listContactAttributes()
await cloudtalkClient.setCampaignStatus({ campaignId, status: 'inactive' })

// REST — SMS + bulk + calls
await cloudtalkClient.sendSms({ fromE164, toE164, text })
await cloudtalkClient.bulkContacts({ ops })
const calls = await cloudtalkClient.listCalls({ since, limit })

// Local CT-ecosystem helper
const ok = cloudtalkClient.verifyWebhookSecret({ url: req.url })
```

**There is no other action import path.** No `lib/contacts.ts`, no
`lib/campaigns.ts`, no `webhooks/verify.ts`. Anything you can do with
CloudTalk happens through `cloudtalkClient.X(...)`.

**Why uniform**: callers have one mental model + one tab-complete surface per
provider. Adding a new capability = adding a method to the client, never a
new import path. This is the pattern across every provider in the codebase
(`twilioClient`, `zohoSignClient`, ...) — CloudTalk is no exception.

**Why "superset"**: the raw CT REST surface exposes contact / call / SMS /
campaign / bulk endpoints. Our client adds webhook-secret verification (a
local cryptographic helper) that conceptually belongs *with* the CT surface
but isn't on the REST root. Colocating it on `cloudtalkClient` keeps every CT
concern reachable from one handle.

## What lives where

```
cloudtalk/
  client.ts                 ← THE entry point (cloudtalkClient + CloudtalkApiError + CloudtalkResponseValidationError + CloudtalkClient type)
  types.ts                  consumer-shaped domain types (CloudtalkContact, CloudtalkCall, CloudtalkContactSummary) + z.infer<> re-exports
  constants/
    index.ts                hosts, rate-limit thresholds, bulk cap, tag names, dispositions, attribute app-keys, pricing
  schemas/                  outbound-API Zod — what WE send to CT (request body shapes)
    primitives.ts           phoneE164Schema, ctTimestampSchema, ctIdSchema, ctPaginationSchema
    contact.ts              add / edit / addTags / removeTags / show / list / attributes
    call.ts                 list row + getById shapes
    sms.ts                  /sms/send request + response
    campaign.ts             list + edit
    bulk.ts                 discriminated bulk op shapes (add_contact | edit_contact | delete_contact)
  webhooks/                 inbound-payload Zod — what CT sends US (5 Workflow Automation event bodies)
    events.ts               5-event discriminated union: call.started / answered / ended / disposition_set / sms.received
```

**Action surface** = `client.ts` only. **Data shapes** (Zod schemas) live in
`schemas/` / `webhooks/` and are imported separately where parsing happens
(route handlers, request input validation). That mirrors how `twilioClient`
exposes actions while its companion `webhooks/voice.ts` + `webhooks/messaging.ts`
Zod schemas live as sibling exports.

## Provider invariants

The provider is a **leaf** — see
[service-architecture.md `dependency-direction-is-one-way`](../../../../../../docs/codebase-conventions/service-architecture.md#dependency-direction-is-one-way).

- **No DB writes.** No `import { db }` or `import from '@/shared/dal/...'`.
- **No service imports.** Provider doesn't know about `compliance.service`,
  `lifecycle.service`, `notifications.service`, etc.
- **No business rules.** Compliance gate, DNC lookup, lifecycle transitions,
  per-source gate, STOP-keyword detection — all live in voip-campaigns'
  `services/voip/campaigns/*.service.ts`. The provider translates intent to
  CT; the services know what we want.
- **No domain types in signatures.** Methods accept primitives + CT-shape
  inputs and return primitives + CT-domain shapes (`CloudtalkContact`,
  `CloudtalkCall`, `CtCampaign`). They do NOT accept or return `Customer` or any
  other app-domain type — any mapping from a CT shape to app intent happens in
  the caller (`services/voip/campaigns/*.service.ts`). _(Note: there is no local
  campaign-status enum to map to — CloudTalk owns lifecycle. The former
  `lifecycle-mapper.ts` / `VoipCampaignStatus` were deleted 2026-06-04 under
  perfect separation.)_

## Webhook architecture

CloudTalk has **NO centralized webhook configuration page** (corrected 2026-05-31).
Instead, each event fires from a separate **Workflow Automation (WA)**
configured under Account → Workflow Automations. Each WA is one Object+Action
pair with a body-builder template + destination URL.

**5 WAs for Phase 1** (NOT 6 — `call.missed` and `voicemail.received` are
derived inside the `call.ended` handler from CT's `is_voicemail` flag +
`answered_at` presence; disposition arrives separately on `Call.Modified`):

| Our `event_type` | CT Object + Action | When it fires |
|---|---|---|
| `call.started` | Call + Started | Outbound dial initiated or inbound ringing |
| `call.answered` | Call + Answered | Call connects |
| `call.ended` | Call + Ended | Hang-up. Handler derives `missed` / `voicemail` / `completed` from `is_voicemail` + presence of `answered_at`. App-side exhaustion check happens here (CT does NOT fire an exhausted webhook). |
| `call.disposition_set` | Call + **Modified** | Disposition assigned (typically during after-call work, AFTER `call.ended`). May also fire for tag/note edits → service guards on actual disposition delta. |
| `sms.received` | Messages + Received | Inbound SMS (STOP detection + agent notification) |

**`event_type` injection:** CT does NOT inject `event_type` natively. We
hardcode it as the first body field in every WA's body builder. The route
handler parses against the discriminated union in `webhooks/events.ts` and
switches on it.

**Body builder syntax** (CT side, configured per WA): `{{ event.properties.call_uuid }}`,
`{{ event.properties.external_number }}`, `{{ event.properties.contacts[0].name }}`, etc.

```ts
import { cloudtalkClient } from '@/shared/services/providers/cloudtalk/client'
import { cloudtalkEventSchema } from '@/shared/services/providers/cloudtalk/webhooks/events'

// In /api/webhooks/cloudtalk/route.ts
if (!cloudtalkClient.verifyWebhookSecret({ url: req.url })) {
  return new Response('unauthorized', { status: 401 })
}
const event = cloudtalkEventSchema.parse(await req.json())
switch (event.event_type) {
  case 'call.answered': /* ... */
}
```

## CT-as-source-of-truth + no shadow rows

voip-campaigns **does NOT shadow CT call/SMS records** into our DB
(INTEGRATION-SEAM §8). CT is the source-of-truth for the underlying call/SMS
data; we re-query it via CT's API on demand. Our DB stores only:
- **Identity bridge** in `voip_campaigns` + `voip_contact_attributes` (CT campaign / attribute IDs synced via admin Resync).
- **Per-customer participation** in `voip_campaign_contacts` — enrollment membership + `unenroll_reason` + the CT `cloudtalk_contact_id` + `dial_attempts` counter + attribute-sync hash.
- **Shared DNC** — 3 fields on `customers` (`dnc_opted_out_at` / `dnc_reason` / `dnc_added_by_user_id`), written by both EPICs.
- **NO lifecycle status** — CT owns the lead lifecycle (incl. its own pipeline tags). The former `customers.voipCampaignStatus` enum was deleted 2026-06-04. **NO shadow call/SMS rows.**

That's why methods like `listCalls` and `getCall` are read-only utilities —
they exist for admin tooling, not for sync-into-our-DB workflows.

## SDK strategy — hand-typed zod schemas (LOCKED 2026-05-31)

`@hey-api/openapi-ts@0.97.3` errors on CT's swagger; Probes 1–4 documented in
`README.md`. **Hand-typed wins** for the Phase 1 ~12-endpoint surface:
- Response validation at the wire boundary via `.parse()` in `request()`
- Explicit understanding of every field
- Zero codegen churn when CT updates swagger

**Don't re-install `@hey-api/openapi-ts` without first re-running the probes.**
Hand-types win until upstream changes.

## CT quirks (codified in code; re-listed here for skimmers)

| What | Reality |
|------|---------|
| Verb convention | **Resource-suffix based, NOT "inverted REST"** as earlier framed. Each endpoint encodes the action via the path suffix: `PUT /resource/add.json` / `GET /resource/index.json` / `GET /resource/show/{id}.json` / `POST /resource/edit/{id}.json` / `DELETE /resource/delete/{id}.json` + per-resource specials (`addTags` / `removeTags` / `recording` / `send` / etc.). |
| Path suffix | Most end in `.json`. **One audited exception:** `GET /calls/{callId}` (no `.json`, no `/show/`). Caller's responsibility — no auto-append. |
| Hosts | Dual: `my.cloudtalk.io/api` (default) vs `platform-api.cloudtalk.io/api` (CueCard / VoiceAgent, future). |
| Auth | HTTP Basic — Access Key ID = username, Access Key Secret = password. Account-wide (no scoping). |
| Rate limit | 60 req/min/account. Client respects `X-CloudTalkAPI-Remaining` (warns at ≤5) and retries 429s using `X-CloudTalkAPI-ResetTime`. |
| Response envelope | Most paths return `{ responseData: { ... } }`. Client unwraps automatically; if absent (e.g., `GET /calls/{id}`), returns body verbatim. |
| Response validation | Each lib/client method passes a zod schema to the internal `request()` helper → `.parse()` runs at the wire boundary; failures throw `CloudtalkResponseValidationError` with structured issues. |
| Webhook auth | NO HMAC. Integrity via `?secret=` long-random shared secret. Constant-time compared in `cloudtalkClient.verifyWebhookSecret`. |
| Bulk cap | 10 ops per request, top-level ARRAY (not enveloped). `bulkContacts` throws if exceeded — caller chunks. Verb is POST. |
| Tag set | 7 lifecycle tags (`Lead`, `Engaged`, `Transferred`, `Booked`, `DoNotCall`, `Exhausted`, `BadNumber`) — these are **CloudTalk's own pipeline tags**, applied + swapped by CloudTalk. Under perfect separation (2026-06-04) we do NOT push them and there is NO local status enum to map them to (`voipCampaignStatus` deleted). `cloudtalkTagNames` is retained only as the read-side vocabulary for parsing CT webhook tag-sets + reconciliation. PLUS per-source membership tags (`Campaign-MetaAds` / `Campaign-HomeDepot`) loaded from `voip_campaigns` — NOT in `cloudtalkTagNames` because their names are runtime data. |
| Enrollment | **Tag-driven** (corrected 2026-05-31). No "campaign enroll" endpoint exists. Enrollment adds **only the per-source membership tag** — `addTags({ contactId, tags: [campaign.ctMembershipTag] })` — because each campaign filters by that ONE tag. We do NOT add the `Lead` lifecycle tag (CT owns lifecycle tags). `unenroll` removes that same membership tag. |
| CT-runtime identity | Campaign IDs + attribute IDs are NOT env vars (corrected 2026-05-31). They live in `voip_campaigns` + `voip_contact_attributes` tables, synced via admin "Resync from CloudTalk" mutation. |
| Q3 inversion | CT agents are independent from app users (locked 2026-05-31). No `assignFavoriteAgent()` method; no `CT_FAVORITE_AGENT_ID_*` env vars. |

## Errors

REST methods throw `CloudtalkApiError` on non-2xx responses; response-validation
failures throw `CloudtalkResponseValidationError`. Both are exported from
`client.ts`:

```ts
import {
  cloudtalkClient,
  CloudtalkApiError,
  CloudtalkResponseValidationError,
} from '@/shared/services/providers/cloudtalk/client'

try {
  await cloudtalkClient.upsertContact({ phoneE164, name })
}
catch (e) {
  if (e instanceof CloudtalkApiError) {
    // e.status, e.path, e.body
  }
  else if (e instanceof CloudtalkResponseValidationError) {
    // e.path, e.issues — CT shape drifted; schema needs an update
  }
}
```

## Env var surface

Reads (via `@/shared/config/server-env`):
- `CLOUDTALK_ACCESS_KEY_ID` + `CLOUDTALK_ACCESS_KEY_SECRET` — HTTP Basic
- `CLOUDTALK_WEBHOOK_SECRET` — shared secret on `?secret=` query (no HMAC)
- `CLOUDTALK_WEBHOOK_IP_ALLOWLIST` — optional Vercel edge allowlist (Phase 0 verification)

**Removed 2026-05-31 (do NOT recreate):**
- `CT_FAVORITE_AGENT_ID_OLIVER` / `_SEAN` — Q3 inversion
- `CT_CAMPAIGN_META_ADS_ID` / `_HOME_DEPOT_ID` — moved to `voip_campaigns` table

## What callers MUST NOT do

- **`import { upsertContact } from '.../cloudtalk/lib/contacts'`** — `lib/`
  doesn't exist. Use `cloudtalkClient.upsertContact(...)`.
- **`import { verifySecret } from '.../cloudtalk/webhooks/verify'`** — that
  file doesn't exist. Use `cloudtalkClient.verifyWebhookSecret({ url })`.
- **Call `cloudtalkClient.upsertContact` / `.sendSms` from a route handler
  directly** — go through voip-campaigns' `services/voip/campaigns/*.service.ts`
  which run the compliance + per-source gate first.
- **Write a `cloudtalkClient.assignFavoriteAgent(...)` method.** Q3 inversion;
  CT agents are independent from app users.
- **Write a `cloudtalkClient.enrollInCampaign(...)` method.** No CT endpoint
  exists. Use `addTags({ contactId, tags: ['Campaign-X'] })`.
- **Hardcode a CT campaign ID or attribute ID.** Load from `voip_campaigns` /
  `voip_contact_attributes`.
- **Reinstall `@hey-api/openapi-ts`** without first re-running the probes
  documented in `README.md`. Hand-typing is the documented current answer.
