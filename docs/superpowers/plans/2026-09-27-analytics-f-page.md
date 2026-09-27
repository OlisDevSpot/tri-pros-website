# Analytics Spec F — Analytics Page v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the super-admin Analytics page at `/dashboard/analytics`: one global filter bar, the tabs Overview · Leads · Appointments · Sales · Projects (placeholder) · Spend, per-source monthly spend with cost per stage, and "Data to fix" counts that link out to pre-filtered records tables.

**Architecture:** The server builds one report per filter state. `analyticsRouter.report` → `getAnalyticsReport` (feature DAL: loads facts, sources and spend) → the pure `buildAnalyticsReport`, which runs Spec A's `aggregateLeadRecords` for the headline, the breakdown and a 12-month trend and adds spend and cost from new rules in `analytics-rules.ts`. The browser never counts. It maps URL state to the report input with one shared function (so the page's prefetch and the view ask for the same query key) and renders what comes back. Spend is lead-source data: its table, DAL, procedures (`leadSourcesRouter.spend.grid` / `.set`) and client mutations (`useLeadSourceActions`) belong to the lead-source entity; the analytics feature only reads it.

**Tech Stack:** Next.js 15 App Router, tRPC v11 + TanStack Query (`useTRPC`, `queryOptions`), nuqs v2 URL state, Drizzle (Postgres/Neon), Zod 4, recharts 2, shadcn/ui, `tsx` + `node:assert/strict` for the verify script.

**Spec:** `docs/superpowers/specs/2026-09-27-analytics-f-page-design.md` (owner-approved 2026-09-27, amended at planning). **Tracker:** `docs/plans/2026-09-26-analytics-epic.md` (IDs E*, F*, C*). **Layout reference:** https://claude.ai/artifact/YbAcMRCyMJe7zgeBSjU1x9 (option A's layout + option C's focus bar chart and "Data to fix" panel). Read the spec before starting.

## Global Constraints

- **Branch:** local `main` (house rule). Another session works in the same tree, so the tree has unrelated uncommitted files. Stage **by explicit path only**. Never `git add -A`, `git add .`, `git stash`, `git checkout -- .` or `git reset`.
- **Gates on every commit:** `pnpm tsx scripts/verify-analytics-rules.ts`, `pnpm tsc` and `pnpm lint` pass. Never run `pnpm build`. Fix style with `pnpm exec eslint --fix <the files you touched>`, never a repo-wide `--fix`.
- **Schema push is the owner's.** Never run `pnpm db:push:*`. Task 1 changes the schema; the owner runs `pnpm db:push:dev` after it lands. Tasks 2–4 are pure and need no database. From Task 5 on, anything that touches the dev database (the smoke step, the dev server) needs that push: if it has not happened, stop and ask for it.
- **Deploy order (tell the owner, never act on it):** `pnpm db:push:prod` must land **before** this code reaches origin/main. The lead-sources queries select every column, so code that knows `spend_mode` breaks the Lead Sources page on a database without it.
- **No test data writes.** Never seed, insert or update rows to test. The spend grid's saving is checked by the owner by hand.
- **Pure libs stay pure:** everything under `src/features/analytics/lib/`, `constants/` and `schemas/` imports no DB, tRPC, React or `next/*` at runtime (type imports are fine, always `import type`). The verify script imports them and must never load the DB.
- **`shared/` never imports from `features/`.**
- **Every number comes from the rule layer (F12, C38):** each rule is one named export in `src/features/analytics/lib/analytics-rules.ts` (or `analytics-periods.ts` for calendar rules) with a one-line comment giving the business *why*. The aggregator, the report builder, the router and the components hold no metric logic. Components only read, format and sort report values.
- **Enums:** the value tuple lives in `src/shared/constants/enums/<domain>.ts`; the type derives via `(typeof x)[number]`; storage is `text(..., { enum })`, never a new pgEnum (`docs/codebase-conventions/enum-standardization.md#text-with-enum`).
- **`updatedAt` is never set by hand**; the schema helper's `$onUpdate` bumps it (also on `onConflictDoUpdate`).
- **Comments say why, never what.** No file banners. Never cite a plan, spec, tracker ID (C*, E*, F*) or doc in code.
- **Imports:** absolute `@/…`, type imports first, named exports only.
- **One React component per file**, and no file-level helper functions, constants or interfaces in component files other than the component's own `Props` (`docs/codebase-conventions/frontend-stack.md#one-react-component-per-file`). Helpers go to `lib/`, label maps and configs to `constants/`, shared shapes to `types/`.
- **No casts** (`as X`) to make values fit a type; narrow them (`.find(t => t === value)`, `.flatMap`). The only existing exceptions are the ones the repo's own helpers already carry.
- **Reuse before building:** `MultiSelectFilterControl` for multi-selects, `ChartTooltipCard` for chart tooltips, `useLeadSourceActions` for lead-source mutations, `useInvalidation` for cache refreshes.
- **Design system (DESIGN.md "Command Desk"):** tokens only (`bg-background`, `text-muted-foreground`, `border-border`, `text-primary`, `bg-warning`, …), no hex. Cobalt (`primary`) is reserved for action and selection. Headings use the default heading font (Syne); body text is Nunito by default. No KPI-card grid: the headline is one hairline strip. `tabular-nums` wherever digits line up.
- **Verify script:** `scripts/verify-analytics-rules.ts`, one numbered section per rule group, each ending `console.log('N. <name> ✓')`. New sections 11–15 go in order after section 10; the final `console.log('✅ verify-analytics-rules passed')` stays the last line.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

Inputs the spec implies but does not spell out. Each has a test in the task that owns the code.

1. **The current month is half over.** Spend for "this month" must count only the days through today (26 of 30 days on Sep 26), never the whole month, or cost per lead reads 15% high mid-month, which is the owner's main moment. Test: Task 3 (`spendInRange`) and Task 4 (report headline).
2. **A stale or hand-edited URL.** `?period=custom` with no dates, `?from=2026-13-45`, `?source=not-a-uuid`, or a `groupBy` the tab does not offer must fall back to a valid report, never a BAD_REQUEST or a blank page. Test: Task 7a (`toReportInput`).
3. **Money typed the way people type it.** `$1,200.50`, `1200`, `$0`, a blank (not entered, not $0), and junk (`-5`, `abc`, `12.345`) in a spend cell. Test: Task 7a (`parseDollarsToCents`).
4. **Sources that should never be flagged.** A free (`none`) source, a lead with no source, and a manual source with no leads that month must never show "spend missing"; a manual source with a lead at 11:30 pm Pacific on the last day of a month is missing for *that* month. Test: Task 3 (`findMissingSpend`).
5. **A period that runs into the future.** A custom range or quarter ending after today: future months show zero leads and a cost of "—" (nothing to divide), never "missing" and never negative. Test: Task 4.
6. **Leads with no source.** Filtering to "Unknown source" (alone or beside a real source) must make cost "n/a", never "$0" or a diluted cost per lead: unknown-source leads have no spend to divide. Test: Task 3 (`notApplicableReasons`).
7. **Missing spend that has no cell.** An archived paid source that still owes spend, or a missing month outside the 12-month trend (a long custom period), must still have a cell in the Spend grid, or the warning can never be cleared. Test: Task 4 (`spendGridMonths`); the archived rows are in Task 9.
8. **Server and browser render the same page.** Anything time-dependent in the markup (the "past meetings" link) comes from the report's `generatedAt`, never a `new Date()` in a component, or hydration mismatches. Test: Task 7a (`hygieneHref`).

Spend is not backfilled in this work: until the owner enters it (a later session), paid sources show "Spend missing". That is correct behavior, not a bug to work around.

---

## File map

| File | Responsibility | Task |
|---|---|---|
| `src/shared/constants/enums/lead-sources.ts` (new) · `index.ts` (modify) | `leadSourceSpendModes`, `LeadSourceSpendMode` | 1 |
| `src/shared/db/schema/lead-sources.ts` (modify) | `spend_mode` column | 1 |
| `src/shared/db/schema/lead-source-monthly-spend.ts` (new) · `schema/index.ts` (modify) | spend table, select/insert schemas and types | 1 |
| `src/shared/entities/lead-sources/schemas.ts` (modify) | `leadSourceSpendMonthSchema` | 1 |
| `src/shared/entities/lead-sources/dal/server/spend.ts` (new) | `LeadSourceSpendEntry`, `listLeadSourceSpend`, `setLeadSourceSpend` | 1 |
| `src/shared/entities/lead-sources/dal/server/crud.ts` (modify) | duplicate comment names `spendMode` | 1 |
| `src/trpc/routers/lead-sources.router.ts` (modify) | `update` accepts `spendMode`; `spend` sub-router (`grid`, `set`) | 1 |
| `src/features/analytics/types.ts` → `types/index.ts` (move, modify) | re-exported unions; `mergedRecords`; report types | 2, 4 |
| `src/features/analytics/constants/dimensions.ts` (new) | `MEETING_ORDERS`, `ANALYTICS_GROUP_BYS`, `ANALYTICS_PERIODS` and their types | 2 |
| `src/features/analytics/lib/analytics-periods.ts` (new) | month arithmetic, `resolveAnalyticsPeriod` | 2 |
| `src/features/analytics/lib/analytics-rules.ts` (modify) | `mergedRecordCount` (2); spend, cost and applicability rules (3) | 2, 3 |
| `src/features/analytics/lib/aggregate-lead-records.ts` (modify) | `mergedRecords` tally | 2 |
| `src/features/analytics/schemas/report-input-schema.ts` (new) | `analyticsReportInputSchema`, day schema | 4 |
| `src/features/analytics/lib/build-analytics-report.ts` (new) | `analyticsReportWindow`, `buildAnalyticsReport` | 4 |
| `src/features/analytics/lib/list-lead-places.ts` (new) | `listLeadPlaces` | 4 |
| `src/features/analytics/dal/server/get-analytics-report.ts` (new) | `getAnalyticsReport` | 5 |
| `src/features/analytics/dal/server/get-analytics-filter-options.ts` (new) | `getAnalyticsFilterOptions` | 5 |
| `src/trpc/routers/analytics.router.ts` (new) · `app.ts` (modify) | `report`, `filterOptions` | 5 |
| `src/shared/modules/proposals/core/dal/server/queries.ts` · `src/features/proposal-flow/constants/proposal-table-filter-config.ts` (modify) | `missingApprovedAt`, `noProject` filters | 6 |
| `src/features/analytics/constants/{tabs,metrics,labels,query-parsers}.ts` (new) | tab config, metric catalog, labels, URL parsers | 7a |
| `src/features/analytics/lib/{to-report-input,read-metric,breakdown-columns,trend-points,format-analytics,hygiene-links,filter-update,parse-dollars}.ts` (new) | page-state mapping, metric display, columns, chart points, formatting, links, URL filter updates, money input | 7a |
| `src/features/analytics/hooks/{use-analytics-url-state,use-analytics-labels}.ts` (new) | URL state, names for ids | 7b |
| `src/app/(frontend)/dashboard/analytics/page.tsx` (modify) | guard + prefetch | 7b |
| `src/features/agent-dashboard/lib/get-sidebar-nav.ts` (modify) | Analytics enabled | 7b |
| `src/features/analytics/ui/views/analytics-view.tsx` + `ui/components/filter-bar/{analytics-filter-bar,period-picker,analytics-filters-control,analytics-filters-form,active-filter-chips}.tsx` + `ui/components/{analytics-tabs-list,report-skeleton,projects-placeholder}.tsx` (new) | view shell, filter bar, tabs | 7b |
| `src/features/analytics/ui/components/report/{report-tab-content,headline-strip,headline-figure,metric-text,focus-trend-chart,data-to-fix-panel,breakdown-table,breakdown-row}.tsx` (new) | report tabs | 8 |
| `src/shared/dal/client/hooks/use-invalidation.ts` · `src/shared/entities/lead-sources/hooks/use-lead-source-actions.ts` (modify) | lead-source changes refresh the analytics report; `setSpend` | 9 |
| `src/features/analytics/ui/components/spend/{spend-grid,spend-cell}.tsx` (new) | spend entry grid | 9 |
| `src/features/lead-sources-admin/ui/components/lead-source-detail-header.tsx` (modify) | "View in Analytics" menu item | 10 |
| `CONTEXT.md`, `docs/plans/2026-09-26-analytics-epic.md` (modify) | glossary + tracker | 10 |
| `scripts/verify-analytics-rules.ts` (modify) | sections 11–15 | 2, 3, 4, 7a |

Components sit in subfolders by area (`filter-bar/`, `report/`, `spend/`) with no barrel `index.tsx`, like `src/features/campaigns-admin/ui/components/{leads,overview,setup}/`.

---

### Task 1: Spend storage (the lead-source entity's child table, DAL and procedures)

**Files:**
- Create: `src/shared/constants/enums/lead-sources.ts`
- Modify: `src/shared/constants/enums/index.ts`
- Modify: `src/shared/db/schema/lead-sources.ts`
- Create: `src/shared/db/schema/lead-source-monthly-spend.ts`
- Modify: `src/shared/db/schema/index.ts`
- Modify: `src/shared/entities/lead-sources/schemas.ts`
- Create: `src/shared/entities/lead-sources/dal/server/spend.ts`
- Modify: `src/shared/entities/lead-sources/dal/server/crud.ts` (the duplicate comment)
- Modify: `src/trpc/routers/lead-sources.router.ts` (the `updateInput` object at :97-103; a new `spend` sub-router)

**Interfaces:**
- Produces:
  - `leadSourceSpendModes`, `type LeadSourceSpendMode = 'manual' | 'none'`
  - `leadSourceMonthlySpendTable`, `selectLeadSourceMonthlySpendSchema`, `type LeadSourceMonthlySpend`, `insertLeadSourceMonthlySpendSchema`, `type InsertLeadSourceMonthlySpend`
  - `leadSourceSpendMonthSchema` (`'YYYY-MM'`)
  - `type LeadSourceSpendEntry = Pick<LeadSourceMonthlySpend, 'leadSourceId' | 'month' | 'amountCents'>`
  - `listLeadSourceSpend(months: readonly string[]): Promise<DalReturn<LeadSourceSpendEntry[]>>`
  - `setLeadSourceSpend(ctx: ScopedContext, entry: { leadSourceId: string, month: string, amountCents: number | null }): Promise<DalReturn<void>>`
  - `LeadSourceRecord.spendMode`; `leadSourcesRouter.update` input gains `spendMode?: LeadSourceSpendMode`
  - `leadSourcesRouter.spend.grid` (query, `{ months: string[] }` → `{ sources: { id, name, spendMode, archived }[], entries: LeadSourceSpendEntry[] }`), `leadSourcesRouter.spend.set` (mutation, `{ leadSourceId, month, amountCents: number | null }` → `{ success: true }`). Both `superAdminProcedure`.

Spend is lead-source data, so the entity owns its storage, reads, writes and procedures; analytics only reads it. A child table's procedures live as a named sub-router of the owning entity's router (exemplar: `src/trpc/routers/proposals.router/index.ts:17`, `incentives: incentivesRouter`); one sub-router stays in the flat file (`docs/codebase-conventions/trpc-procedures.md#sub-router-when-2-plus`).

No automated test exists for schema or DAL code in this repo; `pnpm tsc` is the gate, and Task 5's smoke step reads the new table after the owner's push.

- [ ] **Step 1: Add the spend-mode vocabulary**

Create `src/shared/constants/enums/lead-sources.ts`:

```ts
/** `manual`: spend is typed in each month. `none`: the source costs nothing (referrals, walk-ins), so it is never "missing". */
export const leadSourceSpendModes = ['manual', 'none'] as const
export type LeadSourceSpendMode = (typeof leadSourceSpendModes)[number]
```

In `src/shared/constants/enums/index.ts`, add `export * from './lead-sources'` directly above `export * from './leads'`.

- [ ] **Step 2: Add the column**

In `src/shared/db/schema/lead-sources.ts`, add the import beside the other value imports (this file keeps its imports in one block, no blank lines):

```ts
import { leadSourceSpendModes } from '@/shared/constants/enums/lead-sources'
```

and add this column directly above `isActive`:

```ts
  spendMode: text('spend_mode', { enum: leadSourceSpendModes }).notNull().default('manual'),
```

- [ ] **Step 3: Add the spend table**

Create `src/shared/db/schema/lead-source-monthly-spend.ts` (money is `bigint` cents in `mode: 'number'`, like every other `*_cents` column, e.g. `proposal-incentives.ts:21`; the checks follow `proposal-incentives.ts:27-30`):

```ts
import type z from 'zod'
import { sql } from 'drizzle-orm'
import { bigint, check, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { leadSourcesTable } from './lead-sources'

// One row per source per Pacific business month ('YYYY-MM'). No row means
// "not entered", which analytics treats differently from $0.
export const leadSourceMonthlySpendTable = pgTable('lead_source_monthly_spend', {
  id,
  leadSourceId: uuid('lead_source_id').notNull().references(() => leadSourcesTable.id, { onDelete: 'cascade' }),
  month: text('month').notNull(),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  createdAt,
  updatedAt,
}, table => [
  unique('lead_source_monthly_spend_source_month_unique').on(table.leadSourceId, table.month),
  check('lead_source_monthly_spend_amount_ck', sql`${table.amountCents} >= 0`),
  check('lead_source_monthly_spend_month_ck', sql`${table.month} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
])

export const selectLeadSourceMonthlySpendSchema = createSelectSchema(leadSourceMonthlySpendTable)
export type LeadSourceMonthlySpend = z.infer<typeof selectLeadSourceMonthlySpendSchema>

export const insertLeadSourceMonthlySpendSchema = createInsertSchema(leadSourceMonthlySpendTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertLeadSourceMonthlySpend = z.infer<typeof insertLeadSourceMonthlySpendSchema>
```

In `src/shared/db/schema/index.ts`, add `export * from './lead-source-monthly-spend'` on the line after `export * from './lead-sources'` (drizzle-kit reads the schema from this index).

- [ ] **Step 4: Add the month schema**

In `src/shared/entities/lead-sources/schemas.ts`, append:

```ts
/** A Pacific business month, the unit spend is entered in. */
export const leadSourceSpendMonthSchema = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/, 'A month, as YYYY-MM.')
```

- [ ] **Step 5: Add the spend DAL**

Create `src/shared/entities/lead-sources/dal/server/spend.ts`:

```ts
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { LeadSourceMonthlySpend } from '@/shared/db/schema/lead-source-monthly-spend'

import { and, eq, inArray } from 'drizzle-orm'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { leadSourceMonthlySpendTable } from '@/shared/db/schema/lead-source-monthly-spend'
import { leadSourceCrud } from '@/shared/entities/lead-sources/dal/server/crud'

export type LeadSourceSpendEntry = Pick<LeadSourceMonthlySpend, 'leadSourceId' | 'month' | 'amountCents'>

// System-level read: every source's spend, unscoped — callers are super-admin gated at the router.
export async function listLeadSourceSpend(months: readonly string[]): Promise<DalReturn<LeadSourceSpendEntry[]>> {
  return dalDbOperation(async () => {
    if (months.length === 0) {
      return []
    }
    return db
      .select({
        leadSourceId: leadSourceMonthlySpendTable.leadSourceId,
        month: leadSourceMonthlySpendTable.month,
        amountCents: leadSourceMonthlySpendTable.amountCents,
      })
      .from(leadSourceMonthlySpendTable)
      .where(inArray(leadSourceMonthlySpendTable.month, [...months]))
  })
}

/** Clearing a cell deletes its row: blank means "not entered", never $0. */
export async function setLeadSourceSpend(
  ctx: ScopedContext,
  entry: { leadSourceId: string, month: string, amountCents: number | null },
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    // The parent read runs under the caller's scope, so an unknown or out-of-scope source is a not-found, never a foreign-key failure.
    const source = dalVerifySuccess(await leadSourceCrud.getById(ctx, { id: entry.leadSourceId }))
    if (!source) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    if (entry.amountCents === null) {
      await db
        .delete(leadSourceMonthlySpendTable)
        .where(and(
          eq(leadSourceMonthlySpendTable.leadSourceId, entry.leadSourceId),
          eq(leadSourceMonthlySpendTable.month, entry.month),
        ))
      return
    }
    await db
      .insert(leadSourceMonthlySpendTable)
      .values({ leadSourceId: entry.leadSourceId, month: entry.month, amountCents: entry.amountCents })
      .onConflictDoUpdate({
        target: [leadSourceMonthlySpendTable.leadSourceId, leadSourceMonthlySpendTable.month],
        set: { amountCents: entry.amountCents },
      })
  })
}
```

(`crud.ts` already reads its own entity through `crudHandlers.getById(SYSTEM_CONTEXT, { id })` and checks for `null`; this is the same call on the exported `leadSourceCrud`.)

- [ ] **Step 6: Keep the duplicate comment true**

In `src/shared/entities/lead-sources/dal/server/crud.ts`, the comment above `duplicate` says it "copies ONLY name (via override) + formConfigJSON". After Step 2 it also copies `spendMode`, which is right (a copy of a paid source is paid). Change that line to: `// Duplicate copies ONLY name (via override), formConfigJSON and spendMode; slug/token are`, keeping the rest of the comment as is.

- [ ] **Step 7: The router — spend mode on `update`, and the `spend` sub-router**

In `src/trpc/routers/lead-sources.router.ts`, add these imports in their sorted places:

```ts
import { leadSourceSpendModes } from '@/shared/constants/enums/lead-sources'
import { listLeadSources } from '@/shared/entities/lead-sources/dal/server/queries'
import { listLeadSourceSpend, setLeadSourceSpend } from '@/shared/entities/lead-sources/dal/server/spend'
```

and extend the existing `@/shared/entities/lead-sources/schemas` import to `import { leadSourceFormConfigSchema, leadSourceSpendMonthSchema } from '@/shared/entities/lead-sources/schemas'`.

Add this field to the `updateInput` object, after `isActive`:

```ts
  spendMode: z.enum(leadSourceSpendModes).optional(),
```

(`update` already passes `...data` to `leadSourceCrud.update`, so nothing else changes there.)

Add this block directly above `export const leadSourcesRouter = createTRPCRouter({`:

```ts
// $10M a month is far past any real spend; the cap only stops a typo from landing.
const MAX_MONTHLY_SPEND_CENTS = 1_000_000_000

// Ten years of columns: the grid shows twelve months plus any older month still owed spend.
const MAX_SPEND_GRID_MONTHS = 120

const spendRouter = createTRPCRouter({
  grid: superAdminProcedure
    .input(z.object({ months: z.array(leadSourceSpendMonthSchema).min(1).max(MAX_SPEND_GRID_MONTHS) }))
    .query(async ({ input }) => {
      const [sources, entries] = await Promise.all([listLeadSources(), listLeadSourceSpend(input.months)])
      return {
        sources: dalToTrpc(sources).map(s => ({ id: s.id, name: s.name, spendMode: s.spendMode, archived: s.archivedAt !== null })),
        entries: dalToTrpc(entries),
      }
    }),

  set: superAdminProcedure
    .input(z.object({
      leadSourceId: z.string().uuid(),
      month: leadSourceSpendMonthSchema,
      amountCents: z.number().int().min(0).max(MAX_MONTHLY_SPEND_CENTS).nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await setLeadSourceSpend({ ...ctx, scope: null }, input))
      return { success: true as const }
    }),
})
```

and add `spend: spendRouter,` as the last entry of the `createTRPCRouter({...})` object passed to `leadSourcesRouter`.

- [ ] **Step 8: Gates**

Run: `pnpm exec eslint --fix src/shared/constants/enums/lead-sources.ts src/shared/constants/enums/index.ts src/shared/db/schema/lead-sources.ts src/shared/db/schema/lead-source-monthly-spend.ts src/shared/db/schema/index.ts src/shared/entities/lead-sources/schemas.ts src/shared/entities/lead-sources/dal/server/spend.ts src/shared/entities/lead-sources/dal/server/crud.ts src/trpc/routers/lead-sources.router.ts && pnpm tsc && pnpm lint && pnpm tsx scripts/verify-analytics-rules.ts`
Expected: all clean. If `pnpm tsc` flags an object literal typed `LeadSourceRecord` (a fixture or a mapper) missing `spendMode`, add `spendMode: 'manual'` there. If `spend.ts` importing `crud.ts` creates an import cycle lint reports, read the parent with `getLeadSourceById` from `queries.ts` instead and report the change.

- [ ] **Step 9: Commit**

```bash
git add src/shared/constants/enums/lead-sources.ts src/shared/constants/enums/index.ts src/shared/db/schema/lead-sources.ts src/shared/db/schema/lead-source-monthly-spend.ts src/shared/db/schema/index.ts src/shared/entities/lead-sources/schemas.ts src/shared/entities/lead-sources/dal/server/spend.ts src/shared/entities/lead-sources/dal/server/crud.ts src/trpc/routers/lead-sources.router.ts
git commit -m "$(cat <<'EOF'
feat(lead-sources): monthly spend table, per-source spend mode, spend procedures

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 10: Owner action (report, do not run)**

Report to the controller: "Schema changed. The owner needs to run `pnpm db:push:dev` (adds `lead_sources.spend_mode` and `lead_source_monthly_spend`). Until then the Lead Sources page fails on the dev database."

---

### Task 2: Periods and merged duplicates

**Files:**
- Move: `src/features/analytics/types.ts` → `src/features/analytics/types/index.ts` (the feature convention; 5 of 6 features use `types/`)
- Create: `src/features/analytics/constants/dimensions.ts`
- Modify: `src/features/analytics/types/index.ts`
- Create: `src/features/analytics/lib/analytics-periods.ts`
- Modify: `src/features/analytics/lib/analytics-rules.ts`
- Modify: `src/features/analytics/lib/aggregate-lead-records.ts`
- Test: `scripts/verify-analytics-rules.ts` (sections 11, 12)

**Interfaces:**
- Consumes: `addCalendarDays`, `BUSINESS_TIMEZONE`, `businessDayKey`, `startOfDayInTimeZone` from `@/shared/lib/business-time`.
- Produces: `MEETING_ORDERS`, `ANALYTICS_GROUP_BYS`, `ANALYTICS_PERIODS` (const tuples, each with its type right under it: `MeetingOrder`, `AnalyticsGroupBy`, `AnalyticsPeriod`, re-exported from `@/features/analytics/types`); `addMonths(monthKey: string, months: number): string`; `lastDayOfMonth(monthKey: string): string`; `monthsBetween(first: string, last: string): string[]`; `interface ResolvedPeriod { firstDay: string, lastDay: string, range: { from: string, to: string } }`; `resolveAnalyticsPeriod(input: { period: AnalyticsPeriod, from?: string, to?: string }, now: Date): ResolvedPeriod`; `mergedRecordCount(person: { customerIds: readonly string[] }): number`; `AnalyticsCounts.mergedRecords: number | null`.

- [ ] **Step 0: Move the types file into `types/`**

Run: `mkdir -p src/features/analytics/types && git mv src/features/analytics/types.ts src/features/analytics/types/index.ts`
The import path `@/features/analytics/types` resolves to the new file, so no importer changes.

- [ ] **Step 1: Write the failing checks**

In `scripts/verify-analytics-rules.ts`, add to the imports:

```ts
import { addMonths, lastDayOfMonth, monthsBetween, resolveAnalyticsPeriod } from '@/features/analytics/lib/analytics-periods'
```

and add these two sections after section 10's `console.log('10. Bankability ✓')` and before the final `console.log('✅ verify-analytics-rules passed')`:

```ts
// ── 11. Periods ─────────────────────────────────────────────────────────────
{
  const period = (p: Parameters<typeof resolveAnalyticsPeriod>[0], now = NOW) => {
    const { firstDay, lastDay } = resolveAnalyticsPeriod(p, now)
    return [firstDay, lastDay]
  }
  assert.deepEqual(period({ period: 'this-month' }), ['2026-09-01', '2026-09-30'], 'this month runs to its calendar end')
  assert.deepEqual(resolveAnalyticsPeriod({ period: 'this-month' }, NOW).range, { from: '2026-09-01T07:00:00.000Z', to: '2026-10-01T07:00:00.000Z' }, 'the range is Pacific midnights, end exclusive')
  assert.deepEqual(period({ period: 'last-month' }), ['2026-08-01', '2026-08-31'], 'last month')
  assert.deepEqual(period({ period: 'this-quarter' }), ['2026-07-01', '2026-09-30'], 'this quarter')
  assert.deepEqual(period({ period: 'last-quarter' }), ['2026-04-01', '2026-06-30'], 'last quarter')
  assert.deepEqual(period({ period: 'ytd' }), ['2026-01-01', '2026-09-26'], 'year to date stops at today')
  assert.deepEqual(resolveAnalyticsPeriod({ period: 'ytd' }, NOW).range, { from: '2026-01-01T08:00:00.000Z', to: '2026-09-27T07:00:00.000Z' }, 'January is PST, September PDT')
  assert.deepEqual(period({ period: 'last-12' }), ['2025-10-01', '2026-09-30'], 'last 12 months include this one')
  assert.deepEqual(resolveAnalyticsPeriod({ period: 'custom', from: '2026-03-05', to: '2026-03-10' }, NOW).range, { from: '2026-03-05T08:00:00.000Z', to: '2026-03-11T07:00:00.000Z' }, 'a custom range across the spring-forward switch')
  const january = new Date('2026-01-15T20:00:00.000Z')
  assert.deepEqual(period({ period: 'last-month' }, january), ['2025-12-01', '2025-12-31'], 'last month rolls back the year')
  assert.deepEqual(period({ period: 'last-quarter' }, january), ['2025-10-01', '2025-12-31'], 'last quarter rolls back the year')
  const lateSept30 = new Date('2026-10-01T05:00:00.000Z')
  assert.deepEqual(period({ period: 'this-month' }, lateSept30), ['2026-09-01', '2026-09-30'], '10 pm Pacific on Sep 30 is still September')
  assert.throws(() => resolveAnalyticsPeriod({ period: 'custom' }, NOW), 'a custom period with no days is a caller bug')
  assert.deepEqual(monthsBetween('2025-11', '2026-02'), ['2025-11', '2025-12', '2026-01', '2026-02'], 'months between, inclusive')
  assert.equal(addMonths('2026-01', -1), '2025-12', 'month arithmetic rolls the year')
  assert.equal(lastDayOfMonth('2028-02'), '2028-02-29', 'leap February')
}
console.log('11. Periods ✓')

// ── 12. Merged duplicates ───────────────────────────────────────────────────
{
  const merged = buildLeadRecords({
    customers: [
      customer('d1', '2026-07-02T17:00:00.000Z', { phone: '5550001111' }),
      customer('d1-dup', '2026-07-09T17:00:00.000Z', { phone: '5550001111' }),
      customer('d1-dup2', '2026-08-09T17:00:00.000Z', { email: 'd1@x.com', phone: '5550001111' }),
      customer('d2', '2026-07-03T17:00:00.000Z'),
    ],
    meetings: [meeting('d1m', 'd1-dup', '2026-07-12T17:00:00.000Z', 'pns', { closerIds: ['u1'] })],
    sales: [],
  }, NOW)
  const julyTotal = aggregateLeadRecords(merged, { range: businessMonthWindow('2026-07') }, 'total').rows[0]
  assert.equal(julyTotal.totalLeads, 2, 'three records of one person are one lead')
  assert.equal(julyTotal.mergedRecords, 2, 'its two extra records count as merged duplicates, in the lead\'s month')
  assert.equal(aggregateLeadRecords(merged, { range: businessMonthWindow('2026-08') }, 'total').rows[0].mergedRecords, 0, 'a later duplicate never re-credits another month')
  assert.equal(aggregateLeadRecords(merged, { range: businessMonthWindow('2026-07') }, 'closer').rows[0].mergedRecords, null, 'merged duplicates follow lead applicability')
}
console.log('12. Merged duplicates ✓')
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm tsx scripts/verify-analytics-rules.ts`
Expected: FAIL — cannot resolve `@/features/analytics/lib/analytics-periods`.

- [ ] **Step 3: Add the dimension tuples and derive the unions**

Create `src/features/analytics/constants/dimensions.ts`:

```ts
export const MEETING_ORDERS = ['first', 'repeat', 'not_sat', 'project'] as const
export type MeetingOrder = (typeof MEETING_ORDERS)[number]

export const ANALYTICS_GROUP_BYS = ['total', 'leadSource', 'month', 'closer', 'outcome', 'meetingOrder', 'city', 'zip'] as const
export type AnalyticsGroupBy = (typeof ANALYTICS_GROUP_BYS)[number]

export const ANALYTICS_PERIODS = ['this-month', 'last-month', 'this-quarter', 'last-quarter', 'ytd', 'last-12', 'custom'] as const
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number]
```

(Each type sits under its tuple: `docs/codebase-conventions/enum-standardization.md#type-derived-from-const`; exemplar `src/features/calculators/constants/query-parsers.ts:3-5`.)

In `src/features/analytics/types/index.ts`:
- delete `export type MeetingOrder = 'first' | 'repeat' | 'not_sat' | 'project'` and `export type AnalyticsGroupBy = 'total' | 'leadSource' | 'month' | 'closer' | 'outcome' | 'meetingOrder' | 'city' | 'zip'`;
- add to the top imports `import type { AnalyticsGroupBy, MeetingOrder } from '@/features/analytics/constants/dimensions'` (the file still uses both);
- add directly under the imports `export type { AnalyticsGroupBy, AnalyticsPeriod, MeetingOrder } from '@/features/analytics/constants/dimensions'`, so every existing `@/features/analytics/types` importer keeps working;
- add `mergedRecords: number | null` to `AnalyticsCounts`, directly after `totalLeads: number | null`.

- [ ] **Step 4: Write the period rules**

Create `src/features/analytics/lib/analytics-periods.ts`:

```ts
import type { AnalyticsPeriod } from '@/features/analytics/types'

import { addCalendarDays, BUSINESS_TIMEZONE, businessDayKey, startOfDayInTimeZone } from '@/shared/lib/business-time'

export interface ResolvedPeriod {
  /** First and last business day, both inclusive. */
  firstDay: string
  lastDay: string
  /** The same days as instants, `to` exclusive — the aggregator's range. */
  range: { from: string, to: string }
}

export function addMonths(monthKey: string, months: number): string {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 7)
}

export function lastDayOfMonth(monthKey: string): string {
  return addCalendarDays(`${addMonths(monthKey, 1)}-01`, -1)
}

/** Every month from `first` to `last`, both inclusive. */
export function monthsBetween(first: string, last: string): string[] {
  const months: string[] = []
  for (let month = first; month <= last; month = addMonths(month, 1)) {
    months.push(month)
  }
  return months
}

function quarterStart(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return `${year}-${String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, '0')}`
}

function periodDays(input: { period: AnalyticsPeriod, from?: string, to?: string }, today: string): [string, string] {
  const thisMonth = today.slice(0, 7)
  switch (input.period) {
    case 'this-month':
      return [`${thisMonth}-01`, lastDayOfMonth(thisMonth)]
    case 'last-month': {
      const month = addMonths(thisMonth, -1)
      return [`${month}-01`, lastDayOfMonth(month)]
    }
    case 'this-quarter': {
      const start = quarterStart(thisMonth)
      return [`${start}-01`, lastDayOfMonth(addMonths(start, 2))]
    }
    case 'last-quarter': {
      const start = addMonths(quarterStart(thisMonth), -3)
      return [`${start}-01`, lastDayOfMonth(addMonths(start, 2))]
    }
    case 'ytd':
      return [`${today.slice(0, 4)}-01-01`, today]
    case 'last-12':
      return [`${addMonths(thisMonth, -11)}-01`, lastDayOfMonth(thisMonth)]
    case 'custom':
      if (!input.from || !input.to) {
        throw new Error('A custom period needs a first and a last day.')
      }
      return [input.from, input.to]
  }
}

/**
 * Periods are whole Pacific business days. A "this" period runs to its
 * calendar end and its data simply stops at today; year to date stops at today.
 */
export function resolveAnalyticsPeriod(input: { period: AnalyticsPeriod, from?: string, to?: string }, now: Date): ResolvedPeriod {
  const [firstDay, lastDay] = periodDays(input, businessDayKey(now))
  return {
    firstDay,
    lastDay,
    range: {
      from: startOfDayInTimeZone(firstDay, BUSINESS_TIMEZONE).toISOString(),
      to: startOfDayInTimeZone(addCalendarDays(lastDay, 1), BUSINESS_TIMEZONE).toISOString(),
    },
  }
}
```

- [ ] **Step 5: Add the merged-duplicates rule and tally**

In `src/features/analytics/lib/analytics-rules.ts`, add after `pickLeadAnchor`:

```ts
/** Every extra record a person has is a duplicate folded into one lead; the count shows how much record cleanup is due. */
export function mergedRecordCount(person: { customerIds: readonly string[] }): number {
  return person.customerIds.length - 1
}
```

In `src/features/analytics/lib/aggregate-lead-records.ts`:
- import `mergedRecordCount` alongside the other `analytics-rules` imports;
- add `mergedRecords: number` to `interface Tally` (after `leads`) and `mergedRecords: 0` to `emptyTally()` (after `leads: 0`);
- in the leads loop, directly after `tally.leads++`, add `tally.mergedRecords += mergedRecordCount(person)`;
- in the row object, directly after `totalLeads: leads,`, add `mergedRecords: leadsApplicable ? t.mergedRecords : null,`.

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm tsx scripts/verify-analytics-rules.ts`
Expected: sections 1–12 print ✓, then `✅ verify-analytics-rules passed`.

- [ ] **Step 7: Gates and commit**

Run: `pnpm exec eslint --fix src/features/analytics scripts/verify-analytics-rules.ts && pnpm tsc && pnpm lint`
Expected: clean.

```bash
git add src/features/analytics/constants/dimensions.ts src/features/analytics/types/index.ts src/features/analytics/lib/analytics-periods.ts src/features/analytics/lib/analytics-rules.ts src/features/analytics/lib/aggregate-lead-records.ts scripts/verify-analytics-rules.ts
git commit -m "$(cat <<'EOF'
feat(analytics): Pacific report periods and a merged-duplicates count

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Spend and cost rules

**Files:**
- Modify: `src/features/analytics/lib/analytics-rules.ts`
- Test: `scripts/verify-analytics-rules.ts` (section 13)

**Interfaces:**
- Consumes: `lastDayOfMonth` (Task 2); `LeadSourceSpendEntry`, `LeadSourceSpendMode` (Task 1, type-only); `computeRate`, `inapplicableStages`, `AnalyticsStage` (existing); `businessDayKey`.
- Produces (all exported from `analytics-rules.ts`):
  - `interface SpendSource { id: string, spendMode: LeadSourceSpendMode }`
  - `interface DayRange { first: string, last: string }` (business days, inclusive)
  - `interface MissingSpend { leadSourceId: string, month: string }`
  - `spendInRange(sources: readonly SpendSource[], entries: readonly LeadSourceSpendEntry[], days: DayRange, today: string): number` (cents, rounded)
  - `findMissingSpend(sources: readonly SpendSource[], entries: readonly LeadSourceSpendEntry[], leads: readonly { leadSourceId: string | null, leadAt: string }[], days: DayRange): MissingSpend[]` (sorted by month, then source id)
  - `ANALYTICS_COSTS`, `type AnalyticsCostKey = 'costPerLead' | 'costPerBookedLead' | 'costPerSit' | 'costPerNewSale'`
  - `totalRevenueCents(counts: { revenueNewCents: number | null, revenueUpsellCents: number | null }): number | null`
  - `computeCosts(spendCents: number, counts: { totalLeads: number | null, bookedLeads: number, sits: number, newSales: number | null }, revenueCents: number | null): { costs: Record<AnalyticsCostKey, number | null>, returnOnSpend: number | null }`
  - `type NotApplicableReasons = Partial<Record<AnalyticsStage | 'cost', string>>`
  - `notApplicableReasons(filters: AnalyticsFilters, groupBy: AnalyticsGroupBy): NotApplicableReasons`
  - `sourceRowCostReason(leadSourceId: string | null): string | undefined` (the per-row rule for a source breakdown)

- [ ] **Step 1: Write the failing checks**

In `scripts/verify-analytics-rules.ts`, add to the imports:

```ts
import type { SpendSource } from '@/features/analytics/lib/analytics-rules'
import type { LeadSourceSpendEntry } from '@/shared/entities/lead-sources/dal/server/spend'

import { computeCosts, findMissingSpend, notApplicableReasons, sourceRowCostReason, spendInRange, totalRevenueCents } from '@/features/analytics/lib/analytics-rules'
```

and add after section 12:

```ts
// ── 13. Spend and cost ──────────────────────────────────────────────────────
{
  const srcA: SpendSource = { id: 'src-a', spendMode: 'manual' }
  const srcB: SpendSource = { id: 'src-b', spendMode: 'manual' }
  const srcF: SpendSource = { id: 'src-f', spendMode: 'none' }
  const entries: LeadSourceSpendEntry[] = [
    { leadSourceId: 'src-a', month: '2026-08', amountCents: 300_000 },
    { leadSourceId: 'src-a', month: '2026-09', amountCents: 300_000 },
    { leadSourceId: 'src-f', month: '2026-09', amountCents: 50_000 },
  ]
  const today = '2026-09-26'
  assert.equal(spendInRange([srcA], entries, { first: '2026-08-01', last: '2026-08-31' }, today), 300_000, 'a whole past month counts in full')
  assert.equal(spendInRange([srcA], entries, { first: '2026-09-01', last: '2026-09-30' }, today), 260_000, 'the current month counts only the 26 days lived so far')
  assert.equal(spendInRange([srcA], entries, { first: '2026-08-17', last: '2026-09-10' }, today), 245_161, 'a range splitting two months takes each month\'s share by days (15/31 + 10/30)')
  assert.equal(spendInRange([srcF], entries, { first: '2026-09-01', last: '2026-09-30' }, today), 0, 'a free source costs nothing, whatever was typed')
  assert.equal(spendInRange([srcB], entries, { first: '2026-09-01', last: '2026-09-30' }, today), 0, 'only the given sources count')
  assert.equal(spendInRange([srcA], entries, { first: '2026-10-01', last: '2026-10-31' }, today), 0, 'days not lived yet carry no spend')

  const leads = [
    { leadSourceId: 'src-a', leadAt: '2026-09-05T17:00:00.000Z' },
    { leadSourceId: 'src-b', leadAt: '2026-09-06T17:00:00.000Z' },
    { leadSourceId: 'src-b', leadAt: '2026-09-07T17:00:00.000Z' },
    { leadSourceId: 'src-f', leadAt: '2026-09-08T17:00:00.000Z' },
    { leadSourceId: null, leadAt: '2026-09-09T17:00:00.000Z' },
    { leadSourceId: 'src-a', leadAt: '2026-07-10T17:00:00.000Z' },
    { leadSourceId: 'src-b', leadAt: '2026-08-01T06:30:00.000Z' },
  ]
  assert.deepEqual(
    findMissingSpend([srcA, srcB, srcF], entries, leads, { first: '2026-07-01', last: '2026-09-30' }),
    [{ leadSourceId: 'src-a', month: '2026-07' }, { leadSourceId: 'src-b', month: '2026-07' }, { leadSourceId: 'src-b', month: '2026-09' }],
    'a manual source with a lead and no spend row is missing for that month (23:30 PDT on Jul 31 is July); free and unknown sources never are',
  )
  assert.deepEqual(findMissingSpend([srcA, srcB, srcF], entries, leads, { first: '2026-09-01', last: '2026-09-30' }), [{ leadSourceId: 'src-b', month: '2026-09' }], 'only months inside the days count')
  assert.deepEqual(findMissingSpend([srcA], entries, leads, { first: '2026-08-01', last: '2026-08-31' }), [], 'a source with no lead that month is not missing')

  assert.deepEqual(
    computeCosts(100_000, { totalLeads: 4, bookedLeads: 2, sits: 0, newSales: null }, 500_000),
    { costs: { costPerLead: 25_000, costPerBookedLead: 50_000, costPerSit: null, costPerNewSale: null }, returnOnSpend: 5 },
    'cost per stage is spend ÷ count; zero or unknown counts give no cost',
  )
  assert.equal(computeCosts(0, { totalLeads: 4, bookedLeads: 2, sits: 1, newSales: 1 }, 500_000).returnOnSpend, null, 'revenue over no spend is unknown, not infinite')
  assert.equal(computeCosts(0, { totalLeads: 4, bookedLeads: 2, sits: 1, newSales: 1 }, 500_000).costs.costPerLead, 0, 'a free lead costs $0')
  assert.equal(totalRevenueCents({ revenueNewCents: 1_000_000, revenueUpsellCents: 200_000 }), 1_200_000, 'revenue counts upsells')
  assert.equal(totalRevenueCents({ revenueNewCents: null, revenueUpsellCents: null }), null, 'no sales stage, no revenue')

  const keys = (r: object) => Object.keys(r).sort()
  assert.deepEqual(keys(notApplicableReasons({}, 'leadSource')), [], 'a source view has cost')
  assert.deepEqual(keys(notApplicableReasons({ leadSourceIds: ['src-a'] }, 'month')), [], 'a source filter keeps cost')
  assert.deepEqual(keys(notApplicableReasons({ cities: ['Irvine'] }, 'total')), ['cost'], 'a city filter: spend is not per city')
  assert.deepEqual(keys(notApplicableReasons({}, 'closer')), ['cost', 'leads'], 'grouping by closer: no leads, no cost')
  assert.deepEqual(keys(notApplicableReasons({ outcomes: ['pns'] }, 'total')), ['cost', 'leads', 'sales'], 'an outcome filter: no leads, sales or cost')
  assert.deepEqual(keys(notApplicableReasons({ leadSourceIds: [null] }, 'total')), ['cost'], 'unknown-source leads have no spend: cost is n/a, never $0')
  assert.deepEqual(keys(notApplicableReasons({ leadSourceIds: ['src-a', null] }, 'leadSource')), ['cost'], 'mixing in unknown-source leads would dilute cost per lead')
  assert.equal(sourceRowCostReason(null), notApplicableReasons({ leadSourceIds: [null] }, 'total').cost, 'the unknown-source row says the same thing as the filter')
  assert.equal(sourceRowCostReason('src-a'), undefined, 'a real source row has cost')
}
console.log('13. Spend and cost ✓')
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm tsx scripts/verify-analytics-rules.ts`
Expected: FAIL — `spendInRange` is not exported.

- [ ] **Step 3: Write the rules**

In `src/features/analytics/lib/analytics-rules.ts`, add to the imports:

```ts
import type { AnalyticsCounts } from '@/features/analytics/types'
import type { LeadSourceSpendMode } from '@/shared/constants/enums/lead-sources'
import type { LeadSourceSpendEntry } from '@/shared/entities/lead-sources/dal/server/spend'

import { lastDayOfMonth } from '@/features/analytics/lib/analytics-periods'
import { businessDayKey } from '@/shared/lib/business-time'
```

(merge `AnalyticsCounts` into the existing `@/features/analytics/types` type import). Then append at the end of the file:

```ts
export interface SpendSource {
  id: string
  spendMode: LeadSourceSpendMode
}

/** Business days, both inclusive. */
export interface DayRange {
  first: string
  last: string
}

export interface MissingSpend {
  leadSourceId: string
  month: string
}

function dayCount(first: string, last: string): number {
  return Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000) + 1
}

function manualSourceIds(sources: readonly SpendSource[]): Set<string> {
  return new Set(sources.filter(s => s.spendMode === 'manual').map(s => s.id))
}

/**
 * Spend accrues evenly across its month, so a period covering part of a month
 * carries that share by days, and days after today carry none yet. Free
 * sources cost nothing. Only the given sources count: the caller scopes by source.
 */
export function spendInRange(sources: readonly SpendSource[], entries: readonly LeadSourceSpendEntry[], days: DayRange, today: string): number {
  const manual = manualSourceIds(sources)
  const last = days.last < today ? days.last : today
  let total = 0
  for (const entry of entries) {
    if (!manual.has(entry.leadSourceId)) {
      continue
    }
    const monthFirst = `${entry.month}-01`
    const monthLast = lastDayOfMonth(entry.month)
    const first = days.first > monthFirst ? days.first : monthFirst
    const end = last < monthLast ? last : monthLast
    if (first > end) {
      continue
    }
    total += entry.amountCents * dayCount(first, end) / dayCount(monthFirst, monthLast)
  }
  return Math.round(total)
}

/**
 * A manual source that brought a lead in a month with no spend entered for
 * that month makes every cost over it unknown: a blank is "not entered", never $0.
 */
export function findMissingSpend(
  sources: readonly SpendSource[],
  entries: readonly LeadSourceSpendEntry[],
  leads: readonly { leadSourceId: string | null, leadAt: string }[],
  days: DayRange,
): MissingSpend[] {
  const manual = manualSourceIds(sources)
  const entered = new Set(entries.map(e => `${e.leadSourceId}|${e.month}`))
  const missing = new Map<string, MissingSpend>()
  for (const lead of leads) {
    if (lead.leadSourceId === null || !manual.has(lead.leadSourceId)) {
      continue
    }
    const day = businessDayKey(new Date(lead.leadAt))
    if (day < days.first || day > days.last) {
      continue
    }
    const key = `${lead.leadSourceId}|${day.slice(0, 7)}`
    if (!entered.has(key)) {
      missing.set(key, { leadSourceId: lead.leadSourceId, month: day.slice(0, 7) })
    }
  }
  return [...missing.values()].sort((a, b) => a.month.localeCompare(b.month) || a.leadSourceId.localeCompare(b.leadSourceId))
}

/** Cost per stage divides spend by that stage's count, so each stage shows what one more of it costs. */
export const ANALYTICS_COSTS = {
  costPerLead: 'totalLeads',
  costPerBookedLead: 'bookedLeads',
  costPerSit: 'sits',
  costPerNewSale: 'newSales',
} as const

export type AnalyticsCostKey = keyof typeof ANALYTICS_COSTS

/** Revenue counts upsells as well as new sales; when the sales stage is not applicable it stays unknown. */
export function totalRevenueCents(counts: Pick<AnalyticsCounts, 'revenueNewCents' | 'revenueUpsellCents'>): number | null {
  if (counts.revenueNewCents === null || counts.revenueUpsellCents === null) {
    return null
  }
  return counts.revenueNewCents + counts.revenueUpsellCents
}

/**
 * A cost over zero of anything is unknown, not free or infinite; revenue ÷ spend says what each dollar brought back.
 * Each key is written out so adding one to `ANALYTICS_COSTS` fails here until it is computed.
 */
export function computeCosts(
  spendCents: number,
  counts: Pick<AnalyticsCounts, (typeof ANALYTICS_COSTS)[AnalyticsCostKey]>,
  revenueCents: number | null,
): { costs: Record<AnalyticsCostKey, number | null>, returnOnSpend: number | null } {
  return {
    costs: {
      costPerLead: computeRate(spendCents, counts[ANALYTICS_COSTS.costPerLead]),
      costPerBookedLead: computeRate(spendCents, counts[ANALYTICS_COSTS.costPerBookedLead]),
      costPerSit: computeRate(spendCents, counts[ANALYTICS_COSTS.costPerSit]),
      costPerNewSale: computeRate(spendCents, counts[ANALYTICS_COSTS.costPerNewSale]),
    },
    returnOnSpend: computeRate(revenueCents, spendCents),
  }
}

export type NotApplicableReasons = Partial<Record<AnalyticsStage | 'cost', string>>

const COST_GROUPINGS: readonly AnalyticsGroupBy[] = ['total', 'leadSource', 'month']

const UNKNOWN_SOURCE_COST_REASON = 'A lead with no source has no spend, so its cost is unknown.'

/** A source breakdown's unknown-source row has leads but no spend to divide. */
export function sourceRowCostReason(leadSourceId: string | null): string | undefined {
  return leadSourceId === null ? UNKNOWN_SOURCE_COST_REASON : undefined
}

/**
 * Spend is entered per source and month, so cost exists only for a total,
 * source or month view narrowed by nothing but source; anything else would
 * divide one slice's count by the whole spend. Unknown-source leads carry no
 * spend, so including them would show $0 or dilute cost per lead.
 */
export function notApplicableReasons(filters: AnalyticsFilters, groupBy: AnalyticsGroupBy): NotApplicableReasons {
  const reasons: NotApplicableReasons = {}
  const stages = inapplicableStages(filters, groupBy)
  if (stages.includes('leads')) {
    reasons.leads = 'A lead has no closer, outcome or meeting order until a meeting is booked.'
  }
  if (stages.includes('sales')) {
    reasons.sales = 'A sale is not tied to one meeting outcome or meeting order.'
  }
  const narrowed = !!(filters.cities?.length || filters.zips?.length || filters.closerIds?.length || filters.outcomes?.length || filters.meetingOrder?.length)
  if (narrowed || !COST_GROUPINGS.includes(groupBy)) {
    reasons.cost = 'Spend is entered per source and month, so cost shows only for totals, sources or months filtered by source alone.'
  }
  else if (filters.leadSourceIds?.includes(null)) {
    reasons.cost = UNKNOWN_SOURCE_COST_REASON
  }
  return reasons
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm tsx scripts/verify-analytics-rules.ts`
Expected: sections 1–13 ✓, then `✅ verify-analytics-rules passed`. If the split-month figure is off by one cent, check that `dayCount` counts both ends (Aug 17–31 is 15 days) — do not change the expected value.

- [ ] **Step 5: Gates and commit**

Run: `pnpm exec eslint --fix src/features/analytics/lib/analytics-rules.ts scripts/verify-analytics-rules.ts && pnpm tsc && pnpm lint`

```bash
git add src/features/analytics/lib/analytics-rules.ts scripts/verify-analytics-rules.ts
git commit -m "$(cat <<'EOF'
feat(analytics): spend proration, missing-spend, cost per stage and cost applicability rules

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: The report builder

**Files:**
- Create: `src/features/analytics/schemas/report-input-schema.ts`
- Modify: `src/features/analytics/types/index.ts`
- Create: `src/features/analytics/lib/build-analytics-report.ts`
- Create: `src/features/analytics/lib/list-lead-places.ts`
- Test: `scripts/verify-analytics-rules.ts` (section 14)

**Interfaces:**
- Consumes: Tasks 2–3; `buildLeadRecords`, `aggregateLeadRecords`; `businessMonthWindow`, `businessDayKey`.
- Produces:
  - `businessDaySchema`, `analyticsFiltersSchema`, `analyticsReportInputSchema`, `type AnalyticsReportInput = { period: AnalyticsPeriod, from?: string, to?: string, filters: AnalyticsFilters, groupBy: AnalyticsGroupBy }` (from `schemas/report-input-schema.ts`)
  - Types in `types/index.ts`: `RowCost`, `AnalyticsReportRow`, `AnalyticsTrendMonth`, `AnalyticsHygiene`, `AnalyticsReport` (exact shapes in Step 3; the report carries `generatedAt` and `spendGridMonths`)
  - `interface AnalyticsReportData { facts: AnalyticsFacts, sources: SpendSource[], spend: LeadSourceSpendEntry[] }`
  - `analyticsReportWindow(input: Pick<AnalyticsReportInput, 'period' | 'from' | 'to'>, now: Date): { period: ResolvedPeriod, trendMonths: string[], spendMonths: string[] }`
  - `buildAnalyticsReport(data: AnalyticsReportData, input: AnalyticsReportInput, now: Date): AnalyticsReport`
  - `listLeadPlaces(records: LeadRecordSet): { cities: string[], zips: string[] }`

- [ ] **Step 1: Write the failing checks**

In `scripts/verify-analytics-rules.ts`, add to the imports:

```ts
import { analyticsReportWindow, buildAnalyticsReport } from '@/features/analytics/lib/build-analytics-report'
import { listLeadPlaces } from '@/features/analytics/lib/list-lead-places'
import { analyticsReportInputSchema } from '@/features/analytics/schemas/report-input-schema'
```

and add after section 13:

```ts
// ── 14. Report ──────────────────────────────────────────────────────────────
{
  const facts = {
    customers: [
      customer('r1', '2026-08-10T17:00:00.000Z', { leadSourceId: 'src-a', phone: '5550002001' }),
      customer('r2', '2026-09-05T17:00:00.000Z', { leadSourceId: 'src-b', phone: '5550002002' }),
      customer('r3', '2026-09-06T17:00:00.000Z', { leadSourceId: 'src-a', phone: '5550002003', city: 'Unknown' }),
      customer('r3-dup', '2026-09-07T17:00:00.000Z', { leadSourceId: 'src-a', phone: '5550002003', city: 'Tustin', zip: '92780' }),
    ],
    meetings: [
      meeting('r1m', 'r1', '2026-08-12T17:00:00.000Z', 'pns', { closerIds: ['u1'] }),
      meeting('r2m', 'r2', '2026-09-08T17:00:00.000Z', 'converted_to_project', { closerIds: ['u2'], projectId: 'p1' }),
      meeting('r3m', 'r3', '2026-09-10T17:00:00.000Z', 'not_set'),
    ],
    sales: [
      sale('r2s', 'r2m', '2026-09-09T17:00:00.000Z', { finalTcpCents: 800_000 }),
      sale('r1s', 'r1m', null),
    ],
  }
  const data = {
    facts,
    sources: [{ id: 'src-a', spendMode: 'manual' as const }, { id: 'src-b', spendMode: 'manual' as const }, { id: 'src-f', spendMode: 'none' as const }],
    spend: [
      { leadSourceId: 'src-a', month: '2026-08', amountCents: 310_000 },
      { leadSourceId: 'src-a', month: '2026-09', amountCents: 300_000 },
    ],
  }

  const report = buildAnalyticsReport(data, { period: 'this-month', filters: {}, groupBy: 'leadSource' }, NOW)
  assert.deepEqual([report.firstDay, report.lastDay], ['2026-09-01', '2026-09-30'], 'the report names its days')
  assert.equal(report.generatedAt, NOW.toISOString(), 'the report carries the instant it was built, for time-dependent links')
  assert.equal(report.headline.totalLeads, 2, 'r2 and r3 (r3-dup merged) lead in September')
  assert.equal(report.headline.mergedRecords, 1, 'r3-dup is a merged duplicate')
  assert.equal(report.headline.revenueCents, 800_000, 'revenue on the headline')
  assert.deepEqual(report.headline.cost, { status: 'missing', missing: [{ leadSourceId: 'src-b', month: '2026-09' }] }, 'src-b brought a lead in September with no spend: the total cost is missing')
  const srcARow = report.breakdown.find(r => r.groupKey === 'src-a')!
  assert.equal(srcARow.cost.status, 'ok', 'src-a has its spend')
  assert.equal(srcARow.cost.status === 'ok' && srcARow.cost.spendCents, 260_000, 'src-a September spend to date (26/30)')
  assert.equal(srcARow.cost.status === 'ok' && srcARow.cost.costs.costPerLead, 260_000, 'one src-a lead so far')
  assert.equal(report.breakdown.find(r => r.groupKey === 'src-b')!.cost.status, 'missing', 'src-b row is missing')
  assert.equal(report.trend.length, 12, 'twelve trend months')
  assert.deepEqual([report.trend[0].month, report.trend[11].month], ['2025-10', '2026-09'], 'the trend ends with the period\'s last month')
  assert.deepEqual(report.trend.filter(t => t.selected).map(t => t.month), ['2026-09'], 'only the period\'s months are selected')
  const august = report.trend.find(t => t.month === '2026-08')!.row
  assert.equal(august.totalLeads, 1, 'r1 led in August')
  assert.equal(august.cost.status === 'ok' && august.cost.spendCents, 310_000, 'a past month counts in full; src-b had no August lead so nothing is missing')
  assert.deepEqual(report.spendMissing, [{ leadSourceId: 'src-b', month: '2026-09' }], 'the Spend tab\'s warning lists every missing source-month in the period and the trend window')
  assert.deepEqual(report.spendGridMonths, report.trend.map(t => t.month), 'nothing is owed outside the trend, so the grid shows the trend\'s twelve months')
  assert.deepEqual(report.hygiene, { meetingsWithoutOutcome: 1, undatedSales: 1, newSalesWithoutProject: 1, unknownCityZip: 1 }, 'hygiene counts all records: r3m unresolved, r1s undated and without a project, r3 has no city')

  const srcAYear = buildAnalyticsReport(data, { period: 'last-12', filters: { leadSourceIds: ['src-a'] }, groupBy: 'month' }, NOW)
  assert.equal(srcAYear.headline.cost.status === 'ok' && srcAYear.headline.cost.spendCents, 570_000, 'a source filter scopes spend: August in full plus September to date')
  assert.equal(srcAYear.headline.cost.status === 'ok' && srcAYear.headline.cost.costs.costPerLead, 285_000, 'two src-a leads over the year')
  assert.equal(srcAYear.breakdown.find(r => r.groupKey === '2026-09')!.cost.status === 'ok', true, 'a month row carries that month\'s cost')

  const byCloser = buildAnalyticsReport(data, { period: 'this-month', filters: {}, groupBy: 'closer' }, NOW)
  assert.ok(byCloser.breakdown.every(r => r.cost.status === 'not_applicable'), 'grouping by closer: every row\'s cost is not applicable')
  assert.equal(byCloser.headline.cost.status, 'missing', 'but the headline total still has cost')
  assert.ok(byCloser.notApplicable.breakdown.leads && !byCloser.notApplicable.headline.leads, 'leads are n/a in the closer breakdown, not in the headline')
  assert.equal(buildAnalyticsReport(data, { period: 'this-month', filters: { cities: ['Tustin'] }, groupBy: 'leadSource' }, NOW).headline.cost.status, 'not_applicable', 'a city filter: no cost')
  assert.equal(buildAnalyticsReport(data, { period: 'this-month', filters: { leadSourceIds: [null] }, groupBy: 'leadSource' }, NOW).headline.cost.status, 'not_applicable', 'the unknown source: no cost, never $0')

  const longAgo = buildAnalyticsReport({ ...data, facts: { ...facts, customers: [...facts.customers, customer('old', '2024-02-10T18:00:00.000Z', { leadSourceId: 'src-b', phone: '5550002099' })] } }, { period: 'custom', from: '2024-01-01', to: '2026-09-30', filters: {}, groupBy: 'leadSource' }, NOW)
  assert.ok(longAgo.spendMissing.some(m => m.month === '2024-02'), 'a missing month the long period touches is listed, though it is older than the trend')
  assert.ok(longAgo.spendGridMonths.includes('2024-02') && longAgo.spendGridMonths.length === 13, 'the grid adds that month to the trend\'s twelve, so the warning can be cleared')
  assert.equal(buildAnalyticsReport(data, { period: 'last-12', filters: {}, groupBy: 'leadSource' }, NOW).breakdown.every(r => r.groupKey !== null), true, 'every fixture lead has a source')

  const future = buildAnalyticsReport(data, { period: 'custom', from: '2026-09-01', to: '2026-11-30', filters: { leadSourceIds: ['src-a'] }, groupBy: 'month' }, NOW)
  const november = future.trend.find(t => t.month === '2026-11')!
  assert.equal(november.selected, true, 'a future month inside the period is selected')
  assert.equal(november.row.totalLeads, 0, 'no leads yet')
  assert.deepEqual(november.row.cost.status === 'ok' && [november.row.cost.spendCents, november.row.cost.costs.costPerLead], [0, null], 'a future month: $0 so far and no cost per lead, never missing')

  const empty = buildAnalyticsReport({ facts: { customers: [], meetings: [], sales: [] }, sources: [], spend: [] }, { period: 'this-month', filters: {}, groupBy: 'leadSource' }, NOW)
  assert.equal(empty.headline.totalLeads, 0, 'no data: zero leads')
  assert.deepEqual(empty.headline.cost.status === 'ok' && [empty.headline.cost.spendCents, empty.headline.cost.costs.costPerLead], [0, null], 'no data: $0 spend and no cost')
  assert.deepEqual(empty.breakdown, [], 'no data: no breakdown rows')

  assert.equal(analyticsReportWindow({ period: 'custom', from: '2024-01-01', to: '2024-03-31' }, NOW).spendMonths.length, 12, 'the trend already covers a short custom period')
  assert.equal(analyticsReportWindow({ period: 'custom', from: '2023-01-01', to: '2024-03-31' }, NOW).spendMonths.length, 15, 'a long custom period reads spend for every month it touches')

  assert.deepEqual(listLeadPlaces(buildLeadRecords(facts, NOW)), { cities: ['Irvine'], zips: ['92618'] }, 'filter choices come from lead anchors; the unknown city is not a choice')

  assert.equal(analyticsReportInputSchema.safeParse({ period: 'custom', filters: {}, groupBy: 'total' }).success, false, 'a custom period needs its days')
  assert.equal(analyticsReportInputSchema.safeParse({ period: 'custom', from: '2026-09-10', to: '2026-09-01', filters: {}, groupBy: 'total' }).success, false, 'days in order')
  assert.equal(analyticsReportInputSchema.safeParse({ period: 'custom', from: '2026-02-30', to: '2026-03-01', filters: {}, groupBy: 'total' }).success, false, 'a day that does not exist')
  assert.equal(analyticsReportInputSchema.safeParse({ period: 'ytd', filters: { leadSourceIds: [null] }, groupBy: 'city' }).success, true, 'null picks the unknown source')
}
console.log('14. Report ✓')
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm tsx scripts/verify-analytics-rules.ts`
Expected: FAIL — cannot resolve `@/features/analytics/lib/build-analytics-report`.

- [ ] **Step 3: Add the report types**

In `src/features/analytics/types/index.ts`, extend the `analytics-rules` type import to `import type { AnalyticsCostKey, AnalyticsRateKey, AnalyticsStage, MissingSpend, NotApplicableReasons } from '@/features/analytics/lib/analytics-rules'` and append:

```ts
export type RowCost
  = | { status: 'ok', spendCents: number, costs: Record<AnalyticsCostKey, number | null>, returnOnSpend: number | null }
    | { status: 'missing', missing: MissingSpend[] }
    | { status: 'not_applicable', reason: string }

export interface AnalyticsReportRow extends AnalyticsCounts {
  revenueCents: number | null
  cost: RowCost
}

export interface AnalyticsTrendMonth {
  month: string
  selected: boolean
  row: AnalyticsReportRow
}

export interface AnalyticsHygiene {
  meetingsWithoutOutcome: number
  undatedSales: number
  newSalesWithoutProject: number
  unknownCityZip: number
}

export interface AnalyticsReport {
  /** The instant the report was built; anything time-dependent on the page derives from it, so server and browser render the same markup. */
  generatedAt: string
  firstDay: string
  lastDay: string
  headline: AnalyticsReportRow
  breakdown: AnalyticsReportRow[]
  trend: AnalyticsTrendMonth[]
  notApplicable: { headline: NotApplicableReasons, breakdown: NotApplicableReasons }
  spendMissing: MissingSpend[]
  /** The Spend grid's columns: the trend's months plus any older month still owed spend. */
  spendGridMonths: string[]
  undatedSales: number | null
  orphans: number
  hygiene: AnalyticsHygiene
}
```

(`AnalyticsStage` may become unused in `types/index.ts`; drop it from the import if lint says so.)

- [ ] **Step 4: Write the input schema**

Create `src/features/analytics/schemas/report-input-schema.ts`:

```ts
import type { AnalyticsFilters } from '@/features/analytics/types'

import z from 'zod'

import { ANALYTICS_GROUP_BYS, ANALYTICS_PERIODS, MEETING_ORDERS } from '@/features/analytics/constants/dimensions'
import { meetingOutcomes } from '@/shared/constants/enums/meetings'

// A day that round-trips through Date exists; '2026-02-30' rolls over and '2026-13-45' is an invalid Date.
export const businessDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((day) => {
  const date = new Date(`${day}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(day)
}, 'Not a calendar day.')

// Ties the wire shape to the aggregator's filters: a field added to one and not the other fails tsc.
export const analyticsFiltersSchema = z.object({
  leadSourceIds: z.array(z.string().uuid().nullable()).optional(),
  cities: z.array(z.string().nullable()).optional(),
  zips: z.array(z.string().nullable()).optional(),
  closerIds: z.array(z.string()).optional(),
  outcomes: z.array(z.enum(meetingOutcomes)).optional(),
  meetingOrder: z.array(z.enum(MEETING_ORDERS)).optional(),
}) satisfies z.ZodType<Omit<AnalyticsFilters, 'range'>>

export const analyticsReportInputSchema = z.object({
  period: z.enum(ANALYTICS_PERIODS),
  from: businessDaySchema.optional(),
  to: businessDaySchema.optional(),
  filters: analyticsFiltersSchema,
  groupBy: z.enum(ANALYTICS_GROUP_BYS),
}).refine(
  input => input.period !== 'custom' || (!!input.from && !!input.to && input.from <= input.to),
  'A custom period needs a first and a last day, in order.',
)

export type AnalyticsReportInput = z.infer<typeof analyticsReportInputSchema>
```

- [ ] **Step 5: Write the builder**

Create `src/features/analytics/lib/build-analytics-report.ts`:

```ts
import type { ResolvedPeriod } from '@/features/analytics/lib/analytics-periods'
import type { DayRange, SpendSource } from '@/features/analytics/lib/analytics-rules'
import type { AnalyticsReportInput } from '@/features/analytics/schemas/report-input-schema'
import type { AnalyticsCounts, AnalyticsFacts, AnalyticsReport, AnalyticsReportRow, RowCost } from '@/features/analytics/types'
import type { LeadSourceSpendEntry } from '@/shared/entities/lead-sources/dal/server/spend'

import { aggregateLeadRecords } from '@/features/analytics/lib/aggregate-lead-records'
import { addMonths, lastDayOfMonth, monthsBetween, resolveAnalyticsPeriod } from '@/features/analytics/lib/analytics-periods'
import { computeCosts, findMissingSpend, notApplicableReasons, sourceRowCostReason, spendInRange, totalRevenueCents } from '@/features/analytics/lib/analytics-rules'
import { buildLeadRecords } from '@/features/analytics/lib/build-lead-records'
import { businessDayKey, businessMonthWindow } from '@/shared/lib/business-time'

export interface AnalyticsReportData {
  facts: AnalyticsFacts
  sources: SpendSource[]
  spend: LeadSourceSpendEntry[]
}

const TREND_MONTHS = 12

/** The months a report reads spend for: the trend's twelve plus every month the period touches (a custom period can reach further back). */
export function analyticsReportWindow(input: Pick<AnalyticsReportInput, 'period' | 'from' | 'to'>, now: Date): { period: ResolvedPeriod, trendMonths: string[], spendMonths: string[] } {
  const period = resolveAnalyticsPeriod(input, now)
  const lastMonth = period.lastDay.slice(0, 7)
  const trendMonths = monthsBetween(addMonths(lastMonth, 1 - TREND_MONTHS), lastMonth)
  const periodMonths = monthsBetween(period.firstDay.slice(0, 7), lastMonth)
  return { period, trendMonths, spendMonths: [...new Set([...periodMonths, ...trendMonths])].sort() }
}

function monthDays(month: string): DayRange {
  return { first: `${month}-01`, last: lastDayOfMonth(month) }
}

function intersectDays(a: DayRange, b: DayRange): DayRange {
  return { first: a.first > b.first ? a.first : b.first, last: a.last < b.last ? a.last : b.last }
}

export function buildAnalyticsReport(data: AnalyticsReportData, input: AnalyticsReportInput, now: Date): AnalyticsReport {
  const { period, trendMonths, spendMonths } = analyticsReportWindow(input, now)
  const today = businessDayKey(now)
  const records = buildLeadRecords(data.facts, now)
  const leads = records.leads.map(p => ({ leadSourceId: p.leadSourceId, leadAt: p.leadAt }))
  const periodDays: DayRange = { first: period.firstDay, last: period.lastDay }
  const allowed = input.filters.leadSourceIds?.length ? new Set(input.filters.leadSourceIds) : null
  const scopedSources = data.sources.filter(s => !allowed || allowed.has(s.id))

  const rowCost = (counts: AnalyticsCounts, revenueCents: number | null, sources: SpendSource[], days: DayRange, reason: string | undefined): RowCost => {
    if (reason) {
      return { status: 'not_applicable', reason }
    }
    const missing = findMissingSpend(sources, data.spend, leads, days)
    if (missing.length > 0) {
      return { status: 'missing', missing }
    }
    const spendCents = spendInRange(sources, data.spend, days, today)
    return { status: 'ok', spendCents, ...computeCosts(spendCents, counts, revenueCents) }
  }
  const withCost = (counts: AnalyticsCounts, sources: SpendSource[], days: DayRange, reason: string | undefined): AnalyticsReportRow => {
    const revenueCents = totalRevenueCents(counts)
    return { ...counts, revenueCents, cost: rowCost(counts, revenueCents, sources, days, reason) }
  }

  const headlineReasons = notApplicableReasons(input.filters, 'total')
  const headlineResult = aggregateLeadRecords(records, { ...input.filters, range: period.range }, 'total')
  const headline = withCost(headlineResult.rows[0], scopedSources, periodDays, headlineReasons.cost)

  const breakdownReasons = notApplicableReasons(input.filters, input.groupBy)
  const breakdown = aggregateLeadRecords(records, { ...input.filters, range: period.range }, input.groupBy).rows.map((row) => {
    if (input.groupBy === 'leadSource') {
      const reason = breakdownReasons.cost ?? sourceRowCostReason(row.groupKey)
      return withCost(row, scopedSources.filter(s => s.id === row.groupKey), periodDays, reason)
    }
    if (input.groupBy === 'month' && row.groupKey !== null) {
      return withCost(row, scopedSources, intersectDays(periodDays, monthDays(row.groupKey)), breakdownReasons.cost)
    }
    return withCost(row, scopedSources, periodDays, breakdownReasons.cost)
  })

  const firstMonth = period.firstDay.slice(0, 7)
  const lastMonth = period.lastDay.slice(0, 7)
  const trend = trendMonths.map((month) => {
    const row = aggregateLeadRecords(records, { ...input.filters, range: businessMonthWindow(month) }, 'total').rows[0]
    return { month, selected: month >= firstMonth && month <= lastMonth, row: withCost(row, scopedSources, monthDays(month), headlineReasons.cost) }
  })

  // Data entry is owed for every source, whatever the filters narrow to, over every month the page shows.
  const spendMissing = findMissingSpend(data.sources, data.spend, leads, { first: `${spendMonths[0]}-01`, last: lastDayOfMonth(spendMonths[spendMonths.length - 1]) })
  // A month owed outside the trend (a long custom period) still needs a cell, or its warning could never be cleared.
  const spendGridMonths = [...new Set([...trendMonths, ...spendMissing.map(m => m.month)])].sort()

  // Hygiene counts every record so each count matches the records table it links to.
  const everything = aggregateLeadRecords(records, {}, 'total')
  const all = everything.rows[0]

  return {
    generatedAt: now.toISOString(),
    firstDay: period.firstDay,
    lastDay: period.lastDay,
    headline,
    breakdown,
    trend,
    notApplicable: { headline: headlineReasons, breakdown: breakdownReasons },
    spendMissing,
    spendGridMonths,
    undatedSales: headlineResult.undatedSales,
    orphans: records.orphans,
    hygiene: {
      meetingsWithoutOutcome: all.hygiene.unresolvedMeetings,
      undatedSales: everything.undatedSales ?? 0,
      newSalesWithoutProject: all.hygiene.newSalesWithoutProject ?? 0,
      unknownCityZip: all.hygiene.unknownCityZip ?? 0,
    },
  }
}
```

Create `src/features/analytics/lib/list-lead-places.ts`:

```ts
import type { LeadRecordSet } from '@/features/analytics/types'

/** Filter choices come from the leads' own anchors, so every choice matches at least one lead. */
export function listLeadPlaces(records: LeadRecordSet): { cities: string[], zips: string[] } {
  const cities = new Set<string>()
  const zips = new Set<string>()
  for (const lead of records.leads) {
    if (lead.city !== null) {
      cities.add(lead.city)
    }
    if (lead.zip !== null) {
      zips.add(lead.zip)
    }
  }
  return { cities: [...cities].sort(), zips: [...zips].sort() }
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm tsx scripts/verify-analytics-rules.ts`
Expected: sections 1–14 ✓, then `✅ verify-analytics-rules passed`. A failing expectation means the builder is wrong, not the fixture: the fixture numbers are worked out by hand in the comments. Re-derive before changing any expected value, and record any change in your report.

- [ ] **Step 7: Gates and commit**

Run: `pnpm exec eslint --fix src/features/analytics scripts/verify-analytics-rules.ts && pnpm tsc && pnpm lint`

```bash
git add src/features/analytics/schemas/report-input-schema.ts src/features/analytics/types/index.ts src/features/analytics/lib/build-analytics-report.ts src/features/analytics/lib/list-lead-places.ts scripts/verify-analytics-rules.ts
git commit -m "$(cat <<'EOF'
feat(analytics): one pure report per filter state (headline, breakdown, 12-month trend, spend, hygiene)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Server functions and the analytics router

**Files:**
- Create: `src/features/analytics/dal/server/get-analytics-report.ts`
- Create: `src/features/analytics/dal/server/get-analytics-filter-options.ts`
- Create: `src/trpc/routers/analytics.router.ts`
- Modify: `src/trpc/routers/app.ts`

**Interfaces:**
- Consumes: `loadAnalyticsFacts`; `listLeadSources` (`src/shared/entities/lead-sources/dal/server/queries.ts`, returns every source incl. archived, ordered by name); Task 1's `listLeadSourceSpend`; Task 4's builder and schemas.
- Produces:
  - `getAnalyticsReport(input: AnalyticsReportInput, now: Date): Promise<DalReturn<AnalyticsReport>>`
  - `interface AnalyticsFilterOptions { leadSources: { id: string, name: string, archived: boolean }[], cities: string[], zips: string[] }`; `getAnalyticsFilterOptions(now: Date): Promise<DalReturn<AnalyticsFilterOptions>>`
  - tRPC: `analyticsRouter.report` (query, input `analyticsReportInputSchema`), `analyticsRouter.filterOptions` (query, no input). Both `superAdminProcedure`. The spend procedures are the lead-source entity's (Task 1), not this router's.

These two files are feature-owned read models: they import no `db`, only entity DAL reads and the feature's pure builder, like Spec A's `load-analytics-facts.ts` beside them. (`docs/codebase-conventions/dal-conventions.md:19-21` still says features never hold a `dal/`; that doc is stale against Spec A's shipped code and is flagged for a separate doc fix. Do not edit it here.)

- [ ] **Step 1: Write the report loader**

Create `src/features/analytics/dal/server/get-analytics-report.ts`:

```ts
import type { AnalyticsReportInput } from '@/features/analytics/schemas/report-input-schema'
import type { AnalyticsReport } from '@/features/analytics/types'
import type { DalReturn } from '@/shared/dal/server/types'

import { loadAnalyticsFacts } from '@/features/analytics/dal/server/load-analytics-facts'
import { analyticsReportWindow, buildAnalyticsReport } from '@/features/analytics/lib/build-analytics-report'
import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { listLeadSources } from '@/shared/entities/lead-sources/dal/server/queries'
import { listLeadSourceSpend } from '@/shared/entities/lead-sources/dal/server/spend'

export async function getAnalyticsReport(input: AnalyticsReportInput, now: Date): Promise<DalReturn<AnalyticsReport>> {
  return dalDbOperation(async () => {
    const { spendMonths } = analyticsReportWindow(input, now)
    const [facts, sources, spend] = await Promise.all([loadAnalyticsFacts(), listLeadSources(), listLeadSourceSpend(spendMonths)])
    return buildAnalyticsReport({
      facts: dalVerifySuccess(facts),
      sources: dalVerifySuccess(sources).map(s => ({ id: s.id, spendMode: s.spendMode })),
      spend: dalVerifySuccess(spend),
    }, input, now)
  })
}
```

- [ ] **Step 2: Write the filter-options loader**

Create `src/features/analytics/dal/server/get-analytics-filter-options.ts`:

```ts
import type { DalReturn } from '@/shared/dal/server/types'

import { loadAnalyticsFacts } from '@/features/analytics/dal/server/load-analytics-facts'
import { buildLeadRecords } from '@/features/analytics/lib/build-lead-records'
import { listLeadPlaces } from '@/features/analytics/lib/list-lead-places'
import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { listLeadSources } from '@/shared/entities/lead-sources/dal/server/queries'

export interface AnalyticsFilterOptions {
  // Archived sources stay listed so their old leads keep a name.
  leadSources: { id: string, name: string, archived: boolean }[]
  cities: string[]
  zips: string[]
}

export async function getAnalyticsFilterOptions(now: Date): Promise<DalReturn<AnalyticsFilterOptions>> {
  return dalDbOperation(async () => {
    const [facts, sources] = await Promise.all([loadAnalyticsFacts(), listLeadSources()])
    return {
      leadSources: dalVerifySuccess(sources).map(s => ({ id: s.id, name: s.name, archived: s.archivedAt !== null })),
      ...listLeadPlaces(buildLeadRecords(dalVerifySuccess(facts), now)),
    }
  })
}
```

- [ ] **Step 3: Write the router and register it**

Create `src/trpc/routers/analytics.router.ts`:

```ts
import { getAnalyticsFilterOptions } from '@/features/analytics/dal/server/get-analytics-filter-options'
import { getAnalyticsReport } from '@/features/analytics/dal/server/get-analytics-report'
import { analyticsReportInputSchema } from '@/features/analytics/schemas/report-input-schema'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

import { createTRPCRouter, superAdminProcedure } from '../init'

export const analyticsRouter = createTRPCRouter({
  report: superAdminProcedure
    .input(analyticsReportInputSchema)
    .query(async ({ input }) => dalToTrpc(await getAnalyticsReport(input, new Date()))),

  filterOptions: superAdminProcedure
    .query(async () => dalToTrpc(await getAnalyticsFilterOptions(new Date()))),
})
```

In `src/trpc/routers/app.ts`, add `import { analyticsRouter } from './analytics.router'` (alphabetically, after `aiRouter`'s import) and `analyticsRouter,` in the `createTRPCRouter({...})` object after `aiRouter,`.

- [ ] **Step 4: Gates**

Run: `pnpm exec eslint --fix src/features/analytics src/trpc/routers/analytics.router.ts src/trpc/routers/app.ts && pnpm tsc && pnpm lint && pnpm tsx scripts/verify-analytics-rules.ts`
Expected: clean.

- [ ] **Step 5: Read-only smoke against the dev DB (throwaway, not committed)**

Needs the owner's `pnpm db:push:dev` from Task 1. If it has not run, stop and ask for it.

Create `scripts/zz-analytics-report-smoke.ts`:

```ts
import './lib/load-env'
import assert from 'node:assert/strict'

import { getAnalyticsFilterOptions } from '@/features/analytics/dal/server/get-analytics-filter-options'
import { getAnalyticsReport } from '@/features/analytics/dal/server/get-analytics-report'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { listLeadSourceSpend } from '@/shared/entities/lead-sources/dal/server/spend'

async function main() {
  const now = new Date()
  for (const period of ['this-month', 'last-month', 'ytd'] as const) {
    const report = dalVerifySuccess(await getAnalyticsReport({ period, filters: {}, groupBy: 'leadSource' }, now))
    assert.equal(report.trend.length, 12, 'twelve trend months')
    console.log(period, report.firstDay, report.lastDay, { leads: report.headline.totalLeads, sits: report.headline.sits, newSales: report.headline.newSales, cost: report.headline.cost.status, rows: report.breakdown.length, missing: report.spendMissing.length, gridMonths: report.spendGridMonths.length })
  }
  const options = dalVerifySuccess(await getAnalyticsFilterOptions(now))
  console.log({ sources: options.leadSources.length, cities: options.cities.length, zips: options.zips.length })
  console.log({ spendRows: dalVerifySuccess(await listLeadSourceSpend(['2026-09'])).length })
  process.exit(0)
}

main()
```

Run: `pnpm tsx scripts/zz-analytics-report-smoke.ts` (add `--conditions=react-server` after `tsx` if it fails on a `server-only` import).
Expected: three period lines with non-zero leads, `cost: 'missing'` (no spend is entered yet, and none is backfilled in this work), non-zero source/city counts, and `spendRows: 0`. Then `rm scripts/zz-analytics-report-smoke.ts`. Never commit it.

- [ ] **Step 6: Commit**

```bash
git add src/features/analytics/dal/server/get-analytics-report.ts src/features/analytics/dal/server/get-analytics-filter-options.ts src/trpc/routers/analytics.router.ts src/trpc/routers/app.ts
git commit -m "$(cat <<'EOF'
feat(analytics): analytics router — report and filter options

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Proposals-table filters for the hygiene links

**Files:**
- Modify: `src/shared/modules/proposals/core/dal/server/queries.ts` (`proposalListFiltersSchema` ~line 59; the `buildFilterWhere` map ~line 150)
- Modify: `src/features/proposal-flow/constants/proposal-table-filter-config.ts`

**Interfaces:**
- Produces: `proposalsRouter.business.list` accepts `filters.missingApprovedAt?: boolean` and `filters.noProject?: boolean`; the proposals table reads `?pp_missingApprovedAt=true` and `?pp_noProject=true` from the URL and shows them as toggles.

The table only reads URL filters that are in its filter config (`makePaginatedParsers` builds parsers from `PROPOSAL_FILTER_CONFIG`), so each filter needs a config entry as well as the server predicate.

- [ ] **Step 1: Add the server filters**

In `proposalListFiltersSchema`, after `sentNoContract: z.boolean().optional(),`, add:

```ts
  missingApprovedAt: z.boolean().optional(),
  noProject: z.boolean().optional(),
```

In the `buildFilterWhere(input.filters, { ... })` map, after the `sentNoContract` entry, add:

```ts
      // An approved proposal with no approval date can't be placed in any month's sales.
      missingApprovedAt: (v: boolean) => (v ? isNull(proposals.approvedAt) : undefined),
      noProject: (v: boolean) => (v ? isNull(meetings.projectId) : undefined),
```

(`isNull`, `proposals` and `meetings` are already imported there. Both the list query and its count query already left-join `meetings`.)

- [ ] **Step 2: Add the table config entries**

In `PROPOSAL_FILTER_CONFIG`, append after the `price` entry:

```ts
  {
    id: 'missingApprovedAt',
    type: 'boolean',
    label: 'No approval date',
  },
  {
    id: 'noProject',
    type: 'boolean',
    label: 'No project',
  },
```

- [ ] **Step 3: Gates**

Run: `pnpm exec eslint --fix src/shared/modules/proposals/core/dal/server/queries.ts src/features/proposal-flow/constants/proposal-table-filter-config.ts && pnpm tsc && pnpm lint`
Expected: clean. If `tsc` reports the query toolbar's boolean renderer needs something, read `src/shared/components/query-toolbar/ui/filter-controls/boolean-filter-control.tsx` — the `boolean` type is already registered in `filter-renderer-registry.tsx`, so no toolbar change should be needed.

- [ ] **Step 4: Check the links by hand on the dev server (read-only)**

With `pnpm dev` running (check `ss -ltnp | grep 3000` first; reuse a running server), sign in through the Playwright session route (`/api/dev/playwright-session`, see `memory/reference-playwright-auth.md`) and open:
- `/dashboard/proposals?pp_status=approved&pp_missingApprovedAt=true`
- `/dashboard/proposals?pp_kind=initial-sale&pp_status=approved&pp_noProject=true`

Expected: each list narrows, and the toolbar shows the "No approval date" / "No project" toggle as active. Reading pages writes nothing.

- [ ] **Step 5: Commit**

```bash
git add src/shared/modules/proposals/core/dal/server/queries.ts src/features/proposal-flow/constants/proposal-table-filter-config.ts
git commit -m "$(cat <<'EOF'
feat(proposals): table filters for approved proposals with no approval date or no project

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7a: Page state — constants and pure page libs

**Files:**
- Create: `src/features/analytics/constants/tabs.ts`, `metrics.ts`, `labels.ts`, `query-parsers.ts`
- Create: `src/features/analytics/lib/to-report-input.ts`, `read-metric.ts`, `breakdown-columns.ts`, `trend-points.ts`, `format-analytics.ts`, `hygiene-links.ts`, `filter-update.ts`, `filter-fields.ts`, `spend-grid-rows.ts`, `parse-dollars.ts`
- Test: `scripts/verify-analytics-rules.ts` (section 15)

**Interfaces:**
- Consumes: Tasks 4–5 (`AnalyticsReport`, `AnalyticsReportRow`, `AnalyticsHygiene`, `NotApplicableReasons`, `AnalyticsReportInput`, `MissingSpend`, `AnalyticsFilterOptions`).
- Produces (used by Tasks 7b–9):
  - `REPORT_TAB_KEYS`, `type ReportTab`, `ANALYTICS_TABS`, `type AnalyticsTab`, `interface HeadlineFigure { metric: MetricKey, sub?: MetricKey }`, `interface ReportTabConfig { figures, columns?, defaultFocus, groupBys, hygiene }`, `REPORT_TABS`, `TAB_LABELS`, `isReportTab(tab): tab is ReportTab`
  - `METRICS`, `type MetricKey`, `type MetricFormat`, `type MetricDefinition`
  - `MEETING_ORDER_LABELS`, `GROUP_BY_LABELS`, `PERIOD_LABELS`, `HYGIENE_LABELS`
  - `analyticsSearchParams`, `loadAnalyticsSearchParams`, `FILTER_KEYS`, `type FilterKey`, `UNKNOWN_FILTER_VALUE`, `CLEARED_FILTERS`, `type AnalyticsUrlState`
  - `toReportInput(state: AnalyticsUrlState): AnalyticsReportInput`, `resolveGroupBy(state): Exclude<AnalyticsGroupBy, 'total'>`, `resolveFocus(tab: ReportTab, focus: string | null): MetricKey`
  - `type MetricDisplay`, `readMetric(key, row, reasons): MetricDisplay`, `metricDisplayText(display): string`, `formatMetricValue(value, format): string`, `sortRowsByMetric(rows, key, reasons): AnalyticsReportRow[]`
  - `breakdownColumns(config: ReportTabConfig): MetricKey[]`
  - `interface TrendPoint`, `buildTrendPoints(report: AnalyticsReport, metric: MetricKey): TrendPoint[]`
  - `formatMonthLabel(month, style?)`, `formatDayRange(first, last)`, `groupLabel(groupBy, key, names)`, `filterValueLabel(key, value, names)`, `interface AnalyticsNames { sourceName(id): string, closerName(id): string }`
  - `hygieneHref(key, asOf: string): string | null`
  - `filterUpdate(key: FilterKey, values: readonly string[]): Partial<AnalyticsUrlState>`
  - `interface FilterField`, `buildFilterFields(options: AnalyticsFilterOptions | undefined, closers: { id: string, name: string }[]): FilterField[]`
  - `interface SpendGridSource`, `spendGridRows(sources, entries, missing): { tracked: SpendGridSource[], free: SpendGridSource[] }`
  - `parseDollarsToCents(text): number | null | 'invalid'`, `formatCentsForInput(cents): string`

Everything here is pure (no React, DB or tRPC at runtime), so the verify script tests it. `constants/query-parsers.ts` imports `nuqs/server`, which is safe outside Next (checked: it loads under `tsx`) and is where two other features keep their parsers (`src/features/{calculators,campaigns-admin}/constants/query-parsers.ts`).

- [ ] **Step 1: Write the failing checks**

In `scripts/verify-analytics-rules.ts`, add to the imports:

```ts
import type { AnalyticsUrlState } from '@/features/analytics/constants/query-parsers'
import type { AnalyticsReportRow } from '@/features/analytics/types'

import { REPORT_TABS } from '@/features/analytics/constants/tabs'
import { breakdownColumns } from '@/features/analytics/lib/breakdown-columns'
import { buildFilterFields } from '@/features/analytics/lib/filter-fields'
import { filterUpdate } from '@/features/analytics/lib/filter-update'
import { formatDayRange } from '@/features/analytics/lib/format-analytics'
import { hygieneHref } from '@/features/analytics/lib/hygiene-links'
import { formatCentsForInput, parseDollarsToCents } from '@/features/analytics/lib/parse-dollars'
import { metricDisplayText, readMetric, sortRowsByMetric } from '@/features/analytics/lib/read-metric'
import { spendGridRows } from '@/features/analytics/lib/spend-grid-rows'
import { resolveFocus, toReportInput } from '@/features/analytics/lib/to-report-input'
import { buildTrendPoints } from '@/features/analytics/lib/trend-points'
```

and add after section 14:

```ts
// ── 15. Page state ──────────────────────────────────────────────────────────
{
  const SOURCE = '4b7e1c2a-9d3f-4e5a-8b6c-1d2e3f4a5b6c'
  const base: AnalyticsUrlState = { period: 'this-month', from: '', to: '', source: [], city: [], zip: [], closer: [], outcome: [], order: [], tab: 'overview', groupBy: null, focus: null }
  assert.deepEqual(toReportInput(base), { period: 'this-month', filters: {}, groupBy: 'leadSource' }, 'defaults: this month, no filters, the tab\'s first group-by')
  assert.equal(toReportInput({ ...base, period: 'custom' }).period, 'this-month', 'a custom period with no days falls back to this month')
  assert.equal(toReportInput({ ...base, period: 'custom', from: '2026-13-45', to: '2026-09-30' }).period, 'this-month', 'an impossible day falls back')
  assert.equal(toReportInput({ ...base, period: 'custom', from: '2026-09-30', to: '2026-09-01' }).period, 'this-month', 'days out of order fall back')
  assert.deepEqual(toReportInput({ ...base, period: 'custom', from: '2026-08-17', to: '2026-09-10' }), { period: 'custom', from: '2026-08-17', to: '2026-09-10', filters: {}, groupBy: 'leadSource' }, 'a valid custom period passes its days')
  assert.deepEqual(toReportInput({ ...base, source: [SOURCE, 'unknown', 'not-a-uuid'], city: ['Irvine', 'unknown'] }).filters, { leadSourceIds: [SOURCE, null], cities: ['Irvine', null] }, '"unknown" means no value; a malformed source id is dropped')
  assert.equal(toReportInput({ ...base, tab: 'appointments', groupBy: 'city' }).groupBy, 'closer', 'a group-by the tab does not offer falls back to the tab\'s first')
  assert.equal(toReportInput({ ...base, tab: 'sales', groupBy: 'month' }).groupBy, 'month', 'a group-by the tab offers is kept')
  assert.equal(toReportInput({ ...base, tab: 'spend' }).groupBy, 'leadSource', 'non-report tabs ask for the overview\'s report')
  assert.equal(resolveFocus('overview', null), 'sits', 'overview focuses sits')
  assert.equal(resolveFocus('sales', 'revenueNew'), 'revenueNew', 'a figure on the tab can be focused')
  assert.equal(resolveFocus('leads', 'validLeads'), 'totalLeads', 'a figure that is not available yet cannot be focused')
  assert.equal(resolveFocus('leads', 'sits'), 'totalLeads', 'a figure from another tab falls back')

  assert.deepEqual(filterUpdate('outcome', ['pns', 'bogus']), { outcome: ['pns'] }, 'an outcome the parser does not know is dropped')
  assert.deepEqual(filterUpdate('order', ['first', 'x']), { order: ['first'] }, 'so is a meeting order')
  assert.deepEqual(filterUpdate('city', ['Irvine']), { city: ['Irvine'] }, 'free-text keys pass through')

  const fields = buildFilterFields({ leadSources: [{ id: SOURCE, name: 'Angi', archived: true }], cities: ['Irvine'], zips: [] }, [])
  assert.deepEqual(fields.map(f => f.key), ['source', 'city', 'zip', 'closer', 'outcome', 'order'], 'one field per filter key, in order')
  assert.deepEqual(fields[0].definition.options.map(o => o.label), ['Angi (archived)', 'Unknown source'], 'archived sources are named as such; unknown is always a choice')

  assert.ok(breakdownColumns(REPORT_TABS.overview).includes('costPerSit'), 'the overview breakdown shows cost at every stage')
  assert.ok(breakdownColumns(REPORT_TABS.overview).includes('returnOnSpend'), 'and revenue per $1')
  assert.ok(!breakdownColumns(REPORT_TABS.leads).includes('validLeads'), 'figures not available yet have no column')

  assert.equal(parseDollarsToCents('$1,200.50'), 120_050, 'dollars with a sign and commas')
  assert.equal(parseDollarsToCents('1200'), 120_000, 'whole dollars')
  assert.equal(parseDollarsToCents('$0'), 0, '$0 is a real amount')
  assert.equal(parseDollarsToCents('  '), null, 'blank means not entered')
  for (const junk of ['-5', 'abc', '12.345', '1.2.3']) {
    assert.equal(parseDollarsToCents(junk), 'invalid', `${junk} is rejected`)
  }
  assert.equal(formatCentsForInput(120_050), '1200.50', 'cents shown back with two decimals')
  assert.equal(formatCentsForInput(120_000), '1200', 'whole dollars shown without decimals')

  assert.equal(formatDayRange('2026-09-01', '2026-09-27'), 'Sep 1 – 27, 2026', 'one month')
  assert.equal(formatDayRange('2026-08-17', '2026-09-10'), 'Aug 17 – Sep 10, 2026', 'two months')
  assert.equal(formatDayRange('2025-10-01', '2026-09-30'), 'Oct 1, 2025 – Sep 30, 2026', 'two years')

  const row = (over: Partial<AnalyticsReportRow>): AnalyticsReportRow => ({
    groupKey: 'g',
    overlapsTotal: false,
    totalLeads: 4,
    mergedRecords: 0,
    validLeads: 4,
    junkLeads: null,
    bookedLeads: 2,
    sits: 1,
    meetings: 2,
    newSales: 1,
    totalCloses: 1,
    revenueNewCents: 1_000_000,
    revenueUpsellCents: 0,
    averageTicketCents: 1_000_000,
    rates: { bookingRate: 0.5, sitRate: 0.5, closeRate: 1 },
    hygiene: { unresolvedMeetings: 0, salesWithoutValue: 0, newSalesWithoutProject: 0, unknownCityZip: 0 },
    revenueCents: 1_000_000,
    cost: { status: 'ok', spendCents: 200_000, costs: { costPerLead: 50_000, costPerBookedLead: 100_000, costPerSit: 200_000, costPerNewSale: 200_000 }, returnOnSpend: 5 },
    ...over,
  })
  assert.deepEqual(readMetric('costPerLead', row({}), {}), { kind: 'value', value: 50_000, text: '$500' }, 'cost per lead in dollars')
  assert.deepEqual(readMetric('sitRate', row({}), {}), { kind: 'value', value: 0.5, text: '50%' }, 'a rate in percent')
  assert.deepEqual(readMetric('closeRate', row({ rates: { bookingRate: null, sitRate: null, closeRate: null } }), {}), { kind: 'empty' }, 'a rate over nothing is empty, not 0%')
  assert.deepEqual(readMetric('totalLeads', row({ totalLeads: null }), { leads: 'why' }), { kind: 'not_applicable', reason: 'why' }, 'a not-applicable stage says why')
  assert.deepEqual(readMetric('spend', row({ cost: { status: 'missing', missing: [] } }), {}), { kind: 'missing' }, 'missing spend')
  assert.deepEqual(readMetric('costPerLead', row({ cost: { status: 'not_applicable', reason: 'no source' } }), {}), { kind: 'not_applicable', reason: 'no source' }, 'a row-level cost reason')
  assert.equal(readMetric('validLeads', row({}), {}).kind, 'not_yet', 'valid leads wait for lead quality')
  assert.deepEqual(['$500', '—', 'n/a', 'missing', 'not available yet'], [
    metricDisplayText(readMetric('costPerLead', row({}), {})),
    metricDisplayText({ kind: 'empty' }),
    metricDisplayText({ kind: 'not_applicable', reason: 'why' }),
    metricDisplayText({ kind: 'missing' }),
    metricDisplayText({ kind: 'not_yet', source: 'lead quality' }),
  ], 'every display reads as one short string (chart tooltips)')
  assert.deepEqual(
    sortRowsByMetric([row({ groupKey: 'a', sits: 1 }), row({ groupKey: 'b', sits: 3 }), row({ groupKey: 'c', cost: { status: 'missing', missing: [] } }), row({ groupKey: 'd', sits: 3 })], 'sits', {}).map(r => r.groupKey),
    ['b', 'd', 'a', 'c'],
    'highest first, ties keep their order',
  )
  assert.deepEqual(
    sortRowsByMetric([row({ groupKey: 'a', cost: { status: 'missing', missing: [] } }), row({ groupKey: 'b' })], 'costPerLead', {}).map(r => r.groupKey),
    ['b', 'a'],
    'rows without a value sort last',
  )

  const emptyReport = buildAnalyticsReport({ facts: { customers: [], meetings: [], sales: [] }, sources: [], spend: [] }, { period: 'this-month', filters: {}, groupBy: 'leadSource' }, NOW)
  const points = buildTrendPoints(emptyReport, 'sits')
  assert.deepEqual([points.length, points[11].label, points[11].selected, points[11].value], [12, 'Sep', true, 0], 'twelve points, the period\'s month selected, a zero is a value')

  const grid = spendGridRows(
    [
      { id: 'paid', name: 'Angi', spendMode: 'manual', archived: false },
      { id: 'old-owed', name: 'Old vendor', spendMode: 'manual', archived: true },
      { id: 'old-done', name: 'Gone vendor', spendMode: 'manual', archived: true },
      { id: 'free', name: 'Referral', spendMode: 'none', archived: false },
      { id: 'free-old', name: 'Walk-in', spendMode: 'none', archived: true },
    ],
    [],
    [{ leadSourceId: 'old-owed', month: '2026-08' }],
  )
  assert.deepEqual(grid.tracked.map(s => s.id), ['paid', 'old-owed'], 'an archived source still owed spend keeps its row, or its warning could never clear')
  assert.deepEqual(grid.free.map(s => s.id), ['free'], 'archived free sources are not listed')

  assert.equal(hygieneHref('meetingsWithoutOutcome', NOW.toISOString()), '/dashboard/meetings?pm_outcome=not_set&pm_scheduledFor=%7B%22to%22%3A%222026-09-26T19%3A00%3A00.000Z%22%7D', 'past meetings with no outcome, cut off at the report\'s instant')
  assert.equal(hygieneHref('undatedSales', NOW.toISOString()), '/dashboard/proposals?pp_status=approved&pp_missingApprovedAt=true', 'undated sales')
  assert.equal(hygieneHref('newSalesWithoutProject', NOW.toISOString()), '/dashboard/proposals?pp_kind=initial-sale&pp_status=approved&pp_noProject=true', 'new sales without a project')
  assert.equal(hygieneHref('unknownCityZip', NOW.toISOString()), null, 'no customers filter for unknown places yet')
}
console.log('15. Page state ✓')
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm tsx scripts/verify-analytics-rules.ts`
Expected: FAIL — cannot resolve `@/features/analytics/constants/query-parsers`.

- [ ] **Step 3: Write the constants**

Create `src/features/analytics/constants/metrics.ts`:

```ts
import type { AnalyticsCostKey } from '@/features/analytics/lib/analytics-rules'
import type { AnalyticsReportRow } from '@/features/analytics/types'

export type MetricFormat = 'count' | 'money' | 'rate' | 'multiple'

/** The not-applicable reason that silences a metric. */
export type MetricStage = 'leads' | 'sales' | 'cost'

export type MetricDefinition
  = | { label: string, format: MetricFormat, stage?: MetricStage, read: (row: AnalyticsReportRow) => number | null }
    | { label: string, notYet: string }

function cost(key: AnalyticsCostKey) {
  return (row: AnalyticsReportRow) => (row.cost.status === 'ok' ? row.cost.costs[key] : null)
}

// Every value is read from the report; nothing here computes a metric.
export const METRICS = {
  totalLeads: { label: 'Leads', format: 'count', stage: 'leads', read: r => r.totalLeads },
  mergedRecords: { label: 'Merged duplicates', format: 'count', stage: 'leads', read: r => r.mergedRecords },
  validLeads: { label: 'Valid leads', notYet: 'lead quality' },
  junkRate: { label: 'Junk rate', notYet: 'lead quality' },
  bookedLeads: { label: 'Booked leads', format: 'count', read: r => r.bookedLeads },
  bookingRate: { label: 'Booking rate', format: 'rate', stage: 'leads', read: r => r.rates.bookingRate },
  sits: { label: 'Sits', format: 'count', read: r => r.sits },
  sitRate: { label: 'Sit rate', format: 'rate', read: r => r.rates.sitRate },
  meetings: { label: 'Meetings', format: 'count', read: r => r.meetings },
  meetingsWithoutOutcome: { label: 'No outcome', format: 'count', read: r => r.hygiene.unresolvedMeetings },
  setter: { label: 'Setter', notYet: 'setter tracking' },
  newSales: { label: 'New sales', format: 'count', stage: 'sales', read: r => r.newSales },
  closeRate: { label: 'Close rate', format: 'rate', stage: 'sales', read: r => r.rates.closeRate },
  totalCloses: { label: 'Total closes', format: 'count', stage: 'sales', read: r => r.totalCloses },
  revenue: { label: 'Revenue', format: 'money', stage: 'sales', read: r => r.revenueCents },
  revenueNew: { label: 'New revenue', format: 'money', stage: 'sales', read: r => r.revenueNewCents },
  revenueUpsell: { label: 'Upsell revenue', format: 'money', stage: 'sales', read: r => r.revenueUpsellCents },
  averageTicket: { label: 'Average ticket', format: 'money', stage: 'sales', read: r => r.averageTicketCents },
  cancelled: { label: 'Cancelled', notYet: 'cancellations' },
  netSales: { label: 'Net sales', notYet: 'cancellations' },
  spend: { label: 'Spend', format: 'money', stage: 'cost', read: r => (r.cost.status === 'ok' ? r.cost.spendCents : null) },
  costPerLead: { label: 'Cost per lead', format: 'money', stage: 'cost', read: cost('costPerLead') },
  costPerBookedLead: { label: 'Cost per booked lead', format: 'money', stage: 'cost', read: cost('costPerBookedLead') },
  costPerSit: { label: 'Cost per sit', format: 'money', stage: 'cost', read: cost('costPerSit') },
  costPerNewSale: { label: 'Cost per sale', format: 'money', stage: 'cost', read: cost('costPerNewSale') },
  returnOnSpend: { label: 'Revenue per $1', format: 'multiple', stage: 'cost', read: r => (r.cost.status === 'ok' ? r.cost.returnOnSpend : null) },
} as const satisfies Record<string, MetricDefinition>

export type MetricKey = keyof typeof METRICS
```

Create `src/features/analytics/constants/tabs.ts`:

```ts
import type { MetricKey } from '@/features/analytics/constants/metrics'
import type { AnalyticsGroupBy, AnalyticsHygiene } from '@/features/analytics/types'

export const REPORT_TAB_KEYS = ['overview', 'leads', 'appointments', 'sales'] as const
export type ReportTab = (typeof REPORT_TAB_KEYS)[number]

export const ANALYTICS_TABS = [...REPORT_TAB_KEYS, 'projects', 'spend'] as const
export type AnalyticsTab = (typeof ANALYTICS_TABS)[number]

export const TAB_LABELS: Record<AnalyticsTab, string> = {
  overview: 'Overview',
  leads: 'Leads',
  appointments: 'Appointments',
  sales: 'Sales',
  projects: 'Projects',
  spend: 'Spend',
}

export interface HeadlineFigure {
  metric: MetricKey
  /** A rate or cost shown under the figure. */
  sub?: MetricKey
}

export interface ReportTabConfig {
  figures: readonly HeadlineFigure[]
  /** The breakdown's columns when they differ from the headline's figures. */
  columns?: readonly MetricKey[]
  defaultFocus: MetricKey
  /** The first is the default. */
  groupBys: readonly Exclude<AnalyticsGroupBy, 'total'>[]
  hygiene: readonly (keyof AnalyticsHygiene)[]
}

export const REPORT_TABS: Record<ReportTab, ReportTabConfig> = {
  overview: {
    figures: [
      { metric: 'totalLeads' },
      { metric: 'bookedLeads', sub: 'bookingRate' },
      { metric: 'sits', sub: 'sitRate' },
      { metric: 'newSales', sub: 'closeRate' },
      { metric: 'revenue' },
      { metric: 'spend', sub: 'costPerNewSale' },
    ],
    // The strip stays short; the per-source table carries cost at every stage.
    columns: ['totalLeads', 'bookedLeads', 'bookingRate', 'sits', 'sitRate', 'newSales', 'closeRate', 'revenue', 'spend', 'costPerLead', 'costPerBookedLead', 'costPerSit', 'costPerNewSale', 'returnOnSpend'],
    defaultFocus: 'sits',
    groupBys: ['leadSource', 'month', 'closer', 'city', 'zip'],
    hygiene: ['meetingsWithoutOutcome', 'undatedSales', 'newSalesWithoutProject', 'unknownCityZip'],
  },
  leads: {
    figures: [{ metric: 'totalLeads' }, { metric: 'mergedRecords' }, { metric: 'costPerLead' }, { metric: 'validLeads' }, { metric: 'junkRate' }],
    defaultFocus: 'totalLeads',
    groupBys: ['leadSource', 'city', 'zip', 'month'],
    hygiene: ['unknownCityZip'],
  },
  appointments: {
    figures: [{ metric: 'bookedLeads', sub: 'bookingRate' }, { metric: 'sits', sub: 'sitRate' }, { metric: 'meetings' }, { metric: 'meetingsWithoutOutcome' }, { metric: 'setter' }],
    defaultFocus: 'sits',
    groupBys: ['closer', 'outcome', 'meetingOrder', 'leadSource'],
    hygiene: ['meetingsWithoutOutcome'],
  },
  sales: {
    figures: [{ metric: 'newSales', sub: 'closeRate' }, { metric: 'totalCloses' }, { metric: 'revenueNew' }, { metric: 'revenueUpsell' }, { metric: 'averageTicket' }, { metric: 'cancelled' }, { metric: 'netSales' }],
    defaultFocus: 'newSales',
    groupBys: ['closer', 'leadSource', 'month'],
    hygiene: ['undatedSales', 'newSalesWithoutProject'],
  },
}

export function isReportTab(tab: AnalyticsTab): tab is ReportTab {
  return tab in REPORT_TABS
}
```

Create `src/features/analytics/constants/labels.ts`:

```ts
import type { AnalyticsGroupBy, AnalyticsHygiene, AnalyticsPeriod, MeetingOrder } from '@/features/analytics/types'

export const MEETING_ORDER_LABELS: Record<MeetingOrder, string> = {
  first: 'First sit',
  repeat: 'Repeat',
  not_sat: 'Never sat',
  project: 'Project',
}

export const GROUP_BY_LABELS: Record<AnalyticsGroupBy, string> = {
  total: 'Total',
  leadSource: 'Source',
  month: 'Month',
  closer: 'Closer',
  outcome: 'Outcome',
  meetingOrder: 'Meeting order',
  city: 'City',
  zip: 'Zip',
}

export const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  'this-month': 'This month',
  'last-month': 'Last month',
  'this-quarter': 'This quarter',
  'last-quarter': 'Last quarter',
  'ytd': 'Year to date',
  'last-12': 'Last 12 months',
  'custom': 'Custom',
}

export const HYGIENE_LABELS: Record<keyof AnalyticsHygiene, string> = {
  meetingsWithoutOutcome: 'Past meetings with no outcome',
  undatedSales: 'Sales with no approval date',
  newSalesWithoutProject: 'New sales without a project',
  unknownCityZip: 'Leads with unknown city or zip',
}
```

Create `src/features/analytics/constants/query-parsers.ts`:

```ts
import type { inferParserType } from 'nuqs/server'

import { createLoader, parseAsArrayOf, parseAsString, parseAsStringLiteral } from 'nuqs/server'

import { ANALYTICS_GROUP_BYS, ANALYTICS_PERIODS, MEETING_ORDERS } from '@/features/analytics/constants/dimensions'
import { ANALYTICS_TABS } from '@/features/analytics/constants/tabs'
import { meetingOutcomes } from '@/shared/constants/enums/meetings'

// The whole page state lives in the URL so every view can be bookmarked.
export const analyticsSearchParams = {
  period: parseAsStringLiteral(ANALYTICS_PERIODS).withDefault('this-month'),
  from: parseAsString.withDefault(''),
  to: parseAsString.withDefault(''),
  source: parseAsArrayOf(parseAsString).withDefault([]),
  city: parseAsArrayOf(parseAsString).withDefault([]),
  zip: parseAsArrayOf(parseAsString).withDefault([]),
  closer: parseAsArrayOf(parseAsString).withDefault([]),
  outcome: parseAsArrayOf(parseAsStringLiteral(meetingOutcomes)).withDefault([]),
  order: parseAsArrayOf(parseAsStringLiteral(MEETING_ORDERS)).withDefault([]),
  tab: parseAsStringLiteral(ANALYTICS_TABS).withDefault('overview'),
  groupBy: parseAsStringLiteral(ANALYTICS_GROUP_BYS),
  focus: parseAsString,
}

export type AnalyticsUrlState = inferParserType<typeof analyticsSearchParams>

export const loadAnalyticsSearchParams = createLoader(analyticsSearchParams)

export const FILTER_KEYS = ['source', 'city', 'zip', 'closer', 'outcome', 'order'] as const
export type FilterKey = (typeof FILTER_KEYS)[number]

export const CLEARED_FILTERS = { source: null, city: null, zip: null, closer: null, outcome: null, order: null } as const satisfies Record<FilterKey, null>

// Stands for "no value" (unknown source, city or zip). Source ids are uuids and
// intake's "Unknown" placeholder is already folded to null, so nothing collides.
export const UNKNOWN_FILTER_VALUE = 'unknown'
```

- [ ] **Step 4: Write the pure page libs**

Create `src/features/analytics/lib/to-report-input.ts`:

```ts
import type { MetricKey } from '@/features/analytics/constants/metrics'
import type { AnalyticsUrlState } from '@/features/analytics/constants/query-parsers'
import type { ReportTab } from '@/features/analytics/constants/tabs'
import type { AnalyticsReportInput } from '@/features/analytics/schemas/report-input-schema'
import type { AnalyticsFilters, AnalyticsGroupBy } from '@/features/analytics/types'

import z from 'zod'

import { METRICS } from '@/features/analytics/constants/metrics'
import { UNKNOWN_FILTER_VALUE } from '@/features/analytics/constants/query-parsers'
import { isReportTab, REPORT_TABS } from '@/features/analytics/constants/tabs'
import { businessDaySchema } from '@/features/analytics/schemas/report-input-schema'

// The router's own check, so a source id that passes here never fails the request.
const sourceIdSchema = z.string().uuid()

function withUnknown(values: readonly string[]): (string | null)[] {
  return values.map(v => (v === UNKNOWN_FILTER_VALUE ? null : v))
}

/** A group-by the tab does not offer (a stale URL) falls back to the tab's first. */
export function resolveGroupBy(state: Pick<AnalyticsUrlState, 'tab' | 'groupBy'>): Exclude<AnalyticsGroupBy, 'total'> {
  const { groupBys } = REPORT_TABS[isReportTab(state.tab) ? state.tab : 'overview']
  return groupBys.find(g => g === state.groupBy) ?? groupBys[0]
}

/** Only a figure on the tab with a value can be the focus; anything else falls back to the tab's default. */
export function resolveFocus(tab: ReportTab, focus: string | null): MetricKey {
  const config = REPORT_TABS[tab]
  const focusable = config.figures.map(f => f.metric).filter(key => !('notYet' in METRICS[key]))
  return focusable.find(key => key === focus) ?? config.defaultFocus
}

/**
 * The one mapping from URL state to the report input, shared by the page's
 * prefetch and the view so both ask for the same query key. A malformed URL
 * falls back to a valid report instead of a failed request.
 */
export function toReportInput(state: AnalyticsUrlState): AnalyticsReportInput {
  const customOk = state.period === 'custom'
    && businessDaySchema.safeParse(state.from).success
    && businessDaySchema.safeParse(state.to).success
    && state.from <= state.to
  const period = state.period === 'custom' && !customOk ? 'this-month' : state.period

  const filters: AnalyticsFilters = {}
  const sources = state.source.filter(v => v === UNKNOWN_FILTER_VALUE || sourceIdSchema.safeParse(v).success)
  if (sources.length > 0) {
    filters.leadSourceIds = withUnknown(sources)
  }
  if (state.city.length > 0) {
    filters.cities = withUnknown(state.city)
  }
  if (state.zip.length > 0) {
    filters.zips = withUnknown(state.zip)
  }
  if (state.closer.length > 0) {
    filters.closerIds = [...state.closer]
  }
  if (state.outcome.length > 0) {
    filters.outcomes = [...state.outcome]
  }
  if (state.order.length > 0) {
    filters.meetingOrder = [...state.order]
  }

  return {
    period,
    ...(period === 'custom' ? { from: state.from, to: state.to } : {}),
    filters,
    groupBy: resolveGroupBy(state),
  }
}
```

Create `src/features/analytics/lib/read-metric.ts`:

```ts
import type { MetricDefinition, MetricFormat, MetricKey } from '@/features/analytics/constants/metrics'
import type { NotApplicableReasons } from '@/features/analytics/lib/analytics-rules'
import type { AnalyticsReportRow } from '@/features/analytics/types'

import { METRICS } from '@/features/analytics/constants/metrics'
import { formatAsCount, formatAsDollars } from '@/shared/lib/formatters'

export type MetricDisplay
  = | { kind: 'value', value: number, text: string }
    /** A rate or cost over nothing: shown as "—", never 0. */
    | { kind: 'empty' }
    | { kind: 'not_applicable', reason: string }
    | { kind: 'missing' }
    | { kind: 'not_yet', source: string }

export function formatMetricValue(value: number, format: MetricFormat): string {
  switch (format) {
    case 'count':
      return formatAsCount(value)
    case 'money':
      return formatAsDollars(value / 100)
    case 'rate':
      return `${Math.round(value * 100)}%`
    case 'multiple':
      return `${value.toFixed(1)}×`
  }
}

export function readMetric(key: MetricKey, row: AnalyticsReportRow, reasons: NotApplicableReasons): MetricDisplay {
  const definition: MetricDefinition = METRICS[key]
  if ('notYet' in definition) {
    return { kind: 'not_yet', source: definition.notYet }
  }
  if (definition.stage) {
    const rowReason = definition.stage === 'cost' && row.cost.status === 'not_applicable' ? row.cost.reason : undefined
    const reason = reasons[definition.stage] ?? rowReason
    if (reason) {
      return { kind: 'not_applicable', reason }
    }
    if (definition.stage === 'cost' && row.cost.status === 'missing') {
      return { kind: 'missing' }
    }
  }
  const value = definition.read(row)
  return value === null ? { kind: 'empty' } : { kind: 'value', value, text: formatMetricValue(value, definition.format) }
}

/** The one-string form of a display, for places that cannot style it (chart tooltips). */
export function metricDisplayText(display: MetricDisplay): string {
  switch (display.kind) {
    case 'value':
      return display.text
    case 'empty':
      return '—'
    case 'not_applicable':
      return 'n/a'
    case 'missing':
      return 'missing'
    case 'not_yet':
      return 'not available yet'
  }
}

/** Highest first; rows with no value sink to the bottom; ties keep the report's order. */
export function sortRowsByMetric(rows: readonly AnalyticsReportRow[], key: MetricKey, reasons: NotApplicableReasons): AnalyticsReportRow[] {
  const valueOf = (row: AnalyticsReportRow) => {
    const display = readMetric(key, row, reasons)
    return display.kind === 'value' ? display.value : Number.NEGATIVE_INFINITY
  }
  return rows
    .map((row, index) => ({ row, index, value: valueOf(row) }))
    .sort((a, b) => (b.value - a.value) || (a.index - b.index))
    .map(entry => entry.row)
}
```

Note: two `-Infinity` values subtract to `NaN`; `NaN || (a.index - b.index)` falls through to the index, which is the tie-break we want.

Create `src/features/analytics/lib/breakdown-columns.ts`:

```ts
import type { MetricKey } from '@/features/analytics/constants/metrics'
import type { ReportTabConfig } from '@/features/analytics/constants/tabs'

import { METRICS } from '@/features/analytics/constants/metrics'

/** A tab's own column list, or its headline figures with their sub-figures; a figure not available yet has no column. */
export function breakdownColumns(config: ReportTabConfig): MetricKey[] {
  const keys = config.columns ?? config.figures.flatMap(f => (f.sub ? [f.metric, f.sub] : [f.metric]))
  return keys.filter(key => !('notYet' in METRICS[key]))
}
```

Create `src/features/analytics/lib/trend-points.ts`:

```ts
import type { MetricKey } from '@/features/analytics/constants/metrics'
import type { MetricDisplay } from '@/features/analytics/lib/read-metric'
import type { AnalyticsReport } from '@/features/analytics/types'

import { formatMonthLabel } from '@/features/analytics/lib/format-analytics'
import { readMetric } from '@/features/analytics/lib/read-metric'

export interface TrendPoint {
  month: string
  label: string
  /** Null draws no bar; the tooltip still says why. */
  value: number | null
  display: MetricDisplay
  selected: boolean
}

export function buildTrendPoints(report: AnalyticsReport, metric: MetricKey): TrendPoint[] {
  return report.trend.map((t) => {
    const display = readMetric(metric, t.row, report.notApplicable.headline)
    return { month: t.month, label: formatMonthLabel(t.month, 'short'), value: display.kind === 'value' ? display.value : null, display, selected: t.selected }
  })
}
```

Create `src/features/analytics/lib/format-analytics.ts`:

```ts
import type { FilterKey } from '@/features/analytics/constants/query-parsers'
import type { AnalyticsGroupBy } from '@/features/analytics/types'

import { MEETING_ORDERS } from '@/features/analytics/constants/dimensions'
import { MEETING_ORDER_LABELS } from '@/features/analytics/constants/labels'
import { UNKNOWN_FILTER_VALUE } from '@/features/analytics/constants/query-parsers'
import { meetingOutcomes } from '@/shared/constants/enums/meetings'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'

export interface AnalyticsNames {
  sourceName: (id: string) => string
  closerName: (id: string) => string
}

function formatDay(day: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' })
}

export function formatMonthLabel(month: string, style: 'long' | 'short' = 'long'): string {
  return formatDay(`${month}-01`, style === 'long' ? { month: 'short', year: 'numeric' } : { month: 'short' })
}

export function formatDayRange(first: string, last: string): string {
  const year = last.slice(0, 4)
  if (first.slice(0, 7) === last.slice(0, 7)) {
    return `${formatDay(first, { month: 'short', day: 'numeric' })} – ${Number(last.slice(8))}, ${year}`
  }
  if (first.slice(0, 4) === year) {
    return `${formatDay(first, { month: 'short', day: 'numeric' })} – ${formatDay(last, { month: 'short', day: 'numeric' })}, ${year}`
  }
  const withYear: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  return `${formatDay(first, withYear)} – ${formatDay(last, withYear)}`
}

function outcomeLabel(value: string): string {
  const outcome = meetingOutcomes.find(o => o === value)
  return outcome ? MEETING_OUTCOME_LABELS[outcome] : value
}

function meetingOrderLabel(value: string): string {
  const order = MEETING_ORDERS.find(o => o === value)
  return order ? MEETING_ORDER_LABELS[order] : value
}

export function groupLabel(groupBy: AnalyticsGroupBy, key: string | null, names: AnalyticsNames): string {
  switch (groupBy) {
    case 'total':
      return 'Total'
    case 'leadSource':
      return key === null ? 'Unknown source' : names.sourceName(key)
    case 'month':
      return key === null ? 'Undated' : formatMonthLabel(key)
    case 'closer':
      return key === null ? 'Unassigned' : names.closerName(key)
    case 'outcome':
      return key === null ? 'Unknown' : outcomeLabel(key)
    case 'meetingOrder':
      return key === null ? 'Unknown' : meetingOrderLabel(key)
    case 'city':
      return key ?? 'Unknown city'
    case 'zip':
      return key ?? 'Unknown zip'
  }
}

export function filterValueLabel(key: FilterKey, value: string, names: AnalyticsNames): string {
  const unknown = value === UNKNOWN_FILTER_VALUE
  switch (key) {
    case 'source':
      return unknown ? 'Unknown source' : names.sourceName(value)
    case 'city':
      return unknown ? 'Unknown city' : value
    case 'zip':
      return unknown ? 'Unknown zip' : `Zip ${value}`
    case 'closer':
      return names.closerName(value)
    case 'outcome':
      return outcomeLabel(value)
    case 'order':
      return meetingOrderLabel(value)
  }
}
```

(Finding the key in its tuple replaces `as MeetingOutcome` casts: a group key is a plain string, so it is narrowed, not asserted.)

Create `src/features/analytics/lib/hygiene-links.ts`:

```ts
import type { AnalyticsHygiene } from '@/features/analytics/types'
import type { ProposalKind } from '@/shared/constants/enums/proposals'

import { ROOTS } from '@/shared/config/roots'
import { SALE_STATUS } from '@/shared/modules/proposals/core/lib/sale'

/**
 * Each count opens its records table already filtered to the rows to fix;
 * unknown city/zip has no customers filter yet. `asOf` is the report's own
 * instant, so the link is identical on the server and in the browser.
 */
export function hygieneHref(key: keyof AnalyticsHygiene, asOf: string): string | null {
  switch (key) {
    case 'meetingsWithoutOutcome':
      return `${ROOTS.dashboard.meetings.root()}?${new URLSearchParams({ pm_outcome: 'not_set', pm_scheduledFor: JSON.stringify({ to: asOf }) })}`
    case 'undatedSales':
      return `${ROOTS.dashboard.proposals.root()}?${new URLSearchParams({ pp_status: SALE_STATUS, pp_missingApprovedAt: 'true' })}`
    case 'newSalesWithoutProject':
      return `${ROOTS.dashboard.proposals.root()}?${new URLSearchParams({ pp_kind: 'initial-sale' satisfies ProposalKind, pp_status: SALE_STATUS, pp_noProject: 'true' })}`
    case 'unknownCityZip':
      return null
  }
}
```

Create `src/features/analytics/lib/filter-update.ts`:

```ts
import type { AnalyticsUrlState, FilterKey } from '@/features/analytics/constants/query-parsers'

import { MEETING_ORDERS } from '@/features/analytics/constants/dimensions'
import { meetingOutcomes } from '@/shared/constants/enums/meetings'

/** A multi-select hands back plain strings; outcome and meeting-order keys keep only the values their parsers accept. */
export function filterUpdate(key: FilterKey, values: readonly string[]): Partial<AnalyticsUrlState> {
  switch (key) {
    case 'source':
      return { source: [...values] }
    case 'city':
      return { city: [...values] }
    case 'zip':
      return { zip: [...values] }
    case 'closer':
      return { closer: [...values] }
    case 'outcome':
      return { outcome: meetingOutcomes.filter(o => values.includes(o)) }
    case 'order':
      return { order: MEETING_ORDERS.filter(o => values.includes(o)) }
  }
}
```

Create `src/features/analytics/lib/filter-fields.ts`:

```ts
import type { FilterKey } from '@/features/analytics/constants/query-parsers'
import type { AnalyticsFilterOptions } from '@/features/analytics/dal/server/get-analytics-filter-options'
import type { FilterDefinition } from '@/shared/dal/client/lib/types'

import { MEETING_ORDERS } from '@/features/analytics/constants/dimensions'
import { MEETING_ORDER_LABELS } from '@/features/analytics/constants/labels'
import { UNKNOWN_FILTER_VALUE } from '@/features/analytics/constants/query-parsers'
import { meetingOutcomes } from '@/shared/constants/enums/meetings'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'

export interface FilterField {
  key: FilterKey
  definition: Extract<FilterDefinition, { type: 'multi-select' }>
}

/** One multi-select per filter key, shaped for the shared `MultiSelectFilterControl`; "unknown" is always a choice for place and source. */
export function buildFilterFields(options: AnalyticsFilterOptions | undefined, closers: readonly { id: string, name: string }[]): FilterField[] {
  const field = (key: FilterKey, label: string, choices: { value: string, label: string }[]): FilterField => ({ key, definition: { id: key, type: 'multi-select', label, options: choices } })
  return [
    field('source', 'Lead source', [
      ...(options?.leadSources ?? []).map(s => ({ value: s.id, label: s.archived ? `${s.name} (archived)` : s.name })),
      { value: UNKNOWN_FILTER_VALUE, label: 'Unknown source' },
    ]),
    field('city', 'City', [...(options?.cities ?? []).map(c => ({ value: c, label: c })), { value: UNKNOWN_FILTER_VALUE, label: 'Unknown city' }]),
    field('zip', 'Zip', [...(options?.zips ?? []).map(z => ({ value: z, label: z })), { value: UNKNOWN_FILTER_VALUE, label: 'Unknown zip' }]),
    field('closer', 'Closer', closers.map(u => ({ value: u.id, label: u.name }))),
    field('outcome', 'Meeting outcome', meetingOutcomes.map(o => ({ value: o, label: MEETING_OUTCOME_LABELS[o] }))),
    field('order', 'Meeting order', MEETING_ORDERS.map(o => ({ value: o, label: MEETING_ORDER_LABELS[o] }))),
  ]
}
```

(`import type` from a `dal/server` file is type-only and is the house norm; Spec A's `types/index.ts` does the same.)

Create `src/features/analytics/lib/spend-grid-rows.ts`:

```ts
import type { MissingSpend } from '@/features/analytics/lib/analytics-rules'
import type { LeadSourceSpendMode } from '@/shared/constants/enums/lead-sources'
import type { LeadSourceSpendEntry } from '@/shared/entities/lead-sources/dal/server/spend'

export interface SpendGridSource {
  id: string
  name: string
  spendMode: LeadSourceSpendMode
  archived: boolean
}

/**
 * Paid sources get a row. An archived paid source keeps its row while it still
 * owes spend or has spend entered in these months, or its warning could never
 * be cleared. Free sources are listed apart; archived free ones are hidden.
 */
export function spendGridRows(
  sources: readonly SpendGridSource[],
  entries: readonly LeadSourceSpendEntry[],
  missing: readonly MissingSpend[],
): { tracked: SpendGridSource[], free: SpendGridSource[] } {
  const stillRelevant = new Set([...missing.map(m => m.leadSourceId), ...entries.map(e => e.leadSourceId)])
  return {
    tracked: sources.filter(s => s.spendMode === 'manual' && (!s.archived || stillRelevant.has(s.id))),
    free: sources.filter(s => s.spendMode === 'none' && !s.archived),
  }
}
```

Create `src/features/analytics/lib/parse-dollars.ts`:

```ts
/** A blank cell is "not entered" (null), which analytics treats differently from $0. */
export function parseDollarsToCents(text: string): number | null | 'invalid' {
  const cleaned = text.trim().replace(/^\$/, '').replace(/,/g, '').trim()
  if (cleaned === '') {
    return null
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) {
    return 'invalid'
  }
  return Math.round(Number(cleaned) * 100)
}

export function formatCentsForInput(cents: number): string {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm tsx scripts/verify-analytics-rules.ts`
Expected: sections 1–15 ✓, then `✅ verify-analytics-rules passed`.

- [ ] **Step 6: Gates and commit**

Run: `pnpm exec eslint --fix src/features/analytics scripts/verify-analytics-rules.ts && pnpm tsc && pnpm lint && pnpm tsx scripts/verify-analytics-rules.ts`
Expected: clean. If nuqs's `inferParserType` is not exported from `nuqs/server` in the installed version, import it from `nuqs` (type-only).

```bash
git add src/features/analytics/constants/tabs.ts src/features/analytics/constants/metrics.ts src/features/analytics/constants/labels.ts src/features/analytics/constants/query-parsers.ts src/features/analytics/lib/to-report-input.ts src/features/analytics/lib/read-metric.ts src/features/analytics/lib/breakdown-columns.ts src/features/analytics/lib/trend-points.ts src/features/analytics/lib/format-analytics.ts src/features/analytics/lib/hygiene-links.ts src/features/analytics/lib/filter-update.ts src/features/analytics/lib/filter-fields.ts src/features/analytics/lib/spend-grid-rows.ts src/features/analytics/lib/parse-dollars.ts scripts/verify-analytics-rules.ts
git commit -m "$(cat <<'EOF'
feat(analytics): page state — URL parsers, tab and metric catalogs, pure display and link helpers

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7b: Hooks, guard, nav and the view shell

**Files:**
- Create: `src/features/analytics/hooks/use-analytics-url-state.ts`, `use-analytics-labels.ts`
- Create: `src/features/analytics/ui/views/analytics-view.tsx`
- Create: `src/features/analytics/ui/components/filter-bar/analytics-filter-bar.tsx`, `period-picker.tsx`, `analytics-filters-control.tsx`, `analytics-filters-form.tsx`, `active-filter-chips.tsx`
- Create: `src/features/analytics/ui/components/analytics-tabs-list.tsx`, `report-skeleton.tsx`, `projects-placeholder.tsx`
- Modify: `src/app/(frontend)/dashboard/analytics/page.tsx`
- Modify: `src/features/agent-dashboard/lib/get-sidebar-nav.ts:113`

**Interfaces:**
- Consumes: Task 7a; the router (Task 5).
- Produces: `useAnalyticsUrlState()`, `useAnalyticsLabels()` → `AnalyticsNames & { options: AnalyticsFilterOptions | undefined, closers: { id: string, name: string }[] }`; `<ReportSkeleton />`; `<AnalyticsView />` rendering shadcn `Tabs` with one `TabsContent` per tab (Tasks 8 and 9 fill the report and spend panels).

UI components have no unit tests in this repo; the gates plus Step 7's browser look are the check. The logic they rely on is tested in section 15.

- [ ] **Step 1: Write the hooks**

Create `src/features/analytics/hooks/use-analytics-url-state.ts`:

```ts
'use client'

import { useQueryStates } from 'nuqs'

import { analyticsSearchParams } from '@/features/analytics/constants/query-parsers'

export function useAnalyticsUrlState() {
  return useQueryStates(analyticsSearchParams)
}
```

Create `src/features/analytics/hooks/use-analytics-labels.ts`:

```ts
'use client'

import type { AnalyticsFilterOptions } from '@/features/analytics/dal/server/get-analytics-filter-options'
import type { AnalyticsNames } from '@/features/analytics/lib/format-analytics'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { useTRPC } from '@/trpc/helpers'

export function useAnalyticsLabels(): AnalyticsNames & { options: AnalyticsFilterOptions | undefined, closers: { id: string, name: string }[] } {
  const trpc = useTRPC()
  const options = useQuery(trpc.analyticsRouter.filterOptions.queryOptions())
  const users = useQuery(trpc.meetingsRouter.reads.getInternalUsers.queryOptions())
  return useMemo(() => {
    const sources = new Map((options.data?.leadSources ?? []).map(s => [s.id, s.name]))
    const closers = users.data ?? []
    const closerNames = new Map(closers.map(u => [u.id, u.name]))
    return {
      options: options.data,
      closers,
      sourceName: id => sources.get(id) ?? 'Unknown source',
      // A closer who left, or whose role changed, still owns their old meetings.
      closerName: id => closerNames.get(id) ?? 'Former user',
    }
  }, [options.data, users.data])
}
```

- [ ] **Step 2: The shell components**

Create `src/features/analytics/ui/components/report-skeleton.tsx`:

```tsx
import { Skeleton } from '@/shared/components/ui/skeleton'

export function ReportSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the report" className="flex flex-col gap-6">
      <Skeleton className="h-20 w-full" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  )
}
```

Create `src/features/analytics/ui/components/projects-placeholder.tsx`:

```tsx
import { EmptyState } from '@/shared/components/states/empty-state'

export function ProjectsPlaceholder() {
  return <EmptyState title="Projects are not available yet" description="Project figures arrive with the project-management feature." />
}
```

Create `src/features/analytics/ui/components/analytics-tabs-list.tsx` (rendered inside the view's `Tabs`, so the triggers point at real `TabsContent` panels):

```tsx
'use client'

import { ANALYTICS_TABS, TAB_LABELS } from '@/features/analytics/constants/tabs'
import { TabsList, TabsTrigger } from '@/shared/components/ui/tabs'

interface Props {
  spendMissing: boolean
}

export function AnalyticsTabsList({ spendMissing }: Props) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <TabsList className="w-full min-w-max justify-start">
        {ANALYTICS_TABS.filter(t => t !== 'spend').map(t => (
          <TabsTrigger key={t} value={t} className="min-h-11">{TAB_LABELS[t]}</TabsTrigger>
        ))}
        <TabsTrigger value="spend" className="ml-auto min-h-11 gap-1.5">
          {TAB_LABELS.spend}
          {spendMissing && <span role="img" aria-label="Spend missing for some months" className="size-2 rounded-full bg-warning" />}
        </TabsTrigger>
      </TabsList>
    </div>
  )
}
```

- [ ] **Step 3: The filter bar (`ui/components/filter-bar/`)**

Create `src/features/analytics/ui/components/filter-bar/period-picker.tsx`:

```tsx
'use client'

import { ANALYTICS_PERIODS } from '@/features/analytics/constants/dimensions'
import { PERIOD_LABELS } from '@/features/analytics/constants/labels'
import { useAnalyticsUrlState } from '@/features/analytics/hooks/use-analytics-url-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { useIsMobile } from '@/shared/hooks/use-mobile'

interface Props {
  firstDay: string | undefined
  lastDay: string | undefined
}

export function PeriodPicker({ firstDay, lastDay }: Props) {
  const [{ period }, setUrlState] = useAnalyticsUrlState()
  const isMobile = useIsMobile()
  const choose = (value: string) => {
    const next = ANALYTICS_PERIODS.find(p => p === value)
    if (!next) {
      return
    }
    // A custom period starts from the range on screen, so switching never jumps the numbers.
    void setUrlState(next === 'custom' ? { period: next, from: firstDay ?? '', to: lastDay ?? '' } : { period: next, from: null, to: null })
  }

  if (isMobile) {
    return (
      <Select value={period} onValueChange={choose}>
        <SelectTrigger className="w-44" aria-label="Period">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ANALYTICS_PERIODS.map(p => <SelectItem key={p} value={p}>{PERIOD_LABELS[p]}</SelectItem>)}
        </SelectContent>
      </Select>
    )
  }
  return (
    <ToggleGroup type="single" size="sm" variant="outline" value={period} onValueChange={choose} aria-label="Period">
      {ANALYTICS_PERIODS.map(p => <ToggleGroupItem key={p} value={p}>{PERIOD_LABELS[p]}</ToggleGroupItem>)}
    </ToggleGroup>
  )
}
```

Create `src/features/analytics/ui/components/filter-bar/analytics-filters-form.tsx` (reuses the records toolbar's `MultiSelectFilterControl`):

```tsx
'use client'

import { useAnalyticsLabels } from '@/features/analytics/hooks/use-analytics-labels'
import { useAnalyticsUrlState } from '@/features/analytics/hooks/use-analytics-url-state'
import { buildFilterFields } from '@/features/analytics/lib/filter-fields'
import { filterUpdate } from '@/features/analytics/lib/filter-update'
import { MultiSelectFilterControl } from '@/shared/components/query-toolbar/ui/filter-controls/multi-select-filter-control'
import { Label } from '@/shared/components/ui/label'

export function AnalyticsFiltersForm() {
  const [state, setUrlState] = useAnalyticsUrlState()
  const labels = useAnalyticsLabels()
  return (
    <div className="flex flex-col gap-4">
      {buildFilterFields(labels.options, labels.closers).map(({ key, definition }) => (
        <div key={key} className="flex flex-col gap-1.5">
          <Label>{definition.label}</Label>
          <MultiSelectFilterControl
            definition={definition}
            value={state[key]}
            onChange={values => void setUrlState(filterUpdate(key, values ?? []))}
          />
        </div>
      ))}
    </div>
  )
}
```

Create `src/features/analytics/ui/components/filter-bar/analytics-filters-control.tsx` (sheet below `lg`, like the records filter panel in `query-toolbar.tsx`):

```tsx
'use client'

import { FilterIcon } from 'lucide-react'

import { AnalyticsFiltersForm } from '@/features/analytics/ui/components/filter-bar/analytics-filters-form'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/components/ui/sheet'
import { useIsBelowLg } from '@/shared/hooks/use-is-below-lg'

interface Props {
  activeCount: number
}

export function AnalyticsFiltersControl({ activeCount }: Props) {
  const isBelowLg = useIsBelowLg()
  const trigger = (
    <Button variant="outline" size="sm" className="gap-1.5">
      <FilterIcon className="size-4" aria-hidden="true" />
      Filters
      {activeCount > 0 && <span className="tabular-nums text-primary">{activeCount}</span>}
    </Button>
  )
  if (isBelowLg) {
    return (
      <Sheet>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            <AnalyticsFiltersForm />
          </div>
        </SheetContent>
      </Sheet>
    )
  }
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <AnalyticsFiltersForm />
      </PopoverContent>
    </Popover>
  )
}
```

(`PopoverContent` already carries the frosted glass surface, `GLASS_SURFACE_STYLE`.)

Create `src/features/analytics/ui/components/filter-bar/active-filter-chips.tsx`:

```tsx
'use client'

import { XIcon } from 'lucide-react'

import { CLEARED_FILTERS, FILTER_KEYS } from '@/features/analytics/constants/query-parsers'
import { useAnalyticsLabels } from '@/features/analytics/hooks/use-analytics-labels'
import { useAnalyticsUrlState } from '@/features/analytics/hooks/use-analytics-url-state'
import { filterUpdate } from '@/features/analytics/lib/filter-update'
import { filterValueLabel } from '@/features/analytics/lib/format-analytics'
import { Button } from '@/shared/components/ui/button'

export function ActiveFilterChips() {
  const [state, setUrlState] = useAnalyticsUrlState()
  const labels = useAnalyticsLabels()
  const chips = FILTER_KEYS.flatMap((key) => {
    const values: readonly string[] = state[key]
    return values.map(value => ({ key, value, rest: values.filter(v => v !== value), label: filterValueLabel(key, value, labels) }))
  })
  if (chips.length === 0) {
    return null
  }
  return (
    <ul aria-label="Active filters" className="flex flex-wrap gap-2">
      {chips.map(chip => (
        <li key={`${chip.key}:${chip.value}`}>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 gap-1 rounded-full"
            aria-label={`Remove ${chip.label}`}
            onClick={() => void setUrlState(filterUpdate(chip.key, chip.rest))}
          >
            {chip.label}
            <XIcon className="size-3" aria-hidden="true" />
          </Button>
        </li>
      ))}
      <li>
        <Button variant="ghost" size="sm" className="h-7" onClick={() => void setUrlState(CLEARED_FILTERS)}>
          Clear all
        </Button>
      </li>
    </ul>
  )
}
```

Create `src/features/analytics/ui/components/filter-bar/analytics-filter-bar.tsx`:

```tsx
'use client'

import { FILTER_KEYS } from '@/features/analytics/constants/query-parsers'
import { useAnalyticsUrlState } from '@/features/analytics/hooks/use-analytics-url-state'
import { formatDayRange } from '@/features/analytics/lib/format-analytics'
import { ActiveFilterChips } from '@/features/analytics/ui/components/filter-bar/active-filter-chips'
import { AnalyticsFiltersControl } from '@/features/analytics/ui/components/filter-bar/analytics-filters-control'
import { PeriodPicker } from '@/features/analytics/ui/components/filter-bar/period-picker'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'

interface Props {
  firstDay: string | undefined
  lastDay: string | undefined
}

export function AnalyticsFilterBar({ firstDay, lastDay }: Props) {
  const [state, setUrlState] = useAnalyticsUrlState()
  const activeCount = FILTER_KEYS.reduce((count, key) => count + state[key].length, 0)
  return (
    <section aria-label="Filters" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <PeriodPicker firstDay={firstDay} lastDay={lastDay} />
        {firstDay && lastDay && <span className="text-sm tabular-nums text-muted-foreground">{formatDayRange(firstDay, lastDay)}</span>}
        <div className="ml-auto">
          <AnalyticsFiltersControl activeCount={activeCount} />
        </div>
      </div>
      {state.period === 'custom' && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="analytics-from">From</Label>
            <Input id="analytics-from" type="date" className="w-44" value={state.from} onChange={e => void setUrlState({ from: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="analytics-to">To</Label>
            <Input id="analytics-to" type="date" className="w-44" value={state.to} onChange={e => void setUrlState({ to: e.target.value })} />
          </div>
        </div>
      )}
      <ActiveFilterChips />
    </section>
  )
}
```

- [ ] **Step 4: The view**

Create `src/features/analytics/ui/views/analytics-view.tsx`. Each tab body sits in its own `TabsContent` (like `campaigns-view.tsx` and `calculators-view.tsx`). Task 8 replaces the report panels' skeleton and Task 9 the Spend placeholder, so this task ships a working shell:

```tsx
'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { ANALYTICS_TABS, REPORT_TAB_KEYS } from '@/features/analytics/constants/tabs'
import { useAnalyticsUrlState } from '@/features/analytics/hooks/use-analytics-url-state'
import { toReportInput } from '@/features/analytics/lib/to-report-input'
import { AnalyticsTabsList } from '@/features/analytics/ui/components/analytics-tabs-list'
import { AnalyticsFilterBar } from '@/features/analytics/ui/components/filter-bar/analytics-filter-bar'
import { ProjectsPlaceholder } from '@/features/analytics/ui/components/projects-placeholder'
import { ReportSkeleton } from '@/features/analytics/ui/components/report-skeleton'
import { Tabs, TabsContent } from '@/shared/components/ui/tabs'
import { useHydrationParityCheck } from '@/shared/dal/client/hooks/use-hydration-parity-check'
import { useTRPC } from '@/trpc/helpers'

export function AnalyticsView() {
  const trpc = useTRPC()
  const [urlState, setUrlState] = useAnalyticsUrlState()
  const reportOptions = trpc.analyticsRouter.report.queryOptions(toReportInput(urlState))
  useHydrationParityCheck(reportOptions.queryKey)
  const report = useQuery({ ...reportOptions, placeholderData: keepPreviousData })

  const changeTab = (value: string) => {
    const next = ANALYTICS_TABS.find(t => t === value)
    if (next) {
      void setUrlState({ tab: next, groupBy: null, focus: null })
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">How the lead chain is doing, from lead to sale, per source and in total.</p>
      </header>
      <AnalyticsFilterBar firstDay={report.data?.firstDay} lastDay={report.data?.lastDay} />
      <Tabs value={urlState.tab} onValueChange={changeTab} className="flex flex-col gap-6">
        <AnalyticsTabsList spendMissing={(report.data?.spendMissing.length ?? 0) > 0} />
        {REPORT_TAB_KEYS.map(tab => (
          <TabsContent key={tab} value={tab}>
            <ReportSkeleton />
          </TabsContent>
        ))}
        <TabsContent value="projects">
          <ProjectsPlaceholder />
        </TabsContent>
        <TabsContent value="spend">
          <p className="text-sm text-muted-foreground">Spend entry arrives in Task 9.</p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

(`useHydrationParityCheck` is the dev-only detector that proves the page's prefetch and this query share one key: `src/features/campaigns-admin/ui/views/campaigns-overview-view.tsx:18`.)

- [ ] **Step 5: Guard the page, prefetch, and enable the nav item**

Replace `src/app/(frontend)/dashboard/analytics/page.tsx` with (the shape of `src/app/(frontend)/dashboard/campaigns/page.tsx`):

```tsx
import type { SearchParams } from 'nuqs/server'

import { redirect } from 'next/navigation'

import { loadAnalyticsSearchParams } from '@/features/analytics/constants/query-parsers'
import { toReportInput } from '@/features/analytics/lib/to-report-input'
import { AnalyticsView } from '@/features/analytics/ui/views/analytics-view'
import { ROOTS } from '@/shared/config/roots'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { HydrateClient } from '@/trpc/components/hydrate-client'
import { prefetch } from '@/trpc/lib/prefetch'
import { trpc } from '@/trpc/server'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<SearchParams>
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const authState = await protectDashboardPage()

  // Super-admin only. Agents cannot see this page.
  if (authState.status === 'authenticated' && authState.ability.cannot('manage', 'all')) {
    redirect(ROOTS.dashboard.root)
  }

  if (authState.status === 'authenticated') {
    prefetch(trpc.analyticsRouter.report.queryOptions(toReportInput(await loadAnalyticsSearchParams(searchParams))))
  }

  return (
    <HydrateClient>
      <AnalyticsView />
    </HydrateClient>
  )
}
```

In `src/features/agent-dashboard/lib/get-sidebar-nav.ts`, change the Analytics item's `enabled: false` to `enabled: true`.

- [ ] **Step 6: Gates**

Run: `pnpm exec eslint --fix src/features/analytics "src/app/(frontend)/dashboard/analytics/page.tsx" src/features/agent-dashboard/lib/get-sidebar-nav.ts && pnpm tsc && pnpm lint && pnpm tsx scripts/verify-analytics-rules.ts`
Expected: clean.

- [ ] **Step 7: Look at it (read-only)**

Needs the owner's dev push. With `pnpm dev` running (check `ss -ltnp` first), open `/dashboard/analytics` as the Playwright super-admin session. Expected: the Analytics sidebar item is live; the header, period chips with the range text, the Filters popover (source, city, zip, closer, outcome, order all populated), removable chips, and the tabs with Spend at the right. Changing the period or a filter changes the URL, and reloading keeps the state. No hydration-drift warning in the dev console. As an agent session (`&role=agent`), the page redirects to `/dashboard`.

- [ ] **Step 8: Commit**

```bash
git add src/features/analytics/hooks/use-analytics-url-state.ts src/features/analytics/hooks/use-analytics-labels.ts src/features/analytics/ui/views/analytics-view.tsx src/features/analytics/ui/components/analytics-tabs-list.tsx src/features/analytics/ui/components/report-skeleton.tsx src/features/analytics/ui/components/projects-placeholder.tsx src/features/analytics/ui/components/filter-bar/analytics-filter-bar.tsx src/features/analytics/ui/components/filter-bar/period-picker.tsx src/features/analytics/ui/components/filter-bar/analytics-filters-control.tsx src/features/analytics/ui/components/filter-bar/analytics-filters-form.tsx src/features/analytics/ui/components/filter-bar/active-filter-chips.tsx "src/app/(frontend)/dashboard/analytics/page.tsx" src/features/agent-dashboard/lib/get-sidebar-nav.ts
git commit -m "$(cat <<'EOF'
feat(analytics): super-admin analytics page shell — URL state, filter bar, tabs, nav

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Report tabs — headline, focus chart, Data to fix, breakdown

**Files:**
- Create: `src/features/analytics/ui/components/report/metric-text.tsx`, `headline-figure.tsx`, `headline-strip.tsx`, `focus-trend-chart.tsx`, `data-to-fix-panel.tsx`, `breakdown-row.tsx`, `breakdown-table.tsx`, `report-tab-content.tsx`
- Modify: `src/features/analytics/ui/views/analytics-view.tsx`

**Interfaces:**
- Consumes: everything Task 7a produces (`readMetric`, `metricDisplayText`, `sortRowsByMetric`, `breakdownColumns`, `buildTrendPoints`, `hygieneHref`, `HYGIENE_LABELS`, …); `AnalyticsReport`; the shared `ChartTooltipCard`.
- Produces: `<ReportTabContent tab report isError onRetry />`.

UI components have no unit tests in this repo; the gates plus Step 10's browser pass are the check. The logic they rely on is tested in section 15.

- [ ] **Step 1: Metric text**

Create `src/features/analytics/ui/components/report/metric-text.tsx`:

```tsx
import type { MetricDisplay } from '@/features/analytics/lib/read-metric'

import { cn } from '@/shared/lib/utils'

interface Props {
  display: MetricDisplay
  className?: string
}

export function MetricText({ display, className }: Props) {
  switch (display.kind) {
    case 'value':
      return <span className={cn('tabular-nums', className)}>{display.text}</span>
    case 'empty':
      return <span className={cn('text-muted-foreground', className)} title="Nothing to divide by in this period">—</span>
    case 'not_applicable':
      return <span className={cn('text-muted-foreground', className)} title={display.reason}>n/a</span>
    case 'missing':
      return <span className={cn('text-warning', className)} title="Spend not entered for a month with leads">missing</span>
    case 'not_yet':
      return <span className={cn('text-sm font-normal text-muted-foreground', className)} title={`Arrives with ${display.source}`}>not available yet</span>
  }
}
```

- [ ] **Step 2: Headline figure and strip**

Create `src/features/analytics/ui/components/report/headline-figure.tsx` (a raw `button` with `aria-pressed`, like the shared `stat-tile.tsx`; the label is a `span` because a `<p>` such as `BlockEyebrow` is not valid inside a button):

```tsx
import type { HeadlineFigure as HeadlineFigureConfig } from '@/features/analytics/constants/tabs'
import type { NotApplicableReasons } from '@/features/analytics/lib/analytics-rules'
import type { AnalyticsReportRow } from '@/features/analytics/types'

import { METRICS } from '@/features/analytics/constants/metrics'
import { readMetric } from '@/features/analytics/lib/read-metric'
import { MetricText } from '@/features/analytics/ui/components/report/metric-text'
import { cn } from '@/shared/lib/utils'

interface Props {
  figure: HeadlineFigureConfig
  row: AnalyticsReportRow
  reasons: NotApplicableReasons
  selected: boolean
  onSelect: () => void
}

export function HeadlineFigure({ figure, row, reasons, selected, onSelect }: Props) {
  const main = readMetric(figure.metric, row, reasons)
  const sub = figure.sub ? readMetric(figure.sub, row, reasons) : null
  const focusable = main.kind !== 'not_yet'
  return (
    <button
      type="button"
      disabled={!focusable}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-1 px-4 py-3 text-left transition-colors disabled:cursor-default',
        focusable && 'hover:bg-muted/60',
        selected && 'bg-accent shadow-[inset_0_-2px_0_var(--primary)]',
      )}
    >
      <span className={cn('text-xs font-bold uppercase tracking-wider text-muted-foreground', selected && 'text-primary')}>
        {METRICS[figure.metric].label}
      </span>
      <MetricText display={main} className="text-2xl font-semibold" />
      {figure.sub && sub && (
        <span className="text-xs text-muted-foreground">
          {METRICS[figure.sub].label}
          {' '}
          <MetricText display={sub} />
        </span>
      )}
    </button>
  )
}
```

Create `src/features/analytics/ui/components/report/headline-strip.tsx`:

```tsx
'use client'

import type { MetricKey } from '@/features/analytics/constants/metrics'
import type { ReportTabConfig } from '@/features/analytics/constants/tabs'
import type { AnalyticsReport } from '@/features/analytics/types'

import { AlertTriangleIcon } from 'lucide-react'

import { useAnalyticsLabels } from '@/features/analytics/hooks/use-analytics-labels'
import { formatMonthLabel } from '@/features/analytics/lib/format-analytics'
import { readMetric } from '@/features/analytics/lib/read-metric'
import { HeadlineFigure } from '@/features/analytics/ui/components/report/headline-figure'
import { Button } from '@/shared/components/ui/button'

interface Props {
  config: ReportTabConfig
  report: AnalyticsReport
  focus: MetricKey
  onFocus: (metric: MetricKey) => void
  onOpenSpend: () => void
}

export function HeadlineStrip({ config, report, focus, onFocus, onOpenSpend }: Props) {
  const labels = useAnalyticsLabels()
  const reasons = report.notApplicable.headline
  const shown = config.figures.flatMap(f => (f.sub ? [f.metric, f.sub] : [f.metric]))
  const notApplicable = [...new Set(shown.map(key => readMetric(key, report.headline, reasons)).flatMap(d => (d.kind === 'not_applicable' ? [d.reason] : [])))]
  const missing = report.headline.cost.status === 'missing' ? report.headline.cost.missing : []
  return (
    <section aria-label="Headline figures" className="flex flex-col gap-2">
      <div className="grid grid-cols-2 divide-border border-y border-border md:flex md:divide-x">
        {config.figures.map(figure => (
          <HeadlineFigure
            key={figure.metric}
            figure={figure}
            row={report.headline}
            reasons={reasons}
            selected={figure.metric === focus}
            onSelect={() => onFocus(figure.metric)}
          />
        ))}
      </div>
      {notApplicable.map(reason => (
        <p key={reason} className="text-xs text-muted-foreground">
          n/a:
          {' '}
          {reason}
        </p>
      ))}
      {missing.length > 0 && (
        <Button variant="outline" size="sm" className="self-start border-warning text-warning" onClick={onOpenSpend}>
          <AlertTriangleIcon className="size-3.5" aria-hidden="true" />
          Spend missing:
          {' '}
          {missing.map(m => `${labels.sourceName(m.leadSourceId)} ${formatMonthLabel(m.month, 'short')}`).join(', ')}
        </Button>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Focus trend chart**

Create `src/features/analytics/ui/components/report/focus-trend-chart.tsx`. The points come from `buildTrendPoints` (Task 7a) and the tooltip is the shared `ChartTooltipCard`, rendered inline so the file holds one component:

```tsx
'use client'

import type { MetricKey } from '@/features/analytics/constants/metrics'
import type { TrendPoint } from '@/features/analytics/lib/trend-points'
import type { AnalyticsReport } from '@/features/analytics/types'

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { METRICS } from '@/features/analytics/constants/metrics'
import { formatMonthLabel } from '@/features/analytics/lib/format-analytics'
import { formatMetricValue, metricDisplayText } from '@/features/analytics/lib/read-metric'
import { buildTrendPoints } from '@/features/analytics/lib/trend-points'
import { ChartTooltipCard } from '@/shared/components/charts/chart-tooltip-card'

interface Props {
  metric: MetricKey
  report: AnalyticsReport
}

export function FocusTrendChart({ metric, report }: Props) {
  const definition = METRICS[metric]
  const points = buildTrendPoints(report, metric)
  const format = 'format' in definition ? definition.format : 'count'
  return (
    <section aria-label={`${definition.label} by month`} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold">
        {definition.label}
        <span className="font-normal text-muted-foreground"> · last 12 months</span>
      </h2>
      {points.every(p => p.value === null)
        ? <p className="text-sm text-muted-foreground">No monthly figures for this with these filters.</p>
        : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" tickLine={false} stroke="var(--muted-foreground)" className="text-xs" />
                  <YAxis width={64} tickFormatter={(v: number) => formatMetricValue(v, format)} stroke="var(--muted-foreground)" className="text-xs" />
                  <Tooltip
                    cursor={{ fill: 'var(--muted)' }}
                    content={({ active, payload }) => {
                      const point: TrendPoint | undefined = payload?.[0]?.payload
                      if (!active || !point) {
                        return null
                      }
                      return <ChartTooltipCard title={formatMonthLabel(point.month)} rows={[{ label: definition.label, value: metricDisplayText(point.display) }]} />
                    }}
                  />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {points.map(p => (
                      <Cell key={p.month} fill={p.selected ? 'var(--primary)' : 'var(--muted-foreground)'} fillOpacity={p.selected ? 1 : 0.35} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
    </section>
  )
}
```

- [ ] **Step 4: Data to fix**

Create `src/features/analytics/ui/components/report/data-to-fix-panel.tsx`. The link cut-off is the report's `generatedAt`, never a `new Date()` here: the panel renders on the server (the report is prefetched) and again in the browser, and both must produce the same `href`:

```tsx
import type { AnalyticsHygiene } from '@/features/analytics/types'

import Link from 'next/link'

import { HYGIENE_LABELS } from '@/features/analytics/constants/labels'
import { hygieneHref } from '@/features/analytics/lib/hygiene-links'
import { formatAsCount } from '@/shared/lib/formatters'

interface Props {
  keys: readonly (keyof AnalyticsHygiene)[]
  hygiene: AnalyticsHygiene
  asOf: string
}

export function DataToFixPanel({ keys, hygiene, asOf }: Props) {
  return (
    <section aria-labelledby="data-to-fix" className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-0.5">
        <h2 id="data-to-fix" className="text-sm font-semibold">Data to fix</h2>
        <p className="text-xs text-muted-foreground">All records, not narrowed by these filters.</p>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {keys.map((key) => {
          const count = hygiene[key]
          const href = hygieneHref(key, asOf)
          let value = <span className="tabular-nums text-muted-foreground">0</span>
          if (count > 0) {
            value = href
              ? <Link href={href} className="font-semibold tabular-nums text-primary underline-offset-4 hover:underline">{`${formatAsCount(count)} · Fix`}</Link>
              : <span className="font-semibold tabular-nums text-warning">{formatAsCount(count)}</span>
          }
          return (
            <li key={key} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>{HYGIENE_LABELS[key]}</span>
              {value}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
```

- [ ] **Step 5: Breakdown**

Create `src/features/analytics/ui/components/report/breakdown-row.tsx`:

```tsx
import type { MetricKey } from '@/features/analytics/constants/metrics'
import type { NotApplicableReasons } from '@/features/analytics/lib/analytics-rules'
import type { AnalyticsReportRow } from '@/features/analytics/types'

import { readMetric } from '@/features/analytics/lib/read-metric'
import { MetricText } from '@/features/analytics/ui/components/report/metric-text'
import { TableCell, TableRow } from '@/shared/components/ui/table'
import { cn } from '@/shared/lib/utils'

interface Props {
  label: string
  row: AnalyticsReportRow
  reasons: NotApplicableReasons
  columns: readonly MetricKey[]
  focus: MetricKey
  total?: boolean
}

export function BreakdownRow({ label, row, reasons, columns, focus, total = false }: Props) {
  return (
    <TableRow className={cn(total && 'bg-muted/50 font-semibold')}>
      <TableCell className={cn('sticky left-0 z-10 max-w-56 truncate', total ? 'bg-muted' : 'bg-background')}>{label}</TableCell>
      {columns.map(key => (
        <TableCell key={key} className={cn('text-right', key === focus && 'bg-accent/60')}>
          <MetricText display={readMetric(key, row, reasons)} />
        </TableCell>
      ))}
    </TableRow>
  )
}
```

Create `src/features/analytics/ui/components/report/breakdown-table.tsx`:

```tsx
'use client'

import type { MetricKey } from '@/features/analytics/constants/metrics'
import type { ReportTabConfig } from '@/features/analytics/constants/tabs'
import type { AnalyticsGroupBy, AnalyticsReport } from '@/features/analytics/types'

import { GROUP_BY_LABELS } from '@/features/analytics/constants/labels'
import { METRICS } from '@/features/analytics/constants/metrics'
import { useAnalyticsLabels } from '@/features/analytics/hooks/use-analytics-labels'
import { breakdownColumns } from '@/features/analytics/lib/breakdown-columns'
import { groupLabel } from '@/features/analytics/lib/format-analytics'
import { sortRowsByMetric } from '@/features/analytics/lib/read-metric'
import { BreakdownRow } from '@/features/analytics/ui/components/report/breakdown-row'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { cn } from '@/shared/lib/utils'

interface Props {
  config: ReportTabConfig
  report: AnalyticsReport
  focus: MetricKey
  groupBy: Exclude<AnalyticsGroupBy, 'total'>
  onGroupBy: (groupBy: Exclude<AnalyticsGroupBy, 'total'>) => void
}

export function BreakdownTable({ config, report, focus, groupBy, onGroupBy }: Props) {
  const labels = useAnalyticsLabels()
  const columns = breakdownColumns(config)
  const rows = sortRowsByMetric(report.breakdown, focus, report.notApplicable.breakdown)
  return (
    <section aria-labelledby="breakdown" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="breakdown" className="text-lg font-medium">Breakdown</h2>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={groupBy}
          aria-label="Group by"
          onValueChange={(value) => {
            const next = config.groupBys.find(g => g === value)
            if (next) {
              onGroupBy(next)
            }
          }}
        >
          {config.groupBys.map(g => <ToggleGroupItem key={g} value={g}>{GROUP_BY_LABELS[g]}</ToggleGroupItem>)}
        </ToggleGroup>
      </div>
      {report.breakdown.some(r => r.overlapsTotal) && (
        <p className="text-xs text-muted-foreground">A meeting counts for each closer on it, so closer rows add up to more than the total.</p>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-background">{GROUP_BY_LABELS[groupBy]}</TableHead>
              {columns.map(key => (
                <TableHead key={key} className={cn('text-right whitespace-nowrap', key === focus && 'text-primary')}>{METRICS[key].label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <BreakdownRow label="Total" row={report.headline} reasons={report.notApplicable.headline} columns={columns} focus={focus} total />
            {rows.map(row => (
              <BreakdownRow key={row.groupKey ?? 'none'} label={groupLabel(groupBy, row.groupKey, labels)} row={row} reasons={report.notApplicable.breakdown} columns={columns} focus={focus} />
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center text-sm text-muted-foreground">No activity in this period.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Tab content**

Create `src/features/analytics/ui/components/report/report-tab-content.tsx`:

```tsx
'use client'

import type { ReportTab } from '@/features/analytics/constants/tabs'
import type { AnalyticsReport } from '@/features/analytics/types'

import { REPORT_TABS } from '@/features/analytics/constants/tabs'
import { useAnalyticsUrlState } from '@/features/analytics/hooks/use-analytics-url-state'
import { resolveFocus, resolveGroupBy } from '@/features/analytics/lib/to-report-input'
import { BreakdownTable } from '@/features/analytics/ui/components/report/breakdown-table'
import { DataToFixPanel } from '@/features/analytics/ui/components/report/data-to-fix-panel'
import { FocusTrendChart } from '@/features/analytics/ui/components/report/focus-trend-chart'
import { HeadlineStrip } from '@/features/analytics/ui/components/report/headline-strip'
import { ReportSkeleton } from '@/features/analytics/ui/components/report-skeleton'
import { ErrorState } from '@/shared/components/states/error-state'
import { Button } from '@/shared/components/ui/button'

interface Props {
  tab: ReportTab
  report: AnalyticsReport | undefined
  isError: boolean
  onRetry: () => void
}

export function ReportTabContent({ tab, report, isError, onRetry }: Props) {
  const [state, setUrlState] = useAnalyticsUrlState()
  if (!report) {
    if (isError) {
      return (
        <ErrorState title="The report didn't load" description="Nothing was changed. Try again.">
          <Button onClick={onRetry}>Retry</Button>
        </ErrorState>
      )
    }
    return <ReportSkeleton />
  }
  const config = REPORT_TABS[tab]
  const focus = resolveFocus(tab, state.focus)
  return (
    <div className="flex flex-col gap-6">
      <HeadlineStrip
        config={config}
        report={report}
        focus={focus}
        onFocus={metric => void setUrlState({ focus: metric })}
        onOpenSpend={() => void setUrlState({ tab: 'spend' })}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <FocusTrendChart metric={focus} report={report} />
        <DataToFixPanel keys={config.hygiene} hygiene={report.hygiene} asOf={report.generatedAt} />
      </div>
      <BreakdownTable config={config} report={report} focus={focus} groupBy={resolveGroupBy(state)} onGroupBy={groupBy => void setUrlState({ groupBy })} />
    </div>
  )
}
```

- [ ] **Step 7: Wire it into the view**

In `src/features/analytics/ui/views/analytics-view.tsx`, replace the `ReportSkeleton` import with `import { ReportTabContent } from '@/features/analytics/ui/components/report/report-tab-content'` and replace

```tsx
          <TabsContent key={tab} value={tab}>
            <ReportSkeleton />
          </TabsContent>
```

with

```tsx
          <TabsContent key={tab} value={tab}>
            <ReportTabContent tab={tab} report={report.data} isError={report.isError} onRetry={() => void report.refetch()} />
          </TabsContent>
```

- [ ] **Step 8: Gates**

Run: `pnpm exec eslint --fix src/features/analytics && pnpm tsc && pnpm lint && pnpm tsx scripts/verify-analytics-rules.ts`
Expected: clean. If recharts types `payload?.[0]?.payload` as something other than `any` so the `TrendPoint` annotation fails, find the point by label instead (`points.find(p => p.label === label)` from the render function's `label` argument); do not cast.

- [ ] **Step 9: Commit**

```bash
git add src/features/analytics/ui/components/report/metric-text.tsx src/features/analytics/ui/components/report/headline-figure.tsx src/features/analytics/ui/components/report/headline-strip.tsx src/features/analytics/ui/components/report/focus-trend-chart.tsx src/features/analytics/ui/components/report/data-to-fix-panel.tsx src/features/analytics/ui/components/report/breakdown-row.tsx src/features/analytics/ui/components/report/breakdown-table.tsx src/features/analytics/ui/components/report/report-tab-content.tsx src/features/analytics/ui/views/analytics-view.tsx
git commit -m "$(cat <<'EOF'
feat(analytics): report tabs — selectable headline, 12-month focus chart, data to fix, breakdown

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 10: Look at it (read-only)**

On the dev server as the super-admin session, at 1440 wide: every report tab renders; clicking a headline figure moves the cobalt highlight, the chart's metric and the breakdown's sort; "not available yet" figures cannot be clicked; the Overview breakdown by source shows cost per lead, per booked lead, per sit, per sale and revenue per $1; group-by "Closer" shows the overlap note and cost "n/a" in every row; a city filter, or the "Unknown source" filter, shows "n/a" for cost with its reason under the strip; each Data to fix count opens its records table already filtered; the dev console shows no hydration mismatch. At 390 wide: the headline is two-up, the period is a select, Filters opens a bottom sheet, Data to fix sits under the chart, the breakdown scrolls sideways with the first column pinned, and the page itself never scrolls sideways.

---

### Task 9: Spend grid

**Files:**
- Modify: `src/shared/dal/client/hooks/use-invalidation.ts` (`invalidateLeadSource`)
- Modify: `src/shared/entities/lead-sources/hooks/use-lead-source-actions.ts` (`setSpend`)
- Create: `src/features/analytics/ui/components/spend/spend-cell.tsx`, `spend-grid.tsx`
- Modify: `src/features/analytics/ui/views/analytics-view.tsx`

**Interfaces:**
- Consumes: `leadSourcesRouter.spend.grid` / `.spend.set` (Task 1), `leadSourcesRouter.update({ id, spendMode })`; `spendGridRows`, `parseDollarsToCents`, `formatCentsForInput`, `formatMonthLabel` (Task 7a); the report's `spendGridMonths` and `spendMissing` (Task 4).
- Produces: `useLeadSourceActions().setSpend`; `invalidateLeadSource()` also refreshes the analytics report; `<SpendGrid months missing />`.

Lead-source mutations go through the entity's own hook (`useLeadSourceActions`), which refreshes through the central `useInvalidation`; the grid never builds its own `useMutation` or invalidates ad hoc.

- [ ] **Step 1: Lead-source changes refresh the analytics report**

In `src/shared/dal/client/hooks/use-invalidation.ts`, change `invalidateLeadSource` to:

```ts
  function invalidateLeadSource() {
    void qc.invalidateQueries(trpc.leadSourcesRouter.pathFilter())
    // Spend and spend modes feed every cost on the analytics report; its filter options (the whole fact set) do not depend on them.
    void qc.invalidateQueries(trpc.analyticsRouter.report.queryFilter())
  }
```

- [ ] **Step 2: The entity's spend mutation**

In `src/shared/entities/lead-sources/hooks/use-lead-source-actions.ts`, add after `deleteLeadSource`:

```ts
  // Cells save on blur, so a success toast per cell would be noise; only failures speak up.
  const setSpend = useMutation(
    trpc.leadSourcesRouter.spend.set.mutationOptions({
      onSuccess: () => invalidateLeadSource(),
      onError: err => toast.error(err.message || 'Failed to save spend'),
    }),
  )
```

and add `setSpend,` to the returned object.

- [ ] **Step 3: The cell**

Create `src/features/analytics/ui/components/spend/spend-cell.tsx`. It holds only its draft text: the grid owns the mutation and tells the cell when a save settles.

```tsx
'use client'

import { useState } from 'react'

import { formatMonthLabel } from '@/features/analytics/lib/format-analytics'
import { formatCentsForInput, parseDollarsToCents } from '@/features/analytics/lib/parse-dollars'
import { Input } from '@/shared/components/ui/input'
import { cn } from '@/shared/lib/utils'

interface Props {
  sourceName: string
  month: string
  amountCents: number | null
  missing: boolean
  onSave: (amountCents: number | null, done: () => void) => void
}

export function SpendCell({ sourceName, month, amountCents, missing, onSave }: Props) {
  const [text, setText] = useState(amountCents === null ? '' : formatCentsForInput(amountCents))
  const [invalid, setInvalid] = useState(false)
  const [saving, setSaving] = useState(false)
  const onBlur = () => {
    const parsed = parseDollarsToCents(text)
    if (parsed === 'invalid') {
      setInvalid(true)
      return
    }
    setInvalid(false)
    if (parsed !== amountCents) {
      setSaving(true)
      onSave(parsed, () => setSaving(false))
    }
  }
  return (
    <Input
      aria-label={`${sourceName} spend, ${formatMonthLabel(month)}`}
      aria-invalid={invalid}
      title={invalid ? 'Dollars only, like 1200 or 1,200.50' : undefined}
      inputMode="decimal"
      placeholder="—"
      value={text}
      disabled={saving}
      onChange={e => setText(e.target.value)}
      onBlur={onBlur}
      className={cn('h-8 w-24 text-right tabular-nums', missing && text === '' && 'border-warning bg-warning/10')}
    />
  )
}
```

- [ ] **Step 4: The grid**

Create `src/features/analytics/ui/components/spend/spend-grid.tsx`:

```tsx
'use client'

import type { MissingSpend } from '@/features/analytics/lib/analytics-rules'

import { useQuery } from '@tanstack/react-query'
import { MoreHorizontalIcon } from 'lucide-react'

import { formatMonthLabel } from '@/features/analytics/lib/format-analytics'
import { spendGridRows } from '@/features/analytics/lib/spend-grid-rows'
import { ReportSkeleton } from '@/features/analytics/ui/components/report-skeleton'
import { SpendCell } from '@/features/analytics/ui/components/spend/spend-cell'
import { ErrorState } from '@/shared/components/states/error-state'
import { Button } from '@/shared/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { useLeadSourceActions } from '@/shared/entities/lead-sources/hooks/use-lead-source-actions'
import { useTRPC } from '@/trpc/helpers'

interface Props {
  months: string[] | undefined
  missing: MissingSpend[]
}

export function SpendGrid({ months, missing }: Props) {
  const trpc = useTRPC()
  const grid = useQuery({ ...trpc.leadSourcesRouter.spend.grid.queryOptions({ months: months ?? [] }), enabled: !!months?.length })
  const { setSpend, updateLeadSource } = useLeadSourceActions()

  if (!months?.length || grid.isPending) {
    return <ReportSkeleton />
  }
  if (grid.isError) {
    return (
      <ErrorState title="Spend didn't load" description="Nothing was changed. Try again.">
        <Button onClick={() => void grid.refetch()}>Retry</Button>
      </ErrorState>
    )
  }

  const missingKeys = new Set(missing.map(m => `${m.leadSourceId}|${m.month}`))
  const amounts = new Map(grid.data.entries.map(e => [`${e.leadSourceId}|${e.month}`, e.amountCents]))
  const { tracked, free } = spendGridRows(grid.data.sources, grid.data.entries, missing)

  return (
    <section aria-labelledby="spend" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="spend" className="text-lg font-medium">Monthly spend</h2>
        <p className="text-sm text-muted-foreground">Dollars per source per month; each cell saves when you leave it. Blank means not entered. A highlighted blank had leads that month.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-background">Source</TableHead>
              {months.map(month => <TableHead key={month} className="text-right">{formatMonthLabel(month, 'short')}</TableHead>)}
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tracked.map(source => (
              <TableRow key={source.id}>
                <TableCell className="sticky left-0 z-10 max-w-48 truncate bg-background font-medium">
                  {source.name}
                  {source.archived && <span className="font-normal text-muted-foreground"> (archived)</span>}
                </TableCell>
                {months.map((month) => {
                  const key = `${source.id}|${month}`
                  const amount = amounts.get(key) ?? null
                  return (
                    <TableCell key={month} className="p-1">
                      {/* Keyed on the saved amount so a refetch resets the field to what the server holds. */}
                      <SpendCell
                        key={`${key}|${amount ?? ''}`}
                        sourceName={source.name}
                        month={month}
                        amountCents={amount}
                        missing={missingKeys.has(key)}
                        onSave={(amountCents, done) => setSpend.mutate({ leadSourceId: source.id, month, amountCents }, { onSettled: done })}
                      />
                    </TableCell>
                  )
                })}
                <TableCell className="p-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8" aria-label={`${source.name} spend options`}>
                        <MoreHorizontalIcon className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => updateLeadSource.mutate({ id: source.id, spendMode: 'none' })}>Mark as free (no spend)</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {free.length > 0 && (
        <div className="flex flex-col gap-2">
          <div>
            <h3 className="text-sm font-semibold">Free sources</h3>
            <p className="text-xs text-muted-foreground">No spend, and never flagged as missing.</p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {free.map(source => (
              <li key={source.id}>
                <Button variant="outline" size="sm" onClick={() => updateLeadSource.mutate({ id: source.id, spendMode: 'manual' })}>
                  {source.name}
                  <span className="text-muted-foreground"> · Track spend</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 5: Wire it into the view**

In `src/features/analytics/ui/views/analytics-view.tsx`, add `import { SpendGrid } from '@/features/analytics/ui/components/spend/spend-grid'` and replace

```tsx
          <p className="text-sm text-muted-foreground">Spend entry arrives in Task 9.</p>
```

with

```tsx
          <SpendGrid months={report.data?.spendGridMonths} missing={report.data?.spendMissing ?? []} />
```

- [ ] **Step 6: Gates**

Run: `pnpm exec eslint --fix src/features/analytics src/shared/dal/client/hooks/use-invalidation.ts src/shared/entities/lead-sources/hooks/use-lead-source-actions.ts && pnpm tsc && pnpm lint && pnpm tsx scripts/verify-analytics-rules.ts`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/shared/dal/client/hooks/use-invalidation.ts src/shared/entities/lead-sources/hooks/use-lead-source-actions.ts src/features/analytics/ui/components/spend/spend-cell.tsx src/features/analytics/ui/components/spend/spend-grid.tsx src/features/analytics/ui/views/analytics-view.tsx
git commit -m "$(cat <<'EOF'
feat(analytics): spend grid — monthly spend per source, saves on blur, free-source toggle

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Look at it (read-only — do not type into cells)**

Open the Spend tab: paid sources × the report's grid months, blank cells highlighted where that source had leads, the Spend tab's warning dot, the row menu, free sources below, and an archived paid source listed "(archived)" only while it owes spend. **Do not type a value or change a mode** (no test writes). The owner checks saving by hand (Task 10).

---

### Task 10: "View in Analytics" link, glossary, tracker, final verification

**Files:**
- Modify: `src/features/lead-sources-admin/ui/components/lead-source-detail-header.tsx`
- Modify: `CONTEXT.md`
- Modify: `docs/plans/2026-09-26-analytics-epic.md`

- [ ] **Step 1: The link from a lead source to its analytics**

In `lead-source-detail-header.tsx`, add `BarChart3Icon` to the `lucide-react` import and add this item first in the `DropdownMenuContent`:

```tsx
            <DropdownMenuItem onSelect={() => router.push(`${ROOTS.dashboard.analytics()}?source=${source.id}`)}>
              <BarChart3Icon className="size-4" />
              View in Analytics
            </DropdownMenuItem>
```

- [ ] **Step 2: Glossary**

In `CONTEXT.md`, in the analytics terms table (the one with **Business month**, **Closer**, **Unknown city / zip**), add rows in the same format:

```markdown
| **Spend** | Dollars a lead source cost in one business month, typed in on the Analytics Spend tab; a blank month is "not entered", never $0 | `leadSourceMonthlySpendTable` · `src/shared/db/schema/lead-source-monthly-spend.ts` |
| **Spend mode** | `manual` (spend is typed in) or `none` (a free source, never "missing") | `leadSourceSpendModes` · `src/shared/constants/enums/lead-sources.ts` |
| **Spend missing** | A manual source brought a lead in a month with no spend entered, so every cost over that month is unknown | `findMissingSpend` · `src/features/analytics/lib/analytics-rules.ts` |
| **Cost per stage** | Spend ÷ leads, booked leads, sits or new sales; revenue ÷ spend is "revenue per $1". Only for totals, sources or months filtered by source alone, and never over leads with no source | `ANALYTICS_COSTS`, `notApplicableReasons` · `src/features/analytics/lib/analytics-rules.ts` |
| **Merged duplicates** | Extra customer records folded into one person's lead | `mergedRecordCount` · `src/features/analytics/lib/analytics-rules.ts` |
```

If the table's columns differ from this three-column shape, match the table's own shape.

- [ ] **Step 3: Read-only sanity run against prod (throwaway, not committed)**

Only if the owner has already pushed the schema to prod; otherwise skip this step and say so in your report (the report's `listLeadSources` reads `spend_mode`). Recreate Task 5 Step 5's smoke file as `scripts/zz-analytics-report-smoke.ts`, run `DRIZZLE_TARGET=prod pnpm tsx scripts/zz-analytics-report-smoke.ts` (it is `SELECT`-only), and compare by hand with the tracker's §7 tally: all-time hygiene counts ≈ §7's H1–H4, `ytd` leads plausible against ≈ 767 customers. Paste the printed numbers into §7's "Last read" note. Any mismatch beyond duplicate-merging: stop and report it; never adjust a rule to fit. Then `rm scripts/zz-analytics-report-smoke.ts`.

- [ ] **Step 4: Browser pass (read-only)**

As the super-admin Playwright session on the dev server, capture every tab at 1440 and 390, in light and dark (toggle the app theme; do not change data). Confirm: the closer filter shows "n/a" with a reason; the "Spend missing" chip opens the Spend tab; the lead-source menu's "View in Analytics" opens the page filtered to that source; an agent session is redirected away. Put the screenshots in the scratchpad, not the repo.

- [ ] **Step 5: Update the tracker `docs/plans/2026-09-26-analytics-epic.md`**

- §3: tick `E1`–`E3` and `F1`–`F9`, `F11`, `F12` (`[x]`). Leave `F10` open with the note "end-of-epic cleanup spec (C46)".
- §0 row E: Status `[x] shipped with F`. Row F: Plan = `docs/superpowers/plans/2026-09-27-analytics-f-page.md`, Status = `[x] shipped <first-sha>..<last-sha>; pending owner: db:push:prod before deploy, hand-check of spend saving, /impeccable pass`.
- Resolve `I10` (the stub had no super-admin redirect) as fixed by F1.

- [ ] **Step 6: Gates and commit**

Run: `pnpm exec eslint --fix src/features/lead-sources-admin/ui/components/lead-source-detail-header.tsx && pnpm tsx scripts/verify-analytics-rules.ts && pnpm tsc && pnpm lint`
Expected: clean.

```bash
git add src/features/lead-sources-admin/ui/components/lead-source-detail-header.tsx CONTEXT.md docs/plans/2026-09-26-analytics-epic.md
git commit -m "$(cat <<'EOF'
feat(analytics): View in Analytics from a lead source; spend terms in the glossary; tracker

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Hand-off notes for the owner (report, do not act)**

1. `pnpm db:push:prod` must land **before** these commits reach origin/main (the Lead Sources page selects `spend_mode`).
2. Hand-check the spend grid on dev: type a value, tab away, reload; clear it, tab away, reload (blank again); mark a source free and back.
3. Spend is not backfilled: every paid source shows "Spend missing" until the owner enters it, planned for a later session. Free sources (referrals, walk-ins) can be marked free from the grid's row menu at the same time.
4. Next: the thorough `/impeccable` pass on the page, then the end-of-epic F10 cleanup spec.
5. Stale convention docs found while planning (the code disagrees; each needs a separate doc fix, never a code change to match):
   - `docs/codebase-conventions/dal-conventions.md:19-21` says features never hold a `dal/`, but `src/features/analytics/dal/server/` (Spec A, and now F) does; `:44-50` says ctx is always the first argument, but `src/shared/entities/lead-sources/dal/server/queries.ts` takes none.
   - `docs/codebase-conventions/enum-standardization.md:11` points to `src/shared/domains/construction/constants/enums.ts`, which moved to `src/shared/modules/construction/core/constants/enums.ts`; `:94` bans option arrays in features, but `CALCULATOR_TABS` / `CAMPAIGN_TABS` (and now the analytics tuples) live there.
   - `docs/codebase-conventions/frontend-stack.md:17` says components never call tRPC; 42 feature components do.
   - `docs/codebase-conventions/trpc-procedures.md:64,68` cites a `notion.router/` directory that does not exist (today's example is `construction.router/`).
   - `docs/codebase-conventions/database-schema.md:65` says schema imports always go through the barrel; most imports are direct.
