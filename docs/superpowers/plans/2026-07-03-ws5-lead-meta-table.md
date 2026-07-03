# WS-5: `lead_meta` Table (Coherent Lead-Metadata Home) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This is the LARGEST workstream in the JSONB restructure — every task below is bite-sized and independently committable; do NOT batch tasks into one commit.

**Goal:** Move lead metadata out of `customers.leadMetaJSON` into a dedicated `lead_meta` table (1:many-capable hybrid: real columns for queryable/attribution/CAPI-critical fields + a residual `source_data` JSONB for the heterogeneous per-source tail). Move `leadSourceId` + `originCampaign` off `customers` into `lead_meta`. Expand-and-contract, in two PRs.

**Architecture:** A new `lead-meta` entity home (`src/shared/entities/lead-meta/`) with schemas / types / DAL, registered as a proper `EntityServerSpec` and CRUD router per the Entity Server System (ADR-0002). A single **pure mapper** `flattenLeadMetaToRow(leadMeta, { customerId, leadSourceId })` (unit-tested) converts the fat `LeadMeta` blob → a `lead_meta` insert row (columns + `source_data`); its inverse `reassembleLeadMetaView(row)` reconstructs a `LeadMeta`-shaped view so the many read sites that consume a `LeadMeta` object (note builders, profile panels) flip with near-zero churn. The mapper is shared by the **dual-write** (Phase A) and the **backfill script** (Phase A) and the inverse feeds the **read flip** (Phase B). All four lead-create flows already converge on ONE write site — `customerIntakeService.ingestLead` → `customerCrud.create` — so the dual-write is a single insert appended to that service.

**Tech Stack:** TypeScript, Drizzle ORM (`node-postgres` + `pg.Pool`), Zod, drizzle-zod, pnpm, Vitest (added in WS-2), tRPC (Entity Server System).

**Spec:** `docs/superpowers/specs/2026-07-03-jsonb-restructure-design.md` §7 (schema) and §8 (funnel-capture reconciliation). Cardinality per §7.1: `customer_id` is a plain FK with **NO unique constraint** (1:many-capable); write one row per lead now, "latest wins" for current attribution.

**Depends on: WS-2** (app-side atomic deep-merge in the generic CRUD) — required so `source_data.enrichment` partial writes on `lead_meta` (via `jsonbMergeColumns`) never delete siblings. Phase B's `mergeFunnelEnrichment` retarget relies on WS-2 being landed.

## Global Constraints

- Package manager: **pnpm**. Path alias `@/` → `src/`.
- **NEVER run `pnpm build`.** Verify with `pnpm tsc` (type-check) + `pnpm lint`.
- **NEVER run `pnpm db:push`** (production). Push schema with **`pnpm db:push:dev`** only — each worktree has its own isolated Neon branch, so this is safe. `pnpm db:snapshot` copies prod→dev with 🧪 markers if you need realistic backfill data.
- Work directly on `main`. **Stage files explicitly** (`git add <path>`), never `git add -A`, so unrelated WIP isn't swept in.
- Three-layer backend: **tRPC → Service → DAL → DB.** Services orchestrate; DAL implements. **NO `db.insert`/`db.update` in a service** — push mutations into `entities/lead-meta/dal/server/`. Reuse the generic `createCrudDal` where it fits; register a proper `EntityServerSpec` — do NOT hand-roll ad-hoc DAL.
- Entity-first co-location under `src/shared/entities/lead-meta/`: `schemas/` (sibling of `lib/`, never `lib/schemas/`), `types`, `dal`, `lib`. **Named exports only.** ONE component per file. **No barrel files** in `dal/`, `lib/`, `schemas/`.
- Zod-parse every JSONB write at the boundary; `.$type<>()` is a runtime no-op. **Never set `updatedAt` manually** (schema-helper `$onUpdate`). Derived values computed, not stored.
- Add a **`_v` schema-version field** to `source_data` (the persistent residual blob) per the WS-1 governance rule.
- Backfill scripts: `import './lib/load-env'` (NOT `dotenv/config`); **dry-run default**; **idempotent** (skip already-migrated rows); `NODE_ENV` selects `DATABASE_DEV_URL` at runtime.
- Expand-and-contract order: add nullable columns/table → dual-write → batched backfill → parity check → flip reads → **drop the blob LAST**. Verify CAPI fields (fbp/fbc/utm) non-lossy in a **REAL browser** Events-Manager test before dropping (NEVER headless — `feedback-meta-pixel-verify-real-browser`).
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Field inventory (the exact column/residual split — verified against `entities/customers/schemas/index.ts:76-155`)

Every field of the current `leadMetaSchema` (`LeadMeta`), and where it lands in `lead_meta`:

| `LeadMeta` field | Type today | → `lead_meta` destination |
|---|---|---|
| `mp3RecordingKey?` | `string` | column `mp3_recording_key` (text) |
| `closedBy?` | `string` | column `closed_by_user_id` (text, FK→user, set null) |
| `scheduledFor?` | `string` (ISO) | column `scheduled_for` (timestamptz, mode:'string') |
| `interestedTradesRaw?` | `string[]` | column `interested_trades_raw` (jsonb `$type<string[]>()`) |
| `originCampaign?` | `string` | column `origin_campaign` (text) — **moves off `customers` too** |
| `phoneVerification?.status` | `'verified'\|'unverified'` | column `phone_verification_status` (text) |
| `phoneVerification?.lineType` | `string\|null` | column `phone_line_type` (text) |
| `phoneVerification?.carrierName` | `string\|null` | column `phone_carrier_name` (text) |
| `requestedTrades?` | `{tradeId, scopeIds}[]` | column `requested_trades` (jsonb `$type<RequestedTrade[]>()`) |
| `source.kind` (discriminant) | `'bina'\|'generic'\|'funnel'` | column `capture_channel` (`leadCaptureChannelEnum`, NOT NULL) |
| `source.offer` (funnel) | `string` | column `offer` (text) |
| `source.funnelSlug` (funnel) | `string` | column `funnel_slug` (text) |
| `source.utm.source/medium/campaign/content/term` | `string\|null` each | columns `utm_source/utm_medium/utm_campaign/utm_content/utm_term` (text) |
| `source.utm.fbclid/gclid` | `string\|null` | columns `fbclid`, `gclid` (text) |
| `source.meta.fbp/fbc` (funnel) | `string\|null` | columns `fbp`, `fbc` (text) — **CAPI-critical** |
| `source.consent.agreed/at` (funnel) | `true` / ISO | columns `consent_agreed` (bool, default false), `consent_at` (timestamptz) |
| `source.enrichment` (funnel) | `EnrichmentRecord` (object-map) | `source_data.enrichment` (residual JSONB; deep-merge target) |
| `source.{budgetSolution, rebateAmount, bathroomAge/Size/Scope, kitchenAge/Size/Scope}` (bina) | `string\|null` each | `source_data.bina` (residual JSONB — heterogeneous per-source tail) |
| (leadSourceId, held on `customers` today) | `uuid` FK | column `lead_source_id` (uuid, FK→lead_sources, set null) — **moves off `customers`** |

**Residual `source_data` shape** (`LeadSourceTail`): `{ _v: 1, enrichment?: EnrichmentRecord, bina?: {...8 bina fields} }`. Only these two keys are heterogeneous per-source; everything else is a real column.

## Read/write-site inventory (verified — exhaustive; ~39 refs / 30+ files)

**Write sites (all converge on ONE `customerCrud.create` in the service):**
- `src/features/intake/ui/views/intake-form-view.tsx:72-94` (builds `leadMetaJSON` client-side) → `business.router.createFromIntake`
- `src/trpc/routers/customers.router/business.router.ts:207-251` (merges phoneVerification + resolved trade names) → `ingestLead`
- `src/trpc/routers/funnels.router.ts:122-141` (funnel submit) → `ingestLead`
- `src/shared/domains/funnels/lib/build-lead-input.ts:31-44` (funnel client builder — sets `originCampaign`, `source.*`)
- `src/shared/services/providers/gohighlevel/lib/normalize-bina-lead.ts:65-79` (bina webhook normalizer) → `ingestLead` (via `src/app/api/webhooks/bina/route.ts:35`)
- **`src/shared/services/customer-intake.service.ts:65-75`** — THE single `customerCrud.create({ ..., leadSourceId, leadMetaJSON })` chokepoint (dual-write goes here).
- `src/shared/entities/customers/dal/server/mutations.ts:57-77` — `mergeFunnelEnrichment` (only SQL-level write; retargeted Phase B).

**Read sites (13 primary + attribution reads):**
1. `src/trpc/routers/customer-pipelines.router.ts:75-91` — mp3 presign; reads `leadMetaJSON.mp3RecordingKey`.
2. `src/shared/services/voip/campaigns/enrollment.service.ts:85-88` — reads `customer.leadSourceId` (guard + policy fetch); `:159` `interestedTradesRaw`; `:197` `buildLeadNote(customer.leadMetaJSON)`.
3. `src/shared/entities/customers/lib/build-lead-note.ts:22-58` — consumes whole `LeadMeta` (`interestedTradesRaw`, `scheduledFor`, `source.kind==='bina'` + 8 bina fields).
4. `src/shared/domains/funnels/lib/build-funnel-lead-note.ts:14-40` — consumes whole `LeadMeta` (`source.kind==='funnel'`, `source.enrichment`).
5. `src/shared/services/voip/campaigns/sms-cadence.service.ts:70` — `ctx.interestedTradesRaw` (fed from the query below).
6. `src/shared/entities/voip-campaigns/lib/sms-merge-tokens.ts:14,35,36` — `SmsMergeVars.interestedTradesRaw`.
7. `src/shared/services/voip/campaigns/lib/build-contact-attributes.ts:44,63,68` — `input.interestedTradesRaw`.
8. `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts:115,138` — selects `customers.leadMetaJSON` → `interestedTradesRaw`; also `:212,:340` select `customers.lead_source_id` for rollups.
9. `src/shared/entities/customers/components/profile/funnel-intake-panel.tsx:26-30` — consumes `LeadMeta` (`source.kind`, `source.enrichment`).
10. `src/shared/entities/customers/components/profile/customer-profile-details.tsx:17,25,58` — passes `LeadMeta` prop to panel (and `customer-profile-overview.tsx:29` passes `data.customer.leadMetaJSON`).
11. `src/features/campaigns-admin/ui/components/leads/lead-drawer-identity.tsx:35` — `customer.leadMetaJSON?.interestedTradesRaw`.
12. `src/trpc/routers/funnels.router.ts:152-173` — CAPI: `source.meta.fbp/fbc`, `source.utm.fbclid` (via `deriveFbc`).
13. `src/shared/services/customer-intake.service.ts:120` (`leadMeta.scheduledFor`), `:105` (`buildFunnelLeadNote(input.leadMeta)`), `:174` (address guard `customer.leadMetaJSON?.source?.kind !== 'funnel'`).

Plus: `src/shared/entities/customers/lib/server-spec.ts:53` (customer select list includes `leadMetaJSON`), `src/shared/domains/funnels/ui/steps/pii-form-step.tsx:93` (client passes `lead.leadMetaJSON` to submit — a client-owned object, unaffected by the DB move), `src/providers/meta/lib/derive-fbc.ts` (`src/shared/services/providers/meta/lib/derive-fbc.ts` — pure; reads whatever `fbc`/`fbclid` it's handed; after the flip it reads the columns).

**⚠️ Staleness noted (fix opportunistically, not load-bearing):** `src/shared/entities/meetings/dal/server/queries.ts:109` declares `leadMetaJSON: any` in a projection type — a loose `any` that will go stale when the blob drops. Flagged for the Phase B sweep (Task B7).

---

## Phase A (PR1) — Add + dual-write + backfill (non-destructive)

Everything in Phase A is additive. `customers.leadMetaJSON` and `customers.leadSourceId` stay authoritative; `lead_meta` is written in parallel and backfilled. No reads move. Shippable and reversible on its own.

### Task A1: Declare the `leadCaptureChannel` enum (const array + type)

**Files:**
- Create: `src/shared/constants/enums/lead-meta.ts`
- Create: `src/shared/types/enums/lead-meta.ts`
- Modify: `src/shared/constants/enums/index.ts` (barrel re-export)
- Modify: `src/shared/types/enums/index.ts` (barrel re-export)

**Interfaces:**
- Produces: `leadCaptureChannels: readonly ['bina','generic','funnel']` and `type LeadCaptureChannel` — consumed by A2 (pgEnum) and A4 (schema).

**Context:** Values mirror the current `leadMetaSchema.source` discriminated-union `kind` literals verbatim (`entities/customers/schemas/index.ts:113,123,124`). The enum barrels follow the MEMORY.md "Enums (const arrays)" + "Enum types" convention.

- [ ] **Step 1: Create the const array**

Create `src/shared/constants/enums/lead-meta.ts`:

```ts
// Lead capture channel — the payload-SHAPE discriminant for a lead's origin,
// decoupled from the dynamic lead-source slug. Mirrors the retired
// leadMetaSchema.source.kind literals 1:1.
// see docs/superpowers/specs/2026-07-03-jsonb-restructure-design.md §7.2
export const leadCaptureChannels = ['bina', 'generic', 'funnel'] as const
export type LeadCaptureChannel = (typeof leadCaptureChannels)[number]
```

- [ ] **Step 2: Create the type re-export**

Create `src/shared/types/enums/lead-meta.ts`:

```ts
export type { LeadCaptureChannel } from '@/shared/constants/enums/lead-meta'
```

- [ ] **Step 3: Wire both barrels**

In `src/shared/constants/enums/index.ts` add (respecting existing sort-disable ordering):

```ts
export * from './lead-meta'
```

In `src/shared/types/enums/index.ts` add the analogous `export * from './lead-meta'`.

- [ ] **Step 4: Type-check & commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/constants/enums/lead-meta.ts src/shared/types/enums/lead-meta.ts src/shared/constants/enums/index.ts src/shared/types/enums/index.ts
git commit -m "feat(lead-meta): add leadCaptureChannel enum (const array + type)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task A2: Author the residual `source_data` Zod schema + `RequestedTrade` type in the entity home

**Files:**
- Create: `src/shared/entities/lead-meta/schemas/index.ts`
- Create: `src/shared/entities/lead-meta/lib/constants.ts` (the entity-name constant)

**Interfaces:**
- Produces: `leadSourceTailSchema` (Zod) + `type LeadSourceTail`, `requestedTradeSchema` + `type RequestedTrade`, `binaSourceTailSchema` — consumed by A3 (table `$type`), A4 (insert schema), A5 (mapper), A9 (backfill).
- Produces: `LEAD_META = 'LeadMeta' as const` — the CASL subject / entityName, consumed by A6 (spec) and abilities.

**Context:** `EnrichmentRecord` already exists at `entities/customers/schemas/index.ts:70-74` — import and reuse it (do NOT re-declare). The bina tail is the 8 nullable strings from the retired `source` bina branch. `_v` is the mandatory schema-version field (WS-1 governance) on the persistent residual blob.

- [ ] **Step 1: Create the entity-name constant**

Create `src/shared/entities/lead-meta/lib/constants.ts`:

```ts
export const LEAD_META = 'LeadMeta' as const
```

- [ ] **Step 2: Create the schemas file**

Create `src/shared/entities/lead-meta/schemas/index.ts`:

```ts
import z from 'zod'

import { enrichmentRecordSchema } from '@/shared/entities/customers/schemas'

// Human-confirmed app-trade link (agent-filled). Unchanged shape from the
// retired leadMetaSchema.requestedTrades — a real column on lead_meta, typed here.
export const requestedTradeSchema = z.object({
  tradeId: z.string(),
  scopeIds: z.array(z.string()),
})
export type RequestedTrade = z.infer<typeof requestedTradeSchema>

// The bina heterogeneous tail — verbatim from the retired source.kind==='bina'
// branch. Lives in source_data.bina (residual JSONB), NOT as real columns:
// sparse, fetched-whole, never queried, per the WS-1 placement rule.
export const binaSourceTailSchema = z.object({
  budgetSolution: z.string().nullable(),
  rebateAmount: z.string().nullable(),
  bathroomAge: z.string().nullable(),
  bathroomSize: z.string().nullable(),
  bathroomScope: z.string().nullable(),
  kitchenAge: z.string().nullable(),
  kitchenSize: z.string().nullable(),
  kitchenScope: z.string().nullable(),
})
export type BinaSourceTail = z.infer<typeof binaSourceTailSchema>

// Residual per-source tail — the ONLY heterogeneous part of lead_meta. Everything
// queryable/attribution/CAPI is a real column; this holds funnel enrichment
// (progressive object-map; deep-merge target) + the bina detail blob.
// `_v` is the mandatory schema version (WS-1 governance).
// see docs/codebase-conventions/jsonb-columns.md#mandatory-schema-version
export const leadSourceTailSchema = z.object({
  _v: z.literal(1).default(1),
  enrichment: enrichmentRecordSchema.optional(),
  bina: binaSourceTailSchema.optional(),
})
export type LeadSourceTail = z.infer<typeof leadSourceTailSchema>
```

- [ ] **Step 3: Type-check & commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/entities/lead-meta/schemas/index.ts src/shared/entities/lead-meta/lib/constants.ts
git commit -m "feat(lead-meta): residual source_data schema + RequestedTrade + entity name

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task A3: Create the `lead_meta` Drizzle table

**Files:**
- Create: `src/shared/db/schema/lead-meta.ts`
- Modify: `src/shared/db/schema/index.ts` (barrel export)
- Modify: `src/shared/db/schema/meta.ts` (add the `pgEnum`)

**Interfaces:**
- Produces: `leadMeta` table + `selectLeadMetaSchema`/`insertLeadMetaSchema`/`LeadMetaRecord`/`InsertLeadMeta` — consumed by A5 (mapper types), A6 (spec), A9 (backfill), and Phase B.

**Context:** FK conventions copied verbatim from `customers.ts:29` (`leadSourceId` → `set null`) and `:49` (`user.id` FK is `text`, not uuid). `customer_id` has **NO `.unique()`** — 1:many-capable per §7.1. `id/createdAt/updatedAt` from `schema-helpers`.

- [ ] **Step 1: Add the pgEnum to `meta.ts`**

In `src/shared/db/schema/meta.ts`, add `leadCaptureChannels` to the existing enum-source import block (top of file) and declare the enum beside `leadTypeEnum` (`:59`):

```ts
// (add to the existing import from '@/shared/constants/enums')
import { /* …existing… */ leadCaptureChannels } from '@/shared/constants/enums'

export const leadCaptureChannelEnum = pgEnum('lead_capture_channel', leadCaptureChannels)
```

- [ ] **Step 2: Create the table**

Create `src/shared/db/schema/lead-meta.ts`:

```ts
import type z from 'zod'
import type { RequestedTrade } from '@/shared/entities/lead-meta/schemas'

import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

import { leadSourceTailSchema } from '@/shared/entities/lead-meta/schemas'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'
import { leadSourcesTable } from './lead-sources'
import { leadCaptureChannelEnum } from './meta'

// The coherent lead-metadata home. 1:many-capable (customer_id is a plain FK,
// NO unique) — one row per lead touch; "latest wins" for current attribution.
// Real columns for everything queryable/attribution/CAPI-critical; source_data
// JSONB holds only the heterogeneous per-source tail.
// see docs/superpowers/specs/2026-07-03-jsonb-restructure-design.md §7.2
export const leadMeta = pgTable('lead_meta', {
  id,
  customerId: uuid('customer_id').notNull()
    .references(() => customers.id, { onDelete: 'cascade' }), // no unique → 1:many-capable

  // ── ATTRIBUTION (real columns — the single coherent home) ──
  leadSourceId: uuid('lead_source_id').references(() => leadSourcesTable.id, { onDelete: 'set null' }),
  captureChannel: leadCaptureChannelEnum('capture_channel').notNull(), // = retired source.kind
  originCampaign: text('origin_campaign'),
  funnelSlug: text('funnel_slug'),
  offer: text('offer'),

  // ── UTM + META (real columns — CAPI dedup + analytics) ──
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  utmContent: text('utm_content'),
  utmTerm: text('utm_term'),
  fbclid: text('fbclid'),
  gclid: text('gclid'),
  fbp: text('fbp'), // CAPI-critical
  fbc: text('fbc'), // CAPI-critical

  // ── OPERATIONAL (real columns) ──
  mp3RecordingKey: text('mp3_recording_key'),
  closedByUserId: text('closed_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  scheduledFor: timestamp('scheduled_for', { mode: 'string', withTimezone: true }),
  phoneVerificationStatus: text('phone_verification_status'),
  phoneLineType: text('phone_line_type'),
  phoneCarrierName: text('phone_carrier_name'),

  // ── ENVELOPE (source-agnostic; typed JSONB arrays — full-list submit, no merge) ──
  interestedTradesRaw: jsonb('interested_trades_raw').$type<string[]>(),
  requestedTrades: jsonb('requested_trades').$type<RequestedTrade[]>(),

  // ── CONSENT (real columns — audit/legal) ──
  consentAgreed: boolean('consent_agreed').default(false),
  consentAt: timestamp('consent_at', { mode: 'string', withTimezone: true }),

  // ── RESIDUAL: heterogeneous per-source tail ONLY (funnel enrichment + bina) ──
  // Keyed enrichment writes go through the WS-2 deep-merge (jsonbMergeColumns).
  sourceData: jsonb('source_data').$type<z.infer<typeof leadSourceTailSchema>>(),

  createdAt,
  updatedAt,
})

export const selectLeadMetaSchema = createSelectSchema(leadMeta, {
  sourceData: leadSourceTailSchema.nullable(),
})
export type LeadMetaRecord = z.infer<typeof selectLeadMetaSchema>

export const insertLeadMetaSchema = createInsertSchema(leadMeta, {
  // Zod-parse the residual blob at the write boundary (`.$type<>()` is a no-op).
  sourceData: leadSourceTailSchema.optional(),
}).omit({ id: true, createdAt: true, updatedAt: true })
export type InsertLeadMeta = z.infer<typeof insertLeadMetaSchema>
```

- [ ] **Step 3: Add the barrel export**

In `src/shared/db/schema/index.ts`, after the `customers` line (keep the existing sort-disable ordering), add:

```ts
export * from './lead-meta'
```

- [ ] **Step 4: Push to the dev branch (isolated Neon) and type-check**

```bash
pnpm db:push:dev
pnpm tsc && pnpm lint
```

Expected: `db:push:dev` creates `lead_meta` + the `lead_capture_channel` enum type on the worktree's Neon branch; tsc/lint clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/db/schema/lead-meta.ts src/shared/db/schema/index.ts src/shared/db/schema/meta.ts
git commit -m "feat(lead-meta): add lead_meta table + lead_capture_channel enum

Hybrid 1:many-capable table — real columns for attribution/CAPI/queryable
fields, source_data JSONB for the heterogeneous per-source tail. Additive;
customers.leadMetaJSON stays authoritative until Phase B.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task A4: The pure `flattenLeadMetaToRow` mapper (TDD)

**Files:**
- Create: `src/shared/entities/lead-meta/lib/flatten-lead-meta.test.ts`
- Create: `src/shared/entities/lead-meta/lib/flatten-lead-meta.ts`

**Interfaces:**
- Produces: `flattenLeadMetaToRow(leadMeta: LeadMeta | null | undefined, ids: { customerId: string, leadSourceId: string | null }): InsertLeadMeta` — consumed by A7 (dual-write) and A9 (backfill).

**Context:** This is THE mapping the whole workstream turns on — the blob→columns split. It is pure (no `db`), so it is the durable regression guard (vitest was added in WS-2). The discriminated `source` union collapses: `funnel` → utm/meta/offer/funnelSlug/consent columns + `source_data.enrichment`; `bina` → `source_data.bina`; `generic` → nothing extra. `captureChannel` defaults to `'generic'` when `source` is absent (legacy leads). Timestamps pass through as ISO strings (`scheduled_for`/`consent_at` are `mode:'string'`).

- [ ] **Step 1: Write the failing tests**

Create `src/shared/entities/lead-meta/lib/flatten-lead-meta.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { flattenLeadMetaToRow } from './flatten-lead-meta'

const IDS = { customerId: 'cust-1', leadSourceId: 'src-1' }

describe('flattenLeadMetaToRow', () => {
  it('maps a funnel lead: utm/meta/offer → columns, enrichment → source_data', () => {
    const row = flattenLeadMetaToRow(
      {
        interestedTradesRaw: ['Roofing'],
        originCampaign: 'spring-roof',
        source: {
          kind: 'funnel',
          offer: 'free-inspection',
          funnelSlug: 'roofing',
          utm: { source: 'fb', medium: 'cpc', campaign: 'c', content: null, term: null, fbclid: 'abc', gclid: null },
          meta: { fbp: 'fbp1', fbc: 'fbc1' },
          enrichment: { roofAge: { label: 'Roof age', value: '10-15y', order: 1 } },
          consent: { agreed: true, at: '2026-07-01T00:00:00.000Z' },
        },
      },
      IDS,
    )
    expect(row.customerId).toBe('cust-1')
    expect(row.leadSourceId).toBe('src-1')
    expect(row.captureChannel).toBe('funnel')
    expect(row.offer).toBe('free-inspection')
    expect(row.funnelSlug).toBe('roofing')
    expect(row.utmSource).toBe('fb')
    expect(row.utmCampaign).toBe('c')
    expect(row.fbclid).toBe('abc')
    expect(row.fbp).toBe('fbp1')
    expect(row.fbc).toBe('fbc1')
    expect(row.originCampaign).toBe('spring-roof')
    expect(row.interestedTradesRaw).toEqual(['Roofing'])
    expect(row.consentAgreed).toBe(true)
    expect(row.consentAt).toBe('2026-07-01T00:00:00.000Z')
    expect(row.sourceData).toEqual({ _v: 1, enrichment: { roofAge: { label: 'Roof age', value: '10-15y', order: 1 } } })
    // funnel carries no bina tail
    expect(row.sourceData?.bina).toBeUndefined()
  })

  it('maps a bina lead: 8 bina fields → source_data.bina, capture_channel=bina', () => {
    const row = flattenLeadMetaToRow(
      {
        interestedTradesRaw: ['Kitchen Renovation'],
        scheduledFor: '2026-07-05T10:00:00.000Z',
        source: {
          kind: 'bina',
          budgetSolution: 'financing',
          rebateAmount: '500',
          bathroomAge: null,
          bathroomSize: null,
          bathroomScope: null,
          kitchenAge: '10y',
          kitchenSize: 'large',
          kitchenScope: 'full',
        },
      },
      { customerId: 'c', leadSourceId: null },
    )
    expect(row.captureChannel).toBe('bina')
    expect(row.leadSourceId).toBeNull()
    expect(row.scheduledFor).toBe('2026-07-05T10:00:00.000Z')
    expect(row.sourceData).toEqual({
      _v: 1,
      bina: {
        budgetSolution: 'financing', rebateAmount: '500',
        bathroomAge: null, bathroomSize: null, bathroomScope: null,
        kitchenAge: '10y', kitchenSize: 'large', kitchenScope: 'full',
      },
    })
    expect(row.utmSource).toBeNull()
    expect(row.fbp).toBeNull()
  })

  it('maps operational-only lead (intake form): mp3/closedBy/requestedTrades, channel=generic', () => {
    const row = flattenLeadMetaToRow(
      {
        mp3RecordingKey: 'r2/key.mp3',
        closedBy: 'user-9',
        scheduledFor: '2026-07-06T12:00:00.000Z',
        requestedTrades: [{ tradeId: 't1', scopeIds: ['s1', 's2'] }],
        phoneVerification: { status: 'verified', lineType: 'mobile', carrierName: 'Verizon' },
      },
      IDS,
    )
    expect(row.captureChannel).toBe('generic')
    expect(row.mp3RecordingKey).toBe('r2/key.mp3')
    expect(row.closedByUserId).toBe('user-9')
    expect(row.requestedTrades).toEqual([{ tradeId: 't1', scopeIds: ['s1', 's2'] }])
    expect(row.phoneVerificationStatus).toBe('verified')
    expect(row.phoneLineType).toBe('mobile')
    expect(row.phoneCarrierName).toBe('Verizon')
    // no enrichment, no bina → source_data omitted (null-equivalent)
    expect(row.sourceData).toBeUndefined()
  })

  it('null/undefined leadMeta → a minimal generic row (customer_id + channel only)', () => {
    const row = flattenLeadMetaToRow(null, IDS)
    expect(row.customerId).toBe('cust-1')
    expect(row.captureChannel).toBe('generic')
    expect(row.leadSourceId).toBe('src-1')
    expect(row.interestedTradesRaw).toBeUndefined()
    expect(row.sourceData).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/shared/entities/lead-meta/lib/flatten-lead-meta.test.ts`
Expected: FAIL — cannot resolve `./flatten-lead-meta`.

- [ ] **Step 3: Write the implementation**

Create `src/shared/entities/lead-meta/lib/flatten-lead-meta.ts`:

```ts
import type { InsertLeadMeta } from '@/shared/db/schema/lead-meta'
import type { LeadMeta } from '@/shared/entities/customers/schemas'
import type { LeadSourceTail } from '@/shared/entities/lead-meta/schemas'

// Pure blob→columns mapper: the retired fat `LeadMeta` union → a lead_meta insert
// row. Shared by the dual-write (customer-intake.service) and the backfill script.
// Real columns for attribution/CAPI/operational; source_data holds only the
// heterogeneous per-source tail (funnel enrichment + bina detail). No db, no I/O.
// see docs/superpowers/specs/2026-07-03-jsonb-restructure-design.md §7.2
export function flattenLeadMetaToRow(
  leadMeta: LeadMeta | null | undefined,
  ids: { customerId: string, leadSourceId: string | null },
): InsertLeadMeta {
  const m = leadMeta ?? {}
  const source = m.source

  // Assemble the residual tail; omit when empty so source_data stays null.
  const tail: LeadSourceTail = { _v: 1 }
  if (source?.kind === 'funnel' && source.enrichment) {
    tail.enrichment = source.enrichment
  }
  if (source?.kind === 'bina') {
    tail.bina = {
      budgetSolution: source.budgetSolution,
      rebateAmount: source.rebateAmount,
      bathroomAge: source.bathroomAge,
      bathroomSize: source.bathroomSize,
      bathroomScope: source.bathroomScope,
      kitchenAge: source.kitchenAge,
      kitchenSize: source.kitchenSize,
      kitchenScope: source.kitchenScope,
    }
  }
  const hasTail = tail.enrichment !== undefined || tail.bina !== undefined

  return {
    customerId: ids.customerId,
    leadSourceId: ids.leadSourceId,
    captureChannel: source?.kind ?? 'generic',
    originCampaign: m.originCampaign ?? null,
    funnelSlug: source?.kind === 'funnel' ? source.funnelSlug : null,
    offer: source?.kind === 'funnel' ? source.offer : null,

    utmSource: source?.kind === 'funnel' ? source.utm.source : null,
    utmMedium: source?.kind === 'funnel' ? source.utm.medium : null,
    utmCampaign: source?.kind === 'funnel' ? source.utm.campaign : null,
    utmContent: source?.kind === 'funnel' ? source.utm.content : null,
    utmTerm: source?.kind === 'funnel' ? source.utm.term : null,
    fbclid: source?.kind === 'funnel' ? source.utm.fbclid : null,
    gclid: source?.kind === 'funnel' ? source.utm.gclid : null,
    fbp: source?.kind === 'funnel' ? (source.meta?.fbp ?? null) : null,
    fbc: source?.kind === 'funnel' ? (source.meta?.fbc ?? null) : null,

    mp3RecordingKey: m.mp3RecordingKey ?? null,
    closedByUserId: m.closedBy ?? null,
    scheduledFor: m.scheduledFor ?? null,
    phoneVerificationStatus: m.phoneVerification?.status ?? null,
    phoneLineType: m.phoneVerification?.lineType ?? null,
    phoneCarrierName: m.phoneVerification?.carrierName ?? null,

    interestedTradesRaw: m.interestedTradesRaw,
    requestedTrades: m.requestedTrades,

    consentAgreed: source?.kind === 'funnel' ? (source.consent?.agreed ?? false) : false,
    consentAt: source?.kind === 'funnel' ? (source.consent?.at ?? null) : null,

    sourceData: hasTail ? tail : undefined,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/shared/entities/lead-meta/lib/flatten-lead-meta.test.ts`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Type-check, lint, commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/entities/lead-meta/lib/flatten-lead-meta.ts src/shared/entities/lead-meta/lib/flatten-lead-meta.test.ts
git commit -m "feat(lead-meta): pure flattenLeadMetaToRow blob→columns mapper (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task A5: The `lead-meta` DAL (generic CRUD via `createCrudDal`)

**Files:**
- Create: `src/shared/entities/lead-meta/lib/server-spec.ts`
- Create: `src/shared/entities/lead-meta/dal/server/crud.ts`
- Create: `src/shared/entities/lead-meta/lib/visibility.ts`
- Modify: `src/shared/domains/permissions/abilities.ts` (register `LEAD_META` in `ENTITY_NAMES`)

**Interfaces:**
- Produces: `leadMetaCrud` (`CrudHandlers<typeof leadMeta>`: `create/getById/update/delete/duplicate`, each `→ Promise<DalReturn<...>>`) — consumed by A7 (dual-write `leadMetaCrud.create`) and Phase B (`.update` for enrichment merge).
- Produces: `leadMetaServerSpec` + `leadMetaSchemas` — consumed by A6 (router).

**Context:** `lead_meta` is a child of `customers` — visibility inherits from the parent customer's scope. Because Phase A writes with `SYSTEM_CONTEXT` (scope `null`, omni) and reads in Phase B are server-side joins under the customer's existing scope, the visibility predicate can be permissive at first (omni-only writers). Follow the proposals template (`entities/proposals/lib/server-spec.ts` + `dal/server/crud.ts`). `jsonbMergeColumns: [leadMeta.sourceData]` opts the residual blob into the WS-2 deep-merge (needed for the Phase B enrichment retarget).

- [ ] **Step 1: Register the entity name in abilities**

In `src/shared/domains/permissions/abilities.ts`, import `LEAD_META` from `@/shared/entities/lead-meta/lib/constants` and add it to `ENTITY_NAMES` (per `docs/how-to/add-an-entity.md` Step 2). Add CASL rules mirroring `Customer` (an agent who can read a customer can read its lead_meta; super-admin manage-all covers writes).

- [ ] **Step 2: Write the visibility predicate**

Create `src/shared/entities/lead-meta/lib/visibility.ts` — a child of customers, so gate on the parent customer being visible:

```ts
import { eq, exists } from 'drizzle-orm'

import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { leadMeta } from '@/shared/db/schema/lead-meta'
import { customerVisibility } from '@/shared/entities/customers/lib/visibility'

// A lead_meta row is visible iff its parent customer is. Reuse the customer
// predicate rather than re-deriving scope here (entity owns its visibility).
export const leadMetaVisibility = (userId: string) =>
  exists(
    db.select()
      .from(customers)
      .where(eq(customers.id, leadMeta.customerId))
      .where(customerVisibility(userId)),
  )
```

> Implementer: verify `customerVisibility`'s exact export name/signature in `entities/customers/lib/visibility.ts` before wiring; if customers use a different visibility mechanism (CASL omni + SQL predicate — see `pattern-visibility-scoping`), match it. If no reusable predicate exists, gate omni-only for Phase A (writes are `SYSTEM_CONTEXT`) and open a follow-up to tighten before any agent-facing `lead_meta` read lands.

- [ ] **Step 3: Write the server-spec**

Create `src/shared/entities/lead-meta/lib/server-spec.ts`:

```ts
import type { EntityServerSpec } from '@/shared/dal/server/types'

import { insertLeadMetaSchema, leadMeta, selectLeadMetaSchema } from '@/shared/db/schema'
import { LEAD_META } from '@/shared/entities/lead-meta/lib/constants'
import { leadMetaVisibility } from '@/shared/entities/lead-meta/lib/visibility'

const updateLeadMetaSchema = insertLeadMetaSchema.partial()

/** Concrete schemas for createCrudRouter type inference (spec carries type-erased copies). */
export const leadMetaSchemas = {
  insert: insertLeadMetaSchema,
  update: updateLeadMetaSchema,
}

export const leadMetaServerSpec = {
  entityName: LEAD_META,
  caslSubject: LEAD_META,
  visibility: leadMetaVisibility,
  table: leadMeta,
  schemas: {
    insert: insertLeadMetaSchema,
    update: updateLeadMetaSchema,
    select: selectLeadMetaSchema,
  },
  update: {
    // source_data deep-merges (WS-2) so a partial {enrichment} patch never
    // deletes the bina tail or a sibling enrichment key.
    // see docs/codebase-conventions/jsonb-columns.md#never-shallow-merge-nested
    jsonbMergeColumns: [leadMeta.sourceData] as const,
  },
} satisfies EntityServerSpec<typeof leadMeta>
```

- [ ] **Step 4: Write the CRUD instance**

Create `src/shared/entities/lead-meta/dal/server/crud.ts`:

```ts
import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { leadMetaServerSpec } from '@/shared/entities/lead-meta/lib/server-spec'

/** Stable CRUD handlers for the lead_meta entity. Single instance, fully typed. */
export const leadMetaCrud = createCrudDal(leadMetaServerSpec)
```

- [ ] **Step 5: Type-check, lint, commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/entities/lead-meta/lib/server-spec.ts src/shared/entities/lead-meta/dal/server/crud.ts src/shared/entities/lead-meta/lib/visibility.ts src/shared/domains/permissions/abilities.ts
git commit -m "feat(lead-meta): server-spec + generic CRUD DAL + visibility

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task A6: Register the `lead-meta` tRPC router

**Files:**
- Create: `src/trpc/routers/lead-meta.router.ts`
- Modify: `src/trpc/routers/app.ts` (import + register)

**Interfaces:**
- Consumes: `leadMetaServerSpec`, `leadMetaSchemas` from A5.
- Produces: `leadMetaRouter` with a `crud` sub-router — registered in `appRouter`.

**Context:** Minimal entity router — CRUD only for now (no business queries; reads in Phase B are server-side joins in existing routers/services, not client tRPC calls). Follow `proposals.router/index.ts:14-25` but flat (no sub-dir needed).

- [ ] **Step 1: Write the router**

Create `src/trpc/routers/lead-meta.router.ts`:

```ts
import z from 'zod'

import { leadMetaSchemas, leadMetaServerSpec } from '@/shared/entities/lead-meta/lib/server-spec'

import { createTRPCRouter } from '../init'
import { createCrudRouter } from '../lib/create-crud-router'
import { createEntityRouter } from '../lib/create-entity-router'

export const leadMetaRouter = createEntityRouter(leadMetaServerSpec, (entity) => {
  return createTRPCRouter({
    crud: createCrudRouter({
      spec: leadMetaServerSpec,
      schemas: { ...leadMetaSchemas, id: z.string().uuid() },
      authedProcedure: entity.authedProcedure,
    }),
  })
})
```

> Implementer: verify `createCrudRouter`'s required arg shape against `proposals.router/index.ts` — proposals passes `shareableProcedure`; lead_meta is not shareable, so pass only what the factory requires (likely `authedProcedure` alone). Match the actual signature.

- [ ] **Step 2: Register in app.ts**

In `src/trpc/routers/app.ts`, add `import { leadMetaRouter } from './lead-meta.router'` and add `leadMetaRouter,` to the `createTRPCRouter({...})` object.

- [ ] **Step 3: Type-check, lint, commit**

```bash
pnpm tsc && pnpm lint
git add src/trpc/routers/lead-meta.router.ts src/trpc/routers/app.ts
git commit -m "feat(lead-meta): register lead-meta tRPC entity router (CRUD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task A7: Dual-write `lead_meta` in `ingestLead`

**Files:**
- Modify: `src/shared/services/customer-intake.service.ts` (after the `customerCrud.create` at `:65-79`)

**Interfaces:**
- Consumes: `flattenLeadMetaToRow` (A4), `leadMetaCrud` (A5).
- Produces: a `lead_meta` row per lead, written alongside the existing `customers.leadMetaJSON`. Non-breaking (blob still authoritative).

**Context:** ALL four create flows converge here (`business.router`, `funnels.router`, bina webhook route, and by extension `intake-form-view`). One insert appended after the customer create covers every path. `leadSourceId` is resolved at `:62`; `input.leadMeta` is the fully-built blob. Best-effort like the note/enroll steps — a failed `lead_meta` insert must NOT roll back the customer during Phase A (blob is still the source of truth), but log loudly.

- [ ] **Step 1: Add the imports**

At the top of `customer-intake.service.ts`, add:

```ts
import { leadMetaCrud } from '@/shared/entities/lead-meta/dal/server/crud'
import { flattenLeadMetaToRow } from '@/shared/entities/lead-meta/lib/flatten-lead-meta'
```

- [ ] **Step 2: Insert the dual-write**

Immediately after `const customer = created.data` (currently `:79`), before the auto-enroll block, add:

```ts
      // ── Dual-write lead_meta (WS-5 expand-and-contract; blob still authoritative) ──
      // Best-effort during Phase A: a failed lead_meta insert must not drop the
      // lead (customers.leadMetaJSON remains the read source until Phase B).
      const leadMetaRow = flattenLeadMetaToRow(input.leadMeta, {
        customerId: customer.id,
        leadSourceId,
      })
      const leadMetaResult = await leadMetaCrud.create(ctx, leadMetaRow)
      if (!leadMetaResult.success) {
        console.error('[customerIntake] lead_meta dual-write failed (customer kept)', leadMetaResult.error)
      }
```

- [ ] **Step 3: Type-check & lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean. (`leadMetaCrud.create` accepts `InsertLeadMeta`, which `flattenLeadMetaToRow` returns.)

- [ ] **Step 4: Smoke the dual-write against dev**

Create a throwaway `scripts/smoke-lead-meta-dualwrite.ts` (`import './lib/load-env'`) that calls `customerIntakeService.ingestLead(SYSTEM_CONTEXT, { core: {...bina-ish...}, leadMeta: {...funnel-ish with utm+enrichment...} })`, then `SELECT * FROM lead_meta WHERE customer_id = <new id>` and asserts columns (utm/fbp/capture_channel) + `source_data.enrichment` are populated. Run `pnpm tsx scripts/smoke-lead-meta-dualwrite.ts`, confirm, then `rm` it and verify `git status --porcelain` is clean of the script.

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/customer-intake.service.ts
git commit -m "feat(lead-meta): dual-write lead_meta alongside leadMetaJSON in ingestLead

Every lead-create flow converges on ingestLead; one insert covers funnel,
bina, and in-app intake. Best-effort in Phase A — the blob stays the read
source until Phase B flips reads.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task A8: Backfill script — clone `backfill-interested-trades-raw.ts`

**Files:**
- Create: `scripts/backfill-lead-meta.ts`
- Modify: `package.json` (add `backfill:lead-meta:dev` / `backfill:lead-meta` scripts, mirroring the trades backfill entries)

**Interfaces:**
- Consumes: `flattenLeadMetaToRow` (A4), the `customers` + `lead_meta` tables.
- Produces: one `lead_meta` row per pre-existing customer that has `leadMetaJSON` OR `leadSourceId` but no `lead_meta` row yet.

**Context:** Clone the idempotent, dry-run-default, `NODE_ENV`-targeted pattern of `scripts/backfill-interested-trades-raw.ts` verbatim (its header comment block explains the conventions). Idempotency key: skip a customer that already has ≥1 `lead_meta` row (1:many-capable, but the backfill writes at most one "legacy" row per customer). Reuse the SAME `flattenLeadMetaToRow` mapper as the dual-write so backfilled and live rows are byte-identical in shape. If dev has no realistic data, `pnpm db:snapshot` first (copies prod→dev with 🧪 markers).

- [ ] **Step 1: Write the backfill script**

Create `scripts/backfill-lead-meta.ts`:

```ts
/* eslint-disable no-console */
/**
 * One-shot backfill: create a `lead_meta` row for every pre-existing customer
 * that carries lead metadata (`leadMetaJSON`) or a `leadSourceId`, flattening
 * the blob into the new hybrid table via the SAME mapper the dual-write uses.
 *
 * WHY: WS-5 moves lead metadata + leadSourceId + originCampaign out of
 * `customers` into `lead_meta`. New leads dual-write at ingest; pre-existing
 * leads need this one-time backfill so Phase B can flip reads without loss.
 *
 * Idempotent + re-runnable:
 *   - skips customers that already have a lead_meta row
 *   - skips customers with neither leadMetaJSON nor leadSourceId (nothing to carry)
 *   - flattening the same blob twice yields the same row
 *
 * Target DB via NODE_ENV (runtime client reads DATABASE_URL vs DATABASE_DEV_URL):
 *   dev :  pnpm backfill:lead-meta:dev   (or: tsx scripts/backfill-lead-meta.ts)
 *   prod:  pnpm backfill:lead-meta       (NODE_ENV=production)
 *
 * Flags: --dry-run   report what WOULD change; write nothing.
 *
 * Run AFTER the dual-write is deployed, at prod-push time.
 */
import './lib/load-env'
import { eq, inArray, isNotNull, or } from 'drizzle-orm'

import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { leadMeta } from '@/shared/db/schema/lead-meta'
import { flattenLeadMetaToRow } from '@/shared/entities/lead-meta/lib/flatten-lead-meta'

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  const target = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'dev'
  console.log(`[backfill:lead-meta] target=${target}${DRY_RUN ? ' (DRY RUN — no writes)' : ''}`)

  // Customers carrying lead metadata OR a lead source.
  const rows = await db
    .select({
      id: customers.id,
      leadMetaJSON: customers.leadMetaJSON,
      leadSourceId: customers.leadSourceId,
    })
    .from(customers)
    .where(or(isNotNull(customers.leadMetaJSON), isNotNull(customers.leadSourceId)))

  // Which of those already have a lead_meta row (idempotency).
  const ids = rows.map(r => r.id)
  const existing = ids.length > 0
    ? await db.select({ customerId: leadMeta.customerId }).from(leadMeta).where(inArray(leadMeta.customerId, ids))
    : []
  const alreadyMigrated = new Set(existing.map(e => e.customerId))

  let created = 0
  let skippedExisting = 0

  for (const row of rows) {
    if (alreadyMigrated.has(row.id)) {
      skippedExisting++
      continue
    }
    const insertRow = flattenLeadMetaToRow(row.leadMetaJSON, {
      customerId: row.id,
      leadSourceId: row.leadSourceId,
    })
    console.log(`  ${DRY_RUN ? '[would create]' : '[create]'} lead_meta for ${row.id} (channel=${insertRow.captureChannel})`)
    if (!DRY_RUN) {
      // Parse at the write boundary; do NOT set updatedAt (schema-helper $onUpdate).
      await db.insert(leadMeta).values(insertRow)
    }
    created++
  }

  console.log('[backfill:lead-meta] summary', {
    scanned: rows.length,
    created: DRY_RUN ? 0 : created,
    wouldCreate: DRY_RUN ? created : undefined,
    skippedAlreadyMigrated: skippedExisting,
  })
  process.exit(0)
}

main().catch((err) => { console.error('[backfill:lead-meta] failed', err); process.exit(1) })
```

> Note: the raw `db.insert(leadMeta).values(insertRow)` here bypasses the CRUD Zod parse — acceptable in a controlled backfill because `flattenLeadMetaToRow` produces schema-shaped output and the source is our own historical data. If you prefer belt-and-suspenders, wrap with `insertLeadMetaSchema.parse(insertRow)` before insert.

- [ ] **Step 2: Add package.json scripts**

Mirror the existing `backfill:trades*` entries in `package.json` `"scripts"`:

```json
"backfill:lead-meta:dev": "tsx scripts/backfill-lead-meta.ts",
"backfill:lead-meta": "NODE_ENV=production tsx scripts/backfill-lead-meta.ts"
```

- [ ] **Step 3: Dry-run then real-run against dev**

```bash
pnpm backfill:lead-meta:dev --dry-run
pnpm backfill:lead-meta:dev
pnpm backfill:lead-meta:dev            # second run: expect skippedAlreadyMigrated == created-from-run-1, created == 0 (idempotent)
```

Expected: dry-run reports candidates and writes nothing; real run creates rows; the second real run creates 0 (idempotent).

- [ ] **Step 4: Type-check, lint, commit**

```bash
pnpm tsc && pnpm lint
git add scripts/backfill-lead-meta.ts package.json
git commit -m "feat(lead-meta): idempotent lead_meta backfill (dry-run default)

Clones the interested-trades-raw backfill pattern; reuses flattenLeadMetaToRow
so backfilled rows are shape-identical to dual-write rows.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

**End of Phase A (PR1).** Open the PR: `lead_meta` table + entity home + dual-write + backfill, all additive. `pnpm lint && pnpm tsc` green; backfill idempotency proven on dev. Nothing reads `lead_meta` yet.

---

## Phase B (PR2) — Flip reads + retarget + drop (destructive)

Phase B is gated on Phase A being merged AND the prod backfill having run. It flips every read from the blob to `lead_meta`, retargets the enrichment merge, parity-checks CAPI in a real browser, then drops `customers.leadMetaJSON` + `customers.leadSourceId`.

### Task B1: `reassembleLeadMetaView` — inverse mapper (TDD)

**Files:**
- Create: `src/shared/entities/lead-meta/lib/reassemble-lead-meta-view.test.ts`
- Create: `src/shared/entities/lead-meta/lib/reassemble-lead-meta-view.ts`

**Interfaces:**
- Produces: `reassembleLeadMetaView(row: LeadMetaRecord): LeadMeta` — reconstructs a `LeadMeta`-shaped object from a `lead_meta` row so the many read sites that consume a whole `LeadMeta` (note builders, profile panels, `funnel-intake-panel`) flip with a one-line source swap and NO internal rewrite.

**Context:** This is the exact inverse of `flattenLeadMetaToRow`. It lets us keep `buildLeadNote`, `buildFunnelLeadNote`, `FunnelIntakePanel`, `lead-drawer-identity` UNCHANGED — they still receive a `LeadMeta`, we just build it from a row instead of reading the column. Round-trip property: `reassemble(flatten(m)) ≈ m` for the fields both retain. Keep it a pure function (vitest).

- [ ] **Step 1: Write failing tests** — assert round-trip for a funnel row (utm/meta/offer/enrichment reconstructed under `source.kind==='funnel'`), a bina row (`source.kind==='bina'` + 8 fields from `source_data.bina`), and an operational row (mp3/closedBy/requestedTrades, `source` undefined for `generic`). Run `pnpm test .../reassemble-lead-meta-view.test.ts` → FAIL.

- [ ] **Step 2: Write the implementation**

Create `src/shared/entities/lead-meta/lib/reassemble-lead-meta-view.ts`:

```ts
import type { LeadMetaRecord } from '@/shared/db/schema/lead-meta'
import type { LeadMeta } from '@/shared/entities/customers/schemas'

// Inverse of flattenLeadMetaToRow: a lead_meta row → a LeadMeta-shaped view.
// Lets the many whole-object consumers (note builders, profile panels) flip
// their source without any internal rewrite. Pure; no I/O.
export function reassembleLeadMetaView(row: LeadMetaRecord): LeadMeta {
  const base: LeadMeta = {
    mp3RecordingKey: row.mp3RecordingKey ?? undefined,
    closedBy: row.closedByUserId ?? undefined,
    scheduledFor: row.scheduledFor ?? undefined,
    interestedTradesRaw: row.interestedTradesRaw ?? undefined,
    requestedTrades: row.requestedTrades ?? undefined,
    originCampaign: row.originCampaign ?? undefined,
    phoneVerification: row.phoneVerificationStatus
      ? {
          status: row.phoneVerificationStatus as 'verified' | 'unverified',
          lineType: row.phoneLineType,
          carrierName: row.phoneCarrierName,
        }
      : undefined,
  }

  if (row.captureChannel === 'funnel') {
    base.source = {
      kind: 'funnel',
      offer: row.offer ?? '',
      funnelSlug: row.funnelSlug ?? '',
      utm: {
        source: row.utmSource, medium: row.utmMedium, campaign: row.utmCampaign,
        content: row.utmContent, term: row.utmTerm, fbclid: row.fbclid, gclid: row.gclid,
      },
      meta: { fbp: row.fbp, fbc: row.fbc },
      enrichment: row.sourceData?.enrichment,
      consent: row.consentAgreed && row.consentAt ? { agreed: true, at: row.consentAt } : undefined,
    }
  }
  else if (row.captureChannel === 'bina') {
    const b = row.sourceData?.bina
    base.source = {
      kind: 'bina',
      budgetSolution: b?.budgetSolution ?? null,
      rebateAmount: b?.rebateAmount ?? null,
      bathroomAge: b?.bathroomAge ?? null,
      bathroomSize: b?.bathroomSize ?? null,
      bathroomScope: b?.bathroomScope ?? null,
      kitchenAge: b?.kitchenAge ?? null,
      kitchenSize: b?.kitchenSize ?? null,
      kitchenScope: b?.kitchenScope ?? null,
    }
  }
  // 'generic' → no source (matches the retired blob where generic had no detail)

  return base
}
```

- [ ] **Step 3: Pass, type-check, lint, commit**

```bash
pnpm test src/shared/entities/lead-meta/lib/reassemble-lead-meta-view.test.ts
pnpm tsc && pnpm lint
git add src/shared/entities/lead-meta/lib/reassemble-lead-meta-view.ts src/shared/entities/lead-meta/lib/reassemble-lead-meta-view.test.ts
git commit -m "feat(lead-meta): reassembleLeadMetaView inverse mapper (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task B2: Add a `getLatestLeadMetaByCustomerId` query to the DAL

**Files:**
- Create: `src/shared/entities/lead-meta/dal/server/queries.ts`

**Interfaces:**
- Produces: `getLatestLeadMetaByCustomerId(customerId: string): Promise<DalReturn<LeadMetaRecord | null>>` — "latest wins" (ORDER BY createdAt DESC LIMIT 1). Consumed by B3/B4/B5 read-flips.

**Context:** 1:many table; current attribution = the latest row. Follow the DAL query conventions (`dalDbOperation`, returns `DalReturn`, no throw). Named export, no barrel.

- [ ] **Step 1: Write the query**

```ts
import type { DalReturn } from '@/shared/dal/server/types'
import type { LeadMetaRecord } from '@/shared/db/schema/lead-meta'

import { desc, eq } from 'drizzle-orm'
import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { leadMeta } from '@/shared/db/schema/lead-meta'

/** Latest lead_meta row for a customer ("latest wins" for current attribution). */
export async function getLatestLeadMetaByCustomerId(
  customerId: string,
): Promise<DalReturn<LeadMetaRecord | null>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select()
      .from(leadMeta)
      .where(eq(leadMeta.customerId, customerId))
      .orderBy(desc(leadMeta.createdAt))
      .limit(1)
    return (row as LeadMetaRecord | undefined) ?? null
  })
}
```

- [ ] **Step 2: Type-check, lint, commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/entities/lead-meta/dal/server/queries.ts
git commit -m "feat(lead-meta): getLatestLeadMetaByCustomerId (latest-wins) DAL query

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task B3: Flip the mp3-presign read (`customer-pipelines.router`)

**Files:**
- Modify: `src/trpc/routers/customer-pipelines.router.ts:75-91`

**Interfaces:**
- Consumes: `getLatestLeadMetaByCustomerId` (B2).

- [ ] **Step 1: Rewrite `getRecordingUrl`**

Before:
```ts
      const [customer] = await db
        .select({ leadMetaJSON: customers.leadMetaJSON })
        .from(customers)
        .where(eq(customers.id, input.customerId))
        .limit(1)

      const meta = customer?.leadMetaJSON as LeadMeta | null
      if (!meta?.mp3RecordingKey) {
        return { url: null }
      }

      const url = await r2Client.getPresignedDownloadUrl({
        bucket: R2_BUCKETS.homeownerFiles,
        pathKey: meta.mp3RecordingKey,
      })
```

After:
```ts
      const metaResult = await getLatestLeadMetaByCustomerId(input.customerId)
      const mp3Key = metaResult.success ? metaResult.data?.mp3RecordingKey : null
      if (!mp3Key) {
        return { url: null }
      }

      const url = await r2Client.getPresignedDownloadUrl({
        bucket: R2_BUCKETS.homeownerFiles,
        pathKey: mp3Key,
      })
```

Remove the now-unused `LeadMeta` import if nothing else in the file uses it; add `import { getLatestLeadMetaByCustomerId } from '@/shared/entities/lead-meta/dal/server/queries'`.

- [ ] **Step 2: Type-check, lint, commit** (`git add` the router; message: `refactor(lead-meta): read mp3 key from lead_meta, not leadMetaJSON`).

---

### Task B4: Flip the VoIP/SMS read cluster (highest-risk — trades → CloudTalk/SMS)

**Files:**
- Modify: `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts:100-145` (join `lead_meta`, read `interestedTradesRaw` from it; also `:212,:340` leadSourceId rollups → keep on customers for now OR join — see note)
- Modify: `src/shared/services/voip/campaigns/enrollment.service.ts:159,197` (read from `lead_meta`)

**Interfaces:**
- Consumes: `getLatestLeadMetaByCustomerId` (B2) or a `leftJoin(leadMeta, ...)` in the existing query.
- Produces: unchanged `SmsCadenceContext.interestedTradesRaw` + `buildLeadNote` input — via `reassembleLeadMetaView` for the note.

**Context:** This is the critical cluster (CloudTalk enrollment attributes + SMS cadence merge tokens). `voip-campaign-contacts/queries.ts` already `innerJoin`s `customers`; add a `leftJoin(leadMeta, eq(leadMeta.customerId, customers.id))` and select `leadMeta.interestedTradesRaw` instead of `customers.leadMetaJSON`. For "latest wins" in a join, either accept the multi-row fan-out risk is nil today (backfill writes one row/customer) OR add a lateral/subquery for the latest — for Phase B, one-row-per-customer holds, so a plain leftJoin is correct; add a `// TODO(lead-meta 1:many)` note that when multiple rows land, this needs a latest-row lateral join.

- [ ] **Step 1: Rewrite the cadence-context query** — replace `leadMetaJSON: customers.leadMetaJSON` in the select with `interestedTradesRaw: leadMeta.interestedTradesRaw` via the new leftJoin; change `:138` `interestedTradesRaw: row.leadMetaJSON?.interestedTradesRaw ?? []` → `interestedTradesRaw: row.interestedTradesRaw ?? []`.

- [ ] **Step 2: Rewrite `enrollment.service.ts`** — the enrollment service reads `customer` (a `customers` row). Fetch the lead_meta once: `const leadMetaResult = await getLatestLeadMetaByCustomerId(customer.id)` then `const lm = leadMetaResult.success ? leadMetaResult.data : null`. Change `:159` `interestedTradesRaw: customer.leadMetaJSON?.interestedTradesRaw` → `interestedTradesRaw: lm?.interestedTradesRaw ?? undefined`; change `:197` `buildLeadNote(customer.leadMetaJSON)` → `buildLeadNote(lm ? reassembleLeadMetaView(lm) : null)`. Also flip the leadSourceId reads at `:85-88` from `customer.leadSourceId` → `lm?.leadSourceId` (since leadSourceId moves off customers in B6).

- [ ] **Step 3: Type-check, lint, and DB-smoke** an enroll against dev (or verify via a targeted query) to confirm CT attributes still carry trades. Commit (message: `refactor(lead-meta): flip VoIP/SMS trade + note + leadSource reads to lead_meta`).

> ⚠️ Highest-blast-radius task. Do NOT batch with B3/B5. Run the enrollment smoke before committing.

---

### Task B5: Flip the profile/frontend + note reads

**Files:**
- Modify: `src/shared/entities/customers/lib/server-spec.ts:53` (customer select still includes `leadMetaJSON` — the profile fetch needs to also surface the latest lead_meta view)
- Modify: `src/shared/entities/customers/components/profile/customer-profile-overview.tsx:29` + `customer-profile-details.tsx` + `funnel-intake-panel.tsx` (prop stays `LeadMeta` — feed it from `reassembleLeadMetaView`)
- Modify: `src/features/campaigns-admin/ui/components/leads/lead-drawer-identity.tsx:35`
- Modify: `src/shared/services/customer-intake.service.ts:105,120,174` (funnel note, scheduledFor, address guard)

**Interfaces:**
- Consumes: `reassembleLeadMetaView` (B1), `getLatestLeadMetaByCustomerId` (B2).

**Context:** The profile page fetches the customer via a getFullView-style query. The cleanest flip: the customer profile query joins/fetches the latest `lead_meta` and hands the components a `reassembleLeadMetaView(row)` object, so `CustomerProfileDetails`/`FunnelIntakePanel`/`lead-drawer-identity` keep their `LeadMeta` prop shape UNCHANGED. For `customer-intake.service.ts`: `:105` `buildFunnelLeadNote(input.leadMeta)` is at CREATE time and still has `input.leadMeta` in hand — LEAVE AS-IS (it's the write path, not a read of the DB). `:120` `input.leadMeta?.scheduledFor` — same, write-time input, leave. `:174` address guard reads `customer.leadMetaJSON?.source?.kind` — flip to `getLatestLeadMetaByCustomerId(input.leadId)` → check `captureChannel === 'funnel'`.

- [ ] **Step 1** — Add the latest-lead_meta fetch to the customer profile data source; pass `reassembleLeadMetaView(row)` (or `null`) down the existing `leadMetaJSON` prop chain. Verify the profile panel renders funnel/bina detail from `lead_meta`.
- [ ] **Step 2** — Flip `lead-drawer-identity.tsx:35` to read `interestedTradesRaw` off the reassembled view (or a direct `lead_meta` fetch in its data source).
- [ ] **Step 3** — Flip the `customer-intake.service.ts:174` address guard to `captureChannel === 'funnel'` via `getLatestLeadMetaByCustomerId`. Leave `:105`/`:120` (write-time inputs).
- [ ] **Step 4** — Type-check, lint, commit (message: `refactor(lead-meta): flip profile + drawer + address-guard reads to lead_meta`).

---

### Task B6: Retarget `mergeFunnelEnrichment` → `lead_meta.source_data`

**Files:**
- Modify: `src/shared/entities/customers/dal/server/mutations.ts:57-77` (rewrite `mergeFunnelEnrichment`)
- Modify: `src/shared/services/customer-intake.service.ts:146-158` (`enrichFunnelLead` — call the new mutation / CRUD update)

**Interfaces:**
- Consumes: `leadMetaCrud.update` (A5, with `jsonbMergeColumns: [leadMeta.sourceData]`) OR an atomic `jsonb_set` on the new column.
- Produces: enrichment written to `lead_meta.source_data.enrichment` (now safe via WS-2 deep-merge — no GCal hook on `lead_meta`, so the CRUD path is clean).

**Context:** Per spec §4.6 + §7.5, WS-5 makes the funnel bypass "partly moot" — enrichment moves to `lead_meta.source_data`, which has no GCal after-hook, so routing through generic `leadMetaCrud.update` is safe. Two options: (a) `leadMetaCrud.update(SYSTEM_CONTEXT, { id, data: { sourceData: { enrichment: patch } } })` — the WS-2 deep-merge on `sourceData` upserts enrichment keys without clobbering `_v`/`bina`; requires resolving the latest `lead_meta` id first. (b) Keep a bespoke atomic `jsonb_set` at `{enrichment}` on the new column. **Prefer (a)** — it uses the generic path the whole restructure is standardizing on. Update the funnel-kind guard: it was `source.kind='funnel'` in SQL; now gate on `capture_channel='funnel'` (a real column — cheaper).

- [ ] **Step 1: Rewrite the mutation** to target `lead_meta`. If using option (a), the mutation becomes a thin wrapper: resolve latest `lead_meta` id for the customer, verify `captureChannel==='funnel'`, call `leadMetaCrud.update` with `{ sourceData: { enrichment } }`. If option (b), rewrite the `jsonb_set` to `lead_meta.source_data` `#>'{enrichment}'` with a `WHERE capture_channel='funnel'` predicate.
- [ ] **Step 2** — Rename/keep `enrichFunnelLead` semantics; ensure the `not_a_funnel_lead` precondition still fires on zero-match.
- [ ] **Step 3** — Smoke: fire two enrichment patches for different dimensions on a dev funnel lead; assert BOTH keys survive in `source_data.enrichment` AND `source_data.bina`/`_v` untouched (proves the WS-2 deep-merge). Type-check, lint, commit (message: `refactor(lead-meta): retarget funnel enrichment merge to lead_meta.source_data`).

> Depends on WS-2 being landed — the deep-merge is what makes the `{enrichment}` partial write on `source_data` non-lossy.

---

### Task B7: Flip the CAPI read (`funnels.router`) — the parity-critical one

**Files:**
- Modify: `src/trpc/routers/funnels.router.ts:152-173`
- Opportunistic: `src/shared/entities/meetings/dal/server/queries.ts:109` (fix the stale `leadMetaJSON: any` projection type)

**Interfaces:**
- Consumes: the funnel `source` at SUBMIT time — note this reads `input.leadMetaJSON.source`, which is the CLIENT-supplied blob in the same request, NOT a DB read.

**Context:** ⚠️ Subtle: `funnels.router.ts:152-173` reads `input.leadMetaJSON.source.meta.fbp/fbc` + `source.utm.fbclid` from the **request input**, not from the DB. The client (`build-lead-input.ts` + `pii-form-step.tsx:93`) still assembles a `leadMetaJSON` object and sends it. So this site does NOT need to change to read from `lead_meta` — the CAPI dispatch happens in the same request that creates the lead. **However**, the parity guardrail (below) must still confirm the fbp/fbc/utm values that get PERSISTED to `lead_meta` columns match what CAPI fired with. Keep this site reading `input.leadMetaJSON.source` unless the client contract also migrates (out of scope — funnel epic §8). Fix the `meetings/queries.ts:109` `any` to a precise type or drop the field if unused.

- [ ] **Step 1** — Confirm (by reading the code) that the CAPI site reads request input, not DB; leave the fbp/fbc/utm access as-is. Fix the `meetings/queries.ts:109` stale `any`.
- [ ] **Step 2** — Type-check, lint, commit (message: `chore(lead-meta): confirm CAPI reads request input; fix stale meetings any`).

---

### Task B8: CAPI parity guardrail — REAL browser Events-Manager test (BLOCKING gate)

**Files:** none (verification only).

**Context:** Per `feedback-meta-pixel-verify-real-browser` + spec §7.4: fbp/fbc/fbclid/utm are now first-class `lead_meta` columns — strictly safer, but the backfill + column mapping MUST be proven non-lossy before the blob drops. Meta `BotBlocking` silently drops beacons from headless automation, so this is a HUMAN-in-the-loop check, NEVER Playwright/headless.

- [ ] **Step 1** — On a preview/prod-like deploy, submit a real funnel lead in a REAL browser (with the Meta Pixel Helper extension), carrying utm params + an fbclid in the URL.
- [ ] **Step 2** — In Meta Events Manager → Test Events, confirm the `Lead` event shows fbp/fbc/utm.
- [ ] **Step 3** — Query the resulting `lead_meta` row: confirm `fbp`, `fbc`, `fbclid`, `utm_*` columns are populated and match the values CAPI fired with (and match what the old `leadMetaJSON.source` would have held). Document the row id + screenshot in the PR description.
- [ ] **Step 4** — Only if parity is confirmed, proceed to B9. If ANY CAPI field is lossy, STOP and fix the mapper/backfill before dropping.

---

### Task B9: Drop `customers.leadMetaJSON` + `customers.leadSourceId` (the contract step)

**Files:**
- Modify: `src/shared/db/schema/customers.ts` (remove `leadSourceId` `:29` + `leadMetaJSON` `:31`; drop the `LeadMeta` import + `leadMetaSchema` usage in `insertCustomerSchema` `:70`)
- Modify: `src/shared/entities/customers/lib/server-spec.ts:53` (remove `customers.leadMetaJSON` from the select list)
- Modify: `src/trpc/routers/customers.router/business.router.ts` (remove `leadMetaJSON` from `list` select `:87` if it references leadSourceId join — re-point the leadSource join to `lead_meta` OR keep the join off `customers` gone; the `createFromIntake` input still ACCEPTS `leadMetaJSON` from the client and passes it to `ingestLead` → dual-write flattens it — leave the input contract, it feeds the flatten)
- Modify: any remaining compile errors surfaced by `pnpm tsc`
- Modify: `src/shared/entities/customers/schemas/index.ts` — retire `leadMetaSchema`/`LeadMeta` export ONLY IF no longer imported anywhere (it's still consumed by `flattenLeadMetaToRow`, `reassembleLeadMetaView`, the routers' input schemas, `build-lead-input`, `normalize-bina-lead` — so KEEP the type/schema as the client-side wire contract; do NOT delete it).

**Interfaces:** removes two columns from `customers`.

**Context:** This is the irreversible contract step — do it LAST, only after B8 parity passes. The `LeadMeta` Zod schema itself STAYS (it's the client→server wire contract for the funnel/intake submit, and the mapper input type). Only the two `customers` columns drop. `leadSourceId` reads that were on `customers` (`business.router` list join `:92`, `voip-campaign-contacts/queries.ts:212,340`) must re-point to `lead_meta.lead_source_id` (join `lead_meta` instead of reading `customers.lead_source_id`).

- [ ] **Step 1** — Re-point every `customers.leadSourceId` read to `lead_meta.leadSourceId`: `business.router.ts` list join (`leftJoin lead_meta`), `voip-campaign-contacts/queries.ts:212,340` rollups. Run `grep -rn "leadSourceId\|lead_source_id" src` and confirm zero remaining `customers.` references.
- [ ] **Step 2** — Remove the two columns from `customers.ts` + the select-list entry in `server-spec.ts`.
- [ ] **Step 3** — `pnpm tsc` — fix every surfaced error (these are the compile-time proof that no read site was missed). `pnpm lint`.
- [ ] **Step 4** — `pnpm db:push:dev` — drop the columns on the dev branch. Confirm the app boots and a full lead lifecycle (create → enroll → SMS → profile) works on dev.
- [ ] **Step 5** — Commit (message: `refactor(lead-meta)!: drop customers.leadMetaJSON + leadSourceId (contract step)`).

> The `!` marks the breaking schema change. The prod column drop runs at prod-push time AFTER the prod backfill (A8) has completed and B8 parity passed.

---

### Task B10: Docs — funnel-plan header note + Decision 2 marker + stale-ref sweep

**Files:**
- Modify: `docs/plans/2026-06-27-funnel-data-capture-unified-design.md` (header note + Decision 2 marker)
- Modify: `memory/MEMORY.md` (thin the `project-funnel-capture-and-jsonb-merge` + `project-provider-boundaries`-adjacent entries to reflect lead_meta shipped; note leadMetaJSON retired)
- Modify: `src/shared/entities/customers/DOCS.md` (if it documents leadMetaJSON as a customer column — re-point to lead_meta)

**Context:** Per spec §8 task: add a header note to the funnel plan pointing at this spec as its schema foundation, and mark its Decision 2 as implemented-by-WS-2.

- [ ] **Step 1** — At the top of `docs/plans/2026-06-27-funnel-data-capture-unified-design.md`, add:

```md
> **Schema foundation (2026-07-03):** the physical destinations this plan's
> `FIELD_MAP` writes into are defined by
> `docs/superpowers/specs/2026-07-03-jsonb-restructure-design.md` (§7 `lead_meta`
> table, §8 reconciliation). Build this funnel-capture epic ON TOP of WS-2
> (deep-merge) + WS-5 (`lead_meta`), not on the retired `customers.leadMetaJSON`.
```

- [ ] **Step 2** — Find Decision 2 in that plan (the "fix the toolkit with true recursive deep-merge" decision, referenced near `:256`) and add an inline marker: `> **Implemented by WS-2** (\`docs/superpowers/plans/2026-07-03-ws2-jsonb-deep-merge.md\`) — the generic CRUD now deep-merges JSONB columns atomically under a row lock.`

- [ ] **Step 3** — Thin the relevant MEMORY.md index lines to reflect: lead_meta table shipped, leadMetaJSON/leadSourceId retired off customers, attribution now lives in lead_meta (latest-wins), source_data holds the funnel/bina tail. Keep to one line each.

- [ ] **Step 4** — Commit (message: `docs(lead-meta): funnel-plan schema-foundation note + Decision 2 marker + memory`).

---

**End of Phase B (PR2).** Open the PR: reads flipped, enrichment retargeted, CAPI parity proven in a real browser (screenshot in PR body), `customers.leadMetaJSON` + `leadSourceId` dropped. `pnpm lint && pnpm tsc` green.

---

## Self-Review

**Spec coverage — §7 (lead_meta schema):**
- §7.1 hybrid 1:many-capable (customer_id plain FK, no unique) → A3 table def (verbatim, no `.unique()`). ✓
- §7.2 exact column list (attribution/utm/meta/operational/envelope/consent/residual) → A3 maps every field from the spec table + the verified `LeadMeta` inventory; `leadSourceId`+`originCampaign` moved off `customers` (A3 columns; dropped in B9). ✓
- §7.3 blast radius (~39 refs / 30+ files; 1 SQL touch = mergeFunnelEnrichment; 13 read sites) → enumerated concretely in the read/write inventory; flipped in B3–B7; SQL touch retargeted in B6. ✓
- §7.4 CAPI safety (fbp/fbc/fbclid/utm first-class columns; real-browser guardrail) → A3 columns + B8 blocking human-in-loop test. ✓
- §7.5 migration expand-and-contract (5 steps) → Phase A (add+dual-write+backfill) / Phase B (flip+retarget+parity+drop), 2 PRs, no queue ceremony. ✓

**Spec coverage — §8 (funnel reconciliation):**
- `lead_meta` designed as the FIELD_MAP destination (columns + `source_data` as the only path-aware-merge target) → A3 + A5 `jsonbMergeColumns: [sourceData]`. ✓
- Header note into the 2026-06-27 funnel plan + Decision 2 = implemented-by-WS-2 → B10. ✓
- 1:many resolves the "two funnels → source collision" follow-on → A3 no-unique FK + B2 latest-wins. ✓

**Depends-on-WS-2:** stated in the header; B6 (enrichment retarget) explicitly gated on the deep-merge; A5 opts `sourceData` into `jsonbMergeColumns` which is a no-op-until-WS-2 config. ✓

**Placeholder scan:** No TBD / "add tests" / "handle errors" left abstract. Two bounded implementer-verify notes (A5 `customerVisibility` export name; A6 `createCrudRouter` arg shape) point at named reference files (`entities/customers/lib/visibility.ts`, `proposals.router/index.ts`) — the same pattern the WS-2 exemplar uses for its throwaway-smoke import paths. ✓

**Type-consistency of the new lead_meta types across DAL/spec/read-sites:**
- `flattenLeadMetaToRow(...) → InsertLeadMeta` (A4) === `leadMetaCrud.create` input (A5/A7) === backfill `db.insert(leadMeta).values(...)` (A8). ✓
- `reassembleLeadMetaView(row: LeadMetaRecord) → LeadMeta` (B1) feeds the unchanged `LeadMeta`-consuming read sites (buildLeadNote, buildFunnelLeadNote, FunnelIntakePanel, lead-drawer-identity) — so their internals never change, only their source. ✓
- `getLatestLeadMetaByCustomerId → DalReturn<LeadMetaRecord | null>` (B2) consumed uniformly by B3/B4/B5/B6. ✓
- `LeadMeta` Zod schema/type is KEPT (client wire contract + mapper I/O); only the two `customers` columns drop (B9) — no dangling type import. ✓

**Read/write-site completeness (no site missed):** every grep hit for `leadMetaJSON` / `leadSourceId` / `.source.*` / `interestedTradesRaw` / `originCampaign` / `mergeFunnelEnrichment` is accounted for — write sites converge on ONE dual-write (A7); the 13 read sites + attribution reads map to B3 (mp3), B4 (voip/sms/enrollment + leadSourceId rollups), B5 (profile/drawer/address-guard), B6 (enrichment SQL), B7 (CAPI = request-input, no DB flip needed). The compile step B9.3 is the forcing function that surfaces any missed site. ✓

**Staleness flagged:** `meetings/dal/server/queries.ts:109` `leadMetaJSON: any` (loose projection type — fixed opportunistically in B7). No other doc-vs-code drift found in the lead-meta surface during grounding.

**Out-of-scope (correctly deferred to the funnel epic §8):** `funnelSync` + FIELD_MAP + phone-dedup identity + WP1–WP4 collapse + side-effect policy (Decisions 3/4/5) + `sessionId` column. WS-5 delivers the `lead_meta` destination they build on, not the unification itself.
