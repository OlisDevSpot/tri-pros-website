# Contracts Cluster Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate 5 remaining consumers of the deprecated `shared/dal/server/proposals/api.ts` to the three-layer convention (tRPC → Service → DAL), then delete the old file.

**Architecture:** Services receive `ScopedContext` and forward to DAL calls. tRPC procedures are thin — auth + invoke. Jobs use `SYSTEM_CONTEXT`. Cross-entity writes use `SYSTEM_CONTEXT` + the target entity's `createCrudDal()` handlers.

**Tech Stack:** tRPC, Drizzle ORM, Zod, EntityServerSpec, ScopedContext, DalReturn

**Spec:** `docs/superpowers/specs/2026-05-18-contracts-cluster-migration.md`

**Reference implementations:**
- `src/trpc/routers/proposals.router/delivery.router.ts` — entity toolkit sub-router pattern
- `src/shared/entities/proposals/dal/server/queries.ts` — DAL query pattern
- `src/shared/entities/proposals/lib/server-spec.ts` — EntityServerSpec pattern

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| **Create** | `src/shared/entities/customers/lib/visibility.ts` | `customerVisibility(userId)` for EntityServerSpec |
| **Create** | `src/shared/entities/customers/lib/server-spec.ts` | `customerServerSpec` — EntityServerSpec for customers |
| **Modify** | `src/shared/entities/proposals/dal/server/queries.ts` | Add `getBySigningRequestId` query |
| **Modify** | `src/shared/services/pdf.service.ts` | Add `ctx: ScopedContext` param to `generateSowPdf` |
| **Modify** | `src/shared/services/contract.service.ts` | Full refactor: `ownerKey` → `ctx`, absorb `applyContractEvent` |
| **Modify** | `src/trpc/routers/proposals.router/contracts.router.ts` | Convert to `createContractsRouter(entity)` factory |
| **Modify** | `src/trpc/routers/proposals.router/index.ts` | Wire `createContractsRouter(entity)` |
| **Modify** | `src/shared/services/upstash/jobs/sync-zoho-sign-status.ts` | Call service with `SYSTEM_CONTEXT` |
| **Modify** | `src/shared/services/upstash/jobs/sync-contract-draft.ts` | Drop `ownerKey`, use `SYSTEM_CONTEXT` |
| **Modify** | `src/trpc/routers/proposals.router/delivery.router.ts` | Drop `ownerKey` from job dispatch |
| **Modify** | `src/app/api/proposals/[proposalId]/summary/route.ts` | Replace old import with `getFullView` + `SYSTEM_CONTEXT` |
| **Delete** | `src/shared/dal/server/proposals/api.ts` | All consumers migrated |

---

## Task 1: Customer Entity Spec + Visibility

**Files:**
- Create: `src/shared/entities/customers/lib/visibility.ts`
- Create: `src/shared/entities/customers/lib/server-spec.ts`

- [ ] **Step 1: Create customerVisibility**

Create `src/shared/entities/customers/lib/visibility.ts`:

```ts
import type { SQL } from 'drizzle-orm'

import { userCanSeeCustomer } from '@/shared/dal/server/customers/visibility'
import { customers } from '@/shared/db/schema'

/**
 * Canonical agent-visibility predicate for the customers entity.
 * Wraps `userCanSeeCustomer` into the `(userId) => SQL` shape
 * that EntityServerSpec.visibility expects.
 */
export function customerVisibility(userId: string): SQL {
  return userCanSeeCustomer(userId, customers.id)
}
```

- [ ] **Step 2: Create customerServerSpec**

Create `src/shared/entities/customers/lib/server-spec.ts`:

```ts
import type { EntityServerSpec } from '@/shared/dal/server/lib/types'

import {
  customers,
  insertCustomerSchema,
  selectCustomerSchema,
} from '@/shared/db/schema'
import { CUSTOMER } from '@/shared/entities/customers/lib/constants'
import { customerVisibility } from '@/shared/entities/customers/lib/visibility'

const updateCustomerSchema = insertCustomerSchema.partial()

export const customerSchemas = {
  insert: insertCustomerSchema,
  update: updateCustomerSchema,
}

export const customerServerSpec = {
  entityName: CUSTOMER,
  caslSubject: CUSTOMER,
  visibility: customerVisibility,
  table: customers,
  schemas: {
    insert: insertCustomerSchema,
    update: updateCustomerSchema,
    select: selectCustomerSchema,
  },
} satisfies EntityServerSpec<typeof customers>
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc --noEmit 2>&1 | head -20`
Expected: No errors related to customer spec files.

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/customers/lib/visibility.ts src/shared/entities/customers/lib/server-spec.ts
git commit -m "refactor(customers): add customerServerSpec + visibility for entity server system"
```

---

## Task 2: Add `getBySigningRequestId` Query

**Files:**
- Modify: `src/shared/entities/proposals/dal/server/queries.ts`

- [ ] **Step 1: Add the query function**

Add to the end of `src/shared/entities/proposals/dal/server/queries.ts` (before the closing of the file), after the `getProposalViews` function:

```ts
// ── getBySigningRequestId ──────────────────────────────────────────────
//
// Lookup a proposal by its Zoho Sign signing request ID (non-PK field).
// Used by contract.service.applyContractEvent to find the proposal
// associated with a webhook event, then update it via generic CRUD.
// Returns plain row — no joins needed for contract event processing.

export async function getBySigningRequestId(
  ctx: ScopedContext,
  input: { signingRequestId: string },
): Promise<DalReturn<Row<typeof proposals> | undefined>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select()
      .from(proposals)
      .where(and(
        eq(proposals.signingRequestId, input.signingRequestId),
        ctx.scope ?? undefined,
      ))
      .limit(1)
    return row
  })
}
```

This requires adding `Row` to the existing type imports. Update the import block at the top of the file:

```ts
// ADD to existing imports:
import type { Row } from '@/shared/db/types'
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc --noEmit 2>&1 | head -20`
Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/proposals/dal/server/queries.ts
git commit -m "refactor(proposals): add getBySigningRequestId query for contract event processing"
```

---

## Task 3: Migrate `pdf.service.ts`

**Files:**
- Modify: `src/shared/services/pdf.service.ts`

- [ ] **Step 1: Replace old DAL import with new DAL**

Replace the entire file content of `src/shared/services/pdf.service.ts`:

```ts
import type { Buffer } from 'node:buffer'

import type { ScopedContext } from '@/shared/dal/server/lib/types'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { getFullView } from '@/shared/entities/proposals/dal/server/queries'

import { renderPdf } from './pdf/render-pdf'
import { buildSowDocDefinition } from './pdf/sow-doc-definition'

/** Proposal PDFs, finance forms, printable documents */
function createPDFService() {
  return {
    generateProposalPdf: async (_ctx: ScopedContext, _params: { proposalId: string }): Promise<Buffer> => {
      throw new Error('pdfService.generateProposalPdf not implemented')
    },

    generateFinanceForm: async (_ctx: ScopedContext, _params: { proposalId: string }): Promise<Buffer> => {
      throw new Error('pdfService.generateFinanceForm not implemented')
    },

    /**
     * Generates a SOW-focused PDF for attachment to the Zoho Sign envelope
     * on the long-SOW path. Excludes branding/pricing/customer block (those
     * live on the main contract template pages).
     */
    generateSowPdf: async (ctx: ScopedContext, { proposalId }: { proposalId: string }): Promise<Buffer> => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`pdfService.generateSowPdf: proposal ${proposalId} not found`)
      }
      const docDef = buildSowDocDefinition(proposal)
      return renderPdf(docDef)
    },
  }
}

export type PDFService = ReturnType<typeof createPDFService>
export const pdfService = createPDFService()
```

- [ ] **Step 2: Verify — expect type errors**

Run: `pnpm tsc --noEmit 2>&1 | head -30`
Expected: Type errors in `contract.service.ts` because `pdfService.generateSowPdf` now requires `ctx` as first argument. These will be fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/pdf.service.ts
git commit -m "refactor(pdf-service): add ScopedContext param, replace old DAL with getFullView"
```

---

## Task 4: Migrate `contract.service.ts`

**Files:**
- Modify: `src/shared/services/contract.service.ts`

This is the largest task. The changes are mechanical: replace every `getProposal()` with `getFullView(ctx, ...)`, replace every `updateProposal(ownerKey, id, data)` with `handlers.update(ctx, { id, data })`, and add `applyContractEvent` as a new method.

- [ ] **Step 1: Replace imports**

In `src/shared/services/contract.service.ts`, replace the import block. Remove:

```ts
import { getProposal, updateProposal } from '@/shared/dal/server/proposals/api'
```

Add these imports (merge with existing import groups following the project's perfectionist/sort-imports rule):

```ts
import type { ContractEvent } from '@/shared/constants/enums'
import type { ScopedContext } from '@/shared/dal/server/lib/types'
import type { InsertProposalSchema } from '@/shared/db/schema/proposals'

import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { getBySigningRequestId, getFullView } from '@/shared/entities/proposals/dal/server/queries'
import { contractEventColumn, contractEventIdempotencyPolicy, shouldAutoApproveOnContractEvent } from '@/shared/entities/proposals/lib/contract-events'
import { proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'
```

- [ ] **Step 2: Initialize handlers inside the factory**

At the top of `createContractService()`, before the `getAuthHeader` function, add:

```ts
const handlers = createCrudDal(proposalServerSpec)
```

- [ ] **Step 3: Migrate `createDraft` internal function**

Replace the `createDraft` function signature and body. Change from:

```ts
async function createDraft(proposalId: string, ownerKey: string | null) {
    const proposal = await getProposal(proposalId)
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`)
    }
```

To:

```ts
async function createDraft(ctx: ScopedContext, proposalId: string) {
    const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`)
    }
```

In the same function, replace the registry-path update call. Change:

```ts
await updateProposal(ownerKey, proposalId, { signingRequestId: requestId })
```

To:

```ts
dalVerifySuccess(await handlers.update(ctx, { id: proposalId, data: { signingRequestId: requestId } }))
```

Replace the pdfService call. Change:

```ts
const pdfBuffer = await pdfService.generateSowPdf({ proposalId })
```

To:

```ts
const pdfBuffer = await pdfService.generateSowPdf(ctx, { proposalId })
```

Replace the legacy-path update call (near end of function). Change:

```ts
await updateProposal(ownerKey, proposalId, { signingRequestId: requestId })
```

To:

```ts
dalVerifySuccess(await handlers.update(ctx, { id: proposalId, data: { signingRequestId: requestId } }))
```

- [ ] **Step 4: Migrate `createSigningRequest`**

Change from:

```ts
createSigningRequest: async (proposalId: string, ownerKey: string | null) => {
      const proposal = await getProposal(proposalId)
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      // If a signing request already exists, return it
      if (proposal.signingRequestId) {
        return { requestId: proposal.signingRequestId }
      }

      return createDraft(proposalId, ownerKey)
    },
```

To:

```ts
createSigningRequest: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      if (proposal.signingRequestId) {
        return { requestId: proposal.signingRequestId }
      }

      return createDraft(ctx, proposalId)
    },
```

- [ ] **Step 5: Migrate `sendSigningRequest`**

Change from:

```ts
sendSigningRequest: async (proposalId: string, ownerKey: string | null) => {
      const proposal = await getProposal(proposalId)
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      let requestId = proposal.signingRequestId

      // Create draft if one doesn't exist yet
      if (!requestId) {
        const result = await createDraft(proposalId, ownerKey)
        requestId = result.requestId
      }

      // Submit the draft for signing
      const submitRes = await jsonRequest(`/requests/${requestId}/submit`, { method: 'POST' })
      if (!submitRes.ok) {
        const errorText = await submitRes.text()
        throw new Error(`Zoho Sign submit failed: ${errorText}`)
      }

      await updateProposal(ownerKey, proposalId, {
        signingRequestId: requestId,
        contractSentAt: new Date().toISOString(),
      })

      return { requestId }
    },
```

To:

```ts
sendSigningRequest: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      let requestId = proposal.signingRequestId

      if (!requestId) {
        const result = await createDraft(ctx, proposalId)
        requestId = result.requestId
      }

      const submitRes = await jsonRequest(`/requests/${requestId}/submit`, { method: 'POST' })
      if (!submitRes.ok) {
        const errorText = await submitRes.text()
        throw new Error(`Zoho Sign submit failed: ${errorText}`)
      }

      dalVerifySuccess(await handlers.update(ctx, {
        id: proposalId,
        data: {
          signingRequestId: requestId,
          contractSentAt: new Date().toISOString(),
        },
      }))

      return { requestId }
    },
```

- [ ] **Step 6: Migrate `recallSigningRequest`**

Change from:

```ts
recallSigningRequest: async (proposalId: string, ownerKey: string | null) => {
      const proposal = await getProposal(proposalId)
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      if (!proposal.signingRequestId) {
        throw new Error(`Proposal ${proposalId} has no signing request to recall`)
      }

      const res = await jsonRequest(`/requests/${proposal.signingRequestId}/recall`, { method: 'POST' })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Zoho Sign recall failed: ${errorText}`)
      }

      await updateProposal(ownerKey, proposalId, {
        signingRequestId: null,
        contractSentAt: null,
      })

      return { recalled: true }
    },
```

To:

```ts
recallSigningRequest: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      if (!proposal.signingRequestId) {
        throw new Error(`Proposal ${proposalId} has no signing request to recall`)
      }

      const res = await jsonRequest(`/requests/${proposal.signingRequestId}/recall`, { method: 'POST' })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Zoho Sign recall failed: ${errorText}`)
      }

      dalVerifySuccess(await handlers.update(ctx, {
        id: proposalId,
        data: { signingRequestId: null, contractSentAt: null },
      }))

      return { recalled: true }
    },
```

- [ ] **Step 7: Migrate `resendSigningRequest`**

Change from:

```ts
resendSigningRequest: async (proposalId: string, ownerKey: string | null) => {
      const proposal = await getProposal(proposalId)
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      // Recall existing request if present
      if (proposal.signingRequestId) {
        await jsonRequest(`/requests/${proposal.signingRequestId}/recall`, { method: 'POST' })
          .catch(() => {}) // Ignore recall errors (may already be completed/recalled)
      }

      // Clear old reference
      await updateProposal(ownerKey, proposalId, {
        signingRequestId: null,
        contractSentAt: null,
      })

      // Create fresh draft with current proposal data
      const { requestId } = await createDraft(proposalId, ownerKey)

      // Submit for signing
      const submitRes = await jsonRequest(`/requests/${requestId}/submit`, { method: 'POST' })
      if (!submitRes.ok) {
        const errorText = await submitRes.text()
        throw new Error(`Zoho Sign submit failed: ${errorText}`)
      }

      await updateProposal(ownerKey, proposalId, {
        signingRequestId: requestId,
        contractSentAt: new Date().toISOString(),
      })

      return { requestId }
    },
```

To:

```ts
resendSigningRequest: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      if (proposal.signingRequestId) {
        await jsonRequest(`/requests/${proposal.signingRequestId}/recall`, { method: 'POST' })
          .catch(() => {})
      }

      dalVerifySuccess(await handlers.update(ctx, {
        id: proposalId,
        data: { signingRequestId: null, contractSentAt: null },
      }))

      const { requestId } = await createDraft(ctx, proposalId)

      const submitRes = await jsonRequest(`/requests/${requestId}/submit`, { method: 'POST' })
      if (!submitRes.ok) {
        const errorText = await submitRes.text()
        throw new Error(`Zoho Sign submit failed: ${errorText}`)
      }

      dalVerifySuccess(await handlers.update(ctx, {
        id: proposalId,
        data: {
          signingRequestId: requestId,
          contractSentAt: new Date().toISOString(),
        },
      }))

      return { requestId }
    },
```

- [ ] **Step 8: Migrate `ensureDraftSynced`**

Change from:

```ts
ensureDraftSynced: async (proposalId: string, ownerKey: string | null) => {
      const proposal = await getProposal(proposalId)
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      // No existing request — just create
      if (!proposal.signingRequestId) {
        return createDraft(proposalId, ownerKey)
      }

      // Delete old request (works for drafts and in-progress), ignore errors
      await deleteRequest(proposal.signingRequestId).catch(() => {})

      // Clear stale reference
      await updateProposal(ownerKey, proposalId, {
        signingRequestId: null,
        contractSentAt: null,
      })

      // Create fresh draft with current proposal data
      return createDraft(proposalId, ownerKey)
    },
```

To:

```ts
ensureDraftSynced: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      if (!proposal.signingRequestId) {
        return createDraft(ctx, proposalId)
      }

      await deleteRequest(proposal.signingRequestId).catch(() => {})

      dalVerifySuccess(await handlers.update(ctx, {
        id: proposalId,
        data: { signingRequestId: null, contractSentAt: null },
      }))

      return createDraft(ctx, proposalId)
    },
```

- [ ] **Step 9: Add `applyContractEvent` method**

Add this as the last method in the returned object (before the closing `}`), after `getSigningStatus`:

```ts
/**
 * Applies a contract-signing event (from Zoho webhook) to the matching
 * proposal. Handles event→column mapping, idempotency, and auto-approve.
 * Returns the updated proposal, or undefined when no-op (no match or
 * idempotency skip).
 */
applyContractEvent: async (ctx: ScopedContext, input: {
  signingRequestId: string
  event: ContractEvent
  performedAt: string
}) => {
  const { signingRequestId, event, performedAt } = input

  // 1. Find proposal by signingRequestId
  const proposal = dalVerifySuccess(await getBySigningRequestId(ctx, { signingRequestId }))
  if (!proposal) return undefined

  // 2. Idempotency check
  const column = contractEventColumn[event]
  const policy = contractEventIdempotencyPolicy[event]
  const existingValue = proposal[column as keyof typeof proposal] as string | null
  if (policy === 'write-once' && existingValue !== null) return undefined
  if (policy === 'earliest-wins' && existingValue !== null && existingValue <= performedAt) return undefined

  // 3. Build update payload
  const setFields: Partial<InsertProposalSchema> = { [column]: performedAt }
  if (shouldAutoApproveOnContractEvent(event)) {
    setFields.status = 'approved'
    if (!proposal.approvedAt) {
      setFields.approvedAt = performedAt
    }
  }

  // 4. Update via generic CRUD
  return dalVerifySuccess(await handlers.update(ctx, { id: proposal.id, data: setFields }))
},
```

- [ ] **Step 10: Update the `ContractService` type export**

The `ContractService` type is derived from the factory return: `export type ContractService = ReturnType<typeof createContractService>`. This auto-updates — no change needed. Just verify it still works.

- [ ] **Step 11: Verify — expect type errors in router**

Run: `pnpm tsc --noEmit 2>&1 | head -40`
Expected: Type errors in `contracts.router.ts` (old calling convention) and `sync-contract-draft.ts` / `sync-zoho-sign-status.ts`. These are fixed in subsequent tasks.

- [ ] **Step 12: Commit**

```bash
git add src/shared/services/contract.service.ts
git commit -m "refactor(contract-service): migrate from ownerKey to ScopedContext, absorb applyContractEvent"
```

---

## Task 5: Migrate `contracts.router.ts` + Wire in `index.ts`

**Files:**
- Modify: `src/trpc/routers/proposals.router/contracts.router.ts`
- Modify: `src/trpc/routers/proposals.router/index.ts`

- [ ] **Step 1: Rewrite contracts.router.ts as a factory**

Replace the entire file content of `src/trpc/routers/proposals.router/contracts.router.ts`:

```ts
// ─── Contracts Router (Entity Toolkit Pattern) ───────────────────────────────
// Service-layer sub-router for proposal contract lifecycle: Zoho Sign
// draft creation, submission, recall, resend, envelope configuration.
// Receives the entity toolkit from the parent entity router factory.

import type { EntityToolkit } from '@/trpc/lib/create-entity-router'

import { TRPCError } from '@trpc/server'
import z from 'zod'

import { envelopeDocumentIds } from '@/shared/constants/enums'
import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/lib/types'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { getFullView } from '@/shared/entities/proposals/dal/server/queries'
import { proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'
import { contractService } from '@/shared/services/contract.service'
import { EnvelopeSelectionError, evaluateDocuments, validateEnvelopeSelection } from '@/shared/services/zoho-sign/documents/evaluate'
import { buildProposalContext } from '@/shared/services/zoho-sign/documents/proposal-context'
import { ENVELOPE_DOCUMENTS } from '@/shared/services/zoho-sign/documents/registry'

import { createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'

export function createContractsRouter(entity: EntityToolkit<typeof proposalServerSpec.table>) {
  const proposalHandlers = createCrudDal(proposalServerSpec)
  const customerHandlers = createCrudDal(customerServerSpec)

  return createTRPCRouter({
    getContractStatus: entity.shareableProcedure
      .input(z.object({ id: z.string().uuid(), token: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        const proposal = dalToTrpc(await getFullView(ctx, input))
        if (!proposal) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
        }

        if (!proposal.signingRequestId) {
          return null
        }

        const stamps = {
          contractSentAt: proposal.contractSentAt,
          contractViewedAt: proposal.contractViewedAt,
          contractSignedAt: proposal.contractSignedAt,
          contractDeclinedAt: proposal.contractDeclinedAt,
        }

        if (proposal.contractSignedAt) {
          return { requestId: proposal.signingRequestId, requestStatus: 'completed' as const, signerStatuses: [], ...stamps }
        }
        if (proposal.contractDeclinedAt) {
          return { requestId: proposal.signingRequestId, requestStatus: 'declined' as const, signerStatuses: [], ...stamps }
        }

        try {
          const status = await contractService.getSigningStatus(proposal.signingRequestId)
          return { ...status, ...stamps }
        }
        catch {
          return null
        }
      }),

    createContractDraft: entity.authedProcedure
      .input(z.object({ proposalId: z.string() }))
      .mutation(({ ctx, input }) =>
        contractService.createSigningRequest(ctx, input.proposalId)),

    submitContract: entity.authedProcedure
      .input(z.object({ proposalId: z.string() }))
      .mutation(({ ctx, input }) =>
        contractService.sendSigningRequest(ctx, input.proposalId)),

    sendContractForSigning: entity.shareableProcedure
      .input(z.object({ id: z.string().uuid(), token: z.string() }))
      .mutation(({ ctx, input }) =>
        contractService.sendSigningRequest(ctx, input.id)),

    recallContract: entity.authedProcedure
      .input(z.object({ proposalId: z.string() }))
      .mutation(({ ctx, input }) =>
        contractService.recallSigningRequest(ctx, input.proposalId)),

    resendContract: entity.authedProcedure
      .input(z.object({ proposalId: z.string() }))
      .mutation(({ ctx, input }) =>
        contractService.resendSigningRequest(ctx, input.proposalId)),

    evaluateEnvelopeDocs: entity.authedProcedure
      .input(z.object({
        proposalId: z.string(),
        ageOverride: z.number().int().min(18).max(120).optional(),
      }))
      .query(async ({ ctx, input }) => {
        const proposal = dalToTrpc(await getFullView(ctx, { id: input.proposalId }))
        if (!proposal) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
        }

        const evalCtx = buildProposalContext(proposal, { ageOverride: input.ageOverride })
        const { required, optional } = evaluateDocuments(evalCtx)
        const requiredSet = new Set(required)
        const optionalSet = new Set(optional)
        const docs = ENVELOPE_DOCUMENTS
          .filter(d => requiredSet.has(d.id) || optionalSet.has(d.id))
          .map(d => ({
            id: d.id,
            label: d.label,
            status: requiredSet.has(d.id) ? ('required' as const) : ('optional' as const),
          }))

        return {
          kind: evalCtx.kind,
          isSenior: evalCtx.isSenior,
          isLongSow: evalCtx.isLongSow,
          docs,
        }
      }),

    configureDraftEnvelope: entity.authedProcedure
      .input(z.object({
        proposalId: z.string(),
        age: z.number().int().min(18).max(120),
        envelopeDocumentIds: z.array(z.enum(envelopeDocumentIds)),
      }))
      .mutation(async ({ ctx, input }) => {
        const proposal = dalToTrpc(await getFullView(ctx, { id: input.proposalId }))
        if (!proposal) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
        }
        if (!proposal.customer) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No customer linked to this proposal' })
        }

        const evalCtx = buildProposalContext(proposal, { ageOverride: input.age })
        try {
          validateEnvelopeSelection(evalCtx, input.envelopeDocumentIds)
        }
        catch (err) {
          if (err instanceof EnvelopeSelectionError) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: err.message })
          }
          throw err
        }

        const customerId = proposal.customer.id

        // Cross-entity: customer profile age update (SYSTEM_CONTEXT — auth checked by authedProcedure)
        const existing = dalToTrpc(await customerHandlers.getById(SYSTEM_CONTEXT, { id: customerId }))
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
        }
        const updatedProfile = { ...(existing as Record<string, unknown>).customerProfileJSON as Record<string, unknown>, age: input.age }
        dalToTrpc(await customerHandlers.update(SYSTEM_CONTEXT, {
          id: customerId,
          data: { customerProfileJSON: updatedProfile } as Record<string, unknown>,
        }))

        // Same-entity: proposal formMeta update
        const updatedFormMeta = {
          ...proposal.formMetaJSON,
          envelopeDocumentIds: input.envelopeDocumentIds,
        }
        dalToTrpc(await proposalHandlers.update(ctx, {
          id: input.proposalId,
          data: { formMetaJSON: updatedFormMeta },
        }))

        return { success: true, age: input.age, envelopeDocumentIds: input.envelopeDocumentIds }
      }),

    submitCustomerAge: entity.shareableProcedure
      .input(z.object({
        id: z.string().uuid(),
        token: z.string().optional(),
        age: z.number().int().min(18).max(120),
      }))
      .mutation(async ({ ctx, input }) => {
        const proposal = dalToTrpc(await getFullView(ctx, { id: input.id }))
        if (!proposal) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
        }
        if (!proposal.customer) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No customer linked to this proposal' })
        }

        // Cross-entity: customer profile age update (SYSTEM_CONTEXT — auth checked by shareableProcedure)
        const existing = dalToTrpc(await customerHandlers.getById(SYSTEM_CONTEXT, { id: proposal.customer.id }))
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
        }
        const updatedProfile = { ...(existing as Record<string, unknown>).customerProfileJSON as Record<string, unknown>, age: input.age }
        dalToTrpc(await customerHandlers.update(SYSTEM_CONTEXT, {
          id: proposal.customer.id,
          data: { customerProfileJSON: updatedProfile } as Record<string, unknown>,
        }))

        return { success: true, age: input.age }
      }),
  })
}
```

- [ ] **Step 2: Update proposals.router/index.ts**

In `src/trpc/routers/proposals.router/index.ts`, change the import:

```ts
// BEFORE:
import { contractsRouter } from './contracts.router'

// AFTER:
import { createContractsRouter } from './contracts.router'
```

And change the mount point:

```ts
// BEFORE:
    contracts: contractsRouter,

// AFTER:
    contracts: createContractsRouter(entity),
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc --noEmit 2>&1 | head -40`
Expected: Errors only in `sync-zoho-sign-status.ts` and `sync-contract-draft.ts` (fixed in next tasks). The router and service should type-check clean.

Note: If there are type errors with the customer CRUD handlers due to generic typing (e.g., `customerProfileJSON` not on the generic `Row<typeof customers>` type), you may need to cast the `existing` result. The generic CRUD returns `Row<typeof customers>` which should include all columns. Check the actual error and adjust the cast minimally.

- [ ] **Step 4: Commit**

```bash
git add src/trpc/routers/proposals.router/contracts.router.ts src/trpc/routers/proposals.router/index.ts
git commit -m "refactor(contracts-router): convert to entity toolkit factory, replace direct db with DAL"
```

---

## Task 6: Migrate `sync-zoho-sign-status.ts`

**Files:**
- Modify: `src/shared/services/upstash/jobs/sync-zoho-sign-status.ts`

- [ ] **Step 1: Replace old DAL with service call**

Replace the entire file content:

```ts
import { SYSTEM_CONTEXT } from '@/shared/dal/server/lib/types'
import { mapZohoOperationToContractEvent, shouldNotifyOnContractEvent } from '@/shared/entities/proposals/lib/contract-events'
import { contractService } from '@/shared/services/contract.service'
import { notificationService } from '@/shared/services/notification.service'
import { createJob } from '../lib/create-job'

interface SyncZohoSignStatusPayload {
  signingRequestId: string
  /** Raw operation_type from Zoho — may not match our known enum values. */
  operationType: string
  performedAt: string
}

/**
 * Persists a single Zoho Sign event onto the matching proposal.
 * Lookup is by `signingRequestId`. Business logic (idempotency,
 * auto-approve) lives in contractService.applyContractEvent.
 */
export const syncZohoSignStatusJob = createJob<SyncZohoSignStatusPayload>(
  'sync-zoho-sign-status',
  async ({ signingRequestId, operationType, performedAt }) => {
    const event = mapZohoOperationToContractEvent(operationType)
    if (!event) {
      return
    }

    const updated = await contractService.applyContractEvent(SYSTEM_CONTEXT, { signingRequestId, event, performedAt })
    if (!updated) {
      return
    }

    if (shouldNotifyOnContractEvent(event)) {
      await notificationService.notifyContractStatusChange({
        event,
        proposalOwnerId: updated.ownerId,
        proposalId: updated.id,
        occurredAt: performedAt,
      })
    }
  },
)
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc --noEmit 2>&1 | head -20`
Expected: Errors only in `sync-contract-draft.ts` (fixed next).

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/upstash/jobs/sync-zoho-sign-status.ts
git commit -m "refactor(sync-zoho-sign-status): call contractService.applyContractEvent with SYSTEM_CONTEXT"
```

---

## Task 7: Migrate `sync-contract-draft.ts` + Delivery Router Cleanup

**Files:**
- Modify: `src/shared/services/upstash/jobs/sync-contract-draft.ts`
- Modify: `src/trpc/routers/proposals.router/delivery.router.ts`

- [ ] **Step 1: Update sync-contract-draft.ts**

Replace the entire file content:

```ts
import { SYSTEM_CONTEXT } from '@/shared/dal/server/lib/types'
import { contractService } from '@/shared/services/contract.service'

import { createJob } from '../lib/create-job'

interface SyncContractDraftPayload {
  proposalId: string
}

export const syncContractDraftJob = createJob<SyncContractDraftPayload>(
  'sync-contract-draft',
  async ({ proposalId }) => {
    await contractService.ensureDraftSynced(SYSTEM_CONTEXT, proposalId)
  },
)
```

- [ ] **Step 2: Update delivery.router.ts — remove ownerKey from dispatch**

In `src/trpc/routers/proposals.router/delivery.router.ts`, find the `sendProposalEmail` mutation. Remove the `ownerKey` logic and simplify the dispatch call.

Replace:

```ts
        // 4. Dispatch async contract draft sync job
        // @migration(contract-service)
        // ownerKey is passed for the un-migrated contract.service. Once
        // contract.service migrates to DAL + SYSTEM_CONTEXT pattern, remove
        // ownerKey from the job payload entirely.
        const isOmni = ctx.ability.can('manage', 'all')
        const ownerKey = isOmni ? null : ctx.session.user.id
        await syncContractDraftJob.dispatch({ proposalId: input.proposalId, ownerKey })
```

With:

```ts
        // 4. Dispatch async contract draft sync job
        await syncContractDraftJob.dispatch({ proposalId: input.proposalId })
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc --noEmit 2>&1 | head -20`
Expected: Errors only in `summary/route.ts` (fixed next).

- [ ] **Step 4: Commit**

```bash
git add src/shared/services/upstash/jobs/sync-contract-draft.ts src/trpc/routers/proposals.router/delivery.router.ts
git commit -m "refactor(sync-contract-draft): drop ownerKey, use SYSTEM_CONTEXT in job"
```

---

## Task 8: Migrate `summary/route.ts`

**Files:**
- Modify: `src/app/api/proposals/[proposalId]/summary/route.ts`

- [ ] **Step 1: Replace old DAL import with new DAL + SYSTEM_CONTEXT**

In `src/app/api/proposals/[proposalId]/summary/route.ts`, replace:

```ts
import { getProposal } from '@/shared/dal/server/proposals/api'
```

With:

```ts
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/lib/types'
import { getFullView } from '@/shared/entities/proposals/dal/server/queries'
```

Then replace:

```ts
  const proposal = await getProposal(proposalId)

  if (!proposal) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  if (proposal.token !== token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
```

With:

```ts
  // TODO: Rebuild as procedure → QStash job → ai.service → DAL update (see spec)
  const result = await getFullView(SYSTEM_CONTEXT, { id: proposalId })
  if (!result.success) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  const proposal = result.data

  if (!proposal) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  if (proposal.token !== token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc --noEmit 2>&1 | head -20`
Expected: No errors referencing old DAL.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/proposals/[proposalId]/summary/route.ts"
git commit -m "refactor(summary-route): replace old DAL with getFullView + SYSTEM_CONTEXT"
```

---

## Task 9: Delete Old DAL + Final Verification

**Files:**
- Delete: `src/shared/dal/server/proposals/api.ts`

- [ ] **Step 1: Verify zero remaining imports**

Run: `grep -r "from '@/shared/dal/server/proposals/api'" src/ --include="*.ts" --include="*.tsx"`
Expected: No output (zero matches).

- [ ] **Step 2: Delete the file**

```bash
rm src/shared/dal/server/proposals/api.ts
```

- [ ] **Step 3: Run full typecheck**

Run: `pnpm tsc --noEmit`
Expected: Clean — zero errors.

- [ ] **Step 4: Run lint**

Run: `pnpm lint`
Expected: Clean. If import sorting issues arise, fix them.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(proposals): delete deprecated shared/dal/server/proposals/api.ts — all consumers migrated"
```

- [ ] **Step 6: Self-review diff**

Run: `git diff main --stat` to see the full change footprint, then `git diff main` to review. Check for:
- No stray `import { getProposal }` or `import { updateProposal }` references
- No stray `ownerKey` references in service/router code
- No direct `db` imports in routers
- All new files follow existing patterns

---

## Implementation Notes

**Type casting in cross-entity handlers:** The generic `createCrudDal(customerServerSpec)` returns `CrudHandlers<typeof customers>`. The `getById` result is `Row<typeof customers>`, which includes `customerProfileJSON` as its Drizzle-inferred type. You may need to cast to access JSONB fields — keep casts minimal and document them inline.

**Import ordering:** The project uses `perfectionist/sort-imports`. External imports come first (alphabetical), then internal `@/` imports (alphabetical). Named imports within a single `import` must be alphabetical.

**No barrel files:** Don't create `index.ts` in the new customer files. Direct imports only.

**If `pnpm tsc` reveals unexpected errors:** The most likely source is type narrowing around `DalReturn`. `dalToTrpc()` unwraps for tRPC callers, `dalVerifySuccess()` unwraps for service callers. If a value is `DalReturn<T | undefined>`, the unwrapped value is `T | undefined` — you still need a null check.
