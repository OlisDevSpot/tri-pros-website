# Phase 1 — MVP End-to-End Transfer + Messaging Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Parent epic:** [EPIC.md](./EPIC.md)
> **Spec section:** §9 Phase 1
> **Prerequisite:** [Phase 0](./phase-0-setup.md) gate satisfied — see EPIC.md "Phase 0 outcomes" for current state
> **Status:** Ready to start (2026-05-22)

**Goal:** Ship the minimum viable end-to-end flow: a super-admin clicks "Dial now (AI)" on a customer profile → AI dials → lead picks up → warm-transferred to softphone in dashboard → human takes call → dispositions. Plus messaging foundation: manual **SMS** send (Twilio-only — Sendblue deferred), inbound STOP keyword handling.

**Architecture:** Custom orchestrator in our tRPC + services + DAL layers. Vendor-abstracted: Twilio (VoIP + messaging) + Retell (AI voice via SIP trunking) + null branded-calling (Phase 2 trigger). Per-source Retell agents stored in `lead_sources.dialerConfigJSON.retell_agent_id`. Dev-override env var `DIALER_DEV_OVERRIDE_NUMBER` for safe dev calls. 3rd-party React wrapper for Twilio Voice SDK (chosen via Task 2 spike). No automated tests in Phase 1 — manual verification per task. Annotated with `@migration` comments for Inngest, Ably realtime kernel, Hiya Connect, **Sendblue (iMessage premium)**.

**Tech Stack:** TypeScript, Next.js App Router, tRPC, Drizzle ORM (Postgres/Neon), CASL, Twilio (`twilio` server SDK + `@twilio/voice-sdk` browser), Retell SDK, drizzle-zod, QStash (`@migration: → Inngest`).

---

## Phase 0 → Phase 1 scope adjustments (locked in 2026-05-22)

Three scope changes from the original plan, all logged in EPIC.md decisions log:

1. **Sendblue (iMessage) deferred.** Phase 1 implements Twilio-only messaging through the existing `services/messaging/` vendor abstraction. Task 25 (Sendblue impl + auto-fallback router) and Task 34 (Sendblue webhooks) are **DEFERRED**. The `MessagingProvider` interface keeps `channel: 'sms' | 'imessage'` so Sendblue can drop in later as a concrete `imessage` impl without interface changes. `dialer_messages` schema keeps `sendblue_message_id` column (nullable) and channel enum keeps `'imessage'` + `'fallback_sms'` values — schema is forward-compatible.
2. **iPhone Live Voicemail = Retell built-in.** No special prompt engineering required — Retell's agent platform handles the "please state your name and reason for calling" screening prompt natively. Verified in Phase 0 test call. Do NOT add Live Voicemail handling logic to Phase 1 agent prompts.
3. **Twilio Voice connectivity = SIP Trunking, NOT API import.** Retell doesn't have a Twilio-API-credential import path. Phase 0 set up an Elastic SIP Trunk (`tripros.pstn.twilio.com`) with credential auth + Retell origination at `sip:sip.retellai.com`. Phase 1's `services/voip/twilio.voip-provider.ts` should reflect this — outbound dials route via the established SIP trunk, not via fresh Programmable Voice connections.

**Tasks blocked by Phase 0 vetting clocks (do these last):**
- **Twilio SMS send** (Tasks 24, 30, 38) — gated by 10DLC Campaign approval (3-14 days from 2026-05-21 submission)
- **DNC compliance gate** (referenced in Task 26 opt-out service) — gated by FCC DNC SAN issuance (1-2 business days from 2026-05-21 submission)

Everything else — schema, entities, services, Retell webhooks, softphone widget, dialer admin UI, seed scripts — is fully unblocked and can be implemented immediately.

---

## Decisions captured from grilling

1. **No automated tests.** Manual verification + telemetry, per existing codebase pattern. Each task has explicit manual verification steps; no test code written.
2. **Per-source Retell agents from day one.** `lead_sources.dialerConfigJSON.retell_agent_id` is required & used. Owner creates one Retell agent per dialer-enabled lead source.
3. **Dev override env var** `DIALER_DEV_OVERRIDE_NUMBER` forces all dial-to numbers to that one number during dev/preview. CI gate prevents it being set on production.
4. **3rd-party React wrapper for Twilio Voice SDK** — Task 2 spike evaluates options; if none acceptable, fall back to custom wrapper.
5. **Dial-trigger UI** = dedicated auto-dialer feature page + `shared/components/dialer/call-now-button/` placeable component (Phase 5 mounts on customer profile / pipeline / dashboard).

---

## File structure (Phase 1 deliverables)

### New schema files (`src/shared/db/schema/`)
- `dialer-attempts.ts` — per-call lifecycle records
- `dialer-dids.ts` — DID pool state
- `dialer-lead-states.ts` — per-customer cadence state (Phase 1: minimal — full lifecycle in Phase 2)
- `dialer-dnc.ts` — Do-Not-Call list
- `dialer-user-availability.ts` — transfer-target presence
- `dialer-settings.ts` — singleton config (Phase 1: created with defaults, UI in Phase 4)
- `dialer-messages.ts` — SMS/iMessage history

### Modified schema
- `meta.ts` — add 9 new pgEnums
- `lead-sources.ts` — add `dialerConfigJSON` JSONB field

### New enum file (`src/shared/constants/enums/`)
- `dialer.ts` — 9 const arrays + derived types

### New backend entities (`src/shared/entities/`) — minimal Phase 1 cuts
Each entity has: `DOCS.md`, `schemas/`, `types.ts`, `constants/`, `lib/constants.ts` (CASL name), `dal/server/{create,findById,update,list}.ts`. **No** `components/`, `hooks/`, or `lib/state-machine.ts` in Phase 1 (deferred to Phase 2+).

- `entities/dialer-attempts/`
- `entities/dialer-dids/`
- `entities/dialer-lead-states/`
- `entities/dialer-dnc/`
- `entities/dialer-user-availability/`
- `entities/dialer-settings/`
- `entities/dialer-messages/`

### Modified abilities
- `domains/permissions/abilities.ts` — register 7 new entity names

### New vendor service providers (`src/services/`)
- `voip/voip-provider.interface.ts`
- `voip/twilio.voip-provider.ts`
- `voip/voip-provider.factory.ts`
- `ai-voice/ai-voice-agent.interface.ts`
- `ai-voice/retell.ai-voice-agent.ts`
- `branded-calling/branded-calling.interface.ts`
- `branded-calling/null.branded-calling.ts`
- `messaging/messaging-provider.interface.ts`
- `messaging/twilio.messaging-provider.ts`
- `messaging/sendblue.messaging-provider.ts`
- `messaging/messaging-router.service.ts`

### New orchestration services (`src/services/dialer/`)
- `dispatcher/start-test-call.service.ts` — manual one-off dial trigger
- `transfer-router/find-available-human.service.ts` — picks first available human
- `transfer-router/build-warm-intro.service.ts` — composes verbal warm-intro string
- `disposition/record.service.ts` — persist disposition
- `compliance/opt-out-compliance.service.ts` — shared opt-out handler (B5 + SMS STOP)

### New webhook routes (`src/app/api/`)
- `voip/twilio/access-token/route.ts` — issue JWT for browser softphone
- `voip/twilio/status/route.ts` — call lifecycle status callback
- `voip/twilio/recording/route.ts` — recording-ready callback
- `dialer/ai/lead-context/route.ts` — Retell mid-call function (lead lookup)
- `dialer/ai/route-transfer/route.ts` — Retell mid-call function (available human)
- `dialer/ai/log-disposition/route.ts` — Retell function (set disposition)
- `dialer/ai/call-completed/route.ts` — Retell webhook (final state)
- `messaging/twilio/inbound/route.ts` — inbound SMS (STOP handler)
- `messaging/twilio/status/route.ts` — SMS delivery status
- `messaging/sendblue/inbound/route.ts` — inbound iMessage
- `messaging/sendblue/status/route.ts` — iMessage delivery status

### New tRPC routers (`src/trpc/routers/`)
- `dialer-attempts.router.ts` — `startTestCall` mutation + `list` query
- `dialer-messages.router.ts` — `send` mutation + `list` query
- Modified: `app.ts` — register both routers

### New shared UI components (`src/shared/components/dialer/`)
- `softphone-widget/` — Twilio Voice SDK integration (via chosen 3rd-party wrapper)
- `call-disposition-picker/` — modal opened after call ends
- `send-message-button/` — embeddable message-send action
- `call-now-button/` — placeable "Dial now (AI)" trigger

### New feature surface (`src/features/auto-dialer/`)
- `ui/views/dialer-admin-view.tsx` — Phase 1: test page with `call-now-button` + recent attempts table

### New route
- `src/app/(frontend)/(dashboard)/auto-dialer/page.tsx` — mounts `dialer-admin-view`

### Modified layout
- `src/app/(frontend)/(dashboard)/layout.tsx` — mount `softphone-widget` globally

### Seed scripts (`scripts/`)
- `seed-dialer-dids.ts` — insert 3 DIDs from Phase 0 procurement (213=transfer-target, 424=dial, 626=dial). Pool expansion to 7-10 numbers deferred to ~1-2 weeks before Phase 2 ramp — keeps fresh DIDs out of the warm-up clock until needed.
- `seed-dialer-lead-source.ts` — configure one example lead source with `dialerConfigJSON.enabled=true + retell_agent_id`

---

## Manual verification gate (Phase 1 done when ALL pass)

- ✅ Super-admin clicks "Dial now (AI)" on a test customer profile → that customer's phone (overridden to `DIALER_DEV_OVERRIDE_NUMBER`) rings within 5s
- ✅ Test phone picks up; hears the configured Retell agent's greeting; AI passes lead context correctly (name, trade)
- ✅ Lead says "yes, transfer me"; softphone widget in dashboard shows incoming-transfer banner with lead context within 3s
- ✅ Click Accept; audio bridges; can talk both ways
- ✅ Hang up; disposition modal appears; save "Booked meeting"; verify `dialer_attempts` row has final state + recording URL
- ✅ Recording URL is playable from the customer profile (or admin page in Phase 1)
- ✅ Send a test SMS via `send-message-button` from admin page; message arrives on test phone; row created in `dialer_messages`
- ⏸ ~~Send a test iMessage via the same button; arrives blue on iPhone, falls back to green SMS on Android~~ **DEFERRED — Sendblue deferred post-Phase-1**
- ✅ Reply STOP from test phone; `dialer_dnc` row created; auto-confirmation SMS received
- ✅ `pnpm tsc` clean
- ✅ `pnpm lint` clean
- ✅ Production stack cost during Phase 1: <$50

---

## Tasks

> **Convention:** every task ends with `pnpm tsc && pnpm lint` (NEVER `pnpm build` — see CLAUDE.md). Conventional commit messages: `feat(dialer): ...`, `feat(messaging): ...`, `chore(dialer): ...`. Use `pnpm db:push:dev` for schema pushes (NEVER `pnpm db:push`).
>
> **Manual verification format:** each task ends with explicit steps the developer runs to validate. If any step fails, the task is not complete — debug before committing.

---

### Task 1: Install vendor SDK dependencies + env var scaffolding

**Files:**
- Modify: `package.json`
- Modify: `.env.local` (developer's local; not committed)
- Create: `docs/plans/auto-dialer/env-vars-reference.md` (committed reference)

- [ ] **Step 1.1: Install packages**

```bash
pnpm add twilio @twilio/voice-sdk retell-sdk
pnpm add -D @types/twilio
```

`twilio` is the server SDK. `@twilio/voice-sdk` is the browser SDK. `retell-sdk` is Retell's official SDK. Sendblue is fetch-based — no SDK needed.

- [ ] **Step 1.2: Create env vars reference doc**

Create `docs/plans/auto-dialer/env-vars-reference.md`:

```markdown
# Auto-dialer env vars

## Server-side (Vercel + .env.local)

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SID=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx       # for Voice SDK JWT signing
TWILIO_API_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx     # TwiML app for browser Client

# Pilot DIDs — E.164 + SID per number. Role lives in dialer_dids.role once seeded.
TWILIO_DID_213_E164=+1213XXXXXXX
TWILIO_DID_213_SID=PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_DID_424_E164=+1424XXXXXXX
TWILIO_DID_424_SID=PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_DID_626_E164=+1626XXXXXXX
TWILIO_DID_626_SID=PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Transfer-target role pointer — read at runtime for the human-leg dial (no DB hit).
# Also tells seed-dialer-dids.ts which DID gets role='transfer_target'. Mirrors TWILIO_DID_213_E164 in the pilot.
TWILIO_TRANSFER_TARGET_DID_E164=+1213XXXXXXX

# Retell
RETELL_API_KEY=key_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Sendblue — DEFERRED (Phase 1 ships Twilio-only messaging)
# SENDBLUE_API_KEY_ID=
# SENDBLUE_API_SECRET=

# Webhook public URL (Vercel deployment URL OR custom subdomain)
DIALER_WEBHOOK_BASE_URL=https://dialer.triprosremodeling.com

# DEV ONLY: forces all outbound dialer calls to a single test number (your cell)
# MUST be unset in production. CI gate enforces this.
DIALER_DEV_OVERRIDE_NUMBER=+1XXXXXXXXXX  # leave unset in production
```

- [ ] **Step 1.3: Add CI gate for production env**

Create `scripts/lib/check-prod-env.ts` (or extend existing if present):

```ts
if (process.env.NODE_ENV === 'production' && process.env.DIALER_DEV_OVERRIDE_NUMBER) {
  console.error('❌ DIALER_DEV_OVERRIDE_NUMBER must NOT be set in production')
  process.exit(1)
}
```

Hook into existing CI or pre-deploy verification (check if there's a `pre-build` script in package.json; if so, add this; otherwise note for future CI work).

- [ ] **Step 1.4: Verify**

```bash
pnpm tsc
pnpm lint
```

Both clean. Packages visible in `pnpm-lock.yaml` diff.

- [ ] **Step 1.5: Commit**

```bash
git add package.json pnpm-lock.yaml docs/plans/auto-dialer/env-vars-reference.md scripts/lib/check-prod-env.ts
git commit -m "$(cat <<'EOF'
feat(dialer): add Twilio + Retell SDKs + env var scaffolding

Adds @twilio/voice-sdk, twilio (server), retell-sdk dependencies.
Documents required env vars in env-vars-reference.md.
Adds CI gate preventing DIALER_DEV_OVERRIDE_NUMBER in production.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Spike — choose Twilio Voice SDK React wrapper

**Files:**
- Create: `docs/plans/auto-dialer/spike-twilio-voice-react-wrapper.md`

- [ ] **Step 2.1: Search npm + GitHub for current React wrappers around `@twilio/voice-sdk`**

Search terms to use:
- `@twilio/voice-sdk react`
- `twilio voice react hooks`
- `twilio webrtc react`
- `react twilio device`

Catalog candidates. Common patterns include `react-twilio-voice-sdk`, hand-rolled hooks from blog posts, and various community packages.

- [ ] **Step 2.2: Evaluate each candidate against these criteria**

For each candidate, document:
1. GitHub stars + last commit date (must be ≤6 months stale)
2. TypeScript native (not just typed via @types)
3. Twilio SDK version supported (must support `@twilio/voice-sdk` v2.x)
4. API surface coverage: `Device.register()`, `Device.on('incoming', ...)`, `Call.accept()`, `Call.reject()`, `Call.disconnect()`, `Call.mute()`, custom parameters access
5. Open issues — any critical bugs?
6. License (MIT preferred)
7. Number of weekly npm downloads (proxy for community health)

- [ ] **Step 2.3: Document choice + fallback**

Create `docs/plans/auto-dialer/spike-twilio-voice-react-wrapper.md`:

```markdown
# Spike: Twilio Voice SDK React wrapper choice

## Candidates evaluated

| Package | Stars | Last commit | TS native | API coverage | Decision |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... |

## Choice

**Chosen:** `<package-name>` (or "Custom wrapper" if none qualified)

**Rationale:** ...

**Fallback:** if `<package-name>` proves limiting during implementation, fall back to custom hook + provider wrapping `@twilio/voice-sdk` directly. Estimated fallback cost: ~1 day.
```

- [ ] **Step 2.4: Install the chosen package (if any)**

```bash
pnpm add <chosen-package>
```

If none qualified, skip; Task 22 will build a custom wrapper.

- [ ] **Step 2.5: Verify + commit**

```bash
pnpm tsc
pnpm lint
git add docs/plans/auto-dialer/spike-twilio-voice-react-wrapper.md package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(dialer): spike + choose Twilio Voice SDK React wrapper

Evaluates available 3rd-party React wrappers for @twilio/voice-sdk.
Documents choice and fallback plan in spike note.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Dialer enum const arrays + types

**Files:**
- Create: `src/shared/constants/enums/dialer.ts`
- Modify: `src/shared/constants/enums/index.ts`

- [ ] **Step 3.1: Create enum const file**

Create `src/shared/constants/enums/dialer.ts`:

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

export const dialerLeadStateStatuses = [
  'queued', 'in_progress', 'reached', 'opted_out', 'exhausted', 'paused',
] as const
export type DialerLeadStateStatus = (typeof dialerLeadStateStatuses)[number]

export const dialerDncSources = [
  'lead_request', 'manual_admin', 'ftc_dnc', 'wireless_dnc', 'state_dnc', 'sms_opt_out',
] as const
export type DialerDncSource = (typeof dialerDncSources)[number]

export const dialerUserAvailabilities = ['available', 'off_shift'] as const
export type DialerUserAvailability = (typeof dialerUserAvailabilities)[number]

export const dialerTransferModes = ['desktop', 'mobile', 'auto'] as const
export type DialerTransferMode = (typeof dialerTransferModes)[number]

export const dialerMessageStatuses = [
  'queued', 'sent', 'delivered', 'failed', 'undelivered', 'received',
] as const
export type DialerMessageStatus = (typeof dialerMessageStatuses)[number]

export const dialerMessageChannels = ['sms', 'imessage', 'fallback_sms'] as const
export type DialerMessageChannel = (typeof dialerMessageChannels)[number]

export const dialerMessageDirections = ['outbound', 'inbound'] as const
export type DialerMessageDirection = (typeof dialerMessageDirections)[number]
```

- [ ] **Step 3.2: Update barrel export**

In `src/shared/constants/enums/index.ts`, add:
```ts
export * from './dialer'
```

(Match existing pattern — re-read the current `index.ts` first and follow its style.)

- [ ] **Step 3.3: Verify + commit**

```bash
pnpm tsc
pnpm lint
git add src/shared/constants/enums/dialer.ts src/shared/constants/enums/index.ts
git commit -m "feat(dialer): add 10 dialer enum const arrays + types

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: pgEnum declarations in meta.ts

**Files:**
- Modify: `src/shared/db/schema/meta.ts`

- [ ] **Step 4.1: Add pgEnum declarations**

In `src/shared/db/schema/meta.ts`, add at the bottom (after existing enum declarations):

```ts
// DIALER
import {
  dialerAttemptStatuses,
  dialerDispositions,
  dialerDidStatuses,
  dialerLeadStateStatuses,
  dialerDncSources,
  dialerUserAvailabilities,
  dialerTransferModes,
  dialerMessageStatuses,
  dialerMessageChannels,
  dialerMessageDirections,
} from '@/shared/constants/enums'

export const dialerAttemptStatusEnum = pgEnum('dialer_attempt_status', dialerAttemptStatuses)
export const dialerDispositionEnum = pgEnum('dialer_disposition', dialerDispositions)
export const dialerDidStatusEnum = pgEnum('dialer_did_status', dialerDidStatuses)
export const dialerLeadStateStatusEnum = pgEnum('dialer_lead_state_status', dialerLeadStateStatuses)
export const dialerDncSourceEnum = pgEnum('dialer_dnc_source', dialerDncSources)
export const dialerUserAvailabilityEnum = pgEnum('dialer_user_availability', dialerUserAvailabilities)
export const dialerTransferModeEnum = pgEnum('dialer_transfer_mode', dialerTransferModes)
export const dialerMessageStatusEnum = pgEnum('dialer_message_status', dialerMessageStatuses)
export const dialerMessageChannelEnum = pgEnum('dialer_message_channel', dialerMessageChannels)
export const dialerMessageDirectionEnum = pgEnum('dialer_message_direction', dialerMessageDirections)
```

(Merge the new import with the existing import from `@/shared/constants/enums` — don't add a separate import block.)

- [ ] **Step 4.2: Verify + commit**

```bash
pnpm tsc
pnpm lint
git add src/shared/db/schema/meta.ts
git commit -m "feat(dialer): register pgEnums for dialer entities in meta.ts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: dialer_attempts table + Zod schemas

**Files:**
- Create: `src/shared/db/schema/dialer-attempts.ts`

- [ ] **Step 5.1: Create the schema file**

Create `src/shared/db/schema/dialer-attempts.ts`:

```ts
import type z from 'zod'
import { relations } from 'drizzle-orm'
import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'
import {
  dialerAttemptStatusEnum,
  dialerDispositionEnum,
} from './meta'

export const dialerAttempts = pgTable('dialer_attempts', {
  id,
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  didUsed: text('did_used').notNull(),
  retellCallId: text('retell_call_id').unique(),
  twilioCallSid: text('twilio_call_sid').unique(),
  status: dialerAttemptStatusEnum('status').notNull().default('queued'),
  initiatedAt: timestamp('initiated_at', { mode: 'string', withTimezone: true }).defaultNow().notNull(),
  answeredAt: timestamp('answered_at', { mode: 'string', withTimezone: true }),
  transferredAt: timestamp('transferred_at', { mode: 'string', withTimezone: true }),
  endedAt: timestamp('ended_at', { mode: 'string', withTimezone: true }),
  transferredToUserId: text('transferred_to_user_id').references(() => user.id, { onDelete: 'set null' }),
  durationSeconds: integer('duration_seconds'),
  disposition: dialerDispositionEnum('disposition'),
  skipReason: text('skip_reason'),
  aiSummary: text('ai_summary'),
  aiSentiment: text('ai_sentiment'),
  recordingUrl: text('recording_url'),
  recordingDurationSeconds: integer('recording_duration_seconds'),
  metaJson: jsonb('meta_json'),
  createdAt,
  updatedAt,
})

export const dialerAttemptsRelations = relations(dialerAttempts, ({ one }) => ({
  customer: one(customers, { fields: [dialerAttempts.customerId], references: [customers.id] }),
  transferredToUser: one(user, { fields: [dialerAttempts.transferredToUserId], references: [user.id] }),
}))

export const selectDialerAttemptSchema = createSelectSchema(dialerAttempts)
export type DialerAttempt = z.infer<typeof selectDialerAttemptSchema>

export const insertDialerAttemptSchema = createInsertSchema(dialerAttempts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertDialerAttempt = z.infer<typeof insertDialerAttemptSchema>
```

- [ ] **Step 5.2: Verify (no db:push yet — batched in Task 12)**

```bash
pnpm tsc
pnpm lint
```

- [ ] **Step 5.3: Commit**

```bash
git add src/shared/db/schema/dialer-attempts.ts
git commit -m "feat(dialer): add dialer_attempts table schema

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: dialer_dids table

**Files:** Create `src/shared/db/schema/dialer-dids.ts`

- [ ] **Step 6.1: Create the schema file**

```ts
import type z from 'zod'
import { boolean, integer, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { dialerDidStatusEnum } from './meta'

export const dialerDids = pgTable('dialer_dids', {
  id,
  e164Number: text('e164_number').notNull().unique(),
  areaCode: varchar('area_code', { length: 3 }).notNull(),
  twilioPhoneSid: text('twilio_phone_sid').notNull().unique(),
  status: dialerDidStatusEnum('status').notNull().default('warming'),
  dailyCap: integer('daily_cap').notNull().default(20),
  attemptsToday: integer('attempts_today').notNull().default(0),
  attemptsTotal: integer('attempts_total').notNull().default(0),
  lastAttemptAt: timestamp('last_attempt_at', { mode: 'string', withTimezone: true }),
  lastFlaggedAt: timestamp('last_flagged_at', { mode: 'string', withTimezone: true }),
  flagReason: text('flag_reason'),
  warmingStartedAt: timestamp('warming_started_at', { mode: 'string', withTimezone: true }),
  reputationDataJson: jsonb('reputation_data_json'),
  isTransferTargetDid: boolean('is_transfer_target_did').notNull().default(false),
  createdAt,
  updatedAt,
})

export const selectDialerDidSchema = createSelectSchema(dialerDids)
export type DialerDid = z.infer<typeof selectDialerDidSchema>

export const insertDialerDidSchema = createInsertSchema(dialerDids).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertDialerDid = z.infer<typeof insertDialerDidSchema>
```

- [ ] **Step 6.2: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/db/schema/dialer-dids.ts
git commit -m "feat(dialer): add dialer_dids table schema

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: dialer_lead_states table

**Files:** Create `src/shared/db/schema/dialer-lead-states.ts`

- [ ] **Step 7.1: Create the schema file**

```ts
import type z from 'zod'
import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'
import { dialerDispositionEnum, dialerLeadStateStatusEnum } from './meta'

export const dialerLeadStates = pgTable('dialer_lead_states', {
  id,
  customerId: uuid('customer_id').notNull().unique().references(() => customers.id, { onDelete: 'cascade' }),
  enrolledAt: timestamp('enrolled_at', { mode: 'string', withTimezone: true }).defaultNow().notNull(),
  enrolledByUserId: text('enrolled_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  status: dialerLeadStateStatusEnum('status').notNull().default('queued'),
  nextAttemptAt: timestamp('next_attempt_at', { mode: 'string', withTimezone: true }),
  lastAttemptAt: timestamp('last_attempt_at', { mode: 'string', withTimezone: true }),
  attemptsToday: integer('attempts_today').notNull().default(0),
  attemptsTotal: integer('attempts_total').notNull().default(0),
  maxAttemptsPerDay: integer('max_attempts_per_day').notNull().default(10),
  maxTotalAttempts: integer('max_total_attempts').notNull().default(50),
  lastDisposition: dialerDispositionEnum('last_disposition'),
  pauseUntil: timestamp('pause_until', { mode: 'string', withTimezone: true }),
  notes: text('notes'),
  createdAt,
  updatedAt,
})

export const selectDialerLeadStateSchema = createSelectSchema(dialerLeadStates)
export type DialerLeadState = z.infer<typeof selectDialerLeadStateSchema>

export const insertDialerLeadStateSchema = createInsertSchema(dialerLeadStates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertDialerLeadState = z.infer<typeof insertDialerLeadStateSchema>
```

- [ ] **Step 7.2: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/db/schema/dialer-lead-states.ts
git commit -m "feat(dialer): add dialer_lead_states table schema

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: dialer_dnc table

**Files:** Create `src/shared/db/schema/dialer-dnc.ts`

- [ ] **Step 8.1: Create the schema file**

```ts
import type z from 'zod'
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id } from '../lib/schema-helpers'
import { user } from './auth'
import { dialerDncSourceEnum } from './meta'

export const dialerDnc = pgTable('dialer_dnc', {
  id,
  phoneE164: text('phone_e164').notNull().unique(),
  source: dialerDncSourceEnum('source').notNull(),
  reason: text('reason'),
  addedAt: timestamp('added_at', { mode: 'string', withTimezone: true }).defaultNow().notNull(),
  addedByUserId: text('added_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  createdAt,
})

export const selectDialerDncSchema = createSelectSchema(dialerDnc)
export type DialerDnc = z.infer<typeof selectDialerDncSchema>

export const insertDialerDncSchema = createInsertSchema(dialerDnc).omit({
  id: true,
  createdAt: true,
})
export type InsertDialerDnc = z.infer<typeof insertDialerDncSchema>
```

- [ ] **Step 8.2: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/db/schema/dialer-dnc.ts
git commit -m "feat(dialer): add dialer_dnc table schema

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: dialer_user_availability table

**Files:** Create `src/shared/db/schema/dialer-user-availability.ts`

- [ ] **Step 9.1: Create the schema file**

```ts
import type z from 'zod'
import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { user } from './auth'
import { dialerTransferModeEnum, dialerUserAvailabilityEnum } from './meta'

export const dialerUserAvailability = pgTable('dialer_user_availability', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  enrolledForTransfers: boolean('enrolled_for_transfers').notNull().default(false),
  manualStatus: dialerUserAvailabilityEnum('manual_status').notNull().default('off_shift'),
  transferMode: dialerTransferModeEnum('transfer_mode').notNull().default('desktop'),
  cellPhoneE164: text('cell_phone_e164'),
  onCallUntil: timestamp('on_call_until', { mode: 'string', withTimezone: true }),
  lastTransferredAt: timestamp('last_transferred_at', { mode: 'string', withTimezone: true }),
  updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true }).defaultNow().notNull(),
})

export const selectDialerUserAvailabilitySchema = createSelectSchema(dialerUserAvailability)
export type DialerUserAvailability = z.infer<typeof selectDialerUserAvailabilitySchema>

export const insertDialerUserAvailabilitySchema = createInsertSchema(dialerUserAvailability).omit({
  updatedAt: true,
})
export type InsertDialerUserAvailability = z.infer<typeof insertDialerUserAvailabilitySchema>
```

- [ ] **Step 9.2: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/db/schema/dialer-user-availability.ts
git commit -m "feat(dialer): add dialer_user_availability table schema

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: dialer_settings singleton table + Zod schema for config

**Files:**
- Create: `src/shared/db/schema/dialer-settings.ts`
- Create: `src/shared/entities/dialer-settings/schemas/config-schema.ts`

- [ ] **Step 10.1: Create the Zod config schema**

Create `src/shared/entities/dialer-settings/schemas/config-schema.ts`:

```ts
import { z } from 'zod'

const weekdayEnum = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])

export const dialerSettingsConfigSchema = z.object({
  defaults: z.object({
    maxAttemptsPerDay: z.number().int().min(1).max(20),
    maxTotalAttempts: z.number().int().min(1).max(500),
    interAttemptIntervalMinutes: z.number().int().min(15).max(720),
    voicemailBackoffHours: z.number().min(0.5).max(72),
    voicemailMaxPerDay: z.number().int().min(0).max(5),
  }),
  callingWindow: z.object({
    startHourLocal: z.number().int().min(0).max(23),
    endHourLocal: z.number().int().min(0).max(23),
    callingDays: z.array(weekdayEnum),
    powerHours: z.array(z.tuple([z.number(), z.number()])),
  }).refine(c => c.endHourLocal > c.startHourLocal, { message: 'end hour must be after start hour' }),
  didPool: z.object({
    targetPoolSize: z.number().int().min(1).max(100),
    warmingStartCap: z.number().int().min(5).max(50),
    warmingIncrement: z.number().int().min(5).max(50),
    warmingIncrementIntervalDays: z.number().int().min(1).max(14),
    activeDailyCap: z.number().int().min(20).max(200),
    hangupWithin3sFlagThreshold: z.number().min(0).max(1),
    cooldownDays: z.number().int().min(7).max(180),
    autoProcurementEnabled: z.boolean(),
  }),
  cadenceDecay: z.object({
    saturateDays: z.number().int().min(1).max(7),
    backoffDays: z.number().int().min(1).max(14),
    backoffAttemptsPerDay: z.number().int().min(1),
    backgroundDays: z.number().int().min(1).max(30),
    backgroundAttemptsPerDay: z.number().int().min(1),
  }),
  globalKillSwitch: z.boolean(),
})

export type DialerSettingsConfig = z.infer<typeof dialerSettingsConfigSchema>

export const DEFAULT_DIALER_SETTINGS_CONFIG: DialerSettingsConfig = {
  defaults: {
    maxAttemptsPerDay: 10,
    maxTotalAttempts: 50,
    interAttemptIntervalMinutes: 90,
    voicemailBackoffHours: 3,
    voicemailMaxPerDay: 1,
  },
  callingWindow: {
    startHourLocal: 8,
    endHourLocal: 21,
    callingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    powerHours: [[9, 12], [17, 19]],
  },
  didPool: {
    targetPoolSize: 5,
    warmingStartCap: 20,
    warmingIncrement: 20,
    warmingIncrementIntervalDays: 3,
    activeDailyCap: 60,
    hangupWithin3sFlagThreshold: 0.30,
    cooldownDays: 30,
    autoProcurementEnabled: false,
  },
  cadenceDecay: {
    saturateDays: 3,
    backoffDays: 7,
    backoffAttemptsPerDay: 2,
    backgroundDays: 14,
    backgroundAttemptsPerDay: 1,
  },
  globalKillSwitch: false,
}
```

- [ ] **Step 10.2: Create the schema file**

Create `src/shared/db/schema/dialer-settings.ts`:

```ts
import type z from 'zod'
import type { DialerSettingsConfig } from '@/shared/entities/dialer-settings/schemas/config-schema'
import { sql } from 'drizzle-orm'
import { check, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { dialerSettingsConfigSchema } from '@/shared/entities/dialer-settings/schemas/config-schema'
import { user } from './auth'

export const dialerSettings = pgTable('dialer_settings', {
  id: text('id').primaryKey().default('singleton'),
  configJson: jsonb('config_json').$type<DialerSettingsConfig>().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true }).defaultNow().notNull(),
  updatedByUserId: text('updated_by_user_id').references(() => user.id, { onDelete: 'set null' }),
}, table => [
  check('dialer_settings_singleton', sql`${table.id} = 'singleton'`),
])

export const selectDialerSettingsSchema = createSelectSchema(dialerSettings, {
  configJson: dialerSettingsConfigSchema,
})
export type DialerSettings = z.infer<typeof selectDialerSettingsSchema>

export const insertDialerSettingsSchema = createInsertSchema(dialerSettings, {
  configJson: dialerSettingsConfigSchema,
}).omit({
  updatedAt: true,
})
export type InsertDialerSettings = z.infer<typeof insertDialerSettingsSchema>
```

- [ ] **Step 10.3: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/db/schema/dialer-settings.ts src/shared/entities/dialer-settings/schemas/config-schema.ts
git commit -m "feat(dialer): add dialer_settings singleton table + config schema

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: dialer_messages table

**Files:** Create `src/shared/db/schema/dialer-messages.ts`

- [ ] **Step 11.1: Create the schema file**

```ts
import type z from 'zod'
import { relations } from 'drizzle-orm'
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { customers } from './customers'
import { dialerAttempts } from './dialer-attempts'
import {
  dialerMessageChannelEnum,
  dialerMessageDirectionEnum,
  dialerMessageStatusEnum,
} from './meta'

export const dialerMessages = pgTable('dialer_messages', {
  id,
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  dialerAttemptId: uuid('dialer_attempt_id').references(() => dialerAttempts.id, { onDelete: 'set null' }),
  direction: dialerMessageDirectionEnum('direction').notNull(),
  channel: dialerMessageChannelEnum('channel').notNull(),
  body: text('body').notNull(),
  twilioMessageSid: text('twilio_message_sid').unique(),
  sendblueMessageId: text('sendblue_message_id').unique(),
  status: dialerMessageStatusEnum('status').notNull().default('queued'),
  sentAt: timestamp('sent_at', { mode: 'string', withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { mode: 'string', withTimezone: true }),
  failedAt: timestamp('failed_at', { mode: 'string', withTimezone: true }),
  templateKey: text('template_key'),
  metaJson: jsonb('meta_json'),
  createdAt,
  updatedAt,
})

export const dialerMessagesRelations = relations(dialerMessages, ({ one }) => ({
  customer: one(customers, { fields: [dialerMessages.customerId], references: [customers.id] }),
  dialerAttempt: one(dialerAttempts, { fields: [dialerMessages.dialerAttemptId], references: [dialerAttempts.id] }),
}))

export const selectDialerMessageSchema = createSelectSchema(dialerMessages)
export type DialerMessage = z.infer<typeof selectDialerMessageSchema>

export const insertDialerMessageSchema = createInsertSchema(dialerMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertDialerMessage = z.infer<typeof insertDialerMessageSchema>
```

- [ ] **Step 11.2: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/db/schema/dialer-messages.ts
git commit -m "feat(dialer): add dialer_messages table schema

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: lead_sources.dialerConfigJSON + Zod schema + db push migration

**Files:**
- Create: `src/shared/entities/lead-sources/schemas/dialer-config-schema.ts`
- Modify: `src/shared/entities/lead-sources/schemas.ts` (or schemas dir per existing pattern — check first)
- Modify: `src/shared/db/schema/lead-sources.ts`
- Modify: `src/shared/db/schema/index.ts` — re-export all new dialer tables

- [ ] **Step 12.1: Create the dialer-config Zod schema**

Create `src/shared/entities/lead-sources/schemas/dialer-config-schema.ts`:

```ts
import { z } from 'zod'

export const leadSourceDialerConfigSchema = z.object({
  enabled: z.boolean(),
  retellAgentId: z.string().nullable(),
  trade: z.string(),
  consentContext: z.string(),
  aiGreetingOverride: z.string().nullable(),
  warmIntroTemplate: z.string().nullable(),
  cadenceOverrides: z.object({
    maxAttemptsPerDay: z.number().int().min(1).max(20).optional(),
    maxTotalAttempts: z.number().int().min(1).max(500).optional(),
    quietHours: z.object({
      start: z.string(),
      end: z.string(),
    }).optional(),
  }).nullable(),
  messageTemplates: z.object({
    callbackReminder: z.string().optional(),
    voicemailFollowup: z.string().optional(),
    optOutConfirm: z.string().optional(),
  }).nullable(),
})

export type LeadSourceDialerConfig = z.infer<typeof leadSourceDialerConfigSchema>
```

- [ ] **Step 12.2: Add field to lead-sources schema**

Modify `src/shared/db/schema/lead-sources.ts`. Read the file first to confirm exact existing structure, then add:

```ts
// Add to imports (top of file):
import type { LeadSourceDialerConfig } from '@/shared/entities/lead-sources/schemas/dialer-config-schema'
import { leadSourceDialerConfigSchema } from '@/shared/entities/lead-sources/schemas/dialer-config-schema'

// Inside leadSourcesTable definition, add:
  dialerConfigJSON: jsonb('dialer_config_json').$type<LeadSourceDialerConfig>(),

// Modify selectLeadSourceSchema:
export const selectLeadSourceSchema = createSelectSchema(leadSourcesTable, {
  formConfigJSON: leadSourceFormConfigSchema,
  dialerConfigJSON: leadSourceDialerConfigSchema.nullable(),
})

// Modify insertLeadSourceSchema:
export const insertLeadSourceSchema = createInsertSchema(leadSourcesTable, {
  formConfigJSON: leadSourceFormConfigSchema,
  dialerConfigJSON: leadSourceDialerConfigSchema.optional(),
}).omit({ id: true, createdAt: true, updatedAt: true })
```

- [ ] **Step 12.3: Re-export new tables from schema barrel**

Modify `src/shared/db/schema/index.ts` — add the 7 new exports. Match existing pattern (re-read first):

```ts
export * from './dialer-attempts'
export * from './dialer-dids'
export * from './dialer-lead-states'
export * from './dialer-dnc'
export * from './dialer-user-availability'
export * from './dialer-settings'
export * from './dialer-messages'
```

- [ ] **Step 12.4: Push schema to dev DB**

```bash
pnpm db:push:dev
```

**Verify:** drizzle-kit prompts confirming the new tables + enum types + `lead_sources.dialer_config_json` column. Accept the changes. **Do NOT run `pnpm db:push` — that's production.**

- [ ] **Step 12.5: Manually verify the migration**

Connect to dev DB (via your usual tool — psql / Neon dashboard / Drizzle Studio):

```sql
-- Confirm tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'dialer_%'
ORDER BY table_name;

-- Confirm enum types exist
SELECT typname FROM pg_type
WHERE typname LIKE 'dialer_%'
ORDER BY typname;

-- Confirm lead_sources got the new column
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'lead_sources' AND column_name = 'dialer_config_json';

-- Confirm CHECK constraint on dialer_settings.id
SELECT con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'dialer_settings';
```

Expected: 7 dialer tables, 10 dialer enum types, `dialer_config_json` column on `lead_sources`, CHECK constraint `dialer_settings_singleton` present.

- [ ] **Step 12.6: Commit**

```bash
git add src/shared/db/schema/lead-sources.ts src/shared/entities/lead-sources/schemas/dialer-config-schema.ts src/shared/db/schema/index.ts
git commit -m "$(cat <<'EOF'
feat(dialer): add dialerConfigJSON to lead_sources + push migration

- Adds nullable dialerConfigJSON jsonb column to lead_sources
- Adds Zod schema for LeadSourceDialerConfig
- Re-exports all 7 new dialer tables from schema barrel
- Pushed via pnpm db:push:dev (NOT production)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Tasks 13-19: Backend entity minimal scaffolds (per ADR-0002 pattern)

> **Each task creates ONE entity directory** following the existing flat-entity-folder pattern. Phase 1 only needs the minimum: CASL name constant + Zod re-exports + minimal DAL. NO `components/`, NO `hooks/`, NO `lib/state-machine.ts` in Phase 1 — those land in later phases.

**Template per entity** (apply to each of Tasks 13-19, substituting `<entity>` and `<EntityName>`):

```
src/shared/entities/<entity>/
  DOCS.md
  schemas/index.ts                  ← re-exports from db schema (if no additional Zod shapes; otherwise add files)
  types.ts                          ← re-exports Drizzle-inferred TS types from db schema
  constants/index.ts                ← any per-entity const arrays (mostly re-exports in Phase 1)
  lib/constants.ts                  ← exports the CASL entity name constant
  dal/server/{create,find-by-id,list,update}.ts (and entity-specific extras)
```

> **For brevity, Tasks 13-19 below show only the unique fields per entity. The DAL pattern from Task 13 is the template — each entity follows it, substituting the table name. Where an entity needs entity-specific DAL functions (e.g., `findByPhone`), those are shown.**

#### Task 13: entities/dialer-attempts/

- [ ] **Step 13.1:** Create `DOCS.md`:

```markdown
# dialer-attempts

Per-call lifecycle records. The atomic unit of dialer activity.

## Invariants

- `skipped_compliance` attempts do NOT increment `dialer_lead_states.attempts_today` (no actual dial occurred).
- `retell_call_id` and `twilio_call_sid` are vendor unique IDs; webhook handlers MUST use them as idempotency keys.
- `disposition` is set post-call (by human or by AI via webhook). May be NULL while call is in flight.
- `recording_url` is Twilio-hosted; access gated by CASL `view_recording` permission.
- State transitions follow `entities/dialer-attempts/lib/state-machine.ts` (added in Phase 2).
```

- [ ] **Step 13.2:** Create `lib/constants.ts`:

```ts
export const DIALER_ATTEMPT = 'DialerAttempt' as const
export type DialerAttemptEntityName = typeof DIALER_ATTEMPT
```

- [ ] **Step 13.3:** Create `types.ts`:

```ts
export type { DialerAttempt, InsertDialerAttempt } from '@/shared/db/schema/dialer-attempts'
```

- [ ] **Step 13.4:** Create `schemas/index.ts`:

```ts
export {
  selectDialerAttemptSchema,
  insertDialerAttemptSchema,
} from '@/shared/db/schema/dialer-attempts'
```

- [ ] **Step 13.5:** Create `constants/index.ts`:

```ts
export { dialerAttemptStatuses, dialerDispositions } from '@/shared/constants/enums/dialer'
```

- [ ] **Step 13.6:** Create `dal/server/create.ts`:

```ts
import type { InsertDialerAttempt } from '@/shared/db/schema/dialer-attempts'
import { db } from '@/shared/db'
import { dialerAttempts } from '@/shared/db/schema'

export async function createDialerAttempt(input: InsertDialerAttempt) {
  const [row] = await db.insert(dialerAttempts).values(input).returning()
  return row
}
```

- [ ] **Step 13.7:** Create `dal/server/find-by-id.ts`:

```ts
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { dialerAttempts } from '@/shared/db/schema'

export async function findDialerAttemptById(id: string) {
  const [row] = await db.select().from(dialerAttempts).where(eq(dialerAttempts.id, id)).limit(1)
  return row ?? null
}

export async function findDialerAttemptByRetellId(retellCallId: string) {
  const [row] = await db.select().from(dialerAttempts).where(eq(dialerAttempts.retellCallId, retellCallId)).limit(1)
  return row ?? null
}

export async function findDialerAttemptByTwilioSid(twilioCallSid: string) {
  const [row] = await db.select().from(dialerAttempts).where(eq(dialerAttempts.twilioCallSid, twilioCallSid)).limit(1)
  return row ?? null
}
```

- [ ] **Step 13.8:** Create `dal/server/list.ts`:

```ts
import { desc } from 'drizzle-orm'
import { db } from '@/shared/db'
import { dialerAttempts } from '@/shared/db/schema'

export async function listRecentDialerAttempts(limit = 50) {
  return db.select().from(dialerAttempts).orderBy(desc(dialerAttempts.initiatedAt)).limit(limit)
}
```

- [ ] **Step 13.9:** Create `dal/server/update.ts`:

```ts
import type { DialerAttempt } from '@/shared/db/schema/dialer-attempts'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { dialerAttempts } from '@/shared/db/schema'

export async function updateDialerAttempt(id: string, patch: Partial<DialerAttempt>) {
  const [row] = await db.update(dialerAttempts).set(patch).where(eq(dialerAttempts.id, id)).returning()
  return row
}
```

- [ ] **Step 13.10:** Verify + commit:

```bash
pnpm tsc && pnpm lint
git add src/shared/entities/dialer-attempts/
git commit -m "feat(dialer): scaffold dialer-attempts entity (minimal)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

#### Task 14: entities/dialer-dids/

- [ ] **Step 14.1:** Apply Task 13 template substituting `dialerDids` table. Unique values:

`lib/constants.ts`: `export const DIALER_DID = 'DialerDid' as const`
`types.ts`: re-exports `DialerDid`, `InsertDialerDid` from `@/shared/db/schema/dialer-dids`
`schemas/index.ts`: re-exports `selectDialerDidSchema`, `insertDialerDidSchema`
`constants/index.ts`: `export { dialerDidStatuses } from '@/shared/constants/enums/dialer'`

DAL `create.ts`, `find-by-id.ts`, `list.ts`, `update.ts` mirror Task 13 substituting `dialerDids`. Plus `dal/server/find-by-e164.ts`:

```ts
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { dialerDids } from '@/shared/db/schema'

export async function findDialerDidByE164(e164: string) {
  const [row] = await db.select().from(dialerDids).where(eq(dialerDids.e164Number, e164)).limit(1)
  return row ?? null
}
```

`DOCS.md`:
```markdown
# dialer-dids

DID pool with lifecycle state. One row per phone number we own.

## Invariants

- `is_transfer_target_did = true` for exactly ONE DID in the pool (the "Tri Pros Transfers" caller ID used for outbound legs to humans). This DID does NOT participate in dial rotation.
- `status='warming' → 'active' → 'cooldown' | 'flagged' | 'retired'`. Retired is terminal.
- `attempts_today` reset daily by cron at midnight UTC.
- Atomic dispatch enforces `attempts_today < daily_cap` via `UPDATE ... WHERE ... RETURNING`.
```

- [ ] **Step 14.2:** Verify + commit (`feat(dialer): scaffold dialer-dids entity (minimal)`)

#### Task 15: entities/dialer-lead-states/

- [ ] **Step 15.1:** Apply template:

`lib/constants.ts`: `export const DIALER_LEAD_STATE = 'DialerLeadState' as const`
`types.ts`: re-exports `DialerLeadState`, `InsertDialerLeadState`
`schemas/index.ts`: re-exports `selectDialerLeadStateSchema`, `insertDialerLeadStateSchema`
`constants/index.ts`: re-exports `dialerLeadStateStatuses`

DAL: standard four + `find-by-customer.ts`:

```ts
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { dialerLeadStates } from '@/shared/db/schema'

export async function findDialerLeadStateByCustomerId(customerId: string) {
  const [row] = await db.select().from(dialerLeadStates).where(eq(dialerLeadStates.customerId, customerId)).limit(1)
  return row ?? null
}
```

`DOCS.md`:
```markdown
# dialer-lead-states

Per-customer dial cadence state. One row per enrolled customer (UNIQUE on customer_id).

## Invariants

- A customer can be enrolled at most once (UNIQUE customer_id).
- `status` transitions: queued → in_progress → reached | opted_out | exhausted | paused; paused → in_progress (when pause_until passes).
- `attempts_today` reset daily by midnight UTC cron.
- `pause_until` is set when AI schedules a callback (branch B3); cadence resumes when it passes.
- `enrolled_by_user_id` NULL = auto-enrolled by lead source; non-null = admin-enrolled.
```

- [ ] **Step 15.2:** Verify + commit (`feat(dialer): scaffold dialer-lead-states entity`)

#### Task 16: entities/dialer-dnc/

- [ ] **Step 16.1:** Apply template:

`lib/constants.ts`: `export const DIALER_DNC = 'DialerDnc' as const`
`types.ts`: re-exports `DialerDnc`, `InsertDialerDnc`
`schemas/index.ts`: re-exports `selectDialerDncSchema`, `insertDialerDncSchema`
`constants/index.ts`: re-exports `dialerDncSources`

DAL: `create.ts`, `list.ts` (no `update` — DNC entries are append-only), plus `lookup-by-phone.ts`:

```ts
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { dialerDnc } from '@/shared/db/schema'

export async function lookupDialerDncByPhone(phoneE164: string): Promise<boolean> {
  const [row] = await db.select({ id: dialerDnc.id }).from(dialerDnc).where(eq(dialerDnc.phoneE164, phoneE164)).limit(1)
  return row !== undefined
}
```

`DOCS.md`:
```markdown
# dialer-dnc

Do Not Call registry. Records both lead-initiated opt-outs and external scrub-list entries.

## Invariants

- Append-only. Entries are never removed (admin-managed corrections create a new entry).
- UNIQUE on `phone_e164` — a phone can only be DNC'd once. Duplicate inserts must use ON CONFLICT DO NOTHING.
- Every compliance gate dial check MUST call `lookupDialerDncByPhone` before dispatch.
- TCPA: honor every opt-out within 5 minutes (well inside 24h legal requirement).
```

- [ ] **Step 16.2:** Verify + commit (`feat(dialer): scaffold dialer-dnc entity`)

#### Task 17: entities/dialer-user-availability/

- [ ] **Step 17.1:** Apply template (no `create.ts`/`update.ts` — uses single `upsert.ts`):

`lib/constants.ts`: `export const DIALER_USER_AVAILABILITY = 'DialerUserAvailability' as const`
`types.ts`: re-exports `DialerUserAvailability`, `InsertDialerUserAvailability`
`schemas/index.ts`: re-exports
`constants/index.ts`: re-exports `dialerUserAvailabilities`, `dialerTransferModes`

DAL files:

```ts
// dal/server/find-by-user.ts
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { dialerUserAvailability } from '@/shared/db/schema'

export async function findDialerUserAvailability(userId: string) {
  const [row] = await db.select().from(dialerUserAvailability).where(eq(dialerUserAvailability.userId, userId)).limit(1)
  return row ?? null
}
```

```ts
// dal/server/upsert.ts
import type { InsertDialerUserAvailability } from '@/shared/db/schema/dialer-user-availability'
import { db } from '@/shared/db'
import { dialerUserAvailability } from '@/shared/db/schema'

export async function upsertDialerUserAvailability(input: InsertDialerUserAvailability) {
  const [row] = await db.insert(dialerUserAvailability)
    .values(input)
    .onConflictDoUpdate({
      target: dialerUserAvailability.userId,
      set: { ...input, updatedAt: new Date().toISOString() },
    })
    .returning()
  return row
}
```

```ts
// dal/server/list-available.ts
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/shared/db'
import { dialerAttempts, dialerUserAvailability } from '@/shared/db/schema'

/**
 * Returns user IDs of humans currently available for warm transfers.
 * Availability is DERIVED: enrolled + status='available' + no active call.
 */
export async function listAvailableTransferHumans() {
  const rows = await db.select({
    userId: dialerUserAvailability.userId,
    transferMode: dialerUserAvailability.transferMode,
    cellPhoneE164: dialerUserAvailability.cellPhoneE164,
    lastTransferredAt: dialerUserAvailability.lastTransferredAt,
  })
    .from(dialerUserAvailability)
    .where(and(
      eq(dialerUserAvailability.enrolledForTransfers, true),
      eq(dialerUserAvailability.manualStatus, 'available'),
    ))

  const userIds = rows.map(r => r.userId)
  if (userIds.length === 0) return []

  const activeCalls = await db.select({ userId: dialerAttempts.transferredToUserId })
    .from(dialerAttempts)
    .where(and(eq(dialerAttempts.status, 'live_transferred'), isNull(dialerAttempts.endedAt)))

  const busySet = new Set(activeCalls.map(c => c.userId).filter(Boolean) as string[])
  return rows.filter(r => !busySet.has(r.userId))
}
```

`DOCS.md`:
```markdown
# dialer-user-availability

Transfer-target presence. One row per user who can take warm transfers.

## Invariants

- Availability is **DERIVED**, not stored: `enrolled_for_transfers AND manual_status='available' AND no active call in dialer_attempts where transferred_to_user_id = self AND ended_at IS NULL`.
- Avoiding stored `is_busy` eliminates webhook-ordering races (Twilio status-callback timing).
- `transfer_mode='mobile'` REQUIRES `cell_phone_e164` to be set (validated at API layer in Phase 4 UI).
- `transfer_mode='auto'` → desktop if browser softphone is registered; otherwise mobile.
```

- [ ] **Step 17.2:** Verify + commit (`feat(dialer): scaffold dialer-user-availability entity`)

#### Task 18: entities/dialer-settings/

- [ ] **Step 18.1:** Apply template:

`lib/constants.ts`: `export const DIALER_SETTINGS = 'DialerSettings' as const`
`types.ts`: re-exports `DialerSettings`, `InsertDialerSettings`
`schemas/index.ts`: re-exports both from db schema + `./config-schema` (created in Task 10)
`constants/index.ts`: re-exports `DEFAULT_DIALER_SETTINGS_CONFIG` from schemas/config-schema

DAL files:

```ts
// dal/server/get-singleton.ts
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { dialerSettings } from '@/shared/db/schema'

export async function getDialerSettingsSingleton() {
  const [row] = await db.select().from(dialerSettings).where(eq(dialerSettings.id, 'singleton')).limit(1)
  return row ?? null
}
```

```ts
// dal/server/upsert-singleton.ts
import type { DialerSettingsConfig } from '@/shared/entities/dialer-settings/schemas/config-schema'
import { db } from '@/shared/db'
import { dialerSettings } from '@/shared/db/schema'

export async function upsertDialerSettings(configJson: DialerSettingsConfig, updatedByUserId: string) {
  const [row] = await db.insert(dialerSettings)
    .values({ id: 'singleton', configJson, updatedByUserId })
    .onConflictDoUpdate({
      target: dialerSettings.id,
      set: { configJson, updatedByUserId, updatedAt: new Date().toISOString() },
    })
    .returning()
  return row
}
```

```ts
// lib/load-config.ts
import type { DialerSettingsConfig } from '@/shared/entities/dialer-settings/schemas/config-schema'
import { DEFAULT_DIALER_SETTINGS_CONFIG } from '@/shared/entities/dialer-settings/schemas/config-schema'
import { getDialerSettingsSingleton } from '@/shared/entities/dialer-settings/dal/server/get-singleton'

export async function loadDialerSettingsConfig(): Promise<DialerSettingsConfig> {
  const row = await getDialerSettingsSingleton()
  return row?.configJson ?? DEFAULT_DIALER_SETTINGS_CONFIG
}
```

`DOCS.md`:
```markdown
# dialer-settings

Singleton row holding super-admin-editable global dialer config. The `defaults-with-override` source-of-truth: lead source `cadenceOverrides` merge on top of these defaults at dispatch time.

## Invariants

- Single row, primary key always `'singleton'` (CHECK constraint enforces).
- Phase 1 has no UI; row is created via seed script in Task 49 with `DEFAULT_DIALER_SETTINGS_CONFIG`.
- Phase 4 ships the super-admin editing UI.
- `loadDialerSettingsConfig()` falls back to in-memory defaults if no row exists — never throws.
```

- [ ] **Step 18.2:** Verify + commit (`feat(dialer): scaffold dialer-settings entity`)

#### Task 19: entities/dialer-messages/

- [ ] **Step 19.1:** Apply template:

`lib/constants.ts`: `export const DIALER_MESSAGE = 'DialerMessage' as const`
`types.ts`: re-exports `DialerMessage`, `InsertDialerMessage`
`schemas/index.ts`: re-exports
`constants/index.ts`: re-exports `dialerMessageStatuses`, `dialerMessageChannels`, `dialerMessageDirections`

DAL: standard four + `list-by-customer.ts` + `update-status-by-vendor-id.ts`:

```ts
// dal/server/list-by-customer.ts
import { desc, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { dialerMessages } from '@/shared/db/schema'

export async function listMessagesByCustomer(customerId: string, limit = 100) {
  return db.select().from(dialerMessages)
    .where(eq(dialerMessages.customerId, customerId))
    .orderBy(desc(dialerMessages.createdAt))
    .limit(limit)
}
```

```ts
// dal/server/update-status-by-vendor-id.ts
import type { DialerMessageStatus } from '@/shared/constants/enums/dialer'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { dialerMessages } from '@/shared/db/schema'

export async function updateMessageStatusByTwilioSid(
  twilioMessageSid: string,
  status: DialerMessageStatus,
  timestamps: { deliveredAt?: string, failedAt?: string },
) {
  const [row] = await db.update(dialerMessages)
    .set({ status, ...timestamps })
    .where(eq(dialerMessages.twilioMessageSid, twilioMessageSid))
    .returning()
  return row
}

export async function updateMessageStatusBySendblueId(
  sendblueMessageId: string,
  status: DialerMessageStatus,
  timestamps: { deliveredAt?: string, failedAt?: string },
) {
  const [row] = await db.update(dialerMessages)
    .set({ status, ...timestamps })
    .where(eq(dialerMessages.sendblueMessageId, sendblueMessageId))
    .returning()
  return row
}
```

`DOCS.md`:
```markdown
# dialer-messages

Every SMS / iMessage send and receive, with delivery status.

## Invariants

- Webhook handlers update `status` idempotently keyed on `twilio_message_sid` or `sendblue_message_id`. Duplicate webhooks are safe.
- `channel='fallback_sms'` = attempted iMessage via Sendblue, fell back to SMS via Twilio.
- `direction='inbound'` rows have a vendor ID set but no `sent_at`.
- STOP keyword inbound rows trigger `dialer_dnc` insert + opt-out-confirm outbound row.
- `template_key='manual'` for ad-hoc sends, NULL for inbound, specific keys for auto-triggered (callback_reminder, voicemail_followup, opt_out_confirm).
```

- [ ] **Step 19.2:** Verify + commit (`feat(dialer): scaffold dialer-messages entity`)

---

### Task 20: Register dialer entities in CASL abilities

**Files:** Modify `src/domains/permissions/abilities.ts`

> Read the file first to confirm structure — the entity-name colocation pattern from Issue #193 may or may not have landed yet. Adapt accordingly.

- [ ] **Step 20.1: Import the 7 entity-name constants**

Merge into existing imports:

```ts
import { DIALER_ATTEMPT } from '@/shared/entities/dialer-attempts/lib/constants'
import { DIALER_DID } from '@/shared/entities/dialer-dids/lib/constants'
import { DIALER_LEAD_STATE } from '@/shared/entities/dialer-lead-states/lib/constants'
import { DIALER_DNC } from '@/shared/entities/dialer-dnc/lib/constants'
import { DIALER_USER_AVAILABILITY } from '@/shared/entities/dialer-user-availability/lib/constants'
import { DIALER_SETTINGS } from '@/shared/entities/dialer-settings/lib/constants'
import { DIALER_MESSAGE } from '@/shared/entities/dialer-messages/lib/constants'
```

- [ ] **Step 20.2: Add entity names to ENTITY_NAMES array**

Add the 7 new names to the existing `ENTITY_NAMES` const array (this is what makes them part of the `EntityName` union + `AppSubject` type per ADR-0002).

- [ ] **Step 20.3: Add role rules per spec §4**

Adapt to existing rule-builder pattern in this file. Logical content:

- **super_admin** — `manage` all 7 dialer subjects
- **admin** — `manage` on `[DIALER_DNC, DIALER_LEAD_STATE, DIALER_USER_AVAILABILITY, DIALER_MESSAGE]`; `read` on `[DIALER_ATTEMPT, DIALER_DID, DIALER_SETTINGS]`
- **agent** — `read` on `DIALER_ATTEMPT` filtered to `{ transferredToUserId: user.id }`; `manage` on `DIALER_USER_AVAILABILITY` filtered to `{ userId: user.id }`; `['read', 'send']` on `DIALER_MESSAGE` (tRPC scopes further by assigned customer)

- [ ] **Step 20.4: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/domains/permissions/abilities.ts
git commit -m "feat(dialer): register dialer entity names + role rules in CASL

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 21: VoipProvider interface + Twilio implementation

**Files:**
- Create: `src/services/voip/voip-provider.interface.ts`
- Create: `src/services/voip/twilio.voip-provider.ts`
- Create: `src/services/voip/voip-provider.factory.ts`

- [ ] **Step 21.1: Create the interface**

```ts
// voip-provider.interface.ts

export interface VoipProvider {
  /**
   * Place an outbound call FROM `from` (one of our DIDs) TO `to` (PSTN number or 'client:identity' for SDK).
   * Returns the Twilio CallSid for tracking.
   * Honors DIALER_DEV_OVERRIDE_NUMBER if set (replaces `to`).
   */
  placeCall(args: {
    from: string                          // E.164 DID
    to: string                            // E.164 OR 'client:agent_oliver'
    statusCallbackUrl: string
    customParameters?: Record<string, string>
  }): Promise<{ callSid: string }>

  /**
   * Transfer an in-progress call to a new destination via SIP REFER.
   * Used by AI agent's transfer flow OR by manual conference operations.
   */
  transferCall(args: {
    callSid: string
    to: string
    warmIntro?: string                    // optional verbal intro before bridging
  }): Promise<void>

  /**
   * End an in-progress call.
   */
  endCall(callSid: string): Promise<void>

  /**
   * Issue a short-lived JWT for the browser softphone (Twilio Voice SDK).
   */
  softphoneToken(userId: string): Promise<{ token: string, identity: string, ttlSeconds: number }>
}
```

- [ ] **Step 21.2: Create the Twilio implementation**

```ts
// twilio.voip-provider.ts
import twilio from 'twilio'
import type { VoipProvider } from './voip-provider.interface'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!,
)

function maybeOverride(to: string): string {
  const override = process.env.DIALER_DEV_OVERRIDE_NUMBER
  if (override && to.startsWith('+')) {
    console.warn(`[DIALER DEV OVERRIDE] Routing call to ${override} instead of ${to}`)
    return override
  }
  return to
}

export const twilioVoipProvider: VoipProvider = {
  async placeCall({ from, to, statusCallbackUrl, customParameters }) {
    const target = maybeOverride(to)
    const call = await client.calls.create({
      from,
      to: target,
      statusCallback: statusCallbackUrl,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      record: true,
      recordingStatusCallback: `${process.env.DIALER_WEBHOOK_BASE_URL}/api/voip/twilio/recording`,
      // For Retell-managed calls, the TwiML/URL comes from Retell. For test calls
      // initiated from our own dispatcher, we use a TwiML app.
      applicationSid: process.env.TWILIO_TWIML_APP_SID,
      sendDigits: customParameters ? undefined : undefined,
    })
    return { callSid: call.sid }
  },

  async transferCall({ callSid, to, warmIntro }) {
    // Phase 1: Retell handles transfers internally via its own API.
    // This method is here for future manual conference / transfer use cases.
    // For Phase 1, primary transfer path is through Retell.startOutboundCall(...transferTarget).
    // Keeping this signature so the interface is complete.
    const target = maybeOverride(to)
    void warmIntro
    await client.calls(callSid).update({
      twiml: `<Response><Dial>${target}</Dial></Response>`,
    })
  },

  async endCall(callSid) {
    await client.calls(callSid).update({ status: 'completed' })
  },

  async softphoneToken(userId) {
    const AccessToken = twilio.jwt.AccessToken
    const VoiceGrant = AccessToken.VoiceGrant
    const ttlSeconds = 3600

    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_API_KEY_SID!,
      process.env.TWILIO_API_KEY_SECRET!,
      { identity: `agent_${userId}`, ttl: ttlSeconds },
    )

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID!,
      incomingAllow: true,
    })
    token.addGrant(voiceGrant)

    return {
      token: token.toJwt(),
      identity: `agent_${userId}`,
      ttlSeconds,
    }
  },
}
```

- [ ] **Step 21.3: Create the factory**

```ts
// voip-provider.factory.ts
import type { VoipProvider } from './voip-provider.interface'
import { twilioVoipProvider } from './twilio.voip-provider'

let cached: VoipProvider | null = null

export function getVoipProvider(): VoipProvider {
  if (!cached) cached = twilioVoipProvider
  return cached
}
```

- [ ] **Step 21.4: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/services/voip/
git commit -m "feat(dialer): add VoipProvider interface + Twilio impl + factory

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 22: AiVoiceAgentProvider interface + Retell implementation

**Files:**
- Create: `src/services/ai-voice/ai-voice-agent.interface.ts`
- Create: `src/services/ai-voice/retell.ai-voice-agent.ts`
- Create: `src/services/ai-voice/ai-voice-agent.factory.ts`

- [ ] **Step 22.1: Create the interface**

```ts
// ai-voice-agent.interface.ts

export interface AiVoiceAgentProvider {
  /**
   * Initiates an outbound AI-driven call. Returns the agent-side call ID.
   * The agent dials the lead, runs the configured script, and warm-transfers per the
   * route-transfer webhook decision.
   */
  startOutboundCall(args: {
    agentId: string                       // Retell agent ID (per lead source)
    from: string                          // E.164 of our DID
    to: string                            // lead's phone OR DIALER_DEV_OVERRIDE_NUMBER
    dynamicVariables: Record<string, string>  // {lead_name, trade, consent_context, ...}
    metadata: { dialerAttemptId: string, customerId: string }
    webhookUrl: string                    // base URL for our /api/dialer/ai/* webhooks
  }): Promise<{ agentCallId: string }>

  /**
   * End an in-flight AI call (defensive — rarely used outside error recovery).
   */
  endCall(agentCallId: string): Promise<void>
}
```

- [ ] **Step 22.2: Create Retell implementation**

```ts
// retell.ai-voice-agent.ts
import Retell from 'retell-sdk'
import type { AiVoiceAgentProvider } from './ai-voice-agent.interface'

const client = new Retell({ apiKey: process.env.RETELL_API_KEY! })

function maybeOverride(to: string): string {
  const override = process.env.DIALER_DEV_OVERRIDE_NUMBER
  if (override && to.startsWith('+')) {
    console.warn(`[DIALER DEV OVERRIDE] Routing AI call to ${override} instead of ${to}`)
    return override
  }
  return to
}

export const retellAiVoiceAgent: AiVoiceAgentProvider = {
  async startOutboundCall({ agentId, from, to, dynamicVariables, metadata, webhookUrl }) {
    const target = maybeOverride(to)
    const call = await client.call.createPhoneCall({
      from_number: from,
      to_number: target,
      override_agent_id: agentId,
      retell_llm_dynamic_variables: dynamicVariables,
      metadata,
      // Retell auto-fires webhooks at call_started / call_ended / call_analyzed events
      // to the agent's configured webhook_url. Mid-call function calls (lead-context,
      // route-transfer, etc.) are configured in the Retell agent itself, pointing at:
      //   ${webhookUrl}/api/dialer/ai/lead-context
      //   ${webhookUrl}/api/dialer/ai/route-transfer
      //   ${webhookUrl}/api/dialer/ai/log-disposition
    })
    void webhookUrl  // documented above; URLs configured in Retell agent UI not per-call
    return { agentCallId: call.call_id }
  },

  async endCall(agentCallId) {
    // Retell SDK doesn't expose end-call directly as of late 2025 — use REST endpoint if needed.
    // For Phase 1, calls end naturally; this is a stub for future error recovery.
    console.warn(`[Retell] endCall requested for ${agentCallId} — not implemented in Phase 1`)
  },
}
```

- [ ] **Step 22.3: Create factory**

```ts
// ai-voice-agent.factory.ts
import type { AiVoiceAgentProvider } from './ai-voice-agent.interface'
import { retellAiVoiceAgent } from './retell.ai-voice-agent'

let cached: AiVoiceAgentProvider | null = null
export function getAiVoiceAgent(): AiVoiceAgentProvider {
  if (!cached) cached = retellAiVoiceAgent
  return cached
}
```

- [ ] **Step 22.4: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/services/ai-voice/
git commit -m "feat(dialer): add AiVoiceAgentProvider interface + Retell impl

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 23: BrandedCallingProvider interface + null implementation

**Files:**
- Create: `src/services/branded-calling/branded-calling.interface.ts`
- Create: `src/services/branded-calling/null.branded-calling.ts`
- Create: `src/services/branded-calling/branded-calling.factory.ts`

- [ ] **Step 23.1: Interface + null impl + factory**

```ts
// branded-calling.interface.ts
export interface BrandedCallingProvider {
  /**
   * Returns reputation snapshot for a DID across networks.
   * Null impl returns empty snapshot.
   */
  fetchReputation(e164: string): Promise<Record<string, unknown>>

  /** Register a new DID with branded display. No-op for null impl. */
  registerDid(e164: string): Promise<void>
}
```

```ts
// null.branded-calling.ts
import type { BrandedCallingProvider } from './branded-calling.interface'

// @migration: → hiya.branded-calling.ts when Hiya Connect is activated
// Trigger: answer rate <15% sustained OR hangup-3s% >25%
export const nullBrandedCalling: BrandedCallingProvider = {
  async fetchReputation() { return {} },
  async registerDid() { /* no-op */ },
}
```

```ts
// branded-calling.factory.ts
import type { BrandedCallingProvider } from './branded-calling.interface'
import { nullBrandedCalling } from './null.branded-calling'

let cached: BrandedCallingProvider | null = null
export function getBrandedCallingProvider(): BrandedCallingProvider {
  if (!cached) cached = nullBrandedCalling
  return cached
}
```

- [ ] **Step 23.2: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/services/branded-calling/
git commit -m "feat(dialer): add BrandedCallingProvider interface + null impl

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 24: MessagingProvider interface + Twilio impl

**Files:**
- Create: `src/services/messaging/messaging-provider.interface.ts`
- Create: `src/services/messaging/twilio.messaging-provider.ts`

- [ ] **Step 24.1: Interface**

```ts
// messaging-provider.interface.ts
export interface MessagingProvider {
  readonly channel: 'sms' | 'imessage'

  /**
   * Send a message. Returns the vendor's message ID + initial status.
   * Honors DIALER_DEV_OVERRIDE_NUMBER if set.
   */
  send(args: {
    to: string                          // E.164
    body: string
    statusCallbackUrl?: string
  }): Promise<{ messageId: string, status: 'queued' | 'sent' | 'failed' }>
}
```

- [ ] **Step 24.2: Twilio SMS impl**

```ts
// twilio.messaging-provider.ts
import twilio from 'twilio'
import type { MessagingProvider } from './messaging-provider.interface'

const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)

function maybeOverride(to: string): string {
  const override = process.env.DIALER_DEV_OVERRIDE_NUMBER
  if (override && to.startsWith('+')) {
    console.warn(`[DIALER DEV OVERRIDE] Routing SMS to ${override} instead of ${to}`)
    return override
  }
  return to
}

function ensureStopFooter(body: string): string {
  if (/reply\s+stop/i.test(body)) return body
  return `${body.trim()}\n\nReply STOP to opt out.`
}

export const twilioMessagingProvider: MessagingProvider = {
  channel: 'sms',

  async send({ to, body, statusCallbackUrl }) {
    const target = maybeOverride(to)
    const message = await client.messages.create({
      from: process.env.TWILIO_TRANSFER_TARGET_DID_E164!,  // reuse the "Tri Pros Transfers" DID for SMS too (Phase 1 simplicity)
      to: target,
      body: ensureStopFooter(body),
      statusCallback: statusCallbackUrl,
    })
    return {
      messageId: message.sid,
      status: message.status === 'failed' ? 'failed' : message.status === 'sent' ? 'sent' : 'queued',
    }
  },
}
```

- [ ] **Step 24.3: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/services/messaging/messaging-provider.interface.ts src/services/messaging/twilio.messaging-provider.ts
git commit -m "feat(messaging): add MessagingProvider interface + Twilio SMS impl

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 25: Sendblue iMessage impl + messaging router — **⏸ DEFERRED (2026-05-22)**

> **Status:** Sendblue (iMessage) deferred to post-Phase-1-launch enhancement. See EPIC.md decision log entry "Sendblue (iMessage) deferred." Phase 1 implements Twilio-only messaging via Task 24's `twilioMessagingProvider` — no router needed (only one provider).
>
> **For Phase 1, instead of Task 25:** create a thin `services/messaging/send-message.service.ts` that wraps `twilioMessagingProvider.send()` with the same `channelPreference: 'sms' | 'imessage' | 'auto'` signature this task's router would have had — but the implementation hard-codes channel to `'sms'` regardless of preference. When Sendblue is added later, this service is the seam that swaps in real routing logic. Mark with `@migration: → Sendblue iMessage routing` so it's findable.
>
> **Remaining steps below are RETAINED as reference for the future Sendblue add — do not implement now.**

**Files (deferred):**
- Create: `src/services/messaging/sendblue.messaging-provider.ts`
- Create: `src/services/messaging/messaging-router.service.ts`

- [ ] **Step 25.1: Sendblue impl (fetch-based, no SDK)** — DEFERRED

```ts
// sendblue.messaging-provider.ts
import type { MessagingProvider } from './messaging-provider.interface'

const BASE_URL = 'https://api.sendblue.co/api'

function maybeOverride(to: string): string {
  const override = process.env.DIALER_DEV_OVERRIDE_NUMBER
  if (override && to.startsWith('+')) {
    console.warn(`[DIALER DEV OVERRIDE] Routing iMessage to ${override} instead of ${to}`)
    return override
  }
  return to
}

function ensureStopFooter(body: string): string {
  if (/reply\s+stop/i.test(body)) return body
  return `${body.trim()}\n\nReply STOP to opt out.`
}

export const sendblueMessagingProvider: MessagingProvider = {
  channel: 'imessage',

  async send({ to, body, statusCallbackUrl }) {
    const target = maybeOverride(to)
    const res = await fetch(`${BASE_URL}/send-message`, {
      method: 'POST',
      headers: {
        'sb-api-key-id': process.env.SENDBLUE_API_KEY_ID!,
        'sb-api-secret-key': process.env.SENDBLUE_API_SECRET!,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        number: target,
        content: ensureStopFooter(body),
        status_callback: statusCallbackUrl,
      }),
    })

    if (!res.ok) {
      return { messageId: '', status: 'failed' }
    }

    const data = await res.json() as { message_handle: string, status: string }
    return {
      messageId: data.message_handle,
      status: data.status === 'SENT' ? 'sent' : 'queued',
    }
  },
}
```

- [ ] **Step 25.2: Messaging router**

```ts
// messaging-router.service.ts
import type { DialerMessageChannel } from '@/shared/constants/enums/dialer'
import { twilioMessagingProvider } from './twilio.messaging-provider'
import { sendblueMessagingProvider } from './sendblue.messaging-provider'

/**
 * Sends a message via the requested channel, falling back to SMS if iMessage fails.
 * Returns the actual channel used + provider IDs for persistence.
 */
export async function sendMessageRouted(args: {
  to: string
  body: string
  channelPreference: 'sms' | 'imessage' | 'auto'
  twilioStatusCallbackUrl: string
  sendblueStatusCallbackUrl: string
}): Promise<{
  twilioMessageSid?: string
  sendblueMessageId?: string
  channelUsed: DialerMessageChannel
  status: 'queued' | 'sent' | 'failed'
}> {
  const { to, body, channelPreference, twilioStatusCallbackUrl, sendblueStatusCallbackUrl } = args

  if (channelPreference === 'sms') {
    const res = await twilioMessagingProvider.send({ to, body, statusCallbackUrl: twilioStatusCallbackUrl })
    return { twilioMessageSid: res.messageId, channelUsed: 'sms', status: res.status }
  }

  if (channelPreference === 'imessage' || channelPreference === 'auto') {
    const iRes = await sendblueMessagingProvider.send({ to, body, statusCallbackUrl: sendblueStatusCallbackUrl })
    if (iRes.status !== 'failed') {
      return { sendblueMessageId: iRes.messageId, channelUsed: 'imessage', status: iRes.status }
    }

    // Fallback to SMS on iMessage failure
    if (channelPreference === 'auto') {
      const smsRes = await twilioMessagingProvider.send({ to, body, statusCallbackUrl: twilioStatusCallbackUrl })
      return { twilioMessageSid: smsRes.messageId, channelUsed: 'fallback_sms', status: smsRes.status }
    }

    return { sendblueMessageId: iRes.messageId, channelUsed: 'imessage', status: 'failed' }
  }

  // unreachable; satisfy TS exhaustiveness
  throw new Error(`Unknown channelPreference: ${String(channelPreference)}`)
}
```

- [ ] **Step 25.3: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/services/messaging/sendblue.messaging-provider.ts src/services/messaging/messaging-router.service.ts
git commit -m "feat(messaging): add Sendblue iMessage impl + auto-fallback router

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 26: Shared opt-out compliance service

**Files:**
- Create: `src/services/dialer/compliance/opt-out-compliance.service.ts`

> Used by both branch B5 (live call opt-out) and inbound SMS STOP handler. Single source of truth.

- [ ] **Step 26.1: Create the service**

```ts
// services/dialer/compliance/opt-out-compliance.service.ts
import type { DialerDncSource } from '@/shared/constants/enums/dialer'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customers, dialerDnc, dialerLeadStates } from '@/shared/db/schema'

const OPT_OUT_KEYWORDS = /^(STOP|UNSUBSCRIBE|QUIT|CANCEL|END|REMOVE|OPT[\s-]?OUT)$/i

export function isOptOutKeyword(body: string): boolean {
  return OPT_OUT_KEYWORDS.test(body.trim())
}

/**
 * Records a lead opt-out. Idempotent — duplicate calls are safe (ON CONFLICT DO NOTHING).
 * Updates: dialer_dnc + dialer_lead_states (status='opted_out').
 */
export async function recordOptOut(args: {
  customerId: string
  source: DialerDncSource
  reason?: string
  addedByUserId?: string
}) {
  const customer = await db.select({ phone: customers.phone }).from(customers).where(eq(customers.id, args.customerId)).limit(1)
  if (!customer[0]?.phone) {
    throw new Error(`Customer ${args.customerId} has no phone`)
  }

  // 1. DNC insert (idempotent)
  await db.insert(dialerDnc)
    .values({
      phoneE164: customer[0].phone,
      source: args.source,
      reason: args.reason,
      addedByUserId: args.addedByUserId,
    })
    .onConflictDoNothing({ target: dialerDnc.phoneE164 })

  // 2. Lead state → opted_out (if enrolled)
  await db.update(dialerLeadStates)
    .set({ status: 'opted_out', nextAttemptAt: null })
    .where(eq(dialerLeadStates.customerId, args.customerId))
}
```

- [ ] **Step 26.2: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/services/dialer/compliance/opt-out-compliance.service.ts
git commit -m "feat(dialer): add shared opt-out compliance service

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 27: Dispatcher — startTestCall service

**Files:**
- Create: `src/services/dialer/dispatcher/start-test-call.service.ts`

> Phase 1's one-off dial trigger. Phase 2 introduces the full cadence-driven dispatcher.

- [ ] **Step 27.1: Create the service**

```ts
// services/dialer/dispatcher/start-test-call.service.ts
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customers, dialerDids, leadSourcesTable } from '@/shared/db/schema'
import { createDialerAttempt } from '@/shared/entities/dialer-attempts/dal/server/create'
import { updateDialerAttempt } from '@/shared/entities/dialer-attempts/dal/server/update'
import { getAiVoiceAgent } from '@/services/ai-voice/ai-voice-agent.factory'

export async function startTestCall(args: {
  customerId: string
  initiatedByUserId: string
}) {
  // 1. Look up customer + their lead source's Retell agent
  const [customer] = await db.select().from(customers).where(eq(customers.id, args.customerId)).limit(1)
  if (!customer) throw new Error(`Customer ${args.customerId} not found`)
  if (!customer.phone) throw new Error(`Customer ${args.customerId} has no phone`)
  if (!customer.leadSourceId) throw new Error(`Customer ${args.customerId} has no lead source`)

  const [leadSource] = await db.select().from(leadSourcesTable).where(eq(leadSourcesTable.id, customer.leadSourceId)).limit(1)
  if (!leadSource?.dialerConfigJSON?.enabled) {
    throw new Error(`Lead source ${customer.leadSourceId} is not dialer-enabled`)
  }
  if (!leadSource.dialerConfigJSON.retellAgentId) {
    throw new Error(`Lead source ${customer.leadSourceId} has no retell_agent_id configured`)
  }

  // 2. Pick a DID (Phase 1: simplest — first 'active' or 'warming' non-transfer DID)
  const [did] = await db.select().from(dialerDids)
    .where(eq(dialerDids.isTransferTargetDid, false))
    .limit(1)
  if (!did) throw new Error('No available DIDs in pool')

  // 3. Create dialer_attempt row (status='initiated')
  const attempt = await createDialerAttempt({
    customerId: customer.id,
    didUsed: did.e164Number,
    status: 'initiated',
  })

  // 4. Start the AI call via Retell
  const ai = getAiVoiceAgent()
  const result = await ai.startOutboundCall({
    agentId: leadSource.dialerConfigJSON.retellAgentId,
    from: did.e164Number,
    to: customer.phone,
    dynamicVariables: {
      lead_name: customer.name,
      trade: leadSource.dialerConfigJSON.trade,
      consent_context: leadSource.dialerConfigJSON.consentContext,
    },
    metadata: {
      dialerAttemptId: attempt!.id,
      customerId: customer.id,
    },
    webhookUrl: process.env.DIALER_WEBHOOK_BASE_URL!,
  })

  // 5. Update attempt with Retell ID + status='dialing'
  await updateDialerAttempt(attempt!.id, {
    retellCallId: result.agentCallId,
    status: 'dialing',
  })

  void args.initiatedByUserId  // logged via tRPC procedure caller, not in attempt row

  return { dialerAttemptId: attempt!.id, retellCallId: result.agentCallId }
}
```

- [ ] **Step 27.2: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/services/dialer/dispatcher/start-test-call.service.ts
git commit -m "feat(dialer): add startTestCall dispatcher service (Phase 1 manual trigger)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 28: Transfer router services

**Files:**
- Create: `src/services/dialer/transfer-router/find-available-human.service.ts`
- Create: `src/services/dialer/transfer-router/build-warm-intro.service.ts`

- [ ] **Step 28.1: Available-human picker**

```ts
// find-available-human.service.ts
import { listAvailableTransferHumans } from '@/shared/entities/dialer-user-availability/dal/server/list-available'

export type TransferDecision =
  | { kind: 'available', transferTo: string, userId: string }
  | { kind: 'no_one_available' }

export async function findAvailableHuman(): Promise<TransferDecision> {
  const candidates = await listAvailableTransferHumans()
  if (candidates.length === 0) return { kind: 'no_one_available' }

  // Phase 1: pick the one least-recently-transferred-to (round-robin equivalent)
  const sorted = [...candidates].sort((a, b) => {
    const aT = a.lastTransferredAt ?? '1970-01-01'
    const bT = b.lastTransferredAt ?? '1970-01-01'
    return aT.localeCompare(bT)
  })
  const chosen = sorted[0]

  if (chosen.transferMode === 'mobile' && chosen.cellPhoneE164) {
    return { kind: 'available', transferTo: chosen.cellPhoneE164, userId: chosen.userId }
  }
  // Default: desktop (or 'auto' falls back to desktop in Phase 1; mobile-auto resolution lands in Phase 4)
  return { kind: 'available', transferTo: `client:agent_${chosen.userId}`, userId: chosen.userId }
}
```

- [ ] **Step 28.2: Warm-intro composer**

```ts
// build-warm-intro.service.ts
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customers, leadSourcesTable } from '@/shared/db/schema'

const DEFAULT_TEMPLATE = '{name} on the line — interested in {trade}'

export async function buildWarmIntro(customerId: string): Promise<string> {
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1)
  if (!customer) return 'Lead on the line'

  let template = DEFAULT_TEMPLATE
  let trade = 'home improvement'

  if (customer.leadSourceId) {
    const [src] = await db.select().from(leadSourcesTable).where(eq(leadSourcesTable.id, customer.leadSourceId)).limit(1)
    if (src?.dialerConfigJSON?.warmIntroTemplate) template = src.dialerConfigJSON.warmIntroTemplate
    if (src?.dialerConfigJSON?.trade) trade = src.dialerConfigJSON.trade
  }

  return template
    .replace('{name}', customer.name)
    .replace('{trade}', trade)
    .replace('{city}', customer.city ?? '')
    .slice(0, 200)  // cap length to keep intros short
}
```

- [ ] **Step 28.3: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/services/dialer/transfer-router/
git commit -m "feat(dialer): add transfer-router services (find-available-human, build-warm-intro)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 29: Disposition recording service

**Files:**
- Create: `src/services/dialer/disposition/record.service.ts`

- [ ] **Step 29.1: Create the service**

```ts
// services/dialer/disposition/record.service.ts
import type { DialerDisposition } from '@/shared/constants/enums/dialer'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { dialerAttempts, dialerLeadStates } from '@/shared/db/schema'
import { findDialerAttemptById } from '@/shared/entities/dialer-attempts/dal/server/find-by-id'
import { recordOptOut } from '@/services/dialer/compliance/opt-out-compliance.service'

/**
 * Persists a final disposition for a dialer attempt + triggers downstream side effects:
 * - opt_out → DNC entry + lead state opted_out (via shared compliance service)
 * - booked_meeting / not_interested → lead state 'reached'
 * - wrong_number → lead state 'reached' + flag for admin review (Phase 5)
 */
export async function recordDisposition(args: {
  dialerAttemptId: string
  disposition: DialerDisposition
  recordedByUserId?: string  // null when set by AI webhook
}) {
  const attempt = await findDialerAttemptById(args.dialerAttemptId)
  if (!attempt) throw new Error(`DialerAttempt ${args.dialerAttemptId} not found`)

  await db.update(dialerAttempts)
    .set({ disposition: args.disposition })
    .where(eq(dialerAttempts.id, args.dialerAttemptId))

  // Side effects per disposition
  if (args.disposition === 'opt_out') {
    await recordOptOut({
      customerId: attempt.customerId,
      source: 'lead_request',
      reason: 'Opt-out during AI call',
      addedByUserId: args.recordedByUserId,
    })
    return
  }

  if (['booked_meeting', 'not_interested', 'wrong_number', 'interested_not_now'].includes(args.disposition)) {
    await db.update(dialerLeadStates)
      .set({
        status: args.disposition === 'interested_not_now' ? 'paused' : 'reached',
        lastDisposition: args.disposition,
        lastAttemptAt: new Date().toISOString(),
      })
      .where(eq(dialerLeadStates.customerId, attempt.customerId))
  }
}
```

- [ ] **Step 29.2: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/services/dialer/disposition/
git commit -m "feat(dialer): add disposition record service

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 30: Manual message send service

**Files:**
- Create: `src/services/dialer/messaging/send-manual-message.service.ts`

- [ ] **Step 30.1: Create the service**

```ts
// services/dialer/messaging/send-manual-message.service.ts
import type { DialerMessageChannel } from '@/shared/constants/enums/dialer'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema'
import { createDialerMessage } from '@/shared/entities/dialer-messages/dal/server/create'
import { lookupDialerDncByPhone } from '@/shared/entities/dialer-dnc/dal/server/lookup-by-phone'
import { sendMessageRouted } from '@/services/messaging/messaging-router.service'

export class DncBlockedError extends Error {
  constructor(phone: string) { super(`Phone ${phone} is on DNC; send blocked`) }
}

export async function sendManualMessage(args: {
  customerId: string
  body: string
  channelPreference: 'sms' | 'imessage' | 'auto'
}) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, args.customerId)).limit(1)
  if (!customer) throw new Error(`Customer ${args.customerId} not found`)
  if (!customer.phone) throw new Error(`Customer ${args.customerId} has no phone`)

  // Compliance: never send to DNC numbers
  if (await lookupDialerDncByPhone(customer.phone)) {
    throw new DncBlockedError(customer.phone)
  }

  const base = process.env.DIALER_WEBHOOK_BASE_URL!
  const result = await sendMessageRouted({
    to: customer.phone,
    body: args.body,
    channelPreference: args.channelPreference,
    twilioStatusCallbackUrl: `${base}/api/messaging/twilio/status`,
    sendblueStatusCallbackUrl: `${base}/api/messaging/sendblue/status`,
  })

  // Persist to dialer_messages
  const row = await createDialerMessage({
    customerId: customer.id,
    direction: 'outbound',
    channel: result.channelUsed,
    body: args.body,
    twilioMessageSid: result.twilioMessageSid,
    sendblueMessageId: result.sendblueMessageId,
    status: result.status === 'sent' ? 'sent' : result.status === 'failed' ? 'failed' : 'queued',
    sentAt: result.status !== 'failed' ? new Date().toISOString() : null,
    templateKey: 'manual',
  } as never)  // type assertion needed: discriminated union of vendor IDs

  return row
}
```

- [ ] **Step 30.2: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/services/dialer/messaging/
git commit -m "feat(messaging): add manual send service with DNC check

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 31: Webhook routes — Twilio Voice (access-token + status + recording)

**Files:**
- Create: `src/app/api/voip/twilio/access-token/route.ts`
- Create: `src/app/api/voip/twilio/status/route.ts`
- Create: `src/app/api/voip/twilio/recording/route.ts`
- Create: `src/services/voip/twilio-signature-verify.ts` (shared signature verification)

> **Pattern:** every webhook handler is THIN — verify signature → delegate to service. Routes return `200 OK` even on duplicate events (idempotent). 4xx only for malformed payloads or signature failures.

- [ ] **Step 31.1: Shared signature verification**

```ts
// services/voip/twilio-signature-verify.ts
import twilio from 'twilio'

/**
 * Verifies a Twilio webhook signature. Returns true if valid.
 * Use for status callbacks + recording callbacks + inbound SMS.
 */
export function verifyTwilioSignature(args: {
  signature: string | null
  url: string
  params: Record<string, string>
}): boolean {
  if (!args.signature) return false
  return twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    args.signature,
    args.url,
    args.params,
  )
}
```

- [ ] **Step 31.2: Access-token endpoint (returns JWT for browser SDK)**

```ts
// app/api/voip/twilio/access-token/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/shared/auth'  // existing better-auth helper; verify exact import path
import { getVoipProvider } from '@/services/voip/voip-provider.factory'

export async function GET() {
  const session = await auth.api.getSession({ headers: await import('next/headers').then(m => m.headers()) })
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const voip = getVoipProvider()
  const token = await voip.softphoneToken(session.user.id)
  return NextResponse.json(token)
}
```

> If the existing auth import path differs, adapt to match (search codebase for current `auth.api.getSession` usage).

- [ ] **Step 31.3: Status callback (call lifecycle)**

```ts
// app/api/voip/twilio/status/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { verifyTwilioSignature } from '@/services/voip/twilio-signature-verify'
import { findDialerAttemptByTwilioSid } from '@/shared/entities/dialer-attempts/dal/server/find-by-id'
import { updateDialerAttempt } from '@/shared/entities/dialer-attempts/dal/server/update'

export async function POST(req: Request) {
  const url = req.url
  const formData = await req.formData()
  const params: Record<string, string> = {}
  formData.forEach((v, k) => { params[k] = String(v) })

  const signature = (await headers()).get('x-twilio-signature')
  if (!verifyTwilioSignature({ signature, url, params })) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  }

  const callSid = params.CallSid
  const callStatus = params.CallStatus
  if (!callSid || !callStatus) return NextResponse.json({ ok: true })

  // Idempotent: look up by twilio_call_sid; missing rows are logged + dropped
  const attempt = await findDialerAttemptByTwilioSid(callSid)
  if (!attempt) {
    console.warn(`[twilio/status] No dialer_attempt for CallSid ${callSid}`)
    return NextResponse.json({ ok: true })
  }

  const patch: Record<string, unknown> = {}
  if (callStatus === 'answered' || callStatus === 'in-progress') {
    if (!attempt.answeredAt) patch.answeredAt = new Date().toISOString()
  }
  if (callStatus === 'completed') {
    patch.endedAt = new Date().toISOString()
    if (params.CallDuration) patch.durationSeconds = parseInt(params.CallDuration, 10)
  }
  if (callStatus === 'no-answer' || callStatus === 'busy' || callStatus === 'failed') {
    patch.endedAt = new Date().toISOString()
    patch.status = 'no_answer'
  }

  if (Object.keys(patch).length > 0) {
    await updateDialerAttempt(attempt.id, patch as never)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 31.4: Recording callback**

```ts
// app/api/voip/twilio/recording/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { verifyTwilioSignature } from '@/services/voip/twilio-signature-verify'
import { findDialerAttemptByTwilioSid } from '@/shared/entities/dialer-attempts/dal/server/find-by-id'
import { updateDialerAttempt } from '@/shared/entities/dialer-attempts/dal/server/update'

export async function POST(req: Request) {
  const url = req.url
  const formData = await req.formData()
  const params: Record<string, string> = {}
  formData.forEach((v, k) => { params[k] = String(v) })

  const signature = (await headers()).get('x-twilio-signature')
  if (!verifyTwilioSignature({ signature, url, params })) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  }

  const callSid = params.CallSid
  const recordingUrl = params.RecordingUrl
  const recordingDuration = params.RecordingDuration

  if (!callSid || !recordingUrl) return NextResponse.json({ ok: true })

  const attempt = await findDialerAttemptByTwilioSid(callSid)
  if (!attempt) return NextResponse.json({ ok: true })

  await updateDialerAttempt(attempt.id, {
    recordingUrl,
    recordingDurationSeconds: recordingDuration ? parseInt(recordingDuration, 10) : null,
  } as never)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 31.5: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/app/api/voip/ src/services/voip/twilio-signature-verify.ts
git commit -m "feat(dialer): add Twilio voice webhooks (access-token, status, recording)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 32: Webhook routes — Retell mid-call functions + call-completed

**Files:**
- Create: `src/services/ai-voice/retell-signature-verify.ts`
- Create: `src/app/api/dialer/ai/lead-context/route.ts`
- Create: `src/app/api/dialer/ai/route-transfer/route.ts`
- Create: `src/app/api/dialer/ai/log-disposition/route.ts`
- Create: `src/app/api/dialer/ai/call-completed/route.ts`

- [ ] **Step 32.1: Retell signature verifier**

```ts
// services/ai-voice/retell-signature-verify.ts
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Retell uses HMAC-SHA256 signed webhook payloads (header: `x-retell-signature`).
 * See https://docs.retellai.com/features/webhook-overview for current details.
 */
export function verifyRetellSignature(args: {
  signature: string | null
  body: string
}): boolean {
  if (!args.signature) return false
  const secret = process.env.RETELL_API_KEY!  // retell webhook uses the API key as signing secret per docs
  const expected = createHmac('sha256', secret).update(args.body).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(args.signature, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}
```

- [ ] **Step 32.2: /lead-context — mid-call function returning lead profile**

```ts
// app/api/dialer/ai/lead-context/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customers, leadSourcesTable } from '@/shared/db/schema'
import { verifyRetellSignature } from '@/services/ai-voice/retell-signature-verify'
import { findDialerAttemptByRetellId } from '@/shared/entities/dialer-attempts/dal/server/find-by-id'

export async function POST(req: Request) {
  const body = await req.text()
  const signature = (await headers()).get('x-retell-signature')
  if (!verifyRetellSignature({ signature, body })) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  }

  const payload = JSON.parse(body) as { call_id?: string, metadata?: { dialerAttemptId?: string } }
  const dialerAttemptId = payload.metadata?.dialerAttemptId
  if (!dialerAttemptId) return NextResponse.json({ error: 'missing dialerAttemptId' }, { status: 400 })

  const attempt = await findDialerAttemptByRetellId(payload.call_id ?? '') ?? null
  if (!attempt) return NextResponse.json({ error: 'attempt not found' }, { status: 404 })

  const [customer] = await db.select().from(customers).where(eq(customers.id, attempt.customerId)).limit(1)
  if (!customer) return NextResponse.json({ error: 'customer not found' }, { status: 404 })

  let trade = 'home improvement'
  let consentContext = 'inquiry'
  if (customer.leadSourceId) {
    const [src] = await db.select().from(leadSourcesTable).where(eq(leadSourcesTable.id, customer.leadSourceId)).limit(1)
    if (src?.dialerConfigJSON) {
      trade = src.dialerConfigJSON.trade
      consentContext = src.dialerConfigJSON.consentContext
    }
  }

  return NextResponse.json({
    lead_name: customer.name,
    trade,
    consent_context: consentContext,
    city: customer.city ?? null,
  })
}
```

- [ ] **Step 32.3: /route-transfer — return available human's number + warm-intro**

```ts
// app/api/dialer/ai/route-transfer/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { verifyRetellSignature } from '@/services/ai-voice/retell-signature-verify'
import { findDialerAttemptByRetellId } from '@/shared/entities/dialer-attempts/dal/server/find-by-id'
import { findAvailableHuman } from '@/services/dialer/transfer-router/find-available-human.service'
import { buildWarmIntro } from '@/services/dialer/transfer-router/build-warm-intro.service'

export async function POST(req: Request) {
  const body = await req.text()
  const signature = (await headers()).get('x-retell-signature')
  if (!verifyRetellSignature({ signature, body })) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  }

  const payload = JSON.parse(body) as { call_id?: string }
  const attempt = await findDialerAttemptByRetellId(payload.call_id ?? '')
  if (!attempt) return NextResponse.json({ error: 'attempt not found' }, { status: 404 })

  const decision = await findAvailableHuman()
  if (decision.kind === 'no_one_available') {
    return NextResponse.json({
      transfer_to: null,
      action: 'schedule_callback',
      message: 'Our advisor is on another call right now — when works for a callback?',
    })
  }

  const warmIntro = await buildWarmIntro(attempt.customerId)
  return NextResponse.json({
    transfer_to: decision.transferTo,
    warm_intro: warmIntro,
  })
}
```

- [ ] **Step 32.4: /log-disposition — Retell function for non-transfer outcomes**

```ts
// app/api/dialer/ai/log-disposition/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { verifyRetellSignature } from '@/services/ai-voice/retell-signature-verify'
import { findDialerAttemptByRetellId } from '@/shared/entities/dialer-attempts/dal/server/find-by-id'
import { recordDisposition } from '@/services/dialer/disposition/record.service'
import type { DialerDisposition } from '@/shared/constants/enums/dialer'

const ALLOWED: DialerDisposition[] = [
  'opt_out', 'wrong_number', 'not_interested', 'interested_not_now', 'voicemail',
]

export async function POST(req: Request) {
  const body = await req.text()
  const signature = (await headers()).get('x-retell-signature')
  if (!verifyRetellSignature({ signature, body })) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  }

  const payload = JSON.parse(body) as { call_id?: string, disposition?: string }
  const disposition = payload.disposition as DialerDisposition | undefined
  if (!disposition || !ALLOWED.includes(disposition)) {
    return NextResponse.json({ error: 'invalid disposition' }, { status: 400 })
  }

  const attempt = await findDialerAttemptByRetellId(payload.call_id ?? '')
  if (!attempt) return NextResponse.json({ error: 'attempt not found' }, { status: 404 })

  await recordDisposition({ dialerAttemptId: attempt.id, disposition })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 32.5: /call-completed — Retell final webhook**

```ts
// app/api/dialer/ai/call-completed/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { verifyRetellSignature } from '@/services/ai-voice/retell-signature-verify'
import { findDialerAttemptByRetellId } from '@/shared/entities/dialer-attempts/dal/server/find-by-id'
import { updateDialerAttempt } from '@/shared/entities/dialer-attempts/dal/server/update'

export async function POST(req: Request) {
  const body = await req.text()
  const signature = (await headers()).get('x-retell-signature')
  if (!verifyRetellSignature({ signature, body })) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  }

  const payload = JSON.parse(body) as {
    call_id?: string
    transcript_summary?: string
    user_sentiment?: string
    call_analysis?: { call_summary?: string, user_sentiment?: string }
  }

  const attempt = await findDialerAttemptByRetellId(payload.call_id ?? '')
  if (!attempt) return NextResponse.json({ ok: true })

  await updateDialerAttempt(attempt.id, {
    aiSummary: payload.call_analysis?.call_summary ?? payload.transcript_summary ?? null,
    aiSentiment: payload.call_analysis?.user_sentiment ?? payload.user_sentiment ?? null,
    endedAt: attempt.endedAt ?? new Date().toISOString(),
  } as never)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 32.6: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/app/api/dialer/ src/services/ai-voice/retell-signature-verify.ts
git commit -m "feat(dialer): add Retell AI webhooks (lead-context, route-transfer, log-disposition, call-completed)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 33: Webhook routes — Twilio Messaging (inbound STOP + status)

**Files:**
- Create: `src/app/api/messaging/twilio/inbound/route.ts`
- Create: `src/app/api/messaging/twilio/status/route.ts`

- [ ] **Step 33.1: Inbound SMS (STOP handler)**

```ts
// app/api/messaging/twilio/inbound/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema'
import { verifyTwilioSignature } from '@/services/voip/twilio-signature-verify'
import { createDialerMessage } from '@/shared/entities/dialer-messages/dal/server/create'
import { isOptOutKeyword, recordOptOut } from '@/services/dialer/compliance/opt-out-compliance.service'
import { twilioMessagingProvider } from '@/services/messaging/twilio.messaging-provider'

export async function POST(req: Request) {
  const url = req.url
  const formData = await req.formData()
  const params: Record<string, string> = {}
  formData.forEach((v, k) => { params[k] = String(v) })

  const signature = (await headers()).get('x-twilio-signature')
  if (!verifyTwilioSignature({ signature, url, params })) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  }

  const from = params.From
  const body = params.Body ?? ''
  const messageSid = params.MessageSid

  if (!from || !messageSid) return NextResponse.json({ ok: true })

  // Find customer by phone
  const [customer] = await db.select().from(customers).where(eq(customers.phone, from)).limit(1)
  if (!customer) {
    console.warn(`[messaging/twilio/inbound] No customer for phone ${from}`)
    // Still log the inbound; just no customer FK
    return NextResponse.json({ ok: true })
  }

  // Log inbound
  await createDialerMessage({
    customerId: customer.id,
    direction: 'inbound',
    channel: 'sms',
    body,
    twilioMessageSid: messageSid,
    status: 'received',
  } as never)

  // STOP handling
  if (isOptOutKeyword(body)) {
    await recordOptOut({
      customerId: customer.id,
      source: 'sms_opt_out',
      reason: `Lead replied "${body.trim()}"`,
    })
    // Auto-confirm (TCPA mandatory)
    await twilioMessagingProvider.send({
      to: from,
      body: 'You have been unsubscribed from Tri Pros Remodeling. You will not receive further calls or messages.',
    })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 33.2: Twilio message status callback**

```ts
// app/api/messaging/twilio/status/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { verifyTwilioSignature } from '@/services/voip/twilio-signature-verify'
import { updateMessageStatusByTwilioSid } from '@/shared/entities/dialer-messages/dal/server/update-status-by-vendor-id'
import type { DialerMessageStatus } from '@/shared/constants/enums/dialer'

const TWILIO_TO_INTERNAL: Record<string, DialerMessageStatus> = {
  queued: 'queued',
  sending: 'queued',
  sent: 'sent',
  delivered: 'delivered',
  failed: 'failed',
  undelivered: 'undelivered',
}

export async function POST(req: Request) {
  const url = req.url
  const formData = await req.formData()
  const params: Record<string, string> = {}
  formData.forEach((v, k) => { params[k] = String(v) })

  const signature = (await headers()).get('x-twilio-signature')
  if (!verifyTwilioSignature({ signature, url, params })) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  }

  const sid = params.MessageSid
  const twilioStatus = params.MessageStatus
  const internalStatus = twilioStatus ? TWILIO_TO_INTERNAL[twilioStatus] : undefined
  if (!sid || !internalStatus) return NextResponse.json({ ok: true })

  const timestamps: { deliveredAt?: string, failedAt?: string } = {}
  if (internalStatus === 'delivered') timestamps.deliveredAt = new Date().toISOString()
  if (internalStatus === 'failed' || internalStatus === 'undelivered') timestamps.failedAt = new Date().toISOString()

  await updateMessageStatusByTwilioSid(sid, internalStatus, timestamps)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 33.3: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/app/api/messaging/twilio/
git commit -m "feat(messaging): add Twilio SMS webhooks (inbound STOP handler + status)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 34: Webhook routes — Sendblue (inbound + status) — **⏸ DEFERRED (2026-05-22)**

> **Status:** DEFERRED with Task 25. Sendblue webhooks have no purpose until Sendblue's `MessagingProvider` impl exists. Skip this task entirely; it's retained as reference for the future Sendblue add.

**Files (deferred):**
- Create: `src/services/messaging/sendblue-signature-verify.ts`
- Create: `src/app/api/messaging/sendblue/inbound/route.ts`
- Create: `src/app/api/messaging/sendblue/status/route.ts`

- [ ] **Step 34.1: Sendblue signature verifier**

```ts
// services/messaging/sendblue-signature-verify.ts
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Sendblue webhook signature. Check sendblue.com docs for exact header name + algorithm —
 * adjust if their docs differ (this is the typical HMAC-SHA256 pattern).
 */
export function verifySendblueSignature(args: { signature: string | null, body: string }): boolean {
  if (!args.signature) return false
  const expected = createHmac('sha256', process.env.SENDBLUE_API_SECRET!).update(args.body).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(args.signature, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}
```

- [ ] **Step 34.2: Inbound iMessage**

```ts
// app/api/messaging/sendblue/inbound/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema'
import { verifySendblueSignature } from '@/services/messaging/sendblue-signature-verify'
import { createDialerMessage } from '@/shared/entities/dialer-messages/dal/server/create'
import { isOptOutKeyword, recordOptOut } from '@/services/dialer/compliance/opt-out-compliance.service'
import { sendblueMessagingProvider } from '@/services/messaging/sendblue.messaging-provider'

export async function POST(req: Request) {
  const body = await req.text()
  const signature = (await headers()).get('sb-signature')
  if (!verifySendblueSignature({ signature, body })) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  }

  const payload = JSON.parse(body) as {
    from_number?: string
    content?: string
    message_handle?: string
  }
  const from = payload.from_number
  const content = payload.content ?? ''
  const messageId = payload.message_handle

  if (!from || !messageId) return NextResponse.json({ ok: true })

  const [customer] = await db.select().from(customers).where(eq(customers.phone, from)).limit(1)
  if (!customer) return NextResponse.json({ ok: true })

  await createDialerMessage({
    customerId: customer.id,
    direction: 'inbound',
    channel: 'imessage',
    body: content,
    sendblueMessageId: messageId,
    status: 'received',
  } as never)

  if (isOptOutKeyword(content)) {
    await recordOptOut({
      customerId: customer.id,
      source: 'sms_opt_out',
      reason: `Lead replied "${content.trim()}" via iMessage`,
    })
    await sendblueMessagingProvider.send({
      to: from,
      body: 'You have been unsubscribed from Tri Pros Remodeling. You will not receive further calls or messages.',
    })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 34.3: Sendblue status callback**

```ts
// app/api/messaging/sendblue/status/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { verifySendblueSignature } from '@/services/messaging/sendblue-signature-verify'
import { updateMessageStatusBySendblueId } from '@/shared/entities/dialer-messages/dal/server/update-status-by-vendor-id'
import type { DialerMessageStatus } from '@/shared/constants/enums/dialer'

const SENDBLUE_TO_INTERNAL: Record<string, DialerMessageStatus> = {
  QUEUED: 'queued',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
}

export async function POST(req: Request) {
  const body = await req.text()
  const signature = (await headers()).get('sb-signature')
  if (!verifySendblueSignature({ signature, body })) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  }

  const payload = JSON.parse(body) as { message_handle?: string, status?: string }
  const sid = payload.message_handle
  const internalStatus = payload.status ? SENDBLUE_TO_INTERNAL[payload.status] : undefined
  if (!sid || !internalStatus) return NextResponse.json({ ok: true })

  const timestamps: { deliveredAt?: string, failedAt?: string } = {}
  if (internalStatus === 'delivered') timestamps.deliveredAt = new Date().toISOString()
  if (internalStatus === 'failed') timestamps.failedAt = new Date().toISOString()

  await updateMessageStatusBySendblueId(sid, internalStatus, timestamps)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 34.4: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/app/api/messaging/sendblue/ src/services/messaging/sendblue-signature-verify.ts
git commit -m "feat(messaging): add Sendblue iMessage webhooks (inbound + status)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 35: tRPC routers — dialer-attempts + dialer-messages

**Files:**
- Create: `src/trpc/routers/dialer-attempts.router.ts`
- Create: `src/trpc/routers/dialer-messages.router.ts`
- Modify: `src/trpc/routers/app.ts`

> Both are minimal Phase 1 cuts. Phase 4 expands them significantly. CASL gating enforced via existing `agentProcedure` patterns — read codebase for current pattern, adapt these signatures.

- [ ] **Step 35.1: dialer-attempts router**

```ts
// trpc/routers/dialer-attempts.router.ts
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, agentProcedure } from '@/trpc/trpc'  // adapt to actual import path
import { startTestCall } from '@/services/dialer/dispatcher/start-test-call.service'
import { listRecentDialerAttempts } from '@/shared/entities/dialer-attempts/dal/server/list'
import { findDialerAttemptById } from '@/shared/entities/dialer-attempts/dal/server/find-by-id'
import { recordDisposition } from '@/services/dialer/disposition/record.service'
import { dialerDispositions } from '@/shared/constants/enums/dialer'

export const dialerAttemptsRouter = createTRPCRouter({
  /** Phase 1 manual dial trigger (super_admin only — gated via CASL on the caller side). */
  startTestCall: agentProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // CASL gate: ensure caller can `manage` DIALER_ATTEMPT
      if (!ctx.ability.can('manage', 'DialerAttempt')) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }
      return startTestCall({ customerId: input.customerId, initiatedByUserId: ctx.session.user.id })
    }),

  list: agentProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.ability.can('read', 'DialerAttempt')) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }
      return listRecentDialerAttempts(input.limit)
    }),

  getById: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await findDialerAttemptById(input.id)
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' })
      if (!ctx.ability.can('read', 'DialerAttempt')) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }
      return row
    }),

  setDisposition: agentProcedure
    .input(z.object({
      dialerAttemptId: z.string().uuid(),
      disposition: z.enum(dialerDispositions),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.ability.can('manage', 'DialerAttempt')) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }
      await recordDisposition({
        dialerAttemptId: input.dialerAttemptId,
        disposition: input.disposition,
        recordedByUserId: ctx.session.user.id,
      })
      return { ok: true }
    }),
})
```

- [ ] **Step 35.2: dialer-messages router**

```ts
// trpc/routers/dialer-messages.router.ts
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, agentProcedure } from '@/trpc/trpc'
import { sendManualMessage, DncBlockedError } from '@/services/dialer/messaging/send-manual-message.service'
import { listMessagesByCustomer } from '@/shared/entities/dialer-messages/dal/server/list-by-customer'

export const dialerMessagesRouter = createTRPCRouter({
  send: agentProcedure
    .input(z.object({
      customerId: z.string().uuid(),
      body: z.string().min(1).max(1600),
      channelPreference: z.enum(['sms', 'imessage', 'auto']),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.ability.can('send', 'DialerMessage')) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }
      try {
        return await sendManualMessage(input)
      }
      catch (e) {
        if (e instanceof DncBlockedError) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: e.message })
        }
        throw e
      }
    }),

  listByCustomer: agentProcedure
    .input(z.object({ customerId: z.string().uuid(), limit: z.number().int().min(1).max(500).default(100) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.ability.can('read', 'DialerMessage')) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }
      return listMessagesByCustomer(input.customerId, input.limit)
    }),
})
```

- [ ] **Step 35.3: Register in app.ts**

In `src/trpc/routers/app.ts`, add:

```ts
import { dialerAttemptsRouter } from './dialer-attempts.router'
import { dialerMessagesRouter } from './dialer-messages.router'

export const appRouter = createTRPCRouter({
  // ...existing routers
  dialerAttempts: dialerAttemptsRouter,
  dialerMessages: dialerMessagesRouter,
})
```

Match the existing register pattern (read `app.ts` first).

- [ ] **Step 35.4: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/trpc/routers/dialer-attempts.router.ts src/trpc/routers/dialer-messages.router.ts src/trpc/routers/app.ts
git commit -m "feat(dialer): add tRPC routers for dialer-attempts + dialer-messages

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 36: Browser softphone widget

**Files:**
- Create: `src/shared/components/dialer/softphone-widget/twilio-device.provider.tsx`
- Create: `src/shared/components/dialer/softphone-widget/use-twilio-device.ts`
- Create: `src/shared/components/dialer/softphone-widget/use-softphone-token.ts`
- Create: `src/shared/components/dialer/softphone-widget/softphone-widget.tsx`
- Create: `src/shared/components/dialer/softphone-widget/incoming-call-banner.tsx`
- Create: `src/shared/components/dialer/softphone-widget/call-active-panel.tsx`
- Create: `src/shared/components/dialer/softphone-widget/index.ts`

> **If the Task 2 spike chose a 3rd-party wrapper:** adapt these files to compose that wrapper. The structure remains: a Provider, a hook, the visible widget, banner sub-component, active-call sub-component. **If no acceptable wrapper found:** the code below shows the custom hook/provider pattern around `@twilio/voice-sdk` v2.

- [ ] **Step 36.1: Token fetcher hook**

```ts
// use-softphone-token.ts
'use client'
import { useEffect, useState } from 'react'

interface TokenPayload { token: string, identity: string, ttlSeconds: number }

export function useSoftphoneToken() {
  const [token, setToken] = useState<TokenPayload | null>(null)

  async function refresh() {
    const res = await fetch('/api/voip/twilio/access-token')
    if (res.ok) setToken(await res.json() as TokenPayload)
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 50 * 60 * 1000)  // refresh every 50 min (TTL=60min)
    return () => clearInterval(interval)
  }, [])

  return token
}
```

- [ ] **Step 36.2: Device hook**

```ts
// use-twilio-device.ts
'use client'
import { Device, Call } from '@twilio/voice-sdk'
import { useEffect, useRef, useState } from 'react'

export interface IncomingCallSummary {
  call: Call
  customParameters: Record<string, string>
  from: string
}

export function useTwilioDevice(token: string | null) {
  const deviceRef = useRef<Device | null>(null)
  const [status, setStatus] = useState<'idle' | 'registering' | 'registered' | 'error'>('idle')
  const [incomingCall, setIncomingCall] = useState<IncomingCallSummary | null>(null)
  const [activeCall, setActiveCall] = useState<Call | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    const device = new Device(token, { logLevel: 1, allowIncomingWhileBusy: false })
    deviceRef.current = device
    setStatus('registering')

    device.on('registered', () => setStatus('registered'))
    device.on('error', (err: Error) => {
      setStatus('error')
      setErrorMessage(err.message)
    })
    device.on('incoming', (call: Call) => {
      const customParameters: Record<string, string> = {}
      call.customParameters.forEach((v: string, k: string) => { customParameters[k] = v })
      setIncomingCall({ call, customParameters, from: call.parameters.From })
      call.on('accept', () => {
        setActiveCall(call)
        setIncomingCall(null)
      })
      call.on('cancel', () => setIncomingCall(null))
      call.on('reject', () => setIncomingCall(null))
      call.on('disconnect', () => {
        setActiveCall(null)
        setIncomingCall(null)
      })
    })

    device.register()

    return () => { device.destroy() }
  }, [token])

  function accept() {
    incomingCall?.call.accept()
  }

  function reject() {
    incomingCall?.call.reject()
  }

  function hangup() {
    activeCall?.disconnect()
  }

  function setMute(muted: boolean) {
    activeCall?.mute(muted)
  }

  return { status, incomingCall, activeCall, errorMessage, accept, reject, hangup, setMute }
}
```

- [ ] **Step 36.3: Provider**

```tsx
// twilio-device.provider.tsx
'use client'
import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'
import { useSoftphoneToken } from './use-softphone-token'
import { useTwilioDevice } from './use-twilio-device'

type DeviceContextValue = ReturnType<typeof useTwilioDevice>

const DeviceContext = createContext<DeviceContextValue | null>(null)

interface ProviderProps { children: ReactNode }

export function TwilioDeviceProvider({ children }: ProviderProps) {
  const token = useSoftphoneToken()
  const device = useTwilioDevice(token?.token ?? null)
  return <DeviceContext.Provider value={device}>{children}</DeviceContext.Provider>
}

export function useTwilioDeviceContext() {
  const ctx = useContext(DeviceContext)
  if (!ctx) throw new Error('useTwilioDeviceContext must be used inside <TwilioDeviceProvider>')
  return ctx
}
```

- [ ] **Step 36.4: Incoming-call banner**

```tsx
// incoming-call-banner.tsx
'use client'
import { useTwilioDeviceContext } from './twilio-device.provider'
import { Button } from '@/shared/components/ui/button'  // adapt to your existing shadcn button path

interface BannerProps { onAccept?: () => void }

export function IncomingCallBanner({ onAccept }: BannerProps) {
  const { incomingCall, accept, reject } = useTwilioDeviceContext()
  if (!incomingCall) return null

  const params = incomingCall.customParameters
  const leadName = params.lead_name ?? 'Unknown lead'
  const trade = params.trade ?? ''
  const city = params.city ?? ''

  function handleAccept() {
    accept()
    onAccept?.()
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg border bg-background p-4 shadow-lg">
      <div className="text-sm font-medium">Incoming transfer</div>
      <div className="mt-1 text-lg">{leadName}</div>
      {(trade || city) && <div className="text-xs text-muted-foreground">{[trade, city].filter(Boolean).join(' • ')}</div>}
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={handleAccept}>Accept</Button>
        <Button size="sm" variant="outline" onClick={reject}>Decline</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 36.5: Active-call panel**

```tsx
// call-active-panel.tsx
'use client'
import { useState } from 'react'
import { useTwilioDeviceContext } from './twilio-device.provider'
import { Button } from '@/shared/components/ui/button'

export function CallActivePanel() {
  const { activeCall, hangup, setMute } = useTwilioDeviceContext()
  const [muted, setMuted] = useState(false)
  if (!activeCall) return null

  function toggleMute() {
    setMute(!muted)
    setMuted(!muted)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg border bg-background p-4 shadow-lg">
      <div className="text-sm font-medium">On call</div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</Button>
        <Button size="sm" variant="destructive" onClick={hangup}>Hang up</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 36.6: Main widget (composition)**

```tsx
// softphone-widget.tsx
'use client'
import { useState } from 'react'
import { TwilioDeviceProvider, useTwilioDeviceContext } from './twilio-device.provider'
import { IncomingCallBanner } from './incoming-call-banner'
import { CallActivePanel } from './call-active-panel'
import { CallDispositionPicker } from '@/shared/components/dialer/call-disposition-picker'

function WidgetInner() {
  const { incomingCall, activeCall } = useTwilioDeviceContext()
  const [pendingDispositionForAttemptId, setPendingDispositionForAttemptId] = useState<string | null>(null)
  const lastDialerAttemptId = activeCall?.customParameters.get('dialer_attempt_id') ?? null

  function handleAccept() {
    if (lastDialerAttemptId) setPendingDispositionForAttemptId(lastDialerAttemptId)
  }

  function handleClose() {
    setPendingDispositionForAttemptId(null)
  }

  return (
    <>
      {incomingCall && <IncomingCallBanner onAccept={handleAccept} />}
      {activeCall && <CallActivePanel />}
      {pendingDispositionForAttemptId && !activeCall && (
        <CallDispositionPicker
          dialerAttemptId={pendingDispositionForAttemptId}
          onClose={handleClose}
        />
      )}
    </>
  )
}

export function SoftphoneWidget() {
  return (
    <TwilioDeviceProvider>
      <WidgetInner />
    </TwilioDeviceProvider>
  )
}
```

- [ ] **Step 36.7: index.ts barrel — NO barrel files in ui/components (per memory)**

Skip — per convention `feedback-entity-organization.md` no barrel files in component dirs. Import the widget directly via:

```ts
import { SoftphoneWidget } from '@/shared/components/dialer/softphone-widget/softphone-widget'
```

- [ ] **Step 36.8: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/components/dialer/softphone-widget/
git commit -m "feat(dialer): add browser softphone widget (Twilio Voice SDK)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 37: Call disposition picker modal

**Files:**
- Create: `src/shared/components/dialer/call-disposition-picker/call-disposition-picker.tsx`

- [ ] **Step 37.1: Create the component**

```tsx
// call-disposition-picker.tsx
'use client'
import { useState } from 'react'
import type { DialerDisposition } from '@/shared/constants/enums/dialer'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { useTRPC } from '@/trpc/helpers'
import { useMutation } from '@tanstack/react-query'

interface PickerProps {
  dialerAttemptId: string
  onClose: () => void
}

const OPTIONS: { value: DialerDisposition, label: string, variant?: 'default' | 'destructive' | 'outline' }[] = [
  { value: 'booked_meeting', label: 'Booked meeting' },
  { value: 'interested_not_now', label: 'Interested, not now', variant: 'outline' },
  { value: 'not_interested', label: 'Not interested', variant: 'outline' },
  { value: 'wrong_number', label: 'Wrong number', variant: 'outline' },
  { value: 'opt_out', label: 'Opt-out — DNC', variant: 'destructive' },
]

export function CallDispositionPicker({ dialerAttemptId, onClose }: PickerProps) {
  const trpc = useTRPC()
  const setMutation = useMutation(trpc.dialerAttempts.setDisposition.mutationOptions({
    onSuccess: () => onClose(),
  }))
  const [submitting, setSubmitting] = useState(false)

  async function pick(value: DialerDisposition) {
    setSubmitting(true)
    setMutation.mutate({ dialerAttemptId, disposition: value })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disposition the call</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-2">
          {OPTIONS.map(opt => (
            <Button
              key={opt.value}
              className="w-full justify-start"
              variant={opt.variant ?? 'default'}
              disabled={submitting}
              onClick={() => pick(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 37.2: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/components/dialer/call-disposition-picker/
git commit -m "feat(dialer): add call disposition picker modal

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 38: Send message button component

**Files:**
- Create: `src/shared/components/dialer/send-message-button/send-message-button.tsx`

- [ ] **Step 38.1: Create the component**

```tsx
// send-message-button.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { Textarea } from '@/shared/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useTRPC } from '@/trpc/helpers'
import { useMutation } from '@tanstack/react-query'

interface ButtonProps { customerId: string }

export function SendMessageButton({ customerId }: ButtonProps) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [channel, setChannel] = useState<'auto' | 'sms' | 'imessage'>('auto')
  const trpc = useTRPC()
  const send = useMutation(trpc.dialerMessages.send.mutationOptions({
    onSuccess: () => {
      setOpen(false)
      setBody('')
    },
  }))

  function handleSubmit() {
    send.mutate({ customerId, body, channelPreference: channel })
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Send message</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send message</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (iMessage → SMS)</SelectItem>
                <SelectItem value="imessage">iMessage</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Type your message…" />
            <Button onClick={handleSubmit} disabled={!body.trim() || send.isPending}>
              {send.isPending ? 'Sending…' : 'Send'}
            </Button>
            {send.error && <div className="text-sm text-destructive">{send.error.message}</div>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 38.2: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/components/dialer/send-message-button/
git commit -m "feat(messaging): add send-message-button component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 39: Call-now button component

**Files:**
- Create: `src/shared/components/dialer/call-now-button/call-now-button.tsx`

- [ ] **Step 39.1: Create the component**

```tsx
// call-now-button.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { useTRPC } from '@/trpc/helpers'
import { useMutation } from '@tanstack/react-query'

interface ButtonProps { customerId: string }

export function CallNowButton({ customerId }: ButtonProps) {
  const [confirmed, setConfirmed] = useState(false)
  const trpc = useTRPC()
  const startCall = useMutation(trpc.dialerAttempts.startTestCall.mutationOptions({
    onSuccess: () => setConfirmed(false),
  }))

  function handleClick() {
    if (!confirmed) {
      setConfirmed(true)
      setTimeout(() => setConfirmed(false), 3000)
      return
    }
    startCall.mutate({ customerId })
  }

  return (
    <Button
      size="sm"
      variant={confirmed ? 'destructive' : 'default'}
      onClick={handleClick}
      disabled={startCall.isPending}
    >
      {startCall.isPending ? 'Starting…' : confirmed ? 'Confirm — Dial now (AI)' : 'Dial now (AI)'}
    </Button>
  )
}
```

- [ ] **Step 39.2: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/components/dialer/call-now-button/
git commit -m "feat(dialer): add call-now-button placeable component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 40: Mount softphone widget in dashboard layout

**Files:**
- Modify: `src/app/(frontend)/(dashboard)/layout.tsx`

> Read the existing layout file first to understand its structure before editing.

- [ ] **Step 40.1: Mount the softphone**

Add to the layout body (somewhere outside the main page content tree so it persists across route changes):

```tsx
import { SoftphoneWidget } from '@/shared/components/dialer/softphone-widget/softphone-widget'

// In the layout JSX, after main content:
<SoftphoneWidget />
```

The widget self-mounts via `TwilioDeviceProvider`, so the layout just needs to include it. It only fetches a token if the user is logged in (the access-token endpoint returns 401 otherwise).

- [ ] **Step 40.2: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/app/(frontend)/(dashboard)/layout.tsx
git commit -m "feat(dialer): mount softphone widget globally in dashboard layout

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 41: Auto-dialer feature view + dashboard route

**Files:**
- Create: `src/features/auto-dialer/ui/views/dialer-admin-view.tsx`
- Create: `src/app/(frontend)/(dashboard)/auto-dialer/page.tsx`

- [ ] **Step 41.1: Create the admin view**

```tsx
// features/auto-dialer/ui/views/dialer-admin-view.tsx
'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'
import { CallNowButton } from '@/shared/components/dialer/call-now-button/call-now-button'
import { SendMessageButton } from '@/shared/components/dialer/send-message-button/send-message-button'
import { Input } from '@/shared/components/ui/input'
import { Card } from '@/shared/components/ui/card'

export function DialerAdminView() {
  const [customerId, setCustomerId] = useState('')
  const trpc = useTRPC()
  const recent = useQuery(trpc.dialerAttempts.list.queryOptions({ limit: 20 }))

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Auto-dialer (Phase 1)</h1>
        <p className="text-sm text-muted-foreground">Manual dial trigger + recent attempts. Super-admin only.</p>
      </header>

      <Card className="p-4">
        <h2 className="font-semibold">Test a call</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a customer ID to trigger a one-off AI dial. With DIALER_DEV_OVERRIDE_NUMBER set,
          the call routes to your test number instead of the customer's actual phone.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Input
            placeholder="Customer ID (UUID)"
            value={customerId}
            onChange={e => setCustomerId(e.target.value)}
            className="max-w-md"
          />
          {customerId.length === 36 && (
            <>
              <CallNowButton customerId={customerId} />
              <SendMessageButton customerId={customerId} />
            </>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold">Recent dialer attempts</h2>
        {recent.isLoading && <p className="text-sm">Loading…</p>}
        {recent.data && recent.data.length === 0 && <p className="text-sm text-muted-foreground">No attempts yet.</p>}
        {recent.data && recent.data.length > 0 && (
          <ul className="mt-3 space-y-2 text-sm">
            {recent.data.map(row => (
              <li key={row.id} className="border-b pb-1">
                <span className="font-mono text-xs">{row.id.slice(0, 8)}</span>{' '}
                <span>{row.status}</span>{' '}
                {row.disposition && <span>→ {row.disposition}</span>}{' '}
                <span className="text-muted-foreground">{row.initiatedAt}</span>
                {row.recordingUrl && (
                  <a
                    href={row.recordingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-xs underline"
                  >
                    Recording
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
```

- [ ] **Step 41.2: Mount the route**

```tsx
// app/(frontend)/(dashboard)/auto-dialer/page.tsx
import { DialerAdminView } from '@/features/auto-dialer/ui/views/dialer-admin-view'

export default function AutoDialerPage() {
  return <DialerAdminView />
}
```

- [ ] **Step 41.3: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/features/auto-dialer/ src/app/\(frontend\)/\(dashboard\)/auto-dialer/
git commit -m "feat(auto-dialer): add admin view + /dashboard/auto-dialer route

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 42: Seed scripts (DIDs + dialer settings + example lead source config)

**Files:**
- Create: `scripts/seed-dialer-dids.ts`
- Create: `scripts/seed-dialer-settings.ts`
- Create: `scripts/configure-lead-source-dialer.ts`

> These are one-off bootstrap scripts. Run via `pnpm tsx scripts/<name>.ts` (matches existing script pattern). Use `import './lib/load-env'` (not `'dotenv/config'`) per memory `feedback-scripts-load-env.md`.

- [ ] **Step 42.1: DID seed**

```ts
// scripts/seed-dialer-dids.ts
import './lib/load-env'
import { db } from '@/shared/db'
import { dialerDids } from '@/shared/db/schema'

interface DidInput {
  e164Number: string
  twilioPhoneSid: string
}

// Phase 0 pilot DIDs — read straight from env so we don't drift from .env.
// Pool expansion (to 7-10 DIDs) lands ~1-2 weeks before Phase 2 ramp.
const PILOT_DIDS: DidInput[] = [
  { e164Number: process.env.TWILIO_DID_213_E164!, twilioPhoneSid: process.env.TWILIO_DID_213_SID! },
  { e164Number: process.env.TWILIO_DID_424_E164!, twilioPhoneSid: process.env.TWILIO_DID_424_SID! },
  { e164Number: process.env.TWILIO_DID_626_E164!, twilioPhoneSid: process.env.TWILIO_DID_626_SID! },
]

const TRANSFER_TARGET = process.env.TWILIO_TRANSFER_TARGET_DID_E164!

function deriveAreaCode(e164: string): string {
  // +1AAAXXXXXXX → AAA
  return e164.slice(2, 5)
}

async function main() {
  if (!TRANSFER_TARGET) {
    console.error('TWILIO_TRANSFER_TARGET_DID_E164 is required')
    process.exit(1)
  }
  for (const did of PILOT_DIDS) {
    if (!did.e164Number || !did.twilioPhoneSid) {
      console.error('Missing TWILIO_DID_*_E164 / _SID env var; aborting.')
      process.exit(1)
    }
  }

  console.log('Seeding dialer DIDs…')
  for (const did of PILOT_DIDS) {
    const isTransferTarget = did.e164Number === TRANSFER_TARGET
    await db.insert(dialerDids).values({
      e164Number: did.e164Number,
      areaCode: deriveAreaCode(did.e164Number),
      twilioPhoneSid: did.twilioPhoneSid,
      status: isTransferTarget ? 'active' : 'warming',
      dailyCap: isTransferTarget ? 200 : 20,
      isTransferTargetDid: isTransferTarget,
      warmingStartedAt: isTransferTarget ? null : new Date().toISOString(),
    }).onConflictDoNothing({ target: dialerDids.e164Number })
  }
  console.log(`Inserted ${PILOT_DIDS.length} DIDs (skipped duplicates). Transfer target = ${TRANSFER_TARGET}.`)
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
```

> **Before running:** verify `.env` (or `.env.local`) has all six `TWILIO_DID_{213,424,626}_{E164,SID}` vars plus `TWILIO_TRANSFER_TARGET_DID_E164`. Script reads everything from env — no inline edits required.

- [ ] **Step 42.2: Settings seed**

```ts
// scripts/seed-dialer-settings.ts
import './lib/load-env'
import { upsertDialerSettings } from '@/shared/entities/dialer-settings/dal/server/upsert-singleton'
import { DEFAULT_DIALER_SETTINGS_CONFIG } from '@/shared/entities/dialer-settings/schemas/config-schema'

const ADMIN_USER_ID = process.env.SEED_ADMIN_USER_ID  // set in .env.local to your user ID

async function main() {
  if (!ADMIN_USER_ID) {
    console.error('SEED_ADMIN_USER_ID env var required')
    process.exit(1)
  }
  console.log('Seeding dialer settings singleton…')
  await upsertDialerSettings(DEFAULT_DIALER_SETTINGS_CONFIG, ADMIN_USER_ID)
  console.log('Done.')
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 42.3: Lead source configuration script**

```ts
// scripts/configure-lead-source-dialer.ts
import './lib/load-env'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { leadSourcesTable } from '@/shared/db/schema'
import type { LeadSourceDialerConfig } from '@/shared/entities/lead-sources/schemas/dialer-config-schema'

// Edit these values before running.
const LEAD_SOURCE_SLUG = 'meta-roofing-ad'          // existing lead source slug
const CONFIG: LeadSourceDialerConfig = {
  enabled: true,
  retellAgentId: 'agent_xxxxxxxxxxxxxxxxxxxxxxxx', // from Retell dashboard
  trade: 'roofing',
  consentContext: 'Meta lead-ad opt-in',
  aiGreetingOverride: null,
  warmIntroTemplate: '{name} on the line — interested in {trade} in {city}',
  cadenceOverrides: null,
  messageTemplates: null,
}

async function main() {
  const [src] = await db.select().from(leadSourcesTable).where(eq(leadSourcesTable.slug, LEAD_SOURCE_SLUG)).limit(1)
  if (!src) { console.error(`Lead source slug '${LEAD_SOURCE_SLUG}' not found`); process.exit(1) }

  await db.update(leadSourcesTable)
    .set({ dialerConfigJSON: CONFIG })
    .where(eq(leadSourcesTable.id, src.id))

  console.log(`Configured lead source '${src.name}' (${src.id}) for dialer.`)
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 42.4: Run all three (with real values)**

```bash
pnpm tsx scripts/seed-dialer-dids.ts
pnpm tsx scripts/seed-dialer-settings.ts
pnpm tsx scripts/configure-lead-source-dialer.ts
```

Verify in DB: `dialer_dids` has 6 rows, `dialer_settings` has 1 row keyed `'singleton'`, `lead_sources.dialer_config_json` set on the configured source.

- [ ] **Step 42.5: Commit (scripts only — actual values stay in dev DB)**

```bash
pnpm tsc && pnpm lint
git add scripts/seed-dialer-dids.ts scripts/seed-dialer-settings.ts scripts/configure-lead-source-dialer.ts
git commit -m "chore(dialer): add seed scripts for DIDs + settings + lead source config

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 43: Configure Retell agent (manual — in Retell dashboard)

> No code commit. Document the manual setup for the executing developer.

- [ ] **Step 43.1: Create the Retell agent**

In the Retell dashboard:

1. Create a new agent. Give it a name like "Tri Pros — Roofing Lead Followup".
2. Set the system prompt — owner-managed; this is YOUR script. Include AI disclosure (per spec the system does not enforce, but you should script it).
3. Add dynamic variables: `{{lead_name}}`, `{{trade}}`, `{{consent_context}}`, `{{city}}`.
4. Configure mid-call custom functions:
   - **lead_context** — calls `${DIALER_WEBHOOK_BASE_URL}/api/dialer/ai/lead-context`
   - **route_transfer** — calls `${DIALER_WEBHOOK_BASE_URL}/api/dialer/ai/route-transfer`. Configure to use the response's `transfer_to` for warm transfer destination.
   - **log_disposition** — calls `${DIALER_WEBHOOK_BASE_URL}/api/dialer/ai/log-disposition`
5. Set the call-completed webhook URL: `${DIALER_WEBHOOK_BASE_URL}/api/dialer/ai/call-completed`
6. Enable voicemail detection. Configure a 12-second drop message (owner-scripted).
7. Save. Copy the agent ID.

- [ ] **Step 43.2: Update the lead source config**

Edit `scripts/configure-lead-source-dialer.ts`, paste the Retell agent ID into `CONFIG.retellAgentId`, re-run:

```bash
pnpm tsx scripts/configure-lead-source-dialer.ts
```

- [ ] **Step 43.3: Manual verify**

In Retell dashboard, use the test-call feature with sample dynamic variables to confirm the agent speaks correctly. (Already done in Phase 0 Task 2.3 if you preserved that setup.)

- [ ] **Step 43.4: Document the Retell config**

Optional: capture a screenshot or text dump of the agent's configuration and save to `docs/plans/auto-dialer/retell-agent-config-roofing.md` (not committed if it contains secrets — gitignore if needed).

---

### Task 44: End-to-end manual verification

> The Phase 1 acceptance test. Run all of these in sequence. Any failure = task incomplete; debug + retry.

- [ ] **Step 44.1: Pre-flight checks**

```bash
# Env vars set
echo "TWILIO_ACCOUNT_SID: ${TWILIO_ACCOUNT_SID:0:10}…"
echo "RETELL_API_KEY: ${RETELL_API_KEY:0:10}…"
echo "SENDBLUE_API_KEY_ID: ${SENDBLUE_API_KEY_ID:0:10}…"
echo "DIALER_DEV_OVERRIDE_NUMBER: $DIALER_DEV_OVERRIDE_NUMBER"  # should be YOUR cell

# DB has seeds
psql $DATABASE_DEV_URL -c "SELECT count(*) FROM dialer_dids;"  # expect 6
psql $DATABASE_DEV_URL -c "SELECT id FROM dialer_settings WHERE id='singleton';"  # expect 1 row

# Dev server runs
pnpm dev
# Open https://destined-emu-bold.ngrok-free.app/dashboard/auto-dialer (or your dev URL)
```

- [ ] **Step 44.2: Enroll yourself for transfers**

In dev DB, set your user as transfer-enrolled:

```sql
INSERT INTO dialer_user_availability (user_id, enrolled_for_transfers, manual_status, transfer_mode)
VALUES ('<your-user-id>', true, 'available', 'desktop')
ON CONFLICT (user_id) DO UPDATE SET
  enrolled_for_transfers = true,
  manual_status = 'available',
  transfer_mode = 'desktop',
  updated_at = NOW();
```

Reload dashboard. Confirm the softphone widget mounts (no errors in console; widget should be silent until a call arrives).

- [ ] **Step 44.3: Pick a test customer**

Pick (or create) a test customer in the dev DB whose `leadSourceId` references the dialer-enabled lead source from Task 42. Their `phone` will be overridden by `DIALER_DEV_OVERRIDE_NUMBER` so set any valid-looking value.

```sql
SELECT id, name, phone, lead_source_id FROM customers WHERE lead_source_id = '<your-configured-lead-source-id>' LIMIT 5;
```

Copy a customer UUID.

- [ ] **Step 44.4: Trigger the dial**

In the dashboard at `/dashboard/auto-dialer`, paste the customer UUID, click **Dial now (AI)**, click again to confirm.

**Expected within 5 seconds:** your test cell phone (the `DIALER_DEV_OVERRIDE_NUMBER`) rings.

- [ ] **Step 44.5: Take the AI call**

Answer. Hear the configured Retell agent's greeting. Confirm it has your test customer's name + trade interpolated.

Say "Yes, please transfer me to someone."

**Expected within ~3-5 seconds:** the AI says it's connecting you. The browser softphone widget in your dashboard shows the incoming-call banner with lead context.

- [ ] **Step 44.6: Accept transfer**

Click **Accept** in the browser widget.

**Expected:** audio bridges. You can hear yourself on both your cell (lead side) and your computer mic (human side).

Hang up either end.

**Expected:** disposition modal appears in the browser. Click "Booked meeting." Modal closes.

- [ ] **Step 44.7: Verify persistence**

```sql
SELECT id, status, disposition, transferred_to_user_id, recording_url FROM dialer_attempts ORDER BY initiated_at DESC LIMIT 1;
```

Expect:
- `status` = a terminal value (e.g., `live_transferred` or `no_answer` depending on flow)
- `disposition` = `booked_meeting`
- `transferred_to_user_id` = your user ID
- `recording_url` = a https://api.twilio.com/... URL (may take 30s after hangup to populate; refetch)

Open the recording URL in browser (you'll be prompted for Twilio auth — log in to Twilio Console to play).

- [ ] **Step 44.8: Verify messaging**

In the auto-dialer admin view, click **Send message** on the same customer. Send a test SMS body. Verify on your test phone.

Reply STOP from your test phone.

Verify in DB:

```sql
SELECT phone_e164, source FROM dialer_dnc ORDER BY added_at DESC LIMIT 5;
SELECT status FROM dialer_lead_states WHERE customer_id = '<test-customer-id>';
-- Should be 'opted_out'
```

Verify you received a confirmation SMS on your test phone.

- [ ] **Step 44.9: Verify iMessage delivery (if iPhone available)**

From the same Send Message dialog, send with channel = **Auto** to a contact you know is on iPhone.

Verify they receive a blue-bubble iMessage. Check `dialer_messages.channel` is `imessage`.

If you have access to an Android contact, send with channel **Auto**. Verify SMS fallback works and `channel='fallback_sms'`.

- [ ] **Step 44.10: Final Phase 1 acceptance check**

```bash
pnpm tsc  # clean
pnpm lint  # clean
```

If all 9 manual verifications above passed AND tsc/lint are clean → **Phase 1 is COMPLETE.**

Update [EPIC.md](./EPIC.md) phase status: Phase 1 → "Done." Begin writing the Phase 2 plan.

---

## Phase 1 → Phase 2 handoff

When Phase 1 completes:

1. Update `EPIC.md` decisions log if any mid-implementation choices were made (e.g., chosen Twilio Voice SDK wrapper, deviations from the plan).
2. Verify all `@migration: → Inngest` comments are in place by `grep -r "@migration:" src/`.
3. Write `phase-2-cadence-and-compliance.md` using this plan as the template + spec §9 Phase 2 as the scope source.

The system at end of Phase 1 supports **one button-press dial** and **manual messaging** end-to-end. Phase 2 automates this into a cadence-driven queue with all 10 lifecycle branches.
