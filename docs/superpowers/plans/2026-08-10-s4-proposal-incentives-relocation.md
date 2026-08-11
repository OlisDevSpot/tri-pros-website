# S4 — proposal-incentives Relocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the `proposal_incentives` child-table code (mappers, list read, replace-all write, duplicate clone) out of the parent `entities/proposals/` folder into its own `entities/proposal-incentives/` entity — with zero behavior change.

**Architecture:** Approach A (pure relocation — deliberate, likely-temporary down-scale: NO `server-spec.ts`, NO `createCrudDal`, NO `ENTITY_NAMES`/CASL entry, NO child procedure). The bespoke `replaceProposalIncentives` keeps its own parent-scoped select + lock gate; the proposal-level `recomputeProposalFinancials` stays in the parent and is imported back by the child. The one refactor beyond a move: the duplicate override's raw `db.insert(proposalIncentives)` is extracted into a child DAL `cloneProposalIncentives`.

**Tech Stack:** TypeScript, Drizzle (Postgres/Neon), tRPC, the project DAL toolkit (`dalDbOperation`, `dalVerifySuccess`, `DalReturn`).

## Global Constraints

- NEVER run `pnpm build`. Verify with `pnpm tsc` + `pnpm lint` only.
- Work on `main`; stage explicitly by path (never `git add -A`).
- Behavior must be byte-for-byte preserved on every path (this is a relocation, not a feature).
- `recomputeProposalFinancials` and `setCashInDeal` STAY in `entities/proposals/dal/server/mutations.ts` (proposal-level rollup + funding blob).
- The domain schema `incentiveSchema`/`incentiveTypes`/`Incentive` STAYS in `entities/proposals/schemas` (shared funding-form domain).
- The DB schema `src/shared/db/schema/proposal-incentives.ts` STAYS (schema-dir convention).
- After each move, prune imports that became unused in the source file; `pnpm lint` must report zero unused-import errors introduced by this slice. The only pre-existing lint error permitted to remain is `src/trpc/server.ts:6` (unrelated WIP).
- tRPC path `proposals.incentives.replace` is unchanged; zero client changes.

---

### Task 1: Move the row↔domain mappers to the child `lib/`

**Files:**
- Create: `src/shared/entities/proposal-incentives/lib/incentive-rows.ts`
- Delete: `src/shared/entities/proposals/lib/incentive-rows.ts`
- Modify (repoint import): `src/shared/entities/proposals/dal/server/mutations.ts:16`
- Modify (repoint import): `src/shared/entities/proposals/dal/server/queries.ts:32`

**Interfaces:**
- Produces: `incentiveRowsToDomain(rows: ProposalIncentiveRow[]): Incentive[]` and `domainIncentivesToRows(proposalId: string, incentives: Incentive[]): InsertProposalIncentive[]`, now exported from `@/shared/entities/proposal-incentives/lib/incentive-rows`.

- [ ] **Step 1: Create the child lib file with the mappers moved verbatim**

Copy the full current contents of `src/shared/entities/proposals/lib/incentive-rows.ts` into the new file unchanged. The imports it uses (`InsertProposalIncentive`, `ProposalIncentiveRow` from `@/shared/db/schema/proposal-incentives`; `Incentive` from `@/shared/entities/proposals/schemas`) resolve from the new location without change (absolute `@/` paths). Update the one relative doc-comment ref `see ../DOCS.md#final-tcp-derived` to `see ../../proposals/DOCS.md#final-tcp-derived`.

- [ ] **Step 2: Delete the old mappers file**

Delete `src/shared/entities/proposals/lib/incentive-rows.ts`.

- [ ] **Step 3: Repoint the two importers**

In `src/shared/entities/proposals/dal/server/mutations.ts` line 16 and `src/shared/entities/proposals/dal/server/queries.ts` line 32, change:
`from '@/shared/entities/proposals/lib/incentive-rows'`
→ `from '@/shared/entities/proposal-incentives/lib/incentive-rows'`

- [ ] **Step 4: Verify types + lint**

Run: `pnpm tsc`
Expected: no errors.
Run: `pnpm lint`
Expected: no new errors (only the pre-existing `src/trpc/server.ts:6` may remain).

---

### Task 2: Move `listProposalIncentives` to the child `dal/server/queries.ts`

**Files:**
- Create: `src/shared/entities/proposal-incentives/dal/server/queries.ts`
- Modify (remove the function): `src/shared/entities/proposals/dal/server/queries.ts:163-178` (the `listProposalIncentives` block + its doc comment)
- Modify (repoint import + add import in parent): `src/shared/entities/proposals/dal/server/queries.ts` (getFullView call at line 148)
- Modify (repoint import): `src/shared/entities/proposals/dal/server/mutations.ts:15`
- Modify (repoint import): `src/shared/entities/proposals/dal/server/duplicate.ts:20`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `listProposalIncentives(proposalId: string): Promise<DalReturn<ProposalIncentiveRow[]>>` exported from `@/shared/entities/proposal-incentives/dal/server/queries`. Returns GLOBAL rows only (`sow_item_id IS NULL`), position-ordered.

- [ ] **Step 1: Create the child queries file**

```ts
// GLOBAL incentive rows (sow_item_id IS NULL) for a proposal, position-ordered.
// The read half of the replace-all upsert; also the W2→W3 hydration source
// consumed by the proposals `getFullView`. see ../../../proposals/DOCS.md#final-tcp-derived

import type { DalReturn } from '@/shared/dal/server/types'
import type { ProposalIncentiveRow } from '@/shared/db/schema/proposal-incentives'

import { and, asc, eq, isNull } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { proposalIncentives } from '@/shared/db/schema/proposal-incentives'

export async function listProposalIncentives(
  proposalId: string,
): Promise<DalReturn<ProposalIncentiveRow[]>> {
  return dalDbOperation(async () => {
    return await db
      .select()
      .from(proposalIncentives)
      .where(and(eq(proposalIncentives.proposalId, proposalId), isNull(proposalIncentives.sowItemId)))
      .orderBy(asc(proposalIncentives.position))
  })
}
```

- [ ] **Step 2: Remove `listProposalIncentives` from the parent queries file**

Delete the `listProposalIncentives` function and its doc comment from `src/shared/entities/proposals/dal/server/queries.ts` (the block ending at line 178).

- [ ] **Step 3: Import `listProposalIncentives` into the parent for `getFullView`**

`getFullView` (line 148) still calls `listProposalIncentives(row.id)`. Add an import to `src/shared/entities/proposals/dal/server/queries.ts`:
`import { listProposalIncentives } from '@/shared/entities/proposal-incentives/dal/server/queries'`
Then prune any imports in that file that are now unused because the function moved out — check `proposalIncentives` (schema, line 28) and `ProposalIncentiveRow` (type, line 8): if no other reference remains in the file, remove them. (`isNull`/`asc` come from the shared drizzle import and are used elsewhere — leave them.)

- [ ] **Step 4: Repoint the other two importers**

- `src/shared/entities/proposals/dal/server/mutations.ts:15` — change to `from '@/shared/entities/proposal-incentives/dal/server/queries'`.
- `src/shared/entities/proposals/dal/server/duplicate.ts:20` — change to `from '@/shared/entities/proposal-incentives/dal/server/queries'`.

- [ ] **Step 5: Verify types + lint**

Run: `pnpm tsc`
Expected: no errors.
Run: `pnpm lint`
Expected: no new errors. If lint reports an unused `proposalIncentives`/`ProposalIncentiveRow` in `proposals/dal/server/queries.ts`, remove those imports and re-run.

---

### Task 3: Move `replaceProposalIncentives` + add `cloneProposalIncentives`; refactor the duplicate override

**Files:**
- Create: `src/shared/entities/proposal-incentives/dal/server/mutations.ts`
- Modify (remove `replaceProposalIncentives`): `src/shared/entities/proposals/dal/server/mutations.ts:51-96`
- Modify (call child clone, drop raw insert): `src/shared/entities/proposals/dal/server/duplicate.ts`
- Modify (repoint import): `src/trpc/routers/proposals.router/incentives.router.ts:14`

**Interfaces:**
- Consumes: `listProposalIncentives` (Task 2); `domainIncentivesToRows` (Task 1); `recomputeProposalFinancials` and `isProposalFrozen` from the parent.
- Produces:
  - `replaceProposalIncentives(ctx: ScopedContext, input: { proposalId: string, incentives: Incentive[] }): Promise<DalReturn<ProposalIncentiveRow[]>>`
  - `cloneProposalIncentives(sourceId: string, targetId: string): Promise<DalReturn<number>>` — clones the source's GLOBAL rows onto the target, returns the number of rows cloned (0 = none).
  - Both exported from `@/shared/entities/proposal-incentives/dal/server/mutations`.

- [ ] **Step 1: Create the child mutations file**

Move `replaceProposalIncentives` verbatim (its body already scopes on `proposals` via `ctx.scope`, gates on `isProposalFrozen`, and calls `recomputeProposalFinancials`), and add `cloneProposalIncentives`:

```ts
// proposal_incentives child-table writes (Wave 2). Replace-all upsert from the
// funding form + the duplicate-clone. Both gate through / re-drive the parent's
// financial rollup, which stays proposal-owned (imported back here).
// see ../../../proposals/DOCS.md#proposal-lock-ladder

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { InsertProposalIncentive, ProposalIncentiveRow } from '@/shared/db/schema/proposal-incentives'
import type { Incentive } from '@/shared/entities/proposals/schemas'

import { and, eq, isNull } from 'drizzle-orm'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { proposalIncentives } from '@/shared/db/schema/proposal-incentives'
import { proposals } from '@/shared/db/schema/proposals'
import { recomputeProposalFinancials } from '@/shared/entities/proposals/dal/server/mutations'
import { domainIncentivesToRows } from '@/shared/entities/proposal-incentives/lib/incentive-rows'
import { listProposalIncentives } from '@/shared/entities/proposal-incentives/dal/server/queries'
import { isProposalFrozen } from '@/shared/entities/proposals/lib/proposal-lock'

/**
 * Replace-all upsert of GLOBAL incentives (funding-form save path). Lock gate:
 * refuses while the proposal is anywhere on the lock ladder (`isProposalFrozen`).
 * see ../../../proposals/DOCS.md#proposal-lock-ladder
 */
export async function replaceProposalIncentives(
  ctx: ScopedContext,
  input: { proposalId: string, incentives: Incentive[] },
): Promise<DalReturn<ProposalIncentiveRow[]>> {
  return dalDbOperation(async () => {
    const [proposal] = await db
      .select({
        id: proposals.id,
        status: proposals.status,
        contractEnvelopeId: proposals.contractEnvelopeId,
        contractSentAt: proposals.contractSentAt,
        contractSignedAt: proposals.contractSignedAt,
        contractDeclinedAt: proposals.contractDeclinedAt,
      })
      .from(proposals)
      .where(and(eq(proposals.id, input.proposalId), ctx.scope ?? undefined))
    if (!proposal) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    if (isProposalFrozen(proposal)) {
      throw new ThrowableDalError({ type: 'precondition-failed', reason: 'proposal_frozen' })
    }
    const rows = domainIncentivesToRows(input.proposalId, input.incentives)
    await db.transaction(async (tx) => {
      await tx.delete(proposalIncentives).where(and(
        eq(proposalIncentives.proposalId, input.proposalId),
        isNull(proposalIncentives.sowItemId),
      ))
      if (rows.length > 0) {
        await tx.insert(proposalIncentives).values(rows)
      }
    })
    dalVerifySuccess(await recomputeProposalFinancials(input.proposalId))
    return dalVerifySuccess(await listProposalIncentives(input.proposalId))
  })
}

/**
 * Clone the source proposal's GLOBAL incentive rows onto the target. Returns the
 * count cloned so the duplicate override only re-drives the rollup when rows
 * existed (preserving the pre-relocation control flow). The financial recompute
 * stays with the caller (proposal orchestration).
 * see ../../../proposals/DOCS.md#duplicate-resets-and-redrives
 */
export async function cloneProposalIncentives(
  sourceId: string,
  targetId: string,
): Promise<DalReturn<number>> {
  return dalDbOperation(async () => {
    const source = dalVerifySuccess(await listProposalIncentives(sourceId))
    if (source.length === 0) {
      return 0
    }
    const rows: InsertProposalIncentive[] = source.map(row => ({
      proposalId: targetId,
      sowItemId: null,
      type: row.type,
      position: row.position,
      label: row.label,
      amountCents: row.amountCents,
      offer: row.offer,
      notes: row.notes,
      expiresAt: row.expiresAt,
    }))
    await db.insert(proposalIncentives).values(rows)
    return rows.length
  })
}
```

- [ ] **Step 2: Remove `replaceProposalIncentives` from the parent mutations file**

Delete the `replaceProposalIncentives` function + its doc comment (block at lines 51-96) from `src/shared/entities/proposals/dal/server/mutations.ts`. Then prune imports that are now unused there: `ProposalIncentiveRow` (type), `Incentive` (type), `isNull` (from the drizzle import — confirm `recomputeProposalFinancials`/`setCashInDeal` don't use it; they don't), `proposalIncentives` (schema), `listProposalIncentives`, `domainIncentivesToRows`. KEEP `isProposalFrozen` (used by `setCashInDeal`), `scrubBlobIncentives`, `and`, `eq`, `sql`.

- [ ] **Step 3: Refactor the duplicate override to call `cloneProposalIncentives`**

Rewrite the body of `duplicateProposalWithIncentives` in `src/shared/entities/proposals/dal/server/duplicate.ts` (keep the file's header comment and the `proposalCrud`/`recomputeProposalFinancials` imports):

```ts
export async function duplicateProposalWithIncentives(
  ctx: ScopedContext,
  input: { id: string },
): Promise<DalReturn<Proposal>> {
  return dalDbOperation(async () => {
    const duplicated = dalVerifySuccess(await proposalCrud.duplicate(ctx, input))

    const cloned = dalVerifySuccess(await cloneProposalIncentives(input.id, duplicated.id))
    if (cloned === 0) {
      return duplicated
    }

    // `create.after` already ran `recomputeProposalFinancials` once against zero
    // incentive rows — re-run now that the copied rows exist and merge the fresh
    // rollup into the returned row (avoid a second full getById round trip).
    const { finalTcpCents } = dalVerifySuccess(await recomputeProposalFinancials(duplicated.id))
    return { ...duplicated, finalTcpCents }
  })
}
```

Update imports in `duplicate.ts`: remove `InsertProposalIncentive` (type), `proposalIncentives` (schema), `listProposalIncentives`, and the now-unused `db` import IF no other `db.` reference remains in the file (the raw insert was the only one — confirm and remove). Add `import { cloneProposalIncentives } from '@/shared/entities/proposal-incentives/dal/server/mutations'`. Keep `recomputeProposalFinancials` + `proposalCrud`.

- [ ] **Step 4: Repoint the router import**

In `src/trpc/routers/proposals.router/incentives.router.ts` line 14, change:
`from '@/shared/entities/proposals/dal/server/mutations'`
→ `from '@/shared/entities/proposal-incentives/dal/server/mutations'`
Leave the `incentiveSchema` import (line 15) unchanged.

- [ ] **Step 5: Verify types + lint**

Run: `pnpm tsc`
Expected: no errors. In particular, confirm no import cycle surfaced (`proposal-incentives/mutations` → `proposals/mutations` for the recompute is the only cross-entity mutation edge, and `proposals/mutations` no longer imports anything from `proposal-incentives`).
Run: `pnpm lint`
Expected: no new errors; remove any leftover unused imports it flags.

---

### Task 4: Full verification, docs, and commit

**Files:**
- Modify: `docs/plans/2026-08-09-trpc-standardization-epic.md` (mark S4 shipped)
- Modify: `memory/project-trpc-standardization-epic.md` (append S4 shipped note)

- [ ] **Step 1: Full type + lint sweep**

Run: `pnpm tsc` → no errors.
Run: `pnpm lint` → only the pre-existing `src/trpc/server.ts:6` error may remain.

- [ ] **Step 2: Behavior sanity review (read-through, no runtime needed)**

Confirm by inspection:
1. `proposals.incentives.replace` → `replaceProposalIncentives` (new path) still: scopes the parent select on `ctx.scope`, gates on `isProposalFrozen`, replaces GLOBAL rows in a transaction, recomputes financials, returns the fresh list.
2. `getFullView` still hydrates `fundingJSON.data.incentives` via `incentiveRowsToDomain(listProposalIncentives(...))`.
3. `duplicateProposalWithIncentives` still clones GLOBAL rows and re-drives `finalTcpCents` only when rows existed (the `cloned === 0` short-circuit mirrors the old `sourceIncentives.length === 0` return).

- [ ] **Step 3: Mark S4 shipped in the plan doc**

In `docs/plans/2026-08-09-trpc-standardization-epic.md`, change the S4 checkbox to `[x]` and append a shipped note: Approach A relocation; new `entities/proposal-incentives/{lib/incentive-rows,dal/server/queries,dal/server/mutations}.ts`; deliberate down-scale (no spec/CRUD/registry/child-procedure); `cloneProposalIncentives` extracted from the duplicate override; `recomputeProposalFinancials`/`setCashInDeal`/domain schema stayed in proposals; tRPC path unchanged; tsc+lint green.

- [ ] **Step 4: Append the S4 note to memory**

In `memory/project-trpc-standardization-epic.md`, append a short "S4 SHIPPED 2026-08-10 — Approach A relocation" paragraph mirroring the S5b note style (what moved, the deliberate down-scale, the clone extraction, behavior preserved).

- [ ] **Step 5: Commit (explicit paths only — confirm with the user first)**

Stage exactly the touched paths (never `git add -A`):

```bash
git add \
  src/shared/entities/proposal-incentives/lib/incentive-rows.ts \
  src/shared/entities/proposal-incentives/dal/server/queries.ts \
  src/shared/entities/proposal-incentives/dal/server/mutations.ts \
  src/shared/entities/proposals/dal/server/queries.ts \
  src/shared/entities/proposals/dal/server/mutations.ts \
  src/shared/entities/proposals/dal/server/duplicate.ts \
  src/trpc/routers/proposals.router/incentives.router.ts \
  docs/plans/2026-08-09-trpc-standardization-epic.md \
  docs/superpowers/specs/2026-08-10-s4-proposal-incentives-relocation-design.md \
  docs/superpowers/plans/2026-08-10-s4-proposal-incentives-relocation.md \
  memory/project-trpc-standardization-epic.md
```

(The deleted `src/shared/entities/proposals/lib/incentive-rows.ts` is captured by `git add` of its directory-mates or add it explicitly with `git add -u src/shared/entities/proposals/lib/incentive-rows.ts`.)

```bash
git commit -m "refactor(proposals): relocate proposal_incentives to its own entity (S4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** every spec section maps to a task — mappers move (T1), `listProposalIncentives` move + parent repoint (T2), `replaceProposalIncentives` move + `cloneProposalIncentives` extraction + duplicate refactor + router repoint (T3), verification + docs (T4). Down-scale (no spec/CRUD/registry) is honored by omission and stated in Global Constraints/Architecture. Import/cycle-safety is checked in T3 Step 5.

**Placeholder scan:** none — every code step has literal code; every repoint names the exact file:line.

**Type consistency:** `listProposalIncentives`, `replaceProposalIncentives`, `cloneProposalIncentives`, `incentiveRowsToDomain`, `domainIncentivesToRows` signatures match across the tasks that produce and consume them. `cloneProposalIncentives` returns `DalReturn<number>`; T3 Step 3 consumes it as `cloned === 0`.
