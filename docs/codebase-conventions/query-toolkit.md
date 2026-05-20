# Query Toolkit (Pagination, Sort, Search, Filters)

A four-layer toolkit at `src/shared/dal/{server,client}/lib/query/` and `src/shared/components/query-toolbar/`. It bundles pagination + page-size + debounced search + sort + filters into one URL-persisted state machine on the client, and Zod-validated input + parallel page+count queries on the server. **Always use the toolkit** — never hand-roll page state, debounced search, sort wiring, or `placeholderData: keepPreviousData`.

## The four layers

```
Server primitives        →  paginatedQueryInput, paginate, buildSearchWhere,
(src/shared/dal/server/      buildOrderBy, buildFilterWhere
  lib/query/)

Client hook              →  usePaginatedQuery(factory, extra, options)
(src/shared/dal/client/
  lib/query/)

UI primitive             →  <QueryToolbar pagination={p}> compound component
(src/shared/components/      with Search/Filters/PageSize/ClearAll/Sort slots
  query-toolbar/)

Container adapters       →  toDataTablePagination(p), toDataTableSorting(p)
(src/shared/components/      (kanban/calendar containers get their own adapter)
  data-table/lib/)
```

Each layer is replaceable. New containers (kanban, calendar) get their own adapter — never bypass `usePaginatedQuery`.

## Rules

### always-use-usepaginatedquery

Any tRPC procedure with pagination is consumed via `usePaginatedQuery(factory, extra, options)`. Never hand-roll page state with `useState`, never wire your own search debounce, never set `placeholderData` manually for paginated views.

**Why**: hand-rolled state diverges. Filter URL syntax, page-size reset rules, prefetch logic, `keepPreviousData` semantics — the toolkit gets these right consistently. Hand-rolled gets them wrong differently each time.
**Reference impl**: `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx`
**Enforced by**: convention

### paginated-input-via-composer

Server procedures take their input from `paginatedQueryInput(filtersShape)`. Procedures `.extend({ id })` to add business inputs at the top level — pagination/sort/search/filters live in their nested namespaces.

```ts
const inputSchema = paginatedQueryInput({
  pipeline: z.array(z.string()).optional(),
  createdAt: dateRangeSchema.optional(),
}).extend({
  leadSourceId: z.string().uuid().optional(),
})
```

Returns `{ pagination: { limit, offset }, sort?, search?, filters?: { ... } }`.

**Why**: every paginated procedure shares the same outer shape — uniform serialization, uniform default handling, uniform URL state.
**Reference impl**: `src/shared/dal/server/lib/query/schemas.ts`
**Enforced by**: tsc + convention

### paginate-runs-query-and-count-parallel

DAL functions return `PaginatedResult<T> = { rows: T[], total: number }` via `paginate({ query, count })` — which fires both queries in parallel.

```ts
return paginate({
  query: db.select().from(t).where(where).orderBy(orderBy).limit(L).offset(O),
  count: db.select({ count: count() }).from(t).where(where),
})
```

**Why**: latency. Running count after rows doubles wall time.
**Reference impl**: `src/shared/dal/server/lib/query/output.ts`
**Enforced by**: convention

### filter-types-via-registry

Filter parser registry at `src/shared/dal/client/lib/query/filter-parser-registry.ts` defines four filter types:

| Type | UI | URL serialization |
|---|---|---|
| `select` | single-value dropdown | `?key=value` |
| `multi-select` | multi-checkbox chip | `?key=a,b,c` |
| `date-range` | from/to picker | `?key=2026-01-01_2026-03-01` |
| `boolean` | switch / chip | `?key=true` |

Adding a new filter type means adding it to the registry — keeps URL/UI/server parsing aligned.

**Why**: filter parsing is the most error-prone part of URL state; a single registry locks the contract.
**Reference impl**: `src/shared/dal/client/lib/query/filter-parser-registry.ts`
**Enforced by**: tsc (registry is the type source)

### reserved-url-key-suffixes

URL keys `p`, `q`, `sort`, `dir`, `ps` are reserved for pagination, search, sort, sort-direction, page-size. Filter ids cannot use these names.

**Why**: collision = silently broken state.
**Reference impl**: `src/shared/dal/client/lib/query/use-paginated-query.ts`
**Enforced by**: convention

### param-prefix-when-multiple-tables

When two paginated tables coexist on one page, give each a `paramPrefix` so their URL states don't collide: `usePaginatedQuery(..., ..., { paramPrefix: 'src' })` produces `?src_p=2&src_q=foo`.

**Why**: two tables sharing `?p=` reset each other on every page change.
**Reference impl**: `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx` (`src_*`) vs `all-customers-section.tsx` (`all_*`)
**Enforced by**: convention

### query-toolbar-is-container-agnostic

`<QueryToolbar pagination={p}>` works above DataTable, kanban, card grid — same toolbar component. New containers add their own adapter.

**Why**: the toolbar UX is consistent across the app; only the result-rendering changes per container.
**Reference impl**: `src/shared/components/query-toolbar/`
**Enforced by**: convention

## TanStack Query `placeholderData: keepPreviousData`

`usePaginatedQuery` applies this automatically. For ad-hoc queries with dynamic keys (modals with tab state, drawers with filter chips), apply explicitly:

```ts
import { keepPreviousData, useQuery } from '@tanstack/react-query'
useQuery({ ...trpc.x.y.queryOptions(input), placeholderData: keepPreviousData })
```

**Apply when**: queryKey changes from user-controlled input (page, filter, search, tab).
**Do not apply when**: stale data would be misleading (switching to a different entity in a detail panel — show a skeleton).

**Why**: keeps prior data visible during the new fetch (`isPlaceholderData === true`). Without it, the UI unmounts to a skeleton on every key change.

## Legacy filter scaffolding (deprecated)

These are marked `@deprecated` and used only by the Activities table:

- `DataTableFilterConfig`, `DataTableFilterBar`, `useTableUrlFilters`, `DataTableTimePresetFilter`

Records pages (Meetings, Proposals, Projects) and Customer Pipelines have already been migrated. Activities table migration is a follow-up issue.

## Anti-patterns

- **`useState(1)` for page + manual debounce for search.** Use `usePaginatedQuery`.
- **`placeholderData: keepPreviousData` set manually on a paginated query.** `usePaginatedQuery` already does this.
- **Filter keys named `p`, `q`, `sort`, `dir`, or `ps`.** Reserved; pick another name.
- **Running rows + count sequentially on the server.** Use `paginate({ query, count })`.
- **Hand-rolled pagination in a new kanban/calendar container.** Write an adapter from `usePaginatedQuery` output, don't bypass.

## See also

- `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx` — reference full-stack impl
- `src/shared/components/data-table/lib/` — container adapters
- `docs/codebase-conventions/dal-conventions.md` — DAL conventions (paginate lives in shared DAL)
