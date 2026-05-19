# tRPC + DAL Standardization — Complete Handoff

> This document captures all design decisions, findings, and architectural direction from the Phase 1b design session. It is the single source of truth for any agent picking up this work. Read it fully before writing any code.

## North Star (from ADR-0002)

> "Every entity declares a typed EntityServerSpec consumed by a layered set of factories that generate tRPC procedures with **uniform auth, visibility scoping, schema validation**, and named special-case behaviors."

The key phrase is **uniform auth, visibility scoping** — across ALL procedures on an entity, not just CRUD.

## What Phase 1a Delivered (branch: refactor/193-trpc-entity-server-system-phase-1a-facto)

Phase 1a landed the foundational types, factories, and entity-name colocation. The diff contains 21 commits on main..HEAD. Key files:

| File | Purpose |
|------|---------|
| `src/trpc/types.ts` | `EntityServerSpec`, `CrudHandlers<TTable>`, `AuthedContext`, `BaseTRPCContext`, `SlotName` |
| `src/trpc/lib/create-crud-handlers.ts` | L0 generic CRUD factory — will be refactored into DAL |
| `src/trpc/lib/create-crud-router.ts` | L1 tRPC sub-router over handlers |
| `src/trpc/lib/create-entity-router.ts` | L2 composer — mounts crud + plugins, registers in registry |
| `src/trpc/lib/build-agent-ctx.ts` | Resolves `scope` from `spec.visibility(userId)` |
| `src/trpc/lib/entity-registry.ts` | `Record<EntityName, EntityServerSpec>` |
| `src/trpc/init.ts` | `baseProcedure`, `protectedProcedure`, `agentProcedure` |
| `src/shared/entities/{customers,meetings,proposals,projects}/lib/constants.ts` | Entity name constants |
| `src/shared/domains/permissions/abilities.ts` | Derives `ENTITY_NAMES`, `EntityName`, `AppSubject` from constants |

### What Phase 1a got right
- `EntityServerSpec` — solid data contract, no behavior leaks
- Entity-name colocation and permissions derivation
- Entity registry
- `AuthedContext` shape: `{ session, ability, scope }`
- Visibility predicate on spec: `(userId: string) => SQL`

### What Phase 1a got wrong
- **Plugins receive spec but NO superpowers.** Sub-routers are plain tRPC routers that manually inline `buildAgentCtx`, `defineAbilitiesFor`, CASL checks — the exact boilerplate the system promised to eliminate. ~35% of the ADR vision.
- **L0 handlers are a DAL that doesn't know it's a DAL.** Lives in `trpc/lib/` instead of `dal/`.
- **L1 internally creates its own handlers** (line 56 of create-crud-router.ts) — no override path.
- **`list` was forced into CRUD** with a generic single-table query that can't serve complex entities.

---

## Design Decisions Made in This Session

### 1. CRUD = 5 single-row operations (list is NOT CRUD)

**CRUD slots:** `getById`, `create`, `update`, `delete`, `duplicate`

**List is a business concern.** Every entity writes its own list query as a business sub-router procedure. List queries involve multi-table joins, derived columns, aggregates, entity-specific filter predicates — none of which fit a generic factory. The factory generates zero list procedures.

`SlotName` type drops `'list'`. `CrudHandlers<TTable>` has 5 slots.

### 2. CRUD returns `Row<TTable>` — always, no exceptions

All CRUD slot return types are `Row<TTable>` (or `void` for delete). No enriched types at the CRUD layer.

When the UI needs enriched data (e.g., `ProposalWithCustomer` with joined customer/meeting fields), it calls a **business sub-router procedure** that either:
- Composes multiple CRUD calls (getById proposal + getById customer + getById meeting)
- Or writes an optimized join query in a dedicated DAL function

The enrichment concern lives outside the CRUD handler interface entirely.

### 3. DAL standardization comes FIRST, then tRPC

**The execution order is: standardize DAL → tRPC becomes thin skin over DAL.**

The principle:
```
tRPC procedure = thin wrapper (validate input -> auth/scope -> call DAL -> return)
DAL function   = all logic (db access, business rules, visibility)
```

tRPC never touches `db`. DAL never touches tRPC. Clean boundary.

### 4. `createEntityRouter` API — factory function with entity toolkit

```ts
export const proposalsRouter = createEntityRouter(proposalServerSpec, (entity) =>
  createTRPCRouter({
    crud: entity.crud({ handlers: { create: customCreate } }),
    business: createTRPCRouter({
      list: entity.authedProcedure.input(listSchema).query(listHandler),
      getFullView: entity.shareableProcedure.input(viewSchema).query(viewHandler),
    }),
    delivery: createTRPCRouter({
      sendEmail: entity.authedProcedure.input(emailSchema).mutation(emailHandler),
      recordView: entity.publicProcedure.input(viewSchema).mutation(viewHandler),
    }),
  })
)
```

**What `createEntityRouter` does:**
1. Registers spec in `entityRegistry`
2. Builds entity toolkit (pre-configured procedures)
3. Calls the factory function with the toolkit
4. Returns whatever `createTRPCRouter` produces — standard tRPC router

**What the entity toolkit provides:**

| Member | What it is | Middleware chain |
|--------|-----------|-----------------|
| `entity.authedProcedure` | Agent-only, scope resolved | `agentProcedure.use(scopeMiddleware(spec))` |
| `entity.shareableProcedure` | Token-or-session, auto-injects `token?` input | `baseProcedure.use(shareableMiddleware(spec))` |
| `entity.publicProcedure` | No auth required | `baseProcedure` (pass-through) |
| `entity.crud(options?)` | Auto-generated CRUD sub-router | Uses authed/shareable internally |
| `entity.spec` | The spec itself | For sub-routers that need it |

**These are NOT custom abstractions.** `entity.authedProcedure` IS `agentProcedure.use(scopeMiddleware(spec))` — a real tRPC procedure. Full type inference. Full middleware composability. You can chain `.use(rateLimiter)` after it.

### 5. The `scopeMiddleware` — the ENTIRE superpower

```ts
function scopeMiddleware(spec) {
  return async ({ ctx, next }) => {
    const isOmni = ctx.ability.can('manage', 'all')
    const scope = isOmni ? null : spec.visibility(ctx.session.user.id)
    return next({ ctx: { ...ctx, scope } })
  }
}
```

~5 lines. That's the entire superpower. Everything else is tRPC being tRPC.

### 6. Shareable middleware — token as legitimate auth

A share token (e.g., `?token=tpr-xxx`) is NOT a "special escape hatch that bypasses auth." It IS authentication — just not session-based.

The `shareableMiddleware` resolves token into a legitimate auth context:

- **Token present:** validates against entity table, injects `scope = eq(tokenColumn, input.token)` so the handler's WHERE clause just works. `ability` is null (CASL checks skipped — token IS the authorization).
- **Session present, no token:** requires session, builds ability, resolves scope from `spec.visibility(userId)`. Normal flow.
- **Neither:** 401.

The handler/DAL receives `ctx.scope` either way. Whether scope came from a token match or visibility predicate is the middleware's concern. DAL applies `WHERE pk = id AND scope` — same code path, different scope source.

**CASL gating with null ability:** CRUD auto-gates CASL. On token path, `ctx.ability` is null. CRUD checks: `if (ctx.ability) assertCan(ctx, action, spec)` — if ability is null, token path already validated.

**Auto-injected token input:** `shareableProcedure` automatically adds `token?: string` to the input schema. The procedure author doesn't declare it.

### 7. CRUD handlers = DAL functions with standard interface

`CrudHandlers<TTable>` is the DAL interface. `createCrudDal(spec)` generates default implementations. Override any slot with a custom DAL function matching the same signature.

```ts
// Simple entity — all defaults
entity.crud()

// Complex entity — override some slots
entity.crud({
  handlers: {
    create: proposalCreateDal,    // SOW snapshot + kind derivation + token gen
    duplicate: proposalDuplicateDal, // selective copy + status reset
    // getById, update, delete → generic defaults
  }
})
```

Generic defaults live in `shared/dal/server/lib/create-crud-dal.ts` (NOT in `trpc/lib/` — it's a DAL concern).

### 8. `spec.shareable` covers both getById AND update

Today's `updateProposal` accepts token OR session. The `shareable` spec field causes the factory to generate both `crud.getById` and `crud.update` against `shareableProcedure`.

---

## Codebase Audit Findings

### Direct DB access in tRPC procedure bodies (~1,400+ lines total)

| Router | Inlined DB lines | Priority |
|--------|-----------------|----------|
| `lead-sources.router.ts` | ~500 | P0 |
| `meetings.router.ts` | ~350 | P0 |
| `customers.router.ts` | ~200 | P1 |
| `projects.router/media.router.ts` | ~80 | P1 |
| `projects.router/business.router.ts` | ~60 | P1 |
| `proposals.router/crud.router.ts` | ~40 | P2 |
| `proposals.router/contracts.router.ts` | ~30 | P2 |
| `projects.router/google-drive.router.ts` | ~50 | P2 |
| `customer-pipelines.router.ts` | ~5 | P3 |

### Missing DAL modules (no DAL exists at all)

- **Lead sources** — zero DAL, ~500 lines inlined across 15 procedures
- **Media files** — zero CRUD DAL, all operations inlined
- **Meetings CRUD** — only participants + gcal helpers exist, no core CRUD
- **Projects business** — no project-from-meeting creation DAL
- **Google accounts** — no token management DAL

### Auth context inconsistency in existing DAL

All existing DAL functions use raw primitives instead of a proper context:
- `(userId: string, isOmni: boolean)` — dashboard, pipelines
- `CustomersViewer { userId, isSuperAdmin }` — customers
- `updateProposal(userIdOrToken: string | null, ...)` — proposals

None accept `AuthedContext`. This must be standardized.

### Worst individual procedures (business logic in tRPC body)

| Procedure | Lines | What's inlined |
|-----------|-------|---------------|
| `lead-sources.getAnalytics` | ~195 | Entire funnel + trend computation |
| `meetings.manageParticipants` | ~162 | Role swapping, demotion, notifications |
| `lead-sources.getAggregateAnalytics` | ~140 | Near-duplicate of getAnalytics |
| `customers.createFromIntake` | ~86 | Full transactional customer + meeting creation |
| `meetings.getPortfolioForMeeting` | ~70 | Scope-matching + media grouping algorithm |

### Clean routers (already good patterns)

- `delivery.router.ts` — uses DAL properly, cleanest proposals sub-router
- `customer-pipelines.router.ts` — mostly delegates to DAL
- `dashboard.router.ts` — single procedure delegates to DAL
- `intake.router.ts` — no direct DB access

---

## DAL Standard Interface (adapted from WebDevSimplified reference)

### Reference pattern (from github.com/WebDevSimplified/next-js-data-access-layer)

The reference uses:
- `DalReturn<T>` — discriminated union `{ success: true, data } | { success: false, error }`
- `dalRequireAuth(user => dalDbOperation(() => query))` — nested wrappers
- Auth resolved INSIDE DAL via `getCurrentUser()`
- Never throws, never redirects

### Our adaptation (IMPLEMENTED)

We adopted the full `DalReturn<T>` pattern and adapted for our two-mode system:

1. **`DalReturn<T>` discriminated union** — every DAL function returns `{ success: true, data } | { success: false, error }`. Never throws, never redirects. Callers decide:
   - tRPC: `dalToTrpc(result)` — maps DalError → TRPCError (client gets HTTP status)
   - Services/jobs: inspect `result.error.type`, log, retry, or propagate
   - Server components: redirect on auth errors, throw on DB errors
2. **`dalDbOperation(operation)` wrapper** — catches all DB errors, converts to structured `DalReturn`. For business logic errors mid-query, throw `ThrowableDalError` inside the operation.
3. **`ScopedContext` (not AuthedContext)** — DAL functions receive `{ session, ability, scope }` all nullable. Works for both tRPC (middleware resolves context) and services/jobs (construct via `SYSTEM_CONTEXT` or `buildUserContext()`).
4. **Auth resolved OUTSIDE DAL** — tRPC middleware provides scope via `ScopedContext`. Jobs/services construct context via helpers. DAL never calls `getCurrentUser()` — it receives context.
5. **Split queries.ts / mutations.ts per entity** — following the reference pattern.
6. **Types derived from Drizzle schema** — `Row<TTable>`, `Insert<TTable>`, `Update<TTable>` from `shared/db/types`. No separate DTOs.

### Standard DAL function signatures

```ts
// CRUD (standardized, auto-generated for simple entities)
getById(ctx: ScopedContext, input): Promise<DalReturn<Row<TTable> | undefined>>
create(ctx: ScopedContext, input):  Promise<DalReturn<Row<TTable>>>
update(ctx: ScopedContext, input):  Promise<DalReturn<Row<TTable>>>
delete(ctx: ScopedContext, input):  Promise<DalReturn<void>>
duplicate(ctx: ScopedContext, input): Promise<DalReturn<Row<TTable>>>

// Business queries (hand-written, free-form return types)
listProposals(ctx: ScopedContext, input): Promise<DalReturn<PaginatedResult<ProposalListRow>>>
getFullView(ctx: ScopedContext, input):   Promise<DalReturn<ProposalWithCustomer | undefined>>
```

### Context construction

```ts
// From tRPC (middleware already resolved):
const proposal = dalToTrpc(await getFullView(ctx, { id }))

// From a background job (system-level, no scoping):
import { SYSTEM_CONTEXT } from '@/shared/dal/server/lib/types'
const result = await getFullView(SYSTEM_CONTEXT, { id })
if (!result.success) { log(result.error); return }

// From a service acting on behalf of a user:
import { buildUserContext } from '@/shared/dal/server/lib/helpers'
const ctx = buildUserContext(userId, userRole, proposalServerSpec)
const result = await getFullView(ctx, { id })
```

### Key files

| File | Purpose |
|------|---------|
| `shared/dal/server/lib/types.ts` | `ScopedContext`, `DalReturn`, `DalError`, `EntityServerSpec`, `CrudHandlers`, `SYSTEM_CONTEXT` |
| `shared/dal/server/lib/helpers.ts` | `dalDbOperation`, `buildUserContext`, `buildSessionContext`, `dalVerifySuccess` |
| `shared/dal/server/lib/create-crud-dal.ts` | Generic CRUD factory returning `CrudHandlers<TTable>` |
| `trpc/lib/dal-to-trpc.ts` | `dalToTrpc()` — maps `DalReturn` errors to `TRPCError` |

---

## Proposal Entity — Procedure Mapping (proving ground)

### Current → New mapping

| Current procedure | New location | Entity procedure type |
|---|---|---|
| `crud.getProposal` | `crud.getById` | `shareableProcedure` |
| `crud.list` | `business.list` | `authedProcedure` |
| `crud.createProposal` | `crud.create` (override) | `authedProcedure` |
| `crud.updateProposal` | `crud.update` | `shareableProcedure` |
| `crud.deleteProposal` | `crud.delete` | `authedProcedure` |
| `crud.duplicateProposal` | `crud.duplicate` (override) | `authedProcedure` |
| `crud.getFinanceOptions` | **Separate entity router** | N/A — finance options is its own entity |
| `delivery.sendProposalEmail` | `delivery.sendEmail` | `authedProcedure` |
| `delivery.recordView` | `delivery.recordView` | `publicProcedure` |
| `delivery.getProposalViews` | `delivery.getProposalViews` | `authedProcedure` |
| `contracts.*` (8 procedures) | `contracts.*` | Mix of `authed`/`shareable`/`public` |

### Client call path changes

- `proposalsRouter.crud.getProposal` → `proposalsRouter.crud.getById`
- `proposalsRouter.crud.createProposal` → `proposalsRouter.crud.create`
- `proposalsRouter.crud.updateProposal` → `proposalsRouter.crud.update`
- `proposalsRouter.crud.deleteProposal` → `proposalsRouter.crud.delete`
- `proposalsRouter.crud.duplicateProposal` → `proposalsRouter.crud.duplicate`
- `proposalsRouter.crud.list` → `proposalsRouter.business.list`
- `proposalsRouter.crud.getFinanceOptions` → separate router (e.g., `financeOptionsRouter.crud.list`)
- All delivery/contracts paths stay identical

### Visibility predicate (new, must write)

`entities/proposals/lib/visibility.ts` — `proposalVisibility(userId: string) => SQL`

Most likely: `userParticipatesInMeeting(userId, proposals.meetingId)` — reuses existing primitive from `dal/server/meetings/participants.ts`. This fixes the latent bug where any agent can read any proposal via direct getById.

---

## Implementation Status

### Completed (Phase 1 + 2 — foundation)

| Step | File | Status |
|------|------|--------|
| 1 | Standard types in `trpc/types.ts` (`CrudHandlers`, `AuthedContext`) | ✅ |
| 2 | `shared/dal/server/lib/create-crud-dal.ts` | ✅ |
| 3 | `entities/proposals/lib/visibility.ts` | ✅ |
| 4 | `entities/proposals/lib/server-spec.ts` | ✅ |
| 8 | `createEntityRouter` factory function API | ✅ |
| 9 | `trpc/lib/middleware/scope-middleware.ts` + `shareable-middleware.ts` | ✅ |
| 10 | Entity toolkit: `{ authedProcedure, shareableProcedure, publicProcedure, crud(), spec }` | ✅ |
| 11 | `createCrudRouter` receives pre-scoped procedures from toolkit | ✅ |
| 12 | `create-crud-handlers.ts` + `build-agent-ctx.ts` deleted | ✅ |

### Open Design Questions — Resolved

1. **shareableMiddleware input injection**: Resolved pragmatically. tRPC middleware can READ `rawInput` but cannot MODIFY the input schema. L1 (`createCrudRouter`) manually adds `token: z.string().optional()` to getById/update input schemas for shareable entities. Middleware reads via `getRawInput()`.
2. **`exclude` option**: Kept — useful for entities that don't need all 5 CRUD slots.
3. **Error convention**: Thrown errors confirmed. DAL throws `Error('NotFound')` etc., L1 maps to `TRPCError` in `mapDomainErrors()`. Simpler than result types for our context.
4. **JSONB merge on update**: Declared on spec (`jsonbMergeColumns`), NOT yet implemented in generic DAL. Override per-entity for now. Promote to generic when 2+ entities need it.
5. **Cross-entity writes in contracts**: See "DAL vs Services" architecture note below — contracts is deferred.

---

## Execution Order — Remaining (Proposal Router Migration)

### Phase 3: Proposal DAL + router wiring

**Step 5**: Write `entities/proposals/dal/server/mutations.ts`
- `proposalCreateDal(ctx, input)` — server-derives `kind` from meeting's projectId, generates token, snapshots SOW from meeting trade selections. Returns `Row<proposals>`.
- `proposalDuplicateDal(ctx, input)` — reads source via enriched `getFullView`, cherry-picks fields (label prefix, owner reassignment, status reset to draft), calls `proposalCreateDal`. Returns `Row<proposals>`.

**Step 6**: Write `entities/proposals/dal/server/queries.ts`
- `getFullView(ctx, input)` — current `getProposal()` from `api.ts`. Returns `ProposalWithCustomer` (enriched type with joined customer, meetingProjectId, projectFirstContractSentAt). This is the business read the UI uses.
- `listProposals(ctx, input)` — current `list` from `crud.router.ts` (complex joins, derived columns, entity-specific filters/sorts).

**Step 7**: Deprecate `shared/dal/server/proposals/api.ts` — functions absorbed into new DAL.

**Step 13**: Rewrite `proposals.router/index.ts` using `createEntityRouter`:
```ts
export const proposalsRouter = createEntityRouter(proposalServerSpec, (entity) =>
  createTRPCRouter({
    crud: entity.crud({
      handlers: { create: proposalCreateDal, duplicate: proposalDuplicateDal },
    }),
    business: createTRPCRouter({
      list: entity.authedProcedure.input(listSchema).query(listHandler),
      getFullView: entity.shareableProcedure.input(viewSchema).query(viewHandler),
    }),
    delivery: deliverySubRouter(entity),
    // contracts: DEFERRED — see "DAL vs Services" note
  })
)
```

**Step 14**: Convert `delivery.router.ts` to receive entity toolkit.
- `sendProposalEmail` → `entity.authedProcedure`. Uses `ctx.scope` for visibility. Status update uses standard CRUD update handler (not an ad-hoc `markAsSent` function — the whole point of CRUD DAL).
- `recordView` → `entity.publicProcedure` (token validated inline, creates ProposalView record).
- `getProposalViews` → `entity.authedProcedure`.

**Step 15**: DEFERRED — `contracts.router.ts` migration. See "DAL vs Services" note.

**Step 17**: Update client call sites (~19 files, mostly renames):
- `crud.getProposal` → `business.getFullView`
- `crud.createProposal` → `crud.create`
- `crud.updateProposal` → `crud.update`
- `crud.deleteProposal` → `crud.delete`
- `crud.duplicateProposal` → `crud.duplicate`
- `crud.list` → `business.list`
- `crud.getFinanceOptions` → separate concern (deferred or inline)
- delivery/contracts paths stay identical

**Step 18**: Validate — tsc + lint + manual walkthrough.

### Phase 4+: Remaining entity migrations (separate issues)

- Customer → Meeting → Project (per ADR-0002 order)
- Lead sources, media files (P0 severity — high impact)
- Contracts router architecture (see below)
- Each migration: create DAL module → wire entity router → update client call sites

---

## DAL vs Services — Architectural Distinction

**tRPC procedure bodies invoke two distinct layers:**

1. **DAL (Data Access Layer)** — db-based, internal. Pure data operations receiving `AuthedContext`. Reads, writes, queries. Examples: `createCrudDal(spec)`, `listProposals(ctx, input)`, `getFullView(ctx, input)`. The DAL is reusable from tRPC, jobs, scripts, RSC.

2. **Services layer** — function-based, orchestrates external systems. May call DAL functions in their bodies. Interacts with external APIs and writes to our DB as side effects. Examples: `contractService.createSigningRequest()`, `emailService.sendProposalEmail()`, Upstash job dispatchers.

**The contracts sub-router is a services-layer concern.** It orchestrates Zoho Sign API calls that happen to read proposals and write to customers. It does NOT belong to the proposals entity's DAL — it belongs to the contract/signing service domain. `configureDraftEnvelope` reads a proposal, validates envelope documents via the Zoho registry, then writes to BOTH customers and proposals in a transaction. `submitCustomerAge` reads a proposal, then writes to customers. These are cross-entity service orchestrations, not proposal data access.

**Design principle**: DAL functions are pure data access with `ScopedContext` and `ctx.scope`. Service functions are orchestration that compose DAL calls with external API calls. tRPC procedures call one or the other — never `db` directly. Services that need DB access call DAL functions (using `SYSTEM_CONTEXT` or `buildUserContext()`).

**Contracts router disposition (deferred)**: The contracts router currently lives on `proposalsRouter` but may:
- Stay on proposalsRouter as a service-layer sub-router (using entity toolkit for auth)
- Move to a top-level `contractsRouter` or `signingRouter` (decoupled from proposal entity)
- Be refactored when the signing service architecture is resolved

This decision is explicitly deferred from the Proposal migration. The contracts router continues to work as-is during migration.

---

## Files to Read Before Starting

| File | Why |
|------|-----|
| `docs/adr/0002-entity-server-system.md` | The north star |
| `docs/how-to/add-an-entity.md` | The developer-facing guide |
| `src/trpc/types.ts` | Type contract — `EntityServerSpec`, `AuthedContext`, `CrudHandlers` |
| `src/trpc/init.ts` | Procedure chain: `baseProcedure` → `protectedProcedure` → `agentProcedure` |
| `src/trpc/lib/create-entity-router.ts` | L2 factory function API |
| `src/trpc/lib/create-crud-router.ts` | L1 thin tRPC skin over DAL |
| `src/trpc/lib/middleware/scope-middleware.ts` | Scope resolution middleware |
| `src/trpc/lib/middleware/shareable-middleware.ts` | Token-or-session middleware |
| `src/shared/dal/server/lib/create-crud-dal.ts` | Generic CRUD DAL factory |
| `src/shared/entities/proposals/lib/server-spec.ts` | Proposal server spec |
| `src/shared/entities/proposals/lib/visibility.ts` | Proposal visibility predicate |
| `src/trpc/routers/proposals.router/` | All files — the migration target |
| `src/shared/dal/server/proposals/api.ts` | Old proposal DAL — deprecated, remaining consumers are services |
| `src/shared/dal/server/lib/types.ts` | DAL shared types — `ScopedContext`, `DalReturn`, `DalError`, `SYSTEM_CONTEXT` |
| `src/shared/dal/server/lib/helpers.ts` | DAL helpers — `dalDbOperation`, `buildUserContext`, `dalVerifySuccess` |
| `src/trpc/lib/dal-to-trpc.ts` | `dalToTrpc()` — DalReturn → TRPCError bridge |

---

## Open Questions (for future sessions)

1. **Service-layer DAL usage**: Services like `contract.service.ts` currently call the old DAL directly. When migrated, they should use `SYSTEM_CONTEXT` or `buildUserContext()`. But should services wrap their own DB calls in `dalDbOperation`? Or should they only call entity DAL functions? Decision: services should ONLY call entity DAL functions, never `db` directly. The `dalDbOperation` wrapper stays inside DAL.

2. **Client DAL relocation**: Proposal client hooks live in `features/proposal-flow/dal/client/`. Convention says they should move to `entities/proposals/dal/client/`. When? During entity migration or as a separate cleanup pass?

3. **`entity.crud()` type inference**: The `createCrudRouter` factory returns dynamically-typed routers that lose tRPC type inference. Proposals inlines CRUD procedures for full types. Should we fix the factory's type inference (complex tRPC generic work) or accept inline as the pattern for complex entities?

4. **Old DAL deprecation timeline**: `shared/dal/server/proposals/api.ts` is deprecated but still consumed by 6 files (services, delivery router, contracts router, jobs, API route). These migrate when their parent concerns migrate (delivery/contracts service-layer refactor, job modernization).

5. **Cross-entity DAL calls**: `contracts.router.ts` writes to the customers table. Should it call customer DAL functions (once standardized) or have its own service-level DAL? Decision deferred until customer entity migration.

6. **`buildSessionContext` for RSC**: The helper calls `auth.api.getSession({ headers: new Headers() })` which may not work in all RSC contexts (needs actual request headers). Validate when first RSC consumer is written.
