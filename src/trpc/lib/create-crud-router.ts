// CRUD sub-router factory — 5 single-row operations. see ../DOCS.md#crud-five-slots-fixed
// Each slot wires: CASL action gate + Zod input + DAL handler + dalToTrpc bridge.
// spec.shareable controls whether getById/update use shareable vs authed procedure.

import type { PgTable } from 'drizzle-orm/pg-core'

import type { Insert, Row, Update } from '@/shared/db/types'
import type { AppAction, AppSubject } from '@/shared/domains/permissions/types'
import type { agentProcedure, baseProcedure } from '@/trpc/init'
import type { AuthedContext, CrudHandlers, EntityServerSpec, SlotName } from '@/trpc/types'

import { TRPCError } from '@trpc/server'
import z from 'zod'

import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { createTRPCRouter } from '@/trpc/init'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

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
  /** Pre-scoped agent procedure (agentProcedure + scope middleware). */
  authedProcedure: typeof agentProcedure
  /** Pre-scoped shareable procedure (baseProcedure + shareable middleware). */
  shareableProcedure: typeof baseProcedure
  /** Override individual CRUD handlers. Merged with createCrudDal defaults. */
  handlers?: Partial<CrudHandlers<TTable, TId>>
  /** Post-write lifecycle callbacks. Async — can call services, other DALs, fire-and-forget. */
  lifecycle?: {
    // eslint-disable-next-line ts/method-signature-style -- bivariant method signatures required for generic TTable assignability
    onCreated?(ctx: AuthedContext, row: Row<TTable>): Promise<void>
    // eslint-disable-next-line ts/method-signature-style
    onUpdated?(ctx: AuthedContext, row: Row<TTable>, meta: {
      previousRow: Row<TTable>
      input: { id: TId, data: Update<TTable> }
    }): Promise<void>
    // eslint-disable-next-line ts/method-signature-style
    onDeleted?(ctx: AuthedContext, input: { id: TId }): Promise<void>
    // eslint-disable-next-line ts/method-signature-style
    onDuplicated?(ctx: AuthedContext, row: Row<TTable>, sourceId: TId): Promise<void>
  }
}

export function createCrudRouter<
  TTable extends PgTable,
  TId extends string | number,
  TInsert extends z.ZodObject<z.ZodRawShape>,
  TUpdate extends z.ZodObject<z.ZodRawShape>,
>(config: CreateCrudRouterConfig<TTable, TId, TInsert, TUpdate>) {
  // Merge default DAL handlers with any caller-provided overrides.
  const defaults = createCrudDal(config.spec)
  // Cast: spread merge of defaults + Partial overrides loses the full interface
  // type. TS can't prove all 5 keys are present after the merge (even though
  // defaults has all 5 and Partial can only override, not remove). Fixable by
  // explicit ?? per key — deferred for readability.
  const handlers = { ...defaults, ...config.handlers } as CrudHandlers<TTable, TId>

  // Select the right procedure based on shareable config.
  const readProcedure = config.spec.shareable
    ? config.shareableProcedure
    : config.authedProcedure
  const updateProcedure = config.spec.shareable
    ? config.shareableProcedure
    : config.authedProcedure

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

    create: config.authedProcedure
      .input(config.schemas.insert)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx.ability, 'create', config.spec)
        // Cast: Zod schema output ≠ Drizzle Insert type because the API schema
        // intentionally .omit()s server-derived fields (e.g. kind, token). The
        // custom create handler adds them before inserting. Two independent type
        // systems (Zod + Drizzle) — can't be bridged without coupling DAL to Zod.
        const row = dalToTrpc(await handlers.create(ctx, input as Insert<TTable>))
        if (config.lifecycle?.onCreated) {
          await config.lifecycle.onCreated(ctx as AuthedContext, row)
        }
        return row
      }),

    update: updateProcedure
      .input(updateInput)
      .mutation(async ({ ctx, input }) => {
        if (ctx.ability) {
          assertCan(ctx.ability, 'update', config.spec)
        }
        // Cast: Zod 4 can't resolve generic TUpdate output type in z.object({ data: TUpdate }).
        // The schema validates at runtime; this tells TS the shape matches CrudHandlers.
        const { id, data } = input as { id: TId, data: z.output<TUpdate>, token?: string }

        // Fetch previous row for lifecycle callback (one extra SELECT, only when onUpdated defined)
        let previousRow: Row<TTable> | undefined
        if (config.lifecycle?.onUpdated) {
          previousRow = dalToTrpc(await handlers.getById(ctx, { id })) ?? undefined
        }

        const row = dalToTrpc(await handlers.update(ctx, { id, data }))

        if (config.lifecycle?.onUpdated && previousRow) {
          await config.lifecycle.onUpdated(ctx as AuthedContext, row, {
            previousRow,
            input: { id, data: data as Update<TTable> },
          })
        }
        return row
      }),

    delete: config.authedProcedure
      .input(idOnlyInput)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx.ability, 'delete', config.spec)
        dalToTrpc(await handlers.delete(ctx, { id: input.id }))
        if (config.lifecycle?.onDeleted) {
          await config.lifecycle.onDeleted(ctx as AuthedContext, { id: input.id as TId })
        }
      }),

    duplicate: config.authedProcedure
      .input(idOnlyInput)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx.ability, 'duplicate', config.spec)
        const row = dalToTrpc(await handlers.duplicate(ctx, { id: input.id }))
        if (config.lifecycle?.onDuplicated) {
          await config.lifecycle.onDuplicated(ctx as AuthedContext, row, input.id as TId)
        }
        return row
      }),
  })
}

// ── helpers ──────────────────────────────────────────────────────────────

/**
 * CASL permission gate. Accepts ability directly (not ctx) so callers
 * can pass ctx.ability after narrowing — avoids TS not narrowing the
 * full ctx object through a function boundary.
 */
function assertCan(
  ability: { can: (action: AppAction, subject: AppSubject) => boolean },
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
