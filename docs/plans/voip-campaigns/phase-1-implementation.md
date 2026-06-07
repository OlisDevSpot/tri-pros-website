# voip-campaigns Phase 1 — Implementation Plan

> 🚨 **CORRECTION 2026-06-04 — PERFECT SEPARATION (read before trusting any section).**
> This plan was written around a **local campaign-status mirror** — a
> `voipCampaignStatus` enum/pgEnum decorating the `customers` row, fed by a
> `lifecycle-mapper.ts` and `lifecycle.service.ts#applyDisposition`, plus tag
> pushback to CloudTalk. **That entire model is removed.** Under perfect
> separation (voip-in-house EPIC "2026-05-30 total separation", confirmed
> 2026-06-04), CloudTalk is the **sole source of truth** for the lead-to-appointment
> lifecycle, including its own pipeline tags. We persist NO campaign status locally.
>
> **Deleted in code 2026-06-04:** `voipCampaignStatuses` const, `voipCampaignStatusEnum`
> pgEnum, `lifecycle-mapper.ts`. **Added:** `customers.voipCampaignAttempts` (the only
> campaign field on customers — a dial counter).
>
> **Update 2026-06-04 (grill):** that dial counter was moved OFF `customers` into
> `voip_campaign_contacts` (renamed from `voip_contact_sync`), which is now the single
> home for ALL per-customer CloudTalk state (CT identity + `enrolled_at`/`unenrolled_at`
> membership + `dial_attempts` + sync). `customers` carries NO `voipCampaign*` fields.
>
> **What voip-campaigns persists, full list:** `voip_campaigns` + `voip_contact_attributes`
> (CT identity bridges), `voip_campaign_contacts` (per-customer participation), and the
> shared `customers` DNC fields. Nothing else.
>
> **Sections W2 Migration 1 + W5 are corrected below.** Sections **W4 (enrollment),
> W6 (reconciliation), W7 (seed), W8 (UI), and the test plan still describe the dead
> status-mirror model and need redesign** — every `voipCampaignStatus` /
> `voipCampaignEnrolledAt` / `lead_intake_error` reference in those sections is STALE.
> See `HANDOFF-2026-06-04.md` for the corrected Section C scope.

> **Status:** Not started (this is the build plan)
> **Parent EPIC:** [EPIC.md](./EPIC.md)
> **Per-source content (Bina + HD locked):** [per-lead-source-content.md](./per-lead-source-content.md)
> **CT capability research (grounded):** [cloudtalk-api-research.md](./cloudtalk-api-research.md)
> **Phase 0 status:** Substantially designed; A2P 10DLC submitted (2-4 week processing clock); CT dashboard tasks ongoing
> **Cross-system contract:** [../voip/INTEGRATION-SEAM.md](../voip/INTEGRATION-SEAM.md)
> **Sibling EPIC:** [voip-in-house Phase 1](../voip-in-house/phase-1-mvp.md) — provides shared `services/voip/compliance.service.ts` that this EPIC's enrollment gate depends on. voip-in-house's `voip_calls` / `voip_messages` / `voip_dids` tables are NOT used by voip-campaigns (CT-side persistence is decoupled — see INTEGRATION-SEAM §8).

---

## Goal

Phase 1 ships the integration code: app pushes leads to CT Campaigns + consumes CT webhooks into normalized state + syncs attribute updates + handles bidirectional graduation + bidirectional DNC + reconciliation cron + holiday-pause cron + seeding backfill + admin UI surfaces + cost guardrails.

## Phase 1 gate (preconditions)

- [ ] CT Phase 0 dashboard work complete: DIDs labeled + assigned, agent group + Favorite Agent pattern verified, Campaigns configured per source (Smart Dialer + cadence + DIDs + SMS templates with merge fields), inbound VM greeting uploaded
- [ ] A2P 10DLC approved (SMS deliverability confirmed end-to-end via test) — Phase 1 code can ship without this gate, but **live launch waits**
- [ ] voip-in-house Phase 1 either shipped OR co-developed (provides `services/voip/compliance.service.ts` — the only voip-in-house surface this EPIC depends on; CT-side persistence is decoupled per INTEGRATION-SEAM §8)
- [ ] Q6-Q11 decisions locked + documented (DONE — see EPIC decisions log 2026-05-28/29)
- [ ] Per-lead-source content locked (DONE — Bina + HD)
- [ ] env vars in place: `CLOUDTALK_ACCESS_KEY_ID`, `CLOUDTALK_ACCESS_KEY_SECRET`, `CLOUDTALK_WEBHOOK_SECRET`, `VOIP_WEBHOOK_BASE_URL` (DONE — see `.env.voip.example`). **NOT needed (corrected 2026-05-31):** `CT_CAMPAIGN_*_ID` (live in `voip_campaigns` table) + `CT_FAVORITE_AGENT_ID_*` (Q3 inversion).
- [ ] Admin Resync from CloudTalk run at least once so `voip_campaigns` + `voip_contact_attributes` are populated (gate 9/10 in W4)

---

## Build sequence (dependency-ordered)

Workstreams stack in this order. Each unlocks the next. Total est: 8–12 working days for a single dev.

```
W1 Provider scaffolding  ┐
                         ├─→ W2c Campaign-sync service ──┐
W2 Schema migrations     ┘   (admin-triggered Resync     ├─→ W4 Enrollment service ─→ W7 Seeding backfill
                             populates voip_campaigns +  │                            └─→ W8 UI surfaces
                             voip_contact_attributes)    │
                         ├─→ W3 Webhook handler  ──────→ W6 Reconciliation cron
                         │                          └────→ W9 Holiday cron
                         └─→ W5 Lifecycle mapper ───────────────────────────→ (consumed by W3)
```

**Critical-path note (corrected 2026-05-31):** W4 enrollment now depends on W2c campaign-sync because CT campaign IDs + attribute IDs come from `voip_campaigns` + `voip_contact_attributes` tables (NOT env vars). Admin runs Resync once after Phase 0 dashboard config is done; W4 reads those tables at enrollment time. Without Resync, W4 fails gate 9/10 cleanly.

---

## W1 — Provider scaffolding (`src/shared/services/providers/cloudtalk/`)

**Goal:** the DAL-equivalent for CT's API. Everything else imports from here for CT calls.

**SDK strategy: hand-typed zod schemas** (LOCKED 2026-05-31). `@hey-api/openapi-ts` errors on CT's swagger (Probes 1–4 documented in `providers/cloudtalk/README.md`). For the Phase 1 ~12-endpoint surface, hand-typed wins. **Do not reinstall openapi-ts.**

**Directory shape (per ADR-0003 — no `dal/` subdir):**

```
src/shared/services/providers/cloudtalk/
├── client.ts                  ← HTTP Basic auth + base URL switching + 60/min rate-limit + envelope unwrap + .parse() integration
├── schemas/                   ← hand-typed zod schemas derived from swagger (sibling of lib/, per codebase convention)
│   ├── primitives.ts          ← E164, ISO8601, common shapes
│   ├── contact.ts             ← Contact / ContactSummary / ContactAttribute zod schemas
│   ├── call.ts                ← Call / CallList zod schemas
│   ├── sms.ts                 ← SmsSendRequest / SmsSendResponse zod schemas
│   ├── campaign.ts            ← Campaign / CampaignList zod schemas
│   ├── bulk.ts                ← Bulk operations envelope + per-action shapes
│   └── attribute.ts           ← Pre-defined ContactAttribute (definition, not value) zod schemas (currently lives inside contact.ts as `ctAttributesListResponseSchema`)
├── lib/                       ← grouped per-resource ops; import ../schemas/* + ../client
│   ├── types.ts               ← domain constants + consumer-shaped types + thin z.infer<> re-exports from ../schemas/*
│   ├── contacts.ts            ← upsert (PUT /contacts/add.json), find (GET /contacts/index.json),
│   │                            getById (GET /contacts/show/{id}.json), edit (POST /contacts/edit/{id}.json),
│   │                            addTags (PUT /contacts/addTags/{id}.json), removeTags (DELETE /contacts/removeTags/{id}.json)
│   ├── calls.ts               ← list (GET /calls/index.json), getById (GET /calls/{id}, no .json),
│   │                            recording (GET /calls/recording/{id}.json)
│   ├── sms.ts                 ← send (POST /sms/send.json). NO list — endpoint doesn't exist.
│   ├── campaigns.ts           ← list (GET /campaigns/index.json), setStatus (POST /campaigns/edit/{id}.json,
│   │                            { status: 'active' | 'inactive' }). NO enroll/unenroll/listMembers — don't exist.
│   ├── bulks.ts               ← batch (POST /bulk/contacts.json, ≤10 ops, actions: add_contact|edit_contact|delete_contact)
│   └── attributes.ts          ← list (GET /contacts/attributes.json) — used by campaign-sync.service for ID mirroring
├── webhooks/
│   └── events.ts              ← Zod discriminated union for the CT webhook events
│                                (as-built name; NO verify.ts — use cloudtalkClient.verifyWebhookSecret;
│                                 NO lifecycle-mapper.ts — deleted 2026-06-04, perfect separation)
├── constants/
│   └── pricing.ts             ← per-minute + per-SMS rate constants (for cost-tracking widget)
└── README.md                  ← provider conventions reminder + Probes 1–4 log + hand-typed rationale
```

### Steps

1. **Cache swagger** to `/tmp/ct-swagger.json` for hand-derivation reference. Do NOT install codegen.
2. **Write `schemas/*.ts`** (sibling of `lib/`, per codebase convention — never `lib/schemas/`) — one zod file per CT resource. Derive shapes from swagger components. Use shared `primitives.ts` for E164, ISO8601, etc.
3. **Write `lib/types.ts`** — thin re-exports of `z.infer<>` types from schemas.
4. **Write `client.ts`** thin wrapper:
   - HTTP Basic auth (`CLOUDTALK_ACCESS_KEY_ID` + `CLOUDTALK_ACCESS_KEY_SECRET`)
   - Dual-host base URL switching: `my.cloudtalk.io/api` (default) vs `platform-api.cloudtalk.io/api/` (CueCard/VoiceAgent — unused Phase 1 but configured)
   - Envelope unwrap (`responseData` → return raw payload)
   - 429 retry with exponential backoff using `X-CloudTalkAPI-ResetTime` header
   - `.parse()` on responses via zod schemas
   - Log `X-CloudTalkAPI-Remaining` to metrics sink
   - **Quirks codified in code comments:** resource-suffix verbs (PUT add / POST edit / DELETE delete / GET index|show); `.json` suffix default with `GET /calls/{id}` exception; dual hosts; no HMAC on webhooks; tag-as-membership (no campaign-enroll endpoint)
5. **Write grouped lib modules.** Each exports plain async fns calling client + returning zod-validated typed payloads. Real signatures (corrected 2026-05-31):

```ts
// lib/contacts.ts
export async function upsert(args: {
  phoneE164: string
  attributes: ContactAttributeWriteValue[]  // [{ attribute_id, value }]
  name?: string
  city?: string
}): Promise<{ contactId: string }>

export async function findByPhone(args: { phoneE164: string }): Promise<Contact | null>
export async function getById(args: { contactId: string }): Promise<Contact | null>

export async function addTags(args: {
  contactId: string
  tags: CloudtalkTagName[]   // ['Lead', 'Campaign-MetaAds'] — membership tag is enrollment
}): Promise<void>

export async function removeTags(args: {
  contactId: string
  tags: CloudtalkTagName[]
}): Promise<void>

// REMOVED: assignFavoriteAgent — Q3 inversion 2026-05-31 (CT agents independent from app users)
```

```ts
// lib/campaigns.ts (corrected 2026-05-31)
export async function list(): Promise<Campaign[]>  // used by campaign-sync.service
export async function setStatus(args: {
  campaignId: string
  status: 'active' | 'inactive'   // CT supports pause via inactive
}): Promise<void>

// NO enroll() / unenroll() / listActiveContacts() — these endpoints don't exist.
// Enrollment = contacts.addTags(['Campaign-X']). CT auto-includes by tag.
```

```ts
// lib/attributes.ts (NEW — for CT-side identity mirroring)
export async function list(): Promise<ContactAttributeDefinition[]>  // used by campaign-sync.service
```

```ts
// lib/bulks.ts (corrected 2026-05-31)
export async function batch(args: {
  ops: Array<
    | { action: 'add_contact', data: { name: string, phone: string, attributes?: ContactAttributeWriteValue[] } }
    | { action: 'edit_contact', data: { id: number, attributes?: ContactAttributeWriteValue[], tags?: string[] } }
    | { action: 'delete_contact', data: { id: number } }
  >
  // CT cap: ≤10 ops per request; correlation via per-item command_id
}): Promise<{ results: BulkOpResult[] }>
```

6. **Secret verification:** there is NO standalone `webhooks/verify.ts`. The `?secret=` constant-time check ships as `cloudtalkClient.verifyWebhookSecret({ url })` on the superset client (see `providers/cloudtalk/DOCS.md#superset-client`).
7. **Event schemas:** ✅ **SHIPPED** as a Zod **discriminated union** keyed on `event_type` (which WE inject — CT doesn't add it) in `providers/cloudtalk/webhooks/events.ts`. **That file is the source of truth — do not re-copy the schema here (this block previously drifted).** Key shape facts the WA body-builders must honor:

   - **Payloads are FLAT** — no nested objects. The matched contact is carried as top-level `contact_id` / `contact_name` (NOT a nested `contact: {…}`), on all 5 events, for deterministic resolution via `voip_campaign_contacts.cloudtalk_contact_id`.
   - **`direction`** arrives as CT's native `incoming` / `outgoing` and is normalized → `inbound` / `outbound`. Required on `call.started`; optional on `call.ended`.
   - **`is_voicemail`** tolerates a raw boolean OR a stringified `"true"`/`"false"`/`"1"`/`"0"` (CT body-builders render strings).
   - **`disposition`** must be exactly one of the 10 `cloudtalkDispositions` slugs.
   - The 5 variants: `call.started`, `call.answered`, `call.ended`, `call.disposition_set` (Call+Modified), `sms.received`.

   Per-WA body-builder JSON templates: derive from `events.ts` (or see `phase-0-cloudtalk-setup.md` Task 6).

8. **Write `constants/pricing.ts`:** per-minute outbound rate + per-SMS US-local rate constants. Use for cost-tracking widget (W8). Document source: CT pricing page snapshot date.
9. **Write `README.md`** noting: no `dal/` subdir (ADR-0003), resource-suffix verbs, hand-typed rationale, Probes 1–4 log, dual hosts, no HMAC webhooks, tag-as-membership. Anti-pattern reminders.

**Acceptance:** `pnpm tsc` clean, `pnpm lint` clean. A throwaway test script can call `contacts.upsert({ phoneE164: '+13105551234', attributes: [{ attribute_id, value: 'bina' }] })` and get back a contactId from the live CT account; `contacts.addTags({ contactId, tags: ['Campaign-MetaAds'] })` succeeds; `campaigns.list()` returns the seeded campaigns with their IDs.

---

## W2 — Schema migrations

**Goal:** add voip-campaigns-owned tables + customer-side columns. The shared `voip_calls`/`voip_messages`/`voip_dids`/`voip_dnc` schema is voip-in-house's territory (we just write rows with `source='cloudtalk'`).

### Migration 1: customer attempt-counter column (⬜ NEW 2026-06-04 — was wrongly "LANDED")

> **CORRECTION 2026-06-04 — perfect separation.** This migration was previously
> specified as a `voip_campaign_status` enum + four customer columns
> (`voip_campaign_status`, `voip_campaign_enrolled_at`, `voip_campaign_graduated_at`,
> `lead_intake_error`) and marked "✅ LANDED." **None of that ever landed, and
> none of it is needed.** Under the perfect-separation decision (voip-in-house
> EPIC.md "2026-05-30 total separation", confirmed by user 2026-06-04), CloudTalk
> is the **sole source of truth** for the lead-to-appointment lifecycle —
> INCLUDING its own pipeline tags. We do NOT mirror campaign status on the
> `customers` row. On a `meeting_booked` disposition CloudTalk hands the lead off
> to the normal app flow (meeting creation → existing derived customer pipeline).
>
> **Deleted 2026-06-04:** `voipCampaignStatuses` const (constants/enums/voip.ts),
> `voipCampaignStatusEnum` pgEnum (meta.ts), and `lifecycle-mapper.ts`.

The **only** customer-side column voip-campaigns adds is the dial-attempt counter
— CloudTalk fires no "cadence exhausted" webhook, so we count `call.ended`
ourselves:

```sql
-- src/shared/db/schema/customers.ts:
ALTER TABLE customers ADD COLUMN voip_campaign_attempts integer NOT NULL DEFAULT 0;
-- Incremented by the cloudtalk webhook handler on each call.ended; app-side
-- 'cadence_exhausted' emitted when it reaches voip_campaigns.attempts_per_contact
-- (default 10). Resets to 0 on re-enrollment.

-- NOT added (perfect separation): voip_campaign_status, voip_campaign_enrolled_at,
-- voip_campaign_graduated_at, lead_intake_error. CloudTalk owns lifecycle state.
-- pipeline_stage stays as-is — there is no longer a voipCampaignStatus to migrate
-- it to; any pipeline_stage cleanup is a separate customer-pipelines concern.
```

### Migration 2: `voip_campaign_contacts` table (⬜ schema written, not pushed — renamed 2026-06-04)

> **Renamed from `voip_contact_sync` 2026-06-04** + expanded to be the single home
> for ALL per-customer CloudTalk state. Added `enrolled_at`/`unenrolled_at` (membership)
> + `dial_attempts` (moved off `customers`). "Enrolled now" = row exists AND
> `unenrolled_at IS NULL`. Unenroll = `removeTags` + set `unenrolled_at`; row +
> `cloudtalk_contact_id` persist so re-enroll reuses the CT contact.

```sql
CREATE TABLE voip_campaign_contacts (
  customer_id uuid PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  cloudtalk_contact_id text UNIQUE NOT NULL,
  voip_campaign_id uuid REFERENCES voip_campaigns(id) ON DELETE SET NULL,  -- the ONE campaign this customer is in
  enrolled_at   timestamptz,                  -- null = never enrolled
  unenrolled_at timestamptz,                  -- set on unenroll
  dial_attempts integer NOT NULL DEFAULT 0,   -- moved off customers; logic ring-2
  attribute_hash text NOT NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX voip_campaign_contacts_last_synced_at_idx ON voip_campaign_contacts (last_synced_at);
CREATE INDEX voip_campaign_contacts_enrolled_at_idx ON voip_campaign_contacts (enrolled_at);
```

### Migration 3: `voip_campaigns` table — CT identity bridge (⬜ NEW 2026-05-31)

CT-assigned campaign IDs + membership tag names are **runtime data**, not env-var constants. Synced from CT dashboard via admin-triggered Resync (Phase 1) — Phase 2 may add daily cron if drift observed.

```sql
CREATE TABLE voip_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_slug text,                          -- 'bina' | 'home_depot' — joins to lead_sources.slug. NULLABLE + NOT unique: synced unbound, admin binds via UI; a source owns many campaigns.
  ct_campaign_id text NOT NULL UNIQUE,       -- CT-assigned, mirrored from /campaigns/index.json
  ct_campaign_name text NOT NULL,            -- mirrored for human readability
  ct_membership_tag text NOT NULL UNIQUE,    -- 'Campaign-MetaAds' — addTags target for enrollment
  ct_tag_id text,                            -- optional, if CT exposes tag IDs separately
  ct_status text NOT NULL,                   -- mirrored from CT: 'active' | 'inactive' (paused)
  attempts_per_contact integer NOT NULL DEFAULT 10,   -- mirrored from CT campaign config (Q5 lock)
  hours_between_attempts integer NOT NULL DEFAULT 3,  -- mirrored from CT campaign config (Q5 lock)
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX voip_campaigns_source_slug_idx ON voip_campaigns (source_slug);
```

### Migration 4: `voip_contact_attributes` table — CT attribute ID bridge (⬜ NEW 2026-05-31)

Pre-defined `ContactAttribute` IDs (referenced by `attribute_id` in bulk + contact ops) are also runtime data. Three custom attributes Phase 1: `lead_source`, `primary_trade`, `trades_interested`. (Built-in `name` + `city` use CT's first-class fields; not in this table.)

```sql
CREATE TABLE voip_contact_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_key text NOT NULL UNIQUE,              -- 'lead_source' | 'primary_trade' | 'trades_interested'
  ct_attribute_id text NOT NULL UNIQUE,      -- CT-assigned, mirrored from /contacts/attributes.json
  ct_title text NOT NULL,                    -- 'Lead Source' / 'Primary Trade' / 'Trades Interested'
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### Migration 5: `lead_sources` voipConfigJSON

```sql
-- If voip-in-house Phase 1 hasn't shipped this column yet, add it here.
-- Shape per INTEGRATION-SEAM.md §9. Schema validation in entities/lead-sources/schemas.ts.
-- APP-SIDE POLICY ONLY (enabled / autoEnroll / dailyDialVolumeCap / templateOverrides).
-- CT-side identity (campaign_id, membership_tag) lives in voip_campaigns, NOT here.
ALTER TABLE lead_sources ADD COLUMN IF NOT EXISTS voip_config_json jsonb;
```

### Steps

1. Add const array + TS type + pgEnum per 4-tier convention (✅ landed for `voipCampaignStatus`)
2. Add Drizzle column definitions in `src/shared/db/schema/customers.ts` (✅ landed)
3. Add `voip_campaign_contacts` table schema + Zod schemas + DAL CRUD via `createCrudDal` (schema written; not pushed)
4. **NEW:** Add `voip_campaigns` table schema + Zod + DAL CRUD
5. **NEW:** Add `voip_contact_attributes` table schema + Zod + DAL CRUD
6. Update `entities/customers/schemas.ts` if needed
7. Add Zod schema for `lead_sources.voipConfigJSON` per INTEGRATION-SEAM.md §9 shape (app-policy only)
8. Backfill migration script for legacy `pipelineStage` → `voipCampaignStatus` mapping (per Q4.3 — deferred until customer-pipelines kanban migration)
9. **DO NOT auto-push.** User has pending unrelated dev DB cleanup. Surface schema diff to user; user runs `pnpm db:push:dev` (NEVER `pnpm db:push` — that's prod).
10. Verify via Drizzle Studio that schema landed clean in dev

**Acceptance:** schema diff clean, no compile errors in entity types, legacy pipelineStage refs in app code identified + scheduled for migration in customer-pipelines refactor (not this PR).

---

## W3 — Webhook handler (`src/app/api/webhooks/cloudtalk/route.ts`)

> 🚨 **REWRITTEN 2026-06-04 (grill).** This section previously drove a deleted
> `lifecycleService` (applyEngagement / recordAttempt / applyDisposition) + a local
> status mirror + `after()`. Under perfect separation the handler persists only TWO
> things in ring 1: **DNC** (on STOP) and **graduation** (idempotent unenroll on
> `meeting_booked`). No status writes, no `voip_calls`/`voip_messages`, no
> attempt-counter (deferred), no `after()` (use a QStash job for the cosmetic SMS notify).

**Goal:** ONE route, switch on event type, orchestrate services directly. NO wrapper service. Per `docs/codebase-conventions/webhook-routes.md`. Verify secret via `cloudtalkClient.verifyWebhookSecret({ url })`; parse with `webhooks/events.ts`; 200 always once secret+envelope valid.

**Ring-1 arms (DNC + unenroll, with reason — decision #18):**
- **`sms.received` STOP** → `complianceService.addToDnc(...)` + `unenroll(reason: 'opted_out')`. (Inbound non-STOP SMS → cosmetic agent notify via a **QStash job**, never `after()`; CT keeps the message record — we do not persist it.)
- **`call.disposition_set`** (the disposition-set / `Call.Modified` event) → terminal dispositions exit via the **same idempotent `unenroll`**, reason mapped by a pure `lib/` fn: `meeting_booked → 'graduated'`, `opt_out → 'opted_out'` (+ DNC), `not_interested | wrong_number → 'disqualified'`. Non-terminal dispositions keep dialing.
- **Manual disqualify** is the SAME `unenroll(reason: 'disqualified')`, also reachable from the **admin/agent UI** (W8) — graduation and disqualification both fire from UI *and* webhook.

**Deferred to ring 2 (no-op / log only for now):** `call.ended` attempt counting → `cadence_exhausted`, voicemail, `call.answered` engagement. **Decoupling:** the handler imports `cloudtalkClient` + `complianceService` + the voip-campaigns enrollment/graduation service. It does NOT import `voipCallsService` / `voipMessagesService`, does NOT write `voip_calls`/`voip_messages`, and there is no `source` discriminator. Idempotency lives in the unenroll/DNC operations themselves (`unenrolled_at IS NULL` check; DNC upsert).

### Skeleton

```ts
// src/app/api/webhooks/cloudtalk/route.ts
import { cloudtalkClient } from '@/shared/services/providers/cloudtalk/client'
import { cloudtalkEventSchema } from '@/shared/services/providers/cloudtalk/webhooks/events'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { complianceService } from '@/shared/services/voip/compliance.service'
import { campaignEnrollmentService } from '@/shared/services/voip/campaigns/enrollment.service'
import { resolveCustomerByPhone, resolveCustomerByCtContactId } from '@/shared/services/voip/campaigns/lib/resolve-customer'
import { isStopKeyword } from '@/shared/services/voip/campaigns/lib/is-stop-keyword'
import { notifyLastInteractingAgentJob } from '@/shared/services/providers/upstash/jobs/notify-last-interacting-agent.job'

export async function POST(req: Request): Promise<Response> {
  // 1. Secret — client method, no separate verify.ts.
  if (!cloudtalkClient.verifyWebhookSecret({ url: req.url })) {
    return new Response('unauthorized', { status: 401 })
  }

  // 2. Envelope. 400 on schema failure.
  let event
  try {
    event = cloudtalkEventSchema.parse(await req.json())
  }
  catch {
    return new Response('bad request', { status: 400 })
  }

  // 3. Dispatch. 200 always once secret+envelope valid (webhook-routes.md rule 4).
  //    Ring 1 persists exactly two things: DNC + graduation. Everything else is
  //    a no-op (deferred) so the handler is stable for ring-2 expansion.
  try {
    switch (event.event_type) {
      case 'sms.received': {
        if (isStopKeyword(event.text)) {
          const customer = await resolveCustomerByPhone(event.from_e164)
          if (customer) {
            // Orchestrator: compliance writes DNC, enrollment unenrolls. Both idempotent.
            await complianceService.addToDnc(SYSTEM_CONTEXT, {
              customerId: customer.id,
              reason: 'stop_keyword',
              addedByUserId: null,
            })
            await campaignEnrollmentService.unenroll(SYSTEM_CONTEXT, { customerId: customer.id, reason: 'opted_out' })
          }
        }
        else {
          // Cosmetic — QStash job, NOT after(). Silent loss acceptable; CT keeps the SMS.
          void notifyLastInteractingAgentJob.dispatch({
            customerPhoneE164: event.from_e164,
            body: event.text,
          })
        }
        break
      }

      // Disposition arrives on the disposition-set / Call.Modified event, AFTER
      // call.ended. Three terminal dispositions exit the campaign (decision #18) —
      // each maps to an unenroll reason; the op is the same idempotent unenroll.
      case 'call.disposition_set': {
        const reason = ctDispositionToUnenrollReason(event.disposition) // pure fn in lib/
        // null = non-terminal (callback_scheduled, no_answer, busy, …) → keep dialing.
        if (reason) {
          const customer = await resolveCustomerByCtContactId(event.contact?.id ?? '')
          if (customer) {
            if (reason === 'opted_out') {
              await complianceService.addToDnc(SYSTEM_CONTEXT, { customerId: customer.id, reason: 'opt_out', addedByUserId: null })
            }
            await campaignEnrollmentService.unenroll(SYSTEM_CONTEXT, { customerId: customer.id, reason })
          }
        }
        break
        // ctDispositionToUnenrollReason: meeting_booked → 'graduated';
        //   opt_out → 'opted_out'; not_interested | wrong_number → 'disqualified';
        //   everything else → null (non-terminal). // @migration: cadence_exhausted (ring 2)
      }

      // Deferred to ring 2 — no-op for now (handler stays stable):
      // call.ended (attempt counter → cadence_exhausted), call.answered, voicemail.
      default:
        break
    }
  }
  catch (err) {
    console.error('[cloudtalk webhook] handler error', {
      eventType: event.event_type,
      err: err instanceof Error ? err.message : String(err),
    })
  }

  return Response.json({ ok: true })
}
```

**Idempotency:** `unenroll` no-ops when there's no active enrollment (`unenrolled_at IS NULL`); `addToDnc` upserts. So the app-side graduation job and the CT `meeting_booked` webhook can both fire for the same customer without double-effect — whichever lands first wins, the second is a no-op.

**`isStopKeyword` + `unenroll` are the kind of small isolated rules per EPIC decision #16** — pure function in `lib/`, composed by the orchestrating handler/service.

**Acceptance:** CT dashboard webhook test → 200; bad envelope → 400; bad secret → 401; handler errors log + still 200. Integration: send a STOP SMS → customer DNC'd + unenrolled; set a `meeting_booked` disposition → customer unenrolled.

### Failure persistence — NOT in Phase 1

The original spec included a `voip_webhook_errors` table for human review of failed handler arms. Dropped 2026-06-02 — `console.error` + the daily reconciliation cron (W6) is the durable record. If log noise proves insufficient, add the table later. Phase 1 keeps the schema lean.

---

## W4 — Enrollment service (`src/shared/services/voip/campaigns/enrollment.service.ts`)

> 🚨 **REWRITTEN 2026-06-04 (grill).** Was built on the deleted status model
> (`voipCampaignStatus` gates, `leadIntakeError`, `voipCampaignSource`), env-var
> campaign IDs, and naming-convention sync. All replaced per EPIC decisions #7–#19.

**Goal:** orchestrate enrollment. The service composes `cloudtalkClient` (provider) + entity DAL mutations + sibling services + pure-function gates — NO raw `db.*` (decision #14). Enrollment = `upsertContact` + `addTags([membershipTag])` (no "campaign enroll" endpoint exists) + write the `voip_campaign_contacts` row. Writes NO status to `customers`.

**Two entry points, one gate chain:**
- `enroll({ customerId })` — single lead (auto-enroll trigger). Target campaign = the source's `defaultCampaignId`.
- the **bulk QStash job** `enroll-source-batch` (decision #11) — "enroll all" for a source into an admin-picked campaign, chunked ≤10/req with backoff.
- `unenroll({ customerId, reason })` — the single exit op for all three reasons (`graduated | opted_out | disqualified`, decision #18). `removeTags([membershipTag])` (read from the linked `voip_campaigns` row) + set `unenrolled_at` + `unenroll_reason`. Idempotent. Reachable from the app meeting-create job, CT webhook dispositions, and the **admin/agent UI "disqualify / stop calling"** action (single + bulk).

### Pre-enrollment gate chain (decision #15 — first failure short-circuits)

Each gate is a small pure function in `lib/` (decision #16), composed by the service:

```ts
1. lead_sources.voipConfigJSON.campaigns.enabled === true                  // per-source kill switch
2. target campaign is dialable: row bound (source_slug != null) AND ct_status === 'active'
//   (auto-enroll: source.defaultCampaignId; bulk: admin-picked campaignId)
3. derivedPipelineWhere('leads')  — pre-meeting lead only (pipeline='active' + no meetings)
4. customer.dncOptedOutAt IS NULL                                          // not opted out
5. customer.phone normalizable to E.164                                    // usable phone
6. no active voip_campaign_contacts row (unenrolled_at IS NULL)            // idempotency
```

`// @migration:` rehash re-dialing — a future entry point enrolling `rehash` customers into a rehash campaign. Out of ring 1.

### Service shape (orchestrator)

```ts
// src/shared/services/voip/campaigns/enrollment.service.ts
// Singleton service object. Methods take ScopedContext, return DalReturn<>.
// Composes: cloudtalkClient + entity DAL mutations + complianceService + lib/ gates.

export const campaignEnrollmentService = {
  // Single-lead auto-enroll. Target = source.defaultCampaignId.
  async enroll(ctx, { customerId }) {
    // 1. DAL reads: customer, its lead source voipConfig, the target voip_campaigns row.
    // 2. Run the gate chain (pure fns in lib/). First failure → DalReturn error w/ reason.
    // 3. Build CT attribute writes from voip_contact_attributes ids:
    //      lead_source (slug), primary_trade (label of tradesInterested[0]),
    //      trades_interested (alpha-sorted deduped accessors, '' if unknown).
    // 4. cloudtalkClient.upsertContact({ phoneE164, name, city, attributes }) → contactId.
    // 5. cloudtalkClient.addTags({ contactId, tags: [campaign.ct_membership_tag] }).
    // 6. voipCampaignContactsDal.upsertEnrolled({ customerId, cloudtalkContactId: contactId,
    //      voipCampaignId: campaign.id, attributeHash, enrolledAt: now, unenrolledAt: null }).
    //    ← DAL implements the write; the service never touches db directly.
    // 7. return ok. NO write to customers (no status).
  },

  // The ONE exit op for all three reasons (graduated | opted_out | disqualified —
  // decision #18). Idempotent. Reachable from app-meeting-create, CT webhook, and UI.
  async unenroll(ctx, { customerId, reason }) {
    // 1. voipCampaignContactsDal.findActive(customerId). If none → ok (no-op).
    // 2. cloudtalkClient.removeTags({ contactId, tags: [campaign.ct_membership_tag] })
    //    (membership tag read from the linked voip_campaigns row).
    // 3. voipCampaignContactsDal.markUnenrolled(customerId, reason). // sets unenrolled_at + unenroll_reason
  },
}
```

**Reject reasons** (returned in `DalReturn`, no status-based ones): `source_disabled`, `no_dialable_campaign`, `not_a_lead`, `dnc_match`, `invalid_phone`, `already_enrolled`, `ct_api_failure`. On failure we DO NOT write any flag to `customers` (no `leadIntakeError`); the per-customer `voip_campaign_contacts.last_sync_error` records bulk-job failures for retry.

### Bulk "enroll all" — QStash job (decision #11)

```ts
// src/shared/services/providers/upstash/jobs/enroll-source-batch.job.ts
export const enrollSourceBatchJob = createJob(
  'enroll-source-batch',
  async ({ sourceSlug, campaignId, requestedByUserId }) => {
    // 1. Page eligible customers (gate chain as a SQL predicate where possible:
    //    derivedPipelineWhere('leads') + dncOptedOutAt IS NULL + no active enrollment).
    // 2. Chunk ≤ CLOUDTALK_BULK_MAX_OPS_PER_REQUEST (10); per chunk call
    //    campaignEnrollmentService.enroll(...) (or a bulk variant via cloudtalkClient.bulkContacts).
    // 3. On per-customer failure → record voip_campaign_contacts.last_sync_error; continue.
    // Idempotent: skip active-enrolled; re-enroll unenrolled; skip DNC.
  },
)
```
Triggered from the admin "Enroll all" UI (campaign picker, decision #10) via `void enrollSourceBatchJob.dispatch(...)`.

### `campaign-sync.service.ts` (decision #8 — admin-bound, NOT name-inferred)

```ts
// src/shared/services/voip/campaigns/campaign-sync.service.ts
export const campaignSyncService = {
  async resyncFromCloudtalk(ctx) {
    // 1. cloudtalkClient.listCampaigns() → upsert voip_campaigns rows by ct_campaign_id.
    //    source_slug LEFT NULL (unbound). ct_membership_tag/ct_status/cadence mirrored.
    // 2. cloudtalkClient.listContactAttributes() → upsert voip_contact_attributes by app_key.
    // 3. Return counts. Admin then BINDS each campaign → lead source in the UI (W8).
    //    (We never parse CT campaign names to infer the source — decision #8.)
  },
}
```
Exposed via `voipCampaignsRouter.resyncFromCloudtalk` (admin) — button in admin UI (W8).

**Acceptance:** gate chain unit-tested (each reject reason + happy path); `enroll` integration-tested against CT dev (contact upserted + membership tag applied + `voip_campaign_contacts` row written, NO customers write); `unenroll` idempotent (second call no-ops); `resyncFromCloudtalk` populates `voip_campaigns` (unbound) + `voip_contact_attributes`; bulk job enrolls a fixture batch with correct skips.

---

## W5 — ~~Lifecycle mapper~~ (REMOVED 2026-06-04)

> **REMOVED — perfect separation.** This work item specified a pure function
> mapping CloudTalk dispositions → a local `voipCampaignStatus` enum, persisted on
> the `customers` row via `lifecycle.service.ts#applyDisposition`. Under the
> perfect-separation decision (confirmed 2026-06-04), **there is no local campaign
> status to map to** — CloudTalk owns the lifecycle and its own pipeline tags. The
> `lifecycle-mapper.ts` file, the `voipCampaignStatuses` enum, and the
> `voipCampaignStatusEnum` pgEnum were all deleted 2026-06-04.
>
> **What survives of the disposition handling:** the cloudtalk webhook handler
> still reads CT dispositions, but only to drive the two things we DO persist —
> (1) compliance (`opt_out` / `sms_stop_received` → `complianceService.addToDnc`)
> and (2) the dial counter (`call.ended` → increment `customers.voipCampaignAttempts`,
> emit app-side `cadence_exhausted` at the cap). No status transition, no tag
> pushback. See W3 for the handler dispatch table.

---

## W6 — Reconciliation cron — ⏸ DEFERRED to ring 2

> **DEFERRED (grill 2026-06-04).** Not in the ring-1 "semi-working product." Also note
> the original premise — "diff against our cache" — is moot: there is NO local lifecycle
> cache to reconcile (perfect separation). When built, ring-2 reconciliation reconciles
> **membership + attribute drift** (did the CT contact still carry its membership tag;
> did synced attributes drift), NOT a status cache. Content below is pre-grill and stale.

**Goal:** catch missed webhooks + drift. Daily Vercel Cron pull-and-diff against our cache. **NOT Inngest** (per session lock).

### Setup

1. `vercel.json` cron entry: `/api/cron/cloudtalk-reconcile` daily at 03:00 UTC (off-hours)
2. Route `src/app/api/cron/cloudtalk-reconcile/route.ts` — auth via `Vercel-Cron` header check
3. Service `services/voip/campaigns/reconciliation.service.ts`

### Reconciliation passes (each idempotent)

**Scope (clarified 2026-06-02):** because we don't shadow CT calls/SMS into our DB (INTEGRATION-SEAM §8), reconciliation does NOT backfill `voip_calls` / `voip_messages`. It backfills **lifecycle drift** + **stuck enrollments**.

```ts
// services/voip/campaigns/reconciliation.service.ts
export async function runDailyReconciliation(): Promise<ReconciliationReport> {
  const since = subHours(new Date(), 25) // 1h overlap for safety

  // Pass 1: lifecycle-tag drift correction.
  // Webhook may have been missed (CT outage, our 5xx, network); CT's tag-set
  // is source-of-truth. Walk contacts updated since the last pass and
  // reconcile customers.voipCampaignStatus against the mapped tag state.
  const ctContacts = await cloudtalkClient.findContactsUpdatedSince({ since })
  for (const contact of ctContacts) {
    const customer = await resolveCustomerByCtContactId(contact.contactId)
    if (!customer) continue
    const expectedStatus = mapCloudtalkTagsToStatus(contact.tags)
    if (expectedStatus !== customer.voipCampaignStatus) {
      await customersDal.update(customer.id, { voipCampaignStatus: expectedStatus })
      console.warn('[reconciliation] tag drift corrected', { customerId: customer.id, from: customer.voipCampaignStatus, to: expectedStatus })
    }
  }

  // Pass 2: stuck-pending enrollments (intake → CT push failed).
  const stuckLeads = await customersDal.list({
    where: { pipeline: 'lead', voipCampaignStatus: 'not_enrolled', leadIntakeError: { not: null } },
  })
  for (const lead of stuckLeads) {
    const result = await enrollmentService.enrollCustomer(SYSTEM_CONTEXT, {
      customerId: lead.id,
      trigger: 'reconciliation',
    })
    if (result.success) {
      await customersDal.update(lead.id, { leadIntakeError: null })
    }
  }

  return { driftCorrected, stuckRetried }
}
```

**Why no call/SMS backfill pass:** the lifecycle signal we care about (engagement, disposition, exhaustion) is reconstructable from CT's contact-tag state, which Pass 1 already corrects. Missed `call.ended` doesn't matter — the next reconcile sees the updated tag-set. Outbound SMS state is fire-and-forget at the provider boundary; inbound SMS drift surfaces on the next inbound (STOP retry).

### Weekly deep reconciliation

Separate cron weekly: walks ALL `voipCampaignStatus IN ('lead','engaged','transferred')` rows + compares to CT's authoritative state. Alert if drift rate >2%.

**Acceptance:** cron triggers successfully; missed-event scenario (manually delete a `voip_calls` row, then run reconciliation) restores it.

---

## W7 — Seeding backfill script — ⏸ SUPERSEDED by the bulk "enroll all" job

> **SUPERSEDED (grill 2026-06-04).** The one-time backfill is now the **bulk "enroll all
> per source" QStash job** (W4 + decision #11), driven from the admin UI rather than a
> standalone script — same eligibility gates, same skip rules, idempotent re-runs. A
> throwaway `tsx` script is unnecessary. Content below is pre-grill and stale (sets
> `voipCampaignStatus`, which no longer exists).

**Goal:** one-time push of ALL existing Bina + HD leads in `lead` pipeline to CT.

### Script: `src/scripts/cloudtalk-backfill-seed.ts`

```ts
// pnpm tsx src/scripts/cloudtalk-backfill-seed.ts --dry-run
// pnpm tsx src/scripts/cloudtalk-backfill-seed.ts --confirm

interface SeedReport {
  totalEligible: number
  bySource: Record<string, number>
  byZipPrefix: Record<string, number>
  rejected: Array<{ customerId: string, reason: string }>
  enrolled: Array<{ customerId: string, cloudtalkContactId: string }>
}

async function main() {
  const args = parseArgs() // --dry-run | --confirm
  const eligible = await dal.customers.list({
    where: {
      pipeline: 'lead',
      voipCampaignStatus: 'not_enrolled',
      phoneE164: { not: null },
      leadSourceLabel: { in: ['bina', 'home_depot'] },
    },
  })

  if (args.dryRun) {
    // Per Q9.E: dry-run = CSV preview + per-source breakdown + count
    const report = await previewSeed(eligible)
    writeCsv('cloudtalk-seed-dry-run.csv', report)
    console.log(`Eligible: ${report.totalEligible}`)
    console.log(`By source:`, report.bySource)
    console.log(`Run with --confirm to push.`)
    return
  }

  if (!args.confirm) {
    console.error('Refusing to push without --confirm flag')
    process.exit(1)
  }

  // Real run: batched via CT Bulks API (≤10 ops/req)
  const chunks = chunk(eligible, 10)
  for (const batch of chunks) {
    // For Bina: enrollment is straightforward AUTO
    // For HD: bypass the MANUAL gate for the seed (admin-approved by --confirm flag itself)
    for (const customer of batch) {
      await enrollment.enrollCustomer({
        customerId: customer.id,
        trigger: 'backfill_seed', // tells enrollment.service to bypass HD MANUAL gate
      })
    }
    await sleep(1100) // stay under 60 req/min cap with safety margin
  }

  console.log(`Done. Enrolled: ${report.enrolled.length}. Rejected: ${report.rejected.length}.`)
}
```

**Critical safety:** `--confirm` is the gate. Dry-run first, share CSV with user, then real run.

**Acceptance:** dry-run on dev DB produces sensible CSV; real run against CT dev account enrolls test fixtures successfully.

---

## W8 — UI surfaces

> 🟢 **RING-1 UI (grill 2026-06-04) — first-class, not optional (decision #10).** The three
> surfaces ring 1 needs:
> 1. **Resync + campaign-binding screen** — button calls `resyncFromCloudtalk`; lists synced
>    `voip_campaigns` (incl. `source_slug = NULL` unbound ones); admin **binds each campaign to
>    a lead source** (decision #8) and optionally marks a source's **default campaign** (#10).
> 2. **"Enroll all per source" panel** — per lead source: eligible-lead count + a **campaign
>    picker** (default pre-selected) + an Enroll-all button that dispatches `enrollSourceBatchJob`;
>    shows an enrolled-count badge (refetch-updated) + a per-source **Unenroll all** affordance.
> 3. **Enrolled-count / membership badges** — read from `voip_campaign_contacts` (active = `unenrolled_at IS NULL`).
> 4. **"Disqualify / stop calling" action** (single + bulk) on enrolled leads → `unenroll(reason: 'disqualified')` for a lead that's not worth calling but has no meeting (decision #18). Same op graduation + STOP use; fires from UI *and* CT webhook dispositions.
>
> Everything below that renders a **`CampaignStatusBadge` from `customer.voipCampaignStatus`**
> or a leads-kanban driven by the status cache is **STALE** — there is no status to render.
> Lifecycle status, if ever shown, is read from CloudTalk on demand, not from a local column.

**Goal:** admin-facing controls per Q9.E-new + Q9.F + Q11.

### Files (per entity-frontend conventions)

```
src/shared/entities/customers/
├── components/
│   ├── campaign/
│   │   ├── campaign-panel.tsx              ← profile drawer + page panel: status badge + toggle + last attempt + actions
│   │   ├── campaign-status-badge.tsx       ← consumed by leads kanban + panel
│   │   ├── enroll-toggle.tsx               ← the actual toggle button + confirmation modal
│   │   └── bulk-action-toolbar.tsx         ← multi-select bulk enroll/unenroll (admin only)
│   └── ... (existing)
├── constants/
│   └── voip-campaign-status-meta.ts        ← badge color + label + icon per 8 enum values
└── hooks/
    └── use-campaign-mutations.ts           ← wraps useTRPC().voipCampaigns.{enroll,unenroll,retryFailedSync}.mutationOptions()
```

### `voip-campaign-status-meta.ts`

```ts
import type { VoipCampaignStatus } from '@/shared/types/enums/voip-campaigns'

export const voipCampaignStatusMeta: Record<VoipCampaignStatus, {
  label: string
  color: string
  icon: string
}> = {
  not_enrolled: { label: 'Not enrolled', color: 'muted', icon: 'circle-off' },
  lead: { label: 'Lead', color: 'blue', icon: 'user-plus' },
  engaged: { label: 'Engaged', color: 'cyan', icon: 'message-circle' },
  transferred: { label: 'Transferred', color: 'violet', icon: 'arrow-right-left' },
  booked: { label: 'Booked', color: 'emerald', icon: 'calendar-check' },
  do_not_call: { label: 'Do not call', color: 'red', icon: 'ban' },
  exhausted: { label: 'Cadence exhausted', color: 'orange', icon: 'timer-off' },
  bad_number: { label: 'Bad number', color: 'amber', icon: 'phone-off' },
}
```

### Surfaces

1. **Customer profile drawer + page** — render `<CampaignPanel customerId={id} />` reading `voipCampaignsRouter.getCampaignStatus.queryOptions({ customerId })`
2. **Leads kanban cards** — inline `<CampaignStatusBadge status={customer.voipCampaignStatus} />` + card menu "Remove from campaign"
3. **Admin bulk-action UI** — multi-select on leads list view → `<BulkActionToolbar selectedIds={...} />`
4. **Lead-sources admin panel** — toggles for `enabled` + `autoEnroll` per source in `lead_sources.voipConfigJSON.campaigns`
5. **Cost-tracking widget** — admin dashboard card: `<CTCostWidget />` reading aggregated `voip_calls` + `voip_messages` × `pricing.ts` constants; renders bar with current spend / monthly cap

### tRPC router (`src/trpc/routers/voip-campaigns.router.ts`)

Per EPIC's planned surface — implement:

```ts
export const voipCampaignsRouter = createTRPCRouter({
  enroll: agentProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => enrollment.enrollCustomer({ customerId: input.customerId, trigger: 'manual_admin' })),

  unenroll: agentProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => /* removeTags(['Campaign-X', 'Lead', 'Engaged']) + status update to 'not_enrolled' */),

  getCampaignStatus: agentProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => /* read enrollment membership from voip_campaign_contacts; lifecycle status (if shown) read from CloudTalk on-demand — NOT cached locally */),

  getSyncHealth: agentProcedure
    .query(async ({ ctx }) => /* admin dashboard data: counts, last error, drift rate, voip_campaigns/attributes last_synced_at */),

  retryFailedSync: agentProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => /* call enrollment.service with trigger='manual_admin' */),

  getCostThisMonth: agentProcedure
    .query(async ({ ctx }) => /* aggregate voip_calls + voip_messages with source='cloudtalk' × pricing.ts */),

  // NEW 2026-05-31: admin-triggered Resync from CT (CT identity bridge population)
  resyncFromCloudtalk: superAdminProcedure
    .mutation(async ({ ctx }) => campaignSync.syncFromCloudtalk()),

  listCampaigns: agentProcedure
    .query(async ({ ctx }) => dal.voipCampaigns.list()),

  listAttributes: agentProcedure
    .query(async ({ ctx }) => dal.voipContactAttributes.list()),
})
```

### Admin UI: "Resync from CloudTalk" button

Adds a section to the lead-sources admin page:

- "CT Identity Sync" panel showing last sync timestamp + counts (e.g., "2 campaigns synced, 3 attributes synced")
- "Resync from CloudTalk" button → calls `resyncFromCloudtalk` mutation → toast result
- Below: read-only table of `voip_campaigns` rows (source_slug, ct_campaign_id, ct_membership_tag, ct_status, attempts, hours, last_synced_at)
- Below: read-only table of `voip_contact_attributes` rows (app_key, ct_attribute_id, ct_title, last_synced_at)

**CASL:** add `VOIP_CAMPAIGN` subject to abilities. super_admin = full; admin = enroll/unenroll/health/retry; agent = read campaign status of own customers only.

**Acceptance:** profile panel renders status badge; toggle round-trips through enrollment service; bulk-action enrolls 5 fixtures in one click; cost widget displays month-to-date spend; per-source toggles persist to lead_sources.voipConfigJSON.

---

## W9 — Holiday-pause cron — ⏸ DEFERRED to ring 2

> **DEFERRED (grill 2026-06-04).** Not in ring 1. (Implementation below is sound — pure
> CT-side `cloudtalkClient.setCampaignStatus` toggling, no local-status dependency — so it
> survives the perfect-separation correction unchanged; it's just not ring-1 scope.)

**Goal:** automate CT Campaign pause/resume on holidays. App-canonical since CT only supports country-preset US federal natively.

### Setup

```
vercel.json cron:
  /api/cron/holiday-campaign-pause   → daily 00:01 PST   (pauses if today is holiday)
  /api/cron/holiday-campaign-resume  → daily 23:59 PST   (resumes if today was holiday)

src/app/api/cron/holiday-campaign-pause/route.ts
src/app/api/cron/holiday-campaign-resume/route.ts
src/shared/services/voip/campaigns/holiday-calendar.service.ts
```

### Holiday calendar

```ts
// services/voip/campaigns/holiday-calendar.service.ts
import { Temporal } from 'temporal-polyfill'

// Holidays observed off per Q6.4 lock:
const TIER_1_FIXED = [
  { name: "New Year's Day", monthDay: '01-01' },
  { name: 'Independence Day', monthDay: '07-04' },
  { name: 'Christmas Day', monthDay: '12-25' },
]

const TIER_1_FLOATING = [
  // Memorial (last Mon May), Labor (1st Mon Sep), Thanksgiving (4th Thu Nov)
]

const TIER_2 = [
  // Day after Thanksgiving, Christmas Eve (12-24), NYE (12-31)
]

const JEWISH_2026 = [
  // Annual maintenance — Oliver provides Hebrew calendar dates each year
  // 2026: Rosh Hashanah Sep 11-12, Yom Kippur Sep 20, Sukkot Sep 25-26 + Sep 30 - Oct 2 (or per Oliver),
  //       Passover Apr 2-3 + Apr 8-9, Shavuot May 22-23
]

export function isHolidayPST(date: Temporal.PlainDate): { isHoliday: boolean, name?: string }
```

### Cron handlers

```ts
// /api/cron/holiday-campaign-pause/route.ts
export async function GET(req: Request) {
  if (!verifyVercelCron(req)) return new Response('unauthorized', { status: 401 })

  const todayPST = Temporal.Now.plainDateISO('America/Los_Angeles')
  const { isHoliday, name } = isHolidayPST(todayPST)
  if (!isHoliday) return Response.json({ paused: false })

  const campaigns = await dal.voipCampaigns.list()
  for (const campaign of campaigns) {
    // No `pause` endpoint — use setStatus({ status: 'inactive' }) per corrected 2026-05-31.
    await cloudtalk.lib.campaigns.setStatus({ campaignId: campaign.ct_campaign_id, status: 'inactive' })
  }

  await dal.systemEvents.insert({ event: 'holiday_pause', payload: { date: todayPST.toString(), name } })
  return Response.json({ paused: true, name })
}
```

**Acceptance:** test with a fake "today" parameter → pauses on dummy holiday, resumes on non-holiday.

---

## Test plan

### Unit
- W5 lifecycle-mapper: 10 disposition × representative status combinations
- W4 enrollment gates: 9 reject reasons + happy path
- W9 holiday calendar: known holidays return true, non-holidays return false

### Integration (against CT dev account)
- W4 happy path: create fixture customer → enroll → verify CT contact exists + Lead tag + Campaign assigned + Favorite Agent set
- W3 webhook E2E: trigger CT test call → verify voip_calls row inserted with source='cloudtalk'
- W6 reconciliation: manually delete a voip_calls row → run reconciliation → verify restored
- W7 seeding dry-run: run against fixture-loaded dev DB → verify CSV correct
- W8 toggle: enroll via UI → verify CT side updated; unenroll via UI → verify CT untagged

### Manual smoke (end-to-end, ring 1)
1. Admin: run Resync → bind a CT campaign to the `bina` lead source → set it as default.
2. Add a real test lead (Ophir Test) under `bina`, pre-meeting.
3. Enroll (single or via "enroll all bina") → verify CT contact created + membership tag applied + a `voip_campaign_contacts` row exists (`enrolled_at` set, `unenrolled_at` null). **No write to `customers`.**
4. CT Smart Dialer picks up (Oliver's softphone open); Oliver answers → dispositions `meeting_booked`.
5. Verify: `call.disposition_set` webhook fires → `campaignEnrollmentService.unenroll` runs → CT membership tag removed + `voip_campaign_contacts.unenrolled_at` set (idempotent — re-firing is a no-op). **No `voip_calls` write, no status column.**
6. Separately: text STOP from the lead's phone → `sms.received` → customer DNC'd (`dncOptedOutAt` set) + unenrolled.
7. App-side path: create a meeting for an enrolled test lead → graduation QStash job unenrolls them from CT.

---

## Phase 1 → Phase 2 handoff

Phase 2 scope (next phase plan when this ships):
- Tokenized-link sends in campaign SMS (e.g., upload photos)
- Re-engagement campaign for >180-day dormant leads
- AI prompt A/B testing infrastructure (if AI VoiceAgent ever re-evaluated)
- Per-Campaign DID rotation deterministic upgrade if CT supports later
- HD AUTO-enroll migration if Phase 1 manual-review data shows reliability
- Conversation Intelligence activation (per #238 triggers)
- Knowledgebase + CueCard buildout (per #238 triggers)
- Hard-pause budget enforcement (vs Phase 1 soft alert)
- Recording ON (per #238 + CA compliance reconsideration)

---

## Open items requiring user input mid-implementation

- Hebrew calendar dates for the current year + next year (W9 — Oliver provides)
- HD-specific webhook payload shape (W4 normalizer — depends on HD's actual envelope format)
- Bina webhook secret rotation policy (W4 — for hardening)
- Specific CA area code whitelist confirmation (current: 213, 310, 323, 424, 562, 626, 657, 661, 714, 747, 760, 805, 818, 909, 949, 951)
- Slack webhook URL for cost alerts (Q11 L2)
- Monthly budget threshold confirmation ($750 default)

---

## Reference quick-links

- Locked decisions: [EPIC.md decisions log](./EPIC.md#decisions-log) (especially 2026-05-28/29 entry)
- Per-source content: [per-lead-source-content.md](./per-lead-source-content.md)
- CT capability research: [cloudtalk-api-research.md](./cloudtalk-api-research.md)
- Cross-system contract: [../voip/INTEGRATION-SEAM.md](../voip/INTEGRATION-SEAM.md)
- Webhook routes convention: [../../codebase-conventions/webhook-routes.md](../../codebase-conventions/webhook-routes.md)
- Service architecture: [../../codebase-conventions/service-architecture.md](../../codebase-conventions/service-architecture.md)
- DAL conventions: [../../codebase-conventions/dal-conventions.md](../../codebase-conventions/dal-conventions.md)
- Enum standardization: [../../codebase-conventions/enum-standardization.md](../../codebase-conventions/enum-standardization.md)
