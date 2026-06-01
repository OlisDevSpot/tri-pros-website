# tRPC — Entity Server System Operational Rules

tRPC is the client-to-server typesafe glue layer. The **Entity Server System** (ADR-0002) gives each business entity (Customer, Meeting, Proposal, Project) a typed `EntityServerSpec` consumed by `createEntityRouter` to produce a tRPC router with uniform auth, visibility scoping, schema validation, and standardized CRUD — all backed by a standardized DAL.

This DOCS.md captures the **operational rules** for using the system. The **why** lives in [ADR-0002](../../docs/adr/0002-entity-server-system.md). The **how to add an entity** recipe is at [docs/how-to/add-an-entity.md](../../docs/how-to/add-an-entity.md).

## Layout

```
src/trpc/
  init.ts                    base + agent procedure types, createMiddleware
  server.ts                  server-only proxy with React cache() dedup
  query-client.ts            React Query client config
  types.ts                   re-exports DAL types + tRPC-specific context types

  lib/                       Entity Server System primitives
    create-entity-router.ts  top-level factory: spec + factory → router
    create-crud-router.ts    CRUD sub-router factory (5 single-row ops)
    entity-registry.ts       module-load registry: EntityName → spec
    dal-to-trpc.ts           DalReturn → TRPCError bridge
    create-http-context.ts   builds BaseTRPCContext from HTTP request
    middleware/
      scope-middleware.ts    resolves ctx.scope from spec.visibility
      shareable-middleware.ts token-or-session dual-credential resolution

  routers/                   all tRPC routers (registered in app.ts)
    proposals.router/        MIGRATED to entity server system (canonical)
    customers.router/        partial — business sub-router exists
    meetings.router.ts       NOT MIGRATED (single-file, uses agentProcedure directly)
    projects.router/         NOT MIGRATED (uses agentProcedure directly)
    lead-sources.router.ts   NOT MIGRATED
    ... other routers ...
    app.ts                   root router; mounts everything
```

## Rules

### three-base-procedure-types

`src/trpc/init.ts` exports three base procedures:

| Procedure | Auth | Ctx after |
|---|---|---|
| `baseProcedure` | None | `session: null, ability: null, scope: null` |
| `agentProcedure` | Throws UNAUTHORIZED if no session; builds `ability` from session role | `session: non-null, ability: non-null, scope: null` (until scope middleware) |
| `payloadProcedure` | None | Injects Payload CMS client into ctx (CMS reads only) |

Entity routers **never** call `agentProcedure` directly inside the factory — they use the entity toolkit (`entity.authedProcedure` / `entity.shareableProcedure`) which has scope middleware baked in.

**Why**: scope middleware injects `ctx.scope` (the per-user visibility predicate). Bypassing it means agents could read rows they shouldn't.
**Reference impl**: `src/trpc/init.ts`
**Enforced by**: tsc (different procedure-builder types) + convention

### entity-router-via-factory

Migrated entities use `createEntityRouter(spec, factory)`:

```ts
export const proposalsRouter = createEntityRouter(proposalServerSpec, (entity) =>
  createTRPCRouter({
    crud: createCrudRouter({
      spec: proposalServerSpec,
      schemas: { ...proposalSchemas, id: z.string().uuid() },
      authedProcedure: entity.authedProcedure,
      shareableProcedure: entity.shareableProcedure,
      // No handler overrides — lifecycle hooks on the spec handle enrichment.
    }),
    business: createTRPCRouter({ ... }),
    delivery: createDeliveryRouter(entity),
    contracts: createContractsRouter(entity),
  })
)
```

The factory receives an `EntityToolkit`:

| Member | What it is |
|---|---|
| `entity.authedProcedure` | `agentProcedure.use(scopeMiddleware(spec))` |
| `entity.shareableProcedure` | `baseProcedure.use(shareableMiddleware(spec))` |
| `entity.publicProcedure` | `baseProcedure` pass-through |
| `entity.spec` | The spec itself, for sub-routers that need it |

**These are NOT custom abstractions** — they ARE tRPC procedures. Full type inference. Full middleware composability. You can chain `.use(rateLimiter)` after them.

**Why**: factory function API gives sub-routers (delivery, contracts, etc.) the same scope/shareable superpowers as CRUD — not just the CRUD slots.
**Reference impl**: `src/trpc/lib/create-entity-router.ts`; `src/trpc/routers/proposals.router/index.ts`
**Enforced by**: convention

### scope-middleware-is-the-core-superpower

`scopeMiddleware(spec)` resolves `ctx.scope`:

```ts
const isOmni = ctx.ability.can('manage', 'all')
const scope = isOmni ? null : spec.visibility(ctx.session.user.id)
return next({ ctx: { ...ctx, scope } })
```

Every entity procedure inherits this. DAL functions receive `ctx.scope` and apply it to WHERE clauses (`.where(and(..., ctx.scope ?? undefined))`).

This replaces the `isOmni`-or-predicate dance that previously had to be inlined in every procedure body.

**Why**: visibility scoping was being copy-pasted 30+ times across the codebase and had silently drifted. Centralizing in middleware makes it auditable and prevents new drift.
**Reference impl**: `src/trpc/lib/middleware/scope-middleware.ts`
**Enforced by**: convention (entity procedures chain it automatically; non-entity procedures must opt in manually)

### shareable-middleware-token-or-session

`shareableMiddleware(spec)` resolves dual-credential access:

- **Token present** (e.g., `?token=tpr-xxx`): validates the token column on the entity table, sets `ctx.scope = eq(tokenColumn, token)`, `ctx.ability = null`. **Token IS the authorization** — CASL is null.
- **Session present, no token**: requires session, builds ability, resolves scope from `spec.visibility(userId)`.
- **Neither**: throws UNAUTHORIZED.

Activated by `spec.shareable: { tokenColumn: '...' }` in the entity spec. The middleware peeks at `getRawInput()` for the `token` field before Zod validation — branching has to happen before schema enforcement.

Handler code receives `ctx.scope` either way and applies it identically. The handler doesn't know which credential path was taken. CASL gating in handler bodies checks `if (ctx.ability)` — null means token path, CASL is intentionally bypassed.

**Why**: customer e-signature flow needs unauthenticated read/update. Treating token as scope means the DAL is unchanged from the authed path; only middleware differs.
**Reference impl**: `src/trpc/lib/middleware/shareable-middleware.ts`
**Enforced by**: ADR-0002; convention

## Lifecycle Hooks

Entity lifecycle hooks execute at the DAL layer — both before and after database writes. All hooks live on `EntityServerSpec.hooks`, organized by operation (`create`, `update`, `delete`).

### Hook Contract

| | `before` | `after` |
|---|---|---|
| **Async** | Yes (`Promise<T> \| T`) | Yes (`Promise<void>`) |
| **Purpose** | Data transformation, enrichment | Side effects (services, notifications, realtime) |
| **DB access** | Via DAL functions only (never naked `db`) | Via DAL functions only |
| **Context** | `ScopedContext` | `ScopedContext` |
| **Return** | Enriched input data | void |
| **Error** | Throw to abort | Hook impl decides: `await` (critical) vs `void .catch()` (best-effort) |

### Rules

- **Hooks are thin orchestrators.** Pure business logic in `entities/<entity>/lib/`. Service orchestration via existing services.
- **Never use naked `db` in hooks.** All DB access through DAL functions.
- **`ScopedContext` always.** `ctx.session` may be null when called from jobs/services.
- **`duplicate` is declarative config, not a hook.** Lives on `spec.duplicate` with `exclude` + `overrides`. Routes through `createImpl` so create hooks fire automatically.
- **`handlers` overrides bypass hooks entirely.** Use only when the full operation must be replaced.

### Framework Precedent

Follows better-auth (`databaseHooks`), Payload CMS (collection `beforeChange`/`afterChange`), and Prisma (client extensions) — all keep before+after at the same layer.

### crud-five-slots-fixed

`createCrudRouter` produces exactly 5 procedures, mapped to CASL actions:

| Slot | CASL action | Input | Output |
|---|---|---|---|
| `getById` | `read` | `{ id, token? }` | `Row<TTable>` |
| `create` | `create` | `Insert<TTable>` | `Row<TTable>` |
| `update` | `update` | `{ id, data: Update<TTable>, token? }` | `Row<TTable>` |
| `delete` | `delete` | `{ id }` | `void` |
| `duplicate` | `create` | `{ id }` | `Row<TTable>` |

**List is NOT CRUD** — it's always a business sub-router procedure with custom return shape (multi-table joins, derived columns, aggregates).

Per-slot handler override is supported: pass `handlers: { create: customCreateDal, ... }`. Unspecified slots fall back to `createCrudDal(spec)` defaults.

**Why**: 5 single-row operations are mechanical and benefit from a factory. List queries are inherently entity-specific; forcing them into a generic factory produces worse code (see ADR-0002 "Considered alternatives").
**Reference impl**: `src/trpc/lib/create-crud-router.ts`; `src/shared/dal/server/lib/create-crud-dal.ts`
**Enforced by**: tsc (CrudHandlers interface has exactly 5 keys); ADR-0002

### field-level-casl-on-update

The `update` slot does NOT use the bare `ability.can('update', subject)`
check — that would let any field-restricted grant satisfy the gate and
write any column. Instead, `createCrudRouter.update` iterates the input
`data` payload and calls `ability.can('update', subject, field)` for each
defined field, throwing `FORBIDDEN` on the first failure.

Implication: per-entity field-restricted grants in `abilities.ts` are
enforced automatically. For example, the agent grant
`can('update', 'Customer', ['customerProfileJSON', 'propertyProfileJSON', 'financialProfileJSON'])`
means agents can call `crud.update({ data: { customerProfileJSON: {...} } })`
but NOT `crud.update({ data: { phone: '...' } })` — the gate rejects
the second call automatically without any per-entity router code.

**Reference impl**: `src/trpc/lib/create-crud-router.ts` — `assertCanUpdateFields` helper.

### dal-to-trpc-bridge

DAL functions return `DalReturn<T>` (never throw on domain errors). tRPC procedures unwrap with `dalToTrpc()`:

```ts
list: entity.authedProcedure
  .input(proposalListInputSchema)
  .query(async ({ ctx, input }) => dalToTrpc(await listProposals(ctx, input))),
```

Error mapping:
- `not-found` → `TRPCError(NOT_FOUND)`
- `forbidden` → `TRPCError(FORBIDDEN)`
- `create-failed` / `duplicate-failed` → `TRPCError(INTERNAL_SERVER_ERROR)`
- `db-error` / `unknown-error` → `TRPCError(INTERNAL_SERVER_ERROR, cause)`

Services / jobs that consume the same DAL inspect `DalReturn` directly — they don't use `dalToTrpc`.

**Why**: DAL is framework-agnostic. tRPC, services, jobs, scripts all use the same DAL but decide error policy independently. Throwing in DAL forces every caller into try/catch.
**Reference impl**: `src/trpc/lib/dal-to-trpc.ts`
**Enforced by**: tsc (`DalReturn<T>` is a discriminated union; switch must be exhaustive)

### entity-registry-prevents-duplicates

`registerEntity(spec)` is called by `createEntityRouter` on module load. The registry is a `Partial<Record<EntityName, EntityServerSpec>>`. Duplicate registrations throw immediately at module-load time.

Phase 1a ships the registry empty — only entities migrated to the system populate it. Today: proposals. As Customer/Meeting/Project migrate, they'll register too.

**Why**: forcing function. The registry can't have two specs for the same `entityName`; if two files try to register the same name, the second import throws — caught at startup, not at first request.
**Reference impl**: `src/trpc/lib/entity-registry.ts`
**Enforced by**: runtime throw on duplicate

### shareable-controls-which-procedure-crud-uses

`createCrudRouter` selects the procedure per slot based on `spec.shareable`:

```ts
const readProcedure   = spec.shareable ? shareableProcedure : authedProcedure
const updateProcedure = spec.shareable ? shareableProcedure : authedProcedure
// create, delete, duplicate always use authedProcedure
```

When `spec.shareable` is set, `getById` and `update` accept `?token=` and bypass CASL on the token path. `create`, `delete`, `duplicate` remain agent-only — even shareable entities can't be created or destroyed by an unauthenticated client.

**Why**: customers can read AND update their own proposal (e.g., choose a finance option) via the share URL, but they can't create/delete. The dual-credential model is targeted at read + non-destructive update.
**Reference impl**: `src/trpc/lib/create-crud-router.ts` (lines 76–80)
**Enforced by**: factory wiring; convention

### jsonb-merge-columns-merge-on-update

If `spec.update?.jsonbMergeColumns` is set, the `update` handler deep-merges those JSONB columns instead of replacing them. The default `createCrudDal` honors this.

**Why**: forms submit partial JSONB state across multi-step flows; full replacement would wipe prior steps. Declared once in the spec rather than per-call.
**Reference impl**: `src/shared/dal/server/lib/create-crud-dal.ts` (update implementation reads `spec.update.jsonbMergeColumns`)
**Enforced by**: convention (handler reads spec)

### dont-import-server-only-trpc-into-client

`src/trpc/server.ts` is marked `server-only` and uses React `cache()` for request deduplication. Importing it into a `'use client'` file fails the build.

Client components use `useTRPC()` + `useQuery(trpc.x.y.queryOptions())` from `@/trpc/helpers` instead.

**Why**: server proxy bundles server secrets + DAL + db imports. Leaking it into a client bundle ships the world.
**Reference impl**: `src/trpc/server.ts:1` (`'server-only'`)
**Enforced by**: `server-only` package (build fails on cross-boundary import)

### sub-router-when-2-plus

A flat `*.router.ts` is fine for one router. When a router has 2+ sub-routers, promote to a directory matching `notion.router/` / `proposals.router/`:

```
proposals.router/
  index.ts             createEntityRouter call composing the children
  contracts.router.ts  service sub-router
  delivery.router.ts   service sub-router
```

**Reference impl**: `src/trpc/routers/proposals.router/`, `src/trpc/routers/notion.router/`
**Enforced by**: convention

## Migration status (as of 2026-05-19)

| Entity | Status | Notes |
|---|---|---|
| Proposal | ✅ Migrated (PR #207) | Canonical example — full CRUD + business + delivery + contracts |
| Customer | 🟡 Partial | `business.router.ts` exists; CRUD not yet routed through `createCrudRouter` |
| Meeting | ❌ Not migrated | Single-file router with `agentProcedure`; inlines `db` calls |
| Project | ❌ Not migrated | Multi-sub-router but uses `agentProcedure` directly |
| Lead Source | ❌ Not migrated | Single-file router |

The compliance sweep (companion todo to this docs migration) will produce GitHub issues for each remaining migration. ADR-0002 sets the migration order: Proposal → Customer → Meeting → Project.

## Anti-patterns

- **Calling `agentProcedure` inside an entity router factory.** Use `entity.authedProcedure` — scope middleware is mandatory.
- **Inline `db.select()` / `db.insert()` in a procedure body.** Move to DAL.
- **Manual `isOmni` / visibility-predicate branching in a procedure.** That's what `scopeMiddleware` exists for.
- **Adding a CASL check on the shareable token path.** Token IS authorization; `ctx.ability` is null. Gating must be inside `if (ctx.ability)`.
- **Treating `list` as a CRUD slot.** It's not. Always a business sub-router procedure.
- **Returning a `Row<TTable>` from a business sub-router that should return enriched data.** Free-form business return types are the point; don't force list/getFullView to match CRUD.
- **Throwing in DAL.** Use `dalError(...)` / `ThrowableDalError`. Let `dalToTrpc` map at the boundary.
- **Importing `src/trpc/server.ts` from a client component.** Use `useTRPC()` hook.

## See also

- ADR-0002 — Entity Server System (the why)
- ADR-0003 — Service & Provider Architecture (services layer below tRPC)
- `docs/how-to/add-an-entity.md` — step-by-step recipe
- `docs/codebase-conventions/trpc-procedures.md` — operational rules for the non-entity routers
- `docs/codebase-conventions/dal-conventions.md` — `DalReturn`, `ScopedContext`, CRUD vs business DAL
- `src/shared/entities/<entity>/DOCS.md` — per-entity business rules
- `src/shared/entities/<entity>/lib/server-spec.ts` — entity specs
- `src/shared/dal/server/types.ts` — canonical type definitions
