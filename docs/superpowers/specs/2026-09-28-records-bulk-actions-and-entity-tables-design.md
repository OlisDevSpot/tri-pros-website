# Records bulk actions, setter, proposals and projects entity tables — design

> **Status:** v3, **approved for planning** 2026-09-29 (owner: "go with recommendations for all questions"). v1 (2026-09-28) was stress-tested against the code by eight read-only audits and revised with the owner's rulings (tracker D38–D48). The proposal-approval rule left this spec for its own session (`docs/plans/2026-09-29-approval-project-outcome-handoff.md`, D38). Only the setter slice is built (plan below); the rest is not.
> **Cites:** records-management tracker `docs/plans/2026-09-26-records-management-epic.md` (D2, D3, D4, D5, D11, D15, D21, D22, D25, D32, D33, D36, D38–D48, O8, O9, H5); analytics tracker `docs/plans/2026-09-26-analytics-epic.md` (Spec D, C20, D6); multi-proposal tracker C67 (`pre-draft` deferred), C68 (`business` child).
> **Setter plan:** `docs/superpowers/plans/2026-10-05-meetings-setter.md` (built).
> **Code read** at `b7e3df8e` (data-view filtering Tasks 1–20 and final fixes landed); the `DataTable` split (`data-table-body.tsx`) landed in `2495d193`.

---

## 1. Goals, non-goals, success criteria

**Goals**
- Super-admins tick rows in a records table and run a bulk action on them; every row goes through the entity's own write path.
- Meetings record their **setter** (`meetings.setBy`): captured on every add-a-meeting form, editable one at a time or in bulk, filterable and sortable by super-admins.
- Projects now, and proposals after the approval session, move onto field lists (like meetings and customers) and get an entity table, a records table view and an expanded row.
- Campaign leads drops its hand-rolled selection for the shared one.

**Non-goals**
- Proposal approval, contract approval, project creation, the meeting-outcome lock and proposal status transitions: their own session (D38, handoff doc). R3 (B6) is built after it (D46).
- "Select all N matching": the agreed mechanic stands for the first action that needs it (send the filter input, never an id list).
- Customers (R2): unblocked (filtering phase 4 landed); it is the next spec, on the entity-table hook (D48). Its bulk delete rule is recorded (§5.1).
- Permission rows. H5 goes to #285. Single-row actions keep their current permissions (D43).
- Setter backfill, `ownerId`'s fate, retiring the intake `closedBy` JSONB keys: analytics Spec D (D3, D4, D6).
- Moving campaign leads onto a field list (only its selection moves).
- Reassigning owners in bulk; bulk outcome or reschedule.
- The project media manager's floating bar (`project-media-manager.tsx:350-416`): not a table, numeric ids, portaled; it stays.

**Success criteria**
- A super-admin ticks meetings, proposals, projects or campaign leads and runs each action in §5.1; skipped rows are reported with their reason; agents and dispatchers see no checkboxes.
- Every add-a-meeting surface records a setter per §4.4; duplicating and rescheduling a meeting both keep its setter (owner, 2026-10-02: "it's still their lead").
- The projects records page (and, with B6, the proposals one) runs on `useDataViewQuery`. `PortfolioProjectsTable`, `ProjectDetailSheet`, `MeetingsTable` and the projects legacy query/filter configs are gone; `project-management` keeps no records table (D11). B6 does the same for `PastProposalsTable` and `proposal-flow`.
- `pnpm tsc` and `pnpm lint` are clean.

---

## 2. Vocabulary

**Agreed (tracker D32, D39–D44):**

| Term | Meaning | Code |
|---|---|---|
| **setter** | The appointment setter: the user, often a dispatcher, who booked the meeting. Never "closedBy", "closer", "createdBy" | `meetings.setBy` |
| **bulk action** | An action run on the ticked rows of a table: an ordinary action config whose entity is the selection | `EntityActionConfig<RowSelection>` |
| `RowSelection` | The selection a bulk action receives | `{ ids: string[], clear(): void }` |
| `BulkActionBar` | The floating "N selected · actions · Clear" bar | `shared/components/entities/entity-actions/ui/bulk-action-bar.tsx` |
| `runBulk` | The one bulk runner | `shared/dal/server/lib/run-bulk.ts` |
| `BulkActionResult` | What a bulk procedure returns | `{ done: string[], skipped: { id, reason }[], failed: { id, error, reason? }[] }` |
| `bulk` sub-router | An entity router's bulk procedures | `<entity>Router.bulk.delete`, `.update` |
| **entity table** | The per-entity headless hook that wires an entity's field list, columns, actions, dialogs and bulk actions into `DataTable` props; no ready component (D45) | `use<Entity>Table(tableView, options)` → `{ query, visibility, dataTableProps, dialogs }` |
| Set setter | Action id `setSetter` | — |
| Show on portfolio / Hide from portfolio | Action ids `showOnPortfolio` / `hideFromPortfolio` | `PROJECT_ACTIONS` |
| View on site | The existing `PROJECT_ACTIONS.view`, relabelled (it already opens the public portfolio page) | — |

**Proposed here, confirm at review:**
- `bulkDeleteProcedure` / `bulkUpdateProcedure`: the two procedure builders in `src/trpc/lib/bulk-procedures.ts`.
- `PROPOSAL_FIELDS` / `PROJECT_FIELDS` and their `*_FIELD_SQL` (named after `MEETING_FIELDS`).
- `hidden?(entity)`: a predicate on action configs, applied with the CASL `permission`.
- `getContractState` (pure) and its badge; `ProposalOverviewCard.Scopes`.
- `RecordCustomerPane`; `useCustomerProfile`; `InternalUserPicker` (the user search list extracted from `ParticipantPickerContent`).
- `getInternalUsers` input `{ purpose: 'participant' | 'setter' }`; option source `setters`; `SETTER_ROLES`.
- Bulk skip reasons: `hasProposals`, `hasApplications`, `notDraft`, `locked`, `onPortfolio`, `linkedToMeeting`, `notFound`; customers later `hasMeetingsOrProjects`.

---

## 3. Phases

| Phase | Contents | Gate to next |
|---|---|---|
| **B1 Setter** | `meetings.set_by`; setter candidates read + `setters` option source; internal-user invariant; duplicate/reschedule rules; `setterName` read; `setter` field (filter + sort); Set by on every add-a-meeting form | tsc/lint; owner runs `db:push:dev` |
| **B2 Bulk server** | `runBulk`; the two procedure builders; `bulk` leaves for meetings, proposals and projects with their facts reads | tsc/lint; pure runner checks |
| **B3 Selection + bar + meetings UI** | `DataTable` selection; `hidden` + the permitted-actions helper; `BulkActionBar`; meetings bulk configs; single-row Set setter; Setter column; `MeetingsTable` deleted (the records view composes the shell, D45) | meetings bulk works in the browser |
| **B4 Campaign leads** | selection → `DataTable`; four actions as bulk configs; hand-rolled pieces deleted | its four actions work |
| **B5 Projects (R4)** | `PROJECT_FIELDS` + `listProjects` on it; entity table, table view, expanded row, portfolio actions | records page works; sheet + old table deleted |
| **B6 Proposals (R3)** | `PROPOSAL_FIELDS` + `listProposals` on it; entity table, table view, expanded row, contract column | built **after the approval session** (D46); planned then |
| **B7 Hand-off** | legacy query helpers deleted once their last caller goes; stale deprecation text; tracker and glossary rows | — |

B1–B5 and B7's projects half are planned now; B6 is planned after the approval session. Other sessions commit to `main` concurrently; each phase commits by explicit path, only as the owner authorizes.

---

## 4. The setter

### 4.1 Column

`setBy: text('set_by').references(() => user.id, { onDelete: 'set null' })` on `meetings`, nullable, independent of `ownerId`. drizzle-zod carries it into the insert, update and select schemas as nullable-optional, so `crud.create` / `crud.update` and the router inputs accept it with no schema edit (`db/schema/meetings.ts:64-75`, `lib/server-spec.ts:11`).

`setBy` is not a Google Calendar field: an update enqueues no calendar job (`meetings/dal/server/crud.ts:84-87`); the per-row Ably publish still fires (`:106-108`).

### 4.2 Candidates and the invariant

- **Setter roles:** dispatcher, agent, super-admin (derived from the CASL ability, not written out as role strings). The system owner (`getSystemOwnerId`) is excluded.
- **Read:** the candidates come from `getInternalUsers({ purpose: 'setter' })` (agents, super-admins and dispatchers, never the system owner). `meetingsRouter.reads.getInternalUsers` gains an optional input `{ purpose: 'participant' | 'setter' }`. With no input it returns what it returns today (agent + super-admin), so the participant picker, the `reps` option source and analytics labels are unchanged. Its query moves out of the router into the users DAL as `listUsersByRoles(roles)` (the router queried `db` directly before the setter build). The guard stays `assign Meeting` (super-admin).
- **Option source:** `setters` → `getInternalUsers({ purpose: 'setter' })`, `canRead: assign Meeting` (`shared/dal/client/constants/option-source-reads.ts`).
- **Invariant (entity rule):** a non-null `setBy` must be a user whose role is in `SETTER_ROLES`. Checked in the meetings crud `create.before` (after owner resolution) and `update.before` (when `data.setBy !== undefined`), for every origin (the rule runs on every create and update, whatever the caller), through a new users DAL read `getUserRoleById`. Violation throws `ThrowableDalError({ type: 'precondition-failed', reason: 'set_by_not_internal' })` (`dalToTrpc` → PRECONDITION_FAILED).

### 4.3 Reads, filter, sort

- `listMeetings` (`meetings/dal/server/queries.ts:83`): `setBy` arrives through `...getTableColumns(meetings)`. `setterName` needs a second user join: `setterUser = alias(user, 'setter_user')`, exported from `meeting-field-sql.ts` (the sort map lives there) and joined in `listMeetings`. `MeetingListRow` gains `setterName`.
- `MEETING_FIELDS` gains `setter: { label: 'Setter', filter: multiSelect({ schema: z.string().min(1), source: 'setters' }), sort: true }`; SQL `where: v => inArray(meetings.setBy, v)`, `orderBy: setterUser.name`. The filter hides itself for viewers whose `setters` source fails `canRead`. `MEETINGS_RECORDS_TABLE_VIEW.toolbar` gains `'setter'`. No "No setter" option in v1 (a runtime source can't carry a static value today).

### 4.4 Writes

| Path | Setter |
|---|---|
| **Duplicate** (`crud.ts:132-151`) | `'setBy'` stays off `duplicate.exclude`, so the engine copies it: the lead is still the setter's (owner, 2026-10-02; earlier text had a duplicate clear it as a fresh sit). |
| **Reschedule** (`meetings.router/business.router.ts:120-131`) | `setBy: original.setBy`: the same sit. |
| **`CreateMeetingForm`** (`shared/entities/meetings/components/create-meeting-form.tsx`) — pipeline kanban drag to "meeting scheduled", kanban card "Schedule Meeting", customer profile "Add meeting", customer meetings tab "Add Meeting" | (D47) A viewer who can `assign Meeting` (super-admin) gets a `SetterPicker` (default self, "No setter" allowed); agents and dispatchers see "Set by: you" read-only and send their own id. An unpicked setter is the creator (D53). Only super-admins change a setter (D54). |
| **Lead-sources admin "Add customer"** (`add-customer-sheet.tsx:90-128`, super-admin) | Leaves this spec (D56): the setter is meetings-only; `createFromIntake` and `ingestLead` are untouched. |
| **Public partner intake** (`/intake`, `IntakeFormView`, no session) | Leaves this spec (D56): `setBy` stays null; the free-text `closedBy` JSONB stays until Spec D6. External setters are deferred (D58). |
| Single-row and bulk Set setter | §4.5, §5 |

**Known gap (H5, #285):** agents and dispatchers hold `update Meeting` with no field limit, and `createCrudRouter.create` has no field check, so either can write `setBy` through generic crud on create. The update half is closed (D54: `update.before` refuses `setBy` from a viewer without `assign Meeting`); the create half stays with #285. The invariant bounds it to internal users. No permission rows here.

### 4.5 UI

- **Setter column** in `MEETING_COLUMNS`: `defaultHidden: true`, `permission: ['assign', 'Meeting']`, sort id `setter`.
- **Single-row "Set setter"** (`MEETING_ACTIONS.setSetter`, permission `['assign', 'Meeting']`): a `custom` action whose `renderContent` shows `SetterPicker` (over `UserCommandItem`, "No setter" first), writing through `meetingCrud.update` (`meetingsRouter.crud.update`). It lives in `useMeetingActionConfigs` with `hidden: entity => entity.setBy === undefined`: it shows on the records table and the dashboard's meeting card (both read full rows) and stays out of the schedule calendar, the customer-profile and project meeting lists and the kanban cards, whose rows do not carry `setBy`.
- **`SetterPicker` and `SetterSelect`** (the form's trigger around the picker), both built on `UserCommandItem`, replace the earlier `InternalUserPicker` extraction from `ParticipantPickerContent`; `AvailableParticipantRow` now composes `UserCommandItem` too.

---

## 5. Bulk actions

### 5.1 Rules (D33, D43)

Ticked rows of the current page only (≤ 100). Bulk is **super-admin only**; single-row actions keep their existing permissions. Every row runs through the entity's own `crud.delete` / `crud.update`, one at a time, so per-row hooks fire.

| Entity | Bulk actions | Bulk delete skips a row when… |
|---|---|---|
| Meetings | Delete · Set setter (pick or clear) | it has a proposal (`hasProposals`) or an application (`hasApplications`) |
| Proposals | Delete | status isn't `draft` (`notDraft`), or `getProposalLockState(p) !== 'unlocked'` (`locked`) |
| Projects | Delete · Show on portfolio · Hide from portfolio | `isPublic` (`onPortfolio`), or a meeting links to it (`linkedToMeeting`, `hasAssociatedMeeting()`) |
| Campaign leads | Enroll · Remove · Disqualify · DNC | — (its own queued procedures, §9) |
| Customers (R2, later) | Delete | it has any meeting or project (`hasMeetingsOrProjects`) |

Why: a deleted meeting leaves its proposals with no customer (`proposals.meeting_id` is `set null`; proposals have no `customer_id`) and cascades its applications. A non-draft or enveloped proposal is a customer's live link or backs a project; the lock ladder (`proposal-lock.ts`) is the one rule for "enveloped". A public project disappears from the website; a meeting-linked project is sales history.

The skip rule is bulk-delete policy: it lives in the bulk leaf's config (a callsite rule). Facts reads return facts. Proposal-foundations Task 7 later makes `proposals.meeting_id` `ON DELETE RESTRICT` and has the meetings `delete.before` refuse a meeting with proposals; the facts read still classifies first, so such a row is `skipped`, not `failed`. The applications epic may change the `hasApplications` clause.

**Known leaks (follow-ups, not fixed here):** a proposal delete leaves its media in R2 (`proposals/core/dal/server/crud.ts:73`); a customer delete cascades its projects past their R2 purge.

### 5.2 Server: one runner (D39)

**`runBulk`** (`src/shared/dal/server/lib/run-bulk.ts`, pure — no `db`):

```ts
export const BULK_MAX_IDS = 100

export interface BulkActionResult<TReason extends string = never> {
  done: string[]
  skipped: { id: string, reason: TReason | 'notFound' }[]
  failed: { id: string, error: DalError['type'], reason?: string }[]
}

export async function runBulk<TReason extends string = never, TOut = void>(
  ids: readonly string[],
  steps: {
    classify?: (id: string) => TReason | 'notFound' | null
    run: (id: string) => Promise<DalReturn<TOut>>
  },
): Promise<{ result: BulkActionResult<TReason>, outputs: TOut[] }>
```

It dedupes ids and runs them in order. A `classify` hit is skipped. `run` returns `DalReturn` (crud never throws): `not-found` → skipped `notFound`; any other error → `failed` with its type and `precondition-failed` reason; a throw → `failed` `unknown-error`.

**Procedure builders** (`src/trpc/lib/bulk-procedures.ts`), both on `superAdminProcedure`:
- `bulkDeleteProcedure({ crud, idSchema, facts, classify })`: input `{ ids: z.array(idSchema).min(1).max(BULK_MAX_IDS) }`; loads facts once, indexes them by id (a missing id → `notFound`), classifies, runs `crud.delete(ctx, { id })`.
- `bulkUpdateProcedure({ crud, idSchema, updateSchema, fields, afterRun? })`: input `{ ids, data: updateSchema.pick(fields) }`, refined non-empty (an empty patch is an engine no-op that would count as done); runs `crud.update(ctx, { id, data })`; `afterRun(rows)` after the loop.

They are not a sixth `createCrudRouter` slot (its five slots are a fixed, type-checked contract). The deferred hook-skipping `crud.bulk` (`docs/plans/2026-08-12-crud-dal-mutation-interface-extension.md`) stays deferred: this runner is the path where hooks fire per row.

**Per entity** (a `bulk.router.ts` leaf, composed into the entity router's `index.ts` as `bulk`):

| Entity | `crud` | delete facts | update |
|---|---|---|---|
| Meetings | `meetingCrud` | NEW `getMeetingBulkDeleteFacts(ctx, ids)` → `{ id, hasProposals, hasApplications }` (meetings DAL) | `fields: ['setBy']`; the invariant runs in `update.before` |
| Proposals | `proposalService` | existing `getProposalsByIds` (`proposals/core/dal/server/queries.ts:276`) | — |
| Projects | `projectCrud` | NEW `getProjectBulkFacts(ctx, ids)` → `{ id, isPublic, hasMeeting }` (projects DAL, `hasAssociatedMeeting()`) | `fields: ['isPublic']`; `afterRun` revalidates `/portfolio/projects/<accessor>` (the single-row router does it at `projects.router/crud.router.ts:65`) |

**Duration.** Rough sequential cost per 100 rows: meeting delete 8–25 s (prefetch, GCal job publish, delete), meeting setter update 7–20 s (role read, Ably publish), proposal delete 1–2 s, project delete 15–60 s (R2 purge per media file), project visibility 1–2 s. The project is on Vercel Hobby with Fluid Compute, where every function's default and maximum duration is 300 s (Vercel docs, "Duration limits"), so the tRPC route needs no `maxDuration`.

### 5.3 L0: `DataTable` owns selection (D40)

- **Prop:** `bulkActions?: EntityActionConfig<RowSelection>[]`. Selection state lives in `DataTable` next to expansion. Checkboxes render only when at least one action passes the permitted-actions helper (§5.4).
- **Checkbox:** inside the frozen primary cell, beside the expand chevron (the `colIdx === 0` composition, now in `data-table-body.tsx`), with `stopPropagation` and a label-wrapped hit area for phone (D5). The header's first cell gets a tri-state "select page" checkbox (`ui/checkbox.tsx` needs an indeterminate state). No leading column: the frozen column stays the primary one, with no sticky offsets and no `colSpan` change.
- **Clearing:** in the same render-phase block that resets expansion (page, page size, sort; `data-table.tsx:332-339`). Ids that leave `data` (filter, search, refetch) are pruned by derivation (selection ∩ current row ids), not by an effect.
- **Rows:** `data-state="selected"`; the frozen cell's opaque overlay gets the selected tint.
- **`onRowClick`:** gains the interactive-element guard the expand path already has, so a checkbox click never opens campaign leads' drawer.
- **Bar:** `DataTable` mounts `BulkActionBar` between the scroller and the pagination footer, inside a `relative` box, and pads the scroller's bottom while it shows.

### 5.4 Entity actions

- `RowSelection` and an optional `hidden?: (entity) => boolean` on the click, select and custom config types (`entity-actions/types.ts`). One `lib/` helper filters by CASL `permission` and `hidden`; `EntityActionMenu`, `EntityActionDropdown`, the two schedule-calendar copies and `DataTable`'s gate all use it (four hand copies today). `hidden` applies before primary/promoted selection, so a hidden action leaves the promoted slot.
- **`BulkActionBar`**: count, motion enter/exit with `useReducedMotion`, Clear, and `EntityActionMenu mode="toolbar"` over the permitted `EntityActionConfig<RowSelection>[]` (wraps; custom actions appear under More). `ToolbarButton` honours `destructive`.
- **Per entity:** bulk mutations live in `use<Entity>Actions` beside their single-row twins. `use<Entity>BulkActionConfigs` returns `{ bulkActions, dialogs }` (a sibling of `use<Entity>ActionConfigs`, so its other consumers don't load bulk). Confirms are opened with the selection's count ("Delete 12 meetings? Meetings with proposals or applications are skipped."). One pure `formatBulkActionResult` builds the toast ("Deleted 12 · skipped 3 (has proposals) · 1 failed"). After a run the selection clears and the entity invalidator runs (`invalidateMeeting()` etc.; projects also `landingProjects`).

### 5.5 L1 / L2

`use<Entity>Table` adds `bulkActions` to `dataTableProps` and the bulk dialogs to `dialogs`. Table views configure nothing for bulk (bulk never touches the query key).

---

## 6. Proposals entity table (R3) — built after the approval session (D46)

- **Field list:** `PROPOSAL_FIELDS` + `PROPOSAL_FIELD_SQL` in `shared/modules/proposals/core/dal/`, ported from `proposal-table-filter-config.ts` and `listProposals`' filter and sort closures, with a tie-breaker. Dashboard-only filters (`awaitingSignature`, `sentNoContract`) become `fixedOnly`; `sentRecency` / `contractSentAt` become sort fields; the unused `customerId` / `meetingId` filters go; a `viewCount` sort is added (today it silently falls back to `createdAt`). `listProposals` takes `fieldListInput(PROPOSAL_FIELDS, { pagination: true })` with `buildSearchWhere` (escaped). The agent dashboard builders (`dashboard-queries.ts`, `dashboard/page.tsx:20-21`) move to the new input. The page prefetches with `loadDataViewQueryInput`.
- **Row read adds:** rep name and image (join `user` on `ownerId`); source meeting `scheduledFor`, `meetingType`, `meetingOutcome` (`meetings` is already left-joined). The agent dashboard reads the same rows.
- **L1:** the `useProposalsTable(tableView, { renderExpandedRow })` hook in `shared/modules/proposals/core/components/proposals-table/` (no ready component, D45). The registry stays at `core/lib/columns-registry.tsx`, typed with `SortId<typeof PROPOSAL_FIELDS>`, exporting `ProposalColumnKey`; it keeps the inline `createdAt` edit and customer name → profile modal.
- **Contract column (D36):** `getContractState(proposal)` (pure, `core/lib/`) from `contractEnvelopeId` and the four contract timestamps: signed > declined > viewed > sent, `none` without an envelope (recall and discard clear only `contractEnvelopeId` and `contractSentAt`, `contracts.service.ts:99-104,131-136`, so later timestamps linger). Its badge sits beside `getEnvelopeStatusBadge`, reusing `REQUEST_STATUS_CONFIG`.
- **Status cell:** as the approval session defines it.
- **L2:** `PROPOSALS_RECORDS_TABLE_VIEW` (`tableId: 'proposals'`, prefix `pp`), `ProposalsRecordsView` (composes `RecordsPageShell` + `QueryToolbar` + `DataTable` from the hook), `proposal-row-panel/` in `features/records-management/`. Row click expands (D2).
- **Expanded row:**
  - Action bar: primary **View proposal** (`PROPOSAL_ACTIONS.view`); promoted **Copy link (email)** (`shareByEmail`) and **Approve** (hidden once approved; behaviour per the approval session); More: Edit, Copy link (SMS), Duplicate, Delete. "Assign rep" is dropped: it only navigates to the editor.
  - Details: status · kind · price · rep · created · sent · views (count, last viewed) · source meeting (date, type, outcome).
  - Panes: **Customer** (`RecordCustomerPane`, no lead-source line) · **Contract** (state badge plus sent / viewed / signed / declined dates as detail rows; "No contract sent" when none; `AgreementTimeline` is homeowner-facing and stays untouched) · **Scope and price** (`ProposalOverviewCard.Value` + new `ProposalOverviewCard.Scopes`, without the card root's open-on-click and its own action configs). Not `SectionFinancialsSummary` (agent-only cost/margin, tied to `priceDisplayMode`).
  - `map-proposal-row-to-card-data.ts` moves from `features/agent-dashboard/lib/` to `shared/modules/proposals/core/lib/` (the dashboard importer is repointed); the `sowSummary` derivation it duplicates with `get-customer-profile.ts:120-134` becomes one helper.
- **Deleted:** `features/proposal-flow/ui/components/table/`, `proposals-table-query-config.ts`, `proposal-table-filter-config.ts`. Both importers of the `customer-pipelines` `CustomerProfileModal` barrel (the table and `proposal/heading.tsx:3`) repoint to `@/shared/entities/customers/components/profile/customer-profile-modal`.

---

## 7. Projects entity table (R4)

- **Field list:** `PROJECT_FIELDS` + `PROJECT_FIELD_SQL` in `shared/modules/projects/core/dal/`: status bucket, visibility, completed date, created date, and `excludePortfolio` as `fixedOnly` (agent dashboard), with a tie-breaker. `listProjects` takes the exported `projectListInputSchema`, replacing the hand-mirrored `ProjectListInput` (`queries.ts:183-195`) and the `inferRouterInputs` workaround (`agent-dashboard/constants/dashboard-queries.ts:20-24`); search is escaped. The page prefetches with `loadDataViewQueryInput`.
- **L1:** the `useProjectsTable(tableView, { renderExpandedRow })` hook in `shared/modules/projects/core/components/projects-table/` (no ready component, D45); registry typed with `SortId<typeof PROJECT_FIELDS>`, exporting `ProjectColumnKey`.
- **Actions:**
  - New `PROJECT_ACTIONS.showOnPortfolio` / `hideFromPortfolio`, hidden by `isPublic`, permission `['update', 'Project']` (agents already toggle Public on the edit form, `basic-info-fields.tsx:147-166`), through `projectsRouter.crud.update` (which revalidates).
  - Primary **Open project** = the existing `edit` (the dashboard page). `view` is relabelled **View on site** and hidden unless public. `ProjectEntityCard`'s overrides are unchanged. The unused `PROJECT_ACTIONS.duplicate` stays.
- **L2:** `PROJECTS_RECORDS_TABLE_VIEW` (`tableId: 'projects'`, prefix `pj`), `ProjectsRecordsView` (composes `RecordsPageShell` + `QueryToolbar` + `DataTable` from the hook; keeps the old table's "New Project" header button), `project-row-panel/`. Row click expands (D2).
- **Expanded row:**
  - Action bar: primary **Open project**; promoted Show / Hide on portfolio and **View on site** (when public); More: Delete.
  - Details: public or draft · status · pipeline stage · city, state · completed date.
  - Panes: **Customer** (`RecordCustomerPane`, profile read lazily; a project with no customer shows none) · **Trades and scopes** (`scopeIds` resolved with `useConstructionCatalog` + `resolveScopes`) · **Sales history** (from the same profile read: `projects[].meetings[].proposals[]`, `get-customer-profile.ts:228-245`, composed from `MeetingOverviewCard` + `MeetingProposalRow` as `ProjectEntityCard` does; approved first; no totals, D3).
- **Deleted:** `features/project-management/ui/components/table/`, `project-detail-sheet.tsx` (its double delete confirm collapses to the action config's one), `projects-table-query-config.ts`, `project-table-filter-config.ts`. Portfolio pages stay in project-management.

---

## 8. Shared pieces

- **Entity table = hook only (D45, amends D15).** `use<Entity>Table(tableView, options)` returns `{ query, visibility, dataTableProps, dialogs }`; every callsite composes its own layout (`RecordsPageShell` + `QueryToolbar` + `DataTable` on records pages; a section elsewhere). `MeetingsTable` (37 lines, one caller) is deleted and `MeetingsRecordsView` composes the shell. The table view constant is the callsite's customization (default sort, columns, toolbar filters, page size, URL prefix), static for prefetch parity (H2). Another feature reusing an entity table with filters it fixes itself (analytics "these meetings") needs **fixed filters** in `DataViewQueryConfig`: tracker O9, designed when a caller asks.
- **`RecordCustomerPane`** (`features/records-management/ui/components/record-customer-pane.tsx`) replaces `meeting-customer-pane.tsx`: props `{ customer, isLoading, leadSource? }` (`hasCustomer` is redundant), `leadSource` typed `LeadSourceOverviewCardSource | null`.
- **`useCustomerProfile(customerId | null)`** in `shared/entities/customers/hooks/`, adopted by `customer-profile-modal.tsx:29`, `create-meeting-form.tsx:60` and `use-meeting-row-panel-data.ts:19` (the meetings hook keeps its proposals selection on top).

---

## 9. Campaign leads (legacy; owner 2026-09-29: change it without defensive code, D41)

- `campaigns-leads-view.tsx` drops its `Set` and passes `bulkActions` to `DataTable`. Selection is per page, like every table (the old cross-page `Set` goes; the server's 1000-id cap stays).
- Four `EntityActionConfig<RowSelection>`s, permission `['manage', 'all']`, with action constants and icons in campaigns-admin: **Enroll** (`custom`: `CampaignSelect` + Enroll, reshaped from `bulk-enroll-popover.tsx`), **Remove**, **Disqualify** (confirm), **DNC** (confirm). The server procedures are unchanged (queued jobs, `{ queued }`), so their toasts stay "queued".
- **Deleted:** `lead-select-cell.tsx`, `lead-select-header.tsx`, `leads-bulk-action-bar.tsx`, the `select` column and the `pageRowIds` / `selectedIds` / `toggleSelect` / `toggleSelectAll` meta.
- Its query stays on `fromPaginatedQuery` (its field-list move is follow-up work).

---

## 10. Error handling

| Case | Behaviour |
|---|---|
| A bulk row's crud returns an error | `failed` with the error type (and reason); the loop continues; the toast counts it |
| A bulk row is missing or not visible | `skipped` `notFound` |
| Bulk input > 100 ids | zod BAD_REQUEST (the UI can't produce it) |
| Bulk update with an empty patch | zod BAD_REQUEST |
| `setBy` isn't an internal user | PRECONDITION_FAILED `set_by_not_internal` (single row) / `failed` (bulk) |
| Expanded-row profile read fails | As meetings (D30): customer-dependent panes hide, the rest stays |

---

## 11. Coordination

- **Filtering:** landed (`d4821450..b7e3df8e`), followed by `2495d193` (the `DataTable` split into `data-table-body.tsx`, and the search rename `searchInput` → `search`): the checkbox lands in `data-table-body.tsx`; new code uses the new names.
- **Approval session** (handoff doc, D38): owns the proposals status cell and the Approve action's behaviour; B6 is planned and built after it (D46). Proposal-foundations Task 5 (`send`) is held until that session rules on status and outcome (multi-proposal C69).
- **Proposal foundations:** Task 7's `ON DELETE RESTRICT` + meetings `delete.before` (§5.1). `pre-draft` is deferred (C67), so bulk delete checks `draft` only.
- **Applications epic:** may change the meetings `hasApplications` skip.
- **#285:** H5 (agents and dispatchers, create and update); single-row project create/update/delete are unguarded server-side.
- **Analytics Spec D:** consumes `meetings.setBy`; owns backfill, `ownerId` and D6. If it labels setters, `useAnalyticsLabels` must read `getInternalUsers({ purpose: 'setter' })`, or dispatchers show as "Former user".
- **Legacy query path:** after B5 and B6, `buildFilterWhere`, `buildOrderBy` and `loadPaginatedQueryInput` have no callers and are deleted (B7). `usePaginatedQuery`, `fromPaginatedQuery` and `paginatedQueryInput` remain for campaign leads only; the tracker records their retirement as follow-up (filtering plan Task 21 step 5.3 asked for it). The stale "use `usePaginatedQuery` for new tables" text (`data-table/types.ts:45-49`, `use-table-url-filters.ts:10`) and tracker H2 are fixed in B7.
- **Owner-run:** `pnpm db:push:dev` after B1; `db:push:prod` **before** deploying B1 (the `getTableColumns` select reads `set_by`, so every meetings list fails until the column exists); no `db:refresh:dev` between the two pushes.

---

## 12. Verification

- `pnpm tsc` and `pnpm lint` after every task. Never `pnpm build`.
- Pure functions (`runBulk`, skip classifiers, `getContractState`, `formatBulkActionResult`) checked with throwaway `node:test` files run by `pnpm exec tsx --test` outside the repo.
- Browser (Playwright, `/api/dev/playwright-session`): each records page's selection, bar, confirm and toast; the setter picker on each add-a-meeting surface; campaign leads' four actions.
- **No database writes for testing.** Bulk delete runs only on rows the owner designates, or is verified by code and types.

---

## 13. Round-2 rulings (owner, 2026-09-29: all recommendations)

- **Q1** Proposals and projects move onto field lists (`EntityTableView.query` requires one) — §6, §7 (D46).
- **Q2** B6 (proposals) is planned and built after the approval session (D46).
- **Q3** Entity table = per-entity hook only; no ready component; `MeetingsTable` deleted; fixed filters recorded as O9 (D45).
- **Q4** Set by on `CreateMeetingForm`: super-admin picker, agents and dispatchers read-only self (D47).
- **Q5** Settled by fact: Hobby + Fluid Compute gives 300 s, no `maxDuration` change.
- **Q6** Customers (R2) is the next spec, on the entity-table hook (D48).
- **Q7** Proposal-foundations Task 5 is held until the approval session (multi-proposal C69).
