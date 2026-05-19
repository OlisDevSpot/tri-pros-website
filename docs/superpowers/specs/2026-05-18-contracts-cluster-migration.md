# Contracts Cluster Migration — Design Spec

> Migrate the 5 remaining consumers of `shared/dal/server/proposals/api.ts` to the three-layer convention (tRPC → Service → DAL), then delete the old file.

## Context

Phase 1b migrated the proposals CRUD + business queries to the entity server system. The **contracts cluster** — 5 files that orchestrate Zoho Sign e-signatures — still imports the deprecated old DAL. This spec covers migrating all 5, establishing the `contract.service.ts` as a properly conventional service, and creating minimal customer entity DAL ahead of the full customer migration.

### Three-Layer Convention (non-negotiable)

| Layer | Role | Imports `db`? | Receives |
|-------|------|:---:|----------|
| **tRPC** | Client boundary — auth + thin body | No | `ScopedContext` (resolved by middleware) |
| **Service** | Business logic orchestration | No | `ScopedContext` (forwarded from caller) |
| **DAL** | Only layer touching DB — self-defending | **Yes** | `ScopedContext` (applies `ctx.scope`) |

**Two pathways into the system:**
1. **User via tRPC** — middleware resolves `{ session, ability, scope }` from HTTP request
2. **Server-initiated** (jobs/webhooks/RSC) — caller uses `SYSTEM_CONTEXT` (full access) or `buildUserContext()` (scoped)

Services don't resolve scope. They receive context and forward it to DAL calls. When a service needs privileged cross-entity access, it uses `SYSTEM_CONTEXT`.

## Files In Scope

| # | File | Current problem | Migration target |
|---|------|----------------|------------------|
| 1 | `contracts.router.ts` | Standalone procedures (no entity toolkit), direct `db` imports, manual CASL | `createContractsRouter(entity)` factory using entity toolkit |
| 2 | `contract.service.ts` | Takes `ownerKey: string \| null`, calls old `getProposal`/`updateProposal` | Takes `ctx: ScopedContext`, calls new DAL (`getFullView` + `handlers.update`) |
| 3 | `pdf.service.ts` | Calls old `getProposal` | Takes `ctx: ScopedContext`, calls `getFullView` |
| 4 | `summary/route.ts` | Broken API route, calls old `getProposal` | **Out of scope** — future issue (button → procedure → QStash → ai.service → DAL update) |
| 5 | `sync-zoho-sign-status.ts` | Calls old `applyContractEvent` directly | Calls `contractService.applyContractEvent(SYSTEM_CONTEXT, ...)` |
| 6 | `sync-contract-draft.ts` | Passes `ownerKey` to `contractService.ensureDraftSynced` | Passes `SYSTEM_CONTEXT` instead — job is server-initiated, privileged |

## Files Created

| File | Purpose |
|------|---------|
| `entities/customers/lib/server-spec.ts` | Customer `EntityServerSpec` — needed for `createCrudDal(customerServerSpec)` |
| `entities/customers/lib/visibility.ts` | `customerVisibility(userId)` wrapping existing `userCanSeeCustomer` |

## Files Deleted

| File | Reason |
|------|--------|
| `shared/dal/server/proposals/api.ts` | All consumers migrated — zero imports remaining |

---

## Design Details

### 1. `contract.service.ts` — signature migration

Every method changes from `(proposalId, ownerKey)` to `(ctx: ScopedContext, proposalId)`.

**Before:**
```ts
createSigningRequest: async (proposalId: string, ownerKey: string | null) => {
  const proposal = await getProposal(proposalId)
  if (!proposal) throw new Error(...)
  if (proposal.signingRequestId) return { requestId: proposal.signingRequestId }
  return createDraft(proposalId, ownerKey)
}
```

**After:**
```ts
createSigningRequest: async (ctx: ScopedContext, proposalId: string) => {
  const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
  if (proposal.signingRequestId) return { requestId: proposal.signingRequestId }
  return createDraft(ctx, proposalId)
}
```

The service threads `ctx` through. `dalVerifySuccess` unwraps `DalReturn` or throws (service-level error handling — not `dalToTrpc` which is tRPC-only).

**Methods that change signature (6):**
- `createSigningRequest(ctx, proposalId)`
- `sendSigningRequest(ctx, proposalId)`
- `recallSigningRequest(ctx, proposalId)`
- `resendSigningRequest(ctx, proposalId)`
- `ensureDraftSynced(ctx, proposalId)`
- `applyContractEvent(ctx, input)` — **new method**, absorbs business logic from old DAL

**Method that stays unchanged (1):**
- `getSigningStatus(requestId)` — pure Zoho API call, no DB access, no ctx needed

### 2. `applyContractEvent` — moves from old DAL to service

This function is contract lifecycle orchestration, not pure data access. It:
1. Maps event → column via `contractEventColumn[event]`
2. Determines idempotency clause via `contractEventIdempotencyPolicy[event]`
3. Decides whether to auto-approve via `shouldAutoApproveOnContractEvent(event)`
4. Calls DAL to perform the actual write

**Current location:** `shared/dal/server/proposals/api.ts` (wrong — business logic in DAL)
**New location:** `contract.service.ts` (correct — orchestration in service)

**How the write works:** The service needs to update a proposal by `signingRequestId` (non-PK lookup). This is a two-step DAL operation:

1. **Find** the proposal: new query `getBySigningRequestId(ctx, { signingRequestId })` in `entities/proposals/dal/server/queries.ts`. This is a legitimate new function — lookup by non-PK field is not expressible via generic CRUD.

2. **Update** the proposal: `createCrudDal(proposalServerSpec).update(ctx, { id: proposal.id, data: setFields })`. Standard CRUD — no ad-hoc function needed.

The service method:
```ts
applyContractEvent: async (ctx: ScopedContext, input: ApplyContractEventInput) => {
  const { signingRequestId, event, performedAt } = input

  // 1. Find proposal by signingRequestId
  const proposal = dalVerifySuccess(await getBySigningRequestId(ctx, { signingRequestId }))
  if (!proposal) return undefined  // No matching proposal — no-op

  // 2. Idempotency check (business logic)
  const column = contractEventColumn[event]
  const policy = contractEventIdempotencyPolicy[event]
  const existingValue = proposal[column as keyof typeof proposal] as string | null
  if (policy === 'write-once' && existingValue !== null) return undefined
  if (policy === 'earliest-wins' && existingValue !== null && existingValue <= performedAt) return undefined

  // 3. Build write shape
  const setFields: Partial<InsertProposalSchema> = { [column]: performedAt }
  if (shouldAutoApproveOnContractEvent(event)) {
    setFields.status = 'approved'
    if (!proposal.approvedAt) setFields.approvedAt = performedAt
  }

  // 4. Update via generic CRUD
  const result = await handlers.update(ctx, { id: proposal.id, data: setFields })
  return dalVerifySuccess(result)
}
```

**Note:** The idempotency check moves from a SQL WHERE clause (old DAL) to an application-level check (service). This avoids needing a custom DAL function — the service reads current state via `getBySigningRequestId`, decides whether to write, and uses generic CRUD for the write. The trade-off is a read-then-write vs. a conditional-update, but the window is harmless: if two webhooks race, the idempotency policy produces the same result regardless of which wins.

### 3. `getBySigningRequestId` — new proposal query

```ts
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

Plain row — no joins. The service only needs the proposal's current state to make idempotency decisions.

### 4. `contracts.router.ts` — entity toolkit migration

**Before:** Standalone router with `agentProcedure`/`baseProcedure`, manual CASL, direct `db` imports.

**After:** `createContractsRouter(entity: EntityToolkit)` factory — same pattern as `createDeliveryRouter`.

**Key procedure changes:**

**`createContractDraft`** (and `submitContract`, `recallContract`, `resendContract`):
```ts
// BEFORE:
createContractDraft: agentProcedure
  .input(z.object({ proposalId: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const isOmni = ctx.ability.can('manage', 'all')
    const ownerKey = isOmni ? null : ctx.session.user.id
    return contractService.createSigningRequest(input.proposalId, ownerKey)
  }),

// AFTER:
createContractDraft: entity.authedProcedure
  .input(z.object({ proposalId: z.string() }))
  .mutation(({ ctx, input }) =>
    contractService.createSigningRequest(ctx, input.proposalId)),
```

The `isOmni ? null : userId` dance is gone — `ctx` already encodes visibility via `scope`.

**`getContractStatus`:**
```ts
// AFTER — uses entity.shareableProcedure (token OR session):
getContractStatus: entity.shareableProcedure
  .input(z.object({ id: z.string().uuid(), token: z.string().optional() }))
  .query(async ({ ctx, input }) => {
    const proposal = dalToTrpc(await getFullView(ctx, input))
    if (!proposal?.signingRequestId) return null
    // ... terminal state check, then Zoho API call
  }),
```

Replaces manual `defineAbilitiesFor` + dual-gate auth with `entity.shareableProcedure` which does this automatically.

**`sendContractForSigning`:**
```ts
// AFTER — shareableProcedure handles token auth:
sendContractForSigning: entity.shareableProcedure
  .input(z.object({ id: z.string().uuid(), token: z.string() }))
  .mutation(({ ctx, input }) =>
    contractService.sendSigningRequest(ctx, input.id)),
```

**`evaluateEnvelopeDocs`:**
```ts
// AFTER — reads via getFullView with ctx:
evaluateEnvelopeDocs: entity.authedProcedure
  .input(z.object({ proposalId: z.string(), ageOverride: z.number().int().min(18).max(120).optional() }))
  .query(async ({ ctx, input }) => {
    const proposal = dalToTrpc(await getFullView(ctx, { id: input.proposalId }))
    const evalCtx = buildProposalContext(proposal, { ageOverride: input.ageOverride })
    // ... evaluation logic (stays in router — it's input validation + transformation)
  }),
```

**`configureDraftEnvelope`** (cross-entity customer write):
```ts
// AFTER — customer update via customer DAL, proposal update via generic CRUD:
configureDraftEnvelope: entity.authedProcedure
  .input(configureEnvelopeSchema)
  .mutation(async ({ ctx, input }) => {
    const proposal = dalToTrpc(await getFullView(ctx, { id: input.proposalId }))
    // ... validation ...

    // Cross-entity: customer profile update (SYSTEM_CONTEXT — auth already checked by authedProcedure)
    const existing = dalToTrpc(await customerHandlers.getById(SYSTEM_CONTEXT, { id: customerId }))
    const updatedProfile = { ...existing.customerProfileJSON, age: input.age }
    dalToTrpc(await customerHandlers.update(SYSTEM_CONTEXT, {
      id: customerId,
      data: { customerProfileJSON: updatedProfile },
    }))

    // Same-entity: proposal formMeta update (user's own ctx — scoped)
    dalToTrpc(await proposalHandlers.update(ctx, {
      id: input.proposalId,
      data: { formMetaJSON: { ...proposal.formMetaJSON, envelopeDocumentIds: input.envelopeDocumentIds } },
    }))
  }),
```

**Note on atomicity:** The old code used a `db.transaction()` for the customer+proposal writes. In the new version, these are two separate DAL calls. We lose atomicity here. This is acceptable because:
1. The customer age update is idempotent (same value replayed = same result)
2. Partial failure (customer updated, proposal not) is recoverable (retry the full operation)
3. Adding transaction support to the DAL layer is a future enhancement — not worth blocking this migration

**`submitCustomerAge`** (cross-entity customer write):
```ts
// AFTER:
submitCustomerAge: entity.shareableProcedure
  .input(z.object({ id: z.string().uuid(), token: z.string().optional(), age: z.number().int().min(18).max(120) }))
  .mutation(async ({ ctx, input }) => {
    const proposal = dalToTrpc(await getFullView(ctx, { id: input.id }))
    if (!proposal.customer) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'No customer linked' })
    }

    const existing = dalToTrpc(await customerHandlers.getById(SYSTEM_CONTEXT, { id: proposal.customer.id }))
    const updatedProfile = { ...existing.customerProfileJSON, age: input.age }
    dalToTrpc(await customerHandlers.update(SYSTEM_CONTEXT, {
      id: proposal.customer.id,
      data: { customerProfileJSON: updatedProfile },
    }))

    return { success: true, age: input.age }
  }),
```

Replaces manual `defineAbilitiesFor` dual-gate with `entity.shareableProcedure`.

### 5. `pdf.service.ts` — add ctx parameter

```ts
// BEFORE:
generateSowPdf: async ({ proposalId }: { proposalId: string }): Promise<Buffer> => {
  const proposal = await getProposal(proposalId)

// AFTER:
generateSowPdf: async (ctx: ScopedContext, { proposalId }: { proposalId: string }): Promise<Buffer> => {
  const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
```

Called from `contractService.createDraft(ctx, proposalId)` — ctx flows through: router → contractService → pdfService → DAL.

### 6. `sync-zoho-sign-status.ts` — call service instead of old DAL

```ts
// BEFORE:
const updated = await applyContractEvent({ signingRequestId, event, performedAt })

// AFTER:
const updated = await contractService.applyContractEvent(SYSTEM_CONTEXT, { signingRequestId, event, performedAt })
```

System-level context — no auth needed for webhook-triggered jobs. The service handles idempotency, the DAL handles the write.

### 7. `summary/route.ts` — out of scope

The route is currently broken. The future design is:
1. Agent clicks "Generate Summary" button in proposal edit UI
2. Button fires `proposals.business.generateSummary` tRPC mutation
3. Mutation dispatches QStash job
4. Job calls `ai.service.ts` to generate summary
5. Summary stored on proposal row via `handlers.update(SYSTEM_CONTEXT, { id, data: { summaryText } })`
6. UI renders summary from proposal data

This is a separate issue — don't let it block the contracts migration. Remove the import from old DAL, add a `// TODO: Issue #XXX — migrate to procedure → job → ai.service → DAL update` comment, and leave the route otherwise untouched.

### 8. Customer entity spec (forward-looking)

**`entities/customers/lib/server-spec.ts`:**
```ts
import { customers, insertCustomerSchema, selectCustomerSchema } from '@/shared/db/schema'
import { CUSTOMER } from '@/shared/entities/customers/lib/constants'
import { customerVisibility } from '@/shared/entities/customers/lib/visibility'

const updateCustomerSchema = insertCustomerSchema.partial()

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

**`entities/customers/lib/visibility.ts`:**
```ts
import type { SQL } from 'drizzle-orm'
import { customers } from '@/shared/db/schema'
import { userCanSeeCustomer } from '@/shared/dal/server/customers/visibility'

export function customerVisibility(userId: string): SQL {
  return userCanSeeCustomer(userId, customers.id)
}
```

Wraps the existing `userCanSeeCustomer` into the `(userId) => SQL` shape that `EntityServerSpec.visibility` expects. The existing function takes a column reference because it was designed for composable WHERE clauses — the wrapper pins it to `customers.id` for standalone use.

### 9. `ProposalWithCustomer` type migration

The old DAL exports `ProposalWithCustomer` — 4 files import it as a type:
- `services/pdf/sow-doc-definition.ts`
- `services/zoho-sign/documents/proposal-context.ts`
- `services/zoho-sign/documents/types.ts`
- `services/zoho-sign/lib/build-signing-request.ts`

The new `ProposalWithCustomer` is already exported from `entities/proposals/dal/server/queries.ts`. All 4 type imports switch to the new source. The shapes are identical (the new type was derived from the old).

---

## Migration Order

Dependency-driven — each step unlocks the next:

1. **Customer entity spec + visibility** — creates `customerServerSpec` so `createCrudDal(customerServerSpec)` works
2. **`getBySigningRequestId`** — new proposal query needed by the migrated service
3. **`pdf.service.ts`** — add `ctx` param (small, no dependents beyond contract service)
4. **`contract.service.ts`** — migrate all methods from `ownerKey` to `ctx`, absorb `applyContractEvent`
5. **`contracts.router.ts`** — convert to `createContractsRouter(entity)` factory
6. **`sync-zoho-sign-status.ts`** — switch to `contractService.applyContractEvent(SYSTEM_CONTEXT, ...)`
7. **`sync-contract-draft.ts`** — switch payload from `ownerKey` to `SYSTEM_CONTEXT`, update `delivery.router.ts` dispatch call to drop `ownerKey` from payload
8. **`ProposalWithCustomer` type imports** — switch 4 files to new source
9. **`summary/route.ts`** — remove old DAL import, add TODO comment
10. **Delete `shared/dal/server/proposals/api.ts`** — verify zero imports, delete
11. **Verify** — `pnpm tsc` + `pnpm lint` clean, app loads, proposal/contract flows work

## Out of Scope

- Full customer entity migration (Phase 2)
- JSONB merge implementation (declared on spec, deferred)
- `summary/route.ts` rebuild (separate issue)
- Transaction support in DAL layer
- `delivery.router.ts` removal of `@migration(contract-service)` comment (cosmetic, done when ownerKey is gone)

## Acceptance Criteria

- All 5 consumers migrated off old DAL
- `shared/dal/server/proposals/api.ts` deleted with zero remaining imports
- `contract.service.ts` methods take `ScopedContext`, not `ownerKey`
- `contracts.router.ts` uses entity toolkit (`entity.authedProcedure`, `entity.shareableProcedure`)
- No direct `db` imports in tRPC routers or services
- Cross-entity customer writes go through `createCrudDal(customerServerSpec)` with `SYSTEM_CONTEXT`
- `pnpm tsc` clean
- `pnpm lint` clean
- No runtime behavior change — contract creation, signing, recall, resend all function identically
