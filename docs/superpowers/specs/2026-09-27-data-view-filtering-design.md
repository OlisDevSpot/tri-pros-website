# Data-view filtering and sorting — design

> **Status:** draft for owner review, 2026-09-27. Brainstormed in one session; every section was shown and approved in chat. Nothing is built.
> **Cites:** records-management epic `docs/plans/2026-09-26-records-management-epic.md` (D29, O4, O7, D9/D21/D22), seed research `docs/plans/2026-09-27-data-view-filtering-research.md`. Code read on `main` at `28d94a6f`.
> **Scope (owner ruling):** everything in one spec: the core, the meetings records table, the schedule calendar (meetings + activities), the customers field list and the pipelines kanban. It is built in five phases (§12).

---

## 1. Worked flows (read these first)

Four traces through the design, using the real file names. The contract sections after them (§4–§9) explain each step.

### Flow 1. An agent opens the meetings records table with two filters

URL: `/dashboard/meetings?pm_meetingType=Fresh&pm_trade=<notionTradeId>&pm_sort=scheduledFor&pm_dir=asc`

1. **Server prefetch.** `src/app/(frontend)/dashboard/(records)/meetings/page.tsx` calls `loadDataViewQueryInput(searchParams, MEETINGS_RECORDS_TABLE_VIEW.query)`.
   - The URL parsers are built from `MEETING_FIELDS`. `pm_meetingType` is parsed as a literal of `meetingTypes`. `pm_trade` is parsed as strings and checked against the trade field's value schema. `pm_sort` is parsed as a literal of the sortable ids.
   - `deriveFilterSortState` and the **page** window build:
     ```ts
     { pagination: { limit: 20, offset: 0 },
       sort: { sortBy: 'scheduledFor', sortDir: 'asc' },
       filters: { meetingType: ['Fresh'], trade: ['<notionTradeId>'] } }
     ```
   - `prefetch(trpc.meetingsRouter.reads.list.queryOptions(input))`.
2. **Procedure.** `meetingsRouter.reads.list` validates the input with `fieldListInput(MEETING_FIELDS, { pagination: true })`. `meetingProcedure` sets `ctx.scope` to "the user takes part in the meeting", since agents are not super-admins.
3. **DAL.** `listMeetings` (`src/shared/entities/meetings/dal/server/queries.ts`) builds:
   ```ts
   where   = and(ctx.scope, searchWhere, buildFieldWhere(MEETING_FIELDS, MEETING_FIELD_SQL, input.filters))
           // → meeting_type IN ('Fresh') AND EXISTS (tradeSelections[].tradeId = '<id>')
   orderBy = buildFieldOrderBy(MEETING_FIELDS, MEETING_FIELD_SQL, input.sort, MEETINGS_DEFAULT_ORDER)
           // → scheduled_for ASC
   ```
4. **Client.** `MeetingsRecordsView` calls `useMeetingsTable(MEETINGS_RECORDS_TABLE_VIEW)` once, and that calls `useDataViewQuery(trpc.meetingsRouter.reads.list.queryOptions, {}, view.query)`.
   - It uses the same parsers and the same derivation, so it builds the same query key. The prefetched data is used and `checkHydrationParity` stays silent.
5. **Options.** `useMeetingsTable` also calls `useMeetingFieldOptions()`. Its result is passed down as plain data, never as a hook.
   - Trades load (`constructionRouter.trades.getAll` is open to everyone), so the Trade filter shows with names.
   - Reps (`getInternalUsers`) and lead sources (`leadSourcesRouter.list`) refuse an agent. Those two options stay `undefined`, and the Rep and Lead source filters are hidden.
6. **Toolbar.** The chips read "Meeting type: Fresh" and "Trade: Kitchen Remodel". The agent adds Outcome → `filterSort.setFilter('outcome', [...])` → the URL gains `pm_outcome` and drops `pm_p` → a new key, so the data is fetched.
7. **Bad URLs behave the same on the server and in the browser.**
   - `pm_meetingTyp=Fresh` (a misspelled key) has no parser, so it is ignored.
   - `pm_meetingType=Bogus` fails the literal parser, so the filter is inactive.
   - `pm_sort=password` fails the literal parser, so the read falls back to the view's `defaultSort`.

### Flow 2. A super-admin filters the calendar by rep and steps a week

URL: `/dashboard/schedule?show=meetings&s_v=week&s_d=2026-09-27&s_rep=<userId>`

1. **Server prefetch.** `src/app/(frontend)/dashboard/schedule/page.tsx` reads `show` and picks `SCHEDULE_MEETINGS_QUERY`. It then calls `loadDataViewQueryInput(searchParams, SCHEDULE_MEETINGS_QUERY)`.
   - The **date window** is `businessWeekWindow('2026-09-27')`, computed in `America/Los_Angeles`, never in the browser's timezone. It becomes `filters.scheduledFor = { from: '2026-09-27T07:00:00.000Z', to: '2026-10-04T06:59:59.999Z' }`.
   - The config adds `pagination: { limit: 500, offset: 0 }` and the fixed sort `scheduledFor asc`.
   - The rep filter adds `filters.rep = ['<userId>']`.
2. **Procedure and DAL.** The same `meetingsRouter.reads.list` and `listMeetings` as in flow 1. The super-admin's `ctx.scope` is `null`. The `rep` condition is `EXISTS (meeting_participants WHERE user_id IN (…))`.
3. **Client.** `ScheduleView` reads `show` (nuqs), picks the same config and calls `useDataViewQuery` once. The key matches, so the prefetched data is used.
4. **Stepping a week.** "Next" in `CalendarHeader` calls `window.step(1)`, which writes `s_d=2026-10-04`. That is a new key, so the week is fetched. `s_rep` stays and the filter keeps applying.
5. **Switching to activities.** `show=activities` picks `SCHEDULE_ACTIVITIES_QUERY`. It uses the same `s_d` and `s_v`, so the same week shows. Its filters come from `ACTIVITY_FIELDS` (`s_ownerId`, …).
   - `s_rep` stays in the URL, but the activities config has no parser for it, so it is ignored. Switching back restores it.
6. **Row cap.** In month view with 612 matching meetings, the response has `total = 612` against a cap of 500. The calendar shows "Showing 500 of 612" instead of dropping rows silently.

### Flow 3. A super-admin filters the fresh pipeline by lead source and sorts cards

URL: `/dashboard/pipeline/fresh?cp_leadSource=<leadSourceId>&cp_sort=createdAt&cp_dir=desc`

1. **Server prefetch.** `src/app/(frontend)/dashboard/pipeline/[pipeline]/page.tsx` calls `loadDataViewQueryInput(searchParams, CUSTOMER_PIPELINE_QUERY, { pipeline: 'fresh' })`. This prefetch is new; the page has none today.
   - The window is the **whole list**, so the input has no `pagination`:
     ```ts
     { pipeline: 'fresh', sort: { sortBy: 'createdAt', sortDir: 'desc' }, filters: { leadSource: ['<id>'] } }
     ```
2. **Procedure.** `customerPipelinesRouter.getCustomerPipelineItems` validates the input with `fieldListInput(CUSTOMER_FIELDS, { pagination: false }).extend({ pipeline })`.
3. **DAL.** `getCustomerPipelineItems` has moved to `src/shared/entities/customers/dal/server/pipeline-items.ts`.
   - The fresh branch keeps its aggregate query and its hand-written participant scoping, and ANDs `buildFieldWhere(CUSTOMER_FIELDS, CUSTOMER_FIELD_SQL, filters)` onto its `customers` rows.
   - The order is `customers.createdAt DESC`. Without a `sort`, the branch keeps today's order as its explicit default.
4. **Client.** `CustomerPipelineView` calls `useDataViewQuery(..., { pipeline }, CUSTOMER_PIPELINE_QUERY)`.
   - `groupCustomersByStage` then groups the filtered list into stages. Cards within each stage keep the server order.
   - The metrics bar counts the filtered list.
   - The stage "Columns" popover (`useKanbanColumnFilter`) is unchanged.

### Flow 4. Adding one field later (e.g. a meetings "Program" filter)

1. Add `program: { label: 'Program', filter: multiSelect({ values: programs }) }` to `MEETING_FIELDS`.
2. `pnpm tsc` fails: `MEETING_FIELD_SQL.filter` is missing `program`. Add its condition.
3. Add `'program'` to a query config's `toolbar`. The URL parser, input schema, toolbar control and chip all come from the field list.
4. If it should sort, add `sort: true`. `pnpm tsc` then requires `MEETING_FIELD_SQL.sort.program`, and a column can use `sort: 'program'`.

**Typos fail at compile time:**
- `toolbar: ['progam']` fails `pnpm tsc`.
- A column `sort: 'progam'` fails `pnpm tsc`.
- A condition keyed `progam` fails the `satisfies FieldSql<…>` check.

Today the same field takes 4 files linked only by a string, and every mistake fails silently.

---

## 2. Goals, non-goals, success criteria

**Goals**
- Each entity has **one field list** beside its own DAL. Every consumer is type-checked against it: server conditions, the sort whitelist, the input schema, URL parsing, toolbar controls and column sort.
- The server side comes from the field list, or is required by type to cover it, and stays server-only.
- There is **one filter/sort UI**, `QueryToolbar`, that plugs into any data view (table, calendar, kanban) and does not assume pagination.
- The server prefetch and the client build the same query key for every migrated data view.
- Runtime options never feed URL parsing.

**Non-goals**
- The role gates themselves. They are recorded per field (§9) and built with #285's CASL.
- Moving the proposals, projects and campaign-leads tables onto field lists. They keep the current path, and later work retires it.
- The R2 customers **entity table** (L1). This effort gives customers their field list and one list read; R2 builds the table on top.
- Pipeline access scoping and the projects visibility gap (§14).

**Success criteria**
- `pnpm tsc` fails for each of these:
  - a field without SQL,
  - SQL for a field that doesn't exist,
  - a misspelled id in a toolbar, `defaultSort`, fixed filter or column `sort`,
  - a reserved URL name used as a field id.
- The four worked flows behave as written, with no `[prefetch drift]` in the dev console.
- Meetings, customers, activities and the kanban no longer call `buildFilterWhere` or `buildOrderBy`, and never fall back silently.
- The proposals, projects and campaign-leads tables build byte-identical query keys to today's.

---

## 3. Vocabulary (agreed 2026-09-27)

| Term | Meaning | Code |
|---|---|---|
| **field list** | One entity's filterable and sortable fields | `MEETING_FIELDS`, `defineFieldList()`, type `FieldList` |
| **field** | One entry in a field list | `FieldDefinition` |
| **filter kind** | How a field is filtered | `multi-select \| select \| date-range \| number-range \| boolean`, plus `fixed` (§4) |
| **value schema** | The zod shape of a field's value. It drives URL parsing and the tRPC input | `filter.schema` |
| **static options** / **runtime options** | Option labels known at build time vs loaded from a read | `options: [...]` vs `options: 'runtime'` |
| **filter conditions** + **sort whitelist** | Server-only SQL per field | `MEETING_FIELD_SQL = { filter, sort }`, type `FieldSql<F>` |
| **data view** | Any UI showing an entity's data: table, calendar, kanban | — |
| **window** | What limits how many rows come back: **page** (tables), **date window** (calendar), **whole list** (kanban) | `window.kind: 'page' \| 'date' \| 'whole-list'` |
| **filter/sort state** | Filters + search + sort, without the window | `FilterSortState`, `deriveFilterSortState()` |
| **query config** | The static constant a data view shares with its page prefetch | the `query` key on a table view; `DataViewQueryConfig` |
| **fixed filters** | Field values a data view sets in code, never from the URL or toolbar | `fixed: { sourceId }` (the "Customers from this source" pane) |
| **intended gate** | A filter's future CASL gate, recorded in §9. No code until #285 | — |
| **Show** toggle | The calendar's entity switch | URL `show=meetings\|activities` |

**Names approved with their sections:**
- `useDataViewQuery`, `loadDataViewQueryInput`, `fieldListInput`
- `buildFieldWhere`, `buildFieldOrderBy`
- the URL keys `d` and `v`, and `window.field`
- `useMeetingFieldOptions`
- `listCustomers`, `listActivities`
- `businessWeekWindow`, `businessDayWindow`
- `SCHEDULE_MEETINGS_QUERY`, `SCHEDULE_ACTIVITIES_QUERY`, `CUSTOMER_PIPELINE_QUERY`

Reused as they are: "table view", "entity table", `QueryToolbar`, "pipeline", "kanban".

---

## 4. The field list contract

**Location.**
- Entity-specific definitions live in the entity's own `dal/` (owner ruling). The field list goes directly in `dal/`, because both client and server import it. That is a new pattern: today `dal/` only has `server/` and `client/`.
- Its SQL goes in `dal/server/`.
- Generic pieces go in `src/shared/dal/lib/query/` (client and server) and `src/shared/dal/server/lib/query/` (server-only).

| Piece | Path |
|---|---|
| Types + builders | `src/shared/dal/lib/query/field-list.ts` |
| Meetings field list | `src/shared/entities/meetings/dal/meeting-fields.ts` |
| Meetings SQL | `src/shared/entities/meetings/dal/server/meeting-field-sql.ts` (`import 'server-only'`) |
| Activities | `src/shared/entities/activities/dal/activity-fields.ts` + `dal/server/activity-field-sql.ts` |
| Customers | `src/shared/entities/customers/dal/customer-fields.ts` + `dal/server/customer-field-sql.ts` |

**Shape** (a sketch; the plan fixes the exact generics):

```ts
type FilterSpec =
  | { kind: 'multi-select', schema: ZodType<string[]>, options: readonly FilterOption[] | 'runtime' }
  | { kind: 'select', schema: ZodType<string>, options: readonly FilterOption[] | 'runtime' }
  | { kind: 'date-range', schema: typeof dateRangeSchema, presets?: readonly TimePreset[] }
  | { kind: 'number-range', schema: typeof numberRangeSchema, min: number, max: number, step?: number, formatValue: (n: number) => string }
  | { kind: 'boolean', schema: ZodBoolean }
  | { kind: 'fixed', schema: ZodType }            // fixed filters only: never in URL or toolbar

interface FieldDefinition {
  label?: string                                   // required unless filter.kind is 'fixed' and not sortable
  filter?: FilterSpec
  sort?: true
}

export function defineFieldList<const T extends Record<string, FieldDefinition>>(fields: T & NoReservedIds<T>): T
```

**Builders keep options and schema from drifting apart:**
- `multiSelect({ values, labels? })` and `select({ values, labels? })` derive the static options *and* the `z.enum` schema from one const array.
- `multiSelect({ schema, options: 'runtime' })` is for runtime options.
- `dateRange({ presets })`, `numberRange({ … })`, `boolean()` and `fixedOnly(schema)`.

**Derived types** (all computed from `typeof MEETING_FIELDS`):
- `FilterId<F>`: every field with a filter, fixed ones included.
- `ToolbarFilterId<F>`: filters that aren't fixed.
- `RuntimeOptionId<F>`: filters with runtime options.
- `SortId<F>`: fields with `sort: true`.
- `FilterValues<F>`: `{ [K in FilterId<F>]?: z.infer<schema> }`.

**Reserved ids.** `p q sort dir ps d v` are rejected at compile time by `NoReservedIds`. This replaces the dev-only throw in `url-state.ts:31` for field-list consumers. `show` is not reserved: the calendar owns it outside any prefix.

**Search stays separate from fields.** It remains a per-read list of `ilike` columns. A column can be searched and also be a field; the two are independent.

---

## 5. Server side

**Input schema.**
- `fieldListInput(fields, { pagination })` returns today's envelope, `{ pagination?, sort?, search?, filters? }`.
- `filters` is `z.object` of every `FilterId`, each optional and typed by its value schema.
- `sort.sortBy` is `z.enum(SortId[])`. This replaces the loose `z.string()` in `schemas.ts:12`.
- `pagination: false` omits `pagination` (the kanban).
- Business inputs are added with `.extend({ … })` (e.g. `pipeline`). `RESERVED_QUERY_INPUT_KEYS` still applies.

**SQL map**, beside the entity DAL and server-only:

```ts
export const MEETING_FIELD_SQL = {
  filter: {
    meetingType: v => inArray(meetings.meetingType, v),
    trade: v => sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${meetings.flowStateJSON}->'tradeSelections') t WHERE t->>'tradeId' = ANY(${v}))`,
    // … one per FilterId, including fixed ones
  },
  sort: {
    meetingType: meetings.meetingType,
    scheduledFor: meetings.scheduledFor,
    // … one per SortId
  },
} satisfies FieldSql<typeof MEETING_FIELDS>
```

- **`FieldSql<F>`** is `{ filter: { [K in FilterId<F>]: (value: FilterValue<F, K>) => SQL | undefined }, sort: { [K in SortId<F>]: AnyColumn | SQL } }`. A missing key fails `pnpm tsc`, and so does an extra or misspelled one, because `satisfies` checks excess properties.
- **`buildFieldWhere(fields, fieldSql, filters)`** ANDs the conditions for every present value. There is no silent skip: every id is guaranteed a condition by type.
- **`buildFieldOrderBy(fields, fieldSql, sort, defaultOrder)`**. `defaultOrder` is required, so each read states its natural order and there is no hidden `createdAt` convention.
- **Joins that conditions need are the read's job.** For example, `leadSource` sorts by `leadSourcesTable.name`, so the meetings count query gains the lead-source join (today `queries.ts:171-178` joins only `customers`).
- **The legacy path is untouched.** `buildFilterWhere`, `buildOrderBy` and `paginatedQueryInput` stay unchanged for proposals, projects and campaign leads.

---

## 6. Filter/sort state, windows and hydration parity

**Query config** (static; `satisfies DataViewQueryConfig<typeof FIELDS>`):

```ts
query: {
  fields: MEETING_FIELDS,
  paramPrefix: 'pm',
  toolbar: ['meetingType', 'proposalStatus', 'trade', 'rep', 'leadSource', 'outcome', 'scheduledFor', 'createdAt', 'pipeline'],
  defaultSort: { sortBy: 'scheduledFor', sortDir: 'desc' },
  fixed: {},                                      // optional; typed FilterValues<F>
  window: { kind: 'page', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS },
}
```

**Windows:**

| kind | URL keys | Adds to input |
|---|---|---|
| `page` | `p`, `ps` | `pagination: { limit, offset }`, same rules as today: page floor, page-size allowlist, `MAX_PAGE` |
| `date` | `d` (anchor `YYYY-MM-DD`, default `businessToday()`), `v` (`today \| week \| month`, today's `CalendarViewType`, default `week`) | `filters[window.field] = { from, to }` from `businessDayWindow` / `businessWeekWindow` / `businessMonthWindow`, and `pagination: { limit: window.cap, offset: 0 }` |
| `whole-list` | — | nothing |

**Date-window details:**
- `window.field` must be a `date-range` field id.
- `to` is the next boundary minus 1 ms, because the date-range condition is inclusive on both ends. A meeting at exactly midnight therefore lands in one window, not two.
- The `business-time.ts` helpers pin boundaries to `BUSINESS_TIMEZONE`.
- `getDateRange` in `calendar-helpers.ts:60`, which uses the browser's local timezone, is no longer used for fetching.

**Pure derivation**, in `src/shared/dal/lib/query/` and shared by server and client:
- `makeDataViewParsers(config)` builds parsers from value schemas:
  - static options → `parseAsStringLiteral`;
  - runtime options → `parseAsArrayOf(parseAsString)` and then a check against the value schema;
  - sort → a literal of the `SortId`s;
  - window keys by kind.
- `deriveFilterSortState(urlState, config)` returns `{ sort, search, filters }`. It adds `fixed`, drops invalid values and uses `defaultSort` when there's no valid sort.
- `deriveDataViewInput(urlState, config)` is `deriveFilterSortState` plus the window.

**Server:** `loadDataViewQueryInput(searchParams, config, extra?)` generalizes `loadPaginatedQueryInput` (`load-paginated-query-input.ts`).

**Client:** `useDataViewQuery(queryOptionsFactory, extra, config)` generalizes `usePaginatedQuery`. It returns a plain object:

```ts
{
  rows, total, isLoading, isFetching, isPlaceholderData, isError, error, refresh,
  filterSort: { fields, toolbar, filters, activeFilterCount, searchInput, setSearchInput,
                sortBy, sortDir, setSort, setFilter, clearFilters },
  window: { kind: 'page', page, pageSize, pageSizeOptions, pageCount, setPage, setPageSize }
        | { kind: 'date', anchor, view, range, setAnchor, setView, step }
        | { kind: 'whole-list' },
}
```

- **Setters.** A filter, sort or search change resets `p` and never moves the date window. `clearFilters` leaves fixed filters and the window alone.
- **Parity.** `checkHydrationParity` runs on first mount, as today. `placeholderData: keepPreviousData` keeps the current week on screen while the next one loads.
- **No hooks as props (owner rule).** A data view or entity-table hook calls `useDataViewQuery` and `use<Entity>FieldOptions` once. Everything below it receives plain objects.

**Parity rules:**
- Everything that shapes the key is static config plus the URL, derived by one pure function.
- Runtime options never enter parsing.
- The date window never reads the browser's timezone.

The only accepted gap: with no `d` in the URL, the server and the browser both take `businessToday()`. They disagree only when a request straddles LA midnight, which costs one refetch.

**The legacy path is kept as it is.** `usePaginatedQuery`, `derivePaginatedQueryState` and `loadPaginatedQueryInput` stay unchanged for proposals, projects and campaign leads, so their keys are byte-identical.

---

## 7. `QueryToolbar`

- **Root.** `<QueryToolbar.Root query={query} options={options} entityName="meeting">`, where `query` is the object `useDataViewQuery` returns. `QueryToolbarProvider` puts `query.filterSort` and `query.window` in context.
- **Filters.** Built from `filterSort.fields` plus `filterSort.toolbar`. Each filter kind maps to the existing `filterRendererRegistry` controls through a small adapter, so no filter control is rebuilt.
- **Runtime options.**
  - `options` is typed `{ [K in RuntimeOptionId ∩ toolbar]: FilterOption[] | undefined }`.
  - `undefined` (still loading, or refused) hides that filter.
  - A URL value for a hidden filter still shows a removable chip ("Rep · 1"), and the server still applies it.
- **Entity option hooks.**
  - `useMeetingFieldOptions()` in `shared/entities/meetings/hooks/`, `useCustomerFieldOptions()` and `useActivityFieldOptions()`.
  - Each runs its option reads with `retry: false`. A refused read fails once, stays cached, and the filter stays hidden.
  - The reads keep their current guards (owner ruling: hide until options load).
- **`Sort` slot (new).**
  - A select over the config's sortable ids plus a direction toggle.
  - The kanban uses it for the order within a stage.
  - Tables keep header sorting and also show the slot in the mobile "Filter and sort" sheet.
  - The calendar leaves it out, because its order is fixed.
- **Window slots.** `PageSize` and the page keyboard shortcuts render only for `window.kind === 'page'`. The calendar's dates are driven by the existing `CalendarHeader`, which is wired to `window.step`, `setView` and `setAnchor`.
- **Structure.** `query-toolbar.tsx` (759 lines, 19 components) is split into one component per file under `query-toolbar/ui/` (Rule 1). `QueryToolbar` stays the compound export.
- **Legacy adapter.** `fromPaginatedQuery(result)` wraps a `PaginatedQueryResult` as a page-window query. The proposals, projects and campaign-leads tables pass it and need no other edits.

**`DataTable` and column registries:**
- `ColumnSpec.sortable?: boolean` becomes `sort?: TSortId`, and `useEntityColumns` puts it on the column `meta`. `DataTable` translates between column id and sort id both ways: a header click sends the `sort` id, and the arrow finds the column whose `sort` matches `sortBy`.
  - Column keys therefore stay the same, and so do saved column-visibility settings.
  - The meetings Rep column (`ownerName`) sorts by `rep`.
- Registries on a field list type `sort` as `SortId<F>`. The proposals and projects registries type it as `string` and change mechanically from `sortable: true` to `sort: '<same key>'`, so only one mechanism remains.
- `toDataTablePagination` and `toDataTableSorting` take the new result shape. The legacy adapter keeps the old tables working.

---

## 8. Consumers

### 8.1 Meetings records table (phase 2)
- **Data.** `MEETINGS_RECORDS_TABLE_VIEW.query` becomes a `DataViewQueryConfig` with `MEETING_FIELDS` (§6 example). `useMeetingsTable` switches to `useDataViewQuery` plus `useMeetingFieldOptions`.
- **Columns.**
  - New: **Meeting type**, and **Booked on** (hidden by default).
  - The Customer cell gains phone and address quick actions. The row already carries the gated phone and address (`queries.ts:142-147`).
  - `scheduledFor`, `customerName`, `leadSource`, `ownerName` (→ `rep`) and `meetingOutcome` (→ `outcome`) get a `sort`.
- **Unchanged callers.** The agent dashboard's `meetingsWindowInput` and `meetingsMonthInput` (`features/agent-dashboard/constants/dashboard-queries.ts`) keep compiling through `satisfies MeetingListInput`. Their ids (`scheduledFor`, `outcome`) and the sort key `scheduledFor` are unchanged.
- **`customerId` and `projectId`.** They stay as fixed fields because the input schema accepts them today, but no caller sends them. The plan checks for callers again. If there are still none, it asks the owner whether to drop them rather than keep dead conditions.

### 8.2 Schedule calendar (phase 3)
- **Show toggle.** `?show=meetings|activities` (default `meetings`), read with nuqs in `ScheduleView`. It picks one of two configs in `features/schedule-management/constants/schedule-queries.ts`, which replaces `schedule-query-inputs.ts`:
  - `SCHEDULE_MEETINGS_QUERY`: `MEETING_FIELDS`, prefix `s`, window `{ kind: 'date', field: 'scheduledFor', cap: 500 }`, `defaultSort: scheduledFor asc`. Toolbar: Meeting type, Outcome, Trade, Rep, Lead source, Proposal status.
  - `SCHEDULE_ACTIVITIES_QUERY`: `ACTIVITY_FIELDS`, prefix `s`, the same window on `scheduledFor`. Toolbar: Type, Related to, Owner.
- **Shared prefix.** Both configs use prefix `s`, so `s_d` and `s_v` carry across the toggle. A type-level check fails if the two configs' toolbar ids overlap.
- **Prefetch.** `page.tsx` prefetches only the shown entity, with `loadDataViewQueryInput`. `useSuspenseQueries` over the two fixed inputs is replaced by one `useDataViewQuery` for the shown entity.
- **Dates.** View mode and anchor date move from `useState` (`schedule-view.tsx:26`, `schedule-calendar.tsx:62`) into `s_v` and `s_d`. "Show Saturday" stays local state. `highlightDate` seeds `s_d` when present.
- **Row cap.** When `total > cap`, the calendar shows "Showing {cap} of {total}".
- **Order.** Day, week and month placement stays client-side.
- **Deleted** as dead code: `ActivitiesTable`, `ACTIVITY_FILTER_CONFIG` and `ACTIVITIES_TABLE_QUERY_CONFIG`.

### 8.3 Customers list read (phase 4)
- **One DAL read.** `listCustomers(ctx, input)` in `src/shared/entities/customers/dal/server/queries.ts` replaces the two router copies (`customers.router/business.router.ts:49-93`, `lead-sources.router.ts:227-278`).
  - `customersRouter.business.list` passes `ctx.scope`.
  - `leadSourcesRouter.getCustomers` keeps `superAdminProcedure` and its not-found check, and sets the fixed filters `sourceId` and `segment` (the `segment` input becomes a fixed filter).
- **Client migration.** The three existing customer tables switch from `usePaginatedQuery` to `useDataViewQuery`, with a config change only and no UI changes:
  - records `customers-table.tsx`,
  - lead-sources-admin `all-customers-section.tsx`,
  - `lead-source-customers-section.tsx`.
  This keeps one parser path per procedure, so a stale `?pc_sort=` bookmark is dropped by the parser instead of hitting the strict enum. Their column registry changes from `sortable` to `sort`, with `leadSourceName` → `sort: 'leadSource'`. R2 then builds the customers entity table on top.

### 8.4 Pipelines kanban (phase 5)
- **Read moves into the DAL.** `features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` moves to `src/shared/entities/customers/dal/server/pipeline-items.ts`. It gets a `// LAZY:` header naming `modules/customers/core/dal/server`, and the move fixes its Rule 19 breach.
- **Input.** `{ pipeline, search?, sort?, filters? }` with no pagination.
  - Every branch (leads, rehash/dead, fresh, projects) ANDs `buildFieldWhere(CUSTOMER_FIELDS, …)` onto its `customers` rows.
  - A chosen sort replaces the branch order.
  - Search is `ilike` on name and email.
  - The hand-written `isOmni` scoping moves unchanged.
- **Sort.** `CUSTOMER_PIPELINE_QUERY` (`features/customer-pipelines/constants/`, prefix `cp`, whole-list window, no `defaultSort`) lets each branch keep today's order. `cp_sort` overrides it.
- **Toolbar.** Search, Filters (Rep, Lead source, Created) and Sort. `pipeline` is not exposed, because the route decides it. The stage "Columns" popover stays as it is.
- **Metrics.** The metrics bar and column counts reflect the filtered list.
- **Prefetch.** The page gains `loadDataViewQueryInput(searchParams, CUSTOMER_PIPELINE_QUERY, { pipeline })`, a prefetch and `HydrateClient`.

---

## 9. Field lists v1 and intended gates

### Meetings: `MEETING_FIELDS`

Ids keep today's URL and input keys. The one change: the sort key `meetingOutcome` becomes `outcome`, and no caller sends `meetingOutcome` today.

| id | Label | Filter kind | Options | Sort | Condition / sort target | Intended gate |
|---|---|---|---|---|---|---|
| `meetingType` | Meeting type | multi-select | static `meetingTypes` | ✓ | `meeting_type IN …` | — |
| `proposalStatus` | Proposal status | multi-select | static: `none` + `proposalStatuses` | — | `none` → no proposal; others → a proposal exists in those statuses. Picks are OR'd | — |
| `trade` | Trade | multi-select | runtime: `constructionRouter.trades.getAll` (Notion ids) | — | `flowStateJSON.tradeSelections[].tradeId` matches any pick. JSONB until W4; the condition moves with W4 | — |
| `rep` | Rep | multi-select | runtime: `meetingsRouter.reads.getInternalUsers` | ✓ | a `meeting_participants` row for any pick / owner `user.name` | **super-admin** |
| `leadSource` | Lead source | multi-select | runtime: `leadSourcesRouter.list` | ✓ | `customers.lead_source_id IN …` / `lead_sources.name` | **super-admin** |
| `createdAt` | Booked on | date-range | presets | ✓ | `meetings.created_at` | — |
| `scheduledFor` | Scheduled | date-range | presets | ✓ | unchanged | — |
| `outcome` | Outcome | multi-select | static `meetingOutcomes` | ✓ | unchanged | — |
| `customerName` | Customer | — | — | ✓ | `customers.name` | — |
| `pipeline` | Pipeline | select | static | — | unchanged | — |
| `customerId`, `projectId` | — | fixed | — | — | unchanged | — |

Value schema for rep ids: `z.string().min(1)`. `user.id` is free text, not a uuid.

### Activities: `ACTIVITY_FIELDS`

| id | Label | Filter kind | Sort | Condition | Intended gate |
|---|---|---|---|---|---|
| `type` | Type | multi-select, static `activityTypes` | ✓ | `activities.type IN …` | — |
| `entityType` | Related to | multi-select, static `activityEntityTypes` | — | `activities.entity_type IN …` | — |
| `ownerId` | Owner | multi-select, runtime reps | — | `activities.owner_id IN …` | **super-admin** |
| `scheduledFor` | Scheduled | date-range | ✓ | unchanged | — |
| `title` | — | — | ✓ | `activities.title` | — |
| `dueAt`, `createdAt` | — | — | ✓ | columns | — |

- `ownerId` fixes a live bug. Today's schema is `z.string().uuid()` (`activities.router.ts:34`), which rejects every real user id.
- `listActivities` moves into `src/shared/entities/activities/dal/server/queries.ts`, and its owner scoping moves unchanged.

### Customers: `CUSTOMER_FIELDS`

| id | Label | Filter kind | Sort | Condition / sort target | Intended gate |
|---|---|---|---|---|---|
| `pipeline` | Pipeline | multi-select, static (5 buckets) | — | `derivedPipelineWhere` | — |
| `createdAt` | Created | date-range | ✓ | `customers.created_at` | — |
| `rep` | Rep | multi-select, runtime reps | — | the customer has a meeting this rep takes part in | **super-admin** |
| `leadSource` | Lead source | multi-select, runtime | ✓ | `customers.lead_source_id IN …` / `lead_sources.name` | **super-admin** |
| `name`, `email` | — | — | ✓ | columns | — |
| `sourceId` | — | fixed | — | `customers.lead_source_id = …` | — |
| `segment` | — | fixed | — | `buildSegmentWhere` | — |

**Intended gates are not built.** Every filter is open to everyone. In practice, runtime-option filters stay hidden when their option read refuses (§7). When #285 lands, each **super-admin** row above becomes an explicit CASL rule covering filter, sort and column together.

---

## 10. Behaviour changes (deliberate)

1. **The calendar windows on `scheduledFor` only** (owner, 2026-09-27: "Schedule doesn't care for createdAt, only for when it is scheduled").
   - Unscheduled meetings and activities with only a due date no longer appear.
   - The client placement fallbacks (`scheduledFor ?? createdAt` in `features/meeting-flow/lib/to-calendar-event.ts:13`, `?? dueAt ?? createdAt` in `features/schedule-management/lib/to-calendar-event.ts:15`) are removed to match.
2. **The calendar's view mode and date are in the URL** (shareable, survive reload). The calendar fetches the visible window instead of the 500 newest-created rows, and says so when the cap is hit.
3. **The calendar shows one entity at a time** through the Show toggle.
4. **The kanban gains search, filters, a sort, and a server prefetch.** Its metrics follow the filters.
5. **Meetings.**
   - The sort key `meetingOutcome` becomes `outcome`.
   - The Outcome column becomes sortable.
   - New columns: Meeting type, Booked on.
   - Customer quick actions.
6. **`sortBy` is a strict enum** on every migrated read. The parser drops invalid URL sorts before they reach the server.
7. **"Customers from this source" can sort by lead source.** Before, it silently fell back.
8. **The activities owner filter accepts real user ids.**

---

## 11. Error handling

| Case | Behaviour |
|---|---|
| Invalid URL value or unknown key | Dropped by the parser, identically on server and client, so the filter is inactive |
| Runtime-option value that no longer exists (deleted rep, renamed trade) | The condition matches nothing. The chip shows the raw count ("Trade · 1") and can be removed |
| Option read refused or failed | The filter is hidden. URL values still apply and show as removable chips |
| Programmatic caller passes a bad input | Typed callers fail `pnpm tsc`. At runtime zod returns `BAD_REQUEST` |
| Date window over the cap | "Showing {cap} of {total}". Rows are never dropped silently |
| DAL failure | `dalDbOperation` → `DalReturn` → `dalToTrpc`, as today. Views show `ErrorState` |

---

## 12. Phases (the plan follows this order)

| Phase | Contents | Gate to next |
|---|---|---|
| **P1 Core** | `field-list.ts` (types, builders, `NoReservedIds`), `fieldListInput`, parsers, `deriveFilterSortState`, windows, `loadDataViewQueryInput`, `useDataViewQuery`; `FieldSql`, `buildFieldWhere`, `buildFieldOrderBy`; `businessDayWindow` and `businessWeekWindow`; `QueryToolbar` split + new Root + `Sort` slot + `fromPaginatedQuery`; `ColumnSpec.sort` + `DataTable` sort-id mapping + mechanical registry change | Legacy tables unchanged (key parity); tsc and lint clean |
| **P2 Meetings** | `MEETING_FIELDS` and SQL, `listMeetings` switch, router input, table view + `useMeetingsTable`, `useMeetingFieldOptions`, new columns, quick actions | Flow 1 |
| **P3 Calendar** | `ACTIVITY_FIELDS` and SQL, `listActivities` DAL move, schedule configs, Show toggle, URL window, prefetch, cap notice, dead-code deletes, placement fallbacks | Flow 2 |
| **P4 Customers** | `CUSTOMER_FIELDS` and SQL, `listCustomers`, both procedures on it, three customer tables on `useDataViewQuery` | Customers records + both lead-source panes work |
| **P5 Kanban** | Pipeline read moves to the customers DAL, filters/sort/search in all branches, `CUSTOMER_PIPELINE_QUERY`, toolbar, prefetch | Flow 3 |

Other sessions commit to `main` concurrently. Each phase commits by explicit path.

---

## 13. Verification

- **Checks.** `pnpm tsc` and `pnpm lint` after every task. Never `pnpm build`.
- **Compile-time failures.** A throwaway file of `@ts-expect-error` cases, written in the scratchpad and never committed, checked with `pnpm tsc`. It proves each success-criteria failure in §2 fails.
- **Pure functions.** No unit runner in the repo. Throwaway `node:test` files are run with `pnpm exec tsx --test` outside the repo, covering:
  - `deriveFilterSortState` for valid, invalid and fixed inputs;
  - the windows: `businessWeekWindow` gives identical bounds under `TZ=UTC` and `TZ=Asia/Tokyo`, and the bounds sit across DST changes;
  - `deriveDataViewInput` for the legacy-parity case (old configs produce byte-identical input through the old path).
- **In the browser.** The four worked flows with Playwright (`/api/dev/playwright-session`), with the dev console checked for `[prefetch drift]`.
- **No database writes** for testing. Flows run on whatever dev data exists.

---

## 14. Found issues (outside this spec)

- **Pipeline access is enforced only by the UI.** `customerPipelinesRouter.getCustomerPipelineItems` (`agentProcedure`) accepts any pipeline. An agent who opens `/dashboard/pipeline/leads` gets the leads list with no scoping (`get-customer-pipeline-items.ts:44-63` takes no user). This needs its own fix. P5 moves the scoping unchanged and does not widen it.
- **The projects-pipeline visibility is wider than `projectVisibility`** (`docs/permissions/visibility-rules-catalog.md:122,189`).
- `move-customer-pipeline-item.ts`, `move-customer-to-pipeline.ts` and `customer-pipelines.router.ts` still import `db` (Rule 19).
- `leadSourcesRouter` still queries `db` inline in many procedures. Only `getCustomers` moves in P4.
