# Data-View Filtering and Sorting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each entity one field list in its own DAL, derive the server SQL, input schema, URL parsing, toolbar and column sorting from it, and run the meetings records table, the schedule calendar, the three customers tables and the pipelines kanban on that one path.

**Architecture:**
- **Isomorphic core** (`src/shared/dal/lib/query/`): the value schemas and shapes both sides share (`contracts.ts`), field-list types and builders, the query config, and one pure derivation from URL state to read input. It imports nothing from `dal/client/` or `dal/server/`.
- **Server core** (`src/shared/dal/server/lib/query/`): derives the zod input from a field list. Each entity declares its SQL once with `defineFieldSql(FIELDS, { filter, sort }, { defaultOrder, tieBreaker })`, which is type-checked against the field list and returns the `where` and `orderBy` its reads call.
- **Client core** (`src/shared/dal/client/`): one hook, `useDataViewQuery`, that returns plain data, including the loaded choices for the toolbar's runtime-option filters. `QueryToolbar` and `DataTable` consume that data. No hook is ever passed as a prop.
- **Legacy tables** (proposals, projects, campaign leads) keep `usePaginatedQuery` byte for byte and reach the new toolbar through one adapter, `fromPaginatedQuery`. Retiring the adapter is follow-up work recorded at hand-off (Task 21).

**Tech Stack:** Next.js 15, tRPC v11 (`@trpc/tanstack-react-query`), TanStack Query 5 / Table 8, nuqs 2, zod 4, Drizzle 0.45 (Postgres), CASL.

**Spec:** `docs/superpowers/specs/2026-09-27-data-view-filtering-design.md`. Read §1 (worked flows) before Task 1. Where the spec and this plan differ, the plan's "Deviations from the spec" section wins (revised after a code-level review on 2026-09-27). Research seed: `docs/plans/2026-09-27-data-view-filtering-research.md`.

## Global Constraints

- **Verification:** run `pnpm tsc` and `pnpm lint` after every task. Never run `pnpm build`. If an error is in a file this task did not touch (other sessions work in the same tree), report it and don't fix it.
  - Import order is lint-enforced. When lint reports it in a file this task touched, fix it with `pnpm exec eslint --fix <that file>`.
  - Type tests that assign to a read's input type (`MeetingListInput`, `ActivityListInput`, …) must include `pagination`: `z.infer` is the parsed shape, where `pagination` is required. Without it every `@ts-expect-error` fires for the wrong reason.
- **No database writes for testing:** no seeds, no updates, no `db:push`. Browser checks run on whatever dev data exists.
- **Committing:**
  - Commit only by explicit path: `git commit -m "…" -- <path> <path> …`.
  - Never use `git add -A`, `git add .`, `git add -u <dir>`, `git stash`, `git checkout -- .`, `git restore` on files you didn't create, or `git reset`.
  - Other sessions commit to `main` concurrently, and the index may hold their staged work.
  - Before every commit, run `git diff -- <each path>` and confirm every hunk is yours. If a path carries another session's uncommitted hunk, STOP and ask the owner.
  - After committing, run `git show --stat HEAD` and confirm only your paths are in it.
- **Commits are pre-approved only as written:** each task's commit step is the owner's request to commit exactly those paths. Commit nothing else (docs, memory, other sessions' files) unless the owner asks.
- **Commit trailer:** every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Imports:**
  - `features/` → `shared/` only. `shared/` never imports `features/`.
  - A feature imports another feature only through its public entrypoint (`ui/views/index.ts`, `ui/components/index.ts`, `lib/index.ts`, `types/index.ts`).
- **Database access:** `db` is imported only in `shared/dal/server/lib/`, `shared/entities/*/dal/server/` and `shared/modules/*/*/dal/server/`.
- **Coding conventions** (from the coding-conventions memory, which mirrors the repo):
  - one React component per file;
  - no file-level constants in component or view files;
  - named exports only (Next `page.tsx` / `layout.tsx` keep their required default export);
  - constants in `constants/`, pure functions in `lib/`, hooks in `hooks/`;
  - a context's own consumer reads with `use(Ctx)`;
  - shadcn components over native elements;
  - DAL functions return `DalReturn<T>` with explicit return types;
  - comments say why, never what; no new `DOCS.md`.
- **Names:** use only names from spec §3 or from the "Names this plan introduces" table below. That table must be approved by the owner before Task 1 starts. No name is promoted from an option label.
- **Legacy path untouched:** do not edit the code of `usePaginatedQuery`, `derivePaginatedQueryState`, `makePaginatedParsers`, `loadPaginatedQueryInput`, `buildFilterWhere`, `buildOrderBy`, `paginatedQueryInput` or `sortFieldsSchema`. Proposals, projects and campaign-leads query keys must stay byte-identical (checked in Task 21).
  - The one exception is import lines: Task 1 moves shared types into `contracts.ts`, and legacy files re-point their imports. No other line in them changes.
- **Reserved URL suffixes** for field ids: `p q sort dir ps d v`.
- **Date windows:**
  - Boundaries are computed in `America/Los_Angeles` through `src/shared/lib/business-time.ts`, never in the browser's timezone.
  - The window's `to` is the next boundary minus 1 ms.
  - Weeks start on Sunday.
  - The calendar caps a window at 500 rows.
- **Role gates are not built.** Every filter is open to everyone.
  - A runtime-option filter hides when its choices aren't loaded.
  - Its option read is only sent when the viewer passes the same ability check the read's server guard makes (`OPTION_SOURCE_READS[source].canRead`), so agents never trigger a refused read or a server error log.
  - That mirrors existing guards; it adds no new rule.

## Before Task 1: owner decisions this plan needs

1. **Approve the names in the table below**, including the ones added by the 2026-09-27 review: `contracts.ts`, `OPTION_SOURCES`/`OptionSource`/`OPTION_SOURCE_READS`/`OptionSourceRow`, `filterSort.options`, `defineFieldSql`/`FieldSqlMap`, `businessMonthGridWindow`, `toInclusiveRange`, `toScheduleWindowHref`.
2. **Rehash/dead kanban default order** (Task 19). Today `DISTINCT ON (customers.id)` forces the order to customer id, which is effectively random.
   - The plan switches that branch to `EXISTS` so a sort can apply.
   - Its default order becomes `updated_at DESC`, which is what the code already asks for after the id.
   - Say so if you want the id order kept.
3. **Rep sort vs Rep filter on meetings.** Sorting by Rep orders by the owner's name (the Rep column shows the owner); filtering by Rep matches any participant. For a co-owned meeting those can be different people. Default: keep both as written.

Ruled 2026-09-27 (plan review): `customerId` and `projectId` are dropped from the meetings list (no caller sends them), and the query config has no `fixed` key (no data view sets one; procedures set fixed filters themselves).

## Names this plan introduces (owner approval needed)

| Name | Meaning | Where |
|---|---|---|
| `ToolbarFilterSpec` | every filter kind except `fixed` | `field-list.ts` |
| `FixedFilterId<F>`, `DateRangeFilterId<F>` | ids of fixed fields / of date-range fields | `field-list.ts` |
| `ToolbarFilterValues<F>` | filter values the toolbar shows (fixed ones excluded) | `field-list.ts` |
| `SortDir`, `SortState<F>` | `'asc' \| 'desc'`; `{ sortBy, sortDir }` over a field list's sort ids | `field-list.ts` |
| `optionLabel` | builder argument that turns an option value into its label | `multiSelect`, `select` |
| `contracts.ts` | the value schemas and shapes client and server share: `dateRangeSchema`, `numberRangeSchema`, `DateRange`, `NumberRange`, `FilterOption`, `PaginatedResult` (existing names, moved) | `dal/lib/query/` |
| `RESERVED_URL_SUFFIXES` | the reserved suffix list above | `dal/lib/query/constants.ts` |
| `OPTION_SOURCES`, `OptionSource` | the reads a runtime-option filter can load its choices from (`trades`, `reps`, `leadSources`); a field names one with `source:` | `dal/lib/query/constants.ts`, `field-list.ts` |
| `OPTION_SOURCE_READS`, `OptionSourceRow` | each source's tRPC query plus the ability check that mirrors its server guard; the `{ id, name }` row every source returns | `dal/client/constants/option-source-reads.ts` |
| `DataViewWindow<F>`, `DataViewWindowKind` | the config's window (`page \| date \| whole-list`) | `data-view-query-config.ts` |
| `DataViewInput<F>` | what a migrated read accepts | same |
| `FilterSortState<F>`, `DataViewWindowState` | pure derivation outputs | same |
| `dataViewUrlKeys`, `deriveDataViewWindow` | URL key names; the window half of the derivation | `derive-data-view-input.ts` |
| `defineFieldSql`, `FieldSql<F>` (spec), `FieldSqlMap<F>` | declares an entity's SQL once and returns it with `where(filters)` and `orderBy(sort)`; the per-field map it checks | `field-sql.ts` |
| `dateRangeCondition` | inclusive `from`/`to` condition on a column, shared by every entity | `field-sql.ts` |
| `DataViewQueryResult`, `DataViewFilterSort` (incl. `options`), `DataViewWindowControls`, `PageWindowControls`, `DateWindowControls` | what `useDataViewQuery` returns | `dal/client/lib/types.ts` |
| `fromPaginatedQuery` (spec) | legacy adapter | `dal/client/lib/from-paginated-query.ts` |
| `ToolbarFilter`, `toToolbarFilters`, `toSortOptions` | a field turned into the existing `FilterDefinition` control descriptor, plus `hidden` | `query-toolbar/lib/` |
| `QueryToolbar.Sort` (spec), `QueryToolbar.RowCapNotice` | sort select + direction; "Showing 500 of 612" | `query-toolbar/ui/` |
| `DEFAULT_ORDER_VALUE`, `KEYBOARD_HINT_TEXT_WITHOUT_PAGING` | Sort slot's "Default order" item value; hint copy for non-page windows | `query-toolbar/constants/` |
| `mapColumnSortIds`, `getColumnId` | column id ↔ sort id maps; column id lookup (moved from `use-column-visibility.ts`) | `data-table/lib/` |
| `ColumnSpec.sort` (spec), `ColumnSpec.defaultHidden` | server sort id; hidden until turned on | `use-entity-columns.tsx` |
| `calendarViewTypes` | const for the existing `CalendarViewType` (moved to enums) | `shared/constants/enums/calendar.ts` |
| `isCalendarDay`, `businessMonthGridWindow`, `toInclusiveRange`, `calendarDayToLocalDate`, `localDateToCalendarDay` | `YYYY-MM-DD` validation; every day a month grid draws; `[from, to)` → the inclusive form filters use; display conversion for the calendar grid | `business-time.ts`, `calendar-helpers.ts` |
| `MeetingCustomerCell` | Customer cell with phone + address quick actions | `entities/meetings/components/` |
| `SCHEDULE_ROW_CAP`, `SCHEDULE_SHOW_VALUES`, `ScheduleShow`, `scheduleShowParser` | calendar cap; Show toggle values and parser | `schedule-management/constants/` |
| `ScheduleMeetingsCalendar`, `ScheduleActivitiesCalendar`, `ScheduleShowToggle`, `SCHEDULE_SHOW_LABELS` | per-entity calendar (owns its query, actions and dialogs); the Show control and its labels | `schedule-management/` |
| `QueryToolbarRoot`, `QueryToolbarBar`, … (`QueryToolbar*` slot exports), `FilterSheetBody`, `FilterPopoverBody`, `FilterChip`, `QueryToolbarContextValue` | file-level exports from the toolbar split (compound keys `QueryToolbar.Bar` etc. unchanged); the toolbar context shape | `query-toolbar/` |
| `QueryToolbar.Standard` `leading` / `sort` props | Show toggle slot; Sort in the desktop bar | `query-toolbar/ui/standard.tsx` |
| `toDataViewInput` | composes filter/sort state and window into the read input (shared by loader and hook) | `derive-data-view-input.ts` |
| `DataViewRowOf` | row type read off a tRPC procedure | `dal/client/lib/types.ts` |
| `PipelineBranchArgs`, `resolvePipelineParam` | the kanban read's per-branch scope/filter/order bundle; route param → `Pipeline` (shared by the page and `PipelineProvider`) | customers DAL; `shared/domains/pipelines/lib/` |
| `MeetingsTableQuery` | the meetings table's query result type | `use-meetings-table.tsx` |
| `customerPipelineItemsInputSchema`, `CUSTOMER_PIPELINE_QUERY`, `customerListInputSchema` | kanban read input; kanban config (spec name); customers list input | customers DAL / feature constants |
| `toScheduleWindowHref` | turns an old `?highlightDate=` link into today's schedule link for the redirect | `schedule-management/lib/` |
| `CustomerListRow`, `CustomerListInput`, `ActivityListRow`, `ActivityListInput`, `activityListInputSchema`, `CustomerPipelineItemsInput` | read row/input types and schemas | entity DAL files |

## Deviations from the spec (owner review)

1. **Every read orders with a tie-breaker (the row id).** Without one, Postgres returns rows that share a sort value (Outcome, Meeting type, a lead source) in any order, so a table row can show on two pages or on none, and kanban cards reshuffle on every refetch. `defineFieldSql` requires it (see 15).
2. **Business-time helpers stay half-open `[from, to)`**, like the existing `businessMonthWindow`. One helper, `toInclusiveRange`, turns a window into the inclusive form `dateRangeSchema` filters use ("next boundary − 1 ms"). The date-window derivation and the agent dashboard's meeting windows both use it, so a meeting at exactly midnight lands in one window everywhere.
3. **`window.step` is not built.**
   - `CalendarHeader` keeps its `Date` API.
   - The calendar maps its date change to `window.setAnchor`; picking today clears `s_d` instead of pinning a date.
   - A `step` nothing calls would be dead code.
4. **"View in Schedule" links move to the date window.** `ROOTS.dashboard.scheduleWithMeetingHighlight` now writes `?highlightMeeting=…&show=meetings&s_d=<LA day>`, so new links need no redirect. Links already sent (`?highlightDate=<iso>` in Google Calendar events and push notifications) are redirected server-side to the same link, so the prefetch matches the client.
5. **Sort-only fields get labels:** Title, Due, Created, Name, Email. The Sort slot needs a label for each sortable field. §9 shows "—" for them, while §4 requires a label on every sortable field.
6. **Option reads are skipped for viewers their guard would refuse.** Each option source carries `canRead(ability)`, which mirrors the read's server guard (`assign Meeting` for reps, super-admin for lead sources). An agent's page never sends a refused read, so no `FORBIDDEN` reaches the server log. `src/trpc/query-client.ts` already never retries a 4xx, so there's no explicit `retry: false`.
7. **Kanban pipeline item types move with the read** into `src/shared/entities/customers/types/pipeline-item.ts`, because `shared/` can't import `features/`.
8. **The kanban read returns `{ rows, total }`**, like every other data-view read, so one hook serves all views.
9. **The meetings count query needs no lead-source join.**
   - The Lead source filter reads `customers.lead_source_id`.
   - Sorting doesn't touch the count.
   - §5's join note was about the sort, which lives only in the row query.
10. **The dead activities table is deleted in Task 7 (phase 1)**, not in phase 3. It's the only other `QueryToolbar` caller, so deleting it early avoids adapting code nobody mounts.
11. **Chip text for a runtime value with no loaded label** (hidden filter or deleted option) uses the existing chip format: "Rep: 1 selected", not "Rep · 1".
12. **The three customers tables keep today's toolbar (Pipeline, Created).** §8.3 says "config change only and no UI changes". Rep and Lead source are in `CUSTOMER_FIELDS` for the kanban now and for R2 later.
13. **`useDataViewQuery` takes the tRPC procedure, not its `queryOptions`:** `useDataViewQuery(trpc.meetingsRouter.reads.list, {}, config)`.
    - The procedure carries `inferInput`/`inferOutput`, so row and input types are inferred and no call site writes generics.
    - Checked 2026-09-27: `ReturnType` of the overloaded `queryOptions` loses the row type; `inferOutput` keeps it.
14. **`CalendarViewType` moves to `src/shared/constants/enums/calendar.ts`**, so `shared/dal` doesn't import `shared/components`.
15. **`defineFieldSql` replaces `buildFieldWhere` / `buildFieldOrderBy`.** Every read passed the same field list + SQL map pair and a separate `*_DEFAULT_ORDER` constant. Now each entity declares `defineFieldSql(FIELDS, { filter, sort }, { defaultOrder, tieBreaker })` once, and reads call `X_FIELD_SQL.where(input.filters)` and `X_FIELD_SQL.orderBy(input.sort)`. The compile-time checks are the same (missing, extra or misspelled keys, wrong value types).
16. **Option sources replace the per-entity option hooks** (`useMeetingFieldOptions`, `useCustomerFieldOptions`, `useActivityFieldOptions` and the three reads under them). A runtime-option field names its source (`multiSelect({ schema, source: 'reps' })`), and `useDataViewQuery` loads only the sources its toolbar shows and returns them as `query.filterSort.options`. There's no `options` prop on `QueryToolbar`, and no data view can forget to load them.
17. **The query config has no `fixed` key.** Every fixed value is set by a procedure (`sourceId`, `segment`), never by a data view. `fixedOnly` fields stay for those. The meetings `customerId` / `projectId` fields are dropped (no caller sends them).
18. **The month view fetches every day its grid draws** (`businessMonthGridWindow`): the Sunday on or before the 1st through the Saturday after the last day. The grid shows leading and trailing days of the next and previous months, which a calendar-month window would leave empty.
19. **Date-range presets are a toolbar concern.** `dateRange()` takes no presets; the toolbar supplies `DEFAULT_TIME_PRESETS` (every legacy date filter already uses them). Field lists live in the DAL and import nothing from `shared/components`.
20. **The value schemas and shapes both sides share move into `src/shared/dal/lib/query/contracts.ts`.** The isomorphic core imported runtime schemas from `dal/server/` and types from `dal/client/`; now both import from the core.
21. **Meetings search escapes `%` and `_`**, like every other migrated read, through `buildSearchWhere` (which now also accepts an SQL expression, for the `meeting_type::text` cast).
22. **Activity dots use the activities entity's own actions** (`useActivityActionConfigs`: view, mark complete, delete). Before, they carried meeting actions called with an activity id.
23. **Field schemas are typed on both sides** (`z.ZodType<Out, In>`). zod's input side defaults to `unknown`, which let a procedure's input type accept any sort or filter: the typed page prefetch and the "wrong config for this read" check never fired.

## Review Focus

1. **A deleted rep or renamed trade still in a bookmarked URL** → the filter stays active and matches nothing; its chip reads "Rep: 1 selected" and can be removed. Pinned in Task 3 (the derivation keeps a well-formed unknown id) and Task 7 (a hidden filter still yields a chip).
2. **A stale sort bookmark** (`?pm_sort=meetingOutcome`, `?pc_sort=leadSourceName`) → the parser drops it, the view falls back to its default sort, and there is no `BAD_REQUEST`. Pinned in Task 3 (unknown sort id falls back) and Task 12 / Task 18 (browser check).
3. **Server in UTC, browser in Asia/Tokyo, no `s_d` in the URL** → the same query key, so no `[prefetch drift]`. Pinned in Task 2 and Task 3, each run under `TZ=UTC` and `TZ=Asia/Tokyo`.
4. **A meeting at exactly 00:00 LA on a week boundary** → it lands in one week only, on the schedule and on the agent dashboard. Pinned in Task 2 and Task 3.
5. **An agent opens the meetings table** → no Rep or Lead source option read is sent, those filters are hidden, there's no error UI, and a `pm_rep=` value in the URL still applies with a removable chip. Pinned in Task 5 (`canRead`), Task 7 (hidden filter logic) and Task 12 (agent browser check).
6. **Month view edges** → the leading and trailing days of a month grid show their meetings. Pinned in Task 2 and Task 3 (grid window) and Task 16.
7. **A procedure fed the wrong config** → `pnpm tsc` fails. Pinned in Task 21 (`WrongProcedure`), which only fires because field schemas are typed on both sides (Deviation 23).

## File map

**Created**

| Path | Responsibility |
|---|---|
| `src/shared/dal/lib/query/contracts.ts` | value schemas and shapes client and server share (moved) |
| `src/shared/dal/lib/query/field-list.ts` | field-list types, derived id/value types, `defineFieldList`, builders |
| `src/shared/dal/lib/query/data-view-query-config.ts` | config, window, input and state types |
| `src/shared/dal/lib/query/derive-data-view-input.ts` | URL keys, parsers, pure derivation |
| `src/shared/dal/server/lib/query/field-list-input.ts` | `fieldListInput` |
| `src/shared/dal/server/lib/query/field-sql.ts` | `defineFieldSql`, `FieldSql`, `FieldSqlMap`, `dateRangeCondition` |
| `src/shared/dal/server/lib/query/load-data-view-query-input.ts` | server prefetch input |
| `src/shared/dal/client/hooks/use-data-view-query.ts` | client hook (rows, setters, runtime options) |
| `src/shared/dal/client/constants/option-source-reads.ts` | each option source's read and ability check |
| `src/shared/dal/client/lib/from-paginated-query.ts` | legacy adapter |
| `src/shared/constants/enums/calendar.ts` | `calendarViewTypes` + `CalendarViewType` |
| `src/shared/components/query-toolbar/ui/*.tsx` (one per component) | split toolbar |
| `src/shared/components/query-toolbar/lib/to-toolbar-filters.ts` | field → control descriptor |
| `src/shared/components/query-toolbar/constants/sort.ts` | `DEFAULT_ORDER_VALUE` |
| `src/shared/components/data-table/lib/get-column-id.ts`, `map-column-sort-ids.ts` | column helpers |
| `src/shared/entities/meetings/dal/meeting-fields.ts`, `dal/server/meeting-field-sql.ts` | meetings field list + SQL |
| `src/shared/entities/meetings/components/meeting-customer-cell.tsx` | Customer cell |
| `src/shared/entities/activities/dal/activity-fields.ts`, `dal/server/activity-field-sql.ts`, `dal/server/queries.ts` | activities |
| `src/shared/entities/customers/dal/customer-fields.ts`, `dal/server/customer-field-sql.ts`, `dal/server/pipeline-items.ts` | customers |
| `src/shared/entities/customers/types/pipeline-item.ts` | moved pipeline item types |
| `src/features/schedule-management/constants/schedule-queries.ts` | calendar configs + Show values |
| `src/features/schedule-management/lib/to-schedule-window-href.ts` | old-link redirect |
| `src/features/schedule-management/ui/components/schedule-meetings-calendar.tsx`, `schedule-activities-calendar.tsx`, `schedule-show-toggle.tsx` | calendar |
| `src/features/customer-pipelines/constants/customer-pipeline-query.ts` | kanban config |
| `src/shared/domains/pipelines/lib/resolve-pipeline-param.ts` | route param → `Pipeline`, shared by the kanban page and `PipelineProvider` |

**Notable modifications** (beyond the tables and views each task names): `src/shared/config/roots.ts` (schedule link), `src/features/agent-dashboard/lib/meeting-windows.ts` (inclusive windows), `src/shared/dal/server/lib/query/search.ts` (accepts SQL expressions), and the import lines of every file that used the moved contracts (Task 1).

**Deleted:**
- `src/shared/entities/meetings/constants/meeting-filter-config.ts`
- `src/shared/entities/customers/constants/customer-filter-config.ts`
- `src/features/schedule-management/constants/{schedule-query-inputs.ts, activities-table-query-config.ts, activity-filter-config.tsx, activity-table-columns.tsx}`
- `src/features/schedule-management/ui/components/activities-table.tsx`
- `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` (moved)

---

## Phase 1 — Core

**Gate to Phase 2:** proposals, projects and campaign-leads keys are unchanged (Task 21's parity script run early is fine); `pnpm tsc` and `pnpm lint` are clean; the existing records tables look and behave as before in the browser.

### Task 0: Scratch verification harness and legacy baseline (no commit)

The repo has no unit-test runner. Every throwaway test lives in your scratchpad directory (below: `$SCRATCH`) and is never committed.

**Files:**
- Create (scratch only): `$SCRATCH/tsconfig.json`, `$SCRATCH/node_modules` (symlink), `$SCRATCH/tests/legacy-parity.ts`, `$SCRATCH/baseline/legacy-inputs.json`

- [ ] **Step 1: Create the harness**

```bash
REPO=/home/olis-solutions/olis-v3/nextjs/tri-pros-website
SCRATCH=<your scratchpad directory>
mkdir -p "$SCRATCH/tests" "$SCRATCH/types" "$SCRATCH/baseline"
ln -sfn "$REPO/node_modules" "$SCRATCH/node_modules"
cat > "$SCRATCH/tsconfig.json" <<EOF
{
  "extends": "$REPO/tsconfig.json",
  "compilerOptions": { "incremental": false, "noEmit": true, "plugins": [] },
  "include": ["$REPO/next-env.d.ts", "$REPO/src/**/*.d.ts", "./**/*.ts"],
  "exclude": ["./node_modules"]
}
EOF
```

Type tests run with `cd $REPO && pnpm exec tsc -p "$SCRATCH/tsconfig.json"`, which type-checks every scratch `.ts` and the repo files they import, in about 10 s. Runtime tests run with `cd $REPO && pnpm exec tsx --tsconfig "$SCRATCH/tsconfig.json" --conditions=react-server --test <file>`. `--conditions=react-server` lets `server-only` modules load.

- [ ] **Step 2: Write the legacy-parity script**

`$SCRATCH/tests/legacy-parity.ts`:

```ts
import type { PaginatedQueryConfig } from '@/shared/dal/lib/query/derive-paginated-query-state'

import { createLoader } from 'nuqs/server'

import { PROJECTS_TABLE_QUERY_CONFIG } from '@/features/project-management/constants/projects-table-query-config'
import { PROPOSALS_TABLE_QUERY_CONFIG } from '@/features/proposal-flow/constants/proposals-table-query-config'
import { derivePaginatedQueryState, makePaginatedParsers } from '@/shared/dal/lib/query/derive-paginated-query-state'

function sampleSearch(config: PaginatedQueryConfig): string {
  const key = (name: string) => (config.paramPrefix ? `${config.paramPrefix}_${name}` : name)
  const params = new URLSearchParams({ [key('p')]: '2', [key('q')]: 'smith', [key('sort')]: 'createdAt', [key('dir')]: 'asc' })
  const optionFilter = config.filters?.find(f => f.type === 'multi-select' || f.type === 'select')
  if (optionFilter && 'options' in optionFilter && optionFilter.options[0]) {
    params.set(key(optionFilter.id), optionFilter.options[0].value)
  }
  return params.toString()
}

async function inputFor(config: PaginatedQueryConfig, search: string) {
  const load = createLoader(makePaginatedParsers(config) as never)
  const urlState = await load(new URLSearchParams(search))
  return derivePaginatedQueryState(urlState as Record<string, unknown>, config).input
}

const cases: [string, PaginatedQueryConfig][] = [
  ['proposals', PROPOSALS_TABLE_QUERY_CONFIG],
  ['projects', PROJECTS_TABLE_QUERY_CONFIG],
]

const out: Record<string, unknown> = {}
for (const [name, config] of cases) {
  out[`${name}:empty`] = await inputFor(config, '')
  out[`${name}:sample`] = await inputFor(config, sampleSearch(config))
}
console.log(JSON.stringify(out, null, 2))
```

- [ ] **Step 3: Record the baseline**

Run: `cd $REPO && pnpm exec tsx --tsconfig "$SCRATCH/tsconfig.json" "$SCRATCH/tests/legacy-parity.ts" > "$SCRATCH/baseline/legacy-inputs.json" && head -30 "$SCRATCH/baseline/legacy-inputs.json"`
Expected: four JSON entries, each with a `pagination` object. Campaign leads are not in the script because their filter config is built at runtime from query data; their hook code is not touched, so their key can't drift.

- [ ] **Step 4: Record the tsc/lint baseline**

Run: `cd $REPO && pnpm tsc 2>&1 | tail -5; pnpm lint 2>&1 | tail -5`
Expected: note any errors that already exist so later tasks don't mistake them for their own.

---

### Task 1: Shared contracts move into the core; the field-list contract

**Files:**
- Create: `src/shared/dal/lib/query/contracts.ts`, `src/shared/dal/lib/query/field-list.ts`
- Modify: `src/shared/dal/lib/query/constants.ts`
- Modify (the moved declarations leave): `src/shared/dal/server/lib/query/schemas.ts`, `src/shared/dal/client/lib/types.ts`, `src/shared/dal/server/lib/query/output.ts`
- Modify (import lines only):
  - `src/shared/dal/lib/query/filter-parser-registry.ts`
  - `src/shared/dal/client/hooks/use-paginated-query.ts`
  - `src/shared/components/query-toolbar/lib/filter-renderer-registry.tsx`
  - `src/shared/components/query-toolbar/ui/filter-controls/date-range-filter-control.tsx`
  - `src/shared/components/query-toolbar/ui/filter-controls/number-range-filter-control.tsx`
  - `src/shared/entities/meetings/dal/server/queries.ts`
  - `src/shared/modules/proposals/core/dal/server/queries.ts`
  - `src/shared/modules/projects/core/dal/server/queries.ts`
  - `src/trpc/routers/lead-sources.router.ts`
  - `src/trpc/routers/customers.router/business.router.ts`
  - `src/trpc/routers/projects.router/crud.router.ts`
  - `src/trpc/routers/schedule.router/activities.router.ts`
- Test (scratch): `$SCRATCH/types/field-list.ts`

**Interfaces:**
- Moves, names unchanged: `dateRangeSchema`, `DateRange`, `numberRangeSchema`, `NumberRange` (from `dal/server/lib/query/schemas.ts`), `FilterOption` (from `dal/client/lib/types.ts`), `PaginatedResult` (from `dal/server/lib/query/output.ts`) → `@/shared/dal/lib/query/contracts`.
- Produces:
  - `RESERVED_URL_SUFFIXES`, `OPTION_SOURCES` and `OptionSource` in `constants.ts`.
  - Types: `SortDir`, `MultiSelectFilter<V, O>`, `SelectFilter<V, O>`, `DateRangeFilter`, `NumberRangeFilter`, `BooleanFilter`, `FixedFilter<V>`, `ToolbarFilterSpec`, `FilterSpec`, `FieldDefinition`, `FieldList`.
  - Derived types: `FilterId<F>`, `ToolbarFilterId<F>`, `FixedFilterId<F>`, `DateRangeFilterId<F>`, `RuntimeOptionId<F>`, `SortId<F>`, `FilterValue<F, K extends string>`, `FilterValues<F>`, `ToolbarFilterValues<F>`, `SortState<F>`.
  - Functions: `defineFieldList(fields)`, `multiSelect(...)`, `select(...)`, `dateRange()`, `numberRange(...)`, `boolean()`, `fixedOnly(schema)`.
  - A runtime-option select names its source: `multiSelect({ schema, source: 'reps' })`. Its `options` is `{ source }`; a static one's is the option list.
  - For an untyped `FieldList` (string index), every id type resolves to `string` and `FilterValue` to `unknown`.
- The core now imports nothing from `dal/client/` or `dal/server/`.

- [ ] **Step 1: Write the failing type test**

`$SCRATCH/types/field-list.ts`:

```ts
import type { FilterId, FilterValue, FilterValues, FixedFilterId, RuntimeOptionId, SortId, ToolbarFilterId } from '@/shared/dal/lib/query/field-list'

import z from 'zod'

import { dateRange, defineFieldList, fixedOnly, multiSelect, select } from '@/shared/dal/lib/query/field-list'

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
function expectType<T extends true>(value: T): T {
  return value
}

const FIELDS = defineFieldList({
  kind: { label: 'Kind', filter: multiSelect({ values: ['a', 'b'] }), sort: true },
  owner: { label: 'Owner', filter: multiSelect({ schema: z.string().min(1), source: 'reps' }) },
  stage: { label: 'Stage', filter: select({ values: ['x', 'y'] }) },
  when: { label: 'When', filter: dateRange(), sort: true },
  name: { label: 'Name', sort: true },
  parentId: { filter: fixedOnly(z.string().uuid()) },
})
type F = typeof FIELDS

expectType<Equals<FilterId<F>, 'kind' | 'owner' | 'stage' | 'when' | 'parentId'>>(true)
expectType<Equals<ToolbarFilterId<F>, 'kind' | 'owner' | 'stage' | 'when'>>(true)
expectType<Equals<FixedFilterId<F>, 'parentId'>>(true)
expectType<Equals<RuntimeOptionId<F>, 'owner'>>(true)
expectType<Equals<SortId<F>, 'kind' | 'when' | 'name'>>(true)
expectType<Equals<FilterValue<F, 'kind'>, ('a' | 'b')[]>>(true)
expectType<Equals<FilterValue<F, 'stage'>, 'x' | 'y'>>(true)
expectType<Equals<FilterValue<F, 'parentId'>, string>>(true)
expectType<Equals<FilterId<Readonly<Record<string, { label: string, sort: true }>>>, string>>(true)

export const ok: FilterValues<F> = { kind: ['a'], owner: ['u1'], when: { from: '2026-01-01T00:00:00.000Z' } }
// @ts-expect-error 'z' is not a Kind option
export const badValue: FilterValues<F> = { kind: ['z'] }
// @ts-expect-error `p` is a reserved URL suffix
defineFieldList({ p: { label: 'P', sort: true } })
// @ts-expect-error `d` is reserved for the date window's anchor
defineFieldList({ d: { label: 'D', sort: true } })
// @ts-expect-error a fixed filter can't sort
defineFieldList({ x: { filter: fixedOnly(z.string()), sort: true } })
// @ts-expect-error a toolbar field needs a label
defineFieldList({ x: { filter: dateRange() } })
// @ts-expect-error an option source must be a known one
multiSelect({ schema: z.string(), source: 'people' })
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd $REPO && pnpm exec tsc -p "$SCRATCH/tsconfig.json"`
Expected: FAIL with `Cannot find module '@/shared/dal/lib/query/field-list'`.

- [ ] **Step 3: Move the shared contracts**

Create `src/shared/dal/lib/query/contracts.ts`:

```ts
import { z } from 'zod'

// zod's .datetime() accepts year 0000, which Postgres rejects with a 500; an out-of-range
// value fails validation so the filter collapses to inactive on both the parser and procedure paths.
const pgSafeDatetime = z.string().datetime().refine((s) => {
  const t = Date.parse(s)
  return Number.isFinite(t) && t >= Date.UTC(1970, 0, 1) && t <= Date.UTC(2200, 0, 1)
}, 'Date out of supported range')

/** Inclusive on both ends. */
export const dateRangeSchema = z.object({
  from: pgSafeDatetime.optional(),
  to: pgSafeDatetime.optional(),
})

export type DateRange = z.infer<typeof dateRangeSchema>

/** Inclusive on both ends; `undefined` on a side means open-ended. */
export const numberRangeSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
})

export type NumberRange = z.infer<typeof numberRangeSchema>

/**
 * Single-value option for `select` and `multi-select` filter types.
 */
export interface FilterOption {
  label: string
  value: string
}

/**
 * Standardized response shape returned by every paginated tRPC procedure.
 * The client `usePaginatedQuery` hook depends on this contract.
 */
export interface PaginatedResult<T> {
  rows: T[]
  total: number
}
```

Then delete the originals, so each name has one home:
- `dal/server/lib/query/schemas.ts`: delete `pgSafeDatetime` and its comment, `dateRangeSchema`, `DateRange`, `numberRangeSchema` and `NumberRange`. Everything from `paginationFieldsSchema` through `sortFieldsSchema`, and from `paginatedQueryInput` on, stays.
- `dal/client/lib/types.ts`: delete `FilterOption` and its doc comment, and change the first import to `import type { DateRange, FilterOption, NumberRange } from '@/shared/dal/lib/query/contracts'`.
- `dal/server/lib/query/output.ts`: delete `PaginatedResult` and its doc comment, and add `import type { PaginatedResult } from '@/shared/dal/lib/query/contracts'` at the top.

In each file under **Modify (import lines only)**, move the moved names out of their old import into an import from `@/shared/dal/lib/query/contracts`, keeping `type` imports as `type`. For example, `import { dateRangeSchema, paginatedQueryInput } from '@/shared/dal/server/lib/query/schemas'` becomes `import { paginatedQueryInput } from '@/shared/dal/server/lib/query/schemas'` plus `import { dateRangeSchema } from '@/shared/dal/lib/query/contracts'`. Then run `pnpm exec eslint --fix` on those files to sort the imports.

Run: `cd $REPO && grep -rnE "import.*\b(dateRangeSchema|numberRangeSchema|DateRange|NumberRange)\b.*dal/server/lib/query/schemas|import.*PaginatedResult.*query/output'" src`
Expected: no output.

- [ ] **Step 4: Reserved suffixes and option sources**

Append to `src/shared/dal/lib/query/constants.ts`:

```ts
/** URL suffixes a data view owns (page, search, sort, direction, page size, date anchor, date view); a field id may never be one. */
export const RESERVED_URL_SUFFIXES = ['p', 'q', 'sort', 'dir', 'ps', 'd', 'v'] as const
export type ReservedUrlSuffix = (typeof RESERVED_URL_SUFFIXES)[number]

/** Reads that load a runtime-option filter's choices; `OPTION_SOURCE_READS` maps each to its tRPC query. */
export const OPTION_SOURCES = ['trades', 'reps', 'leadSources'] as const
export type OptionSource = (typeof OPTION_SOURCES)[number]
```

- [ ] **Step 5: Write `field-list.ts`**

`src/shared/dal/lib/query/field-list.ts`:

```ts
import type { OptionSource, ReservedUrlSuffix } from '@/shared/dal/lib/query/constants'
import type { FilterOption } from '@/shared/dal/lib/query/contracts'

import z from 'zod'

import { dateRangeSchema, numberRangeSchema } from '@/shared/dal/lib/query/contracts'

export type SortDir = 'asc' | 'desc'

// Schemas are typed on both sides (`ZodType<Out, In>`): zod's input side defaults to `unknown`, which would let a
// procedure's input type accept any value and silence every typed caller.
/** Where a select's choices come from: listed in code, or loaded at runtime from an option source. */
type FieldOptions = readonly FilterOption[] | { source: OptionSource }

export interface MultiSelectFilter<TValue extends string = string, TOptions extends FieldOptions = FieldOptions> {
  kind: 'multi-select'
  schema: z.ZodType<TValue[], TValue[]>
  options: TOptions
  placeholder?: string
}

export interface SelectFilter<TValue extends string = string, TOptions extends FieldOptions = FieldOptions> {
  kind: 'select'
  schema: z.ZodType<TValue, TValue>
  options: TOptions
  placeholder?: string
}

/** Presets are a toolbar concern; the toolbar supplies them. */
export interface DateRangeFilter {
  kind: 'date-range'
  schema: typeof dateRangeSchema
}

export interface NumberRangeFilter {
  kind: 'number-range'
  schema: typeof numberRangeSchema
  min: number
  max: number
  step?: number
  formatValue: (n: number) => string
}

export interface BooleanFilter {
  kind: 'boolean'
  schema: z.ZodBoolean
}

/** Set in code by a procedure; never parsed from the URL, never shown in the toolbar. */
export interface FixedFilter<TValue = unknown> {
  kind: 'fixed'
  schema: z.ZodType<TValue, TValue>
}

export type ToolbarFilterSpec = MultiSelectFilter | SelectFilter | DateRangeFilter | NumberRangeFilter | BooleanFilter
export type FilterSpec = ToolbarFilterSpec | FixedFilter

export type FieldDefinition
  = | { label: string, filter?: ToolbarFilterSpec, sort?: true }
    | { label?: string, filter: FixedFilter, sort?: never }

export type FieldList = Readonly<Record<string, FieldDefinition>>

// An untyped field list (string index) can't name its ids, so every id type widens to `string`.
type IdsWhere<F, TMatch> = string extends keyof F
  ? string
  : { [K in keyof F & string]: F[K] extends TMatch ? K : never }[keyof F & string]

export type FilterId<F extends FieldList> = IdsWhere<F, { filter: FilterSpec }>
export type ToolbarFilterId<F extends FieldList> = IdsWhere<F, { filter: ToolbarFilterSpec }>
export type FixedFilterId<F extends FieldList> = IdsWhere<F, { filter: FixedFilter }>
export type DateRangeFilterId<F extends FieldList> = IdsWhere<F, { filter: DateRangeFilter }>
export type RuntimeOptionId<F extends FieldList> = IdsWhere<F, { filter: { options: { source: OptionSource } } }>
export type SortId<F extends FieldList> = IdsWhere<F, { sort: true }>

// `K extends string` (not `keyof F`): derived id types are conditional, so TS can't prove they are keys of F.
export type FilterValue<F extends FieldList, K extends string> = string extends keyof F
  ? unknown
  : F[K & keyof F] extends { filter: { schema: infer TSchema extends z.ZodType } } ? z.output<TSchema> : never

export type FilterValues<F extends FieldList> = { [K in FilterId<F>]?: FilterValue<F, K> }
export type ToolbarFilterValues<F extends FieldList> = { [K in ToolbarFilterId<F>]?: FilterValue<F, K> }

export interface SortState<F extends FieldList> {
  sortBy: SortId<F>
  sortDir: SortDir
}

type NoReservedIds<T> = { [K in keyof T & ReservedUrlSuffix]: never }

export function defineFieldList<const T extends FieldList>(fields: T & NoReservedIds<T>): T {
  return fields
}

type NonEmptyValues = readonly [string, ...string[]]

interface StaticOptionArgs<TValues extends NonEmptyValues> {
  values: TValues
  optionLabel?: (value: TValues[number]) => string
  placeholder?: string
}

interface RuntimeOptionArgs<TValue extends string> {
  schema: z.ZodType<TValue, TValue>
  source: OptionSource
  placeholder?: string
}

function toStaticOptions<TValue extends string>(values: readonly TValue[], optionLabel?: (value: TValue) => string): readonly FilterOption[] {
  return values.map(value => ({ value, label: optionLabel ? optionLabel(value) : value }))
}

export function multiSelect<const TValues extends NonEmptyValues>(args: StaticOptionArgs<TValues>): MultiSelectFilter<TValues[number], readonly FilterOption[]>
export function multiSelect<TValue extends string>(args: RuntimeOptionArgs<TValue>): MultiSelectFilter<TValue, { source: OptionSource }>
export function multiSelect(args: StaticOptionArgs<NonEmptyValues> | RuntimeOptionArgs<string>): MultiSelectFilter {
  if ('values' in args) {
    return { kind: 'multi-select', schema: z.array(z.enum(args.values)), options: toStaticOptions(args.values, args.optionLabel), placeholder: args.placeholder }
  }
  return { kind: 'multi-select', schema: z.array(args.schema), options: { source: args.source }, placeholder: args.placeholder }
}

export function select<const TValues extends NonEmptyValues>(args: StaticOptionArgs<TValues>): SelectFilter<TValues[number], readonly FilterOption[]>
export function select<TValue extends string>(args: RuntimeOptionArgs<TValue>): SelectFilter<TValue, { source: OptionSource }>
export function select(args: StaticOptionArgs<NonEmptyValues> | RuntimeOptionArgs<string>): SelectFilter {
  if ('values' in args) {
    return { kind: 'select', schema: z.enum(args.values), options: toStaticOptions(args.values, args.optionLabel), placeholder: args.placeholder }
  }
  return { kind: 'select', schema: args.schema, options: { source: args.source }, placeholder: args.placeholder }
}

export function dateRange(): DateRangeFilter {
  return { kind: 'date-range', schema: dateRangeSchema }
}

export function numberRange(args: Omit<NumberRangeFilter, 'kind' | 'schema'>): NumberRangeFilter {
  return { kind: 'number-range', schema: numberRangeSchema, ...args }
}

export function boolean(): BooleanFilter {
  return { kind: 'boolean', schema: z.boolean() }
}

export function fixedOnly<TValue>(schema: z.ZodType<TValue, TValue>): FixedFilter<TValue> {
  return { kind: 'fixed', schema }
}
```

- [ ] **Step 6: Run the type test to see it pass**

Run: `cd $REPO && pnpm exec tsc -p "$SCRATCH/tsconfig.json"`
Expected: no errors. Every `@ts-expect-error` line errors as intended; an unused one would itself fail.

- [ ] **Step 7: Repo checks**

Run: `cd $REPO && pnpm tsc && pnpm lint`
Expected: no new errors. The contracts move changes no behaviour and no query key.

- [ ] **Step 8: Commit**

```bash
P="src/shared/dal/lib/query/contracts.ts src/shared/dal/lib/query/constants.ts src/shared/dal/lib/query/field-list.ts src/shared/dal/server/lib/query/schemas.ts src/shared/dal/client/lib/types.ts src/shared/dal/server/lib/query/output.ts src/shared/dal/lib/query/filter-parser-registry.ts src/shared/dal/client/hooks/use-paginated-query.ts src/shared/components/query-toolbar/lib/filter-renderer-registry.tsx src/shared/components/query-toolbar/ui/filter-controls/date-range-filter-control.tsx src/shared/components/query-toolbar/ui/filter-controls/number-range-filter-control.tsx src/shared/entities/meetings/dal/server/queries.ts src/shared/modules/proposals/core/dal/server/queries.ts src/shared/modules/projects/core/dal/server/queries.ts src/trpc/routers/lead-sources.router.ts src/trpc/routers/customers.router/business.router.ts src/trpc/routers/projects.router/crud.router.ts src/trpc/routers/schedule.router/activities.router.ts"
git diff -- $P
git add src/shared/dal/lib/query/contracts.ts src/shared/dal/lib/query/field-list.ts
git commit -m "feat(data-view): shared query contracts move into the core; field-list contract — typed ids, value schemas, option sources, builders" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- $P
git show --stat HEAD
```

---

### Task 2: Business-time windows, the calendar view type, and inclusive dashboard windows

**Files:**
- Modify: `src/shared/lib/business-time.ts`
- Modify: `src/features/agent-dashboard/lib/meeting-windows.ts`
- Create: `src/shared/constants/enums/calendar.ts`
- Modify: `src/shared/constants/enums/index.ts`
- Modify: `src/shared/components/calendar/types.ts`, and every file that imports `CalendarViewType` from it:
  - `src/shared/components/calendar/ui/calendar-header.tsx`
  - `src/shared/components/calendar/lib/calendar-helpers.ts`
  - `src/features/schedule-management/ui/views/schedule-view.tsx`
  - `src/features/schedule-management/ui/components/schedule-calendar.tsx`
  - `src/features/schedule-management/ui/components/schedule-controls-bar.tsx`
- Test (scratch): `$SCRATCH/tests/business-time.test.ts`

**Interfaces:**
- Produces:
  - `isCalendarDay(value: string): boolean`
  - `businessDayWindow(calendarDay)`, `businessWeekWindow(calendarDay)`, `businessMonthGridWindow(calendarDay)`: each `{ from: string, to: string }`, half-open `[from, to)` like `businessMonthWindow`.
    - `businessMonthGridWindow` covers every day a month grid draws: the Sunday on or before the 1st through the Saturday after the last day (`getCalendarCells` in `calendar-helpers.ts` draws those leading and trailing days).
  - `toInclusiveRange(window)`: the inclusive form `dateRangeSchema` filters use (`to` = next boundary − 1 ms). It's the one place that conversion happens.
  - `calendarViewTypes` (`['today', 'week', 'month']`) and `CalendarViewType`, both from `@/shared/constants/enums`.
- The agent dashboard's `meetingWindow` and `meetingMonthWindow` build on these helpers and return inclusive ranges. Today a meeting at exactly LA midnight is counted in both "today" and "past"/"upcoming", and in two months. The query-key shape (`filters.scheduledFor = { from, to }`) is unchanged, and the server and the browser still compute the same values.

- [ ] **Step 1: Write the failing test**

`$SCRATCH/tests/business-time.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { businessDayWindow, businessMonthGridWindow, businessWeekWindow, isCalendarDay, toInclusiveRange } from '@/shared/lib/business-time'

test('a Sunday anchors its own week at LA midnight', () => {
  assert.deepEqual(businessWeekWindow('2026-09-27'), { from: '2026-09-27T07:00:00.000Z', to: '2026-10-04T07:00:00.000Z' })
})

test('a mid-week day snaps to its Sunday', () => {
  assert.deepEqual(businessWeekWindow('2026-09-30'), businessWeekWindow('2026-09-27'))
})

test('the fall-back week is 169 hours', () => {
  assert.deepEqual(businessWeekWindow('2026-11-03'), { from: '2026-11-01T07:00:00.000Z', to: '2026-11-08T08:00:00.000Z' })
})

test('the fall-back day is 25 hours', () => {
  assert.deepEqual(businessDayWindow('2026-11-01'), { from: '2026-11-01T07:00:00.000Z', to: '2026-11-02T08:00:00.000Z' })
})

test('the spring-forward day is 23 hours', () => {
  assert.deepEqual(businessDayWindow('2026-03-08'), { from: '2026-03-08T08:00:00.000Z', to: '2026-03-09T07:00:00.000Z' })
})

test('the month grid covers the leading and trailing days the grid draws', () => {
  // September 2026 starts on a Tuesday and ends on a Wednesday.
  assert.deepEqual(businessMonthGridWindow('2026-09-15'), { from: '2026-08-30T07:00:00.000Z', to: '2026-10-04T07:00:00.000Z' })
  // November 2026 starts on a Sunday (no leading days) and crosses the fall-back change.
  assert.deepEqual(businessMonthGridWindow('2026-11-15'), { from: '2026-11-01T07:00:00.000Z', to: '2026-12-06T08:00:00.000Z' })
})

test('the inclusive form stops 1 ms before the next boundary', () => {
  assert.deepEqual(toInclusiveRange(businessDayWindow('2026-09-27')), { from: '2026-09-27T07:00:00.000Z', to: '2026-09-28T06:59:59.999Z' })
})

test('isCalendarDay accepts only real YYYY-MM-DD dates', () => {
  assert.equal(isCalendarDay('2026-09-27'), true)
  assert.equal(isCalendarDay('2026-02-30'), false)
  assert.equal(isCalendarDay('2026-9-27'), false)
  assert.equal(isCalendarDay('2026-09-27T00:00'), false)
  assert.equal(isCalendarDay(''), false)
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd $REPO && TZ=UTC pnpm exec tsx --tsconfig "$SCRATCH/tsconfig.json" --test "$SCRATCH/tests/business-time.test.ts"`
Expected: FAIL, `businessDayWindow` is not exported.

- [ ] **Step 3: Implement the helpers**

Append to `src/shared/lib/business-time.ts` (below `businessMonthWindow`):

```ts
/** True for a `YYYY-MM-DD` string naming a real date (rejects 2026-02-30). */
export function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** Weeks start on Sunday, matching the schedule calendar's grids (`date-fns` `startOfWeek` default). */
function sundayOnOrBefore(calendarDay: string): string {
  const [year, month, day] = calendarDay.split('-').map(Number)
  return addCalendarDays(calendarDay, -new Date(Date.UTC(year, month - 1, day)).getUTCDay())
}

export function businessDayWindow(calendarDay: string): { from: string, to: string } {
  return {
    from: startOfDayInTimeZone(calendarDay, BUSINESS_TIMEZONE).toISOString(),
    to: startOfDayInTimeZone(addCalendarDays(calendarDay, 1), BUSINESS_TIMEZONE).toISOString(),
  }
}

export function businessWeekWindow(calendarDay: string): { from: string, to: string } {
  const weekStart = sundayOnOrBefore(calendarDay)
  return {
    from: startOfDayInTimeZone(weekStart, BUSINESS_TIMEZONE).toISOString(),
    to: startOfDayInTimeZone(addCalendarDays(weekStart, 7), BUSINESS_TIMEZONE).toISOString(),
  }
}

/** Every day a month grid shows: the Sunday on or before the 1st through the Saturday after the last day. */
export function businessMonthGridWindow(calendarDay: string): { from: string, to: string } {
  const month = businessMonthWindow(calendarDay.slice(0, 7))
  const lastDay = addCalendarDays(businessDayKey(new Date(month.to)), -1)
  return {
    from: startOfDayInTimeZone(sundayOnOrBefore(`${calendarDay.slice(0, 7)}-01`), BUSINESS_TIMEZONE).toISOString(),
    to: startOfDayInTimeZone(addCalendarDays(sundayOnOrBefore(lastDay), 7), BUSINESS_TIMEZONE).toISOString(),
  }
}

/** A `[from, to)` window in the inclusive form `dateRangeSchema` filters use, so a row on the boundary lands in one window only. */
export function toInclusiveRange(window: { from: string, to: string }): { from: string, to: string } {
  return { from: window.from, to: new Date(Date.parse(window.to) - 1).toISOString() }
}
```

- [ ] **Step 4: Run the test under two timezones**

Run: `cd $REPO && for tz in UTC Asia/Tokyo; do TZ=$tz pnpm exec tsx --tsconfig "$SCRATCH/tsconfig.json" --test "$SCRATCH/tests/business-time.test.ts" | grep -E '^ℹ (pass|fail)'; done`
Expected: `ℹ pass 8` and `ℹ fail 0` for both timezones.

- [ ] **Step 5: The agent dashboard's windows use the helpers**

Replace `src/features/agent-dashboard/lib/meeting-windows.ts` with:

```ts
// `meetingWindow('today')` runs both server-side (RSC prefetch in Vercel's UTC
// runtime) and in the agent's browser. Deriving "today" from ambient local time
// would give server and client different query keys near the UTC/PT offset and
// a hydration mismatch, so every boundary comes from the business timezone.

import { addCalendarDays, businessDayWindow, businessMonthWindow, businessToday, toInclusiveRange } from '@/shared/lib/business-time'

export type MeetingWindowKind = 'today' | 'upcoming' | 'past'

/** LA-pinned inclusive bounds of the calendar month, for the meetings scheduledFor filter. */
export function meetingMonthWindow(anchorCalendarDay: string): { from: string, to: string } {
  return toInclusiveRange(businessMonthWindow(anchorCalendarDay.slice(0, 7)))
}

/** Inclusive bounds for the meetings `scheduledFor` dateRange filter, business-day based. */
export function meetingWindow(kind: MeetingWindowKind): { from?: string, to?: string } {
  const today = businessToday()
  switch (kind) {
    case 'today':
      return toInclusiveRange(businessDayWindow(today))
    case 'upcoming':
      return { from: businessDayWindow(addCalendarDays(today, 1)).from }
    case 'past':
      return { to: toInclusiveRange(businessDayWindow(addCalendarDays(today, -1))).to }
  }
}
```

- [ ] **Step 6: Move `CalendarViewType` into the enums**

Create `src/shared/constants/enums/calendar.ts`:

```ts
export const calendarViewTypes = ['today', 'week', 'month'] as const
export type CalendarViewType = (typeof calendarViewTypes)[number]
```

- In `src/shared/constants/enums/index.ts`, add `export * from './calendar'` in alphabetical position (after `./applications`).
- In `src/shared/components/calendar/types.ts`, delete the line `export type CalendarViewType = 'today' | 'week' | 'month'`.
- In each of the five importers listed under **Files**, change `import type { CalendarViewType } from '@/shared/components/calendar/types'` to `import type { CalendarViewType } from '@/shared/constants/enums'`.
  - `calendar-helpers.ts` also imports `CalendarEvent` from the same module. Keep that import and move only `CalendarViewType`.

Run: `cd $REPO && grep -rn "CalendarViewType" src --include=*.ts --include=*.tsx | grep "components/calendar/types"`
Expected: no output.

- [ ] **Step 7: Repo checks**

Run: `cd $REPO && pnpm tsc && pnpm lint`
Expected: no new errors.

- [ ] **Step 8: Browser check (agent dashboard)**

Open `/dashboard`. Expected: the snapshot strip's "today" count and the month calendar's dots render as before, with no `[prefetch drift]` in the console.

- [ ] **Step 9: Commit**

```bash
P="src/shared/lib/business-time.ts src/features/agent-dashboard/lib/meeting-windows.ts src/shared/constants/enums/calendar.ts src/shared/constants/enums/index.ts src/shared/components/calendar/types.ts src/shared/components/calendar/ui/calendar-header.tsx src/shared/components/calendar/lib/calendar-helpers.ts src/features/schedule-management/ui/views/schedule-view.tsx src/features/schedule-management/ui/components/schedule-calendar.tsx src/features/schedule-management/ui/components/schedule-controls-bar.tsx"
git diff -- $P
git add src/shared/constants/enums/calendar.ts
git commit -m "feat(business-time): LA day, week and month-grid windows, one inclusive-range helper; dashboard windows stop double-counting midnight" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- $P
git show --stat HEAD
```

---

### Task 3: Query config and the pure derivation

**Files:**
- Create: `src/shared/dal/lib/query/data-view-query-config.ts`
- Create: `src/shared/dal/lib/query/derive-data-view-input.ts`
- Test (scratch): `$SCRATCH/tests/derive-data-view-input.test.ts`

**Interfaces:**
- Consumes: Task 1 types and `filterParserRegistry` (existing); Task 2 windows and `toInclusiveRange`; `makeQueryParsers` (existing, `url-state.ts`); `MAX_PAGE` (existing).
- Produces:
  - `DataViewWindow<F>`, `DataViewWindowKind`
  - `DataViewQueryConfig<F, T = ToolbarFilterId<F>, W = DataViewWindow<F>>`: `{ fields, paramPrefix, toolbar: readonly T[], defaultSort?, window: W }`. There is no `fixed` key: procedures set fixed filters themselves (Deviation 17).
  - `DataViewInput<F>`: `{ pagination?, sort?, search?, filters? }`
  - `FilterSortState<F>`: `{ sort, search, filters }`, where `filters` are the valid toolbar values.
  - `DataViewWindowState`
  - `dataViewUrlKeys(prefix)`: `{ pageKey, searchKey, sortByKey, sortDirKey, pageSizeKey, filterKey(id), anchorKey, viewKey }`
  - `makeDataViewParsers(config)`, `deriveFilterSortState(urlState, config)`, `deriveDataViewWindow(urlState, config)`
  - `toDataViewInput(filterSort, windowState, config)`, `deriveDataViewInput(urlState, config)`
- The month view's window is `businessMonthGridWindow` (Deviation 18). Every date window goes through `toInclusiveRange`.

- [ ] **Step 1: Write the failing test**

`$SCRATCH/tests/derive-data-view-input.test.ts`:

```ts
import type { DataViewQueryConfig } from '@/shared/dal/lib/query/data-view-query-config'

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLoader } from 'nuqs/server'
import z from 'zod'

import { deriveDataViewInput, makeDataViewParsers } from '@/shared/dal/lib/query/derive-data-view-input'
import { dateRange, defineFieldList, multiSelect } from '@/shared/dal/lib/query/field-list'
import { businessToday } from '@/shared/lib/business-time'

const FIELDS = defineFieldList({
  kind: { label: 'Kind', filter: multiSelect({ values: ['a', 'b'] }), sort: true },
  owner: { label: 'Owner', filter: multiSelect({ schema: z.string().min(1), source: 'reps' }) },
  src: { label: 'Source', filter: multiSelect({ schema: z.string().uuid(), source: 'leadSources' }) },
  when: { label: 'When', filter: dateRange(), sort: true },
  name: { label: 'Name', sort: true },
})

const PAGE = {
  fields: FIELDS,
  paramPrefix: 't',
  toolbar: ['kind', 'owner', 'src'],
  defaultSort: { sortBy: 'when', sortDir: 'desc' },
  window: { kind: 'page', pageSize: 20, pageSizeOptions: [20, 50] },
} as const satisfies DataViewQueryConfig<typeof FIELDS>

const DATE = {
  fields: FIELDS,
  paramPrefix: 't',
  toolbar: ['kind'],
  defaultSort: { sortBy: 'when', sortDir: 'asc' },
  window: { kind: 'date', field: 'when', cap: 500 },
} as const satisfies DataViewQueryConfig<typeof FIELDS>

const WHOLE = {
  fields: FIELDS,
  paramPrefix: 't',
  toolbar: ['kind'],
  window: { kind: 'whole-list' },
} as const satisfies DataViewQueryConfig<typeof FIELDS>

async function inputFor(config: DataViewQueryConfig<typeof FIELDS>, search: string) {
  const load = createLoader(makeDataViewParsers(config) as never)
  return deriveDataViewInput((await load(new URLSearchParams(search))) as Record<string, unknown>, config)
}

test('page window: filters, sort, page and size', async () => {
  assert.deepEqual(await inputFor(PAGE, 't_kind=a&t_sort=name&t_dir=asc&t_p=2&t_ps=50&t_q=%20smith%20'), {
    pagination: { limit: 50, offset: 50 },
    sort: { sortBy: 'name', sortDir: 'asc' },
    search: 'smith',
    filters: { kind: ['a'] },
  })
})

test('bad URL values drop out and the default sort applies', async () => {
  assert.deepEqual(await inputFor(PAGE, 't_kin=a&t_kind=z&t_sort=password&t_ps=7&t_p=-4'), {
    pagination: { limit: 20, offset: 0 },
    sort: { sortBy: 'when', sortDir: 'desc' },
    search: undefined,
    filters: undefined,
  })
})

test('runtime values pass their schema; a malformed one drops the whole filter', async () => {
  const input = await inputFor(PAGE, 't_owner=u1,deleted-rep&t_src=not-a-uuid')
  assert.deepEqual(input.filters, { owner: ['u1', 'deleted-rep'] })
})

test('date window: LA week bounds, `to` 1 ms before the next boundary, capped rows', async () => {
  assert.deepEqual(await inputFor(DATE, 't_d=2026-09-27&t_v=week&t_kind=b'), {
    pagination: { limit: 500, offset: 0 },
    sort: { sortBy: 'when', sortDir: 'asc' },
    search: undefined,
    filters: { kind: ['b'], when: { from: '2026-09-27T07:00:00.000Z', to: '2026-10-04T06:59:59.999Z' } },
  })
})

test('a meeting at exactly LA midnight lands in one week only', async () => {
  const first = await inputFor(DATE, 't_d=2026-09-27&t_v=week')
  const second = await inputFor(DATE, 't_d=2026-10-04&t_v=week')
  const midnight = Date.parse('2026-10-04T07:00:00.000Z')
  assert.ok(Date.parse(first.filters!.when!.to!) < midnight)
  assert.equal(Date.parse(second.filters!.when!.from!), midnight)
})

test('an invalid or missing anchor falls back to the business day, whatever the runtime timezone', async () => {
  const today = await inputFor(DATE, `t_d=${businessToday()}&t_v=today`)
  assert.deepEqual(await inputFor(DATE, 't_d=2026-02-30&t_v=today'), today)
  assert.deepEqual(await inputFor(DATE, 't_v=today'), today)
})

test('month view fetches every day the month grid draws', async () => {
  const input = await inputFor(DATE, 't_d=2026-11-15&t_v=month')
  assert.deepEqual(input.filters!.when, { from: '2026-11-01T07:00:00.000Z', to: '2026-12-06T07:59:59.999Z' })
})

test('whole-list window: no pagination, no sort without a default', async () => {
  assert.deepEqual(await inputFor(WHOLE, 't_kind=a&t_p=3'), {
    pagination: undefined,
    sort: undefined,
    search: undefined,
    filters: { kind: ['a'] },
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd $REPO && TZ=UTC pnpm exec tsx --tsconfig "$SCRATCH/tsconfig.json" --test "$SCRATCH/tests/derive-data-view-input.test.ts"`
Expected: FAIL, the module can't be found.

- [ ] **Step 3: Write the config types**

`src/shared/dal/lib/query/data-view-query-config.ts`:

```ts
import type { CalendarViewType } from '@/shared/constants/enums'
import type { DateRangeFilterId, FieldList, FilterValues, SortState, ToolbarFilterId, ToolbarFilterValues } from '@/shared/dal/lib/query/field-list'

/** What limits the rows a data view gets: a table page, a calendar's date window, or the whole list (kanban). */
export type DataViewWindow<F extends FieldList>
  = | { kind: 'page', pageSize: number, pageSizeOptions: readonly number[] }
    | { kind: 'date', field: DateRangeFilterId<F>, cap: number }
    | { kind: 'whole-list' }

export type DataViewWindowKind = DataViewWindow<FieldList>['kind']

/**
 * The static constant a data view shares with its page's prefetch. Everything that shapes the query
 * key lives here, so the server and the browser derive the same input from the same URL.
 */
export interface DataViewQueryConfig<
  F extends FieldList,
  T extends ToolbarFilterId<F> = ToolbarFilterId<F>,
  W extends DataViewWindow<F> = DataViewWindow<F>,
> {
  fields: F
  paramPrefix: string
  toolbar: readonly T[]
  defaultSort?: SortState<F>
  window: W
}

export interface DataViewInput<F extends FieldList> {
  pagination?: { limit: number, offset: number }
  sort?: SortState<F>
  search?: string
  filters?: FilterValues<F>
}

export interface FilterSortState<F extends FieldList> {
  sort: SortState<F> | undefined
  search: string | undefined
  filters: ToolbarFilterValues<F>
}

export type DataViewWindowState
  = | { kind: 'page', page: number, pageSize: number, pageSizeOptions: readonly number[], pagination: { limit: number, offset: number } }
    | { kind: 'date', anchor: string, view: CalendarViewType, range: { from: string, to: string }, cap: number, pagination: { limit: number, offset: number } }
    | { kind: 'whole-list' }
```

- [ ] **Step 4: Write the derivation**

`src/shared/dal/lib/query/derive-data-view-input.ts`:

```ts
import type { CalendarViewType } from '@/shared/constants/enums'
import type { DataViewInput, DataViewQueryConfig, DataViewWindowState, FilterSortState } from '@/shared/dal/lib/query/data-view-query-config'
import type { FieldList, FilterValues, SortDir, SortId, ToolbarFilterSpec, ToolbarFilterValues } from '@/shared/dal/lib/query/field-list'

import { parseAsArrayOf, parseAsInteger, parseAsString, parseAsStringLiteral } from 'nuqs/server'

import { calendarViewTypes } from '@/shared/constants/enums'
import { MAX_PAGE } from '@/shared/dal/lib/query/constants'
import { filterParserRegistry } from '@/shared/dal/lib/query/filter-parser-registry'
import { makeQueryParsers } from '@/shared/dal/lib/query/url-state'
import { businessDayWindow, businessMonthGridWindow, businessToday, businessWeekWindow, isCalendarDay, toInclusiveRange } from '@/shared/lib/business-time'

const SORT_DIRS = ['asc', 'desc'] as const

export function dataViewUrlKeys(paramPrefix: string) {
  return {
    ...makeQueryParsers(paramPrefix),
    anchorKey: `${paramPrefix}_d`,
    viewKey: `${paramPrefix}_v`,
  }
}

function sortIdsOf<F extends FieldList>(fields: F): SortId<F>[] {
  const fieldList: FieldList = fields
  return Object.keys(fieldList).filter(id => fieldList[id].sort === true) as SortId<F>[]
}

// Static options validate each member at parse time, so a bad member drops the same way on server and client.
function toolbarFilterParser(filter: ToolbarFilterSpec) {
  if ((filter.kind === 'multi-select' || filter.kind === 'select') && !('source' in filter.options)) {
    const values = filter.options.map(option => option.value)
    return filter.kind === 'multi-select'
      ? parseAsArrayOf(parseAsStringLiteral(values)).withDefault([] as string[])
      : parseAsStringLiteral(values).withDefault('')
  }
  return filterParserRegistry[filter.kind].parser
}

/** Parser map for `useQueryStates` (client) and `createLoader` (server), keyed by final URL key. */
export function makeDataViewParsers<F extends FieldList>(config: DataViewQueryConfig<F>): Record<string, unknown> {
  const keys = dataViewUrlKeys(config.paramPrefix)
  const sortByParser = parseAsStringLiteral(sortIdsOf(config.fields))
  const sortDirParser = parseAsStringLiteral(SORT_DIRS)
  const parsers: Record<string, unknown> = {
    [keys.searchKey]: parseAsString.withDefault(''),
    [keys.sortByKey]: config.defaultSort ? sortByParser.withDefault(config.defaultSort.sortBy) : sortByParser,
    [keys.sortDirKey]: config.defaultSort ? sortDirParser.withDefault(config.defaultSort.sortDir) : sortDirParser,
  }
  // Widened once: derived id types are conditional, so they can't index the generic field list directly.
  const fields: FieldList = config.fields
  for (const id of config.toolbar) {
    parsers[keys.filterKey(id)] = toolbarFilterParser(fields[id].filter as ToolbarFilterSpec)
  }
  if (config.window.kind === 'page') {
    parsers[keys.pageKey] = parseAsInteger.withDefault(1)
    parsers[keys.pageSizeKey] = parseAsInteger.withDefault(config.window.pageSize)
  }
  if (config.window.kind === 'date') {
    parsers[keys.anchorKey] = parseAsString.withDefault('')
    parsers[keys.viewKey] = parseAsStringLiteral(calendarViewTypes).withDefault('week')
  }
  return parsers
}

export function deriveFilterSortState<F extends FieldList>(urlState: Record<string, unknown>, config: DataViewQueryConfig<F>): FilterSortState<F> {
  const keys = dataViewUrlKeys(config.paramPrefix)
  const search = ((urlState[keys.searchKey] as string | null) ?? '').replace(/\0/g, '').trim() || undefined
  const sortBy = (urlState[keys.sortByKey] as SortId<F> | null) ?? config.defaultSort?.sortBy
  const sortDir = (urlState[keys.sortDirKey] as SortDir | null) ?? config.defaultSort?.sortDir ?? 'asc'

  const fields: FieldList = config.fields
  const filters: Record<string, unknown> = {}
  for (const id of config.toolbar) {
    const filter = fields[id].filter as ToolbarFilterSpec
    const { normalize } = filterParserRegistry[filter.kind] as { normalize: (raw: unknown) => unknown }
    const value = normalize(urlState[keys.filterKey(id)])
    if (value === undefined) {
      continue
    }
    // Runtime-option values arrive as plain strings; only the value schema can reject a malformed one.
    const parsed = filter.schema.safeParse(value)
    if (parsed.success) {
      filters[id] = parsed.data
    }
  }

  return {
    sort: sortBy ? { sortBy, sortDir } : undefined,
    search,
    filters: filters as ToolbarFilterValues<F>,
  }
}

function businessWindowOf(anchor: string, view: CalendarViewType): { from: string, to: string } {
  switch (view) {
    case 'today':
      return businessDayWindow(anchor)
    case 'week':
      return businessWeekWindow(anchor)
    case 'month':
      return businessMonthGridWindow(anchor)
  }
}

export function deriveDataViewWindow<F extends FieldList>(urlState: Record<string, unknown>, config: DataViewQueryConfig<F>): DataViewWindowState {
  const keys = dataViewUrlKeys(config.paramPrefix)
  const configWindow = config.window
  switch (configWindow.kind) {
    case 'page': {
      const page = Math.min(Math.max((urlState[keys.pageKey] as number | null) ?? 1, 1), MAX_PAGE)
      const requestedSize = (urlState[keys.pageSizeKey] as number | null) ?? configWindow.pageSize
      const pageSize = configWindow.pageSizeOptions.includes(requestedSize) ? requestedSize : configWindow.pageSize
      return { kind: 'page', page, pageSize, pageSizeOptions: configWindow.pageSizeOptions, pagination: { limit: pageSize, offset: (page - 1) * pageSize } }
    }
    case 'date': {
      const requestedAnchor = (urlState[keys.anchorKey] as string | null) ?? ''
      const anchor = isCalendarDay(requestedAnchor) ? requestedAnchor : businessToday()
      const view = (urlState[keys.viewKey] as CalendarViewType | null) ?? 'week'
      const range = toInclusiveRange(businessWindowOf(anchor, view))
      return { kind: 'date', anchor, view, range, cap: configWindow.cap, pagination: { limit: configWindow.cap, offset: 0 } }
    }
    case 'whole-list':
      return { kind: 'whole-list' }
  }
}

export function toDataViewInput<F extends FieldList>(filterSort: FilterSortState<F>, windowState: DataViewWindowState, config: DataViewQueryConfig<F>): DataViewInput<F> {
  const filters: Record<string, unknown> = { ...filterSort.filters }
  if (config.window.kind === 'date' && windowState.kind === 'date') {
    filters[config.window.field] = windowState.range
  }
  return {
    pagination: windowState.kind === 'whole-list' ? undefined : windowState.pagination,
    sort: filterSort.sort,
    search: filterSort.search,
    filters: Object.keys(filters).length > 0 ? filters as FilterValues<F> : undefined,
  }
}

/** The single source of truth from URL state to read input; the server loader and the client hook both use it. */
export function deriveDataViewInput<F extends FieldList>(urlState: Record<string, unknown>, config: DataViewQueryConfig<F>): DataViewInput<F> {
  return toDataViewInput(deriveFilterSortState(urlState, config), deriveDataViewWindow(urlState, config), config)
}
```

- [ ] **Step 5: Run the test under two timezones**

Run: `cd $REPO && for tz in UTC Asia/Tokyo; do TZ=$tz pnpm exec tsx --tsconfig "$SCRATCH/tsconfig.json" --test "$SCRATCH/tests/derive-data-view-input.test.ts" | grep -E '^ℹ (pass|fail)'; done`
Expected: `ℹ pass 8`, `ℹ fail 0` twice.

- [ ] **Step 6: Repo checks**

Run: `cd $REPO && pnpm tsc && pnpm lint`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
P="src/shared/dal/lib/query/data-view-query-config.ts src/shared/dal/lib/query/derive-data-view-input.ts"
git add $P
git commit -m "feat(data-view): query config and one pure URL-to-input derivation with page, date and whole-list windows" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- $P
git show --stat HEAD
```

---

### Task 4: Server side — input schema, field SQL, prefetch loader

**Files:**
- Create: `src/shared/dal/server/lib/query/field-list-input.ts`
- Create: `src/shared/dal/server/lib/query/field-sql.ts`
- Create: `src/shared/dal/server/lib/query/load-data-view-query-input.ts`
- Test (scratch): `$SCRATCH/tests/field-sql.test.ts`, `$SCRATCH/types/field-sql.ts`

**Interfaces:**
- Consumes: Tasks 1 and 3.
- Produces:
  - `fieldListInput(fields, { pagination: true | false })`: a `z.ZodObject` whose output is `{ pagination?, sort?, search?, filters? }`, with `sort.sortBy` a strict enum of `SortId<F>`.
    - With `pagination: true`, `pagination` is optional on input and defaults to `{ limit: 20, offset: 0 }` on output.
    - Supports `.extend({ … })`.
    - Its **input** type is as strict as its output (Deviation 23), so a typed prefetch or a wrong config fails `pnpm tsc`.
  - `FieldSqlMap<F>`: `{ filter: { [K in FilterId<F>]: (value: FilterValue<F, K>) => SQL | undefined }, sort: { [K in SortId<F>]: AnyColumn | SQL } }`.
  - `defineFieldSql(fields, map, { defaultOrder, tieBreaker }): FieldSql<F>`. `FieldSql<F>` is the map plus:
    - `where(filters): SQL | undefined`, which ANDs the condition of every active value;
    - `orderBy(sort): SQL[]`, which is the chosen sort (or `defaultOrder`) followed by `tieBreaker ASC`. It throws on a non-sortable id from an untyped caller.
    - `tieBreaker` is required.
  - `dateRangeCondition(column, range): SQL | undefined`
  - `loadDataViewQueryInput(searchParams, config, extra?): Promise<DataViewInput<F> & TExtra>`

- [ ] **Step 1: Write the failing tests**

`$SCRATCH/tests/field-sql.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { desc, eq, inArray } from 'drizzle-orm'
import { PgDialect, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import z from 'zod'

import { dateRange, defineFieldList, fixedOnly, multiSelect } from '@/shared/dal/lib/query/field-list'
import { fieldListInput } from '@/shared/dal/server/lib/query/field-list-input'
import { dateRangeCondition, defineFieldSql } from '@/shared/dal/server/lib/query/field-sql'

const things = pgTable('things', {
  id: uuid('id').primaryKey(),
  kind: text('kind'),
  when: timestamp('when', { mode: 'string', withTimezone: true }),
  parentId: uuid('parent_id'),
  name: text('name'),
})

const FIELDS = defineFieldList({
  kind: { label: 'Kind', filter: multiSelect({ values: ['a', 'b'] }), sort: true },
  when: { label: 'When', filter: dateRange(), sort: true },
  name: { label: 'Name', sort: true },
  parentId: { filter: fixedOnly(z.string().uuid()) },
})

const THING_SQL = defineFieldSql(FIELDS, {
  filter: {
    kind: v => inArray(things.kind, v),
    when: v => dateRangeCondition(things.when, v),
    parentId: v => eq(things.parentId, v),
  },
  sort: { kind: things.kind, when: things.when, name: things.name },
}, { defaultOrder: [desc(things.when)], tieBreaker: things.id })

const dialect = new PgDialect()
const render = (fragment: Parameters<PgDialect['sqlToQuery']>[0]) => dialect.sqlToQuery(fragment)
const PARENT = '00000000-0000-4000-8000-000000000001'

test('inactive values produce no condition', () => {
  assert.equal(THING_SQL.where({ kind: [], when: {} }), undefined)
  assert.equal(THING_SQL.where(undefined), undefined)
})

test('active values AND together, fixed ones included', () => {
  const query = render(THING_SQL.where({ kind: ['a'], when: { from: '2026-01-01T00:00:00.000Z' }, parentId: PARENT })!)
  assert.match(query.sql, /"things"\."kind" in \(\$1\)/)
  assert.match(query.sql, /"things"\."when" >= \$2/)
  assert.match(query.sql, /"things"\."parent_id" = \$3/)
  assert.deepEqual(query.params, ['a', '2026-01-01T00:00:00.000Z', PARENT])
})

test('order: chosen sort or the default, always ending with the tie-breaker', () => {
  assert.deepEqual(THING_SQL.orderBy({ sortBy: 'name', sortDir: 'asc' }).map(s => render(s).sql), ['"things"."name" asc', '"things"."id" asc'])
  assert.deepEqual(THING_SQL.orderBy(undefined).map(s => render(s).sql), ['"things"."when" desc', '"things"."id" asc'])
})

test('input schema: strict sort ids, typed filter values, pagination default', () => {
  const paged = fieldListInput(FIELDS, { pagination: true })
  assert.deepEqual(paged.parse({}).pagination, { limit: 20, offset: 0 })
  assert.equal(paged.safeParse({ sort: { sortBy: 'password', sortDir: 'asc' } }).success, false)
  assert.equal(paged.safeParse({ filters: { kind: ['z'] } }).success, false)
  assert.equal(paged.safeParse({ filters: { kind: ['a'], parentId: PARENT }, sort: { sortBy: 'name', sortDir: 'desc' } }).success, true)
  const whole = fieldListInput(FIELDS, { pagination: false }).extend({ pipeline: z.string() })
  assert.equal('pagination' in whole.parse({ pipeline: 'fresh', pagination: { limit: 1, offset: 0 } }), false)
})
```

`$SCRATCH/types/field-sql.ts`. Each `defineFieldSql` call stays on one line, because TypeScript reports a missing or extra key on the line of the call:

```ts
import type z from 'zod'

import { eq, inArray } from 'drizzle-orm'
import { pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { z as zod } from 'zod'

import { defineFieldList, fixedOnly, multiSelect } from '@/shared/dal/lib/query/field-list'
import { fieldListInput } from '@/shared/dal/server/lib/query/field-list-input'
import { defineFieldSql } from '@/shared/dal/server/lib/query/field-sql'

const things = pgTable('things', { id: uuid('id').primaryKey(), kind: text('kind'), parentId: uuid('parent_id') })
const FIELDS = defineFieldList({
  kind: { label: 'Kind', filter: multiSelect({ values: ['a', 'b'] }), sort: true },
  parentId: { filter: fixedOnly(zod.string().uuid()) },
})
const ORDER = { defaultOrder: [], tieBreaker: things.id }

// @ts-expect-error a field without SQL
export const missing = defineFieldSql(FIELDS, { filter: { kind: v => inArray(things.kind, v) }, sort: { kind: things.kind } }, ORDER)
// @ts-expect-error SQL for a field that isn't sortable
export const extra = defineFieldSql(FIELDS, { filter: { kind: v => inArray(things.kind, v), parentId: v => eq(things.parentId, v) }, sort: { kind: things.kind, parentId: things.parentId } }, ORDER)
// @ts-expect-error a condition receives the field's value type
export const wrongValue = defineFieldSql(FIELDS, { filter: { kind: (v: number) => inArray(things.kind, [String(v)]), parentId: v => eq(things.parentId, v) }, sort: { kind: things.kind } }, ORDER)
// @ts-expect-error every read names a tie-breaker
export const noTieBreaker = defineFieldSql(FIELDS, { filter: { kind: v => inArray(things.kind, v), parentId: v => eq(things.parentId, v) }, sort: { kind: things.kind } }, { defaultOrder: [] })

export type Input = z.infer<ReturnType<typeof fieldListInput<typeof FIELDS>>>
// @ts-expect-error `sortBy` is a strict enum
export const badSort: Input = { sort: { sortBy: 'nope', sortDir: 'asc' } }
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd $REPO && pnpm exec tsc -p "$SCRATCH/tsconfig.json"; pnpm exec tsx --tsconfig "$SCRATCH/tsconfig.json" --conditions=react-server --test "$SCRATCH/tests/field-sql.test.ts"`
Expected: FAIL, the modules can't be found.

- [ ] **Step 3: Write `field-list-input.ts`**

```ts
import type { FieldList, FilterId, SortDir, SortId } from '@/shared/dal/lib/query/field-list'

import z from 'zod'

import { paginationFieldsSchema } from '@/shared/dal/server/lib/query/schemas'

type FilterSchemaOf<F extends FieldList, K extends string> = F[K & keyof F] extends { filter: { schema: infer TSchema extends z.ZodType } } ? TSchema : never

type FiltersShape<F extends FieldList> = { [K in FilterId<F>]: z.ZodOptional<FilterSchemaOf<F, K>> }

// eslint-disable-next-line ts/consistent-type-definitions -- zod's shape constraint needs the implicit index signature only a type alias gets
type InputShape<F extends FieldList> = {
  sort: z.ZodOptional<z.ZodObject<{ sortBy: z.ZodType<SortId<F>, SortId<F>>, sortDir: z.ZodType<SortDir, SortDir> }>>
  search: z.ZodOptional<z.ZodString>
  filters: z.ZodOptional<z.ZodObject<FiltersShape<F>>>
}

type PaginatedInputShape<F extends FieldList> = InputShape<F> & {
  pagination: z.ZodDefault<typeof paginationFieldsSchema>
}

/**
 * The read input for a field list. `sortBy` is a strict enum of the sortable ids, and each filter is
 * typed by its value schema. Add business inputs with `.extend({ … })`; never name one pagination,
 * sort, search or filters.
 */
export function fieldListInput<F extends FieldList>(fields: F, options: { pagination: true }): z.ZodObject<PaginatedInputShape<F>>
export function fieldListInput<F extends FieldList>(fields: F, options: { pagination: false }): z.ZodObject<InputShape<F>>
export function fieldListInput(fields: FieldList, options: { pagination: boolean }): z.ZodObject {
  const filterShape: Record<string, z.ZodType> = {}
  const sortIds: string[] = []
  for (const [id, field] of Object.entries(fields)) {
    if (field.filter) {
      filterShape[id] = field.filter.schema.optional()
    }
    if (field.sort) {
      sortIds.push(id)
    }
  }
  const shape = {
    sort: z.object({ sortBy: z.enum(sortIds), sortDir: z.enum(['asc', 'desc']) }).optional(),
    search: z.string().optional(),
    filters: z.object(filterShape).optional(),
  }
  return options.pagination
    ? z.object({ ...shape, pagination: paginationFieldsSchema.default({ limit: 20, offset: 0 }) })
    : z.object(shape)
}
```

If `tsc` rejects the overload return types, fix only the generic shape types (`InputShape`, `FiltersShape`) until the Task 4 type test passes. Keep the runtime body as written.

- [ ] **Step 4: Write `field-sql.ts`**

```ts
import type { AnyColumn, SQL } from 'drizzle-orm'

import type { DateRange } from '@/shared/dal/lib/query/contracts'
import type { FieldList, FilterId, FilterValue, FilterValues, SortId, SortState } from '@/shared/dal/lib/query/field-list'

import { and, asc, desc, gte, lte } from 'drizzle-orm'

import { filterParserRegistry } from '@/shared/dal/lib/query/filter-parser-registry'
import 'server-only'

/** One condition per filter and one target per sort; a missing, extra or misspelled key fails `pnpm tsc`. */
export interface FieldSqlMap<F extends FieldList> {
  filter: { [K in FilterId<F>]: (value: FilterValue<F, K>) => SQL | undefined }
  sort: { [K in SortId<F>]: AnyColumn | SQL }
}

interface FieldOrder {
  /** The read's natural order when no sort is chosen. */
  defaultOrder: readonly SQL[]
  /** A unique column, so rows that share a sort value keep one order across pages and refetches. */
  tieBreaker: AnyColumn
}

/** An entity's server-only field SQL: the per-field map plus the `WHERE` and `ORDER BY` built from it. */
export interface FieldSql<F extends FieldList> extends FieldSqlMap<F> {
  where: (filters: FilterValues<F> | undefined) => SQL | undefined
  orderBy: (sort: SortState<F> | undefined) => SQL[]
}

function isActive(field: FieldList[string] | undefined, value: unknown): boolean {
  if (value === undefined || value === null) {
    return false
  }
  const kind = field?.filter?.kind
  if (!kind || kind === 'fixed') {
    return true
  }
  const { normalize } = filterParserRegistry[kind] as { normalize: (raw: unknown) => unknown }
  return normalize(value) !== undefined
}

export function defineFieldSql<F extends FieldList>(fields: F, map: NoInfer<FieldSqlMap<F>>, order: FieldOrder): FieldSql<F> {
  const fieldList: FieldList = fields
  // Widened once: the mapped keys are conditional types, so the map can't be indexed by a plain id.
  const conditions = map.filter as Record<string, (value: unknown) => SQL | undefined>
  const targets = map.sort as Record<string, AnyColumn | SQL>

  return {
    ...map,
    where: (filters) => {
      if (!filters) {
        return undefined
      }
      const active: SQL[] = []
      for (const [id, value] of Object.entries(filters)) {
        if (!conditions[id] || !isActive(fieldList[id], value)) {
          continue
        }
        const condition = conditions[id](value)
        if (condition) {
          active.push(condition)
        }
      }
      return active.length > 0 ? and(...active) : undefined
    },
    orderBy: (sort) => {
      if (sort && !targets[sort.sortBy]) {
        throw new Error(`[defineFieldSql] '${sort.sortBy}' is not a sortable field`)
      }
      const chosen = sort
        ? [sort.sortDir === 'asc' ? asc(targets[sort.sortBy]) : desc(targets[sort.sortBy])]
        : [...order.defaultOrder]
      return [...chosen, asc(order.tieBreaker)]
    },
  }
}

/** Inclusive on both ends, like `dateRangeSchema`. */
export function dateRangeCondition(column: AnyColumn, range: DateRange): SQL | undefined {
  return and(
    range.from ? gte(column, range.from) : undefined,
    range.to ? lte(column, range.to) : undefined,
  )
}
```

- [ ] **Step 5: Write `load-data-view-query-input.ts`**

```ts
import type { SearchParams } from 'nuqs/server'

import type { DataViewInput, DataViewQueryConfig } from '@/shared/dal/lib/query/data-view-query-config'
import type { FieldList } from '@/shared/dal/lib/query/field-list'

import { createLoader } from 'nuqs/server'

import { deriveDataViewInput, makeDataViewParsers } from '@/shared/dal/lib/query/derive-data-view-input'
import 'server-only'

/**
 * The server half of `useDataViewQuery`'s first render: same parsers, same derivation, same config
 * object. `extra` must equal the hook's `extra`, or the prefetch is wasted.
 */
export async function loadDataViewQueryInput<F extends FieldList, TExtra extends object = Record<string, never>>(
  searchParams: Promise<SearchParams> | SearchParams,
  config: DataViewQueryConfig<F>,
  extra?: TExtra,
): Promise<DataViewInput<F> & TExtra> {
  // The parser map is built at runtime, which createLoader's generic can't express.
  const load = createLoader(makeDataViewParsers(config) as never)
  const urlState = await load(Promise.resolve(searchParams))
  return { ...deriveDataViewInput(urlState as Record<string, unknown>, config), ...extra } as DataViewInput<F> & TExtra
}
```

- [ ] **Step 6: Run both tests**

Run: `cd $REPO && pnpm exec tsc -p "$SCRATCH/tsconfig.json" && pnpm exec tsx --tsconfig "$SCRATCH/tsconfig.json" --conditions=react-server --test "$SCRATCH/tests/field-sql.test.ts" | grep -E '^ℹ (pass|fail)'`
Expected: tsc clean; `ℹ pass 4`, `ℹ fail 0`.

- [ ] **Step 7: Repo checks and commit**

```bash
pnpm tsc && pnpm lint
P="src/shared/dal/server/lib/query/field-list-input.ts src/shared/dal/server/lib/query/field-sql.ts src/shared/dal/server/lib/query/load-data-view-query-input.ts"
git add $P
git commit -m "feat(data-view): field-list input schema, defineFieldSql (type-checked SQL, WHERE, ORDER BY with a tie-breaker), prefetch loader" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- $P
git show --stat HEAD
```

---

### Task 5: `useDataViewQuery`, option sources, its result types, and the legacy adapter

**Files:**
- Modify: `src/shared/dal/client/lib/types.ts` (imports; append types)
- Create: `src/shared/dal/client/constants/option-source-reads.ts`
- Create: `src/shared/dal/client/hooks/use-data-view-query.ts`
- Create: `src/shared/dal/client/lib/from-paginated-query.ts`
- Test (scratch): `$SCRATCH/types/data-view-query.ts`

**Interfaces:**
- Consumes: Tasks 1, 3, 4 (`PaginatedResult` from `contracts.ts`).
- Produces:
  - `OPTION_SOURCE_READS`: for each `OptionSource`, `{ canRead(ability), queryOptions(trpc) }`.
    - `canRead` mirrors the read's own server guard: `trades` is open to everyone, `reps` requires `assign Meeting`, `leadSources` is super-admin only.
    - A source missing from the map, or a read whose rows lack `id`/`name`, fails `pnpm tsc`.
  - `OptionSourceRow` (`{ id, name }`).
  - `DataViewRowOf<TProcedure>`
  - `DataViewFilterSort<F, T>`: `{ fields, toolbar, filters, options, activeFilterCount, setFilter, clearFilters, searchInput, setSearchInput, sortBy, sortDir, setSort }`.
    - `options` holds the loaded choices of the toolbar's runtime-option filters, keyed by field id. A missing entry (loading, refused, or not permitted) hides that filter.
  - `PageWindowControls`: `{ kind: 'page', page, pageSize, pageSizeOptions, pageCount, setPage, setPageSize }`
  - `DateWindowControls`: `{ kind: 'date', anchor, view, range, cap, setAnchor(day | undefined), setView(view) }`
  - `DataViewWindowControls<K>`
  - `DataViewQueryResult<TRow, F, T, K>`: `{ rows, total, isLoading, isFetching, isPlaceholderData, isError, error, refresh, filterSort, window }`
  - `useDataViewQuery(procedure, extra, config, options?)`: called with the tRPC procedure, e.g. `trpc.meetingsRouter.reads.list`. Row, field-list, toolbar and window types are all inferred. It loads only the option sources the config's toolbar shows, and only for viewers `canRead` accepts.
  - `fromPaginatedQuery(result): DataViewQueryResult<TRow, FieldList, string, 'page'>`, with `options: {}` (legacy filters list their options statically).
- This replaces the spec's per-entity option hooks (`useMeetingFieldOptions`, `useCustomerFieldOptions`, `useActivityFieldOptions`); see Deviation 16.

- [ ] **Step 1: Write the failing type test**

`$SCRATCH/types/data-view-query.ts`:

```ts
import type { DataViewQueryResult, DataViewRowOf, PaginatedQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList } from '@/shared/dal/lib/query/field-list'
import type { useTRPC } from '@/trpc/helpers'
import type { AppRouterOutputs } from '@/trpc/routers/app'

import { fromPaginatedQuery } from '@/shared/dal/client/lib/from-paginated-query'

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
type Trpc = ReturnType<typeof useTRPC>

export const meetingRow: Equals<DataViewRowOf<Trpc['meetingsRouter']['reads']['list']>, AppRouterOutputs['meetingsRouter']['reads']['list']['rows'][number]> = true
export const customerRow: Equals<DataViewRowOf<Trpc['customersRouter']['business']['list']>, AppRouterOutputs['customersRouter']['business']['list']['rows'][number]> = true

export function adapt(result: PaginatedQueryResult<{ id: string }>): DataViewQueryResult<{ id: string }, FieldList, string, 'page'> {
  return fromPaginatedQuery(result)
}
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd $REPO && pnpm exec tsc -p "$SCRATCH/tsconfig.json"`
Expected: FAIL, `DataViewRowOf` is not exported.

- [ ] **Step 3: The result types**

In `src/shared/dal/client/lib/types.ts`, replace the import block at the top (Task 1 left it as the `contracts` import alone) with:

```ts
import type { DecorateQueryProcedure, inferOutput } from '@trpc/tanstack-react-query'
import type { CalendarViewType } from '@/shared/constants/enums'
import type { DateRange, FilterOption, NumberRange, PaginatedResult } from '@/shared/dal/lib/query/contracts'
import type { DataViewWindowKind } from '@/shared/dal/lib/query/data-view-query-config'
import type { FilterValue as FieldFilterValue, FieldList, RuntimeOptionId, SortDir, SortId, ToolbarFilterId } from '@/shared/dal/lib/query/field-list'
```

Append:

```ts
/** Every data-view read returns `{ rows, total }`; this reads the row type off the tRPC procedure. */
export type DataViewRowOf<TProcedure extends DecorateQueryProcedure<any>> = inferOutput<TProcedure> extends PaginatedResult<infer TRow> ? TRow : never

export interface DataViewFilterSort<F extends FieldList, T extends ToolbarFilterId<F> = ToolbarFilterId<F>> {
  fields: F
  toolbar: readonly T[]
  /** Active toolbar values only. */
  filters: { [K in T]?: FieldFilterValue<F, K> }
  /** Loaded choices for the toolbar's runtime-option filters; a missing entry (loading, refused, not permitted) hides that filter. */
  options: { [K in Extract<RuntimeOptionId<F>, T>]?: readonly FilterOption[] }
  activeFilterCount: number
  /** Resets the page to 1; never moves a date window. */
  setFilter: <K extends T>(id: K, value: FieldFilterValue<F, K> | undefined) => void
  /** Clears toolbar filters, search and sort; leaves the window alone. */
  clearFilters: () => void
  searchInput: string
  setSearchInput: (value: string) => void
  sortBy: SortId<F> | undefined
  sortDir: SortDir | undefined
  setSort: (sortBy: SortId<F> | undefined, sortDir?: SortDir) => void
}

export interface PageWindowControls {
  kind: 'page'
  page: number
  pageSize: number
  pageSizeOptions: readonly number[]
  pageCount: number
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
}

export interface DateWindowControls {
  kind: 'date'
  /** `YYYY-MM-DD` in the business timezone. */
  anchor: string
  view: CalendarViewType
  range: { from: string, to: string }
  cap: number
  /** `undefined` returns to today. */
  setAnchor: (calendarDay: string | undefined) => void
  setView: (view: CalendarViewType) => void
}

export type DataViewWindowControls<K extends DataViewWindowKind = DataViewWindowKind> = Extract<
  PageWindowControls | DateWindowControls | { kind: 'whole-list' },
  { kind: K }
>

/** What `useDataViewQuery` returns: plain data and setters, safe to pass down as props. */
export interface DataViewQueryResult<
  TRow,
  F extends FieldList,
  T extends ToolbarFilterId<F> = ToolbarFilterId<F>,
  K extends DataViewWindowKind = DataViewWindowKind,
> {
  rows: TRow[]
  total: number
  isLoading: boolean
  isFetching: boolean
  isPlaceholderData: boolean
  isError: boolean
  error: unknown
  /** Invalidates every cached input of this procedure; resolves when the refetch settles. */
  refresh: () => Promise<void>
  filterSort: DataViewFilterSort<F, T>
  window: DataViewWindowControls<K>
}
```

- [ ] **Step 4: The option sources**

`src/shared/dal/client/constants/option-source-reads.ts`:

```ts
import type { OptionSource } from '@/shared/dal/lib/query/constants'
import type { AppAbility } from '@/shared/domains/permissions/types'
import type { useTRPC } from '@/trpc/helpers'

/** Every option read returns rows with an id and a display name; the hook turns them into filter options. */
export interface OptionSourceRow {
  id: string
  name: string
}

interface OptionSourceRead {
  /** Mirrors the read's own server guard, so a viewer it would refuse never sends it; the filter just stays hidden. */
  canRead: (ability: AppAbility) => boolean
  // Checked through `queryFn`'s result (covariant); `select` would reject any row with more fields than OptionSourceRow.
  queryOptions: (trpc: ReturnType<typeof useTRPC>) => { queryKey: readonly unknown[], queryFn?: (...args: never[]) => Promise<readonly OptionSourceRow[]> | readonly OptionSourceRow[] }
}

/** Every option source's read. A source missing here, or a read whose rows lack `id`/`name`, fails `pnpm tsc`. */
export const OPTION_SOURCE_READS = {
  // Notion trade ids (never the Postgres `trades.id`); shares the catalog's cached query.
  trades: {
    canRead: () => true,
    queryOptions: trpc => trpc.constructionRouter.trades.getAll.queryOptions(),
  },
  reps: {
    canRead: ability => ability.can('assign', 'Meeting'),
    queryOptions: trpc => trpc.meetingsRouter.reads.getInternalUsers.queryOptions(),
  },
  // Inactive sources included: old customers still point at them.
  leadSources: {
    canRead: ability => ability.can('manage', 'all'),
    queryOptions: trpc => trpc.leadSourcesRouter.list.queryOptions(),
  },
} satisfies Record<OptionSource, OptionSourceRead>
```

- [ ] **Step 5: Write the hook**

`src/shared/dal/client/hooks/use-data-view-query.ts`:

```ts
'use client'

import type { UseQueryOptions } from '@tanstack/react-query'
import type { DecorateQueryProcedure, inferInput } from '@trpc/tanstack-react-query'

import type { CalendarViewType } from '@/shared/constants/enums'
import type { OptionSourceRow } from '@/shared/dal/client/constants/option-source-reads'
import type { DataViewFilterSort, DataViewQueryResult, DataViewRowOf, DataViewWindowControls } from '@/shared/dal/client/lib/types'
import type { OptionSource } from '@/shared/dal/lib/query/constants'
import type { FilterOption, PaginatedResult } from '@/shared/dal/lib/query/contracts'
import type { DataViewInput, DataViewQueryConfig, DataViewWindow } from '@/shared/dal/lib/query/data-view-query-config'
import type { FieldList, SortDir, ToolbarFilterId, ToolbarFilterSpec } from '@/shared/dal/lib/query/field-list'

import { keepPreviousData, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useQueryStates } from 'nuqs'
import { useCallback, useEffect, useMemo } from 'react'

import { OPTION_SOURCE_READS } from '@/shared/dal/client/constants/option-source-reads'
import { DEFAULT_DEBOUNCE_MS } from '@/shared/dal/client/lib/constants'
import { dataViewUrlKeys, deriveDataViewWindow, deriveFilterSortState, makeDataViewParsers, toDataViewInput } from '@/shared/dal/lib/query/derive-data-view-input'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { checkHydrationParity } from '@/shared/lib/hydration-drift'
import { useTRPC } from '@/trpc/helpers'

type AnyQueryProcedure = DecorateQueryProcedure<any>

// Resolves to `never` (a compile error at the call site) when the procedure can't accept the derived input plus `extra`.
type AcceptsDataViewInput<TProcedure extends AnyQueryProcedure, TInput> = TInput extends inferInput<TProcedure> ? unknown : never

interface UseDataViewQueryOptions {
  searchDebounceMs?: number
  enabled?: boolean
}

/** Toolbar fields whose choices load at runtime, with the source each reads. */
function runtimeOptionFields(fields: FieldList, toolbar: readonly string[]): { id: string, source: OptionSource }[] {
  return toolbar.flatMap((id) => {
    const filter = fields[id].filter as ToolbarFilterSpec
    return (filter.kind === 'multi-select' || filter.kind === 'select') && 'source' in filter.options
      ? [{ id, source: filter.options.source }]
      : []
  })
}

/**
 * One hook per data view: URL state → the same input the page prefetched → rows, plain setters and
 * the toolbar's runtime options. Call it once in the view (or entity-table hook) and pass the result down.
 */
export function useDataViewQuery<
  TProcedure extends AnyQueryProcedure,
  F extends FieldList,
  T extends ToolbarFilterId<F>,
  W extends DataViewWindow<F>,
  TExtra extends object,
>(
  procedure: TProcedure & AcceptsDataViewInput<TProcedure, DataViewInput<F> & TExtra>,
  extra: TExtra,
  config: DataViewQueryConfig<F, T, W>,
  options: UseDataViewQueryOptions = {},
): DataViewQueryResult<DataViewRowOf<TProcedure>, F, T, W['kind']> {
  const { searchDebounceMs = DEFAULT_DEBOUNCE_MS, enabled = true } = options
  const qc = useQueryClient()
  const trpc = useTRPC()
  const ability = useAbility()
  const keys = useMemo(() => dataViewUrlKeys(config.paramPrefix), [config.paramPrefix])
  const parsers = useMemo(() => makeDataViewParsers(config), [config])

  // useQueryStates' generic can't express a parser map built at runtime; the derivation narrows values.
  const [urlState, setUrlState] = useQueryStates(parsers as never, { clearOnDefault: true })
  const state = urlState as Record<string, unknown>

  const searchInput = (state[keys.searchKey] as string | null) ?? ''
  const searchDebounced = useDebounce(searchInput.trim(), searchDebounceMs)
  const derivedFrom = useMemo(() => ({ ...state, [keys.searchKey]: searchDebounced }), [state, keys.searchKey, searchDebounced])

  const filterSort = useMemo(() => deriveFilterSortState(derivedFrom, config), [derivedFrom, config])
  const windowState = useMemo(() => deriveDataViewWindow(derivedFrom, config), [derivedFrom, config])

  const extraKey = JSON.stringify(extra)
  const queryInput = useMemo(
    () => ({ ...toDataViewInput(filterSort, windowState, config), ...extra }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extra is deep-keyed via extraKey so an inline literal doesn't refetch
    [filterSort, windowState, config, extraKey],
  )

  const anyProcedure = procedure as AnyQueryProcedure
  const baseOptions = anyProcedure.queryOptions(queryInput)

  useEffect(() => {
    checkHydrationParity(baseOptions.queryKey as readonly unknown[])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first mount only; later keys are client-driven refetches, not hydration targets
  }, [])

  const result = useQuery({ ...baseOptions, placeholderData: keepPreviousData, enabled })
  const data = result.data as PaginatedResult<DataViewRowOf<TProcedure>> | undefined
  const rows = data?.rows ?? []
  const total = data?.total ?? 0

  // Only the sources this toolbar shows are read, and only by viewers the read would accept.
  const optionFields = useMemo(() => runtimeOptionFields(config.fields, config.toolbar), [config.fields, config.toolbar])
  const loadedOptions = useQueries({
    queries: optionFields.map(({ source }) => ({
      // The registry's type guarantees every read returns option rows; the union of their exact types can't spread here.
      ...(OPTION_SOURCE_READS[source].queryOptions(trpc) as UseQueryOptions<readonly OptionSourceRow[]>),
      enabled: OPTION_SOURCE_READS[source].canRead(ability),
    })),
    combine: results => results.map(r => r.data?.map((row): FilterOption => ({ value: row.id, label: row.name }))),
  })
  const runtimeOptions = useMemo(
    (): Partial<Record<string, readonly FilterOption[]>> => Object.fromEntries(optionFields.flatMap(({ id }, i) => (loadedOptions[i] ? [[id, loadedOptions[i]]] : []))),
    [optionFields, loadedOptions],
  )

  const refresh = useCallback(async () => {
    await qc.invalidateQueries(anyProcedure.queryFilter())
  }, [qc, anyProcedure])

  const resetsPage = config.window.kind === 'page'

  const setFilter = useCallback((id: string, value: unknown) => {
    void setUrlState(
      { [keys.filterKey(id)]: value ?? null, ...(resetsPage ? { [keys.pageKey]: null } : {}) } as never,
      { history: 'replace' },
    )
  }, [setUrlState, keys, resetsPage])

  const setSearchInput = useCallback((value: string) => {
    void setUrlState(
      { [keys.searchKey]: value || null, ...(resetsPage ? { [keys.pageKey]: null } : {}) } as never,
      { history: 'replace' },
    )
  }, [setUrlState, keys, resetsPage])

  const setSort = useCallback((sortBy: string | undefined, sortDir?: SortDir) => {
    void setUrlState(
      {
        [keys.sortByKey]: sortBy ?? null,
        [keys.sortDirKey]: sortBy ? (sortDir ?? 'asc') : null,
        ...(resetsPage ? { [keys.pageKey]: null } : {}),
      } as never,
      { history: 'replace' },
    )
  }, [setUrlState, keys, resetsPage])

  const clearFilters = useCallback(() => {
    const reset: Record<string, null> = { [keys.searchKey]: null, [keys.sortByKey]: null, [keys.sortDirKey]: null }
    for (const id of config.toolbar) {
      reset[keys.filterKey(id)] = null
    }
    if (resetsPage) {
      reset[keys.pageKey] = null
    }
    void setUrlState(reset as never, { history: 'replace' })
  }, [setUrlState, keys, config.toolbar, resetsPage])

  const setPage = useCallback((page: number) => {
    void setUrlState({ [keys.pageKey]: Math.max(page, 1) } as never, { history: 'push' })
  }, [setUrlState, keys])

  const setPageSize = useCallback((pageSize: number) => {
    if (config.window.kind !== 'page' || !config.window.pageSizeOptions.includes(pageSize)) {
      return
    }
    void setUrlState({ [keys.pageSizeKey]: pageSize, [keys.pageKey]: null } as never, { history: 'replace' })
  }, [setUrlState, keys, config.window])

  const setAnchor = useCallback((calendarDay: string | undefined) => {
    void setUrlState({ [keys.anchorKey]: calendarDay ?? null } as never, { history: 'push' })
  }, [setUrlState, keys])

  const setView = useCallback((view: CalendarViewType) => {
    void setUrlState({ [keys.viewKey]: view } as never, { history: 'push' })
  }, [setUrlState, keys])

  const pageCount = windowState.kind === 'page' && total > 0 ? Math.ceil(total / windowState.pageSize) : 0

  // Page past the end (rows deleted, filter narrowed elsewhere): clamp; an empty result keeps its own empty state.
  useEffect(() => {
    if (windowState.kind === 'page' && data && pageCount > 0 && windowState.page > pageCount) {
      void setUrlState({ [keys.pageKey]: pageCount } as never, { history: 'replace' })
    }
  }, [windowState, data, pageCount, keys, setUrlState])

  useEffect(() => {
    if (windowState.kind !== 'page' || !data) {
      return
    }
    const nextOffset = windowState.pagination.offset + windowState.pageSize
    if (nextOffset < data.total) {
      void qc.prefetchQuery(anyProcedure.queryOptions({ ...queryInput, pagination: { limit: windowState.pageSize, offset: nextOffset } }))
    }
  }, [windowState, data, queryInput, anyProcedure, qc])

  const windowControls = useMemo((): DataViewWindowControls => {
    switch (windowState.kind) {
      case 'page':
        return { kind: 'page', page: windowState.page, pageSize: windowState.pageSize, pageSizeOptions: windowState.pageSizeOptions, pageCount, setPage, setPageSize }
      case 'date':
        return { kind: 'date', anchor: windowState.anchor, view: windowState.view, range: windowState.range, cap: windowState.cap, setAnchor, setView }
      case 'whole-list':
        return { kind: 'whole-list' }
    }
  }, [windowState, pageCount, setPage, setPageSize, setAnchor, setView])

  const filterSortControls = useMemo((): DataViewFilterSort<F, T> => ({
    fields: config.fields,
    toolbar: config.toolbar,
    filters: filterSort.filters as DataViewFilterSort<F, T>['filters'],
    options: runtimeOptions as DataViewFilterSort<F, T>['options'],
    activeFilterCount: Object.keys(filterSort.filters).length,
    setFilter: setFilter as DataViewFilterSort<F, T>['setFilter'],
    clearFilters,
    searchInput,
    setSearchInput,
    sortBy: filterSort.sort?.sortBy,
    sortDir: filterSort.sort?.sortDir,
    setSort: setSort as DataViewFilterSort<F, T>['setSort'],
  }), [config.fields, config.toolbar, filterSort, runtimeOptions, setFilter, clearFilters, searchInput, setSearchInput, setSort])

  return {
    rows,
    total,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    isPlaceholderData: result.isPlaceholderData,
    isError: result.isError,
    error: result.error,
    refresh,
    filterSort: filterSortControls,
    window: windowControls as DataViewWindowControls<W['kind']>,
  }
}
```

Inferring `TProcedure` through the `TProcedure & AcceptsDataViewInput<…>` intersection was checked on 2026-09-27; Task 21's `WrongProcedure` case proves it still rejects a mismatched config. If `tsc` rejects the inference in a newer tRPC version, change the parameter to `procedure: TProcedure`, delete `AcceptsDataViewInput`, delete `WrongProcedure` from Task 21 and report it.

- [ ] **Step 6: Write the legacy adapter**

`src/shared/dal/client/lib/from-paginated-query.ts`:

```ts
import type { DataViewQueryResult, FilterDefinition, FilterValue, PaginatedQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList, ToolbarFilterSpec } from '@/shared/dal/lib/query/field-list'

import z from 'zod'

import { dateRangeSchema, numberRangeSchema } from '@/shared/dal/lib/query/contracts'

// Every legacy date-range definition uses the default presets, which the toolbar supplies.
function toFilterSpec(definition: FilterDefinition): ToolbarFilterSpec {
  switch (definition.type) {
    case 'multi-select':
      return { kind: 'multi-select', schema: z.array(z.string()), options: definition.options, placeholder: definition.placeholder }
    case 'select':
      return { kind: 'select', schema: z.string(), options: definition.options, placeholder: definition.placeholder }
    case 'date-range':
      return { kind: 'date-range', schema: dateRangeSchema }
    case 'number-range':
      return { kind: 'number-range', schema: numberRangeSchema, min: definition.min, max: definition.max, step: definition.step, formatValue: definition.formatValue }
    case 'boolean':
      return { kind: 'boolean', schema: z.boolean() }
  }
}

/** Lets a table still on `usePaginatedQuery` (proposals, projects, campaign leads) use the data-view toolbar and table adapters. */
export function fromPaginatedQuery<TRow>(result: PaginatedQueryResult<TRow>): DataViewQueryResult<TRow, FieldList, string, 'page'> {
  const fields: FieldList = Object.fromEntries(
    result.filterDefinitions.map(definition => [definition.id, { label: definition.label, filter: toFilterSpec(definition) }]),
  )
  return {
    rows: result.rows,
    total: result.total,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    isPlaceholderData: result.isPlaceholderData,
    isError: result.isError,
    error: result.error,
    refresh: result.refresh,
    filterSort: {
      fields,
      toolbar: result.filterDefinitions.map(definition => definition.id),
      filters: result.filters,
      options: {},
      activeFilterCount: result.activeFilterCount,
      setFilter: (id, value) => result.setFilter(id, value as FilterValue),
      clearFilters: result.clearFilters,
      searchInput: result.searchInput,
      setSearchInput: result.setSearchInput,
      sortBy: result.sortBy,
      sortDir: result.sortDir,
      setSort: result.setSort,
    },
    window: {
      kind: 'page',
      page: result.page,
      pageSize: result.pageSize,
      pageSizeOptions: result.pageSizeOptions ?? [result.pageSize],
      pageCount: result.pageCount,
      setPage: result.setPage,
      setPageSize: result.setPageSize,
    },
  }
}
```

- [ ] **Step 7: Run the type test and repo checks**

Run: `cd $REPO && pnpm exec tsc -p "$SCRATCH/tsconfig.json" && pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
P="src/shared/dal/client/lib/types.ts src/shared/dal/client/constants/option-source-reads.ts src/shared/dal/client/hooks/use-data-view-query.ts src/shared/dal/client/lib/from-paginated-query.ts"
git diff -- src/shared/dal/client/lib/types.ts
git add $P
git commit -m "feat(data-view): useDataViewQuery — inferred rows, page/date/whole-list windows, option sources loaded per toolbar; legacy adapter" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- $P
git show --stat HEAD
```

---

### Task 6: Split `query-toolbar.tsx` into one component per file (no behaviour change)

`src/shared/components/query-toolbar/ui/query-toolbar.tsx` holds 19 components in 759 lines, which breaks Rule 1. This task moves each one verbatim into its own file. The next task then changes behaviour in a reviewable diff.

**Files:**
- Create in `src/shared/components/query-toolbar/ui/`: the 19 files in the table below.
- Modify: `src/shared/components/query-toolbar/ui/query-toolbar.tsx` (becomes the compound assembly only).

| New file | Export (renamed from) | Source lines in today's file |
|---|---|---|
| `root.tsx` | `QueryToolbarRoot` (`Root`, with `RootProps`) | 29–76 |
| `bar.tsx` | `QueryToolbarBar` (`Bar`) | 78–99 |
| `search.tsx` | `QueryToolbarSearch` (`Search`) | 101–123 |
| `filter-trigger.tsx` | `QueryToolbarFilterTrigger` (`FilterTrigger`, keep its one-line comment above) | 125–187 |
| `columns-trigger.tsx` | `QueryToolbarColumnsTrigger` (`ColumnsTrigger`) | 189–257 |
| `columns-body.tsx` | `ColumnsBody` | 259–309 |
| `refresh-button.tsx` | `QueryToolbarRefreshButton` (`RefreshButton`) | 311–332 |
| `sheet-drag-handle.tsx` | `SheetDragHandle` | 334–338 |
| `filter-sheet-body.tsx` | `FilterSheetBody` (`SheetBody`) | 340–386 |
| `sheet-section.tsx` | `SheetSection` | 388–403 |
| `filter-popover-body.tsx` | `FilterPopoverBody` (`PopoverBody`) | 405–438 |
| `filter-control-field.tsx` | `FilterControlField` | 440–461 |
| `single-filter-control.tsx` | `SingleFilterControl` | 463–522 |
| `page-size-segmented.tsx` | `PageSizeSegmented` | 524–556 |
| `page-size.tsx` | `QueryToolbarPageSize` (`PageSize`) | 558–585 |
| `chip-rail.tsx` | `QueryToolbarChipRail` (`ChipRail`, with `ActiveChip` and `ChipRailProps`) | 587–661 |
| `filter-chip.tsx` | `FilterChip` (`Chip`) | 663–702 |
| `live-status.tsx` | `QueryToolbarLiveStatus` (`LiveStatus`) | 704–726 |
| `standard.tsx` | `QueryToolbarStandard` (`Standard`) | 728–747 |

- [ ] **Step 1: Confirm the line map is still current**

Run: `cd $REPO && grep -n "^function \|^interface \|^export const QueryToolbar" src/shared/components/query-toolbar/ui/query-toolbar.tsx`
Expected: the start lines match the table (Root at 37, Bar at 83, … Standard at 733). If they don't, map by function name, not by line.

- [ ] **Step 2: Create the 19 files**

For each row:
- Start the file with `'use client'`.
- Import only what that component uses: the same modules as today's file header, and the sibling components it renders from their new files.
- Paste the prop interface and the function verbatim, rename the function to its export name, and prefix it with `export`.

Sibling imports each file needs:
- `bar.tsx` → `QueryToolbarChipRail` from `./chip-rail`.
- `filter-trigger.tsx` → `SheetDragHandle`, `FilterSheetBody`, `FilterPopoverBody`.
- `columns-trigger.tsx` → `SheetDragHandle`, `ColumnsBody`.
- `filter-sheet-body.tsx` → `SheetSection`, `FilterControlField`, `PageSizeSegmented`.
- `filter-popover-body.tsx` → `FilterControlField`.
- `filter-control-field.tsx` → `SingleFilterControl`.
- `chip-rail.tsx` → `FilterChip`.
- `standard.tsx` → the eight `QueryToolbar*` slots it renders.

Use absolute `@/shared/components/query-toolbar/ui/<file>` imports, as the rest of the folder does.

- [ ] **Step 3: Reduce `query-toolbar.tsx` to the compound**

```tsx
'use client'

import { QueryToolbarBar } from '@/shared/components/query-toolbar/ui/bar'
import { QueryToolbarChipRail } from '@/shared/components/query-toolbar/ui/chip-rail'
import { QueryToolbarColumnsTrigger } from '@/shared/components/query-toolbar/ui/columns-trigger'
import { QueryToolbarFilterTrigger } from '@/shared/components/query-toolbar/ui/filter-trigger'
import { QueryToolbarLiveStatus } from '@/shared/components/query-toolbar/ui/live-status'
import { QueryToolbarPageSize } from '@/shared/components/query-toolbar/ui/page-size'
import { QueryToolbarRefreshButton } from '@/shared/components/query-toolbar/ui/refresh-button'
import { QueryToolbarRoot } from '@/shared/components/query-toolbar/ui/root'
import { QueryToolbarSearch } from '@/shared/components/query-toolbar/ui/search'
import { QueryToolbarStandard } from '@/shared/components/query-toolbar/ui/standard'

export const QueryToolbar = Object.assign(QueryToolbarRoot, {
  Bar: QueryToolbarBar,
  Search: QueryToolbarSearch,
  FilterTrigger: QueryToolbarFilterTrigger,
  ColumnsTrigger: QueryToolbarColumnsTrigger,
  RefreshButton: QueryToolbarRefreshButton,
  PageSize: QueryToolbarPageSize,
  ChipRail: QueryToolbarChipRail,
  LiveStatus: QueryToolbarLiveStatus,
  Standard: QueryToolbarStandard,
})
```

- [ ] **Step 4: Verify nothing changed for callers**

Run: `cd $REPO && pnpm tsc && pnpm lint && grep -c "^export function" src/shared/components/query-toolbar/ui/*.tsx | grep -v ":1$"`
Expected: tsc and lint clean. The grep prints only `query-toolbar.tsx:0`, meaning every other file exports exactly one function.

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/query-toolbar/ui/
git diff --cached --stat -- src/shared/components/query-toolbar/ui/
git commit -m "refactor(query-toolbar): one component per file; the compound export is unchanged" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/components/query-toolbar/ui/
git show --stat HEAD
```

---

### Task 7: `QueryToolbar` reads a data-view result (legacy tables through the adapter)

**Files:**
- Modify: `src/shared/components/query-toolbar/lib/context.ts`, `lib/format-chip-value.ts`, `constants/keyboard-hints.ts`
- Create: `src/shared/components/query-toolbar/lib/to-toolbar-filters.ts`, `constants/sort.ts`, `ui/sort.tsx`, `ui/row-cap-notice.tsx`
- Modify (in `ui/`): `root.tsx`, `bar.tsx`, `search.tsx`, `filter-trigger.tsx`, `refresh-button.tsx`, `filter-sheet-body.tsx`, `filter-popover-body.tsx`, `filter-control-field.tsx`, `page-size.tsx`, `chip-rail.tsx`, `live-status.tsx`, `standard.tsx`, `query-toolbar.tsx`
- Modify: `src/shared/components/records-page-header.tsx`
- Modify (legacy callers):
  - `src/features/proposal-flow/ui/components/table/index.tsx`
  - `src/features/project-management/ui/components/table/index.tsx`
  - `src/features/campaigns-admin/ui/views/campaigns-leads-view.tsx`
  - `src/features/campaigns-admin/ui/components/leads/leads-filter-bar.tsx`
  - `src/shared/entities/customers/components/customers-table.tsx`
  - `src/features/lead-sources-admin/ui/components/all-customers-section.tsx`
  - `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx`
  - `src/shared/entities/meetings/components/meetings-table/meetings-table.tsx`
  - `src/features/records-management/ui/views/meetings-records-view.tsx`
- Delete (dead code, never mounted; spec §8.2 planned this for P3):
  - `src/features/schedule-management/ui/components/activities-table.tsx`
  - `src/features/schedule-management/constants/activity-filter-config.tsx`
  - `src/features/schedule-management/constants/activities-table-query-config.ts`
  - `src/features/schedule-management/constants/activity-table-columns.tsx`
- Test (scratch): `$SCRATCH/tests/to-toolbar-filters.test.ts`

**Interfaces:**
- Consumes: `DataViewQueryResult`, `fromPaginatedQuery` (Task 5); field-list types (Task 1).
- Produces:
  - `<QueryToolbar query={…} entityName="…">`: `query` is any `DataViewQueryResult`. Runtime options arrive on `query.filterSort.options` (Task 5), so there is no `options` prop.
  - Date-range controls always get `DEFAULT_TIME_PRESETS` from the toolbar (Deviation 19).
  - `QueryToolbar.Sort` and `QueryToolbar.RowCapNotice` slots.
  - `QueryToolbar.Standard` gains `leading?: ReactNode` and `sort?: boolean`, and renders the row-cap notice.
  - `ToolbarFilter` `{ definition: FilterDefinition, hidden: boolean }`, `toToolbarFilters(fields, toolbar, options)`, `toSortOptions(fields)`.
  - `RecordsPageHeader` takes `query: { total, isLoading }` instead of `pagination`.

- [ ] **Step 1: Write the failing tests**

`$SCRATCH/tests/to-toolbar-filters.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import z from 'zod'

import { DEFAULT_TIME_PRESETS } from '@/shared/components/data-table/constants/time-filter-presets'
import { formatChipValue } from '@/shared/components/query-toolbar/lib/format-chip-value'
import { toSortOptions, toToolbarFilters } from '@/shared/components/query-toolbar/lib/to-toolbar-filters'
import { dateRange, defineFieldList, fixedOnly, multiSelect } from '@/shared/dal/lib/query/field-list'

const FIELDS = defineFieldList({
  kind: { label: 'Kind', filter: multiSelect({ values: ['a', 'b'], optionLabel: v => v.toUpperCase() }), sort: true },
  rep: { label: 'Rep', filter: multiSelect({ schema: z.string().min(1), source: 'reps' }) },
  when: { label: 'When', filter: dateRange(), sort: true },
  name: { label: 'Name', sort: true },
  parentId: { filter: fixedOnly(z.string()) },
})

test('static options become control options; unloaded runtime options hide the filter; date ranges get the default presets', () => {
  const filters = toToolbarFilters(FIELDS, ['kind', 'rep', 'when'], {})
  assert.deepEqual(filters.map(f => [f.definition.id, f.definition.type, f.hidden]), [['kind', 'multi-select', false], ['rep', 'multi-select', true], ['when', 'date-range', false]])
  assert.deepEqual((filters[0].definition as { options: unknown }).options, [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }])
  assert.equal((filters[2].definition as { presets: unknown }).presets, DEFAULT_TIME_PRESETS)
})

test('loaded runtime options show the filter with them', () => {
  const [rep] = toToolbarFilters(FIELDS, ['rep'], { rep: [{ value: 'u1', label: 'Ana' }] })
  assert.equal(rep.hidden, false)
  assert.deepEqual((rep.definition as { options: unknown }).options, [{ value: 'u1', label: 'Ana' }])
})

test('a hidden or deleted runtime value still formats as a count chip', () => {
  const [rep] = toToolbarFilters(FIELDS, ['rep'], {})
  assert.equal(formatChipValue(rep.definition, ['u1']), '1 selected')
  const [loaded] = toToolbarFilters(FIELDS, ['rep'], { rep: [{ value: 'u1', label: 'Ana' }] })
  assert.equal(formatChipValue(loaded.definition, ['u1']), 'Ana')
  assert.equal(formatChipValue(loaded.definition, ['u1', 'gone']), '2 selected')
})

test('sort options are every sortable field, in field order, with labels', () => {
  assert.deepEqual(toSortOptions(FIELDS), [{ value: 'kind', label: 'Kind' }, { value: 'when', label: 'When' }, { value: 'name', label: 'Name' }])
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd $REPO && pnpm exec tsc -p "$SCRATCH/tsconfig.json"`
Expected: FAIL, `to-toolbar-filters` is missing.

- [ ] **Step 3: Write `lib/to-toolbar-filters.ts`**

```ts
import type { FilterDefinition } from '@/shared/dal/client/lib/types'
import type { FilterOption } from '@/shared/dal/lib/query/contracts'
import type { FieldList, ToolbarFilterSpec } from '@/shared/dal/lib/query/field-list'

import { DEFAULT_TIME_PRESETS } from '@/shared/components/data-table/constants/time-filter-presets'

export interface ToolbarFilter {
  definition: FilterDefinition
  /** Its runtime options haven't loaded, were refused or aren't permitted: no control, but an active URL value still gets a chip. */
  hidden: boolean
}

type LoadedOptions = Partial<Record<string, readonly FilterOption[]>>

function toFilterDefinition(id: string, label: string, filter: ToolbarFilterSpec, runtimeOptions: readonly FilterOption[]): FilterDefinition {
  switch (filter.kind) {
    case 'multi-select':
      return { id, type: 'multi-select', label, placeholder: filter.placeholder, options: 'source' in filter.options ? runtimeOptions : filter.options }
    case 'select':
      return { id, type: 'select', label, placeholder: filter.placeholder, options: 'source' in filter.options ? runtimeOptions : filter.options }
    case 'date-range':
      return { id, type: 'date-range', label, presets: DEFAULT_TIME_PRESETS }
    case 'number-range':
      return { id, type: 'number-range', label, min: filter.min, max: filter.max, step: filter.step, formatValue: filter.formatValue }
    case 'boolean':
      return { id, type: 'boolean', label }
  }
}

/** Turns toolbar fields into the existing control descriptors, so every filter kind reuses its renderer. */
export function toToolbarFilters(fields: FieldList, toolbar: readonly string[], options: LoadedOptions): ToolbarFilter[] {
  return toolbar.map((id) => {
    const field = fields[id]
    const filter = field.filter as ToolbarFilterSpec
    const isRuntime = (filter.kind === 'multi-select' || filter.kind === 'select') && 'source' in filter.options
    const loaded = isRuntime ? options[id] : undefined
    return {
      definition: toFilterDefinition(id, field.label ?? id, filter, loaded ?? []),
      hidden: isRuntime && loaded === undefined,
    }
  })
}

export function toSortOptions(fields: FieldList): FilterOption[] {
  return Object.entries(fields).flatMap(([id, field]) => (field.sort ? [{ value: id, label: field.label ?? id }] : []))
}
```

- [ ] **Step 4: Chip formatting for unknown values**

In `src/shared/components/query-toolbar/lib/format-chip-value.ts`:

Replace the `select` case with:

```ts
    case 'select': {
      const opt = definition.options.find(o => o.value === value)
      return opt?.label ?? '1 selected'
    }
```

Replace the `multi-select` case with:

```ts
    case 'multi-select': {
      const arr = value as string[]
      const labels = arr.map(v => definition.options.find(o => o.value === v)?.label)
      // A value with no loaded label (options still loading, refused, or the option was deleted) shows as a count, never a raw id.
      if (arr.length <= 2 && labels.every(label => label !== undefined)) {
        return labels.join(', ')
      }
      return `${arr.length} selected`
    }
```

- [ ] **Step 5: Context, constants**

Replace `src/shared/components/query-toolbar/lib/context.ts` with:

```ts
'use client'

import type { ToolbarFilter } from '@/shared/components/query-toolbar/lib/to-toolbar-filters'
import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { FilterOption } from '@/shared/dal/lib/query/contracts'
import type { FieldList } from '@/shared/dal/lib/query/field-list'

import { createContext, use } from 'react'

export interface QueryToolbarContextValue {
  /** Widened once at the root, so every slot reads one non-generic shape. */
  query: DataViewQueryResult<unknown, FieldList, string>
  filters: readonly ToolbarFilter[]
  sortOptions: readonly FilterOption[]
}

const QueryToolbarContext = createContext<QueryToolbarContextValue | null>(null)

export const QueryToolbarProvider = QueryToolbarContext.Provider

export function useQueryToolbarContext(): QueryToolbarContextValue {
  const ctx = use(QueryToolbarContext)
  if (!ctx) {
    throw new Error('QueryToolbar slot used outside of <QueryToolbar> root')
  }
  return ctx
}
```

Append to `constants/keyboard-hints.ts`:

```ts
/** Chip-rail hint for data views without pages (calendar, kanban). */
export const KEYBOARD_HINT_TEXT_WITHOUT_PAGING = 'Press / to search · F to filter'
```

Create `constants/sort.ts`:

```ts
/** Radix Select can't hold an empty value, so "Default order" needs a sentinel. */
export const DEFAULT_ORDER_VALUE = '__default'
```

- [ ] **Step 6: Root**

Replace `ui/root.tsx` with:

```tsx
'use client'

import type { ReactNode } from 'react'

import type { QueryToolbarContextValue } from '@/shared/components/query-toolbar/lib/context'
import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList, ToolbarFilterId } from '@/shared/dal/lib/query/field-list'

import { useCallback, useMemo, useRef, useState } from 'react'

import { useToolbarShortcuts } from '@/shared/components/query-toolbar/hooks/use-toolbar-shortcuts'
import { QueryToolbarProvider } from '@/shared/components/query-toolbar/lib/context'
import { ToolbarInternalProvider } from '@/shared/components/query-toolbar/lib/internal-context'
import { toSortOptions, toToolbarFilters } from '@/shared/components/query-toolbar/lib/to-toolbar-filters'
import { cn } from '@/shared/lib/utils'

interface RootProps<F extends FieldList, T extends ToolbarFilterId<F>> {
  query: DataViewQueryResult<unknown, F, T>
  /** Singular noun for the records this toolbar filters (e.g. "proposal"). */
  entityName?: string
  className?: string
  children: ReactNode
}

export function QueryToolbarRoot<F extends FieldList, T extends ToolbarFilterId<F>>({ query, entityName = 'results', className, children }: RootProps<F, T>) {
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const handleOpenFilter = useCallback(() => setFilterOpen(true), [])

  const pageWindow = query.window.kind === 'page' ? query.window : undefined
  const handlePrevPage = useCallback(() => {
    if (pageWindow && pageWindow.page > 1) {
      pageWindow.setPage(pageWindow.page - 1)
    }
  }, [pageWindow])
  const handleNextPage = useCallback(() => {
    if (pageWindow && pageWindow.page < pageWindow.pageCount) {
      pageWindow.setPage(pageWindow.page + 1)
    }
  }, [pageWindow])

  useToolbarShortcuts({
    searchInputRef,
    onOpenFilter: handleOpenFilter,
    onPrevPage: pageWindow ? handlePrevPage : undefined,
    onNextPage: pageWindow ? handleNextPage : undefined,
  })

  const { fields, toolbar, options } = query.filterSort
  const filters = useMemo(() => toToolbarFilters(fields, toolbar, options), [fields, toolbar, options])
  const sortOptions = useMemo(() => toSortOptions(fields), [fields])
  const value = useMemo<QueryToolbarContextValue>(() => ({
    query: query as unknown as QueryToolbarContextValue['query'],
    filters,
    sortOptions,
  }), [query, filters, sortOptions])

  const internal = useMemo(
    () => ({ entityName, searchInputRef, filterOpen, setFilterOpen }),
    [entityName, filterOpen],
  )

  return (
    <QueryToolbarProvider value={value}>
      <ToolbarInternalProvider value={internal}>
        <div className={cn('flex flex-col gap-2', className)}>
          {children}
        </div>
      </ToolbarInternalProvider>
    </QueryToolbarProvider>
  )
}
```

- [ ] **Step 7: Slots that only read state**

Make these edits (everything else in each file stays):
- `bar.tsx`: replace `const { isFetching, isPlaceholderData } = useQueryToolbarContext()` with `const { query } = useQueryToolbarContext()` and `const showShimmer = query.isFetching || query.isPlaceholderData`.
- `search.tsx`: replace `const { searchInput, setSearchInput } = useQueryToolbarContext()` with `const { query } = useQueryToolbarContext()` and `const { searchInput, setSearchInput } = query.filterSort`.
- `refresh-button.tsx`: replace `const { refresh, isFetching } = useQueryToolbarContext()` with `const { query } = useQueryToolbarContext()` and `const { refresh, isFetching } = query`.
- `live-status.tsx`: replace `const { total, isLoading, isFetching } = useQueryToolbarContext()` with `const { query } = useQueryToolbarContext()` and `const { total, isLoading, isFetching } = query`.

- [ ] **Step 8: Slots that change behaviour**

Replace the body of `filter-trigger.tsx`'s component, from the first line through the `if (filterDefinitions.length === 0) { return null }` block, with the code below. The rest of the function is unchanged, except that `SheetBody` → `FilterSheetBody` and `PopoverBody` → `FilterPopoverBody` are already renamed from Task 6.

```tsx
export function QueryToolbarFilterTrigger() {
  const { query, filters, sortOptions } = useQueryToolbarContext()
  const { activeFilterCount } = query.filterSort
  const { filterOpen, setFilterOpen } = useToolbarInternal()
  const isBelowLg = useIsBelowLg()

  const hasControls = filters.some(filter => !filter.hidden)
  // Below lg the sheet also carries Sort, so it's worth opening even with no filter controls.
  if (!hasControls && !(isBelowLg && sortOptions.length > 0)) {
    return null
  }
```

Replace `filter-popover-body.tsx`'s component with:

```tsx
export function FilterPopoverBody() {
  const { query, filters } = useQueryToolbarContext()
  const { filterSort } = query
  const visibleFilters = filters.filter(filter => !filter.hidden)
  const hasResetableState = filterSort.activeFilterCount > 0 || !!filterSort.searchInput || !!filterSort.sortBy
  if (visibleFilters.length === 0) {
    return null
  }
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-2.5">
        <span className="text-xs font-semibold tracking-wide text-foreground">
          Filters
        </span>
        {hasResetableState && (
          <button
            type="button"
            onClick={filterSort.clearFilters}
            className={cn(
              'rounded text-xs text-muted-foreground transition-colors',
              'hover:text-foreground',
              'focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2',
            )}
          >
            Reset all
          </button>
        )}
      </div>
      <div className="space-y-3.5 px-4 py-4">
        {visibleFilters.map(filter => (
          <FilterControlField key={filter.definition.id} definition={filter.definition} />
        ))}
      </div>
    </div>
  )
}
```

Replace `filter-sheet-body.tsx`'s component with the code below, and add `import { QueryToolbarSort } from '@/shared/components/query-toolbar/ui/sort'`:

```tsx
export function FilterSheetBody({ onClose }: FilterSheetBodyProps) {
  const { query, filters, sortOptions } = useQueryToolbarContext()
  const { filterSort } = query
  const visibleFilters = filters.filter(filter => !filter.hidden)
  const hasResetableState = filterSort.activeFilterCount > 0 || !!filterSort.searchInput || !!filterSort.sortBy
  const pageWindow = query.window.kind === 'page' ? query.window : undefined
  return (
    <>
      <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-4 scrollbar-gutter-stable">
        {visibleFilters.length > 0 && (
          <SheetSection title="Filters" sectionId="qt-section-filters">
            <div className="space-y-3">
              {visibleFilters.map(filter => (
                <FilterControlField key={filter.definition.id} definition={filter.definition} />
              ))}
            </div>
          </SheetSection>
        )}
        {sortOptions.length > 0 && (
          <SheetSection title="Sort" sectionId="qt-section-sort">
            <QueryToolbarSort />
          </SheetSection>
        )}
        {pageWindow && pageWindow.pageSizeOptions.length > 1 && (
          <SheetSection title="Rows per page" sectionId="qt-section-page-size">
            <PageSizeSegmented
              options={pageWindow.pageSizeOptions}
              value={pageWindow.pageSize}
              onChange={pageWindow.setPageSize}
            />
          </SheetSection>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          onClick={filterSort.clearFilters}
          disabled={!hasResetableState}
          className="touch-manipulation"
        >
          Reset
        </Button>
        <Button type="button" onClick={onClose} className="touch-manipulation">
          {`View results · ${formatTotalCount(query.total)}`}
        </Button>
      </div>
    </>
  )
}
```

Its prop interface is renamed `FilterSheetBodyProps` (same shape as today's `SheetBodyProps`).

Replace `filter-control-field.tsx`'s component with:

```tsx
export function FilterControlField({ definition }: FilterControlFieldProps) {
  const { query } = useQueryToolbarContext()
  const value = query.filterSort.filters[definition.id] as FilterValue
  const isActive = value !== undefined
  return (
    <div className="space-y-1.5">
      <span
        className={cn(
          'block text-[10px] font-medium uppercase tracking-[0.08em] transition-colors',
          isActive ? 'text-foreground' : 'text-muted-foreground/70',
        )}
      >
        {definition.label}
      </span>
      <SingleFilterControl definition={definition} value={value} onChange={v => query.filterSort.setFilter(definition.id, v)} />
    </div>
  )
}
```

Replace `page-size.tsx`'s component with:

```tsx
export function QueryToolbarPageSize({ className }: PageSizeProps) {
  const { query } = useQueryToolbarContext()
  const pageWindow = query.window.kind === 'page' ? query.window : undefined
  if (!pageWindow || pageWindow.pageSizeOptions.length <= 1) {
    return null
  }
  return (
    // `lg:order-last` keeps this at the right edge regardless of where the auto-injected ChipRail sits in source order.
    <div className={cn('hidden lg:flex items-center gap-1.5 ml-auto lg:order-last', className)}>
      <span className="text-xs text-muted-foreground">Rows</span>
      <Select value={String(pageWindow.pageSize)} onValueChange={v => pageWindow.setPageSize(Number(v))}>
        <SelectTrigger className="h-9 w-17.5" aria-label="Rows per page">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {pageWindow.pageSizeOptions.map(size => (
            <SelectItem key={size} value={String(size)}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
```

In `chip-rail.tsx`:
- delete the `ActiveChip` interface;
- import `FilterValue` as a type and `KEYBOARD_HINT_TEXT_WITHOUT_PAGING`;
- replace the component's first lines, through the `active` memo, with:

```tsx
export function QueryToolbarChipRail({ placement = 'block' }: ChipRailProps) {
  const { query, filters } = useQueryToolbarContext()
  const { filters: values, setFilter } = query.filterSort
  const hint = query.window.kind === 'page' ? KEYBOARD_HINT_TEXT : KEYBOARD_HINT_TEXT_WITHOUT_PAGING

  // Hidden filters are included: a URL value still applies on the server, so it keeps a removable chip.
  const active = useMemo(() => filters.flatMap(({ definition }) => {
    const value = values[definition.id] as FilterValue
    return value === undefined ? [] : [{ definition, value }]
  }), [filters, values])
```

Also replace `{KEYBOARD_HINT_TEXT}` in the empty inline branch with `{hint}`.

- [ ] **Step 9: New slots**

`ui/sort.tsx`:

```tsx
'use client'

import { ArrowDownWideNarrowIcon, ArrowUpNarrowWideIcon } from 'lucide-react'

import { DEFAULT_ORDER_VALUE } from '@/shared/components/query-toolbar/constants/sort'
import { useQueryToolbarContext } from '@/shared/components/query-toolbar/lib/context'
import { Button } from '@/shared/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { cn } from '@/shared/lib/utils'

interface SortProps {
  className?: string
}

export function QueryToolbarSort({ className }: SortProps) {
  const { query, sortOptions } = useQueryToolbarContext()
  const { sortBy, sortDir, setSort } = query.filterSort
  if (sortOptions.length === 0) {
    return null
  }
  const isDescending = sortDir === 'desc'
  const DirectionIcon = isDescending ? ArrowDownWideNarrowIcon : ArrowUpNarrowWideIcon
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Select
        value={sortBy ?? DEFAULT_ORDER_VALUE}
        onValueChange={next => setSort(next === DEFAULT_ORDER_VALUE ? undefined : next, sortDir)}
      >
        <SelectTrigger className="h-11 w-full lg:h-9 lg:w-40" aria-label="Sort by">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_ORDER_VALUE}>Default order</SelectItem>
          {sortOptions.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        disabled={!sortBy}
        onClick={() => sortBy && setSort(sortBy, isDescending ? 'asc' : 'desc')}
        aria-label={isDescending ? 'Sorted descending; switch to ascending' : 'Sorted ascending; switch to descending'}
        className="h-11 w-11 shrink-0 px-0 lg:h-9 lg:w-9 touch-manipulation"
      >
        <DirectionIcon className="size-4 opacity-80" aria-hidden />
      </Button>
    </div>
  )
}
```

`ui/row-cap-notice.tsx`:

```tsx
'use client'

import { useQueryToolbarContext } from '@/shared/components/query-toolbar/lib/context'
import { formatTotalCount } from '@/shared/lib/pagination-format'
import { cn } from '@/shared/lib/utils'

interface RowCapNoticeProps {
  className?: string
}

/** A date window returns at most `cap` rows; say so instead of dropping the rest silently. */
export function QueryToolbarRowCapNotice({ className }: RowCapNoticeProps) {
  const { query } = useQueryToolbarContext()
  if (query.window.kind !== 'date' || query.total <= query.window.cap) {
    return null
  }
  return (
    <p role="status" className={cn('text-xs text-muted-foreground', className)}>
      {`Showing ${formatTotalCount(query.window.cap)} of ${formatTotalCount(query.total)}`}
    </p>
  )
}
```

Add both to `ui/query-toolbar.tsx`: import them, then add `Sort: QueryToolbarSort,` and `RowCapNotice: QueryToolbarRowCapNotice,` to the `Object.assign` map.

`QueryToolbar.Standard` becomes the one composition every data view uses. Replace `ui/standard.tsx`'s props and component with the code below and add the `QueryToolbarRowCapNotice`, `QueryToolbarSort` and `ReactNode` imports:

```tsx
interface StandardProps {
  searchPlaceholder?: string
  visibility?: UseColumnVisibilityResult
  /** Rendered first in the bar, e.g. the calendar's Show toggle. */
  leading?: ReactNode
  /** Puts Sort in the desktop bar. Tables leave it off because their headers sort; below lg, Sort lives in the Filters sheet either way. */
  sort?: boolean
}

export function QueryToolbarStandard({ searchPlaceholder, visibility, leading, sort = false }: StandardProps) {
  return (
    <>
      <QueryToolbarBar>
        {leading}
        <QueryToolbarSearch placeholder={searchPlaceholder} />
        <QueryToolbarFilterTrigger />
        {sort && <QueryToolbarSort className="hidden lg:flex" />}
        {visibility && <QueryToolbarColumnsTrigger visibility={visibility} />}
        <QueryToolbarRefreshButton />
        <QueryToolbarPageSize />
      </QueryToolbarBar>
      <QueryToolbarChipRail />
      <QueryToolbarRowCapNotice />
      <QueryToolbarLiveStatus />
    </>
  )
}
```

`PageSize` renders only for page windows and `RowCapNotice` only for date windows, so tables, the calendar and the kanban all use this one composition.

- [ ] **Step 10: `RecordsPageHeader` takes the count, not a paginated result**

In `src/shared/components/records-page-header.tsx`:
- Replace `import type { PaginatedQueryResult } from '@/shared/dal/client/lib/types'` with `import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'` and `import type { FieldList } from '@/shared/dal/lib/query/field-list'`.
- Replace the `pagination` prop doc and type with:

```ts
  /** Any data-view result; the header reads only `total` and `isLoading` for the count. */
  query: Pick<DataViewQueryResult<unknown, FieldList, string>, 'total' | 'isLoading'>
```

- Rename the destructured `pagination` to `query`, and `pagination.isLoading` / `pagination.total` to `query.isLoading` / `query.total`.

- [ ] **Step 11: Legacy callers go through `fromPaginatedQuery`**

Add `import { fromPaginatedQuery } from '@/shared/dal/client/lib/from-paginated-query'` wherever it's used below.

1. **`proposal-flow/ui/components/table/index.tsx`**
   - After the `usePaginatedQuery` call, add `const query = fromPaginatedQuery(pagination)`.
   - `<RecordsPageHeader title="Proposals" pagination={pagination} />` → `<RecordsPageHeader title="Proposals" query={query} />`.
   - `<QueryToolbar pagination={pagination} entityName="proposals">` → `<QueryToolbar query={query} entityName="proposals">`.
2. **`project-management/ui/components/table/index.tsx`**
   - Same edits: add `const query = fromPaginatedQuery(pagination)`.
   - `pagination={pagination}` on `RecordsPageHeader` → `query={query}`.
   - `<QueryToolbar pagination={pagination} entityName="projects">` → `<QueryToolbar query={query} entityName="projects">`.
3. **`customers-table.tsx`, `all-customers-section.tsx`, `lead-source-customers-section.tsx`**
   - Add `const query = fromPaginatedQuery(pagination)` after the hook.
   - `<QueryToolbar pagination={pagination} entityName="customers">` → `<QueryToolbar query={query} entityName="customers">`.
   - In `customers-table.tsx`, also `<RecordsPageHeader title="Customers" pagination={pagination} />` → `query={query}`.
4. **`leads-filter-bar.tsx`**
   - Its prop becomes `query: DataViewQueryResult<CampaignLeadRow, FieldList, string, 'page'>`. Import those types, drop `PaginatedQueryResult`.
   - Render `<QueryToolbar entityName="leads" query={query}>`.
5. **`campaigns-leads-view.tsx`**
   - Replace the `toolbarPagination` memo with:

   ```tsx
   const toolbarQuery = useMemo(
     () => fromPaginatedQuery({ ...pagination, filterDefinitions: filterConfig }),
     [pagination, filterConfig],
   )
   ```

   - Keep the comment above it, reworded to say `toolbarQuery`.
   - Render `<LeadsFilterBar query={toolbarQuery} />`.
6. **`meetings-table.tsx`** (still legacy until Task 11)
   - Change the prop to `header: (query: DataViewQueryResult<MeetingRow, FieldList, string, 'page'>) => ReactNode`, and import those types.
   - In the body, add `const query = fromPaginatedQuery(pagination)`.
   - Use `header(query)` and `<QueryToolbar query={query} entityName="meetings">`.
7. **`meetings-records-view.tsx`**
   - `header={pagination => <RecordsPageHeader title="Meetings" pagination={pagination} />}` → `header={query => <RecordsPageHeader title="Meetings" query={query} />}`.

- [ ] **Step 12: Delete the dead activities table**

Run: `cd $REPO && grep -rln "activities-table\|activity-filter-config\|activities-table-query-config\|activity-table-columns" src`
Expected: only the four files being deleted reference each other. If anything else does, STOP and report.

```bash
git rm src/features/schedule-management/ui/components/activities-table.tsx src/features/schedule-management/constants/activity-filter-config.tsx src/features/schedule-management/constants/activities-table-query-config.ts src/features/schedule-management/constants/activity-table-columns.tsx
```

- [ ] **Step 13: Run the tests and repo checks**

Run: `cd $REPO && pnpm exec tsc -p "$SCRATCH/tsconfig.json" && pnpm exec tsx --tsconfig "$SCRATCH/tsconfig.json" --test "$SCRATCH/tests/to-toolbar-filters.test.ts" | grep -E '^ℹ (pass|fail)' && pnpm tsc && pnpm lint`
Expected: `ℹ pass 4`, `ℹ fail 0`; tsc and lint clean.

- [ ] **Step 14: Browser check (legacy unchanged)**

1. Start or reuse the dev server. Check `ss -ltnp | grep -E ':300[0-9]'` first; never delete `.next` while a server runs.
2. Authenticate Playwright through `/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET>`.
3. Open `/dashboard/proposals`, `/dashboard/projects` and `/dashboard/customers`. On each, apply one filter, search, change page size and go to page 2.
4. Expected: identical behaviour to before, and no `[prefetch drift]` in the console.
5. Resize to 390 px wide and open the "Filters" sheet. Expected: filters and rows per page as before, and no Sort section (legacy field lists have no sortable fields).

- [ ] **Step 15: Commit**

```bash
P="src/shared/components/query-toolbar src/shared/components/records-page-header.tsx src/features/proposal-flow/ui/components/table/index.tsx src/features/project-management/ui/components/table/index.tsx src/features/campaigns-admin/ui/views/campaigns-leads-view.tsx src/features/campaigns-admin/ui/components/leads/leads-filter-bar.tsx src/shared/entities/customers/components/customers-table.tsx src/features/lead-sources-admin/ui/components/all-customers-section.tsx src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx src/shared/entities/meetings/components/meetings-table/meetings-table.tsx src/features/records-management/ui/views/meetings-records-view.tsx src/features/schedule-management/ui/components/activities-table.tsx src/features/schedule-management/constants/activity-filter-config.tsx src/features/schedule-management/constants/activities-table-query-config.ts src/features/schedule-management/constants/activity-table-columns.tsx"
git diff -- $P | head -400
git add src/shared/components/query-toolbar
git commit -m "feat(query-toolbar): read any data-view result — field-list filters, runtime options, Sort and row-cap slots; legacy tables via fromPaginatedQuery" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- $P
git show --stat HEAD
```

---

### Task 8: Columns sort by sort id; `DataTable` translates; hidden-by-default columns

**Files:**
- Create: `src/shared/components/data-table/lib/get-column-id.ts`, `lib/map-column-sort-ids.ts`
- Modify:
  - `src/shared/components/data-table/lib/use-entity-columns.tsx`
  - `src/shared/components/data-table/lib/use-column-visibility.ts`
  - `src/shared/components/data-table/ui/data-table.tsx`
  - `src/shared/components/data-table/lib/to-data-table-pagination.ts`
  - `src/shared/components/data-table/lib/to-data-table-sorting.ts`
  - `src/shared/components/data-table/types.ts` (doc comments only)
- Modify (registries, mechanical `sortable: true` → `sort: '<same key>'`):
  - `src/shared/modules/proposals/core/lib/columns-registry.tsx` (`label`, `price`, `createdAt`, `sentAt`, `viewCount`)
  - `src/shared/modules/projects/core/lib/columns-registry.tsx` (`title`, `city`, `isPublic`, `completedAt`, `createdAt`)
  - `src/shared/entities/meetings/lib/columns-registry.tsx` (`customerName`, `scheduledFor`)
  - `src/shared/entities/customers/lib/columns-registry.tsx` (`name`, `email`, `leadSourceName`, `createdAt`)
- Modify (adapter callers): the seven table files from Task 7 Step 11 that call `toDataTablePagination` / `toDataTableSorting`, plus `src/shared/entities/meetings/components/meetings-table/use-meetings-table.tsx`.
- Test (scratch): `$SCRATCH/tests/map-column-sort-ids.test.ts`

**Interfaces:**
- Produces:
  - `ColumnSpec<TData, TSortId extends string = string>` with `sort?: TSortId` and `defaultHidden?: boolean`; `ColumnRegistry<TData, TSortId>`.
  - Column `meta` gains `sortId` and `defaultHidden`.
  - `getColumnId(col)`, `mapColumnSortIds(columns) → { sortIdByColumnId, columnIdBySortId }`.
  - `toDataTablePagination(query: DataViewQueryResult<unknown, F, T, 'page'>)`, `toDataTableSorting(query, { fallbackVisual? })`.
  - `DataTableServerSorting.sortBy` and `fallbackVisual.id` are sort ids.

- [ ] **Step 1: Write the failing test**

`$SCRATCH/tests/map-column-sort-ids.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mapColumnSortIds } from '@/shared/components/data-table/lib/map-column-sort-ids'

test('maps column ids to sort ids both ways and skips unsortable columns', () => {
  const { sortIdByColumnId, columnIdBySortId } = mapColumnSortIds([
    { id: 'ownerName', meta: { sortId: 'rep' } },
    { id: 'scheduledFor', meta: { sortId: 'scheduledFor' } },
    { id: 'tradeSelections', meta: {} },
    { accessorKey: 'email', meta: { sortId: 'email' } },
  ])
  assert.deepEqual([...sortIdByColumnId], [['ownerName', 'rep'], ['scheduledFor', 'scheduledFor'], ['email', 'email']])
  assert.equal(columnIdBySortId.get('rep'), 'ownerName')
  assert.equal(columnIdBySortId.get('tradeSelections'), undefined)
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd $REPO && pnpm exec tsx --tsconfig "$SCRATCH/tsconfig.json" --test "$SCRATCH/tests/map-column-sort-ids.test.ts"`
Expected: FAIL, the module can't be found.

- [ ] **Step 3: Column helpers**

`lib/get-column-id.ts`. Move the function out of `use-column-visibility.ts` unchanged, and export it:

```ts
import type { ColumnDef } from '@tanstack/react-table'

export function getColumnId<TData>(col: ColumnDef<TData>): string | undefined {
  if ('id' in col && typeof col.id === 'string') {
    return col.id
  }
  if ('accessorKey' in col && typeof col.accessorKey === 'string') {
    return col.accessorKey
  }
  return undefined
}
```

`lib/map-column-sort-ids.ts`:

```ts
import type { ColumnDef } from '@tanstack/react-table'

import { getColumnId } from '@/shared/components/data-table/lib/get-column-id'

/** Column keys and server sort ids differ (the Rep column sorts by `rep`), so header state is translated both ways. */
export function mapColumnSortIds<TData>(columns: readonly ColumnDef<TData>[]): {
  sortIdByColumnId: ReadonlyMap<string, string>
  columnIdBySortId: ReadonlyMap<string, string>
} {
  const sortIdByColumnId = new Map<string, string>()
  const columnIdBySortId = new Map<string, string>()
  for (const col of columns) {
    const id = getColumnId(col)
    const sortId = (col.meta as { sortId?: string } | undefined)?.sortId
    if (id && sortId) {
      sortIdByColumnId.set(id, sortId)
      columnIdBySortId.set(sortId, id)
    }
  }
  return { sortIdByColumnId, columnIdBySortId }
}
```

- [ ] **Step 4: `ColumnSpec.sort` and `defaultHidden`**

In `use-entity-columns.tsx`:
- Make the spec generic: `export interface ColumnSpec<TData, TSortId extends string = string> {`.
- Replace the `sortable?: boolean` member and its doc with:

```ts
  /** Server sort id this column's header drives; omit when the column can't sort. */
  sort?: TSortId
  /** Hidden until the viewer turns it on in the Columns menu. */
  defaultHidden?: boolean
```

- Change `export type ColumnRegistry<TData> = Record<string, ColumnSpec<TData>>` to `export type ColumnRegistry<TData, TSortId extends string = string> = Record<string, ColumnSpec<TData, TSortId>>`.
- Change `type RegistryRow<R> = R extends ColumnRegistry<infer T> ? T : never` to `type RegistryRow<R> = R extends ColumnRegistry<infer T, any> ? T : never`.
- In the column builder:
  - replace `meta: { displayName: config.label },` with `meta: { displayName: config.label, sortId: config.sort, defaultHidden: config.defaultHidden },`;
  - replace `header: config.sortable` with `header: config.sort`.

- [ ] **Step 5: `useColumnVisibility` honours `defaultHidden`**

In `use-column-visibility.ts`:
- Delete the local `getColumnId` and import it from `lib/get-column-id`.
- Add `defaultHidden?: boolean` to `ColumnMetaShape`.
- Replace the `columnVisibility`, `toggleableColumns`, `hiddenCount` and `setColumnVisible` blocks with:

```ts
  const defaultVisibleById = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const col of columns) {
      const id = getColumnId(col)
      if (id) {
        map.set(id, !(col.meta as ColumnMetaShape | undefined)?.defaultHidden)
      }
    }
    return map
  }, [columns])

  const columnVisibility = useMemo<VisibilityState>(() => {
    const v: VisibilityState = {}
    for (const col of columns) {
      const id = getColumnId(col)
      const meta = col.meta as ColumnMetaShape | undefined
      if (!id) {
        continue
      }
      if (meta?.hidden) {
        v[id] = false
        continue
      }
      v[id] = id in overrides ? overrides[id] : (defaultVisibleById.get(id) ?? true)
    }
    return v
  }, [columns, overrides, defaultVisibleById])

  const toggleableColumns = useMemo<ToggleableColumn[]>(() => {
    const list: ToggleableColumn[] = []
    for (const col of columns) {
      const id = getColumnId(col)
      const meta = col.meta as ColumnMetaShape | undefined
      if (!id || meta?.hidden || !meta?.displayName) {
        continue
      }
      list.push({
        id,
        displayName: meta.displayName,
        locked: meta.locked === true,
        visible: id in overrides ? overrides[id] : (defaultVisibleById.get(id) ?? true),
      })
    }
    return list
  }, [columns, overrides, defaultVisibleById])

  // Counts only what the viewer hid; a hidden-by-default column isn't "hidden by you".
  const hiddenCount = useMemo(
    () => toggleableColumns.reduce((n, c) => (overrides[c.id] === false && !c.locked ? n + 1 : n), 0),
    [toggleableColumns, overrides],
  )

  const setColumnVisible = useCallback((id: string, visible: boolean) => {
    setOverrides((prev) => {
      // Storing only departures from the column's default keeps localStorage free of stale entries.
      if (visible === (defaultVisibleById.get(id) ?? true)) {
        if (!(id in prev)) {
          return prev
        }
        const { [id]: _drop, ...rest } = prev
        return rest
      }
      if (prev[id] === visible) {
        return prev
      }
      return { ...prev, [id]: visible }
    })
  }, [defaultVisibleById])
```

Also update the `hiddenCount` doc on `UseColumnVisibilityResult` to "Columns the viewer hid (excludes `meta.hidden`, locked and hidden-by-default columns)."

- [ ] **Step 6: `DataTable` translates between column ids and sort ids**

In `ui/data-table.tsx`:
- Add `import { mapColumnSortIds } from '@/shared/components/data-table/lib/map-column-sort-ids'`.
- Replace the `sorting` memo with:

```tsx
  const { sortIdByColumnId, columnIdBySortId } = useMemo(() => mapColumnSortIds(columns), [columns])

  const sorting: SortingState = useMemo(() => {
    if (!serverSorting) {
      return internalSorting
    }
    const shown = serverSorting.sortBy
      ? { sortId: serverSorting.sortBy, desc: serverSorting.sortDir !== 'asc' }
      : serverSorting.fallbackVisual && { sortId: serverSorting.fallbackVisual.id, desc: serverSorting.fallbackVisual.desc }
    const columnId = shown ? columnIdBySortId.get(shown.sortId) : undefined
    return shown && columnId ? [{ id: columnId, desc: shown.desc }] : []
  }, [serverSorting, internalSorting, columnIdBySortId])
```

- In `onSortingChange`'s server branch, replace everything after the `if (!head) { … }` block with:

```tsx
          const sortId = sortIdByColumnId.get(head.id)
          if (!sortId) {
            return
          }
          // Matching the fallback visual would write a redundant URL key for the server's natural order.
          const fallback = serverSorting.fallbackVisual
          if (fallback && sortId === fallback.id && head.desc === fallback.desc && !serverSorting.sortBy) {
            return
          }
          serverSorting.onSortChange(sortId, head.desc ? 'desc' : 'asc')
```

- In `types.ts`, update the `DataTableServerSorting` doc to say `sortBy` and `fallbackVisual.id` are **sort ids** (a column's `sort`), not column ids.

- [ ] **Step 7: Adapters take a data-view result**

Replace `lib/to-data-table-pagination.ts`:

```ts
import type { DataTableServerPagination } from '@/shared/components/data-table/types'
import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList, ToolbarFilterId } from '@/shared/dal/lib/query/field-list'

/** 1-indexed page → TanStack's 0-indexed `pageIndex`; a table needs a page window, which the type enforces. */
export function toDataTablePagination<F extends FieldList, T extends ToolbarFilterId<F>>(query: DataViewQueryResult<unknown, F, T, 'page'>): DataTableServerPagination {
  const pageWindow = query.window
  return {
    pageIndex: pageWindow.page - 1,
    pageSize: pageWindow.pageSize,
    rowCount: query.total,
    onPageChange: nextIndex => pageWindow.setPage(nextIndex + 1),
    onPageSizeChange: pageWindow.setPageSize,
    pageSizeOptions: pageWindow.pageSizeOptions.length > 1 ? pageWindow.pageSizeOptions : undefined,
    isFetching: query.isFetching || query.isPlaceholderData,
    isError: query.isError,
    onRefresh: query.refresh,
  }
}
```

Replace `lib/to-data-table-sorting.ts`:

```ts
import type { DataTableServerSorting } from '@/shared/components/data-table/types'
import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList, SortId, ToolbarFilterId } from '@/shared/dal/lib/query/field-list'

interface ToDataTableSortingOptions {
  /** Arrow shown when no sort is set (legacy reads fall back to newest first); a sort id, not a column id. */
  fallbackVisual?: { id: string, desc: boolean }
}

export function toDataTableSorting<F extends FieldList, T extends ToolbarFilterId<F>>(
  query: DataViewQueryResult<unknown, F, T>,
  options: ToDataTableSortingOptions = {},
): DataTableServerSorting {
  const { sortBy, sortDir, setSort } = query.filterSort
  return {
    sortBy,
    sortDir,
    // DataTable only emits sort ids read from column `meta`, and registries type those as SortId<F>.
    onSortChange: (next, nextDir) => setSort(next as SortId<F> | undefined, nextDir),
    fallbackVisual: options.fallbackVisual ?? { id: 'createdAt', desc: true },
  }
}
```

Never destructure `window` from a query result or config: it shadows the browser global. Name it `pageWindow` or `dateWindow`.

- [ ] **Step 8: Registries and adapter callers**

- In the four registries listed under **Files**, replace each `sortable: true,` with `sort: '<that entry's key>',`. For example, in `PROPOSAL_COLUMNS.label`, `sortable: true` → `sort: 'label'`.
  - Meetings is still legacy until Task 11, so there it's `customerName: { … sort: 'customerName' }` and `scheduledFor: { … sort: 'scheduledFor' }`.
- In every table that calls the adapters:
  - `toDataTablePagination(pagination)` → `toDataTablePagination(query)`;
  - `toDataTableSorting(pagination)` → `toDataTableSorting(query)`.
  - The `query` constant exists from Task 7. The campaign leads view uses `toolbarQuery`.
  - In `use-meetings-table.tsx` (still legacy), add `const query = fromPaginatedQuery(pagination)` and use it for both adapters.

Run: `cd $REPO && grep -rn "sortable:" src --include=*.ts --include=*.tsx`
Expected: no output.

- [ ] **Step 9: Run the test and repo checks**

Run: `cd $REPO && pnpm exec tsx --tsconfig "$SCRATCH/tsconfig.json" --test "$SCRATCH/tests/map-column-sort-ids.test.ts" | grep -E '^ℹ (pass|fail)' && pnpm tsc && pnpm lint`
Expected: `ℹ pass 1`, `ℹ fail 0`; clean.

- [ ] **Step 10: Browser check**

On `/dashboard/proposals`, `/dashboard/projects`, `/dashboard/customers` and `/dashboard/meetings`:
- Click each sortable header twice. Expected: arrows and order behave as before, and the URL `*_sort` value equals the column key.
- Open the Columns menu. Expected: the "Columns · N" badge counts only columns you hid.

- [ ] **Step 11: Commit**

```bash
P="src/shared/components/data-table src/shared/modules/proposals/core/lib/columns-registry.tsx src/shared/modules/projects/core/lib/columns-registry.tsx src/shared/entities/meetings/lib/columns-registry.tsx src/shared/entities/customers/lib/columns-registry.tsx src/features/proposal-flow/ui/components/table/index.tsx src/features/project-management/ui/components/table/index.tsx src/features/campaigns-admin/ui/views/campaigns-leads-view.tsx src/shared/entities/customers/components/customers-table.tsx src/features/lead-sources-admin/ui/components/all-customers-section.tsx src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx src/shared/entities/meetings/components/meetings-table/use-meetings-table.tsx"
git diff -- $P | head -300
git add src/shared/components/data-table/lib/get-column-id.ts src/shared/components/data-table/lib/map-column-sort-ids.ts
git commit -m "feat(data-table): columns declare a server sort id; DataTable maps column ids to sort ids; hidden-by-default columns" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- $P
git show --stat HEAD
```

**Phase 1 gate:** run Task 21 Step 2 (the legacy-parity diff) now. It must print no differences before Phase 2 starts.

---

## Phase 2 — Meetings records table

**Gate to Phase 3:** Flow 1 (spec §1) behaves as written with no `[prefetch drift]`; the agent dashboard (`/dashboard`) still shows today's meetings and the month calendar.

**Preflight (before Task 9):** run `git status --short src/shared/entities/meetings src/features/records-management "src/app/(frontend)/dashboard/(records)/meetings"`. Another session left uncommitted work in `src/shared/entities/meetings/dal/server/queries.ts` (`getMeetingSchedule`, 2026-09-27). If any path this phase edits still shows ` M` from someone else, STOP and ask the owner whether to wait or commit around it.

### Task 9: `MEETING_FIELDS` and its SQL

**Files:**
- Create: `src/shared/entities/meetings/dal/meeting-fields.ts`
- Create: `src/shared/entities/meetings/dal/server/meeting-field-sql.ts`
- Test (scratch): `$SCRATCH/tests/meeting-field-sql.test.ts`

**Interfaces:**
- Consumes: Tasks 1 and 4.
- Produces:
  - `MEETING_FIELDS`: ids `meetingType proposalStatus trade rep leadSource createdAt scheduledFor outcome customerName pipeline`. `customerId` and `projectId` are dropped (ruled 2026-09-27: no caller sends them).
  - Sort ids: `meetingType rep leadSource createdAt scheduledFor outcome customerName`.
  - Option sources: Trade → `trades`, Rep → `reps`, Lead source → `leadSources`.
  - `MEETING_FIELD_SQL` (from `defineFieldSql`): default order `created_at DESC`, tie-breaker `meetings.id`.
  - Nothing reads them yet. Task 11 switches `listMeetings` together with its consumers, so every commit compiles.

- [ ] **Step 1: Write the failing test**

`$SCRATCH/tests/meeting-field-sql.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PgDialect } from 'drizzle-orm/pg-core'

import { MEETING_FIELD_SQL } from '@/shared/entities/meetings/dal/server/meeting-field-sql'

const dialect = new PgDialect()

test('proposal status: none and a status OR together', () => {
  const { sql, params } = dialect.sqlToQuery(MEETING_FIELD_SQL.filter.proposalStatus(['none', 'sent'])!)
  assert.match(sql, /NOT EXISTS \(SELECT 1 FROM "proposals" WHERE "proposals"\."meeting_id" = "meetings"\."id"\) or EXISTS/)
  assert.match(sql, /"proposals"\."status" in \(\$1\)/)
  assert.deepEqual(params, ['sent'])
})

test('proposal status: only none', () => {
  const { sql, params } = dialect.sqlToQuery(MEETING_FIELD_SQL.filter.proposalStatus(['none'])!)
  assert.doesNotMatch(sql, / or /)
  assert.deepEqual(params, [])
})

test('trade matches any picked Notion trade id in the flow-state selections', () => {
  const { sql, params } = dialect.sqlToQuery(MEETING_FIELD_SQL.filter.trade(['t1', 't2'])!)
  assert.match(sql, /jsonb_array_elements\("meetings"\."flow_state_json" -> 'tradeSelections'\) AS selection WHERE selection ->> 'tradeId' in \(\$1, \$2\)/)
  assert.deepEqual(params, ['t1', 't2'])
})

test('rep matches any participant', () => {
  const { sql, params } = dialect.sqlToQuery(MEETING_FIELD_SQL.filter.rep(['user-a'])!)
  assert.match(sql, /FROM "meeting_participants" WHERE "meeting_participants"\."meeting_id" = "meetings"\."id" AND "meeting_participants"\."user_id" in \(\$1\)/)
  assert.deepEqual(params, ['user-a'])
})

test('pipeline keeps today\'s rules', () => {
  assert.match(dialect.sqlToQuery(MEETING_FIELD_SQL.filter.pipeline('projects')!).sql, /"meetings"\."project_id" IS NOT NULL/)
  assert.match(dialect.sqlToQuery(MEETING_FIELD_SQL.filter.pipeline('rehash')!).sql, /"meetings"\."project_id" IS NULL and "meetings"\."pipeline" = \$1/)
})

test('order ends with the meeting id, so equal outcomes page stably', () => {
  const order = MEETING_FIELD_SQL.orderBy({ sortBy: 'outcome', sortDir: 'asc' }).map(s => dialect.sqlToQuery(s).sql)
  assert.deepEqual(order, ['"meetings"."meeting_outcome" asc', '"meetings"."id" asc'])
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd $REPO && pnpm exec tsx --tsconfig "$SCRATCH/tsconfig.json" --conditions=react-server --test "$SCRATCH/tests/meeting-field-sql.test.ts"`
Expected: FAIL, `meeting-field-sql` can't be found.

- [ ] **Step 3: Write the field list**

`src/shared/entities/meetings/dal/meeting-fields.ts`:

```ts
import z from 'zod'

import { meetingOutcomes, meetingTypes } from '@/shared/constants/enums'
import { proposalStatuses } from '@/shared/constants/enums/proposals'
import { dateRange, defineFieldList, multiSelect, select } from '@/shared/dal/lib/query/field-list'
import { PIPELINE_LABELS } from '@/shared/domains/pipelines/constants/pipeline-registry'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'
import { capitalize } from '@/shared/lib/formatters'

/** Every filterable and sortable meetings field; each id is both the URL key suffix and the read's filter/sort key. */
export const MEETING_FIELDS = defineFieldList({
  meetingType: { label: 'Meeting type', filter: multiSelect({ values: meetingTypes }), sort: true },
  proposalStatus: {
    label: 'Proposal status',
    filter: multiSelect({ values: ['none', ...proposalStatuses], optionLabel: status => (status === 'none' ? 'No proposal' : capitalize(status)) }),
  },
  trade: { label: 'Trade', filter: multiSelect({ schema: z.string().min(1), source: 'trades' }) },
  // User ids are free text, not uuids.
  rep: { label: 'Rep', filter: multiSelect({ schema: z.string().min(1), source: 'reps' }), sort: true },
  leadSource: { label: 'Lead source', filter: multiSelect({ schema: z.string().uuid(), source: 'leadSources' }), sort: true },
  createdAt: { label: 'Booked on', filter: dateRange(), sort: true },
  scheduledFor: { label: 'Scheduled', filter: dateRange(), sort: true },
  outcome: {
    label: 'Outcome',
    filter: multiSelect({ values: meetingOutcomes, optionLabel: outcome => MEETING_OUTCOME_LABELS[outcome] ?? outcome.replace(/_/g, ' ') }),
    sort: true,
  },
  customerName: { label: 'Customer', sort: true },
  pipeline: { label: 'Pipeline', filter: select({ values: ['projects', 'fresh', 'rehash', 'dead'], optionLabel: pipeline => PIPELINE_LABELS[pipeline] }) },
})
```

- [ ] **Step 4: Write the field SQL**

`src/shared/entities/meetings/dal/server/meeting-field-sql.ts`:

```ts
import type { SQL } from 'drizzle-orm'

import type { ProposalStatus } from '@/shared/constants/enums/proposals'

import { and, desc, eq, inArray, or, sql } from 'drizzle-orm'

import { dateRangeCondition, defineFieldSql } from '@/shared/dal/server/lib/query/field-sql'
import { user } from '@/shared/db/schema/auth'
import { customers } from '@/shared/db/schema/customers'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { meetingParticipants } from '@/shared/db/schema/meeting-participants'
import { meetings } from '@/shared/db/schema/meetings'
import { proposals } from '@/shared/db/schema/proposals'
import { MEETING_FIELDS } from '@/shared/entities/meetings/dal/meeting-fields'
import 'server-only'

// `none` = the meeting has no proposal; any other pick = one of its proposals is in that status. Picks OR together.
function proposalStatusCondition(values: readonly ('none' | ProposalStatus)[]): SQL | undefined {
  const statuses = values.filter((value): value is ProposalStatus => value !== 'none')
  return or(
    values.includes('none') ? sql`NOT EXISTS (SELECT 1 FROM ${proposals} WHERE ${proposals.meetingId} = ${meetings.id})` : undefined,
    statuses.length > 0 ? sql`EXISTS (SELECT 1 FROM ${proposals} WHERE ${proposals.meetingId} = ${meetings.id} AND ${inArray(proposals.status, statuses)})` : undefined,
  )
}

export const MEETING_FIELD_SQL = defineFieldSql(MEETING_FIELDS, {
  filter: {
    meetingType: v => inArray(meetings.meetingType, v),
    proposalStatus: v => proposalStatusCondition(v),
    // Trade picks are Notion trade ids stored in the flow-state JSON until the SOW moves to columns.
    trade: v => sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${meetings.flowStateJSON} -> 'tradeSelections') AS selection WHERE ${inArray(sql`selection ->> 'tradeId'`, v)})`,
    rep: v => sql`EXISTS (SELECT 1 FROM ${meetingParticipants} WHERE ${meetingParticipants.meetingId} = ${meetings.id} AND ${inArray(meetingParticipants.userId, v)})`,
    leadSource: v => inArray(customers.leadSourceId, v),
    createdAt: v => dateRangeCondition(meetings.createdAt, v),
    scheduledFor: v => dateRangeCondition(meetings.scheduledFor, v),
    outcome: v => inArray(meetings.meetingOutcome, v),
    pipeline: (v) => {
      if (v === 'projects') {
        return sql`${meetings.projectId} IS NOT NULL`
      }
      return and(sql`${meetings.projectId} IS NULL`, eq(meetings.pipeline, v))
    },
  },
  sort: {
    meetingType: meetings.meetingType,
    // The Rep column shows the owner, so it sorts by the owner's name; the Rep filter matches any participant.
    rep: user.name,
    leadSource: leadSourcesTable.name,
    createdAt: meetings.createdAt,
    scheduledFor: meetings.scheduledFor,
    outcome: meetings.meetingOutcome,
    customerName: customers.name,
  },
}, { defaultOrder: [desc(meetings.createdAt)], tieBreaker: meetings.id })
```

- [ ] **Step 5: Run the test and repo checks**

Run: `cd $REPO && pnpm exec tsx --tsconfig "$SCRATCH/tsconfig.json" --conditions=react-server --test "$SCRATCH/tests/meeting-field-sql.test.ts" | grep -E '^ℹ (pass|fail)' && pnpm tsc && pnpm lint`
Expected: `ℹ pass 6`, `ℹ fail 0`; clean.

- [ ] **Step 6: Commit**

```bash
P="src/shared/entities/meetings/dal/meeting-fields.ts src/shared/entities/meetings/dal/server/meeting-field-sql.ts"
git add $P
git commit -m "feat(meetings): field list v1 and its SQL — meeting type, proposal status, trade, rep, lead source, booked on" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- $P
git show --stat HEAD
```

---

### Task 10: (folded into Task 5)

The runtime option reads now live in `OPTION_SOURCE_READS` (Task 5), and `useDataViewQuery` loads them. No per-entity option hook and no option-read hook is created (Deviation 16). The number is kept so later cross-references stay valid; go straight to Task 11.

---

### Task 11: The meetings records table on `useDataViewQuery`

**Files:**
- Modify:
  - `src/shared/entities/meetings/dal/server/queries.ts`
  - `src/shared/dal/server/lib/query/search.ts` (accepts SQL expressions)
  - `src/shared/components/data-table/types/entity-table-view.ts`
  - `src/features/records-management/constants/meetings-records-table-view.ts`
  - `src/shared/entities/meetings/lib/columns-registry.tsx`
  - `src/shared/entities/meetings/components/meetings-table/use-meetings-table.tsx`
  - `src/shared/entities/meetings/components/meetings-table/meetings-table.tsx`
  - `src/features/records-management/ui/views/meetings-records-view.tsx`
  - `src/app/(frontend)/dashboard/(records)/meetings/page.tsx`
- Create: `src/shared/entities/meetings/components/meeting-customer-cell.tsx`
- Delete: `src/shared/entities/meetings/constants/meeting-filter-config.ts`
- Test (scratch): `$SCRATCH/types/meeting-callers.ts`

**Interfaces:**
- Consumes: Tasks 5, 7, 8, 9.
- Switches `listMeetings` to `meetingListInputSchema = fieldListInput(MEETING_FIELDS, { pagination: true })`. `MeetingListInput` stays the exported type name, and the router needs no change.
  - The old sort key `meetingOutcome` is gone, and so are the `customerId` / `projectId` filters. No caller sends any of them (checked 2026-09-27); Step 0 re-checks.
  - Search escapes `%` and `_` through `buildSearchWhere`, like every other migrated read.
- Produces:
  - `EntityTableView<TColumnKey, F, T>` (page window only).
  - `useMeetingsTable(tableView, opts)` returns `{ query, visibility, dataTableProps, dialogs }`. Runtime options are on `query.filterSort.options`.
  - `MeetingsTableQuery = ReturnType<typeof useMeetingsTable>['query']`.
- New columns: `meetingType` ("Meeting type") and `createdAt` ("Booked on", hidden by default).
- Sort ids on columns:
  - `customerName` → `customerName`
  - `meetingType` → `meetingType`
  - `meetingOutcome` → `outcome`
  - `ownerName` → `rep`
  - `scheduledFor` → `scheduledFor`
  - `createdAt` → `createdAt`
  - `leadSource` → `leadSource`

- [ ] **Step 0: Switch `listMeetings` to the field list (with its callers test)**

Run first:

```bash
cd $REPO && grep -rn "meetingOutcome'" src --include=*.ts --include=*.tsx | grep -i "sortBy"; grep -rn "meetingListFiltersSchema" src
```

Expected: no sort by `meetingOutcome`, and `meetingListFiltersSchema` found only in `queries.ts`. Otherwise STOP and report. A typed caller still sending `customerId` / `projectId` fails `pnpm tsc` once the schema switches (inputs are strict, Deviation 23); if one does, STOP and report.

Write `$SCRATCH/types/meeting-callers.ts`. Every case carries `pagination`, so each `@ts-expect-error` fires for its own reason:

```ts
import type { MeetingListInput } from '@/shared/entities/meetings/dal/server/queries'

import { meetingsMonthInput, meetingsWindowInput } from '@/features/agent-dashboard/constants/dashboard-queries'

const page = { limit: 20, offset: 0 }

export const today: MeetingListInput = meetingsWindowInput('today')
export const month: MeetingListInput = meetingsMonthInput('2026-09-27')
// @ts-expect-error the old sort key is gone
export const oldSort: MeetingListInput = { pagination: page, sort: { sortBy: 'meetingOutcome', sortDir: 'asc' } }
// @ts-expect-error `trade` is a list of ids
export const badTrade: MeetingListInput = { pagination: page, filters: { trade: 'x' } }
// @ts-expect-error `customerId` was dropped (no callers)
export const oldFixed: MeetingListInput = { pagination: page, filters: { customerId: '00000000-0000-4000-8000-000000000001' } }
```

Run `cd $REPO && pnpm exec tsc -p "$SCRATCH/tsconfig.json"`. Expected: FAIL (`oldSort` is still accepted by the legacy schema).

In `src/shared/entities/meetings/dal/server/queries.ts`:

1. Replace the `meetingListFiltersSchema` object and the two lines after it with:

   ```ts
   export const meetingListInputSchema = fieldListInput(MEETING_FIELDS, { pagination: true })
   export type MeetingListInput = z.infer<typeof meetingListInputSchema>
   ```

2. In `listMeetings`, replace everything from `const searchTerm = input.search?.trim()` through the `const orderBy = buildOrderBy(…)` block with:

   ```ts
       const where = and(
         ctx.scope ?? undefined,
         buildSearchWhere(input.search, [customers.name, sql`${meetings.meetingType}::text`]),
         MEETING_FIELD_SQL.where(input.filters),
       )
       const orderBy = MEETING_FIELD_SQL.orderBy(input.sort)
   ```

3. In `src/shared/dal/server/lib/query/search.ts`, widen `buildSearchWhere`'s `columns` parameter to `(AnyColumn | SQL)[]`. `ilike` already accepts both; the meetings search needs the `meeting_type::text` cast because the column is a Postgres enum.
4. Imports in `queries.ts`:
   - add `fieldListInput`, `buildSearchWhere`, `MEETING_FIELDS` and `MEETING_FIELD_SQL`;
   - remove `buildFilterWhere`, `buildOrderBy`, `dateRangeSchema`, `paginatedQueryInput`, `meetingOutcomes`, `pipelines`, and the `drizzle-orm` names lint reports unused (`ilike`, `gte`, `lte`, …);
   - keep `z`.
5. Leave the joins, row shape, participants batch and count unchanged. The Lead source filter reads `customers.lead_source_id`, which the count already joins, and sorting never touches the count.

Run `cd $REPO && pnpm exec tsc -p "$SCRATCH/tsconfig.json"`. Expected: the scratch file passes (`today` and `month` fit; all three `@ts-expect-error` lines error). `pnpm tsc` on the repo now flags the records page and table until Steps 1–7 land. That's expected, and this task commits only once all are done.

- [ ] **Step 1: The table view type**

Replace `src/shared/components/data-table/types/entity-table-view.ts` with:

```ts
import type { DataViewQueryConfig, DataViewWindow } from '@/shared/dal/lib/query/data-view-query-config'
import type { FieldList, ToolbarFilterId } from '@/shared/dal/lib/query/field-list'

/**
 * One configuration of an entity table. Everything that shapes the query key lives here,
 * as a static constant, so the page's prefetch and the client's first query build the same key.
 */
export interface EntityTableView<TColumnKey extends string, F extends FieldList, T extends ToolbarFilterId<F> = ToolbarFilterId<F>> {
  tableId: string
  query: DataViewQueryConfig<F, T, Extract<DataViewWindow<F>, { kind: 'page' }>>
  columns: readonly TColumnKey[]
}
```

- [ ] **Step 2: The table view constant**

Replace `src/features/records-management/constants/meetings-records-table-view.ts` with:

```ts
import type { EntityTableView } from '@/shared/components/data-table/types/entity-table-view'
import type { MeetingColumnKey } from '@/shared/entities/meetings/lib/columns-registry'

import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { MEETING_FIELDS } from '@/shared/entities/meetings/dal/meeting-fields'

export const MEETINGS_RECORDS_TABLE_VIEW = {
  tableId: 'meetings',
  query: {
    fields: MEETING_FIELDS,
    paramPrefix: 'pm',
    toolbar: ['meetingType', 'proposalStatus', 'trade', 'rep', 'leadSource', 'outcome', 'scheduledFor', 'createdAt', 'pipeline'],
    // A meeting's scheduled slot is its natural axis, so this table sorts by it rather than by booking date.
    defaultSort: { sortBy: 'scheduledFor', sortDir: 'desc' },
    window: { kind: 'page', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS },
  },
  columns: ['customerName', 'meetingType', 'meetingOutcome', 'ownerName', 'scheduledFor', 'createdAt', 'tradeSelections', 'leadSource', 'proposalStatuses'],
} as const satisfies EntityTableView<MeetingColumnKey, typeof MEETING_FIELDS>
```

Run: `grep -rn "meeting-filter-config\|MEETING_FILTER_CONFIG" src`
Expected: no output after this edit. Then `git rm src/shared/entities/meetings/constants/meeting-filter-config.ts`.

- [ ] **Step 3: The Customer cell with quick actions**

`src/shared/entities/meetings/components/meeting-customer-cell.tsx`:

```tsx
'use client'

import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { MeetingRow } from '@/shared/entities/meetings/lib/columns-registry'

import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { PrimaryCell } from '@/shared/components/data-table/ui/primary-cell'
import { formatAddress } from '@/shared/lib/formatters'

interface MeetingCustomerCellProps {
  meeting: MeetingRow
  actions?: EntityActionConfig<MeetingRow>[]
}

export function MeetingCustomerCell({ meeting, actions }: MeetingCustomerCellProps) {
  const address = meeting.customerAddress
    ? formatAddress(meeting.customerAddress, meeting.customerCity ?? '', meeting.customerState ?? 'CA', meeting.customerZip ?? '')
    : null
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="min-w-0 flex-1">
        <PrimaryCell
          entity={meeting}
          actions={actions}
          title={meeting.customerName ?? '—'}
          subtitle={meeting.meetingType}
          tooltipContent={`${meeting.customerName ?? 'No customer'} — ${meeting.meetingType}`}
        />
      </div>
      {/* The phone arrives already gated: agents get null until a proposal is sent. */}
      <div className="flex shrink-0 items-center gap-1 text-muted-foreground" onClick={e => e.stopPropagation()}>
        {meeting.customerPhone && <PhoneAction phone={meeting.customerPhone} compact />}
        {address && <AddressAction address={address} compact />}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Registry**

In `src/shared/entities/meetings/lib/columns-registry.tsx`:
- Import `import type { SortId } from '@/shared/dal/lib/query/field-list'`, `import type { MEETING_FIELDS } from '@/shared/entities/meetings/dal/meeting-fields'` and `MeetingCustomerCell`.
- `customerName`: keep `label: 'Meeting'` and `sort: 'customerName'`. Replace its `cell` with:

  ```tsx
      cell: ({ row, table }) => {
        const meta = table.options.meta as MeetingTableMeta | undefined
        return <MeetingCustomerCell meeting={row.original} actions={meta?.meetingActions?.(row.original)} />
      },
  ```

- Add after `customerName`:

  ```tsx
    meetingType: {
      label: 'Meeting type',
      size: 130,
      sort: 'meetingType',
    },
  ```

- `meetingOutcome`: add `sort: 'outcome',`. `ownerName`: add `sort: 'rep',`. `leadSource`: add `sort: 'leadSource',`.
- Add after `scheduledFor`:

  ```tsx
    createdAt: {
      label: 'Booked on',
      format: 'date',
      sort: 'createdAt',
      defaultHidden: true,
    },
  ```

- Change the closing `} as const satisfies ColumnRegistry<MeetingRow>` to `} as const satisfies ColumnRegistry<MeetingRow, SortId<typeof MEETING_FIELDS>>`.

- [ ] **Step 5: The entity-table hook**

In `use-meetings-table.tsx`:

1. Imports:
   - Remove `usePaginatedQuery` and `fromPaginatedQuery`.
   - Add `useDataViewQuery` from `@/shared/dal/client/hooks/use-data-view-query`.
   - Add `import type { MEETING_FIELDS } from '@/shared/entities/meetings/dal/meeting-fields'`.
2. The signature becomes `export function useMeetingsTable(tableView: EntityTableView<MeetingColumnKey, typeof MEETING_FIELDS>, { renderExpandedRow }: UseMeetingsTableOptions = {})`.
3. Replace the `usePaginatedQuery` call (and Task 8's `fromPaginatedQuery` line) with:

   ```tsx
     const query = useDataViewQuery(trpc.meetingsRouter.reads.list, {}, tableView.query)
   ```

4. In `dataTableProps`, set `data: query.rows`, `serverPagination: toDataTablePagination(query)` and `serverSorting: toDataTableSorting(query)`.
5. Return `{ query, visibility, dataTableProps, dialogs }`.
6. After the function, add `export type MeetingsTableQuery = ReturnType<typeof useMeetingsTable>['query']`.

- [ ] **Step 6: The table and the records view**

In `meetings-table.tsx`:
- `tableView: EntityTableView<MeetingColumnKey, typeof MEETING_FIELDS>`
- `header: (query: MeetingsTableQuery) => ReactNode`
- `const { query, visibility, dataTableProps, dialogs } = useMeetingsTable(tableView, { renderExpandedRow })`
- `header={header(query)}`
- `<QueryToolbar query={query} entityName="meetings">`
- Remove the `fromPaginatedQuery`, `DataViewQueryResult` and `FieldList` imports from Task 7.

`meetings-records-view.tsx` needs no edit beyond Task 7's `query` rename. Confirm it compiles.

- [ ] **Step 7: The page prefetch**

In `src/app/(frontend)/dashboard/(records)/meetings/page.tsx`:
- replace the `loadPaginatedQueryInput` import with `import { loadDataViewQueryInput } from '@/shared/dal/server/lib/query/load-data-view-query-input'`;
- replace the call with `const input = await loadDataViewQueryInput(searchParams, MEETINGS_RECORDS_TABLE_VIEW.query)`.

The `queryOptions(input)` call is now type-checked against the new input schema.

- [ ] **Step 8: Repo checks**

Run: `cd $REPO && pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
P="src/shared/entities/meetings/dal/server/queries.ts src/shared/dal/server/lib/query/search.ts src/shared/components/data-table/types/entity-table-view.ts src/features/records-management/constants/meetings-records-table-view.ts src/shared/entities/meetings/lib/columns-registry.tsx src/shared/entities/meetings/components/meeting-customer-cell.tsx src/shared/entities/meetings/components/meetings-table/use-meetings-table.tsx src/shared/entities/meetings/components/meetings-table/meetings-table.tsx src/features/records-management/ui/views/meetings-records-view.tsx src/app/(frontend)/dashboard/(records)/meetings/page.tsx src/shared/entities/meetings/constants/meeting-filter-config.ts"
git diff -- $P | head -300
git add src/shared/entities/meetings/components/meeting-customer-cell.tsx
git commit -m "feat(meetings): listMeetings and the records table on the field list — new filters, sortable columns, meeting type and booked-on columns, customer quick actions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- $P
git show --stat HEAD
```

---

### Task 12: Browser check — Flow 1

**Files:** none (verification only; no commit).

- [ ] **Step 1: As a super-admin**

1. Authenticate: `/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET>`.
2. Open `/dashboard/meetings?pm_meetingType=Fresh&pm_sort=scheduledFor&pm_dir=asc`.
   - Expected: a "Meeting type: Fresh" chip, and the Scheduled column arrow pointing up.
   - Expected: no `[prefetch drift]` in the console (`mcp__playwright__browser_console_messages`).
3. Open Filters.
   - Expected: Meeting type, Proposal status, Trade, Rep, Lead source, Outcome, Scheduled, Booked on and Pipeline.
   - Expected: Trade, Rep and Lead source list real names.
4. Pick one Trade.
   - Expected: the URL gains `pm_trade=<notion id>` and drops `pm_p`.
   - Expected: the chip reads "Trade: <name>".
   - Expected: every row's Trades cell contains that trade.
5. Click the Outcome header. Expected: `pm_sort=outcome`.
6. Click the Rep header. Expected: `pm_sort=rep`.
7. Open Columns and turn on "Booked on". Expected: the column appears and the "Columns · N" badge doesn't count it.
8. Hover a row with a phone. Expected: phone and map-pin icons open their menus without opening the row.

- [ ] **Step 2: Bad URLs**

1. `/dashboard/meetings?pm_meetingTyp=Fresh` → no chip, all rows.
2. `?pm_meetingType=Bogus` → no chip.
3. `?pm_sort=password` → default order (Scheduled, newest first) and no error.
4. `?pm_sort=meetingOutcome` → the same. This is the stale bookmark case.
5. `?pm_rep=deleted-user-id` → the chip "Rep: 1 selected" and zero rows. Clearing the chip restores the rows.

Expected in every case: no `BAD_REQUEST` in the network log.

- [ ] **Step 3: As an agent**

1. Navigate to `/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET>&role=agent&redirect=/dashboard/meetings`.
2. Expected: Filters shows Meeting type, Proposal status, Trade, Outcome, Scheduled, Booked on and Pipeline. It doesn't show Rep or Lead source.
3. Expected: no error toast or error state, and no request to `getInternalUsers` or `leadSourcesRouter.list` in the network log (`mcp__playwright__browser_network_requests`): their `canRead` check skips them for an agent. The Trade options still load.
4. Open `/dashboard/meetings?pm_rep=someone`. Expected: the chip "Rep: 1 selected" is shown and removable.

- [ ] **Step 4: Unchanged callers**

Open `/dashboard`. Expected: the snapshot strip's "today" count and the month calendar render as before, with no drift warning.

Report any failure with a screenshot. Don't continue to Phase 3 until Flow 1 passes.

---

## Phase 3 — Schedule calendar

**Gate to Phase 4:** Flow 2 (spec §1) behaves as written: the date window lives in the URL, "Showing 500 of N" appears when the cap is hit, there's no `[prefetch drift]`, and old "View in Schedule" links still land on the right day with the meeting highlighted.

**Preflight (before Task 13):** run `git status --short src/features/schedule-management src/features/meeting-flow/lib/to-calendar-event.ts src/shared/entities/activities src/trpc/routers/schedule.router "src/app/(frontend)/dashboard/schedule"`. On 2026-09-27 another session had uncommitted `confirmedAt` work in:
- `src/features/meeting-flow/lib/to-calendar-event.ts`
- `src/features/schedule-management/types/index.ts`
- `src/features/schedule-management/ui/components/meeting-card.tsx`

If those hunks aren't committed yet, STOP and ask the owner whether to wait. (A re-check late on 2026-09-27 found these paths clean, so the gate may already be clear; the command above decides.)

### Task 13: `ACTIVITY_FIELDS`, its SQL, and `listActivities` in the activities DAL

**Files:**
- Create:
  - `src/shared/entities/activities/dal/activity-fields.ts`
  - `src/shared/entities/activities/dal/server/activity-field-sql.ts`
  - `src/shared/entities/activities/dal/server/queries.ts`
- Modify: `src/trpc/routers/schedule.router/activities.router.ts` (the `list` procedure only)
- Test (scratch): `$SCRATCH/types/activity-list.ts`

**Interfaces:**
- Produces:
  - `ACTIVITY_FIELDS`: ids `type entityType ownerId scheduledFor title dueAt createdAt`.
    - Toolbar filters: `type entityType ownerId scheduledFor`.
    - Sort ids: `type scheduledFor title dueAt createdAt`.
  - `ACTIVITY_FIELD_SQL` (from `defineFieldSql`): default order `created_at DESC`, tie-breaker `activities.id`. The Owner filter reads option source `reps`.
  - `listActivities(ctx: ScopedContext, input: ActivityListInput): Promise<DalReturn<PaginatedResult<ActivityListRow>>>`, plus `activityListInputSchema` and `ActivityListRow`.
- Behaviour:
  - The owner filter accepts real user ids. Before, `z.string().uuid()` rejected every one of them.
  - Search escapes `%` and `_`, because it now uses `buildSearchWhere`.
  - Owner scoping (agents see only their own activities) is unchanged.

- [ ] **Step 1: Write the failing type test**

`$SCRATCH/types/activity-list.ts`:

```ts
import type { ActivityListInput } from '@/shared/entities/activities/dal/server/queries'

const page = { limit: 20, offset: 0 }

export const realOwner: ActivityListInput = { pagination: page, filters: { ownerId: ['kZ3pX0cU4hG2tJ1rQ9vW'] } }
// @ts-expect-error `title` sorts but doesn't filter
export const titleFilter: ActivityListInput = { pagination: page, filters: { title: 'x' } }
```

Run: `cd $REPO && pnpm exec tsc -p "$SCRATCH/tsconfig.json"`
Expected: FAIL, the module can't be found.

- [ ] **Step 2: Field list, SQL, read**

`src/shared/entities/activities/dal/activity-fields.ts`:

```ts
import z from 'zod'

import { activityEntityTypes, activityTypes } from '@/shared/constants/enums'
import { dateRange, defineFieldList, multiSelect } from '@/shared/dal/lib/query/field-list'
import { capitalize } from '@/shared/lib/formatters'

/** Every filterable and sortable activities field; each id is both the URL key suffix and the read's filter/sort key. */
export const ACTIVITY_FIELDS = defineFieldList({
  type: { label: 'Type', filter: multiSelect({ values: activityTypes, optionLabel: capitalize }), sort: true },
  entityType: { label: 'Related to', filter: multiSelect({ values: activityEntityTypes, optionLabel: capitalize }) },
  // User ids are free text, not uuids.
  ownerId: { label: 'Owner', filter: multiSelect({ schema: z.string().min(1), source: 'reps' }) },
  scheduledFor: { label: 'Scheduled', filter: dateRange(), sort: true },
  title: { label: 'Title', sort: true },
  dueAt: { label: 'Due', sort: true },
  createdAt: { label: 'Created', sort: true },
})
```

`src/shared/entities/activities/dal/server/activity-field-sql.ts`:

```ts
import { desc, inArray } from 'drizzle-orm'

import { dateRangeCondition, defineFieldSql } from '@/shared/dal/server/lib/query/field-sql'
import { activities } from '@/shared/db/schema/activities'
import { ACTIVITY_FIELDS } from '@/shared/entities/activities/dal/activity-fields'
import 'server-only'

export const ACTIVITY_FIELD_SQL = defineFieldSql(ACTIVITY_FIELDS, {
  filter: {
    type: v => inArray(activities.type, v),
    entityType: v => inArray(activities.entityType, v),
    ownerId: v => inArray(activities.ownerId, v),
    scheduledFor: v => dateRangeCondition(activities.scheduledFor, v),
  },
  sort: {
    type: activities.type,
    scheduledFor: activities.scheduledFor,
    title: activities.title,
    dueAt: activities.dueAt,
    createdAt: activities.createdAt,
  },
}, { defaultOrder: [desc(activities.createdAt)], tieBreaker: activities.id })
```

`src/shared/entities/activities/dal/server/queries.ts`:

```ts
import type { SQL } from 'drizzle-orm'
import type z from 'zod'

import type { PaginatedResult } from '@/shared/dal/lib/query/contracts'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'

import { and, count, eq, getTableColumns } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { fieldListInput } from '@/shared/dal/server/lib/query/field-list-input'
import { paginate } from '@/shared/dal/server/lib/query/output'
import { buildSearchWhere } from '@/shared/dal/server/lib/query/search'
import { db } from '@/shared/db'
import { activities } from '@/shared/db/schema/activities'
import { user } from '@/shared/db/schema/auth'
import { ACTIVITY_FIELDS } from '@/shared/entities/activities/dal/activity-fields'
import { ACTIVITY_FIELD_SQL } from '@/shared/entities/activities/dal/server/activity-field-sql'

export const activityListInputSchema = fieldListInput(ACTIVITY_FIELDS, { pagination: true })
export type ActivityListInput = z.infer<typeof activityListInputSchema>

export type ActivityListRow = typeof activities.$inferSelect & { ownerName: string | null, ownerImage: string | null }

// Agents see only their own activities; omni and system callers see all. No session on a scoped caller matches nothing.
function activityOwnerScope(ctx: ScopedContext): SQL | undefined {
  if (!ctx.ability || ctx.ability.can('manage', 'all')) {
    return undefined
  }
  return eq(activities.ownerId, ctx.session?.user.id ?? '')
}

export async function listActivities(ctx: ScopedContext, input: ActivityListInput): Promise<DalReturn<PaginatedResult<ActivityListRow>>> {
  return dalDbOperation(async () => {
    const where = and(
      activityOwnerScope(ctx),
      buildSearchWhere(input.search, [activities.title, activities.description]),
      ACTIVITY_FIELD_SQL.where(input.filters),
    )

    return paginate({
      query: () => db
        .select({
          ...getTableColumns(activities),
          ownerName: user.name,
          ownerImage: user.image,
        })
        .from(activities)
        .leftJoin(user, eq(user.id, activities.ownerId))
        .where(where)
        .orderBy(...ACTIVITY_FIELD_SQL.orderBy(input.sort))
        .limit(input.pagination.limit)
        .offset(input.pagination.offset),
      count: async () => {
        const [row] = await db
          .select({ c: count(activities.id) })
          .from(activities)
          .where(where)
        return row?.c ?? 0
      },
    })
  })
}
```

- [ ] **Step 3: The procedure calls the DAL**

In `activities.router.ts`, replace the whole `list: agentProcedure … }),` block, including its comment, with:

```ts
  list: agentProcedure
    .input(activityListInputSchema)
    .query(async ({ ctx, input }) => dalToTrpc(await listActivities({ ...ctx, scope: null }, input))),
```

- Add imports for `activityListInputSchema` and `listActivities` from `@/shared/entities/activities/dal/server/queries`, and `dalToTrpc` from `@/trpc/lib/dal-to-trpc`.
- Remove the imports lint reports unused: `buildFilterWhere`, `paginate`, `dateRangeSchema`, `paginatedQueryInput`, `buildOrderBy`, and the unused `drizzle-orm` names.
- The other procedures (`getById`, `create`, …) still import `db`. They're out of scope (spec §14).

- [ ] **Step 4: Run the type test and repo checks**

Run: `cd $REPO && pnpm exec tsc -p "$SCRATCH/tsconfig.json" && pnpm tsc && pnpm lint`
Expected: clean.
- `SCHEDULE_ACTIVITIES_LIST_INPUT` (`{ pagination: { limit: 500, offset: 0 } }`) still fits the new input until Task 14 replaces it.

- [ ] **Step 5: Commit**

```bash
P="src/shared/entities/activities/dal/activity-fields.ts src/shared/entities/activities/dal/server/activity-field-sql.ts src/shared/entities/activities/dal/server/queries.ts src/trpc/routers/schedule.router/activities.router.ts"
git add src/shared/entities/activities/dal/activity-fields.ts src/shared/entities/activities/dal/server/activity-field-sql.ts src/shared/entities/activities/dal/server/queries.ts
git commit -m "feat(activities): field list and listActivities in the activities DAL; owner filter accepts real user ids" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- $P
git show --stat HEAD
```

---

### Task 14: Schedule configs, the Show parser, the schedule link, page prefetch and old-link redirect

**Files:**
- Create:
  - `src/features/schedule-management/constants/schedule-queries.ts`
  - `src/features/schedule-management/lib/to-schedule-window-href.ts`
- Modify:
  - `src/shared/config/roots.ts` (`scheduleWithMeetingHighlight` only)
  - `src/features/schedule-management/constants/query-parsers.ts`
  - `src/features/schedule-management/hooks/use-schedule-highlight.ts`
  - `src/app/(frontend)/dashboard/schedule/page.tsx`
- Delete: `src/features/schedule-management/constants/schedule-query-inputs.ts` (in Task 15, when its last reader goes)
- Test (scratch): `$SCRATCH/tests/schedule-links.test.ts`, `$SCRATCH/types/schedule-queries.ts`

**Interfaces:**
- Produces:
  - `SCHEDULE_ROW_CAP` (500), `SCHEDULE_SHOW_VALUES`, `ScheduleShow`, `SCHEDULE_SHOW_LABELS`.
  - `SCHEDULE_MEETINGS_QUERY` and `SCHEDULE_ACTIVITIES_QUERY`: prefix `s`, date window on `scheduledFor`.
  - `scheduleShowParser`.
  - `ROOTS.dashboard.scheduleWithMeetingHighlight(meetingId, scheduledFor)` now returns `/dashboard/schedule?highlightMeeting=…&show=meetings&s_d=<LA day>`. Every "View in Schedule" link (entity action, Google Calendar descriptions, push notifications, the meeting section) gets the new shape with no caller change.
  - `toScheduleWindowHref(searchParams) → string | null`: an old link (`highlightMeeting` + `highlightDate`) becomes today's link through the same `ROOTS` builder.
- URL:
  - `show=meetings|activities` (default `meetings`);
  - `s_d=YYYY-MM-DD` (default: today in LA);
  - `s_v=today|week|month` (default `week`);
  - `s_<filter id>` for each toolbar filter.
- Activities' Owner options come from option source `reps` through `useDataViewQuery` (Task 5). There's no activities option hook.

- [ ] **Step 1: Write the failing tests**

`$SCRATCH/tests/schedule-links.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SCHEDULE_MEETINGS_QUERY } from '@/features/schedule-management/constants/schedule-queries'
import { toScheduleWindowHref } from '@/features/schedule-management/lib/to-schedule-window-href'
import { ROOTS } from '@/shared/config/roots'
import { dataViewUrlKeys } from '@/shared/dal/lib/query/derive-data-view-input'
import { businessDayKey } from '@/shared/lib/business-time'

test('new links open the meeting\'s LA day through the date window', () => {
  // 05:30 UTC on the 28th is 22:30 on the 27th in Los Angeles.
  const href = ROOTS.dashboard.scheduleWithMeetingHighlight('m1', '2026-09-28T05:30:00.000Z')
  assert.equal(href, '/dashboard/schedule?highlightMeeting=m1&show=meetings&s_d=2026-09-27')
})

test('the link writes the key the meetings calendar reads, as businessDayKey would', () => {
  const instant = '2026-03-08T09:30:00.000Z'
  const search = new URLSearchParams(ROOTS.dashboard.scheduleWithMeetingHighlight('m1', instant).split('?')[1])
  assert.equal(search.get(dataViewUrlKeys(SCHEDULE_MEETINGS_QUERY.paramPrefix).anchorKey), businessDayKey(new Date(instant)))
})

test('an old link redirects to the new one', () => {
  assert.equal(
    toScheduleWindowHref({ highlightMeeting: 'm1', highlightDate: '2026-09-28T05:30:00.000Z' }),
    '/dashboard/schedule?highlightMeeting=m1&show=meetings&s_d=2026-09-27',
  )
})

test('a URL without highlightDate is not an old link', () => {
  assert.equal(toScheduleWindowHref({ highlightMeeting: 'm1', show: 'meetings' }), null)
})

test('an unparseable highlightDate still redirects, dropping the date', () => {
  assert.equal(toScheduleWindowHref({ highlightMeeting: 'm1', highlightDate: 'nope' }), '/dashboard/schedule?highlightMeeting=m1')
})
```

`$SCRATCH/types/schedule-queries.ts`:

```ts
import type { ToolbarFilterId } from '@/shared/dal/lib/query/field-list'
import type { ACTIVITY_FIELDS } from '@/shared/entities/activities/dal/activity-fields'

import { SCHEDULE_ACTIVITIES_QUERY, SCHEDULE_MEETINGS_QUERY } from '@/features/schedule-management/constants/schedule-queries'

export const prefixesMatch: typeof SCHEDULE_MEETINGS_QUERY.paramPrefix = SCHEDULE_ACTIVITIES_QUERY.paramPrefix
// @ts-expect-error an id both calendars' toolbars used would be rejected by the activities toolbar's `satisfies`
export const overlap = ['type'] as const satisfies readonly Exclude<ToolbarFilterId<typeof ACTIVITY_FIELDS>, 'type'>[]
```

Run: `cd $REPO && pnpm exec tsc -p "$SCRATCH/tsconfig.json"`
Expected: FAIL, the modules can't be found.

- [ ] **Step 2: Configs**

`src/features/schedule-management/constants/schedule-queries.ts`:

```ts
import type { DataViewQueryConfig } from '@/shared/dal/lib/query/data-view-query-config'
import type { ToolbarFilterId } from '@/shared/dal/lib/query/field-list'

import { ACTIVITY_FIELDS } from '@/shared/entities/activities/dal/activity-fields'
import { MEETING_FIELDS } from '@/shared/entities/meetings/dal/meeting-fields'

/** A busy month can pass this; the calendar then says "Showing 500 of N" rather than dropping rows. */
export const SCHEDULE_ROW_CAP = 500

export const SCHEDULE_SHOW_VALUES = ['meetings', 'activities'] as const
export type ScheduleShow = (typeof SCHEDULE_SHOW_VALUES)[number]

export const SCHEDULE_SHOW_LABELS: Record<ScheduleShow, string> = {
  meetings: 'Meetings',
  activities: 'Activities',
}

export const SCHEDULE_MEETINGS_QUERY = {
  fields: MEETING_FIELDS,
  // `ROOTS.dashboard.scheduleWithMeetingHighlight` writes `s_d`; change both together.
  paramPrefix: 's',
  toolbar: ['meetingType', 'outcome', 'trade', 'rep', 'leadSource', 'proposalStatus'],
  defaultSort: { sortBy: 'scheduledFor', sortDir: 'asc' },
  window: { kind: 'date', field: 'scheduledFor', cap: SCHEDULE_ROW_CAP },
} as const satisfies DataViewQueryConfig<typeof MEETING_FIELDS>

export const SCHEDULE_ACTIVITIES_QUERY = {
  fields: ACTIVITY_FIELDS,
  paramPrefix: 's',
  // Both configs share the `s` prefix so the date window survives the Show toggle; a toolbar id in both would carry one entity's filter into the other.
  toolbar: ['type', 'entityType', 'ownerId'] as const satisfies readonly Exclude<ToolbarFilterId<typeof ACTIVITY_FIELDS>, (typeof SCHEDULE_MEETINGS_QUERY)['toolbar'][number]>[],
  defaultSort: { sortBy: 'scheduledFor', sortDir: 'asc' },
  window: { kind: 'date', field: 'scheduledFor', cap: SCHEDULE_ROW_CAP },
} as const satisfies DataViewQueryConfig<typeof ACTIVITY_FIELDS>
```

- [ ] **Step 3: Parsers and the highlight hook**

Replace `src/features/schedule-management/constants/query-parsers.ts` with:

```ts
import { parseAsString, parseAsStringLiteral } from 'nuqs/server'

import { SCHEDULE_SHOW_VALUES } from '@/features/schedule-management/constants/schedule-queries'

export const highlightMeetingParser = parseAsString.withDefault('').withOptions({ clearOnDefault: true })

// Unprefixed on purpose: `show` picks which prefixed config (`s_…`) applies.
export const scheduleShowParser = parseAsStringLiteral(SCHEDULE_SHOW_VALUES).withDefault('meetings').withOptions({ clearOnDefault: true })
```

In `use-schedule-highlight.ts`:
- Remove the `highlightDate` state, its `useQueryState` line, the `highlightDateParser` import, `void setHighlightDate('')` in the timer, and `highlightDate` from the return value and the `UseScheduleHighlightReturn` interface.
- The day now comes from `s_d`: the page redirect sets it for old links, and the date window reads it.

- [ ] **Step 4: The schedule link and the old-link redirect**

In `src/shared/config/roots.ts`, replace the `scheduleWithMeetingHighlight` entry and its doc comment with the code below. The file must stay free of value imports (see its first comment: `next.config.ts` loads it without `@/` alias resolution), so the LA day is computed inline rather than through `businessDayKey`. The scratch test checks the two agree.

```ts
    /**
     * "View in Schedule": opens the meetings calendar on the meeting's LA day (`show`, `s_d` are the
     * schedule's date-window keys, prefix `s` in schedule-queries.ts) and highlights it.
     * Used by the entity action, GCal event descriptions and push notifications; change the shape here only.
     */
    scheduleWithMeetingHighlight: (
      meetingId: string,
      scheduledFor?: string | null,
    ) => {
      const search = new URLSearchParams({ highlightMeeting: meetingId })
      const instant = scheduledFor ? new Date(scheduledFor) : null
      if (instant && !Number.isNaN(instant.getTime())) {
        search.set('show', 'meetings')
        // businessDayKey() inlined: this file can't value-import (see the note at the top).
        search.set('s_d', instant.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }))
      }
      return `/dashboard/schedule?${search.toString()}`
    },
```

`src/features/schedule-management/lib/to-schedule-window-href.ts`:

```ts
import { ROOTS } from '@/shared/config/roots'

/**
 * Links sent before the date window moved into the URL (Google Calendar event descriptions,
 * push notifications) carry `highlightDate=<ISO>`. Returns today's link for the same meeting,
 * or null when the URL isn't an old link.
 */
export function toScheduleWindowHref(searchParams: Record<string, string | string[] | undefined>): string | null {
  const { highlightMeeting, highlightDate } = searchParams
  if (typeof highlightMeeting !== 'string' || typeof highlightDate !== 'string') {
    return null
  }
  return ROOTS.dashboard.scheduleWithMeetingHighlight(highlightMeeting, highlightDate)
}
```

- [ ] **Step 5: The page**

Replace `src/app/(frontend)/dashboard/schedule/page.tsx` with:

```tsx
import type { SearchParams } from 'nuqs/server'

import { redirect } from 'next/navigation'
import { createLoader } from 'nuqs/server'

import { scheduleShowParser } from '@/features/schedule-management/constants/query-parsers'
import { SCHEDULE_ACTIVITIES_QUERY, SCHEDULE_MEETINGS_QUERY } from '@/features/schedule-management/constants/schedule-queries'
import { toScheduleWindowHref } from '@/features/schedule-management/lib/to-schedule-window-href'
import { ScheduleView } from '@/features/schedule-management/ui/views/schedule-view'
import { LoadingState } from '@/shared/components/states/loading-state'
import { loadDataViewQueryInput } from '@/shared/dal/server/lib/query/load-data-view-query-input'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { HydrateClient } from '@/trpc/components/hydrate-client'
import { prefetch } from '@/trpc/lib/prefetch'
import { trpc } from '@/trpc/server'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<SearchParams>
}

export default async function SchedulePage({ searchParams }: Props) {
  const params = await searchParams
  // Converting here, not in the browser, keeps the prefetched window and the client's first window identical.
  const legacyRedirect = toScheduleWindowHref(params)
  if (legacyRedirect !== null) {
    redirect(legacyRedirect)
  }

  const authState = await protectDashboardPage()

  // Unauthenticated visitors get the layout's sign-in screen; skip the prefetch work.
  if (authState.status === 'authenticated') {
    const { show } = await createLoader({ show: scheduleShowParser })(params)
    if (show === 'activities') {
      prefetch(trpc.scheduleRouter.activities.list.queryOptions(await loadDataViewQueryInput(params, SCHEDULE_ACTIVITIES_QUERY)))
    }
    else {
      prefetch(trpc.meetingsRouter.reads.list.queryOptions(await loadDataViewQueryInput(params, SCHEDULE_MEETINGS_QUERY)))
    }
  }

  return (
    <HydrateClient fallback={<LoadingState title="Loading schedule…" />}>
      <ScheduleView />
    </HydrateClient>
  )
}
```

- [ ] **Step 6: Run the tests**

Run: `cd $REPO && pnpm exec tsc -p "$SCRATCH/tsconfig.json" && for tz in UTC Asia/Tokyo; do TZ=$tz pnpm exec tsx --tsconfig "$SCRATCH/tsconfig.json" --test "$SCRATCH/tests/schedule-links.test.ts" | grep -E '^ℹ (pass|fail)'; done`
Expected: `ℹ pass 5`, `ℹ fail 0` twice.

`pnpm tsc` on the repo flags `schedule-view.tsx` until Task 15: it still reads `highlightDate` and the old inputs. Keep this task uncommitted and commit Tasks 14 and 15 together at the end of Task 15, so every commit on `main` compiles. Their diffs stay separate for review.

---

### Task 15: The calendar on URL date windows, one entity at a time

**Files:**
- Create in `src/features/schedule-management/ui/components/`: `schedule-meetings-calendar.tsx`, `schedule-activities-calendar.tsx`, `schedule-show-toggle.tsx`
- Modify:
  - `src/features/schedule-management/ui/components/schedule-calendar.tsx` (becomes a layout that takes render callbacks)
  - `src/features/schedule-management/ui/views/schedule-view.tsx`
  - `src/features/schedule-management/lib/to-calendar-event.ts`
  - `src/features/meeting-flow/lib/to-calendar-event.ts`
  - `src/shared/components/calendar/lib/calendar-helpers.ts`
- Delete: `src/features/schedule-management/constants/schedule-query-inputs.ts`

**Interfaces:**
- Consumes: Task 5 (`DateWindowControls`), Task 7 (`QueryToolbar.Standard` with `leading`), Task 14.
- `ScheduleCalendar` props: `{ events, dateWindow, showSaturday?, renderCard, renderCompact, controlsRight? }`.
- Behaviour changes (spec §10):
  - only `scheduledFor` places an event;
  - one entity at a time;
  - view and day in the URL;
  - no "No Schedule Items" empty state, because an empty week is a normal calendar.
  - Activity dots carry the activities entity's own actions (`useActivityActionConfigs`: view, mark complete, delete). Before, they carried meeting actions called with an activity id.
  - Picking today in `CalendarHeader` clears `s_d` from the URL (today is the default window) instead of pinning today's date.

- [ ] **Step 1: Calendar helpers**

In `src/shared/components/calendar/lib/calendar-helpers.ts`:
- delete `getDateRange` (run `grep -rn "getDateRange" src` first: its only reader is `schedule-calendar.tsx`, rewritten below);
- delete its now-unused `date-fns` imports;
- add:

```ts
/** Local noon, so date-fns arithmetic and the grid can't slip a day across a DST change. */
export function calendarDayToLocalDate(calendarDay: string): Date {
  const [year, month, day] = calendarDay.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

export function localDateToCalendarDay(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}
```

- [ ] **Step 2: Events are placed by `scheduledFor` only**

In `src/features/meeting-flow/lib/to-calendar-event.ts`, change `startAt: meeting.scheduledFor ?? meeting.createdAt,` to `startAt: meeting.scheduledFor,`. The column is `NOT NULL`, so the fallback never ran.

In `src/features/schedule-management/lib/to-calendar-event.ts`, make the function return `null` for an unscheduled activity:

```ts
/** The calendar windows on `scheduledFor`, so an unscheduled activity has no place on it. */
export function activityToCalendarEvent(activity: ActivityRow): ScheduleActivityEvent | null {
  if (!activity.scheduledFor) {
    return null
  }
  return {
    kind: 'activity',
    id: activity.id,
    activityId: activity.id,
    activityType: activity.type,
    startAt: activity.scheduledFor,
    title: activity.title,
    description: activity.description,
    entityType: activity.entityType,
    entityId: activity.entityId,
    ownerId: activity.ownerId,
    ownerName: activity.ownerName,
    dueAt: activity.dueAt,
    completedAt: activity.completedAt,
  }
}
```

- [ ] **Step 3: `ScheduleCalendar` becomes a layout**

Replace `schedule-calendar.tsx` with:

```tsx
'use client'

import type { ReactNode } from 'react'

import type { ScheduleCalendarEvent } from '@/features/schedule-management/types'
import type { DateWindowControls } from '@/shared/dal/client/lib/types'

import { useCallback, useMemo } from 'react'

import { DEFAULT_HIDDEN_DAYS } from '@/features/schedule-management/constants/schedule-calendar-config'
import { calendarDayToLocalDate, localDateToCalendarDay } from '@/shared/components/calendar/lib/calendar-helpers'
import { CalendarHeader } from '@/shared/components/calendar/ui/calendar-header'
import { CalendarMonthView } from '@/shared/components/calendar/ui/calendar-month-view'
import { businessToday } from '@/shared/lib/business-time'

import { ScheduleTodayView } from './schedule-today-view'
import { ScheduleWeekView } from './schedule-week-view'

interface ScheduleCalendarProps {
  events: ScheduleCalendarEvent[]
  /** Anchor day and view live in the URL (`s_d`, `s_v`), so the server prefetches the same window. */
  dateWindow: DateWindowControls
  showSaturday?: boolean
  renderCard: (event: ScheduleCalendarEvent) => ReactNode
  renderCompact: (event: ScheduleCalendarEvent) => ReactNode
  /** Right-aligned controls rendered inside the calendar header strip */
  controlsRight?: ReactNode
}

export function ScheduleCalendar({ events, dateWindow, showSaturday = false, renderCard, renderCompact, controlsRight }: ScheduleCalendarProps) {
  const { anchor, view, setAnchor } = dateWindow
  const currentDate = useMemo(() => calendarDayToLocalDate(anchor), [anchor])
  const handleDateChange = useCallback((date: Date) => {
    const calendarDay = localDateToCalendarDay(date)
    // Today is the default window, so it clears `s_d` rather than pinning a date in the URL.
    setAnchor(calendarDay === businessToday() ? undefined : calendarDay)
  }, [setAnchor])

  const hiddenDays = showSaturday
    ? DEFAULT_HIDDEN_DAYS.filter(d => d !== 6)
    : [...new Set([...DEFAULT_HIDDEN_DAYS, 6])]

  return (
    <div className="flex h-full w-full flex-col rounded-xl border">
      <CalendarHeader
        currentDate={currentDate}
        activeView={view}
        onDateChange={handleDateChange}
        rightSlot={controlsRight}
      />

      <div className="w-full flex-1 min-h-0 overflow-hidden">
        {view === 'today' && (
          <ScheduleTodayView events={events} currentDate={currentDate} renderCard={renderCard} />
        )}
        {view === 'week' && (
          <ScheduleWeekView events={events} currentDate={currentDate} hiddenDays={hiddenDays} renderCard={renderCard} />
        )}
        {view === 'month' && (
          <CalendarMonthView events={events} currentDate={currentDate} renderCompact={renderCompact} />
        )}
      </div>
    </div>
  )
}
```

If `ScheduleTodayView`, `ScheduleWeekView` or `CalendarMonthView` type their callback props more narrowly, match those types exactly. Don't cast.

- [ ] **Step 4: The Show toggle**

`schedule-show-toggle.tsx`:

```tsx
'use client'

import type { ScheduleShow } from '@/features/schedule-management/constants/schedule-queries'

import { SCHEDULE_SHOW_LABELS, SCHEDULE_SHOW_VALUES } from '@/features/schedule-management/constants/schedule-queries'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'

interface ScheduleShowToggleProps {
  value: ScheduleShow
  onChange: (value: ScheduleShow) => void
}

export function ScheduleShowToggle({ value, onChange }: ScheduleShowToggleProps) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value}
      onValueChange={(next) => {
        const show = SCHEDULE_SHOW_VALUES.find(candidate => candidate === next)
        if (show) {
          onChange(show)
        }
      }}
      aria-label="Show"
      className="shrink-0"
    >
      {SCHEDULE_SHOW_VALUES.map(show => (
        <ToggleGroupItem key={show} value={show} className="h-11 px-3 lg:h-9">
          {SCHEDULE_SHOW_LABELS[show]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
```

Check `ToggleGroup`'s props in `src/shared/components/ui/toggle-group.tsx` (shadcn). If it has no `variant`, drop that prop.

- [ ] **Step 5: The meetings calendar**

`schedule-meetings-calendar.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'

import type { ScheduleCalendarEvent, ScheduleMeetingEvent } from '@/features/schedule-management/types'

import { useCallback, useMemo, useState } from 'react'

import { toCalendarEvent } from '@/features/meeting-flow/lib'
import { SCHEDULE_MEETINGS_QUERY } from '@/features/schedule-management/constants/schedule-queries'
import { MeetingCard } from '@/features/schedule-management/ui/components/meeting-card'
import { ScheduleCalendar } from '@/features/schedule-management/ui/components/schedule-calendar'
import { ScheduleCalendarDot } from '@/features/schedule-management/ui/components/schedule-calendar-dot'
import { ScheduleControlsBar } from '@/features/schedule-management/ui/components/schedule-controls-bar'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { useDataViewQuery } from '@/shared/dal/client/hooks/use-data-view-query'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { ManageParticipantsModal } from '@/shared/entities/meetings/components/manage-participants-modal'
import { useMeetingActionConfigs } from '@/shared/entities/meetings/hooks/use-meeting-action-configs'
import { useMeetingActions } from '@/shared/entities/meetings/hooks/use-meeting-actions'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useTRPC } from '@/trpc/helpers'

interface ScheduleMeetingsCalendarProps {
  showToggle: ReactNode
  showSaturday: boolean
  onToggleSaturday: () => void
  onNewActivity: () => void
  isHighlighted: (meetingId: string) => boolean
  highlightRef: (meetingId: string) => React.RefCallback<HTMLDivElement>
}

export function ScheduleMeetingsCalendar({ showToggle, showSaturday, onToggleSaturday, onNewActivity, isHighlighted, highlightRef }: ScheduleMeetingsCalendarProps) {
  const trpc = useTRPC()
  const query = useDataViewQuery(trpc.meetingsRouter.reads.list, {}, SCHEDULE_MEETINGS_QUERY)
  const { updateScheduledFor } = useMeetingActions()
  const { open: openModal, setModal } = useModalStore()
  const [assignRepMeetingId, setAssignRepMeetingId] = useState<string | null>(null)

  const events = useMemo<ScheduleCalendarEvent[]>(() => query.rows.map(toCalendarEvent), [query.rows])

  const handleViewMeeting = useCallback((event: ScheduleMeetingEvent) => {
    if (!event.customerId) {
      return
    }
    setModal({
      accessor: 'CustomerProfile',
      Component: CustomerProfileModal,
      props: { customerId: event.customerId, defaultTab: 'meetings' as const, highlightMeetingId: event.meetingId },
    })
    openModal()
  }, [setModal, openModal])

  const handleAssignOwner = useCallback((event: ScheduleCalendarEvent) => {
    if (event.kind === 'meeting') {
      setAssignRepMeetingId(event.meetingId)
    }
  }, [])

  const handleViewCalendarEvent = useCallback((event: ScheduleCalendarEvent) => {
    if (event.kind === 'meeting') {
      handleViewMeeting(event)
    }
  }, [handleViewMeeting])

  const { actions, DeleteConfirmDialog, OutcomeReasonDialog, RescheduleDialog } = useMeetingActionConfigs<ScheduleCalendarEvent>({
    onView: handleViewCalendarEvent,
    onAssignOwner: handleAssignOwner,
  })

  const handleUpdateScheduledFor = useCallback((meetingId: string, date: Date) => {
    updateScheduledFor.mutate({ id: meetingId, data: { scheduledFor: date.toISOString() } })
  }, [updateScheduledFor])

  const renderCard = useCallback((event: ScheduleCalendarEvent) => (event.kind === 'meeting'
    ? (
        <MeetingCard
          event={event}
          onAssignOwner={handleAssignOwner}
          onUpdateScheduledFor={handleUpdateScheduledFor}
          isHighlighted={isHighlighted(event.meetingId)}
          highlightRef={highlightRef(event.meetingId)}
        />
      )
    : null), [handleAssignOwner, handleUpdateScheduledFor, isHighlighted, highlightRef])

  const renderCompact = useCallback((event: ScheduleCalendarEvent) => (
    <ScheduleCalendarDot event={event} actions={actions} onUpdateScheduledFor={handleUpdateScheduledFor} />
  ), [actions, handleUpdateScheduledFor])

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <QueryToolbar query={query} entityName="meetings">
        <QueryToolbar.Standard leading={showToggle} searchPlaceholder="Search by customer or type…" />
      </QueryToolbar>
      <div className="min-h-0 flex-1">
        <ScheduleCalendar
          events={events}
          dateWindow={query.window}
          showSaturday={showSaturday}
          renderCard={renderCard}
          renderCompact={renderCompact}
          controlsRight={(
            <ScheduleControlsBar
              calendarView={query.window.view}
              onCalendarViewChange={query.window.setView}
              showSaturday={showSaturday}
              onToggleSaturday={onToggleSaturday}
              onNewActivity={onNewActivity}
            />
          )}
        />
      </div>
      <ManageParticipantsModal
        meetingIds={assignRepMeetingId ? [assignRepMeetingId] : []}
        open={!!assignRepMeetingId}
        onOpenChange={open => !open && setAssignRepMeetingId(null)}
      />
      <DeleteConfirmDialog />
      <OutcomeReasonDialog />
      <RescheduleDialog />
    </div>
  )
}
```

`query.window` is typed `DateWindowControls`, because `SCHEDULE_MEETINGS_QUERY.window.kind` is `'date'`. No narrowing is needed.

- [ ] **Step 6: The activities calendar**

`schedule-activities-calendar.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'

import type { ScheduleCalendarEvent } from '@/features/schedule-management/types'

import { format } from 'date-fns'
import { useCallback, useMemo } from 'react'

import { SCHEDULE_ACTIVITIES_QUERY } from '@/features/schedule-management/constants/schedule-queries'
import { activityToCalendarEvent } from '@/features/schedule-management/lib/to-calendar-event'
import { ActivityDotContent } from '@/features/schedule-management/ui/components/activity-dot-content'
import { ScheduleCalendar } from '@/features/schedule-management/ui/components/schedule-calendar'
import { ScheduleControlsBar } from '@/features/schedule-management/ui/components/schedule-controls-bar'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { useDataViewQuery } from '@/shared/dal/client/hooks/use-data-view-query'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { useActivityActionConfigs } from '@/shared/entities/activities/hooks/use-activity-action-configs'
import { useTRPC } from '@/trpc/helpers'

interface ScheduleActivitiesCalendarProps {
  showToggle: ReactNode
  showSaturday: boolean
  onToggleSaturday: () => void
  onNewActivity: () => void
}

export function ScheduleActivitiesCalendar({ showToggle, showSaturday, onToggleSaturday, onNewActivity }: ScheduleActivitiesCalendarProps) {
  const trpc = useTRPC()
  const ability = useAbility()
  const query = useDataViewQuery(trpc.scheduleRouter.activities.list, {}, SCHEDULE_ACTIVITIES_QUERY)
  const { actions, DeleteConfirmDialog } = useActivityActionConfigs<ScheduleCalendarEvent>()

  const permittedActions = useMemo(
    () => actions.filter(({ action }) => !action.permission || ability.can(action.permission[0], action.permission[1])),
    [actions, ability],
  )

  const events = useMemo<ScheduleCalendarEvent[]>(
    () => query.rows.flatMap(row => activityToCalendarEvent(row) ?? []),
    [query.rows],
  )

  const renderCard = useCallback((event: ScheduleCalendarEvent) => (
    <div className="rounded-md border p-2 text-xs">{event.title}</div>
  ), [])

  const renderCompact = useCallback((event: ScheduleCalendarEvent) => (event.kind === 'activity'
    ? <ActivityDotContent event={event} formattedTime={format(new Date(event.startAt), 'h:mm a')} permittedActions={permittedActions} />
    : null), [permittedActions])

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <QueryToolbar query={query} entityName="activities">
        <QueryToolbar.Standard leading={showToggle} searchPlaceholder="Search by title or notes…" />
      </QueryToolbar>
      <div className="min-h-0 flex-1">
        <ScheduleCalendar
          events={events}
          dateWindow={query.window}
          showSaturday={showSaturday}
          renderCard={renderCard}
          renderCompact={renderCompact}
          controlsRight={(
            <ScheduleControlsBar
              calendarView={query.window.view}
              onCalendarViewChange={query.window.setView}
              showSaturday={showSaturday}
              onToggleSaturday={onToggleSaturday}
              onNewActivity={onNewActivity}
            />
          )}
        />
      </div>
      <DeleteConfirmDialog />
    </div>
  )
}
```

The week and today views keep today's plain activity card (the old calendar rendered the same placeholder). The permission filter matches `ScheduleCalendarDot`'s, which the meetings calendar still uses.

- [ ] **Step 7: The view**

Replace `schedule-view.tsx` with:

```tsx
'use client'

import { motion } from 'motion/react'
import { useQueryState } from 'nuqs'
import { useCallback, useState } from 'react'

import { scheduleShowParser } from '@/features/schedule-management/constants/query-parsers'
import { useScheduleHighlight } from '@/features/schedule-management/hooks/use-schedule-highlight'
import { ActivityForm } from '@/features/schedule-management/ui/components/activity-form'
import { ScheduleActivitiesCalendar } from '@/features/schedule-management/ui/components/schedule-activities-calendar'
import { ScheduleMeetingsCalendar } from '@/features/schedule-management/ui/components/schedule-meetings-calendar'
import { ScheduleShowToggle } from '@/features/schedule-management/ui/components/schedule-show-toggle'

export function ScheduleView() {
  const [show, setShow] = useQueryState('show', scheduleShowParser)
  const [showSaturday, setShowSaturday] = useState(false)
  const [activityFormOpen, setActivityFormOpen] = useState(false)
  const { isHighlighted, highlightRef } = useScheduleHighlight()

  const handleToggleSaturday = useCallback(() => setShowSaturday(prev => !prev), [])
  const handleNewActivity = useCallback(() => setActivityFormOpen(true), [])

  const showToggle = <ScheduleShowToggle value={show} onChange={next => void setShow(next)} />

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ delay: 0.25, duration: 0.25 }}
      className="w-full h-full flex flex-col overflow-hidden"
    >
      {show === 'activities'
        ? (
            <ScheduleActivitiesCalendar
              showToggle={showToggle}
              showSaturday={showSaturday}
              onToggleSaturday={handleToggleSaturday}
              onNewActivity={handleNewActivity}
            />
          )
        : (
            <ScheduleMeetingsCalendar
              showToggle={showToggle}
              showSaturday={showSaturday}
              onToggleSaturday={handleToggleSaturday}
              onNewActivity={handleNewActivity}
              isHighlighted={isHighlighted}
              highlightRef={highlightRef}
            />
          )}

      <ActivityForm open={activityFormOpen} onOpenChange={setActivityFormOpen} />
    </motion.div>
  )
}
```

Delete the old inputs: `git rm src/features/schedule-management/constants/schedule-query-inputs.ts`. First run `grep -rn "schedule-query-inputs" src`; it must be empty once the page (Task 14) and view (this task) are rewritten.

- [ ] **Step 8: Repo checks**

Run: `cd $REPO && pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 9: Commit (Tasks 14 + 15)**

```bash
P="src/features/schedule-management/constants/schedule-queries.ts src/features/schedule-management/lib/to-schedule-window-href.ts src/shared/config/roots.ts src/features/schedule-management/constants/query-parsers.ts src/features/schedule-management/hooks/use-schedule-highlight.ts src/app/(frontend)/dashboard/schedule/page.tsx src/features/schedule-management/ui/components/schedule-meetings-calendar.tsx src/features/schedule-management/ui/components/schedule-activities-calendar.tsx src/features/schedule-management/ui/components/schedule-show-toggle.tsx src/features/schedule-management/ui/components/schedule-calendar.tsx src/features/schedule-management/ui/views/schedule-view.tsx src/features/schedule-management/lib/to-calendar-event.ts src/features/meeting-flow/lib/to-calendar-event.ts src/shared/components/calendar/lib/calendar-helpers.ts src/features/schedule-management/constants/schedule-query-inputs.ts"
git diff -- $P | head -400
git add src/features/schedule-management/constants/schedule-queries.ts src/features/schedule-management/lib/to-schedule-window-href.ts src/features/schedule-management/ui/components/schedule-meetings-calendar.tsx src/features/schedule-management/ui/components/schedule-activities-calendar.tsx src/features/schedule-management/ui/components/schedule-show-toggle.tsx
git commit -m "feat(schedule): calendar on URL date windows with a Show toggle, filters and a row-cap notice; schedule links open the LA day, old links redirect" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- $P
git show --stat HEAD
```

---

### Task 16: Browser check — Flow 2

**Files:** none (verification only).

- [ ] **Step 1:** As a super-admin, open `/dashboard/schedule?show=meetings&s_v=week&s_d=2026-09-27&s_rep=<an internal user id>`.
  - Expected: the week of Sep 27 – Oct 3 is shown.
  - Expected: a "Rep: <name>" chip, with only that rep's meetings.
  - Expected: no `[prefetch drift]`.
- [ ] **Step 2:** Click Next.
  - Expected: the URL shows `s_d=2026-10-04`, `s_rep` stays, and the new week loads while the previous one stays on screen until it arrives.
  - Click Today. Expected: `s_d` leaves the URL.
- [ ] **Step 3:** Click "Activities" in the Show toggle.
  - Expected: the same week, the activities filters (Type, Related to, Owner), and `s_rep` still in the URL but ignored.
  - Open an activity's dot in month view. Expected: its menu offers the activity actions (View, Mark Complete, Delete) the viewer is allowed, never meeting actions.
  - Click "Meetings". Expected: the Rep chip is back.
- [ ] **Step 4:** Open `?show=meetings&s_v=month&s_d=<a busy month>`.
  - If more than 500 meetings match, expected: "Showing 500 of N".
  - Otherwise, check the notice is absent and note the month's total.
  - Expected: the greyed leading and trailing days (the previous and next months' days the grid draws) show their meetings too.
- [ ] **Step 5:** Open an old link: `/dashboard/schedule?highlightMeeting=<a meeting id>&highlightDate=<its scheduledFor ISO>`.
  - Expected: a redirect to `?highlightMeeting=…&show=meetings&s_d=<its LA day>`, and the meeting card highlighted and scrolled into view.
  - From a meeting's actions menu, choose "View in Schedule". Expected: the URL already has `show=meetings&s_d=…` (no redirect in the network log) and the card is highlighted.
- [ ] **Step 6:** Resize to 390 px wide and open Filters. Expected: the sheet lists the filters, with no Sort and no Rows-per-page section.

---

## Phase 4 — Customers

**Gate to Phase 5:**
- `/dashboard/customers`, the lead-sources "All customers" pane and "Customers from this source" pane all filter, sort and page as before.
- A stale `?pc_sort=leadSourceName` bookmark falls back cleanly.
- The Source column sorts in all three.

**Preflight:** run `git status --short src/shared/entities/customers src/trpc/routers/customers.router src/trpc/routers/lead-sources.router.ts src/features/lead-sources-admin "src/app/(frontend)/dashboard/(records)/customers"`. `src/shared/entities/customers/dal/server/get-customer-profile.ts` had another session's hunk on 2026-09-27. This phase doesn't edit it, but any other ` M` path this phase edits means STOP and ask.

### Task 17: `CUSTOMER_FIELDS`, its SQL, and one `listCustomers` behind both procedures

**Files:**
- Create: `src/shared/entities/customers/dal/customer-fields.ts`, `src/shared/entities/customers/dal/server/customer-field-sql.ts`
- Modify:
  - `src/shared/entities/customers/dal/server/queries.ts` (replaces today's unused `listCustomers(ctx)`)
  - `src/trpc/routers/customers.router/business.router.ts` (`list` only)
  - `src/trpc/routers/lead-sources.router.ts` (`getCustomers` only)
- Test (scratch): `$SCRATCH/tests/customer-field-sql.test.ts`

**Interfaces:**
- Produces:
  - `CUSTOMER_FIELDS`: ids `pipeline createdAt rep leadSource name email sourceId segment`.
    - Toolbar filters: `pipeline createdAt rep leadSource`.
    - Sort ids: `createdAt leadSource name email`.
    - Fixed filters: `sourceId segment`.
  - `CUSTOMER_FIELD_SQL` (from `defineFieldSql`): default order `created_at DESC`, tie-breaker `customers.id`. Rep reads option source `reps`, Lead source `leadSources`.
  - `listCustomers(ctx, input: CustomerListInput): Promise<DalReturn<PaginatedResult<CustomerListRow>>>`, plus `customerListInputSchema` and `CustomerListRow`.
- The sort key `leadSourceName` becomes `leadSource`.
- `leadSourcesRouter.getCustomers` keeps `superAdminProcedure`, its not-found check and its `id` / `segment` inputs, and sets `filters.sourceId` and `filters.segment` itself.

- [ ] **Step 1: Write the failing test**

`$SCRATCH/tests/customer-field-sql.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PgDialect } from 'drizzle-orm/pg-core'

import { CUSTOMER_FIELD_SQL } from '@/shared/entities/customers/dal/server/customer-field-sql'

const dialect = new PgDialect()

test('rep: the customer has a meeting the rep takes part in', () => {
  const { sql, params } = dialect.sqlToQuery(CUSTOMER_FIELD_SQL.filter.rep(['u1'])!)
  assert.match(sql, /EXISTS \(SELECT 1 FROM "meetings" INNER JOIN "meeting_participants" ON "meeting_participants"\."meeting_id" = "meetings"\."id" WHERE "meetings"\."customer_id" = "customers"\."id" AND "meeting_participants"\."user_id" in \(\$1\)\)/)
  assert.deepEqual(params, ['u1'])
})

test('source is a fixed filter on the customer row', () => {
  const { sql } = dialect.sqlToQuery(CUSTOMER_FIELD_SQL.filter.sourceId('00000000-0000-4000-8000-000000000001')!)
  assert.match(sql, /"customers"\."lead_source_id" = \$1/)
})
```

Run: `cd $REPO && pnpm exec tsx --tsconfig "$SCRATCH/tsconfig.json" --conditions=react-server --test "$SCRATCH/tests/customer-field-sql.test.ts"`
Expected: FAIL, the module can't be found.

- [ ] **Step 2: Field list and SQL**

`src/shared/entities/customers/dal/customer-fields.ts`:

```ts
import z from 'zod'

import { pipelines } from '@/shared/constants/enums/pipelines'
import { dateRange, defineFieldList, fixedOnly, multiSelect } from '@/shared/dal/lib/query/field-list'
import { PIPELINE_LABELS } from '@/shared/domains/pipelines/constants/pipeline-registry'
import { customerSegments } from '@/shared/entities/lead-sources/constants/customer-segments'

/** Every filterable and sortable customers field; each id is both the URL key suffix and the read's filter/sort key. */
export const CUSTOMER_FIELDS = defineFieldList({
  pipeline: { label: 'Pipeline', filter: multiSelect({ values: pipelines, optionLabel: pipeline => PIPELINE_LABELS[pipeline] }) },
  createdAt: { label: 'Created', filter: dateRange(), sort: true },
  // User ids are free text, not uuids.
  rep: { label: 'Rep', filter: multiSelect({ schema: z.string().min(1), source: 'reps' }) },
  leadSource: { label: 'Lead source', filter: multiSelect({ schema: z.string().uuid(), source: 'leadSources' }), sort: true },
  name: { label: 'Name', sort: true },
  email: { label: 'Email', sort: true },
  sourceId: { filter: fixedOnly(z.string().uuid()) },
  segment: { filter: fixedOnly(z.enum(customerSegments)) },
})
```

`src/shared/entities/customers/dal/server/customer-field-sql.ts`:

```ts
import { desc, eq, inArray, sql } from 'drizzle-orm'

import { dateRangeCondition, defineFieldSql } from '@/shared/dal/server/lib/query/field-sql'
import { customers } from '@/shared/db/schema/customers'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { meetingParticipants } from '@/shared/db/schema/meeting-participants'
import { meetings } from '@/shared/db/schema/meetings'
import { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'
import { derivedPipelineWhere } from '@/shared/entities/customers/lib/derived-pipeline-sql'
import { buildSegmentWhere } from '@/shared/entities/lead-sources/lib/segment-sql'
import 'server-only'

export const CUSTOMER_FIELD_SQL = defineFieldSql(CUSTOMER_FIELDS, {
  filter: {
    pipeline: v => derivedPipelineWhere(v),
    createdAt: v => dateRangeCondition(customers.createdAt, v),
    // The subquery's own `meetings` shadows any outer one (the fresh kanban joins meetings), so it always correlates on the customer.
    rep: v => sql`EXISTS (SELECT 1 FROM ${meetings} INNER JOIN ${meetingParticipants} ON ${meetingParticipants.meetingId} = ${meetings.id} WHERE ${meetings.customerId} = ${customers.id} AND ${inArray(meetingParticipants.userId, v)})`,
    leadSource: v => inArray(customers.leadSourceId, v),
    sourceId: v => eq(customers.leadSourceId, v),
    segment: v => buildSegmentWhere(v),
  },
  sort: {
    createdAt: customers.createdAt,
    leadSource: leadSourcesTable.name,
    name: customers.name,
    email: customers.email,
  },
}, { defaultOrder: [desc(customers.createdAt)], tieBreaker: customers.id })
```

- [ ] **Step 3: `listCustomers` replaces the unused one**

Run: `cd $REPO && grep -rn "listCustomers" src --include=*.ts --include=*.tsx | grep -v "entities/customers/dal/server/queries.ts"`
Expected: no output. Today's `listCustomers(ctx)` has no callers. If it does, STOP and report.

In `src/shared/entities/customers/dal/server/queries.ts`, replace the existing `export async function listCustomers(ctx: ScopedContext) { … }` with the code below. Merge its imports into the file's import block without duplicating the ones it already has (`DalReturn`, `ScopedContext`, `and`, `eq`, `dalDbOperation`, `db`, `customers`).

```ts
export const customerListInputSchema = fieldListInput(CUSTOMER_FIELDS, { pagination: true })
export type CustomerListInput = z.infer<typeof customerListInputSchema>

export interface CustomerListRow {
  id: string
  name: string
  email: string | null
  createdAt: string
  /** The derived five-bucket pipeline, not the stored three-bucket column. */
  pipeline: Pipeline
  leadSourceId: string | null
  leadSourceName: string | null
  leadSourceSlug: string | null
}

/** One customers list for every table: callers scope through `ctx.scope` and pin a source or segment through fixed filters. */
export async function listCustomers(ctx: ScopedContext, input: CustomerListInput): Promise<DalReturn<PaginatedResult<CustomerListRow>>> {
  return dalDbOperation(async () => {
    const where = and(
      ctx.scope ?? undefined,
      buildSearchWhere(input.search, [customers.name, customers.email]),
      CUSTOMER_FIELD_SQL.where(input.filters),
    )

    return paginate({
      query: () => db
        .select({
          id: customers.id,
          name: customers.name,
          email: customers.email,
          createdAt: customers.createdAt,
          pipeline: derivedPipelineSql(),
          leadSourceId: customers.leadSourceId,
          leadSourceName: leadSourcesTable.name,
          leadSourceSlug: leadSourcesTable.slug,
        })
        .from(customers)
        .leftJoin(leadSourcesTable, eq(leadSourcesTable.id, customers.leadSourceId))
        .where(where)
        .orderBy(...CUSTOMER_FIELD_SQL.orderBy(input.sort))
        .limit(input.pagination.limit)
        .offset(input.pagination.offset),
      count: () => db.$count(customers, where),
    })
  })
}
```

Imports it adds:

```ts
import type z from 'zod'
import type { Pipeline } from '@/shared/constants/enums/pipelines'
import type { PaginatedResult } from '@/shared/dal/lib/query/contracts'
import { fieldListInput } from '@/shared/dal/server/lib/query/field-list-input'
import { paginate } from '@/shared/dal/server/lib/query/output'
import { buildSearchWhere } from '@/shared/dal/server/lib/query/search'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'
import { CUSTOMER_FIELD_SQL } from '@/shared/entities/customers/dal/server/customer-field-sql'
import { derivedPipelineSql } from '@/shared/entities/customers/lib/derived-pipeline-sql'
```

- [ ] **Step 4: Both procedures call it**

In `business.router.ts`, replace the `list: customerProcedure … }),` block and its comment with the code below. Add `import { customerListInputSchema, listCustomers } from '@/shared/entities/customers/dal/server/queries'` and `import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'`, then drop the imports lint reports unused.

```ts
  // Drives /dashboard/customers and the lead-sources "All customers" pane; `ctx.scope` is customer visibility.
  list: customerProcedure
    .input(customerListInputSchema)
    .query(async ({ ctx, input }) => dalToTrpc(await listCustomers(ctx, input))),
```

In `lead-sources.router.ts`, replace the `getCustomers` block and its comment with the code below, add the same two imports, and drop what lint reports unused:

```ts
  // `segment` stays a top-level input and becomes a fixed filter here, so no toolbar ever shows it.
  getCustomers: superAdminProcedure
    .input(customerListInputSchema.extend({
      id: z.string().uuid(),
      segment: z.enum(customerSegments).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const [src] = await db
        .select({ id: leadSourcesTable.id })
        .from(leadSourcesTable)
        .where(eq(leadSourcesTable.id, input.id))
        .limit(1)
      if (!src) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead source not found.' })
      }
      const { id: _id, segment, ...query } = input
      return dalToTrpc(await listCustomers(
        { ...ctx, scope: null },
        { ...query, filters: { ...query.filters, sourceId: src.id, segment } },
      ))
    }),
```

The not-found read still queries `db` inline, as it does today. The router's other inline queries are out of scope (spec §14).

- [ ] **Step 5: Tests and repo checks**

Run: `cd $REPO && pnpm exec tsx --tsconfig "$SCRATCH/tsconfig.json" --conditions=react-server --test "$SCRATCH/tests/customer-field-sql.test.ts" | grep -E '^ℹ (pass|fail)' && pnpm tsc && pnpm lint`
Expected: `ℹ pass 2`, `ℹ fail 0`.
- `pnpm tsc` flags `dashboard/(records)/customers/page.tsx`, because its legacy input no longer fits the new schema. Task 18 fixes that. Keep this task uncommitted and commit Tasks 17 and 18 together at the end of Task 18, so every commit on `main` compiles.

---

### Task 18: The three customers tables on `useDataViewQuery`

**Files:**
- Modify:
  - `src/shared/entities/customers/constants/customers-table-query-config.ts`
  - `src/features/lead-sources-admin/constants/lead-sources-table-query-configs.ts`
  - `src/shared/entities/customers/components/customers-table.tsx`
  - `src/features/lead-sources-admin/ui/components/all-customers-section.tsx`
  - `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx`
  - `src/shared/entities/customers/lib/columns-registry.tsx`
  - `src/app/(frontend)/dashboard/(records)/customers/page.tsx`
- Delete: `src/shared/entities/customers/constants/customer-filter-config.ts`

**Interfaces:**
- Consumes: Tasks 5, 7, 8, 17.
- The toolbar stays Pipeline + Created (spec §8.3: config change only, no UI change). Rep and Lead source are in the field list for the kanban now and R2 later.

- [ ] **Step 1: Configs**

Replace `customers-table-query-config.ts` with:

```ts
import type { DataViewQueryConfig } from '@/shared/dal/lib/query/data-view-query-config'

import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'

/**
 * Shared by `customers-table.tsx` (client) and `dashboard/customers/page.tsx` (server prefetch):
 * one object, one query key. Do not inline these values at either call site.
 */
export const CUSTOMERS_TABLE_QUERY_CONFIG = {
  fields: CUSTOMER_FIELDS,
  paramPrefix: 'pc',
  toolbar: ['pipeline', 'createdAt'],
  defaultSort: { sortBy: 'createdAt', sortDir: 'desc' },
  window: { kind: 'page', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS },
} as const satisfies DataViewQueryConfig<typeof CUSTOMER_FIELDS>

/** Columns shown by default on the customers records table. */
export const CUSTOMERS_TABLE_SHOW_COLUMNS = ['name', 'leadSourceName', 'pipeline', 'createdAt'] as const
```

Replace `lead-sources-table-query-configs.ts` with:

```ts
import type { DataViewQueryConfig } from '@/shared/dal/lib/query/data-view-query-config'

import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'

/** "Customers from this source" pane; `leadSourcesRouter.getCustomers` pins the source itself. */
export const LEAD_SOURCE_CUSTOMERS_TABLE_QUERY_CONFIG = {
  fields: CUSTOMER_FIELDS,
  paramPrefix: 'src',
  toolbar: ['pipeline', 'createdAt'],
  defaultSort: { sortBy: 'createdAt', sortDir: 'desc' },
  window: { kind: 'page', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS },
} as const satisfies DataViewQueryConfig<typeof CUSTOMER_FIELDS>

/** "All customers" pane. */
export const ALL_CUSTOMERS_TABLE_QUERY_CONFIG = {
  fields: CUSTOMER_FIELDS,
  paramPrefix: 'all',
  toolbar: ['pipeline', 'createdAt'],
  defaultSort: { sortBy: 'createdAt', sortDir: 'desc' },
  window: { kind: 'page', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS },
} as const satisfies DataViewQueryConfig<typeof CUSTOMER_FIELDS>
```

Run: `grep -rn "customer-filter-config\|CUSTOMER_FILTER_CONFIG" src`
Expected: no output. Then `git rm src/shared/entities/customers/constants/customer-filter-config.ts`.

- [ ] **Step 2: Registry**

In `src/shared/entities/customers/lib/columns-registry.tsx`:
- `leadSourceName`: `sort: 'leadSourceName'` → `sort: 'leadSource'`.
- Change the closing `satisfies ColumnRegistry<CustomerTableRow>` to `satisfies ColumnRegistry<CustomerTableRow, SortId<typeof CUSTOMER_FIELDS>>`, with `import type { SortId } …` and `import type { CUSTOMER_FIELDS } …`.

- [ ] **Step 3: The three tables**

In each table:
- remove the `usePaginatedQuery` call, its import and the `fromPaginatedQuery` line;
- add `import { useDataViewQuery } from '@/shared/dal/client/hooks/use-data-view-query'`;
- use the `query` below.

1. **`customers-table.tsx`**

   ```tsx
     const query = useDataViewQuery(trpc.customersRouter.business.list, {}, CUSTOMERS_TABLE_QUERY_CONFIG)
   ```

   and `data={query.rows}`.
2. **`all-customers-section.tsx`**

   ```tsx
     const query = useDataViewQuery(trpc.customersRouter.business.list, {}, ALL_CUSTOMERS_TABLE_QUERY_CONFIG)
   ```

   - `pagination.isLoading` / `pagination.total` → `query.isLoading` / `query.total`;
   - `data={query.rows}`.
3. **`lead-source-customers-section.tsx`**

   ```tsx
     const query = useDataViewQuery(trpc.leadSourcesRouter.getCustomers, { id: leadSourceId }, LEAD_SOURCE_CUSTOMERS_TABLE_QUERY_CONFIG)
   ```

   - `pagination.*` → `query.*`;
   - `data={query.rows}`.

The toolbar `<QueryToolbar query={query} …>` and the `toDataTable*` calls from Tasks 7–8 need no change. These toolbars show no runtime-option filter, so `useDataViewQuery` sends no option read.

- [ ] **Step 4: The page**

In `src/app/(frontend)/dashboard/(records)/customers/page.tsx`, replace `loadPaginatedQueryInput` (import and call) with `loadDataViewQueryInput`.

- [ ] **Step 5: Repo checks**

Run: `cd $REPO && pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 6: Browser check**

1. `/dashboard/customers?pc_pipeline=fresh&pc_sort=leadSource&pc_dir=asc`
   - Expected: a "Pipeline: Fresh" chip, sorted by Source A→Z, and no drift warning.
2. `/dashboard/customers?pc_sort=leadSourceName` → newest first, no error.
3. `/dashboard/lead-sources`, select a source.
   - Expected: "Customers from this source" lists only that source.
   - Expected: clicking the Source header sorts without an error.
   - Expected: "All customers" filters and pages independently (`src_*` and `all_*` keys).

- [ ] **Step 7: Commit (Tasks 17 + 18)**

```bash
P="src/shared/entities/customers/dal/customer-fields.ts src/shared/entities/customers/dal/server/customer-field-sql.ts src/shared/entities/customers/dal/server/queries.ts src/trpc/routers/customers.router/business.router.ts src/trpc/routers/lead-sources.router.ts src/shared/entities/customers/constants/customers-table-query-config.ts src/features/lead-sources-admin/constants/lead-sources-table-query-configs.ts src/shared/entities/customers/components/customers-table.tsx src/features/lead-sources-admin/ui/components/all-customers-section.tsx src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx src/shared/entities/customers/lib/columns-registry.tsx src/app/(frontend)/dashboard/(records)/customers/page.tsx src/shared/entities/customers/constants/customer-filter-config.ts"
git diff -- $P | head -300
git add src/shared/entities/customers/dal/customer-fields.ts src/shared/entities/customers/dal/server/customer-field-sql.ts
git commit -m "feat(customers): field list and one listCustomers read; the three customers tables run on it" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- $P
git show --stat HEAD
```

---

## Phase 5 — Pipelines kanban

**Gate:** Flow 3 (spec §1) behaves as written, with no `[prefetch drift]`.

**Preflight:** run `git status --short src/features/customer-pipelines src/shared/domains/pipelines src/trpc/routers/customer-pipelines.router.ts "src/app/(frontend)/dashboard/pipeline"`. On 2026-09-27 another session had uncommitted meeting-confirmation work in:
- `get-customer-pipeline-items.ts`
- `move-customer-pipeline-item.ts`
- `types/index.ts`
- `customer-kanban-card.tsx`
- `customer-pipeline-view.tsx`
- the `pipeline-stat-config.ts` and `fresh-pipeline` constants
- `compute-fresh-stage.ts`
- the `kanban-column-filter` → `kanban-stage-filter` rename

This phase moves and edits several of those files. **Do not start until the owner confirms that work is committed.** Then re-read the files, because the edits below reference their shape as of 2026-09-27. (A re-check late on 2026-09-27 found these paths clean, and the branch edits below were applied and type-checked against that version.)

### Task 19: The pipeline read moves into the customers DAL, with filters, sort and search

**Files:**
- Move: `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` → `src/shared/entities/customers/dal/server/pipeline-items.ts` (`git mv`)
- Create: `src/shared/entities/customers/types/pipeline-item.ts`
- Modify:
  - `src/features/customer-pipelines/types/index.ts`
  - `src/trpc/routers/customer-pipelines.router.ts` (`getCustomerPipelineItems` only)
  - `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx` (a compile fix only; rewritten in Task 20)
  - every importer of the moved types
- Delete:
  - `src/features/customer-pipelines/constants/active-pipeline-stages.ts`
  - `src/features/customer-pipelines/constants/dead-pipeline-stages.ts`
  - `src/features/customer-pipelines/constants/rehash-pipeline-stages.ts`

  They only re-export `shared/domains/pipelines` stage types, for `types/index.ts`.

**Interfaces:**
- Produces:
  - `customerPipelineItemsInputSchema = fieldListInput(CUSTOMER_FIELDS, { pagination: false }).extend({ pipeline: z.enum(pipelines) })` and `CustomerPipelineItemsInput`.
  - `getCustomerPipelineItems(ctx: ScopedContext, input): Promise<DalReturn<PaginatedResult<CustomerPipelineItem>>>`: `{ rows, total }`, like every data-view read.
  - `CustomerPipelineItem` and friends are now imported from `@/shared/entities/customers/types/pipeline-item`.
- Scoping moves unchanged: the leads branch is still unscoped (spec §14, needs its own fix), and the others use participant / project-owner rules.
- A chosen sort ends with `customers.id` (the field SQL's tie-breaker), so cards that share a sort value keep their order across refetches.

- [ ] **Step 1: Move the types**

Create `src/shared/entities/customers/types/pipeline-item.ts` and move these declarations into it verbatim from `src/features/customer-pipelines/types/index.ts`:
- `PipelineItemRep`
- `PipelineItemProposal`
- `PipelineItemProjectMeeting`
- `PipelineItemProject`
- `CustomerPipelineItem`
- `CustomerPipelineRawData`

Use this import block:

```ts
import type { ProjectStatusBucket } from '@/shared/constants/enums/pipelines'
import type { DeadPipelineStage } from '@/shared/domains/pipelines/constants/dead-pipeline'
import type { FreshPipelineStage } from '@/shared/domains/pipelines/constants/fresh-pipeline'
import type { LeadsPipelineStage } from '@/shared/domains/pipelines/constants/leads-pipeline'
import type { ProjectsPipelineStage } from '@/shared/domains/pipelines/constants/projects-pipeline'
import type { RehashPipelineStage } from '@/shared/domains/pipelines/constants/rehash-pipeline'
```

- In `CustomerPipelineItem.stage`, `CustomerPipelineStage` becomes `FreshPipelineStage`. The feature file aliased the same type.
- Delete the moved declarations and their three stage imports from the feature's `types/index.ts`. Keep its remaining re-exports untouched.

Run: `cd $REPO && grep -rln "CustomerPipelineItem\|CustomerPipelineRawData\|PipelineItemRep\|PipelineItemProposal\|PipelineItemProject" src --include=*.ts --include=*.tsx`

In each file listed, import those names from `@/shared/entities/customers/types/pipeline-item` instead. This covers `from '@/features/customer-pipelines/types'` and relative `'../types'` imports. Then `git rm` the three `*-pipeline-stages.ts` files, after `grep -rn "pipeline-stages'" src` shows no importer.

- [ ] **Step 2: Move the read**

```bash
git mv src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts src/shared/entities/customers/dal/server/pipeline-items.ts
```

In the moved file:

1. First line: `// LAZY: customers is still a plain entity; this read moves to modules/customers/core/dal/server when customers is promoted to a module.` (the same wording as `get-customer-profile.ts`).
2. Change the types import to `@/shared/entities/customers/types/pipeline-item`.
3. Replace `export async function getCustomerPipelineItems(userId: string, pipeline: Pipeline = 'fresh', isOmni = false, canSeeUngated = false) { … }` with:

```ts
export const customerPipelineItemsInputSchema = fieldListInput(CUSTOMER_FIELDS, { pagination: false }).extend({
  pipeline: z.enum(pipelines),
})
export type CustomerPipelineItemsInput = z.infer<typeof customerPipelineItemsInputSchema>

/** Everything a branch needs: who is asking, and the customer filter, search and order the kanban toolbar chose. */
interface PipelineBranchArgs {
  userId: string
  isOmni: boolean
  canSeeUngated: boolean
  customerWhere: SQL | undefined
  /** Undefined keeps the branch's own natural order. */
  customerOrder: SQL[] | undefined
}

export async function getCustomerPipelineItems(ctx: ScopedContext, input: CustomerPipelineItemsInput): Promise<DalReturn<PaginatedResult<CustomerPipelineItem>>> {
  return dalDbOperation(async () => {
    const args: PipelineBranchArgs = {
      // Each pipeline reaches customers through a different table, so scoping stays per branch; a scoped caller without a session matches nothing.
      userId: ctx.session?.user.id ?? '',
      isOmni: !ctx.ability || ctx.ability.can('manage', 'all'),
      canSeeUngated: canSeeUngatedPhone(ctx.ability),
      customerWhere: and(
        buildSearchWhere(input.search, [customers.name, customers.email]),
        CUSTOMER_FIELD_SQL.where(input.filters),
      ),
      customerOrder: input.sort ? CUSTOMER_FIELD_SQL.orderBy(input.sort) : undefined,
    }
    const rows = await pipelineItemsFor(input.pipeline, args)
    return { rows, total: rows.length }
  })
}

function pipelineItemsFor(pipeline: Pipeline, args: PipelineBranchArgs): Promise<CustomerPipelineItem[]> {
  if (pipeline === 'leads') {
    return getLeadsPipelineItems(args)
  }
  if (pipeline === 'projects') {
    return getProjectsPipelineItems(args)
  }
  if (pipeline !== 'fresh') {
    return getRehashOrDeadPipelineItems(pipeline, args)
  }
  return getFreshPipelineItems(args)
}
```

4. Branch edits. In every branch, replace the `userId` / `isOmni` / `canSeeUngated` parameters with `args: PipelineBranchArgs` and read `args.userId`, `args.isOmni` and `args.canSeeUngated`.

   Each branch also joins lead sources, because the Lead source sort orders by `lead_sources.name`:
   - **Leads**
     - Add `.leftJoin(leadSourcesTable, eq(leadSourcesTable.id, customers.leadSourceId))` after `.from(customers)`.
     - Wrap the `NOT EXISTS` condition: `.where(and(sql\`NOT EXISTS (…)\`, args.customerWhere))`.
     - `.orderBy(desc(customers.createdAt))` → `.orderBy(...(args.customerOrder ?? [desc(customers.createdAt)]))`.
   - **Rehash / dead**
     - The signature becomes `(pipeline: Pipeline, args: PipelineBranchArgs)`.
     - Change `.selectDistinctOn([customers.id], {` to `.select({`.
     - Replace the `.innerJoin(meetings, and(…))` and `.orderBy(customers.id, desc(customers.updatedAt))` lines with:

     ```ts
         .leftJoin(leadSourcesTable, eq(leadSourcesTable.id, customers.leadSourceId))
         // EXISTS rather than join + DISTINCT ON: DISTINCT ON pinned the order to customer id, so no sort could apply.
         .where(and(
           exists(db.select({ id: meetings.id }).from(meetings).where(and(
             eq(meetings.customerId, customers.id),
             eq(meetings.pipeline, pipeline as 'fresh' | 'rehash' | 'dead'),
             isNull(meetings.projectId),
             args.isOmni ? undefined : userParticipatesInMeeting(args.userId, meetings.id),
           ))),
           args.customerWhere,
         ))
         .orderBy(...(args.customerOrder ?? [desc(customers.updatedAt)]))
     ```

   - **Fresh**
     - After the `.innerJoin(meetings, and(…))`, add `.leftJoin(leadSourcesTable, eq(leadSourcesTable.id, customers.leadSourceId))` and `.where(args.customerWhere)`.
     - `.groupBy(customers.id)` → `.groupBy(customers.id, leadSourcesTable.id)`.
     - `.orderBy(desc(customers.updatedAt))` → `.orderBy(...(args.customerOrder ?? [desc(customers.updatedAt)]))`.
   - **Projects**
     - After `.innerJoin(customers, …)`, add `.leftJoin(leadSourcesTable, eq(leadSourcesTable.id, customers.leadSourceId))`.
     - Add `args.customerWhere` as a third argument of the existing `and(…)`.
     - `.orderBy(desc(projects.createdAt))` → `.orderBy(...(args.customerOrder ?? []), desc(projects.createdAt))`, with the comment `// Customers take their first row's position below, so the chosen customer order leads and each customer's newest project still wins.`
5. Imports to add:
   - `import type { SQL } from 'drizzle-orm'`, `z`, `ScopedContext`, `DalReturn`, `PaginatedResult` (from `@/shared/dal/lib/query/contracts`);
   - `pipelines` (from `@/shared/constants/enums/pipelines`), `dalDbOperation`, `fieldListInput`;
   - `buildSearchWhere`, `leadSourcesTable`;
   - `CUSTOMER_FIELDS`, `CUSTOMER_FIELD_SQL`, `canSeeUngatedPhone`;
   - `exists` (from `drizzle-orm`).

   Drop what lint reports unused.

- [ ] **Step 3: Router**

In `customer-pipelines.router.ts`:
- replace the import of the old read with `import { customerPipelineItemsInputSchema, getCustomerPipelineItems } from '@/shared/entities/customers/dal/server/pipeline-items'`;
- replace the procedure with:

```ts
  getCustomerPipelineItems: agentProcedure
    .input(customerPipelineItemsInputSchema)
    .query(async ({ ctx, input }) => dalToTrpc(await getCustomerPipelineItems({ ...ctx, scope: null }, input))),
```

Drop `canSeeUngatedPhone` from the imports if nothing else uses it.

- [ ] **Step 4: Keep the view compiling until Task 20**

In `customer-pipeline-view.tsx`, add `const items = pipelineQuery.data?.rows` after the `useQuery` call. Then:
- replace each `pipelineQuery.data` with `items`;
- replace `pipelineQuery.data.length` with `items.length`;
- replace `pipelineQuery.data?.find(` with `items?.find(`.

- [ ] **Step 5: Repo checks**

Run: `cd $REPO && pnpm tsc && pnpm lint && grep -rn "features/customer-pipelines/dal/server/get-customer-pipeline-items" src`
Expected: clean, and the grep prints nothing.

- [ ] **Step 6: Browser check (unchanged board)**

Open `/dashboard/pipeline/fresh`, `/rehash`, `/dead`, `/projects` and `/leads` as a super-admin.
- Expected: the same cards and stages as before, with rehash/dead ordered newest-updated first. The one visible change is Decision 3.
- Drag one card between two stages you're allowed to move between; it saves as before.

- [ ] **Step 7: Commit**

```bash
git status --short src/features/customer-pipelines src/shared/entities/customers
P="src/shared/entities/customers/dal/server/pipeline-items.ts src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts src/shared/entities/customers/types/pipeline-item.ts src/features/customer-pipelines/types/index.ts src/trpc/routers/customer-pipelines.router.ts src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx src/features/customer-pipelines/constants/active-pipeline-stages.ts src/features/customer-pipelines/constants/dead-pipeline-stages.ts src/features/customer-pipelines/constants/rehash-pipeline-stages.ts <each importer you changed in Step 1>"
git diff -- $P | head -400
git add src/shared/entities/customers/types/pipeline-item.ts
git commit -m "refactor(customers): the pipeline read moves into the customers DAL and takes filters, sort and search" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- $P
git show --stat HEAD
```

Replace `<each importer you changed in Step 1>` with the actual paths printed by Step 1's grep before running the command.

---

### Task 20: The kanban on `useDataViewQuery`, with a toolbar and a server prefetch

**Files:**
- Create:
  - `src/features/customer-pipelines/constants/customer-pipeline-query.ts`
  - `src/shared/domains/pipelines/lib/resolve-pipeline-param.ts`
- Modify:
  - `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx`
  - `src/shared/domains/pipelines/hooks/pipeline-context.tsx`
  - `src/app/(frontend)/dashboard/pipeline/[pipeline]/page.tsx`

**Interfaces:**
- `CUSTOMER_PIPELINE_QUERY`: prefix `cp`, toolbar Rep / Lead source / Created, whole-list window, no default sort. Each branch keeps its natural order until `cp_sort` is set.
- Rep and Lead source options load through `useDataViewQuery` (option sources `reps`, `leadSources`), only for viewers allowed to read them.
- `resolvePipelineParam(value: unknown): Pipeline`, used by the page and the provider, so both prefetch and render the same pipeline.

- [ ] **Step 1: Config and param helper**

`src/features/customer-pipelines/constants/customer-pipeline-query.ts`:

```ts
import type { DataViewQueryConfig } from '@/shared/dal/lib/query/data-view-query-config'

import { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'

/** No default sort: without `cp_sort` each pipeline keeps its own natural order. `pipeline` itself comes from the route. */
export const CUSTOMER_PIPELINE_QUERY = {
  fields: CUSTOMER_FIELDS,
  paramPrefix: 'cp',
  toolbar: ['rep', 'leadSource', 'createdAt'],
  window: { kind: 'whole-list' },
} as const satisfies DataViewQueryConfig<typeof CUSTOMER_FIELDS>
```

`src/shared/domains/pipelines/lib/resolve-pipeline-param.ts`:

```ts
import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { pipelines } from '@/shared/constants/enums/pipelines'

/** The pipeline a route param names, or the fresh pipeline for anything unknown. */
export function resolvePipelineParam(value: unknown): Pipeline {
  return pipelines.find(pipeline => pipeline === value) ?? 'fresh'
}
```

In `pipeline-context.tsx`, replace `const pipeline: Pipeline = isValidPipeline(raw) ? raw : 'fresh'` with `const pipeline = resolvePipelineParam(raw)`. Keep `isValidPipeline`, because `getStoredPipeline` still uses it.

- [ ] **Step 2: The view**

In `customer-pipeline-view.tsx`:

1. Imports:
   - Remove `keepPreviousData` and `useQuery` (keep `useMutation`).
   - Add `useDataViewQuery`, `CUSTOMER_PIPELINE_QUERY` and `QueryToolbar`.
2. Replace the `useQuery` block and Task 19's `items` line with:

```tsx
  const query = useDataViewQuery(trpc.customerPipelinesRouter.getCustomerPipelineItems, { pipeline }, CUSTOMER_PIPELINE_QUERY)
  const items = query.rows
```

3. Replace every `pipelineQuery.refetch()` with `void query.refresh()`. The occurrences are in the move mutation's `onError` and `onSettled`, the `CreateMeetingModal` `onSuccess`, and the `ManageParticipantsModal` `onSuccess`.
4. `items?.find(` → `items.find(`, and every `[items]`-style dependency stays `items`.
5. Loading, error, empty:

```tsx
  const isInitialLoad = query.isLoading
  const isSwitching = query.isFetching && !query.isLoading
```

   - `if (!items)` (from Task 19) becomes `if (query.isError)`.
   - The empty state's description becomes `query.filterSort.activeFilterCount > 0 || query.filterSort.searchInput ? 'No customers match these filters' : 'Start by scheduling meetings with customers'`.
6. Add the toolbar directly after the header row `div` (the one holding the metrics bar, `PipelineSelect` and `KanbanStageFilter`):

```tsx
      <QueryToolbar query={query} entityName="customers" className="shrink-0">
        <QueryToolbar.Standard searchPlaceholder="Search by name or email…" sort />
      </QueryToolbar>
```

The stage filter popover (`KanbanStageFilter`) is unchanged. It hides columns and doesn't filter customers.

- [ ] **Step 3: The page prefetch**

Replace `src/app/(frontend)/dashboard/pipeline/[pipeline]/page.tsx` with:

```tsx
import type { SearchParams } from 'nuqs/server'

import { CUSTOMER_PIPELINE_QUERY } from '@/features/customer-pipelines/constants/customer-pipeline-query'
import { CustomerPipelineView } from '@/features/customer-pipelines/ui/views'
import { loadDataViewQueryInput } from '@/shared/dal/server/lib/query/load-data-view-query-input'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { resolvePipelineParam } from '@/shared/domains/pipelines/lib/resolve-pipeline-param'
import { HydrateClient } from '@/trpc/components/hydrate-client'
import { prefetch } from '@/trpc/lib/prefetch'
import { trpc } from '@/trpc/server'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ pipeline: string }>
  searchParams: Promise<SearchParams>
}

export default async function PipelinePage({ params, searchParams }: Props) {
  const authState = await protectDashboardPage()

  // Unauthenticated visitors get the layout's sign-in screen; skip the prefetch work.
  if (authState.status === 'authenticated') {
    // The same resolution PipelineProvider uses, so the prefetched `pipeline` matches the client's.
    const pipeline = resolvePipelineParam((await params).pipeline)
    const input = await loadDataViewQueryInput(searchParams, CUSTOMER_PIPELINE_QUERY, { pipeline })
    prefetch(trpc.customerPipelinesRouter.getCustomerPipelineItems.queryOptions(input))
  }

  return (
    <HydrateClient>
      <CustomerPipelineView />
    </HydrateClient>
  )
}
```

- [ ] **Step 4: Repo checks**

Run: `cd $REPO && pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 5: Browser check — Flow 3**

1. As a super-admin, open `/dashboard/pipeline/fresh?cp_leadSource=<a lead source id>&cp_sort=createdAt&cp_dir=desc`.
   - Expected: a "Lead source: <name>" chip.
   - Expected: only that source's customers.
   - Expected: cards in each stage newest-created first.
   - Expected: the metrics bar counts only them, with no drift warning.
2. Clear the sort through the Sort select ("Default order"). Expected: the order returns to recently-updated first.
3. Search a customer name. Expected: the board narrows and the stage counts follow.
4. As an agent (`&role=agent`), open `/dashboard/pipeline/fresh`.
   - Expected: no Rep or Lead source filter, no request to `getInternalUsers` or `leadSourcesRouter.list`, and Created and Search still work.
5. Resize to 390 px wide and open Filters. Expected: Created, plus a Sort section.

- [ ] **Step 6: Commit**

```bash
P="src/features/customer-pipelines/constants/customer-pipeline-query.ts src/shared/domains/pipelines/lib/resolve-pipeline-param.ts src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx src/shared/domains/pipelines/hooks/pipeline-context.tsx src/app/(frontend)/dashboard/pipeline/[pipeline]/page.tsx"
git diff -- $P | head -300
git add src/features/customer-pipelines/constants/customer-pipeline-query.ts src/shared/domains/pipelines/lib/resolve-pipeline-param.ts
git commit -m "feat(pipelines): kanban search, filters and sort through the data-view toolbar, with a server prefetch" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- $P
git show --stat HEAD
```

---

## Wrap-up

### Task 21: Whole-branch verification

**Files:** none committed.

- [ ] **Step 1: The spec's compile-time failures**

Write `$SCRATCH/types/success-criteria.ts`:

```ts
import type { ColumnRegistry } from '@/shared/components/data-table/lib/use-entity-columns'
import type { DataViewQueryConfig } from '@/shared/dal/lib/query/data-view-query-config'
import type { SortId } from '@/shared/dal/lib/query/field-list'
import type { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'
import type { MEETING_FIELDS } from '@/shared/entities/meetings/dal/meeting-fields'

import { useDataViewQuery } from '@/shared/dal/client/hooks/use-data-view-query'
import { defineFieldList } from '@/shared/dal/lib/query/field-list'
import { useTRPC } from '@/trpc/helpers'

type Meetings = typeof MEETING_FIELDS

// @ts-expect-error misspelled toolbar id
export const toolbarTypo = { fields: {} as Meetings, paramPrefix: 'x', toolbar: ['meetingTyp'], window: { kind: 'whole-list' } } as const satisfies DataViewQueryConfig<Meetings>
// @ts-expect-error misspelled default sort
export const sortTypo = { fields: {} as Meetings, paramPrefix: 'x', toolbar: [], defaultSort: { sortBy: 'outcom', sortDir: 'asc' }, window: { kind: 'whole-list' } } as const satisfies DataViewQueryConfig<Meetings>
// @ts-expect-error a date window on a field that isn't a date range
export const windowTypo = { fields: {} as Meetings, paramPrefix: 'x', toolbar: [], window: { kind: 'date', field: 'outcome', cap: 1 } } as const satisfies DataViewQueryConfig<Meetings>
// @ts-expect-error misspelled column sort id
export const columnTypo = { x: { label: 'X', sort: 'progam' } } satisfies ColumnRegistry<unknown, SortId<Meetings>>
// @ts-expect-error reserved URL suffix as a field id
export const reserved = defineFieldList({ v: { label: 'V', sort: true } })

export function WrongProcedure() {
  const trpc = useTRPC()
  // @ts-expect-error a customers config can't drive the meetings read
  return useDataViewQuery(trpc.meetingsRouter.reads.list, {}, {} as DataViewQueryConfig<typeof CUSTOMER_FIELDS>)
}

export function RightProcedure() {
  const trpc = useTRPC()
  return useDataViewQuery(trpc.meetingsRouter.reads.list, {}, {} as DataViewQueryConfig<Meetings>)
}
```

Run: `cd $REPO && pnpm exec tsc -p "$SCRATCH/tsconfig.json"`
Expected: clean. Every `@ts-expect-error` fires; if any doesn't, tsc reports it as unused. `RightProcedure` must compile, which proves `WrongProcedure` fails for the config mismatch and not for some other reason.

The missing-SQL, extra-SQL and wrong-value cases are pinned in Task 4's `$SCRATCH/types/field-sql.ts`.

- [ ] **Step 2: Legacy query-key parity**

Run: `cd $REPO && pnpm exec tsx --tsconfig "$SCRATCH/tsconfig.json" "$SCRATCH/tests/legacy-parity.ts" | diff "$SCRATCH/baseline/legacy-inputs.json" - && echo PARITY-OK`
Expected: `PARITY-OK`.

- [ ] **Step 3: No silent fallbacks left on migrated reads**

Run:

```bash
cd $REPO && grep -rn "buildFilterWhere\|buildOrderBy\|paginatedQueryInput" src --include=*.ts --include=*.tsx | grep -v "shared/dal/server/lib/query/"
```

Expected: only the proposals, projects and campaign-leads reads, and their routers. Nothing under meetings, customers, activities or pipelines.

Run: `cd $REPO && grep -rnE "from '@/shared/dal/(client|server)/" src/shared/dal/lib`
Expected: only the legacy `filter-parser-registry.ts` and `derive-paginated-query-state.ts` type imports from `dal/client/lib/types` (`FilterValue`, `FilterDefinition`, `FilterState`). The new core imports nothing from `dal/client/` or `dal/server/`.

- [ ] **Step 4: Full checks**

Run: `cd $REPO && pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 5: Hand-off to the owner**

Report:
- the commits;
- anything deviated from;
- the Flow 1–3 results.

Also tell the owner four things; don't do them unasked:
1. **Record the gates before the spec goes.** The intended role gates (spec §9: Rep and Lead source on meetings and customers; Owner on activities; all super-admin) must be recorded in the records-management epic tracker (O4) before the spec is deleted.
2. **Delete the shipped docs.** Per the repo rule, once this ships, `docs/superpowers/specs/2026-09-27-data-view-filtering-design.md`, `docs/plans/2026-09-27-data-view-filtering-research.md` and this plan are deleted.
3. **Record the adapter's retirement.** `fromPaginatedQuery` and the legacy `usePaginatedQuery` path stay for proposals, projects and campaign leads. Proposals and projects have static filter configs and can move onto field lists next; campaign leads builds its config at runtime. Add this follow-up to the records-management epic tracker, so the adapter doesn't become permanent.
4. **Open issues stay open.** Spec §14's findings still need their own work:
   - the `/pipeline/leads` scoping gap;
   - the projects visibility gap;
   - the remaining Rule 19 files.
