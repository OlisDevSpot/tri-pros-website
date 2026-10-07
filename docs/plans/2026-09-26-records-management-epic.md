# Records Management — Epic Tracker

> **Status:** 🔨 **BUILDING.** R0.5 + R1 (meetings) shipped to prod 2026-09-28. Spec `docs/superpowers/specs/2026-09-28-records-bulk-actions-and-entity-tables-design.md` v3 **approved for planning** 2026-09-29. Order per **D59** (amends D49; tables first, bulk last, the setter early): R4 projects (`docs/superpowers/plans/2026-10-01-projects-entity-table.md`, Tasks 1–8 landed; `46360a0f`, `61386d02`, `27e3f713` are local only; browser pass done 2026-10-05, findings A11–A15 in §7; A12–A14 fixed 2026-10-05 (`7b1ecd53`, `7572c341`, local only); 390 px, dark and an agent session passed; the owner's toggle check and A11/A15 calls still open) → B1 the setter, built on local main (`docs/superpowers/plans/2026-10-05-meetings-setter.md`) → R2 customers with fixed filters (next spec, D48, D60) → R3 proposals (D50) → bulk + selection on all four tables → delete the legacy query path. The setter and bulk are based on `docs/superpowers/plans/2026-09-29-records-bulk-actions-setter-projects.md` (partly superseded; reviewed 2026-10-02, open owner decisions marked in it). Rulings D37–D62; O10 (lead-source setters) deferred by D58. The approval rule belongs to the sales lifecycle rules (D38), built in slices beside this epic (D61, §3.2). No gate on other sessions (D19).
> **Started:** 2026-09-24 as "records-table enrichment"; restructured 2026-09-26 around the three-layer model. **This file is the live index**: update it, and cite its IDs in specs, plans and commits.
> **Baseline:** `main` at `b6396b0f`.
> **Goal in one line:** every entity has one **entity table** that defines how that entity is shown, fetched and acted on in a table. Features only configure **table views** of it. Records are browsed and acted on through the `records-management` feature.
> **Evidence:** three parallel code audits on 2026-09-25 (DataTable/entity-actions claims, entity/data claims, layering and conventions), plus two on 2026-09-26 (customer module and import direction, records pages and feature composition). Findings with file:line are summarized in §6.

**Adjacent, owned elsewhere (do not duplicate):**
- The `(records)/` route group was first mentioned as another session's work; **D19** brings it into this epic. See **H1**.
- `docs/plans/2026-09-20-feature-layering-epic.md`: its **F11** (no `@/features/` imports inside meeting-flow) is satisfied for the meetings table by **R1**.
- **#285 permissions** (`refactor/285-…` worktree) touches 16 customer files. That is why the customers module waits (**D12**).
- `docs/superpowers/specs/2026-09-24-wave-4-sow-normalization-design.md`: SOW normalization. Scope coverage matches by scope id today (**D16**); W4's `proposal_sow_scopes.scope_id` keeps that stable.
- The per-entity **field definition** (column + filter + sort in one place): approved as a concept 2026-09-24. It is its own spec (**O4**).

Legend: `[ ]` open · `[x]` done · `[~]` in progress · ⏸ gated.

---

## 1. The model

| Layer | What it is | Owns | Home |
|---|---|---|---|
| **L0 · primitive** | Generic table machinery, entity-agnostic | `DataTable` (+ expandable rows), `ExpandedRowPanel`, `QueryToolbar`, `RecordsPageShell`, `EntityTableView` type | `src/shared/components/` |
| **L1 · entity table** | *The* table for one entity, preconfigured | row type, column registry, filter config, the entity's list read, action configs + their dialogs, in-cell edits. Takes an optional expanded row from the table view (D21). API = headless hook `use<Entity>Table(tableView, options)` + ready component `<Entity>Table` | the entity or module unit, e.g. `src/shared/entities/meetings/components/meetings-table/` |
| **L2 · table view** | A specific configuration of an entity table for one use case | a **static constant** holding everything that affects the query key (`tableId`, `query` config, `columns`) + runtime options (header, injected feature knowledge, the expanded row: orchestration, D21) | the orchestrating feature: `src/features/records-management/` for the dashboard records pages |

**Principle (owner, 2026-09-26):** features orchestrate primitives from `shared/` (modules, entities, components); entities define those primitives. Imports only go features → shared, and shared never imports features.

**Terms:**

| Term | Meaning | Never |
|---|---|---|
| **entity table** | L1 above | "generic table", "base table" |
| **table view** | L2 above: a specific configuration of an entity table | bare "view"; `ui/views/` means a route-level component |
| **records-management** | the feature that hosts the dashboard records pages' table views | — |
| **expanded row** | the region a records-table row click reveals (`renderExpandedRow`) | "opened row", "job ticket" (design-exploration labels) |

---

## 2. Decided (owner)

| ID | Decision | Date |
|---|---|---|
| **D1** | Meetings is the pilot. One row per meeting; no per-customer de-duplication in tables (that belongs to analytics). | 2026-09-24 |
| **D2** | Row click expands and collapses the row; the customer profile opens from the View Meeting action. | 2026-09-24 |
| **D3** | A meeting's proposals are alternatives: **never** total, sum or roll up their values anywhere. | 2026-09-24 |
| **D4** | Entity UI is composed from existing entity compound components and the entity-actions structure, generalized where they don't fit. No bespoke entity markup. | 2026-09-24 |
| **D5** | Phone is first-class: the same scrollable table, with the expanded region pinned to the visible width. | 2026-09-24 |
| **D6** | The expanded-row layout is a shared L0 shell (`ExpandedRowPanel`); each entity writes only its panes. | 2026-09-25 |
| **D7** | `EntityActionMenu` gets no override props. The call site marks primary and promoted actions on the `actions` array, and a new `mode: 'toolbar'` renders them. | 2026-09-25 |
| **D8** | A meeting's proposals are called **Proposals** in UI and code, never "Options". | 2026-09-25 |
| **D9** | Three-layer model (§1): L0 primitive → L1 entity table → L2 table view. Features orchestrate; entities define primitives. | 2026-09-26 |
| **D10** | The term is **table view**. Never a bare "view". | 2026-09-26 |
| **D11** | Records are browsed and acted on **only** through `features/records-management`. Flow features (meeting-flow, proposal-flow, project-management) keep **no** records tables: `PastMeetingsTable` and its configs are deleted when the meetings entity table lands. | 2026-09-26 |
| **D12** | Import-direction fix for customers: `getCustomerProfile`'s DAL moves from `features/customer-pipelines/dal/server/` into `shared/entities/customers/dal/server/` now, marked `// LAZY:` → `modules/customers/core/dal/server`. `modules/customers` is created later by the standard whole-entity path-only move (`entities/customers` → `core`, `customer-notes` → `notes`), **after #285 lands**. A partial module was rejected as split-brain DAL (`dal-conventions.md`). | 2026-09-26 |
| **D13** | `AssignProjectDialog` links a meeting to a project, not a participant. It moves from `features/customer-pipelines` into `shared/entities/meetings/components/`, marked `// LAZY:` → `modules/meetings/core`. The meetings module (units `core` + `participants`; `meeting_participants` is the trigger) is its own later migration. | 2026-09-26 |
| **D14** | Rollout (§3): meetings first, customers next, then proposals, then projects. **No table is moved into records-management before it has its entity table**, so nothing is moved twice. | 2026-09-26 |
| **D15** | **Amended 2026-09-29 by D45:** L1 is the headless hook only. Original: L1 API: a headless hook plus a ready component. A table view that doesn't fit composes the hook. A new prop is added only when a second table view needs it. | 2026-09-26 |
| **D16** | Scope coverage (meeting scopes vs. each proposal's SOW scopes) matches **by scope id**; the customer-profile read stops dropping the ids. | 2026-09-25 |
| **D17** | Clean names win over preserving saved state: a table view's `tableId` follows the entity name (`meetings`, not the legacy `past-meetings`), and saved column layouts may reset. `paramPrefix` keeps the records pattern (`pc`, `pm`, `pp`, `pj`). | 2026-09-26 (revised) |
| **D18** | ~~Execution gate on the other session~~, superseded by **D19**: this epic builds the feature itself. | 2026-09-26 |
| **D19** | This epic owns the `(records)/` route group for the dashboard records pages **and** the `records-management` feature (phase **R0.5**). | 2026-09-26 |
| **D20** | Names approved for now: `ExpandedRowPanel`, "promoted action" (`EntityAction.promoted`), toolbar mode (`mode: 'toolbar'`), Scope coverage (+ CONTEXT.md entry), the "UTM campaign" label. | 2026-09-26 |
| **D21** | **Cross-entity composition is orchestration and lives in features.** Entities keep only their own common components (overview-card compounds, action configs). The meetings expanded row (customer pane + proposals pane + scope coverage) is built in `features/records-management` and passed to the entity table by the table view. Entities do not compose one another. | 2026-09-26 |
| **D22** | **For now**, modules and entities may import other modules and entities (subject to change). So L1 columns may render joined fields from another entity with that entity's display primitives (e.g. the meetings Lead source and Proposals columns). D21 still applies to orchestration: fetching, computing or acting across entities, like the expanded row, lives in features. | 2026-09-26 |
| **D23** | `(records)/` holds **only the four list pages**: `(records)/{customers,meetings,proposals,projects}/page.tsx`. Flow pages stay outside (`meetings/[meetingId]`, `proposals/new`, `proposals/[proposalId]`, `projects/new`, `projects/[projectId]`). URLs don't change; no group `layout.tsx`; **H1** is avoided rather than patched. Next.js allows it: groups are stripped from the URL, and only groups resolving to the *same* URL conflict. | 2026-09-26 |
| **D24** | Programs don't appear in the meetings entity table. The subtitle is `meetingType` only, with no program lookup. Programs and applications belong to the proposals module, owned by the proposal-applications work. | 2026-09-26 |
| **D25** | **An entity owns its component tree.** A component belongs to the entity whose tree it renders, not to the entity that happens to use it. Example: `MeetingProposalRow` is a meetings component (the meeting card reaches its proposals through its compound `MeetingOverviewCard.Proposals`); customers only uses it. It moves from `entities/customers/components/lists/` to `entities/meetings/components/` in R1. | 2026-09-26 |
| **D26** | Meetings table trims (after R1): the Lead source column and pane show the name only, no status dot (clutter). No UTM campaign or other ad data in the meetings table or its expanded row: ad attribution is ops data, not agent-facing. No trade thumbnails. | 2026-09-27 |
| **D27** | Accessibility follow-ups (row-named expand label, region role, pane heading level, error live region) are deferred. | 2026-09-27 |
| **D28** | Next order: O4 field definition spec (with O7 as its first consumer) → R2 customers → O8 bulk actions brainstorm. | 2026-09-27 |
| **D29** | The field definition (O4) is **not a table concept**. Filtering and sorting an entity's data is a data-access concept in `shared/dal`; the filter/sort UI is a general `shared/components` component pluggable into any data view (table, calendar at `/dashboard/schedule`, pipelines), with server prefetch parity kept. Approach A (one field list per entity; consumers type-checked against it). Role-gated filters (e.g. Rep, Lead source) come later from #285's CASL; for now all filters are open to everyone and the intended gate is recorded. Runs as its **own effort in a separate session**; seed: `docs/plans/2026-09-27-data-view-filtering-research.md` (incl. the owner-approved meetings field list v1). R2 waits for it. | 2026-09-27 |
| **D30** | Panel edge cases (2026-09-27): a failed profile read hides only the Customer and Proposals panes (Trades stays); a meeting with no customer says how many proposals it has and to link a customer; scope coverage is null when the meeting captured no scopes (no all-"+ Added" chips); coverage chips don't trigger the card's open-proposal click; "Sent" dates outside the current year show the year. The page fade between list pages is not restored. Next session: O8 bulk-actions brainstorm + migrating customers, proposals and projects to entity tables with expanded-row panels (whether that waits on D29's filtering system is the first question there). | 2026-09-27 |
| **D31** | **Split against D29's filtering effort** (supersedes D28's order). **Premise superseded 2026-09-29 (D37):** filtering landed first, and `EntityTableView` needs a field list, so R3/R4 move proposals and projects onto field lists. Original text: R3 proposals and R4 projects migrate now with their current filters: the filtering spec keeps their legacy query path byte-identical, and its only touch is the mechanical `sortable` → `sort` change in their column registries, which follows the registries wherever they move. R2 customers waits for the filtering spec's phase 4 (`listCustomers` + the three customer tables on `useDataViewQuery`), which already does R2's read convergence; R2 then builds the entity table on top. O3's ownership audit and the two `project-entity-card.tsx` findings don't depend on filtering and run before R2. O8 bulk actions are designed now; "select all N matching" reuses each list read's own input schema and condition builder, so it follows the filtering effort's input changes without waiting. | 2026-09-27 |
| **D32** | **Setter** (appointment setter) is the one term everywhere for the user, often a dispatcher, who booked a meeting; the field is `meetings.setBy` (analytics Spec D, not built). Never "closedBy", "closer" or "createdBy". The meetings records table gets a bulk "set setter" (O8), which lands on Spec D's column. | 2026-09-27 |
| **D33** | **Bulk actions v1 (O8).** Ticked rows only (one page, ≤100), super-admin only; every row runs through the entity's own `crud.delete` / `crud.update` so per-row hooks fire; bulk delete skips risky rows and reports them. Meetings: Delete (skips a meeting with any proposal or application) + Set setter (pick or clear). Proposals: Delete (skips non-`draft` or contract started: `contractEnvelopeId` / `contractSentAt`). Projects: Delete (skips public-on-portfolio or meeting-linked) + Show / Hide on portfolio. Customers (with R2): Delete (skips any meeting or project). Not bulk: reschedule, outcome with reason, start, create proposal, assign to project, view, duplicate. "Select all N matching" is not built until an action needs it. `meetings.set_by` (nullable FK → user, set null) is pulled forward from analytics Spec D into this effort, independent of `ownerId`; + single-row Set setter action + hidden Setter column (super-admin). Setter filter handed to the filtering effort's meetings field list. | 2026-09-27 |
| **D34** | **Superseded 2026-09-29 by D39 (server) and D40 (client).** **Bulk mechanics + names (O8).** `DataTable` takes controlled `rowSelection` / `onRowSelectionChange` (TanStack names) keyed on entity ids; a leading checkbox column (header = select page) appears only when the viewer can run ≥1 bulk action; checkbox clicks never toggle expansion; selection clears on page/size/sort change and drops ids that leave the data. **`BulkActionBar`** lives in `shared/components/entities/entity-actions/ui/` (owner: entity-generic, not data-table) and renders **`EntityBulkActionConfig`** (`{ action, onRun(ids), isLoading }`, same CASL `permission`). Entity hook **`use<Entity>BulkActionConfigs`** owns its confirm/picker dialogs; `use<Entity>Table` owns selection and returns the bar. Server: a **`bulk`** sub-router per entity router (`meetingsRouter.bulk.delete`, `.setSetter`), `{ ids: uuid[1..100] }`, rows run one at a time through the entity crud; returns **`BulkActionResult`** `{ done, skipped: { id, reason }[], failed }`. Action id `setSetter`, label "Set setter". Campaign leads moves onto the same selection + bar; its queued-job procedures stay. | 2026-09-27 |
| **D35** | **Moved out 2026-09-29 (D38):** redesigned in its own session; this text is the rejected v1. **Approving a proposal is a server rule (phase R3a, before R3).** One proposals mutation `approve` (via a service) is the only way to reach `approved`; the status cell, `contracts.service` (e-signed `completed`) and `AssignProjectDialog` all call it, and the generic `crud.update` refuses `status: 'approved'`. If the proposal's meeting has no project, the project is created first from the logic extracted out of `projectsRouter.business.create` (defaults: title `{customer} - {city}`, description = the proposal's SOW scope labels, no duration; editable on the project page) and the meeting's outcome becomes `converted_to_project`; if the meeting already has a project, the approval is **additional work** and the outcome becomes `additional_work` (existing derived outcome). A meeting with an approved proposal has a **derived, locked** outcome: the picker disables every option and the server refuses outcome writes other than the derived one. Project owner under the contract webhook = the meeting's owner participant. `CreateProjectModal` + `CreateProjectForm` are **deleted**, not moved. Stale by design once built: `entities/meetings/DOCS.md:121,245` and `modules/proposals/core/DOCS.md#conversion-trigger` ("approval only unlocks"). | 2026-09-27 |
| **D36** | **Proposals table shows contract state** (owner): today the Status column is the proposal's own status (draft/sent/approved/declined) and the contract appears nowhere. The proposals entity table gets a contract column built on `contractSentAt` and the proposals expanded row shows the contract's sent / viewed / signed / declined dates. | 2026-09-27 |
| **D37** | **Build order (revised 2026-09-29):** the data-view filtering plan landed first (`d4821450..b7e3df8e`); the bulk + R3 + R4 spec rebases on field lists and `useDataViewQuery`. (2026-09-28 text: this spec builds before filtering.) | 2026-09-29 |
| **D38** | **The approval rule leaves this epic** (owner): proposal approval, contract approval, project creation, the meeting-outcome lock and proposal status are one interconnected cluster, redesigned from the foundation in its own grill/brainstorm session with existing primitives (project creation = `projectCrud.create` + create hooks; value-based outcome lock; no thin `ensure…` helpers; no project form on approval). Handoff: `docs/plans/2026-09-29-approval-project-outcome-handoff.md`. R3's status cell and Approve action wait for it. Supersedes D35. | 2026-09-29 |
| **D39** | **Bulk server = one runner** (owner): pure `runBulk` (dedupe, sequential, `DalReturn` → done / skipped / failed) under two procedure builders on `superAdminProcedure`: `<entity>Router.bulk.delete` (facts read + skip classification in the leaf config) and `.bulk.update({ ids, data })` (the update schema picked to an allowed-field list: meetings `setBy`, projects `isPublic`). No per-verb procedures, no sixth `createCrudRouter` slot. `BulkActionResult<TReason>` = `{ done, skipped: { id, reason }[], failed: { id, error, reason? }[] }`. | 2026-09-29 |
| **D40** | **`DataTable` owns selection** (owner): one prop `bulkActions?: EntityActionConfig<RowSelection>[]` (`RowSelection = { ids, clear }`); the checkbox sits in the frozen primary cell beside the chevron (no leading column); selection clears with expansion and prunes by derivation; `BulkActionBar` is chrome around `EntityActionMenu mode="toolbar"`, mounted by `DataTable` above pagination. No `EntityBulkActionConfig`. Action configs gain `hidden?(entity)`, applied with the CASL permission in one helper. | 2026-09-29 |
| **D41** | **Campaign leads migrates fully** (owner: legacy, change it without defensive code): per-page selection like every table (its cross-page `Set` goes), four bulk configs (Enroll as a `custom` picker), hand-rolled cell/header/bar deleted; its queued procedures stay. | 2026-09-29 |
| **D42** | **Setter rules** (owner): ~~a duplicate clears `setBy` (fresh sit)~~ a duplicate copies `setBy`: "it's still their lead" (owner, 2026-10-02); a reschedule copies it (same sit); "Set by" goes on every add-a-meeting form. Candidates = dispatcher, agent, super-admin; `setBy` must be an internal user (meetings crud hooks). The Setter filter and sort join `MEETING_FIELDS` in this effort (the filtering plan shipped without them). | 2026-09-29 |
| **D43** | **Bulk is super-admin only; single-row actions keep their existing permissions** (owner: some deletions are allowed to other roles). Single-row Show / Hide on portfolio = `update Project`, matching the edit form. | 2026-09-29 |
| **D44** | **Expanded-row corrections** (owner agreed): pure `getContractState` + badge (not `get-status-badge` / `AgreementTimeline`); new `ProposalOverviewCard.Scopes`; proposal actions keep their real names (Copy link (email / SMS)), "Assign rep" dropped; projects: primary Open project = `edit`, `view` relabelled View on site (public only); no lead-source line in proposals/projects customer panes. | 2026-09-29 |
| **D45** | **Entity table = the per-entity headless hook only** (owner, after a deletion-test analysis): `use<Entity>Table(tableView, options)` → `{ query, visibility, dataTableProps, dialogs }`; no per-entity or generic ready component (layout is what varies per callsite; the hook holds the wiring that would otherwise be copied, as the three customers tables copy it today). `MeetingsTable` is deleted; records views compose `RecordsPageShell` + `QueryToolbar` + `DataTable`. The table view constant is the callsite's customization. Amends D15. | 2026-09-29 |
| **D46** | **Proposals and projects move onto field lists** (`PROPOSAL_FIELDS`, `PROJECT_FIELDS`; `EntityTableView.query` requires one). R4 projects is built now; R3 proposals is planned and built after the approval session (D38). | 2026-09-29 |
| **D47** | **Set by on `CreateMeetingForm`:** a viewer who can `assign Meeting` (super-admin) picks from setters (default self, "No setter" allowed); agents and dispatchers see "Set by: you" read-only and send their own id. No server default ~~(a duplicate stays empty, D42)~~: that reason lapsed when D42 was amended 2026-10-02 (a duplicate copies the setter); whether to add a server default is an open owner decision in the bulk plan. | 2026-09-29 |
| **D48** | **R2 customers is the next spec**, built on the entity-table hook (D45); not folded into the bulk spec. | 2026-09-29 |
| **D49** | **Amended 2026-10-05 by D59:** the setter runs right after R4, ahead of the other tables; bulk and selection stay last. **Tables first, bulk last** (supersedes the 2026-09-29 plan's B1→B5 order): projects (plan Tasks 11–13, corrected) → customers (R2) → proposals (R3) → setter + bulk + selection across all four tables at once → delete the legacy query path (`usePaginatedQuery` / `loadPaginatedQueryInput` / `fromPaginatedQuery`). Row selection reaches each memoized `DataTableRow` as a prop (like `isExpanded`); no row or cell reads `row.getIsSelected()` while rendering. | 2026-10-01 |
| **D50** | **Proposals entity table builds now**, before the approval session (amends D38/D46). The status cell keeps today's approve-then-create-project behaviour unchanged, moved into the entity table hook as the one place the approval session later replaces. No Approve action in the expanded row until then. | 2026-10-01 |
| **D51** | **No customer pane in expanded rows** (owner, meetings change 2026-10-01): the customer shows in the table's first column instead. Projects follows: its list read joins the customer for a customer column; the planned shared `RecordCustomerPane` is not built. | 2026-10-01 |
| **D52** | **Superseded 2026-10-05 by D60** (fixed filters are designed in R2; all three views converge). **Lead-source customers table view: deferred.** How it pins `sourceId` on the shared customers list (generic fixed filters, O9, vs a one-off `leadSourceId` input) is undecided; until then it keeps `leadSourcesRouter.getCustomers`. R2 converges the records page and the lead-sources "all customers" table view. | 2026-10-01 |
| **D53** | **An unpicked setter is the meeting's creator** (owner): the add-meeting form lets a super-admin pick; otherwise the meetings crud records whoever created the meeting. A duplicate keeps the source's setter, `null` included. Amends D47 ("no server default"). | 2026-10-02 |
| **D54** | **Only super-admins change a setter, for now** (owner). The meetings crud refuses a `setBy` update from anyone without `assign Meeting`; this takes the update half of H5 out of #285. Single-row Set Setter is a `hidden` rule (shown where the row carries `setBy`), not an opt-in. | 2026-10-02 |
| **D55** | **Routers reach a module through its service** (owner): writes through its CRUD slots, reads through `<m>Service.queries.*`. | 2026-10-02 |
| **D56** | **The setter is meetings-only; intake carries none in the bulk plan** (owner). Lead-source setters are their own design (O10). The bulk plan's settlements 1–13 and its names are approved. | 2026-10-02 |
| **D57** | **Campaign leads stays on `usePaginatedQuery`** (owner: partly legacy, leave it alone for now). D49's last step deletes only what no caller uses. | 2026-10-02 |
| **D58** | **External setters: deferred, kept possible** (owner: "we're building a flow we don't need yet"; only in-house dispatchers today). Nothing is built for them now and nothing is removed: a lead source's public form keeps booking meetings through `formConfigJSON.mode = 'customer_and_meeting'` and `closedByOptions`, and the pick stays as free text in `leadMetaJSON.closedBy` for a later backfill. Shape agreed for when it is built (O10): a `lead_source_setters` child table (ADR 0005 amendment); a meeting records `set_by` (in-house user) **or** `external_setter_id`, never both (CHECK); a lead source's list holds external setters only; `closedByOptions` / `closedBy` migrate into it, which is when analytics D6's rename happens. In-house work must stay additive to that: `set_by` remains a nullable user FK, and the setter column, filter and pickers read through one place each. | 2026-10-02 |
| **D59** | **The setter moves ahead of bulk** (owner; amends D49). `meetings.set_by`, the internal-user rule, Set by on every add-a-meeting form, the Setter column, filter and sort, and the single-row Set Setter run as their own small plan right after R4 lands (the bulk plan's Tasks 1–3 plus the Set Setter parts of its Task 9). Reason: meetings have no created-by column, so a booking made before `set_by` ships has no recorded setter and can only be guessed later; analytics Spec D waits on it. Bulk Set Setter still arrives with bulk. Order: R4 → B1 setter → R2 → R3 → bulk + selection → delete the legacy query path. | 2026-10-05 |
| **D60** | **Fixed filters (O9) are designed inside the R2 customers spec** (owner; amends D52). R2 converges all three customers table views, the lead-source one included. The design must serve four reuse targets (owner: all four): lead-source pages (a pinned source), analytics drill-down (a figure's date range, source and outcome pinned), the customer profile (one customer's meetings, proposals and projects; compact, no toolbar) and the agent dashboard (short lists: a row limit, no pagination). Layout stays the callsite's (D45); the spec settles what the table view constant and the query config must carry for each. | 2026-10-05 |
| **D61** | **Three lanes run side by side** (owner): tables (this tracker), the setter (D59) and the sales lifecycle rules (`docs/plans/2026-10-01-sales-lifecycle-rules-map.md`, that effort's tracker). The lifecycle rules are specced and built slice by slice (guards → outcome policy → approval route → project links → backfill and figures), not as one spec after the whole grill. Where the slices meet this epic: §3.2. Small corrections (§7 A4–A6, the data-view follow-ups, stale doc lines) go as one fix-up batch; A7–A10 are measured first. | 2026-10-05 |
| **D62** | **R2's scope** (owner, after the 2026-10-05 audit). A fixed filter belongs to the data view, not to the table (D29): the config's `fixed` for static pins, a hook argument for runtime ones, plus a first-rows window (`kind: 'first'`). R2 builds that, the customers entity table, the lead-source pane on the shared customers list (`getCustomers` goes) and the dashboard's meetings and project reads on the same mechanism, cards unchanged. **Deferred:** whether the dashboard and the customer profile show tables or keep cards. **Out of R2:** analytics drill-down (most figures are counted in code on person-level rules and cannot be written as list filters; the spec's §9 records the findings). Narrows D60's four reuse targets to what the audit showed each can take today. | 2026-10-05 |

---

## 3. Rollout

| Phase | Scope | Status |
|---|---|---|
| **R0** | Meetings spec rewritten to the model (covers R0.5 + R1), then a 17-task plan; both deleted after ship. | [x] |
| **R0.5** | `(records)/` route group for customers, meetings, proposals, projects + the `records-management` feature skeleton. Resolves **H1** first. | [x] shipped locally 2026-09-27; owner verified checks 2 and 8 (picker changes, proposal delete → panel + row refresh) |
| **R1** | Meetings entity table (L1). `MEETINGS_RECORDS_TABLE_VIEW` and the meetings expanded row in records-management (D21). `PastMeetingsTable` deleted. Meeting-flow's only remaining `@/features/` import is the pre-existing `to-calendar-event.ts` → schedule-management. | [x] shipped locally 2026-09-27; owner verified checks 2 and 8 (picker changes, proposal delete → panel + row refresh) |
| **B1** | The setter (D59): `meetings.set_by`, the internal-user rule, Set by on every add-a-meeting form, Setter column, filter and sort, single-row Set Setter. Owner-run `db:push:dev`; `db:push:prod` before the deploy. | [x] built on local main b14be068..63766d12 [`b14be068`, `21e0021d`, `ab1c57d2`, `f70ab119`, `63766d12`]; prod needs db:push:prod before the deploy. Open: the owner's own write check (Set Setter → a dispatcher → "Setter updated"; "No setter" → "—"; a duplicate keeps "—"; an add without touching "Set by" records the super-admin); at 390 px the Set Setter picker fits beside the row menu but is about 141 px wide (owner's design call); `pnpm db:push:prod` before the deploy |
| **R2** | Customers entity table (hook only, D45) with fixed filters (O9, D60). Its three near-identical table views (records page, lead-sources-admin "all customers", "lead-source customers") converge. The lead-source table view becomes a `leadSourceId` scope on the customers list read instead of `leadSourcesRouter.getCustomers`. | [ ] spec written 2026-10-05: `docs/superpowers/specs/2026-10-05-customers-entity-table-and-fixed-filters-design.md`; plan written 2026-10-05 in two parts, `docs/superpowers/plans/2026-10-05-customers-entity-table-and-fixed-filters.md` (data-view pins, `first` window, dashboard reads) and `…-part-2.md` (the hook, three views, §5.5, moves); owner reviews both and their "Owner confirms" lists before the build (D48, D60, D62) |
| **R3a** | ~~Proposal approval server rule (D35)~~ → moved to its own session (D38, handoff doc). | moved |
| **R3** | Proposals onto a field list (`PROPOSAL_FIELDS`); entity table + table view + expanded row, contract column (D36, D44); bulk delete (D33). Status cell + Approve per the approval session (D38). | [ ] after the approval session (D46) |
| **R4** | Projects onto a field list (`PROJECT_FIELDS`); entity table + table view + expanded row; Show / Hide on portfolio; bulk delete + visibility. The portfolio pages stay in project-management. | [x] built on local main 59b99fc3..61386d02 (shared table hook + records page, meetings moved onto them; projects entity table with customer and status columns, expanded row with sales history, optimistic portfolio toggle; empty values sort last; bulk moves to the all-tables bulk plan, D49) |
| **B2–B4** | Bulk server (`runBulk`, `bulk.delete` / `bulk.update`), selection + `BulkActionBar`, bulk actions on all four tables (Set Setter included), campaign leads' selection. Then the legacy query path goes (D49, D57). | [ ] last; re-planned once R2 and R3 exist; after the lifecycle guards slice (§3.2) |
| **M1** | `modules/customers` path-only promotion (after #285), plus the remaining `features/customer-pipelines/dal/*` files. | [ ] |
| **M2** | `modules/meetings` path-only promotion (`core` + `participants`); `assignToProject` / `getCustomerProjects` move from `customerPipelinesRouter` to `meetingsRouter` ("entity owns its mutations"). | [ ] |

**Acceptance for every entity table:** each existing table view of that entity is expressible as `{ table view constant + header }` plus, at most, a scope input on the entity's own list read.

### 3.1 Shared table adoption ledger

Every `DataTable` caller, and what it still needs before it matches the shared structure. The shared structure is:

- the read is on a field list, so it goes through `useDataViewQuery`;
- the table goes through the shared hook, `useEntityTable`;
- a records page goes through `EntityRecordsTable`, while a table embedded in another page keeps its own layout and uses only the hook;
- row actions sit under the meta key `rowActions`.

The hook, the records page and `rowActions` arrive with the projects plan (`docs/superpowers/plans/2026-10-01-projects-entity-table.md`, Tasks 2–3). A row is done when every column reads `[x]` or `n/a`.

Check the ledger against the code with:

```bash
grep -rln "<DataTable" src/features src/shared/entities src/shared/modules
```

Every file listed must have a row here. A row is done when its file uses `useEntityTable`.

| Table view | File | Field-list read | Shared hook | Records page | `rowActions` | Owner |
|---|---|---|---|---|---|---|
| Meetings records | `features/records-management/ui/components/meetings-records-table.tsx` | [x] | [x] | [x] | [x] | projects plan Tasks 2–3 (file is deleted; replaced by `meetings-records-table.tsx`) |
| Projects records | `features/records-management/ui/components/projects-records-table.tsx` | [x] | [x] | [x] | [x] | projects plan Tasks 2, 4–5 (file is deleted) |
| Customers records | `shared/entities/customers/components/customers-table.tsx` | [x] | [ ] | [ ] | [x] (Task 2 renamed the key) | R2 |
| Lead sources: all customers | `features/lead-sources-admin/ui/components/all-customers-section.tsx` | [x] | [ ] | n/a (embedded) | [x] (Task 2) | R2 |
| Lead sources: one source's customers | `features/lead-sources-admin/ui/components/lead-source-customers-section.tsx` | [~] reads `leadSourcesRouter.getCustomers`; R2 makes it a `leadSourceId` scope on the customers list | [ ] | n/a (embedded) | [x] (Task 2) | R2 |
| Proposals records | `features/proposal-flow/ui/components/table/index.tsx` | [ ] still on `usePaginatedQuery` + `fromPaginatedQuery` | [ ] | [ ] | [x] (Task 2) | R3 |
| Campaign leads | `features/campaigns-admin/ui/views/campaigns-leads-view.tsx` | n/a: stays on `usePaginatedQuery` (D57) | [ ] | n/a (admin view) | n/a (no row actions) | stays as is (D57) |

When R2 or R3 lands, tick its rows here in the same commit.

### 3.2 Where the lifecycle rules meet the tables

The sales lifecycle rules are built in slices in their own lane (D61; slices in `docs/plans/2026-10-01-sales-lifecycle-rules-map.md` §0). Only these points order work across the two lanes:

| Point | Tables side | Lifecycle side | Order |
|---|---|---|---|
| Proposals status cell | R3 keeps today's approve-then-create-project behaviour in one place in the entity table hook (D50) | The approval-route slice replaces that one place and adds the `cancelled` and `amended` statuses | R3 does not wait |
| Status pickers | `StatusDropdownCell` takes a yes/no (`isStatusDisabled`); the meetings outcome cell and the proposals status cell both use it | The outcome-policy slice needs a reason per disabled option | Widened once, in the outcome-policy slice; both tables inherit it |
| Bulk delete | D33's skip rules are a stricter callsite policy (e.g. a meeting with any proposal) | The guards slice makes each entity's crud refuse unsafe deletes (a meeting holding an approved proposal, an approved or envelope-bearing proposal, a project with linked meetings) | Guards land before bulk, so a row never "fails" where it should "skip" |
| Share-link writes | none | In the guards slice; also in the security hotfix batch (a link holder can write `status`) | May ship ahead as a hotfix |

---

## 4. Open

| ID | Question | Recommendation |
|---|---|---|
| **O1** | ~~Other session's scope~~ → **D19**. | closed |
| **O2** | ~~Names~~ → **D20**. | closed |
| **O3** | ~~Entity↔entity composition~~ → **D21** (no; orchestration lives in features). Clarified by **D25** (ownership): using another entity's components is fine (D22); what matters is that each component lives with the entity whose tree it renders. `MeetingProposalRow` is corrected in R1. Other components under `entities/customers/components/lists/` (e.g. `customer-meetings-list`, `project-entity-card`) get audited for ownership when customers reaches R2. At that audit, also resolve the two pre-existing design-hook findings on `project-entity-card.tsx`: the green left side-tab border (L46) and `text-[10px]` (L69). | closed |
| **O5** | ~~Column line~~ → **D22**. Was: where is the line for **columns**? The meetings list read already joins `leadSource` and `proposalStatuses` onto the meeting row. Is rendering those in the meetings column registry with the other entity's display primitive (lead-source card, proposal status dot colors) allowed in L1, or is it orchestration? | closed |
| **O6** | ~~Route group shape~~ → **D23**. Was: does `meetings/[meetingId]` (the meeting flow, not a records page) sit inside `(records)/` or outside it? The same question applies to the detail and new pages of proposals and projects. | closed |
| **O4** | Per-entity field definition → **D29**: a cross-view filtering/sorting effort (shared/dal + shared/components), run in its own session; meetings field list v1 in the seed research doc. | in progress elsewhere |
| **O7** | ~~The owner's 2026-09-24 filter ruling is unbuilt~~ → built with the filtering work: `MEETING_FIELDS.meetingType` is a multi-select filter and a sort (`entities/meetings/dal/meeting-fields.ts`). | closed |
| **O8** | **Designed 2026-09-29 (D39–D43; spec v2).** Row selection + bulk actions (original epic goal; out of scope for R1). Agreed mechanics: TanStack `rowSelection` on the entity-id row ids R1 added; "select all N matching" sends the filter input server-side, never an id list; replaces the hand-rolled Set in campaigns-admin leads. Unanswered: which bulk actions each entity offers. | Brainstorming 2026-09-27 (D31), meetings first. |
| **O9** | **Fixed filters for reused entity tables** (D45): a feature embedding an entity table with filters it sets itself (analytics "these meetings" by its own date range, source, outcome) needs callsite-fixed filter values in `DataViewQueryConfig` (today `extra` only adds top-level input like `{ id }`). ~~Designed when a caller asks.~~ Designed inside the R2 customers spec for four reuse targets: **D60**. | in the R2 spec (D60) |
| **O10** | **Lead-source setters** (owner, 2026-10-02): a lead source can also create or confirm meetings, so a public intake form can add meetings. A meeting's setter is an in-house user or an external setter belonging to the lead source. **Owner answers (2026-10-02):** (1) an external setter is a record kept with its lead source, not a user account; (2) in-house setters are mostly dispatchers, but anyone who can book may be one (`SETTER_ROLES` as built); (3) on the public form the person filling it picks from their lead source's list. **Found in code:** most of this exists under the retired name: `formConfigJSON.mode = 'customer_and_meeting'` already lets a lead source's public form create meetings, `formConfigJSON.closedByOptions: string[]` is the per-source list, and the pick lands as free text in `customers.leadMetaJSON.closedBy` (analytics tracker D6 plans the rename, H6 the backfill). ADR 0005's 2026-07-14 amendment places a 1:many list that meetings reference and filters read in a child table, not a JSONB array. Shape settled and build deferred: **D58**. | deferred (D58) |

---

## 5. Hazards

- **H1:** `src/features/meeting-flow/ui/components/meeting-splash-mount.tsx:25` checks `useSelectedLayoutSegments()[0] === 'meetings'`. Under a `(records)/` route group the first segment becomes `(records)`, so the meeting splash silently stops rendering. The route-group work must filter `(…)` segments or switch to `usePathname`, or keep `meetings/[meetingId]` outside the group.
- **H2:** hydration. Every key-relevant part of a table view (prefix, page size, sort, filters, scope) must be the static constant both the page's `loadPaginatedQueryInput` and the client's `usePaginatedQuery` import (`query-toolkit.md#shared-table-config`). Runtime props must never change the key.
- **H3:** #285 overlaps the customer files; see D12 and M1.
- **H4:** a route group must not add its own `layout.tsx` (`app-shell.md#dashboard-layout-shape-fixed`), or it remounts the sidebar.
- **H5:** **agents can write `meetings.setBy`.** Agents hold `update` on Meeting with no field limit (`abilities.ts:96`), so the generic `crud.update` accepts `setBy` from them; dispatchers too (`abilities.ts:169`), and `createCrudRouter.create` has no field check at all, so both can set it at create. The meetings crud invariant (D42) bounds it to internal users. The setter UI is super-admin only, but the server does not gate it. **#285 owns the fix** (agent permission rules ship there; owner ruling 2026-09-27): add the `setBy` field exclusion for agents and dispatchers. This effort deliberately adds no permission rows. **Update half settled by D54 (2026-10-02):** the meetings crud refuses a `setBy` update without `assign Meeting`; an agent or dispatcher naming someone else at create stays #285's.
- **H6:** **an urgent context change above a page during hydration flashes its skeleton.** React 19 schedules work on every Suspense boundary still hydrating under a provider whose value changes, even under a nested provider of the same context. A data view waiting on its streamed rows then drops the server HTML and shows its pending view. Seen 2026-10-01 on meetings, where the server rows showed, then the skeleton, then the rows again; the root `AbilityProvider` (session lands) and `SidebarProvider` (phones, `useIsMobile`) were the triggers. Rule: a provider above dashboard pages changes after hydration only inside a transition or `useDeferredValue`.

---

## 6. Evidence and owed clean-up

**`// LAZY:` markers this epic introduces** (each names its migration target):
- `shared/entities/customers/dal/server/` profile read → `modules/customers/core/dal/server` (M1)
- `shared/entities/meetings/components/assign-project-dialog.tsx` → `modules/meetings/core` (M2)

**Import-direction gate (R0.5 + R1, 2026-09-27):** meeting-flow's only remaining `@/features/` import is `lib/to-calendar-event.ts` → `@/features/schedule-management/types`, predating this work. `src/shared` still imports `@/features/` only from the pre-existing `cta.tsx`. `customer-pipelines.router.ts` no longer imports `get-customer-profile` from `features/`.

**Found in audit, owed elsewhere:**
- `customer-pipelines.router.ts:4-7` imports four DAL files from `features/customer-pipelines/dal/` (`dal-conventions.md#dal-lives-under-entities-never-features`). The profile read is fixed by D12; the other three go in M1.
- Raw `db` in routers: `customer-pipelines.router.ts` (`getRecordingUrl`, `getCustomerProjects`) and `customers.router/business.router.ts:16`.
- Imports between features that reach past a feature's public entrypoint: proposal-flow → `customer-pipelines/.../create-project-modal` (R3) and proposal-flow → `meeting-flow/lib/build-proposal-defaults`. There is also a meeting-flow ↔ schedule-management import cycle.
- `shared/components/cta.tsx:6-7` imports `features/landing` forms (the only shared → features import).
- DataTable's mobile `activeRowId` is written but never read.
- The dead `schedule-management/.../activities-table.tsx` (never mounted).

**Stale docs flagged (not fixed):**
- `entity-frontend.md:8`: says a registry drives `EntityActionMenu`; none exists.
- `entity-frontend.md:225`: says customers already has an overview card; it doesn't.
- `entity-frontend.md:235`: says the menu owns its dialogs; the consumer renders them.
- `ubiquitous-language.md:131`: lists lead source as an enum; it's a table.
- `frontend-stack.md#no-barrel-files-in-ui`: contradicts the public-entrypoint barrels in memory Rule 10.
- memory `coding-conventions.md`:
  - Rule 12 says routers may import feature DAL, which `dal-conventions.md` contradicts.
  - Rule 22 says column definitions are feature-level, but every registry lives in an entity or module.

**Artifacts:**
- Studies: https://claude.ai/artifact/K2KD9CWhVk6fNKpC3T9PCp (v3 = A1).
- Research: `docs/plans/2026-09-24-expandable-table-rows-research.md`.
- Session memory: `project-records-table-enrichment.md`.

---

## 7. Actions

From the records-table render isolation build (local main `6896b1d4..6fd3a3e8`, 2026-10-01; owner hand-checks passed 2026-10-01). Legend as above.

**Owner**
- [x] **A1** Rotate `DEV_LOGIN_SECRET`. It was printed once into a subagent's tool output; the probe now redacts it. Rotated 2026-10-01 in every local `.env.local` (main + worktrees). Not checked: whether Vercel preview also sets it (production 404s the route regardless).
- [x] **A2** Push `6896b1d4..6fd3a3e8`, plus the double-skeleton fix (H6). On `origin/main` as of 2026-10-05 (`6fd3a3e8` and `ce741671` are ancestors).
- [ ] **A3** The push is done: delete the plan and spec (`docs/superpowers/plans|specs/2026-10-01-records-table-render-isolation*.md`, both tracked) and the gitignored workspace `.superpowers/sdd/2026-10-01-records-table-render-isolation/`. Keep the before/after numbers from its `acceptance.md` somewhere first if they are still wanted.

**Code**
- [ ] **A4** `ReadOnlyParticipantSummary` still sends one `getParticipants` per row for viewers who can't assign meetings (about 20 requests on every load, invalidation and focus refetch). It should render from the row's owner snapshot, as the picker does while closed.
- [ ] **A5** `withLatestCallbacks` (`src/shared/lib/stable-callbacks.ts`) finds an array entry's latest callbacks by its index, not by `action.id`. A wrapper kept across a change in the list's shape would fire the wrong action. No caller keeps one today.
- [ ] **A6** `useStableCallbacks` writes its latest-closure ref in `useLayoutEffect`, so a child's layout effect that calls a wrapper still sees the previous closure. `useInsertionEffect` would close that gap.

**Re-measure, then decide** (deferred by the spec; run `node scripts/perf/records-probe.mjs <path>`)
- [ ] **A7** Narrow `useInvalidation`'s router-level `pathFilter()`.
- [ ] **A8** Trim what `meetingsRouter.reads.list` selects per row (`flowStateJSON`, `contextJSON` and notes ship with every row).
- [ ] **A9** `next/dynamic` for the customer profile, participants and assign-project modals.
- [ ] **A10** The list SQL: correlated proposal subqueries; no index on `meetings.customer_id` / `scheduled_for`.

From the projects table browser pass (2026-10-05, read-only, light scheme, 1440 px; evidence in `.superpowers/sdd/2026-10-01-projects-entity-table/acceptance.md`). Passed: both render probes (expand and collapse re-render one row; modal open and close none), every sort on meetings and projects, empty values last, the four filters, the failed portfolio toggle putting the row back with a toast and writing nothing, clicks inside a row never toggling it, a no-customer project sending no sales-history request.

- [ ] **A11** A stale sort id with a direction (`?pj_sort=isPublic&pj_dir=asc`) loads the default field in that direction, not the default order. `deriveFilterSortState` (`dal/lib/query/derive-data-view-input.ts:67-68`) parses the id and the direction separately, and after parsing an unknown id cannot be told from "default field, direction flipped". Accept it, or keep the raw id so an unknown one resets both.
- [x] **A12** **A calendar-picked date range drops its end day, on every table.** `date-range-filter-control.tsx:60-62` sends the picked end day's local midnight and the server compares `<=`, so rows later that day are left out (Created Sep 1–16 returned none of two Sep 16 projects). Quick ranges send the end of the day and are right. On prod. **Fixed 2026-10-05, `7b1ecd53`** (local only): the picked end day ends with `endOfDay`, as the quick ranges do; Sep 1–16 now returns the two Sep 16 projects, and the URL round-trips to the same tiles and label. Carries to prod with the projects table push.
- [x] **A13** The projects table's Project column is 150 px wide (`PROJECT_COLUMNS.title` sets no `size`), so titles cut to about eight characters. **Fixed 2026-10-05, `7572c341`:** `size: 260`, as the customers table's primary column (same `PrimaryCell`); 6 of 20 titles still cut at 1440 px instead of 15. At 390 px the pinned column takes 260 of 356 px, as customers does — owner's look.
- [x] **A14** The projects skeleton row is 52.5 px (`use-projects-table.tsx`); real rows measured 51.5 px and 49.5 px (measured with another session's theme edits in the tree). **Fixed 2026-10-05, `7572c341`:** re-measured the same without the theme edits; the two heights are a project with a description (two-line Project cell, 51.5) and one without (set by the two-line Created cell, 49.5). The skeleton is `h-[51.5px]`, the common row. The running dev server's CSS did not pick the new class up (the dev CSS staleness note); a fresh `.next` or the prod build does.
- [ ] **A15** A hard reload shows the route's pending skeleton for about 0.3 s before the server rows, on projects and meetings alike (the shared loading route). Owner's call whether that counts as a flash.
- [ ] **A16** ~~Still owed for the projects table: 390 px width, dark scheme, an agent-role session, and~~ the owner's real portfolio toggle on a project they name. 390 px, dark and an agent session passed 2026-10-05 after A12–A14 (evidence `.superpowers/sdd/2026-10-01-projects-entity-table/fix-pass-*`). Seen on the way, not fixed: an agent gets "Show on Portfolio" in the bar and the row menu (owner's call whether agents should); in the 1440 px expanded panel the meeting card's Participants column wraps its heading and cuts names to "Sean …".
