# AI Dialer + Messaging — Design Spec

**Date:** 2026-05-21
**Status:** Approved design, ready for implementation planning
**Owner:** Oliver P
**Brainstorming session:** see git history of this file for the full collaborative design dialogue

---

## TL;DR

An AI-first outbound dialer + SMS/iMessage system for Tri Pros Remodeling that lets a single human (eventually scaling to a small team + VAs) handle thousands of weekly lead-dial attempts with minimal human time spent on dead-air calls (no-answers, voicemails, opt-outs). The AI's job is narrow: reach the lead, confirm interest in their original inquiry, warm-transfer the live call to an available human. The human does all selling. The system is built natively into our Next.js + tRPC + Postgres app, with Twilio as the VoIP backbone, Retell AI as the voice agent, and Hiya Connect as a Phase-2 branded-calling layer. Messaging (SMS + iMessage via Twilio + Sendblue) is in pilot scope from day one. CloudTalk and other off-the-shelf dialer suites were considered and rejected — see "Considered & rejected" section.

**Pilot timeline:** ~9-10 weeks linear, or 6-7 weeks if work is parallelized across multiple dispatched sessions.

---

## 1. Decisions & Rationale

### Vendor selection

| Layer | Pilot vendor | Why | Future swap candidate |
|---|---|---|---|
| VoIP backbone | **Twilio** | Most mature browser softphone SDK (Voice JS SDK), best-documented Retell BYO integration, Trust Hub for STIR/SHAKEN A-attestation, Elastic SIP Trunk for desk phones, mature webhook lifecycle. | Telnyx (~50% cheaper, automatic A-attestation, richer Call Control webhooks) once Retell-via-Telnyx-SIP path is battle-tested. Trigger: monthly Twilio voice cost >$300. |
| AI voice agent | **Retell AI** | BYO Twilio at $0 markup, Custom Functions are best-in-class for mid-call tRPC lookups, mature warm transfer, production scale ($40M ARR, 50M calls/mo), enterprise tier $0.05/min at $3K/mo. | Vapi (only if Retell degrades). Trigger: SLA/latency/quality regression. |
| Branded caller ID | **Hiya Connect** (Phase 2) | Powers spam labels on Samsung / T-Mobile / AT&T / Android — branded display is most accessible to SMBs via Hiya. Activated when observed answer rate <15% or hangup-within-3s rate >25%. | First Orion or Numeracle if Hiya falls short. |
| SMS | **Twilio Messaging** | Same vendor, same account, reuses Trust Hub vetting via 10DLC registration. | None (Twilio Messaging is the SMS standard). |
| iMessage | **Sendblue** | Real-world working B2B iMessage relay, ~$0.025/msg, proven at scale. | Fall back to SMS via Twilio if Sendblue degrades / Apple bans. |
| Job queue | **QStash** (now), **Inngest** (`@migration: → Inngest`) | QStash already in use for push notifications; Inngest migration in flight — better fit for durable multi-step dialer workflows. | — |
| Realtime updates | **Polling (TanStack Query)** (now), **Ably realtime kernel** (`@migration: → Ably kernel`) | Polling is sufficient for pilot. Ably kernel design is approved (per `project-ably-realtime-kernel.md` memory) — when shipped, conversation threads + dialing indicators upgrade to true real-time. | — |

### Build vs. buy verdict

**Custom (Twilio + Retell + Hiya + our orchestrator) over CloudTalk** for these reasons:

1. **Cost is a wash.** Three options modeled (custom / CloudTalk-everything / CloudTalk-hybrid) are within ±10% at every scale point.
2. **CloudTalk only saves ~20% of build time.** The hard parts (cadence, compliance, AI integration, customer-side data integration) are still ours regardless.
3. **App-as-UI mandate.** Humans live in the Tri Pros dashboard; forcing them into a second app (CloudTalk) for transfers is operational friction.
4. **Vendor swap-ability matters.** Custom + interface-layer abstraction means Twilio → Telnyx (etc.) is a 1-2 week migration. CloudTalk swap = months.
5. **Strategic moat.** Cadence + compliance + AI orchestration become proprietary IP in our codebase.

CloudTalk is noted in §11 (Considered & rejected) with a **revisit trigger:** "hiring 3rd VA AND queue/coaching features are blocking us."

### Phased approach

Build minimum viable end-to-end (Phase 1) before adding cadence/compliance (Phase 2) before adding DID pool sophistication (Phase 3) before adding admin UI (Phase 4) before customer-side polish (Phase 5). Each phase has explicit acceptance criteria. Hiya/Telnyx/Retell-enterprise/CloudTalk are Phase 6+ triggered optimizations, not pilot dependencies.

---

## 2. Pilot Scope

### In scope

- Outbound AI dialing from `customers` table
- AI greeting + interest confirmation + warm transfer to human (human does all selling)
- Voicemail detection + drop pre-recorded message
- Browser softphone in Tri Pros dashboard (desktop mode)
- **Cell-phone routing for mobile mode** (human's cell rings via PSTN, not WebRTC)
- Cadence engine: up to 10 attempts/lead/day until reached
- DID pool (5 pilot DIDs, expand to 20) with warming, daily caps, local-presence matching, auto-cooldown on health degradation
- Per-call disposition logging
- Compliance gates: phone validation, DNC lookup, FTC DNC scrub, calling hours (lead's local TZ), holiday calendar, kill switch, pipeline status
- Super-admin global config UI (cadence defaults, calling windows, DID pool policy, kill switch)
- Per-lead-source overrides for cadence + AI script
- Observability: per-call timeline, daily volume + answer-rate dashboard, per-DID health
- **Messaging foundation (Twilio SMS + Sendblue iMessage)** with vendor-abstracted provider interface
- **3 automatic messaging use cases**: callback reminder, post-voicemail nudge, opt-out confirmation
- **Inbound STOP keyword handler** with auto-DNC + confirmation reply
- **Manual one-off message send** from customer profile + after-call disposition modal
- **Chat UI conversation thread** per customer (via prompt-kit shadcn registry)
- CASL-based role permissions for all new entities

### Out of pilot scope (deferred)

- AI qualification beyond "still interested?" (human does all selling)
- AI booking meetings directly (no AI-side calendar integration)
- Hiya Connect / branded caller ID — Phase 6+ trigger
- Telnyx migration — Phase 6+ trigger
- Retell enterprise tier — Phase 6+ trigger
- CloudTalk for VA queues / coaching / supervisor features — Phase 6+ trigger
- Inbound call handling — separate system, not in scope here
- Multi-seller routing logic beyond "find any available human"
- Physical SIP desk phones (browser softphone + cell routing covers all pilot needs)
- Marketing / nurture SMS sequences (Day 1 / Day 3 / Day 7 drip)
- A/B testing harnesses (scripts, templates, cadences)
- MMS / image attachments
- iMessage rich features (tapbacks, typing indicators, group)
- Customer-side AI-suggested replies
- Inbound SMS conversation threading beyond logging + chat UI display

### Pilot success criteria

- End-to-end: real lead dialed, AI greets, lead picks up, warm-transferred to human softphone, human takes call, disposition logged
- 100+ live transfers across 7 days of sustained operation
- <5% reconciliation gap (orphaned `dialer_attempts` in non-terminal state)
- Zero compliance incidents (no opt-out-after-call complaints, no off-hours calls, no DNC violations)
- All 10 call-lifecycle branches verified
- Stack cost during pilot: <$1,000/mo total (Twilio + Retell + Sendblue + infra)
- Mobile mode validated: human takes a transfer on cell, dispositions via PWA push deep-link

---

## 3. Architecture

### Four-layer split

| Layer | Hosted | Responsibility |
|---|---|---|
| **L1. VoIP backbone (Twilio)** | Twilio | DID pool storage, outbound PSTN calls, browser softphone via WebRTC, recording storage, lifecycle webhooks, STIR/SHAKEN A-attestation via Trust Hub |
| **L2. AI voice agent (Retell)** | Retell | Speak with lead in natural voice, voicemail detection, mid-call function calls to our API, warm transfer, structured disposition |
| **L3. Dialer orchestrator** | Our Vercel serverless + Postgres + QStash (`@migration: → Inngest`) | All business logic: lead queue, cadence, DID pool mgmt, compliance gates, dispatcher, transfer routing, disposition recording, messaging |
| **L4. Human-side UX** | User's browser (PWA) | Browser softphone widget, availability toggle, customer profile timeline, dialer admin views, conversation chat UI, disposition modal |

### Vendor abstraction (the "Rule" for the codebase)

Every external vendor sits behind a service-layer interface. Outside of `services/voip/`, `services/ai-voice/`, `services/branded-calling/`, `services/messaging/` — no `twilio.` / `retell.` / `sendblue.` SDK imports allowed. Enforced via ESLint import boundaries.

```
src/services/voip/
  voip-provider.interface.ts
  twilio.voip-provider.ts            ← concrete (pilot)
  telnyx.voip-provider.ts            ← @migration: deferred, Phase 6+ cost optimization
  voip-provider.factory.ts

src/services/ai-voice/
  ai-voice-agent.interface.ts
  retell.ai-voice-agent.ts           ← concrete (pilot)

src/services/branded-calling/
  branded-calling.interface.ts
  null.branded-calling.ts            ← no-op (pilot)
  hiya.branded-calling.ts            ← @migration: activate Phase 2 (trigger-based)

src/services/messaging/
  messaging-provider.interface.ts
  twilio.messaging-provider.ts       ← SMS concrete (pilot)
  sendblue.messaging-provider.ts     ← iMessage concrete (pilot)
  messaging-router.service.ts        ← "try iMessage first, fall back to SMS" logic
```

Why this matters: any vendor swap = swap a concrete implementation, no caller-site changes.

### Serverless trace — one outbound call end-to-end

```
T+0s    [Vercel Cron — every 1 min]
        Hits /api/dialer/cron/tick
        ├─ services/dialer/queue.findDueLeads({limit: 20})
        ├─ Enqueues QStash "dial-lead:{leadId}" jobs
        │  // @migration: when Inngest lands, these become Inngest function steps
        │  // for durable multi-step execution.
        └─ Returns 200 OK (~200ms total)

T+1s    [QStash invokes /api/dialer/dispatch?leadId={X}]
        // @migration: becomes an Inngest function "dialer.dispatch" with
        // step.run() blocks for compliance + DID pick + Retell call
        ├─ Compliance gate (8 sub-checks, short-circuit on first failure)
        ├─ DID pool: select healthy DID matching lead's area code
        ├─ Atomic increment of DID daily counter
        ├─ Insert dialer_attempts row (status=initiated)
        ├─ services/ai-voice.startOutboundCall(...)
        │    → Retell API call with webhook URLs for Custom Functions
        │    → Returns retell_call_id
        └─ Update dialer_attempts with retell_call_id (~1.5s)

T+1-25s [Nothing runs on our infra.]
        Retell dials. Twilio carries audio. Phone rings. Lead picks up.

T+8s    [Retell hits us mid-call]
        POST /api/dialer/ai/lead-context
        Returns: { name, trade, lead_source_name, warm_intro_for_ai }
        (~80ms)

T+25s   [Lead confirms interest]
        Retell calls: POST /api/dialer/ai/route-transfer
        ├─ services/dialer/transfer-router.findAvailableHuman()
        ├─ Returns: { transfer_to: 'client:agent_oliver' OR '+1310555OLIVER',
        │              warm_intro: '...', custom_parameters: { dialer_attempt_id, customer_id, ... } }
        └─ (~100ms)

T+27s   [Retell initiates SIP REFER]
        - Desktop mode: Twilio rings softphone widget in browser via WebRTC
        - Mobile mode: Twilio places outbound PSTN call to human's cell
        - Either way: Retell speaks warm-intro verbally to receiver before bridging
        Human accepts → audio bridges → Retell drops off

T+5min  [Call ends]
        Twilio fires /api/voip/twilio/status
        Retell fires /api/dialer/ai/call-completed
        Both update dialer_attempts (idempotent, vendor-ID-keyed)
        Push notification: "Disposition needed: Joe Smith"
        Human taps push → PWA opens disposition modal
        // @migration: when Ably kernel ships, this becomes a realtime event
        // pushed to the human's active session instead of polling.
        Disposition saved via tRPC mutation
```

**Critical insight:** the realtime voice plumbing (audio bridges, AI conversations, WebRTC) runs on vendor infrastructure (Twilio, Retell). Our app's invocations are all <2 seconds, stateless, request-response. Vercel serverless is the perfect fit.

---

## 4. Data Model

### New tables (`src/shared/db/schema/`)

#### `dialer-attempts.ts`
Every individual call attempt — the atomic unit.

```ts
{
  id: uuid (PK)
  customer_id: uuid (FK customers, indexed)
  did_used: text                          // "+13105551234"
  retell_call_id: text (unique, nullable)
  twilio_call_sid: text (unique, nullable)
  status: dialer_attempt_status_enum
  initiated_at: timestamp
  answered_at, transferred_at, ended_at: timestamp (nullable)
  transferred_to_user_id: text (FK user, nullable)
  duration_seconds: int (nullable)
  disposition: dialer_disposition_enum (nullable)
  skip_reason: text (nullable)
  ai_summary, ai_sentiment: text (nullable)
  recording_url: text (nullable)
  recording_duration_seconds: int (nullable)
  meta_json: jsonb (nullable)
  created_at, updated_at
}
```

#### `dialer-dids.ts`
DID pool with lifecycle state.

```ts
{
  id: uuid (PK)
  e164_number: text (unique)
  area_code: varchar(3)
  twilio_phone_sid: text (unique)
  status: dialer_did_status_enum    // warming | active | cooldown | flagged | retired
  daily_cap: int
  attempts_today, attempts_total: int
  last_attempt_at, last_flagged_at: timestamp (nullable)
  flag_reason: text (nullable)
  warming_started_at: timestamp (nullable)
  reputation_data_json: jsonb (nullable)
  is_transfer_target_did: boolean (default false)  // ONE DID reserved as "Tri Pros Transfers" caller ID for outbound legs to humans
  created_at, updated_at
}
```

#### `dialer-lead-states.ts`
Per-customer dial cadence state.

```ts
{
  id: uuid (PK)
  customer_id: uuid (FK customers, UNIQUE)
  enrolled_at: timestamp
  enrolled_by_user_id: text (FK user, nullable)
  status: dialer_lead_state_status_enum
  next_attempt_at: timestamp (nullable)
  last_attempt_at: timestamp (nullable)
  attempts_today, attempts_total: int
  max_attempts_per_day, max_total_attempts: int
  last_disposition: dialer_disposition_enum (nullable)
  pause_until: timestamp (nullable)
  notes: text (nullable)
  created_at, updated_at
}
```

#### `dialer-dnc.ts`
Do Not Call registry — lead opt-outs + DNC list scrubs.

```ts
{
  id: uuid (PK)
  phone_e164: text (unique)
  source: dialer_dnc_source_enum    // lead_request | manual_admin | ftc_dnc | wireless_dnc | state_dnc | sms_opt_out
  reason: text (nullable)
  added_at: timestamp
  added_by_user_id: text (FK user, nullable)
}
```

#### `dialer-user-availability.ts`
Transfer target presence.

```ts
{
  user_id: text (PK, FK user)
  enrolled_for_transfers: boolean (default false)
  manual_status: dialer_user_availability_enum  // available | off_shift
  transfer_mode: dialer_transfer_mode_enum      // desktop | mobile | auto
  cell_phone_e164: text (nullable)              // required if transfer_mode='mobile'
  on_call_until: timestamp (nullable)
  last_transferred_at: timestamp (nullable)
  updated_at: timestamp
}
```

Note: derived availability (the real "is this user free right now") is computed from this row + an active-call check against `dialer_attempts` — not stored, to eliminate webhook-ordering races.

#### `dialer-settings.ts`
Singleton row for super-admin-editable global config.

```ts
{
  id: text (PK, default 'singleton')   // CHECK constraint enforces single row
  config_json: jsonb $type<DialerSettingsConfig>
  updated_at: timestamp
  updated_by_user_id: text (FK user)
}
```

The `DialerSettingsConfig` Zod schema (in `entities/dialer-settings/schemas/`) contains: cadence defaults, calling-window defaults, DID pool policy, cadence decay schedule, global kill switch. Validated on every update.

#### `dialer-messages.ts`
Every sent + received SMS/iMessage.

```ts
{
  id: uuid (PK)
  customer_id: uuid (FK)
  dialer_attempt_id: uuid (FK, nullable)  // if tied to a call
  direction: 'outbound' | 'inbound'
  channel: 'sms' | 'imessage' | 'fallback_sms'
  body: text
  twilio_message_sid: text (unique, nullable)
  sendblue_message_id: text (unique, nullable)
  status: dialer_message_status_enum  // queued | sent | delivered | failed | undelivered | received
  sent_at, delivered_at, failed_at: timestamp (nullable)
  template_key: text (nullable)  // 'callback_reminder' | 'voicemail_followup' | 'opt_out_confirm' | 'manual' | null for inbound
  meta_json: jsonb (nullable)
  created_at, updated_at
}
```

### Modification to existing schema

#### `lead-sources.ts` — add `dialerConfigJSON` field

```ts
{
  // existing fields...
  dialerConfigJSON: jsonb (nullable)
}
```

Zod shape (in `entities/lead-sources/schemas.ts`):
```ts
{
  enabled: boolean
  trade: string
  consent_context: string
  ai_greeting_override: string | null   // owner controls AI script entirely — no system-enforced disclosure language
  warm_intro_template: string | null    // template for AI's verbal warm-intro to receiving human
  cadence_overrides: {
    max_attempts_per_day?: number
    max_total_attempts?: number
    quiet_hours?: { start: string, end: string }
  } | null
  message_templates: {
    callback_reminder?: string
    voicemail_followup?: string
    opt_out_confirm?: string
  } | null
}
```

### Enums (in `src/shared/constants/enums/dialer.ts`)

```ts
export const dialerAttemptStatuses = [
  'queued', 'initiated', 'dialing', 'no_answer', 'voicemail_left',
  'live_transferred', 'live_not_interested', 'live_callback_scheduled',
  'failed', 'skipped_compliance',
] as const
export type DialerAttemptStatus = (typeof dialerAttemptStatuses)[number]

export const dialerDispositions = [
  'booked_meeting', 'interested_not_now', 'wrong_number',
  'not_interested', 'opt_out', 'unreached', 'voicemail',
] as const
export type DialerDisposition = (typeof dialerDispositions)[number]

export const dialerDidStatuses = ['warming', 'active', 'cooldown', 'flagged', 'retired'] as const
export type DialerDidStatus = (typeof dialerDidStatuses)[number]

export const dialerLeadStateStatuses = ['queued', 'in_progress', 'reached', 'opted_out', 'exhausted', 'paused'] as const
export type DialerLeadStateStatus = (typeof dialerLeadStateStatuses)[number]

export const dialerDncSources = ['lead_request', 'manual_admin', 'ftc_dnc', 'wireless_dnc', 'state_dnc', 'sms_opt_out'] as const
export type DialerDncSource = (typeof dialerDncSources)[number]

export const dialerUserAvailabilities = ['available', 'off_shift'] as const
export type DialerUserAvailability = (typeof dialerUserAvailabilities)[number]

export const dialerTransferModes = ['desktop', 'mobile', 'auto'] as const
export type DialerTransferMode = (typeof dialerTransferModes)[number]

export const dialerMessageStatuses = ['queued', 'sent', 'delivered', 'failed', 'undelivered', 'received'] as const
export type DialerMessageStatus = (typeof dialerMessageStatuses)[number]
```

Re-exported from `src/shared/constants/enums/index.ts`.

pgEnum declarations in `src/shared/db/schema/meta.ts` follow the existing pattern:
```ts
export const dialerAttemptStatusEnum = pgEnum('dialer_attempt_status', dialerAttemptStatuses)
// ... 7 more
```

### Module placement (flat entity layout)

```
src/shared/entities/                        ← Backend entities — flat, dialer-* prefixed
  dialer-attempts/
    DOCS.md, schemas/, types.ts, constants/, lib/, hooks/, dal/, components/
  dialer-dids/
  dialer-lead-states/
  dialer-dnc/
  dialer-user-availability/
  dialer-settings/
  dialer-messages/

src/shared/components/dialer/              ← Cross-feature UI primitives (no feature imports allowed)
  softphone-widget/                          (globally mounted in dashboard layout)
  call-attempt-timeline-item/                (used in customer profile timeline)
  call-status-badge/
  dialing-indicator/
  enroll-in-dialer-button/
  lead-state-badge/
  call-disposition-picker/                   (modal opened by softphone OR push deep-link)
  recording-player/
  conversation-thread/                       (SMS/iMessage chat — uses prompt-kit primitives)
  message-bubble/
  message-status-icon/
  channel-badge/
  send-message-button/

src/shared/constants/enums/dialer.ts       ← const arrays + TS types (colocated, per existing pattern)
src/shared/db/schema/
  dialer-attempts.ts, dialer-dids.ts, dialer-lead-states.ts, dialer-dnc.ts,
  dialer-user-availability.ts, dialer-settings.ts, dialer-messages.ts
  meta.ts                                    ← +9 new pgEnums
  lead-sources.ts                            ← +dialerConfigJSON field

src/services/                              ← Vendor providers + business logic
  voip/, ai-voice/, branded-calling/, messaging/
  dialer/
    queue/, cadence/, dispatcher/, transfer-router/, disposition/,
    did-pool/, compliance/

src/trpc/routers/                          ← UI-facing procedures
  dialer-attempts.router.ts
  dialer-dids.router.ts
  dialer-lead-states.router.ts
  dialer-dnc.router.ts
  dialer-user-availability.router.ts
  dialer-settings.router.ts
  dialer-messages.router.ts

src/app/api/                               ← External webhook endpoints (thin: verify signature, delegate to service)
  dialer/ai/{lead-context, route-transfer, schedule-callback, log-disposition, call-completed}/route.ts
  voip/twilio/{status, recording}/route.ts
  messaging/twilio/{inbound, status}/route.ts
  messaging/sendblue/{inbound, status}/route.ts

src/features/auto-dialer/                  ← Feature: admin UI built on top of shared dialer components
  ui/
    views/
      dialer-admin-view.tsx                  (DID pool, volume, kill switch)
      lead-enrollment-view.tsx               (bulk enroll / pause / unenroll)
      call-history-view.tsx                  (filtered dialer_attempts table)
      dialer-settings-view.tsx               (super-admin global config)
      lead-source-dialer-config-view.tsx     (per-source overrides)
      dnc-management-view.tsx                (DNC add / remove / import)
      messages-inbox-view.tsx                (inbound replies needing attention)
    components/                              (auto-dialer-specific bits)
```

### CASL integration

Each new entity gets:
1. `entities/<entity>/lib/constants.ts` exporting the entity name constant (e.g., `DIALER_ATTEMPT`, `DIALER_DID`, etc.)
2. Added to `domains/permissions/abilities.ts` registry per the entity-name colocation pattern from ADR-0002 (issue #193)
3. Per-role rules:
   - **super_admin** — manage all
   - **admin** — manage `DIALER_DNC` + `DIALER_LEAD_STATE` + `DIALER_USER_AVAILABILITY` + `DIALER_MESSAGE`; read all others
   - **agent** — read own `DIALER_ATTEMPT` records (where `transferred_to_user_id = self.id`); manage own `DIALER_USER_AVAILABILITY`; read/send own `DIALER_MESSAGE` for customers in their workload

### Downstream consumers (who imports what)

| Consumer | Imports from `shared/components/dialer/` | Imports from `entities/dialer-*` |
|---|---|---|
| Dashboard layout | `softphone-widget/` (global mount) | — |
| Customer profile timeline | `call-attempt-timeline-item/`, `recording-player/`, `conversation-thread/` | Reads `dialer-attempts` + `dialer-messages` |
| Customer profile actions | `enroll-in-dialer-button/`, `dialing-indicator/`, `lead-state-badge/`, `send-message-button/` | Reads `dialer-lead-states` |
| Customer pipelines | `dialing-indicator/`, `lead-state-badge/` | Reads `dialer-lead-states` |
| Agent dashboard | (softphone already mounted) | Reads `dialer-attempts` daily stats |
| Auto-dialer feature | All of the above | All dialer entities |
| Meeting flow | — | Reads `dialer-attempts` (where `disposition='booked_meeting'`) for "booked from AI transfer" linkage |

---

## 5. Call Lifecycle

### State machines

**Per-lead (`dialer_lead_states.status`):**
```
queued ──► in_progress ──► reached
                       ├─► opted_out
                       ├─► exhausted
                       └─► paused ──► in_progress (when pause_until passes)
```

**Per-attempt (`dialer_attempts.status`):**
```
queued ──► initiated ──► dialing ──► no_answer
                                  ├─► voicemail_left
                                  ├─► live_transferred
                                  ├─► live_not_interested
                                  ├─► live_callback_scheduled
                                  └─► failed
─── pre-dial gate ───
queued ──► skipped_compliance       (never dialed)
```

State machine definitions live in `entities/dialer-attempts/lib/state-machine.ts` and `entities/dialer-lead-states/lib/state-machine.ts` — pure functions enforcing allowed transitions.

### 10 lifecycle branches

| # | Branch | Detection | Handler |
|---|---|---|---|
| B1 | No answer | Twilio status=`no-answer` after ~20s ring | `attempts_today += 1`; `next_attempt_at = NOW() + 90min` (or next day if cap hit) |
| B2 | Voicemail | Retell voicemail detector | Drop 12s pre-recorded message; `next_attempt_at = NOW() + 3h`; **max 1 VM/lead/day** |
| B3 | Live, callback scheduled | AI parses requested time | `status='paused'`, `pause_until=<time>`; auto-send `callback_reminder` SMS 30min before |
| B4 | Live, not interested (passive) | AI hears decline | `lead_state.status='reached'`; **no DNC entry**; manual re-engagement possible |
| B5 | Opt-out (active) | AI hears "stop calling" / "remove me" / etc. | Insert `dialer_dnc` (`source='lead_request'`); `lead_state.status='opted_out'`; auto-send `opt_out_confirm` SMS |
| B6 | Wrong number | AI hears confused / "wrong number" | `lead_state.status='reached'`; flag customer for admin review |
| B7 | Live but no human available | `route-transfer` returns no match | AI offers callback; if lead provides time → B3; else `next_attempt_at = NOW() + 30min` high-priority |
| B8 | DID flagged | Hangup-within-3s >30% over 24h OR Hiya/CIR report (Phase 2) | `did.status='cooldown'`; auto-promote warming DID; admin push notification |
| B9 | Pre-dial compliance failure | 8 gates checked in order (see §6) | `status='skipped_compliance'`; **does NOT count against `attempts_today`**; reschedule per gate type |
| B10 | Vendor error | Retell API fail / Twilio webhook lost | Retell fail → `status='failed'`, retry 3x with backoff; lost webhook → nightly reconciliation cron backfills |

### Edge-case scripts the AI must handle

| Lead utterance pattern | AI response | Branch |
|---|---|---|
| "Is this a robot?" / "Are you AI?" | "Yes, I'm an AI assistant for Tri Pros Remodeling. Would you prefer I have a human call you back?" | Yes → B3; no → continue |
| "How did you get my number?" | "You filled out a form on our website / Meta ad about [trade] on [date]." | Continue |
| Silent 10s after pickup | "Hello? Is anyone there?" → wait 5s → "Sorry, I'll try you back later" → hang up | B1 |
| Hostile ("why are you calling me?!") | "I apologize for the disruption. Would you like me to remove you from our list?" | yes → B5; no → polite hangup |
| Spanish speaker | "I'd be happy to have a Spanish-speaking advisor reach out. When would be a good time?" | B3 with metadata flag for admin |

**AI prompt content is owned by the human user.** The system does not enforce specific opening utterance / disclosure language — `lead_sources.dialerConfigJSON.ai_greeting_override` carries it. Recording disclosure is recommended but not system-enforced.

### Context handoff to receiving human (three redundant channels)

When AI warm-transfers, the human receives context via:

1. **Custom parameters on the call** — `dialer_attempt_id`, `customer_id`, `trade`, `location`, `warm_intro_for_ai`. Browser softphone widget reads them via SDK callback before showing accept UI. Mobile mode: parameters live in our DB, the PWA push payload carries the same info.
2. **Push notification** — fires immediately before/on transfer. Payload includes name, trade, location, deep link to in-PWA accept-call view (mobile) or auto-focuses softphone widget (desktop).
3. **AI verbal warm-intro** — Retell speaks to the receiver before bridging: "I have Joe Smith on the line, interested in roofing in Burbank — connecting you now." Universal channel — works even if push fails or screen is locked.

`services/dialer/transfer-router/build-warm-intro.service.ts` composes the verbal intro using the per-source template. ≤25 words.

### Retry cadence defaults

These are super-admin-editable via `dialer-settings.config_json.defaults`:
```
max_attempts_per_day: 10
max_total_attempts: 50
inter_attempt_interval_minutes: 90
voicemail_backoff_hours: 3
voicemail_max_per_day: 1
calling_hours: 8am-9pm (lead's local TZ from customers.lat/lng)
calling_days: Mon-Sat (no Sunday)
power_hours: 9am-12pm, 5pm-7pm (cron biases dispatch)
```

Cadence decay schedule (also super-admin-editable):
- Days 1-3: up to 10/day (saturate)
- Days 4-7: 2/day (backoff)
- Days 8-14: 1/day (background)
- Day 15+: `status='exhausted'`, admin can manually re-enable

Per-lead-source overrides via `lead_sources.dialerConfigJSON.cadence_overrides`. Resolved through `entities/dialer-settings/lib/resolve-config.ts` (pure merge function).

### Notification touchpoints (existing push pipeline)

| Event | Recipient | Channel |
|---|---|---|
| Transfer call ends, disposition pending | Human who took the call | Push: "Disposition needed: Joe" → PWA deep-link |
| Opt-out received | Admin pool | Push: "Opt-out: Joe Smith" |
| DID flagged | Admin pool | Push: "DID +1310555... flagged on T-Mobile" |
| Inbound SMS reply (non-STOP) | Admin pool | Push: "Inbound from Joe: [body preview]" |
| Daily cap reached for lead 7 days no contact | Admin | Push: "Joe Smith — 7 days no contact, 3 attempts to exhausted" |
| Global kill switch toggled | Admin pool | Push: "Dialer paused/resumed by Oliver" |

---

## 6. Compliance + Spam Mitigation

### Applicable law (pilot context)

Given inbound web form + Meta lead ad opt-in source:
- **TCPA (federal)** — opt-in satisfies prior express written consent for prerecorded/AI voice. Required: honor revocation immediately, no calls outside 8am-9pm local lead time, DNC compliance.
- **CA Civil Code §17529.5 / Business Code §17941** — opt-in marketing allowed; recording disclosure recommended.
- **CA AB 2013 (AI Transparency Act, 2026)** — disclosure when interacting with AI is required, but AI prompt content is owner-managed (not system-enforced) per design decision.
- **FCC AI rule (Feb 2024)** — AI-generated voice in robocalls requires prior express consent (covered) + AI disclosure (owner-scripted).
- **National Do Not Call Registry** — required scrub. Lead may have DNC'd elsewhere after opt-in.
- **Reassigned Numbers Database** — Phase 6+ check; not required for pilot since opt-in is recent.

### Compliance gate (runs before every dial)

`services/dialer/compliance/compliance-gate.service.ts` — `assertCanDial(customerId)` returns `{ allowed: true }` or `{ allowed: false, reason, retryAt? }`. Eight gates, short-circuit on first failure:

| # | Gate | Source | On fail |
|---|---|---|---|
| 1 | Phone valid E.164 | `entities/customers/lib/phone.ts` | `'invalid_phone'`; freeze lead; alert admin |
| 2 | Phone not in `dialer_dnc` | `entities/dialer-dnc/dal/server/lookup.ts` | `'dnc_hit'`; set `lead_state='opted_out'` |
| 3 | Phone not in FTC DNC | Cached daily import | `'ftc_dnc'`; set `lead_state='opted_out'` |
| 4 | Within calling hours (lead's local TZ) | `entities/customers/lib/calling-hours.ts` | `'off_hours'`; reschedule to next slot |
| 5 | Not Sunday or recognized state/federal holiday | `services/dialer/compliance/holiday-calendar.ts` | `'no_call_day'`; reschedule |
| 6 | `customer.pipeline != 'dead'` | `customers.pipeline` | `'lead_not_dialable'`; skip permanently |
| 7 | `lead_sources.dialerConfigJSON.enabled` | Per-source flag | `'source_disabled'`; skip |
| 8 | Global kill switch off | `dialer_settings.config_json.global_kill_switch` | `'global_kill_switch'`; skip |

Failures write `dialer_attempts` rows with `status='skipped_compliance', skip_reason=<above>`. Auditable for regulator inquiry. **These rows do NOT count against `attempts_today`.**

### DNC management

**Inbound sources:**
1. Lead opt-out during call (B5) — AI logs immediately
2. SMS STOP reply (inbound webhook)
3. Manual admin entry
4. Daily FTC DNC delta sync (cron)
5. Wireless DNC scrub (Phase 6+, ~$50-150/mo)
6. State DNC lists (Phase 6+ where applicable; CA has no state DNC)

**Outbound:**
- Honor every opt-out within 5 min (well inside TCPA 24h requirement)
- Customer record retained but flagged in UI with "DO NOT CALL" red banner
- Lives in `services/dialer/compliance/opt-out-compliance.service.ts` — single source of truth used by both call-side (B5) and SMS-side (STOP handler).

### Spam mitigation (Phase 1 DIY)

Owned in `services/dialer/did-pool/`:

| Mechanism | Service file | Details |
|---|---|---|
| Pool of 5 DIDs (expand to 20) | `select.service.ts` | One additional DID reserved as `is_transfer_target_did=true` for outbound legs to human cells |
| Per-DID daily cap | `cap.service.ts` | Start 60/day; ramp to 120 after 14 days; atomic Postgres `UPDATE ... WHERE attempts_today < daily_cap RETURNING` |
| Number warming | `warming.service.ts` | New DIDs 20/day, +20/day every 3 days. `status: warming → active` auto |
| Local-presence matching | `local-presence.service.ts` | Match `customers.lat/lng` → area code → DID with same/adjacent. Fallback round-robin. |
| Hangup-within-3s monitor | `health-monitor.service.ts` | Cron hourly; >30% → auto-cooldown |
| Rotation | `rotation.service.ts` | Cooldown → fresh DID promoted from warming pool; admin push |
| STIR/SHAKEN A-attestation | One-time Twilio Trust Hub setup | Required Phase 0; free once approved |

### Spam mitigation (Phase 2 — triggered)

`services/branded-calling/hiya.branded-calling.ts` replaces null impl when:
- Observed answer rate <15% sustained 1 week, OR
- Hangup-within-3s rate >25% across pool sustained 24h

Adds: registered branded display + daily reputation polling + auto-cooldown on Hiya flag + auto-procurement on pool drop.

### Recording handling

- Storage: Twilio S3-hosted, URL stored in `dialer_attempts.recording_url`
- Access: tRPC procedure CASL-gated on `view_recording` ability
- Retention: 90 days, auto-deleted by cron via Twilio API
- Lead deletion request: admin tool removes URL + calls Twilio API

### Super-admin global config UI

`features/auto-dialer/ui/views/dialer-settings-view.tsx` (super_admin only via CASL):

- **Cadence defaults** form (max attempts, intervals, voicemail backoff)
- **Calling window** form (start/end hours, calling days, power hours, TZ-aware preview)
- **DID pool policy** form (target size, warming cadence, daily cap, flag thresholds, cooldown days, auto-procurement enabled)
- **Cadence decay schedule** form (saturate / backoff / background phases)
- **Global kill switch** big red toggle with confirmation modal
- **Recent changes log** (audit trail from `activities`)

Per-source overrides editable via `lead-source-dialer-config-view.tsx`. Pattern: "Use default" or "Override → X" per field.

### Audit log

Every config change writes an `activities` row with `type='dialer_config_changed'`, `metaJSON={ before, after }`, `ownerId=editor.id`. Visible in the settings view as a recent-changes feed.

---

## 7. Messaging (SMS + iMessage)

### Foundation

`services/messaging/messaging-provider.interface.ts`:
```ts
sendMessage(to: E164, body: string, channelPreference: 'sms' | 'imessage' | 'auto')
  → { messageId, channel, status }
```

Concrete implementations:
- `twilio.messaging-provider.ts` — SMS via Twilio Messaging API ($0.0079/msg + 10DLC carrier fees)
- `sendblue.messaging-provider.ts` — iMessage via Sendblue ($0.025/msg)
- `messaging-router.service.ts` — when `channelPreference='auto'`: attempt iMessage, fall back to SMS on delivery failure

### Three automatic use cases (lifecycle-triggered)

| Trigger | Template | Channel preference |
|---|---|---|
| AI schedules callback (B3) | `callback_reminder` — sent 30 min before scheduled time | `auto` (iMessage → SMS) |
| AI drops voicemail (B2) | `voicemail_followup` — sent within 5 min | `auto` |
| Opt-out logged (B5 OR inbound STOP) | `opt_out_confirm` — immediate | `sms` (channel they asked off, confirms compliance) |

Templates configurable per lead source via `lead_sources.dialerConfigJSON.message_templates`. Variables: `{{customer_name}}`, `{{trade}}`, `{{callback_time}}`.

### Inbound STOP handler

`app/api/messaging/twilio/inbound/route.ts`:
- Verify Twilio HMAC signature
- Look up customer by `From` phone
- If body matches `/^(STOP|UNSUBSCRIBE|QUIT|CANCEL|END)$/i`:
  - Add to `dialer_dnc` (`source='sms_opt_out'`)
  - Set `dialer_lead_states.status='opted_out'`
  - Cancel any in-flight dial or message queue for the lead
  - Auto-reply with `opt_out_confirm` template (TCPA mandatory)
- Else: log inbound message, push notification to admin pool

`services/dialer/compliance/opt-out-compliance.service.ts` — single shared handler used by both call-side (B5) and SMS-side (STOP).

### Manual one-off send

`shared/components/dialer/send-message-button/` — appears on:
- Customer profile actions row
- After-call disposition modal (e.g., "Send portfolio link" quick action)
- Auto-dialer admin inbox view (reply to inbound)

Behavior:
- Pre-send compliance check (DNC, opt-out, valid E.164)
- Channel picker (SMS / iMessage / Auto)
- Template picker or freeform input
- Optimistic UI update (message appears immediately, status updates on webhook)
- Logged as `template_key='manual'`

### Chat UI — conversation thread

Built using **prompt-kit** (`promptkit.dev`) — third-party shadcn registry chat primitives. Backup option: shadcn-chat by jakobhoeg.

`shared/components/dialer/conversation-thread/`:
- `conversation-thread.tsx` — main component, takes `customerId`, renders chronological message list
- `message-bubble.tsx` — outbound vs inbound styling (uses prompt-kit's `<ChatMessage>`)
- `message-status-icon.tsx` — delivered / failed / queued
- `channel-badge.tsx` — small badge: "SMS" vs "iMessage"
- `send-message-input.tsx` — textarea + channel picker + send button (wraps prompt-kit `<MessageInput>`)

Used in:
1. **Customer profile** — full thread visible in a tab or side panel
2. **Disposition modal** — quick "Send follow-up" composer with thread preview
3. **Auto-dialer admin inbox** — list of customers with unread inbound replies

Real-time updates: TanStack Query `refetchInterval: 5000` for pilot.
`// @migration: → Ably realtime kernel` once shipped — conversation threads upgrade to true real-time delivery indicators.

### tRPC additions

`trpc/routers/dialer-messages.router.ts`:
- `list(customerId, paginated)` — message history
- `send({ customerId, body, channel })` — enqueue send via messaging service
- `markRead(messageId)` — for inbound replies needing attention
- `unreadInboxCount()` — for admin inbox badge

### Compliance touchpoints

- Every outbound SMS auto-appends "Reply STOP to opt out." if not present in template
- STOP responses honored within 5 min (TCPA hard requirement)
- 10DLC throughput limits respected (1 msg/sec per number standard; conservative pilot cap)
- Sendblue iMessage rate-limited ≤5/sec conservatively

---

## 8. Mobile / PWA Strategy

### Three transfer modes

| Mode | Audio path | Rings on | Carrier | Disposition flow |
|---|---|---|---|---|
| **Desktop** | Browser ↔ Twilio (WebRTC) | Browser tab banner in softphone widget | N/A (WebRTC) | Modal opens immediately in dashboard |
| **Mobile** | Cellular (PSTN) | Native phone UI (lock screen accept, CallKit, AirPods, CarPlay) | Cellular voice | Push notification fires post-call → tap → PWA opens disposition modal |
| **Auto** | Whichever fits the moment | If browser softphone is connected → desktop; otherwise → mobile | Either | Either path depending on which fired |

Mode selected via softphone widget toggle, stored in `dialer_user_availability.transfer_mode`. `transfer-router.resolve-transfer-target.service.ts` evaluates `auto` mode at dispatch time by checking whether the user has an active Voice SDK session registered with Twilio (presence ping every 30s while widget is mounted).

### Why mobile = cellular, not WebRTC

Mobile browser WebRTC is functionally broken as primary call-receiving:
- iOS Safari + PWA: WebRTC pauses when app is backgrounded or screen is locked
- Android: same with slight variance
- Neither supports CallKit-equivalent native incoming-call UI from a web context

Cell routing via PSTN delivers everything mobile browser WebRTC cannot:
- Native phone UX (lock screen, CallKit, AirPods, CarPlay)
- Carrier voice quality (HD Voice / VoLTE)
- Reliability — no app needs to be open
- Battery: normal cellular call usage, no WebRTC overhead

Cost: $0.014/min for the outbound leg to the human's cell. Trivial.

### Caller ID for the human-side leg

One DID in the pool is reserved as `is_transfer_target_did=true` and used exclusively for the outbound leg to human cells. Human saves it in contacts as "Tri Pros Transfers" → all transfer calls show that label → no "unknown number" missed calls. This DID does NOT participate in the dial rotation, has no daily cap pressure, and never gets flagged as spam (it only places ~50-100 calls/day to ~3 specific cell numbers we own).

### Push notification + PWA deep links

Uses existing push pipeline (per `pattern-push-notifications.md` memory):
- Pre-transfer push: "Incoming transfer — Joe Smith — roofing — Burbank" (mobile mode only; redundant context before the cell rings)
- Post-call push: "Disposition needed — Joe Smith" → deep link to `/dashboard/dialer/incoming?dispositionAttempt=<uuid>`

Existing PWA infrastructure (per `docs/codebase-conventions/app-shell.md`) handles deep links + safe-area + manifest scope.

---

## 9. Build Sequence

### Phase 0 — External setup (Week 1-2, mostly parallel)

| Task | Owner | Long pole? |
|---|---|---|
| Twilio account, buy 5 SoCal-area-code DIDs (310, 213, 818, 949, 626) + 1 dedicated transfer-target DID | You | No |
| Twilio Trust Hub business profile + STIR/SHAKEN registration | You | **Yes — 1-2 wk vetting** |
| Twilio 10DLC campaign registration (for SMS) | You | **Yes — 1-2 wk vetting**, parallel with STIR/SHAKEN |
| Retell account, import Twilio DIDs as BYO, test outbound from their dashboard | You | No |
| Sendblue account + verification | You | No |
| TCPA attorney consult (recommended) — validate Meta lead ad + web form opt-in covers AI voice + SMS contact | You | Recommended |
| FTC DNC list access (free) | You | No |
| Inngest account setup | You | No (`@migration: source of truth for queues post-pilot`) |
| Webhook subdomain (`dialer.triprosremodeling.com` → Vercel) | You | No |

**Gate to Phase 1:** Trust Hub approved + 10DLC approved + Retell test call works + 6 DIDs in account.

### Phase 1 — MVP end-to-end + messaging foundation (Week 3-4)

| Layer | Files |
|---|---|
| Schemas | All 7 dialer tables + meta.ts pgEnums + lead-sources.dialerConfigJSON migration (single migration) |
| Entities | 7 dialer-* entities, minimal first cut (schemas/, types.ts, constants/, dal/server/, lib/constants.ts for CASL) |
| CASL | Entity name constants + abilities.ts registration |
| Services (vendor) | `voip/twilio.voip-provider.ts`, `ai-voice/retell.ai-voice-agent.ts`, `branded-calling/null.branded-calling.ts`, `messaging/{twilio, sendblue, messaging-router}.ts` |
| Services (dialer) | `dialer/dispatcher/start-test-call.service.ts`, `dialer/transfer-router/find-available-human.service.ts`, `dialer/disposition/record.service.ts` |
| Services (messaging) | `dialer/compliance/opt-out-compliance.service.ts`, manual send pipeline |
| Webhook routes | `app/api/dialer/ai/*`, `app/api/voip/twilio/*`, `app/api/messaging/twilio/inbound`, `app/api/messaging/sendblue/inbound` |
| Softphone widget | `shared/components/dialer/softphone-widget/` (Twilio Voice SDK, JWT endpoint, accept/reject UI) |
| Disposition modal | `shared/components/dialer/call-disposition-picker/` |
| Send message button | `shared/components/dialer/send-message-button/` |
| tRPC | `dialer-attempts.router.ts` (one mutation: `startTestCall`), `dialer-messages.router.ts` (list, send) |
| Admin button | Temporary "Dial customer" button on customer profile (super_admin only, removed in Phase 4) |

**Success criteria (Phase 1 done):**
- ✅ Click "Dial Joe" button → AI dials → Joe picks up → warm-transfer to softphone → human takes call → hangs up → disposition saved
- ✅ Recording captured and playable (gated by CASL)
- ✅ Manual SMS sent to test number lands successfully (iMessage + SMS fallback both verified)
- ✅ Test inbound STOP reply correctly opts out + auto-confirms
- ✅ Pilot test cost: <$50

### Phase 2 — Cadence + compliance + lifecycle branches + auto messaging (Week 5)

| Layer | Files |
|---|---|
| Entity lib | `dialer-attempts/lib/state-machine.ts`, `dialer-lead-states/lib/state-machine.ts`, `dialer-lead-states/lib/derived.ts`, `customers/lib/calling-hours.ts`, `customers/lib/phone.ts` |
| DOCS.md | Per-entity invariants (especially `dialer-attempts/DOCS.md#skipped-compliance-does-not-count-against-cap`) |
| Services (compliance) | `dialer/compliance/{compliance-gate, holiday-calendar, dnc-management, ftc-dnc-sync}.service.ts` (all 8 gates) |
| Services (cadence) | `dialer/cadence/{compute-next-attempt, resolve-config, retry-policy}.service.ts` |
| Services (dispatcher) | `dialer/dispatcher/dispatch-lead.service.ts` (full version with gates + cadence) |
| Cron + workers | Vercel Cron `/api/dialer/cron/tick` (1 min); QStash worker `/api/dialer/dispatch` (`@migration: → Inngest`); daily cron `attempts_today` reset; daily cron FTC DNC sync |
| All 10 branch handlers | `dialer/disposition/handle-{no-answer, voicemail, not-interested, opt-out, wrong-number, callback}.service.ts` |
| Auto messaging triggers | `dialer/messaging/{send-callback-reminder, send-voicemail-followup, send-opt-out-confirm}.service.ts` — hooked into lifecycle |
| Tests | All 10 branches mocked, all 8 compliance gates |

**Success criteria (Phase 2 done):**
- ✅ Enroll 3 test leads, observe automated dial cycles for 24h
- ✅ Each of 10 branches verified at least once
- ✅ DNC, off-hours, no-call-day all correctly skipped with reschedule
- ✅ Reconciliation: no orphaned attempts >30 min
- ✅ Callback reminder, voicemail follow-up, opt-out confirm SMS all auto-fire correctly

### Phase 3 — DID pool management + spam mitigation (Week 6)

| Layer | Files |
|---|---|
| Entity lib | `dialer-dids/lib/{warming-schedule, derived, health-metrics}.ts` |
| DOCS.md | `dialer-dids/DOCS.md` (lifecycle, warming, cooldown rules) |
| Services | `dialer/did-pool/{select, cap, warming, local-presence, health-monitor, rotation}.service.ts` (procurement deferred to Phase 6) |
| Cron | Per-hour health monitor (computes hangup-within-3s%, auto-cooldown) |
| Atomic increments | Cap enforcement via Postgres `UPDATE ... WHERE attempts_today < daily_cap RETURNING` |
| Admin actions | Manual cooldown / retire / promote-from-warming via tRPC mutations |

**Success criteria (Phase 3 done):**
- ✅ 5 dial DIDs warm gradually 20→40→60→80→cap over 12 days
- ✅ Lead area code 818 preferentially uses 818 DID; falls back round-robin
- ✅ Daily cap atomically enforced under concurrent dispatch
- ✅ Simulated 30%+ hangup-within-3s auto-cooldowns within 1 hour
- ✅ Reserved transfer-target DID never enters dial rotation

### Phase 4 — Super-admin config UI + operational dashboard + chat UI (Week 7)

| Layer | Files |
|---|---|
| Entity | `dialer-settings/` (full entity with `lib/resolve-config.ts` merge function) |
| Schema | `dialer-settings.ts` + CHECK constraint for singleton |
| CASL | Add `DIALER_SETTINGS` to abilities (super_admin only) |
| tRPC | `dialer-settings.router.ts` (get, update — super_admin gated) |
| Views | `auto-dialer/ui/views/{dialer-settings, lead-source-dialer-config, dialer-admin, call-history, lead-enrollment, dnc-management, messages-inbox}-view.tsx` |
| Conversation thread | `shared/components/dialer/conversation-thread/` (via prompt-kit registry add) |
| Components | All remaining `shared/components/dialer/*` (badges, indicators, timeline item, recording player) |
| Push wiring | Disposition needed, opt-out, DID flagged, inbound message, kill switch toggle |
| Mobile path | `dialer-user-availability.transfer_mode` + cell phone input + cell-routing branch in transfer-router |
| Audit log | Config changes write `activities` row with before/after diff |
| Kill switch | Big red toggle in dialer-admin-view |

**Success criteria (Phase 4 done):**
- ✅ Super-admin changes `defaults.max_attempts_per_day` 10 → 5; next dial cycle respects it
- ✅ Per-source override correctly overrides global default
- ✅ Daily volume dashboard updates within 30s
- ✅ Per-DID health table accurate; manual cooldown via UI works
- ✅ Bulk-enroll 10 leads from customer pipeline multi-select
- ✅ DNC add via UI; subsequent dials correctly skip with `skip_reason='dnc_hit'`
- ✅ Kill switch toggled → no new dials; in-flight calls complete; resume works
- ✅ Conversation thread visible on customer profile, manual send works
- ✅ **Mobile mode validated end-to-end:** human in mobile mode takes a transfer on cell, dispositions via PWA push deep-link

### Phase 5 — Customer-side integration + observability (Week 8-9)

| Where | What |
|---|---|
| `entities/customers/components/timeline/` | Render `call-attempt-timeline-item` + `conversation-thread` for activities with `type='call_attempt'` |
| `entities/customers/components/profile/` | `lead-state-badge`, `dialing-indicator`, `enroll-in-dialer-button`, DNC banner, `send-message-button` |
| `features/customer-pipelines/` | Pipeline rows: dialing indicator, next-attempt-at, status badge, unread message count |
| `features/agent-dashboard/` | Today's dialer stats widget (volume, answer rate, transfers, messages) |
| Nightly cron | Twilio call log reconciliation — backfill orphaned attempts >30min |
| Recording playback | tRPC procedure with CASL `view_recording` permission |
| Alerting | Sentry on webhook 5xx, Retell API failures, dispatch failures, DID flagged |

**Success criteria (Phase 5 done):**
- ✅ Customer profile shows every call attempt + message thread in timeline
- ✅ Pipeline view reflects real-time dialing status (≤10s polling lag)
- ✅ Reconciliation catches simulated orphaned attempts
- ✅ 7-day production run: 100+ live transfers, <5% reconciliation gap, zero compliance incidents

### Phase 6+ — Triggered optimizations (Month 3+)

| Trigger | Action |
|---|---|
| Observed answer rate <15% for 1 week | Activate Hiya Connect (`services/branded-calling/hiya.branded-calling.ts` replaces null) |
| QStash → Inngest migration ready | Migrate dispatcher / cadence to Inngest functions (`@migration` comments mark all touchpoints) |
| Monthly Twilio voice >$300 | Evaluate Telnyx (swap `services/voip/` concrete impl) |
| Monthly Retell >$2K | Upgrade to Retell Enterprise tier ($3K/mo @ $0.05/min) |
| Hiring 3rd VA AND queue/coaching blocking | Evaluate CloudTalk for human-side OR extend our softphone widget |
| Ably realtime kernel ships | Replace polling with realtime (dialing indicator, message threads, availability) |
| Need cross-channel drip | Add scheduled SMS sequences (Day 1 / Day 3 / Day 7) via `services/messaging/scheduler` |
| Want script A/B testing | A/B harness on `dialerConfigJSON.ai_greeting_override` + `message_templates` |

### Total timeline

- **Linear:** 9-10 weeks
- **Compressed via parallel dispatched sessions:** 6-7 weeks
- Phase 0 must finish first; Phase 1 + 2 can overlap; Phase 3 + 4 can largely run in parallel after Phase 2

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Twilio Trust Hub vetting takes >2 weeks | Medium | Delays everything | Submit Phase 0 Day 1; parallel work on entities + tests; can use unregistered DIDs for sandbox testing |
| 10DLC vetting fails or delays | Low | Delays messaging only | SMS becomes Phase 2 instead of Phase 1; foundation can still ship without sending |
| Retell BYO Twilio integration has unexpected friction | Low | Delays Phase 1 | Validate in Phase 0 via Retell dashboard test calls before writing code |
| Vercel function timeout (60s) hit at scale | Low | Failed dispatches | Inngest migration eliminates this entirely; pilot uses small batch sizes |
| Webhook signature verification fails (vendor sends invalid) | Low | Silent dropped events | Reconciliation cron backfills; alerting on signature-failure rate |
| Recording disclosure not in AI script (since system doesn't enforce) | Medium | TCPA / CA violation | Owner-managed reminder in `lead-source-dialer-config-view.tsx` UI ("Make sure your AI greeting discloses recording") |
| DID flagging happens during pilot | High | Answer rate craters | Phase 2 trigger for Hiya Connect; manual rotation in Phase 1 |
| Lead reports we called them outside opted-in scope | Low (opt-in posture) | Reputational + TCPA risk | Audit log of every attempt + skip reason; TCPA attorney consult Phase 0 |
| Sendblue iMessage outage | Low-medium | Fall back to SMS | Messaging router auto-fails over to Twilio SMS; alerting on Sendblue error rate |
| Apple banhammers Sendblue | Low (medium-term) | iMessage capability lost | SMS still works via Twilio; service abstraction means swap to another iMessage provider is contained |
| Single-human bottleneck blocks scaling | Medium | Caps growth | Phase 4 adds N-human routing (only 1 in pilot but pool architecture); CloudTalk Phase 6+ trigger covers VA queue features |
| Mobile push notification missed (iOS PWA limitations) | Medium | Disposition lag | Disposition can also be set later from dashboard; SMS fallback to human's cell as backup |

---

## 11. Considered & Rejected

### CloudTalk (or similar off-the-shelf dialer suite)
**Why considered:** Polished UI, native mobile apps, recording mgmt, DID pool, integrations all out of the box. Per-seat pricing.
**Why rejected:**
- Cost is a wash with custom (±10% at every scale modeled)
- Saves only ~20% of build time (hard parts — cadence, compliance, AI integration, customer-side integration — are still ours)
- Forces split UX (humans switch between CloudTalk + Tri Pros app)
- Vendor lock-in much harder to swap
- Doesn't fit "app is the UI" mandate
**Revisit trigger:** Hiring 3rd+ VA AND queue/coaching/supervisor features become blocking. Phase 6+.

### Bland.ai
**Why considered:** Strong AI voice, BYO Twilio, lower marketed per-minute price than NLPearl.
**Why rejected:**
- $0.015/attempt fee even on no-answers is brutal at our volume (~1,500 unanswered attempts/wk = $90/wk dead-air fees)
- Independent latency reports inconsistent (700-2500ms vs marketing's <400ms)
- Discord-only support unsuitable for production single-seller transfer flow
- Pricing structure obscures unit economics at scale

### Vapi
**Why considered:** YC-backed, very extensible, BYO Twilio + warm transfer documented, strong voicemail detection.
**Why rejected:**
- Real-world cost ~2x Retell ($0.23-0.33/min vs $0.13/min)
- For "thousands of attempts/week, mostly unanswered," that markup compounds
- Could be considered if Retell degrades

### Synthflow
**Why considered:** No-code AI voice builder, decent PAYG ergonomics.
**Why rejected:** Warm-transfer-with-briefing isn't clearly documented; you'd be a beta tester for the exact feature we depend on.

### NLPearl
**Why considered:** Polished UI, established player.
**Why rejected:** Smaller scale, e-commerce/CX-tilted, less North American outbound social proof, credit-based pricing obscures unit economics.

### RingCentral / Five9 / Genesys / NICE
**Why considered:** Enterprise contact-center platforms with everything.
**Why rejected:** Heavier than needed, per-seat pricing scales painfully, less developer-friendly than Twilio. Wrong tier for our scale.

### Telnyx as primary backbone (pilot)
**Why considered:** ~50% cheaper voice, automatic A-attestation, richer Call Control webhooks.
**Why rejected for pilot:** Retell-via-Telnyx-SIP path is less battle-tested than BYO-Twilio. Adds 1-2 weeks of integration debugging up front. Worth it as Phase 6+ optimization once Phase 1-4 are stable.

### Manual dial / IVR press-1 / power-dialer-only / build Retell-equivalent
**Why considered briefly:** Cost-saving alternatives.
**Why rejected:** All deliver worse throughput AND/OR worse answer rate AND/OR worse human utilization. ROI math (3-4x human throughput improvement at <$1K/mo for full Retell stack) is overwhelming.

---

## 12. Migration Roadmap (`@migration` annotations)

Every place in the code that uses a "now" provider that will be swapped later is annotated with `@migration` comments pointing to the target:

| Annotation | Now | Target | Trigger |
|---|---|---|---|
| `@migration: → Inngest` | QStash for queued dial dispatch + delayed messages | Inngest durable workflows | Inngest provider integration complete |
| `@migration: → Ably kernel` | TanStack Query polling (`refetchInterval`) for dialing indicator, conversation thread updates, availability | Ably realtime kernel subscriptions | Ably kernel ships per `project-ably-realtime-kernel.md` |
| `@migration: → Hiya Connect` | `services/branded-calling/null.branded-calling.ts` (no-op) | `services/branded-calling/hiya.branded-calling.ts` | Answer rate <15% sustained OR hangup-3s% >25% |
| `@migration: → Telnyx` | `services/voip/twilio.voip-provider.ts` | `services/voip/telnyx.voip-provider.ts` | Monthly Twilio voice spend >$300 |
| `@migration: → Retell Enterprise` | Retell PAYG ($0.13/min) | Retell Enterprise ($0.05/min @ $3K/mo commit) | Monthly Retell spend >$2K |
| `@migration: → Reassigned Numbers DB check` | Skipped in pilot | Add to compliance gates | Phase 6+ when lead vintage >12 months |

All `@migration` comments are searchable via `grep -r "@migration:" src/` for migration-day visibility.

---

## 13. Open Questions / Deferred Decisions

| Question | When to decide | Default for now |
|---|---|---|
| Exact AI script content + per-source variations | Phase 0 (alongside attorney consult) | Owner-managed; system has no default text |
| Exact pilot DID area codes | Phase 0 (after geographic lead distribution analysis) | 310, 213, 818, 949, 626 + 1 reserved transfer-target DID |
| Recording disclosure language | Phase 0 | Owner-managed within AI greeting |
| Auto-enrollment per lead source | Phase 4 | Manual-only enrollment in pilot |
| Wireless DNC subscription | Phase 6+ | Skip in pilot; ~$50-150/mo when activated |
| Customer-data deletion request workflow | Phase 6+ (likely paired with compliance review) | Manual admin-led for pilot |
| MMS / image sending | Phase 6+ | SMS text-only in pilot |
| Customer-side AI-suggested replies in chat UI | Phase 6+ | Human composes manually in pilot |
| Multi-seller routing rules (load balancing, skill-based) | When 2nd human onboards | "Any available human" round-robin (least-recently-transferred wins ties) |
| Sunday calling | Owner decision | Excluded in pilot defaults; super-admin can override |

---

## 14. Glossary

- **DID** — Direct Inward Dialing number (a phone number we own and can call from)
- **STIR/SHAKEN** — Carrier-level standard for verifying caller identity; A-attestation is the highest trust level
- **CNAM** — Caller ID Name (the business-name display on receiving phones)
- **Branded calling** — Beyond CNAM; shows logo + reason on supporting handsets
- **10DLC** — 10-Digit Long Code; the required B2C SMS carrier registration program
- **Warm transfer** — AI announces context to the receiving human before bridging the lead (vs. cold transfer = direct dump)
- **Local presence** — Outbound caller ID matched to the lead's area code (proven to lift answer rate)
- **Cadence decay** — Reducing dial frequency over time for unreached leads (e.g., 10/day for 3 days → 2/day for 7 days → 1/day for 14 days → exhausted)
- **PSTN** — Public Switched Telephone Network (the regular phone network, vs. WebRTC/VoIP)
- **CASL** — `@casl/ability` — the role-based authorization library this codebase uses
