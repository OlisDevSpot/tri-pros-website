# JustCall Dialer Migration — Design Spec

**Date:** 2026-08-19
**Status:** Approved design → ready for implementation planning
**Scope:** Migrate the auto-dialer lead-push/pull integration from CloudTalk to JustCall, behind a neutral `DialerProvider` seam. CloudTalk is fully retired as part of this work.

---

## 1. Context & goals

The app ingests leads from multiple lead sources (telemarketing + social) and pushes them into a cloud auto-dialer so dispatchers can call them; call outcomes flow back and drive unenroll/DNC/SMS-cadence. Today that dialer is **CloudTalk**. This spec migrates it to **JustCall** and, in doing so, formalizes the provider boundary so a *future* third provider is a contained change.

**Primary directive (North Star):** JustCall implemented and live, with minimal blocking tasks. Abstraction is valuable but must not gate go-live.

### Locked decisions (from brainstorming)

1. **Dual dialer-mode model.** Model both routes: single-agent **Autodial** and multi-agent shared-pool **Dynamic** dialing. Dialer mode is a **per-campaign** attribute. The **Bina** lead source (main source) uses **Dynamic**; others default to **Autodial**.
2. **Abstraction = neutral interface, single implementation.** Introduce a `DialerProvider` interface + `WebhookAdapter`, informed by both the CloudTalk and JustCall shapes, with **JustCall as the sole live implementation**. **No** runtime provider registry / config-driven multi-provider switching (YAGNI).
3. **Full provider-neutral schema reshape** with truthful column names. Rename `ct_`/`cloudtalk_` columns, drop the now-meaningless CloudTalk tag columns, add `dialer_mode` + numeric provider ids. **Delete `providers/cloudtalk/*` and all CT-specific bits outright** — CloudTalk is no longer needed.
4. **Go-live scope:** enroll, admin bulk/manual ops, STOP→DNC+unenroll, disposition→unenroll, campaign+field sync, **SMS cadence ported**. **Deferred:** expanded call-outcome persistence (JustCall stays source-of-truth for call records, mirroring today). **Dropped:** the Phase-0 mid-call routing endpoints.
5. **Provisioning = dashboard + sync-in.** Campaigns (and their agent assignments) and the custom fields are created in the **JustCall dashboard**; our app **syncs them in** and stays a pure consumer. No campaign/field creation from our app → **no user-identity mapping** at go-live.

### Tier note (business dependency, not a design dependency)

JustCall **Pro** includes unlimited **Autodial** but gates **Dynamic/Predictive** dialers to **SalesPro**, except a **14-day trial balance of 3 Dynamic/Predictive campaigns** on Pro. Bina's Dynamic dialer relies on that allowance.

> ⚠️ **Open business/account question to confirm with JustCall at signup:** whether a Dynamic campaign *actively used* on Pro persists past the 14-day trial, or only *unused* allowance carries over. The design is **mode-agnostic** — if Dynamic is unavailable, falling Bina back to Autodial is a per-campaign config change, not a rebuild.

---

## 2. Architecture

The ingest → enroll → react pipeline is already provider-agnostic. We swap only the leaf (the provider client) and formalize the boundary it sits behind. An ESLint `no-restricted-imports` seam already enforces the layering (`services/voip/campaigns/*` may import `providers/*`; providers import nothing from services/DAL, hold no DB writes, and keep domain types out of their signatures) — we repoint it from `cloudtalk` to `justcall`.

```
                          ┌──────────────────── REUSED AS-IS ────────────────────┐
 3 ingest entry points →  customer-intake.service → enrollLeadJob (QStash) → enrollment.service
   (bina webhook,                                                                 │ calls
    intake form,                                                                  ▼
    funnel)                                              ╔════════ NEW SEAM ════════╗
                                                         ║  DialerProvider (iface)  ║  neutral contract
                                                         ╚════════════╤═════════════╝  (informed by CT + JC)
                                                                      │ implemented by
                                                         ┌────────────▼─────────────┐
                                                         │   providers/justcall/*   │  ONLY live impl
                                                         └────────────┬─────────────┘
                                                                      │ REST
                                                                      ▼  api.justcall.io/v2.1
 JustCall ──webhook──► /api/webhooks/justcall ──► WebhookAdapter ──► canonical events ──► services react
 (sd.call_completed,      (HMAC verify)         (JC body→neutral)    (unenroll/DNC/cadence)  (enrollment,
  sd.call_updated,                                                                            compliance,
  sms.received)                                                                               sms-cadence)
```

### New units

| Unit | Responsibility | Depends on |
|---|---|---|
| **`DialerProvider`** interface (at the `services/voip/campaigns` ↔ `providers` seam) | Neutral contract: `enroll`, `unenroll`, `switchCampaign`, `sendSms`, `listCampaigns`, `listContactFields`. Speaks app intent, returns neutral shapes; no JustCall types leak upward. | nothing (pure interface) |
| **`providers/justcall/*`** | Sole implementation: REST client (auth, 429 retry, page pagination), request/response Zod schemas, neutral↔JustCall mappers. | JustCall REST API |
| **`WebhookAdapter`** (`providers/justcall/webhooks`) | HMAC verify + parse JustCall event bodies → canonical app events, so `route.ts` and reacting services stay provider-stable. | JustCall webhook contract |

### Reused untouched

All 3 ingest entry points; `customer-intake.service`; every QStash job (`enroll-lead`, `enroll-source-batch`, `bulk-enroll`, `bulk-unenroll`, `bulk-dnc`, `graduate-from-campaign`, `notify-last-interacting-agent`); `compliance.service` + `customers` DNC fields; the `voip_campaign_contacts` participation model; the eligibility gate chain (`lib/eligibility.ts`, `resolve-customer`, `is-stop-keyword`, cadence libs); the tRPC `voip-campaigns.router.ts` admin surface; and the entire `campaigns-admin` frontend.

### Explicitly out of scope / untouched

The **Twilio in-house VoIP EPIC** tables and code — `voip-calls`, `voip-messages`, `voip-dids`, `voip-link-tokens`, `providers/twilio/*` — are a **separate system** (agent comms/IVR/softphone) and are **not** part of this migration.

### Key architectural shift

CloudTalk's "enroll = apply membership tag" idiom is removed. `DialerProvider.enroll(campaign, lead)` maps to a single honest endpoint — `POST /sales_dialer/campaigns/contact` — which is simpler and semantically truthful. The contract is shaped around **operations we perform**, not either vendor's endpoint list.

---

## 3. The `DialerProvider` contract

Types are app-neutral. No JustCall shape crosses this line.

```ts
interface DialerProvider {
  // OUTBOUND — app intent → provider
  enroll(input: {                          // → POST /sales_dialer/campaigns/contact
    providerCampaignId: string
    phoneE164: string
    name?: string
    email?: string
    fields: NeutralField[]                 // [{ appKey, value }] — mapper resolves appKey → numeric id
  }): Promise<{ providerContactId: string }>

  unenroll(input: {                         // → SD remove-contact-from-campaign endpoint (confirm exact path at build)
    providerCampaignId: string
    providerContactId: string
  }): Promise<void>

  switchCampaign(input: {                   // unenroll(old) + enroll(new); one op upward
    phoneE164: string
    fromCampaignId: string
    toCampaignId: string
    name?: string; email?: string; fields: NeutralField[]
  }): Promise<{ providerContactId: string }>

  sendSms(input: {                          // → POST /v2.1/texts/new
    fromNumberE164: string
    toE164: string
    body: string
  }): Promise<{ providerMessageId: string }>

  // INBOUND SYNC — provider → app (the "pull")
  listCampaigns(): Promise<NeutralCampaign[]>    // → GET /sales_dialer/campaigns (id, name, dialerMode, status)
  listContactFields(): Promise<NeutralField[]>   // → SD custom-fields list (appKey ↔ numeric id map)
}
```

Neutral shapes:

```ts
type NeutralField = { appKey: string; value?: string; providerFieldId?: string; label?: string }
type NeutralCampaign = {
  providerCampaignId: string
  name: string
  dialerMode: 'autodial' | 'dynamic' | 'predictive'
  status: 'active' | 'inactive'
}
```

### `providers/justcall/*` internals

Directory mirrors the CloudTalk provider dir being deleted, so seam conventions carry over.

| File | Role |
|---|---|
| `client.ts` | `justcallClient` singleton — REST methods, `Authorization: api_key:api_secret` header, 429 retry w/ backoff, page-based pagination, response-envelope unwrap |
| `lib/config.ts` | env fragment + `getJustcallConfig` / `isJustcallConfigured` |
| `constants/index.ts` | base URL `https://api.justcall.io/v2.1`, rate-limit ceiling (per plan), bulk cap (250), `justcallDispositionToUnenrollReason` map |
| `schemas/*.ts` | outbound request/response Zod (campaign-contact, remove, sms, campaign-list, fields, bulk) |
| `mappers/*.ts` | neutral ↔ JustCall translation, incl. **`resolveFieldIds`** (appKey → `custom_fields:[{id,value}]`) |
| `webhooks/adapter.ts` + `webhooks/events.ts` | HMAC verify + JC event body → canonical events |
| `types.ts`, `DOCS.md`, `README.md` | provider domain types + conventions doc |

### `WebhookAdapter`

Normalizes JustCall inbound to the **same canonical events** `route.ts` already switches on, so reacting services never learn the provider changed.

| JustCall event | Canonical event | Service reaction (unchanged) |
|---|---|---|
| `sd.call_completed` | `call.ended` | count dial (exactly-once via call id) → SMS cadence |
| `sd.call_updated` (carries disposition) | `call.disposition_set` | terminal disposition → `unenroll(reason)` (+DNC if opt-out) |
| `sms.received` | `sms.received` | STOP → DNC + unenroll; else cosmetic notify |

**HMAC verification** (replaces CloudTalk's `?secret=` query check): compute
`HMAC-SHA256(secret, "{secret}|{urlencoded-webhook-url}|{event-type}|{timestamp}")` and constant-time compare to header `x-justcall-signature` (using `x-justcall-signature-version`, `x-justcall-request-timestamp`). The API secret is the signing key. Lives in the adapter; `route.ts` calls `adapter.verify(req)` then `adapter.parse(body)`.

**Disposition-split handling** (known JustCall behavior): `sd.call_completed` may fire *without* the agent disposition, which arrives later on `sd.call_updated`. Therefore **unenroll decisions key off `sd.call_updated`**, while **dial-counting/cadence keys off `sd.call_completed`** — a missing-then-later disposition never drops an unenroll.

---

## 4. Schema reshape (truthful, provider-neutral)

One Drizzle migration. Table names are already neutral; only columns change. Existing inert CloudTalk rows are truncated (JustCall assigns fresh ids).

**`voip_campaigns`** — neutral campaign registry:

```
- ct_campaign_id     → provider_campaign_id    (text, unique — JustCall numeric id as string)
- ct_campaign_name   → provider_campaign_name
- ct_status          → status                  (active | inactive)
- ct_membership_tag  ✗ DROP   (JustCall has no tags; enrollment is explicit campaign_id)
- ct_tag_id          ✗ DROP
+ dialer_mode        NEW enum(autodial | dynamic | predictive)   ← Bina = dynamic
  attempts_per_contact, hours_between_attempts, sms_cadence(jsonb), last_synced_at   (kept)
```

**`voip_campaign_contacts`** — participation model (kept; one truthful rename):

```
- cloudtalk_contact_id → provider_contact_id    (text, unique — JustCall SD contact id)
  customer_id (PK), voip_campaign_id FK, enrolled_at/unenrolled_at, unenroll_reason,
  dial_attempts, last_call_uuid, auto_sms_sent_count, last_auto_sms_at,
  attribute_hash, last_synced_at, last_sync_error   (all kept — already neutral)
```

**`voip_contact_attributes` → `voip_contact_fields`** (name reflects JustCall "custom fields"):

```
  app_key (lead_source | primary_trade | trades_interested | lead_created_at)
- ct_attribute_id    → provider_field_id     (numeric JustCall custom-field id)
- ct_attribute_title → provider_field_label
```

**`customers` DNC fields** (`dnc_opted_out_at`, `dnc_reason`, `dnc_added_by_user_id`) — **untouched** (already neutral).

Entity DAL folders rename in step: `entities/voip-contact-attributes/` → `entities/voip-contact-fields/`; the `voip-campaigns` and `voip-campaign-contacts` entity dirs keep their names, columns updated.

---

## 5. Data flows

### A — Lead auto-enrollment (North Star path)

```
ingest → customerCrud.create
      → [gate: source.voipCampaignsEnabled && source.voipAutoEnroll && source.defaultCampaignId]
      → enrollLeadJob.dispatch({ customerId })                       (QStash, fire-and-forget — unchanged)
      → enrollment.service.enroll():
           6-gate eligibility chain (unchanged: source, dialable campaign, is-lead, DNC, E.164, not-enrolled)
           buildFields() → NeutralField[]   (lead_source, primary_trade, trades_interested, lead_created_at)
           dialerProvider.enroll({ providerCampaignId, phoneE164, name, email, fields })
                └─ mapper.resolveFieldIds() reads voip_contact_fields → custom_fields:[{id,value}]
                └─ POST /sales_dialer/campaigns/contact   (upsert on phone → returns SD contact id)
           upsertEnrolled() → voip_campaign_contacts row (provider_contact_id, attribute_hash)
```

Only substantive change vs today: the provider call is one honest endpoint instead of `upsertContact` + `addTags(membershipTag)`. Code up to and after the seam is unchanged. Bulk/admin paths (`enrollAll`/`enrollSelected` → batch jobs) call the same `enrollment.service.enroll` one-at-a-time.

### B — SMS cadence (ported)

```
sd.call_completed → adapter → call.ended → sms-cadence.service.handleCallEnded():
     count dial exactly-once (last_call_uuid guard, unchanged)
     decide-cadence-sms (pure, unchanged) → dialerProvider.sendSms({ from, to, body })
                                             └─ POST /v2.1/texts/new
     bump auto_sms_sent_count / last_auto_sms_at
inbound sms.received → STOP-keyword → compliance.addToDnc + unenroll   (unchanged logic; new event source)
```

### C — Campaign & field sync (the "pull")

```
tRPC resync → campaign-sync.service (renamed from resyncFromCloudtalk):
     dialerProvider.listCampaigns()     → upsert voip_campaigns (provider_campaign_id, dialer_mode, status)
     dialerProvider.listContactFields() → upsert voip_contact_fields (app_key ↔ provider_field_id)
```

Campaigns + agent assignments + the 4 custom fields are created in the **JustCall dashboard**; this pulls their ids in. No campaign/field creation from our app → no user-identity mapping.

### Custom-field bootstrapping

The 4 fields must exist in JustCall before the first enroll (else ids don't resolve). Runbook: create them once in dashboard → run resync → verify `voip_contact_fields` populated. `enrollment.service` guards: an unresolved field id logs + enrolls **without** that field (fields are enrichment, not gates) rather than hard-failing the dial.

---

## 6. Config & secrets

`providers/justcall/lib/config.ts` → registered in `src/shared/config/server-env.ts`.

```
JUSTCALL_API_KEY        JustCall API key      (Authorization: api_key:api_secret)
JUSTCALL_API_SECRET     JustCall API secret   (also the HMAC webhook-signing key)
VOIP_WEBHOOK_BASE_URL   reused (voip.triprosremodeling.com)
```

Removed outright: every `CLOUDTALK_*` var, the `?secret=` webhook secret, the CT env fragment/meta. No campaign/field/agent ids in env — those are runtime DB data (synced in), as today.

---

## 7. Error handling (parity with CloudTalk's proven behavior)

- **Enroll:** deterministic gate rejects are swallowed (no retry). A JustCall API failure (`justcall_api_failure`) throws → QStash retries the job.
- **429:** client honors rate-limit headers with backoff; retried within the job.
- **Webhook route:** returns **200 once HMAC + parse succeed**, even if a downstream handler throws — prevents JustCall retry storms (mirrors today).
- **Unresolved field id:** enroll proceeds without the field + logs.
- **`switchCampaign`:** unenroll-then-enroll; if enroll fails after unenroll, the job retries the whole op (idempotent — upsert on phone).

---

## 8. Risks to resolve at build time (not design blockers)

| Risk | Severity | Resolution point |
|---|---|---|
| **Auth header encoding** — official docs say raw `api_key:api_secret`; a third-party guide says base64 Basic | High | **First implementation task:** call `GET /v2.1/users` with a live key, confirm which the API accepts. Gates the client. |
| **Rate-limit ceiling** — tiered (Pro = 60/min) per docs, but "100/min" appears elsewhere | Med | Confirm against live `429`/headers; set client ceiling from observed behavior. |
| **Pro Dynamic-campaign persistence past 14-day trial** | Med | **Business/account check with JustCall at signup.** Bina go-live depends on it; Autodial fallback is a config change. |
| **Custom fields creatable via API?** | Low | Verify; if yes, auto-provisioning is a *later* enhancement, not a go-live dependency (dashboard-create + sync is the go-live path). |

---

## 9. Testing

- **Unit:** mappers (neutral ↔ JustCall, incl. `resolveFieldIds`); `WebhookAdapter` HMAC verify + event normalization (fixture bodies for all 3 events); `justcallDispositionToUnenrollReason` map; cadence decision (pure, already covered).
- **Integration:** `enrollment.service` against a **mocked `DialerProvider`** — asserts the neutral contract, provider-agnostic.
- **Contract (live smoke, behind a flag):** enroll a test lead into a scratch campaign, assert the SD contact id round-trips (reuse the config-factory hook smoke-test recipe).
- **Webhook:** signed fixture POSTs to `/api/webhooks/justcall` asserting unenroll/DNC/cadence side-effects.

---

## 10. Rollout / cutover (per-source, Bina-first)

CloudTalk is already retired, so this is a clean build-then-enable gated by the **existing** per-source policy (`voipCampaignsEnabled` / `voipAutoEnroll` / `defaultCampaignId`). No dual-run plumbing.

```
1. Build providers/justcall/* + DialerProvider interface + WebhookAdapter + schema migration   (CT still present)
2. Resolve the auth spike; wire config
3. JustCall dashboard: create Bina's Dynamic campaign + assign dispatchers + 4 custom fields; run resync
4. Enable Bina only (flip its source policy) → validate live enroll + webhook round-trip
5. Roll remaining sources (Autodial campaigns) one at a time
6. Delete providers/cloudtalk/* + CT env + CT-specific bits   (final commit — tree stays green throughout)
```

CloudTalk deletion is the **last** step, so nothing half-references a removed provider mid-migration.

---

## 11. Documentation touchpoints (update as part of the work)

- `docs/plans/voip/INTEGRATION-SEAM.md` — update the provider-swap section + webhook table to JustCall.
- `docs/plans/voip-campaigns/EPIC.md` — mark CloudTalk retired; **note the stale `source='cloudtalk'` discriminator section was already superseded 2026-06-04** (trust seam doc + code).
- `providers/justcall/DOCS.md` — new provider conventions doc.
- Memory: refresh `project-voip-campaigns.md`; add a JustCall runbook (dashboard setup steps).
- A new `docs/plans/voip-campaigns/justcall-api-research.md` capturing the verified API facts (endpoints, auth, webhooks, tiers) gathered during research.
```
