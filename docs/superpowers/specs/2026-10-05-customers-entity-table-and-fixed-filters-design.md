# Customers entity table and fixed filters — design

> **Status:** approved by the owner 2026-10-05; plans written in two parts (`docs/superpowers/plans/2026-10-05-customers-entity-table-and-fixed-filters.md`, `…-part-2.md`); both stress-tested 2026-10-07 and the owner's rulings of that day applied here (tracker **D64**). Nothing is built.
> **Tracker:** `docs/plans/2026-09-26-records-management-epic.md` — phase **R2**, rulings **D45, D48, D51, D60, D62, D64**, open item **O9**, audit **O3**.
> **Facts:** a read-only code audit on 2026-10-05 at `213662b3`. Re-check a `file:line` before relying on it.

## 1. Goals, non-goals, success criteria

**Goals**
1. A data view can pin filter values itself: **fixed filters**, set by the callsite, never read from the URL, never shown in the toolbar. This is the piece that lets an entity's list read be reused outside its records page (O9).
2. A data view can ask for the **first N rows** of its order, with no paging.
3. Customers get an entity table hook, `useCustomersTable`, and the three customers tables use it (R2).
4. The lead-source pane reads the shared customers list with its source pinned; `leadSourcesRouter.getCustomers` goes.
5. The agent dashboard's meetings calendar and its project and meetings lists read through the same mechanism. Their cards do not change.
6. Components under `entities/customers/components/lists/` move to the entity whose tree they render (O3).
7. One `openCustomerProfile(props)` opens the customer profile modal everywhere, in place of the hand-written `openModal({ accessor: 'CustomerProfile', … })` calls (owner, 2026-10-07; §5.6).
8. An embedded entity table composes the shared `DataView` parts in its own wrapper; no shared pane component (owner, 2026-10-07, **D65**, decided later the same day than D64 and replacing its `EntityTableSection`; §5.3).

**Non-goals (owner, 2026-10-05)**
- Whether the dashboard and the customer profile show tables or keep cards: **deferred**. Nothing here changes what either surface looks like.
- Analytics drill-down: **out of this spec entirely**. §9 records what the audit found for that effort.
- The customer profile moving onto the list reads (§9).
- An expanded row for customers. A customer row keeps opening the profile modal.
- Row selection and bulk actions (the bulk step, D49).
- Role-gated filters (they wait for #285).

**Success criteria**
- The three customers tables show the same rows, columns and URL keys as today, except that the lead-source pane loses its Source column (constant in that pane). Their actions are the same, except that Edit Profile and Schedule Meeting reach real targets (§5.5); the panes gain the row-cap notice the records pages have; switching sources starts the pane on page 1 (§5.4).
- `grep -rn "getCustomers" src` finds no customers-table caller, and the procedure is gone.
- `grep -rn "liveOnly" src` finds nothing.
- The dashboard shows the same cards and the same rows as before.
- No hydration-drift error in the dev console on `/dashboard/customers`, `/dashboard/lead-sources` and `/dashboard`.

## 2. Vocabulary

| Term | Meaning | Status |
|---|---|---|
| **fixed filter** | A filter value a data view always applies, set by the callsite. The URL never carries it and the toolbar never shows it. | Exists as a field kind (`FixedFilter`, `fixedOnly`); this spec adds the callsite half. Config key and hook argument: **`fixed`** (owner-approved 2026-10-05). |
| **first-rows window** | A data view window that returns the first N rows of the view's order and has no paging. | New. Window kind **`first`** (owner-approved 2026-10-05); its size field `count` is proposed here. |
| **table view** | A specific configuration of an entity table (tracker §1). | Unchanged. |

A fixed filter **narrows what a view asks for; it is not access control.** `fieldListInput` already accepts every filter id from any client (`dal/server/lib/query/field-list-input.ts:33-35`), so what a viewer may see is decided only by the read's own scope.

## 3. Fixed filters in the data view

### 3.1 Today

- A field list can declare a filter no toolbar shows: `fixedOnly(schema)` (`dal/lib/query/field-list.ts:54-61,148-150`). `CUSTOMER_FIELDS.sourceId`, `.segment` and `PROJECT_FIELDS.excludePortfolio` use it.
- Only a procedure or a hand-built input can set one: `leadSourcesRouter.getCustomers` overwrites `sourceId` (`lead-sources.router.ts:271`); the meetings router turns a top-level `liveOnly` into an outcome filter (`meetings.router/reads.router.ts:16-23`); the dashboard writes `filters` literals (`features/agent-dashboard/constants/dashboard-queries.ts:78,87`).
- `useDataViewQuery` has no typed route for it. Its `extra` argument is spread over the derived input (`use-data-view-query.ts:84,100,217`), so an `extra` that carried `filters` would replace the toolbar's filters and the date window's.

### 3.2 Design

1. **Static pins live in the config.** `DataViewQueryConfig` gains

   ```ts
   /** Filter values this data view always applies. Never read from the URL, never shown in the toolbar. */
   fixed?: FilterValues<F>
   ```

   Any filter id of the field list may be pinned, a toolbar filter included (the dashboard calendar pins `outcome`).

2. **Runtime pins are passed at the callsite.** `useDataViewQuery(procedure, extra, config, fixed?)` and `loadDataViewQueryInput(searchParams, config, extra?, fixed?)` take the same optional `FilterValues<F>`. It is for a value only the callsite knows (a lead source's id). The hook keys it by value, as it does `extra`, so an inline object does not refetch.

3. **One merge, in `toDataViewInput`.** Filters are built as: the toolbar's URL values, then `config.fixed`, then the runtime `fixed`, then the date window's own field. Fixed values win over URL values. Because the requested input, the shown input and the adjacent-window prefetch all go through `toDataViewInput`, all three carry the pins.

4. **A pinned id leaves the toolbar.** An id present in `config.fixed` or the runtime `fixed` gets no URL parser, no control and no chip, even when the config's `toolbar` lists it. So one `toolbar` list can serve a records page and a pinned embed.

5. **A pin on the date window's field is a mistake.** `toDataViewInput` throws in development when `fixed` names the field a `date` window drives; the window owns that filter.

6. **Server: no change.** Every filter id is already in the list input and already has a SQL condition (`defineFieldSql` requires one per id).

7. **Prefetch parity.** A static pin is in the config constant the page and the hook both import. A runtime pin must be passed to `loadDataViewQueryInput` with the same value the hook gets. A pane mounted only in the browser (the single lead-source pane) has no prefetch, as today.

`extra` stays for top-level procedure input that is not a filter (`{ id }`).

## 4. The first-rows window

`DataViewWindow` gains `{ kind: 'first', count: number }`, beside `page`, `date` and `whole-list`.

- It sends `pagination: { limit: count, offset: 0 }`. It parses no page or page-size URL key, and the adjacent-window prefetch does nothing for it.
- The result carries the rows and the read's `total`, so a callsite can say "5 of 23".
- `useEntityTable` stays page-only: no table uses this window in this spec.

**A data view with no user state needs no hook.** The dashboard lists have no toolbar, no sort control and no paging. For them a pure function gives the input from the config alone:

```ts
/** The input of a data view nobody can change: its config's default sort, pins and window. */
export function staticDataViewInput<F extends FieldList>(config: DataViewQueryConfig<F>, fixed?: FilterValues<F>): DataViewInput<F>
```

It is `deriveDataViewInput` with an empty URL state plus the runtime pins, so the page's prefetch and the component's `useSuspenseQuery` get the same object. (Name `staticDataViewInput` is proposed here; say if you want another.)

## 5. Customers entity table

### 5.1 Today

Three tables wire the same things by hand (`entities/customers/components/customers-table.tsx`, `features/lead-sources-admin/ui/components/all-customers-section.tsx`, `…/lead-source-customers-section.tsx`): the same `onUpdateCreatedAt` mutation, the same `useCustomerActionConfigs({ onView })`, the same columns (`name`, `leadSourceName`, `pipeline`, `createdAt`), the same meta and the same profile-modal row click. They differ in the read they call, their URL prefix (`pc`, `all`, `src`), their `tableId` and the layout around the table.

### 5.2 The hook

`src/shared/modules/customers/core/components/customers-table/use-customers-table.tsx`, the same shape as `useMeetingsTable` and `useProjectsTable`. It is a new file, so it sits at the customers module's address (owner rule 2026-10-05 "code lives where its module will be", applied 2026-10-07): the first file under `modules/customers/`. It is client code with no DAL, so D12's "no partial module" (split-brain DAL) does not apply; existing `entities/customers/**` files are edited in place until the path-only move.

```ts
useCustomersTable(
  tableView: EntityTableView<CustomerColumnKey, typeof CUSTOMER_FIELDS>,
  options?: { fixed?: FilterValues<typeof CUSTOMER_FIELDS> },
): { query, visibility, dataTableProps, dialogs }
```

It owns: the read (`useDataViewQuery(trpc.customersRouter.business.list, {}, tableView.query, options.fixed)`), the created-date mutation, the action configs, the table meta, the row click that opens `CustomerProfileModal`, the delete confirm dialog, and a skeleton row height measured against the real rows (as projects does). Layout stays the callsite's (D45, D65): `EntityRecordsTable` draws the records-page layout from the hook's result; every other callsite composes the `DataView` parts in its own wrapper.

### 5.3 Table views and callsites

| Table view | Home | `tableId` · prefix | Columns | Pins |
|---|---|---|---|---|
| `CUSTOMERS_RECORDS_TABLE_VIEW` | `features/records-management/constants/` | `customers` · `pc` | name, leadSourceName, pipeline, createdAt | none |
| `ALL_CUSTOMERS_TABLE_VIEW` | `features/lead-sources-admin/constants/` | `all-customers` · `all` | the same four | none |
| `LEAD_SOURCE_CUSTOMERS_TABLE_VIEW` | `features/lead-sources-admin/constants/` | `lead-source-customers` · `src` | name, pipeline, createdAt | runtime `{ leadSource: [leadSourceId] }` |

`tableId`s and prefixes do not change, so saved column layouts and existing URLs keep working.

- **Records page:** a `CustomersRecordsTable` in `features/records-management/ui/components/` renders `EntityRecordsTable` from the hook result, like meetings and projects (D11). `entities/customers/components/customers-table.tsx` and `constants/customers-table-query-config.ts` are deleted; the page and its pending view import the new component and constant.
- **Lead-source sections:** compose the `DataView` parts (**D65**, 2026-10-07, later than D64; the data-view spec's phase 1 lands before this plan's part 2) in their own `<section>`: an eyebrow `DataView.Title` with `DataView.Count`, `DataView.Toolbar` holding `QueryToolbar.Standard` (which adds the row-cap notice the hand-written toolbars lacked), and `DataView.Body` with `empty` around `DataTable`. `EntityTableSection` was proposed and retracted the same day: no shared pane component.

### 5.4 The lead-source pane's read

The pane calls `customersRouter.business.list` with `fixed: { leadSource: [leadSourceId] }` in place of `leadSourcesRouter.getCustomers`.

- **Rows:** the same. `leadSource` filters `customers.leadSourceId` with `inArray`, `sourceId` with `eq` (`customer-field-sql.ts:19-20`).
- **Access:** `getCustomers` is super-admin only and unscoped; `business.list` runs under the customers visibility scope, which is empty for a super-admin. The page already turns away everyone who cannot `manage all` (`lead-sources/page.tsx:25-27`), so who sees what does not change.
- **Removed:** `leadSourcesRouter.getCustomers`; `CUSTOMER_FIELDS.sourceId` and `.segment` with their SQL entries (no client sends `segment`; the status counts call `buildSegmentWhere` directly). The plan confirms by grep that the pipeline kanban's input, which shares the field list, uses neither.
- **Unchanged:** the pane's count badge and stats read their own procedures. The page's time range still does not reach the table.
- **Switching sources** (owner, 2026-10-07): the selection handler clears the pane's page key, so a new source starts on page 1. Its pipeline filter and search carry over, as today.

### 5.5 A correction: two row actions go to the wrong place

"Edit Profile" and "Schedule Meeting" in every customers table fall through to `router.push(ROOTS.dashboard.pipeline())` (`use-customer-action-configs.ts:44,53-59`), because no table passes `onEdit` or `onScheduleMeeting`. **Ruled (owner, 2026-10-07):** the hook passes both. **Edit Profile** opens the profile modal in its edit mode (`CustomerProfileModal` gains `defaultEditing`, seeding the edit form for a viewer who can edit); opening it as View does would make two actions identical. **Schedule Meeting** opens the profile with its Add meeting dialog up (`defaultMeetingOpen`). **Open, to investigate before it is built:** on a cached profile the modal and the dialog mount in the same commit, and the dialog may lose Escape, outside clicks or focus to the modal; part 2 Task 3 reproduces it first and opens the dialog one commit later if needed. The pipeline kanban card's Edit Profile has the same fallback and stays out of this spec.

### 5.6 One way to open the customer profile

`openCustomerProfile(props)` (`src/shared/modules/customers/core/lib/open-customer-profile.ts`, new; owner 2026-10-07) wraps `openModal({ accessor: 'CustomerProfile', Component: CustomerProfileModal, props })`; its `props` are the modal's own, so `defaultEditing` and `defaultMeetingOpen` pass straight through. Every caller moves to it, except a file another session holds at build time (it moves later). The `customer-pipelines` components barrel, whose only export is the modal, goes once nothing imports it.

## 6. Dashboard reads

No card, section or layout changes. Only where each read's input comes from.

| Read today | Becomes |
|---|---|
| Meetings calendar: `DASHBOARD_MEETINGS_QUERY` + `extra { liveOnly: true }` | The config gains `fixed: { outcome: LIVE_MEETING_OUTCOMES }`. `DASHBOARD_MEETINGS_EXTRA` goes, and so does the `liveOnly` input on `meetingsRouter.reads.list`. The page prefetch and the hub hook change in the same commit. |
| `activeProjectsInput()`, `onHoldProjectsInput()` | Two configs on `PROJECT_FIELDS` with `fixed: { statusBucket: […], excludePortfolio: true }`, `defaultSort` createdAt desc, `window: { kind: 'first', count: DASHBOARD_LIMITS.projectsPerSection }`; the input is `staticDataViewInput(config)`. |
| `meetingsWindowInput(kind)` | One config per window kind on `MEETING_FIELDS` with `fixed: { outcome: LIVE_MEETING_OUTCOMES }` and a `first` window of `DASHBOARD_LIMITS.meetings`; the day's range is the runtime pin: `staticDataViewInput(config, { scheduledFor: meetingWindow(kind) })`. |
| `awaitingProposalsInput()`, `sentProposalsInput()` | **Unchanged.** Proposals have no field list until R3. |

This replaces the mechanism, not the ruling, of data-view date windows A3 (2026-09-29: "live outcomes via a top-level `liveOnly`"): the calendar still shows live outcomes only.

## 7. Ownership moves (O3)

A component lives with the entity whose tree it renders (D25). Path-only moves; no markup changes. These are existing files, so the meetings list goes where meetings components live today and moves again with the meetings module's path-only move (M2); the projects targets are already at the module address.

| File (under `entities/customers/components/lists/`) | Renders | Goes to |
|---|---|---|
| `customer-meetings-list.tsx` | meeting cards | `entities/meetings/components/` |
| `customer-projects-list.tsx` | project cards | `modules/projects/core/components/` |
| `project-entity-card.tsx` | a project card | `modules/projects/core/components/` |
| `proposal-row.tsx` | a proposal row | **deleted**: no importer; `MeetingProposalRow` replaced it |

The green left border on `project-entity-card.tsx:40` (a known design finding) is left for the profile modal's pending polish pass. The `text-[10px]` finding is gone from the code.

## 8. Error handling and edge cases

- A lead source deleted while its pane is open: the list returns no rows. Today `getCustomers` answers 404; the pane already depends on the source's own read, which reports the missing source.
- A URL that carries a key for a pinned id (an old bookmark) is ignored: the pin wins and no chip shows.
- Two data views on one page still need different prefixes; pins do not change that.
- A `first` window whose `total` exceeds `count` shows only the first rows; nothing pages.

## 9. Later consumers (recorded, not built)

| Consumer | What it still needs |
|---|---|
| **Dashboard proposal sections** | `PROPOSAL_FIELDS` (R3); then the same move as §6. |
| **Customer profile** | A customer filter field on meetings and projects (neither list has one); a ruling on visibility (the profile shows a rep every meeting of a customer they have sat with; the meetings list shows only meetings they sat); a data view whose state is not in the URL, since the profile is a modal over any page. Tables or cards there is deferred by the owner. |
| **Analytics drill-down** | Out of this spec. For that effort: most headline figures are counted in code on person-level rules (merged duplicates, first sit, sale classification) and cannot be written as list filters; the figures' date ranges exclude the end instant while list filters include it; unknown source, city and zip have no filter field; sales are dated by `approvedAt`, which no list filters on. `features/analytics/lib/hygiene-links.ts` already links figures that are plain filters into the records pages by URL. |
| **Any entity table embedded with a row limit** | A `first` window in `useEntityTable` and a `DataTable` without its pagination footer. Built when a surface asks for it. |

## 10. Coordination

- **Order (owner, 2026-10-07; D64):** R2 lands before the #285 permissions merge and before pipeline-speed Phase 2 (action hosts) and Phase 3 (grouped window). #285 (tracker H3; its unit 3 rebuilds the Customer family's permissions) rebases onto R2; the pipeline-speed spec names R2's moved paths and adds its `grouped` kind beside `first`.
- **#285** touches customer files (tracker H3). This spec edits the customers table, its constants and the lead-sources router; check `git status` on each before editing.
- **Dashboard rework (another session, uncommitted on 2026-10-07):** three dashboard files §6 edits hold its work; part 1's dashboard task waits until that session commits.
- **Setter plan** (`docs/superpowers/plans/2026-10-05-meetings-setter.md`) edits `meetings.router/reads.router.ts` (`getInternalUsers`). §6 removes `liveOnly` from the same file's `list`. Build one after the other.
- **Tracker:** H2 still names `loadPaginatedQueryInput` / `usePaginatedQuery`; the hand-off updates it to the data-view names and records O9 as built.

## 11. Verification

- `pnpm tsc` and `pnpm lint` per task. Never `pnpm build`.
- Pure functions by throwaway `node:test` (no runner in the repo): the merge order in `toDataViewInput` (URL value, config pin, runtime pin, date window), a pinned id dropping out of the toolbar and the URL parsers, the `first` window's input, and `staticDataViewInput` equal to the loader's output for an empty URL.
- **Baseline before any change:** screenshots and the row ids of page 1 for the three customers tables and the dashboard sections; the after-state must match them (minus the pane's Source column).
- Browser, read-only: URL keys unchanged; saved column layout survives; the pane shows only its source's customers and sends one `customersRouter.business.list` request; the calendar still hides meetings whose outcome is not live; the dev console shows no hydration-drift error on the three pages.
- No database writes for testing. The created-date edit and delete are checked by code read, or on a customer the owner names.
