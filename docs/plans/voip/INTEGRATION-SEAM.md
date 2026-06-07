# VoIP Integration Seam — Contract Between voip-in-house and voip-campaigns

> **Read this when touching anything that crosses between the in-house Twilio VoIP system and the CloudTalk Campaigns system.** Changes here affect both EPICs. If you change a contract field below, update both sides simultaneously.

## What this doc is

A single source of truth for the contract between the two sibling VoIP EPICs. Each EPIC implements its own side of this contract; this doc says what each side has to honor.

## System boundary

- **voip-in-house** (Twilio-backed): owns the `voip_*` database tables (calls, messages, dids, dnc, user_availability, etc.), the `services/voip/` umbrella, the `providers/twilio/` provider, the browser softphone widget, the agent-comm UX surface, the inbound main-line IVR.
- **voip-campaigns** (CloudTalk-backed): owns the `services/voip/campaigns/` subdir (orchestration only; no separate DAL), the `providers/cloudtalk/` superset-client provider, and its own tables (`voip_campaigns`, `voip_contact_attributes`, `voip_campaign_contacts`), plus the CloudTalk-side Campaign dashboard config. _(Corrected 2026-06-04 — perfect separation: NO `customers.voipCampaignStatus` (deleted), NO CloudTalk-shadow rows in `voip_calls`/`voip_messages`, NO `source` discriminator, NO `voip_dnc` table (DNC is 3 fields on `customers`). CloudTalk owns lifecycle; we persist only CT identity bridges + per-customer participation (`voip_campaign_contacts`) + shared DNC on `customers`.)_

## Data ownership model — the provider is the source of truth for the pre-meeting funnel

**Foundational architectural decision (2026-05-27):** Tri Pros will never build the auto-dialer in-house. Lead conversion is permanently delegated to a managed provider (CloudTalk today; potentially a different provider tomorrow). Therefore, **the provider IS the source of truth for lead lifecycle state** in the pre-meeting funnel. Our app reads via webhooks and maintains a denormalized cache.

| Data class | Source of truth | Direction | Mechanism |
|---|---|---|---|
| **Lead lifecycle state** (Lead → Engaged → Transferred → Booked / Exhausted / BadNumber) | **Provider (CloudTalk)** | CloudTalk-only | **NOT mirrored in our DB** (perfect separation, 2026-06-04). CT owns the lifecycle *and* its own pipeline tags. We persist only campaign *membership* in `voip_campaign_contacts` (enrolled vs unenrolled + reason). Any in-app lead view reads CT on demand (reconciliation §10) — there is no local status cache. The former `customers.voipCampaignStatus` enum was deleted. |
| **Call + message activity** (durations, recordings, dispositions, transcripts) | **Provider (CloudTalk)** | read on demand | **NOT shadowed.** No `voip_calls` / `voip_messages` rows for CT activity, no `source` discriminator. Re-queried live via CT's API (`cloudtalkClient.listCalls` / `getCall`) for admin tooling only (§8). |
| **Customer identity** (name, phone, email, zip, local TZ) | **Our app** | us → provider (push) | At enroll: `enrollment.service.ts` → `cloudtalkClient.upsertContact`. Ongoing attribute drift: attribute-sync (**PLANNED — not yet built**; the `attribute_hash` skip-mechanism on `voip_campaign_contacts` exists for it). |
| **Source attribution** (`lead_source`, source inquiry context) | **Our app** | us → provider (push at enrollment) | `enrollment.service.ts` via `buildContactAttributes` (custom attribute IDs from `voip_contact_attributes`). |
| **Trade interest** (`trades_interested`, `primary_trade`) | **Our app** | us → provider | At enroll via `enrollment.service.ts`; ongoing drift via attribute-sync (**PLANNED**). |
| **DNC / opt-out** | **Our app** (canonical) | app-canonical | Canonical = 3 fields on the `customers` row (`dnc_opted_out_at` / `dnc_reason` / `dnc_added_by_user_id`), enforced by `complianceService`. We do **NOT** push DNC to CT as tags. CT auto-honors STOP on its own side for STOP-to-a-CT-DID; an enrolled contact that becomes DNC is pulled via `unenroll(reason='opted_out')`. See §5. |
| **Post-meeting state** (`customers.pipeline` for `fresh`/`active`/`dead`, project lifecycle, proposal status) | **Our app** | our-app-only | Provider is out of the loop after `Booked` tag fires; graduation event hands off |

**Reconciliation cron is mandatory, not optional.** Daily polling of provider's list endpoints + idempotent upserts catches missed webhooks + drift. See §10.

**Provider abstraction layer:** under perfect separation we do NOT map CT dispositions/tags into a local lifecycle enum (there is none). The only mapping we keep is **CT terminal disposition → our `unenroll` reason**, a pure helper at `services/voip/campaigns/lib/unenroll-reason.ts` (`ctDispositionToUnenrollReason`). (The former `providers/cloudtalk/webhooks/lifecycle-mapper.ts` was deleted 2026-06-04.) Migration to a new provider = swap the provider client + webhook adapter + repoint the webhook URL.

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

**Architecture rule:** the route handler at `src/app/api/webhooks/cloudtalk/route.ts` **IS** the orchestrator. It verifies the secret (`cloudtalkClient.verifyWebhookSecret`), parses the `event_type` field, switches on it, and **directly composes existing services** — `complianceService.addToDnc` + `campaignEnrollmentService.unenroll` + a cosmetic `notifyLastInteractingAgentJob`. No dedicated webhook-handler service; **no shadow-row writes**. See `docs/codebase-conventions/webhook-routes.md`.

Under perfect separation (2026-06-04) the handler persists exactly **two** things: **DNC** and **unenroll**. CloudTalk owns everything else.

| Our `event_type` | CT Object + Action | Route handler action | Status |
|---|---|---|---|
| `call.started` | Call + Started | no-op | Ring-1 no-op. Ring-2: attempt counting. |
| `call.answered` | Call + Answered | no-op | Ring-1 no-op. (Engagement is a CT-owned tag — we do NOT swap it.) |
| `call.ended` | Call + Ended | no-op | Ring-1 no-op. **Ring-2 (PLANNED):** count outbound `call.ended` into `voip_campaign_contacts.dial_attempts`; when `attempts_per_contact` is reached, app-side `unenroll`/`cadence_exhausted` (CT fires no exhausted webhook). |
| `call.disposition_set` | Call + Modified | `ctDispositionToUnenrollReason(disposition)`; if terminal → resolve customer by `contact_id` → `unenroll(reason)` (+ `addToDnc` when reason is `opted_out`). | **Live.** Non-terminal → keep dialing. `Call.Modified` also fires for tag/note edits → guarded by the disposition→reason map returning null. |
| `sms.received` | Messages + Received | If `isStopKeyword(text)` → resolve customer by phone → `addToDnc(reason='stop_keyword')` + `unenroll(reason='opted_out')`. Else → dispatch cosmetic `notifyLastInteractingAgentJob`. | **Live.** SMS row NOT persisted (CT keeps it — §8). |

**Removed from prior 6-event design (2026-05-31):**
- ~~`call.missed`~~ — CT does not separate; `Call.Ended` handler derives from metadata.
- ~~`voicemail.received`~~ — same: `Call.Ended` handler derives `voicemail` status from `is_voicemail` flag. Inbound VM notification is a downstream side-effect, not a separate event.

**Deferred (not Phase 1):** `Messages.Sent` (delivery tracking), `Call.Ringing on agent`, `Call.Survey filled`, `Contact.*`, `User.*`, `Recording.*`, `Transcription.*`.

**Idempotency:** there are no shadow rows to dedupe against. Instead each handled action is itself idempotent — `unenroll` no-ops when there's no active enrollment (and `addToDnc` no-ops when `dnc_opted_out_at` is already set). Re-delivery of the same event therefore converges to the same state.

### 3. Webhook security

CloudTalk has NO documented webhook signing (no HMAC). Required defense-in-depth:

1. **Shared-secret query param:** webhook URL is `voip.triprosremodeling.com/api/webhooks/cloudtalk?secret=<long-random>`. Secret stored in env `CLOUDTALK_WEBHOOK_SECRET`. The route handler at `src/app/api/webhooks/cloudtalk/route.ts` verifies before any service call.
2. **IP allowlist (if available):** confirm during voip-campaigns Phase 0 with CloudTalk support — do they publish static webhook IP ranges? If yes, allowlist at Vercel edge via `CLOUDTALK_WEBHOOK_IP_ALLOWLIST`.
3. **Rate limiting at edge:** Vercel handles default; tighten if abuse observed.
4. **Handler-failure policy:** once secret + envelope are valid, return **200 always** — even if a switch-arm's service call throws (the handler wraps the dispatch in try/catch and logs). Reasoning: CloudTalk's retry semantics are undocumented (Phase 0 finding); avoid a retry storm against a broken handler. The reconciliation cron (§10, PLANNED) catches missed events idempotently. Durable record today is `console.error` only — Sentry is not yet provisioned and there is **no** `voip_webhook_errors` table (a persisted error log is PLANNED).

### 4. App → CloudTalk push surface

Our app pushes to CloudTalk via `cloudtalkClient` (the superset client). All writes go through `services/voip/campaigns/*`. **We only ever write the per-source membership tag** (add on enroll, remove on unenroll) and contact attributes — we do NOT push lifecycle tags (`Lead`/`Engaged`/`Exhausted`/`Booked`/`DoNotCall`); CloudTalk owns those.

| Operation | Service | Provider call(s) | Trigger | Status |
|---|---|---|---|---|
| Enroll lead in campaign | `enrollment.service.ts#enroll` | `cloudtalkClient.upsertContact()` + `addTags([campaign.ctMembershipTag])` (membership tag only). CT auto-includes the contact in the matching Campaign because the Campaign filters by that ONE tag. Then writes the `voip_campaign_contacts` row. **Writes nothing to `customers`.** | Passes the 6-gate chain (§7). | **Live** |
| Unenroll (the ONE exit op) | `enrollment.service.ts#unenroll` | `cloudtalkClient.removeTags([campaign.ctMembershipTag])` + `markUnenrolled(reason)` on `voip_campaign_contacts`. Idempotent (no active enrollment → no-op). | One of 4 reasons: `graduated` (meeting booked) · `opted_out` (STOP/DNC) · `disqualified` (bad lead) · `removed` (neutral, re-enrollable). Reachable from app meeting-create, CT webhook, and UI. | **Live** |
| Sync contact attributes (drift) | attribute-sync (name TBD) | `cloudtalkClient.updateContactAttributes()` / `bulkContacts()` gated on `voip_campaign_contacts.attribute_hash` delta | Debounced/cron when a synced attribute drifts | **PLANNED — not yet built** |
| Resync CT campaign + attribute IDs | `campaign-sync.service.ts#resyncFromCloudtalk` | `cloudtalkClient.listCampaigns()` + `listContactAttributes()` → upsert `voip_campaigns` + `voip_contact_attributes` | Admin-triggered "Resync from CloudTalk" button | **Live** |

There is **no** `Engagement transition`, `Cadence exhaustion → tag swap`, `graduation.service.ts`, or `dnc-propagation.service.ts` push — all four described a lifecycle-tag-pushback model that perfect separation removed. Graduation = `unenroll(reason='graduated')` (§6). Cadence exhaustion = app-side `unenroll` (ring-2, §2). DNC stops an enrolled contact via `unenroll(reason='opted_out')`, not a `DoNotCall` tag (§5).

### 5. DNC propagation

DNC is a **shared canonical fact decorated on the `customers` row** (3 nullable fields). No separate `voip_dnc` table. Both EPICs gate against the same fields. Owning service: `src/shared/services/voip/compliance.service.ts` (`complianceService`). **We do NOT push DNC to CloudTalk as a tag** — the canonical DNC field + the shared outbound gate IS the mechanism; an enrolled contact that becomes DNC is pulled from the live campaign via `unenroll(reason='opted_out')`.

**Customer-row DNC fields:**

| Column | Meaning |
|---|---|
| `dncOptedOutAt` | Timestamp set at opt-out. NULL = active. The gate's atomic test. |
| `dncReason` | One of `DncReason`: `'customer_request'` · `'stop_keyword'` · `'admin'` · `'ftc'` (typed in `compliance.service.ts`). |
| `dncAddedByUserId` | Who flipped the bit. NULL for system-triggered (webhook, FTC scrub). |

**Triggers + paths:**

| Trigger | Path |
|---|---|
| Customer texts STOP to a CloudTalk DID | CloudTalk auto-honors on its side immediately + fires `sms.received` → route handler calls `complianceService.addToDnc({ customerId, reason: 'stop_keyword', addedByUserId: null })` **+ `unenroll(reason='opted_out')`** to pull them from the live campaign. No tag pushback. |
| Customer texts STOP to an in-house Twilio DID | Twilio inbound-SMS handler → `complianceService.addToDnc({ customerId, reason: 'stop_keyword' })` + (if enrolled) `unenroll(reason='opted_out')`. **(voip-in-house Twilio SMS handler is PLANNED.)** |
| Admin manual DNC entry | tRPC → `complianceService.addToDnc({ customerId, reason: 'admin', addedByUserId: admin.id })` + (if enrolled) `unenroll(reason='opted_out')`. |
| FTC DNC list scrub | Daily cron → match FTC list against `customers.phone` → `complianceService.addToDnc({ customerId, reason: 'ftc' })`. **PLANNED — `complianceService.ftcScrubBatch` is a gated stub (Phase 2+, blocked on FTC SAN).** Non-matching FTC entries are NOT persisted. |

**Gate consistency rule:** outbound gates (both EPICs) call `complianceService.canOutboundTo(phoneE164)` before placing a call / sending SMS — it resolves phone → customer row → checks `dnc_opted_out_at IS NOT NULL`. CloudTalk's Campaign also auto-honors STOP internally (belt-and-suspenders); **our app is authoritative**.

**Edge case — same phone shared by two customers (couple, family):** the outbound gate queries by phone (`WHERE phone = ? AND dnc_opted_out_at IS NOT NULL LIMIT 1`), so a single opted-out customer row with that phone blocks calls to ANY other customer rows sharing it. Conservative, TCPA-aligned default.

### 6. Graduation event — bidirectional convergence

Graduation is the **only** event that moves a customer out of CT's funnel into our app's normal post-meeting flow. It is just the `graduated` flavor of the single exit op — there is no separate graduation service and no status column.

**Convergence op:** `campaignEnrollmentService.unenroll(ctx, { customerId, reason: 'graduated' })`. Idempotent — no active enrollment → no-op. Removes the membership tag on CT + marks `voip_campaign_contacts.unenrolled_at` / `unenroll_reason`.

**Initiator A — App-initiated (the canonical path):**
1. Sean (or admin) creates a meeting in our app
2. The meeting entity's server spec post-create hook dispatches `graduateFromCampaignJob` (`entities/meetings/lib/server-spec.ts`)
3. The job calls `unenroll(reason='graduated')` → CloudTalk stops dialing because the contact leaves the campaign's membership tag
4. After this point, all further outbound goes via in-house Twilio (agent-mediated)

**Initiator B — CT-initiated:**
1. CT agent/admin sets a `meeting_booked` disposition on the call
2. CT fires `call.disposition_set` → route handler maps it via `ctDispositionToUnenrollReason` → `unenroll(reason='graduated')`
3. No meeting row is auto-created — booking the meeting in-app remains the human step

**Why this works without a status column:** CT owns lifecycle; we own *membership*. "Graduated" is simply "we removed them from the campaign because a meeting happened." The meeting itself lives in the `meetings` table (app-territory) and drives the normal derived customer pipeline.

**Re-enrollment policy:** A graduated customer does **NOT** auto-re-enroll. Admin re-enrolls explicitly via the customer-profile button (`enroll`), which reuses the same `voip_campaign_contacts` row (and the same CT contact id). Reasoning: avoid spamming recently-engaged contacts; let humans judge.

**Leads view:** CT owns the lead lifecycle, so any in-app leads view is read-only with respect to lifecycle state (it reads from CT, not a local cache). The manual app actions are enroll / unenroll (the 4 reasons), not stage edits.

### 7. Pre-enrollment guardrails

Enforced in `services/voip/campaigns/enrollment.service.ts#enroll` (pure predicates in `lib/eligibility.ts`) before pushing to CloudTalk. The actual 6-gate chain, in order — first failure short-circuits with a typed `EnrollmentRejectReason`:

```
1. source enabled         isSourceEnabled(policy)                 ← per-source kill switch (voipConfigJSON.campaigns.enabled)
2. dialable campaign      isCampaignDialable(campaign)            ← campaign bound to a source AND ctStatus === 'active'
3. pre-meeting lead       isCustomerInLeads(customerId)           ← only top-of-funnel (derived pipeline; DB read)
4. DNC                    isDncBlocked(customer)                  ← customers.dncOptedOutAt IS NULL
5. usable phone           normalizeToE164(customer.phone)         ← forms a plausible E.164, else reject
6. not already enrolled   findActiveEnrollment(customerId)        ← no active voip_campaign_contacts row (no double-enroll)
```

No status-based gate exists — "already enrolled" is "an active `voip_campaign_contacts` row exists (row present AND `unenrolled_at IS NULL`)", not a `voipCampaignStatus` check.

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

> **Reconciliation is mandatory infrastructure once shipped, not a recovery-only mechanism.** CloudTalk owns lifecycle and webhook delivery is best-effort, so our *membership* records (`voip_campaign_contacts`) and synced attributes can drift from CloudTalk. A periodic reconciliation pass corrects them. **The reconciliation crons in this table are PLANNED — not yet built** (ring-2+). Note there is no *lifecycle status cache* to reconcile (CT owns lifecycle); reconciliation only touches membership, attributes, and DNC honoring. Treat the cron as load-bearing once shipped — alert if it fails >2 consecutive runs.

| Failure | Detection | Recovery |
|---|---|---|
| CloudTalk API outage (5xx, timeouts) | provider client exhausts its retry budget; logged via `console.error` (Sentry not yet provisioned; there is **no** `voip_webhook_errors` table) | `enroll` returns a typed `ct_api_failure` reject; `unenroll` deliberately does NOT mark unenrolled on a failed `removeTags` (retryable) → admin re-runs. (Local queueing + admin banner: PLANNED.) |
| Missed webhook (CloudTalk → app) | daily reconciliation cron (**PLANNED**): `cloudtalkClient.listContacts` / `listCalls` since last_24h → diff CT membership tags against `voip_campaign_contacts` | Re-pull from CT (provider is SoT). Nothing to upsert into a local status (none exists) — only membership + attributes are reconciled. |
| Membership / tag drift (webhook missed AND reconciliation missed) | weekly deep cron (**PLANNED**) walks all active `voip_campaign_contacts` vs CT membership tags; flags >2% mismatch | Re-pull from CT; escalate if drift persists (likely WA config issue). |
| voip routing endpoint timeout (our app slow) | CloudTalk's HTTP Request times out (configured 5s); falls back per dashboard branch | Dashboard fallback branch records the failure + may play "we'll call you back". |
| Attribute sync drift | hourly cron (**PLANNED**) compares `voip_campaign_contacts.attribute_hash` against current customer attributes; mismatch → re-push | Push deltas via `updateContactAttributes` / `bulkContacts`; alert if persists >2h. |
| DNC honoring drift | reconciliation ensures any DNC'd customer is no longer actively enrolled (and CT auto-honors STOP on its own side) | App is canonical; pull the contact via `unenroll(reason='opted_out')`. We do NOT push a `DoNotCall` tag. |
| Twilio outage (in-house) | provider client retry budget exhausted (Sentry not yet provisioned) | In-house outbound queues; agent UI shows degraded banner. CloudTalk's campaign dialing is independent of Twilio and continues. |

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
