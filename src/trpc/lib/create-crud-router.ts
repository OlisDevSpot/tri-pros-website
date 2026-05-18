// ─── createCrudRouter (L1) ──────────────────────────────────────────────────
// Thin tRPC sub-router that maps 5 CRUD slots to tRPC procedures.
// Receives pre-scoped procedures from the L2 entity toolkit — scope middleware
// is already baked in. Each slot wires:
//   - CASL action gate (action <- slot, subject <- spec.caslSubject)
//   - Zod input validation from spec.schemas
//   - DAL handler call (default from createCrudDal, overridable per-slot)
//   - domain error -> TRPCError mapping
//
// `spec.shareable` controls whether `getById` and `update` use the shareable
// procedure (token-or-session) or the authed procedure (session-only).

import type { PgTable } from 'drizzle-orm/pg-core'

import type { agentProcedure, baseProcedure } from '@/trpc/init'
import type { AuthedContext, CrudHandlers, EntityServerSpec, ScopedContext, SlotName } from '@/trpc/types'

import { TRPCError } from '@trpc/server'
import z from 'zod'

import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { createTRPCRouter } from '@/trpc/init'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

// L1 is the Zod->L0 adapter. spec.schemas.select is ZodObject (type-erased
// by design) so Zod outputs `unknown` for the id field. This type bridges
// the boundary — Zod validates the value at runtime; this assertion tells TS
// the shape matches what L0 expects. Same pattern used for create/update below.
interface IdInput { id: string | number }

// Action mapping per slot — fixed (not entity-configurable).
const SLOT_ACTIONS: Record<SlotName, 'read' | 'create' | 'update' | 'delete'> = {
  getById: 'read',
  create: 'create',
  update: 'update',
  delete: 'delete',
  duplicate: 'create',
}

interface CreateCrudRouterOptions {
  /**
   * Slots to omit from the surfaced tRPC procedures. The DAL still generates
   * them — business plugins can call `handlers.<slot>` directly.
   */
  exclude?: SlotName[]
  /**
   * Override individual CRUD handler functions. Merged with defaults from
   * `createCrudDal(spec)` — only the keys you provide are overridden.
   */
  handlers?: Partial<CrudHandlers<PgTable>>
  /**
   * Pre-scoped agent procedure (agentProcedure + scope middleware).
   * Passed in from the L2 entity toolkit — L1 does NOT create its own
   * middleware chain.
   */
  authedProcedure: typeof agentProcedure
  /**
   * Pre-scoped shareable procedure (baseProcedure + shareable middleware).
   * Used for getById/update on shareable entities. Passed in from the L2
   * entity toolkit.
   */
  shareableProcedure: typeof baseProcedure
}

export function createCrudRouter<TSpec extends EntityServerSpec<PgTable>>(
  spec: TSpec,
  options: CreateCrudRouterOptions,
) {
  // Merge default DAL handlers with any caller-provided overrides.
  const defaults = createCrudDal(spec)
  const handlers: CrudHandlers<PgTable> = { ...defaults, ...options.handlers }
  const exclude = new Set(options.exclude ?? [])

  // Derive the id Zod schema from the entity's select schema so the
  // procedure input matches the actual PK column type (string for UUID,
  // number for serial). Falls back to z.union if the field isn't found.
  const pkField = spec.schemas.select.shape[spec.primaryKey ?? 'id']
  const idSchema = z.object({ id: pkField ?? z.union([z.string(), z.number()]) })

  // Select the right procedure based on shareable config.
  // Shareable entities use the token-or-session procedure for read/update;
  // non-shareable entities use the authed procedure for everything.
  const readProcedure = spec.shareable
    ? options.shareableProcedure
    : options.authedProcedure
  const updateProcedure = spec.shareable
    ? options.shareableProcedure
    : options.authedProcedure

  const procs: Record<string, unknown> = {}

  if (!exclude.has('getById')) {
    // Token path: ctx.ability is null — skip CASL check.
    // Session path: ctx.ability is non-null — enforce read permission.
    const getByIdInput = spec.shareable
      ? z.object({ id: idSchema.shape.id, token: z.string().optional() })
      : idSchema

    procs.getById = readProcedure
      .input(getByIdInput)
      .query(async ({ ctx, input }: { ctx: Record<string, unknown>, input: Record<string, unknown> }) => {
        if (ctx.ability) {
          assertCan(ctx as unknown as AuthedContext, 'getById', spec)
        }
        const row = await dalToTrpc(
          await handlers.getById(ctx as unknown as ScopedContext, input as unknown as IdInput),
        )
        if (!row) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `${spec.entityName} not found` })
        }
        return row
      })
  }

  if (!exclude.has('create')) {
    procs.create = options.authedProcedure
      .input(spec.schemas.insert)
      .mutation(async ({ ctx, input }: { ctx: Record<string, unknown>, input: unknown }) => {
        assertCan(ctx as unknown as AuthedContext, 'create', spec)
        return dalToTrpc(
          await handlers.create(ctx as unknown as ScopedContext, input as PgTable['$inferInsert']),
        )
      })
  }

  if (!exclude.has('update')) {
    const updateInput = spec.shareable
      ? z.object({ id: idSchema.shape.id, data: spec.schemas.update, token: z.string().optional() })
      : z.object({ id: idSchema.shape.id, data: spec.schemas.update })

    procs.update = updateProcedure
      .input(updateInput)
      .mutation(async ({ ctx, input }: { ctx: Record<string, unknown>, input: unknown }) => {
        if (ctx.ability) {
          assertCan(ctx as unknown as AuthedContext, 'update', spec)
        }
        return dalToTrpc(
          await handlers.update(ctx as unknown as ScopedContext, input as IdInput & { data: Partial<PgTable['$inferInsert']> }),
        )
      })
  }

  if (!exclude.has('delete')) {
    procs.delete = options.authedProcedure
      .input(idSchema)
      .mutation(async ({ ctx, input }: { ctx: Record<string, unknown>, input: unknown }) => {
        assertCan(ctx as unknown as AuthedContext, 'delete', spec)
        return dalToTrpc(await handlers.delete(ctx as unknown as ScopedContext, input as IdInput))
      })
  }

  if (!exclude.has('duplicate')) {
    procs.duplicate = options.authedProcedure
      .input(idSchema)
      .mutation(async ({ ctx, input }: { ctx: Record<string, unknown>, input: unknown }) => {
        assertCan(ctx as unknown as AuthedContext, 'duplicate', spec)
        return dalToTrpc(await handlers.duplicate(ctx as unknown as ScopedContext, input as IdInput))
      })
  }

  return createTRPCRouter(procs as Parameters<typeof createTRPCRouter>[0])
}

// ── helpers ──────────────────────────────────────────────────────────────

function assertCan(
  ctx: AuthedContext,
  slot: SlotName,
  spec: EntityServerSpec<PgTable>,
): void {
  const action = SLOT_ACTIONS[slot]
  if (!ctx.ability.can(action, spec.caslSubject)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `You do not have permission to ${action} ${spec.entityName}`,
    })
  }
}
