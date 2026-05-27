# VoIP Integration Seam — Contract Between voip-in-house and voip-campaigns

> **Read this when touching anything that crosses between the in-house Twilio VoIP system and the CloudTalk Campaigns system.** Changes here affect both EPICs. If you change a contract field below, update both sides simultaneously.

## What this doc is

A single source of truth for the contract between the two sibling VoIP EPICs. Each EPIC implements its own side of this contract; this doc says what each side has to honor.

## System boundary

- **voip-in-house** (Twilio-backed): owns the `voip_*` database tables (calls, messages, dids, dnc, user_availability, etc.), the `services/voip/` umbrella, the `providers/twilio/` provider, the browser softphone widget, the agent-comm UX surface, the inbound main-line IVR.
- **voip-campaigns** (CloudTalk-backed): owns the `services/voip/campaigns/` subdir (orchestration only; no separate DAL), the `providers/cloudtalk/` provider (CloudTalk client + grouped function modules), customer-side fields (`customers.voipCampaignStatus` etc.), the `voip_contact_sync` table, the CloudTalk-side Campaign + AI VoiceAgent dashboard configuration. **All CloudTalk-shadow rows live in voip-in-house's tables** (`voip_calls`, `voip_messages`, `voip_dnc`) with a `source='cloudtalk'` discriminator.

## Data ownership model — the provider is the source of truth for the pre-meeting funnel

**Foundational architectural decision (2026-05-27):** Tri Pros will never build the auto-dialer in-house. Lead conversion is permanently delegated to a managed provider (CloudTalk today; potentially a different provider tomorrow). Therefore, **the provider IS the source of truth for lead lifecycle state** in the pre-meeting funnel. Our app reads via webhooks and maintains a denormalized cache.

| Data class | Source of truth | Direction | Mechanism |
|---|---|---|---|
| **Lead lifecycle state** (Lead → Engaged → Transferred → Booked / Exhausted / BadNumber) | **Provider (CloudTalk)** | provider → us (push) | Webhook handler updates cache columns (`customers.voipCampaignStatus`, `customers.voipLifecycleTags` JSONB) |
| **Call + message activity** (durations, recordings, dispositions, transcripts) | **Provider (CloudTalk)** | provider → us (push) | Same webhook handler, writes `voip_calls` / `voip_messages` rows with `source='cloudtalk'` |
| **Customer identity** (name, phone, email, zip, local TZ) | **Our app** | us → provider (push) | `contact-sync.service.ts` via Bulks API |
| **Source attribution** (`lead_source_label`, source inquiry context) | **Our app** | us → provider (push at enrollment, immutable per-contact) | `enrollment.service.ts` |
| **Trade interest** (`trades_interested`, `primary_trade_label`) | **Our app** | us → provider (push, mutable via attr-sync) | `contact-sync.service.ts` |
| **DNC / opt-out** | **bidirectional canonical** in `voip_dnc` | both | STOP on provider side → webhook to us; admin/FTC add on our side → push to provider |
| **Post-meeting state** (`customers.pipeline` for `fresh`/`active`/`dead`, project lifecycle, proposal status) | **Our app** | our-app-only | Provider is out of the loop after `Booked` tag fires; graduation event hands off |

**Reconciliation cron is mandatory, not optional.** Daily polling of provider's list endpoints + idempotent upserts catches missed webhooks + drift. See §10.

**Provider abstraction layer:** mapping from provider-specific tags / dispositions to our normalized enum lives in **the provider's webhook adapter file** (e.g., `providers/cloudtalk/webhooks/lifecycle-mapper.ts`). Rest of our app reads only the normalized state. Migration to a new provider = swap adapter + repoint webhook URL; rest of the system is unchanged.

## Dependency direction

voip-campaigns code depends on voip-in-house services; not the reverse. Enforced via ESLint `no-restricted-imports`:

| From | May import | May NOT import |
|---|---|---|
| `services/voip/*.ts` (top-level) | DAL, `providers/twilio/*`, sibling top-level services | `services/voip/campaigns/*`, `providers/cloudtalk/*` |
| `services/voip/campaigns/*.ts` | DAL, `providers/cloudtalk/*`, all `services/voip/*` top-level | nothing forbidden |
| `providers/*` | `providers/<self>/generated`, third-party SDK | any `services/*`, any DAL |

## Cross-system contract surfaces

### 1. voip routing endpoints (CloudTalk Call Flow Designer HTTP Request → our app)

Exposed by voip-in-house (`services/voip/voip-routing.service.ts`) at `voip.triprosremodeling.com/api/voip/routing/...`. Sync request-response endpoints (NOT webhooks — Twilio TwiML-return endpoints live in the same namespace under `/api/voip/twiml/*`). CloudTalk's dashboard Call Flow Designer is configured to fire these mid-call. For Phase 0 these routes return mocked responses; voip-in-house Phase 1 lands the real implementations.

| Endpoint | Trigger | Request | Response | MANDATORY fallback branch in CloudTalk |
|---|---|---|---|---|
| `/api/voip/routing/caller-lookup` | Inbound or outbound call begins | `{ caller_e164 }` | `{ customer_id, first_name, pipeline_stage, last_interaction_at, language?, open_project? }` or `{ customer_id: null }` | If HTTP fails → CloudTalk plays generic greeting, no screen-pop |
| `/api/voip/routing/transfer-target` | AI confirms interest; needs warm-transfer target | `{ caller_e164, customer_id }` | `{ target_e164: '<agent in-house DID>', warm_intro: '<≤25 words>', custom_parameters: { dialer_attempt_id, customer_id, trade, location } }` or `{ target_e164: null, reason: 'no_human_available' }`. **Phase 0 mock returns `process.env.CLOUDTALK_PHASE0_TRANSFER_TARGET_E164` (Oliver's cell).** | If HTTP fails or `target_e164: null` → AI says "have someone call you back" + records callback request via webhook |
| `/api/voip/routing/compliance-check` | Optional belt-and-suspenders before Campaign places call | `{ customer_id, phone_e164 }` | `{ allowed: true }` or `{ allowed: false, reason }` | If HTTP fails → treat as allowed; app-side gate is canonical (this is defense-in-depth) |

**Mandatory:** every CloudTalk Call Flow that uses HTTP Request actions MUST have a configured fallback branch in the dashboard. Enforced in voip-campaigns Phase 0 checklist.

### 2. CloudTalk webhooks (CloudTalk → our app)

Configured in CloudTalk dashboard. Posted to `voip.triprosremodeling.com/api/webhooks/cloudtalk`. Single endpoint handles all 6 events; routing by event-type field in payload.

**Architecture rule:** the route handler at `src/app/api/webhooks/cloudtalk/route.ts` **IS** the orchestrator. It verifies the secret, parses the event type, switches on it, and **directly composes existing services** (`voip-calls`, `voip-messages`, `voip-dnc`, `notifications`). No dedicated webhook-handler service. See `docs/codebase-conventions/webhook-routes.md` for the full rule.

| Event | Route handler dispatches to | App-side action |
|---|---|---|
| `call.started` | `voipCalls.recordEvent(...)` | INSERT `voip_calls` row (`source='cloudtalk'`, `status='initiated'`) |
| `call.answered` | `voipCalls.markAnswered(...)` | UPDATE row → `status='answered'`, `answered_at` |
| `call.ended` | `voipCalls.complete(...)` (+ optional CI persistence) | UPDATE row → `status='completed'`, `ended_at`, `duration_sec`, `recording_url`, plus disposition + `transcript_summary` + `sentiment` if Conversation Intelligence data attached |
| `call.missed` | `voipCalls.markMissed(...)` | UPDATE row → `status='no_answer'` or `'voicemail'` per metadata |
| `voicemail.received` | `voipCalls.markVoicemail(...)` + `notifications.notifyAdminPool(...)` | UPDATE call row + push notification to admin pool |
| `sms.received` | conditional: `voipDnc.add(...)` on STOP-keyword match, else `voipMessages.recordInbound(...)` + `notifications.notifyLastInteractingAgent(...)` | If body matches STOP/UNSUB/QUIT/CANCEL/END → INSERT `voip_dnc` (`source='cloudtalk_stop'`); CloudTalk auto-honors on its side. Else INSERT `voip_messages` row + push to last-interacting agent. |

**Idempotency:** UNIQUE constraint on `voip_calls.cloudtalk_call_uuid` and `voip_messages.cloudtalk_message_id`. Re-deliveries of the same event are no-ops via `INSERT … ON CONFLICT DO UPDATE`.

### 3. Webhook security

CloudTalk has NO documented webhook signing (no HMAC). Required defense-in-depth:

1. **Shared-secret query param:** webhook URL is `voip.triprosremodeling.com/api/webhooks/cloudtalk?secret=<long-random>`. Secret stored in env `CLOUDTALK_WEBHOOK_SECRET`. The route handler at `src/app/api/webhooks/cloudtalk/route.ts` verifies before any service call.
2. **IP allowlist (if available):** confirm during voip-campaigns Phase 0 with CloudTalk support — do they publish static webhook IP ranges? If yes, allowlist at Vercel edge via `CLOUDTALK_WEBHOOK_IP_ALLOWLIST`.
3. **Rate limiting at edge:** Vercel handles default; tighten if abuse observed.
4. **Handler-failure policy:** once secret + envelope are valid, return **200 always** — even if a switch-arm's service call throws. Log the error + insert into `voip_webhook_errors` for human review. Reasoning: CloudTalk's retry semantics are undocumented (Phase 0 finding); avoid triggering a retry storm against a broken handler. The reconciliation cron (§10) catches missed events idempotently. Sentry integration is currently stubbed (not yet provisioned in this project) — `console.error` + DB row is the durable record.

### 4. App → CloudTalk push surface

Our app pushes to CloudTalk via `providers/cloudtalk/`. All writes go through `services/voip/campaigns/`. Operations:

| Operation | Service | Provider call | Trigger |
|---|---|---|---|
| Enroll lead in campaign | `enrollment.service.ts` | `providers/cloudtalk/contacts.upsert()` + `contacts.tag()` + `campaigns.enroll()` | Lead created with `pipeline ∈ {'lead', 'fresh'}` AND `voipCampaignStatus = 'not_enrolled'` |
| Sync contact attributes | `contact-sync.service.ts` | `providers/cloudtalk/bulks.batchUpdate()` (≤10 ops/req) | Debounced cron (hourly); on-demand for urgent fields (STOP, graduation) |
| Graduate contact (meeting booked) | `graduation.service.ts` | `providers/cloudtalk/contacts.untag()` + `contacts.update({ campaign_status: 'graduated' })` | New row in `meetings` table where customer has `voipCampaignStatus='enrolled'` |
| Push DNC to CloudTalk | `dnc-propagation.service.ts` | `providers/cloudtalk/contacts.tag('do_not_call')` + `contacts.update({ opted_out: true })` | INSERT into `voip_dnc` (any source other than `'cloudtalk_stop'`) |

### 5. DNC propagation

The `voip_dnc` table is **app-canonical** and used by both systems' outbound gates.

| Trigger | Path |
|---|---|
| Customer texts STOP to a CloudTalk DID | CloudTalk auto-honors on its side immediately + fires `sms.received` → app route handler at `api/webhooks/cloudtalk/route.ts` calls `voipDnc.add({ source: 'cloudtalk_stop', cloudtalk_synced_at: NOW() })`. No pushback needed. |
| Customer texts STOP to an in-house Twilio DID | Twilio webhook → `services/voip/voip-dnc.service.ts` → INSERT `voip_dnc` (`source='twilio_stop'`) → `dnc-propagation.service.ts` pushes to CloudTalk → mark `cloudtalk_synced_at` |
| Customer says "remove me" on a CloudTalk AI call | AI agent records disposition `opt_out`; webhook handler reads disposition + inserts `voip_dnc` (`source='voice_request'`) |
| Admin manual DNC entry | tRPC → `voip-dnc.service.ts` → INSERT → `dnc-propagation.service.ts` pushes to CloudTalk |
| FTC DNC list scrub | Daily cron → `voip-dnc.service.ts` → INSERT batched → `dnc-propagation.service.ts` pushes deltas to CloudTalk |

**Gate consistency rule:** outbound gates (both systems) query `voip_dnc` before placing call / sending SMS. `voip-compliance.service.ts` is the single shared gate. CloudTalk Campaign also gates internally (belt-and-suspenders); if our app's `voip_dnc` and CloudTalk's contact tags ever drift, **our app is authoritative** — fix by re-pushing via `dnc-propagation`.

### 6. Graduation event

**Trigger:** A new row in `meetings` table whose `customer_id` matches a customer with `voipCampaignStatus='enrolled'`.

**Hook point:** tRPC mutation post-hook on `meetings.create` (and any equivalent meeting-create path). Calls `services/voip/campaigns/graduation.service.ts`.

**Steps:**
1. UPDATE `customers.voipCampaignStatus = 'graduated'`, `voipCampaignGraduatedAt = NOW()`
2. CloudTalk push: untag from active campaign + update contact status attribute
3. Send the final-beat confirmation SMS via CloudTalk (last campaign action) — confirms meeting; clean campaign exit
4. After this point, ALL further outbound to this customer goes via in-house Twilio (agent-mediated)

**Re-enrollment policy:** If a graduated customer's meeting is later canceled (e.g., they fall back to `pipeline='lead'`), they do **NOT** auto-re-enroll. Admin must explicitly re-enroll via a button on the customer profile. Reasoning: avoid spamming recently-engaged contacts; let humans judge.

### 7. Pre-enrollment guardrails

Enforced in `services/voip/campaigns/enrollment.service.ts` before pushing to CloudTalk:

```
1. customer.pipeline ∈ {'lead', 'fresh'}                            ← only top-of-funnel
2. customer.voipCampaignStatus === 'not_enrolled'                    ← no double-enroll
3. voip-compliance.service.ts canOutboundTo(customer.phoneE164)      ← DNC + valid E.164 + calling-hours check
4. customer.phoneE164 not null AND valid                             ← basic data quality
```

Enforced in this order; first failure short-circuits.

### 8. Cross-system table conventions

The shared tables use a `source` discriminator enum:

| Table | `source` values | Notes |
|---|---|---|
| `voip_calls` | `'in_house'` (Twilio-originated), `'cloudtalk'` (CloudTalk-originated) | Customer timeline queries union across both |
| `voip_messages` | same | Conversation thread queries union across both |
| `voip_dids` | same | Pool management is per-source (in-house has agent DIDs; cloudtalk has campaign DIDs) |
| `voip_dnc` | `'twilio_stop'`, `'cloudtalk_stop'`, `'voice_request'`, `'manual_admin'`, `'ftc'` | Origin tracking; doesn't gate anything |

Source-specific columns (e.g., `cloudtalk_call_uuid`, `twilio_call_sid`, `campaign_id`, `transcript_summary`, `sentiment`) are nullable and populated only by their respective source. **Schemas for these tables land in voip-in-house Phase 1** with forward-compat columns for cloudtalk usage.

### 9. `lead_sources.voipConfigJSON` shape

Shared config field. Each EPIC owns a sub-object:

```jsonc
{
  // voip-campaigns owns:
  "campaigns": {
    "enabled": true,
    "cloudtalkCampaignId": "campaign_xxx",
    "cloudtalkVoiceAgentId": "agent_xxx",
    "messageTemplateOverrides": { ... }
  },
  // voip-in-house owns:
  "inHouse": {
    "enabled": true,
    "transactionalSmsTemplates": { ... },
    "calling_hours_override": { ... }
  }
}
```

Validated via Zod schema in `entities/lead-sources/schemas.ts`.

### 10. Failure modes + recovery

> **Reconciliation cron is mandatory infrastructure, not a recovery-only mechanism.** Because the provider owns lifecycle state (see "Data ownership model" above) and webhook delivery is best-effort by every provider, the cache in our DB will drift without a periodic reconciliation pass. Treat the cron as a load-bearing component — alert loudly if it fails for >2 consecutive runs.

| Failure | Detection | Recovery |
|---|---|---|
| CloudTalk API outage (5xx, timeouts) | provider client retry budget exhausted; logged via `console.error` + `voip_webhook_errors` DB row (Sentry stubbed for now) | Enrollment service queues local; graduation queued; sync-cron pauses; banner in admin UI; resume on recovery |
| Missed webhook (CloudTalk → app) | **Mandatory** daily reconciliation cron: `providers/cloudtalk/calls.list({ from: last_24h })` + `providers/cloudtalk/contacts.list({ updated_since: last_24h })` → diff against our cache → backfill orphans + correct stale lifecycle tags | Idempotent upsert via `UNIQUE(cloudtalk_call_uuid)`; tag-diff overwrites cache (provider is SoT) |
| Lifecycle cache drift (webhook missed AND reconciliation missed) | Weekly deep-reconciliation cron walks ALL active campaign contacts; flags >2% mismatch rate as alert-worthy | Re-pull from CT; if drift persists, escalate to investigation (likely webhook config issue) |
| voip routing endpoint timeout (our app slow) | CloudTalk's HTTP Request times out (configured 5s); falls back per dashboard branch | Dashboard fallback branch records the failure as a call disposition + may play "we'll call you back" |
| Attribute sync drift | Hourly cron compares `attribute_hash` on `voip_contact_sync` against current customer attributes; mismatch → re-push | Push deltas via Bulks; alert if persists >2h |
| `voip_dnc` and CloudTalk tags drift | Periodic reconciliation cron pulls CloudTalk contacts with `do_not_call` tag → ensures match in `voip_dnc` | App-canonical; CloudTalk side gets re-pushed |
| Twilio outage (in-house) | Sentry + provider client retry budget exhausted | In-house outbound queues; agent UI shows degraded banner; in-flight CloudTalk transfers still execute (CloudTalk's call leg is independent of Twilio side until the SIP REFER) |

### 11. Subdomain + env vars

`voip.triprosremodeling.com` — single subdomain for all VoIP-related external webhook + voip routing traffic. DNS already configured. Env: `VOIP_WEBHOOK_BASE_URL`.

**Routing convention (load-bearing rule — also documented in `docs/codebase-conventions/webhook-routes.md`):**

Three semantic buckets, three namespaces:

1. **Async event notifications** (fire-and-forget; external service notifies us, no response body required) → `src/app/api/webhooks/<provider>/route.ts`. **ONE route file per external source.** The route handler IS the orchestrator: verifies secret, parses event type, switches on it, directly composes existing services. No wrapper service. All events from a given provider fire to the same URL; in the provider's dashboard, every webhook URL points there.
2. **Sync request-response** (external service hits us mid-flight and waits for instructions / lookup data) → `src/app/api/voip/routing/*` (or analogous verb-based namespace). Different semantics from webhooks — these endpoints return business data, not 200 acks. Owned by the relevant internal service (e.g., `voip-routing.service.ts`), reusable across providers.
3. **Browser / customer-facing** → outside `/api/webhooks/` and outside `/api/voip/routing/`. App-originated traffic.

| URL | Semantic bucket | Owner |
|---|---|---|
| `voip.triprosremodeling.com/api/webhooks/twilio` | Async — ONE route handler for ALL Twilio status callbacks (voice/recording/messaging). Switch on payload discriminant (`CallStatus` vs `MessageStatus` vs `RecordingStatus`). All Twilio dashboard webhook URLs point here. | voip-in-house |
| `voip.triprosremodeling.com/api/webhooks/cloudtalk` | Async — ONE route handler for ALL 6 CloudTalk events. Switch on event-type field in payload. | voip-campaigns |
| `voip.triprosremodeling.com/api/voip/routing/caller-lookup` | Sync — voip routing (mid-call enrichment) (returns customer data) | voip-in-house |
| `voip.triprosremodeling.com/api/voip/routing/transfer-target` | Sync — voip routing (mid-call) (returns `target_e164`) | voip-in-house (Phase 0 mocked; Phase 1 real) |
| `voip.triprosremodeling.com/api/voip/routing/compliance-check` | Sync — belt-and-suspenders gate before placing call | voip-in-house |
| `voip.triprosremodeling.com/api/voip/twiml/voice-inbound` | Sync — Twilio inbound voice webhook (TwiML response body) — NOT under `/webhooks/` because it returns TwiML, not an ack | voip-in-house |
| `voip.triprosremodeling.com/api/voip/twiml/messaging-inbound` | Sync — Twilio inbound SMS webhook (TwiML response body, or 200 empty) | voip-in-house |
| `voip.triprosremodeling.com/api/voip/softphone/access-token` | Browser — softphone fetches Twilio Voice JWT | voip-in-house |
| `voip.triprosremodeling.com/api/voip/links/[token]` | Customer-facing — tokenized-link consume + redirect | voip-in-house |

**Why Twilio inbound voice/SMS is NOT under `/api/webhooks/twilio/`:** Twilio expects a TwiML response body (XML instructions) inline. That's synchronous request-response semantics, not fire-and-forget event notification. Same shape as voip routing lookups, different namespace from async webhooks.

### 12. Open contract questions (resolve before voip-campaigns Phase 0 sign-off)

- IP allowlist availability for CloudTalk webhooks (confirm with their support)
- Custom-header support on CloudTalk webhooks (alternative to query-string secret to reduce log leakage)
- CloudTalk's actual rate-limit behavior under sustained load (60/min documented; behavior at 90% utilization TBD)
- Conversation Intelligence webhook envelope format (Handoff 2 noted it doesn't follow the responseData envelope — confirm during Phase 0 testing)
- AI VoiceAgent transfer mechanics: does CloudTalk bridge to e164 via SIP REFER, or does it dial via the campaign DID? Affects call-leg accounting + Twilio-side ringing for the receiving agent.
- Recording retention policy: confirm CloudTalk retention default + whether we need to archive externally for audit/legal hold
