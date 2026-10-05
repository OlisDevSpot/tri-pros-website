# Sales lifecycle slice 1: guards — design

> **Status:** scope ruled by the owner on 2026-10-05 ("safe refusals only"); this written spec awaits their review. Nothing is built.
> **Tracker:** `docs/plans/2026-10-01-sales-lifecycle-rules-map.md` — §0 slice 1; rules **I1, I11 (part), P3, P8, M6, J2, Q10**, ruling **R29**.
> **Facts:** a read-only code audit on 2026-10-05 at `213662b3`. Re-check a `file:line` before relying on it.

## 1. Goal and scope

Stop new bad data on the proposal → project path with **refusals only**: no new status, no new outcome, no database change, no new screen.

**The rule for what belongs here (R29):** a refusal is in slice 1 only if no legitimate caller does the refused thing today, or if the user keeps a way round. A real contract signature is never refused.

**In**

| # | Guard | Rule |
|---|---|---|
| G1 | Frozen proposal fields | `kind` and `token` never change after create. A proposal is created as `draft` with no `approvedAt`. |
| G2 | Share-link writes | A share-link holder can write only `financeOptionId` and `envelopeDocumentIds` on their proposal. |
| G3 | Send | A proposal is sent only from `draft` or `sent`, checked before the email goes out. |
| G4 | `approvedAt` | The server stamps it when a proposal becomes approved and never overwrites it; no user or share-link payload may carry it. |
| G5 | Delete | An approved proposal, or one with a contract envelope, cannot be deleted. A meeting holding an approved proposal cannot be deleted. |
| G6 | Kanban project stage | A stage change goes through the project's own update: the dragged project, a valid stage, the viewer's permission. |
| G7 | Project writes | `projects.crud.create`, `.update` and `.delete` check the viewer's ability. |
| G8 | A refusal says why | Every refusal above reaches the user as a sentence, and `proposal_frozen` gets one too. |

**Out, moved to slice 3 (approval route)** because each would remove today's only correction path before the revert action exists:
- **P7** approved → draft/sent refused. Today that hand edit is the only undo of a mistaken approval.
- **J3** a project with linked meetings cannot be deleted. No UI unlinks a meeting from a project, so a project made by a mistaken approval could never be removed.
- **The full status graph** (I11): which moves out of `declined` are legal, and whether a signature beats a hand-set `declined`. Zoho writes the signed stamp and the approved status in one update from a retrying job (`services/contracts.service.ts:196-206`); a refused move there would lose a real signature.

**Out, owned elsewhere:** customer delete (it raw-deletes proposals and cascades projects, bypassing every hook; customers module); project visibility scope (`scope: null` on the projects router; #285); the backfill of the approved proposals with no `approvedAt` (slice 5).

## 2. Today (re-checked 2026-10-05)

- **Update accepts almost every column.** `updateProposalSchema = insertProposalSchema.partial()` (`modules/proposals/core/server-spec.ts:14`); `kind`, `token`, `status`, `approvedAt`, `ownerId` are all writable. `proposalCrud.update.before` only refuses frozen content fields (`core/dal/server/crud.ts:54-63`).
- **Create accepts `status` and `approvedAt`** from the client; `create.before` does not strip them (`crud.ts:27-40`). No UI sends them.
- **The share-link path skips both gates.** With a token the middleware sets `ability: null` and a scope on the token (`trpc/lib/middleware/shareable-middleware.ts:34-47`), and `create-crud-router.ts:63-65,89-91` checks fields only when there is an ability. A link holder can write `status`, `kind`, `approvedAt`, `ownerId`, `token`. The public page writes only `financeOptionId` (`funding.tsx:59-64`) through this path; `applyEnvelopeContext` writes `envelopeDocumentIds` in-process with the token's context (`contracts.router.ts:194-197`); `setCashInDeal` is its own procedure with its own check.
- **Send has no status check** and emails before it writes (`proposals.router/delivery.router.ts:37-66`). The UI offers it only for draft and sent proposals, so approved and declined are reachable over the wire only.
- **`approvedAt` has three behaviours:** the status cell writes `now` every time, also on re-clicking approved (`features/proposal-flow/ui/components/table/index.tsx:82,107`); `AssignProjectDialog` writes none (`assign-project-dialog.tsx:76-78`); Zoho writes it only when empty (`contracts.service.ts:200-202`).
- **No delete guard.** `proposalCrud` has no delete hook. `meetingCrud.delete.before` dispatches the calendar delete job first thing (`entities/meetings/dal/server/crud.ts:125-129`). Both deletes are super-admin only through `createCrudRouter`.
- **The kanban's project stage write** takes an unordered `limit 1` of the customer's projects and writes `pipelineStage` with raw `db.update`, no validation and no permission check (`features/customer-pipelines/dal/server/move-customer-pipeline-item.ts:62-84`). The card shows the customer's newest project.
- **Project writes have no ability check.** `projects.router/crud.router.ts:32-57` is a bare `agentProcedure`; the UI hides Delete from non-super-admins, the server does not.
- **Refusals are not worded.** `dalToTrpc` sends a refusal's reason as the error message (`trpc/lib/dal-to-trpc.ts:21-22`). The proposal, meeting and project toasts ignore it and say "Failed to …"; `edit-proposal-view.tsx:148,152` shows the raw code `proposal_frozen`.
- **`update.before` gets no stored row** (`dal/server/lib/create-crud-dal.ts:116-150`). `lead-sources/dal/server/crud.ts:39,66` reads it through the crud factory's own `getById`; `delete.before` already receives the row.

## 3. Design

### 3.1 Where the rules live

Pure functions in `src/shared/modules/proposals/core/lib/proposal-guards.ts` (no `db` import), beside `proposal-lock.ts` and `derive-proposal-kind.ts`. The crud hooks and the delivery router call them; a verify script exercises them (§5). Meetings get one in `src/shared/entities/meetings/lib/`.

The stored row an update guard needs is read inside `proposalCrud.update.before` through the factory argument (`crudHandlers.getById(SYSTEM_CONTEXT, …)`), the lead-sources pattern. The engine does not change. The read and the write stay two statements, as the frozen-content check is today; closing that window is slice 3's, with its one approval route.

### 3.2 G1 and G4 — fields no caller sets

In `proposalCrud`:

- `create.before`: a `status` other than `draft`, or any `approvedAt`, is refused (`proposal_created_not_draft`). Duplicate already passes `status: 'draft'`.
- `update.before`, on the raw payload:
  - `kind` or `token` present → refused (`proposal_field_frozen`), for every context.
  - `approvedAt` present → refused for a user or share-link context. System callers (the contract path) may pass it.
  - `status: 'approved'` present → read the stored row. If it was not approved, stamp `approvedAt` with the payload's value, else now. If it was already approved, the stored `approvedAt` is kept and the payload's is dropped.
- The update schema drops `kind` and `token`, so an internal caller that names them fails `pnpm tsc`.

Callers that change: the records status cell stops sending `approvedAt` (`table/index.tsx:82,107`). `AssignProjectDialog` needs no change and starts getting a stamp.

### 3.3 G2 — the share-link allowlist

In `proposalCrud.update.before`, first thing: when the context is a share link, any key outside `financeOptionId` and `envelopeDocumentIds` is refused with `forbidden`. A hook sees both the wire update and `applyEnvelopeContext`'s in-process one; a router check would see only the first.

A share-link context is `ability === null` with a non-null `scope`; the system context has neither (`dal/server/types.ts:22-26`). The plan confirms this in the middleware and names the predicate once (`isShareLinkContext`, in the shareable middleware's own file). If the two cannot be told apart reliably, the middleware marks the context explicitly and the predicate reads the mark.

This guard has no legitimate caller to break, and it closes a hole that is live on production. It can ship ahead of the rest through the hotfix path.

### 3.4 G3 — send

`canSendProposal(status)` is true for `draft` and `sent`. `delivery.sendProposalEmail` reads the proposal's status and refuses (`proposal_not_sendable`) **before** composing the email. The UI already offers send only for those two.

### 3.5 G5 — delete

- `proposalCrud` gains `delete.before(row)`: `status === 'approved'` or a `contractEnvelopeId` → refused (`proposal_delete_approved`, `proposal_delete_has_contract`). Way round: decline it, or discard the envelope, then delete.
- `meetingCrud.delete.before(row)`: a read of "does this meeting hold an approved proposal" runs **before** the calendar job is dispatched; if yes → refused (`meeting_delete_has_approved_proposal`). Way round: decline the proposal first.
- Where a row already carries the facts, the Delete action is disabled with the same sentence through the existing `getDisabledReason` on action configs: proposal rows carry `status` and the envelope id; meeting list rows carry `hasApprovedProposal`. The server refusal stays the rule; the disabled state is the courtesy.

### 3.6 G6 and G7 — projects

- **G6.** The projects branch of `moveCustomerPipelineItem` takes the dragged `projectId` from the client (the card has it), checks the project belongs to the customer, and writes through `projectCrud.update` under the viewer's context. `pipelineStage` is validated against `projectPipelineStages` (`constants/enums/pipelines.ts:43-56`) in the mutation's input and in the project update schema. A viewer without `update Project` is refused.
- **G7.** `projects.crud.create`, `.update`, `.delete` each assert the matching ability (`create`, `update`, `delete` on `Project`), as `createCrudRouter` does for other entities. Agents keep update (the portfolio toggle, the edit form); delete becomes super-admin only on the server, as the UI already shows it.
- The plan checks whether dispatchers can reach the projects kanban today. If they can, they lose the stage drag; that is reported to the owner before the build, not worked around.

### 3.7 G8 — a refusal says why

- Each entity keeps its refusals in one constant: `PROPOSAL_REFUSALS`, `MEETING_REFUSALS`, `PROJECT_REFUSALS` in the entity's `constants/refusals.ts`, each entry `{ reason, message }` (the shape the setter plan uses for `SET_BY_NOT_INTERNAL`). The hooks throw `reason`; the message is the sentence.
- One client function turns an error into its sentence: `refusalMessage(error, refusals): string | undefined` in `shared/dal/client/lib/`. A toast reads `refusalMessage(err, PROPOSAL_REFUSALS) ?? 'Failed to delete proposal'`. Unknown errors keep the generic text, so nothing internal leaks.
- Toasts that change: proposal update and delete (`use-proposal-actions.ts`, `use-proposal-action-configs.ts`), the assign dialog's approve, meeting delete (`use-meeting-actions.ts`), project delete and update (`use-project-actions.ts`), the kanban move, and the public page's financing pick, which has no `onError` today (`funding.tsx:59-69`).
- `proposal_frozen` moves into `PROPOSAL_REFUSALS` with a sentence, so the edit view stops showing the raw code.

Sentences (owner to edit at review):

| Reason | Sentence |
|---|---|
| `proposal_frozen` | This proposal's contract has started, so its content is locked. |
| `proposal_field_frozen` | That part of a proposal can't be changed. |
| `proposal_created_not_draft` | A new proposal starts as a draft. |
| `proposal_not_sendable` | Only a draft or sent proposal can be sent. |
| `proposal_delete_approved` | An approved proposal can't be deleted. Decline it first. |
| `proposal_delete_has_contract` | This proposal has a contract. Discard the contract first. |
| `meeting_delete_has_approved_proposal` | This meeting has an approved proposal. Decline the proposal first. |
| `project_stage_wrong_customer` | That project belongs to another customer. |

Names proposed here for the owner's nod: `proposal-guards.ts`, `PROPOSAL_REFUSALS` / `MEETING_REFUSALS` / `PROJECT_REFUSALS`, `refusalMessage`, `isShareLinkContext`, `canSendProposal`.

## 4. What users will notice

- A super-admin deleting an approved proposal, or a meeting that holds one, sees why not, and what to do first.
- Re-clicking "approved" on an approved proposal no longer moves its approval date.
- Dragging a project card moves that project, not another project of the same customer.
- A share link can no longer change a proposal's status.
- Nothing else: every other path behaves as today.

## 5. Verification

- `pnpm tsc` and `pnpm lint` per task. Never `pnpm build`.
- `scripts/verify-lifecycle-guards.ts`, in the repo's verify style (`node:assert/strict`, numbered sections, a final ✅): the share-link allowlist over every proposal column; `canSendProposal` over the four statuses; the `approvedAt` decision for become-approved, stay-approved, and a payload that carries one, per context; both delete rules; the stage validator.
- A read-only count on the dev database, written into the plan before the build: proposals that are approved with no `approvedAt`; proposals with a `kind` that disagrees with their meeting's project; projects whose customer has more than one project (G6's case).
- Browser, read-only: the disabled Delete with its sentence on an approved proposal and on a meeting that holds one; the public proposal page still saves a financing pick and still builds its contract documents.
- Write checks only on rows the owner names: a refused delete, a kanban drag on a customer with two projects.

## 6. Order and hand-off

1. G2 alone (hotfix-able).
2. G7 (also in the security batch).
3. G1 + G4, then G3, G5, G6, with G8's constants growing as each lands.
4. Hand-off: tick slice 1 in the rules map §0; fix the proposal, meeting and project `DOCS.md` lines the handoff lists as stale only where this slice makes them true.

Slice 2 (outcome policy) does not wait on anything here except G8's `refusalMessage`, which its pickers reuse.
