# Session Handoff — tRPC + DAL Standardization (2026-05-17)

> For the next Claude session picking up issue #193. Read this fully before writing any code.

## What Has Been Delivered

Three layers are complete on branch `refactor/193-trpc-entity-server-system-phase-1a-facto`:

### 1. Entity Server System (tRPC layer)

`createEntityRouter(spec, factory)` — factory function API that gives every entity router pre-configured tRPC procedures with scope middleware baked in.

```
Browser → tRPC client hooks → entity.authedProcedure / shareableProcedure / publicProcedure
                                        ↓
                               scopeMiddleware(spec)  →  ctx.scope resolved
                                        ↓
                               procedure body calls DAL
```

**Key files:**
| File | Role |
|------|------|
| `src/trpc/lib/create-entity-router.ts` | Factory — builds toolkit (pre-scoped procedures + spec), calls factory fn |
| `src/trpc/lib/create-crud-router.ts` | Static-literal CRUD sub-router with concrete Zod schemas for full type inference |
| `src/trpc/lib/middleware/scope-middleware.ts` | Resolves `ctx.scope` — uses `createMiddleware` (t.middleware) |
| `src/trpc/lib/middleware/shareable-middleware.ts` | Token-or-session auth — uses `createMiddleware` (t.middleware) |
| `src/trpc/init.ts` | Exports `createMiddleware = t.middleware` for properly-typed middleware factories |
| `src/trpc/lib/dal-to-trpc.ts` | `dalToTrpc()` — maps `DalReturn` errors to `TRPCError` |

### 2. Standardized DAL (WebDevSimplified-inspired)

Every DAL function returns `DalReturn<T>` — never throws, never redirects. Callers decide error handling.

**Key files:**
| File | Role |
|------|------|
| `src/shared/dal/server/lib/types.ts` | Canonical types: `ScopedContext`, `DalReturn<T>`, `EntityServerSpec<TTable, TId>`, `CrudHandlers<TTable, TId>`, `SYSTEM_CONTEXT` |
| `src/shared/dal/server/lib/helpers.ts` | `dalDbOperation()`, `buildUserContext()`, `buildSessionContext()`, `dalVerifySuccess()` |
| `src/shared/dal/server/lib/create-crud-dal.ts` | Generic CRUD factory — 5 handlers returning `DalReturn<T>` |

### 3. Proposal Entity — Fully Migrated

The proposals entity router is complete: CRUD + business queries + service-layer sub-routers.

**Entity DAL:**
| File | Functions |
|------|-----------|
| `src/shared/entities/proposals/dal/server/mutations.ts` | `proposalCreateDal`, `proposalDuplicateDal`, `recordProposalView` |
| `src/shared/entities/proposals/dal/server/queries.ts` | `getFullView`, `listProposals`, `getProposalViews` + types + filter schema |
| `src/shared/entities/proposals/lib/visibility.ts` | `proposalVisibility` (meeting-participation-based) |
| `src/shared/entities/proposals/lib/server-spec.ts` | `proposalServerSpec` |

**Router:** `src/trpc/routers/proposals.router/index.ts` — uses `createEntityRouter` with:
- Inlined CRUD procedures (for full type inference)
- Business sub-router (getFullView, list, getFinanceOptions)
- `createDeliveryRouter(entity)` — service-layer sub-router (email, views, notifications)
- `contractsRouter` — deferred service-layer sub-router (Zoho Sign, still uses old DAL)

### 4. Delivery Router — Service-Layer Sub-Router Reference Implementation

`proposals.router/delivery.router.ts` establishes the pattern for service-layer sub-routers:

```ts
export function createDeliveryRouter(entity: EntityToolkit<typeof proposalServerSpec.table>) {
  const handlers = createCrudDal(proposalServerSpec)
  return createTRPCRouter({
    sendProposalEmail: entity.authedProcedure...  // orchestrates: emailService → handlers.update → cross-entity DAL → job
    recordView: entity.publicProcedure...          // orchestrates: getFullView → token check → recordProposalView → notification job
    getProposalViews: entity.authedProcedure...    // calls entity DAL query
  })
}
```

**Pattern established:**
- Sub-routers receive entity toolkit via factory: `createDeliveryRouter(entity)`
- Procedures orchestrate: services → CRUD DAL → cross-entity DAL → job dispatch
- Services never import `db` — they call DAL with `SYSTEM_CONTEXT` or passed-in context
- `SYSTEM_CONTEXT` for cross-entity side-effects and public procedure paths
- Generic CRUD for simple updates — no ad-hoc wrapper functions
- `@migration(<dependency>)` comments for sequencing gaps

### 5. Meetings Entity DAL (first function)

`src/shared/entities/meetings/dal/server/mutations.ts` — `deriveOutcomeOnProposalSent`. Follows `DalReturn` + `ScopedContext` pattern from day one. Has `@migration(meetings-entity-router)` comment.

---

## Architecture Summary

```
┌─ Browser ─────────────────────────────────────────────┐
│  entities/<entity>/dal/client/  (hooks = tRPC + TQ)   │
│           ↓                                           │
│       tRPC (typesafe glue, dalToTrpc bridge)          │
│           ↓                                           │
├─ Server ──────────────────────────────────────────────┤
│  tRPC procedure body  ──OR──  job / webhook / RSC     │
│           ↓                        ↓                  │
│  ┌────────────────────────────────────────────────┐   │
│  │  CORE: DAL + Services                          │   │
│  │  entities/<entity>/dal/server/  (DalReturn<T>) │   │
│  │  shared/services/     (DAL + external APIs)     │   │
│  └────────────────────────────────────────────────┘   │
│           ↓                        ↓                  │
│          DB (only via DAL)    External APIs            │
└───────────────────────────────────────────────────────┘
```

**Hard rules:**
- Only DAL files import `db`. No exceptions.
- Services never import `db` — they call DAL functions with `SYSTEM_CONTEXT` or a passed-in context.
- Generic CRUD for simple field updates. No ad-hoc DAL wrappers.

**DAL invocation — `ctx: ScopedContext = SYSTEM_CONTEXT`:**
- From tRPC procedures: `dalToTrpc(await dalFunction(ctx, input))` — middleware-resolved scoped ctx
- From services: `await dalFunction(ctx, input)` — ctx passed from caller (tRPC procedure passes its scoped ctx, jobs pass `SYSTEM_CONTEXT`)
- From jobs/webhooks: `await dalFunction(SYSTEM_CONTEXT, input)` — full access, no visibility scoping
- From RSC: `await dalFunction(buildSessionContext(spec), input)` — session-resolved context

---

## What Was Deleted

| File | Reason |
|------|--------|
| `src/trpc/lib/build-agent-ctx.ts` | Superseded by `scopeMiddleware` |
| `src/trpc/lib/create-crud-handlers.ts` | Absorbed by `create-crud-dal.ts` |
| `src/trpc/routers/proposals.router/crud.router.ts` | Replaced by entity factory |
| `src/shared/entities/meetings/lib/derive-outcome-on-proposal-sent.ts` | Replaced by `entities/meetings/dal/server/mutations.ts` |
| `src/shared/dal/server/proposals/proposal-views.ts` | Replaced by entity DAL functions in proposals |

---

## What Remains (explicitly deferred)

### Contracts router migration
`contracts.router.ts` stays as-is. It's a **service-layer concern** (Zoho Sign orchestration). Reads proposals, writes to customers, calls external APIs. Has direct `db` calls (customers table write in `configureDraftEnvelope` and `submitCustomerAge`). Next migration target.

### Old DAL consumers (5 files still importing from deprecated `shared/dal/server/proposals/api.ts`)
1. `shared/services/contract.service.ts` — `getProposal`, `updateProposal`
2. `shared/services/pdf.service.ts` — `getProposal`
3. `trpc/routers/proposals.router/contracts.router.ts` — `getProposal`
4. `app/api/proposals/[proposalId]/summary/route.ts` — `getProposal`
5. `shared/services/upstash/jobs/sync-zoho-sign-status.ts` — `applyContractEvent`

### getFinanceOptions
Currently on `proposalsRouter.business.getFinanceOptions`. Not a proposal entity concern — it's a separate finance-options entity. Stays for now; may get its own entity router later.

### Client DAL relocation
Proposal client hooks still live in `features/proposal-flow/dal/client/`. Convention says they should move to `entities/proposals/dal/client/`. Deferred to cleanup pass.

### Direct DB access violations (still open)
These files import `db` outside DAL — each needs migration:
1. `shared/services/accounting.service.ts`
2. `shared/services/ai/generate-project-summary.ts`
3. `shared/domains/permissions/lib/validate-share-token.ts`
4. `shared/services/notification.service.ts` — meeting methods only, `@migration` comments in place
5. `features/customer-pipelines/dal/server/get-customer-profile.ts`
6. `features/customer-pipelines/dal/server/get-customer-pipeline-items.ts`
7. `features/customer-pipelines/dal/server/move-customer-pipeline-item.ts`
8. `features/agent-dashboard/dal/server/get-action-queue.ts`
9. All tRPC routers with inline `db.` calls (meetings, customers, lead-sources, projects)

### Remaining entity migrations
Customer → Meeting → Project (per ADR-0002 order). Each: create DAL module → wire entity router → update client call sites.

---

## Resolved Design Questions

1. ~~**`entity.crud()` type inference**~~ — **RESOLVED.** `entity.crud()` removed from toolkit. `createCrudRouter()` called directly in the factory with concrete Zod schemas. Static object literal preserves full tRPC type inference. 95 lines of inlined CRUD → 7 lines.

## Open Design Questions

1. **Cross-entity writes in contracts router**: `contracts.router.ts` writes to customers table from proposals router. Should call customer DAL functions once customer is standardized.

2. **`buildSessionContext` for RSC**: Currently calls `auth.api.getSession({ headers: new Headers() })`. May not work in all RSC contexts. Validate when first RSC consumer is written.

3. **JSONB merge on update**: Declared on spec (`jsonbMergeColumns`) but NOT implemented in generic DAL. When a consumer needs JSONB merge (proposal form saves), implement in generic DAL or as a proposal-specific update override?

4. **Visibility behavior change**: Old system scoped proposals by `ownerId`. New system scopes by `userParticipatesInMeeting`. Intentional improvement (fixes visibility leak) but may surface in testing.

5. **Contracts router architecture**: Is it truly a proposals sub-router, or should it be its own service-domain router? It orchestrates Zoho Sign + reads proposals + writes customers + dispatches jobs. Brainstorm before migrating.

6. **Remaining casts (9 total)**: 3 at tRPC ProcedureBuilder boundary (unavoidable with factory pattern), 2 at Zod→Drizzle boundary (API schemas `.omit()` server-derived fields), 3 at Drizzle/tRPC framework APIs, 1 handler merge (eliminable). All documented inline. See `docs/superpowers/specs/2026-05-17-crud-type-inference-design.md` for full analysis.

---

## Verification Status

```
pnpm tsc --noEmit  → exit 0 (zero errors)
pnpm lint          → 0 errors (warnings are pre-existing)
```

---

## Files to Read (priority order)

1. `docs/adr/0002-entity-server-system.md` — the north star (updated with service-layer sub-router pattern + `@migration` convention)
2. `src/trpc/routers/proposals.router/index.ts` — the CRUD + business reference implementation
3. `src/trpc/routers/proposals.router/delivery.router.ts` — the service-layer sub-router reference implementation
4. `src/shared/dal/server/lib/types.ts` — canonical DAL types
5. `src/shared/entities/proposals/dal/server/` — mutations.ts + queries.ts
6. `src/trpc/lib/dal-to-trpc.ts` — the DAL → tRPC bridge
7. `docs/superpowers/specs/2026-05-17-delivery-router-migration-design.md` — design spec for the delivery migration (principles, patterns established)

---

## Next Migration Target

**Contracts router + contract.service + pdf.service + sync-zoho-sign-status job + summary/route.ts**

These are tightly coupled — contracts.router calls contract.service which calls pdf.service and the old `getProposal`/`updateProposal`. Brainstorm the architecture (is contracts its own service domain or a proposals sub-router?) then design the migration.

After contracts: the deprecated `shared/dal/server/proposals/api.ts` can finally be deleted.
