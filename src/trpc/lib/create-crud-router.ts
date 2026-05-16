// ─── createCrudRouter (L1) ──────────────────────────────────────────────────
// Thin tRPC sub-router over L0 handlers. Wraps each slot with:
//   - CASL action gate (action ← slot, subject ← spec.caslSubject)
//   - buildAgentCtx → L0 call → return
//   - domain error → TRPCError mapping
//
// `spec.shareable` rewires `getById` to use baseProcedure (no session
// required) and accept an optional `token`. Token path bypasses scope/CASL
// entirely; session path runs the normal authenticated flow.
//
// Generic upper bound on CoreEntitySpec is the type-level forcing function:
// NestedEntitySpec instances fail to compile when passed in.

import type { PgTable } from 'drizzle-orm/pg-core'

import type { AppAbility, CoreEntitySpec, SlotName } from './types'

import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'
import z from 'zod'

import { paginationFieldsSchema, sortFieldsSchema } from '@/shared/dal/server/query/schemas'
import { db } from '@/shared/db'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { agentProcedure, baseProcedure, createTRPCRouter } from '@/trpc/init'

import { buildAgentCtx } from './build-agent-ctx'
import { createCrudHandlers } from './create-crud-handlers'

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

export function createCrudRouter<TSpec extends CoreEntitySpec<PgTable>>(
  spec: TSpec,
  options: CreateCrudRouterOptions = {},
) {
  const handlers = createCrudHandlers(spec)
  const exclude = new Set(options.exclude ?? [])
  const idSchema = z.object({ id: z.string() })

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
        id: z.string(),
        data: spec.schemas.update,
      }))
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx, 'update', spec)
        const agentCtx = buildAgentCtx(ctx, spec)
        // `input.data` is typed as `unknown` because `spec.schemas.update` is
        // `ZodTypeAny` — the schema validates at runtime. Cast is safe here.
        return mapDomainErrors(() => handlers.update(agentCtx, input as { id: string, data: Partial<PgTable['$inferInsert']> }))
      })
  }

  if (!exclude.has('delete')) {
    procs.delete = agentProcedure
      .input(idSchema)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx, 'delete', spec)
        const agentCtx = buildAgentCtx(ctx, spec)
        return mapDomainErrors(() => handlers.delete(agentCtx, input))
      })
  }

  if (!exclude.has('duplicate')) {
    procs.duplicate = agentProcedure
      .input(idSchema)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx, 'duplicate', spec)
        const agentCtx = buildAgentCtx(ctx, spec)
        return mapDomainErrors(() => handlers.duplicate(agentCtx, input))
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

function makeGetByIdProcedure<TSpec extends CoreEntitySpec<PgTable>>(
  spec: TSpec,
  handlers: ReturnType<typeof createCrudHandlers<TSpec['table']>>,
  idSchema: z.ZodObject<{ id: z.ZodString }>,
) {
  if (!spec.shareable) {
    return agentProcedure
      .input(idSchema)
      .query(async ({ ctx, input }) => {
        assertCan(ctx, 'getById', spec)
        const agentCtx = buildAgentCtx(ctx, spec)
        const row = await handlers.getById(agentCtx, input)
        if (!row) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `${spec.entityName} not found` })
        }
        return row
      })
  }

  const tokenColumn = (spec.table as unknown as Record<string, unknown>)[spec.shareable.tokenColumn]
  if (!tokenColumn) {
    throw new Error(
      `[create-crud-router] spec.shareable.tokenColumn '${spec.shareable.tokenColumn}' `
      + `is not a column on ${spec.entityName}'s table.`,
    )
  }
  const pkName = spec.primaryKey ?? 'id'
  const pkColumn = (spec.table as unknown as Record<string, unknown>)[pkName]
  if (!pkColumn) {
    throw new Error(
      `[create-crud-router] spec.primaryKey '${pkName}' is not a column on `
      + `${spec.entityName}'s table.`,
    )
  }

  return baseProcedure
    .input(z.object({ id: z.string(), token: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      // Token path: anonymous or authenticated, token matches → return row.
      if (input.token) {
        const [row] = await db
          .select()
          .from(spec.table as PgTable)
          .where(and(
            // @ts-expect-error — runtime-validated above; columns are PgColumn at runtime.
            eq(pkColumn, input.id),
            // @ts-expect-error — same.
            eq(tokenColumn, input.token),
          ))
          .limit(1)
        if (!row) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `${spec.entityName} not found` })
        }
        return row
      }

      // Session path: authenticated callers go through normal scope.
      // baseProcedure doesn't add `ability` to ctx (only protectedProcedure
      // does), so we construct one inline from the session's role.
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
      const row = await handlers.getById(agentCtx, { id: input.id })
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
  spec: CoreEntitySpec<PgTable>,
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
