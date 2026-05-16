// ─── createCrudRouter (L1) ──────────────────────────────────────────────────
// Thin tRPC sub-router over L0 handlers. Wraps each slot with:
//   - CASL action gate (action ← slot, subject ← spec.caslSubject)
//   - buildAgentCtx → L0 call → return
//   - domain error → TRPCError mapping
//
// `spec.shareable` rewires `getById` to use baseProcedure (no session
// required) and accept an optional `token`. Token path bypasses scope/CASL
// entirely; session path runs the normal authenticated flow.

import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type { AppAbility } from '@/shared/domains/permissions/types'
import type { CrudHandlers, EntityServerSpec, SlotName } from '@/trpc/types'

import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'
import z from 'zod'

import { paginationFieldsSchema, sortFieldsSchema } from '@/shared/dal/server/query/schemas'
import { db } from '@/shared/db'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { agentProcedure, baseProcedure, createTRPCRouter } from '@/trpc/init'

import { buildAgentCtx } from './build-agent-ctx'
import { createCrudHandlers } from './create-crud-handlers'

// L1 is the Zod→L0 adapter. spec.schemas.select is ZodTypeAny (type-erased
// by design) so Zod outputs `unknown` for the id field. This type bridges
// the boundary — Zod validates the value at runtime; this assertion tells TS
// the shape matches what L0 expects. Same pattern used for create/update below.
interface IdInput { id: string | number }

// Action mapping per slot — fixed (not entity-configurable).
const SLOT_ACTIONS: Record<SlotName, 'read' | 'create' | 'update' | 'delete'> = {
  list: 'read',
  getById: 'read',
  create: 'create',
  update: 'update',
  delete: 'delete',
  duplicate: 'create',
}

interface CreateCrudRouterOptions {
  /**
   * Slots to omit from the surfaced tRPC procedures. L0 still generates them
   * internally — business plugins can call `handlers.<slot>` directly.
   */
  exclude?: SlotName[]
}

export function createCrudRouter<TSpec extends EntityServerSpec<PgTable>>(
  spec: TSpec,
  options: CreateCrudRouterOptions = {},
) {
  const handlers = createCrudHandlers(spec)
  const exclude = new Set(options.exclude ?? [])

  // Derive the id Zod schema from the entity's select schema so the
  // procedure input matches the actual PK column type (string for UUID,
  // number for serial). Falls back to z.union if the field isn't found.
  const pkField = spec.schemas.select.shape[spec.primaryKey ?? 'id']
  const idSchema = z.object({ id: pkField ?? z.union([z.string(), z.number()]) })

  const procs: Record<string, unknown> = {}

  if (!exclude.has('list')) {
    procs.list = agentProcedure
      .input(z.object({
        pagination: paginationFieldsSchema,
        sort: sortFieldsSchema.optional(),
        search: z.string().optional(),
        // Filter shape is intentionally unconstrained at L1 in Phase 1a —
        // entities with filter requirements override list via a business
        // plugin until a typed-config solution lands in v2.
        filters: z.record(z.string(), z.unknown()).optional(),
      }))
      .query(async ({ ctx, input }) => {
        assertCan(ctx, 'list', spec)
        const agentCtx = buildAgentCtx(ctx, spec)
        return handlers.list(agentCtx, input)
      })
  }

  if (!exclude.has('getById')) {
    procs.getById = makeGetByIdProcedure(spec, handlers, idSchema)
  }

  if (!exclude.has('create')) {
    procs.create = agentProcedure
      .input(spec.schemas.insert)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx, 'create', spec)
        const agentCtx = buildAgentCtx(ctx, spec)
        // `input` is `unknown` because `spec.schemas.insert` is `ZodTypeAny` —
        // the schema validates at runtime. Cast is safe here.
        return mapDomainErrors(() => handlers.create(agentCtx, input as PgTable['$inferInsert']))
      })
  }

  if (!exclude.has('update')) {
    procs.update = agentProcedure
      .input(z.object({
        id: idSchema.shape.id,
        data: spec.schemas.update,
      }))
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx, 'update', spec)
        const agentCtx = buildAgentCtx(ctx, spec)
        // `input.data` is typed as `unknown` because `spec.schemas.update` is
        // `ZodTypeAny` — the schema validates at runtime. Cast is safe here.
        return mapDomainErrors(() => handlers.update(agentCtx, input as IdInput & { data: Partial<PgTable['$inferInsert']> }))
      })
  }

  if (!exclude.has('delete')) {
    procs.delete = agentProcedure
      .input(idSchema)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx, 'delete', spec)
        const agentCtx = buildAgentCtx(ctx, spec)
        return mapDomainErrors(() => handlers.delete(agentCtx, input as IdInput))
      })
  }

  if (!exclude.has('duplicate')) {
    procs.duplicate = agentProcedure
      .input(idSchema)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx, 'duplicate', spec)
        const agentCtx = buildAgentCtx(ctx, spec)
        return mapDomainErrors(() => handlers.duplicate(agentCtx, input as IdInput))
      })
  }

  return createTRPCRouter(procs as Parameters<typeof createTRPCRouter>[0])
}

// ── shareable getById ────────────────────────────────────────────────────
//
// When spec.shareable is set, getById accepts an optional token and uses
// baseProcedure (no session required). Token path: short-circuit visibility,
// return row if token matches. Session path: construct ability inline
// (baseProcedure lacks ctx.ability), enforce read, run normal flow.

function makeGetByIdProcedure<TSpec extends EntityServerSpec<PgTable>>(
  spec: TSpec,
  handlers: CrudHandlers<PgTable>,
  idSchema: z.ZodObject<{ id: z.ZodTypeAny }>,
) {
  if (!spec.shareable) {
    return agentProcedure
      .input(idSchema)
      .query(async ({ ctx, input }) => {
        assertCan(ctx, 'getById', spec)
        const agentCtx = buildAgentCtx(ctx, spec)
        const row = await handlers.getById(agentCtx, input as IdInput)
        if (!row) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `${spec.entityName} not found` })
        }
        return row
      })
  }

  const table = spec.table as unknown as Record<string, PgColumn | undefined>

  const tokenColumn = table[spec.shareable.tokenColumn]
  if (!tokenColumn) {
    throw new Error(
      `[create-crud-router] spec.shareable.tokenColumn '${spec.shareable.tokenColumn}' `
      + `is not a column on ${spec.entityName}'s table.`,
    )
  }
  const pkName = spec.primaryKey ?? 'id'
  const pkColumn = table[pkName]
  if (!pkColumn) {
    throw new Error(
      `[create-crud-router] spec.primaryKey '${pkName}' is not a column on `
      + `${spec.entityName}'s table.`,
    )
  }

  return baseProcedure
    .input(z.object({ id: idSchema.shape.id, token: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      // LAYERING DEFERRAL: this token path issues a raw db read instead of
      // calling an L0 handler. Future work — add `getByToken` to L0 so this
      // path also goes through createCrudHandlers and L1 has zero direct DB
      // imports. Deferred until Phase 1b's Proposal migration is the first
      // real consumer that pressure-tests the shape. See ADR-0002 + the
      // Phase 1a spec for the rationale.
      if (input.token) {
        const [row] = await db
          .select()
          .from(spec.table as PgTable)
          .where(and(
            eq(pkColumn, input.id),
            eq(tokenColumn, input.token),
          ))
          .limit(1)
        if (!row) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `${spec.entityName} not found` })
        }
        return row
      }

      // DO NOT REMOVE: baseProcedure ctx has no `.ability` (only
      // protectedProcedure's middleware adds it). The shareable getById
      // runs on baseProcedure so anonymous token-holders can read. When
      // a session is present but no token, this is the ONLY place we
      // can construct an ability — removing it breaks the session path
      // of every shareable entity.
      if (!ctx.session) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'A valid token or authenticated session is required',
        })
      }
      const ability = defineAbilitiesFor({
        id: ctx.session.user.id,
        role: ctx.session.user.role,
      })
      if (!ability.can('read', spec.caslSubject)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `You do not have permission to read ${spec.entityName}`,
        })
      }
      const agentCtx = buildAgentCtx(
        { session: ctx.session, ability },
        spec,
      )
      const row = await handlers.getById(agentCtx, { id: input.id } as IdInput)
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `${spec.entityName} not found` })
      }
      return row
    })
}

// ── helpers ──────────────────────────────────────────────────────────────

function assertCan(
  ctx: { ability: AppAbility },
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

async function mapDomainErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  }
  catch (err) {
    if (err instanceof TRPCError) {
      throw err
    }
    if (err instanceof Error) {
      switch (err.message) {
        case 'NotFound':
          throw new TRPCError({ code: 'NOT_FOUND' })
        case 'Forbidden':
          throw new TRPCError({ code: 'FORBIDDEN' })
        case 'CreateFailed':
        case 'DuplicateFailed':
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: err.message })
        default:
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause: err })
      }
    }
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })
  }
}
