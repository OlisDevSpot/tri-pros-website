# Data Table Default Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize `createdAt`-desc as the automatic default sort for server-paged data tables, removing 13 hand-repeated `createdAt` arguments.

**Architecture:** Move the default into the two shared sort primitives. `buildOrderBy` (server data order) resolves order by precedence — explicit sort → explicit fallback → `createdAt` convention → no sort. `toDataTableSorting` (client visual arrow) defaults `fallbackVisual` to `createdAt`-desc. Both stay overridable; neither forces a `createdAt` column to exist.

**Tech Stack:** TypeScript, Drizzle ORM, TanStack Table, tRPC.

## Global Constraints

- Behavior-preserving refactor — all 13 existing call sites already resolve to `createdAt`-desc; emitted SQL and rendered arrows MUST stay identical.
- No new dependencies.
- Verify with `pnpm tsc` + `pnpm lint` only. NEVER `pnpm build`.
- Work on `main`, stage explicitly by path — never `git add -A`.
- No manual test files added (no behavior change to assert); `tsc` is the correctness gate for the type-level cleanup.

---

### Task 1: Default the server data order in `buildOrderBy`

**Files:**
- Modify: `src/shared/dal/server/lib/query/sort.ts`
- Modify (call-site cleanup): `src/shared/entities/projects/dal/server/queries.ts:232`
- Modify (call-site cleanup): `src/shared/entities/proposals/dal/server/queries.ts:228`
- Modify (call-site cleanup): `src/shared/entities/meetings/dal/server/queries.ts:153`
- Modify (call-site cleanup): `src/trpc/routers/lead-sources.router.ts:307`
- Modify (call-site cleanup): `src/trpc/routers/customers.router/business.router.ts:68`
- Modify (call-site cleanup): `src/trpc/routers/schedule.router/activities.router.ts:61`

**Interfaces:**
- Produces: `buildOrderBy<TKey extends string>(sort: SortFields | undefined, columnMap: Record<TKey, SortTarget>, fallback?: SQL): SQL[]` — `fallback` is now optional. When no explicit sort and no `fallback`, returns `[desc(columnMap.createdAt)]` if a `createdAt` key exists, else `[]`.

- [ ] **Step 1: Rewrite the `buildOrderBy` body with the precedence cascade**

In `src/shared/dal/server/lib/query/sort.ts`, replace the function body. Keep the `SortTarget` type and imports (`asc`, `desc`) as-is.

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

- [ ] **Step 2: Update the JSDoc above `buildOrderBy`**

Replace the existing doc comment's "Falls back to `fallback`…" paragraph and `@example` with precedence-aware wording:

```ts
/**
 * Translate a query input's `sort` group into a Drizzle `orderBy` argument
 * list. The `columnMap` whitelists which keys are sortable and maps each to
 * a column or SQL expression — this is the boundary that prevents a malicious
 * `sortBy: 'password'` from reaching SQL.
 *
 * Order is resolved by precedence:
 *   1. Explicit `sort.sortBy` when whitelisted in `columnMap`.
 *   2. Explicit `fallback` (escape hatch for a non-`createdAt` natural order).
 *   3. `createdAt` convention — `desc(columnMap.createdAt)` when the map has a
 *      `createdAt` key. This is the default for every record table.
 *   4. No ordering (natural order) — housekeeping entities with neither a
 *      `createdAt` column nor an explicit `fallback`.
 *
 * Spread the result into `.orderBy(...)`:
 *
 * @example
 *   // Record table — createdAt convention supplies the default, no 3rd arg:
 *   .orderBy(...buildOrderBy(input.sort, {
 *     name: customers.name,
 *     createdAt: customers.createdAt,
 *   }))
 *
 * @example
 *   // Override the default natural order explicitly:
 *   .orderBy(...buildOrderBy(input.sort, { name: customers.name }, asc(customers.name)))
 */
```

- [ ] **Step 3: Remove the redundant `desc(...createdAt)` 3rd arg at all 6 call sites**

Each call currently ends `}, desc(<table>.createdAt))`. Change the closing to `})`. The maps all contain `createdAt`, so the convention branch reproduces the same order.

- `projects/dal/server/queries.ts:238` — `}, desc(projects.createdAt))` → `})`
- `proposals/dal/server/queries.ts` — `}, desc(proposals.createdAt))` → `})`
- `meetings/dal/server/queries.ts` — `}, desc(meetings.createdAt))` → `})`
- `lead-sources.router.ts` — `}, desc(customers.createdAt))` → `})`
- `customers.router/business.router.ts` — `}, desc(customers.createdAt))` → `})`
- `schedule.router/activities.router.ts` — `}, desc(activities.createdAt))` → `})`

After removing each 3rd arg, remove any now-unused `desc` import ONLY if `desc` is unused elsewhere in that file — most of these files use `desc`/`asc` in other queries, so verify per file with a grep before deleting an import. Do NOT delete imports still referenced.

- [ ] **Step 4: Type-check**

Run: `pnpm tsc`
Expected: PASS. The looser `columnMap` type keeps all 6 sites compiling; no site should error on the dropped argument.

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: PASS. Resolve any "unused `desc`" warnings surfaced by Step 3 by removing only genuinely-unused imports.

- [ ] **Step 6: Commit**

```bash
git add src/shared/dal/server/lib/query/sort.ts \
  src/shared/entities/projects/dal/server/queries.ts \
  src/shared/entities/proposals/dal/server/queries.ts \
  src/shared/entities/meetings/dal/server/queries.ts \
  src/trpc/routers/lead-sources.router.ts \
  src/trpc/routers/customers.router/business.router.ts \
  src/trpc/routers/schedule.router/activities.router.ts
git commit -m "refactor(dal): default buildOrderBy to createdAt-desc convention"
```

---

### Task 2: Default the visual arrow in `toDataTableSorting` + clean up call sites

**Files:**
- Modify: `src/shared/components/data-table/lib/to-data-table-sorting.ts`
- Modify (call-site cleanup): `src/features/meeting-flow/ui/components/table/index.tsx:115`
- Modify (call-site cleanup): `src/features/schedule-management/ui/components/activities-table.tsx:50`
- Modify (call-site cleanup): `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx:127`
- Modify (call-site cleanup): `src/features/lead-sources-admin/ui/components/all-customers-section.tsx:112`
- Modify (call-site cleanup): `src/features/proposal-flow/ui/components/table/index.tsx:157`
- Modify (call-site cleanup): `src/features/project-management/ui/components/table/index.tsx:94`
- Modify (call-site cleanup): `src/shared/entities/customers/components/customers-table.tsx:96`

**Interfaces:**
- Consumes: `DataTableServerSorting` from `@/shared/components/data-table/types` (unchanged).
- Produces: `toDataTableSorting<T>(p, options?)` — when `options.fallbackVisual` is omitted, defaults to `{ id: 'createdAt', desc: true }`.

- [ ] **Step 1: Default `fallbackVisual` in the return object**

In `src/shared/components/data-table/lib/to-data-table-sorting.ts`, change the returned `fallbackVisual`:

```ts
  return {
    sortBy: p.sortBy,
    sortDir: p.sortDir,
    onSortChange: p.setSort,
    fallbackVisual: options.fallbackVisual ?? { id: 'createdAt', desc: true },
  }
```

- [ ] **Step 2: Update the JSDoc example**

Change the `@example` block to reflect the new default and the override:

```ts
/**
 * ...
 * @example
 *   // Default: newest-first arrow on the createdAt column, no options needed.
 *   const pagination = usePaginatedQuery(...)
 *   <DataTable
 *     serverPagination={toDataTablePagination(pagination)}
 *     serverSorting={toDataTableSorting(pagination)}
 *     {...}
 *   />
 *
 * @example
 *   // Override when the default arrow should sit on a different column:
 *   toDataTableSorting(pagination, { fallbackVisual: { id: 'sentAt', desc: true } })
 */
```

- [ ] **Step 3: Drop the redundant options object at all 7 call sites**

Each call is `toDataTableSorting(pagination, { fallbackVisual: { id: 'createdAt', desc: true } })`. Change to `toDataTableSorting(pagination)`:

- `meeting-flow/ui/components/table/index.tsx:115`
- `schedule-management/ui/components/activities-table.tsx:50`
- `lead-sources-admin/ui/components/lead-source-customers-section.tsx:127`
- `lead-sources-admin/ui/components/all-customers-section.tsx:112`
- `proposal-flow/ui/components/table/index.tsx:157`
- `project-management/ui/components/table/index.tsx:94`
- `customers/components/customers-table.tsx:96`

- [ ] **Step 4: Type-check**

Run: `pnpm tsc`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/components/data-table/lib/to-data-table-sorting.ts \
  src/features/meeting-flow/ui/components/table/index.tsx \
  src/features/schedule-management/ui/components/activities-table.tsx \
  src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx \
  src/features/lead-sources-admin/ui/components/all-customers-section.tsx \
  src/features/proposal-flow/ui/components/table/index.tsx \
  src/features/project-management/ui/components/table/index.tsx \
  src/shared/entities/customers/components/customers-table.tsx
git commit -m "refactor(data-table): default fallbackVisual to createdAt-desc"
```

---

### Task 3: Verify against the projects table

**Files:** none (verification only).

**Interfaces:**
- Consumes: the shipped Task 1 + Task 2 changes.

- [ ] **Step 1: Confirm the projects DAL still defaults to createdAt-desc**

Read `src/shared/entities/projects/dal/server/queries.ts` around the `buildOrderBy` call. Confirm the `createdAt: projects.createdAt` key is still present in the map and the 3rd arg is gone. The convention branch now supplies `desc(projects.createdAt)`.

- [ ] **Step 2: Confirm the projects table still requests the createdAt arrow**

Read `src/features/project-management/ui/components/table/index.tsx:94`. Confirm it now reads `serverSorting={toDataTableSorting(pagination)}` and the default supplies the `createdAt` arrow.

- [ ] **Step 3: Runtime spot-check (manual)**

Start dev (`pnpm dev`), open the Projects records page with no `?pjSortBy` param in the URL. Expected: rows are newest-first and the `Created` column header shows the descending arrow. (Note per spec: this is expected to be identical to pre-refactor behavior — the refactor is behavior-preserving for projects.)

- [ ] **Step 4: Final gate**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.
