# tRPC — Entity Server System Operational Rules

tRPC is the client-to-server typesafe glue layer. The **Entity Server System** (ADR-0002) gives each business entity (Customer, Meeting, Proposal, Project) a typed `EntityServerSpec` that drives uniform auth, visibility scoping, schema validation, and standardized CRUD — all backed by a standardized DAL.

The router for an entity is assembled by **definition, not generation**: per-entity pre-scoped procedures are defined once in `<entity>.router/procedures.ts`, every sub-router is a plain `createTRPCRouter` leaf importing them, and `index.ts` is pure composition. (This replaced the `createEntityRouter` factory + `EntityToolkit` param + `entity-registry` — removed in the tRPC Standardization Epic, slice S7, 2026-08-11.)

This DOCS.md captures the **operational rules** for using the system. The **why** lives in [ADR-0002](../../docs/adr/0002-entity-server-system.md). The **how to add an entity** recipe is at [docs/how-to/add-an-entity.md](../../docs/how-to/add-an-entity.md).

## Layout

```
src/trpc/
  init.ts                    base + agent procedure types, createMiddleware
  server.ts                  server-only proxy with React cache() dedup
  query-client.ts            React Query client config
  types.ts                   re-exports DAL types + tRPC-specific context types

  lib/                       Entity Server System primitives
    create-crud-router.ts    CRUD sub-router factory (5 single-row ops); builds
                             its scoped procedures inline from config.spec
    dal-to-trpc.ts           DalReturn → TRPCError bridge
    create-http-context.ts   builds HTTPTRPCContext from HTTP request (+ RSC variant)
    prefetch.ts              prefetch (fire-and-forget, both tiers) into the per-request query client
    middleware/
      scope-middleware.ts    resolveVisibilityScope(spec, auth) → ctx.scope SQL
      shareable-middleware.ts token-or-session dual-credential resolution

  components/                HydrateClient + hydration error boundary (server↔client seam)

  routers/                   all tRPC routers (registered in app.ts)
    <entity>.router/         each: procedures.ts + crud.router.ts + leaf files + pure index.ts
    proposals.router/        MIGRATED to entity server system (canonical exemplar)
    customers.router/        MIGRATED — full CRUD + profile + business leaves
    meetings.router/         MIGRATED — crud + reads + participants + business leaves
    customer-notes.router/   MIGRATED — pure CRUD
    applications.router/     MIGRATED — crud + business + draft leaves
    projects.router/         NOT MIGRATED (uses agentProcedure directly; spec/DAL exist, router pending S8)
    lead-sources.router.ts   NOT MIGRATED
    ... other routers ...
    app.ts                   root router; mounts everything
```

## Rules

### base-procedure-types

`src/trpc/init.ts` exports a four-rung procedure ladder, each rung extending the one above it (so session/ability/guards accumulate):

| Procedure | Guard | Ctx after |
|---|---|---|
| `baseProcedure` | None | `session: null, ability: null, scope: null` |
| `protectedProcedure` | Throws UNAUTHORIZED if no session; builds CASL `ability` from session role | `session: non-null, ability: non-null, scope: null` |
| `agentProcedure` | Extends protected; FORBIDDEN unless `ability.can('access', 'Dashboard')` (internal users) | same as protected |
| `superAdminProcedure` | Extends agent; FORBIDDEN unless `ability.can('manage', 'all')` (super-admin omni grant) | same as protected |

Entity sub-routers **never** call `agentProcedure` directly — they import the entity's pre-scoped procedure (`<entity>Procedure` / `<entity>ShareableProcedure`) from `<entity>.router/procedures.ts`, which has scope resolution baked on at definition time.

**Why**: scope resolution injects `ctx.scope` (the per-user visibility predicate). Bypassing it means agents could read rows they shouldn't.
**Reference impl**: `src/trpc/init.ts`; `src/trpc/routers/proposals.router/procedures.ts`
**Enforced by**: convention (a bare `agentProcedure` leaves `ctx.scope` null → DAL runs unscoped)

### superadmin-procedure

**Gate super-admin-only endpoints at the procedure, not in the handler body.** Use `superAdminProcedure` instead of an inline `if (ctx.session.user.role !== 'super-admin') throw` (or a per-router `requireSuperAdmin(role)` helper — both were removed 2026-06-04 in favor of this).

```ts
// ✅ procedure-level gate — visible in the procedure signature, one source of truth
disqualify: superAdminProcedure.input(...).mutation(...)

// ❌ inline role check — easy to forget, invisible at the call/registration site
disqualify: agentProcedure.input(...).mutation(async ({ ctx }) => {
  requireSuperAdmin(ctx.session.user.role) // don't
  ...
})
```

`superAdminProcedure` checks the centralized CASL ability (`can('manage', 'all')`), consistent with `agentProcedure`'s `can('access', 'Dashboard')` — not a hardcoded role string.

**Migration status**: `lead-sources` + `voip-campaigns` routers use this. Other routers still carry inline role checks (e.g. CASL `can('manage', 'all')` peeks in `customer-pipelines.router.ts`); they should migrate to `superAdminProcedure` as they're touched.
**Reference impl**: `src/trpc/init.ts`, `src/trpc/routers/lead-sources.router.ts`
**Enforced by**: convention

### procedures-defined-once

Per-entity pre-scoped procedures are defined **once** as top-level consts in `<entity>.router/procedures.ts` and imported directly by every sub-router. No factory generates them at call time; there is no toolkit argument.

```ts
// proposals.router/procedures.ts
/** Agent-only. Session + ability guaranteed; `ctx.scope` resolved (null for omni). */
export const proposalProcedure = agentProcedure.use(async ({ ctx, next }) => {
  const scope = resolveVisibilityScope(proposalServerSpec, { userId: ctx.session.user.id, ability: ctx.ability })
  return next({ ctx: { ...ctx, scope } })
})

/** Token-or-session. Token path → `ctx.scope = eq(token, …)`, `ctx.ability = null`. */
export const proposalShareableProcedure = baseProcedure.use(shareableMiddleware(proposalServerSpec))

/** No auth. Pass-through of baseProcedure — the caller enforces authorization inline. */
export const proposalPublicProcedure = baseProcedure
```

**The agent scope step is inlined, NOT `.use(scopeMiddleware(spec))`.** The standalone `scopeMiddleware` is typed against the ROOT context (nullable `session`); chaining it widens `ctx.session` back to null and forces an `as typeof agentProcedure` cast — the crutch the old factory needed. An inline `.use()` infers `ctx` from `agentProcedure`, so the non-null session/ability narrowing flows through and no cast is needed. The scope math stays DRY via the shared `resolveVisibilityScope(spec, { userId, ability })`.

**Naming**: the agent procedure is `<entity>Procedure`; shareable/public/system variants are `<entity>ShareableProcedure` / `<entity>PublicProcedure` / `systemProcedure`. Only declare the variants an entity actually uses (proposals needs all; meetings/applications need only the agent one).

**Why**: `server-spec.ts` stays a pure data object (imported by the DAL) — the tRPC runtime is pulled in only here, router-side, never into the entity/DAL layer. tRPC-idiomatic `const + typeof` deletes the cast.
**Reference impl**: `src/trpc/routers/proposals.router/procedures.ts`
**Enforced by**: convention

### one-leaf-shape

Every sub-router is `export const xxxRouter = createTRPCRouter({...})` in its own `*.router.ts` file, importing procedures from `./procedures`. No factory functions (`createXxxRouter(entity)`), no toolkit param.

```ts
// proposals.router/business.router.ts
export const businessRouter = createTRPCRouter({
  list: proposalProcedure.input(schema).query(async ({ ctx, input }) => dalToTrpc(await listProposals(ctx, input))),
  getFullView: proposalProcedure.input(schema).query(...),
})
```

CRUD is its own leaf, `crud.router.ts`, built by `createCrudRouter({ spec, schemas, handlers? })` — which builds its own scoped procedures **inline from `config.spec`** (same inline pattern, no cast, no procedure params).

**Reference impl**: `src/trpc/routers/proposals.router/crud.router.ts`, `.../business.router.ts`
**Enforced by**: convention

### pure-composition-index

`index.ts` is imports + one `createTRPCRouter({...})`. No procedure bodies, no factory call, one construction style.

```ts
// proposals.router/index.ts
export const proposalsRouter = createTRPCRouter({
  crud: crudRouter,
  business: businessRouter,
  incentives: incentivesRouter,
  funding: fundingRouter,
  delivery: deliveryRouter,
  views: viewsRouter,
  contracts: contractsRouter,
  media: proposalMediaRouter,
})
```

Router key order **is** the tRPC path — preserve it exactly when refactoring (`proposals.business.list` etc.).

**Reference impl**: `src/trpc/routers/proposals.router/index.ts`
**Enforced by**: convention

### scope-resolution-is-the-core-superpower

`resolveVisibilityScope(spec, { userId, ability })` resolves `ctx.scope`:

```ts
const isOmni = ability.can('manage', 'all')
return isOmni ? null : resolveEffectiveScope(spec, { userId, ability })   // SQL predicate | null
```

Every entity procedure bakes this on at definition time (the inline `.use()` above). DAL functions receive `ctx.scope` and apply it to WHERE clauses (`.where(and(..., ctx.scope ?? undefined))`). For child entities the resolved scope is the parent bridge (`fk IN (SELECT parent.pk WHERE <parent scope>)`) — see ADR-0002 and `dal/server/lib/scope.ts`.

This replaces the `isOmni`-or-predicate dance that previously had to be inlined in every procedure body.

**Why**: visibility scoping was being copy-pasted 30+ times across the codebase and had silently drifted. Resolving it in one shared helper, baked onto each entity procedure, makes it auditable and prevents new drift. Omni stays a procedure/context concern — never inside an entity predicate.
**Reference impl**: `src/trpc/lib/middleware/scope-middleware.ts` (`resolveVisibilityScope`); `src/shared/dal/server/lib/scope.ts` (`resolveEffectiveScope`)
**Enforced by**: convention (entity procedures chain it at definition; a bare `agentProcedure` leaves `ctx.scope` null)

### shareable-middleware-token-or-session

`shareableMiddleware(spec)` resolves dual-credential access:

- **Token present** (e.g., `?token=tpr-xxx`): validates the token column on the entity table, sets `ctx.scope = eq(tokenColumn, token)`, `ctx.ability = null`. **Token IS the authorization** — CASL is null.
- **Session present, no token**: requires session, builds ability, resolves scope from `spec.visibility({ userId, ability })`.
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
`can('update', 'Customer', ['age'])` (Addendum B, 2026-07-14 — the 23
sales-discovery fields that used to be field-restricted `Customer` columns
now live on the `customer_profiles` child table, gated by its own
`CustomerProfile` CASL subject instead — see
`../shared/entities/customers/DOCS.md#three-jsonb-profiles`) means agents
can call `crud.update({ data: { age: 42 } })` but NOT
`crud.update({ data: { phone: '...' } })` — the gate rejects the second
call automatically without any per-entity router code.

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

### entity-registry-removed

The `entityRegistry` + `registerEntity(spec)` duplicate-registration guard was **deleted in S7 (2026-08-11)** along with the `createEntityRouter` factory that populated it. The registry was write-only — never read anywhere in `src/` (its speculative "future use: openapi gen, admin scaffolds" never materialized, epic R7). Removing it dropped only a dev-time duplicate-`entityName` throw at module load; there is **no runtime regression** (nothing consumed the map). If a duplicate-name forcing-function is ever wanted again, add it where entity names are already centralized (`ENTITY_NAMES` in `abilities.ts`), not in a router-side registry.

### shareable-controls-which-procedure-crud-uses

`createCrudRouter` selects the procedure per slot based on `spec.shareable`:

```ts
const readProcedure   = spec.shareable ? shareableProcedure : authedProcedure
const updateProcedure = spec.shareable ? shareableProcedure : authedProcedure
// create, delete, duplicate always use authedProcedure
```

When `spec.shareable` is set, `getById` and `update` accept `?token=` and bypass CASL on the token path. `create`, `delete`, `duplicate` remain agent-only — even shareable entities can't be created or destroyed by an unauthenticated client.

When `spec.shareable` is falsy, `createCrudRouter` builds `authedProcedure` inline from the spec (`agentProcedure.use(...resolveVisibilityScope...)`) and uses it for every slot — the same inline pattern as `procedures.ts`, no cast.

**Why**: customers can read AND update their own proposal (e.g., choose a finance option) via the share URL, but they can't create/delete. The dual-credential model is targeted at read + non-destructive update.
**Reference impl**: `src/trpc/lib/create-crud-router.ts` (`readProcedure` / `updateProcedure` selection)
**Enforced by**: factory wiring; convention

### jsonb-merge-columns-merge-on-update

**Deleted (Wave 2, epic #256).** `spec.update.jsonbMergeColumns` and the `createCrudDal`
merge branch that read it no longer exist — `update` always plain-replaces a column now.
Nested/dynamic-key partial data goes through a child table instead; see
`docs/codebase-conventions/jsonb-columns.md#never-shallow-merge-nested` for the
replacement pattern and `src/shared/entities/customers/DOCS.md#lead-attribution-child`
for the reference migration (`customers.leadMetaJSON` → `customer_lead_attribution` +
`customer_enrichment`).

### dont-import-server-only-trpc-into-client

`src/trpc/server.ts` is marked `server-only` and uses React `cache()` for request deduplication. Importing it into a `'use client'` file fails the build.

Client components use `useTRPC()` + `useQuery(trpc.x.y.queryOptions())` from `@/trpc/helpers` instead.

**Why**: server proxy bundles server secrets + DAL + db imports. Leaking it into a client bundle ships the world.
**Reference impl**: `src/trpc/server.ts:1` (`'server-only'`)
**Enforced by**: `server-only` package (build fails on cross-boundary import)

### rsc-prefetch-uses-rsc-context

`src/trpc/server.ts`'s options proxy resolves its context via `createRSCTRPCContext` (`src/trpc/lib/create-http-context.ts`) — the SAME session resolution as the HTTP adapter (headers from `next/headers`), React-`cache()`'d per request. Never hand-roll a ctx for the proxy; a ctx without request headers yields `session: null` and every `agentProcedure` call through `prefetch` throws UNAUTHORIZED. Note `req` is `undefined` in RSC context: shareable-token procedures must never be server-prefetched.

`prefetch` wraps one internal `executePrefetch` that asserts the query key's expected shape in dev (`queryKey[0]` must be an array) before dispatching — a dev-only guard pinning the assumption that tRPC's `keyPrefix` flag is never enabled (enabling it moves a meta object to `queryKey[1]` and would silently break the infinite-query discriminator). See `src/trpc/lib/prefetch.ts`.

**Reference impl**: `src/trpc/lib/create-http-context.ts`, `src/trpc/server.ts`, `src/trpc/lib/prefetch.ts`
**Enforced by**: convention

### sub-router-when-2-plus

A flat `*.router.ts` is fine for one router. When a router has 2+ sub-routers, promote to a directory matching `notion.router/` / `proposals.router/`:

```
proposals.router/
  procedures.ts        per-entity pre-scoped procedures (defined once)
  index.ts             pure createTRPCRouter({...}) composing the children
  crud.router.ts       createCrudRouter({ spec, schemas }) leaf
  contracts.router.ts  service sub-router leaf
  delivery.router.ts   service sub-router leaf
```

**Reference impl**: `src/trpc/routers/proposals.router/`, `src/trpc/routers/notion.router/`
**Enforced by**: convention

## Migration status (as of 2026-08-11)

Adoption is broad now, not limited to the original canonical example — most agent-facing entities run through `EntityServerSpec` + the definition-once router shape (`procedures.ts` + `createCrudRouter` + pure `index.ts`). The `createEntityRouter` factory is gone (S6/S7); every migrated router below is factory-free.

| Entity | Status | Notes |
|---|---|---|
| Proposal | ✅ Migrated (PR #207) | Canonical exemplar — crud + business + delivery + contracts + child entities (media/views/incentives) |
| Customer | ✅ Migrated | crud + profile + business leaves |
| Meeting | ✅ Migrated | crud + reads + participants + business leaves |
| Application | ✅ Migrated | crud + business + draft leaves |
| Customer Note | ✅ Migrated | pure CRUD; author-or-admin hooks, see `../shared/entities/customers/DOCS.md#note-authorship` |
| Voip (calls, campaigns, DIDs, contacts, messages, link-tokens, contact-attributes) | ✅ Migrated | `entities/voip-*/` |
| App Settings | ✅ Migrated | `entities/app-settings/` |
| Project | ⚠️ Partial | `projectServerSpec` + `projectCrud` exist (S5a); `projects.router` still hand-written on `agentProcedure` directly — router migration is S8 |
| Lead Source | ❌ Not migrated | Single-file router; audited + scheduled in S8 |

Project (router) and Lead Source are the known gaps — the tRPC Standardization Epic slice **S8** audits both against R1–R13 and migrates `projects.router` onto `createCrudRouter`.

## Anti-patterns

- **Calling `agentProcedure` directly in an entity sub-router.** Import the entity's `<entity>Procedure` from `./procedures` — scope resolution is mandatory; a bare `agentProcedure` leaves `ctx.scope` null and the DAL runs unscoped.
- **Reintroducing a factory / toolkit / registry.** Procedures are defined once in `procedures.ts`; `index.ts` is pure composition. No `createEntityRouter`, no `EntityToolkit` param, no `entityRegistry`.
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
- `docs/codebase-conventions/jsonb-columns.md#never-shallow-merge-nested` — JSONB merge-safety history behind `#jsonb-merge-columns-merge-on-update` (mechanism deleted Wave 2; replacement pattern is a child table, not a merge config)
- `docs/codebase-conventions/frontend-stack.md#server-prefetch-two-tiers` — pages that server-prefetch via `trpc.server.ts` + `<HydrateClient>`
- ADR-0005 — JSONB vs column vs child table (storage-shape decision rule)
