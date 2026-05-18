# Entity Server System

Every business **Entity** (Customer, Meeting, Proposal, Project) declares a typed **EntityServerSpec** that configures a factory (`createEntityRouter`) producing a tRPC router with uniform auth, visibility scoping, schema validation, and standardized CRUD — all backed by a standardized Data Access Layer. We chose this over the existing pattern of hand-written tRPC routers because the four entity routers had already drifted into divergent CRUD shapes, 1,400+ lines of database access were inlined in procedure bodies, and the `isOmni`-or-predicate dance had been copied 30+ times with no forcing function preventing further drift. This is the server-side counterpart of ADR-0001's Entity Action System: same forcing-function pattern, same typed-registry shape, applied one layer deeper.

## Context

Audit of the tRPC layer and DAL surfaced six frictions that convention alone wasn't holding:

1. **30+ inline copies** of `const isOmni = ctx.ability.can('manage', 'all'); const where = isOmni ? undefined : userCanSeeX(...)` — the row-visibility "dance" repeated across `customers.router.ts`, `meetings.router.ts`, `customer-pipelines.router.ts`, etc. Auditing visibility-correctness means reading every procedure individually.

2. **CRUD shapes diverged.** Procedure names varied (`getAll`/`list`/`getForEdit` vs `getProposal`/`createProposal`/`updateProposal`). Input schemas varied. No type-level mechanism kept them aligned.

3. **1,400+ lines of direct DB access in tRPC procedure bodies.** Five entity domains have zero DAL. tRPC procedures inline `db.select()`, `db.update()`, `db.transaction()` with complex joins, aggregates, and business logic. The worst offenders: `meetings.router.ts` (~350 lines), `lead-sources.router.ts` (~500 lines), `customers.router.ts` (~200 lines). Background jobs and scripts cannot reuse this logic because it's trapped inside tRPC handlers.

4. **The dual-credential proposal read was inlined ad-hoc.** `getProposal` accepted "session with CASL `read` permission OR matching share token" via inline branching, with no shared abstraction for future shareable entities.

5. **Silent visibility-scope leak on `getProposal`.** The procedure ran a CASL `can('read', 'Proposal')` check but skipped any row-scoping predicate. Every agent could read every proposal via direct id query.

6. **Sub-routers (plugins) received no superpowers.** The Phase 1a factory gave auth/visibility/scope to CRUD procedures but not to business sub-routers (delivery, contracts, etc.). Those sub-routers still manually inlined `buildAgentCtx`, `defineAbilitiesFor`, CASL checks — the exact boilerplate the system was supposed to eliminate.

ADR-0001 had already solved the structurally identical problem at the client-side action-menu layer. The same solution shape applied one layer deeper.

## Decision

An **Entity Server System** with five pieces:

### 1. EntityServerSpec

A typed declaration per entity at `entities/<entity>/lib/server-spec.ts`. A single interface with required `caslSubject` and `visibility` — every entity is a top-level identity. Named typed config fields for cross-entity patterns: `shareable: { tokenColumn }` (dual-credential access via share token, covers getById AND update), `update.jsonbMergeColumns` (deep-merge JSONB columns instead of replace), `primaryKey` (override default `'id'`). No callback functions in the spec except the visibility predicate — the spec is data, not behavior.

### 2. Standardized DAL

Every entity gets a standardized Data Access Layer with consistent function signatures. **All database access goes through DAL — tRPC procedures never import `db`.**

**CRUD DAL** (`shared/dal/server/lib/create-crud-dal.ts`): A factory that generates 5 single-row operations: `getById`, `create`, `update`, `delete`, `duplicate`. All receive `AuthedContext` (`{ session, ability, scope }`), apply `ctx.scope` for visibility, return `Row<TTable>`. Per-slot overrides accepted — override the implementation, not the return type.

**Business DAL** (per-entity): Hand-written functions for complex queries (enriched reads, multi-table joins, aggregates). Free-form return types. Uses `ctx.scope` for visibility or composes CRUD DAL functions internally.

**Standard interface:**
```
CRUD:     (ctx: AuthedContext, input: T) => Promise<Row<TTable>>
Business: (ctx: AuthedContext, input: T) => Promise<CustomShape>
```

DAL functions are reusable from tRPC procedures, background jobs, scripts, and RSC — all construct their own `AuthedContext` appropriate to their entry point.

**List is NOT CRUD.** List queries involve multi-table joins, derived columns, aggregates, and entity-specific filter predicates. Every entity writes its own list as a business DAL function consumed by a business sub-router procedure.

### 3. Entity Procedure Builders

`createEntityRouter` provides **pre-configured tRPC procedures** that propagate entity superpowers (auth, visibility scope, shareable branching) to ALL procedures on the entity — not just CRUD.

```ts
createEntityRouter(spec, (entity) =>
  createTRPCRouter({
    crud: entity.crud({ handlers: { create: customCreateDal } }),
    business: createTRPCRouter({
      list: entity.authedProcedure.input(schema).query(handler),
    }),
    delivery: createTRPCRouter({
      sendEmail: entity.authedProcedure.input(schema).mutation(handler),
      recordView: entity.publicProcedure.input(schema).mutation(handler),
    }),
    contracts: createTRPCRouter({
      getStatus: entity.shareableProcedure.input(schema).query(handler),
    }),
  })
)
```

The entity toolkit:

| Member | What it is |
|--------|-----------|
| `entity.authedProcedure` | `agentProcedure.use(scopeMiddleware(spec))` — agent-only, scope resolved |
| `entity.shareableProcedure` | `baseProcedure.use(shareableMiddleware(spec))` — token-or-session, auto-injects `token?` input |
| `entity.publicProcedure` | `baseProcedure` — no auth required |
| `entity.crud(options?)` | Auto-generated CRUD sub-router using authed/shareable procedures + DAL |
| `entity.spec` | The spec itself, for sub-routers that need it |

**These are NOT custom abstractions.** They ARE tRPC procedures — real `t.procedure.use(middleware)` chains. Full type inference. Full middleware composability. You can chain `.use(rateLimiter)` after them.

### 4. Scope and Shareable Middleware

**`scopeMiddleware(spec)`** — the core superpower, ~5 lines:
```ts
({ ctx, next }) => {
  const isOmni = ctx.ability.can('manage', 'all')
  const scope = isOmni ? null : spec.visibility(ctx.session.user.id)
  return next({ ctx: { ...ctx, scope } })
}
```

**`shareableMiddleware(spec)`** — resolves token-or-session into unified context:
- Token present: validates against entity table, sets `scope = eq(tokenColumn, token)`, `ability = null`. Token IS the authorization.
- Session present, no token: requires session, builds ability, resolves scope from `spec.visibility(userId)`.
- Neither: 401.

The handler/DAL receives `ctx.scope` either way. It never branches on which credential path was taken. CASL gating checks `if (ctx.ability)` — null means token path, CASL already bypassed by middleware.

### 5. Entity-name colocation + registry

Each entity's identity string lives in `entities/<entity>/lib/constants.ts`; `domains/permissions/abilities.ts` imports them and derives `ENTITY_NAMES` const array + `EntityName` union + `AppSubject` type. Visibility predicate colocated at `entities/<entity>/lib/visibility.ts`. Server-spec at `entities/<entity>/lib/server-spec.ts`. The server-side `entityRegistry: Record<EntityName, EntityServerSpec>` mirrors ADR-0001's client-side registry.

## Considered alternatives

- **L0/L1/L2 layer nomenclature with fixed handler creation** (Phase 1a design). L1 internally created L0 handlers with no override path. Replaced: handler creation decoupled into DAL; L1 wraps whatever DAL it receives. The numbered-layer naming created a false sense of architectural depth when the real product is simpler: DAL + thin tRPC skin.

- **Plugins as `(spec) => Router` factories.** Phase 1a passed spec to plugins, but plugins got no superpowers — they were plain tRPC routers that manually inlined auth/scope. Replaced: factory-function API where plugins receive entity toolkit with pre-configured procedures.

- **List as a CRUD slot.** Forced complex multi-table queries into a generic single-table factory. List queries are inherently entity-specific (custom joins, derived columns, aggregates, filter predicates). Replaced: list is always a business sub-router concern. CRUD = 5 single-row operations only.

- **Enriched return types from CRUD (`ProposalWithCustomer`).** Required complex generic typing (`CrudHandlers<TTable, TOutput>`). Replaced: CRUD always returns `Row<TTable>`. Enriched views are business DAL functions called by business sub-routers.

- **Discriminated union over `parentEntity` (CoreEntitySpec | NestedEntitySpec).** ~70 LoC of dormant scaffolding with no consumer. Real candidate tables (meetingParticipants, customerNotes, proposalViews) are better modeled as business procedures on the parent's router. Re-introduce if genuine need emerges.

- **Auth resolution at the app-router level.** Token resolution on every request, even non-shareable entities. Rejected: wasteful. Entity-router level is correct — only entities with `spec.shareable` get the shareable middleware.

- **`DalReturn<T>` result types (WebDevSimplified pattern).** DAL never throws, returns discriminated union `{ success, data } | { success, error }`. Considered but rejected for our use case: we're always in a tRPC context or a job that catches. Domain errors via throw (`Error('NotFound')`, `Error('Forbidden')`) with tRPC-level error mapping is simpler and sufficient.

- **Database-level RLS (Postgres Row Level Security).** Rejected: our visibility predicates involve cross-table joins complex for RLS policy SQL; background jobs need privileged access; CASL is already the authorization engine; Drizzle RLS support still maturing.

- **Separate `business.getByShareToken` procedure.** Rejected: puts call-site routing burden on the page. The proposal page is shared between agents and homeowners — it must call ONE procedure. Spec-described `shareable` resolves credentials via middleware.

- **Auto-derived `EntityName` union from registry.** Rejected: too magical. Hand-maintained union in `abilities.ts` with compile error when missed.

## Consequences

- **Standardize DAL first, then tRPC.** The execution order matters. DAL standardization creates reusable data-access functions; tRPC becomes a thin wrapper calling them. This reverses the Phase 1a approach (which started at tRPC and worked down).

- **Migration order: Proposal → Customer → Meeting → Project.** Proposals first as the highest-learning entity (shareable + JSONB merge + dual-credential). Each migration: create/standardize DAL → wire entity router → update client call sites. Each is a single PR.

- **The Proposal migration fixes a real bug.** Today's `getProposal` skips visibility scoping. The migrated `crud.getById` applies `proposalVisibility(userId)` in SQL. Surfaces that depended on the leak must be validated.

- **~1,400 lines of inlined DB access move to DAL.** The audit identified the full scope: `meetings.router.ts` (~350 lines), `lead-sources.router.ts` (~500 lines), `customers.router.ts` (~200 lines), plus projects and proposals sub-routers. Each migration PR extracts inlined logic into DAL functions.

- **All existing DAL functions gain standardized `ScopedContext` interface.** The current `(userId, isSuperAdmin)` and `CustomersViewer` patterns are replaced with `ScopedContext { session, ability, scope }` so the same functions work from tRPC, jobs, scripts, and RSC. For tRPC, middleware resolves context from the HTTP request. For jobs/services, callers use `SYSTEM_CONTEXT` (full access) or `buildUserContext(userId, role, spec)` (scoped).

- **Adding a new entity becomes:** one spec file + one constant import in `abilities.ts` + one `createEntityRouter` call. CRUD works immediately with zero DAL code (generic factory). Business sub-routers use `entity.authedProcedure` for superpowers. See `docs/how-to/add-an-entity.md`.

- **Field-level CASL helper deferred.** Customer's per-field loop is the only adopter. Promote to `requireFieldAccess(...)` when 2+ adopters land.

- **DAL is the ONLY path to the database.** No file outside `shared/dal/` and `shared/entities/*/dal/` may import `db` from `@/shared/db`. This is a hard rule, not a guideline. DAL functions return `DalReturn<T>` (discriminated union — never throw, never redirect). Callers decide what to do with errors: tRPC maps to `TRPCError` via `dalToTrpc()`, services inspect the error type and log/retry/propagate, server components can redirect. The DAL pattern follows WebDevSimplified's `DalReturn<T>` + `dalDbOperation()` composition adapted for our two-mode system (tRPC context vs direct server-side).

- **Direct DB access violations (must migrate to DAL).** Audit found these files importing `db` outside DAL — each is a follow-up migration:
  - `shared/services/accounting.service.ts` — reads `proposals.fundingJSON`, writes `proposals.qbPaymentStatus`
  - `shared/services/ai/generate-project-summary.ts` — reads proposal, updates `proposals.projectJSON`
  - `shared/domains/permissions/lib/validate-share-token.ts` — single-column token lookup
  - `features/customer-pipelines/dal/server/get-customer-profile.ts` — complex joins (should move to `entities/customers/dal/server/`)
  - `features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` — extensive aggregations (should move to `entities/customers/dal/server/`)
  - `features/customer-pipelines/dal/server/move-customer-pipeline-item.ts` — status transitions
  - `features/agent-dashboard/dal/server/get-action-queue.ts` — engagement classification
  - All tRPC router files with inline `db.select()`/`db.update()` (see "Direct DB access in tRPC procedure bodies" audit above)

- **Entity DAL convention.** Each entity gets `entities/<entity>/dal/server/` (queries + mutations) and `entities/<entity>/dal/client/` (tRPC+TanStack hooks). Server DAL is the "core" reusable from tRPC, services, jobs, RSC. Client DAL is the browser-side typed access layer. Feature-level DAL (`features/*/dal/`) is deprecated — migrate to entity-level as entities are standardized.

- **tRPC procedure bodies invoke two distinct layers: DAL and Services.** A procedure body should call either (a) DAL functions directly (db-based, internal — reads, writes, queries) or (b) service-layer functions (external service orchestration — Zoho Sign, Resend email, Upstash jobs — which may call DAL internally). The contracts sub-router on proposals is the canonical example of a services-layer concern: it orchestrates Zoho Sign API calls that happen to read/write proposal and customer data as side effects. **Service-layer sub-routers should not be assumed to colocate with the entity whose data they touch.** A Zoho contract operation reads proposals, writes to customers, calls an external API, and dispatches background jobs — it belongs to the contract/signing service domain, not the proposals entity. The current `contracts.router.ts` is deferred from migration until this architectural boundary is resolved. Design principle: DAL is pure data access with `AuthedContext`; services are orchestration functions that compose DAL calls with external API calls and may construct their own context.

- **Service-layer sub-routers receive the entity toolkit via factory pattern.** Reference implementation: `proposals.router/delivery.router.ts`. A sub-router that orchestrates services (email, notifications, jobs) is declared as `createDeliveryRouter(entity: EntityToolkit<TTable>)` and wired inside the parent `createEntityRouter` factory: `delivery: createDeliveryRouter(entity)`. The sub-router uses `entity.authedProcedure` / `entity.publicProcedure` — it gets scope middleware for free. The procedure body orchestrates: (1) call pure services (no DB), (2) call generic CRUD DAL for updates (`handlers.update(ctx, { id, data })`), (3) call cross-entity DAL for side-effects (with `SYSTEM_CONTEXT`), (4) dispatch async jobs. Services are pure formatters/dispatchers — they never import `db`. No ad-hoc DAL wrappers for simple field updates; use generic CRUD.

- **`SYSTEM_CONTEXT` default, `ctx` override for service invocations.** When a service or job calls DAL, it defaults to `SYSTEM_CONTEXT` (full access — no visibility scoping). When a tRPC procedure calls DAL directly, it passes its middleware-resolved `ctx` (scoped). This two-mode invocation replaces the old `ownerKey` pattern (null for omni, userId for scoped) — visibility is now a SQL predicate resolved by middleware, not an ad-hoc parameter threaded through services.

- **`@migration(<dependency>)` comments for sequencing gaps.** When the correct pattern can't be fully applied because a dependency entity hasn't migrated yet, implement the target pattern with a migration comment: `// @migration(meetings-entity-router)` followed by what the code does now, what it becomes, and what to delete. Greppable by dependency identifier. See `delivery.router.ts` and `notification.service.ts` for examples.
