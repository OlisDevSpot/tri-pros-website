# Projects Entity Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every records table is built from one shared table hook and one shared records page. Meetings moves onto them first, then the projects records page is rebuilt on them: a customer and a status column, an expanded row with the project's trades and its sales history, and a one-click portfolio toggle.

**Architecture:** `useEntityTable` (in `shared/components/data-table/lib`) turns a table view, a column registry, a data-view query result and an action list into `{ visibility, dataTableProps }`. Each entity hook (`useMeetingsTable`, `useProjectsTable`) keeps only its query, its action configs, its own meta entries and its dialogs. `EntityRecordsTable` draws header, toolbar and table from that hook result. Every registry reads its row actions from one meta key, `rowActions`. The projects list read moves onto `PROJECT_FIELDS` + `PROJECT_FIELD_SQL` and carries `customerName` and `hasMeetings`. The expanded row's sales history comes from a new `meetingsRouter.reads.listForProject`, built on a meetings-with-proposals builder pulled out of the customer profile read.

**Tech Stack:** Next.js 15 App Router, tRPC v11, Drizzle + Postgres (Neon), Zod 4, TanStack Table/Query, CASL, shadcn/ui, pnpm, `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-28-records-bulk-actions-and-entity-tables-design.md` (§ projects / B5), as amended by the records tracker `docs/plans/2026-09-26-records-management-epic.md` **D49–D52** (2026-10-01). This plan replaces Tasks 11–13 of `docs/superpowers/plans/2026-09-29-records-bulk-actions-setter-projects.md`; that plan's Task 14 (projects bulk) moves to the later all-tables bulk plan (D49).

**Owner decisions from the plan review (2026-10-01):**
1. One shared table hook, `useEntityTable`; entity hooks keep query, configs, meta extras and dialogs.
2. One shared records page, `EntityRecordsTable`; `MeetingsTable` goes.
3. A Status column on projects (bucket badge plus stage, not sortable).
4. Every chosen sort puts empty values last, in `field-sql.ts`, for every table.
5. Agents keep the portfolio toggle for now; the publish-permission gap is noted for #285 (Task 9).
6. The portfolio toggle updates cached list rows optimistically and carries no loading flag.
7. Sales history reads `meetingsRouter.reads.listForProject`, not the whole customer profile; the list row's `hasMeetings` skips the request for a project with no meetings.
8. One meta key, `rowActions`, on a shared `EntityTableMeta<TRow>`; all four registries and their callers move in one task.
9. One expanded-row context type, `EntityExpandedRowContext<TRow>`, and `RenderExpandedRow<TRow>`.

**Corrections kept from the 2026-10-01 code audit (at `fff2c2db`):**
1. Action configs stay on `useStableCallbacks`, never `useMemo` over mutation objects.
2. Row actions in meta are a value array, not a function (render rule in `data-table.tsx`'s `meta` doc comment).
3. No customer pane in the projects panel (D51); a `customerName` column instead, from a customer join on the list read.
4. The meetings panel files (`src/features/records-management/ui/components/meeting-row-panel/*`, `src/features/records-management/hooks/use-meeting-row-panel-data.ts`) carry the owner's uncommitted edits and are **not touched**.
5. `ProjectMeetingList` lives in `src/shared/entities/meetings/components/` (tracker D25).
6. Views keep `DataViewBoundary` and the entity hook runs inside it; `projects-route-pending-view.tsx` is replaced by the view, not broken.
7. `hidden` on action configs + `getVisibleActions` are built here, without the bulk pieces.
8. Colour classes come from status tokens (`TONE_CLASSES` in `src/shared/constants/status-tones.ts`); the `theme-tokens/palette` lint rule rejects raw palette classes.
9. `dashboard-queries.ts` needs no change: `ProjectsListInput` is inferred from the router.

## Global Constraints

- Verification per task: `pnpm tsc` and `pnpm lint`. **Never `pnpm build`.**
- **No database writes for testing** (dev included). Browser checks read and open UI only. A write check (portfolio toggle, delete) runs only on a project the owner designates; a failure path is checked by intercepting the request in Playwright (`page.route`), which writes nothing.
- No unit runner in the repo: pure functions are checked with throwaway `node:test` files under `.superpowers/sdd/2026-10-01-projects-entity-table/tests/` (git-ignored), run from the repo root with `pnpm exec tsx --test <file>`. A file that imports a `server-only` module runs with `NODE_OPTIONS=--conditions=react-server`. Never commit them.
- Browser checks: local Playwright script (memory `reference-playwright-auth.md`: `/api/dev/playwright-session`), screenshots to `.superpowers/sdd/2026-10-01-projects-entity-table/`. Run `ss -ltnp` before touching `.next`.
- Work on `main`; other sessions commit concurrently and the working tree holds the owner's uncommitted edits. Stage by explicit path, never `git add -A`; before each commit run `git diff --cached --stat` and confirm only this task's files are staged. Before editing any file this plan modifies, run `git status --short <file>`; if it shows uncommitted changes you didn't make, stop and ask. Message shape `type(scope): subject`, ending with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Code conventions (memory `coding-conventions.md`): one component per file, named exports, constants in `constants/`, pure helpers in `lib/`, only DAL files import `db`, DAL functions return `DalReturn`. Comments say why, never what; no plan/spec/tracker citations in code.
- Render rules (`data-table.tsx` meta doc): meta function entries are event callbacks; anything a cell reads while rendering is a value; cells never read `table.getState()` / `row.getIsSelected()` while rendering; action config arrays come from `useStableCallbacks`. A function on an action config that runs while rendering (`hidden`) must depend only on its argument.
- Action labels are Title Case ("Open Project", "View on Site", "Show on Portfolio", "Hide from Portfolio").

## Review Focus

1. **A project with no meetings or no customer** (pure portfolio entry): the Customer cell shows "—" and is not a link; the panel's Sales history says "No meetings linked to this project" and the network panel shows no `listForProject` request. Pinned in Task 8 Step 7.
2. **Old URLs keep working.** A URL carrying the column's old sort id (`isPublic`, under the table's `pj` prefix) loads in default order, never a 500 from `defineFieldSql.orderBy`. Pinned in Task 5 Step 7.
3. **Clicking inside a row never toggles it.** The customer name link, the row action menu and controls inside the panel open their own thing without expanding or collapsing the row. Pinned in Task 8 Step 7.
4. **A failed portfolio toggle puts the row back.** When the update fails, the badge and the action flip back and an error toast shows; no cached page is left showing the wrong visibility. Pinned in Task 8 Step 7 (request intercepted to fail, no write).
5. **Empty values sort last both ways.** "Completed" sorted descending lists finished projects first, newest first; unfinished ones follow. Meetings sorts still order as before. Pinned in Task 1 Step 1 (test) and Task 5 Step 7 (browser).

---

### Task 1: Chosen sorts put empty values last

**Files:**
- Modify: `src/shared/dal/server/lib/query/field-sql.ts`
- Test (throwaway): `.superpowers/sdd/2026-10-01-projects-entity-table/tests/field-sql-nulls.test.ts`

**Interfaces:**
- Produces: `defineFieldSql(...).orderBy(sort)` appends `nulls last` to the chosen sort term unless the target is a `NOT NULL` column. The default order and the tie-breaker are unchanged.

- [ ] **Step 1: Write the failing test**

Create `.superpowers/sdd/2026-10-01-projects-entity-table/tests/field-sql-nulls.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { desc, sql } from 'drizzle-orm'
import { PgDialect, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { defineFieldList } from '@/shared/dal/lib/query/field-list'
import { defineFieldSql } from '@/shared/dal/server/lib/query/field-sql'

const things = pgTable('things', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  finishedAt: timestamp('finished_at'),
})

const FIELDS = defineFieldList({
  name: { label: 'Name', sort: true },
  finishedAt: { label: 'Finished', sort: true },
  upper: { label: 'Upper', sort: true },
})

const FIELD_SQL = defineFieldSql(FIELDS, {
  filter: {},
  sort: { name: things.name, finishedAt: things.finishedAt, upper: sql`upper(${things.name})` },
}, { defaultOrder: [desc(things.id)], tieBreaker: things.id })

const render = (sort?: Parameters<typeof FIELD_SQL.orderBy>[0]) =>
  new PgDialect().sqlToQuery(sql.join(FIELD_SQL.orderBy(sort), sql`, `)).sql.toLowerCase()

test('a nullable column sorts its empty values last, both ways', () => {
  assert.match(render({ sortBy: 'finishedAt', sortDir: 'desc' }), /"finished_at" desc nulls last/)
  assert.match(render({ sortBy: 'finishedAt', sortDir: 'asc' }), /"finished_at" asc nulls last/)
})

test('a NOT NULL column stays plain, so its index still serves the order', () => {
  assert.doesNotMatch(render({ sortBy: 'name', sortDir: 'desc' }), /nulls/)
})

test('an expression target sorts its empty values last', () => {
  assert.match(render({ sortBy: 'upper', sortDir: 'desc' }), /desc nulls last/)
})

test('the default order is unchanged', () => {
  assert.doesNotMatch(render(undefined), /nulls/)
})
```

If `defineFieldList` rejects a field with neither `filter` nor a fixed filter, or `filter: {}` fails the map's type, read `src/shared/dal/lib/query/field-list.ts:90-110` and adjust only the test's field shapes.

- [ ] **Step 2: Run it and watch it fail**

Run: `NODE_OPTIONS=--conditions=react-server pnpm exec tsx --test .superpowers/sdd/2026-10-01-projects-entity-table/tests/field-sql-nulls.test.ts`
Expected: the two `nulls last` tests FAIL; the plain and default tests pass.

- [ ] **Step 3: Implement**

In `src/shared/dal/server/lib/query/field-sql.ts`:

- imports become:

```ts
import type { AnyColumn, SQL } from 'drizzle-orm'

import type { FieldList, FilterId, FilterValue, FilterValues, SortDir, SortId, SortState } from '@/shared/dal/lib/query/field-list'
import type { DateRange } from '@/shared/dal/lib/query/range-schemas'

import { and, asc, Column, desc, gte, is, lte, sql } from 'drizzle-orm'
```

(If `SortDir` is not exported from `field-list.ts`, use `'asc' | 'desc'` inline.)

- add above `defineFieldSql`:

```ts
// Postgres sorts NULL first on DESC, which buried every finished project under the unfinished ones.
// A NOT NULL column has no empty values, so it stays plain and its index can still serve the order.
function sortTerm(target: AnyColumn | SQL, dir: SortDir): SQL {
  const ordered = dir === 'asc' ? asc(target) : desc(target)
  return is(target, Column) && target.notNull ? ordered : sql`${ordered} nulls last`
}
```

- in `orderBy`, the `chosen` line becomes:

```ts
      const chosen = sort ? [sortTerm(targets[sort.sortBy], sort.sortDir)] : [...order.defaultOrder]
```

- [ ] **Step 4: Run the test → 4 pass, then type-check and lint**

Run the Step 2 command → 4 pass.
Run: `pnpm tsc && pnpm lint` → clean.

- [ ] **Step 5: Browser read check**

`/dashboard/meetings` (super-admin): sort Scheduled ascending and descending, then Customer: rows order as before, meetings with no scheduled date at the end both ways.

- [ ] **Step 6: Commit**

```bash
git add src/shared/dal/server/lib/query/field-sql.ts
git diff --cached --stat
git commit -m "fix(data-view): a chosen sort puts empty values last in both directions

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: One meta key for row actions

**Files:**
- Create: `src/shared/components/data-table/types/entity-table-meta.ts`
- Modify: `src/shared/entities/meetings/lib/columns-registry.tsx` (`MeetingTableMeta`, the `customerName` cell)
- Modify: `src/shared/modules/projects/core/lib/columns-registry.tsx` (`ProjectTableMeta`, the `title` cell)
- Modify: `src/shared/entities/customers/lib/columns-registry.tsx` (`CustomerTableMeta`, the `name` cell)
- Modify: `src/shared/modules/proposals/core/lib/columns-registry.tsx` (`ProposalTableMeta`, the `label` cell)
- Modify callers: `src/shared/entities/meetings/components/meetings-table/use-meetings-table.tsx`, `src/shared/entities/customers/components/customers-table.tsx`, `src/features/lead-sources-admin/ui/components/all-customers-section.tsx`, `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx`, `src/features/proposal-flow/ui/components/table/index.tsx`, `src/features/project-management/ui/components/table/index.tsx`

**Interfaces:**
- Produces: `EntityTableMeta<TRow> = { rowActions?: EntityActionConfig<TRow>[] }`. `MeetingTableMeta`, `ProjectTableMeta`, `CustomerTableMeta`, `ProposalTableMeta` each `extends EntityTableMeta<TheirRow>` and drop their own `<entity>Actions` key.

- [ ] **Step 1: The base type**

Create `src/shared/components/data-table/types/entity-table-meta.ts`:

```ts
import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'

/** The meta every entity table shares; an entity's meta interface extends it with its own entries. */
export interface EntityTableMeta<TRow> {
  /** The row menu's actions; a value array from `useStableCallbacks`, never a function. */
  rowActions?: EntityActionConfig<TRow>[]
}
```

- [ ] **Step 2: The four registries**

In each registry, import `type { EntityTableMeta } from '@/shared/components/data-table/types/entity-table-meta'`, make the meta interface extend it and delete its actions key, and change the one cell that reads it:

| Registry | Interface becomes | Cell change |
|---|---|---|
| meetings | `export interface MeetingTableMeta extends EntityTableMeta<MeetingRow> {` (drop `meetingActions?`) | `actions={meta?.meetingActions}` → `actions={meta?.rowActions}` |
| projects | `export type ProjectTableMeta = EntityTableMeta<ProjectRow>` (a type alias: an empty `extends` interface fails lint; Task 5 turns it back into an interface when it adds `onViewProfile`) | `actions={meta?.projectActions}` → `actions={meta?.rowActions}` |
| customers | `export interface CustomerTableMeta extends EntityTableMeta<CustomerTableRow> {` (drop `customerActions?`) | `actions={meta?.customerActions}` → `actions={meta?.rowActions}` |
| proposals | `export interface ProposalTableMeta extends EntityTableMeta<ProposalRow> {` (drop `proposalActions?`) | `actions={meta?.proposalActions}` → `actions={meta?.rowActions}` |

Remove the `EntityActionConfig` type import from a registry if `pnpm lint` reports it unused.

- [ ] **Step 3: The callers**

In each caller's `useMemo<…TableMeta>` block, rename the key, keeping the value:

- `use-meetings-table.tsx`: `meetingActions: actions,` → `rowActions: actions,`
- `customers-table.tsx`, `all-customers-section.tsx`, `lead-source-customers-section.tsx`: `customerActions: actions,` → `rowActions: actions,`
- `proposal-flow/ui/components/table/index.tsx`: `proposalActions: sharedActions,` → `rowActions: sharedActions,`
- `project-management/ui/components/table/index.tsx`: `projectActions: sharedActions,` → `rowActions: sharedActions,` (this file is deleted in Task 5; it moves here so the tree type-checks between tasks)

Run: `grep -rnE "(meeting|project|customer|proposal)Actions\?:|meta\?\.(meeting|project|customer|proposal)Actions|^\s+(meeting|project|customer|proposal)Actions: " src`
Expected: no hits. (Local variables such as `const { actions: projectActions }` in cards and `get-action-queue.ts`'s `proposalActions` are not meta keys; the pattern skips them.)

- [ ] **Step 4: Type-check, lint, browser read check**

Run: `pnpm tsc && pnpm lint` → clean.

Browser (super-admin): the row menu (the ⋯ beside the primary cell) still opens with the same items on `/dashboard/meetings`, `/dashboard/projects`, `/dashboard/proposals`, `/dashboard/customers`, and on the lead-source admin's customer tables.

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/data-table/types/entity-table-meta.ts src/shared/entities/meetings/lib/columns-registry.tsx src/shared/modules/projects/core/lib/columns-registry.tsx src/shared/entities/customers/lib/columns-registry.tsx src/shared/modules/proposals/core/lib/columns-registry.tsx src/shared/entities/meetings/components/meetings-table/use-meetings-table.tsx src/shared/entities/customers/components/customers-table.tsx src/features/lead-sources-admin/ui/components/all-customers-section.tsx src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx src/features/proposal-flow/ui/components/table/index.tsx src/features/project-management/ui/components/table/index.tsx
git diff --cached --stat
git commit -m "refactor(data-table): every entity table reads its row actions from one meta key

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The shared table hook and records page; meetings moves onto them

**Files:**
- Create: `src/shared/components/data-table/types/entity-expanded-row.ts`
- Create: `src/shared/components/data-table/lib/use-entity-table.ts`
- Create: `src/shared/components/entity-records-table.tsx`
- Modify: `src/shared/entities/meetings/components/meetings-table/use-meetings-table.tsx`
- Create: `src/features/records-management/ui/components/meetings-records-table.tsx`
- Modify: `src/features/records-management/ui/views/meetings-records-view.tsx`
- Delete: `src/shared/entities/meetings/components/meetings-table/meetings-table.tsx`

**Interfaces:**
- Consumes: `EntityTableMeta<TRow>` (Task 2).
- Produces:
  - `EntityExpandedRowContext<TRow> = { actions: EntityActionConfig<TRow>[] }`; `RenderExpandedRow<TRow> = (row: TRow, ctx: EntityExpandedRowContext<TRow>) => ReactNode`.
  - `useEntityTable(options: UseEntityTableOptions<TRow, TExtra, F, T>) → { visibility: UseColumnVisibilityResult, dataTableProps: DataTableProps<TRow, TExtra & EntityTableMeta<TRow>> }`.
  - `EntityRecordsTable({ title, entityName, searchPlaceholder, headerActions?, table: { query, visibility, dataTableProps, dialogs } })`.
  - `UseMeetingsTableOptions = { renderExpandedRow?: RenderExpandedRow<MeetingRow> }`; `useMeetingsTable` returns `{ query, visibility, dataTableProps, dialogs }` as before. `MeetingsExpandedRowContext` and `MeetingsTable` no longer exist.
  - `MeetingsRecordsTable({ renderExpandedRow? })`.

Before starting: `git status --short src/features/records-management/ui/views/meetings-records-view.tsx src/shared/entities/meetings/components/meetings-table/` must print nothing. If it prints anything, stop and report. Then take the baseline: `node scripts/perf/records-probe.mjs /dashboard/meetings < /dev/null`, and write its numbers to `.superpowers/sdd/2026-10-01-projects-entity-table/acceptance.md` under "meetings, before Task 3".

- [ ] **Step 1: The expanded-row types**

Create `src/shared/components/data-table/types/entity-expanded-row.ts`:

```ts
import type { ReactNode } from 'react'

import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'

/** What an entity table hands its expanded row: the same action list its row menu uses. */
export interface EntityExpandedRowContext<TRow> {
  actions: EntityActionConfig<TRow>[]
}

/** Define it at module level, so its identity is stable and the table's props don't churn. */
export type RenderExpandedRow<TRow> = (row: TRow, ctx: EntityExpandedRowContext<TRow>) => ReactNode
```

- [ ] **Step 2: The shared hook**

Create `src/shared/components/data-table/lib/use-entity-table.ts`:

```ts
'use client'

import type { ColumnRegistry } from '@/shared/components/data-table/lib/use-entity-columns'
import type { RenderExpandedRow } from '@/shared/components/data-table/types/entity-expanded-row'
import type { EntityTableMeta } from '@/shared/components/data-table/types/entity-table-meta'
import type { EntityTableView } from '@/shared/components/data-table/types/entity-table-view'
import type { DataTableProps } from '@/shared/components/data-table/ui/data-table'
import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList, ToolbarFilterId } from '@/shared/dal/lib/query/field-list'

import { useMemo } from 'react'

import { toDataTablePagination } from '@/shared/components/data-table/lib/to-data-table-pagination'
import { toDataTableSorting } from '@/shared/components/data-table/lib/to-data-table-sorting'
import { useColumnVisibility } from '@/shared/components/data-table/lib/use-column-visibility'
import { useEntityColumns } from '@/shared/components/data-table/lib/use-entity-columns'

export interface UseEntityTableOptions<TRow extends { id: string }, TExtra extends object, F extends FieldList, T extends ToolbarFilterId<F>> {
  tableView: EntityTableView<string, F, T>
  registry: ColumnRegistry<TRow, any>
  query: DataViewQueryResult<TRow, F, T, 'page'>
  actions: EntityActionConfig<TRow>[]
  /** The entity's own meta entries, memoized by the caller; `rowActions` is added from `actions`. */
  meta: TExtra
  renderExpandedRow?: RenderExpandedRow<TRow>
  /** Ignored by `DataTable` while `renderExpandedRow` is set. */
  onRowClick?: (row: TRow) => void
  entityName: string
  rowDataAttribute: string
  skeletonRowClassName?: string
  getRowClassName?: (row: TRow) => string | undefined
}

/** The part of every entity table that isn't about the entity: columns, visibility, meta and the `DataTable` props. */
export function useEntityTable<TRow extends { id: string }, TExtra extends object, F extends FieldList, T extends ToolbarFilterId<F>>({
  tableView,
  registry,
  query,
  actions,
  meta: extra,
  renderExpandedRow,
  onRowClick,
  entityName,
  rowDataAttribute,
  skeletonRowClassName,
  getRowClassName,
}: UseEntityTableOptions<TRow, TExtra, F, T>) {
  const columns = useEntityColumns(registry, { show: tableView.columns })
  const visibility = useColumnVisibility(tableView.tableId, columns)

  const meta = useMemo(() => ({ ...extra, rowActions: actions }), [extra, actions])

  const expandedRowRenderer = useMemo(
    () => renderExpandedRow ? (row: TRow) => renderExpandedRow(row, { actions }) : undefined,
    [renderExpandedRow, actions],
  )

  const dataTableProps = {
    tableId: tableView.tableId,
    data: query.rows,
    columns,
    meta,
    entityName,
    rowDataAttribute,
    skeletonRowClassName,
    getRowClassName,
    renderExpandedRow: expandedRowRenderer,
    onRowClick,
    serverPagination: toDataTablePagination(query),
    serverSorting: toDataTableSorting(query),
    columnVisibility: visibility.columnVisibility,
  } satisfies DataTableProps<TRow, TExtra & EntityTableMeta<TRow>>

  return { visibility, dataTableProps }
}
```

If `useEntityColumns(registry, …)` returns `ColumnDef<unknown>[]` instead of `ColumnDef<TRow>[]`, export `RegistryRow` from `use-entity-columns.tsx` and type `registry` as `R extends ColumnRegistry<TRow, any>` with `RegistryRow<R>` = `TRow`; keep `TRow` as the one row type every option names. If `skeletonRowClassName: undefined` overrides `DataTable`'s default (it destructures with a default, so `undefined` keeps the default), leave it.

- [ ] **Step 3: The shared records page**

Create `src/shared/components/entity-records-table.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'

import type { UseColumnVisibilityResult } from '@/shared/components/data-table/lib/use-column-visibility'
import type { DataTableProps } from '@/shared/components/data-table/ui/data-table'
import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList, ToolbarFilterId } from '@/shared/dal/lib/query/field-list'

import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { RecordsPageHeader } from '@/shared/components/records-page-header'
import { RecordsPageShell } from '@/shared/components/records-page-shell'

export interface EntityRecordsTableSource<TRow extends { id: string }, TMeta, F extends FieldList, T extends ToolbarFilterId<F>> {
  query: DataViewQueryResult<TRow, F, T>
  visibility: UseColumnVisibilityResult
  dataTableProps: DataTableProps<TRow, TMeta>
  dialogs: ReactNode
}

interface EntityRecordsTableProps<TRow extends { id: string }, TMeta, F extends FieldList, T extends ToolbarFilterId<F>> {
  title: string
  /** Plural, for the toolbar's counts ("projects"). */
  entityName: string
  searchPlaceholder: string
  headerActions?: ReactNode
  /** An entity table hook's result, passed whole. */
  table: EntityRecordsTableSource<TRow, TMeta, F, T>
}

/** One records page: the header with its count, the standard toolbar and the table. */
export function EntityRecordsTable<TRow extends { id: string }, TMeta, F extends FieldList, T extends ToolbarFilterId<F>>({
  title,
  entityName,
  searchPlaceholder,
  headerActions,
  table,
}: EntityRecordsTableProps<TRow, TMeta, F, T>) {
  return (
    <>
      {table.dialogs}
      <RecordsPageShell
        header={<RecordsPageHeader title={title} query={table.query} actions={headerActions} />}
        toolbar={(
          <QueryToolbar query={table.query} entityName={entityName}>
            <QueryToolbar.Standard searchPlaceholder={searchPlaceholder} visibility={table.visibility} />
          </QueryToolbar>
        )}
        table={<DataTable {...table.dataTableProps} />}
      />
    </>
  )
}
```

- [ ] **Step 4: `useMeetingsTable` on the shared hook**

In `src/shared/entities/meetings/components/meetings-table/use-meetings-table.tsx`:

1. Delete the `MeetingsExpandedRowContext` interface. `UseMeetingsTableOptions` becomes:

```ts
export interface UseMeetingsTableOptions {
  renderExpandedRow?: RenderExpandedRow<MeetingRow>
}
```

2. Replace everything from `const columns = useEntityColumns(...)` through the closing `} satisfies DataTableProps<MeetingRow, MeetingTableMeta>` with:

```ts
  const meta = useMemo(() => ({
    onUpdateOutcome: (meetingId: string, outcome: MeetingOutcome) => {
      void changeOutcome(meetingId, outcome)
    },
    onUpdateScheduledFor: (meetingId: string, date: Date) =>
      updateScheduledFor.mutate({ id: meetingId, data: { scheduledFor: date.toISOString() } }),
    onAssignRep: (meetingId: string) => setParticipantsMeetingId(meetingId),
    canAssignMeeting: ability.can('assign', 'Meeting'),
    onViewProfile: (customerId: string) => {
      openModal({ accessor: 'CustomerProfile', Component: CustomerProfileModal, props: { customerId } })
    },
  }) satisfies Omit<MeetingTableMeta, 'rowActions'>, [changeOutcome, updateScheduledFor, ability])

  const { visibility, dataTableProps } = useEntityTable({
    tableView,
    registry: MEETING_COLUMNS,
    query,
    actions,
    meta,
    renderExpandedRow,
    onRowClick: handleView,
    entityName: 'meeting',
    rowDataAttribute: 'data-meeting-row',
    skeletonRowClassName: 'h-[58.5px]',
    getRowClassName: getMeetingRowClassName,
  })
```

Keep the meta entries' bodies exactly as they are in the file today (copy them; the block above shows today's entries). `MeetingOutcome` is the type `MeetingTableMeta.onUpdateOutcome` already uses; import it from where the registry imports it.

3. Imports: add `import type { RenderExpandedRow } from '@/shared/components/data-table/types/entity-expanded-row'` and `import { useEntityTable } from '@/shared/components/data-table/lib/use-entity-table'`; remove `ReactNode`, `DataTableProps`, `EntityActionConfig`, `toDataTablePagination`, `toDataTableSorting`, `useColumnVisibility`, `useEntityColumns` and anything else `pnpm lint` reports unused.

4. The `return` stays `return { query, visibility, dataTableProps, dialogs }`. Delete the `MeetingsTableQuery` export if, after Step 6, nothing imports it (`grep -rn "MeetingsTableQuery" src`).

- [ ] **Step 5: The meetings records table and view**

Create `src/features/records-management/ui/components/meetings-records-table.tsx`:

```tsx
'use client'

import type { UseMeetingsTableOptions } from '@/shared/entities/meetings/components/meetings-table/use-meetings-table'

import { MEETINGS_RECORDS_TABLE_VIEW } from '@/features/records-management/constants/meetings-records-table-view'
import { EntityRecordsTable } from '@/shared/components/entity-records-table'
import { useMeetingsTable } from '@/shared/entities/meetings/components/meetings-table/use-meetings-table'

export function MeetingsRecordsTable({ renderExpandedRow }: UseMeetingsTableOptions) {
  const table = useMeetingsTable(MEETINGS_RECORDS_TABLE_VIEW, { renderExpandedRow })
  return <EntityRecordsTable title="Meetings" entityName="meetings" searchPlaceholder="Search by customer or type…" table={table} />
}
```

Replace `src/features/records-management/ui/views/meetings-records-view.tsx` with:

```tsx
'use client'

import type { EntityExpandedRowContext } from '@/shared/components/data-table/types/entity-expanded-row'
import type { MeetingRow } from '@/shared/entities/meetings/lib/columns-registry'

import { MeetingRowPanel } from '@/features/records-management/ui/components/meeting-row-panel'
import { MeetingsRecordsTable } from '@/features/records-management/ui/components/meetings-records-table'
import { DataViewBoundary } from '@/shared/components/data-view-boundary'
import { RecordsPageMotionShell } from '@/shared/components/records-page-motion-shell'

// Module level keeps its identity stable, so the table's props don't churn.
function renderMeetingRowPanel(row: MeetingRow, { actions }: EntityExpandedRowContext<MeetingRow>) {
  return <MeetingRowPanel meeting={row} actions={actions} />
}

export function MeetingsRecordsView() {
  return (
    <RecordsPageMotionShell>
      <DataViewBoundary>
        <MeetingsRecordsTable renderExpandedRow={renderMeetingRowPanel} />
      </DataViewBoundary>
    </RecordsPageMotionShell>
  )
}
```

`git rm src/shared/entities/meetings/components/meetings-table/meetings-table.tsx`.

Run: `grep -rn "MeetingsTable\b\|meetings-table/meetings-table'\|MeetingsExpandedRowContext" src`
Expected: no hits.

- [ ] **Step 6: Type-check, lint, browser and render check**

Run: `pnpm tsc && pnpm lint` → clean.

Browser (super-admin), `/dashboard/meetings`: header count, toolbar (search, filters, columns, page size), rows, row colours, row expand and collapse, the row menu, the customer link opening the profile modal; reload with filters in the URL shows the server rows without a skeleton flash; the sidebar's pending view for Meetings still draws the page.

Render check: `node scripts/perf/records-probe.mjs /dashboard/meetings < /dev/null`. Expanding a row re-renders only that row (the same numbers as before this task). Record them in `.superpowers/sdd/2026-10-01-projects-entity-table/acceptance.md`.

- [ ] **Step 7: Commit**

```bash
git add src/shared/components/data-table/types/entity-expanded-row.ts src/shared/components/data-table/lib/use-entity-table.ts src/shared/components/entity-records-table.tsx src/shared/entities/meetings/components/meetings-table/use-meetings-table.tsx src/features/records-management/ui/components/meetings-records-table.tsx src/features/records-management/ui/views/meetings-records-view.tsx src/shared/entities/meetings/components/meetings-table/meetings-table.tsx
git diff --cached --stat
git commit -m "refactor(records): one shared table hook and records page; meetings is built from them and MeetingsTable goes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Projects list read on a field list, with the customer's name and whether it has meetings

**Files:**
- Create: `src/shared/modules/projects/core/constants/status-labels.ts`
- Create: `src/shared/modules/projects/core/dal/project-fields.ts`
- Create: `src/shared/modules/projects/core/dal/server/project-field-sql.ts`
- Modify: `src/shared/modules/projects/core/dal/server/queries.ts` (`ProjectListInput`, `listProjects`)
- Modify: `src/trpc/routers/projects.router/crud.router.ts` (the `list` procedure)

**Interfaces:**
- Produces: `PROJECT_STATUS_BUCKET_LABELS: Record<ProjectStatusBucket, string>`, `PROJECT_VISIBILITY_LABELS: Record<ProjectVisibility, string>`; `PROJECT_FIELDS` (sortable `title`, `customerName`, `city`, `visibility`, `completedAt`, `createdAt`; toolbar filters `statusBucket`, `visibility`, `completedAt`, `createdAt`; fixed `excludePortfolio`); `PROJECT_FIELD_SQL`; `projectListInputSchema`, `ProjectListInput` (now `z.infer` of the schema); `ProjectListRow = ProjectWithScopeIds & { customerName: string | null, hasMeetings: boolean }`; `crud.list` rows are `ProjectListRow`.

This task commits together with Task 5 (the legacy table stops type-checking here and is deleted there).

- [ ] **Step 1: Labels**

Check the labels the legacy filter config uses first: `grep -n "label" src/features/project-management/constants/project-table-filter-config.ts`. Create `src/shared/modules/projects/core/constants/status-labels.ts` with the same wording:

```ts
import type { ProjectStatusBucket, ProjectVisibility } from '@/shared/constants/enums'

export const PROJECT_STATUS_BUCKET_LABELS: Record<ProjectStatusBucket, string> = {
  active: 'Active',
  completed: 'Completed',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
}

export const PROJECT_VISIBILITY_LABELS: Record<ProjectVisibility, string> = {
  public: 'Public',
  draft: 'Draft',
}
```

If the legacy config words a label differently, use its wording.

- [ ] **Step 2: The field list**

Create `src/shared/modules/projects/core/dal/project-fields.ts`:

```ts
import z from 'zod'

import { projectStatusBuckets, projectVisibilities } from '@/shared/constants/enums'
import { dateRange, defineFieldList, fixedOnly, multiSelect, select } from '@/shared/dal/lib/query/field-list'
import { PROJECT_STATUS_BUCKET_LABELS, PROJECT_VISIBILITY_LABELS } from '@/shared/modules/projects/core/constants/status-labels'

/** Every filterable and sortable projects field; each id is both the URL key suffix and the read's filter/sort key. */
export const PROJECT_FIELDS = defineFieldList({
  title: { label: 'Project', sort: true },
  customerName: { label: 'Customer', sort: true },
  city: { label: 'Location', sort: true },
  statusBucket: { label: 'Status', filter: multiSelect({ values: projectStatusBuckets, optionLabel: bucket => PROJECT_STATUS_BUCKET_LABELS[bucket] }) },
  visibility: { label: 'Visibility', filter: select({ values: projectVisibilities, optionLabel: visibility => PROJECT_VISIBILITY_LABELS[visibility] }), sort: true },
  completedAt: { label: 'Completed', filter: dateRange(), sort: true },
  createdAt: { label: 'Created', filter: dateRange(), sort: true },
  // Showcase-only projects never ran the lifecycle; the dashboard's work counts drop them.
  excludePortfolio: { filter: fixedOnly(z.boolean()) },
})
```

(`meeting-fields.ts` uses the same `multiSelect({ values, optionLabel })` / `select({ values, optionLabel })` shape.)

- [ ] **Step 3: The field SQL**

Create `src/shared/modules/projects/core/dal/server/project-field-sql.ts`:

```ts
import { desc, eq, inArray, sql } from 'drizzle-orm'

import { stagesForBuckets } from '@/shared/constants/enums'
import { dateRangeCondition, defineFieldSql } from '@/shared/dal/server/lib/query/field-sql'
import { customers } from '@/shared/db/schema/customers'
import { projects } from '@/shared/db/schema/projects'
import { PROJECT_FIELDS } from '@/shared/modules/projects/core/dal/project-fields'
import { hasAssociatedMeeting } from '@/shared/modules/projects/core/lib/visibility'
import 'server-only'

export const PROJECT_FIELD_SQL = defineFieldSql(PROJECT_FIELDS, {
  filter: {
    // Null stage groups with Completed, as deriveProjectStatusBucket does.
    statusBucket: v => (v.length > 0 ? inArray(sql`coalesce(${projects.pipelineStage}, 'closed')`, stagesForBuckets(v)) : undefined),
    visibility: v => eq(projects.isPublic, v === 'public'),
    completedAt: v => dateRangeCondition(projects.completedAt, v),
    createdAt: v => dateRangeCondition(projects.createdAt, v),
    excludePortfolio: v => (v ? hasAssociatedMeeting() : undefined),
  },
  sort: {
    title: projects.title,
    // Needs the customers join, which the page query always has.
    customerName: customers.name,
    city: projects.city,
    visibility: projects.isPublic,
    completedAt: projects.completedAt,
    createdAt: projects.createdAt,
  },
}, { defaultOrder: [desc(projects.createdAt)], tieBreaker: projects.id })
```

If `@/shared/db/schema/projects` is not a module path, import `projects` from `@/shared/db/schema` (as `queries.ts` does).

- [ ] **Step 4: `listProjects` on the field list**

In `src/shared/modules/projects/core/dal/server/queries.ts`:

1. Delete the hand-mirrored `ProjectListInput` interface and its doc comment; add in its place:

```ts
export const projectListInputSchema = fieldListInput(PROJECT_FIELDS, { pagination: true })
export type ProjectListInput = z.infer<typeof projectListInputSchema>

export type ProjectListRow = ProjectWithScopeIds & { customerName: string | null, hasMeetings: boolean }
```

2. Replace `listProjects`' doc comment with:

```ts
/** The records table's and the agent dashboard's projects read. Each row carries its `scopeIds`, so a row resolves its trades without a per-row fetch. */
```

3. Change its return type to `Promise<DalReturn<{ rows: ProjectListRow[], total: number }>>`.

4. Replace everything from `const scopeWhere = ctx.scope ?? undefined` through the closing `})` of the `buildOrderBy(...)` call with:

```ts
    const where = and(
      ctx.scope ?? undefined,
      buildSearchWhere(input.search, [projects.title, projects.city, customers.name]),
      PROJECT_FIELD_SQL.where(input.filters),
    )
    const orderBy = PROJECT_FIELD_SQL.orderBy(input.sort)
```

5. The page query becomes (search can match the customer's name, so both queries join):

```ts
    const rows = await db
      .select({
        ...getTableColumns(projects),
        customerName: customers.name,
        // The expanded row skips its sales-history read when there is nothing to show.
        hasMeetings: sql<boolean>`${hasAssociatedMeeting()}`.as('has_meetings'),
      })
      .from(projects)
      .leftJoin(customers, eq(customers.id, projects.customerId))
      .where(where)
      .orderBy(...orderBy)
      .limit(input.pagination.limit)
      .offset(input.pagination.offset)
```

and the count query inside `Promise.all` becomes:

```ts
      db
        .select({ c: count(projects.id) })
        .from(projects)
        .leftJoin(customers, eq(customers.id, projects.customerId))
        .where(where)
        .then(r => r[0]?.c ?? 0),
```

The scope-rows query and the final `rows.map(...)` stay as they are.

6. Imports: add `import type z from 'zod'`, `import { fieldListInput } from '@/shared/dal/server/lib/query/field-list-input'`, `import { buildSearchWhere } from '@/shared/dal/server/lib/query/search'`, `import { PROJECT_FIELDS } from '@/shared/modules/projects/core/dal/project-fields'`, `import { PROJECT_FIELD_SQL } from '@/shared/modules/projects/core/dal/server/project-field-sql'`, and `customers` beside `projects` from `@/shared/db/schema`. Remove `buildFilterWhere`, `buildOrderBy`, `stagesForBuckets` (if now unused), the `ProjectStatusBucket` / `ProjectVisibility` / `DateRange` / `PaginationFields` / `SortFields` type imports, and the `drizzle-orm` helpers `pnpm lint` reports unused (`ilike`, `or`, `gte`, `lte`, …).

Check `buildSearchWhere`'s signature first (`sed -n 1,40p src/shared/dal/server/lib/query/search.ts`) and match it; `listMeetings` calls it the same way. It escapes `%` and `_`; the old `ilike` did not.

- [ ] **Step 5: The router input**

In `src/trpc/routers/projects.router/crud.router.ts` replace the `list` procedure (and its comment) with:

```ts
  list: projectProcedure
    .input(projectListInputSchema)
    .query(async ({ ctx, input }) => dalToTrpc(await listProjects(ctx, input))),
```

Import `projectListInputSchema` beside `listProjects`. Remove the imports left unused (`projectStatusBuckets`, `projectVisibilities`, `dateRangeSchema`, `paginatedQueryInput`); keep `z` (other procedures use it).

- [ ] **Step 6: Type-check**

Run: `pnpm tsc`
Expected: errors only in `src/features/project-management/ui/components/table/index.tsx` and `src/features/project-management/constants/projects-table-query-config.ts` (sort id `isPublic` no longer valid / legacy config shape). `src/features/agent-dashboard/constants/dashboard-queries.ts` must type-check unchanged. Any other error: fix it in this task's files.

Do not commit here.

---

### Task 5: The projects entity table, table view and records view

**Files:**
- Create: `src/shared/modules/projects/core/constants/status-colors.ts`
- Modify: `src/shared/modules/projects/core/lib/columns-registry.tsx`
- Create: `src/shared/modules/projects/core/components/projects-table/use-projects-table.tsx`
- Create: `src/features/records-management/constants/projects-records-table-view.ts`
- Create: `src/features/records-management/ui/components/projects-records-table.tsx`
- Create: `src/features/records-management/ui/views/projects-records-view.tsx`
- Modify: `src/app/(frontend)/dashboard/(records)/projects/page.tsx`
- Modify: `src/features/agent-dashboard/constants/route-pending-views.ts` (the projects entry)
- Delete: `src/features/agent-dashboard/ui/components/projects-route-pending-view.tsx`, `src/features/project-management/ui/components/table/index.tsx`, `src/features/project-management/ui/components/project-detail-sheet.tsx`, `src/features/project-management/constants/projects-table-query-config.ts`, `src/features/project-management/constants/project-table-filter-config.ts`

**Interfaces:**
- Consumes: `PROJECT_FIELDS`, `ProjectListRow`, `PROJECT_STATUS_BUCKET_LABELS` (Task 4); `useEntityTable`, `RenderExpandedRow`, `EntityRecordsTable` (Task 3); `EntityTableMeta` (Task 2).
- Produces: `PROJECT_STATUS_BUCKET_COLORS: Record<ProjectStatusBucket, string>`; `ProjectColumnKey`; `ProjectTableMeta = EntityTableMeta<ProjectRow> & { onViewProfile?: (customerId: string) => void }`; `UseProjectsTableOptions = { renderExpandedRow?: RenderExpandedRow<ProjectRow> }`; `useProjectsTable(tableView, options) → { query, visibility, dataTableProps, dialogs }`; `PROJECTS_RECORDS_TABLE_VIEW`; `ProjectsRecordsTable({ renderExpandedRow? })`; `ProjectsRecordsView`.

- [ ] **Step 1: Status colours**

Create `src/shared/modules/projects/core/constants/status-colors.ts` (same shape as `proposal-status-colors.ts`):

```ts
import type { ProjectStatusBucket } from '@/shared/constants/enums'
import type { StatusTone } from '@/shared/constants/status-tones'

import { TONE_CLASSES } from '@/shared/constants/status-tones'

const PROJECT_STATUS_BUCKET_TONE: Record<ProjectStatusBucket, StatusTone> = {
  active: 'info',
  completed: 'success',
  on_hold: 'attention',
  cancelled: 'danger',
}

export const PROJECT_STATUS_BUCKET_COLORS = Object.fromEntries(
  Object.entries(PROJECT_STATUS_BUCKET_TONE).map(([bucket, tone]) => [bucket, TONE_CLASSES[tone].fill]),
) as Record<ProjectStatusBucket, string>
```

- [ ] **Step 2: The registry: typed by the field list, with Customer and Status**

In `src/shared/modules/projects/core/lib/columns-registry.tsx`:

- add imports `import type { EntityTableMeta } from '@/shared/components/data-table/types/entity-table-meta'` (if Task 2 didn't already), `import type { SortId } from '@/shared/dal/lib/query/field-list'`, `import type { PROJECT_FIELDS } from '@/shared/modules/projects/core/dal/project-fields'`, `import { CustomerNameCell } from '@/shared/components/data-table/ui/customer-name-cell'`, `import { deriveProjectStatusBucket } from '@/shared/constants/enums'`, `import { PROJECT_STATUS_BUCKET_COLORS } from '@/shared/modules/projects/core/constants/status-colors'`, `import { PROJECT_STATUS_BUCKET_LABELS } from '@/shared/modules/projects/core/constants/status-labels'`;
- `ProjectTableMeta` becomes:

```ts
export interface ProjectTableMeta extends EntityTableMeta<ProjectRow> {
  onViewProfile?: (customerId: string) => void
}
```

- after the `title` column add:

```tsx
  customerName: {
    label: 'Customer',
    sort: 'customerName',
    cell: ({ row, table }) => {
      const meta = table.options.meta as ProjectTableMeta | undefined
      return (
        <CustomerNameCell
          customerId={row.original.customerId}
          customerName={row.original.customerName}
          onViewProfile={meta?.onViewProfile}
          className="max-w-48 text-sm text-foreground"
        />
      )
    },
  },
  status: {
    label: 'Status',
    // The bucket is derived from the stage; the Status filter covers "show me On Hold".
    cell: ({ row }) => {
      const bucket = deriveProjectStatusBucket(row.original.pipelineStage)
      return (
        <div className="flex min-w-0 items-center gap-1.5">
          <Badge className={cn('shrink-0 text-xs', PROJECT_STATUS_BUCKET_COLORS[bucket])}>{PROJECT_STATUS_BUCKET_LABELS[bucket]}</Badge>
          {row.original.pipelineStage && (
            <span className="truncate text-xs capitalize text-muted-foreground">{row.original.pipelineStage.replace(/_/g, ' ')}</span>
          )}
        </div>
      )
    },
  },
```

- the `isPublic` column's `sort: 'isPublic'` becomes `sort: 'visibility'`;
- the closing line becomes `} as const satisfies ColumnRegistry<ProjectRow, SortId<typeof PROJECT_FIELDS>>`, and append:

```ts
export type ProjectColumnKey = keyof typeof PROJECT_COLUMNS
```

Match the meetings registry's closing line (`grep -n "satisfies ColumnRegistry" src/shared/entities/meetings/lib/columns-registry.tsx`) exactly. If `deriveProjectStatusBucket` is not re-exported from `@/shared/constants/enums`, import it from `@/shared/constants/enums/pipelines`.

- [ ] **Step 3: The entity table hook**

Create `src/shared/modules/projects/core/components/projects-table/use-projects-table.tsx`:

```tsx
'use client'

import type { RenderExpandedRow } from '@/shared/components/data-table/types/entity-expanded-row'
import type { EntityTableView } from '@/shared/components/data-table/types/entity-table-view'
import type { PROJECT_FIELDS } from '@/shared/modules/projects/core/dal/project-fields'
import type { ProjectColumnKey, ProjectRow, ProjectTableMeta } from '@/shared/modules/projects/core/lib/columns-registry'

import { useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'

import { useEntityTable } from '@/shared/components/data-table/lib/use-entity-table'
import { ROOTS } from '@/shared/config/roots'
import { useDataViewQuery } from '@/shared/dal/client/hooks/use-data-view-query'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { openModal } from '@/shared/lib/open-modal'
import { useProjectActionConfigs } from '@/shared/modules/projects/core/hooks/use-project-action-configs'
import { PROJECT_COLUMNS } from '@/shared/modules/projects/core/lib/columns-registry'
import { useTRPC } from '@/trpc/helpers'

export interface UseProjectsTableOptions {
  renderExpandedRow?: RenderExpandedRow<ProjectRow>
}

export function useProjectsTable(
  tableView: EntityTableView<ProjectColumnKey, typeof PROJECT_FIELDS>,
  { renderExpandedRow }: UseProjectsTableOptions = {},
) {
  const trpc = useTRPC()
  const router = useRouter()
  const query = useDataViewQuery(trpc.projectsRouter.crud.list, {}, tableView.query)

  const { actions, DeleteConfirmDialog } = useProjectActionConfigs<ProjectRow>()

  const meta = useMemo(() => ({
    onViewProfile: (customerId: string) => {
      openModal({ accessor: 'CustomerProfile', Component: CustomerProfileModal, props: { customerId } })
    },
  }) satisfies Omit<ProjectTableMeta, 'rowActions'>, [])

  // Without an expanded row, a row click opens the project.
  const openProject = useCallback((row: ProjectRow) => router.push(ROOTS.dashboard.projects.byId(row.id)), [router])

  const { visibility, dataTableProps } = useEntityTable({
    tableView,
    registry: PROJECT_COLUMNS,
    query,
    actions,
    meta,
    renderExpandedRow,
    onRowClick: openProject,
    entityName: 'project',
    rowDataAttribute: 'data-project-row',
    skeletonRowClassName: 'h-[52.5px]',
  })

  return { query, visibility, dataTableProps, dialogs: <DeleteConfirmDialog /> }
}
```

Check `ROOTS.dashboard.projects.byId` and `.new` exist (`grep -n "projects" src/shared/config/roots.ts`).

- [ ] **Step 4: The table view constant**

Create `src/features/records-management/constants/projects-records-table-view.ts`:

```ts
import type { EntityTableView } from '@/shared/components/data-table/types/entity-table-view'
import type { ProjectColumnKey } from '@/shared/modules/projects/core/lib/columns-registry'

import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { PROJECT_FIELDS } from '@/shared/modules/projects/core/dal/project-fields'

export const PROJECTS_RECORDS_TABLE_VIEW = {
  tableId: 'projects',
  query: {
    fields: PROJECT_FIELDS,
    paramPrefix: 'pj',
    toolbar: ['statusBucket', 'visibility', 'completedAt', 'createdAt'],
    defaultSort: { sortBy: 'createdAt', sortDir: 'desc' },
    window: { kind: 'page', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS },
  },
  columns: ['title', 'customerName', 'status', 'city', 'isPublic', 'completedAt', 'createdAt'],
} as const satisfies EntityTableView<ProjectColumnKey, typeof PROJECT_FIELDS>
```

`tableId: 'projects'` and `paramPrefix: 'pj'` are the legacy table's, so saved column widths and old URLs carry over.

- [ ] **Step 5: The records table component and view**

Create `src/features/records-management/ui/components/projects-records-table.tsx` (the hook suspends, so it runs inside the view's `DataViewBoundary`):

```tsx
'use client'

import type { UseProjectsTableOptions } from '@/shared/modules/projects/core/components/projects-table/use-projects-table'

import { PlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { PROJECTS_RECORDS_TABLE_VIEW } from '@/features/records-management/constants/projects-records-table-view'
import { EntityRecordsTable } from '@/shared/components/entity-records-table'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { useProjectsTable } from '@/shared/modules/projects/core/components/projects-table/use-projects-table'

export function ProjectsRecordsTable({ renderExpandedRow }: UseProjectsTableOptions) {
  const router = useRouter()
  const table = useProjectsTable(PROJECTS_RECORDS_TABLE_VIEW, { renderExpandedRow })

  return (
    <EntityRecordsTable
      title="Projects"
      entityName="projects"
      searchPlaceholder="Search by project, city or customer…"
      headerActions={(
        <Button size="sm" onClick={() => router.push(ROOTS.dashboard.projects.new())}>
          <PlusIcon className="mr-2 h-4 w-4" />
          New Project
        </Button>
      )}
      table={table}
    />
  )
}
```

Create `src/features/records-management/ui/views/projects-records-view.tsx`:

```tsx
'use client'

import { ProjectsRecordsTable } from '@/features/records-management/ui/components/projects-records-table'
import { DataViewBoundary } from '@/shared/components/data-view-boundary'
import { RecordsPageMotionShell } from '@/shared/components/records-page-motion-shell'

export function ProjectsRecordsView() {
  return (
    <RecordsPageMotionShell>
      <DataViewBoundary>
        <ProjectsRecordsTable />
      </DataViewBoundary>
    </RecordsPageMotionShell>
  )
}
```

(Task 8 passes the expanded row.)

- [ ] **Step 6: Page, pending view, delete the legacy table**

Replace `src/app/(frontend)/dashboard/(records)/projects/page.tsx` with:

```tsx
import type { SearchParams } from 'nuqs/server'

import { PROJECTS_RECORDS_TABLE_VIEW } from '@/features/records-management/constants/projects-records-table-view'
import { ProjectsRecordsView } from '@/features/records-management/ui/views/projects-records-view'
import { loadDataViewQueryInput } from '@/shared/dal/server/lib/query/load-data-view-query-input'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { HydrateClient } from '@/trpc/components/hydrate-client'
import { prefetch } from '@/trpc/lib/prefetch'
import { trpc } from '@/trpc/server'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<SearchParams>
}

export default async function ProjectsPage({ searchParams }: Props) {
  const authState = await protectDashboardPage()

  // Unauthenticated visitors get the layout's sign-in screen; skip the
  // prefetch work.
  if (authState.status === 'authenticated') {
    const input = await loadDataViewQueryInput(searchParams, PROJECTS_RECORDS_TABLE_VIEW.query)
    prefetch(trpc.projectsRouter.crud.list.queryOptions(input))
  }

  return (
    <HydrateClient>
      <ProjectsRecordsView />
    </HydrateClient>
  )
}
```

Before replacing it, compare with the meetings page (`src/app/(frontend)/dashboard/(records)/meetings/page.tsx`) and keep any line it has that this one lacks (imports, auth handling).

In `src/features/agent-dashboard/constants/route-pending-views.ts` change the projects entry to the meetings pattern:

```ts
  [ROOTS.dashboard.projects.root()]: dynamic(() => import('@/features/records-management/ui/views/projects-records-view').then(m => m.ProjectsRecordsView)),
```

`git rm` `src/features/agent-dashboard/ui/components/projects-route-pending-view.tsx` and the four legacy files listed under Delete. Then:

Run: `grep -rn "PortfolioProjectsTable\|ProjectDetailSheet\|ProjectsRoutePendingView\|PROJECTS_TABLE_QUERY_CONFIG\|PROJECT_FILTER_CONFIG\|project-detail-sheet\|projects-table-query-config\|project-table-filter-config\|projects-route-pending-view" src`
Expected: no hits. If `PROJECT_FILTER_CONFIG` (or a legacy label constant) has another importer, move that importer to `status-labels.ts` in this task.

- [ ] **Step 7: Type-check, lint, browser read check**

Run: `pnpm tsc && pnpm lint` → clean.

Browser (super-admin), `/dashboard/projects`:
- seven columns (Project, Customer, Status, Location, Visibility, Completed, Created); a project with a customer shows a dotted-underline name that opens the customer profile modal; a pure portfolio project shows "—"; Status shows a coloured bucket badge and the stage beside it, on one line;
- Status, Visibility, Completed and Created filters narrow the list; search by a customer's name finds their project;
- every sortable header sorts, Customer and Visibility included; Status has no sort arrow;
- sort Completed descending: finished projects first, newest first, unfinished ones after; ascending: oldest finished first, unfinished still last;
- sort by Visibility, then hand-edit the sort value in the URL from `visibility` to `isPublic` and reload: the page loads in default order, no error page;
- reload with filters in the URL: the server rows show without a skeleton flash; the skeleton row height matches a real row (if not, measure a real row in DevTools and set `skeletonRowClassName` to it);
- a row click opens the project page (no expanded row yet); "New Project" navigates;
- navigating to Projects from the sidebar shows the records page as its pending view;
- `/dashboard` home: the Active and On Hold project sections list the same projects as before.

Screenshots to `.superpowers/sdd/2026-10-01-projects-entity-table/task-5-*.png`.

- [ ] **Step 8: Commit (Tasks 4 + 5)**

```bash
git add src/shared/modules/projects/core/constants/status-labels.ts src/shared/modules/projects/core/constants/status-colors.ts src/shared/modules/projects/core/dal/project-fields.ts src/shared/modules/projects/core/dal/server/project-field-sql.ts src/shared/modules/projects/core/dal/server/queries.ts src/trpc/routers/projects.router/crud.router.ts src/shared/modules/projects/core/lib/columns-registry.tsx src/shared/modules/projects/core/components/projects-table/use-projects-table.tsx src/features/records-management/constants/projects-records-table-view.ts src/features/records-management/ui/components/projects-records-table.tsx src/features/records-management/ui/views/projects-records-view.tsx "src/app/(frontend)/dashboard/(records)/projects/page.tsx" src/features/agent-dashboard/constants/route-pending-views.ts src/features/agent-dashboard/ui/components/projects-route-pending-view.tsx src/features/project-management/ui/components/table/index.tsx src/features/project-management/ui/components/project-detail-sheet.tsx src/features/project-management/constants/projects-table-query-config.ts src/features/project-management/constants/project-table-filter-config.ts
git diff --cached --stat
git commit -m "feat(projects): projects records table on a field list and the shared table hook, with customer and status columns; the portfolio table and sheet go

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Actions can hide per entity

**Files:**
- Modify: `src/shared/components/entities/entity-actions/types.ts`
- Create: `src/shared/components/entities/entity-actions/lib/visible-actions.ts`
- Modify: `src/shared/components/entities/entity-actions/ui/entity-action-menu.tsx` (the `permitted` filter)
- Modify: `src/shared/components/entities/entity-actions/ui/entity-action-dropdown.tsx` (the `permitted` filter)
- Modify: `src/features/schedule-management/ui/components/schedule-calendar-dot.tsx` (the `permittedActions` filter)
- Modify: `src/features/schedule-management/ui/components/schedule-activities-calendar.tsx` (the actions `useMemo`)
- Test (throwaway): `.superpowers/sdd/2026-10-01-projects-entity-table/tests/visible-actions.test.ts`

**Interfaces:**
- Produces: optional `hidden?: (entity: TEntity) => boolean` on `EntityActionClickConfig`, `EntityActionSelectConfig`, `EntityActionCustomConfig`; `isActionPermitted(action: EntityAction, ability: AppAbility): boolean`; `getVisibleActions<TEntity>(configs, ability, entity): EntityActionConfig<TEntity>[]`. The later bulk plan reuses both.

- [ ] **Step 1: Write the failing test**

Create `.superpowers/sdd/2026-10-01-projects-entity-table/tests/visible-actions.test.ts`:

```ts
import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { AppAbility } from '@/shared/domains/permissions/types'

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { EyeIcon } from 'lucide-react'

import { getVisibleActions } from '@/shared/components/entities/entity-actions/lib/visible-actions'

// Only the `can` the helper calls.
const agent = { can: (action: string, subject: string) => !(action === 'delete' && subject === 'Project') } as unknown as AppAbility

interface Row { id: string, isPublic: boolean }

const configs: EntityActionConfig<Row>[] = [
  { action: { id: 'open', label: 'Open', icon: EyeIcon }, onAction: () => {} },
  { action: { id: 'view', label: 'View on Site', icon: EyeIcon }, onAction: () => {}, hidden: row => !row.isPublic },
  { action: { id: 'delete', label: 'Delete', icon: EyeIcon, permission: ['delete', 'Project'] }, onAction: () => {} },
]

test('drops actions the viewer lacks the permission for', () => {
  const ids = getVisibleActions(configs, agent, { id: '1', isPublic: true }).map(c => c.action.id)
  assert.deepEqual(ids, ['open', 'view'])
})

test('drops actions hidden for this entity', () => {
  const ids = getVisibleActions(configs, agent, { id: '1', isPublic: false }).map(c => c.action.id)
  assert.deepEqual(ids, ['open'])
})

test('an action with no permission and no hidden rule always shows', () => {
  const none = { can: () => false } as unknown as AppAbility
  const ids = getVisibleActions(configs, none, { id: '1', isPublic: false }).map(c => c.action.id)
  assert.deepEqual(ids, ['open'])
})
```

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-01-projects-entity-table/tests/visible-actions.test.ts`
Expected: FAIL (module `visible-actions` not found). If `AppAbility` is not exported from `@/shared/domains/permissions/types`, find its export (`grep -rn "export type AppAbility" src`) and use that path in both the test and the helper.

- [ ] **Step 2: Types**

In `src/shared/components/entities/entity-actions/types.ts`, add to `EntityActionClickConfig`, `EntityActionSelectConfig` and `EntityActionCustomConfig`, after their `isLoading?`:

```ts
  /** Leaves the action out for this entity. Runs while rendering, so it reads only its argument. */
  hidden?: (entity: TEntity) => boolean
```

- [ ] **Step 3: The helper**

Create `src/shared/components/entities/entity-actions/lib/visible-actions.ts`:

```ts
import type { EntityAction, EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { AppAbility } from '@/shared/domains/permissions/types'

export function isActionPermitted(action: EntityAction, ability: AppAbility): boolean {
  return !action.permission || ability.can(action.permission[0], action.permission[1])
}

/** The actions this viewer may run on this entity: the CASL permission first, then the action's own `hidden` rule. */
export function getVisibleActions<TEntity>(
  configs: EntityActionConfig<TEntity>[],
  ability: AppAbility,
  entity: TEntity,
): EntityActionConfig<TEntity>[] {
  return configs.filter(config => isActionPermitted(config.action, ability) && !config.hidden?.(entity))
}
```

Run the Step 1 test → 3 pass.

- [ ] **Step 4: Every menu uses the helper**

Read each file's filter first, then:
- `entity-action-menu.tsx`: replace the `const permitted = actions.filter(...)` block with `const permitted = getVisibleActions(actions, ability, entity)` and import `getVisibleActions`.
- `entity-action-dropdown.tsx`: replace its `permitted` block the same way (it receives `entity`).
- `schedule-calendar-dot.tsx`: replace the `permittedActions` filter with `const permittedActions = getVisibleActions(actions, ability, <the file's entity variable>)`.
- `schedule-activities-calendar.tsx` (one list for every event, no entity): inside its actions `useMemo` replace the filter with `actions.filter(({ action }) => isActionPermitted(action, ability))`.

Run: `grep -rn "ability.can(action.permission" src` → expected: only `visible-actions.ts`.

- [ ] **Step 5: Type-check, lint, browser read check**

Run: `pnpm tsc && pnpm lint` → clean.

Browser (super-admin): the meetings and projects records row menus, a schedule calendar dot's menu and an activity dot's menu show the same items as before.

- [ ] **Step 6: Commit**

```bash
git add src/shared/components/entities/entity-actions/types.ts src/shared/components/entities/entity-actions/lib/visible-actions.ts src/shared/components/entities/entity-actions/ui/entity-action-menu.tsx src/shared/components/entities/entity-actions/ui/entity-action-dropdown.tsx src/features/schedule-management/ui/components/schedule-calendar-dot.tsx src/features/schedule-management/ui/components/schedule-activities-calendar.tsx
git diff --cached --stat
git commit -m "feat(entity-actions): an action can hide itself per entity; one helper decides what a viewer sees

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: A project's meetings, read on their own

**Files:**
- Create: `src/shared/entities/meetings/dal/server/meetings-with-proposals.ts`
- Modify: `src/shared/entities/customers/dal/server/get-customer-profile.ts`
- Modify: `src/shared/entities/meetings/dal/server/queries.ts` (add `listMeetingsForProject`)
- Modify: `src/trpc/routers/meetings.router/reads.router.ts` (add `listForProject`)
- Modify: `src/shared/dal/client/hooks/use-invalidation.ts`

**Interfaces:**
- Produces: `getMeetingsWithProposals(where: SQL | undefined): Promise<{ meetings: CustomerProfileMeeting[], proposals: CustomerProfileProposal[] }>` (server-only); `listMeetingsForProject(ctx: ScopedContext, input: { projectId: string }): Promise<DalReturn<CustomerProfileMeeting[]>>`; `meetingsRouter.reads.listForProject({ projectId })` → `CustomerProfileMeeting[]`, newest first. `getCustomerProfile`'s output is unchanged.

`git status --short` on every file in this task must print nothing before you start. `get-customer-profile.ts` is also read by the pending customer-profile-modal plan; its output must stay byte-for-byte the same shape.

- [ ] **Step 1: Pull the builder out of the profile read**

Create `src/shared/entities/meetings/dal/server/meetings-with-proposals.ts`:

```ts
import type { SQL } from 'drizzle-orm'

import type { CustomerProfileMeeting, CustomerProfileProposal } from '@/shared/entities/customers/types'

import { count, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { proposals } from '@/shared/db/schema/proposals'
import 'server-only'

/** Meetings matching `where`, newest first, each with its proposals: the shape the customer profile and a project's sales history render. */
export async function getMeetingsWithProposals(where: SQL | undefined): Promise<{ meetings: CustomerProfileMeeting[], proposals: CustomerProfileProposal[] }> {
  // MOVED BLOCK — see below
  return { meetings: meetingsWithProposals, proposals: allProposals }
}
```

Replace the `// MOVED BLOCK` line by **moving** (cut, not copy) from `get-customer-profile.ts` the block that starts at `const meetingRows = await db` and ends at the closing `}))` of `const meetingsWithProposals: CustomerProfileMeeting[] = meetingRows.map(...)`. In the moved block change only `.where(eq(meetings.customerId, customerId))` on the meetings select to `.where(where)`. Keep every other line, comment and the `sql\`NULL\`` empty-list fallback as they are.

In `get-customer-profile.ts`, where the block was, put:

```ts
  const { meetings: meetingsWithProposals, proposals: allProposals } = await getMeetingsWithProposals(eq(meetings.customerId, customerId))
```

and import `getMeetingsWithProposals` from `@/shared/entities/meetings/dal/server/meetings-with-proposals`. Remove the imports `pnpm lint` reports unused there (`count`, `proposalViews` only if no longer used — the proposal-views query further down still uses `proposalViews`; keep what is used).

- [ ] **Step 2: The DAL read**

In `src/shared/entities/meetings/dal/server/queries.ts` add:

```ts
/**
 * A project's sales history. `ctx.scope` here is the project's visibility (the router runs this under
 * `projectProcedure`), so it is applied through the project: whoever can see the project sees all of its meetings.
 */
export async function listMeetingsForProject(
  ctx: ScopedContext,
  input: { projectId: string },
): Promise<DalReturn<CustomerProfileMeeting[]>> {
  return dalDbOperation(async () => {
    const projectVisible = ctx.scope
      ? exists(db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.projectId), ctx.scope)))
      : undefined
    const { meetings: rows } = await getMeetingsWithProposals(and(eq(meetings.projectId, input.projectId), projectVisible))
    return rows
  })
}
```

Imports to add (keep the file's existing ones): `exists` from `drizzle-orm` (beside `and`, `eq`), `projects` from `@/shared/db/schema/projects` (or `@/shared/db/schema`, matching how the file imports `meetings`), `type CustomerProfileMeeting` from `@/shared/entities/customers/types`, `getMeetingsWithProposals` from `./meetings-with-proposals`. `dalDbOperation`, `DalReturn` and `ScopedContext` are already imported for `listMeetings`.

- [ ] **Step 3: The procedure**

In `src/trpc/routers/meetings.router/reads.router.ts` add to the router (after `getByIdWithJoins`):

```ts
  // Scoped by the project, not the meeting: a rep who can see the project sees every meeting that sold it.
  listForProject: projectProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => dalToTrpc(await listMeetingsForProject(ctx, input))),
```

Import `listMeetingsForProject` beside `listMeetings`, and `import { projectProcedure } from '../projects.router/procedures'`.

- [ ] **Step 4: Freshness**

In `src/shared/dal/client/hooks/use-invalidation.ts`:
- add to `cross`:

```ts
    meetingsForProject: () =>
      trpc.meetingsRouter.reads.listForProject.queryFilter(),
```

- in `invalidateProposal` and `invalidateProject`, add `void qc.invalidateQueries(cross.meetingsForProject())`. In `invalidateProposal` put it beside the `cross.meetingsList()` line with the comment `// A project's sales history shows its meetings' proposals.` (`invalidateMeeting` already covers it through `meetingsRouter.pathFilter()`.)

- [ ] **Step 5: Type-check, lint, read check**

Run: `pnpm tsc && pnpm lint` → clean.

Browser (super-admin): open a customer profile modal for a customer with meetings and proposals (from `/dashboard/meetings`, click a customer name). Its Meetings and Projects tabs show the same meetings, proposals, values and view counts as before this task (compare with a screenshot taken before Step 1). The new procedure gets its browser check in Task 8.

- [ ] **Step 6: Commit**

```bash
git add src/shared/entities/meetings/dal/server/meetings-with-proposals.ts src/shared/entities/customers/dal/server/get-customer-profile.ts src/shared/entities/meetings/dal/server/queries.ts src/trpc/routers/meetings.router/reads.router.ts src/shared/dal/client/hooks/use-invalidation.ts
git diff --cached --stat
git commit -m "feat(meetings): a project's meetings and their proposals as their own read, on the builder the customer profile uses

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Project actions (optimistic portfolio toggle) and the projects expanded row

**Files:**
- Modify: `src/shared/modules/projects/core/constants/actions.ts`
- Modify: `src/shared/modules/projects/core/hooks/use-project-actions.ts`
- Modify: `src/shared/modules/projects/core/hooks/use-project-action-configs.ts`
- Create: `src/shared/entities/meetings/components/project-meeting-list.tsx`
- Modify: `src/shared/entities/customers/components/lists/project-entity-card.tsx`
- Create: `src/features/records-management/ui/components/project-row-panel/index.tsx`
- Create: `src/features/records-management/ui/components/project-row-panel/project-row-action-bar.tsx`
- Create: `src/features/records-management/ui/components/project-row-panel/project-row-details.tsx`
- Create: `src/features/records-management/ui/components/project-row-panel/project-scopes-pane.tsx`
- Create: `src/features/records-management/ui/components/project-row-panel/project-sales-history-pane.tsx`
- Modify: `src/features/records-management/ui/views/projects-records-view.tsx`

**Interfaces:**
- Consumes: `hidden`, `getVisibleActions` (Task 6); `useProjectsTable`, `ProjectRow` (Task 5); `EntityExpandedRowContext` (Task 3); `PROJECT_STATUS_BUCKET_LABELS`, `PROJECT_STATUS_BUCKET_COLORS`, `ProjectListRow.hasMeetings` (Tasks 4–5); `meetingsRouter.reads.listForProject` (Task 7).
- Produces: `PROJECT_ACTIONS.edit` = "Open Project" (primary), `PROJECT_ACTIONS.view` = "View on Site", `PROJECT_ACTIONS.showOnPortfolio`, `PROJECT_ACTIONS.hideFromPortfolio`; `useProjectActions()` → `{ deleteProject, setPortfolioVisibility }`; `ProjectEntity.isPublic?: boolean`; `ProjectMeetingList({ customerId, meetings, onMutationSuccess, onNavigate?, onAssignRep?, highlightMeetingId? })`; `ProjectRowPanel({ project, actions })`.

- [ ] **Step 1: The actions**

Replace the import line and `PROJECT_ACTIONS` in `src/shared/modules/projects/core/constants/actions.ts` (keep its `EntityAction` type import):

```ts
import { CopyIcon, ExternalLinkIcon, EyeIcon, EyeOffIcon, FolderOpenIcon, TrashIcon } from 'lucide-react'

export const PROJECT_ACTIONS = {
  edit: {
    id: 'edit',
    label: 'Open Project',
    icon: FolderOpenIcon,
    permission: ['update', 'Project'],
    primary: true,
  },
  view: {
    id: 'view',
    label: 'View on Site',
    icon: ExternalLinkIcon,
    permission: ['read', 'Project'],
  },
  showOnPortfolio: {
    id: 'showOnPortfolio',
    label: 'Show on Portfolio',
    icon: EyeIcon,
    permission: ['update', 'Project'],
  },
  hideFromPortfolio: {
    id: 'hideFromPortfolio',
    label: 'Hide from Portfolio',
    icon: EyeOffIcon,
    permission: ['update', 'Project'],
  },
  duplicate: {
    id: 'duplicate',
    label: 'Duplicate',
    icon: CopyIcon,
    permission: ['create', 'Project'],
    separatorBefore: true,
  },
  delete: {
    id: 'delete',
    label: 'Delete',
    icon: TrashIcon,
    permission: ['delete', 'Project'],
    destructive: true,
    separatorBefore: true,
  },
} as const satisfies Record<string, EntityAction>
```

Run `grep -rn "PROJECT_ACTIONS\." src` and check each caller still reads right with the new labels.

- [ ] **Step 2: The optimistic visibility mutation**

In `src/shared/modules/projects/core/hooks/use-project-actions.ts`:

- imports become:

```ts
import type { AppRouterOutputs } from '@/trpc/routers/app'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

type ProjectListPage = AppRouterOutputs['projectsRouter']['crud']['list']
```

- inside the hook, after `const { invalidateProject } = useInvalidation()`, add `const qc = useQueryClient()`, and before the `return`:

```ts
  // Every cached projects page (records table and dashboard sections) flips the row at once; no spinner, no wait.
  const setPortfolioVisibility = useMutation(trpc.projectsRouter.crud.update.mutationOptions({
    onMutate: async ({ id, data }) => {
      const lists = trpc.projectsRouter.crud.list.queryFilter()
      await qc.cancelQueries(lists)
      const previous = qc.getQueriesData<ProjectListPage>(lists)
      qc.setQueriesData<ProjectListPage>(lists, page => page && {
        ...page,
        rows: page.rows.map(row => (row.id === id ? { ...row, isPublic: data.isPublic ?? row.isPublic } : row)),
      })
      return { previous }
    },
    onError: (err, _variables, context) => {
      for (const [queryKey, page] of context?.previous ?? []) {
        qc.setQueryData(queryKey, page)
      }
      toast.error(err.message || 'Couldn\'t change portfolio visibility')
    },
    onSuccess: (_project, { data }) => toast.success(data.isPublic ? 'Shown on portfolio' : 'Hidden from portfolio'),
    onSettled: () => invalidateProject(),
  }))
```

- return `{ deleteProject, setPortfolioVisibility }`.

If `projectFormSchema.partial()` rejects `{ isPublic }` alone (check `src/shared/modules/projects/core/schemas`), stop and report: the update input must accept a partial patch.

- [ ] **Step 3: The configs (stable, with `hidden`)**

In `src/shared/modules/projects/core/hooks/use-project-action-configs.ts`:

- `ProjectEntity` becomes:

```ts
interface ProjectEntity {
  id: string
  accessor?: string
  /** Absent where the caller's row doesn't carry it (the customer profile); the site and portfolio actions then stay hidden. */
  isPublic?: boolean
}
```

- destructure `const { deleteProject, setPortfolioVisibility } = useProjectActions()`;
- the `useStableCallbacks` array becomes (order: open, site, portfolio, delete):

```ts
  // The configs' callbacks close over this render's mutations; only the delete loading flag should re-render rows.
  const actions = useStableCallbacks<EntityActionConfig<T>[]>([
    {
      action: PROJECT_ACTIONS.edit,
      onAction: overrides.onEdit ?? defaultEdit,
    },
    {
      action: PROJECT_ACTIONS.view,
      onAction: overrides.onView ?? defaultView,
      // A draft's public page is a 404.
      hidden: entity => entity.isPublic !== true,
    },
    {
      action: PROJECT_ACTIONS.showOnPortfolio,
      onAction: entity => setPortfolioVisibility.mutate({ id: entity.id, data: { isPublic: true } }),
      hidden: entity => entity.isPublic !== false,
    },
    {
      action: PROJECT_ACTIONS.hideFromPortfolio,
      onAction: entity => setPortfolioVisibility.mutate({ id: entity.id, data: { isPublic: false } }),
      hidden: entity => entity.isPublic !== true,
    },
    {
      action: PROJECT_ACTIONS.delete,
      onAction: async (entity) => {
        const ok = await confirmDelete()
        if (ok) {
          deleteProject.mutate({ id: entity.id })
        }
      },
      isLoading: deleteProject.isPending,
    },
  ])
```

Do **not** switch to `useMemo`, and do not add `isLoading` to the portfolio entries (the optimistic update is the feedback; a shared loading flag would re-render every row). `useStableCallbacks` wraps `hidden` like `onAction`; it reads only its argument, so the wrapped one behaves the same.

The dashboard's project cards (`dashboard-project-card.tsx`) use these configs with `ProjectRow`, so their menus gain View on Site and the portfolio toggle. That is expected; note it in the acceptance file.

- [ ] **Step 4: `ProjectMeetingList`, extracted from the customer profile's project card**

Read `src/shared/entities/customers/components/lists/project-entity-card.tsx` first. Create `src/shared/entities/meetings/components/project-meeting-list.tsx` holding the card's meetings block (its `project.meetings.map(…)` list) with the card's exact markup and classes. The expected shape, to diff against:

```tsx
'use client'

import type { CustomerProfileMeeting, CustomerProfileProposal } from '@/shared/entities/customers/types'

import { PlusIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { ROOTS } from '@/shared/config/roots'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { MeetingProposalRow } from '@/shared/entities/meetings/components/meeting-proposal-row'
import { MeetingOverviewCard } from '@/shared/entities/meetings/components/overview-card'
import { ParticipantsSlot } from '@/shared/entities/meetings/components/participants-slot'
import { cn } from '@/shared/lib/utils'

interface ProjectMeetingListProps {
  customerId: string
  meetings: CustomerProfileMeeting[]
  onMutationSuccess: () => void
  onNavigate?: () => void
  onAssignRep?: (meetingId: string, currentRepId: string | null) => void
  highlightMeetingId?: string
}

export function ProjectMeetingList({ customerId, meetings, onMutationSuccess, onNavigate, onAssignRep, highlightMeetingId }: ProjectMeetingListProps) {
  const ability = useAbility()
  const canCreateProposal = ability.can('create', 'Proposal')

  return (
    <div className="space-y-2.5">
      {meetings.map(meeting => (
        <Card key={meeting.id} className={cn('group pt-0 pb-0 gap-0', meeting.id === highlightMeetingId && 'outline-2 outline-primary -outline-offset-2 shadow-sm')}>
          <CardContent className="p-0">
            <MeetingOverviewCard
              meeting={meeting}
              customerId={customerId}
              onAssignOwner={onAssignRep ? () => onAssignRep(meeting.id, meeting.ownerId ?? null) : undefined}
            >
              <MeetingOverviewCard.Header className="px-3 py-2">
                <MeetingOverviewCard.Fields fields={[
                  { field: 'scheduledDate' },
                  { field: 'type' },
                  { field: 'outcome' },
                  { field: 'proposalCount' },
                ]}
                />
                <MeetingOverviewCard.CreatedAt />
                <MeetingOverviewCard.Actions mode="compact" className="ml-auto opacity-60 hover:opacity-100 transition-opacity" />
              </MeetingOverviewCard.Header>
              <div className="grid grid-cols-1 border-t divide-y md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] md:divide-y-0 md:divide-x">
                <div className="p-3">
                  <ParticipantsSlot meetingId={meeting.id} variant="full" entityListVariant="flush" />
                </div>
                <div className="p-3">
                  <MeetingOverviewCard.Proposals
                    showHeader
                    entityListVariant="flush"
                    emptyStateAction={canCreateProposal && (
                      <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" asChild>
                        <a href={`${ROOTS.dashboard.proposals.new()}?meetingId=${meeting.id}`}>
                          <PlusIcon className="size-3" />
                          Create proposal
                        </a>
                      </Button>
                    )}
                    renderProposal={p => (
                      <MeetingProposalRow
                        key={p.id}
                        proposal={p as CustomerProfileProposal}
                        onMutationSuccess={onMutationSuccess}
                        onNavigate={onNavigate}
                      />
                    )}
                  />
                </div>
              </div>
            </MeetingOverviewCard>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

Where the card's markup differs from this, the card wins.

In `project-entity-card.tsx`:
- replace the `<div className="space-y-2.5">…</div>` inside the "Meetings within this project" block with:

```tsx
              <ProjectMeetingList
                customerId={customerId}
                meetings={project.meetings}
                onMutationSuccess={onMutationSuccess}
                onNavigate={onNavigate}
                onAssignRep={onAssignRep}
                highlightMeetingId={highlightMeetingId}
              />
```

- change the configs call to `useProjectActionConfigs({ onEdit: handleViewProject })` (an `onView` override would open the dashboard under the "View on Site" label; the profile's project carries no `isPublic`, so View on Site stays hidden there anyway);
- import `ProjectMeetingList`; remove the imports `pnpm lint` reports unused.

- [ ] **Step 5: The panel pieces**

Create `src/features/records-management/ui/components/project-row-panel/project-row-action-bar.tsx`:

```tsx
'use client'

import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { ProjectRow } from '@/shared/modules/projects/core/lib/columns-registry'

import { useMemo } from 'react'

import { withToolbarRoles } from '@/shared/components/entities/entity-actions/lib/with-toolbar-roles'
import { EntityActionMenu } from '@/shared/components/entities/entity-actions/ui/entity-action-menu'

interface ProjectRowActionBarProps {
  project: ProjectRow
  actions: EntityActionConfig<ProjectRow>[]
}

export function ProjectRowActionBar({ project, actions }: ProjectRowActionBarProps) {
  const toolbarActions = useMemo(
    () => withToolbarRoles(actions, { primaryId: 'edit', promotedIds: ['showOnPortfolio', 'hideFromPortfolio', 'view'] }),
    [actions],
  )
  return <EntityActionMenu entity={project} actions={toolbarActions} mode="toolbar" />
}
```

Create `project-row-details.tsx`:

```tsx
'use client'

import type { ProjectRow } from '@/shared/modules/projects/core/lib/columns-registry'

import { format } from 'date-fns'

import { Badge } from '@/shared/components/ui/badge'
import { deriveProjectStatusBucket } from '@/shared/constants/enums'
import { cn } from '@/shared/lib/utils'
import { PROJECT_STATUS_BUCKET_COLORS } from '@/shared/modules/projects/core/constants/status-colors'
import { PROJECT_STATUS_BUCKET_LABELS } from '@/shared/modules/projects/core/constants/status-labels'

export function ProjectRowDetails({ project }: { project: ProjectRow }) {
  const bucket = deriveProjectStatusBucket(project.pipelineStage)
  const location = project.state ? `${project.city}, ${project.state}` : project.city
  return (
    <>
      <Badge className={cn('text-xs', project.isPublic ? 'bg-status-success-bg text-status-success-fg' : 'bg-muted text-muted-foreground')}>
        {project.isPublic ? 'Public' : 'Draft'}
      </Badge>
      <Badge className={cn('text-xs', PROJECT_STATUS_BUCKET_COLORS[bucket])}>{PROJECT_STATUS_BUCKET_LABELS[bucket]}</Badge>
      {project.pipelineStage && <span className="capitalize">{project.pipelineStage.replace(/_/g, ' ')}</span>}
      {location && <span>{location}</span>}
      {project.completedAt && <span>{`Completed ${format(new Date(project.completedAt), 'MMM d, yyyy')}`}</span>}
    </>
  )
}
```

Compare with `meeting-row-details.tsx` (`src/features/records-management/ui/components/meeting-row-panel/`) and use the same element rhythm (it is the reference for what `ExpandedRowPanel.Details` expects as children). Read it only; do not edit it.

Create `project-scopes-pane.tsx`:

```tsx
'use client'

import type { ProjectRow } from '@/shared/modules/projects/core/lib/columns-registry'

import { useMemo } from 'react'

import { ExpandedRowPanel } from '@/shared/components/data-table/ui/expanded-row-panel'
import { useConstructionCatalog } from '@/shared/modules/construction/core/hooks/use-construction-catalog'
import { resolveScopes } from '@/shared/modules/construction/core/lib/resolve-catalog-ids'

export function ProjectScopesPane({ project }: { project: ProjectRow }) {
  const catalog = useConstructionCatalog()
  const trades = useMemo(() => {
    const scopesByTrade = new Map<string, string[]>()
    for (const scope of resolveScopes(project.scopeIds, catalog).found) {
      scopesByTrade.set(scope.tradeId, [...(scopesByTrade.get(scope.tradeId) ?? []), scope.name])
    }
    return [...scopesByTrade].map(([tradeId, scopes]) => ({ tradeId, name: catalog.tradesById.get(tradeId)?.name ?? 'Unknown trade', scopes }))
  }, [project.scopeIds, catalog])

  return (
    <ExpandedRowPanel.Pane title="Trades and scopes" isLoading={catalog.isLoading}>
      {trades.length === 0
        ? <p className="text-sm text-muted-foreground">No scopes recorded</p>
        : (
            <ul className="flex flex-col gap-2">
              {trades.map(trade => (
                <li key={trade.tradeId}>
                  <span className="text-sm font-medium">{trade.name}</span>
                  <span className="block text-xs text-muted-foreground">{trade.scopes.join(', ')}</span>
                </li>
              ))}
            </ul>
          )}
    </ExpandedRowPanel.Pane>
  )
}
```

Check `useConstructionCatalog`'s return (`tradesById`, `isLoading`) and `resolveScopes(ids, catalog).found` items (`tradeId`, `name`) against `meeting-trades-pane.tsx`, which resolves the same catalog; match the names it uses.

Create `project-sales-history-pane.tsx`:

```tsx
'use client'

import type { CustomerProfileMeeting } from '@/shared/entities/customers/types'

import { ExpandedRowPanel } from '@/shared/components/data-table/ui/expanded-row-panel'
import { ProjectMeetingList } from '@/shared/entities/meetings/components/project-meeting-list'

interface ProjectSalesHistoryPaneProps {
  customerId: string | null
  meetings: CustomerProfileMeeting[]
  isLoading: boolean
  onMutationSuccess: () => void
}

export function ProjectSalesHistoryPane({ customerId, meetings, isLoading, onMutationSuccess }: ProjectSalesHistoryPaneProps) {
  return (
    <ExpandedRowPanel.Pane title="Sales history" isLoading={isLoading}>
      {!customerId || meetings.length === 0
        ? <p className="text-sm text-muted-foreground">No meetings linked to this project</p>
        : <ProjectMeetingList customerId={customerId} meetings={meetings} onMutationSuccess={onMutationSuccess} />}
    </ExpandedRowPanel.Pane>
  )
}
```

- [ ] **Step 6: The panel and the view**

Create `index.tsx` (the panel mounts only while its row is expanded, so mounting is the fetch trigger):

```tsx
'use client'

import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { ProjectRow } from '@/shared/modules/projects/core/lib/columns-registry'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { ProjectRowActionBar } from '@/features/records-management/ui/components/project-row-panel/project-row-action-bar'
import { ProjectRowDetails } from '@/features/records-management/ui/components/project-row-panel/project-row-details'
import { ProjectSalesHistoryPane } from '@/features/records-management/ui/components/project-row-panel/project-sales-history-pane'
import { ProjectScopesPane } from '@/features/records-management/ui/components/project-row-panel/project-scopes-pane'
import { ExpandedRowPanel } from '@/shared/components/data-table/ui/expanded-row-panel'
import { useTRPC } from '@/trpc/helpers'

interface ProjectRowPanelProps {
  project: ProjectRow
  actions: EntityActionConfig<ProjectRow>[]
}

export function ProjectRowPanel({ project, actions }: ProjectRowPanelProps) {
  const trpc = useTRPC()
  const sales = useQuery({
    ...trpc.meetingsRouter.reads.listForProject.queryOptions({ projectId: project.id }),
    enabled: project.hasMeetings,
  })

  const meetings = useMemo(() => {
    const linked = sales.data ?? []
    const soldIt = (meeting: (typeof linked)[number]) => meeting.proposals.some(proposal => proposal.status === 'approved')
    // The meeting that sold the project leads.
    return [...linked].sort((a, b) => Number(soldIt(b)) - Number(soldIt(a)))
  }, [sales.data])

  return (
    <ExpandedRowPanel>
      <ExpandedRowPanel.ActionBar>
        <ProjectRowActionBar project={project} actions={actions} />
      </ExpandedRowPanel.ActionBar>
      <ExpandedRowPanel.Details>
        <ProjectRowDetails project={project} />
      </ExpandedRowPanel.Details>
      {sales.isError && (
        <ExpandedRowPanel.Error
          title="Couldn't load this project's sales history"
          description="Trades and scopes still show; retry to load the meetings."
          onRetry={() => void sales.refetch()}
        />
      )}
      {/* Scopes come from the row itself, so a failed read hides only the sales history. */}
      <ExpandedRowPanel.Panes className={sales.isError ? undefined : '@min-[600px]:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]'}>
        <ProjectScopesPane project={project} />
        {!sales.isError && (
          <ProjectSalesHistoryPane
            customerId={project.customerId}
            meetings={meetings}
            isLoading={sales.isLoading}
            onMutationSuccess={() => void sales.refetch()}
          />
        )}
      </ExpandedRowPanel.Panes>
    </ExpandedRowPanel>
  )
}
```

Check the `ExpandedRowPanel.Error` and `.Pane` props against `src/shared/components/data-table/ui/expanded-row-panel.tsx` (read only; it carries the owner's uncommitted edit). `sales.isLoading` is false while `enabled` is false, so a project with no meetings shows the empty text at once.

Replace `projects-records-view.tsx` with:

```tsx
'use client'

import type { EntityExpandedRowContext } from '@/shared/components/data-table/types/entity-expanded-row'
import type { ProjectRow } from '@/shared/modules/projects/core/lib/columns-registry'

import { ProjectRowPanel } from '@/features/records-management/ui/components/project-row-panel'
import { ProjectsRecordsTable } from '@/features/records-management/ui/components/projects-records-table'
import { DataViewBoundary } from '@/shared/components/data-view-boundary'
import { RecordsPageMotionShell } from '@/shared/components/records-page-motion-shell'

// Module level keeps its identity stable, so the table's props don't churn.
function renderProjectRowPanel(row: ProjectRow, { actions }: EntityExpandedRowContext<ProjectRow>) {
  return <ProjectRowPanel project={row} actions={actions} />
}

export function ProjectsRecordsView() {
  return (
    <RecordsPageMotionShell>
      <DataViewBoundary>
        <ProjectsRecordsTable renderExpandedRow={renderProjectRowPanel} />
      </DataViewBoundary>
    </RecordsPageMotionShell>
  )
}
```

- [ ] **Step 7: Type-check, lint, browser and render check**

Run: `pnpm tsc && pnpm lint` → clean.

Browser, `/dashboard/projects`:
- **super-admin:** a row click expands it; a second click collapses it. A draft project's bar shows Open Project, Show on Portfolio and More (Delete); a public one shows Open Project, Hide from Portfolio, View on Site and More. Details show Public/Draft, the status badge, stage, location, completed date. Panes: Trades and scopes; Sales history (the project's meetings, the one with an approved proposal first). Clicking the Customer name, the row's action menu, or a control inside the panel does not toggle the row.
- **pure portfolio project** (no meetings): Customer cell "—", Sales history "No meetings linked to this project" with no loading state, and the network panel shows no `listForProject` request for it.
- **failed toggle (no write):** in the Playwright script, `await page.route('**/api/trpc/**projectsRouter.crud.update**', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"message":"Test failure","code":-32603,"data":{"code":"INTERNAL_SERVER_ERROR"}}}' }))`, then click Show on Portfolio on a draft row. The badge flips to Public at once, then back to Draft, and an error toast shows. If the tRPC link batches (`**/api/trpc/**` with a `batch=1` query), match on `**/api/trpc/**crud.update**` and fulfill a batched array body (`[{ "error": … }]`). `page.unroute` afterwards.
- **real toggle:** only on a project the owner designates.
- **agent session:** the same bar without Delete; no extra items.
- **customer profile modal** → Projects tab: each project card's menu shows Open Project and Delete (super-admin), no View on Site; its meetings and proposals render as before.
- **dashboard** (`/dashboard`): an Active project card's menu now also offers View on Site / the portfolio toggle (expected, from the shared configs); record it.
- Phone width (390px): the expanded panel stays within the visible width and the panes stack.
- Render check: `node scripts/perf/records-probe.mjs /dashboard/projects < /dev/null`. Expanding a row re-renders only that row (expand 20 → 1, as on meetings), and a successful optimistic toggle re-renders only the toggled row. Record the numbers in `.superpowers/sdd/2026-10-01-projects-entity-table/acceptance.md`.

- [ ] **Step 8: Commit**

```bash
git add src/shared/modules/projects/core/constants/actions.ts src/shared/modules/projects/core/hooks/use-project-actions.ts src/shared/modules/projects/core/hooks/use-project-action-configs.ts src/shared/entities/meetings/components/project-meeting-list.tsx src/shared/entities/customers/components/lists/project-entity-card.tsx src/features/records-management/ui/components/project-row-panel/index.tsx src/features/records-management/ui/components/project-row-panel/project-row-action-bar.tsx src/features/records-management/ui/components/project-row-panel/project-row-details.tsx src/features/records-management/ui/components/project-row-panel/project-scopes-pane.tsx src/features/records-management/ui/components/project-row-panel/project-sales-history-pane.tsx src/features/records-management/ui/views/projects-records-view.tsx
git diff --cached --stat
git commit -m "feat(projects): expanded row with trades, scopes and sales history; show or hide on the portfolio in one click, updated optimistically

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Hand-off: tracker, the publish-permission note, and a #285 comment draft

**Files:**
- Modify: `docs/plans/2026-09-26-records-management-epic.md`
- Modify (memory, not in git): `/home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory/project-backend-refactor-roadmap.md`
- Create (not committed): `.superpowers/sdd/2026-10-01-projects-entity-table/issue-285-comment.md`

- [ ] **Step 1: The tracker**

Check the tracker for edits by others first (`git diff docs/plans/2026-09-26-records-management-epic.md`). In the Rollout table set **R4** to `[x] built on local main <first-sha>..<last-sha> (shared table hook + records page, meetings moved onto them; projects entity table with customer and status columns, expanded row with sales history, optimistic portfolio toggle; empty values sort last; bulk moves to the all-tables bulk plan, D49)`. Under the Status line at the top, replace the "R4 projects now" wording with the D49 order and point at this plan as built. Edit only those two places.

- [ ] **Step 2: The memory note**

In `project-backend-refactor-roadmap.md`, under the #285 tail, add one line:

```markdown
- **Portfolio publish gap (2026-10-01):** `projectsRouter.crud.update` is an `agentProcedure` run with `scope: null`, and agents hold `update Project`, so any agent can make any project public on the website. The projects records table now puts Show/Hide on Portfolio one click away (`PROJECT_ACTIONS.showOnPortfolio` / `hideFromPortfolio`, permission `['update', 'Project']`). When #285 tightens scope, decide whether publishing gets its own permission (e.g. `['publish', 'Project']`, super-admin only). Owner deferred it to #285.
```

- [ ] **Step 3: The #285 comment draft**

Write `.superpowers/sdd/2026-10-01-projects-entity-table/issue-285-comment.md` with the same content as the memory line, phrased for the issue (what, where in code, the decision to make). **Do not post it.** The controller shows it to the owner, who decides whether to post.

- [ ] **Step 4: Commit the tracker**

```bash
git add docs/plans/2026-09-26-records-management-epic.md
git diff --cached --stat
git commit -m "docs(records): shared entity table and projects table built; tables-first order

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

If the tracker carries others' uncommitted hunks, do not commit it; report the edit for the owner to commit with theirs.
