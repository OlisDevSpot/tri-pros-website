# Lead Source Detail Redesign — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the lead-source detail panel into a Customers-first, three-tab layout with a dollar-led KPI strip, consolidated Settings tab, and Analytics placeholder — without touching the All pane.

**Architecture:** Server adds one schema column, three new derived queries (`totalSales`, `getStatusCounts`, `segment` filter on `getCustomers`), one new procedure (`archive`), and guards on `delete`. Client splits the existing single-pane `SourceDetail` into a tab shell with three panels: a new `LeadSourceCustomersPanel` (segments + table), a new `LeadSourceSettingsPanel` (Identity + IntakeURL + FormConfig + DangerZone), and an `LeadSourceAnalyticsPlaceholder`. The existing `PerformanceStrip` is left untouched for the All pane; a new `LeadSourcePerformanceStrip` lives alongside it for the per-source view.

**Tech Stack:** Next.js 15 App Router · tRPC · Drizzle ORM (Postgres/Neon) · TanStack React Query · nuqs (URL state) · shadcn/ui (Radix) · Tailwind v4 · motion/react.

**Spec:** [`docs/superpowers/specs/2026-05-08-lead-source-detail-redesign-design.md`](../specs/2026-05-08-lead-source-detail-redesign-design.md)

**Project conventions:** Verification is `pnpm tsc` + `pnpm lint` + manual dev-server. **Never `pnpm build`.** Schema changes use `pnpm db:push:dev` (per-worktree Neon branch — safe). All exports named (no default exports). One React component per file.

---

## File Map

### Created
- `src/shared/entities/lead-sources/lib/segment-sql.ts` — `buildSegmentWhere` predicate helper
- `src/features/lead-sources-admin/ui/components/lead-source-performance-strip.tsx` — Dollar-led KPI hero
- `src/features/lead-sources-admin/ui/components/customer-status-segments.tsx` — 4-pill segmented control
- `src/features/lead-sources-admin/ui/components/lead-source-customers-panel.tsx` — Segments + Add CTA + table wrapper
- `src/features/lead-sources-admin/ui/components/identity-editor.tsx` — Name + slug edit
- `src/features/lead-sources-admin/ui/components/danger-zone.tsx` — Pause / Archive / Delete
- `src/features/lead-sources-admin/ui/components/lead-source-settings-panel.tsx` — Settings tab composer
- `src/features/lead-sources-admin/ui/components/lead-source-analytics-placeholder.tsx` — Phase 2 placeholder

### Modified
- `src/shared/db/schema/lead-sources.ts` — Add `archivedAt` column
- `src/trpc/routers/lead-sources.router.ts` — Extend `getStats`, `getCustomers`, `update`, `delete`, `list`; add `getStatusCounts`, `archive`
- `src/shared/entities/lead-sources/hooks/use-lead-source-actions.ts` — Add `archiveLeadSource` mutation
- `src/features/lead-sources-admin/ui/components/lead-source-detail-header.tsx` — Read-only Active indicator + navigational kebab
- `src/features/lead-sources-admin/ui/components/intake-url-card.tsx` — Drop inner heading
- `src/features/lead-sources-admin/ui/components/form-config-editor.tsx` — Drop inner heading
- `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx` — Accept `segment` prop
- `src/features/lead-sources-admin/ui/components/source-detail.tsx` — Tab shell rebuild

---

## Task 1: Schema — add `archivedAt` column

**Files:**
- Modify: `src/shared/db/schema/lead-sources.ts`

- [ ] **Step 1: Add the column to the Drizzle schema**

Edit `src/shared/db/schema/lead-sources.ts`:

```ts
import type z from 'zod'
import type { LeadSourceFormConfig } from '@/shared/entities/lead-sources/schemas'
import { boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { leadSourceFormConfigSchema } from '@/shared/entities/lead-sources/schemas'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'

export const leadSourcesTable = pgTable('lead_sources', {
  id,
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  token: text('token').notNull().unique(),
  formConfigJSON: jsonb('form_config_json').$type<LeadSourceFormConfig>().notNull(),
  isActive: boolean('is_active').notNull().default(true),
  archivedAt: timestamp('archived_at', { mode: 'string', withTimezone: true }),
  createdAt,
  updatedAt,
})

export const selectLeadSourceSchema = createSelectSchema(leadSourcesTable, {
  formConfigJSON: leadSourceFormConfigSchema,
})
export type LeadSourceRecord = z.infer<typeof selectLeadSourceSchema>

export const insertLeadSourceSchema = createInsertSchema(leadSourcesTable, {
  formConfigJSON: leadSourceFormConfigSchema,
}).omit({ id: true, createdAt: true, updatedAt: true })
export type InsertLeadSource = z.infer<typeof insertLeadSourceSchema>
```

- [ ] **Step 2: Push the schema to the dev DB**

Run: `pnpm db:push:dev`
Expected: Drizzle reports the new `archived_at` column added; no errors.

- [ ] **Step 3: Verify with tsc**

Run: `pnpm tsc`
Expected: Clean — the new field appears on `LeadSourceRecord` and is included in `selectLeadSourceSchema`.

- [ ] **Step 4: Commit**

```bash
git add src/shared/db/schema/lead-sources.ts
git commit -m "feat(lead-sources): add archivedAt column"
```

---

## Task 2: Server — segment SQL helper

**Files:**
- Create: `src/shared/entities/lead-sources/lib/segment-sql.ts`

- [ ] **Step 1: Create the helper**

Create `src/shared/entities/lead-sources/lib/segment-sql.ts`:

```ts
import type { SQL } from 'drizzle-orm'

import { and, eq, inArray, not, sql } from 'drizzle-orm'

import { customers } from '@/shared/db/schema/customers'
import { isSignedCustomerSql } from '@/shared/entities/customers/lib/signed-customer-sql'

export type CustomerSegment = 'all' | 'active' | 'signed' | 'dead'

export const customerSegments = ['all', 'active', 'signed', 'dead'] as const

/**
 * SQL predicate for the 4-state customer segmentation used by the lead-source
 * detail panel.
 *
 *   - all    → no constraint (returns undefined)
 *   - signed → has at least one project (canonical via isSignedCustomerSql)
 *   - dead   → pipeline = 'dead' AND not signed (a signed customer remains in
 *              "signed" even if pipeline later flips to dead)
 *   - active → pipeline IN ('active', 'rehash') AND not signed
 *
 * Invariant the consumer relies on: active + signed + dead === all (counts
 * partition the customer set, no double-count, no orphans).
 */
export function buildSegmentWhere(segment: CustomerSegment | undefined): SQL | undefined {
  if (!segment || segment === 'all') {
    return undefined
  }
  if (segment === 'signed') {
    return isSignedCustomerSql()
  }
  const notSigned = sql<boolean>`NOT ${isSignedCustomerSql()}`
  if (segment === 'dead') {
    return and(eq(customers.pipeline, 'dead'), notSigned)
  }
  // active
  return and(inArray(customers.pipeline, ['active', 'rehash']), notSigned)
}
```

- [ ] **Step 2: Verify with tsc + lint**

Run: `pnpm tsc && pnpm lint -- src/shared/entities/lead-sources/lib/segment-sql.ts`
Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/lead-sources/lib/segment-sql.ts
git commit -m "feat(lead-sources): add buildSegmentWhere helper"
```

---

## Task 3: Server — `getStats` adds `totalSales`

**Files:**
- Modify: `src/trpc/routers/lead-sources.router.ts`

- [ ] **Step 1: Add the totalSales calculation to `getStats`**

Edit `src/trpc/routers/lead-sources.router.ts` — modify the `getStats` query starting at the existing line 152.

Add these imports near the top of the file (alongside existing `customers` and `leadSourcesTable` imports):

```ts
import { meetings } from '@/shared/db/schema/meetings'
import { proposals } from '@/shared/db/schema/proposals'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'
```

Replace the body of `getStats` so it returns `totalSales`. New body:

```ts
getStats: agentProcedure
  .input(z.object({ id: z.string().uuid() }).merge(timeRangeInput))
  .query(async ({ ctx, input }) => {
    requireSuperAdmin(ctx.session.user.role)
    const [src] = await db
      .select({ id: leadSourcesTable.id })
      .from(leadSourcesTable)
      .where(eq(leadSourcesTable.id, input.id))
      .limit(1)
    if (!src) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead source not found.' })
    }

    const baseMatch = customersMatchingSource(src.id)
    const rangeClauses = customerCreatedAtInRange(input.from, input.to)
    const rangeWhere = rangeClauses.length > 0
      ? and(baseMatch, ...rangeClauses)
      : baseMatch

    const [total, range, signedCustomers, approvedProposals] = await Promise.all([
      db.$count(customers, baseMatch),
      db.$count(customers, rangeWhere),
      db.$count(customers, and(baseMatch, isSignedCustomerSql())),
      // Approved proposals belonging to customers from this lead source.
      // Hydrate fundingJSON only — no SQL-side TCP extraction. Aggregate via
      // computeFinalTcp + computeProjectValue semantics (sum approved values).
      db
        .select({ fundingJSON: proposals.fundingJSON })
        .from(proposals)
        .innerJoin(meetings, eq(meetings.id, proposals.meetingId))
        .innerJoin(customers, eq(customers.id, meetings.customerId))
        .where(and(eq(customers.leadSourceId, src.id), eq(proposals.status, 'approved'))),
    ])

    let totalSales = 0
    for (const p of approvedProposals) {
      totalSales += computeFinalTcp(p.fundingJSON.data)
    }
    totalSales = Math.round(totalSales)

    return { total, range, signedCustomers, totalSales }
  }),
```

- [ ] **Step 2: Verify the imports resolve**

Run: `pnpm tsc`
Expected: Clean. If `proposals.status` enum check fails, verify the actual column name is `status`. If `proposals.fundingJSON` typing is missing, verify the schema export matches the pipeline DAL pattern at [src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts:259](src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts#L259).

- [ ] **Step 3: Manual smoke**

Start dev server (`pnpm dev`); navigate to `/dashboard/lead-sources?id=<known-source-with-approved-proposals>`. Open the Network tab, find the `getStats` response, verify `totalSales` is present and reasonable (sum of known approved proposal final TCPs).

- [ ] **Step 4: Lint**

Run: `pnpm lint -- src/trpc/routers/lead-sources.router.ts`
Expected: Clean.

- [ ] **Step 5: Commit**

```bash
git add src/trpc/routers/lead-sources.router.ts
git commit -m "feat(lead-sources): getStats returns totalSales"
```

---

## Task 4: Server — `getStatusCounts` procedure

**Files:**
- Modify: `src/trpc/routers/lead-sources.router.ts`

- [ ] **Step 1: Add the procedure to the router**

In `src/trpc/routers/lead-sources.router.ts`, insert this procedure between `getCustomers` and `create` (i.e. right before `create:`):

```ts
getStatusCounts: agentProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    requireSuperAdmin(ctx.session.user.role)
    const [src] = await db
      .select({ id: leadSourcesTable.id })
      .from(leadSourcesTable)
      .where(eq(leadSourcesTable.id, input.id))
      .limit(1)
    if (!src) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead source not found.' })
    }

    const match = customersMatchingSource(src.id)
    const [all, active, signed, dead] = await Promise.all([
      db.$count(customers, match),
      db.$count(customers, and(match, buildSegmentWhere('active'))),
      db.$count(customers, and(match, buildSegmentWhere('signed'))),
      db.$count(customers, and(match, buildSegmentWhere('dead'))),
    ])

    return { all, active, signed, dead }
  }),
```

Add the import at the top of the file (alongside the other lead-sources imports):

```ts
import { buildSegmentWhere } from '@/shared/entities/lead-sources/lib/segment-sql'
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint -- src/trpc/routers/lead-sources.router.ts`
Expected: Clean.

- [ ] **Step 3: Manual smoke**

In the dev server browser console:
```js
fetch('/api/trpc/leadSourcesRouter.getStatusCounts?input=' + encodeURIComponent(JSON.stringify({ json: { id: '<uuid>' } })))
  .then(r => r.json()).then(console.log)
```
Expected: `{ all: N, active: A, signed: S, dead: D }` with `A + S + D === N`.

- [ ] **Step 4: Commit**

```bash
git add src/trpc/routers/lead-sources.router.ts
git commit -m "feat(lead-sources): add getStatusCounts procedure"
```

---

## Task 5: Server — `getCustomers` accepts top-level `segment`

**Files:**
- Modify: `src/trpc/routers/lead-sources.router.ts`

**Why top-level (not a `filters` key):** the existing call site uses `usePaginatedQuery<{ id: string }, …>(…, { id: leadSourceId }, …)` — so business inputs scoped to the procedure live in the `extend({ … })` block alongside `id`. The segment is a panel-level pill control, not a user-visible filter in the `QueryToolbar`. Putting it in `filters` would expose it in the toolbar and require a `FilterDefinition` entry. Top-level is the right home.

- [ ] **Step 1: Extend the input schema and body**

Replace the `getCustomers` procedure (around line 219). Note the `.extend({ id, segment })` and the new `segmentWhere` participating in the `and()`:

```ts
getCustomers: agentProcedure
  .input(paginatedQueryInput({
    pipeline: z.array(z.enum(customerPipelines)).optional(),
    createdAt: dateRangeSchema.optional(),
  }).extend({
    id: z.string().uuid(),
    segment: z.enum(['all', 'active', 'signed', 'dead']).optional(),
  }))
  .query(async ({ ctx, input }) => {
    requireSuperAdmin(ctx.session.user.role)
    const [src] = await db
      .select({ id: leadSourcesTable.id })
      .from(leadSourcesTable)
      .where(eq(leadSourcesTable.id, input.id))
      .limit(1)
    if (!src) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead source not found.' })
    }

    const match = customersMatchingSource(src.id)
    const searchWhere = buildSearchWhere(input.search, [customers.name, customers.email])
    const filterWhere = buildFilterWhere(input.filters, {
      pipeline: v => (v.length > 0 ? inArray(customers.pipeline, v) : undefined),
      createdAt: v => and(
        v.from ? gte(customers.createdAt, v.from) : undefined,
        v.to ? lte(customers.createdAt, v.to) : undefined,
      ),
    })
    const segmentWhere = buildSegmentWhere(input.segment)
    const where = and(match, searchWhere, filterWhere, segmentWhere)

    const orderBy = buildOrderBy(input.sort, {
      name: customers.name,
      email: customers.email,
      createdAt: customers.createdAt,
      pipeline: customers.pipeline,
    }, desc(customers.createdAt))

    return paginate({
      query: () => db
        .select({
          id: customers.id,
          name: customers.name,
          email: customers.email,
          createdAt: customers.createdAt,
          pipeline: customers.pipeline,
        })
        .from(customers)
        .where(where)
        .orderBy(...orderBy)
        .limit(input.pagination.limit)
        .offset(input.pagination.offset),
      count: () => db.$count(customers, where),
    })
  }),
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint -- src/trpc/routers/lead-sources.router.ts`
Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add src/trpc/routers/lead-sources.router.ts
git commit -m "feat(lead-sources): getCustomers accepts top-level segment input"
```

---

## Task 6: Server — `update` accepts `slug` (rotates token)

**Files:**
- Modify: `src/trpc/routers/lead-sources.router.ts`

- [ ] **Step 1: Extend the input schema**

In `src/trpc/routers/lead-sources.router.ts`, modify the `updateInput` schema (around line 83):

```ts
const updateInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  slug: z.string().min(1).max(64).optional(),
  formConfigJSON: leadSourceFormConfigSchema.optional(),
  isActive: z.boolean().optional(),
})
```

- [ ] **Step 2: Update the `update` mutation body to handle slug**

Replace the existing `update` mutation (around line 287):

```ts
update: agentProcedure
  .input(updateInput)
  .mutation(async ({ ctx, input }) => {
    requireSuperAdmin(ctx.session.user.role)
    const { id, slug, ...rest } = input

    const patch: Record<string, unknown> = { ...rest }

    if (slug !== undefined) {
      // Reject malformed input — only canonical kebab-case is accepted.
      if (slugify(slug) !== slug) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Use lowercase letters, numbers, and hyphens only.',
        })
      }
      // Reject duplicates against any other source.
      const [existing] = await db
        .select({ id: leadSourcesTable.id })
        .from(leadSourcesTable)
        .where(and(eq(leadSourcesTable.slug, slug), sql`${leadSourcesTable.id} <> ${id}`))
        .limit(1)
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'That slug is already in use.',
        })
      }
      patch.slug = slug
      patch.token = generateToken()
    }

    const [updated] = await db
      .update(leadSourcesTable)
      .set(patch)
      .where(eq(leadSourcesTable.id, id))
      .returning()
    if (!updated) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead source not found.' })
    }
    return updated
  }),
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint -- src/trpc/routers/lead-sources.router.ts`
Expected: Clean.

- [ ] **Step 4: Commit**

```bash
git add src/trpc/routers/lead-sources.router.ts
git commit -m "feat(lead-sources): update accepts slug + rotates token"
```

---

## Task 7: Server — list filters archived; archive procedure; delete guard

**Files:**
- Modify: `src/trpc/routers/lead-sources.router.ts`

- [ ] **Step 1: Add `isNull` import**

Add `isNull` to the existing drizzle-orm import (around line 3):

```ts
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm'
```

- [ ] **Step 2: Filter archived rows from `list`**

In the `list` procedure (around line 97), modify the `where` clause so archived rows are excluded:

```ts
.where(and(
  isNull(leadSourcesTable.archivedAt),
  includeInactive ? undefined : eq(leadSourcesTable.isActive, true),
))
```

- [ ] **Step 3: Add the `archive` mutation**

Insert this mutation right after `rotateToken` (around line 316):

```ts
archive: agentProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    requireSuperAdmin(ctx.session.user.role)
    const [updated] = await db
      .update(leadSourcesTable)
      .set({ archivedAt: new Date().toISOString() })
      .where(eq(leadSourcesTable.id, input.id))
      .returning()
    if (!updated) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead source not found.' })
    }
    return updated
  }),
```

- [ ] **Step 4: Add the customer-attached guard to `delete`**

Replace the existing `delete` mutation (around line 348):

```ts
delete: agentProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    requireSuperAdmin(ctx.session.user.role)
    const attachedCount = await db.$count(customers, customersMatchingSource(input.id))
    if (attachedCount > 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `${attachedCount} ${attachedCount === 1 ? 'customer is' : 'customers are'} still attached. Reassign or archive instead.`,
      })
    }
    await db.delete(leadSourcesTable).where(eq(leadSourcesTable.id, input.id))
    return { success: true as const }
  }),
```

- [ ] **Step 5: Verify**

Run: `pnpm tsc && pnpm lint -- src/trpc/routers/lead-sources.router.ts`
Expected: Clean.

- [ ] **Step 6: Commit**

```bash
git add src/trpc/routers/lead-sources.router.ts
git commit -m "feat(lead-sources): archive procedure, list filters archived, delete guards"
```

---

## Task 8: Client — `useLeadSourceActions.archiveLeadSource`

**Files:**
- Modify: `src/shared/entities/lead-sources/hooks/use-lead-source-actions.ts`

- [ ] **Step 1: Add the mutation to the hook**

Edit `src/shared/entities/lead-sources/hooks/use-lead-source-actions.ts`. Add the mutation right after `rotateToken` and include it in the returned object:

```ts
const archiveLeadSource = useMutation(
  trpc.leadSourcesRouter.archive.mutationOptions({
    onSuccess: () => {
      invalidateLeadSource()
      toast.success('Lead source archived')
    },
    onError: err => toast.error(err.message || 'Failed to archive'),
  }),
)
```

Add `archiveLeadSource` to the returned object next to `deleteLeadSource`:

```ts
return {
  createLeadSource,
  updateLeadSource,
  toggleActive,
  rotateToken,
  duplicateLeadSource,
  archiveLeadSource,
  deleteLeadSource,
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint -- src/shared/entities/lead-sources/hooks/use-lead-source-actions.ts`
Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/lead-sources/hooks/use-lead-source-actions.ts
git commit -m "feat(lead-sources): expose archiveLeadSource mutation"
```

---

## Task 9: Client — `LeadSourcePerformanceStrip` (new)

**Files:**
- Create: `src/features/lead-sources-admin/ui/components/lead-source-performance-strip.tsx`

- [ ] **Step 1: Create the component**

The project's canonical currency formatter is `formatAsDollars` at [src/shared/lib/formatters.ts:81](src/shared/lib/formatters.ts#L81). Reuse it.

Create `src/features/lead-sources-admin/ui/components/lead-source-performance-strip.tsx`:

```tsx
'use client'

import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'

import { motion } from 'motion/react'

import { useEntranceMotion } from '@/features/lead-sources-admin/lib/use-entrance-motion'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatAsDollars } from '@/shared/lib/formatters'

interface LeadSourcePerformanceStripProps {
  stats: { total: number, range: number, signedCustomers: number, totalSales: number } | undefined
  chip: TimeRangeChip
  isLoading: boolean
}

export function LeadSourcePerformanceStrip({ stats, chip, isLoading }: LeadSourcePerformanceStripProps) {
  const entrance = useEntranceMotion()

  if (isLoading || !stats) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
    )
  }

  const { total, range, signedCustomers, totalSales } = stats

  if (total === 0) {
    return (
      <div className="flex flex-col gap-1">
        <motion.p
          {...entrance(0)}
          className="text-3xl font-semibold tracking-tight tabular-nums text-foreground"
        >
          {formatAsDollars(0)}
        </motion.p>
        <motion.p {...entrance(0.08)} className="text-sm text-muted-foreground">
          No leads yet
        </motion.p>
      </div>
    )
  }

  const showRange = chip.kind !== 'all'

  return (
    <div className="flex flex-col gap-1">
      <motion.p
        {...entrance(0)}
        className="text-3xl font-semibold tracking-tight tabular-nums text-foreground"
      >
        {formatAsDollars(totalSales)}
      </motion.p>
      <motion.p {...entrance(0.08)} className="text-sm text-muted-foreground">
        <span className="tabular-nums">{formatCount(signedCustomers)}</span>
        {' '}
        of
        {' '}
        <span className="tabular-nums">{formatCount(total)}</span>
        {' '}
        signed
        {showRange && (
          <>
            <span aria-hidden="true" className="mx-2 opacity-40">·</span>
            <span className="tabular-nums">{formatCount(range)}</span>
            {' '}
            {renderRangeClause(chip)}
          </>
        )}
      </motion.p>
    </div>
  )
}

function renderRangeClause(chip: TimeRangeChip): string {
  if (chip.key === 'this-month') {
    return 'this month'
  }
  if (chip.kind === 'rolling' && chip.days != null) {
    return `in the last ${chip.days} days`
  }
  if (chip.kind === 'year' && chip.year != null) {
    return `in ${chip.year}`
  }
  return chip.label
}

function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint -- src/features/lead-sources-admin/ui/components/lead-source-performance-strip.tsx`
Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/lead-sources-admin/ui/components/lead-source-performance-strip.tsx
git commit -m "feat(lead-sources): add LeadSourcePerformanceStrip"
```

---

## Task 10: Client — `CustomerStatusSegments`

**Files:**
- Create: `src/features/lead-sources-admin/ui/components/customer-status-segments.tsx`

- [ ] **Step 1: Create the component**

Create `src/features/lead-sources-admin/ui/components/customer-status-segments.tsx`:

```tsx
'use client'

import type { CustomerSegment } from '@/shared/entities/lead-sources/lib/segment-sql'

import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface SegmentDef {
  key: CustomerSegment
  label: string
}

const SEGMENTS: SegmentDef[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'signed', label: 'Signed' },
  { key: 'dead', label: 'Dead' },
]

interface CustomerStatusSegmentsProps {
  value: CustomerSegment
  counts: { all: number, active: number, signed: number, dead: number } | undefined
  onChange: (next: CustomerSegment) => void
  isLoading: boolean
}

export function CustomerStatusSegments({ value, counts, onChange, isLoading }: CustomerStatusSegmentsProps) {
  return (
    <div role="tablist" aria-label="Customer status filter" className="flex flex-wrap gap-2">
      {SEGMENTS.map((seg) => {
        const isActive = seg.key === value
        const count = counts?.[seg.key]
        return (
          <Button
            key={seg.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            size="sm"
            variant={isActive ? 'default' : 'outline'}
            onClick={() => onChange(seg.key)}
            className={cn('h-8 gap-2 text-xs font-medium', isActive && 'shadow-none')}
          >
            <span>{seg.label}</span>
            <span
              className={cn(
                'tabular-nums',
                isActive ? 'text-primary-foreground/80' : 'text-muted-foreground',
              )}
            >
              {isLoading ? '…' : (count ?? 0).toLocaleString()}
            </span>
          </Button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint -- src/features/lead-sources-admin/ui/components/customer-status-segments.tsx`
Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/lead-sources-admin/ui/components/customer-status-segments.tsx
git commit -m "feat(lead-sources): add CustomerStatusSegments component"
```

---

## Task 11: Client — `LeadSourceCustomersSection` accepts `segment`

**Files:**
- Modify: `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx`

**Context:** the section uses the pagination toolkit (`usePaginatedQuery`). Segment flows through the `TExtra` generic and the `extra` argument — NOT through `filters`. When `extra` changes, the toolkit re-derives `queryInput`, the queryKey changes, and tanstack-query refetches with `placeholderData: keepPreviousData` cushioning the swap (see [src/shared/dal/client/query/use-paginated-query.ts:161-187](src/shared/dal/client/query/use-paginated-query.ts#L161-L187)). The toolkit's page-beyond-total clamp at line 199-206 handles the case where switching to a smaller segment leaves the user past the last page.

- [ ] **Step 1: Add the `segment` prop and thread it through `usePaginatedQuery`**

Edit `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx`:

Add the import near the existing imports:

```tsx
import type { CustomerSegment } from '@/shared/entities/lead-sources/lib/segment-sql'
```

Update the props interface:

```tsx
interface LeadSourceCustomersSectionProps {
  leadSourceId: string
  segment?: CustomerSegment
}
```

Update the function signature and the `usePaginatedQuery` call:

```tsx
export function LeadSourceCustomersSection({ leadSourceId, segment }: LeadSourceCustomersSectionProps) {
  const trpc = useTRPC()
  const { invalidateCustomer, invalidateLeadSource } = useInvalidation()
  const { setModal, open: openModal } = useModalStore()

  const pagination = usePaginatedQuery<{ id: string, segment: CustomerSegment | undefined }, CustomerTableRow>(
    trpc.leadSourcesRouter.getCustomers.queryOptions,
    { id: leadSourceId, segment },
    {
      paramPrefix: 'src',
      pageSize: 20,
      pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS,
      filters: CUSTOMER_FILTER_CONFIG,
    },
  )

  // …rest of the file unchanged (mutations, columns, meta, return JSX)…
}
```

Update the caption (around the existing `"${pagination.total.toLocaleString()} total"` line) to reflect the segment:

```tsx
<span className="text-xs text-muted-foreground tabular-nums">
  {pagination.isLoading ? 'Loading…' : `${pagination.total.toLocaleString()} ${segmentCaption(segment)}`}
</span>
```

Add this helper at the bottom of the file (after the component, no default export):

```tsx
function segmentCaption(segment: CustomerSegment | undefined): string {
  switch (segment) {
    case 'active': return 'active'
    case 'signed': return 'signed'
    case 'dead': return 'dead'
    default: return 'total'
  }
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint -- src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx`
Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx
git commit -m "feat(lead-sources): customers section accepts segment input"
```

---

## Task 12: Client — `LeadSourceCustomersPanel`

**Files:**
- Create: `src/features/lead-sources-admin/ui/components/lead-source-customers-panel.tsx`

- [ ] **Step 1: Create the panel**

Create `src/features/lead-sources-admin/ui/components/lead-source-customers-panel.tsx`:

```tsx
'use client'

import type { CustomerSegment } from '@/shared/entities/lead-sources/lib/segment-sql'

import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { parseAsStringEnum, useQueryState } from 'nuqs'

import { CustomerStatusSegments } from '@/features/lead-sources-admin/ui/components/customer-status-segments'
import { LeadSourceCustomersSection } from '@/features/lead-sources-admin/ui/components/lead-source-customers-section'
import { Button } from '@/shared/components/ui/button'
import { customerSegments } from '@/shared/entities/lead-sources/lib/segment-sql'
import { useTRPC } from '@/trpc/helpers'

interface LeadSourceCustomersPanelProps {
  leadSourceId: string
  onAddCustomer: () => void
}

export function LeadSourceCustomersPanel({ leadSourceId, onAddCustomer }: LeadSourceCustomersPanelProps) {
  const trpc = useTRPC()
  const [segment, setSegment] = useQueryState(
    'seg',
    parseAsStringEnum([...customerSegments]).withDefault('active'),
  )

  const countsQuery = useQuery(
    trpc.leadSourcesRouter.getStatusCounts.queryOptions({ id: leadSourceId }),
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <CustomerStatusSegments
          value={segment}
          counts={countsQuery.data}
          onChange={next => setSegment(next as CustomerSegment, { history: 'replace' })}
          isLoading={countsQuery.isLoading}
        />
        <Button
          size="sm"
          onClick={onAddCustomer}
          className="h-11 gap-1.5 sm:h-8"
        >
          <PlusIcon className="size-4" />
          Add customer
        </Button>
      </div>
      <LeadSourceCustomersSection leadSourceId={leadSourceId} segment={segment} />
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint -- src/features/lead-sources-admin/ui/components/lead-source-customers-panel.tsx`
Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/lead-sources-admin/ui/components/lead-source-customers-panel.tsx
git commit -m "feat(lead-sources): add LeadSourceCustomersPanel wrapper"
```

---

## Task 13: Client — `IdentityEditor`

**Files:**
- Create: `src/features/lead-sources-admin/ui/components/identity-editor.tsx`

- [ ] **Step 1: Create the editor**

Create `src/features/lead-sources-admin/ui/components/identity-editor.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { useLeadSourceActions } from '@/shared/entities/lead-sources/hooks/use-lead-source-actions'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { cn } from '@/shared/lib/utils'

interface IdentityEditorProps {
  leadSourceId: string
  initialName: string
  initialSlug: string
}

export function IdentityEditor({ leadSourceId, initialName, initialSlug }: IdentityEditorProps) {
  const { updateLeadSource } = useLeadSourceActions()
  const [name, setName] = useState(initialName)
  const [slug, setSlug] = useState(initialSlug)
  const [SlugConfirmDialog, confirmSlugChange] = useConfirm({
    title: 'Change slug?',
    message: 'This rotates the intake URL. The current URL stops working immediately. Continue?',
  })

  useEffect(() => {
    setName(initialName)
    setSlug(initialSlug)
  }, [initialName, initialSlug, leadSourceId])

  const isDirty = name !== initialName || slug !== initialSlug

  const save = async () => {
    const slugChanged = slug !== initialSlug
    if (slugChanged) {
      const ok = await confirmSlugChange()
      if (!ok) {
        return
      }
    }
    updateLeadSource.mutate({
      id: leadSourceId,
      ...(name !== initialName ? { name } : {}),
      ...(slugChanged ? { slug } : {}),
    })
  }

  const revert = () => {
    setName(initialName)
    setSlug(initialSlug)
  }

  return (
    <section className="flex flex-col gap-4">
      <SlugConfirmDialog />
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Identity
        </h3>
        <div className={cn('flex items-center gap-2', !isDirty && 'invisible')}>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={revert}
            disabled={updateLeadSource.isPending}
          >
            Revert
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={save}
            disabled={updateLeadSource.isPending}
          >
            {updateLeadSource.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="QuoteMe"
            maxLength={120}
          />
        </Field>
        <Field label="Slug" hint="Lowercase, numbers, hyphens only. Changing this rotates the intake URL.">
          <Input
            value={slug}
            onChange={e => setSlug(e.target.value)}
            placeholder="quoteme"
            maxLength={64}
            spellCheck={false}
            autoCapitalize="off"
          />
        </Field>
      </div>
    </section>
  )
}

function Field({ label, hint, children }: { label: string, hint?: string, children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint -- src/features/lead-sources-admin/ui/components/identity-editor.tsx`
Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/lead-sources-admin/ui/components/identity-editor.tsx
git commit -m "feat(lead-sources): add IdentityEditor component"
```

---

## Task 14: Client — `DangerZone`

**Files:**
- Create: `src/features/lead-sources-admin/ui/components/danger-zone.tsx`

- [ ] **Step 1: Create the component**

Create `src/features/lead-sources-admin/ui/components/danger-zone.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { Switch } from '@/shared/components/ui/switch'
import { useLeadSourceActions } from '@/shared/entities/lead-sources/hooks/use-lead-source-actions'
import { useConfirm } from '@/shared/hooks/use-confirm'

interface DangerZoneProps {
  leadSourceId: string
  slug: string
  isActive: boolean
  customerCount: number
}

export function DangerZone({ leadSourceId, slug, isActive, customerCount }: DangerZoneProps) {
  const router = useRouter()
  const { toggleActive, archiveLeadSource, deleteLeadSource } = useLeadSourceActions()

  const [ArchiveConfirmDialog, confirmArchive] = useConfirm({
    title: 'Archive this lead source?',
    message: 'It will be hidden from the lead-source list. Existing customers stay attached.',
  })

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const canDelete = customerCount === 0
  const deleteMatch = deleteText === slug

  const onPause = (next: boolean) => {
    toggleActive.mutate({ id: leadSourceId, isActive: next })
  }

  const onArchive = async () => {
    const ok = await confirmArchive()
    if (!ok) {
      return
    }
    archiveLeadSource.mutate({ id: leadSourceId }, {
      onSuccess: () => router.push('/dashboard/lead-sources'),
    })
  }

  const onDelete = () => {
    deleteLeadSource.mutate({ id: leadSourceId }, {
      onSuccess: () => {
        setDeleteOpen(false)
        router.push('/dashboard/lead-sources')
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to delete')
      },
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Danger zone
      </h3>
      <div className="flex flex-col rounded-lg border border-destructive/40">
        <ArchiveConfirmDialog />

        <Row
          title="Pause intake"
          description="Stops new submissions to this source's intake URL. Existing customers stay attached."
        >
          <Switch
            checked={isActive}
            disabled={toggleActive.isPending}
            onCheckedChange={next => onPause(next)}
            aria-label={isActive ? 'Pause intake' : 'Resume intake'}
            className="data-[state=checked]:bg-emerald-500"
          />
        </Row>

        <div className="border-t border-border/40" aria-hidden="true" />

        <Row
          title="Archive"
          description="Hide from the lead-source list. Data is preserved and can be restored."
        >
          <Button
            variant="outline"
            size="sm"
            onClick={onArchive}
            disabled={archiveLeadSource.isPending}
            className="border-destructive/60 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {archiveLeadSource.isPending ? 'Archiving…' : 'Archive'}
          </Button>
        </Row>

        <div className="border-t border-destructive/20" aria-hidden="true" />

        <Row
          title="Delete"
          description={
            canDelete
              ? 'Permanent. Removes this lead source completely.'
              : `${customerCount} ${customerCount === 1 ? 'customer is' : 'customers are'} still attached. Reassign or archive instead.`
          }
        >
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            disabled={!canDelete}
          >
            Delete…
          </Button>
        </Row>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete lead source?</DialogTitle>
            <DialogDescription>
              Type
              {' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{slug}</code>
              {' '}
              to confirm. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteText}
            onChange={e => setDeleteText(e.target.value)}
            placeholder={slug}
            spellCheck={false}
            autoCapitalize="off"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!deleteMatch || deleteLeadSource.isPending}
              onClick={onDelete}
            >
              {deleteLeadSource.isPending ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function Row({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the imports resolve**

Run: `pnpm tsc && pnpm lint -- src/features/lead-sources-admin/ui/components/danger-zone.tsx`
Expected: Clean. If `Dialog` components don't import from `@/shared/components/ui/dialog`, search the codebase for the actual dialog primitive (`grep -rn "DialogContent" src/shared/components/ui/`).

- [ ] **Step 3: Commit**

```bash
git add src/features/lead-sources-admin/ui/components/danger-zone.tsx
git commit -m "feat(lead-sources): add DangerZone component"
```

---

## Task 15: Client — drop inner headings on `IntakeUrlCard` + `FormConfigEditor`

**Files:**
- Modify: `src/features/lead-sources-admin/ui/components/intake-url-card.tsx`
- Modify: `src/features/lead-sources-admin/ui/components/form-config-editor.tsx`

- [ ] **Step 1: `IntakeUrlCard` — replace the inner header with a Rotate-only row**

In `src/features/lead-sources-admin/ui/components/intake-url-card.tsx`, replace the existing `<div className="flex items-center justify-between">` block (containing the `<h3>Intake URL</h3>` and the Rotate button) with a single right-aligned Rotate button:

```tsx
return (
  <section className="flex flex-col gap-3">
    <RotateConfirmDialog />
    <div className="flex items-center justify-between">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Intake URL
      </h3>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        onClick={rotate}
        disabled={rotateToken.isPending}
      >
        <RefreshCwIcon className="size-3.5" />
        Rotate
      </Button>
    </div>
    {/* …rest of the existing markup unchanged… */}
  </section>
)
```

(The heading stays — Settings sections each have their own heading. The change in this task is to wrap the markup in a `<section>` instead of a bare `<div>`. If the file already exports a `<div>`-rooted component, change the wrapper to `<section>`.)

- [ ] **Step 2: `FormConfigEditor` — wrap in `<section>` and keep heading**

In `src/features/lead-sources-admin/ui/components/form-config-editor.tsx`, change the outermost `<div className="flex flex-col gap-5">` to `<section className="flex flex-col gap-5">`. The heading stays.

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint -- src/features/lead-sources-admin/ui/components/intake-url-card.tsx src/features/lead-sources-admin/ui/components/form-config-editor.tsx`
Expected: Clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/lead-sources-admin/ui/components/intake-url-card.tsx src/features/lead-sources-admin/ui/components/form-config-editor.tsx
git commit -m "refactor(lead-sources): wrap IntakeUrlCard + FormConfigEditor in section"
```

---

## Task 16: Client — `LeadSourceSettingsPanel`

**Files:**
- Create: `src/features/lead-sources-admin/ui/components/lead-source-settings-panel.tsx`

- [ ] **Step 1: Create the panel**

Create `src/features/lead-sources-admin/ui/components/lead-source-settings-panel.tsx`:

```tsx
'use client'

import type { AppRouterOutputs } from '@/trpc/routers/app'

import { useQuery } from '@tanstack/react-query'

import { DangerZone } from '@/features/lead-sources-admin/ui/components/danger-zone'
import { FormConfigEditor } from '@/features/lead-sources-admin/ui/components/form-config-editor'
import { IdentityEditor } from '@/features/lead-sources-admin/ui/components/identity-editor'
import { IntakeUrlCard } from '@/features/lead-sources-admin/ui/components/intake-url-card'
import { useTRPC } from '@/trpc/helpers'

type LeadSource = AppRouterOutputs['leadSourcesRouter']['getById']

interface LeadSourceSettingsPanelProps {
  source: LeadSource
}

export function LeadSourceSettingsPanel({ source }: LeadSourceSettingsPanelProps) {
  const trpc = useTRPC()

  const countsQuery = useQuery(
    trpc.leadSourcesRouter.getStatusCounts.queryOptions({ id: source.id }),
  )
  const customerCount = countsQuery.data?.all ?? 0

  return (
    <div className="flex flex-col gap-6">
      <IdentityEditor
        leadSourceId={source.id}
        initialName={source.name}
        initialSlug={source.slug}
      />

      <div className="border-t border-border/40 pt-6">
        <IntakeUrlCard leadSourceId={source.id} slug={source.slug} token={source.token} />
      </div>

      <div className="border-t border-border/40 pt-6">
        <FormConfigEditor leadSourceId={source.id} initial={source.formConfigJSON} />
      </div>

      <div className="border-t border-border/40 pt-6">
        <DangerZone
          leadSourceId={source.id}
          slug={source.slug}
          isActive={source.isActive}
          customerCount={customerCount}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint -- src/features/lead-sources-admin/ui/components/lead-source-settings-panel.tsx`
Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/lead-sources-admin/ui/components/lead-source-settings-panel.tsx
git commit -m "feat(lead-sources): add LeadSourceSettingsPanel composer"
```

---

## Task 17: Client — `LeadSourceAnalyticsPlaceholder`

**Files:**
- Create: `src/features/lead-sources-admin/ui/components/lead-source-analytics-placeholder.tsx`

- [ ] **Step 1: Create the placeholder**

Create `src/features/lead-sources-admin/ui/components/lead-source-analytics-placeholder.tsx`:

```tsx
'use client'

import { BarChart3Icon } from 'lucide-react'

export function LeadSourceAnalyticsPlaceholder() {
  return (
    <div className="flex h-full min-h-70 flex-col items-center justify-center gap-3 rounded-lg border border-border/40 px-6 py-10 text-center">
      <BarChart3Icon aria-hidden="true" className="size-8 text-muted-foreground/50" />
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-foreground">Coming soon</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Funnel breakdown, weekly trend, and cohort analysis. The headline metrics above and the Customers tab cover the daily questions in the meantime.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint -- src/features/lead-sources-admin/ui/components/lead-source-analytics-placeholder.tsx`
Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/lead-sources-admin/ui/components/lead-source-analytics-placeholder.tsx
git commit -m "feat(lead-sources): add LeadSourceAnalyticsPlaceholder"
```

---

## Task 18: Client — `LeadSourceDetailHeader` rewrite

**Files:**
- Modify: `src/features/lead-sources-admin/ui/components/lead-source-detail-header.tsx`

- [ ] **Step 1: Replace the file body**

Replace the entire body of `src/features/lead-sources-admin/ui/components/lead-source-detail-header.tsx` with:

```tsx
'use client'

import type { AppRouterOutputs } from '@/trpc/routers/app'

import { motion } from 'motion/react'
import { ArchiveIcon, MoreHorizontalIcon, PauseIcon, SettingsIcon } from 'lucide-react'

import { useEntranceMotion } from '@/features/lead-sources-admin/lib/use-entrance-motion'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { cn } from '@/shared/lib/utils'

type LeadSourceRow = AppRouterOutputs['leadSourcesRouter']['getById']

interface LeadSourceDetailHeaderProps {
  source: LeadSourceRow
  onJumpToSettings: () => void
}

export function LeadSourceDetailHeader({ source, onJumpToSettings }: LeadSourceDetailHeaderProps) {
  const entrance = useEntranceMotion()

  return (
    <header className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <motion.p
          {...entrance(0, 6)}
          className="text-[11px] text-muted-foreground"
        >
          <span className="font-medium uppercase tracking-[0.18em]">Lead source</span>
          <span aria-hidden="true" className="mx-2 opacity-40">·</span>
          <span className="tabular-nums" translate="no">
            /
            {source.slug}
          </span>
        </motion.p>
        <motion.h2
          {...entrance(0.04, 6)}
          className="truncate text-3xl font-semibold tracking-tight text-foreground"
        >
          {source.name}
        </motion.h2>
      </div>
      <motion.div {...entrance(0.08, 6)} className="flex shrink-0 items-center gap-3">
        <ActiveIndicator isActive={source.isActive} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 sm:h-8 sm:w-8"
              aria-label="Lead source actions"
            >
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={onJumpToSettings}>
              <SettingsIcon className="size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onJumpToSettings}>
              <PauseIcon className="size-4" />
              Pause intake
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onJumpToSettings}>
              <ArchiveIcon className="size-4" />
              Archive…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>
    </header>
  )
}

function ActiveIndicator({ isActive }: { isActive: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full',
          isActive ? 'bg-emerald-500' : 'bg-muted-foreground/40',
        )}
      />
      <span className={cn('text-xs', isActive ? 'text-foreground' : 'text-muted-foreground')}>
        {isActive ? 'Active' : 'Inactive'}
      </span>
    </span>
  )
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint -- src/features/lead-sources-admin/ui/components/lead-source-detail-header.tsx`
Expected: Clean. If `dropdown-menu` primitive is missing, search the codebase: `grep -rn "DropdownMenuTrigger" src/shared/components/ui/`.

- [ ] **Step 3: Commit**

```bash
git add src/features/lead-sources-admin/ui/components/lead-source-detail-header.tsx
git commit -m "refactor(lead-sources): header read-only Active + navigational kebab"
```

---

## Task 19: Client — `source-detail.tsx` integration

**Files:**
- Modify: `src/features/lead-sources-admin/ui/components/source-detail.tsx`

- [ ] **Step 1: Replace the file body**

Replace the entire body of `src/features/lead-sources-admin/ui/components/source-detail.tsx` with:

```tsx
'use client'

import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'

import { useQuery } from '@tanstack/react-query'
import { parseAsStringEnum, useQueryState } from 'nuqs'
import { useEffect } from 'react'

import { LeadSourceAnalyticsPlaceholder } from '@/features/lead-sources-admin/ui/components/lead-source-analytics-placeholder'
import { LeadSourceCustomersPanel } from '@/features/lead-sources-admin/ui/components/lead-source-customers-panel'
import { LeadSourceDetailHeader } from '@/features/lead-sources-admin/ui/components/lead-source-detail-header'
import { LeadSourcePerformanceStrip } from '@/features/lead-sources-admin/ui/components/lead-source-performance-strip'
import { LeadSourceSettingsPanel } from '@/features/lead-sources-admin/ui/components/lead-source-settings-panel'
import { MobileBackButton } from '@/features/lead-sources-admin/ui/components/mobile-back-button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

const SOURCE_TABS = ['customers', 'analytics', 'settings'] as const
type SourceTab = (typeof SOURCE_TABS)[number]

interface SourceDetailProps {
  leadSourceId: string
  activeChip: TimeRangeChip
  range: { from?: string, to?: string }
  onAddCustomer: (source: { slug: string, name: string }) => void
  /** Pops back to the list on mobile. Button hidden on lg+. */
  onBack?: () => void
}

export function SourceDetail({ leadSourceId, activeChip, range, onAddCustomer, onBack }: SourceDetailProps) {
  const trpc = useTRPC()
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringEnum([...SOURCE_TABS]).withDefault('customers'),
  )

  // Backward compat: redirect ?tab=overview to ?tab=customers so old bookmarks
  // land on the new default tab.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') === 'overview') {
      void setTab('customers', { history: 'replace' })
    }
  }, [setTab])

  const sourceQuery = useQuery(
    trpc.leadSourcesRouter.getById.queryOptions({ id: leadSourceId }),
  )

  const statsQuery = useQuery(
    trpc.leadSourcesRouter.getStats.queryOptions({
      id: leadSourceId,
      from: range.from,
      to: range.to,
    }),
  )

  const countsQuery = useQuery(
    trpc.leadSourcesRouter.getStatusCounts.queryOptions({ id: leadSourceId }),
  )

  if (sourceQuery.isLoading || !sourceQuery.data) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  const source = sourceQuery.data
  const customerCountLabel = countsQuery.data?.all

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 sm:gap-6 sm:p-6">
      {onBack && <MobileBackButton label="All sources" onClick={onBack} />}
      <LeadSourceDetailHeader
        source={source}
        onJumpToSettings={() => setTab('settings', { history: 'push' })}
      />

      <section aria-label="Performance">
        <LeadSourcePerformanceStrip
          stats={statsQuery.data}
          chip={activeChip}
          isLoading={statsQuery.isLoading}
        />
      </section>

      <Tabs
        value={tab}
        onValueChange={v => setTab(v as SourceTab, { history: 'replace' })}
        className="flex min-h-0 flex-1 flex-col gap-4"
      >
        <TabsList
          className={cn(
            'h-auto w-full justify-start gap-4 rounded-none border-b border-border/40 bg-transparent p-0',
          )}
        >
          <TabsTrigger
            value="customers"
            className={cn(
              'rounded-none border-b-2 border-transparent bg-transparent px-2 py-3 text-sm font-medium text-muted-foreground shadow-none',
              'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none',
            )}
          >
            Customers
            {customerCountLabel != null && (
              <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                {customerCountLabel}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className={cn(
              'rounded-none border-b-2 border-transparent bg-transparent px-2 py-3 text-sm font-medium text-muted-foreground shadow-none',
              'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none',
            )}
          >
            Analytics
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className={cn(
              'rounded-none border-b-2 border-transparent bg-transparent px-2 py-3 text-sm font-medium text-muted-foreground shadow-none',
              'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none',
            )}
          >
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="flex min-h-0 flex-1 flex-col">
          <LeadSourceCustomersPanel
            leadSourceId={source.id}
            onAddCustomer={() => onAddCustomer({ slug: source.slug, name: source.name })}
          />
        </TabsContent>

        <TabsContent value="analytics" className="flex min-h-0 flex-1 flex-col">
          <LeadSourceAnalyticsPlaceholder />
        </TabsContent>

        <TabsContent value="settings" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <LeadSourceSettingsPanel source={source} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript and lint**

Run: `pnpm tsc && pnpm lint -- src/features/lead-sources-admin/ui/components/source-detail.tsx`
Expected: Clean.

- [ ] **Step 3: Manual dev-server verification**

Run: `pnpm dev`. In a browser, navigate to `/dashboard/lead-sources?id=<known-uuid>`. Verify:

- The page lands on the **Customers** tab by default (URL has no `?tab=` or `?tab=customers`).
- The KPI strip above shows `${totalSales}` as the headline, with `{N} of {M} signed · {K} in the last 30 days` below.
- The "Active" pill in the header is read-only (no Switch).
- Clicking the kebab shows three items (Settings, Pause intake, Archive); each one navigates to the **Settings** tab.
- Clicking Customers tab shows pill segments (`All / Active / Signed / Dead`) above the table; default segment is `Active`.
- Switching segments updates the table and the segment count badges align.
- Clicking Settings tab shows four sections (Identity, Intake URL, Form configuration, Danger zone). Each section has its own heading.
- Settings → Identity: editing the name + clicking Save shows a success toast and the header reflects the new name.
- Settings → Identity: editing the slug shows a confirmation dialog; confirming rotates the intake URL (verify the URL string changes after save).
- Settings → Danger zone: Pause toggle disables the source (header indicator turns gray); toggling it back re-enables.
- Settings → Danger zone: Delete is disabled when customers > 0 with a tooltip describing why.
- Old URLs `?tab=overview` redirect to `?tab=customers`.

- [ ] **Step 4: Commit**

```bash
git add src/features/lead-sources-admin/ui/components/source-detail.tsx
git commit -m "feat(lead-sources): three-tab detail panel with customers default"
```

---

## Task 20: Final verification + cleanup

**Files:**
- (potentially) any of the modified files

- [ ] **Step 1: Full type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: Clean across the repo.

- [ ] **Step 2: Cross-pane regression check**

In the dev server, visit `/dashboard/lead-sources` (no `id` param). Verify the **All pane** still renders correctly:

- The aggregate `PerformanceStrip` (the original component) shows the lifetime "X of Y signed" hero — unchanged.
- The All-pane "Add customer" button still works.
- The list of lead sources excludes any rows whose `archivedAt` is set (test by archiving one source and confirming it disappears from the picker; restore it via direct DB update if needed since there's no unarchive UI in Phase 1).

- [ ] **Step 3: Confirm no orphan references**

Run: `grep -rn "PerformanceStrip\|LeadSourcePerformanceStrip" src/features/lead-sources-admin`

Expected output:
- `LeadSourcePerformanceStrip` only referenced in `source-detail.tsx` and its own definition.
- `PerformanceStrip` only referenced in `all-detail.tsx` and its own definition.

- [ ] **Step 4: Commit any final adjustments**

If Steps 1–3 reveal small issues (typo, missing import, orphan reference), fix and commit:

```bash
git add <files>
git commit -m "fix(lead-sources): post-integration cleanup"
```

If everything is already clean, skip the commit.

---

## Verification gate (end-to-end)

Before opening a PR for Phase 1, confirm:

- [ ] `pnpm tsc` passes with zero errors.
- [ ] `pnpm lint` passes with zero errors.
- [ ] On `/dashboard/lead-sources?id=<source-with-approved-proposals>`:
  - [ ] Customers tab is active by default.
  - [ ] KPI strip shows non-zero `totalSales` matching the sum of approved proposal final TCPs for that source's customers.
  - [ ] Status segments show counts whose sum (active + signed + dead) equals `all`.
  - [ ] Settings tab shows four sections in order: Identity, Intake URL, Form configuration, Danger zone.
  - [ ] Pause toggle in Danger zone updates the header indicator without a page reload.
  - [ ] Slug change rotates the intake URL within the same save.
  - [ ] Delete is disabled when customers > 0; enabled with typed-confirm when customers == 0.
- [ ] On `/dashboard/lead-sources?id=<source-with-zero-leads>`:
  - [ ] KPI strip shows `$0` headline and `No leads yet` subtitle (no middot, no range clause).
- [ ] All pane (`?id=all`) is unchanged from before this work.
