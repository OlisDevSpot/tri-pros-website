# Data-view filtering and sorting — seed research

> **Status:** research + owner rulings, 2026-09-27. No spec yet. Cited by the records-management epic (`docs/plans/2026-09-26-records-management-epic.md`, O4 / D29). Verify every file:line against the code before relying on it; it was read on `main` at `8e4397d1`.

## Owner rulings (2026-09-27)

1. **One definition per entity field** for filtering and sorting (approach "A": one field list per entity, with every consumer type-checked against it). Replaces today's hand-synced pieces.
2. **It must be semantically accurate:** filtering and sorting an entity's data is a **data-access concept**, so the definition lives in `shared/dal` (db filtration), not in the table.
3. **The filter/sort UI is a general `shared/components` component, pluggable into any data view.** A table is one way to display an entity's data; the same filter/sort UI and plumbing must also serve the calendar (`/dashboard/schedule`) and the pipelines (`/dashboard/pipeline(s)`), without being rebuilt per view.
4. It must keep working on the server: the server prefetch and the client produce the same query (hydration parity).
5. **Role-gated filters** (e.g. Rep, Lead source for super-admins) should eventually come from the CASL-native permission system shipped by #285. **For now, don't build the gate:** keep those filters available to everyone and record which ones are meant to be role-gated.
6. First consumer: the meetings entity table. **Meetings field list v1** (owner-approved, "more to come"):

| Field | Column | Filter | Sort | Note |
|---|---|---|---|---|
| Meeting type (Fresh / Follow-up / Rehash / Project) | new | multi-select | yes | the "fresh vs project" filter (records O7) |
| Proposal status (none / draft / sent / approved / declined) | exists (dots) | multi-select, "has a proposal in…" | — | subquery like the dots |
| Trade | exists | multi-select from the trade catalog | — | reads `flowStateJSON.tradeSelections` (JSONB until W4) |
| Rep (participant) | exists | multi-select | yes | meant super-admin-only (not gated yet) |
| Lead source | exists | multi-select | yes | meant super-admin-only; option list today is super-admin-only (`leadSourcesRouter.list`) |
| Booked on (`createdAt`) | optional | date range | yes | |
| Scheduled | exists | exists | exists | unchanged |
| Outcome | exists | exists | add sort | |
| Customer | exists + phone/address quick actions | — (search) | exists | row must carry gated phone + address (read change; reuse phone-gating SQL) |
| Pipeline (existing filter) | — | keep | — | owner: leave it |

## How one field travels today (meetings)

1. **Schema:** `src/shared/db/schema/meetings.ts` (e.g. `meetingType` enum, already on every list row via `getTableColumns`).
2. **Server list read:** `src/shared/entities/meetings/dal/server/queries.ts`
   - `meetingListFiltersSchema` (zod shape per filter id) → `paginatedQueryInput(...)` envelope (`src/shared/dal/server/lib/query/schemas.ts`)
   - `buildFilterWhere(input.filters, { id: value => SQL })` (`dal/server/lib/query/filters.ts`) — **silently skips** ids without a builder
   - `buildOrderBy(input.sort, { sortBy: column })` (`dal/server/lib/query/sort.ts`) — the column map **is** the sort whitelist; `sortBy` is `z.string()` and an unknown key silently falls back to `createdAt desc`
   - `paginate({ query, count })`; permission scope from `meetingProcedure` → `ctx.scope`
3. **Router:** `src/trpc/routers/meetings.router/reads.router.ts` (`list`).
4. **Client static config:** `MEETING_FILTER_CONFIG` (`src/shared/entities/meetings/constants/meeting-filter-config.ts`, `FilterDefinition[]` from `src/shared/dal/client/lib/types.ts`: select | multi-select | date-range | number-range | boolean); the table view `MEETINGS_RECORDS_TABLE_VIEW` (`src/features/records-management/constants/`) holds `query: PaginatedQueryConfig` (paramPrefix, pageSize, defaultSort, filters) + `columns`.
5. **URL ↔ input (isomorphic):** `makePaginatedParsers` / `derivePaginatedQueryState` (`src/shared/dal/lib/query/derive-paginated-query-state.ts`), `filterParserRegistry` (`filter-parser-registry.ts`; select/multi-select validate against `options` when present), `makeQueryParsers(prefix)` (`url-state.ts`, reserved suffixes p,q,sort,dir,ps).
6. **Client hook:** `usePaginatedQuery` (`src/shared/dal/client/hooks/use-paginated-query.ts`) + `checkHydrationParity` (`src/shared/lib/hydration-drift.ts`, dev-only). **Server prefetch:** `loadPaginatedQueryInput` (`src/shared/dal/server/lib/query/load-paginated-query-input.ts`) — same derivation, same config object, or the prefetch is wasted.
7. **Columns:** `ColumnRegistry`/`ColumnSpec`/`useEntityColumns` (`src/shared/components/data-table/lib/use-entity-columns.tsx`): label, size, sortable, format | custom cell, accessorFn, permission (column-only CASL gate, no server counterpart).
8. **Toolbar:** `QueryToolbar` (`src/shared/components/query-toolbar/`), `filterRendererRegistry` (one renderer per filter type). Adding a filter type = union + parser registry + renderer registry.

**Adding one filterable + sortable meetings field today:** 4 files, ~6 edits, linked only by a string id; any typo fails silently.

## Other consumers and differences

- `ColumnRegistry` users: meetings, customers, proposals, projects. `FilterDefinition` users: those four + schedule-management activities (`activity-filter-config.tsx`, table never mounted) + campaigns-admin leads (`build-leads-filter-config.ts`, built at runtime from campaign/source lists; its comment warns the parser list must be hand-synced).
- **Customers' three tables** (records page, lead-sources-admin "All customers", "Customers from this source") share `CUSTOMER_COLUMNS` + `CUSTOMER_FILTER_CONFIG` but use different procedures and guards: `customersRouter.business.list` (agent-scoped `customerProcedure`) vs `leadSourcesRouter.getCustomers` (`superAdminProcedure`, no visibility scope, extra non-filter `segment` input, no `leadSourceName` sort).
- **Pipelines** (`src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx`) filter only kanban **stage visibility** (`useKanbanColumnFilter`, `KanbanColumnFilter` in `shared/components/kanban`), not entity fields. **Schedule** (`src/features/schedule-management/ui/components/schedule-calendar*.tsx`, `schedule-today-view.tsx`) has its own filtering — not yet mapped; map it first.

## Known risks

- Hydration parity is config-identity based: any change to how configs serialize must keep `derivePaginatedQueryState`'s output identical for existing tables.
- Runtime option lists (trade catalog, reps, lead sources) must not feed URL validation, or server and client can parse the same URL differently.
- Pagination is table-specific: a calendar wants a date window, a kanban wants per-stage lists. The filter/sort contract must not assume `pagination`.
- The column `permission` gate has no server counterpart today; the future role gate should cover filter, sort and column together.
- Search (`ilike` on `meetingType::text`, customer name) coexists with filters; decide whether a field can be both.
