# Lifecycle Guards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop new bad data on the proposal → project path with server-side refusals only (G1–G8), each one worded for the person who hits it, with no database change.

**Architecture:** Pure rules in `proposal-guards.ts` (and one file for meetings) decide; the `proposalCrud` and `meetingCrud` hooks and the delivery router call them, so every write origin obeys. A refusal is a `{ reason, message }` entry in one constant per entity: hooks throw the `reason`, and one client function, `refusalMessage`, turns a refused write into its sentence. The projects router and the kanban's project stage move check the viewer's ability and write through `projectCrud`.

**Tech Stack:** Next.js 15 App Router, tRPC v11, Drizzle + Postgres (Neon), Zod 4, drizzle-zod, CASL, TanStack Query, sonner, pnpm, `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-05-lifecycle-guards-design.md` (approved 2026-10-05). Tracker: `docs/plans/2026-10-01-sales-lifecycle-rules-map.md` §0 slice 1, ruling **R29**.

**Checked against the code at** `c6f0658a` (2026-10-05). The spec's own audit was at `213662b3`; where the two differ, this plan follows the code and says so under "Where the code differs from the spec".

**Task order:** G2 → G7 → G1 → G4 → G3 → G5 → G6 → hand-off. G8 (words) has no task of its own: each constant and `refusalMessage` appear in the first task that needs them. G1 and G4 are two adjacent tasks, not one, because G4 waits on a ruling (Task 4 Step 1) and G1 does not.

## Owner confirms (before the build)

**1. The refusal sentences.** These are the spec's, word for word. Each lives in exactly one constant entry, so a wording change is a one-line edit there.

| Reason | Sentence | Constant entry | Added in |
|---|---|---|---|
| `proposal_frozen` | This proposal's contract has started, so its content is locked. | `PROPOSAL_REFUSALS.frozen` | Task 3 |
| `proposal_field_frozen` | That part of a proposal can't be changed. | `PROPOSAL_REFUSALS.fieldFrozen` | Task 3 |
| `proposal_created_not_draft` | A new proposal starts as a draft. | `PROPOSAL_REFUSALS.createdNotDraft` | Task 3 |
| `proposal_not_sendable` | Only a draft or sent proposal can be sent. | `PROPOSAL_REFUSALS.notSendable` | Task 5 |
| `proposal_delete_approved` | An approved proposal can't be deleted. Decline it first. | `PROPOSAL_REFUSALS.deleteApproved` | Task 6 |
| `proposal_delete_has_contract` | This proposal has a contract. Discard the contract first. | `PROPOSAL_REFUSALS.deleteHasContract` | Task 6 |
| `meeting_delete_has_approved_proposal` | This meeting has an approved proposal. Decline the proposal first. | `MEETING_REFUSALS.deleteHasApprovedProposal` | Task 6 |
| `project_stage_wrong_customer` | That project belongs to another customer. | `PROJECT_REFUSALS.stageWrongCustomer` | Task 7 |

**2. New copy the spec did not write.** Two fallback toasts on the public proposal page, which has no error toast today (Task 3 Step 8): "Couldn't save the financing option" and "Couldn't save the cash amount". A homeowner sees them, and sees the `proposal_frozen` sentence when they pick financing after a contract draft exists. Three permission messages nothing in the UI can trigger (Task 2): "You do not have permission to create / update / delete projects".

**3. Names the spec left open.** Each follows the neighbouring code; say so if one should change.

| Name | File | Convention it follows |
|---|---|---|
| `shareLinkWritableProposalFields`, `isShareLinkWritable` | `proposal-guards.ts` | `frozenProposalLockedFields` / `touchesFrozenLockedFields` in `proposal-lock.ts` |
| `proposalFieldsFrozenAfterCreate`, `touchesFieldsFrozenAfterCreate`, `isDraftCreate` | `proposal-guards.ts` | same pair shape |
| `ProposalWriteContext` (`'user' \| 'share-link' \| 'system'`), `canSetApprovedAt`, `resolveApprovedAt` | `proposal-guards.ts` | the spec's "user or share-link context" and "system callers"; `can…` like `canSendProposal` |
| `proposalDeleteRefusal` | `proposal-guards.ts` | returns the constant entry or `null` |
| `meeting-guards.ts`, `meetingDeleteRefusal` | `src/shared/entities/meetings/lib/` | the spec's "meetings get one", named like `proposal-guards.ts` |
| `meetingHoldsApprovedProposal` | meetings `dal/server/queries.ts` | the spec's phrase "a meeting holding an approved proposal"; a hook read like `getMeetingSchedule` |
| `isProjectPipelineStage` | `src/shared/constants/enums/pipelines.ts` | type guard beside `projectPipelineStages` |
| `Refusal` (interface) | `refusal-message.ts` | the spec's own word |
| Constant keys (`frozen`, `fieldFrozen`, …) | the three `constants/refusals.ts` | the reason code without its entity prefix, camel-cased |

**4. Blocked: needs a ruling (G4).** Two cases where the Zoho signature path sends or omits an approval time and the spec's rule changes what is stored. Full text and both options in Task 4 Step 1. Tasks 1–3 do not wait on it. **Ruled 2026-10-06: B.**

**5. Dispatchers and the projects kanban.** Dispatchers have no link to it (the sidebar and the pipeline select offer them only Leads), but `/dashboard/pipeline/projects` has no role guard, so by typing the URL they can open it and see public projects that have a customer. A drag there writes today (raw and unchecked). After Task 7 it is refused, because dispatchers hold no Project ability at all. Nothing legitimate is lost; the spec asks that you hear it before the build.

**6. `projects.business.create` has the same hole G7 closes.** It is the bare `agentProcedure` behind the approval modal's project form, and a dispatcher can call it over the wire. The spec's G7 names only `projects.crud.create`, `.update` and `.delete`, so this plan leaves it. Recommendation: say yes and Task 2 gains the same three-line `create Project` check at the top of that mutation. **Owner 2026-10-06: deferred; Task 2 stays as written.**

**7. `SET_BY_NOT_INTERNAL`** (the setter plan's refusal) has the same `{ reason, message }` shape as these constants. Not folded in here. Recommendation: once the setter plan's Task 4 lands, move it in as `MEETING_REFUSALS.setByNotInternal` so every meeting toast reads one constant. **Owner 2026-10-06: deferred.**

**8. Stale tabs on deploy day.** A records table left open from before the deploy still sends an approval time with "approved". Task 4 refuses that, so the tab shows "Failed to update proposal" until it reloads. A reload is the way round.

**9. The pre-flight counts were not run at plan time.** The agent session was refused a read of the dev database (it holds real contact data). Task 0 is yours to run; it prints counts only.

## Global Constraints

- Verification per task: `pnpm tsc` and `pnpm lint`. **Never `pnpm build`.**
- **No database change.** No schema file edit and no `db:push`. If a step seems to need one, stop and report.
- **No database writes for testing** (dev included). Browser checks read and open UI only. A write check (a refused delete, a financing pick, a kanban drag, an approval) runs only on rows the owner designates, or is verified by the pure tests, the verify script, types and a code read.
- No unit runner in the repo: pure functions are checked with throwaway `node:test` files under `.superpowers/sdd/2026-10-05-lifecycle-guards/tests/` (git-ignored), run from the repo root with `pnpm exec tsx --test <file>` so the `@/` alias resolves. Never commit them.
- The committed check is `scripts/verify-lifecycle-guards.ts`: pure, no `./lib/load-env`, no `@/shared/db` import, nothing written. Run with `pnpm exec tsx scripts/verify-lifecycle-guards.ts`. `pnpm tsc` type-checks it; `pnpm lint` does not cover `scripts/`. Its sections stay in number order: a task built late (Task 4 waits on a ruling) puts its section in its numbered place, not at the end.
- Where a step says "add the imports", place each in path order among the file's other `@/` imports (type imports with the type imports); `pnpm lint` reports a misplaced one.
- Work on `main`; other sessions commit concurrently and the index can hold their staged work. Add only new files with `git add -- <path>`, then **commit with an explicit pathspec** (`git commit -m "…" -- <paths>`, as every commit block below does) so nothing already staged rides along; confirm with `git show --stat HEAD`. Never `git add -A`, `git stash`, `checkout`, `reset`, `restore`, `clean` or `commit --amend`. Before editing any file this plan modifies, run `git status --short <file>`: if it shows changes you didn't make, stop and ask. Message shape `type(scope): subject`, ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Never start, stop or restart a dev server; never touch `.next`. Run `ss -ltnp | grep :3000` and reuse the running one.
- Browser checks: a local Playwright script (memory `reference-playwright-auth.md`, `/api/dev/playwright-session`, roles via `&role=super-admin|agent|dispatcher`), screenshots saved under `.superpowers/sdd/2026-10-05-lifecycle-guards/`, listed in the task report. Never print `.env.local`, `DEV_LOGIN_SECRET` or a URL containing `secret=`.
- Code conventions (memory `coding-conventions.md`): named exports, constants in `constants/`, pure helpers in `lib/` (no toasts or other side effects there), only DAL files import `db`. Comments say why, never what; no plan, spec, tracker or issue citations in code.
- **Safe refusals only (R29).** A refusal is here only if no legitimate caller does the refused thing today, or the user keeps a way round. A real contract signature is never refused: no step may add a refusal that a `SYSTEM_CONTEXT` write from `contractService.applyContractEvent` can hit. If you find a legitimate caller a guard would break, stop that task and report; do not weaken or widen the guard.
- **Not in this plan** (slice 3): approved → draft or sent refused (P7), no delete of a project with linked meetings (J3), the full status graph. Customer delete and project visibility scope are owned elsewhere.
- Rules live in the crud hooks and the pure functions, never in a component. Ability checks sit in the procedure, as the hand-written routers already do (`ctx.ability.cannot(…)`).
- Names used verbatim: `proposal-guards.ts`, `PROPOSAL_REFUSALS`, `MEETING_REFUSALS`, `PROJECT_REFUSALS`, `refusalMessage`, `isShareLinkContext`, `canSendProposal`.
- A sentence or a reason code is typed once, in its constant entry. Hooks throw `.reason`; toasts read `.message` through `refusalMessage`; tests compare against the entry. The verify script's last section is the one place the reason codes are spelled again, to pin them against the spec's table.
- Render rule (`data-table.tsx` meta doc): a function on an action config that runs while rendering (`getDisabledReason`, `hidden`) reads only its argument. Action config arrays go through `useStableCallbacks`.
- **Concurrent work.** The meetings setter plan (`docs/superpowers/plans/2026-10-05-meetings-setter.md`) is being built on this tree. Its Task 1 is committed (`b14be068`); its Tasks 2–4 edit `src/shared/entities/meetings/dal/server/queries.ts`, `hooks/use-meeting-actions.ts` and `hooks/use-meeting-action-configs.tsx`, which Task 6 here also edits. Refer to symbols, never line numbers, in the meetings files, and never undo setter work (`assertSetterIsInternal`, the `setBy` rules, `duplicate.overrides`, `SET_BY_NOT_INTERNAL`).

## Review Focus

1. **The public page's own writes still go through a share link.** A homeowner's financing pick (`financeOptionId` over the wire) and the document selection re-saved after an age entry (`envelopeDocumentIds`, written in-process by `applyEnvelopeContext`) must both pass the allowlist; so must the same writes from a signed-in agent who opened the share URL. Pinned by Task 1 Step 1 (caller table), Step 2 (the two named cases and the agent-on-a-share-URL case) and Step 10 (owner's write check).
2. **A real signature always lands.** The Zoho job's update (`contractSignedAt`, `status: 'approved'`, sometimes `approvedAt`, under `SYSTEM_CONTEXT`) must pass every guard added here, on a draft, sent, declined or already approved proposal. Pinned by Task 1 Step 2 (the system context is not a share link), Task 4 Step 3 (system cases) and Task 4 Step 11 (code read of the payload against each check).
3. **A tab opened before the deploy.** It still sends `approvedAt` with an approval and is refused; the person expects approving to work. Expected behaviour: the old generic toast, and a reload fixes it. Cannot be tested here; pinned by Task 4 Step 9 (only two client sites send it, both changed) and reported to the owner (Owner confirms 8).
4. **A refused delete leaves everything in place, and a customer delete still completes.** The meeting guard runs before the calendar job is dispatched; the customer delete removes a customer's proposals before its meetings, so the meeting guard never fires there. Pinned by Task 6 Step 10 (code read of both orders).
5. **A customer with several projects.** The stage move writes the project on the dragged card, never another project of that customer, and a stage outside the pipeline never reaches the column. Pinned by Task 7 Step 2 (validator), Step 11 (code read) and Step 12 (owner's write check).

## Where the code differs from the spec

Plan from the code in each case; the affected step says so again.

- **§3.3 `isShareLinkContext` "in the shareable middleware's own file".** Its consumer is `proposalCrud.update.before`, a DAL file, and `src/shared/dal/server/types.ts:1` rules that the DAL never imports tRPC (no server DAL file does). It goes in `src/shared/dal/server/types.ts`, beside `SYSTEM_CONTEXT`, the other context it tells apart (Task 1 Step 4). The structural test is reliable: the token path of `shareableMiddleware` is the only producer of `ability: null` with a scope.
- **§3.2 "`kind` or `token` present → refused, for every context" and "the update schema drops `kind` and `token`".** Both are built, but with the schema dropping them a wire payload that names either has it stripped by Zod before the hook runs. Over the wire the result is a silent no-op, not `proposal_field_frozen`; the hook's refusal is reached only by an in-process caller that got past the types (Task 3 Step 10).
- **§2 and §3.7 `edit-proposal-view.tsx:148,152`.** The raw reason shows at four toasts, `:148`, `:152`, `:167` and `:171` (`onSubmit` and `onSave`). All four are fixed (Task 3 Step 8).
- **§3.7's toast list** leaves out two that show a raw reason or nothing: the send toast in `proposal-card.tsx` (`runSend`), wired in Task 5, and the cash-down Save in `funding.tsx`, which has no `onError` and can hit `proposal_frozen`, wired in Task 3.
- **§3.7 "project delete and update (`use-project-actions.ts`)".** No project reason reaches those two mutations in this slice (the only one is thrown by the kanban move). They are wired as the spec says (Task 7 Step 9) and stay inert until a project refusal exists.
- **§3.5 "proposal rows carry `status` and the envelope id".** True of the records table's rows. The customer profile's rows carry `status` only and the overview card's data carries neither reliably; there the disabled Delete covers what the row carries and the server refusal covers the rest (Task 6 Step 8).
- **§3.6 "as `createCrudRouter` does".** Its `assertCan` is private to that file. Hand-written routers check inline with `ctx.ability.cannot(…)`; Task 2 does the same.
- **§5 "the stage validator".** None exists; Task 7 adds `isProjectPipelineStage`.
- **§2 `entities/meetings/dal/server/crud.ts:125-129`.** The setter commit moved `delete.before`; find it by name.
- **The spec's status line** still says it awaits review; it was approved 2026-10-05. Task 8 rewrites the line.

## File map

| Task | Files |
|---|---|
| 0 Pre-flight counts | `.superpowers/sdd/2026-10-05-lifecycle-guards/preflight-counts.ts` (throwaway) |
| 1 G2 share link | `src/shared/dal/server/types.ts` · `src/shared/modules/proposals/core/lib/proposal-guards.ts` (new) · `src/shared/modules/proposals/core/dal/server/crud.ts` · `scripts/verify-lifecycle-guards.ts` (new) |
| 2 G7 project writes | `src/trpc/routers/projects.router/crud.router.ts` · `src/shared/modules/projects/core/server-spec.ts` (comment) |
| 3 G1 frozen fields, first words | `src/shared/modules/proposals/core/constants/refusals.ts` (new) · `src/shared/dal/client/lib/refusal-message.ts` (new) · `proposal-guards.ts` · `src/shared/modules/proposals/core/server-spec.ts` · proposals `dal/server/{crud,mutations}.ts` · `src/shared/modules/proposals/incentives/service.ts` · `src/shared/modules/proposals/core/hooks/use-proposal-actions.ts` · `src/features/proposal-flow/ui/views/edit-proposal-view.tsx` · `src/features/proposal-flow/ui/components/proposal/funding.tsx` · verify script |
| 4 G4 `approvedAt` | `proposal-guards.ts` · proposals `dal/server/crud.ts` · `src/shared/services/contracts.service.ts` (ruling B only) · `src/features/proposal-flow/ui/components/table/index.tsx` · `src/shared/entities/meetings/components/assign-project-dialog.tsx` · verify script |
| 5 G3 send | `constants/refusals.ts` · `proposal-guards.ts` · `src/trpc/routers/proposals.router/delivery.router.ts` · `src/shared/components/contract-status-panel/ui/proposal-card.tsx` · verify script |
| 6 G5 delete | proposals `constants/refusals.ts`, `proposal-guards.ts`, `dal/server/crud.ts`, `hooks/{use-proposal-actions,use-proposal-action-configs}.ts` · meetings `constants/refusals.ts` (new), `lib/meeting-guards.ts` (new), `dal/server/{queries,crud}.ts`, `hooks/{use-meeting-actions.ts,use-meeting-action-configs.tsx}` · verify script |
| 7 G6 kanban stage | `src/shared/constants/enums/pipelines.ts` · `src/shared/modules/projects/core/constants/refusals.ts` (new) · `src/shared/modules/projects/core/server-spec.ts` · `src/shared/modules/projects/core/dal/server/crud.ts` · `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts` · `src/trpc/routers/customer-pipelines.router.ts` · `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx` · `src/shared/modules/projects/core/hooks/use-project-actions.ts` · verify script |
| 8 Hand-off | verify script (last section) · `docs/plans/2026-10-01-sales-lifecycle-rules-map.md` · the spec's status line · `src/shared/modules/proposals/core/DOCS.md` · `src/shared/modules/projects/core/DOCS.md` |

---

### Task 0: Pre-flight counts (owner-run, read-only)

Tasks 1 and 2 do not wait for this. Task 4's ruling reads counts 1–2; Task 7's write check reads count 5.

**Files:**
- Create (throwaway, git-ignored): `.superpowers/sdd/2026-10-05-lifecycle-guards/preflight-counts.ts`

- [ ] **Step 1: Write the script**

```ts
/* eslint-disable no-console */
import '../../../scripts/lib/load-env'

import { sql } from 'drizzle-orm'

import { projectPipelineStages } from '@/shared/constants/enums/pipelines'
import { db } from '@/shared/db'

import { describeTargetDb } from '../../../scripts/lib/describe-target-db'

async function count(label: string, query: ReturnType<typeof sql>) {
  const result = await db.execute(query)
  console.log(`${label}: ${JSON.stringify(result.rows)}`)
}

async function main() {
  const target = describeTargetDb()
  console.log(`target: ${target.env} (${target.host})`)

  await count('1. approved, no approved_at', sql`SELECT count(*)::int AS n FROM proposals WHERE status = 'approved' AND approved_at IS NULL`)
  await count('2. not approved, but carrying an approved_at', sql`SELECT status, count(*)::int AS n FROM proposals WHERE status <> 'approved' AND approved_at IS NOT NULL GROUP BY 1 ORDER BY 1`)
  await count('3. additional-work whose meeting has no project (or no meeting)', sql`SELECT count(*)::int AS n FROM proposals p LEFT JOIN meetings m ON m.id = p.meeting_id WHERE p.kind = 'additional-work' AND m.project_id IS NULL`)
  await count('4. initial-sale on a meeting that has a project but holds no approved initial-sale', sql`SELECT count(*)::int AS n FROM proposals p JOIN meetings m ON m.id = p.meeting_id WHERE p.kind = 'initial-sale' AND m.project_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM proposals a WHERE a.meeting_id = m.id AND a.kind = 'initial-sale' AND a.status = 'approved')`)
  await count('5. customers with more than one project', sql`SELECT count(*)::int AS customers, coalesce(sum(c), 0)::int AS projects FROM (SELECT customer_id, count(*) AS c FROM projects WHERE customer_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1) t`)
  await count('6. proposals with a contract envelope, by status', sql`SELECT status, count(*)::int AS n FROM proposals WHERE contract_envelope_id IS NOT NULL GROUP BY 1 ORDER BY 1`)
  await count('7. project stages outside the pipeline', sql`SELECT pipeline_stage, count(*)::int AS n FROM projects WHERE pipeline_stage IS NOT NULL AND pipeline_stage NOT IN (${sql.join(projectPipelineStages.map(stage => sql`${stage}`), sql`, `)}) GROUP BY 1 ORDER BY 1`)

  process.exit(0)
}

main().catch((err) => {
  console.error('[preflight] failed:', err)
  process.exit(1)
})
```

Every query is a `SELECT` of counts; no row data is printed.

- [ ] **Step 2: Owner gate — run it**

Do not run this from an agent session: at plan time the permission system refused an agent's read of the dev database. Ask the owner to run it and paste the output:

```bash
DRIZZLE_TARGET=dev pnpm exec tsx .superpowers/sdd/2026-10-05-lifecycle-guards/preflight-counts.ts
```

Expected first line: `target: dev (<the dev host>)`. If it says anything else, stop.

- [ ] **Step 3: Record the numbers here**

| # | Count | Dev result | Used by |
|---|---|---|---|
| 1 | Approved, no `approved_at` | pending the owner's run (rules map §7 saw 5) | Task 4 Step 1, case (a) |
| 2 | Not approved, carrying an `approved_at` | pending the owner's run | Task 4 Step 1, case (b) |
| 3 | `additional-work` whose meeting has no project | pending the owner's run | information: G1 freezes these as they are; slice 4 or 5 corrects them |
| 4 | `initial-sale` on a project's meeting with no approved initial-sale | pending the owner's run | same |
| 5 | Customers with more than one project | pending the owner's run (rules map §7 saw 0) | Task 7 Step 12 |
| 6 | Proposals with a contract envelope, by status | pending the owner's run | Task 6: what the delete guard will refuse |
| 7 | Project stages outside the pipeline | pending the owner's run | Task 7: such a row keeps its stage until someone moves it |

Write the numbers into this table and repeat them in the task report. Do not commit the plan file yourself. If count 5 is 0, Task 7 Step 12 has no row to use and says so.

---

### Task 1: G2 — a share link writes only two fields

**Ships alone.** One commit, no dependency on any other task. A hotfix carries exactly: `src/shared/dal/server/types.ts`, `src/shared/modules/proposals/core/lib/proposal-guards.ts` (new) and `src/shared/modules/proposals/core/dal/server/crud.ts`. `scripts/verify-lifecycle-guards.ts` is not imported by the app and can stay behind. At plan time `types.ts` and `crud.ts` were identical on `origin/main` and local `main`.

**Files:**
- Modify: `src/shared/dal/server/types.ts` (after `SYSTEM_CONTEXT`)
- Create: `src/shared/modules/proposals/core/lib/proposal-guards.ts`
- Modify: `src/shared/modules/proposals/core/dal/server/crud.ts` (imports, `update.before`)
- Create: `scripts/verify-lifecycle-guards.ts`
- Test (throwaway): `.superpowers/sdd/2026-10-05-lifecycle-guards/tests/share-link.test.ts`

**Interfaces:**
- Produces: `isShareLinkContext(ctx: ScopedContext): boolean` (exported from `@/shared/dal/server/types`); `shareLinkWritableProposalFields` (`readonly ['financeOptionId', 'envelopeDocumentIds']`) and `isShareLinkWritable(data: Record<string, unknown>): boolean` (from `proposal-guards.ts`); `proposalCrud.update` refuses a share-link payload that names any other field with `{ type: 'forbidden' }`; `scripts/verify-lifecycle-guards.ts` with section 1 and the closing `✅` line that later tasks insert above.

- [ ] **Step 1: Who writes a proposal today (R29)**

Run: `grep -rn "proposalCrud\.update(\|proposalService\.update(" src scripts --include=*.ts --include=*.tsx`
Expected: 12 call sites and no `proposalService.update(`:

| Caller | Context | Fields |
|---|---|---|
| `src/trpc/routers/proposals.router/contracts.router.ts` (`applyEnvelopeContext`) | session **or share link** | `envelopeDocumentIds` |
| `src/trpc/routers/proposals.router/delivery.router.ts` (`sendProposalEmail`) | session | `status`, `sentAt` |
| `src/shared/services/contracts.service.ts` ×5 (create, send, recall, discard, resend) | session (`proposalProcedure`) | `contractEnvelopeId`, `contractSentAt` |
| `src/shared/services/contracts.service.ts` (`applyContractEvent`) | `SYSTEM_CONTEXT` (the Zoho sync job) | a contract timestamp, `status`, `approvedAt` |
| `src/shared/services/accounting.service.ts` ×3 | `SYSTEM_CONTEXT` | `qbInvoiceId`, `qbPaymentStatus` |
| `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts` | `buildUserContext` (has an ability) | `status` |

Run: `grep -rn "proposalsRouter\.crud\.update" src --include=*.ts --include=*.tsx`
Expected: three files reach the wire slot (`use-proposal-actions.ts`, `use-update-proposal.ts`, `assign-project-dialog.tsx`), and only one caller passes `token`:

| Wire caller | Sends `token` | Fields |
|---|---|---|
| `src/shared/modules/proposals/core/hooks/use-proposal-actions.ts` (records table) | no | `status`, `approvedAt`, `createdAt` |
| `src/features/proposal-flow/dal/client/mutations/use-update-proposal.ts` → `edit-proposal-view.tsx` | no | content fields |
| same hook → `src/features/proposal-flow/ui/components/proposal/funding.tsx` | **yes** | `financeOptionId` |
| `src/shared/entities/meetings/components/assign-project-dialog.tsx` | no | `status` |

So a share link reaches `proposalCrud.update` through exactly two callers, the financing pick and `applyEnvelopeContext`, and each writes one allowlisted field. Nothing legitimate writes any other field under a share link. If either grep shows a caller missing from these tables, stop and report it.

- [ ] **Step 2: Write the failing test**

Create `.superpowers/sdd/2026-10-05-lifecycle-guards/tests/share-link.test.ts`:

```ts
import type { ScopedContext } from '@/shared/dal/server/types'

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { sql } from 'drizzle-orm'

import { isShareLinkContext, SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { isShareLinkWritable } from '@/shared/modules/proposals/core/lib/proposal-guards'

const tokenScope = sql`true`
const session = { user: { id: 'u1', role: 'agent' } } as ScopedContext['session']

test('the public page\'s financing pick goes through', () => {
  assert.equal(isShareLinkWritable({ financeOptionId: 3 }), true)
})

test('the document selection saved after an age entry goes through', () => {
  assert.equal(isShareLinkWritable({ envelopeDocumentIds: [] }), true)
})

test('a share link cannot run the sale', () => {
  for (const field of ['status', 'kind', 'approvedAt', 'ownerId', 'token', 'label', 'projectJSON', 'meetingId', 'sentAt', 'contractEnvelopeId']) {
    assert.equal(isShareLinkWritable({ [field]: null }), false, field)
  }
})

test('one forbidden field refuses the whole payload', () => {
  assert.equal(isShareLinkWritable({ financeOptionId: 3, status: 'approved' }), false)
})

test('a field sent as undefined is still named', () => {
  assert.equal(isShareLinkWritable({ status: undefined }), false)
})

test('an empty payload writes nothing, so it passes', () => {
  assert.equal(isShareLinkWritable({}), true)
})

test('a token with no session is a share link', () => {
  assert.equal(isShareLinkContext({ session: null, ability: null, scope: tokenScope }), true)
})

test('a signed-in agent on a share URL is still on the share link', () => {
  assert.equal(isShareLinkContext({ session, ability: null, scope: tokenScope }), true)
})

test('the system context is not a share link', () => {
  assert.equal(isShareLinkContext(SYSTEM_CONTEXT), false)
})

test('a signed-in agent is not a share link, scoped or not', () => {
  const ability = defineAbilitiesFor({ id: 'u1', role: 'agent' })
  assert.equal(isShareLinkContext({ session, ability, scope: tokenScope }), false)
  assert.equal(isShareLinkContext({ session, ability, scope: null }), false)
})
```

- [ ] **Step 3: Run it to see it fail**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-05-lifecycle-guards/tests/share-link.test.ts`
Expected: FAIL (cannot find module `proposal-guards`).

- [ ] **Step 4: `isShareLinkContext`**

⚠️ The spec puts this in the shareable middleware's file; the DAL may not import tRPC, so it lives beside `SYSTEM_CONTEXT`.

In `src/shared/dal/server/types.ts`, directly after the `SYSTEM_CONTEXT` declaration, add:

```ts
/** A share link authorises by its scope alone: the token path sets a scope and no ability, the system context sets neither. */
export function isShareLinkContext(ctx: ScopedContext): boolean {
  return ctx.ability === null && ctx.scope !== null
}
```

Confirm the claim in the comment by reading `src/trpc/lib/middleware/shareable-middleware.ts` (the token path returns `ability: null, scope: eq(tokenColumn, token)`) and by running `grep -rn "ability: null" src --include=*.ts`. Expected: that middleware, `SYSTEM_CONTEXT`, and the two base contexts in `src/trpc/lib/create-http-context.ts` (both with `scope: null`). Any other producer of `ability: null` with a scope: stop and report.

- [ ] **Step 5: The allowlist**

Create `src/shared/modules/proposals/core/lib/proposal-guards.ts`:

```ts
/** What a share-link holder may write: the financing pick, and the document selection the page saves again after an age entry. */
export const shareLinkWritableProposalFields = ['financeOptionId', 'envelopeDocumentIds'] as const

/** True when every field the payload names is one a share-link holder may write. */
export function isShareLinkWritable(data: Record<string, unknown>): boolean {
  const writable: readonly string[] = shareLinkWritableProposalFields
  return Object.keys(data).every(field => writable.includes(field))
}
```

- [ ] **Step 6: Run the test**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-05-lifecycle-guards/tests/share-link.test.ts`
Expected: 10 pass.

- [ ] **Step 7: The hook**

In `src/shared/modules/proposals/core/dal/server/crud.ts`:

Change the `types` import to:

```ts
import { isShareLinkContext, SYSTEM_CONTEXT, ThrowableDalError } from '@/shared/dal/server/types'
```

Add, directly above the `proposal-lock` import:

```ts
import { isShareLinkWritable } from '@/shared/modules/proposals/core/lib/proposal-guards'
```

In `hooks.update.before`, rename the `_ctx` parameter to `ctx` and make these the first lines of the body, above `if (!touchesFrozenLockedFields(input))`:

```ts
        // A share link proves who the homeowner is, not that they may run the sale. Checked before any read,
        // and here rather than in the router so the in-process envelope-context write is held to it too.
        if (isShareLinkContext(ctx) && !isShareLinkWritable(input)) {
          throw new ThrowableDalError({ type: 'forbidden' })
        }
```

The hook runs inside the engine's `dalDbOperation` (`create-crud-dal.ts`, `updateImpl`), so the throw becomes a `forbidden` `DalReturn`; `dalToTrpc` maps it to `FORBIDDEN` for both the wire slot and `applyEnvelopeContext`. No sentence is wired for it: nothing legitimate triggers it, and the public page's generic toast arrives in Task 3.

- [ ] **Step 8: The committed check**

Create `scripts/verify-lifecycle-guards.ts`:

```ts
/* eslint-disable no-console */
// Pure checks of the sales lifecycle guards: no database, no network, nothing written.
// Run: pnpm exec tsx scripts/verify-lifecycle-guards.ts
import type { ScopedContext } from '@/shared/dal/server/types'

import assert from 'node:assert/strict'

import { getTableColumns, sql } from 'drizzle-orm'

import { isShareLinkContext, SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { proposals } from '@/shared/db/schema/proposals'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { isShareLinkWritable, shareLinkWritableProposalFields } from '@/shared/modules/proposals/core/lib/proposal-guards'

const proposalColumns = Object.keys(getTableColumns(proposals))

// ── 1. Share link ───────────────────────────────────────────────────────────
{
  const writable: readonly string[] = shareLinkWritableProposalFields
  assert.deepEqual([...writable].sort(), ['envelopeDocumentIds', 'financeOptionId'], 'the allowlist is the financing pick and the document selection')
  for (const column of proposalColumns) {
    assert.equal(isShareLinkWritable({ [column]: null }), writable.includes(column), `share link and ${column}`)
  }
  assert.equal(isShareLinkWritable({ financeOptionId: 3, status: 'approved' }), false, 'one forbidden field refuses the whole payload')
  assert.equal(isShareLinkWritable({ status: undefined }), false, 'a field sent as undefined is still named')
  assert.equal(isShareLinkWritable({}), true, 'an empty payload writes nothing')

  const tokenScope = sql`true`
  const session = { user: { id: 'u1', role: 'agent' } } as ScopedContext['session']
  assert.equal(isShareLinkContext({ session: null, ability: null, scope: tokenScope }), true, 'a token and no session')
  assert.equal(isShareLinkContext({ session, ability: null, scope: tokenScope }), true, 'a signed-in agent on a share URL')
  assert.equal(isShareLinkContext(SYSTEM_CONTEXT), false, 'the system context')
  assert.equal(isShareLinkContext({ session, ability: defineAbilitiesFor({ id: 'u1', role: 'agent' }), scope: tokenScope }), false, 'a scoped agent')
  assert.equal(isShareLinkContext({ session, ability: defineAbilitiesFor({ id: 'u2', role: 'super-admin' }), scope: null }), false, 'a super-admin')
}
console.log('1. Share link ✓')

console.log('✅ verify-lifecycle-guards passed')
```

Run: `pnpm exec tsx scripts/verify-lifecycle-guards.ts`
Expected: `1. Share link ✓` then `✅ verify-lifecycle-guards passed`, with no env file loaded and no database connection opened.

- [ ] **Step 9: Type-check, lint, code read**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

Read the saved `update.before` and write into the task report: the allowlist check is its first statement, above the lock check; it throws `forbidden`; the existing lock check below it is unchanged.

- [ ] **Step 10: Owner's write check (owner-designated proposal only)**

Ask the owner to name one `sent` proposal with no contract envelope, then, in a private window on its share link: pick a financing option → toast "Financing option updated", and the pick survives a reload. If the proposal's customer has no age yet, enter one on the first-time form → the documents list appears. Then, signed in as an agent in a normal window on the same share URL (with `?token=`), pick another option → same toast (Review Focus 1). If the owner prefers to run these by hand, give them this list.

- [ ] **Step 11: Commit**

```bash
git add -- src/shared/modules/proposals/core/lib/proposal-guards.ts scripts/verify-lifecycle-guards.ts
git commit -m "fix(proposals): a share link writes only its financing pick and its document selection

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/shared/dal/server/types.ts src/shared/modules/proposals/core/lib/proposal-guards.ts src/shared/modules/proposals/core/dal/server/crud.ts scripts/verify-lifecycle-guards.ts
git show --stat HEAD
```

---

### Task 2: G7 — project writes check the viewer's ability

**Ships alone.** One commit, no dependency on any other task. A hotfix carries the hunks below in `src/trpc/routers/projects.router/crud.router.ts` (the import and the three mutations) and the comment in `src/shared/modules/projects/core/server-spec.ts`. At plan time the three mutations were identical on `origin/main` and local `main`; the `list` procedure in the same file differs, so a hotfix applies the hunks, not the whole file.

**Files:**
- Modify: `src/trpc/routers/projects.router/crud.router.ts` (import, `create`, `update`, `delete`)
- Modify: `src/shared/modules/projects/core/server-spec.ts` (the spec's doc comment)
- Test (throwaway): `.superpowers/sdd/2026-10-05-lifecycle-guards/tests/project-abilities.test.ts`

**Interfaces:**
- Produces: `projectsRouter.crud.create`, `.update` and `.delete` throw `FORBIDDEN` for a viewer without `create` / `update` / `delete` on `Project`. Agents keep create and update; delete is super-admin only on the server, as the UI already shows it.

- [ ] **Step 1: Who writes a project today (R29)**

Run: `grep -rn "projectsRouter\.crud\.\(create\|update\|delete\)" src --include=*.ts --include=*.tsx`
Expected: four callers.

| Caller | Who can reach it in the UI | After this task |
|---|---|---|
| `src/features/project-management/ui/views/create-project-view.tsx` (`crud.create`) | agents, super-admins (Projects nav needs `read Project`) | unchanged: both hold `create Project` |
| `src/features/project-management/ui/views/edit-project-view.tsx` (`crud.update`) | agents, super-admins | unchanged: both hold `update Project` |
| `src/shared/modules/projects/core/hooks/use-project-actions.ts` (`crud.update`, portfolio toggle) | action permission `['update', 'Project']` | unchanged |
| same file (`crud.delete`) | action permission `['delete', 'Project']`: super-admins only | unchanged |

The refused cases are wire-only: a dispatcher calling any of the three (they pass `agentProcedure` but hold no Project ability, `src/shared/domains/permissions/abilities.ts`), and an agent calling delete. Server-side callers do not pass through this router: `accounting.service.ts` (`projectCrud.update`, `SYSTEM_CONTEXT`) and `projects.router/business.router.ts` (`projectCrud.create`; see Owner confirms 6).

- [ ] **Step 2: Pin the role matrix the checks read**

Create `.superpowers/sdd/2026-10-05-lifecycle-guards/tests/project-abilities.test.ts`:

```ts
import type { UserRole } from '@/shared/constants/enums'

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'

function projectWrites(role: UserRole): string[] {
  const ability = defineAbilitiesFor({ id: 'u1', role })
  return (['create', 'update', 'delete'] as const).filter(action => ability.can(action, 'Project'))
}

test('agents create and edit projects but never delete one', () => {
  assert.deepEqual(projectWrites('agent'), ['create', 'update'])
})

test('super-admins hold all three', () => {
  assert.deepEqual(projectWrites('super-admin'), ['create', 'update', 'delete'])
})

test('dispatchers, homeowners and plain users hold none', () => {
  assert.deepEqual(projectWrites('dispatcher'), [])
  assert.deepEqual(projectWrites('homeowner'), [])
  assert.deepEqual(projectWrites('user'), [])
})
```

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-05-lifecycle-guards/tests/project-abilities.test.ts`
Expected: 3 pass. This test does not go red first: the router has no pure rule to test, and a tRPC caller would need a database. It pins the matrix the checks below read. If it fails, stop: the abilities changed and the owner decides who writes projects.

- [ ] **Step 3: The three checks**

In `src/trpc/routers/projects.router/crud.router.ts`, add as the first import:

```ts
import { TRPCError } from '@trpc/server'
```

Replace the `create`, `update` and `delete` procedures (leave the comment above `create` and everything above it as it is) with:

```ts
  create: agentProcedure
    .input(projectFormSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.ability.cannot('create', 'Project')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to create projects' })
      }
      const { scopeIds, ...projectData } = input
      return dalToTrpc(await createProjectWithScopes({ ...ctx, scope: null }, projectData, scopeIds ?? []))
    }),

  update: agentProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: projectFormSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.ability.cannot('update', 'Project')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to update projects' })
      }
      const { scopeIds, ...projectData } = input.data
      const project = dalToTrpc(await updateProjectWithScopes({ ...ctx, scope: null }, input.id, projectData, scopeIds))
      // The public story page is prerendered; without this, edits only appear after the next deploy.
      revalidatePath(`/portfolio/projects/${project.accessor}`)
      return project
    }),

  delete: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.ability.cannot('delete', 'Project')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to delete projects' })
      }
      dalToTrpc(await projectCrud.delete({ ...ctx, scope: null }, { id: input.id }))
      return { success: true }
    }),
```

The update check is slot-level: no role holds a field-restricted `update Project`, and the payload also carries `scopeIds`, which is not a column.

- [ ] **Step 4: The spec comment that this makes false**

In `src/shared/modules/projects/core/server-spec.ts`, the doc comment above `projectServerSpec` ends:

```ts
 * identical to the pre-D feature-DAL path). Security tightening (route onto
 * `projectProcedure` for `ctx.scope`; gate `delete` on `can('delete','Project')`)
 * is the SEPARATE #285 tail — routing through crud does NOT tighten scope.
```

Replace those three lines with:

```ts
 * identical to the pre-D feature-DAL path). The router's writes check the viewer's
 * ability themselves; routing them onto `projectProcedure` for `ctx.scope` is the
 * SEPARATE #285 tail — routing through crud does NOT tighten scope.
```

- [ ] **Step 5: Type-check, lint, code read**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

Read the saved router and write into the task report: each of the three mutations checks its own action before any DAL call; `getAll`, `list` and `getForEdit` are untouched; the `{ ...ctx, scope: null }` contexts are untouched (scope is not this plan's).

- [ ] **Step 6: Commit**

```bash
git commit -m "fix(projects): project create, update and delete check the viewer's ability

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/trpc/routers/projects.router/crud.router.ts src/shared/modules/projects/core/server-spec.ts
git show --stat HEAD
```

---

### Task 3: G1 — `kind` and `token` never change, a proposal is created as a draft, and refused writes say why

**Files:**
- Create: `src/shared/modules/proposals/core/constants/refusals.ts`
- Create: `src/shared/dal/client/lib/refusal-message.ts`
- Modify: `src/shared/modules/proposals/core/lib/proposal-guards.ts`
- Modify: `src/shared/modules/proposals/core/server-spec.ts` (`updateProposalSchema` and its comment)
- Modify: `src/shared/modules/proposals/core/dal/server/crud.ts` (imports, `create.before`, `update.before`)
- Modify: `src/shared/modules/proposals/core/dal/server/mutations.ts` (`setCashInDeal`)
- Modify: `src/shared/modules/proposals/incentives/service.ts` (`replace`)
- Modify: `src/shared/modules/proposals/core/hooks/use-proposal-actions.ts` (`updateProposal`)
- Modify: `src/features/proposal-flow/ui/views/edit-proposal-view.tsx` (four toasts)
- Modify: `src/features/proposal-flow/ui/components/proposal/funding.tsx` (two `onError`)
- Modify: `scripts/verify-lifecycle-guards.ts` (section 2)
- Test (throwaway): `.superpowers/sdd/2026-10-05-lifecycle-guards/tests/frozen-fields.test.ts`, `…/tests/refusal-message.test.ts`

**Interfaces:**
- Consumes: `isShareLinkContext`, `isShareLinkWritable`, the Task 1 `update.before` (its allowlist check stays first).
- Produces: `PROPOSAL_REFUSALS` with `frozen`, `fieldFrozen`, `createdNotDraft` (each `{ reason, message }`); `Refusal` and `refusalMessage(error: unknown, refusals: Record<string, Refusal>): string | undefined`; `proposalFieldsFrozenAfterCreate`, `touchesFieldsFrozenAfterCreate(data: Record<string, unknown>): boolean`, `isDraftCreate(input: { status?: ProposalStatus, approvedAt?: string | null }): boolean`; `proposalSchemas.update` without `kind` and `token`; `proposalCrud.create` refuses a non-draft create with `proposal_created_not_draft`; `proposalCrud.update` refuses `kind` or `token` with `proposal_field_frozen`; the three `proposal_frozen` throw sites read `PROPOSAL_REFUSALS.frozen.reason`.

- [ ] **Step 1: Who creates a proposal, and who names `kind` or `token` (R29)**

Run: `grep -rn "proposalCrud\.\(create\|duplicate\)(\|proposalService\.\(create\|duplicate\)(\|proposalsRouter\.crud\.\(create\|duplicate\)" src scripts --include=*.ts --include=*.tsx`
Expected: only client hooks reach create and duplicate, through the wire slots: `use-create-proposal.ts` (used by `create-new-proposal-view.tsx`), and the duplicate mutations in `use-proposal-actions.ts` and `use-proposal-action-configs.ts`.

- `create-new-proposal-view.tsx` (`buildMutationData`) sends `label`, `ownerId`, `meetingId`, `priceDisplayMode`, `projectJSON` and the funding columns: no `status`, no `approvedAt`.
- Duplicate passes `status: 'draft'` (`duplicate.overrides`) and leaves `approvedAt` out (`duplicate.exclude`).

So no caller creates a proposal in another status. No caller names `kind` or `token` in an update either: `pnpm tsc` after Step 6 proves it for every object literal, and Task 1 Step 1's table lists every field the in-process callers send. If a caller shows up that does either, stop and report it.

- [ ] **Step 2: Write the failing tests**

Create `.superpowers/sdd/2026-10-05-lifecycle-guards/tests/frozen-fields.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isDraftCreate, touchesFieldsFrozenAfterCreate } from '@/shared/modules/proposals/core/lib/proposal-guards'

test('an update that names kind or token touches a frozen field', () => {
  assert.equal(touchesFieldsFrozenAfterCreate({ kind: 'additional-work' }), true)
  assert.equal(touchesFieldsFrozenAfterCreate({ token: 'tpr-0000000000000000' }), true)
  assert.equal(touchesFieldsFrozenAfterCreate({ label: 'Kitchen', kind: 'initial-sale' }), true)
})

test('naming one with the value it already has still counts', () => {
  assert.equal(touchesFieldsFrozenAfterCreate({ kind: undefined }), true)
})

test('status, content and contract fields are not frozen by this rule', () => {
  assert.equal(touchesFieldsFrozenAfterCreate({ status: 'declined', label: 'Kitchen', contractSentAt: null }), false)
  assert.equal(touchesFieldsFrozenAfterCreate({}), false)
})

test('a create with no status, or with draft, is a draft create', () => {
  assert.equal(isDraftCreate({}), true)
  assert.equal(isDraftCreate({ status: 'draft' }), true)
  assert.equal(isDraftCreate({ status: 'draft', approvedAt: null }), true)
})

test('a create in any other status is refused', () => {
  assert.equal(isDraftCreate({ status: 'sent' }), false)
  assert.equal(isDraftCreate({ status: 'approved' }), false)
  assert.equal(isDraftCreate({ status: 'declined' }), false)
})

test('a create that carries an approval time is refused, draft or not', () => {
  assert.equal(isDraftCreate({ approvedAt: '2026-10-05T17:00:00.000Z' }), false)
  assert.equal(isDraftCreate({ status: 'draft', approvedAt: '2026-10-05T17:00:00.000Z' }), false)
})
```

Create `.superpowers/sdd/2026-10-05-lifecycle-guards/tests/refusal-message.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { refusalMessage } from '@/shared/dal/client/lib/refusal-message'
import { PROPOSAL_REFUSALS } from '@/shared/modules/proposals/core/constants/refusals'

test('a refused write reads as its sentence', () => {
  assert.equal(refusalMessage(new Error(PROPOSAL_REFUSALS.frozen.reason), PROPOSAL_REFUSALS), PROPOSAL_REFUSALS.frozen.message)
  assert.equal(refusalMessage({ message: PROPOSAL_REFUSALS.fieldFrozen.reason }, PROPOSAL_REFUSALS), PROPOSAL_REFUSALS.fieldFrozen.message)
})

test('any other error has no sentence, so the caller\'s generic text shows', () => {
  assert.equal(refusalMessage(new Error('FORBIDDEN'), PROPOSAL_REFUSALS), undefined)
  assert.equal(refusalMessage(new Error('DalError: db-error'), PROPOSAL_REFUSALS), undefined)
  assert.equal(refusalMessage(undefined, PROPOSAL_REFUSALS), undefined)
  assert.equal(refusalMessage('proposal_frozen', PROPOSAL_REFUSALS), undefined)
})

test('a reason from another list is not this list\'s to word', () => {
  assert.equal(refusalMessage(new Error('set_by_not_internal'), PROPOSAL_REFUSALS), undefined)
})

test('the sentences are the approved ones', () => {
  assert.equal(PROPOSAL_REFUSALS.frozen.message, 'This proposal\'s contract has started, so its content is locked.')
  assert.equal(PROPOSAL_REFUSALS.fieldFrozen.message, 'That part of a proposal can\'t be changed.')
  assert.equal(PROPOSAL_REFUSALS.createdNotDraft.message, 'A new proposal starts as a draft.')
})
```

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-05-lifecycle-guards/tests/frozen-fields.test.ts .superpowers/sdd/2026-10-05-lifecycle-guards/tests/refusal-message.test.ts`
Expected: FAIL (missing exports and modules).

- [ ] **Step 4: The constant, `refusalMessage`, the guards**

Create `src/shared/modules/proposals/core/constants/refusals.ts`:

```ts
/** Why a proposal write was refused: the code the server throws, and the sentence a person reads for it. */
export const PROPOSAL_REFUSALS = {
  frozen: {
    reason: 'proposal_frozen',
    message: 'This proposal\'s contract has started, so its content is locked.',
  },
  fieldFrozen: {
    reason: 'proposal_field_frozen',
    message: 'That part of a proposal can\'t be changed.',
  },
  createdNotDraft: {
    reason: 'proposal_created_not_draft',
    message: 'A new proposal starts as a draft.',
  },
} as const
```

Create `src/shared/dal/client/lib/refusal-message.ts`:

```ts
/** A refused write: the code a server rule throws, and the sentence a person reads for it. */
export interface Refusal {
  reason: string
  message: string
}

/** The sentence for a refused write, or undefined for any other error, so nothing internal reaches a toast. */
export function refusalMessage(error: unknown, refusals: Record<string, Refusal>): string | undefined {
  // A refusal crosses the wire as the error's message (the reason code), whatever class carries it.
  const reason = typeof error === 'object' && error !== null && 'message' in error ? error.message : undefined
  return Object.values(refusals).find(refusal => refusal.reason === reason)?.message
}
```

In `src/shared/modules/proposals/core/lib/proposal-guards.ts`, add as the first line of the file:

```ts
import type { ProposalStatus } from '@/shared/constants/enums'
```

followed by a blank line, and append:

```ts
/** Set once by `create.before`: `kind` decides sale or upsell for good, and the token is the link already sent out. */
export const proposalFieldsFrozenAfterCreate = ['kind', 'token'] as const

/** True when an update payload names a field that never changes after create. */
export function touchesFieldsFrozenAfterCreate(data: Record<string, unknown>): boolean {
  return proposalFieldsFrozenAfterCreate.some(field => field in data)
}

/** A proposal is born a draft with no approval time; every later status is reached by an update. */
export function isDraftCreate(input: { status?: ProposalStatus, approvedAt?: string | null }): boolean {
  return (input.status === undefined || input.status === 'draft') && input.approvedAt == null
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-05-lifecycle-guards/tests/frozen-fields.test.ts .superpowers/sdd/2026-10-05-lifecycle-guards/tests/refusal-message.test.ts`
Expected: 10 pass. Re-run Task 1's `share-link.test.ts`: still 10 pass.

- [ ] **Step 6: The update schema drops `kind` and `token`**

In `src/shared/modules/proposals/core/server-spec.ts`, replace:

```ts
// `kind`/`token` are server-derived: `create.before` always overwrites them. The insert schema
// carries both as OPTIONAL (not omitted), so this partial() does NOT exclude them from updates —
// update-path field gating is owned by permissions epic #285.
const updateProposalSchema = insertProposalSchema.partial()
```

with:

```ts
// `kind` and `token` are set once by `create.before`. Left out here, a caller that names either in an
// update fails the type-check, and a wire payload that carries one has it stripped before the write.
const updateProposalSchema = insertProposalSchema.partial().omit({ kind: true, token: true })
```

Run: `pnpm tsc`
Expected: clean. An error here is a caller that names `kind` or `token` in an update: stop and report it (Step 1 found none).

- [ ] **Step 7: The hooks, and the three `proposal_frozen` sites**

In `src/shared/modules/proposals/core/dal/server/crud.ts`:

Add, directly above the `dal/server/mutations` import:

```ts
import { PROPOSAL_REFUSALS } from '@/shared/modules/proposals/core/constants/refusals'
```

Change the Task 1 guards import to:

```ts
import { isDraftCreate, isShareLinkWritable, touchesFieldsFrozenAfterCreate } from '@/shared/modules/proposals/core/lib/proposal-guards'
```

In `hooks.create.before`, add as the first statement of the body, above `if (!input.meetingId)`:

```ts
        if (!isDraftCreate(input)) {
          throw new ThrowableDalError({ type: 'precondition-failed', reason: PROPOSAL_REFUSALS.createdNotDraft.reason })
        }
```

Replace the whole body of `hooks.update.before` (keep the comment block above `update:` as it is) with:

```ts
      async before(input, ctx, meta) {
        // A share link proves who the homeowner is, not that they may run the sale. Checked before any read,
        // and here rather than in the router so the in-process envelope-context write is held to it too.
        if (isShareLinkContext(ctx) && !isShareLinkWritable(input)) {
          throw new ThrowableDalError({ type: 'forbidden' })
        }
        // The wire schema already strips these; this is for an in-process caller that got past the types.
        if (touchesFieldsFrozenAfterCreate(input)) {
          throw new ThrowableDalError({ type: 'precondition-failed', reason: PROPOSAL_REFUSALS.fieldFrozen.reason })
        }
        if (!touchesFrozenLockedFields(input)) {
          return input
        }
        const signals = dalVerifySuccess(await getProposalLockSignals(String(meta.id)))
        if (isProposalFrozen(signals)) {
          throw new ThrowableDalError({ type: 'precondition-failed', reason: PROPOSAL_REFUSALS.frozen.reason })
        }
        return input
      },
```

In `src/shared/modules/proposals/core/dal/server/mutations.ts`, add `import { PROPOSAL_REFUSALS } from '@/shared/modules/proposals/core/constants/refusals'` directly above the `proposal-lock` import, and in `setCashInDeal` change the throw to:

```ts
      throw new ThrowableDalError({ type: 'precondition-failed', reason: PROPOSAL_REFUSALS.frozen.reason })
```

In `src/shared/modules/proposals/incentives/service.ts`, add the same import directly above the `core/dal/server/mutations` import, and in `replace` change the throw to the same line.

Run: `grep -rn "'proposal_frozen'" src --include=*.ts --include=*.tsx`
Expected: one hit, in `constants/refusals.ts`.

- [ ] **Step 8: The words reach the person**

`src/shared/modules/proposals/core/hooks/use-proposal-actions.ts`: add the imports

```ts
import { refusalMessage } from '@/shared/dal/client/lib/refusal-message'
import { PROPOSAL_REFUSALS } from '@/shared/modules/proposals/core/constants/refusals'
```

and change `updateProposal`'s `onError` to:

```ts
    onError: err => toast.error(refusalMessage(err, PROPOSAL_REFUSALS) ?? 'Failed to update proposal'),
```

`src/features/proposal-flow/ui/views/edit-proposal-view.tsx`: add the same two imports, and change all four `error => toast.error(error.message)` callbacks (two in `onSubmit`, two in `onSave`; ⚠️ the spec names two of the four) to:

```tsx
            onError: error => toast.error(refusalMessage(error, PROPOSAL_REFUSALS) ?? error.message),
```

keeping each one's indentation. Other errors keep today's text.

`src/features/proposal-flow/ui/components/proposal/funding.tsx`: add the same two imports. In `pickFinancingOption`, the options object of `updateProposal.mutate` becomes:

```tsx
    }, {
      onSuccess: () => {
        toast.success('Financing option updated')
      },
      onError: err => toast.error(refusalMessage(err, PROPOSAL_REFUSALS) ?? 'Couldn\'t save the financing option'),
    })
```

and the options object of `saveCashInDeal.mutate` (the cash-down Save button) becomes:

```tsx
                              }, {
                                onSuccess: () => {
                                  toast.success('Cash in deal updated')
                                },
                                onError: err => toast.error(refusalMessage(err, PROPOSAL_REFUSALS) ?? 'Couldn\'t save the cash amount'),
                              })
```

Both writes are refused with `proposal_frozen` once a contract draft exists, and failed silently until now. A share-link `forbidden` (Task 1) falls to the generic text.

`proposal_created_not_draft` gets no client step: no screen can send it (Step 1), so its sentence is reached only by a wire caller. `create-new-proposal-view.tsx` is not touched.

- [ ] **Step 9: The committed check, section 2**

In `scripts/verify-lifecycle-guards.ts`: add `import { proposalStatuses } from '@/shared/constants/enums'` as the first `@/` value import, extend the guards import to `{ isDraftCreate, isShareLinkWritable, shareLinkWritableProposalFields, touchesFieldsFrozenAfterCreate }`, and insert above the final `✅` line:

```ts
// ── 2. Frozen fields and the draft-only create ──────────────────────────────
{
  for (const column of proposalColumns) {
    assert.equal(touchesFieldsFrozenAfterCreate({ [column]: null }), column === 'kind' || column === 'token', `frozen after create: ${column}`)
  }
  assert.equal(touchesFieldsFrozenAfterCreate({}), false, 'an empty update names nothing')
  for (const status of proposalStatuses) {
    assert.equal(isDraftCreate({ status }), status === 'draft', `a proposal created as ${status}`)
    assert.equal(isDraftCreate({ status, approvedAt: '2026-10-05T17:00:00.000Z' }), false, `created as ${status} with an approval time`)
  }
  assert.equal(isDraftCreate({}), true, 'no status is the default draft')
  assert.equal(isDraftCreate({ approvedAt: null }), true, 'an empty approval time is no approval time')
}
console.log('2. Frozen fields and the draft-only create ✓')
```

Run: `pnpm exec tsx scripts/verify-lifecycle-guards.ts`
Expected: sections 1 and 2, then `✅`.

- [ ] **Step 10: Type-check, lint, code read**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

Confirm by reading the saved files, and write each into the task report:
- `update.before` order: share-link allowlist, frozen fields, lock ladder.
- ⚠️ Spec difference, on purpose: `proposalSchemas.update` no longer has `kind` or `token`, so `createCrudRouter`'s input parse strips them from a wire payload. A wire update of `{ kind }` alone reaches the engine as an empty update, which returns the row unchanged (`updateImpl`, "An empty update is a no-op"). The refusal in the hook is for in-process callers.
- The Zoho job's payload (`contractSignedAt`, `status`, sometimes `approvedAt`), the accounting payloads and the contract-service payloads name neither `kind` nor `token` (Task 1 Step 1's table), so none can hit `proposal_field_frozen`.
- `duplicate` still passes `status: 'draft'` and no `approvedAt`, so a duplicate passes `isDraftCreate`.

- [ ] **Step 11: Commit**

```bash
git add -- src/shared/modules/proposals/core/constants/refusals.ts src/shared/dal/client/lib/refusal-message.ts
git commit -m "feat(proposals): kind and token never change after create; a proposal is created as a draft; a refused update says why

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/shared/modules/proposals/core/constants/refusals.ts src/shared/dal/client/lib/refusal-message.ts src/shared/modules/proposals/core/lib/proposal-guards.ts src/shared/modules/proposals/core/server-spec.ts src/shared/modules/proposals/core/dal/server/crud.ts src/shared/modules/proposals/core/dal/server/mutations.ts src/shared/modules/proposals/incentives/service.ts src/shared/modules/proposals/core/hooks/use-proposal-actions.ts src/features/proposal-flow/ui/views/edit-proposal-view.tsx src/features/proposal-flow/ui/components/proposal/funding.tsx scripts/verify-lifecycle-guards.ts
git show --stat HEAD
```

---

### Task 4: G4 — the server stamps `approvedAt`

**Files:**
- Modify: `src/shared/modules/proposals/core/lib/proposal-guards.ts`
- Modify: `src/shared/modules/proposals/core/dal/server/crud.ts` (factory argument, imports, `update.before`)
- Modify (ruling B only): `src/shared/services/contracts.service.ts` (`applyContractEvent`)
- Modify: `src/features/proposal-flow/ui/components/table/index.tsx` (two mutations)
- Modify: `src/shared/entities/meetings/components/assign-project-dialog.tsx` (approve toast)
- Modify: `scripts/verify-lifecycle-guards.ts` (section 3)
- Test (throwaway): `.superpowers/sdd/2026-10-05-lifecycle-guards/tests/approved-at.test.ts`

**Interfaces:**
- Consumes: Task 3's `update.before`, `PROPOSAL_REFUSALS.fieldFrozen`, `refusalMessage`.
- Produces: `ProposalWriteContext = 'user' | 'share-link' | 'system'`; `canSetApprovedAt(context: ProposalWriteContext): boolean`; `resolveApprovedAt(args: { stored: { status: ProposalStatus, approvedAt: string | null }, payloadApprovedAt: string | null | undefined, now: string }): string | null`; `proposalCrud.update` refuses `approvedAt` from a user with `proposal_field_frozen`, and on `status: 'approved'` writes the approval time `resolveApprovedAt` returns.

- [ ] **Step 1: Blocked: needs a ruling**

**Ruled 2026-10-06 by the owner: B.** Use the B blocks below; the A blocks stay for the record.

The spec's rule: on `status: 'approved'`, if the stored row was not approved, stamp `approvedAt` with the payload's value, else now; if it was already approved, keep the stored `approvedAt` and drop the payload's. The only caller that sends a value is the Zoho signature path (`contractService.applyContractEvent`, `SYSTEM_CONTEXT`), which sends the signing time only when the stored `approvedAt` is empty. Two cases come out differently from today:

| | Case | Today | Spec as written |
|---|---|---|---|
| (a) | An **approved** proposal with **no** `approvedAt` (Task 0 count 1; the rules map found 5, all manual approvals) is then signed in Zoho | the signing time fills the empty stamp | the payload is dropped; the stamp stays empty until slice 5's backfill |
| (b) | A proposal approved once, then set back by hand (it keeps the old stamp; Task 0 count 2), is then signed in Zoho | the old stamp stays | Zoho sends no time (the stamp is not empty), so the proposal becomes approved stamped with the job's clock, not the signing time |

Neither case refuses a signature: the status and `contractSignedAt` are written either way. What changes is the stored approval time, which dates the sale (`classifySale`).

- **Ruling A — the spec as written.** No extra file. (a) stays empty; (b) gets the job's clock.
- **Ruling B — recommended.** A system stamp fills an empty one, and the contract path always sends the signing time and lets the hook decide. (a) is filled with the signing time, as today; (b) is stamped with the signing time. A user's re-click on an approved proposal with no stamp still writes nothing. Cost: three lines in `contracts.service.ts` (Step 8) and one changed line in `resolveApprovedAt`.

Write the ruling into the task report. The steps below carry an "A" and a "B" block wherever they differ; use the ruled one and delete nothing from the plan.

- [ ] **Step 2: Who names `approvedAt` today (R29)**

Run: `grep -rn "approvedAt: new Date\|approvedAt = \|setFields.approvedAt" src --include=*.ts --include=*.tsx`
Expected: three writers.

| Writer | Context | After this task |
|---|---|---|
| `src/features/proposal-flow/ui/components/table/index.tsx` ×2 (the status cell's approve, and the approve after the project form) | user, wire | stops sending it (Step 9); the server stamps |
| `src/shared/services/contracts.service.ts` (`applyContractEvent`) | `SYSTEM_CONTEXT` | still allowed to send it |

`assign-project-dialog.tsx` sends `status: 'approved'` alone and starts getting a stamp. No share-link caller sends it (Task 1's allowlist would refuse it first). So the only legitimate user-context sender is the status cell, and this task changes it in the same commit.

- [ ] **Step 3: Write the failing test**

Create `.superpowers/sdd/2026-10-05-lifecycle-guards/tests/approved-at.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { canSetApprovedAt, resolveApprovedAt } from '@/shared/modules/proposals/core/lib/proposal-guards'

const NOW = '2026-10-05T19:00:00.000Z'
const SIGNED = '2026-10-05T18:42:10.000Z'
const FIRST = '2026-08-01T17:00:00.000Z'

test('only the system names an approval time', () => {
  assert.equal(canSetApprovedAt('system'), true)
  assert.equal(canSetApprovedAt('user'), false)
  assert.equal(canSetApprovedAt('share-link'), false)
})

test('a first approval by hand is stamped now', () => {
  assert.equal(resolveApprovedAt({ stored: { status: 'sent', approvedAt: null }, payloadApprovedAt: undefined, now: NOW }), NOW)
  assert.equal(resolveApprovedAt({ stored: { status: 'draft', approvedAt: null }, payloadApprovedAt: undefined, now: NOW }), NOW)
})

test('a signature that approves is stamped with the signing time', () => {
  assert.equal(resolveApprovedAt({ stored: { status: 'sent', approvedAt: null }, payloadApprovedAt: SIGNED, now: NOW }), SIGNED)
})

test('re-clicking approved keeps the first stamp', () => {
  assert.equal(resolveApprovedAt({ stored: { status: 'approved', approvedAt: FIRST }, payloadApprovedAt: undefined, now: NOW }), FIRST)
})

test('a signature on an already approved proposal keeps the first stamp', () => {
  assert.equal(resolveApprovedAt({ stored: { status: 'approved', approvedAt: FIRST }, payloadApprovedAt: SIGNED, now: NOW }), FIRST)
})

test('approving again after it was set back is a new approval', () => {
  assert.equal(resolveApprovedAt({ stored: { status: 'declined', approvedAt: FIRST }, payloadApprovedAt: undefined, now: NOW }), NOW)
  assert.equal(resolveApprovedAt({ stored: { status: 'declined', approvedAt: FIRST }, payloadApprovedAt: SIGNED, now: NOW }), SIGNED)
})

test('re-clicking approved on a proposal with no stamp never invents one', () => {
  assert.equal(resolveApprovedAt({ stored: { status: 'approved', approvedAt: null }, payloadApprovedAt: undefined, now: NOW }), null)
})
```

Then append the case for the ruling.

Ruling A:

```ts
test('an approved proposal with no stamp stays unstamped when a signature arrives', () => {
  assert.equal(resolveApprovedAt({ stored: { status: 'approved', approvedAt: null }, payloadApprovedAt: SIGNED, now: NOW }), null)
})
```

Ruling B:

```ts
test('a signature fills the missing stamp of an approved proposal', () => {
  assert.equal(resolveApprovedAt({ stored: { status: 'approved', approvedAt: null }, payloadApprovedAt: SIGNED, now: NOW }), SIGNED)
})
```

- [ ] **Step 4: Run it to see it fail**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-05-lifecycle-guards/tests/approved-at.test.ts`
Expected: FAIL (`canSetApprovedAt` is not exported).

- [ ] **Step 5: The guards**

Append to `src/shared/modules/proposals/core/lib/proposal-guards.ts`:

```ts
/** Who is behind a write: a signed-in user, a share-link holder, or the system (jobs and the contract path). */
export type ProposalWriteContext = 'user' | 'share-link' | 'system'

/** Only the system names an approval time (the moment a contract was signed); anyone else's would be their own clock. */
export function canSetApprovedAt(context: ProposalWriteContext): boolean {
  return context === 'system'
}

interface ApprovedAtInput {
  /** The row as stored, before this update. */
  stored: { status: ProposalStatus, approvedAt: string | null }
  /** The time the update itself carries; only the system sends one. */
  payloadApprovedAt: string | null | undefined
  now: string
}
```

Then the function for the ruling.

Ruling A:

```ts
/** The approval time to store when an update sets `status: 'approved'`. */
export function resolveApprovedAt({ stored, payloadApprovedAt, now }: ApprovedAtInput): string | null {
  if (stored.status !== 'approved') {
    return payloadApprovedAt ?? now
  }
  // Already approved: the first stamp is the sale's date, so nothing moves it.
  return stored.approvedAt
}
```

Ruling B:

```ts
/** The approval time to store when an update sets `status: 'approved'`. */
export function resolveApprovedAt({ stored, payloadApprovedAt, now }: ApprovedAtInput): string | null {
  if (stored.status !== 'approved') {
    return payloadApprovedAt ?? now
  }
  // Already approved: the first stamp is the sale's date, so nothing moves it. A missing one is filled only
  // by a time the caller knows (a signing time), never by `now`, which would date an old sale today.
  return stored.approvedAt ?? payloadApprovedAt ?? null
}
```

- [ ] **Step 6: Run the test**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-05-lifecycle-guards/tests/approved-at.test.ts`
Expected: 8 pass.

- [ ] **Step 7: The hook**

In `src/shared/modules/proposals/core/dal/server/crud.ts`:

Change the factory's first line so the hook can read its own entity's stored row:

```ts
export const proposalCrud = createCrudDal(proposalServerSpec, crudHandlers => ({
```

Add, directly below the existing `import type { Proposal } from '@/shared/db/schema'` line:

```ts
import type { ProposalWriteContext } from '@/shared/modules/proposals/core/lib/proposal-guards'
```

Add `canSetApprovedAt` and `resolveApprovedAt` to the guards value import, keeping every name already there (Task 6 adds `proposalDeleteRefusal` and may have been built first). With only Tasks 1–3 built it reads:

```ts
import { canSetApprovedAt, isDraftCreate, isShareLinkWritable, resolveApprovedAt, touchesFieldsFrozenAfterCreate } from '@/shared/modules/proposals/core/lib/proposal-guards'
```

Replace the whole body of `hooks.update.before` with:

```ts
      async before(input, ctx, meta) {
        // A share link proves who the homeowner is, not that they may run the sale. Checked before any read,
        // and here rather than in the router so the in-process envelope-context write is held to it too.
        if (isShareLinkContext(ctx) && !isShareLinkWritable(input)) {
          throw new ThrowableDalError({ type: 'forbidden' })
        }
        // The wire schema already strips these; this is for an in-process caller that got past the types.
        if (touchesFieldsFrozenAfterCreate(input)) {
          throw new ThrowableDalError({ type: 'precondition-failed', reason: PROPOSAL_REFUSALS.fieldFrozen.reason })
        }
        const context: ProposalWriteContext = isShareLinkContext(ctx) ? 'share-link' : ctx.ability ? 'user' : 'system'
        if ('approvedAt' in input && !canSetApprovedAt(context)) {
          throw new ThrowableDalError({ type: 'precondition-failed', reason: PROPOSAL_REFUSALS.fieldFrozen.reason })
        }

        let next = input
        if (input.status === 'approved') {
          // The stored row decides: a first approval is stamped, a repeat keeps the stamp it has. Read and
          // write stay two statements, as the lock check below is.
          const stored = dalVerifySuccess(await crudHandlers.getById(SYSTEM_CONTEXT, { id: meta.id }))
          if (!stored) {
            throw new ThrowableDalError({ type: 'not-found' })
          }
          next = { ...input, approvedAt: resolveApprovedAt({ stored, payloadApprovedAt: input.approvedAt, now: new Date().toISOString() }) }
        }

        if (!touchesFrozenLockedFields(next)) {
          return next
        }
        const signals = dalVerifySuccess(await getProposalLockSignals(String(meta.id)))
        if (isProposalFrozen(signals)) {
          throw new ThrowableDalError({ type: 'precondition-failed', reason: PROPOSAL_REFUSALS.frozen.reason })
        }
        return next
      },
```

The stored read uses `SYSTEM_CONTEXT`, as the lead-sources crud does for the same purpose: it exposes nothing, and the write below it still applies `ctx.scope`. `update.after` reads `meta.input` (the original payload), so the recompute trigger is unchanged.

- [ ] **Step 8: Ruling B only — the contract path always sends the signing time**

Skip this step under ruling A.

In `src/shared/services/contracts.service.ts`, `applyContractEvent`, replace:

```ts
      if (shouldAutoApproveOnContractEvent(event)) {
        setFields.status = 'approved'
        if (!proposal.approvedAt) {
          setFields.approvedAt = performedAt
        }
      }
```

with:

```ts
      if (shouldAutoApproveOnContractEvent(event)) {
        setFields.status = 'approved'
        // Always the signing time: the crud hook keeps the stamp of a proposal that is already approved.
        setFields.approvedAt = performedAt
      }
```

- [ ] **Step 9: The callers**

`src/features/proposal-flow/ui/components/table/index.tsx`: in `handleStatusChange`, change

```tsx
          { id, data: { status: 'approved' as ProposalStatus, approvedAt: new Date().toISOString() } },
```

to

```tsx
          { id, data: { status: 'approved' as ProposalStatus } },
```

and in `handleProjectCreated`, change

```tsx
      data: { status: 'approved' as ProposalStatus, approvedAt: new Date().toISOString() },
```

to

```tsx
      data: { status: 'approved' as ProposalStatus },
```

Run: `grep -rn "approvedAt: new Date" src --include=*.ts --include=*.tsx`
Expected: no hits (Review Focus 3: no current client sends it). A tab loaded before the deploy still does and gets "Failed to update proposal" from its old bundle until reloaded; put that sentence in the task report for the owner.

`src/shared/entities/meetings/components/assign-project-dialog.tsx`: add the imports

```tsx
import { refusalMessage } from '@/shared/dal/client/lib/refusal-message'
import { PROPOSAL_REFUSALS } from '@/shared/modules/proposals/core/constants/refusals'
```

and change `approveProposalMutation`'s `onError` to:

```tsx
      onError: err => toast.error(refusalMessage(err, PROPOSAL_REFUSALS) ?? 'Failed to approve proposal'),
```

`handleApproveProposal` is not touched: it already sends `status: 'approved'` alone.

- [ ] **Step 10: The committed check, section 3**

In `scripts/verify-lifecycle-guards.ts`, add `canSetApprovedAt` and `resolveApprovedAt` to the guards import and insert above the final `✅` line:

```ts
// ── 3. The approval time ────────────────────────────────────────────────────
{
  const NOW = '2026-10-05T19:00:00.000Z'
  const SIGNED = '2026-10-05T18:42:10.000Z'
  const FIRST = '2026-08-01T17:00:00.000Z'

  assert.equal(canSetApprovedAt('system'), true, 'the contract path names the signing time')
  assert.equal(canSetApprovedAt('user'), false, 'a user\'s payload may not carry an approval time')
  assert.equal(canSetApprovedAt('share-link'), false, 'nor may a share link\'s')

  for (const status of proposalStatuses.filter(s => s !== 'approved')) {
    assert.equal(resolveApprovedAt({ stored: { status, approvedAt: null }, payloadApprovedAt: undefined, now: NOW }), NOW, `${status} → approved by hand is stamped now`)
    assert.equal(resolveApprovedAt({ stored: { status, approvedAt: null }, payloadApprovedAt: SIGNED, now: NOW }), SIGNED, `${status} → approved by signature is stamped with the signing time`)
    assert.equal(resolveApprovedAt({ stored: { status, approvedAt: FIRST }, payloadApprovedAt: undefined, now: NOW }), NOW, `${status} with an old stamp → approved is a new approval`)
  }
  assert.equal(resolveApprovedAt({ stored: { status: 'approved', approvedAt: FIRST }, payloadApprovedAt: undefined, now: NOW }), FIRST, 'staying approved keeps the stamp')
  assert.equal(resolveApprovedAt({ stored: { status: 'approved', approvedAt: FIRST }, payloadApprovedAt: SIGNED, now: NOW }), FIRST, 'a signature never moves an existing stamp')
  assert.equal(resolveApprovedAt({ stored: { status: 'approved', approvedAt: null }, payloadApprovedAt: undefined, now: NOW }), null, 'a re-click never invents a stamp')
}
console.log('3. The approval time ✓')
```

and, inside that block before its closing brace, the line for the ruling.

Ruling A:

```ts
  assert.equal(resolveApprovedAt({ stored: { status: 'approved', approvedAt: null }, payloadApprovedAt: SIGNED, now: NOW }), null, 'an approved proposal with no stamp stays unstamped')
```

Ruling B:

```ts
  assert.equal(resolveApprovedAt({ stored: { status: 'approved', approvedAt: null }, payloadApprovedAt: SIGNED, now: NOW }), SIGNED, 'a signature fills a missing stamp')
```

Run: `pnpm exec tsx scripts/verify-lifecycle-guards.ts`
Expected: sections 1–3, then `✅`.

- [ ] **Step 11: Type-check, lint, and the signature read**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

Review Focus 2. Read `applyContractEvent` and `update.before` side by side and write into the task report, for the `completed` event's payload (`contractSignedAt`, `status: 'approved'`, and `approvedAt` when sent) under `SYSTEM_CONTEXT`:
- not a share link (no ability, no scope), so the allowlist does not apply;
- names neither `kind` nor `token`;
- the context is `system`, so `approvedAt` may be carried;
- the stored row is found (the service read the same row by envelope id a moment earlier);
- none of its fields is in `frozenProposalLockedFields`, so the lock check returns early.

No branch throws. Do the same read for the `viewed` and `declined` payloads (one timestamp, no status) and for the kanban's `{ status: 'declined' }` and the send's `{ status: 'sent', sentAt }` (users, no `approvedAt`).

- [ ] **Step 12: Commit**

Under ruling A, leave `src/shared/services/contracts.service.ts` out of the pathspec.

```bash
git commit -m "feat(proposals): the server stamps approvedAt once, when a proposal becomes approved; no user or share link names it

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/shared/modules/proposals/core/lib/proposal-guards.ts src/shared/modules/proposals/core/dal/server/crud.ts src/shared/services/contracts.service.ts src/features/proposal-flow/ui/components/table/index.tsx src/shared/entities/meetings/components/assign-project-dialog.tsx scripts/verify-lifecycle-guards.ts
git show --stat HEAD
```

---

### Task 5: G3 — a proposal is sent only from draft or sent

**Files:**
- Modify: `src/shared/modules/proposals/core/constants/refusals.ts` (`notSendable`)
- Modify: `src/shared/modules/proposals/core/lib/proposal-guards.ts` (`canSendProposal`)
- Modify: `src/trpc/routers/proposals.router/delivery.router.ts` (`sendProposalEmail`)
- Modify: `src/shared/components/contract-status-panel/ui/proposal-card.tsx` (`runSend`)
- Modify: `scripts/verify-lifecycle-guards.ts` (section 4)
- Test (throwaway): `.superpowers/sdd/2026-10-05-lifecycle-guards/tests/can-send.test.ts`

**Interfaces:**
- Consumes: `PROPOSAL_REFUSALS`, `refusalMessage` (Task 3).
- Produces: `PROPOSAL_REFUSALS.notSendable`; `canSendProposal(status: ProposalStatus): boolean`; `proposalsRouter.delivery.sendProposalEmail` throws `PRECONDITION_FAILED` with the reason as its message before the email is composed.

- [ ] **Step 1: Who sends (R29)**

Run: `grep -rn "useSendProposal\b\|delivery\.sendProposalEmail" src --include=*.ts --include=*.tsx`
Expected: one hook (`use-send-proposal.ts`) and one user of it, `src/shared/components/contract-status-panel/ui/proposal-card.tsx`. That card renders "Send Proposal Email" only when the proposal is not sent, approved or declined (a draft), and "Resend Proposal Email" only when it is sent. An approved or declined proposal has no send button, so the refused cases are wire-only.

- [ ] **Step 2: Write the failing test**

Create `.superpowers/sdd/2026-10-05-lifecycle-guards/tests/can-send.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { PROPOSAL_REFUSALS } from '@/shared/modules/proposals/core/constants/refusals'
import { canSendProposal } from '@/shared/modules/proposals/core/lib/proposal-guards'

test('a draft is sent, and a sent proposal is sent again', () => {
  assert.equal(canSendProposal('draft'), true)
  assert.equal(canSendProposal('sent'), true)
})

test('an approved or declined proposal is never re-opened by a send', () => {
  assert.equal(canSendProposal('approved'), false)
  assert.equal(canSendProposal('declined'), false)
})

test('the sentence is the approved one', () => {
  assert.equal(PROPOSAL_REFUSALS.notSendable.reason, 'proposal_not_sendable')
  assert.equal(PROPOSAL_REFUSALS.notSendable.message, 'Only a draft or sent proposal can be sent.')
})
```

- [ ] **Step 3: Run it to see it fail**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-05-lifecycle-guards/tests/can-send.test.ts`
Expected: FAIL (`canSendProposal` is not exported).

- [ ] **Step 4: The guard and its sentence**

In `src/shared/modules/proposals/core/constants/refusals.ts`, add after the `createdNotDraft` entry:

```ts
  notSendable: {
    reason: 'proposal_not_sendable',
    message: 'Only a draft or sent proposal can be sent.',
  },
```

Append to `src/shared/modules/proposals/core/lib/proposal-guards.ts`:

```ts
/** A send moves a proposal to `sent`; from approved or declined that would re-open a closed one. */
export function canSendProposal(status: ProposalStatus): boolean {
  return status === 'draft' || status === 'sent'
}
```

- [ ] **Step 5: Run the test**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-05-lifecycle-guards/tests/can-send.test.ts`
Expected: 3 pass.

- [ ] **Step 6: The check, before the email**

In `src/trpc/routers/proposals.router/delivery.router.ts`, add the imports (in path order, among the `@/shared/modules/proposals/…` imports):

```ts
import { PROPOSAL_REFUSALS } from '@/shared/modules/proposals/core/constants/refusals'
import { canSendProposal } from '@/shared/modules/proposals/core/lib/proposal-guards'
```

In `sendProposalEmail`, make these the first statements of the mutation body, above the `// 1. Send email` comment:

```ts
      // Before the email: an email already sent can't be taken back by a refusal.
      const current = dalToTrpc(await proposalCrud.getById(ctx, { id: input.proposalId }))
      if (!current) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
      }
      if (!canSendProposal(current.status)) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: PROPOSAL_REFUSALS.notSendable.reason })
      }
```

`TRPCError`, `dalToTrpc` and `proposalCrud` are already imported there. The read runs under the agent's own scope, so a proposal they cannot see is `NOT_FOUND` before any email, where today the email went out first and the update failed after.

- [ ] **Step 7: The words reach the person**

In `src/shared/components/contract-status-panel/ui/proposal-card.tsx`, add the imports

```tsx
import { refusalMessage } from '@/shared/dal/client/lib/refusal-message'
import { PROPOSAL_REFUSALS } from '@/shared/modules/proposals/core/constants/refusals'
```

and in `runSend` change the `catch` body to:

```tsx
      toast.error(refusalMessage(err, PROPOSAL_REFUSALS) ?? (err instanceof Error ? err.message : 'Failed to send proposal email'))
```

⚠️ The spec's toast list leaves this one out; without it a refused send shows `proposal_not_sendable`.

- [ ] **Step 8: The committed check, section 4**

In `scripts/verify-lifecycle-guards.ts`, add `canSendProposal` to the guards import and insert above the final `✅` line:

```ts
// ── 4. Send ─────────────────────────────────────────────────────────────────
{
  const sendable: Record<(typeof proposalStatuses)[number], boolean> = { draft: true, sent: true, approved: false, declined: false }
  for (const status of proposalStatuses) {
    assert.equal(canSendProposal(status), sendable[status], `sending a ${status} proposal`)
  }
}
console.log('4. Send ✓')
```

The `Record` over every status makes a status added later a type error here until someone decides whether it can be sent.

Run: `pnpm exec tsx scripts/verify-lifecycle-guards.ts`
Expected: sections 1–4 (section 3 only if Task 4 is built), then `✅`.

- [ ] **Step 9: Type-check, lint, code read**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

Read the saved mutation and confirm in the task report: the status read and both refusals sit above `emailService.sendProposalEmail`; the update and the meeting-outcome call below are unchanged.

- [ ] **Step 10: Commit**

```bash
git commit -m "feat(proposals): a proposal is sent only from draft or sent, checked before the email goes out

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/shared/modules/proposals/core/constants/refusals.ts src/shared/modules/proposals/core/lib/proposal-guards.ts src/trpc/routers/proposals.router/delivery.router.ts src/shared/components/contract-status-panel/ui/proposal-card.tsx scripts/verify-lifecycle-guards.ts
git show --stat HEAD
```

---

### Task 6: G5 — delete guards on proposals and meetings

**Files:**
- Modify: `src/shared/modules/proposals/core/constants/refusals.ts` (`deleteApproved`, `deleteHasContract`)
- Modify: `src/shared/modules/proposals/core/lib/proposal-guards.ts` (`proposalDeleteRefusal`)
- Modify: `src/shared/modules/proposals/core/dal/server/crud.ts` (a `delete` hook; the "No `delete` hook" comment)
- Modify: `src/shared/modules/proposals/core/hooks/use-proposal-actions.ts` (`deleteProposal`)
- Modify: `src/shared/modules/proposals/core/hooks/use-proposal-action-configs.ts` (`ProposalEntity`, `deleteProposal`, the delete config)
- Create: `src/shared/entities/meetings/constants/refusals.ts`
- Create: `src/shared/entities/meetings/lib/meeting-guards.ts`
- Modify: `src/shared/entities/meetings/dal/server/queries.ts` (`meetingHoldsApprovedProposal`) — **the setter build edits this file (its Task 2); if `git status --short` shows it dirty, wait for that commit or ask**
- Modify: `src/shared/entities/meetings/dal/server/crud.ts` (`delete.before`) — carries the setter rules; find `delete.before` by name
- Modify: `src/shared/entities/meetings/hooks/use-meeting-actions.ts` (`deleteMeeting`) and `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx` (`MeetingEntity`, the delete config) — **the setter build edits both (its Task 4); same rule**
- Modify: `scripts/verify-lifecycle-guards.ts` (section 5)
- Test (throwaway): `.superpowers/sdd/2026-10-05-lifecycle-guards/tests/delete-guards.test.ts`

**Interfaces:**
- Consumes: `PROPOSAL_REFUSALS`, `refusalMessage` (Task 3).
- Produces: `PROPOSAL_REFUSALS.deleteApproved`, `.deleteHasContract`; `proposalDeleteRefusal(proposal: { status?: string | null, contractEnvelopeId?: string | null })` returning one of those two entries or `null`; `MEETING_REFUSALS.deleteHasApprovedProposal`; `meetingDeleteRefusal(meeting: { hasApprovedProposal?: boolean })` returning that entry or `null`; `meetingHoldsApprovedProposal(id: string): Promise<boolean>`; `proposalCrud.delete` and `meetingCrud.delete` refuse with `precondition-failed` and the entry's reason; `ProposalEntity.status?`, `ProposalEntity.contractEnvelopeId?`, `MeetingEntity.hasApprovedProposal?`.

- [ ] **Step 1: Who deletes (R29)**

Run: `grep -rn "proposalCrud\.delete(\|proposalService\.delete(\|proposalsRouter\.crud\.delete\|meetingCrud\.delete(\|meetingsRouter\.crud\.delete" src scripts --include=*.ts --include=*.tsx`
Expected:

| Caller | Who | After this task |
|---|---|---|
| wire `proposalsRouter.crud.delete` (`use-proposal-actions.ts`, `use-proposal-action-configs.ts`) | super-admins only (`createCrudRouter` asserts `delete Proposal`) | refused for an approved proposal or one with a contract envelope. Way round: decline it, or discard or recall the envelope, then delete |
| wire `meetingsRouter.crud.delete` (`use-meeting-actions.ts`) | super-admins only | refused while the meeting holds an approved proposal. Way round: decline the proposal first |
| `src/shared/entities/customers/dal/server/crud.ts` (`delete.before`: `meetingCrud.delete(systemContext('derived:customer-delete-cascade'), …)` per meeting) | customer delete | never refused: that hook deletes the customer's proposals with a raw `db.delete` before it deletes each meeting, so no approved proposal is left when the guard reads |

No caller of `proposalCrud.delete` exists in server code (the customer delete bypasses it; that is the customers module's to change). Both refusals keep a way round, which is R29's second clause. One case has none by design: a proposal whose contract was signed keeps its envelope id for good, so it can no longer be deleted on its own (the customer delete still removes it). That is the rules map's S44; say it in the task report so the owner hears it.

- [ ] **Step 2: Write the failing test**

Create `.superpowers/sdd/2026-10-05-lifecycle-guards/tests/delete-guards.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { MEETING_REFUSALS } from '@/shared/entities/meetings/constants/refusals'
import { meetingDeleteRefusal } from '@/shared/entities/meetings/lib/meeting-guards'
import { PROPOSAL_REFUSALS } from '@/shared/modules/proposals/core/constants/refusals'
import { proposalDeleteRefusal } from '@/shared/modules/proposals/core/lib/proposal-guards'

test('an approved proposal is not deleted', () => {
  assert.equal(proposalDeleteRefusal({ status: 'approved', contractEnvelopeId: null }), PROPOSAL_REFUSALS.deleteApproved)
})

test('approved is the reason given even when a contract exists too', () => {
  assert.equal(proposalDeleteRefusal({ status: 'approved', contractEnvelopeId: 'env_1' }), PROPOSAL_REFUSALS.deleteApproved)
})

test('a proposal with a contract envelope is not deleted, whatever its status', () => {
  assert.equal(proposalDeleteRefusal({ status: 'draft', contractEnvelopeId: 'env_1' }), PROPOSAL_REFUSALS.deleteHasContract)
  assert.equal(proposalDeleteRefusal({ status: 'sent', contractEnvelopeId: 'env_1' }), PROPOSAL_REFUSALS.deleteHasContract)
  assert.equal(proposalDeleteRefusal({ status: 'declined', contractEnvelopeId: 'env_1' }), PROPOSAL_REFUSALS.deleteHasContract)
})

test('a draft, sent or declined proposal with no contract deletes freely', () => {
  assert.equal(proposalDeleteRefusal({ status: 'draft', contractEnvelopeId: null }), null)
  assert.equal(proposalDeleteRefusal({ status: 'sent', contractEnvelopeId: null }), null)
  assert.equal(proposalDeleteRefusal({ status: 'declined', contractEnvelopeId: null }), null)
})

test('a row that carries only its status is judged on that', () => {
  assert.equal(proposalDeleteRefusal({ status: 'approved' }), PROPOSAL_REFUSALS.deleteApproved)
  assert.equal(proposalDeleteRefusal({ status: 'sent' }), null)
  assert.equal(proposalDeleteRefusal({}), null)
})

test('a meeting that holds an approved proposal is not deleted', () => {
  assert.equal(meetingDeleteRefusal({ hasApprovedProposal: true }), MEETING_REFUSALS.deleteHasApprovedProposal)
})

test('any other meeting deletes freely, and a row that does not carry the fact is not pre-judged', () => {
  assert.equal(meetingDeleteRefusal({ hasApprovedProposal: false }), null)
  assert.equal(meetingDeleteRefusal({}), null)
})

test('the sentences are the approved ones', () => {
  assert.equal(PROPOSAL_REFUSALS.deleteApproved.message, 'An approved proposal can\'t be deleted. Decline it first.')
  assert.equal(PROPOSAL_REFUSALS.deleteHasContract.message, 'This proposal has a contract. Discard the contract first.')
  assert.equal(MEETING_REFUSALS.deleteHasApprovedProposal.message, 'This meeting has an approved proposal. Decline the proposal first.')
})
```

- [ ] **Step 3: Run it to see it fail**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-05-lifecycle-guards/tests/delete-guards.test.ts`
Expected: FAIL (missing modules).

- [ ] **Step 4: The constants and the guards**

In `src/shared/modules/proposals/core/constants/refusals.ts`, add after the last entry:

```ts
  deleteApproved: {
    reason: 'proposal_delete_approved',
    message: 'An approved proposal can\'t be deleted. Decline it first.',
  },
  deleteHasContract: {
    reason: 'proposal_delete_has_contract',
    message: 'This proposal has a contract. Discard the contract first.',
  },
```

In `src/shared/modules/proposals/core/lib/proposal-guards.ts`, add below the type import (after a blank line):

```ts
import { PROPOSAL_REFUSALS } from '@/shared/modules/proposals/core/constants/refusals'
```

and append:

```ts
/** Why this proposal can't be deleted, or null when it can. A row that carries only some of the facts is judged on those. */
export function proposalDeleteRefusal(proposal: { status?: string | null, contractEnvelopeId?: string | null }) {
  if (proposal.status === 'approved') {
    return PROPOSAL_REFUSALS.deleteApproved
  }
  if (proposal.contractEnvelopeId != null) {
    return PROPOSAL_REFUSALS.deleteHasContract
  }
  return null
}
```

Create `src/shared/entities/meetings/constants/refusals.ts`:

```ts
/** Why a meeting write was refused: the code the server throws, and the sentence a person reads for it. */
export const MEETING_REFUSALS = {
  deleteHasApprovedProposal: {
    reason: 'meeting_delete_has_approved_proposal',
    message: 'This meeting has an approved proposal. Decline the proposal first.',
  },
} as const
```

Create `src/shared/entities/meetings/lib/meeting-guards.ts`:

```ts
import { MEETING_REFUSALS } from '@/shared/entities/meetings/constants/refusals'

/** Why this meeting can't be deleted, or null when it can. A row that doesn't carry the fact is left to the server. */
export function meetingDeleteRefusal(meeting: { hasApprovedProposal?: boolean }) {
  return meeting.hasApprovedProposal ? MEETING_REFUSALS.deleteHasApprovedProposal : null
}
```

- [ ] **Step 5: Run the test**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-05-lifecycle-guards/tests/delete-guards.test.ts`
Expected: 8 pass.

- [ ] **Step 6: The proposal delete hook**

In `src/shared/modules/proposals/core/dal/server/crud.ts`, add `proposalDeleteRefusal` to the guards import. Then replace the comment block that begins `// No \`delete\` hook: deleting a proposal cascades` (it sits after the `update` hook, inside `hooks`) with:

```ts
    delete: {
      // Refuses only; it does not purge. A deleted proposal's proposal_media_files rows cascade, and their
      // R2 objects stay behind (project delete purges its media in modules/projects/core/dal/server/crud.ts).
      async before(row: Proposal) {
        const refusal = proposalDeleteRefusal(row)
        if (refusal) {
          throw new ThrowableDalError({ type: 'precondition-failed', reason: refusal.reason })
        }
      },
    },
```

- [ ] **Step 7: The meeting read and the meeting delete hook**

In `src/shared/entities/meetings/dal/server/queries.ts`, add `import { proposals } from '@/shared/db/schema/proposals'` directly after the `…/schema/projects` import, and add directly below `getMeetingSchedule`:

```ts
/** Unscoped — only for entity hooks that already run behind a scope-checked write. */
export async function meetingHoldsApprovedProposal(id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: proposals.id })
    .from(proposals)
    .where(and(eq(proposals.meetingId, id), eq(proposals.status, 'approved')))
    .limit(1)
  return row !== undefined
}
```

(`and`, `eq` and `db` are already imported there. It returns a plain value like `getMeetingSchedule` beside it, because a crud hook calls it inside the engine's `dalDbOperation`.)

In `src/shared/entities/meetings/dal/server/crud.ts`: change the `queries` import to `import { getMeetingSchedule, meetingHoldsApprovedProposal } from '@/shared/entities/meetings/dal/server/queries'`, add `import { meetingDeleteRefusal } from '@/shared/entities/meetings/lib/meeting-guards'` directly above the `resolve-owner` import, and make `hooks.delete.before` (keep the comment above it):

```ts
      async before(row: Meeting) {
        // Before the calendar job: a refused delete must leave the event where it is.
        const refusal = meetingDeleteRefusal({ hasApprovedProposal: await meetingHoldsApprovedProposal(row.id) })
        if (refusal) {
          throw new ThrowableDalError({ type: 'precondition-failed', reason: refusal.reason })
        }
        if (row.gcalEventId) {
          await deleteMeetingEventJob.dispatchOrThrow({ gcalEventId: row.gcalEventId })
        }
      },
```

`ThrowableDalError` is already imported in that file (the setter rules use it). Change nothing else there.

- [ ] **Step 8: The words, and the disabled Delete**

`src/shared/modules/proposals/core/hooks/use-proposal-actions.ts` (it already imports `refusalMessage` and `PROPOSAL_REFUSALS` from Task 3): change `deleteProposal`'s `onError` to

```ts
    onError: err => toast.error(refusalMessage(err, PROPOSAL_REFUSALS) ?? 'Failed to delete proposal'),
```

`src/shared/modules/proposals/core/hooks/use-proposal-action-configs.ts`: add the imports

```ts
import { refusalMessage } from '@/shared/dal/client/lib/refusal-message'
import { PROPOSAL_REFUSALS } from '@/shared/modules/proposals/core/constants/refusals'
import { proposalDeleteRefusal } from '@/shared/modules/proposals/core/lib/proposal-guards'
```

make `ProposalEntity`:

```ts
interface ProposalEntity {
  id: string
  token: string | null
  /** Absent where the caller's rows don't carry them; Delete is then judged on what is there, and the server refuses the rest. */
  status?: string
  contractEnvelopeId?: string | null
}
```

change this file's `deleteProposal` `onError` to

```ts
      onError: err => toast.error(refusalMessage(err, PROPOSAL_REFUSALS) ?? 'Failed to delete proposal'),
```

and add one line to the delete config, after `isLoading: deleteProposal.isPending,`:

```ts
      getDisabledReason: entity => proposalDeleteRefusal(entity)?.message ?? null,
```

Of the three callers of `useProposalActionConfigs`, the records table's rows carry both facts; the customer profile's rows (`CustomerProfileProposal`) carry `status` only; the overview card's data carries `status` as a loose string and no envelope id (⚠️ the spec says "proposal rows carry" both). Where a fact is missing the Delete stays enabled and the server's refusal toasts the sentence.

`src/shared/entities/meetings/hooks/use-meeting-actions.ts`: add the imports

```ts
import { refusalMessage } from '@/shared/dal/client/lib/refusal-message'
import { MEETING_REFUSALS } from '@/shared/entities/meetings/constants/refusals'
```

and change `deleteMeeting`'s `onError` to

```ts
      onError: err => toast.error(refusalMessage(err, MEETING_REFUSALS) ?? 'Failed to delete meeting'),
```

Leave every other mutation in that file as you find it (the setter build words some of them with `SET_BY_NOT_INTERNAL`).

`src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx`: add `import { meetingDeleteRefusal } from '@/shared/entities/meetings/lib/meeting-guards'`, add to `MeetingEntity`:

```ts
  /** Absent where the caller's rows don't carry it; the server still refuses the delete. */
  hasApprovedProposal?: boolean
```

and in the `configs.push({ action: MEETING_ACTIONS.delete, … })` call, add after `isLoading: deleteMeeting.isPending,`:

```ts
    getDisabledReason: (entity: T) => meetingDeleteRefusal(entity)?.message ?? null,
```

Both `getDisabledReason` functions read only their argument (Global Constraints). Only the meetings records table's rows carry `hasApprovedProposal` (`MeetingListRow`); the schedule and the overview card rely on the server refusal.

- [ ] **Step 9: The committed check, section 5**

In `scripts/verify-lifecycle-guards.ts`, add the imports `MEETING_REFUSALS` (`@/shared/entities/meetings/constants/refusals`), `meetingDeleteRefusal` (`@/shared/entities/meetings/lib/meeting-guards`) and `PROPOSAL_REFUSALS` (`@/shared/modules/proposals/core/constants/refusals`), add `proposalDeleteRefusal` to the guards import, and insert above the final `✅` line:

```ts
// ── 5. Delete ───────────────────────────────────────────────────────────────
{
  for (const status of proposalStatuses) {
    const bare = proposalDeleteRefusal({ status, contractEnvelopeId: null })
    const withContract = proposalDeleteRefusal({ status, contractEnvelopeId: 'env_1' })
    if (status === 'approved') {
      assert.equal(bare, PROPOSAL_REFUSALS.deleteApproved, 'an approved proposal')
      assert.equal(withContract, PROPOSAL_REFUSALS.deleteApproved, 'approved is the reason given first')
    }
    else {
      assert.equal(bare, null, `a ${status} proposal with no contract deletes`)
      assert.equal(withContract, PROPOSAL_REFUSALS.deleteHasContract, `a ${status} proposal with a contract`)
    }
  }
  assert.equal(proposalDeleteRefusal({}), null, 'a row with neither fact is left to the server')
  assert.equal(meetingDeleteRefusal({ hasApprovedProposal: true }), MEETING_REFUSALS.deleteHasApprovedProposal, 'a meeting holding an approved proposal')
  assert.equal(meetingDeleteRefusal({ hasApprovedProposal: false }), null, 'any other meeting')
  assert.equal(meetingDeleteRefusal({}), null, 'a row without the fact is left to the server')
}
console.log('5. Delete ✓')
```

Run: `pnpm exec tsx scripts/verify-lifecycle-guards.ts`
Expected: every built section, then `✅`.

- [ ] **Step 10: Type-check, lint, code read, browser read check**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

Review Focus 4, by reading the saved files; write both into the task report:
- `meetingCrud`'s `delete.before`: the refusal is thrown before `deleteMeetingEventJob.dispatchOrThrow`, so a refused delete dispatches nothing. The setter rules above it (`assertSetterIsInternal`, the `setBy` lines in `create.before` and `update.before`, `duplicate.overrides`) are byte-for-byte as before: `git diff src/shared/entities/meetings/dal/server/crud.ts` shows only the two import lines and the `delete.before` body.
- `src/shared/entities/customers/dal/server/crud.ts` `delete.before`: `db.delete(proposals)` runs before the `meetingCrud.delete` loop, so the meeting guard reads no approved proposal there and a customer delete completes as today.

Browser (reuse the running server; super-admin session; read-only, **click nothing that deletes**):
- `/dashboard/proposals?pp_status=approved`: a row's More menu shows Delete disabled, and its tooltip reads "An approved proposal can't be deleted. Decline it first."
- `/dashboard/proposals` on a `sent` row with no contract: Delete is enabled.
- `/dashboard/meetings`: on a row whose proposals show an approved one, Delete is disabled with "This meeting has an approved proposal. Decline the proposal first."; on a row with no approved proposal it is enabled.

Screenshots per Global Constraints, light and dark.

- [ ] **Step 11: Commit**

```bash
git add -- src/shared/entities/meetings/constants/refusals.ts src/shared/entities/meetings/lib/meeting-guards.ts
git commit -m "feat(proposals): an approved proposal, one with a contract, and a meeting holding an approved proposal cannot be deleted; each says what to do first

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/shared/modules/proposals/core/constants/refusals.ts src/shared/modules/proposals/core/lib/proposal-guards.ts src/shared/modules/proposals/core/dal/server/crud.ts src/shared/modules/proposals/core/hooks/use-proposal-actions.ts src/shared/modules/proposals/core/hooks/use-proposal-action-configs.ts src/shared/entities/meetings/constants/refusals.ts src/shared/entities/meetings/lib/meeting-guards.ts src/shared/entities/meetings/dal/server/queries.ts src/shared/entities/meetings/dal/server/crud.ts src/shared/entities/meetings/hooks/use-meeting-actions.ts src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx scripts/verify-lifecycle-guards.ts
git show --stat HEAD
```

If any of the four meetings files carries hunks you did not make at commit time, do not commit: the pathspec would take them along. Stop and ask.

---

### Task 7: G6 — the kanban's project stage move goes through `projectCrud.update`

**Files:**
- Modify: `src/shared/constants/enums/pipelines.ts` (`isProjectPipelineStage`)
- Create: `src/shared/modules/projects/core/constants/refusals.ts`
- Modify: `src/shared/modules/projects/core/server-spec.ts` (`updateProjectSchema`)
- Modify: `src/shared/modules/projects/core/dal/server/crud.ts` (`updateProjectWithScopes`' `data` type)
- Modify: `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts` (`MoveParams`, the projects branch, imports)
- Modify: `src/trpc/routers/customer-pipelines.router.ts` (`moveCustomerPipelineItem` input)
- Modify: `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx` (`moveMutation`, `handleMoveItem`) — **another session has an uncommitted theme edit in this file (one `className`); run `git status --short` on it first and, if it is still dirty, stop and ask before editing**
- Modify: `src/shared/modules/projects/core/hooks/use-project-actions.ts` (two toasts)
- Modify: `scripts/verify-lifecycle-guards.ts` (section 6)
- Test (throwaway): `.superpowers/sdd/2026-10-05-lifecycle-guards/tests/project-stage.test.ts`

**Interfaces:**
- Consumes: `refusalMessage` (Task 3). Independent of Task 2, but both must be built before the slice is done.
- Produces: `isProjectPipelineStage(value: string): value is ProjectPipelineStage`; `PROJECT_REFUSALS.stageWrongCustomer`; `projectSchemas.update` whose `pipelineStage` accepts only `projectPipelineStages` (or null); `updateProjectWithScopes(ctx, id, data: SpecUpdate<typeof projectServerSpec>, scopeIds?)`; `customerPipelinesRouter.moveCustomerPipelineItem` input gains `projectId?: string` (uuid), required with a project stage when `pipeline` is `projects`.

- [ ] **Step 1: Owner gate, and who moves a project's stage (R29)**

Confirm with the owner that they have read Owner confirms 5 (dispatchers lose a drag they could only reach by typing the URL). Do not start this task without that.

Run: `grep -rn "pipelineStage: 'signed'\|pipelineStage: toStage" src scripts --include=*.ts --include=*.tsx`
Expected: three lines. `projects.router/business.router.ts` writes `pipelineStage: 'signed'` on create, through the insert schema, which this task does not change. `move-customer-pipeline-item.ts` has two: `data: { pipelineStage: toStage }` in the leads branch, which is the customer's own stage through `customerCrud` and not a project's, and `.set({ pipelineStage: toStage })` in the projects branch, the raw write this task replaces. `projectFormSchema` (the wire shape of `projects.crud.update`) has no `pipelineStage`, so the kanban is the only way a project's stage changes.

Who reaches the projects kanban: agents and super-admins (`getAccessiblePipelines`); both hold `update Project`. The card's `item.project` is that customer's newest project (`getProjectsPipelineItems`), so "the dragged project" is `item.project.id`. Refused after this task: a stage outside `projectPipelineStages`, a project that is not the customer's, and a viewer without `update Project`. None is something the board offers an agent or a super-admin.

- [ ] **Step 2: Write the failing test**

Create `.superpowers/sdd/2026-10-05-lifecycle-guards/tests/project-stage.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isProjectPipelineStage, projectPipelineStages } from '@/shared/constants/enums/pipelines'
import { PROJECT_REFUSALS } from '@/shared/modules/projects/core/constants/refusals'

test('every project pipeline stage is a project stage', () => {
  for (const stage of projectPipelineStages) {
    assert.equal(isProjectPipelineStage(stage), true, stage)
  }
})

test('a stage of another pipeline is not', () => {
  assert.equal(isProjectPipelineStage('meeting_completed'), false)
  assert.equal(isProjectPipelineStage('proposal_sent'), false)
  assert.equal(isProjectPipelineStage('new'), false)
})

test('free text is not', () => {
  assert.equal(isProjectPipelineStage(''), false)
  assert.equal(isProjectPipelineStage('Signed'), false)
  assert.equal(isProjectPipelineStage('done'), false)
})

test('the sentence is the approved one', () => {
  assert.equal(PROJECT_REFUSALS.stageWrongCustomer.reason, 'project_stage_wrong_customer')
  assert.equal(PROJECT_REFUSALS.stageWrongCustomer.message, 'That project belongs to another customer.')
})
```

- [ ] **Step 3: Run it to see it fail**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-05-lifecycle-guards/tests/project-stage.test.ts`
Expected: FAIL (`isProjectPipelineStage` is not exported).

- [ ] **Step 4: The validator and the sentence**

In `src/shared/constants/enums/pipelines.ts`, directly below `export type ProjectPipelineStage = (typeof projectPipelineStages)[number]`, add:

```ts
export function isProjectPipelineStage(value: string): value is ProjectPipelineStage {
  return (projectPipelineStages as readonly string[]).includes(value)
}
```

Create `src/shared/modules/projects/core/constants/refusals.ts`:

```ts
/** Why a project write was refused: the code the server throws, and the sentence a person reads for it. */
export const PROJECT_REFUSALS = {
  stageWrongCustomer: {
    reason: 'project_stage_wrong_customer',
    message: 'That project belongs to another customer.',
  },
} as const
```

- [ ] **Step 5: Run the test**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-05-lifecycle-guards/tests/project-stage.test.ts`
Expected: 4 pass.

- [ ] **Step 6: The project update schema checks the stage**

In `src/shared/modules/projects/core/server-spec.ts`, add after the `import type` line (and its blank line):

```ts
import z from 'zod'

import { projectPipelineStages } from '@/shared/constants/enums/pipelines'
```

and replace:

```ts
// No server-derived fields on the row itself, so update simply partials the
// insert schema (mirrors applications). `scopeIds` — the x_projectScopes
// side-channel the hand-written router carries — is NOT a `projects` column and
// intentionally does NOT ride through these schemas; it belongs to a dedicated
// scopes mutation, not the CRUD slot.
const updateProjectSchema = insertProjectSchema.partial()
```

with:

```ts
// `scopeIds` — the x_projectScopes side-channel the hand-written router carries — is NOT a `projects`
// column and intentionally does NOT ride through these schemas; it belongs to a dedicated scopes
// mutation, not the CRUD slot.
// The column is free text, so a stage is checked here: one outside the pipeline has no kanban stage to
// sit in and no status bucket.
const updateProjectSchema = insertProjectSchema.partial().extend({
  pipelineStage: z.enum(projectPipelineStages).nullish(),
})
```

The insert schema is not changed: `business.create` writes `'signed'` through it, and the portfolio editor writes none.

In `src/shared/modules/projects/core/dal/server/crud.ts`, change the first import to `import type { DalReturn, ScopedContext, SpecUpdate } from '@/shared/dal/server/types'`, and `updateProjectWithScopes`' third parameter from `data: Partial<InsertProject>,` to:

```ts
  data: SpecUpdate<typeof projectServerSpec>,
```

(`Partial<InsertProject>` types the stage as any string, which the narrowed schema no longer accepts. `InsertProject` is still used by `createProjectWithScopes`.)

Run: `pnpm tsc`
Expected: clean (the kanban's write is still raw at this point, so the narrowed schema does not touch it yet). An error is a caller writing a free-text stage through `projectCrud.update`: stop and report.

- [ ] **Step 7: The move**

In `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts`:

Imports: add `import { isProjectPipelineStage } from '@/shared/constants/enums/pipelines'` directly above the `buildUserContext` import; delete `import { projects } from '@/shared/db/schema/projects'`; add, directly after the `meetingServerSpec` import:

```ts
import { PROJECT_REFUSALS } from '@/shared/modules/projects/core/constants/refusals'
import { projectCrud } from '@/shared/modules/projects/core/dal/server/crud'
import { projectServerSpec } from '@/shared/modules/projects/core/server-spec'
```

`MoveParams` gains, after `pipeline: Pipeline`:

```ts
  /** The project on the dragged card; a customer can have several. */
  projectId?: string
```

and the function's parameter destructuring gains `projectId,` after `pipeline,`.

Replace the whole `if (pipeline === 'projects') { … }` block with:

```ts
  if (pipeline === 'projects') {
    // The router's input check already refused these; repeated because that check does not narrow
    // `toStage` to a project stage for the write below.
    if (!projectId || !isProjectPipelineStage(toStage)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'A project stage move needs its project and a project stage',
      })
    }

    // Unscoped, like the projects router's own update: which projects a viewer may reach is decided
    // with the rest of project visibility, not here.
    const ctx = { ...buildUserContext(userId, userRole, projectServerSpec), scope: null }
    if (ctx.ability?.cannot('update', 'Project') !== false) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to update projects',
      })
    }

    const project = dalVerifySuccess(await projectCrud.getById(ctx, { id: projectId }))
    if (!project) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Project not found',
      })
    }
    if (project.customerId !== customerId) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: PROJECT_REFUSALS.stageWrongCustomer.reason,
      })
    }

    dalVerifySuccess(await projectCrud.update(ctx, { id: projectId, data: { pipelineStage: toStage } }))
    return
  }
```

`eq`, `db`, `meetings` and `proposals` are still used by the branches below; `projects` is not. The refusal is thrown as a `TRPCError` with the reason as its message because this function already speaks tRPC errors and runs outside any `dalDbOperation`.

- [ ] **Step 8: The mutation's input**

In `src/trpc/routers/customer-pipelines.router.ts`, change the enums import to:

```ts
import { deriveProjectStatusBucket, isProjectPipelineStage, meetingPipelines, pipelines } from '@/shared/constants/enums/pipelines'
```

and `moveCustomerPipelineItem`'s input to:

```ts
    .input(z.object({
      customerId: z.string().uuid(),
      fromStage: z.string(),
      toStage: z.string(),
      pipeline: z.enum(pipelines).default('fresh'),
      // The project on the dragged card: a customer can have several, and only the card knows which one moved.
      projectId: z.string().uuid().optional(),
    }).refine(
      input => input.pipeline !== 'projects' || (input.projectId !== undefined && isProjectPipelineStage(input.toStage)),
      { message: 'A project stage move needs its project and a project stage' },
    ))
```

The mutation body is unchanged: `...input` now carries `projectId` into `moveCustomerPipelineItem`.

- [ ] **Step 9: The client sends the dragged project, and the words**

`src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx` (see the Files note about the other session's edit): add the imports

```tsx
import { refusalMessage } from '@/shared/dal/client/lib/refusal-message'
import { PROJECT_REFUSALS } from '@/shared/modules/projects/core/constants/refusals'
```

change `moveMutation`'s `onError` to:

```tsx
      onError: (err) => {
        toast.error(refusalMessage(err, PROJECT_REFUSALS) ?? 'Failed to move customer. Please try again.')
        void query.refresh()
      },
```

and the `moveMutation.mutate` call at the end of `handleMoveItem` to:

```tsx
    moveMutation.mutate({
      customerId: itemId,
      fromStage,
      toStage,
      pipeline,
      projectId: pipeline === 'projects' ? items.find(i => i.id === itemId)?.project?.id : undefined,
    })
```

The other `moveMutation.mutate` in this file (leads → `meeting_scheduled`, inside `CreateMeetingModal`'s `onSuccess`) is not touched.

`src/shared/modules/projects/core/hooks/use-project-actions.ts`: add the same two imports, change `deleteProject`'s `onError` to

```ts
    onError: err => toast.error(refusalMessage(err, PROJECT_REFUSALS) ?? 'Failed to delete project'),
```

and, in `setPortfolioVisibility`'s `onError`, the toast line to

```ts
      toast.error(refusalMessage(err, PROJECT_REFUSALS) ?? (err.message || 'Couldn\'t change portfolio visibility'))
```

⚠️ No project reason reaches these two mutations in this slice; they are wired because the spec lists them, and they start working the day a project refusal exists.

- [ ] **Step 10: The committed check, section 6**

In `scripts/verify-lifecycle-guards.ts`, add `import { isProjectPipelineStage, projectPipelineStages } from '@/shared/constants/enums/pipelines'` after the `@/shared/constants/enums` import and insert above the final `✅` line:

```ts
// ── 6. Project stage ────────────────────────────────────────────────────────
{
  assert.equal(projectPipelineStages.length, 11, 'the project pipeline has eleven stages')
  for (const stage of projectPipelineStages) {
    assert.equal(isProjectPipelineStage(stage), true, `project stage ${stage}`)
  }
  for (const other of ['', 'Signed', 'done', 'new', 'meeting_completed', 'proposal_sent', 'declined', 'schedule_manager_meeting']) {
    assert.equal(isProjectPipelineStage(other), false, `not a project stage: "${other}"`)
  }
}
console.log('6. Project stage ✓')
```

Run: `pnpm exec tsx scripts/verify-lifecycle-guards.ts`
Expected: every built section, then `✅`.

- [ ] **Step 11: Type-check, lint, code read, browser read check**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

Review Focus 5, by reading the saved branch; write into the task report: the write targets `projectId` from the input, never a query by customer; the customer check compares the stored project's `customerId` with the dragged card's customer; the ability check fails closed (`!== false`); no raw `db.update(projects)` remains (`grep -n "update(projects)" src/features/customer-pipelines -r` → no hits).

Browser, read-only (**drag nothing**): as an agent, then a super-admin, `/dashboard/pipeline/projects` loads its stages and cards with no error toast and a clean console. As a dispatcher, open the same URL and report what it shows (Owner confirms 5). Screenshots per Global Constraints.

- [ ] **Step 12: Owner's write check (owner-designated rows only)**

If Task 0's count 5 is above zero, ask the owner to name one customer with two projects: as a super-admin, drag that customer's card one stage and back; in the projects records table, the newest project's stage moved and the other project's did not. If the count is 0, there is no such row on dev: record that the check was covered by the code read in Step 11, and ask the owner to drag any one project card a stage and back to see the ordinary path work. If the owner prefers to run these by hand, give them this list.

- [ ] **Step 13: Commit**

```bash
git add -- src/shared/modules/projects/core/constants/refusals.ts
git commit -m "fix(pipelines): a project stage drag moves the dragged project through projectCrud, with a pipeline stage and the viewer's permission

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/shared/constants/enums/pipelines.ts src/shared/modules/projects/core/constants/refusals.ts src/shared/modules/projects/core/server-spec.ts src/shared/modules/projects/core/dal/server/crud.ts src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts src/trpc/routers/customer-pipelines.router.ts src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx src/shared/modules/projects/core/hooks/use-project-actions.ts scripts/verify-lifecycle-guards.ts
git show --stat HEAD
```

---

### Task 8: Hand-off — the last check, the tracker, the docs this slice made stale

**Files:**
- Modify: `scripts/verify-lifecycle-guards.ts` (section 7)
- Modify: `docs/plans/2026-10-01-sales-lifecycle-rules-map.md` (status line, §0 row 1)
- Modify: `docs/superpowers/specs/2026-10-05-lifecycle-guards-design.md` (status line)
- Modify: `src/shared/modules/proposals/core/DOCS.md`, `src/shared/modules/projects/core/DOCS.md`

Run this task only when Tasks 1–7 are all built (Task 4 included, so its ruling is in). Re-read each file first; edit only what this plan changed.

- [ ] **Step 1: Close the verify script**

In `scripts/verify-lifecycle-guards.ts`, add the imports `refusalMessage` (`@/shared/dal/client/lib/refusal-message`) and `PROJECT_REFUSALS` (`@/shared/modules/projects/core/constants/refusals`) and insert above the final `✅` line:

```ts
// ── 7. Every refusal has its sentence ───────────────────────────────────────
{
  const all = [...Object.values(PROPOSAL_REFUSALS), ...Object.values(MEETING_REFUSALS), ...Object.values(PROJECT_REFUSALS)]
  assert.deepEqual(all.map(refusal => refusal.reason).sort(), [
    'meeting_delete_has_approved_proposal',
    'project_stage_wrong_customer',
    'proposal_created_not_draft',
    'proposal_delete_approved',
    'proposal_delete_has_contract',
    'proposal_field_frozen',
    'proposal_frozen',
    'proposal_not_sendable',
  ], 'the eight reasons, each once')
  for (const refusal of all) {
    assert.ok(refusal.message.endsWith('.'), `${refusal.reason} reads as a sentence`)
    assert.ok(!refusal.message.includes(refusal.reason), `${refusal.reason} does not show its code`)
  }
  for (const refusal of Object.values(PROPOSAL_REFUSALS)) {
    assert.equal(refusalMessage(new Error(refusal.reason), PROPOSAL_REFUSALS), refusal.message, `${refusal.reason} is worded`)
    assert.equal(refusalMessage(new Error(refusal.reason), MEETING_REFUSALS), undefined, `${refusal.reason} is worded only by its own list`)
  }
  assert.equal(refusalMessage(new Error(MEETING_REFUSALS.deleteHasApprovedProposal.reason), MEETING_REFUSALS), MEETING_REFUSALS.deleteHasApprovedProposal.message)
  assert.equal(refusalMessage(new Error(PROJECT_REFUSALS.stageWrongCustomer.reason), PROJECT_REFUSALS), PROJECT_REFUSALS.stageWrongCustomer.message)
  assert.equal(refusalMessage(new Error('FORBIDDEN'), PROPOSAL_REFUSALS), undefined, 'a permission error keeps the generic text')
  assert.equal(refusalMessage(undefined, PROPOSAL_REFUSALS), undefined, 'no error, no sentence')
}
console.log('7. Every refusal has its sentence ✓')
```

Run: `pnpm exec tsx scripts/verify-lifecycle-guards.ts`
Expected: sections 1–7, then `✅ verify-lifecycle-guards passed`. Then `pnpm tsc && pnpm lint` → clean.

- [ ] **Step 2: Owner's write checks still open (owner-designated rows only)**

Give the owner this list for rows they name, and record which they ran:
- Records table, a `sent` proposal on a meeting that already has its project: set the status to approved → "Proposal approved"; the proposal's approval date is set. Set it to approved again → the date does not move.
- Customer profile, a `sent` proposal that has a contract draft: Delete → confirm → toast "This proposal has a contract. Discard the contract first."; the proposal is still there.
- Public proposal page of a proposal with a contract draft: pick a financing option → toast "This proposal's contract has started, so its content is locked."
- The share-link checks of Task 1 Step 10 and the drag of Task 7 Step 12, if not already run.

- [ ] **Step 3: Tracker and spec status**

In `docs/plans/2026-10-01-sales-lifecycle-rules-map.md`:
- status line (the first blockquote): replace "Nothing here is built." with "Slice 1 (guards) is built on local main; nothing else is."
- §0, row 1, last-but-one cell: replace "Scope ruled 2026-10-05 (R29); the written spec awaits the owner's review." with "Built on local main `<first-sha>..<last-sha>` (plan `docs/superpowers/plans/2026-10-05-lifecycle-guards.md`); no database change, so prod needs only the deploy." using the real commit range of Tasks 1–7.

In `docs/superpowers/specs/2026-10-05-lifecycle-guards-design.md`, replace the `> **Status:**` line with this one, writing the ruling's letter in:

```md
> **Status:** built on local main per `docs/superpowers/plans/2026-10-05-lifecycle-guards.md`. G4's ruling on a missing or old approval stamp (plan Task 4 Step 1): A or B.
```

Do not delete the plan or the spec; the owner prunes them when the slice is on prod.

- [ ] **Step 4: The DOCS lines this slice made false**

The lines the handoff lists as stale (`docs/plans/2026-09-29-approval-project-outcome-handoff.md` §6: the conversion-trigger text in the proposals, meetings and projects DOCS) are about approval → project → outcome. This slice makes none of them true, so they stay as they are for slices 2 and 3. What this slice does is make the sentences below false.

Fix only these sentences. If one reads differently when you open the file, apply the same correction to it as it stands; add no new section.

`src/shared/modules/proposals/core/DOCS.md`, section `### kind-frozen-after-insert`: replace its **Reference impl** and **Enforced by** lines with:

```md
**Reference impl**: `lib/derive-proposal-kind.ts` (derivation); `lib/proposal-guards.ts` (`proposalFieldsFrozenAfterCreate`).
**Enforced by**: the update schema leaves `kind` out (`server-spec.ts`), and `update.before` in `dal/server/crud.ts` refuses an in-process payload that names it (`precondition-failed: proposal_field_frozen`).
```

Same file, section `### share-token-generated-at-insert`, **Enforced by** line: replace the clause that runs from "and the update schema does not exclude it" to "#285)" with:

```md
and the update schema leaves it out (the same guard as `#kind-frozen-after-insert`)
```

Same file, section `### shareable-via-token`: replace its first sentence ("A proposal can be read AND updated by an unauthenticated client via …") with:

```md
A proposal can be read by an unauthenticated client via `?token=<shareToken>`, and that client can write two fields, `financeOptionId` and `envelopeDocumentIds` (`shareLinkWritableProposalFields`, `lib/proposal-guards.ts`); `update.before` refuses any other field with `forbidden`.
```

Same file, section `### proposal-lock-ladder`: in the sentence "Lifecycle fields (status, sentAt/approvedAt, signing ids, contract timestamps, QB refs) stay writable …", change "sentAt/approvedAt" to "sentAt", and add this sentence after it:

```md
`approvedAt` is stamped by the same hook when a proposal becomes approved; no user or share-link payload may carry it.
```

Same file, section `### completed-auto-approves`: replace the words "and stamps `approvedAt` (matching the manual approval flow)" with:

```md
and the crud hook stamps `approvedAt`, as it does on every approval path
```

`src/shared/modules/projects/core/DOCS.md`: the pipeline-stage section's **Enforced by** line reads "convention (text column, not pgEnum; agents move via the project-pipeline kanban)". Replace the line with:

```md
**Enforced by**: the project update schema (`server-spec.ts`) accepts only `projectPipelineStages`; the column itself is text, not a pgEnum. The kanban moves a stage through `projectCrud.update`.
```

`src/shared/entities/meetings/DOCS.md`: no line is made false; leave it.

- [ ] **Step 5: Commit**

```bash
git commit -m "docs(lifecycle): slice 1 guards are built — verify script closed, tracker, spec status and DOCS follow

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- scripts/verify-lifecycle-guards.ts docs/plans/2026-10-01-sales-lifecycle-rules-map.md docs/superpowers/specs/2026-10-05-lifecycle-guards-design.md src/shared/modules/proposals/core/DOCS.md src/shared/modules/projects/core/DOCS.md
git show --stat HEAD
```

If any of these files carries hunks you didn't make, do not commit it; report the edit for the owner to commit with theirs.

---

## Self-review notes (kept for the executor)

- **Spec coverage.** G1 → Task 3 (frozen fields, draft-only create, update schema). G2 → Task 1. G3 → Task 5. G4 → Task 4. G5 → Task 6. G6 → Task 7. G7 → Task 2. G8 → `PROPOSAL_REFUSALS` and `refusalMessage` in Task 3, growing in Tasks 5 and 6; `MEETING_REFUSALS` in Task 6; `PROJECT_REFUSALS` in Task 7; `proposal_frozen` worded in Task 3. §5's verify script → born in Task 1, one section per guard, closed in Task 8; §5's read-only counts → Task 0; §5's browser and write checks → Task 6 Step 10, Task 7 Steps 11–12, Task 1 Step 10, Task 8 Step 2. §6 hand-off → Task 8.
- **Not built, on purpose.** P7, J3 and the status graph (slice 3). `projects.business.create`'s ability check (Owner confirms 6). Folding `SET_BY_NOT_INTERNAL` into `MEETING_REFUSALS` (Owner confirms 7). The create view's toast (no screen can send a non-draft create).
- **Type consistency.** `isShareLinkContext` comes from `@/shared/dal/server/types` in Tasks 1, 3 and 4. The guards import in the proposals crud grows by task: `isShareLinkWritable` (1) → `+ isDraftCreate, touchesFieldsFrozenAfterCreate` (3) → `+ canSetApprovedAt, resolveApprovedAt` and the `ProposalWriteContext` type (4) → `+ proposalDeleteRefusal` (6). `update.before`'s body is given whole in Tasks 3 and 4; Task 4's is Task 3's plus the approval block and `next`. If Task 6 is built before Task 4, its edits (the import and the `delete` hook) do not touch `update.before`. `refusalMessage(error, refusals)` is called with `PROPOSAL_REFUSALS` (Tasks 3–6), `MEETING_REFUSALS` (6) and `PROJECT_REFUSALS` (7). `proposalDeleteRefusal` and `meetingDeleteRefusal` return a constant entry or `null`; callers read `.reason` on the server and `.message` in `getDisabledReason`.
- **Order.** Tasks 1 and 2 stand alone and can ship first. Task 3 needs Task 1's hook. Task 4 needs Task 3 and a ruling. Tasks 5, 6 and 7 need Task 3 (`refusalMessage`, `PROPOSAL_REFUSALS`) and not Task 4, so they can be built while Task 4 waits. Task 8 is last. Nothing runs in parallel: Tasks 3–6 all edit `proposal-guards.ts`, the proposals crud and the verify script.
- **Prod.** No database change. The share-link and project-write fixes (Tasks 1 and 2) are written to be carried alone; whether and when they go ahead is the owner's call.
