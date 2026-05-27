# voip-campaigns EPIC — CloudTalk-managed lead-to-meeting conversion

> **Status:** Architectural design complete (2026-05-23 grilling session); Phase 0 (CloudTalk procurement + dashboard configuration) not started.
> **Sibling EPIC:** [voip-in-house](../voip-in-house/EPIC.md) — ships first; provides the in-house DIDs that CloudTalk transfers calls to.
> **Cross-system contract:** [INTEGRATION-SEAM.md](../voip/INTEGRATION-SEAM.md) — required reading before touching anything that crosses systems.
> **API research foundation:** [cloudtalk-api-research.md](./cloudtalk-api-research.md) — CloudTalk API patterns, auth, rate limits, quirks. Foundational for `providers/cloudtalk/client.ts`.
> **Pivot history:** [HANDOFF-from-twilio-build.md](../voip/HANDOFF-from-twilio-build.md) — why we abandoned the custom Twilio+Retell+Sendblue lead-conversion build (2026-05-23) and pivoted to CloudTalk.

---

## Relationship to voip-in-house EPIC

This EPIC is one half of the VoIP planning pair. **This EPIC owns**: lead-to-meeting conversion via CloudTalk's managed Campaigns + AI VoiceAgent + the integration code/infrastructure connecting our app to CloudTalk's services. **The other EPIC (voip-in-house) owns**: all other voip — agent comms, inbound IVR, lifecycle SMS, internal-comm, the core `voip_*` tables, the in-house Twilio provider.

**They interact via**: voip routing endpoints (CloudTalk Call Flow HTTP Request → our app), CloudTalk webhooks (CloudTalk → app), DNC propagation (bidirectional), graduation handoff (app → CloudTalk on meeting booked), shared tables (`voip_calls`, `voip_messages`, `voip_dnc` with `source='cloudtalk'` discriminator).

**voip-in-house ships first.** CloudTalk depends on the in-house DIDs + DNC table + voip routing endpoint infrastructure existing before campaigns can launch. During voip-in-house's external vetting clocks (10DLC, Trust Hub) we can configure CloudTalk's dashboard in parallel — code work is sequential, design + procurement work overlaps.

---

## Vision

Tri Pros has thousands of weekly leads. Manual conversion (dialing them, getting them to a meeting) caps at ~100 conversations/day per human and saturates fast. Delegating the *narrow* job of "first dial → confirm interest → warm-transfer" to CloudTalk's purpose-built AI dialer puts that ceiling at 300-500/day at the same labor cost. Critically, the hard parts (cadence design, AI prompt iteration, recording, spam-rotation, voicemail detection) are *CloudTalk's* job — not ours to build.

Our app's job here is the *narrow* glue:
1. Push every new lead into CloudTalk as a contact
2. Consume CloudTalk's outcome webhooks (per-attempt disposition, transfer events, opt-outs)
3. Answer mid-call routing questions via voip routing endpoints
4. Graduate customers out of CloudTalk's domain once a meeting is booked
5. Keep DNC + opt-outs in sync between our app and CloudTalk

Everything else (the cadence cleverness, the AI's conversational ability, carrier reputation maintenance) is bought-not-built.

## Data ownership model — CT is source-of-truth for the pre-meeting funnel

This is foundational. Every downstream architectural decision flows from it.

**Tri Pros will never build the auto-dialer in-house.** Lead-conversion is always delegated to a managed provider (CloudTalk today; could be RingCentral or another in the future). Because the provider executes the cadence + workflows + state transitions, **the provider IS the source of truth for lead lifecycle state in the pre-meeting funnel.** Our app reads that state via webhooks and caches it locally for fast querying, JOIN-ability with our customer data, and outage tolerance.

### The data-flow direction by domain

| Domain | Source of truth | Direction | Mechanism |
|---|---|---|---|
| **Customer identity** (name, phone, email, zip, local TZ) | **Our app** | Our app → CT (push) | `contact-sync.service.ts` writes via Bulks API |
| **Source attribution** (`lead_source_label`, source-specific inquiry context) | **Our app** | Our app → CT (push, immutable per-contact) | Set once during enrollment |
| **Trade interest** (`trades_interested`, `primary_trade_label`) | **Our app** | Our app → CT (push, mutable on attr-sync) | Synced from `customers.tradesInterested` JSONB |
| **Lead lifecycle state** (Lead → Engaged → Transferred → Booked / Exhausted / BadNumber) | **CloudTalk** | CT → our app (webhook push) | Webhook handler writes a denormalized cache row in our DB |
| **Call activity** (calls placed, duration, recording URLs, dispositions, transcripts) | **CloudTalk** | CT → our app (webhook push) | Same webhook handler, populates `voip_calls` rows |
| **Message activity** (SMS sent/received during campaign) | **CloudTalk** | CT → our app (webhook push) | Same webhook handler, populates `voip_messages` rows |
| **DNC / opt-out** | **bidirectional canonical** in `voip_dnc` table | both directions | STOP keyword on CT side → webhook to us; admin/FTC add on our side → push to CT via `dnc-propagation.service.ts` |
| **Post-meeting state** (`customers.pipeline`, project lifecycle, proposal status, project status) | **Our app** | Our app only | CT is out of the loop after the `Booked` tag fires — graduation event hands off ownership |

### Why CT owns lead lifecycle (and not our app)

- **The provider executes the state transitions.** When CT's AI calls a lead and they pick up, CT applies the `Engaged` tag *because CT observed it happen*. Our app would have to infer the state from telemetry — that's strictly less reliable than reading it from the system that performed the action.
- **The lifecycle vocabulary is shaped by the provider's capabilities.** CloudTalk has 6 dispositions; RingCentral might have 8. The provider's vocabulary IS the lifecycle. Forcing our app to define a custom vocabulary that maps "correctly" to whatever provider is plugged in is a constant translation tax.
- **Migration is cheaper when the provider owns its own data.** When we swap to RingCentral, we don't migrate state — we just point the webhook adapter at RC's tag vocabulary and remap to our normalized enum. Our app's lifecycle-reading code doesn't care which provider wrote the cache row.

### What this means for our schema + UI

- **`customers.voipCampaignStatus`** (existing enum) is a **denormalized cache** of CT's tag-driven lifecycle state, normalized to a provider-agnostic enum. **Never the source of truth.**
- **`customers.voipLifecycleTags`** (new JSONB, planned Phase 1) stores the raw CT tag snapshot for debugging + UI granularity.
- **Leads kanban / list UI** reads from the cache. Slight lag (target <5 seconds end-to-end via webhook) is acceptable; no live-state requirement.
- **Daily reconciliation cron is mandatory, not optional.** Polls CT's `contacts.list` + `calls.list` APIs and backfills any drift via idempotent upserts. Detects + alerts on persistent mismatch.

### Provider-agnostic abstraction

Provider-specific tag → normalized enum mapping lives in **the provider's webhook adapter file** (e.g., `providers/cloudtalk/webhooks/lifecycle-mapper.ts`). The rest of our app (queries, UI, services) reads only the normalized state. When the provider changes:
1. New provider client lands at `providers/<new-name>/`
2. New webhook adapter at `providers/<new-name>/webhooks/lifecycle-mapper.ts` maps new vocab → same normalized enum
3. Switch the route handler at `src/app/api/webhooks/<new-name>/route.ts` to import the new adapter
4. Re-point CT's customers to the new provider via a one-shot migration script
5. Everything downstream is unchanged

This is the value the data-ownership model buys.

## Strategic decisions

- **CloudTalk is treated as a provider, not a service.** `providers/cloudtalk/client.ts` is the DAL-equivalent for CloudTalk's API; grouped function modules (`calls.ts`, `sms.ts`, `contacts.ts`, `campaigns.ts`, etc.) provide the surface. Business logic lives in `services/voip/campaigns/` and uses these provider functions.
- **CloudTalk owns the lead-to-meeting funnel; we own everything before (intake) and after (meeting booked onward).** Hard boundary at the "meeting booked" graduation event.
- **CloudTalk's burnable DIDs absorb spam-labeling risk; in-house Tri Pros DIDs stay clean.** Campaign DIDs are walled off in CloudTalk's domain.
- **No formal `VoIPProvider` interface — single-provider commitment to CloudTalk.** Future swap = rewrite `providers/cloudtalk/*` + `services/voip/campaigns/*`. Acceptable cost given CloudTalk's API shape doesn't generalize to other vendors anyway.
- **Campaign cadence + AI prompts + voicemail scripts are CloudTalk-dashboard-managed**, not driven via API. We configure once with the user together using the dashboard during Phase 0, then re-tune as data informs.
- **AI script content is owner-managed**, just like in the deferred Twilio+Retell EPIC. CloudTalk's dashboard is where the user edits the prompts.
- **Phase 1 is AI-outbound + human-receive only. Smart Dialer (human outbound) is deferred.** The AI VoiceAgent does all outbound dialing; the human seat (Sean) is the warm-transfer receive endpoint only. Smart Dialer is a break-glass tool, not a daily workflow. Rationale: AI's behavioral pattern is calibrated for low spam-flag risk; human-paced bursts from Smart Dialer would burn campaign DIDs faster. Smart Dialer becomes the primary outbound mode **only when a human Virtual Assistant is hired** to work leads (see Future enhancements).
- **CloudTalk user roles (Phase 1, the 3 seats provisioned):** `info@` = billing + dashboard admin (no call handling); `oliver@` = dev admin (no call handling); `sean@` = warm-transfer receive seat + break-glass Smart Dialer user.

## Scope

### In scope (~14 scenarios — see [INTEGRATION-SEAM.md](../voip/INTEGRATION-SEAM.md) for the full inventory)

- **A1**: Lead intake → "Want me to call?" initial SMS
- **A2**: Confirmation when lead replies YES
- **A3**: Multi-day AI call + SMS cadence (the conversion campaign)
- **A4 + A5**: Warm-transfer routing → push to agent
- **A6**: Mid-call scheduled callback
- **A7**: Lead calls back the CloudTalk DID we called from (within pre-graduation window)
- **A8**: Final "stop trying?" SMS
- **A9**: Non-YES/NO reply parsing
- **A10**: Meeting-booked confirmation SMS (final campaign beat → graduate)
- **F1**: STOP/opt-out propagation (auto inside CloudTalk + webhook to app)
- **G1 + G2**: Mid-call enrichment (caller-ID lookup + warm-transfer routing voip routing endpoints)
- **Cross-system DNC**: `voip_dnc` is bidirectionally synced
- **Graduation event**: meeting booked → untag + status update

### Out of scope (handled by voip-in-house EPIC)

- All agent-mediated customer comms (H1-H10)
- Inbound main-line + IVR (D1-D8) — that's the in-house Twilio side
- Internal-comm push pipeline (E1-E10)
- Lifecycle SMS post-meeting (B1, B7, B12, C1-C8)
- Tokenized-link sends (L-DOC, L-PAY, L-CAL, etc.)
- Manual click-to-call/SMS (M1, M2)

### Future enhancements (not Phase 1; documented so we don't lose them)

- **Tokenized links in campaign SMS** (e.g., "Want to share photos of your project area?") — strong conversion lever; mint token in our app, set short-lived custom attribute on CloudTalk contact, template merges and CloudTalk sends. Fast-follow after Phase 1 ships.
- **Re-engagement campaign for dormant customers** (180-day cohort)
- **AI prompt A/B testing** via multiple CloudTalk VoiceAgents + enrollment routing to one based on coin flip
- **Cost monitoring / budget alerts** for CloudTalk usage (per-minute, per-message, per-AI-call)
- **Cross-system supervisor scenarios** (manager listening in via CueCard or whisper) — small surface; deferred
- **Human Virtual Assistant outbound via Smart Dialer** — when a human VA is hired to work leads, Smart Dialer becomes the primary outbound mode (β role from grilling). Requires: VA seat provisioning, separate DID pool decision (share with AI or split?), disposition vocabulary alignment with AI VoiceAgent's, separate Campaign(s) configured for VA-driven cadence, possible Smart Dialer ↔ AI VoiceAgent priority routing rules. Track as a follow-up issue once Phase 1 ships and a VA is being onboarded.

---

## Architecture

### Provider layer — `src/shared/services/providers/cloudtalk/`

CloudTalk has no official SDK. We generate a typed client from their OpenAPI spec at https://developers.cloudtalk.io/swagger.json using `@hey-api/openapi-ts`. The client itself is the DAL-equivalent for CloudTalk's API.

```
src/shared/services/providers/cloudtalk/
├── client.ts              ← OpenAPI client wrapper: HTTP Basic auth, base URL switching
│                            (my.cloudtalk.io/api vs platform-api.cloudtalk.io for VoiceAgent/CueCard),
│                            response envelope unwrap, retry with backoff, 60/min rate-limit handling
├── calls.ts               ← grouped fns: list, get, downloadRecording, getTranscript
├── sms.ts                 ← grouped fns: send, list
├── contacts.ts            ← grouped fns: CRUD, tags (add/remove), attributes, activities
├── campaigns.ts           ← grouped fns: enrollContact, untagFromCampaign, listEnrollments
├── voice-agents.ts        ← grouped fns: list (mostly read-only; config via dashboard)
├── bulks.ts               ← grouped fns: batch ops (≤10 per req — used for contact sync efficiency)
├── webhooks/
│   ├── verify.ts          ← shared-secret check (CloudTalk has no HMAC signing)
│   └── types.ts           ← TS types for the 6 documented events
└── generated/             ← @hey-api/openapi-ts output (committed, regenerated on schema update)
```

Reference: [cloudtalk-api-research.md](./cloudtalk-api-research.md) for full API behavior, auth model, quirks (inverted HTTP verbs, `.json` path suffixes, dual hosts, envelope shape).

### Service layer — `src/shared/services/voip/campaigns/`

Business logic for campaign orchestration. Lives as a subdir under the unified `voip/` service tree. Imports `providers/cloudtalk/*` for vendor calls and `services/voip/*` (top-level siblings) for shared logic (DNC, compliance, calls/messages upsert).

```
src/shared/services/voip/campaigns/
├── enrollment.service.ts        ← push contact + add to campaign; gates via voip-compliance + voip-dnc
├── contact-sync.service.ts     ← debounced attribute sync via Bulks; attribute_hash skip-if-unchanged
├── graduation.service.ts        ← meeting booked → untag + status update
└── dnc-propagation.service.ts   ← when we add a DNC entry → push to CT (the reverse — CT → us — lives in the webhook route handler directly)
```

**No `webhook-handler.service.ts`.** Per `docs/codebase-conventions/webhook-routes.md`, the webhook route handler **is** the orchestrator: it verifies the secret, parses the event type, switches on it, and directly composes existing services (`voip-calls`, `voip-messages`, `voip-dnc`, `notifications`). One URL per external source, one switch statement, no wrapper service.

### tRPC + API routes

```
src/trpc/routers/voip-campaigns.router.ts
  ├── enroll(customerId)             ← manual admin enroll
  ├── unenroll(customerId)
  ├── getCampaignStatus(customerId)
  ├── getSyncHealth()                ← admin dashboard data
  └── retryFailedSync(customerId)

src/app/api/webhooks/cloudtalk/route.ts          ← single webhook endpoint, secret-verified; route handler IS the orchestrator (switch on event-type, no wrapper service)
src/app/api/voip/routing/caller-lookup/route.ts  ← voip routing endpoint (synchronous lookup, NOT a webhook — voip-in-house owns impl; Phase 0 is mocked)
src/app/api/voip/routing/transfer-target/route.ts
src/app/api/voip/routing/compliance-check/route.ts
```

### Data model additions

This EPIC introduces a **single new table** + a few customer/lead-source fields. Everything else uses voip-in-house's tables with `source='cloudtalk'`.

```sql
CREATE TABLE voip_contact_sync (
  customer_id uuid PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  cloudtalk_contact_id text UNIQUE NOT NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  attribute_hash text NOT NULL,
  last_sync_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customers ADD COLUMN voip_campaign_status voip_campaign_status_enum DEFAULT 'not_enrolled';
ALTER TABLE customers ADD COLUMN voip_campaign_enrolled_at timestamptz;
ALTER TABLE customers ADD COLUMN voip_campaign_graduated_at timestamptz;

ALTER TABLE lead_sources ADD COLUMN voip_config_json jsonb;  -- shared with voip-in-house (per INTEGRATION-SEAM.md §9)
```

Enum: `voip_campaign_status_enum = ['not_enrolled', 'enrolled', 'graduated', 'opted_out', 'exhausted']`.

**Forward-compat columns** on `voip_calls` + `voip_messages` (`source`, `campaign_id`, `transcript_summary`, `sentiment`, `cloudtalk_call_uuid`, `cloudtalk_message_id`) — these land in **voip-in-house Phase 1 schema** (it ships first); we populate them in our Phase 1.

### CASL abilities

- `VOIP_CAMPAIGN` subject — read/write gated by role:
  - **super_admin**: full access
  - **admin**: enroll/unenroll, view sync health, retry failed sync
  - **agent**: read campaign status of own customers (read-only)

### Customer attribute set pushed to CloudTalk

(See INTEGRATION-SEAM.md §4 for the full sync mechanism.)

**Synced to CloudTalk contact (for Campaign templating + segmentation):**
- `first_name`, `last_name`
- `phone_e164` (primary key in CloudTalk)
- `zip`
- `primary_trade_label` (e.g., "Roofing", "Bathroom Remodel")
- `lead_source_label` (e.g., "Meta - Energy Saver+")
- `pipeline_stage` (`lead` / `fresh` / `active` / `dead`) — drives Campaign segmentation
- `assigned_agent_user_id` (string; we look it up via voip routing to get the actual routing target at runtime)
- `last_interaction_at` (timestamp; helps Campaign exclusion rules)
- `local_tz` (lead's timezone; for calling-hours respect on CloudTalk's side)

**Stays app-side (PII boundary, retrieved via voip routing (mid-call only)):**
- Full notes, financial profile, property profile JSON
- Proposal URLs / line items
- Meeting history details
- Recording URLs (CloudTalk has its own; we link rather than mirror)

---

## Phases

| Phase | Status | Plan | Description | Estimated effort |
|---|---|---|---|---|
| 0 — CloudTalk procurement + dashboard config | Not started | [phase-0-cloudtalk-setup.md](./phase-0-cloudtalk-setup.md) | Account, plan, DIDs, AI VoiceAgent, Campaign config, webhook setup, voip routing fallback branches, API key, test e2e | 1-2 weeks (account approval + dashboard work + design iteration with the user) |
| 1 — App-side integration MVP | Not started | Pending (written when Phase 0 nearing completion) | Generated client + provider modules; webhook handler + reconciliation cron; enrollment service + Bulks sync; voip routing endpoint impls (in voip-in-house); graduation hook; CASL abilities; admin UI feature | 2 weeks |
| 2+ — Refinements | Not started | Future | Tokenized links in campaign SMS, re-engagement campaigns, AI prompt A/B testing, cost monitoring | TBD |

### Inter-phase dependency

```
voip-in-house Phase 1 (in-house DIDs + voip routing infrastructure + voip_* tables)
  └──► voip-campaigns Phase 0 (CloudTalk procurement + dashboard config — can run in parallel with
        voip-in-house Phase 1, since dashboard config doesn't touch code)
        └──► voip-campaigns Phase 1 (integration MVP — gated on both voip-in-house Phase 1 AND
              voip-campaigns Phase 0 complete)
```

---

## Risks

| Risk | Mitigation |
|---|---|
| CloudTalk API outage | Graceful degradation in enrollment + sync services; queue locally; resume on recovery; in-flight CloudTalk-side calls continue regardless |
| Missed webhook | Daily reconciliation cron polling CloudTalk's list APIs; idempotent upserts via UNIQUE keys |
| voip routing endpoint timeout | CloudTalk dashboard Call Flow MUST have fallback branch (mandatory Phase 0 checklist) |
| No webhook signing | Shared-secret + IP allowlist defense-in-depth |
| Rate limit (60/min/company) | Bulks API for batch ops; debounced sync (hourly cron + on-demand for urgent fields); request budget reservation per service |
| Attribute sync drift | `attribute_hash` skip-if-unchanged + hourly reconcile cron + Sentry alert on persistent mismatch |
| Cost surprises | CloudTalk's per-minute + per-message + per-AI-call pricing — monitor in Phase 1+; budget alerts in voip-campaigns admin UI |
| CloudTalk dashboard misconfig (e.g., missing Call Flow fallback branch) | Phase 0 checklist + screenshots + e2e smoke test before launch |

---

## Open questions

1. CloudTalk's actual webhook IP ranges — confirm with support during Phase 0; lock IP allowlist if available
2. Custom-header support on CloudTalk webhooks (alternative to query-string secret to reduce log leakage)
3. AI VoiceAgent transfer mechanics (SIP REFER vs DID re-dial) — confirm during Phase 0 testing; affects how voip-in-house side rings
4. Conversation Intelligence webhook envelope shape — confirm during Phase 0 (Handoff 2 noted it differs from standard envelope)
5. Recording retention policy on CloudTalk side + whether we archive externally — resolve during Phase 0 dashboard review
6. CloudTalk's behavior at 90% rate-limit utilization — measure during Phase 1 load testing
7. Per-source vs unified campaign strategy: one Campaign per lead-source, or one master Campaign with tag-based segmentation? Decision deferred to Phase 0 dashboard design.

---

## Decisions log

### 2026-05-27 — Architectural inversion: CT owns pre-meeting lifecycle as source-of-truth (grill-me session)

**Phase:** 0 (planning) — foundational; affects every downstream decision
**Context:** During the dashboard-config grill-me session (Q4 — tag taxonomy refinement), user surfaced that the prior implicit assumption ("our app's `customers.pipeline` is source-of-truth for lead state") contradicts the locked decision that lead conversion is permanently delegated to a managed provider. If we never build the auto-dialer in-house, the provider IS the system of record for lifecycle state — not our app.

**Decision:** CloudTalk owns the lead lifecycle for the pre-meeting funnel as the canonical source of truth. Our app caches the state via webhook-pushed updates and reads from the cache. Documented in detail in the new "Data ownership model" section at the top of this EPIC.

**Cache strategy (Q4.1): Option A — pure denormalized cache.**
- CT webhooks push lifecycle changes to our `webhooks/cloudtalk/route.ts` handler
- Handler updates `customers.voipCampaignStatus` (normalized enum) + `customers.voipLifecycleTags` (raw CT tag snapshot, JSONB)
- UI / queries / services read from the cache
- Daily reconciliation cron is **mandatory** — polls CT's list endpoints and backfills drift via idempotent upserts
- Slight lag (<5 seconds end-to-end via webhook) is explicitly acceptable; no live-state UI requirement

**Provider-agnostic abstraction:** mapping from provider-specific tags to our normalized enum lives in the provider's webhook adapter (`providers/<name>/webhooks/lifecycle-mapper.ts`). Rest of our app reads only the normalized state. Migration = swap adapter + repoint webhook URL, nothing else.

**Alternatives considered:**
- **B — Read-through (no cache, hit CT API on every read):** rejected. Latency on UI views, rate-limit risk (60/min), brittle (CT outage breaks our leads UI), N+1 problem when JOINing leads with customer data.
- **C — Hybrid (cache lifecycle, read-through for activity history):** rejected for Phase 1. Two integration patterns to maintain; activity-history detail views can be implemented as "fetch on demand" without elevating to a different architectural pattern.

**Impact:**
- **Schema:** `customers.voipLifecycleTags` JSONB column lands in Phase 1 (alongside the existing `voipCampaignStatus` enum)
- **INTEGRATION-SEAM.md:** §2 (webhooks) reframed as the canonical lifecycle feed; §4 (app→CT push surface) narrows to identity + attributes + initial enrollment + DNC propagation; §10 reconciliation cron elevated from "recovery" to "mandatory ongoing"
- **UI:** Leads kanban / list / detail views read from cache; no read-through to CT
- **Code organization:** lifecycle-mapper.ts per provider; webhook handler imports the right mapper based on which provider's route hit it
- **A/B test triggers (revisit):** if cache drift exceeds 2% sustained, evaluate moving to Hybrid (C) with read-through for the affected data class. If migration to a second provider becomes likely (e.g., RingCentral pilot), the abstraction's value gets stress-tested.

**Link:** Grill-me session 2026-05-27 (this commit).

### 2026-05-24 — CloudTalk dashboard config — Q1 + Q2 (grill-me session)

**Phase:** 0 (dashboard configuration)
**Context:** Grilling-me session to lock the operational shape of CloudTalk dashboard configuration before Phase 0 Tasks 4–7. Three foundational decisions made in this turn (AI scope, multi-source segmentation, DID strategy).

**Q1 — AI VoiceAgent scope: A (minimal qualifier).**
- AI's job in the live conversation window (~15–30s): verify person identity, confirm interest, transfer. No discovery, no objection-handling, no meeting-booking.
- AI's broader role: handle cadence execution, voicemail drops, auto-SMS on unanswered calls, status updates, workflow activation. The AI is the *workflow engine*, not the *discovery engine*.
- AI personalization data per call (sourced from contact attributes synced by `contact-sync.service.ts`): `first_name`, `last_name`, `zip`, `primary_trade_label`, `lead_source_label`, plus source-specific inquiry context (campaign-dependent).
- **Alternative considered:** B (mid qualifier with 1–2 discovery questions) and C (full discovery + meeting booking). Both rejected for cost discipline + keeping AI prompt complexity low. B is the deferred-VA candidate when human availability tightens.
- **A/B test triggers (revisit Q1):** if Sean's transferred-call volume scales past ~30/day, evaluate B's incremental cost (~$0.15/call) against the speed-per-call savings on Sean's side. Run two parallel VoiceAgents (A + B) on randomly-assigned cohorts of the same source for 2 weeks to measure conversion delta.

**Q1.context — Multi-source campaign segmentation = per-source Campaigns (not one master Campaign).**
- Each source has semantically distinct "what prompted this call" context. Meta Ads leads → "you reached out about our energy-savings program." Home Depot leads → "you visited Home Depot and gave us your info about [trade]." Cannot share an opener.
- Phase 1 launch sources: **Meta Ads + Home Depot**. Future: Thumbtack, Google (treated as new per-source Campaigns at onboarding time).
- **Alternative considered:** one master Campaign with tag-based opener templating. Rejected — too easy to leak wrong-source context to a lead and lose trust.

**Q2 — DID strategy: A2 (source-segmented pool) + B2 (sticky-per-lead within campaign) + C-all (reactive add-more triggers).**
- **A2 allocation** at 3 DIDs: Meta Ads → 818#1 + 661 (2 DIDs); Home Depot → 818#2 (1 DID). Reputation isolation > round-robin capacity.
- **B2 stickiness:** lead's first call locks them to a specific DID for cadence retries + inbound callbacks during pre-graduation window. Stored as `last_called_did` contact attribute (or via CloudTalk's native sticky-DID feature if available — verify Phase 0).
- **C-all triggers for buying additional DIDs:**
  - C1: Daily call volume per DID > 50 sustained over 1 week
  - C2: Spam-label rate climbs (CT dashboard surfaces this)
  - C3: Inbound callback rate drops on a specific DID
  - C4: New source onboarding (Thumbtack, Google → pre-allocate dedicated DID)
- **DID labels in CT dashboard:** source-prefixed (`meta-ads-1`, `meta-ads-2`, `home-depot-1`). Rename the existing `campaign-pool-{n}` labels now.
- **Alternative considered:** A1 (shared pool) — rejected because it defeats the reputation-isolation rationale for using CloudTalk DIDs at all. A3 (hybrid) — rejected as premature operational complexity at 3-DID scale.
- **A/B test triggers (revisit Q2):** if Meta Ads pool DID #1 reputation degrades faster than DID #2, that's signal the dial-mix or cadence differs between them — investigate before adding capacity. Also: when 4th DID is bought, eval whether to give Home Depot a 2nd DID (volume-driven) vs pre-allocate to Thumbtack onboarding.

**Impact:**
- Phase 0 dashboard config: 2 Campaigns to set up (Meta Ads, Home Depot), each with its own DID pool, AI VoiceAgent linked, source-specific SMS templates + opener prompts.
- Phase 1 services: `enrollment.service.ts` tags contacts with `Source:MetaAds` or `Source:HomeDepot` (Q4 will lock tag scheme); routes to the right Campaign via tag.
- DID acquisition: deferred until C-trigger fires. No 4th DID purchase yet.

**Link:** Grill-me session 2026-05-24 (this commit).

### 2026-05-24 — Phase 1 scope: AI-outbound + human-receive only; VA Smart Dialer deferred

**Phase:** 0 (planning); affects Phase 1 implementation scope
**Context:** Grilling session surfaced that the Expert pricing plan + 3 CloudTalk users provisioned (`info@`, `oliver@`, `sean@`) created ambiguity about whether the human seat would also do outbound power-dialing via Smart Dialer. The locked plan had only documented AI VoiceAgent outbound + warm-transfer to in-house Twilio DID.
**Decision:** Phase 1 is **α-only** — AI VoiceAgent does all outbound; Sean's seat is the warm-transfer receive endpoint (plus break-glass Smart Dialer for special cases, not daily workflow). The β role (human-driven Smart Dialer outbound as primary mode) is deferred until a human Virtual Assistant is hired.
**Alternative considered:** α + β (both AI outbound + human power-dialer outbound simultaneously). Rejected because human-paced bursts from Smart Dialer would burn campaign DIDs faster than the AI's calibrated behavior pattern, and duplicating outbound effort dilutes the AI's ability to learn cadence-per-source.
**Impact:** No code or schema changes; affects Campaign configuration in Phase 0 (only one Campaign per source needed, not two); confirms 3-user split per role; adds Future-enhancements item for VA onboarding.
**Link:** Grilling session 2026-05-24 (this commit).

### 2026-05-23 — voip-campaigns EPIC created, split from former monolithic auto-dialer EPIC

**Context:** Mid-grilling-session on the deferred Twilio+Retell+Sendblue auto-dialer Phase 1A, user decided to delegate lead-to-meeting conversion entirely to CloudTalk and keep the rest of VoIP in-house. The former auto-dialer EPIC's content split into two: the conversion campaign part is this EPIC (voip-campaigns); the in-house comms part is [voip-in-house EPIC](../voip-in-house/EPIC.md).

**Decision:** Two separate sibling EPICs with shared infrastructure (umbrella subdomain, integration seam contract, shared `voip_*` tables in voip-in-house's domain with `source` discriminator, single `voip/` service tree with `campaigns/` subdir).

**Rationale:** Walled-off campaign DIDs absorb spam-labeling risk; in-house DIDs stay reputation-clean for the relationship side of the business. CloudTalk is purpose-built for the narrow conversion job. Custom build saves nothing because the hard parts (cadence, AI quality, spam-rotation) are CloudTalk's job in either model.

**Link:** This commit + [HANDOFF-from-twilio-build.md](../voip/HANDOFF-from-twilio-build.md)

### Template entry

```
### YYYY-MM-DD — <Short title>

**Phase:** <which phase>
**Context:** <what surfaced this decision>
**Decision:** <what we chose to do>
**Alternative considered:** <what we rejected and why>
**Impact:** <which files / phases affected>
**Link:** <PR/commit SHA>
```

---

## References

- **API research:** [cloudtalk-api-research.md](./cloudtalk-api-research.md)
- **Phase 0 plan:** [phase-0-cloudtalk-setup.md](./phase-0-cloudtalk-setup.md)
- **Integration contract:** [../voip/INTEGRATION-SEAM.md](../voip/INTEGRATION-SEAM.md)
- **Pivot history:** [../voip/HANDOFF-from-twilio-build.md](../voip/HANDOFF-from-twilio-build.md)
- **Sibling EPIC:** [../voip-in-house/EPIC.md](../voip-in-house/EPIC.md)
- **Related ADRs:**
  - [ADR-0003 — Service/provider architecture](../../adr/0003-service-provider-architecture.md) — pattern this EPIC follows
- **Related memory:**
  - `memory/project-voip-campaigns.md`
  - `memory/project-voip-in-house.md`
  - `memory/pattern-push-notifications.md`
