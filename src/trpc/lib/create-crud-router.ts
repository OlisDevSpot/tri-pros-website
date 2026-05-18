// ─── createCrudRouter (CRUD Sub-router) ─────────────────────────────────────
// Thin tRPC sub-router that maps 5 CRUD slots to tRPC procedures.
// Receives pre-scoped procedures from the entity router and concrete Zod
// schemas for full type inference. Each slot wires:
//   - CASL action gate (action <- slot, subject <- spec.caslSubject)
//   - Zod input validation from concrete schemas (not type-erased spec)
//   - DAL handler call (default from createCrudDal, overridable per-slot)
//   - DalReturn → TRPCError via dalToTrpc
//
// The router is a static object literal — all 5 slots always present.
// TypeScript infers the full router shape for end-to-end client type safety.
//
// `spec.shareable` controls whether `getById` and `update` use the shareable
// procedure (token-or-session) or the authed procedure (session-only).

import type { PgTable } from 'drizzle-orm/pg-core'

import type { Insert } from '@/shared/db/types'
import type { AppAction, AppSubject } from '@/shared/domains/permissions/types'
import type { agentProcedure, baseProcedure } from '@/trpc/init'
import type { CrudHandlers, EntityServerSpec, SlotName } from '@/trpc/types'

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
}

export function createCrudRouter<
  TTable extends PgTable,
  TId extends string | number,
  TInsert extends z.ZodObject<z.ZodRawShape>,
  TUpdate extends z.ZodObject<z.ZodRawShape>,
>(config: CreateCrudRouterConfig<TTable, TId, TInsert, TUpdate>) {
  // Merge default DAL handlers with any caller-provided overrides.
  const defaults = createCrudDal(config.spec)
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
        return dalToTrpc(await handlers.create(ctx, input as Insert<TTable>))
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
        return dalToTrpc(await handlers.update(ctx, { id, data }))
      }),

    delete: config.authedProcedure
      .input(idOnlyInput)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx.ability, 'delete', config.spec)
        dalToTrpc(await handlers.delete(ctx, { id: input.id }))
      }),

    duplicate: config.authedProcedure
      .input(idOnlyInput)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx.ability, 'duplicate', config.spec)
        return dalToTrpc(await handlers.duplicate(ctx, { id: input.id }))
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
