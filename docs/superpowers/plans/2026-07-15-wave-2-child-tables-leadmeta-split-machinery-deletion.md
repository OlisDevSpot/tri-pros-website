# Wave 2 — Child Tables, leadMeta Split, Merge-Machinery Deletion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose `customers.leadMetaJSON` into a 1:1 `customer_lead_attribution` child + `customer_enrichment` rows, decompose `proposals.fundingJSON.data.incentives` into `proposal_incentives` rows with a stored `final_tcp_cents` rollup, and delete the JSONB merge-on-update machinery from the shared CRUD DAL.

**Architecture:** Follows the Wave-1-proven Sub-Entity Standard (spec Addendum B): PK-as-FK 1:1 children with lazy upsert via `upsertOneToOne`, batch-fetch for 1:many, additive schema → parity-checked backfill → single-release read+write flip → frozen `*Deprecated` blob for one release. `getFullView` becomes the proposals hydration choke point (incentive rows re-hydrated into the legacy funding shape so PDF/Zoho/AI-summary stay untouched until W3). `recomputeProposalFinancials` is the single-statement SQL rollup choke point (Addendum A stage-2).

**Tech Stack:** Next.js 15, Drizzle ORM 0.45 / drizzle-kit 0.31 (push workflow), Postgres (Neon), tRPC, Zod, CASL.

**Spec:** `docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md` — §3 Wave 2, Addendum A (calculation standard), Addendum B (Sub-Entity Standard), Addendum C (Closed Vocabulary Standard). Epic #256. Wave 1 precedent: PR #260, `scripts/backfill-wave1-columns.ts`, `docs/superpowers/plans/2026-07-13-wave-1-cutover-runbook.md`.

## Global Constraints

- **Verification**: `pnpm tsc` + `pnpm lint` gate every task. NEVER `pnpm build`. No test framework exists (spec §7) — the backfill parity check + typecheck are the verification layer.
- **DB pushes**: `pnpm db:push:dev` ONLY during implementation. Prod push happens exclusively via the cutover runbook (Task 10), human-driven.
- **Closed vocabularies** (Addendum C): every new enum-like column is `text('col', { enum: constArray })`. ZERO new pgEnums. Canonical: `docs/codebase-conventions/enum-standardization.md#text-with-enum`.
- **Money** (Addendum A.3): all new financial columns are integer cents (`bigint`, mode `'number'`). Forms stay whole-dollar; conversion happens in `entities/proposals/lib/incentive-rows.ts` mappers and the recompute SQL (`ROUND(x * 100)`). No floats in stored money.
- **Layering**: tRPC → Service → DAL → DB. Services never contain `db.insert/update/transaction` — new writes are DAL functions. No manual `updatedAt` (columns have `$onUpdate`).
- **Backfill script**: uses `createScriptDb()` from `scripts/lib/script-db.ts` with `--target=prod` flag semantics. NEVER `NODE_ENV=production`, never `import './lib/load-env'` for this script family, never the app `@/shared/db` singleton.
- **Recompute confinement** (Addendum A.3): the ONLY jsonb references allowed in financial SQL after this wave live inside the single `recomputeProposalFinancials` statement (`startingTcp` base + section-incentives term — both die in W3). `finalTcpExpr` is deleted; no other SQL may touch `fundingJSON`/`projectJSON` financials.
- **Immutable-capture rule** (this wave's design decision): `customer_lead_attribution.capture_json` stores the FULL immutable capture snapshot (typed `LeadMeta`) **minus `source.enrichment`** (the one mutable part, which lives exclusively in `customer_enrichment` rows). The promoted hot-field columns are query projections of that immutable snapshot — duplication is safe because the snapshot never changes after capture. Never write `capture_json` outside intake/backfill.
- **Git**: work on a feature branch `feat/<issue>-wave-2-child-tables` (create a GitHub issue on epic #256 first, mirroring #259). Stage by explicit path, never `git add -A`. Commits end with the Co-Authored-By trailer. PR opens with `Closes #<issue>`, preflight `pnpm lint && pnpm tsc`.
- The frozen Wave-1 blob columns (`customer_profile_json`, `property_profile_json`, `financial_profile_json`, `agent_profile_json`, `voip_config_json`) are NOT dropped in this wave's code — the drop rides the W2 prod push via the runbook (Task 10 decision gate).

---

### Task 1: Schema — `customer_lead_attribution` + `customer_enrichment`

**Files:**
- Create: `src/shared/db/schema/customer-lead-attribution.ts`
- Create: `src/shared/db/schema/customer-enrichment.ts`
- Modify: `src/shared/entities/customers/schemas/index.ts` (add `leadSourceKinds` const)
- Modify: `src/shared/db/schema/index.ts` (barrel exports)

**Interfaces:**
- Produces: `customerLeadAttribution` table, `CustomerLeadAttributionRow`, `insertCustomerLeadAttributionSchema`; `customerEnrichment` table, `CustomerEnrichmentRow`, `insertCustomerEnrichmentSchema`; `leadSourceKinds` const array. Consumed by Tasks 3, 4, 5.

- [ ] **Step 1: Add `leadSourceKinds` const to customers schemas**

In `src/shared/entities/customers/schemas/index.ts`, directly ABOVE `export const leadMetaSchema` (line ~121), add:

```ts
// Closed vocabulary for customer_lead_attribution.kind — mirrors the
// leadMetaSchema source discriminated-union literals below. text({ enum }),
// never pgEnum. see docs/codebase-conventions/enum-standardization.md#text-with-enum
export const leadSourceKinds = ['bina', 'generic', 'funnel'] as const
export type LeadSourceKind = (typeof leadSourceKinds)[number]
```

- [ ] **Step 2: Create the attribution schema file**

Create `src/shared/db/schema/customer-lead-attribution.ts`:

```ts
import type { LeadMeta } from '@/shared/entities/customers/schemas'
import { jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import z from 'zod'
import { leadSourceKinds } from '@/shared/entities/customers/schemas'
import { createdAt, updatedAt } from '../lib/schema-helpers'
import { customers } from './customers'

// 1:1 lead-attribution child (PK-as-FK, Addendum B). Row-exists = attribution
// was captured at intake. Written ONCE at capture (intake service / backfill);
// immutable afterward — the hot-field columns are the ads-reporting query
// surface, capture_json is the raw immutable snapshot (typed LeadMeta) MINUS
// source.enrichment, which lives in customer_enrichment rows (the one mutable
// part). Promoted fields also remain inside capture_json by design: the
// snapshot never changes after capture, so the duplication cannot drift.
// see docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md §10
export const customerLeadAttribution = pgTable('customer_lead_attribution', {
  customerId: uuid('customer_id').primaryKey().references(() => customers.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: leadSourceKinds }).notNull(),
  funnelSlug: text('funnel_slug'),
  offer: text('offer'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  utmContent: text('utm_content'),
  utmTerm: text('utm_term'),
  captureJSON: jsonb('capture_json').$type<LeadMeta>(),
  createdAt,
  updatedAt,
})

export const selectCustomerLeadAttributionSchema = createSelectSchema(customerLeadAttribution)
export type CustomerLeadAttributionRow = z.infer<typeof selectCustomerLeadAttributionSchema>

export const insertCustomerLeadAttributionSchema = createInsertSchema(customerLeadAttribution)
  .omit({ createdAt: true, updatedAt: true })
export type InsertCustomerLeadAttribution = z.infer<typeof insertCustomerLeadAttributionSchema>
```

- [ ] **Step 3: Create the enrichment schema file**

Create `src/shared/db/schema/customer-enrichment.ts`:

```ts
import { integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import z from 'zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { customers } from './customers'

// Dynamic-key funnel enrichment map decomposed to rows (Addendum B: dynamic-key
// map → child table with UNIQUE(parent_id, key)). Replaces the bespoke
// jsonb_set in mergeFunnelEnrichment with plain INSERT … ON CONFLICT
// (customer_id, step_id) DO UPDATE. `value` is the resolved option LABEL
// (self-describing, no server-side label mirror); `order` drives display.
export const customerEnrichment = pgTable('customer_enrichment', {
  id,
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  stepId: text('step_id').notNull(),
  label: text('label').notNull(),
  value: text('value').notNull(),
  order: integer('order').notNull(),
  createdAt,
  updatedAt,
}, table => [
  unique('customer_enrichment_customer_step_uq').on(table.customerId, table.stepId),
])

export const selectCustomerEnrichmentSchema = createSelectSchema(customerEnrichment)
export type CustomerEnrichmentRow = z.infer<typeof selectCustomerEnrichmentSchema>

export const insertCustomerEnrichmentSchema = createInsertSchema(customerEnrichment)
  .omit({ id: true, createdAt: true, updatedAt: true })
export type InsertCustomerEnrichment = z.infer<typeof insertCustomerEnrichmentSchema>
```

- [ ] **Step 4: Barrel exports**

In `src/shared/db/schema/index.ts`, add (alphabetical position next to the existing `customer-profiles` export):

```ts
export * from './customer-enrichment'
export * from './customer-lead-attribution'
```

- [ ] **Step 5: Typecheck + push to dev**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

Run: `pnpm db:push:dev`
Expected plan: `CREATE TABLE customer_lead_attribution` (11 cols), `CREATE TABLE customer_enrichment` (8 cols + unique constraint). ZERO `CREATE TYPE`. ZERO drops. Any drop → abort and investigate.

- [ ] **Step 6: Commit**

```bash
git add src/shared/db/schema/customer-lead-attribution.ts src/shared/db/schema/customer-enrichment.ts src/shared/db/schema/index.ts src/shared/entities/customers/schemas/index.ts
git commit -m "feat(schema): customer_lead_attribution + customer_enrichment child tables (Wave 2)"
```

---

### Task 2: Schema — `proposal_incentives`, rollup columns, #261 enum→text conversions

**Files:**
- Create: `src/shared/db/schema/proposal-incentives.ts`
- Modify: `src/shared/db/schema/proposals.ts` (add `finalTcpCents`, `calcVersion`; status/kind → text)
- Modify: `src/shared/db/schema/customers.ts` (pipeline/leadType → text)
- Modify: `src/shared/db/schema/meta.ts` (delete 4 pgEnum defs)
- Modify: `src/shared/entities/proposals/schemas/index.ts` (export `incentiveTypes`, `incentiveSchema`, `Incentive`)
- Modify: `src/shared/db/schema/index.ts` (barrel)

**Interfaces:**
- Produces: `proposalIncentives` table, `ProposalIncentiveRow`, `InsertProposalIncentive`; `proposals.finalTcpCents` (bigint number, nullable), `proposals.calcVersion` (int, default 1); exported `incentiveTypes`, `incentiveSchema`, `Incentive` type. Consumed by Tasks 3, 6, 7.

- [ ] **Step 1: Export incentive vocabulary from proposals schemas**

In `src/shared/entities/proposals/schemas/index.ts`, change line 60 and add above it:

```ts
// Closed vocabulary for proposal_incentives.type (text({ enum }), never pgEnum).
export const incentiveTypes = ['discount', 'exclusive-offer'] as const

export const incentiveSchema = z.discriminatedUnion('type', [discountIncentiveSchema, exclusiveOfferIncentiveSchema])
export type Incentive = z.infer<typeof incentiveSchema>
```

(`incentiveSchema` was previously a non-exported `const` — export it; keep everything else identical.)

- [ ] **Step 2: Create `src/shared/db/schema/proposal-incentives.ts`**

```ts
import { sql } from 'drizzle-orm'
import { bigint, check, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import z from 'zod'
import { incentiveTypes } from '@/shared/entities/proposals/schemas'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { proposals } from './proposals'

// Global proposal incentives as SUMmable rows (typed financial line items are
// NEVER JSONB — Addendum B). sow_item_id is present-but-unused in W2 (always
// NULL = global incentive); W3 adds the proposal_sow_items FK and migrates
// section incentives in (Addendum A.3). label is NULL for global rows today —
// W3 section rows use it. Money = integer cents at the DAL boundary.
// see docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md §2
export const proposalIncentives = pgTable('proposal_incentives', {
  id,
  proposalId: uuid('proposal_id').notNull().references(() => proposals.id, { onDelete: 'cascade' }),
  sowItemId: uuid('sow_item_id'),
  type: text('type', { enum: incentiveTypes }).notNull(),
  position: integer('position').notNull(),
  label: text('label'),
  amountCents: bigint('amount_cents', { mode: 'number' }),
  offer: text('offer'),
  notes: text('notes'),
  expiresAt: timestamp('expires_at', { mode: 'string', withTimezone: true }),
  createdAt,
  updatedAt,
}, table => [
  check('proposal_incentives_discount_amount_ck', sql`${table.type} <> 'discount' OR ${table.amountCents} IS NOT NULL`),
  check('proposal_incentives_offer_ck', sql`${table.type} <> 'exclusive-offer' OR ${table.offer} IS NOT NULL`),
])

export const selectProposalIncentiveSchema = createSelectSchema(proposalIncentives)
export type ProposalIncentiveRow = z.infer<typeof selectProposalIncentiveSchema>

export const insertProposalIncentiveSchema = createInsertSchema(proposalIncentives)
  .omit({ id: true, createdAt: true, updatedAt: true })
export type InsertProposalIncentive = z.infer<typeof insertProposalIncentiveSchema>
```

Add to `src/shared/db/schema/index.ts`: `export * from './proposal-incentives'`

- [ ] **Step 3: Add rollup columns to `proposals`**

In `src/shared/db/schema/proposals.ts`:

Change the pg-core import (line 5) to include `bigint`:

```ts
import { bigint, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
```

After the three `*JSON` columns (below line 37), add:

```ts
  // Stage-2 rollup cache (Addendum A.2): recomputed by the SINGLE choke point
  // recomputeProposalFinancials after every financial mutation. Idempotent +
  // self-healing (re-running always converges from rows). Nullable only for
  // the backfill window — treat null as "not yet computed", never as $0-truth.
  finalTcpCents: bigint('final_tcp_cents', { mode: 'number' }),
  // Bumped when the TCP formula or rounding policy changes; changelog in
  // ../entities/proposals/DOCS.md#final-tcp-derived. v1 = 2026-07-09 ruling.
  calcVersion: integer('calc_version').notNull().default(1),
```

In `insertProposalSchema` (line 87-100), extend the `.omit()` block so clients can never write the server-maintained rollup:

```ts
}).omit({
  id: true,
  updatedAt: true,
  finalTcpCents: true,
  calcVersion: true,
}).extend({
```

- [ ] **Step 4: #261 opportunistic enum→text conversions (4 columns)**

Both tables are touched by this wave's push, so their pgEnum columns convert per `enum-standardization.md#legacy-pgenum-conversion`.

`src/shared/db/schema/proposals.ts`:
- Delete `import { proposalKindEnum, proposalStatusEnum } from './meta'` (line 14).
- Add to imports: `import { proposalKinds, proposalStatuses } from '@/shared/constants/enums'` (merge into the existing constants import at line 1 if present — line 1 already imports `ProposalStatus` type from there).
- Line 21: `status: text('status', { enum: proposalStatuses }).notNull().default('draft'),`
- Line 26: `kind: text('kind', { enum: proposalKinds }).notNull().default('initial-sale'),`

`src/shared/db/schema/customers.ts`:
- Delete `import { customerPipelineEnum, leadTypeEnum } from './meta'` (line 11).
- Add: `import { customerPipelines, leadTypes } from '@/shared/constants/enums'`
- Line 49: `leadType: text('lead_type', { enum: leadTypes }),`
- Line 54: `pipeline: text('pipeline', { enum: customerPipelines }).notNull().default('active'),`

`src/shared/db/schema/meta.ts`:
- Delete the four exports at lines 48, 49, 52, 59 (`proposalStatusEnum`, `proposalKindEnum`, `customerPipelineEnum`, `leadTypeEnum`) and remove `proposalStatuses`, `proposalKinds`, `customerPipelines`, `leadTypes` from the import list (lines 5, 6, 14, 15).
- Verify no other importer: `grep -rn "proposalStatusEnum\|proposalKindEnum\|customerPipelineEnum\|leadTypeEnum" src/` must return zero hits.

- [ ] **Step 5: Typecheck + push to dev**

Run: `pnpm tsc && pnpm lint`
Expected: clean (the `text({ enum })` swap preserves the identical TS union — zero downstream type churn).

Run: `pnpm db:push:dev`
Expected plan: `CREATE TABLE proposal_incentives` (+2 CHECK constraints), `ALTER TABLE proposals ADD COLUMN final_tcp_cents/calc_version`, 4× `ALTER COLUMN ... SET DATA TYPE text`, 4× `DROP TYPE`.

⚠️ If push fails on the enum→text alters ("cannot be cast automatically"), run this SQL manually against the dev DB first, then re-push (also recorded in the runbook for prod):

```sql
ALTER TABLE proposals ALTER COLUMN status DROP DEFAULT;
ALTER TABLE proposals ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE proposals ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE proposals ALTER COLUMN kind DROP DEFAULT;
ALTER TABLE proposals ALTER COLUMN kind TYPE text USING kind::text;
ALTER TABLE proposals ALTER COLUMN kind SET DEFAULT 'initial-sale';
ALTER TABLE customers ALTER COLUMN pipeline DROP DEFAULT;
ALTER TABLE customers ALTER COLUMN pipeline TYPE text USING pipeline::text;
ALTER TABLE customers ALTER COLUMN pipeline SET DEFAULT 'active';
ALTER TABLE customers ALTER COLUMN lead_type TYPE text USING lead_type::text;
DROP TYPE proposal_status; DROP TYPE proposal_kind; DROP TYPE customer_pipeline; DROP TYPE lead_type;
```

(The partial index `proposals_one_approved_initial_sale_per_meeting_idx` compares text literals — unaffected.)

- [ ] **Step 6: Commit**

```bash
git add src/shared/db/schema/proposal-incentives.ts src/shared/db/schema/proposals.ts src/shared/db/schema/customers.ts src/shared/db/schema/meta.ts src/shared/db/schema/index.ts src/shared/entities/proposals/schemas/index.ts
git commit -m "feat(schema): proposal_incentives + final_tcp_cents rollup + 4 opportunistic enum→text conversions (#261)"
```

---

### Task 3: Backfill script — `scripts/backfill-wave2-children.ts`

**Files:**
- Create: `scripts/backfill-wave2-children.ts`

**Interfaces:**
- Consumes: Task 1+2 tables; `createScriptDb` from `scripts/lib/script-db.ts`; `leadMetaSchema`, `LEGACY_ENRICHMENT_LABELS` (`@/shared/entities/customers/constants/funnel-intake-fields`); `fundingSectionSchema`, `computeFinalTcp`.
- Produces: idempotent, parity-checked backfill with `--dry-run` / `--target=prod` flags. Exit 1 on any mismatch/error. Reused verbatim by the runbook (rehearsal, prod, post-deploy verify).

Structure mirrors `scripts/backfill-wave1-columns.ts` (read it first — flag parsing, `Stats`, exit discipline are copied). Key content:

- [ ] **Step 1: Write the script**

```ts
/* eslint-disable no-console */
// Wave-2 backfill: leadMetaJSON → customer_lead_attribution + customer_enrichment;
// fundingJSON.data.incentives → proposal_incentives; final_tcp_cents recompute.
// Idempotent (upsert / delete-then-insert semantics) — re-run = verify/repair.
// Parity: read back and diff vs the source blob; TS computeFinalTcp pins the
// SQL recompute (Addendum A.2 guard). Non-zero diff or per-row Zod failure ⇒
// exit 1, no partial success reporting. see spec §4.
import { eq, isNull, sql } from 'drizzle-orm'
import { and } from 'drizzle-orm'
import { customerEnrichment, customerLeadAttribution, customers, proposalIncentives, proposals } from '@/shared/db/schema'
import { LEGACY_ENRICHMENT_LABELS } from '@/shared/entities/customers/constants/funnel-intake-fields'
import { leadMetaSchema } from '@/shared/entities/customers/schemas'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'
import { fundingSectionSchema, projectSectionSchema } from '@/shared/entities/proposals/schemas'
import { createScriptDb } from './lib/script-db'

const db = createScriptDb()
const DRY_RUN = process.argv.includes('--dry-run')

interface Stats { written: number, wouldWrite: number, skipped: number, mismatches: number, errors: number }
const newStats = (): Stats => ({ written: 0, wouldWrite: 0, skipped: 0, mismatches: 0, errors: 0 })

// Legacy flat enrichment (pre-refactor kitchen leads): Record<string, string>
// where key = dimension id, value = raw option id. Normalize to the canonical
// { label, value, order } shape before Zod parse (↷ logged, mirrors Wave-1).
function normalizeEnrichment(raw: unknown, rowId: string): Record<string, { label: string, value: string, order: number }> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, { label: string, value: string, order: number }> = {}
  let i = 0
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'object' && v !== null && 'label' in v && 'value' in v) {
      const e = v as { label: string, value: string, order?: number }
      out[key] = { label: e.label, value: e.value, order: e.order ?? i }
    }
    else if (typeof v === 'string') {
      console.log(`  ↷ customers ${rowId}: legacy flat enrichment '${key}' normalized`)
      out[key] = { label: LEGACY_ENRICHMENT_LABELS[key] ?? key, value: v, order: i }
    }
    i++
  }
  return out
}

async function backfillCustomers(): Promise<Stats> {
  const stats = newStats()
  const rows = await db.select().from(customers)
  for (const row of rows) {
    try {
      const rawMeta = row.leadMetaJSON // property renamed to leadMetaJSONDeprecated in Task 5 — update this line then
      if (!rawMeta) { stats.skipped++; continue }

      const source = (rawMeta as { source?: Record<string, unknown> }).source
      const enrichment = normalizeEnrichment(source?.enrichment, row.id)
      // Zod gate on the normalized shape (parse failure → per-row error, exit 1)
      const meta = leadMetaSchema.parse(
        source ? { ...rawMeta, source: { ...source, enrichment: Object.keys(enrichment).length ? enrichment : undefined } } : rawMeta,
      )
      const funnel = meta.source?.kind === 'funnel' ? meta.source : null
      const capture = funnel ? { ...meta, source: { ...funnel, enrichment: undefined } } : meta
      const attribution = {
        kind: meta.source?.kind ?? ('generic' as const),
        funnelSlug: funnel?.funnelSlug ?? null,
        offer: funnel?.offer ?? null,
        utmSource: funnel?.utm.source ?? null,
        utmMedium: funnel?.utm.medium ?? null,
        utmCampaign: funnel?.utm.campaign ?? null,
        utmContent: funnel?.utm.content ?? null,
        utmTerm: funnel?.utm.term ?? null,
        captureJSON: capture,
      }
      const enrichmentRows = Object.entries(enrichment).map(([stepId, e]) => ({
        customerId: row.id, stepId, label: e.label, value: e.value, order: e.order,
      }))

      if (DRY_RUN) { stats.wouldWrite++; continue }

      await db.insert(customerLeadAttribution)
        .values({ customerId: row.id, ...attribution })
        .onConflictDoUpdate({ target: customerLeadAttribution.customerId, set: attribution })
      for (const er of enrichmentRows) {
        await db.insert(customerEnrichment).values(er).onConflictDoUpdate({
          target: [customerEnrichment.customerId, customerEnrichment.stepId],
          set: { label: er.label, value: er.value, order: er.order },
        })
      }

      // Parity: read back, field-diff
      const diffs: string[] = []
      const [after] = await db.select().from(customerLeadAttribution).where(eq(customerLeadAttribution.customerId, row.id))
      if (!after) diffs.push('attribution: expected row, found none')
      else {
        for (const [k, v] of Object.entries(attribution)) {
          if (JSON.stringify((after as Record<string, unknown>)[k] ?? null) !== JSON.stringify(v ?? null)) diffs.push(`attribution.${k}`)
        }
      }
      const afterEnrichment = await db.select().from(customerEnrichment).where(eq(customerEnrichment.customerId, row.id))
      if (afterEnrichment.length < enrichmentRows.length) diffs.push(`enrichment: expected ≥${enrichmentRows.length} rows, found ${afterEnrichment.length}`)
      if (diffs.length > 0) { stats.mismatches++; console.error(`✗ customers ${row.id}: parity diff on ${diffs.join(', ')}`) }
      else stats.written++
    }
    catch (err) { stats.errors++; console.error(`✗ customers ${row.id}:`, err instanceof Error ? err.message : err) }
  }
  return stats
}

async function backfillProposals(): Promise<Stats> {
  const stats = newStats()
  const rows = await db.select().from(proposals)
  for (const row of rows) {
    try {
      const funding = fundingSectionSchema.parse(row.fundingJSON)
      const project = projectSectionSchema.parse(row.projectJSON)
      const incentiveRows = funding.data.incentives.map((inc, i) => ({
        proposalId: row.id,
        sowItemId: null,
        type: inc.type,
        position: i,
        label: null,
        amountCents: inc.type === 'discount' ? Math.round(inc.amount * 100) : null,
        offer: inc.type === 'exclusive-offer' ? inc.offer : null,
        notes: inc.notes ?? null,
        expiresAt: inc.expiresAt ?? null,
      }))

      if (DRY_RUN) { stats.wouldWrite++; continue }

      // Idempotent replace of GLOBAL rows only (sow_item_id IS NULL)
      await db.delete(proposalIncentives).where(and(
        eq(proposalIncentives.proposalId, row.id), isNull(proposalIncentives.sowItemId),
      ))
      if (incentiveRows.length > 0) await db.insert(proposalIncentives).values(incentiveRows)

      // Rollup recompute — SAME statement recomputeProposalFinancials uses (keep in sync)
      await db.update(proposals).set({
        finalTcpCents: sql`GREATEST(0::numeric, (
          ROUND(COALESCE((${proposals.fundingJSON}->'data'->>'startingTcp')::numeric, 0) * 100)
          - COALESCE((SELECT SUM(pi.amount_cents) FROM proposal_incentives pi
              WHERE pi.proposal_id = ${proposals.id} AND pi.type = 'discount'), 0)
          - COALESCE((SELECT ROUND(SUM((si->>'amount')::numeric) * 100)
              FROM jsonb_array_elements(${proposals.projectJSON}->'data'->'sow') AS sec,
                   jsonb_array_elements(COALESCE(sec->'financials'->'incentives', '[]'::jsonb)) AS si), 0)
        ))::bigint`,
      }).where(eq(proposals.id, row.id))

      // Parity: TS previewer pins the SQL recompute (Addendum A.2 guard a)
      const diffs: string[] = []
      const [after] = await db.select({ finalTcpCents: proposals.finalTcpCents }).from(proposals).where(eq(proposals.id, row.id))
      const expectedCents = Math.round(computeFinalTcp({ funding: funding.data, sow: project.data.sow }) * 100)
      if (after?.finalTcpCents !== expectedCents) diffs.push(`finalTcpCents: sql=${after?.finalTcpCents} ts=${expectedCents}`)
      const afterRows = await db.select().from(proposalIncentives)
        .where(and(eq(proposalIncentives.proposalId, row.id), isNull(proposalIncentives.sowItemId)))
      if (afterRows.length !== incentiveRows.length) diffs.push(`incentives: expected ${incentiveRows.length} rows, found ${afterRows.length}`)
      if (diffs.length > 0) { stats.mismatches++; console.error(`✗ proposals ${row.id}: parity diff on ${diffs.join(', ')}`) }
      else stats.written++
    }
    catch (err) { stats.errors++; console.error(`✗ proposals ${row.id}:`, err instanceof Error ? err.message : err) }
  }
  return stats
}

async function main() {
  console.log(`[backfill-wave2] ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  let failed = false
  for (const [label, fn] of [['customers → attribution/enrichment', backfillCustomers], ['proposals → incentives/final_tcp_cents', backfillProposals]] as const) {
    const s = await fn()
    console.log(`${label}: written=${s.written} wouldWrite=${s.wouldWrite} skipped=${s.skipped} mismatches=${s.mismatches} errors=${s.errors}`)
    if (s.mismatches > 0 || s.errors > 0) failed = true
  }
  if (failed) { console.error('BACKFILL FAILED — fix data or amend schema per spec §4; never silently skip.'); process.exit(1) }
  process.exit(0)
}
main().catch((err) => { console.error(err); process.exit(1) })
```

Note the marked line reading `row.leadMetaJSON`: after Task 5 renames the property to `leadMetaJSONDeprecated`, update it (Task 5 Step includes this).

- [ ] **Step 2: Dry-run against dev**

Run: `cd /home/olis-solutions/olis-v3/nextjs/tri-pros-website && pnpm tsx scripts/backfill-wave2-children.ts --dry-run`
Expected: `[script-db] target=dev`, per-table `wouldWrite`/`skipped` counts, ZERO errors. Any Zod failure → inspect the row, extend `normalizeEnrichment`/legacy handling, re-run (never skip silently).

- [ ] **Step 3: Live run + idempotency re-run against dev**

Run: `pnpm tsx scripts/backfill-wave2-children.ts` (twice)
Expected: both runs end `mismatches=0 errors=0`; second run converges to identical counts (idempotent).

- [ ] **Step 4: Typecheck, lint, commit**

```bash
pnpm tsc && pnpm lint
git add scripts/backfill-wave2-children.ts
git commit -m "feat(scripts): Wave-2 backfill — attribution/enrichment/incentive rows + final_tcp_cents, parity-checked"
```

---

### Task 4: Customers DAL + CASL (additive — nothing flips yet)

**Files:**
- Create: `src/shared/entities/customers/lib/split-lead-meta.ts`
- Modify: `src/shared/entities/customers/dal/server/mutations.ts` (add `upsertLeadAttribution`, `upsertFunnelEnrichment`)
- Modify: `src/shared/entities/customers/dal/server/queries.ts` (extend `getCustomer`; add `getCustomerAttribution`)
- Modify: `src/shared/entities/customers/lib/constants.ts` (+ `CUSTOMER_LEAD_ATTRIBUTION`)
- Modify: `src/shared/domains/permissions/abilities.ts` (register subject + read grants)

**Interfaces:**
- Consumes: `upsertOneToOne(table, fkColumn, parentId, set)` from `@/shared/dal/server/lib/upsert-one-to-one`; Task 1 tables.
- Produces:
  - `splitLeadMeta(leadMeta: LeadMeta): { attribution: Omit<InsertCustomerLeadAttribution, 'customerId'>, enrichment: EnrichmentRecord }`
  - `upsertLeadAttribution(input: { customerId: string, leadMeta: LeadMeta }): Promise<DalReturn<{ ok: true }>>`
  - `upsertFunnelEnrichment(input: { leadId: string, enrichment: EnrichmentRecord }): Promise<DalReturn<{ matched: boolean }>>`
  - `getCustomerAttribution(customerId: string): Promise<DalReturn<CustomerLeadAttributionRow | undefined>>`
  - `getCustomer` return type becomes `CustomerWithProfile & { attribution: CustomerLeadAttributionRow | null, enrichment: CustomerEnrichmentRow[] }` (exported as `CustomerFullView`)

- [ ] **Step 1: Create `split-lead-meta.ts`**

```ts
import type { InsertCustomerLeadAttribution } from '@/shared/db/schema/customer-lead-attribution'
import type { EnrichmentRecord, LeadMeta } from '@/shared/entities/customers/schemas'

/**
 * Split a capture-time LeadMeta into the attribution child-row shape.
 * `captureJSON` keeps the FULL immutable snapshot minus `source.enrichment`
 * (the one mutable part — it lives exclusively in customer_enrichment rows).
 * Promoted hot fields intentionally remain inside captureJSON too: the
 * snapshot is immutable after capture, so the projection cannot drift.
 */
export function splitLeadMeta(leadMeta: LeadMeta): {
  attribution: Omit<InsertCustomerLeadAttribution, 'customerId'>
  enrichment: EnrichmentRecord
} {
  const funnel = leadMeta.source?.kind === 'funnel' ? leadMeta.source : null
  const capture: LeadMeta = funnel
    ? { ...leadMeta, source: { ...funnel, enrichment: undefined } }
    : leadMeta
  return {
    attribution: {
      kind: leadMeta.source?.kind ?? 'generic',
      funnelSlug: funnel?.funnelSlug ?? null,
      offer: funnel?.offer ?? null,
      utmSource: funnel?.utm.source ?? null,
      utmMedium: funnel?.utm.medium ?? null,
      utmCampaign: funnel?.utm.campaign ?? null,
      utmContent: funnel?.utm.content ?? null,
      utmTerm: funnel?.utm.term ?? null,
      captureJSON: capture,
    },
    enrichment: funnel?.enrichment ?? {},
  }
}
```

- [ ] **Step 2: Add the two mutations to `dal/server/mutations.ts`**

Add imports: `customerEnrichment`, `customerLeadAttribution` from `@/shared/db/schema`, `splitLeadMeta` from `../../lib/split-lead-meta`.

```ts
/**
 * Capture-time attribution write (SYSTEM-only — no client surface). Called by
 * customerIntakeService.ingestLead right after customerCrud.create. Upsert so
 * re-ingest of an existing lead refreshes the snapshot idempotently.
 */
export async function upsertLeadAttribution(
  input: { customerId: string, leadMeta: LeadMeta },
): Promise<DalReturn<{ ok: true }>> {
  return dalDbOperation(async () => {
    const { attribution, enrichment } = splitLeadMeta(input.leadMeta)
    dalVerifySuccess(await upsertOneToOne(
      customerLeadAttribution,
      customerLeadAttribution.customerId,
      input.customerId,
      attribution,
    ))
    const rows = Object.entries(enrichment).map(([stepId, e]) => ({
      customerId: input.customerId, stepId, label: e.label, value: e.value, order: e.order,
    }))
    for (const row of rows) {
      await db.insert(customerEnrichment).values(row).onConflictDoUpdate({
        target: [customerEnrichment.customerId, customerEnrichment.stepId],
        set: { label: row.label, value: row.value, order: row.order },
      })
    }
    return { ok: true as const }
  })
}

/**
 * Progressive funnel enrichment → rows. Replaces mergeFunnelEnrichment's
 * bespoke jsonb_set with plain INSERT … ON CONFLICT (customer_id, step_id)
 * DO UPDATE (spec §3 W2.1). Monotonic and idempotent like its predecessor:
 * out-of-order sends only ever ADD/refresh keys. The funnel-kind check is the
 * capability gate — a non-funnel/absent lead returns matched:false. Still
 * bypasses customerCrud.update on purpose (no geocode/GCal side effects).
 */
export async function upsertFunnelEnrichment(
  input: { leadId: string, enrichment: EnrichmentRecord },
): Promise<DalReturn<{ matched: boolean }>> {
  return dalDbOperation(async () => {
    const [attr] = await db
      .select({ kind: customerLeadAttribution.kind })
      .from(customerLeadAttribution)
      .where(eq(customerLeadAttribution.customerId, input.leadId))
    if (attr?.kind !== 'funnel') {
      return { matched: false }
    }
    for (const [stepId, e] of Object.entries(input.enrichment)) {
      await db.insert(customerEnrichment)
        .values({ customerId: input.leadId, stepId, label: e.label, value: e.value, order: e.order })
        .onConflictDoUpdate({
          target: [customerEnrichment.customerId, customerEnrichment.stepId],
          set: { label: e.label, value: e.value, order: e.order },
        })
    }
    return { matched: true }
  })
}
```

(`LeadMeta` is already imported as a type in this file's vicinity — add to the type imports at top.)

- [ ] **Step 3: Extend `getCustomer` + add `getCustomerAttribution` in `dal/server/queries.ts`**

Extend the existing `getCustomer` (lines 50-62): add a nested `attribution` select via `leftJoin(customerLeadAttribution, eq(customerLeadAttribution.customerId, customers.id))` using the `getFullView` nested-object pattern (null-collapse via `row.attribution?.customerId ? row.attribution : null`), plus a second query for enrichment rows ordered by `order` ascending. Export the composed type:

```ts
export type CustomerFullView = CustomerWithProfile & {
  attribution: CustomerLeadAttributionRow | null
  enrichment: CustomerEnrichmentRow[]
}
```

```ts
export async function getCustomerAttribution(
  customerId: string,
): Promise<DalReturn<CustomerLeadAttributionRow | undefined>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select()
      .from(customerLeadAttribution)
      .where(eq(customerLeadAttribution.customerId, customerId))
    return row
  })
}
```

Design note (deviation from the CustomerProfile flattened-spread precedent, documented on purpose): attribution columns keep generic names (`kind`, `offer`) — flattening them onto the customer object would be ambiguous, so the composed type nests `attribution` as an object (Addendum B's hard type rule `ChildRow | null` still holds).

- [ ] **Step 4: CASL subject**

`src/shared/entities/customers/lib/constants.ts` — below `CUSTOMER_PROFILE` (line 9):

```ts
// 1:1 attribution child (Addendum B: 1:1 children get their own subject).
// SYSTEM-only writes (intake capture); agents/dispatchers read.
export const CUSTOMER_LEAD_ATTRIBUTION = 'CustomerLeadAttribution' as const
```

`src/shared/domains/permissions/abilities.ts`:
- Line 30 import: add `CUSTOMER_LEAD_ATTRIBUTION`.
- `ENTITY_NAMES` (line ~42-46): add `CUSTOMER_LEAD_ATTRIBUTION` after `CUSTOMER_PROFILE`.
- Agent block (below `can('update', 'CustomerProfile')` at line ~102): add `can('read', 'CustomerLeadAttribution')` — no update grant (immutable, SYSTEM-written).
- Dispatcher block: add `can('read', 'CustomerLeadAttribution')` alongside its existing Customer read grant.

- [ ] **Step 5: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/entities/customers/lib/split-lead-meta.ts src/shared/entities/customers/lib/constants.ts src/shared/entities/customers/dal/server/mutations.ts src/shared/entities/customers/dal/server/queries.ts src/shared/domains/permissions/abilities.ts
git commit -m "feat(customers): attribution/enrichment DAL + CASL subject (additive, Wave 2)"
```

---

### Task 5: Customers flip — writers + readers + freeze `leadMetaJSON` + deregister merge

Single atomic flip (Wave-1 Task R3 pattern): after this task, nothing reads or writes the blob; tsc is the sweep tool.

**Files:**
- Modify: `src/shared/db/schema/customers.ts` (freeze: rename property, omit from insert schema)
- Modify: `src/shared/entities/customers/lib/server-spec.ts` (delete `update.jsonbMergeColumns` block)
- Modify: `src/shared/services/customer-intake.service.ts` (create-path split; kind checks)
- Modify: `src/shared/entities/customers/dal/server/mutations.ts` (DELETE `mergeFunnelEnrichment`)
- Modify: `src/shared/entities/customers/components/profile/funnel-intake-panel.tsx` (+ its parents `customer-profile-details.tsx`, `customer-profile-overview.tsx`)
- Modify: known blob readers (exact list in Step 4)
- Modify: `scripts/backfill-wave2-children.ts` (property rename)

- [ ] **Step 1: Freeze the blob column**

`src/shared/db/schema/customers.ts` line 50 — rename the property (DB column name unchanged) and mark:

```ts
  /**
   * @deprecated Wave-2 frozen (epic #256). Zero writers. Read only by
   * scripts/backfill-wave2-children.ts. Replaced by customer_lead_attribution
   * (1:1 child) + customer_enrichment rows. Dropped next release.
   */
  leadMetaJSONDeprecated: jsonb('lead_meta_json').$type<LeadMeta>(),
```

In `insertCustomerSchema`: delete the `leadMetaJSON: leadMetaSchema.optional()` override (line 86) and add `leadMetaJSONDeprecated: true` to the `.omit()` block. Remove the now-unused `leadMetaSchema` import if nothing else in the file uses it.

`src/shared/entities/customers/lib/server-spec.ts`: delete the whole `update: { jsonbMergeColumns: [...] }` block (lines 48-55 incl. comments). This is the LAST registration — Task 8 deletes the mechanism.

Update `scripts/backfill-wave2-children.ts`: `row.leadMetaJSON` → `row.leadMetaJSONDeprecated` (the marked line).

- [ ] **Step 2: Intake service split (write path)**

`src/shared/services/customer-intake.service.ts`:

1. In `ingestLead`, remove `leadMetaJSON: input.leadMeta ?? null` from the `customerCrud.create` call (line 74) and insert, immediately after the `const customer = created.data` line:

```ts
      // ── 1b. Attribution capture (strict — ads reporting depends on it) ──────
      // Customer is already committed; a failed attribution write surfaces as an
      // error the caller can retry (same precedent as meeting_create_failed).
      if (input.leadMeta) {
        const attr = await upsertLeadAttribution({ customerId: customer.id, leadMeta: input.leadMeta })
        if (!attr.success) {
          return dalError({ type: 'precondition-failed', reason: 'attribution_write_failed' })
        }
      }
```

2. `enrichFunnelLead` (line 150): swap `mergeFunnelEnrichment(input)` → `upsertFunnelEnrichment(input)`; the `matched:false → not_a_funnel_lead` handling stays identical.

3. `setFunnelLeadAddress` (lines 169-176): replace the getById + `customer.leadMetaJSON?.source?.kind !== 'funnel'` check with:

```ts
      const attr = await getCustomerAttribution(input.leadId)
      if (!attr.success) {
        return attr
      }
      if (attr.data?.kind !== 'funnel') {
        return dalError({ type: 'precondition-failed', reason: 'not_a_funnel_lead' })
      }
```

Update imports accordingly (`upsertLeadAttribution`, `upsertFunnelEnrichment` from mutations; `getCustomerAttribution` from queries; drop `mergeFunnelEnrichment`).

- [ ] **Step 3: Delete `mergeFunnelEnrichment`**

Remove the function and its docblock from `dal/server/mutations.ts` (lines 41-81). `grep -rn "mergeFunnelEnrichment" src/` must return zero hits.

- [ ] **Step 4: Reader cutover (tsc-driven sweep)**

Run `pnpm tsc` — every remaining `.leadMetaJSON` read now fails to compile. Fix each; the known complete list:

| Site | Change |
|---|---|
| `entities/customers/components/profile/funnel-intake-panel.tsx` | New props `{ attribution, enrichment }` (`CustomerLeadAttributionRow \| null`, `CustomerEnrichmentRow[]`). Render `null` unless `attribution?.kind === 'funnel' && enrichment.length > 0`; map rows directly (already `{label,value,order}`-shaped and DB-ordered). Delete `toRows` + the `LEGACY_ENRICHMENT_LABELS` import (legacy flat shapes are normalized into rows by the backfill). |
| `customer-profile-details.tsx` / `customer-profile-overview.tsx` | Thread `data.customer.attribution` + `data.customer.enrichment` (from `CustomerFullView`) down to the panel instead of `leadMetaJSON`. |
| `src/trpc/routers/customer-pipelines.router.ts:77-89` | Select `captureJSON: customerLeadAttribution.captureJSON` via `leftJoin(customerLeadAttribution, eq(customerLeadAttribution.customerId, customers.id))`; `meta.mp3RecordingKey` read is unchanged (`captureJSON` is typed `LeadMeta`). |
| `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts:115,138` | Same leftJoin swap: select `captureJSON` in place of `leadMetaJSON`; downstream `.interestedTradesRaw` reads compile unchanged. |
| `src/shared/services/voip/campaigns/enrollment.service.ts:158,196` + `lib/build-contact-attributes.ts:13` | These consume the row shape produced by the queries above — rename the field at the type/pass-through sites (`leadMetaJSON` → `captureJSON` or `leadCapture`, matching the query alias). `buildLeadNote(customer.leadMetaJSON)` → `buildLeadNote(<captureJSON field>)` — `build-lead-note.ts` signature (`LeadMeta \| null`) is unchanged. |
| `src/features/campaigns-admin/ui/components/leads/lead-drawer-identity.tsx:35` | Field rename following the query result type. |
| `entities/customers/dal/server/queries.ts` `listEnrollableLeadsBySource` (108-122) | If it selects `leadMetaJSON`, apply the same leftJoin swap. |

NOT changed (they read the capture-time INPUT, not the DB): `build-lead-input.ts`, `funnels.router.ts` submit + CAPI block, `business.router.ts` `createFromIntake` (incl. line 199 `requestedTrades`), `build-funnel-lead-note.ts` (called with `input.leadMeta` at create time — still contains `enrichment` pre-split), intake-form-view. The `LeadMeta` type and `leadMetaSchema` stay alive as the capture/transport shape.

Legacy scripts `scripts/seed-bina-contacts.ts` / `scripts/backfill-interested-trades-raw.ts`: rename the property reference to `leadMetaJSONDeprecated` with a `// legacy one-off — do not run post-Wave-2` comment (they must still compile).

- [ ] **Step 5: Verify + commit**

Run: `pnpm tsc && pnpm lint` — clean. Then drive dev quickly: funnel submit (`pnpm dev`, submit a test lead) → verify `customer_lead_attribution` + `customer_enrichment` rows in Neon dev; open the customer profile → Funnel Intake panel renders rows.

```bash
git add -- src/shared/db/schema/customers.ts src/shared/entities/customers/ src/shared/services/customer-intake.service.ts src/trpc/routers/customer-pipelines.router.ts src/shared/entities/voip-campaign-contacts/ src/shared/services/voip/ src/features/campaigns-admin/ scripts/backfill-wave2-children.ts scripts/seed-bina-contacts.ts scripts/backfill-interested-trades-raw.ts
git commit -m "feat(customers): flip leadMeta to attribution child + enrichment rows; freeze blob; deregister last jsonbMergeColumns"
```

---

### Task 6: Proposals incentives DAL + recompute choke point + router (additive)

**Files:**
- Create: `src/shared/entities/proposals/lib/incentive-rows.ts`
- Modify: `src/shared/entities/proposals/dal/server/mutations.ts` (add 3 functions)
- Modify: `src/shared/entities/proposals/dal/server/queries.ts` (`getFullView` hydration + rows)
- Modify: `src/shared/entities/proposals/lib/server-spec.ts` (create.after + update.after hooks)
- Modify: `src/trpc/routers/proposals.router/index.ts` (incentives.replace procedure)
- Create: `src/features/proposal-flow/dal/client/mutations/use-replace-incentives.ts`

**Interfaces:**
- Produces:
  - `incentiveRowsToDomain(rows: ProposalIncentiveRow[]): Incentive[]` / `domainIncentivesToRows(proposalId: string, incentives: Incentive[]): InsertProposalIncentive[]`
  - `listProposalIncentives(proposalId: string): Promise<DalReturn<ProposalIncentiveRow[]>>` (global rows, `ORDER BY position`)
  - `replaceProposalIncentives(ctx: ScopedContext, input: { proposalId: string, incentives: Incentive[] }): Promise<DalReturn<ProposalIncentiveRow[]>>` — freeze-gated
  - `recomputeProposalFinancials(proposalId: string): Promise<DalReturn<{ finalTcpCents: number | null }>>`
  - `getFullView` result gains `incentives: ProposalIncentiveRow[]` AND returns `fundingJSON.data.incentives` re-hydrated from rows (the W2→W3 bridge: PDF/Zoho/AI-summary/form stay correct with zero per-site changes)
  - tRPC `proposalsRouter.incentives.replace`

- [ ] **Step 1: Mappers — `lib/incentive-rows.ts`**

```ts
import type { InsertProposalIncentive, ProposalIncentiveRow } from '@/shared/db/schema/proposal-incentives'
import type { Incentive } from '@/shared/entities/proposals/schemas'

/** Rows → domain shape (dollars). Sorted by position; W2 handles GLOBAL rows only. */
export function incentiveRowsToDomain(rows: ProposalIncentiveRow[]): Incentive[] {
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .map(row => row.type === 'discount'
      ? {
          type: 'discount' as const,
          amount: (row.amountCents ?? 0) / 100,
          ...(row.notes != null ? { notes: row.notes } : {}),
          ...(row.expiresAt != null ? { expiresAt: row.expiresAt } : {}),
        }
      : {
          type: 'exclusive-offer' as const,
          offer: row.offer ?? '',
          ...(row.notes != null ? { notes: row.notes } : {}),
          ...(row.expiresAt != null ? { expiresAt: row.expiresAt } : {}),
        })
}

/** Domain (dollars) → insert rows (integer cents). Array index = position. */
export function domainIncentivesToRows(proposalId: string, incentives: Incentive[]): InsertProposalIncentive[] {
  return incentives.map((inc, i) => ({
    proposalId,
    sowItemId: null,
    type: inc.type,
    position: i,
    label: null,
    amountCents: inc.type === 'discount' ? Math.round(inc.amount * 100) : null,
    offer: inc.type === 'exclusive-offer' ? inc.offer : null,
    notes: inc.notes ?? null,
    expiresAt: inc.expiresAt ?? null,
  }))
}
```

- [ ] **Step 2: DAL mutations**

Append to `entities/proposals/dal/server/mutations.ts` (imports: `and, eq, isNull, sql` from drizzle-orm; `db`; `proposalIncentives`, `proposals` from schema; `ThrowableDalError`, `dalDbOperation`; `domainIncentivesToRows`; types):

```ts
/**
 * THE financial-rollup choke point (Addendum A.2, stage 2). One idempotent
 * SQL statement; re-running always converges from rows (verify = repair).
 * DOCUMENTED W2 jsonb residue, confined to THIS statement only (both die in
 * W3): startingTcp base from fundingJSON; section-incentives term from
 * projectJSON. Discounts already SUM over proposal_incentives rows.
 * see ../../DOCS.md#final-tcp-derived
 */
export async function recomputeProposalFinancials(
  proposalId: string,
): Promise<DalReturn<{ finalTcpCents: number | null }>> {
  return dalDbOperation(async () => {
    const [row] = await db.update(proposals).set({
      finalTcpCents: sql`GREATEST(0::numeric, (
        ROUND(COALESCE((${proposals.fundingJSON}->'data'->>'startingTcp')::numeric, 0) * 100)
        - COALESCE((SELECT SUM(pi.amount_cents) FROM proposal_incentives pi
            WHERE pi.proposal_id = ${proposals.id} AND pi.type = 'discount'), 0)
        - COALESCE((SELECT ROUND(SUM((si->>'amount')::numeric) * 100)
            FROM jsonb_array_elements(${proposals.projectJSON}->'data'->'sow') AS sec,
                 jsonb_array_elements(COALESCE(sec->'financials'->'incentives', '[]'::jsonb)) AS si), 0)
      ))::bigint`,
    }).where(eq(proposals.id, proposalId)).returning({ finalTcpCents: proposals.finalTcpCents })
    if (!row) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    return row
  })
}

/**
 * Replace-all upsert of GLOBAL incentives (funding-form save path — the W2
 * slice of the W3 form refactor, spec §3 W2.3). Freeze gate: refuses while an
 * envelope exists (Addendum A.1.2 — child financial rows freeze with the
 * proposal; the blob-wide freeze gate lands with the W3 write refactor).
 */
export async function replaceProposalIncentives(
  ctx: ScopedContext,
  input: { proposalId: string, incentives: Incentive[] },
): Promise<DalReturn<ProposalIncentiveRow[]>> {
  return dalDbOperation(async () => {
    const [proposal] = await db
      .select({ id: proposals.id, signingRequestId: proposals.signingRequestId })
      .from(proposals)
      .where(and(eq(proposals.id, input.proposalId), ctx.scope ?? undefined))
    if (!proposal) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    if (proposal.signingRequestId != null) {
      throw new ThrowableDalError({ type: 'precondition-failed', reason: 'proposal_financials_frozen' })
    }
    const rows = domainIncentivesToRows(input.proposalId, input.incentives)
    await db.transaction(async (tx) => {
      await tx.delete(proposalIncentives).where(and(
        eq(proposalIncentives.proposalId, input.proposalId),
        isNull(proposalIncentives.sowItemId),
      ))
      if (rows.length > 0) {
        await tx.insert(proposalIncentives).values(rows)
      }
    })
    dalVerifySuccess(await recomputeProposalFinancials(input.proposalId))
    return dalVerifySuccess(await listProposalIncentives(input.proposalId))
  })
}
```

- [ ] **Step 3: Spec hooks — recompute on every crud financial write**

`entities/proposals/lib/server-spec.ts` — import `recomputeProposalFinancials` from `../dal/server/mutations` (no cycle: mutations does not import the spec/crud). Add to `hooks`:

```ts
    create: {
      async before(input, _ctx) { /* existing body unchanged */ },
      // New proposals get their rollup immediately (rows are empty at create;
      // startingTcp/section terms come from the blobs until W3).
      async after(row, _ctx) {
        dalVerifySuccess(await recomputeProposalFinancials(row.id))
      },
    },
    update: {
      // Whole-document fundingJSON/projectJSON writes must re-converge the
      // rollup. Cheap + idempotent; skipped when neither blob was touched.
      async after(row, _ctx, meta) {
        const input = meta.input as Record<string, unknown>
        if ('fundingJSON' in input || 'projectJSON' in input) {
          dalVerifySuccess(await recomputeProposalFinancials(row.id))
        }
      },
    },
```

(Note: adding `update.after` activates the previousRow prefetch in `updateImpl` — after Task 8's loud-fail fix a failed prefetch aborts the update, which is the desired Addendum-A behavior for financial writes.)

- [ ] **Step 4: `listProposalIncentives` query + `getFullView` hydration bridge**

In `entities/proposals/dal/server/queries.ts`, add the read (queries file, per crud-vs-business split — `replaceProposalIncentives` in mutations imports it from here):

```ts
export async function listProposalIncentives(
  proposalId: string,
): Promise<DalReturn<ProposalIncentiveRow[]>> {
  return dalDbOperation(async () =>
    await db.select().from(proposalIncentives)
      .where(and(eq(proposalIncentives.proposalId, proposalId), isNull(proposalIncentives.sowItemId)))
      .orderBy(asc(proposalIncentives.position)),
  )
}
```

Then in `getFullView` (lines 79-135), before the final `return`, fetch global incentive rows and re-hydrate:

```ts
    // W2→W3 bridge: incentive ROWS are the source of truth; re-hydrate the
    // legacy funding shape at THE read choke point so every getFullView
    // consumer (PDF, Zoho context, AI summary, edit form) renders correct
    // incentives with zero per-site changes. The blob's own incentives array
    // is dead (writers store []). Dies in W3 with fundingJSON itself.
    const incentives = dalVerifySuccess(await listProposalIncentives(row.id))
    const hydratedFunding = {
      ...row.fundingJSON,
      data: { ...row.fundingJSON.data, incentives: incentiveRowsToDomain(incentives) },
    }

    return { ...row, fundingJSON: hydratedFunding, customer, incentives } as ProposalWithCustomer & { incentives: ProposalIncentiveRow[] }
```

Update the `ProposalWithCustomer` return type (wherever it is declared — same file or `../../types`) to include `incentives: ProposalIncentiveRow[]`.

- [ ] **Step 5: Router procedure + client hook**

`src/trpc/routers/proposals.router/index.ts` — the router is built with `createEntityRouter(proposalServerSpec, (entity) => createTRPCRouter({ ... }))`; add an `incentives` sub-router next to the existing `crud`/business keys, following the exact `profile.upsert` precedent (`customers.router/index.ts:57-69` — `entity.authedProcedure` + CASL check + `dalToTrpc`):

```ts
    // ── Incentives (proposal_incentives child rows, Wave 2) ─────────────
    // Replace-all upsert from the funding form. Freeze gate (signingRequestId)
    // enforced in the DAL. see ../../../shared/entities/proposals/DOCS.md#final-tcp-derived
    incentives: createTRPCRouter({
      replace: entity.authedProcedure
        .input(z.object({
          proposalId: z.string().uuid(),
          incentives: z.array(incentiveSchema),
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.ability.cannot('update', 'Proposal')) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'You do not have permission to update this proposal.',
            })
          }
          return dalToTrpc(await replaceProposalIncentives(ctx, input))
        }),
    }),
```

Imports to add: `incentiveSchema` from `@/shared/entities/proposals/schemas`, `replaceProposalIncentives` from `@/shared/entities/proposals/dal/server/mutations`, plus `TRPCError`/`z`/`dalToTrpc`/`createTRPCRouter` if not already imported in the file.

Create `src/features/proposal-flow/dal/client/mutations/use-replace-incentives.ts` mirroring `use-update-proposal.ts` line-for-line (same tRPC hook shape, same query-invalidation of the getProposal key).

- [ ] **Step 6: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/entities/proposals/ src/trpc/routers/proposals.router/ src/features/proposal-flow/dal/client/mutations/use-replace-incentives.ts
git commit -m "feat(proposals): incentive rows DAL + final_tcp_cents recompute choke point + hydration bridge (additive)"
```

---

### Task 7: Proposals flip — form save split, `finalTcpExpr` deletion, report consumers → rollup

**Files:**
- Modify: `src/features/proposal-flow/ui/views/edit-proposal-view.tsx`
- Modify: `src/features/proposal-flow/ui/views/create-new-proposal-view.tsx`
- Modify: `src/shared/entities/proposals/dal/server/queries.ts` (`listProposals`)
- Modify: `src/shared/entities/proposals/lib/columns-registry.tsx:84`
- Modify: `src/shared/services/accounting.service.ts:139`
- Modify: `src/trpc/routers/lead-sources.router.ts:228`
- Modify: `src/features/customer-pipelines/dal/server/get-customer-profile.ts:121`, `get-customer-pipeline-items.ts:260,429`
- Modify: `src/shared/services/providers/zoho-sign/lib/documents/proposal-context.ts:32` — NO change needed if fed by getFullView (verify; it is — contracts.service:21-82 and contracts.router both hydrate via getFullView, and the bridge injects rows). Leave as `computeFinalTcp` (correct on hydrated data); add a comment noting it relies on the getFullView bridge.

- [ ] **Step 1: Edit-view save split**

`edit-proposal-view.tsx`:
- Add `const replaceIncentives = useReplaceIncentives()`.
- In `buildMutationData` (line 87-93), blank the blob array:

```ts
        fundingJSON: {
          ...rawData.funding,
          data: {
            ...rawData.funding.data,
            // Rows are the source of truth (Wave 2); the blob array is dead.
            // getFullView re-hydrates it from proposal_incentives on read.
            incentives: [],
            cashInDeal: rawData.funding.data.cashInDeal > nextFinalTcp ? nextFinalTcp : rawData.funding.data.cashInDeal,
          },
        },
```

- Chain the row write in BOTH `onSubmit` and `onSave` (update first, then rows — the recompute at the end of `replaceProposalIncentives` converges the rollup after both writes):

```ts
  function onSubmit(rawData: ProposalFormSchema) {
    updateProposal.mutate(buildMutationData(rawData), {
      onSuccess: () => {
        replaceIncentives.mutate(
          { proposalId, incentives: rawData.funding.data.incentives },
          {
            onSuccess: () => {
              toast.success('Proposal updated')
              router.push(ROOTS.public.proposalReview(proposalId))
            },
            onError: error => toast.error(error.message),
          },
        )
      },
      onError: error => toast.error(error.message),
    })
  }
```

(`onSave` identical minus the `router.push`.) Form defaults need NO change — `initProposalValues` maps `proposal.data.fundingJSON`, which getFullView already hydrates from rows.

- [ ] **Step 2: Create-view split**

`create-new-proposal-view.tsx` — same pattern: `buildMutationData` writes `incentives: []` into `fundingJSON` (line ~77 block); on create success, if `data.funding.data.incentives.length > 0`, call `replaceIncentives.mutate({ proposalId: created.id, incentives: data.funding.data.incentives })` before navigating.

- [ ] **Step 3: Delete `finalTcpExpr`; list filter/sort → column**

`entities/proposals/dal/server/queries.ts` `listProposals`: delete the `finalTcpExpr` declaration (lines 156-172) and swap its 3 call sites:

```ts
      price: v => and(
        typeof v.min === 'number' ? sql`${proposals.finalTcpCents} >= ${Math.round(v.min * 100)}` : undefined,
        typeof v.max === 'number' ? sql`${proposals.finalTcpCents} <= ${Math.round(v.max * 100)}` : undefined,
      ),
```

and in `buildOrderBy`: `price: proposals.finalTcpCents,`

`grep -rn "finalTcpExpr" src/` must return zero hits.

- [ ] **Step 4: Total-only consumers → `finalTcpCents`**

At each site, replace the `computeFinalTcp({ funding: …, sow: … })` expression with the stored rollup, dollars via `/ 100`. Pattern (adapt variable names per site):

```ts
// Stored rollup (Wave 2) — maintained by recomputeProposalFinancials; null
// only pre-backfill. see entities/proposals/DOCS.md#final-tcp-derived
const finalTcp = (proposal.finalTcpCents ?? 0) / 100
```

Sites: `columns-registry.tsx:84` (accessorFn — list rows carry the column via `getTableColumns`), `accounting.service.ts:139`, `lead-sources.router.ts:228` (`totalSales` loop), `get-customer-profile.ts:121`, `get-customer-pipeline-items.ts:260` and `:429`. Remove now-unused `computeFinalTcp` imports per site.

KEEP `computeFinalTcp` (live form-state math): `pricing-breakdown.tsx`, `funding.tsx`, `edit-proposal-view.tsx` (clamp), `funding-fields.tsx`/`get-proposal-aggregates.ts`, `create-new-proposal-view.tsx`, PDF `proposal-doc-definition.ts:288` + AI summary `route.ts:127` + Zoho `proposal-context.ts:32` (all three consume getFullView-hydrated data — the bridge makes their existing math correct; add a one-line `// relies on getFullView incentive hydration (Wave 2 bridge)` comment at each).

- [ ] **Step 5: Verify + commit**

`pnpm tsc && pnpm lint` clean, then drive dev: edit a proposal's incentives → save → verify `proposal_incentives` rows + `final_tcp_cents` in Neon dev; proposals list price sort/filter works; PDF route renders the discount lines.

```bash
git add src/features/proposal-flow/ src/shared/entities/proposals/ src/shared/services/accounting.service.ts src/trpc/routers/lead-sources.router.ts src/features/customer-pipelines/ src/shared/services/providers/zoho-sign/lib/documents/proposal-context.ts
git commit -m "feat(proposals): flip incentives to rows — form save split, finalTcpExpr deleted, reports read final_tcp_cents"
```

---

### Task 8: Delete the merge machinery + loud-fail hook fix

**Files:**
- Modify: `src/shared/dal/server/lib/create-crud-dal.ts`
- Modify: `src/shared/dal/server/types.ts:87`

Sequenced AFTER Task 5 (last registration gone — spec risk R5; tsc catches any survivor).

- [ ] **Step 1: Delete `buildUpdateSet`**

In `create-crud-dal.ts`, delete the entire `buildUpdateSet` function AND its doc comment (lines 95-165). In `updateImpl`, line 191 becomes:

```ts
      .set(validated as Record<string, unknown>)
```

Remove imports that are now unused in this file (`sql` if unreferenced elsewhere in the file — check before deleting).

- [ ] **Step 2: Loud-fail on previousRow prefetch (spec §3 W2.4)**

Replace the prefetch block (lines 178-185) with:

```ts
    // After-hooks REQUIRE previousRow context. A failed prefetch used to
    // silently skip the hook after committing the update (GCal/notification
    // side effects dropped with no trace) — now the update aborts loudly
    // BEFORE any write. see spec §3 Wave-2 item 4.
    let previousRow: Row<TTable> | undefined
    if (spec.hooks?.update?.after) {
      const prev = await getByIdImpl(spec, pkColumn, ctx, { id: input.id })
      if (!prev.success) {
        throw new ThrowableDalError({
          type: 'precondition-failed',
          reason: `[create-crud-dal] previousRow prefetch failed for '${spec.entityName}' update — refusing to commit without after-hook context`,
        })
      }
      if (!prev.data) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      previousRow = prev.data as Row<TTable>
    }
```

and the post-update hook call (lines 198-203) becomes unconditional-on-hook (previousRow is now guaranteed):

```ts
    if (spec.hooks?.update?.after) {
      await spec.hooks.update.after(row as Row<TTable>, ctx, {
        previousRow: previousRow!,
        input: input.data,
      })
    }
```

- [ ] **Step 3: Delete the spec option**

`src/shared/dal/server/types.ts` line 87: delete `update?: { jsonbMergeColumns: readonly PgColumn[] }`.

Run: `grep -rn "jsonbMergeColumns" src/` → expected: ONLY comments/docs (cleaned in Task 9), zero code references.

- [ ] **Step 4: Verify + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/dal/server/lib/create-crud-dal.ts src/shared/dal/server/types.ts
git commit -m "refactor(dal): delete jsonb merge-on-update machinery; fail loudly on previousRow prefetch failure"
```

---

### Task 9: Docs truth-pass + memory

**Files:** (every doc/comment the merge machinery or blob shapes touched — the explorer-verified complete list)
- Modify: `docs/codebase-conventions/jsonb-columns.md` — rewrite `### never-shallow-merge-nested` (lines 147-173): the mechanism is DELETED (Wave 2, epic #256); scoped `jsonb_set` reference impl is gone too (mergeFunnelEnrichment deleted — point to `customer_enrichment` rows as the replacement pattern); document the sanctioned fallback for a future genuine key-level blob patch: single-statement `jsonb_recursive_merge` SQL — documented, NOT built (spec §5.1).
- Modify: `docs/adr/0005-jsonb-vs-column-vs-child-table.md` — Consequences + line 182 see-also: record that `jsonbMergeColumns` is deleted; add a Wave-2 amendment block (attribution/enrichment/incentives verdicts executed; Closed Vocabulary applied to 4 legacy enums).
- Modify: `docs/codebase-conventions/dal-conventions.md:178` — update the see-also bullet (mechanism deleted; point at the one-to-one child-table section + `customer_enrichment` upsert pattern).
- Modify: `src/trpc/DOCS.md:262-268` — replace the `### jsonb-merge-columns-merge-on-update` section body with a two-line tombstone (deleted Wave 2; see jsonb-columns.md).
- Modify: `src/shared/entities/customers/schemas/index.ts:186-191` — replace the enrichment comment (now: rows in `customer_enrichment`, written by `upsertFunnelEnrichment`; this schema is the capture/transport shape + `captureJSON` payload type).
- Modify: `src/trpc/routers/customers.router/index.ts:20-22`, `src/shared/entities/proposals/DOCS.md:98-107,243,263`, `src/features/proposal-flow/DOCS.md:69,74,120`, `src/shared/entities/meetings/DOCS.md:200`, `src/trpc/routers/voip-campaigns.router.ts:130`, `src/shared/dal/server/lib/upsert-one-to-one.ts:43` — sweep every `jsonbMergeColumns` mention (`grep -rn "jsonbMergeColumns\|mergeFunnelEnrichment" src/ docs/` drives the list; each becomes past-tense or is deleted).
- Modify: `src/shared/entities/customers/DOCS.md` — new `### lead-attribution-child` section (attribution child + enrichment rows + immutable-capture rule + SYSTEM-only writes); update `#lead-attribution-fields` refs.
- Modify: `src/shared/entities/proposals/DOCS.md#final-tcp-derived` — rewrite per Addendum A: three-stage lifecycle, `final_tcp_cents` rollup choke point, the two documented W2 jsonb residues in the recompute, freeze gate on `replaceProposalIncentives`, and the `calc_version` changelog table (v1 = 2026-07-09 formula).
- Modify: `docs/codebase-conventions/enum-standardization.md` — fix the stale `## Anti-patterns` block (lines 90-95: still says "Use the pgEnum"); note the 4 converted enums, prod enum count 23 → 19.
- Memory: update `memory/project-jsonb-strategy-research.md` status line (Wave 2 implemented on branch; W3 = SOW). Update `memory/MEMORY.md` hook if wording changed.

- [ ] Steps: execute the sweep file-by-file; finish with `grep -rn "jsonbMergeColumns" src/ docs/` → zero non-historical hits (ADR/spec history mentions with past-tense framing are fine); `pnpm lint` (markdown untouched by lint, but comment edits are); commit:

```bash
git add docs/ src/ memory/
git commit -m "docs: Wave-2 truth-pass — merge machinery tombstones, attribution/incentive rules, calc_version changelog"
```

---

### Task 10: Wave-2 cutover runbook

**Files:**
- Create: `docs/superpowers/plans/2026-07-15-wave-2-cutover-runbook.md`

Copy the Wave-1 runbook structure (`2026-07-13-wave-1-cutover-runbook.md`) exactly — Step 0 target-resolution check, Step 1 Neon-branch rehearsal (push plan verification + `--dry-run` → live → idempotency re-run, `mismatches=0 errors=0` every table every run), Step 2 prod cutover (push + backfill BEFORE deploy), Step 3 post-deploy verify + flows, Step 4 next-release drops. Wave-2 specifics the runbook MUST contain:

- **Expected prod push plan**: `CREATE TABLE` × 3 (`customer_lead_attribution`, `customer_enrichment`, `proposal_incentives` + 2 CHECKs), `ALTER TABLE proposals ADD COLUMN final_tcp_cents, calc_version`, 4× enum→text `ALTER COLUMN` + 4× `DROP TYPE` (prod enums 23 → 19), ZERO `CREATE TYPE`. Include the manual enum-conversion SQL from Task 2 Step 5 as the fallback if push can't cast.
- **Decision gate — Wave-1 frozen-column drops**: IF the three outstanding W1 smoke flows (funnel intake, agent settings, campaigns policy card) are verified before cutover, the 5 frozen W1 blob columns (`customer_profile_json`, `property_profile_json`, `financial_profile_json`, `agent_profile_json`, `voip_config_json`) ride this push (schema edit: delete the 5 `*Deprecated` properties first). Otherwise they wait for the W3 push. Ask Oliver at cutover time.
- **Abort rule**: any UNEXPECTED drop in the push plan = abort (only the 5 sanctioned W1 drops may appear, and only if the gate above passed).
- **Post-deploy flows**: funnel intake → attribution + enrichment rows in prod; progressive enrichment (answer a later funnel step) → row upserted; customer profile Funnel Intake panel; proposal edit incentives → rows + `final_tcp_cents`; proposals list price sort; proposal PDF + AI summary show discounts; Zoho envelope creation on a draft (context tcp correct); frozen-check: editing a sent-to-sign proposal's incentives → `proposal_financials_frozen` error.
- **Next release**: drop `customers.lead_meta_json` (frozen this wave) + any W1 columns deferred by the gate.
- **Rollback story**: frozen `lead_meta_json` untouched for one release; blob `fundingJSON.data.incentives` values remain in old rows (writers blank only on next save); Neon PITR backstop.

- [ ] Write the runbook, then commit:

```bash
git add docs/superpowers/plans/2026-07-15-wave-2-cutover-runbook.md
git commit -m "docs(runbook): Wave-2 staged cutover — rehearsal ladder, enum-conversion fallback, W1-drop decision gate"
```

---

## Execution notes

- **Task order is load-bearing**: 1→2→3 (schema+backfill so dev has data), 4→5 (customers additive then flip), 6→7 (proposals additive then flip), 8 (machinery deletion LAST of code — after 5's deregistration), 9→10 (docs/runbook).
- After all tasks: `pnpm lint && pnpm tsc`, open PR with `Closes #<issue>`, paste the dev backfill parity output into the PR body. Prod cutover is exclusively human-driven via the Task-10 runbook.
- **Known W2-accepted debts** (do NOT fix here): startingTcp + section incentives remain jsonb inside the single recompute statement (W3); blob-wide financial freeze gate beyond `replaceProposalIncentives` (W3 write refactor); `fundingJSON.data.incentives` key still exists in the Zod shape as the form/transport format (dies with fundingJSON in W3); PGlite property test for TS↔SQL parity deferred to the testing bootstrap (`docs/plans/2026-07-07-testing-bootstrap-handoff.md`) — the backfill parity check covers it operationally.
