# VoIP Campaigns — App-Orchestrated SMS Cadence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app sends up to 5 automated follow-up SMS per campaign lead, armed by dial-attempt thresholds and capped at one per day, driven by CloudTalk `call.ended` webhooks and delivered via `cloudtalkClient.sendSms`.

**Architecture:** CloudTalk is delivery-only (dials, emits `call.ended`, exposes `/sms/send`). The app owns all cadence state and logic: per-campaign config in a `voip_campaigns.sms_cadence` JSONB column, per-lead progress on `voip_campaign_contacts`, a pure decision function for "what (if anything) to send," and a service that composes DAL + decision + `sendSms`. Attempt counting is made exactly-once by folding dedup into the increment (atomic conditional UPDATE keyed on `last_call_uuid`).

**Tech Stack:** Next.js 15 route handler, Drizzle (Postgres/Neon), Zod, the existing `cloudtalkClient` provider wrapper.

**Design spec:** [../specs/2026-06-17-voip-campaigns-sms-cadence-design.md](../specs/2026-06-17-voip-campaigns-sms-cadence-design.md)

## Global Constraints

- **No unit tests** — repo has no test runner. Verify every task with `pnpm tsc` (type-check) + `pnpm lint`. The final task verifies end-to-end with a manual `call.ended` webhook replay.
- **DB pushes:** `pnpm db:push:dev` ONLY. NEVER `pnpm db:push` (prod). NEVER `pnpm build`.
- **Layering:** route handler → service → DAL → DB. Services never call `db.*` directly; mutations live in `entities/*/dal/server/mutations.ts`. `cloudtalkClient.sendSms` must be called from a `services/voip/campaigns/*` service, never the route handler (per the client's own doc-comment).
- **JSONB is typed** — never `Record<string, unknown>`; Zod schema in `entities/<domain>/schemas/`.
- **No `updatedAt` in `.set()`** — schema-helpers' `updatedAt` has `.$onUpdate(...)`.
- **Named exports only. One component/concern per file. No barrels in `lib/`/`dal/`.**
- **Timezone for "same day":** `America/Los_Angeles` (all leads are SoCal — design §7).
- **Cap defaults:** `maxMessages` default `5`; `oneSmsPerDay` default `true`. `afterAttempts` minimum `1` (no enrollment-time opener).

---

### Task 1: DB schema — config column, per-lead state columns, Zod schema

**Files:**
- Create: `src/shared/entities/voip-campaigns/schemas/sms-cadence.ts`
- Modify: `src/shared/entities/voip-campaigns/schemas/index.ts`
- Modify: `src/shared/db/schema/voip-campaigns.ts`
- Modify: `src/shared/db/schema/voip-campaign-contacts.ts`

**Interfaces:**
- Produces: `smsCadenceSchema`, `type SmsCadence`, `type SmsCadenceMessage`; `voipCampaigns.smsCadence` column (`SmsCadence | null`); `voipCampaignContacts.{lastCallUuid, autoSmsSentCount, lastAutoSmsAt}` columns.

- [ ] **Step 1: Write the SMS cadence Zod schema**

Create `src/shared/entities/voip-campaigns/schemas/sms-cadence.ts`:

```ts
import { z } from 'zod'

// Per-campaign automated-SMS cadence config. Stored as a typed JSONB column on
// voip_campaigns (app-authored; never CT-mirrored). Each message is armed by a
// dial-attempt threshold; the orchestrator advances the ladder one step at a
// time, gated by maxMessages + oneSmsPerDay.
// see docs/superpowers/specs/2026-06-17-voip-campaigns-sms-cadence-design.md

export const smsCadenceMessageSchema = z.object({
  // Dial-attempt count at/after which this message is eligible. Minimum 1 — the
  // opener arms after the first dial (no enrollment-time send; the from-DID is
  // read off the call.ended event).
  afterAttempts: z.number().int().min(1),
  // SMS body. Supports {{first_name}}, {{city}}, {{primary_trade}} merge tokens.
  body: z.string().min(1),
})

export type SmsCadenceMessage = z.infer<typeof smsCadenceMessageSchema>

export const smsCadenceSchema = z.object({
  enabled: z.boolean().default(false),
  maxMessages: z.number().int().positive().default(5),
  oneSmsPerDay: z.boolean().default(true),
  messages: z.array(smsCadenceMessageSchema).max(5).default([]),
})

export type SmsCadence = z.infer<typeof smsCadenceSchema>
```

- [ ] **Step 2: Re-export from the schemas barrel-entry**

Modify `src/shared/entities/voip-campaigns/schemas/index.ts` — append:

```ts
export {
  type SmsCadence,
  type SmsCadenceMessage,
  smsCadenceMessageSchema,
  smsCadenceSchema,
} from './sms-cadence'
```

- [ ] **Step 3: Add the `sms_cadence` column to `voip_campaigns`**

Modify `src/shared/db/schema/voip-campaigns.ts`. Add `jsonb` to the drizzle import, add a type-only import, and add the column after `hoursBetweenAttempts`:

```ts
import type { SmsCadence } from '@/shared/entities/voip-campaigns/schemas/sms-cadence'
import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
```

```ts
    hoursBetweenAttempts: integer('hours_between_attempts').notNull().default(3),
    // App-authored SMS cadence config (NOT CT-mirrored). Resync-safe:
    // upsertCampaignByCtId never writes this column. Shape = smsCadenceSchema.
    smsCadence: jsonb('sms_cadence').$type<SmsCadence>(),
    lastSyncedAt: timestamp('last_synced_at', { mode: 'string', withTimezone: true })
      .defaultNow()
      .notNull(),
```

(`import type` is erased at runtime, so this does not create an import cycle with the schemas barrel.)

- [ ] **Step 4: Add the per-lead progress columns to `voip_campaign_contacts`**

Modify `src/shared/db/schema/voip-campaign-contacts.ts`. Replace the existing `dialAttempts` line with the clustered block:

```ts
    // ── Current-enrollment progress (all reset on re-enrollment) ──────────────
    // Dial-attempt counter — app-side cadence_exhausted at attempts_per_contact.
    dialAttempts: integer('dial_attempts').notNull().default(0),
    // call_uuid of the most recent counted call.ended. Powers exactly-once
    // attempt dedup (atomic conditional UPDATE). Null until first counted call.
    lastCallUuid: text('last_call_uuid'),
    // Auto-SMS cadence progress — also the next message index (strict ladder).
    autoSmsSentCount: integer('auto_sms_sent_count').notNull().default(0),
    // Timestamp of the last auto-SMS — drives the ≤1/day gate.
    lastAutoSmsAt: timestamp('last_auto_sms_at', { mode: 'string', withTimezone: true }),
```

- [ ] **Step 5: Push schema to dev DB**

Run: `pnpm db:push:dev`
Expected: prompts apply cleanly; the three new columns + `sms_cadence` are created. (NEVER `pnpm db:push`.)

- [ ] **Step 6: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/shared/entities/voip-campaigns/schemas/sms-cadence.ts \
        src/shared/entities/voip-campaigns/schemas/index.ts \
        src/shared/db/schema/voip-campaigns.ts \
        src/shared/db/schema/voip-campaign-contacts.ts
git commit -m "feat(voip): sms cadence config column + per-lead cadence state"
```

---

### Task 2: `call.ended` webhook event schema

**Files:**
- Modify: `src/shared/services/providers/cloudtalk/webhooks/events.ts`

**Interfaces:**
- Produces: `cloudtalkCallEndedSchema` now carries `internal_number_e164?: string`; `is_voicemail`/`duration_sec`/`recording_url` are optional; `call.started`'s `did_e164` is renamed `internal_number_e164`.

- [ ] **Step 1: Add `internal_number_e164` + relax unused fields on `call.ended`**

In `src/shared/services/providers/cloudtalk/webhooks/events.ts`, edit `cloudtalkCallEndedSchema` so `is_voicemail` becomes optional and the DID field is added:

```ts
export const cloudtalkCallEndedSchema = z.object({
  event_type: z.literal('call.ended'),
  call_uuid: z.string(),
  ended_at: ctTimestampSchema,
  duration_sec: z.coerce.number().int().optional(),
  direction: ctDirectionSchema.optional(),
  // Relaxed to optional (2026-06-17): unused by v1 SMS cadence; a missing value
  // must not 400 the whole event. Future voicemail handling will tighten this.
  is_voicemail: ctBooleanSchema.optional(),
  // Our campaign DID for this call — the SMS `from`. Mapped from CT's
  // event.properties.internal_number. Optional: inbound/manual calls may omit it.
  internal_number_e164: e164Schema.optional(),
  contact_id: ctContactIdSchema,
  contact_name: ctContactNameSchema,
  recording_url: z.string().nullable().optional(),
})
```

- [ ] **Step 2: Unify the DID field name on `call.started`**

In the same file, rename `did_e164` → `internal_number_e164` on `cloudtalkCallStartedSchema` (keep the existing mapping comment):

```ts
  caller_e164: e164Schema, // mapped from event.properties.external_number
  internal_number_e164: e164Schema.optional(), // mapped from event.properties.internal_number
```

- [ ] **Step 3: Find and fix any `did_e164` references**

Run: `grep -rn "did_e164" src/`
Expected: only the line you just changed (now `internal_number_e164`). If any consumer references `did_e164`, update it to `internal_number_e164`.

- [ ] **Step 4: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/providers/cloudtalk/webhooks/events.ts
git commit -m "feat(voip): carry internal_number_e164 on call events; relax unused call.ended fields"
```

---

### Task 3: DAL — cadence context read + atomic dedup increment + sms-sent recorder

**Files:**
- Modify: `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts`
- Modify: `src/shared/entities/voip-campaign-contacts/dal/server/mutations.ts`

**Interfaces:**
- Consumes: `dalDbOperation` from `@/shared/dal/server/lib/helpers`; `DalReturn` from `@/shared/dal/server/types`; `db`, `voipCampaignContacts`, `voipCampaigns`, `customers` schema tables.
- Produces:
  - `findSmsCadenceContextByCtContactId(ctContactId: string): Promise<DalReturn<SmsCadenceContext | null>>`
  - `claimAndIncrementDialAttempt(customerId: string, callUuid: string): Promise<DalReturn<{ dialAttempts: number } | null>>` — `null` when the call was already counted (dedup).
  - `recordAutoSmsSent(customerId: string): Promise<DalReturn<void>>`

- [ ] **Step 1: Add the cadence-context query**

In `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts`, add (mirror the existing `findActiveEnrollment` join style; check the top-of-file imports already include `db`, `and`, `eq`, `isNull`, `voipCampaignContacts`, `voipCampaigns` — add `customers` and the `SmsCadence`/`LeadMeta` types if missing):

```ts
import type { SmsCadence } from '@/shared/entities/voip-campaigns/schemas/sms-cadence'
import { customers } from '@/shared/db/schema/customers'

export interface SmsCadenceContext {
  customerId: string
  unenrolledAt: string | null
  dialAttempts: number
  autoSmsSentCount: number
  lastAutoSmsAt: string | null
  // Customer fields for merge-field rendering + the SMS recipient.
  customerName: string
  customerPhone: string | null
  customerCity: string
  interestedTradesRaw: string[]
  // Campaign cadence config (null when no campaign / unconfigured).
  smsCadence: SmsCadence | null
}

/**
 * One-shot read of everything the SMS-cadence orchestrator needs, keyed on the
 * CloudTalk contact id carried by a call.ended event. Returns null when no
 * participation row carries that CT contact id.
 */
export async function findSmsCadenceContextByCtContactId(
  ctContactId: string,
): Promise<DalReturn<SmsCadenceContext | null>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select({
        customerId: voipCampaignContacts.customerId,
        unenrolledAt: voipCampaignContacts.unenrolledAt,
        dialAttempts: voipCampaignContacts.dialAttempts,
        autoSmsSentCount: voipCampaignContacts.autoSmsSentCount,
        lastAutoSmsAt: voipCampaignContacts.lastAutoSmsAt,
        customerName: customers.name,
        customerPhone: customers.phone,
        customerCity: customers.city,
        leadMetaJSON: customers.leadMetaJSON,
        smsCadence: voipCampaigns.smsCadence,
      })
      .from(voipCampaignContacts)
      .innerJoin(customers, eq(voipCampaignContacts.customerId, customers.id))
      .leftJoin(voipCampaigns, eq(voipCampaignContacts.voipCampaignId, voipCampaigns.id))
      .where(eq(voipCampaignContacts.cloudtalkContactId, ctContactId))
      .limit(1)

    if (!row) {
      return null
    }
    return {
      customerId: row.customerId,
      unenrolledAt: row.unenrolledAt,
      dialAttempts: row.dialAttempts,
      autoSmsSentCount: row.autoSmsSentCount,
      lastAutoSmsAt: row.lastAutoSmsAt,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      customerCity: row.customerCity,
      interestedTradesRaw: row.leadMetaJSON?.interestedTradesRaw ?? [],
      smsCadence: row.smsCadence ?? null,
    }
  })
}
```

- [ ] **Step 2: Add the atomic dedup-increment mutation**

In `src/shared/entities/voip-campaign-contacts/dal/server/mutations.ts` (top-of-file already imports `db`, `dalDbOperation`, `and`, `eq`, `voipCampaignContacts`; add `sql` from `drizzle-orm`):

```ts
/**
 * Exactly-once dial-attempt counting. The dedup IS the increment: a single
 * atomic conditional UPDATE that only fires when this call_uuid differs from
 * the last counted one. Returns the new dial_attempts on a first sighting, or
 * null on a redelivery (row unchanged). See design §8.1.
 */
export async function claimAndIncrementDialAttempt(
  customerId: string,
  callUuid: string,
): Promise<DalReturn<{ dialAttempts: number } | null>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .update(voipCampaignContacts)
      .set({
        dialAttempts: sql`${voipCampaignContacts.dialAttempts} + 1`,
        lastCallUuid: callUuid,
      })
      .where(and(
        eq(voipCampaignContacts.customerId, customerId),
        sql`${voipCampaignContacts.lastCallUuid} IS DISTINCT FROM ${callUuid}`,
      ))
      .returning({ dialAttempts: voipCampaignContacts.dialAttempts })

    return row ? { dialAttempts: row.dialAttempts } : null
  })
}
```

- [ ] **Step 3: Add the sms-sent recorder mutation**

Append to the same mutations file:

```ts
/**
 * Record a successful auto-SMS: advance the ladder index + stamp the day for
 * the ≤1/day gate. Called only after cloudtalkClient.sendSms succeeds.
 */
export async function recordAutoSmsSent(customerId: string): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    await db
      .update(voipCampaignContacts)
      .set({
        autoSmsSentCount: sql`${voipCampaignContacts.autoSmsSentCount} + 1`,
        lastAutoSmsAt: new Date().toISOString(),
      })
      .where(eq(voipCampaignContacts.customerId, customerId))
  })
}
```

- [ ] **Step 4: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors. (If `lint` flags import sort order, apply the suggested order.)

- [ ] **Step 5: Commit**

```bash
git add src/shared/entities/voip-campaign-contacts/dal/server/queries.ts \
        src/shared/entities/voip-campaign-contacts/dal/server/mutations.ts
git commit -m "feat(voip): cadence-context read + atomic dedup increment + sms-sent recorder"
```

---

### Task 4: Pure lib helpers — primary trade, template render, cadence decision

**Files:**
- Create: `src/shared/services/voip/campaigns/lib/pick-primary-trade.ts`
- Modify: `src/shared/services/voip/campaigns/lib/build-contact-attributes.ts`
- Create: `src/shared/services/voip/campaigns/lib/render-sms-template.ts`
- Create: `src/shared/services/voip/campaigns/lib/decide-cadence-sms.ts`

**Interfaces:**
- Produces:
  - `pickPrimaryTrade(interestedTradesRaw?: string[]): string`
  - `renderSmsTemplate(body: string, vars: { name: string, city: string, interestedTradesRaw: string[] }): string`
  - `decideCadenceSms(input: DecideCadenceSmsInput): { send: true, message: SmsCadenceMessage } | { send: false }`

- [ ] **Step 1: Extract the primary-trade rule (DRY with build-contact-attributes)**

Create `src/shared/services/voip/campaigns/lib/pick-primary-trade.ts`:

```ts
// Pure rule: the lead's primary (first) interested trade, trimmed/deduped.
// Shared by CT attribute building and SMS {{primary_trade}} rendering. No I/O.

export function pickPrimaryTrade(interestedTradesRaw?: string[]): string {
  const trades = (interestedTradesRaw ?? []).map(t => t.trim()).filter(Boolean)
  return trades[0] ?? ''
}
```

- [ ] **Step 2: Refactor build-contact-attributes to use it**

In `src/shared/services/voip/campaigns/lib/build-contact-attributes.ts`, import and reuse the helper so the rule lives in one place:

```ts
import { pickPrimaryTrade } from './pick-primary-trade'
```

Then within `buildContactAttributes`, replace the `primary_trade` value:

```ts
    primary_trade: pickPrimaryTrade(input.interestedTradesRaw),
```

(Leave the `sortedTrades`/`trades_interested` logic as-is.)

- [ ] **Step 3: Create the merge-field renderer**

Create `src/shared/services/voip/campaigns/lib/render-sms-template.ts`:

```ts
import { pickPrimaryTrade } from './pick-primary-trade'

// Pure {{token}} substitution for campaign SMS bodies. Renders in-app because
// CloudTalk's /sms/send takes a literal body (no contact merge). Supported
// tokens: {{first_name}}, {{city}}, {{primary_trade}}. Unknown tokens are left
// untouched. No I/O.

interface RenderSmsTemplateVars {
  name: string
  city: string
  interestedTradesRaw: string[]
}

export function renderSmsTemplate(body: string, vars: RenderSmsTemplateVars): string {
  const firstName = vars.name.trim().split(/\s+/)[0] ?? ''
  const replacements: Record<string, string> = {
    first_name: firstName,
    city: vars.city,
    primary_trade: pickPrimaryTrade(vars.interestedTradesRaw),
  }
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in replacements ? replacements[key]! : match)
}
```

- [ ] **Step 4: Create the cadence decision function**

Create `src/shared/services/voip/campaigns/lib/decide-cadence-sms.ts`:

```ts
import type { SmsCadence, SmsCadenceMessage } from '@/shared/entities/voip-campaigns/schemas/sms-cadence'

// Pure decision (no I/O): given the campaign cadence + this lead's progress
// after a counted dial, return the message to send now, or "don't send".
// Gates: enabled, < maxMessages, next message exists, attempt threshold met,
// and (if oneSmsPerDay) nothing already sent today in the lead-local tz.
// see docs/superpowers/specs/2026-06-17-voip-campaigns-sms-cadence-design.md §6

const CADENCE_TZ = 'America/Los_Angeles'

export interface DecideCadenceSmsInput {
  cadence: SmsCadence | null
  dialAttempts: number
  autoSmsSentCount: number
  lastAutoSmsAt: string | null
  now: Date
}

export type DecideCadenceSmsResult =
  | { send: true, message: SmsCadenceMessage }
  | { send: false }

function localDay(date: Date): string {
  // en-CA → YYYY-MM-DD; tz-pinned so "today" means the lead's SoCal calendar day.
  return date.toLocaleDateString('en-CA', { timeZone: CADENCE_TZ })
}

export function decideCadenceSms(input: DecideCadenceSmsInput): DecideCadenceSmsResult {
  const { cadence, dialAttempts, autoSmsSentCount, lastAutoSmsAt, now } = input

  if (!cadence || !cadence.enabled) {
    return { send: false }
  }
  if (autoSmsSentCount >= cadence.maxMessages) {
    return { send: false }
  }
  const message = cadence.messages[autoSmsSentCount]
  if (!message) {
    return { send: false }
  }
  if (dialAttempts < message.afterAttempts) {
    return { send: false }
  }
  if (cadence.oneSmsPerDay && lastAutoSmsAt && localDay(new Date(lastAutoSmsAt)) === localDay(now)) {
    return { send: false }
  }
  return { send: true, message }
}
```

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/services/voip/campaigns/lib/pick-primary-trade.ts \
        src/shared/services/voip/campaigns/lib/build-contact-attributes.ts \
        src/shared/services/voip/campaigns/lib/render-sms-template.ts \
        src/shared/services/voip/campaigns/lib/decide-cadence-sms.ts
git commit -m "feat(voip): pure cadence helpers — primary trade, template render, decision"
```

---

### Task 5: Orchestrator service

**Files:**
- Create: `src/shared/services/voip/campaigns/sms-cadence.service.ts`

**Interfaces:**
- Consumes: `findSmsCadenceContextByCtContactId`, `claimAndIncrementDialAttempt`, `recordAutoSmsSent` (Task 3); `decideCadenceSms`, `renderSmsTemplate` (Task 4); `cloudtalkClient.sendSms({ fromE164, toE164, text })`; `CloudtalkCallEndedEvent` (Task 2).
- Produces: `smsCadenceService.handleCallEnded(event: CloudtalkCallEndedEvent): Promise<void>`.

- [ ] **Step 1: Write the service**

Create `src/shared/services/voip/campaigns/sms-cadence.service.ts`:

```ts
import type { CloudtalkCallEndedEvent } from '@/shared/services/providers/cloudtalk/webhooks/events'
import {
  findSmsCadenceContextByCtContactId,
} from '@/shared/entities/voip-campaign-contacts/dal/server/queries'
import {
  claimAndIncrementDialAttempt,
  recordAutoSmsSent,
} from '@/shared/entities/voip-campaign-contacts/dal/server/mutations'
import { cloudtalkClient } from '@/shared/services/providers/cloudtalk/client'
import { decideCadenceSms } from './lib/decide-cadence-sms'
import { renderSmsTemplate } from './lib/render-sms-template'

// Orchestrates the per-lead automated SMS cadence off call.ended events.
// CloudTalk delivers; this service decides + sends. All cadence state lives in
// voip_campaign_contacts; per-campaign config in voip_campaigns.sms_cadence.
// see docs/superpowers/specs/2026-06-17-voip-campaigns-sms-cadence-design.md

function createSmsCadenceService() {
  return {
    /**
     * Handle one outbound call.ended: count the dial (exactly-once), then send
     * the next due cadence SMS if the gates pass. Throws nothing the caller must
     * handle — the webhook route is 200-on-error; failures are logged.
     */
    async handleCallEnded(event: CloudtalkCallEndedEvent): Promise<void> {
      // Only outbound dials drive the cadence (inbound callbacks don't count).
      if (event.direction && event.direction !== 'outbound') {
        return
      }
      const ctContactId = event.contact_id
      if (!ctContactId) {
        return // unresolvable contact → safe no-op
      }

      const ctxResult = await findSmsCadenceContextByCtContactId(ctContactId)
      if (!ctxResult.success || !ctxResult.data) {
        return
      }
      const ctx = ctxResult.data

      // Gate: actively enrolled, has a phone, has a cadence config.
      if (ctx.unenrolledAt !== null || !ctx.customerPhone || !ctx.smsCadence) {
        return
      }

      // Exactly-once attempt counting (dedup folded into the increment).
      const claim = await claimAndIncrementDialAttempt(ctx.customerId, event.call_uuid)
      if (!claim.success || claim.data === null) {
        return // redelivery already counted → stop
      }
      const dialAttempts = claim.data.dialAttempts

      const decision = decideCadenceSms({
        cadence: ctx.smsCadence,
        dialAttempts,
        autoSmsSentCount: ctx.autoSmsSentCount,
        lastAutoSmsAt: ctx.lastAutoSmsAt,
        now: new Date(),
      })
      if (!decision.send) {
        return
      }

      const text = renderSmsTemplate(decision.message.body, {
        name: ctx.customerName,
        city: ctx.customerCity,
        interestedTradesRaw: ctx.interestedTradesRaw,
      })

      // from = the DID CloudTalk dialed from (so the SMS matches the call number).
      const fromE164 = event.internal_number_e164
      if (!fromE164) {
        console.warn('[sms-cadence] no internal_number_e164 on call.ended — skipping send', {
          callUuid: event.call_uuid,
        })
        return
      }

      const sent = await cloudtalkClient.sendSms({
        fromE164,
        toE164: ctx.customerPhone,
        text,
      })
      // Advance the ladder only on a successful send — a failed send leaves the
      // slot due, retried by the next (non-deduped) call.ended.
      if (sent.success) {
        await recordAutoSmsSent(ctx.customerId)
      }
      else {
        console.error('[sms-cadence] sendSms reported failure', { callUuid: event.call_uuid })
      }
    },
  }
}

export const smsCadenceService = createSmsCadenceService()
```

- [ ] **Step 2: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/voip/campaigns/sms-cadence.service.ts
git commit -m "feat(voip): sms cadence orchestrator service"
```

---

### Task 6: Wire the route handler + manual end-to-end replay

**Files:**
- Modify: `src/app/api/webhooks/cloudtalk/route.ts`

**Interfaces:**
- Consumes: `smsCadenceService.handleCallEnded` (Task 5).

- [ ] **Step 1: Add the `call.ended` case to the dispatch switch**

In `src/app/api/webhooks/cloudtalk/route.ts`, add the import and a `case 'call.ended'` arm before `default:`. The `default:` no-op stays for `call.started`/`call.answered`.

```ts
import { smsCadenceService } from '@/shared/services/voip/campaigns/sms-cadence.service'
```

```ts
      // Outbound dials drive the automated SMS cadence (count attempt + maybe
      // send next message). Idempotent; failures logged, 200 returned.
      case 'call.ended': {
        await smsCadenceService.handleCallEnded(event)
        break
      }

      // Deferred to ring 2 — no-op (handler stays stable for expansion):
      // call.started, call.answered, voicemail.
      default:
        break
```

Also update the top-of-file comment block: `call.ended` is no longer in the "deferred / no-op" list — it now drives the SMS cadence.

- [ ] **Step 2: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Manual end-to-end replay**

Start the dev server (`pnpm dev`) in one terminal. Read the webhook secret:

Run: `grep CLOUDTALK_WEBHOOK_SECRET .env.local .env 2>/dev/null | head -1`

Pick an **actively enrolled** test contact and its `cloudtalk_contact_id`:

Run:
```bash
psql "$DATABASE_DEV_URL" -c "select cloudtalk_contact_id, customer_id, dial_attempts, auto_sms_sent_count from voip_campaign_contacts where unenrolled_at is null limit 5;"
```

Give that contact's campaign a cadence config (so `enabled` + a message armed at `afterAttempts: 1`):
```bash
psql "$DATABASE_DEV_URL" -c $'update voip_campaigns set sms_cadence = \'{"enabled":true,"maxMessages":5,"oneSmsPerDay":true,"messages":[{"afterAttempts":1,"body":"Hi {{first_name}}, following up on your {{primary_trade}} inquiry in {{city}}."}]}\' where id = (select voip_campaign_id from voip_campaign_contacts where cloudtalk_contact_id = \'<CT_CONTACT_ID>\');'
```

Replay a `call.ended` (swap `<SECRET>` and `<CT_CONTACT_ID>`; `internal_number_e164` is any SMS-capable campaign DID):
```bash
curl -i -X POST "http://localhost:3000/api/webhooks/cloudtalk?secret=<SECRET>" \
  -H 'Content-Type: application/json' \
  -d '{"event_type":"call.ended","call_uuid":"test-uuid-001","ended_at":"2026-06-17T20:00:00Z","direction":"outgoing","internal_number_e164":"+13105550123","contact_id":"<CT_CONTACT_ID>","is_voicemail":false}'
```

Expected:
- HTTP `200 {"ok":true}`.
- `dial_attempts` incremented by 1; `auto_sms_sent_count` = 1; `last_auto_sms_at` set:
  ```bash
  psql "$DATABASE_DEV_URL" -c "select dial_attempts, auto_sms_sent_count, last_auto_sms_at, last_call_uuid from voip_campaign_contacts where cloudtalk_contact_id = '<CT_CONTACT_ID>';"
  ```
- Server logs show the `sendSms` call (it may report carrier failure if A2P 10DLC isn't registered yet — that is expected; the attempt count still increments and `auto_sms_sent_count` stays 0 on a failed send).

- [ ] **Step 4: Verify dedup — replay the SAME payload again**

Re-run the identical `curl` from Step 3 (same `call_uuid: "test-uuid-001"`).
Expected: still `200`, but `dial_attempts` is **unchanged** (dedup) and no second SMS attempt in the logs.

- [ ] **Step 5: Verify ≤1/day — replay with a NEW call_uuid same day**

Re-run the `curl` with `"call_uuid":"test-uuid-002"`.
Expected: `dial_attempts` increments to 2, but `auto_sms_sent_count` stays 1 and no SMS sent (blocked by `oneSmsPerDay`, since `last_auto_sms_at` is today). Confirms the daily gate.

- [ ] **Step 6: Reset test state + commit**

```bash
psql "$DATABASE_DEV_URL" -c "update voip_campaign_contacts set dial_attempts=0, last_call_uuid=null, auto_sms_sent_count=0, last_auto_sms_at=null where cloudtalk_contact_id='<CT_CONTACT_ID>';"
git add src/app/api/webhooks/cloudtalk/route.ts
git commit -m "feat(voip): drive sms cadence from call.ended webhook"
```

---

### Task 7: Documentation

**Files:**
- Modify: `src/shared/entities/voip-campaigns/DOCS.md`
- Modify: `src/shared/entities/voip-campaign-contacts/DOCS.md`

- [ ] **Step 1: Document the cadence config on voip-campaigns**

Append a section to `src/shared/entities/voip-campaigns/DOCS.md` describing the `sms_cadence` JSONB column: app-authored (resync-safe), shape = `smsCadenceSchema`, `afterAttempts`-armed message ladder, `maxMessages`/`oneSmsPerDay` caps. Link the design spec.

- [ ] **Step 2: Document the cadence state on voip-campaign-contacts**

Append a section to `src/shared/entities/voip-campaign-contacts/DOCS.md` describing `dial_attempts` exactly-once counting (the `last_call_uuid` dedup), `auto_sms_sent_count` (= next ladder index), and `last_auto_sms_at` (≤1/day gate). Note all reset on re-enrollment.

- [ ] **Step 3: Lint + commit**

Run: `pnpm lint`
```bash
git add src/shared/entities/voip-campaigns/DOCS.md src/shared/entities/voip-campaign-contacts/DOCS.md
git commit -m "docs(voip): document sms cadence config + per-lead cadence state"
```

---

## Self-Review notes

- **Spec coverage:** config JSONB (Task 1) ✓ · per-lead state + dedup column (Task 1) ✓ · `internal_number_e164` + relaxed fields + rename (Task 2) ✓ · exactly-once increment §8.1 (Task 3) ✓ · pure decision + merge render §6 (Task 4) ✓ · orchestrator + sendSms (Task 5) ✓ · route wiring (Task 6) ✓ · A2P 10DLC dependency surfaced (Task 6 Step 3) ✓.
- **Deferred per spec §7 (NOT in this plan):** dispositions/confirmations, voicemail/recording/duration handling, enrollment-time opener, admin config UI, per-zip timezone.
- **Type consistency:** `SmsCadence`/`SmsCadenceMessage` (Task 1) used in Tasks 3–5; `findSmsCadenceContextByCtContactId`/`claimAndIncrementDialAttempt`/`recordAutoSmsSent` defined in Task 3, consumed in Task 5; `decideCadenceSms`/`renderSmsTemplate`/`pickPrimaryTrade` defined in Task 4, consumed in Task 5; `smsCadenceService.handleCallEnded` defined in Task 5, consumed in Task 6.
