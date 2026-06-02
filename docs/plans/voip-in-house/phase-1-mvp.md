# Phase 1 — MVP In-house Twilio VoIP Foundation

> **Parent EPIC:** [EPIC.md](./EPIC.md)
> **Sibling EPIC:** [voip-campaigns](../voip-campaigns/EPIC.md) — ships **after** this EPIC because CloudTalk depends on the in-house DNC propagation + voip routing endpoints existing.
> **Cross-system contract:** [../voip/INTEGRATION-SEAM.md](../voip/INTEGRATION-SEAM.md) — load-bearing for anything that touches voip routing endpoints, DNC propagation, or webhook routes.
> **Prerequisite:** [Phase 0](./phase-0-setup.md) gate satisfied (Twilio + Trust Hub + DIDs + webhook subdomain). 10DLC Campaign vetting and FCC DNC SAN issuance still in background — they gate specific tasks (Task 25, Task 14) but don't block the start of Phase 1.
> **Status:** In progress. Tasks 0-3 committed. Tasks 2-10 schema content **superseded by GRILL RESULTS 2026-05-30 below** (separation cleanup).

---

## ⚠️ GRILL RESULTS — 2026-05-30 (READ BEFORE IMPLEMENTING ANY SCHEMA TASK)

A mid-Phase 1 `grill-with-docs` session against the original task plan revealed that the schema baked in cross-EPIC fusion (a `source: 'in_house' | 'cloudtalk'` discriminator + forward-compat `cloudtalk_*` columns + a shared `voip_dnc` table). This contradicts the 2026-05-23 total-separation stance. The grill cut the plan down significantly.

**Canonical decisions are in [EPIC.md decisions log 2026-05-30](./EPIC.md#decisions-log-post-spec-made-during-implementation) and [CONTEXT.md](../../../CONTEXT.md).**

### Summary

| Was | Now |
|---|---|
| 7 new tables | **5 new tables** |
| 11 voip enums | **4 voip enums** |
| Shared tables with `source` discriminator | Total separation; each EPIC owns its own schema |
| Forward-compat `cloudtalk_*` cols on in-house tables | Removed; voip-campaigns owns its own tables for any CT mirroring |
| `voip_dnc` table | **DELETED.** DNC = 3 fields on `customers` |
| `voip_user_availability` table | **DELETED.** Softphone tracks its own connection state in-browser |
| `voipCallDispositionEnum` (8 lead-conversion values) | **DROPPED.** voip-in-house is post-conversion comms; no disposition vocabulary |
| `twilio_call_sid`, `twilio_message_sid`, `twilio_phone_sid` | Vendor-neutral: `provider_call_id`, `provider_message_id`, `provider_did_id` |
| `voipMessageDirections` enum | Renamed to `voipDirections` (applies to calls AND messages) |
| `voipLinkTokenTypes` | Narrowed to `['l_doc']` only |
| ~~`agentUserId: text(...)references(user.id)`~~ ⚠️ **GRILL ERROR — REVERSED 2026-06-02** | The grill mis-identified this as a bug (claimed `user.id` was `uuid`). It is NOT — `user.id` is `text` (better-auth string IDs). The "fix" to `uuid` broke `db:push:dev` with `incompatible types: uuid and text`. **Correct rule: any FK to `user.id` MUST be `text`.** All voip-in-house schemas reverted to `text` for user FKs. |

### Surviving enums (Phase 1)

1. `voipCallStatuses` — unchanged
2. `voipDirections` — renamed from `voipMessageDirections` (PG type `voip_direction`)
3. `voipMessageStatuses` — unchanged
4. `voipLinkTokenTypes` — narrowed to `['l_doc']`

### Surviving tables (Phase 1)

1. **`voip_dids`** — 7 cols + partial unique index
2. **`voip_calls`** — 12 cols + 4 indexes
3. **`voip_messages`** — 11 cols + 4 indexes (composite thread key `(voipDidId, remoteE164)`)
4. **`voip_link_tokens`** — 9 cols + 3 indexes
5. **`app_settings`** — 4 cols

### Decoration patches (additive to existing tables)

- **`customers`** +3 nullable DNC fields: `dncOptedOutAt`, `dncReason`, `dncAddedByUserId`. DNC is a customer-row decoration, NOT its own table.
- **`lead_sources.voipConfigJSON`** — still happens (Task 11); the `inHouse` sub-object lands here.

### Canonical table shapes

#### `voip_dids` ([src/shared/db/schema/voip-dids.ts](../../../src/shared/db/schema/voip-dids.ts))

```ts
import { sql } from 'drizzle-orm'
import { boolean, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'

export const voipDids = pgTable('voip_dids', {
  id,
  e164: text('e164').notNull().unique(),
  // Provider-neutral opaque ID (Twilio Phone SID today).
  providerDidId: text('provider_did_id').notNull().unique(),
  // CNAM display name shown to recipients. Provider dashboard is source of truth; mirrored for queryability.
  cnamDisplayName: text('cnam_display_name'),
  // Freeform internal label — "424 marketing", "Oliver's line", "main reception". Not an enum.
  label: text('label'),
  // Sticky outbound owner. NULL = shared / inbound-only (e.g., main reception fanned out by provider call flow).
  assignedUserId: text('assigned_user_id').references(() => user.id, { onDelete: 'set null' }),
  // User's primary outbound DID. At most one TRUE per assignedUserId (partial unique index below).
  // App logic auto-sets TRUE for the first DID assigned to a user; subsequent default FALSE.
  isPrimary: boolean('is_primary').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt,
  updatedAt,
}, table => ({
  uniqPrimaryPerUser: uniqueIndex('voip_dids_assigned_user_primary_uniq')
    .on(table.assignedUserId)
    .where(sql`${table.isPrimary} = TRUE`),
}))
```

Service surface (in `src/shared/services/voip/voip-dids.service.ts`):
- `assignDidToUser({ didId, userId })` — sets `is_primary=TRUE` if user has no other assigned DIDs; FALSE otherwise.
- `markPrimary({ didId })` — transactional flip (all user's other DIDs `is_primary=FALSE`, this one TRUE).
- `unassign({ didId })` — `assigned_user_id=NULL, is_primary=FALSE`.
- `getStickyDidForUser(userId)` — `SELECT ... WHERE assigned_user_id = $userId AND is_active AND is_primary LIMIT 1`.

#### `voip_calls` ([src/shared/db/schema/voip-calls.ts](../../../src/shared/db/schema/voip-calls.ts))

```ts
import type z from 'zod'
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'
import { voipCallStatusEnum, voipDirectionEnum } from './meta'
import { voipDids } from './voip-dids'

export const voipCalls = pgTable('voip_calls', {
  id,
  // UNIQUE for webhook idempotency (ON CONFLICT DO UPDATE for lifecycle patches).
  providerCallId: text('provider_call_id').unique(),
  // NULL = unknown inbound caller (no customer row exists for that number yet).
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  // Which Tri Pros DID handled this call. NULL preserved if DID is later removed.
  voipDidId: uuid('voip_did_id').references(() => voipDids.id, { onDelete: 'set null' }),
  // Other party. Captured at call time; immune to customer.phone updates later.
  remoteE164: text('remote_e164').notNull(),
  direction: voipDirectionEnum('direction').notNull(),
  status: voipCallStatusEnum('status').notNull().default('queued'),
  // Set only if status='skipped_compliance'. Freeform: 'dnc' | 'outside_calling_hours' | 'kill_switch_active'.
  skipReason: text('skip_reason'),
  // Recording (populated post-call when recording enabled on the DID).
  recordingUrl: text('recording_url'),
  recordingDurationSeconds: integer('recording_duration_seconds'),
  // Lifecycle
  initiatedAt: timestamp('initiated_at', { mode: 'string', withTimezone: true }).defaultNow().notNull(),
  answeredAt: timestamp('answered_at', { mode: 'string', withTimezone: true }),
  endedAt: timestamp('ended_at', { mode: 'string', withTimezone: true }),
  durationSeconds: integer('duration_seconds'),
  // Who initiated (outbound) or picked up (inbound).
  agentUserId: text('agent_user_id').references(() => user.id, { onDelete: 'set null' }),
  createdAt,
  updatedAt,
}, table => ({
  customerIdx: index('voip_calls_customer_idx').on(table.customerId),
  agentIdx: index('voip_calls_agent_idx').on(table.agentUserId),
  didIdx: index('voip_calls_did_idx').on(table.voipDidId),
  initiatedIdx: index('voip_calls_initiated_idx').on(table.initiatedAt),
}))
```

#### `voip_messages` ([src/shared/db/schema/voip-messages.ts](../../../src/shared/db/schema/voip-messages.ts))

```ts
import type z from 'zod'
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'
import { voipDirectionEnum, voipMessageStatusEnum } from './meta'
import { voipDids } from './voip-dids'

export const voipMessages = pgTable('voip_messages', {
  id,
  // UNIQUE for webhook idempotency (status callbacks re-deliver).
  providerMessageId: text('provider_message_id').unique(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  voipDidId: uuid('voip_did_id').references(() => voipDids.id, { onDelete: 'set null' }),
  // Other party. Immune to customer.phone updates later.
  remoteE164: text('remote_e164').notNull(),
  body: text('body').notNull(),
  direction: voipDirectionEnum('direction').notNull(),
  status: voipMessageStatusEnum('status').notNull().default('queued'),
  // Set when status='failed' | 'undelivered'. Freeform: provider's error code + message.
  failureReason: text('failure_reason'),
  sentAt: timestamp('sent_at', { mode: 'string', withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { mode: 'string', withTimezone: true }),
  failedAt: timestamp('failed_at', { mode: 'string', withTimezone: true }),
  agentUserId: text('agent_user_id').references(() => user.id, { onDelete: 'set null' }),
  createdAt,
  updatedAt,
}, table => ({
  customerIdx: index('voip_messages_customer_idx').on(table.customerId),
  agentIdx: index('voip_messages_agent_idx').on(table.agentUserId),
  // Primary thread key — `(voipDidId, remoteE164)`. Per-thread queries
  // AND per-DID list queries are both covered via left-prefix.
  threadIdx: index('voip_messages_thread_idx').on(table.voipDidId, table.remoteE164),
  // Cross-DID admin queries ("all messages with Bob across all DIDs").
  remoteIdx: index('voip_messages_remote_idx').on(table.remoteE164),
}))
```

**Thread rule:** A conversation thread is uniquely keyed by `(voipDidId, remoteE164)`. Same customer texting two different Tri Pros DIDs = two separate threads. UI: when an agent opens a customer thread, they see messages on THEIR DID with that customer — not a flat merge across all DIDs.

#### `voip_link_tokens` ([src/shared/db/schema/voip-link-tokens.ts](../../../src/shared/db/schema/voip-link-tokens.ts))

```ts
import type z from 'zod'
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'
import { voipLinkTokenTypeEnum } from './meta'

export const voipLinkTokens = pgTable('voip_link_tokens', {
  id,
  // URL-safe random (~32 chars; base64url of 24 random bytes).
  token: text('token').notNull().unique(),
  // Phase 1: only 'l_doc'. Enum framework in place so l_pay/l_cal/l_esign drop in later without migration.
  type: voipLinkTokenTypeEnum('type').notNull(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  // Captured at mint time. Immune to customer.phone updates.
  phoneE164: text('phone_e164').notNull(),
  // 48h hard expiry per EPIC. Cleanup cron purges expired+unused.
  expiresAt: timestamp('expires_at', { mode: 'string', withTimezone: true }).notNull(),
  // Set on first consume. Subsequent visits return "already used".
  usedAt: timestamp('used_at', { mode: 'string', withTimezone: true }),
  createdByUserId: text('created_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  // Type-specific payload — for L-DOC: { slotId: uuid, instructions?: string }. Zod-validated at mint + consume.
  payloadJson: jsonb('payload_json').notNull(),
  createdAt,
  // NOTE: no updatedAt — tokens are immutable except for `usedAt` set once.
}, table => ({
  customerIdx: index('voip_link_tokens_customer_idx').on(table.customerId),
  expiresIdx: index('voip_link_tokens_expires_idx').on(table.expiresAt),
  phoneIdx: index('voip_link_tokens_phone_idx').on(table.phoneE164),
}))
```

#### `app_settings` ([src/shared/db/schema/app-settings.ts](../../../src/shared/db/schema/app-settings.ts))

```ts
import type z from 'zod'
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { user } from './auth'

export const appSettings = pgTable('app_settings', {
  // Natural PK. Examples: 'voip-in-house', 'voip-campaigns', 'compliance'.
  feature: text('feature').primaryKey(),
  // Per-feature Zod schema validates this at write time (in the feature's entity dir).
  configJson: jsonb('config_json').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true }).defaultNow().notNull(),
  updatedByUserId: text('updated_by_user_id').references(() => user.id, { onDelete: 'set null' }),
})
```

#### `customers` DNC decoration (additive — modify [src/shared/db/schema/customers.ts](../../../src/shared/db/schema/customers.ts))

```ts
// Append to customers table object (DO NOT replace existing columns):
dncOptedOutAt: timestamp('dnc_opted_out_at', { mode: 'string', withTimezone: true }),
dncReason: text('dnc_reason'),
dncAddedByUserId: text('dnc_added_by_user_id').references(() => user.id, { onDelete: 'set null' }),
```

Owning service: `src/shared/services/compliance.service.ts` (single file — matches codebase convention; every other service in `src/shared/services/` is single-file). Surface:
- `canOutboundTo(phoneE164)` → `boolean` (returns true if safe to outbound; false if any customer with this phone has `dncOptedOutAt` set)
- `addToDnc({ customerId, reason, addedByUserId })` → idempotent UPDATE on customer row. Cross-system propagation to CloudTalk (`dnc-propagation`) is voip-campaigns Phase 1 work — wired via INTEGRATION-SEAM §5.
- `removeFromDnc({ customerId })` → admin-only; clears all 3 DNC fields. CT untag propagation also voip-campaigns territory.
- `ftcScrubBatch()` → stub; real impl gated on FTC SAN issuance (Phase 2+)

### Enum cleanup commits needed

Tasks 2 and 3 were committed (`28e9b32e`, `d5d973fe`) with all 11 enums + 11 pgEnums. Before any schema files land:

**Commit A (enums):**
- DELETE from `src/shared/constants/enums/voip.ts`: `voipSources`, `voipCallDispositions`, `voipDidStatuses`, `voipDidRoles`, `voipDncSources`, `voipUserAvailabilities`, `voipTransferModes`.
- RENAME in `src/shared/constants/enums/voip.ts`: `voipMessageDirections` → `voipDirections`, `VoipMessageDirection` → `VoipDirection`.
- NARROW in `src/shared/constants/enums/voip.ts`: `voipLinkTokenTypes = ['l_doc'] as const`.
- (Leave `voipCampaignStatuses` alone — voip-campaigns owns it.)

**Commit B (pgEnums):**
- DELETE from `src/shared/db/schema/meta.ts`: `voipSourceEnum`, `voipCallDispositionEnum`, `voipDidStatusEnum`, `voipDidRoleEnum`, `voipDncSourceEnum`, `voipUserAvailabilityEnum`, `voipTransferModeEnum` + their imports.
- RENAME in `src/shared/db/schema/meta.ts`: `voipMessageDirectionEnum` → `voipDirectionEnum` (PG type name `voip_direction`).
- No `db:push:dev` yet — batched with the schema files in Task 11.

### Implementation order (after the two cleanup commits above)

1. Add DNC fields to `customers` (modify [customers.ts](../../../src/shared/db/schema/customers.ts)) + skeleton compliance service.
2. Create the 5 new schema files in dependency order: `voip_dids` → `voip_calls` → `voip_messages` → `voip_link_tokens` → `app_settings`.
3. Update `src/shared/db/schema/index.ts` re-exports.
4. Task 11 — `lead_sources.voipConfigJSON` with `inHouse` sub-object (Zod schema + column).
5. Single `pnpm db:push:dev` after everything compiles.
6. Continue from Task 12 (entity scaffolds) per the existing per-task plan below.

### Tasks below — STALENESS LEVEL

- **Tasks 0, 1** — committed, current.
- **Task 2 (enums)** — STALE. Use the Commit A recipe above instead of the original block.
- **Task 3 (pgEnums)** — STALE. Use the Commit B recipe above.
- **Task 4 (`voip_calls`)** — STALE code block. Use the GRILL RESULTS shape above.
- **Task 5 (`voip_dids`)** — STALE code block. Use the GRILL RESULTS shape above.
- **Task 6 (`voip_dnc`)** — DELETED. DNC is now 3 fields on `customers` per above.
- **Task 7 (`voip_user_availability`)** — DELETED. Softphone tracks its own connection state in-browser.
- **Task 8 (`voip_messages`)** — STALE code block. Use the GRILL RESULTS shape above.
- **Task 9 (`voip_link_tokens`)** — STALE code block (small diffs: 3 indexes added, bug fix). Use GRILL RESULTS shape.
- **Task 10 (`app_settings`)** — STALE code block (only bug fix on `updatedByUserId`). Use GRILL RESULTS shape.
- **Task 11+ (lead_sources extension and beyond)** — unaffected by grill; review when reached.

The workflow steps in each task (verify with `pnpm tsc && pnpm lint`, commit messages, single-commit-per-task discipline) remain valid. Only the schema code blocks are stale.

---

**Goal:** Ship the in-house VoIP foundation that every other in-house comms feature (lifecycle SMS, mobile mode, admin observability, customer-side timeline) builds on, AND that voip-campaigns Phase 1 depends on.

In agent-facing terms, Phase 1 ships:
- An agent can click "Call" on a customer profile → app dials the customer **from the agent's sticky Tri Pros DID** → bridges into the agent's browser softphone → conversation happens → disposition recorded.
- An agent can click "Send SMS" on a customer profile → app sends SMS from the same sticky DID → delivery status tracked → inbound replies threaded.
- A customer who replies STOP gets opted out automatically → `voip_dnc` records it → all future outbound (in-house AND CloudTalk) gates against this table.
- CloudTalk's Call Flow Designer can hit our voip routing endpoints mid-call to look up caller context, get a warm-transfer target DID, and double-check compliance.
- An agent can mint a tokenized link and send it via SMS — the customer opens it, lands on the L-DOC document-upload route, the token gets consumed (single-use, 48h TTL, phone-tied).
- Super-admin has a global kill switch via `app_settings(feature='voip-in-house')` that halts all in-house outbound.

Everything voip-campaigns adds in its Phase 1 (CloudTalk-side enrollment, attribute sync, webhook handling, graduation) plugs into the schema + DNC + voip routing surface this phase ships.

**Architecture:** Single-provider commit to **Twilio**. NO formal `VoIPProvider` interface — Twilio-only paths. CloudTalk integration is the sibling EPIC's concern; this EPIC just exposes the contract surface (voip routing endpoints, DNC, voip_* tables with `source` discriminator). All `voip_*` tables and the `services/voip/` top-level service tree land here. `providers/twilio/` follows the existing provider shape (`client.ts + voice.ts + messaging.ts + webhooks/`), mirroring `providers/notion/` and `providers/zoho-sign/`. tRPC entity routers use the entity-factory pattern (ADR-0002 — `createEntityRouter` + `createCrudRouter`) that's already live in `src/trpc/lib/`. Mobile (cellular routing) is **deferred to Phase 3**; Phase 1 ships browser softphone only.

**Tech stack:** TypeScript, Next.js App Router, tRPC (entity factory), Drizzle ORM (Postgres/Neon), CASL, `twilio` server SDK, `@twilio/voice-sdk` browser SDK, drizzle-zod, QStash (`@migration: → Inngest` annotations). No automated tests in Phase 1 — manual verification per task, per existing codebase pattern. No Retell, no Sendblue, no SIP Trunking, no AI dispatching, no cadence engine (CloudTalk owns those for lead-conversion campaigns).

---

## What changed vs the pre-2026-05-23 plan

Per the EPIC split (see [EPIC.md decisions log](./EPIC.md#2026-05-23--epic-split-ai-dialerlead-conversion--voip-campaigns-in-house-comms--this-epic)), this rewrite **drops** every AI-dialer / Retell / Sendblue / branded-calling / cadence-engine concern (moved to [voip-campaigns](../voip-campaigns/EPIC.md) or deferred entirely):

- `dialer_*` schema names → `voip_*` (with a `source: 'in_house' | 'cloudtalk'` discriminator)
- `dialer_lead_states` table → dropped entirely (CloudTalk owns cadence state)
- `dialer_settings` singleton → replaced by generic `app_settings(feature, config_json)` table; first row `feature='voip-in-house'`
- Retell + Sendblue + branded-calling providers → dropped entirely
- Custom AI-dialer dispatcher / cadence engine / transfer-router INITIATION → dropped
- 10 enum const arrays for dialer states → trimmed to the 5 the in-house side actually needs

It **adds**:
- A `source` discriminator on the shared `voip_calls`, `voip_messages`, `voip_dids` tables + forward-compat nullable columns (`cloudtalk_call_uuid`, `campaign_id`, `transcript_summary`, `sentiment`, `cloudtalk_message_id`, `template_key`) populated by voip-campaigns later.
- **VoIP routing endpoints** at `src/app/api/voip/routing/{caller-lookup,transfer-target,compliance-check}/route.ts` — sync request-response (NOT webhooks) per [`webhook-routes.md`](../../codebase-conventions/webhook-routes.md) Rule 5. voip-campaigns configures CloudTalk's Call Flow Designer dashboard to fire these mid-call. Phase 0 scaffolds already exist as mocks at these paths; **Phase 1 replaces the mocks with real impls**. Response shapes are contractually defined in [INTEGRATION-SEAM.md §1](../voip/INTEGRATION-SEAM.md).
- **Tokenized-link sends** — `voip_link_tokens` table, mint via tRPC, consume via `/api/voip/links/[token]` route. First use case is L-DOC (document upload). Pattern extends to payment, reschedule, e-sign in later phases.
- **Generic `app_settings` table** + DAL. First row is `feature='voip-in-house'`; voip-campaigns adds its own row in its Phase 1.
- **ESLint `no-restricted-imports` rule** enforcing the dependency direction from [INTEGRATION-SEAM.md "Dependency direction"](../voip/INTEGRATION-SEAM.md#dependency-direction): top-level `services/voip/*` MUST NOT import `services/voip/campaigns/*` or `providers/cloudtalk/*`.
- A **Phase 1 → voip-campaigns Phase 1 boundary verification** task — confirms `voip_dnc` writes from inbound STOP work, voip routing endpoints respond per contract, source-discriminator columns are populated correctly. Gates the cross-EPIC seam before CloudTalk-side work starts.

It **inverts** what was Task 28 (transfer-router service). Phase 1 does NOT initiate AI-to-human warm transfers — that's voip-campaigns's job via CloudTalk's Call Flow Designer. Phase 1 **exposes** the voip routing transfer-target endpoint that CloudTalk **calls**, returning the right in-house DID for the warm transfer destination.

---

## Architectural anchors (do not re-litigate)

These come from the EPIC decisions log + INTEGRATION-SEAM. Carrying them forward into Phase 1 implementation:

1. **Single-provider commit to Twilio.** No `VoIPProvider` interface. `providers/twilio/*` is the only voice + SMS path. Future swap rewrites `providers/twilio/*` + the services that touch it.
2. **`services/voip/` umbrella** at `src/shared/services/voip/`. Top-level files owned by this EPIC. `services/voip/campaigns/` is voip-campaigns's subdir — **this EPIC does NOT touch it** (lint-enforced via Task 33).
3. **Sticky DID-per-agent.** Phase 1 introduces `voip_dids.assigned_user_id` (nullable; transfer-target DID stays unassigned). NO `customers.assignedAgentUserId` field. Customer↔agent stickiness is implicit via the DID they're talking to.
4. **`voip_dnc` is app-canonical.** Both this EPIC and voip-campaigns gate against it. STOP writes here from either side.
5. **`source` discriminator + forward-compat nullable columns** in `voip_calls`, `voip_messages`, `voip_dids`. Documented in each entity's `DOCS.md` as "forward-compat for voip-campaigns".
6. **Subdomain:** `voip.triprosremodeling.com` — `VOIP_WEBHOOK_BASE_URL` env var. All webhooks + voip routing endpoints route here.
7. **Mobile (cellular routing) = Phase 3.** Phase 1 ships browser softphone only; `voip_user_availability.transfer_mode` enum gets `'desktop'` + a placeholder, but no mobile dispatch logic.
8. **Kill switch via `app_settings(feature='voip-in-house', config_json.globalKillSwitch)`** — Phase 1 ships the table + a seed row + the gate in `voip-compliance.service.ts`. The UI toggle ships in Phase 4.

---

## Tasks blocked by Phase 0 vetting clocks

Two tasks remain gated by external clocks. Sequence the implementation so they run last; everything else is unblocked.

- **Task 14 (FTC DNC scrub gate)** — gated by FCC DNC SAN issuance (1-2 business days from submission, may already be in hand). Without the SAN, the DNC-scrub leg of the compliance gate is a no-op.
- **Task 25 (Twilio SMS-send + STOP handler verification)** — gated by 10DLC Campaign approval (3-14 days from 2026-05-22 submission). Without an approved campaign, Twilio will reject outbound SMS. Code can land + lint clean before approval; the e2e SMS verification step in Task 36 waits for approval.

All schema, entity scaffolds, services, webhooks, providers, softphone widget, admin view, seed scripts can land immediately.

---

## File structure (Phase 1 deliverables — concrete, no inference)

### New schema files (`src/shared/db/schema/`)
- `voip-calls.ts` — call lifecycle records (renamed from `dialer_attempts` + source-discriminated)
- `voip-dids.ts` — DID pool with `assigned_user_id` for sticky-DID-per-agent
- `voip-dnc.ts` — Do-Not-Call registry (canonical for both EPICs)
- `voip-user-availability.ts` — agent transfer-target presence
- `voip-messages.ts` — SMS history (renamed; iMessage columns dropped)
- `voip-link-tokens.ts` — tokenized-link sends (mint/validate)
- `app-settings.ts` — generic feature-keyed config

### Modified schema
- `meta.ts` — adds new pgEnums for the voip domain
- `lead-sources.ts` — adds `voipConfigJSON` JSONB field

### New enum file (`src/shared/constants/enums/`)
- `voip.ts` — const arrays + derived types (co-located per Rule 26)

### New backend entities (`src/shared/entities/`)
- `voip-calls/`, `voip-dids/`, `voip-dnc/`, `voip-user-availability/`, `voip-messages/`, `voip-link-tokens/`, `app-settings/`
- Each follows the entity-factory layout per [ADR-0002](../../adr/0002-entity-server-system.md) + [`src/trpc/DOCS.md`](../../../src/trpc/DOCS.md): `DOCS.md`, `lib/constants.ts` (CASL name), `schemas/`, `types.ts`, `dal/server/` (custom queries only — generic CRUD comes from the factory), `spec.ts` (`EntityServerSpec`).

### Modified abilities
- `src/shared/domains/permissions/abilities.ts` — register 7 new entity names

### New providers (`src/shared/services/providers/twilio/`)
- `client.ts` — singleton Twilio client + dev-override gate (mirrors `providers/notion/client.ts`)
- `voice.ts` — `placeCall`, `endCall`, `mintSoftphoneAccessToken`, `validateVoiceSignature`
- `messaging.ts` — `sendSms`, `validateMessagingSignature`
- `webhooks/types.ts` — Zod schemas for inbound webhook payloads
- `constants/` — call-status mapping, message-status mapping
- `types.ts` — provider-native types

### New services (`src/shared/services/voip/`)
- `voip-calls.service.ts` — `placeAgentCall`, `recordCallLifecycle`, `setDisposition`
- `voip-messages.service.ts` — `sendManualSms`, `recordInboundMessage`, `recordMessageStatus`
- `voip-dids.service.ts` — `getStickyDidForAgent(userId)`, `getTransferTargetDid()`
- `voip-dnc.service.ts` — `recordDnc`, `lookupDnc`, STOP-keyword detection
- `voip-compliance.service.ts` — `canOutboundTo(phoneE164)` (DNC + calling-hours + kill-switch gate)
- `voip-routing.service.ts` — backends the voip routing endpoints (`lookupCallerContext`, `findTransferTarget`, `complianceCheck`)
- `voip-link-tokens.service.ts` — `mintToken`, `consumeToken`
- `voip-user-availability.service.ts` — `upsertAvailability`, `listAvailableTransferHumans`

### New webhook + API routes (`src/app/api/`)

> Per [`webhook-routes.md`](../../codebase-conventions/webhook-routes.md): async webhooks under `/api/webhooks/<vendor>/` (ONE route per vendor); sync request-response under `/api/<domain>/<purpose>/...`; browser/customer-facing outside both.

**Async webhooks** (vendor → us; 200 ack only; no business-data body in response):
- `webhooks/twilio/route.ts` — POST; ONE route for ALL Twilio async status callbacks (voice status, recording status, message status). Dispatches internally on payload discriminant.

**Sync request-response** (vendor waits for our response):
- `voip/routing/caller-lookup/route.ts` — POST; CloudTalk Call Flow Designer enrichment (Phase 1 replaces Phase 0 mock with real impl)
- `voip/routing/transfer-target/route.ts` — POST; CloudTalk warm-transfer lookup (Phase 1 replaces Phase 0 mock with real impl)
- `voip/routing/compliance-check/route.ts` — POST; CloudTalk pre-dial gate (Phase 1 replaces Phase 0 mock with real impl)
- `voip/twiml/voice-inbound/route.ts` — POST; Twilio inbound voice (returns placeholder voicemail TwiML; Phase 3 IVR replaces)
- `voip/twiml/messaging-inbound/route.ts` — POST; Twilio inbound SMS (STOP detection + TCPA auto-confirm; returns empty TwiML)

**Browser / customer-facing** (outside `/api/webhooks/` and `/api/voip/routing/`):
- `voip/softphone/access-token/route.ts` — GET; returns JWT for browser softphone
- `voip/links/[token]/route.ts` — GET; tokenized-link consume + redirect

> **Note:** the CloudTalk async webhook handler (`webhooks/cloudtalk/route.ts`) is owned by **voip-campaigns**, NOT this EPIC. Already exists as a Phase 0 scaffold; voip-campaigns Phase 1 fills in the switch arms using the services this EPIC creates.

### New tRPC routers (`src/trpc/routers/`)
- `voip-calls.router/` (entity router) — `crud` + business (`placeAgentCall`, `setDisposition`, `listRecent`)
- `voip-messages.router/` (entity router) — `crud` + business (`send`, `listByCustomer`)
- `voip-dids.router/` (entity router) — admin queries
- `voip-dnc.router/` (entity router) — `crud` + business (`recordManualDnc`)
- `voip-user-availability.router.ts` — `getMine`, `upsertMine`, `listAvailable` (admin)
- `voip-link-tokens.router.ts` — `mint` (returns short URL)
- `app-settings.router.ts` — `getByFeature`, `update` (super-admin only)
- Modified: `app.ts` — register all 7 routers

### New UI surface (`src/features/voip-in-house/`)
- `ui/components/softphone-widget/` — Twilio Voice JS SDK integration
- `ui/components/call-disposition-picker/` — modal opened after call ends
- `ui/components/call-now-button/` — click-to-call placeable
- `ui/components/send-message-button/` — send-SMS placeable
- `ui/views/voip-in-house-admin-view.tsx` — Phase 1 test page (admin only)
- `ui/components/index.ts` — public entrypoint for components (re-exports `SoftphoneWidget`, `CallNowButton`, `SendMessageButton`)
- `ui/views/index.ts` — public entrypoint for views (re-exports `VoipInHouseAdminView`)

### New route
- `src/app/(frontend)/dashboard/voip-in-house/page.tsx` — mounts the admin view
  - Note: path is `dashboard/`, not `(dashboard)/` — `dashboard` is a regular segment, not a route group. Old planning docs that say `(dashboard)` are stale.

### Modified layout
- `src/app/(frontend)/dashboard/layout.tsx` — mounts `<SoftphoneWidget />` globally

### Seed scripts (`scripts/`)
- `seed-voip-dids.ts` — inserts the 3 Phase 0 DIDs from env vars (transfer-target + per-agent dial DIDs)
- `seed-app-settings-voip.ts` — inserts `feature='voip-in-house'` row with default config
- `configure-lead-source-voip.ts` — sets `voipConfigJSON.inHouse` on an example lead source

### ESLint config
- `eslint.config.js` — adds `no-restricted-imports` rule per [INTEGRATION-SEAM.md "Dependency direction"](../voip/INTEGRATION-SEAM.md#dependency-direction)

---

## Manual verification gate (Phase 1 done when ALL pass)

- ✅ Agent clicks "Call" on a customer profile → softphone widget transitions to active-call → customer phone (override-routed in dev) rings → audio bridges both ways → hang up → disposition modal saves → `voip_calls` row has terminal status + `source='in_house'` + `twilio_call_sid` + `recording_url`.
- ✅ Agent clicks "Send SMS" on a customer profile → arrives on test phone → `voip_messages` row created with `direction='outbound'`, `source='in_house'`, `status='sent'` or `'delivered'` (after status webhook).
- ✅ Reply STOP from the test phone → `voip_dnc` row created with `source='twilio_stop'` + `phone_e164` = test phone + customer's lead state... no wait, no lead state in this EPIC. Just the DNC row + auto-confirmation SMS arrives.
- ✅ Next outbound attempt (call OR SMS) to the same phone → compliance gate blocks with `dnc_blocked` reason; no Twilio call placed; no row inserted (or row inserted with `status='skipped_compliance'` if we choose to log).
- ✅ Toggle `app_settings(feature='voip-in-house').configJson.globalKillSwitch = true` via DB → next outbound attempt blocks with `kill_switch_active` reason.
- ✅ POST `/api/voip/routing/caller-lookup` with valid shared-secret + `{caller_e164: <test customer phone>}` → returns `{customer_id, first_name, pipeline_stage, ...}` per [INTEGRATION-SEAM.md §1](../voip/INTEGRATION-SEAM.md).
- ✅ POST `/api/voip/routing/transfer-target` with valid shared-secret + `{caller_e164, customer_id}` → returns `{target_e164, warm_intro, custom_parameters}`.
- ✅ POST `/api/voip/routing/compliance-check` with DNC'd phone → returns `{allowed: false, reason: 'dnc'}`. With clean phone → returns `{allowed: true}`.
- ✅ Agent mints an L-DOC link via tRPC → returns short URL like `https://voip.triprosremodeling.com/api/voip/links/<token>` → opening URL within 48h validates and 302s to the L-DOC handler page (Phase 1 ships a stub page that just says "doc upload coming in Phase 2"; the validation + consume logic is what's tested).
- ✅ Opening the same token a second time → returns "link already used" (or whatever the consumed branch renders).
- ✅ `pnpm tsc` clean.
- ✅ `pnpm lint` clean (including the new `no-restricted-imports` rule for `services/voip/*` → `services/voip/campaigns/*`).
- ✅ Phase 1 → Phase 2 boundary checks (Task 35) all pass.

---

## Tasks

> **Convention:** every task ends with `pnpm tsc && pnpm lint` (NEVER `pnpm build`). Conventional commits: `feat(voip): ...`, `feat(twilio): ...`, `chore(voip): ...`, `feat(app-settings): ...`. Use `pnpm db:push:dev` (NEVER `pnpm db:push`). Use `import './lib/load-env'` in scripts (NEVER `'dotenv/config'`). Verify entity scaffolds by importing the entity-name constant into `abilities.ts` and ensuring CASL union typechecks (the entity-factory pattern's compile-time forcing function).

> **Manual verification format:** each task ends with explicit steps to run. If any step fails, the task is incomplete — debug before committing.

### Task 0: Extend `DalError` union with `'precondition-failed'`

**Files:**
- Modify: `src/shared/dal/server/types.ts`
- Modify: `src/trpc/lib/dal-to-trpc.ts`

> The voip services have a category of failure mode the existing `DalError` union doesn't cover: domain-precondition violations (customer has no phone, kill-switch active, DNC blocked, compliance gate refused). Today's union covers only `'not-found' | 'forbidden' | 'create-failed' | 'duplicate-failed' | 'db-error' | 'unknown-error'`. Mapping a kill-switch failure to `'forbidden'` is semantically wrong (it's not auth-based); to `'unknown-error'` is lossy (we want the reason in the message). Extend the union.

- [ ] **Step 0.1: Add the new variant to `DalError`**

In `src/shared/dal/server/types.ts`, extend the `DalError` union:

```ts
export type DalError
  = | { type: 'not-found' }
    | { type: 'forbidden' }
    | { type: 'create-failed', cause?: unknown }
    | { type: 'duplicate-failed', cause?: unknown }
    | { type: 'db-error', cause: unknown }
    | { type: 'unknown-error', cause: unknown }
    | { type: 'precondition-failed', reason: string }  // ← NEW
```

> Match the actual existing field shapes (some variants carry `cause`, etc.) — read the live file before editing.

- [ ] **Step 0.2: Map the new variant to a TRPCError code**

In `src/trpc/lib/dal-to-trpc.ts`, add a case to the switch:

```ts
case 'precondition-failed':
  throw new TRPCError({ code: 'PRECONDITION_FAILED', message: result.error.reason })
```

- [ ] **Step 0.3: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/dal/server/types.ts src/trpc/lib/dal-to-trpc.ts
git commit -m "feat(dal): add 'precondition-failed' variant to DalError union (voip prep)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 1: Install vendor SDKs + register env vars

**Files:**
- Modify: `package.json`
- Modify: `src/shared/config/server-env.ts`
- Modify: `.env.local` (developer's local; not committed)

- [ ] **Step 1.1: Install packages**

```bash
pnpm add twilio @twilio/voice-sdk
pnpm add -D @types/twilio
```

`twilio` is the server SDK. `@twilio/voice-sdk` is the browser SDK. **No** retell-sdk, **no** sendblue dependencies — those vendors are out of scope for this EPIC per the 2026-05-23 pivot.

- [ ] **Step 1.2: Register env vars in `server-env.ts`**

Read `src/shared/config/server-env.ts` first; merge the additions into the existing `envSchema`. Add (matching existing comment-block style):

```ts
// TWILIO (voip-in-house)
TWILIO_ACCOUNT_SID: z.string(),
TWILIO_AUTH_TOKEN: z.string(),
TWILIO_API_KEY_SID: z.string(),
TWILIO_API_KEY_SECRET: z.string(),
TWILIO_TWIML_APP_SID: z.string(),
TWILIO_TRUST_PROFILE_SID: z.string().optional(),
TWILIO_10DLC_CAMPAIGN_SID: z.string().optional(),  // gated by 10DLC vetting; optional until approval

// Pilot DIDs (role-named per Phase 0 procurement)
TWILIO_TRANSFER_TARGET_DID_E164: z.string(),
TWILIO_TRANSFER_TARGET_DID_SID: z.string(),
TWILIO_DID_424_E164: z.string(),
TWILIO_DID_424_SID: z.string(),
TWILIO_DID_626_E164: z.string(),
TWILIO_DID_626_SID: z.string(),

// FCC DNC (SAN pending — optional until Phase 0 issuance)
FTC_DNC_SAN: z.string().optional(),
FTC_DNC_USERNAME: z.string().optional(),
FTC_DNC_PASSWORD: z.string().optional(),

// Shared VoIP webhook base URL (covers Twilio + future CloudTalk webhooks + voip routing endpoints)
VOIP_WEBHOOK_BASE_URL: z.string(),

// Dev safety: redirects all outbound voice/SMS to a single test number in dev/preview.
// CI gate (Step 1.4) prevents this being set in production.
VOIP_DEV_OVERRIDE_NUMBER: z.string().optional(),

// CloudTalk webhook secret — single secret protecting BOTH:
//   1. Mid-call routing endpoints (`/api/voip/routing/*`) — voip-in-house Phase 1 (this EPIC) verifies inbound
//   2. Post-call webhooks (`/api/webhooks/cloudtalk/route.ts`) — voip-campaigns Phase 1 verifies inbound
// Both surfaces are CloudTalk → us with the same trust model; one secret is sufficient.
// voip-in-house Phase 1 implementer generates this (32+ char URL-safe random) and configures into
// CloudTalk's Call Flow Designer (voip-campaigns Phase 0 dashboard work).
// Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
CLOUDTALK_WEBHOOK_SECRET: z.string().min(32),
```

> **Removed vars (per 2026-05-23 pivot):** `RETELL_*`, `TWILIO_SIP_TRUNK_*`, `SENDBLUE_*`, `DIALER_*`. If any of these were stubbed in `server-env.ts` from the aborted Phase 1A branch, delete them as part of this change. Search: `grep -E "RETELL_|SENDBLUE_|SIP_TRUNK_|DIALER_" src/shared/config/server-env.ts`.

- [ ] **Step 1.3: Add CI gate for production env**

Create or extend a pre-build env-check script — search for an existing one first (`grep -rn "NODE_ENV.*production" scripts/ src/shared/config/`). If no canonical place exists, add it as the bottom of `server-env.ts` after the schema validation:

```ts
if (
  env.NODE_ENV === 'production'
  && env.VOIP_DEV_OVERRIDE_NUMBER
) {
  throw new Error('VOIP_DEV_OVERRIDE_NUMBER must NOT be set in production')
}
```

This runs at server startup (because `server-env.ts` is imported at server-boot). If a hook into `pnpm tsc` / a `pre-build` step exists, add a parallel check there too.

- [ ] **Step 1.4: Verify + commit**

```bash
pnpm tsc
pnpm lint
git add package.json pnpm-lock.yaml src/shared/config/server-env.ts
git commit -m "feat(voip): install Twilio SDKs + register voip env vars

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: voip enum const arrays + types

**Files:**
- Create: `src/shared/constants/enums/voip.ts`
- Modify: `src/shared/constants/enums/index.ts` — add `export * from './voip'`

> Per Rule 26, the const array + derived type live in the same file. No separate `types/enums/voip.ts`.

- [ ] **Step 2.1: Create the enum file**

```ts
// src/shared/constants/enums/voip.ts

// Cross-source discriminator (used by voip_calls, voip_messages, voip_dids).
// 'cloudtalk' rows are populated by voip-campaigns' webhook handler; 'in_house' rows by Twilio webhooks.
export const voipSources = ['in_house', 'cloudtalk'] as const
export type VoipSource = (typeof voipSources)[number]

// Call lifecycle (in-house Twilio call). CloudTalk-originated rows use the same enum;
// 'no_answer' and 'voicemail' are the CloudTalk-side terminals.
export const voipCallStatuses = [
  'queued',
  'initiated',
  'ringing',
  'answered',
  'completed',
  'no_answer',
  'voicemail',
  'failed',
  'skipped_compliance',
] as const
export type VoipCallStatus = (typeof voipCallStatuses)[number]

// Disposition recorded post-call (agent picks via UI; CloudTalk AI populates via webhook for 'cloudtalk' source).
export const voipCallDispositions = [
  'booked_meeting',
  'callback_scheduled',
  'interested_not_now',
  'not_interested',
  'wrong_number',
  'opt_out',
  'voicemail_left',
  'unreached',
] as const
export type VoipCallDisposition = (typeof voipCallDispositions)[number]

// DID lifecycle. In-house DIDs are typically 'active' (low-volume; no warming cycle).
// CloudTalk DIDs may use 'warming' / 'cooldown' / 'flagged' / 'retired' per voip-campaigns rotation policy.
export const voipDidStatuses = ['active', 'warming', 'cooldown', 'flagged', 'retired'] as const
export type VoipDidStatus = (typeof voipDidStatuses)[number]

// DID role within the in-house pool. Transfer-target receives CloudTalk warm-transfers + general inbound.
// Agent-outbound DIDs are sticky per agent (assigned_user_id set).
export const voipDidRoles = ['transfer_target', 'agent_outbound', 'campaign_rotation'] as const
export type VoipDidRole = (typeof voipDidRoles)[number]

// DNC source. Matches INTEGRATION-SEAM.md §5 exactly.
export const voipDncSources = [
  'twilio_stop',     // inbound STOP/UNSUB to in-house Twilio DID
  'cloudtalk_stop',  // inbound STOP to a CloudTalk DID (CloudTalk auto-honors + posts webhook)
  'voice_request',   // customer asked to be removed on a live call
  'manual_admin',    // admin clicks "Add to DNC" in admin UI
  'ftc',             // FTC DNC list scrub (Phase 2+ cron)
] as const
export type VoipDncSource = (typeof voipDncSources)[number]

// Agent availability for receiving warm transfers.
export const voipUserAvailabilities = ['available', 'on_call', 'off_shift'] as const
export type VoipUserAvailability = (typeof voipUserAvailabilities)[number]

// Transfer mode for receiving warm transfers. 'mobile' (cellular) is Phase 3; Phase 1 ships 'desktop' only.
// 'auto' resolves to desktop if browser softphone registered, else mobile (Phase 3 behavior).
export const voipTransferModes = ['desktop', 'mobile', 'auto'] as const
export type VoipTransferMode = (typeof voipTransferModes)[number]

// Message direction.
export const voipMessageDirections = ['outbound', 'inbound'] as const
export type VoipMessageDirection = (typeof voipMessageDirections)[number]

// Message status. SMS only — no iMessage values (Sendblue is dropped permanently).
export const voipMessageStatuses = [
  'queued',
  'sent',
  'delivered',
  'failed',
  'undelivered',
  'received',
] as const
export type VoipMessageStatus = (typeof voipMessageStatuses)[number]

// Tokenized-link type. L-DOC is Phase 1; others land per use case.
export const voipLinkTokenTypes = ['l_doc', 'l_pay', 'l_cal', 'l_esign'] as const
export type VoipLinkTokenType = (typeof voipLinkTokenTypes)[number]
```

- [ ] **Step 2.2: Update the enum barrel**

In `src/shared/constants/enums/index.ts`, add (match existing pattern):

```ts
export * from './voip'
```

- [ ] **Step 2.3: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/constants/enums/voip.ts src/shared/constants/enums/index.ts
git commit -m "feat(voip): add voip enum const arrays + types

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: pgEnum declarations in `meta.ts`

**Files:**
- Modify: `src/shared/db/schema/meta.ts`

> Per the [database-schema convention](../../codebase-conventions/database-schema.md), ALL pgEnums live in `meta.ts` (never in individual table files). Merge the new imports with the existing import block.

- [ ] **Step 3.1: Add the pgEnum block**

In `src/shared/db/schema/meta.ts`, append after the existing pgEnums:

```ts
import {
  voipSources,
  voipCallStatuses,
  voipCallDispositions,
  voipDidStatuses,
  voipDidRoles,
  voipDncSources,
  voipUserAvailabilities,
  voipTransferModes,
  voipMessageDirections,
  voipMessageStatuses,
  voipLinkTokenTypes,
} from '@/shared/constants/enums'

// VOIP
export const voipSourceEnum = pgEnum('voip_source', voipSources)
export const voipCallStatusEnum = pgEnum('voip_call_status', voipCallStatuses)
export const voipCallDispositionEnum = pgEnum('voip_call_disposition', voipCallDispositions)
export const voipDidStatusEnum = pgEnum('voip_did_status', voipDidStatuses)
export const voipDidRoleEnum = pgEnum('voip_did_role', voipDidRoles)
export const voipDncSourceEnum = pgEnum('voip_dnc_source', voipDncSources)
export const voipUserAvailabilityEnum = pgEnum('voip_user_availability', voipUserAvailabilities)
export const voipTransferModeEnum = pgEnum('voip_transfer_mode', voipTransferModes)
export const voipMessageDirectionEnum = pgEnum('voip_message_direction', voipMessageDirections)
export const voipMessageStatusEnum = pgEnum('voip_message_status', voipMessageStatuses)
export const voipLinkTokenTypeEnum = pgEnum('voip_link_token_type', voipLinkTokenTypes)
```

Merge the new `import { voip... } from '@/shared/constants/enums'` with any existing import from that module — don't add a duplicate.

- [ ] **Step 3.2: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/db/schema/meta.ts
git commit -m "feat(voip): register voip pgEnums in meta.ts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `voip_calls` table

**Files:**
- Create: `src/shared/db/schema/voip-calls.ts`

- [ ] **Step 4.1: Create the schema file**

```ts
// src/shared/db/schema/voip-calls.ts
import type z from 'zod'
import { relations } from 'drizzle-orm'
import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'
import {
  voipCallDispositionEnum,
  voipCallStatusEnum,
  voipMessageDirectionEnum,
  voipSourceEnum,
} from './meta'

export const voipCalls = pgTable('voip_calls', {
  id,
  source: voipSourceEnum('source').notNull(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  direction: voipMessageDirectionEnum('direction').notNull(),
  didUsed: text('did_used').notNull(),          // E.164 of the Tri Pros DID this call used
  remoteE164: text('remote_e164').notNull(),    // The other end (customer or external caller)
  status: voipCallStatusEnum('status').notNull().default('queued'),

  // In-house Twilio columns
  twilioCallSid: text('twilio_call_sid').unique(),
  recordingUrl: text('recording_url'),
  recordingDurationSeconds: integer('recording_duration_seconds'),

  // Forward-compat: voip-campaigns populates these when source='cloudtalk'.
  // See INTEGRATION-SEAM.md §2 + §8.
  cloudtalkCallUuid: text('cloudtalk_call_uuid').unique(),
  campaignId: text('campaign_id'),
  transcriptSummary: text('transcript_summary'),
  sentiment: text('sentiment'),

  // Lifecycle timestamps
  initiatedAt: timestamp('initiated_at', { mode: 'string', withTimezone: true }).defaultNow().notNull(),
  answeredAt: timestamp('answered_at', { mode: 'string', withTimezone: true }),
  endedAt: timestamp('ended_at', { mode: 'string', withTimezone: true }),
  durationSeconds: integer('duration_seconds'),

  // Agent association (for in-house: who initiated/received; for cloudtalk: who the warm-transfer landed on)
  agentUserId: text('agent_user_id').references(() => user.id, { onDelete: 'set null' }),

  // Disposition (post-call). Agent picks via UI for in-house; CloudTalk AI sets via webhook for cloudtalk.
  disposition: voipCallDispositionEnum('disposition'),
  dispositionNote: text('disposition_note'),
  skipReason: text('skip_reason'),

  metaJson: jsonb('meta_json'),
  createdAt,
  updatedAt,
})

export const voipCallsRelations = relations(voipCalls, ({ one }) => ({
  customer: one(customers, { fields: [voipCalls.customerId], references: [customers.id] }),
  agentUser: one(user, { fields: [voipCalls.agentUserId], references: [user.id] }),
}))

export const selectVoipCallSchema = createSelectSchema(voipCalls)
export type VoipCall = z.infer<typeof selectVoipCallSchema>

export const insertVoipCallSchema = createInsertSchema(voipCalls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertVoipCall = z.infer<typeof insertVoipCallSchema>
```

- [ ] **Step 4.2: Verify (no `db:push:dev` yet — batched in Task 11)**

```bash
pnpm tsc && pnpm lint
git add src/shared/db/schema/voip-calls.ts
git commit -m "feat(voip): add voip_calls table schema (with source discriminator + cloudtalk forward-compat columns)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `voip_dids` table

**Files:**
- Create: `src/shared/db/schema/voip-dids.ts`

> Notable change vs the old `dialer_dids`: adds `assigned_user_id` (sticky-DID-per-agent) and `role` (transfer_target / agent_outbound / campaign_rotation) instead of a single `is_transfer_target_did` boolean. CloudTalk-owned campaign DIDs live in this table with `source='cloudtalk'` + `role='campaign_rotation'` (populated by voip-campaigns later).

- [ ] **Step 5.1: Create the schema file**

```ts
// src/shared/db/schema/voip-dids.ts
import type z from 'zod'
import { integer, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { voipDidRoleEnum, voipDidStatusEnum, voipSourceEnum } from './meta'

export const voipDids = pgTable('voip_dids', {
  id,
  source: voipSourceEnum('source').notNull(),
  e164Number: text('e164_number').notNull().unique(),
  areaCode: varchar('area_code', { length: 3 }).notNull(),
  role: voipDidRoleEnum('role').notNull(),
  status: voipDidStatusEnum('status').notNull().default('active'),

  // Sticky-DID-per-agent (in-house only). Null for transfer-target + campaign_rotation DIDs.
  assignedUserId: text('assigned_user_id').references(() => user.id, { onDelete: 'set null' }),

  // Twilio identifier (in-house only)
  twilioPhoneSid: text('twilio_phone_sid').unique(),

  // Operational stats (incremented by Twilio status webhooks; reset daily by Phase 2 cron)
  attemptsToday: integer('attempts_today').notNull().default(0),
  attemptsTotal: integer('attempts_total').notNull().default(0),
  lastAttemptAt: timestamp('last_attempt_at', { mode: 'string', withTimezone: true }),
  lastFlaggedAt: timestamp('last_flagged_at', { mode: 'string', withTimezone: true }),
  flagReason: text('flag_reason'),

  // Reputation snapshots (Phase 2+ writes to this; Phase 1 schema-only)
  reputationDataJson: jsonb('reputation_data_json'),

  createdAt,
  updatedAt,
})

export const selectVoipDidSchema = createSelectSchema(voipDids)
export type VoipDid = z.infer<typeof selectVoipDidSchema>

export const insertVoipDidSchema = createInsertSchema(voipDids).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertVoipDid = z.infer<typeof insertVoipDidSchema>
```

- [ ] **Step 5.2: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/db/schema/voip-dids.ts
git commit -m "feat(voip): add voip_dids table schema (sticky-DID-per-agent + source discriminator)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `voip_dnc` table

**Files:**
- Create: `src/shared/db/schema/voip-dnc.ts`

> The `source` enum values match [INTEGRATION-SEAM.md §5](../voip/INTEGRATION-SEAM.md) exactly. Both EPICs gate against this table.

- [ ] **Step 6.1: Create the schema file**

```ts
// src/shared/db/schema/voip-dnc.ts
import type z from 'zod'
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id } from '../lib/schema-helpers'
import { user } from './auth'
import { voipDncSourceEnum } from './meta'

export const voipDnc = pgTable('voip_dnc', {
  id,
  phoneE164: text('phone_e164').notNull().unique(),
  source: voipDncSourceEnum('source').notNull(),
  reason: text('reason'),
  addedAt: timestamp('added_at', { mode: 'string', withTimezone: true }).defaultNow().notNull(),
  addedByUserId: text('added_by_user_id').references(() => user.id, { onDelete: 'set null' }),

  // Forward-compat: voip-campaigns sets this after pushing the DNC entry to CloudTalk's
  // contact attribute (do_not_call=true). NULL = not yet pushed (or no push needed because
  // source='cloudtalk_stop' = already honored CloudTalk-side).
  cloudtalkSyncedAt: timestamp('cloudtalk_synced_at', { mode: 'string', withTimezone: true }),

  createdAt,
})

export const selectVoipDncSchema = createSelectSchema(voipDnc)
export type VoipDnc = z.infer<typeof selectVoipDncSchema>

export const insertVoipDncSchema = createInsertSchema(voipDnc).omit({
  id: true,
  createdAt: true,
})
export type InsertVoipDnc = z.infer<typeof insertVoipDncSchema>
```

- [ ] **Step 6.2: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/db/schema/voip-dnc.ts
git commit -m "feat(voip): add voip_dnc table schema (cross-EPIC canonical DNC store)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `voip_user_availability` table

**Files:**
- Create: `src/shared/db/schema/voip-user-availability.ts`

- [ ] **Step 7.1: Create the schema file**

```ts
// src/shared/db/schema/voip-user-availability.ts
import type z from 'zod'
import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { user } from './auth'
import { voipTransferModeEnum, voipUserAvailabilityEnum } from './meta'

export const voipUserAvailability = pgTable('voip_user_availability', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  enrolledForTransfers: boolean('enrolled_for_transfers').notNull().default(false),
  manualStatus: voipUserAvailabilityEnum('manual_status').notNull().default('off_shift'),
  transferMode: voipTransferModeEnum('transfer_mode').notNull().default('desktop'),
  cellPhoneE164: text('cell_phone_e164'),  // populated when transferMode='mobile' (Phase 3)
  onCallUntil: timestamp('on_call_until', { mode: 'string', withTimezone: true }),
  lastTransferredAt: timestamp('last_transferred_at', { mode: 'string', withTimezone: true }),
  updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true }).defaultNow().notNull(),
})

export const selectVoipUserAvailabilitySchema = createSelectSchema(voipUserAvailability)
export type VoipUserAvailability = z.infer<typeof selectVoipUserAvailabilitySchema>

export const insertVoipUserAvailabilitySchema = createInsertSchema(voipUserAvailability).omit({
  updatedAt: true,
})
export type InsertVoipUserAvailability = z.infer<typeof insertVoipUserAvailabilitySchema>
```

- [ ] **Step 7.2: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/db/schema/voip-user-availability.ts
git commit -m "feat(voip): add voip_user_availability table schema

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: `voip_messages` table

**Files:**
- Create: `src/shared/db/schema/voip-messages.ts`

> Notable changes vs old `dialer_messages`: drops `sendblue_message_id` + `imessage` / `fallback_sms` channel values entirely. Adds `source` discriminator + `cloudtalk_message_id` forward-compat column.

- [ ] **Step 8.1: Create the schema file**

```ts
// src/shared/db/schema/voip-messages.ts
import type z from 'zod'
import { relations } from 'drizzle-orm'
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'
import {
  voipMessageDirectionEnum,
  voipMessageStatusEnum,
  voipSourceEnum,
} from './meta'

export const voipMessages = pgTable('voip_messages', {
  id,
  source: voipSourceEnum('source').notNull(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  direction: voipMessageDirectionEnum('direction').notNull(),
  didUsed: text('did_used').notNull(),          // E.164 of the Tri Pros DID used
  remoteE164: text('remote_e164').notNull(),    // The other end's E.164
  body: text('body').notNull(),
  status: voipMessageStatusEnum('status').notNull().default('queued'),

  // In-house Twilio identifier
  twilioMessageSid: text('twilio_message_sid').unique(),

  // Forward-compat: voip-campaigns populates these when source='cloudtalk'. See INTEGRATION-SEAM.md §2 + §8.
  cloudtalkMessageId: text('cloudtalk_message_id').unique(),
  campaignId: text('campaign_id'),
  templateKey: text('template_key'),  // 'manual' for ad-hoc; specific keys for templated sends

  // Agent association (who sent / who the inbound is threaded to)
  agentUserId: text('agent_user_id').references(() => user.id, { onDelete: 'set null' }),

  sentAt: timestamp('sent_at', { mode: 'string', withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { mode: 'string', withTimezone: true }),
  failedAt: timestamp('failed_at', { mode: 'string', withTimezone: true }),
  metaJson: jsonb('meta_json'),
  createdAt,
  updatedAt,
})

export const voipMessagesRelations = relations(voipMessages, ({ one }) => ({
  customer: one(customers, { fields: [voipMessages.customerId], references: [customers.id] }),
  agentUser: one(user, { fields: [voipMessages.agentUserId], references: [user.id] }),
}))

export const selectVoipMessageSchema = createSelectSchema(voipMessages)
export type VoipMessage = z.infer<typeof selectVoipMessageSchema>

export const insertVoipMessageSchema = createInsertSchema(voipMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertVoipMessage = z.infer<typeof insertVoipMessageSchema>
```

- [ ] **Step 8.2: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/db/schema/voip-messages.ts
git commit -m "feat(voip): add voip_messages table schema (source discriminator + cloudtalk forward-compat)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: `voip_link_tokens` table (NEW — tokenized-link sends)

**Files:**
- Create: `src/shared/db/schema/voip-link-tokens.ts`

> Per the EPIC locked decision: tokens are single-use, 48h TTL, phone-tied. Phase 1's first use case is L-DOC (document upload). The token schema is generic so payment/reschedule/e-sign variants drop in later without migrations.

- [ ] **Step 9.1: Create the schema file**

```ts
// src/shared/db/schema/voip-link-tokens.ts
import type z from 'zod'
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'
import { voipLinkTokenTypeEnum } from './meta'

export const voipLinkTokens = pgTable('voip_link_tokens', {
  id,
  token: text('token').notNull().unique(),                  // URL-safe random; ~32 chars
  type: voipLinkTokenTypeEnum('type').notNull(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  phoneE164: text('phone_e164').notNull(),                  // tied to the recipient's phone
  expiresAt: timestamp('expires_at', { mode: 'string', withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { mode: 'string', withTimezone: true }),
  createdByUserId: text('created_by_user_id').references(() => user.id, { onDelete: 'set null' }),

  // Type-specific payload (e.g., for L-DOC: { uploadSlotId, instructions, returnUrl }).
  // Validated per-type at mint + at consume.
  payloadJson: jsonb('payload_json').notNull(),

  createdAt,
})

export const selectVoipLinkTokenSchema = createSelectSchema(voipLinkTokens)
export type VoipLinkToken = z.infer<typeof selectVoipLinkTokenSchema>

export const insertVoipLinkTokenSchema = createInsertSchema(voipLinkTokens).omit({
  id: true,
  createdAt: true,
})
export type InsertVoipLinkToken = z.infer<typeof insertVoipLinkTokenSchema>
```

- [ ] **Step 9.2: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/db/schema/voip-link-tokens.ts
git commit -m "feat(voip): add voip_link_tokens table schema (tokenized-link sends; L-DOC first)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: `app_settings` table (NEW — generic feature-keyed config)

**Files:**
- Create: `src/shared/db/schema/app-settings.ts`

> Replaces what the old plan called `dialer_settings`. Generic by design so voip-campaigns (and any future feature) can use the same table with its own row. Two rows are anticipated short-term: `feature='voip-in-house'` (this EPIC) and `feature='voip-campaigns'` (sibling EPIC's Phase 1).

- [ ] **Step 10.1: Create the schema file**

```ts
// src/shared/db/schema/app-settings.ts
import type z from 'zod'
import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { user } from './auth'

export const appSettings = pgTable('app_settings', {
  feature: text('feature').primaryKey(),  // e.g., 'voip-in-house', 'voip-campaigns'
  configJson: jsonb('config_json').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true }).defaultNow().notNull(),
  updatedByUserId: text('updated_by_user_id').references(() => user.id, { onDelete: 'set null' }),
})

export const selectAppSettingsSchema = createSelectSchema(appSettings)
export type AppSetting = z.infer<typeof selectAppSettingsSchema>

export const insertAppSettingsSchema = createInsertSchema(appSettings).omit({
  updatedAt: true,
})
export type InsertAppSetting = z.infer<typeof insertAppSettingsSchema>
```

> Per-feature `configJson` Zod schemas live in each feature's entity (e.g., `entities/app-settings/schemas/voip-in-house-config-schema.ts`) and are validated at write time by the service layer.

- [ ] **Step 10.2: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/db/schema/app-settings.ts
git commit -m "feat(app-settings): add generic feature-keyed app_settings table

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: `lead_sources.voipConfigJSON` + Zod schema + `db:push:dev`

**Files:**
- Create: `src/shared/entities/lead-sources/schemas/voip-config-schema.ts`
- Modify: `src/shared/entities/lead-sources/schemas.ts` (or its dir-form `schemas/index.ts` — check first; the existing pattern re-exports `leadSourceFormConfigSchema`)
- Modify: `src/shared/db/schema/lead-sources.ts`
- Modify: `src/shared/db/schema/index.ts` — re-export all 7 new tables

> The `voipConfigJSON` shape is shared between this EPIC and voip-campaigns. Sub-objects: `inHouse` (owned here) and `campaigns` (owned by voip-campaigns; type stub'd here as optional, real fields land in voip-campaigns Phase 1). See [INTEGRATION-SEAM.md §9](../voip/INTEGRATION-SEAM.md).

- [ ] **Step 11.1: Create the voip-config Zod schema**

```ts
// src/shared/entities/lead-sources/schemas/voip-config-schema.ts
import { z } from 'zod'

// Sub-object owned by voip-in-house (this EPIC).
const voipInHouseConfigSchema = z.object({
  enabled: z.boolean(),
  // Templates for transactional / lifecycle SMS the in-house side may send for this lead source.
  // Phase 1 ships only the schema; Phase 2 wires Inngest-driven sends.
  transactionalSmsTemplates: z.object({
    meetingReminder: z.string().optional(),
    proposalLinkSend: z.string().optional(),
    projectStatusUpdate: z.string().optional(),
    docUploadRequest: z.string().optional(),
  }).nullable(),
  // Override the default calling-hours window for this lead source (e.g., commercial lead source = M-F only).
  // null = inherit from app_settings.
  callingHoursOverride: z.object({
    startHourLocal: z.number().int().min(0).max(23),
    endHourLocal: z.number().int().min(0).max(23),
    callingDays: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])),
  }).nullable(),
})

// Sub-object owned by voip-campaigns (sibling EPIC). Stubbed here as a loose record so this EPIC
// doesn't constrain the sibling's design; voip-campaigns Phase 1 narrows this to a strict schema.
const voipCampaignsConfigStubSchema = z.object({
  enabled: z.boolean(),
}).passthrough().nullable()

export const leadSourceVoipConfigSchema = z.object({
  inHouse: voipInHouseConfigSchema,
  campaigns: voipCampaignsConfigStubSchema,
})

export type LeadSourceVoipConfig = z.infer<typeof leadSourceVoipConfigSchema>
```

- [ ] **Step 11.2: Re-export from the lead-sources entity barrel**

In `src/shared/entities/lead-sources/schemas.ts` (or `schemas/index.ts` per existing pattern — read first and match), append:

```ts
export { leadSourceVoipConfigSchema } from './schemas/voip-config-schema'
export type { LeadSourceVoipConfig } from './schemas/voip-config-schema'
```

- [ ] **Step 11.3: Add the `voipConfigJSON` field to `lead-sources.ts` schema**

Modify `src/shared/db/schema/lead-sources.ts`. Read the existing file first — its shape was: `id, name, slug, token, formConfigJSON (notnull), isActive, archivedAt, createdAt, updatedAt`. Add the new column nullable (existing rows have no voip config):

```ts
import type { LeadSourceVoipConfig } from '@/shared/entities/lead-sources/schemas/voip-config-schema'
import { leadSourceVoipConfigSchema } from '@/shared/entities/lead-sources/schemas/voip-config-schema'

// Inside the leadSourcesTable definition, after formConfigJSON:
  voipConfigJSON: jsonb('voip_config_json').$type<LeadSourceVoipConfig>(),

// Update selectLeadSourceSchema:
export const selectLeadSourceSchema = createSelectSchema(leadSourcesTable, {
  formConfigJSON: leadSourceFormConfigSchema,
  voipConfigJSON: leadSourceVoipConfigSchema.nullable(),
})

// Update insertLeadSourceSchema:
export const insertLeadSourceSchema = createInsertSchema(leadSourcesTable, {
  formConfigJSON: leadSourceFormConfigSchema,
  voipConfigJSON: leadSourceVoipConfigSchema.optional(),
}).omit({ id: true, createdAt: true, updatedAt: true })
```

- [ ] **Step 11.4: Re-export the new tables from the schema barrel**

In `src/shared/db/schema/index.ts`, add (match existing pattern; read file first):

```ts
export * from './app-settings'
export * from './voip-calls'
export * from './voip-dids'
export * from './voip-dnc'
export * from './voip-link-tokens'
export * from './voip-messages'
export * from './voip-user-availability'
```

- [ ] **Step 11.5: Push schema to dev DB**

```bash
pnpm db:push:dev
```

**Verify:** drizzle-kit prompts to add 7 new tables + 11 new enum types + `lead_sources.voip_config_json` column. Accept. **Do NOT run `pnpm db:push` — that's production.**

- [ ] **Step 11.6: Manually verify the migration**

Connect to dev DB (Drizzle Studio or psql via `DATABASE_DEV_URL`):

```sql
-- 7 new tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND (table_name LIKE 'voip_%' OR table_name = 'app_settings')
ORDER BY table_name;

-- 11 new enum types
SELECT typname FROM pg_type
WHERE typname LIKE 'voip_%'
ORDER BY typname;

-- Confirm lead_sources got the new column
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_name = 'lead_sources' AND column_name = 'voip_config_json';

-- Confirm forward-compat columns on voip_calls + voip_messages
SELECT column_name FROM information_schema.columns
WHERE table_name = 'voip_calls' AND column_name IN ('source', 'cloudtalk_call_uuid', 'campaign_id', 'transcript_summary', 'sentiment')
ORDER BY column_name;
```

Expected: 7 tables (app_settings + 6 voip_*), 11 voip_* enum types, `voip_config_json` jsonb nullable column on lead_sources, all 5 forward-compat columns present on `voip_calls`.

- [ ] **Step 11.7: Commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/db/schema/lead-sources.ts src/shared/db/schema/index.ts \
  src/shared/entities/lead-sources/schemas/voip-config-schema.ts \
  src/shared/entities/lead-sources/schemas.ts
git commit -m "$(cat <<'EOF'
feat(voip): add voipConfigJSON to lead_sources + push migration

- Adds shared voip config field with inHouse + campaigns sub-objects per INTEGRATION-SEAM.md §9
- Pushed voip_* tables + app_settings + 11 new enum types via pnpm db:push:dev (NOT production)
- Re-exports all 7 new tables from the schema barrel

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Tasks 12-18: Backend entity scaffolds (entity-factory pattern per ADR-0002)

> Post-grill (2026-05-30) count: **5 entities, not 7.** `voip-dnc` is gone — DNC
> lives as 3 fields on `customers` (compliance.service owns the gate). `voip-user-availability`
> is gone — the softphone tracks its own connection state in-browser.
>
> Each task creates ONE entity directory under `src/shared/entities/<entity>/`.
> The `EntityServerSpec` lives at `entities/<entity>/lib/server-spec.ts`. The
> router (Task 30) imports the spec from there.
>
> **Read these first:**
> - [ADR-0002](../../adr/0002-entity-server-system.md) — the EntityServerSpec contract
> - [`src/trpc/DOCS.md`](../../../src/trpc/DOCS.md) — operational rules for the system
> - [`docs/how-to/add-an-entity.md`](../../how-to/add-an-entity.md) — step-by-step recipe
> - [`src/shared/entities/proposals/`](../../../src/shared/entities/proposals/) — canonical migrated example
>
> **Per-entity file layout:**
>
> ```
> src/shared/entities/<entity>/
>   DOCS.md
>   lib/constants.ts             ← exports the CASL entity-name constant (PascalCase)
>   lib/visibility.ts            ← scope predicate (one fn)
>   lib/server-spec.ts           ← EntityServerSpec (data + visibility predicate)
>   schemas/index.ts             ← re-exports from db schema
>   types.ts                     ← re-exports Drizzle-inferred types
> ```
>
> No `dal/server/crud.ts` at scaffold time — `createCrudDal(spec)` lives at the
> call site in services / routers, not in the entity dir. Add `dal/server/queries.ts`
> later if a query genuinely doesn't fit through CRUD.

#### Task 12: `entities/voip-calls/`

Visibility — `agent_user_id = userId` (agents see only their own calls). Super-admin
bypasses via the omni-scope path. No `shareable` field — calls aren't customer-facing.

Files:
- `lib/constants.ts` — `export const VOIP_CALL = 'VoipCall' as const`
- `lib/visibility.ts` — `eq(voipCalls.agentUserId, userId)`
- `lib/server-spec.ts` — `EntityServerSpec<typeof voipCalls>`; `update` schema is
  `insertVoipCallSchema.partial()`
- `schemas/index.ts` + `types.ts` — re-exports
- `DOCS.md` — invariants: provider_call_id idempotency, agent-ownership visibility,
  compliance gate on outbound (skipped_compliance + skip_reason), recording URL access

#### Task 13: `entities/voip-dids/`

Visibility — `assigned_user_id = userId` (agents see only their own DIDs;
inbound-only shared DIDs are NULL-assigned and invisible to agents).

Files: same pattern as Task 12. DOCS.md captures the 1:N cardinality rule and the
partial unique index enforcing exactly one `is_primary=TRUE` per user.

#### Task 14: `entities/voip-messages/`

Visibility — `agent_user_id = userId`. Inbound STOP-keyword SMS to a shared DID
have NULL agentUserId and are visible only to super-admin.

Files: same pattern. DOCS.md captures the composite thread key
`(voipDidId, remoteE164)`, the STOP-keyword path running under SYSTEM_CONTEXT,
and the outbound compliance gate via `complianceService.canOutboundTo`.

#### Task 15: `entities/voip-link-tokens/`

Visibility — `created_by_user_id = userId`. Customer consume route bypasses
session-based scope entirely via `shareable: { tokenColumn: 'token' }`.

Files: same pattern + spec carries `shareable: { tokenColumn: 'token' }`. DOCS.md
captures the 48h hard expiry, immutability-except-usedAt invariant, and the
captured-payload-at-mint pattern.

#### Task 16: `entities/app-settings/`

Visibility — `sql\`FALSE\`` (admin-only). Spec carries `primaryKey: 'feature'`
(natural string PK, not `id: uuid`). TId stays the default `string`.

Files: same pattern + spec `primaryKey: 'feature'`. DOCS.md captures the
admin-only rule, the natural-PK deviation rationale, and lists initial use cases
(`'voip-in-house'`, `'voip-campaigns'`, `'compliance'`).

#### Tasks 17 + 18 — DELETED by 2026-05-30 grill

- ~~Task 17: `entities/voip-dnc/`~~ — DNC moved to 3 fields on `customers`.
  `complianceService` (`src/shared/services/compliance.service.ts`) owns the gate.
- ~~Task 18: `entities/voip-user-availability/`~~ — softphone tracks its own
  connection state in-browser; no DB table needed.

---

### Task 19: Register entity names in CASL `abilities.ts`

**File:** modify `src/shared/domains/permissions/abilities.ts`

The entity-name colocation pattern is already live — `abilities.ts` imports each
entity's identity from `entities/<entity>/lib/constants.ts` and builds
`ENTITY_NAMES` from there.

#### Step 19.1: Import the 5 new entity-name constants

Merge into the existing import block (sorted per perfectionist rule):

```ts
import { APP_SETTING } from '@/shared/entities/app-settings/lib/constants'
import { VOIP_CALL } from '@/shared/entities/voip-calls/lib/constants'
import { VOIP_DID } from '@/shared/entities/voip-dids/lib/constants'
import { VOIP_LINK_TOKEN } from '@/shared/entities/voip-link-tokens/lib/constants'
import { VOIP_MESSAGE } from '@/shared/entities/voip-messages/lib/constants'
```

#### Step 19.2: Add them to `ENTITY_NAMES`

```ts
export const ENTITY_NAMES = [
  CUSTOMER,
  MEETING,
  PROPOSAL,
  PROJECT,
  ACTIVITY,
  VOIP_CALL,
  VOIP_DID,
  VOIP_MESSAGE,
  VOIP_LINK_TOKEN,
  APP_SETTING,
] as const
```

#### Step 19.3: Per-role rules

**super-admin:** already covered by `can('manage', 'all')`.

**agent:**

```ts
can('read', 'VoipCall')
can('create', 'VoipCall')      // placeAgentCall via softphone

can('read', 'VoipMessage')
can('create', 'VoipMessage')   // sendSms via thread UI

can('read', 'VoipDid')         // resolve own sticky DID

can('read', 'VoipLinkToken')
can('create', 'VoipLinkToken') // mint L-DOC links
```

Row-level scoping ("only own rows") is enforced by the per-entity visibility
predicate, not by CASL conditions — CASL just grants verb access. No agent rule
for `AppSetting` (admin-only via `manage` on `all`).

**homeowner / user:** no rules for Phase 1. Tokenized customer-side actions use
the shareable middleware (token-as-credential), not session-based CASL.

#### Step 19.4: Verify + commit

```bash
pnpm tsc && pnpm lint
git add src/shared/entities/voip-calls src/shared/entities/voip-dids \
        src/shared/entities/voip-messages src/shared/entities/voip-link-tokens \
        src/shared/entities/app-settings \
        src/shared/domains/permissions/abilities.ts
git commit
```

---

### Task 20: Twilio provider scaffold

✅ **DONE** (commits `8d2c476a` Slug B + post-grill refactor 2026-06-02).

> The body below reflects the as-built shape after the **single-client refactor** (see `client-is-the-superset-entry-point` in [service-architecture.md](../../codebase-conventions/service-architecture.md)). Cross-cutting locks remain in [GRILL RESULTS](#-grill-results--2026-05-30) at the top of this doc.

**Final directory shape:**

```
src/shared/services/providers/twilio/
  DOCS.md                    superset-client pattern + invariants + caller rules
  client.ts                  THE entry point — twilioClient singleton + RestException + TwilioClient type
  types.ts                   SDK type re-exports (CallInstance, MessageInstance, IncomingPhoneNumberInstance)
  constants/
    index.ts                 ACCESS_TOKEN_TTL_SECONDS, ACCESS_TOKEN_IDENTITY_PREFIX,
                             INBOUND_VOICE_TTS_VOICE, PILOT_DIDS, VETTING, VOIP_DEV_OVERRIDE_NUMBER
  schemas/                   outbound-API Zod (what we send to Twilio)
    primitives.ts            e164Schema, twilioSidSchema, isoDateTimeSchema
    access-token.ts          mintVoiceAccessTokenInputSchema
  webhooks/                  inbound-payload Zod (what Twilio sends us)
    voice.ts                 voiceInboundWebhookSchema, voiceStatusCallbackSchema, voiceDialActionSchema
    messaging.ts             messagingInboundWebhookSchema, messagingStatusCallbackSchema
```

**No `lib/`. No per-capability action files.** Everything you can do with Twilio is a method on `twilioClient`.

**The action surface — all on `twilioClient`:**

| Method | Purpose |
|---|---|
| `placeOutboundCall(params)` | REST — outbound call. Caller goes through Slug C's compliance gate first. |
| `fetchCall(sid)` | REST — fetch call resource. |
| `hangupCall(sid)` | REST — force terminate. |
| `sendMessage(params)` | REST — outbound SMS/MMS. Caller goes through compliance + 10DLC gate first. |
| `fetchMessage(sid)` | REST — fetch message resource. |
| `listIncomingPhoneNumbers(params?)` | REST — admin observability. Resync DIDs from Twilio. |
| `fetchIncomingPhoneNumber(sid)` | REST — fetch single DID. |
| `mintVoiceAccessToken(input)` | Local — sign browser-softphone JWT using API Key SID + SECRET. |
| `buildInboundVoiceTwiml(input)` | Local — fluent VoiceResponse for the inbound-call URL. |
| `buildDialTwiml(input)` | Local — fluent VoiceResponse for outbound dial via TwiML App. |
| `buildInboundMessagingTwiml(input)` | Local — fluent MessagingResponse for inbound SMS. |
| `verifyWebhookSignature(input)` | Local — HMAC-SHA1 validation via SDK's `validateRequest`. |

**Plus separate (non-method) exports:**

- `RestException` from `client.ts` — for `instanceof` in catch blocks.
- `TwilioClient` type from `client.ts` — for typing variables that hold the client.
- SDK type re-exports from `types.ts` — `CallInstance`, `MessageInstance`, etc. — for Slug C service signatures.
- Zod schemas from `schemas/` and `webhooks/` — for `.parse()` at the seam (route handler form-body → typed payload).

**Design rules baked into the scaffold:**

- **Single entry point.** `import { twilioClient } from '@/shared/services/providers/twilio/client'` and only that. No `lib/voice.ts`, no `lib/jwt.ts`, no `webhooks/verify.ts` — these don't exist on purpose. See [DOCS.md](../../../src/shared/services/providers/twilio/DOCS.md#superset-client).
- **Client is a superset of the raw SDK.** REST methods + JWT mint + TwiML builders + webhook signature verify — all on the same handle.
- **Single vendor.** No abstract `VoIPProvider` interface. Column naming on the consumer side is already vendor-neutral (`provider_call_id`, `provider_message_id`, `provider_did_id`), so a hypothetical future swap rewrites this directory only — schema-stable.
- **No naked HTTP.** Every Twilio call goes through the typed `twilio` Node SDK (v6.0.2). No `fetch()` to Twilio endpoints.
- **Provider is a leaf.** No DB writes, no DAL imports, no service imports, no business rules. Methods accept primitives + SDK option types and return primitives + SDK instance types. All orchestration (compliance gate, DNC lookup, recording-retention, STOP-keyword routing, dev-override rewriting) lives in Slug C's `services/voip/*.service.ts`.
- **SDK types are the source of truth.** `placeOutboundCall` accepts `CallListInstanceCreateOptions` directly; `sendMessage` accepts `MessageListInstanceCreateOptions`.
- **Webhook payloads are typed at the seam.** Twilio webhooks are form-urlencoded; the SDK does not publish Zod for them. We define Zod in `webhooks/{voice,messaging}.ts` so route handlers in Slug D `.parse()` once and get a typed payload everywhere downstream.
- **TwiML via fluent builders.** `twilio.twiml.VoiceResponse` + `twilio.twiml.MessagingResponse` — never hand-written XML.
- **Webhook signing uses the account auth token.** That's Twilio's standard for both REST + webhook validation. JWTs for the browser softphone, in contrast, sign with `TWILIO_API_KEY_SID + SECRET`.
- **Lazy SDK singleton.** The underlying `twilio()` SDK instance is constructed on first call inside `client.ts` and reused thereafter. Module-load construction breaks edge-runtime static probes and test environments where env may be partially populated.
- **Errors are propagated, not wrapped.** SDK's `RestException` is re-exported from `client.ts`; callers `instanceof` it for `.code`, `.status`, `.message`, `.moreInfo`.

**Verified:**
- `pnpm tsc` clean
- `pnpm lint` clean
- Sanity-test scratch confirmed the minted JWT decodes to the expected shape (`cty='twilio-fpa;v=1'`, `grants.voice.incoming.allow=true`, `grants.voice.outgoing.application_sid` set, correct iss/sub, TTL applied).

**What Slug C will import (preview):**

```ts
// All actions through one entry point:
import { twilioClient, RestException } from '@/shared/services/providers/twilio/client'

// Types/schemas where they're needed at the seam:
import type { CallInstance } from '@/shared/services/providers/twilio/types'
import { voiceStatusCallbackSchema } from '@/shared/services/providers/twilio/webhooks/voice'
import { PILOT_DIDS, VETTING } from '@/shared/services/providers/twilio/constants'
```

That single-import-path-for-actions rule is enforced in Slug E via ESLint `no-restricted-imports` against any `import twilio from 'twilio'` outside this directory.

---

### Tasks 21-25: Service layer — ✅ DONE (Slug C, 2026-06-02)

> Original Tasks 21-25 (pre-grill: 750 lines) replaced by this consolidated
> as-built block. Per [GRILL RESULTS](#-grill-results--2026-05-30), Task 21's
> separate `voip-dnc` + `voip-compliance` + `voip-user-availability` services
> were merged/dropped — DNC lives on `customers` (3 fields) owned by
> [`complianceService`](../../../src/shared/services/compliance.service.ts);
> user-availability dropped entirely (softphone tracks own state in-browser).

#### Files landed (5 services + 4 entity DAL modules + 2 query modules)

```
src/shared/services/voip/
  voip-calls.service.ts          placeAgentCall, recordInboundCall,
                                 applyStatusCallback, getCallById,
                                 getCallByIdSystem
  voip-messages.service.ts       sendSms, recordInboundMessage,
                                 applyStatusCallback, fetchThread,
                                 getMessageById  + isOptOutKeyword export
  voip-routing.service.ts        mintSoftphoneToken, resolveInboundDial,
                                 buildInboundVoiceResponse,
                                 buildOutboundDialResponse,
                                 buildInboundMessagingResponse,
                                 applyDevOverride, checkOutboundReadiness
  voip-dids.service.ts           assignDidToUser, markPrimary, unassignDid,
                                 resyncFromTwilio  + read passthroughs
                                 (getStickyDidForUser, getDidByE164,
                                 getDidByProviderId, getDidByIdSystem,
                                 canAgentOutbound, requireStickyDid)
  voip-link-tokens.service.ts    mintToken, resolveToken, markUsed,
                                 purgeExpired

src/shared/entities/voip-calls/dal/server/         crud.ts (createCrudDal)
src/shared/entities/voip-messages/dal/server/      crud.ts
src/shared/entities/voip-dids/dal/server/          crud.ts + queries.ts
                                                   (getStickyDidForUser,
                                                    getDidByE164,
                                                    getDidByProviderId)
src/shared/entities/voip-link-tokens/dal/server/   crud.ts + queries.ts
                                                   (getTokenByValue,
                                                    markTokenUsed)
```

Commits: `f4a9156d` (C.1 voip-calls), `3cc8b233` (C.2 messages/routing/dids),
`378a49eb` (C.3 voip-link-tokens).

#### Test of the superset `twilioClient` API

Every method on the client has a service consumer demonstrating the
single-entry-point pattern:

| `twilioClient` method | Service consumer | Use case |
|---|---|---|
| `placeOutboundCall` | voip-calls | server-initiated outbound (click-to-dial) |
| `fetchCall` | voip-calls (capability available) | webhook drift reconciliation |
| `hangupCall` | voip-calls (capability available) | force-terminate when softphone disconnect fails to propagate |
| `sendMessage` | voip-messages | outbound SMS |
| `fetchMessage` | voip-messages (capability available) | status drift reconciliation |
| `listIncomingPhoneNumbers` | voip-dids | admin "Resync from Twilio" |
| `fetchIncomingPhoneNumber` | voip-dids | single-SID reconciliation |
| `mintVoiceAccessToken` | voip-routing | softphone bootstrap |
| `buildInboundVoiceTwiml` | voip-routing | inbound-call TwiML responder |
| `buildDialTwiml` | voip-routing | outbound-dial TwiML responder (softphone-initiated) |
| `buildInboundMessagingTwiml` | voip-routing | inbound-SMS TwiML responder |
| `verifyWebhookSignature` | route handlers (Slug D — boundary call, not service-wrapped) | async webhook authentication |
| `RestException` re-export | voip-calls, voip-messages | `instanceof` for `.code`/`.status` |

#### Three-tier discipline holds throughout

- Services depend on the SINGLE `twilioClient` (per the post-refactor
  [`client-is-the-superset-entry-point`](../../codebase-conventions/service-architecture.md#client-is-the-superset-entry-point)
  rule). No service imports `twilio` directly. No service imports
  per-capability `lib/voice` / `lib/jwt` / etc. — those files don't exist.
- Provider knows nothing about compliance, DNC, sticky DIDs, dev-override,
  10DLC vetting, STOP keywords. All policy lives in the service layer.
- Services do NOT depend on tRPC, route handlers, or UI surfaces.
- Direct `db` writes are limited to the two cases generic CRUD can't cover:
  ON CONFLICT idempotent upserts (`provider_call_id` / `provider_message_id`)
  and webhook-driven status patches keyed by provider id.

#### Orchestration baked into the service surface

- **Compliance gate** — every outbound entry point calls
  `complianceService.canOutboundTo(remoteE164)`; false ⇒ insert row with
  `status='skipped_compliance'` (calls) or `status='failed'` (messages),
  audit trail preserved even when no Twilio call fires.
- **Sticky DID resolution** — outbound services require a primary DID,
  surface `precondition-failed` when missing.
- **Dev-override rewriting** — `VOIP_DEV_OVERRIDE_NUMBER` rewrites only the
  Twilio dial leg; the row's `remoteE164` keeps the intended target for
  audit fidelity. Production gate in `server-env.ts` ensures override is
  empty in prod.
- **10DLC vetting** — outbound SMS in production requires
  `TWILIO_10DLC_CAMPAIGN_SID`. Dev/preview can send without (Twilio's
  trial-account limits still apply).
- **STOP-keyword detection** — `isOptOutKeyword(body)` exported alongside
  `voipMessagesService`; route handlers call BEFORE persistence to short-
  circuit a normal thread insert and route to `complianceService.addToDnc`.
- **Composite thread key** — `(voipDidId, remoteE164)` queries via the
  indexed access path; same customer texting two DIDs = two threads.
- **Idempotent upserts** — webhook re-delivery is safe (ON CONFLICT on
  `provider_call_id` / `provider_message_id`; `usedAt IS NULL` guard on
  link tokens).

#### What Slug D imports

```ts
// All route handlers consume services, not the provider directly:
import { voipCallsService } from '@/shared/services/voip/voip-calls.service'
import { voipMessagesService, isOptOutKeyword } from '@/shared/services/voip/voip-messages.service'
import { voipRoutingService } from '@/shared/services/voip/voip-routing.service'
import { voipDidsService } from '@/shared/services/voip/voip-dids.service'
import { voipLinkTokensService } from '@/shared/services/voip/voip-link-tokens.service'

// Webhook signature verify is intentionally NOT service-wrapped — one-line
// boundary call:
import { twilioClient } from '@/shared/services/providers/twilio/client'

// Webhook payload Zod for `.parse()` at the seam:
import {
  voiceInboundWebhookSchema, voiceStatusCallbackSchema, voiceDialActionSchema,
} from '@/shared/services/providers/twilio/webhooks/voice'
import {
  messagingInboundWebhookSchema, messagingStatusCallbackSchema,
} from '@/shared/services/providers/twilio/webhooks/messaging'
```

#### Verified

- `pnpm tsc` clean across all 3 incremental commits
- `pnpm lint` clean across all 3 incremental commits
- The original sanity-test scratch (JWT mint) still works after the refactor;
  the new service layer is wired into the same singleton.

#### Deferred to Slug D

- ESLint `no-restricted-imports` rule preventing `import twilio from 'twilio'`
  outside the provider directory. Currently enforced by convention + PR review.


### Task 26: Twilio async webhook handler (ONE route) + softphone access-token

**Files:**
- Create: `src/app/api/voip/softphone/access-token/route.ts` — browser-facing JWT (outside `/webhooks/` and `/voip/routing/` — browser-initiated)
- Create: `src/app/api/webhooks/twilio/route.ts` — ONE route for ALL Twilio async status callbacks (voice status + recording status + messaging status)

> **Convention:** per [`webhook-routes.md`](../../codebase-conventions/webhook-routes.md) Rule 1 + Rule 2, every external provider gets ONE async webhook route handler. The route handler IS the orchestrator — verify signature → switch on payload discriminant → call into the underlying service. NO per-event sub-routes. NO wrapper service. Twilio sends three status-callback flavors that share the same URL; each carries a unique discriminator field: voice status (`CallStatus`), recording status (`RecordingStatus`), messaging status (`MessageStatus`). Twilio expects 200 ack — no TwiML body. Inbound voice / inbound SMS (which DO expect TwiML response bodies) are SYNC and live under `/api/voip/twiml/*` in **Task 27**.

> Routes are **THIN** — verify signature, parse, dispatch. Per Rule 4: 200 OK always once signature + envelope are valid, even if a downstream service call throws (`console.error` + persist later in `voip_webhook_errors`; no retry storm).

- [ ] **Step 26.1: `access-token/route.ts` — GET, returns JWT for browser softphone**

```ts
// src/app/api/voip/softphone/access-token/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/shared/domains/auth/server'
import { mintSoftphoneAccessToken } from '@/shared/services/providers/twilio/voice'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const token = mintSoftphoneAccessToken({ userId: session.user.id })
  return NextResponse.json(token, { headers: { 'Cache-Control': 'no-store' } })
}
```

- [ ] **Step 26.2: `webhooks/twilio/route.ts` — single async handler with payload-discriminant dispatch**

```ts
// src/app/api/webhooks/twilio/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { validateTwilioSignature } from '@/shared/services/providers/twilio'
import {
  twilioMessageStatusMap,
  twilioVoiceStatusMap,
  WEBHOOK_SIGNATURE_HEADER,
} from '@/shared/services/providers/twilio/constants'
import {
  messagingStatusPayloadSchema,
  voiceRecordingPayloadSchema,
  voiceStatusPayloadSchema,
} from '@/shared/services/providers/twilio/webhooks/types'
import { upsertFromTwilioWebhook } from '@/shared/entities/voip-calls/dal/server/mutations'
import { recordCallLifecycle } from '@/shared/services/voip/voip-calls.service'
import { recordMessageStatus } from '@/shared/services/voip/voip-messages.service'

/**
 * Single Twilio async webhook handler.
 *
 * Twilio doesn't send an `event_type` field, but each status flavor has a
 * distinct discriminator key in the form-encoded body:
 *   - recording status: `RecordingStatus` present (also carries CallSid — check FIRST)
 *   - messaging status: `MessageStatus` present
 *   - voice status:     `CallStatus` present
 *
 * All three callback fields in the Twilio Console (voice status, recording
 * status, message status) point to this same URL. Twilio sends 200-ack-only;
 * no TwiML in response.
 */
export async function POST(req: Request) {
  const url = req.url
  const formData = await req.formData()
  const params: Record<string, string> = {}
  formData.forEach((v, k) => { params[k] = String(v) })

  const signature = (await headers()).get(WEBHOOK_SIGNATURE_HEADER)
  if (!validateTwilioSignature({ signature, url, params })) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  }

  try {
    // Recording status — check first because recording payloads also carry CallSid.
    if (params.RecordingStatus) {
      const parsed = voiceRecordingPayloadSchema.safeParse(params)
      if (!parsed.success) return NextResponse.json({ ok: true })
      await upsertFromTwilioWebhook(SYSTEM_CONTEXT, {
        callSid: parsed.data.CallSid,
        patch: {
          recordingUrl: parsed.data.RecordingUrl,
          recordingDurationSeconds: parsed.data.RecordingDuration
            ? parseInt(parsed.data.RecordingDuration, 10)
            : null,
        },
      })
      return NextResponse.json({ ok: true })
    }

    // Messaging status
    if (params.MessageStatus) {
      const parsed = messagingStatusPayloadSchema.safeParse(params)
      if (!parsed.success) return NextResponse.json({ ok: true })
      const internalStatus = twilioMessageStatusMap[parsed.data.MessageStatus]
      if (!internalStatus) return NextResponse.json({ ok: true })
      await recordMessageStatus(SYSTEM_CONTEXT, {
        twilioMessageSid: parsed.data.MessageSid,
        status: internalStatus,
      })
      return NextResponse.json({ ok: true })
    }

    // Voice status
    if (params.CallStatus) {
      const parsed = voiceStatusPayloadSchema.safeParse(params)
      if (!parsed.success) return NextResponse.json({ ok: true })
      const internalStatus = twilioVoiceStatusMap[parsed.data.CallStatus]
      if (!internalStatus) return NextResponse.json({ ok: true })

      const args: Parameters<typeof recordCallLifecycle>[1] = {
        twilioCallSid: parsed.data.CallSid,
        status: internalStatus,
      }
      if (internalStatus === 'answered') args.answeredAt = new Date().toISOString()
      if (internalStatus === 'completed' || internalStatus === 'no_answer' || internalStatus === 'failed') {
        args.endedAt = new Date().toISOString()
        if (parsed.data.CallDuration) args.durationSeconds = parseInt(parsed.data.CallDuration, 10)
      }
      const result = await recordCallLifecycle(SYSTEM_CONTEXT, args)
      if (!result.success) {
        // eslint-disable-next-line no-console
        console.error('[twilio webhook] voice status DAL error', result.error)
      }
      return NextResponse.json({ ok: true })
    }

    // Unrecognized — log + 200 per Rule 4
    // eslint-disable-next-line no-console
    console.warn('[twilio webhook] unrecognized payload (no CallStatus/RecordingStatus/MessageStatus)', { keys: Object.keys(params) })
    return NextResponse.json({ ok: true })
  }
  catch (err) {
    // eslint-disable-next-line no-console
    console.error('[twilio webhook] handler threw — returning 200 to avoid retry storm', err)
    return NextResponse.json({ ok: true })
  }
}
```

> `validateTwilioSignature` is provider-shape-agnostic (validates against URL + params; voice + messaging share the same signing algorithm). Export from the provider barrel (`providers/twilio/index.ts` or per-capability — pick whichever already exists in Task 20's scaffold).

- [ ] **Step 26.3: Point service-layer `statusCallbackUrl` values at the single endpoint**

In `services/voip/voip-calls.service.ts` (Task 22) `placeAgentCall` → `placeCall(...)` args:
- `statusCallbackUrl: \`${baseUrl}/api/webhooks/twilio\``
- `recordingStatusCallbackUrl: \`${baseUrl}/api/webhooks/twilio\``

In `services/voip/voip-messages.service.ts` (Task 23) `sendManualSms` → `sendSms(...)` args:
- `statusCallbackUrl: \`${env.VOIP_WEBHOOK_BASE_URL}/api/webhooks/twilio\``

(Same URL for all three; the route handler discriminates internally on the payload.)

- [ ] **Step 26.4: Configure Twilio Console**

In Twilio Console — all three async callback fields point to the SAME URL:
- Each in-house DID → **Voice → Status callback URL** → `https://voip.triprosremodeling.com/api/webhooks/twilio`
- Each in-house DID → **Voice → Recording status callback URL** → `https://voip.triprosremodeling.com/api/webhooks/twilio`
- Each in-house DID → **Messaging → Status callback URL** → `https://voip.triprosremodeling.com/api/webhooks/twilio`

Inbound webhooks (Voice URL on the TwiML App SID + Messaging URL on each DID) are SYNC and configured in **Task 27** under `/api/voip/twiml/*`.

Document the dashboard config in `docs/plans/voip-in-house/twilio-console-config.md` (committed reference).

- [ ] **Step 26.5: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/app/api/webhooks/twilio/ src/app/api/voip/softphone/ docs/plans/voip-in-house/twilio-console-config.md
git commit -m "feat(twilio): add single async webhook handler + softphone access-token

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 27: Twilio inbound TwiML handlers (sync namespace)

**Files:**
- Create: `src/app/api/voip/twiml/voice-inbound/route.ts` — Phase 1 placeholder voicemail TwiML; Phase 3 IVR replaces it
- Create: `src/app/api/voip/twiml/messaging-inbound/route.ts` — inbound SMS handler (STOP detection + record-inbound + TCPA auto-confirm)

> **Convention:** these endpoints are SYNC request-response — Twilio expects a TwiML XML response body inline. Per [`webhook-routes.md`](../../codebase-conventions/webhook-routes.md) Rule 5, sync endpoints live OUTSIDE `/api/webhooks/` because their semantics are "return business data the caller needs to continue" (TwiML instructions = business data). Namespace: `/api/voip/twiml/*`. Async status callbacks (e.g., the message-status SID lifecycle) are NOT here — they're folded into the single Twilio webhook handler in **Task 26**.

> **Blocked by:** 10DLC Campaign approval for SMS-send verification (Task 36). Routes themselves can land + lint clean before approval. Inbound STOP works even without an approved campaign (Twilio accepts inbound regardless).

- [ ] **Step 27.1: `voice-inbound/route.ts` — Phase 1 placeholder TwiML**

```ts
// src/app/api/voip/twiml/voice-inbound/route.ts
import { headers } from 'next/headers'
import { validateTwilioSignature } from '@/shared/services/providers/twilio'
import { WEBHOOK_SIGNATURE_HEADER } from '@/shared/services/providers/twilio/constants'

/**
 * Phase 1: placeholder TwiML — "Thanks for calling, please leave a message."
 * Twilio expects an XML response body inline. Phase 3 replaces this with the
 * real IVR (route to live agent / take voicemail / handle after-hours).
 */
export async function POST(req: Request) {
  const url = req.url
  const formData = await req.formData()
  const params: Record<string, string> = {}
  formData.forEach((v, k) => { params[k] = String(v) })

  const signature = (await headers()).get(WEBHOOK_SIGNATURE_HEADER)
  if (!validateTwilioSignature({ signature, url, params })) {
    return new Response('Unauthorized', { status: 403 })
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thanks for calling Tri Pros Remodeling. We can't take your call right now. Please leave a message after the tone, and we will get back to you.</Say>
  <Record maxLength="180" playBeep="true" trim="trim-silence" />
  <Hangup />
</Response>`

  return new Response(twiml, { headers: { 'Content-Type': 'text/xml; charset=utf-8' } })
}
```

- [ ] **Step 27.2: `messaging-inbound/route.ts` — inbound SMS + TCPA STOP auto-confirm**

```ts
// src/app/api/voip/twiml/messaging-inbound/route.ts
import { headers } from 'next/headers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { sendSms, validateTwilioSignature } from '@/shared/services/providers/twilio'
import { WEBHOOK_SIGNATURE_HEADER } from '@/shared/services/providers/twilio/constants'
import { messagingInboundPayloadSchema } from '@/shared/services/providers/twilio/webhooks/types'
import { recordInboundMessage } from '@/shared/services/voip/voip-messages.service'
import env from '@/shared/config/server-env'

const OPT_OUT_CONFIRM_BODY = 'You have been unsubscribed from Tri Pros Remodeling. You will not receive further calls or messages.'
const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response/>`

/**
 * Inbound SMS handler. Twilio POSTs the inbound payload and expects a TwiML
 * response inline. We respond with empty TwiML (no auto-reply via TwiML
 * body) and send the TCPA-mandatory STOP confirmation as a separate
 * outbound SMS via the messaging provider — keeps the auto-confirm in the
 * normal SMS pipeline so it goes through compliance + DID-aware send.
 *
 * The STOP-keyword detection happens INSIDE `recordInboundMessage`, which
 * routes opt-out bodies to `voip_dnc` and returns `wasOptOut: true`.
 */
export async function POST(req: Request) {
  const url = req.url
  const formData = await req.formData()
  const params: Record<string, string> = {}
  formData.forEach((v, k) => { params[k] = String(v) })

  const signature = (await headers()).get(WEBHOOK_SIGNATURE_HEADER)
  if (!validateTwilioSignature({ signature, url, params })) {
    return new Response('Unauthorized', { status: 403 })
  }

  const parsed = messagingInboundPayloadSchema.safeParse(params)
  if (!parsed.success) {
    return new Response(EMPTY_TWIML, { headers: { 'Content-Type': 'text/xml; charset=utf-8' } })
  }

  const result = await recordInboundMessage(SYSTEM_CONTEXT, {
    fromE164: parsed.data.From,
    toE164: parsed.data.To,
    body: parsed.data.Body,
    twilioMessageSid: parsed.data.MessageSid,
  })
  if (!result.success) {
    // eslint-disable-next-line no-console
    console.error('[twiml/messaging-inbound] error', result.error)
    return new Response(EMPTY_TWIML, { headers: { 'Content-Type': 'text/xml; charset=utf-8' } })
  }

  // TCPA-mandatory auto-confirm for STOP (sent as a separate outbound, not via TwiML body).
  if (result.data.wasOptOut) {
    await sendSms({
      fromE164: parsed.data.To,  // reply from the DID the customer texted
      toE164: parsed.data.From,
      body: OPT_OUT_CONFIRM_BODY,
      statusCallbackUrl: `${env.VOIP_WEBHOOK_BASE_URL}/api/webhooks/twilio`,
    })
  }

  return new Response(EMPTY_TWIML, { headers: { 'Content-Type': 'text/xml; charset=utf-8' } })
}
```

- [ ] **Step 27.3: Configure Twilio Console**

For inbound voice + messaging (sync TwiML endpoints):
- **TwiML App SID → Voice → A CALL COMES IN** → `https://voip.triprosremodeling.com/api/voip/twiml/voice-inbound` (replaces the temporary inline TwiML used during Phase 0 / earlier Phase 1 work)
- Each in-house DID → **Messaging → A MESSAGE COMES IN** → `https://voip.triprosremodeling.com/api/voip/twiml/messaging-inbound`

(Async status callbacks — voice status, recording status, message status — point to the SINGLE async endpoint configured in Task 26, NOT here.)

Add to `twilio-console-config.md`.

- [ ] **Step 27.4: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/app/api/voip/twiml/
git commit -m "feat(twilio): add inbound TwiML handlers (voice placeholder + messaging STOP)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 28: VoIP routing endpoints — replace Phase 0 mocks with real impls

**Files:**
- Create: `src/shared/services/providers/cloudtalk/lib/verify-webhook-secret.ts`
- **Replace** Phase 0 mock body in: `src/app/api/voip/routing/caller-lookup/route.ts`
- **Replace** Phase 0 mock body in: `src/app/api/voip/routing/transfer-target/route.ts`
- **Replace** Phase 0 mock body in: `src/app/api/voip/routing/compliance-check/route.ts`

> **State at task start:** the 3 route files already exist as Phase 0 scaffolds (mocked impls created by voip-campaigns Phase 0 for CloudTalk smoke testing). This task swaps the mock body with the real implementation that calls `voip-routing.service.ts` (Task 24) + verifies the shared secret. **Do not create the files anew — replace the function body.** Path is correct already per [`webhook-routes.md`](../../codebase-conventions/webhook-routes.md) Rule 5 (sync request-response under `/api/voip/routing/`, NOT under `/api/webhooks/`).

> **Provider directory seeding:** This EPIC creates `providers/cloudtalk/` with just `lib/verify-webhook-secret.ts` — the small pure helper that route handlers need to validate inbound CloudTalk traffic. The rest of the CloudTalk provider (`client.ts`, `types.ts`, capability files like `calls.ts` / `sms.ts` / `campaigns.ts`) is voip-campaigns Phase 1 territory. Shape mirrors `providers/notion/` and `providers/zoho-sign/` (each has `client.ts` + `lib/` + `constants/` + `types.ts`).

> **Authoritative contract:** [INTEGRATION-SEAM.md §1](../voip/INTEGRATION-SEAM.md). CloudTalk's Call Flow Designer is configured (in voip-campaigns Phase 0) to fire these mid-call. Each endpoint is auth'd via shared-secret query param (`?secret=<CLOUDTALK_WEBHOOK_SECRET>`) + future IP allowlist (deferred to Phase 4). The SAME `CLOUDTALK_WEBHOOK_SECRET` env var is reused by voip-campaigns Phase 1's post-call webhook handler at `src/app/api/webhooks/cloudtalk/route.ts` — one secret protects both inbound surfaces. Response shapes MUST match the seam doc exactly — drift breaks CloudTalk's Call Flow.

- [ ] **Step 28.1: CloudTalk provider — webhook secret verifier**

Lives in the cloudtalk provider tree (mirrors how `providers/twilio/voice.ts` houses `validateVoiceSignature`). This file is the **seed of `providers/cloudtalk/`** — voip-campaigns Phase 1 adds the rest of the provider (client, types, capability files) alongside it.

```ts
// src/shared/services/providers/cloudtalk/lib/verify-webhook-secret.ts
import { timingSafeEqual } from 'node:crypto'
import env from '@/shared/config/server-env'

/**
 * Verifies the shared secret CloudTalk passes on inbound traffic to our subdomain.
 * Used for BOTH surfaces:
 *   - Mid-call routing endpoints (`/api/voip/routing/*`) — voip-in-house Phase 1 (sync, real impl)
 *   - Post-call webhook handler (`/api/webhooks/cloudtalk/route.ts`) — voip-campaigns Phase 1 (async event handler)
 * Both surfaces are CloudTalk → us with the same trust model; one secret value, configured
 * once into CloudTalk's Call Flow Designer + Webhook dashboard during voip-campaigns Phase 0.
 */
export function verifyCloudtalkWebhookSecret(url: string): boolean {
  try {
    const u = new URL(url)
    const provided = u.searchParams.get('secret') ?? ''
    if (!provided) return false
    const expected = env.CLOUDTALK_WEBHOOK_SECRET
    // timing-safe compare requires equal-length buffers; pad both sides + length-check separately.
    const len = Math.max(provided.length, expected.length)
    return timingSafeEqual(
      Buffer.from(provided.padEnd(len, '\0')),
      Buffer.from(expected.padEnd(len, '\0')),
    ) && provided.length === expected.length
  }
  catch {
    return false
  }
}
```

- [ ] **Step 28.2: `caller-lookup/route.ts`**

```ts
// src/app/api/voip/routing/caller-lookup/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { lookupCallerContext } from '@/shared/services/voip/voip-routing.service'
import { verifyCloudtalkWebhookSecret } from '@/shared/services/providers/cloudtalk/lib/verify-webhook-secret'

const bodySchema = z.object({
  caller_e164: z.string().regex(/^\+[1-9]\d{6,14}$/),
})

export async function POST(req: Request) {
  if (!verifyCloudtalkWebhookSecret(req.url)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ customer_id: null }, { status: 200 })  // soft-fail per seam fallback contract
  }

  const result = await lookupCallerContext(SYSTEM_CONTEXT, parsed.data)
  if (!result.success) {
    // soft-fail: CloudTalk falls back to generic greeting per dashboard config
    return NextResponse.json({ customer_id: null }, { status: 200 })
  }
  return NextResponse.json(result.data)
}
```

- [ ] **Step 28.3: `transfer-target/route.ts`**

```ts
// src/app/api/voip/routing/transfer-target/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { findTransferTarget } from '@/shared/services/voip/voip-routing.service'
import { verifyCloudtalkWebhookSecret } from '@/shared/services/providers/cloudtalk/lib/verify-webhook-secret'

const bodySchema = z.object({
  caller_e164: z.string().regex(/^\+[1-9]\d{6,14}$/),
  customer_id: z.string().uuid(),
})

export async function POST(req: Request) {
  if (!verifyCloudtalkWebhookSecret(req.url)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ target_e164: null, reason: 'no_human_available' }, { status: 200 })
  }

  const result = await findTransferTarget(SYSTEM_CONTEXT, parsed.data)
  if (!result.success) {
    return NextResponse.json({ target_e164: null, reason: 'no_human_available' }, { status: 200 })
  }
  return NextResponse.json(result.data)
}
```

- [ ] **Step 28.4: `compliance-check/route.ts`**

```ts
// src/app/api/voip/routing/compliance-check/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { complianceCheckForCampaign } from '@/shared/services/voip/voip-routing.service'
import { verifyCloudtalkWebhookSecret } from '@/shared/services/providers/cloudtalk/lib/verify-webhook-secret'

const bodySchema = z.object({
  customer_id: z.string().uuid(),
  phone_e164: z.string().regex(/^\+[1-9]\d{6,14}$/),
})

export async function POST(req: Request) {
  if (!verifyCloudtalkWebhookSecret(req.url)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    // Soft-fail to allowed per seam §1 row 3 — app-side gate is canonical, this is defense-in-depth.
    return NextResponse.json({ allowed: true })
  }

  const result = await complianceCheckForCampaign(SYSTEM_CONTEXT, parsed.data)
  if (!result.success) return NextResponse.json({ allowed: true })  // soft-fail
  return NextResponse.json(result.data)
}
```

- [ ] **Step 28.5: Document the URLs for voip-campaigns Phase 0**

Append to `docs/plans/voip-in-house/twilio-console-config.md` (or create a dedicated `voip-routing-endpoints.md`):

```markdown
## voip routing endpoints (consumed by CloudTalk Call Flow Designer)

| Endpoint | URL | Method | Auth | Response on error |
|---|---|---|---|---|
| caller-lookup    | `https://voip.triprosremodeling.com/api/voip/routing/caller-lookup?secret=$CLOUDTALK_WEBHOOK_SECRET`    | POST | shared-secret query param | `{customer_id: null}` (soft-fail) |
| transfer-target  | `https://voip.triprosremodeling.com/api/voip/routing/transfer-target?secret=$CLOUDTALK_WEBHOOK_SECRET`  | POST | shared-secret query param | `{target_e164: null, reason: 'no_human_available'}` |
| compliance-check | `https://voip.triprosremodeling.com/api/voip/routing/compliance-check?secret=$CLOUDTALK_WEBHOOK_SECRET` | POST | shared-secret query param | `{allowed: true}` (soft-fail; app-side gate is canonical) |

CloudTalk Call Flow Designer must configure FALLBACK BRANCHES per INTEGRATION-SEAM.md §1 for every HTTP Request that calls these endpoints.
```

- [ ] **Step 28.6: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/app/api/voip/routing/ docs/plans/voip-in-house/
git commit -m "feat(voip): replace mocked voip routing endpoints with real impls (caller-lookup, transfer-target, compliance-check)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 29: Tokenized-link consume route

**Files:**
- Create: `src/app/api/voip/links/[token]/route.ts`
- Create: `src/app/(frontend)/d/upload/[slot]/page.tsx` — Phase 1 stub L-DOC landing page

- [ ] **Step 29.1: `route.ts` — validate + redirect**

```ts
// src/app/api/voip/links/[token]/route.ts
import { NextResponse } from 'next/server'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { consumeToken } from '@/shared/services/voip/voip-link-tokens.service'

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const result = await consumeToken(SYSTEM_CONTEXT, token)
  if (!result.success) {
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
  switch (result.data.kind) {
    case 'ok': {
      // Route by token type
      const t = result.data.token
      if (t.type === 'l_doc') {
        const payload = t.payload as { type: 'l_doc', uploadSlotId: string }
        return NextResponse.redirect(new URL(`/d/upload/${payload.uploadSlotId}`, _req.url), 302)
      }
      // Future types fall here; for Phase 1, return a generic ack
      return NextResponse.json({ ok: true, type: t.type })
    }
    case 'expired':
      return NextResponse.json({ error: 'expired' }, { status: 410 })
    case 'already_used':
      return NextResponse.json({ error: 'already_used' }, { status: 410 })
    case 'not_found':
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
}
```

- [ ] **Step 29.2: `/d/upload/[slot]/page.tsx` — Phase 1 stub**

```tsx
// src/app/(frontend)/d/upload/[slot]/page.tsx
interface PageProps { params: Promise<{ slot: string }> }

export default async function UploadStubPage({ params }: PageProps) {
  const { slot } = await params
  return (
    <main className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-xl font-semibold">Upload landing — Phase 2</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Your document upload link (slot <code>{slot}</code>) is validated. The full upload UI ships in voip-in-house Phase 2.
      </p>
      <p className="mt-6 text-xs text-muted-foreground">
        If you reached this page in error, please reply to the message you received from Tri Pros Remodeling.
      </p>
    </main>
  )
}
```

> Phase 2 replaces this stub with a real upload UI (R2 multipart, file preview, allowed types). The L-DOC plumbing (mint → SMS-send → validate → consume) is what Phase 1 ships and verifies.

- [ ] **Step 29.3: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/app/api/voip/links/ src/app/\(frontend\)/d/
git commit -m "feat(voip): add tokenized-link consume route + L-DOC Phase-1 stub page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 30: tRPC routers — wire each entity via `createEntityRouter` + business sub-routers

**Files:**
- Create: `src/trpc/routers/voip-calls.router/index.ts` (imports spec from `entities/voip-calls/lib/server-spec.ts`, Task 12)
- Create: `src/trpc/routers/voip-messages.router/index.ts`
- Create: `src/trpc/routers/voip-dids.router/index.ts`
- Create: `src/trpc/routers/voip-dnc.router/index.ts`
- Create: `src/trpc/routers/voip-link-tokens.router.ts`
- Create: `src/trpc/routers/voip-user-availability.router.ts`
- Create: `src/trpc/routers/app-settings.router.ts`
- Modify: `src/trpc/routers/app.ts` — register all 7 routers

> Use the entity-factory pattern from [`src/trpc/DOCS.md`](../../../src/trpc/DOCS.md). Read [`src/trpc/routers/proposals.router/index.ts`](../../../src/trpc/routers/proposals.router/index.ts) for the canonical wire-up before writing.

- [ ] **Step 30.1: `voip-calls.router/index.ts`**

```ts
// src/trpc/routers/voip-calls.router/index.ts
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter } from '@/trpc/init'
import { createCrudRouter } from '@/trpc/lib/create-crud-router'
import { createEntityRouter } from '@/trpc/lib/create-entity-router'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'
import { voipCallDispositions } from '@/shared/constants/enums'
import { placeAgentCall, setDisposition } from '@/shared/services/voip/voip-calls.service'
import { listByCustomerId, listRecent } from '@/shared/entities/voip-calls/dal/server/queries'
import { voipCallSchemas, voipCallServerSpec } from '@/shared/entities/voip-calls/lib/server-spec'

export const voipCallsRouter = createEntityRouter(voipCallServerSpec, (entity) => createTRPCRouter({
  crud: createCrudRouter({
    spec: voipCallServerSpec,
    schemas: { ...voipCallSchemas, id: z.string().uuid() },
    authedProcedure: entity.authedProcedure,
    shareableProcedure: entity.shareableProcedure,
  }),
  business: createTRPCRouter({
    placeAgentCall: entity.authedProcedure
      .input(z.object({ customerId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        return dalToTrpc(await placeAgentCall(ctx, { customerId: input.customerId, agentUserId: ctx.session.user.id }))
      }),

    setDisposition: entity.authedProcedure
      .input(z.object({
        voipCallId: z.string().uuid(),
        disposition: z.enum(voipCallDispositions),
        note: z.string().max(1000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return dalToTrpc(await setDisposition(ctx, input))
      }),

    listRecent: entity.authedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
      .query(async ({ ctx, input }) => dalToTrpc(await listRecent(ctx, input.limit))),

    listByCustomer: entity.authedProcedure
      .input(z.object({ customerId: z.string().uuid(), limit: z.number().int().min(1).max(200).default(50) }))
      .query(async ({ ctx, input }) => dalToTrpc(await listByCustomerId(ctx, input.customerId))),
  }),
}))
```

- [ ] **Step 30.2: `voip-messages.router/index.ts`**

Same shape; expose `send`, `listByCustomer` via business sub-router. The send mutation:

```ts
send: entity.authedProcedure
  .input(z.object({ customerId: z.string().uuid(), body: z.string().min(1).max(1600) }))
  .mutation(async ({ ctx, input }) => {
    return dalToTrpc(await sendManualSms(ctx, {
      customerId: input.customerId,
      body: input.body,
      agentUserId: ctx.session.user.id,
    }))
  }),
```

- [ ] **Step 30.3: `voip-dids.router/index.ts`**

CRUD-only via the factory; no extra business routes in Phase 1 (admin UI for assignment lands in Phase 4).

- [ ] **Step 30.4: `voip-dnc.router/index.ts`**

CRUD + `recordManual` business mutation:

```ts
recordManual: entity.authedProcedure
  .input(z.object({ phoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/), reason: z.string().max(500) }))
  .mutation(async ({ ctx, input }) => {
    return dalToTrpc(await recordDnc(ctx, {
      phoneE164: input.phoneE164,
      source: 'manual_admin',
      reason: input.reason,
      addedByUserId: ctx.session.user.id,
    }))
  }),
```

- [ ] **Step 30.5: `voip-link-tokens.router.ts`**

```ts
// src/trpc/routers/voip-link-tokens.router.ts
import { z } from 'zod'
import { createTRPCRouter } from '@/trpc/init'
import { agentProcedure } from '@/trpc/init'  // adapt import path
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'
import { mintToken } from '@/shared/services/voip/voip-link-tokens.service'

export const voipLinkTokensRouter = createTRPCRouter({
  mintLDoc: agentProcedure
    .input(z.object({
      customerId: z.string().uuid(),
      phoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/),
      uploadSlotId: z.string().uuid(),
      instructions: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return dalToTrpc(await mintToken(ctx, {
        customerId: input.customerId,
        phoneE164: input.phoneE164,
        payload: {
          type: 'l_doc',
          uploadSlotId: input.uploadSlotId,
          instructions: input.instructions,
        },
        createdByUserId: ctx.session.user.id,
      }))
    }),
})
```

> The router is a thin flat router (not an entity router) because mint mostly is a service operation. Future variants (`mintLPay`, etc.) add mutations here.

- [ ] **Step 30.6: `voip-user-availability.router.ts`**

```ts
export const voipUserAvailabilityRouter = createTRPCRouter({
  getMine: agentProcedure.query(async ({ ctx }) =>
    dalToTrpc(await findByUserId(ctx, ctx.session.user.id))
  ),
  upsertMine: agentProcedure
    .input(z.object({
      enrolledForTransfers: z.boolean(),
      manualStatus: z.enum(voipUserAvailabilities),
      transferMode: z.enum(voipTransferModes),
      cellPhoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) =>
      dalToTrpc(await upsertAvailability(ctx, { userId: ctx.session.user.id, ...input }))
    ),
  listAvailable: agentProcedure.query(async ({ ctx }) =>
    dalToTrpc(await listAvailableTransferHumans(ctx))
  ),
})
```

- [ ] **Step 30.7: `app-settings.router.ts`**

```ts
export const appSettingsRouter = createTRPCRouter({
  getByFeature: agentProcedure
    .input(z.object({ feature: z.string() }))
    .query(async ({ ctx, input }) => dalToTrpc(await getByFeature(ctx, input.feature))),

  update: agentProcedure
    .input(z.object({ feature: z.string(), configJson: z.unknown() }))
    .mutation(async ({ ctx, input }) => {
      // Per-feature validation in service-layer wrapper (e.g., validateVoipInHouseConfig).
      // CASL gate (in entity ServerSpec): super-admin only.
      return dalToTrpc(await upsertConfig(ctx, { feature: input.feature, configJson: input.configJson, updatedByUserId: ctx.session.user.id }))
    }),
})
```

- [ ] **Step 30.8: Register all in `app.ts`**

```ts
import { voipCallsRouter } from './voip-calls.router'
import { voipMessagesRouter } from './voip-messages.router'
import { voipDidsRouter } from './voip-dids.router'
import { voipDncRouter } from './voip-dnc.router'
import { voipLinkTokensRouter } from './voip-link-tokens.router'
import { voipUserAvailabilityRouter } from './voip-user-availability.router'
import { appSettingsRouter } from './app-settings.router'

export const appRouter = createTRPCRouter({
  // ...existing
  voipCalls: voipCallsRouter,
  voipMessages: voipMessagesRouter,
  voipDids: voipDidsRouter,
  voipDnc: voipDncRouter,
  voipLinkTokens: voipLinkTokensRouter,
  voipUserAvailability: voipUserAvailabilityRouter,
  appSettings: appSettingsRouter,
})
```

- [ ] **Step 30.9: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/trpc/routers/
git commit -m "feat(voip): wire all voip + app-settings tRPC routers (entity factory + business sub-routers)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 31: ESLint `no-restricted-imports` rule (dependency-direction enforcement)

**Files:**
- Modify: `eslint.config.js` (or whatever the project's eslint config file is — read first)

> Enforces the dependency direction from [INTEGRATION-SEAM.md "Dependency direction"](../voip/INTEGRATION-SEAM.md#dependency-direction):
> - Top-level `services/voip/*.ts` may NOT import `services/voip/campaigns/*` or `providers/cloudtalk/*`.
> - `providers/twilio/*` may NOT import any `services/*` or any DAL.
>
> This guards the cross-EPIC boundary at lint time so accidental coupling can't ship.

- [ ] **Step 31.1: Add the rule**

Read `eslint.config.js` first. Then add a `no-restricted-imports` override using ESLint flat-config `files: [...]` patterns:

```js
// Inside eslint.config.js (flat config; merge with existing structure)
{
  files: ['src/shared/services/voip/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['**/services/voip/campaigns/**', '@/shared/services/voip/campaigns/**'],
          message: 'Top-level services/voip/*.ts cannot depend on services/voip/campaigns/* — voip-campaigns is the dependent. See docs/plans/voip/INTEGRATION-SEAM.md#dependency-direction',
        },
        {
          group: ['**/providers/cloudtalk/**', '@/shared/services/providers/cloudtalk/**'],
          message: 'Top-level services/voip/*.ts cannot depend on providers/cloudtalk/* — CloudTalk is voip-campaigns territory. See docs/plans/voip/INTEGRATION-SEAM.md#dependency-direction',
        },
      ],
    }],
  },
},
{
  files: ['src/shared/services/providers/twilio/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['**/services/**', '@/shared/services/**', '**/dal/**', '@/shared/dal/**', '**/entities/**', '@/shared/entities/**'],
          message: 'providers/twilio/* must not import services, DAL, or entities. Providers are leaf nodes — see docs/codebase-conventions/service-architecture.md',
        },
      ],
    }],
  },
},
```

> When `services/voip/campaigns/` and `providers/cloudtalk/` actually land in voip-campaigns Phase 1, the rule already enforces direction. Until then it's a future-proofing guard against accidental import paths in this EPIC's code.

- [ ] **Step 31.2: Verify the rule fires**

Add a temp test import in `src/shared/services/voip/voip-calls.service.ts`:

```ts
// TEMP — verify ESLint rule fires
// import { something } from '@/shared/services/voip/campaigns/enrollment.service'
```

Uncomment, run `pnpm lint` → expect the `no-restricted-imports` error pointing to INTEGRATION-SEAM.md. Re-comment, lint clean. Discard the temp edit.

- [ ] **Step 31.3: Commit**

```bash
pnpm tsc && pnpm lint
git add eslint.config.js
git commit -m "chore(voip): add no-restricted-imports rule enforcing voip dependency direction

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 32: Browser softphone widget

**Files:**
- Create: `src/features/voip-in-house/ui/components/softphone-widget/twilio-device-provider.tsx`
- Create: `src/features/voip-in-house/ui/components/softphone-widget/use-twilio-device.ts`
- Create: `src/features/voip-in-house/ui/components/softphone-widget/use-softphone-token.ts`
- Create: `src/features/voip-in-house/ui/components/softphone-widget/softphone-widget.tsx`
- Create: `src/features/voip-in-house/ui/components/softphone-widget/incoming-call-banner.tsx`
- Create: `src/features/voip-in-house/ui/components/softphone-widget/call-active-panel.tsx`

> Lives under `features/voip-in-house/` (NOT `shared/components/`) because the dashboard layout is the only consumer in Phase 1. If a second feature mounts it later, promote to `shared/components/` per Rule 21. Each file = ONE component (Rule 1). NO file-level constants in component files (Rule 2). Named exports only (Rule 9).

- [ ] **Step 32.1: `use-softphone-token.ts` — token fetcher + auto-refresh**

```ts
'use client'
import { useEffect, useState } from 'react'

interface TokenPayload { token: string, identity: string, ttlSeconds: number }

export function useSoftphoneToken() {
  const [token, setToken] = useState<TokenPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    async function refresh() {
      const res = await fetch('/api/voip/softphone/access-token', { cache: 'no-store' })
      if (!res.ok) return
      if (cancelled) return
      setToken(await res.json() as TokenPayload)
    }
    refresh()
    const interval = setInterval(refresh, 50 * 60 * 1000)  // refresh every 50 min
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return token
}
```

- [ ] **Step 32.2: `use-twilio-device.ts`**

```ts
'use client'
import { Call, Device } from '@twilio/voice-sdk'
import { useEffect, useRef, useState } from 'react'

export interface IncomingCallSummary {
  call: Call
  customParameters: Record<string, string>
  from: string
}

export interface ActiveCallSummary {
  call: Call
  customParameters: Record<string, string>
  voipCallId: string | null
}

export function useTwilioDevice(token: string | null) {
  const deviceRef = useRef<Device | null>(null)
  const [status, setStatus] = useState<'idle' | 'registering' | 'registered' | 'error'>('idle')
  const [incomingCall, setIncomingCall] = useState<IncomingCallSummary | null>(null)
  const [activeCall, setActiveCall] = useState<ActiveCallSummary | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    const device = new Device(token, { logLevel: 1, allowIncomingWhileBusy: false })
    deviceRef.current = device
    setStatus('registering')

    device.on('registered', () => setStatus('registered'))
    device.on('error', (err: Error) => { setStatus('error'); setErrorMessage(err.message) })
    device.on('incoming', (call: Call) => {
      const customParameters: Record<string, string> = {}
      call.customParameters.forEach((v, k) => { customParameters[k] = v })
      setIncomingCall({ call, customParameters, from: call.parameters.From ?? '' })

      call.on('accept', () => {
        setActiveCall({ call, customParameters, voipCallId: customParameters.voip_call_id ?? null })
        setIncomingCall(null)
      })
      call.on('cancel', () => setIncomingCall(null))
      call.on('reject', () => setIncomingCall(null))
      call.on('disconnect', () => { setActiveCall(null); setIncomingCall(null) })
    })

    device.register()
    return () => { device.destroy() }
  }, [token])

  return {
    status,
    incomingCall,
    activeCall,
    errorMessage,
    accept: () => incomingCall?.call.accept(),
    reject: () => incomingCall?.call.reject(),
    hangup: () => activeCall?.call.disconnect(),
    setMute: (muted: boolean) => activeCall?.call.mute(muted),
  }
}
```

- [ ] **Step 32.3: `twilio-device-provider.tsx`**

```tsx
'use client'
import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'
import { useSoftphoneToken } from './use-softphone-token'
import { useTwilioDevice } from './use-twilio-device'

type DeviceContextValue = ReturnType<typeof useTwilioDevice>
const DeviceContext = createContext<DeviceContextValue | null>(null)

interface Props { children: ReactNode }

export function TwilioDeviceProvider({ children }: Props) {
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

- [ ] **Step 32.4: `incoming-call-banner.tsx`**

```tsx
'use client'
import { Button } from '@/shared/components/ui/button'
import { useTwilioDeviceContext } from './twilio-device-provider'

interface Props { onAccept?: () => void }

export function IncomingCallBanner({ onAccept }: Props) {
  const { incomingCall, accept, reject } = useTwilioDeviceContext()
  if (!incomingCall) return null

  const params = incomingCall.customParameters
  const leadName = params.lead_name ?? 'Unknown caller'
  const trade = params.trade ?? ''
  const city = params.city ?? params.location ?? ''

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg border bg-background p-4 shadow-lg" aria-label="Incoming call">
      <div className="text-sm font-medium">Incoming</div>
      <div className="mt-1 text-lg">{leadName}</div>
      {(trade || city) && (
        <div className="text-xs text-muted-foreground">{[trade, city].filter(Boolean).join(' • ')}</div>
      )}
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => { accept(); onAccept?.() }}>Accept</Button>
        <Button size="sm" variant="outline" onClick={reject}>Decline</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 32.5: `call-active-panel.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { useTwilioDeviceContext } from './twilio-device-provider'

export function CallActivePanel() {
  const { activeCall, hangup, setMute } = useTwilioDeviceContext()
  const [muted, setMuted] = useState(false)
  if (!activeCall) return null

  function toggleMute() {
    setMute(!muted)
    setMuted(m => !m)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg border bg-background p-4 shadow-lg" aria-label="Active call">
      <div className="text-sm font-medium">On call</div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</Button>
        <Button size="sm" variant="destructive" onClick={hangup}>Hang up</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 32.6: `softphone-widget.tsx` — composition**

```tsx
'use client'
import { useState } from 'react'
import { CallDispositionPicker } from '@/features/voip-in-house/ui/components/call-disposition-picker/call-disposition-picker'
import { CallActivePanel } from './call-active-panel'
import { IncomingCallBanner } from './incoming-call-banner'
import { TwilioDeviceProvider, useTwilioDeviceContext } from './twilio-device-provider'

function WidgetInner() {
  const { incomingCall, activeCall } = useTwilioDeviceContext()
  const [pendingDispositionForCallId, setPendingDispositionForCallId] = useState<string | null>(null)

  function handleAccept() {
    if (activeCall?.voipCallId) setPendingDispositionForCallId(activeCall.voipCallId)
  }
  function handleClose() {
    setPendingDispositionForCallId(null)
  }

  return (
    <>
      {incomingCall && <IncomingCallBanner onAccept={handleAccept} />}
      {activeCall && <CallActivePanel />}
      {pendingDispositionForCallId && !activeCall && (
        <CallDispositionPicker voipCallId={pendingDispositionForCallId} onClose={handleClose} />
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

- [ ] **Step 32.7: Public entrypoint**

Create TWO entrypoints per Rule 10 (verified pattern: existing features have `ui/components/index.ts` AND `ui/views/index.ts` separately — never a single top-level `ui/index.ts`):

```ts
// src/features/voip-in-house/ui/components/index.ts
export { SoftphoneWidget } from './softphone-widget/softphone-widget'
export { CallNowButton } from './call-now-button/call-now-button'
export { SendMessageButton } from './send-message-button/send-message-button'
```

```ts
// src/features/voip-in-house/ui/views/index.ts
export { VoipInHouseAdminView } from './voip-in-house-admin-view'
```

- [ ] **Step 32.8: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/features/voip-in-house/
git commit -m "feat(voip): browser softphone widget (Twilio Voice JS SDK)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 33: Call-disposition picker + click-to-call + send-SMS components

**Files:**
- Create: `src/features/voip-in-house/ui/components/call-disposition-picker/call-disposition-picker.tsx`
- Create: `src/features/voip-in-house/ui/components/call-disposition-picker/constants.ts` (per Rule 2 — extract file-level constants)
- Create: `src/features/voip-in-house/ui/components/call-now-button/call-now-button.tsx`
- Create: `src/features/voip-in-house/ui/components/send-message-button/send-message-button.tsx`

- [ ] **Step 33.1: Disposition picker constants**

```ts
// src/features/voip-in-house/ui/components/call-disposition-picker/constants.ts
import type { VoipCallDisposition } from '@/shared/constants/enums'

export interface DispositionOption {
  value: VoipCallDisposition
  label: string
  variant?: 'default' | 'outline' | 'destructive'
}

export const dispositionOptions: DispositionOption[] = [
  { value: 'booked_meeting', label: 'Booked meeting' },
  { value: 'callback_scheduled', label: 'Callback scheduled', variant: 'outline' },
  { value: 'interested_not_now', label: 'Interested, not now', variant: 'outline' },
  { value: 'not_interested', label: 'Not interested', variant: 'outline' },
  { value: 'wrong_number', label: 'Wrong number', variant: 'outline' },
  { value: 'voicemail_left', label: 'Voicemail left', variant: 'outline' },
  { value: 'unreached', label: 'Unreached', variant: 'outline' },
  { value: 'opt_out', label: 'Opt-out — DNC', variant: 'destructive' },
]
```

- [ ] **Step 33.2: Disposition picker component**

```tsx
'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { useTRPC } from '@/trpc/helpers'
import { dispositionOptions } from './constants'

interface Props {
  voipCallId: string
  onClose: () => void
}

export function CallDispositionPicker({ voipCallId, onClose }: Props) {
  const trpc = useTRPC()
  const mutation = useMutation(trpc.voipCalls.business.setDisposition.mutationOptions({
    onSuccess: () => onClose(),
  }))
  const [submitting, setSubmitting] = useState(false)

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disposition the call</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-2">
          {dispositionOptions.map(opt => (
            <Button
              key={opt.value}
              className="w-full justify-start"
              variant={opt.variant ?? 'default'}
              disabled={submitting || mutation.isPending}
              onClick={() => { setSubmitting(true); mutation.mutate({ voipCallId, disposition: opt.value }) }}
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

- [ ] **Step 33.3: `call-now-button.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/shared/components/ui/button'
import { useTRPC } from '@/trpc/helpers'

interface Props { customerId: string }

export function CallNowButton({ customerId }: Props) {
  const trpc = useTRPC()
  const [confirmPending, setConfirmPending] = useState(false)
  const placeCall = useMutation(trpc.voipCalls.business.placeAgentCall.mutationOptions({
    onSuccess: () => setConfirmPending(false),
  }))

  function handleClick() {
    if (!confirmPending) {
      setConfirmPending(true)
      setTimeout(() => setConfirmPending(false), 3000)
      return
    }
    placeCall.mutate({ customerId })
  }

  return (
    <Button
      size="sm"
      variant={confirmPending ? 'destructive' : 'default'}
      onClick={handleClick}
      disabled={placeCall.isPending}
    >
      {placeCall.isPending
        ? 'Calling…'
        : confirmPending ? 'Confirm — Call now' : 'Call'}
    </Button>
  )
}
```

> No "Dial now (AI)" copy — this is an agent click-to-call to a customer, not an AI dial. AI dialing is voip-campaigns territory.

- [ ] **Step 33.4: `send-message-button.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { Textarea } from '@/shared/components/ui/textarea'
import { useTRPC } from '@/trpc/helpers'

interface Props { customerId: string }

export function SendMessageButton({ customerId }: Props) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const trpc = useTRPC()
  const send = useMutation(trpc.voipMessages.business.send.mutationOptions({
    onSuccess: () => { setOpen(false); setBody('') },
  }))

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Send SMS</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send SMS</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Type your message…"
              maxLength={1600}
            />
            <Button onClick={() => send.mutate({ customerId, body })} disabled={!body.trim() || send.isPending}>
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

- [ ] **Step 33.5: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/features/voip-in-house/ui/components/
git commit -m "feat(voip): add disposition picker + call-now + send-SMS components

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 34: Mount softphone + ship admin view + route

**Files:**
- Modify: `src/app/(frontend)/dashboard/layout.tsx`
- Create: `src/features/voip-in-house/ui/views/voip-in-house-admin-view.tsx`
- Create: `src/app/(frontend)/dashboard/voip-in-house/page.tsx`

> Reminder: dashboard path is `dashboard/`, not `(dashboard)/`. The old plan + EPIC.md had this wrong.

- [ ] **Step 34.1: Mount softphone widget globally**

Read `src/app/(frontend)/dashboard/layout.tsx` first. Add the import + render the widget outside the main content tree (so it persists across route changes):

```tsx
import { SoftphoneWidget } from '@/features/voip-in-house/ui/components'

// Inside the layout JSX, after the main page tree:
<SoftphoneWidget />
```

The widget self-mounts via `TwilioDeviceProvider` and silently no-ops if `/api/voip/softphone/access-token` returns 401 (unauthenticated user).

- [ ] **Step 34.2: Admin view**

```tsx
// src/features/voip-in-house/ui/views/voip-in-house-admin-view.tsx
'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { useTRPC } from '@/trpc/helpers'
import { CallNowButton } from '../components/call-now-button/call-now-button'
import { SendMessageButton } from '../components/send-message-button/send-message-button'

export function VoipInHouseAdminView() {
  const [customerId, setCustomerId] = useState('')
  const trpc = useTRPC()
  const recentCalls = useQuery(trpc.voipCalls.business.listRecent.queryOptions({ limit: 20 }))

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">VoIP — In-house (Phase 1)</h1>
        <p className="text-sm text-muted-foreground">
          Test surface: click-to-call + send-SMS to a customer + recent activity. Super-admin only.
          With <code>VOIP_DEV_OVERRIDE_NUMBER</code> set in dev, all outbound is routed to your test phone.
        </p>
      </header>

      <Card className="p-4">
        <h2 className="font-semibold">Try it</h2>
        <p className="mt-1 text-sm text-muted-foreground">Paste a customer ID to dial them.</p>
        <div className="mt-3 flex items-center gap-2">
          <Input
            placeholder="Customer ID (UUID)"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
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
        <h2 className="font-semibold">Recent calls</h2>
        {recentCalls.isLoading && <p className="text-sm">Loading…</p>}
        {recentCalls.data && recentCalls.data.length === 0 && (
          <p className="text-sm text-muted-foreground">No calls yet.</p>
        )}
        {recentCalls.data && recentCalls.data.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {recentCalls.data.map(c => (
              <li key={c.id} className="border-b py-1">
                <span className="font-mono text-xs">{c.id.slice(0, 8)}</span>{' '}
                <span>{c.source}</span>{' '}<span>{c.status}</span>{' '}
                {c.disposition && <span>→ {c.disposition}</span>}{' '}
                <span className="text-muted-foreground">{c.initiatedAt}</span>
                {c.recordingUrl && (
                  <a href={c.recordingUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs underline">
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

- [ ] **Step 34.3: Route**

```tsx
// src/app/(frontend)/dashboard/voip-in-house/page.tsx
import { VoipInHouseAdminView } from '@/features/voip-in-house/ui/views'

export default function VoipInHousePage() {
  return <VoipInHouseAdminView />
}
```

- [ ] **Step 34.4: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/app/\(frontend\)/dashboard/layout.tsx \
  src/app/\(frontend\)/dashboard/voip-in-house/ \
  src/features/voip-in-house/ui/views/
git commit -m "feat(voip): mount softphone in dashboard + admin view + route

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 35: Seed scripts (DIDs + app-settings + example lead-source voipConfig)

**Files:**
- Create: `scripts/seed-voip-dids.ts`
- Create: `scripts/seed-app-settings-voip.ts`
- Create: `scripts/configure-lead-source-voip.ts`

> Use `import './lib/load-env'` (NOT `'dotenv/config'`) per memory `feedback-scripts-load-env.md`. Run via `pnpm tsx scripts/<name>.ts`.

- [ ] **Step 35.1: `seed-voip-dids.ts`**

```ts
import './lib/load-env'
import { db } from '@/shared/db'
import { voipDids } from '@/shared/db/schema'
import env from '@/shared/config/server-env'

interface DidSeed {
  e164: string
  twilioSid: string
  role: 'transfer_target' | 'agent_outbound'
  assignedUserId: string | null
}

const SEEDS: DidSeed[] = [
  // The transfer-target DID (CloudTalk warm-transfers land here + general inbound during pilot).
  {
    e164: env.TWILIO_TRANSFER_TARGET_DID_E164,
    twilioSid: env.TWILIO_TRANSFER_TARGET_DID_SID,
    role: 'transfer_target',
    assignedUserId: null,
  },
  // Per-agent outbound DIDs (Phase 1: unassigned; assign via Phase 4 admin UI when 2nd agent onboards).
  {
    e164: env.TWILIO_DID_424_E164,
    twilioSid: env.TWILIO_DID_424_SID,
    role: 'agent_outbound',
    assignedUserId: process.env.SEED_AGENT_USER_ID ?? null,  // optional: pin to a user during dev
  },
  {
    e164: env.TWILIO_DID_626_E164,
    twilioSid: env.TWILIO_DID_626_SID,
    role: 'agent_outbound',
    assignedUserId: null,
  },
]

function areaCode(e164: string) { return e164.slice(2, 5) }

async function main() {
  // eslint-disable-next-line no-console
  console.log('Seeding voip_dids…')
  for (const s of SEEDS) {
    await db.insert(voipDids).values({
      source: 'in_house',
      e164Number: s.e164,
      areaCode: areaCode(s.e164),
      twilioPhoneSid: s.twilioSid,
      role: s.role,
      status: 'active',
      assignedUserId: s.assignedUserId,
    }).onConflictDoNothing({ target: voipDids.e164Number })
  }
  // eslint-disable-next-line no-console
  console.log(`Inserted ${SEEDS.length} DIDs (skipped duplicates).`)
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 35.2: `seed-app-settings-voip.ts`**

```ts
import './lib/load-env'
import { db } from '@/shared/db'
import { appSettings } from '@/shared/db/schema'
import { DEFAULT_VOIP_IN_HOUSE_CONFIG } from '@/shared/entities/app-settings/schemas/voip-in-house-config-schema'

const ADMIN_USER_ID = process.env.SEED_ADMIN_USER_ID

async function main() {
  if (!ADMIN_USER_ID) {
    // eslint-disable-next-line no-console
    console.error('SEED_ADMIN_USER_ID env var required'); process.exit(1)
  }
  // eslint-disable-next-line no-console
  console.log('Seeding app_settings(feature=voip-in-house)…')
  await db.insert(appSettings).values({
    feature: 'voip-in-house',
    configJson: DEFAULT_VOIP_IN_HOUSE_CONFIG,
    updatedByUserId: ADMIN_USER_ID,
  }).onConflictDoNothing({ target: appSettings.feature })
  // eslint-disable-next-line no-console
  console.log('Done.')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 35.3: `configure-lead-source-voip.ts`**

```ts
import './lib/load-env'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { leadSourcesTable } from '@/shared/db/schema'
import type { LeadSourceVoipConfig } from '@/shared/entities/lead-sources/schemas/voip-config-schema'

const LEAD_SOURCE_SLUG = 'meta-roofing-ad'  // edit before running

const CONFIG: LeadSourceVoipConfig = {
  inHouse: {
    enabled: true,
    transactionalSmsTemplates: null,
    callingHoursOverride: null,
  },
  // voip-campaigns sub-object — stays disabled until voip-campaigns Phase 1
  campaigns: { enabled: false },
}

async function main() {
  const [src] = await db.select().from(leadSourcesTable).where(eq(leadSourcesTable.slug, LEAD_SOURCE_SLUG)).limit(1)
  if (!src) { console.error(`Lead source '${LEAD_SOURCE_SLUG}' not found`); process.exit(1) }

  await db.update(leadSourcesTable).set({ voipConfigJSON: CONFIG }).where(eq(leadSourcesTable.id, src.id))
  // eslint-disable-next-line no-console
  console.log(`Configured lead source '${src.name}' (${src.id}) for in-house voip.`)
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 35.4: Run all three**

```bash
pnpm tsx scripts/seed-voip-dids.ts
pnpm tsx scripts/seed-app-settings-voip.ts
pnpm tsx scripts/configure-lead-source-voip.ts
```

Verify in DB: 3 rows in `voip_dids`, 1 row in `app_settings` keyed `'voip-in-house'`, target lead source has `voip_config_json` populated.

- [ ] **Step 35.5: Commit**

```bash
pnpm tsc && pnpm lint
git add scripts/seed-voip-dids.ts scripts/seed-app-settings-voip.ts scripts/configure-lead-source-voip.ts
git commit -m "chore(voip): add seed scripts (DIDs + app-settings + example lead-source voipConfig)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 36: End-to-end manual verification

> Run all checks in order. Any failure = task incomplete; fix + retry. **SMS-send verification (36.5) is gated by 10DLC Campaign approval** — defer that one substep until Twilio Console shows the campaign as approved.

- [ ] **Step 36.1: Pre-flight**

```bash
# Env vars present
echo "TWILIO_ACCOUNT_SID: ${TWILIO_ACCOUNT_SID:0:10}…"
echo "VOIP_WEBHOOK_BASE_URL: $VOIP_WEBHOOK_BASE_URL"
echo "VOIP_DEV_OVERRIDE_NUMBER: $VOIP_DEV_OVERRIDE_NUMBER"  # should be your test cell
echo "CLOUDTALK_WEBHOOK_SECRET: ${CLOUDTALK_WEBHOOK_SECRET:0:6}…"

# DB has seeds
psql "$DATABASE_DEV_URL" -c "SELECT count(*), array_agg(role) FROM voip_dids;"
psql "$DATABASE_DEV_URL" -c "SELECT feature FROM app_settings WHERE feature = 'voip-in-house';"

# Dev server (worktree port — check .env.local for PORT)
pnpm dev
# Open https://destined-emu-bold.ngrok-free.app/dashboard/voip-in-house (or your dev URL)
```

- [ ] **Step 36.2: Enroll yourself for transfers**

In dev DB:

```sql
INSERT INTO voip_user_availability (user_id, enrolled_for_transfers, manual_status, transfer_mode)
VALUES ('<your-user-id>', true, 'available', 'desktop')
ON CONFLICT (user_id) DO UPDATE
SET enrolled_for_transfers = true, manual_status = 'available', transfer_mode = 'desktop', updated_at = NOW();
```

Reload the dashboard. The softphone widget should silently register (no console errors). The Twilio Voice SDK will show `device.state === 'registered'` in the dev tools (check via `useTwilioDeviceContext()` returning `status: 'registered'`).

- [ ] **Step 36.3: Click-to-call**

In `/dashboard/voip-in-house`, paste a test customer's UUID and click **Call**, then **Confirm — Call now**.

**Expected:**
- Within 5s your test cell phone (the `VOIP_DEV_OVERRIDE_NUMBER`) rings.
- Pick up; audio bridges to the browser softphone (you hear yourself on both ends because both legs are your devices).
- Hang up either end → disposition modal opens.
- Click "Booked meeting" → modal closes.

```sql
SELECT id, source, status, disposition, twilio_call_sid, recording_url, did_used
FROM voip_calls ORDER BY initiated_at DESC LIMIT 1;
```

Expect: `source='in_house'`, terminal status, `disposition='booked_meeting'`, populated `twilio_call_sid`, `recording_url` populated within ~30s of hang-up.

- [ ] **Step 36.4: Block via kill switch**

```sql
UPDATE app_settings SET config_json = jsonb_set(config_json, '{globalKillSwitch}', 'true')
WHERE feature = 'voip-in-house';
```

Re-attempt the click-to-call. **Expected:** mutation rejects with `kill_switch_active`; no Twilio call; a `voip_calls` row inserted with `status='skipped_compliance'`, `skip_reason='kill_switch_active'`.

Reset:

```sql
UPDATE app_settings SET config_json = jsonb_set(config_json, '{globalKillSwitch}', 'false')
WHERE feature = 'voip-in-house';
```

- [ ] **Step 36.5: Send SMS (BLOCKED until 10DLC Campaign approved)**

Once `TWILIO_10DLC_CAMPAIGN_SID` is set:

In the admin view, click **Send SMS** on a customer, type a body, click Send. Expected: SMS arrives on test phone within 10s. `voip_messages` has a row with `direction='outbound'`, `source='in_house'`, populated `twilio_message_sid`, eventual `status='delivered'`.

- [ ] **Step 36.6: STOP handler**

Reply STOP from the test phone.

```sql
SELECT phone_e164, source, reason FROM voip_dnc ORDER BY added_at DESC LIMIT 3;
```

Expect: a row with `source='twilio_stop'`. Confirmation SMS arrives on test phone.

Next outbound attempt to the same phone → blocked via DNC gate (`reason: 'dnc'`).

- [ ] **Step 36.7: voip routing endpoints**

```bash
# caller-lookup
curl -X POST "https://voip.triprosremodeling.com/api/voip/routing/caller-lookup?secret=$CLOUDTALK_WEBHOOK_SECRET" \
  -H "content-type: application/json" \
  -d '{"caller_e164": "+1<test-customer-phone>"}'

# transfer-target
curl -X POST "https://voip.triprosremodeling.com/api/voip/routing/transfer-target?secret=$CLOUDTALK_WEBHOOK_SECRET" \
  -H "content-type: application/json" \
  -d '{"caller_e164": "+1...", "customer_id": "<uuid>"}'

# compliance-check (use a DNC'd phone from Step 36.6)
curl -X POST "https://voip.triprosremodeling.com/api/voip/routing/compliance-check?secret=$CLOUDTALK_WEBHOOK_SECRET" \
  -H "content-type: application/json" \
  -d '{"customer_id": "<uuid>", "phone_e164": "<DNC phone>"}'
```

Verify the response shapes match [INTEGRATION-SEAM.md §1](../voip/INTEGRATION-SEAM.md). Also verify a request with a wrong secret returns 403.

- [ ] **Step 36.8: Tokenized link**

Mint via tRPC (use the `/dashboard/voip-in-house` view's recent-calls panel as the harness — or open browser devtools and call `trpc.voipLinkTokens.mintLDoc.mutate(...)` manually). Open the returned URL in a private window:
- First visit → 302 redirect to `/d/upload/<slot>` (stub page renders).
- Second visit → `{"error":"already_used"}` with 410.
- Visit after 48h (or after manually setting `expires_at` in the past) → `{"error":"expired"}` with 410.

- [ ] **Step 36.9: Lint enforcement of dependency direction**

Run Task 31.2 procedure (temp import, lint fails with expected error message, remove temp). Confirms ESLint rule is firing.

- [ ] **Step 36.10: Final check**

```bash
pnpm tsc   # clean
pnpm lint  # clean
```

If all checks above pass → **Phase 1 is COMPLETE.**

Move to Task 37 (boundary verification gate) before signing off.

---

### Task 37: Phase 1 → voip-campaigns Phase 1 boundary verification

> Gate before voip-campaigns Phase 1 starts. Confirms the cross-EPIC seam is intact: the table shapes, the source-discriminator values, the voip routing contract, the DNC propagation surface — all match [INTEGRATION-SEAM.md](../voip/INTEGRATION-SEAM.md).

- [ ] **Step 37.1: `voip_dnc` schema matches seam §5**

```sql
-- Confirm source enum values match exactly
SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'voip_dnc_source')
ORDER BY enumlabel;
```

Expected output (sorted): `cloudtalk_stop`, `ftc`, `manual_admin`, `twilio_stop`, `voice_request`. If anything differs → fix the enum const array in `src/shared/constants/enums/voip.ts` + re-push schema.

- [ ] **Step 37.2: Forward-compat columns present on shared tables**

```sql
-- voip_calls — confirm cloudtalk forward-compat
SELECT column_name FROM information_schema.columns
WHERE table_name = 'voip_calls'
  AND column_name IN ('source', 'cloudtalk_call_uuid', 'campaign_id', 'transcript_summary', 'sentiment')
ORDER BY column_name;
-- Expected: all 5 present

-- voip_messages — confirm cloudtalk forward-compat
SELECT column_name FROM information_schema.columns
WHERE table_name = 'voip_messages'
  AND column_name IN ('source', 'cloudtalk_message_id', 'campaign_id', 'template_key')
ORDER BY column_name;
-- Expected: all 4 present

-- voip_dids — confirm source discriminator
SELECT column_name FROM information_schema.columns
WHERE table_name = 'voip_dids' AND column_name = 'source';
-- Expected: 1 row
```

- [ ] **Step 37.3: voip routing contract sanity (all 3 endpoints reachable + correct shape)**

Repeat the curls from Step 36.7 against the **production** `voip.triprosremodeling.com` host (NOT the ngrok URL) — voip-campaigns Phase 0 will configure CloudTalk against the prod URL. Document the production-host smoke-test responses in `docs/plans/voip-in-house/voip-routing-endpoints.md`.

- [ ] **Step 37.4: `voip_dnc` propagation contract**

Write a short integration contract doc at `docs/plans/voip-in-house/dnc-propagation-contract.md`:

```markdown
# DNC propagation contract (Phase 1 hand-off to voip-campaigns)

## Writers
- `services/voip/voip-messages.service.ts::recordInboundMessage` — STOP from Twilio inbound → source='twilio_stop'
- `services/voip/voip-dnc.service.ts::recordDnc` — manual admin (via tRPC) → source='manual_admin'
- Phase 2 cron: FTC DNC scrub → source='ftc'
- **voip-campaigns Phase 1** (sibling EPIC): CloudTalk webhook handler → source='cloudtalk_stop' or 'voice_request'

## Readers
- `services/voip/voip-compliance.service.ts::canOutboundTo` — gate before any in-house outbound (this EPIC)
- `services/voip/voip-routing.service.ts::complianceCheckForCampaign` — voip routing compliance-check endpoint (called by CloudTalk)
- **voip-campaigns Phase 1**: pre-enrollment guardrail in `enrollment.service.ts` + `dnc-propagation.service.ts` to push back to CloudTalk

## Invariants
- `voip_dnc.phone_e164` is UNIQUE — ON CONFLICT DO NOTHING.
- `cloudtalk_synced_at` is populated by voip-campaigns after pushing the entry to CloudTalk contact attribute.
  NULL for `source='cloudtalk_stop'` (no push needed — CloudTalk already honored it).
- Compliance gate reads the table directly on every send — no caching.
```

- [ ] **Step 37.5: Lint rule still enforced**

```bash
pnpm lint
# Expect: clean. The no-restricted-imports rule from Task 31 protects the seam.
```

- [ ] **Step 37.6: Update EPIC status**

In `docs/plans/voip-in-house/EPIC.md` phase status table: change Phase 1 row to `Done (YYYY-MM-DD)`. Add an entry to the Decisions log if any mid-implementation choices were made.

Sign-off: when this task is complete, **voip-campaigns Phase 0 can start** (CloudTalk procurement + dashboard configuration). voip-campaigns Phase 1 (the code work) is unblocked once its Phase 0 completes.

- [ ] **Step 37.7: Commit the seam docs**

```bash
git add docs/plans/voip-in-house/dnc-propagation-contract.md \
  docs/plans/voip-in-house/voip-routing-endpoints.md \
  docs/plans/voip-in-house/twilio-console-config.md \
  docs/plans/voip-in-house/EPIC.md
git commit -m "docs(voip): Phase 1 boundary verification + seam handoff to voip-campaigns

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 1 → Phase 2 handoff

When Phase 1 completes:

1. Update [EPIC.md](./EPIC.md) phase status table — Phase 1 → Done.
2. Verify `@migration: → Inngest` and `@migration: → Ably kernel` comments are placed (search: `grep -rn "@migration:" src/shared/services/voip/ src/shared/services/providers/twilio/`).
3. Write `phase-2-lifecycle-automation.md` per the stub already in place. Phase 2 scope: lifecycle SMS automation (meeting reminders, proposal links, project status), QStash-driven sends, calendar-aware quiet hours, FTC DNC scrub cron, recording auto-delete after `recordingRetentionDays`.

The system at end of Phase 1 supports **agent click-to-call** + **agent send-SMS** + **inbound STOP handling** + **voip routing endpoints for CloudTalk** + **L-DOC tokenized links**, all with full DNC + kill-switch gating. Phase 2 layers automated lifecycle SMS on top; Phase 3 adds mobile (cellular) mode; Phase 4 ships the admin observability + kill-switch UI; Phase 5 wires customer-side timeline integration.

