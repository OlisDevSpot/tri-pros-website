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
| `/api/voip/routing/transfer-target` | **NOT USED for lead conversion as of 2026-05-27 pivot** (AI VoiceAgent off the table; Smart Dialer + human-on-line is the canonical flow, no mid-call warm-transfer). Endpoint remains scaffolded for general-purpose voice routing (future use cases: post-graduation routing, multi-source transfer when more providers are added). | `{ caller_e164, customer_id }` | Phase 0 mock returns `{ target_e164: null, reason: 'phase_0_pivot_no_transfer' }`. Real impl in voip-in-house Phase 1 returns sticky-DID-per-agent if applicable. | Endpoint not in any active CloudTalk Call Flow as of 2026-05-27; no fallback branch needed |
| `/api/voip/routing/compliance-check` | Optional belt-and-suspenders before Campaign places call | `{ customer_id, phone_e164 }` | `{ allowed: true }` or `{ allowed: false, reason }` | If HTTP fails → treat as allowed; app-side gate is canonical (this is defense-in-depth) |

**Mandatory:** every CloudTalk Call Flow that uses HTTP Request actions MUST have a configured fallback branch in the dashboard. Enforced in voip-campaigns Phase 0 checklist.

### 2. CloudTalk webhooks (CloudTalk → our app)

**Architecture:** 5 Workflow Automations (corrected 2026-05-31) configured in CT dashboard at Account → Workflow Automations. **NO centralized webhook URL config page.** Each WA is one Object+Action pair with a body-builder template + destination URL. All 5 POST to `voip.triprosremodeling.com/api/webhooks/cloudtalk?secret=...`. CT does not inject `event_type` natively — we hardcode it as the first body key in each WA's body builder.

**Body builder syntax** (CT side): `{{ event.properties.call_uuid }}`, `{{ event.properties.external_number }}`, `{{ event.properties.contacts[0].name }}`, etc. Body is fully shaped on CT's side; the route handler receives our preferred field names directly.

**Architecture rule:** the route handler at `src/app/api/webhooks/cloudtalk/route.ts` **IS** the orchestrator. It verifies the secret, parses the `event_type` field, switches on it, and **directly composes existing services** (`voip-calls`, `voip-messages`, `voip-dnc`, `notifications`). No dedicated webhook-handler service. See `docs/codebase-conventions/webhook-routes.md` for the full rule.

| Our `event_type` | CT Object + Action | Route handler dispatches to | App-side action |
|---|---|---|---|
| `call.started` | Call + Started | `voipCalls.recordEvent(...)` | INSERT `voip_calls` row (`source='cloudtalk'`, `status='initiated'`) |
| `call.answered` | Call + Answered | `voipCalls.markAnswered(...)` + `lifecycle.applyEngagement(...)` | UPDATE row → `status='answered'`, `answered_at`; lifecycle `lead → engaged` |
| `call.ended` | Call + Ended | `voipCalls.complete(...)` | UPDATE row → `status='completed' \| 'no_answer' \| 'voicemail'` derived from CT's `is_voicemail` flag + presence of `answered_at`; persist `duration_sec`, `recording_url`. **Disposition NOT here — arrives on `call.disposition_set`.** Handler increments app-side attempts counter; if `attempts_per_contact` reached → emit `cadence_exhausted` lifecycle event (CT does not fire an exhausted webhook). |
| `call.disposition_set` | Call + Modified | `lifecycle.applyDisposition(...)` | Map CT disposition → `voipCampaignStatus` enum transition via `lifecycle-mapper.ts`. `Call.Modified` may fire for other edits (tags, notes) → handler guards on actual disposition delta. **Race-defense:** Ended typically fires first; handler is idempotent + checks current-status-before-transition. |
| `sms.received` | Messages + Received | conditional: `voipDnc.add(...)` on STOP-keyword match, else `voipMessages.recordInbound(...)` + `notifications.notifyLastInteractingAgent(...)` | If body matches STOP/UNSUB/QUIT/CANCEL/END → INSERT `voip_dnc` (`source='cloudtalk_stop'`); CT auto-honors on its side. Else INSERT `voip_messages` row + push to last-interacting agent. |

**Removed from prior 6-event design (2026-05-31):**
- ~~`call.missed`~~ — CT does not separate; `Call.Ended` handler derives from metadata.
- ~~`voicemail.received`~~ — same: `Call.Ended` handler derives `voicemail` status from `is_voicemail` flag. Inbound VM notification is a downstream side-effect, not a separate event.

**Deferred (not Phase 1):** `Messages.Sent` (delivery tracking), `Call.Ringing on agent`, `Call.Survey filled`, `Contact.*`, `User.*`, `Recording.*`, `Transcription.*`.

**Idempotency:** UNIQUE constraint on `voip_calls.cloudtalk_call_uuid` and `voip_messages.cloudtalk_message_id`. Re-deliveries of the same event are no-ops via `INSERT … ON CONFLICT DO UPDATE`.

### 3. Webhook security

CloudTalk has NO documented webhook signing (no HMAC). Required defense-in-depth:

1. **Shared-secret query param:** webhook URL is `voip.triprosremodeling.com/api/webhooks/cloudtalk?secret=<long-random>`. Secret stored in env `CLOUDTALK_WEBHOOK_SECRET`. The route handler at `src/app/api/webhooks/cloudtalk/route.ts` verifies before any service call.
2. **IP allowlist (if available):** confirm during voip-campaigns Phase 0 with CloudTalk support — do they publish static webhook IP ranges? If yes, allowlist at Vercel edge via `CLOUDTALK_WEBHOOK_IP_ALLOWLIST`.
3. **Rate limiting at edge:** Vercel handles default; tighten if abuse observed.
4. **Handler-failure policy:** once secret + envelope are valid, return **200 always** — even if a switch-arm's service call throws. Log the error + insert into `voip_webhook_errors` for human review. Reasoning: CloudTalk's retry semantics are undocumented (Phase 0 finding); avoid triggering a retry storm against a broken handler. The reconciliation cron (§10) catches missed events idempotently. Sentry integration is currently stubbed (not yet provisioned in this project) — `console.error` + DB row is the durable record.

### 4. App → CloudTalk push surface

Our app pushes to CloudTalk via `providers/cloudtalk/lib/*`. All writes go through `services/voip/campaigns/*`. Operations (corrected 2026-05-31 — no "enroll" endpoint exists; enrollment = tag-add):

| Operation | Service | Provider call(s) | Trigger |
|---|---|---|---|
| Enroll lead in campaign | `enrollment.service.ts` | `contacts.upsert()` + `contacts.addTags(['Lead', 'Campaign-X'])`. Campaign membership tag loaded from `voip_campaigns.ct_membership_tag` keyed by `source_slug`. CT auto-includes the contact in the matching Campaign because the Campaign is configured to filter by that tag. | Lead created with `pipeline ∈ {'lead', 'fresh'}` AND `voipCampaignStatus = 'not_enrolled'` |
| Engagement transition | webhook handler (`call.answered`) → `lifecycle.applyEngagement()` | `contacts.removeTags(['Lead'])` + `contacts.addTags(['Engaged'])` | First answered call detected via webhook |
| Sync contact attributes | `contact-sync.service.ts` | `bulks.batchUpdate()` (≤10 ops/req; `edit_contact` action with `ContactAttribute` references by `attribute_id` from `voip_contact_attributes`) | Debounced cron (hourly); on-demand for urgent fields (STOP, graduation) |
| Graduate contact (meeting booked) | `graduation.service.ts` | `contacts.removeTags(['Campaign-X', 'Lead', 'Engaged', 'Transferred'])` + `contacts.addTags(['Booked'])` | New row in `meetings` table where customer has `voipCampaignStatus ∈ ('lead','engaged','transferred')`. **REMOVE `Campaign-X`** on terminal state (defense-in-depth against attempts-counter reset; historical "was-in-source-X" persisted in `customers.voipCampaignSource`). |
| Cadence exhaustion (terminal non-success) | webhook handler (`call.ended`) → `lifecycle.applyExhaustion()` | `contacts.removeTags(['Lead', 'Engaged'])` + `contacts.addTags(['Exhausted'])`. **KEEP `Campaign-X`** (historical; CT internal counter already stopped further dialing). | App-side attempts counter hits `voip_campaigns.attempts_per_contact` |
| Push DNC to CloudTalk | `dnc-propagation.service.ts` | `contacts.removeTags(['Campaign-X', 'Lead', 'Engaged'])` + `contacts.addTags(['DoNotCall'])` | `customers.dncOptedOutAt` transitions NULL → set (any reason other than `'cloudtalk_stop'`) |
| Resync CT campaign + attribute IDs | `campaign-sync.service.ts#syncFromCloudtalk()` | `campaigns.list()` + `attributes.list()` → upsert `voip_campaigns` + `voip_contact_attributes` | Admin-triggered button (Phase 1); Phase 2 may add daily cron if drift observed |

### 5. DNC propagation

DNC is a **shared canonical fact decorated on the `customers` row** (3 nullable fields). No separate `voip_dnc` table. Both systems gate against the same column. Owning service: `src/shared/services/compliance/`.

**Customer-row DNC fields** (see voip-in-house Phase 1 task "Decorate customers with DNC fields"):

| Column | Meaning |
|---|---|
| `dncOptedOutAt` | Timestamp set at opt-out. NULL = active. The gate's atomic test. |
| `dncReason` | Freeform text — e.g., `'customer_request'`, `'ftc-scrub'`, `'admin'`. Not enum-tracked. |
| `dncAddedByUserId` | Who flipped the bit. NULL for system-triggered (webhook, FTC scrub). |

**Triggers + paths:**

| Trigger | Path |
|---|---|
| Customer texts STOP to a CloudTalk DID | CloudTalk auto-honors on its side immediately + fires `sms.received` → app route handler at `api/webhooks/cloudtalk/route.ts` calls `compliance.addToDnc(customerId, reason='cloudtalk_stop', addedByUserId=null)`. CloudTalk already honored on its side; no `dnc-propagation` pushback needed. |
| Customer texts STOP to an in-house Twilio DID | Twilio TwiML handler (`/api/voip/twiml/messaging-inbound`) → `compliance.addToDnc(customerId, reason='customer_request', addedByUserId=null)` → `dnc-propagation.service.ts` pushes to CloudTalk → marks CT contact `opted_out: true`. |
| Admin manual DNC entry | tRPC → `compliance.addToDnc(customerId, reason='admin', addedByUserId=admin.id)` → `dnc-propagation` pushes to CloudTalk. |
| FTC DNC list scrub | Daily cron → in-memory match of FTC list against `customers.phone` → for each match: `compliance.addToDnc(customerId, reason='ftc-scrub', addedByUserId=null)` → `dnc-propagation` pushes to CloudTalk. **Non-matching FTC entries are NOT persisted** — they're only relevant if/when a matching customer row exists (the FTC list is cached for outbound-time double-check on freshly-created customers). |

**Gate consistency rule:** outbound gates (both systems) check `customers.dncOptedOutAt IS NOT NULL` before placing call / sending SMS. `services/compliance/compliance.service.ts#canOutboundTo(phoneE164)` is the single shared gate (resolves phone → customer row → checks the field). CloudTalk Campaign also gates internally (belt-and-suspenders); if our `customers.dncOptedOutAt` and CloudTalk's contact tags ever drift, **our app is authoritative** — fix by re-pushing via `dnc-propagation`.

**Edge case — same phone shared by two customers (couple, family):** the outbound gate queries by phone (`WHERE phone = ? AND dnc_opted_out_at IS NOT NULL LIMIT 1`), so a single opted-out customer row with that phone blocks calls to ANY other customer rows sharing it. Conservative, TCPA-aligned default.

### 6. Graduation event — bidirectional convergence

Graduation is the **only** event that moves a customer out of CT's funnel into our app's `fresh` pipeline (app-owned). It is **2-way synced**: either side may initiate it, but both sides must converge to a consistent end state.

**Convergence service:** `services/voip/campaigns/graduation.service.ts#graduateCustomer(customerId)` is the single function both triggers call. Idempotent — if customer already has `voipCampaignStatus = 'booked'`, no-op.

**Initiator A — App-initiated (the canonical path):**
1. Sean (or admin) creates a meeting in our app via tRPC mutation
2. `meetings.create` post-hook calls `graduateCustomer(customerId)`
3. The service:
   - UPDATEs `customers.voipCampaignStatus = 'booked'`, `voipCampaignGraduatedAt = NOW()`
   - Pushes to CloudTalk: `contacts.untag('Lead' | 'Engaged' | 'Transferred')` + `contacts.tag('Booked')` + (optional) sends final-beat confirmation SMS
4. After this point, ALL further outbound to this customer goes via in-house Twilio (agent-mediated)

**Initiator B — CT-initiated (edge case — admin uses CT dashboard's disposition UI directly):**
1. Admin marks the contact as Booked in CT's dashboard (applies `Booked` tag via CT's UI)
2. CT fires webhook → our route handler at `/api/webhooks/cloudtalk` detects the `Booked` tag transition
3. Handler calls `graduateCustomer(customerId)` (same service function)
4. The service:
   - UPDATEs `customers.voipCampaignStatus = 'booked'`, `voipCampaignGraduatedAt = NOW()`
   - If no `meetings` row exists for this customer: surface UI prompt for Sean to complete meeting details
   - Does NOT push to CT (state already converged from CT's side)

**Why bidirectional matters:** CT is the source of truth for lifecycle state per the Data Ownership Model. But meetings are app-territory. The graduation event crosses the boundary in both directions; either system can validly initiate it, and both must stay consistent.

**Re-enrollment policy:** If a graduated customer's meeting is later canceled, they do **NOT** auto-re-enroll. Admin must explicitly re-enroll via a button on the customer profile (push `not_enrolled → lead` + add CT contact back to campaign). Reasoning: avoid spamming recently-engaged contacts; let humans judge.

**Read-only leads kanban:** A consequence of CT-as-SoT: the leads-pipeline UI (`Pipeline[leads]/Kanban/Customer`) is read-only. User-driven stage transitions are disabled. The ONE manual exception is meeting creation (which triggers graduation above). Admin-only "force opt-out" / "force exhaust" actions may be added later, but they push to CT, never write the local cache directly.

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

**Deleted 2026-05-30** per the total-separation grill. Originally encoded a `source: 'in_house' | 'cloudtalk'` discriminator + forward-compat `cloudtalk_*` columns on `voip_calls` / `voip_messages` / `voip_dids`, plus a separate `voip_dnc` table with `source` reasoning.

The new model:
- voip-in-house owns `voip_calls`, `voip_messages`, `voip_dids`, `voip_link_tokens` — only ever holds in-house rows. No `source` column. No `cloudtalk_*` forward-compat columns.
- voip-campaigns gets its own schema namespace for any CloudTalk-side data it chooses to mirror (e.g., its own `ct_calls`-or-equivalent tables — design TBD in voip-campaigns Phase 1).
- DNC is decorated on `customers` per §5 above. No separate table.
- Customer profile UI that wants to show "ALL interactions with this customer" queries BOTH surfaces and merges client-side or via a thin view layer.

### 9. `lead_sources.voipConfigJSON` shape

Shared config field. Each EPIC owns a sub-object. **`voipConfigJSON` carries APP-side policy only — not CT-runtime identity.**

```jsonc
{
  // voip-campaigns owns:
  "campaigns": {
    // APP-side policy — prescriptive, owned by us, edited via admin UI
    "enabled": true,                    // per-source kill switch (gate 6 in enrollment guardrails §7)
    "autoEnroll": true,                 // bina=true, home_depot=false (manual review per Q9.F)
    "dailyDialVolumeCap": 300,          // soft cap Q11 — admin-tunable
    "messageTemplateOverrides": { ... } // optional per-source SMS template variants
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

#### What this JSON does NOT carry (corrected 2026-05-31)

The following CT-runtime IDs were previously sketched here as `cloudtalkCampaignId` / `cloudtalkVoiceAgentId`. They have been **moved to dedicated DB tables** because they are runtime data discovered from CT's dashboard, not source-of-truth constants:

| Data | Lives in | Sync mechanism |
|---|---|---|
| CT campaign ID + status + membership tag + cadence (10 attempts / 3hr) | `voip_campaigns` table (CT identity bridge — voip-campaigns Phase 1 W2) | Admin-triggered "Resync from CloudTalk" mutation → `GET /campaigns/index.json` → upsert by `source_slug` |
| CT contact attribute IDs (`lead_source`, `primary_trade`, `trades_interested`) + titles | `voip_contact_attributes` table | Same admin Resync → `GET /contacts/attributes.json` → upsert by `app_key` |
| ~~CT VoiceAgent ID~~ | N/A | AI VoiceAgent off the table per 2026-05-27 pivot |

**Separation principle:**
- `voipConfigJSON.campaigns.*` = **APP-side policy** (prescriptive, owned by us, edited via lead-source admin UI). Source-of-truth.
- `voip_campaigns` row = **CT-side identity** (descriptive, mirrored from CT dashboard, synced not edited). Cache.

A lead source has both: one `lead_sources.voipConfigJSON.campaigns` blob (our policy: enabled, autoEnroll, caps) + one `voip_campaigns` row keyed by the matching `source_slug` (CT's identity: campaign_id, membership_tag). Enrollment service consults BOTH: policy gates run against `voipConfigJSON`; CT API calls use IDs from `voip_campaigns`.

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
| `voip.triprosremodeling.com/api/webhooks/cloudtalk` | Async — ONE route handler receives ALL 5 CloudTalk Workflow Automations (`call.started`, `call.answered`, `call.ended`, `call.disposition_set`, `sms.received`). Switch on `event_type` field we inject in each WA's body builder (CT does not inject it natively). | voip-campaigns |
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
