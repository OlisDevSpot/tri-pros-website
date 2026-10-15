# Permissions unit 4 part 1: Meeting and Proposal write rules

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner's Q8 rulings of 2026-10-14 for Meeting (D-34) and Proposal (batch 2) become rule lines, and the delete slot stops running its side effects on rows the caller may not delete.

**Architecture:** Rules live in `src/shared/domains/permissions/rules/{agent,dispatcher,system}.ts`; the DAL enforces them through `createCrudDal`'s compiled scoping (row reach = the action's rules AND the read rules, D-15; each changed column checked on the loaded row, D-17). A sub-entity write is the parent's `update` on the sub-entity's field (D-08), so incentives and media are paths on the agent's `update Proposal` list. Contract envelope columns are written by the contract service under a system reason after it checks the caller's update reach, the same shape as `derived:envelope-documents`. UI gates read the same rules; a conditioned mutation rule is checked on the row with the typed `subject()` helper.

**Tech Stack:** TypeScript, Drizzle, CASL 6.8.0 (`defineRules`), `@casl/react`, tRPC.

**Spec:** `docs/superpowers/specs/2026-10-05-permissions-structure-design.md` (§5 rules, §6 enforcement). Rulings: tracker `docs/plans/2026-08-10-casl-scope-compiler-epic.md` §0.3 Q8 (re-triage and batches 1–2), §2.1 D-34; Appendix A, 2026-10-14 (unit 4, rulings batches 1–2).

## Global Constraints

- No DB writes for testing (dev included). Writes are checked by the owner's hand (Task 5).
- Never `pnpm build`. Gate: `pnpm tsc` and `pnpm lint`, plus the DB-free rules probe.
- `pnpm tsc` does not type-check `.superpowers/` (dot-directories are skipped): type-check probes with `pnpm tsc -p .superpowers/tsconfig.probe.json --noEmit`.
- Comments say why, never what; no plan, spec, task or ruling citations in code.
- Never print phones, emails, tokens, slugs or ids in probe output or logs.
- Never `git stash`; stage by explicit path; push after every commit; stay on `refactor/285-refactor-permissions-casl-scope-compiler`.
- No outcome or pipeline-derivation logic (main's lifecycle work).
- New names agreed by the owner 2026-10-14: `SystemReason` `'derived:contract-envelope'`; Meeting `conditionColumns: ['setBy']`. No other new names.
- Out of scope (part 2 of unit 4): the phone gate in `getFullView`, `customerHasSentProposal` for dispatchers, the three hand-written client copies, Activities (#15, open), #9's `customerId`, #14/#16/#21/#23/#24, the projects conversion transaction. Deferred by ruling: moving a proposal to another meeting (`meetingId` stays off the agent's list).

## Decisions in this plan

1. **`envelopeDocumentIds` stays on the agent's `update Proposal` list.** Correction to what the owner was shown on 2026-10-14: `contracts.router.ts:153` decides who may choose the envelope documents with `permit(ctx, 'update', proposalServerSpec, ['envelopeDocumentIds']).probe(id)`; the write itself already runs as `derived:envelope-documents`. Leaving the column off would refuse every agent's document choice. The owner confirms in the plan review.
2. **Dispatchers lose `ownerId` writes too** (`cannot('update', 'Meeting', ['ownerId'])` in `dispatcher.ts`). The ruling named agents; the reason holds for dispatchers, who hold a bare `update Meeting` and could otherwise assign a meeting by writing `ownerId`. Ownership moves only through `manageParticipants`, which requires `assign` (super-admin). The owner confirms in the plan review.
3. **`setBy` is server-derived for any caller without `assign`**, silently, not refused: `duplicate` copies the source's `setBy` into the create input, so refusing would break every duplicate. Consequence: an agent's duplicate of a dispatcher's booking is set by the agent (the agent can delete it). The reschedule replacement keeps the original setter: it runs as `derived:meeting-reschedule`, which holds `manage all`, and so `assign`.
4. **`deleteImpl` loads the row through the delete reach** (`scoping.write(ctx, 'delete')`, which is the delete rules AND the read rules), not through `getByIdImpl`'s read reach. A row the caller may read but not delete answers NOT_FOUND before any hook runs. The meeting delete hook queues the Google Calendar removal, so the order matters from this part on.
5. **The meeting Delete action is checked on the row.** `getVisibleActions` checks the verb only (`ability.can('delete', 'Meeting')` is true for anyone holding a conditioned rule), so the delete config gets `hidden: entity => ability.cannot('delete', subject('Meeting', { setBy: entity.setBy ?? null }))`. Rows that do not carry `setBy` (kanban, schedule) offer no Delete to agents; super-admin (`manage all`) keeps it everywhere. The meetings records table carries `setBy` (`getTableColumns(meetings)`).
6. **The contract service checks `permit(ctx, 'update', proposalServerSpec).probe(id)` before calling Zoho**, then writes `contractEnvelopeId` / `contractSentAt` as `derived:contract-envelope`. The probe sits before the Zoho call so a refused caller never creates or recalls an envelope. The field-less probe compiles to the update rules' row reach (D-15), which for an agent is the read reach.
7. **No browser GET probe.** No read rule changes; every change is a mutation, checked by the rules probe and the owner's hand checks.

## Review Focus

- A meeting the agent sits in but did not set: no Delete offered; a forged delete answers NOT_FOUND and its calendar event stays (Task 1 code, Task 2 probe `deleteOthers: false`, hand check H2).
- An agent's direct `proposals.crud.update` with `contractSentAt: null`, `token`, `createdAt` or `meetingId`: FORBIDDEN naming the column (Task 3 probe lines; hand check H4 covers the contract flow still working).
- The envelope-document picker for an agent still saves (Task 3 probe `envelopeDocs: true`; hand check H5).
- Incentive replace, proposal photo upload, visibility toggle and delete for an agent still work (Task 3 probe `incentives`, `incentiveAmount`, `media`, `mediaVisibility`; hand check H3).
- The projects kanban "proposal sent → declined" drag writes `status` as the agent and still works (Task 3 probe `status: true`; hand check H6).

---

### Task 1: The delete slot loads its row through the delete reach

**Files:**
- Modify: `src/shared/dal/server/lib/create-crud-dal.ts:276-292` (the prefetch in `deleteImpl`)

**Interfaces:**
- Consumes: `Scoping.write(ctx, action): SQL | undefined` (same file); `ThrowableDalError` from `../types`.
- Produces: no signature change. `crud.delete` answers `not-found` before any `delete.before` / callsite `before` hook when the row is outside the delete reach.

- [ ] **Step 1: Replace the prefetch**

In `deleteImpl`, replace:

```ts
    let row: Row<TTable> | undefined
    if (needsRow) {
      const pre = await getByIdImpl(spec, scoping, pkColumn, ctx, { id: input.id })
      if (!pre.success) {
        throw new ThrowableDalError({
          type: 'precondition-failed',
          reason: `[create-crud-dal] delete-row prefetch failed for '${spec.entityName}' — refusing to delete without hook context`,
        })
      }
      if (!pre.data) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      row = pre.data as Row<TTable>
    }
```

with:

```ts
    let row: Row<TTable> | undefined
    if (needsRow) {
      // The delete reach, not the read reach: the hooks purge stored files and calendar events, so a
      // row the caller may read but not delete must stop before them.
      const [found] = await exec
        .select()
        .from(spec.table as PgTable)
        .where(and(eq(pkColumn, input.id), scoping.write(ctx, 'delete')))
        .limit(1)
      if (!found) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      row = found as Row<TTable>
    }
```

- [ ] **Step 2: Type-check and lint the file**

Run: `pnpm tsc > .superpowers/sdd/u4p1-t1-tsc.log 2>&1; echo tsc=$?; pnpm eslint src/shared/dal/server/lib/create-crud-dal.ts; echo lint=$?`
Expected: `tsc=0`, `lint=0`. (`getByIdImpl` is still used by the read and update slots, so no unused import.)

- [ ] **Step 3: Commit and push**

```bash
git add src/shared/dal/server/lib/create-crud-dal.ts
git commit -m "fix(dal): a delete loads its row through the delete reach, so hooks never run on a row the caller may not delete"
git push
```

### Task 2: Meeting rules (D-34)

**Files:**
- Modify: `src/shared/entities/meetings/lib/server-spec.ts:33` (`conditionColumns`)
- Modify: `src/shared/domains/permissions/rules/agent.ts:16-20` (the meeting block)
- Modify: `src/shared/domains/permissions/rules/dispatcher.ts:22-28` (the meeting block)
- Modify: `src/shared/entities/meetings/dal/server/crud.ts:65-67` (`create.before`, the setter)
- Modify: `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx` (the delete config, near line 157; imports)
- Probe (git-ignored): `.superpowers/permissions-probes/unit4-part1-rules.ts`; `.superpowers/tsconfig.probe.json`

**Interfaces:**
- Consumes: `subject<S>(type, row)` from `@/shared/domains/permissions/subject`; `useAbility()` from `@/shared/domains/permissions/client`.
- Produces: Meeting `conditionColumns: ['setBy']`; agent rules `can('delete', 'Meeting', { setBy: userId })` and `cannot('update', 'Meeting', ['ownerId'])`; dispatcher rule `cannot('update', 'Meeting', ['ownerId'])`. Task 3 extends the same probe file.

- [ ] **Step 1: Write the probe, watch it fail**

`.superpowers/permissions-probes/unit4-part1-rules.ts`:

```ts
// Database-free check of unit 4 part 1's rules: every role's ability built as a request builds it.
import type { UserRole } from '@/shared/constants/enums'
import type { ScopedContext } from '@/shared/dal/server/types'

import { PgDialect } from 'drizzle-orm/pg-core'

import { assertRulesCompile } from '@/shared/dal/server/lib/permissions/check-rules'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { subject } from '@/shared/domains/permissions/subject'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'

const USER = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const dialect = new PgDialect()
const render = (s: ReturnType<typeof permit>['sql']) => dialect.sqlToQuery(s).sql.replace(/\s+/g, ' ')
const ctxFor = (role: UserRole): ScopedContext => ({ actor: { ability: defineAbilitiesFor({ id: USER, role }), userId: USER }, scope: null })

assertRulesCompile()
for (const role of ['super-admin', 'agent', 'dispatcher'] as UserRole[]) {
  const ctx = ctxFor(role)
  const ab = ctx.actor.ability
  console.log(`\n── ${role} · Meeting`)
  console.log(JSON.stringify({
    deleteMine: ab.can('delete', subject('Meeting', { setBy: USER })),
    deleteOthers: ab.can('delete', subject('Meeting', { setBy: OTHER })),
    deleteNoSetter: ab.can('delete', subject('Meeting', { setBy: null })),
    updateOwnerId: ab.can('update', 'Meeting', 'ownerId'),
    updateOutcome: ab.can('update', 'Meeting', 'meetingOutcome'),
    updateScheduledFor: ab.can('update', 'Meeting', 'scheduledFor'),
  }))
  // Parameters render as $n, so no id reaches the output.
  console.log('delete meeting :', render(permit(ctx, 'delete', meetingServerSpec).sql))
}
```

Point the probe tsconfig at it. `.superpowers/tsconfig.probe.json`:

```json
{ "extends": "../tsconfig.json", "include": ["../next-env.d.ts", "permissions-probes/unit4-part1-rules.ts"] }
```

Run: `pnpm tsc -p .superpowers/tsconfig.probe.json --noEmit 2>&1 | grep unit4 | head -3`
Expected: errors on the three `subject('Meeting', { setBy: … })` lines (`setBy` is not yet a Meeting condition column, so the row type has no `setBy`).

- [ ] **Step 2: `setBy` becomes a Meeting condition column**

`src/shared/entities/meetings/lib/server-spec.ts`:

```ts
  conditionColumns: ['setBy'],
```

- [ ] **Step 3: The agent's meeting rules**

`src/shared/domains/permissions/rules/agent.ts`, the meeting block becomes:

```ts
    // A meeting is reached by sitting in it; the row filter and the UI read this one rule.
    can('read', 'Meeting', { $participatesViaMeeting: { via: 'self', userId } })
    can('create', 'Meeting')
    can('update', 'Meeting')
    // A rep removes only what they booked; a meeting the office handed them is the office's to remove.
    can('delete', 'Meeting', { setBy: userId })
    can('own', 'Meeting') // agents own the meetings they create (implicitly the sales rep)
    // Ownership moves with the participants, through `assign`.
    cannot('update', 'Meeting', ['ownerId'])
```

- [ ] **Step 4: The dispatcher's meeting rules**

`src/shared/domains/permissions/rules/dispatcher.ts`, after `cannot('update', 'Meeting', ['projectId'])`:

```ts
    // Ownership moves with the participants, through `assign`.
    cannot('update', 'Meeting', ['ownerId'])
```

- [ ] **Step 5: The setter is whoever books, unless they assign setters**

`src/shared/entities/meetings/dal/server/crud.ts`, in `create.before`, replace:

```ts
        // Unpicked: whoever books the meeting set it. Bookings nobody made in the app (intake, lead ingestion,
        // system-made replacements) have no user, so the office account stands in as their setter.
        const setBy = input.setBy ?? userId ?? await getSystemOwnerId()
```

with:

```ts
        // Only someone who assigns setters books under another's name; anyone else is the setter of what they
        // book, a duplicate included, and the delete rule keys on it. Bookings nobody made in the app (intake,
        // lead ingestion, system-made replacements) have no user, so the office account stands in as their setter.
        const setBy = userId !== null && ability.cannot('assign', 'Meeting')
          ? userId
          : input.setBy ?? userId ?? await getSystemOwnerId()
```

(`ability` and `userId` are already destructured from `ctx.actor` above this line.)

- [ ] **Step 6: The Delete action is checked on the row**

`src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx`. Add the second import below the existing `useAbility` import:

```ts
import { useAbility } from '@/shared/domains/permissions/client'
import { subject } from '@/shared/domains/permissions/subject'
```

The delete config becomes:

```ts
  configs.push({
    action: MEETING_ACTIONS.delete,
    // Who may delete depends on who booked the meeting, so a row without its setter offers no delete.
    hidden: entity => ability.cannot('delete', subject('Meeting', { setBy: entity.setBy ?? null })),
    onAction: async (entity: T) => {
      const ok = await confirmDelete()
      if (ok) {
        deleteMeeting.mutate({ id: entity.id })
      }
    },
    isLoading: deleteMeeting.isPending,
  })
```

- [ ] **Step 7: Run the probe**

Run: `pnpm tsc -p .superpowers/tsconfig.probe.json --noEmit; echo probe-tsc=$?`
Expected: `probe-tsc=0`.

Run: `pnpm tsx --tsconfig tsconfig.json .superpowers/permissions-probes/unit4-part1-rules.ts`
Expected (one JSON line per role; SQL lines abridged):

```
── super-admin · Meeting
{"deleteMine":true,"deleteOthers":true,"deleteNoSetter":true,"updateOwnerId":true,"updateOutcome":true,"updateScheduledFor":true}
delete meeting : true            (or an always-true predicate)
── agent · Meeting
{"deleteMine":true,"deleteOthers":false,"deleteNoSetter":false,"updateOwnerId":false,"updateOutcome":true,"updateScheduledFor":true}
delete meeting : … "set_by" = $1 … and … meeting_participants …   (the delete rule AND the participation read)
── dispatcher · Meeting
{"deleteMine":false,"deleteOthers":false,"deleteNoSetter":false,"updateOwnerId":false,"updateOutcome":true,"updateScheduledFor":true}
delete meeting : false
```

`assertRulesCompile()` must not throw (no `can` after a `cannot` for the same action and subject; no bare rule beside a conditioned one).

- [ ] **Step 8: Gate**

Run: `pnpm tsc > .superpowers/sdd/u4p1-t2-tsc.log 2>&1; echo tsc=$?; pnpm lint > .superpowers/sdd/u4p1-t2-lint.log 2>&1; echo lint=$?`
Expected: `tsc=0`, `lint=0`.

- [ ] **Step 9: Commit and push**

```bash
git add src/shared/entities/meetings/lib/server-spec.ts src/shared/domains/permissions/rules/agent.ts src/shared/domains/permissions/rules/dispatcher.ts src/shared/entities/meetings/dal/server/crud.ts src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx
git commit -m "feat(permissions): agents delete the meetings they set; ownership moves only with its participants"
git push
```

### Task 3: The agent's proposal field list and the contract envelope reason

**Files:**
- Modify: `src/shared/domains/permissions/rules/agent.ts:22-25` (the proposal block)
- Modify: `src/shared/domains/permissions/rules/system.ts` (`SystemReason`)
- Modify: `src/shared/services/contracts.service.ts` (imports; `createDraft`, `createContractEnvelope`, `sendContractEnvelope`, `recallContractEnvelope`, `discardContractEnvelopeDraft`, `resendContractEnvelope`)
- Probe (git-ignored): `.superpowers/permissions-probes/unit4-part1-rules.ts` (extend)

**Interfaces:**
- Consumes: `permit(ctx, action, spec, fields?)` from `@/shared/dal/server/lib/permissions/permit`; `systemContext(reason)` from `@/shared/dal/server/lib/contexts`; `proposalServerSpec` from `@/shared/modules/proposals/core/server-spec`.
- Produces: `SystemReason` gains `'derived:contract-envelope'`. The contract service's exported surface is unchanged.

- [ ] **Step 1: Extend the probe, watch it fail**

Append to `.superpowers/permissions-probes/unit4-part1-rules.ts` (add `import { systemContext } from '@/shared/dal/server/lib/contexts'` to the imports):

```ts
for (const role of ['super-admin', 'agent', 'dispatcher'] as UserRole[]) {
  const ab = ctxFor(role).actor.ability
  // Each string is a real proposal column or sub-entity path; the field union is too wide to spell per line.
  const may = (field: string) => ab.can('update', 'Proposal', field as never)
  console.log(`\n── ${role} · Proposal update`)
  console.log(JSON.stringify({
    label: may('label'),
    projectJSON: may('projectJSON'),
    startingTcp: may('startingTcpCents'),
    financeOption: may('financeOptionId'),
    status: may('status'),
    sentAt: may('sentAt'),
    approvedAt: may('approvedAt'),
    envelopeDocs: may('envelopeDocumentIds'),
    incentives: may('incentives'),
    incentiveAmount: may('incentives.amountCents'),
    media: may('media'),
    mediaVisibility: may('media.visibility'),
    views: may('views'),
    token: may('token'),
    kind: may('kind'),
    ownerId: may('ownerId'),
    meetingId: may('meetingId'),
    createdAt: may('createdAt'),
    contractEnvelopeId: may('contractEnvelopeId'),
    contractSentAt: may('contractSentAt'),
    contractSignedAt: may('contractSignedAt'),
    qbInvoiceId: may('qbInvoiceId'),
  }))
}
const envelope = systemContext('derived:contract-envelope').actor.ability
console.log('\n── derived:contract-envelope', JSON.stringify({ manageAll: envelope.can('manage', 'all') }))
```

(The agent's list itself is type-checked where it is written: `defineRules` rejects a misspelt column or unknown path in `agent.ts`.)

Run: `pnpm tsc -p .superpowers/tsconfig.probe.json --noEmit 2>&1 | grep unit4 | head -3`
Expected: one error, `Argument of type '"derived:contract-envelope"' is not assignable to parameter of type 'SystemReason'`.

- [ ] **Step 2: Add the reason**

`src/shared/domains/permissions/rules/system.ts`, after `| 'derived:envelope-documents'`:

```ts
    | 'derived:envelope-documents'
    | 'derived:contract-envelope'
```

- [ ] **Step 3: The agent's proposal rules**

`src/shared/domains/permissions/rules/agent.ts`, the proposal block becomes:

```ts
    // A proposal is reached through the meeting it was made in; the row filter and the UI read this one rule.
    can('read', 'Proposal', { $participatesViaMeeting: { via: 'meetingId', userId } })
    can('create', 'Proposal')
    // What a rep builds and sends. The share link, the contract trail, the books, the created date and
    // the meeting a proposal belongs to are the system's or the office's.
    can('update', 'Proposal', [
      'label',
      'priceDisplayMode',
      'projectJSON',
      'startingTcpCents',
      'depositAmountCents',
      'cashInDealCents',
      'miscPriceCents',
      'financeOptionId',
      'status',
      'sentAt',
      'approvedAt',
      // Choosing the documents is the rep's; the reconciled selection is written as a derived system write.
      'envelopeDocumentIds',
      'incentives',
      'incentives.*',
      'media',
      'media.*',
    ])
```

- [ ] **Step 4: The contract service checks the caller, then writes as the envelope**

`src/shared/services/contracts.service.ts`. Add imports (keep the order the linter wants; `pnpm eslint --fix` on the file settles it):

```ts
import { systemContext } from '@/shared/dal/server/lib/contexts'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
```

Inside `createContractService()`, above `createDraft`, add:

```ts
  // The envelope columns mirror what Zoho holds, so only this service writes them. The caller's right to
  // work the proposal is checked before Zoho is called, so a refused caller never creates or recalls an envelope.
  async function loadWorkable(ctx: ScopedContext, proposalId: string) {
    if (!(await permit(ctx, 'update', proposalServerSpec).probe(proposalId))) {
      throw new Error(`Proposal ${proposalId} not found`)
    }
    const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`)
    }
    return proposal
  }

  async function writeEnvelope(proposalId: string, data: Pick<InsertProposalSchema, 'contractEnvelopeId' | 'contractSentAt'>) {
    dalVerifySuccess(await proposalCrud.update(systemContext('derived:contract-envelope'), { id: proposalId, data }))
  }
```

Then, in each of `createDraft`, `createContractEnvelope`, `sendContractEnvelope`, `recallContractEnvelope`, `discardContractEnvelopeDraft` and `resendContractEnvelope`, replace the opening

```ts
    const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`)
    }
```

with

```ts
    const proposal = await loadWorkable(ctx, proposalId)
```

and replace each envelope write:

- `createDraft`: `dalVerifySuccess(await proposalCrud.update(ctx, { id: proposalId, data: { contractEnvelopeId: requestId } }))` → `await writeEnvelope(proposalId, { contractEnvelopeId: requestId })`
- `sendContractEnvelope` and `resendContractEnvelope`: the `proposalCrud.update(ctx, { id: proposalId, data: { contractSentAt: new Date().toISOString() } })` call → `await writeEnvelope(proposalId, { contractSentAt: new Date().toISOString() })`
- `recallContractEnvelope` and `discardContractEnvelopeDraft`: the `proposalCrud.update(ctx, { … data: { contractEnvelopeId: null, contractSentAt: null } })` call → `await writeEnvelope(proposalId, { contractEnvelopeId: null, contractSentAt: null })`

Leave `applyContractEvent` (the Zoho webhook, already `webhook:zoho-sign`) and `getContractEnvelopeStatus` as they are.

- [ ] **Step 5: Run the probe**

Run: `pnpm tsc -p .superpowers/tsconfig.probe.json --noEmit; echo probe-tsc=$?`
Expected: `probe-tsc=0`.

Run: `pnpm tsx --tsconfig tsconfig.json .superpowers/permissions-probes/unit4-part1-rules.ts`
Expected, after the Meeting lines of Task 2 (unchanged):

```
── super-admin · Proposal update
every key true
── agent · Proposal update
{"label":true,"projectJSON":true,"startingTcp":true,"financeOption":true,"status":true,"sentAt":true,"approvedAt":true,"envelopeDocs":true,"incentives":true,"incentiveAmount":true,"media":true,"mediaVisibility":true,"views":false,"token":false,"kind":false,"ownerId":false,"meetingId":false,"createdAt":false,"contractEnvelopeId":false,"contractSentAt":false,"contractSignedAt":false,"qbInvoiceId":false}
── dispatcher · Proposal update
every key false
── derived:contract-envelope {"manageAll":true}
```

- [ ] **Step 6: Every agent-side proposal write is on the list**

Run: `git grep -n "proposalCrud.update(ctx\|permit(ctx, 'update', proposalServerSpec" -- src`
Expected: only these, each writing or probing a listed column (or no column):
- `features/customer-pipelines/dal/server/move-customer-pipeline-item.ts` — `permit(...).sql` (no field) and `proposalCrud.update(ctx, … { status: 'declined' })`
- `modules/proposals/core/dal/server/mutations.ts` — `['cashInDealCents']`
- `modules/proposals/incentives/service.ts` — `['incentives']`
- `modules/proposals/media/service.ts` — `['media']`
- `trpc/routers/ai.router/index.ts` — `['projectJSON']`
- `trpc/routers/proposals.router/contracts.router.ts` — `['envelopeDocumentIds']`
- `trpc/routers/proposals.router/delivery.router.ts` — `proposalCrud.update(ctx, … { status: 'sent', sentAt })`
- `shared/services/contracts.service.ts` — `permit(ctx, 'update', proposalServerSpec).probe` (no field) inside `loadWorkable`; `applyContractEvent`'s `proposalCrud.update(ctx, …)` runs under the webhook's system context

Client writes through `proposalsRouter.crud.update`: the edit form (`label`, `priceDisplayMode`, `projectJSON`, the price columns), the funding picker (`financeOptionId`), the records table (`status`, `approvedAt`, `createdAt` — the last is office-only, Task 4), the assign-project dialog (`status`). All on the list except `createdAt`.

- [ ] **Step 7: Gate**

Run: `pnpm tsc > .superpowers/sdd/u4p1-t3-tsc.log 2>&1; echo tsc=$?; pnpm lint > .superpowers/sdd/u4p1-t3-lint.log 2>&1; echo lint=$?`
Expected: `tsc=0`, `lint=0`.

- [ ] **Step 8: Commit and push**

```bash
git add src/shared/domains/permissions/rules/agent.ts src/shared/domains/permissions/rules/system.ts src/shared/services/contracts.service.ts
git commit -m "feat(permissions): agents write the proposal columns they build and send; the contract envelope columns are the contract service's"
git push
```

### Task 4: The created date is the office's

**Files:**
- Modify: `src/shared/modules/proposals/core/lib/columns-registry.tsx:88-110` (the `createdAt` cell)
- Modify: `src/features/proposal-flow/ui/components/table/index.tsx` (imports; the `meta` memo, near line 127)
- Modify: `src/shared/entities/customers/components/customers-table.tsx` (imports; the `meta` memo, near line 60)

**Interfaces:**
- Consumes: `useAbility()` from `@/shared/domains/permissions/client`; `ProposalTableMeta.onUpdateCreatedAt?`, `CustomerTableMeta.onUpdateCreatedAt?` (both already optional).
- Produces: the proposal `createdAt` cell renders plain text when `onUpdateCreatedAt` is absent, like the customer cell already does.

The server already refuses: agents' and dispatchers' `update Customer` lists leave out `createdAt`, and Task 3's proposal list does too. This task stops offering a picker that can only fail.

- [ ] **Step 1: The proposal cell renders read-only without a handler**

`src/shared/modules/proposals/core/lib/columns-registry.tsx`, the `createdAt` column's `cell` becomes:

```tsx
    cell: ({ row, table }) => {
      const meta = table.options.meta as ProposalTableMeta | undefined
      const { relative, dayAtTime } = formatDateCell(row.original.createdAt)
      const stack = (
        <div className="flex flex-col">
          <span className="text-sm font-medium leading-tight">{relative}</span>
          <span className="text-xs text-muted-foreground">{dayAtTime}</span>
        </div>
      )
      if (!meta?.onUpdateCreatedAt) {
        return <div className="max-w-40">{stack}</div>
      }
      const onUpdate = meta.onUpdateCreatedAt
      return (
        <div className="max-w-40" onClick={e => e.stopPropagation()}>
          <DateTimePicker
            value={new Date(row.original.createdAt)}
            onChange={(date) => {
              if (date) {
                onUpdate(row.original.id, date)
              }
            }}
          >
            {stack}
          </DateTimePicker>
        </div>
      )
    },
```

- [ ] **Step 2: The proposals table hands the picker only to the office**

`src/features/proposal-flow/ui/components/table/index.tsx`. Import:

```ts
import { useAbility } from '@/shared/domains/permissions/client'
```

In `PastProposalsTable`, beside the other hooks:

```ts
  const ability = useAbility()
  const canBackdate = ability.can('update', 'Proposal', 'createdAt')
```

In the `meta` memo, replace the `onUpdateCreatedAt` entry with:

```ts
    onUpdateCreatedAt: canBackdate
      ? (id, date) => updateProposal.mutate(
          { id, data: { createdAt: date.toISOString() } },
          { onSuccess: () => toast.success('Created date updated') },
        )
      : undefined,
```

and add `canBackdate` to that memo's dependency array.

- [ ] **Step 3: The customers table likewise**

`src/shared/entities/customers/components/customers-table.tsx`. Import:

```ts
import { useAbility } from '@/shared/domains/permissions/client'
```

Beside the other hooks in the component:

```ts
  const ability = useAbility()
  const canBackdate = ability.can('update', 'Customer', 'createdAt')
```

The `meta` memo becomes:

```ts
  const meta = useMemo<CustomerTableMeta>(
    () => ({
      rowActions: actions,
      onUpdateCreatedAt: canBackdate
        ? (customerId, date) => updateCreatedAt.mutate({ id: customerId, data: { createdAt: date.toISOString() } })
        : undefined,
    }),
    [actions, canBackdate, updateCreatedAt],
  )
```

(The lead-sources admin's two customer sections are super-admin pages; they keep their handler.)

- [ ] **Step 4: Gate**

Run: `pnpm tsc > .superpowers/sdd/u4p1-t4-tsc.log 2>&1; echo tsc=$?; pnpm lint > .superpowers/sdd/u4p1-t4-lint.log 2>&1; echo lint=$?`
Expected: `tsc=0`, `lint=0`.

- [ ] **Step 5: Commit and push**

```bash
git add src/shared/modules/proposals/core/lib/columns-registry.tsx src/features/proposal-flow/ui/components/table/index.tsx src/shared/entities/customers/components/customers-table.tsx
git commit -m "feat(permissions): only the office changes a proposal's or customer's created date"
git push
```

### Task 5: Whole-part review, the owner's hand checks, and the record

**Files:**
- Modify: `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (§0 status, §0.3 Q8, §4 Unit 4 record, Appendix A)
- Modify: `docs/plans/2026-09-07-casl-re-grounding/DISTILLED-2026-10-01.md` (§1 status, §7 next steps)
- Modify: memory `project-permissions-casl-compiler.md` and its `MEMORY.md` line
- Delete (own commit): this plan

- [ ] **Step 1: One fresh whole-part review** of `git diff 5f3bb1398..HEAD -- src`, against this plan and the Review Focus. Fix confirmed defects as their own commits.

- [ ] **Step 2: The owner's hand checks** (dev server on port 3003; the owner chooses the records):
  - **H1 (agent):** book a meeting, then delete it from the meetings table: it goes, and so does its calendar event.
  - **H2 (agent):** a meeting you sit in but did not book: no Delete in its menu, in the table or elsewhere.
  - **H3 (agent):** on a draft proposal: edit the label and a price, add and remove an incentive, upload a photo, toggle its visibility, delete it. All save.
  - **H4 (agent):** contract flow on a draft proposal: create the draft envelope, discard it, create again, send, recall. The proposal's lock notice follows each step.
  - **H5 (agent):** choose the envelope documents: saves.
  - **H6 (agent):** proposals table: the created date is not editable; changing a status still works. Projects kanban: drag "proposal sent → declined" still works.
  - **H7 (dispatcher):** set a meeting's outcome: saves. Book a meeting: its setter is you. No Delete on any meeting.
  - **H8 (agent):** duplicate a meeting: the copy's setter is you, and you can delete the copy.
  - **H9 (super-admin):** edit the created date on a proposal and a customer; set a meeting's setter; delete any meeting.

- [ ] **Step 3: Record**
  - Tracker §4 Unit 4: a "Part 1 (Meeting and Proposal writes)" record (commits, probe output summary, hand checks, what part 2 holds); §0 status; §0.3 Q8 (rows built); Appendix A one line.
  - DISTILLED §1 status line and §7 next steps.
  - Memory `project-permissions-casl-compiler.md` and its `MEMORY.md` line.

```bash
git add docs/plans/2026-08-10-casl-scope-compiler-epic.md docs/plans/2026-09-07-casl-re-grounding/DISTILLED-2026-10-01.md
git commit -m "docs(permissions): record unit 4 part 1"
git push
```

- [ ] **Step 4: Delete this plan in its own commit**

```bash
git rm docs/superpowers/plans/2026-10-14-permissions-unit-4-part-1-meeting-and-proposal-writes.md
git commit -m "docs(permissions): delete the unit 4 part 1 plan now that it ships"
git push
```
