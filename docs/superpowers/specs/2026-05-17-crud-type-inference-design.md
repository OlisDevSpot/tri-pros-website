# CRUD Router Type Inference Redesign

> Eliminates ~25 type casts across the entity server system by fixing three
> structural root causes: middleware typing, schema type erasure, and dynamic
> router construction.

## Problem

The `createCrudRouter` factory and its middleware chain have ~25 type casts
(`as unknown as`, `as never`, `Record<string, unknown>`) that silence TypeScript
instead of satisfying it. The client sees `unknown` for CRUD procedure inputs
and outputs. Three root causes:

1. **Middleware type erasure** — `scopeMiddleware` and `shareableMiddleware` are
   plain functions with hand-typed interfaces instead of using `t.middleware()`.
   The `as never` cast in `create-entity-router.ts` kills ctx type tracking.

2. **Schema type erasure** — `EntityServerSpec.schemas` is typed as
   `ZodObject<Record<string, ZodTypeAny>>`. Zod infers `unknown` for all fields.
   tRPC's `.input(spec.schemas.insert)` gives the client `unknown` inputs.

3. **Dynamic router construction** — `createCrudRouter` builds procedures into
   `Record<string, unknown>` to support `exclude` (which nobody uses). tRPC needs
   a static object literal to infer the router shape.

## Decision

### 1. EntityServerSpec — add `TId` generic, keep schemas

```ts
interface EntityServerSpec<
  TTable extends PgTable = PgTable,
  TId extends string | number = string,
> {
  entityName: EntityName
  caslSubject: AppSubject
  visibility: (userId: string) => SQL
  table: TTable
  schemas: {
    insert: z.ZodObject<Record<string, z.ZodTypeAny>>
    update: z.ZodObject<Record<string, z.ZodTypeAny>>
    select: z.ZodObject<Record<string, z.ZodTypeAny>>
  }
  primaryKey?: string
  shareable?: { tokenColumn: string }
  update?: { jsonbMergeColumns: readonly PgColumn[] }
}
```

- `TId` defaults to `string` (UUID — all current entities). Serial entities
  pass `number`. This replaces the unresolvable `PkField<TTable>` conditional.
- Schemas stay on the spec for DAL runtime `.parse()` validation (WDS pattern:
  DAL owns authorization + validation). They remain type-erased at the interface
  level — this is fine for DAL, which casts `.parse()` results to Drizzle types.
- The entity spec file exports a **concrete-typed schemas object** alongside the
  spec, for tRPC consumers that need type inference:

```ts
// entities/proposals/lib/server-spec.ts

// Concrete types preserved — consumed by createCrudRouter for tRPC inference
export const proposalSchemas = {
  insert: insertProposalSchema,
  update: insertProposalSchema.partial(),
}

// Runtime spec — schemas type-erased via EntityServerSpec interface
export const proposalServerSpec = {
  entityName: PROPOSAL,
  caslSubject: PROPOSAL,
  visibility: proposalVisibility,
  table: proposals,
  schemas: { ...proposalSchemas, select: selectProposalSchema },
  shareable: { tokenColumn: 'token' },
} satisfies EntityServerSpec<typeof proposals>  // TId defaults to string
```

Same objects at runtime. Two type-level views.

### 2. CrudHandlers — uses `TId` instead of `PkField`

```ts
interface CrudHandlers<TTable extends PgTable, TId extends string | number = string> {
  getById: (ctx: ScopedContext, input: { id: TId }) => Promise<DalReturn<Row<TTable> | undefined>>
  create:  (ctx: ScopedContext, input: Insert<TTable>) => Promise<DalReturn<Row<TTable>>>
  update:  (ctx: ScopedContext, input: { id: TId, data: Update<TTable> }) => Promise<DalReturn<Row<TTable>>>
  delete:  (ctx: ScopedContext, input: { id: TId }) => Promise<DalReturn<void>>
  duplicate: (ctx: ScopedContext, input: { id: TId }) => Promise<DalReturn<Row<TTable>>>
}
```

`PkField<TTable>` conditional type is deleted.

### 3. Middleware — use `t.middleware()` properly

Export `t.middleware` from `init.ts`:

```ts
// init.ts
export const createMiddleware = t.middleware
```

Rewrite both middleware factories:

```ts
// scope-middleware.ts
import { createMiddleware } from '@/trpc/init'

export function scopeMiddleware(spec: EntityServerSpec) {
  return createMiddleware(async ({ ctx, next }) => {
    const isOmni = ctx.ability.can('manage', 'all')
    const scope = isOmni ? null : spec.visibility(ctx.session.user.id)
    return next({ ctx: { ...ctx, scope } })
  })
}
```

```ts
// shareable-middleware.ts
import { createMiddleware } from '@/trpc/init'

export function shareableMiddleware(spec: EntityServerSpec) {
  const tokenColumn = resolveTokenColumn(spec)

  return createMiddleware(async ({ ctx, next, getRawInput }) => {
    const rawInput = await getRawInput() as Record<string, unknown> | undefined
    const token = rawInput?.token as string | undefined

    if (token && tokenColumn) {
      return next({
        ctx: { ...ctx, ability: null, scope: eq(tokenColumn, token) },
      })
    }

    if (!ctx.session) {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }

    const ability = defineAbilitiesFor({ id: ctx.session.user.id, role: ctx.session.user.role })
    const isOmni = ability.can('manage', 'all')
    const scope = isOmni ? null : spec.visibility(ctx.session.user.id)

    return next({ ctx: { ...ctx, ability, scope } })
  })
}
```

- Delete hand-typed `ScopeMiddlewareOpts` and `ShareableMiddlewareOpts` interfaces.
- tRPC natively tracks ctx transformations through the chain.
- The `as never` + `as typeof` double-cast in `create-entity-router.ts` is eliminated.

### 4. createCrudRouter — static literal, concrete schemas

```ts
export function createCrudRouter<
  TTable extends PgTable,
  TId extends string | number,
  TInsert extends z.ZodObject<z.ZodRawShape>,
  TUpdate extends z.ZodObject<z.ZodRawShape>,
>(config: {
  spec: EntityServerSpec<TTable, TId>
  schemas: { insert: TInsert, update: TUpdate, id: z.ZodType<TId> }
  authedProcedure: typeof agentProcedure
  shareableProcedure: typeof baseProcedure
  handlers?: Partial<CrudHandlers<TTable, TId>>
}) {
  const defaults = createCrudDal(config.spec)
  const handlers = { ...defaults, ...config.handlers }

  const readProcedure = config.spec.shareable
    ? config.shareableProcedure
    : config.authedProcedure
  const updateProcedure = config.spec.shareable
    ? config.shareableProcedure
    : config.authedProcedure

  const idInput = z.object({ id: config.schemas.id, token: z.string().optional() })
  const updateInput = z.object({ id: config.schemas.id, data: config.schemas.update, token: z.string().optional() })

  return createTRPCRouter({
    getById: readProcedure
      .input(idInput)
      .query(async ({ ctx, input }) => {
        if (ctx.ability) assertCan(ctx, 'getById', config.spec)
        const row = dalToTrpc(await handlers.getById(ctx, { id: input.id }))
        if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: `${config.spec.entityName} not found` })
        return row
      }),

    create: config.authedProcedure
      .input(config.schemas.insert)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx, 'create', config.spec)
        return dalToTrpc(await handlers.create(ctx, input as Insert<TTable>))
      }),

    update: updateProcedure
      .input(updateInput)
      .mutation(async ({ ctx, input }) => {
        if (ctx.ability) assertCan(ctx, 'update', config.spec)
        return dalToTrpc(await handlers.update(ctx, { id: input.id, data: input.data }))
      }),

    delete: config.authedProcedure
      .input(z.object({ id: config.schemas.id }))
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx, 'delete', config.spec)
        return dalToTrpc(await handlers.delete(ctx, { id: input.id }))
      }),

    duplicate: config.authedProcedure
      .input(z.object({ id: config.schemas.id }))
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx, 'duplicate', config.spec)
        return dalToTrpc(await handlers.duplicate(ctx, { id: input.id }))
      }),
  })
}
```

- Static object literal — tRPC infers full router shape.
- `exclude` dropped (no consumers).
- `token: z.string().optional()` always present on read/update inputs. Harmless on
  non-shareable entities (middleware ignores it).
- Single cast: `input as Insert<TTable>` on `create` — Zod→Drizzle type boundary.

### 5. createEntityRouter + EntityToolkit — simplified

```ts
export interface EntityToolkit<TTable extends PgTable> {
  authedProcedure: typeof agentProcedure
  shareableProcedure: typeof baseProcedure
  publicProcedure: typeof baseProcedure
  spec: EntityServerSpec<TTable>
}

export function createEntityRouter<TSpec extends EntityServerSpec, TRouter extends AnyRouter>(
  spec: TSpec,
  factory: (entity: EntityToolkit<TSpec['table']>) => TRouter,
): TRouter {
  registerEntity(spec)

  const scopedAgent = agentProcedure.use(scopeMiddleware(spec))
  const scopedShareable = baseProcedure.use(shareableMiddleware(spec))

  const toolkit: EntityToolkit<TSpec['table']> = {
    authedProcedure: scopedAgent,
    shareableProcedure: scopedShareable,
    publicProcedure: baseProcedure,
    spec,
  }

  return factory(toolkit)
}
```

- `crud` removed from toolkit — consumer calls `createCrudRouter()` directly.
- No `as never` / `as AnyRouter` casts — middleware returns correct types.
- Note: the `authedProcedure` type on `EntityToolkit` is `typeof agentProcedure`
  which is slightly wider than the actual scoped procedure type. tRPC's own
  inference fills in the correct ctx at handler level. If this assignment doesn't
  compile, a single controlled cast here is acceptable — it's at the toolkit
  boundary, not scattered across 16 sites.

## Call Sites

### Proposals (shareable, custom handlers)

```ts
export const proposalsRouter = createEntityRouter(proposalServerSpec, (entity) =>
  createTRPCRouter({
    crud: createCrudRouter({
      spec: proposalServerSpec,
      schemas: { ...proposalSchemas, id: z.string().uuid() },
      authedProcedure: entity.authedProcedure,
      shareableProcedure: entity.shareableProcedure,
      handlers: { create: proposalCreateDal, duplicate: proposalDuplicateDal },
    }),
    business: createTRPCRouter({ ... }),
    delivery: createDeliveryRouter(entity),
    contracts: contractsRouter,
  })
)
```

### Simple entity (no shareable, no overrides)

```ts
export const customersRouter = createEntityRouter(customerServerSpec, (entity) =>
  createTRPCRouter({
    crud: createCrudRouter({
      spec: customerServerSpec,
      schemas: { ...customerSchemas, id: z.string().uuid() },
      authedProcedure: entity.authedProcedure,
      shareableProcedure: entity.shareableProcedure,
    }),
    business: createTRPCRouter({ ... }),
  })
)
```

### Serial PK entity

```ts
export const widgetsRouter = createEntityRouter(widgetServerSpec, (entity) =>
  createTRPCRouter({
    crud: createCrudRouter({
      spec: widgetServerSpec,
      schemas: { ...widgetSchemas, id: z.number().int() },
      authedProcedure: entity.authedProcedure,
      shareableProcedure: entity.shareableProcedure,
    }),
  })
)
```

## Cast Inventory (before → after)

| File | Before | After |
|------|--------|-------|
| `create-entity-router.ts` | 7 | 0-1 (procedure type compat — TBD) |
| `create-crud-router.ts` | 16 | 1 (Zod→Drizzle on create input) |
| `scope-middleware.ts` | Hand-typed interface | Deleted — uses `createMiddleware` |
| `shareable-middleware.ts` | Hand-typed interface | Deleted — uses `createMiddleware` |
| `proposals.router/index.ts` | 1 | 0 |
| **Total** | **~25** | **1-2** |

## Files Changed

| File | Action |
|------|--------|
| `src/shared/dal/server/lib/types.ts` | Add `TId` to `EntityServerSpec` and `CrudHandlers`, delete `PkField` |
| `src/shared/dal/server/lib/create-crud-dal.ts` | Update generics for `TId` |
| `src/shared/entities/proposals/lib/server-spec.ts` | Export `proposalSchemas` alongside spec |
| `src/trpc/init.ts` | Export `createMiddleware = t.middleware` |
| `src/trpc/lib/middleware/scope-middleware.ts` | Rewrite with `createMiddleware` |
| `src/trpc/lib/middleware/shareable-middleware.ts` | Rewrite with `createMiddleware` |
| `src/trpc/lib/create-crud-router.ts` | Rewrite: static literal, schemas config, `TId` |
| `src/trpc/lib/create-entity-router.ts` | Remove `crud` from toolkit, remove casts |
| `src/trpc/routers/proposals.router/index.ts` | Replace inlined CRUD with `createCrudRouter()` |
| `src/trpc/types.ts` | Update re-exports for changed types |

## Implementation Notes

- **Checkpoint:** `checkpoint/pre-crud-type-fix` tag exists. Revert with
  `git reset --hard checkpoint/pre-crud-type-fix` if needed.
- **Verification:** After each file change, run `pnpm tsc --noEmit`. The
  middleware fix (root cause 1) must land before the CRUD router rewrite
  (root cause 3) because the CRUD router depends on properly-typed procedures.
- **Client code:** Existing call sites (`trpc.proposalsRouter.crud.update.mutationOptions()`)
  should work unchanged — the router shape is the same, just properly typed.
  If any client code relied on `unknown` types (via explicit type annotations
  or `as` casts), it may need adjustment.
- **Implementation order:** types.ts → init.ts → middleware → create-crud-dal →
  create-crud-router → create-entity-router → server-spec → proposals.router
