# Data Table Default Sort — Enforce `createdAt`-desc

**Date:** 2026-08-12
**Status:** Approved (design), pending implementation plan
**Scope:** Server-paged data tables (shared sort helpers only)

## Problem

Every server-paged data table is supposed to default to newest-first
(`createdAt` descending) when the user hasn't picked an explicit sort. Today
that default is *correct everywhere it's wired* but it is expressed by
**hand-repeating `createdAt` 13 times** across two layers:

- **Server data order** — `buildOrderBy(input.sort, columnMap, fallback)`: the
  3rd `fallback` arg is passed manually at **6 DAL/router call sites**, all
  currently `desc(<table>.createdAt)`.
- **Client visual arrow** — `toDataTableSorting(pagination, { fallbackVisual:
  { id: 'createdAt', desc: true } })`: passed manually at **7 call sites**.

Nothing enforces this. A new table can silently omit either, and the default is
easy to forget. We want the default centralized so it applies automatically,
while staying flexible enough that "housekeeping" entities without a `createdAt`
column don't have to grow one just to satisfy a sort default.

## Non-goals

- Purely client-sorted (non-server-paged) tables via `DataTable`'s `defaultSort`
  prop — left as-is (all real "record" tables are server-paged).
- `campaigns-leads-view` — uses a bespoke raw-SQL query that deliberately orders
  by enrollment recency (`enrolled_at DESC`), not `createdAt`. Correctly out of
  scope; it doesn't use the shared sort helpers.
- Tie-breaker ordering for equal `createdAt` values (see "Related observation").

## Design

### Change 1 — Server data order (`buildOrderBy`)

File: `src/shared/dal/server/lib/query/sort.ts`

Keep `columnMap` as a plain `Record<TKey, SortTarget>` — **no forced
`createdAt`**. Resolve the order by precedence:

1. **Explicit sort** — `sort.sortBy` present and whitelisted in `columnMap`.
2. **Explicit `fallback`** — the optional 3rd arg, when provided (escape hatch
   for a table that wants a non-`createdAt` natural order, even if it *has*
   `createdAt`).
3. **`createdAt` convention** — if `columnMap` contains a `createdAt` key, use
   `desc(columnMap.createdAt)`.
4. **No sort** — emit an empty `orderBy` (Drizzle natural order). This is the
   graceful path for housekeeping entities with neither `createdAt` nor an
   explicit fallback.

```ts
export function buildOrderBy<TKey extends string>(
  sort: SortFields | undefined,
  columnMap: Record<TKey, SortTarget>,
  fallback?: SQL,
): SQL[] {
  const sortBy = sort?.sortBy
  if (sortBy && sortBy in columnMap) {
    const column = columnMap[sortBy as TKey]
    return [sort.sortDir === 'asc' ? asc(column) : desc(column)]
  }
  if (fallback) {
    return [fallback]
  }
  if ('createdAt' in columnMap) {
    return [desc((columnMap as Record<string, SortTarget>).createdAt)]
  }
  return []
}
```

Update the JSDoc to document the precedence and the `createdAt` convention.

**Call-site cleanup (6 sites):** drop the now-redundant `, desc(<table>.createdAt)`
3rd argument. All 6 maps already contain `createdAt`, so they keep the identical
order via the convention branch:

- `src/shared/entities/projects/dal/server/queries.ts:232`
- `src/shared/entities/proposals/dal/server/queries.ts:228`
- `src/shared/entities/meetings/dal/server/queries.ts:153`
- `src/trpc/routers/lead-sources.router.ts:307`
- `src/trpc/routers/customers.router/business.router.ts:68`
- `src/trpc/routers/schedule.router/activities.router.ts:61`

### Change 2 — Client visual arrow (`toDataTableSorting`)

File: `src/shared/components/data-table/lib/to-data-table-sorting.ts`

Default `fallbackVisual` to `{ id: 'createdAt', desc: true }` when the caller
doesn't pass one. Tables without a visible `createdAt` column simply don't render
an arrow (harmless — the id just won't match any header).

```ts
export function toDataTableSorting<T>(
  p: PaginatedQueryResult<T>,
  options: ToDataTableSortingOptions = {},
): DataTableServerSorting {
  return {
    sortBy: p.sortBy,
    sortDir: p.sortDir,
    onSortChange: p.setSort,
    fallbackVisual: options.fallbackVisual ?? { id: 'createdAt', desc: true },
  }
}
```

Update the JSDoc example to show the default plus the override escape hatch.

**Call-site cleanup (7 sites):** drop the redundant `{ fallbackVisual: { id:
'createdAt', desc: true } }` options object → `toDataTableSorting(pagination)`:

- `src/features/meeting-flow/ui/components/table/index.tsx:115`
- `src/features/schedule-management/ui/components/activities-table.tsx:50`
- `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx:127`
- `src/features/lead-sources-admin/ui/components/all-customers-section.tsx:112`
- `src/features/proposal-flow/ui/components/table/index.tsx:157`
- `src/features/project-management/ui/components/table/index.tsx:94`
- `src/shared/entities/customers/components/customers-table.tsx:96`

## Behavior change

**None.** All 13 sites already resolve to `createdAt`-desc; this refactor moves
that default into the two shared primitives without altering emitted SQL or the
rendered arrow. The win is DRY + a convention that new tables inherit for free.

## Verification

- `pnpm tsc` — the loose `columnMap` type keeps all 6 DAL sites compiling; the 7
  client sites lose an argument cleanly.
- `pnpm lint`.
- **Projects table check (explicitly requested):** confirm
  `projectsRouter.crud.list` with no `?sort` param still emits
  `ORDER BY created_at DESC` and the Projects records table shows newest-first
  with the `createdAt` header arrow. Expected: unchanged from today.

## Related observation (out of scope, flag for follow-up)

The projects table already defaults to `createdAt`-desc in code today, so this
refactor does not change what it renders. If projects has ever *looked*
mis-ordered, the probable cause is **tied `createdAt` values from bulk portfolio
imports** (rows inserted in the same instant sort arbitrarily within the tie and
can be unstable across pages). The fix for that is a stable secondary sort key
(e.g. `desc(createdAt), desc(id)`), which is a separate change from this
enforcement refactor. Raise as a follow-up if the ordering still looks off after
this ships.
