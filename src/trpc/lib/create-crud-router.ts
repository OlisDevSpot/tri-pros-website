// CRUD sub-router factory — 5 single-row operations. see ../DOCS.md#crud-five-slots-fixed
// Each slot wires: CASL action gate + Zod input + DAL handler + dalToTrpc bridge.
// spec.shareable controls whether getById/update use shareable vs authed procedure.

// The scoped procedures are built INLINE from `config.spec` at the top of
// `createCrudRouter`'s body — never accepted as config params. This mirrors
// the per-entity `procedures.ts` pattern (see proposals.router/procedures.ts):
// an inline `.use()` chained directly off `agentProcedure`/`baseProcedure`
// infers `ctx` concretely, so no cast and no "procedure builder of any
// middleware depth" type is ever needed at a param boundary. Because no
// builder type crosses the function signature, `createCrudRouter` keeps its
// original four generics — nothing added for procedure typing.

import type { PgTable } from 'drizzle-orm/pg-core'
import type { Insert } from '@/shared/db/types'
import type { AppAction, AppSubject } from '@/shared/domains/permissions/types'

import type { CrudHandlers, EntityServerSpec, SlotName } from '@/trpc/types'

import { TRPCError } from '@trpc/server'
import z from 'zod'

import { agentProcedure, baseProcedure, createTRPCRouter } from '@/trpc/init'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'
import { resolveVisibilityScope } from '@/trpc/lib/middleware/scope-middleware'
import { shareableMiddleware } from '@/trpc/lib/middleware/shareable-middleware'

// Action mapping per slot — fixed (not entity-configurable).
const SLOT_ACTIONS: Record<SlotName, AppAction> = {
  getById: 'read',
  create: 'create',
  update: 'update',
  delete: 'delete',
  duplicate: 'create',
}

export interface CreateCrudRouterConfig<
  TTable extends PgTable,
  TId extends string | number,
  TInsert extends z.ZodObject<z.ZodRawShape>,
  TUpdate extends z.ZodObject<z.ZodRawShape>,
> {
  /** Entity spec — runtime config (table, visibility, casl, shareable). */
  spec: EntityServerSpec<TTable, TId>
  /**
   * Concrete Zod schemas for tRPC input validation + type inference.
   * `id`: Zod validator matching TId (z.string().uuid() or z.number().int())
   * `insert`: Entity's insert schema (concrete, not type-erased)
   * `update`: Entity's update schema (concrete, not type-erased)
   */
  schemas: { id: z.ZodType<TId>, insert: TInsert, update: TUpdate }
  /**
   * The entity's single CRUD instance, built once via
   * `createCrudDal(spec, configFactory)` in the entity's `dal/server/crud.ts`.
   * REQUIRED — the router never rebuilds handlers, so no code path can produce
   * un-hooked ones (the hookless-rebuild failure mode is eliminated by construction).
   */
  crud: CrudHandlers<TTable, TId>
  /**
   * Override individual CRUD handlers. Merged with createCrudDal defaults.
   * ⚠️ Overrides BYPASS spec.hooks entirely — the override replaces the
   * full DAL function including its before/after hook invocations.
   * Prefer spec.hooks for data enrichment; use this only when the entire
   * operation must be replaced.
   */
  handlers?: Partial<CrudHandlers<TTable, TId>>
}

export function createCrudRouter<
  TTable extends PgTable,
  TId extends string | number,
  TInsert extends z.ZodObject<z.ZodRawShape>,
  TUpdate extends z.ZodObject<z.ZodRawShape>,
>(config: CreateCrudRouterConfig<TTable, TId, TInsert, TUpdate>) {
  // Merge the entity's hooked instance with any bespoke slot overrides. The cast
  // reasserts the full interface: spreading the Partial `handlers` overrides widens
  // the property types to include `undefined`, so TS needs the assertion to treat
  // the merge as a complete `CrudHandlers`.
  const handlers = { ...config.crud, ...config.handlers } as CrudHandlers<TTable, TId>

  // Scoped procedures built inline from the spec — the cast-free inline `.use()`
  // pattern (ctx infers from agentProcedure, so no builder-type cast is needed).
  // Equivalent to what createEntityRouter's toolkit built from the same spec.
  const authedProcedure = agentProcedure.use(async ({ ctx, next }) =>
    next({ ctx: { ...ctx, scope: resolveVisibilityScope(config.spec, { userId: ctx.session.user.id, ability: ctx.ability }) } }))
  const shareableProcedure = baseProcedure.use(shareableMiddleware(config.spec))

  // Select the right procedure based on shareable config.
  const readProcedure = config.spec.shareable ? shareableProcedure : authedProcedure
  const updateProcedure = config.spec.shareable ? shareableProcedure : authedProcedure

  // Input schemas — token always optional (harmless on non-shareable entities).
  const { id: idZod } = config.schemas
  const idInput = z.object({ id: idZod, token: z.string().optional() })
  const updateInput = z.object({ id: idZod, data: config.schemas.update, token: z.string().optional() })
  const idOnlyInput = z.object({ id: idZod })

  // Static object literal — TypeScript infers the full router shape.
  return createTRPCRouter({
    getById: readProcedure
      .input(idInput)
      .query(async ({ ctx, input }) => {
        if (ctx.ability) {
          assertCan(ctx.ability, 'getById', config.spec)
        }
        const row = dalToTrpc(await handlers.getById(ctx, { id: input.id }))
        if (!row) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `${config.spec.entityName} not found` })
        }
        return row
      }),

    create: authedProcedure
      .input(config.schemas.insert)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx.ability, 'create', config.spec)
        // Cast: Zod schema output ≠ Drizzle Insert type because the API schema
        // intentionally .omit()s server-derived fields (e.g. kind, token). The
        // custom create handler adds them before inserting. Two independent type
        // systems (Zod + Drizzle) — can't be bridged without coupling DAL to Zod.
        const row = dalToTrpc(await handlers.create(ctx, input as Insert<TTable>))
        return row
      }),

    update: updateProcedure
      .input(updateInput)
      .mutation(async ({ ctx, input }) => {
        // Cast: Zod 4 can't resolve generic TUpdate output type in z.object({ data: TUpdate }).
        // The schema validates at runtime; this tells TS the shape matches CrudHandlers.
        const { id, data } = input as { id: TId, data: z.output<TUpdate>, token?: string }

        if (ctx.ability) {
          assertCanUpdateFields(ctx.ability, config.spec, data as Record<string, unknown>)
        }

        const row = dalToTrpc(await handlers.update(ctx, { id, data }))
        return row
      }),

    delete: authedProcedure
      .input(idOnlyInput)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx.ability, 'delete', config.spec)
        dalToTrpc(await handlers.delete(ctx, { id: input.id }))
      }),

    duplicate: authedProcedure
      .input(idOnlyInput)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx.ability, 'duplicate', config.spec)
        const row = dalToTrpc(await handlers.duplicate(ctx, { id: input.id }))
        return row
      }),
  })
}

// ── helpers ──────────────────────────────────────────────────────────────

/**
 * Slot-level CASL gate. Checks the slot's action against the entity subject
 * with no field arg — appropriate for `getById`, `create`, `delete`, `duplicate`
 * (row-granular operations). For the `update` slot, use `assertCanUpdateFields`
 * instead — slot-level checks let field-restricted grants bypass per-field
 * intent (see `assertCanUpdateFields` JSDoc).
 *
 * Accepts ability directly (not ctx) so callers can pass `ctx.ability` after
 * narrowing — avoids TS not narrowing the full ctx object through a function
 * boundary.
 */
function assertCan(
  ability: { can: (action: AppAction, subject: AppSubject, field?: string) => boolean },
  slot: SlotName,
  spec: EntityServerSpec,
): void {
  const action = SLOT_ACTIONS[slot]
  if (!ability.can(action, spec.caslSubject)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `You do not have permission to ${action} ${spec.entityName}`,
    })
  }
}

/**
 * Field-level CASL gate for the update slot. For every key in `data` whose
 * value is defined, requires `ability.can('update', subject, field)` to return
 * true. Throws FORBIDDEN naming the first field that fails.
 *
 * CASL semantics:
 * - Unrestricted grant (`can('update', 'X')` with no `fields`): every field passes.
 * - Field-restricted grant (`can('update', 'X', ['a', 'b'])`): only 'a' and 'b' pass.
 * - No grant: every field fails.
 * - `manage all`: every field passes.
 *
 * Undefined values are skipped (Drizzle ignores them anyway). Callers that
 * pass `data: { phone: undefined }` are treated as "not attempting to write
 * phone" — same semantics as the input shape itself.
 */
function assertCanUpdateFields(
  ability: { can: (action: AppAction, subject: AppSubject, field?: string) => boolean },
  spec: EntityServerSpec,
  data: Record<string, unknown>,
): void {
  for (const [field, value] of Object.entries(data)) {
    if (value === undefined) {
      continue
    }
    if (!ability.can('update', spec.caslSubject, field)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `You do not have permission to update ${spec.entityName}.${field}`,
      })
    }
  }
}
