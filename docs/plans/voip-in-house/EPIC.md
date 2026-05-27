# voip-in-house EPIC — In-house Twilio VoIP for All Comms EXCEPT Lead Conversion

> **Status:** ACTIVE — Phase 0 substantially complete (Twilio + Trust Hub + 10DLC + 3 DIDs procured; 10DLC Campaign still vetting); Phase 1 ready to start.
> **Sibling EPIC:** [voip-campaigns](../voip-campaigns/EPIC.md) — CloudTalk-managed lead-to-meeting conversion. Ships **after** this EPIC because CloudTalk depends on the in-house DIDs + DNC table + voip routing endpoints existing.
> **Cross-system contract:** [INTEGRATION-SEAM.md](../voip/INTEGRATION-SEAM.md) — required reading before touching anything that crosses systems.
> **Pivot history:** [HANDOFF-from-twilio-build.md](../voip/HANDOFF-from-twilio-build.md) — the 2026-05-23 split: AI-dialer/lead-conversion ⇒ voip-campaigns; everything else ⇒ this EPIC.
> **Aborted implementation work:** git branch `archive/twilio-build-aborted` (5 commits, not merged) holds the original Phase 1A attempt for the *combined* AI-dialer + in-house build. Reference only.

---

## Relationship to voip-campaigns EPIC

This EPIC is one half of the VoIP planning pair.

**This EPIC owns**: every VoIP touchpoint EXCEPT lead-to-meeting conversion campaigns — agent-mediated customer comms (replacing personal cells), inbound main-line + IVR + voicemail, internal-comm push pipeline, transactional lifecycle SMS (meeting reminders, proposal links, project status, project lifecycle), one-off agent click-to-call / send-SMS, browser softphone widget, mobile (cellular) transfer mode, tokenized-link sends (doc upload, payment, reschedule, e-sign), opt-out compliance, and the core `voip_*` database tables.

**The other EPIC ([voip-campaigns](../voip-campaigns/EPIC.md)) owns**: lead-to-meeting conversion via CloudTalk's managed Campaigns + AI VoiceAgent.

**They interact via**: voip routing endpoints (CloudTalk Call Flow HTTP Request → our app — we **implement** these endpoints in `services/voip/voip-routing.service.ts`), CloudTalk webhooks (we **consume** via voip-campaigns service), DNC propagation (bidirectional through `voip_dnc`), graduation handoff (`meetings.create` → push to CloudTalk via voip-campaigns service), shared tables (`voip_calls`, `voip_messages`, `voip_dnc` with `source='in_house' | 'cloudtalk'` discriminator — schemas live here; voip-campaigns populates `cloudtalk` rows).

**This EPIC ships first.** voip-campaigns depends on infrastructure delivered here.

---

> **What this is:** The front door for the in-house VoIP initiative. Tracks vision, phase status, decisions made *during* implementation, open questions, and links to artifacts.
>
> **Distinction from related docs:**
> - **Original design spec** (`docs/superpowers/specs/2026-05-21-ai-dialer-design.md`) — frozen historical snapshot from when this EPIC was the *combined* "AI-dialer + in-house" build. Much of it is now under voip-campaigns; the in-house-specific bits remain valid context.
> - **ADRs** (`docs/adr/`) — single-decision records. This EPIC references ADR-0002 (entity server system) and ADR-0003 (service/provider architecture).
> - **Integration seam** ([`../voip/INTEGRATION-SEAM.md`](../voip/INTEGRATION-SEAM.md)) — cross-system contract; load-bearing.
> - **Phase plans** (`./phase-N-*.md`) — actionable, task-by-task implementation plans.
> - **This EPIC** — living glue. Read first to understand "where are we, why."

---

## Vision

Tri Pros agents currently communicate with customers via their **personal cellphones**. The office "main line" is a single physical cellphone. There's no centralized log, no routing, no shared SMS thread, no recordings, no privacy boundary (customers learn the agent's personal number; when an agent leaves, the customer loses contact). This EPIC builds the in-house Twilio-backed VoIP layer that hosts every communication touchpoint except lead-to-meeting conversion — agent ↔ customer, agent ↔ agent, inbound IVR, lifecycle SMS, tokenized link sends, project comms, internal-comm push notifications. It also provides the landing infrastructure (clean Tri Pros DIDs, voip routing endpoints, DNC table) that CloudTalk-side lead conversion warm-transfers and gates against.

The architectural payoff:
- **Centralized control + audit trail** — every call/SMS lives in our `voip_*` tables with full join-ability to customer + project state
- **Clean Tri Pros DIDs** — each agent gets a Tri Pros-branded DID; customers learn that number, not the agent's personal cell
- **Agent continuity** — when an agent leaves or rotates, their DID can be reassigned without customer-visible churn
- **Privacy** — agent personal cellphones stay private
- **Receives lead conversion handoffs** — CloudTalk warm-transfers land on our DIDs; from that point on, the customer relationship lives here

## Strategic decisions

- **Vendor: Twilio** for VoIP backbone + SMS messaging. Most mature browser softphone SDK; Trust Hub for STIR/SHAKEN A-attestation; mature webhook lifecycle.
- **No formal `VoIPProvider` interface — single-provider commitment to Twilio.** Future swap (e.g., Telnyx for cost) = rewrite `providers/twilio/*` + update services that touch it. Acceptable cost; matches the locked thin-façade decision in [voip-campaigns/EPIC.md](../voip-campaigns/EPIC.md).
- **Mobile = cellular routing, not browser WebRTC.** iOS Safari + PWA can't reliably handle WebRTC when backgrounded/locked, and lacks CallKit-equivalent native UI. PSTN call to agent's cell; PWA only handles dashboard/dispositions.
- **Browser softphone for desktop mode** via Twilio Voice JS SDK.
- **Sticky DID-per-agent (NO `customers.assignedAgentUserId` field).** Customer↔agent association is implicit via which agent DID the customer has interacted with. Customer calls back the DID that called them → routes to that agent. No assignment-state table needed.
- **AI script content is owner-managed** — applies to any future AI-mediated in-house comms (e.g., meeting confirmation calls). Per-source templates editable via UI; no system-enforced disclosure language. (Most AI-mediated work is in voip-campaigns; this EPIC's AI usage is minimal.)
- **Tokenized-link sends pattern** — agent triggers SMS containing a single-use, short-lived (default 48h TTL) URL that opens a flow in our app (doc upload, payment, reschedule, e-sign). Generic pattern; first use case in Phase 1 is document upload (L-DOC).
- **DNC + opt-outs canonical in `voip_dnc`** — both this EPIC and voip-campaigns gate against the same table. STOP replies from either side write here.
- **Forward-compat schema for voip-campaigns** — `voip_calls` and `voip_messages` schemas include nullable columns (`cloudtalk_call_uuid`, `campaign_id`, `transcript_summary`, `sentiment`, etc.) populated only by voip-campaigns' webhook handler. Documented in DOCS.md.
- **Two parallel kill switches** — `app_settings` row `feature='voip-in-house'` has a `globalKillSwitch` that halts in-house outbound; voip-campaigns has its own. Emergency-stop = toggle both + pause campaigns in CloudTalk dashboard. Master-kill button is a Phase 2+ enhancement.

---

## Spam mitigation strategy — light-touch for in-house DIDs

**In-house DIDs are low-volume + agent-mediated** — each agent DID places at most a few dozen calls/SMS per day, with high answer rates (customers expect the call) and human-shaped conversation patterns (long durations, no bursts). They are NOT the high-volume conversion DIDs. **High-volume campaign DIDs live in CloudTalk** (voip-campaigns EPIC) and absorb the spam-labeling risk there.

For in-house DIDs, we want:

| Layer | When | Cost | Effort |
|---|---|---|---|
| **L1 — Free baseline**: CNAM + FreeCallerRegistry + Nomorobo + behavioral hygiene | Phase 0 | Free | 1hr setup + 2-4 week vetting clock |
| **L2 — Per-DID light monitoring**: track per-DID call count + complaint count in `voip_dids`; auto-alert if a DID is flagged | Phase 1-2 | Free | Built into schema |
| **L3 — Branded display** (optional, post-launch): Hiya Connect or Verizon BCID — only if observed answer rate <40% on in-house DIDs after FCR vetting completes (unlikely; in-house DIDs are expected to maintain reputation easily) | Phase 3+ trigger | $29-500/mo Hiya | 1-2 weeks setup |

**The aggressive 5-layer mitigation stack from the original combined EPIC (DID pool warming, daily caps, automated cooldown, Voice Integrity) is now CloudTalk's concern** — campaign DIDs need that. In-house DIDs don't dial at volumes that trigger the threat model.

**Forward-looking signal:** Verizon BCID went live Sept 2025. If sustained answer rate ever drops on in-house DIDs, evaluate Hiya Connect + Verizon BCID. Not anticipated in pilot.

---

## Phase status

| Phase | Status | Plan | Notes |
|---|---|---|---|
| 0 — External setup (Twilio + DIDs + Trust Hub + 10DLC + DNC + webhook subdomain) | **Substantially complete (2026-05-22)** — Campaign vetting still running; FCR vetting still running; both background, don't block Phase 1 design | [phase-0-setup.md](./phase-0-setup.md) | Retell + Sendblue dropped from Phase 0 (per pivot); subdomain renamed `dialer.` → `voip.triprosremodeling.com` |
| 1 — MVP: softphone + voice + SMS foundation + tokenized-link sends + voip routing endpoints + DNC + kill switch | **Ready to start (2026-05-23 descope rewrite complete)** | [phase-1-mvp.md](./phase-1-mvp.md) — rewritten to reflect in-house-only scope (37 tasks) | 2-3 weeks |
| 2 — Lifecycle SMS automation + FTC DNC scrub cron + recording auto-delete | Not started | [phase-2-lifecycle-automation.md](./phase-2-lifecycle-automation.md) — stub | 1-2 weeks |
| 3 — Mobile (cellular) mode + inbound IVR + push pipeline integration | Not started | [phase-3-mobile-mode.md](./phase-3-mobile-mode.md) — stub | 1 week |
| 4 — Admin / observability surface (call history, message inbox, DID pool, agent availability, settings + kill switch UI) | Not started | [phase-4-admin-observability.md](./phase-4-admin-observability.md) — stub | 1-1.5 weeks |
| 5 — Customer-side integration polish (conversation tab, timeline integration, pipeline quick actions) | Not started | [phase-5-customer-side-polish.md](./phase-5-customer-side-polish.md) — stub | 1-2 weeks |
| 6+ — Triggered optimizations (Hiya Connect, Telnyx cost migration, Inngest, Ably realtime) | Future | _Triggered ad-hoc_ | n/a |

---

## Inter-phase dependencies

```
Phase 0 (procurement) ──► Phase 1 (MVP softphone + voice + SMS + voip routing)
                                  │
                                  ├──► Phase 2 (lifecycle SMS automation)
                                  │             │
                                  │             ├──► Phase 3 (mobile + push + IVR refinement) ─┐
                                  │             │                                              │
                                  │             └──► Phase 4 (admin / observability) ──────┐  │
                                  │                                                        │  │
                                  └────────────────────────────────────────────────────► Phase 5
                                                                                          (customer-side
                                                                                           polish)
```

- **Phase 0 → Phase 1**: hard gate. Need Twilio account + DIDs + Trust Hub + 10DLC approved + webhook subdomain before Phase 1 code is useful.
- **Phase 1 → Phase 2**: soft. Lifecycle automation can iterate once foundation works.
- **Phase 3 → Phase 4**: can run in parallel after Phase 2 lands.
- **Phase 4 → Phase 5**: soft. Customer-side polish imports components built in Phase 4.

**Cross-EPIC dependency:** voip-campaigns Phase 1 requires this EPIC's Phase 1 complete (voip routing endpoints + voip_dnc + voip_* tables + clean DIDs for transfer targets).

---

## Phase 0 outcomes (as of 2026-05-22)

What's in place vs what's still vetting vs what's dropped.

### ✅ Verified working
- **Twilio account** + **3 DIDs**: `+1 213 XXX XXXX` (transfer-target role), `+1 424 XXX XXXX` (dial), `+1 626 XXX XXXX` (dial)
- **CNAM** set to `TRI PROS REMODEL` on all 3 DIDs
- **Trust Hub Business Profile**: APPROVED
- **SHAKEN/STIR**: A-attestation applied automatically to every DID under the approved Trust Hub Business Profile
- **Twilio API Key + TwiML App**: created
- **10DLC Brand**: APPROVED
- **Inngest account**: tri-pros-owned, Olis Solutions invited as admin
- **Webhook subdomain**: `https://voip.triprosremodeling.com` verified (CNAME → cname.vercel-dns.com) — *renamed from `dialer.` in pivot session 2026-05-23*

### ⏳ Background vetting (does NOT block start of Phase 1 design)
- **10DLC Campaign**: submitted, vetting 3-14 days. Blocks Phase 1 SMS-send tasks specifically.
- **FCC DNC SAN**: submitted (5-area-code free tier), 1-2 business days. Blocks Phase 1 DNC-scrub compliance gate specifically.
- **FreeCallerRegistry**: submitted for all 3 DIDs, 1-4 weeks per engine. Improves answer rate over time; doesn't block code.

### 📅 Scheduled follow-ups
- **2026-05-28**: DID reputation baseline check on 213/424/626 — captures starting point to verify FCR vetting is processing
- **End of voip-in-house Phase 5 + voip-campaigns Phase 1**: TCPA attorney consult (deferred until real production data exists across both systems)

### ❌ Dropped (moved out of scope per 2026-05-23 pivot)
- **~~Sendblue (iMessage)~~** — entirely out. Decision: not worth the integration cost. Phase 1 ships Twilio-only messaging permanently (revisit only if iMessage UX becomes a material conversion lever).
- **~~Retell account + agents~~** — entirely out. AI calling is CloudTalk's job (voip-campaigns EPIC).
- **~~Elastic SIP Trunk + Retell SIP origination~~** — obsolete. Twilio Voice SDK (browser softphone) + PSTN cellular routing covers in-house needs without SIP trunking.
- **~~Custom AI-dialer dispatcher / cadence engine / lead-state machine~~** — entirely out. CloudTalk owns lead-conversion cadence.

### 🔄 Renamed
- **Subdomain**: `dialer.triprosremodeling.com` → `voip.triprosremodeling.com` (covers both Twilio + CloudTalk webhooks + voip routing endpoints)
- **Env var**: `DIALER_WEBHOOK_BASE_URL` → `VOIP_WEBHOOK_BASE_URL`

### Env vars (Phase 1 implementer relies on these being present)

```bash
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SID=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TRUST_PROFILE_SID=BUxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_10DLC_CAMPAIGN_SID=CMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # pending campaign approval

# Pilot DIDs — role baked into the env var name.
# Phase 1 seed script reads these and inserts into voip_dids with role assignment.
TWILIO_TRANSFER_TARGET_DID_E164=+1213XXXXXXX
TWILIO_TRANSFER_TARGET_DID_SID=PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_DID_424_E164=+1424XXXXXXX
TWILIO_DID_424_SID=PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_DID_626_E164=+1626XXXXXXX
TWILIO_DID_626_SID=PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# FCC DNC (SAN pending)
FTC_DNC_SAN=  # pending 1-2 business days
FTC_DNC_USERNAME=tri-pros-remodeling
FTC_DNC_PASSWORD=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Inngest
INNGEST_EVENT_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
INNGEST_SIGNING_KEY=signkey-prod-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Webhook base URL — covers both Twilio and CloudTalk webhooks + voip routing endpoints
VOIP_WEBHOOK_BASE_URL=https://voip.triprosremodeling.com

# Dev safety (Phase 1 will enforce; redirects all outbound voice/SMS to a single test number in dev)
VOIP_DEV_OVERRIDE_NUMBER=  # set in dev/preview only; CI gate prevents production
```

**Dropped env vars** (no longer applicable): `RETELL_*`, `TWILIO_SIP_TRUNK_*`, `SENDBLUE_*`, `DIALER_*` (renamed to `VOIP_*`).

---

## Cross-cutting code touchpoints (the "watch these places" list)

| Area | Why it matters | Where changes accumulate |
|---|---|---|
| `entities/customers/` | Customer is the FK target for everything; add `lib/calling-hours.ts`, `lib/phone.ts`; profile/timeline gains voip integration in Phase 5 | Phase 2 adds entity lib; Phase 5 adds UI consumers |
| `entities/lead-sources/` | `voipConfigJSON` field added in Phase 1 migration; shared with voip-campaigns per [INTEGRATION-SEAM.md §9](../voip/INTEGRATION-SEAM.md) | Phase 1 (schema) |
| `db/schema/meta.ts` | New voip pgEnums added in Phase 1 single migration | Phase 1 |
| `db/schema/voip-*.ts` | `voip_calls`, `voip_messages`, `voip_dids`, `voip_dnc`, `voip_user_availability`, `voip_contact_sync` (cross-EPIC) | Phase 1 |
| `db/schema/app-settings.ts` | NEW: generic feature-keyed config table; lands with `feature='voip-in-house'` row first | Phase 1 |
| `domains/permissions/abilities.ts` | New entity name constants registered for CASL (`VOIP_CALL`, `VOIP_MESSAGE`, `VOIP_DID`, `VOIP_DNC`, etc.) | Phase 1 |
| `src/app/(frontend)/dashboard/layout.tsx` | Softphone widget mounted globally | Phase 1 |
| `src/shared/services/voip/` | NEW: top-level service tree — `voip-calls`, `voip-messages`, `voip-dids`, `voip-dnc`, `voip-disposition`, `voip-compliance`, `voip-routing`, `voip-user-availability`; subdir `campaigns/` is voip-campaigns's domain | All phases |
| `src/shared/services/providers/twilio/` | NEW: `client.ts`, `voice.ts`, `messaging.ts`, `webhooks/` (no SIP trunking) | Phase 1 |
| `src/app/api/twilio/voice/*` | NEW: voice status webhooks | Phase 1 |
| `src/app/api/twilio/messaging/*` | NEW: inbound SMS + status webhooks | Phase 1 |
| `src/app/api/voip/routing/*` | NEW: voip routing endpoints (caller-lookup, transfer-target, compliance-check) — implemented here, called by CloudTalk per [INTEGRATION-SEAM.md §1](../voip/INTEGRATION-SEAM.md) | Phase 1 |
| `src/trpc/routers/` | New routers: `voip-calls`, `voip-messages`, `voip-dids`, `voip-dnc`, `voip-user-availability` | Phase 1 minimal → Phase 4 full |
| `src/features/voip-in-house/` | NEW feature dir: admin UI (DID pool, kill switch, agent availability, message inbox, call history, send-SMS composer) | Phase 4 |
| Push notification pipeline | Reuses existing infra; new push types: voicemail-received, customer-sms-reply, disposition-needed, opt-out, kill-switch-toggled | Phase 1 (foundational); Phase 2-4 (added) |
| Tokenized-link mint endpoint | NEW: `/api/voip/token-mint/*` — generates 48h TTL single-use URLs for doc-upload (L-DOC), payment, reschedule, e-sign | Phase 1 (L-DOC); future variants added per use case |

---

## Migration roadmap (`@migration` annotations to watch)

Every `@migration` comment in the voip code points to a future swap.

| Annotation | Now | Target | Trigger |
|---|---|---|---|
| `@migration: → Inngest` | QStash for queued lifecycle SMS + delayed messages | Inngest durable workflows | Inngest provider integration complete |
| `@migration: → Ably kernel` | TanStack Query polling for softphone presence, chat updates, availability | Ably realtime kernel subscriptions | Ably kernel ships (per `project-ably-realtime-kernel.md` memory) |
| `@migration: → Telnyx` | `providers/twilio/voice.ts` | `providers/telnyx/voice.ts` | Monthly Twilio voice spend >$300 |
| `@migration: → Hiya Connect` (in-house) | No branded display | Hiya Connect concrete impl | Sustained answer rate <40% on in-house DIDs (unlikely; not anticipated in pilot) |
| `@migration: → Reassigned Numbers DB` | Skipped in pilot | Add to compliance gate | Lead vintage >12 months OR TCPA exposure broadens |

---

## Decisions log (post-spec, made during implementation)

> Each entry: date, decision, context, link. Append-only.

### 2026-05-24 — Phase 1 plan rewritten (post-pivot descope complete)

**Phase:** 0 → 1 boundary
**Context:** Following the 2026-05-23 EPIC split, the existing `phase-1-mvp.md` (4,274 lines, 44 tasks) still reflected the old combined AI-dialer + in-house build. Banner descope had been added but tasks themselves were untouched. Coherent implementation required a full rewrite.

**Decision:** Replaced `phase-1-mvp.md` with a fresh 37-task plan focused on the in-house-only scope. Dropped tasks: Twilio Voice React-wrapper spike (already chosen), `dialer_lead_states`, `dialer_settings`, Retell + AI-voice-agent provider, branded-calling provider, Sendblue + iMessage routing, AI-dialer dispatcher (`startTestCall`), Retell mid-call webhooks, Sendblue webhooks, transfer-router service initiating warm-transfers, Retell agent dashboard config. Added: voip routing endpoint backends + routes (caller-lookup, transfer-target, compliance-check), tokenized-link sends (mint via tRPC + consume via API route; L-DOC first use case), generic `app_settings` table + DAL replacing `dialer_settings`, ESLint `no-restricted-imports` rule enforcing the cross-EPIC dependency direction from INTEGRATION-SEAM.md, Phase 1 → voip-campaigns Phase 1 boundary verification task. Renamed all `dialer_*` → `voip_*` and added `source` discriminator + forward-compat nullable columns (`cloudtalk_*`, `campaign_id`, etc.) on shared tables. Stubbed Phase 2-5 plans for forward visibility (full plans written when each prior phase ships).

**Alternative considered:** Edit-in-place patch on the existing 44-task list. Rejected — too many cross-cutting renames + structural changes (entity factory pattern adoption, source discriminator, voip routing endpoint inversion) for clean patches.

**Impact:** Phase 1 unblocked for implementation. Stale `(frontend)/(dashboard)/layout.tsx` path in EPIC.md corrected to `(frontend)/dashboard/layout.tsx`.

**Link:** This commit + [phase-1-mvp.md](./phase-1-mvp.md).

### 2026-05-23 — EPIC split: AI-dialer/lead-conversion → voip-campaigns; in-house comms → this EPIC

**Phase:** 0 → 1 boundary
**Context:** Mid-grilling-session on the deferred Twilio+Retell+Sendblue Phase 1A, decided to delegate lead-to-meeting conversion entirely to CloudTalk and keep the rest of VoIP in-house. The former monolithic auto-dialer EPIC's content split into two: this EPIC (voip-in-house) covers everything except lead-conversion campaigns; [voip-campaigns](../voip-campaigns/EPIC.md) covers lead conversion via CloudTalk.

**Decision:** Two sibling EPICs with shared infrastructure. Shared `voip_*` tables live in this EPIC's schema with a `source='in_house' | 'cloudtalk'` discriminator. Single `services/voip/` service tree; CloudTalk-side orchestration lives under `services/voip/campaigns/` subdir. CloudTalk is a provider (`providers/cloudtalk/`), not a separate service tree.

**Rationale:** Wall off campaign DIDs (high-volume, spam-flag risk) from in-house DIDs (low-volume, reputation-protected). CloudTalk is purpose-built for the narrow conversion job; we don't out-engineer a managed dialer. In-house Twilio handles the relationship side where business logic + customer state are dense.

**Impact:**
- This EPIC descoped to remove: AI dialer dispatcher, cadence engine, lead-state machine, Retell integration, Sendblue iMessage, custom branded calling abstraction, multi-vendor messaging routing
- Schema renamed: `dialer_*` → `voip_*` (with `source` discriminator); `dialer_lead_states` dropped entirely (CloudTalk owns cadence state); `dialer_settings` replaced by generic `app_settings` table keyed by `feature`
- Subdomain renamed: `dialer.triprosremodeling.com` → `voip.triprosremodeling.com`
- Env vars renamed: `DIALER_WEBHOOK_BASE_URL` → `VOIP_WEBHOOK_BASE_URL`; `RETELL_*` and `TWILIO_SIP_TRUNK_*` dropped
- New cross-EPIC contract documented in [INTEGRATION-SEAM.md](../voip/INTEGRATION-SEAM.md)

**Link:** This commit + [HANDOFF-from-twilio-build.md](../voip/HANDOFF-from-twilio-build.md)

### 2026-05-22 — TCPA attorney consult deferred to end of epic

**Phase:** 0 → end-of-both-epics
**Context:** Phase 0 spec listed TCPA attorney consult as "recommended" during procurement. Deferred to after both EPICs are in production with real data — consult once with concrete evidence rather than hypotheticals.
**Decision:** TCPA attorney consult moves from Phase 0 to "after voip-in-house Phase 5 AND voip-campaigns Phase 1 both shipped." Existing opt-in language on web forms + Meta lead ads is treated as adequate consent basis for the pilot.
**Alternative considered:** Standard "upfront legal review before any outbound" approach. Rejected: pilot risk surface is low; consulting once with real operational data is more efficient than hypothetical advice.
**Impact:** Phase 0 gate criteria. If a TCPA issue surfaces mid-epic, revisit immediately.
**Link:** (prior commit on 2026-05-22)

### 2026-05-21 — Sendblue (iMessage) deferred → now dropped entirely (per 2026-05-23 pivot)

**Phase:** 0 → 1 boundary
**Context:** Original decision (2026-05-21) was to defer Sendblue iMessage from Phase 1 to a post-launch enhancement. Per the 2026-05-23 EPIC split, Sendblue is now **dropped entirely** from this EPIC's roadmap. iMessage premium UX is not a sufficient lever to justify the integration cost given the broader scope reshuffling.
**Decision:** Twilio Programmable Messaging is the sole concrete impl for all in-house SMS, indefinitely.
**Alternative considered:** Keep deferred (revisit later). Rejected during 2026-05-23 pivot — keeping a hypothetical future swap doesn't add value when we've made the call to commit single-vendor.
**Link:** (prior commit on 2026-05-21; superseded by 2026-05-23)

### 2026-05-21 — Layered spam mitigation: now in-house DIDs are low-volume, light-touch

**Phase:** 0 (procurement)
**Context:** Original 5-layer spam mitigation stack was sized for high-volume AI dialing. Per 2026-05-23 pivot, high-volume DIDs live in CloudTalk; in-house DIDs are low-volume agent-mediated. The aggressive stack (L2-L5) is now voip-campaigns's concern.
**Decision:** This EPIC retains L1 (free baseline: CNAM + FreeCallerRegistry + Nomorobo) for in-house DIDs. L2 (light per-DID monitoring) for visibility. L3 (Hiya Connect) is a Phase 3+ trigger only if sustained answer rate degrades.
**Link:** (prior commit on 2026-05-21; reframed by 2026-05-23 pivot)

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

## Open questions (cross-phase)

| # | Question | Owner | Decide by | Default |
|---|---|---|---|---|
| 1 | One DID per agent vs DID pool with agent-routing-on-inbound? | User + product | Phase 2 (when 2nd agent onboards) | One DID per agent (sticky); reassign on agent change |
| 2 | Tokenized-link TTL default | User | Phase 1 | 48h, single-use, phone-tied |
| 3 | Lifecycle SMS quiet hours for transactional sends | User | Phase 2 | Same as calling-hours (8am-9pm local TZ) |
| 4 | Inbound IVR menu options (D1 — main line "press 1 sales / 2 active project / 3 billing") | User | Phase 3 | 3-option menu as default; refine after first month |
| 5 | After-hours main-line behavior | User | Phase 3 | Voicemail with transcription + push to admin pool |
| 6 | Sunday calling | User | Phase 4 (admin config) | Excluded by default |
| 7 | Recording retention policy on in-house calls | User | Phase 4 | 90 days, auto-delete |

---

## Glossary (quick reference)

- **DID** — phone number we own and call from
- **STIR/SHAKEN A-attestation** — carrier-level identity verification, highest trust
- **CNAM** — caller ID display name
- **10DLC** — required B2C SMS registration program
- **PSTN** — regular phone network (vs WebRTC)
- **voip routing endpoints** — synchronous request-response HTTP endpoints exposed by us under `/api/voip/routing/*`; called by CloudTalk Call Flow Designer mid-call for caller-lookup, transfer-target, and compliance-check. Distinct from async webhook events (which live under `/api/webhooks/<provider>/`). See `docs/codebase-conventions/webhook-routes.md` for the async-vs-sync split.
- **CASL** — `@casl/ability` (this codebase's auth lib)
- **Tokenized-link send** — SMS containing a single-use, short-lived URL that opens a flow in our app (doc upload, payment, reschedule, e-sign)

---

## Cross-references

- **Sibling EPIC:** [voip-campaigns](../voip-campaigns/EPIC.md) — CloudTalk-managed lead conversion
- **Integration contract:** [../voip/INTEGRATION-SEAM.md](../voip/INTEGRATION-SEAM.md)
- **Pivot history:** [../voip/HANDOFF-from-twilio-build.md](../voip/HANDOFF-from-twilio-build.md)
- **Frozen design spec:** [`docs/superpowers/specs/2026-05-21-ai-dialer-design.md`](../../superpowers/specs/2026-05-21-ai-dialer-design.md) — historical, when this EPIC was the combined build
- **Phase 0 plan:** [phase-0-setup.md](./phase-0-setup.md)
- **Phase 1 plan:** [phase-1-mvp.md](./phase-1-mvp.md) — **PENDING DESCOPE REWRITE** (currently shows the old combined AI-dialer plan; will be rewritten before Phase 1 implementation begins)
- **Related ADRs:**
  - [ADR-0002 — Entity server system](../../adr/0002-entity-server-system.md)
  - [ADR-0003 — Service / provider architecture](../../adr/0003-service-provider-architecture.md)
- **Related memory:**
  - `memory/project-voip-in-house.md`
  - `memory/project-voip-campaigns.md`
  - `memory/project-ably-realtime-kernel.md`
  - `memory/pattern-push-notifications.md`
  - `memory/feedback-defaults-with-override.md`
  - `memory/feedback-entity-organization.md`
