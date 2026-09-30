# Records Management — Epic Tracker

> **Status:** 🔨 **BUILDING.** R0.5 + R1 (meetings) shipped to prod 2026-09-28. Spec `docs/superpowers/specs/2026-09-28-records-bulk-actions-and-entity-tables-design.md` v3 **approved for planning** 2026-09-29 (O8 bulk, setter, R4 projects now; R3 proposals after the approval session, D46). **Plan:** `docs/superpowers/plans/2026-09-29-records-bulk-actions-setter-projects.md` (15 tasks: B1–B5, B7 partial; execution method pending). Rulings D37–D48. The approval rule has its own session (D38). R2 customers is the next spec (D48). No gate on other sessions (D19).
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
| **D42** | **Setter rules** (owner): a duplicate clears `setBy` (fresh sit); a reschedule copies it (same sit); "Set by" goes on every add-a-meeting form. Candidates = dispatcher, agent, super-admin; `setBy` must be an internal user (meetings crud hooks). The Setter filter and sort join `MEETING_FIELDS` in this effort (the filtering plan shipped without them). | 2026-09-29 |
| **D43** | **Bulk is super-admin only; single-row actions keep their existing permissions** (owner: some deletions are allowed to other roles). Single-row Show / Hide on portfolio = `update Project`, matching the edit form. | 2026-09-29 |
| **D44** | **Expanded-row corrections** (owner agreed): pure `getContractState` + badge (not `get-status-badge` / `AgreementTimeline`); new `ProposalOverviewCard.Scopes`; proposal actions keep their real names (Copy link (email / SMS)), "Assign rep" dropped; projects: primary Open project = `edit`, `view` relabelled View on site (public only); no lead-source line in proposals/projects customer panes. | 2026-09-29 |
| **D45** | **Entity table = the per-entity headless hook only** (owner, after a deletion-test analysis): `use<Entity>Table(tableView, options)` → `{ query, visibility, dataTableProps, dialogs }`; no per-entity or generic ready component (layout is what varies per callsite; the hook holds the wiring that would otherwise be copied, as the three customers tables copy it today). `MeetingsTable` is deleted; records views compose `RecordsPageShell` + `QueryToolbar` + `DataTable`. The table view constant is the callsite's customization. Amends D15. | 2026-09-29 |
| **D46** | **Proposals and projects move onto field lists** (`PROPOSAL_FIELDS`, `PROJECT_FIELDS`; `EntityTableView.query` requires one). R4 projects is built now; R3 proposals is planned and built after the approval session (D38). | 2026-09-29 |
| **D47** | **Set by on `CreateMeetingForm`:** a viewer who can `assign Meeting` (super-admin) picks from setters (default self, "No setter" allowed); agents and dispatchers see "Set by: you" read-only and send their own id. No server default (a duplicate stays empty, D42). | 2026-09-29 |
| **D48** | **R2 customers is the next spec**, built on the entity-table hook (D45); not folded into the bulk spec. | 2026-09-29 |

---

## 3. Rollout

| Phase | Scope | Status |
|---|---|---|
| **R0** | Meetings spec rewritten to the model (covers R0.5 + R1), then a 17-task plan; both deleted after ship. | [x] |
| **R0.5** | `(records)/` route group for customers, meetings, proposals, projects + the `records-management` feature skeleton. Resolves **H1** first. | [x] shipped locally 2026-09-27; owner verified checks 2 and 8 (picker changes, proposal delete → panel + row refresh) |
| **R1** | Meetings entity table (L1). `MEETINGS_RECORDS_TABLE_VIEW` and the meetings expanded row in records-management (D21). `PastMeetingsTable` deleted. Meeting-flow's only remaining `@/features/` import is the pre-existing `to-calendar-event.ts` → schedule-management. | [x] shipped locally 2026-09-27; owner verified checks 2 and 8 (picker changes, proposal delete → panel + row refresh) |
| **R2** | Customers entity table (hook only, D45). Its three near-identical table views (records page, lead-sources-admin "all customers", "lead-source customers") converge. The lead-source table view becomes a `leadSourceId` scope on the customers list read instead of `leadSourcesRouter.getCustomers`. | [ ] next spec (D48) |
| **R3a** | ~~Proposal approval server rule (D35)~~ → moved to its own session (D38, handoff doc). | moved |
| **R3** | Proposals onto a field list (`PROPOSAL_FIELDS`); entity table + table view + expanded row, contract column (D36, D44); bulk delete (D33). Status cell + Approve per the approval session (D38). | [ ] after the approval session (D46) |
| **R4** | Projects onto a field list (`PROJECT_FIELDS`); entity table + table view + expanded row; Show / Hide on portfolio; bulk delete + visibility. The portfolio pages stay in project-management. | [ ] |
| **M1** | `modules/customers` path-only promotion (after #285), plus the remaining `features/customer-pipelines/dal/*` files. | [ ] |
| **M2** | `modules/meetings` path-only promotion (`core` + `participants`); `assignToProject` / `getCustomerProjects` move from `customerPipelinesRouter` to `meetingsRouter` ("entity owns its mutations"). | [ ] |

**Acceptance for every entity table:** each existing table view of that entity is expressible as `{ table view constant + header }` plus, at most, a scope input on the entity's own list read.

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
| **O7** | The owner's 2026-09-24 filter ruling is unbuilt: "Fresh vs project" filters on **`meetings.meetingType`** (Fresh / Follow-up / Rehash / Project), not the pipeline axis. `MEETING_FILTER_CONFIG` still offers only Outcome, Scheduled and **Pipeline**. | Make it the first consumer of the O4 field definition. |
| **O8** | **Designed 2026-09-29 (D39–D43; spec v2).** Row selection + bulk actions (original epic goal; out of scope for R1). Agreed mechanics: TanStack `rowSelection` on the entity-id row ids R1 added; "select all N matching" sends the filter input server-side, never an id list; replaces the hand-rolled Set in campaigns-admin leads. Unanswered: which bulk actions each entity offers. | Brainstorming 2026-09-27 (D31), meetings first. |
| **O9** | **Fixed filters for reused entity tables** (D45): a feature embedding an entity table with filters it sets itself (analytics "these meetings" by its own date range, source, outcome) needs callsite-fixed filter values in `DataViewQueryConfig` (today `extra` only adds top-level input like `{ id }`). Designed when a caller asks. | open |

---

## 5. Hazards

- **H1:** `src/features/meeting-flow/ui/components/meeting-splash-mount.tsx:25` checks `useSelectedLayoutSegments()[0] === 'meetings'`. Under a `(records)/` route group the first segment becomes `(records)`, so the meeting splash silently stops rendering. The route-group work must filter `(…)` segments or switch to `usePathname`, or keep `meetings/[meetingId]` outside the group.
- **H2:** hydration. Every key-relevant part of a table view (prefix, page size, sort, filters, scope) must be the static constant both the page's `loadPaginatedQueryInput` and the client's `usePaginatedQuery` import (`query-toolkit.md#shared-table-config`). Runtime props must never change the key.
- **H3:** #285 overlaps the customer files; see D12 and M1.
- **H4:** a route group must not add its own `layout.tsx` (`app-shell.md#dashboard-layout-shape-fixed`), or it remounts the sidebar.
- **H5:** **agents can write `meetings.setBy`.** Agents hold `update` on Meeting with no field limit (`abilities.ts:96`), so the generic `crud.update` accepts `setBy` from them; dispatchers too (`abilities.ts:169`), and `createCrudRouter.create` has no field check at all, so both can set it at create. The meetings crud invariant (D42) bounds it to internal users. The setter UI is super-admin only, but the server does not gate it. **#285 owns the fix** (agent permission rules ship there; owner ruling 2026-09-27): add the `setBy` field exclusion for agents and dispatchers. This effort deliberately adds no permission rows.

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
