# The data-view surface — design

> **Status:** approved by the owner on 2026-10-14 (data-views epic DV2): the 2026-10-07 design as written on 2026-10-08, with the 2026-10-12 amendments (§11 #13–#16). Nothing is built.
> **Tracker:** `docs/plans/2026-09-26-records-management-epic.md` — rulings **D29** (filtering is a data-access concept; the toolbar is pluggable into any data view), **D45** (entity table = the headless hook), **D64** (R2's order), **D65** (this design, and its order against R2, #285 and pipeline-speed); ledger §3.1.
> **Amended 2026-10-12** to match instant tab return (rulings R1–R9 in `docs/plans/2026-10-12-data-views-epic.md` §3, built `0a7b6814d..77febe8dd`). The amendment covers the pending context, the read hooks' flags, loading screens and the busy rule, and puts edge-to-edge first in the order. Owner rulings of that day are §11 #13–#16, with the decisions they amend marked.
> **Facts:** read-only code audit on 2026-10-07/08 at `8934a398`; the amended passages re-checked at `b17417fd0`, and every `file:line` re-checked after edge-to-edge and #285 units 1–3 shipped, at `eff6ff23f` (2026-10-13), and again at `2ef151415` (2026-10-14). Re-check a `file:line` before relying on it.
> **Delete this file when the third phase ships;** the tracker keeps the rulings.

## 1. Goals, non-goals, success criteria

**Why.** Ten surfaces present one entity's records through the same data layer (`useDataViewQuery`, `DataViewBoundary`, `QueryToolbar`), and each one hand-draws the chrome around it: the strip, the heading and count, the fill cell, the stale dim, the empty state. The owner's rule: data is data; how a view filters, sorts or presents may differ, but the slots are the same for every data view, and the view never knows whether it is a page or sits inside a tab, a card or a modal. That is the orchestrator's business.

**Goals**
1. One compound, `DataView`, from which every data view composes its chrome: root, `Bar`, `Title`, `Count`, `Toolbar`, `Body`, `Empty`, `Boundary`.
2. The common truths live in the parts and are the same everywhere: boundary + pending, the count, the empty rule, the stale rule.
3. The orchestrator writes the wrapper and may drop the bar, swap the heading, or pick toolbar pieces. No per-callsite layout component exists for that (no `EntityTableSection`; D65).
4. Bodies stay what they are: `DataTable`, `ScheduleCalendar`, `KanbanBoard`, `DashboardMeetingsCalendar`. `useEntityTable` stays the table's adapter.
5. The ten views migrate in three phases, deleting the hand-rolled chrome as they go.
6. No render regression on any of them, measured.
7. Any data view of any entity opens instantly on a return. Its loading state is the view itself, showing the cached rows on the first frame; the server's copy then replaces them in place, and nothing dims while it does (§3.7, §3.8). This is what makes a new data view fast without extra work. The parts and the read hooks carry it, not each route.

**Non-goals**
- A view-type switch (kanban ↔ table ↔ calendar). `DataViewTypeToggle` is deleted as dead code; a switch is a later data-view question.
- Moving the dashboard proposal/project card lists and the customer-profile lists onto `useDataViewQuery` (R2 spec §9; D62 defers tables-vs-cards there).
- Campaign leads (legacy, D57).
- The action hosts (pipeline-speed §3.2). A host mounts inside the root; this spec does not move dialogs.
- Row selection and bulk actions (records B2–B4).
- Changing what any view reads, filters, sorts or shows. Same rows, same URL keys, same controls.

**Success criteria**
- `grep -rln "RecordsPageShell\|RecordsPageHeader\|data-view-type-toggle" src` is empty after phase 1 + R2 Part 2.
- The hand-written fill cells and strips are gone: `schedule-meetings-calendar.tsx:69-74`, `schedule-activities-calendar.tsx:55-61`, `customer-pipeline-view.tsx:144-152`, and the two panes' (`all-customers-section.tsx:92`, its sibling) after R2 Part 2.
- Every `useDataViewQuery` caller (and `fromPaginatedQuery`'s one caller, proposals) renders inside a `DataView` root; the root's development check passes on every page.
- Records probe (`scripts/perf/records-probe.mjs`): expand re-renders one row, a modal open none, before and after. Pipeline-schedule probe (`.superpowers/harness/pipeline-schedule-perf/`): no regression against its baseline.
- Browser, read-only, per phase: same rows and URL keys; empty, stale and error states forced and shown once each.
- Instant return holds on every migrated view, under throttled network:
  - A return shows cached rows on its loading screen.
  - Nothing dims while those rows refresh.
  - The hairline shows only for rows older than 30 s.
  - A row that fails to render stays inside its view.

  The instant-tab-return checks carry over: return, error-return, home and week entry.

## 2. Vocabulary

| Term | Meaning | Never |
|---|---|---|
| **data view** | One surface presenting a list of one entity's records through the data layer: a query (`useDataViewQuery` or `fromPaginatedQuery`) inside a `DataView` root. Code already uses the word (`useDataViewQuery`, `DataViewBoundary`, `DataViewQueryConfig`). | "list view", "data page" |
| **body** | The view-specific presentation inside `DataView.Body`: `DataTable`, `ScheduleCalendar`, `KanbanBoard`, a card list. | "renderer", "widget" |
| **orchestrator** | The page or component that mounts a data view and writes the wrapper around its parts. | "container" (a records-management term) |
| **common truth** | A rule every data view renders the same way, owned by a part: boundary + pending, count, empty, stale. | — |
| **Entity View Context** (glossary) | The concept a data view implements; unchanged. | — |
| **loading screen** | A route's `loading.tsx`: the page's own component under `DataViewPending`, its data views showing their cached rows (instant tab return R6; glossary entry owed to `CONTEXT.md`). | "skeleton page" |
| **pending view** | Any render under `DataViewPendingContext` other than `false`: a loading screen, a boundary's suspense fallback (`'loading'`), or its error fallback (`'error'`). | — |

New names (owner-approved 2026-10-07): `DataView`, parts `Bar`, `Title`, `Count`, `Toolbar`, `Body`, `Empty`, `Boundary`; prop `empty`; type `EntityTableResult`; folder `shared/components/data-view/`. The attribute `data-busy` is dropped (2026-10-12, §3.5): the one dim marks rows of another key, which the code already calls `data-stale`. Nothing else is coined; a plan that needs another name lists it under "Owner confirms".

## 3. The compound

**Home:** `src/shared/components/data-view/`, laid out like `query-toolbar/`:

```
data-view.tsx          DataView = Object.assign(Root, { Bar, Title, Count, Toolbar, Body, Empty, Boundary })
lib/context.ts         DataViewContext { query, entityName }, useDataView() (throws outside a root)
ui/root.tsx            Root
ui/bar.tsx ui/title.tsx ui/count.tsx ui/toolbar.tsx ui/body.tsx ui/empty.tsx
ui/boundary.tsx        moved from shared/components/data-view-boundary.tsx (export name DataViewBoundary kept)
ui/pending.tsx         moved from shared/components/data-view-pending.tsx
```

`DataViewPendingContext` stays in `shared/dal/client/lib/` because the hooks read it, and `useLoadingScreenRead` stays in `shared/dal/client/hooks/` beside them.

### 3.0 What the data layer already gives a data view

Instant tab return put the loading-state rules in the read hooks, `useDataViewQuery` and `usePaginatedQuery` (R9), so every data view inherits them and the parts only render them.

- **`DataViewPendingContext` is `false | 'loading' | 'error'`.**
  - `DataViewPending` provides `'loading'`. It is used by loading screens, the boundary's suspense fallback, the layout's document-load skeleton and the PWA launch shell.
  - The boundary's error fallback provides `'error'`.
  - `useIsDataViewPending()` stays a yes/no.
- **`useLoadingScreenRead(options)`.**
  - Outside a pending view, it returns the options unchanged.
  - In a `'loading'` view with the key cached, it returns the options with `refetchOnMount: false`. The cached rows show, and the page that replaces the loading screen refreshes them.
  - Otherwise it returns `null`, and the caller draws its skeleton.
  - The two hooks map `null` to `EMPTY_DATA_VIEW_READ`.
- **The flags a part reads from `query`:**
  - `isPending`: no rows to show. That is a pending view with nothing cached, or the error fallback.
  - `isStale`: the rows on screen belong to another key, the previous filter, page or window.
  - `isFetching`: rows older than `staleTime` (30 s), or invalidated by a save or `refresh()`, are being refetched while they stay on screen. A refetch of fresh rows is silent (R4).
- **Work a pending view never does:** it starts no neighbour preload, writes no URL, and runs no hydration or prefetch check (`useHydrationParityCheck`, `useServerPrefetchGuard`). Those belong to the page.
- **Cache lifetime:** client `gcTime` is 30 min and `staleTime` is 30 s (R3). This is why a tab used earlier in the session still has its rows.
- **Cached rows belong to one user.** Query keys carry no user, so `AbilityProvider` clears the whole query cache when the signed-in user changes in a tab (`shared/domains/permissions/client.tsx`, `6c0e6f3f3`). A loading screen therefore never draws the previous user's rows. A data view relies on this rather than adding the user to its keys.

### 3.1 Root `<DataView query entityName>`

- Provides `{ query, entityName }`. The value is memoised on the query's fields (`rows, total, isPending, isStale, isFetching, refresh, filterSort, window`), each already stable from the hook; the hook itself returns a new object every render (`use-data-view-query.ts:259`), which is why the root memoises and not the caller.
- Renders a fragment; nothing styled. The entity's dialogs (or, later, its action host) render as children.
- `DataViewBoundary` sets a one-bit context. In development, a root without it throws: ``<DataView> needs a <DataViewBoundary> above it``. In production it renders. That is how truth #1 is enforced instead of remembered.
- `query` is `DataViewQueryResult<TRow, F, T, W>` from any window kind; `fromPaginatedQuery`'s result qualifies (proposals, until R3). The root is generic in its prop and stores the query widened once, as `DataViewQueryResult<unknown, FieldList, string>`, exactly as `QueryToolbar`'s root does (`query-toolbar/lib/context.ts:10-11`), so every part reads one non-generic shape and no `any` appears.
- `entityName` is the plural ("customers"): what every `QueryToolbar` caller passes and what `LiveStatus` reads ("Showing 20 customers"). ⚠️ `query-toolbar/ui/root.tsx:19` documents it as singular; the code has always used the plural, and phase 1 corrects the comment. `useEntityTable`'s `entityName` stays singular (it names one row).

### 3.2 `Bar`

`PageBar` (`page-bar.tsx`), optional. The orchestrator decides whether the view sits on the page strip. `PageBar` itself stays where it is; campaigns uses it outside a data view.

### 3.3 `Title`, `Count`

- `Title`: the heading element only. `as?: 'h1' | 'h2' | 'h3' | 'h4'` (default `h2`), `className`, children. No count, no actions, no layout.
- `Count`: `<span>` with `formatTotalCount(query.total)`: the number, nothing after it (owner call, §11). While `query.isPending` it shows `Loading…`, which happens only in a pending view with nothing cached. A loading screen with cached rows shows their count. In the error fallback (`DataViewPendingContext` is `'error'`) it renders nothing, so `Loading…` never sits under a retry (§11 #16). `className` for the wrapper's typography.
- The wrapper (`<header>`, a flex row, an eyebrow line) is the orchestrator's; the five heading styles that exist today keep existing where they are wanted. The type ramp is enforced by the existing lint guards, not by these parts.

### 3.4 `Toolbar`

The `QueryToolbar` root with `query` (the widened shape, which `QueryToolbarRoot`'s generic accepts) and `entityName` taken from context; children are `QueryToolbar`'s parts as today (`Standard`, or a hand-picked bar). `QueryToolbar` is not changed and still works standalone (campaign leads). Cap notice and live status stay toolbar pieces the orchestrator picks (owner, 2026-10-07): a pane may drop them; the records pages keep `Standard`.

### 3.5 `Body`

`<DataView.Body empty? className?>` renders one `div`:

- the fill cell every view writes by hand today: `min-h-0 flex-1` (`records-page-shell.tsx:45`, `schedule-meetings-calendar.tsx:74`, `customer-pipeline-view.tsx:149`). The cell clips nothing horizontally. It sits between `<main>` and the bodies that bleed to the screen edge (`DataTable`, `KanbanBoard` and the schedule grids apply `bleed-x` themselves), and a non-surface ancestor that clipped the x axis would cut that bleed (`docs/codebase-conventions/app-shell.md#page-insets-and-bleed`). It is not a surface either, so it leaves the bleed allowance alone. Where the orchestrator needs vertical containment around it, that is `overflow-y-clip`, as on `RecordsPageFrame` and the pipeline view's root;
- the **one stale rule (amended 2026-10-12, §11 #13): only rows that don't match the screen dim.**
  - When `query.isStale` (rows of the previous filter, page or window), `Body` sets `data-stale` and dims them: `transition-opacity duration-200 data-[stale=true]:opacity-60 data-[stale=true]:delay-200`. A quick filter change never flashes. This is the class `DataTable` carries today (`data-table.tsx:309`), moved up a level.
  - **A refresh never dims.** When `query.isFetching` (rows past `staleTime` or invalidated being refetched), the rows stay at full strength. The toolbar's hairline is the only sign (instant tab return R1, R4: it feels instant). `aria-busy` is set for `isStale || isFetching`, so assistive tech still hears the update; there is no visual change.
  - The rule does not block pointer events: a click on a dimmed table row is harmless. The kanban, where a drag onto stale rows is not, adds `data-[stale=true]:pointer-events-none` through `className`.
  - The kanban's own move settle is the orchestrator's call, not the rule's. After a drag it dims at once and blocks dragging until the move saves and the board re-reads (`isMoving`, `customer-pipeline-view.tsx:145-152`), passed through `className` (owner, 2026-10-12: rows that may not match yet). Its opacity becomes `opacity-60`, the same as the rule's.
  - `DataTable` loses its own dim (`data-table.tsx:309-312`), and the pipeline view loses its wrapper (`customer-pipeline-view.tsx:144-152`).
- the **one empty rule**: when `query.rows.length === 0 && !query.isPending && !query.isStale` (the kanban's rule, `customer-pipeline-view.tsx:153`) and `empty` is given, `Body` renders `DataView.Empty` instead of its children. `empty` is `true` (the defaults), `{ title?, description? }`, or a node. No `empty` → children always (a calendar keeps its grid for an empty week). A stale empty result is the previous key's and never fires it.
- Pending with no rows is not `Body`'s: the body draws its own skeleton shape (table rows, `data-table-body.tsx:78-94`; calendar cards on `window.isPending`). That is the shape of the view, not a common truth.

### 3.6 `Empty`

`EmptyState` (`states/empty-state.tsx`) fed from context. Props `{ title?, description?, children? }`. Defaults (owner call, §11): title `No {entityName}`; description `No {entityName} match these filters` when `filterSort.activeFilterCount > 0 || filterSort.search`, else the given `description`, else none. `Body`'s `empty` accepts `{ title?, description? }` or a node.

### 3.7 `Boundary`, pending

The behaviour is the one instant tab return built (`data-view-boundary.tsx`, `data-view-pending.tsx`); this spec moves the files and adds nothing to it.

- **Suspense pending:** the view under `DataViewPending` (`'loading'`). Each data view shows its key's cached rows, or its own skeleton shape when nothing is cached. It starts no fetch, because the read already in flight resolves the suspense.
- **Error:** a retry above the view under `'error'`. The view renders row-less even when the cache holds rows, because rows that failed to render must not render again inside their own fallback and escape the boundary (R7). The retry resets on a URL change, so a filter change is the way out of a key that keeps failing.

The two are moved into the folder and exported both as `DataView.Boundary` and `DataViewBoundary`. The boundary now also provides the one-bit context the root checks.

### 3.8 Loading screens (rule; 2026-10-12, §11 #14)

A route whose page renders data views gets the instant return from one rule. Its page, its `loading.tsx` and the layout's document-load entry (`DASHBOARD_ROUTE_PENDING_VIEWS`) all render the same component:

- the page as `<HydrateClient><X /></HydrateClient>`, after its prefetches;
- `loading.tsx` as `<DataViewPending><X /></DataViewPending>`;
- the layout's map entry as `X`, plus any provider a segment layout would have supplied (the pipeline's `PipelineProvider`).

`X` owns every `DataViewBoundary` inside it, so the three renderings cannot drift. A loading screen that composed its own copy without the boundary is how a bad cached row once reached the root error screen (`77febe8dd`). Meetings, projects, schedule and home already follow the rule. Customers, proposals and pipeline still compose their boundary in `page.tsx` and again in their loading screens. Each moves onto the rule in the work that rewrites those files anyway:
- customers in R2 Part 2;
- proposals in phase 1;
- pipeline in phase 3.

Nothing moves twice. Each of those plans includes the step.

A read outside any data view, such as the dashboard's proposal and project card lists and its count chips (non-goals above), follows the same rule by hand. Its parent passes the options through `useLoadingScreenRead` and draws the skeleton on `null`, and the child reads them. The options are typed with tRPC's `UnusedSkipTokenOptions` alias, written out today in three home files.

The owner chose the rule without a lint guard (2026-10-12). A page that prefetches without a `loading.tsx` beside it shows the previous page until the server answers. Review catches that, not a tool.

## 4. Bodies and adapters

**Table.** `useEntityTable` unchanged. The hook result type `{ query, visibility, dataTableProps, dialogs }` becomes `EntityTableResult<TRow, TMeta, F, T>` in `data-table/types/entity-table-result.ts`, replacing `EntityRecordsTableSource` (`entity-records-table.tsx:15`). `DataTable` drops its dim class (`data-table.tsx:309`) and its in-table "No … match" row (`data-table-body.tsx:96-104`): an empty table shows the `Empty` part in place of the table, header row included; the toolbar above keeps the filters, which are the way out (owner call, §11). The skeleton rows when no rows are loaded stay.

**`EntityRecordsTable`** is kept as the one records-page composition, rebuilt on the parts; its props (`title`, `entityName`, `searchPlaceholder`, `headerActions`, `table`) do not change:

```tsx
<DataView query={table.query} entityName={entityName}>
  {table.dialogs}
  <div className="flex h-full min-h-0 flex-col gap-(--gutter)">
    <DataView.Bar>
      <header className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <DataView.Title className="text-lg font-semibold tracking-tight">{title}</DataView.Title>
          <DataView.Count className="text-xs text-muted-foreground tabular-nums" />
        </div>
        {headerActions && <div className="ml-auto flex items-center gap-2">{headerActions}</div>}
      </header>
      <DataView.Toolbar><QueryToolbar.Standard searchPlaceholder={searchPlaceholder} visibility={table.visibility} /></DataView.Toolbar>
    </DataView.Bar>
    <DataView.Body empty><DataTable {...table.dataTableProps} /></DataView.Body>
  </div>
</DataView>
```

Meetings and projects call it today; customers does after R2 Part 2; proposals (`proposal-flow/ui/components/table/index.tsx:142-146`, on `fromPaginatedQuery`) composes the parts by hand until R3 moves it onto `useEntityTable`. In the same commit, the proposals route moves onto the loading-screen rule (§3.8): `ProposalsRoutePendingView` and the boundary in `page.tsx` give way to one component. `RecordsPageShell` and `RecordsPageHeader` are deleted with their last caller (`customers-table.tsx`, which R2 Part 2 deletes).

**Calendars (schedule ×2).** Root + `Bar` (`Toolbar` with `Standard leading={showToggle}`) + `Body` with no `empty` around `ScheduleCalendar`; the hand-copied strip (`schedule-meetings-calendar.tsx:69-74`, `schedule-activities-calendar.tsx:55-61`) goes. `ScheduleCalendar` keeps `dateWindow`, its skeleton cards and `controlsRight`. Dialogs render inside the root as today.

**Kanban (pipeline).** `Bar` holds the metrics bar, `PipelineSelect`, `KanbanStageFilter` and the `Toolbar` (`Standard sort`), as the `PageBar` does today (`customer-pipeline-view.tsx:124-142`); `Body empty={{ title: 'No customers', description: 'Start by scheduling meetings with customers' }}` around `KanbanBoard`; the dim wrapper and `EmptyState` (`:144-162`) go, and the move settle's dim passes through `Body`'s `className` (§3.5). `KanbanBoard` unchanged. The board's `MeetingActionsHost`, `ProposalActionsHost`, `CustomerActionsHost` and `ProjectActionsHost` (pipeline-speed Phase 2, shipped) wrap the view today; they go inside the root, beside the dialogs.

**Dashboard meetings hub.** On the hook (`dashboard-meetings-hub.tsx:24`), inside `DashboardModule` with no toolbar. Root + `Body` (no `empty`) around `DashboardMeetingsCalendar`; no `Bar`, no `Count`. The module's own heading stays.

**Panes (lead-sources ×2), in R2 Part 2.** Each composes the parts in its own `<section>`: eyebrow `Title as="h3"` + `Count`, `Toolbar` with `Standard`, `Body` with `empty` around `DataTable` (R2 spec §5.3; plan Part 2 Task 2 Steps 3–4).

## 5. Render rules

The records-isolation rules, extended to every view:

- The context value is memoised on the query's fields. Every part is a leaf. `Body` renders one `div` around unchanged children: no `cloneElement`, no new props to `DataTable`, `ScheduleCalendar` or `KanbanBoard`.
- `Toolbar` hands `QueryToolbar` the same `query` object it receives today, so the toolbar's internals are untouched.
- The boundary check is a context read in render, not an effect.
- Nothing reaching a body changes identity per render that didn't before. Action configs still come from `useStableCallbacks`; meta values are values.
- Acceptance per phase (§8): the two probes, before and after, no regression.

## 6. Migration

Ten views, three phases, one plan each. A phase deletes the chrome it replaces in the same commits; nothing is moved twice (D14).

| Phase | Views | Deleted |
|---|---|---|
| **1 · core + tables** | the compound; `EntityRecordsTable` rebuilt; meetings and projects records (through it); proposals records (by hand); `EntityTableResult` | `DataTable`'s dim class and empty row; `DataViewTypeToggle`; `EntityRecordsTableSource`; `RecordsPageShell` and `RecordsPageHeader` go when R2 Part 2 deletes `customers-table.tsx` |
| **2 · calendars** | schedule meetings, schedule activities, dashboard meetings hub | the two hand-copied strips |
| **3 · kanban** | the pipeline view (its `DataViewBoundary` moves inside it, §3.8) | its dim wrapper and `EmptyState`; the boundary in `pipeline/[pipeline]/page.tsx` and `loading.tsx`, and the one in `PipelineRoutePendingView` |

**Order (D65, amended 2026-10-12, §11 #15):**

1. R2 Part 1 (data layer) and instant tab return are built. Instant tab return ships whenever the owner chooses.
2. **Edge-to-edge layout first** (shipped 2026-10-13, `25e677167..eff6ff23f`; rule in `docs/codebase-conventions/app-shell.md#page-insets-and-bleed`). It rewrote the frames these phases wrap: the `DataTable` card, `RecordsPageFrame`, the schedule calendar and the pipeline view. Each phase plan is therefore written against the final frames.
3. **Phase 1 → R2 Part 2.** This way `useCustomersTable` and the panes are written once, against the parts.
4. **Phases 2–3.**
5. ~~**#285** rebases onto R2 (D64).~~ Overtaken on 2026-10-12: #285 units 1–3 (the Customer, Meeting and Proposal families on compiled rules) shipped first (`b17417fd0`). R2 Part 2's plan is re-checked against the customer files they changed before it runs. Part 4 (the Project family, built on its branch, 5 commits at `bc8149a87`) ships on its own schedule. It touches only `projects-records-table.tsx`'s `headerActions` among this spec's files, and `EntityRecordsTable`'s props don't change, so whichever lands second merges trivially.

Pipeline-speed Phase 2 (action hosts) shipped before this spec was built (`5bc02a945`), so phases 2–3 build on the hosts rather than the hosts rebasing onto them. Phases 2 and 3 may interleave with R2 Part 2, since they touch different files.

**Plans:** `docs/superpowers/plans/2026-10-xx-data-view-core-and-tables.md`, `…-data-view-calendars.md`, `…-data-view-kanban.md`. Each ticks ledger §3.1's new "DataView parts" column for its files.

## 7. Error handling and edge cases

- Root without a boundary: throws in development with the message in §3.1; renders in production.
- `empty` while stale or pending: never fires (§3.5). A read that keeps failing: the boundary's retry above the row-less view, as today; a filter change clears it (URL key).
- Pending with no rows: the body's skeleton shape; `Count` says `Loading…`.
- Pending with cached rows (a loading screen on a return): the rows, their `Count`, no dim, no hairline; the page's server copy replaces them in place. A cached empty result shows `Empty`, the same as the page would.
- A refresh of rows past `staleTime`: rows at full strength, the hairline in the toolbar, `aria-busy`. A refresh that fails leaves the rows and stops the hairline; the error UI is only for a read with no rows.
- Error fallback: the retry, the row-less view, no `Count`, no `Empty`.
- A `whole-list` window (kanban) has no paging; `Body` does not care about the window kind.
- `Count` renders on the server as `Loading…` when the page's prefetch has not settled: the pre-existing hydration note on the records headers (data-view memory, follow-ups) moves onto `Count` unchanged and is not fixed here.
- Two data views on one page (schedule's meetings and activities each inside their own boundary): two roots, as today; the parts read the nearest root.
- `Title` with `as="h1"` is allowed and unused; records pages keep `h2`.

## 8. Verification

- Per task: `pnpm tsc`, `pnpm exec eslint <files>`. Never `pnpm build`.
- Pure rules by throwaway `node:test` (no runner in the repo): the empty rule, the busy rule, `Empty`'s default copy, the memoised context value's identity across re-renders with equal fields.
- Browser, read-only, per phase, 1440 and 390 px, light and dark, super-admin and agent: same rows and URL keys as the phase's baseline; the empty, busy and error states forced with `page.route` interception and screenshotted once each; the dev console shows no new error. Evidence under `.superpowers/sdd/<plan>/`.
- Probes: `node scripts/perf/records-probe.mjs /dashboard/meetings` (phase 1), the pipeline-schedule probe for `/dashboard/schedule` and `/dashboard/pipeline/fresh` (phases 2–3), before and after.
- No database writes for testing (dev included).

## 9. Coordination

- **R2** (`docs/superpowers/specs/2026-10-05-customers-entity-table-and-fixed-filters-design.md`): Part 2 is written against the parts (its §5.3 and plan Task 2 Steps 3–4 already are, as sketches); it waits for phase 1. Part 1 does not wait.
- **Pipeline-speed Phase 2** (`docs/superpowers/specs/2026-10-05-pipeline-schedule-speed-design.md` §3.2): shipped (`5bc02a945`). Phases 2–3 build on its hosts, which go inside the root as children; nothing here moves a dialog.
- **Edge-to-edge layout** (shipped 2026-10-13, `25e677167..eff6ff23f`; spec in git history at `690c63408`): it changed `data-table.tsx`, `RecordsPageFrame`, the schedule calendar and `customer-pipeline-view.tsx`. Every `file:line` in §3–§4 must be re-checked against the shipped code before a phase plan is written.
- **Instant tab return** (shipped; rulings R1–R9 in `docs/plans/2026-10-12-data-views-epic.md` §3): built. Its machinery is §3.0 and §3.7, and its checks join each phase's verification (§1).
- **#285 permissions:** units 1–3 are on prod (§6). Part 4 overlaps this spec only in `projects-records-table.tsx` (`headerActions` gains a `Can`). `customers-table.tsx` is deleted by R2, whose plan re-checks the shipped customer reads (search gating, dispatcher reach) first.
- **Theme sessions** edit `data-table.tsx`, the schedule and pipeline views, and `globals.css` on the shared tree. Every plan task runs `git status --short <file>` before an edit and stops on another session's hunks.
- **Shared tree:** pathspec commits only; `git show --stat HEAD` after each.

## 10. Records

- Tracker §1 terms table gains **data view** (§2); ledger §3.1 gains a "DataView parts" column; D65 is the ruling. `CONTEXT.md` "Records terms" gains *data view*, *body*, *orchestrator*, *loading screen* and *pending view* (when the session holding `CONTEXT.md` releases it).
- The glossary's "Entity View Context" entry gets one sentence: a data view is its implementation.
- This spec is deleted when phase 3 ships; its plans are deleted as each ships.

## 11. Owner decisions (2026-10-07)

| # | Decision |
|---|---|
| 1 | Approach: compound with parts by context (over a slots component, or per-body ready components). |
| 2 | Common truths owned by the parts: boundary + pending, count, empty + stale. Cap notice and live status stay the orchestrator's toolbar choice. |
| 3 | Heading: fine parts (`Title`, `Count`), free wrapper; no header component with sizes. |
| 4 | Scope: all ten views on the data layer; dashboard card lists, profile lists and campaign leads stay. |
| 5 | `EntityRecordsTable` kept as the records-page composition; the panes compose the parts directly; `EntityTableSection` retracted (D65). |
| 6 | The dashboard meetings hub is the tenth view. |
| 7 | One empty placement: `Body` replaces its children; the table's in-table empty row goes. |
| 8 | ~~One busy rule: `data-busy` for stale or fetching, `opacity-60` after 200 ms in both cases.~~ Amended by #13. |
| 9 | `Count` is the number only. |
| 10 | `Empty` defaults: `No {entityName}`; "No {entityName} match these filters" when a filter or search is active. |
| 11 | ~~Order: phase 1 → R2 Part 2 → phases 2–3 → pipeline-speed Phase 2 and #285 rebase (D65).~~ Amended by #15. |
| 12 | Names in §2. |

**Amendments (2026-10-12), after instant tab return:**

| # | Decision |
|---|---|
| 13 | Only rows that don't match the screen dim: rows of another key (`isStale`), and the kanban right after a drag until the move saves. A refresh never dims; the hairline is its only sign (owner: "no dimming, feels instant"). Amends #8. |
| 14 | Loading screens are a rule, not a guard: a page, its `loading.tsx` and the layout's entry render one component that owns its boundaries (§3.8). No lint rule. |
| 15 | Order: edge-to-edge layout → phase 1 → R2 Part 2 → phases 2–3 (on the shipped action hosts). #285 units 1–3 shipped before R2 (2026-10-12), so R2 re-checks against them instead of #285 rebasing. Amends #11. |
| 16 | `Count` renders nothing in the error fallback, so `Loading…` never sits under a retry (Claude's call, approved by the owner 2026-10-14). |

**Open:** none for the design. Plan-level names (test file names, the ledger column's exact header) go under each plan's "Owner confirms".
