# Proposal approval, contracts, project creation and meeting outcome — session handoff

> **Status:** input for its own grill/brainstorm session (owner, 2026-09-29). Nothing here is decided beyond §1. The facts in §2–§4 were mapped 2026-09-28 at `650e5c75` by a read-only audit; re-check every `file:line` before relying on it.
> **Pulled out of:** the records bulk-actions spec (`docs/superpowers/specs/2026-09-28-records-bulk-actions-and-entity-tables-design.md`, old phase B2 / R3a) and records tracker D35.
> **Blocks:** the proposals entity table's status cell (records R3); the proposal-foundations `send` verb touches the same cluster (spec A plan Task 5, tracker C68).

## 1. Owner requirements (2026-09-29)

- Approving an **initial-sale** proposal creates a project. Approving an **additional-work** proposal adds to the project that owns the meeting the proposal belongs to.
- This is a business fact; the codebase diverged from it. Fix it from the foundation, simply, with existing primitives. No defensive code, no new thin helpers (an `ensure…` verb was rejected as a thin API).
- Creating a project is a plain `projectCrud.create`. The evergreen rules true of every project live in its `create.before` / `create.after` hooks (the approved pattern).
- No project form on approval: `CreateProjectModal` and `CreateProjectForm` go.
- Meeting outcome lock is **value-based**: one derivation of a meeting's outcome from its state; `meetingCrud` `update.before` refuses any other value when the meeting has an approved proposal; the same derivation drives every outcome editor. (A caller-based exemption cannot be built: hooks receive `(data, ctx, { id })` and `ScopedContext` carries no origin.)
- Map the requirements and every call site across proposal status, proposal approval, contract approval, project creation and meeting outcome before deciding; these are interconnected.

## 2. The three paths that reach `approved` today

| Path | What it does |
|---|---|
| Records status cell `features/proposal-flow/ui/components/table/index.tsx:65-121` | Meeting already has a project → one `crud.update({ status: 'approved', approvedAt })`, no outcome change. Otherwise opens `CreateProjectModal` → `projectsRouter.business.create`, then a fire-and-forget second `crud.update` approving **the proposal picked in the form** (may differ from the clicked row); the toast shows before it resolves. Silently does nothing when the row has no meeting or customer. |
| Contract `services/contracts.service.ts:175-214` (Zoho webhook → QStash `sync-zoho-sign-status.ts` → `applyContractEvent(SYSTEM_CONTEXT)`) | On `completed`: write-once check on `contractSignedAt`, then ONE `proposalCrud.update({ contractSignedAt, status: 'approved', approvedAt })`; if `kind === 'additional-work'`, `deriveOutcomeOnAdditionalWorkApproved`. No project. |
| `AssignProjectDialog` `shared/entities/meetings/components/assign-project-dialog.tsx:53-78` | `crud.update({ status: 'approved' })` with no `approvedAt`, no project, no outcome; its toast says a project will be created (false). Its other button, `customerPipelinesRouter.assignToProject` (`customer-pipelines.router.ts:120-137`), writes `{ projectId, meetingOutcome: 'converted_to_project' }` with no approval check. |

No other writer of `status: 'approved'` / `approvedAt` exists in `src/`, `scripts/`, seeds or jobs. Latent: `proposalsRouter.crud.update` is the shareable procedure; on the token path `ability` is null, so a link holder can write `status` (multi-proposal epic X1, #285).

## 3. Project creation today

`projectsRouter.business.create` (`trpc/routers/projects.router/business.router.ts:14-74`), inline in the router, only caller `create-project-form.tsx:126`:
1. `getProposalsByMeetingId` unscoped; refuses zero proposals; approval not checked.
2. `customerCrud.getById` unscoped; `customerId` comes from the client, not checked against the meeting.
3. accessor = slug(title) + 6 random chars.
4. `projectCrud.create` with client title/description/duration, `ownerId: ctx.session.user.id`, address from the customer, `pipelineStage: 'signed'`, `isPublic: false`.
5. `meetingCrud.update({ projectId, meetingOutcome: 'converted_to_project' })` under a user context.
6. `setProjectScopes(project.id, extractScopeIdsFromProposals(allMeetingProposals))`: raw `db`, outside any crud call.

`createProjectWithScopes` (`modules/projects/core/dal/server/crud.ts:56-67`) already composes create + scopes and is unused here. `projectCrud` has a `delete.before` (R2 purge) and no create hooks.

## 4. Meeting outcome today

**Writers (all through `meetingCrud.update`, hooks fire):**

| # | Writer | Value |
|---|---|---|
| 1 | `meetingsRouter.crud.update` via `useOutcomeChange` (`use-meeting-actions.ts:33`) | hand-picked |
| 2 | `meetings.router/business.router.ts:56` `setOutcomeWithReason` | hand-picked + reason |
| 3 | `business.router.ts:142` reschedule | `cancelled` (from did-not-occur outcomes) |
| 4 | `projects.router/business.router.ts:65` | `converted_to_project` |
| 5 | `customer-pipelines.router.ts:130` `assignToProject` | `converted_to_project` |
| 6 | `move-customer-pipeline-item.ts:156` (kanban) | `follow_up_needed` |
| 7 | `meetings/dal/server/mutations.ts:40` `deriveOutcomeOnProposalSent` (SYSTEM_CONTEXT) | `proposal_sent` |
| 8 | `mutations.ts:70` `deriveOutcomeOnAdditionalWorkApproved` | `additional_work`, only from `not_set` / `proposal_created` / `proposal_sent` (`ADDITIONAL_WORK_OVERWRITABLE`, `:47`) |

**Editors:** `getOutcomeDisabledChecker` (`domains/pipelines/lib/get-disabled-outcomes.ts:16-39`) disables `proposal_created` without a proposal, `proposal_sent` without a sent one, `converted_to_project` without an approved one, `additional_work` always. Used by the meetings column registry and `closing-step.tsx`; NOT by `context-panel.tsx:44-45` (offers every outcome), `use-meeting-action-configs.tsx:128-135` or `overview-card.tsx:300-330`. `StatusDropdownCell` never disables the current value.

## 5. Other facts the design must respect

- `kind` is derived once at proposal create from the meeting's `projectId` (`derive-proposal-kind.ts`) and frozen.
- Unique index `proposals_one_approved_initial_sale_per_meeting_idx` (`db/schema/proposals.ts:94-96`): at most one approved initial-sale per meeting; additional-work proposals live on the project's birthing meeting (`projects/core/DOCS.md:60`).
- Transactions: `createCrudDal` honors `ctx.tx`; `withTx` exists with no callers; meeting after-hooks dispatch QStash/Ably before commit; `setProjectScopes` uses the global `db`.
- Proposal statuses `draft | sent | approved | declined` (`pre-draft` deferred, multi-proposal tracker C67). Transitions: create/duplicate → draft; `sendProposalEmail` → sent from any status, no gate; contract `completed` → approved; kanban sent → declined; status cell / `crud.update` → anything, including approved → other (the project, link and outcome stay).
- `proposals.meeting_id` is nullable `set null` today; spec A Task 7 makes it NOT NULL + RESTRICT. `meetings.customer_id` is nullable.
- The contract path's write-once on `contractSignedAt` means a failure after that write is never retried into an approval.

## 6. Docs and memory already stale against the code

`src/shared/modules/proposals/core/DOCS.md:3, 93-107` (`#conversion-trigger`; `:95` says `proposals.router/business.router.ts` does not exist — it does), `src/shared/entities/meetings/DOCS.md:112-121, 245, 258`, `src/shared/modules/projects/core/DOCS.md:3, 43-53, 71, 79`, memory `project-conversion-rules.md` (says `converted_to_project` is never offered in a picker; the checker enables it once a proposal is approved).

## 7. Questions for the session (not answered here)

- Order of writes, and what a failed step leaves behind, given no transaction spans the meeting hooks.
- Initial-sale approval when another initial-sale on the meeting is already approved.
- Approval of a proposal whose meeting has no customer (the contract path must not lose a signed contract).
- Additional-work approval when the meeting no longer has a project.
- Who owns an auto-created project (the office user who clicked vs the meeting's owner participant, as reschedule does at `meetings.router/business.router.ts:109-121`).
- Project defaults (title `{customer} - {city}`, description from SOW scope labels) — `create.before` rule or call-site input.
- Un-approving: allowed, and what happens to the project, link and outcome.
- Linking a meeting to an existing project (`assignToProject`) under the derived outcome.
- Legacy data: meetings with an approved proposal but no project, or a non-derived outcome (read-only count first).
- Whether spec A's `send` (status `sent` + outcome flip) lands before or inside this redesign.
